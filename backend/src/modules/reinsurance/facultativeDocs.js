/**
 * Documents of a facultative placement (lib/pdf specs):
 *   slip         the facultative slip sent to the reinsurers: risk, terms, the share offered and the security approached
 *   cover-note   the reinsurance cover note to the cedant: the signed lines, premium, reinsurance commission, net due
 *   debit-note   the debit note to the cedant for the facultative premium net of its reinsurance commission
 *   credit-note  the credit note to one reinsurer (shareId) for its net premium
 */
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { header, formatters, kv } from '../documents/templates.js';
import { signatoryFor, signatureBlock } from '../documents/signatory.js';
import { getPlacement } from './facultative.js';

const TITLES = { slip: 'Facultative Reinsurance Slip', 'cover-note': 'Reinsurance Cover Note', 'debit-note': 'Debit Note', 'credit-note': 'Credit Note' };
export const FAC_DOCUMENTS = Object.keys(TITLES);

export async function facDocumentSpec(placementId, kind = 'slip', shareId = null) {
  if (!TITLES[kind]) throw badRequest(`Unknown document ${kind}; one of ${FAC_DOCUMENTS.join(', ')}`);
  const p = await getPlacement(placementId);
  const bound = ['bound', 'closed'].includes(p.status);
  if (kind !== 'slip' && !bound) throw badRequest(`The ${TITLES[kind].toLowerCase()} is issued once the slip is bound`);
  const share = shareId ? p.shares.find((s) => s.id === Number(shareId)) : null;
  if (kind === 'credit-note' && !share) throw notFound('Choose the reinsurer line of the credit note');
  const h = await header(TITLES[kind], kind === 'credit-note' ? `${p.slipNumber}-${share.id}` : p.slipNumber);
  const f = formatters(h);
  const ccy = (v) => f.ccy(v, p.currency);
  const signatory = await signatoryFor(null);
  const risk = { heading: 'Risk', rows: kv([['Original insured', p.insuredName], ['Cedant', p.cedantName], ['Original policy', p.cedantPolicyNumber], ['Class', p.lineOfBusiness],
    ['Risk', p.riskDescription], ['Location', p.riskLocation], ['Period', `${f.date(p.periodFrom)} to ${f.date(p.periodTo)}`]]) };
  const terms = { heading: 'Terms', rows: kv([['Sum insured (100%)', ccy(p.sumInsured)], ['Premium (100%)', ccy(p.grossPremium)], ['Facultative share offered', `${p.facSharePct}%`],
    ['Sum insured (facultative share)', ccy(p.facSumInsured)], ['Premium (facultative share)', ccy(p.facPremium)], ['Reinsurance commission', `${p.cedingCommissionPct}%`],
    ['Brokerage', `${p.brokeragePct}%`], ['Deductibles', p.deductibles], ['Conditions', p.conditions], ['Claims', p.claimsBasis]]) };
  const accepted = p.shares.filter((s) => s.status === 'accepted');
  if (kind === 'slip') {
    return { ...h, meta: kv([['Slip', p.slipNumber], ['Status', p.status], ['Currency', p.currency]]), sections: [risk, terms,
      { heading: 'Security', table: { columns: [{ key: 'reinsurerName', label: 'Reinsurer' }, { key: 'rating', label: 'Rating' }, { key: 'status', label: 'Status' },
        { key: 'line', label: 'Written line % of share', type: 'number' }, { key: 'reference', label: 'Reference' }],
      rows: p.shares.map((s) => ({ reinsurerName: s.reinsurerName, rating: s.rating || '', status: s.status, line: s.sharePct, reference: s.reinsurerReference || '' })) } },
      { text: (await getSetting('reinsurance.fac_slip_wording', null)) || '' },
      { signatures: [signatureBlock('Reinsurance broker', signatory), 'Reinsurer (stamp, line and signature)'] }] };
  }
  if (kind === 'cover-note') {
    return { ...h, meta: kv([['To', p.cedantName], ['Slip', p.slipNumber], ['Bound on', f.date(String(p.boundAt || '').slice(0, 10))], ['Premium due by', f.date(p.premiumDueDate)]]),
      sections: [risk, terms,
        { heading: 'Signed lines', table: { columns: [{ key: 'reinsurerName', label: 'Reinsurer' }, { key: 'line', label: 'Line %', type: 'number' }, { key: 'premium', label: 'Premium', type: 'money' },
          { key: 'cedingCommission', label: 'Reinsurance commission', type: 'money' }],
        rows: accepted.map((s) => ({ ...s, line: s.sharePct })), totals: { reinsurerName: 'Total', premium: p.facPremium, cedingCommission: p.cedingCommission } } },
        { heading: 'Premium', rows: kv([['Facultative premium', ccy(p.facPremium)], ['Less reinsurance commission', ccy(p.cedingCommission)], ['Net premium due from the cedant', ccy(p.dueFromCedant)]]) },
        { text: 'We confirm that the reinsurance described above has been placed with the reinsurers named, for the lines shown, on the terms of the slip.' },
        { signatures: [signatureBlock('Reinsurance broker', signatory)] }] };
  }
  if (kind === 'debit-note') {
    return { ...h, meta: kv([['To', p.cedantName], ['Slip', p.slipNumber], ['Original insured', p.insuredName], ['Due date', f.date(p.premiumDueDate)]]),
      sections: [{ heading: 'Amount due', rows: kv([['Facultative premium', ccy(p.facPremium)], ['Less reinsurance commission', ccy(p.cedingCommission)],
        ['Received to date', ccy(p.received || 0)], ['Balance due', ccy(p.dueFromCedant - (p.received || 0))]]) },
      { note: 'Please settle by bank transfer quoting the slip number.' }, { signatures: [signatureBlock('Authorized signature', signatory)] }] };
  }
  return { ...h, meta: kv([['To', share.reinsurerName], ['Slip', p.slipNumber], ['Original insured', p.insuredName], ['Cedant', p.cedantName], ['Reference', share.reinsurerReference]]),
    sections: [{ heading: 'Amount payable to the reinsurer', rows: kv([['Line', `${share.sharePct}% of the facultative share`], ['Premium', ccy(share.premium)],
      ['Less reinsurance commission', ccy(share.cedingCommission)], ['Less brokerage', ccy(share.brokerage)], ['Net premium', ccy(share.netPremium)], ['Paid to date', ccy(share.paidAmount)],
      ['Balance payable', ccy(share.outstanding)]]) }, { signatures: [signatureBlock('Authorized signature', signatory)] }] };
}
