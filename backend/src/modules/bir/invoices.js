/**
 * Sales invoices of the broker's services under the EOPT Act (RA 11976) and RR 7-2024.
 *
 * What the system does (to be confirmed by the broker's tax adviser):
 *   - The sales invoice is the primary document of every sale of services: brokerage commission billed to an insurer
 *     (from a commission debit note or a broker-billed policy), overriding / contingent commission (from an approved
 *     computation) and fees (manual invoice).
 *   - Required content: the seller's registered name, trade name, TIN with branch code, business address and VAT
 *     status; "SALES INVOICE"; the serial number (series sales_invoice, sequential, never reset, kept within
 *     invoice.serial_from to invoice.serial_to); the date; the buyer's name, TIN and address (required from
 *     invoice.buyer_details_threshold and for every business buyer); the description, quantity, unit price and
 *     amount; VATable, VAT-exempt and zero-rated sales and the VAT shown separately (non-VAT registered: total sales
 *     with "NON-VAT REGISTERED"); the ATP or CAS acknowledgement / Permit to Use details and the serial range
 *     (invoice.* settings, copied onto the invoice when it is issued so a later change does not alter it).
 *   - Numbers are taken inside the issuing transaction, so a failed issue leaves no gap; an invoice is never deleted,
 *     only cancelled with a reason (kept, printed CANCELLED); a manual invoice's journal is reversed on cancellation.
 *   - The official receipt is no longer the primary document: a payment on an invoice is acknowledged with a
 *     supplementary document (invoice.payment_document_title, with invoice.supplementary_note "not valid for claim of
 *     input tax"); premium collection receipts carry receipts.document_title.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { today } from '../../lib/dates.js';
import { renderPdf } from '../../lib/pdf/index.js';
import { amountInWords } from '../../lib/pdf/format.js';
import { postEvent } from '../accounting/lib/posting.js';
import { reverseJournal } from '../accounting/lib/ledger.js';
import { taxCodeRate } from '../accounting/lib/commissionTax.js';
import { iso } from '../period-end/fiscal.js';
import { birIdentity, formatTin, round2, splitTin } from './common.js';
import { enqueueInvoice } from './eis.js';

export const SOURCE_TYPES = ['manual', 'debit_note', 'override_commission', 'policy_commission'];
export const VAT_CLASSES = ['vatable', 'exempt', 'zero_rated'];

/** Seller block printed on every invoice (snapshot at issue). */
export async function sellerSnapshot() {
  const id = await birIdentity();
  const s = async (k, d = '') => (await getSetting(`invoice.${k}`, d)) ?? d;
  return {
    registeredName: id.name, tradeName: id.tradeName, tin: id.tin, branchCode: id.branch, tinFormatted: id.tinFormatted, address: id.address, zip: id.zip,
    vatRegistered: id.vatRegistered, atpNumber: await s('atp_number'), atpDateIssued: await s('atp_date_issued'), atpValidUntil: await s('atp_valid_until'),
    casPermitNumber: await s('cas_permit_number'), casPermitDate: await s('cas_permit_date'), serialFrom: Number(await s('serial_from', 1)),
    serialTo: Number(await s('serial_to', 9999999999)), printerDetails: await s('printer_details'),
  };
}

const lineRow = (l) => ({ lineNo: l.line_no, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unit_price), amount: Number(l.amount),
  vatClass: l.vat_class, vatAmount: Number(l.vat_amount), glAccount: l.gl_account, policyNumber: l.policy_number, reference: l.reference });
export const invoiceRow = (i, lines = null, payments = null) => i && ({
  id: i.id, invoiceNumber: i.invoice_number, invoiceDate: iso(i.invoice_date), sourceType: i.source_type, sourceId: i.source_id, sourceReference: i.source_reference,
  buyerType: i.buyer_type, buyerId: i.buyer_id, buyerName: i.buyer_name, buyerTin: i.buyer_tin, buyerBranchCode: i.buyer_branch_code, buyerAddress: i.buyer_address,
  buyerBusinessStyle: i.buyer_business_style, seller: i.seller, vatRegistered: i.vat_registered, currency: i.currency,
  vatableSales: Number(i.vatable_sales), vatExemptSales: Number(i.vat_exempt_sales), zeroRatedSales: Number(i.zero_rated_sales), vatAmount: Number(i.vat_amount),
  totalSales: Number(i.total_sales), totalAmount: Number(i.total_amount), withholdingTax: Number(i.withholding_tax), amountPaid: Number(i.amount_paid), balance: Number(i.balance),
  paymentTerms: i.payment_terms, dueDate: i.due_date ? iso(i.due_date) : null, remarks: i.remarks, status: i.status, journalId: i.journal_id, cancelJournalId: i.cancel_journal_id,
  cancelReason: i.cancel_reason, cancelledAt: i.cancelled_at, printCount: i.print_count, createdBy: i.created_by, createdAt: i.created_at,
  eisStatus: i.eis_status ?? null,
  ...(lines ? { lines: lines.map(lineRow) } : {}), ...(payments ? { payments: payments.map(paymentRow) } : {}),
});
export const paymentRow = (p) => p && ({ id: p.id, invoiceId: p.invoice_id, ackNumber: p.ack_number, paymentDate: iso(p.payment_date), amount: Number(p.amount),
  ewtAmount: Number(p.ewt_amount), form2307No: p.form_2307_no, paymentMode: p.payment_mode, bankAccount: p.bank_account, referenceNo: p.reference_no,
  journalId: p.journal_id, status: p.status, cancelReason: p.cancel_reason, createdAt: p.created_at });

async function vatRate(db) {
  return (await taxCodeRate(db, await getSetting('direct_bill.commission_vat_code', 'VAT12-OUT'))).rate;
}

/** Buyer of an insurer. */
async function insurerBuyer(db, insurerId) {
  const ic = (await db.query('SELECT id, name, tin, address FROM insurance_companies WHERE id = $1', [insurerId])).rows[0];
  if (!ic) throw notFound('Insurer not found');
  const t = splitTin(ic.tin);
  return { buyerType: 'insurer', buyerId: String(ic.id), buyerName: ic.name, buyerTin: t.tin ? formatTin(t.tin) : '', buyerBranchCode: t.tin ? t.branch : '', buyerAddress: ic.address || '' };
}

/** Lines and buyer of an invoice made out for a source document. */
async function fromSource(db, type, sourceId) {
  if (type === 'debit_note') {
    const d = (await db.query('SELECT * FROM commission_debit_notes WHERE id::text = $1 OR dn_number = $1', [String(sourceId)])).rows[0];
    if (!d) throw notFound('Commission debit note not found');
    if (!['open', 'partial', 'collected'].includes(d.status)) throw conflict(`Debit note ${d.dn_number} is ${d.status}: only an approved debit note is invoiced`);
    return { sourceId: String(d.id), sourceReference: d.dn_number, buyer: await insurerBuyer(db, d.insurance_company_id), ewtRate: Number(d.ewt_rate) || 0,
      lines: [{ description: `Brokerage commission per debit note ${d.dn_number} (${iso(d.period_from)} to ${iso(d.period_to)})`, quantity: 1, unitPrice: Number(d.commission),
        vatClass: Number(d.vat) > 0 ? 'vatable' : 'exempt', vatAmount: Number(d.vat), reference: d.dn_number }] };
  }
  if (type === 'override_commission') {
    const c = (await db.query(`SELECT c.*, a.commission_type, a.ewt_rate FROM override_computations c JOIN override_agreements a ON a.id = c.agreement_id
      WHERE c.id = $1 OR c.computation_number = $1`, [String(sourceId)])).rows[0];
    if (!c) throw notFound('Overriding commission computation not found');
    if (!['approved', 'partially_settled', 'settled'].includes(c.status)) throw conflict(`Computation ${c.computation_number} is ${c.status}: only an approved computation is invoiced`);
    const label = { overriding: 'Overriding commission', profit: 'Profit commission', contingent: 'Contingent commission' }[c.commission_type] || 'Commission';
    return { sourceId: c.id, sourceReference: c.computation_number, buyer: await insurerBuyer(db, c.insurance_company_id), ewtRate: Number(c.ewt_rate) / 100,
      lines: [{ description: `${label} ${c.period_label} (${iso(c.period_from)} to ${iso(c.period_to)}) per computation ${c.computation_number}`, quantity: 1, unitPrice: Number(c.commission),
        vatClass: Number(c.vat) > 0 ? 'vatable' : 'exempt', vatAmount: Number(c.vat), reference: c.computation_number }] };
  }
  if (type === 'policy_commission') {
    const p = (await db.query('SELECT * FROM policies WHERE id = $1 OR policy_number = $1', [String(sourceId)])).rows[0];
    if (!p) throw notFound('Policy not found');
    if (!Number(p.commission_amount)) throw conflict(`Policy ${p.policy_number} has no commission`);
    if (!p.insurance_company_id) throw conflict(`Policy ${p.policy_number} has no insurer`);
    const rate = await vatRate(db);
    const commission = Number(p.commission_amount);
    const registered = (await getSetting('direct_bill.broker_vat_registered', true)) !== false;
    return { sourceId: p.id, sourceReference: p.policy_number, buyer: await insurerBuyer(db, p.insurance_company_id), ewtRate: Number(await getSetting('invoice.ewt_rate_insurer', 10)) / 100,
      lines: [{ description: `Brokerage commission, policy ${p.policy_number}`, quantity: 1, unitPrice: commission, vatClass: 'vatable',
        vatAmount: registered ? round2(commission * rate) : 0, policyNumber: p.policy_number, reference: p.policy_number }] };
  }
  throw badRequest(`Unknown invoice source ${type}`);
}

/** Documents that can still be invoiced: approved debit notes and overriding commission computations without an invoice. */
export async function invoiceCandidates(db, type) {
  if (type === 'debit_note') {
    return (await db.query(`SELECT d.id::text AS id, d.dn_number AS reference, d.dn_date AS date, ic.name AS buyer, d.commission, d.vat, d.amount AS total FROM commission_debit_notes d
      JOIN insurance_companies ic ON ic.id = d.insurance_company_id WHERE d.status IN ('open', 'partial', 'collected')
      AND NOT EXISTS (SELECT 1 FROM sales_invoices s WHERE s.source_type = 'debit_note' AND s.source_id = d.id::text AND s.status = 'issued') ORDER BY d.dn_date DESC LIMIT 200`)).rows
      .map((r) => ({ ...r, date: iso(r.date), commission: Number(r.commission), vat: Number(r.vat), total: Number(r.total) }));
  }
  if (type === 'override_commission') {
    return (await db.query(`SELECT c.id, c.computation_number AS reference, c.period_to AS date, ic.name AS buyer, c.commission, c.vat, c.receivable AS total FROM override_computations c
      JOIN insurance_companies ic ON ic.id = c.insurance_company_id WHERE c.status IN ('approved', 'partially_settled', 'settled')
      AND NOT EXISTS (SELECT 1 FROM sales_invoices s WHERE s.source_type = 'override_commission' AND s.source_id = c.id AND s.status = 'issued') ORDER BY c.period_to DESC LIMIT 200`)).rows
      .map((r) => ({ ...r, date: iso(r.date), commission: Number(r.commission), vat: Number(r.vat), total: Number(r.total) }));
  }
  return [];
}

/** Totals of invoice lines (VAT computed on manual VATable lines when the broker is VAT registered). */
function totals(lines, registered, rate) {
  const out = { vatable: 0, exempt: 0, zero: 0, vat: 0, sales: 0 };
  const priced = lines.map((l, i) => {
    const qty = Number(l.quantity ?? 1) || 1;
    const amount = round2(l.amount !== undefined ? Number(l.amount) : qty * Number(l.unitPrice || 0));
    if (amount <= 0) throw badRequest(`Line ${i + 1}: the amount must be more than zero`);
    const cls = registered ? (VAT_CLASSES.includes(l.vatClass) ? l.vatClass : 'vatable') : 'exempt';
    const vat = registered && cls === 'vatable' ? round2(l.vatAmount !== undefined ? Number(l.vatAmount) : amount * rate) : 0;
    if (registered) { if (cls === 'vatable') out.vatable += amount; else if (cls === 'exempt') out.exempt += amount; else out.zero += amount; }
    out.vat += vat; out.sales += amount;
    return { ...l, quantity: qty, unitPrice: round2(l.unitPrice ?? amount / qty), amount, vatClass: registered ? cls : 'exempt', vatAmount: vat };
  });
  for (const k of Object.keys(out)) out[k] = round2(out[k]);
  // a non-VAT registered seller shows total sales only: no VATable / exempt / zero-rated split
  if (!registered) { out.exempt = 0; }
  return { lines: priced, ...out, total: round2(out.sales + out.vat) };
}

/** Issue a sales invoice (number, snapshot of the seller, journal for a manual invoice, EIS queue). */
export async function issueInvoice(db, b, user) {
  const type = b.sourceType || 'manual';
  if (!SOURCE_TYPES.includes(type)) throw badRequest(`sourceType must be one of ${SOURCE_TYPES.join(', ')}`);
  const seller = await sellerSnapshot();
  if (!seller.tin) throw badRequest('The broker\'s TIN is missing: fill it in on Master > Company (primary company) before issuing invoices');
  const date = b.invoiceDate || (await today());
  let src = null;
  if (type !== 'manual') {
    if (!b.sourceId) throw badRequest('sourceId is required for an invoice made out for a document');
    src = await fromSource(db, type, b.sourceId);
    const dup = (await db.query('SELECT invoice_number FROM sales_invoices WHERE source_type = $1 AND source_id = $2 AND status = \'issued\'', [type, src.sourceId])).rows[0];
    if (dup) throw conflict(`${src.sourceReference} is already invoiced on ${dup.invoice_number}`);
  }
  const buyer = src ? { ...src.buyer, ...(b.buyer || {}) } : { buyerType: 'other', ...(b.buyer || {}) };
  if (!buyer.buyerName) throw badRequest('The buyer\'s name is required');
  const rate = await vatRate(db);
  const t = totals(src ? src.lines : (b.lines || []), seller.vatRegistered, rate);
  if (!t.lines.length) throw badRequest('An invoice needs at least one line');
  const threshold = Number(await getSetting('invoice.buyer_details_threshold', 1000)) || 0;
  if ((buyer.buyerType === 'insurer' || buyer.buyerBusinessStyle || t.total >= threshold) && (!String(buyer.buyerTin || '').replace(/\D/g, '') || !buyer.buyerAddress)) {
    throw badRequest(`The buyer's TIN and address are required on this invoice (business buyer or amount of PHP ${threshold} or more)`);
  }
  const incomeAccount = type === 'manual' ? (b.incomeAccount || null) : null;
  if (incomeAccount) {
    const a = (await db.query('SELECT 1 FROM gl_accounts WHERE code = $1 AND status = \'active\' AND account_type = \'income\'', [incomeAccount])).rows[0];
    if (!a) throw badRequest(`Income account ${incomeAccount} not found or not an active income account`);
  }
  const number = await nextDocumentNumber('sales_invoice', { db, date, unique: { table: 'sales_invoices', column: 'invoice_number' } });
  const serial = Number(String(number).replace(/\D/g, '').slice(-10));
  if (serial < seller.serialFrom || serial > seller.serialTo) throw conflict(`Invoice serial ${serial} is outside the registered range ${seller.serialFrom} to ${seller.serialTo} (invoice.serial_from / invoice.serial_to)`);
  const dueDays = Number(await getSetting('invoice.default_due_days', 30)) || 0;
  const dueDate = b.dueDate || new Date(Date.parse(`${date}T00:00:00Z`) + dueDays * 86400000).toISOString().slice(0, 10);
  const ewt = round2(t.sales * (src ? src.ewtRate : Number(b.ewtRate || 0) / 100));
  const inv = (await db.query(`INSERT INTO sales_invoices(invoice_number, invoice_date, source_type, source_id, source_reference, buyer_type, buyer_id, buyer_name, buyer_tin, buyer_branch_code,
      buyer_address, buyer_business_style, seller, vat_registered, currency, vatable_sales, vat_exempt_sales, zero_rated_sales, vat_amount, total_sales, total_amount, withholding_tax,
      amount_paid, balance, payment_terms, due_date, remarks, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,0,$21,$23,$24,$25,$26) RETURNING *`,
  [number, date, type, src?.sourceId || null, src?.sourceReference || b.reference || null, buyer.buyerType || 'other', buyer.buyerId || null, buyer.buyerName, buyer.buyerTin || null,
    buyer.buyerBranchCode || null, buyer.buyerAddress || null, buyer.buyerBusinessStyle || null, JSON.stringify(seller), seller.vatRegistered, b.currency || 'PHP',
    t.vatable, t.exempt, t.zero, t.vat, t.sales, t.total, ewt, b.paymentTerms || (dueDays ? `${dueDays} days` : null), dueDate, b.remarks || null, user?.id ?? null])).rows[0];
  let n = 0;
  for (const l of t.lines) {
    n += 1;
    await db.query(`INSERT INTO sales_invoice_lines(invoice_id, line_no, description, quantity, unit_price, amount, vat_class, vat_amount, gl_account, policy_number, reference)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [inv.id, n, l.description, l.quantity, l.unitPrice, l.amount, l.vatClass, l.vatAmount, incomeAccount, l.policyNumber || null, l.reference || null]);
  }
  if (type === 'manual') {
    const jv = await postEvent('sales_invoice.issue', { date, transactionCode: number, referenceType: 'sales_invoice', referenceId: inv.id,
      amounts: { receivable: t.total, income: t.sales, vat: t.vat }, accounts: incomeAccount ? { income: incomeAccount } : {}, vars: { invoiceNumber: number, buyer: buyer.buyerName } }, { db, user });
    await db.query('UPDATE sales_invoices SET journal_id = $2 WHERE id = $1', [inv.id, jv.id]);
  } else {
    // the revenue of a debit note, a computation or a policy is already booked: the invoice carries nothing to collect here
    await db.query('UPDATE sales_invoices SET balance = 0 WHERE id = $1', [inv.id]);
  }
  await enqueueInvoice(db, inv.id, 'invoice', user);
  return getInvoice(db, inv.id);
}

export async function getInvoice(db, id) {
  const i = (await db.query(`SELECT s.*, (SELECT e.status FROM eis_submissions e WHERE e.invoice_id = s.id ORDER BY e.created_at DESC LIMIT 1) AS eis_status
    FROM sales_invoices s WHERE s.id = $1 OR s.invoice_number = $1`, [String(id)])).rows[0];
  if (!i) throw notFound('Sales invoice not found');
  const lines = (await db.query('SELECT * FROM sales_invoice_lines WHERE invoice_id = $1 ORDER BY line_no', [i.id])).rows;
  const payments = (await db.query('SELECT * FROM sales_invoice_payments WHERE invoice_id = $1 ORDER BY created_at', [i.id])).rows;
  return invoiceRow(i, lines, payments);
}

export async function listInvoices(db, q = {}) {
  const rows = (await db.query(`SELECT s.*, (SELECT e.status FROM eis_submissions e WHERE e.invoice_id = s.id ORDER BY e.created_at DESC LIMIT 1) AS eis_status FROM sales_invoices s
    WHERE ($1::date IS NULL OR s.invoice_date >= $1) AND ($2::date IS NULL OR s.invoice_date <= $2) AND ($3::text IS NULL OR s.status = $3)
      AND ($4::text IS NULL OR s.invoice_number ILIKE '%' || $4 || '%' OR s.buyer_name ILIKE '%' || $4 || '%' OR s.source_reference ILIKE '%' || $4 || '%')
      AND ($5::text IS NULL OR s.source_type = $5)
    ORDER BY s.invoice_number DESC LIMIT 1000`, [q.from || null, q.to || null, q.status || null, q.search || null, q.sourceType || null])).rows;
  return rows.map((r) => invoiceRow(r));
}

/** Cancel an invoice with a reason: kept with its number, the manual invoice's journal reversed, the EIS told. */
export async function cancelInvoice(db, id, reason, user) {
  const inv = (await db.query('SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!inv) throw notFound('Sales invoice not found');
  if (inv.status !== 'issued') throw conflict(`Invoice ${inv.invoice_number} is ${inv.status}`);
  const paid = (await db.query('SELECT count(*)::int AS n FROM sales_invoice_payments WHERE invoice_id = $1 AND status = \'posted\'', [id])).rows[0].n;
  if (paid) throw conflict(`Invoice ${inv.invoice_number} has payments: cancel the payment acknowledgements first`);
  let rev = null;
  if (inv.journal_id) rev = await reverseJournal(db, inv.journal_id, user, { description: `Cancellation of sales invoice ${inv.invoice_number}: ${reason}` });
  await db.query(`UPDATE sales_invoices SET status = 'cancelled', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), cancel_journal_id = $4, balance = 0, updated_at = now() WHERE id = $1`,
    [id, reason, user?.id ?? null, rev?.id || null]);
  await enqueueInvoice(db, id, 'cancellation', user);
  return getInvoice(db, id);
}

/** Record a payment on a manual invoice: payment acknowledgement number and the payment journal. */
export async function recordPayment(db, id, b, user) {
  const inv = (await db.query('SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!inv) throw notFound('Sales invoice not found');
  if (inv.status !== 'issued') throw conflict(`Invoice ${inv.invoice_number} is ${inv.status}`);
  if (inv.source_type !== 'manual') {
    throw conflict(`Invoice ${inv.invoice_number} is for ${inv.source_reference}: record the payment there (direct-bill collection or overriding commission settlement)`);
  }
  const amount = round2(b.amount); const ewt = round2(b.ewtAmount || 0);
  if (amount < 0 || ewt < 0 || amount + ewt <= 0) throw badRequest('The amount received and the tax withheld cannot be negative, and one of them must be more than zero');
  const applied = round2(amount + ewt);
  if (applied - Number(inv.balance) > 0.005) throw badRequest(`The payment (${applied.toFixed(2)}) is more than the balance of the invoice (${Number(inv.balance).toFixed(2)})`);
  const date = b.paymentDate || (await today());
  const ack = await nextDocumentNumber('invoice_payment', { db, date, unique: { table: 'sales_invoice_payments', column: 'ack_number' } });
  const jv = await postEvent('sales_invoice.payment', { date, transactionCode: ack, referenceType: 'sales_invoice', referenceId: inv.id, paymentMode: b.paymentMode || 'bank-transfer',
    bankAccount: b.bankAccount || null, amounts: { cash: amount, ewt, applied }, vars: { ackNumber: ack, invoiceNumber: inv.invoice_number, buyer: inv.buyer_name, form2307: b.form2307No || '' } }, { db, user });
  const p = (await db.query(`INSERT INTO sales_invoice_payments(invoice_id, ack_number, payment_date, amount, ewt_amount, form_2307_no, payment_mode, bank_account, reference_no, journal_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [id, ack, date, amount, ewt, b.form2307No || null, b.paymentMode || null, b.bankAccount || null, b.referenceNo || null, jv.id, user?.id ?? null])).rows[0];
  await db.query('UPDATE sales_invoices SET amount_paid = amount_paid + $2, balance = balance - $2, updated_at = now() WHERE id = $1', [id, applied]);
  return paymentRow(p);
}

export async function cancelPayment(db, paymentId, reason, user) {
  const p = (await db.query('SELECT * FROM sales_invoice_payments WHERE id = $1 FOR UPDATE', [paymentId])).rows[0];
  if (!p) throw notFound('Payment not found');
  if (p.status !== 'posted') throw conflict(`Payment ${p.ack_number} is ${p.status}`);
  const rev = p.journal_id ? await reverseJournal(db, p.journal_id, user, { description: `Cancellation of payment ${p.ack_number}: ${reason}` }) : null;
  await db.query('UPDATE sales_invoice_payments SET status = \'cancelled\', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), cancel_journal_id = $4 WHERE id = $1',
    [paymentId, reason, user?.id ?? null, rev?.id || null]);
  const applied = round2(Number(p.amount) + Number(p.ewt_amount));
  await db.query('UPDATE sales_invoices SET amount_paid = amount_paid - $2, balance = balance + $2, updated_at = now() WHERE id = $1', [p.invoice_id, applied]);
  return paymentRow({ ...p, status: 'cancelled', cancel_reason: reason });
}

const m2 = (v) => round2(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Printable sales invoice (PDF) with every field RR 7-2024 lists. */
export async function invoicePdf(inv) {
  const s = inv.seller || {};
  const permit = [s.atpNumber && `ATP / acknowledgement no. ${s.atpNumber}${s.atpDateIssued ? ` issued ${s.atpDateIssued}` : ''}${s.atpValidUntil ? `, valid until ${s.atpValidUntil}` : ''}`,
    s.casPermitNumber && `CAS Permit to Use / acknowledgement no. ${s.casPermitNumber}${s.casPermitDate ? ` dated ${s.casPermitDate}` : ''}`,
    `Serial nos. ${s.serialFrom} to ${s.serialTo}`, s.printerDetails].filter(Boolean).join('. ');
  const footer = (await getSetting('invoice.footer_note', '')) || '';
  const breakdown = inv.vatRegistered
    ? [['VATable sales', m2(inv.vatableSales)], ['VAT-exempt sales', m2(inv.vatExemptSales)], ['Zero-rated sales', m2(inv.zeroRatedSales)], ['Total sales (net of VAT)', m2(inv.totalSales)],
      ['VAT', m2(inv.vatAmount)], ['TOTAL AMOUNT DUE', m2(inv.totalAmount)]]
    : [['Total sales', m2(inv.totalSales)], ['TOTAL AMOUNT DUE', m2(inv.totalAmount)]];
  if (inv.withholdingTax) breakdown.push(['Less: creditable withholding tax expected (BIR Form 2307)', m2(inv.withholdingTax)], ['Net amount payable after withholding', m2(inv.totalAmount - inv.withholdingTax)]);
  return renderPdf({
    title: inv.status === 'cancelled' ? 'SALES INVOICE (CANCELLED)' : 'SALES INVOICE', number: inv.invoiceNumber,
    meta: [['Date', inv.invoiceDate], ['Seller (registered name)', s.registeredName], ['Business style / trade name', s.tradeName], ['TIN (with branch code)', s.tinFormatted],
      ['Business address', s.address], [inv.vatRegistered ? 'VAT REGISTERED' : 'NON-VAT REGISTERED', inv.vatRegistered ? 'VAT Reg. TIN' : 'Not subject to VAT'],
      ['Sold to', inv.buyerName], ['Buyer TIN', inv.buyerTin ? `${inv.buyerTin}${inv.buyerBranchCode ? `-${inv.buyerBranchCode}` : ''}` : '-'], ['Buyer address', inv.buyerAddress || '-'],
      ['Buyer business style', inv.buyerBusinessStyle || '-'], ['Terms', inv.paymentTerms || '-'], ['Due date', inv.dueDate || '-'], ['Reference', inv.sourceReference || '-']],
    sections: [
      { heading: 'Particulars', table: { columns: ['Description', { label: 'Qty', type: 'number' }, { label: 'Unit price', type: 'money' }, 'VAT class', { label: 'Amount', type: 'money' }],
        rows: (inv.lines || []).map((l) => [l.description, l.quantity, l.unitPrice, inv.vatRegistered ? l.vatClass.replace('_', '-') : '-', l.amount]) } },
      { heading: 'Amounts (PHP)', rows: breakdown, columns: 1 },
      { heading: 'Amount in words', text: amountInWords(inv.totalAmount, inv.currency) },
      ...(inv.status === 'cancelled' ? [{ heading: 'Cancelled', text: `Cancelled: ${inv.cancelReason || ''}` }] : []),
      { signatures: [{ label: 'Authorized representative' }, { label: 'Received by (buyer)' }] },
      { note: permit },
    ],
    footerNote: footer || undefined,
  });
}

/** Payment acknowledgement (supplementary document) of a payment on an invoice. */
export async function paymentPdf(inv, p) {
  const title = (await getSetting('invoice.payment_document_title', 'Payment Acknowledgement')) || 'Payment Acknowledgement';
  const note = (await getSetting('invoice.supplementary_note', 'THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.')) || '';
  const s = inv.seller || {};
  return renderPdf({
    title: p.status === 'cancelled' ? `${title.toUpperCase()} (CANCELLED)` : title.toUpperCase(), number: p.ackNumber,
    meta: [['Date', p.paymentDate], ['Issued by', `${s.registeredName} (TIN ${s.tinFormatted})`], ['Received from', inv.buyerName], ['Buyer TIN', inv.buyerTin || '-'],
      ['For sales invoice', `${inv.invoiceNumber} dated ${inv.invoiceDate}`], ['Amount received', m2(p.amount)], ['Creditable tax withheld', m2(p.ewtAmount)],
      ['BIR Form 2307 no.', p.form2307No || '-'], ['Payment mode', p.paymentMode || '-'], ['Reference', p.referenceNo || '-']],
    sections: [{ heading: 'Amount in words', text: amountInWords(p.amount, inv.currency) }, { signatures: [{ label: 'Received by' }] }, { note }],
    footerNote: note,
  });
}
