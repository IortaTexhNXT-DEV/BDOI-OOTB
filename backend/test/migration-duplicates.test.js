/**
 * Duplicate detection of a load (data-load/duplicates.js): each rule within the file and against the database (the TIN
 * through the blind index, with the TINs encrypted), the setting that switches rules off, and the resolutions: Load as
 * new (reason kept), Use existing (a value map written and reused by a second batch), a resolution that lapses when the
 * duplicate is gone, and an unresolved duplicate that stops the load. Value maps: list, add, change, remove, download
 * and upload.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { normaliseCompany, normaliseInsurer, normalisePersonName } from '../src/modules/data-load/duplicates.js';
import { goLiveSetup, validatedBatch } from './helpers.js';

let api;
let kits;
let cutover;
const MIGRATION_0441 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations/0441_migration_value_maps.sql');

const bin = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});
function book(sheets, kit = 'migration') {
  const defs = kits.find((k) => k.kit === kit).sheets;
  return writeXlsx({
    sheets: Object.entries(sheets).map(([name, rows]) => {
      const headers = defs.find((s) => s.name === name).columns.map((c) => c.header);
      return { name, columns: headers.map((h) => ({ header: h })), rows: rows.map((r) => headers.map((h) => (r[h] === undefined ? '' : String(r[h])))) };
    }),
  });
}
const upload = (wb, kit = 'migration') => validatedBatch(api, api('post', '/data-load/batches').field('kit', kit).attach('file', wb, `${kit}.xlsx`));
const load = (id) => api('post', `/data-load/batches/${id}/load`).send({});
const rowsOf = async (id) => (await api('get', `/data-load/batches/${id}/rows?perPage=500`)).body.data;
const resolve = (id, body) => validatedBatch(api, api('post', `/data-load/batches/${id}/resolutions`).send(body));
/** Matches of each row of a batch: { key: [rule:kind] }. */
const matches = async (id) => Object.fromEntries((await rowsOf(id)).map((r) => [r.key, r.duplicates.map((m) => `${m.rule}:${m.kind}`)]));

const person = (code, extra = {}) => ({ 'Client Code': code, 'Client Type': 'individual', 'First Name': 'Juan', 'Last Name': code, ...extra });
const company = (code, name, extra = {}) => ({ 'Client Code': code, 'Client Type': 'corporate', 'Company Name': name, ...extra });
const policy = (sheet, number, extra = {}) => ({ 'Policy Number': number, 'Client Code': 'DP-HOLDER', Insurer: 'MALAYAN', Product: sheet === 'ctpl' ? 'CTPL' : 'MOTOR',
  'Inception Date': addDays(cutover, -30), 'Expiry Date': addDays(cutover, 335), 'Issue Date': addDays(cutover, -31), 'Gross Premium': '1000.00', ...extra });

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  const app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  kits = (await api('get', '/data-load/kits')).body.data.kits;
  const now = await today();
  const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  cutover = d.toISOString().slice(0, 10);
  await goLiveSetup(api, cutover);
  clearSettingsCache();
  // records entered in BrokerVerse before the migration
  await query(`INSERT INTO clients(client_code, client_type, first_name, last_name, display_name, tin, birth_date) VALUES
    ('BV-001', 'individual', 'María', 'Dela Cruz', 'María Dela Cruz', '555-666-777-000', '1980-05-06')`);
  await query(`INSERT INTO clients(client_code, client_type, company_name, display_name) VALUES ('BV-002', 'corporate', 'Visayas Cold Storage, Inc.', 'Visayas Cold Storage, Inc.'),
    ('DP-HOLDER', 'corporate', 'Policy Holder Corp.', 'Policy Holder Corp.')`);
  const holder = (await one("SELECT id FROM clients WHERE client_code = 'DP-HOLDER'")).id;
  const mly = (await one("SELECT id FROM insurance_companies WHERE code = 'MALAYAN'")).id;
  const motor = (await one("SELECT id FROM products WHERE code = 'MOTOR'")).id;
  await query(`INSERT INTO policies(policy_number, client_id, insurance_company_id, product_id, status, inception_date, expiry_date, doc) VALUES
    ('BV-POL-1', $1, $2, $3, 'active', $4::date - 60, $4::date + 300, '{"chassisNumber": "MHF-XX12-0001"}')`, [holder, mly, motor, cutover]);
  await query(`INSERT INTO ctpl_authentications(policy_id, policy_number, insurance_company_id, coc_number, status, method, lto_status)
    VALUES ((SELECT id FROM policies WHERE policy_number = 'BV-POL-1'), 'BV-POL-1', $1, 'C77001', 'authenticated', 'manual', 'not-required')`, [mly]);
});
afterAll(async () => {
  await pool.end();
});

describe('normalisation', () => {
  it('compares names, companies and insurers the way people write them', () => {
    expect(normalisePersonName('Juan', 'dela  Cruz Jr.')).toBe(normalisePersonName('JUAN', 'Dela Cruz'));
    expect(normalisePersonName('María', 'Cruz')).not.toBe(normalisePersonName('Maria', 'Cruz'));
    expect(normaliseCompany('Visayas Cold Storage, Inc.')).toBe(normaliseCompany('VISAYAS COLD STORAGE INCORPORATED'));
    expect(normaliseInsurer('Malayan Ins. Co., Inc.')).toBe(normaliseInsurer('Malayan Insurance Company, Inc.'));
  });
});

describe('client rules', () => {
  it('TIN: in the file and against the database through the blind index (TINs encrypted)', async () => {
    expect((await one("SELECT tin FROM clients WHERE client_code = 'BV-001'")).tin).toMatch(/^pii:1:/);
    const r = await upload(book({ Clients: [person('DP-T1', { TIN: '555 666 777 000' }), person('DP-T2', { TIN: '900-100-200-000' }), person('DP-T3', { TIN: '900100200000' })] }));
    expect(await matches(r.body.data.batch.id)).toEqual({ 'DP-T1': ['tin:stored'], 'DP-T2': [], 'DP-T3': ['tin:file'] });
    const row = (await rowsOf(r.body.data.batch.id)).find((x) => x.key === 'DP-T1');
    expect(row.duplicates[0]).toMatchObject({ number: 'BV-001', name: 'María Dela Cruz' });
  });

  it('name and birth date: suffixes, case and spaces set aside, accents kept', async () => {
    const r = await upload(book({ Clients: [
      { 'Client Code': 'DP-N1', 'Client Type': 'individual', 'First Name': 'MARÍA', 'Last Name': 'Dela  Cruz Jr', 'Birth Date': '1980-05-06' },
      { 'Client Code': 'DP-N2', 'Client Type': 'individual', 'First Name': 'Pedro', 'Last Name': 'Reyes', 'Birth Date': '1975-01-01' },
      { 'Client Code': 'DP-N3', 'Client Type': 'individual', 'First Name': 'pedro', 'Last Name': 'Reyes III', 'Birth Date': '1975-01-01' },
      { 'Client Code': 'DP-N4', 'Client Type': 'individual', 'First Name': 'Maria', 'Last Name': 'Dela Cruz', 'Birth Date': '1980-05-06' },
    ] }));
    expect(await matches(r.body.data.batch.id)).toEqual({ 'DP-N1': ['name-birth-date:stored'], 'DP-N2': [], 'DP-N3': ['name-birth-date:file'], 'DP-N4': [] });
  });

  it('company name: legal-form words set aside; two companies with a TIN each are not matched by name', async () => {
    const r = await upload(book({ Clients: [
      company('DP-C1', 'VISAYAS COLD STORAGE INCORPORATED'),
      company('DP-C2', 'Luzon Freight Corp.', { TIN: '111-000-111-000' }),
      company('DP-C3', 'Luzon Freight Corporation', { TIN: '222-000-222-000' }),
      company('DP-C4', 'Luzon Freight Co.'),
    ] }));
    expect(await matches(r.body.data.batch.id)).toEqual({ 'DP-C1': ['company-name:stored'], 'DP-C2': [], 'DP-C3': [], 'DP-C4': ['company-name:file', 'company-name:file'] });
  });

  it('a rule switched off in the setting does not run', async () => {
    expect((await api('put', '/settings').send({ settings: { 'migration.duplicate_rules': ['vehicle', 'coc', 'policy-number', 'insurer-variant', 'master-name'] } })).status).toBe(200);
    clearSettingsCache();
    try {
      const r = await upload(book({ Clients: [person('DP-OFF', { TIN: '555-666-777-000' })] }));
      expect(r.body.data.batch.rowsDuplicate).toBe(0);
    } finally {
      await api('put', '/settings').send({ settings: { 'migration.duplicate_rules': ['tin', 'name-birth-date', 'company-name', 'vehicle', 'coc', 'policy-number', 'insurer-variant', 'master-name'] } });
      clearSettingsCache();
    }
  });
});

describe('policy rules', () => {
  it('vehicle: the same plate, sticker or chassis on another policy of the same sheet over an overlapping period', async () => {
    const r = await upload(book({
      'Policies - Motor': [
        policy('motor', 'DP-M1', { 'Chassis Number': 'mhf xx12 0001' }),
        policy('motor', 'DP-M2', { 'Plate Number': 'ABC 1234' }),
        policy('motor', 'DP-M3', { 'Plate Number': 'abc-1234' }),
        policy('motor', 'DP-M4', { 'Plate Number': 'ABC 1234', 'Inception Date': addDays(cutover, 340), 'Expiry Date': addDays(cutover, 700), 'Issue Date': addDays(cutover, -5) }),
      ],
      // the CTPL of the same car is not a duplicate of its motor policy
      'Policies - CTPL': [policy('ctpl', 'DP-T1', { 'Plate Number': 'ABC 1234', 'COC Number': 'C88001', 'Expiry Date': addDays(cutover, 300) })],
    }));
    expect(await matches(r.body.data.batch.id)).toEqual({ 'DP-M1': ['vehicle:stored'], 'DP-M2': [], 'DP-M3': ['vehicle:file'], 'DP-M4': [], 'DP-T1': [] });
  });

  it('COC: the same number of the same insurer in the file or among the CTPL authentications', async () => {
    const r = await upload(book({ 'Policies - CTPL': [
      policy('ctpl', 'DP-K1', { 'Plate Number': 'K1', 'COC Number': 'C77001', 'Expiry Date': addDays(cutover, 300) }),
      policy('ctpl', 'DP-K2', { 'Plate Number': 'K2', 'COC Number': 'C99002', 'Expiry Date': addDays(cutover, 300) }),
      policy('ctpl', 'DP-K3', { 'Plate Number': 'K3', 'COC Number': 'c99002', 'Expiry Date': addDays(cutover, 300) }),
      policy('ctpl', 'DP-K4', { 'Plate Number': 'K4', 'COC Number': 'C99002', Insurer: 'FPG', 'Expiry Date': addDays(cutover, 300) }),
    ] }));
    expect(await matches(r.body.data.batch.id)).toEqual({ 'DP-K1': ['coc:stored'], 'DP-K2': [], 'DP-K3': ['coc:file'], 'DP-K4': [] });
  });

  it('insurer variant: Use existing maps the spelling, and a second batch resolves it without a duplicate', async () => {
    const r = await upload(book({ 'Policies - Motor': [policy('motor', 'DP-V1', { Insurer: 'Malayan Ins. Co., Inc.', 'Plate Number': 'V1' })] }));
    const id = r.body.data.batch.id;
    const [row] = await rowsOf(id);
    expect(row).toMatchObject({ result: 'duplicate', duplicates: [expect.objectContaining({ rule: 'insurer-variant', kind: 'stored', number: 'MALAYAN' })] });
    expect((await load(id)).status).toBe(409);
    const res = await resolve(id, { rule: 'insurer-variant', resolution: 'use-existing', reason: 'Legacy spelling of Malayan' });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ resolved: 1, maps: 1 });
    expect(await one("SELECT target_code, legacy_value FROM migration_value_maps WHERE object = 'insurer'")).toEqual({ target_code: 'MALAYAN', legacy_value: 'Malayan Ins. Co., Inc.' });
    // the spelling now resolves to the insurer: the row is no longer a duplicate and creates its policy with MALAYAN,
    // and a second batch with another spelling of the same normalised value does the same
    expect((await rowsOf(id))[0]).toMatchObject({ result: 'new', duplicates: [], resolution: null });
    expect((await load(id)).status).toBe(200);
    const second = await upload(book({ 'Policies - Motor': [policy('motor', 'DP-V2', { Insurer: 'MALAYAN INS CO INC', 'Plate Number': 'V2' })] }));
    expect(second.body.data.batch).toMatchObject({ rowsDuplicate: 0, rowsNew: 1 });
    expect((await load(second.body.data.batch.id)).status).toBe(200);
    expect((await one("SELECT ic.code FROM policies p JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE p.policy_number = 'DP-V2'")).code).toBe('MALAYAN');
  });
});

describe('resolutions', () => {
  it('an unresolved duplicate stops the load; Load as new loads it and keeps the reason', async () => {
    const r = await upload(book({ Clients: [person('DP-R1', { TIN: '555-666-777-000' })] }));
    const id = r.body.data.batch.id;
    const l = await load(id);
    expect(l.status).toBe(409);
    expect(l.body.message).toMatch(/1 row\(s\) are duplicates/);
    expect((await resolve(id, { rule: 'tin', resolution: 'load-as-new' })).status).toBe(400);
    const res = await resolve(id, { rule: 'tin', resolution: 'load-as-new', reason: 'Two persons share a TIN in the legacy file; corrected later' });
    expect(res.body.data.batch).toMatchObject({ rowsDuplicate: 0, rowsNew: 1 });
    expect((await load(id)).status).toBe(200);
    const row = await one('SELECT status, resolution, resolution_reason, duplicates FROM data_load_rows WHERE batch_id = $1', [id]);
    expect(row).toMatchObject({ status: 'loaded', resolution: 'load-as-new', resolution_reason: expect.stringMatching(/share a TIN/) });
    expect(row.duplicates[0]).toMatchObject({ rule: 'tin', number: 'BV-001' });
    const audit = await one("SELECT after_data FROM audit_log WHERE entity = 'data_load_batch' AND entity_id = $1 AND action = 'resolve-duplicate'", [String(id)]);
    expect(audit.after_data).toMatchObject({ resolution: 'load-as-new', rule: 'tin' });
  });

  it('Use existing on a client maps the legacy code: the policies of a later batch attach to the existing client', async () => {
    const r = await upload(book({ Clients: [company('LEG-77', 'Visayas Cold Storage Inc')] }));
    const id = r.body.data.batch.id;
    const res = await resolve(id, { rows: [(await rowsOf(id))[0].id], resolution: 'use-existing', reason: 'Client already in BrokerVerse' });
    expect(res.body.data.maps).toBe(1);
    expect((await load(id)).status).toBe(200);
    expect(await one("SELECT count(*)::int AS n FROM clients WHERE client_code = 'LEG-77'")).toEqual({ n: 0 });
    const p = await upload(book({ 'Policies - Motor': [policy('motor', 'DP-U1', { 'Client Code': 'LEG-77', 'Plate Number': 'U1' })] }));
    expect(p.body.data.errors).toEqual([]);
    expect((await load(p.body.data.batch.id)).status).toBe(200);
    expect((await one("SELECT c.client_code FROM policies p JOIN clients c ON c.id = p.client_id WHERE p.policy_number = 'DP-U1'")).client_code).toBe('BV-002');
  });

  it('a resolution lapses when the next validation no longer finds the duplicate', async () => {
    const r = await upload(book({ Clients: [person('DP-L1', { TIN: '777-000-111-000' })] }));
    const id = r.body.data.batch.id;
    await query("INSERT INTO clients(client_code, client_type, company_name, display_name, tin) VALUES ('BV-LAPSE', 'corporate', 'Lapse Co.', 'Lapse Co.', '777-000-111-000')");
    const v = await validatedBatch(api, api('post', `/data-load/batches/${id}/validate`));
    expect(v.body.data.batch.rowsDuplicate).toBe(1);
    await resolve(id, { rule: 'tin', resolution: 'load-as-new', reason: 'Different persons' });
    await query("DELETE FROM clients WHERE client_code = 'BV-LAPSE'");
    await validatedBatch(api, api('post', `/data-load/batches/${id}/validate`));
    expect(await one('SELECT resolution, resolved_by FROM data_load_rows WHERE batch_id = $1', [id])).toEqual({ resolution: null, resolved_by: null });
  });

  it('a configuration master with the name of another record is a duplicate (master-name)', async () => {
    const insurers = kits.find((k) => k.kit === 'configuration').sheets.find((s) => s.name === 'Insurers').columns;
    const h = (key) => insurers.find((c) => c.key === key).header;
    const row = { insuranceCompanyCode: 'MALAYAN2', insuranceCompanyName: 'Malayan Insurance Co., Inc.', city: 'Makati', state: 'Metro Manila', country: 'Philippines',
      email: 'uw@malayan2.example.ph', phoneNumber: '+63 2 8000 2222' };
    const r = await upload(book({ Insurers: [Object.fromEntries(Object.entries(row).map(([k, v]) => [h(k), v]))] }, 'configuration'), 'configuration');
    expect((await rowsOf(r.body.data.batch.id))[0]).toMatchObject({ result: 'duplicate', duplicates: [expect.objectContaining({ rule: 'master-name', number: 'MALAYAN' })] });
  });
});

describe('value maps', () => {
  it('are listed, added, changed, removed, downloaded and uploaded, checked against the masters and audited', async () => {
    const bad = await api('post', '/data-load/value-maps').send({ object: 'product', legacyValue: 'MC-COMP', targetCode: 'NOPE' });
    expect(bad.status).toBe(400);
    const add = await api('post', '/data-load/value-maps').send({ object: 'product', legacyValue: 'MC-COMP', targetCode: 'motor' });
    expect(add.body.data).toMatchObject({ object: 'product', legacyValue: 'MC-COMP', targetCode: 'MOTOR' });
    const ch = await api('put', `/data-load/value-maps/${add.body.data.id}`).send({ targetCode: 'CTPL' });
    expect(ch.body.data.targetCode).toBe('CTPL');
    const list = await api('get', '/data-load/value-maps?object=product');
    expect(list.body.data.map((m) => m.legacyValue)).toEqual(['MC-COMP']);
    const x = await bin(api('get', '/data-load/value-maps/workbook'));
    const sheet = readWorkbook(x.body).find((s) => s.name === 'Value Maps');
    expect(sheet.rows[0]).toEqual(['Object *', 'Legacy Value *', 'BrokerVerse Code *', 'Note']);
    const up = writeXlsx({ sheets: [{ name: 'Value Maps', columns: sheet.rows[0].map((hd) => ({ header: hd })), rows: [['branch', 'Makati Br.', 'HO', ''], ['user', 'JDC', 'nouser', '']] }] });
    const refused = await api('post', '/data-load/value-maps/upload').attach('file', up, 'maps.xlsx');
    expect(refused.status).toBe(400);
    expect(refused.body.data.errors).toEqual([expect.objectContaining({ row: 3, column: 'BrokerVerse Code' })]);
    const good = writeXlsx({ sheets: [{ name: 'Value Maps', columns: sheet.rows[0].map((hd) => ({ header: hd })), rows: [['branch', 'Makati Br.', 'HO', ''], ['product', 'mc-comp', 'MOTOR', '']] }] });
    const ok = await api('post', '/data-load/value-maps/upload').attach('file', good, 'maps.xlsx');
    expect(ok.body.data).toMatchObject({ created: 1, updated: 1 });
    expect((await api('delete', `/data-load/value-maps/${add.body.data.id}`)).status).toBe(200);
    const actions = (await query("SELECT action FROM audit_log WHERE entity = 'migration_value_map' ORDER BY id")).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['create', 'update', 'upload', 'delete']));
  });
});

describe('migration 0441', () => {
  it('runs twice without change and encrypts the identifiers of load rows written before it', async () => {
    const sql = fs.readFileSync(MIGRATION_0441, 'utf8');
    const maps = (await one('SELECT count(*)::int AS n FROM migration_value_maps')).n;
    const batch = (await one("SELECT id FROM data_load_batches ORDER BY id LIMIT 1")).id;
    await query('ALTER TABLE data_load_rows DISABLE TRIGGER data_load_rows_pii');
    const r = await one(`INSERT INTO data_load_rows(batch_id, sheet, row_number, data) VALUES ($1, 'clients', 99, '{"clientCode": "OLD-ROW", "tin": "123-123-123-000"}') RETURNING id`, [batch]);
    await query('ALTER TABLE data_load_rows ENABLE TRIGGER data_load_rows_pii');
    await query(sql);
    await query(sql);
    const row = await one('SELECT data FROM data_load_rows WHERE id = $1', [r.id]);
    expect(row.data.tin).toMatch(/^pii:1:/);
    expect((await one('SELECT count(*)::int AS n FROM migration_value_maps')).n).toBe(maps);
    expect((await query("SELECT tgname FROM pg_trigger WHERE tgname = 'data_load_rows_pii'")).rows).toHaveLength(1);
  });
});
