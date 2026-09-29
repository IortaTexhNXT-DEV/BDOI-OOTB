/**
 * Display formatting of computed numbers on dashboards and work queues: percentages, averages and values with a unit.
 * Ratios computed on screen or by the API ("1 of 3 attempts" = 33.33333333333333) are rounded for display here, in one
 * place, instead of being rendered raw.
 */

/** A finite number from a number or numeric string; null otherwise. */
export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Rounded to `decimals` places (half away from zero); null when not a number. */
export const roundTo = (value, decimals = 1) => {
  const n = toNumber(value);
  if (n === null) return null;
  const f = 10 ** decimals;
  return Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON) / f;
};

/**
 * A number with at most `decimals` decimals and thousands separators: 76.8888888888889 -> "76.9", 1234.5 -> "1,234.5".
 * `empty` is returned for a missing / non-numeric value.
 */
export const formatNumber = (value, { decimals = 1, minDecimals = 0, empty = "-" } = {}) => {
  const n = roundTo(value, decimals);
  if (n === null) return empty;
  return n.toLocaleString("en-US", { minimumFractionDigits: Math.min(minDecimals, decimals), maximumFractionDigits: decimals });
};

/** A percentage (the value is already 0-100): 33.33333333333333 -> "33.3%". */
export const formatPercent = (value, { decimals = 1, minDecimals = 0, empty = "-" } = {}) => {
  const text = formatNumber(value, { decimals, minDecimals, empty: null });
  return text === null ? empty : `${text}%`;
};

/** A value with its unit, separated by a space: (35.67, "days") -> "35.7 days"; "%" and "/5" attach without a space. */
export const formatWithUnit = (value, unit = "", { decimals = 1, empty = "-" } = {}) => {
  if (unit === "%") return formatPercent(value, { decimals, empty });
  const text = formatNumber(value, { decimals, empty: null });
  if (text === null) return empty;
  if (!unit) return text;
  return unit.startsWith("/") ? `${text}${unit}` : `${text} ${unit}`;
};

/** Value for a PrimeReact ProgressBar / Knob: 0-100, rounded (they render the raw value as text). */
export const progressValue = (value, decimals = 0) => {
  const n = roundTo(value, decimals);
  if (n === null) return 0;
  return Math.min(100, Math.max(0, n));
};

/** Share of a whole as a percentage number (not text): (1, 3) -> 33.3; 0 when the whole is 0. */
export const percentOf = (part, whole, decimals = 1) => {
  const p = toNumber(part);
  const w = toNumber(whole);
  if (p === null || !w) return 0;
  return roundTo((p / w) * 100, decimals);
};
