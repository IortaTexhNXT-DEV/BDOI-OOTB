/**
 * Product-wise policy sheets of the migration kit: one sheet per kind of TISPH product, with the common policy columns
 * and the columns of the product, stored in policies.doc under the keys the renewal carry-over reads
 * (renewals/service.js CARRY_KEYS), so the renewal of a migrated policy carries them.
 *
 *   Policies - Motor              MOTOR                vehicle, conduction sticker, TFS loan reference, dealer
 *   Policies - CTPL               CTPL                 vehicle, COC number and authentication code
 *   Policies - Personal Accident  PA, GPA              plan, insured persons, beneficiary, occupation class
 *   Policies - Credit Life        CL-COMP, CL-VOL      borrower, TFS loan account, loan amount, term, release date
 *   Policies - Travel             TRAVEL               plan, destination, travel dates, travellers
 *   Policies - Fire               line fire            risk address, occupancy, construction (only with an active
 *                                                      fire product: TISPH has none, migration 0341)
 *   Policies - Other Lines        any other product    common columns only (Parcel today)
 *
 * A product belongs to the first kind it matches (policyKindOf); a product of a kind whose sheet is not in the
 * workbook (an inactive fire product) goes on Other Lines. Amounts are pesos as booked in the legacy ledger; a policy
 * of a foreign currency keeps its original currency, sum insured and rate as reference (doc), never as its currency.
 */
import { many, one } from '../../db/pool.js';
import { addCalendarMonths as addMonths } from '../../lib/dates.js';
import { amountValue, dateValue, fail, numberCell, pesoValue } from './common.js';

const CTPL_RE = /\bCTPL\b|compulsory third party/i;
const TRAVEL_RE = /travel/i;

/** Kinds of policy sheets in workbook order: key, sheet name, the products it holds, the lines it covers. */
export const POLICY_KINDS = [
  { kind: 'motor', key: 'policies-motor', name: 'Policies - Motor', lines: ['motor'], accepts: (p) => p.line === 'motor' && !CTPL_RE.test(`${p.code} ${p.name}`) },
  { kind: 'ctpl', key: 'policies-ctpl', name: 'Policies - CTPL', lines: ['motor'], accepts: (p) => CTPL_RE.test(`${p.code} ${p.name}`) },
  { kind: 'pa', key: 'policies-pa', name: 'Policies - Personal Accident', lines: ['accident'], accepts: (p) => p.line === 'accident' && !TRAVEL_RE.test(`${p.code} ${p.name}`) },
  { kind: 'credit-life', key: 'policies-credit-life', name: 'Policies - Credit Life', lines: ['life'], accepts: (p) => p.line === 'life' || /^CL-/i.test(p.code || '') },
  { kind: 'travel', key: 'policies-travel', name: 'Policies - Travel', lines: ['accident'], accepts: (p) => TRAVEL_RE.test(`${p.code} ${p.name}`) },
  { kind: 'fire', key: 'policies-fire', name: 'Policies - Fire', lines: ['fire'], accepts: (p) => p.line === 'fire', activeOnly: true },
  { kind: 'other', key: 'policies-other', name: 'Policies - Other Lines', lines: [], accepts: () => true },
];

/** Kind of a product ({ code, name, line }): the first kind that accepts it. */
export const policyKindOf = (p) => POLICY_KINDS.find((k) => k.accepts({ code: p?.code || '', name: p?.name || '', line: p?.line || '' }))?.kind || 'other';

/** Kinds whose sheet is in this environment's workbook: Fire only while an active product of line fire exists. */
export async function presentKinds() {
  const fire = await one("SELECT 1 AS x FROM products WHERE status = 'active' AND line = 'fire' LIMIT 1");
  return POLICY_KINDS.filter((k) => !k.activeOnly || fire).map((k) => k.kind);
}

/** Active products of a kind (codes), for the Lists sheet and the Instructions. kinds: the kinds present. */
export async function productsOfKind(kind, kinds) {
  const rows = await many("SELECT code, name, line FROM products WHERE status = 'active' AND code IS NOT NULL ORDER BY code");
  return rows.filter((p) => sheetKindOf(p, kinds) === kind).map((p) => p.code);
}

/** Sheet kind a product goes on, among the kinds present (a kind without its sheet goes on Other Lines). */
export const sheetKindOf = (p, kinds) => {
  const k = policyKindOf(p);
  return kinds.includes(k) ? k : 'other';
};

// ------------------------------------------------------------------ columns

/** Columns of every policy sheet. */
export const COMMON_COLUMNS = [
  { key: 'policyNumber', header: 'Policy Number', required: true, format: 'Policy number in the legacy system (the insurer policy number); kept as the policy number' },
  { key: 'clientCode', header: 'Client Code', required: true, format: 'Client Code of the Clients sheet (or of a client already migrated)' },
  { key: 'insurer', header: 'Insurer', required: true, list: 'Insurers', format: 'Insurer code (or name) of the Insurance Company master' },
  { key: 'product', header: 'Product', required: true, format: 'Product code of the Product master (Lists sheet: the products of this sheet)' },
  { key: 'insuredName', header: 'Insured Name', format: 'The client name when empty' },
  { key: 'inceptionDate', header: 'Inception Date', required: true, type: 'date', format: 'Date YYYY-MM-DD' },
  { key: 'expiryDate', header: 'Expiry Date', required: true, type: 'date', format: 'Date YYYY-MM-DD, on or after the cutover date (in force)' },
  { key: 'issueDate', header: 'Issue Date', required: true, type: 'date', format: 'Date YYYY-MM-DD, before the cutover date' },
  { key: 'sumInsured', header: 'Sum Insured', type: 'number', format: 'Amount in PHP, at most two decimals' },
  { key: 'netPremium', header: 'Net Premium', type: 'number', format: 'Amount in PHP, at most two decimals; the gross premium when empty' },
  { key: 'grossPremium', header: 'Gross Premium', required: true, type: 'number', format: 'Amount in PHP including taxes, greater than zero, at most two decimals' },
  { key: 'commissionRate', header: 'Commission Rate', type: 'number', format: 'Decimal fraction (0.20 for 20%); the insurer default when empty' },
  { key: 'billingMode', header: 'Billing Mode', list: 'Billing Mode', format: 'broker or direct; the insurer default when empty' },
  { key: 'paymentStatus', header: 'Payment Status', list: 'Payment Status', format: 'Completed when empty; Pending or Partial when an open item is loaded' },
  { key: 'accountExecutive', header: 'Account Executive', format: 'Username of the Account Executive who owns the policy (renewal follow-up)' },
  { key: 'branch', header: 'Branch', list: 'Branches', format: 'Branch code' },
  { key: 'distributionChannel', header: 'Distribution Channel', list: 'Distribution Channels', format: 'Distribution channel code' },
  { key: 'businessType', header: 'Business Type', list: 'Business Type', format: 'New or Renewal, in the legacy term' },
  { key: 'previousPolicyNumber', header: 'Previous Legacy Policy Number', format: 'Policy number of the term before, in the legacy system (reference)' },
  { key: 'legacySystem', header: 'Legacy System', format: 'Source of the record; the legacy system of the load when empty' },
  { key: 'originalCurrency', header: 'Original Currency', list: 'Currencies', format: 'Currency of a foreign-currency policy (reference); the amounts above stay in PHP' },
  { key: 'originalSumInsured', header: 'Original Sum Insured', type: 'number', format: 'Sum insured in the original currency (reference)' },
  { key: 'exchangeRate', header: 'Exchange Rate', type: 'number', format: 'PHP per unit of the original currency used by the legacy ledger (reference)' },
];

const VEHICLE = [
  { key: 'plateNumber', header: 'Plate Number', format: 'Plate, conduction sticker or chassis number required' },
  { key: 'conductionSticker', header: 'Conduction Sticker' },
  { key: 'chassisNumber', header: 'Chassis Number' },
  { key: 'motorNumber', header: 'Engine Number' },
  { key: 'mvFileNumber', header: 'MV File Number' },
];

/** Product columns of each kind; key = the policies.doc key. */
const PRODUCT_COLUMNS = {
  motor: [
    ...VEHICLE,
    { key: 'vehicleBrand', header: 'Brand', list: 'Vehicle Brands' },
    { key: 'vehicleModel', header: 'Model' },
    { key: 'modelVariant', header: 'Variant' },
    { key: 'modelYear', header: 'Model Year', format: 'Four digits, not after the year after the cutover' },
    { key: 'vehicleType', header: 'Body Type', list: 'Vehicle Types' },
    { key: 'vehicleColor', header: 'Colour' },
    { key: 'seatingCapacity', header: 'Seating Capacity', type: 'number', format: '1 to 60' },
    { key: 'mortgage', header: 'Mortgagee / Financier' },
    { key: 'loanReference', header: 'TFS Loan Reference' },
    { key: 'dealerCode', header: 'Dealer' },
  ],
  ctpl: [
    ...VEHICLE,
    { key: 'certNumber', header: 'COC Number', required: true, format: 'Certificate of cover number; unique per insurer among in-force CTPL' },
    { key: 'authenCode', header: 'Authentication Code', format: 'LTO authentication code of the COC' },
    { key: 'vehicleType', header: 'Vehicle Type', list: 'CTPL Classes' },
    { key: 'vehicleBrand', header: 'Brand', list: 'Vehicle Brands' },
    { key: 'vehicleModel', header: 'Model' },
  ],
  pa: [
    { key: 'plan', header: 'Plan', list: 'Plans' },
    { key: 'insuredCount', header: 'Insured Persons', type: 'number', format: 'Group PA: at least 2; PA: 1' },
    { key: 'beneficiary', header: 'Beneficiary / Nominee' },
    { key: 'occupationClass', header: 'Occupation Class' },
  ],
  'credit-life': [
    { key: 'borrowerName', header: 'Borrower Name', format: 'The insured name when the Insured Name is empty' },
    { key: 'loanReference', header: 'TFS Loan Account Number' },
    { key: 'loanAmount', header: 'Loan Amount', required: true, type: 'number', format: 'Amount in PHP, greater than zero; the sum insured when the Sum Insured is empty' },
    { key: 'loanTermMonths', header: 'Loan Term in Months', type: 'number', format: '1 to 120' },
    { key: 'loanReleaseDate', header: 'Loan Release Date', type: 'date', format: 'Date YYYY-MM-DD' },
    { key: 'mortgage', header: 'Financier', format: 'TFSPH when empty' },
  ],
  travel: [
    { key: 'insurancePolicyType', header: 'Plan / Policy Type', list: 'Travel Plans', format: 'TRV-ST single trip, TRV-ANN annual, TRV-REN renewable' },
    { key: 'destination', header: 'Destination' },
    { key: 'travelStart', header: 'Travel Start', type: 'date', format: 'Date YYYY-MM-DD, inside the policy period' },
    { key: 'travelEnd', header: 'Travel End', type: 'date', format: 'Date YYYY-MM-DD, inside the policy period; single trip: on or after the cutover date' },
    { key: 'travellerCount', header: 'Travellers', type: 'number' },
  ],
  fire: [
    { key: 'riskAddress', header: 'Risk Address' },
    { key: 'occupancy', header: 'Occupancy' },
    { key: 'constructionClass', header: 'Construction Class' },
  ],
  other: [],
};

/** Name of the Lists column of the products of a policy sheet. */
export const productListName = (kind) => `Products ${POLICY_KINDS.find((k) => k.kind === kind)?.name.replace('Policies - ', '') || kind}`;

/** Columns of the sheet of a kind; the Product column offers the products of the sheet. */
export const policyColumns = (kind) => [...COMMON_COLUMNS.map((c) => (c.key === 'product' ? { ...c, list: productListName(kind) } : c)), ...(PRODUCT_COLUMNS[kind] || [])];
/** Product columns of a kind (doc keys). */
export const productColumns = (kind) => PRODUCT_COLUMNS[kind] || [];

export const TRAVEL_PLANS = ['TRV-ST', 'TRV-ANN', 'TRV-REN'];
export const BUSINESS_TYPES = ['New', 'Renewal'];

const SAMPLE = { clientCode: 'C-000123', insurer: 'MALAYAN', inceptionDate: '2026-03-01', expiryDate: '2027-03-01', issueDate: '2026-02-25', billingMode: 'broker', paymentStatus: 'Completed', branch: 'HO', businessType: 'New' };
/** Sample row of each sheet (row 2, never loaded). */
export const POLICY_SAMPLES = {
  motor: { ...SAMPLE, policyNumber: 'PC-MLY-2026-000101', product: 'MOTOR', sumInsured: '1250000', netPremium: '28750', grossPremium: '35946.88', plateNumber: 'NCA 4521',
    chassisNumber: 'MHFXX12G0P0012345', vehicleBrand: 'TOYOTA', vehicleModel: 'Vios', modelVariant: '1.3 XLE CVT', modelYear: '2025', seatingCapacity: '5', mortgage: 'TFSPH', loanReference: 'TFS-LN-0088123' },
  ctpl: { ...SAMPLE, policyNumber: 'CTPL-MLY-2026-004512', product: 'CTPL', sumInsured: '100000', grossPremium: '610.00', plateNumber: 'NCA 4521', certNumber: 'C00451234', authenCode: 'AU7781234', vehicleType: 'Private car' },
  pa: { ...SAMPLE, policyNumber: 'PA-MLY-2026-000310', product: 'PA', sumInsured: '500000', grossPremium: '1250.00', plan: 'Plan A', insuredCount: '1', beneficiary: 'Spouse' },
  'credit-life': { ...SAMPLE, policyNumber: 'CL-2026-000077', product: 'CL-COMP', grossPremium: '8400.00', loanReference: 'TFS-LN-0088123', loanAmount: '980000', loanTermMonths: '60', loanReleaseDate: '2026-02-25' },
  travel: { ...SAMPLE, policyNumber: 'TRV-2026-000940', product: 'TRAVEL', sumInsured: '2500000', grossPremium: '1890.00', insurancePolicyType: 'TRV-ANN', destination: 'Worldwide', originalCurrency: 'USD',
    originalSumInsured: '50000', exchangeRate: '56.20' },
  fire: { ...SAMPLE, policyNumber: 'FI-2026-000210', product: 'FIRE', sumInsured: '5000000', grossPremium: '14000', riskAddress: 'Lot 4, Calamba Premiere Industrial Park, Laguna', occupancy: 'Warehouse' },
  other: { ...SAMPLE, policyNumber: 'PCL-2026-000015', product: 'PARCEL', sumInsured: '50000', grossPremium: '250.00' },
};

// ------------------------------------------------------------------ checks and the doc of a row

const whole = (column, value, label, min, max) => {
  const n = numberCell(value);
  if (n === null) return null;
  if (!Number.isInteger(n) || n < min || n > max) fail(column, `${label} must be a whole number from ${min} to ${max}`);
  return n;
};
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/**
 * Checks of the product columns of a row (kind: the sheet's kind, product: { code, ... }); ctx.warn for the warnings.
 * Returns the values the importer stores in the policy doc (product columns and references).
 */
export function productDoc(ctx, kind, v, product) {
  const doc = {};
  for (const c of productColumns(kind)) if (v[c.key] !== undefined && v[c.key] !== '') doc[c.key] = v[c.key];
  if (kind === 'motor' || kind === 'ctpl') {
    if (!v.plateNumber && !v.conductionSticker && !v.chassisNumber) fail('plateNumber', 'Enter the Plate Number, the Conduction Sticker or the Chassis Number');
  }
  if (kind === 'motor') {
    if (v.modelYear) {
      const last = Number(String(ctx.cutover || '').slice(0, 4) || new Date().getUTCFullYear()) + 1;
      if (!/^\d{4}$/.test(String(v.modelYear)) || Number(v.modelYear) > last) fail('modelYear', `Model Year must be a year of four digits, not after ${last}`);
    }
    const seats = whole('seatingCapacity', v.seatingCapacity, 'Seating Capacity', 1, 60);
    if (seats !== null) doc.seatingCapacity = seats;
  }
  if (kind === 'ctpl') {
    if (v.expiryDate > addMonths(v.inceptionDate, 13)) fail('expiryDate', 'A CTPL term is at most 13 months');
  }
  if (kind === 'pa') {
    const group = /^GPA$/i.test(product.code) || /group/i.test(product.name || '');
    const persons = whole('insuredCount', v.insuredCount, 'Insured Persons', 1, 100000);
    if (group && (persons === null || persons < 2)) fail('insuredCount', 'Group Personal Accident: Insured Persons must be at least 2');
    if (!group && persons !== null && persons !== 1) fail('insuredCount', 'Personal Accident covers one insured person');
    doc.insuredCount = persons ?? 1;
  }
  if (kind === 'credit-life') {
    const loan = pesoValue('loanAmount', v.loanAmount, 'Loan Amount', { positive: true });
    doc.loanAmount = loan;
    const term = whole('loanTermMonths', v.loanTermMonths, 'Loan Term in Months', 1, 120);
    if (term !== null) doc.loanTermMonths = term;
    const release = dateValue('loanReleaseDate', v.loanReleaseDate, 'Loan Release Date');
    if (release && term !== null && Math.abs(days(addMonths(release, term), v.expiryDate)) > 31) {
      ctx.warn(`Policy ${v.policyNumber}: expiry ${v.expiryDate} differs from the loan release date plus the loan term (${addMonths(release, term)}) by more than 31 days`);
    }
    doc.mortgage = v.mortgage || 'TFSPH';
    if (v.borrowerName) doc.borrowerName = v.borrowerName;
  }
  if (kind === 'travel') {
    const plan = v.insurancePolicyType ? TRAVEL_PLANS.find((p) => p.toLowerCase() === String(v.insurancePolicyType).toLowerCase()) : null;
    if (v.insurancePolicyType && !plan) fail('insurancePolicyType', `Plan / Policy Type must be one of ${TRAVEL_PLANS.join(', ')}`);
    if (plan) doc.insurancePolicyType = plan;
    const start = dateValue('travelStart', v.travelStart, 'Travel Start');
    const end = dateValue('travelEnd', v.travelEnd, 'Travel End');
    for (const [col, d, label] of [['travelStart', start, 'Travel Start'], ['travelEnd', end, 'Travel End']]) {
      if (d && (d < v.inceptionDate || d > v.expiryDate)) fail(col, `${label} ${d} is outside the policy period ${v.inceptionDate} to ${v.expiryDate}`);
    }
    if (start && end && end < start) fail('travelEnd', 'Travel End cannot be before the Travel Start');
    if (plan === 'TRV-ST' && end && ctx.cutover && end < ctx.cutover) fail('travelEnd', `Travel End ${end} is before the cutover date ${ctx.cutover}: the single trip is over (not in force)`);
    const travellers = whole('travellerCount', v.travellerCount, 'Travellers', 1, 10000);
    if (travellers !== null) doc.travellerCount = travellers;
  }
  return doc;
}

/** Original currency references of a row (doc): the policy itself stays in pesos. */
export async function currencyDoc(v, base) {
  const doc = {};
  if (v.originalCurrency) {
    const code = String(v.originalCurrency).trim().toUpperCase();
    const known = await one('SELECT code FROM currencies WHERE upper(code) = $1', [code]);
    if (!known) fail('originalCurrency', `Currency ${code} is not in the Currency master`);
    if (code !== base) doc.originalCurrency = code;
  }
  const si = amountValue('originalSumInsured', v.originalSumInsured, 'Original Sum Insured');
  const rate = amountValue('exchangeRate', v.exchangeRate, 'Exchange Rate', { positive: true });
  if ((si !== null || rate !== null) && !doc.originalCurrency) fail('originalCurrency', 'Give the Original Currency of the original sum insured and the exchange rate');
  if (si !== null) {
    pesoValue('originalSumInsured', v.originalSumInsured, 'Original Sum Insured');
    doc.originalSumInsured = si;
  }
  if (rate !== null) doc.exchangeRate = rate;
  return doc;
}
