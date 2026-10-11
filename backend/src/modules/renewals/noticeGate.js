/**
 * Notice gate of the renewal notices (FRS SCHM-03 FR-LCK-010 to 013, FGA IR-04 to IR-07). Each renewal gets a notice
 * treatment from the lock-in of its policy (policy_lock_ins) and the TFS loan status:
 *   held      the loan status is one of lockin.blocking_loan_statuses: no notice, no reminder; queued notices skipped
 *   lock-in   an active lock-in ending on or after the start of the next term: suppressed (handled on the lock-in review)
 *   scheme2   a Scheme 2 account on a Motor policy whose loan is not closed (lockin.suppress_scheme2_motor): suppressed
 *   send      every other renewal
 * Every path that sends a notice or e-mails a reminder (the job, a renewal batch, the Renewal Queue) asks the gate just
 * before sending. The lock-in year and the review date of a locked term follow FR-LCK-003.
 */
import { many, one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { conflict } from '../../lib/errors.js';
import { addDays } from '../../lib/dates.js';
import { lobOf } from '../documents/common.js';
import { shownDate } from '../claims/util.js';

export const TREATMENT_LABELS = { send: 'Send', 'lock-in': 'Suppressed: lock-in', scheme2: 'Suppressed: Scheme 2', held: 'Held: loan status' };
export const LOAN_STATUS_LABELS = { current: 'Current', 'past-due': 'Past due', fraud: 'Fraud', terminated: 'Terminated', 'legal-dispute': 'Legal dispute', closed: 'Closed' };
export const LOCK_IN_SOURCES = { promotion: 'Promotion', 'scheme1-ara': 'Scheme 1 ARA', scheme2: 'Scheme 2' };

/** Columns of the lock-in of a policy, for a query joining policy_lock_ins as lk. */
export const LOCK_IN_COLUMNS = `lk.source AS lock_source, lk.reference AS lock_reference, lk.start_date AS lock_start, lk.years AS lock_years, lk.end_date AS lock_end,
  lk.status AS lock_status, lk.tfs_loan_account, lk.loan_status, lk.loan_status_at, lk.loan_status_note`;

export async function gateContext() {
  const blocking = (await getSetting('lockin.blocking_loan_statuses', ['past-due', 'fraud', 'terminated', 'legal-dispute'])) || [];
  return {
    blocking: Array.isArray(blocking) ? blocking : [],
    suppressScheme2: (await getSetting('lockin.suppress_scheme2_motor', true)) !== false,
    reviewDays: Number(await getSetting('lockin.review_days_before', 60)),
  };
}

/**
 * Lock-in year and review date of a policy term (FR-LCK-003): the year counts the terms from the first locked term
 * (1 = the first year); the review date is lockin.review_days_before days before the term expires.
 */
export function lockInTerm(row, ctx) {
  if (!row.lock_source) return null;
  const inception = row.inception_date || row.policy_inception;
  const expiry = row.policy_expiry || row.expiry_date;
  const start = row.lock_start;
  const year = inception && start ? Math.max(1, Number(String(inception).slice(0, 4)) - Number(String(start).slice(0, 4))
    + (String(inception).slice(5) >= String(start).slice(5) ? 1 : 0)) : null;
  return {
    source: row.lock_source, sourceLabel: LOCK_IN_SOURCES[row.lock_source] || row.lock_source, reference: row.lock_reference || null,
    startDate: start, years: row.lock_years ?? null, endDate: row.lock_end || null, status: row.lock_status, year,
    reviewDate: expiry ? addDays(expiry, -ctx.reviewDays) : null,
    tfsLoanAccount: row.tfs_loan_account || null, loanStatus: row.loan_status || null, loanStatusLabel: LOAN_STATUS_LABELS[row.loan_status] || row.loan_status || null,
    loanStatusAt: row.loan_status_at || null, loanStatusNote: row.loan_status_note || null,
  };
}

/**
 * Notice treatment of a renewal or policy row carrying the LOCK_IN_COLUMNS, the policy expiry (policy_expiry or
 * expiry_date) and its line (product_line / lob). Returns { code, label, reason }.
 */
export function treatmentOf(row, ctx) {
  const send = { code: 'send', label: TREATMENT_LABELS.send, reason: null };
  if (!row.lock_source) return send;
  const loan = row.loan_status || 'current';
  if (ctx.blocking.includes(loan)) {
    const status = String(LOAN_STATUS_LABELS[loan] || loan).toLowerCase();
    return { code: 'held', label: TREATMENT_LABELS.held, reason: row.tfs_loan_account ? `TFS loan ${row.tfs_loan_account} is ${status}` : `The TFS loan is ${status}` };
  }
  if (row.lock_status !== 'active') return send;
  const nextStart = addDays(row.policy_expiry || row.expiry_date, 1);
  if (row.lock_source !== 'scheme2' && row.lock_end && row.lock_end >= nextStart) {
    return { code: 'lock-in', label: TREATMENT_LABELS['lock-in'], reason: 'The account is in a lock-in', until: row.lock_end };
  }
  if (row.lock_source === 'scheme2' && ctx.suppressScheme2 && loan !== 'closed' && lobOf(row.product_line, row.lob, row.product_type, row.product_name) === 'MOTOR') {
    return { code: 'scheme2', label: TREATMENT_LABELS.scheme2, reason: 'Scheme 2 Motor account with the loan still open' };
  }
  return send;
}

/** Treatment of a policy by id (for the messaging and staff reminder jobs). */
export async function treatmentOfPolicy(policyId, ctx = null) {
  const row = await one(`SELECT p.id, p.expiry_date, p.inception_date, p.lob, p.product_type, pr.line AS product_line, pr.name AS product_name, ${LOCK_IN_COLUMNS}
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN policy_lock_ins lk ON lk.policy_id = p.id WHERE p.id = $1`, [policyId]);
  return row ? treatmentOf(row, ctx || await gateContext()) : null;
}

/** Ids of the policies (of a list) whose notices are suppressed or held. */
export async function gatedPolicies(policyIds) {
  if (!policyIds.length) return new Map();
  const ctx = await gateContext();
  const rows = await many(`SELECT p.id, p.expiry_date, p.inception_date, p.lob, p.product_type, pr.line AS product_line, pr.name AS product_name, ${LOCK_IN_COLUMNS}
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id JOIN policy_lock_ins lk ON lk.policy_id = p.id WHERE p.id = ANY($1)`, [policyIds]);
  return new Map(rows.map((r) => [r.id, treatmentOf(r, ctx)]).filter(([, t]) => t.code !== 'send'));
}

/** 409 when the renewal's notices are suppressed or held (manual send, batch, e-mail reminder). */
export async function assertNoticeAllowed(row) {
  const t = treatmentOf(row, await gateContext());
  if (t.code === 'send') return t;
  const reason = t.until ? `${t.reason} until ${await shownDate(t.until)}` : t.reason;
  throw conflict(`Renewal notices of policy ${row.policy_number} are ${t.code === 'held' ? 'held' : 'suppressed'}: ${reason}`);
}
