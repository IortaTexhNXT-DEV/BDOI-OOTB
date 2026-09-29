import { formatNumber } from "./currencyConverter";

/**
 * Quote wizard options from configuration (System Settings quote.vehicle_colours, quote.model_year_span).
 * Applied at runtime by applySystemSettings.
 */
const DEFAULT_COLOURS = ["White", "Black", "Silver", "Gray", "Red", "Blue"];
const DEFAULT_YEAR_SPAN = 20;

let colours = DEFAULT_COLOURS;
let yearSpan = DEFAULT_YEAR_SPAN;
let bodilyInjuryLimits = [];
let propertyDamageLimits = [];

const amounts = (list) => (Array.isArray(list) ? list.map(Number).filter((n) => Number.isFinite(n) && n > 0) : []);

export const setQuoteOptions = ({ vehicleColours, modelYearSpan, bodilyInjuryLimits: bi, propertyDamageLimits: pd } = {}) => {
  colours = Array.isArray(vehicleColours) && vehicleColours.length ? vehicleColours.map(String) : DEFAULT_COLOURS;
  const span = Number(modelYearSpan);
  yearSpan = Number.isInteger(span) && span > 0 && span <= 100 ? span : DEFAULT_YEAR_SPAN;
  bodilyInjuryLimits = amounts(bi);
  propertyDamageLimits = amounts(pd);
};

/** Amount options in the configured grouping (PHP: 100,000); the stored value is the formatted text. */
export const amountOptions = (list) => amounts(list).map((a) => ({ label: formatNumber(a), value: formatNumber(a) }));

/** Excess bodily injury limits offered on motor quotes / endorsements (quote.bodily_injury_limits). */
export const bodilyInjuryOptions = () => amountOptions(bodilyInjuryLimits);

/** Property damage limits offered on motor quotes / endorsements (quote.property_damage_limits). */
export const propertyDamageOptions = () => amountOptions(propertyDamageLimits);

/** Vehicle colours as dropdown options; the stored value is the colour name itself. */
export const vehicleColourOptions = () => colours.map((c) => ({ label: c, value: c }));

/**
 * Display label of a stored colour. Older quotes stored internal codes such as "GalacticSilver";
 * those are shown as words ("Galactic Silver").
 */
export const vehicleColourLabel = (value) => {
  if (value === null || value === undefined || value === "") return value;
  const text = String(value);
  const known = colours.find((c) => c.toLowerCase() === text.toLowerCase() || c.replace(/\s+/g, "").toLowerCase() === text.toLowerCase());
  if (known) return known;
  return text.includes(" ") ? text : text.replace(/([a-z])([A-Z])/g, "$1 $2");
};

/** Model years from next year down to the configured span back, computed at runtime. */
export const modelYearOptions = (now = new Date()) => {
  const newest = now.getFullYear() + 1;
  return Array.from({ length: yearSpan + 2 }, (_, i) => {
    const year = String(newest - i);
    return { label: year, value: year };
  });
};
