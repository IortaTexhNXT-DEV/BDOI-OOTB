/**
 * Operations follow-ups: scheduler in the business time zone and business dates in jobs, housekeeping retention,
 * settings / schedules picked up across API instances, and the migration advisory lock.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setup } from './helpers.js';
import { one, pool, query } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { clearSettingsCache, getSetting, refreshSettingsCache, setSetting } from '../src/lib/settings.js';
import { nextRunOf, reloadIfChanged, schedulerTimeZone, startScheduler, stopScheduler } from '../src/jobs/scheduler.js';
import * as handlers from '../src/jobs/handlers.js';
import { AUDIT_MIN_DAYS, housekeeping } from '../src/jobs/housekeeping.js';

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(() => stopScheduler());
afterEach(() => { vi.useRealTimers(); clearSettingsCache(); });

const manilaHour = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

describe('scheduler time zone and business dates in jobs', () => {
  it('schedules every job in general.timezone (06:00 Manila, not 06:00 UTC) and shows the zone', async () => {
    expect(await startScheduler({ info: () => {}, warn: () => {} })).toBeGreaterThan(0);
    expect(await schedulerTimeZone()).toBe('Asia/Manila');
    const next = nextRunOf('renewal-notices');
    expect(next).toBeInstanceOf(Date);
    expect(manilaHour(next)).toBe('06:00');
    expect(next.getUTCHours()).toBe(22);
    const r = await ctx.api('get', '/schedules');
    expect(r.body.timeZone).toBe('Asia/Manila');
    const job = r.body.data.find((j) => j.code === 'renewal-notices');
    expect(job).toMatchObject({ timeZone: 'Asia/Manila', cron: '0 6 * * *' });
    expect(new Date(job.nextRunAt).getTime()).toBe(next.getTime());
    stopScheduler();
  });

  it('uses the Manila business date, not the database current_date, in the expiry and renewal-notice jobs', async () => {
    // 2026-03-01 20:00 UTC = 2026-03-02 04:00 in Manila
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T20:00:00Z'));
    const p = await one("SELECT id FROM policies WHERE status IN ('active', 'issued') ORDER BY id LIMIT 1");
    const q = await one("SELECT id FROM policies WHERE status IN ('active', 'issued') AND id <> $1 ORDER BY id LIMIT 1", [p.id]);
    await query("UPDATE policies SET status = 'active', expiry_date = '2026-04-01' WHERE id = $1", [p.id]); // Manila today + 30
    await query("UPDATE policies SET status = 'active', expiry_date = '2026-03-01' WHERE id = $1", [q.id]); // ended yesterday in Manila
    await query("DELETE FROM notifications WHERE entity = 'policy' AND entity_id = $1", [p.id]);
    const out = await handlers.renewalNotices();
    expect(out.notifications).toBeGreaterThanOrEqual(1);
    expect(await one("SELECT title FROM notifications WHERE entity = 'policy' AND entity_id = $1", [p.id])).toMatchObject({ title: 'Renewal due in 30 days' });
    await handlers.policyExpiry();
    expect((await one('SELECT status FROM policies WHERE id = $1', [q.id])).status).toBe('expired');
    // expiring 2026-04-01 is still in force on 2026-03-02 (the database's current_date is months later)
    expect((await one('SELECT status FROM policies WHERE id = $1', [p.id])).status).toBe('active');
  });

  it('defaults business-date columns to the Manila date (numbering_business_date)', async () => {
    const d = await one("SELECT column_default FROM information_schema.columns WHERE table_name = 'journal_vouchers' AND column_name = 'jv_date'");
    expect(d.column_default).toContain('numbering_business_date');
  });
});

describe('housekeeping', () => {
  it('is a seeded, enabled daily job', async () => {
    const j = await one("SELECT * FROM scheduled_jobs WHERE code = 'housekeeping'");
    expect(j).toMatchObject({ handler: 'housekeeping', enabled: true });
    expect(await getSetting('housekeeping.audit_log_days')).toBe(0);
  });

  it('purges rows past their retention and keeps recent, unresolved and audit rows', async () => {
    const job = await one("SELECT id FROM scheduled_jobs WHERE code = 'housekeeping'");
    const user = await one("SELECT id FROM users WHERE username = 'BrokerVerse'");
    await query('INSERT INTO job_runs(job_id, started_at, triggered_by) VALUES ($1,$2,\'t-old\'), ($1, now(), \'t-new\')', [job.id, daysAgo(91)]);
    await query(`INSERT INTO email_outbox(to_address, subject, body_html, status, sent_at, created_at) VALUES
      ('hk-old-sent@x.ph','s','b','sent',$1,$1), ('hk-new-sent@x.ph','s','b','sent',now(),now()),
      ('hk-failed@x.ph','s','b','failed',NULL,$1), ('hk-old-failed@x.ph','s','b','failed',NULL,$2), ('hk-queued@x.ph','s','b','queued',NULL,$2)`, [daysAgo(181), daysAgo(731)]);
    await query("INSERT INTO login_history(at, username, success) VALUES ($1,'hk-old',true), (now(),'hk-new',true)", [daysAgo(366)]);
    await query(`INSERT INTO refresh_tokens(jti, user_id, expires_at, revoked_at) VALUES ('hk-expired',$1,$2,NULL), ('hk-revoked',$1,now() + interval '1 day',$2),
      ('hk-live',$1,now() + interval '1 day',NULL), ('hk-recent-expired',$1,now() - interval '1 day',NULL)`, [user.id, daysAgo(31)]);
    await query(`INSERT INTO password_resets(user_id, code_hash, expires_at, used_at) VALUES ($1,'hk-old-used',now(),$2), ($1,'hk-old-expired',$2,NULL), ($1,'hk-open',now() + interval '1 hour',NULL)`, [user.id, daysAgo(8)]);
    await query(`INSERT INTO notifications(id, user_id, type, title, message, is_read, read_at, created_at) VALUES ('hk-read',$1,'info','t','m',true,$2,$2), ('hk-unread',$1,'info','t','m',false,NULL,$2),
      ('hk-read-new',$1,'info','t','m',true,now(),now())`, [user.id, daysAgo(181)]);
    await query("INSERT INTO job_queue(queue, job_type, status, finished_at, created_at) VALUES ('hk','t','completed',$1,$1), ('hk','t','failed',$1,$1), ('hk','t','completed',now(),now())", [daysAgo(31)]);
    await query("INSERT INTO audit_log(at, username, entity, action) VALUES ($1,'hk','test','old')", [daysAgo(AUDIT_MIN_DAYS + 10)]);

    const out = await housekeeping();
    expect(out.kept).toContain('audit_log');
    const left = async (sql, p = []) => (await query(sql, p)).rows.map((r) => r.k).sort();
    expect(await left("SELECT triggered_by AS k FROM job_runs WHERE triggered_by LIKE 't-%'")).toEqual(['t-new']);
    expect(await left("SELECT to_address AS k FROM email_outbox WHERE to_address LIKE 'hk-%'")).toEqual(['hk-failed@x.ph', 'hk-new-sent@x.ph', 'hk-queued@x.ph']);
    expect(await left("SELECT username AS k FROM login_history WHERE username LIKE 'hk-%'")).toEqual(['hk-new']);
    expect(await left("SELECT jti AS k FROM refresh_tokens WHERE jti LIKE 'hk-%'")).toEqual(['hk-live', 'hk-recent-expired']);
    expect(await left("SELECT code_hash AS k FROM password_resets WHERE code_hash LIKE 'hk-%'")).toEqual(['hk-open']);
    expect(await left("SELECT id AS k FROM notifications WHERE id LIKE 'hk-%'")).toEqual(['hk-read-new', 'hk-unread']);
    expect(await left("SELECT status AS k FROM job_queue WHERE queue = 'hk'")).toEqual(['completed', 'failed']);
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE username = 'hk'")).n).toBe(1);
    expect(out.deleted).toMatchObject({ job_runs: 1, email_outbox: 1, email_outbox_failed: 1, login_history: 1, refresh_tokens: 2, password_resets: 2, notifications: 1, job_queue: 1 });
  });

  it('keeps a table forever at 0 days and never purges the audit trail below 7 years', async () => {
    await setSetting('housekeeping.login_history_days', 0);
    await setSetting('housekeeping.audit_log_days', 30);
    await query("INSERT INTO login_history(at, username, success) VALUES ($1,'hk-keep',true)", [daysAgo(4000)]);
    await query("INSERT INTO audit_log(at, username, entity, action) VALUES ($1,'hk2','test','recent'), ($2,'hk2','test','ancient')", [daysAgo(400), daysAgo(AUDIT_MIN_DAYS + 30)]);
    const out = await housekeeping();
    expect(out.kept).toContain('login_history');
    expect((await one("SELECT count(*)::int AS n FROM login_history WHERE username = 'hk-keep'")).n).toBe(1);
    expect((await query("SELECT action FROM audit_log WHERE username = 'hk2'")).rows.map((r) => r.action)).toEqual(['recent']);
    await setSetting('housekeeping.login_history_days', 365);
    await setSetting('housekeeping.audit_log_days', 0);
  });

  it('runs through the scheduler under the job advisory lock', async () => {
    const r = await ctx.api('post', '/schedules/housekeeping/run');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('success');
  });
});

describe('settings and schedules across API instances', () => {
  it('picks up a setting changed by another instance at the next version check', async () => {
    clearSettingsCache();
    expect(await getSetting('general.system_name')).toBeTruthy();
    const before = await getSetting('general.system_name');
    // another instance saves the setting (this instance's cache is not told)
    await query("UPDATE app_settings SET value = '\"Other Instance\"', updated_at = now() + interval '1 second' WHERE key = 'general.system_name'");
    expect(await getSetting('general.system_name')).toBe(before); // still cached within SETTINGS_CHECK_MS
    expect(await refreshSettingsCache({ force: true })).toBe(true);
    expect(await getSetting('general.system_name')).toBe('Other Instance');
    expect(await refreshSettingsCache({ force: true })).toBe(false);
    await setSetting('general.system_name', before);
  });

  it('re-checks automatically after SETTINGS_CHECK_MS', async () => {
    process.env.SETTINGS_CHECK_MS = '0';
    try {
      await getSetting('general.system_name');
      await query("UPDATE app_settings SET value = '\"Auto Refresh\"', updated_at = now() + interval '2 second' WHERE key = 'general.system_name'");
      expect(await getSetting('general.system_name')).toBe('Auto Refresh');
    } finally {
      delete process.env.SETTINGS_CHECK_MS;
    }
  });

  it('reloads the schedules when another instance changed the jobs table', async () => {
    await startScheduler({ info: () => {}, warn: () => {} });
    expect(await reloadIfChanged({ info: () => {} })).toBe(false);
    await query("UPDATE scheduled_jobs SET cron = '0 9 * * *' WHERE code = 'renewal-notices'");
    expect(await reloadIfChanged({ info: () => {} })).toBe(true);
    expect(manilaHour(nextRunOf('renewal-notices'))).toBe('09:00');
    await query("UPDATE scheduled_jobs SET enabled = false WHERE code = 'renewal-notices'");
    expect(await reloadIfChanged({ info: () => {} })).toBe(true);
    expect(nextRunOf('renewal-notices')).toBeNull();
    await query("UPDATE scheduled_jobs SET cron = '0 6 * * *', enabled = true WHERE code = 'renewal-notices'");
    stopScheduler();
  });
});

describe('migration advisory lock', () => {
  it('applies a pending migration once when two instances migrate at the same time', async () => {
    const name = '0145_business_date_defaults.sql';
    await query('DELETE FROM schema_migrations WHERE name = $1', [name]);
    const logs = [[], []];
    await Promise.all([migrate({ log: (m) => logs[0].push(m) }), migrate({ log: (m) => logs[1].push(m) })]);
    const applied = logs.flat().filter((m) => m === `applied ${name}`);
    expect(applied).toHaveLength(1);
    expect((await one('SELECT count(*)::int AS n FROM schema_migrations WHERE name = $1', [name])).n).toBe(1);
    const locks = await query(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND granted
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`);
    expect(locks.rows[0].n).toBe(0);
  });

  it('waits for the lock held by another instance', async () => {
    const other = await pool.connect();
    try {
      await other.query("SELECT pg_advisory_lock(hashtext('brokerverse.migrate'), hashtext('schema_migrations'))");
      await expect(migrate({ log: () => {}, lockTimeoutMs: 300 })).rejects.toThrow(/lock timeout/i);
    } finally {
      await other.query("SELECT pg_advisory_unlock(hashtext('brokerverse.migrate'), hashtext('schema_migrations'))");
      other.release();
    }
    await migrate({ log: () => {} });
  });
});
