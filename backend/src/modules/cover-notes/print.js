/** The printed cover note: company letterhead, the cover, the wording of cover_note.wording and the signature block. */
import { getSetting } from '../../lib/settings.js';
import { renderPdf, formatAmount, formatDate, printFormat } from '../../lib/pdf/index.js';
import { companyName } from '../../lib/letterhead.js';

export async function coverNotePdf(cn) {
  const fmt = await printFormat();
  const d = (v) => (v ? formatDate(v, fmt) : '');
  const money = (v) => `${cn.currency || fmt.currency} ${formatAmount(v, fmt.decimals)}`;
  const wording = (await getSetting('cover_note.wording', '')) || '';
  const company = await companyName();
  const statusNote = cn.status === 'active' ? null : `This cover note is ${cn.status}${cn.policyNumber ? `: policy ${cn.policyNumber} was issued` : ''}.`;
  return renderPdf({
    title: 'Cover Note', number: cn.coverNoteNumber, dateLine: `Issued ${d(cn.createdAt)}`,
    meta: [['Insured', cn.insuredName || cn.clientName || ''], ['Insurer', cn.insurerName || ''], ['Reference', cn.quoteNumber || cn.placementNumber || '']].filter(([, v]) => v),
    sections: [
      ...(statusNote ? [{ note: statusNote }] : []),
      { heading: 'Cover', columns: 2, rows: [
        ['Insured', cn.insuredName || cn.clientName || ''], ['Client code', cn.clientCode || ''],
        ['Insurer', cn.insurerName || ''], ['Insurer reference', cn.insurerReference || ''],
        ['Product', cn.productName || cn.lob || ''], ['Line of business', cn.lob || ''],
        ['Period of cover', `${d(cn.coverFrom)} to ${d(cn.coverTo)} (${cn.validityDays} days)`], ['Status', cn.status],
        ['Sum insured', money(cn.sumInsured)], ['Premium (indicative)', money(cn.premiumTotal)],
      ].filter(([, v]) => v !== '') },
      ...(cn.riskDescription ? [{ heading: 'Risk insured', text: cn.riskDescription }] : []),
      ...(cn.conditions ? [{ heading: 'Special conditions', text: cn.conditions }] : []),
      ...(wording ? [{ heading: 'Terms of this cover note', text: wording }] : []),
      { signatures: [{ label: 'Authorised signatory', name: company }, { label: 'Received by the insured' }], perRow: 2 },
    ],
  });
}
