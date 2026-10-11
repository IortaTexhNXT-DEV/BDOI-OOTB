/**
 * Open covers (Operations > Marine Open Covers): Parcel / Courier for TISPH (TIS-BRD-PJRN-09, FRS PJRN-09); marine cargo
 * is a future-release feature (modules/features, marine-cargo).
 *
 * Contract: a client's open cover with an insurer for a period, of one of two types (FR-PCL-001):
 *   cargo   a rate and a limit per conveyance (any one sending), the mark-up on invoice value and a minimum premium per
 *           certificate; premium = insured value x rate, at least the minimum
 *   parcel  flat covers on each certificate (Marine parcel, Personal Accident) with premiums inclusive of taxes, and the
 *           charge per certificate billed to the client (the difference is the broker's service fee) (FR-PCL-002, 003)
 * Every cover has a remittance basis (net / gross), a daily declaration (daily.js) and the declaration file settings
 * (files.js). Activating the contract issues its open policy without a bill (policies/service.js#issuePolicy,
 * billLater). An active cover is changed by an endorsement of the open policy approved by a second user
 * (endorsements.js; marine.endorse_active_covers).
 *
 * Certificates: cargo, one per shipment, within the period and the limit of its conveyance; shipments sent without a
 * certificate are entered as declared items. Parcel certificates: parcel.js.
 *
 * Declarations: per period (monthly or quarterly; a parcel cover monthly). With a daily declaration the month holds the
 * items of its daily declarations, the late items and the reversals (negative); without, the items dated in the period.
 * Cargo: the premium taxes of the line are added on top. Parcel: the taxes are inside the flat premium and shown per
 * cover (terms.js#taxesInside), the bill is the charge per certificate of the net certificates and the commission
 * follows the cover's commission % (parcel.commission_base). Billing raises the bill on the open policy (premium
 * receivable, booking journal, collection item) on the cover's remittance basis: gross remits the whole premium and
 * the commission goes to Direct Bill Processing (FR-PCL-040 to 042).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound, refused } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { isoDate, addDays } from '../../lib/dates.js';
import { num, round2 } from '../documents/common.js';
import { issuePolicy, createReceivable } from '../policies/service.js';
import { quotationCharges } from '../premium-charges/service.js';
import { isFeatureOn } from '../features/service.js';
import { COVER_TYPES, checkTerms, lineTaxRates, premiumPerCertificate, taxesInside, termsOf } from './terms.js';
import { assignDaily, dailyOut } from './daily.js';

export const coverOut = (r) => r && ({
  id: r.id, coverNumber: r.cover_number, coverType: r.cover_type || 'cargo', clientId: r.client_id, clientName: r.client_name ?? null, clientCode: r.client_code ?? null,
  insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name ?? null, productId: r.product_id, productName: r.product_name ?? null, policyId: r.policy_id, policyNumber: r.policy_number ?? null,
  insurerReference: r.insurer_reference, periodFrom: r.period_from, periodTo: r.period_to, goodsDescription: r.goods_description, voyageScope: r.voyage_scope,
  clauses: r.clauses, currency: r.currency, rates: (r.rates || []).map((x) => ({ conveyance: x.conveyance, ratePercent: Number(x.ratePercent), limit: Number(x.limit) })),
  markupPercent: Number(r.markup_percent), minimumPremium: Number(r.minimum_premium), estimatedAnnualValue: r.estimated_annual_value == null ? null : Number(r.estimated_annual_value),
  declarationFrequency: r.declaration_frequency, commissionRate: r.commission_rate == null ? null : Number(r.commission_rate), status: r.status,
  covers: termsOf(r).covers, premiumPerCertificate: premiumPerCertificate(r.covers), chargePerCertificate: r.charge_per_certificate == null ? null : Number(r.charge_per_certificate),
  serviceFeePerCertificate: r.charge_per_certificate == null ? null : round2(Number(r.charge_per_certificate) - premiumPerCertificate(r.covers)),
  deliveryTypes: r.delivery_types || [], remittanceBasis: r.remittance_basis || 'net', dailyDeclaration: Boolean(r.daily_declaration), fileFrequency: r.file_frequency || null,
  fileLayout: r.file_layout || null, declarationEmail: r.declaration_email || null, pendingEndorsement: r.pending_endorsement ?? null,
  certificates: r.certificate_count ?? undefined, declaredInsured: r.declared_insured == null ? undefined : Number(r.declared_insured),
  billedPremium: r.billed_premium == null ? undefined : Number(r.billed_premium), createdAt: r.created_at, updatedAt: r.updated_at,
});
export const certificateOut = (c) => ({
  id: c.id, certificateNumber: c.certificate_number, openCoverId: c.open_cover_id, declarationId: c.declaration_id, declarationNumber: c.declaration_number ?? null,
  kind: c.kind, shipmentDate: c.shipment_date, conveyance: c.conveyance, vesselName: c.vessel_name, voyageFrom: c.voyage_from, voyageTo: c.voyage_to,
  billOfLading: c.bill_of_lading, goodsDescription: c.goods_description, packing: c.packing, consignee: c.consignee, invoiceValue: Number(c.invoice_value),
  markupPercent: Number(c.markup_percent), insuredValue: Number(c.insured_value), ratePercent: Number(c.rate_percent), premium: Number(c.premium), status: c.status,
  cancelReason: c.cancel_reason, issuedAt: c.issued_at, issuedBy: c.issued_by_name ?? c.issued_by,
  // parcel certificates
  customerName: c.customer_name ?? null, loanAccount: c.loan_account ?? null, addressLine: c.address_line ?? null, barangay: c.barangay ?? null, city: c.city ?? null,
  province: c.province ?? null, zipCode: c.zip_code ?? null, mobile: c.mobile ?? null, email: c.email ?? null, documentsSent: c.documents_sent ?? null, courier: c.courier ?? null,
  waybillNo: c.waybill_no ?? null, deliveryType: c.delivery_type ?? null, deliveryCharge: c.delivery_charge == null ? null : Number(c.delivery_charge), covers: c.covers || [],
  charge: Number(c.charge || 0), late: Boolean(c.late), possibleDuplicate: Boolean(c.possible_duplicate), dailyDeclarationId: c.daily_declaration_id ?? null,
  dailyDeclarationNumber: c.daily_number ?? null, dailyDeclarationDate: c.daily_date ? String(c.daily_date).slice(0, 10) : null, emailed: Boolean(c.email_id), emailedAt: c.emailed_at ?? null,
  reversalStatus: c.reversal_status ?? null, reversalReason: c.reversal_reason ?? null, reversalRequestedBy: c.reversal_requested_by ?? null,
  reversalDeclarationId: c.reversal_declaration_id ?? null, reversalDeclarationNumber: c.reversal_number ?? null,
});
export const declarationOut = (d) => ({
  id: d.id, declarationNumber: d.declaration_number, openCoverId: d.open_cover_id, period: d.period, periodFrom: d.period_from, periodTo: d.period_to,
  shipments: d.shipments, reversals: d.reversals ?? 0, totalInsured: Number(d.total_insured), premium: Number(d.premium), vat: Number(d.vat), dst: Number(d.dst), lgt: Number(d.lgt),
  otherCharges: Number(d.other_charges), grossPremium: Number(d.gross_premium), taxesInside: Boolean(d.taxes_inside), chargeTotal: Number(d.charge_total || 0),
  serviceFee: Number(d.service_fee || 0), commission: Number(d.commission || 0), coverLines: d.cover_lines || [], fileStatus: d.file_status || 'not-generated',
  fileSentAt: d.file_sent_at ?? null, fileSentTo: d.file_sent_to ?? null, acceptance: d.acceptance ?? null, openedByJob: Boolean(d.opened_by_job),
  status: d.status, receivableId: d.receivable_id, billNumber: d.bill_number,
  billBalance: d.bill_balance == null ? null : Number(d.bill_balance), notes: d.notes, dueOn: d.due_on ?? null, submittedAt: d.submitted_at, billedAt: d.billed_at, createdAt: d.created_at,
});

const SELECT = `SELECT o.*, c.display_name AS client_name, c.client_code, ic.name AS insurer_name, ic.code AS insurer_code, p.policy_number,
  (SELECT pr.name FROM products pr WHERE pr.id = o.product_id) AS product_name,
  (SELECT e.id FROM open_cover_endorsements e WHERE e.open_cover_id = o.id AND e.status = 'pending' LIMIT 1) AS pending_endorsement,
  (SELECT count(*)::int FROM open_cover_certificates x WHERE x.open_cover_id = o.id AND x.status NOT IN ('cancelled', 'reversed')) AS certificate_count,
  (SELECT COALESCE(sum(x.insured_value), 0) FROM open_cover_certificates x WHERE x.open_cover_id = o.id AND x.status NOT IN ('cancelled', 'reversed')) AS declared_insured,
  (SELECT COALESCE(sum(d.gross_premium), 0) FROM open_cover_declarations d WHERE d.open_cover_id = o.id AND d.status = 'billed') AS billed_premium
  FROM open_covers o JOIN clients c ON c.id = o.client_id JOIN insurance_companies ic ON ic.id = o.insurance_company_id LEFT JOIN policies p ON p.id = o.policy_id`;
export const CERT_SELECT = `SELECT x.*, d.declaration_number, rd.declaration_number AS reversal_number, dd.declaration_number AS daily_number, dd.declaration_date AS daily_date,
  u.display_name AS issued_by_name FROM open_cover_certificates x
  LEFT JOIN open_cover_declarations d ON d.id = x.declaration_id LEFT JOIN open_cover_declarations rd ON rd.id = x.reversal_declaration_id
  LEFT JOIN open_cover_daily_declarations dd ON dd.id = x.daily_declaration_id LEFT JOIN users u ON u.id = x.issued_by`;

export async function listCovers(q = {}) {
  return (await many(`${SELECT} WHERE ($1::text IS NULL OR o.status = $1) AND ($3::text IS NULL OR o.cover_type = $3)
    AND ($2::text IS NULL OR o.cover_number ILIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $2 || '%' OR p.policy_number ILIKE '%' || $2 || '%')
    ORDER BY o.created_at DESC LIMIT 500`, [q.status || null, q.search || null, COVER_TYPES.includes(q.type) ? q.type : null])).map(coverOut);
}

export async function getCoverRow(id, db = { query }) {
  const r = (await db.query(`${SELECT} WHERE o.id = $1 OR o.cover_number = $1`, [String(id)])).rows[0];
  if (!r) throw notFound('Open cover not found');
  return r;
}

/** Certificates of a cover; q: { from, to (parcel or shipment date), search (name, loan account, waybill, number), status }. */
export async function listCertificates(coverId, q = {}) {
  return (await many(`${CERT_SELECT} WHERE x.open_cover_id = $1 AND ($2::date IS NULL OR x.shipment_date >= $2) AND ($3::date IS NULL OR x.shipment_date <= $3)
    AND ($4::text IS NULL OR x.certificate_number ILIKE '%' || $4 || '%' OR x.customer_name ILIKE '%' || $4 || '%' OR x.loan_account ILIKE '%' || $4 || '%' OR x.waybill_no ILIKE '%' || $4 || '%')
    AND ($5::text IS NULL OR x.status = $5)
    ORDER BY x.shipment_date DESC, x.certificate_number DESC LIMIT 5000`, [coverId, isoDate(q.from) || null, isoDate(q.to) || null, q.search || null, q.status || null])).map(certificateOut);
}

export async function getCover(id) {
  const r = await getCoverRow(id);
  const certificates = await listCertificates(r.id);
  const dueDays = Number(await getSetting('marine.declaration_due_days', 15));
  const declarations = (await many(`SELECT d.*, rc.balance AS bill_balance FROM open_cover_declarations d LEFT JOIN receivables rc ON rc.id = d.receivable_id
    WHERE d.open_cover_id = $1 ORDER BY d.period DESC`, [r.id])).map((d) => declarationOut({ ...d, due_on: addDays(String(d.period_to).slice(0, 10), dueDays) }));
  const dailyDeclarations = (await many(`SELECT d.*, m.declaration_number AS monthly_number,
      (SELECT count(*)::int FROM open_cover_certificates x WHERE x.daily_declaration_id = d.id AND x.status <> 'cancelled') AS items,
      (SELECT count(*)::int FROM open_cover_certificates x WHERE x.daily_declaration_id = d.id AND x.status <> 'cancelled' AND x.late) AS late_items,
      (SELECT COALESCE(sum(x.insured_value), 0) FROM open_cover_certificates x WHERE x.daily_declaration_id = d.id AND x.status <> 'cancelled') AS total_insured,
      (SELECT COALESCE(sum(x.premium), 0) FROM open_cover_certificates x WHERE x.daily_declaration_id = d.id AND x.status <> 'cancelled') AS premium
    FROM open_cover_daily_declarations d LEFT JOIN open_cover_declarations m ON m.id = d.monthly_declaration_id WHERE d.open_cover_id = $1 ORDER BY d.declaration_date DESC LIMIT 400`, [r.id])).map(dailyOut);
  const { listEndorsements } = await import('./endorsements.js');
  return { ...coverOut(r), certificateList: certificates, declarations, dailyDeclarations, endorsements: await listEndorsements(r.id) };
}

/** Choices of the New open cover panel: types, delivery types, covers proposed, lines, layouts, defaults. */
export async function coverChoices() {
  const { fileLayouts } = await import('./terms.js');
  const layouts = await fileLayouts();
  return {
    types: [{ value: 'parcel', label: 'Parcel / Courier' }, { value: 'cargo', label: 'Marine Cargo' }], cargoEnabled: await isFeatureOn('marine-cargo'),
    defaultCharge: num(await getSetting('parcel.default_charge', 500)), defaultCovers: (await getSetting('parcel.default_covers', [])) || [],
    deliveryTypes: (await getSetting('parcel.delivery_types', [])) || [], coverLines: (await getSetting('parcel.cover_lines', ['MARINE', 'PA'])) || [],
    maxCovers: Number(await getSetting('parcel.max_covers', 5)), dailyDeclaration: Boolean(await getSetting('marine.default_daily_declaration', true)),
    layouts: Object.entries(layouts).map(([value, l]) => ({ value, label: l.label || value, kind: l.kind || null })),
    documentsSent: (await getSetting('parcel.documents_sent', [])) || [], cancelReasons: (await getSetting('parcel.cancel_reasons', [])) || [],
    defaultCourier: await getSetting('parcel.default_courier', 'LBC Express'), maxBackdateDays: Number(await getSetting('parcel.max_backdate_days', 30)),
  };
}

/** An active parcel cover of the same client and insurer whose period overlaps (FR-PCL-001 R3), or null. */
async function overlapping(db, { id = null, clientId, insurerId, from, to }) {
  return (await db.query(`SELECT o.cover_number, c.display_name AS client_name, ic.name AS insurer_name, GREATEST(o.period_from, $4::date) AS on_date FROM open_covers o
    JOIN clients c ON c.id = o.client_id JOIN insurance_companies ic ON ic.id = o.insurance_company_id
    WHERE o.cover_type = 'parcel' AND o.status = 'active' AND o.client_id = $1 AND o.insurance_company_id = $2 AND o.id IS DISTINCT FROM $3
      AND o.period_from <= $5::date AND o.period_to >= $4::date LIMIT 1`, [clientId, insurerId, id, from, to])).rows[0] || null;
}
const overlapError = (o) => badRequest('Validation failed', [{ path: 'periodFrom', code: 'MSG-PCL-004',
  message: `Open cover ${o.cover_number} already covers ${o.client_name} with ${o.insurer_name} on ${String(o.on_date).slice(0, 10)}` }]);

/** The type of a new cover: required (MSG-PCL-001); a body with conveyance rates and no type is a cargo contract (earlier API). */
function typeOf(b) {
  const type = b.coverType ?? (Array.isArray(b.rates) && b.rates.length && !b.covers ? 'cargo' : null);
  if (!COVER_TYPES.includes(type)) throw badRequest('Validation failed', [{ path: 'coverType', message: 'Choose the open cover type', code: 'MSG-PCL-001' }]);
  return type;
}

export async function createCover(b, userId) {
  const type = typeOf(b);
  const client = await one('SELECT id FROM clients WHERE id = $1 OR client_code = $1', [String(b.clientId)]);
  if (!client) throw badRequest('Validation failed', [{ path: 'clientId', message: 'Client not found' }]);
  if (!(await one('SELECT 1 FROM insurance_companies WHERE id = $1', [b.insuranceCompanyId]))) throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: 'Unknown insurer' }]);
  const from = isoDate(b.periodFrom);
  const to = isoDate(b.periodTo);
  if (!from || !to || to <= from) throw badRequest('Validation failed', [{ path: 'periodTo', message: 'The period must end after it starts' }]);
  const terms = await checkTerms(type, {
    ...b, chargePerCertificate: b.chargePerCertificate ?? (type === 'parcel' ? num(await getSetting('parcel.default_charge', 500)) : null),
    deliveryTypes: b.deliveryTypes ?? (type === 'parcel' ? (await getSetting('parcel.delivery_types', [])) : []),
    remittanceBasis: b.remittanceBasis || (type === 'parcel' ? 'gross' : 'net'),
    dailyDeclaration: b.dailyDeclaration ?? Boolean(await getSetting('marine.default_daily_declaration', true)),
    fileFrequency: b.fileFrequency === undefined ? (type === 'parcel' ? 'monthly' : null) : b.fileFrequency || null,
    fileLayout: b.fileLayout === undefined ? (type === 'parcel' ? 'axa-parcel' : null) : b.fileLayout || null,
  });
  if (type === 'parcel') {
    const o = await overlapping({ query }, { clientId: client.id, insurerId: b.insuranceCompanyId, from, to });
    if (o) throw overlapError(o);
  }
  // marine cargo is a future-release feature (modules/features): the open covers of TISPH are parcel and courier
  const cargo = await isFeatureOn('marine-cargo');
  const productId = b.productId || (await one('SELECT id FROM products WHERE upper(code) = $1 LIMIT 1', [type === 'cargo' && cargo ? 'MARINE' : 'PARCEL']))?.id || null;
  if (!cargo && b.productId && (await one('SELECT upper(code) AS code FROM products WHERE id = $1', [b.productId]))?.code === 'MARINE') {
    throw refused('FEATURE_NOT_ENABLED', 'Marine cargo open covers are not available in this edition');
  }
  const number = await nextDocumentNumber('open_cover', { unique: { table: 'open_covers', column: 'cover_number' } });
  const r = await one(`INSERT INTO open_covers(cover_number, client_id, insurance_company_id, product_id, insurer_reference, period_from, period_to, goods_description, voyage_scope,
      clauses, currency, rates, markup_percent, minimum_premium, estimated_annual_value, declaration_frequency, commission_rate, owner_user_id, created_by, updated_by,
      cover_type, covers, charge_per_certificate, delivery_types, remittance_basis, daily_declaration, file_frequency, file_layout, declaration_email)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING id`,
  [number, client.id, b.insuranceCompanyId, productId, terms.insurerReference || null, from, to, b.goodsDescription, b.voyageScope || null, b.clauses || null,
    b.currency || 'PHP', JSON.stringify(terms.rates), type === 'parcel' ? 0 : (b.markupPercent ?? Number(await getSetting('marine.default_markup_percent', 10))), num(b.minimumPremium),
    b.estimatedAnnualValue ?? null, type === 'parcel' ? 'monthly' : (b.declarationFrequency || 'monthly'), b.commissionRate ?? null, userId,
    type, JSON.stringify(terms.covers), terms.chargePerCertificate, JSON.stringify(terms.deliveryTypes || []), terms.remittanceBasis, Boolean(terms.dailyDeclaration),
    terms.fileFrequency || null, terms.fileLayout || null, terms.declarationEmail || null]);
  return getCover(r.id);
}

/** Write a set of terms on the cover row (endorsement approval, edit of a draft). */
export async function writeTerms(db, coverId, t, userId) {
  await db.query(`UPDATE open_covers SET period_to = $2, goods_description = $3, voyage_scope = $4, clauses = $5, insurer_reference = $6, rates = $7::jsonb, markup_percent = $8,
      minimum_premium = $9, commission_rate = $10, declaration_frequency = $11, covers = $12::jsonb, charge_per_certificate = $13, delivery_types = $14::jsonb, remittance_basis = $15,
      daily_declaration = $16, file_frequency = $17, file_layout = $18, declaration_email = $19, updated_by = $20, updated_at = now() WHERE id = $1`,
  [coverId, t.periodTo, t.goodsDescription, t.voyageScope ?? null, t.clauses ?? null, t.insurerReference ?? null, JSON.stringify(t.rates || []), num(t.markupPercent), num(t.minimumPremium),
    t.commissionRate ?? null, t.declarationFrequency || 'monthly', JSON.stringify(t.covers || []), t.chargePerCertificate ?? null, JSON.stringify(t.deliveryTypes || []),
    t.remittanceBasis || 'net', Boolean(t.dailyDeclaration), t.fileFrequency || null, t.fileLayout || null, t.declarationEmail || null, userId]);
}

/**
 * Change a cover. A draft changes freely (not its type: MSG-PCL-002). An active one is changed by an endorsement of the
 * open policy (marine.endorse_active_covers); with that setting off, its clauses, terms and rates change in place.
 */
export async function updateCover(id, b, userId) {
  const before = await getCoverRow(id);
  if (['expired', 'cancelled'].includes(before.status)) throw conflict(`Open cover ${before.cover_number} is ${before.status}`);
  if (b.coverType !== undefined && b.coverType !== before.cover_type) {
    throw badRequest('Validation failed', [{ path: 'coverType', message: 'The open cover type cannot change after the open cover is saved', code: 'MSG-PCL-002' }]);
  }
  const draft = before.status === 'draft';
  if (!draft && (await getSetting('marine.endorse_active_covers', true)) !== false) {
    throw conflict(`Open cover ${before.cover_number} is active: change it with an endorsement of the open policy`);
  }
  if (!draft && ['clientId', 'insuranceCompanyId', 'periodFrom', 'currency'].some((k) => b[k] !== undefined)) {
    throw conflict('The client, insurer, start date and currency of an active open cover cannot change');
  }
  const current = termsOf(before);
  const merged = Object.fromEntries(Object.entries(current).map(([k, v]) => [k, b[k] !== undefined ? b[k] : v]));
  merged.periodTo = b.periodTo ? isoDate(b.periodTo) : current.periodTo;
  const terms = await checkTerms(before.cover_type, merged);
  const from = draft && b.periodFrom ? isoDate(b.periodFrom) : String(before.period_from).slice(0, 10);
  if (terms.periodTo <= from) throw badRequest('Validation failed', [{ path: 'periodTo', message: 'The period must end after it starts' }]);
  await withTransaction(async (db) => {
    await writeTerms(db, before.id, terms, userId);
    await db.query(`UPDATE open_covers SET period_from = $2, estimated_annual_value = COALESCE($3, estimated_annual_value), insurance_company_id = COALESCE($4, insurance_company_id)
      WHERE id = $1`, [before.id, from, b.estimatedAnnualValue ?? null, draft ? (b.insuranceCompanyId ?? null) : null]);
    if (!draft && terms.periodTo !== current.periodTo && before.policy_id) await db.query('UPDATE policies SET expiry_date = $2, updated_at = now() WHERE id = $1', [before.policy_id, terms.periodTo]);
  });
  return { before: coverOut(before), after: await getCover(before.id) };
}

/** Risk details of the open policy: the conveyances of a cargo cover, the covers on each certificate of a parcel cover. */
const riskDetailsOf = (c) => (c.cover_type === 'parcel'
  ? { goods: c.goods_description, covers: termsOf(c).covers.map((x) => `${x.name}: sum insured ${x.sumInsured.toFixed(2)}, premium ${x.premium.toFixed(2)}${x.insurerPolicyNo ? ` (policy ${x.insurerPolicyNo})` : ''}`).join('; '),
    chargePerCertificate: Number(c.charge_per_certificate), premiumPerCertificate: premiumPerCertificate(c.covers), remittanceBasis: c.remittance_basis }
  : { goods: c.goods_description, voyages: c.voyage_scope, conveyances: (c.rates || []).map((r) => `${r.conveyance} ${r.ratePercent}% up to ${r.limit}`).join('; '), remittanceBasis: c.remittance_basis });

/** Activate the contract: its open policy is issued without a bill (billed on the declarations). */
export async function activateCover(id, user) {
  const c = await getCoverRow(id);
  if (c.status !== 'draft') throw conflict(`Open cover ${c.cover_number} is ${c.status}`);
  await checkTerms(c.cover_type, termsOf(c));
  if (c.cover_type === 'parcel') {
    const o = await overlapping({ query }, { id: c.id, clientId: c.client_id, insurerId: c.insurance_company_id, from: String(c.period_from).slice(0, 10), to: String(c.period_to).slice(0, 10) });
    if (o) throw overlapError(o);
  }
  return withTransaction(async (db) => {
    const issued = await issuePolicy(db, {
      clientId: c.client_id, productId: c.product_id, insuranceCompanyId: c.insurance_company_id, ownerUserId: c.owner_user_id || user.id, agentUserId: c.owner_user_id || user.id,
      sumInsured: num(c.estimated_annual_value), netPremium: 0, grossPremium: 0, commissionAmount: 0, commissionRate: c.commission_rate == null ? null : Number(c.commission_rate),
      currency: c.currency, insuredName: c.client_name, productType: c.product_name || (c.cover_type === 'parcel' ? 'Parcel / Courier' : 'Marine Cargo'), lob: 'MARINE', billLater: true,
      doc: { source: 'open-cover', openCoverId: c.id, coverNumber: c.cover_number, isOpenCover: true, openCoverType: c.cover_type, insurerReference: c.insurer_reference,
        remittanceBasis: c.remittance_basis, riskDetails: riskDetailsOf(c) },
    }, { inception: c.period_from, expiry: c.period_to }, user.id);
    await db.query("UPDATE open_covers SET status = 'active', policy_id = $2, updated_by = $3, updated_at = now() WHERE id = $1", [c.id, issued.policyId, user.id]);
    return { policyId: issued.policyId };
  });
}

export async function cancelCover(id, reason, userId) {
  const c = await getCoverRow(id);
  if (!['draft', 'active'].includes(c.status)) throw conflict(`Open cover ${c.cover_number} is ${c.status}`);
  const open = await one("SELECT 1 FROM open_cover_declarations WHERE open_cover_id = $1 AND status IN ('draft', 'submitted') LIMIT 1", [c.id]);
  if (open) throw conflict('Bill or delete the open declarations first');
  await query("UPDATE open_covers SET status = 'cancelled', updated_by = $2, updated_at = now() WHERE id = $1", [c.id, userId]);
  if (c.policy_id) await query("UPDATE policies SET status = 'cancelled', updated_by = $2, updated_at = now(), doc = doc || jsonb_build_object('cancelReason', $3::text) WHERE id = $1", [c.policy_id, userId, reason || '']);
  return { before: coverOut(c), after: await getCover(c.id) };
}

/** Rate, insured value and premium of a shipment under the cover terms (refused above the limit of its conveyance). */
export function priceShipment(cover, s) {
  const rates = cover.rates || [];
  const rate = rates.find((r) => r.conveyance === s.conveyance);
  if (!rate) throw badRequest('Validation failed', [{ path: 'conveyance', message: `The open cover has no rate for ${s.conveyance}`, code: 'MSG-PCL-053' }]);
  const invoice = num(s.invoiceValue);
  if (!(invoice > 0)) throw badRequest('Validation failed', [{ path: 'invoiceValue', message: 'The invoice value must be greater than zero' }]);
  const coverMarkup = cover.markupPercent ?? cover.markup_percent;
  const markup = s.markupPercent !== undefined && s.markupPercent !== null && s.markupPercent !== '' ? num(s.markupPercent) : num(coverMarkup);
  const insured = round2(invoice * (1 + markup / 100));
  if (insured > num(rate.limit)) {
    throw badRequest('Validation failed', [{ path: 'invoiceValue', code: 'MSG-PCL-052',
      message: `Insured value ${insured.toFixed(2)} exceeds the ${s.conveyance} limit per conveyance ${num(rate.limit).toFixed(2)}: refer the shipment to the insurer` }]);
  }
  const premium = round2(Math.max(insured * num(rate.ratePercent) / 100, num(cover.minimumPremium ?? cover.minimum_premium)));
  return { markup, insured, rate: num(rate.ratePercent), premium };
}

/** Recompute the draft monthly declaration holding a day (after an item joined or left it). */
export async function recomputeOpenMonth(db, coverId, date) {
  const decl = (await db.query("SELECT id FROM open_cover_declarations WHERE open_cover_id = $1 AND status = 'draft' AND $2::date BETWEEN period_from AND period_to", [coverId, date])).rows[0];
  if (decl) await recompute(decl.id, db);
}

/** Issue a cargo certificate (kind certificate) or enter a shipment declared without one (kind declared), priced on the terms in force on its date. */
export async function issueCertificate(coverId, b, userId, kind = 'certificate', { db = null, uploadId = null } = {}) {
  const run = async (tx) => {
    const c = await getCoverRow(coverId, tx);
    if (c.status !== 'active') throw conflict(`Open cover ${c.cover_number} is ${c.status}: certificates are issued on an active cover`);
    if (c.cover_type === 'parcel') throw conflict('A parcel open cover issues parcel certificates: use Add parcel or Upload parcels');
    const date = isoDate(b.shipmentDate);
    if (!date || date < String(c.period_from).slice(0, 10) || date > String(c.period_to).slice(0, 10)) {
      throw badRequest('Validation failed', [{ path: 'shipmentDate', message: `The shipment date must fall within ${String(c.period_from).slice(0, 10)} to ${String(c.period_to).slice(0, 10)}` }]);
    }
    const { termsOn } = await import('./terms.js');
    const terms = await termsOn(tx, c, date);
    const priced = priceShipment(terms, b);
    for (const k of ['voyageFrom', 'voyageTo']) if (!b[k]) throw badRequest('Validation failed', [{ path: k, message: `${k} is required` }]);
    const number = await nextDocumentNumber('marine_certificate', { db: tx, unique: { table: 'open_cover_certificates', column: 'certificate_number' } });
    const daily = c.daily_declaration ? await assignDaily(tx, c, date) : null;
    const r = (await tx.query(`INSERT INTO open_cover_certificates(certificate_number, open_cover_id, kind, shipment_date, conveyance, vessel_name, voyage_from, voyage_to, bill_of_lading,
        goods_description, packing, consignee, invoice_value, markup_percent, insured_value, rate_percent, premium, issued_by, daily_declaration_id, late, upload_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
    [number, c.id, kind, date, b.conveyance, b.vesselName || null, b.voyageFrom, b.voyageTo, b.billOfLading || null, b.goodsDescription || c.goods_description, b.packing || null,
      b.consignee || null, num(b.invoiceValue), priced.markup, priced.insured, priced.rate, priced.premium, userId, daily?.daily.id || null, Boolean(daily?.late), uploadId])).rows[0];
    // a shipment of a period whose declaration is still open joins it
    await recomputeOpenMonth(tx, c.id, daily ? String(daily.daily.declaration_date).slice(0, 10) : date);
    return { ...certificateOut((await tx.query(`${CERT_SELECT} WHERE x.id = $1`, [r.id])).rows[0]), warnings: daily?.message ? [daily.message] : [] };
  };
  return db ? run(db) : withTransaction(run);
}

export async function getCertificateRow(id, db = { query }) {
  const r = (await db.query(`${CERT_SELECT} WHERE x.id = $1 OR x.certificate_number = $1`, [String(id)])).rows[0];
  if (!r) throw notFound('Certificate not found');
  return r;
}

/**
 * Cancel a certificate (FR-PCL-014): with a reason (a parcel certificate: one of parcel.cancel_reasons), while its
 * monthly declaration is not submitted; it leaves its daily and monthly declaration. Once declared it is reversed instead.
 */
export async function cancelCertificate(id, reason, user) {
  const userId = user?.id ?? user;
  if (!String(reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'Enter the reason for the cancellation', code: 'MSG-PCL-035' }]);
  const x = await getCertificateRow(id);
  if (x.status === 'cancelled') throw conflict('The certificate is already cancelled');
  if (x.kind === 'parcel') {
    const reasons = ((await getSetting('parcel.cancel_reasons', [])) || []).map((r) => String(r).toLowerCase());
    const head = String(reason).split(':')[0].trim().toLowerCase();
    if (reasons.length && !reasons.includes(head)) throw badRequest('Validation failed', [{ path: 'reason', message: `Choose a reason: ${(await getSetting('parcel.cancel_reasons', [])).join(', ')}` }]);
  }
  const declared = (await one(`SELECT d.declaration_number FROM open_cover_declarations d WHERE d.status <> 'draft' AND (d.id = $1
      OR d.id = (SELECT monthly_declaration_id FROM open_cover_daily_declarations WHERE id = $2)) LIMIT 1`, [x.declaration_id, x.daily_declaration_id]))
    || (x.status === 'declared' || x.status === 'reversed' ? { declaration_number: x.declaration_number } : null);
  if (declared) throw conflict(`Certificate ${x.certificate_number} is on submitted declaration ${declared.declaration_number}: request a reversal`);
  await withTransaction(async (db) => {
    await db.query(`UPDATE open_cover_certificates SET status = 'cancelled', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), declaration_id = NULL, daily_declaration_id = NULL,
      updated_at = now() WHERE id = $1`, [x.id, String(reason).trim(), userId || null]);
    if (x.declaration_id) await recompute(x.declaration_id, db);
  });
  return certificateOut(await getCertificateRow(x.id));
}

/** First and last day of a declaration period (YYYY-MM; a quarter starts on its first month). */
export function periodRange(period, frequency) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period))) throw badRequest('Validation failed', [{ path: 'period', message: 'period must be YYYY-MM' }]);
  const [y, m] = period.split('-').map(Number);
  const months = frequency === 'quarterly' ? 3 : 1;
  if (months === 3 && (m - 1) % 3 !== 0) throw badRequest('Validation failed', [{ path: 'period', message: 'A quarterly declaration starts in January, April, July or October' }]);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m - 1 + months, 0)).toISOString().slice(0, 10);
  return { from, to };
}

/** Lines per cover of a parcel declaration: the certificates (positive) and reversals (negative), taxes inside, commission. */
async function parcelLines(db, items, reversals) {
  const base = (await getSetting('parcel.commission_base', 'gross')) === 'net' ? 'net' : 'gross';
  const by = new Map();
  const add = (cert, sign) => {
    for (const c of cert.covers || []) {
      const key = c.name;
      const l = by.get(key) || { cover: c.name, line: c.line, insurerPolicyNo: c.insurerPolicyNo || '', certificates: 0, sumInsured: 0, premium: 0, commission: 0, commissionPercent: num(c.commissionPercent), parts: [] };
      l.certificates += sign;
      l.sumInsured = round2(l.sumInsured + sign * num(c.sumInsured));
      l.premium = round2(l.premium + sign * num(c.premium));
      l.parts.push({ premium: sign * num(c.premium), pct: num(c.commissionPercent) });
      by.set(key, l);
    }
  };
  for (const x of items) add(x, 1);
  for (const x of reversals) add(x, -1);
  const lines = [];
  for (const l of by.values()) {
    const t = taxesInside(l.premium, await lineTaxRates(l.line, db));
    // commission on the cover's premium per certificate x its commission % (as issued), on the gross or the net premium
    const gross = round2(l.parts.reduce((s, p) => s + p.premium * p.pct / 100, 0));
    const commission = base === 'net' && l.premium ? round2(gross * (t.net / l.premium)) : gross;
    lines.push({ cover: l.cover, line: l.line, insurerPolicyNo: l.insurerPolicyNo, certificates: l.certificates, sumInsured: l.sumInsured, premium: l.premium,
      net: t.net, vat: t.vat, dst: t.dst, lgt: t.lgt, commissionPercent: l.commissionPercent, commission });
  }
  return lines;
}

/** Totals of a draft declaration from its items (and reversals), with the premium taxes. */
export async function recompute(declarationId, db = { query }) {
  const d = (await db.query(`SELECT d.*, o.product_id, o.cover_type, o.daily_declaration FROM open_cover_declarations d JOIN open_covers o ON o.id = d.open_cover_id WHERE d.id = $1`, [declarationId])).rows[0];
  if (d.status !== 'draft') return d;
  // the daily declarations of the period join the month; their items follow
  await db.query(`UPDATE open_cover_daily_declarations SET monthly_declaration_id = $1, updated_at = now() WHERE open_cover_id = $2 AND monthly_declaration_id IS NULL
    AND declaration_date BETWEEN $3 AND $4`, [d.id, d.open_cover_id, d.period_from, d.period_to]);
  await db.query(`UPDATE open_cover_certificates x SET declaration_id = $1, updated_at = now() WHERE x.open_cover_id = $2 AND x.status <> 'cancelled' AND x.declaration_id IS NULL
    AND ((x.daily_declaration_id IS NOT NULL AND EXISTS (SELECT 1 FROM open_cover_daily_declarations dd WHERE dd.id = x.daily_declaration_id AND dd.monthly_declaration_id = $1))
      OR (x.daily_declaration_id IS NULL AND x.shipment_date BETWEEN $3 AND $4))`, [d.id, d.open_cover_id, d.period_from, d.period_to]);
  // reversals approved up to the end of the period (FR-PCL-014): a negative line here
  await db.query(`UPDATE open_cover_certificates SET reversal_declaration_id = $1, updated_at = now() WHERE open_cover_id = $2 AND status = 'reversed' AND reversal_declaration_id IS NULL
    AND declaration_id IS DISTINCT FROM $1 AND reversal_decided_at::date <= $3`, [d.id, d.open_cover_id, d.period_to]);
  const items = (await db.query("SELECT * FROM open_cover_certificates WHERE declaration_id = $1 AND status <> 'cancelled'", [d.id])).rows;
  const reversals = (await db.query('SELECT * FROM open_cover_certificates WHERE reversal_declaration_id = $1', [d.id])).rows;
  const sum = (list, k) => round2(list.reduce((s, x) => s + num(x[k]), 0));
  const premium = round2(sum(items, 'premium') - sum(reversals, 'premium'));
  const insured = round2(sum(items, 'insured_value') - sum(reversals, 'insured_value'));
  let set;
  if (d.cover_type === 'parcel') {
    const lines = await parcelLines(db, items, reversals);
    const charge = round2(sum(items, 'charge') - sum(reversals, 'charge'));
    set = { vat: round2(lines.reduce((s, l) => s + l.vat, 0)), dst: round2(lines.reduce((s, l) => s + l.dst, 0)), lgt: round2(lines.reduce((s, l) => s + l.lgt, 0)),
      other: 0, gross: premium, taxesInside: true, lines, charge, fee: round2(charge - premium), commission: round2(lines.reduce((s, l) => s + l.commission, 0)) };
  } else {
    const c = premium > 0 ? await quotationCharges({ productId: d.product_id }, premium, 'MARINE', db) : null;
    const tax = c ? c.tax : { valueAddedTax: 0, documentaryStampTax: 0, localGovernmentTax: 0, fireServiceTax: 0 };
    const other = c ? round2(num(c.others) + num(tax.fireServiceTax)) : 0;
    set = { vat: round2(tax.valueAddedTax), dst: round2(tax.documentaryStampTax), lgt: round2(tax.localGovernmentTax), other, taxesInside: false, lines: [], charge: 0, fee: 0, commission: 0 };
    set.gross = round2(premium + set.vat + set.dst + set.lgt + other);
  }
  await db.query(`UPDATE open_cover_declarations SET shipments = $2, total_insured = $3, premium = $4, vat = $5, dst = $6, lgt = $7, other_charges = $8, gross_premium = $9,
      reversals = $10, taxes_inside = $11, cover_lines = $12::jsonb, charge_total = $13, service_fee = $14, commission = $15, updated_at = now() WHERE id = $1`,
  [d.id, items.length, insured, premium, set.vat, set.dst, set.lgt, set.other, set.gross, reversals.length, set.taxesInside, JSON.stringify(set.lines), set.charge, set.fee, set.commission]);
  return (await db.query('SELECT * FROM open_cover_declarations WHERE id = $1', [d.id])).rows[0];
}

export async function getDeclarationRow(id) {
  const d = await one(`SELECT d.*, rc.balance AS bill_balance, o.cover_number, o.cover_type, o.client_id, o.policy_id, o.currency, o.commission_rate, o.remittance_basis,
      o.declaration_email, o.file_layout, o.daily_declaration FROM open_cover_declarations d
    JOIN open_covers o ON o.id = d.open_cover_id LEFT JOIN receivables rc ON rc.id = d.receivable_id WHERE d.id = $1 OR d.declaration_number = $1`, [String(id)]);
  if (!d) throw notFound('Declaration not found');
  return d;
}

export async function getDeclaration(id) {
  const d = await getDeclarationRow(id);
  const items = (await many(`${CERT_SELECT} WHERE x.declaration_id = $1 ORDER BY x.shipment_date, x.certificate_number`, [d.id])).map(certificateOut);
  const reversals = (await many(`${CERT_SELECT} WHERE x.reversal_declaration_id = $1 ORDER BY x.shipment_date, x.certificate_number`, [d.id])).map(certificateOut);
  const dailies = (await many(`SELECT dd.*, (SELECT count(*)::int FROM open_cover_certificates x WHERE x.daily_declaration_id = dd.id AND x.status <> 'cancelled') AS items,
      (SELECT count(*)::int FROM open_cover_certificates x WHERE x.daily_declaration_id = dd.id AND x.status <> 'cancelled' AND x.late) AS late_items,
      (SELECT COALESCE(sum(x.premium), 0) FROM open_cover_certificates x WHERE x.daily_declaration_id = dd.id AND x.status <> 'cancelled') AS premium
    FROM open_cover_daily_declarations dd WHERE dd.monthly_declaration_id = $1 ORDER BY dd.declaration_date`, [d.id])).map(dailyOut);
  const files = await many(`SELECT f.id, f.version, f.file_name AS "fileName", f.layout, f.rows_count AS rows, f.total_premium AS "totalPremium", f.created_at AS "createdAt",
      u.display_name AS "createdBy" FROM open_cover_declaration_files f LEFT JOIN users u ON u.id = f.created_by WHERE f.declaration_id = $1 ORDER BY f.version DESC`, [d.id]);
  return { ...declarationOut(d), coverNumber: d.cover_number, coverType: d.cover_type, remittanceBasis: d.remittance_basis, items, reversalItems: reversals, dailyDeclarations: dailies,
    files: files.map((f) => ({ ...f, totalPremium: Number(f.totalPremium) })) };
}

/** Open the declaration of a period: the items of the period are attached and priced. */
export async function createDeclaration(coverId, period, userId, { byJob = false } = {}) {
  const c = await getCoverRow(coverId);
  if (!['active', 'expired'].includes(c.status)) throw conflict(`Open cover ${c.cover_number} is ${c.status}`);
  const { from, to } = periodRange(period, c.cover_type === 'parcel' ? 'monthly' : c.declaration_frequency);
  if (to < String(c.period_from).slice(0, 10) || from > String(c.period_to).slice(0, 10)) throw badRequest('Validation failed', [{ path: 'period', message: 'The period is outside the open cover' }]);
  if (await one('SELECT 1 FROM open_cover_declarations WHERE open_cover_id = $1 AND period = $2', [c.id, period])) throw conflict(`The declaration of ${period} already exists`);
  const number = await nextDocumentNumber('marine_declaration', { unique: { table: 'open_cover_declarations', column: 'declaration_number' } });
  const r = await one(`INSERT INTO open_cover_declarations(declaration_number, open_cover_id, period, period_from, period_to, created_by, opened_by_job) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [number, c.id, period, from, to, userId, byJob]);
  await recompute(r.id);
  return getDeclaration(r.id);
}

export async function refreshDeclaration(id) {
  const d = await getDeclarationRow(id);
  if (d.status !== 'draft') throw conflict(`Declaration ${d.declaration_number} is ${d.status}`);
  await recompute(d.id);
  return getDeclaration(d.id);
}

/**
 * Submit the declaration (the statement of items for the period); without items and reversals it is a nil return.
 * With a daily declaration every day of the period must be closed (MSG-PCL-042); the days become Declared. The
 * declaration file of the cover's layout is written (files.js).
 */
export async function submitDeclaration(id, { notes = null } = {}, user) {
  const userId = user?.id ?? user;
  const d = await getDeclarationRow(id);
  if (d.status !== 'draft') throw conflict(`Declaration ${d.declaration_number} is ${d.status}`);
  if (d.daily_declaration) {
    const open = await one(`SELECT declaration_date FROM open_cover_daily_declarations WHERE open_cover_id = $1 AND status = 'open' AND declaration_date BETWEEN $2 AND $3
      ORDER BY declaration_date LIMIT 1`, [d.open_cover_id, d.period_from, d.period_to]);
    if (open) throw conflict(`The daily declaration of ${String(open.declaration_date).slice(0, 10)} is still open`);
  }
  const fresh = await recompute(d.id);
  const status = fresh.shipments || fresh.reversals ? 'submitted' : 'nil';
  await withTransaction(async (db) => {
    await db.query('UPDATE open_cover_declarations SET status = $2, notes = COALESCE($3, notes), submitted_at = now(), submitted_by = $4, updated_at = now() WHERE id = $1', [d.id, status, notes, userId]);
    await db.query("UPDATE open_cover_certificates SET status = 'declared', updated_at = now() WHERE declaration_id = $1 AND status = 'issued'", [d.id]);
    await db.query("UPDATE open_cover_daily_declarations SET status = 'declared', updated_at = now() WHERE monthly_declaration_id = $1 AND status IN ('closed', 'nil')", [d.id]);
  });
  if (d.file_layout) {
    const { generateFile } = await import('./files.js');
    await generateFile(d.id, user).catch(() => null);
  }
  return getDeclaration(d.id);
}

/**
 * Bill the declaration on the open policy: premium receivable, booking journal and collection item, on the cover's
 * remittance basis. Parcel (FR-PCL-040): the charge per certificate of the net certificates; the service fee (charge
 * less premium) is booked as fee income; the commission of the covers is the bill's commission (gross basis: an
 * unbilled commission item of Direct Bill Processing, FR-PCL-042).
 */
export async function billDeclaration(id, user) {
  const d = await getDeclarationRow(id);
  if (d.status !== 'submitted') throw conflict(d.status === 'nil' ? 'A nil declaration has no premium to bill' : `Declaration ${d.declaration_number} is ${d.status}: submit it first`);
  if (!d.policy_id) throw conflict('The open cover has no policy');
  const parcel = d.cover_type === 'parcel';
  if (parcel && !(Number(d.charge_total) > 0)) throw conflict(`Declaration ${d.declaration_number} has nothing to bill: its reversals are returned on the next bill`);
  return withTransaction(async (db) => {
    const locked = (await db.query('SELECT status FROM open_cover_declarations WHERE id = $1 FOR UPDATE', [d.id])).rows[0];
    if (locked.status !== 'submitted') throw conflict('The declaration was billed by another request');
    const premium = Number(d.premium);
    const rcv = parcel
      ? await createReceivable(db, {
        policyId: d.policy_id, amount: Number(d.charge_total), serviceFee: Math.max(Number(d.service_fee), 0), basis: d.remittance_basis, source: 'declaration', reference: d.declaration_number,
        user: { id: user.id }, breakdown: { netPremium: premium, commissionAmount: Number(d.commission) },
      })
      : await createReceivable(db, {
        policyId: d.policy_id, amount: Number(d.gross_premium), basis: d.remittance_basis, source: 'declaration', reference: d.declaration_number, user: { id: user.id },
        breakdown: { netPremium: premium, vat: Number(d.vat), dst: Number(d.dst), lgt: Number(d.lgt), other: Number(d.other_charges),
          ...(d.commission_rate == null ? {} : { commissionAmount: round2(premium * Number(d.commission_rate)) }) },
      });
    await db.query(`UPDATE open_cover_declarations SET status = 'billed', receivable_id = $2, bill_number = $3, billed_at = now(), billed_by = $4, updated_at = now() WHERE id = $1`,
      [d.id, rcv.id, rcv.bill_number, user.id]);
    // the open policy shows the premium billed so far (a parcel bill's service fee is the broker's, not premium)
    const policyPremium = parcel ? premium : Number(d.gross_premium);
    const commission = parcel ? Number(d.commission) : Number(rcv.commission_amount || 0);
    await db.query(`UPDATE policies SET premium_total = premium_total + $2, net_premium = net_premium + $3, commission_amount = commission_amount + $4, updated_at = now() WHERE id = $1`,
      [d.policy_id, policyPremium, premium, commission]);
    return { receivableId: rcv.id, billNumber: rcv.bill_number, amount: Number(rcv.amount), premium, serviceFee: parcel ? Number(d.service_fee) : 0, remittanceBasis: d.remittance_basis };
  });
}

/** Delete a draft declaration (its items go back to undeclared, its days to no month). */
export async function deleteDeclaration(id) {
  const d = await getDeclarationRow(id);
  if (d.status !== 'draft') throw conflict(`Declaration ${d.declaration_number} is ${d.status}`);
  await withTransaction(async (db) => {
    await db.query('UPDATE open_cover_certificates SET declaration_id = NULL WHERE declaration_id = $1', [d.id]);
    await db.query('UPDATE open_cover_certificates SET reversal_declaration_id = NULL WHERE reversal_declaration_id = $1', [d.id]);
    await db.query('UPDATE open_cover_daily_declarations SET monthly_declaration_id = NULL WHERE monthly_declaration_id = $1', [d.id]);
    await db.query('DELETE FROM open_cover_declarations WHERE id = $1', [d.id]);
  });
  return declarationOut(d);
}
