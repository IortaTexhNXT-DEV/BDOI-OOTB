/** Printed AP voucher (supplier invoice with its journal) and supplier payment voucher. */
import { renderPdf, formatAmount, formatDate, printFormat, amountInWords } from '../../lib/pdf/index.js';
import { getInvoice, getPayment } from './service.js';

async function journalTable(db, journalId) {
  if (!journalId) return [];
  const lines = (await db.query('SELECT account_code, account_name, memo, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [journalId])).rows;
  return [{ heading: 'Accounting entry', table: { columns: [{ key: 'account', label: 'Account' }, { key: 'name', label: 'Account name' }, { key: 'memo', label: 'Particulars' },
    { key: 'debit', label: 'Debit', type: 'amount' }, { key: 'credit', label: 'Credit', type: 'amount' }],
  rows: lines.map((l) => ({ account: l.account_code, name: l.account_name, memo: l.memo || '', debit: Number(l.debit) || null, credit: Number(l.credit) || null })),
  totals: { account: 'TOTAL', debit: lines.reduce((s, l) => s + Number(l.debit), 0), credit: lines.reduce((s, l) => s + Number(l.credit), 0) } } }];
}

export async function invoicePdf(db, id) {
  const inv = await getInvoice(db, id);
  const fmt = await printFormat();
  const m = (v) => formatAmount(v, fmt.decimals);
  return { fileName: `${inv.voucherNumber}.pdf`, pdf: await renderPdf({
    title: 'Accounts Payable Voucher', number: inv.voucherNumber, dateLine: `Date ${formatDate(inv.invoiceDate, fmt)}`,
    meta: [['Supplier', inv.supplierName], ['TIN', inv.supplierTin || ''], ['Supplier invoice', inv.supplierInvoiceNo], ['Due date', formatDate(inv.dueDate, fmt)], ['Status', inv.status]].filter(([, v]) => v),
    sections: [
      { heading: 'Invoice lines', table: { columns: [{ key: 'description', label: 'Description' }, { key: 'account', label: 'Account' }, { key: 'amount', label: 'Amount', type: 'amount' },
        { key: 'vat', label: 'Input VAT', type: 'amount' }], rows: inv.lines.map((l) => ({ description: l.description, account: `${l.accountCode} ${l.accountName || ''}`.trim(), amount: l.amount, vat: l.vatAmount })) } },
      { columns: 1, rows: [['Net of VAT', m(inv.netAmount)], [`Input VAT${inv.vatCode ? ` (${inv.vatCode})` : ''}`, m(inv.inputVat)], ['Gross amount', m(inv.grossAmount)],
        [`EWT withheld${inv.ewtCode ? ` (${inv.ewtCode}, ${inv.ewtRate}%)` : ''}`, m(inv.ewtAmount)], ['Payable to the supplier', m(inv.payableAmount)], ['Balance', m(inv.balance)]] },
      ...(inv.description ? [{ heading: 'Particulars', text: inv.description }] : []),
      ...(await journalTable(db, inv.journalId)),
      { signatures: [{ label: 'Prepared by', name: inv.createdBy || '' }, { label: 'Approved by', name: inv.approvedBy || '' }], perRow: 2 },
    ],
  }) };
}

export async function paymentPdf(db, id) {
  const p = await getPayment(db, id);
  const fmt = await printFormat();
  return { fileName: `${p.paymentNumber}.pdf`, pdf: await renderPdf({
    title: 'Supplier Payment Voucher', number: p.paymentNumber, dateLine: `Date ${formatDate(p.paymentDate, fmt)}`,
    meta: [['Payee', p.supplierName], ['Mode', p.paymentMode], ['Cheque no.', p.chequeNumber || ''], ['Paid from', p.payFromAccount], ['Status', p.status]].filter(([, v]) => v),
    sections: [
      { columns: 1, rows: [['Amount', `${fmt.currency} ${formatAmount(p.amount, fmt.decimals)}`], ['Amount in words', amountInWords(p.amount, fmt.currency)]] },
      { heading: 'Invoices paid', table: { columns: [{ key: 'voucher', label: 'AP voucher' }, { key: 'invoice', label: 'Supplier invoice' }, { key: 'amount', label: 'Amount', type: 'amount' }],
        rows: p.allocations.map((a) => ({ voucher: a.voucherNumber, invoice: a.supplierInvoiceNo, amount: a.amount })) } },
      ...(await journalTable(db, p.journalId)),
      { signatures: [{ label: 'Prepared by', name: p.createdBy || '' }, 'Approved by', { label: 'Received by', name: p.supplierName }], perRow: 3 },
    ],
  }) };
}
