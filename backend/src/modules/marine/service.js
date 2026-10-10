/**
 * Open covers (Operations > Marine Open Covers): parcel and courier for TISPH; marine cargo is a future-release
 * feature (modules/features, marine-cargo).
 *
 * Contract: a client's open cover with an insurer for a period, the goods and voyages it covers, a rate and a limit per
 * conveyance (any one sending), the mark-up on invoice value and a minimum premium per certificate. Activating the
 * contract issues its open policy without a bill (policies/service.js#issuePolicy, billLater).
 *
 * Certificates: one per shipment, within the period and the limit of its conveyance; premium = insured value x rate,
 * at least the minimum premium. Shipments sent without a certificate are entered as declared items.
 *
 * Declarations: per period (monthly or quarterly), the certificates and declared items of the period, with the premium
 * taxes of the MARINE line (premium tax and charge engine). Billing a declaration raises the bill on the open policy
 * (premium receivable, booking journal, collection item); collection and remittance to the insurer follow as for any bill.
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

export const coverOut = (r) => r && ({
  id: r.id, coverNumber: r.cover_number, clientId: r.client_id, clientName: r.client_name ?? null, clientCode: r.client_code ?? null,
  insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name ?? null, productId: r.product_id, policyId: r.policy_id, policyNumber: r.policy_number ?? null,
  insurerReference: r.insurer_reference, periodFrom: r.period_from, periodTo: r.period_to, goodsDescription: r.goods_description, voyageScope: r.voyage_scope,
  clauses: r.clauses, currency: r.currency, rates: (r.rates || []).map((x) => ({ conveyance: x.conveyance, ratePercent: Number(x.ratePercent), limit: Number(x.limit) })),
  markupPercent: Number(r.markup_percent), minimumPremium: Number(r.minimum_premium), estimatedAnnualValue: r.estimated_annual_value == null ? null : Number(r.estimated_annual_value),
  declarationFrequency: r.declaration_frequency, commissionRate: r.commission_rate == null ? null : Number(r.commission_rate), status: r.status,
  certificates: r.certificate_count ?? undefined, declaredInsured: r.declared_insured == null ? undefined : Number(r.declared_insured),
  billedPremium: r.billed_premium == null ? undefined : Number(r.billed_premium), createdAt: r.created_at, updatedAt: r.updated_at,
});
export const certificateOut = (c) => ({
  id: c.id, certificateNumber: c.certificate_number, openCoverId: c.open_cover_id, declarationId: c.declaration_id, declarationNumber: c.declaration_number ?? null,
  kind: c.kind, shipmentDate: c.shipment_date, conveyance: c.conveyance, vesselName: c.vessel_name, voyageFrom: c.voyage_from, voyageTo: c.voyage_to,
  billOfLading: c.bill_of_lading, goodsDescription: c.goods_description, packing: c.packing, consignee: c.consignee, invoiceValue: Number(c.invoice_value),
  markupPercent: Number(c.markup_percent), insuredValue: Number(c.insured_value), ratePercent: Number(c.rate_percent), premium: Number(c.premium), status: c.status,
  cancelReason: c.cancel_reason, issuedAt: c.issued_at, issuedBy: c.issued_by_name ?? c.issued_by,
});
export const declarationOut = (d) => ({
  id: d.id, declarationNumber: d.declaration_number, openCoverId: d.open_cover_id, period: d.period, periodFrom: d.period_from, periodTo: d.period_to,
  shipments: d.shipments, totalInsured: Number(d.total_insured), premium: Number(d.premium), vat: Number(d.vat), dst: Number(d.dst), lgt: Number(d.lgt),
  otherCharges: Number(d.other_charges), grossPremium: Number(d.gross_premium), status: d.status, receivableId: d.receivable_id, billNumber: d.bill_number,
  billBalance: d.bill_balance == null ? null : Number(d.bill_balance), notes: d.notes, dueOn: d.due_on ?? null, submittedAt: d.submitted_at, billedAt: d.billed_at, createdAt: d.created_at,
});

const SELECT = `SELECT o.*, c.display_name AS client_name, c.client_code, ic.name AS insurer_name, p.policy_number,
  (SELECT pr.name FROM products pr WHERE pr.id = o.product_id) AS product_name,
  (SELECT count(*)::int FROM open_cover_certificates x WHERE x.open_cover_id = o.id AND x.status <> 'cancelled') AS certificate_count,
  (SELECT COALESCE(sum(x.insured_value), 0) FROM open_cover_certificates x WHERE x.open_cover_id = o.id AND x.status <> 'cancelled') AS declared_insured,
  (SELECT COALESCE(sum(d.gross_premium), 0) FROM open_cover_declarations d WHERE d.open_cover_id = o.id AND d.status = 'billed') AS billed_premium
  FROM open_covers o JOIN clients c ON c.id = o.client_id JOIN insurance_companies ic ON ic.id = o.insurance_company_id LEFT JOIN policies p ON p.id = o.policy_id`;
const CERT_SELECT = `SELECT x.*, d.declaration_number, u.display_name AS issued_by_name FROM open_cover_certificates x
  LEFT JOIN open_cover_declarations d ON d.id = x.declaration_id LEFT JOIN users u ON u.id = x.issued_by`;

export async function listCovers(q = {}) {
  return (await many(`${SELECT} WHERE ($1::text IS NULL OR o.status = $1) AND ($2::text IS NULL OR o.cover_number ILIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $2 || '%'
    OR p.policy_number ILIKE '%' || $2 || '%') ORDER BY o.created_at DESC LIMIT 500`, [q.status || null, q.search || null])).map(coverOut);
}

export async function getCoverRow(id, db = { query }) {
  const r = (await db.query(`${SELECT} WHERE o.id = $1 OR o.cover_number = $1`, [String(id)])).rows[0];
  if (!r) throw notFound('Open cover not found');
  return r;
}

export async function getCover(id) {
  const r = await getCoverRow(id);
  const certificates = (await many(`${CERT_SELECT} WHERE x.open_cover_id = $1 ORDER BY x.shipment_date DESC, x.certificate_number DESC`, [r.id])).map(certificateOut);
  const dueDays = Number(await getSetting('marine.declaration_due_days', 15));
  const declarations = (await many(`SELECT d.*, rc.balance AS bill_balance FROM open_cover_declarations d LEFT JOIN receivables rc ON rc.id = d.receivable_id
    WHERE d.open_cover_id = $1 ORDER BY d.period DESC`, [r.id])).map((d) => declarationOut({ ...d, due_on: addDays(String(d.period_to).slice(0, 10), dueDays) }));
  return { ...coverOut(r), certificateList: certificates, declarations };
}

async function validRates(rates) {
  const allowed = (await getSetting('marine.conveyances', ['Sea', 'Air', 'Land'])) || [];
  const errors = [];
  if (!Array.isArray(rates) || !rates.length) errors.push({ path: 'rates', message: 'At least one conveyance with its rate and limit is required' });
  const seen = new Set();
  for (const [i, r] of (rates || []).entries()) {
    if (!allowed.includes(r.conveyance)) errors.push({ path: `rates.${i}.conveyance`, message: `Conveyance must be one of ${allowed.join(', ')}` });
    if (seen.has(r.conveyance)) errors.push({ path: `rates.${i}.conveyance`, message: `${r.conveyance} is listed twice` });
    seen.add(r.conveyance);
    if (!(num(r.ratePercent) > 0)) errors.push({ path: `rates.${i}.ratePercent`, message: 'The rate must be greater than zero' });
    if (!(num(r.limit) > 0)) errors.push({ path: `rates.${i}.limit`, message: 'The limit per conveyance must be greater than zero' });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  return rates.map((r) => ({ conveyance: r.conveyance, ratePercent: num(r.ratePercent), limit: num(r.limit) }));
}

export async function createCover(b, userId) {
  const client = await one('SELECT id FROM clients WHERE id = $1 OR client_code = $1', [String(b.clientId)]);
  if (!client) throw badRequest('Validation failed', [{ path: 'clientId', message: 'Client not found' }]);
  if (!(await one('SELECT 1 FROM insurance_companies WHERE id = $1', [b.insuranceCompanyId]))) throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: 'Unknown insurer' }]);
  const from = isoDate(b.periodFrom);
  const to = isoDate(b.periodTo);
  if (!from || !to || to <= from) throw badRequest('Validation failed', [{ path: 'periodTo', message: 'The period must end after it starts' }]);
  const rates = await validRates(b.rates);
  // marine cargo is a future-release feature (modules/features): the open covers of TISPH are parcel and courier
  const cargo = await isFeatureOn('marine-cargo');
  const productId = b.productId || (await one('SELECT id FROM products WHERE upper(code) = $1 LIMIT 1', [cargo ? 'MARINE' : 'PARCEL']))?.id || null;
  if (!cargo && b.productId && (await one('SELECT upper(code) AS code FROM products WHERE id = $1', [b.productId]))?.code === 'MARINE') {
    throw refused('FEATURE_NOT_ENABLED', 'Marine cargo open covers are not available in this edition');
  }
  const number = await nextDocumentNumber('open_cover', { unique: { table: 'open_covers', column: 'cover_number' } });
  const r = await one(`INSERT INTO open_covers(cover_number, client_id, insurance_company_id, product_id, insurer_reference, period_from, period_to, goods_description, voyage_scope,
      clauses, currency, rates, markup_percent, minimum_premium, estimated_annual_value, declaration_frequency, commission_rate, owner_user_id, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18,$18) RETURNING id`,
  [number, client.id, b.insuranceCompanyId, productId, b.insurerReference || null, from, to, b.goodsDescription, b.voyageScope || null, b.clauses || null,
    b.currency || 'PHP', JSON.stringify(rates), b.markupPercent ?? Number(await getSetting('marine.default_markup_percent', 10)), num(b.minimumPremium),
    b.estimatedAnnualValue ?? null, b.declarationFrequency || 'monthly', b.commissionRate ?? null, userId]);
  return getCover(r.id);
}

/** A draft contract changes freely; an active one only its clauses, contact terms, rates and limits for new certificates. */
export async function updateCover(id, b, userId) {
  const before = await getCoverRow(id);
  if (['expired', 'cancelled'].includes(before.status)) throw conflict(`Open cover ${before.cover_number} is ${before.status}`);
  const draft = before.status === 'draft';
  if (!draft && ['clientId', 'insuranceCompanyId', 'periodFrom', 'currency'].some((k) => b[k] !== undefined)) {
    throw conflict('The client, insurer, start date and currency of an active open cover cannot change');
  }
  const rates = b.rates !== undefined ? JSON.stringify(await validRates(b.rates)) : null;
  const to = b.periodTo ? isoDate(b.periodTo) : before.period_to;
  const from = draft && b.periodFrom ? isoDate(b.periodFrom) : before.period_from;
  if (to <= from) throw badRequest('Validation failed', [{ path: 'periodTo', message: 'The period must end after it starts' }]);
  await query(`UPDATE open_covers SET period_from = $2, period_to = $3, goods_description = COALESCE($4, goods_description), voyage_scope = COALESCE($5, voyage_scope),
      clauses = COALESCE($6, clauses), rates = COALESCE($7::jsonb, rates), markup_percent = COALESCE($8, markup_percent), minimum_premium = COALESCE($9, minimum_premium),
      estimated_annual_value = COALESCE($10, estimated_annual_value), declaration_frequency = COALESCE($11, declaration_frequency), commission_rate = COALESCE($12, commission_rate),
      insurer_reference = COALESCE($13, insurer_reference), insurance_company_id = COALESCE($14, insurance_company_id), updated_by = $15, updated_at = now() WHERE id = $1`,
  [before.id, from, to, b.goodsDescription ?? null, b.voyageScope ?? null, b.clauses ?? null, rates, b.markupPercent ?? null, b.minimumPremium ?? null,
    b.estimatedAnnualValue ?? null, b.declarationFrequency ?? null, b.commissionRate ?? null, b.insurerReference ?? null, draft ? (b.insuranceCompanyId ?? null) : null, userId]);
  if (!draft && b.periodTo && before.policy_id) await query('UPDATE policies SET expiry_date = $2, updated_at = now() WHERE id = $1', [before.policy_id, to]);
  return { before: coverOut(before), after: await getCover(before.id) };
}

/** Activate the contract: its open policy is issued without a bill (billed on the declarations). */
export async function activateCover(id, user) {
  const c = await getCoverRow(id);
  if (c.status !== 'draft') throw conflict(`Open cover ${c.cover_number} is ${c.status}`);
  return withTransaction(async (db) => {
    const issued = await issuePolicy(db, {
      clientId: c.client_id, productId: c.product_id, insuranceCompanyId: c.insurance_company_id, ownerUserId: c.owner_user_id || user.id, agentUserId: c.owner_user_id || user.id,
      sumInsured: num(c.estimated_annual_value), netPremium: 0, grossPremium: 0, commissionAmount: 0, commissionRate: c.commission_rate == null ? null : Number(c.commission_rate),
      currency: c.currency, insuredName: c.client_name, productType: c.product_name || 'Marine Cargo', lob: 'MARINE', billLater: true,
      doc: { source: 'open-cover', openCoverId: c.id, coverNumber: c.cover_number, isOpenCover: true, insurerReference: c.insurer_reference,
        riskDetails: { goods: c.goods_description, voyages: c.voyage_scope, conveyances: (c.rates || []).map((r) => `${r.conveyance} ${r.ratePercent}% up to ${r.limit}`).join('; ') } },
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

/** Rate, insured value and premium of a shipment under the cover (refused above the limit of its conveyance). */
export function priceShipment(cover, s) {
  const rate = (cover.rates || []).find((r) => r.conveyance === s.conveyance);
  if (!rate) throw badRequest('Validation failed', [{ path: 'conveyance', message: `The open cover has no rate for ${s.conveyance}` }]);
  const invoice = num(s.invoiceValue);
  if (!(invoice > 0)) throw badRequest('Validation failed', [{ path: 'invoiceValue', message: 'The invoice value must be greater than zero' }]);
  const markup = s.markupPercent !== undefined && s.markupPercent !== null && s.markupPercent !== '' ? num(s.markupPercent) : num(cover.markup_percent);
  const insured = round2(invoice * (1 + markup / 100));
  if (insured > num(rate.limit)) {
    throw badRequest('Validation failed', [{ path: 'invoiceValue', message: `Insured value ${insured.toFixed(2)} exceeds the ${s.conveyance} limit per conveyance ${num(rate.limit).toFixed(2)}: refer the shipment to the insurer` }]);
  }
  const premium = round2(Math.max(insured * num(rate.ratePercent) / 100, num(cover.minimum_premium)));
  return { markup, insured, rate: num(rate.ratePercent), premium };
}

/** Issue a certificate (kind certificate) or enter a shipment declared without one (kind declared). */
export async function issueCertificate(coverId, b, userId, kind = 'certificate') {
  const c = await getCoverRow(coverId);
  if (c.status !== 'active') throw conflict(`Open cover ${c.cover_number} is ${c.status}: certificates are issued on an active cover`);
  const date = isoDate(b.shipmentDate);
  if (!date || date < c.period_from || date > c.period_to) throw badRequest('Validation failed', [{ path: 'shipmentDate', message: `The shipment date must fall within ${c.period_from} to ${c.period_to}` }]);
  const priced = priceShipment(c, b);
  for (const k of ['voyageFrom', 'voyageTo']) if (!b[k]) throw badRequest('Validation failed', [{ path: k, message: `${k} is required` }]);
  const number = await nextDocumentNumber('marine_certificate', { unique: { table: 'open_cover_certificates', column: 'certificate_number' } });
  const r = await one(`INSERT INTO open_cover_certificates(certificate_number, open_cover_id, kind, shipment_date, conveyance, vessel_name, voyage_from, voyage_to, bill_of_lading,
      goods_description, packing, consignee, invoice_value, markup_percent, insured_value, rate_percent, premium, issued_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
  [number, c.id, kind, date, b.conveyance, b.vesselName || null, b.voyageFrom, b.voyageTo, b.billOfLading || null, b.goodsDescription || c.goods_description, b.packing || null,
    b.consignee || null, num(b.invoiceValue), priced.markup, priced.insured, priced.rate, priced.premium, userId]);
  // a shipment of a period whose declaration is still open joins it
  const decl = await one("SELECT id FROM open_cover_declarations WHERE open_cover_id = $1 AND status = 'draft' AND $2::date BETWEEN period_from AND period_to", [c.id, date]);
  if (decl) await recompute(decl.id);
  return certificateOut(await one(`${CERT_SELECT} WHERE x.id = $1`, [r.id]));
}

export async function getCertificateRow(id) {
  const r = await one(`${CERT_SELECT} WHERE x.id = $1 OR x.certificate_number = $1`, [String(id)]);
  if (!r) throw notFound('Certificate not found');
  return r;
}

export async function cancelCertificate(id, reason, userId) {
  const x = await getCertificateRow(id);
  if (x.status === 'cancelled') throw conflict('The certificate is already cancelled');
  const decl = x.declaration_id ? await one('SELECT status FROM open_cover_declarations WHERE id = $1', [x.declaration_id]) : null;
  if (decl && decl.status !== 'draft') throw conflict(`Certificate ${x.certificate_number} is on a ${decl.status} declaration`);
  await query("UPDATE open_cover_certificates SET status = 'cancelled', cancel_reason = $2, declaration_id = NULL, updated_at = now() WHERE id = $1", [x.id, `${reason} (${userId || 'user'})`]);
  if (x.declaration_id) await recompute(x.declaration_id);
  return certificateOut(await getCertificateRow(x.id));
}

/** First and last day of a declaration period (YYYY-MM; a quarter starts on its first month). */
function periodRange(period, frequency) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period))) throw badRequest('Validation failed', [{ path: 'period', message: 'period must be YYYY-MM' }]);
  const [y, m] = period.split('-').map(Number);
  const months = frequency === 'quarterly' ? 3 : 1;
  if (months === 3 && (m - 1) % 3 !== 0) throw badRequest('Validation failed', [{ path: 'period', message: 'A quarterly declaration starts in January, April, July or October' }]);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m - 1 + months, 0)).toISOString().slice(0, 10);
  return { from, to };
}

/** Totals of a draft declaration from the certificates and declared items of its period, with the premium taxes. */
async function recompute(declarationId, db = { query }) {
  const d = (await db.query('SELECT d.*, o.product_id FROM open_cover_declarations d JOIN open_covers o ON o.id = d.open_cover_id WHERE d.id = $1', [declarationId])).rows[0];
  if (d.status !== 'draft') return d;
  await db.query(`UPDATE open_cover_certificates SET declaration_id = $1, updated_at = now() WHERE open_cover_id = $2 AND status <> 'cancelled' AND declaration_id IS NULL
    AND shipment_date BETWEEN $3 AND $4`, [d.id, d.open_cover_id, d.period_from, d.period_to]);
  const t = (await db.query(`SELECT count(*)::int AS n, COALESCE(sum(insured_value), 0) AS insured, COALESCE(sum(premium), 0) AS premium
    FROM open_cover_certificates WHERE declaration_id = $1 AND status <> 'cancelled'`, [d.id])).rows[0];
  const premium = round2(Number(t.premium));
  const c = premium > 0 ? await quotationCharges({ productId: d.product_id }, premium, 'MARINE', db) : null;
  const tax = c ? c.tax : { valueAddedTax: 0, documentaryStampTax: 0, localGovernmentTax: 0, fireServiceTax: 0 };
  const other = c ? round2(num(c.others) + num(tax.fireServiceTax)) : 0;
  const gross = round2(premium + num(tax.valueAddedTax) + num(tax.documentaryStampTax) + num(tax.localGovernmentTax) + other);
  await db.query(`UPDATE open_cover_declarations SET shipments = $2, total_insured = $3, premium = $4, vat = $5, dst = $6, lgt = $7, other_charges = $8, gross_premium = $9, updated_at = now()
    WHERE id = $1`, [d.id, t.n, round2(Number(t.insured)), premium, round2(tax.valueAddedTax), round2(tax.documentaryStampTax), round2(tax.localGovernmentTax), other, gross]);
  return (await db.query('SELECT * FROM open_cover_declarations WHERE id = $1', [d.id])).rows[0];
}

export async function getDeclarationRow(id) {
  const d = await one(`SELECT d.*, rc.balance AS bill_balance, o.cover_number, o.client_id, o.policy_id, o.currency, o.commission_rate FROM open_cover_declarations d
    JOIN open_covers o ON o.id = d.open_cover_id LEFT JOIN receivables rc ON rc.id = d.receivable_id WHERE d.id = $1 OR d.declaration_number = $1`, [String(id)]);
  if (!d) throw notFound('Declaration not found');
  return d;
}

export async function getDeclaration(id) {
  const d = await getDeclarationRow(id);
  const items = (await many(`${CERT_SELECT} WHERE x.declaration_id = $1 ORDER BY x.shipment_date, x.certificate_number`, [d.id])).map(certificateOut);
  return { ...declarationOut(d), coverNumber: d.cover_number, items };
}

/** Open the declaration of a period: the shipments of the period are attached and priced. */
export async function createDeclaration(coverId, period, userId) {
  const c = await getCoverRow(coverId);
  if (!['active', 'expired'].includes(c.status)) throw conflict(`Open cover ${c.cover_number} is ${c.status}`);
  const { from, to } = periodRange(period, c.declaration_frequency);
  if (to < c.period_from || from > c.period_to) throw badRequest('Validation failed', [{ path: 'period', message: 'The period is outside the open cover' }]);
  if (await one('SELECT 1 FROM open_cover_declarations WHERE open_cover_id = $1 AND period = $2', [c.id, period])) throw conflict(`The declaration of ${period} already exists`);
  const number = await nextDocumentNumber('marine_declaration', { unique: { table: 'open_cover_declarations', column: 'declaration_number' } });
  const r = await one(`INSERT INTO open_cover_declarations(declaration_number, open_cover_id, period, period_from, period_to, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [number, c.id, period, from, to, userId]);
  await recompute(r.id);
  return getDeclaration(r.id);
}

export async function refreshDeclaration(id) {
  const d = await getDeclarationRow(id);
  if (d.status !== 'draft') throw conflict(`Declaration ${d.declaration_number} is ${d.status}`);
  await recompute(d.id);
  return getDeclaration(d.id);
}

/** Submit the declaration (the client's statement of shipments for the period); a declaration without shipments is a nil return. */
export async function submitDeclaration(id, { notes = null } = {}, userId) {
  const d = await getDeclarationRow(id);
  if (d.status !== 'draft') throw conflict(`Declaration ${d.declaration_number} is ${d.status}`);
  const fresh = await recompute(d.id);
  const status = fresh.shipments ? 'submitted' : 'nil';
  await query('UPDATE open_cover_declarations SET status = $2, notes = COALESCE($3, notes), submitted_at = now(), submitted_by = $4, updated_at = now() WHERE id = $1', [d.id, status, notes, userId]);
  await query("UPDATE open_cover_certificates SET status = 'declared', updated_at = now() WHERE declaration_id = $1 AND status = 'issued'", [d.id]);
  return getDeclaration(d.id);
}

/** Bill the declaration on the open policy: premium receivable, booking journal and collection item. */
export async function billDeclaration(id, user) {
  const d = await getDeclarationRow(id);
  if (d.status !== 'submitted') throw conflict(d.status === 'nil' ? 'A nil declaration has no premium to bill' : `Declaration ${d.declaration_number} is ${d.status}: submit it first`);
  if (!d.policy_id) throw conflict('The open cover has no policy');
  return withTransaction(async (db) => {
    const locked = (await db.query('SELECT status FROM open_cover_declarations WHERE id = $1 FOR UPDATE', [d.id])).rows[0];
    if (locked.status !== 'submitted') throw conflict('The declaration was billed by another request');
    const premium = Number(d.premium);
    const rcv = await createReceivable(db, {
      policyId: d.policy_id, amount: Number(d.gross_premium), source: 'declaration', reference: d.declaration_number, user: { id: user.id },
      breakdown: { netPremium: premium, vat: Number(d.vat), dst: Number(d.dst), lgt: Number(d.lgt), other: Number(d.other_charges),
        ...(d.commission_rate == null ? {} : { commissionAmount: round2(premium * Number(d.commission_rate)) }) },
    });
    await db.query(`UPDATE open_cover_declarations SET status = 'billed', receivable_id = $2, bill_number = $3, billed_at = now(), billed_by = $4, updated_at = now() WHERE id = $1`,
      [d.id, rcv.id, rcv.bill_number, user.id]);
    // the open policy shows what has been billed so far
    await db.query(`UPDATE policies SET premium_total = premium_total + $2, net_premium = net_premium + $3, commission_amount = commission_amount + $4, updated_at = now() WHERE id = $1`,
      [d.policy_id, Number(d.gross_premium), premium, Number(rcv.commission_amount || 0)]);
    return { receivableId: rcv.id, billNumber: rcv.bill_number, amount: Number(rcv.amount) };
  });
}

/** Delete a draft declaration (its shipments go back to undeclared). */
export async function deleteDeclaration(id) {
  const d = await getDeclarationRow(id);
  if (d.status !== 'draft') throw conflict(`Declaration ${d.declaration_number} is ${d.status}`);
  await query('UPDATE open_cover_certificates SET declaration_id = NULL WHERE declaration_id = $1', [d.id]);
  await query('DELETE FROM open_cover_declarations WHERE id = $1', [d.id]);
  return declarationOut(d);
}
