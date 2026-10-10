/**
 * Non-payment cadence (TIS-BRD-CANC-02, RPT-OPS-11; scheduled job "nonpayment-cadence", daily):
 *   1. the customer is told at collections.nonpayment_notice_days (5, 10 and 15 days) after the due date of an unpaid
 *      premium bill, once per step; the last step flags the account for cancellation (collection_items
 *      .nonpayment_flagged_at) and tells the collectors to raise the cancellation (CAN-NP-FLAG);
 *   2. a policy cancelled for non-payment (cancellation reason collections.nonpayment_cancellation_reason) is told to
 *      Sales (the policy owner) and to its insurer once (endorsements.nonpayment_notified_at);
 *   3. on or before collections.insurer_notice_day (the 26th, moved to the last working day before it), each insurer
 *      receives the list of the month's non-payment cancellations (nonpayment_insurer_notices, once per month).
 * The Non-Payment Report (reports query nonPayment) lists the accounts without payment past
 * collections.nonpayment_report_days.
 */
import { many, one, query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { queueEmail } from '../../lib/mailer.js';
import { companyName } from '../../lib/letterhead.js';
import { today, addDays, businessTimeZone, isoInZone } from '../../lib/dates.js';
import { workingCalendar } from '../../lib/workingCalendar.js';
import { notify } from '../notifications/service.js';
import { emailTemplate, renderTemplate, amountText } from '../documents/common.js';

const noticeDays = async () => {
  const v = await getSetting('collections.nonpayment_notice_days', [5, 10, 15]);
  return [...new Set((Array.isArray(v) ? v : [5, 10, 15]).map(Number).filter((n) => n > 0))].sort((a, b) => a - b);
};

const CANDIDATES = `SELECT ci.id, ci.nonpayment_flagged_at, r.bill_number, r.balance, r.due_date, r.currency, $1::date - r.due_date AS dpd,
    p.id AS policy_id, p.policy_number, p.owner_user_id, p.insurance_company_id, c.id AS client_id, c.display_name AS client_name, c.email,
    (SELECT count(*)::int FROM collection_actions a WHERE a.collection_id = ci.id AND a.action_type = 'Non-payment notice') AS notices,
    (SELECT max(a.notes) FROM collection_actions a WHERE a.collection_id = ci.id AND a.action_type = 'Non-payment notice') AS last_note
  FROM collection_items ci JOIN receivables r ON r.id = ci.receivable_id JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = r.client_id
  WHERE r.status IN ('open', 'partial') AND r.balance > 0 AND r.due_date < $1::date AND ci.closed_at IS NULL AND COALESCE(p.billing_mode, 'broker') <> 'direct'
    AND p.status IN ('active', 'issued', 'suspended')`;

/** The customer notices due today: the highest step reached that has not been sent (a bill found late gets its latest step only). */
async function customerNotices(day) {
  const steps = await noticeDays();
  const lastStep = steps[steps.length - 1];
  const rows = await many(CANDIDATES, [day]);
  const out = { notices: 0, flagged: 0, skipped: [] };
  const company = await companyName();
  const t = await emailTemplate('nonpayment_notice');
  for (const r of rows) {
    const reached = steps.filter((d) => Number(r.dpd) >= d);
    if (!reached.length) continue;
    const step = reached[reached.length - 1];
    const sentSteps = (await many("SELECT notes FROM collection_actions WHERE collection_id = $1 AND action_type = 'Non-payment notice'", [r.id])).map((a) => Number(String(a.notes).match(/day (\d+)/)?.[1] || 0));
    if (sentSteps.includes(step)) continue;
    const consequence = step === lastStep ? 'The policy will be cancelled for non-payment and the insurer informed.' : `A further notice follows before the policy is cancelled for non-payment on day ${lastStep}.`;
    const vars = { companyName: company, customerName: r.client_name || 'Customer', policyNumber: r.policy_number, billNumber: r.bill_number, amount: amountText(r.balance), currency: r.currency || 'PHP',
      dueDate: r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : r.due_date, days: step, consequence };
    let emailId = null;
    if (r.email) emailId = await queueEmail({ to: r.email, subject: renderTemplate(t.subject, vars, { html: false }), html: renderTemplate(t.html, vars), template: 'nonpayment-notice', entity: 'collection', entityId: r.id });
    else out.skipped.push({ id: r.id, reason: 'client has no e-mail' });
    await query("INSERT INTO collection_actions(collection_id, action_type, action_by, notes, email_id) VALUES ($1, 'Non-payment notice', 'system', $2, $3)",
      [r.id, `Non-payment notice day ${step}: ${r.policy_number}, ${r.currency || 'PHP'} ${amountText(r.balance)} due ${vars.dueDate}`, emailId]);
    await notify({ userId: r.owner_user_id || null, audience: r.owner_user_id ? null : 'write:collections', type: 'reminder', title: `Non-payment notice (day ${step}) - ${r.policy_number}`,
      message: `${vars.customerName}: ${vars.currency} ${vars.amount} unpaid ${step} days after ${vars.dueDate}`, link: `/agent/collections/${r.id}`, entity: 'collection', entityId: r.id });
    out.notices += 1;
    if (step === lastStep && !r.nonpayment_flagged_at) {
      await query('UPDATE collection_items SET nonpayment_flagged_at = now(), updated_at = now() WHERE id = $1', [r.id]);
      await notify({ audience: 'write:collections', type: 'alert', priority: 'high', title: `Cancellation for non-payment to raise - ${r.policy_number}`,
        message: `${vars.customerName}: ${vars.currency} ${vars.amount} unpaid ${step} days after the due date; raise the cancellation request`, link: `/agent/collections/${r.id}`, entity: 'collection', entityId: r.id });
      out.flagged += 1;
    }
  }
  return out;
}

/** Policies cancelled for non-payment since the last run: Sales and the insurer are told once. */
async function cancellationNotices() {
  const reason = String(await getSetting('collections.nonpayment_cancellation_reason', 'CAN-NONPAY'));
  const rows = await many(`SELECT e.id, e.endorsement_number, e.effective_date, p.policy_number, p.owner_user_id, c.display_name AS client_name, ic.id AS insurer_id, ic.name AS insurer_name, ic.contact_email
    FROM endorsements e JOIN policies p ON p.id = e.policy_id LEFT JOIN clients c ON c.id = e.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE e.is_cancel AND e.status = 'cancelled' AND upper(COALESCE(e.cancellation_reason, '')) = upper($1) AND e.nonpayment_notified_at IS NULL`, [reason]);
  const company = await companyName();
  const t = await emailTemplate('nonpayment_cancelled');
  let notified = 0;
  for (const r of rows) {
    const vars = { companyName: company, customerName: r.client_name || 'Customer', policyNumber: r.policy_number, endorsementNumber: r.endorsement_number,
      effectiveDate: r.effective_date instanceof Date ? r.effective_date.toISOString().slice(0, 10) : r.effective_date };
    if (r.contact_email) await queueEmail({ to: r.contact_email, subject: renderTemplate(t.subject, vars, { html: false }), html: renderTemplate(t.html, vars), template: 'nonpayment-cancelled', entity: 'endorsement', entityId: r.id });
    await notify({ userId: r.owner_user_id || null, audience: r.owner_user_id ? null : 'write:policies', type: 'info', title: `Policy cancelled for non-payment - ${r.policy_number}`,
      message: `${vars.customerName}: cancellation ${r.endorsement_number} effective ${vars.effectiveDate}; ${r.insurer_name || 'the insurer'} ${r.contact_email ? 'has been' : 'could not be'} e-mailed`,
      link: `/agent/endorsementdetailedview/${r.id}`, entity: 'endorsement', entityId: r.id });
    await query('UPDATE endorsements SET nonpayment_notified_at = now() WHERE id = $1', [r.id]);
    notified += 1;
  }
  return notified;
}

/** The insurer notice day of the month: collections.insurer_notice_day, or the last working day before it. */
export async function insurerNoticeDate(day) {
  const n = Math.min(28, Math.max(1, Number(await getSetting('collections.insurer_notice_day', 26)) || 26));
  const target = `${day.slice(0, 7)}-${String(n).padStart(2, '0')}`;
  const cal = await workingCalendar(addDays(target, -10), target);
  let d = target;
  while (!cal.isWorking(d) && d > addDays(target, -10)) d = addDays(d, -1);
  return d;
}

/** On the insurer notice date, each insurer receives the month's non-payment cancellations (once per month). */
async function insurerNotices(day) {
  const noticeDay = await insurerNoticeDate(day);
  if (day < noticeDay) return { sent: 0, noticeDate: noticeDay };
  const period = day.slice(0, 7);
  const reason = String(await getSetting('collections.nonpayment_cancellation_reason', 'CAN-NONPAY'));
  const rows = await many(`SELECT ic.id AS insurer_id, ic.name AS insurer_name, ic.contact_email, json_agg(json_build_object('policyNumber', p.policy_number, 'client', c.display_name, 'endorsement', e.endorsement_number, 'effective', e.effective_date) ORDER BY p.policy_number) AS policies
    FROM endorsements e JOIN policies p ON p.id = e.policy_id JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN clients c ON c.id = e.client_id
    WHERE e.is_cancel AND e.status = 'cancelled' AND upper(COALESCE(e.cancellation_reason, '')) = upper($1) AND to_char(COALESCE(e.completed_at, e.updated_at), 'YYYY-MM') = $2
      AND NOT EXISTS (SELECT 1 FROM nonpayment_insurer_notices n WHERE n.period = $2 AND n.insurance_company_id = ic.id)
    GROUP BY ic.id, ic.name, ic.contact_email`, [reason, period]);
  const company = await companyName();
  const t = await emailTemplate('nonpayment_insurer_notice');
  let sent = 0;
  for (const r of rows) {
    const list = `<ul>${r.policies.map((x) => `<li>${x.policyNumber} - ${x.client || ''} (cancellation ${x.endorsement}, effective ${String(x.effective).slice(0, 10)})</li>`).join('')}</ul>`;
    const vars = { companyName: company, insurerName: r.insurer_name, period, policyList: list };
    const emailId = r.contact_email ? await queueEmail({ to: r.contact_email, subject: renderTemplate(t.subject, vars, { html: false }), html: renderTemplate(t.html, vars), template: 'nonpayment-insurer-notice', entity: 'insurance_company', entityId: r.insurer_id }) : null;
    await query('INSERT INTO nonpayment_insurer_notices(period, insurance_company_id, policies, email_id) VALUES ($1,$2,$3,$4) ON CONFLICT (period, insurance_company_id) DO NOTHING', [period, r.insurer_id, r.policies.length, emailId]);
    await notify({ audience: 'write:collections', type: 'info', title: `Non-payment cancellations sent to ${r.insurer_name}`, message: `${r.policies.length} policy(ies) cancelled for non-payment in ${period}${r.contact_email ? '' : '; the insurer has no contact e-mail'}`,
      link: '/agent/collections', entity: 'insurance_company', entityId: r.insurer_id });
    sent += 1;
  }
  return { sent, noticeDate: noticeDay };
}

/** The daily run. `now` is for tests. */
export async function nonpaymentCadence(_params = {}, { now = null } = {}) {
  const day = now ? isoInZone(now, await businessTimeZone()) : await today();
  const customer = await customerNotices(day);
  const cancelled = await cancellationNotices();
  const insurers = await insurerNotices(day);
  return { day, ...customer, cancellationsNotified: cancelled, insurerNotices: insurers.sent, insurerNoticeDate: insurers.noticeDate };
}

/** The Non-Payment Report rows ($1 due from, $2 due to, $3 report days, $4 today). */
export const NON_PAYMENT_SQL = `SELECT p.id AS _id, p.policy_number AS "policyNumber", r.bill_number AS "billNumber", r.due_date AS "dueDate",
    ($4::date - r.due_date) AS "daysPastDue", r.balance, r.amount AS "billAmount", r.currency,
    (SELECT count(*)::int FROM collection_actions a WHERE a.collection_id = ci.id AND a.action_type = 'Non-payment notice') AS "noticesSent",
    (SELECT max(a.action_date)::date FROM collection_actions a WHERE a.collection_id = ci.id AND a.action_type = 'Non-payment notice') AS "lastNoticeDate",
    ci.nonpayment_flagged_at::date AS "flaggedDate",
    CASE WHEN EXISTS (SELECT 1 FROM endorsements e WHERE e.policy_id = p.id AND e.is_cancel AND e.status NOT IN ('rejected')) THEN 'Cancellation raised'
         WHEN ci.nonpayment_flagged_at IS NOT NULL THEN 'Flagged for cancellation' ELSE 'Unpaid' END AS status,
    u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent, ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer,
    u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch, c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client,
    pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product
  FROM receivables r JOIN policies p ON p.id = r.policy_id LEFT JOIN collection_items ci ON ci.receivable_id = r.id
  LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN users u ON u.id = p.owner_user_id LEFT JOIN branches b ON b.code = u.branch_code
  WHERE r.status IN ('open', 'partial') AND r.balance > 0 AND COALESCE(p.billing_mode, 'broker') <> 'direct' AND r.due_date BETWEEN $1 AND $2 AND ($4::date - r.due_date) >= $3::int`;

export const nonPaymentSummary = async () => one(`SELECT count(*)::int AS accounts, COALESCE(sum(r.balance), 0) AS balance FROM receivables r JOIN policies p ON p.id = r.policy_id
  WHERE r.status IN ('open', 'partial') AND r.balance > 0 AND COALESCE(p.billing_mode, 'broker') <> 'direct' AND r.due_date < current_date`);
