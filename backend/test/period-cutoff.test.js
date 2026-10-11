/**
 * Period cut-off (migration 0523, TIS-BRD-GL-04): premium bookings dated on or after the operations cut-off day (26th)
 * book into the next period and are checked against it; other postings keep the month of their date; the month-end
 * reminder counts down to the finance close day (29th); the auto soft-close waits for the adjustment window (6th
 * working day of the next month, Holiday master).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { EVENTS, postEvent } from '../src/modules/accounting/lib/posting.js';
import { cutoffPeriod } from '../src/modules/period-end/posting.js';
import { adjustmentDeadline, closingCalendar, financeCloseDate } from '../src/modules/period-end/jobs.js';
import { nthWorkingDay } from '../src/lib/workingDays.js';

const setting = async (key, value) => {
  await pool.query('UPDATE app_settings SET value = $2::jsonb WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};
const post = (event, date) => withTransaction((db) => postEvent(event, { ...EVENTS[event].sample, date }, { db }));

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('operations cut-off (26th)', () => {
  it('moves a premium booking dated on or after the 26th to the next period, nothing else', async () => {
    expect(await cutoffPeriod('policy.issue.broker_billed', '2026-10-25')).toBe('2026-10');
    expect(await cutoffPeriod('policy.issue.broker_billed', '2026-10-26')).toBe('2026-11');
    expect(await cutoffPeriod('endorsement.additional_premium', '2026-12-28')).toBe('2027-01');
    expect(await cutoffPeriod('receipt.apply', '2026-10-27')).toBe('2026-10');
    await setting('accounting.operations_cutoff_day', 0);
    expect(await cutoffPeriod('policy.issue.broker_billed', '2026-10-27')).toBe('2026-10');
    await setting('accounting.operations_cutoff_day', 26);
  });

  it('a booking past the cut-off posts into the next period although its calendar month is closed; a receipt does not', async () => {
    await pool.query("INSERT INTO accounting_periods(period, status) VALUES ('2025-03', 'closed'), ('2025-04', 'open') ON CONFLICT (period) DO UPDATE SET status = EXCLUDED.status");
    const jv = await post('policy.issue.broker_billed', '2025-03-28');
    expect(jv).toMatchObject({ period: '2025-04', status: 'posted' });
    await expect(post('receipt.apply', '2025-03-28')).rejects.toMatchObject({ status: 409 });
    await expect(post('policy.issue.broker_billed', '2025-03-20')).rejects.toMatchObject({ status: 409 });
  });
});

describe('finance close (29th) and adjustment window (6 working days)', () => {
  it('the reminder counts down to the 29th; the soft-close waits for the 6th working day of the next month', async () => {
    expect(await financeCloseDate({ end_date: '2026-10-31' })).toBe('2026-10-29');
    expect(await financeCloseDate({ end_date: '2027-02-28' })).toBe('2027-02-28');
    expect(await nthWorkingDay('2026-11', 6)).toBe('2026-11-09');
    expect(await adjustmentDeadline({ end_date: '2026-10-31' }, 5)).toBe('2026-11-09');
    await setting('accounting.adjustment_window_working_days', 0);
    expect(await adjustmentDeadline({ end_date: '2026-10-31' }, 5)).toBe('2026-11-05');
    await setting('accounting.adjustment_window_working_days', 6);
  });
});

describe('closing calendar on Period Management', () => {
  it('shows the operations cut-off, the finance close and the end of the adjustment window of each regular period', async () => {
    expect(await closingCalendar({ end_date: '2026-10-31' })).toEqual({ operationsCutoff: '2026-10-26', financeClose: '2026-10-29', adjustmentWindowEnd: '2026-11-09' });
    const fy = (await ctx.api('get', '/period-end/fiscal-years')).body.data;
    const code = (Array.isArray(fy) ? fy : fy.rows || [])[0]?.code;
    const year = (await ctx.api('get', `/period-end/fiscal-years/${code}`)).body.data;
    const regular = year.periods.find((p) => !p.isAdjustment);
    expect(regular.closing.operationsCutoff).toBe(`${regular.period}-26`);
    expect(regular.closing.financeClose.slice(0, 7)).toBe(regular.period);
    expect(year.periods.find((p) => p.isAdjustment)?.closing ?? null).toBeNull();
  });

  it('leaves out a date its setting switches off', async () => {
    await setting('accounting.operations_cutoff_day', 0);
    await setting('accounting.finance_close_day', 0);
    await setting('accounting.adjustment_window_working_days', 0);
    expect(await closingCalendar({ end_date: '2026-10-31' })).toEqual({ operationsCutoff: null, financeClose: null, adjustmentWindowEnd: null });
    await setting('accounting.operations_cutoff_day', 26);
    await setting('accounting.finance_close_day', 29);
    await setting('accounting.adjustment_window_working_days', 6);
  });
});
