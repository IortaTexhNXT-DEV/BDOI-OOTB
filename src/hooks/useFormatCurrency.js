import { useSelector } from "react-redux";
import { formatCurrency as formatCurrencyUtil, getDisplayCurrencyConfig } from "../utility/currencyConverter";

/**
 * Hook that returns currency formatting using the active system display currency.
 * Re-renders when system settings currency changes.
 * @returns {{ formatCurrency: (amount, options?) => string, currencyCode: string, locale: string }}
 */
export const useFormatCurrency = () => {
  const displayCurrency = useSelector(
    (state) => state.systemSettingsReducer?.displayCurrency
  );
  const { currency: currencyCode, locale } = getDisplayCurrencyConfig();

  // Subscribe to Redux currency so formatters refresh after settings change
  void displayCurrency;

  const formatCurrency = (amount, options) => formatCurrencyUtil(amount, options);

  return { formatCurrency, currencyCode, locale };
};
