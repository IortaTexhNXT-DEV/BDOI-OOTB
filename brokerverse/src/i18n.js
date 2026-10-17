import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

// The interface is in English only (TISPH decision): one bundled translation, no language picker. The i18n keys stay so
// that labels are kept in one place (en.json) and checked by npm run check:i18n.
const resources = {
  en: { translation: en },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    lng: "en",
    supportedLngs: ["en"],
    keySeparator: ".",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
