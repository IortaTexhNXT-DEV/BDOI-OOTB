/**
 * Periods of the dashboards, in the business time zone (utility/dateFormat getBusinessTimeZone). The same rules as the
 * server (backend lib/dates.js calendarPeriod): "This month" runs from the 1st to today; the comparison is the same
 * number of days of the previous period, or the same dates a year earlier, so a period that has just started is never
 * compared with a whole one.
 */
import { businessDate } from "../../utility/dateFormat";

export const PERIODS = ["month", "quarter", "year"];
export const COMPARISONS = ["previous", "lastYear"];

const MONTHS_IN = { month: 1, quarter: 3, year: 12 };
const pad = (n) => String(n).padStart(2, "0");
/** YYYY-MM-DD of a year / month (1-based, overflow allowed) / day. */
const ymd = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
/** The same date `months` earlier, kept inside that month (31 March -> 28/29 February). */
const monthsBack = (iso, months) => {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 - months + 1, 0)).getUTCDate();
  return ymd(y, m - months, Math.min(d, last));
};

/**
 * { from, to, previousFrom, previousTo } of a period to date (today's business date by default) and its comparison
 * ("previous" period or the same period "lastYear").
 */
export function periodRange(period = "month", compare = "previous", today = businessDate()) {
  const span = MONTHS_IN[period] || 1;
  const [y, m] = today.split("-").map(Number);
  const startMonth = period === "year" ? 1 : period === "quarter" ? Math.floor((m - 1) / 3) * 3 + 1 : m;
  const from = ymd(y, startMonth, 1);
  if (compare === "lastYear") return { from, to: today, previousFrom: monthsBack(from, 12), previousTo: monthsBack(today, 12) };
  const previousFrom = ymd(y, startMonth - span, 1);
  const previousTo = [addDays(previousFrom, daysBetween(from, today)), addDays(from, -1)].sort()[0];
  return { from, to: today, previousFrom, previousTo };
}

/** Change of a figure against the comparison in percent (one decimal); null when there is nothing to compare with. */
export const changeOf = (current, previous) => {
  if ([current, previous].some((v) => v === null || v === undefined || v === "")) return null;
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return Math.round(((c - p) / Math.abs(p)) * 1000) / 10;
};
