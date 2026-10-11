/**
 * Post-dated cheques on hand at cutover (Post-Dated Cheques sheet of the migration kit): loaded on hand against a
 * migrated open item, as migrated records of the load, nothing posted; refused when dated before the cutover, above
 * the open balance or without its open item. Deposited after go-live like any cheque: the deposit creates the official
 * receipt, and the open item it paid can no longer be changed by a load. The reconciliation of the load carries them.
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
import { enableFeatures, goLiveSetup, validatedBatch } from './helpers.js';

let api;
let kits;
let cutover;
let day;

function book(sheets) {
  const defs = kits.find((k) => k.kit === 'migration').sheets;
  return writeXlsx({
    sheets: Object.entries(sheets).map(([name, rows]) => {
      const headers = defs.find((s) => s.name === name).columns.map((c) => c.header);
      return { name, columns: headers.map((h) => ({ header: h })), rows: rows.map((r) => headers.map((h) => (r[h] === undefined ? '' : String(r[h])))) };
    }),
  });
}
const upload = (wb) => validatedBatch(api, api('post', '/data-load/batches').field('kit', 'migration').attach('file', wb, 'migration.xlsx'));
const load = (id) => api('post', `/data-load/batches/${id}/load`).send({});
const cheque = (number, extra = {}) => ({ 'Drawee Bank': 'PNB', 'Cheque Number': number, 'Cheque Date': day, Amount: '6000.00', 'Policy Number': 'PD-P-1', 'Bill Reference': 'PD-DN-1',
  'Received Date': addDays(cutover, -3), 'Storage Location': 'Head Office vault', ...extra });
const item = (balance) => ({ 'Policy Number': 'PD-P-1', 'Bill Reference': 'PD-DN-1', 'Due Date': addDays(cutover, 15), 'Original Amount': '25000.00', 'Open Balance': balance });

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  const app = await createApp();
  await enableFeatures(app, ['legacy-migration']);
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  kits = (await api('get', '/data-load/kits')).body.data.kits;
  // cutover on the first day of this month: the cheques fall due today and are deposited today
  day = await today();
  cutover = `${day.slice(0, 7)}-01`;
  await goLiveSetup(api, cutover);
  // retained cheques are deposited to the one TISPH collection account (FR-PDC-004)
  await query('UPDATE app_settings SET value = $2 WHERE key = $1', ['pdc.default_deposit_account', JSON.stringify('ACC-MIG-001')]);
  clearSettingsCache();
  await query(`INSERT INTO master_records(type_code, code, name, data, status, created_by)
    SELECT 'bank-account', 'ACC-MIG-001', 'Operating Account', jsonb_build_object('accountCode', 'ACC-MIG-001', 'glAccount',
      COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'accounting.account.cash_in_bank'), '106010'), 'accountName', 'Operating Account', 'currency', 'PHP'), 'active', 'seed'`);
  const base = await upload(book({
    Clients: [{ 'Client Code': 'PD-C-1', 'Client Type': 'corporate', 'Company Name': 'Cheque Payer Corp.' }],
    'Policies - Motor': [{ 'Policy Number': 'PD-P-1', 'Client Code': 'PD-C-1', Insurer: 'MALAYAN', Product: 'MOTOR', 'Inception Date': addDays(cutover, -60),
      'Expiry Date': addDays(cutover, 300), 'Issue Date': addDays(cutover, -61), 'Gross Premium': '25000.00', 'Plate Number': 'PDC 1001', 'Payment Status': 'Partial' }],
    'Open Items': [item('10000.00')],
  }));
  expect(base.body.data.errors).toEqual([]);
  expect((await load(base.body.data.batch.id)).status).toBe(200);
});
afterAll(async () => {
  await pool.end();
});

describe('Post-Dated Cheques sheet', () => {
  let loaded;

  it('refuses a cheque dated before the cutover, one above the open balance and one without its open item', async () => {
    const r = await upload(book({ 'Post-Dated Cheques': [
      cheque('9001', { 'Cheque Date': addDays(cutover, -1) }),
      cheque('9002', { Amount: '10000.01' }),
      cheque('9003', { 'Bill Reference': 'NO-SUCH-BILL' }),
    ] }));
    expect(r.body.data.errors.map((e) => [e.row, e.column, e.message])).toEqual([
      [2, 'Cheque Date', expect.stringMatching(/before the cutover date .*deposited in the legacy system/)],
      [3, 'Amount', expect.stringMatching(/has 10000\.00 left after the cheques already encoded; this cheque is 10000\.01/)],
      [4, 'Bill Reference', expect.stringMatching(/not in the Open Items sheet/)],
    ]);
  });

  it('loads a cheque on hand against its migrated open item, as a migrated record of the load; nothing is posted', async () => {
    const journals = (await one('SELECT count(*)::int AS n FROM journal_vouchers')).n;
    const r = await upload(book({ 'Post-Dated Cheques': [cheque('9101'), cheque('9102', { Amount: '4000.00', 'Drawee Bank': 'Some Rural Bank' })] }));
    expect(r.body.data.errors).toEqual([]);
    const l = await load(r.body.data.batch.id);
    expect(l.status).toBe(200);
    loaded = l.body.data.batch;
    const rows = (await query("SELECT d.*, r.reference FROM post_dated_cheques d JOIN receivables r ON r.id = d.receivable_id WHERE d.cheque_number IN ('9101', '9102') ORDER BY d.cheque_number")).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ status: 'on-hand', origin: 'migrated', legacy_number: '9101', load_batch_id: loaded.id, reference: 'PD-DN-1', storage_location: 'Head Office vault' });
    expect(rows[0].bank_id).not.toBeNull();
    expect(rows[1]).toMatchObject({ bank_id: null, drawee_bank: 'Some Rural Bank' });
    expect((await one('SELECT count(*)::int AS n FROM journal_vouchers')).n).toBe(journals);
    const rec = l.body.data.reconciliation.sheets.find((s) => s.sheet === 'Post-Dated Cheques');
    expect(rec).toMatchObject({ workbookRows: 2, workbook: { amount: 10000 }, inBrokerVerse: 2, detail: { amount: 10000 } });
    const audit = await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'post_dated_cheque' AND action = 'migrate-create'");
    expect(audit.n).toBe(2);
    // the same cheques again are unchanged
    const again = await upload(book({ 'Post-Dated Cheques': [cheque('9101'), cheque('9102', { Amount: '4000.00', 'Drawee Bank': 'Some Rural Bank' })] }));
    expect(again.body.data.batch).toMatchObject({ rowsUnchanged: 2, rowsError: 0 });
  });

  it('a deposit after go-live creates the official receipt; the open item can then no longer be changed by a load', async () => {
    const pdc = await one("SELECT id FROM post_dated_cheques WHERE cheque_number = '9101'");
    const d = await api('post', `/pdc/${pdc.id}/deposit`).send({ depositAccount: 'ACC-MIG-001', depositDate: day });
    expect(d.status, JSON.stringify(d.body)).toBe(200);
    expect(d.body.data.pdc.status).toBe('deposited');
    expect(d.body.data.receiptNumber).toBeTruthy();
    const bill = await one("SELECT balance FROM receivables WHERE reference = 'PD-DN-1'");
    expect(Number(bill.balance)).toBe(4000);
    const r = await upload(book({ 'Open Items': [item('9000.00')] }));
    expect(r.body.data.errors).toEqual([expect.objectContaining({ column: 'Open Balance', message: expect.stringMatching(/has receipts, post-dated cheques in BrokerVerse since it was loaded/) })]);
  });
});
