/**
 * Server-side premium calculation mirroring the quote wizard (agentModule/quoteModule/utils/premiumCalculations.js):
 * cover premium = sum insured x rate / 100; for motor, CTPL is the fixed tariff amount of the vehicle class (inclusive of
 * taxes and fees, added to the gross outside the taxable net premium) and Auto
 * Passenger PA is limit per person x seats x rate (motorTariff.js); flat BI / PD premiums come from the coverages master
 * when an id is given; net premium = sum of cover premiums (Fire / IAR use the premium details they send);
 * taxes (VAT, DST, LGT, FST) use app_settings rates and the per-LOB tax set; gross = net + taxes + others - discount.
 */
import { one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { num, round2, lobOf } from '../documents/common.js';
import { motorFixedCovers } from './motorTariff.js';
import { resolveCommissionRate } from '../commission-rates/resolve.js';

const RATE_COVERS = [
  // [premium field, sum-insured field, rate field, default-rate key]
  ['lossAndDamageCoveragePremium', 'lossAndDamageCoverage', 'lossAndDamageCoverageRate'],
  ['actsOfNaturePremium', 'lossAndDamageCoverage', 'actsOfNatureRate'],
  ['roadsideAssistancePremium', 'lossAndDamageCoverage', 'roadsideAssistanceRate'],
  ['personalAccidentCoverPremium', 'lossAndDamageCoverage', 'personalAccidentCoverRate'],
  ['bodilyInjuryCoveragePremium', 'bodilyInjury', 'bodilyInjuryRate', 'bodilyInjuryRate'],
  ['propertyDamageCoveragePremium', 'propertyDamage', 'propertyDamageRate', 'propertyDamageRate'],
];
const MASTER_COVERS = [['biCoverageId', 'bodilyInjuryCoveragePremium', 'bodilyInjury'], ['pdCoverageId', 'propertyDamageCoveragePremium', 'propertyDamage']];

/** Cover premiums: computed from rates where a rate is given, from the coverages master for ids, else as sent. */
async function coverPremiums(v) {
  const defaults = await getSetting('premium.default_rates', {});
  const out = {};
  const amounts = {};
  for (const [field, siField, rateField, defKey] of RATE_COVERS) {
    const si = num(v[siField]);
    const rate = v[rateField] !== undefined && v[rateField] !== '' ? num(v[rateField]) : (defKey && v[field] === undefined ? num(defaults[defKey]) : null);
    out[field] = rate !== null && si > 0 ? round2((si * rate) / 100) : round2(num(v[field]));
  }
  for (const [idField, premiumField, siField] of MASTER_COVERS) {
    if (!v[idField]) continue;
    const c = await one('SELECT amount, premium FROM coverages WHERE id = $1', [Number(v[idField])]);
    if (c) { out[premiumField] = c.premium; if (!num(v[siField])) amounts[siField] = c.amount; }
  }
  return { premiums: out, amounts };
}

/** Tax rates and which taxes apply to the LOB (premium.taxes_by_lob in app_settings). */
export async function taxRates(lob) {
  const byLob = await getSetting('premium.taxes_by_lob', {});
  const apply = byLob[lob] || byLob.DEFAULT || ['vat', 'dst', 'lgt'];
  const rate = async (k) => (apply.includes(k) ? Number(await getSetting(`tax.${k}_rate`, 0)) : 0);
  return { valueAddedTax: await rate('vat'), documentaryStampTax: await rate('dst'), localGovernmentTax: await rate('lgt'), fireServiceTax: await rate('fst') };
}

/**
 * Commission rate: explicit on the quote, else the brokerage % of the commission rule chosen on the order summary
 * (commissionDetails.brokeragePct, the rate the commission lines use), else the Commission Rate Matrix, the insurer's
 * rate, else commission.default_rate (resolveCommissionRate).
 */
async function commissionRate(v, insurerId, lob) {
  if (v.commissionRate !== undefined && v.commissionRate !== '') { const r = num(v.commissionRate); return r > 1 ? r / 100 : r; }
  const brokerage = num(v.commissionDetails?.brokeragePct);
  if (brokerage > 0) return brokerage / 100;
  return (await resolveCommissionRate({ insurerId, productId: v.productId, lob, policyType: v.isRenewal === true ? 'renewal' : 'new' })).rate;
}

/**
 * Full breakdown for a quotation document (numbers rounded to 2 decimals). `keep` holds motor fixed covers to carry
 * over unchanged (an endorsement keeps the CTPL and APPA premiums the policy was issued with).
 */
export async function premiumBreakdown(v, { insurerId = null, keep = null } = {}) {
  const lob = lobOf(v.lob, v.productType, v.insurancePolicyType);
  const { premiums: covers, amounts } = await coverPremiums(v);
  let motor = {};
  if (lob === 'MOTOR') {
    motor = await motorFixedCovers(keep ? { ...v, includeCTPL: false, autoPassengerPersonalAccident: keep.APPAcoveragePremium === undefined ? v.autoPassengerPersonalAccident : '' } : v);
    if (keep) motor = { ...motor, ...keep };
    covers.ctplCoveragePremium = round2(num(motor.ctplCoveragePremium));
    covers.APPAcoveragePremium = round2(num(motor.APPAcoveragePremium));
    amounts.APPAtotalCoverage = num(motor.APPAtotalCoverage);
  }
  // CTPL is the Insurance Commission tariff amount, already inclusive of taxes and the authentication fee: it is added to
  // the gross premium as it is, outside the net premium that VAT / DST / LGT and commission are computed on.
  const ctpl = round2(num(covers.ctplCoveragePremium));
  let net = Object.entries(covers).reduce((s, [k, x]) => (k === 'ctplCoveragePremium' ? s : s + num(x)), 0);
  if (lob !== 'MOTOR') {
    const fire = v.firePremiumDetails || v.iarPremiumDetails || {};
    net = num(fire.totalCoverPremium ?? fire.netPremium ?? fire.basicPremium) || net;
  }
  if (!net) net = num(v.netPremium);
  // premium agreed with the insurer (a broker slip offer or a placement slip) replaces the computed cover premiums
  if (num(v.agreedNetPremium) > 0) net = num(v.agreedNetPremium);
  const ncdPct = num(v.ncdPercent);
  const ncd = ncdPct ? round2((net * ncdPct) / 100) : num(v.NCD);
  net = round2(net - (ncdPct ? ncd : 0));
  const rates = await taxRates(lob);
  const tax = Object.fromEntries(Object.entries(rates).map(([k, r]) => [k, round2(net * r)]));
  const others = round2(num(v.accountPremiumOthers));
  // CTPL is the tariff amount and is never discounted: a discount reduces at most the rest of the premium
  const discountable = round2(net + tax.valueAddedTax + tax.documentaryStampTax + tax.localGovernmentTax + tax.fireServiceTax + others);
  const discount = Math.min(Math.max(0, round2(num(v.discount))), Math.max(0, discountable));
  const gross = Math.max(0, round2(net + tax.valueAddedTax + tax.documentaryStampTax + tax.localGovernmentTax + tax.fireServiceTax + ctpl + others - discount));
  const si = (k) => (k in amounts ? num(amounts[k]) : num(v[k]));
  const sumInsured = round2(num(v.totalSumInsured) || si('lossAndDamageCoverage') + si('bodilyInjury') + si('propertyDamage') + si('APPAtotalCoverage')
    || num((v.fireRiskDetails || {}).totalSumInsured));
  const cRate = await commissionRate(v, insurerId, lob);
  return {
    lob, ...covers, ...(lob === 'MOTOR' ? { vehicleType: motor.vehicleType, ctplCoverageRate: motor.ctplCoverageRate, ctplTermYears: motor.ctplTermYears ?? null, appaSeats: motor.appaSeats ?? null,
      APPAtotalCoverage: amounts.APPAtotalCoverage, APPARate: motor.APPARate ?? null } : {}), netPremium: net, ...tax, accountPremiumOthers: others, discount, NCD: ncd, grossPremium: gross,
    totalSumInsured: sumInsured, taxRates: rates, commissionRate: cRate, commissionAmount: round2(net * cRate),
    currency: await getSetting('currency.default', 'PHP'),
  };
}
