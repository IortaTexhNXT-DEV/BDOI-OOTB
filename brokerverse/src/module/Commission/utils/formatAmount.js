import { formatCurrency } from "../../../utility/currencyConverter";

/**
 * Commission amounts in the display currency, optionally with a fixed number of decimals.
 */
export const formatAmount = (amount, { decimals } = {}) => {
  const options =
    decimals !== undefined
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : undefined;
  return formatCurrency(amount, options);
};
