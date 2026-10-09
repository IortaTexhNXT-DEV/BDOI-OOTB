/** Job handlers. Each receives the job params and returns a JSON-serialisable summary. Module tables are optional:
 *  handlers check for them so the core runs before every module is migrated. */
import { many, one, query } from '../db/pool.js';
import { getSetting } from '../lib/settings.js';
import { sendQueuedEmails } from '../lib/mailer.js';
import { today } from '../lib/dates.js';

// "Today" in every job is the business date in general.timezone (lib/dates.js), passed to SQL as a parameter: the
// database's current_date is the server's (UTC) date, which is yesterday in Manila until 08:00.

const tableExists = async (t) => !!(await one('SELECT 1 FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = $1', [t]));

export async function renewalNotices() {
  if (!(await tableExists('policies'))) return { skipped: 'policies table missing' };
  if (!(await getSetting('notification.renewal_reminder', true))) return { skipped: 'renewal reminders are switched off (notification.renewal_reminder)' };
  const days = (await getSetting('limits.renewal_notice_days', [60, 30, 15])) || [60, 30, 15];
  const now = await today();
  let created = 0;
  for (const d of days) {
    const rows = await many(`SELECT p.id, p.policy_number, p.expiry_date, p.owner_user_id FROM policies p
      WHERE p.status IN ('active','issued') AND p.expiry_date = $2::date + $1::int
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity = 'policy' AND n.entity_id = p.id AND n.type = 'reminder' AND n.title LIKE 'Renewal due in ' || $1::text || '%')`, [d, now]);
    for (const p of rows) {
      await query('INSERT INTO notifications(user_id, type, title, message, link, entity, entity_id) VALUES ($1,\'reminder\',$2,$3,$4,\'policy\',$5)',
        [p.owner_user_id || null, `Renewal due in ${d} days`, `Policy ${p.policy_number} expires on ${p.expiry_date}`, `/policy/view/${p.id}`, p.id]);
      created += 1;
    }
  }
  return { notifications: created };
}
export async function policyExpiry() {
  if (!(await tableExists('policies'))) return { skipped: 'policies table missing' };
  const r = await query('UPDATE policies SET status = \'expired\' WHERE status IN (\'active\',\'issued\') AND expiry_date < $1::date', [await today()]);
  return { expired: r.rowCount };
}
export async function quoteExpiry() {
  if (!(await tableExists('quotes'))) return { skipped: 'quotes table missing' };
  const days = Number(await getSetting('limits.quote_validity_days', 30));
  const r = await query('UPDATE quotes SET status = \'expired\' WHERE status IN (\'draft\',\'quoted\',\'sent\') AND created_at < now() - ($1 || \' days\')::interval', [String(days)]);
  return { expired: r.rowCount };
}
export async function receivableAgeing() {
  if (!(await tableExists('receivables'))) return { skipped: 'receivables table missing' };
  const buckets = (await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120])) || [30, 60, 90, 120];
  const rows = await many('SELECT id, GREATEST($1::date - due_date, 0) AS age FROM receivables WHERE status IN (\'open\', \'partial\')', [await today()]);
  let updated = 0;
  for (const r of rows) {
    const age = Number(r.age);
    const b = buckets.find((x) => age <= x);
    const label = age === 0 ? 'current' : b ? `1-${b}` : `>${buckets[buckets.length - 1]}`;
    await query('UPDATE receivables SET age_days = $2, ageing_bucket = $3 WHERE id = $1', [r.id, age, label]);
    updated += 1;
  }
  return { updated };
}
/** Reports the daily-reports job generates when its params name none (params.reports on Master > Schedules). */
const DAILY_REPORTS = ['production-register', 'collections-summary', 'claims-position'];
export async function dailyReports(params = {}) {
  if (!(await tableExists('generated_reports'))) return { skipped: 'generated_reports table missing' };
  const { generateReport } = await import('../modules/reports/service.js');
  const codes = Array.isArray(params.reports) && params.reports.length ? params.reports : DAILY_REPORTS;
  const out = [];
  for (const code of codes) out.push(await generateReport(code, {}, 'schedule'));
  return { reports: out.map((r) => r.id) };
}
export async function emailOutbox() {
  return sendQueuedEmails();
}

/** Scheduled report jobs created from Reports > Schedules (code report-<id>). */
export const scheduledReport = async (p) => (await import('../modules/reports/service.js')).scheduledReport(p);

/** Renewal batch notices queue and the daily renewal pipeline (enrol expiring policies, lapse overdue renewals). */
export { processRenewalQueue, renewalPipeline } from '../modules/renewals/jobs.js';

/** Due-date reminders to clients with bills falling due (e-mail + notification, no repeats within the configured window). */
export async function collectionReminders() {
  const { pool } = await import('../db/pool.js');
  return (await import('../modules/collections/service.js')).sendDueDateReminders(pool, null);
}

// Period-end processing (month-end reminder, recurring journals, accrual auto-reversal, period auto soft-close)
export { monthEndReminder, recurringJournals, accrualReversal, periodAutoSoftClose } from '../modules/period-end/jobs.js';

// Bank reconciliation: daily automatic matching (disabled by default)
export { bankAutoMatch } from '../modules/bank-reconciliation/jobs.js';

// My Work: follow-up tasks from collection promises, renewal next steps and claim follow-up dates; task reminders and
// overdue alerts (every 15 minutes)
export const myWorkReminders = async () => {
  const { pool } = await import('../db/pool.js');
  if (!(await pool.query("SELECT to_regclass('work_tasks') IS NOT NULL AS ok")).rows[0].ok) return { skipped: 'my work not migrated' };
  return (await import('../modules/my-work/tasks.js')).runReminders();
};

// Housekeeping: purge operational rows past the retention periods in System Settings, Housekeeping tab (daily)
export { housekeeping } from './housekeeping.js';

/** Deactivate accounts nobody has signed in to for access.dormant_days (Master > User Management). */
export const dormantUsers = async () => {
  const { pool } = await import('../db/pool.js');
  if (!(await pool.query("SELECT to_regclass('authority_limits') IS NOT NULL AS ok")).rows[0].ok) return { skipped: 'access control not migrated' };
  return (await import('../modules/access-control/service.js')).deactivateDormant(pool);
};

/**
 * Remittance schedules (Accounts > Remittance > Scheduling): run the active schedules whose next run date has come
 * (draft remittances per insurer up to the cut-off date) and move their next run date on. Daily, disabled by default.
 */
export async function remittanceSchedules() {
  if (!(await tableExists('remittances'))) return { skipped: 'remittances table missing' };
  return (await import('../modules/remittance/items.js')).runDueSchedules();
}

/**
 * Integrations (Master > System Configuration > Integrations): send the integration messages that are due and retry
 * failed attempts with backoff (every 2 minutes); SMS renewal notices and payment reminders (daily, disabled by default).
 */
export async function integrationOutbox() {
  if (!(await tableExists('integration_outbox'))) return { skipped: 'integration tables missing' };
  return (await import('../modules/integrations/index.js')).processOutbox();
}
export async function smsRenewalNotices() {
  if (!(await tableExists('message_templates'))) return { skipped: 'message templates missing' };
  return (await import('../modules/integrations/index.js')).smsRenewalNotices();
}
export async function smsPaymentReminders() {
  if (!(await tableExists('message_templates'))) return { skipped: 'message templates missing' };
  return (await import('../modules/integrations/index.js')).smsPaymentReminders();
}
/** EIS outbox (Accounts > Tax > E-Invoicing): send queued e-invoices to the BIR EIS and retry failures. Disabled by default. */
export async function eisOutbox() {
  if (!(await tableExists('eis_submissions'))) return { skipped: 'eis_submissions table missing' };
  return (await import('../modules/bir/eis.js')).processOutbox();
}
// operations and accounting: cover note expiry, post-dated cheques due for deposit, missing claim documents
export { coverNoteExpiry } from '../modules/cover-notes/jobs.js';
export { pdcDepositDue } from '../modules/pdc/jobs.js';
export { claimDocumentReminders } from '../modules/claim-documents/jobs.js';
// Distribution and reporting: prospects not worked in time go to the reassignment queue (lead assignment), scheduled
// marketing campaigns are sent, the BI extract is written to the storage folder (all disabled until switched on)
export { leadAssignmentSla } from '../modules/leads/assignment.js';
export { campaignDispatch } from '../modules/campaigns/service.js';
export { biExtract } from '../modules/report-builder/service.js';

/** SAP GL text files of the day (TIS-BRD-INTG-04): header and line file of the entries posted up to the cut-off (sap_gl.cut_off). */
export async function sapGlExport() {
  if (!(await tableExists('sap_gl_exports'))) return { skipped: 'sap_gl_exports table missing' };
  return (await import('../modules/sap-gl/service.js')).scheduledExport();
}
