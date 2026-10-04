/**
 * Scheduled jobs of the compliance registers (registered by migrations 0270, 0272 and 0273; Master > Schedules):
 *   compliance-reminders (daily)      licences approaching expiry, fit and proper reviews due, insurers whose IC
 *                                     certificate of authority is expiring or has expired
 *   complaints-deadlines (daily)      complaint acknowledgement and resolution deadlines, automatic escalation
 *   privacy-breach-deadlines (hourly) the 72-hour NPC notification deadline of personal data breaches
 */
import { one } from '../../db/pool.js';
import { today } from '../../lib/dates.js';
import { notify } from '../notifications/service.js';
import { licenceReminders } from './licences.js';
import { fitProperReminders } from './fitProper.js';
import { authorityReport } from './insurerAuthority.js';
import { complaintDeadlineRun } from './complaints.js';
import { breachDeadlineRun } from '../data-breaches/service.js';

const migrated = async (table) => (await one('SELECT to_regclass($1) IS NOT NULL AS ok', [table])).ok;

/** Insurers with a certificate expiring or expired: one reminder per insurer, state and validity date. */
async function authorityReminders() {
  const { items } = await authorityReport({ state: 'expiring,expired' });
  let reminded = 0;
  for (const i of items) {
    const recent = await one(`SELECT 1 FROM notifications WHERE entity = 'insurance_company' AND entity_id = $1 AND type = 'reminder' AND title LIKE $2 AND created_at > now() - interval '7 days'`,
      [String(i.id), `%${i.state === 'expired' ? 'expired' : 'expires'}%`]);
    if (recent) continue;
    await notify({ type: 'reminder', priority: i.state === 'expired' ? 'high' : 'normal', audience: 'read:compliance', link: '/compliance/insurer-authority',
      title: i.state === 'expired' ? `IC certificate of authority expired: ${i.name}` : `IC certificate of authority expires in ${i.daysLeft} day(s): ${i.name}`,
      message: `Certificate ${i.certificateNumber} valid until ${i.validUntil}. Update the insurer master when the renewed certificate is received.`,
      entity: 'insurance_company', entityId: String(i.id) });
    reminded += 1;
  }
  return reminded;
}

export async function complianceReminders() {
  if (!(await migrated('compliance_licences'))) return { skipped: 'compliance registers not migrated' };
  const now = await today();
  const licences = await licenceReminders(now);
  const fitProper = await fitProperReminders(now);
  return { licences: licences.reminded, fitProper: fitProper.reminded, insurers: await authorityReminders() };
}

export async function complaintsDeadlines() {
  if (!(await migrated('complaints'))) return { skipped: 'complaints register not migrated' };
  return complaintDeadlineRun(await today());
}

export async function privacyBreachDeadlines() {
  if (!(await migrated('personal_data_breaches'))) return { skipped: 'breach register not migrated' };
  return breachDeadlineRun();
}
