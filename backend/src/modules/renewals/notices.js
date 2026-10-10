/**
 * Renewal notices at the marks before expiry (TIS-BRD-RENEW-02, FGA IR-01 to IR-06), the staff reminders, and the
 * lock-in accounts of the notice gate (FRS SCHM-03: lock-in review 60 days before expiry, loan status, report).
 *
 *   runNoticeSchedule      job renewal-notice-run: each open renewal whose mark (renewals.notice_schedule, per line of
 *                          business) has come gets its notice by e-mail; a mark missed (a day the job did not run, a
 *                          weekend or a holiday with renewals.notice_working_days) is caught up with the latest notice
 *                          due. Suppressed and held renewals get none; their owner gets the lock-in review task.
 *   staffRenewalReminders  job renewal-notices: "Renewal due in n days" to the policy owner (limits.renewal_notice_days),
 *                          none for a suppressed account, titled "notices held" for a held one.
 *   lockInAccounts         Operations > Renewals > Lock-in Accounts and its Excel extract (lock-in and Scheme 2
 *                          accounts expiring within the review window, with the loan status)
 *   setLoanStatus          the TFS loan status of an account set by hand; a blocking status skips its queued notices
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { addDays, today } from '../../lib/dates.js';
import { workingCalendar } from '../../lib/workingCalendar.js';
import { notify } from '../notifications/service.js';
import { lobOf } from '../documents/common.js';
import { daysBetween, shownDate } from '../claims/util.js';
import { LOAN_STATUS_LABELS, LOCK_IN_COLUMNS, LOCK_IN_SOURCES, TREATMENT_LABELS, gateContext, lockInTerm, treatmentOf } from './noticeGate.js';
import { BASE, OPEN, activity, sendNotice } from './service.js';

const DEFAULT_SCHEDULE = [{ stage: 1, daysBefore: 90 }, { stage: 2, daysBefore: 60 }, { stage: 3, daysBefore: 30 }];

/** The notice marks of a line of business (renewals.notice_schedule[line], else its default), latest mark first. */
export async function noticeSchedule(line) {
  const all = (await getSetting('renewals.notice_schedule', {})) || {};
  const list = Array.isArray(all[line]) ? all[line] : Array.isArray(all.default) ? all.default : DEFAULT_SCHEDULE;
  return list.map((m) => ({ stage: Number(m.stage), daysBefore: Number(m.daysBefore) })).filter((m) => m.stage > 0 && m.daysBefore >= 0)
    .sort((a, b) => a.daysBefore - b.daysBefore);
}

/** The notice due on a renewal today: the stage of the latest mark reached and not yet sent, or null. */
export function dueStage(schedule, noticeStage, daysToExpiry) {
  const reached = schedule.filter((m) => daysToExpiry <= m.daysBefore && m.stage > noticeStage);
  return reached.length ? reached.reduce((a, b) => (b.stage > a.stage ? b : a)) : null;
}

const SYSTEM = { id: null, username: null };

/** Record a change of the notice treatment of a renewal on its timeline (once per change). */
async function recordTreatment(r, t) {
  if ((r.notice_treatment || 'send') === t.code) return false;
  await query('UPDATE renewals SET notice_treatment = $2, notice_treatment_at = now() WHERE id = $1', [r.id, t.code]);
  await activity(null, r.id, SYSTEM, { type: t.code === 'send' ? 'Notices resumed' : 'Notices withheld', description: t.code === 'send' ? 'Renewal notices go out again' : `${t.label}: ${t.reason}`,
    details: { treatment: t.code } });
  return true;
}

/** Lock-in review task of a suppressed account on its review date (FR-LCK-014): one per renewal, for its owner. */
async function lockInReviewTask(r, lock) {
  const owner = r.owner_user_id || r.policy_owner;
  if (!owner || !lock?.reviewDate) return 0;
  const ins = await query(`INSERT INTO work_tasks(title, notes, due_date, priority, assigned_to, source, source_key, entity, entity_id, created_by)
    SELECT $1, $2, $3, 'high', u.id, 'renewal', $4, 'renewal', $5, 'system' FROM users u WHERE u.id = $6 AND u.status = 'active'
    ON CONFLICT (source_key) DO NOTHING`,
  [`Lock-in review: ${r.policy_number} (${r.client_name || 'client'})`, `${lock.sourceLabel}${lock.year ? `, year ${lock.year}` : ''}; expires ${await shownDate(r.policy_expiry)}`,
    lock.reviewDate, `lock-in:${r.id}`, r.id, owner]);
  return ins.rowCount;
}

/**
 * Job renewal-notice-run. Returns { sent, caughtUp, withheld, failed, reviewTasks } or { skipped } when the job is off
 * or today is not a working day.
 */
export async function runNoticeSchedule() {
  if ((await getSetting('renewals.auto_notices', true)) === false) return { skipped: 'automatic renewal notices are switched off (renewals.auto_notices)' };
  const now = await today();
  const cal = await workingCalendar(now, now);
  if ((await getSetting('renewals.notice_working_days', true)) !== false && !cal.isWorking(now)) return { skipped: `${now} is not a working day` };
  const gate = await gateContext();
  const rows = await many(`${BASE} WHERE r.status = ANY($1) AND p.expiry_date >= $2::date ORDER BY p.expiry_date`, [OPEN, now]);
  const out = { sent: 0, caughtUp: 0, withheld: 0, failed: 0, reviewTasks: 0 };
  const schedules = new Map();
  for (const r of rows) {
    const t = treatmentOf(r, gate);
    await recordTreatment(r, t);
    const days = daysBetween(now, r.policy_expiry);
    if (t.code !== 'send') {
      const lock = lockInTerm(r, gate);
      if (t.code !== 'held' && lock?.reviewDate && lock.reviewDate <= now) out.reviewTasks += await lockInReviewTask(r, lock);
      const line = lobOf(r.product_line, r.lob, r.product_type, r.product_name);
      if (!schedules.has(line)) schedules.set(line, await noticeSchedule(line));
      if (dueStage(schedules.get(line), r.notice_stage, days)) out.withheld += 1;
      continue;
    }
    const line = lobOf(r.product_line, r.lob, r.product_type, r.product_name);
    if (!schedules.has(line)) schedules.set(line, await noticeSchedule(line));
    const due = dueStage(schedules.get(line), r.notice_stage, days);
    if (!due) continue;
    try {
      await sendNotice(r.id, SYSTEM, { stage: due.stage, method: 'Email', catchUp: true });
      out.sent += 1;
      if (due.stage > r.notice_stage + 1) out.caughtUp += 1;
    } catch (e) {
      out.failed += 1;
      // told once per stage: the owner sends it another way (Letter, Phone) or completes the client's e-mail
      const told = await one(`SELECT 1 FROM renewal_activities WHERE renewal_id = $1 AND activity_type = 'Notice not sent' AND details->>'stage' = $2`, [r.id, String(due.stage)]);
      if (!told) {
        await activity(null, r.id, SYSTEM, { type: 'Notice not sent', description: e.message, details: { stage: due.stage } });
        const owner = r.owner_user_id || r.policy_owner;
        if (owner) {
          await notify({ userId: owner, type: 'alert', title: `Renewal notice not sent: ${r.policy_number}`, message: e.message, link: `/renewal/queue?renewal=${r.id}`,
            entity: 'renewal', entityId: r.id });
        }
      }
    }
  }
  return out;
}

/**
 * Job renewal-notices: "Renewal due in n days" reminders to the policy owner at limits.renewal_notice_days, once per
 * mark. A suppressed lock-in or Scheme 2 account gets none (its owner works the lock-in review); a held one is titled
 * "notices held" with the loan status.
 */
export async function staffRenewalReminders() {
  if (!(await getSetting('notification.renewal_reminder', true))) return { skipped: 'renewal reminders are switched off (notification.renewal_reminder)' };
  const days = (await getSetting('limits.renewal_notice_days', [60, 30, 15])) || [60, 30, 15];
  const now = await today();
  const gate = await gateContext();
  let created = 0;
  let suppressed = 0;
  for (const d of days) {
    const rows = await many(`SELECT p.id, p.policy_number, p.expiry_date, p.owner_user_id, p.lob, p.product_type, pr.line AS product_line, pr.name AS product_name, ${LOCK_IN_COLUMNS}
      FROM policies p LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN policy_lock_ins lk ON lk.policy_id = p.id
      WHERE p.status IN ('active','issued') AND p.expiry_date = $2::date + $1::int
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity = 'policy' AND n.entity_id = p.id AND n.type = 'reminder' AND n.title LIKE 'Renewal due in ' || $1::text || '%')`, [d, now]);
    for (const p of rows) {
      const t = treatmentOf(p, gate);
      if (t.code === 'lock-in' || t.code === 'scheme2') { suppressed += 1; continue; }
      const title = t.code === 'held' ? `Renewal due in ${d} days - notices held (${LOAN_STATUS_LABELS[p.loan_status] || p.loan_status})` : `Renewal due in ${d} days`;
      await query('INSERT INTO notifications(user_id, type, title, message, link, entity, entity_id) VALUES ($1,\'reminder\',$2,$3,$4,\'policy\',$5)',
        [p.owner_user_id || null, title, `Policy ${p.policy_number} expires on ${await shownDate(p.expiry_date)}`, `/agent/policydetail/${p.id}`, p.id]);
      created += 1;
    }
  }
  return { notifications: created, suppressed };
}

// ---------------------------------------------------------------- lock-in accounts
const accountApi = (r, gate, now) => {
  const t = treatmentOf(r, gate);
  const lock = lockInTerm(r, gate);
  return {
    policyId: r.policy_id, policyNumber: r.policy_number, clientName: r.client_name, insurer: r.insurer_name, product: r.product_name,
    inceptionDate: r.inception_date, expiryDate: r.expiry_date, daysToExpiry: daysBetween(now, r.expiry_date),
    lockIn: lock, source: r.lock_source, sourceLabel: LOCK_IN_SOURCES[r.lock_source] || r.lock_source, year: lock?.year ?? null, reviewDate: lock?.reviewDate ?? null,
    reviewDue: !!lock?.reviewDate && lock.reviewDate <= now, tfsLoanAccount: r.tfs_loan_account, loanStatus: r.loan_status, loanStatusLabel: LOAN_STATUS_LABELS[r.loan_status] || r.loan_status,
    noticeTreatment: t, renewalId: r.renewal_id || null, renewalNumber: r.renewal_number || null, renewalStatus: r.renewal_status || null, owner: r.owner_name || null,
  };
};

/**
 * Lock-in and Scheme 2 accounts expiring from the as-of date to `days` days later (default lockin.review_days_before),
 * filtered by source, loan status, treatment and a search on policy number, insured or loan account.
 */
export async function lockInAccounts(q = {}) {
  const gate = await gateContext();
  const now = await today();
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(q.asOf || '')) ? q.asOf : now;
  const days = Number.isFinite(Number(q.days)) && q.days !== '' && q.days !== undefined ? Number(q.days) : gate.reviewDays;
  const params = [asOf, addDays(asOf, days)];
  const where = ["p.status IN ('active', 'issued')", 'p.renewed_to IS NULL', 'p.expiry_date BETWEEN $1::date AND $2::date'];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.source && q.source !== 'All') add('lk.source = ?', q.source);
  if (q.loanStatus && q.loanStatus !== 'All') add('lk.loan_status = ?', q.loanStatus);
  if (q.search) add('(p.policy_number ILIKE ? OR cl.display_name ILIKE ? OR lk.tfs_loan_account ILIKE ?)', `%${q.search}%`);
  const rows = await many(`SELECT p.id AS policy_id, p.policy_number, p.inception_date, p.expiry_date, p.lob, p.product_type, cl.display_name AS client_name, ic.name AS insurer_name,
      pr.name AS product_name, pr.line AS product_line, ${LOCK_IN_COLUMNS}, r.id AS renewal_id, r.renewal_number, r.status AS renewal_status,
      (SELECT u.display_name FROM users u WHERE u.id = COALESCE(r.owner_user_id, p.owner_user_id)) AS owner_name
    FROM policies p JOIN policy_lock_ins lk ON lk.policy_id = p.id LEFT JOIN clients cl ON cl.id = p.client_id
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN LATERAL (SELECT x.* FROM renewals x WHERE x.policy_id = p.id ORDER BY x.created_at DESC LIMIT 1) r ON true
    WHERE ${where.join(' AND ')} ORDER BY p.expiry_date, p.policy_number`, params);
  let items = rows.map((r) => accountApi(r, gate, now));
  if (q.treatment && q.treatment !== 'All') items = items.filter((x) => x.noticeTreatment.code === q.treatment);
  return { asOf, days, to: addDays(asOf, days), items, sources: LOCK_IN_SOURCES, loanStatuses: LOAN_STATUS_LABELS, treatments: TREATMENT_LABELS };
}

export const LOCK_IN_COLUMNS_REPORT = [
  ['policyNumber', 'Policy No.'], ['clientName', 'Insured'], ['insurer', 'Insurer'], ['product', 'Product'], ['sourceLabel', 'Lock-in'], ['year', 'Lock-in year'],
  ['lockInEnd', 'Lock-in end'], ['expiryDate', 'Expiry'], ['daysToExpiry', 'Days to expiry'], ['reviewDate', 'Review date'], ['tfsLoanAccount', 'TFS loan account'],
  ['loanStatusLabel', 'Loan status'], ['treatment', 'Renewal notices'], ['renewalNumber', 'Renewal'], ['owner', 'Owner'],
].map(([key, header]) => ({ key, header, ...(['expiryDate', 'reviewDate', 'lockInEnd'].includes(key) ? { type: 'date' } : {}) }));
export const lockInReportRows = (items) => items.map((x) => ({ ...x, lockInEnd: x.lockIn?.endDate || null, treatment: x.noticeTreatment.label }));

/**
 * Set the TFS loan status of an account by hand (fraud, legal dispute, corrections). A blocking status skips the queued
 * batch notices of the policy at once (FR-LCK-022); the change is on the renewal timeline.
 */
export async function setLoanStatus(policyId, { loanStatus, note }, user) {
  if (!LOAN_STATUS_LABELS[loanStatus]) throw badRequest('Validation failed', [{ path: 'loanStatus', message: `Choose one of ${Object.values(LOAN_STATUS_LABELS).join(', ')}` }]);
  const lock = await one('SELECT * FROM policy_lock_ins WHERE policy_id = $1', [policyId]);
  if (!lock) throw notFound('The policy has no lock-in or TFS loan account');
  const gate = await gateContext();
  const blocking = gate.blocking.includes(loanStatus);
  if (blocking && !String(note || '').trim()) throw badRequest('Validation failed', [{ path: 'note', message: 'Say why the loan status holds the renewal notices' }]);
  const skipped = await withTransaction(async (db) => {
    await db.query('UPDATE policy_lock_ins SET loan_status = $2, loan_status_at = now(), loan_status_by = $3, loan_status_note = $4, updated_at = now() WHERE id = $1',
      [lock.id, loanStatus, user?.username ?? null, String(note || '').trim() || null]);
    const open = (await db.query('SELECT id FROM renewals WHERE policy_id = $1 AND status = ANY($2) ORDER BY created_at DESC LIMIT 1', [policyId, OPEN])).rows[0];
    if (open) await activity(db, open.id, user, { type: 'Loan status', description: `TFS loan status ${LOAN_STATUS_LABELS[loanStatus]}${note ? `: ${note}` : ''}`, details: { loanStatus } });
    if (!blocking) return 0;
    const r = await db.query(`UPDATE renewal_batch_policies SET notice_status = 'Skipped', error = $2 WHERE policy_id = $1 AND notice_status = 'Queued'`,
      [policyId, `${TREATMENT_LABELS.held}: the TFS loan is ${LOAN_STATUS_LABELS[loanStatus].toLowerCase()}`]);
    return r.rowCount;
  });
  return { before: { loanStatus: lock.loan_status }, after: { loanStatus, note: note || null }, skippedNotices: skipped };
}
