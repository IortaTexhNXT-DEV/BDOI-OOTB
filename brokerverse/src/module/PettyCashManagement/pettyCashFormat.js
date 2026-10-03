
import { formatDate as formatAppDate } from "../../utility/dateFormat";/** Code of a dropdown value that may be an option object ({ code }) or a plain string. */
export const optionCode = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "object" ? value.code ?? value.value : value;
};

/** YYYY-MM-DD (or ISO) to the MM/DD/YYYY shown in the petty cash tables. */
export const formatDisplayDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatAppDate(date);
};

/** A Date (calendar value) as YYYY-MM-DD in local time. */
export const toApiDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return undefined;
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
