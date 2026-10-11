/**
 * Commission basis of a policy (TIS-BRD-COMM-06, COMM-05, PROD-16; FRS FR-RMT-001 to 005, FR-CMR-021, 023).
 *
 * When a policy is booked the rates of the commission rules register are copied onto it (policies.details
 * .commissionBasis) and never read again for that policy: a Motor policy on a rule rated per peril keeps, for Own
 * Damage / Theft and Acts of Nature, the issuing rate of the policy, the insurer net rate and the TIS remitting rate,
 * and for Bodily Injury, Property Damage and Auto Passenger Personal Accident the commission % of the premium; the
 * insurer remitting amount and the commission of each peril, the gross commission (net premium less total insurer
 * remitting), the variance share of an external agent, a TFS team member or a referral (sum insured x (issuing -
 * TIS remitting) on Own Damage and Acts of Nature), the shares of the sharing scheme in force and what TISPH keeps.
 * A non-Motor policy, or a Motor policy while commission.peril_based_motor is off, keeps one commission % of the net
 * premium. The snapshot feeds the receivable, the remittance and the commission lines of the referrers; Recompute
 * (write:remittance) reads the register again while the policy is on no approved remittance.
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { conflict, notFound } from '../../lib/errors.js';
import { isoDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { motorTypeOf, channelTypeOf, resolveCommissionRate } from '../commission-rates/resolve.js';
import { FULL_REMIT_PERILS, PERILS, isDualRateLine } from '../commission-rates/perils.js';
import { schemeFor } from './schemes.js';

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
const pct4 = (v) => Math.round(Number(v) * 10000) / 10000;

/** The policy row with what the basis needs. */
export async function policyForBasis(db, policyId) {
  const p = (await db.query(`SELECT p.id, p.policy_number, p.insurance_company_id, p.product_id, p.lob, p.inception_date, p.renewed_from, p.channel_id, p.doc, p.details, p.net_premium,
      p.premium_total, p.commission_amount, p.status, pr.line AS product_line, pr.code AS product_code, ic.name AS insurer_name, ch.channel_type
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN distribution_channels ch ON ch.id = p.channel_id
    WHERE p.id = $1 OR p.policy_number = $1`, [String(policyId)])).rows[0];
  if (!p) throw notFound('Policy not found');
  return p;
}

/** Referrer of the policy (primary of its commission details) with its parent. */
async function referrerOf(db, details) {
  const id = details?.commissionDetails?.primary?.referrerId;
  if (!id || id === 'direct') return null;
  const r = (await db.query('SELECT r.*, p.id AS parent_id, p.name AS parent_name, p.referrer_type AS parent_type FROM commission_referrers r LEFT JOIN commission_referrers p ON p.id = r.parent_referrer_id WHERE r.id = $1', [String(id)])).rows[0];
  return r || null;
}

/** The promotion rates kept on a quotation (PROD-15): { issuing: {OD, AON}, remit: {OD, AON} } or null. */
const promoOf = (doc) => {
  const p = doc?.promotion || null;
  if (!p || typeof p !== 'object') return null;
  const issuing = { OD: num(p.odRate ?? p.promoOdRate), AON: num(p.aonRate ?? p.promoAonRate) };
  const remit = { OD: num(p.remitOdRate ?? p.promoRemitOdRate), AON: num(p.remitAonRate ?? p.promoRemitAonRate) };
  return issuing.OD || issuing.AON || remit.OD || remit.AON ? { code: p.code || p.promotionCode || null, issuing, remit } : null;
};

/**
 * Compute the commission basis of a policy row (policyForBasis) on its inception date: the rule, the perils, the
 * amounts, the variance share, the scheme shares and what TISPH keeps. Does not store anything.
 */
export async function computeBasis(db, p, { details = null } = {}) {
  const doc = p.doc || {};
  const det = details || p.details || {};
  const netPremium = round2(num(p.net_premium) || num(det.netPremium) || num(doc.netPremium));
  const date = isoDate(p.inception_date) || (await today());
  const businessType = p.renewed_from ? 'RENEW' : 'NEW';
  const referrer = await referrerOf(db, det);
  const channelType = channelTypeOf({ channelType: p.channel_type, referrerId: referrer?.id || null });
  const line = p.lob || p.product_line;
  const motor = (await isDualRateLine(line)) && (await getSetting('commission.peril_based_motor', false)) === true;
  const motorType = motor ? await motorTypeOf(doc) : null;
  const rule = await resolveCommissionRate({ insurerId: p.insurance_company_id, productId: p.product_id, lob: line, policyType: businessType === 'RENEW' ? 'renewal' : 'new',
    channelType, motorType, sumInsured: num(doc.lossAndDamageCoverage) || null, date, perPeril: motor, db });
  const warnings = [];
  const basis = { computedAt: new Date().toISOString(), date, businessType, channelType, motorType, netPremium, ruleId: rule.ruleId, ruleVersion: rule.version, ruleLevel: rule.level,
    source: rule.source, rateBasis: 'net-premium', rate: pct4(rule.rate * 100), perils: [], insurerRemitting: 0, grossCommission: 0, varianceShare: 0, shares: [], retained: 0,
    scheme: null, status: 'ok', warnings, referrer: referrer ? { id: referrer.id, name: referrer.name, type: referrer.referrer_type } : null };
  const perPeril = motor && rule.source === 'matrix' && rule.rateBasis === 'issuing-remitting';
  if (motor && !perPeril) {
    basis.status = 'rates-missing';
    warnings.push(`No commission rates found for ${p.insurer_name || 'the insurer'}, ${motorType || 'this motor type'}, ${businessType} on ${date}. Add them on the commission rules register, then recompute.`);
  }
  if (!perPeril) {
    basis.grossCommission = round2(netPremium * rule.rate);
    basis.insurerRemitting = round2(netPremium - basis.grossCommission);
    basis.perils = [{ code: 'ALL', name: 'Net premium', basis: 'premium-pct', sumInsured: null, premium: netPremium, commissionPct: basis.rate, insurerRemitting: basis.insurerRemitting, commission: basis.grossCommission, varianceShare: 0 }];
  } else {
    basis.rateBasis = 'issuing-remitting';
    const promo = promoOf(doc);
    const variancePerils = ((await getSetting('commission.variance_perils', ['OD', 'AON'])) || []).map((x) => String(x).toUpperCase());
    const varianceChannels = ((await getSetting('commission.variance_channels', ['Agent', 'Sub-agent', 'TFS team member', 'Referral', 'External'])) || []).map((x) => String(x).toLowerCase());
    const earnsVariance = !!referrer && varianceChannels.includes(String(referrer.referrer_type || '').toLowerCase());
    const promoBasis = await getSetting('commission.promo_variance_basis', 'same_points');
    const ratesByPeril = new Map((rule.perilRates || []).map((r) => [String(r.peril).toUpperCase(), r]));
    let remitting = 0;
    let commission = 0;
    let variance = 0;
    for (const def of PERILS) {
      const r = ratesByPeril.get(def.code) || { basis: 'none' };
      const si = def.siField ? round2(num(doc[def.siField])) : null;
      const premium = round2(num(doc[def.premiumField]));
      if (!premium && !si) continue;
      const row = { code: def.code, name: def.name, basis: r.basis || 'none', sumInsured: si, premium, issuing: null, insurerNet: null, tisRemitting: null, commissionPct: null, insurerRemitting: premium, commission: 0, variance: null, varianceShare: 0 };
      if (r.basis === 'issuing-remitting') {
        const promoIssuing = promo?.issuing?.[def.code] || 0;
        const promoRemit = promo?.remit?.[def.code] || 0;
        const issuing = pct4(num(doc[def.rateField]) || promoIssuing || num(r.issuing) || (si ? (premium / si) * 100 : 0));
        const insurerNet = pct4(promoRemit || num(r.insurerNet));
        const standardVariance = pct4(num(r.issuing || issuing) - num(r.tisRemitting));
        let tisRemitting = pct4(num(r.tisRemitting));
        if (promoRemit) {
          tisRemitting = promoBasis === 'register_rate' ? tisRemitting : pct4(Math.max(insurerNet, issuing - standardVariance));
          if (promoBasis !== 'register_rate' && issuing - standardVariance < insurerNet) warnings.push(`On ${def.name} the TIS remitting rate is raised to the promo net rate of ${insurerNet}%.`);
        }
        row.issuing = issuing;
        row.insurerNet = insurerNet;
        row.tisRemitting = tisRemitting;
        row.insurerRemitting = round2(((si || 0) * insurerNet) / 100);
        row.commission = round2(premium - row.insurerRemitting);
        row.variance = pct4(Math.max(0, issuing - tisRemitting));
        if (row.commission < 0) warnings.push(`The issuing rate of ${def.name} (${issuing}%) is below the insurer net rate (${insurerNet}%). The commission on this peril is negative.`);
        if (earnsVariance && variancePerils.includes(def.code)) row.varianceShare = round2(((si || 0) * row.variance) / 100);
      } else if (r.basis === 'premium-pct') {
        row.commissionPct = pct4(num(r.commissionPct));
        row.commission = round2((premium * row.commissionPct) / 100);
        row.insurerRemitting = round2(premium - row.commission);
      }
      remitting = round2(remitting + row.insurerRemitting);
      commission = round2(commission + row.commission);
      variance = round2(variance + row.varianceShare);
      basis.perils.push(row);
    }
    let fullRemit = 0;
    for (const def of FULL_REMIT_PERILS) {
      const premium = round2(num(doc[def.premiumField]));
      if (!premium) continue;
      fullRemit = round2(fullRemit + premium);
      basis.perils.push({ code: def.code, name: def.name, basis: 'full-remit', sumInsured: null, premium, insurerRemitting: premium, commission: 0, varianceShare: 0 });
    }
    basis.insurerRemitting = remitting;
    basis.fullRemit = fullRemit;
    basis.grossCommission = commission;
    if (variance > commission && commission >= 0) {
      warnings.push(`The variance share (${variance.toFixed(2)}) is above the gross commission of the policy (${commission.toFixed(2)}). It has been capped at the gross commission.`);
      variance = commission;
    }
    basis.varianceShare = variance;
  }
  // sharing scheme of the referrer or channel (FR-CMR-015), else the variance share of the referrer (FR-RMT-003)
  const found = await schemeFor(db, { referrerId: referrer?.id || null, channelId: p.channel_id, productId: p.product_id, insurerId: p.insurance_company_id,
    policyType: businessType === 'RENEW' ? 'renewal' : 'new', date });
  if (found.scheme) {
    basis.scheme = { id: found.scheme.id, code: found.scheme.code, name: found.scheme.name, version: found.scheme.version, source: found.source, override: found.override, payWhenFullyPaid: found.scheme.pay_when_fully_paid };
    basis.shares = schemeShares(found.scheme, found.override, basis, { referrer, channelId: p.channel_id });
  } else if (basis.varianceShare > 0 && referrer) {
    const perils = basis.perils.filter((x) => x.varianceShare > 0);
    basis.shares = [{ lineNo: 1, paidTo: 'referrer', referrerId: referrer.id, name: referrer.name, basis: 'variance', perils: perils.map((x) => x.code), value: perils[0]?.variance ?? 0,
      min: 0, max: perils[0]?.variance ?? 0, perilValues: Object.fromEntries(perils.map((x) => [x.code, x.variance])), amount: basis.varianceShare,
      note: perils.map((x) => `${x.code} ${x.issuing} - ${x.tisRemitting}`).join(' / ') }];
  }
  const shared = round2(basis.shares.reduce((s, x) => s + x.amount, 0));
  if (shared > basis.grossCommission && basis.grossCommission >= 0) {
    // an excess is cut from the last line and flagged (FR-CMR-011 R4)
    let excess = round2(shared - basis.grossCommission);
    for (const sh of [...basis.shares].reverse()) { const cut = Math.min(sh.amount, excess); sh.amount = round2(sh.amount - cut); excess = round2(excess - cut); if (!excess) break; }
    warnings.push('The shares were higher than the commission of the policy and have been cut to it.');
  }
  basis.sharedTotal = round2(basis.shares.reduce((s, x) => s + x.amount, 0));
  basis.retained = round2(basis.grossCommission - basis.sharedTotal);
  return basis;
}

/** The amounts of a scheme's split lines on a basis (FR-CMR-011): one share per line with a payee. */
export function schemeShares(scheme, override, basis, { referrer, channelId }) {
  const out = [];
  const perilRows = new Map(basis.perils.map((x) => [x.code, x]));
  for (const [i, l] of (scheme.lines || []).entries()) {
    let payee = null;
    if (l.paidTo === 'referrer') payee = referrer ? { referrerId: referrer.id, name: referrer.name } : null;
    else if (l.paidTo === 'parent') {
      if (referrer?.parent_id) payee = { referrerId: referrer.parent_id, name: referrer.parent_name };
      else if (l.addToReferrer && referrer) payee = { referrerId: referrer.id, name: referrer.name };
    } else if (l.paidTo === 'channel') payee = channelId ? { channelId, name: 'Channel' } : null;
    if (!payee) continue;
    const value = override !== null && override !== undefined && i === 0 ? Number(override) : Number(l.defaultValue);
    const perils = (l.perils?.length ? l.perils : ['OD', 'AON']).map((c) => String(c).toUpperCase());
    let amount = 0;
    const perilValues = {};
    if (l.basis === 'variance') {
      for (const c of perils) {
        const row = perilRows.get(c);
        if (!row || row.basis !== 'issuing-remitting') continue;
        // the variance of a peril is at most the rule's (issuing less TIS remitting) and never takes the TIS remitting
        // rate below the insurer net rate of the peril
        const v = pct4(Math.max(0, Math.min(value, row.issuing - row.tisRemitting, row.issuing - row.insurerNet)));
        perilValues[c] = v;
        amount += ((row.sumInsured || 0) * v) / 100;
      }
    } else if (l.basis === 'commission-pct') {
      const base = perils.map((c) => perilRows.get(c)?.commission || 0).reduce((s, x) => s + x, 0) || (basis.rateBasis === 'net-premium' ? basis.grossCommission : 0);
      amount = (base * value) / 100;
    } else if (l.basis === 'net-premium-pct') amount = (basis.netPremium * value) / 100;
    else amount = value;
    out.push({ lineNo: i + 1, paidTo: l.paidTo, referrerId: payee.referrerId || null, channelId: payee.channelId || null, name: payee.name, basis: l.basis, perils, value, min: Number(l.min ?? 0), max: l.max === null || l.max === undefined ? null : Number(l.max),
      perilValues: Object.keys(perilValues).length ? perilValues : null, amount: round2(Math.max(0, amount)) });
  }
  return out;
}

/** Store the basis on the policy and, when it comes from a per-peril rule, the policy's commission amount. */
export async function storeBasis(db, policyId, basis, { updateCommission = true } = {}) {
  await db.query("UPDATE policies SET details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('commissionBasis', $2::jsonb), updated_at = now() WHERE id = $1", [policyId, JSON.stringify(basis)]);
  if (updateCommission && basis.rateBasis === 'issuing-remitting' && basis.status === 'ok') {
    await db.query('UPDATE policies SET commission_amount = $2 WHERE id = $1', [policyId, basis.grossCommission]);
  }
}

/** The remittance an approved remittance line of the policy belongs to (its number), or null. */
async function approvedRemittanceOf(db, policyId) {
  return (await db.query(`SELECT r.remittance_number FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id
    WHERE rl.policy_id = $1 AND r.kind = 'direct-bill' AND r.status NOT IN ('draft', 'rejected', 'cancelled', 'for-approval') LIMIT 1`, [policyId])).rows[0]?.remittance_number || null;
}

/**
 * Commission breakdown of a policy for the screen: the stored basis (or one computed now, unstored, when none) with
 * the remittance and billing statement that carry the policy and whether Recompute is possible.
 */
export async function policyBreakdown(policyId, { db = null } = {}) {
  const run = db || { query };
  const p = await policyForBasis(run, policyId);
  const stored = p.details?.commissionBasis || null;
  const basis = stored || (await computeBasis(run, p));
  const remittance = await approvedRemittanceOf(run, p.id);
  const draft = (await run.query(`SELECT r.remittance_number, r.status FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id WHERE rl.policy_id = $1 AND r.kind = 'direct-bill' AND r.status IN ('draft', 'for-approval') LIMIT 1`, [p.id])).rows[0];
  const billing = (await run.query(`SELECT d.dn_number FROM commission_debit_note_lines l JOIN commission_debit_notes d ON d.id = l.debit_note_id WHERE l.policy_id = $1 AND d.status NOT IN ('rejected', 'cancelled') ORDER BY d.created_at DESC LIMIT 1`, [p.id])).rows[0];
  const { policyBasis } = await import('../remittance/basis.js');
  return { policyId: p.id, policyNumber: p.policy_number, insurer: p.insurer_name, stored: !!stored, basis, settlementBasis: await policyBasis(run, p),
    remittance: remittance || draft?.remittance_number || null, remittanceApproved: !!remittance, billingStatement: billing?.dn_number || null,
    recompute: { allowed: !remittance, reason: remittance ? `The commission of ${p.policy_number} cannot be recomputed: it is on approved remittance ${remittance}.` : null } };
}

/** Recompute the basis of a policy from the register (write:remittance); refused once on an approved remittance. */
export async function recomputeBasis(policyId, user) {
  const { withTransaction } = await import('../../db/pool.js');
  return withTransaction(async (db) => {
    const p = await policyForBasis(db, policyId);
    const remittance = await approvedRemittanceOf(db, p.id);
    if (remittance) throw conflict(`The commission of ${p.policy_number} cannot be recomputed: it is on approved remittance ${remittance}.`);
    const before = p.details?.commissionBasis || null;
    const basis = await computeBasis(db, p);
    await storeBasis(db, p.id, basis);
    // the draft remittance lines of the policy follow the new commission
    await db.query(`UPDATE remittance_lines rl SET commission = $2, net = round(rl.premium - $2 - rl.tax, 2) FROM remittances r
      WHERE r.id = rl.remittance_id AND rl.policy_id = $1 AND r.kind = 'direct-bill' AND r.status IN ('draft', 'rejected') AND $3::boolean`, [p.id, basis.grossCommission, basis.status === 'ok' && basis.rateBasis === 'issuing-remitting']);
    const { syncShareLines } = await import('./service.js');
    await syncShareLines(db, p.id, basis, user);
    const from = round2(before?.grossCommission ?? num(p.commission_amount));
    return { before, basis, message: `Commission recomputed: ${from.toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${basis.grossCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}.` };
  });
}
