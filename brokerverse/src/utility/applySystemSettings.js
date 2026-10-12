import i18n from "../i18n";
import runtimeConfig from "../config/runtimeConfig";
import { setDisplayCurrency } from "./currencyConverter";
import { DEFAULT_SYSTEM_SETTINGS } from "./systemCurrencies";
import { setActiveDefaultCurrency } from "./currencyOptions";
import { setDateFormat, setTimeZone } from "./dateFormat";
import { setPhoneConfig } from "./phoneFormat";
import { setQuoteOptions } from "./quoteOptions";

/**
 * The browser tab title from the application name (general.system_name): "<name> - Login" before sign-in,
 * "<name> - Dashboard | <user>" after.
 */
export function appTitle(name, { authenticated, userName } = {}) {
  const shown = name || DEFAULT_SYSTEM_SETTINGS.systemName;
  // non-production environments put their name first in the browser tab, e.g. "[UAT] Toyota Insurance Services - Login"
  const base = runtimeConfig.showEnvironmentBanner ? `[${runtimeConfig.environmentName}] ${shown}` : shown;
  return authenticated ? `${base} - Dashboard | ${userName || "User"}` : `${base} - Login`;
}

/** Set the browser tab title (appTitle). The favicon comes with the branding (src/theme/runtime/themeEngine.js). */
export function applyAppTitle(name, options = {}) {
  document.title = appTitle(name, options);
}

/** The interface is in English only (src/i18n.js): a configured default language is not applied. */
export function applyDefaultLanguage() {
  if (!i18n.language || !i18n.language.startsWith("en")) i18n.changeLanguage("en");
}

/**
 * Apply all runtime effects of the system settings payload: formats, currency, language and the tab title (only from
 * a loaded application name, never the product default). The colours, logo and favicon come with the branding
 * (src/theme/runtime/BrandingProvider.jsx).
 */
export function applySystemSettings(settings = {}, options = {}) {
  const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...settings };
  setDisplayCurrency(merged.displayCurrency);
  setActiveDefaultCurrency(merged.displayCurrency);
  setDateFormat(merged.dateFormat);
  setTimeZone(merged.timezone);
  setPhoneConfig(merged);
  setQuoteOptions(merged);
  if (settings.systemName) applyAppTitle(settings.systemName, options);
  applyDefaultLanguage(merged.defaultLanguage);
  return merged;
}
