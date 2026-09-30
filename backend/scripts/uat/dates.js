/** Date helpers (ISO YYYY-MM-DD strings, UTC arithmetic) and the business timeline of the scenario. */

export const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const addMonths = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return x.toISOString().slice(0, 10);
};
export const monthStart = (d) => `${d.slice(0, 7)}-01`;
export const monthEnd = (d) => addDays(addMonths(monthStart(d), 1), -1);
export const minDate = (...ds) => ds.filter(Boolean).sort()[0];
export const maxDate = (...ds) => ds.filter(Boolean).sort().at(-1);
export const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

/** Today's date in a time zone. */
export function todayIn(timeZone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * The months of the scenario: the last `count` calendar months ending with the current one. Each month has its
 * first and last business day (the current month ends today).
 */
export function timeline(today, count) {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = addMonths(monthStart(today), -i);
    const end = i === 0 ? today : monthEnd(start);
    months.push({ period: start.slice(0, 7), start, end, current: i === 0 });
  }
  return months;
}

/** A random date within [from, to] (both included). */
export const dateBetween = (rnd, from, to) => addDays(from, rnd.int(0, Math.max(0, daysBetween(from, to))));
