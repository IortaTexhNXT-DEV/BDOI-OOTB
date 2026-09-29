/**
 * Placement journey configuration (setting placement.journey): which of the steps Broker Slip -> Quotation Slip ->
 * Placement Slip -> Policy a product or line of business requires. Each step is required | optional | skip, and the
 * entry for a product type (e.g. "Marine Cargo"), else its LOB code (MOTOR, FIRE ...), else "default" applies.
 *
 *   brokerSlip:    required = a quotation must come from a broker slip; skip = no broker slips for the line
 *   quotationSlip: required = no direct placement without a quotation; skip = the broker slip goes straight to placement
 *   placementSlip: required = a quotation cannot be converted directly (a placement slip issues the policy);
 *                  skip = quotations convert directly and no placement slip can be created
 *   directPolicy:  skip = "Record Issued Policy" is not allowed for the line
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';
import { lobOf } from '../documents/common.js';

export const STEPS = ['brokerSlip', 'quotationSlip', 'placementSlip', 'directPolicy'];
const MODES = ['required', 'optional', 'skip'];
const FALLBACK = { brokerSlip: 'optional', quotationSlip: 'optional', placementSlip: 'optional', directPolicy: 'optional' };

/** LOB code of a product line from the product master (fire lines named "Industrial All Risks" are IAR). */
const fromLine = (line, name) => (line ? (line === 'fire' && /industrial/i.test(name || '') ? 'IAR' : String(line).toUpperCase()) : null);

/**
 * Line of business of a risk: the product master line when the product is known, else keywords of the product name
 * (placement.lob_keywords, e.g. MARINE, CASUALTY, ENGINEERING), else the quotation LOB rules (MOTOR, FIRE, IAR, EB).
 */
export async function resolveLob({ lob = null, productId = null, productType = null } = {}, db = null) {
  const c = db || { query };
  if (productId || productType) {
    const p = (await c.query(`SELECT line, name FROM products WHERE ($1::int IS NOT NULL AND id = $1::int) OR ($2::text IS NOT NULL AND (lower(code) = lower($2) OR lower(name) = lower($2)))
      ORDER BY (id = $1::int) DESC NULLS LAST LIMIT 1`, [productId ? Number(productId) : null, productType || null])).rows[0];
    const l = fromLine(p?.line, p?.name);
    if (l) return l;
  }
  const text = String(productType || '').toUpperCase();
  if (text && !/MOTOR|CTPL|THIRD PARTY|FIRE|INDUSTRIAL|EMPLOYEE/.test(text)) {
    const keywords = (await getSetting('placement.lob_keywords', {})) || {};
    for (const [code, words] of Object.entries(keywords)) if ((words || []).some((w) => text.includes(String(w).toUpperCase()))) return code;
  }
  if (lob) return String(lob).toUpperCase();
  return lobOf(productType);
}

const norm = (s) => String(s || '').trim().toLowerCase();

/** The journey for a product type / LOB: { brokerSlip, quotationSlip, placementSlip, directPolicy, key }. */
export async function journeyFor({ lob = null, productType = null, productId = null } = {}, db = null) {
  const cfg = (await getSetting('placement.journey', {})) || {};
  const entries = Object.entries(cfg);
  const find = (k) => (k ? entries.find(([key]) => norm(key) === norm(k)) : null);
  const code = await resolveLob({ lob, productId, productType }, db);
  const hit = find(productType) || find(code) || find('default');
  const base = { ...FALLBACK, ...(find('default')?.[1] || {}) };
  const steps = { ...base, ...(hit?.[1] || {}) };
  for (const s of STEPS) if (!MODES.includes(steps[s])) steps[s] = FALLBACK[s];
  return { ...steps, lob: code, key: hit?.[0] || 'default' };
}

/** Throw a 400 naming the journey rule when `step` is set to one of `modes`. */
export function assertStep(journey, step, modes, message) {
  if (modes.includes(journey[step])) throw badRequest(message, [{ path: step, code: 'PLACEMENT_JOURNEY', mode: journey[step], lob: journey.lob, message }]);
}
