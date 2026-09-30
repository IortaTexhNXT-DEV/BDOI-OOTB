/**
 * Insurer rate tables (Master > Packaged Products > Insurer Rate Tables): per insurer and product the rate basis, rate,
 * minimum premium, deductible, key benefits, commission rate and effective dates. The quick quote comparison prices
 * every insurer from its row; package sections use the row of the section's insurer when there is one.
 * Rule: no two active rows of the same insurer and product with overlapping dates.
 */
import { many, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';

export const RATE_BASES = ['percent', 'per_mille', 'flat'];

const SELECT = `SELECT r.*, ic.name AS insurer_name, ic.code AS insurer_code, p.name AS product_name, p.code AS product_code, p.line AS product_line
  FROM insurer_rate_tables r JOIN insurance_companies ic ON ic.id = r.insurance_company_id JOIN products p ON p.id = r.product_id`;

export const toRateTable = (r) => ({
  id: r.id, insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name, insurerCode: r.insurer_code,
  productId: r.product_id, productName: r.product_name, productCode: r.product_code, productLine: r.product_line,
  rateBasis: r.rate_basis, rate: Number(r.rate), minimumPremium: Number(r.minimum_premium), deductible: r.deductible,
  deductibleAmount: r.deductible_amount === null ? null : Number(r.deductible_amount), keyBenefits: Array.isArray(r.key_benefits) ? r.key_benefits : [],
  commissionRate: r.commission_rate === null ? null : Number(r.commission_rate), effectiveFrom: r.effective_from, effectiveTo: r.effective_to,
  active: r.active, remarks: r.remarks, updatedBy: r.updated_by, updatedAt: r.updated_at,
});

/**
 * Premium of a sum insured on a rate: percent (sum insured x rate / 100), per mille (x rate / 1000) or flat (the rate
 * is the premium); the minimum premium applies when the computed premium is lower.
 */
export function premiumOnRate({ rateBasis = 'percent', rate = 0, minimumPremium = 0 }, sumInsured) {
  const si = Number(sumInsured) || 0;
  const r = Number(rate) || 0;
  const computed = rateBasis === 'flat' ? round2(r) : rateBasis === 'per_mille' ? round2((si * r) / 1000) : round2((si * r) / 100);
  const min = round2(Number(minimumPremium) || 0);
  return computed < min ? { premium: min, computed, minimumApplied: true } : { premium: computed, computed, minimumApplied: false };
}

export async function listRateTables(q = {}) {
  const where = ['TRUE'];
  const values = [];
  const add = (sql, v) => { values.push(v); where.push(sql.replaceAll('?', `$${values.length}`)); };
  if (q.insuranceCompanyId) add('r.insurance_company_id = ?', Number(q.insuranceCompanyId));
  if (q.productId) add('r.product_id = ?', Number(q.productId));
  if (q.active === 'true' || q.active === true) where.push('r.active');
  if (q.active === 'false' || q.active === false) where.push('NOT r.active');
  if (q.search) add('(ic.name ILIKE ? OR p.name ILIKE ? OR r.remarks ILIKE ?)', `%${q.search}%`);
  return (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY p.name, ic.name, r.effective_from DESC`, values)).map(toRateTable);
}

async function fetchRateTable(db, id) {
  const r = (await db.query(`${SELECT} WHERE r.id = $1`, [Number(id)])).rows[0];
  if (!r) throw notFound(`Rate table ${id} not found`);
  return toRateTable(r);
}
export const getRateTable = (id) => fetchRateTable({ query }, id);

/** The row in force for an insurer and product on a date (latest effective_from), else null. */
export async function rateTableFor(db, insurerId, productId, date) {
  const r = (await (db || { query }).query(`${SELECT} WHERE r.active AND r.insurance_company_id = $1 AND r.product_id = $2
    AND r.effective_from <= $3::date AND (r.effective_to IS NULL OR r.effective_to >= $3::date) ORDER BY r.effective_from DESC, r.id DESC LIMIT 1`,
  [Number(insurerId), Number(productId), date])).rows[0];
  return r ? toRateTable(r) : null;
}

/** Every row in force for a product on a date, one per insurer (active insurers only). */
export async function rateTablesInForce(db, productId, date) {
  const rows = (await (db || { query }).query(`${SELECT} WHERE r.active AND ic.status = 'active' AND r.product_id = $1
    AND r.effective_from <= $2::date AND (r.effective_to IS NULL OR r.effective_to >= $2::date) ORDER BY r.insurance_company_id, r.effective_from DESC, r.id DESC`,
  [Number(productId), date])).rows;
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.insurance_company_id) ? false : seen.add(r.insurance_company_id))).map(toRateTable);
}

const columnsOf = (b, base = {}) => ({
  insurance_company_id: b.insuranceCompanyId ?? base.insuranceCompanyId,
  product_id: b.productId ?? base.productId,
  rate_basis: b.rateBasis ?? base.rateBasis ?? 'percent',
  rate: b.rate ?? base.rate ?? 0,
  minimum_premium: b.minimumPremium ?? base.minimumPremium ?? 0,
  deductible: b.deductible !== undefined ? b.deductible : base.deductible ?? null,
  deductible_amount: b.deductibleAmount !== undefined ? b.deductibleAmount : base.deductibleAmount ?? null,
  key_benefits: JSON.stringify(b.keyBenefits ?? base.keyBenefits ?? []),
  commission_rate: b.commissionRate !== undefined ? b.commissionRate : base.commissionRate ?? null,
  effective_from: b.effectiveFrom ?? base.effectiveFrom,
  effective_to: b.effectiveTo !== undefined ? b.effectiveTo : base.effectiveTo ?? null,
  active: b.active ?? base.active ?? true,
  remarks: b.remarks !== undefined ? b.remarks : base.remarks ?? null,
});
const COLS = ['insurance_company_id', 'product_id', 'rate_basis', 'rate', 'minimum_premium', 'deductible', 'deductible_amount', 'key_benefits', 'commission_rate',
  'effective_from', 'effective_to', 'active', 'remarks'];

async function check(db, v, exceptId = null) {
  if (!(await db.query('SELECT 1 FROM insurance_companies WHERE id = $1', [v.insurance_company_id])).rowCount) {
    throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: `Insurance company ${v.insurance_company_id} not found` }]);
  }
  if (!(await db.query('SELECT 1 FROM products WHERE id = $1', [v.product_id])).rowCount) throw badRequest('Validation failed', [{ path: 'productId', message: `Product ${v.product_id} not found` }]);
  if (v.effective_to && v.effective_to < v.effective_from) throw badRequest('Validation failed', [{ path: 'effectiveTo', message: 'effectiveTo must be on or after effectiveFrom' }]);
  if (v.rate_basis === 'percent' && Number(v.rate) > 100) throw badRequest('Validation failed', [{ path: 'rate', message: 'A percent rate cannot exceed 100' }]);
  if (!v.active) return;
  const hit = (await db.query(`SELECT id, effective_from, effective_to FROM insurer_rate_tables WHERE active AND ($1::int IS NULL OR id <> $1)
      AND insurance_company_id = $2 AND product_id = $3 AND daterange(effective_from, effective_to, '[]') && daterange($4::date, $5::date, '[]') LIMIT 1`,
  [exceptId, v.insurance_company_id, v.product_id, v.effective_from, v.effective_to])).rows[0];
  if (hit) throw conflict(`Overlaps active rate table #${hit.id} (${hit.effective_from} to ${hit.effective_to || 'open'}) of the same insurer and product`);
}

export async function createRateTable(b, user) {
  return withTransaction(async (db) => {
    await db.query('LOCK TABLE insurer_rate_tables IN SHARE ROW EXCLUSIVE MODE');
    const v = columnsOf(b);
    await check(db, v);
    const r = await db.query(`INSERT INTO insurer_rate_tables(${COLS.join(', ')}, created_by, updated_by) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(', ')}, $${COLS.length + 1}, $${COLS.length + 1}) RETURNING id`,
      [...COLS.map((c) => v[c]), user?.id ?? null]);
    return fetchRateTable(db, r.rows[0].id);
  });
}

export async function updateRateTable(id, b, user) {
  return withTransaction(async (db) => {
    await db.query('LOCK TABLE insurer_rate_tables IN SHARE ROW EXCLUSIVE MODE');
    const before = await fetchRateTable(db, id);
    const v = columnsOf(b, before);
    await check(db, v, before.id);
    await db.query(`UPDATE insurer_rate_tables SET ${COLS.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_by = $${COLS.length + 2} WHERE id = $1`,
      [before.id, ...COLS.map((c) => v[c]), user?.id ?? null]);
    return { before, after: await fetchRateTable(db, before.id) };
  });
}

/** Rows used by a package section are kept (deactivated); others are deleted. */
export async function deleteRateTable(id, user) {
  return withTransaction(async (db) => {
    const before = await fetchRateTable(db, id);
    const used = (await db.query('SELECT 1 FROM package_sections WHERE rate_table_id = $1 LIMIT 1', [before.id])).rowCount;
    if (used) await db.query('UPDATE insurer_rate_tables SET active = false, updated_by = $2 WHERE id = $1', [before.id, user?.id ?? null]);
    else await db.query('DELETE FROM insurer_rate_tables WHERE id = $1', [before.id]);
    return { ...before, deactivated: Boolean(used) };
  });
}
