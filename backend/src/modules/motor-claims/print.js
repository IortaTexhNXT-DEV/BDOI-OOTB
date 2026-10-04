/** Printed documents of a motor claim repair: the letter of authority to the shop and the vehicle release. */
import { getSetting } from '../../lib/settings.js';
import { renderPdf, formatAmount, formatDate, printFormat } from '../../lib/pdf/index.js';
import { companyName } from '../../lib/letterhead.js';
import { notFound } from '../../lib/errors.js';
import { repairFile } from './service.js';

export async function loaPdf(db, claimRef, loaId) {
  const file = await repairFile(db, claimRef);
  const loa = file.loas.find((l) => l.id === loaId);
  if (!loa) throw notFound('Letter of authority not found');
  const fmt = await printFormat();
  const money = (v) => `${fmt.currency} ${formatAmount(v, fmt.decimals)}`;
  const company = await companyName();
  const shop = (await db.query('SELECT data FROM master_records WHERE type_code = \'repair-shop\' AND code = $1 LIMIT 1', [loa.repairShopCode])).rows[0]?.data || {};
  const estimates = file.estimates.filter((e) => loa.estimateIds.includes(e.id));
  return { fileName: `${loa.loaNumber}.pdf`, pdf: await renderPdf({
    title: loa.kind === 'original' ? 'Letter of Authority' : 'Supplementary Letter of Authority', number: loa.loaNumber, dateLine: `Date ${formatDate(loa.issuedOn, fmt)}`,
    meta: [['To', loa.repairShopName], ['Address', [shop.address, shop.city].filter(Boolean).join(', ')], ['Attention', shop.contactPerson || '']].filter(([, v]) => v),
    sections: [
      { heading: 'Claim', columns: 2, rows: [['Claim no.', file.claimNumber], ['Policy no.', file.policyNumber], ['Insured', file.insuredName || ''], ['Insurer', file.insurerName || ''],
        ['Vehicle', file.vehicle || ''], ['Valid until', formatDate(loa.validUntil, fmt)]].filter(([, v]) => v) },
      { text: (await getSetting('motor_claims.loa_wording')) || '' },
      { heading: 'Approved estimates', table: { columns: [{ key: 'seq', label: 'No.' }, { key: 'kind', label: 'Kind' }, { key: 'ref', label: 'Shop reference' }, { key: 'adjuster', label: 'Approved by adjuster' },
        { key: 'estimate', label: 'Estimate', type: 'amount' }, { key: 'approved', label: 'Approved', type: 'amount' }],
      rows: estimates.map((e) => ({ seq: e.seq, kind: e.kind, ref: e.shopReference || '', adjuster: [e.adjusterName, e.adjusterCompany].filter(Boolean).join(', '), estimate: e.total, approved: e.approvedAmount })) } },
      { heading: 'Settlement of the repair', columns: 1, rows: [['Approved repair cost', money(loa.approvedRepairCost)], ['Less participation of the insured', money(loa.participation)],
        ['Less depreciation on parts', money(loa.depreciation)], ['Payable by the insurer', money(loa.payableByInsurer)], ['Payable by the insured to the shop', money(loa.payableByInsured)]] },
      ...(loa.remarks ? [{ heading: 'Remarks', text: loa.remarks }] : []),
      { signatures: [{ label: `For ${company}`.trim() }, { label: 'Conforme: repair shop', name: loa.repairShopName }], perRow: 2 },
    ],
  }) };
}

export async function releasePdf(db, claimRef, releaseId) {
  const file = await repairFile(db, claimRef);
  const r = file.releases.find((x) => x.id === Number(releaseId));
  if (!r) throw notFound('Vehicle release not found');
  const loa = file.loas.find((l) => l.id === r.loaId);
  const fmt = await printFormat();
  return { fileName: `vehicle-release-${file.claimNumber}.pdf`, pdf: await renderPdf({
    title: 'Vehicle Release Acknowledgement', number: file.claimNumber, dateLine: `Date ${formatDate(r.releasedOn, fmt)}`,
    meta: [['Claim no.', file.claimNumber], ['Policy no.', file.policyNumber], ['Letter of authority', loa?.loaNumber || '']].filter(([, v]) => v),
    sections: [
      { columns: 2, rows: [['Vehicle', file.vehicle || ''], ['Repair shop', loa?.repairShopName || ''], ['Repair completed', formatDate(r.repairCompletedOn, fmt)],
        ['Released on', formatDate(r.releasedOn, fmt)], ['Released to', r.releasedTo], ['Odometer', r.odometer || ''],
        ['Participation paid to the shop', `${fmt.currency} ${formatAmount(r.participationCollected, fmt.decimals)}`]].filter(([, v]) => v) },
      { text: `I acknowledge that the vehicle described above was repaired in accordance with the letter of authority and released to me in good order and condition, and that I have no further claim against the repair shop, the insurer or ${await companyName()} for the repair.` },
      ...(r.remarks ? [{ heading: 'Remarks', text: r.remarks }] : []),
      { signatures: [{ label: 'Received by', name: r.releasedTo }, { label: 'Released by (repair shop)' }], perRow: 2 },
    ],
  }) };
}
