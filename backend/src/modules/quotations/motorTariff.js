/**
 * Philippine motor tariff read from the motor product template (Product Configurator), whose code is the setting
 * motor.pricing_template_code:
 *  - vehicleClasses: the Insurance Commission vehicle classes [{ code, label, seats }]
 *  - ctplSetting: CTPL annual amount per vehicle class, inclusive of taxes and the authentication fee (Insurance
 *    Commission tariff). CTPL is a fixed tariff amount, never sum insured x rate.
 *  - ctplSetting3Year: the 3-year upfront CTPL amount for brand-new vehicles (LTO 3-year registration), per class
 *    where the tariff gives one.
 *  - premiumRates: own damage rate (%) per vehicle class
 *  - appaSetting: Auto Passenger Personal Accident { limits: [per-person limits], ratePercent }. APPA premium =
 *    limit per person x number of seats (driver and passengers) x rate / 100.
 */
import { one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';
import { num, round2 } from '../documents/common.js';

const slug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** The motor tariff of the configured template (empty tables when no template is configured). */
export async function motorTariff() {
  const code = await getSetting('motor.pricing_template_code');
  const row = code ? await one('SELECT template_code, config FROM product_templates WHERE template_code = $1', [code]) : null;
  const cfg = row?.config || {};
  const classes = Array.isArray(cfg.vehicleClasses) ? cfg.vehicleClasses : [];
  const ctpl = cfg.ctplSetting || {};
  const rates = cfg.premiumRates || {};
  const appa = cfg.appaSetting || {};
  const ctpl3 = cfg.ctplSetting3Year || {};
  return {
    templateCode: row?.template_code || null,
    vehicleTypes: classes.map((c) => ({
      value: c.code, label: c.label, defaultSeats: num(c.seats) || null,
      ctplPremium: ctpl[c.code] !== undefined ? round2(num(ctpl[c.code])) : null,
      ctplPremium3Year: num(ctpl3[c.code]) > 0 ? round2(num(ctpl3[c.code])) : null,
      ownDamageRate: rates[c.code] !== undefined ? num(rates[c.code]) : null,
    })),
    appa: { limits: (appa.limits || []).map(num).filter((x) => x > 0), ratePercent: num(appa.ratePercent) },
  };
}

/** Vehicle class code from a code, a label ("Private cars") or a slug of either; null when unknown. */
export function vehicleClass(tariff, value) {
  if (!value) return null;
  const s = slug(value);
  return tariff.vehicleTypes.find((t) => t.value === value || slug(t.label) === s || t.value === s) || null;
}

/** Vehicle type and seating capacity as the quote wizard stores them (top level or the vehicle details block). */
export function vehicleOf(v) {
  const d = (Array.isArray(v.insuranceVehicleDetails) ? v.insuranceVehicleDetails[0] : v.insuranceVehicleDetails) || {};
  const p = v.policyDetails || {};
  return {
    vehicleType: v.vehicleType || d.vehicleType || p.vehicleType || null,
    seats: num(v.appaSeats) || num(v.seatingCapacity) || num(d.seatingCapacity) || num(p.seatingCapacity) || 0,
  };
}

/** Whether the quote asks for CTPL: an explicit includeCTPL flag, else a CTPL amount sent by the wizard. */
const wantsCtpl = (v) => (v.includeCTPL !== undefined ? v.includeCTPL === true || v.includeCTPL === 'true' : num(v.ctplCoverageRate ?? v.ctplCoveragePremium) > 0);

/**
 * CTPL and APPA premiums for a motor quote. CTPL is the tariff premium of the vehicle class (the amount sent by the
 * browser is ignored); APPA is recomputed from the per-person limit and the number of seats.
 */
export async function motorFixedCovers(v, tariff = null) {
  const t = tariff || await motorTariff();
  const { vehicleType, seats: givenSeats } = vehicleOf(v);
  const cls = vehicleClass(t, vehicleType);
  const out = { vehicleType: cls?.value || vehicleType || null, ctplCoveragePremium: 0, ctplCoverageRate: '' };
  if (wantsCtpl(v)) {
    if (!cls && vehicleType) throw badRequest(`Vehicle type "${vehicleType}" is not an Insurance Commission vehicle class of the motor tariff (${t.vehicleTypes.map((x) => x.value).join(', ')})`);
    if (!cls || cls.ctplPremium === null) throw badRequest('CTPL needs the vehicle type (Insurance Commission vehicle class) of the vehicle');
    const years = num(v.ctplTermYears) === 3 ? 3 : 1;
    if (years === 3 && cls.ctplPremium3Year === null) throw badRequest(`No 3-year CTPL tariff is configured for ${cls.label}`);
    const amount = years === 3 ? cls.ctplPremium3Year : cls.ctplPremium;
    out.ctplTermYears = years;
    out.ctplCoveragePremium = amount;
    out.ctplCoverageRate = amount.toFixed(2);
  }
  const perPerson = num(v.autoPassengerPersonalAccident);
  if (perPerson > 0) {
    const seats = givenSeats || cls?.defaultSeats || 0;
    if (!seats) throw badRequest('Auto Passenger Personal Accident needs the number of seats');
    if (t.appa.limits.length && !t.appa.limits.includes(perPerson)) throw badRequest(`Auto Passenger Personal Accident limit per person must be one of ${t.appa.limits.join(', ')}`);
    out.appaSeats = seats;
    out.APPAtotalCoverage = round2(perPerson * seats);
    out.APPARate = t.appa.ratePercent;
    out.APPAcoveragePremium = round2((perPerson * seats * t.appa.ratePercent) / 100);
  } else {
    out.APPAtotalCoverage = 0;
    out.APPAcoveragePremium = 0;
  }
  return out;
}
