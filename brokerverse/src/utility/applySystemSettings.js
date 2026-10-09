import i18n from "../i18n";
import runtimeConfig from "../config/runtimeConfig";
import { setDisplayCurrency } from "./currencyConverter";
import { DEFAULT_SYSTEM_SETTINGS } from "./systemCurrencies";
import { setActiveDefaultCurrency } from "./currencyOptions";
import { setDateFormat } from "./dateFormat";
import { setPhoneConfig } from "./phoneFormat";
import { setQuoteOptions } from "./quoteOptions";

/**
 * Apply CSS theme variables from system settings.
 */
export function applyThemeColors(primaryColor, secondaryColor) {
  const root = document.documentElement;
  // the broker theme (Theme and Branding, src/theme/runtime/themeEngine.js) owns the colours once it is loaded
  if (root.hasAttribute("data-bv-theme")) return;
  const primary = primaryColor || DEFAULT_SYSTEM_SETTINGS.primaryColor;
  const secondary = secondaryColor || DEFAULT_SYSTEM_SETTINGS.secondaryColor;
  root.style.setProperty("--bv-primary", primary);
  root.style.setProperty("--bv-secondary", secondary);
  root.style.setProperty("--bv-primary-hover", secondary);
}

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

/**
 * Apply default language only when user has no saved preference.
 */
export function applyDefaultLanguage(defaultLanguage) {
  const saved = localStorage.getItem("i18nextLng");
  if (saved) return;
  const lng = defaultLanguage || DEFAULT_SYSTEM_SETTINGS.defaultLanguage;
  if (lng && i18n.language !== lng) {
    i18n.changeLanguage(lng);
  }
}

/**
 * Apply all runtime effects from system settings payload.
 */
export function applySystemSettings(settings = {}, options = {}) {
  const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...settings };
  setDisplayCurrency(merged.displayCurrency);
  setActiveDefaultCurrency(merged.displayCurrency);
  setDateFormat(merged.dateFormat);
  setPhoneConfig(merged);
  setQuoteOptions(merged);
  applyThemeColors(merged.primaryColor, merged.secondaryColor);
  applyAppTitle(merged.systemName, options);
  applyDefaultLanguage(merged.defaultLanguage);
  return merged;
}
