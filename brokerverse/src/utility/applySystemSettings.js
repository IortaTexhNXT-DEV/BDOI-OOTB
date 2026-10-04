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
 * Update favicon link in document head.
 */
export function applyFavicon(faviconUrl) {
  const href = faviconUrl || DEFAULT_SYSTEM_SETTINGS.faviconUrl;
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Set document title from the application name (login / generic pages).
 * Authenticated pages may append more in App.js.
 */
export function applyAppTitle(appTitle, { authenticated, userName } = {}) {
  const name = appTitle || DEFAULT_SYSTEM_SETTINGS.systemName;
  // non-production environments put their name first in the browser tab, e.g. "[UAT] BrokerVerse - Login"
  const base = runtimeConfig.showEnvironmentBanner ? `[${runtimeConfig.environmentName}] ${name}` : name;
  if (authenticated) {
    document.title = `${base} - Dashboard | ${userName || "User"}`;
  } else {
    document.title = `${base} - Login`;
  }
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
  applyFavicon(merged.faviconUrl);
  applyAppTitle(merged.systemName, options);
  applyDefaultLanguage(merged.defaultLanguage);
  return merged;
}
