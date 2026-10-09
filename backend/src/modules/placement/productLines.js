/**
 * Products grouped by line of business, for every screen where a product is chosen for a prospect, a quotation or a
 * placement: first the line (Line of Business master), then the products of that line (Product master). Only active
 * lines that have at least one active product are offered, each with its active products. A product belongs to the
 * line whose code is its product line (motor -> MOTOR, accident -> ACCIDENT); its `lob` is the line the quotation and
 * the journey use (an Industrial All Risks product of the fire line is IAR).
 */
import { query } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { lobOf } from '../documents/common.js';
import { fromLine } from './journey.js';

/** [{ code, name, products: [{ id, code, name, line, lob, businessType, customerSegment }] }], Motor first. */
export async function productLines({ businessType = null } = {}, db = null) {
  const rows = (await (db || { query }).query(`SELECT m.code AS line_code, m.name AS line_name, p.id, p.code, p.name, p.line, p.business_type, p.customer_segment
    FROM master_records m JOIN products p ON upper(p.line) = m.code AND p.status = 'active'
    WHERE m.type_code = 'line-of-business' AND m.status = 'active' AND ($1::text IS NULL OR p.business_type = $1)
    ORDER BY (m.code = 'MOTOR') DESC, m.name, p.name`, [businessType || null])).rows;
  const lines = [];
  for (const r of rows) {
    let line = lines.find((l) => l.code === r.line_code);
    if (!line) lines.push(line = { code: r.line_code, name: r.line_name, products: [] });
    line.products.push({ id: r.id, code: r.code, name: r.name, line: r.line_code, lob: fromLine(r.line, r.name), businessType: r.business_type, customerSegment: r.customer_segment });
  }
  return lines;
}

/**
 * The product chosen for a line (id, else code or name): it must be an active product of the Product master (any
 * product with active=false, for records that already name one) and, when a line is given, belong to it (its product
 * line or the LOB it is quoted under). 400 on `path` otherwise.
 */
export async function productOfLine(db, { lob = null, product, active = true }, path = 'productId') {
  const ref = String(product ?? '').trim();
  const p = ref ? (await (db || { query }).query(`SELECT id, code, name, line, status FROM products
    WHERE id::text = $1 OR lower(code) = lower($1) OR lower(name) = lower($1) ORDER BY (id::text = $1) DESC LIMIT 1`, [ref])).rows[0] : null;
  if (!p || (active && p.status !== 'active')) throw badRequest('Validation failed', [{ path, message: `${ref || 'The product'} is not an active product of Master > Product` }]);
  const own = fromLine(p.line, p.name);
  if (lob && p.line && ![String(p.line).toUpperCase(), own].includes(lobOf(lob))) {
    throw badRequest('Validation failed', [{ path, message: `${p.name} is not a product of the line of business ${lobOf(lob)}` }]);
  }
  return { id: p.id, code: p.code, name: p.name, line: String(p.line || '').toUpperCase(), lob: own };
}
