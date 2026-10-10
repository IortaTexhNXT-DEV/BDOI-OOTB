/**
 * Return premium of a policy cancellation, computed (never typed in) from the days left:
 *   flat           cancelled from inception (or a reason whose method is flat): the whole premium is returned
 *   pro-rata       daily pro-rata: premium x days left / days of the policy period (insurer-initiated cancellations)
 *   short-period   the insured cancels: the insurer keeps the percentage of the annual premium of the short-period scale
 *                  (master short-period-rate) for the days the policy was in force (a shorter term is scaled to a year)
 *   manual         an amount entered by hand, only when endorsements.cancellation_allow_manual is on
 * The method follows the cancellation reason (master cancellation-reason: initiated by the insured or the insurer, method
 * auto | pro-rata | short-period | flat); endorsements.short_period_for_insured switches the short-period scale off.
 * A partial cancellation (cancellationType PARTIAL / PRO_RATA_PARTIAL) returns on the premium of the part cancelled
 * (partialPremium, or partialPercent of the policy premium) and leaves the policy in force.
 * A policy whose premium is only the CTPL tariff (net premium 0, gross premium the tariff amount with its taxes and the
 * authentication fee inside) returns on the tariff amount with no premium tax of its own (tariffOnly in the result).
 *
 * The premium taxes of the return come from the premium tax and charge engine (premium-charges quotationCharges) on the
 * returned premium, those of endorsements.cancellation_returned_taxes only (documentary stamp tax is not refundable by
 * default); the commission taken back is the policy's commission rate on the returned premium. The endorsement carries
 * the figures; completing it posts them through the return premium routine (posting rule policy.cancel).
 * insurerReturn is what the insurer gives back: on premium remitted gross (remittance.basis_rules) the whole return,
 * otherwise the return less the commission taken back and its output VAT, plus the EWT the insurer withheld on it.
 */
import { badRequest, conflict } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { quotationCharges } from '../premium-charges/service.js';
import { resolveCommissionRate } from '../commission-rates/resolve.js';
import { activeRecord, activeRecords } from '../ops-masters/records.js';
import { policyBasis } from '../remittance/basis.js';
import { commissionTaxSetup, commissionTaxes, ratesOf } from '../accounting/lib/commissionTax.js';

export const METHODS = ['pro-rata', 'short-period', 'flat', 'manual'];
const PARTIAL = new Set(['PARTIAL', 'PRO_RATA_PARTIAL']);
export const isPartialCancellation = (type) => PARTIAL.has(String(type || '').toUpperCase());
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** The short-period scale, shortest band first. */
export async function shortPeriodScale(db) {
  return (await activeRecords(db, 'short-period-rate')).map((r) => ({ code: r.code, maxDays: Number(r.maxDays), retainedPercent: Number(r.retainedPercent), description: r.description || r.name }))
    .filter((r) => r.maxDays > 0).sort((a, b) => a.maxDays - b.maxDays);
}

export async function cancellationReasons(db) {
  return (await activeRecords(db, 'cancellation-reason')).map((r) => ({ code: r.code, name: r.name, initiatedBy: r.initiatedBy || 'insured', method: r.method || 'auto', description: r.description || null }));
}

/** Retained percentage of the scale for the days in force (scaled to a year when the policy period is not a year). */
export function shortPeriodRetained(scale, daysInForce, totalDays) {
  const annualDays = totalDays >= 365 ? daysInForce : Math.ceil((daysInForce * 365) / Math.max(totalDays, 1));
  const band = scale.find((s) => annualDays <= s.maxDays) || null;
  return { band, annualDays, retainedPercent: band ? band.retainedPercent : 100 };
}

/**
 * Compute the return premium of cancelling a policy. input: { effectiveDate, reason, method, cancellationType,
 * partialPremium, partialPercent, returnPremium (net, method manual only) }. db: pool or transaction client.
 */
export async function computeReturn(db, policy, input = {}) {
  if (['cancelled', 'expired'].includes(policy.status)) throw conflict(`Policy ${policy.policy_number} is ${policy.status}`);
  const inception = isoDate(policy.inception_date);
  const expiry = isoDate(policy.expiry_date);
  const totalDays = Math.max(1, days(inception, expiry));
  const effective = isoDate(input.effectiveDate) || (await today());
  if (effective > expiry) throw badRequest('Validation failed', [{ path: 'effectiveDate', message: `The cancellation date ${effective} is after the policy expiry ${expiry}` }]);
  const daysInForce = Math.min(totalDays, Math.max(0, days(inception, effective)));
  const daysLeft = totalDays - daysInForce;

  const reasonCode = input.reason || (await getSetting('endorsements.default_cancellation_reason', 'INSURED_REQUEST'));
  const reason = (await activeRecord(db, 'cancellation-reason', reasonCode)) || { code: reasonCode, name: reasonCode, initiatedBy: 'insured', method: 'auto' };
  const initiatedBy = reason.initiatedBy === 'insurer' ? 'insurer' : 'insured';
  const type = String(input.cancellationType || 'FULL').toUpperCase();
  let method = input.method && input.method !== 'auto' ? input.method : null;
  if (method && !METHODS.includes(method)) throw badRequest('Validation failed', [{ path: 'method', message: `method must be one of ${METHODS.join(', ')}` }]);
  if (method === 'manual' && !(await getSetting('endorsements.cancellation_allow_manual', false))) {
    throw badRequest('Validation failed', [{ path: 'method', message: 'A return premium entered by hand is not allowed (endorsements.cancellation_allow_manual)' }]);
  }
  if (!method && reason.method && reason.method !== 'auto') method = reason.method;
  if (!method && type.startsWith('PRO_RATA')) method = 'pro-rata';
  if (!method) {
    if (daysInForce === 0) method = 'flat';
    else if (initiatedBy === 'insured' && (await getSetting('endorsements.short_period_for_insured', true)) !== false) method = 'short-period';
    else method = 'pro-rata';
  }

  const doc = policy.doc || {};
  const policyNet = round2(num(policy.net_premium) || num(doc.netPremium) || num(policy.details?.netPremium));
  // A policy whose premium is only the CTPL tariff has no net premium: the Insurance Commission tariff carries its
  // taxes and the authentication fee inside, so the return is computed on the tariff amount and adds no premium tax.
  const policyGross = round2(num(policy.premium_total) || num(doc.grossPremium) || num(policy.details?.grossPremium));
  const tariffOnly = !(policyNet > 0) && policyGross > 0;
  if (!(policyNet > 0) && !tariffOnly) throw conflict(`Policy ${policy.policy_number} has no net premium to compute a return on`);
  const policyBase = tariffOnly ? policyGross : policyNet;
  const partial = isPartialCancellation(type);
  let base = policyBase;
  if (partial) {
    if (num(input.partialPremium) > 0) base = round2(Math.min(num(input.partialPremium), policyBase));
    else if (num(input.partialPercent) > 0 && num(input.partialPercent) <= 100) base = round2((policyBase * num(input.partialPercent)) / 100);
    else throw badRequest('Validation failed', [{ path: 'partialPremium', message: 'A partial cancellation needs the net premium (partialPremium) or the percentage (partialPercent) of the part cancelled' }]);
  }

  let factor;
  let explanation;
  let band = null;
  if (method === 'flat') {
    factor = 1;
    explanation = 'Flat cancellation: the whole premium is returned';
  } else if (method === 'pro-rata') {
    factor = daysLeft / totalDays;
    explanation = `Pro-rata: ${daysLeft} of ${totalDays} days left`;
  } else if (method === 'short-period') {
    const sp = shortPeriodRetained(await shortPeriodScale(db), daysInForce, totalDays);
    band = sp.band;
    factor = Math.max(0, 1 - sp.retainedPercent / 100);
    explanation = `Short-period scale: in force ${daysInForce} days${sp.annualDays !== daysInForce ? ` (${sp.annualDays} on an annual basis)` : ''}; the insurer keeps ${sp.retainedPercent}%${band ? ` (${band.description})` : ''}`;
  } else {
    factor = null;
    explanation = 'Return premium entered by hand';
  }
  const returnNet = factor === null ? round2(Math.min(Math.abs(num(input.returnPremium)), base)) : round2(base * factor);
  if (factor === null && !(returnNet > 0)) throw badRequest('Validation failed', [{ path: 'returnPremium', message: 'Enter the net return premium' }]);

  const returned = (await getSetting('endorsements.cancellation_returned_taxes', { vat: true, dst: false, lgt: true, fst: false, other: false })) || {};
  const ch = returnNet > 0 && !tariffOnly ? await quotationCharges({ productId: policy.product_id || null, lguCode: doc.lguCode || null, lguCity: doc.lguCity || null,
    premiumTaxRegime: doc.premiumTaxRegime || null }, returnNet, policy.lob || policy.product_line, db) : null;
  if (tariffOnly) explanation += '; CTPL tariff policy: returned on the tariff amount, which includes its taxes';
  const tax = (k, key) => (ch && returned[k] ? round2(num(ch.tax[key])) : 0);
  const taxes = { vat: tax('vat', 'valueAddedTax'), dst: tax('dst', 'documentaryStampTax'), lgt: tax('lgt', 'localGovernmentTax'), fst: tax('fst', 'fireServiceTax'),
    other: ch && returned.other ? round2(num(ch.others)) : 0 };
  const grossReturn = round2(returnNet + taxes.vat + taxes.dst + taxes.lgt + taxes.fst + taxes.other);

  const booked = num(policy.commission_amount) > 0 && policyBase > 0 ? num(policy.commission_amount) / policyBase : null;
  const rate = booked ?? (await resolveCommissionRate({ insurerId: policy.insurance_company_id, productId: policy.product_id, lob: policy.lob, date: inception, db })).rate;
  const commission = round2(Math.min(returnNet * (rate || 0), returnNet));
  const basis = policy.id ? await policyBasis(db, policy) : 'net';
  const ctax = basis === 'gross' ? commissionTaxes(0) : commissionTaxes(commission, ratesOf(await commissionTaxSetup(db)));
  const insurerReturn = basis === 'gross' ? grossReturn : round2(grossReturn - commission - ctax.commission_vat + ctax.commission_ewt);
  return {
    policyId: policy.id, policyNumber: policy.policy_number, inceptionDate: inception, expiryDate: expiry, effectiveDate: effective < inception ? inception : effective,
    totalDays, daysInForce, daysLeft, reason: { code: reason.code, name: reason.name, initiatedBy }, method, cancellationType: partial ? type : 'FULL', partial,
    policyNetPremium: policyBase, tariffOnly, basePremium: base, factor: factor === null ? null : Math.round(factor * 1e6) / 1e6, shortPeriodBand: band,
    returnNetPremium: returnNet, taxes, grossReturn, commissionRate: Math.round((rate || 0) * 1e6) / 1e6, commissionReversed: commission,
    retainedNetPremium: round2(base - returnNet), remittanceBasis: basis, insurerReturn, explanation,
  };
}

/** The premium change of the endorsement (negative figures): what completeEndorsement books through returnPremium. */
export const premiumChangeOf = (calc) => ({
  changed: true, method: calc.method,
  delta: { grossPremium: -calc.grossReturn, netPremium: -calc.returnNetPremium, valueAddedTax: -calc.taxes.vat, documentaryStampTax: -calc.taxes.dst,
    localGovernmentTax: -calc.taxes.lgt, commission: -calc.commissionReversed },
});

/**
 * Terms of a cancellation endorsement being created: computed when endorsements.compute_cancellation_return is on or a
 * method is given; null (the amount sent by the screen is kept) otherwise.
 */
export async function cancellationTerms(db, policy, body) {
  const compute = (await getSetting('endorsements.compute_cancellation_return', true)) !== false;
  if (!compute && !body.cancellationMethod) return null;
  return computeReturn(db, policy, { effectiveDate: body.effectiveDate, reason: body.cancellationReason, method: body.cancellationMethod, cancellationType: body.cancellationType,
    partialPremium: body.partialPremium, partialPercent: body.partialPercent, returnPremium: body.returnPremium });
}
