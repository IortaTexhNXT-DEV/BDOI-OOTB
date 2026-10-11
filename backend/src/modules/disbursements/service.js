/**
 * Payment vouchers (disbursements): client refunds, insurer remittances, agent / referrer payouts and supplier
 * payments. Payables are selected as invoice-list lines, paid by cheque (checkbook: Pending -> Approved -> Printed).
 * Cheque approval is maker-checker and posts Dr <payable account for the payee type> / Cr Cash in Bank.
 */
import { getSetting } from '../../lib/settings.js';
import { baseCurrency } from '../../lib/currency.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { reverseJournal } from '../accounting/lib/ledger.js';
import { postEvent, splitTaxes } from '../accounting/lib/posting.js';
import { allocate } from '../accounting/lib/coinsurance.js';
import { assertChecker, isoDate, num, round2, str, today } from '../accounting/lib/http.js';
import { findClient, findPolicy } from '../receipts/receivables.js';
import { payLines, lineView } from '../commission/service.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { postingDate } from '../../lib/dates.js';
import { assertAuthority } from '../access-control/service.js';

const AGENT = 'Agent/Referrer';
/** Payee types of a payment voucher. */
export const PAYEE_TYPES = ['Customer', 'Client', 'Insurer', AGENT, 'Supplier'];

/**
 * Columns of the payment voucher bulk upload (Accounts > Payment Voucher > Bulk upload); header names are read
 * camel-cased ("Voucher Date" -> voucherDate). The upload template is built from this list.
 */
export const DISBURSEMENT_UPLOAD_COLUMNS = [
  { key: 'voucherDate', header: 'Voucher Date', format: 'Date YYYY-MM-DD; today when empty', example: '2026-10-06' },
  { key: 'payeeType', header: 'Payee Type', format: 'Customer when empty', allowed: PAYEE_TYPES, example: 'Insurer' },
  { key: 'customerCode', header: 'Customer Code', format: 'Client code (CL-...) for a customer refund', example: '' },
  { key: 'insurerName', header: 'Insurer Name', format: 'Insurer name or code as in the Insurance Company master (payee type Insurer)', example: 'Malayan Insurance Co., Inc.' },
  { key: 'policyNumber', header: 'Policy Number', format: 'Related policy, if any', example: 'PC-MLY-2026-000101' },
  { key: 'referrerId', header: 'Referrer Id', format: 'Referrer code (payee type Agent/Referrer)', example: '' },
  { key: 'amount', header: 'Amount', required: 'Yes, except for Agent/Referrer', format: 'Amount in PHP, greater than zero', example: '28120.50' },
  { key: 'paymentMode', header: 'Payment Mode', format: 'Payment method, e.g. check or bank-transfer; check when empty', example: 'check' },
  { key: 'transactionCode', header: 'Transaction Code', format: 'Transaction code master', example: '' },
  { key: 'transactionDescription', header: 'Transaction Description', format: 'Text; printed on the voucher', example: 'Premium remittance September 2026' },
  { key: 'remarks', header: 'Remarks', format: 'Text', example: 'Net of commission' },
];

export const checkbookRow = (c) => ({
  checkbookId: c.id, id: c.id, invoiceListRefId: c.invoice_list_id, disbursementId: c.disbursement_id, customerCode: c.customer_code, customerName: c.customer_name,
  mainAccount: c.main_account, instrumentBookId: c.instrument_book_id, instrumentNo: c.instrument_no, instrumentDate: c.instrument_date,
  totaleAmount: Number(c.totale_amount), status: c.status, journalId: c.journal_id, createdBy: c.created_by, approvedBy: c.approved_by, approvedAt: c.approved_at,
  printedAt: c.printed_at, createdAt: c.created_at,
});
export const invoiceRow = (i, checkbooks = []) => ({
  invoiceListId: i.id, id: i.id, invoiceNumber: i.invoice_number, disbursementId: i.disbursement_id, customerCode: i.customer_code, clientId: i.client_id,
  policyId: i.policy_id, policyNumber: i.policy_number, receiptId: i.receipt_id, payeeType: i.payee_type,
  payables: Number(i.payables), outstanding: Number(i.outstanding), fcAmount: Number(i.fc_amount), lcAmount: Number(i.lc_amount), excess: Number(i.excess),
  balAmount: Number(i.bal_amount), vat: Number(i.vat), wht: Number(i.wht), comsub: Number(i.comsub), totalAmount: Number(i.total_amount),
  bankCode: i.bank_code, bankAmount: Number(i.bank_amount), isInvoicePaid: i.is_invoice_paid, status: i.status, source: i.source,
  createdBy: i.created_by, createdAt: i.created_at, checkbooks: checkbooks.map(checkbookRow),
});
export const disbursementRow = (d) => ({
  disbursementId: d.id, id: d.id, voucherNumber: d.voucher_number, transactionNumber: d.transaction_number, voucherDate: d.voucher_date,
  transactionCode: d.transaction_code, transactionDescription: d.transaction_description, departmentCode: d.department_code, branchCode: d.branch_code,
  payeeType: d.payee_type, payeeId: d.payee_id, payeeName: d.payee_name, criteria: d.criteria, customerCode: d.customer_code, clientId: d.client_id,
  referrerId: d.referrer_id, referrerName: d.referrer_name, insuranceCompanyId: d.insurance_company_id, insurerName: d.insurer_name,
  policyId: d.policy_id, policyNumber: d.policy_number, instrumentCurrency: d.instrument_currency, remarks: d.remarks, purpose: d.purpose,
  amount: Number(d.amount), grossAmount: Number(d.gross_amount), whtAmount: Number(d.wht_amount), paymentMode: d.payment_mode, bankId: d.bank_id,
  status: d.status, source: d.source, journalId: d.journal_id, approvedBy: d.approved_by, approvedAt: d.approved_at, paidAt: d.paid_at,
  createdBy: d.created_by, createdAt: d.created_at, updatedAt: d.updated_at, disbursementDate: d.voucher_date,
});

async function checkbooksFor(db, invoiceIds) {
  if (!invoiceIds.length) return new Map();
  const rows = (await db.query('SELECT * FROM checkbooks WHERE invoice_list_id = ANY($1) ORDER BY created_at', [invoiceIds])).rows;
  const map = new Map();
  for (const c of rows) map.set(c.invoice_list_id, [...(map.get(c.invoice_list_id) || []), c]);
  return map;
}
export async function invoiceRowsWithCheckbooks(db, rows) {
  const cb = await checkbooksFor(db, rows.map((r) => r.id));
  return rows.map((r) => invoiceRow(r, cb.get(r.id) || []));
}

export async function getDisbursementRaw(db, id, lock = false) {
  const d = (await db.query(`SELECT * FROM disbursements WHERE id = $1 OR voucher_number = $1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!d) throw notFound('Disbursement not found');
  return d;
}

async function resolveInsurer(db, ref) {
  if (!ref) return null;
  return (await db.query('SELECT * FROM insurance_companies WHERE id::text = $1 OR code = $1 OR name = $1 OR short_name = $1 LIMIT 1', [String(ref)])).rows[0] || null;
}

/** Create a voucher from the Create Voucher screen payload (or bulk upload row). */
export async function createDisbursement(db, b, user, { source = 'manual', status = 'draft' } = {}) {
  const payeeType = b.payeeType || 'Customer';
  const client = await findClient(db, b.customerCode);
  const insurer = await resolveInsurer(db, b.insurerName || b.insuranceCompanyId);
  const policy = await findPolicy(db, b.policyNumber || b.policyId);
  let referrer = null;
  if (payeeType === AGENT && b.referrerId) referrer = (await db.query('SELECT * FROM commission_referrers WHERE id = $1', [b.referrerId])).rows[0] || null;
  const payeeName = b.payeeName || referrer?.name || b.referrerName || (payeeType === 'Insurer' ? insurer?.name || b.insurerName : null) || client?.display_name || b.customerCode || payeeType;
  const voucherNumber = await nextDocumentNumber('voucher', { db, unique: { table: 'disbursements', column: 'voucher_number' } });
  const txn = b.transactionNumber || await nextDocumentNumber('disbursement_txn', { db });
  const d = (await db.query(`INSERT INTO disbursements(voucher_number, payee_type, payee_id, payee_name, amount, payment_mode, bank_id, reference_no, purpose, status,
      voucher_date, transaction_number, transaction_code, transaction_description, department_code, branch_code, criteria, customer_code, client_id,
      referrer_id, referrer_name, insurance_company_id, insurer_name, policy_id, policy_number, instrument_currency, remarks, source, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
  [voucherNumber, payeeType, referrer?.id || client?.id || (insurer ? String(insurer.id) : null), payeeName, round2(num(b.amount)),
    b.paymentMode || (await getSetting('disbursements.default_payment_mode', 'check')), b.bankId || null, str(b.referenceNo), str(b.purpose || b.transactionDescription),
    status, isoDate(b.voucherDate) || (await today()), txn, str(b.transactionCode), str(b.transactionDescription), str(b.departmentCode), str(b.branchCode), str(b.criteria),
    str(b.customerCode) || (referrer ? referrer.id : null), client?.id || null, referrer?.id || str(b.referrerId), referrer?.name || str(b.referrerName),
    insurer?.id || null, insurer?.name || str(b.insurerName), policy?.id || null, policy?.policy_number || str(b.policyNumber),
    b.instrumentCurrency || (await baseCurrency()), str(b.remarks), source, user?.id ?? null])).rows[0];
  return d;
}

/** Voucher for commission lines of one referrer (used by bulk agent disburse and single-line pay). */
export async function createCommissionVoucher(db, { referrer, lines, user, status = 'for-approval', transactionCode = 'COMSUB', currency }) {
  // No payout to a referrer without a bank account on file (commission.require_bank_account)
  const { assertPayable } = await import('../commission/service.js');
  await assertPayable(referrer);
  const gross = round2(lines.reduce((s, l) => s + Number(l.amount), 0));
  const wht = round2(lines.reduce((s, l) => s + Number(l.withholding), 0));
  const d = await createDisbursement(db, { payeeType: AGENT, referrerId: referrer.id, referrerName: referrer.name, customerCode: referrer.id, transactionCode,
    transactionDescription: `Comsub payout – ${referrer.name}`, instrumentCurrency: currency, amount: round2(gross - wht), criteria: 'Specific' }, user, { source: 'agent-payout', status });
  await db.query('UPDATE disbursements SET gross_amount = $2, wht_amount = $3, paid_at = CASE WHEN $4 = \'paid\' THEN now() ELSE paid_at END WHERE id = $1', [d.id, gross, wht, status]);
  await db.query('UPDATE commissions SET disbursement_id = $2, voucher_no = $3, updated_at = now() WHERE id = ANY($1)', [lines.map((l) => l.id), d.id, d.voucher_number]);
  return { ...d, gross_amount: gross, wht_amount: wht };
}

export async function listDisbursements(db, q, pg) {
  const where = [];
  const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)); };
  if (q.customerCode) add('d.customer_code ILIKE \'%\' || ? || \'%\'', q.customerCode);
  if (q.voucherNumber) add('d.voucher_number ILIKE \'%\' || ? || \'%\'', q.voucherNumber);
  if (q.transactionNumber) add('d.transaction_number ILIKE \'%\' || ? || \'%\'', q.transactionNumber);
  if (q.fromDate) add('d.voucher_date >= ?::date', isoDate(q.fromDate));
  if (q.toDate) add('d.voucher_date <= ?::date', isoDate(q.toDate));
  if (q.status) add('d.status = ?', q.status);
  if (q.payeeType) add('d.payee_type = ?', q.payeeType);
  if (q.referrerId) add('d.referrer_id = ?', q.referrerId);
  if (q.search) add('(d.voucher_number || \' \' || COALESCE(d.payee_name,\'\') || \' \' || COALESCE(d.customer_code,\'\') || \' \' || COALESCE(d.policy_number,\'\')) ILIKE \'%\' || ? || \'%\'', q.search);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM disbursements d ${w}`, p)).rows[0].n;
  const rows = (await db.query(`SELECT d.* FROM disbursements d ${w} ORDER BY d.voucher_date DESC, d.created_at DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, pg.limit, pg.offset])).rows;
  return { rows: rows.map(disbursementRow), total };
}

/** Voucher detail with its invoice list (payables) and cheques; agent vouchers list their commission lines. */
export async function getDisbursement(db, id) {
  const d = await getDisbursementRaw(db, id);
  const out = disbursementRow(d);
  const inv = (await db.query(`SELECT * FROM invoice_lists WHERE disbursement_id = $1
    OR (disbursement_id IS NULL AND status = 'open' AND $2::text IS NOT NULL AND customer_code = $2) ORDER BY created_at`, [d.id, d.payee_type === AGENT ? null : d.customer_code])).rows;
  out.invoiceList = await invoiceRowsWithCheckbooks(db, inv);
  // every cheque of the voucher: issued against one of its invoice-list lines or on the voucher itself
  out.cheques = (await db.query(`SELECT * FROM checkbooks WHERE disbursement_id = $1 OR invoice_list_id = ANY($2::text[]) ORDER BY created_at`,
    [d.id, inv.filter((i) => i.disbursement_id === d.id).map((i) => i.id)])).rows.map(checkbookRow);
  if (d.payee_type === AGENT) {
    const lines = (await db.query('SELECT * FROM commissions WHERE disbursement_id = $1 ORDER BY cycle_date', [d.id])).rows;
    out.commissionLines = await Promise.all(lines.map(lineView));
  }
  return out;
}

const EDITABLE = { voucherDate: 'voucher_date', departmentCode: 'department_code', branchCode: 'branch_code', criteria: 'criteria', transactionCode: 'transaction_code',
  transactionDescription: 'transaction_description', remarks: 'remarks', instrumentCurrency: 'instrument_currency', paymentMode: 'payment_mode', referenceNo: 'reference_no',
  policyNumber: 'policy_number', insurerName: 'insurer_name', payeeName: 'payee_name', bankId: 'bank_id' };
export async function updateDisbursement(db, id, b, user) {
  const d = await getDisbursementRaw(db, id, true);
  if (['paid', 'cancelled'].includes(d.status)) throw conflict(`Voucher ${d.voucher_number} is ${d.status} and cannot be changed`);
  const sets = []; const p = [d.id];
  for (const [k, col] of Object.entries(EDITABLE)) if (b[k] !== undefined) { p.push(col === 'voucher_date' ? isoDate(b[k]) : b[k]); sets.push(`${col} = $${p.length}`); }
  if (b.amount !== undefined) { p.push(round2(num(b.amount))); sets.push(`amount = $${p.length}`); }
  if (b.status !== undefined) {
    if (!['draft', 'for-approval', 'cancelled'].includes(b.status)) throw badRequest('Status can only be set to draft, for-approval or cancelled here; use the cheque / payout approval for the rest');
    p.push(b.status); sets.push(`status = $${p.length}`);
  }
  p.push(user.id); sets.push(`updated_by = $${p.length}`, 'updated_at = now()');
  const after = (await db.query(`UPDATE disbursements SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, p)).rows[0];
  return { before: disbursementRow(d), after: disbursementRow(after) };
}

export async function createInvoiceList(db, b, user) {
  const client = await findClient(db, b.customerCode);
  const policy = await findPolicy(db, b.policyNumber || b.policyId);
  const number = await nextDocumentNumber('invoice_list', { db });
  const total = round2(num(b.totalAmount) || num(b.lcAmount) || num(b.payables));
  const r = (await db.query(`INSERT INTO invoice_lists(invoice_number, disbursement_id, customer_code, client_id, insurance_company_id, policy_id, policy_number, receipt_id,
      payee_type, payables, outstanding, fc_amount, lc_amount, excess, bal_amount, vat, wht, comsub, total_amount, bank_code, bank_amount, is_invoice_paid, source, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
  [number, b.disbursementId || null, str(b.customerCode), client?.id || null, policy?.insurance_company_id || null, policy?.id || null, policy?.policy_number || str(b.policyNumber),
    b.receiptId || null, b.payeeType || 'Insurer', round2(num(b.payables)), round2(num(b.outstanding)), round2(num(b.fcAmount)), round2(num(b.lcAmount)), round2(num(b.excess)),
    round2(num(b.balAmount)), round2(num(b.vat)), round2(num(b.wht)), round2(num(b.comsub)), total, str(b.bankCode), round2(num(b.bankAmount)), b.isInvoicePaid === true || b.isInvoicePaid === 'true',
    b.source || 'manual', user?.id ?? b.createdBy ?? null])).rows[0];
  return r;
}

export async function getInvoiceList(db, id) {
  const r = (await db.query('SELECT * FROM invoice_lists WHERE id = $1 OR invoice_number = $1', [id])).rows[0];
  if (!r) throw notFound('Invoice list not found');
  return (await invoiceRowsWithCheckbooks(db, [r]))[0];
}

export async function listInvoiceLists(db, q, pg) {
  const p = [q.customerCode || null, q.status || null, q.disbursementId || null, q.payeeType || null];
  const w = `($1::text IS NULL OR customer_code = $1) AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR disbursement_id = $3) AND ($4::text IS NULL OR payee_type = $4)`;
  const total = (await db.query(`SELECT count(*)::int AS n FROM invoice_lists WHERE ${w}`, p)).rows[0].n;
  const rows = (await db.query(`SELECT * FROM invoice_lists WHERE ${w} ORDER BY created_at DESC LIMIT $5 OFFSET $6`, [...p, pg.limit, pg.offset])).rows;
  return { rows: await invoiceRowsWithCheckbooks(db, rows), total };
}

export async function createCheckbook(db, b, user) {
  const inv = b.invoiceListRefId ? (await db.query('SELECT * FROM invoice_lists WHERE id = $1 FOR UPDATE', [b.invoiceListRefId])).rows[0] : null;
  if (b.invoiceListRefId && !inv) throw notFound('Invoice list not found');
  if (inv && ['paid', 'cancelled'].includes(inv.status)) throw conflict(`Invoice ${inv.invoice_number} is ${inv.status}`);
  const amount = round2(num(b.totaleAmount) || Number(inv?.total_amount || 0));
  if (!(amount > 0)) throw badRequest('Cheque amount must be greater than zero');
  const disbursementId = b.disbursementId || inv?.disbursement_id || null;
  const c = (await db.query(`INSERT INTO checkbooks(invoice_list_id, disbursement_id, customer_code, customer_name, main_account, instrument_book_id, instrument_no, instrument_date,
      totale_amount, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pending',$10) RETURNING *`,
  [inv?.id || null, disbursementId, str(b.customerCode) || inv?.customer_code || null, str(b.customerName), str(b.mainAccount), str(b.instrumentBookId), str(b.instrumentNo),
    isoDate(b.instrumentDate) || (await today()), amount, user.id])).rows[0];
  if (inv) await db.query('UPDATE invoice_lists SET status = \'in-voucher\', disbursement_id = COALESCE(disbursement_id, $2), updated_at = now() WHERE id = $1', [inv.id, disbursementId]);
  return c;
}

/**
 * Premium taxes (VAT, DST, LGT) inside an insurer payment: the tax share booked on the bills whose collections the voucher
 * remits (booking journal lines on the premium tax accounts, pro rata to the amount collected; on a co-insured bill only the
 * insurer's own lines). Zero when premium taxes are not booked separately.
 */
export async function remittedPremiumTaxes(db, { invoiceListId, disbursementId }, amount) {
  const zero = { vat: 0, dst: 0, lgt: 0 };
  if (!(await splitTaxes())) return zero;
  const lists = (await db.query('SELECT id, total_amount FROM invoice_lists WHERE ($1::text IS NOT NULL AND id = $1) OR ($1::text IS NULL AND $2::text IS NOT NULL AND disbursement_id = $2)',
    [invoiceListId || null, disbursementId || null])).rows;
  if (!lists.length) return zero;
  const { account } = await import('../accounting/lib/ledger.js');
  // a tax account shared by several taxes counts once; one that is the premium payable account itself is paid as premium
  const seen = new Set([await account('due_to_insurer')]);
  const codes = {};
  for (const [k, role] of [['vat', 'premium_vat_payable'], ['dst', 'premium_dst_payable'], ['lgt', 'premium_lgt_payable']]) {
    const code = await account(role);
    if (!seen.has(code)) codes[k] = code;
    seen.add(code);
  }
  if (!Object.keys(codes).length) return zero;
  const rows = (await db.query(`SELECT x.ratio, x.insurer, l.account_code, l.credit, l.insurance_company_id FROM (
      SELECT a.amount / r.amount AS ratio, NULL::int AS insurer, r.booking_jv_id FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id
        WHERE a.remitted_invoice_id = ANY($1)
      UNION ALL
      SELECT a.amount / r.amount, al.insurance_company_id, r.booking_jv_id FROM remittance_allocations al JOIN receipt_applications a ON a.id = al.receipt_application_id
        JOIN receivables r ON r.id = a.receivable_id WHERE al.invoice_list_id = ANY($1)) x
    JOIN journal_lines l ON l.jv_id = x.booking_jv_id AND l.account_code = ANY($2) AND (x.insurer IS NULL OR l.insurance_company_id = x.insurer)`,
  [lists.map((l) => l.id), Object.values(codes)])).rows;
  const out = { vat: 0, dst: 0, lgt: 0 };
  for (const r of rows) for (const [k, code] of Object.entries(codes)) if (r.account_code === code) out[k] += Number(r.credit) * Number(r.ratio);
  const total = lists.reduce((s, l) => s + Number(l.total_amount), 0);
  const factor = total > 0 ? Math.min(1, amount / total) : 1;
  for (const k of Object.keys(out)) out[k] = round2(out[k] * factor);
  if (round2(out.vat + out.dst + out.lgt) >= amount) return zero;
  return out;
}

async function approveCheque(db, c, amount, user) {
  await assertChecker(user, c.created_by, 'cheque');
  const inv = c.invoice_list_id ? (await db.query('SELECT * FROM invoice_lists WHERE id = $1', [c.invoice_list_id])).rows[0] : null;
  const d = c.disbursement_id ? await getDisbursementRaw(db, c.disbursement_id, true) : null;
  if (d) await assertChecker(user, d.created_by, 'payment voucher');
  const payeeType = d?.payee_type || inv?.payee_type || 'Insurer';
  const taxes = payeeType === 'Insurer' ? await remittedPremiumTaxes(db, { invoiceListId: inv?.id, disbursementId: d?.id }, amount) : { vat: 0, dst: 0, lgt: 0 };
  const jv = await postEvent('disbursement.payment', {
    source: 'disbursement', entryType: payeeType === 'Insurer' ? 'REMITTANCE' : payeeType === AGENT ? 'COMMISSION_PAYMENT' : 'REFUND',
    referenceType: 'Disbursement', referenceId: d?.id || c.id, transactionCode: d?.voucher_number || c.instrument_no, clientId: d?.client_id || inv?.client_id || null,
    policyId: inv?.policy_id || d?.policy_id || null, policyNumber: inv?.policy_number || d?.policy_number || null,
    // a payment made by bank payment file (Accounts > Bank Payment Files) is a bank transfer, not a cheque
    description: `${c.instrument_book_id === 'BANK-FILE' ? 'Bank transfer' : 'Cheque'} ${c.instrument_no || ''} – ${d?.payee_name || c.customer_name || c.customer_code || payeeType}`.trim(),
    payeeType, bankAccount: c.main_account || null, paymentMode: c.instrument_book_id === 'BANK-FILE' ? 'bank-transfer' : 'check',
    // the payment is booked on the cheque date (today when it is post-dated), so the bank book shows it when it was issued
    date: await postingDate(c.instrument_date),
    amounts: { amount, payable: round2(amount - taxes.vat - taxes.dst - taxes.lgt), ...taxes },
    vars: { payeeType, payeeName: d?.payee_name || c.customer_name || c.customer_code || payeeType, instrumentNo: c.instrument_no || '' },
  }, { db, user });
  await db.query('UPDATE checkbooks SET status = \'Approved\', totale_amount = $2, approved_by = $3, approved_at = now(), journal_id = $4, updated_at = now() WHERE id = $1', [c.id, amount, user.id, jv.id]);
  if (inv) await db.query('UPDATE invoice_lists SET status = \'paid\', updated_at = now() WHERE id = $1', [inv.id]);
  if (d) {
    await db.query(`UPDATE disbursements SET status = 'approved', approved_by = $2, approved_at = now(), journal_id = COALESCE(journal_id, $3),
      amount = CASE WHEN amount = 0 THEN $4 ELSE amount END, updated_at = now() WHERE id = $1`, [d.id, user.id, jv.id, amount]);
    // A cheque drawn on the whole voucher (no single payable named) pays the voucher's payables once the approved cheques
    // cover the voucher, so they no longer show as open payables to the insurer (aged payables, remittances due)
    if (!inv) await settleVoucherPayables(db, d.id);
  }
}

/** Mark the payables (invoice lists) of a voucher paid when its approved cheques cover the voucher amount. */
async function settleVoucherPayables(db, disbursementId) {
  const v = (await db.query(`SELECT d.amount, COALESCE((SELECT sum(c.totale_amount) FROM checkbooks c WHERE c.disbursement_id = d.id AND c.status IN ('Approved', 'Printed')), 0) AS paid
    FROM disbursements d WHERE d.id = $1`, [disbursementId])).rows[0];
  if (v && Number(v.paid) + 0.005 >= Number(v.amount)) {
    await db.query("UPDATE invoice_lists SET status = 'paid', updated_at = now() WHERE disbursement_id = $1 AND status IN ('open', 'in-voucher')", [disbursementId]);
  }
}

/** Cheque status transitions: Pending -> Approved (maker-checker, posts the payment journal) -> Printed (voucher paid); Cancelled. */
export async function updateCheckbook(db, id, b, user) {
  const c = (await db.query('SELECT * FROM checkbooks WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!c) throw notFound('Checkbook entry not found');
  const next = b.status || c.status;
  if (next === c.status) {
    if (c.status !== 'Pending') throw conflict(`Cheque is ${c.status}; details can only be changed while Pending`);
    await db.query(`UPDATE checkbooks SET main_account = COALESCE($2, main_account), instrument_book_id = COALESCE($3, instrument_book_id), instrument_no = COALESCE($4, instrument_no),
      instrument_date = COALESCE($5, instrument_date), totale_amount = COALESCE($6, totale_amount), updated_at = now() WHERE id = $1`,
    [id, str(b.mainAccount), str(b.instrumentBookId), str(b.instrumentNo), isoDate(b.instrumentDate), b.totaleAmount === undefined ? null : round2(num(b.totaleAmount))]);
  } else if (c.status === 'Pending' && next === 'Approved') {
    const amount = round2(b.totaleAmount === undefined ? Number(c.totale_amount) : num(b.totaleAmount));
    if (!(amount > 0)) throw badRequest('Cheque amount must be greater than zero');
    await assertAuthority(db, user, 'payment_voucher', amount);
    await approveCheque(db, c, amount, user);
  } else if (c.status === 'Approved' && next === 'Printed') {
    await db.query('UPDATE checkbooks SET status = \'Printed\', printed_by = $2, printed_at = now(), updated_at = now() WHERE id = $1', [id, user.id]);
    if (c.disbursement_id) {
      const open = (await db.query('SELECT count(*)::int AS n FROM checkbooks WHERE disbursement_id = $1 AND status IN (\'Pending\',\'Approved\') AND id <> $2', [c.disbursement_id, id])).rows[0].n;
      if (!open) await db.query('UPDATE disbursements SET status = \'paid\', paid_at = now(), updated_at = now() WHERE id = $1', [c.disbursement_id]);
    }
  } else if (next === 'Cancelled' && ['Pending', 'Approved'].includes(c.status)) {
    if (c.journal_id) await reverseJournal(db, c.journal_id, user, { description: `Cheque ${c.instrument_no || c.id} cancelled` });
    await db.query('UPDATE checkbooks SET status = \'Cancelled\', updated_at = now() WHERE id = $1', [id]);
    if (c.invoice_list_id) await db.query('UPDATE invoice_lists SET status = \'open\', updated_at = now() WHERE id = $1', [c.invoice_list_id]);
    // a cancelled cheque on the whole voucher leaves its payables on the voucher, unpaid
    else if (c.disbursement_id && c.status === 'Approved') {
      await db.query("UPDATE invoice_lists SET status = 'in-voucher', updated_at = now() WHERE disbursement_id = $1 AND status = 'paid'", [c.disbursement_id]);
    }
  } else {
    throw conflict(`Cheque cannot move from ${c.status} to ${next}`);
  }
  return { before: checkbookRow(c), after: checkbookRow((await db.query('SELECT * FROM checkbooks WHERE id = $1', [id])).rows[0]) };
}

/** Approved commission lines of a referrer presented as invoice-list rows for the Specific Voucher screen. */
export async function agentInvoiceLines(db, referrerId) {
  const ref = (await db.query('SELECT * FROM commission_referrers WHERE id = $1', [referrerId])).rows[0];
  if (!ref) throw notFound('Referrer not found');
  const lines = (await db.query('SELECT * FROM commissions WHERE referrer_id = $1 AND status = \'Approved\' AND (disbursement_id IS NULL OR disbursement_id IN (SELECT id FROM disbursements WHERE status NOT IN (\'paid\',\'cancelled\'))) ORDER BY cycle_date', [referrerId])).rows;
  const invoiceList = lines.map((l) => ({
    commissionLineId: l.id, invoiceListId: l.id, policyNumber: l.policy_number, payables: Number(l.amount), outstanding: Number(l.net_amount), fcAmount: 0,
    lcAmount: Number(l.amount), excess: 0, balAmount: Number(l.net_amount), vat: 0, wht: Number(l.withholding), comsub: Number(l.amount), totalAmount: Number(l.net_amount),
    disbursementId: l.disbursement_id, checkbooks: [],
  }));
  return { referrer: { id: ref.id, name: ref.name, whtApplicable: ref.wht_applicable }, invoiceList,
    totals: { comsub: round2(lines.reduce((s, l) => s + Number(l.amount), 0)), wht: round2(lines.reduce((s, l) => s + Number(l.withholding), 0)), net: round2(lines.reduce((s, l) => s + Number(l.net_amount), 0)) } };
}

/** Checker approves an agent payout voucher: selected Approved lines are paid (maker-checker vs voucher creator). */
export async function approveAgentPayout(db, id, lineIds, user, { bankAccount = null, paymentMode = null } = {}) {
  const d = await getDisbursementRaw(db, id, true);
  if (d.payee_type !== AGENT) throw badRequest('Voucher is not an Agent/Referrer payout');
  if (['paid', 'cancelled'].includes(d.status)) throw conflict(`Voucher ${d.voucher_number} is ${d.status}`);
  await assertChecker(user, d.created_by, 'payment voucher');
  // the payee must still be payable when the payment is approved: bank account on file
  const { assertPayable } = await import('../commission/service.js');
  const referrer = (await db.query('SELECT * FROM commission_referrers WHERE id = $1', [d.referrer_id])).rows[0];
  if (referrer) await assertPayable(referrer);
  const lines = (await db.query('SELECT * FROM commissions WHERE id = ANY($1) AND referrer_id = $2 FOR UPDATE', [lineIds, d.referrer_id])).rows;
  if (lines.length !== lineIds.length) throw badRequest('Some commission lines do not belong to this referrer');
  const r = await payLines(db, { lines, disbursement: d, user, bankAccount, paymentMode });
  await db.query(`UPDATE disbursements SET amount = $2, gross_amount = $3, wht_amount = $4, status = 'paid', approved_by = $5, approved_at = now(), paid_at = now(),
    journal_id = $6, updated_at = now() WHERE id = $1`, [d.id, r.net, r.gross, r.wht, user.id, r.journalId]);
  return { disbursementId: d.id, voucherNumber: d.voucher_number, amount: r.net, grossAmount: r.gross, whtAmount: r.wht, lineIds, journalId: r.journalId, status: 'paid' };
}

export async function bulkAgentDisburse(db, { referrerIds, transactionCode, instrumentCurrency }, user) {
  const vouchers = []; const errors = [];
  for (const rid of referrerIds) {
    try {
      const ref = (await db.query('SELECT * FROM commission_referrers WHERE id = $1', [rid])).rows[0];
      if (!ref) throw notFound('Referrer not found');
      const lines = (await db.query('SELECT * FROM commissions WHERE referrer_id = $1 AND status = \'Approved\' AND disbursement_id IS NULL FOR UPDATE', [rid])).rows;
      if (!lines.length) throw conflict('No approved lines to pay');
      const d = await createCommissionVoucher(db, { referrer: ref, lines, user, status: 'for-approval', transactionCode, currency: instrumentCurrency });
      vouchers.push({ referrerId: rid, referrerName: ref.name, disbursementId: d.id, voucherNumber: d.voucher_number, amount: Number(d.amount), lineIds: lines.map((l) => l.id) });
    } catch (e) {
      errors.push({ referrerId: rid, error: e.message });
    }
  }
  return { vouchers, errors };
}

/**
 * Insurer remittance voucher: premium collected (receipt applications not yet remitted) for an insurer's policies, net
 * of brokerage commission, as one invoice-list row per policy on a new voucher.
 */
const CO_INSURED = '((SELECT count(*) FROM risk_participants x WHERE x.entity_type = \'policy\' AND x.entity_id = p.id AND x.status = \'active\') > 1)';

/**
 * An insurer's share of one collection on a co-insured bill: the collection split by the insurers' gross on the bill and the
 * commission collected split by their commission (receivable_participants; the participants' shares when the bill has none).
 */
async function insurerShareOfCollection(db, a, insurerId) {
  let rows = (await db.query(`SELECT insurance_company_id, share_percent, gross, commission, commission_vat, commission_ewt FROM receivable_participants WHERE receivable_id = $1
    ORDER BY insurance_company_id`, [a.receivable_id])).rows;
  if (!rows.length) {
    rows = (await db.query(`SELECT insurance_company_id, share_percent, 0 AS gross, 0 AS commission, 0 AS commission_vat, 0 AS commission_ewt FROM risk_participants
      WHERE entity_type = 'policy' AND entity_id = $1 AND status = 'active' ORDER BY insurance_company_id`, [a.policy_id])).rows;
  }
  const i = rows.findIndex((r) => Number(r.insurance_company_id) === Number(insurerId));
  if (i < 0) return { gross: 0, commission: 0, commissionVat: 0, commissionEwt: 0, share: 0 };
  const grossW = rows.map((r) => Number(r.gross) || Number(r.share_percent));
  const commW = rows.map((r) => (Number(r.gross) ? Number(r.commission) : Number(r.share_percent)));
  const ratio = Number(a.amount) / Number(a.rcv_amount);
  const collectedCommission = round2(ratio * Number(a.commission_amount));
  return { gross: allocate(Number(a.amount), grossW)[i], commission: allocate(collectedCommission, commW)[i], share: Number(rows[i].share_percent),
    commissionVat: round2(ratio * Number(rows[i].commission_vat || 0)), commissionEwt: round2(ratio * Number(rows[i].commission_ewt || 0)) };
}

export async function createInsurerRemittance(db, b, user) {
  const insurer = await resolveInsurer(db, b.insuranceCompanyId || b.insurerName);
  if (!insurer) throw notFound('Insurer not found');
  const filter = [insurer.id, isoDate(b.fromDate), isoDate(b.toDate), Array.isArray(b.policyIds) ? b.policyIds.map(String) : null];
  const apps = (await db.query(`SELECT a.*, r.amount AS rcv_amount, r.commission_amount, r.commission_vat, r.commission_ewt, r.client_id, p.id AS policy_id, p.policy_number, c.client_code
    FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = r.client_id
    WHERE a.status = 'applied' AND a.remitted_invoice_id IS NULL AND p.insurance_company_id = $1 AND NOT ${CO_INSURED}
      AND ($2::date IS NULL OR a.collected_on >= $2) AND ($3::date IS NULL OR a.collected_on <= $3)
      AND ($4::text[] IS NULL OR p.id = ANY($4)) FOR UPDATE OF a`, filter)).rows;
  // Co-insured policies: the insurer's share of each collection (its share of the premium less its own commission)
  const coApps = (await db.query(`SELECT a.*, r.amount AS rcv_amount, r.commission_amount, r.client_id, p.id AS policy_id, p.policy_number, c.client_code
    FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = r.client_id
    WHERE a.status = 'applied' AND ${CO_INSURED}
      AND EXISTS (SELECT 1 FROM risk_participants x WHERE x.entity_type = 'policy' AND x.entity_id = p.id AND x.status = 'active' AND x.insurance_company_id = $1)
      AND NOT EXISTS (SELECT 1 FROM remittance_allocations al WHERE al.receipt_application_id = a.id AND al.insurance_company_id = $1)
      AND ($2::date IS NULL OR a.collected_on >= $2) AND ($3::date IS NULL OR a.collected_on <= $3)
      AND ($4::text[] IS NULL OR p.id = ANY($4)) FOR UPDATE OF a`, filter)).rows;
  if (!apps.length && !coApps.length) throw conflict(`No collected premium awaiting remittance to ${insurer.name}`);
  const d = await createDisbursement(db, { payeeType: 'Insurer', insurerName: insurer.name, transactionCode: b.transactionCode || 'REMT', criteria: 'Payall',
    transactionDescription: `Premium remittance – ${insurer.name}`, remarks: b.remarks, paymentMode: b.paymentMode }, user, { source: 'insurer-remittance', status: 'draft' });
  const byPolicy = new Map();
  for (const a of apps) byPolicy.set(a.policy_id, [...(byPolicy.get(a.policy_id) || []), a]);
  let total = 0;
  // pro rata to the premium collected: commission, the VAT on it (kept by the broker) and the EWT on it (paid back to the insurer)
  const collected = (list, key) => round2(list.reduce((s, a) => s + (Number(a.amount) / Number(a.rcv_amount)) * Number(a[key] || 0), 0));
  for (const list of byPolicy.values()) {
    const gross = round2(list.reduce((s, a) => s + Number(a.amount), 0));
    const comm = collected(list, 'commission_amount');
    const cvat = collected(list, 'commission_vat');
    const cewt = collected(list, 'commission_ewt');
    const net = round2(gross - comm - cvat + cewt);
    const inv = await createInvoiceList(db, { disbursementId: d.id, customerCode: list[0].client_code, policyId: list[0].policy_id, payeeType: 'Insurer', payables: gross,
      outstanding: net, lcAmount: gross, comsub: comm, vat: cvat, wht: cewt, balAmount: net, totalAmount: net, isInvoicePaid: true, source: 'insurer-remittance' }, user);
    await db.query('UPDATE invoice_lists SET status = \'in-voucher\' WHERE id = $1', [inv.id]);
    await db.query('UPDATE receipt_applications SET remitted_invoice_id = $2 WHERE id = ANY($1)', [list.map((a) => a.id), inv.id]);
    total = round2(total + net);
  }
  const coByPolicy = new Map();
  for (const a of coApps) coByPolicy.set(a.policy_id, [...(coByPolicy.get(a.policy_id) || []), a]);
  for (const list of coByPolicy.values()) {
    const shares = [];
    for (const a of list) shares.push({ a, ...(await insurerShareOfCollection(db, a, insurer.id)) });
    const gross = round2(shares.reduce((s, x) => s + x.gross, 0));
    const comm = round2(shares.reduce((s, x) => s + x.commission, 0));
    const cvat = round2(shares.reduce((s, x) => s + x.commissionVat, 0));
    const cewt = round2(shares.reduce((s, x) => s + x.commissionEwt, 0));
    const net = round2(gross - comm - cvat + cewt);
    const inv = await createInvoiceList(db, { disbursementId: d.id, customerCode: list[0].client_code, policyId: list[0].policy_id, payeeType: 'Insurer', payables: gross,
      outstanding: net, lcAmount: gross, comsub: comm, vat: cvat, wht: cewt, balAmount: net, totalAmount: net, isInvoicePaid: true, source: 'insurer-remittance' }, user);
    await db.query('UPDATE invoice_lists SET status = \'in-voucher\', insurance_company_id = $2 WHERE id = $1', [inv.id, insurer.id]);
    for (const x of shares) {
      await db.query(`INSERT INTO remittance_allocations(receipt_application_id, insurance_company_id, invoice_list_id, share_percent, gross, commission, net, commission_vat, commission_ewt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [x.a.id, insurer.id, inv.id, x.share, x.gross, x.commission, round2(x.gross - x.commission - x.commissionVat + x.commissionEwt), x.commissionVat, x.commissionEwt]);
    }
    total = round2(total + net);
  }
  // refunds due from this insurer (return premium already remitted) are netted against the remittance
  const { applyInsurerCredits } = await import('../remittance/insurerCredits.js');
  const netted = await applyInsurerCredits(db, { insurerId: insurer.id, insurerName: insurer.name, available: total, disbursement: d, user });
  const payable = round2(total - netted.applied);
  await db.query('UPDATE disbursements SET amount = $2, gross_amount = $2 WHERE id = $1', [d.id, payable]);
  if (netted.applied > 0) {
    await db.query('UPDATE disbursements SET remarks = trim(concat_ws(\' \', remarks, $2::text)) WHERE id = $1', [d.id, `Refunds due from ${insurer.name} netted: ${netted.applied.toFixed(2)} (gross remittance ${total.toFixed(2)}).`]);
  }
  return { ...(await getDisbursement(db, d.id)), refundsNetted: netted.applied, grossRemittance: total };
}
