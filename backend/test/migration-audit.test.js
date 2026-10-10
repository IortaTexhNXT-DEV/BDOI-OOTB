/**
 * Per-record audit of a migration load: one entry per record created (migrate-create) or changed (migrate-update),
 * written in the load transaction with the values before and after, the batch and its load number; nothing is written
 * by a validation or by a load that fails. The record history shows the entry as "migrated" from the data load.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { actionTitle } from '../src/lib/auditLabels.js';
import { sourceOf } from '../src/lib/auditEvents.js';

let api;
let kits;
let cutover;
let issue;

function book(sheets) {
  const defs = kits.find((k) => k.kit === 'migration').sheets;
  return writeXlsx({
    sheets: Object.entries(sheets).map(([name, rows]) => {
      const headers = defs.find((s) => s.name === name).columns.map((c) => c.header);
      return { name, columns: headers.map((h) => ({ header: h })), rows: rows.map((r) => headers.map((h) => (r[h] === undefined ? '' : String(r[h])))) };
    }),
  });
}
const upload = (wb) => api('post', '/data-load/batches').field('kit', 'migration').attach('file', wb, 'migration.xlsx');
const entries = async (action) => (await query("SELECT * FROM audit_log WHERE action = $1 ORDER BY entity, entity_id", [action])).rows;
const client = (email) => ({ 'Client Code': 'AUD-C-1', 'Client Type': 'individual', 'First Name': 'Rosa', 'Last Name': 'Diaz', Email: email, TIN: '123-456-789-000' });
const workbook = (email, ob = '10000') => book({
  Clients: [client(email)],
  Policies: [{ 'Policy Number': 'AUD-P-1', 'Client Code': 'AUD-C-1', Insurer: 'MALAYAN', Product: 'MOTOR', 'Inception Date': addDays(issue, 1),
    'Expiry Date': addDays(cutover, 300), 'Issue Date': issue, 'Net Premium': '20000', 'Gross Premium': '25000' }],
  'Open Items': [{ 'Policy Number': 'AUD-P-1', 'Bill Reference': 'AUD-DN-1', 'Due Date': addDays(cutover, 15), 'Open Balance': '10000' }],
  'Open Claims': [{ 'Claim Number': 'AUD-CLM-1', 'Policy Number': 'AUD-P-1', 'Loss Date': addDays(issue, 10), 'Outstanding Estimate': '45000' }],
  'Opening Balances': [{ 'Account Code': '1202001', Debit: ob }, { 'Account Code': '2201001', Credit: ob }],
});

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
  issue = addDays(cutover, -40);
  expect((await api('put', '/settings').send({ settings: { 'golive.cutover_date': cutover } })).status).toBe(200);
  clearSettingsCache();
});
afterAll(async () => {
  await pool.end();
});

describe('per-record audit of a migration load', () => {
  let batch;

  it('a validation writes no record entry', async () => {
    const r = await upload(workbook('rosa@example.ph'));
    expect(r.body.data.errors).toEqual([]);
    batch = r.body.data.batch;
    expect(await entries('migrate-create')).toEqual([]);
  });

  it('the load writes one migrate-create entry per record with its values, the batch and the load number', async () => {
    expect((await api('post', `/data-load/batches/${batch.id}/load`).send({})).status).toBe(200);
    const created = await entries('migrate-create');
    const ids = {
      client: (await one("SELECT id FROM clients WHERE client_code = 'AUD-C-1'")).id,
      policy: (await one("SELECT id FROM policies WHERE policy_number = 'AUD-P-1'")).id,
      receivable: (await one("SELECT id FROM receivables WHERE reference = 'AUD-DN-1'")).id,
      claim: (await one("SELECT id FROM claims WHERE claim_number = 'AUD-CLM-1'")).id,
    };
    expect(created.map((e) => [e.entity, e.entity_id])).toEqual([
      ['claim', ids.claim], ['client', ids.client],
      ['opening_balances', `go-live:${cutover}:1202001`], ['opening_balances', `go-live:${cutover}:2201001`],
      ['policy', ids.policy], ['receivable', ids.receivable],
    ]);
    for (const e of created) {
      expect(e.after_data).toMatchObject({ batchId: batch.id, loadNumber: batch.loadNumber, legacySystem: 'Legacy' });
      expect(e.username).toBe('BrokerVerse');
    }
    const c = created.find((e) => e.entity === 'client');
    expect(c.before_data).toBeNull();
    expect(c.after_data).toMatchObject({ clientCode: 'AUD-C-1', firstName: 'Rosa', email: 'rosa@example.ph' });
    // personal identifiers are stored in the audit trail as on screen edits: encrypted at rest
    expect(String(c.after_data.tin)).toMatch(/^pii:1:/);
    expect(created.find((e) => e.entity === 'policy').after_data).toMatchObject({ policyNumber: 'AUD-P-1', grossPremium: '25000', clientCode: 'AUD-C-1' });
    expect(created.find((e) => e.entity === 'claim').after_data).toMatchObject({ claimNumber: 'AUD-CLM-1', estimateAmount: '45000' });
    expect(created.find((e) => e.entity_id.endsWith('2201001')).after_data).toMatchObject({ accountCode: '2201001', balance: -10000 });
  });

  it('a later load that changes a record writes migrate-update with the values before and after; unchanged records get nothing', async () => {
    const r = await upload(workbook('rosa.diaz@example.ph', '12000'));
    expect(r.body.data.errors).toEqual([]);
    expect((await api('post', `/data-load/batches/${r.body.data.batch.id}/load`).send({})).status).toBe(200);
    const updated = await entries('migrate-update');
    expect(updated.map((e) => e.entity)).toEqual(['client', 'opening_balances', 'opening_balances']);
    const c = updated[0];
    expect(c.before_data.email).toBe('rosa@example.ph');
    expect(c.after_data).toMatchObject({ email: 'rosa.diaz@example.ph', loadNumber: r.body.data.batch.loadNumber, batchId: r.body.data.batch.id });
    expect(updated[1].before_data).toEqual({ accountCode: '1202001', balance: 10000 });
    expect(updated[1].after_data).toMatchObject({ accountCode: '1202001', balance: 12000 });
    expect(await entries('migrate-create')).toHaveLength(6);
  });

  it('a load that fails writes no record entry', async () => {
    const before = (await entries('migrate-create')).length;
    const r = await upload(book({ Clients: [{ 'Client Code': 'AUD-C-2', 'Client Type': 'corporate', 'Company Name': 'Rollback Corp.' }] }));
    expect(r.body.data.errors).toEqual([]);
    // the data changes between validation and load: the code is taken by a client entered in BrokerVerse
    await query(`INSERT INTO clients(client_code, client_type, company_name, display_name) VALUES ('AUD-C-2', 'corporate', 'Taken Corp.', 'Taken Corp.')`);
    expect((await api('post', `/data-load/batches/${r.body.data.batch.id}/load`).send({})).status).toBe(409);
    expect(await entries('migrate-create')).toHaveLength(before);
  });

  it('the record history shows the load as the first event, from the data load', async () => {
    const id = (await one("SELECT id FROM clients WHERE client_code = 'AUD-C-1'")).id;
    const h = await api('get', `/audit/records/client/${id}?sort=asc`);
    expect(h.status).toBe(200);
    const [first] = h.body.data;
    expect(first).toMatchObject({ action: 'migrate-create', title: 'Client migrated', source: { channel: 'upload', label: 'Data load', name: expect.stringMatching(/^MIG-\d{6}$/) } });
    expect(h.body.data.some((e) => e.title === 'Client updated by migration load')).toBe(true);
    expect(actionTitle('policy', 'migrate-undo')).toBe('Policy removed by undo of migration load');
    expect(sourceOf({ action: 'migrate-update', after_data: { loadNumber: 'MIG-000004' } })).toEqual({ channel: 'upload', label: 'Data load', name: 'MIG-000004' });
  });
});
