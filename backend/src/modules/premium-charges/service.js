/**
 * Premium taxes and charges master (premium_charge_rules), LGU tax rates (lgu_tax_rates) and chargesFor(), the one
 * entry point every premium is taxed through: the quick quote comparison, package bundles, quotations (and so
 * endorsements and placement slips), insurer offers on broker slips, the renewal queue quote, the renewal quotation
 * and the product configurator illustration. The flat tax.* settings are only the fallback of a tax kind that has no
 * rule at all (fallbackRules()).
 */
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { calculateCharges, lineOf } from './calculator.js';

const run = (db) => db || { query };

export const toRule = (r) => ({
  code: r.code, name: r.name, kind: r.kind, method: r.method, rate: Number(r.rate), unitAmount: Number(r.unit_amount), unitSize: Number(r.unit_size),
  fractionRule: r.fraction_rule, lines: r.lines || null, regimes: r.regimes || null, minimumAmount: Number(r.minimum_amount), sortOrder: r.sort_order,
  active: r.active, effectiveFrom: r.effective_from, effectiveTo: r.effective_to, remarks: r.remarks, updatedBy: r.updated_by, updatedAt: r.updated_at,
});

export const toLgu = (r) => ({
  id: r.id, code: r.code, name: r.name, province: r.province, cityId: r.city_id, cityName: r.city_name || null, rate: Number(r.rate),
  effectiveFrom: r.effective_from, effectiveTo: r.effective_to, active: r.active, remarks: r.remarks, updatedBy: r.updated_by, updatedAt: r.updated_at,
});

// ------------------------------------------------------------------ charge rules

export async function listRules({ active } = {}, db = null) {
  const where = active === 'true' || active === true ? 'WHERE active' : active === 'false' || active === false ? 'WHERE NOT active' : '';
  return (await run(db).query(`SELECT * FROM premium_charge_rules ${where} ORDER BY sort_order, code`)).rows.map(toRule);
}

export async function getRule(code, db = null) {
  const r = (await run(db).query('SELECT * FROM premium_charge_rules WHERE code = $1', [String(code).toUpperCase()])).rows[0];
  if (!r) throw notFound(`Charge rule ${code} not found`);
  return toRule(r);
}

const ruleColumns = (b, base = {}) => ({
  name: b.name ?? base.name,
  kind: b.kind ?? base.kind,
  method: b.method ?? base.method ?? 'percent',
  rate: b.rate ?? base.rate ?? 0,
  unit_amount: b.unitAmount ?? base.unitAmount ?? 0,
  unit_size: b.unitSize ?? base.unitSize ?? 0,
  fraction_rule: b.fractionRule ?? base.fractionRule ?? 'round_up',
  lines: b.lines !== undefined ? (b.lines && b.lines.length ? b.lines.map((l) => lineOf(l)) : null) : base.lines ?? null,
  regimes: b.regimes !== undefined ? (b.regimes && b.regimes.length ? b.regimes : null) : base.regimes ?? null,
  minimum_amount: b.minimumAmount ?? base.minimumAmount ?? 0,
  sort_order: b.sortOrder ?? base.sortOrder ?? 100,
  active: b.active ?? base.active ?? true,
  effective_from: b.effectiveFrom ?? base.effectiveFrom ?? '2026-01-01',
  effective_to: b.effectiveTo !== undefined ? b.effectiveTo : base.effectiveTo ?? null,
  remarks: b.remarks !== undefined ? b.remarks : base.remarks ?? null,
});

function checkRule(v) {
  if (v.method === 'per_unit' && !(Number(v.unit_size) > 0)) throw badRequest('Validation failed', [{ path: 'unitSize', message: 'A per unit charge needs the premium per unit (e.g. 4.00)' }]);
  if (v.method === 'flat' && !(Number(v.unit_amount) > 0)) throw badRequest('Validation failed', [{ path: 'unitAmount', message: 'A flat charge needs its amount' }]);
  if (v.effective_to && v.effective_to < v.effective_from) throw badRequest('Validation failed', [{ path: 'effectiveTo', message: 'effectiveTo must be on or after effectiveFrom' }]);
}

const COLS = ['name', 'kind', 'method', 'rate', 'unit_amount', 'unit_size', 'fraction_rule', 'lines', 'regimes', 'minimum_amount', 'sort_order', 'active', 'effective_from', 'effective_to', 'remarks'];

export async function createRule(b, user) {
  const code = String(b.code).trim().toUpperCase();
  const v = ruleColumns(b);
  checkRule(v);
  if ((await query('SELECT 1 FROM premium_charge_rules WHERE code = $1', [code])).rowCount) throw conflict(`Charge rule ${code} already exists`);
  await query(`INSERT INTO premium_charge_rules(code, ${COLS.join(', ')}, created_by, updated_by)
    VALUES ($1, ${COLS.map((_, i) => `$${i + 2}`).join(', ')}, $${COLS.length + 2}, $${COLS.length + 2})`, [code, ...COLS.map((c) => v[c]), user?.id ?? null]);
  return getRule(code);
}

export async function updateRule(code, b, user) {
  const before = await getRule(code);
  const v = ruleColumns(b, before);
  checkRule(v);
  await query(`UPDATE premium_charge_rules SET ${COLS.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_by = $${COLS.length + 2} WHERE code = $1`,
    [before.code, ...COLS.map((c) => v[c]), user?.id ?? null]);
  return { before, after: await getRule(before.code) };
}

/** Only "other" charges can be deleted; the statutory taxes are switched off instead (active false). */
export async function deleteRule(code) {
  const before = await getRule(code);
  if (before.kind !== 'other') throw badRequest(`${before.name} is a statutory tax: switch it off (active) instead of deleting it`);
  await query('DELETE FROM premium_charge_rules WHERE code = $1', [before.code]);
  return before;
}

// ------------------------------------------------------------------ LGU tax rates

const LGU_SELECT = 'SELECT l.*, c.name AS city_name FROM lgu_tax_rates l LEFT JOIN cities c ON c.id = l.city_id';

export async function listLgus({ active, search } = {}, db = null) {
  const where = ['TRUE'];
  const values = [];
  if (active === 'true' || active === true) where.push('l.active');
  if (active === 'false' || active === false) where.push('NOT l.active');
  if (search) { values.push(`%${search}%`); where.push(`(l.name ILIKE $${values.length} OR l.code ILIKE $${values.length} OR l.province ILIKE $${values.length})`); }
  return (await run(db).query(`${LGU_SELECT} WHERE ${where.join(' AND ')} ORDER BY l.province NULLS LAST, l.name`, values)).rows.map(toLgu);
}

export async function getLgu(id, db = null) {
  const r = (await run(db).query(`${LGU_SELECT} WHERE l.id::text = $1 OR l.code = upper($1)`, [String(id)])).rows[0];
  if (!r) throw notFound(`LGU tax rate ${id} not found`);
  return toLgu(r);
}

const lguColumns = (b, base = {}) => ({
  code: b.code !== undefined ? String(b.code).trim().toUpperCase() : base.code,
  name: b.name ?? base.name,
  province: b.province !== undefined ? b.province : base.province ?? null,
  city_id: b.cityId !== undefined ? b.cityId : base.cityId ?? null,
  rate: b.rate ?? base.rate,
  effective_from: b.effectiveFrom ?? base.effectiveFrom ?? '2026-01-01',
  effective_to: b.effectiveTo !== undefined ? b.effectiveTo : base.effectiveTo ?? null,
  active: b.active ?? base.active ?? true,
  remarks: b.remarks !== undefined ? b.remarks : base.remarks ?? null,
});
const LGU_COLS = ['code', 'name', 'province', 'city_id', 'rate', 'effective_from', 'effective_to', 'active', 'remarks'];

async function checkLgu(db, v, exceptId = null) {
  if (v.effective_to && v.effective_to < v.effective_from) throw badRequest('Validation failed', [{ path: 'effectiveTo', message: 'effectiveTo must be on or after effectiveFrom' }]);
  if (v.city_id && !(await db.query('SELECT 1 FROM cities WHERE id = $1', [v.city_id])).rowCount) throw badRequest('Validation failed', [{ path: 'cityId', message: `City ${v.city_id} not found` }]);
  if ((await db.query('SELECT 1 FROM lgu_tax_rates WHERE code = $1 AND ($2::int IS NULL OR id <> $2)', [v.code, exceptId])).rowCount) throw conflict(`LGU code ${v.code} already exists`);
}

export async function createLgu(b, user) {
  return withTransaction(async (db) => {
    const v = lguColumns(b);
    await checkLgu(db, v);
    const r = await db.query(`INSERT INTO lgu_tax_rates(${LGU_COLS.join(', ')}, created_by, updated_by) VALUES (${LGU_COLS.map((_, i) => `$${i + 1}`).join(', ')}, $${LGU_COLS.length + 1}, $${LGU_COLS.length + 1}) RETURNING id`,
      [...LGU_COLS.map((c) => v[c]), user?.id ?? null]);
    return getLgu(r.rows[0].id, db);
  });
}

export async function updateLgu(id, b, user) {
  return withTransaction(async (db) => {
    const before = await getLgu(id, db);
    const v = lguColumns(b, before);
    await checkLgu(db, v, before.id);
    await db.query(`UPDATE lgu_tax_rates SET ${LGU_COLS.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_by = $${LGU_COLS.length + 2} WHERE id = $1`,
      [before.id, ...LGU_COLS.map((c) => v[c]), user?.id ?? null]);
    return { before, after: await getLgu(before.id, db) };
  });
}

export async function deleteLgu(id) {
  const before = await getLgu(id);
  await query('DELETE FROM lgu_tax_rates WHERE id = $1', [before.id]);
  return before;
}

/**
 * The LGU rate in force on a date for a code, id, city id or city name; the default LGU (tax.charge_engine.default_lgu)
 * when none is given; null when there is none (the LGT rule rate applies).
 */
export async function lguFor({ lguCode = null, lguId = null, cityId = null, city = null } = {}, date = null, db = null) {
  let code = lguCode || null;
  if (!code && !lguId && !cityId && !city) code = (await getSetting('tax.charge_engine.default_lgu', '')) || null;
  if (!code && !lguId && !cityId && !city) return null;
  const d = date || (await today());
  const r = (await run(db).query(`${LGU_SELECT} WHERE l.active AND l.effective_from <= $5::date AND (l.effective_to IS NULL OR l.effective_to >= $5::date)
      AND (($1::text IS NOT NULL AND l.code = upper($1)) OR ($2::int IS NOT NULL AND l.id = $2) OR ($3::int IS NOT NULL AND l.city_id = $3)
        OR ($4::text IS NOT NULL AND (lower(l.name) = lower($4) OR lower(c.name) = lower($4))))
    ORDER BY l.effective_from DESC, l.id LIMIT 1`, [code, lguId ? Number(lguId) : null, cityId ? Number(cityId) : null, city || null, d])).rows[0];
  return r ? toLgu(r) : null;
}

// ------------------------------------------------------------------ calculation

/**
 * Fallback rules from the flat tax.* settings for the statutory taxes that have no rule at all in the table (not
 * merely switched off or out of date: a rule switched off means the tax is not charged). VAT on products under the
 * VAT regime, DST and LGT on every premium, FST on fire lines, all as a percent of the premium.
 */
export const FALLBACK_SETTINGS = [
  { kind: 'vat', key: 'tax.vat_rate', code: 'VAT', name: 'Value Added Tax', regimes: ['vat'], lines: null, sortOrder: 10 },
  { kind: 'dst', key: 'tax.dst_rate', code: 'DST', name: 'Documentary Stamp Tax', regimes: null, lines: null, sortOrder: 30 },
  { kind: 'fst', key: 'tax.fst_rate', code: 'FST', name: 'Fire Service Tax', regimes: null, lines: ['fire'], sortOrder: 40 },
  { kind: 'lgt', key: 'tax.lgt_rate', code: 'LGT', name: 'Local Government Tax', regimes: null, lines: null, sortOrder: 50 },
];

export async function fallbackRules(db = null) {
  const kinds = new Set((await run(db).query('SELECT DISTINCT kind FROM premium_charge_rules')).rows.map((r) => r.kind));
  const out = [];
  for (const f of FALLBACK_SETTINGS) {
    if (kinds.has(f.kind)) continue;
    const rate = Number(await getSetting(f.key, 0)) || 0;
    if (rate > 0) {
      out.push({ code: f.code, name: f.name, kind: f.kind, method: 'percent', rate: Math.round(rate * 100 * 1e6) / 1e6, unitAmount: 0, unitSize: 0, fractionRule: 'round_up',
        lines: f.lines, regimes: f.regimes, minimumAmount: 0, sortOrder: f.sortOrder, active: true, effectiveFrom: null, effectiveTo: null, remarks: `Fallback: ${f.key}`, fallback: true });
    }
  }
  return out;
}

/** Rules in force on a date (rows in API shape), plus the settings fallback of a tax kind that has no rule. */
export async function rulesInForce(date = null, db = null) {
  const d = date || (await today());
  const rows = (await run(db).query(`SELECT * FROM premium_charge_rules WHERE active AND effective_from <= $1::date AND (effective_to IS NULL OR effective_to >= $1::date)
    ORDER BY sort_order, code`, [d])).rows.map(toRule);
  return [...rows, ...(await fallbackRules(db))];
}

/** Line and tax regime of a product (by id or code); { line: null, regime: 'vat' } when unknown. */
export async function productTaxProfile(productId, db = null) {
  if (!productId) return { productId: null, line: null, regime: 'vat', name: null };
  const p = (await run(db).query('SELECT id, code, name, line, premium_tax_regime FROM products WHERE id::text = $1 OR upper(code) = upper($1) LIMIT 1', [String(productId)])).rows[0];
  if (!p) return { productId: null, line: null, regime: 'vat', name: null };
  return { productId: p.id, code: p.code, name: p.name, line: p.line, regime: p.premium_tax_regime || 'vat' };
}

/**
 * Charges of a premium: the product's line and tax regime (or the line / regime given), the LGU rate of the location,
 * the rules in force on the date. Returns calculateCharges() plus { line, regime, lgu, date }.
 * `rules` may be passed to price many premiums with one read (comparison matrix, package sections).
 */
export async function chargesFor({ premium, productId = null, line = null, lob = null, regime = null, property = null, lguCode = null, lguId = null, cityId = null, city = null,
  date = null, includeFlat = true, rules = null, lgu = undefined } = {}, db = null) {
  const d = date || (await today());
  const profile = await productTaxProfile(productId, db);
  const ln = lineOf(line || profile.line || lob);
  const rg = regime || profile.regime || 'vat';
  const place = lgu !== undefined ? lgu : await lguFor({ lguCode, lguId, cityId, city }, d, db);
  const result = calculateCharges(rules || (await rulesInForce(d, db)), { premium, line: ln, regime: rg, property, lguRate: place ? place.rate : null, includeFlat, date: d });
  return { ...result, line: ln, regime: rg, date: d, lgu: place ? { code: place.code, name: place.name, rate: place.rate } : null };
}

/**
 * Quotation taxes from the engine, in the fields premiumBreakdown() stores: VAT, DST, LGT and FST in their columns; the
 * premium tax and other charges go to "others" (accountPremiumOthers) and the full list to `charges`.
 */
export async function quotationCharges(v, net, lob, db = null) {
  const c = await chargesFor({ premium: net, productId: v.productId || null, lob, regime: v.premiumTaxRegime || null, lguCode: v.lguCode || null,
    city: v.lguCity || null, property: v.propertySection === undefined ? null : v.propertySection }, db);
  return {
    tax: { valueAddedTax: c.vat, documentaryStampTax: c.dst, localGovernmentTax: c.lgt, fireServiceTax: c.fst },
    others: c.premiumTax + c.other,
    charges: { lines: c.lines, premiumTax: c.premiumTax, other: c.other, taxes: c.taxes, totalCharges: c.totalCharges, regime: c.regime, lgu: c.lgu, line: c.line, date: c.date },
  };
}
