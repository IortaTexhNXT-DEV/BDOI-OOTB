/**
 * Scheme rating (TIS-BRD-SCHM-02, FRS FR-SCM-020 to 023, 030, 031): the server routine that prices a scheme policy for a
 * policy year from a scheme version, next to the premium engine of Create Quote.
 *
 *   findSchemeAndLine   the version of a scheme in force on the inception date (by Scheme No., or by scheme type with a
 *                       scheme naming the dealer before an All dealers scheme), the dealer and insurer checks and the
 *                       most specific vehicle line (variant, then model, then All models) with the sum insured range
 *   priceYear           every included peril at the line or peril rate for the sum insured of the year (year-1 sum
 *                       insured x the schedule % of the year), CTPL from the tariff (the 3-year CTPL of a brand-new
 *                       vehicle in year 1 with schemes.year1_three_year_ctpl, nothing in the years it covers), taxes from
 *                       the premium tax and charge engine (premiumBreakdown, so a scheme premium and a Create Quote
 *                       premium at the same rates are the same to the centavo), the commission at the scheme
 *                       Commission % of the NET Premium and the dealer share at the Dealer commission % of it
 *   previewPremiums     years 1 to the term for a sample vehicle (Premium preview, nothing saved)
 *   renewalYear         the next policy year of a scheme policy within its term, on the version kept on the policy
 */
import { one, query } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { premiumBreakdown } from '../quotations/premium.js';
import { motorTariff, vehicleClass } from '../quotations/motorTariff.js';
import { PERILS, TYPE_LABELS, resolveVehicle, vehicleLabel } from './service.js';

const LINE_SELECT = `SELECT l.*, b.name AS brand_name, m.name AS model_name, v.name AS variant_name FROM scheme_vehicle_lines l JOIN vehicle_brands b ON b.id = l.brand_id
  LEFT JOIN vehicle_models m ON m.id = l.model_id LEFT JOIN vehicle_variants v ON v.id = l.variant_id`;
const dmy = (d) => String(d).slice(0, 10).split('-').reverse().join('/');
const peso = (v) => Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (v) => Number(v).toLocaleString('en-PH', { maximumFractionDigits: 2 });
const refuse = (path, message, code) => badRequest(message, [{ path, message, code }]);

/** Whether a scheme names the dealer: 2 its branch, 1 its group, 0 All dealers, -1 not a dealer of the scheme. */
async function dealerRank(db, s, dealerChannelId) {
  if (!dealerChannelId) return 0;
  if (s.all_dealers) return 0;
  const ids = s.dealer_channel_ids || [];
  if (ids.includes(dealerChannelId)) return 2;
  const parent = (await db.query('SELECT parent_id FROM distribution_channels WHERE id = $1', [dealerChannelId])).rows[0]?.parent_id;
  return parent && ids.includes(parent) ? 1 : -1;
}

/** The scheme versions in force on a date: Active (or Scheduled whose start has come before the job ran), in their period. */
async function inForce(db, where, params, on) {
  const now = await today();
  return (await db.query(`SELECT * FROM schemes s WHERE ${where} AND s.status IN ('active', 'scheduled') AND s.effective_from <= $${params.length + 1}::date
    AND s.effective_to >= $${params.length + 1}::date AND s.effective_from <= $${params.length + 2}::date ORDER BY s.version DESC`, [...params, on, now])).rows;
}

/**
 * Find the scheme version and vehicle line of a loan (FR-SCM-020). input: { schemeNo | schemeType | schemeId (preview),
 * dealerChannelId, insurerId, vehicle: { brandId|make, modelId|model, variantId|variant, yearModel }, sumInsured, inception }.
 * Returns { scheme, line, vehicle }; refuses with the reason (MSG-SCM-054 to 058) otherwise.
 */
export async function findSchemeAndLine(input, db = { query }) {
  const on = isoDate(input.inception) || await today();
  let scheme = null;
  if (input.schemeId) {
    scheme = (await db.query('SELECT * FROM schemes WHERE id = $1', [input.schemeId])).rows[0];
    if (!scheme) throw notFound('Scheme not found');
  } else if (input.schemeNo) {
    const no = String(input.schemeNo).trim().toUpperCase();
    scheme = (await inForce(db, 'upper(s.scheme_no) = $1', [no], on))[0] || null;
    if (!scheme) throw refuse('schemeNo', `Scheme ${no} is not in force on ${dmy(on)}`, 'MSG-SCM-054');
  } else if (input.schemeType) {
    const list = await inForce(db, 's.scheme_type = $1', [input.schemeType], on);
    const ranked = [];
    for (const s of list) ranked.push({ s, rank: await dealerRank(db, s, input.dealerChannelId) });
    const best = ranked.filter((x) => x.rank >= 0).sort((a, b) => b.rank - a.rank || b.s.version - a.s.version)[0];
    if (!best) throw refuse('schemeType', `No ${TYPE_LABELS[input.schemeType] || input.schemeType} scheme is in force on ${dmy(on)} for the dealer`, 'MSG-SCM-054');
    scheme = best.s;
  } else throw refuse('schemeNo', 'Scheme is required', 'MSG-SIS-001');
  if (!input.schemeId && input.dealerChannelId && (await dealerRank(db, scheme, input.dealerChannelId)) < 0) {
    const d = (await db.query('SELECT name FROM distribution_channels WHERE id = $1', [input.dealerChannelId])).rows[0];
    throw refuse('dealerChannelId', `${d?.name || 'The dealer'} is not a dealer of scheme ${scheme.scheme_no}`, 'MSG-SCM-055');
  }
  if (input.insurerId && !(scheme.insurer_ids || []).map(Number).includes(Number(input.insurerId))) {
    const ic = (await db.query('SELECT name FROM insurance_companies WHERE id = $1', [Number(input.insurerId)])).rows[0];
    throw refuse('insuranceCompanyId', `${ic?.name || 'The insurer'} is not an insurer of scheme ${scheme.scheme_no}`, 'MSG-SCM-056');
  }
  const v = input.vehicle || {};
  const year = Number(v.yearModel);
  const resolved = await resolveVehicle(db, { brandId: v.brandId, make: v.make, modelId: v.modelId, model: v.model, variantId: v.variantId, variant: v.variant });
  const label = [v.make || resolved.brand?.name, v.model || resolved.model?.name, v.variant || resolved.variant?.name].filter(Boolean).join(' ');
  if (resolved.error) throw refuse('vehicle', `${label} ${year || ''} is not covered by scheme ${scheme.scheme_no}`.replace(/\s+/g, ' '), 'MSG-SCM-057');
  const lines = (await db.query(`${LINE_SELECT} WHERE l.scheme_id = $1 AND l.brand_id = $2 AND (l.model_id IS NULL OR l.model_id = $3) AND (l.variant_id IS NULL OR l.variant_id = $4)
    AND $5::int BETWEEN l.year_from AND l.year_to ORDER BY (l.variant_id IS NOT NULL) DESC, (l.model_id IS NOT NULL) DESC, l.line_no`,
  [scheme.id, resolved.brand.id, resolved.model?.id || null, resolved.variant?.id || null, year || 0])).rows;
  const line = lines[0];
  if (!line) throw refuse('vehicle', `${label} ${year || ''} is not covered by scheme ${scheme.scheme_no}`.replace(/\s+/g, ' ').trim(), 'MSG-SCM-057');
  const si = num(input.sumInsured);
  if (si < num(line.si_from) || si > num(line.si_to)) {
    throw refuse('sumInsured', `The sum insured of ${peso(si)} is outside the range ${short(line.si_from)} - ${short(line.si_to)} of scheme ${scheme.scheme_no} for ${[resolved.brand.name, resolved.model?.name].filter(Boolean).join(' ')}`, 'MSG-SCM-058');
  }
  const seats = resolved.variant ? (await db.query('SELECT seating FROM vehicle_variants WHERE id = $1', [resolved.variant.id])).rows[0]?.seating : null;
  return { scheme, line, vehicle: { ...resolved, seats: Number(seats) || null, yearModel: year } };
}

/** The rates of a scheme version on a vehicle line: { OD, AON } at the line rate, else the peril rate, and the other perils. */
export function ratesOf(scheme, line) {
  const perils = Object.fromEntries((scheme.perils || []).map((p) => [p.code, p]));
  const pick = (code, lineRate) => (perils[code]?.included ? (lineRate !== null && lineRate !== undefined ? num(lineRate) : perils[code].rate === null ? null : num(perils[code].rate)) : null);
  return { OD: pick('OD', line?.od_rate), AON: pick('AON', line?.aon_rate), perils };
}

/**
 * Price one policy year of a scheme (FR-SCM-021). opts: { year (1..term), year1SumInsured, vehicleClass, seats,
 * insurerId, lguCode, lguCity, laterCtpl: true to price the annual CTPL of the years after the 3-year CTPL }.
 */
export async function priceYear(scheme, line, opts) {
  const year = Number(opts.year || 1);
  const schedule = scheme.si_schedule || [];
  const pct = year === 1 ? 100 : num(schedule[year - 1]);
  const si = round2((num(opts.year1SumInsured) * pct) / 100);
  const { OD, AON, perils } = ratesOf(scheme, line);
  for (const p of Object.values(perils)) {
    if (!p.included || p.basis === 'tariff') continue;
    const missing = ['si-pct', 'limit-seat-pct', 'limit-pct'].includes(p.basis) ? p.rate === null || p.rate === undefined : ['limit-premium', 'vehicle-premium'].includes(p.basis) ? p.premium === null || p.premium === undefined : false;
    if (missing) throw badRequest(`Scheme ${scheme.scheme_no} version ${scheme.version} has no rate for ${p.name}; the scheme must be amended`, [{ path: 'schemeId', message: `Scheme ${scheme.scheme_no} has no rate for ${p.name}`, code: 'MSG-SCM-059' }]);
  }
  const tariff = await motorTariff();
  const cls = vehicleClass(tariff, opts.vehicleClass || line?.vehicle_class);
  const threeYear = (await getSetting('schemes.year1_three_year_ctpl', true)) !== false && cls?.ctplPremium3Year !== null && cls?.ctplPremium3Year !== undefined;
  let ctpl = 0;
  let ctplYears = null;
  let ctplNote = null;
  if (perils.CTPL?.included !== false && cls) {
    if (year === 1) { ctpl = threeYear ? cls.ctplPremium3Year : cls.ctplPremium; ctplYears = threeYear ? 3 : 1; }
    else if (threeYear && year <= 3) ctplNote = 'covered';
    else if (opts.laterCtpl === false) ctplNote = 'at-renewal';
    else { ctpl = cls.ctplPremium; ctplYears = 1; }
  }
  const seats = num(opts.seats) || cls?.defaultSeats || 0;
  const appa = perils.APPA?.included ? round2((num(perils.APPA.limit) * seats * num(perils.APPA.rate)) / 100) : 0;
  const v = {
    productType: 'Motor', lob: 'MOTOR', productId: scheme.product_id || undefined, vehicleType: cls?.value || opts.vehicleClass || null, brandNew: true,
    lossAndDamageCoverage: si, lossAndDamageCoverageRate: OD ?? 0, actsOfNatureRate: AON ?? 0,
    bodilyInjury: perils.BI?.included ? num(perils.BI.limit) : 0, bodilyInjuryCoveragePremium: perils.BI?.included ? num(perils.BI.premium) : 0,
    propertyDamage: perils.PD?.included ? num(perils.PD.limit) : 0, propertyDamageCoveragePremium: perils.PD?.included ? num(perils.PD.premium) : 0,
    roadsideAssistancePremium: perils.RSA?.included ? num(perils.RSA.premium) : 0,
    personalAccidentCoverPremium: perils.PAD?.included ? round2((num(perils.PAD.limit) * num(perils.PAD.rate)) / 100) : 0,
    totalSumInsured: si, commissionRate: num(scheme.commission_pct), discount: 0,
    ...(opts.lguCode ? { lguCode: opts.lguCode } : {}), ...(opts.lguCity ? { lguCity: opts.lguCity } : {}),
  };
  const b = await premiumBreakdown(v, { insurerId: opts.insurerId || null,
    keep: { ctplCoveragePremium: ctpl, APPAcoveragePremium: appa, APPAtotalCoverage: perils.APPA?.included ? round2(num(perils.APPA.limit) * seats) : 0, ctplTermYears: ctplYears } });
  const commission = round2((num(b.netPremium) * num(scheme.commission_pct)) / 100);
  const dealerShare = round2((commission * num(scheme.dealer_commission_pct)) / 100);
  const premiumOf = (code) => ({ OD: b.lossAndDamageCoveragePremium, AON: b.actsOfNaturePremium, BI: b.bodilyInjuryCoveragePremium, PD: b.propertyDamageCoveragePremium,
    APPA: b.APPAcoveragePremium, RSA: b.roadsideAssistancePremium, PAD: b.personalAccidentCoverPremium, CTPL: b.ctplCoveragePremium }[code]);
  const lines = PERILS.filter((d) => perils[d.code]?.included).map((d) => ({ code: d.code, name: d.name, basis: d.basis,
    rate: d.code === 'OD' ? OD : d.code === 'AON' ? AON : perils[d.code].rate ?? null, limit: perils[d.code].limit ?? null, premium: round2(num(premiumOf(d.code))) }));
  return {
    year, sumInsured: si, sumInsuredPct: pct, perils: lines, ownDamage: round2(num(b.lossAndDamageCoveragePremium)), actsOfNature: round2(num(b.actsOfNaturePremium)),
    fixedPerils: round2(num(b.bodilyInjuryCoveragePremium) + num(b.propertyDamageCoveragePremium) + num(b.APPAcoveragePremium) + num(b.roadsideAssistancePremium) + num(b.personalAccidentCoverPremium)),
    netPremium: round2(b.netPremium), vat: round2(b.valueAddedTax), dst: round2(b.documentaryStampTax), lgt: round2(b.localGovernmentTax), fst: round2(b.fireServiceTax),
    ctpl: round2(ctpl), ctplYears, ctplNote, grossPremium: round2(b.grossPremium), commissionPct: num(scheme.commission_pct), commission,
    dealerCommissionPct: num(scheme.dealer_commission_pct), dealerShare, tisphShare: round2(commission - dealerShare), vehicleClass: cls?.value || null,
    rates: { OD, AON }, breakdown: b,
  };
}

/** Premium preview (FR-SCM-022): years 1 to the term for a vehicle and year-1 sum insured; nothing saved, no audit. */
export async function previewPremiums(schemeId, { make, model, variant, brandId, modelId, variantId, yearModel, sumInsured, insurerId = null }) {
  const scheme = await one('SELECT * FROM schemes WHERE id = $1', [schemeId]);
  if (!scheme) throw notFound('Scheme not found');
  const { line, vehicle } = await findSchemeAndLine({ schemeId, insurerId, vehicle: { make, model, variant, brandId, modelId, variantId, yearModel }, sumInsured });
  const years = [];
  for (let y = 1; y <= Number(scheme.term_years || 1); y += 1) {
    const p = await priceYear(scheme, line, { year: y, year1SumInsured: sumInsured, vehicleClass: line.vehicle_class, seats: vehicle.seats, insurerId, laterCtpl: true });
    delete p.breakdown;
    years.push(p);
  }
  const sum = (k) => round2(years.reduce((s, y) => s + num(y[k]), 0));
  return {
    schemeNo: scheme.scheme_no, version: scheme.version, lineNo: line.line_no, line: vehicleLabel(line), vehicleClass: line.vehicle_class, seats: vehicle.seats, years,
    totals: { netPremium: sum('netPremium'), ctpl: sum('ctpl'), grossPremium: sum('grossPremium'), commission: sum('commission'), dealerShare: sum('dealerShare'), tisphShare: sum('tisphShare') },
  };
}

/**
 * The scheme kept on a policy (policy_schemes) and its version; null for a policy issued on no scheme.
 */
export async function policyScheme(policyId, db = { query }) {
  const ps = (await db.query('SELECT ps.*, s.perils, s.si_schedule, s.term_years AS scheme_term, s.product_id, s.commission_pct AS s_commission, s.dealer_commission_pct AS s_dealer, s.status AS scheme_status, s.description FROM policy_schemes ps JOIN schemes s ON s.id = ps.scheme_id WHERE ps.policy_id = $1', [policyId])).rows[0];
  return ps || null;
}

/**
 * The next policy year of a scheme policy within its term (FR-SCM-023): priced on the version kept on the policy (whatever
 * its status now) at the sum insured of the schedule; null after the last year of the term (a normal Motor renewal).
 */
export async function renewalYear(policyId, db = { query }) {
  const ps = await policyScheme(policyId, db);
  if (!ps || ps.policy_year >= ps.term_years) return null;
  const scheme = (await db.query('SELECT * FROM schemes WHERE id = $1', [ps.scheme_id])).rows[0];
  // the commission and dealer percentages are the ones kept on the policy (FR-SCM-030 R2)
  const kept = { ...scheme, commission_pct: ps.commission_pct, dealer_commission_pct: ps.dealer_commission_pct };
  const line = ps.line_no ? (await db.query(`${LINE_SELECT} WHERE l.scheme_id = $1 AND l.line_no = $2`, [scheme.id, ps.line_no])).rows[0] : null;
  const pol = (await db.query('SELECT insurance_company_id, doc FROM policies WHERE id = $1', [policyId])).rows[0];
  const priced = await priceYear(kept, line, { year: ps.policy_year + 1, year1SumInsured: ps.year1_sum_insured, vehicleClass: line?.vehicle_class || ps.rates?.vehicleClass,
    seats: ps.rates?.seats, insurerId: pol?.insurance_company_id, laterCtpl: true });
  return { policyScheme: ps, scheme: kept, line, ...priced };
}

/** Write the scheme of a policy term (FR-SCM-023) inside the issuing or renewing transaction. */
export async function recordPolicyScheme(db, { policyId, scheme, line, priced, year, year1SumInsured, seats = null, dealerChannelId = null, applicationId = null, userId = null,
  commissionPct = null, dealerCommissionPct = null }) {
  const rates = { OD: priced.rates.OD, AON: priced.rates.AON, vehicleClass: priced.vehicleClass, seats, perils: priced.perils.map((p) => ({ code: p.code, name: p.name, rate: p.rate, limit: p.limit, premium: p.premium })) };
  await db.query(`INSERT INTO policy_schemes(policy_id, scheme_id, scheme_no, version, scheme_type, line_no, line_label, policy_year, term_years, year1_sum_insured, sum_insured, rates,
      commission_pct, dealer_commission_pct, dealer_channel_id, net_premium, commission_amount, dealer_share, tisph_share, scheme_premium, application_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) ON CONFLICT (policy_id) DO NOTHING`,
  [policyId, scheme.id, scheme.scheme_no, scheme.version, scheme.scheme_type, line?.line_no ?? null, line ? vehicleLabel(line) : null, year, scheme.term_years, year1SumInsured,
    priced.sumInsured, JSON.stringify(rates), commissionPct ?? scheme.commission_pct, dealerCommissionPct ?? scheme.dealer_commission_pct, dealerChannelId, priced.netPremium,
    priced.commission, priced.dealerShare, priced.tisphShare, priced.grossPremium, applicationId, userId]);
}

/** The policy document fields of a scheme policy term: the quotation fields the endorsements re-price on, and doc.scheme. */
export function schemeDoc({ scheme, line, priced, year, year1SumInsured, dealerChannelId = null, dealerName = null }) {
  const p = Object.fromEntries(priced.perils.map((x) => [x.code, x]));
  return {
    productType: 'Motor', lob: 'MOTOR', vehicleType: priced.vehicleClass, lossAndDamageCoverage: priced.sumInsured, lossAndDamageCoverageRate: priced.rates.OD ?? 0,
    lossAndDamageCoveragePremium: priced.ownDamage, actsOfNatureRate: priced.rates.AON ?? 0, actsOfNaturePremium: priced.actsOfNature,
    bodilyInjury: p.BI?.limit ?? 0, bodilyInjuryCoveragePremium: p.BI?.premium ?? 0, propertyDamage: p.PD?.limit ?? 0, propertyDamageCoveragePremium: p.PD?.premium ?? 0,
    APPAcoveragePremium: p.APPA?.premium ?? 0, roadsideAssistancePremium: p.RSA?.premium ?? 0, personalAccidentCoverPremium: p.PAD?.premium ?? 0,
    ctplCoveragePremium: priced.ctpl, ctplTermYears: priced.ctplYears, netPremium: priced.netPremium, valueAddedTax: priced.vat, documentaryStampTax: priced.dst,
    localGovernmentTax: priced.lgt, fireServiceTax: priced.fst, discount: 0, grossPremium: priced.grossPremium, commissionRate: priced.commissionPct,
    ...(dealerChannelId ? { channelId: dealerChannelId } : {}),
    scheme: { schemeId: scheme.id, schemeNo: scheme.scheme_no, version: scheme.version, schemeType: scheme.scheme_type, lineNo: line?.line_no ?? null, line: line ? vehicleLabel(line) : null,
      policyYear: year, termYears: scheme.term_years, year1SumInsured, sumInsured: priced.sumInsured, commissionPct: priced.commissionPct, dealerCommissionPct: priced.dealerCommissionPct,
      dealerChannelId, dealerName, rates: priced.rates },
  };
}
