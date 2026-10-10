/**
 * Unapplied collections (TIS-BRD-COLL-04, PBSM-M15-COL-SLA; migration 0529): money received that no bill takes yet.
 *   excess    paid above what the policy owes (receipts.excess_handling on-account), held On Account
 *   floating  received with no client or bill identified yet (a bank credit with an unknown reference)
 *   advance   paid by a known client before the bill exists
 * Each is posted Dr cash / Cr unapplied collections (receipt.unapplied) and is to be allocated by its SLA date
 * (collections.unapplied_sla_days working days): allocated to open bills (unapplied.allocate, the bill settled as by a
 * receipt) or refunded to the client with a reason (unapplied.refund: the refund payable is paid by disbursement).
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney, round2 } from '../../lib/money.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { holidays, toWorkingDay } from '../../lib/workingDays.js';
import { postEvent } from '../accounting/lib/posting.js';
import { reverseJournal } from '../accounting/lib/ledger.js';
import { requiredReason } from '../ops-masters/records.js';
import { applyToReceivable, commissionWhenSettled, findClient, requirePolicy } from './receivables.js';

export const KINDS = ['excess', 'floating', 'advance'];
const KIND_TEXT = { excess: 'Excess payment', floating: 'Floating payment', advance: 'Advance payment' };
const STATUS_TEXT = { open: 'Open', allocated: 'Allocated', refunded: 'Refunded', reversed: 'Reversed' };
const EPS = 0.005;
const fail = (path, message) => badRequest('Validation failed', [{ path, message }]);

/** The date by which an amount received on `date` is to be allocated: that many working days after it. */
export async function allocateBy(date) {
  const days = Number(await getSetting('collections.unapplied_sla_days', 2)) || 0;
  const off = await holidays(date, addDays(date, days * 3 + 14));
  let day = date;
  for (let i = 0; i < days; i += 1) day = toWorkingDay(addDays(day, 1), 1, off);
  return day;
}

const SELECT = `SELECT u.*, r.receipt_number, c.display_name AS client_name, c.client_code, p.policy_number,
    (SELECT display_name FROM users WHERE id = u.created_by) AS created_by_name FROM unapplied_collections u
  LEFT JOIN receipts r ON r.id = u.receipt_id LEFT JOIN clients c ON c.id = u.client_id LEFT JOIN policies p ON p.id = u.policy_id`;

const out = (u, asOf) => ({
  id: u.id, kind: u.kind, kindText: KIND_TEXT[u.kind], status: u.status, statusText: STATUS_TEXT[u.status], amount: Number(u.amount), balance: Number(u.balance),
  receiptId: u.receipt_id, receiptNumber: u.receipt_number || null, clientId: u.client_id, clientName: u.client_name || u.payer_name || null, clientCode: u.client_code || null,
  policyId: u.policy_id, policyNumber: u.policy_number || null, receivedDate: isoDate(u.received_date), allocateBy: isoDate(u.allocate_by),
  overdue: u.status === 'open' && !!u.allocate_by && isoDate(u.allocate_by) < asOf, referenceNo: u.reference_no, paymentMode: u.payment_mode, payerName: u.payer_name,
  remarks: u.remarks, refundReason: u.refund_reason, createdBy: u.created_by_name || u.created_by, createdAt: u.created_at,
});

export async function getUnapplied(db, id) {
  const u = (await db.query(`${SELECT} WHERE u.id = $1`, [String(id)])).rows[0];
  if (!u) throw notFound('Unapplied collection not found');
  const allocations = (await db.query(`SELECT a.*, rv.bill_number, p.policy_number, (SELECT display_name FROM users WHERE id = a.allocated_by) AS allocated_by_name
    FROM unapplied_allocations a JOIN receivables rv ON rv.id = a.receivable_id LEFT JOIN policies p ON p.id = rv.policy_id WHERE a.unapplied_id = $1 ORDER BY a.id`, [u.id])).rows;
  return { ...out(u, await today()), allocations: allocations.map((a) => ({ billNumber: a.bill_number, policyNumber: a.policy_number, amount: Number(a.amount), status: a.status,
    allocatedBy: a.allocated_by_name, allocatedAt: a.allocated_at })) };
}

/** List (q: status, kind, overdue, search); open first by SLA date. */
export async function listUnapplied(db, q = {}) {
  const p = []; const where = [];
  if (q.status) { p.push(String(q.status)); where.push(`u.status = $${p.length}`); }
  if (q.kind) { p.push(String(q.kind)); where.push(`u.kind = $${p.length}`); }
  const asOf = await today();
  if (q.overdue === 'true') { p.push(asOf); where.push(`u.status = 'open' AND u.allocate_by < $${p.length}`); }
  if (q.search) { p.push(String(q.search)); where.push(`(COALESCE(c.display_name, u.payer_name, '') || ' ' || COALESCE(p.policy_number, '') || ' ' || COALESCE(r.receipt_number, '') || ' ' || COALESCE(u.reference_no, '')) ILIKE '%' || $${p.length} || '%'`); }
  const rows = (await db.query(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY (u.status = 'open') DESC, u.allocate_by NULLS LAST, u.created_at DESC LIMIT 500`, p)).rows;
  const list = rows.map((u) => out(u, asOf));
  const open = list.filter((u) => u.status === 'open');
  return { rows: list, summary: { open: open.length, openAmount: round2(open.reduce((s, u) => s + u.balance, 0)), overdue: open.filter((u) => u.overdue).length } };
}

/**
 * Hold an amount unapplied and post it (receipt.unapplied). h: { kind, amount, receipt, lineId, clientId, policyId, date,
 * paymentMode, referenceNo, bankAccount, payerName, remarks, user }.
 */
export async function holdUnapplied(db, h) {
  const amount = round2(h.amount);
  const date = h.date ? isoDate(h.date) : await today();
  const jv = await postEvent('receipt.unapplied', {
    source: 'receipt', entryType: 'PAYMENT_RECEIPT', transactionCode: h.receipt?.receipt_number || h.referenceNo || null, referenceType: h.receipt ? 'Receipt' : 'Unapplied collection',
    referenceId: h.receipt?.id || null, clientId: h.clientId || null, policyId: h.policyId || null, date, paymentMode: h.paymentMode, bankAccount: h.bankAccount || h.receipt?.bank_account_code || null,
    amounts: { amount }, vars: { kind: (KIND_TEXT[h.kind] || h.kind).toLowerCase(), payer: h.payerName || 'unidentified payer', memoRef: h.referenceNo || KIND_TEXT[h.kind],
      receiptSuffix: h.receipt ? ` (${h.receipt.receipt_number})` : '' },
  }, { db, user: h.user });
  return (await db.query(`INSERT INTO unapplied_collections(receipt_id, receipt_line_id, client_id, policy_id, kind, amount, balance, received_date, allocate_by, reference_no, payment_mode,
      payer_name, remarks, journal_id, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *`,
  [h.receipt?.id || null, h.lineId || null, h.clientId || null, h.policyId || null, h.kind, amount, date, await allocateBy(date), h.referenceNo || null, h.paymentMode || null,
    h.payerName || null, h.remarks || null, jv.id, h.user?.id ?? null])).rows[0];
}

/** Record a floating or advance payment (b: { kind, amount, receivedDate, paymentMode, referenceNo, bankAccount, customerCode, payerName, remarks }). */
export async function recordUnapplied(db, b, user) {
  if (!['floating', 'advance'].includes(b.kind)) throw fail('kind', 'Choose floating or advance');
  const amount = round2(Number(b.amount));
  if (!(amount > 0)) throw fail('amount', 'Amount must be greater than zero');
  const date = isoDate(b.receivedDate) || (await today());
  if (date > (await today())) throw fail('receivedDate', 'The date received cannot be in the future');
  const client = b.customerCode ? await findClient(db, b.customerCode) : null;
  if (b.customerCode && !client) throw fail('customerCode', `Client ${b.customerCode} not found`);
  if (b.kind === 'advance' && !client) throw fail('customerCode', 'An advance payment needs the client who paid it');
  if (!client && !String(b.payerName || '').trim() && !String(b.referenceNo || '').trim()) throw fail('referenceNo', 'Give the bank reference or the payer of a floating payment');
  const row = await holdUnapplied(db, { kind: b.kind, amount, clientId: client?.id || null, date, paymentMode: b.paymentMode || 'bank-transfer', referenceNo: b.referenceNo || null,
    bankAccount: b.bankAccount || null, payerName: client?.display_name || b.payerName || null, remarks: b.remarks || null, user });
  return getUnapplied(db, row.id);
}

async function lockOpen(db, id) {
  const u = (await db.query('SELECT * FROM unapplied_collections WHERE id = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!u) throw notFound('Unapplied collection not found');
  if (u.status !== 'open' || !(Number(u.balance) > EPS)) throw conflict(`This ${KIND_TEXT[u.kind].toLowerCase()} is ${STATUS_TEXT[u.status].toLowerCase()} and has nothing left to allocate`);
  return u;
}

/** Allocate to open bills (b: { allocations: [{ receivableId, amount }] }); the client of a floating payment is set from the bill. */
export async function allocateUnapplied(db, id, b, user) {
  const u = await lockOpen(db, id);
  const rows = (b.allocations || []).filter((a) => Number(a.amount) > 0);
  if (!rows.length) throw fail('allocations', 'Choose a bill and the amount to allocate');
  const total = round2(rows.reduce((s, a) => s + Number(a.amount), 0));
  if (total > Number(u.balance) + EPS) throw fail('allocations', `The amounts add up to ${await formatMoney(total)}; ${await formatMoney(u.balance)} is left to allocate`);
  const receipt = u.receipt_id ? (await db.query('SELECT * FROM receipts WHERE id = $1', [u.receipt_id])).rows[0] : null;
  let clientId = u.client_id;
  for (const [i, a] of rows.entries()) {
    const rcv = (await db.query('SELECT * FROM receivables WHERE id = $1 OR bill_number = $1 FOR UPDATE', [String(a.receivableId)])).rows[0];
    if (!rcv || !['open', 'partial'].includes(rcv.status) || !(Number(rcv.balance) > 0)) throw fail(`allocations.${i}.receivableId`, 'The bill is not open for payment');
    const policy = await requirePolicy(db, rcv.policy_id);
    if (clientId && (rcv.client_id || policy.client_id) !== clientId) throw fail(`allocations.${i}.receivableId`, `Bill ${rcv.bill_number} is not a bill of this client`);
    const amount = round2(Number(a.amount));
    if (amount > round2(rcv.balance) + EPS) throw fail(`allocations.${i}.amount`, `Bill ${rcv.bill_number} has ${await formatMoney(rcv.balance)} left to pay`);
    const ctx = { policy, receipt, unappliedId: u.id, paymentMode: u.payment_mode, referenceNo: u.reference_no || receipt?.receipt_number || null, date: await today(), user };
    const applied = await applyToReceivable(db, rcv, amount, ctx);
    await commissionWhenSettled(db, policy, ctx);
    await db.query('INSERT INTO unapplied_allocations(unapplied_id, receivable_id, amount, application_id, allocated_by) VALUES ($1,$2,$3,$4,$5)',
      [u.id, rcv.id, amount, applied.applicationId || null, user.id]);
    clientId = clientId || rcv.client_id || policy.client_id;
  }
  const left = round2(Number(u.balance) - total);
  await db.query(`UPDATE unapplied_collections SET balance = $2::numeric, status = CASE WHEN $2::numeric <= 0 THEN 'allocated' ELSE status END, client_id = COALESCE(client_id, $3), updated_by = $4,
    updated_at = now() WHERE id = $1`, [u.id, left, clientId, user.id]);
  return { item: await getUnapplied(db, u.id), message: left > 0 ? `${await formatMoney(total)} allocated; ${await formatMoney(left)} left to allocate` : `${await formatMoney(total)} allocated` };
}

/** Refund what is left to the client with a reason (context unapplied_refund): posted to the client refund payable. */
export async function refundUnapplied(db, id, b, user) {
  const u = await lockOpen(db, id);
  if (!u.client_id) throw conflict('Identify the client of a floating payment before you refund it');
  const reason = await requiredReason(db, 'unapplied_refund', { reasonCode: b.reasonCode, note: b.note });
  const amount = round2(u.balance);
  const client = (await db.query('SELECT display_name FROM clients WHERE id = $1', [u.client_id])).rows[0];
  const receipt = u.receipt_id ? (await db.query('SELECT receipt_number FROM receipts WHERE id = $1', [u.receipt_id])).rows[0] : null;
  const jv = await postEvent('unapplied.refund', { source: 'receipt', entryType: 'PAYMENT_RECEIPT', referenceType: 'Unapplied collection', referenceId: u.id, clientId: u.client_id,
    policyId: u.policy_id, date: await today(), amounts: { amount }, vars: { payer: client?.display_name || u.payer_name || 'client', reference: receipt?.receipt_number || u.reference_no || u.id } },
  { db, user });
  await db.query(`UPDATE unapplied_collections SET balance = 0, status = 'refunded', refund_journal_id = $2, refund_reason = $3, updated_by = $4, updated_at = now() WHERE id = $1`,
    [u.id, jv.id, reason.text, user.id]);
  return { item: await getUnapplied(db, u.id), message: `${await formatMoney(amount)} to refund to ${client?.display_name || 'the client'}` };
}

/** Reverse the holds of a receipt being cancelled (its applications, allocations included, are reversed by the receipt). */
export async function reverseHoldsOfReceipt(db, receiptId, user) {
  const holds = (await db.query("SELECT * FROM unapplied_collections WHERE receipt_id = $1 AND status IN ('open', 'allocated') FOR UPDATE", [receiptId])).rows;
  for (const h of holds) {
    if (h.journal_id) await reverseJournal(db, h.journal_id, user, { description: 'Cancellation of the receipt holding this amount' });
    await db.query("UPDATE unapplied_allocations SET status = 'reversed' WHERE unapplied_id = $1", [h.id]);
    await db.query("UPDATE unapplied_collections SET status = 'reversed', balance = 0, updated_by = $2, updated_at = now() WHERE id = $1", [h.id, user?.id ?? null]);
  }
  return holds.length;
}

/** A floating or advance payment recorded in error, nothing allocated yet: its journal reversed. */
export async function reverseUnapplied(db, id, b, user) {
  const u = await lockOpen(db, id);
  if (u.receipt_id) throw conflict('This amount belongs to a receipt; reverse the receipt instead');
  if (round2(u.balance) !== round2(u.amount)) throw conflict('Part of this amount is allocated; it cannot be reversed');
  const reason = await requiredReason(db, 'receipt_reversal', { reasonCode: b.reasonCode, note: b.note });
  if (u.journal_id) await reverseJournal(db, u.journal_id, user, { description: `Reversal of an unapplied collection: ${reason.text}` });
  await db.query(`UPDATE unapplied_collections SET status = 'reversed', balance = 0, refund_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1`, [u.id, reason.text, user.id]);
  return { item: await getUnapplied(db, u.id), message: 'Unapplied collection reversed' };
}
