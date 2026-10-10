import { isValidElement } from "react";
import i18n from "../../i18n";
import { formatCurrency, numberLocale } from "../../utility/currencyConverter";
import { formatDate, formatInstant } from "../../utility/dateFormat";
import { formatPercent, toNumber } from "../../utility/numberFormat";

/** What a detail view shows for a value that is not there. */
export const EMPTY_VALUE = "—";

/** Value types shown right-aligned with tabular figures. */
export const NUMERIC_TYPES = new Set(["amount", "number", "percent"]);

export const isEmptyValue = (value) =>
  value === null || value === undefined || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);

/**
 * A value as a detail view shows it, by type:
 *  - amount: the display currency (or `currency`), two decimals
 *  - number: grouped, at most `decimals` (2) decimals
 *  - percent: "12.5%"
 *  - date: the configured date format (dd/mm/yyyy)
 *  - datetime: date and time in the business time zone (dd/mm/yyyy HH:mm)
 *  - boolean: Yes / No
 *  - text (default): as it is; a list is joined with commas
 * A React element is returned unchanged; an empty value gives `empty` ("—").
 */
export const formatValue = (value, { type = "text", currency, decimals, empty = EMPTY_VALUE } = {}) => {
  if (isValidElement(value)) return value;
  if (isEmptyValue(value)) return empty;
  switch (type) {
    case "amount": {
      const n = toNumber(value);
      if (n === null) return String(value);
      if (!currency) return formatCurrency(n);
      return new Intl.NumberFormat(numberLocale(), { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    }
    case "number": {
      const n = toNumber(value);
      return n === null ? String(value) : n.toLocaleString(numberLocale(), { maximumFractionDigits: decimals ?? 2 });
    }
    case "percent":
      return formatPercent(value, { decimals: decimals ?? 2, empty });
    case "date":
      return formatDate(value, { empty });
    case "datetime":
      return formatInstant(value, { empty });
    case "boolean":
      return value ? i18n.t("detailView.yes") : i18n.t("detailView.no");
    default:
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
};
