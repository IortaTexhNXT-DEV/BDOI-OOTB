/**
 * Withdraw, cancel and revoke a remittance (TIS-BRD-COMM-01, COMM-04, CANC-03; FRS FR-RMT-014, FR-RMT-040; gap
 * register GAP-REMIT-23), each with a reason of the Reason Codes master and written to the remittance's activity log:
 *
 *   withdraw  a remittance awaiting approval goes back to Draft (reason remittance_withdraw): by the user who submitted
 *             or prepared it (write:remittance); its pending approval is closed as Withdrawn.
 *   cancel    a draft or returned remittance is cancelled (reason remittance_cancel; write:remittance): its policies are
 *             free for the next run or another remittance (RELEASED).
 *   revoke    the approval of a remittance not yet paid is taken back (reason remittance_revoke; approve:remittance,
 *             within remittance.revoke_enabled): refused once the remittance is on a settlement, its voucher raised or a
 *             line billed to the insurer, or once a commission line of its policies made payable by it was approved or
 *             paid. The remittance returns to the preparer (Returned); its lines, the client payment records and the
 *             policies no longer read remitted, and the variance shares made Eligible by the remittance go back to
 *             Accrued while commission.eligible_requires_remittance is on.
 */
import { withTransaction } from '../../db/pool.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { requiredReason } from '../ops-masters/records.js';
import { statusLabels } from './service.js';

const lockRemittance = async (c, id) => {
  const r = (await c.query("SELECT * FROM remittances WHERE (id = $1 OR remittance_number = $1) AND kind = 'direct-bill' FOR UPDATE", [String(id)])).rows[0];
  if (!r) throw notFound('Remittance not found');
  return r;
};
const wrongStatus = async (r, verb, allowed) => {
  const labels = await statusLabels();
  return conflict(`${r.remittance_number} is ${labels[r.status] || r.status}: only a ${allowed.map((s) => labels[s] || s).join(' or ')} remittance can be ${verb}.`);
};
/** Close the pending approval of a remittance with a status and the reason in its history. */
async function closePending(c, r, status, user, reason) {
  const a = (await c.query("SELECT id, history FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Pending' FOR UPDATE", [r.id])).rows[0];
  if (!a) return null;
  const history = [...(a.history || []), { action: status, by: user.id, at: new Date().toISOString(), remarks: reason.text, reasonCode: reason.code }];
  await c.query('UPDATE remittance_approvals SET status = $2, action_by = $3, action_at = now(), remarks = $4, history = $5 WHERE id = $1', [a.id, status, user.id, reason.text, JSON.stringify(history)]);
  return a.id;
}

/** Withdraw a remittance from approval (back to Draft); by its submitter or preparer. */
export async function withdrawRemittance(id, body, user) {
  return withTransaction(async (c) => {
    const r = await lockRemittance(c, id);
    if (r.status !== 'for-approval') throw await wrongStatus(r, 'withdrawn', ['for-approval']);
    // an approver returns it with a rejection instead
    if (![r.submitted_by, r.created_by].includes(user.id)) {
      throw forbidden(`${r.remittance_number} is withdrawn by the user who submitted or prepared it; an approver rejects it instead`);
    }
    const reason = await requiredReason(c, 'remittance_withdraw', body);
    const approvalId = await closePending(c, r, 'Withdrawn', user, reason);
    await c.query(`UPDATE remittances SET status = 'draft', submitted_by = NULL, submitted_at = NULL, updated_by = $2, updated_at = now(),
      data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('withdrawn', jsonb_build_object('by', $2::text, 'at', now(), 'reasonCode', $3::text, 'reason', $4::text)) WHERE id = $1`,
    [r.id, user.id, reason.code, reason.text]);
    return { id: r.id, before: { status: r.status }, after: { status: 'draft', approvalId, reasonCode: reason.code, remarks: reason.text }, message: `${r.remittance_number} withdrawn to Draft` };
  });
}

/** Cancel a draft or returned remittance: its policies are released for the next run. */
export async function cancelRemittance(id, body, user) {
  return withTransaction(async (c) => {
    const r = await lockRemittance(c, id);
    if (!['draft', 'rejected'].includes(r.status)) throw await wrongStatus(r, 'cancelled', ['draft', 'rejected']);
    const reason = await requiredReason(c, 'remittance_cancel', body);
    await c.query("UPDATE remittance_approvals SET status = 'Cancelled', action_by = $2, action_at = now(), remarks = $3 WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Pending'", [r.id, user.id, reason.text]);
    await c.query("UPDATE remittance_lines SET status = 'Cancelled' WHERE remittance_id = $1", [r.id]);
    await c.query(`UPDATE remittances SET status = 'cancelled', updated_by = $2, updated_at = now(),
      data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('cancelled', jsonb_build_object('by', $2::text, 'at', now(), 'reasonCode', $3::text, 'reason', $4::text)) WHERE id = $1`,
    [r.id, user.id, reason.code, reason.text]);
    const policies = Number((await c.query('SELECT count(DISTINCT policy_id) AS n FROM remittance_lines WHERE remittance_id = $1 AND policy_id IS NOT NULL', [r.id])).rows[0].n);
    return { id: r.id, before: { status: r.status }, after: { status: 'cancelled', reasonCode: reason.code, remarks: reason.text, policiesReleased: policies },
      message: `${r.remittance_number} cancelled; ${policies} polic${policies === 1 ? 'y is' : 'ies are'} free for the next run` };
  });
}

/** Why the approval of remittance `r` cannot be revoked (null when it can). */
async function revokeBlock(c, r) {
  const settlement = (await c.query(`SELECT reference_no, status FROM remittance_items WHERE kind = 'settlement' AND status NOT IN ('Rejected', 'Cancelled')
      AND data->'remittanceIds' ? $1 LIMIT 1`, [r.id])).rows[0];
  if (settlement) return `${r.remittance_number} is on settlement ${settlement.reference_no} (${settlement.status}); its payment to the insurer is under way.`;
  const billed = (await c.query(`SELECT d.dn_number FROM remittance_lines rl JOIN commission_debit_notes d ON d.id = rl.billing_note_id
      WHERE rl.remittance_id = $1 AND d.status NOT IN ('rejected', 'cancelled') LIMIT 1`, [r.id])).rows[0];
  if (billed) return `A line of ${r.remittance_number} is billed to the insurer on ${billed.dn_number}. Cancel the billing statement first.`;
  const paid = (await c.query(`SELECT cm.status, p.policy_number FROM commissions cm JOIN policies p ON p.id = cm.policy_id
      WHERE cm.policy_id IN (SELECT policy_id FROM remittance_lines WHERE remittance_id = $1) AND cm.status IN ('Approved', 'Paid') AND cm.referrer_id IS NOT NULL
        AND cm.eligible_at >= $2 LIMIT 1`, [r.id, r.approved_at || r.updated_at])).rows[0];
  if (paid) return `The commission of ${paid.policy_number} made payable by this remittance is already ${paid.status}.`;
  return null;
}

/** Revoke the approval of an approved remittance not yet paid: back to the preparer (Returned). */
export async function revokeRemittance(id, body, user) {
  if (!(await getSetting('remittance.revoke_enabled', true))) throw conflict('Revoking an approved remittance is switched off (remittance.revoke_enabled).');
  return withTransaction(async (c) => {
    const r = await lockRemittance(c, id);
    if (r.status !== 'approved') throw await wrongStatus(r, 'revoked', ['approved']);
    const block = await revokeBlock(c, r);
    if (block) throw conflict(block);
    const reason = await requiredReason(c, 'remittance_revoke', body);
    const policyIds = (await c.query('SELECT DISTINCT policy_id FROM remittance_lines WHERE remittance_id = $1 AND policy_id IS NOT NULL', [r.id])).rows.map((x) => x.policy_id);
    await c.query("UPDATE remittance_lines SET status = 'Active' WHERE remittance_id = $1 AND status = 'Remitted'", [r.id]);
    await c.query('UPDATE receivables SET remitted_at = NULL, remittance_id = NULL WHERE remittance_id = $1', [r.id]);
    if (policyIds.length) {
      await c.query("UPDATE policies SET details = details - 'remittance' WHERE id = ANY($1) AND details->'remittance'->>'id' = $2", [policyIds, r.id]);
    }
    let reverted = 0;
    if (policyIds.length && (await getSetting('commission.eligible_requires_remittance')) === true) {
      // the shares made Eligible by the approval (by the system, not by a user) wait again for a remittance
      reverted = (await c.query(`UPDATE commissions SET status = 'Accrued', eligible_at = NULL, updated_at = now() WHERE policy_id = ANY($1) AND status = 'Eligible'
          AND eligible_by IS NULL AND referrer_id IS NOT NULL AND eligible_at >= $2`, [policyIds, r.approved_at || r.updated_at])).rowCount;
    }
    await c.query(`UPDATE remittances SET status = 'rejected', rejected_by = $2, rejected_at = now(), remarks = $4, updated_by = $2, updated_at = now(),
      data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('revoked', jsonb_build_object('by', $2::text, 'at', now(), 'reasonCode', $3::text, 'reason', $4::text,
        'approvedBy', $5::text, 'approvedAt', $6::timestamptz)) WHERE id = $1`, [r.id, user.id, reason.code, reason.text, r.approved_by, r.approved_at]);
    const a = (await c.query("SELECT id, history FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Approved' ORDER BY action_at DESC NULLS LAST LIMIT 1 FOR UPDATE", [r.id])).rows[0];
    if (a) {
      const history = [...(a.history || []), { action: 'Revoked', by: user.id, at: new Date().toISOString(), remarks: reason.text, reasonCode: reason.code }];
      await c.query("UPDATE remittance_approvals SET status = 'Revoked', history = $2 WHERE id = $1", [a.id, JSON.stringify(history)]);
    }
    return { id: r.id, before: { status: 'approved', approvedBy: r.approved_by }, after: { status: 'rejected', reasonCode: reason.code, remarks: reason.text, sharesReverted: reverted },
      message: `Approval of ${r.remittance_number} revoked; it is returned to the preparer` };
  });
}

