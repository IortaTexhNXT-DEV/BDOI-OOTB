/**
 * Rules of the first notice of loss (TIS-BRD-CLAIM-01, CLAIM-02, PJRN-08, Pre-BSM M15): the estimate, the follow-up due
 * date of an unsettled claim by line of business, loss extent or product (claims.followup_days), late intimation
 * (claims.late_intimation_days), duplicate notices on the same policy and loss date (claims.duplicate_check), death
 * benefit products (claims.death_benefit_products) and the claims ratio of the customer shown at registration.
 */
import { many, one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';
import { round2, toNum, unprocessable } from './util.js';

/** The estimate of a claim: empty is 0; anything else must be a number of zero or more (400 otherwise). */
export function estimateOf(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = toNum(v);
  if (n === null) throw badRequest('Validation failed', [{ path: 'estimatedClaimAmount', message: 'The estimate must be an amount' }]);
  if (n < 0) throw badRequest('Validation failed', [{ path: 'estimatedClaimAmount', message: 'The estimate cannot be negative' }]);
  return round2(n);
}

/**
 * Days from the report date to the follow-up due date: claims.followup_days by product code, then line:extent
 * (MOTOR:total), then line, then default, else claims.sla_days.
 */
export async function followUpDays({ productCode, lob, extent }) {
  const map = (await getSetting('claims.followup_days', {})) || {};
  const line = String(lob || '').toUpperCase();
  const keys = [productCode, extent ? `${line}:${String(extent).toLowerCase()}` : null, line, 'default'].filter(Boolean);
  const key = keys.find((k) => map[k] !== undefined && map[k] !== null && map[k] !== '');
  return key ? Number(map[key]) : Number(await getSetting('claims.sla_days', 20));
}

/** Late intimation: reported more than claims.late_intimation_days after the loss (0 switches the check off). */
export async function intimation(lossDate, reportedDate) {
  const limit = Number(await getSetting('claims.late_intimation_days', 30)) || 0;
  const days = Math.round((Date.parse(`${reportedDate}T00:00:00Z`) - Date.parse(`${lossDate}T00:00:00Z`)) / 86400000);
  return { days, limit, late: limit > 0 && days > limit };
}

/** Claims already registered on the policy for the same date of loss (cancelled and rejected ones left out). */
export async function duplicatesOf(policyId, lossDate, excludeId = null) {
  if ((await getSetting('claims.duplicate_check', true)) === false) return [];
  return many(`SELECT claim_number, status, loss_type FROM claims WHERE policy_id = $1 AND loss_date = $2::date AND status NOT IN ('cancelled', 'rejected')
    AND ($3::text IS NULL OR id <> $3) ORDER BY created_at`, [policyId, lossDate, excludeId]);
}

/** 422 when a death benefit product (Credit Life) is claimed for anything but death. */
export async function assertDeathBenefit(productCode, cause, claimType) {
  const products = (await getSetting('claims.death_benefit_products', [])) || [];
  if (!productCode || !products.includes(productCode)) return;
  if (!/\bdeath\b/i.test(`${cause || ''} ${claimType || ''}`)) {
    throw unprocessable(`Claims on ${productCode} policies are death benefit claims only; choose the cause of loss Death`, [{ path: 'typeOfIncident', message: 'Choose the cause of loss Death' }]);
  }
}

/**
 * Claims ratio of the customer: claims incurred (settled, else approved, else estimated; rejected and cancelled claims
 * left out) over the gross premium of the customer's policies, with the counts.
 */
export async function claimsRatio(clientId) {
  if (!clientId) return { claims: 0, claimsAmount: 0, premium: 0, ratio: null };
  const c = await one(`SELECT count(*)::int AS n, COALESCE(sum(COALESCE(c.settled_amount, c.approved_amount, c.estimate_amount)), 0)::numeric AS amount
    FROM claims c JOIN policies p ON p.id = c.policy_id WHERE COALESCE(c.client_id, p.client_id) = $1 AND c.status NOT IN ('rejected', 'cancelled')`, [clientId]);
  const p = await one("SELECT COALESCE(sum(premium_total), 0)::numeric AS premium FROM policies WHERE client_id = $1 AND status <> 'cancelled'", [clientId]);
  const premium = Number(p.premium);
  const amount = Number(c.amount);
  return { claims: c.n, claimsAmount: round2(amount), premium: round2(premium), ratio: premium > 0 ? round2((amount / premium) * 100) : null };
}
