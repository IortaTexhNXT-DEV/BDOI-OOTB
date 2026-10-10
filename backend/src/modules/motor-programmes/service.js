/**
 * Brand-new vehicle programmes of a captive agency (Operations > Sales & Marketing > Dealer Programmes).
 *
 * A programme holds the terms agreed with a dealer and, optionally, a financing bank: insurer, own damage and acts of
 * nature rates, excess liability limits, CTPL term, the free or subsidised first year and who pays, and whether an
 * upload of the dealer's vehicle sales creates quotations (to follow up with the buyer) or issues the policies.
 *
 * Each sale row creates the prospect (channel: the dealer branch), the quotation priced with the quotation premium
 * routine (CTPL from the tariff of the vehicle class), and in issue mode 'policy' the client and the policy with the
 * bank as mortgagee. The premium is billed to who pays: the buyer, the dealer or the bank (subsidy), each through its
 * own bill (policies/service.js#issuePolicy payers).
 *
 * The premium preview prices a car exactly as the upload's quotation does (programmeQuote builds the one quotation
 * document both use) and lists each cover, tax and CTPL line with the part the dealer or bank and the buyer pay.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../documents/common.js';
import { mapColumns } from '../documents/tabular.js';
import { createLead } from '../leads/service.js';
import { createQuote } from '../quotations/service.js';
import { premiumBreakdown } from '../quotations/premium.js';
import { motorTariff, vehicleClass } from '../quotations/motorTariff.js';
import { listLgus, lguFor } from '../premium-charges/service.js';
import { clientFromLead } from '../clients/service.js';
import { issuePolicy } from '../policies/service.js';
import { participantInputs } from '../placement/participants.js';
import { billingClient, mortgageeClause, BANK_TYPES, DEALER_TYPES } from '../channels/service.js';

const FIELDS = {
  code: 'code', name: 'name', dealerChannelId: 'dealer_channel_id', bankChannelId: 'bank_channel_id', insuranceCompanyId: 'insurance_company_id',
  productId: 'product_id', vehicleType: 'vehicle_type', ownDamageRate: 'own_damage_rate', actsOfNatureRate: 'acts_of_nature_rate',
  bodilyInjury: 'bodily_injury', propertyDamage: 'property_damage', includeCtpl: 'include_ctpl', ctplTermYears: 'ctpl_term_years',
  freeFirstYear: 'free_first_year', subsidyPayer: 'subsidy_payer', subsidyType: 'subsidy_type', subsidyValue: 'subsidy_value', issueMode: 'issue_mode',
  mortgageeClause: 'mortgagee_clause', effectiveFrom: 'effective_from', effectiveTo: 'effective_to', status: 'status', notes: 'notes',
};

export const programmeOut = (r) => r && ({
  id: r.id, code: r.code, name: r.name, dealerChannelId: r.dealer_channel_id, dealerName: r.dealer_name ?? null, bankChannelId: r.bank_channel_id,
  bankName: r.bank_name ?? null, insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name ?? null, productId: r.product_id,
  vehicleType: r.vehicle_type, ownDamageRate: Number(r.own_damage_rate), actsOfNatureRate: Number(r.acts_of_nature_rate), bodilyInjury: Number(r.bodily_injury),
  propertyDamage: Number(r.property_damage), includeCtpl: r.include_ctpl, ctplTermYears: r.ctpl_term_years, freeFirstYear: r.free_first_year,
  subsidyPayer: r.subsidy_payer, subsidyType: r.subsidy_type, subsidyValue: Number(r.subsidy_value), issueMode: r.issue_mode,
  mortgageeClause: r.mortgagee_clause, effectiveFrom: r.effective_from, effectiveTo: r.effective_to, status: r.status, notes: r.notes,
  sales: r.sales ?? undefined, policies: r.policies ?? undefined, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

const SELECT = `SELECT m.*, d.name AS dealer_name, b.name AS bank_name, ic.name AS insurer_name,
  (SELECT count(*)::int FROM dealer_sales s WHERE s.programme_id = m.id AND s.status = 'created') AS sales,
  (SELECT count(*)::int FROM dealer_sales s WHERE s.programme_id = m.id AND s.policy_id IS NOT NULL) AS policies
  FROM motor_programmes m JOIN distribution_channels d ON d.id = m.dealer_channel_id LEFT JOIN distribution_channels b ON b.id = m.bank_channel_id
  LEFT JOIN insurance_companies ic ON ic.id = m.insurance_company_id`;

export async function listProgrammes(q = {}) {
  return (await many(`${SELECT} WHERE ($1::text IS NULL OR m.status = $1) AND ($2::text IS NULL OR m.name ILIKE '%' || $2 || '%' OR m.code ILIKE '%' || $2 || '%')
    ORDER BY m.name`, [q.status || null, q.search || null])).map(programmeOut);
}

export async function getProgrammeRow(id, db = { query }) {
  const r = (await db.query(`${SELECT} WHERE m.id::text = $1 OR lower(m.code) = lower($1)`, [String(id)])).rows[0];
  if (!r) throw notFound('Programme not found');
  return r;
}
export const getProgramme = async (id) => programmeOut(await getProgrammeRow(id));

async function validateProgramme(cols, id = null) {
  const errors = [];
  const channel = async (cid, types, path, label) => {
    if (!cid) return;
    const c = await one('SELECT channel_type, status FROM distribution_channels WHERE id = $1', [cid]);
    if (!c || c.status !== 'active') errors.push({ path, message: `${label} is not an active distribution channel` });
    else if (!types.includes(c.channel_type)) errors.push({ path, message: `${label} must be a ${types.join(' or ').replaceAll('_', ' ')}` });
  };
  await channel(cols.dealer_channel_id, DEALER_TYPES, 'dealerChannelId', 'The dealer');
  await channel(cols.bank_channel_id, BANK_TYPES, 'bankChannelId', 'The financing bank');
  if (cols.insurance_company_id && !(await one('SELECT 1 FROM insurance_companies WHERE id = $1', [cols.insurance_company_id]))) errors.push({ path: 'insuranceCompanyId', message: 'Unknown insurer' });
  if (cols.subsidy_payer === 'bank' && cols.bank_channel_id === null) errors.push({ path: 'bankChannelId', message: 'A bank-paid subsidy needs the financing bank' });
  if (cols.subsidy_type === 'percent' && num(cols.subsidy_value) > 100) errors.push({ path: 'subsidyValue', message: 'A percentage subsidy cannot exceed 100' });
  if (cols.effective_from && cols.effective_to && cols.effective_to < cols.effective_from) errors.push({ path: 'effectiveTo', message: 'effectiveTo is before effectiveFrom' });
  const tariff = await motorTariff();
  const cls = cols.vehicle_type ? vehicleClass(tariff, cols.vehicle_type) : null;
  if (cols.vehicle_type && tariff.vehicleTypes.length && !cls) {
    errors.push({ path: 'vehicleType', message: `${cols.vehicle_type} is not an Insurance Commission vehicle class of the motor tariff` });
  }
  if (cls && cols.include_ctpl !== false && Number(cols.ctpl_term_years) === 3 && cls.ctplPremium3Year === null) {
    errors.push({ path: 'ctplTermYears', message: `No 3-year CTPL tariff is configured for ${cls.label}: choose 1 year` });
  }
  if (cols.code && await one('SELECT 1 FROM motor_programmes WHERE lower(code) = lower($1) AND ($2::int IS NULL OR id <> $2)', [cols.code, id])) {
    errors.push({ path: 'code', message: `Programme code ${cols.code} is already used` });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
}

const columnsFrom = (b) => {
  const cols = {};
  for (const [k, c] of Object.entries(FIELDS)) if (b[k] !== undefined) cols[c] = b[k] === '' ? null : b[k];
  if (cols.vehicle_type) cols.vehicle_type = String(cols.vehicle_type).trim();
  if (cols.effective_from) cols.effective_from = isoDate(cols.effective_from);
  if (cols.effective_to) cols.effective_to = isoDate(cols.effective_to);
  return cols;
};

export async function createProgramme(b, userId) {
  const cols = columnsFrom(b);
  await validateProgramme({ bank_channel_id: null, include_ctpl: true, ctpl_term_years: 3, ...cols });
  const data = { ...cols, created_by: userId, updated_by: userId };
  const keys = Object.keys(data);
  const r = await one(`INSERT INTO motor_programmes(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data));
  return getProgramme(r.id);
}

export async function updateProgramme(id, b, userId) {
  const before = await getProgrammeRow(id);
  const cols = columnsFrom(b);
  await validateProgramme({ bank_channel_id: before.bank_channel_id, subsidy_type: before.subsidy_type, vehicle_type: before.vehicle_type, include_ctpl: before.include_ctpl,
    ctpl_term_years: before.ctpl_term_years, ...cols }, before.id);
  const data = { ...cols, updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await query(`UPDATE motor_programmes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before: programmeOut(before), after: await getProgramme(before.id) };
}

// ---------- dealer sales upload ----------

/** Columns of the Dealer Sales upload; the template (Dealer_Sales_Upload_Template.xlsx) is built from this list. */
export const DEALER_SALE_COLUMNS = [
  { key: 'dealerBranchCode', header: 'Dealer Branch Code', aliases: ['dealer code', 'branch code'], format: 'Code of the dealer branch (Distribution Channels); the programme\'s dealer when empty', example: 'TOY-MKT' },
  { key: 'saleDate', header: 'Sale Date', aliases: ['date sold', 'delivery date'], required: true, format: 'Date YYYY-MM-DD; the policy starts on this date', example: '2026-10-05' },
  { key: 'invoiceNumber', header: 'Sales Invoice No.', aliases: ['invoice number', 'invoice no'], format: 'Dealer sales invoice number', example: 'SI-104877' },
  { key: 'buyerFirstName', header: 'Buyer First Name', aliases: ['first name'], required: 'Buyer First Name or Buyer Company Name', format: 'Text', example: 'Ramon' },
  { key: 'buyerLastName', header: 'Buyer Last Name', aliases: ['last name'], format: 'Text', example: 'Villanueva' },
  { key: 'buyerCompanyName', header: 'Buyer Company Name', aliases: ['company name'], required: 'Buyer First Name or Buyer Company Name', format: 'Text; for a car bought by a company', example: '' },
  { key: 'buyerEmail', header: 'Buyer Email', aliases: ['email'], format: 'E-mail address', example: 'ramon.villanueva@example.ph' },
  { key: 'buyerMobile', header: 'Buyer Mobile', aliases: ['mobile', 'contact number'], format: 'Mobile number', example: '09175550123' },
  { key: 'buyerAddress', header: 'Buyer Address', aliases: ['address'], format: 'House / unit, street, barangay', example: '18 Sampaguita St., Barangay Bel-Air' },
  { key: 'buyerCity', header: 'Buyer City / Municipality', aliases: ['city'], format: 'City or municipality', example: 'Makati City' },
  { key: 'buyerProvince', header: 'Buyer Province', aliases: ['province'], format: 'Province (Metro Manila for NCR)', example: 'Metro Manila' },
  { key: 'make', header: 'Make', aliases: ['brand'], required: true, format: 'Vehicle brand', example: 'Toyota' },
  { key: 'model', header: 'Model', required: true, format: 'Vehicle model', example: 'Vios' },
  { key: 'variant', header: 'Variant', format: 'Model variant', example: '1.3 XLE CVT' },
  { key: 'yearModel', header: 'Year Model', aliases: ['year'], format: 'Four digits', example: '2026' },
  { key: 'color', header: 'Color', aliases: ['colour'], format: 'Text', example: 'Silver Metallic' },
  { key: 'vehicleType', header: 'Vehicle Type', aliases: ['vehicle class'], format: 'Insurance Commission vehicle class (CTPL tariff); the programme\'s when empty', example: 'private_cars' },
  { key: 'conductionSticker', header: 'Conduction Sticker', aliases: ['cs number'], format: 'Conduction sticker of a new car without plates', example: 'A1B234' },
  { key: 'plateNumber', header: 'Plate Number', format: 'When already issued', example: '' },
  { key: 'chassisNumber', header: 'Chassis Number', aliases: ['vin'], required: true, format: 'Chassis / VIN', example: 'MR2B29F30R1123456' },
  { key: 'engineNumber', header: 'Engine Number', aliases: ['motor number'], required: true, format: 'Engine / motor number', example: '2NR-F123456' },
  { key: 'invoicePrice', header: 'Invoice Price', aliases: ['price', 'sum insured'], required: true, format: 'Amount in PHP (the sum insured), greater than zero', example: '1015000' },
  { key: 'bankCode', header: 'Financing Bank Code', aliases: ['bank code'], format: 'Code of the financing bank or bank branch (Distribution Channels); the programme\'s bank when empty; none for a cash sale', example: 'BDO-AUTO' },
  { key: 'loanAmount', header: 'Loan Amount', aliases: ['loan'], format: 'Amount financed in PHP; 0 or empty for a cash sale', example: '812000' },
];

const SALE_OUT = (s) => ({
  id: s.id, batchId: s.batch_id, batchNumber: s.batch_number ?? null, programmeId: s.programme_id, rowNo: s.row_no, dealerChannelId: s.dealer_channel_id,
  dealerName: s.dealer_name ?? null, bankChannelId: s.bank_channel_id, bankName: s.bank_name ?? null, saleDate: s.sale_date, invoiceNumber: s.invoice_number,
  buyerName: [s.buyer_first_name, s.buyer_last_name].filter(Boolean).join(' ') || s.buyer_company_name, buyerEmail: s.buyer_email, buyerPhone: s.buyer_phone,
  vehicle: [s.year_model, s.make, s.model, s.variant].filter(Boolean).join(' '), make: s.make, model: s.model, variant: s.variant, yearModel: s.year_model,
  color: s.color, vehicleType: s.vehicle_type, conductionSticker: s.conduction_sticker, plateNumber: s.plate_number, chassisNumber: s.chassis_number,
  engineNumber: s.engine_number, invoicePrice: s.invoice_price == null ? null : Number(s.invoice_price), loanAmount: s.loan_amount == null ? null : Number(s.loan_amount),
  grossPremium: s.gross_premium == null ? null : Number(s.gross_premium), buyerShare: s.buyer_share == null ? null : Number(s.buyer_share),
  payerShare: s.payer_share == null ? null : Number(s.payer_share), leadId: s.lead_id, quoteId: s.quote_id, quoteNumber: s.quote_number ?? null,
  policyId: s.policy_id, policyNumber: s.policy_number ?? null, status: s.status, error: s.error, createdAt: s.created_at,
});
const SALE_SELECT = `SELECT s.*, b.batch_number, d.name AS dealer_name, k.name AS bank_name, q.quote_number, p.policy_number FROM dealer_sales s
  LEFT JOIN dealer_sales_batches b ON b.id = s.batch_id LEFT JOIN distribution_channels d ON d.id = s.dealer_channel_id
  LEFT JOIN distribution_channels k ON k.id = s.bank_channel_id LEFT JOIN quotes q ON q.id = s.quote_id LEFT JOIN policies p ON p.id = s.policy_id`;

/**
 * How the gross premium is shared: { buyer, payer, payerType } (payer: the dealer or the bank paying a subsidy). A bank
 * pays only for the cars it finances: a cash sale under a bank-subsidised programme is paid by the buyer.
 */
export function premiumShares(programme, gross, { financed = true } = {}) {
  const g = round2(gross);
  const payerType = programme.subsidy_payer === 'none' ? (programme.free_first_year ? 'dealer' : null) : programme.subsidy_payer;
  if (!payerType || (payerType === 'bank' && !financed)) return { buyer: g, payer: 0, payerType: null };
  let payer = 0;
  if (programme.free_first_year || programme.subsidy_type === 'full') payer = g;
  else if (programme.subsidy_type === 'percent') payer = round2((g * num(programme.subsidy_value)) / 100);
  else payer = Math.min(round2(num(programme.subsidy_value)), g);
  return { buyer: round2(g - payer), payer, payerType };
}

/**
 * The motor quotation document of a car sold under a programme (sum insured: the invoice price of the brand-new car, no
 * depreciation in year 1): the upload's quotation and the premium preview are priced from it, so they cannot differ.
 * LGT is at the rate of the LGU of lguCode or lguCity (the buyer's city), else the LGT rule rate.
 */
export const programmeQuote = (p, { price, vehicleType = null, lguCode = null, lguCity = null }) => ({
  productType: 'Motor', lob: 'MOTOR', productId: p.product_id || undefined, insuranceCompanyId: p.insurance_company_id || undefined,
  vehicleType: vehicleType || p.vehicle_type || null, includeCTPL: p.include_ctpl, ctplTermYears: p.ctpl_term_years,
  lossAndDamageCoverage: price, lossAndDamageCoverageRate: Number(p.own_damage_rate), actsOfNatureRate: Number(p.acts_of_nature_rate),
  bodilyInjury: Number(p.bodily_injury) || undefined, propertyDamage: Number(p.property_damage) || undefined, totalSumInsured: price, brandNew: true,
  ...(lguCode ? { lguCode } : {}), ...(lguCity ? { lguCity } : {}),
});

/** Cover premiums of a motor breakdown in the order of the schedule: [premium field, sum-insured field, rate, default name]. */
const COVER_LINES = [
  ['lossAndDamageCoveragePremium', 'lossAndDamageCoverage', 'own_damage_rate', 'Own Damage / Theft'],
  ['actsOfNaturePremium', 'lossAndDamageCoverage', 'acts_of_nature_rate', 'Acts of Nature'],
  ['bodilyInjuryCoveragePremium', 'bodilyInjury', null, 'Excess Bodily Injury'],
  ['propertyDamageCoveragePremium', 'propertyDamage', null, 'Property Damage'],
  ['roadsideAssistancePremium', 'lossAndDamageCoverage', null, 'Roadside Assistance'],
  ['personalAccidentCoverPremium', 'lossAndDamageCoverage', null, 'Personal Accident of the Driver'],
  ['APPAcoveragePremium', 'APPAtotalCoverage', null, 'Auto Personal Accident'],
];

/**
 * The lines of a premium breakdown: each cover (named as the product's covers priced on it, Own Damage and Theft share
 * one rate), any rating adjustment, each tax and charge of the charge engine, and CTPL; they add up to the gross premium.
 */
export function premiumLines(b, p, sumInsured) {
  const names = new Map();
  for (const c of b.coverSelection?.covers || []) if (c.quoteField) names.set(c.quoteField, [...(names.get(c.quoteField) || []), c.name]);
  const limits = { lossAndDamageCoverage: sumInsured, bodilyInjury: num(p.bodily_injury), propertyDamage: num(p.property_damage), APPAtotalCoverage: num(b.APPAtotalCoverage) };
  const lines = [];
  for (const [field, siField, rateCol, name] of COVER_LINES) {
    const amount = round2(num(b[field]));
    if (!amount && field !== 'lossAndDamageCoveragePremium') continue;
    const base = limits[siField];
    lines.push({ code: field, kind: 'cover', name: names.get(field)?.join(' / ') || name, base, rate: rateCol ? num(p[rateCol]) : base ? round2((amount / base) * 100 * 1e4) / 1e4 : null, amount });
  }
  const covers = round2(lines.reduce((s, l) => s + l.amount, 0));
  const adjustment = round2(num(b.netPremium) - covers);
  if (adjustment) lines.push({ code: 'adjustment', kind: 'cover', name: 'Rating adjustment', base: null, rate: null, amount: adjustment });
  for (const c of b.charges?.lines || []) lines.push({ code: c.code, kind: 'tax', name: c.name, base: c.base, rate: c.rate, amount: round2(c.amount) });
  if (num(b.ctplCoveragePremium)) lines.push({ code: 'CTPL', kind: 'ctpl', name: 'CTPL', base: null, rate: null, years: b.ctplTermYears ?? null, amount: round2(num(b.ctplCoveragePremium)) });
  return lines;
}

/**
 * The payer's share spread over the lines in proportion to their amounts (the rounding difference on the largest line), so
 * each line shows what the dealer or bank and the buyer pay of it and the columns add up to the shares.
 */
export function splitLines(lines, { payer }) {
  const gross = round2(lines.reduce((s, l) => s + l.amount, 0));
  const out = lines.map((l) => ({ ...l, payer: gross ? round2((l.amount * payer) / gross) : 0 }));
  const diff = round2(payer - out.reduce((s, l) => s + l.payer, 0));
  if (diff && out.length) {
    const big = out.reduce((m, l) => (Math.abs(l.amount) > Math.abs(m.amount) ? l : m), out[0]);
    big.payer = round2(big.payer + diff);
  }
  return out.map((l) => ({ ...l, buyer: round2(l.amount - l.payer) }));
}

/** Choices of the premium preview: the vehicle classes of the motor tariff and the LGUs with a tax rate. */
export async function previewOptions() {
  const tariff = await motorTariff();
  const lgus = await listLgus({ active: true });
  return {
    vehicleTypes: tariff.vehicleTypes.map((c) => ({ value: c.value, label: c.label, ctplPremium: c.ctplPremium, ctplPremium3Year: c.ctplPremium3Year })),
    lgus: lgus.map((l) => ({ code: l.code, name: l.name, province: l.province, rate: l.rate })),
  };
}

/**
 * Premium of a car under a programme and who pays what, nothing saved: priced as the upload's quotation (programmeQuote),
 * for the vehicle class given (else the programme's), the LGU given (else the LGT rule rate) and, for a bank subsidy, a car
 * financed by the bank unless financed is false.
 */
export async function previewPremium(id, { invoicePrice, vehicleType = null, lguCode = null, financed = null }) {
  const p = await getProgrammeRow(id);
  const price = round2(num(invoicePrice));
  if (lguCode && !(await lguFor({ lguCode }))) throw badRequest('Validation failed', [{ path: 'lguCode', message: `No LGU tax rate in force for ${lguCode}` }]);
  const isFinanced = financed ?? Boolean(p.bank_channel_id);
  const b = await premiumBreakdown(programmeQuote(p, { price, vehicleType, lguCode }), { insurerId: p.insurance_company_id });
  const shares = premiumShares(p, b.grossPremium, { financed: isFinanced });
  const lines = splitLines(premiumLines(b, p, price), shares);
  const cls = vehicleClass(await motorTariff(), b.vehicleType);
  const lgt = (b.charges?.lines || []).find((c) => c.kind === 'lgt');
  return {
    netPremium: b.netPremium, taxes: round2(lines.filter((l) => l.kind === 'tax').reduce((s, l) => s + l.amount, 0)), ctplPremium: b.ctplCoveragePremium,
    grossPremium: b.grossPremium, commissionAmount: b.commissionAmount, ...shares, lines,
    basis: {
      programmeCode: p.code, programmeName: p.name, insurerName: p.insurer_name ?? null, dealerName: p.dealer_name ?? null, bankName: p.bank_name ?? null,
      payerName: shares.payerType === 'bank' ? p.bank_name ?? null : shares.payerType === 'dealer' ? p.dealer_name ?? null : null,
      sumInsured: price, ownDamageRate: num(p.own_damage_rate), actsOfNatureRate: num(p.acts_of_nature_rate), vehicleType: b.vehicleType || null,
      vehicleTypeLabel: cls?.label || null, includeCtpl: p.include_ctpl, ctplTermYears: b.ctplTermYears ?? null, lgu: b.charges?.lgu || null, lgtRate: lgt ? lgt.rate : null,
      financed: isFinanced, freeFirstYear: p.free_first_year, subsidyPayer: p.subsidy_payer,
      subsidyType: p.subsidy_type, subsidyValue: num(p.subsidy_value),
    },
  };
}

/** A channel by code, of the given types (null when the code is empty). */
async function channelByCode(db, code, types, label) {
  if (!code) return null;
  const c = (await db.query('SELECT * FROM distribution_channels WHERE lower(code) = lower($1)', [String(code)])).rows[0];
  if (!c || c.status !== 'active') throw badRequest(`${label} ${code} is not an active distribution channel`);
  if (!types.includes(c.channel_type)) throw badRequest(`${label} ${code} is a ${c.channel_type.replaceAll('_', ' ')}`);
  return c;
}

/** Errors of an uploaded sale row (empty when it can be processed). */
function rowErrors(v) {
  const e = [];
  if (!v.buyerFirstName && !v.buyerCompanyName) e.push('Buyer First Name or Buyer Company Name is required');
  for (const k of ['saleDate', 'make', 'model', 'chassisNumber', 'engineNumber', 'invoicePrice']) {
    if (!v[k]) e.push(`${DEALER_SALE_COLUMNS.find((c) => c.key === k).header} is required`);
  }
  if (v.saleDate && !isoDate(v.saleDate)) e.push('Sale Date must be a date (YYYY-MM-DD)');
  if (v.invoicePrice && !(num(String(v.invoicePrice).replace(/,/g, '')) > 0)) e.push('Invoice Price must be greater than zero');
  if (v.buyerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.buyerEmail)) e.push('Buyer Email is not a valid e-mail address');
  return e;
}

const amount = (v) => num(String(v ?? '').replace(/,/g, ''));

/**
 * Process one sale inside the caller's transaction: prospect, quotation and, in issue mode 'policy', client and policy.
 * Returns the dealer_sales columns to store.
 */
async function processSale(db, p, v, userId) {
  const dealer = (await channelByCode(db, v.dealerBranchCode, ['dealer_branch', 'dealer_group'], 'Dealer')) || (await db.query('SELECT * FROM distribution_channels WHERE id = $1', [p.dealer_channel_id])).rows[0];
  const loan = amount(v.loanAmount);
  const bank = (await channelByCode(db, v.bankCode, BANK_TYPES, 'Financing bank'))
    || (loan > 0 && p.bank_channel_id ? (await db.query('SELECT * FROM distribution_channels WHERE id = $1', [p.bank_channel_id])).rows[0] : null);
  const price = amount(v.invoicePrice);
  const lead = await createLead({
    firstName: v.buyerFirstName || null, lastName: v.buyerLastName || null, companyName: v.buyerCompanyName || null, emailId: v.buyerEmail || null,
    contactNumber: v.buyerMobile || null, houseNo: v.buyerAddress || null, city: v.buyerCity || null, province: v.buyerProvince || null, country: 'Philippines',
    leadCategory: v.buyerCompanyName && !v.buyerFirstName ? 'Corporate' : 'Retail', lob: 'MOTOR', source: 'dealer-programme', channelId: dealer.id,
    notes: `Dealer sale ${v.invoiceNumber || ''} (${p.code})`.trim(),
  }, userId, db);
  const bankRow = bank ? (bank.channel_type === 'bank_branch' && bank.parent_id ? (await db.query('SELECT * FROM distribution_channels WHERE id = $1', [bank.parent_id])).rows[0] : bank) : null;
  const clause = bank ? await mortgageeClause(bankRow.mortgagee_clause ? bankRow : { ...bankRow, mortgagee_clause: p.mortgagee_clause }, bank) : null;
  const vehicle = { vehicleBrand: v.make, vehicleModel: v.model, modelVariant: v.variant || null, modelYear: v.yearModel || null, vehicleColor: v.color || null,
    vehicleType: v.vehicleType || p.vehicle_type || null };
  const quote = await createQuote({
    leadRefId: lead.id, ...programmeQuote(p, { price, vehicleType: vehicle.vehicleType, lguCity: v.buyerCity || null }),
    insuranceVehicleDetails: [vehicle], plateNumber: v.plateNumber || v.conductionSticker || null, conductionSticker: v.conductionSticker || null,
    chassisNumber: v.chassisNumber, motorNumber: v.engineNumber, channelId: dealer.id,
    mortgage: bankRow ? bankRow.name : null, mortgageeClause: clause, mortgageeChannelId: bank?.id || null, loanAmount: loan || null,
    dealerProgramme: { programmeId: p.id, code: p.code, invoiceNumber: v.invoiceNumber || null, saleDate: isoDate(v.saleDate) },
    remarks: `Brand-new vehicle programme ${p.code}`,
  }, userId, db);
  const shares = premiumShares(p, Number(quote.premium_total), { financed: Boolean(bank) });
  const out = { lead_id: lead.id, quote_id: quote.id, gross_premium: Number(quote.premium_total), buyer_share: shares.buyer, payer_share: shares.payer,
    dealer_channel_id: dealer.id, bank_channel_id: bank?.id || null, policy_id: null };
  // issue mode 'quotation': the draft quotation is followed up with the buyer like any other
  if (p.issue_mode !== 'policy') return out;
  // issue at once: the buyer becomes a client, the policy starts on the sale date, each payer gets its bill
  const clientId = await clientFromLead(db, lead.id, {}, userId);
  const payerChannel = shares.payerType === 'bank' ? bankRow.id : p.dealer_channel_id;
  const payers = [];
  if (shares.payer > 0) payers.push({ clientId: await billingClient(db, payerChannel, userId), amount: shares.payer, reference: `${p.code} subsidy` });
  if (shares.buyer > 0) payers.push({ clientId, amount: shares.buyer });
  const issued = await issuePolicy(db, {
    quoteId: quote.id, clientId, leadId: lead.id, productId: quote.product_id, insuranceCompanyId: quote.insurance_company_id, ownerUserId: userId, agentUserId: userId,
    sumInsured: Number(quote.sum_insured), netPremium: Number(quote.premium_base), grossPremium: Number(quote.premium_total), commissionAmount: Number(quote.commission_amount),
    commissionRate: Number(quote.commission_rate || 0), currency: quote.currency, insuredName: lead.display_name, productType: 'Motor', lob: 'MOTOR',
    doc: { ...(quote.doc || {}), source: 'dealer-programme' }, participants: await participantInputs('quote', quote.id, db), payers,
    taxes: round2(num(quote.vat) + num(quote.dst) + num(quote.lgt) + num(quote.fst)),
  }, { inception: isoDate(v.saleDate) }, userId);
  await db.query("UPDATE quotes SET status = 'converted', policy_id = $2, client_id = $3, updated_by = $4, updated_at = now() WHERE id = $1", [quote.id, issued.policyId, clientId, userId]);
  return { ...out, policy_id: issued.policyId };
}

const SALE_COLS = (v) => ({
  sale_date: isoDate(v.saleDate), invoice_number: v.invoiceNumber || null, buyer_first_name: v.buyerFirstName || null, buyer_last_name: v.buyerLastName || null,
  buyer_company_name: v.buyerCompanyName || null, buyer_email: v.buyerEmail || null, buyer_phone: v.buyerMobile || null, buyer_address: v.buyerAddress || null,
  buyer_city: v.buyerCity || null, buyer_province: v.buyerProvince || null, make: v.make || null, model: v.model || null, variant: v.variant || null,
  year_model: Number(v.yearModel) || null, color: v.color || null, vehicle_type: v.vehicleType || null, conduction_sticker: v.conductionSticker || null,
  plate_number: v.plateNumber || null, chassis_number: v.chassisNumber || null, engine_number: v.engineNumber || null,
  invoice_price: amount(v.invoicePrice) || null, loan_amount: amount(v.loanAmount) || null,
});

/** Upload a dealer's vehicle sales for a programme: each row is processed on its own (a failed row is kept with its error). */
export async function uploadSales(programmeId, rows, { fileName = null, userId }) {
  const p = await getProgrammeRow(programmeId);
  if (p.status !== 'active') throw conflict(`Programme ${p.code} is inactive`);
  const max = Number(await getSetting('motor_programmes.max_rows', 2000));
  if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; at most ${max} sales can be uploaded at once (motor_programmes.max_rows)`);
  const batchNumber = await nextDocumentNumber('dealer_sales_batch', { unique: { table: 'dealer_sales_batches', column: 'batch_number' } });
  const batch = await one('INSERT INTO dealer_sales_batches(batch_number, programme_id, file_name, rows_total, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [batchNumber, p.id, fileName, rows.length, userId]);
  const now = await today();
  const emailLetters = (await getSetting('motor_programmes.email_bank_letter', false)) === true;
  let created = 0;
  const errors = [];
  for (const [i, row] of rows.entries()) {
    const v = mapColumns(row, DEALER_SALE_COLUMNS);
    const base = { batch_id: batch.id, programme_id: p.id, row_no: i + 2, created_by: userId, ...SALE_COLS(v) };
    let problems = rowErrors(v);
    if (!problems.length) {
      const sale = isoDate(v.saleDate);
      if ((p.effective_from && sale < p.effective_from) || (p.effective_to && sale > p.effective_to)) problems.push(`Sale Date ${sale} is outside the programme period`);
      if (sale > now) problems.push('Sale Date is in the future');
      const dup = await one("SELECT 1 FROM dealer_sales WHERE lower(chassis_number) = lower($1) AND status = 'created' LIMIT 1", [v.chassisNumber]);
      if (dup) problems.push(`Chassis Number ${v.chassisNumber} was already uploaded`);
    }
    let result = null;
    if (!problems.length) {
      try {
        result = await withTransaction((db) => processSale(db, p, v, userId));
      } catch (e) {
        problems = [e.details?.map?.((d) => d.message).join('; ') || e.message];
      }
    }
    const data = result ? { ...base, ...result, status: 'created' } : { ...base, status: 'failed', error: problems.join('; ') };
    const keys = Object.keys(data);
    const saleId = (await one(`INSERT INTO dealer_sales(${keys.join(',')}) VALUES (${keys.map((_, k) => `$${k + 1}`).join(',')}) RETURNING id`, Object.values(data))).id;
    if (result) created += 1; else errors.push({ row: i + 2, message: data.error });
    if (result?.policy_id && result.bank_channel_id && emailLetters) await emailBankLetter(saleId).catch(() => null);
  }
  const failed = rows.length - created;
  await query('UPDATE dealer_sales_batches SET rows_created = $2, rows_failed = $3, status = $4 WHERE id = $1',
    [batch.id, created, failed, failed === 0 ? 'processed' : created === 0 ? 'failed' : 'partial']);
  return { batchId: batch.id, batchNumber, total: rows.length, created, failed, errors, issueMode: p.issue_mode };
}

export async function listBatches(q = {}) {
  return many(`SELECT b.id, b.batch_number AS "batchNumber", b.programme_id AS "programmeId", m.code AS "programmeCode", m.name AS "programmeName", b.file_name AS "fileName",
      b.rows_total AS "rowsTotal", b.rows_created AS "rowsCreated", b.rows_failed AS "rowsFailed", b.status, b.created_at AS "createdAt", u.display_name AS "createdBy"
    FROM dealer_sales_batches b JOIN motor_programmes m ON m.id = b.programme_id LEFT JOIN users u ON u.id = b.created_by
    WHERE ($1::text IS NULL OR b.programme_id::text = $1) ORDER BY b.created_at DESC LIMIT 200`, [q.programmeId ? String(q.programmeId) : null]);
}

export async function listSales(q = {}) {
  const rows = await many(`${SALE_SELECT} WHERE ($1::text IS NULL OR s.batch_id = $1) AND ($2::text IS NULL OR s.programme_id::text = $2) AND ($3::text IS NULL OR s.status = $3)
    AND ($4::text IS NULL OR s.bank_channel_id = $4) ORDER BY s.created_at DESC, s.row_no LIMIT 2000`,
  [q.batchId || null, q.programmeId ? String(q.programmeId) : null, q.status || null, q.bankChannelId || null]);
  return rows.map(SALE_OUT);
}

export async function getSale(id) {
  const s = await one(`${SALE_SELECT} WHERE s.id = $1`, [String(id)]);
  if (!s) throw notFound('Dealer sale not found');
  return s;
}
export const saleOut = SALE_OUT;

/** Queue the bank endorsement letter of a sale to the bank's contact e-mail (the branch's, else the bank's); null when none. */
export async function emailBankLetter(saleId, to = null) {
  const { bankLetterSpec } = await import('./letters.js');
  const { queueEmail, documentAttachment } = await import('../../lib/mailer.js');
  const s = await getSale(saleId);
  const spec = await bankLetterSpec(s.id);
  const bank = await one('SELECT k.contact_email, p.contact_email AS parent_email FROM distribution_channels k LEFT JOIN distribution_channels p ON p.id = k.parent_id WHERE k.id = $1', [s.bank_channel_id]);
  const address = to || bank?.contact_email || bank?.parent_email;
  if (!address) return null;
  const outboxId = await queueEmail({ to: address, subject: `${spec.title} ${spec.number || ''}`.trim(), html: `<p>${String(spec.sections[1].text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`, template: 'bank-endorsement-letter',
    entity: 'dealer_sale', entityId: s.id, attachments: [documentAttachment('bank-endorsement-letter', { saleId: s.id }, `bank-letter-${spec.number || s.id}.pdf`)] });
  await query('UPDATE dealer_sales SET letter_sent_at = now() WHERE id = $1', [s.id]);
  return { outboxId, to: address };
}
