/**
 * Go-Live Data Workbench (Master > Go-Live Data Load): the configuration and migration kits. Template download per
 * kit, validation as a dry run (one rolled-back transaction, cross-sheet references), errors and the errors workbook
 * re-uploaded after the fix, load and re-load without duplicates, migration flags without journals, bills or
 * commission, the cutover date and go-live lock guards, the numbering collision check, the permission and the
 * round trip of the workbook with the current data. Also the ambient transaction of db/pool.js.
 * Reference data only (no sample ledger), so the fiscal year has no journal before the cutover date.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { pool, query, one, runInTransaction, withTransaction, inTransaction } from '../src/db/pool.js';
import { clearSettingsCache, getSetting } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook, readZip } from '../src/modules/documents/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { loginAs } from './helpers.js';

let app;
let api;
let kits;
let cutover;
let year;

const bin = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});

/** Workbook of a kit from { sheetName: [{ header: value }] } (headers as in the template, row 2 onwards = data). */
function book(kit, sheets) {
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
const upload = (kit, buffer, name = `${kit}.xlsx`) => api('post', '/data-load/batches').field('kit', kit).attach('file', buffer, name);
const load = (id, body = {}) => api('post', `/data-load/batches/${id}/load`).send(body);
const setSettings = async (settings) => {
  const r = await api('put', '/settings').send({ settings });
  expect(r.status).toBe(200);
  clearSettingsCache();
};
const count = async (sql, params) => (await one(sql, params)).n;

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  kits = (await api('get', '/data-load/kits')).body.data.kits;
  const now = await today();
  year = now.slice(0, 4);
  // cutover: the first day of the next month
  const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  cutover = d.toISOString().slice(0, 10);
});
afterAll(async () => {
  await pool.end();
});

describe('ambient transaction (db/pool.js)', () => {
  it('runs the pool helpers on one client, nests withTransaction as savepoints and rolls a dry run back', async () => {
    await query('CREATE TABLE IF NOT EXISTS wb_probe (v text)');
    const seen = await runInTransaction(async () => {
      expect(inTransaction()).toBe(true);
      await query('INSERT INTO wb_probe VALUES ($1)', ['outer']);
      await withTransaction(async (c) => { await c.query('INSERT INTO wb_probe VALUES ($1)', ['kept']); });
      await withTransaction(async () => {
        await query('INSERT INTO wb_probe VALUES ($1)', ['undone']);
        throw new Error('row failed');
      }).catch(() => {});
      await pool.query('INSERT INTO wb_probe VALUES ($1)', ['pool']);
      return (await query('SELECT v FROM wb_probe ORDER BY v')).rows.map((r) => r.v);
    }, { rollback: true });
    expect(seen).toEqual(['kept', 'outer', 'pool']);
    expect(inTransaction()).toBe(false);
    expect(await count('SELECT count(*)::int AS n FROM wb_probe')).toBe(0);
    await runInTransaction(async () => { await query('INSERT INTO wb_probe VALUES ($1)', ['committed']); });
    expect(await count('SELECT count(*)::int AS n FROM wb_probe')).toBe(1);
    await query('DROP TABLE wb_probe');
  });
});

describe('templates', () => {
  it('downloads each kit as one workbook: Instructions, Lists, one sheet per object, navy headers, required marks, sample row, drop-downs', async () => {
    for (const k of kits) {
      const r = await bin(api('get', `/data-load/kits/${k.kit}/template`));
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('spreadsheetml');
      const sheets = readWorkbook(r.body);
      expect(sheets.map((s) => s.name)).toEqual(['Instructions', 'Lists', ...k.sheets.map((s) => s.name)]);
      for (const s of k.sheets) {
        const ws = sheets.find((x) => x.name === s.name);
        const required = s.columns.filter((c) => c.required).map((c) => `${c.header} *`);
        for (const h of required) expect(ws.rows[0]).toContain(h);
        expect(ws.rows[1][0]).toMatch(/^SAMPLE/);
      }
      const zip = readZip(r.body);
      expect(zip.get('xl/styles.xml')).toContain('FF0B2A4A');
      // object sheets: drop-downs pointing at the Lists sheet
      expect(zip.get(`xl/worksheets/sheet${k.kit === 'migration' ? 4 : 12}.xml`)).toMatch(/<dataValidation type="list"[^>]*><formula1>Lists!\$/);
    }
    const mig = readWorkbook((await bin(api('get', '/data-load/kits/migration/template'))).body);
    const instructions = mig[0].rows.map((r) => r.join(' ')).join('\n');
    expect(instructions).toMatch(/Cutover date rule/);
    expect(instructions).toMatch(/Load order/);
    expect(instructions).toMatch(/go-live-migration/);
    const conf = readWorkbook((await bin(api('get', '/data-load/kits/configuration/template'))).body);
    expect(conf[0].rows.map((r) => r.join(' ')).join('\n')).toMatch(/Entered on screen/);
    expect(conf.find((s) => s.name === 'Lists').rows[0]).toContain('Roles');
  });

  it('is for the System Administrator only (403 for another role)', async () => {
    const u = await api('post', '/users').send({ username: 'wb.accounting', password: 'Welcome@123', displayName: 'WB Accounting', email: 'wb.acc@example.ph', roles: ['accounting'], mustChangePassword: false });
    expect(u.status).toBe(201);
    const token = await loginAs(app, 'wb.accounting', 'Welcome@123');
    const as = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
    expect((await as('get', '/data-load/kits')).status).toBe(403);
    expect((await as('get', '/data-load/kits/configuration/template')).status).toBe(403);
    expect((await as('get', '/data-load/batches')).status).toBe(403);
    const up = await as('post', '/data-load/batches').field('kit', 'configuration').attach('file', Buffer.from('x'), 'x.xlsx');
    expect(up.status).toBe(403);
  });
});

describe('configuration kit', () => {
  const insurer = { 'insuranceCompanyCode': 'WBINS', 'insuranceCompanyName': 'Workbench Mutual Insurance', city: 'Makati', state: 'Metro Manila', country: 'Philippines', email: 'uw@wbins.example.ph', phoneNumber: '+63 2 8000 1111', commissionRate: '0.18' };
  const header = (sheet, key) => kits.find((k) => k.kit === 'configuration').sheets.find((s) => s.name === sheet).columns.find((c) => c.key === key).header;
  const insurerRow = () => Object.fromEntries(Object.entries(insurer).map(([k, v]) => [header('Insurers', k), v]));
  const workbook = (userRole) => book('configuration', {
    Insurers: [insurerRow()],
    Users: [
      { Username: 'wb.ae1', 'Display Name': 'Workbench AE One', Email: 'ae1@example.ph', Roles: 'sales', Status: 'active' },
      { Username: 'wb.ae2', 'Display Name': 'Workbench AE Two', Email: 'ae2@example.ph', Roles: userRole, Status: 'active' },
    ],
    // refers to the insurer of the Insurers sheet of the same workbook
    'Commission Rates': [{ Insurer: 'WBINS', Product: 'MOTOR', 'Policy Type': 'new', Rate: '0.175', 'Effective From': '2026-01-01', Active: 'Yes' }],
    'Authority Limits': [{ 'Transaction Type': 'payment_voucher', Role: 'accounting', 'Max Amount': '2500000' }],
  });
  let batchA;

  it('validates without saving: cross-sheet references resolve inside the dry run', async () => {
    const r = await upload('configuration', workbook('sales'));
    expect(r.status).toBe(201);
    expect(r.body.data.batch.status).toBe('validated');
    expect(r.body.data.batch.rowsError).toBe(0);
    const sheet = (k) => r.body.data.batch.sheets.find((s) => s.sheet === k);
    expect(sheet('master:insurance-company')).toMatchObject({ read: 1, valid: 1, created: 1 });
    expect(sheet('commission-rates')).toMatchObject({ read: 1, valid: 1, created: 1 });
    expect(sheet('users')).toMatchObject({ read: 2, created: 2 });
    expect(sheet('authority-limits')).toMatchObject({ proposed: 1 });
    // nothing was saved
    expect(await count("SELECT count(*)::int AS n FROM insurance_companies WHERE code = 'WBINS'")).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM users WHERE username LIKE 'wb.ae%'")).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM authority_limits WHERE status = 'pending'")).toBe(0);
  });

  it('reports the rows in error (sheet, row, column, message) and refuses the load until fixed', async () => {
    const r = await upload('configuration', workbook('no-such-role'));
    expect(r.status).toBe(201);
    batchA = r.body.data.batch;
    expect(batchA.status).toBe('failed');
    expect(batchA.rowsError).toBe(1);
    expect(r.body.data.errors).toEqual([expect.objectContaining({ sheet: 'users', sheetName: 'Users', row: 3, column: 'Roles', message: expect.stringMatching(/Unknown role/) })]);
    const detail = await api('get', `/data-load/batches/${batchA.id}`);
    expect(detail.body.data.totalErrors).toBe(1);
    expect((await load(batchA.id)).status).toBe(409);
  });

  it('downloads the rows in error with an Errors column; the fixed file validates and loads', async () => {
    const e = await bin(api('get', `/data-load/batches/${batchA.id}/errors`));
    expect(e.status).toBe(200);
    const sheets = readWorkbook(e.body);
    const users = sheets.find((s) => s.name === 'Users');
    expect(users.rows[0]).toContain('Errors');
    expect(users.rows.length).toBe(3); // header, sample, the one row in error
    expect(users.rows[2][0]).toBe('wb.ae2');
    expect(users.rows[2][users.rows[0].indexOf('Errors')]).toMatch(/Roles: Unknown role/);
    for (const s of sheets.filter((x) => !['Instructions', 'Lists', 'Users'].includes(x.name))) expect(s.rows.length).toBeLessThanOrEqual(2);
    // load the valid rows of the first file, then the corrected row
    const partial = await load(batchA.id, { validRowsOnly: true });
    expect(partial.status).toBe(200);
    expect(partial.body.data.batch.status).toBe('loaded');
    expect(partial.body.data.temporaryPasswords.map((p) => p.username)).toEqual(['wb.ae1']);
    expect(partial.headers['cache-control']).toBe('no-store');
    expect(await count("SELECT count(*)::int AS n FROM insurance_companies WHERE code = 'WBINS'")).toBe(1);
    // fix the role in the errors workbook and upload it again
    const roles = users.rows[0].indexOf('Roles *');
    const fixed = users.rows[2].slice(0, users.rows[0].indexOf('Errors'));
    fixed[roles] = 'sales';
    const headers = users.rows[0].slice(0, users.rows[0].indexOf('Errors'));
    const again = writeXlsx({ sheets: [{ name: 'Users', columns: [...headers, 'Errors'].map((h) => ({ header: h })), rows: [users.rows[1], [...fixed, 'was wrong']] }] });
    const r = await upload('configuration', again, 'errors-fixed.xlsx');
    expect(r.body.data.batch.status).toBe('validated');
    expect(r.body.data.batch.rowsRead).toBe(1);
    const l = await load(r.body.data.batch.id);
    expect(l.status).toBe(200);
    expect(l.body.data.temporaryPasswords).toEqual([expect.objectContaining({ username: 'wb.ae2', temporaryPassword: expect.any(String) })]);
    const u = await one("SELECT must_change_password FROM users WHERE username = 'wb.ae2'");
    expect(u.must_change_password).toBe(true);
    // the temporary password is not kept anywhere in the batch
    const stored = await one('SELECT count(*)::int AS n FROM data_load_rows WHERE data::text LIKE $1', [`%${l.body.data.temporaryPasswords[0].temporaryPassword}%`]);
    expect(stored.n).toBe(0);
    const audit = await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'data_load_batch' AND action = 'load'");
    expect(audit.n).toBe(2);
    const note = await one("SELECT count(*)::int AS n FROM notifications WHERE entity = 'data_load_batch'");
    expect(note.n).toBe(2);
  });

  it('loading the whole workbook again updates nothing and never duplicates (natural keys)', async () => {
    const before = await count('SELECT count(*)::int AS n FROM commission_rates');
    const r = await upload('configuration', workbook('sales'));
    expect(r.body.data.batch.status).toBe('validated');
    const s = r.body.data.batch.sheets;
    expect(s.reduce((a, x) => a + x.created, 0)).toBe(0);
    const l = await load(r.body.data.batch.id);
    expect(l.status).toBe(200);
    expect(l.body.data.temporaryPasswords).toEqual([]);
    expect(await count("SELECT count(*)::int AS n FROM insurance_companies WHERE code = 'WBINS'")).toBe(1);
    expect(await count("SELECT count(*)::int AS n FROM users WHERE username LIKE 'wb.ae%'")).toBe(2);
    expect(await count('SELECT count(*)::int AS n FROM commission_rates')).toBe(before);
    expect(await count("SELECT count(*)::int AS n FROM authority_limits WHERE status = 'pending' AND transaction_type = 'payment_voucher'")).toBe(1);
    // a corrected value updates the record
    const changed = book('configuration', { Insurers: [{ ...insurerRow(), [header('Insurers', 'insuranceCompanyName')]: 'Workbench Mutual Insurance Corp.' }] });
    const c = await upload('configuration', changed);
    expect(c.body.data.batch.sheets.find((x) => x.sheet === 'master:insurance-company')).toMatchObject({ updated: 1 });
    await load(c.body.data.batch.id);
    expect((await one("SELECT name FROM insurance_companies WHERE code = 'WBINS'")).name).toBe('Workbench Mutual Insurance Corp.');
  });

  it('the workbook with the current data loads back into the same environment with no change (promotion round trip)', async () => {
    const t = await bin(api('get', '/data-load/kits/configuration/template?prefill=true'));
    expect(t.status).toBe(200);
    const sheets = readWorkbook(t.body);
    expect(sheets.find((s) => s.name === 'Insurers').rows.some((r) => r[0] === 'WBINS')).toBe(true);
    expect(sheets.find((s) => s.name === 'Users').rows.some((r) => r[0] === 'wb.ae2')).toBe(true);
    expect(sheets.find((s) => s.name === 'Chart of Accounts').rows.length).toBeGreaterThan(50);
    // never a password
    expect(sheets.find((s) => s.name === 'Users').rows[0].join(' ')).not.toMatch(/password/i);
    const r = await upload('configuration', t.body, 'current.xlsx');
    expect(r.status).toBe(201);
    const batch = r.body.data.batch;
    expect(batch.rowsError).toBe(0);
    expect(batch.rowsRead).toBeGreaterThan(300);
    for (const s of batch.sheets) expect(s.unchanged, s.sheet).toBe(s.read);
    const l = await load(batch.id);
    expect(l.status).toBe(200);
    for (const c of Object.values(l.body.data.batch.loadedCounts)) expect(c.created + c.updated + c.proposed).toBe(0);
  });

  it('refuses golive.locked in the Settings sheet and checks setting values', async () => {
    const r = await upload('configuration', book('configuration', { Settings: [
      { 'Setting Key': 'golive.locked', Value: 'true' },
      { 'Setting Key': 'golive.cutover_date', Value: 'next monday' },
      { 'Setting Key': 'tax.vat_rate', Value: '0.12' },
    ] }));
    expect(r.body.data.errors.map((e) => [e.row, e.column])).toEqual([[2, 'Setting Key'], [3, 'Value'], [4, 'Setting Key']]);
    expect(r.body.data.errors[2].message).toMatch(/Premium Taxes/);
  });
});

describe('migration kit', () => {
  let issue;
  let expiry;
  const clients = () => [
    { 'Client Code': 'OLD-C-0001', 'Client Type': 'individual', 'First Name': 'Maria', 'Last Name': 'Santos', Email: 'maria@example.ph', 'Birth Date': '1985-02-03' },
    { 'Client Code': 'OLD-C-0002', 'Client Type': 'corporate', 'Company Name': 'Visayas Cold Storage Inc.' },
  ];
  const policies = () => [
    { 'Policy Number': 'OLD-MC-0001', 'Client Code': 'OLD-C-0001', Insurer: 'MALAYAN', Product: 'MOTOR', 'Inception Date': addDays(issue, 1), 'Expiry Date': expiry, 'Issue Date': issue,
      'Sum Insured': '1000000', 'Net Premium': '20000', 'Gross Premium': '25000', 'Payment Status': 'Partial', 'Plate Number': 'NCA 1234' },
    // expires 20 days after cutover: a renewal candidate
    { 'Policy Number': 'OLD-FI-0002', 'Client Code': 'OLD-C-0002', Insurer: 'FPG', Product: 'FIRE', 'Inception Date': addDays(cutover, -345), 'Expiry Date': addDays(cutover, 20),
      'Issue Date': addDays(cutover, -350), 'Sum Insured': '5000000', 'Net Premium': '11000', 'Gross Premium': '14000' },
  ];
  const workbook = (extra = {}) => book('migration', {
    Clients: clients(),
    Policies: policies(),
    'Open Items': [{ 'Policy Number': 'OLD-MC-0001', 'Bill Reference': 'DN-OLD-77', 'Due Date': addDays(cutover, 15), 'Original Amount': '25000', 'Open Balance': '10000' }],
    'Open Claims': [{ 'Claim Number': 'OLD-CLM-0009', 'Policy Number': 'OLD-MC-0001', 'Loss Date': addDays(issue, 10), 'Reported Date': addDays(issue, 11), Status: 'in-review', 'Outstanding Estimate': '45000' }],
    'Opening Balances': [
      { 'Account Code': '1102001', Debit: '500000' },
      { 'Account Code': '1202001', Debit: '10000' },
      { 'Account Code': '2201001', Credit: '210000' },
      { 'Account Code': '5101001', Credit: '300000' },
    ],
    ...extra,
  });
  let loaded;

  beforeAll(async () => {
    issue = addDays(cutover, -40);
    expiry = addDays(cutover, 320);
  });

  it('needs the cutover date', async () => {
    const r = await upload('migration', workbook());
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/cutover date/);
  });

  it('validates the whole workbook as a dry run: policies refer to clients and insurers of the same workbook; nothing is saved', async () => {
    await setSettings({ 'golive.cutover_date': cutover });
    const r = await upload('migration', workbook());
    expect(r.status).toBe(201);
    expect(r.body.data.errors).toEqual([]);
    expect(r.body.data.batch.status).toBe('validated');
    expect(r.body.data.batch.sheets.map((s) => [s.sheet, s.created])).toEqual([['clients', 2], ['policies', 2], ['open-items', 1], ['claims', 1], ['opening-balances', 4]]);
    expect(r.body.data.batch.reconciliation.checks.every((c) => c.ok)).toBe(true);
    expect(await count("SELECT count(*)::int AS n FROM policies WHERE policy_number LIKE 'OLD-%'")).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM clients WHERE client_code LIKE 'OLD-%'")).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM opening_balances')).toBe(0);
    loaded = r.body.data.batch;
  });

  it('loads flagged records without journals, bills or commission accruals, with a reconciliation', async () => {
    const journals = await count('SELECT count(*)::int AS n FROM journal_vouchers');
    const commissions = await count('SELECT count(*)::int AS n FROM commissions');
    const r = await load(loaded.id);
    expect(r.status).toBe(200);
    expect(r.body.data.batch.status).toBe('loaded');
    const policies = (await query("SELECT * FROM policies WHERE policy_number LIKE 'OLD-%' ORDER BY policy_number")).rows;
    expect(policies).toHaveLength(2);
    for (const p of policies) {
      expect(p.doc.source).toBe('go-live-migration');
      expect(p.load_batch_id).toBe(loaded.id);
      expect(p.bill_number).toBeNull();
      expect(p.status).toBe('active');
    }
    const client = await one("SELECT * FROM clients WHERE client_code = 'OLD-C-0001'");
    expect(client).toMatchObject({ source: 'go-live-migration', load_batch_id: loaded.id, display_name: 'Maria Santos' });
    expect(policies.find((p) => p.policy_number === 'OLD-MC-0001').client_id).toBe(client.id);
    expect(await count('SELECT count(*)::int AS n FROM journal_vouchers')).toBe(journals);
    expect(await count('SELECT count(*)::int AS n FROM commissions')).toBe(commissions);
    // the only bill is the open item, without a booking journal
    const bills = (await query('SELECT * FROM receivables WHERE policy_id = ANY($1)', [policies.map((p) => p.id)])).rows;
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ source: 'opening', reference: 'DN-OLD-77', booking_jv_id: null, load_batch_id: loaded.id });
    expect(Number(bills[0].balance)).toBe(10000);
    const claim = await one("SELECT * FROM claims WHERE claim_number = 'OLD-CLM-0009'");
    expect(claim).toMatchObject({ status: 'in-review', load_batch_id: loaded.id });
    expect(claim.details.source).toBe('go-live-migration');
    const ob = await one(`SELECT count(*)::int AS n, sum(balance) AS s FROM opening_balances WHERE source_run = $1`, [`go-live:${cutover}`]);
    expect(ob).toEqual({ n: 4, s: 0 });
    const rec = r.body.data.reconciliation;
    expect(rec.checks).toEqual([expect.objectContaining({ ok: true, left: 510000, right: 510000 }), expect.objectContaining({ ok: true, left: 10000, right: 10000 })]);
    expect(rec.sheets.find((s) => s.sheet === 'Policies').workbook.grossPremium).toBe(39000);
    const x = await bin(api('get', `/data-load/batches/${loaded.id}/reconciliation`));
    expect(x.status).toBe(200);
    expect(readWorkbook(x.body).map((s) => s.name)).toEqual(['Summary', 'Checks']);
    // reports and lists can filter on the source; the renewal queue sees a normal active policy
    const list = await api('get', '/policies?source=go-live-migration&pageSize=50');
    expect(list.body.data.map((p) => p.policyNumber).sort()).toEqual(['OLD-FI-0002', 'OLD-MC-0001']);
    expect(list.body.data[0].source).toBe('go-live-migration');
  });

  it('loading the same workbook again keeps everything as it is (legacy numbers are the keys)', async () => {
    const r = await upload('migration', workbook());
    expect(r.body.data.batch.rowsError).toBe(0);
    for (const s of r.body.data.batch.sheets) expect(s.unchanged, s.sheet).toBe(s.read);
    expect((await load(r.body.data.batch.id)).status).toBe(200);
    expect(await count("SELECT count(*)::int AS n FROM policies WHERE policy_number LIKE 'OLD-%'")).toBe(2);
    expect(await count("SELECT count(*)::int AS n FROM clients WHERE client_code LIKE 'OLD-%'")).toBe(2);
    expect(await count("SELECT count(*)::int AS n FROM receivables WHERE source = 'opening'")).toBe(1);
    expect(await count("SELECT count(*)::int AS n FROM claims WHERE claim_number LIKE 'OLD-%'")).toBe(1);
    // the workbook with the current (migrated) data is unchanged too
    const t = await bin(api('get', '/data-load/kits/migration/template?prefill=true'));
    const again = await upload('migration', t.body);
    expect(again.body.data.batch.rowsError).toBe(0);
    for (const s of again.body.data.batch.sheets) expect(s.unchanged, s.sheet).toBe(s.read);
    expect(again.body.data.batch.rowsRead).toBe(10);
  });

  it('refuses rows dated on or after the cutover date and policies not in force', async () => {
    const late = policies().map((p, i) => ({ ...p, 'Policy Number': `NEW-${i}`, 'Client Code': 'OLD-C-0001' }));
    late[0]['Issue Date'] = cutover;
    late[1]['Expiry Date'] = addDays(cutover, -1);
    const r = await upload('migration', book('migration', { Policies: late, 'Open Claims': [{ 'Claim Number': 'NEW-CLM', 'Policy Number': 'OLD-MC-0001', 'Loss Date': addDays(cutover, 2), 'Outstanding Estimate': '1000' }] }));
    const errors = r.body.data.errors;
    expect(errors).toEqual([
      expect.objectContaining({ sheet: 'policies', row: 2, column: 'Issue Date', message: expect.stringMatching(/on or after the cutover date/) }),
      expect.objectContaining({ sheet: 'policies', row: 3, column: 'Expiry Date', message: expect.stringMatching(/not in force/) }),
      expect.objectContaining({ sheet: 'claims', row: 2, column: 'Loss Date', message: expect.stringMatching(/cutover/) }),
    ]);
  });

  it('refuses a legacy number in the range a numbering series has still to issue, until the series moves past it', async () => {
    const code = `CL-${year}-00500`;
    const wb = book('migration', { Clients: [{ 'Client Code': code, 'Client Type': 'corporate', 'Company Name': 'Range Test Corp.' }] });
    const r = await upload('migration', wb);
    expect(r.body.data.errors).toEqual([expect.objectContaining({ column: 'Client Code', message: expect.stringMatching(/numbering series/) })]);
    const n = await upload('configuration', book('configuration', { Numbering: [{ 'Series Code': 'client', 'Next Number': '501' }] }));
    expect(n.body.data.batch.status).toBe('validated');
    expect((await load(n.body.data.batch.id)).status).toBe(200);
    const ok = await upload('migration', wb);
    expect(ok.body.data.errors).toEqual([]);
    expect((await load(ok.body.data.batch.id)).status).toBe(200);
    // and the series cannot be moved back below a migrated number of its format
    const back = await upload('configuration', book('configuration', { Numbering: [{ 'Series Code': 'client', 'Next Number': '400' }] }));
    expect(back.body.data.errors[0]).toMatchObject({ column: 'Next Number', message: expect.stringMatching(/backwards/) });
  });

  it('refuses the migration kit once go-live is locked; the configuration kit stays available', async () => {
    const validated = await upload('migration', workbook());
    expect(validated.status).toBe(201);
    await setSettings({ 'golive.locked': true });
    expect(await getSetting('golive.locked')).toBe(true);
    const r = await upload('migration', workbook());
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/locked/);
    expect((await load(validated.body.data.batch.id)).status).toBe(409);
    const c = await upload('configuration', book('configuration', { 'Lines of Business': [{ 'Line of Business Code': 'WBLOB', 'LOB Name': 'Workbench Line', 'LOB Description': 'Test line' }] }));
    expect(c.status).toBe(201);
    await setSettings({ 'golive.locked': false });
  });

  it('lists the batches with status, who, when and counts', async () => {
    const r = await api('get', '/data-load/batches?kit=migration&perPage=50');
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(5);
    const statuses = new Set(r.body.data.map((b) => b.status));
    expect(statuses).toEqual(new Set(['validated', 'failed', 'loaded']));
    const loadedBatch = r.body.data.find((b) => b.id === loaded.id);
    expect(loadedBatch).toMatchObject({ kit: 'migration', status: 'loaded', createdBy: 'BrokerVerse Administrator', loadedBy: 'BrokerVerse Administrator', rowsRead: 10 });
    expect(loadedBatch.loadedCounts.policies.created).toBe(2);
  });
});
