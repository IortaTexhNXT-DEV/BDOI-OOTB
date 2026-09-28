import i18n from "../i18n";

const CURRENCY_BY_LANGUAGE = {
  en: { currency: "USD", locale: "en-US" },
  th: { currency: "THB", locale: "th-TH" },
};

const DEFAULT = { currency: "USD", locale: "en-US" };

/**
 * Get currency and locale for a given language code.
 * @param {string} lng - Language code (e.g. 'en', 'th')
 * @returns {{ currency: string, locale: string }}
 */
export const getCurrencyForLanguage = (lng) => {
  const base = (lng || "").split("-")[0];
  return CURRENCY_BY_LANGUAGE[base] || DEFAULT;
};

/**
 * Format a numeric amount as currency using the current i18n language.
 * English → USD, Thai → THB.
 * @param {number|string|null|undefined} amount - Value to format
 * @param {{ minimumFractionDigits?: number, maximumFractionDigits?: number }} [options]
 * @returns {string}
 */
export const formatCurrency = (amount, options = {}) => {
  const lng = (i18n.language || "en").split("-")[0];
  const { currency, locale } = getCurrencyForLanguage(lng);

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
