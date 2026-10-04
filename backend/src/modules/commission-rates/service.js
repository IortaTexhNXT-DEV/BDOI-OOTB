/**
 * Commission Rate Matrix master: rows of commission_rates with the overlap rule (no two active rows with the same
 * insurer / product / line of business / policy type and overlapping dates).
 */
import { many, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { LEVEL_LABELS, SPECIFICITY_SQL } from './resolve.js';

const SELECT = `SELECT r.*, ic.name AS insurer_name, ic.code AS insurer_code, p.name AS product_name, p.code AS product_code,
    ${SPECIFICITY_SQL} AS level, (SELECT u.display_name FROM users u WHERE u.id = r.updated_by) AS updated_by_name
  FROM commission_rates r LEFT JOIN insurance_companies ic ON ic.id = r.insurance_company_id LEFT JOIN products p ON p.id = r.product_id`;

export const toRate = (r) => ({
  id: r.id, insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name, insurerCode: r.insurer_code,
  productId: r.product_id, productName: r.product_name, productCode: r.product_code, lineOfBusiness: r.line_of_business,
  policyType: r.policy_type, rate: Number(r.rate), ratePercent: Math.round(Number(r.rate) * 1000000) / 10000,
  effectiveFrom: r.effective_from, effectiveTo: r.effective_to, active: r.active, remarks: r.remarks,
  level: LEVEL_LABELS[r.level], updatedBy: r.updated_by_name || r.updated_by, updatedAt: r.updated_at,
});

export async function listRates(q = {}) {
  const where = ['TRUE'];
  const values = [];
  const add = (sql, v) => { values.push(v); where.push(sql.replaceAll('?', `$${values.length}`)); };
  if (q.insuranceCompanyId) add('r.insurance_company_id = ?', Number(q.insuranceCompanyId));
  if (q.productId) add('r.product_id = ?', Number(q.productId));
  if (q.lineOfBusiness) add('lower(r.line_of_business) = lower(?)', String(q.lineOfBusiness));
  if (q.policyType) add('r.policy_type = ?', String(q.policyType));
  if (q.active === 'true' || q.active === true) where.push('r.active');
  if (q.active === 'false' || q.active === false) where.push('NOT r.active');
  if (q.search) add('(ic.name ILIKE ? OR p.name ILIKE ? OR r.line_of_business ILIKE ? OR r.remarks ILIKE ?)', `%${q.search}%`);
  return (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ic.name NULLS LAST, p.name NULLS LAST, r.line_of_business NULLS LAST, r.policy_type, r.effective_from DESC`, values)).map(toRate);
}

async function fetchRate(db, id) {
  const row = (await db.query(`${SELECT} WHERE r.id = $1`, [Number(id)])).rows[0];
  if (!row) throw notFound(`Commission rate ${id} not found`);
  return toRate(row);
}
export const getRate = (id) => fetchRate({ query }, id);

/** Reject a row whose keys and dates overlap another active row (checked under a table lock, so two saves cannot race). */
async function assertNoOverlap(db, v, exceptId = null) {
  if (!v.active) return;
  const hit = (await db.query(`SELECT r.id, r.effective_from, r.effective_to FROM commission_rates r
    WHERE r.active AND ($1::int IS NULL OR r.id <> $1)
      AND r.insurance_company_id IS NOT DISTINCT FROM $2::int AND r.product_id IS NOT DISTINCT FROM $3::int
      AND lower(r.line_of_business) IS NOT DISTINCT FROM lower($4::text) AND r.policy_type = $5
      AND daterange(r.effective_from, r.effective_to, '[]') && daterange($6::date, $7::date, '[]')
    ORDER BY r.effective_from LIMIT 1`, [exceptId, v.insurance_company_id, v.product_id, v.line_of_business, v.policy_type, v.effective_from, v.effective_to])).rows[0];
  if (hit) {
    throw conflict(`Overlaps active commission rate #${hit.id} (${hit.effective_from} to ${hit.effective_to || 'open'}) with the same insurer, product, line of business and policy type`);
  }
}

/**
 * A line of business must be a code of the Line of Business master (case-insensitive; stored in lower case): a rate on
 * an unknown code would never apply. Checked when the code is set or changed (the go-live workbook checks the same).
 */
async function checkLineOfBusiness(db, code) {
  if (!code) return;
  const hit = (await db.query(`SELECT 1 FROM master_records WHERE type_code = 'line-of-business' AND status <> 'deleted' AND lower(code) = lower($1)`, [code])).rowCount;
  if (!hit) {
    const message = `Line of business ${code} is not in the Line of Business master (Master > Line of Business); use one of its codes`;
    throw badRequest(message, [{ path: 'lineOfBusiness', message }]);
  }
}

async function checkRefs(db, v) {
  if (v.insurance_company_id && !(await db.query('SELECT 1 FROM insurance_companies WHERE id = $1', [v.insurance_company_id])).rowCount) {
    throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: `Insurance company ${v.insurance_company_id} not found` }]);
  }
  if (v.product_id && !(await db.query('SELECT 1 FROM products WHERE id = $1', [v.product_id])).rowCount) {
    throw badRequest('Validation failed', [{ path: 'productId', message: `Product ${v.product_id} not found` }]);
  }
  if (!v.insurance_company_id && !v.product_id && !v.line_of_business) {
    throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: 'Give an insurer, a product or a line of business (the general default is commission.default_rate)' }]);
  }
  if (v.effective_to && v.effective_to < v.effective_from) throw badRequest('Validation failed', [{ path: 'effectiveTo', message: 'effectiveTo must be on or after effectiveFrom' }]);
}

const columnsOf = (b, base = {}) => ({
  insurance_company_id: b.insuranceCompanyId !== undefined ? b.insuranceCompanyId : base.insuranceCompanyId ?? null,
  product_id: b.productId !== undefined ? b.productId : base.productId ?? null,
  line_of_business: b.lineOfBusiness !== undefined ? (b.lineOfBusiness ? String(b.lineOfBusiness).trim().toLowerCase() : null) : base.lineOfBusiness ?? null,
  policy_type: b.policyType ?? base.policyType ?? 'any',
  rate: b.rate ?? base.rate,
  effective_from: b.effectiveFrom ?? base.effectiveFrom,
  effective_to: b.effectiveTo !== undefined ? b.effectiveTo : base.effectiveTo ?? null,
  active: b.active ?? base.active ?? true,
  remarks: b.remarks !== undefined ? b.remarks : base.remarks ?? null,
});

export async function createRate(b, user) {
  return withTransaction(async (db) => {
    await db.query('LOCK TABLE commission_rates IN SHARE ROW EXCLUSIVE MODE');
    const v = columnsOf(b);
    await checkRefs(db, v);
    await checkLineOfBusiness(db, b.lineOfBusiness ? String(b.lineOfBusiness).trim() : null);
    await assertNoOverlap(db, v);
    const r = await db.query(`INSERT INTO commission_rates(insurance_company_id, product_id, line_of_business, policy_type, rate, effective_from, effective_to, active, remarks, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id`, [v.insurance_company_id, v.product_id, v.line_of_business, v.policy_type, v.rate, v.effective_from, v.effective_to, v.active, v.remarks, user?.id ?? null]);
    return fetchRate(db, r.rows[0].id);
  });
}

export async function updateRate(id, b, user) {
  return withTransaction(async (db) => {
    await db.query('LOCK TABLE commission_rates IN SHARE ROW EXCLUSIVE MODE');
    const before = await fetchRate(db, id);
    const v = columnsOf(b, before);
    await checkRefs(db, v);
    if ((v.line_of_business || null) !== (before.lineOfBusiness ? String(before.lineOfBusiness).toLowerCase() : null)) await checkLineOfBusiness(db, b.lineOfBusiness ? String(b.lineOfBusiness).trim() : null);
    await assertNoOverlap(db, v, before.id);
    await db.query(`UPDATE commission_rates SET insurance_company_id = $2, product_id = $3, line_of_business = $4, policy_type = $5, rate = $6, effective_from = $7,
      effective_to = $8, active = $9, remarks = $10, updated_by = $11 WHERE id = $1`,
    [before.id, v.insurance_company_id, v.product_id, v.line_of_business, v.policy_type, v.rate, v.effective_from, v.effective_to, v.active, v.remarks, user?.id ?? null]);
    return { before, after: await fetchRate(db, before.id) };
  });
}

export async function deleteRate(id) {
  return withTransaction(async (db) => {
    const before = await fetchRate(db, id);
    await db.query('DELETE FROM commission_rates WHERE id = $1', [before.id]);
    return before;
  });
}
