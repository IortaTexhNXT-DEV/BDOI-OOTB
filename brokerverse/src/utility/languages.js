/**
 * Languages offered in the language pickers (sign-in page and top bar): the languages configured in System Settings
 * (setting general.languages) that have a translation bundled in src/locales. A configured language without a
 * translation (for example Filipino) is not offered, because choosing it would only show English.
 */
import { useEffect, useState } from "react";
import i18n from "../i18n";
import systemSettingsService from "../services/systemSettingsService";

const FALLBACK_LABELS = { en: "English", fil: "Filipino" };

/** Language codes with a bundled translation. */
export const translatedLanguages = () => Object.keys(i18n.options?.resources || { en: {} });

/** [{ label, value }] from the configured list, limited to translated languages (English when nothing matches). */
export const languageOptions = (configured) => {
  const available = translatedLanguages();
  const list = Array.isArray(configured) && configured.length ? configured : available.map((code) => ({ code }));
  const options = list
    .map((l) => (typeof l === "string" ? { code: l } : l))
    .filter((l) => l && available.includes(l.code))
    .map((l) => ({ value: l.code, label: l.label || FALLBACK_LABELS[l.code] || l.code }));
  return options.length ? options : [{ value: "en", label: FALLBACK_LABELS.en }];
};

let configuredPromise = null;
const loadConfigured = () => {
  if (!configuredPromise) {
    configuredPromise = systemSettingsService
      .getSettings()
      .then((s) => s?.languages || [])
      .catch(() => {
        configuredPromise = null;
        return [];
      });
  }
  return configuredPromise;
};

/**
 * Hook: language options for a picker (configured and translated). Empty until the configuration is known, so a
 * picker is never shown for a moment and then hidden; pickers are shown only when there are two or more languages.
 * When a single language remains, the interface switches to it.
 */
export const useLanguageOptions = () => {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let live = true;
    loadConfigured().then((configured) => {
      if (!live) return;
      const list = languageOptions(configured);
      setOptions(list);
      if (list.length === 1 && i18n.language && !i18n.language.startsWith(list[0].value)) i18n.changeLanguage(list[0].value);
    });
    return () => {
      live = false;
    };
  }, []);
  return options;
};

/** A language picker is worth showing only when there is a choice. */
export const showLanguagePicker = (options) => Array.isArray(options) && options.length > 1;
