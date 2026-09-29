/** Agent Payments (premium payment status per bill) and Open Items (pending payments, renewals, pending quotes, expiring policies, events). */
import { isAdmin } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { notFound } from '../../lib/errors.js';
import { isoDate, round2 } from '../accounting/lib/http.js';
import { today } from '../../lib/dates.js';

// A premium bill cancelled because the policy moved to direct bill (the client pays the insurer) is DIRECT, not PAID;
// any other cancelled bill is CANCELLED.
const STATUS_SQL = `CASE WHEN r.status = 'cancelled' AND p.billing_mode = 'direct' THEN 'DIRECT' WHEN r.status = 'cancelled' THEN 'CANCELLED'
  WHEN r.status = 'paid' OR r.balance <= 0 THEN 'PAID' WHEN r.status = 'partial' THEN 'REVIEWING' ELSE 'PENDING' END`;
const STATUS_LABEL = { DIRECT: 'DIRECT BILL' };
/** Roles that see every policy's payments; any other role (e.g. Claims) only sees the policies it owns. Administrators see everything. */
const ALL_PAYMENTS_ROLES = ['accounting', 'sales', 'operations', 'processing'];
export const ownOnly = (user) => !isAdmin(user) && !(user.roles || []).some((r) => ALL_PAYMENTS_ROLES.includes(r));

const PAY_SQL = `SELECT r.*, ${STATUS_SQL} AS pay_status, p.policy_number, p.owner_user_id, p.billing_mode, c.client_code, c.display_name, ic.name AS insurer_name, pr.name AS product_name,
  la.payment_mode AS last_mode, la.applied_at AS last_paid_at, COALESCE(rc.receipt_number, la.reference_no) AS last_reference
  FROM receivables r LEFT JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = r.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN LATERAL (SELECT * FROM receipt_applications a WHERE a.receivable_id = r.id AND a.status = 'applied' ORDER BY a.applied_at DESC LIMIT 1) la ON true
  LEFT JOIN receipts rc ON rc.id = la.receipt_id`;

export const paymentRow = (x) => ({
  id: x.id, receivableId: x.id, billNumber: x.bill_number, grossPremium: Number(x.amount), paidAmount: round2(Number(x.amount) - Number(x.balance)), outstanding: Number(x.balance),
  clientId: x.client_code, clientRefId: x.client_id, clientName: x.display_name, date: isoDate(x.last_paid_at) || x.due_date, dueDate: x.due_date, policyId: x.policy_id,
  policyNumber: x.policy_number, insurer: x.insurer_name, product: x.product_name, status: STATUS_LABEL[x.pay_status] || x.pay_status, paymentMethod: x.last_mode, referenceNumber: x.last_reference,
  billingMode: x.billing_mode || 'broker',
  commission: Number(x.commission_amount), source: x.source, currency: x.currency,
});

function where(q, user) {
  const w = ['r.status <> \'written-off\'']; const p = [];
  const add = (sql, v) => { p.push(v); w.push(sql.replaceAll('?', `$${p.length}`)); };
  // the Paid tab also lists direct-bill policies (settled between the client and the insurer), labelled DIRECT BILL
  if (q.status && String(q.status).toUpperCase() === 'PAID') add(`${STATUS_SQL} IN (?, 'DIRECT')`, 'PAID');
  else if (q.status) add(`${STATUS_SQL} = ?`, String(q.status).toUpperCase());
  if (q.search) add('(COALESCE(p.policy_number,\'\') || \' \' || COALESCE(c.client_code,\'\') || \' \' || COALESCE(c.display_name,\'\') || \' \' || COALESCE(r.bill_number,\'\')) ILIKE \'%\' || ? || \'%\'', q.search);
  if (q.policyNumber) add('p.policy_number ILIKE \'%\' || ? || \'%\'', q.policyNumber);
  if (q.clientId) add('(c.client_code = ? OR c.id = ?)', q.clientId);
  if (q.fromDate) add('r.due_date >= ?::date', isoDate(q.fromDate));
  if (q.toDate) add('r.due_date <= ?::date', isoDate(q.toDate));
  if (ownOnly(user)) add('p.owner_user_id = ?', user.id);
  return { sql: `WHERE ${w.join(' AND ')}`, params: p };
}

export async function listPayments(db, q, pg, user) {
  const f = where(q, user);
  const total = (await db.query(`SELECT count(*)::int AS n FROM (${PAY_SQL} ${f.sql}) x`, f.params)).rows[0].n;
  const rows = (await db.query(`${PAY_SQL} ${f.sql} ORDER BY r.due_date DESC, r.created_at DESC LIMIT $${f.params.length + 1} OFFSET $${f.params.length + 2}`, [...f.params, pg.limit, pg.offset])).rows;
  const s = where({ ...q, status: undefined }, user);
  const sum = (await db.query(`SELECT pay_status AS s, count(*)::int AS n, COALESCE(sum(amount),0) AS gross, COALESCE(sum(balance),0) AS bal FROM (${PAY_SQL} ${s.sql}) x GROUP BY pay_status`, s.params)).rows;
  const summary = Object.fromEntries(['PAID', 'PENDING', 'REVIEWING'].map((k) => { const r = sum.find((x) => x.s === k); return [k.toLowerCase(), { count: r?.n || 0, grossPremium: round2(r?.gross || 0), outstanding: round2(r?.bal || 0) }]; }));
  return { rows: rows.map(paymentRow), total, summary };
}

export async function getPayment(db, id, user) {
  const f = where({}, user);
  const x = (await db.query(`${PAY_SQL} ${f.sql} AND (r.id = $${f.params.length + 1} OR r.bill_number = $${f.params.length + 1})`, [...f.params, id])).rows[0];
  if (!x) throw notFound('Payment record not found');
  const apps = (await db.query(`SELECT a.*, rc.receipt_number FROM receipt_applications a LEFT JOIN receipts rc ON rc.id = a.receipt_id WHERE a.receivable_id = $1 ORDER BY a.applied_at`, [x.id])).rows;
  return { ...paymentRow(x), payments: apps.map((a) => ({ id: a.id, amount: Number(a.amount), paymentMethod: a.payment_mode, receiptNumber: a.receipt_number, referenceNumber: a.reference_no, date: a.applied_at, status: a.status })) };
}

/** Open items for the signed-in user (agents: own records; others: all). */
export async function openItems(db, q, user) {
  const own = ownOnly(user);
  const days = Number(((await getSetting('limits.renewal_notice_days', [60, 30, 15])) || [60])[0]);
  const symbol = await getSetting('currency.symbol', '₱');
  const money = (n) => `${symbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const uid = own ? user.id : null;
  const pending = (await db.query(`SELECT r.id, r.balance, r.due_date, p.id AS policy_id, p.policy_number, c.client_code, c.display_name, ic.name AS insurer FROM receivables r
    JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = r.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE r.status IN ('open','partial') AND r.balance > 0 AND ($1::text IS NULL OR p.owner_user_id = $1) ORDER BY r.due_date LIMIT 200`, [uid])).rows;
  const renewals = (await db.query(`SELECT rn.id, rn.due_date, rn.status AS renewal_status, p.id AS policy_id, p.policy_number, c.client_code, c.display_name, ic.name AS insurer FROM renewals rn
    JOIN policies p ON p.id = rn.policy_id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE rn.status NOT IN ('renewed','lapsed') AND ($1::text IS NULL OR p.owner_user_id = $1) ORDER BY rn.due_date LIMIT 200`, [uid])).rows;
  const quotes = (await db.query(`SELECT q.id, q.quote_number, q.status AS quote_status, q.premium_total, q.valid_until, q.created_at, COALESCE(c.display_name, l.display_name) AS name,
    COALESCE(c.client_code, l.lead_number) AS client_code, ic.name AS insurer FROM quotes q LEFT JOIN clients c ON c.id = q.client_id LEFT JOIN leads l ON l.id = q.lead_id
    LEFT JOIN insurance_companies ic ON ic.id = q.insurance_company_id WHERE q.status IN ('draft','quoted','sent') AND ($1::text IS NULL OR q.agent_user_id = $1 OR q.created_by = $1) ORDER BY q.created_at DESC LIMIT 200`, [uid])).rows;
  const expiring = (await db.query(`SELECT p.id, p.policy_number, p.expiry_date, p.premium_total, c.client_code, c.display_name, ic.name AS insurer FROM policies p LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE p.status IN ('issued','active') AND p.expiry_date BETWEEN $3::date AND $3::date + $2::int
    AND ($1::text IS NULL OR p.owner_user_id = $1) ORDER BY p.expiry_date LIMIT 200`, [uid, days, await today()])).rows;
  const items = [
    ...pending.map((r) => ({ id: r.id, type: 'payment', status: 'Pending Payments', name: r.display_name, clientId: r.client_code, policyId: r.policy_id, policyNo: r.policy_number, amount: money(r.balance), amountValue: Number(r.balance), dueDate: r.due_date, insurer: r.insurer })),
    ...renewals.map((r) => ({ id: r.id, type: 'renewal', status: 'Renewal Request', name: r.display_name, clientId: r.client_code, policyId: r.policy_id, policyNo: r.policy_number, renewalDate: r.due_date, renewalStatus: r.renewal_status, insurer: r.insurer })),
    ...quotes.map((r) => ({ id: r.id, type: 'quote', status: 'Quote Pending', name: r.name, clientId: r.client_code, quoteId: r.quote_number, amount: money(r.premium_total), amountValue: Number(r.premium_total), validUntil: r.valid_until, quoteStatus: r.quote_status, insurer: r.insurer })),
    ...expiring.map((r) => ({ id: r.id, type: 'expiring', status: 'Expiring Policy', name: r.display_name, clientId: r.client_code, policyId: r.id, policyNo: r.policy_number, expiryDate: r.expiry_date, amount: money(r.premium_total), amountValue: Number(r.premium_total), insurer: r.insurer })),
  ];
  const filtered = items.filter((i) => (!q.type || i.type === q.type) && (!q.search || `${i.name} ${i.clientId} ${i.policyNo || ''} ${i.quoteId || ''}`.toLowerCase().includes(String(q.search).toLowerCase())));
  const count = (t) => items.filter((i) => i.type === t).length;
  return { summary: [{ type: 'payment', status: 'Pending Payments', count: count('payment') }, { type: 'renewal', status: 'Renewal Request', count: count('renewal') },
    { type: 'quote', status: 'Quote Pending', count: count('quote') }, { type: 'expiring', status: 'Expiring Policy', count: count('expiring') }], items: filtered };
}

export const eventRow = (e) => ({ id: e.id, date: e.event_date, description: e.description, from: e.start_time, to: e.end_time, entity: e.entity, entityId: e.entity_id, createdAt: e.created_at });
