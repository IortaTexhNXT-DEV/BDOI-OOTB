/**
 * Bundle products master (Master > Packaged Products > Bundle Products): a bundle is sold as one package (e.g. "SME
 * Shield" = Fire + CGL + Burglary) and has sections, each tied to a product with its default sum insured, rate,
 * minimum premium, the insurers allowed to carry it (first = default) and whether it is a property section (fire
 * service tax). The bundle discount % applies to the whole package, spread over the sections in proportion to their
 * premium.
 */
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

const run = (db) => db || { query };

export const toSection = (s, names = new Map()) => ({
  sectionNo: s.section_no, name: s.name, productId: s.product_id, productName: s.product_name, productCode: s.product_code, productLine: s.product_line,
  defaultSumInsured: Number(s.default_sum_insured), ratePercent: Number(s.rate_percent), minimumPremium: Number(s.minimum_premium), property: s.property,
  optional: s.optional, insurerIds: s.insurer_ids || [], insurers: (s.insurer_ids || []).map((id) => ({ id, name: names.get(id) || null })),
  benefits: Array.isArray(s.benefits) ? s.benefits : [],
});

export const toBundle = (b, sections = [], names = new Map()) => ({
  id: b.id, code: b.code, name: b.name, description: b.description, customerSegment: b.customer_segment, discountPercent: Number(b.discount_percent),
  termMonths: b.term_months, autoIssue: b.auto_issue, status: b.status, sections: sections.map((s) => toSection(s, names)),
  updatedBy: b.updated_by, updatedAt: b.updated_at,
});

async function sectionsOf(db, ids) {
  if (!ids.length) return new Map();
  const rows = (await run(db).query(`SELECT s.*, p.name AS product_name, p.code AS product_code, p.line AS product_line FROM package_bundle_sections s
    JOIN products p ON p.id = s.product_id WHERE s.bundle_id = ANY($1) ORDER BY s.bundle_id, s.section_no`, [ids])).rows;
  const m = new Map();
  for (const r of rows) m.set(r.bundle_id, [...(m.get(r.bundle_id) || []), r]);
  return m;
}

async function insurerNames(db, sectionRows) {
  const ids = [...new Set(sectionRows.flatMap((s) => s.insurer_ids || []))];
  if (!ids.length) return new Map();
  return new Map((await run(db).query('SELECT id, name FROM insurance_companies WHERE id = ANY($1)', [ids])).rows.map((r) => [r.id, r.name]));
}

export async function listBundles(q = {}, db = null) {
  const where = ['TRUE'];
  const values = [];
  if (q.status) { values.push(String(q.status)); where.push(`b.status = $${values.length}`); }
  if (q.search) { values.push(`%${q.search}%`); where.push(`(b.name ILIKE $${values.length} OR b.code ILIKE $${values.length})`); }
  const rows = (await run(db).query(`SELECT b.* FROM package_bundles b WHERE ${where.join(' AND ')} ORDER BY b.name`, values)).rows;
  const secs = await sectionsOf(db, rows.map((r) => r.id));
  const names = await insurerNames(db, [...secs.values()].flat());
  return rows.map((b) => toBundle(b, secs.get(b.id) || [], names));
}

export async function getBundle(id, db = null) {
  const b = (await run(db).query('SELECT * FROM package_bundles WHERE id::text = $1 OR code = upper($1)', [String(id)])).rows[0];
  if (!b) throw notFound(`Bundle ${id} not found`);
  const secs = (await sectionsOf(db, [b.id])).get(b.id) || [];
  return toBundle(b, secs, await insurerNames(db, secs));
}

async function checkSections(db, sections) {
  if (!Array.isArray(sections) || !sections.length) throw badRequest('Validation failed', [{ path: 'sections', message: 'A bundle needs at least one section' }]);
  const nos = sections.map((s, i) => s.sectionNo ?? i + 1);
  if (new Set(nos).size !== nos.length) throw badRequest('Validation failed', [{ path: 'sections', message: 'Section numbers must be unique' }]);
  if (!sections.some((s) => !s.optional)) throw badRequest('Validation failed', [{ path: 'sections', message: 'At least one section must be compulsory' }]);
  for (const [i, s] of sections.entries()) {
    if (!(await db.query("SELECT 1 FROM products WHERE id = $1 AND status = 'active'", [s.productId])).rowCount) {
      throw badRequest('Validation failed', [{ path: `sections.${i}.productId`, message: `Product ${s.productId} not found or inactive` }]);
    }
    const ids = s.insurerIds || [];
    if (new Set(ids).size !== ids.length) throw badRequest('Validation failed', [{ path: `sections.${i}.insurerIds`, message: 'An insurer is listed twice' }]);
    const found = ids.length ? (await db.query("SELECT count(*)::int AS n FROM insurance_companies WHERE id = ANY($1) AND status = 'active'", [ids])).rows[0].n : 0;
    if (found !== ids.length) throw badRequest('Validation failed', [{ path: `sections.${i}.insurerIds`, message: 'Every insurer must be an active insurer of the insurer master' }]);
    if (!ids.length) throw badRequest('Validation failed', [{ path: `sections.${i}.insurerIds`, message: 'Each section needs at least one insurer' }]);
  }
}

async function writeSections(db, bundleId, sections) {
  await db.query('DELETE FROM package_bundle_sections WHERE bundle_id = $1', [bundleId]);
  for (const [i, s] of sections.entries()) {
    await db.query(`INSERT INTO package_bundle_sections(bundle_id, section_no, name, product_id, default_sum_insured, rate_percent, minimum_premium, property, optional, insurer_ids, benefits)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [bundleId, s.sectionNo ?? i + 1, s.name, s.productId, s.defaultSumInsured ?? 0, s.ratePercent ?? 0, s.minimumPremium ?? 0, s.property ?? null, Boolean(s.optional),
      s.insurerIds || [], JSON.stringify(s.benefits || [])]);
  }
}

export async function createBundle(b, user) {
  return withTransaction(async (db) => {
    const code = String(b.code).trim().toUpperCase();
    if ((await db.query('SELECT 1 FROM package_bundles WHERE code = $1', [code])).rowCount) throw conflict(`Bundle ${code} already exists`);
    await checkSections(db, b.sections);
    const r = await db.query(`INSERT INTO package_bundles(code, name, description, customer_segment, discount_percent, term_months, auto_issue, status, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`, [code, b.name, b.description ?? null, b.customerSegment || 'both', b.discountPercent ?? 0, b.termMonths ?? 12,
      b.autoIssue ?? true, b.status || 'active', user?.id ?? null]);
    await writeSections(db, r.rows[0].id, b.sections);
    return getBundle(r.rows[0].id, db);
  });
}

export async function updateBundle(id, b, user) {
  return withTransaction(async (db) => {
    const before = await getBundle(id, db);
    if (b.sections) await checkSections(db, b.sections);
    await db.query(`UPDATE package_bundles SET name = $2, description = $3, customer_segment = $4, discount_percent = $5, term_months = $6, auto_issue = $7, status = $8, updated_by = $9
      WHERE id = $1`, [before.id, b.name ?? before.name, b.description !== undefined ? b.description : before.description, b.customerSegment ?? before.customerSegment,
      b.discountPercent ?? before.discountPercent, b.termMonths ?? before.termMonths, b.autoIssue ?? before.autoIssue, b.status ?? before.status, user?.id ?? null]);
    if (b.sections) await writeSections(db, before.id, b.sections);
    return { before, after: await getBundle(before.id, db) };
  });
}

/** A bundle already quoted is deactivated; an unused one is deleted. */
export async function deleteBundle(id, user) {
  return withTransaction(async (db) => {
    const before = await getBundle(id, db);
    const used = (await db.query('SELECT 1 FROM package_quotes WHERE bundle_id = $1 LIMIT 1', [before.id])).rowCount;
    if (used) await db.query("UPDATE package_bundles SET status = 'inactive', updated_by = $2 WHERE id = $1", [before.id, user?.id ?? null]);
    else await db.query('DELETE FROM package_bundles WHERE id = $1', [before.id]);
    return { ...before, deactivated: Boolean(used) };
  });
}
