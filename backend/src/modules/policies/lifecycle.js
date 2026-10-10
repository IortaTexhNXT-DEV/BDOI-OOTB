/**
 * Policy lifecycle (TIS-BRD-ISSUE-04): the guarded moves between the statuses of a policy in force.
 *   active -> suspended   premium warranty breached, payment dishonoured (reason context policy_suspend)
 *   suspended -> active   reinstated (policy_reinstate); lapsed -> active likewise
 *   active | suspended -> lapsed   (the lapse reasons of the renewals)
 *   active | suspended -> expired  by the policy-expiry job, one audit entry per policy
 * Cancellation and renewal keep their own flows (cancellation endorsement, renewal booking). Every move carries a
 * reason code, a remark, the user and the time (policies.status_reason / status_changed_at) and an audit entry.
 */
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { requiredReason } from '../ops-masters/records.js';
import { today } from '../../lib/dates.js';
import { getPolicyRow } from './service.js';

/** The moves a user may ask for: target status -> { from, context, stamp column }. */
export const TRANSITIONS = {
  suspended: { from: ['active', 'issued'], context: 'policy_suspend', stamp: 'suspended_at', verb: 'suspend' },
  reinstated: { from: ['suspended', 'lapsed'], context: 'policy_reinstate', stamp: 'reinstated_at', verb: 'reinstate', to: 'active' },
  lapsed: { from: ['active', 'issued', 'suspended'], context: 'lapse', stamp: 'lapsed_at', verb: 'lapse' },
};
export const LIFECYCLE_STATUSES = ['active', 'suspended', 'lapsed', 'expired', 'cancelled', 'renewed'];

/** The moves available from a status (for the screen). */
export const availableMoves = (status) => Object.entries(TRANSITIONS).filter(([, t]) => t.from.includes(String(status || '').toLowerCase())).map(([k]) => k);

/**
 * Move a policy: { status: suspended | reinstated | lapsed, reasonCode, note }. Returns { before, after, reason }.
 */
export async function movePolicy(id, body, user) {
  const move = TRANSITIONS[String(body.status || '').toLowerCase()];
  if (!move) throw badRequest('Validation failed', [{ path: 'status', message: `status must be one of ${Object.keys(TRANSITIONS).join(', ')}` }]);
  return withTransaction(async (db) => {
    const before = await getPolicyRow(id, db);
    const current = String(before.status || '').toLowerCase();
    if (!move.from.includes(current)) throw conflict(`Policy ${before.policy_number} is ${current} and cannot be ${move.verb === 'lapse' ? 'lapsed' : `${move.verb}d`}`);
    const reason = await requiredReason(db, move.context, { reasonCode: body.reasonCode, note: body.note });
    const target = move.to || (move.verb === 'lapse' ? 'lapsed' : 'suspended');
    await db.query(`UPDATE policies SET status = $2, status_reason = $3, status_changed_at = now(), status_changed_by = $4, ${move.stamp} = now(), updated_at = now() WHERE id = $1`,
      [before.id, target, `${reason.code}: ${reason.text}`, user?.id ?? null]);
    const after = await getPolicyRow(before.id, db);
    return { before, after, reason, move: move.verb };
  });
}

/**
 * The policy-expiry job: every policy in force whose expiry date is before today's business date becomes expired,
 * one audit entry per policy with the remark of the job. Returns the count.
 */
export async function expirePolicies() {
  const day = await today();
  const rows = (await query(`UPDATE policies SET status = 'expired', status_reason = $2, status_changed_at = now(), status_changed_by = 'policy-expiry', updated_at = now()
    WHERE status IN ('active', 'issued', 'suspended') AND expiry_date < $1::date RETURNING id, policy_number, status, expiry_date`, [day, `Expired on ${day} (policy-expiry job)`])).rows;
  for (const p of rows) {
    await query('INSERT INTO audit_log(username, entity, entity_id, action, before_data, after_data) VALUES ($1,$2,$3,$4,$5,$6)',
      ['policy-expiry', 'policy', p.id, 'expire', JSON.stringify({ status: 'active' }), JSON.stringify({ status: 'expired', policyNumber: p.policy_number, expiryDate: p.expiry_date, remark: `Expired on ${day} (policy-expiry job)` })]);
  }
  return { expired: rows.length };
}
