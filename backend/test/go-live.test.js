/**
 * Go-live readiness: reference-only seed in production, SEED_SAMPLE_DATA, the purge script, scheduler
 * advisory locks and SCHEDULER_ENABLED, and GET /api/health readiness.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed, seedFiles, seedSampleData } from '../src/db/seed.js';
import { pool, query } from '../src/db/pool.js';
import { createApp } from '../src/app.js';
import { setReady } from '../src/lib/health.js';
import { runJob, schedulerEnabled, startScheduler, stopScheduler } from '../src/jobs/scheduler.js';
import { purgeSampleData, parseArgs, SAMPLE_USERS } from '../scripts/purge-sample-data.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const count = async (t, where = 'true') => (await query(`SELECT count(*)::int AS n FROM ${t} WHERE ${where}`)).rows[0].n;
const TRANSACTIONS = ['leads', 'clients', 'quotes', 'policies', 'endorsements', 'receivables', 'receipts', 'claims', 'renewals', 'remittances',
  'journal_vouchers', 'journal_lines', 'commissions', 'disbursements', 'cessions', 'reinsurance_treaties', 'incentive_calculations', 'collection_items'];

async function snapshot() {
  const tables = (await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.tablename);
  const out = {};
  for (const t of tables) out[t] = await count(`"${t}"`);
  return out;
}
const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

describe('SEED_SAMPLE_DATA', () => {
  it('defaults to on in development / test and off in production; an explicit value wins', () => {
    expect(seedSampleData({})).toBe(true);
    expect(seedSampleData({ NODE_ENV: 'test' })).toBe(true);
    expect(seedSampleData({ NODE_ENV: 'development' })).toBe(true);
    expect(seedSampleData({ NODE_ENV: 'production' })).toBe(false);
    expect(seedSampleData({ NODE_ENV: 'production', SEED_SAMPLE_DATA: 'true' })).toBe(true);
    expect(seedSampleData({ NODE_ENV: 'production', SEED_SAMPLE_DATA: '1' })).toBe(true);
    expect(seedSampleData({ NODE_ENV: 'development', SEED_SAMPLE_DATA: 'false' })).toBe(false);
    expect(seedSampleData({ NODE_ENV: 'test', SEED_SAMPLE_DATA: 'off' })).toBe(false);
    expect(seedSampleData({ NODE_ENV: 'production', SEED_SAMPLE_DATA: '' })).toBe(false);
  });

  it('lists reference files only without sample data, and interleaves sample files after their reference file', () => {
    const ref = seedFiles({ sample: false });
    expect(ref.every((f) => f.kind === 'reference')).toBe(true);
    expect(ref.map((f) => f.name)).toContain('60_reports.sql');
    const all = seedFiles({ sample: true }).map((f) => f.name);
    expect(all).toContain('sample/20_sales.sql');
    expect(all.indexOf('20_sales.sql')).toBe(all.indexOf('sample/20_sales.sql') - 1);
    expect(all.indexOf('sample/31_claims_renewals_base.sql')).toBeGreaterThan(all.indexOf('30_claims_renewals_settings.sql'));
    expect(all.indexOf('sample/31_claims_renewals_base.sql')).toBeLessThan(all.indexOf('40_finance.sql'));
  });
});

describe('production start on a fresh database', () => {
  let reference;
  let app;
  let adminToken;
  beforeAll(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });
  afterAll(() => setReady(true));

  it('the API starts with NODE_ENV=production, seeds reference data only and answers the health check', async () => {
    const port = await freePort();
    const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-golive-'));
    const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), LOG_LEVEL: 'info', UPLOAD_DIR: uploads, SCHEDULER_ENABLED: 'false',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'), DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
      CORS_ORIGINS: 'https://brokerverse.example.ph', PUBLIC_BASE_URL: 'https://api.brokerverse.example.ph' };
    delete env.SEED_SAMPLE_DATA;
    delete env.VITEST;
    const child = spawn(process.execPath, ['src/server.js'], { cwd: backend, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    child.stdout.on('data', (d) => { logs += d; });
    child.stderr.on('data', (d) => { logs += d; });
    const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
    try {
      let health;
      for (let i = 0; i < 150 && child.exitCode === null; i += 1) {
        health = await fetch(`http://127.0.0.1:${port}/api/health`).then(async (r) => ({ status: r.status, body: await r.json() })).catch(() => null);
        if (health?.status === 200) break;
        await new Promise((r) => { setTimeout(r, 200); });
      }
      expect(health?.status, logs).toBe(200);
      expect(health.body).toMatchObject({ status: 'ok', ready: true, database: { reachable: true }, pendingMigrations: 0 });
      expect(logs).toContain('reference data only');
      expect(logs).toContain('scheduler: disabled');
      expect(logs).not.toContain('seeded sample/');
    } finally {
      child.kill('SIGTERM');
      expect(await exited).toBe(0);
      fs.rmSync(uploads, { recursive: true, force: true });
    }
  }, 60000);

  it('the database holds reference data and the administrator, and no demo transactions', async () => {
    for (const t of TRANSACTIONS) expect(await count(t), t).toBe(0);
    for (const t of ['reinsurers', 'incentive_programs', 'commission_referrers', 'signatories', 'petty_cash_funds', 'checkbooks']) expect(await count(t), t).toBe(0);
    expect(await count('users')).toBe(1);
    expect(await count('users', "username = 'BrokerVerse'")).toBe(1);
    expect(await count('users', `username = ANY('{${SAMPLE_USERS.join(',')}}')`)).toBe(0);
    expect(await count('insurance_companies', "code IN ('SECUREGUARD','APEX')")).toBe(0);
    expect(await count('master_records', "type_code IN ('employee','bank-account')")).toBe(0);
    // the only company is the OOTB letterhead company (reference data)
    expect(await count('master_records', "type_code = 'company'")).toBe(1);
    expect(await count('master_records', "type_code = 'company' AND code = 'ITX' AND data->>'IsPrimary' = 'true'")).toBe(1);
    // reference data
    expect(await count('report_definitions')).toBeGreaterThan(10);
    expect(await count('app_settings')).toBeGreaterThan(100);
    expect(await count('app_settings', "key = 'numbering.policy.prefix'")).toBe(1);
    expect(await count('roles')).toBe(8); // system-admin, the six broker roles and the compliance officer (AML/CFT)
    expect(await count('scheduled_jobs')).toBeGreaterThan(0);
    expect(await count('gl_accounts')).toBeGreaterThan(50);
    expect(await count('product_templates')).toBeGreaterThan(0);
    expect(await count('insurance_companies')).toBeGreaterThan(0);
    expect(await count('cities')).toBeGreaterThan(20);
    expect(await count('vehicle_models')).toBeGreaterThan(0);
    expect(await count('master_records', "type_code = 'taxation'")).toBeGreaterThan(0);
    expect(await count('branches', "code = 'HO'")).toBe(1);
    reference = await snapshot();
  });

  it('a second production seed is idempotent', async () => {
    const env = { NODE_ENV: process.env.NODE_ENV, SEED_SAMPLE_DATA: process.env.SEED_SAMPLE_DATA };
    process.env.NODE_ENV = 'production';
    delete process.env.SEED_SAMPLE_DATA;
    try {
      const r = await seed({ log: () => {} });
      expect(r.sampleData).toBe(false);
    } finally {
      for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
    expect(await snapshot()).toEqual(reference);
  });

  it('the application works on the reference-only database', async () => {
    app = await createApp();
    const login = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    adminToken = login.body.accessToken;
    const leads = await request(app).get('/api/leads').set('Authorization', `Bearer ${adminToken}`);
    expect(leads.status).toBe(200);
    expect(await count('leads')).toBe(0);
    const reports = await request(app).get('/api/system-settings').set('Authorization', `Bearer ${adminToken}`);
    expect(reports.status).toBe(200);
  });

  it('GET /api/health reports database connectivity and readiness; 503 while starting or when the database is down', async () => {
    const ok = await request(app).get('/api/health');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'ok', ready: true, database: { reachable: true, latencyMs: expect.any(Number) }, pendingMigrations: 0 });
    expect(ok.headers['cache-control']).toBe('no-store');
    setReady(false);
    const starting = await request(app).get('/api/health');
    expect(starting.status).toBe(503);
    expect(starting.body).toMatchObject({ status: 'starting', ready: false, database: { reachable: true } });
    setReady(true);
    const real = pool.query.bind(pool);
    const spy = vi.spyOn(pool, 'query').mockImplementation((text, ...rest) => (text === 'SELECT 1'
      ? Promise.reject(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })) : real(text, ...rest)));
    try {
      const down = await request(app).get('/api/health');
      expect(down.status).toBe(503);
      expect(down.body).toMatchObject({ status: 'unavailable', ready: false, database: { reachable: false, error: 'ECONNREFUSED' } });
      // liveness does not depend on the database
      const live = await request(app).get('/api/health/live');
      expect(live.status).toBe(200);
      expect(live.body.status).toBe('ok');
    } finally {
      spy.mockRestore();
    }
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('the purge script removes demo data seeded on top and leaves exactly the reference data', async () => {
    const base = await snapshot();
    await seed({ log: () => {}, sampleData: true });
    for (const t of ['leads', 'policies', 'claims', 'receipts', 'remittances', 'journal_vouchers']) expect(await count(t), t).toBeGreaterThan(0);
    expect(await count('users')).toBe(1 + SAMPLE_USERS.length);

    const client = await pool.connect();
    try {
      const before = await snapshot();
      const dry = await purgeSampleData(client, {});
      expect(dry.executed).toBe(false);
      const byTable = Object.fromEntries(dry.tables.map((t) => [t.table, t.rows]));
      expect(byTable.leads).toBe(before.leads);
      expect(byTable.policies).toBe(before.policies);
      expect(byTable.users).toBe(SAMPLE_USERS.length);
      expect(byTable.reinsurers).toBe(6);
      expect(dry.total).toBeGreaterThan(100);
      expect(await snapshot()).toEqual(before); // dry run changes nothing

      const done = await purgeSampleData(client, { execute: true });
      expect(done.executed).toBe(true);
      expect(done.users.remove.sort()).toEqual([...SAMPLE_USERS].sort());
    } finally {
      client.release();
    }
    const after = await snapshot();
    expect(after.audit_log).toBe(base.audit_log + 1); // the purge is recorded
    expect({ ...after, audit_log: 0 }).toEqual({ ...base, audit_log: 0 });
    const entry = (await query("SELECT after_data FROM audit_log WHERE entity = 'database' AND action = 'purge'")).rows[0].after_data;
    expect(entry.removedUsers.length).toBe(SAMPLE_USERS.length);
    // the application still works: sign-in and a new lead
    const login = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('the purge keeps only the users chosen with --keep-users and rolls back on error', async () => {
    await query(`INSERT INTO users(username, password_hash, display_name, status, created_by) VALUES
      ('ops.keep', 'x', 'Kept user', 'active', 'test'), ('ops.drop', 'x', 'Dropped user', 'active', 'test')`);
    const client = await pool.connect();
    try {
      const r = await purgeSampleData(client, { execute: true, keepUsers: ['ops.keep', 'nobody'], purgeAudit: true, log: () => {} });
      expect(r.users.remove).toEqual(['ops.drop']);
      const names = (await query('SELECT username FROM users ORDER BY 1')).rows.map((u) => u.username);
      expect(names).toEqual(['BrokerVerse', 'ops.keep']);
      expect(await count('audit_log')).toBe(1); // audit emptied, then the purge recorded
      // one transaction: a failure rolls everything back
      await query("INSERT INTO sequences(name, period, value) VALUES ('purge-test', '2026', 7)");
      const bad = { query: (text, params) => (/^DELETE FROM "branches"/.test(text) ? Promise.reject(new Error('boom')) : client.query(text, params)) };
      await expect(purgeSampleData(bad, { execute: true })).rejects.toThrow('boom');
      expect(await count('sequences', "name = 'purge-test'")).toBe(1);
      await query("DELETE FROM sequences WHERE name = 'purge-test'");
    } finally {
      client.release();
    }
    expect(parseArgs([])).toMatchObject({ execute: false });
    expect(parseArgs(['--execute', '--keep-users=a, b'])).toMatchObject({ execute: true, keepUsers: ['a', 'b'] });
    expect(() => parseArgs(['--force'])).toThrow('unknown option');
  });

  it('the purge command refuses to run without CONFIRM_PURGE=yes and is a dry run by default', async () => {
    const run = (env, args = []) => new Promise((resolve) => {
      const e = { ...process.env, ...env };
      if (!('CONFIRM_PURGE' in env)) delete e.CONFIRM_PURGE;
      const c = spawn(process.execPath, ['scripts/purge-sample-data.js', ...args], { cwd: backend, env: e });
      let out = '';
      c.stdout.on('data', (d) => { out += d; });
      c.stderr.on('data', (d) => { out += d; });
      c.on('exit', (code) => resolve({ code, out }));
    });
    const refused = await run({});
    expect(refused.code).toBe(2);
    expect(refused.out).toContain('CONFIRM_PURGE=yes');
    expect((await run({ CONFIRM_PURGE: 'no' })).code).toBe(2);
    await seed({ log: () => {}, sampleData: true });
    const leads = await count('leads');
    const dry = await run({ CONFIRM_PURGE: 'yes' });
    expect(dry.code, dry.out).toBe(0);
    expect(dry.out).toContain('DRY RUN');
    expect(dry.out).toMatch(/leads\s+\d+/);
    expect(await count('leads')).toBe(leads);
    const exec = await run({ CONFIRM_PURGE: 'yes' }, ['--execute']);
    expect(exec.code, exec.out).toBe(0);
    expect(exec.out).toContain('Purged');
    expect(await count('leads')).toBe(0);
  }, 60000);
});

describe('scheduler: SCHEDULER_ENABLED and one run per job across instances', () => {
  let job;
  beforeAll(async () => {
    await migrate({ log: () => {} });
    await seed({ log: () => {}, sampleData: false });
    job = (await query("SELECT * FROM scheduled_jobs WHERE code = 'receivable-ageing'")).rows[0];
  });
  afterAll(() => { stopScheduler(); delete process.env.SCHEDULER_ENABLED; });
  const runs = async () => count('job_runs', `job_id = ${job.id}`);

  it('SCHEDULER_ENABLED defaults to true; false schedules nothing', async () => {
    expect(schedulerEnabled({})).toBe(true);
    expect(schedulerEnabled({ SCHEDULER_ENABLED: 'true' })).toBe(true);
    expect(schedulerEnabled({ SCHEDULER_ENABLED: 'false' })).toBe(false);
    expect(schedulerEnabled({ SCHEDULER_ENABLED: '0' })).toBe(false);
    process.env.SCHEDULER_ENABLED = 'false';
    const logs = [];
    expect(await startScheduler({ info: (m) => logs.push(m) })).toBe(0);
    expect(logs.join()).toContain('disabled');
    process.env.SCHEDULER_ENABLED = 'true';
    expect(await startScheduler({ info: () => {}, warn: () => {} })).toBeGreaterThan(0);
    stopScheduler();
  });

  it('skips a run while another instance holds the job advisory lock', async () => {
    const other = await pool.connect(); // stands for a second API instance
    try {
      const got = await other.query("SELECT pg_try_advisory_lock(hashtext('brokerverse.scheduled_job'), hashtext($1)) AS locked", [job.code]);
      expect(got.rows[0].locked).toBe(true);
      const before = await runs();
      const r = await runJob(job, 'schedule');
      expect(r.status).toBe('skipped');
      expect(r.reason).toContain('already running');
      expect((await runJob(job, 'BrokerVerse')).status).toBe('skipped'); // "Run now" too
      expect(await runs()).toBe(before);
      await other.query("SELECT pg_advisory_unlock(hashtext('brokerverse.scheduled_job'), hashtext($1))", [job.code]);
    } finally {
      other.release();
    }
    const r = await runJob(job, 'schedule');
    expect(r.status).toBe('success');
    const locks = await query(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND granted
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`);
    expect(locks.rows[0].n).toBe(0); // released after the run
  });

  it('runs a scheduled slot once when several instances fire it at the same time', async () => {
    await query('DELETE FROM job_runs WHERE job_id = $1', [job.id]);
    const firedAt = new Date();
    const before = await runs();
    const results = await Promise.all([1, 2, 3].map(() => runJob(job, 'schedule', { firedAt })));
    expect(results.filter((r) => r.status === 'success')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'skipped')).toHaveLength(2);
    // a late instance firing the same slot after the run finished also skips
    const late = await runJob(job, 'schedule', { firedAt });
    expect(late).toMatchObject({ status: 'skipped' });
    expect(await runs()).toBe(before + 1);
    // a manual run is not a schedule slot
    expect((await runJob(job, 'BrokerVerse')).status).toBe('success');
  });
});
