/**
 * Commission rule resolution from the commission rules register (commission_rates; FRS FR-CMR-004).
 *
 * The most specific approved rule in force on the date wins:
 *   insurer + product + motor type > insurer + product > insurer + LOB > insurer > product > LOB
 * within the same level an exact channel type beats Any, an exact policy type (new / renewal) beats Any, a matching
 * sum insured band beats no band, then the latest effective_from. Without a matching rule: the insurer's
 * commission_rate (insurer master), then commission.default_rate, both as % of net premium.
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';

export const POLICY_TYPES = ['new', 'renewal', 'any'];
export const CHANNEL_TYPES = ['financing_bank', 'dealer', 'affinity_partner', 'agent', 'direct'];

/** Specificity rank of a rule (higher wins). */
export const SPECIFICITY_SQL = `CASE
    WHEN r.insurance_company_id IS NOT NULL AND r.product_id IS NOT NULL AND r.motor_type IS NOT NULL THEN 6
    WHEN r.insurance_company_id IS NOT NULL AND r.product_id IS NOT NULL THEN 5
    WHEN r.insurance_company_id IS NOT NULL AND r.line_of_business IS NOT NULL THEN 4
    WHEN r.insurance_company_id IS NOT NULL THEN 3
    WHEN r.product_id IS NOT NULL THEN 2
    ELSE 1 END`;

export const LEVEL_LABELS = { 6: 'insurer + product + motor type', 5: 'insurer + product', 4: 'insurer + line of business', 3: 'insurer', 2: 'product', 1: 'line of business' };

const toInt = (v) => (v === null || v === undefined || v === '' || !/^\d+$/.test(String(v)) ? null : Number(v));
const toNum = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** The channel type of a placement: its distribution channel's kind, else agent when a referrer is set, else direct. */
export const channelTypeOf = ({ channelType = null, referrerId = null } = {}) => {
  const ct = String(channelType || '').toLowerCase();
  if (['dealer_group', 'dealer_branch', 'dealer'].includes(ct)) return 'dealer';
  if (['financing_bank', 'bank_branch'].includes(ct)) return 'financing_bank';
  if (ct === 'affinity_partner') return 'affinity_partner';
  if (ct === 'agent' || ct === 'direct') return ct;
  return referrerId && referrerId !== 'direct' ? 'agent' : 'direct';
};

/**
 * The rule for a placement: { rate, source: 'matrix' | 'insurer' | 'default', ruleId, level, rateBasis, perilRates,
 * version }. insurerId / productId: ids; lob: line of business code; policyType: new | renewal (default new);
 * channelType (CHANNEL_TYPES), motorType (commission.motor_types code), sumInsured (Own Damage); date: YYYY-MM-DD
 * (default today); db: transaction client (optional).
 */
export async function resolveCommissionRate({ insurerId = null, productId = null, lob = null, policyType = 'new', channelType = null, motorType = null, sumInsured = null,
  date = null, db = null } = {}) {
  const run = db || { query };
  const insurer = toInt(insurerId);
  const product = toInt(productId);
  const type = POLICY_TYPES.includes(policyType) && policyType !== 'any' ? policyType : 'new';
  const channel = CHANNEL_TYPES.includes(channelType) ? channelType : null;
  const motor = motorType ? String(motorType).toUpperCase() : null;
  const si = toNum(sumInsured);
  const on = date ? String(date).slice(0, 10) : await today();
  const row = (await run.query(`SELECT r.id, r.rate, r.rate_basis, r.peril_rates, r.version, ${SPECIFICITY_SQL} AS level FROM commission_rates r
    WHERE r.active AND r.approval_status = 'approved' AND r.effective_from <= $5::date AND (r.effective_to IS NULL OR r.effective_to >= $5::date)
      AND (r.insurance_company_id IS NULL OR r.insurance_company_id = $1)
      AND (r.product_id IS NULL OR r.product_id = $2)
      AND (r.line_of_business IS NULL OR lower(r.line_of_business) = lower($3))
      AND (r.policy_type = 'any' OR r.policy_type = $4)
      AND (r.channel_type IS NULL OR r.channel_type = $6)
      AND (r.motor_type IS NULL OR upper(r.motor_type) = $7)
      AND ((r.si_from IS NULL AND r.si_to IS NULL) OR ($8::numeric IS NOT NULL AND ($8 >= COALESCE(r.si_from, 0)) AND (r.si_to IS NULL OR $8 <= r.si_to)))
    ORDER BY level DESC, (r.channel_type IS NOT NULL) DESC, (r.policy_type = $4) DESC, (r.si_from IS NOT NULL OR r.si_to IS NOT NULL) DESC, r.effective_from DESC, r.id DESC LIMIT 1`,
  [insurer, product, lob ? String(lob) : null, type, on, channel, motor, si])).rows[0];
  if (row) {
    return { rate: Number(row.rate), source: 'matrix', ruleId: row.id, level: LEVEL_LABELS[row.level], rateBasis: row.rate_basis, perilRates: row.peril_rates || [], version: row.version };
  }
  if (insurer) {
    const ic = (await run.query('SELECT commission_rate FROM insurance_companies WHERE id = $1', [insurer])).rows[0];
    if (ic?.commission_rate !== null && ic?.commission_rate !== undefined) return { rate: Number(ic.commission_rate), source: 'insurer', ruleId: null, level: null, rateBasis: 'net-premium', perilRates: [], version: null };
  }
  return { rate: Number(await getSetting('commission.default_rate', 0.15)), source: 'default', ruleId: null, level: null, rateBasis: 'net-premium', perilRates: [], version: null };
}

/** The motor type of a policy: the one kept on its quotation, else commission.motor_type_by_vehicle_type of its vehicle type. */
export async function motorTypeOf(doc = {}) {
  const explicit = doc?.motorType || doc?.vehicleDetails?.motorType;
  if (explicit) return String(explicit).toUpperCase();
  const map = (await getSetting('commission.motor_type_by_vehicle_type', {})) || {};
  const vt = String(doc?.vehicleType || doc?.vehicleDetails?.vehicleType || '').toLowerCase().replace(/[\s-]+/g, '_');
  return vt && map[vt] ? String(map[vt]).toUpperCase() : null;
}
