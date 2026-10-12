/**
 * The 60-day Lock-in Review (TIS-BRD-SCHM-03 FR-LCK-014, 030 to 032, 040, 041; TIS-BRD-RPT-SLS-05).
 *
 *   lockInReview     job lock-in-review (daily 05:15): ends the lock-ins whose last term has expired and those of
 *                    cancelled policies, raises a review item (Review due, or Lock-in ends for the last lock-in year)
 *                    and a My Work task for every lock-in and Scheme 2 account whose review date has come, brings back
 *                    the holds due for review, and files the day's Lock-in / Scheme 2 expiry report
 *   listAccounts     Lock-in Review tabs: Due for review (expiring within the window), Notices held, Pending
 *                    approval, In lock-in; filters as of date, days to expiry, source, insurer, loan status, review
 *                    status and a search on policy number, insured or loan account; the rows of the Excel extract
 *   decide           Renew under lock-in (refused while the loan is blocking), Hold (re-review within
 *                    lockin.hold_max_days and before expiry), Release to standard renewal and Not for renewal (for
 *                    approval with lockin.release_maker_checker); reason code and a remark of 10 characters
 *   approve / ret    approve:lock-in, never the user who recorded the decision: a Release ends the lock-in from the
 *                    current expiry (notices go out), Not for renewal lapses the open renewal and marks the lock-in Not
 *                    renewed; Return sends it back with a remark
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { workingCalendar } from '../../lib/workingCalendar.js';
import { requiredReason } from '../ops-masters/records.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { LOAN_STATUS_LABELS, LOCK_IN_COLUMNS, LOCK_IN_SOURCES, TREATMENT_LABELS, gateContext, treatmentOf } from '../renewals/noticeGate.js';
import { reviewDateOf, termOf } from './service.js';

export const REVIEW_LABELS = { 'review-due': 'Review due', 'lockin-ends': 'Lock-in ends', 'on-hold': 'On hold', 'pending-approval': 'Pending approval', returned: 'Returned',
  renew: 'Renew under lock-in', released: 'Released', 'not-renewed': 'Not for renewal' };
export const DECISION_LABELS = { renew: 'Renew under lock-in', hold: 'Hold', release: 'Release to standard renewal', 'not-renewed': 'Not for renewal' };
const CONTEXTS = { renew: 'lockin_renew', hold: 'lockin_hold', release: 'lockin_release', 'not-renewed': 'lockin_not_renewed' };
const fail = (path, message, code = null) => badRequest(message, [{ path, message, ...(code ? { code } : {}) }]);
const dmy = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const OPEN_RENEWAL = ['pipeline', 'notice-1', 'notice-2', 'final-notice', 'quoted', 'pending-approval', 'approved', 'grace'];

const ACCOUNT_SELECT = `SELECT p.id AS policy_id, p.policy_number, p.inception_date, p.expiry_date, p.lob, p.product_type, p.sum_insured, p.premium_total, p.owner_user_id, p.doc AS policy_doc,
    p.details AS policy_details, pr.name AS product_name, pr.line AS product_line, ic.id AS insurer_id, ic.name AS insurer_name, cl.display_name AS client_name, cl.email AS client_email,
    cl.phone AS client_phone, ou.display_name AS owner_name, ${LOCK_IN_COLUMNS}, lk.loan_status_date, lk.loan_status_manual, lk.days_past_due,
    rr.id AS renewal_id, rr.renewal_number, rr.status AS renewal_status, rr.notice_stage,
    rv.id AS review_id, rv.status AS review_status, rv.decision, rv.reason AS review_reason, rv.remark AS review_remark, rv.re_review_date, rv.decided_at, du.display_name AS decided_by_name,
    rv.decided_by, rv.review_date AS item_review_date, rv.return_note,
    (SELECT count(*)::int FROM renewal_notices n WHERE n.renewal_id = rr.id AND n.status = 'sent') AS notices_sent,
    (SELECT count(*)::int FROM renewal_activities a WHERE a.renewal_id = rr.id AND a.activity_type = 'Notices withheld') AS notices_skipped,
    (SELECT count(*)::int FROM email_outbox e WHERE e.entity = 'renewal' AND e.entity_id = rr.id AND e.status = 'cancelled') AS notices_cancelled
  FROM policies p JOIN policy_lock_ins lk ON lk.policy_id = p.id LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN clients cl ON cl.id = p.client_id LEFT JOIN users ou ON ou.id = p.owner_user_id
  LEFT JOIN LATERAL (SELECT r.* FROM renewals r WHERE r.policy_id = p.id ORDER BY r.created_at DESC LIMIT 1) rr ON true
  LEFT JOIN lock_in_reviews rv ON rv.policy_id = p.id AND rv.term_expiry = p.expiry_date
  LEFT JOIN users du ON du.id = rv.decided_by`;

const vehicleOf = (doc) => {
  const v = (Array.isArray(doc?.insuranceVehicleDetails) ? doc.insuranceVehicleDetails[0] : doc?.insuranceVehicleDetails) || {};
  return { unit: [v.modelYear, v.vehicleBrand, v.vehicleModel, v.modelVariant].filter(Boolean).join(' ') || null, plateNumber: v.plateNumber || doc?.plateNumber || null,
    chassisNumber: v.chassisNumber || doc?.chassisNumber || null, engineNumber: v.motorNumber || v.engineNumber || doc?.motorNumber || null, color: v.vehicleColor || null };
};

async function accountOf(r, gate, cal, now) {
  const term = await termOf(r, { cal, now });
  const t = treatmentOf(r, gate);
  const days = Math.round((Date.parse(`${isoDate(r.expiry_date)}T00:00:00Z`) - Date.parse(`${now}T00:00:00Z`)) / 86400000);
  return {
    policyId: r.policy_id, policyNumber: r.policy_number, insured: r.client_name, insurerId: r.insurer_id, insurer: r.insurer_name, product: r.product_name,
    inceptionDate: isoDate(r.inception_date), expiryDate: isoDate(r.expiry_date), daysToExpiry: days, owner: r.owner_name, ownerId: r.owner_user_id,
    source: r.lock_source, sourceLabel: term.sourceLabel, reference: r.lock_reference, lockInStatus: r.lock_status, year: term.year, years: r.lock_years,
    yearLabel: term.year ? `${term.year} of ${r.lock_years ?? '-'}` : null, lockInEnd: term.endDate, reviewDate: r.item_review_date ? isoDate(r.item_review_date) : term.reviewDate,
    nextTermInside: term.nextTermInside, loanAccount: r.tfs_loan_account, loanStatus: r.loan_status, loanStatusLabel: term.loanStatusLabel, loanStatusDate: term.loanStatusDate,
    loanStatusManual: term.loanStatusManual, daysPastDue: r.days_past_due, staleWarning: term.staleWarning, treatment: t,
    renewalId: r.renewal_id, renewalNumber: r.renewal_number, renewalStatus: r.renewal_status,
    reviewId: r.review_id, reviewStatus: r.review_status, reviewStatusLabel: REVIEW_LABELS[r.review_status] || null, decision: r.decision, decisionLabel: DECISION_LABELS[r.decision] || null,
    reviewReason: r.review_reason, reviewRemark: r.review_remark, reReviewDate: isoDate(r.re_review_date), decidedBy: r.decided_by_name, decidedById: r.decided_by, decidedAt: r.decided_at,
    returnNote: r.return_note, notices: { sent: r.notices_sent || 0, skipped: r.notices_skipped || 0, cancelled: r.notices_cancelled || 0 },
    email: r.client_email, mobile: r.client_phone, sumInsured: Number(r.sum_insured), premium: Number(r.premium_total), ...vehicleOf(r.policy_doc),
  };
}

/**
 * Accounts of a Lock-in Review tab (FR-LCK-031): tab due (lock-in and Scheme 2 accounts expiring within daysFrom to daysTo
 * days of asOf, default 0 to lockin.review_days_before), held (notices held), pending (decisions waiting for approval),
 * in-lock-in (every active lock-in and Scheme 2 account). Filters: source, insurerId, loanStatus, reviewStatus, search.
 */
export async function listAccounts(q = {}) {
  const now = await today();
  const asOf = isoDate(q.asOf) || now;
  const reviewDays = Number(await getSetting('lockin.review_days_before', 60));
  const maxDays = Number(await getSetting('lockin.report_max_days', 365));
  const from = q.daysFrom === undefined || q.daysFrom === '' ? 0 : Number(q.daysFrom);
  const to = q.daysTo === undefined || q.daysTo === '' ? reviewDays : Number(q.daysTo);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from) throw fail('daysTo', 'Days to expiry is a range of 0 or more days');
  if (to > maxDays) throw fail('daysTo', `Days to expiry can be at most ${maxDays}`, 'MSG-LCK-030');
  const tab = q.tab || 'due';
  const where = ["p.status IN ('active', 'issued')", 'p.renewed_to IS NULL'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (tab === 'due') {
    where.push("lk.source <> 'loan'", "(lk.status = 'active' OR lk.source = 'scheme2')");
    params.push(asOf, Math.trunc(from), Math.trunc(to));
    where.push(`p.expiry_date BETWEEN $${params.length - 2}::date + $${params.length - 1}::int AND $${params.length - 2}::date + $${params.length}::int`);
  }
  if (tab === 'in-lock-in') where.push("lk.source <> 'loan'", "lk.status = 'active'");
  if (tab === 'pending') where.push("rv.status = 'pending-approval'");
  if (q.source && q.source !== 'all') add('lk.source = ?', q.source);
  if (q.insurerId) add('p.insurance_company_id = ?::int', Number(q.insurerId));
  if (q.loanStatus && q.loanStatus !== 'all') add('lk.loan_status = ?', q.loanStatus);
  if (q.reviewStatus && q.reviewStatus !== 'all') add('rv.status = ?', q.reviewStatus);
  if (q.search) add('(p.policy_number ILIKE ? OR cl.display_name ILIKE ? OR lk.tfs_loan_account ILIKE ?)', `%${String(q.search).trim()}%`);
  const rows = await many(`${ACCOUNT_SELECT} WHERE ${where.join(' AND ')}`, params);
  const gate = await gateContext();
  const cal = await workingCalendar(addDays(asOf, -30), addDays(asOf, maxDays + 30));
  let items = [];
  for (const r of rows) items.push(await accountOf(r, gate, cal, asOf));
  if (tab === 'held') items = items.filter((x) => x.treatment.code === 'held');
  items.sort((a, b) => String(a.reviewDate || '9999').localeCompare(String(b.reviewDate || '9999')) || a.expiryDate.localeCompare(b.expiryDate) || a.policyNumber.localeCompare(b.policyNumber));
  return { asOf, daysFrom: from, daysTo: to, tab, items };
}

/** Counts of the tabs (each tab with its count). */
export async function tabCounts(q = {}) {
  const out = {};
  for (const tab of ['due', 'held', 'pending', 'in-lock-in']) out[tab] = (await listAccounts({ asOf: q.asOf, daysFrom: q.daysFrom, daysTo: q.daysTo, tab })).items.length;
  out.uploads = (await one('SELECT count(*)::int AS n FROM loan_status_batches')).n;
  return out;
}

/** Columns of the Lock-in / Scheme 2 expiry extract (FRS SCHM-03 10.7). */
export const REPORT_COLUMNS = [
  ['asOfDate', 'As of date', 'date'], ['owner', 'Account coordinator'], ['policyNumber', 'Policy number'], ['insurer', 'Insurer'], ['product', 'Product'], ['inceptionDate', 'Inception', 'date'],
  ['expiryDate', 'Expiry', 'date'], ['daysToExpiry', 'Days to expiry', 'integer'], ['insured', 'Assured name'], ['email', 'E-mail address'], ['mobile', 'Contact number'], ['unit', 'Unit model'],
  ['plateNumber', 'Plate number'], ['chassisNumber', 'Chassis number'], ['engineNumber', 'Engine number'], ['color', 'Color'], ['sumInsured', 'FMV (sum insured)', 'money'],
  ['premium', 'Current total premium', 'money'], ['loanAccount', 'TFS loan account'], ['loanStatusLabel', 'Loan status'], ['loanStatusDate', 'Loan status date', 'date'],
  ['daysPastDue', 'Days past due', 'integer'], ['sourceLabel', 'Lock-in source'], ['reference', 'Reference'], ['yearLabel', 'Lock-in year (n of N)'], ['lockInEnd', 'Lock-in end date', 'date'],
  ['reviewDate', 'Review date', 'date'], ['treatmentLabel', 'Notice treatment'], ['noticesText', 'Notices sent / skipped / cancelled this term'], ['reviewStatusLabel', 'Review status'],
  ['decisionLabel', 'Decision'], ['decidedBy', 'Decided by'], ['decidedOn', 'Decided on', 'date'], ['reviewRemark', 'Remark'],
].map(([key, header, type = 'text']) => ({ key, header, type }));

export const reportRows = (r) => r.items.map((x) => ({ ...x, asOfDate: r.asOf, treatmentLabel: x.treatment.label, decidedOn: x.decidedAt ? isoDate(x.decidedAt) : null,
  noticesText: `${x.notices.sent} sent / ${x.notices.skipped} skipped / ${x.notices.cancelled} cancelled` }));

/** A review item with its account. */
export async function getReview(id) {
  const rv = await one('SELECT * FROM lock_in_reviews WHERE id = $1', [id]);
  if (!rv) throw notFound('Lock-in review not found');
  const r = await one(`${ACCOUNT_SELECT} WHERE p.id = $1`, [rv.policy_id]);
  const gate = await gateContext();
  const account = r ? await accountOf(r, gate, null, await today()) : null;
  const loanHistory = r?.tfs_loan_account ? await many(`SELECT h.from_status, h.to_status, h.status_date, h.source, b.batch_number, h.remark, h.changed_by, h.changed_at FROM loan_status_history h
    LEFT JOIN loan_status_batches b ON b.id = h.batch_id WHERE h.loan_account = $1 ORDER BY h.changed_at DESC LIMIT 50`, [r.tfs_loan_account]) : [];
  const notices = r?.renewal_id ? await many(`SELECT activity_type, description, by_user, created_at FROM renewal_activities WHERE renewal_id = $1
    AND (activity_type ILIKE '%notice%' OR activity_type IN ('Notices withheld', 'Notices resumed')) ORDER BY created_at DESC LIMIT 50`, [r.renewal_id]) : [];
  const history = await many(`SELECT action, before_data, after_data, username, at FROM audit_log WHERE entity = 'lock-in-review' AND entity_id = $1 ORDER BY at DESC`, [id]);
  return { id: rv.id, status: rv.status, statusLabel: REVIEW_LABELS[rv.status], decision: rv.decision, decisionLabel: DECISION_LABELS[rv.decision] || null, reasonCode: rv.reason_code,
    reason: rv.reason, remark: rv.remark, reReviewDate: isoDate(rv.re_review_date), decidedById: rv.decided_by, decidedAt: rv.decided_at, returnNote: rv.return_note,
    termExpiry: isoDate(rv.term_expiry), reviewDate: isoDate(rv.review_date), account, loanHistory, notices,
    history: history.map((h) => ({ action: h.action, before: h.before_data, after: h.after_data, by: h.username, at: h.at })) };
}

/** Users who get the review task of a policy without an owner (lockin.review_roles). */
async function reviewers() {
  const roles = (await getSetting('lockin.review_roles', ['processing'])) || [];
  return (await many(`SELECT DISTINCT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.code = ANY($1) AND u.status = 'active'`,
    [roles])).map((u) => u.id);
}

async function reviewTask(item, policyNumber, expiry, ownerId, due, renewalId = null) {
  const users = ownerId ? [ownerId] : await reviewers();
  let n = 0;
  for (const u of users) {
    // the first review task of an owner shares the key of the renewal notices job's lock-in review task (one task, not two)
    const key = renewalId && ownerId ? `lock-in:${renewalId}` : `lock-in-review:${item}:${due}:${u}`;
    n += (await query(`INSERT INTO work_tasks(title, notes, due_date, priority, assigned_to, source, source_key, entity, entity_id, created_by)
      SELECT $1, $2, $3::date, 'high', $4, 'renewal', $5, 'lock-in-review', $6, 'system' WHERE EXISTS (SELECT 1 FROM users WHERE id = $4 AND status = 'active')
      ON CONFLICT (source_key) DO NOTHING`, [`Lock-in review due: ${policyNumber}, expires ${dmy(expiry)}`, 'Policy Servicing > Renewals > Lock-in Review', due,
      u, key, item])).rowCount;
  }
  return n;
}
const closeTasks = (db, reviewId, note, renewalId = null) => db.query(`UPDATE work_tasks SET status = 'done', completed_at = now(), completed_by = 'system', completion_note = $2,
  updated_at = now() WHERE ((entity = 'lock-in-review' AND entity_id = $1) OR ($3::text IS NOT NULL AND source_key = 'lock-in:' || $3)) AND status = 'open'`, [reviewId, note, renewalId]);

/** Job lock-in-review (FR-LCK-003, 014, 030, 032). params.date: the run date (tests). */
export async function lockInReview(params = {}) {
  const now = isoDate(params.date) || await today();
  const out = { ended: 0, cancelled: 0, reviewItems: 0, lockinEnds: 0, holdsDue: 0, tasks: 0, report: null };
  out.cancelled = (await query(`UPDATE policy_lock_ins lk SET status = 'cancelled', ended_at = now(), ended_reason = 'Policy cancelled', updated_at = now() FROM policies p
    WHERE p.id = lk.policy_id AND p.status = 'cancelled' AND lk.status = 'active'`)).rowCount;
  out.ended = (await query(`UPDATE policy_lock_ins lk SET status = 'ended', ended_at = now(), ended_reason = 'Last lock-in term expired', updated_at = now() FROM policies p
    WHERE p.id = lk.policy_id AND lk.status = 'active' AND lk.source <> 'loan' AND lk.end_date IS NOT NULL AND lk.end_date < $1::date AND p.expiry_date < $1::date AND p.renewed_to IS NULL`, [now])).rowCount;
  const days = Number(await getSetting('lockin.review_days_before', 60));
  const cal = await workingCalendar(addDays(now, -10), addDays(now, days + 10));
  const rows = await many(`${ACCOUNT_SELECT} WHERE p.status IN ('active', 'issued') AND p.renewed_to IS NULL AND lk.source <> 'loan' AND (lk.status = 'active' OR lk.source = 'scheme2')
    AND p.expiry_date >= $1::date AND p.expiry_date <= $1::date + ($2::int + 10) AND rv.id IS NULL`, [now, days]);
  const gate = await gateContext();
  for (const r of rows) {
    const review = await reviewDateOf(r.expiry_date, cal);
    if (review > now) continue;
    if (r.lock_source === 'scheme2' && (r.loan_status === 'closed' || !gate.suppressScheme2)) continue;
    const term = await termOf(r, { cal, now });
    const ends = r.lock_source !== 'scheme2' && !term.nextTermInside;
    const ins = await one(`INSERT INTO lock_in_reviews(policy_id, renewal_id, term_expiry, review_date, lock_in_year, lock_in_years, status, owner_user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (policy_id, term_expiry) DO NOTHING RETURNING id`,
    [r.policy_id, r.renewal_id || null, isoDate(r.expiry_date), review, term.year, r.lock_years, ends ? 'lockin-ends' : 'review-due', r.owner_user_id || null]);
    if (!ins) continue;
    if (ends) { out.lockinEnds += 1; continue; }
    out.reviewItems += 1;
    out.tasks += await reviewTask(ins.id, r.policy_number, r.expiry_date, r.owner_user_id, review, r.renewal_id || null);
  }
  const due = await many(`UPDATE lock_in_reviews v SET status = 'review-due', updated_at = now() FROM policies p WHERE p.id = v.policy_id AND v.status = 'on-hold'
    AND v.re_review_date <= $1::date RETURNING v.id, p.policy_number, v.term_expiry, v.owner_user_id`, [now]);
  for (const d of due) out.tasks += await reviewTask(d.id, d.policy_number, d.term_expiry, d.owner_user_id, now);
  out.holdsDue = due.length;
  if (params.report !== false) {
    try {
      const { generateReport } = await import('../reports/service.js');
      const g = await generateReport('lock-in-expiry', { ToDate: now, ReportCriteria: 'Lock-in / Scheme 2 expiry (60 days)', format: 'xlsx' }, 'schedule');
      out.report = { id: g.id, fileName: g.fileName || g.file_name || null, name: `Lock-in / Scheme 2 expiry ${dmy(now)}`, rows: g.rowCount ?? g.totalRows ?? null };
    } catch (e) {
      out.report = { error: e.message };
    }
  }
  return out;
}

/** Record the review decision (FR-LCK-040). */
export async function decide(id, { decision, reasonCode, remark, reReviewDate = null }, user) {
  if (!DECISION_LABELS[decision]) throw fail('decision', 'Choose the decision');
  if (!reasonCode) throw fail('reasonCode', 'Select the reason', 'MSG-LCK-033');
  if (String(remark || '').trim().length < 10) throw fail('remark', 'Enter a remark of at least 10 characters', 'MSG-LCK-034');
  const out = await withTransaction(async (db) => {
    const rv = (await db.query('SELECT * FROM lock_in_reviews WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!rv) throw notFound('Lock-in review not found');
    if (!['review-due', 'on-hold', 'returned'].includes(rv.status)) throw conflict(`The review is ${REVIEW_LABELS[rv.status]}: no decision can be recorded`);
    const lk = (await db.query('SELECT * FROM policy_lock_ins WHERE policy_id = $1', [rv.policy_id])).rows[0];
    const gate = await gateContext();
    if (decision === 'renew' && lk && gate.blocking.includes(lk.loan_status)) {
      throw fail('decision', `The TFS loan is ${LOAN_STATUS_LABELS[lk.loan_status]}; choose Hold, Release or Not for renewal`, 'MSG-LCK-031');
    }
    let reDate = null;
    if (decision === 'hold') {
      const max = Number(await getSetting('lockin.hold_max_days', 30));
      reDate = isoDate(reReviewDate);
      const now = await today();
      if (!reDate || reDate <= now || reDate > addDays(now, max) || reDate >= isoDate(rv.term_expiry)) {
        throw fail('reReviewDate', `The re-review date must be within ${max} days and before the expiry date ${dmy(rv.term_expiry)}`, 'MSG-LCK-032');
      }
    }
    const why = await requiredReason(db, CONTEXTS[decision], { reasonCode, note: remark });
    const approval = ['release', 'not-renewed'].includes(decision) && (await getSetting('lockin.release_maker_checker', true)) !== false;
    const status = decision === 'renew' ? 'renew' : decision === 'hold' ? 'on-hold' : approval ? 'pending-approval' : decision === 'release' ? 'released' : 'not-renewed';
    await db.query(`UPDATE lock_in_reviews SET status = $2, decision = $3, reason_code = $4, reason = $5, remark = $6, re_review_date = $7, decided_by = $8, decided_at = now(),
      approved_by = NULL, approved_at = NULL, return_note = NULL, updated_at = now() WHERE id = $1`, [id, status, decision, why.code, why.name, String(remark).trim(), reDate, user.id]);
    await closeTasks(db, id, `Decision: ${DECISION_LABELS[decision]}`, rv.renewal_id || null);
    if (!approval && ['release', 'not-renewed'].includes(decision)) await applyDecision(db, { ...rv, decision, reason: why.name }, user);
    return { rv, status, approval, why };
  });
  if (decision === 'hold') {
    const p = await one('SELECT policy_number, owner_user_id FROM policies WHERE id = $1', [out.rv.policy_id]);
    await reviewTask(id, p.policy_number, out.rv.term_expiry, p.owner_user_id, isoDate(reReviewDate));
  }
  if (out.approval) {
    const p = await one('SELECT policy_number FROM policies WHERE id = $1', [out.rv.policy_id]);
    await notifyApprovers({ audience: 'approve:lock-in', document: 'Lock-in review', number: p.policy_number, by: user.username, detail: `${DECISION_LABELS[decision]}: ${out.why.name}`,
      link: `/renewal/lock-in-review?review=${id}`, entity: 'lock-in-review', entityId: id });
  }
  return { before: { status: out.rv.status }, status: out.status, message: out.approval ? `Decision sent for approval: ${DECISION_LABELS[decision]}` : `Decision saved: ${DECISION_LABELS[decision]}` };
}

/** Apply an approved Release or Not for renewal (FR-LCK-041). */
async function applyDecision(db, rv, user) {
  const renewal = (await db.query('SELECT id, status FROM renewals WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1', [rv.policy_id])).rows[0];
  if (rv.decision === 'release') {
    await db.query("UPDATE policy_lock_ins SET status = 'released', ended_at = now(), ended_reason = $2, updated_at = now() WHERE policy_id = $1", [rv.policy_id, `Released to standard renewal: ${rv.reason || ''}`]);
    if (renewal && OPEN_RENEWAL.includes(renewal.status)) {
      await db.query("UPDATE renewals SET notice_treatment = 'send', notice_treatment_at = now() WHERE id = $1", [renewal.id]);
      await db.query(`INSERT INTO renewal_activities(renewal_id, by_user, activity_type, description, details) VALUES ($1,$2,'Notices resumed',$3,'{}')`,
        [renewal.id, user.username, 'Release to standard renewal approved: the next notice due goes out on the next Renewal notices run']);
    }
    return;
  }
  await db.query("UPDATE policy_lock_ins SET status = 'not-renewed', ended_at = now(), ended_reason = $2, updated_at = now() WHERE policy_id = $1", [rv.policy_id, `Not for renewal: ${rv.reason || ''}`]);
  if (renewal && OPEN_RENEWAL.includes(renewal.status)) {
    await db.query("UPDATE renewals SET status = 'lapsed', lapse_reason = $2, lapsed_at = now(), updated_at = now() WHERE id = $1", [renewal.id, `Not for renewal: ${rv.reason || ''}`]);
    await db.query(`INSERT INTO renewal_activities(renewal_id, by_user, activity_type, description, details) VALUES ($1,$2,'Lapsed',$3,'{}')`, [renewal.id, user.username, `Not for renewal: ${rv.reason || ''}`]);
  }
}

/** Approve or return a Release or Not for renewal (FR-LCK-041): approve:lock-in, never the user who recorded it. */
export async function approve(id, { decision, note = null }, user) {
  if (!['approve', 'return'].includes(decision)) throw badRequest('decision must be approve or return');
  if (!hasPermission(user, 'approve:lock-in')) throw forbidden('You do not have permission to approve a lock-in decision');
  const out = await withTransaction(async (db) => {
    const rv = (await db.query('SELECT * FROM lock_in_reviews WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!rv) throw notFound('Lock-in review not found');
    if (rv.status !== 'pending-approval') throw conflict(`The review is ${REVIEW_LABELS[rv.status]}: nothing to approve`);
    if (rv.decided_by === user.id) throw forbidden('You recorded this decision; another user must approve it');
    if (decision === 'return') {
      if (!String(note || '').trim()) throw fail('note', 'Enter the reason for returning the decision', 'MSG-LCK-038');
      await db.query("UPDATE lock_in_reviews SET status = 'returned', return_note = $2, updated_at = now() WHERE id = $1", [id, String(note).trim()]);
      return { rv };
    }
    await applyDecision(db, rv, user);
    await db.query('UPDATE lock_in_reviews SET status = $2, approved_by = $3, approved_at = now(), updated_at = now() WHERE id = $1', [id, rv.decision === 'release' ? 'released' : 'not-renewed', user.id]);
    return { rv };
  });
  const maker = await one('SELECT display_name FROM users WHERE id = $1', [out.rv.decided_by]);
  await notifyDecision({ userId: out.rv.decided_by, decidedBy: user.id, document: 'Lock-in review', number: DECISION_LABELS[out.rv.decision], approved: decision === 'approve',
    status: decision === 'approve' ? 'approved' : 'returned', by: user.username, reason: note || null, link: `/renewal/lock-in-review?review=${id}`, entity: 'lock-in-review', entityId: id });
  return { before: { status: 'pending-approval' }, message: decision === 'approve' ? `Decision approved: ${DECISION_LABELS[out.rv.decision]}` : `Decision returned to ${maker?.display_name || 'the maker'}` };
}

export { TREATMENT_LABELS, LOCK_IN_SOURCES };
