/**
 * Scheme Master (TIS-BRD-SCHM-02, FRS FR-SCM-001 to 012): the Toyota bundling schemes. A scheme is set up in Draft with
 * its General tab (Scheme No., type, description, effective dates, financing bank, dealers, insurers), its products
 * and perils with the rate of each, its vehicle lines, its Commission % and Dealer commission %, and its term with the
 * sum insured % of each policy year. A second user holding approve:schemes approves it (never its maker); the daily job
 * schemeStatus activates and expires it. An approved version is never changed: Amend creates the next version, which
 * replaces the version in force from its own Effective from. The rating of a policy from a scheme is rating.js.
 * Migration 0600.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { addCalendarMonths, isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { decisionReason } from '../ops-masters/records.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { motorTariff } from '../quotations/motorTariff.js';
import { governingTemplate, templateCovers } from '../product-configurator/underwriting.js';
import { standardRates } from '../promotions/rates.js';
import { BANK_TYPES, DEALER_TYPES } from '../channels/service.js';

export const TYPE_LABELS = { scheme1: 'Scheme 1 - Lock-in (Auto Renewal Agreement)', scheme2: 'Scheme 2 - Guaranteed renewal' };
export const STATUS_LABELS = { draft: 'Draft', 'pending-approval': 'Pending approval', scheduled: 'Scheduled', active: 'Active', suspended: 'Suspended',
  expired: 'Expired', withdrawn: 'Withdrawn', superseded: 'Superseded' };
export const PAID_BY_LABELS = { dealer: 'Dealer (free first year)', 'client-ada': 'Client through TFS (ADA)', 'client-ma': 'Client through TFS (M.A.)' };
export const BASIS_LABELS = { 'si-pct': '% of sum insured', 'limit-premium': 'Fixed premium per limit', 'limit-seat-pct': '% of limit x seats', 'vehicle-premium': 'Fixed premium per vehicle',
  'limit-pct': '% of limit', tariff: 'Insurance Commission tariff' };
/**
 * The perils of a scheme, one per quotation premium of the Motor template's covers (Own Damage and Theft share one line,
 * as on Coverage Details), with the rate basis of FR-SCM-002 R1.
 */
export const PERILS = [
  { code: 'OD', quoteField: 'lossAndDamageCoveragePremium', name: 'Own Damage / Theft', basis: 'si-pct', standard: 'ownDamage' },
  { code: 'AON', quoteField: 'actsOfNaturePremium', name: 'Acts of Nature', basis: 'si-pct', standard: 'actsOfNature' },
  { code: 'BI', quoteField: 'bodilyInjuryCoveragePremium', name: 'Excess Bodily Injury', basis: 'limit-premium', limitKind: 'bi' },
  { code: 'PD', quoteField: 'propertyDamageCoveragePremium', name: 'Property Damage', basis: 'limit-premium', limitKind: 'pd' },
  { code: 'APPA', quoteField: 'APPAcoveragePremium', name: 'Auto Personal Accident', basis: 'limit-seat-pct', limitKind: 'appa' },
  { code: 'RSA', quoteField: 'roadsideAssistancePremium', name: 'Roadside Assistance', basis: 'vehicle-premium' },
  { code: 'PAD', quoteField: 'personalAccidentCoverPremium', name: 'Personal Accident of the Driver', basis: 'limit-pct' },
  { code: 'CTPL', quoteField: 'ctplCoveragePremium', name: 'CTPL', basis: 'tariff' },
];
const PERIL = Object.fromEntries(PERILS.map((p) => [p.code, p]));
const NO = /^[A-Z0-9-]{3,20}$/;
const IN_FORCE = ['scheduled', 'active', 'suspended'];
const LINK = '/sales/schemes';

const fail = (errors) => {
  const list = Array.isArray(errors) ? errors : [errors];
  return badRequest(list[0].message, list);
};
const err = (path, message) => ({ path, message });
const dmy = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const money = (v) => Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const rateOut = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const pct2 = (v) => Number(num(v).toFixed(2));
const decimals = (v) => (String(v).split('.')[1] || '').length;

// ---------------------------------------------------------------- read

const SELECT = `SELECT s.*, b.name AS bank_name, pr.name AS product_name, cu.display_name AS created_by_name, uu.display_name AS updated_by_name,
  su.display_name AS submitted_by_name, du.display_name AS decided_by_name, xu.display_name AS status_changed_by_name,
  (SELECT count(*)::int FROM scheme_vehicle_lines l WHERE l.scheme_id = s.id) AS line_count
  FROM schemes s LEFT JOIN distribution_channels b ON b.id = s.bank_channel_id LEFT JOIN products pr ON pr.id = s.product_id
  LEFT JOIN users cu ON cu.id = s.created_by LEFT JOIN users uu ON uu.id = s.updated_by LEFT JOIN users su ON su.id = s.submitted_by
  LEFT JOIN users du ON du.id = s.decided_by LEFT JOIN users xu ON xu.id = s.status_changed_by`;

const LINE_SELECT = `SELECT l.*, b.name AS brand_name, b.status AS brand_status, m.name AS model_name, m.status AS model_status, v.name AS variant_name, v.status AS variant_status
  FROM scheme_vehicle_lines l JOIN vehicle_brands b ON b.id = l.brand_id LEFT JOIN vehicle_models m ON m.id = l.model_id LEFT JOIN vehicle_variants v ON v.id = l.variant_id`;

/** "Toyota Fortuner 2.4 G 4x2 AT", "Toyota Vios, All variants", "Toyota, All models". */
export const vehicleLabel = (l) => [l.brand_name || l.brand, l.model_name || l.model || null, l.variant_name || l.variant || null].filter(Boolean).join(' ')
  + (!(l.model_name || l.model) ? ', All models' : !(l.variant_name || l.variant) ? ', All variants' : '');

export const toLine = (l) => ({
  id: Number(l.id), lineNo: l.line_no, brandId: l.brand_id, brand: l.brand_name, modelId: l.model_id, model: l.model_name || null, variantId: l.variant_id,
  variant: l.variant_name || null, vehicle: vehicleLabel(l), yearFrom: l.year_from, yearTo: l.year_to, siFrom: Number(l.si_from), siTo: Number(l.si_to),
  vehicleClass: l.vehicle_class, odRate: rateOut(l.od_rate), aonRate: rateOut(l.aon_rate),
  active: l.brand_status === 'active' && (!l.model_id || l.model_status === 'active') && (!l.variant_id || l.variant_status === 'active'),
});

async function channels(ids) {
  if (!ids?.length) return [];
  return (await many('SELECT id, code, name, channel_type FROM distribution_channels WHERE id = ANY($1) ORDER BY name', [ids])).map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.channel_type }));
}
async function insurers(ids) {
  if (!ids?.length) return [];
  return (await many('SELECT id, name FROM insurance_companies WHERE id = ANY($1::int[]) ORDER BY name', [ids.map(Number)])).map((r) => ({ id: r.id, name: r.name }));
}

/** The schedule rows of the Commission & term tab: sum insured % of each year, an example sum insured on 1,000,000, who pays and the kind of renewal. */
export function scheduleRows(type, term, schedule, paidBy, example = 1000000) {
  const out = [];
  for (let y = 1; y <= Number(term || 0); y += 1) {
    const pct = y === 1 ? 100 : rateOut(schedule?.[y - 1]);
    const who = type === 'scheme2' ? 'client-ma' : y === 1 ? (paidBy || 'dealer') : 'client-ada';
    out.push({ year: y, pct, exampleSumInsured: pct === null ? null : round2((example * pct) / 100), whoPays: who, whoPaysLabel: PAID_BY_LABELS[who],
      renewal: type === 'scheme2' ? 'Financed in the M.A.' : y === 1 ? (who === 'dealer' ? 'Free first year' : 'First year') : 'Auto renewal (ARA)' });
  }
  return out;
}

/** The equivalent rates on Own Damage (FR-SCM-005): commission, remitting, dealer and TISPH shares in rate terms. */
export function equivalents(odRate, commissionPct, dealerPct) {
  if (odRate === null || odRate === undefined || commissionPct === null || commissionPct === undefined) return null;
  const commission = Math.round(((num(odRate) * num(commissionPct)) / 100) * 1e4) / 1e4;
  const dealer = dealerPct === null || dealerPct === undefined ? null : Math.round(((commission * num(dealerPct)) / 100) * 1e4) / 1e4;
  return { ownDamageRate: num(odRate), commission, remitting: Math.round((num(odRate) - commission) * 1e4) / 1e4, dealer, tisph: dealer === null ? null : Math.round((commission - dealer) * 1e4) / 1e4,
    tisphPct: dealerPct === null || dealerPct === undefined ? null : pct2(100 - num(dealerPct)) };
}

async function toScheme(r, { detail = false } = {}) {
  const dealerIds = r.dealer_channel_ids || [];
  const perils = (r.perils || []).map((p) => ({ ...PERIL[p.code], ...p, basisLabel: BASIS_LABELS[p.basis || PERIL[p.code]?.basis] }));
  const od = perils.find((p) => p.code === 'OD');
  const out = {
    id: r.id, schemeNo: r.scheme_no, version: r.version, schemeType: r.scheme_type, schemeTypeLabel: TYPE_LABELS[r.scheme_type], description: r.description,
    effectiveFrom: isoDate(r.effective_from), effectiveTo: isoDate(r.effective_to), bankChannelId: r.bank_channel_id, bankName: r.bank_name || null,
    allDealers: r.all_dealers, dealerChannelIds: dealerIds, dealers: r.all_dealers ? [] : await channels(dealerIds), insurerIds: (r.insurer_ids || []).map(Number),
    insurers: await insurers(r.insurer_ids || []), productId: r.product_id, productName: r.product_name || null, vehicleClasses: r.vehicle_classes || [],
    odDeductible: rateOut(r.od_deductible), perils, commissionPct: rateOut(r.commission_pct), dealerCommissionPct: rateOut(r.dealer_commission_pct),
    tisphPct: r.dealer_commission_pct === null ? null : pct2(100 - num(r.dealer_commission_pct)),
    termYears: r.term_years, year1PaidBy: r.scheme_type === 'scheme2' ? 'client-ma' : r.year1_paid_by, siSchedule: (r.si_schedule || []).map(rateOut),
    schedule: scheduleRows(r.scheme_type, r.term_years, r.si_schedule, r.year1_paid_by), status: r.status, statusLabel: STATUS_LABELS[r.status], notes: r.notes,
    lineCount: r.line_count ?? 0, equivalents: equivalents(od?.included ? od.rate : null, r.commission_pct, r.dealer_commission_pct),
    createdBy: r.created_by_name || r.created_by, createdById: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by_name || r.updated_by, updatedById: r.updated_by,
    updatedAt: r.updated_at, submittedBy: r.submitted_by_name || r.submitted_by, submittedById: r.submitted_by, submittedAt: r.submitted_at,
    decidedBy: r.decided_by_name || r.decided_by, decidedAt: r.decided_at, decisionNote: r.decision_note, statusNote: r.status_note,
    statusChangedBy: r.status_changed_by_name || r.status_changed_by, statusChangedAt: r.status_changed_at,
  };
  if (detail) {
    const lines = (await many(`${LINE_SELECT} WHERE l.scheme_id = $1 ORDER BY l.line_no`, [r.id])).map(toLine);
    const classes = new Set(out.vehicleClasses);
    out.lines = lines.map((l) => ({ ...l, check: !l.active ? `Line ${l.lineNo}: ${l.vehicle} is not active on the Vehicle master` : classes.size && !classes.has(l.vehicleClass) ? `Line ${l.lineNo}: ${l.vehicleClass} is not a vehicle class of the scheme` : 'OK' }));
    out.warnings = await rateWarnings(perils, lines);
  }
  return out;
}

async function schemeRow(id, db = null) {
  const sql = `${SELECT} WHERE s.id = $1 OR (s.scheme_no = upper($1) AND s.version = (SELECT max(version) FROM schemes x WHERE x.scheme_no = upper($1) AND x.status <> 'withdrawn'))`;
  const r = db ? (await db.query(sql, [String(id)])).rows[0] : await one(sql, [String(id)]);
  if (!r) throw notFound('Scheme not found');
  return r;
}

/** Policies in force on a Scheme No. (any version): MSG-SCM-049. */
export async function policiesInForce(schemeNo) {
  return (await one(`SELECT count(*)::int AS n FROM policy_schemes ps JOIN policies p ON p.id = ps.policy_id
    WHERE upper(ps.scheme_no) = upper($1) AND p.status IN ('active', 'issued')`, [schemeNo])).n;
}

/** The differences of a version with the version before it (approval highlights, FR-SCM-012 AC3). */
async function changesFromPrevious(s) {
  if (s.version <= 1) return null;
  const prev = await one(`${SELECT} WHERE s.scheme_no = $1 AND s.version = $2`, [s.schemeNo, s.version - 1]);
  if (!prev) return null;
  const p = await toScheme(prev, { detail: true });
  const fields = ['description', 'effectiveFrom', 'effectiveTo', 'bankChannelId', 'allDealers', 'dealerChannelIds', 'insurerIds', 'productId', 'vehicleClasses', 'odDeductible',
    'commissionPct', 'dealerCommissionPct', 'termYears', 'year1PaidBy', 'siSchedule'].filter((k) => JSON.stringify(p[k]) !== JSON.stringify(s[k]));
  const perilKey = (x) => JSON.stringify([x.included, rateOut(x.rate), rateOut(x.premium), rateOut(x.limit)]);
  const perils = s.perils.filter((x) => { const o = p.perils.find((y) => y.code === x.code); return !o || perilKey(o) !== perilKey(x); }).map((x) => x.code);
  const lineKey = (l) => JSON.stringify([l.brandId, l.modelId, l.variantId, l.yearFrom, l.yearTo, l.siFrom, l.siTo, l.vehicleClass, l.odRate, l.aonRate]);
  const old = new Set(p.lines.map(lineKey));
  const lines = s.lines.filter((l) => !old.has(lineKey(l))).map((l) => l.lineNo);
  return { previousVersion: p.version, fields, perils, lines, removedLines: p.lines.length - (s.lines.length - lines.length) };
}

export async function getScheme(id) {
  const s = await toScheme(await schemeRow(id), { detail: true });
  const versions = await many(`${SELECT} WHERE s.scheme_no = $1 ORDER BY s.version DESC`, [s.schemeNo]);
  return { ...s, versions: await Promise.all(versions.map((v) => toScheme(v))), changes: await changesFromPrevious(s), policiesInForce: await policiesInForce(s.schemeNo) };
}

/**
 * Schemes for the list (FR-SCM-007): status (comma list or a tab: expired-withdrawn), search on Scheme No. and
 * description, scheme type, dealer, insurer and inForceOn (Active or Scheduled whose period covers the date).
 * Superseded versions are left out unless asked for. Sorted Active first, then Effective from descending.
 */
export async function listSchemes(q = {}) {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) {
    const list = q.status === 'expired-withdrawn' ? ['expired', 'withdrawn'] : String(q.status).split(',');
    add('s.status = ANY(?)', list);
  } else where.push("s.status <> 'superseded'");
  if (q.search) add('(s.scheme_no ILIKE ? OR s.description ILIKE ?)', `%${String(q.search).trim()}%`);
  if (q.schemeType) add('s.scheme_type = ?', q.schemeType);
  if (q.dealerChannelId) {
    add(`(s.all_dealers OR s.dealer_channel_ids @> jsonb_build_array(?::text)
      OR s.dealer_channel_ids @> jsonb_build_array((SELECT parent_id FROM distribution_channels WHERE id = ?::text)))`, String(q.dealerChannelId));
  }
  if (q.insurerId) add('s.insurer_ids @> to_jsonb(ARRAY[?::int])', Number(q.insurerId));
  if (q.inForceOn) add("s.status IN ('active', 'scheduled') AND ?::date BETWEEN s.effective_from AND s.effective_to", isoDate(q.inForceOn));
  const rows = await many(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY (s.status = 'active') DESC, s.effective_from DESC NULLS LAST, s.scheme_no, s.version DESC`, params);
  return Promise.all(rows.map((r) => toScheme(r)));
}

/** Counts per tab of the list (All, Active, Scheduled, Pending approval, Draft, Expired / withdrawn). */
export async function statusCounts() {
  const rows = await many("SELECT status, count(*)::int AS n FROM schemes WHERE status <> 'superseded' GROUP BY status");
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { all: rows.reduce((s, r) => s + r.n, 0), active: by.active || 0, scheduled: by.scheduled || 0, 'pending-approval': by['pending-approval'] || 0, draft: by.draft || 0,
    suspended: by.suspended || 0, 'expired-withdrawn': (by.expired || 0) + (by.withdrawn || 0) };
}

// ---------------------------------------------------------------- checks

/** General tab (FR-SCM-001): fields of the body merged on the existing row, checked. Returns the columns to store. */
async function general(db, b, existing = null, { strict = false } = {}) {
  const errors = [];
  const schemeNo = String(existing ? existing.scheme_no : b.schemeNo ?? '').trim().toUpperCase();
  if (!schemeNo) errors.push(err('schemeNo', 'Enter the Scheme No.'));
  else if (!NO.test(schemeNo)) errors.push(err('schemeNo', 'Use capital letters, digits and hyphens (3 to 20 characters)'));
  else if (!existing && (await db.query('SELECT 1 FROM schemes WHERE upper(scheme_no) = $1', [schemeNo])).rows[0]) errors.push(err('schemeNo', `Scheme No. ${schemeNo} is already used`));
  let type = existing && existing.version > 1 ? existing.scheme_type : b.schemeType ?? existing?.scheme_type ?? null;
  if (existing && b.schemeType && b.schemeType !== existing.scheme_type && existing.version > 1) errors.push(err('schemeType', 'The scheme type cannot be changed after approval'));
  if (!type) errors.push(err('schemeType', 'Choose the scheme type'));
  else if (!TYPE_LABELS[type]) { errors.push(err('schemeType', 'Choose the scheme type')); type = null; }
  const description = String(b.description ?? existing?.description ?? '').trim();
  if (!description) errors.push(err('description', 'Enter a description of the scheme'));
  else if (description.length > 200) errors.push(err('description', 'The description can have at most 200 characters'));
  const from = isoDate(b.effectiveFrom === undefined ? existing?.effective_from : b.effectiveFrom);
  const to = isoDate(b.effectiveTo === undefined ? existing?.effective_to : b.effectiveTo);
  const now = await today();
  if (from && to && to < from) errors.push(err('effectiveTo', 'Effective to must be on or after Effective from'));
  if (from && from < now && (strict || from !== isoDate(existing?.effective_from))) errors.push(err('effectiveFrom', 'A scheme cannot start before today'));
  const months = Number(await getSetting('schemes.max_period_months', 24));
  if (from && to && to > isoDate(addCalendarMonths(from, months))) errors.push(err('effectiveTo', `A scheme can run for at most ${months} months`));
  if (strict && (!from || !to)) errors.push(err(from ? 'effectiveTo' : 'effectiveFrom', 'Enter the effective dates of the scheme'));
  const bank = b.bankChannelId === undefined ? existing?.bank_channel_id ?? null : b.bankChannelId || null;
  if (bank || strict) {
    const c = bank ? (await db.query('SELECT channel_type, status FROM distribution_channels WHERE id = $1', [bank])).rows[0] : null;
    if (!c || c.status !== 'active' || c.channel_type !== BANK_TYPES[0]) errors.push(err('bankChannelId', 'The financing bank must be an active financing bank of Distribution Channels'));
  }
  const allDealers = b.allDealers ?? existing?.all_dealers ?? true;
  const dealerIds = allDealers ? [] : [...new Set(b.dealerChannelIds ?? existing?.dealer_channel_ids ?? [])];
  if (!allDealers) {
    if (!dealerIds.length) errors.push(err('dealerChannelIds', 'Choose All dealers or at least one dealer'));
    else {
      const ok = (await db.query("SELECT id FROM distribution_channels WHERE id = ANY($1) AND status = 'active' AND channel_type = ANY($2)", [dealerIds, DEALER_TYPES])).rows;
      if (ok.length !== dealerIds.length) errors.push(err('dealerChannelIds', 'Choose active dealer groups or dealer branches of Distribution Channels'));
    }
  }
  const insurerIds = [...new Set((b.insurerIds ?? existing?.insurer_ids ?? []).map(Number))];
  if (insurerIds.length) {
    const ok = (await db.query("SELECT id FROM insurance_companies WHERE id = ANY($1::int[]) AND status = 'active'", [insurerIds])).rows;
    if (ok.length !== insurerIds.length) errors.push(err('insurerIds', 'Choose active insurers of the Insurance Company master'));
  } else if (strict) errors.push(err('insurerIds', 'Choose at least one insurer'));
  return { errors, cols: { scheme_no: schemeNo, scheme_type: type, description, effective_from: from, effective_to: to, bank_channel_id: bank, all_dealers: allDealers,
    dealer_channel_ids: JSON.stringify(dealerIds), insurer_ids: JSON.stringify(insurerIds), notes: b.notes === undefined ? existing?.notes ?? null : String(b.notes || '').trim() || null } };
}

/** The peril table of a Motor product: one row per peril of its template's covers, mandatory covers always in. */
export async function perilTemplate(productId) {
  const t = await governingTemplate({ productId, lob: 'MOTOR' });
  const covers = t ? await templateCovers(t.id) : [];
  const std = await standardRates();
  const out = [];
  for (const def of PERILS) {
    const own = covers.filter((c) => c.quoteField === def.quoteField);
    if (covers.length && !own.length) continue;
    out.push({ code: def.code, name: def.name, coverCodes: own.map((c) => c.code), mandatory: own.some((c) => c.type === 'Mandatory') || def.code === 'CTPL',
      basis: def.basis, basisLabel: BASIS_LABELS[def.basis], deductible: own[0]?.deductible ?? null,
      standard: def.standard ? std[def.standard] : def.code === 'CTPL' ? 'Tariff' : null });
  }
  return { templateCode: t?.template_code || null, perils: out };
}

/** Products & perils tab (FR-SCM-002): product, vehicle classes, deductible and the peril rates, checked. */
async function productsAndPerils(db, b, existing, { strict = false } = {}) {
  const errors = [];
  const productId = b.productId === undefined ? existing?.product_id ?? null : b.productId ? Number(b.productId) : null;
  if (productId) {
    const p = (await db.query('SELECT line FROM products WHERE id = $1', [productId])).rows[0];
    if (!p || p.line !== 'motor') errors.push(err('productId', 'Schemes apply to Motor products only'));
  } else if (strict) errors.push(err('productId', 'Choose the product of the scheme'));
  const tariff = await motorTariff();
  const classes = [...new Set(b.vehicleClasses ?? existing?.vehicle_classes ?? [])];
  const unknown = classes.filter((c) => !tariff.vehicleTypes.some((v) => v.value === c));
  if (unknown.length) errors.push(err('vehicleClasses', `${unknown.join(', ')} is not a vehicle class of the Motor tariff`));
  if (strict && !classes.length) errors.push(err('vehicleClasses', 'Choose at least one vehicle class'));
  const ded = b.odDeductible === undefined ? existing?.od_deductible ?? null : b.odDeductible === '' || b.odDeductible === null ? null : num(b.odDeductible);
  if (ded !== null && ded < 0) errors.push(err('odDeductible', 'The deductible is an amount of 0 or more'));
  let perils = existing?.perils || [];
  if (b.perils !== undefined || (productId && !perils.length)) {
    const template = productId ? (await perilTemplate(productId)).perils : PERILS.map((d) => ({ ...d, mandatory: ['OD', 'CTPL'].includes(d.code) }));
    const given = new Map((b.perils || []).map((p) => [String(p.code).toUpperCase(), p]));
    perils = template.map((t) => {
      const g = given.get(t.code) || {};
      if (t.mandatory && g.included === false) errors.push(err(`perils.${t.code}.included`, `${t.name} is a mandatory cover of the product and stays in the scheme`));
      const included = t.mandatory || g.included === true;
      return { code: t.code, name: t.name, basis: t.basis, mandatory: t.mandatory, included, rate: included && t.basis !== 'tariff' ? rateOut(g.rate) : null,
        premium: included ? rateOut(g.premium) : null, limit: included ? rateOut(g.limit) : null };
    });
  }
  // the rates and limits of every included peril (FR-SCM-002 R1, R3)
  for (const p of perils) {
    if (!p.included || p.basis === 'tariff') continue;
    const path = `perils.${p.code}`;
    const needsRate = ['si-pct', 'limit-seat-pct', 'limit-pct'].includes(p.basis);
    const needsPremium = ['limit-premium', 'vehicle-premium'].includes(p.basis);
    if (needsRate && (p.rate === null || p.rate === undefined)) { if (strict || b.perils !== undefined) errors.push(err(`${path}.rate`, `${p.name}: enter the rate of an included peril`)); }
    else if (needsRate && (!(p.rate > 0 && p.rate <= 100) || decimals(p.rate) > 4)) errors.push(err(`${path}.rate`, `${p.name}: the rate must be more than 0 and at most 100`));
    if (needsPremium && (p.premium === null || p.premium === undefined)) { if (strict || b.perils !== undefined) errors.push(err(`${path}.premium`, `${p.name}: enter the rate of an included peril`)); }
    else if (needsPremium && !(p.premium > 0)) errors.push(err(`${path}.premium`, `${p.name}: the rate must be more than 0 and at most 100`));
    if (['limit-premium', 'limit-seat-pct', 'limit-pct'].includes(p.basis) && !(p.limit > 0) && (strict || b.perils !== undefined)) errors.push(err(`${path}.limit`, `${p.name}: choose the limit`));
  }
  if (perils.find((p) => p.code === 'APPA' && p.included && p.limit > 0) && tariff.appa.limits.length && !tariff.appa.limits.includes(perils.find((p) => p.code === 'APPA').limit)) {
    errors.push(err('perils.APPA.limit', `Auto Personal Accident: choose a limit per seat of ${tariff.appa.limits.map(money).join(', ')}`));
  }
  return { errors, cols: { product_id: productId, vehicle_classes: JSON.stringify(classes), od_deductible: ded, perils: JSON.stringify(perils) }, perils, classes };
}

/** Warnings of rates above the standard rates (FR-SCM-002 alternate flow, MSG-SCM-020), when schemes.warn_rate_above_standard. */
async function rateWarnings(perils, lines = []) {
  if ((await getSetting('schemes.warn_rate_above_standard', true)) === false) return [];
  const std = await standardRates();
  const out = [];
  const f = (v) => num(v).toFixed(4);
  for (const p of perils) {
    const def = PERIL[p.code];
    if (!p.included || !def?.standard || p.rate === null || p.rate === undefined) continue;
    if (num(p.rate) > std[def.standard]) out.push({ path: `perils.${p.code}.rate`, message: `${p.name}: the scheme rate of ${f(p.rate)}% is above the standard rate of ${num(std[def.standard]).toFixed(2)}%` });
  }
  for (const l of lines) {
    if (l.odRate !== null && l.odRate !== undefined && num(l.odRate) > std.ownDamage) out.push({ path: `lines.${l.lineNo}.odRate`, message: `Line ${l.lineNo}: the scheme rate of ${f(l.odRate)}% is above the standard rate of ${num(std.ownDamage).toFixed(2)}%` });
  }
  return out;
}

/** Commission & term tab (FR-SCM-005, 006), checked. */
async function commissionAndTerm(b, existing, type, { strict = false } = {}) {
  const errors = [];
  const pct = (k, col) => (b[k] === undefined ? (existing?.[col] ?? null) === null ? null : Number(existing[col]) : b[k] === '' || b[k] === null ? null : Number(b[k]));
  const commission = pct('commissionPct', 'commission_pct');
  const dealer = pct('dealerCommissionPct', 'dealer_commission_pct');
  if (commission === null) { if (strict) errors.push(err('commissionPct', 'Enter the commission %')); }
  else if (!Number.isFinite(commission) || commission < 0 || commission > 100 || decimals(commission) > 2) errors.push(err('commissionPct', 'The commission % must be between 0 and 100'));
  if (dealer === null) { if (strict) errors.push(err('dealerCommissionPct', 'Enter the dealer commission %')); }
  else if (!Number.isFinite(dealer) || dealer < 0 || dealer > 100 || decimals(dealer) > 2) errors.push(err('dealerCommissionPct', 'The dealer commission % must be between 0 and 100'));
  const max = Number(await getSetting('schemes.max_term_years', 5));
  const term = b.termYears === undefined ? existing?.term_years ?? null : b.termYears === '' || b.termYears === null ? null : Number(b.termYears);
  if (term === null) { if (strict) errors.push(err('termYears', `The term must be between 1 and ${max} years`)); }
  else if (!Number.isInteger(term) || term < 1 || term > max) errors.push(err('termYears', `The term must be between 1 and ${max} years`));
  let schedule = (b.siSchedule ?? existing?.si_schedule ?? []).map((v) => (v === '' || v === null || v === undefined ? null : Number(v)));
  if (term && term >= 1 && term <= max) {
    schedule = Array.from({ length: term }, (_, i) => (i === 0 ? 100 : schedule[i] ?? null));
    for (let y = 2; y <= term; y += 1) {
      const v = schedule[y - 1];
      if (v === null || !Number.isFinite(v)) { if (strict || b.siSchedule !== undefined) errors.push(err(`siSchedule.${y - 1}`, `Year ${y}: enter the sum insured %`)); }
      else if (!(v > 0) || decimals(v) > 2) errors.push(err(`siSchedule.${y - 1}`, `Year ${y}: enter the sum insured %`));
      else if (schedule[y - 2] !== null && v > schedule[y - 2]) errors.push(err(`siSchedule.${y - 1}`, `Year ${y}: the sum insured % cannot be higher than year ${y - 1}`));
    }
  }
  let paidBy = type === 'scheme2' ? 'client-ma' : b.year1PaidBy ?? existing?.year1_paid_by ?? (type === 'scheme1' ? 'dealer' : null);
  if (type === 'scheme1' && !['dealer', 'client-ada'].includes(paidBy)) { errors.push(err('year1PaidBy', 'Year 1 of a Scheme 1 is paid by the dealer or by the client through TFS (ADA)')); paidBy = null; }
  return { errors, cols: { commission_pct: commission, dealer_commission_pct: dealer, term_years: term, si_schedule: JSON.stringify(schedule), year1_paid_by: paidBy } };
}

/** Resolve a vehicle line given by ids or by names (make, model or ALL, variant or ALL). */
export async function resolveVehicle(db, v) {
  const all = (x) => x === undefined || x === null || String(x).trim() === '' || String(x).trim().toUpperCase() === 'ALL';
  let brand = v.brandId ? (await db.query('SELECT id, name, status FROM vehicle_brands WHERE id = $1', [Number(v.brandId)])).rows[0] : null;
  if (!brand && v.make) brand = (await db.query('SELECT id, name, status FROM vehicle_brands WHERE lower(name) = lower($1) ORDER BY (status = \'active\') DESC LIMIT 1', [String(v.make).trim()])).rows[0];
  if (!brand) return { error: `Make ${v.make || v.brandId || ''} is not on the Vehicle master`.replace('  ', ' ') };
  let model = null;
  if (v.modelId) model = (await db.query('SELECT id, name, status FROM vehicle_models WHERE id = $1 AND brand_id = $2', [Number(v.modelId), brand.id])).rows[0];
  else if (!all(v.model)) model = (await db.query('SELECT id, name, status FROM vehicle_models WHERE brand_id = $1 AND lower(name) = lower($2) LIMIT 1', [brand.id, String(v.model).trim()])).rows[0];
  if ((v.modelId || !all(v.model)) && !model) return { error: `${brand.name} ${v.model || v.modelId} is not a model of the Vehicle master` };
  let variant = null;
  if (v.variantId) variant = model ? (await db.query('SELECT id, name, status FROM vehicle_variants WHERE id = $1 AND model_id = $2', [Number(v.variantId), model.id])).rows[0] : null;
  else if (!all(v.variant)) variant = model ? (await db.query('SELECT id, name, status FROM vehicle_variants WHERE model_id = $1 AND lower(name) = lower($2) LIMIT 1', [model.id, String(v.variant).trim()])).rows[0] : null;
  if ((v.variantId || !all(v.variant)) && !variant) return { error: `${brand.name} ${model?.name || ''} ${v.variant || v.variantId} is not a variant of the Vehicle master`.replace(/\s+/g, ' ') };
  return { brand, model, variant };
}

/**
 * One vehicle line checked against the scheme's classes and the other lines (FR-SCM-003 R1 to R4): returns
 * { line, error }. n is the line number shown in the messages; others the lines already accepted.
 */
export async function checkLine(db, raw, n, others, classes) {
  const v = await resolveVehicle(db, raw);
  if (v.error) return { error: `Line ${n}: ${v.error}` };
  const line = { brandId: v.brand.id, brand_name: v.brand.name, modelId: v.model?.id || null, model_name: v.model?.name || null, variantId: v.variant?.id || null,
    variant_name: v.variant?.name || null, yearFrom: Number(raw.yearFrom), yearTo: Number(raw.yearTo ?? raw.yearFrom), siFrom: num(String(raw.siFrom ?? '').replace(/,/g, '')),
    siTo: num(String(raw.siTo ?? '').replace(/,/g, '')), vehicleClass: String(raw.vehicleClass || classes[0] || '').trim(), odRate: rateOut(raw.odRate), aonRate: rateOut(raw.aonRate) };
  const label = vehicleLabel({ brand_name: line.brand_name, model_name: line.model_name, variant_name: line.variant_name });
  if ([v.brand, v.model, v.variant].some((x) => x && x.status !== 'active')) return { error: `Line ${n}: ${label} is not active on the Vehicle master` };
  if (!Number.isInteger(line.yearFrom) || !Number.isInteger(line.yearTo) || line.yearFrom < 1950) return { error: `Line ${n}: enter the year models (YYYY)` };
  if (line.yearTo < line.yearFrom) return { error: `Line ${n}: Year model to must be on or after Year model from` };
  if (!(line.siTo > line.siFrom) || line.siFrom < 0) return { error: `Line ${n}: Sum insured to must be higher than Sum insured from` };
  if (!line.vehicleClass || (classes.length && !classes.includes(line.vehicleClass))) return { error: `Line ${n}: ${line.vehicleClass || 'the vehicle class'} is not a vehicle class of the scheme` };
  for (const k of ['odRate', 'aonRate']) {
    if (line[k] !== null && (!(line[k] > 0 && line[k] <= 100) || decimals(line[k]) > 4)) return { error: `Line ${n}: the rate must be more than 0 and at most 100` };
  }
  const level = (l) => (l.variantId ? 2 : l.modelId ? 1 : 0);
  const clash = others.find((o) => o.brandId === line.brandId && level(o) === level(line) && o.modelId === line.modelId && o.variantId === line.variantId
    && o.yearFrom <= line.yearTo && line.yearFrom <= o.yearTo);
  if (clash) return { error: `Line ${n}: ${label}, year model ${Math.max(clash.yearFrom, line.yearFrom)} is already covered by line ${clash.lineNo}` };
  return { line: { ...line, lineNo: n } };
}

async function linesOf(db, rawLines, classes) {
  const out = [];
  const errors = [];
  for (const [i, raw] of (rawLines || []).entries()) {
    const r = await checkLine(db, raw, i + 1, out, classes);
    if (r.error) errors.push(err(`lines.${i}`, r.error)); else out.push(r.line);
  }
  return { lines: out, errors };
}

async function writeLines(db, schemeId, lines, { replace = true } = {}) {
  if (replace) await db.query('DELETE FROM scheme_vehicle_lines WHERE scheme_id = $1', [schemeId]);
  for (const l of lines) {
    await db.query(`INSERT INTO scheme_vehicle_lines(scheme_id, line_no, brand_id, model_id, variant_id, year_from, year_to, si_from, si_to, vehicle_class, od_rate, aon_rate)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [schemeId, l.lineNo, l.brandId, l.modelId, l.variantId, l.yearFrom, l.yearTo, l.siFrom, l.siTo, l.vehicleClass, l.odRate, l.aonRate]);
  }
}

const currentLines = async (db, id) => (await db.query(`${LINE_SELECT} WHERE l.scheme_id = $1 ORDER BY l.line_no`, [id])).rows.map(toLine);

// ---------------------------------------------------------------- maintain

/** Save a new scheme as Draft, version 1 (FR-SCM-001 to 006). */
export async function createScheme(b, user, { copiedFrom = null } = {}) {
  const id = await withTransaction(async (db) => {
    const g = await general(db, b);
    const pp = await productsAndPerils(db, b, null);
    const ct = await commissionAndTerm(b, null, g.cols.scheme_type);
    const ln = await linesOf(db, b.lines, pp.classes);
    const errors = [...g.errors, ...pp.errors, ...ct.errors, ...ln.errors];
    if (errors.length) throw fail(errors);
    const cols = { ...g.cols, ...pp.cols, ...ct.cols, copied_from: copiedFrom };
    if (cols.term_years === null) {
      cols.term_years = Number(await getSetting('schemes.default_term_years', 5));
      const def = (await getSetting('schemes.default_schedule', [100, 90, 80, 70, 60])) || [];
      cols.si_schedule = JSON.stringify(Array.from({ length: cols.term_years }, (_, i) => (i === 0 ? 100 : rateOut(def[i]))));
    }
    const keys = Object.keys(cols);
    const r = (await db.query(`INSERT INTO schemes(${keys.join(', ')}, created_by, updated_by) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}, $${keys.length + 1}, $${keys.length + 1}) RETURNING id`,
      [...Object.values(cols), user.id])).rows[0];
    await writeLines(db, r.id, ln.lines);
    return r.id;
  });
  return getScheme(id);
}

/** Change a Draft version (an approved version is amended instead: MSG-SCM-053). */
export async function updateScheme(id, b, user) {
  const before = await getScheme(id);
  await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM schemes WHERE id = $1 FOR UPDATE', [before.id])).rows[0];
    if (row.status !== 'draft') throw conflict(row.status === 'pending-approval' ? `Version ${row.version} of this scheme is already being changed or approved`
      : 'An approved scheme cannot be changed; use Amend to create a new version');
    if (b.schemeNo && String(b.schemeNo).trim().toUpperCase() !== row.scheme_no) throw fail(err('schemeNo', 'The Scheme No. cannot be changed after the first save'));
    if (row.version > 1 && b.schemeType && b.schemeType !== row.scheme_type) throw fail(err('schemeType', 'The scheme type cannot be changed after approval'));
    const g = await general(db, b, row);
    const pp = await productsAndPerils(db, b, row);
    const ct = await commissionAndTerm(b, row, g.cols.scheme_type);
    const ln = b.lines === undefined ? null : await linesOf(db, b.lines, pp.classes);
    const errors = [...g.errors, ...pp.errors, ...ct.errors, ...(ln?.errors || [])];
    if (errors.length) throw fail(errors);
    const cols = { ...g.cols, ...pp.cols, ...ct.cols };
    delete cols.scheme_no;
    const keys = Object.keys(cols);
    await db.query(`UPDATE schemes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
      [row.id, ...Object.values(cols), user.id]);
    if (ln) await writeLines(db, row.id, ln.lines);
  });
  return { before, after: await getScheme(before.id) };
}

/** Delete a Draft version 1 never submitted, by its maker (FR-SCM-001 alternate flow). */
export async function deleteScheme(id, user) {
  const s = await getScheme(id);
  if (s.status !== 'draft' || s.version !== 1 || s.submittedAt) throw conflict('Only a draft that was never submitted can be deleted; withdraw an approved scheme instead');
  if (s.createdById !== user.id) throw forbidden('Only the user who created the draft can delete it');
  await query('DELETE FROM schemes WHERE id = $1', [s.id]);
  return s;
}

/** Copy a scheme into a new Draft (every tab copied) under a new Scheme No. and dates (FR-SCM-001 alternate flow). */
export async function copyScheme(id, b, user) {
  const src = await getScheme(id);
  return createScheme({ schemeNo: b.schemeNo, schemeType: src.schemeType, description: b.description || src.description, effectiveFrom: b.effectiveFrom || null,
    effectiveTo: b.effectiveTo || null, bankChannelId: src.bankChannelId, allDealers: src.allDealers, dealerChannelIds: src.dealerChannelIds, insurerIds: src.insurerIds,
    productId: src.productId, vehicleClasses: src.vehicleClasses, odDeductible: src.odDeductible, perils: src.perils, commissionPct: src.commissionPct,
    dealerCommissionPct: src.dealerCommissionPct, termYears: src.termYears, year1PaidBy: src.year1PaidBy, siSchedule: src.siSchedule, notes: src.notes,
    lines: src.lines.map((l) => ({ brandId: l.brandId, modelId: l.modelId, variantId: l.variantId, yearFrom: l.yearFrom, yearTo: l.yearTo, siFrom: l.siFrom, siTo: l.siTo,
      vehicleClass: l.vehicleClass, odRate: l.odRate, aonRate: l.aonRate })) }, user, { copiedFrom: src.id });
}

/** Every check of FR-SCM-001 to 006 before a version is submitted or approved. */
async function assertComplete(db, row) {
  const g = await general(db, {}, row, { strict: true });
  const pp = await productsAndPerils(db, {}, row, { strict: true });
  const ct = await commissionAndTerm({}, row, row.scheme_type, { strict: true });
  const errors = [...g.errors, ...pp.errors, ...ct.errors];
  const lines = await currentLines(db, row.id);
  if (!lines.length) errors.push(err('lines', 'Add at least one vehicle line'));
  for (const l of lines) {
    if (!l.active) errors.push(err(`lines.${l.lineNo}`, `Line ${l.lineNo}: ${l.vehicle} is not active on the Vehicle master`));
    else if (!pp.classes.includes(l.vehicleClass)) errors.push(err(`lines.${l.lineNo}`, `Line ${l.lineNo}: ${l.vehicleClass} is not a vehicle class of the scheme`));
  }
  if (errors.length) throw fail(errors);
}

/** Submit a Draft for approval (FR-SCM-010). */
export async function submitScheme(id, user) {
  const s = await getScheme(id);
  await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM schemes WHERE id = $1 FOR UPDATE', [s.id])).rows[0];
    if (row.status !== 'draft') throw conflict(`Version ${row.version} of this scheme is already being changed or approved`);
    await assertComplete(db, row);
    await db.query(`UPDATE schemes SET status = 'pending-approval', submitted_by = $2, submitted_at = now(), decided_by = NULL, decided_at = NULL, decision_note = NULL,
      decision_reason_code = NULL WHERE id = $1`, [s.id, user.id]);
  });
  await notifyApprovers({ audience: 'approve:schemes', document: 'Scheme', number: `${s.schemeNo} v${s.version}`, by: user.username, detail: s.description,
    link: `${LINK}?scheme=${s.id}`, entity: 'scheme', entityId: s.id });
  return getScheme(s.id);
}

/** Recall a submitted version to Draft before it is actioned, by the user who submitted it. */
export async function recallScheme(id, user) {
  const s = await getScheme(id);
  if (s.status !== 'pending-approval') throw conflict(`Scheme ${s.schemeNo} is ${s.statusLabel}: only a submitted scheme is recalled`);
  if (s.submittedById !== user.id) throw forbidden('Only the user who submitted the scheme can recall it');
  await query("UPDATE schemes SET status = 'draft', updated_at = now() WHERE id = $1", [s.id]);
  return getScheme(s.id);
}

/**
 * Approve (Scheduled when Effective from is in the future, else Active; an Active new version supersedes the version
 * in force at once, a Scheduled one on its Effective from) or return to Draft with a remark (FR-SCM-010, 012):
 * approve:schemes, never the maker (creator, last editor or submitter) of the version.
 */
export async function decideScheme(id, { decision, note = null, reasonCode = null }, user) {
  if (!['approve', 'return'].includes(decision)) throw badRequest('decision must be approve or return');
  if (!hasPermission(user, 'approve:schemes')) throw forbidden('Requires permission: approve:schemes');
  const r = await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM schemes WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) throw notFound('Scheme not found');
    if (row.status !== 'pending-approval') throw conflict(`Scheme ${row.scheme_no} is ${STATUS_LABELS[row.status]}: nothing to decide`);
    if ([row.created_by, row.updated_by, row.submitted_by].includes(user.id)) throw forbidden('You made or changed this scheme, so another user must approve it');
    if (decision === 'return') {
      if (!String(note || '').trim()) throw fail(err('note', 'Enter the reason for returning the scheme'));
      const why = await decisionReason(db, ['dealer_scheme_return'], { reasonCode, reason: note });
      await db.query("UPDATE schemes SET status = 'draft', decided_by = $2, decided_at = now(), decision_reason_code = $3, decision_note = $4 WHERE id = $1", [id, user.id, why.code, why.text]);
      return { row, reason: why.text };
    }
    const now = await today();
    if (isoDate(row.effective_from) < now) throw conflict(`Effective from ${dmy(row.effective_from)} has passed; return the scheme so the maker can move the date`);
    await assertComplete(db, row);
    const status = isoDate(row.effective_from) > now ? 'scheduled' : 'active';
    if (status === 'active') await db.query("UPDATE schemes SET status = 'superseded' WHERE upper(scheme_no) = upper($1) AND id <> $2 AND status = ANY($3)", [row.scheme_no, id, IN_FORCE]);
    else await db.query("UPDATE schemes SET status = 'superseded' WHERE upper(scheme_no) = upper($1) AND id <> $2 AND status = 'scheduled'", [row.scheme_no, id]);
    await db.query('UPDATE schemes SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4, decision_reason_code = NULL WHERE id = $1',
      [id, status, user.id, String(note || '').trim() || null]);
    return { row, reason: null };
  });
  await notifyDecision({ userId: r.row.submitted_by || r.row.created_by, decidedBy: user.id, document: 'Scheme', number: `${r.row.scheme_no} v${r.row.version}`,
    approved: decision === 'approve', status: decision === 'approve' ? 'approved' : 'returned', by: user.username, reason: r.reason, link: `${LINK}?scheme=${id}`, entity: 'scheme', entityId: id });
  return getScheme(id);
}

/**
 * Suspend, resume or withdraw a scheme (FR-SCM-011) with a remark: approve:schemes. Withdraw sets Effective to to today
 * (Draft, Scheduled, Active, Suspended). Issued policies keep their scheme to the end of their term.
 */
export async function changeSchemeStatus(id, action, { note = null, reasonCode = null }, user) {
  const moves = { suspend: [['active'], 'suspended'], resume: [['suspended'], 'active'], withdraw: [['draft', 'scheduled', 'active', 'suspended'], 'withdrawn'] };
  if (!moves[action]) throw badRequest('Unknown action');
  if (!hasPermission(user, 'approve:schemes')) throw forbidden('Requires permission: approve:schemes');
  if (!String(note || '').trim()) throw fail(err('note', 'Enter the reason'));
  const r = await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM schemes WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) throw notFound('Scheme not found');
    if (!moves[action][0].includes(row.status)) throw conflict(`Scheme ${row.scheme_no} is ${STATUS_LABELS[row.status]}: it cannot be ${{ suspend: 'suspended', resume: 'resumed', withdraw: 'withdrawn' }[action]}`);
    const why = await decisionReason(db, ['dealer_scheme_status'], { reasonCode, reason: note });
    const now = await today();
    let to = moves[action][1];
    if (action === 'resume' && isoDate(row.effective_to) < now) to = 'expired';
    await db.query(`UPDATE schemes SET status = $2, status_reason_code = $3, status_note = $4, status_changed_by = $5, status_changed_at = now()
      ${action === 'withdraw' ? ', effective_to = LEAST(COALESCE(effective_to, $6::date), $6::date), effective_from = LEAST(COALESCE(effective_from, $6::date), $6::date)' : ''} WHERE id = $1`,
    [id, to, why.code, why.text, user.id, ...(action === 'withdraw' ? [now] : [])]);
    return { row };
  });
  const inForce = await policiesInForce(r.row.scheme_no);
  return { scheme: await getScheme(id), policiesInForce: inForce, before: { status: r.row.status } };
}

/** Amend a scheme in force as the next version in Draft, copied from it (FR-SCM-012). */
export async function amendScheme(id, user) {
  const newId = await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM schemes WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) throw notFound('Scheme not found');
    if (!IN_FORCE.includes(row.status)) throw conflict(`Scheme ${row.scheme_no} is ${STATUS_LABELS[row.status]}: only a scheduled, active or suspended scheme is amended`);
    const open = (await db.query("SELECT version FROM schemes WHERE upper(scheme_no) = upper($1) AND status IN ('draft', 'pending-approval')", [row.scheme_no])).rows[0];
    if (open) throw conflict(`Version ${open.version} of this scheme is already being changed or approved`);
    const top = (await db.query('SELECT max(version)::int AS v FROM schemes WHERE upper(scheme_no) = upper($1)', [row.scheme_no])).rows[0].v;
    const r = (await db.query(`INSERT INTO schemes(scheme_no, version, scheme_type, description, effective_from, effective_to, bank_channel_id, all_dealers, dealer_channel_ids,
        insurer_ids, product_id, vehicle_classes, od_deductible, perils, commission_pct, dealer_commission_pct, term_years, year1_paid_by, si_schedule, notes, copied_from, created_by, updated_by)
      SELECT scheme_no, $2, scheme_type, description, GREATEST(effective_from, $4::date), effective_to, bank_channel_id, all_dealers, dealer_channel_ids, insurer_ids, product_id,
        vehicle_classes, od_deductible, perils, commission_pct, dealer_commission_pct, term_years, year1_paid_by, si_schedule, notes, id, $3, $3
      FROM schemes WHERE id = $1 RETURNING id`, [id, top + 1, user.id, await today()])).rows[0];
    await db.query(`INSERT INTO scheme_vehicle_lines(scheme_id, line_no, brand_id, model_id, variant_id, year_from, year_to, si_from, si_to, vehicle_class, od_rate, aon_rate)
      SELECT $2, line_no, brand_id, model_id, variant_id, year_from, year_to, si_from, si_to, vehicle_class, od_rate, aon_rate FROM scheme_vehicle_lines WHERE scheme_id = $1`, [id, r.id]);
    return r.id;
  });
  return getScheme(newId);
}

/** Discard a Draft version n > 1 (the version in force is unchanged), by its maker. */
export async function discardVersion(id, user) {
  const s = await getScheme(id);
  if (s.status !== 'draft' || s.version === 1) throw conflict('Only a draft version of an amendment can be discarded');
  if (s.createdById !== user.id && !hasPermission(user, 'approve:schemes')) throw forbidden('Only the user who amended the scheme can discard the draft version');
  await query('DELETE FROM schemes WHERE id = $1', [s.id]);
  return s;
}

/**
 * Daily job scheme-status (FR-SCM-011): Scheduled versions whose Effective from is reached become Active (the version
 * they replace becomes Superseded); Active and Suspended versions whose Effective to has passed become Expired.
 */
export async function schemeStatus({ date = null } = {}) {
  const now = date || await today();
  const started = await many("SELECT id, scheme_no FROM schemes WHERE status = 'scheduled' AND effective_from <= $1::date AND effective_to >= $1::date", [now]);
  for (const s of started) {
    await query("UPDATE schemes SET status = 'superseded' WHERE upper(scheme_no) = upper($1) AND id <> $2 AND status IN ('active', 'suspended')", [s.scheme_no, s.id]);
    await query("UPDATE schemes SET status = 'active' WHERE id = $1", [s.id]);
  }
  const ended = await many("UPDATE schemes SET status = 'expired' WHERE status IN ('scheduled', 'active', 'suspended') AND effective_to < $1::date RETURNING scheme_no", [now]);
  return { activated: started.length, expired: ended.length };
}

// ---------------------------------------------------------------- choices

/** Choices of the scheme form: Motor products, vehicle classes, the peril table of each product, limits, vehicles, settings. */
export async function schemeChoices() {
  const products = await many("SELECT id, code, name FROM products WHERE line = 'motor' AND status = 'active' ORDER BY name");
  const tariff = await motorTariff();
  const limits = await many("SELECT kind, amount, premium FROM coverages WHERE status = 'active' AND kind IN ('bi', 'pd') ORDER BY kind, amount");
  const amounts = (k) => [...new Set(limits.filter((l) => l.kind === k).map((l) => Number(l.amount)))];
  const vehicles = await many(`SELECT b.id AS brand_id, b.name AS brand, m.id AS model_id, m.name AS model, v.id AS variant_id, v.name AS variant, v.seating
    FROM vehicle_brands b LEFT JOIN vehicle_models m ON m.brand_id = b.id AND m.status = 'active' LEFT JOIN vehicle_variants v ON v.model_id = m.id AND v.status = 'active'
    WHERE b.status = 'active' ORDER BY b.name, m.name, v.name`);
  const perils = {};
  for (const p of products) perils[p.id] = (await perilTemplate(p.id)).perils;
  return {
    products: products.map((p) => ({ value: p.id, label: p.name, code: p.code })),
    vehicleClasses: tariff.vehicleTypes.map((c) => ({ value: c.value, label: c.label, seats: c.defaultSeats, ctplPremium: c.ctplPremium, ctplPremium3Year: c.ctplPremium3Year })),
    perils, limits: { bi: amounts('bi'), pd: amounts('pd'), appa: tariff.appa.limits, pad: amounts('bi') },
    vehicles: vehicles.map((v) => ({ brandId: v.brand_id, brand: v.brand, modelId: v.model_id, model: v.model, variantId: v.variant_id, variant: v.variant, seats: v.seating })),
    schemeTypes: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
    year1PaidBy: [{ value: 'dealer', label: PAID_BY_LABELS.dealer }, { value: 'client-ada', label: PAID_BY_LABELS['client-ada'] }],
    standardRates: await standardRates(),
    maxTermYears: Number(await getSetting('schemes.max_term_years', 5)),
    defaultTermYears: Number(await getSetting('schemes.default_term_years', 5)),
    defaultSchedule: (await getSetting('schemes.default_schedule', [100, 90, 80, 70, 60])) || [],
    maxPeriodMonths: Number(await getSetting('schemes.max_period_months', 24)),
  };
}

// ---------------------------------------------------------------- vehicle lines upload (FR-SCM-004)

/** Columns of the Upload vehicle lines file; the template (Scheme_Vehicle_Lines_Upload_Template.xlsx) is built from this list. */
export const SCHEME_LINE_COLUMNS = [
  { key: 'schemeNo', header: 'SCHEME_NO', aliases: ['scheme no', 'scheme'], required: true, format: 'Scheme No. of a Draft scheme', example: 'S1-STD-2027' },
  { key: 'make', header: 'MAKE', aliases: ['brand'], required: true, format: 'Active brand of Master > Insurance > Vehicle', example: 'Toyota' },
  { key: 'model', header: 'MODEL', format: 'Active model of the make; blank or ALL = all models', example: 'Vios' },
  { key: 'variant', header: 'VARIANT', format: 'Active variant of the model; blank or ALL = all variants', example: 'ALL' },
  { key: 'yearFrom', header: 'YEAR_FROM', required: true, format: 'Year YYYY', example: '2026' },
  { key: 'yearTo', header: 'YEAR_TO', required: true, format: 'Year YYYY, on or after YEAR_FROM', example: '2027' },
  { key: 'siFrom', header: 'SI_FROM', required: true, format: 'Amount in PHP', example: '500000' },
  { key: 'siTo', header: 'SI_TO', required: true, format: 'Amount in PHP, higher than SI_FROM', example: '1300000' },
  { key: 'vehicleClass', header: 'VEHICLE_CLASS', required: true, format: 'Code of a vehicle class of the scheme (Motor tariff)', example: 'private_cars' },
  { key: 'odRate', header: 'OD_RATE', format: 'Line Own Damage rate %, up to 4 decimals; blank = the peril rate', example: '' },
  { key: 'aonRate', header: 'AON_RATE', format: 'Line Acts of Nature rate %, up to 4 decimals; blank = the peril rate', example: '' },
];

/**
 * Upload vehicle lines from the rows of an .xlsx Data sheet (FR-SCM-004): each row is checked with the rules of FR-SCM-003
 * and added on its own; mode add appends to the lines of the scheme, replace replaces them (only when one row at least is
 * valid). Rows name their scheme (SCHEME_NO), or the scheme chosen on the screen applies.
 */
export async function uploadLines({ rows, headers, schemeId = null, mode = 'add', fileName = null }, user) {
  if (fileName && !String(fileName).toLowerCase().endsWith('.xlsx')) throw fail(err('file', 'Upload an Excel (.xlsx) file'));
  const max = Number(await getSetting('schemes.max_rows', 2000));
  if (rows.length > max) throw fail(err('file', `The file has ${rows.length} rows; the limit is ${max}`));
  const { normKey, mapColumns } = await import('../documents/tabular.js');
  const have = new Set(headers || []);
  for (const c of SCHEME_LINE_COLUMNS.filter((x) => x.required === true && (x.key !== 'schemeNo' || !schemeId))) {
    if (headers && ![c.key, c.header, ...(c.aliases || [])].some((h) => have.has(normKey(h)))) throw fail(err('file', `Column ${c.header} is missing from the Data sheet`));
  }
  if (!['add', 'replace'].includes(mode)) throw fail(err('mode', 'The upload mode is Add or Replace'));
  const chosen = schemeId ? await schemeRow(schemeId) : null;
  if (chosen && chosen.status !== 'draft') throw conflict('Lines can be uploaded only to a Draft scheme');
  const errors = [];
  const bySchemes = new Map();
  for (const [i, raw] of rows.entries()) {
    const v = mapColumns(raw, SCHEME_LINE_COLUMNS);
    const rowNo = i + 2;
    const no = String(v.schemeNo || chosen?.scheme_no || '').trim().toUpperCase();
    const s = no ? (await one("SELECT * FROM schemes WHERE upper(scheme_no) = $1 AND status = 'draft'", [no])) : null;
    if (!s) { errors.push({ row: rowNo, message: no ? 'Lines can be uploaded only to a Draft scheme' : 'SCHEME_NO is required' }); continue; }
    if (chosen && s.id !== chosen.id) { errors.push({ row: rowNo, message: `SCHEME_NO ${no} is not the scheme chosen (${chosen.scheme_no})` }); continue; }
    const missing = SCHEME_LINE_COLUMNS.filter((c) => c.required === true && c.key !== 'schemeNo' && !v[c.key]).map((c) => c.header);
    if (missing.length) { errors.push({ row: rowNo, message: `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required` }); continue; }
    if (!bySchemes.has(s.id)) bySchemes.set(s.id, { scheme: s, accepted: mode === 'replace' ? [] : await currentLines({ query }, s.id), rows: [] });
    const target = bySchemes.get(s.id);
    const n = target.accepted.length + 1;
    const r = await checkLine({ query }, { make: v.make, model: v.model, variant: v.variant, yearFrom: v.yearFrom, yearTo: v.yearTo, siFrom: v.siFrom, siTo: v.siTo,
      vehicleClass: v.vehicleClass, odRate: v.odRate || null, aonRate: v.aonRate || null }, n, target.accepted, s.vehicle_classes || []);
    if (r.error) { errors.push({ row: rowNo, message: r.error.replace(/^Line \d+: /, '') }); continue; }
    target.accepted.push(r.line);
    target.rows.push(r.line);
  }
  let created = 0;
  for (const { scheme, rows: added, accepted } of bySchemes.values()) {
    if (!added.length) continue;
    await withTransaction(async (db) => {
      if (mode === 'replace') await writeLines(db, scheme.id, accepted);
      else await writeLines(db, scheme.id, added, { replace: false });
      await db.query('UPDATE schemes SET updated_by = $2, updated_at = now() WHERE id = $1', [scheme.id, user.id]);
    });
    created += added.length;
  }
  errors.sort((a, b) => a.row - b.row);
  return { message: `Processed ${rows.length} rows: ${created} created, ${errors.length} failed`, total: rows.length, created, failed: errors.length,
    errors: errors.map((e) => ({ ...e, text: `Row ${e.row}: ${e.message}` })), schemes: [...bySchemes.values()].map((x) => x.scheme.scheme_no) };
}

// ---------------------------------------------------------------- export (FR-SCM-007)

/** The three sheets of the export: schemes, perils and vehicle lines of the listed schemes. */
export async function exportSheets(q) {
  const list = await listSchemes(q);
  const schemes = [];
  const perils = [];
  const lines = [];
  for (const s of list) {
    const d = await getScheme(s.id);
    schemes.push({ schemeNo: d.schemeNo, version: d.version, type: d.schemeTypeLabel, description: d.description, effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo,
      bank: d.bankName, dealers: d.allDealers ? 'All dealers' : d.dealers.map((x) => x.name).join(', '), insurers: d.insurers.map((x) => x.name).join(', '), product: d.productName,
      classes: d.vehicleClasses.join(', '), lines: d.lineCount, commissionPct: d.commissionPct, dealerPct: d.dealerCommissionPct, term: d.termYears,
      schedule: (d.siSchedule || []).join(' / '), status: d.statusLabel });
    for (const p of d.perils) perils.push({ schemeNo: d.schemeNo, version: d.version, peril: p.name, included: p.included ? 'Included' : 'Not covered', basis: p.basisLabel, rate: p.rate, premium: p.premium, limit: p.limit });
    for (const l of d.lines) lines.push({ schemeNo: d.schemeNo, version: d.version, lineNo: l.lineNo, make: l.brand, model: l.model || 'All models', variant: l.variant || 'All variants',
      yearFrom: l.yearFrom, yearTo: l.yearTo, siFrom: l.siFrom, siTo: l.siTo, vehicleClass: l.vehicleClass, odRate: l.odRate, aonRate: l.aonRate });
  }
  const col = (key, header, type = 'text') => ({ key, header, type });
  return [
    { name: 'Schemes', columns: [col('schemeNo', 'Scheme No.'), col('version', 'Version', 'integer'), col('type', 'Scheme type'), col('description', 'Description'),
      col('effectiveFrom', 'Effective from', 'date'), col('effectiveTo', 'Effective to', 'date'), col('bank', 'Financing bank'), col('dealers', 'Dealers'), col('insurers', 'Insurers'),
      col('product', 'Product'), col('classes', 'Vehicle classes'), col('lines', 'Vehicle lines', 'integer'), col('commissionPct', 'Commission %', 'number'), col('dealerPct', 'Dealer commission %', 'number'),
      col('term', 'Term (years)', 'integer'), col('schedule', 'Sum insured % by year'), col('status', 'Status')], rows: schemes },
    { name: 'Perils', columns: [col('schemeNo', 'Scheme No.'), col('version', 'Version', 'integer'), col('peril', 'Peril'), col('included', 'In the scheme'), col('basis', 'Rate basis'),
      col('rate', 'Rate %', 'number'), col('premium', 'Fixed premium', 'money'), col('limit', 'Limit', 'money')], rows: perils },
    { name: 'Vehicle lines', columns: [col('schemeNo', 'Scheme No.'), col('version', 'Version', 'integer'), col('lineNo', 'Line', 'integer'), col('make', 'Make'), col('model', 'Model'),
      col('variant', 'Variant'), col('yearFrom', 'Year model from', 'integer'), col('yearTo', 'Year model to', 'integer'), col('siFrom', 'Sum insured from', 'money'), col('siTo', 'Sum insured to', 'money'),
      col('vehicleClass', 'Vehicle class'), col('odRate', 'OD % (line)', 'number'), col('aonRate', 'AON % (line)', 'number')], rows: lines },
  ];
}

export { pct2 };
