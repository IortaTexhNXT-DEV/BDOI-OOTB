/**
 * Configured date format (System Settings general.date_format, e.g. "DD/MM/YYYY").
 * Applied at runtime by applySystemSettings; every date shown or picked in the app goes through these helpers.
 */
export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

let activeDateFormat = DEFAULT_DATE_FORMAT;

const SUPPORTED = /^(?=.*YYYY|.*YY)(?=.*MM)(?=.*DD)[YMD\s/.-]+$/;

/** Set the display date format from system settings; unsupported values fall back to DD/MM/YYYY. */
export const setDateFormat = (format) => {
  const text = String(format || "").trim().toUpperCase();
  activeDateFormat = SUPPORTED.test(text) ? text : DEFAULT_DATE_FORMAT;
};

export const getDateFormat = () => activeDateFormat;

/**
 * The configured format in PrimeReact Calendar tokens: DD/MM/YYYY -> dd/mm/yy, MMM -> M, YY -> y.
 * @returns {string}
 */
export const calendarDateFormat = () =>
  activeDateFormat
    .replace(/YYYY/g, "yy")
    .replace(/(^|[^y])YY(?!Y)/g, "$1y")
    .replace(/MMM/g, "M")
    .replace(/MM/g, "mm")
    .replace(/DD/g, "dd");

/** A plain YYYY-MM-DD date is read as a local calendar date (no time-zone shift); anything else via Date. */
export const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a date (Date, ISO text or timestamp) with the configured format.
 * @param {Date|string|number|null|undefined} value
 * @param {{ withTime?: boolean, empty?: string }} [options]
 * @returns {string} the formatted date, or options.empty ("-" by default) when there is no valid date
 */
export const formatDate = (value, { withTime = false, empty = "-" } = {}) => {
  const date = toDate(value);
  if (!date) return empty;
  const pad = (n) => String(n).padStart(2, "0");
  const text = activeDateFormat
    .replace("YYYY", String(date.getFullYear()))
    .replace("YY", String(date.getFullYear()).slice(-2))
    .replace("MMM", MONTHS[date.getMonth()])
    .replace("MM", pad(date.getMonth() + 1))
    .replace("DD", pad(date.getDate()));
  return withTime ? `${text} ${pad(date.getHours())}:${pad(date.getMinutes())}` : text;
};
