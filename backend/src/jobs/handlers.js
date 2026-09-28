/** Job handlers. Each receives the job params and returns a JSON-serialisable summary. Module tables are optional:
 *  handlers check for them so the core runs before every module is migrated. */
import { many, one, query } from '../db/pool.js';
import { getSetting } from '../lib/settings.js';
import { sendQueuedEmails } from '../lib/mailer.js';

const tableExists = async (t) => !!(await one('SELECT 1 FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = $1', [t]));

export async function renewalNotices() {
  if (!(await tableExists('policies'))) return { skipped: 'policies table missing' };
  const days = (await getSetting('limits.renewal_notice_days', [60, 30, 15])) || [60, 30, 15];
  let created = 0;
  for (const d of days) {
    const rows = await many(`SELECT p.id, p.policy_number, p.expiry_date, p.owner_user_id FROM policies p
      WHERE p.status IN ('active','issued') AND p.expiry_date = current_date + $1::int
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity = 'policy' AND n.entity_id = p.id AND n.type = 'reminder' AND n.title LIKE 'Renewal due in ' || $1::text || '%')`, [d]);
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
  const r = await query('UPDATE policies SET status = \'expired\' WHERE status IN (\'active\',\'issued\') AND expiry_date < current_date');
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
  const rows = await many('SELECT id, due_date FROM receivables WHERE status IN (\'open\', \'partial\')');
  let updated = 0;
  for (const r of rows) {
    const age = Math.max(0, Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000));
    const b = buckets.find((x) => age <= x);
    const label = age === 0 ? 'current' : b ? `1-${b}` : `>${buckets[buckets.length - 1]}`;
    await query('UPDATE receivables SET age_days = $2, ageing_bucket = $3 WHERE id = $1', [r.id, age, label]);
    updated += 1;
  }
  return { updated };
}
export async function dailyReports() {
  if (!(await tableExists('generated_reports'))) return { skipped: 'generated_reports table missing' };
  const { generateReport } = await import('../modules/reports/service.js');
  const out = [];
  for (const code of ['production-register', 'collections-summary', 'claims-position']) out.push(await generateReport(code, {}, 'schedule'));
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
