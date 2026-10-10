/**
 * Scheduled jobs of period-end processing (registered in scheduled_jobs by migration 0135, disabled by default):
 *   month-end-reminder      notify finance N days (params.daysBefore) before the current period ends, and about ended
 *                           periods still open
 *   recurring-journals      post recurring journal templates whose next run date has arrived
 *   accrual-reversal        post the auto-reversals due (accruals, commission deferral, FX revaluation)
 *   period-auto-soft-close  soft-close regular periods after the finance adjustment window (the first
 *                           accounting.adjustment_window_working_days working days of the next month), or params.graceDays
 *                           after their end when the window is 0, when no blocking check fails
 * With accounting.finance_close_day the reminder counts down to that day of the month instead of the period end.
 */
import { withTransaction } from '../../db/pool.js';
import { DAY_MS, addDays, today } from '../../lib/dates.js';
import { getSetting } from '../../lib/settings.js';
import { nthWorkingDay } from '../../lib/workingDays.js';
import { formatDate } from '../../lib/pdf/format.js';
import { applyStatus, ensureCalendar, iso } from './fiscal.js';
import { blockingFailures } from './checks.js';
import { generateDue, reverseDue } from './journals.js';

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** The finance close date of a period: accounting.finance_close_day of its month (capped at its end), else its end. */
export async function financeCloseDate(period) {
  const end = iso(period.end_date);
  const day = Number(await getSetting('accounting.finance_close_day', 0)) || 0;
  if (!day) return end;
  const date = `${end.slice(0, 7)}-${String(day).padStart(2, '0')}`;
  return date < end ? date : end;
}

/** The last day Finance may post into a period before the job soft-closes it. */
export async function adjustmentDeadline(period, graceDays) {
  const end = iso(period.end_date);
  const window = Number(await getSetting('accounting.adjustment_window_working_days', 0)) || 0;
  if (!window) return addDays(end, graceDays);
  return nthWorkingDay(addDays(end, 1).slice(0, 7), window);
}

async function notify(db, { title, message, period }) {
  const exists = (await db.query('SELECT 1 FROM notifications WHERE entity = \'accounting_period\' AND entity_id = $1 AND title = $2', [period, title])).rows[0];
  if (exists) return 0;
  await db.query(`INSERT INTO notifications(user_id, type, priority, title, message, link, entity, entity_id, audience)
    VALUES (NULL, 'reminder', 'high', $1, $2, '/accounts/period-end/close', 'accounting_period', $3, 'write:period-end')`, [title, message, period]);
  return 1;
}

export async function monthEndReminder(params = {}) {
  const daysBefore = Number(params.daysBefore ?? 3);
  const now = await today();
  return withTransaction(async (db) => {
    await ensureCalendar(db);
    let notified = 0;
    const current = (await db.query('SELECT * FROM accounting_periods WHERE NOT is_adjustment AND $1::date BETWEEN start_date AND end_date', [now])).rows[0];
    if (current) {
      const closeOn = await financeCloseDate(current);
      const left = daysBetween(now, closeOn);
      if (left >= 0 && left <= daysBefore) {
        notified += await notify(db, { period: current.period, title: `Month-end close: ${current.period} closes in ${left} day(s)`,
          message: `Accounting period ${current.period} closes on ${formatDate(closeOn)}. Post pending journals and prepare the month-end close run.` });
      }
    }
    const ended = (await db.query('SELECT * FROM accounting_periods WHERE NOT is_adjustment AND status = \'open\' AND end_date < $1 ORDER BY period', [now])).rows;
    for (const p of ended) {
      notified += await notify(db, { period: p.period, title: `Month-end close: ${p.period} is still open`, message: `Accounting period ${p.period} ended on ${iso(p.end_date)} and is not closed yet.` });
    }
    return { notified, currentPeriod: current?.period || null, openEndedPeriods: ended.map((p) => p.period) };
  });
}

export async function recurringJournals() {
  const now = await today();
  return withTransaction(async (db) => {
    const r = await generateDue(db, { kind: 'recurring', asOf: now });
    return { posted: r.created.length, journals: r.created.map((c) => c.jvNumber), errors: r.errors };
  });
}

export async function accrualReversal() {
  const now = await today();
  return withTransaction(async (db) => {
    const r = await reverseDue(db, { asOf: now });
    return { reversed: r.reversed.length, journals: r.reversed.map((x) => x.reversalNumber), errors: r.errors };
  });
}

export async function periodAutoSoftClose(params = {}) {
  const grace = Number(params.graceDays ?? 5);
  const now = await today();
  return withTransaction(async (db) => {
    await ensureCalendar(db);
    const ended = (await db.query('SELECT * FROM accounting_periods WHERE NOT is_adjustment AND status = \'open\' AND end_date < $1::date ORDER BY period', [now])).rows;
    const softClosed = []; const skipped = [];
    for (const p of ended) {
      const deadline = await adjustmentDeadline(p, grace);
      if (deadline >= now) continue;
      const failed = await blockingFailures(db, p);
      if (failed.length) { skipped.push({ period: p.period, reasons: failed.map((f) => f.message) }); continue; }
      await applyStatus(db, p, 'soft_closed', { remarks: `Soft-closed automatically after the adjustment window ended on ${formatDate(deadline)}`, source: 'job' });
      softClosed.push(p.period);
    }
    return { softClosed, skipped };
  });
}
