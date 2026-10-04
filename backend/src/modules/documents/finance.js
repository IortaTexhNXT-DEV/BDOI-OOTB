/**
 * Finance documents on the shared engine: billing statements (policy / endorsement / renewal), official receipts in
 * bulk (one receipt per page) and payment vouchers (one voucher per page: payee, amount in figures and words,
 * particulars, account distribution, signature blocks).
 */
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { amountInWords, humanize } from '../../lib/pdf/format.js';
import { buildPdfBatch } from '../../lib/pdf/index.js';
import { today } from '../../lib/dates.js';
import { header, formatters, kv, receiptDoc, paymentModeLabel } from './templates.js';
import { num } from './common.js';

const DEFAULT_INSTRUCTIONS = 'Please settle the total amount due on or before the due date. Make cheques payable to {{companyName}} and quote the bill number as the payment reference. For bank transfers or e-wallet payments, send the proof of payment to your account officer.';

/** Payment instructions printed on billing statements (documents.payment_instructions; {{companyName}} placeholder). */
async function paymentInstructions(company) {
  const t = (await getSetting('documents.payment_instructions', DEFAULT_INSTRUCTIONS)) || DEFAULT_INSTRUCTIONS;
  return String(t).replace(/\{\{\s*companyName\s*\}\}/g, company || 'the company');
}

/**
 * Billing statement spec. `kind` Policy | Endorsement | Renewal; `policy` a receivables#findPolicy row; `bills`
 * receivables rows; `extra` [[label, value]] rows about the endorsement / renewal (or a function of the formatters);
 * `unbilled` { label, amount } is what is due while no bill has been raised (default: the policy gross premium).
 */
export async function billingStatementDoc(kind, { policy: p, bills, extra = [], number, client = null, unbilled = null }) {
  const h = await header(`${kind} Billing Statement`, number || p.policy_number);
  const f = formatters(h);
  const currency = p.currency || h.format?.currency || 'PHP';
  const billTo = client ? [client.display_name, client.address, [client.city, client.state].filter(Boolean).join(', ')].filter(Boolean).join('\n') : p.client_name;
  // a migrated open item that carries another number shows the old system's bill number with it
  const billNo = (b) => (b.source === 'opening' && b.reference && b.reference !== b.bill_number ? `${b.bill_number} (old system ${b.reference})` : b.bill_number);
  const rows = bills.map((b) => [billNo(b), f.date(b.created_at), f.date(b.due_date), round2(num(b.amount)), round2(num(b.amount) - num(b.balance)), round2(num(b.balance)), humanize(b.status)]);
  const total = (i) => round2(rows.reduce((s, r) => s + r[i], 0));
  const due = total(5);
  const more = kv(typeof extra === 'function' ? extra(f) : extra);
  return { ...h, dateLine: `Statement date ${f.date(await today())}`,
    meta: kv([['Bill to', billTo], ['Customer code', p.client_code], ['Policy number', p.policy_number], ['Insurer', p.insurer_name], ['Product', p.product_name || p.product_type],
      ['Period of cover', `${f.date(p.inception_date) || '-'} to ${f.date(p.expiry_date) || '-'}`], ['Currency', currency]]),
    sections: [
      ...(more.length ? [{ heading: `${kind} details`, rows: more }] : []),
      rows.length ? { heading: `Bills (${currency})`, table: { columns: ['Bill no.', { label: 'Bill date', type: 'date' }, { label: 'Due date', type: 'date' }, { label: 'Amount', type: 'money' },
        { label: 'Paid', type: 'money' }, { label: 'Balance', type: 'money' }, 'Status'], rows: [...rows, ['TOTAL', '', '', total(3), total(4), due, '']], totalRow: true } }
        : { heading: 'Bills', text: `No bills have been raised yet. ${unbilled?.label || 'Gross premium'}: ${f.ccy(unbilled ? unbilled.amount : p.premium_total, currency)}.` },
      { heading: 'Amount due', rows: [['Total amount due', f.ccy(rows.length ? due : (unbilled ? unbilled.amount : p.premium_total), currency), { bold: true }]], columns: 1 },
      { heading: 'Payment instructions', text: await paymentInstructions(h.letterhead?.name) },
    ] };
}

/** Official receipts, one per page group, with the lines each receipt applied (receipt_lines). */
export async function receiptsPdf(db, receipts) {
  const h = await header('Official Receipt', '');
  const specs = [];
  for (const r of receipts) {
    const lines = (await db.query('SELECT * FROM receipt_lines WHERE receipt_id = $1 ORDER BY line_no', [r.id]).catch(() => ({ rows: [] }))).rows;
    specs.push(await receiptDoc(r, lines, h));
  }
  const batchTitle = (await getSetting('receipts.print_title', 'Official Receipts')) || 'Official Receipts';
  return buildPdfBatch(specs, { title: receipts.length === 1 ? `Official Receipt ${receipts[0].receipt_number}` : batchTitle });
}

/** Payment voucher spec for one disbursement row with its invoice lines and journal lines. */
export async function voucherDoc(d, { lines = [], journal = [], names = {} }, h0) {
  const h = { ...(h0 || await header('Payment Voucher', '')), title: 'Payment Voucher', number: d.voucher_number };
  const f = formatters(h);
  const currency = d.instrument_currency || h.format?.currency || 'PHP';
  const gross = round2(num(d.gross_amount));
  const net = round2(num(d.amount));
  const wht = round2(num(d.wht_amount));
  const other = round2(gross - wht - net);
  const breakdown = gross > 0 && gross !== net
    ? [['Gross amount', gross], ...(wht ? [['Less: withholding tax', -wht]] : []), ...(other ? [['Less: commission and other deductions', -other]] : []), ['Net amount payable', net]]
    : [['Amount payable', net]];
  const particulars = lines.length
    ? { columns: ['Invoice no.', 'Policy no.', { label: 'Payables', type: 'money' }, { label: 'Commission', type: 'money' }, { label: 'VAT', type: 'money' }, { label: 'WHT', type: 'money' }, { label: 'Amount', type: 'money' }],
      rows: [...lines.map((l) => [l.invoice_number, l.policy_number, round2(num(l.payables)), round2(num(l.comsub)), round2(num(l.vat)), round2(num(l.wht)), round2(num(l.total_amount))]),
        ['TOTAL', '', ...['payables', 'comsub', 'vat', 'wht', 'total_amount'].map((k) => round2(lines.reduce((s, l) => s + num(l[k]), 0)))]], totalRow: true }
    : { columns: ['Particulars', { label: 'Amount', type: 'money' }], widths: [375, 140], rows: [[d.transaction_description || d.purpose || d.remarks || 'Payment', gross || net]] };
  const dist = journal.length ? { columns: ['Account code', 'Account name', 'Memo', { label: 'Debit', type: 'money' }, { label: 'Credit', type: 'money' }],
    rows: [...journal.map((j) => [j.account_code, j.account_name, j.memo || '', round2(num(j.debit)), round2(num(j.credit))]),
      ['TOTAL', '', '', round2(journal.reduce((s, j) => s + num(j.debit), 0)), round2(journal.reduce((s, j) => s + num(j.credit), 0))]], totalRow: true } : null;
  return { ...h,
    meta: kv([['Voucher date', f.date(d.voucher_date)], ['Status', humanize(d.status)], ['Payee', d.payee_name || d.insurer_name || d.referrer_name, { bold: true }], ['Payee type', d.payee_type],
      ['Amount', f.ccy(net, currency), { bold: true }], ['Payment mode', paymentModeLabel(d.payment_mode)], ['Reference', d.reference_no], ['Transaction no.', d.transaction_number],
      ['Policy no.', d.policy_number], ['Customer code', d.customer_code], ['Paid on', f.date(d.paid_at)]]),
    sections: [
      { heading: 'Amount in words', text: amountInWords(net, currency), bold: true },
      { heading: `Particulars (${currency})`, table: particulars },
      { heading: `Amount payable (${currency})`, table: { columns: ['Item', { label: 'Amount', type: 'money' }], widths: [375, 140], rows: breakdown, totalRow: true } },
      dist ? { heading: 'Account distribution', table: dist } : null,
      d.remarks ? { heading: 'Remarks', text: d.remarks } : null,
      { signatures: [{ label: 'Prepared by', name: names.prepared }, { label: 'Checked by' }, { label: 'Approved by', name: names.approved }, { label: 'Received by' }] },
    ] };
}

/** Payment vouchers (one per page group) for disbursement rows. */
export async function vouchersPdf(db, rows) {
  const h = await header('Payment Voucher', '');
  const userName = async (id) => (id ? (await db.query('SELECT display_name, username FROM users WHERE id::text = $1', [String(id)])).rows[0] : null);
  const specs = [];
  for (const d of rows) {
    const lines = (await db.query('SELECT * FROM invoice_lists WHERE disbursement_id = $1 ORDER BY invoice_number', [d.id])).rows;
    const journal = d.journal_id ? (await db.query('SELECT * FROM journal_lines WHERE jv_id = $1 ORDER BY line_no NULLS LAST, id', [d.journal_id])).rows : [];
    const prepared = await userName(d.created_by);
    const approved = await userName(d.approved_by);
    specs.push(await voucherDoc(d, { lines, journal, names: { prepared: prepared?.display_name || prepared?.username, approved: approved?.display_name || approved?.username } }, h));
  }
  return buildPdfBatch(specs, { title: rows.length === 1 ? `Payment Voucher ${rows[0].voucher_number}` : 'Payment Vouchers' });
}
