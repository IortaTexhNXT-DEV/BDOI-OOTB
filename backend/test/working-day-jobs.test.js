/**
 * Reminders on working days (migration 0661; TIS-BRD-MAS-08, NOTIF-02, GAP-PLAT-06): a scheduled run of a job of
 * calendar.working_days_only_jobs waits for a working day (working week and the Holiday master); "Run now" and the
 * jobs not listed run every day.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool, one, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { nonWorkingDayHold } from '../src/lib/workingCalendar.js';
import { runJob } from '../src/jobs/scheduler.js';

// noon in Manila on a Saturday, a Monday holiday and a Tuesday
const SATURDAY = new Date('2026-11-28T04:00:00Z');
const HOLIDAY = new Date('2026-11-30T04:00:00Z');
const TUESDAY = new Date('2026-12-01T04:00:00Z');
const runs = async (code) => (await one('SELECT count(*)::int AS n FROM job_runs r JOIN scheduled_jobs j ON j.id = r.job_id WHERE j.code = $1', [code])).n;

beforeAll(async () => {
  await setup();
  await query(`INSERT INTO master_records(type_code, code, name, data, status, created_by)
    SELECT 'holiday', '2026-11-30-TEST', 'Bonifacio Day (test)', '{"date": "2026-11-30", "holidayType": "Regular Holiday", "scope": "National"}'::jsonb, 'active', 'test'
    WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'holiday' AND data->>'date' = '2026-11-30')`);
});
afterAll(async () => { await pool.end(); });

describe('working-day jobs', () => {
  it('holds a listed reminder on a weekend day and a national holiday, not on a working day', async () => {
    expect(await nonWorkingDayHold('collection-reminders', SATURDAY)).toMatch(/2026-11-28 is not a working day/);
    expect(await nonWorkingDayHold('quote-expiry-reminder', HOLIDAY)).toMatch(/2026-11-30 is not a working day/);
    expect(await nonWorkingDayHold('collection-reminders', TUESDAY)).toBeNull();
    // a job that is not a reminder runs every day
    expect(await nonWorkingDayHold('housekeeping', SATURDAY)).toBeNull();
  });

  it('a scheduled run waits and records nothing; Run now still runs; the list is a setting', async () => {
    const job = await one("SELECT * FROM scheduled_jobs WHERE code = 'pdc-deposit-due'");
    const before = await runs('pdc-deposit-due');
    const held = await runJob(job, 'schedule', { firedAt: SATURDAY });
    expect(held).toMatchObject({ status: 'skipped' });
    expect(held.reason).toMatch(/waits for the next working day/);
    expect(await runs('pdc-deposit-due')).toBe(before);
    expect((await runJob(job, 'manual')).status).toBe('success');
    expect(await runs('pdc-deposit-due')).toBe(before + 1);
    // taken off the list, the job runs on the weekend as well
    await query("UPDATE app_settings SET value = '[\"collection-reminders\"]'::jsonb WHERE key = 'calendar.working_days_only_jobs'");
    clearSettingsCache();
    expect(await nonWorkingDayHold('pdc-deposit-due', SATURDAY)).toBeNull();
  });
});
