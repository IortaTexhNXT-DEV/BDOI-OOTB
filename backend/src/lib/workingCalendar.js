/**
 * Working calendar: Monday to Friday, less the national Regular Holidays and Special Non-working Days of the Holiday
 * master (Master > General > Holiday, seed 69_ph_practice_masters.sql); a Special Working Day of the master is worked
 * even on a weekend. Dates are business dates (YYYY-MM-DD in general.timezone).
 */
import { query } from '../db/pool.js';
import { addDays, businessTimeZone, isoInZone } from './dates.js';

const NON_WORKING = ['Regular Holiday', 'Special Non-working Day'];
const WORKING = 'Special Working Day';

/** The holiday dates between two business dates: { off: Set of non-working dates, on: Set of special working dates }. */
export async function holidays(from, to, db = { query }) {
  const rows = (await db.query(`SELECT data->>'date' AS date, data->>'holidayType' AS kind FROM master_records
    WHERE type_code = 'holiday' AND status = 'active' AND COALESCE(NULLIF(data->>'scope', ''), 'National') = 'National'
      AND data->>'date' BETWEEN $1 AND $2`, [from, to])).rows;
  return {
    off: new Set(rows.filter((r) => NON_WORKING.includes(r.kind)).map((r) => r.date)),
    on: new Set(rows.filter((r) => r.kind === WORKING).map((r) => r.date)),
  };
}

const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Whether a business date is worked, with the holidays of holidays(). */
export function isWorkingDate(iso, cal) {
  if (cal.on.has(iso)) return true;
  if (cal.off.has(iso)) return false;
  const d = weekday(iso);
  return d !== 0 && d !== 6;
}

/** Whether a business date is worked (reads the Holiday master). */
export async function isWorkingDay(iso, db) {
  return isWorkingDate(iso, await holidays(iso, iso, db));
}

/** The first working day after a business date (at most 30 days ahead). */
export async function nextWorkingDay(iso, db) {
  const cal = await holidays(addDays(iso, 1), addDays(iso, 31), db);
  for (let i = 1; i <= 31; i += 1) {
    const d = addDays(iso, i);
    if (isWorkingDate(d, cal)) return d;
  }
  return addDays(iso, 1);
}

/**
 * Hours of working days between two instants: every hour that falls on a working day of the business time zone counts,
 * the hours of weekends and holidays do not (a prospect assigned on Friday morning reaches 72 hours on Wednesday morning).
 */
export async function workingHoursBetween(start, end, db) {
  const from = new Date(start);
  const to = new Date(end);
  if (!(to > from)) return 0;
  const tz = await businessTimeZone();
  const cal = await holidays(isoInZone(from, tz), isoInZone(to, tz), db);
  let hours = 0;
  // step hour by hour in blocks: a working day adds the hours of the block, a day off adds none
  for (let t = from.getTime(); t < to.getTime(); t += 3600000) {
    const step = Math.min(3600000, to.getTime() - t);
    if (isWorkingDate(isoInZone(new Date(t), tz), cal)) hours += step / 3600000;
  }
  return hours;
}
