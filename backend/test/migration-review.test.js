/**
 * Validate-only review of a migration load (data-load/service.js): every row New, Changed (the changed columns, old ->
 * new), Unchanged, Duplicate or Error, per object; an open item loaded again with another balance is Changed (and an
 * error once a receipt touches it); a migrated policy is changed by a load only while nothing hangs on it; a masked cell
 * keeps the stored value; the errors file carries the duplicates; the review and the stored rows protect personal data.
 * Also the product-wise templates (per-object download, Control sheet, the earlier single Policies sheet), the
 * same-file warning, the value maps snapshot, the document file naming check and the renewal carry-over of the product
 * columns.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook, readZip } from '../src/modules/documents/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { renewalPrefill } from '../src/modules/renewals/service.js';
import { enableFeatures, goLiveSetup, loginAs, validatedBatch } from './helpers.js';

let app;
let api;
let kits;
let cutover;

const bin = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});
/** Workbook of a kit from { sheetName: [{ header: value }] }. */
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
const rowsOf = async (id, q = '') => (await api('get', `/data-load/batches/${id}/rows?perPage=500${q}`)).body.data;

const client = (code, extra = {}) => ({ 'Client Code': code, 'Client Type': 'individual', 'First Name': 'Rosa', 'Last Name': code, Email: `${code.toLowerCase()}@example.ph`, ...extra });
const motor = (number, extra = {}) => ({ 'Policy Number': number, 'Client Code': 'RV-C-1', Insurer: 'MALAYAN', Product: 'MOTOR', 'Inception Date': addDays(cutover, -30),
  'Expiry Date': addDays(cutover, 335), 'Issue Date': addDays(cutover, -31), 'Gross Premium': '25000.00', 'Net Premium': '20000.00', 'Plate Number': `PL ${number.slice(-4)}`, ...extra });
const item = (balance) => ({ 'Policy Number': 'RV-P-1', 'Bill Reference': 'RV-DN-1', 'Due Date': addDays(cutover, 20), 'Original Amount': '25000.00', 'Open Balance': balance });

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  app = await createApp();
  await enableFeatures(app, ['legacy-migration']);
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
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

describe('product-wise templates', () => {
  it('downloads some objects of the kit with the Instructions, the Lists and the hidden Control sheet', async () => {
    const t = await bin(api('get', '/data-load/kits/migration/template?objects=policies-motor,open-items'));
    expect(t.status).toBe(200);
    const sheets = readWorkbook(t.body);
    expect(sheets.map((s) => s.name)).toEqual(['Instructions', 'Lists', 'Policies - Motor', 'Open Items', 'Control']);
    expect(readZip(t.body).get('xl/workbook.xml')).toMatch(/<sheet name="Control" sheetId="5" state="hidden"/);
    const lists = sheets.find((s) => s.name === 'Lists');
    const motorProducts = lists.rows.slice(1).map((r) => r[lists.rows[0].indexOf('Products Motor')]).filter(Boolean);
    expect(motorProducts).toEqual(['MOTOR']);
    expect(lists.rows[0]).toEqual(expect.arrayContaining(['Branches', 'Document Types', 'Business Type']));
    const instructions = sheets[0].rows.map((r) => r.join(' ')).join('\n');
    expect(instructions).toMatch(/New: the key is not in BrokerVerse/);
    expect(instructions).toMatch(/Same TIN/);
    expect(instructions).toMatch(/POL_PC-MLY-2026-000101_POLSCH_20260225\.pdf/);
    const control = Object.fromEntries(sheets.find((s) => s.name === 'Control').rows.slice(1).map((r) => [r[0], r[1]]));
    expect(control).toMatchObject({ Kit: 'migration', Objects: 'policies-motor,open-items', Content: 'blank' });
    expect((await api('get', '/data-load/kits/migration/template?objects=no-such-sheet')).status).toBe(400);
  });

  it('carries one policy sheet per TISPH product kind and no Fire sheet while no fire product is active', async () => {
    const names = readWorkbook((await bin(api('get', '/data-load/kits/migration/template'))).body).map((s) => s.name);
    expect(names).toEqual(['Instructions', 'Lists', 'Clients', 'Policies - Motor', 'Policies - CTPL', 'Policies - Personal Accident', 'Policies - Credit Life',
      'Policies - Travel', 'Policies - Other Lines', 'Open Items', 'Post-Dated Cheques', 'Open Claims', 'Opening Balances', 'Control Totals', 'Control']);
    const sheets = kits.find((k) => k.kit === 'migration').sheets;
    expect(sheets.find((s) => s.key === 'policies-credit-life').products).toEqual(['CL-COMP', 'CL-VOL']);
    expect(sheets.find((s) => s.key === 'policies-other').products).toEqual(['PARCEL']);
  });

  it('refuses a file of the other kit and a file whose layout is not the current one', async () => {
    const conf = (await bin(api('get', '/data-load/kits/configuration/template?objects=master:company'))).body;
    const r = await upload(conf, 'migration');
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/configuration workbook/);
    const mig = readWorkbook((await bin(api('get', '/data-load/kits/migration/template?objects=clients'))).body);
    const rebuilt = (version) => writeXlsx({ sheets: mig.filter((s) => ['Clients', 'Control'].includes(s.name)).map((s) => ({
      name: s.name, columns: s.rows[0].map((h) => ({ header: h })),
      rows: s.name === 'Control' ? s.rows.slice(1).map((x) => (x[0] === 'Layout version' ? [x[0], version ?? x[1]] : x)) : [s.rows[1], ['RV-LAYOUT-1', 'corporate', '', '', 'Layout Corp.']],
    })) });
    expect((await upload(rebuilt('0000000000000000'))).body.message).toMatch(/layout of this file is not the current layout/);
    expect((await upload(rebuilt())).status).toBe(202);
  });

  it('still reads the single Policies sheet of the earlier layout, with a warning', async () => {
    const r = await upload(book({ Clients: [client('RV-OLD-C')], Policies: [{ ...motor('RV-OLD-P'), 'Client Code': 'RV-OLD-C' }] }));
    expect(r.body.data.errors).toEqual([]);
    expect(r.body.data.batch.sheets.find((s) => s.sheet === 'policies')).toMatchObject({ read: 1, created: 1 });
    expect(r.body.data.batch.message).toMatch(/earlier layout/);
  });

  it('a product goes on its own sheet', async () => {
    const r = await upload(book({ Clients: [client('RV-C-X')], 'Policies - Motor': [{ ...motor('RV-WRONG-1'), 'Client Code': 'RV-C-X', Product: 'CTPL' }] }));
    expect(r.body.data.errors).toEqual([expect.objectContaining({ sheet: 'policies-motor', column: 'Product', message: 'Product CTPL goes on the sheet Policies - CTPL' })]);
  });
});

describe('result of each row', () => {
  let base;

  it('a first load: every row is New', async () => {
    const r = await upload(book({
      Clients: [client('RV-C-1', { TIN: '101-202-303-000' }), client('RV-C-2')],
      'Policies - Motor': [motor('RV-P-1')],
      'Open Items': [item('10000.00')],
      'Open Claims': [{ 'Claim Number': 'RV-CL-1', 'Policy Number': 'RV-P-1', 'Loss Date': addDays(cutover, -10), 'Outstanding Estimate': '5000.00' }],
    }));
    base = r.body.data.batch;
    expect(base).toMatchObject({ status: 'validated', rowsNew: 5, rowsChanged: 0, rowsUnchanged: 0, rowsDuplicate: 0, rowsError: 0 });
    expect((await rowsOf(base.id)).every((x) => x.result === 'new')).toBe(true);
    expect((await load(base.id)).status).toBe(200);
  });

  it('a second file: New, Changed (old -> new), Unchanged, Duplicate and Error', async () => {
    const r = await upload(book({ Clients: [
      client('RV-C-1', { TIN: '101-202-303-000', Email: 'rosa.new@example.ph' }),
      client('RV-C-2'),
      client('RV-C-3'),
      client('RV-C-4', { 'Client Type': 'partnership' }),
      client('RV-C-5', { TIN: '101202303000' }),
    ] }));
    const b = r.body.data.batch;
    expect(b).toMatchObject({ rowsNew: 1, rowsChanged: 1, rowsUnchanged: 1, rowsDuplicate: 1, rowsError: 1 });
    expect(b.status).toBe('failed');
    const rows = await rowsOf(b.id);
    const of = (code) => rows.find((x) => x.values.clientCode === code);
    expect(of('RV-C-1')).toMatchObject({ result: 'changed', changes: [{ column: 'email', header: 'Email', old: 'rv-c-1@example.ph', new: 'rosa.new@example.ph' }] });
    expect(of('RV-C-2').result).toBe('unchanged');
    expect(of('RV-C-3').result).toBe('new');
    expect(of('RV-C-4')).toMatchObject({ result: 'error', errors: [expect.objectContaining({ message: expect.stringMatching(/individual or corporate/) })] });
    expect(of('RV-C-5')).toMatchObject({ result: 'duplicate', duplicates: [expect.objectContaining({ rule: 'tin', kind: 'stored', number: 'RV-C-1', label: 'Same TIN' })] });
    expect((await rowsOf(b.id, '&result=changed')).map((x) => x.values.clientCode)).toEqual(['RV-C-1']);
    // the errors file carries the rows in error and the unresolved duplicates
    const e = await bin(api('get', `/data-load/batches/${b.id}/errors`));
    const clients = readWorkbook(e.body).find((s) => s.name === 'Clients');
    const errorsAt = clients.rows[0].indexOf('Errors');
    expect(clients.rows.slice(2).map((x) => [x[0], x[errorsAt]])).toEqual([
      ['RV-C-4', expect.stringMatching(/Client Type must be individual or corporate/)],
      ['RV-C-5', expect.stringMatching(/^Row 6: Duplicate: Same TIN as RV-C-1/)],
    ]);
  });

  it('a migrated policy changed by a later load is Changed and loads, while nothing hangs on it', async () => {
    const r = await upload(book({ 'Policies - Motor': [motor('RV-P-1', { 'Gross Premium': '26000.00', 'TFS Loan Reference': 'TFS-LN-77' })] }));
    const row = (await rowsOf(r.body.data.batch.id))[0];
    expect(row).toMatchObject({ result: 'changed' });
    expect(row.changes.map((c) => [c.column, c.old, c.new])).toEqual([['grossPremium', '25000', '26000.00'], ['loanReference', '', 'TFS-LN-77']]);
    expect((await load(r.body.data.batch.id)).status).toBe(200);
    const p = await one("SELECT id, premium_total, doc FROM policies WHERE policy_number = 'RV-P-1'");
    expect(Number(p.premium_total)).toBe(26000);
    expect(p.doc.loanReference).toBe('TFS-LN-77');
    const a = await one("SELECT before_data, after_data FROM audit_log WHERE entity = 'policy' AND entity_id = $1 AND action = 'migrate-update'", [p.id]);
    expect(a.before_data.grossPremium).toBe('25000');
    expect(a.after_data.grossPremium).toBe('26000');
    // an endorsement now hangs on it: the next change is an error
    await query("INSERT INTO endorsements(policy_id, endorsement_type) VALUES ($1, 'change')", [p.id]);
    const again = await upload(book({ 'Policies - Motor': [motor('RV-P-1', { 'Gross Premium': '27000.00' })] }));
    expect(again.body.data.errors).toEqual([expect.objectContaining({ column: 'Policy Number',
      message: expect.stringMatching(/^Policy RV-P-1 was changed after it was loaded \(endorsements\): undo load MIG-\d{6} or correct it on the policy screen/) })]);
  });

  it('an open item loaded again with another balance is Changed; once a receipt touches it, an error', async () => {
    const r = await upload(book({ 'Open Items': [item('8000.00')] }));
    const row = (await rowsOf(r.body.data.batch.id))[0];
    expect(row).toMatchObject({ result: 'changed', changes: [{ column: 'openBalance', header: 'Open Balance', old: '10000', new: '8000.00' }] });
    expect((await load(r.body.data.batch.id)).status).toBe(200);
    const bill = await one("SELECT id, balance, status FROM receivables WHERE reference = 'RV-DN-1'");
    expect(bill).toMatchObject({ balance: 8000, status: 'partial' });
    expect((await upload(book({ 'Open Items': [item('8000.00')] }))).body.data.batch.rowsUnchanged).toBe(1);
    await query("INSERT INTO post_dated_cheques(pdc_number, receivable_id, cheque_number, cheque_date, amount, received_date) VALUES ('RV-PDC-1', $1, '7001', $2, 1000, $2)",
      [bill.id, cutover]);
    const touched = await upload(book({ 'Open Items': [item('7000.00')] }));
    expect(touched.body.data.errors).toEqual([expect.objectContaining({ column: 'Open Balance', message: expect.stringMatching(/has post-dated cheques in BrokerVerse since it was loaded/) })]);
  });

  it('a masked cell keeps the stored value; a masked TIN is an error', async () => {
    const r = await upload(book({ Clients: [client('RV-C-2', { Email: 'r***@example.ph' }), client('RV-C-1', { TIN: '***-***-***-000', Email: 'rosa.new@example.ph' })] }));
    const rows = await rowsOf(r.body.data.batch.id);
    expect(rows.find((x) => x.values.clientCode === 'RV-C-2')).toMatchObject({ result: 'unchanged', warnings: ['Email: not changed (masked)'] });
    expect(rows.find((x) => x.values.clientCode === 'RV-C-1')).toMatchObject({ result: 'error', errors: [{ column: 'TIN', message: 'TIN is masked: enter the full value' }] });
  });

  it('protects personal data: TINs encrypted in the stored rows, the review masked without view:pii', async () => {
    const r = await upload(book({ Clients: [client('RV-C-1', { TIN: '101-202-303-000', Email: 'rosa.pii@example.ph' })] }));
    const id = r.body.data.batch.id;
    const stored = await one('SELECT data, before FROM data_load_rows WHERE batch_id = $1', [id]);
    expect(stored.data.tin).toMatch(/^pii:1:/);
    expect(stored.before.tin).toMatch(/^pii:1:/);
    expect((await rowsOf(id))[0].values.tin).toBe('101-202-303-000');
    const u = await api('post', '/users').send({ username: 'rv.auditor', password: 'Welcome@123', displayName: 'RV Auditor', email: 'rv.auditor@example.ph', roles: ['tis-auditor'], mustChangePassword: false });
    expect(u.status).toBe(201);
    const token = await loginAs(app, 'rv.auditor', 'Welcome@123');
    const as = (p) => request(app).get(`/api${p}`).set('Authorization', `Bearer ${token}`);
    const row = (await as(`/data-load/batches/${id}/rows`)).body.data[0];
    expect(row.values.tin).not.toContain('101-202');
    expect(row.values.tin).toMatch(/\*/);
    expect(row.changes.find((c) => c.column === 'email')).toMatchObject({ old: expect.stringMatching(/^r\*\*\*@/), new: expect.stringMatching(/^r\*\*\*@/) });
    const t = await bin(as('/data-load/kits/migration/template?objects=clients&prefill=true'));
    const clients = readWorkbook(t.body).find((s) => s.name === 'Clients');
    const tin = clients.rows.find((x) => x[0] === 'RV-C-1')[clients.rows[0].indexOf('TIN')];
    expect(tin).not.toContain('101-202');
    // the auditor reads, never writes
    expect((await request(app).post(`/api/data-load/batches/${id}/resolutions`).set('Authorization', `Bearer ${token}`).send({ rule: 'tin', resolution: 'load-as-new', reason: 'x' })).status).toBe(403);
  });
});

describe('same file and value maps', () => {
  it('warns when the file is the one of a load already loaded', async () => {
    const wb = book({ Clients: [client('RV-SAME-1')] });
    const first = await upload(wb);
    expect((await load(first.body.data.batch.id)).status).toBe(200);
    const again = await upload(wb);
    expect(again.body.data.batch.sameFileAs).toEqual({ loadNumber: first.body.data.batch.loadNumber, status: 'loaded' });
    expect(again.body.data.batch.message).toMatch(new RegExp(`^Same file as ${first.body.data.batch.loadNumber} \\(Loaded\\)`));
    expect(again.body.data.batch.rowsUnchanged).toBe(1);
  });

  it('refuses the load when a value map changed after the validation', async () => {
    const r = await upload(book({ Clients: [client('RV-MAP-1')] }));
    const m = await api('post', '/data-load/value-maps').send({ object: 'branch', legacyValue: 'Makati Br.', targetCode: 'HO' });
    expect(m.status).toBe(201);
    const l = await load(r.body.data.batch.id);
    expect(l.status).toBe(409);
    expect(l.body.message).toMatch(/Value maps changed since the validation/);
    const v = await validatedBatch(api, api('post', `/data-load/batches/${r.body.data.batch.id}/validate`));
    expect((await load(v.body.data.batch.id)).status).toBe(200);
  });
});

describe('document file naming convention', () => {
  it('checks a list of names: valid, invalid with the reason, and whether the record is in BrokerVerse', async () => {
    const list = ['POL_RV-P-1_POLSCH_20260225.pdf', 'POL_RV-P-1_POLSCH_20260225.pdf', 'CLT_RV-C-1_ID_20250101_2.jpg', 'CLM_NO-SUCH_POLICE_20260101.pdf',
      'scan001.pdf', 'POL_RV-P-1_SELFIE_20260225.pdf', 'BIL_RV-DN-1_OR_20261399.pdf', 'POL_RV-P-1_COC_20260225.PDF'].join('\n');
    const r = await api('post', '/data-load/document-names/check').attach('file', Buffer.from(list), 'names.txt');
    expect(r.status).toBe(200);
    const res = r.body.data.results;
    expect(res.map((x) => [x.valid, x.recordFound])).toEqual([[true, true], [false, null], [true, true], [true, false], [false, null], [false, null], [false, null], [false, null]]);
    expect(res[1].reason).toMatch(/Same file name/);
    expect(res[4].reason).toMatch(/parts/);
    expect(res[5].reason).toMatch(/Document type SELFIE/);
    expect(res[6].reason).toMatch(/not a date/);
    expect(res[7].reason).toMatch(/lower case/);
    expect(r.body.data.summary).toEqual({ names: 8, valid: 3, invalid: 5, recordFound: 2, recordMissing: 1 });
    const x = await bin(api('get', `/data-load/document-names/check/${r.body.data.token}/workbook`));
    expect(readWorkbook(x.body).map((s) => s.name)).toEqual(['Summary', 'Names']);
    const u = await api('post', '/users').send({ username: 'rv.other', password: 'Welcome@123', displayName: 'RV Other', email: 'rv.other@example.ph', roles: ['tis-auditor'], mustChangePassword: false });
    expect(u.status).toBe(201);
    const token = await loginAs(app, 'rv.other', 'Welcome@123');
    expect((await request(app).get(`/api/data-load/document-names/check/${r.body.data.token}/workbook`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });
});

describe('renewal of a migrated policy', () => {
  it('carries the product columns of the line, never the dates of the expiring term', async () => {
    const r = await upload(book({
      Clients: [client('RV-REN-C')],
      'Policies - Motor': [motor('RV-REN-M', { 'Client Code': 'RV-REN-C', 'Conduction Sticker': 'CS-88123', 'TFS Loan Reference': 'TFS-LN-0099', Dealer: 'TOYOTA-MAKATI', 'Plate Number': '' })],
      'Policies - Travel': [{ 'Policy Number': 'RV-REN-T', 'Client Code': 'RV-REN-C', Insurer: 'MALAYAN', Product: 'TRAVEL', 'Inception Date': addDays(cutover, -30),
        'Expiry Date': addDays(cutover, 335), 'Issue Date': addDays(cutover, -31), 'Gross Premium': '1890.00', 'Plan / Policy Type': 'TRV-ANN', Destination: 'Worldwide',
        'Travel Start': addDays(cutover, -20), 'Travel End': addDays(cutover, 40) }],
    }));
    expect(r.body.data.errors).toEqual([]);
    expect((await load(r.body.data.batch.id)).status).toBe(200);
    const m = await renewalPrefill('RV-REN-M');
    expect(m.vehicle).toMatchObject({ conductionSticker: 'CS-88123', loanReference: 'TFS-LN-0099', dealerCode: 'TOYOTA-MAKATI' });
    const t = await renewalPrefill('RV-REN-T');
    expect(t.vehicle).toMatchObject({ destination: 'Worldwide', insurancePolicyType: 'TRV-ANN' });
    expect(t.vehicle.travelStart).toBeUndefined();
    expect(t.vehicle.travelEnd).toBeUndefined();
  });
});
