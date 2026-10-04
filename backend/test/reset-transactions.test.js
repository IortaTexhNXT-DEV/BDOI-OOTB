/**
 * Transaction reset (scripts/reset-transactions.js): every table is classified, the go-live lock is honoured, the
 * transactions of a smoke test go while masters, configuration, users and settings stay byte for byte, transaction
 * number series restart, the ledger is empty and every period open, opening balances and files as chosen.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { nextDocumentNumber } from '../src/lib/numbering.js';
import { importOpeningBalances } from '../src/modules/period-end/opening.js';
import { parseArgs, resetTransactions, ResetRefused } from '../scripts/reset-transactions.js';
import {
  MASTER_CONFIG_TABLES, MASTER_SERIES, SYSTEM_TABLES, TRANSACTION_TABLES, classificationGaps,
} from '../scripts/lib/table-classification.js';
import { TRANSACTION_TABLES as PURGE_TABLES } from '../scripts/purge-sample-data.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const count = async (t, where = 'true') => (await query(`SELECT count(*)::int AS n FROM "${t}" WHERE ${where}`)).rows[0].n;
const tables = async () => (await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.tablename);
// petty cash funds stay, detached from their establishment journal: those columns are compared apart
const DETACHED = { petty_cash_funds: ['journal_id', 'transaction_number', 'available_cash', 'updated_at'] };
async function checksums() {
  const out = {};
  for (const t of MASTER_CONFIG_TABLES) {
    const drop = (DETACHED[t] || []).map((c) => ` - '${c}'`).join('');
    const r = await query(`SELECT count(*)::int AS n, md5(COALESCE(string_agg((to_jsonb(x)${drop})::text, '|' ORDER BY (to_jsonb(x)${drop})::text), '')) AS h FROM "${t}" x`);
    out[t] = `${r.rows[0].n}:${r.rows[0].h}`;
  }
  return out;
}
const withClient = async (fn) => {
  const c = await pool.connect();
  try { return await fn(c); } finally { c.release(); }
};
const setLock = (on) => query("UPDATE app_settings SET value = $1::jsonb WHERE key = 'golive.locked'", [JSON.stringify(on)]);

let ctx;
let uploadDir;
beforeAll(async () => {
  ctx = await setup(); // reference data + the sample book (masters and transactions)
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-reset-'));
});
afterAll(async () => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  await pool.end();
});

describe('table classification', () => {
  it('classifies every table of the database exactly once (a new migration table must be added to a list)', async () => {
    const gaps = classificationGaps(await tables());
    expect(gaps.unclassified, 'tables in no list of scripts/lib/table-classification.js').toEqual([]);
    expect(gaps.duplicated).toEqual([]);
    expect(gaps.unknown, 'listed tables that no migration creates').toEqual([]);
    expect(SYSTEM_TABLES).toEqual(expect.arrayContaining(['audit_log', 'login_history', 'refresh_tokens', 'job_runs', 'notifications', 'email_outbox', 'generated_reports', 'documents', 'opening_balances', 'sequences']));
  });

  it('the sample purge still empties every transaction table, and more', () => {
    expect(PURGE_TABLES).toEqual(expect.arrayContaining(TRANSACTION_TABLES));
    expect(PURGE_TABLES).toEqual(expect.arrayContaining(['sequences', 'documents', 'petty_cash_funds', 'package_bundles']));
  });

  it('reads the options', () => {
    expect(parseArgs([])).toEqual({ execute: false, keepOpeningBalances: false, purgeAudit: false, purgeFiles: false, help: false });
    expect(parseArgs(['--execute', '--keep-opening-balances', '--purge-files', '--keep-audit'])).toMatchObject({ execute: true, keepOpeningBalances: true, purgeFiles: true, purgeAudit: false });
    expect(parseArgs(['--purge-audit'])).toMatchObject({ purgeAudit: true });
    expect(() => parseArgs(['--force'])).toThrow('unknown option');
  });
});

describe('transaction reset', () => {
  it('refuses while golive.locked is on, and changes nothing', async () => {
    expect(await count('app_settings', "key = 'golive.locked' AND value = 'false'::jsonb")).toBe(1);
    const leads = await count('leads');
    expect(leads).toBeGreaterThan(0);
    // the administrator switches the lock on and off in Master > Configuration (PUT /settings)
    const lock = (on) => ctx.api('put', '/settings').send({ settings: { 'golive.locked': on } });
    expect((await lock(true)).status).toBe(200);
    try {
      const err = await withClient((c) => resetTransactions(c, { execute: true }).catch((e) => e));
      expect(err).toBeInstanceOf(ResetRefused);
      expect(err.code).toBe('GOLIVE_LOCKED');
      expect(err.message).toContain('Master > Configuration > Go-live');
      expect(await count('leads')).toBe(leads);
    } finally {
      expect((await lock(false)).status).toBe(200);
    }
  });

  it('dry run counts per table and changes nothing', async () => {
    const before = {};
    for (const t of await tables()) before[t] = await count(t);
    const r = await withClient((c) => resetTransactions(c, {}));
    expect(r.executed).toBe(false);
    const byTable = Object.fromEntries(r.tables.map((t) => [t.table, t.rows]));
    expect(byTable.leads).toBe(before.leads);
    expect(byTable.journal_lines).toBe(before.journal_lines);
    expect(r.total).toBeGreaterThan(100);
    expect(r.kept.tables).toBe(MASTER_CONFIG_TABLES.length);
    const after = {};
    for (const t of await tables()) after[t] = await count(t);
    expect(after).toEqual(before);
  });

  it('removes the transactions and keeps masters, configuration, users and settings; numbering restarts; the ledger is empty', async () => {
    // A smoke test: a lead and a petty cash fund (master code from the petty_cash_fund series), a closed period,
    // go-live opening balances, notifications, sign-in history, files of a claim and a logo.
    const lead = await ctx.api('post', '/leads').send({ firstName: 'Smoke', lastName: 'Test', emailId: 'smoke@example.ph', contactNumber: '09171234567', leadCategory: 'Retail', lob: 'MOTOR' });
    expect(lead.status, JSON.stringify(lead.body)).toBe(201);
    const fund = await ctx.api('post', '/petty-cash/funds').send({ description: 'Smoke test fund', fundSize: 5000, maxLimit: 1000, minimumCashbox: 500 });
    expect(fund.status, JSON.stringify(fund.body)).toBe(201);
    const fundCode = fund.body.data.code;
    await query("INSERT INTO accounting_periods(period, status, closed_by, closed_at) VALUES ('2025-11', 'closed', 'test', now()) ON CONFLICT (period) DO UPDATE SET status = 'closed'");
    const acct = async (type) => (await query("SELECT code FROM gl_accounts WHERE status = 'active' AND account_type = $1 ORDER BY code LIMIT 1", [type])).rows[0].code;
    const ob = [{ accountCode: await acct('asset'), debit: '1000' }, { accountCode: await acct('equity'), credit: '1000' }];
    await withClient((c) => importOpeningBalances(c, ob, { goLiveDate: '2020-01-01' }));
    expect(await count('opening_balances')).toBe(2);
    await query("INSERT INTO login_history(username, success) VALUES ('BrokerVerse', true)");
    await query("INSERT INTO notifications(title, message, audience) VALUES ('Smoke test', 'Policy issued', 'all')");
    const claimFile = path.join(uploadDir, 'claims', '1-a-photo.jpg');
    const logoFile = path.join(uploadDir, 'logo', '1-b-logo.png');
    for (const f of [claimFile, logoFile]) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'x'); }
    await query("INSERT INTO documents(storage_key, file_name, category, status) VALUES ('claims/1-a-photo.jpg', 'photo.jpg', 'claims', 'uploaded'), ('logo/1-b-logo.png', 'logo.png', 'logo', 'uploaded')");
    const masterSeries = (await query('SELECT name, period, value FROM sequences WHERE name = ANY($1) ORDER BY 1, 2', [MASTER_SERIES])).rows;
    expect(masterSeries.map((s) => s.name)).toContain('petty_cash_fund');
    for (const t of ['leads', 'policies', 'claims', 'receipts', 'remittances', 'journal_lines', 'notifications']) expect(await count(t), t).toBeGreaterThan(0);

    const masters = await checksums();
    const audit = await count('audit_log');
    const r = await withClient((c) => resetTransactions(c, { execute: true, keepOpeningBalances: true, purgeFiles: true, uploadDir, actor: 'smoke.lead' }));
    expect(r.executed).toBe(true);
    expect(r.series.kept).toContain('petty_cash_fund');
    expect(r.series.reset).toEqual(expect.arrayContaining(['lead', 'journal']));
    expect(r.files).toEqual([{ folder: 'claims', files: 1 }]);

    // transactions and system records gone
    for (const t of TRANSACTION_TABLES.filter((x) => x !== 'fiscal_years')) expect(await count(t), t).toBe(0);
    for (const t of ['notifications', 'email_outbox', 'generated_reports', 'job_runs', 'job_queue', 'login_history', 'refresh_tokens', 'password_resets']) expect(await count(t), t).toBe(0);
    // masters, configuration, users, roles and settings unchanged
    expect(await checksums()).toEqual(masters);
    const pcf = (await query('SELECT * FROM petty_cash_funds WHERE code = $1', [fundCode])).rows[0];
    expect(pcf).toMatchObject({ journal_id: null, transaction_number: null });
    expect(Number(pcf.available_cash)).toBe(Number(pcf.fund_size));
    // audit trail kept and the reset recorded in it
    expect(await count('audit_log')).toBe(audit + 1);
    const entry = (await query("SELECT username, after_data FROM audit_log WHERE entity = 'database' AND action = 'reset' ORDER BY id DESC LIMIT 1")).rows[0];
    expect(entry.username).toBe('smoke.lead');
    expect(entry.after_data.tables.some((t) => t.table === 'leads')).toBe(true);
    // numbering: transaction series restart at their start, master series continue
    expect((await query('SELECT name, period, value FROM sequences ORDER BY 1, 2')).rows).toEqual(masterSeries);
    const start = (await query("SELECT start_number FROM document_numbering WHERE code = 'lead'")).rows[0].start_number;
    expect(await nextDocumentNumber('lead')).toMatch(new RegExp(`${String(start).padStart(5, '0')}$`));
    const nextFund = await nextDocumentNumber('petty_cash_fund');
    expect(nextFund).not.toBe(fundCode);
    // accounting: no journal, an empty trial balance, every period open; go-live opening balances kept (open fiscal year)
    const tb = await ctx.api('get', '/accounting/trial-balance');
    expect(tb.status).toBe(200);
    expect(tb.body.data.rows.filter((x) => x.debit || x.credit)).toEqual([]);
    expect(await count('accounting_periods')).toBe(0);
    const periods = await ctx.api('get', '/accounting/periods');
    expect(periods.body.data.every((p) => p.status === 'open')).toBe(true);
    expect(await count('opening_balances')).toBe(2);
    expect((await query('SELECT code, status FROM fiscal_years')).rows).toEqual([{ code: expect.any(String), status: 'open' }]);
    // files: the claim file and its record went, the logo stayed
    expect(fs.existsSync(claimFile)).toBe(false);
    expect(fs.existsSync(logoFile)).toBe(true);
    expect((await query('SELECT storage_key FROM documents')).rows.map((d) => d.storage_key)).toEqual(['logo/1-b-logo.png']);
    // the application works on: sign in and a new lead with the first number of the series
    const again = await ctx.api('post', '/leads').send({ firstName: 'Live', lastName: 'Client', emailId: 'live@example.ph', contactNumber: '09171234568', leadCategory: 'Retail', lob: 'FIRE' });
    expect(again.status).toBe(201);
  });

  it('removes the opening balances by default, and can empty the audit trail (the reset is still recorded)', async () => {
    expect(await count('opening_balances')).toBeGreaterThan(0);
    const r = await withClient((c) => resetTransactions(c, { execute: true, purgeAudit: true }));
    expect(r.tables.find((t) => t.table === 'opening_balances').rows).toBe(2);
    expect(await count('opening_balances')).toBe(0);
    expect(await count('fiscal_years')).toBe(0);
    expect(await count('audit_log')).toBe(1);
  });

  it('rolls everything back on error', async () => {
    await query("INSERT INTO sequences(name, period, value) VALUES ('reset-test', '2026', 7)");
    await withClient(async (c) => {
      const bad = { query: (text, params) => (/^TRUNCATE/.test(text) ? Promise.reject(new Error('boom')) : c.query(text, params)) };
      await expect(resetTransactions(bad, { execute: true })).rejects.toThrow('boom');
    });
    expect(await count('sequences', "name = 'reset-test'")).toBe(1);
    expect(await count('petty_cash_funds')).toBeGreaterThan(0);
    // the foreign key set aside for the reset is in place
    expect(await count('pg_constraint', "conrelid = 'petty_cash_funds'::regclass AND confrelid = 'journal_vouchers'::regclass")).toBe(1);
    await query("DELETE FROM sequences WHERE name = 'reset-test'");
  });

  it('the command needs CONFIRM_RESET=yes, is a dry run by default and refuses under the go-live lock', async () => {
    const run = (env, args = []) => new Promise((resolve) => {
      const e = { ...process.env, ...env };
      if (!('CONFIRM_RESET' in env)) delete e.CONFIRM_RESET;
      const c = spawn(process.execPath, ['scripts/reset-transactions.js', ...args], { cwd: backend, env: e });
      let out = '';
      c.stdout.on('data', (d) => { out += d; });
      c.stderr.on('data', (d) => { out += d; });
      c.on('exit', (code) => resolve({ code, out }));
    });
    const refused = await run({});
    expect(refused.code).toBe(2);
    expect(refused.out).toContain('CONFIRM_RESET=yes');
    await ctx.api('post', '/leads').send({ firstName: 'Cli', lastName: 'Test', emailId: 'cli@example.ph', contactNumber: '09171234569', leadCategory: 'Retail', lob: 'MOTOR' });
    const leads = await count('leads');
    expect(leads).toBeGreaterThan(0);
    const dry = await run({ CONFIRM_RESET: 'yes' });
    expect(dry.code, dry.out).toBe(0);
    expect(dry.out).toContain('DRY RUN');
    expect(dry.out).toMatch(/leads\s+\d+/);
    expect(await count('leads')).toBe(leads);
    await setLock(true);
    try {
      const locked = await run({ CONFIRM_RESET: 'yes' }, ['--execute']);
      expect(locked.code).toBe(3);
      expect(locked.out).toContain('golive.locked');
      expect(await count('leads')).toBe(leads);
    } finally {
      await setLock(false);
    }
    const exec = await run({ CONFIRM_RESET: 'yes' }, ['--execute']);
    expect(exec.code, exec.out).toBe(0);
    expect(exec.out).toContain('Removed');
    expect(await count('leads')).toBe(0);
  }, 60000);
});
