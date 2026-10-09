/**
 * Remittance basis of broker-billed premium (migration 0344, FGA.09):
 * - net: the broker keeps its commission out of the premium collected and remits the rest (the premium due to the
 *   insurer is net of the commission, the VAT on it and the EWT the insurer withholds on it).
 * - gross: the premium collected is due to the insurer in full and remitted in full; the commission is billed to the
 *   insurer on a commission billing statement (Direct Bill Processing) and collected from it.
 * The basis comes from remittance.basis_rules ({ insurer, product, basis }; the most specific matching rule wins: insurer
 * and product, then insurer, then product), else remittance.default_basis. A bill keeps the basis it was booked on.
 */
import { getSetting } from '../../lib/settings.js';

export const BASES = ['net', 'gross'];
const norm = (v) => String(v ?? '').trim().toLowerCase();
const basisOf = (v) => (norm(v) === 'gross' ? 'gross' : 'net');

/** Basis of a rule set for an insurer code and a product code (pure; used by remittanceBasis and the tests). */
export function matchBasis(rules, defaultBasis, { insurer, product }) {
  let best = null;
  for (const r of Array.isArray(rules) ? rules : []) {
    if (!r || !BASES.includes(norm(r.basis))) continue;
    const ri = norm(r.insurer);
    const rp = norm(r.product);
    if ((ri && ri !== norm(insurer)) || (rp && rp !== norm(product))) continue;
    const score = (ri ? 2 : 0) + (rp ? 1 : 0);
    if (!best || score > best.score) best = { score, basis: norm(r.basis) };
  }
  return best ? best.basis : basisOf(defaultBasis);
}

/** Basis for a policy's insurer and product (ids); the policy's own insurer decides on a co-insured policy. */
export async function remittanceBasis(db, { insurance_company_id: insurerId, product_id: productId }) {
  const codes = (await db.query(`SELECT (SELECT code FROM insurance_companies WHERE id = $1) AS insurer, (SELECT code FROM products WHERE id = $2) AS product`,
    [insurerId ?? null, productId ?? null])).rows[0];
  return matchBasis(await getSetting('remittance.basis_rules', []), await getSetting('remittance.default_basis', 'net'), codes);
}

/** Basis of a policy's premium: the one its latest bill was booked on, else the rules. */
export async function policyBasis(db, policy) {
  const r = (await db.query('SELECT remittance_basis FROM receivables WHERE policy_id = $1 AND status <> \'cancelled\' ORDER BY created_at DESC LIMIT 1', [policy.id])).rows[0];
  return r ? r.remittance_basis : remittanceBasis(db, policy);
}

/** SQL expression (policy alias p): true when the policy's latest live bill was booked on the gross basis. */
export const GROSS_BILLED_SQL = `COALESCE((SELECT rv.remittance_basis = 'gross' FROM receivables rv WHERE rv.policy_id = p.id AND rv.status <> 'cancelled'
  ORDER BY rv.created_at DESC LIMIT 1), false)`;
