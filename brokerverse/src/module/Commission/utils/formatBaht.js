import { formatCurrency } from "../../../utility/currencyConverter";

/**
 * Format commission amounts as PHP (legacy name kept for call-site compatibility).
 */
export const formatBaht = (amount, { decimals } = {}) => {
  const options =
    decimals !== undefined
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : undefined;
  return formatCurrency(amount, options);
};
