/**
 * Package quotations (Operations > Sales & Marketing > Package Bundles): a bundle priced for a client or lead.
 *
 * Pricing (priceBundle): every included section is priced with its insurer (the section's default carrier unless
 * another allowed one is chosen): the insurer's rate table in force for the product when there is one, else the
 * section's rate and minimum premium. The bundle discount % is taken on the total premium and spread over the sections
 * in proportion to their premium (largest remainder, so it adds up to the cent). Each section then gets its own taxes
 * and charges (premium-charges engine: FST only on property sections; flat charges once, on the first section) and its
 * own commission (the rate table's commission rate, else the Commission Rate Matrix).
 */
import { query, withTransaction } from '../../db/pool.js';
import { baseCurrency } from '../../lib/currency.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, today, isoDate } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { allocate } from '../accounting/lib/coinsurance.js';
import { chargesFor, lguFor, rulesInForce } from '../premium-charges/service.js';
import { sumCharges } from '../premium-charges/calculator.js';
import { getBundle } from './bundles.js';
import { commissionRateFor, premiumOnRate, rateTableFor } from './rateTables.js';

const run = (db) => db || { query };
const AMOUNT_KEYS = ['sumInsured', 'basePremium', 'discountAmount', 'netPremium', 'vat', 'premiumTax', 'dst', 'fst', 'lgt', 'otherCharges', 'totalCharges', 'totalAmount', 'commissionAmount'];

/** Totals of priced sections. */
export function totalsOf(sections) {
  const t = Object.fromEntries(AMOUNT_KEYS.map((k) => [k, round2(sections.reduce((s, x) => s + (Number(x[k]) || 0), 0))]));
  t.charges = sumCharges(sections.map((s) => ({ premium: s.netPremium, lines: s.charges, vat: s.vat, premiumTax: s.premiumTax, dst: s.dst, fst: s.fst, lgt: s.lgt,
    other: s.otherCharges, taxes: round2(s.vat + s.premiumTax + s.dst + s.fst + s.lgt), totalCharges: s.totalCharges, total: s.totalAmount }))).lines;
  return t;
}

/**
 * Price a bundle: { bundle, date, lgu, discountPercent, sections: [...], totals }. input: { sections: [{ sectionNo,
 * included, insuranceCompanyId, sumInsured }], lguCode, city, date (inception), renewal }.
 */
export async function priceBundle(db, bundle, { sections: given = [], lguCode = null, city = null, date = null, renewal = false } = {}) {
  const on = isoDate(date) || (await today());
  const inputs = new Map((given || []).map((s) => [Number(s.sectionNo), s]));
  const rules = await rulesInForce(on, db);
  const lgu = await lguFor({ lguCode, city }, on, db);
  if ((lguCode || city) && !lgu) throw badRequest('Validation failed', [{ path: 'lguCode', message: `No LGU tax rate in force for ${lguCode || city}` }]);
  const chosen = [];
  for (const s of bundle.sections) {
    const inp = inputs.get(s.sectionNo) || {};
    if (!s.optional && inp.included === false) throw badRequest('Validation failed', [{ path: `sections.${s.sectionNo}`, message: `${s.name} is a compulsory section of ${bundle.name}` }]);
    if (s.optional && inp.included !== true) continue;
    const insurerId = Number(inp.insuranceCompanyId || s.insurerIds[0]);
    if (!s.insurerIds.includes(insurerId)) {
      throw badRequest('Validation failed', [{ path: `sections.${s.sectionNo}.insuranceCompanyId`, message: `Insurer ${insurerId} does not carry the ${s.name} section of ${bundle.name}` }]);
    }
    const sumInsured = round2(inp.sumInsured ?? s.defaultSumInsured);
    if (!(sumInsured > 0)) throw badRequest('Validation failed', [{ path: `sections.${s.sectionNo}.sumInsured`, message: `${s.name}: the sum insured must be greater than zero` }]);
    const table = await rateTableFor(db, insurerId, s.productId, on);
    const basis = table || { rateBasis: 'percent', rate: s.ratePercent, minimumPremium: s.minimumPremium };
    const p = premiumOnRate(basis, sumInsured);
    chosen.push({ s, insurerId, sumInsured, table, basis, p });
  }
  if (!chosen.length) throw badRequest('Validation failed', [{ path: 'sections', message: 'Include at least one section' }]);
  const names = new Map((await run(db).query('SELECT id, name FROM insurance_companies WHERE id = ANY($1)', [chosen.map((c) => c.insurerId)])).rows.map((r) => [r.id, r.name]));
  const pct = Number(bundle.discountPercent) || 0;
  const base = round2(chosen.reduce((sum, c) => sum + c.p.premium, 0));
  const discounts = allocate(round2((base * pct) / 100), chosen.map((c) => c.p.premium));
  const flatFirst = (await getSetting('packages.flat_charges_on_first_section', true)) !== false;
  const sections = [];
  for (const [i, c] of chosen.entries()) {
    const net = round2(c.p.premium - discounts[i]);
    const ch = await chargesFor({ premium: net, productId: c.s.productId, property: c.s.property ?? null, date: on, rules, lgu, includeFlat: flatFirst ? i === 0 : true }, db);
    const comm = await commissionRateFor({ rateTable: c.table, insurerId: c.insurerId, productId: c.s.productId, lob: c.s.productLine, date: on, renewal }, db);
    sections.push({
      sectionNo: c.s.sectionNo, name: c.s.name, productId: c.s.productId, productName: c.s.productName, line: ch.line, insuranceCompanyId: c.insurerId,
      insurerName: names.get(c.insurerId) || null, rateTableId: c.table?.id || null, sumInsured: c.sumInsured, rateBasis: c.basis.rateBasis, rate: Number(c.basis.rate),
      minimumApplied: c.p.minimumApplied, basePremium: c.p.premium, discountAmount: discounts[i], netPremium: net,
      vat: ch.vat, premiumTax: ch.premiumTax, dst: ch.dst, fst: ch.fst, lgt: ch.lgt, otherCharges: ch.other, totalCharges: ch.totalCharges, totalAmount: ch.total,
      commissionRate: comm.rate, commissionAmount: round2(net * comm.rate), charges: ch.lines, deductible: c.table?.deductible || null,
      benefits: [...(c.s.benefits || []), ...(c.table?.keyBenefits || [])], property: c.s.property ?? null,
    });
  }
  return { bundle: { id: bundle.id, code: bundle.code, name: bundle.name, termMonths: bundle.termMonths, autoIssue: bundle.autoIssue }, date: on, discountPercent: pct,
    lgu: lgu ? { code: lgu.code, name: lgu.name, rate: lgu.rate } : null, sections, totals: totalsOf(sections), currency: await baseCurrency() };
}

// ------------------------------------------------------------------ sections storage

export const sectionOut = (r) => ({
  sectionNo: r.section_no, name: r.name, productId: r.product_id, productName: r.product_name || null, line: r.line, insuranceCompanyId: r.insurance_company_id,
  insurerName: r.insurer_name || null, rateTableId: r.rate_table_id, sumInsured: Number(r.sum_insured), rateBasis: r.rate_basis, rate: Number(r.rate),
  basePremium: Number(r.base_premium), discountAmount: Number(r.discount_amount), netPremium: Number(r.net_premium), vat: Number(r.vat), premiumTax: Number(r.premium_tax),
  dst: Number(r.dst), fst: Number(r.fst), lgt: Number(r.lgt), otherCharges: Number(r.other_charges), totalCharges: Number(r.total_charges), totalAmount: Number(r.total_amount),
  commissionRate: Number(r.commission_rate), commissionAmount: Number(r.commission_amount), charges: r.charges || [], deductible: r.deductible, benefits: r.benefits || [],
  property: r.property, insurerReference: r.insurer_reference, status: r.status,
});

export async function sectionsOf(entityType, entityId, db = null) {
  return (await run(db).query(`SELECT s.*, ic.name AS insurer_name, p.name AS product_name FROM package_sections s
    JOIN insurance_companies ic ON ic.id = s.insurance_company_id JOIN products p ON p.id = s.product_id
    WHERE s.entity_type = $1 AND s.entity_id = $2 ORDER BY s.section_no`, [entityType, String(entityId)])).rows.map(sectionOut);
}

export async function writeSections(db, entityType, entityId, sections) {
  await db.query('DELETE FROM package_sections WHERE entity_type = $1 AND entity_id = $2', [entityType, String(entityId)]);
  for (const s of sections) {
    await db.query(`INSERT INTO package_sections(entity_type, entity_id, section_no, name, product_id, line, insurance_company_id, rate_table_id, sum_insured, rate_basis, rate,
        base_premium, discount_amount, net_premium, vat, premium_tax, dst, fst, lgt, other_charges, total_charges, total_amount, commission_rate, commission_amount, charges,
        deductible, benefits, property, insurer_reference)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
    [entityType, String(entityId), s.sectionNo, s.name, s.productId, s.line, s.insuranceCompanyId, s.rateTableId, s.sumInsured, s.rateBasis, s.rate, s.basePremium,
      s.discountAmount, s.netPremium, s.vat, s.premiumTax, s.dst, s.fst, s.lgt, s.otherCharges, s.totalCharges, s.totalAmount, s.commissionRate, s.commissionAmount,
      JSON.stringify(s.charges || []), s.deductible || null, JSON.stringify(s.benefits || []), s.property ?? null, s.insurerReference || null]);
  }
}

// ------------------------------------------------------------------ package quotations

const QUOTE_SELECT = `SELECT pq.*, b.name AS bundle_name, b.code AS bundle_code, c.display_name AS client_name, c.client_code,
    l.display_name AS lead_name, pol.policy_number, (SELECT u.display_name FROM users u WHERE u.id = pq.created_by) AS created_by_name
  FROM package_quotes pq JOIN package_bundles b ON b.id = pq.bundle_id LEFT JOIN clients c ON c.id = pq.client_id
  LEFT JOIN leads l ON l.id = pq.lead_id LEFT JOIN policies pol ON pol.id = pq.policy_id`;

export const quoteOut = (r, sections = null) => ({
  id: r.id, quoteNumber: r.quote_number, bundleId: r.bundle_id, bundleCode: r.bundle_code, bundleName: r.bundle_name, clientId: r.client_id, clientCode: r.client_code,
  clientName: r.client_name || null, leadId: r.lead_id, leadName: r.lead_name || null, insuredName: r.insured_name || r.client_name || r.lead_name || null, location: r.location,
  lguCode: r.lgu_code, inceptionDate: r.inception_date, status: r.status, discountPercent: Number(r.discount_percent), sumInsured: Number(r.sum_insured),
  basePremium: Number(r.base_premium), discountAmount: Number(r.discount_amount), netPremium: Number(r.net_premium), vat: Number(r.vat), premiumTax: Number(r.premium_tax),
  dst: Number(r.dst), fst: Number(r.fst), lgt: Number(r.lgt), otherCharges: Number(r.other_charges), totalCharges: Number(r.total_charges), totalAmount: Number(r.total_amount),
  commissionAmount: Number(r.commission_amount), currency: r.currency, validUntil: r.valid_until, renewalOf: r.renewal_of, policyId: r.policy_id, policyNumber: r.policy_number || null,
  remarks: r.remarks, charges: r.doc?.charges || [], lgu: r.doc?.lgu || null, createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  ...(sections ? { sections } : {}),
});

/** Package quotation row by id or number, visible to the scope (404 otherwise). */
export async function getQuoteRow(id, db = null, scope = null) {
  const params = [String(id)];
  const pred = scopeSql(scope, 'placement', 'pq', params);
  const r = (await run(db).query(`${QUOTE_SELECT} WHERE (pq.id = $1 OR pq.quote_number = $1) AND ${pred}`, params)).rows[0];
  if (!r) throw notFound('Package quotation not found');
  return r;
}

export async function getPackageQuote(id, { scope = null, db = null } = {}) {
  const r = await getQuoteRow(id, db, scope);
  return quoteOut(r, await sectionsOf('quote', r.id, db));
}

export async function listPackageQuotes(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('pq.status = ANY(?)', String(q.status).split(',').map((s) => s.trim()).filter(Boolean));
  if (q.clientId) add('pq.client_id = ?', q.clientId);
  if (q.bundleId) add('pq.bundle_id = ?', Number(q.bundleId));
  if (q.search) add("(pq.quote_number ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%' OR l.display_name ILIKE '%' || ? || '%' OR pol.policy_number ILIKE '%' || ? || '%' OR pq.insured_name ILIKE '%' || ? || '%')", q.search);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'placement', 'pq', params));
  const from = `FROM package_quotes pq JOIN package_bundles b ON b.id = pq.bundle_id LEFT JOIN clients c ON c.id = pq.client_id LEFT JOIN leads l ON l.id = pq.lead_id
    LEFT JOIN policies pol ON pol.id = pq.policy_id WHERE ${where.join(' AND ')}`;
  const total = (await query(`SELECT count(*)::int AS n ${from}`, params)).rows[0].n;
  const rows = (await query(`${QUOTE_SELECT} WHERE ${where.join(' AND ')} ORDER BY pq.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset])).rows;
  return { total, rows: rows.map((r) => quoteOut(r)) };
}

const priceColumns = (p) => ({
  discount_percent: p.discountPercent, sum_insured: p.totals.sumInsured, base_premium: p.totals.basePremium, discount_amount: p.totals.discountAmount, net_premium: p.totals.netPremium,
  vat: p.totals.vat, premium_tax: p.totals.premiumTax, dst: p.totals.dst, fst: p.totals.fst, lgt: p.totals.lgt, other_charges: p.totals.otherCharges,
  total_charges: p.totals.totalCharges, total_amount: p.totals.totalAmount, commission_amount: p.totals.commissionAmount, currency: p.currency,
});

async function checkParty(db, { clientId, leadId }) {
  if (!clientId && !leadId) throw badRequest('Validation failed', [{ path: 'clientId', message: 'Choose the client (or the prospect) to quote' }]);
  if (clientId && !(await db.query('SELECT 1 FROM clients WHERE id = $1', [clientId])).rowCount) throw badRequest('Validation failed', [{ path: 'clientId', message: `Client ${clientId} not found` }]);
  if (leadId && !(await db.query('SELECT 1 FROM leads WHERE id = $1 AND deleted_at IS NULL', [leadId])).rowCount) throw badRequest('Validation failed', [{ path: 'leadRefId', message: `Lead ${leadId} not found` }]);
}

/** Price without saving (the form's live preview). */
export async function previewPackage(b) {
  const bundle = await getBundle(b.bundleId);
  if (bundle.status !== 'active') throw badRequest(`Bundle ${bundle.name} is inactive`);
  return priceBundle(null, bundle, { sections: b.sections, lguCode: b.lguCode, city: b.city, date: b.inceptionDate });
}

/** Create a package quotation (inside the caller's transaction when db is given). */
export async function createPackageQuote(b, user, db = null) {
  const go = async (c) => {
    const bundle = await getBundle(b.bundleId, c);
    if (bundle.status !== 'active') throw badRequest(`Bundle ${bundle.name} is inactive`);
    const leadId = b.leadRefId || b.leadId || null;
    await checkParty(c, { clientId: b.clientId || null, leadId });
    const priced = await priceBundle(c, bundle, { sections: b.sections, lguCode: b.lguCode, city: b.city, date: b.inceptionDate, renewal: Boolean(b.renewalOf) });
    const number = await nextDocumentNumber('package_quote', { db: c, unique: { table: 'package_quotes', column: 'quote_number' } });
    const validity = Number(await getSetting('packages.quote_validity_days', 30)) || 30;
    const cols = {
      quote_number: number, bundle_id: bundle.id, client_id: b.clientId || null, lead_id: leadId, insured_name: b.insuredName || null, location: b.location || null,
      lgu_code: priced.lgu?.code || null, inception_date: priced.date, status: 'draft', ...priceColumns(priced), valid_until: addDays(await today(), validity),
      renewal_of: b.renewalOf || null, remarks: b.remarks || null, doc: JSON.stringify({ charges: priced.totals.charges, lgu: priced.lgu }),
      owner_user_id: b.ownerUserId || user?.id || null, created_by: user?.id ?? null, updated_by: user?.id ?? null,
    };
    const keys = Object.keys(cols);
    const r = await c.query(`INSERT INTO package_quotes(${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, Object.values(cols));
    await writeSections(c, 'quote', r.rows[0].id, priced.sections);
    return getPackageQuote(r.rows[0].id, { db: c });
  };
  return db ? go(db) : withTransaction(go);
}

/** Re-price and save a draft package quotation. */
export async function updatePackageQuote(id, b, user, scope = null) {
  return withTransaction(async (db) => {
    const row = await getQuoteRow(id, db, scope);
    if (row.status !== 'draft') throw badRequest(`Only a draft package quotation can be changed (current: ${row.status})`);
    const before = await getPackageQuote(row.id, { db });
    const bundle = await getBundle(row.bundle_id, db);
    const sections = b.sections || before.sections.map((s) => ({ sectionNo: s.sectionNo, included: true, insuranceCompanyId: s.insuranceCompanyId, sumInsured: s.sumInsured }));
    const lguCode = b.lguCode !== undefined ? b.lguCode : row.lgu_code;
    const priced = await priceBundle(db, bundle, { sections, lguCode, city: b.city, date: b.inceptionDate || row.inception_date, renewal: Boolean(row.renewal_of) });
    if (b.clientId !== undefined || b.leadRefId !== undefined) await checkParty(db, { clientId: b.clientId ?? row.client_id, leadId: b.leadRefId ?? row.lead_id });
    const cols = { ...priceColumns(priced), lgu_code: priced.lgu?.code || null, inception_date: priced.date, client_id: b.clientId ?? row.client_id, lead_id: b.leadRefId ?? row.lead_id,
      insured_name: b.insuredName !== undefined ? b.insuredName : row.insured_name, location: b.location !== undefined ? b.location : row.location,
      remarks: b.remarks !== undefined ? b.remarks : row.remarks, doc: JSON.stringify({ ...(row.doc || {}), charges: priced.totals.charges, lgu: priced.lgu }), updated_by: user?.id ?? null };
    const keys = Object.keys(cols);
    await db.query(`UPDATE package_quotes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [row.id, ...Object.values(cols)]);
    await writeSections(db, 'quote', row.id, priced.sections);
    return { before, after: await getPackageQuote(row.id, { db }) };
  });
}

/** draft -> accepted (the client accepted the package); draft / accepted -> cancelled. */
export async function setQuoteStatus(id, target, user, scope = null) {
  const row = await getQuoteRow(id, null, scope);
  const allowed = { accepted: ['draft'], cancelled: ['draft', 'accepted'], draft: ['accepted'] };
  if (!(allowed[target] || []).includes(row.status)) throw conflict(`A ${row.status} package quotation cannot be set to ${target}`);
  if (target === 'accepted' && row.valid_until && String(row.valid_until) < (await today())) throw badRequest(`Package quotation ${row.quote_number} expired on ${row.valid_until}: re-quote it`);
  const before = quoteOut(row);
  await query('UPDATE package_quotes SET status = $2, updated_by = $3 WHERE id = $1', [row.id, target, user?.id ?? null]);
  return { before, after: await getPackageQuote(row.id) };
}
