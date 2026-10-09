/**
 * Placement journey configuration: which of the steps Broker Slip -> Quotation Slip -> Placement Slip -> Policy a
 * product or line of business requires. Each step is required | optional | skip. Three layers, later ones winning:
 *   1. the "default" entry of placement.journey;
 *   2. placement.journey_by_business_type for the product's business type (package / non_package, Product master);
 *   3. the placement.journey entry for the product type (e.g. "Marine Cargo") or the product's code or name (CTPL), else
 *      for its LOB code (MOTOR, FIRE ...).
 *
 *   brokerSlip:    required = a quotation must come from a broker slip; skip = no broker slips for the line
 *   quotationSlip: required = no direct placement without a quotation; skip = the broker slip goes straight to placement
 *   placementSlip: required = a quotation cannot be converted directly (a placement slip issues the policy);
 *                  skip = quotations convert directly and no placement slip can be created
 *   directPolicy:  kept for configurations that still name it; no screen enters an issued policy directly any more
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';
import { lobOf } from '../documents/common.js';

export const STEPS = ['brokerSlip', 'quotationSlip', 'placementSlip', 'directPolicy'];
const MODES = ['required', 'optional', 'skip'];
const FALLBACK = { brokerSlip: 'optional', quotationSlip: 'optional', placementSlip: 'optional', directPolicy: 'optional' };

/** LOB code of a product line from the product master (fire lines named "Industrial All Risks" are IAR). */
export const fromLine = (line, name) => (line ? (line === 'fire' && /industrial/i.test(name || '') ? 'IAR' : String(line).toUpperCase()) : null);

/** The product master row of a risk: by id, else by code or name (the product type). */
async function findProduct({ productId = null, productType = null }, c) {
  if (!productId && !productType) return null;
  const r = await c.query(`SELECT id, code, name, line, business_type FROM products
    WHERE ($1::int IS NOT NULL AND id = $1::int) OR ($2::text IS NOT NULL AND (lower(code) = lower($2) OR lower(name) = lower($2)))
    ORDER BY (id = $1::int) DESC NULLS LAST LIMIT 1`, [productId ? Number(productId) : null, productType || null]);
  return r.rows[0] || null;
}

/** Line of business from the product row, else the keywords of the product type, else the quotation LOB rules. */
async function lobFrom(product, { lob = null, productType = null }) {
  const l = fromLine(product?.line, product?.name);
  if (l) return l;
  const text = String(productType || '').toUpperCase();
  if (text && !/MOTOR|CTPL|THIRD PARTY|FIRE|INDUSTRIAL|EMPLOYEE/.test(text)) {
    const keywords = (await getSetting('placement.lob_keywords', {})) || {};
    for (const [code, words] of Object.entries(keywords)) if ((words || []).some((w) => text.includes(String(w).toUpperCase()))) return code;
  }
  if (lob) return String(lob).toUpperCase();
  return lobOf(productType);
}

/**
 * Line of business of a risk: the product master line when the product is known, else keywords of the product name
 * (placement.lob_keywords, e.g. MARINE, CASUALTY, ENGINEERING), else the quotation LOB rules (MOTOR, FIRE, IAR, EB).
 */
export async function resolveLob({ lob = null, productId = null, productType = null } = {}, db = null) {
  return lobFrom(await findProduct({ productId, productType }, db || { query }), { lob, productType });
}

/**
 * Business type of a risk: the product's. A risk known only by its line takes the type of the product whose code is
 * the line (MOTOR, FIRE ...), else the type every classified product of the line shares; null when it cannot be told.
 */
async function businessTypeOf(product, lob, c) {
  if (product?.business_type) return product.business_type;
  if (!lob) return null;
  const rows = (await c.query("SELECT code, name, line, business_type FROM products WHERE status = 'active' AND business_type IS NOT NULL")).rows
    .filter((p) => fromLine(p.line, p.name) === lob);
  const own = rows.find((p) => String(p.code).toUpperCase() === lob);
  if (own) return own.business_type;
  const types = [...new Set(rows.map((p) => p.business_type))];
  return types.length === 1 ? types[0] : null;
}

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * The journey for a product type / LOB: { brokerSlip, quotationSlip, placementSlip, directPolicy, lob, businessType,
 * source, key }. source is the layer that decided (entry, businessType or default) and key names it.
 */
export async function journeyFor({ lob = null, productType = null, productId = null } = {}, db = null) {
  const c = db || { query };
  const cfg = (await getSetting('placement.journey', {})) || {};
  const byType = (await getSetting('placement.journey_by_business_type', {})) || {};
  const entries = Object.entries(cfg);
  const find = (k) => (k ? entries.find(([key]) => norm(key) === norm(k)) : null);
  const product = await findProduct({ productId, productType }, c);
  const code = await lobFrom(product, { lob, productType });
  const businessType = await businessTypeOf(product, code, c);
  const typeSteps = businessType && byType[businessType] && typeof byType[businessType] === 'object' ? byType[businessType] : null;
  const entry = find(productType) || find(product?.code) || find(product?.name) || find(code);
  const steps = { ...FALLBACK, ...(find('default')?.[1] || {}), ...(typeSteps || {}), ...(entry?.[1] || {}) };
  for (const s of STEPS) if (!MODES.includes(steps[s])) steps[s] = FALLBACK[s];
  const source = entry ? 'entry' : typeSteps ? 'businessType' : 'default';
  return { ...steps, lob: code, businessType, source, key: entry ? entry[0] : typeSteps ? businessType : 'default' };
}

/** Throw a 400 naming the journey rule when `step` is set to one of `modes`. */
export function assertStep(journey, step, modes, message) {
  if (modes.includes(journey[step])) throw badRequest(message, [{ path: step, code: 'PLACEMENT_JOURNEY', mode: journey[step], lob: journey.lob, message }]);
}
