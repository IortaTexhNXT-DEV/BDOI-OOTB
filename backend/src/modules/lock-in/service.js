/**
 * Lock-in and TFS loan status of a policy (TIS-BRD-SCHM-03, FRS FR-LCK-003, 004, 021 to 023, 050).
 *
 *   reviewDateOf      expiry less lockin.review_days_before, moved to the working day before on a weekend or holiday
 *   termOf            the lock-in year "n of N", the review date, whether the next term is inside the lock-in
 *   policyPanel       the Lock-in & loan panel of Policy detail (hidden without a lock-in record or loan account)
 *   applyLoanStatus   one loan status for every active policy of a TFS loan account (upload or by hand): a newer date
 *                     wins, a status set by hand is not overwritten by the file; a blocking status holds the notices
 *                     (queued batch notices and queued notice e-mails cancelled, the renewal Held, a My Work item for
 *                     the owner); a return to Current lifts the hold (Notices resumed)
 *   setLoanStatus     Set loan status by hand (fraud, legal dispute, corrections): remark of 10 characters at least
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { workingCalendar } from '../../lib/workingCalendar.js';
import { LOAN_STATUS_LABELS, LOCK_IN_COLUMNS, LOCK_IN_SOURCES, TREATMENT_LABELS, gateContext, treatmentOf } from '../renewals/noticeGate.js';

export const LOCK_STATUS_LABELS = { active: 'Active', ended: 'Ended', released: 'Released', 'not-renewed': 'Not renewed', cancelled: 'Cancelled' };
const fail = (path, message, code = null) => badRequest(message, [{ path, message, ...(code ? { code } : {}) }]);
const dmy = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

/** Review date of a term (FR-LCK-003 R2): expiry - lockin.review_days_before, the working day before when not a working day. */
export async function reviewDateOf(expiry, cal = null) {
  if (!expiry) return null;
  const days = Number(await getSetting('lockin.review_days_before', 60));
  let d = addDays(isoDate(expiry), -days);
  const c = cal || await workingCalendar(addDays(d, -10), d);
  for (let i = 0; i < 30 && !c.isWorking(d); i += 1) d = addDays(d, -1);
  return d;
}

/** Lock-in year of a term (FR-LCK-003 R1): whole years between the lock-in start and the term inception, plus 1. */
export function lockInYear(start, inception) {
  if (!start || !inception) return null;
  const [sy, sm, sd] = String(start).slice(0, 10).split('-').map(Number);
  const [y, m, d] = String(inception).slice(0, 10).split('-').map(Number);
  return Math.max(1, y - sy - (m < sm || (m === sm && d < sd) ? 1 : 0) + 1);
}

/** The lock-in facts of a term: year n of N, review date, next term inside the lock-in, the stale loan status warning. */
export async function termOf(row, { cal = null, now = null } = {}) {
  const expiry = isoDate(row.expiry_date || row.policy_expiry);
  const inception = isoDate(row.inception_date || row.policy_inception);
  const locked = row.lock_source && row.lock_source !== 'loan';
  const nextStart = expiry ? addDays(expiry, 1) : null;
  const staleDays = Number(await getSetting('lockin.loan_status_stale_days', 45));
  const dated = row.loan_status_date || (row.loan_status_at ? isoDate(row.loan_status_at) : null);
  const on = now || await today();
  return {
    source: row.lock_source, sourceLabel: LOCK_IN_SOURCES[row.lock_source] || (row.lock_source === 'loan' ? 'TFS loan' : row.lock_source), reference: row.lock_reference || null,
    locked, startDate: isoDate(row.lock_start), years: row.lock_years ?? null, endDate: isoDate(row.lock_end), status: row.lock_status, statusLabel: LOCK_STATUS_LABELS[row.lock_status] || row.lock_status,
    year: locked ? lockInYear(row.lock_start, inception) : null, reviewDate: locked || row.lock_source === 'scheme2' ? await reviewDateOf(expiry, cal) : null,
    nextTermInside: locked && row.lock_source !== 'scheme2' && !!row.lock_end && isoDate(row.lock_end) >= nextStart,
    yearsMissing: locked && (row.lock_years === null || row.lock_years === undefined),
    tfsLoanAccount: row.tfs_loan_account || null, loanStatus: row.loan_status || null, loanStatusLabel: LOAN_STATUS_LABELS[row.loan_status] || row.loan_status || null,
    loanStatusDate: dated, loanStatusManual: row.loan_status_manual === true, loanStatusNote: row.loan_status_note || null, loanStatusBy: row.loan_status_by || null,
    daysPastDue: row.days_past_due ?? null, staleWarning: dated && addDays(dated, staleDays) < on && row.tfs_loan_account
      ? `The TFS loan status of ${row.tfs_loan_account} was last reported on ${dmy(dated)}` : null,
  };
}

const PANEL_SELECT = `SELECT p.id, p.policy_number, p.inception_date, p.expiry_date, p.lob, p.product_type, p.status AS policy_status, pr.line AS product_line, pr.name AS product_name,
  ${LOCK_IN_COLUMNS}, lk.id AS lock_id, lk.loan_status_date, lk.loan_status_manual, lk.loan_status_by, lk.days_past_due, lk.loan_maturity_date, lk.ended_reason
  FROM policies p LEFT JOIN products pr ON pr.id = p.product_id JOIN policy_lock_ins lk ON lk.policy_id = p.id`;

/** The Lock-in & loan panel of a policy (FR-LCK-004): null when the policy has neither a lock-in record nor a loan account. */
export async function policyPanel(policyRef) {
  const p = await one('SELECT id FROM policies WHERE id = $1 OR policy_number = $1', [String(policyRef)]);
  if (!p) throw notFound('Policy not found');
  const r = await one(`${PANEL_SELECT} WHERE p.id = $1`, [p.id]);
  if (!r) return null;
  const gate = await gateContext();
  const term = await termOf(r);
  const renewal = await one(`SELECT id, renewal_number, status, notice_treatment FROM renewals WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1`, [p.id]);
  const review = await one(`SELECT v.*, u.display_name AS decided_by_name FROM lock_in_reviews v LEFT JOIN users u ON u.id = v.decided_by WHERE v.policy_id = $1 ORDER BY v.term_expiry DESC LIMIT 1`, [p.id]);
  const pending = await one(`SELECT c.*, u.display_name AS requested_by_name FROM lock_in_changes c LEFT JOIN users u ON u.id = c.requested_by WHERE c.policy_id = $1 AND c.status = 'pending'`, [p.id]);
  const history = await many(`SELECT entity, action, before_data, after_data, username, at FROM audit_log WHERE entity = ANY($1) AND entity_id = $2 ORDER BY at DESC LIMIT 50`,
    [['lock-in', 'loan-status', 'lock-in-review'], p.id]).catch(() => []);
  const loanHistory = r.tfs_loan_account ? await many(`SELECT h.from_status, h.to_status, h.status_date, h.source, b.batch_number, h.remark, h.changed_by, h.changed_at
    FROM loan_status_history h LEFT JOIN loan_status_batches b ON b.id = h.batch_id WHERE h.loan_account = $1 ORDER BY h.changed_at DESC LIMIT 50`, [r.tfs_loan_account]) : [];
  return {
    policyId: p.id, policyNumber: r.policy_number, ...term, treatment: treatmentOf(r, gate),
    renewal: renewal ? { id: renewal.id, number: renewal.renewal_number, status: renewal.status } : null,
    lastReview: review ? { id: review.id, status: review.status, decision: review.decision, reason: review.reason, remark: review.remark, decidedBy: review.decided_by_name, decidedAt: review.decided_at } : null,
    pendingChange: pending ? { id: pending.id, action: pending.action, proposed: pending.proposed, remark: pending.remark, requestedBy: pending.requested_by_name, requestedById: pending.requested_by,
      requestedAt: pending.requested_at } : null,
    history: history.map((h) => ({ entity: h.entity, action: h.action, before: h.before_data, after: h.after_data, by: h.username, at: h.at })),
    loanHistory: loanHistory.map((h) => ({ from: h.from_status, to: h.to_status, statusDate: isoDate(h.status_date), source: h.source, batchNumber: h.batch_number, remark: h.remark, by: h.changed_by, at: h.changed_at })),
  };
}

/** The open renewal of a policy (for the notice treatment and the activity log). */
const openRenewal = (db, policyId) => db.query(`SELECT r.* FROM renewals r WHERE r.policy_id = $1 AND r.status IN ('pipeline', 'notice-1', 'notice-2', 'final-notice', 'quoted', 'pending-approval', 'approved', 'grace')
  ORDER BY r.created_at DESC LIMIT 1`, [policyId]).then((x) => x.rows[0] || null);

/** A My Work task of the owner of a policy (once per key). */
async function ownerTask(db, policyId, title, key, entityId = null) {
  await db.query(`INSERT INTO work_tasks(title, due_date, priority, assigned_to, source, source_key, entity, entity_id, created_by)
    SELECT $1, $2::date, 'high', u.id, 'renewal', $3, 'policy', $4, 'system' FROM policies p JOIN users u ON u.id = p.owner_user_id AND u.status = 'active'
    WHERE p.id = $4 ON CONFLICT (source_key) DO NOTHING`, [title, await today(), key, entityId || policyId]);
}

/**
 * Apply a loan status to the policies of a loan account (FR-LCK-020 to 023). opts: { loanAccount, policyId (only that
 * policy), status, statusDate, daysPastDue, maturity, source upload | manual, batchId, remark, user }. Returns
 * { updated: [{policyId, policyNumber, held, lifted, cancelled}], notChanged: [{policyId, reason}] }.
 */
export async function applyLoanStatus(db, opts) {
  const { loanAccount, policyId = null, status, statusDate, source, batchId = null, remark = null, user = null } = opts;
  const gate = await gateContext();
  const now = await today();
  const rows = (await db.query(`${PANEL_SELECT} WHERE lk.tfs_loan_account = $1 AND ($2::text IS NULL OR p.id = $2 OR p.policy_number = $2)
    AND (p.status IN ('active', 'issued') OR (p.status = 'expired' AND p.expiry_date >= $3::date - 30)) FOR UPDATE OF lk`, [loanAccount, policyId, now])).rows;
  const updated = [];
  const notChanged = [];
  for (const r of rows) {
    if (source === 'upload' && r.loan_status_manual) { notChanged.push({ policyId: r.id, policyNumber: r.policy_number, reason: 'Not changed (manual status)' }); continue; }
    const current = r.loan_status_date ? isoDate(r.loan_status_date) : null;
    if (source === 'upload' && current && statusDate < current) { notChanged.push({ policyId: r.id, policyNumber: r.policy_number, reason: `Not changed (status of ${dmy(current)} is newer)` }); continue; }
    if (source === 'upload' && current === statusDate && r.loan_status === status) { notChanged.push({ policyId: r.id, policyNumber: r.policy_number, reason: 'Not changed (same status)' }); continue; }
    const before = treatmentOf(r, gate);
    const manual = source === 'manual' && status !== 'current';
    await db.query(`UPDATE policy_lock_ins SET loan_status = $2, loan_status_date = $3, loan_status_at = now(), loan_status_by = $4, loan_status_note = $5, loan_status_manual = $6,
      loan_status_batch_id = $7, days_past_due = COALESCE($8, days_past_due), loan_maturity_date = COALESCE($9, loan_maturity_date), updated_at = now() WHERE id = $1`,
    [r.lock_id, status, statusDate, user?.username ?? 'tfs-upload', remark, manual, batchId, opts.daysPastDue ?? null, opts.maturity ?? null]);
    const after = treatmentOf({ ...r, loan_status: status }, gate);
    await db.query(`INSERT INTO loan_status_history(loan_account, policy_id, from_status, to_status, status_date, source, batch_id, treatment, remark, changed_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [loanAccount, r.id, r.loan_status, status, statusDate, source, batchId, after.code, remark, user?.username ?? null]);
    const renewal = await openRenewal(db, r.id);
    const statusLabel = LOAN_STATUS_LABELS[status] || status;
    let cancelled = 0;
    const held = before.code !== 'held' && after.code === 'held';
    const lifted = before.code === 'held' && after.code !== 'held';
    if (held) {
      const reason = `Loan ${statusLabel} since ${dmy(statusDate)}`;
      cancelled += (await db.query("UPDATE renewal_batch_policies SET notice_status = 'Skipped', error = $2 WHERE policy_id = $1 AND notice_status = 'Queued'", [r.id, reason])).rowCount;
      if (renewal) {
        cancelled += (await db.query(`UPDATE email_outbox SET status = 'cancelled', error = $2 WHERE entity = 'renewal' AND entity_id = $1 AND status = 'queued'
          AND (template LIKE 'renewal-notice%' OR template = 'renewal-reminder')`, [renewal.id, `${TREATMENT_LABELS.held}: ${reason}`])).rowCount;
      }
      await ownerTask(db, r.id, `Renewal notices held: ${r.policy_number}, TFS loan ${statusLabel}`, `loan-held:${r.id}:${statusDate}:${status}`);
    }
    if (lifted) await ownerTask(db, r.id, `Renewal notices resumed: ${r.policy_number}, TFS loan ${statusLabel}`, `loan-resumed:${r.id}:${statusDate}:${status}`);
    if (renewal) {
      await db.query('UPDATE renewals SET notice_treatment = $2, notice_treatment_at = now() WHERE id = $1', [renewal.id, after.code]);
      const text = held ? `Notice treatment: ${after.label} (${after.reason})${cancelled ? `; ${cancelled} queued renewal notices cancelled: TFS loan ${loanAccount} is ${statusLabel}` : ''}`
        : lifted ? `Renewal notices for ${r.policy_number} resumed: TFS loan ${loanAccount} is ${statusLabel}` : `TFS loan status ${statusLabel}${remark ? `: ${remark}` : ''}`;
      await db.query(`INSERT INTO renewal_activities(renewal_id, by_user, activity_type, description, details) VALUES ($1,$2,$3,$4,$5)`,
        [renewal.id, user?.username ?? null, held ? 'Notices withheld' : lifted ? 'Notices resumed' : 'Loan status', text, JSON.stringify({ loanStatus: status, treatment: after.code, cancelled })]);
    }
    updated.push({ policyId: r.id, policyNumber: r.policy_number, from: r.loan_status, to: status, held, lifted, cancelled, treatment: after });
  }
  return { updated, notChanged, found: rows.length };
}

/**
 * Set the loan status by hand (FR-LCK-021): every policy of the loan account; remark of 10 characters at least; status
 * date not in the future. A status other than Current is kept as manual (the TFS file does not overwrite it).
 */
export async function setLoanStatus(policyRef, { loanStatus, statusDate = null, remark }, user) {
  if (!LOAN_STATUS_LABELS[loanStatus]) throw fail('loanStatus', `Choose one of ${Object.values(LOAN_STATUS_LABELS).join(', ')}`);
  if (String(remark || '').trim().length < 10) throw fail('remark', 'Enter the reason for the loan status (at least 10 characters)', 'MSG-LCK-024');
  const on = isoDate(statusDate) || await today();
  if (on > await today()) throw fail('statusDate', 'The status date cannot be in the future', 'MSG-LCK-025');
  const p = await one('SELECT p.id, p.policy_number, lk.tfs_loan_account, lk.loan_status FROM policies p JOIN policy_lock_ins lk ON lk.policy_id = p.id WHERE p.id = $1 OR p.policy_number = $1', [String(policyRef)]);
  if (!p) throw notFound('The policy has no lock-in or TFS loan account');
  if (!p.tfs_loan_account) throw fail('loanStatus', 'The policy has no TFS loan account');
  const out = await withTransaction((db) => applyLoanStatus(db, { loanAccount: p.tfs_loan_account, status: loanStatus, statusDate: on, source: 'manual', remark: String(remark).trim(), user }));
  const t = out.updated.find((u) => u.policyId === p.id)?.treatment;
  const treatment = t ? (t.code === 'send' ? 'sent' : t.code === 'held' ? 'held' : 'suppressed') : 'unchanged';
  return { before: { loanStatus: p.loan_status }, out, loanAccount: p.tfs_loan_account,
    message: `Loan status of ${p.tfs_loan_account} set to ${LOAN_STATUS_LABELS[loanStatus]}; notices are ${treatment}` };
}

export { LOAN_STATUS_LABELS, LOCK_IN_SOURCES, TREATMENT_LABELS, query };
