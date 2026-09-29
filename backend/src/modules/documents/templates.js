/**
 * Document specs (rendered by lib/pdf, see its layout.js) for quotations, policy schedules, placing slips, receipts and
 * commission debit notes. Every spec starts from header(): the letterhead of the Company master, the date / amount
 * formats and the generated-by line.
 */
import { getSetting } from '../../lib/settings.js';
import { one } from '../../db/pool.js';
import { printContext } from '../../lib/pdf/index.js';
import { amountInWords, formatAmount, formatDate, humanize } from '../../lib/pdf/format.js';
import { round2 } from '../../lib/money.js';
import { num } from './common.js';

const money = (v) => round2(num(v));
const present = (v) => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== '-';
const val = (v) => (present(v) ? String(v) : '-');
/** Key-value rows without the empty ones (an empty section is then left out). */
export const kv = (rows) => rows.filter((r) => r && present(r[1])).map(([a, b, o]) => (o ? [a, String(b), o] : [a, String(b)]));

/**
 * Common part of every document spec: { title, number, letterhead, format, generatedAt, generatedBy, accentColor }.
 * Spread it into the spec: `{ ...await header('Policy Schedule', no), meta, sections }`.
 */
export async function header(title, number, opts = {}) {
  return { title, number: number || '', ...(await printContext(opts)) };
}

/** Formatters bound to a spec's formats: date(v), amount(v), ccy(v, code) = "PHP 1,234.00". */
export const formatters = (h) => {
  const f = h.format || {};
  const amount = (v) => formatAmount(money(v), f.decimals ?? 2);
  return { date: (v) => (present(v) ? formatDate(v, f) : ''), amount, ccy: (v, code) => `${code || f.currency || 'PHP'} ${amount(v)}` };
};

/** Label of a policy type code / id from the policy type master (the code itself when unknown). */
export async function policyTypeLabel(code) {
  if (!present(code)) return '';
  const r = await one('SELECT name FROM policy_types WHERE lower(code) = lower($1) OR id::text = $1 LIMIT 1', [String(code)]).catch(() => null);
  return r?.name || String(code);
}

/**
 * Premium lines that add up to the gross premium: net premium, the taxes, CTPL (a fixed tariff amount inclusive of its
 * taxes and fees, outside the net premium), other charges and the discount. When the parts do not add up to the gross
 * (imported or seeded records without a breakdown) only the gross premium is printed.
 * Returns { rows: [[label, amount]], gross, itemised }.
 */
export function premiumLines(x) {
  const gross = money(x.grossPremium ?? x.premiumTotal);
  const net = money(x.netPremium);
  const ctpl = money(x.ctplCoveragePremium);
  const parts = [['Net premium', net], ['Value added tax (VAT)', money(x.valueAddedTax)], ['Documentary stamp tax (DST)', money(x.documentaryStampTax)],
    ['Local government tax (LGT)', money(x.localGovernmentTax)], ['Fire service tax (FST)', money(x.fireServiceTax)],
    ['CTPL (inclusive of taxes and fees)', ctpl], ['Other charges', money(x.accountPremiumOthers)], ['Discount', -money(x.discount)]];
  const rows = parts.filter(([, v], i) => i === 0 || v !== 0);
  const sum = round2(parts.reduce((s, [, v]) => s + v, 0));
  const itemised = net > 0 && Math.abs(sum - gross) < 0.015;
  return { rows: itemised ? [...rows, ['Gross premium', gross]] : [['Gross premium', gross]], gross, itemised };
}

const premiumTable = (x, currency) => ({
  heading: `Premium (${currency || 'PHP'})`,
  table: { columns: ['Item', { label: 'Amount', type: 'money' }], widths: [375, 140], rows: premiumLines(x).rows, totalRow: true },
});

/** Line of business of a quote / policy: MOTOR, PROPERTY (fire, IAR), ACCIDENT, MARINE, CASUALTY, EB, BOND or OTHER. */
export function lineOf(x) {
  const t = [x.lob, x.productLine, x.productType, x.productName, x.product].filter(Boolean).join(' ').toUpperCase();
  if (/MOTOR|CTPL|VEHICLE/.test(t)) return 'MOTOR';
  if (/\bIAR\b|INDUSTRIAL ALL RISK|FIRE|PROPERTY/.test(t)) return 'PROPERTY';
  if (/ACCIDENT|\bPA\b/.test(t)) return 'ACCIDENT';
  if (/MARINE|CARGO|HULL/.test(t)) return 'MARINE';
  if (/EMPLOYEE|\bEB\b|HEALTH|LIFE/.test(t)) return 'EB';
  if (/BOND|SURETY/.test(t)) return 'BOND';
  if (/LIABILITY|CGL|CASUALTY/.test(t)) return 'CASUALTY';
  return 'OTHER';
}

/** Risk section by line of business; empty rows are left out (and the whole section when nothing is known). */
export function riskSection(x, f) {
  const line = lineOf(x);
  if (line === 'MOTOR') {
    const v = x.insuranceVehicleDetails?.[0] || {};
    return { heading: 'Vehicle', rows: kv([['Brand', v.vehicleBrand || x.vehicleBrand], ['Model', v.vehicleModel || x.vehicleModel], ['Variant', v.modelVariant || x.modelVariant],
      ['Year', v.modelYear || x.modelYear], ['Plate number', x.plateNumber], ['Chassis number', x.chassisNumber], ['Motor number', x.motorNumber],
      ['Seating capacity', v.seatingCapacity || x.seatingCapacity], ['Colour', v.vehicleColor || x.vehicleColor], ['Mortgagee', x.mortgage]]) };
  }
  if (line === 'PROPERTY') {
    const r = x.fireRiskDetails || x.iarRiskDetails || {};
    return { heading: 'Risk details', rows: kv([['Location', r.locationAddress], ['Construction', r.constructionType], ['Building type', r.buildingType],
      ['Occupancy', r.occupancyType], ['Nature of business', r.natureOfBusiness], ['Earthquake zone', r.earthquakeZone]]) };
  }
  // Other lines: what the record has (description, insured persons, cargo and voyage, limits, obligee ...)
  const d = { ...(x.riskDetails || {}), ...x };
  const persons = Array.isArray(d.insuredPersons) ? d.insuredPersons.length : d.numberOfInsured ?? d.insuredPersonsCount ?? d.numberOfMembers ?? d.members;
  return { heading: 'Risk details', rows: kv([
    ['Class of insurance', x.productName || x.productType || x.product], ['Policy type', x.policyTypeName],
    ['Description', d.riskDescription || d.description], ['Insured persons', persons], ['Plan', d.planName || d.plan],
    ['Cargo', d.cargoDescription || d.cargo], ['Voyage', [d.voyageFrom, d.voyageTo].filter(Boolean).join(' to ')], ['Conveyance', d.conveyance || d.vesselName],
    ['Limit of liability', present(d.limitOfLiability) ? f.ccy(d.limitOfLiability, x.currency) : ''], ['Obligee', d.obligee], ['Bond type', d.bondType],
    ['Business', d.natureOfBusiness || d.businessDescription], ['Territorial limits', d.territorialLimits],
    [line === 'CASUALTY' || line === 'BOND' ? 'Limit / amount insured' : 'Sum insured', num(x.totalSumInsured ?? x.sumInsured) ? f.ccy(x.totalSumInsured ?? x.sumInsured, x.currency) : ''],
  ]) };
}

function coverageSection(x, f) {
  const line = lineOf(x);
  if (line === 'PROPERTY') {
    const si = x.fireRiskDetails?.sumInsured || x.iarRiskDetails?.sumInsured || x.sumInsuredBreakdown || {};
    const rows = Object.entries(si).filter(([, v]) => num(v)).map(([k, v]) => [humanize(k), money(v)]);
    const total = money(x.totalSumInsured ?? x.sumInsured) || round2(rows.reduce((s, r) => s + r[1], 0));
    return { heading: `Sums insured (${x.currency || f.currency || 'PHP'})`, table: { columns: ['Item', { label: 'Sum insured', type: 'money' }], widths: [375, 140],
      rows: [...rows, ['Total sum insured', total]], totalRow: true } };
  }
  if (line !== 'MOTOR') return null;
  // cover premiums: on the record, or in the premium breakdown the quotation was saved with
  const pb = x.premiumBreakdown || {};
  const prem = (k) => num(x[k]) || num(pb[k]);
  const rows = [['Own damage / theft', x.lossAndDamageCoverage, prem('lossAndDamageCoveragePremium')], ['Acts of nature', x.lossAndDamageCoverage, prem('actsOfNaturePremium')],
    ['Bodily injury', x.bodilyInjury, prem('bodilyInjuryCoveragePremium')], ['Property damage', x.propertyDamage, prem('propertyDamageCoveragePremium')],
    ['Auto passenger personal accident', x.APPAtotalCoverage, prem('APPAcoveragePremium')], ['Personal accident', null, prem('personalAccidentCoverPremium')],
    ['Roadside assistance', null, prem('roadsideAssistancePremium')], ['CTPL (fixed tariff, inclusive of taxes and fees)', null, prem('ctplCoveragePremium')]]
    .filter(([, si, p], i) => p || (i === 0 && num(si))).map(([a, si, p]) => [a, num(si) ? money(si) : '', money(p)]);
  if (!rows.length) return null;
  return { heading: `Coverage (${x.currency || f.currency || 'PHP'})`, table: { columns: ['Cover', { label: 'Sum insured', type: 'money' }, { label: 'Premium', type: 'money' }], widths: [255, 130, 130], rows } };
}

const customerOf = (lead = {}) => [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.companyName;

export async function quoteDoc(q) {
  const line = lineOf(q);
  const h = await header(line === 'MOTOR' ? 'Motor Insurance Quotation' : `${q.productType || 'Insurance'} Quotation`, q.quotationNumber);
  const f = formatters(h);
  return { ...h, meta: kv([['Date', f.date(q.createdAt)], ['Valid until', f.date(q.validUntil)], ['Customer', customerOf(q.lead || {})], ['Status', q.quotationStatus],
    ['Product', q.productType], ['Policy type', await policyTypeLabel(q.insurancePolicyType)], ['Insurer', q.insuranceCompanyName], ['Currency', q.currency]]),
  sections: [riskSection(q, f), coverageSection(q, f), premiumTable(q, q.currency),
    { heading: 'Remarks', text: q.remarks || 'This quotation is subject to the insurer\'s terms, conditions and final underwriting approval.' }] };
}

/**
 * Policy premium: the policy's own columns (net premium, gross) with the taxes of its quotation when the quotation has the
 * same net premium; a policy without a breakdown (imported / seeded) prints only its gross premium.
 */
export function policyPremium(p, q = {}) {
  const net = money(p.netPremium);
  const sameAsQuote = net > 0 && money(q.netPremium) === net;
  const keys = ['valueAddedTax', 'documentaryStampTax', 'localGovernmentTax', 'fireServiceTax', 'accountPremiumOthers', 'discount', 'ctplCoveragePremium'];
  const src = Object.fromEntries(keys.map((k) => [k, sameAsQuote ? q[k] : 0]));
  return { ...src, netPremium: net, grossPremium: money(p.premiumTotal ?? p.grossPremium) };
}

/** A policy object (policies/service.js#toPolicy) with what the prints need from its row: product line and name, policy type. */
export async function printablePolicy(p, row = {}) {
  const pt = row.policy_type_id ? await one('SELECT name FROM policy_types WHERE id = $1', [row.policy_type_id]).catch(() => null) : null;
  return { ...p, productLine: row.product_line || p.productLine, productName: row.product_name || p.productName, policyTypeName: pt?.name || p.policyTypeName || null };
}

export async function policyScheduleDoc(p) {
  const q = p.quotation || {};
  const x = { ...q, ...p, ...policyPremium(p, q) };
  const h = await header('Policy Schedule', p.policyNumber);
  const f = formatters(h);
  return { ...h, meta: kv([['Insured', p.insuredName], ['Insurer', p.insuranceCompanyName], ['Period from', f.date(p.inception)], ['Period to', f.date(p.expiry)],
    ['Date issued', f.date(p.issuedDate)], ['Product', p.productName || p.productType], ['Policy type', p.policyTypeName || await policyTypeLabel(p.insurancePolicyType)],
    ['Sum insured', num(p.sumInsured) ? f.ccy(p.sumInsured, p.currency) : ''],
    ['Bill no.', p.billNumber], ['Payment status', p.paymentStatus ? humanize(p.paymentStatus) : ''], ['Quotation', q.quotationNumber], ['Currency', p.currency]]),
  sections: [riskSection(x, f), coverageSection(x, f), premiumTable(x, p.currency),
    { heading: 'Declaration', text: 'Subject to the terms, conditions, clauses and warranties of the policy wording of the insurer.' }] };
}

export async function placingSlipDoc(p) {
  const q = p.quotation || {};
  const x = { ...q, ...p, ...policyPremium(p, q) };
  const h = await header('Insurance Placing Slip', p.policyNumber);
  const f = formatters(h);
  return { ...h, meta: kv([['Insured', p.insuredName], ['Insurer', p.insuranceCompanyName], ['Class', p.productName || p.productType],
    ['Period', `${f.date(p.inception) || '-'} to ${f.date(p.expiry) || '-'}`], ['Sum insured', num(p.sumInsured) ? f.ccy(p.sumInsured, p.currency) : ''], ['Currency', p.currency]]),
  sections: [riskSection(x, f), coverageSection(x, f), premiumTable(x, p.currency),
    { heading: 'Security', text: `${val(p.insuranceCompanyName)} - 100% share. Placed by ${String(h.letterhead?.name || '').replace(/\.$/, '')}.` },
    { heading: 'Acceptance', signatures: [{ label: 'For the broker' }, { label: 'For the insurer' }] }] };
}

/** Receipt payment-mode code -> label (payment mode list of policies/payments.js). */
export const PAYMENT_MODE_LABELS = { 'bank-transfer': 'Bank transfer', check: 'Cheque', cheque: 'Cheque', online: 'Online payment', cash: 'Cash', card: 'Card', gcash: 'GCash' };
export const paymentModeLabel = (m) => (present(m) ? PAYMENT_MODE_LABELS[String(m).toLowerCase()] || humanize(m) : '');

/**
 * Official receipt: received from, amount (figures and words), payment details, the policies it pays, an authorised
 * signature and the configurable footer text (documents.receipt_footer). `h` lets bulk prints reuse one header.
 */
export async function receiptDoc(r, lines, h0 = null) {
  const h = h0 ? { ...h0, title: 'Official Receipt', number: r.receipt_number } : await header('Official Receipt', r.receipt_number);
  const f = formatters(h);
  const currency = r.currency_code || h.format?.currency || 'PHP';
  const applied = lines.length ? lines.map((l) => [l.policy_number, money(l.net_premium), money(l.vat), money(l.dst), money(l.lgt), money(l.paid)])
    : [[r.policy_number || '-', '', '', '', '', money(r.amount)]];
  const totals = ['TOTAL', ...[1, 2, 3, 4, 5].map((i) => (lines.length || i === 5 ? round2(applied.reduce((s, x) => s + num(x[i]), 0)) : ''))];
  const footer = (await getSetting('documents.receipt_footer', '')) || '';
  return { ...h, footerNote: footer,
    meta: kv([['Date', f.date(r.received_date)], ['Received from', r.customer_name || r.client_name], ['Customer code', r.customer_code],
      ['Amount', f.ccy(r.amount, currency), { bold: true }], ['Payment mode', paymentModeLabel(r.payment_mode)], ['Reference', r.reference_no],
      ['Transaction no.', r.transaction_number], ['Status', r.receipt_status || r.status]]),
    sections: [
      { heading: 'Amount in words', text: amountInWords(r.amount, currency), bold: true },
      { heading: `Applied to (${currency})`, table: { columns: ['Policy no.', { label: 'Net premium', type: 'money' }, { label: 'VAT', type: 'money' }, { label: 'DST', type: 'money' },
        { label: 'LGT', type: 'money' }, { label: 'Amount paid', type: 'money' }], rows: [...applied, totals], totalRow: true } },
      { heading: 'Remarks', text: r.remarks || 'Thank you for your payment.' },
      { signatures: [{ label: 'Authorized signature' }], perRow: 3 },
    ] };
}

/**
 * Commission debit note to an insurer (direct bill): one line per policy / endorsement, commission, VAT, total due, the
 * expanded withholding tax the insurer deducts and the net amount payable. `dn` and `lines` are the API shapes
 * (remittance/directbill.js#debitNoteOut).
 */
export async function commissionDebitNoteDoc(dn, lines) {
  const h = await header(await getSetting('direct_bill.debit_note_title', 'Commission Debit Note'), dn.dnNumber);
  const f = formatters(h);
  const pct = (r) => `${(num(r) * 100).toFixed(2)}%`;
  const totals = [['Commission', money(dn.commission)], [`Output VAT${dn.vatRate ? ` (${pct(dn.vatRate)})` : ''}`, money(dn.vat)], ['Total amount due', money(dn.amount)],
    [`Less: expanded withholding tax (${pct(dn.ewtRate)} of commission)`, dn.expectedEwt ? -money(dn.expectedEwt) : 0], ['Net amount payable', money(dn.netPayable)]];
  if (dn.collectedAmount) totals.push(['Collected to date (cash + tax withheld)', -money(dn.collectedAmount)], ['Balance', money(dn.balance)]);
  const sum = (k) => round2(lines.reduce((s, l) => s + num(l[k]), 0));
  return { ...h, meta: kv([['Date', f.date(dn.dnDate)], ['Due date', f.date(dn.dueDate)], ['Bill to', dn.insurerName], ['Insurer TIN', dn.insurerTin],
    ['Address', dn.insurerAddress], ['Period', dn.periodFrom || dn.periodTo ? `${f.date(dn.periodFrom) || '-'} to ${f.date(dn.periodTo) || '-'}` : ''],
    ['Currency', dn.currency], ['Status', dn.status ? humanize(dn.status) : ''], ['Policies', String(lines.length)]]),
  sections: [
    { heading: 'Commission on direct-bill policies (premium paid by the insured to the insurer)',
      table: { columns: [{ label: 'Policy / reference', wrap: true }, 'Insured', 'Product', { label: 'Gross premium', type: 'money' }, { label: 'Rate', align: 'right' },
        { label: 'Commission', type: 'money' }, { label: 'VAT', type: 'money' }, { label: 'Total', type: 'money' }],
      rows: [...lines.map((l) => [l.reference && l.reference !== l.policyNo ? `${l.policyNo} / ${l.reference}` : l.policyNo, val(l.insuredName), val(l.product), money(l.grossPremium),
        l.commissionRate === null || l.commissionRate === undefined ? '-' : `${num(l.commissionRate).toFixed(2)}%`, money(l.commission), money(l.vat), money(l.amount)]),
      ['TOTAL', '', '', sum('grossPremium'), '', sum('commission'), sum('vat'), sum('amount')]], totalRow: true } },
    { heading: `Amount due (${dn.currency || f.ccy(0).split(' ')[0]})`, table: { columns: ['Item', { label: 'Amount', type: 'money' }], widths: [375, 140], rows: totals } },
    { heading: 'Payment instructions', text: ((await getSetting('direct_bill.debit_note_remarks')) ?? '') },
    ...(dn.remarks ? [{ heading: 'Remarks', text: dn.remarks }] : []),
    { signatures: [{ label: 'Prepared by' }, { label: 'Approved by' }], perRow: 3 },
  ] };
}
