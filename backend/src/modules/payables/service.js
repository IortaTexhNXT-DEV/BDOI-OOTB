/**
 * Accounts payable sub-ledger (Accounts > Payables).
 *
 * Supplier invoices: supplier (master supplier: TIN, VAT registration, EWT tax code, payment terms, default expense
 * account), the supplier's invoice number and date, lines on expense (or asset) accounts. Input VAT is computed on the
 * vatable lines of a VAT-registered supplier at the rate of payables.input_vat_code; the expanded withholding tax at the
 * rate of the supplier's EWT tax code on the amount net of VAT. The supplier is paid the gross less the EWT.
 * draft -> for-approval -> approved (posted: posting rule ap.invoice) -> partially-paid -> paid; rejected; cancelled
 * (an approved invoice without payments is cancelled with the reversal of its journal). With payables.maker_checker the
 * approver (approve:payables) is not the preparer. A line with an asset class is capitalised: the fixed asset is
 * registered when the invoice is approved.
 * Supplier payments settle one or more open invoices of a supplier (posting rule ap.payment) and can be cancelled
 * (journal reversed, invoices open again). The AP ageing ages the open balances on their due dates.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, postingDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { buildJournal, postEvent } from '../accounting/lib/posting.js';
import { createJournal, reverseJournal } from '../accounting/lib/ledger.js';
import { activeRecord } from '../ops-masters/records.js';

const EPS = 0.005;

export async function supplierOf(db, ref) {
  const s = await activeRecord(db, 'supplier', ref);
  if (!s) throw badRequest('Validation failed', [{ path: 'supplierId', message: `Supplier ${ref} is not an active supplier of the Supplier master` }]);
  return s;
}

async function taxCode(db, code, type) {
  if (!code) return null;
  const t = (await db.query('SELECT * FROM tax_codes WHERE code = $1 AND active', [code])).rows[0];
  if (!t) throw badRequest('Validation failed', [{ path: type === 'EWT' ? 'ewtCode' : 'vatCode', message: `Tax code ${code} is not an active tax code` }]);
  if (t.tax_type !== type) throw badRequest('Validation failed', [{ path: type === 'EWT' ? 'ewtCode' : 'vatCode', message: `Tax code ${code} is not a ${type} code` }]);
  return t;
}

const SELECT = `SELECT i.*, m.code AS supplier_code, m.name AS supplier_name, m.data->>'tin' AS supplier_tin, j.jv_number,
  (SELECT u.display_name FROM users u WHERE u.id = i.created_by) AS created_by_name, (SELECT u.display_name FROM users u WHERE u.id = i.approved_by) AS approved_by_name
  FROM supplier_invoices i JOIN master_records m ON m.id = i.supplier_id LEFT JOIN journal_vouchers j ON j.id = i.journal_id`;

const invoiceOut = (r, lines = []) => r && ({
  id: r.id, voucherNumber: r.voucher_number, supplierId: r.supplier_id, supplierCode: r.supplier_code, supplierName: r.supplier_name, supplierTin: r.supplier_tin || null,
  supplierInvoiceNo: r.supplier_invoice_no, invoiceDate: isoDate(r.invoice_date), dueDate: isoDate(r.due_date), receivedDate: isoDate(r.received_date), description: r.description,
  currency: r.currency, vatCode: r.vat_code, ewtCode: r.ewt_code, netAmount: Number(r.net_amount), inputVat: Number(r.input_vat), grossAmount: Number(r.gross_amount),
  ewtRate: Number(r.ewt_rate), ewtAmount: Number(r.ewt_amount), payableAmount: Number(r.payable_amount), paidAmount: Number(r.paid_amount), balance: Number(r.balance), status: r.status,
  journalId: r.journal_id, journalNumber: r.jv_number || null, createdBy: r.created_by_name || r.created_by, createdById: r.created_by, approvedBy: r.approved_by_name || r.approved_by,
  approvedAt: r.approved_at, rejectReason: r.reject_reason, cancelReason: r.cancel_reason, createdAt: r.created_at,
  lines: lines.map((l) => ({ id: Number(l.id), lineNo: l.line_no, description: l.description, accountCode: l.account_code, accountName: l.account_name || null, amount: Number(l.amount),
    vatable: l.vatable, vatAmount: Number(l.vat_amount), assetClass: l.asset_class, fixedAssetId: l.fixed_asset_id })),
});

export async function getInvoice(db, ref) {
  const r = (await db.query(`${SELECT} WHERE i.id = $1 OR i.voucher_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Supplier invoice not found');
  const lines = (await db.query(`SELECT l.*, g.name AS account_name FROM supplier_invoice_lines l LEFT JOIN gl_accounts g ON g.code = l.account_code
    WHERE l.invoice_id = $1 ORDER BY l.line_no`, [r.id])).rows;
  return invoiceOut(r, lines);
}

/** Supplier invoices (status, supplierId, search, open = approved or partly paid with a balance). */
export async function listInvoices(db, q = {}) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status === 'open') where.push("i.status IN ('approved', 'partially-paid') AND i.balance > 0");
  else if (q.status && q.status !== 'all') add('i.status = ?', q.status);
  if (q.supplierId) add('(i.supplier_id::text = ? OR lower(m.code) = lower(?))', String(q.supplierId));
  if (q.search) add(`(i.voucher_number ILIKE '%' || ? || '%' OR i.supplier_invoice_no ILIKE '%' || ? || '%' OR m.name ILIKE '%' || ? || '%' OR i.description ILIKE '%' || ? || '%')`, q.search);
  return (await db.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY i.invoice_date DESC, i.voucher_number DESC LIMIT 1000`, params)).rows.map((r) => invoiceOut(r));
}

/** Figures of an invoice from its lines: VAT per vatable line, EWT on the net amount. */
async function figures(db, supplier, b) {
  const vatCode = supplier.vatRegistered === false ? null : (b.vatCode || (await getSetting('payables.input_vat_code', 'VAT12-IN')));
  const vat = await taxCode(db, vatCode, 'VAT');
  const ewt = await taxCode(db, b.ewtCode === undefined ? supplier.ewtCode || null : b.ewtCode || null, 'EWT');
  if (!Array.isArray(b.lines) || !b.lines.length) throw badRequest('Validation failed', [{ path: 'lines', message: 'An invoice needs at least one line' }]);
  const lines = [];
  for (const [i, l] of b.lines.entries()) {
    let account = String(l.accountCode || supplier.expenseAccount || '').trim();
    if (l.assetClass) {
      const cls = await activeRecord(db, 'asset-class', l.assetClass);
      if (!cls) throw badRequest('Validation failed', [{ path: `lines[${i}].assetClass`, message: `Asset class ${l.assetClass} is not active` }]);
      account = cls.assetAccount;
    }
    const amount = round2(l.amount);
    if (!(amount > 0)) throw badRequest('Validation failed', [{ path: `lines[${i}].amount`, message: 'Amount must be greater than zero' }]);
    if (!account) throw badRequest('Validation failed', [{ path: `lines[${i}].accountCode`, message: 'Choose the expense account' }]);
    const vatable = vat ? l.vatable !== false : false;
    lines.push({ description: String(l.description || b.description || '').trim() || 'Supplier invoice', accountCode: account, amount, vatable,
      vatAmount: vatable ? round2((amount * Number(vat.rate)) / 100) : 0, assetClass: l.assetClass || null });
  }
  const codes = [...new Set(lines.map((l) => l.accountCode))];
  const known = new Set((await db.query('SELECT code FROM gl_accounts WHERE code = ANY($1) AND status = \'active\'', [codes])).rows.map((r) => r.code));
  const unknown = codes.filter((c) => !known.has(c));
  if (unknown.length) throw badRequest('Validation failed', [{ path: 'lines', message: `Unknown or inactive GL account(s): ${unknown.join(', ')}` }]);
  const net = round2(lines.reduce((s, l) => s + l.amount, 0));
  const inputVat = round2(lines.reduce((s, l) => s + l.vatAmount, 0));
  const ewtRate = ewt ? Number(ewt.rate) : 0;
  const ewtAmount = round2((net * ewtRate) / 100);
  const gross = round2(net + inputVat);
  return { lines, vat, ewt, net, inputVat, gross, ewtRate, ewtAmount, payable: round2(gross - ewtAmount) };
}

/** Record a supplier invoice (draft, or submitted at once with submit: true). */
export async function createInvoice(db, b, user) {
  const supplier = await supplierOf(db, b.supplierId);
  const f = await figures(db, supplier, b);
  const invoiceDate = isoDate(b.invoiceDate);
  if (!invoiceDate) throw badRequest('Validation failed', [{ path: 'invoiceDate', message: 'Invoice date is required' }]);
  const terms = Number(supplier.paymentTermsDays ?? (await getSetting('payables.default_terms_days', 30))) || 0;
  const dup = (await db.query(`SELECT voucher_number FROM supplier_invoices WHERE supplier_id = $1 AND lower(supplier_invoice_no) = lower($2) AND status NOT IN ('cancelled', 'rejected')`,
    [supplier.id, String(b.supplierInvoiceNo).trim()])).rows[0];
  if (dup) throw conflict(`Invoice ${b.supplierInvoiceNo} of ${supplier.name} is already recorded as ${dup.voucher_number}`);
  const number = await nextDocumentNumber('supplier_invoice', { db, unique: { table: 'supplier_invoices', column: 'voucher_number' } });
  const inv = (await db.query(`INSERT INTO supplier_invoices(voucher_number, supplier_id, supplier_invoice_no, invoice_date, due_date, received_date, description, currency, vat_code, ewt_code,
      net_amount, input_vat, gross_amount, ewt_rate, ewt_amount, payable_amount, balance, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17,$17) RETURNING id`,
  [number, supplier.id, String(b.supplierInvoiceNo).trim(), invoiceDate, isoDate(b.dueDate) || addDays(invoiceDate, terms), isoDate(b.receivedDate) || null, b.description || null,
    await getSetting('currency.default', 'PHP'), f.vat?.code || null, f.ewt?.code || null, f.net, f.inputVat, f.gross, f.ewtRate, f.ewtAmount, f.payable, user?.id ?? null])).rows[0];
  for (const [i, l] of f.lines.entries()) {
    await db.query(`INSERT INTO supplier_invoice_lines(invoice_id, line_no, description, account_code, amount, vatable, vat_amount, asset_class) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [inv.id, i + 1, l.description, l.accountCode, l.amount, l.vatable, l.vatAmount, l.assetClass]);
  }
  if (b.submit) return submitInvoice(db, inv.id, user);
  return getInvoice(db, inv.id);
}

async function lockInvoice(db, id) {
  const r = (await db.query('SELECT * FROM supplier_invoices WHERE id = $1 OR voucher_number = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!r) throw notFound('Supplier invoice not found');
  return r;
}

/** Submit for approval; without payables.maker_checker the invoice is approved and posted at once. */
export async function submitInvoice(db, id, user) {
  const inv = await lockInvoice(db, id);
  if (!['draft', 'rejected'].includes(inv.status)) throw conflict(`Invoice ${inv.voucher_number} is ${inv.status}`);
  if ((await getSetting('payables.maker_checker', true)) === false) {
    await db.query('UPDATE supplier_invoices SET submitted_by = $2, submitted_at = now() WHERE id = $1', [inv.id, user?.id ?? null]);
    return approveInvoice(db, inv.id, user, { skipChecker: true });
  }
  await db.query('UPDATE supplier_invoices SET status = \'for-approval\', submitted_by = $2, submitted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1', [inv.id, user?.id ?? null]);
  return getInvoice(db, inv.id);
}

/** The ap.invoice journal: the rule's expense line is split over the accounts of the invoice lines. */
async function postInvoice(db, inv, lines, user) {
  const vatGl = inv.vat_code ? (await db.query('SELECT gl_account FROM tax_codes WHERE code = $1', [inv.vat_code])).rows[0]?.gl_account : null;
  const ewtGl = inv.ewt_code ? (await db.query('SELECT gl_account FROM tax_codes WHERE code = $1', [inv.ewt_code])).rows[0]?.gl_account : null;
  const supplier = (await db.query('SELECT name FROM master_records WHERE id = $1', [inv.supplier_id])).rows[0];
  const ctx = {
    date: await postingDate(isoDate(inv.invoice_date)), source: 'payables', entryType: 'AP_INVOICE', transactionCode: inv.voucher_number,
    referenceType: 'SupplierInvoice', referenceId: inv.id, dueDate: isoDate(inv.due_date), description: `Supplier invoice ${inv.supplier_invoice_no} – ${supplier.name} (${inv.voucher_number})`,
    amounts: { net: Number(inv.net_amount), vat: Number(inv.input_vat), ewt: Number(inv.ewt_amount), payable: Number(inv.payable_amount) },
    accounts: { expense: lines[0].account_code, ...(vatGl ? { vat: vatGl } : {}), ...(ewtGl ? { ewt: ewtGl } : {}) },
    vars: { supplierName: supplier.name, invoiceNo: inv.supplier_invoice_no, voucherNumber: inv.voucher_number },
  };
  const { rule, lines: built, header } = await buildJournal(db, 'ap.invoice', ctx, { user });
  const expenseLine = (await db.query('SELECT line_no FROM posting_rule_lines WHERE rule_id = $1 AND account_type = \'context\' AND account = \'expense\'', [rule.id])).rows[0]?.line_no;
  const byAccount = new Map();
  for (const l of lines) byAccount.set(l.account_code, round2((byAccount.get(l.account_code) || 0) + Number(l.amount)));
  const out = [];
  for (const l of built) {
    if (l.ruleLine !== expenseLine || byAccount.size === 1) { out.push(l); continue; }
    for (const [acct, amount] of byAccount) out.push({ ...l, accountCode: acct, debit: l.debit ? amount : 0, credit: l.credit ? amount : 0 });
  }
  const jv = await createJournal(db, { ...header, lines: out }, user);
  await db.query('UPDATE journal_vouchers SET posting_rule_id = $2 WHERE id = $1', [jv.id, rule.id]);
  return jv;
}

/** Approve and post (not by the preparer under maker-checker); asset lines are registered as fixed assets. */
export async function approveInvoice(db, id, user, { skipChecker = false } = {}) {
  const inv = await lockInvoice(db, id);
  if (!skipChecker && inv.status !== 'for-approval') throw conflict(`Invoice ${inv.voucher_number} is ${inv.status}; only an invoice for approval is approved`);
  if (!skipChecker) {
    await assertChecker(user, inv.created_by, 'supplier invoice');
    await assertChecker(user, inv.submitted_by, 'supplier invoice');
  }
  const lines = (await db.query('SELECT * FROM supplier_invoice_lines WHERE invoice_id = $1 ORDER BY line_no', [inv.id])).rows;
  const jv = await postInvoice(db, inv, lines, user);
  await db.query(`UPDATE supplier_invoices SET status = 'approved', journal_id = $2, approved_by = $3, approved_at = now(), updated_by = $3, updated_at = now() WHERE id = $1`,
    [inv.id, jv.id, user?.id ?? null]);
  const { registerFromInvoiceLine } = await import('../fixed-assets/service.js');
  for (const l of lines.filter((x) => x.asset_class)) await registerFromInvoiceLine(db, inv, l, user);
  return getInvoice(db, inv.id);
}

export async function rejectInvoice(db, id, reason, user) {
  const inv = await lockInvoice(db, id);
  if (inv.status !== 'for-approval') throw conflict(`Invoice ${inv.voucher_number} is ${inv.status}`);
  await assertChecker(user, inv.submitted_by, 'supplier invoice');
  await db.query('UPDATE supplier_invoices SET status = \'rejected\', rejected_by = $2, rejected_at = now(), reject_reason = $3, updated_by = $2, updated_at = now() WHERE id = $1', [inv.id, user?.id ?? null, reason]);
  return getInvoice(db, inv.id);
}

/** Cancel a draft / rejected / for-approval invoice, or an approved one without payments (its journal is reversed). */
export async function cancelInvoice(db, id, reason, user) {
  const inv = await lockInvoice(db, id);
  if (['cancelled', 'paid', 'partially-paid'].includes(inv.status)) throw conflict(`Invoice ${inv.voucher_number} is ${inv.status} and cannot be cancelled`);
  if (inv.status === 'approved') {
    if (Number(inv.paid_amount) > EPS) throw conflict(`Invoice ${inv.voucher_number} has payments; cancel them first`);
    const assets = (await db.query('SELECT asset_number FROM fixed_assets f JOIN fixed_asset_depreciation d ON d.asset_id = f.id WHERE f.supplier_invoice_id = $1 LIMIT 1', [inv.id])).rows[0];
    if (assets) throw conflict(`Asset ${assets.asset_number} of this invoice is already depreciated`);
    if (inv.journal_id) await reverseJournal(db, inv.journal_id, user, { description: `Cancellation of supplier invoice ${inv.voucher_number}` });
    await db.query('DELETE FROM fixed_assets WHERE supplier_invoice_id = $1', [inv.id]);
  }
  await db.query('UPDATE supplier_invoices SET status = \'cancelled\', balance = 0, cancelled_by = $2, cancelled_at = now(), cancel_reason = $3, updated_by = $2, updated_at = now() WHERE id = $1',
    [inv.id, user?.id ?? null, reason]);
  return getInvoice(db, inv.id);
}

// ---------------------------------------------------------------- payments

const paymentOut = (p, allocations = []) => ({ id: p.id, paymentNumber: p.payment_number, supplierId: p.supplier_id, supplierCode: p.supplier_code, supplierName: p.supplier_name,
  paymentDate: isoDate(p.payment_date), paymentMode: p.payment_mode, payFromAccount: p.pay_from_account, chequeNumber: p.cheque_number, reference: p.reference, amount: Number(p.amount),
  status: p.status, journalId: p.journal_id, journalNumber: p.jv_number || null, remarks: p.remarks, createdBy: p.created_by_name || p.created_by, createdAt: p.created_at,
  cancelReason: p.cancel_reason, allocations: allocations.map((a) => ({ invoiceId: a.invoice_id, voucherNumber: a.voucher_number, supplierInvoiceNo: a.supplier_invoice_no, amount: Number(a.amount) })) });
const PAY_SELECT = `SELECT p.*, m.code AS supplier_code, m.name AS supplier_name, j.jv_number, (SELECT u.display_name FROM users u WHERE u.id = p.created_by) AS created_by_name
  FROM supplier_payments p JOIN master_records m ON m.id = p.supplier_id LEFT JOIN journal_vouchers j ON j.id = p.journal_id`;

export async function getPayment(db, ref) {
  const p = (await db.query(`${PAY_SELECT} WHERE p.id = $1 OR p.payment_number = $1`, [String(ref)])).rows[0];
  if (!p) throw notFound('Supplier payment not found');
  const a = (await db.query(`SELECT a.*, i.voucher_number, i.supplier_invoice_no FROM supplier_payment_allocations a JOIN supplier_invoices i ON i.id = a.invoice_id WHERE a.payment_id = $1 ORDER BY i.due_date`, [p.id])).rows;
  return paymentOut(p, a);
}

export async function listPayments(db, q = {}) {
  const params = [];
  const where = ['TRUE'];
  if (q.supplierId) { params.push(String(q.supplierId)); where.push(`(p.supplier_id::text = $${params.length} OR lower(m.code) = lower($${params.length}))`); }
  if (q.search) { params.push(`%${q.search}%`); where.push(`(p.payment_number ILIKE $${params.length} OR m.name ILIKE $${params.length} OR p.cheque_number ILIKE $${params.length})`); }
  return (await db.query(`${PAY_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.payment_date DESC, p.payment_number DESC LIMIT 1000`, params)).rows.map((p) => paymentOut(p));
}

/** Pay open invoices of one supplier: allocations [{ invoiceId, amount }] (amount defaults to the invoice balance). */
export async function createPayment(db, b, user) {
  const supplier = await supplierOf(db, b.supplierId);
  if (!Array.isArray(b.allocations) || !b.allocations.length) throw badRequest('Validation failed', [{ path: 'allocations', message: 'Choose the invoices paid' }]);
  if (!b.payFromAccount) throw badRequest('Validation failed', [{ path: 'payFromAccount', message: 'Choose the bank account paid from' }]);
  const allocations = [];
  for (const [i, a] of b.allocations.entries()) {
    const inv = await lockInvoice(db, a.invoiceId);
    if (inv.supplier_id !== supplier.id) throw badRequest('Validation failed', [{ path: `allocations[${i}].invoiceId`, message: `Invoice ${inv.voucher_number} is not of ${supplier.name}` }]);
    if (!['approved', 'partially-paid'].includes(inv.status)) throw conflict(`Invoice ${inv.voucher_number} is ${inv.status}; only approved invoices are paid`);
    const amount = round2(a.amount ?? inv.balance);
    if (!(amount > 0) || amount > Number(inv.balance) + EPS) throw badRequest('Validation failed', [{ path: `allocations[${i}].amount`, message: `Pay between 0.01 and the balance ${Number(inv.balance).toFixed(2)} of ${inv.voucher_number}` }]);
    allocations.push({ inv, amount });
  }
  const total = round2(allocations.reduce((s, a) => s + a.amount, 0));
  const date = isoDate(b.paymentDate) || (await today());
  const number = await nextDocumentNumber('supplier_payment', { db, unique: { table: 'supplier_payments', column: 'payment_number' } });
  const jv = await postEvent('ap.payment', {
    date, source: 'payables', entryType: 'AP_PAYMENT', transactionCode: number, referenceType: 'SupplierPayment', bankAccount: b.payFromAccount, paymentMode: b.paymentMode || 'check',
    description: `Payment ${number} to ${supplier.name}`, amounts: { amount: total },
    vars: { supplierName: supplier.name, paymentNumber: number, memoRef: b.chequeNumber ? `Cheque ${b.chequeNumber} – ${supplier.name}` : `${number} – ${supplier.name}` },
  }, { db, user });
  const p = (await db.query(`INSERT INTO supplier_payments(payment_number, supplier_id, payment_date, payment_mode, pay_from_account, cheque_number, reference, amount, journal_id, remarks, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [number, supplier.id, date, b.paymentMode || 'check', String(b.payFromAccount), b.chequeNumber || null, b.reference || null,
    total, jv.id, b.remarks || null, user?.id ?? null])).rows[0];
  await db.query('UPDATE journal_vouchers SET reference_id = $2 WHERE id = $1', [jv.id, p.id]);
  for (const a of allocations) {
    await db.query('INSERT INTO supplier_payment_allocations(payment_id, invoice_id, amount) VALUES ($1,$2,$3)', [p.id, a.inv.id, a.amount]);
    await db.query(`UPDATE supplier_invoices SET paid_amount = paid_amount + $2, balance = balance - $2, status = CASE WHEN balance - $2 <= 0.005 THEN 'paid' ELSE 'partially-paid' END,
      updated_by = $3, updated_at = now() WHERE id = $1`, [a.inv.id, a.amount, user?.id ?? null]);
  }
  return getPayment(db, p.id);
}

/** Cancel a payment: journal reversed, the invoices open again. */
export async function cancelPayment(db, id, reason, user) {
  const p = (await db.query('SELECT * FROM supplier_payments WHERE id = $1 OR payment_number = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!p) throw notFound('Supplier payment not found');
  if (p.status !== 'posted') throw conflict(`Payment ${p.payment_number} is ${p.status}`);
  const rev = await reverseJournal(db, p.journal_id, user, { description: `Cancellation of supplier payment ${p.payment_number}` });
  for (const a of (await db.query('SELECT * FROM supplier_payment_allocations WHERE payment_id = $1', [p.id])).rows) {
    await db.query(`UPDATE supplier_invoices SET paid_amount = paid_amount - $2, balance = balance + $2, status = CASE WHEN paid_amount - $2 <= 0.005 THEN 'approved' ELSE 'partially-paid' END,
      updated_at = now() WHERE id = $1`, [a.invoice_id, Number(a.amount)]);
  }
  await db.query('UPDATE supplier_payments SET status = \'cancelled\', reversal_journal_id = $2, cancelled_by = $3, cancelled_at = now(), cancel_reason = $4 WHERE id = $1', [p.id, rev.id, user?.id ?? null, reason]);
  return getPayment(db, p.id);
}

// ---------------------------------------------------------------- ageing

/** AP ageing: open balances by days past due (limits.receivable_ageing_buckets), per invoice and per supplier. */
export async function apAgeing(db, q = {}) {
  const asOf = isoDate(q.asOf) || (await today());
  const buckets = ((await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120])) || [30, 60, 90, 120]).map(Number);
  const rows = (await db.query(`${SELECT} WHERE i.status IN ('approved', 'partially-paid') AND i.balance > 0 AND i.invoice_date <= $1::date
    AND ($2::text IS NULL OR i.supplier_id::text = $2 OR lower(m.code) = lower($2)) ORDER BY m.name, i.due_date`, [asOf, q.supplierId ? String(q.supplierId) : null])).rows.map((r) => invoiceOut(r));
  const bucketOf = (dpd) => (dpd <= 0 ? 'current' : dpd <= buckets[0] ? 'b1' : dpd <= buckets[1] ? 'b2' : dpd <= buckets[2] ? 'b3' : 'b4');
  const lines = rows.map((r) => {
    const dpd = Math.round((Date.parse(asOf) - Date.parse(r.dueDate)) / 86400000);
    return { invoiceId: r.id, voucherNumber: r.voucherNumber, supplierId: r.supplierId, supplierCode: r.supplierCode, supplierName: r.supplierName, supplierInvoiceNo: r.supplierInvoiceNo,
      invoiceDate: r.invoiceDate, dueDate: r.dueDate, daysPastDue: Math.max(0, dpd), balance: r.balance, bucket: bucketOf(dpd) };
  });
  const sum = (list, k) => round2(list.filter((x) => !k || x.bucket === k).reduce((s, x) => s + x.balance, 0));
  const suppliers = [...new Set(lines.map((l) => l.supplierId))].map((id) => {
    const l = lines.filter((x) => x.supplierId === id);
    return { supplierId: id, supplierCode: l[0].supplierCode, supplierName: l[0].supplierName, total: sum(l), current: sum(l, 'current'), b1: sum(l, 'b1'), b2: sum(l, 'b2'), b3: sum(l, 'b3'), b4: sum(l, 'b4') };
  });
  return { asOf, bucketDays: buckets.slice(0, 3), summary: { total: sum(lines), current: sum(lines, 'current'), b1: sum(lines, 'b1'), b2: sum(lines, 'b2'), b3: sum(lines, 'b3'), b4: sum(lines, 'b4') },
    suppliers, rows: lines };
}
