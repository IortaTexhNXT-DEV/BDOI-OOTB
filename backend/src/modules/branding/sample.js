/**
 * Sample document of the theme editor: a short quotation slip printed with a theme that is not saved yet, so the
 * administrator sees the document colours, the logo size and the footer line before saving.
 */
import { buildPdf, printContext } from '../../lib/pdf/index.js';
import { formatDate } from '../../lib/pdf/format.js';

export async function samplePdf(theme) {
  const ctx = await printContext({ theme });
  const day = formatDate(new Date(), ctx.format);
  return buildPdf({
    ...ctx, title: 'Quotation Slip (sample)', number: 'QT-SAMPLE-0001', watermark: 'SAMPLE',
    meta: [['Date', day], ['Customer', 'Juan Dela Cruz'], ['Product', 'Motor - Comprehensive'], ['Insurer', 'Sample Insurance Corporation'], ['Currency', ctx.format.currency]],
    sections: [
      { heading: 'Vehicle', rows: [['Brand', 'Toyota'], ['Model', 'Vios 1.3 XLE CVT'], ['Year', '2025'], ['Plate number', 'NBC 1234']] },
      { heading: `Premium (${ctx.format.currency})`, table: { columns: ['Item', { label: 'Amount', type: 'money' }], widths: [375, 140],
        rows: [['Net premium', 18250], ['Value added tax (VAT)', 2190], ['Documentary stamp tax (DST)', 2281.25], ['Gross premium', 22721.25]], totalRow: true } },
      { heading: 'Remarks', text: 'This sample shows the document colours, the logo and the footer line of the theme being edited.' },
      { signatures: [{ label: `For ${ctx.letterhead?.name || 'the broker'}`, name: 'Authorised signatory', title: 'Designation' }], perRow: 2 },
    ],
  });
}
