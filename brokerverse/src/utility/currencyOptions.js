import { DEFAULT_SYSTEM_SETTINGS } from "./systemCurrencies";

/**
 * Default transaction currency: the display currency from System Settings (currency.default), applied at runtime
 * by applySystemSettings. Currency dropdowns list the Currency master (useMasterOptions("currency")).
 */
export let ACTIVE_DEFAULT_CURRENCY = DEFAULT_SYSTEM_SETTINGS.displayCurrency;

export const setActiveDefaultCurrency = (code) => {
  ACTIVE_DEFAULT_CURRENCY = code || DEFAULT_SYSTEM_SETTINGS.displayCurrency;
};
