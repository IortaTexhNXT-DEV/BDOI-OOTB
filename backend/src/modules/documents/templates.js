/** Document specs (see pdf.js) for broker slips, quotation slips, placement slips, policy schedules, placing slips, receipts and commission debit notes. */
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
  const generic = Object.entries(x.riskDetails || {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object');
  // generic risk details (broker / placement slips for any line) when the fire / IAR screens' structure is absent
  if (!Object.keys(r).length && generic.length) return { heading: 'Risk details', rows: generic.map(([k, v]) => [k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()), val(v)]) };
  return { heading: 'Risk details', rows: [['Location', r.locationAddress], ['Construction', r.constructionType], ['Building type', r.buildingType],
    ['Occupancy', r.occupancyType], ['Nature of business', r.natureOfBusiness], ['Earthquake zone', r.earthquakeZone]].map(([a, b]) => [a, val(b)]) };
}

function coverageSection(x) {
  if (x.lob !== 'MOTOR') {
    const si = x.fireRiskDetails?.sumInsured || x.sumInsuredBreakdown || {};
    const rows = Object.entries(si).filter(([, v]) => num(v)).map(([k, v]) => [k, money(v)]);
    if (!rows.length && x.requestedCovers?.length) {
      return { heading: 'Covers', table: { columns: ['Cover', 'Sum insured / limit', 'Deductible'], widths: [215, 150, 150],
        rows: x.requestedCovers.map((c) => [val(c.cover || c.name), money(c.sumInsured), val(c.deductible)]) } };
    }
    return { heading: 'Sums insured', table: { columns: ['Item', 'Sum insured'], widths: [365, 150], rows: rows.length ? rows : [['Total sum insured', money(x.totalSumInsured)]] } };
  }
  const rows = [['Own damage / theft', x.lossAndDamageCoverage, x.lossAndDamageCoveragePremium], ['Acts of nature', x.lossAndDamageCoverage, x.actsOfNaturePremium],
    ['Bodily injury', x.bodilyInjury, x.bodilyInjuryCoveragePremium], ['Property damage', x.propertyDamage, x.propertyDamageCoveragePremium],
    ['Auto passenger PA', x.APPAtotalCoverage, x.APPAcoveragePremium], ['CTPL', null, x.ctplCoveragePremium]]
    .filter(([, si, p], i) => num(p) || (i === 0 && num(si))).map(([a, si, p]) => [a, money(si), money(p)]);
  return { heading: 'Coverage', table: { columns: ['Cover', 'Sum insured', 'Premium'], widths: [235, 140, 140], rows } };
}

const pct = (v) => `${Number(num(v).toFixed(4))}%`;

/** Security: the participating insurers with their shares (co-insurance); `focus` (insurer id) marks one participant's slip. */
function securitySection(parts, currency, focus = null, company = '') {
  if (!parts?.length) return { heading: 'Security', text: `To be advised.${company ? ` Placed by ${company}.` : ''}` };
  const rows = parts.map((x) => [`${x.insuranceCompanyName}${focus && Number(focus) === Number(x.insuranceCompanyId) ? ' (this slip)' : ''}`, x.isLead ? 'Lead' : 'Co-insurer', pct(x.sharePercent),
    money(x.sumInsured), money(x.premium), money(x.premiumTotal), val(x.insurerReference)]);
  return { heading: `Security (${currency})`, table: { columns: ['Insurer', 'Role', 'Share', 'Sum insured', 'Premium', 'Gross', 'Reference'], widths: [130, 55, 45, 80, 70, 70, 65], rows } };
}

/** Market comparison of the insurer offers of a broker slip (API shape of insurer offers). */
function offersSection(offers, currency) {
  return { heading: `Market comparison (${currency})`, table: { columns: ['Insurer', 'Status', 'Rate %', 'Premium', 'Gross', 'Line', 'Deductibles', 'Valid until'], widths: [110, 50, 45, 70, 70, 40, 80, 50],
    rows: offers.map((o) => [o.insuranceCompanyName, o.status, o.rate === null || o.rate === undefined ? '-' : String(o.rate), o.premium === null ? '-' : money(o.premium),
      o.premiumTotal === null ? '-' : money(o.premiumTotal), pct(o.offeredShare), val(o.deductibles), val(o.validityDate)]) } };
}

/** Quotation Slip: the quotation presented to the client (with the market comparison when it came from a broker slip). */
export async function quoteDoc(q) {
  const title = q.lob === 'MOTOR' ? 'Motor Insurance Quotation Slip' : `${q.productType || 'Property'} Quotation Slip`;
  const h = await header(title, q.quotationNumber);
  const lead = q.lead || {};
  const company = ((await getSetting('general.company_name')) ?? '');
  const security = q.participants?.length ? [securitySection(q.participants, q.currency, null, company)] : [];
  const market = q.offers?.length ? [offersSection(q.offers, q.currency)] : [];
  return { ...h, meta: [['Quotation slip no.', q.quotationNumber], ['Date', String(q.createdAt || '').slice(0, 10)], ['Customer', [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.companyName],
    ['Status', q.quotationStatus], ['Product', q.productType], ['Valid until', q.validUntil], ['Insurer', q.insuranceCompanyName], ['Policy type', q.insurancePolicyType],
    ...(q.brokerSlipNumber ? [['Broker slip', q.brokerSlipNumber]] : [])].map(([a, b]) => [a, val(b)]),
  sections: [riskSection(q), coverageSection(q), premiumTable(q, q.currency), ...security, ...market,
    { heading: 'Remarks', text: q.remarks || 'This quotation is subject to the insurer\'s terms, conditions and final underwriting approval.' }] };
}

/** Risk section of a broker slip or placement slip: the motor vehicle, else the generic risk details, else the quote-shaped risk. */
const slipRisk = (x) => riskSection({ ...(x.doc || {}), ...x });

/** Broker Slip (request for quotation) to one insurer of the market. */
export async function brokerSlipDoc(b, offer = null) {
  const h = await header('Broker Slip - Request for Quotation', b.slipNumber);
  const company = ((await getSetting('general.company_name')) ?? '');
  const covers = (b.requestedCovers || []).map((c) => [val(c.cover || c.name), c.sumInsured === undefined || c.sumInsured === null || c.sumInsured === '' ? '-' : money(c.sumInsured), val(c.deductible), val(c.remarks)]);
  return { ...h, meta: [['Slip no.', b.slipNumber], ['To', offer ? offer.insuranceCompanyName : 'Insurance market'], ['Insured', b.insuredName], ['Class', b.productType],
    ['Period', `${val(b.inceptionDate)} to ${val(b.expiryDate)}`], ['Sum insured', money(b.sumInsured).toFixed(2)], ['Currency', b.currency], ['Submitted', b.submissionDate],
    ['Response due', b.responseDueDate], ['Our reference', offer?.offerNumber]].map(([a, c]) => [a, val(c)]),
  sections: [slipRisk(b), ...(b.lob === 'MOTOR' ? [coverageSection({ ...(b.doc || {}), lob: 'MOTOR' })] : []),
    { heading: 'Requested covers', table: { columns: ['Cover', 'Sum insured / limit', 'Deductible', 'Remarks'], widths: [170, 110, 110, 125], rows: covers.length ? covers : [['As per the risk details', '-', '-', '-']] } },
    { heading: 'Information requested', text: 'Please quote your premium and rate, deductibles, special terms and conditions, the line (share %) you can write and the validity of your offer.' },
    { heading: 'Remarks', text: b.remarks || `Submitted by ${company}.` }] };
}

/** Placement Slip (firm order): one participant's slip shows its own share of the risk (focus = insurer id), else the whole security. */
export async function placementSlipDoc(pl, focus = null) {
  const h = await header('Placement Slip - Firm Order', pl.placementNumber);
  const company = ((await getSetting('general.company_name')) ?? '');
  const mine = focus ? (pl.participants || []).find((x) => Number(x.insuranceCompanyId) === Number(focus)) : null;
  const meta = [['Placement slip no.', pl.placementNumber], ['Insured', pl.insuredName], ['Class', pl.productType], ['Period', `${val(pl.inceptionDate)} to ${val(pl.expiryDate)}`],
    ['Sum insured (100%)', money(pl.sumInsured).toFixed(2)], ['Currency', pl.currency], ['Quotation slip', pl.quotationNumber], ['Status', pl.placementStatus]];
  if (mine) meta.push(['To', mine.insuranceCompanyName], ['Your share', pct(mine.sharePercent)], ['Your role', mine.isLead ? 'Lead insurer' : 'Co-insurer'], ['Your reference', mine.insurerReference]);
  const shareTable = mine ? [{ heading: `Your share (${pct(mine.sharePercent)}, ${pl.currency})`, table: { columns: ['Item', '100%', 'Your share'], widths: [215, 150, 150],
    rows: [['Sum insured', money(pl.sumInsured), money(mine.sumInsured)], ['Net premium', money(pl.netPremium), money(mine.premium)], ['Taxes', money(pl.taxes), money(mine.taxes)],
      ['Gross premium', money(pl.grossPremium), money(mine.premiumTotal)], ['Commission', money(pl.commissionAmount), money(mine.commissionAmount)]] } }] : [];
  return { ...h, meta: meta.map(([a, b]) => [a, val(b)]),
    sections: [slipRisk(pl), coverageSection({ ...(pl.doc || {}), ...pl, totalSumInsured: pl.sumInsured }), ...(mine ? [] : [premiumTable(pl, pl.currency)]), ...shareTable,
      securitySection(pl.participants, pl.currency, focus, company),
      { heading: 'Order', text: `${company} places this risk with the insurer(s) above for the share(s) shown and requests confirmation of cover and the policy / certificate number.${pl.remarks ? ` ${pl.remarks}` : ''}` }] };
}

export async function policyScheduleDoc(p) {
  const q = p.quotation || {};
  const x = { ...q, ...p, lob: p.lob };
  const h = await header('Policy Schedule', p.policyNumber);
  return { ...h, meta: [['Policy no.', p.policyNumber], ['Insured', p.insuredName], ['Period from', p.inception], ['Period to', p.expiry], ['Issued', p.issuedDate],
    ['Insurer', p.insuranceCompanyName], ['Product', p.productType], ['Bill no.', p.billNumber], ['Payment status', p.paymentStatus], ['Quotation', q.quotationNumber]].map(([a, b]) => [a, val(b)]),
  sections: [riskSection(x), coverageSection(x), premiumTable(x, p.currency), { heading: 'Declaration', text: 'Subject to the terms, conditions, clauses and warranties of the policy wording of the insurer.' }] };
}

/** Placing slip of an issued policy: the security lists every participating insurer and its share; insurerId gives one participant's copy. */
export async function placingSlipDoc(p, focus = null) {
  const q = p.quotation || {};
  const x = { ...q, ...p, lob: p.lob };
  const h = await header('Insurance Placing Slip', p.policyNumber);
  const company = ((await getSetting('general.company_name')) ?? '');
  const mine = focus ? (p.participants || []).find((r) => Number(r.insuranceCompanyId) === Number(focus)) : null;
  return { ...h, meta: [['Insured', p.insuredName], ['Insurer', mine ? mine.insuranceCompanyName : p.insuranceCompanyName], ['Class', p.productType], ['Period', `${val(p.inception)} to ${val(p.expiry)}`],
    ['Sum insured', num(p.sumInsured).toFixed(2)], ['Currency', p.currency], ...(mine ? [['Share', pct(mine.sharePercent)], ['Share of gross premium', money(mine.premiumTotal).toFixed(2)]] : [])]
    .map(([a, b]) => [a, val(b)]),
  sections: [riskSection(x), coverageSection(x), premiumTable(x, p.currency), securitySection(p.participants, p.currency, focus, company), { heading: 'Placed by', text: `Placed by ${company}.` }] };
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
