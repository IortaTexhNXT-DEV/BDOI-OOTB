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

/**
 * Business time zone (System Settings general.timezone, e.g. Asia/Manila), applied by applySystemSettings. Business
 * dates (today, the start of this month) and the time a dashboard's figures were read are shown in this zone, not in
 * the zone of the browser.
 */
export const DEFAULT_TIME_ZONE = "Asia/Manila";
let activeTimeZone = DEFAULT_TIME_ZONE;

const validZone = (zone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const setBusinessTimeZone = (zone) => {
  const text = String(zone || "").trim();
  activeTimeZone = text && validZone(text) ? text : DEFAULT_TIME_ZONE;
};

export const getBusinessTimeZone = () => activeTimeZone;

/** The calendar date of an instant (now by default) in the business time zone, as YYYY-MM-DD. */
export const businessDate = (instant = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: activeTimeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(instant instanceof Date ? instant : new Date(instant)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** An instant (timestamp, ISO text or Date) as date and time in the business time zone, e.g. "10/10/2026 14:05". */
export const formatBusinessDateTime = (instant, { empty = "-" } = {}) => {
  if (instant === null || instant === undefined || instant === "") return empty;
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return empty;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: activeTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).map((p) => [p.type, p.value]));
  return `${formatDate(`${parts.year}-${parts.month}-${parts.day}`)} ${parts.hour}:${parts.minute}`;
};
