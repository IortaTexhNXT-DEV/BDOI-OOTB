/** Document specs (see pdf.js) for quotations, policy schedules, placing slips, receipts and commission debit notes. */
import { getSetting } from '../../lib/settings.js';
import { num } from './common.js';

const money = (v) => num(v);
const val = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));

export async function header(title, number) {
  const company = ((await getSetting('general.company_name')) ?? '');
  const system = ((await getSetting('general.system_name')) ?? '');
  return { title, subtitle: `${company}${number ? `  -  ${number}` : ''}`, footer: `${system || company} - generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC` };
}

const premiumTable = (x, currency) => ({
  heading: `Premium (${currency})`,
  table: {
    columns: ['Item', 'Amount'], widths: [365, 150],
    rows: [['Net premium', money(x.netPremium)], ['Value added tax', money(x.valueAddedTax)], ['Documentary stamp tax', money(x.documentaryStampTax)],
      ['Local government tax', money(x.localGovernmentTax)], ...(num(x.fireServiceTax) ? [['Fire service tax', money(x.fireServiceTax)]] : []),
      ['Other charges', money(x.accountPremiumOthers)], ['Discount', money(x.discount) ? -money(x.discount) : 0], ['Gross premium', money(x.grossPremium)]],
  },
});

function riskSection(x) {
  if (x.lob === 'MOTOR') {
    const v = x.insuranceVehicleDetails?.[0] || {};
    return { heading: 'Vehicle', rows: [['Brand', v.vehicleBrand || x.vehicleBrand], ['Model', v.vehicleModel || x.vehicleModel], ['Variant', v.modelVariant || x.modelVariant],
      ['Year', v.modelYear || x.modelYear], ['Plate number', x.plateNumber], ['Chassis number', x.chassisNumber], ['Motor number', x.motorNumber],
      ['Seating capacity', v.seatingCapacity || x.seatingCapacity], ['Colour', v.vehicleColor || x.vehicleColor], ['Mortgagee', x.mortgage]].map(([a, b]) => [a, val(b)]) };
  }
  const r = x.fireRiskDetails || x.iarRiskDetails || {};
  return { heading: 'Risk details', rows: [['Location', r.locationAddress], ['Construction', r.constructionType], ['Building type', r.buildingType],
    ['Occupancy', r.occupancyType], ['Nature of business', r.natureOfBusiness], ['Earthquake zone', r.earthquakeZone]].map(([a, b]) => [a, val(b)]) };
}

function coverageSection(x) {
  if (x.lob !== 'MOTOR') {
    const si = x.fireRiskDetails?.sumInsured || x.sumInsuredBreakdown || {};
    const rows = Object.entries(si).filter(([, v]) => num(v)).map(([k, v]) => [k, money(v)]);
    return { heading: 'Sums insured', table: { columns: ['Item', 'Sum insured'], widths: [365, 150], rows: rows.length ? rows : [['Total sum insured', money(x.totalSumInsured)]] } };
  }
  const rows = [['Own damage / theft', x.lossAndDamageCoverage, x.lossAndDamageCoveragePremium], ['Acts of nature', x.lossAndDamageCoverage, x.actsOfNaturePremium],
    ['Bodily injury', x.bodilyInjury, x.bodilyInjuryCoveragePremium], ['Property damage', x.propertyDamage, x.propertyDamageCoveragePremium],
    ['Auto passenger PA', x.APPAtotalCoverage, x.APPAcoveragePremium], ['CTPL', null, x.ctplCoveragePremium]]
    .filter(([, si, p], i) => num(p) || (i === 0 && num(si))).map(([a, si, p]) => [a, money(si), money(p)]);
  return { heading: 'Coverage', table: { columns: ['Cover', 'Sum insured', 'Premium'], widths: [235, 140, 140], rows } };
}

export async function quoteDoc(q) {
  const h = await header(q.lob === 'MOTOR' ? 'Motor Insurance Quotation' : `${q.productType || 'Property'} Quotation`, q.quotationNumber);
  const lead = q.lead || {};
  return { ...h, meta: [['Quotation no.', q.quotationNumber], ['Date', String(q.createdAt || '').slice(0, 10)], ['Customer', [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.companyName],
    ['Status', q.quotationStatus], ['Product', q.productType], ['Valid until', q.validUntil], ['Insurer', q.insuranceCompanyName], ['Policy type', q.insurancePolicyType]].map(([a, b]) => [a, val(b)]),
  sections: [riskSection(q), coverageSection(q), premiumTable(q, q.currency), { heading: 'Remarks', text: q.remarks || 'This quotation is subject to the insurer\'s terms, conditions and final underwriting approval.' }] };
}

export async function policyScheduleDoc(p) {
  const q = p.quotation || {};
  const x = { ...q, ...p, lob: p.lob };
  const h = await header('Policy Schedule', p.policyNumber);
  return { ...h, meta: [['Policy no.', p.policyNumber], ['Insured', p.insuredName], ['Period from', p.inception], ['Period to', p.expiry], ['Issued', p.issuedDate],
    ['Insurer', p.insuranceCompanyName], ['Product', p.productType], ['Bill no.', p.billNumber], ['Payment status', p.paymentStatus], ['Quotation', q.quotationNumber]].map(([a, b]) => [a, val(b)]),
  sections: [riskSection(x), coverageSection(x), premiumTable(x, p.currency), { heading: 'Declaration', text: 'Subject to the terms, conditions, clauses and warranties of the policy wording of the insurer.' }] };
}

export async function placingSlipDoc(p) {
  const q = p.quotation || {};
  const x = { ...q, ...p, lob: p.lob };
  const h = await header('Insurance Placing Slip', p.policyNumber);
  return { ...h, meta: [['Insured', p.insuredName], ['Insurer', p.insuranceCompanyName], ['Class', p.productType], ['Period', `${val(p.inception)} to ${val(p.expiry)}`],
    ['Sum insured', num(p.sumInsured).toFixed(2)], ['Currency', p.currency]].map(([a, b]) => [a, val(b)]),
  sections: [riskSection(x), coverageSection(x), premiumTable(x, p.currency), { heading: 'Security', text: `${val(p.insuranceCompanyName)} - 100% share. Placed by ${((await getSetting('general.company_name')) ?? '')}.` }] };
}

export async function receiptDoc(r, lines) {
  const h = await header('Official Receipt', r.receipt_number);
  return { ...h, meta: [['Receipt no.', r.receipt_number], ['Date', String(r.received_date)], ['Received from', r.customer_name || r.client_name], ['Payment mode', r.payment_mode],
    ['Reference', r.reference_no], ['Status', r.receipt_status || r.status], ['Amount', num(r.amount).toFixed(2)], ['Currency', r.currency_code || (await getSetting('currency.default', 'PHP'))]].map(([a, b]) => [a, val(b)]),
  sections: [{ heading: 'Applied to', table: { columns: ['Policy no.', 'Net premium', 'VAT', 'DST', 'LGT', 'Paid'], widths: [125, 80, 75, 75, 75, 85],
    rows: lines.length ? lines.map((l) => [l.policy_number, money(l.net_premium), money(l.vat), money(l.dst), money(l.lgt), money(l.paid)]) : [[r.policy_number || '-', 0, 0, 0, 0, money(r.amount)]] } },
  { heading: 'Remarks', text: r.remarks || 'Thank you for your payment.' }] };
}

/**
 * Commission debit note to an insurer (direct bill): one line per policy / endorsement, commission, VAT, total due, the
 * expanded withholding tax the insurer deducts and the net amount payable. `dn` and `lines` are the API shapes
 * (remittance/directbill.js#debitNoteOut).
 */
export async function commissionDebitNoteDoc(dn, lines) {
  const h = await header(await getSetting('direct_bill.debit_note_title', 'Commission Debit Note'), dn.dnNumber);
  const pct = (r) => `${(num(r) * 100).toFixed(2)}%`;
  const totals = [['Commission', money(dn.commission)], [`Output VAT${dn.vatRate ? ` (${pct(dn.vatRate)})` : ''}`, money(dn.vat)], ['Total amount due', money(dn.amount)],
    [`Less: expanded withholding tax (${pct(dn.ewtRate)} of commission)`, dn.expectedEwt ? -money(dn.expectedEwt) : 0], ['Net amount payable', money(dn.netPayable)]];
  if (dn.collectedAmount) totals.push(['Collected to date (cash + tax withheld)', -money(dn.collectedAmount)], ['Balance', money(dn.balance)]);
  return { ...h, meta: [['Debit note no.', dn.dnNumber], ['Date', dn.dnDate], ['Bill to', dn.insurerName], ['Due date', dn.dueDate], ['Insurer TIN', dn.insurerTin],
    ['Period', dn.periodFrom || dn.periodTo ? `${val(dn.periodFrom)} to ${val(dn.periodTo)}` : '-'], ['Address', dn.insurerAddress], ['Currency', dn.currency], ['Status', dn.status], ['Policies', String(lines.length)]]
    .map(([a, b]) => [a, val(b)]),
  sections: [
    { heading: 'Commission on direct-bill policies (premium paid by the insured to the insurer)',
      table: { columns: ['Policy / ref.', 'Insured', 'Product', 'Gross premium', 'Rate', 'Commission', 'VAT', 'Total'], widths: [78, 95, 55, 75, 40, 62, 50, 60],
        rows: lines.map((l) => [l.reference && l.reference !== l.policyNo ? `${l.policyNo} / ${l.reference}` : l.policyNo, val(l.insuredName), val(l.product), money(l.grossPremium),
          l.commissionRate === null || l.commissionRate === undefined ? '-' : `${num(l.commissionRate).toFixed(2)}%`, money(l.commission), money(l.vat), money(l.amount)]) } },
    { heading: `Amount due (${dn.currency})`, table: { columns: ['Item', 'Amount'], widths: [365, 150], rows: totals } },
    { heading: 'Payment instructions', text: ((await getSetting('direct_bill.debit_note_remarks')) ?? '') },
    ...(dn.remarks ? [{ heading: 'Remarks', text: dn.remarks }] : []),
  ] };
}
