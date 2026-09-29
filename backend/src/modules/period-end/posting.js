/**
 * Posting rules of the fiscal calendar, used by the ledger engine (assertPeriodOpen) for every journal it posts:
 *   open         anyone with posting rights may post
 *   soft_closed  only finance managers (approve:period-end) may post
 *   closed       nobody posts (reopen the period first)
 *   locked       fiscal year closed by the year-end close; only a year-end reversal unlocks it
 * The period is the journal's adjustment period (yyyy-13) when it carries one, else the calendar month of its date.
 * A date before the first fiscal year is refused once a later fiscal year has been closed.
 */
import { conflict } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';

export const APPROVE = 'approve:period-end';
export const isAdjustmentPeriod = (p) => /^\d{4}-13$/.test(String(p || ''));
export const monthOf = (date) => String(date).slice(0, 7);
export const effectivePeriod = (date, period) => (isAdjustmentPeriod(period) ? period : monthOf(date));
export const mayPostSoftClosed = (user) => !!user && hasPermission(user, APPROVE);

export async function assertPostingAllowed(db, date, user = null, period = null) {
  const code = effectivePeriod(date, period);
  const r = (await db.query('SELECT status, fiscal_year FROM accounting_periods WHERE period = $1', [code])).rows[0];
  if (!r) {
    const later = (await db.query('SELECT code FROM fiscal_years WHERE status = \'closed\' AND start_date > $1::date ORDER BY start_date LIMIT 1', [String(date).slice(0, 10)])).rows[0];
    if (later) throw conflict(`Accounting period ${code} falls before fiscal year ${later.code}, which is closed`);
    return;
  }
  if (r.status === 'open') return;
  if (r.status === 'soft_closed') {
    if (mayPostSoftClosed(user)) return;
    throw conflict(`Accounting period ${code} is soft-closed; only finance managers (${APPROVE}) may post into it`);
  }
  if (r.status === 'locked') throw conflict(`Accounting period ${code} is locked (fiscal year ${r.fiscal_year || ''} is closed)`.replace(' ()', ''));
  throw conflict(`Accounting period ${code} is closed`);
}
