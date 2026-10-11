/**
 * Fixtures of the Data Migration & Go-Live suites (jobs, approval, undo, lock): a fresh database with the reference
 * data only, the administrator's API, users of the roles the workspace is used with, migration workbooks and the
 * records of the production run the go-live lock rests on.
 */
import zlib from 'node:zlib';
import request from 'supertest';
import { expect } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { one, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { enableFeatures, goLiveSetup, loginAs, settledBatch, validatedBatch } from './helpers.js';

/** Permissions of the test roles: loader (uploads, submits), approver (decides), both (a cutover administrator), reader (an auditor). */
export const ROLES = {
  'dl-loader': ['read:data-load', 'write:data-load'],
  'dl-approver': ['read:data-load', 'approve:data-load'],
  'dl-both': ['read:data-load', 'write:data-load', 'approve:data-load'],
  'dl-reader': ['read:data-load'],
};

/**
 * Start a suite: database, app, the administrator's API and kits; the cutover date on the first day of next month
 * (issue: 40 days before it), loads approved by a second user. users: { name: role } signed in as their own API.
 */
export async function startMigrationSuite({ users = {}, approval = true } = {}) {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  const app = await createApp();
  // the legacy book migration is a Phase 2 feature (modules/features): enabled for the suites of the workspace
  await enableFeatures(app, ['legacy-migration']);
  const login = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  const as = (token) => (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  const api = as(login.body.accessToken);
  const now = await today();
  const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const cutover = d.toISOString().slice(0, 10);
  await goLiveSetup(api, cutover, { approval });
  // the suites sign with their own roles and number with the generic series: the sign-off roles and the numbering mask
  // of TISPH are tested where they apply
  await query(`UPDATE app_settings SET value = (SELECT jsonb_agg(x - 'roles') FROM jsonb_array_elements(value) x) WHERE key = 'migration.recon_signoffs'`);
  await query('UPDATE app_settings SET value = \'[]\'::jsonb WHERE key = \'migration.numbering_mask_series\'');
  clearSettingsCache();
  for (const role of new Set(Object.values(users))) {
    const r = await api('post', '/roles').send({ code: role, name: role, permissions: ['read:profile', 'write:profile', 'read:notifications', 'write:notifications', ...ROLES[role]] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
  }
  const people = {};
  for (const [name, role] of Object.entries(users)) {
    const u = await api('post', '/users').send({ username: name, password: 'Welcome@123', displayName: name, email: `${name}@example.ph`, roles: [role], mustChangePassword: false });
    expect(u.status, JSON.stringify(u.body)).toBe(201);
    people[name] = { id: (await one('SELECT id FROM users WHERE username = $1', [name])).id, api: as(await loginAs(app, name, 'Welcome@123')) };
  }
  const admin = await one('SELECT id FROM users WHERE username = \'BrokerVerse\'');
  const kits = (await api('get', '/data-load/kits')).body.data.kits;
  return { app, api, admin: { id: admin.id, api }, users: people, kits, cutover, issue: addDays(cutover, -40) };
}

/** A workbook of a kit from { sheetName: [{ header: value }] }. */
export function workbook(kits, sheets, kit = 'migration') {
  const defs = kits.find((k) => k.kit === kit).sheets;
  return writeXlsx({
    sheets: Object.entries(sheets).map(([name, rows]) => {
      const def = defs.find((s) => s.name === name);
      if (!def) throw new Error(`no sheet ${name}`);
      const headers = def.columns.map((c) => c.header);
      return { name, columns: headers.map((h) => ({ header: h })), rows: rows.map((r) => headers.map((h) => (r[h] === undefined ? '' : String(r[h])))) };
    }),
  });
}

/** Upload a workbook as a user and wait for its validation: { status, body } with data { batch, errors }. */
export const uploadAs = (userApi, wb, kit = 'migration') => validatedBatch(userApi, userApi('post', '/data-load/batches').field('kit', kit).attach('file', wb, `${kit}.xlsx`));
/** Wait for the job of a batch to end: the batch. */
export const settle = async (userApi, id) => (await settledBatch(userApi, id)).body.data.batch;

/** Rows of a whole migration workbook: a client, a motor policy, its open item and cheque, a claim and the opening balances. */
export function businessRows({ cutover, issue }, n = 1, { balance = '10000' } = {}) {
  const c = `MJ${n}`;
  return {
    Clients: [{ 'Client Code': `${c}-C`, 'Client Type': 'individual', 'First Name': 'Rosa', 'Last Name': `Diaz ${n}`, Email: `rosa${n}@example.ph`, TIN: `123-456-${String(100 + n)}-000` }],
    'Policies - Motor': [{ 'Policy Number': `${c}-P`, 'Client Code': `${c}-C`, Insurer: 'MALAYAN', Product: 'MOTOR', 'Inception Date': addDays(issue, 1), 'Expiry Date': addDays(cutover, 300),
      'Issue Date': issue, 'Net Premium': '20000', 'Gross Premium': '25000', 'Plate Number': `MJ ${1000 + n}`, 'Payment Status': 'Partial' }],
    'Open Items': [{ 'Policy Number': `${c}-P`, 'Bill Reference': `${c}-DN`, 'Due Date': addDays(cutover, 15), 'Original Amount': '25000', 'Open Balance': balance }],
    'Post-Dated Cheques': [{ 'Drawee Bank': 'Some Rural Bank', 'Cheque Number': `${c}-CHQ`, 'Cheque Date': addDays(cutover, 10), Amount: '5000.00', 'Policy Number': `${c}-P`,
      'Bill Reference': `${c}-DN` }],
    'Open Claims': [{ 'Claim Number': `${c}-CLM`, 'Policy Number': `${c}-P`, 'Loss Date': addDays(issue, 10), 'Outstanding Estimate': '45000' }],
    'Opening Balances': [{ 'Account Code': '1202001', Debit: balance }, { 'Account Code': '2201001', Credit: balance }],
  };
}

/** Switch the go-live lock directly (the two-person flow is covered by test/migration-lock.test.js). */
export async function setLock(on) {
  await query('UPDATE app_settings SET value = $1::jsonb WHERE key = \'golive.locked\'', [JSON.stringify(on)]);
  if (on) await query('UPDATE app_settings SET value = $1::jsonb WHERE key = \'golive.locked_at\'', [JSON.stringify(new Date().toISOString())]);
  clearSettingsCache();
}

/** The production run with its Go decision, signed reconciliation and restore point, as the Runs, Reconciliation and Go-Live tabs record them. */
export async function productionRun({ decision = 'go', reconciliation = 'signed', restorePoint = true } = {}) {
  await query('DELETE FROM go_live_decisions');
  await query('DELETE FROM migration_reconciliations');
  await query('DELETE FROM migration_runs');
  const run = await one(`INSERT INTO migration_runs(kind, title, environment, status, restore_point) VALUES ('production', 'Production cutover', 'production', 'running', $1) RETURNING id`,
    [restorePoint ? new Date() : null]);
  if (decision) await query('INSERT INTO go_live_decisions(run_id, status, decided_at) VALUES ($1, $2, now())', [run.id, decision]);
  if (reconciliation) await query('INSERT INTO migration_reconciliations(run_id, cutover_date, status) VALUES ($1, now()::date, $2)', [run.id, reconciliation]);
  return run.id;
}

/** The entries of a ZIP archive (an evidence pack, an XLSX file): Map of name -> Buffer. */
export function unzip(buf) {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end -= 1;
  const out = new Map();
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0; n -= 1) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

/** All the text of a download: a ZIP (evidence pack, XLSX) is opened, nested archives too. */
export function textOf(buf) {
  if (!Buffer.isBuffer(buf)) return JSON.stringify(buf);
  if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) return [...unzip(buf).values()].map(textOf).join('\n');
  return buf.toString('utf8');
}

/** Read a binary response body (supertest) into a Buffer. */
export const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
