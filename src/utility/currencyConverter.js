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
  activeLocale = CURRENCY_LOCALE_MAP[next] || "en-US";
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
