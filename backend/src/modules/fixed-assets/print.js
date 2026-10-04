/** Printed fixed asset disposal voucher: the asset, the figures of the disposal and its journal. */
import { renderPdf, formatAmount, formatDate, printFormat } from '../../lib/pdf/index.js';
import { getDisposal } from './service.js';

export async function disposalPdf(db, id) {
  const d = await getDisposal(db, id);
  const fmt = await printFormat();
  const m = (v) => formatAmount(v, fmt.decimals);
  const lines = d.journalId ? (await db.query('SELECT account_code, account_name, memo, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [d.journalId])).rows : [];
  const sale = d.disposalType === 'sale';
  return { fileName: `${d.disposalNumber}.pdf`, pdf: await renderPdf({
    title: sale ? 'Fixed Asset Disposal Voucher (Sale)' : 'Fixed Asset Disposal Voucher (Write-off)', number: d.disposalNumber, dateLine: `Date ${formatDate(d.disposalDate, fmt)}`,
    meta: [['Asset', `${d.assetNumber} ${d.assetName}`], ['Asset class', d.className || d.classCode], ...(sale ? [['Buyer', d.buyerName], ['Buyer TIN', d.buyerTin || ''],
      ['Sales invoice', d.salesInvoiceNumber || '']] : []), ['Status', d.status === 'cancelled' ? `CANCELLED (${d.cancelReason || ''})` : 'Posted']].filter(([, v]) => v),
    sections: [
      { columns: 1, rows: [['Cost', m(d.cost)], ['Accumulated depreciation', m(d.accumulatedDepreciation)], ['Book value', m(d.bookValue)],
        ...(sale ? [['Selling price (net of VAT)', m(d.proceeds)], [`Output VAT${d.vatCode ? ` (${d.vatCode})` : ''}`, m(d.outputVat)], ['Total proceeds', m(d.grossProceeds)]] : []),
        [d.gainLoss >= 0 ? 'Gain on disposal' : 'Loss on disposal', m(Math.abs(d.gainLoss))]] },
      ...(d.reason ? [{ heading: 'Reason', text: d.reason }] : []),
      { heading: 'Accounting entry', table: { columns: [{ key: 'account', label: 'Account' }, { key: 'name', label: 'Account name' }, { key: 'memo', label: 'Particulars' },
        { key: 'debit', label: 'Debit', type: 'amount' }, { key: 'credit', label: 'Credit', type: 'amount' }],
      rows: lines.map((l) => ({ account: l.account_code, name: l.account_name, memo: l.memo || '', debit: Number(l.debit) || null, credit: Number(l.credit) || null })),
      totals: { account: 'TOTAL', debit: lines.reduce((s, l) => s + Number(l.debit), 0), credit: lines.reduce((s, l) => s + Number(l.credit), 0) } } },
      { signatures: [{ label: 'Prepared by', name: d.createdBy || '' }, 'Approved by', sale ? { label: 'Received by (buyer)', name: d.buyerName || '' } : 'Custodian'], perRow: 3 },
    ],
  }) };
}
