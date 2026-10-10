/**
 * Reconciliation of the migration loads (migration 0443, data-load/reconciliation.js): lines counted on the records of
 * the loads, legacy figures from the Control Totals sheet, on screen and uploaded, the sub-ledger tie-outs with both
 * sides and their accounts, the differences (a record of a single-object import is an extra difference), tolerances
 * set by an approver with a reason, acceptance and sign-off never by a user who loaded, the signed PDF kept with its
 * SHA-256 and a reconciliation superseded by a later load.
 */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { addDays } from '../src/lib/dates.js';
import { ensureCalendar } from '../src/modules/period-end/fiscal.js';
import { businessRows, settle, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

let s;
let loader;
let approver;
let owner;
let finance;
let recon;

const bin = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});
const control = (object, measure, group, value) => ({ Object: object, Measure: measure, Group: group, 'Legacy Value': value });
/** The legacy figures of the first load: every total, the SAP trial balance per account and the due to insurers listing. */
const CONTROL_TOTALS = [
  control('Clients', 'count', '', '1'),
  control('Policies', 'count', '', '1'), control('Policies', 'gross premium', '', '25000'), control('Policies', 'gross premium', 'motor', '25000'),
  control('Policies', 'net premium', '', '20000'),
  control('Open Items', 'count', '', '1'), control('Open Items', 'original amount', '', '25000'), control('Open Items', 'open balance', '', '10000'),
  control('Open Items', 'open balance', 'MALAYAN', '10000'),
  control('Post-Dated Cheques', 'count', '', '1'), control('Post-Dated Cheques', 'amount', '', '5000'),
  control('Open Claims', 'count', '', '1'), control('Open Claims', 'outstanding estimate', '', '45000'),
  control('Opening Balances', 'debit', '', '10000'), control('Opening Balances', 'credit', '', '10000'),
  control('Sub-ledger', 'due to insurers', 'MALAYAN', '10000'),
  control('Sub-ledger', 'sap trial balance', '1202001', '10000'), control('Sub-ledger', 'sap trial balance', '210245', '10000'),
];
const sheets = (n, extra = {}) => ({
  ...businessRows(s, n),
  'Opening Balances': [{ 'Account Code': '1202001', Debit: '10000' }, { 'Account Code': '210245', Credit: '10000' }],
  ...extra,
});

/** Upload as the loader, submit, approve as the approver, wait for the load. */
async function loaded(wb) {
  const r = await uploadAs(loader.api, wb);
  expect(r.body.data.errors).toEqual([]);
  expect((await loader.api('post', `/data-load/batches/${r.body.data.batch.id}/submit`).send({})).status).toBe(200);
  expect((await approver.api('post', `/data-load/batches/${r.body.data.batch.id}/approve`)).status).toBe(202);
  const b = await settle(loader.api, r.body.data.batch.id);
  expect(b.status, b.message).toBe('loaded');
  return b;
}
const line = (r, object, measure, group = null) => r.lines.find((l) => l.object === object && l.measure === measure && (l.group || null) === group);
const get = async (id = recon.id) => (await loader.api('get', `/data-load/reconciliations/${id}`)).body.data;
/** The reconciliation once the job of a load has refreshed it (after the batch is loaded, before the job ends). */
async function refreshed(id, from) {
  const end = Date.now() + 30000;
  for (;;) {
    const r = await get(id);
    if (r.status !== from || Date.now() > end) return r;
    await new Promise((resolve) => { setTimeout(resolve, 50); });
  }
}

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'rec.loader': 'dl-loader', 'rec.approver': 'dl-approver', 'rec.owner': 'dl-approver', 'rec.finance': 'dl-approver' } });
  ({ 'rec.loader': loader, 'rec.approver': approver, 'rec.owner': owner, 'rec.finance': finance } = s.users);
  await ensureCalendar(pool, s.cutover);
});
afterAll(async () => {
  await pool.end();
});

describe('lines, tie-outs and differences', () => {
  let batch;
  it('counts the records of the loads, with the legacy figures of their Control Totals sheet', async () => {
    batch = await loaded(workbook(s.kits, sheets(1, { 'Control Totals': CONTROL_TOTALS })));
    expect((await loader.api('post', '/data-load/reconciliations').send({ batchIds: [999999] })).status).toBe(400);
    const c = await loader.api('post', '/data-load/reconciliations').send({});
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    recon = c.body.data;
    expect(recon).toMatchObject({ reconNumber: `REC-${String(recon.id).padStart(6, '0')}`, status: 'open', allBatches: true, cutoverDate: s.cutover });
    expect(recon.batches.map((b) => b.loadNumber)).toEqual([batch.loadNumber]);
    expect(recon.signoffs.map((x) => x.slot)).toEqual(['data-owner', 'finance-head']);
    expect(line(recon, 'Clients', 'count')).toMatchObject({ systemValue: 1, legacyValue: 1, legacySource: 'workbook', status: 'matched' });
    expect(line(recon, 'Clients', 'count', 'individual')).toMatchObject({ systemValue: 1, legacyValue: null, status: 'no-legacy' });
    // a legacy group written in another case is the BrokerVerse group
    expect(line(recon, 'Policies', 'gross premium', 'MOTOR')).toMatchObject({ systemValue: 25000, legacyValue: 25000, status: 'matched' });
    expect(line(recon, 'Policies', 'gross premium', 'MALAYAN')).toMatchObject({ systemValue: 25000, legacyValue: null });
    expect(line(recon, 'Open Items', 'open balance')).toMatchObject({ systemValue: 10000, legacyValue: 10000, status: 'matched' });
    expect(recon.lines.filter((l) => l.object === 'Open Items' && l.measure === 'count').map((l) => l.group)).toEqual(expect.arrayContaining([null, 'MALAYAN', 'current']));
    expect(line(recon, 'Post-Dated Cheques', 'amount', addDays(s.cutover, 10).slice(0, 7))).toMatchObject({ systemValue: 5000 });
    expect(line(recon, 'Opening Balances', 'balance', '210245')).toMatchObject({ systemValue: 10000 });
    expect(line(recon, 'Checks', 'trial balance')).toMatchObject({ kind: 'check', systemValue: 10000, legacyValue: 10000, status: 'matched', sides: { system: 'Debits', other: 'Credits' } });
    expect(recon.summary).toMatchObject({ differences: 0, openDifferences: 0, missingLegacy: [] });
  });

  it('shows each tie-out with both sides and its accounts', async () => {
    const t = (await loader.api('get', `/data-load/reconciliations/${recon.id}/tieouts`)).body.data;
    expect(t.definitions.map((d) => d.key)).toEqual(['premiums-receivable', 'post-dated-cheques', 'due-to-insurers', 'commission-receivable', 'unapplied-collections',
      'cash-in-bank', 'sap-trial-balance']);
    const of = (measure, group = null) => t.lines.find((l) => l.measure === measure && l.group === group);
    expect(of('premiums-receivable')).toMatchObject({ label: 'Premiums receivable', accounts: ['1202001'], systemValue: 10000, legacyValue: 10000, legacySource: null,
      sides: { system: 'GL opening balance', other: 'Open items loaded' }, status: 'matched' });
    expect(of('premiums-receivable', 'MALAYAN')).toMatchObject({ systemValue: 10000, legacyValue: 10000, sides: { system: 'Open items loaded', other: 'Legacy listing' } });
    expect(of('post-dated-cheques')).toMatchObject({ systemValue: 5000, legacyValue: 5000, sides: { system: 'Cheques loaded', other: 'Legacy register' } });
    // the listing of the legacy system per insurer is compared in total with the GL opening balance of the accounts, on its normal (credit) side
    expect(of('due-to-insurers')).toMatchObject({ accounts: ['210245'], systemValue: 10000, legacyValue: 10000, legacySource: 'workbook', status: 'matched' });
    expect(of('commission-receivable')).toMatchObject({ systemValue: 0, legacyValue: null, status: 'matched' });
    expect(of('sap-trial-balance', '1202001')).toMatchObject({ accounts: ['1202001'], systemValue: 10000, legacyValue: 10000, sides: { system: 'BrokerVerse opening balance', other: 'SAP trial balance' } });
    expect(of('sap-trial-balance', '210245')).toMatchObject({ systemValue: 10000, legacyValue: 10000 });
  });

  it('counts per load: a record of a single-object import is an extra difference, not a figure of the load', async () => {
    const file = writeXlsx({ sheets: [{ name: 'Data', columns: ['Policy Number', 'Bill Reference', 'Due Date', 'Open Balance'].map((header) => ({ header })),
      rows: [['MJ1-P', 'REC-DN-EXTRA', addDays(s.cutover, 20), '700']] }] });
    const imp = await s.api('post', '/receipts/opening-items/import').field('goLiveDate', s.cutover).attach('file', file, 'items.xlsx');
    expect(imp.status, JSON.stringify(imp.body)).toBe(200);
    expect(await one('SELECT count(*)::int AS n FROM receivables WHERE origin = \'migrated\'')).toEqual({ n: 2 });
    const r = (await loader.api('post', `/data-load/reconciliations/${recon.id}/recompute`)).body.data;
    expect(line(r, 'Open Items', 'count')).toMatchObject({ systemValue: 1, legacyValue: 1, status: 'matched' });
    expect(line(r, 'Open Items', 'open balance')).toMatchObject({ systemValue: 10000 });
    const extra = r.differences.filter((d) => d.kind === 'extra');
    expect(extra).toEqual([expect.objectContaining({ sheet: 'Open Items', recordKey: 'REC-DN-EXTRA', status: 'open' })]);
    expect(extra[0].description).toContain('single-object import');
  });

  it('a legacy figure entered on screen makes a difference; a recompute keeps the figure', async () => {
    const l = line(recon, 'Policies', 'count');
    const loaderEdit = await loader.api('put', `/data-load/reconciliations/${recon.id}/lines/${l.id}`).send({ legacyValue: 2.5 });
    expect(loaderEdit.status).toBe(400);
    const r = (await loader.api('put', `/data-load/reconciliations/${recon.id}/lines/${l.id}`).send({ legacyValue: 2 })).body.data;
    expect(line(r, 'Policies', 'count')).toMatchObject({ legacyValue: 2, legacySource: 'screen', difference: -1, status: 'difference' });
    expect(r.differences.filter((d) => d.kind === 'measure')).toEqual([expect.objectContaining({ lineId: l.id, amount: -1, status: 'open' })]);
    const again = (await loader.api('post', `/data-load/reconciliations/${recon.id}/recompute`)).body.data;
    expect(line(again, 'Policies', 'count')).toMatchObject({ legacyValue: 2, legacySource: 'screen' });
    // both sides of the trial balance and of the premiums receivable tie-out are BrokerVerse figures
    expect((await loader.api('put', `/data-load/reconciliations/${recon.id}/lines/${line(again, 'Checks', 'trial balance').id}`).send({ legacyValue: 1 })).status).toBe(409);
  });

  it('a tolerance other than zero is set by an approver who did not load, with a reason; a count is exact', async () => {
    const l = line(await get(), 'Policies', 'gross premium');
    const url = `/data-load/reconciliations/${recon.id}/lines/${l.id}`;
    expect((await loader.api('put', url).send({ tolerance: 1, toleranceReason: 'Rounding' })).status).toBe(403);
    expect((await approver.api('put', url).send({ tolerance: 1, toleranceReason: 'Rounding' })).status).toBe(403);
    expect((await owner.api('put', url).send({ tolerance: 1 })).status).toBe(400);
    expect((await owner.api('put', `/data-load/reconciliations/${recon.id}/lines/${line(await get(), 'Policies', 'count').id}`).send({ tolerance: 1, toleranceReason: 'x' })).status).toBe(400);
    const r = await owner.api('put', url).send({ tolerance: 1.5, toleranceReason: 'Legacy system rounds each instalment' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(line(r.body.data, 'Policies', 'gross premium')).toMatchObject({ tolerance: 1.5, toleranceReason: 'Legacy system rounds each instalment' });
    const a = await one('SELECT action, before_data, after_data FROM audit_log WHERE entity = \'migration_reconciliation\' AND action = \'tolerance\' ORDER BY id DESC LIMIT 1');
    expect(a.after_data).toMatchObject({ tolerance: 1.5 });
  });

  it('a difference is explained by a writer and accepted only by an approver who did not load', async () => {
    const r = await get();
    const measure = r.differences.find((d) => d.kind === 'measure');
    const extra = r.differences.find((d) => d.kind === 'extra');
    const accept = (who, d, body = {}) => who.api('post', `/data-load/reconciliations/${recon.id}/differences/${d.id}/accept`).send(body);
    expect((await owner.api('post', `/data-load/reconciliations/${recon.id}/signoffs/data-owner`).send({ remarks: 'Agrees' })).status).toBe(409);
    expect((await accept(owner, measure)).status).toBe(400);
    const e = await loader.api('put', `/data-load/reconciliations/${recon.id}/differences/${measure.id}`).send({ explanation: 'The legacy count includes a cancelled policy',
      action: 'None', owner: 'Operations', status: 'explained' });
    expect(e.status).toBe(200);
    expect((await accept(loader, measure)).status).toBe(403);
    expect((await accept(approver, measure)).status).toBe(403);
    const ok = await accept(owner, measure);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.differences.find((d) => d.id === measure.id)).toMatchObject({ status: 'accepted', acceptedBy: 'rec.owner' });
    expect((await accept(owner, extra, { explanation: 'Late open item keyed through the single-object import' })).status).toBe(200);
    expect((await get()).summary.openDifferences).toBe(0);
  });
});

describe('sign-off and report', () => {
  it('is signed by approvers who did not load, one slot each; the first signature freezes it', async () => {
    const sign = (who, slot) => who.api('post', `/data-load/reconciliations/${recon.id}/signoffs/${slot}`).send({ remarks: 'Agrees with the legacy listing' });
    expect((await sign(loader, 'data-owner')).status).toBe(403);
    expect((await sign(approver, 'data-owner')).status).toBe(403);
    expect((await owner.api('post', `/data-load/reconciliations/${recon.id}/signoffs/data-owner`).send({})).status).toBe(400);
    const first = await sign(owner, 'data-owner');
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.data).toMatchObject({ status: 'open', signedReport: false });
    expect((await loader.api('post', `/data-load/reconciliations/${recon.id}/recompute`)).status).toBe(409);
    expect((await sign(owner, 'finance-head')).status).toBe(403);
    const last = await sign(finance, 'finance-head');
    expect(last.status).toBe(200);
    expect(last.body.data).toMatchObject({ status: 'signed', signedReport: true });
    expect(last.body.data.reportSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(last.body.data.signoffs.map((x) => x.signedBy)).toEqual(['rec.owner', 'rec.finance']);
  });

  it('keeps the signed PDF with its SHA-256, unchanged by later edits of the records', async () => {
    const r = await get();
    const f = await bin(loader.api('get', `/data-load/reconciliations/${recon.id}/report?format=pdf&version=signed`));
    expect(f.status).toBe(200);
    expect(f.headers['x-content-sha256']).toBe(r.reportSha256);
    expect(crypto.createHash('sha256').update(f.body).digest('hex')).toBe(r.reportSha256);
    expect(f.body.subarray(0, 5).toString()).toBe('%PDF-');
    await query('UPDATE clients SET first_name = \'Rosario\' WHERE client_code = \'MJ1-C\'');
    const again = await bin(loader.api('get', `/data-load/reconciliations/${recon.id}/report?format=pdf&version=signed`));
    expect(crypto.createHash('sha256').update(again.body).digest('hex')).toBe(r.reportSha256);
    const stored = await one('SELECT d.category FROM documents d JOIN migration_reconciliations m ON m.report_file_key = d.storage_key WHERE m.id = $1', [recon.id]);
    expect(stored.category).toBe('go-live-evidence');
    expect((await s.api('get', `/s3/object/${(await one('SELECT report_file_key FROM migration_reconciliations WHERE id = $1', [recon.id])).report_file_key}`)).status).toBe(403);
  });

  it('builds the PDF and the workbook when downloaded, with codes and amounts only (no personal identifier)', async () => {
    const pdf = await bin(loader.api('get', `/data-load/reconciliations/${recon.id}/report?format=pdf`));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    const x = await bin(loader.api('get', `/data-load/reconciliations/${recon.id}/report?format=xlsx`));
    expect(x.status).toBe(200);
    const book = readWorkbook(x.body);
    expect(book.map((sh) => sh.name)).toEqual(['Summary', 'Lines', 'Checks', 'Differences', 'Sign-offs']);
    expect(JSON.stringify(book)).not.toContain('123-456-101');
    expect((await loader.api('get', `/data-load/reconciliations/${recon.id}/report?format=csv`)).status).toBe(400);
  });

  it('a later load of the run supersedes the signed reconciliation with a new one that keeps the figures entered', async () => {
    const b2 = await loaded(workbook(s.kits, { ...businessRows(s, 2), 'Opening Balances': [{ 'Account Code': '1202001', Debit: '20000' }, { 'Account Code': '210245', Credit: '20000' }] }));
    const old = await refreshed(recon.id, 'signed');
    expect(old).toMatchObject({ status: 'superseded' });
    expect(old.supersededBy).toBeTruthy();
    const next = await get(old.supersededBy);
    expect(next).toMatchObject({ status: 'open', allBatches: true });
    expect(next.batches.map((b) => b.loadNumber).sort()).toEqual([old.batches[0].loadNumber, b2.loadNumber].sort());
    expect(line(next, 'Clients', 'count')).toMatchObject({ systemValue: 2 });
    expect(line(next, 'Policies', 'count')).toMatchObject({ legacyValue: 2, legacySource: 'screen', status: 'matched' });
    expect(line(next, 'Policies', 'gross premium')).toMatchObject({ tolerance: 1.5 });
    // the signed report of the superseded reconciliation stays as it was
    expect(old.reportSha256).toBe((await one('SELECT report_sha256 FROM migration_reconciliations WHERE id = $1', [old.id])).report_sha256);
    const list = (await loader.api('get', '/data-load/reconciliations')).body;
    expect(list.data.map((x) => [x.reconNumber, x.status])).toEqual([[next.reconNumber, 'open'], [old.reconNumber, 'superseded']]);
    recon = next;
  });

  it('uploads legacy figures from a Control Totals sheet, all or nothing', async () => {
    const sheet = (rows) => writeXlsx({ sheets: [{ name: 'Control Totals', columns: ['Object', 'Measure', 'Group', 'Legacy Value'].map((header) => ({ header })), rows }] });
    const bad = await loader.api('post', `/data-load/reconciliations/${recon.id}/legacy`).attach('file', sheet([['Clients', 'count', '', '2'], ['Clients', 'premium', '', '1']]), 'ct.xlsx');
    expect(bad.status).toBe(400);
    expect(line(await get(), 'Clients', 'count')).toMatchObject({ legacySource: 'workbook', legacyValue: 1 });
    const good = await loader.api('post', `/data-load/reconciliations/${recon.id}/legacy`).attach('file', sheet([['Clients', 'count', '', '2'], ['Sub-ledger', 'cash in bank', 'BPI-001', '1500']]), 'ct.xlsx');
    expect(good.status, JSON.stringify(good.body)).toBe(200);
    expect(line(good.body.data, 'Clients', 'count')).toMatchObject({ legacyValue: 2, legacySource: 'upload', status: 'matched' });
    // a bank account BrokerVerse has no opening balance for: the legacy figure alone, a difference
    expect(good.body.data.lines.find((l) => l.measure === 'cash-in-bank' && l.group === 'BPI-001')).toMatchObject({ systemValue: 0, legacyValue: 1500, status: 'difference' });
  });
});

describe('tie-out settings', () => {
  it('are maintained by an approver, with active GL accounts', async () => {
    const defs = (await loader.api('get', `/data-load/reconciliations/${recon.id}/tieouts`)).body.data.definitions;
    expect((await loader.api('put', '/data-load/settings/tieouts').send({ tieouts: defs })).status).toBe(403);
    const bad = await approver.api('put', '/data-load/settings/tieouts').send({ tieouts: [...defs, { key: 'x', label: 'X', source: 'listing', measure: 'nothing', accounts: ['999'] }] });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['tieouts[7].key', 'tieouts[7].measure', 'tieouts[7].accounts']));
    const changed = defs.map((d) => (d.key === 'unapplied-collections' ? { ...d, accounts: ['210230'] } : d));
    const r = await approver.api('put', '/data-load/settings/tieouts').send({ tieouts: changed });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.find((d) => d.key === 'unapplied-collections').accounts).toEqual(['210230']);
    expect((await s.api('put', '/settings').send({ settings: { 'migration.subledger_tieouts': [] } })).status).toBe(400);
  });
});
