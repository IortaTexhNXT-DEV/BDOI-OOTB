/**
 * Motor rating controls of a quotation (TIS-BRD-PROD-12, PROD-09, PROD-10, QUOT-02, RENEW-03; MC-01, MC-02, MC-05).
 *
 * Fair market value (FMV). The Own Damage sum insured of a Comprehensive Motor quotation is the FMV of the vehicle. The
 * system works it out from a reference value less a depreciation: the FMV of the expiring term on a renewal, the
 * suggested retail price (SRP) of a TFS prospect, or a reference value given on the quotation (fmvRating.referenceValue,
 * for example the previous FMV of a car insured elsewhere). The depreciation is motor.depreciation_pct (10%) unless
 * one of motor.depreciation_options (8, 10, 15, 20%) is chosen; a brand-new vehicle priced on its SRP is not
 * depreciated. An FMV other than the computed one (or the reference value itself) is an edit: only a holder of
 * override:motor-fmv makes it, with a reason (motor.fmv_edit_reason_required). Without a reference value the FMV is
 * keyed as before.
 *
 * Issuing rates. The default Own Damage and Acts of Nature rates are the issuing rates of the commission rule of the
 * quotation (commission rules register, FR-CMR-020), else the Own Damage rate of the vehicle class in the motor tariff,
 * else promotions.standard_rates. A rate other than the default (or the rate of the expiring term on a renewal, or the
 * rates of a dealer programme) is a rate change: only a holder of override:quotation-rates makes it
 * (motor.rate_override_controlled), never an external agent. A promotion sets its own rates (promotions/quote.js).
 * A rate below the minimum issuing rate (motor.minimum_issuing_rates, and the lowest Own Damage rate of the discount
 * cap of the product and channel type) is referred to motor.min_rate_approval_roles (rule RATE_BELOW_MIN, PROD-09).
 *
 * Discount. Without a promotion, the Order Summary discount of a Motor quotation stays within the discount cap of the
 * product and channel type, and above the maker's Quotation discount authority it is referred
 * (quotations.discount_caps_without_promotion).
 *
 * Excess. The Motor excess is motor.excess (5% of the sum insured by default; a promotion's fixed excess replaces it).
 *
 * The terms are kept on the quotation as doc.motorRating (the server's, never the client's).
 */
import { badRequest, forbidden } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { lobOf } from '../documents/common.js';
import { decisionReason } from '../ops-masters/records.js';
import { resolveCommissionRate, motorTypeOf } from '../commission-rates/resolve.js';
import { capFor } from '../promotions/caps.js';
import { standardRates } from '../promotions/rates.js';
import { quoteChannelType, userHolds, discountAuthority } from '../promotions/quote.js';
import { motorTariff, vehicleClass, vehicleOf } from './motorTariff.js';

export const MIN_RATE_RULE = 'RATE_BELOW_MIN';
export const FMV_PERMISSION = 'override:motor-fmv';
export const RATE_PERMISSION = 'override:quotation-rates';
const EPS = 0.00005;

const fail = (path, message) => badRequest(message, [{ path, message }]);
const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const comprehensive = (doc) => ['COMP', 'COMPREHENSIVE'].includes(String(doc.insurancePolicyType || 'COMP').toUpperCase());
const same = (a, b) => Math.abs(num(a) - num(b)) < EPS;

/** Whether the motor rating controls apply to a quotation document: a Comprehensive Motor quotation. */
export const isMotorRated = (doc) => lobOf(doc.lob, doc.productType, doc.insurancePolicyType) === 'MOTOR' && comprehensive(doc);

/** The settings of the motor rating (one read per quotation). */
export async function ratingSettings() {
  const excess = (await getSetting('motor.excess', { pct: 5, basis: 'sum-insured', minimum: 0 })) || {};
  const minimum = (await getSetting('motor.minimum_issuing_rates', { OD: null, AON: null })) || {};
  return {
    fmvRating: (await getSetting('motor.fmv_rating', true)) !== false,
    depreciationPct: num(await getSetting('motor.depreciation_pct', 10)),
    depreciationOptions: ((await getSetting('motor.depreciation_options', [8, 10, 15, 20])) || []).map(num),
    fmvReasonRequired: (await getSetting('motor.fmv_edit_reason_required', true)) !== false,
    rateControlled: (await getSetting('motor.rate_override_controlled', true)) !== false,
    minimumRates: { OD: blank(minimum.OD) ? null : num(minimum.OD), AON: blank(minimum.AON) ? null : num(minimum.AON) },
    minRateRoles: (await getSetting('motor.min_rate_approval_roles', [])) || [],
    discountCaps: (await getSetting('quotations.discount_caps_without_promotion', true)) !== false,
    excess: { pct: num(excess.pct), basis: excess.basis === 'loss' ? 'loss' : 'sum-insured', minimum: num(excess.minimum) },
  };
}

/** The motor product of a quotation (id, name, line). */
async function productOf(c, productId, productType) {
  return (await c.query(`SELECT id, name, line FROM products WHERE ($1::int IS NOT NULL AND id = $1::int)
      OR ($1::int IS NULL AND (lower(code) = lower($2) OR lower(name) = lower($2) OR (line = 'motor' AND code = 'MOTOR' AND lower($2) IN ('motor', 'comprehensive'))))
    ORDER BY ($1::int IS NOT NULL AND id = $1::int) DESC, (lower(code) = lower($2)) DESC LIMIT 1`, [productId ? Number(productId) : null, productType || ''])).rows[0] || null;
}

/** The expiring term of a renewal quotation: { fmv, odRate, aonRate } of the policy (its document, else its quotation). */
async function expiringTerm(c, doc) {
  const policyId = doc.renewal?.policyId;
  if (!policyId) return null;
  const p = (await c.query(`SELECT p.sum_insured, p.doc, q.doc AS quote_doc FROM policies p LEFT JOIN quotes q ON q.id = p.quote_id WHERE p.id::text = $1::text`, [String(policyId)])).rows[0];
  if (!p) return null;
  const src = { ...(p.quote_doc || {}), ...(p.doc || {}) };
  const fmv = num(src.lossAndDamageCoverage) || num(p.sum_insured);
  return { fmv: fmv > 0 ? fmv : null, odRate: blank(src.lossAndDamageCoverageRate) ? null : num(src.lossAndDamageCoverageRate),
    aonRate: blank(src.actsOfNatureRate) ? null : num(src.actsOfNatureRate) };
}

/** The SRP of the prospect of a quotation (TFS accounts carry it), or null. */
async function leadSrp(c, leadId) {
  if (!leadId) return null;
  const r = (await c.query('SELECT srp FROM leads WHERE id = $1', [leadId])).rows[0];
  return num(r?.srp) > 0 ? num(r.srp) : null;
}

const brandNew = (doc) => doc.vehicleCondition === 'Brand New' || doc.brandNew === true;

/**
 * The reference value of the FMV: { value, basis, depreciationPct } (basis previous-fmv | srp | reference), or null.
 * An explicit fmvRating.referenceValue wins; then the FMV of the expiring term; then the SRP of the prospect.
 */
async function fmvReference(c, doc, term, leadId, s) {
  const asked = doc.fmvRating || {};
  const askedPct = blank(asked.depreciationPct) ? null : num(asked.depreciationPct);
  if (askedPct !== null && askedPct !== 0 && !s.depreciationOptions.some((o) => same(o, askedPct))) {
    throw fail('fmvRating.depreciationPct', `The depreciation must be one of ${s.depreciationOptions.join(', ')}%`);
  }
  if (!blank(asked.referenceValue)) {
    const value = num(asked.referenceValue);
    if (!(value > 0)) throw fail('fmvRating.referenceValue', 'The reference value must be above zero');
    return { value, basis: asked.referenceBasis === 'srp' ? 'srp' : 'reference', depreciationPct: askedPct ?? (asked.referenceBasis === 'srp' && brandNew(doc) ? 0 : s.depreciationPct) };
  }
  if (term?.fmv) return { value: term.fmv, basis: 'previous-fmv', depreciationPct: askedPct ?? s.depreciationPct };
  const srp = await leadSrp(c, leadId);
  if (srp) return { value: srp, basis: 'srp', depreciationPct: askedPct ?? (brandNew(doc) ? 0 : s.depreciationPct) };
  return null;
}

/**
 * The default issuing rates of a quotation: { OD, AON, source (rule | tariff | standard), ruleId, rule: the issuing,
 * TIS remitting and insurer net rates of the rule's perils } (FR-CMR-020).
 */
export async function defaultIssuingRates(c, { doc, productId, icId, leadId, fmv = null }) {
  const std = await standardRates();
  let rule = null;
  try {
    rule = await resolveCommissionRate({ insurerId: icId, productId, lob: 'motor', policyType: doc.renewal?.policyId ? 'renewal' : 'new',
      channelType: await quoteChannelType(c, doc, leadId), motorType: await motorTypeOf(doc), sumInsured: fmv, perPeril: true, db: c });
  } catch { rule = null; }
  const peril = (code) => (rule?.rateBasis === 'issuing-remitting' ? (rule.perilRates || []).find((p) => p.peril === code && p.basis === 'issuing-remitting') : null);
  const od = peril('OD');
  const aon = peril('AON');
  const tariffRate = vehicleClass(await motorTariff(), vehicleOf(doc).vehicleType)?.ownDamageRate;
  const odRate = !blank(od?.issuing) ? num(od.issuing) : !blank(tariffRate) ? num(tariffRate) : std.ownDamage;
  const aonRate = !blank(aon?.issuing) ? num(aon.issuing) : std.actsOfNature;
  const source = !blank(od?.issuing) ? 'rule' : !blank(tariffRate) ? 'tariff' : 'standard';
  const rates = (p) => (p ? { issuing: num(p.issuing), tisRemitting: blank(p.tisRemitting) ? null : num(p.tisRemitting), insurerNet: blank(p.insurerNet) ? null : num(p.insurerNet) } : null);
  return { OD: odRate, AON: aonRate, source, ruleId: od || aon ? rule.ruleId : null, ruleVersion: od || aon ? rule.version : null, perils: { OD: rates(od), AON: rates(aon) } };
}

/** The effective rate of a peril on a document: its rate, else premium / sum insured, else null. */
function effectiveRate(doc, rateField, premiumField, siField = 'lossAndDamageCoverage') {
  if (!blank(doc[rateField])) return num(doc[rateField]);
  const si = num(doc[siField]);
  return !blank(doc[premiumField]) && si > 0 ? Math.round((num(doc[premiumField]) / si) * 100 * 10000) / 10000 : null;
}

/**
 * The rates a quotation may carry without a rate change: the default, the expiring term's, the dealer programme's, the
 * rate it was saved with before (a change of another field does not ask again), and the standard rates a quotation
 * returns to when its promotion is removed.
 */
function ratesAccepted(peril, { defaults, term, doc, previous, standard }) {
  const out = [defaults[peril], previous?.rates?.used?.[peril]];
  if (term) out.push(peril === 'OD' ? term.odRate : term.aonRate);
  if (doc.dealerProgramme) out.push(peril === 'OD' ? doc.lossAndDamageCoverageRate : doc.actsOfNatureRate);
  if (standard) out.push(peril === 'OD' ? standard.ownDamage : standard.actsOfNature);
  return out.filter((x) => x !== null && x !== undefined);
}

/**
 * Step 1, before the promotion and the pricing (create or change): the FMV from its reference value (checked against
 * the user's right to edit it, with the reason) and the default Own Damage rate filled in. Returns the state that
 * checkMotorRates completes, or null for a quotation the controls do not apply to. `previous` is doc.motorRating of the
 * quotation before the change.
 */
export async function prepareMotorRating(c, { doc, previous = null, userId, productId, productType, icId, leadId }) {
  if (!isMotorRated(doc)) { delete doc.motorRating; return null; }
  const product = await productOf(c, productId, productType || doc.productType);
  if (product && product.line !== 'motor') { delete doc.motorRating; return null; }
  const s = await ratingSettings();
  const term = await expiringTerm(c, doc);
  const now = new Date().toISOString();
  let fmvTerms = null;
  if (s.fmvRating) {
    const ref = await fmvReference(c, doc, term, leadId, s);
    if (ref) {
      const computed = round2(ref.value * (1 - ref.depreciationPct / 100));
      if (blank(doc.lossAndDamageCoverage)) doc.lossAndDamageCoverage = computed;
      const fmv = num(doc.lossAndDamageCoverage);
      const edited = Math.abs(fmv - computed) >= 0.5 && Math.abs(fmv - ref.value) >= 0.5;
      fmvTerms = { referenceValue: ref.value, referenceBasis: ref.basis, depreciationPct: ref.depreciationPct, computedFmv: computed, fmv, edited };
      if (edited) {
        // the FMV the quotation was saved with is not asked again when another field changes
        const kept = previous?.fmv && same(previous.fmv.fmv, fmv);
        if (kept) Object.assign(fmvTerms, { reason: previous.fmv.reason ?? null, reasonCode: previous.fmv.reasonCode ?? null, editedById: previous.fmv.editedById ?? null, editedAt: previous.fmv.editedAt ?? null });
        else {
          if (!(await userHolds(c, userId, FMV_PERMISSION))) {
            throw forbidden(`The fair market value of the vehicle is ${computed.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${ref.basis === 'previous-fmv' ? 'FMV of the expiring term' : ref.basis === 'srp' ? 'SRP' : 'reference value'} less ${ref.depreciationPct}%): only users with the right to edit the FMV may change it`);
          }
          const r = await decisionReason(c, ['fmv_edit'], { reasonCode: doc.fmvRating?.reasonCode, reason: doc.fmvRating?.reason });
          if (s.fmvReasonRequired && !r.text) throw fail('fmvRating.reason', 'Give the reason for changing the fair market value');
          Object.assign(fmvTerms, { reason: r.text, reasonCode: r.code, editedById: userId, editedAt: now });
        }
      }
    }
  }
  const defaults = await defaultIssuingRates(c, { doc, productId: product?.id ?? productId, icId, leadId, fmv: num(doc.lossAndDamageCoverage) || null });
  if (!doc.promotion?.code && blank(doc.lossAndDamageCoverageRate) && blank(doc.lossAndDamageCoveragePremium) && num(doc.lossAndDamageCoverage) > 0) {
    doc.lossAndDamageCoverageRate = defaults.OD;
  }
  return { s, product, term, now, fmvTerms, defaults, previous, userId, leadId };
}

/**
 * Step 2, after the promotion is applied: the rate change (checked against the user's right, with its reason), the
 * minimum issuing rate, the excess; writes doc.motorRating. `hadPromotion`: the quotation was priced with a promotion
 * before this change. Returns { minRate } (the RATE_BELOW_MIN referral part, or null).
 */
export async function checkMotorRates(c, state, { doc, hadPromotion = false }) {
  if (!state) return null;
  const { s, product, term, now, fmvTerms, defaults, previous, userId, leadId } = state;
  const promo = Boolean(doc.promotion?.code);
  const used = { OD: effectiveRate(doc, 'lossAndDamageCoverageRate', 'lossAndDamageCoveragePremium'), AON: effectiveRate(doc, 'actsOfNatureRate', 'actsOfNaturePremium') };
  const accepted = { defaults, term, doc, previous, standard: hadPromotion ? await standardRates() : null };
  const changed = promo ? [] : ['OD', 'AON'].filter((p) => used[p] !== null && !ratesAccepted(p, accepted).some((x) => same(x, used[p])));
  let override = null;
  if (changed.length) {
    const kept = previous?.rates?.override && changed.every((p) => same(previous.rates.override.rates?.[p], used[p]));
    if (kept) override = previous.rates.override;
    else {
      if (s.rateControlled && !(await userHolds(c, userId, RATE_PERMISSION))) {
        const names = { OD: 'Own Damage', AON: 'Acts of Nature' };
        throw forbidden(`${changed.map((p) => `${names[p]} rate ${used[p]}% differs from the issuing rate of ${defaults[p]}%`).join('; ')}: only users with the right to change peril rates may change it`);
      }
      const r = await decisionReason(c, ['rate_override'], { reasonCode: doc.rateOverride?.reasonCode, reason: doc.rateOverride?.reason });
      override = { perils: changed, rates: Object.fromEntries(changed.map((p) => [p, used[p]])), reason: r.text, reasonCode: r.code, byId: userId, at: now };
    }
  }

  // minimum issuing rate (PROD-09): the setting and the lowest Own Damage rate of the discount cap; a promotion has its own
  let minRate = null;
  if (!promo && used.OD !== null) {
    const cap = product ? await capFor(product.id, await quoteChannelType(c, doc, leadId), await today(), c) : null;
    const odFloor = Math.max(0, ...[s.minimumRates.OD, cap?.lowestOd].filter((x) => x !== null && x !== undefined).map(num));
    const floors = { OD: odFloor > 0 ? odFloor : null, AON: s.minimumRates.AON };
    const below = ['OD', 'AON'].filter((p) => used[p] !== null && floors[p] !== null && used[p] < floors[p] - EPS);
    if (below.length) {
      const names = Object.fromEntries((await c.query('SELECT code, name FROM roles WHERE code = ANY($1)', [s.minRateRoles])).rows.map((r) => [r.code, r.name]));
      minRate = { rates: Object.fromEntries(below.map((p) => [p, used[p]])), authorityRoles: s.minRateRoles, roleNames: names,
        message: `${below.map((p) => `${p === 'OD' ? 'Own Damage' : 'Acts of Nature'} rate ${used[p]}% is below the minimum issuing rate of ${floors[p]}%`).join('; ')}: approval needed` };
    }
  }

  // excess (PROD-10): a promotion's fixed excess, else the setting
  const promoExcess = num(doc.promotion?.excess);
  const si = num(doc.lossAndDamageCoverage);
  const excess = promoExcess > 0 ? { basis: 'fixed', amount: promoExcess, source: 'promotion' }
    : s.excess.pct > 0 ? { basis: s.excess.basis, pct: s.excess.pct, minimum: s.excess.minimum,
      amount: s.excess.basis === 'sum-insured' && si > 0 ? round2(Math.max(s.excess.minimum, (si * s.excess.pct) / 100)) : null, source: 'setting' } : null;

  doc.motorRating = {
    fmv: fmvTerms,
    rates: { default: { OD: defaults.OD, AON: defaults.AON }, source: defaults.source, ruleId: defaults.ruleId, ruleVersion: defaults.ruleVersion, perils: defaults.perils,
      used, override, promotion: promo },
    excess,
    minimumRate: minRate ? { rates: minRate.rates, message: minRate.message } : null,
  };
  return { minRate };
}

/**
 * The underwriting referral with a rate below the minimum issuing rate merged in: approved again only for the same
 * rates; otherwise pending for motor.min_rate_approval_roles.
 */
export function withRateReferral(referral, minRate, previous) {
  if (!minRate) return referral;
  const sameRates = (r) => r?.status === 'approved' && (r.ruleCodes || []).includes(MIN_RATE_RULE) && JSON.stringify(r.minimumRates || {}) === JSON.stringify(minRate.rates);
  if (sameRates(referral)) return referral;
  if (!referral && sameRates(previous)) return previous;
  const base = referral && referral.status === 'pending' ? referral : { status: 'pending', ruleCodes: [], authorityRoles: [], authorityRoleNames: [], reasons: [], requestedAt: new Date().toISOString() };
  const names = Object.fromEntries((base.authorityRoles || []).map((r, i) => [r, (base.authorityRoleNames || [])[i] || r]));
  const roles = [...new Set([...(base.authorityRoles || []), ...minRate.authorityRoles])];
  return { ...base, ruleCodes: [...new Set([...(base.ruleCodes || []), MIN_RATE_RULE])], authorityRoles: roles, authorityRoleNames: roles.map((r) => names[r] || minRate.roleNames[r] || r),
    reasons: [...(base.reasons || []), `${MIN_RATE_RULE}: ${minRate.message}`], minimumRates: minRate.rates };
}

/**
 * The Order Summary discount of a Motor quotation without a promotion (PROD-09): within the discount cap of the product
 * and channel type (refused above the maximum), and above the maker's Quotation discount authority referred. Returns
 * the authority part for withDiscountReferral, or null. `b` is the priced breakdown.
 */
export async function discountControl(c, { doc, b, productId, productType, leadId, userId }) {
  if (!isMotorRated(doc) || doc.promotion?.code || !(num(b.discount) > 0)) return null;
  if ((await getSetting('quotations.discount_caps_without_promotion', true)) === false) return null;
  const product = await productOf(c, productId, productType || doc.productType);
  if (!product || product.line !== 'motor') return null;
  const discountable = round2(num(b.grossPremium) + num(b.discount) - num(b.ctplCoveragePremium));
  if (!(discountable > 0)) return null;
  const pct = round2((num(b.discount) / discountable) * 100);
  const date = await today();
  const channelType = await quoteChannelType(c, doc, leadId);
  const cap = await capFor(product.id, channelType, date, c);
  if (cap && pct > cap.maxPct) throw fail('discount', `The discount of ${pct.toFixed(2)}% is above the maximum of ${cap.maxPct.toFixed(2)}% for ${product.name} through this channel`);
  if (cap && pct < cap.minPct) throw fail('discount', `The discount of ${pct.toFixed(2)}% is below the minimum of ${cap.minPct.toFixed(2)}% for ${product.name} through this channel`);
  return discountAuthority(c, userId, pct, date);
}

/**
 * What Create Quote offers before the user enters the vehicle's value and rates (GET /quotations/motor-rating):
 * the default issuing rates, the reference value and computed FMV, the depreciation options, the excess, and whether
 * the user may change rates or the FMV.
 */
export async function motorRatingPreview(c, { doc, productId, productType, icId, leadId, userId }) {
  const s = await ratingSettings();
  const product = await productOf(c, productId, productType || doc.productType);
  const term = await expiringTerm(c, doc);
  const ref = s.fmvRating ? await fmvReference(c, doc, term, leadId, s) : null;
  const computed = ref ? round2(ref.value * (1 - ref.depreciationPct / 100)) : null;
  const defaults = await defaultIssuingRates(c, { doc, productId: product?.id ?? productId, icId, leadId, fmv: computed ?? (num(doc.lossAndDamageCoverage) || null) });
  const si = computed ?? num(doc.lossAndDamageCoverage);
  const cap = product ? await capFor(product.id, await quoteChannelType(c, doc, leadId), await today(), c) : null;
  const odFloor = Math.max(0, ...[s.minimumRates.OD, cap?.lowestOd].filter((x) => x !== null && x !== undefined).map(num));
  return {
    minimumRates: { OD: odFloor > 0 ? odFloor : null, AON: s.minimumRates.AON },
    fmv: ref ? { referenceValue: ref.value, referenceBasis: ref.basis, depreciationPct: ref.depreciationPct, computedFmv: computed } : null,
    depreciationOptions: s.depreciationOptions, defaultDepreciationPct: s.depreciationPct, fmvReasonRequired: s.fmvReasonRequired,
    rates: { OD: defaults.OD, AON: defaults.AON, source: defaults.source, ruleId: defaults.ruleId, perils: defaults.perils },
    expiringRates: term ? { OD: term.odRate, AON: term.aonRate } : null,
    excess: s.excess.pct > 0 ? { ...s.excess, amount: s.excess.basis === 'sum-insured' && si > 0 ? round2(Math.max(s.excess.minimum, (si * s.excess.pct) / 100)) : null } : null,
    canChangeRates: !s.rateControlled || (await userHolds(c, userId, RATE_PERMISSION)),
    canEditFmv: await userHolds(c, userId, FMV_PERMISSION),
  };
}
