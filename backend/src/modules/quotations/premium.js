/**
 * Server-side premium calculation mirroring the quote wizard (agentModule/quoteModule/utils/premiumCalculations.js):
 * cover premium = sum insured x rate / 100 (CTPL is a flat amount); flat BI / PD / PA premiums come from the coverages
 * master when an id is given; net premium = sum of cover premiums (Fire / IAR use the premium details they send);
 * taxes (VAT, DST, LGT, FST) use app_settings rates and the per-LOB tax set; gross = net + taxes + others - discount.
 */
import { one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { num, round2, lobOf } from '../documents/common.js';

const RATE_COVERS = [
  // [premium field, sum-insured field, rate field, default-rate key]
  ['lossAndDamageCoveragePremium', 'lossAndDamageCoverage', 'lossAndDamageCoverageRate'],
  ['actsOfNaturePremium', 'lossAndDamageCoverage', 'actsOfNatureRate'],
  ['roadsideAssistancePremium', 'lossAndDamageCoverage', 'roadsideAssistanceRate'],
  ['personalAccidentCoverPremium', 'lossAndDamageCoverage', 'personalAccidentCoverRate'],
  ['bodilyInjuryCoveragePremium', 'bodilyInjury', 'bodilyInjuryRate', 'bodilyInjuryRate'],
  ['propertyDamageCoveragePremium', 'propertyDamage', 'propertyDamageRate', 'propertyDamageRate'],
  ['APPAcoveragePremium', 'APPAtotalCoverage', 'APPARate', 'APPARate'],
];
const MASTER_COVERS = [['biCoverageId', 'bodilyInjuryCoveragePremium', 'bodilyInjury'], ['pdCoverageId', 'propertyDamageCoveragePremium', 'propertyDamage'], ['paCoverageId', 'APPAcoveragePremium', 'APPAtotalCoverage']];

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
  out.ctplCoveragePremium = round2(num(v.ctplCoverageRate ?? v.ctplCoveragePremium));
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

/** Commission rate: explicit on the quote, else the insurer's rate, else commission.default_rate. */
async function commissionRate(v, insurerId) {
  if (v.commissionRate !== undefined && v.commissionRate !== '') { const r = num(v.commissionRate); return r > 1 ? r / 100 : r; }
  if (insurerId) {
    const ic = await one('SELECT commission_rate FROM insurance_companies WHERE id = $1', [insurerId]);
    if (ic?.commission_rate != null) return Number(ic.commission_rate);
  }
  return Number(await getSetting('commission.default_rate', 0));
}

/** Full breakdown for a quotation document (numbers rounded to 2 decimals). */
export async function premiumBreakdown(v, { insurerId = null } = {}) {
  const lob = lobOf(v.lob, v.productType, v.insurancePolicyType);
  const { premiums: covers, amounts } = await coverPremiums(v);
  let net = Object.values(covers).reduce((s, x) => s + num(x), 0);
  if (lob !== 'MOTOR') {
    const fire = v.firePremiumDetails || v.iarPremiumDetails || {};
    net = num(fire.totalCoverPremium ?? fire.netPremium ?? fire.basicPremium) || net;
  }
  if (!net) net = num(v.netPremium);
  const ncdPct = num(v.ncdPercent);
  const ncd = ncdPct ? round2((net * ncdPct) / 100) : num(v.NCD);
  net = round2(net - (ncdPct ? ncd : 0));
  const rates = await taxRates(lob);
  const tax = Object.fromEntries(Object.entries(rates).map(([k, r]) => [k, round2(net * r)]));
  const others = round2(num(v.accountPremiumOthers));
  const discount = round2(num(v.discount));
  const gross = Math.max(0, round2(net + tax.valueAddedTax + tax.documentaryStampTax + tax.localGovernmentTax + tax.fireServiceTax + others - discount));
  const si = (k) => num(v[k]) || num(amounts[k]);
  const sumInsured = round2(num(v.totalSumInsured) || si('lossAndDamageCoverage') + si('bodilyInjury') + si('propertyDamage') + si('APPAtotalCoverage')
    || num((v.fireRiskDetails || {}).totalSumInsured));
  const cRate = await commissionRate(v, insurerId);
  return {
    lob, ...covers, netPremium: net, ...tax, accountPremiumOthers: others, discount, NCD: ncd, grossPremium: gross,
    totalSumInsured: sumInsured, taxRates: rates, commissionRate: cRate, commissionAmount: round2(net * cRate),
    currency: await getSetting('currency.default', 'PHP'),
  };
}
