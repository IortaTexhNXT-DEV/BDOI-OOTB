import { useTranslation } from "react-i18next";
import { formatCurrency as formatCurrencyUtil, getCurrencyForLanguage } from "../utility/currencyConverter";

/**
 * Hook that returns currency formatting tied to current i18n language.
 * Use in React components so they re-render when language changes.
 * English → USD, Thai → THB.
 * @returns {{ formatCurrency: (amount, options?) => string, currencyCode: string, locale: string }}
 */
export const useFormatCurrency = () => {
  const { i18n } = useTranslation();
  const lng = (i18n.language || "en").split("-")[0];
  const { currency: currencyCode, locale } = getCurrencyForLanguage(lng);

  const formatCurrency = (amount, options) => formatCurrencyUtil(amount, options);

  return { formatCurrency, currencyCode, locale };
};
