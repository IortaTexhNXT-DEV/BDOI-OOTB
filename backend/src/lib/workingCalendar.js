/**
 * Working calendar of the business: the working days of the week (calendar.working_weekdays, 1 = Monday ... 7 = Sunday;
 * Monday to Friday by default) less the national public holidays of the Holiday master (Master > Configuration, type
 * holiday: Regular Holidays and Special Non-working Days; a Special Working Day stays a working day). Dates are ISO
 * yyyy-mm-dd business dates (lib/dates.js). Used by the renewal notice schedule, the renewal and claim service levels.
 */
import { many } from '../db/pool.js';
import { getSetting } from './settings.js';
import { addDays } from './dates.js';

const NON_WORKING = ['Regular Holiday', 'Special Non-working Day'];
/** Longest run of non-working days searched for the next working day (a guard against an empty working week). */
const MAX_SPAN = 60;

const weekday = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

/** National holidays (non-working) between two dates, inclusive, as a Set of ISO dates. */
export async function holidaysBetween(from, to) {
  const rows = await many(`SELECT data->>'date' AS d FROM master_records WHERE type_code = 'holiday' AND status = 'active'
    AND data->>'holidayType' = ANY($1) AND COALESCE(NULLIF(data->>'scope', ''), 'National') = 'National'
    AND data->>'date' BETWEEN $2 AND $3`, [NON_WORKING, from, to]);
  return new Set(rows.map((r) => r.d));
}

/** A calendar of the dates around `from` .. `to`: { isWorking(iso) } from one read of the holidays and the setting. */
export async function workingCalendar(from, to) {
  const days = (await getSetting('calendar.working_weekdays', [1, 2, 3, 4, 5])) || [1, 2, 3, 4, 5];
  const working = new Set((Array.isArray(days) ? days : [1, 2, 3, 4, 5]).map(Number));
  const holidays = await holidaysBetween(addDays(from, -MAX_SPAN), addDays(to, MAX_SPAN));
  const isWorking = (iso) => working.size > 0 && working.has(weekday(iso)) && !holidays.has(iso);
  return {
    isWorking,
    holidays,
    /** The date itself when it is a working day, else the next working day. */
    onOrAfter(iso) {
      let d = iso;
      for (let i = 0; i < MAX_SPAN && !isWorking(d); i += 1) d = addDays(d, 1);
      return d;
    },
    /** n working days after a date (n >= 0; the date itself does not count). */
    add(iso, n) {
      let d = iso;
      let left = Number(n) || 0;
      for (let i = 0; left > 0 && i < MAX_SPAN * (Number(n) + 1); i += 1) {
        d = addDays(d, 1);
        if (isWorking(d)) left -= 1;
      }
      return d;
    },
    /** Working days from a (exclusive) to b (inclusive); 0 when b is not after a. */
    between(a, b) {
      let n = 0;
      for (let d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (isWorking(d)) n += 1;
      return n;
    },
  };
}

export async function isWorkingDay(iso) {
  return (await workingCalendar(iso, iso)).isWorking(iso);
}

export async function nextWorkingDay(iso) {
  return (await workingCalendar(iso, iso)).onOrAfter(iso);
}

export async function addWorkingDays(iso, n) {
  return (await workingCalendar(iso, addDays(iso, Math.ceil(Number(n) * 1.6) + 7))).add(iso, n);
}

export async function workingDaysBetween(a, b) {
  return (await workingCalendar(a, b)).between(a, b);
}
