/**
 * Working days: Monday to Friday except the dates of the Holiday master (Master > General > Holiday). Used by the
 * insurer billing run (billing dates moved off non-working days) and the period cut-off (the finance adjustment window
 * of N working days after the month end).
 */
import { many } from '../db/pool.js';
import { addDays } from './dates.js';

const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** The dates of the Holiday master between from and to (YYYY-MM-DD). */
export async function holidays(from, to) {
  const rows = await many(`SELECT COALESCE(data->>'date', substring(code from '^\\d{4}-\\d{2}-\\d{2}')) AS d FROM master_records
    WHERE type_code = 'holiday' AND status = 'active'`);
  return new Set(rows.map((r) => r.d).filter((d) => d && d >= from && d <= to));
}

/** Whether a date is a working day given the holidays around it. */
export const isWorkingDay = (date, off) => ![0, 6].includes(weekday(date)) && !off.has(date);

/** `date` moved by `step` days (1 or -1) until it falls on a working day. */
export function toWorkingDay(date, step, off) {
  let day = date;
  while (!isWorkingDay(day, off)) day = addDays(day, step);
  return day;
}

/** The n-th working day of the month YYYY-MM (n >= 1). */
export async function nthWorkingDay(month, n) {
  const first = `${month}-01`;
  const off = await holidays(first, addDays(first, 45));
  let day = toWorkingDay(first, 1, off);
  for (let i = 1; i < n; i += 1) day = toWorkingDay(addDays(day, 1), 1, off);
  return day;
}
