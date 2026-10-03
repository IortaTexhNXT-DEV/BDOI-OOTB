/**
 * Official receipts: a header with receipt lines (one per policy / payment). A line with status Paid applies its paid
 * amount (delta against what was already applied) to the policy's receivables and posts Dr Cash / Cr Premium Receivable.
 * receiptStatus is Converted when every line is Paid, Draft otherwise, Cancelled after cancellation (all reversed).
 */
import { getSetting } from '../../lib/settings.js';
import { baseCurrency } from '../../lib/currency.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { isoDate, num, round2, str, today } from '../accounting/lib/http.js';
import { applyToPolicy, ensureBilled, findClient, findPolicy, requirePolicy, reverseReceiptApplications } from './receivables.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { autoEmailReceipt } from './email.js';

const money = (v) => round2(v).toFixed(2);
const SOURCE_BY_TXN = { ENDORSEMENT_PAYMENT: 'endorsement', ENDORSEMENT: 'endorsement', RENEWAL: 'renewal', RENEWAL_PAYMENT: 'renewal' };

/** Payment modes of a receipt (also the receipt schema of the router). */
export const PAYMENT_MODES = ['cash', 'check', 'bank-transfer', 'card', 'gcash', 'online'];

/**
 * Columns of the receipt bulk upload (Accounts > Receipts > Bulk upload); header names are read camel-cased
 * ("Policy Number" -> policyNumber). The upload template is built from this list.
 */
export const RECEIPT_UPLOAD_COLUMNS = [
  { key: 'policyNumber', header: 'Policy Number', aliases: ['policyNo', 'policy'], required: true, format: 'Policy number of an issued, broker-billed policy with an open bill', example: 'PC-MLY-2026-000101' },
  { key: 'amount', header: 'Amount', required: true, format: 'Amount received in PHP, greater than zero', example: '35946.88' },
  { key: 'receiptDate', header: 'Receipt Date', aliases: ['date'], format: 'Date YYYY-MM-DD; today when empty (must be in an open period)', example: '2026-10-05' },
  { key: 'paymentMode', header: 'Payment Mode', format: 'The default payment mode when empty', allowed: PAYMENT_MODES, example: 'bank-transfer' },
  { key: 'referenceNo', header: 'Reference No', aliases: ['reference'], format: 'Deposit slip, cheque or transfer reference', example: 'BDO-778812' },
  { key: 'customerCode', header: 'Customer Code', format: 'Client code (CL-...); taken from the policy when empty', example: '' },
  { key: 'transactionCode', header: 'Transaction Code', format: 'Transaction code master; the receipt default when empty', example: '' },
  { key: 'remarks', header: 'Remarks', format: 'Text', example: 'Full payment, first installment' },
];

export const lineRow = (l) => ({
  receiptListId: l.id, id: l.id, lineNo: l.line_no, policies: l.policy_number, policyId: l.policy_id, netPremium: money(l.net_premium), paid: money(l.paid),
  unPaid: money(l.un_paid), discounts: money(l.discounts), dst: money(l.dst), lgt: money(l.lgt), vat: money(l.vat), ewt: money(l.ewt), other: money(l.other),
  fcAmount: money(l.fc_amount), lcAmount: money(l.lc_amount), status: l.status, appliedAmount: money(l.applied_amount),
});
export function receiptRow(r, lines = []) {
  return {
    receiptId: r.id, id: r.id, receiptNumber: r.receipt_number, receiptType: r.receipt_type, receiptDate: r.received_date, branchCode: r.branch_code,
    departmentCode: r.department_code, customerCode: r.customer_code, currencyCode: r.currency_code, transactionCode: r.transaction_code,
    transactionNumber: r.transaction_number, remarks: r.remarks, name: r.customer_name, policyRefId: r.policy_id, policyNumber: r.policy_number,
    receiptStatus: r.receipt_status, status: r.status, amount: Number(r.amount), paymentMode: r.payment_mode, referenceNo: r.reference_no, bankId: r.bank_id,
    receivableId: r.receivable_id, clientId: r.client_id, clientEmail: r.client_email || null, externalRef: r.external_ref,
    policy: r.policy_id ? { policyId: r.policy_id, id: r.policy_id, policyNumber: r.policy_number, insurer: r.insurer_name || null, status: r.policy_status || null } : null,
    receiptsList: lines.map(lineRow), createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at, cancelledAt: r.cancelled_at, cancelReason: r.cancel_reason,
  };
}

const HEADER_SQL = `SELECT r.*, p.status AS policy_status, ic.name AS insurer_name, cl.email AS client_email FROM receipts r LEFT JOIN policies p ON p.id = r.policy_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN clients cl ON cl.id = r.client_id`;
const linesOf = async (db, ids) => {
  if (!ids.length) return new Map();
  const rows = (await db.query('SELECT * FROM receipt_lines WHERE receipt_id = ANY($1) ORDER BY receipt_id, line_no', [ids])).rows;
  const m = new Map();
  for (const l of rows) m.set(l.receipt_id, [...(m.get(l.receipt_id) || []), l]);
  return m;
};

export async function getReceipt(db, ref) {
  const r = (await db.query(`${HEADER_SQL} WHERE r.id = $1 OR r.receipt_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Receipt not found');
  return receiptRow(r, (await linesOf(db, [r.id])).get(r.id) || []);
}

/** List / search with filters (customerCode, name, transactionNumber, transactionCode, receiptNumber, policyId, policyNumber, receiptStatus, fromDate, toDate, search). */
export async function listReceipts(db, q, pg, { like = true } = {}) {
  const where = []; const p = [];
  const add = (col, v, exact = !like) => { if (v === undefined || v === null || v === '') return; p.push(v); where.push(exact ? `${col} = $${p.length}` : `${col} ILIKE '%' || $${p.length} || '%'`); };
  add('r.customer_code', q.customerCode); add('r.customer_name', q.name || q.customerName); add('r.transaction_number', q.transactionNumber);
  add('r.transaction_code', q.transactionCode); add('r.receipt_number', q.receiptNumber); add('r.policy_number', q.policyNumber);
  add('r.policy_id', q.policyId || q.policyRefId, true); add('r.receipt_status', q.receiptStatus, true); add('r.client_id', q.clientId, true);
  if (q.fromDate) { p.push(isoDate(q.fromDate)); where.push(`r.received_date >= $${p.length}`); }
  if (q.toDate) { p.push(isoDate(q.toDate)); where.push(`r.received_date <= $${p.length}`); }
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'receipt', 'r', p));
  if (q.search) { p.push(q.search); where.push(`(r.receipt_number || ' ' || COALESCE(r.customer_name,'') || ' ' || COALESCE(r.customer_code,'') || ' ' || COALESCE(r.policy_number,'') || ' ' || COALESCE(r.transaction_number,'')) ILIKE '%' || $${p.length} || '%'`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM receipts r ${w}`, p)).rows[0].n;
  const rows = (await db.query(`${HEADER_SQL} ${w} ORDER BY r.received_date DESC, r.created_at DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, pg.limit, pg.offset])).rows;
  const lines = await linesOf(db, rows.map((r) => r.id));
  return { rows: rows.map((r) => receiptRow(r, lines.get(r.id) || [])), total };
}

const lineValues = (l) => ({
  net_premium: round2(num(l.netPremium)), paid: round2(num(l.paid)), un_paid: round2(num(l.unPaid)), discounts: round2(num(l.discounts)), dst: round2(num(l.dst)),
  lgt: round2(num(l.lgt)), vat: round2(num(l.vat)), ewt: round2(num(l.ewt)), other: round2(num(l.other)), fc_amount: round2(num(l.fcAmount)), lc_amount: round2(num(l.lcAmount)),
  status: String(l.status || 'Pending').toLowerCase() === 'paid' ? 'Paid' : 'Pending',
});
const breakdownOf = (l) => ({ netPremium: Number(l.net_premium), vat: Number(l.vat), dst: Number(l.dst), lgt: Number(l.lgt), other: Number(l.other), discount: Number(l.discounts) });

async function insertLine(db, receipt, n, l, policy) {
  const v = lineValues(l);
  if (v.status === 'Paid' && !(v.paid > 0)) v.paid = v.lc_amount;
  return (await db.query(`INSERT INTO receipt_lines(receipt_id, line_no, policy_id, policy_number, net_premium, paid, un_paid, discounts, dst, lgt, vat, ewt, other, fc_amount, lc_amount, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
  [receipt.id, n, policy?.id || null, policy?.policy_number || str(l.policies), v.net_premium, v.paid, v.un_paid, v.discounts, v.dst, v.lgt, v.vat, v.ewt, v.other, v.fc_amount, v.lc_amount, v.status])).rows[0];
}

async function linePolicy(db, l, header) {
  const ref = l.policyId || (l.policies && l.policies !== 'N/A' ? l.policies : null);
  return (ref && await findPolicy(db, ref)) || (header.policy_id ? await findPolicy(db, header.policy_id) : null);
}

/** Apply what a line newly pays, or bill a pending line's policy when it has no receivable yet. receivableId pins the payment to one bill. */
async function processLine(db, receipt, line, user, receivableId = null) {
  const source = SOURCE_BY_TXN[String(receipt.transaction_code || '').toUpperCase()] || 'policy';
  if (line.status === 'Paid') {
    const delta = round2(Number(line.paid) - Number(line.applied_amount));
    if (delta < 0) throw conflict(`Line ${line.line_no}: paid amount cannot be reduced below the ${line.applied_amount} already applied; cancel the receipt instead`);
    if (delta === 0) return;
    if (!line.policy_id) throw badRequest(`Line ${line.line_no}: policy ${line.policy_number || ''} not found`);
    const policy = await requirePolicy(db, line.policy_id);
    await applyToPolicy(db, { policy, amount: delta, billAmount: Number(line.lc_amount), breakdown: breakdownOf(line), source, receipt, lineId: line.id, receivableId,
      paymentMode: receipt.payment_mode, referenceNo: receipt.reference_no, date: receipt.received_date, user });
    await db.query('UPDATE receipt_lines SET applied_amount = paid, updated_at = now() WHERE id = $1', [line.id]);
  } else if (line.policy_id && Number(line.lc_amount) > 0) {
    const policy = await requirePolicy(db, line.policy_id);
    await ensureBilled(db, { policy, amount: Number(line.lc_amount), breakdown: breakdownOf(line), source, user });
  }
}

async function refreshHeader(db, id) {
  const lines = (await db.query('SELECT * FROM receipt_lines WHERE receipt_id = $1', [id])).rows;
  const allPaid = lines.length > 0 && lines.every((l) => l.status === 'Paid');
  const amount = round2(lines.reduce((s, l) => s + Number(l.paid), 0));
  const first = (await db.query('SELECT receivable_id FROM receipt_applications WHERE receipt_id = $1 ORDER BY id LIMIT 1', [id])).rows[0];
  await db.query('UPDATE receipts SET amount = $2, receipt_status = $3, receivable_id = COALESCE(receivable_id, $4), updated_at = now() WHERE id = $1 AND receipt_status <> \'Cancelled\'',
    [id, amount, allPaid ? 'Converted' : 'Draft', first?.receivable_id || null]);
}

/** Normalise the two request shapes: the front-end receiptsList form, or a simple OR against a receivable / policy. */
async function linesFromSimple(db, b) {
  if (b.receiptsList?.length) return b.receiptsList;
  const policyRef = b.policyRefId || b.policyId || b.policyNumber;
  if (b.receivableId) {
    // Payment against one bill: lock it, then refuse zero, excess and payments for another customer / policy.
    const rcv = (await db.query('SELECT * FROM receivables WHERE id = $1 OR bill_number = $1 FOR UPDATE', [b.receivableId])).rows[0];
    if (!rcv) throw notFound('Receivable not found');
    const amount = round2(num(b.amount));
    if (!(amount > 0)) throw badRequest('Amount received must be greater than zero');
    if (Number(rcv.balance) <= 0 || !['open', 'partial'].includes(rcv.status)) throw conflict(`Receivable ${rcv.bill_number} is already fully paid`);
    if (amount > round2(rcv.balance)) throw badRequest(`Amount ${amount.toFixed(2)} exceeds the outstanding balance of bill ${rcv.bill_number} (${round2(rcv.balance).toFixed(2)})`);
    const policy = await requirePolicy(db, rcv.policy_id);
    const other = b.policyRefId || b.policyId || b.policyNumber;
    if (other && other !== policy.id && other !== policy.policy_number) throw badRequest(`Bill ${rcv.bill_number} belongs to policy ${policy.policy_number}`);
    const client = b.customerCode ? await findClient(db, b.customerCode) : null;
    if (b.customerCode && (!client || client.id !== rcv.client_id)) throw badRequest(`Bill ${rcv.bill_number} does not belong to customer ${b.customerCode}`);
    const balance = round2(rcv.balance);
    return [{ policyId: policy.id, policies: policy.policy_number, receivableId: rcv.id, lcAmount: balance, netPremium: Number(rcv.net_premium) || balance,
      paid: amount, unPaid: round2(balance - amount), status: 'Paid' }];
  }
  if (!policyRef) throw badRequest('Provide receiptsList, receivableId or policyId');
  if (!(num(b.amount) > 0)) throw badRequest('amount must be greater than zero');
  const policy = await requirePolicy(db, policyRef);
  const billed = (await db.query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [policy.id])).rows[0].n > 0;
  const lc = billed ? num(b.amount) : Math.max(num(b.amount), Number(policy.premium_total));
  return [{ policyId: policy.id, policies: policy.policy_number, lcAmount: lc, netPremium: billed ? b.amount : (policy.details?.netPremium ?? lc), paid: b.amount, unPaid: round2(lc - num(b.amount)), status: 'Paid' }];
}

export async function createReceipt(db, b, user, { source = 'api' } = {}) {
  const lines = await linesFromSimple(db, b);
  let policy = await findPolicy(db, b.policyRefId || b.policyId || lines[0]?.policyId || (lines[0]?.policies !== 'N/A' ? lines[0]?.policies : null));
  if (!policy && lines[0]?.receivableId) policy = await findPolicy(db, lines[0].policyId);
  const client = await findClient(db, b.customerCode) || (policy?.client_id ? await findClient(db, policy.client_id) : null);
  if (!client && !policy) throw badRequest('customerCode or policy is required');
  const number = await nextDocumentNumber('receipt', { db, unique: { table: 'receipts', column: 'receipt_number' } });
  const txn = b.transactionNumber || await nextDocumentNumber('receipt_txn', { db });
  const header = (await db.query(`INSERT INTO receipts(receipt_number, policy_id, client_id, amount, payment_mode, reference_no, bank_id, received_date, status, remarks, created_by,
      receipt_type, receipt_status, transaction_code, transaction_number, customer_code, customer_name, branch_code, department_code, currency_code, policy_number, external_ref, source)
    VALUES ($1,$2,$3,0,$4,$5,$6,$7,'posted',$8,$9,$10,'Draft',$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
  [number, policy?.id || null, client?.id || policy?.client_id || null, b.paymentMode || (await getSetting('receipts.default_payment_mode', 'bank-transfer')), str(b.referenceNo),
    b.bankId || null, isoDate(b.receiptDate || b.receivedDate) || (await today()), str(b.remarks), user?.id ?? null, b.receiptType || 'Payment', str(b.transactionCode) || 'PAYMENT', txn,
    client?.client_code || client?.id || str(b.customerCode), str(b.name) || client?.display_name || policy?.client_name || null, str(b.branchCode), str(b.departmentCode),
    b.currencyCode || (await baseCurrency()), policy?.policy_number || null, str(b.receiptNumber), source])).rows[0];
  // the bank account the money was deposited to: its GL account is debited (posting rule receipt.apply, resolver bank_account)
  if (str(b.bankAccountCode ?? b.bankAccount)) {
    header.bank_account_code = str(b.bankAccountCode ?? b.bankAccount);
    await db.query('UPDATE receipts SET bank_account_code = $2 WHERE id = $1', [header.id, header.bank_account_code]);
  }
  let n = 0;
  for (const l of lines) {
    n += 1;
    const line = await insertLine(db, header, n, l, await linePolicy(db, l, header));
    await processLine(db, header, line, user, l.receivableId || null);
  }
  await refreshHeader(db, header.id);
  await autoEmailReceipt(db, header.id);
  return getReceipt(db, header.id);
}

const HEADER_FIELDS = { receiptType: 'receipt_type', branchCode: 'branch_code', departmentCode: 'department_code', currencyCode: 'currency_code', transactionCode: 'transaction_code',
  remarks: 'remarks', transactionNumber: 'transaction_number', name: 'customer_name', paymentMode: 'payment_mode', referenceNo: 'reference_no', bankId: 'bank_id' };

export async function updateReceipt(db, id, b, user) {
  const r = (await db.query('SELECT * FROM receipts WHERE id = $1 OR receipt_number = $1 FOR UPDATE', [id])).rows[0];
  if (!r) throw notFound('Receipt not found');
  if (r.receipt_status === 'Cancelled') throw conflict('Receipt is cancelled');
  const before = await getReceipt(db, r.id);
  const sets = []; const p = [r.id];
  for (const [k, col] of Object.entries(HEADER_FIELDS)) if (b[k] !== undefined && b[k] !== null) { p.push(b[k]); sets.push(`${col} = $${p.length}`); }
  if (b.receiptDate) { p.push(isoDate(b.receiptDate)); sets.push(`received_date = $${p.length}`); }
  p.push(user.id); sets.push(`updated_by = $${p.length}`, 'updated_at = now()');
  await db.query(`UPDATE receipts SET ${sets.join(', ')} WHERE id = $1`, p);
  const header = (await db.query('SELECT * FROM receipts WHERE id = $1', [r.id])).rows[0];
  if (Array.isArray(b.receiptsList)) {
    const existing = (await db.query('SELECT * FROM receipt_lines WHERE receipt_id = $1 ORDER BY line_no FOR UPDATE', [r.id])).rows;
    let n = existing.length;
    for (const [i, l] of b.receiptsList.entries()) {
      const cur = (l.receiptListId && existing.find((e) => e.id === l.receiptListId)) || (!l.receiptListId && existing[i]) || null;
      if (!cur) {
        n += 1;
        const line = await insertLine(db, header, n, l, await linePolicy(db, l, header));
        await processLine(db, header, line, user);
        continue;
      }
      const v = lineValues({ ...lineRow(cur), ...l });
      if (cur.status === 'Paid' && v.status === 'Pending') throw conflict(`Line ${cur.line_no} is already paid`);
      if (v.status === 'Paid' && !(v.paid > 0)) v.paid = v.lc_amount;
      const line = (await db.query(`UPDATE receipt_lines SET net_premium = $2, paid = $3, un_paid = $4, discounts = $5, dst = $6, lgt = $7, vat = $8, ewt = $9, other = $10,
        fc_amount = $11, lc_amount = $12, status = $13, updated_at = now() WHERE id = $1 RETURNING *`,
      [cur.id, v.net_premium, v.paid, v.un_paid, v.discounts, v.dst, v.lgt, v.vat, v.ewt, v.other, v.fc_amount, v.lc_amount, v.status])).rows[0];
      await processLine(db, header, line, user);
    }
  }
  await refreshHeader(db, r.id);
  await autoEmailReceipt(db, r.id);
  return { before, after: await getReceipt(db, r.id) };
}

/** Append a paid line to an existing receipt (partial / additional payment). */
export async function addPayment(db, id, b, user) {
  const r = (await db.query('SELECT * FROM receipts WHERE id = $1 OR receipt_number = $1', [id])).rows[0];
  if (!r) throw notFound('Receipt not found');
  const amount = num(b.amount ?? b.paid);
  if (!(amount > 0)) throw badRequest('amount must be greater than zero');
  const cur = (await db.query('SELECT * FROM receipt_lines WHERE receipt_id = $1 ORDER BY line_no', [r.id])).rows;
  const list = [...cur.map((l) => ({ receiptListId: l.id })), { policies: b.policies || r.policy_number, policyId: b.policyId || r.policy_id, lcAmount: b.lcAmount ?? amount,
    netPremium: b.netPremium ?? amount, paid: amount, unPaid: b.unPaid ?? 0, status: 'Paid' }];
  return updateReceipt(db, r.id, { receiptsList: list, paymentMode: b.paymentMode, referenceNo: b.referenceNo }, user);
}

export async function cancelReceipt(db, id, reason, user) {
  const r = (await db.query('SELECT * FROM receipts WHERE id = $1 OR receipt_number = $1 FOR UPDATE', [id])).rows[0];
  if (!r) throw notFound('Receipt not found');
  if (r.receipt_status === 'Cancelled') throw conflict('Receipt is already cancelled');
  const before = await getReceipt(db, r.id);
  await reverseReceiptApplications(db, r, user);
  await db.query('UPDATE receipt_lines SET applied_amount = 0, updated_at = now() WHERE receipt_id = $1', [r.id]);
  await db.query(`UPDATE receipts SET receipt_status = 'Cancelled', status = 'cancelled', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3, updated_at = now() WHERE id = $1`, [r.id, user.id, reason || null]);
  return { before, after: await getReceipt(db, r.id) };
}

/**
 * Open (unpaid / partially paid) premium receivables for Accounts > Receipts > Add receipt: every customer with a bill
 * to collect, the policies behind them and each bill's balance. Filters: customerCode (client code or id), policyNumber
 * (number or id), search; scoped users see the bills of policies they may see.
 */
export async function listOpenReceivables(db, q = {}) {
  const p = []; const where = ['r.balance > 0', 'r.status IN (\'open\',\'partial\')'];
  if (q.customerCode) { p.push(String(q.customerCode)); where.push(`(c.client_code = $${p.length} OR c.id = $${p.length})`); }
  if (q.policyNumber || q.policyId) { p.push(String(q.policyNumber || q.policyId)); where.push(`(p.policy_number = $${p.length} OR p.id = $${p.length})`); }
  if (q.search) { p.push(String(q.search)); where.push(`(COALESCE(c.client_code,'') || ' ' || COALESCE(c.display_name,'') || ' ' || COALESCE(p.policy_number,'') || ' ' || COALESCE(r.bill_number,'')) ILIKE '%' || $${p.length} || '%'`); }
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'policy', 'p', p));
  const limit = Math.min(Math.max(Number(q.limit) || 500, 1), 2000);
  const rows = (await db.query(`SELECT r.*, p.policy_number, c.client_code, c.display_name, c.first_name, c.last_name
    FROM receivables r JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = COALESCE(r.client_id, p.client_id)
    WHERE ${where.join(' AND ')} ORDER BY c.client_code, p.policy_number, r.due_date, r.created_at LIMIT ${limit}`, p)).rows;
  return rows.map((r) => ({
    receivableId: r.id, billNumber: r.bill_number, source: r.source, reference: r.reference, customerCode: r.client_code || r.client_id, clientId: r.client_id,
    customerName: r.display_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || null, policyId: r.policy_id, policyNumber: r.policy_number,
    amount: Number(r.amount), paidAmount: round2(Number(r.amount) - Number(r.balance)), balance: Number(r.balance), dueDate: r.due_date,
    status: r.status === 'partial' ? 'Partial' : 'Open', currency: r.currency,
  }));
}
