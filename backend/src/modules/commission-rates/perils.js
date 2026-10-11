/**
 * Perils of a Motor policy as the commission rules register rates them (TIS-BRD-PROD-16, COMM-06; FRS FR-CMR-002).
 *
 * Own Damage / Theft and Acts of Nature are rated on the sum insured with three rates: the issuing rate the client
 * pays, the TIS remitting rate at which an external agent, a TFS team member or a referral remits to TISPH, and the
 * insurer net rate TISPH remits to the insurer. Bodily Injury, Property Damage and Auto Passenger Personal Accident
 * earn a commission % of their premium. Roadside Assistance earns nothing by default; CTPL never earns commission and
 * is remitted in full. Each peril reads its sum insured, premium and rate from the quotation fields of the policy.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';

export const PERIL_BASES = ['issuing-remitting', 'premium-pct', 'none'];
export const RATE_BASES = ['net-premium', 'issuing-remitting'];

export const PERILS = Object.freeze([
  { code: 'OD', name: 'Own Damage / Theft', siField: 'lossAndDamageCoverage', premiumField: 'lossAndDamageCoveragePremium', rateField: 'lossAndDamageCoverageRate', promoRate: 'promoOdRate', promoRemit: 'promoRemitOdRate' },
  { code: 'AON', name: 'Acts of Nature', siField: 'lossAndDamageCoverage', premiumField: 'actsOfNaturePremium', rateField: 'actsOfNatureRate', promoRate: 'promoAonRate', promoRemit: 'promoRemitAonRate' },
  { code: 'BI', name: 'Bodily Injury', siField: 'bodilyInjury', premiumField: 'bodilyInjuryCoveragePremium' },
  { code: 'PD', name: 'Property Damage', siField: 'propertyDamage', premiumField: 'propertyDamageCoveragePremium' },
  { code: 'APPA', name: 'Auto Passenger Personal Accident', siField: 'APPAtotalCoverage', premiumField: 'APPAcoveragePremium' },
  { code: 'RSA', name: 'Roadside Assistance', premiumField: 'roadsideAssistancePremium' },
]);
/** Covers remitted in full with the premium taxes: never on the Peril rates tab. */
export const FULL_REMIT_PERILS = Object.freeze([{ code: 'CTPL', name: 'CTPL', premiumField: 'ctplCoveragePremium' }]);

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const inRange = (v) => v !== null && Number.isFinite(v) && v >= 0 && v <= 100;
const fourDecimals = (v) => Math.round(v * 10000) / 10000;

/** The default peril rows of a new issuing-vs-remitting rule (commission.peril_defaults, default_tis_remitting_rates). */
export async function defaultPerilRates() {
  const bases = (await getSetting('commission.peril_defaults', {})) || {};
  const tis = (await getSetting('commission.default_tis_remitting_rates', { OD: 1.7, AON: 0.4 })) || {};
  const pct = Number(await getSetting('commission.default_peril_commission_pct', 25)) || 0;
  return PERILS.map((p) => {
    const basis = PERIL_BASES.includes(bases[p.code]) ? bases[p.code] : 'none';
    return { peril: p.code, name: p.name, basis, issuing: null, tisRemitting: basis === 'issuing-remitting' ? num(tis[p.code]) : null, insurerNet: null,
      commissionPct: basis === 'premium-pct' ? pct : null };
  });
}

/**
 * Check and normalise the peril rates of a rule (rates in % with up to 4 decimals; insurer net <= TIS remitting <=
 * issuing). Returns { rows, warnings } or throws 400 with one error per peril (MSG-CMR-009 to 014).
 */
export async function cleanPerilRates(input, { tisDefaults = null } = {}) {
  const tis = tisDefaults || (await getSetting('commission.default_tis_remitting_rates', { OD: 1.7, AON: 0.4 })) || {};
  const given = new Map((Array.isArray(input) ? input : []).map((r) => [String(r.peril || r.code || '').toUpperCase(), r]));
  const errors = [];
  const warnings = [];
  const rows = [];
  for (const p of PERILS) {
    const r = given.get(p.code) || {};
    const basis = PERIL_BASES.includes(r.basis) ? r.basis : 'none';
    const row = { peril: p.code, name: p.name, basis, issuing: null, tisRemitting: null, insurerNet: null, commissionPct: null };
    if (basis === 'issuing-remitting') {
      const issuing = num(r.issuing);
      const tisRemitting = num(r.tisRemitting) ?? num(tis[p.code]);
      const insurerNet = num(r.insurerNet);
      for (const [path, v] of [['issuing', issuing], ['tisRemitting', tisRemitting], ['insurerNet', insurerNet]]) {
        if (v !== null && !inRange(v)) errors.push({ path: `perilRates.${p.code}.${path}`, message: 'Enter a rate from 0 to 100 with up to 4 decimals' });
      }
      if (insurerNet === null) errors.push({ path: `perilRates.${p.code}.insurerNet`, message: `Enter the insurer net rate of ${p.name}` });
      if (tisRemitting === null) errors.push({ path: `perilRates.${p.code}.tisRemitting`, message: `Enter the TIS remitting rate of ${p.name}` });
      if (insurerNet !== null && tisRemitting !== null && (insurerNet > tisRemitting || (issuing !== null && tisRemitting > issuing))) {
        errors.push({ path: `perilRates.${p.code}`, message: `${p.name}: the rates must be insurer net <= TIS remitting <= issuing` });
      }
      if (issuing !== null && insurerNet !== null && issuing === insurerNet) warnings.push(`${p.name}: issuing and insurer net rates are equal, so TISPH earns no commission on this peril`);
      Object.assign(row, { issuing: issuing === null ? null : fourDecimals(issuing), tisRemitting: tisRemitting === null ? null : fourDecimals(tisRemitting),
        insurerNet: insurerNet === null ? null : fourDecimals(insurerNet) });
    } else if (basis === 'premium-pct') {
      const pct = num(r.commissionPct);
      if (!inRange(pct)) errors.push({ path: `perilRates.${p.code}.commissionPct`, message: 'Enter a commission from 0 to 100%' });
      else row.commissionPct = fourDecimals(pct);
    }
    rows.push(row);
  }
  if (errors.length) throw badRequest(errors[0].message, errors);
  return { rows, warnings };
}

/** The commission % and the variance (points) of an issuing-vs-remitting peril row, for the screen. */
export const perilDerived = (row) => (row.basis === 'issuing-remitting' && row.issuing !== null && row.issuing !== undefined
  ? { commissionPct: fourDecimals(Number(row.issuing) - Number(row.insurerNet ?? 0)), variance: fourDecimals(Number(row.issuing) - Number(row.tisRemitting ?? 0)) }
  : { commissionPct: row.basis === 'premium-pct' ? row.commissionPct : null, variance: null });

/** Whether a line of business (or product line) is rated per peril: commission.dual_rate_lines (default motor). */
export async function isDualRateLine(line) {
  const lines = ((await getSetting('commission.dual_rate_lines', ['motor'])) || []).map((x) => String(x).toLowerCase());
  return !!line && lines.includes(String(line).toLowerCase());
}
