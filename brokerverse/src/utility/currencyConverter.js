import { CURRENCY_LOCALE_MAP, DEFAULT_SYSTEM_SETTINGS } from "./systemCurrencies";

let activeCurrency = DEFAULT_SYSTEM_SETTINGS.displayCurrency;
let activeLocale =
  CURRENCY_LOCALE_MAP[DEFAULT_SYSTEM_SETTINGS.displayCurrency] || "en-PH";

/**
 * Apply display currency from system settings.
 * @param {string} code - ISO currency code
 */
export const setDisplayCurrency = (code) => {
  const next = (code || DEFAULT_SYSTEM_SETTINGS.displayCurrency).toUpperCase();
  activeCurrency = next;
  activeLocale = CURRENCY_LOCALE_MAP[next] || "en-PH";
};

/**
 * @returns {{ currency: string, locale: string }}
 */
export const getDisplayCurrencyConfig = () => ({
  currency: activeCurrency,
  locale: activeLocale,
});

/**
 * @deprecated Prefer getDisplayCurrencyConfig — language no longer maps to currency.
 */
export const getCurrencyForLanguage = () => getDisplayCurrencyConfig();

/**
 * Format a numeric amount using the active system display currency.
 * @param {number|string|null|undefined} amount
 * @param {{ minimumFractionDigits?: number, maximumFractionDigits?: number }} [options]
 * @returns {string}
 */
export const formatCurrency = (amount, options = {}) => {
  const { currency, locale } = getDisplayCurrencyConfig();

  if (amount === null || amount === undefined || amount === "") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }

  let numericValue;
  if (typeof amount === "string") {
    const normalized = String(amount).replaceAll(",", "").trim();
    if (normalized === "") {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(0);
    }
    numericValue = Number(normalized);
    if (Number.isNaN(numericValue)) return String(amount);
  } else {
    numericValue = Number(amount);
    if (Number.isNaN(numericValue)) return "0.00";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(numericValue);
};

/** @deprecated Use formatCurrency instead. Kept for backward compatibility. */
export const currencyConverter = formatCurrency;

/** Locale for plain numbers: the display currency's locale (en-PH for PHP), never the browser's. */
export const numberLocale = () => activeLocale || "en-PH";

/**
 * Format a plain number with the configured grouping (PHP: 1,200,000.00).
 * @param {number|string} value
 * @param {Intl.NumberFormatOptions} [options]
 */
export const formatNumber = (value, options = {}) => {
  const n = Number(`${value ?? ""}`.replace(/,/g, ""));
  if (value === null || value === undefined || value === "" || Number.isNaN(n)) return "";
  return n.toLocaleString(numberLocale(), options);
};

/**
 * Symbol of the display currency (System Settings > display currency), e.g. "₱" for PHP in en-PH.
 * Use it in labels such as "Min Premium (₱)" instead of a literal symbol.
 */
export const currencySymbol = () => {
  const { currency, locale } = getDisplayCurrencyConfig();
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value || currency;
  } catch {
    return currency;
  }
};

/**
 * An amount in compact notation in the display currency: ₱850, ₱12.9K, ₱1.2M, ₱3.4B. For KPI values and chart axes;
 * tables and tooltips show the amount in full (formatCurrency).
 * @param {number|string|null|undefined} amount
 * @param {{ maximumFractionDigits?: number, empty?: string }} [options]
 */
export const formatCompactCurrency = (amount, { maximumFractionDigits = 1, empty = "-" } = {}) => {
  if (amount === null || amount === undefined || amount === "") return empty;
  const n = Number(`${amount}`.replace(/,/g, ""));
  if (Number.isNaN(n)) return empty;
  const { currency, locale } = getDisplayCurrencyConfig();
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits }).format(n);
};

/** A count in compact notation (850, 12.9K, 1.2M), with the configured grouping below a thousand. */
export const formatCompactNumber = (value, { maximumFractionDigits = 1, empty = "-" } = {}) => {
  if (value === null || value === undefined || value === "") return empty;
  const n = Number(`${value}`.replace(/,/g, ""));
  if (Number.isNaN(n)) return empty;
  return new Intl.NumberFormat(numberLocale(), { notation: "compact", maximumFractionDigits }).format(n);
};
