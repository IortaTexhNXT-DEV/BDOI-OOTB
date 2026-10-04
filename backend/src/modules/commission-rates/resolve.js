/**
 * Commission rate resolution from the Commission Rate Matrix (commission_rates).
 *
 * The most specific active row effective on the date wins:
 *   insurer + product > insurer + LOB > insurer > product > LOB
 * within the same level an exact policy type (new / renewal) beats 'any', then the latest effective_from.
 * Without a matching row: the insurer's commission_rate (insurer master), then commission.default_rate.
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';

export const POLICY_TYPES = ['new', 'renewal', 'any'];

/** Specificity rank of a matrix row (higher wins). */
export const SPECIFICITY_SQL = `CASE
    WHEN r.insurance_company_id IS NOT NULL AND r.product_id IS NOT NULL THEN 5
    WHEN r.insurance_company_id IS NOT NULL AND r.line_of_business IS NOT NULL THEN 4
    WHEN r.insurance_company_id IS NOT NULL THEN 3
    WHEN r.product_id IS NOT NULL THEN 2
    ELSE 1 END`;

export const LEVEL_LABELS = { 5: 'insurer + product', 4: 'insurer + line of business', 3: 'insurer', 2: 'product', 1: 'line of business' };

const toInt = (v) => (v === null || v === undefined || v === '' || !/^\d+$/.test(String(v)) ? null : Number(v));

/**
 * Rate for a placement: { rate, source: 'matrix' | 'insurer' | 'default', ruleId, level }.
 * insurerId / productId: ids; lob: line of business code (case-insensitive); policyType: new | renewal (default new);
 * date: YYYY-MM-DD (default today); db: transaction client (optional).
 */
export async function resolveCommissionRate({ insurerId = null, productId = null, lob = null, policyType = 'new', date = null, db = null } = {}) {
  const run = db || { query };
  const insurer = toInt(insurerId);
  const product = toInt(productId);
  const type = POLICY_TYPES.includes(policyType) && policyType !== 'any' ? policyType : 'new';
  const on = date ? String(date).slice(0, 10) : await today();
  const row = (await run.query(`SELECT r.id, r.rate, ${SPECIFICITY_SQL} AS level FROM commission_rates r
    WHERE r.active AND r.effective_from <= $5::date AND (r.effective_to IS NULL OR r.effective_to >= $5::date)
      AND (r.insurance_company_id IS NULL OR r.insurance_company_id = $1)
      AND (r.product_id IS NULL OR r.product_id = $2)
      AND (r.line_of_business IS NULL OR lower(r.line_of_business) = lower($3))
      AND (r.policy_type = 'any' OR r.policy_type = $4)
    ORDER BY level DESC, (r.policy_type = $4) DESC, r.effective_from DESC, r.id DESC LIMIT 1`, [insurer, product, lob ? String(lob) : null, type, on])).rows[0];
  if (row) return { rate: Number(row.rate), source: 'matrix', ruleId: row.id, level: LEVEL_LABELS[row.level] };
  if (insurer) {
    const ic = (await run.query('SELECT commission_rate FROM insurance_companies WHERE id = $1', [insurer])).rows[0];
    if (ic?.commission_rate !== null && ic?.commission_rate !== undefined) return { rate: Number(ic.commission_rate), source: 'insurer', ruleId: null, level: null };
  }
  return { rate: Number(await getSetting('commission.default_rate', 0.15)), source: 'default', ruleId: null, level: null };
}
