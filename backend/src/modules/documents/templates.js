/**
 * Document specs (rendered by lib/pdf, see its layout.js) for broker slips, quotation slips, placement slips, policy
 * schedules, placing slips, receipts and commission debit notes. Every spec starts from header(): the letterhead of the Company master, the date / amount
 * formats and the generated-by line.
 */
import { getSetting } from '../../lib/settings.js';
import { one } from '../../db/pool.js';
import { printContext } from '../../lib/pdf/index.js';
import { amountInWords, formatAmount, formatDate, humanize } from '../../lib/pdf/format.js';
import { round2 } from '../../lib/money.js';
import { num } from './common.js';
import { signatureSection } from '../e-signatures/service.js';

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

/**
 * Signature part of a document (modules/e-signatures: Master > System Configuration > Document Signatures):
 * { watermark, section }. `ctx` { status, date, signatory, issuedBy, approvedBy, names }; `blocks` the
 * document's own signature lines in print order ({ slot } for a mapped one, { label } for a blank line).
 */
export async function signatures(h, documentType, ctx, opts = {}) {
  const r = await signatureSection(documentType, { format: h.format, companyName: brokerName(h), ...ctx }, opts);
  return { watermark: r.watermark || undefined, section: r.section };
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

export const premiumTable = (x, currency) => ({
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
      ['Seating capacity', v.seatingCapacity || x.seatingCapacity], ['Colour', v.vehicleColor || x.vehicleColor], ['Mortgagee', x.mortgage], ['Mortgagee clause', x.mortgageeClause]]) };
  }
  // generic risk details (broker / placement slips for any line) entered as label / value pairs
  const generic = Object.entries(x.riskDetails || {}).filter(([, v]) => present(v) && typeof v !== 'object').map(([k, v]) => [humanize(k), v]);
  if (line === 'PROPERTY') {
    const r = x.fireRiskDetails || x.iarRiskDetails || {};
    if (!Object.keys(r).length && generic.length) return { heading: 'Risk details', rows: kv(generic) };
    return { heading: 'Risk details', rows: kv([['Location', r.locationAddress], ['Construction', r.constructionType], ['Building type', r.buildingType],
      ['Occupancy', r.occupancyType], ['Nature of business', r.natureOfBusiness], ['Earthquake zone', r.earthquakeZone]]) };
  }
  // Other lines: what the record has (description, insured persons, cargo and voyage, limits, obligee ...)
  const d = { ...(x.riskDetails || {}), ...x };
  const persons = Array.isArray(d.insuredPersons) ? d.insuredPersons.length : d.numberOfInsured ?? d.insuredPersonsCount ?? d.numberOfMembers ?? d.members;
  const known = kv([
    ['Class of insurance', x.productName || x.productType || x.product], ['Policy type', x.policyTypeName],
    ['Description', d.riskDescription || d.description], ['Insured persons', persons], ['Plan', d.planName || d.plan],
    ['Cargo', d.cargoDescription || d.cargo], ['Voyage', [d.voyageFrom, d.voyageTo].filter(Boolean).join(' to ')], ['Conveyance', d.conveyance || d.vesselName],
    ['Limit of liability', present(d.limitOfLiability) ? f.ccy(d.limitOfLiability, x.currency) : ''], ['Obligee', d.obligee], ['Bond type', d.bondType],
    ['Business', d.natureOfBusiness || d.businessDescription], ['Territorial limits', d.territorialLimits],
    [line === 'CASUALTY' || line === 'BOND' ? 'Limit / amount insured' : 'Sum insured', num(x.totalSumInsured ?? x.sumInsured) ? f.ccy(x.totalSumInsured ?? x.sumInsured, x.currency) : ''],
  ]);
  // generic details not already shown under the same label or with the same value
  const norm = (v) => String(v).trim().toLowerCase();
  const labels = new Set(known.map(([k]) => norm(k)));
  const values = new Set(known.map(([, v]) => norm(v)));
  return { heading: 'Risk details', rows: [...known, ...kv(generic).filter(([k, v]) => !labels.has(norm(k)) && !values.has(norm(v)) && !/sum insured/i.test(k))] };
}

/** Covers requested on a broker / placement slip: cover, sum insured or limit, deductible. */
const coversTable = (covers, currency) => ({ heading: `Covers (${currency || 'PHP'})`, table: { columns: ['Cover', { label: 'Sum insured / limit', type: 'money' }, { label: 'Deductible', wrap: true }],
  rows: covers.map((c) => [val(c.cover || c.name), present(c.sumInsured) ? money(c.sumInsured) : '', val(c.deductible)]) } });

export function coverageSection(x, f) {
  const line = lineOf(x);
  if (line === 'PROPERTY') {
    const si = x.fireRiskDetails?.sumInsured || x.iarRiskDetails?.sumInsured || x.sumInsuredBreakdown || {};
    const rows = Object.entries(si).filter(([, v]) => num(v)).map(([k, v]) => [humanize(k), money(v)]);
    if (!rows.length && x.requestedCovers?.length) return coversTable(x.requestedCovers, x.currency || f.currency);
    const total = money(x.totalSumInsured ?? x.sumInsured) || round2(rows.reduce((s, r) => s + r[1], 0));
    return { heading: `Sums insured (${x.currency || f.currency || 'PHP'})`, table: { columns: ['Item', { label: 'Sum insured', type: 'money' }], widths: [375, 140],
      rows: [...rows, ['Total sum insured', total]], totalRow: true } };
  }
  if (line !== 'MOTOR') return x.requestedCovers?.length ? coversTable(x.requestedCovers, x.currency || f.currency) : null;
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
const pct = (v) => `${Number(num(v).toFixed(4))}%`;
const brokerName = (h) => String(h.letterhead?.name || '').replace(/\.$/, '');

/** Security: the participating insurers with their shares (co-insurance); `focus` (insurer id) marks one participant's slip. */
function securitySection(parts, currency, focus = null, company = '') {
  if (!parts?.length) return { heading: 'Security', text: `To be advised.${company ? ` Placed by ${company}.` : ''}` };
  const rows = parts.map((x) => [`${x.insuranceCompanyName}${focus && Number(focus) === Number(x.insuranceCompanyId) ? ' (this slip)' : ''}`, x.isLead ? 'Lead' : 'Co-insurer',
    pct(x.sharePercent), money(x.sumInsured), money(x.premium), money(x.premiumTotal), val(x.insurerReference)]);
  return { heading: `Security (${currency || 'PHP'})`, table: { columns: [{ label: 'Insurer', wrap: true }, 'Role', { label: 'Share', align: 'right' }, { label: 'Sum insured', type: 'money' },
    { label: 'Premium', type: 'money' }, { label: 'Gross', type: 'money' }, 'Reference'], rows } };
}

/** Market comparison of the insurer offers of a broker slip (API shape of insurer offers). */
function offersSection(offers, currency, f) {
  return { heading: `Market comparison (${currency || 'PHP'})`, table: { columns: [{ label: 'Insurer', wrap: true }, 'Status', { label: 'Rate %', align: 'right' }, { label: 'Premium', type: 'money' },
    { label: 'Gross', type: 'money' }, { label: 'Line', align: 'right' }, { label: 'Deductibles', wrap: true }, 'Valid until'],
  rows: offers.map((o) => [o.insuranceCompanyName, humanize(o.status || ''), present(o.rate) ? String(o.rate) : '-', present(o.premium) ? money(o.premium) : '',
    present(o.premiumTotal) ? money(o.premiumTotal) : '', pct(o.offeredShare), val(o.deductibles), f.date(o.validityDate) || '-']) } };
}

/** Quotation Slip: the quotation presented to the client (with the market comparison when it came from a broker slip). */
/** Quotation Slip: the uploaded layout of the product's quotation-slip document template, else the standard layout. */
export async function quoteDoc(q) {
  const { productDocumentSpec } = await import('./productDocuments.js');
  return (await productDocumentSpec('quote', q, { printAs: 'quotation-slip' })) || standardQuoteDoc(q);
}

/** Cover terms (deductibles, exclusions) of the product's coverages, for the standard layouts. */
const coverTerms = async (x) => (await import('./productDocuments.js')).coverTermsSection(x);

export async function standardQuoteDoc(q) {
  const line = lineOf(q);
  const h = await header(line === 'MOTOR' ? 'Motor Insurance Quotation Slip' : `${q.productType || 'Insurance'} Quotation Slip`, q.quotationNumber);
  const f = formatters(h);
  const security = q.participants?.length > 1 ? [securitySection(q.participants, q.currency, null, brokerName(h))] : [];
  const market = q.offers?.length ? [offersSection(q.offers, q.currency, f)] : [];
  const qr = q.id ? await one('SELECT created_by, agent_user_id, approved_by FROM quotes WHERE id::text = $1', [String(q.id)]).catch(() => null) : null;
  const sig = await signatures(h, 'quotation', { status: q.quotationStatus, date: q.approvedAt || q.createdAt, signatory: q.authorizedSignature,
    issuedBy: qr?.agent_user_id || qr?.created_by, approvedBy: qr?.approved_by }, { blocks: [{ slot: 'authorized', label: `For ${brokerName(h) || 'the broker'}` }], perRow: 2 });
  return { ...h, watermark: sig.watermark, meta: kv([['Date', f.date(q.createdAt)], ['Valid until', f.date(q.validUntil)], ['Customer', customerOf(q.lead || {})], ['Status', q.quotationStatus],
    ['Product', q.productType], ['Policy type', await policyTypeLabel(q.insurancePolicyType)], ['Insurer', q.insuranceCompanyName], ['Currency', q.currency],
    ['Broker slip', q.brokerSlipNumber]]),
  sections: [riskSection(q, f), coverageSection(q, f), premiumTable(q, q.currency), await coverTerms(q), ...security, ...market,
    { heading: 'Remarks', text: q.remarks || 'This quotation is subject to the insurer\'s terms, conditions and final underwriting approval.' },
    sig.section] };
}

/** Risk of a broker slip or placement slip: the motor vehicle, else the generic risk details, else the quote-shaped risk. */
const slipRisk = (x, f) => riskSection({ ...(x.doc || {}), ...x }, f);

/** Broker Slip (request for quotation) to one insurer of the market. */
export async function brokerSlipDoc(b, offer = null) {
  const h = await header('Broker Slip - Request for Quotation', b.slipNumber);
  const f = formatters(h);
  const covers = b.requestedCovers || [];
  return { ...h, meta: kv([['To', offer ? offer.insuranceCompanyName : 'Insurance market'], ['Insured', b.insuredName], ['Class', b.productType],
    ['Period', `${f.date(b.inceptionDate) || '-'} to ${f.date(b.expiryDate) || '-'}`], ['Sum insured', num(b.sumInsured) ? f.ccy(b.sumInsured, b.currency) : ''], ['Currency', b.currency],
    ['Submitted', f.date(b.submissionDate)], ['Response due', f.date(b.responseDueDate)], ['Our reference', offer?.offerNumber]]),
  sections: [slipRisk(b, f), ...(lineOf(b) === 'MOTOR' ? [coverageSection({ ...(b.doc || {}), lob: 'MOTOR' }, f)] : []),
    covers.length ? coversTable(covers, b.currency) : { heading: 'Requested covers', text: 'As per the risk details.' },
    { heading: 'Information requested', text: 'Please quote your premium and rate, deductibles, special terms and conditions, the line (share %) you can write and the validity of your offer.' },
    { heading: 'Remarks', text: b.remarks || `Submitted by ${brokerName(h)}.` }] };
}

/** Placement Slip (firm order): one participant's slip shows its own share of the risk (focus = insurer id), else the whole security. */
export async function placementSlipDoc(pl, focus = null) {
  const h = await header('Placement Slip - Firm Order', pl.placementNumber);
  const f = formatters(h);
  const company = brokerName(h);
  const mine = focus ? (pl.participants || []).find((x) => Number(x.insuranceCompanyId) === Number(focus)) : null;
  const meta = [['Insured', pl.insuredName], ['Class', pl.productType], ['Period', `${f.date(pl.inceptionDate) || '-'} to ${f.date(pl.expiryDate) || '-'}`],
    ['Sum insured (100%)', num(pl.sumInsured) ? f.ccy(pl.sumInsured, pl.currency) : ''], ['Currency', pl.currency], ['Quotation slip', pl.quotationNumber],
    ['Status', pl.placementStatus ? humanize(pl.placementStatus) : '']];
  if (mine) meta.push(['To', mine.insuranceCompanyName], ['Your share', pct(mine.sharePercent)], ['Your role', mine.isLead ? 'Lead insurer' : 'Co-insurer'], ['Your reference', mine.insurerReference]);
  const shareTable = mine ? [{ heading: `Your share (${pct(mine.sharePercent)}, ${pl.currency || 'PHP'})`, table: { columns: ['Item', { label: '100%', type: 'money' }, { label: 'Your share', type: 'money' }],
    rows: [['Sum insured', money(pl.sumInsured), money(mine.sumInsured)], ['Net premium', money(pl.netPremium), money(mine.premium)], ['Taxes', money(pl.taxes), money(mine.taxes)],
      ['Gross premium', money(pl.grossPremium), money(mine.premiumTotal)], ['Commission', money(pl.commissionAmount), money(mine.commissionAmount)]] } }] : [];
  return { ...h, meta: kv(meta),
    sections: [slipRisk(pl, f), coverageSection({ ...(pl.doc || {}), ...pl, totalSumInsured: pl.sumInsured }, f), ...(mine ? [] : [premiumTable(pl, pl.currency)]), ...shareTable,
      securitySection(pl.participants, pl.currency, focus, company),
      { heading: 'Order', text: `${company} places this risk with the insurer(s) above for the share(s) shown and requests confirmation of cover and the policy / certificate number.${pl.remarks ? ` ${pl.remarks}` : ''}` },
      { heading: 'Acceptance', signatures: [{ label: 'For the broker' }, { label: 'For the insurer' }] }] };
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

/** Policy schedule: the uploaded layout of the product's policy-schedule document template, else the standard layout. */
export async function policyScheduleDoc(p) {
  const { productDocumentSpec } = await import('./productDocuments.js');
  return (await productDocumentSpec('policy', p, { printAs: 'policy-schedule' })) || standardPolicyScheduleDoc(p);
}

export async function standardPolicyScheduleDoc(p) {
  const q = p.quotation || {};
  const x = { ...q, ...p, ...policyPremium(p, q) };
  const h = await header('Policy Schedule', p.policyNumber);
  const f = formatters(h);
  const pr = p.id ? await one('SELECT created_by, status FROM policies WHERE id::text = $1', [String(p.id)]).catch(() => null) : null;
  const sig = await signatures(h, 'policy-schedule', { status: pr?.status || p.status, date: p.issuedDate || p.inception, issuedBy: pr?.created_by },
    { blocks: [{ slot: 'authorized', label: `For ${brokerName(h) || 'the broker'}` }], perRow: 2 });
  return { ...h, watermark: sig.watermark, meta: kv([['Insured', p.insuredName], ['Insurer', p.insuranceCompanyName], ['Period from', f.date(p.inception)], ['Period to', f.date(p.expiry)],
    ['Date issued', f.date(p.issuedDate)], ['Product', p.productName || p.productType], ['Policy type', p.policyTypeName || await policyTypeLabel(p.insurancePolicyType)],
    ['Sum insured', num(p.sumInsured) ? f.ccy(p.sumInsured, p.currency) : ''],
    ['Bill no.', p.billNumber], ['Payment status', p.paymentStatus ? humanize(p.paymentStatus) : ''], ['Quotation', q.quotationNumber], ['Currency', p.currency],
    // CTPL certificate of cover and its authentication code (Operations > CTPL Authentication)
    ['COC no.', p.cocNumber], ['CTPL authentication code', p.ctplAuthenticationCode], ['Insurer policy no.', p.insurerPolicyNumber]]),
  sections: [riskSection(x, f), coverageSection(x, f), premiumTable(x, p.currency), await coverTerms(x),
    { heading: 'Declaration', text: 'Subject to the terms, conditions, clauses and warranties of the policy wording of the insurer.' }, sig.section] };
}

/** Placing slip of an issued policy: the security (each insurer and its share); `focus` (insurer id) gives one participant's slip. */
export async function placingSlipDoc(p, focus = null) {
  const q = p.quotation || {};
  const x = { ...q, ...p, ...policyPremium(p, q) };
  const h = await header('Insurance Placing Slip', p.policyNumber);
  const f = formatters(h);
  const mine = focus ? (p.participants || []).find((r) => Number(r.insuranceCompanyId) === Number(focus)) : null;
  return { ...h, meta: kv([['Insured', p.insuredName], ['Insurer', mine ? mine.insuranceCompanyName : p.insuranceCompanyName], ['Class', p.productName || p.productType],
    ['Period', `${f.date(p.inception) || '-'} to ${f.date(p.expiry) || '-'}`], ['Sum insured', num(p.sumInsured) ? f.ccy(p.sumInsured, p.currency) : ''], ['Currency', p.currency],
    ...(mine ? [['Share', pct(mine.sharePercent)], ['Share of gross premium', f.ccy(mine.premiumTotal, p.currency)]] : [])]),
  sections: [riskSection(x, f), coverageSection(x, f), premiumTable(x, p.currency),
    p.participants?.length ? securitySection(p.participants, p.currency, focus, brokerName(h))
      : { heading: 'Security', text: `${val(p.insuranceCompanyName)} - 100% share. Placed by ${brokerName(h)}.` },
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
  // Under the EOPT Act the receipt is a supplementary document: its title is receipts.document_title (for example
  // Collection Receipt) and, once renamed, it carries invoice.supplementary_note ("not valid for claim of input tax")
  const title = (await getSetting('receipts.document_title', 'Official Receipt')) || 'Official Receipt';
  const h = h0 ? { ...h0, title, number: r.receipt_number } : await header(title, r.receipt_number);
  const f = formatters(h);
  const currency = r.currency_code || h.format?.currency || 'PHP';
  const applied = lines.length ? lines.map((l) => [l.policy_number, money(l.net_premium), money(l.vat), money(l.dst), money(l.lgt), money(l.paid)])
    : [[r.policy_number || '-', '', '', '', '', money(r.amount)]];
  const totals = ['TOTAL', ...[1, 2, 3, 4, 5].map((i) => (lines.length || i === 5 ? round2(applied.reduce((s, x) => s + num(x[i]), 0)) : ''))];
  const supplementary = title !== 'Official Receipt' ? (await getSetting('invoice.supplementary_note', 'THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.')) || '' : '';
  const footer = [(await getSetting('documents.receipt_footer', '')) || '', supplementary].filter(Boolean).join(' ');
  const sig = await signatures(h, 'official-receipt', { status: r.receipt_status || r.status, date: r.received_date, issuedBy: r.created_by },
    { blocks: [{ slot: 'authorized', label: 'Authorized signature' }], perRow: 3 });
  return { ...h, footerNote: footer, watermark: sig.watermark,
    meta: kv([['Date', f.date(r.received_date)], ['Received from', r.customer_name || r.client_name], ['Customer code', r.customer_code],
      ['Amount', f.ccy(r.amount, currency), { bold: true }], ['Payment mode', paymentModeLabel(r.payment_mode)], ['Reference', r.reference_no],
      ['Transaction no.', r.transaction_number], ['Status', r.receipt_status || r.status]]),
    sections: [
      { heading: 'Amount in words', text: amountInWords(r.amount, currency), bold: true },
      { heading: `Applied to (${currency})`, table: { columns: ['Policy no.', { label: 'Net premium', type: 'money' }, { label: 'VAT', type: 'money' }, { label: 'DST', type: 'money' },
        { label: 'LGT', type: 'money' }, { label: 'Amount paid', type: 'money' }], rows: [...applied, totals], totalRow: true } },
      { heading: 'Remarks', text: r.remarks || 'Thank you for your payment.' },
      sig.section,
    ] };
}

/**
 * Acknowledgement receipt (AR) of a premium payment captured on a policy: the broker (letterhead with TIN), received
 * from (client, TIN, address), the amount in figures and words, what it pays (policy, bill), mode and reference, the
 * official receipt once Accounting has confirmed the payment, and the staff member who received it. `c` is
 * policies/payments.js#captureForReceipt.
 */
export async function acknowledgementReceiptDoc(c) {
  const h = await header('Acknowledgment Receipt', c.arNumber);
  const f = formatters(h);
  const currency = h.format?.currency || 'PHP';
  const cl = c.client || {};
  const address = [cl.address, cl.city, cl.state].filter(present).join(', ');
  const status = c.status === 'confirmed' ? `Confirmed${c.receiptNumber ? `, official receipt ${c.receiptNumber}` : ''}` : c.status === 'rejected' ? 'Rejected' : 'Awaiting verification by Accounting';
  const note = (await getSetting('documents.acknowledgement_receipt_note', 'This acknowledgement receipt is not an official receipt. The official receipt is issued once the payment is verified by Accounting.')) || '';
  const sig = await signatures(h, 'acknowledgement-receipt', { status: c.status, date: c.paymentDate, issuedBy: c.submittedById, names: { 'issuing-user': c.submittedBy } },
    { blocks: [{ slot: 'received-by', label: 'Received by', name: c.submittedBy || null }, { label: 'Received from (client)' }], perRow: 2 });
  return { ...h, footerNote: note, watermark: sig.watermark,
    meta: kv([['Date received', f.date(c.paymentDate)], ['Received from', c.clientName], ['Customer code', c.clientCode], ['TIN', cl.tin], ['Address', address],
      ['Amount', f.ccy(c.amount, currency), { bold: true }], ['Payment mode', c.paymentModeLabel], ['Reference', c.referenceNo], ['Status', status]]),
    sections: [
      { heading: 'Amount in words', text: amountInWords(c.amount, currency), bold: true },
      { heading: `Payment for (${currency})`, table: { columns: ['Policy no.', 'Bill no.', 'Official receipt', { label: 'Amount received', type: 'money' }],
        rows: [[val(c.policyNumber), val(c.billNumber), val(c.receiptNumber), money(c.amount)]] } },
      ...(present(c.remarks) ? [{ heading: 'Remarks', text: c.remarks }] : []),
      sig.section,
    ] };
}

/**
 * Commission debit note to an insurer (direct bill), or commission billing statement (gross remittance, basis gross):
 * one line per policy / endorsement, commission, VAT, total due, the expanded withholding tax the insurer deducts and
 * the net amount payable. `dn` and `lines` are the API shapes (remittance/directbill.js#debitNoteOut).
 */
export async function commissionDebitNoteDoc(dn, lines) {
  const gross = dn.basis === 'gross';
  const h = await header(gross ? 'Billing Statement' : await getSetting('direct_bill.debit_note_title', 'Commission Debit Note'), dn.dnNumber);
  const f = formatters(h);
  const pct = (r) => `${(num(r) * 100).toFixed(2)}%`;
  const totals = [['Commission', money(dn.commission)], [`Output VAT${dn.vatRate ? ` (${pct(dn.vatRate)})` : ''}`, money(dn.vat)], ['Total amount due', money(dn.amount)],
    [`Less: expanded withholding tax (${pct(dn.ewtRate)} of commission)`, dn.expectedEwt ? -money(dn.expectedEwt) : 0], ['Net amount payable', money(dn.netPayable)]];
  if (dn.collectedAmount) totals.push(['Collected to date (cash + tax withheld)', -money(dn.collectedAmount)], ['Balance', money(dn.balance)]);
  const sum = (k) => round2(lines.reduce((s, l) => s + num(l[k]), 0));
  const sig = await signatures(h, 'debit-note', { status: dn.statusCode || dn.status, date: dn.dnDate, issuedBy: dn.createdById, approvedBy: dn.approvedById,
    names: { 'issuing-user': dn.createdBy, 'approving-user': dn.approvedBy } }, { blocks: [{ slot: 'prepared-by', label: 'Prepared by' }, { slot: 'approved-by', label: 'Approved by' }], perRow: 3 });
  return { ...h, watermark: sig.watermark, meta: kv([['Date', f.date(dn.dnDate)], ['Due date', f.date(dn.dueDate)], ['Bill to', dn.insurerName], ['Insurer TIN', dn.insurerTin],
    ['Address', dn.insurerAddress], ['Period', dn.periodFrom || dn.periodTo ? `${f.date(dn.periodFrom) || '-'} to ${f.date(dn.periodTo) || '-'}` : ''],
    ['Currency', dn.currency], ['Status', dn.status ? humanize(dn.status) : ''], ['Policies', String(lines.length)]]),
  sections: [
    { heading: gross ? 'Commission on policies whose premium was remitted in full' : 'Commission on direct-bill policies (premium paid by the insured to the insurer)',
      table: { columns: [{ label: 'Policy / reference', wrap: true }, 'Insured', 'Product', { label: 'Gross premium', type: 'money' }, { label: 'Rate', align: 'right' },
        { label: 'Commission', type: 'money' }, { label: 'VAT', type: 'money' }, { label: 'Total', type: 'money' }],
      rows: [...lines.map((l) => [l.reference && l.reference !== l.policyNo ? `${l.policyNo} / ${l.reference}` : l.policyNo, val(l.insuredName), val(l.product), money(l.grossPremium),
        l.commissionRate === null || l.commissionRate === undefined ? '-' : `${num(l.commissionRate).toFixed(2)}%`, money(l.commission), money(l.vat), money(l.amount)]),
      ['TOTAL', '', '', sum('grossPremium'), '', sum('commission'), sum('vat'), sum('amount')]], totalRow: true } },
    { heading: `Amount due (${dn.currency || f.ccy(0).split(' ')[0]})`, table: { columns: ['Item', { label: 'Amount', type: 'money' }], widths: [375, 140], rows: totals } },
    { heading: 'Payment instructions', text: ((await getSetting('direct_bill.debit_note_remarks')) ?? '') },
    ...(dn.remarks ? [{ heading: 'Remarks', text: dn.remarks }] : []),
    sig.section,
  ] };
}

/**
 * Remittance advice to an insurer (Accounts > Remittance > Tracking > Print), or the agency bill of an agent: the
 * remittance, the policies it pays with premium, commission, tax and net amount, the amount due and the signatures.
 * `rem` and `lines` are the API shapes (remittance/service.js#remittanceDetails and its policies).
 */
export async function remittanceAdviceDoc(rem, lines) {
  const agency = rem.kind === 'agency-bill';
  const title = agency ? await getSetting('remittance.agency_bill_title', 'Agency Bill') : await getSetting('remittance.advice_title', 'Remittance Advice');
  const h = await header(title || (agency ? 'Agency Bill' : 'Remittance Advice'), rem.remittanceNo);
  const f = formatters(h);
  const currency = rem.currency || h.format?.currency || 'PHP';
  const sum = (k) => round2(lines.reduce((s, l) => s + num(l[k]), 0));
  const ins = rem.insurerDetails || {};
  const totals = [['Gross premium', money(rem.grossAmount)], ['Less: commission', -money(rem.commission)]];
  if (num(rem.tax)) totals.push(['Tax', money(rem.tax)]);
  if (num(rem.adjustments)) totals.push(['Adjustments', money(rem.adjustments)]);
  totals.push(['Net amount', money(rem.netAmount)]);
  if (num(rem.previousBalance)) totals.push(['Previous balance', money(rem.previousBalance)], ['Total due', money(rem.billAmount)]);
  const sig = await signatures(h, 'remittance-advice', { status: rem.statusCode, date: rem.approvedAt || rem.remittanceDate, issuedBy: rem.createdById, approvedBy: rem.approvedById,
    names: { 'issuing-user': rem.createdBy, 'approving-user': rem.approvedBy } }, { blocks: [{ slot: 'prepared-by', label: 'Prepared by' }, { slot: 'approved-by', label: 'Approved by' }], perRow: 3 });
  return { ...h, watermark: sig.watermark,
    meta: kv([['Date', f.date(rem.remittanceDate)], ['Due date', f.date(rem.dueDate)], [agency ? 'Agency' : 'Insurer', agency ? rem.agencyName : (ins.name || rem.insurerName)],
      ['Insurer code', agency ? '' : (ins.code || rem.insurerCode)], ['Address', agency ? '' : ins.address], ['Period', rem.period], ['Currency', currency],
      ['Status', rem.status], ['Policies', String(lines.length)], ['Batch', rem.batchRef], ['Payment reference', rem.paymentReference]]),
    sections: [
      { heading: 'Policies',
        table: { columns: [{ label: 'Policy no.', wrap: true }, 'Insured', 'Product', 'Effective date', { label: 'Premium', type: 'money' }, { label: 'Commission', type: 'money' },
          { label: 'Tax', type: 'money' }, { label: 'Net amount', type: 'money' }],
        rows: [...lines.map((l) => [val(l.policyNo), val(l.insuredName), val(l.product), f.date(l.effectiveDate) || '-', money(l.premium), money(l.commission), money(l.tax), money(l.netAmount)]),
          ['TOTAL', '', '', '', sum('premium'), sum('commission'), sum('tax'), sum('netAmount')]], totalRow: true } },
      { heading: `Amount due (${currency})`, table: { columns: ['Item', { label: 'Amount', type: 'money' }], widths: [375, 140], rows: totals } },
      ...(present(rem.remarks) ? [{ heading: 'Remarks', text: rem.remarks }] : []),
      sig.section,
    ] };
}

/**
 * Endorsement (Operations > Endorsement > Print): the policy, the type and effective date, the premium change, every
 * change group recorded on the endorsement (personal details, vehicle, coverage, extension ...) and the authorised
 * signature once issued. `e` is endorsements/service.js#toEndorsement, `row` its endorsements row.
 */
export async function endorsementDoc(e, row = {}) {
  const h = await header(e.isCancelPolicy ? 'Cancellation Endorsement' : 'Endorsement', e.endorsementNumber || e.id);
  const f = formatters(h);
  const skip = new Set(['summary', 'completionDetails', 'documentKey', 'documentUrl', 'endorsementTypeIds', 'id', 'endorsementId', 'policyId', 'clientId', 'receivableId', 'remarks']);
  const scalar = (v) => v !== null && v !== undefined && typeof v !== 'object' && String(v).trim() !== '';
  const changes = Object.entries(row.changes || {}).filter(([k]) => !skip.has(k));
  const groups = changes.filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
    .map(([k, v]) => ({ heading: humanize(k), rows: kv(Object.entries(v).filter(([, x]) => scalar(x)).map(([a, x]) => [humanize(a), x])).slice(0, 40) }))
    .filter((g) => g.rows.length);
  const loose = kv(changes.filter(([, v]) => scalar(v)).map(([k, v]) => [humanize(k), v])).slice(0, 30);
  const sig = await signatures(h, 'endorsement', { status: row.status || e.status, date: e.completedAt || e.effectiveDate || e.createdAt, issuedBy: row.created_by },
    { blocks: [{ slot: 'authorized', label: `For ${brokerName(h) || 'the broker'}` }], perRow: 2 });
  return { ...h, watermark: sig.watermark,
    meta: kv([['Policy no.', e.policyNumber], ['Insured', e.insuredName || e.clientName], ['Customer code', e.clientCode],
      ['Endorsement type', humanize(String(e.endorsementType || '').replace(/,/g, ', '))], ['Effective date', f.date(e.effectiveDate)], ['Policy expiry', f.date(e.policyExpiry)],
      ['Status', e.status], ['Premium change', num(e.premiumDelta) ? f.ccy(e.premiumDelta) : 'None'], ['Cancellation', e.isCancelPolicy ? humanize(e.cancellationType || 'yes') : '']]),
    sections: [...(loose.length ? [{ heading: 'Changes', rows: loose }] : []), ...groups,
      { heading: 'Declaration', text: 'All other terms, conditions and warranties of the policy remain unchanged. This endorsement forms part of the policy.' },
      ...(present(e.remarks) ? [{ heading: 'Remarks', text: e.remarks }] : []), sig.section] };
}
