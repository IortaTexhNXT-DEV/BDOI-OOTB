/**
 * Collections: one tracking item per receivable. Status, days past due, overdue level and ageing buckets are derived
 * at query time from the receivable (balance, due date) and the item (commitment, escalation) using thresholds from
 * app_settings (limits.receivable_ageing_buckets, collections.*).
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { queueEmail } from '../../lib/mailer.js';
import { round2 } from '../accounting/lib/http.js';
import { notify } from '../notifications/router.js';
import { ensureBooked, findPolicy } from '../receipts/receivables.js';

async function thresholds() {
  const buckets = (await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120])) || [30, 60, 90];
  const levels = (await getSetting('collections.overdue_levels', [30, 60])) || [30, 60];
  return { b1: Number(buckets[0] ?? 30), b2: Number(buckets[1] ?? 60), b3: Number(buckets[2] ?? 90), l1: Number(levels[0] ?? 30), l2: Number(levels[1] ?? 60),
    window: Number(await getSetting('collections.current_window_days', 7)) };
}

/** Base query; $1..$6 = b1, b2, b3, l1, l2, window. */
const BASE = `SELECT * FROM (SELECT ci.*, r.bill_number, r.amount, r.balance, r.due_date, r.status AS receivable_status, r.net_premium, r.vat, r.dst, r.lgt, r.other_charges,
    r.discount, r.source AS receivable_source, r.currency, GREATEST(current_date - r.due_date, 0) AS dpd,
    p.policy_number, p.status AS policy_status, p.inception_date, p.expiry_date, p.owner_user_id, c.client_code, c.first_name, c.last_name, c.display_name, c.email, c.phone,
    ic.name AS insurer_name, pr.name AS product_name,
    CASE WHEN r.balance <= 0 OR r.status IN ('paid','written-off') THEN 'Paid'
         WHEN ci.escalated_at IS NOT NULL THEN 'Escalated'
         WHEN ci.commitment_date IS NOT NULL AND ci.commitment_date >= current_date THEN 'Committed'
         WHEN current_date > r.due_date THEN 'Overdue'
         WHEN r.balance < r.amount THEN 'PartiallyPaid'
         WHEN r.due_date - current_date <= $6 THEN 'Current'
         ELSE 'Pending' END AS collection_status,
    CASE WHEN current_date <= r.due_date OR r.balance <= 0 THEN 0 WHEN current_date - r.due_date <= $4 THEN 1 WHEN current_date - r.due_date <= $5 THEN 2 ELSE 3 END AS overdue_level,
    CASE WHEN current_date <= r.due_date THEN r.balance ELSE 0 END AS current_amount,
    CASE WHEN current_date - r.due_date BETWEEN 1 AND $1 THEN r.balance ELSE 0 END AS b1_amount,
    CASE WHEN current_date - r.due_date BETWEEN $1 + 1 AND $2 THEN r.balance ELSE 0 END AS b2_amount,
    CASE WHEN current_date - r.due_date BETWEEN $2 + 1 AND $3 THEN r.balance ELSE 0 END AS b3_amount,
    CASE WHEN current_date - r.due_date > $3 THEN r.balance ELSE 0 END AS b4_amount
  FROM collection_items ci JOIN receivables r ON r.id = ci.receivable_id LEFT JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = r.client_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN products pr ON pr.id = p.product_id) x`;
const baseParams = (t) => [t.b1, t.b2, t.b3, t.l1, t.l2, t.window];

const SORTS = { dueDate: 'due_date', daysPastDue: 'dpd', outstandingAmount: 'balance', overdueLevel: 'overdue_level', collectionStatus: 'collection_status', policyNumber: 'policy_number', client: 'display_name' };

export const itemRow = (x) => ({
  id: x.id, collectionId: x.id, receivableId: x.receivable_id, billNumber: x.bill_number, policyId: x.policy_id, policyNumber: x.policy_number, clientId: x.client_id,
  client: { id: x.client_id, clientId: x.client_code, firstName: x.first_name || x.display_name, lastName: x.last_name || '', displayName: x.display_name, email: x.email, phone: x.phone },
  policy: { id: x.policy_id, policyNumber: x.policy_number, status: x.policy_status, inceptionDate: x.inception_date, expiryDate: x.expiry_date, insurer: x.insurer_name, product: x.product_name, isCoInsurance: false },
  grossPremium: Number(x.amount), netPremium: Number(x.net_premium), valueAddedTax: Number(x.vat), documentaryStampTax: Number(x.dst), localGovernmentTax: Number(x.lgt),
  accountPremiumOthers: Number(x.other_charges), discount: Number(x.discount), paidAmount: round2(Number(x.amount) - Number(x.balance)), outstandingAmount: Number(x.balance),
  currentAmount: Number(x.current_amount), days1to30Amount: Number(x.b1_amount), days31to60Amount: Number(x.b2_amount), days61to90Amount: Number(x.b3_amount), over90DaysAmount: Number(x.b4_amount),
  dueDate: x.due_date, daysPastDue: x.dpd, days: x.dpd, overdueLevel: x.overdue_level, collectionStatus: x.collection_status, commitmentDate: x.commitment_date,
  commitmentReason: x.commitment_reason, escalatedAt: x.escalated_at, lastFollowUpAt: x.last_follow_up_at, lastReminderAt: x.last_reminder_at, currency: x.currency,
  isCoInsurancePolicy: false, coInsuranceCollectionRows: [],
});

function filters(q) {
  const where = []; const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replaceAll('?', `$${p.length + 6}`)); };
  if (q.status) add('collection_status = ?', q.status);
  else if (String(q.includePaid) !== 'true') where.push('collection_status <> \'Paid\'');
  if (q.overdueLevel) add('overdue_level = ?::int', Number(q.overdueLevel));
  if (q.clientId) add('(client_id = ? OR client_code = ?)', q.clientId);
  if (q.policyId) add('(policy_id = ? OR policy_number = ?)', q.policyId);
  if (q.search) add('(COALESCE(display_name,\'\') || \' \' || COALESCE(policy_number,\'\') || \' \' || COALESCE(client_code,\'\') || \' \' || COALESCE(bill_number,\'\')) ILIKE \'%\' || ? || \'%\'', q.search);
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params: p };
}

export async function listCollections(db, q, pg) {
  const t = await thresholds();
  const f = filters(q);
  const params = [...baseParams(t), ...f.params];
  const total = (await db.query(`SELECT count(*)::int AS n FROM (${BASE}) y ${f.where}`, params)).rows[0].n;
  const sort = SORTS[q.sortField] || 'due_date';
  const dir = String(q.sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const rows = (await db.query(`SELECT * FROM (${BASE}) y ${f.where} ORDER BY ${sort} ${dir} NULLS LAST, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset])).rows;
  return { rows: rows.map(itemRow), total };
}

export async function getCollection(db, id) {
  const t = await thresholds();
  const x = (await db.query(`SELECT * FROM (${BASE}) y WHERE id = $7 OR receivable_id = $7`, [...baseParams(t), id])).rows[0];
  if (!x) throw notFound('Collection not found');
  const actions = (await db.query('SELECT * FROM collection_actions WHERE collection_id = $1 ORDER BY action_date DESC', [x.id])).rows;
  const pays = (await db.query(`SELECT a.*, rc.receipt_number, rc.remarks FROM receipt_applications a LEFT JOIN receipts rc ON rc.id = a.receipt_id
    WHERE a.receivable_id = $1 ORDER BY a.applied_at DESC`, [x.receivable_id])).rows;
  return {
    ...itemRow(x),
    followUpActions: actions.map((a) => ({ id: a.id, actionType: a.action_type, actionDate: a.action_date, actionBy: a.action_by, callOutcome: a.call_outcome, notes: a.notes, commitmentDate: a.commitment_date })),
    paymentHistory: pays.map((a) => ({ id: a.id, paymentDate: a.applied_at, paymentAmount: Number(a.amount), paymentMethod: a.payment_mode, referenceNumber: a.receipt_number || a.reference_no,
      remarks: a.status === 'reversed' ? 'Reversed' : a.remarks, status: a.status })),
  };
}

const itemId = async (db, id) => {
  const r = (await db.query('SELECT * FROM collection_items WHERE id = $1 OR receivable_id = $1', [id])).rows[0];
  if (!r) throw notFound('Collection not found');
  return r;
};

export async function addAction(db, id, a, user) {
  const item = await itemId(db, id);
  await db.query(`INSERT INTO collection_actions(collection_id, action_type, action_by, call_outcome, notes, commitment_date, email_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [item.id, a.actionType, a.actionBy || user.username, a.callOutcome || null, a.notes || null, a.commitmentDate || null, a.emailId || null]);
  await db.query(`UPDATE collection_items SET last_follow_up_at = now(), updated_at = now(), escalated_at = CASE WHEN $2 = 'Escalation' THEN now() ELSE escalated_at END,
    escalated_by = CASE WHEN $2 = 'Escalation' THEN $3 ELSE escalated_by END WHERE id = $1`, [item.id, a.actionType, user.id]);
  return item.id;
}

export async function setCommitment(db, id, date, reason, user) {
  const item = await itemId(db, id);
  if (date < new Date().toISOString().slice(0, 10)) throw badRequest('Commitment date cannot be in the past');
  await db.query('UPDATE collection_items SET commitment_date = $2, commitment_reason = $3, escalated_at = NULL, updated_at = now() WHERE id = $1', [item.id, date, reason || null]);
  await addAction(db, item.id, { actionType: 'Commitment', notes: reason, commitmentDate: date }, user);
  return item.id;
}

const fill = (tpl, vars) => String(tpl).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''));
async function emailVars(x) {
  const symbol = await getSetting('currency.symbol', '₱');
  return { clientName: x.client.displayName || `${x.client.firstName} ${x.client.lastName}`.trim(), policyNumber: x.policyNumber, billNumber: x.billNumber,
    amount: `${symbol}${Number(x.outstandingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, dueDate: x.dueDate, daysPastDue: x.daysPastDue,
    companyName: await getSetting('general.company_name', 'BrokerVerse') };
}

/** Queue a collection e-mail to the client (body = the notes typed on the screen, wrapped in the configured template). */
export async function sendEmail(db, id, body, user) {
  const x = await getCollection(db, id);
  const to = body.to || x.client.email;
  if (!to) throw badRequest('The client has no e-mail address');
  const vars = await emailVars(x);
  const subject = fill(body.subject || (await getSetting('collections.email_subject', 'Premium payment reminder – Policy {{policyNumber}}')), vars);
  const content = body.notes ? String(body.notes).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>') : fill(await getSetting('collections.email_template', '<p>Dear {{clientName}},</p><p>{{amount}} is due on {{dueDate}}.</p>'), vars);
  const emailId = await queueEmail({ to, subject, html: content, template: 'collection-follow-up', entity: 'collection', entityId: x.id });
  await addAction(db, x.id, { actionType: 'Email', notes: body.notes || subject, actionBy: body.actionBy, emailId }, user);
  return { emailId, to, subject };
}

/**
 * Due-date reminders: items due within collections.reminder_days_before days or overdue, not reminded within
 * collections.reminder_repeat_days. Queues a client e-mail and notifies the policy owner.
 */
export async function sendDueDateReminders(db, user) {
  const t = await thresholds();
  const before = Number(await getSetting('collections.reminder_days_before', 7));
  const repeat = Number(await getSetting('collections.reminder_repeat_days', 7));
  const rows = (await db.query(`SELECT * FROM (${BASE}) y WHERE collection_status NOT IN ('Paid','Committed') AND due_date - current_date <= $7
    AND (last_reminder_at IS NULL OR last_reminder_at < now() - ($8 || ' days')::interval)`, [...baseParams(t), before, String(repeat)])).rows;
  const subjectTpl = await getSetting('collections.email_subject', 'Premium payment reminder – Policy {{policyNumber}}');
  const bodyTpl = await getSetting('collections.email_template', '<p>Dear {{clientName}},</p><p>{{amount}} is due on {{dueDate}}.</p>');
  let emails = 0; let notifications = 0; const skipped = [];
  for (const r of rows) {
    const x = itemRow(r);
    const vars = await emailVars(x);
    if (x.client.email) {
      await queueEmail({ to: x.client.email, subject: fill(subjectTpl, vars), html: fill(bodyTpl, vars), template: 'collection-reminder', entity: 'collection', entityId: x.id });
      emails += 1;
    } else skipped.push({ id: x.id, reason: 'client has no e-mail' });
    await notify({ userId: r.owner_user_id || null, type: 'reminder', title: `Premium ${x.daysPastDue > 0 ? `overdue ${x.daysPastDue} day(s)` : `due ${x.dueDate}`} – ${x.policyNumber}`,
      message: `${vars.clientName}: ${vars.amount} outstanding on ${x.billNumber}`, link: `/agent/collections/${x.id}`, entity: 'collection', entityId: x.id });
    notifications += 1;
    await db.query('UPDATE collection_items SET last_reminder_at = now() WHERE id = $1', [x.id]);
    await db.query('INSERT INTO collection_actions(collection_id, action_type, action_by, notes) VALUES ($1,\'Reminder\',$2,$3)', [x.id, user?.username || 'system', fill(subjectTpl, vars)]);
  }
  return { candidates: rows.length, emails, notifications, skipped };
}

/** Build / refresh collection items from receivables (all, or the policies of one receipt). */
export async function sync(db, { receiptId } = {}, user = null) {
  let policyIds = null;
  if (receiptId) {
    const r = (await db.query('SELECT id, policy_id FROM receipts WHERE id = $1 OR receipt_number = $1', [receiptId])).rows[0];
    if (!r) throw notFound('Receipt not found');
    policyIds = (await db.query('SELECT DISTINCT policy_id FROM receipt_lines WHERE receipt_id = $1 AND policy_id IS NOT NULL UNION SELECT $2::text WHERE $2::text IS NOT NULL', [r.id, r.policy_id])).rows.map((x) => x.policy_id);
  }
  const unbooked = (await db.query('SELECT * FROM receivables WHERE booking_jv_id IS NULL AND policy_id IS NOT NULL AND ($1::text[] IS NULL OR policy_id = ANY($1)) ORDER BY created_at', [policyIds])).rows;
  for (const r of unbooked) await ensureBooked(db, r, await findPolicy(db, r.policy_id), user);
  const ins = await db.query(`INSERT INTO collection_items(receivable_id, policy_id, client_id)
    SELECT r.id, r.policy_id, r.client_id FROM receivables r WHERE ($1::text[] IS NULL OR r.policy_id = ANY($1)) ON CONFLICT (receivable_id) DO NOTHING RETURNING id`, [policyIds]);
  const closed = await db.query(`UPDATE collection_items ci SET closed_at = now(), updated_at = now() FROM receivables r WHERE r.id = ci.receivable_id AND ci.closed_at IS NULL
    AND (r.balance <= 0 OR r.status IN ('paid','written-off')) AND ($1::text[] IS NULL OR r.policy_id = ANY($1)) RETURNING ci.id`, [policyIds]);
  const items = policyIds ? (await db.query('SELECT id FROM collection_items WHERE policy_id = ANY($1)', [policyIds])).rows.map((x) => x.id) : undefined;
  return { created: ins.rowCount, closed: closed.rowCount, booked: unbooked.length, collectionIds: items, collectionId: items?.[0] };
}

export async function agingReport(db, q) {
  const t = await thresholds();
  const f = filters({ clientId: q.clientId, policyId: q.policyId });
  const rows = (await db.query(`SELECT * FROM (${BASE}) y ${f.where ? `${f.where} AND` : 'WHERE'} collection_status <> 'Paid' ORDER BY dpd DESC`, [...baseParams(t), ...f.params])).rows.map(itemRow);
  const sum = (k) => round2(rows.reduce((s, r) => s + r[k], 0));
  const summary = { totalOutstanding: sum('outstandingAmount'), totalCurrent: sum('currentAmount'), total1to30: sum('days1to30Amount'), total31to60: sum('days31to60Amount'),
    total61to90: sum('days61to90Amount'), totalOver90: sum('over90DaysAmount'), count: rows.length, bucketDays: [t.b1, t.b2, t.b3] };
  const pct = (v) => (summary.totalOutstanding ? Math.round((v / summary.totalOutstanding) * 1000) / 10 : 0);
  summary.percentages = { current: pct(summary.totalCurrent), days1to30: pct(summary.total1to30), days31to60: pct(summary.total31to60), days61to90: pct(summary.total61to90), over90: pct(summary.totalOver90) };
  return { summary, collections: rows };
}

export async function dashboardStats(db) {
  const t = await thresholds();
  const rows = (await db.query(`SELECT collection_status AS s, count(*)::int AS n, COALESCE(sum(balance),0) AS amt FROM (${BASE}) y GROUP BY collection_status`, baseParams(t))).rows;
  const by = Object.fromEntries(rows.map((r) => [r.s, { count: r.n, amount: round2(r.amt) }]));
  const collected = (await db.query('SELECT COALESCE(sum(amount),0) AS a FROM receipt_applications WHERE status = \'applied\' AND applied_at >= date_trunc(\'month\', now())')).rows[0].a;
  const open = rows.filter((r) => r.s !== 'Paid');
  return { totalOutstanding: round2(open.reduce((s, r) => s + Number(r.amt), 0)), totalItems: open.reduce((s, r) => s + r.n, 0), overdueCount: by.Overdue?.count || 0,
    overdueAmount: by.Overdue?.amount || 0, committedCount: by.Committed?.count || 0, escalatedCount: by.Escalated?.count || 0, collectedThisMonth: round2(collected),
    byStatus: rows.map((r) => ({ status: r.s, count: r.n, amount: round2(r.amt) })) };
}
