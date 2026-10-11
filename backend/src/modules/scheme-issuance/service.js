/**
 * Scheme Issuance (TIS-BRD-SCHM-01, FRS FR-SIS-001 to 005, 012, 014): the scheme applications of TFS loan documents.
 *
 * An application is created on screen or from a loan bookings upload (upload.js), checked against the scheme of the
 * Scheme Master (active on the vehicle release date, dealer, make and model range, brand-new vehicle, unused chassis),
 * priced from the scheme without a quotation (rating of the schemes module: year 1 and the premium schedule of the loan
 * term) and given its document checklist (checklist.js). A mandatory field missing or a scheme check failing keeps the
 * application in Draft with the reasons; a value that can never be right (loan account format or reuse, loan term,
 * backdated or future release, financing bank, ARA date, ID type) refuses the save. The checklist gate decides
 * Documents pending or Ready to issue. Sending, the insurer's answer, the policy and the cancellation are issue.js.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { revealPii } from '../../lib/pii.js';
import { findSchemeAndLine, priceYear } from '../schemes/rating.js';
import { TYPE_LABELS, PAID_BY_LABELS, vehicleLabel } from '../schemes/service.js';
import { BANK_TYPES, DEALER_TYPES } from '../channels/service.js';
import { buildChecklist, gateOf } from './checklist.js';

export const STATUS_LABELS = { draft: 'Draft', 'documents-pending': 'Documents pending', ready: 'Ready to issue', sent: 'Sent to insurer', declined: 'Declined by insurer',
  issued: 'Policy issued', cancelled: 'Cancelled' };
export const KYC_SOURCES = { tfs: 'TFSPH KYC confirmation', full: 'Full KYC' };
export const OPEN = ['draft', 'documents-pending', 'ready', 'declined'];
const LOAN = /^\d{10}$/;
const err = (path, message, code = null) => ({ path, message, ...(code ? { code } : {}) });
const refuse = (errors) => badRequest(errors[0].message, errors);
const dmy = (d) => String(d).slice(0, 10).split('-').reverse().join('/');
const peso = (v) => Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The ARA payment modes (schemes.ara_payment_modes) and the fixed mode of Scheme 2. */
export async function paymentModes() {
  const list = (await getSetting('schemes.ara_payment_modes', [])) || [];
  return (Array.isArray(list) ? list : []).map((m) => (typeof m === 'string' ? { code: m, label: m } : m));
}
export const MA_MODE = { code: 'MA', label: 'Included in the monthly amortisation' };

/** Accepted IDs of a scheme borrower: the TFSPH primary and secondary lists (schemes.kyc_primary_ids, schemes.kyc_secondary_ids). */
export async function acceptedIds() {
  const primary = ((await getSetting('schemes.kyc_primary_ids', [])) || []).map(String);
  const secondary = ((await getSetting('schemes.kyc_secondary_ids', [])) || []).map(String);
  return { primary, secondary, all: [...primary, ...secondary] };
}
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// ---------------------------------------------------------------- read

const SELECT = `SELECT a.*, s.version AS scheme_version, s.status AS scheme_status, s.term_years AS scheme_term, s.year1_paid_by, b.name AS bank_name, b.code AS bank_code,
  d.name AS dealer_name, ic.name AS insurer_name, c.display_name AS client_name, pl.placement_number, pl.status AS placement_status, pol.policy_number,
  bt.batch_number, cu.display_name AS created_by_name, su.display_name AS sent_by_name, xu.display_name AS cancelled_by_name,
  (SELECT count(*)::int FROM scheme_checklist_items i WHERE i.application_id = a.id AND i.required) AS required_items,
  (SELECT count(*)::int FROM scheme_checklist_items i WHERE i.application_id = a.id AND i.required AND i.status IN ('received', 'waived')) AS required_in
  FROM scheme_applications a LEFT JOIN schemes s ON s.id = a.scheme_id LEFT JOIN distribution_channels b ON b.id = a.bank_channel_id
  LEFT JOIN distribution_channels d ON d.id = a.dealer_channel_id LEFT JOIN insurance_companies ic ON ic.id = a.insurance_company_id
  LEFT JOIN clients c ON c.id = a.client_id LEFT JOIN placements pl ON pl.id = a.placement_id LEFT JOIN policies pol ON pol.id = a.policy_id
  LEFT JOIN scheme_booking_batches bt ON bt.id = a.batch_id LEFT JOIN users cu ON cu.id = a.created_by LEFT JOIN users su ON su.id = a.sent_by
  LEFT JOIN users xu ON xu.id = a.cancelled_by`;

export const borrowerName = (b, clientName = null) => clientName || [b?.firstName, b?.lastName].filter(Boolean).join(' ') || b?.companyName || null;

export function toApplication(r) {
  const b = r.borrower || {};
  const v = r.vehicle || {};
  return {
    id: r.id, applicationNumber: r.application_number, status: r.status, statusLabel: STATUS_LABELS[r.status], schemeId: r.scheme_id, schemeNo: r.scheme_no,
    schemeVersion: r.scheme_version ?? null, schemeType: r.scheme_type, schemeTypeLabel: TYPE_LABELS[r.scheme_type] || null, loanAccount: r.loan_account,
    bankChannelId: r.bank_channel_id, bankName: r.bank_name || null, bookingDate: isoDate(r.booking_date), loanTermMonths: r.loan_term_months, releaseDate: isoDate(r.release_date),
    clientId: r.client_id, borrowerName: borrowerName(b, r.client_name), borrower: { ...b, idNumber: b.idNumber ? revealPii(b.idNumber) : b.idNumber, idNumber2: b.idNumber2 ? revealPii(b.idNumber2) : b.idNumber2 },
    kycSource: r.kyc_source, kycSourceLabel: KYC_SOURCES[r.kyc_source], dealerChannelId: r.dealer_channel_id, dealerName: r.dealer_name || null,
    vehicle: v, vehicleLabel: [v.yearModel, v.make, v.model, v.variant].filter(Boolean).join(' '), chassisNumber: r.chassis_number, invoicePrice: r.invoice_price === null ? null : Number(r.invoice_price),
    insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name || null, araSignedOn: isoDate(r.ara_signed_on), araPaymentMode: r.ara_payment_mode,
    lineNo: r.line_no, pricing: r.pricing || null, grossPremium: r.gross_premium === null ? null : Number(r.gross_premium), problems: r.problems || [],
    checklist: { required: r.required_items ?? 0, in: r.required_in ?? 0, missing: Math.max(0, (r.required_items ?? 0) - (r.required_in ?? 0)) },
    placementId: r.placement_id, placementNumber: r.placement_number || null, placementStatus: r.placement_status || null, policyId: r.policy_id, policyNumber: r.policy_number || null,
    batchId: r.batch_id, batchNumber: r.batch_number || null, rowNo: r.row_no, declineReason: r.decline_reason, cancelReason: r.cancel_reason, cancelReasonCode: r.cancel_reason_code,
    cancelledBy: r.cancelled_by_name || r.cancelled_by, cancelledAt: r.cancelled_at, sentBy: r.sent_by_name || r.sent_by, sentAt: r.sent_at, issuedAt: r.issued_at,
    createdBy: r.created_by_name || r.created_by, createdById: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function applicationRow(id, db = null) {
  const sql = `${SELECT} WHERE a.id = $1 OR a.application_number = $1`;
  const r = db ? (await db.query(sql, [String(id)])).rows[0] : await one(sql, [String(id)]);
  if (!r) throw notFound('Scheme application not found');
  return r;
}

export async function getApplication(id) {
  const r = await applicationRow(id);
  const { listItems } = await import('./checklist.js');
  const items = await listItems(r.id);
  return { ...toApplication(r), items, gate: gateOf(items) };
}

/** Applications of the list (status, search on number, borrower, loan account or chassis, schemeType, batchId), newest first. */
export async function listApplications(q = {}) {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status && q.status !== 'all') add('a.status = ANY(?)', String(q.status).split(','));
  if (q.schemeType) add('a.scheme_type = ?', q.schemeType);
  if (q.batchId) add('a.batch_id = ?', q.batchId);
  if (q.search) add(`(a.application_number ILIKE ? OR a.loan_account ILIKE ? OR a.chassis_number ILIKE ? OR c.display_name ILIKE ?
    OR concat_ws(' ', a.borrower->>'firstName', a.borrower->>'lastName', a.borrower->>'companyName') ILIKE ?)`, `%${String(q.search).trim()}%`);
  const rows = await many(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.created_at DESC LIMIT 2000`, params);
  return rows.map(toApplication);
}

export async function statusCounts() {
  const rows = await many('SELECT status, count(*)::int AS n FROM scheme_applications GROUP BY status');
  return { all: rows.reduce((s, r) => s + r.n, 0), ...Object.fromEntries(rows.map((r) => [r.status, r.n])) };
}

// ---------------------------------------------------------------- checks

/** The financing bank channel of a scheme application: a channel (or its parent) whose code is in schemes.financing_banks. */
async function bankChannel(db, idOrCode) {
  if (!idOrCode) return null;
  return (await db.query(`SELECT c.*, p.code AS parent_code FROM distribution_channels c LEFT JOIN distribution_channels p ON p.id = c.parent_id
    WHERE c.id = $1 OR lower(c.code) = lower($1)`, [String(idOrCode)])).rows[0] || null;
}
async function defaultBank(db) {
  const codes = (await getSetting('schemes.financing_banks', ['TFS', 'TFSPH'])) || [];
  return (await db.query("SELECT * FROM distribution_channels WHERE upper(code) = ANY($1::text[]) AND status = 'active' AND channel_type = 'financing_bank' ORDER BY code LIMIT 1",
    [codes.map((c) => String(c).toUpperCase())])).rows[0] || null;
}
const inList = (list, ...codes) => (list || []).map((c) => String(c).toUpperCase()).some((c) => codes.filter(Boolean).map((x) => String(x).toUpperCase()).includes(c));

/** Age in whole years on a date. */
export function ageOn(birthday, on) {
  if (!birthday || !on) return null;
  const [by, bm, bd] = String(birthday).slice(0, 10).split('-').map(Number);
  const [y, m, d] = String(on).slice(0, 10).split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Policy years of a loan (FR-SIS-001 R3): loan term in months / 12 rounded up, at most the scheme's term. */
export const policyYears = (months, term) => Math.max(1, Math.min(Math.ceil(Number(months || 12) / 12), Number(term || 1)));

/**
 * Normalise and check an application body (FR-SIS-001, 003, 005, 012). Returns { cols, problems, scheme, line, vehicle }:
 * refused (400) for a value that can never be right; problems for what keeps the application in Draft.
 */
async function assess(db, b, existing = null, { id = null } = {}) {
  const e = existing || {};
  const val = (k, col) => (b[k] === undefined ? e[col] ?? null : b[k] === '' ? null : b[k]);
  const refusals = [];
  const problems = [];
  const now = await today();
  // scheme (by number or id), loan and financing bank
  const schemeRef = b.schemeId ?? b.schemeNo ?? e.scheme_no ?? null;
  const schemeRow = schemeRef ? (await db.query('SELECT * FROM schemes WHERE id = $1 OR upper(scheme_no) = upper($1) ORDER BY version DESC LIMIT 1', [String(schemeRef)])).rows[0] : null;
  if (!schemeRef) problems.push(err('schemeId', 'Scheme is required', 'MSG-SIS-001'));
  else if (!schemeRow) refusals.push(err('schemeId', `Scheme ${schemeRef} is not on the Scheme Master`));
  const loan = val('loanAccount', 'loan_account') === null ? null : String(val('loanAccount', 'loan_account')).trim();
  if (!loan) problems.push(err('loanAccount', 'The TFS loan account must have 10 digits', 'MSG-SIS-002'));
  else if (!LOAN.test(loan)) refusals.push(err('loanAccount', 'The TFS loan account must have 10 digits', 'MSG-SIS-002'));
  else {
    const dup = (await db.query("SELECT application_number FROM scheme_applications WHERE loan_account = $1 AND status <> 'cancelled' AND ($2::text IS NULL OR id <> $2)", [loan, id])).rows[0];
    if (dup) refusals.push(err('loanAccount', `Loan account ${loan} is already on application ${dup.application_number}`, 'MSG-SIS-003'));
  }
  let bank = await bankChannel(db, val('bankChannelId', 'bank_channel_id'));
  if (!bank && !b.bankChannelId && !e.bank_channel_id) bank = await defaultBank(db);
  const allowedBanks = (await getSetting('schemes.financing_banks', ['TFS', 'TFSPH'])) || [];
  if (!bank && b.bankChannelId) refusals.push(err('bankChannelId', 'The financing bank must be TFSPH or one of its branches', 'MSG-SIS-007'));
  else if (!bank) problems.push(err('bankChannelId', 'The financing bank must be TFSPH or one of its branches', 'MSG-SIS-007'));
  else if (bank.status !== 'active' || !BANK_TYPES.includes(bank.channel_type) || !inList(allowedBanks, bank.code, bank.parent_code)) {
    refusals.push(err('bankChannelId', 'The financing bank must be TFSPH or one of its branches', 'MSG-SIS-007'));
  }
  const booking = isoDate(val('bookingDate', 'booking_date'));
  if (!booking) problems.push(err('bookingDate', 'Loan booking date is required'));
  else if (booking > now) refusals.push(err('bookingDate', 'The loan booking date cannot be in the future'));
  const terms = (await getSetting('schemes.loan_term_months', { min: 12, max: 84 })) || { min: 12, max: 84 };
  const term = val('loanTermMonths', 'loan_term_months') === null ? null : Number(val('loanTermMonths', 'loan_term_months'));
  if (term === null) problems.push(err('loanTermMonths', `Loan term must be between ${terms.min} and ${terms.max} months`, 'MSG-SIS-004'));
  else if (!Number.isInteger(term) || term < Number(terms.min) || term > Number(terms.max)) refusals.push(err('loanTermMonths', `Loan term must be between ${terms.min} and ${terms.max} months`, 'MSG-SIS-004'));
  const release = isoDate(val('releaseDate', 'release_date'));
  const backdating = Number(await getSetting('schemes.max_backdating_days', 30));
  if (!release) problems.push(err('releaseDate', 'Vehicle release date is required'));
  else if (release > now) refusals.push(err('releaseDate', 'The vehicle release date cannot be in the future', 'MSG-SIS-006'));
  else if (release < addDays(now, -backdating) && release !== isoDate(e.release_date)) refusals.push(err('releaseDate', `The vehicle release date cannot be more than ${backdating} days before today`, 'MSG-SIS-005'));
  // borrower and KYC
  const clientId = val('clientId', 'client_id');
  const client = clientId ? (await db.query('SELECT id, display_name, first_name, last_name, company_name, birth_date, nationality, email, phone FROM clients WHERE id = $1 OR client_code = $1', [String(clientId)])).rows[0] : null;
  if (clientId && !client) refusals.push(err('clientId', 'Client not found'));
  const given = b.borrower || {};
  const borrower = { ...(e.borrower || {}) };
  for (const k of ['firstName', 'lastName', 'companyName', 'birthday', 'nationality', 'mobile', 'email', 'address', 'city', 'province', 'idType', 'idNumber', 'idType2', 'idNumber2']) {
    const v = given[k] !== undefined ? given[k] : b[k];
    if (v !== undefined) borrower[k] = v === '' ? null : typeof v === 'string' ? v.trim() : v;
  }
  if (client) {
    borrower.firstName = client.first_name; borrower.lastName = client.last_name; borrower.companyName = client.company_name;
    borrower.birthday = borrower.birthday || isoDate(client.birth_date); borrower.nationality = borrower.nationality || client.nationality;
    borrower.email = borrower.email || client.email; borrower.mobile = borrower.mobile || client.phone;
  }
  borrower.birthday = isoDate(borrower.birthday) || null;
  if (!borrower.firstName && !borrower.companyName) problems.push(err('borrower.firstName', 'Borrower name is required'));
  if (!borrower.birthday && !borrower.companyName) problems.push(err('borrower.birthday', 'Birthday is required', 'MSG-SIS-034'));
  const kycBanks = (await getSetting('schemes.kyc_confirmation_banks', ['TFS', 'TFSPH'])) || [];
  const kycSource = val('kycSource', 'kyc_source') || (bank && inList(kycBanks, bank.code, bank.parent_code) ? 'tfs' : 'full');
  if (!KYC_SOURCES[kycSource]) refusals.push(err('kycSource', 'KYC source is TFSPH KYC confirmation or Full KYC'));
  const ids = await acceptedIds();
  if (!borrower.idType) problems.push(err('idType', 'ID type is required', 'MSG-SIS-031'));
  for (const k of ['idType', 'idType2']) {
    if (borrower[k] && ids.all.length && !ids.all.some((t) => sameText(t, borrower[k]))) refusals.push(err(k, `ID type "${borrower[k]}" is not an accepted ID`, 'MSG-SIS-032'));
  }
  if (borrower.idType && !borrower.idNumber) problems.push(err('idNumber', 'ID number is required'));
  // dealer, vehicle and insurer
  const dealerId = val('dealerChannelId', 'dealer_channel_id');
  const dealer = dealerId ? (await db.query('SELECT * FROM distribution_channels WHERE id = $1 OR lower(code) = lower($1)', [String(dealerId)])).rows[0] : null;
  if (!dealerId) problems.push(err('dealerChannelId', 'Dealer is required'));
  else if (!dealer || dealer.status !== 'active' || !DEALER_TYPES.includes(dealer.channel_type)) refusals.push(err('dealerChannelId', 'The dealer must be an active dealer group or dealer branch of Distribution Channels'));
  const vehicle = { ...(e.vehicle || {}) };
  for (const k of ['make', 'model', 'variant', 'yearModel', 'color', 'chassisNumber', 'engineNumber', 'conductionSticker', 'plateNumber']) {
    const v = (b.vehicle || {})[k] !== undefined ? b.vehicle[k] : b[k];
    if (v !== undefined) vehicle[k] = v === '' ? null : typeof v === 'string' ? v.trim() : v;
  }
  if (vehicle.yearModel) vehicle.yearModel = Number(vehicle.yearModel);
  for (const [k, label] of [['make', 'Make'], ['model', 'Model'], ['yearModel', 'Year model'], ['chassisNumber', 'Chassis number'], ['engineNumber', 'Engine number']]) {
    if (!vehicle[k]) problems.push(err(k, `${label} is required`));
  }
  const price = val('invoicePrice', 'invoice_price') === null ? null : num(String(val('invoicePrice', 'invoice_price')).replace(/,/g, ''));
  if (price === null) problems.push(err('invoicePrice', 'Invoice price is required'));
  else if (!(price > 0)) refusals.push(err('invoicePrice', 'The invoice price must be more than 0'));
  let insurerId = val('insuranceCompanyId', 'insurance_company_id') ? Number(val('insuranceCompanyId', 'insurance_company_id')) : null;
  if (!insurerId && schemeRow && (schemeRow.insurer_ids || []).length === 1) insurerId = Number(schemeRow.insurer_ids[0]);
  if (!insurerId) problems.push(err('insuranceCompanyId', 'Insurer is required'));
  // Auto Renewal Agreement (FR-SIS-005)
  const type = schemeRow?.scheme_type || e.scheme_type || null;
  let araOn = isoDate(val('araSignedOn', 'ara_signed_on'));
  let araMode = val('araPaymentMode', 'ara_payment_mode');
  if (type === 'scheme2') { araOn = null; araMode = MA_MODE.code; }
  if (type === 'scheme1') {
    if (!araOn) problems.push(err('araSignedOn', 'ARA signed on is required for Scheme 1', 'MSG-SIS-021'));
    else if (booking && release && (araOn > release || araOn < addDays(booking, -30))) {
      refusals.push(err('araSignedOn', `ARA signed on must be between ${dmy(addDays(booking, -30))} and the vehicle release date`, 'MSG-SIS-022'));
    }
    const modes = await paymentModes();
    if (!araMode) problems.push(err('araPaymentMode', 'ARA payment mode is required for Scheme 1', 'MSG-SIS-023'));
    else if (!modes.some((m) => m.code === araMode)) refusals.push(err('araPaymentMode', `ARA payment mode must be one of ${modes.map((m) => m.label).join(', ')}`));
  }
  if (refusals.length) throw refuse(refusals);
  return {
    cols: { scheme_id: schemeRow?.id || null, scheme_no: schemeRow?.scheme_no || (schemeRef ? String(schemeRef).toUpperCase() : null), scheme_type: type, loan_account: loan,
      bank_channel_id: bank?.id || null, booking_date: booking, loan_term_months: term, release_date: release, client_id: client?.id || null, borrower: JSON.stringify(borrower),
      kyc_source: kycSource, dealer_channel_id: dealer?.id || null, vehicle: JSON.stringify(vehicle), chassis_number: vehicle.chassisNumber || null, invoice_price: price,
      insurance_company_id: insurerId, ara_signed_on: araOn, ara_payment_mode: araMode },
    problems, schemeRow, borrower, vehicle, dealer, bank, kycSource, insurerId, price, term, release, booking, type, araMode,
  };
}

/** Inception of the year-1 policy (schemes.inception_basis). */
export async function inceptionOf(a) {
  return (await getSetting('schemes.inception_basis', 'release_date')) === 'booking_date' ? (a.booking || a.booking_date) : (a.release || a.release_date);
}

/**
 * The scheme checks (FR-SIS-003) and the pricing (FR-SIS-004) of an assessed application: problems added for each failed
 * check; the pricing with year 1, the premium schedule of the policy years, the commission and who pays year 1.
 */
async function checkAndPrice(db, x, id) {
  const problems = [];
  const s = x.schemeRow;
  if (!s || x.problems.some((p) => ['schemeId', 'dealerChannelId', 'make', 'model', 'yearModel', 'invoicePrice', 'insuranceCompanyId', 'releaseDate', 'bookingDate'].includes(p.path))) {
    return { problems, pricing: null };
  }
  const on = await inceptionOf(x);
  // brand-new vehicle (PROD-15 rule): Model Year not older than the policy year minus the tolerance
  const tolerance = Number(await getSetting('promotions.new_vehicle_year_tolerance', 1));
  if (x.vehicle.yearModel && Number(x.vehicle.yearModel) < Number(String(on).slice(0, 4)) - tolerance) {
    problems.push(err('yearModel', `Scheme business is for brand-new vehicles only: Model Year ${x.vehicle.yearModel} is too old`, 'MSG-SIS-017'));
  }
  // chassis on a policy or another open application
  if (x.vehicle.chassisNumber) {
    const pol = (await db.query(`SELECT policy_number FROM policies WHERE status NOT IN ('cancelled') AND (upper(doc->>'chassisNumber') = upper($1)
      OR upper(doc->'insuranceVehicleDetails'->0->>'chassisNumber') = upper($1)) LIMIT 1`, [x.vehicle.chassisNumber])).rows[0];
    const app = (await db.query("SELECT application_number FROM scheme_applications WHERE upper(chassis_number) = upper($1) AND status <> 'cancelled' AND ($2::text IS NULL OR id <> $2) LIMIT 1",
      [x.vehicle.chassisNumber, id])).rows[0];
    if (pol || app) problems.push(err('chassisNumber', `Chassis number ${x.vehicle.chassisNumber} is already on ${pol?.policy_number || app.application_number}`, 'MSG-SIS-018'));
  }
  // the scheme in force on the release date, its dealers, insurers and vehicle lines
  let found = null;
  try {
    found = await findSchemeAndLine({ schemeNo: s.scheme_no, dealerChannelId: x.dealer?.id, insurerId: x.insurerId,
      vehicle: { make: x.vehicle.make, model: x.vehicle.model, variant: x.vehicle.variant, yearModel: x.vehicle.yearModel }, sumInsured: x.price, inception: on }, db);
  } catch (e) {
    const code = e.details?.[0]?.code;
    const map = {
      'MSG-SCM-054': err('schemeId', `Scheme ${s.scheme_no} is not active on ${dmy(on)}`, 'MSG-SIS-014'),
      'MSG-SCM-055': err('dealerChannelId', `Dealer ${x.dealer?.name || ''} is not part of scheme ${s.scheme_no}`, 'MSG-SIS-015'),
      'MSG-SCM-056': err('insuranceCompanyId', e.message, 'MSG-SCM-056'),
      'MSG-SCM-057': err('model', `${x.vehicle.make} ${x.vehicle.model} is outside the make and model range of scheme ${s.scheme_no}`, 'MSG-SIS-016'),
      'MSG-SCM-058': err('invoicePrice', e.message, 'MSG-SCM-058'),
    };
    problems.push(map[code] || err('schemeId', e.message));
  }
  if (!found || problems.length) return { problems, pricing: null };
  const { scheme, line, vehicle } = found;
  const years = policyYears(x.term, scheme.term_years);
  const laterCtpl = (await getSetting('schemes.application_schedule_ctpl', false)) === true;
  const schedule = [];
  try {
    for (let y = 1; y <= years; y += 1) {
      const p = await priceYear(scheme, line, { year: y, year1SumInsured: x.price, vehicleClass: line.vehicle_class, seats: vehicle.seats, insurerId: x.insurerId,
        lguCity: x.borrower.city || null, laterCtpl });
      delete p.breakdown;
      schedule.push(p);
    }
  } catch (e) {
    problems.push(err('schemeId', `Scheme ${scheme.scheme_no} has no rate for ${String(e.message).replace(/^.* has no rate for /, '').replace(/; the scheme must be amended$/, '')}`, 'MSG-SIS-019'));
    return { problems, pricing: null };
  }
  const payerKind = scheme.scheme_type === 'scheme2' ? 'bank' : scheme.year1_paid_by === 'client-ada' ? 'client' : 'dealer';
  const who = (y) => (scheme.scheme_type === 'scheme2' ? PAID_BY_LABELS['client-ma'] : y === 1 ? PAID_BY_LABELS[scheme.year1_paid_by || 'dealer'] : `Client, ARA (${x.araMode || '-'})`);
  const y1 = schedule[0];
  return {
    problems,
    pricing: {
      schemeId: scheme.id, schemeNo: scheme.scheme_no, version: scheme.version, schemeType: scheme.scheme_type, lineNo: line.line_no, line: vehicleLabel(line), vehicleClass: line.vehicle_class,
      seats: vehicle.seats, inception: on, policyYears: years, lockInYears: years, araYears: scheme.scheme_type === 'scheme1' ? Math.max(0, years - 1) : 0,
      year1: y1, payer: payerKind, payerLabel: who(1),
      schedule: schedule.map((p) => ({ year: p.year, sumInsuredPct: p.sumInsuredPct, sumInsured: p.sumInsured, netPremium: p.netPremium, vat: p.vat, dst: p.dst, lgt: p.lgt,
        ctpl: p.ctpl, ctplNote: p.ctplNote, grossPremium: p.grossPremium, commission: p.commission, dealerShare: p.dealerShare, whoPays: who(p.year) })),
      pricedAt: new Date().toISOString(),
    },
  };
}

/** Status of an application from its problems and its checklist gate (FR-SIS-014). */
async function settle(db, id, problems) {
  if (problems.length) {
    await db.query("UPDATE scheme_applications SET status = 'draft' WHERE id = $1 AND status IN ('draft', 'documents-pending', 'ready')", [id]);
    return 'draft';
  }
  const items = (await db.query('SELECT required, status FROM scheme_checklist_items WHERE application_id = $1', [id])).rows;
  const gate = gateOf(items);
  const status = gate.missing ? 'documents-pending' : 'ready';
  await db.query("UPDATE scheme_applications SET status = $2 WHERE id = $1 AND status IN ('draft', 'documents-pending', 'ready', 'declined')", [id, status]);
  return status;
}
export { settle };

/**
 * Save an application (create or edit, FR-SIS-001): checked, priced, its checklist built or rebuilt (FR-SIS-011), and
 * set to Draft (problems) or Documents pending / Ready to issue (gate). options.strict (upload rows): any problem
 * refuses the row instead of saving a Draft.
 */
export async function saveApplication(id, b, user, { db: outer = null, strict = false, batchId = null, rowNo = null } = {}) {
  const run = async (db) => {
    const existing = id ? (await db.query('SELECT * FROM scheme_applications WHERE id = $1 OR application_number = $1 FOR UPDATE', [String(id)])).rows[0] : null;
    if (id && !existing) throw notFound('Scheme application not found');
    if (existing && !OPEN.includes(existing.status)) {
      throw conflict(existing.status === 'issued' ? `Application ${existing.application_number} has policy issued: a correction is an endorsement`
        : existing.status === 'sent' ? `Application ${existing.application_number} was sent to the insurer: its data and checklist are read-only; cancel the placement slip to correct it`
          : `Application ${existing.application_number} is cancelled`);
    }
    const x = await assess(db, b, existing, { id: existing?.id || null });
    const priced = await checkAndPrice(db, x, existing?.id || null);
    const problems = [...x.problems, ...priced.problems];
    if (strict && problems.length) throw refuse(problems);
    const cols = { ...x.cols, line_no: priced.pricing?.lineNo ?? null, pricing: priced.pricing ? JSON.stringify(priced.pricing) : null,
      gross_premium: priced.pricing?.year1?.grossPremium ?? null, problems: JSON.stringify(problems) };
    let appId = existing?.id;
    if (existing) {
      const keys = Object.keys(cols);
      await db.query(`UPDATE scheme_applications SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
        [existing.id, ...Object.values(cols), user.id]);
    } else {
      const number = await nextDocumentNumber('scheme_application', { db, unique: { table: 'scheme_applications', column: 'application_number' } });
      const data = { ...cols, application_number: number, status: 'draft', batch_id: batchId, row_no: rowNo, created_by: user.id, updated_by: user.id };
      const keys = Object.keys(data);
      appId = (await db.query(`INSERT INTO scheme_applications(${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, Object.values(data))).rows[0].id;
    }
    await buildChecklist(db, appId, { type: x.type, kycSource: x.kycSource, borrower: x.borrower, araMode: x.araMode, release: x.release });
    const status = await settle(db, appId, problems);
    return { id: appId, status, problems, pricing: priced.pricing };
  };
  const out = outer ? await run(outer) : await withTransaction(run);
  return out;
}

/** The confirmation of a save (MSG-SIS-008, MSG-SIS-020). */
export async function saveMessage(app) {
  const parts = [`Application ${app.applicationNumber} saved`];
  if (app.pricing?.year1) parts.push(`Premium computed from scheme ${app.schemeNo}: year 1 gross premium ${peso(app.pricing.year1.grossPremium)}`);
  if (app.status === 'draft' && app.problems.length) parts.push(`Draft: ${app.problems.map((p) => p.message).join('; ')}`);
  return parts.join('. ');
}

/** Choices of the application form: active schemes, financing banks, payment modes, KYC sources, accepted IDs, cancel reasons. */
export async function applicationChoices() {
  const now = await today();
  const schemes = await many(`SELECT id, scheme_no, version, scheme_type, description, insurer_ids, all_dealers, dealer_channel_ids, effective_from, effective_to FROM schemes
    WHERE status = 'active' OR (status = 'scheduled' AND effective_from <= $1::date) ORDER BY scheme_no`, [now]);
  const codes = ((await getSetting('schemes.financing_banks', ['TFS', 'TFSPH'])) || []).map((c) => String(c).toUpperCase());
  const banks = await many(`SELECT c.id, c.code, c.name, c.channel_type FROM distribution_channels c LEFT JOIN distribution_channels p ON p.id = c.parent_id
    WHERE c.status = 'active' AND c.channel_type = ANY($2) AND (upper(c.code) = ANY($1::text[]) OR upper(p.code) = ANY($1::text[])) ORDER BY c.name`, [codes, BANK_TYPES]);
  const ids = await acceptedIds();
  return {
    schemes: schemes.map((s) => ({ value: s.id, schemeNo: s.scheme_no, label: `${s.scheme_no} · ${s.description}`, version: s.version, schemeType: s.scheme_type, schemeTypeLabel: TYPE_LABELS[s.scheme_type],
      insurerIds: (s.insurer_ids || []).map(Number), allDealers: s.all_dealers, dealerChannelIds: s.dealer_channel_ids, effectiveFrom: isoDate(s.effective_from), effectiveTo: isoDate(s.effective_to) })),
    banks: banks.map((c) => ({ value: c.id, label: c.name, code: c.code })), paymentModes: await paymentModes(), maMode: MA_MODE,
    kycSources: Object.entries(KYC_SOURCES).map(([value, label]) => ({ value, label })), primaryIds: ids.primary, secondaryIds: ids.secondary,
    loanTerm: (await getSetting('schemes.loan_term_months', { min: 12, max: 84 })) || { min: 12, max: 84 },
    maxBackdatingDays: Number(await getSetting('schemes.max_backdating_days', 30)), maxDocumentMb: Number(await getSetting('schemes.max_document_mb', 10)),
  };
}

export { round2 };
