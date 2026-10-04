/**
 * Server-side premium calculation mirroring the quote wizard (agentModule/quoteModule/utils/premiumCalculations.js):
 * cover premium = sum insured x rate / 100; for motor, CTPL is the fixed tariff amount of the vehicle class (inclusive of
 * taxes and fees, added to the gross outside the taxable net premium) and Auto
 * Passenger PA is limit per person x seats x rate (motorTariff.js); flat BI / PD premiums come from the coverages master
 * when an id is given; net premium = sum of cover premiums (Fire / IAR use the premium details they send);
 * taxes (VAT, DST, LGT, FST, premium tax, other charges) come from the premium tax and charge engine (Master > Premium
 * Taxes & LGU Rates, premium-charges/service.js#chargesFor); gross = net + taxes + others - discount.
 *
 * Covers of the product: the governing template's Coverage Builder lists the covers offered (mandatory and optional)
 * and the quotation premium each is priced on ("Priced on quotation as"). A quotation that sends selectedCovers (cover
 * codes, as the quote wizard does) is priced on the covers chosen: a mandatory cover is always included, and a
 * premium whose covers are all left out is zero (CTPL not included, Auto Passenger PA without a limit). The breakdown
 * lists the covers with what each is priced at (coverSelection). Without selectedCovers the premiums are as sent.
 */
import { one } from '../../db/pool.js';
import { baseCurrency } from '../../lib/currency.js';
import { getSetting } from '../../lib/settings.js';
import { num, round2, lobOf } from '../documents/common.js';
import { motorFixedCovers } from './motorTariff.js';
import { resolveCommissionRate } from '../commission-rates/resolve.js';
import { quotationCharges } from '../premium-charges/service.js';
import { evaluate, adjustNet, governingTemplate, templateCovers } from '../product-configurator/underwriting.js';
import { badRequest } from '../../lib/errors.js';

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

/** Sum-insured field of a cover premium: zeroed with the premium when the cover is left out. */
const SI_OF_PREMIUM = { lossAndDamageCoveragePremium: 'lossAndDamageCoverage', bodilyInjuryCoveragePremium: 'bodilyInjury', propertyDamageCoveragePremium: 'propertyDamage',
  APPAcoveragePremium: 'APPAtotalCoverage' };

/**
 * Covers of the governing template and the quotation's choice: { templateCode, rows: [{ code, name, type, quoteField,
 * selected }], removed: Set of premium fields left out, included: Set of premium fields chosen, explicit }; null when
 * no template governs or it has no covers.
 */
export async function coverChoice(v, lob) {
  const t = await governingTemplate({ templateCode: v.productTemplateCode || v.templateCode || null, productId: v.productId || null, lob });
  if (!t) return null;
  const covers = await templateCovers(t.id);
  if (!covers.length) return null;
  const explicit = Array.isArray(v.selectedCovers);
  const chosen = new Set((explicit ? v.selectedCovers : []).map((c) => String(c).toUpperCase()));
  if (explicit) {
    const unknown = [...chosen].filter((c) => !covers.some((x) => x.code.toUpperCase() === c));
    if (unknown.length) {
      throw badRequest(`Cover(s) ${unknown.join(', ')} are not covers of product template ${t.template_code}`,
        [{ path: 'selectedCovers', message: `Not covers of ${t.template_code}: ${unknown.join(', ')}` }]);
    }
  }
  const rows = covers.map((c) => ({ ...c, selected: c.type === 'Mandatory' || (explicit ? chosen.has(c.code.toUpperCase()) : null) }));
  const fields = [...new Set(rows.map((r) => r.quoteField).filter(Boolean))];
  const removed = new Set(explicit ? fields.filter((f) => rows.filter((r) => r.quoteField === f).every((r) => !r.selected)) : []);
  const included = new Set(explicit ? fields.filter((f) => !removed.has(f)) : []);
  return { templateCode: t.template_code, templateName: t.name, rows, removed, included, explicit };
}

/** The quotation document as priced on the covers chosen (CTPL and Auto Passenger PA follow their covers). */
function onChosenCovers(v, choice) {
  if (!choice?.explicit) return v;
  const out = { ...v };
  if (choice.removed.has('ctplCoveragePremium')) out.includeCTPL = false;
  else if (choice.included.has('ctplCoveragePremium')) out.includeCTPL = true;
  if (choice.removed.has('APPAcoveragePremium')) out.autoPassengerPersonalAccident = '';
  return out;
}

/**
 * Effective tax rates (fractions) of a line of business from the charge engine, priced on a nominal premium:
 * { valueAddedTax, documentaryStampTax, localGovernmentTax, fireServiceTax }. For screens and callers that need rates
 * rather than amounts; amounts are always computed with chargesFor() on the actual premium.
 */
export async function taxRates(lob, { productId = null } = {}) {
  const NOMINAL = 1000000;
  const c = await quotationCharges({ productId }, NOMINAL, lob);
  return Object.fromEntries(Object.entries(c.tax).map(([k, x]) => [k, Math.round((x / NOMINAL) * 1e6) / 1e6]));
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
export async function premiumBreakdown(v, { insurerId = null, keep = null, underwriting = true } = {}) {
  const lob = lobOf(v.lob, v.productType, v.insurancePolicyType);
  // covers of the product (Coverage Builder of the governing template) and the ones the quotation chose
  const choice = keep ? null : await coverChoice(v, lob);
  const priced = onChosenCovers(v, choice);
  const { premiums: covers, amounts } = await coverPremiums(priced);
  let motor = {};
  if (lob === 'MOTOR') {
    motor = await motorFixedCovers(keep ? { ...v, includeCTPL: false, autoPassengerPersonalAccident: keep.APPAcoveragePremium === undefined ? v.autoPassengerPersonalAccident : '' } : priced);
    if (keep) motor = { ...motor, ...keep };
    covers.ctplCoveragePremium = round2(num(motor.ctplCoveragePremium));
    covers.APPAcoveragePremium = round2(num(motor.APPAcoveragePremium));
    amounts.APPAtotalCoverage = num(motor.APPAtotalCoverage);
  }
  for (const f of choice?.removed || []) {
    if (f in covers || lob === 'MOTOR') covers[f] = 0;
    if (SI_OF_PREMIUM[f]) amounts[SI_OF_PREMIUM[f]] = 0;
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
  // Product Configurator: acceptance rules and rating factors of the governing template. Rating factors and loadings
  // adjust a premium the broker computed; an agreed insurer premium or an endorsement's kept premium is taken as it is.
  const uw = underwriting && !keep ? await evaluate(v, { insurerId, productId: v.productId || null, lob }) : null;
  const adj = uw && !(num(v.agreedNetPremium) > 0) ? adjustNet(round2(net), uw) : { net, ratingAdjustment: 0, loadingAmount: 0 };
  net = adj.net;
  const ncdPct = num(v.ncdPercent);
  const ncd = ncdPct ? round2((net * ncdPct) / 100) : num(v.NCD);
  net = round2(net - (ncdPct ? ncd : 0));
  // Premium tax and charge engine (premium-charges module): VAT by the product's tax regime, DST, FST on fire / property
  // lines, LGT at the LGU rate of the location (else the LGT rule rate), premium tax and other charges.
  const c = await quotationCharges(v, net, lob);
  const tax = c.tax;
  const others = round2(round2(num(v.accountPremiumOthers)) + c.others);
  const charges = c.charges;
  const rates = net ? Object.fromEntries(Object.entries(tax).map(([k, x]) => [k, Math.round((x / net) * 1e6) / 1e6])) : await taxRates(lob, { productId: v.productId || null });
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
    totalSumInsured: sumInsured, taxRates: rates, commissionRate: cRate, commissionAmount: round2(net * cRate), charges,
    ratingAdjustment: adj.ratingAdjustment, underwritingLoading: adj.loadingAmount,
    underwriting: uw ? { templateCode: uw.templateCode, templateName: uw.templateName, decision: uw.decision, results: uw.results, referredRules: uw.referredRules,
      declinedRules: uw.declinedRules, loadingPercent: uw.loadingPercent, factors: uw.factors, facts: uw.facts } : null,
    coverSelection: choice ? { templateCode: choice.templateCode, templateName: choice.templateName, explicit: choice.explicit,
      covers: choice.rows.map((r) => {
        const premium = r.quoteField ? round2(num(covers[r.quoteField])) : null;
        return { code: r.code, name: r.name, type: r.type, quoteField: r.quoteField, deductible: r.deductible,
          selected: r.selected === null ? r.type === 'Mandatory' || (premium || 0) > 0 : r.selected, premium };
      }) } : null,
    currency: await baseCurrency(),
  };
}
