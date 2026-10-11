/**
 * Origin of the business records (migration 0440, lib/origin.js): every importer of the migration kit and the
 * single-object go-live imports tag what they create as migrated (legacy system, legacy number, migrated at / by, load);
 * the APIs of clients, policies, claims, collections, open bills and journal vouchers return the origin block and filter
 * on ?origin; the origin fields are read-only on update; 0440 back-fills the records migrated before it from the older
 * flags and runs twice without change.
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
import { addDays, today } from '../src/lib/dates.js';
import { kpiOriginWhere, originOf, originParam, originWhere, withoutOriginFields } from '../src/lib/origin.js';
import { goLiveSetup, validatedBatch } from './helpers.js';

const MIGRATION_0440 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations/0440_migration_origin.sql');

let app;
let api;
let kits;
let cutover;
let batch;
let admin;

function book(sheets) {
  const defs = kits.find((k) => k.kit === 'migration').sheets;
  return writeXlsx({
    sheets: Object.entries(sheets).map(([name, rows]) => {
      const headers = defs.find((s) => s.name === name).columns.map((c) => c.header);
      return { name, columns: headers.map((h) => ({ header: h })), rows: rows.map((r) => headers.map((h) => (r[h] === undefined ? '' : String(r[h])))) };
    }),
  });
}
const sheet = (rows) => writeXlsx({ sheets: [{ name: 'Data', columns: Object.keys(rows[0]).map((h) => ({ header: h })), rows: rows.map((r) => Object.values(r).map(String)) }] });

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  admin = (await one("SELECT id, display_name FROM users WHERE username = 'BrokerVerse'"));
  kits = (await api('get', '/data-load/kits')).body.data.kits;
  const now = await today();
  const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  cutover = d.toISOString().slice(0, 10);
  await goLiveSetup(api, cutover);
  clearSettingsCache();
});
afterAll(async () => {
  await pool.end();
});

describe('origin helpers', () => {
  it('filters, labels and protects the origin', async () => {
    expect(originParam('')).toBeNull();
    expect(originParam('ALL')).toBeNull();
    expect(originParam('Migrated')).toBe('migrated');
    expect(() => originParam('legacy')).toThrow(/origin must be/);
    const params = [1];
    expect(originWhere('p', 'issued', params)).toBe('p.origin = $2');
    expect(params).toEqual([1, 'issued']);
    expect(originWhere('p', 'all', params)).toBe('');
    expect(await kpiOriginWhere('p', 'kpi')).toBe("p.origin = 'issued'");
    expect(originOf({ origin: 'issued' })).toEqual({ kind: 'issued', label: 'Issued in BrokerVerse' });
    expect(originOf({ origin: 'migrated', legacy_number: 'L-1', legacy_system: 'TISPH Excel', load_batch_id: 12 })).toMatchObject({
      kind: 'migrated', label: 'Migrated', legacyNumber: 'L-1', legacySystem: 'TISPH Excel', loadId: 12, loadNumber: 'MIG-000012' });
    const row = { origin: 'migrated', legacy_number: 'L-1', legacy_system: 'X', load_batch_id: 3 };
    expect(withoutOriginFields({ email: 'a@b.ph', origin: originOf(row) }, row)).toEqual({ email: 'a@b.ph' });
    expect(() => withoutOriginFields({ origin: 'issued' }, row)).toThrow(/cannot be changed/);
    expect(() => withoutOriginFields({ legacyNumber: 'L-2' }, row)).toThrow(/cannot be changed/);
  });
});

describe('migration load', () => {
  it('tags every record it creates with the origin, the legacy system of the load and its uploader', async () => {
    const issue = addDays(cutover, -40);
    const wb = book({
      Clients: [{ 'Client Code': 'LEG-C-0001', 'Client Type': 'individual', 'First Name': 'Andrea', 'Last Name': 'Lim', Email: 'andrea@example.ph' }],
      Policies: [{ 'Policy Number': 'PC-MLY-2026-000101', 'Client Code': 'LEG-C-0001', Insurer: 'MALAYAN', Product: 'MOTOR', 'Inception Date': addDays(issue, 1),
        'Expiry Date': addDays(cutover, 300), 'Issue Date': issue, 'Net Premium': '20000', 'Gross Premium': '25000', 'Payment Status': 'Partial' }],
      'Open Items': [{ 'Policy Number': 'PC-MLY-2026-000101', 'Bill Reference': 'DN-LEG-1', 'Due Date': addDays(cutover, 15), 'Original Amount': '25000', 'Open Balance': '10000' }],
      'Open Claims': [{ 'Claim Number': 'LEG-CLM-1', 'Policy Number': 'PC-MLY-2026-000101', 'Loss Date': addDays(issue, 10), 'Outstanding Estimate': '45000' }],
      'Opening Balances': [{ 'Account Code': '1202001', Debit: '10000' }, { 'Account Code': '2201001', Credit: '10000' }],
    });
    const r = await validatedBatch(api, api('post', '/data-load/batches').field('kit', 'migration').field('legacySystem', 'TISPH Excel').attach('file', wb, 'migration.xlsx'));
    expect(r.status).toBe(202);
    expect(r.body.data.errors).toEqual([]);
    batch = r.body.data.batch;
    expect(batch).toMatchObject({ loadNumber: `MIG-${String(batch.id).padStart(6, '0')}`, legacySystem: 'TISPH Excel' });
    expect((await api('post', `/data-load/batches/${batch.id}/load`).send({})).status).toBe(200);

    const tagged = { origin: 'migrated', legacy_system: 'TISPH Excel', migrated_by: admin.id, load_batch_id: batch.id };
    expect(await one("SELECT * FROM clients WHERE client_code = 'LEG-C-0001'")).toMatchObject({ ...tagged, legacy_number: 'LEG-C-0001', migrated_at: expect.any(Date) });
    expect(await one("SELECT * FROM policies WHERE policy_number = 'PC-MLY-2026-000101'")).toMatchObject({ ...tagged, legacy_number: 'PC-MLY-2026-000101' });
    expect(await one("SELECT * FROM receivables WHERE reference = 'DN-LEG-1'")).toMatchObject({ ...tagged, legacy_number: 'DN-LEG-1' });
    expect(await one("SELECT * FROM claims WHERE claim_number = 'LEG-CLM-1'")).toMatchObject({ ...tagged, legacy_number: 'LEG-CLM-1' });
    expect((await query('SELECT DISTINCT load_batch_id FROM opening_balances WHERE source_run = $1', [`go-live:${cutover}`])).rows).toEqual([{ load_batch_id: batch.id }]);
    // each row keeps the record it created
    const rows = (await query('SELECT sheet, record_table, record_key FROM data_load_rows WHERE batch_id = $1 AND record_id IS NOT NULL ORDER BY sheet', [batch.id])).rows;
    expect(rows).toEqual([
      { sheet: 'claims', record_table: 'claims', record_key: 'LEG-CLM-1' },
      { sheet: 'clients', record_table: 'clients', record_key: 'LEG-C-0001' },
      { sheet: 'open-items', record_table: 'receivables', record_key: 'PC-MLY-2026-000101 / DN-LEG-1' },
      { sheet: 'policies', record_table: 'policies', record_key: 'PC-MLY-2026-000101' },
    ]);
  });

  it('the single-object go-live imports tag their records as migrated too', async () => {
    const p = await api('post', '/policies/bulk-upload').field('mode', 'go-live').attach('file', sheet([{ 'Policy Number': 'OLD-UP-0001', 'Insured Name': 'Jose Reyes',
      'Insurance Company': 'MALAYAN', 'Inception Date': addDays(cutover, -30), 'Expiry Date': addDays(cutover, 330), 'Issue Date': addDays(cutover, -31), 'Gross Premium': '12000' }]), 'policies.xlsx');
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    expect(p.body.data.created).toBe(1);
    const policy = await one("SELECT * FROM policies WHERE policy_number = 'OLD-UP-0001'");
    expect(policy).toMatchObject({ origin: 'migrated', legacy_number: 'OLD-UP-0001', legacy_system: 'Legacy', migrated_by: admin.id, load_batch_id: null });
    expect(await one('SELECT origin, legacy_system FROM clients WHERE id = $1', [policy.client_id])).toEqual({ origin: 'migrated', legacy_system: 'Legacy' });
    const o = await api('post', '/receipts/opening-items/import').field('goLiveDate', cutover)
      .attach('file', sheet([{ 'Policy Number': 'OLD-UP-0001', 'Bill Reference': 'DN-UP-1', 'Due Date': addDays(cutover, 10), 'Open Balance': '5000' }]), 'items.xlsx');
    expect(o.status, JSON.stringify(o.body)).toBe(200);
    expect(await one("SELECT origin, legacy_number, migrated_by FROM receivables WHERE reference = 'DN-UP-1'")).toEqual({ origin: 'migrated', legacy_number: 'DN-UP-1', migrated_by: admin.id });
  });

  it('a record entered in BrokerVerse is issued', async () => {
    const c = await api('post', '/clients').send({ firstName: 'Nina', lastName: 'Cruz', emailId: 'nina@example.ph', contactNumber: '09171112222', leadCategory: 'Retail' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const id = c.body.data?.id || c.body.data?.clientId || c.body.id;
    expect(await one('SELECT origin, legacy_number, migrated_at FROM clients WHERE id = $1', [id])).toEqual({ origin: 'issued', legacy_number: null, migrated_at: null });
  });
});

describe('API origin block and filter', () => {
  const migratedBlock = () => ({ kind: 'migrated', label: 'Migrated', legacySystem: 'TISPH Excel', loadId: batch.id, loadNumber: batch.loadNumber, migratedByName: admin.display_name });

  it('clients', async () => {
    const all = (await api('get', '/clients?pageSize=100')).body.data.clients;
    const legacy = all.find((c) => c.clientCode === 'LEG-C-0001');
    expect(legacy.origin).toMatchObject({ ...migratedBlock(), legacyNumber: 'LEG-C-0001' });
    expect(all.find((c) => c.firstName === 'Nina').origin).toEqual({ kind: 'issued', label: 'Issued in BrokerVerse' });
    const migrated = (await api('get', '/clients?origin=migrated&pageSize=100')).body.data.clients;
    expect(migrated.every((c) => c.origin.kind === 'migrated')).toBe(true);
    expect(migrated.map((c) => c.clientCode)).toContain('LEG-C-0001');
    const issued = (await api('get', '/clients?origin=issued&pageSize=100')).body.data.clients;
    expect(issued.map((c) => c.firstName)).toContain('Nina');
    expect(issued.some((c) => c.origin.kind === 'migrated')).toBe(false);
    expect((await api('get', '/clients?origin=legacy')).status).toBe(400);
    const one_ = await api('get', `/clients/${legacy.id}`);
    expect((one_.body.data || one_.body).origin.legacyNumber).toBe('LEG-C-0001');
  });

  it('policies', async () => {
    const list = (await api('get', '/policies?origin=migrated&pageSize=50')).body.data;
    expect(list.map((p) => p.policyNumber).sort()).toEqual(['OLD-UP-0001', 'PC-MLY-2026-000101']);
    expect(list.find((p) => p.policyNumber === 'PC-MLY-2026-000101').origin).toMatchObject({ ...migratedBlock(), legacyNumber: 'PC-MLY-2026-000101' });
    expect((await api('get', '/policies?origin=issued&pageSize=50')).body.data.some((p) => p.origin.kind === 'migrated')).toBe(false);
    const p = await api('get', '/policies/PC-MLY-2026-000101');
    expect((p.body.data || p.body).origin.kind).toBe('migrated');
  });

  it('claims', async () => {
    const items = (await api('get', '/claims?origin=migrated')).body.data.claims;
    expect(items.map((c) => c.claimNumber)).toEqual(['LEG-CLM-1']);
    expect(items[0]).toMatchObject({ origin: { ...migratedBlock(), legacyNumber: 'LEG-CLM-1' }, policyOrigin: 'migrated', policyLegacyNumber: 'PC-MLY-2026-000101' });
    expect((await api('get', '/claims?origin=issued')).body.data.claims).toEqual([]);
  });

  it('collections and the open bills of a receipt', async () => {
    const list = (await api('get', '/collections?origin=migrated')).body.data;
    expect(list.map((c) => c.billNumber).sort()).toEqual(['DN-LEG-1', 'DN-UP-1']);
    expect(list.find((c) => c.billNumber === 'DN-LEG-1')).toMatchObject({ origin: { ...migratedBlock(), legacyNumber: 'DN-LEG-1' }, policyOrigin: 'migrated' });
    expect((await api('get', '/collections?origin=issued')).body.data).toEqual([]);
    const open = (await api('get', '/receipts/open-receivables?origin=migrated')).body.data;
    expect(open.map((b) => b.billNumber).sort()).toEqual(['DN-LEG-1', 'DN-UP-1']);
    expect(open[0].origin.kind).toBe('migrated');
  });

  it('journal vouchers', async () => {
    await query(`INSERT INTO journal_vouchers(jv_number, jv_date, status, source, kind, total_debit, total_credit, origin, legacy_system, legacy_number, migrated_at, migrated_by, load_batch_id)
      VALUES ('OBJ-T-1', $1::date - 1, 'opening', 'go-live-opening', 'standard', 10000, 10000, 'migrated', 'TISPH Excel', $2, now(), $3, $4),
             ('JV-T-1', $1, 'draft', 'manual', 'standard', 0, 0, 'issued', NULL, NULL, NULL, NULL, NULL)`, [cutover, batch.loadNumber, admin.id, batch.id]);
    const migrated = (await api('get', '/journal-vouchers/history?all=true&origin=migrated')).body.data;
    // the opening balance journal of the load and the one inserted here
    expect(migrated.map((j) => j.transactionNumber)).toContain('OBJ-T-1');
    expect(migrated.every((j) => j.origin.kind === 'migrated')).toBe(true);
    expect(migrated.find((j) => j.transactionNumber === 'OBJ-T-1').origin).toMatchObject({ ...migratedBlock(), legacyNumber: batch.loadNumber });
    const issued = (await api('get', '/journal-vouchers/history?all=true&origin=issued')).body.data;
    expect(issued.map((j) => j.transactionNumber)).toContain('JV-T-1');
    expect(issued.some((j) => j.origin.kind === 'migrated')).toBe(false);
    const one_ = await api('get', '/journal-vouchers/OBJ-T-1');
    expect((one_.body.data || one_.body).origin.kind).toBe('migrated');
  });
});

describe('business issued in BrokerVerse on a migrated policy', () => {
  it('endorsements, renewals and the renewed term carry the origin of the migrated policy and its legacy number', async () => {
    const policy = await one("SELECT * FROM policies WHERE policy_number = 'PC-MLY-2026-000101'");
    const e = await one("INSERT INTO endorsements(policy_id, endorsement_type) VALUES ($1, 'change') RETURNING id", [policy.id]);
    const end = await api('get', `/endorsements/${e.id}`);
    expect(end.status).toBe(200);
    expect(end.body.data).toMatchObject({ policyOrigin: 'migrated', policyLegacyNumber: 'PC-MLY-2026-000101' });

    await query("INSERT INTO renewals(renewal_number, policy_id, client_id, status, due_date, premium_old) VALUES ('RN-ORIG-1', $1, $2, 'pipeline', $3, 25000)",
      [policy.id, policy.client_id, policy.expiry_date]);
    const renewals = (await api('get', '/policy-renewals?origin=migrated&limit=50')).body.data;
    expect(renewals.map((r) => r.renewalNumber)).toEqual(['RN-ORIG-1']);
    expect(renewals[0]).toMatchObject({ policyOrigin: 'migrated', policyLegacyNumber: 'PC-MLY-2026-000101' });
    expect((await api('get', '/policy-renewals?origin=issued&limit=50')).body.data.map((r) => r.renewalNumber)).not.toContain('RN-ORIG-1');
    const queue = (await api('get', '/renewals/queue?origin=migrated&pageSize=50')).body.data;
    expect(queue.map((r) => r.renewalNumber)).toEqual(['RN-ORIG-1']);

    // the renewed term is issued in BrokerVerse and points to the legacy term
    await query(`INSERT INTO policies SELECT (jsonb_populate_record(NULL::policies, to_jsonb(p) || jsonb_build_object('id', 'pol_orig_renewed', 'policy_number', 'POL-ORIG-1',
        'origin', 'issued', 'legacy_system', NULL, 'legacy_number', NULL, 'migrated_at', NULL, 'migrated_by', NULL, 'load_batch_id', NULL, 'doc', p.doc - 'source',
        'renewed_from', p.id))).* FROM policies p WHERE p.id = $1`, [policy.id]);
    const renewed = (await api('get', '/policies/POL-ORIG-1')).body.data;
    expect(renewed).toMatchObject({ origin: { kind: 'issued' }, renewedFrom: policy.id, renewedFromOrigin: 'migrated', renewedFromLegacyNumber: 'PC-MLY-2026-000101' });
    const legacy = (await api('get', '/policies/PC-MLY-2026-000101')).body.data;
    expect(legacy).toMatchObject({ renewedFrom: null, renewedFromOrigin: null, renewedFromLegacyNumber: null });
    await query("DELETE FROM policies WHERE id = 'pol_orig_renewed'");
    await query("DELETE FROM renewals WHERE renewal_number = 'RN-ORIG-1'");
    await query('DELETE FROM endorsements WHERE id = $1', [e.id]);
  });
});

describe('dashboard settings', () => {
  it('serve the origin view the dashboards open on and the cutover date to any signed-in user', async () => {
    const r = await api('get', '/dashboard/settings');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ defaultOrigin: 'issued', cutoverDate: cutover });
    await query("UPDATE app_settings SET value = '\"all\"' WHERE key = 'dashboard.default_origin'");
    clearSettingsCache();
    expect((await api('get', '/dashboard/settings')).body.data.defaultOrigin).toBe('all');
    await query("UPDATE app_settings SET value = '\"issued\"' WHERE key = 'dashboard.default_origin'");
    clearSettingsCache();
    expect((await request(app).get('/api/dashboard/settings')).status).toBe(401);
  });
});

describe('origin fields are read-only', () => {
  it('refuses a change of origin, legacy number or load on a client, a policy and a claim; a body sending back what it read is accepted', async () => {
    const client = await one("SELECT id FROM clients WHERE client_code = 'LEG-C-0001'");
    expect((await api('put', `/clients/${client.id}`).send({ origin: 'issued' })).status).toBe(400);
    expect((await api('put', `/clients/${client.id}`).send({ legacyNumber: 'X-1' })).status).toBe(400);
    expect((await api('put', `/clients/${client.id}`).send({ loadBatchId: null })).status).toBe(400);
    const read = await api('get', `/clients/${client.id}`);
    const body = read.body.data || read.body;
    const ok = await api('put', `/clients/${client.id}`).send({ ...body, emailId: 'andrea.lim@example.ph' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(await one('SELECT email, origin, legacy_number, load_batch_id FROM clients WHERE id = $1', [client.id]))
      .toEqual({ email: 'andrea.lim@example.ph', origin: 'migrated', legacy_number: 'LEG-C-0001', load_batch_id: batch.id });
    expect((await one('SELECT extra FROM clients WHERE id = $1', [client.id])).extra.origin).toBeUndefined();

    const policy = await one("SELECT id FROM policies WHERE policy_number = 'PC-MLY-2026-000101'");
    const p = await api('put', `/policies/${policy.id}`).send({ legacyNumber: 'OTHER' });
    expect(p.status).toBe(400);
    expect(p.body.message).toMatch(/cannot be changed/);
    expect((await api('put', `/policies/${policy.id}`).send({ origin: { kind: 'issued' } })).status).toBe(400);
    expect((await api('put', `/policies/${policy.id}`).send({ origin: { kind: 'migrated', legacyNumber: 'PC-MLY-2026-000101' }, plateNumber: 'NAB 1234' })).status).toBe(200);
    const stored = await one('SELECT origin, legacy_number, doc FROM policies WHERE id = $1', [policy.id]);
    expect(stored).toMatchObject({ origin: 'migrated', legacy_number: 'PC-MLY-2026-000101' });
    expect(stored.doc.plateNumber).toBe('NAB 1234');
    expect(stored.doc.origin).toBeUndefined();

    const claim = await one("SELECT id FROM claims WHERE claim_number = 'LEG-CLM-1'");
    expect((await api('put', `/claims/${claim.id}`).send({ origin: 'issued' })).status).toBe(400);
  });
});

describe('migration 0440', () => {
  it('back-fills the origin of records migrated before it from the older flags, and runs twice without change', async () => {
    // records as they were before 0440: flags only
    await query("UPDATE clients SET origin = 'issued', legacy_system = NULL, legacy_number = NULL, migrated_at = NULL, migrated_by = NULL WHERE client_code = 'LEG-C-0001'");
    await query("UPDATE policies SET origin = 'issued', legacy_system = NULL, legacy_number = NULL, migrated_at = NULL, migrated_by = NULL WHERE policy_number IN ('PC-MLY-2026-000101', 'OLD-UP-0001')");
    await query("UPDATE receivables SET origin = 'issued', legacy_system = NULL, legacy_number = NULL, migrated_at = NULL, migrated_by = NULL WHERE source = 'opening'");
    await query("UPDATE claims SET origin = 'issued', legacy_system = NULL, legacy_number = NULL, migrated_at = NULL, migrated_by = NULL WHERE claim_number = 'LEG-CLM-1'");
    await query('UPDATE opening_balances SET load_batch_id = NULL');
    const sql = fs.readFileSync(MIGRATION_0440, 'utf8');
    await query(sql);
    const snapshot = async () => (await query(`SELECT 'client' AS t, client_code AS k, origin, legacy_number, legacy_system, migrated_by, migrated_at FROM clients WHERE origin = 'migrated'
      UNION ALL SELECT 'policy', policy_number, origin, legacy_number, legacy_system, migrated_by, migrated_at FROM policies WHERE origin = 'migrated'
      UNION ALL SELECT 'receivable', bill_number, origin, legacy_number, legacy_system, migrated_by, migrated_at FROM receivables WHERE origin = 'migrated'
      UNION ALL SELECT 'claim', claim_number, origin, legacy_number, legacy_system, migrated_by, migrated_at FROM claims WHERE origin = 'migrated' ORDER BY 1, 2`)).rows
      .filter((r) => r.legacy_number);
    const first = await snapshot();
    expect(first.map((r) => [r.t, r.k, r.legacy_number, r.legacy_system, r.migrated_by])).toEqual([
      ['claim', 'LEG-CLM-1', 'LEG-CLM-1', 'Legacy', admin.id],
      ['client', 'LEG-C-0001', 'LEG-C-0001', 'Legacy', admin.id],
      ['policy', 'OLD-UP-0001', 'OLD-UP-0001', 'Legacy', admin.id],
      ['policy', 'PC-MLY-2026-000101', 'PC-MLY-2026-000101', 'Legacy', admin.id],
      ['receivable', 'DN-LEG-1', 'DN-LEG-1', 'Legacy', admin.id],
      ['receivable', 'DN-UP-1', 'DN-UP-1', 'Legacy', admin.id],
    ]);
    expect(first.every((r) => r.migrated_at instanceof Date)).toBe(true);
    expect((await query('SELECT DISTINCT load_batch_id FROM opening_balances')).rows).toEqual([{ load_batch_id: batch.id }]);
    await query(sql);
    expect(await snapshot()).toEqual(first);
    expect(await one("SELECT count(*)::int AS n FROM sod_rules WHERE code = 'SOD-ACC-LOAD-APPROVE'")).toEqual({ n: 1 });
    expect(await one("SELECT count(*)::int AS n FROM permissions WHERE code = 'approve:data-load'")).toEqual({ n: 1 });
    expect((await one("SELECT value FROM app_settings WHERE key = 'privacy.masking_exempt_paths'")).value).not.toContain('/api/data-load');
  });

  it('grants the workspace to the TISPH roles and creates the read-only auditor role', async () => {
    const grants = (await query(`SELECT r.code, array_agg(p.code ORDER BY p.code) AS perms FROM roles r JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id WHERE p.module = 'data-load' GROUP BY r.code ORDER BY r.code`)).rows;
    expect(Object.fromEntries(grants.map((g) => [g.code, g.perms]))).toMatchObject({
      'system-admin': ['approve:data-load', 'read:data-load', 'write:data-load'],
      'tis-it-admin': ['read:data-load', 'write:data-load'],
      'tis-finance': ['approve:data-load', 'read:data-load', 'write:data-load'],
      'tis-ops-unit-head': ['approve:data-load', 'read:data-load'],
      'tis-general-manager': ['approve:data-load', 'read:data-load'],
      'tis-auditor': ['read:data-load'],
    });
    const auditor = (await query(`SELECT p.code FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
      WHERE r.code = 'tis-auditor' AND p.code LIKE 'write:%' AND p.code NOT IN ('write:profile', 'write:notifications')`)).rows;
    expect(auditor).toEqual([]);
    // the auditor reads the records and ledgers it reconciles (migration 0445), never personal data in full
    const reads = (await query(`SELECT p.code FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
      WHERE r.code = 'tis-auditor' ORDER BY p.code`)).rows.map((p) => p.code);
    expect(reads).toEqual(expect.arrayContaining(['read:audit', 'read:clients', 'read:claims', 'read:journal-vouchers', 'read:period-end', 'read:policies', 'read:receipts', 'read:reports']));
    expect(reads).not.toContain('view:pii');
  });
});
