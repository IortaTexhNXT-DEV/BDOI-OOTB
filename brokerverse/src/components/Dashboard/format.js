/**
 * Value formats of KPIs and charts: an amount in pesos (compact ₱1.2M on cards and axes, in full in tooltips and
 * tables), a count, a percentage, days or hours.
 */
import { formatCompactCurrency, formatCompactNumber, formatCurrency, numberLocale } from "../../utility/currencyConverter";
import { formatPercent, formatWithUnit } from "../../utility/numberFormat";

export const FORMATS = ["currency", "count", "percent", "days", "hours"];

/** A value in a format; `compact` for cards and axes. A function format is called with the value. */
export function formatValue(format, value, { compact = false } = {}) {
  if (typeof format === "function") return format(value);
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "-";
  const n = Number(value);
  switch (format) {
    case "currency":
      return compact ? formatCompactCurrency(n) : formatCurrency(n);
    case "percent":
      return formatPercent(n);
    case "days":
      return formatWithUnit(n, "d");
    case "hours":
      return formatWithUnit(n, "h");
    default:
      return compact ? formatCompactNumber(n) : n.toLocaleString(numberLocale(), { maximumFractionDigits: 2 });
  }
}
