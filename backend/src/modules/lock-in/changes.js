/**
 * Change lock-in with approval (TIS-BRD-SCHM-03 FR-LCK-002): add a lock-in to a policy that has none (an account
 * already under ARA at go-live), correct its source, reference, start, years or TFS loan account, or end it early with
 * a reason. The change is a request: it applies only when a user holding approve:lock-in, other than the requester,
 * approves it; the old values stay in the request and the audit trail; the notice treatment of the open renewal is
 * recomputed. One request per policy at a time.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { addDays, isoDate } from '../../lib/dates.js';
import { requiredReason } from '../ops-masters/records.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { LOCK_IN_SOURCES, gateContext, treatmentOf, LOCK_IN_COLUMNS } from '../renewals/noticeGate.js';

const fail = (path, message, code = null) => badRequest(message, [{ path, message, ...(code ? { code } : {}) }]);
const dmy = (d) => String(d).slice(0, 10).split('-').reverse().join('/');
const addYears = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCFullYear(x.getUTCFullYear() + n); return x.toISOString().slice(0, 10); };

/** Request a change (FR-LCK-002): { action add | correct | end, source, reference, startDate, years, tfsLoanAccount, reasonCode (end), remark }. */
export async function requestChange(policyRef, b, user) {
  const p = await one('SELECT p.id, p.policy_number, p.inception_date, p.expiry_date FROM policies p WHERE p.id = $1 OR p.policy_number = $1', [String(policyRef)]);
  if (!p) throw notFound('Policy not found');
  const lk = await one('SELECT * FROM policy_lock_ins WHERE policy_id = $1', [p.id]);
  const action = b.action;
  if (!['add', 'correct', 'end'].includes(action)) throw fail('action', 'Choose Add, Correct or End lock-in');
  if (!String(b.remark || '').trim()) throw fail('remark', 'Enter the reason for the change', 'MSG-LCK-006');
  if (await one("SELECT 1 FROM lock_in_changes WHERE policy_id = $1 AND status = 'pending'", [p.id])) throw conflict(`A lock-in change for ${p.policy_number} is already waiting for approval`);
  const locked = lk && lk.source !== 'loan' && lk.status === 'active';
  if (action === 'add' && locked) throw conflict(`${p.policy_number} already has a lock-in: correct or end it instead`);
  if (['correct', 'end'].includes(action) && !locked) throw conflict(`${p.policy_number} has no active lock-in`);
  let proposed = {};
  if (action === 'end') {
    const why = await requiredReason({ query }, 'lockin_end', { reasonCode: b.reasonCode, note: b.remark });
    proposed = { endReasonCode: why.code, endReason: why.text };
  } else {
    const source = b.source ?? lk?.source;
    if (!LOCK_IN_SOURCES[source]) throw fail('source', `Lock-in source is one of ${Object.values(LOCK_IN_SOURCES).join(', ')}`);
    const years = Number(b.years ?? lk?.years);
    if (!Number.isInteger(years) || years < 1 || years > 10) throw fail('years', 'Lock-in years must be between 1 and 10', 'MSG-LCK-004');
    const start = isoDate(b.startDate ?? lk?.start_date);
    if (!start) throw fail('startDate', 'Enter the lock-in start date');
    if (start > isoDate(p.inception_date)) throw fail('startDate', `The lock-in cannot start after the current term starts (${dmy(p.inception_date)})`, 'MSG-LCK-003');
    const end = addDays(addYears(start, years), -1);
    if (end < isoDate(p.inception_date)) throw fail('years', 'With these values the lock-in ends before the current term; use End lock-in instead', 'MSG-LCK-005');
    const loan = b.tfsLoanAccount === undefined ? lk?.tfs_loan_account ?? null : String(b.tfsLoanAccount || '').trim() || null;
    if (loan && !/^\d{10}$/.test(loan)) throw fail('tfsLoanAccount', 'The TFS loan account must have 10 digits', 'MSG-LCK-001');
    proposed = { source, reference: b.reference ?? lk?.reference ?? null, startDate: start, years, endDate: end, tfsLoanAccount: loan };
  }
  const before = lk ? { source: lk.source, reference: lk.reference, startDate: isoDate(lk.start_date), years: lk.years, endDate: isoDate(lk.end_date), tfsLoanAccount: lk.tfs_loan_account, status: lk.status } : null;
  const r = await one(`INSERT INTO lock_in_changes(policy_id, action, before_values, proposed, remark, requested_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [p.id, action, before ? JSON.stringify(before) : null, JSON.stringify(proposed), String(b.remark).trim(), user.id]);
  await notifyApprovers({ audience: 'approve:lock-in', document: 'Lock-in change', number: p.policy_number, by: user.username, detail: `${action}: ${b.remark}`,
    link: `/agent/policydetail/${p.id}`, entity: 'lock-in', entityId: p.id });
  // the effect on the current term, shown before the approval
  const gate = await gateContext();
  const preview = action === 'end' ? { lockInStatus: 'ended', treatment: 'Send' } : (() => {
    const t = treatmentOf({ lock_source: proposed.source, lock_status: 'active', lock_end: proposed.endDate, loan_status: lk?.loan_status || 'current', expiry_date: isoDate(p.expiry_date), product_line: 'motor', lob: 'MOTOR' }, gate);
    return { endDate: proposed.endDate, treatment: t.label };
  })();
  return { id: r.id, policyId: p.id, before, proposed, preview, message: 'Lock-in change sent for approval' };
}

/** Approve or return a lock-in change (approve:lock-in, never the requester). */
export async function decideChange(id, { decision, note = null }, user) {
  if (!['approve', 'return'].includes(decision)) throw badRequest('decision must be approve or return');
  if (!hasPermission(user, 'approve:lock-in')) throw forbidden('You do not have permission to approve a lock-in change');
  const out = await withTransaction(async (db) => {
    const c = (await db.query('SELECT * FROM lock_in_changes WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!c) throw notFound('Lock-in change not found');
    if (c.status !== 'pending') throw conflict('The lock-in change is not waiting for approval');
    if (c.requested_by === user.id) throw forbidden('You requested this change; another user must approve it');
    if (decision === 'return') {
      if (!String(note || '').trim()) throw fail('note', 'Enter the reason for returning the change');
      await db.query("UPDATE lock_in_changes SET status = 'returned', decided_by = $2, decided_at = now(), decision_note = $3 WHERE id = $1", [id, user.id, String(note).trim()]);
      return { c };
    }
    const v = c.proposed || {};
    if (c.action === 'end') {
      await db.query("UPDATE policy_lock_ins SET status = 'ended', ended_at = now(), ended_reason = $2, updated_at = now() WHERE policy_id = $1", [c.policy_id, v.endReason]);
    } else {
      await db.query(`INSERT INTO policy_lock_ins(policy_id, source, reference, start_date, years, end_date, tfs_loan_account, status, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'active',(SELECT username FROM users WHERE id = $8))
        ON CONFLICT (policy_id) DO UPDATE SET source = EXCLUDED.source, reference = EXCLUDED.reference, start_date = EXCLUDED.start_date, years = EXCLUDED.years,
          end_date = EXCLUDED.end_date, tfs_loan_account = EXCLUDED.tfs_loan_account, status = 'active', ended_at = NULL, ended_reason = NULL, updated_at = now()`,
      [c.policy_id, v.source, v.reference, v.startDate, v.years, v.endDate, v.tfsLoanAccount, c.requested_by]);
    }
    await db.query("UPDATE lock_in_changes SET status = 'approved', decided_by = $2, decided_at = now(), decision_note = $3 WHERE id = $1", [id, user.id, String(note || '').trim() || null]);
    // the notice gate is re-run for the open renewal
    const r = (await db.query(`SELECT p.expiry_date, p.lob, p.product_type, pr.line AS product_line, pr.name AS product_name, ${LOCK_IN_COLUMNS}, rr.id AS renewal_id FROM policies p
      LEFT JOIN products pr ON pr.id = p.product_id JOIN policy_lock_ins lk ON lk.policy_id = p.id
      LEFT JOIN LATERAL (SELECT x.id FROM renewals x WHERE x.policy_id = p.id AND x.status NOT IN ('renewed', 'lapsed', 'not-renewed') ORDER BY x.created_at DESC LIMIT 1) rr ON true
      WHERE p.id = $1`, [c.policy_id])).rows[0];
    if (r?.renewal_id) await db.query('UPDATE renewals SET notice_treatment = $2, notice_treatment_at = now() WHERE id = $1', [r.renewal_id, treatmentOf(r, await gateContext()).code]);
    return { c };
  });
  await notifyDecision({ userId: out.c.requested_by, decidedBy: user.id, document: 'Lock-in change', number: out.c.action, approved: decision === 'approve',
    status: decision === 'approve' ? 'approved' : 'returned', by: user.username, reason: note || null, link: `/agent/policydetail/${out.c.policy_id}`, entity: 'lock-in', entityId: out.c.policy_id });
  return { before: out.c.before_values, after: out.c.proposed, policyId: out.c.policy_id, message: decision === 'approve' ? 'Lock-in change approved' : 'Lock-in change returned' };
}

export const pendingChanges = () => many(`SELECT c.*, p.policy_number FROM lock_in_changes c JOIN policies p ON p.id = c.policy_id WHERE c.status = 'pending' ORDER BY c.requested_at`);
