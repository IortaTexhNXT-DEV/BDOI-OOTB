/**
 * Co-insurance helpers shared by booking, remittance, direct bill, claims and collections.
 *
 * A policy's participants are its risk_participants rows (entity_type 'policy', status active): one row per insurer with
 * its share, exactly one lead. A policy without participant rows is a single-insurer policy: 100% with its
 * insurance_company_id. Amounts are split by share with the largest-remainder method so the shares always add up to the
 * total to the cent.
 */
import { round2 } from '../../../lib/money.js';

const participantOut = (r) => ({
  insurerId: r.insurance_company_id, insurerName: r.insurer_name || 'insurer', insurerCode: r.insurer_code || null, isLead: !!r.is_lead,
  share: Number(r.share_percent), premium: Number(r.premium || 0), taxes: Number(r.taxes || 0), premiumTotal: Number(r.premium_total || 0),
  commissionRate: r.commission_rate === null || r.commission_rate === undefined ? null : Number(r.commission_rate),
  commissionAmount: Number(r.commission_amount || 0), insurerCommissionRate: r.insurer_commission_rate === null ? null : Number(r.insurer_commission_rate),
  insurerReference: r.insurer_reference || null, fallback: !!r.fallback,
});

/**
 * Participants of a policy: its active risk_participants rows (lead first), else the policy's own insurer at 100%.
 * Returns [] when the policy does not exist.
 */
export async function policyParticipants(policyId, db) {
  const rows = (await db.query(`SELECT rp.*, ic.name AS insurer_name, ic.code AS insurer_code, ic.commission_rate AS insurer_commission_rate
    FROM risk_participants rp JOIN insurance_companies ic ON ic.id = rp.insurance_company_id
    WHERE rp.entity_type = 'policy' AND rp.entity_id = $1 AND rp.status = 'active' ORDER BY rp.is_lead DESC, rp.share_percent DESC, rp.id`, [String(policyId)])).rows;
  if (rows.length) return rows.map(participantOut);
  const p = (await db.query(`SELECT p.insurance_company_id, ic.name AS insurer_name, ic.code AS insurer_code, ic.commission_rate AS insurer_commission_rate,
      p.premium_total, p.net_premium AS premium, p.commission_amount
    FROM policies p LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE p.id = $1`, [String(policyId)])).rows[0];
  if (!p) return [];
  return [participantOut({ ...p, is_lead: true, share_percent: 100, commission_rate: null, fallback: true })];
}

/** More than one insurer shares the risk. */
export const isCoInsured = (parts) => Array.isArray(parts) && parts.length > 1;

/** Split total by weights (shares) to the cent; the rounding difference goes to the largest remainders. */
export function allocate(total, weights) {
  const t = round2(total);
  if (!weights.length) return [];
  const sum = weights.reduce((s, w) => s + Number(w), 0);
  if (!sum) return weights.map((_, i) => (i === 0 ? t : 0));
  const sign = t < 0 ? -1 : 1;
  const cents = Math.round(Math.abs(t) * 100);
  const raw = weights.map((w) => (cents * Number(w)) / sum);
  const floor = raw.map((x) => Math.floor(x + 1e-9));
  let left = cents - floor.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => [x - floor[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floor[i] += 1;
    left -= 1;
  }
  return floor.map((c) => (sign * c) / 100);
}

/** Per-participant shares of several amounts: { key: total } -> [{ key: share }...] in participant order. */
export function splitAmounts(parts, totals) {
  const weights = parts.map((p) => p.share);
  const out = parts.map(() => ({}));
  for (const [k, v] of Object.entries(totals)) allocate(Number(v) || 0, weights).forEach((x, i) => { out[i][k] = x; });
  return out;
}
