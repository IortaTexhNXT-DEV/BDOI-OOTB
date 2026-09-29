/**
 * Business dates. Every "today" in the system is the calendar date in the configured time zone (general.timezone,
 * Asia/Manila by the seed), not the server's UTC date: between 00:00 and 08:00 Manila time the UTC date is yesterday.
 */
import { getSetting } from './settings.js';

const DAY_MS = 86400000;
export { DAY_MS };

/** The configured business time zone (general.timezone); UTC when the setting is empty or not a valid IANA zone. */
export async function businessTimeZone() {
  const tz = await getSetting('general.timezone');
  if (!tz) return 'UTC';
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return tz; } catch { return 'UTC'; }
}

/** YYYY-MM-DD of an instant in a time zone (UTC date when the zone is invalid). */
export function isoInZone(d, tz) {
  const date = d instanceof Date ? d : new Date(d);
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); } catch { return date.toISOString().slice(0, 10); }
}

/** Today's business date (YYYY-MM-DD in the configured time zone). `now` is for tests. */
export async function today(now = new Date()) {
  return isoInZone(now, await businessTimeZone());
}

/** Business date of an instant (Date / ISO timestamp); a plain YYYY-MM-DD is returned unchanged; null when invalid. */
export async function businessDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = v instanceof Date ? v : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return isoInZone(d, await businessTimeZone());
}

/** Wall-clock date and time in the configured time zone: { date: 'YYYY-MM-DD', time: 'HH:mm:ss', timeZone }. */
export async function nowInTz(now = new Date()) {
  const timeZone = await businessTimeZone();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  return { date: isoInZone(now, timeZone), time, timeZone };
}

const ymd = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const MONTHS_IN = { month: 1, quarter: 3, year: 12 };

/**
 * Calendar period containing today's business date: "month" = 1st of the month, "quarter" = 1st of the calendar
 * quarter, "year" = 1 January (not a rolling 30 / 90 / 365 days). Returns ISO dates:
 * { period, from, to (today), end (last day of the period), next (1st day after it), prevFrom, prevTo (the previous
 * whole period), timeZone }. An unknown period is "month".
 */
export async function calendarPeriod(period = 'month', now = new Date()) {
  const code = MONTHS_IN[period] ? period : 'month';
  const span = MONTHS_IN[code];
  const timeZone = await businessTimeZone();
  const to = isoInZone(now, timeZone);
  const [y, m] = to.split('-').map(Number);
  const startMonth = code === 'year' ? 1 : code === 'quarter' ? Math.floor((m - 1) / 3) * 3 + 1 : m;
  // Date.UTC normalises month overflow / underflow (month 13 = January of the next year, month 0 = December)
  const from = ymd(y, startMonth, 1);
  const next = ymd(y, startMonth + span, 1);
  const prevFrom = ymd(y, startMonth - span, 1);
  return { period: code, from, to, end: addDays(next, -1), next, prevFrom, prevTo: addDays(from, -1), timeZone };
}

/**
 * YYYY-MM-DD from a request or database value: a date string or timestamp keeps the date it is written with, a Date
 * object gives its UTC date. null when empty or not a date. Use businessDate() when an instant must be read in the
 * business time zone.
 */
export function isoDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD plus n calendar days (date arithmetic in UTC, so no time-zone shift). */
export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + Number(n) * DAY_MS).toISOString().slice(0, 10);
