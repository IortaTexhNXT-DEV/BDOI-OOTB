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

/**
 * A plain YYYY-MM-DD date is read as a local calendar date (no time-zone shift); a date already written in the
 * configured numeric format (e.g. 29/09/2026 for DD/MM/YYYY) is read in that order, so formatting twice is harmless;
 * anything else via Date.
 */
export const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (plain) return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
  const shown = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (shown) {
    const dayFirst = activeDateFormat.indexOf("D") < activeDateFormat.indexOf("M");
    const day = Number(dayFirst ? shown[1] : shown[2]);
    const month = Number(dayFirst ? shown[2] : shown[1]);
    const date = new Date(Number(shown[3]), month - 1, day);
    return date.getMonth() === month - 1 ? date : null;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * A calendar date (Date or text) as ISO YYYY-MM-DD in local time, for values sent to the API; null when there is none.
 * @param {Date|string|number|null|undefined} value
 * @returns {string|null}
 */
export const toIsoDate = (value) => {
  const date = toDate(value);
  if (!date) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a date (Date, ISO text or timestamp) with the configured format.
 * @param {Date|string|number|null|undefined} value
 * @param {{ withTime?: boolean, empty?: string }} [options]
 * @returns {string} the formatted date; options.empty ("-" by default) when there is no date; text that is not a
 *   date (e.g. "N/A") is returned unchanged
 */
export const formatDate = (value, { withTime = false, empty = "-" } = {}) => {
  const date = toDate(value);
  if (!date) return typeof value === "string" && value.trim() ? value : empty;
  const pad = (n) => String(n).padStart(2, "0");
  const text = activeDateFormat
    .replace("YYYY", String(date.getFullYear()))
    .replace("YY", String(date.getFullYear()).slice(-2))
    .replace("MMM", MONTHS[date.getMonth()])
    .replace("MM", pad(date.getMonth() + 1))
    .replace("DD", pad(date.getDate()));
  return withTime ? `${text} ${pad(date.getHours())}:${pad(date.getMinutes())}` : text;
};
