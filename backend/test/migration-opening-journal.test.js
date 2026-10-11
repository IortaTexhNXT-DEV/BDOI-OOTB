/**
 * Opening balance journal (migration 0443, period-end/opening.js): every go-live opening balances set is documented by
 * one journal header (series opening_journal, status opening, origin migrated) without journal lines. Its view and print
 * read the lines of the set; the GL entry search, the ledger, the trial balance, the financial statements and the
 * year-end close are the same with or without it; it is read-only; the SAP GL daily file never carries it, and the
 * one-time SAP opening file is generated from it once, under the approval of a second user, when the setting is on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { many, one, pool, query, withTransaction } from '../src/db/pool.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { createJournal } from '../src/modules/accounting/lib/ledger.js';
import { ensureCalendar } from '../src/modules/period-end/fiscal.js';
import { writeOpeningJournal } from '../src/modules/period-end/opening.js';
import { resolveKey } from '../src/modules/uploads/storage.js';
import { businessRows, setLock, settle, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

let s;
let loader;
let approver;
let day;
let asAt;
const written = [];
const sapFolder = () => path.dirname(resolveKey('sap-outbound/x'));
const opening = (debit = '10000') => ({ 'Opening Balances': [{ 'Account Code': '1202001', Debit: debit }, { 'Account Code': '2201001', Credit: debit }] });
const journalOf = () => one('SELECT * FROM journal_vouchers WHERE source = \'go-live-opening\'');

/** Upload as the loader, submit, approve as the approver, wait for the load. */
async function loaded(sheets) {
  const r = await uploadAs(loader.api, workbook(s.kits, sheets));
  expect(r.body.data.errors).toEqual([]);
  expect((await loader.api('post', `/data-load/batches/${r.body.data.batch.id}/submit`).send({})).status).toBe(200);
  expect((await approver.api('post', `/data-load/batches/${r.body.data.batch.id}/approve`)).status).toBe(202);
  const b = await settle(loader.api, r.body.data.batch.id);
  expect(b.status, b.message).toBe('loaded');
  return b;
}

/** A report without the moment it was read. */
const stable = (v) => {
  if (Array.isArray(v)) return v.map(stable);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !/^(asOf|generatedAt|printedAt|readAt|at)$/.test(k)).map(([k, x]) => [k, stable(x)]));
};
/** Everything that reads the GL: entry search, trial balances, statements, ledger detail, year-end close. */
async function ledgerViews() {
  const from = addDays(asAt, -400);
  const to = addDays(s.cutover, 30);
  const out = {};
  for (const [k, p] of Object.entries({
    search: `/accounting/entries/search?startDate=${from}&endDate=${to}&pageSize=500`,
    searchAll: `/accounting/entries/search?status=opening&pageSize=500`,
    trialBalance: `/accounting/trial-balance?asOf=${to}`,
    tbStatement: `/period-end/statements/trial-balance?FromDate=${s.cutover}&ToDate=${to}`,
    income: `/period-end/statements/income-statement?FromDate=${s.cutover}&ToDate=${to}`,
    balanceSheet: `/period-end/statements/balance-sheet?FromDate=${s.cutover}&ToDate=${to}`,
    ledger: `/period-end/statements/gl-detail?Account=1202001&FromDate=${s.cutover}&ToDate=${to}`,
    yearEnd: '/period-end/year-end/overview',
  })) {
    const r = await s.api('get', p);
    expect(r.status, `${k} ${JSON.stringify(r.body).slice(0, 300)}`).toBe(200);
    out[k] = stable(r.body.data ?? r.body);
  }
  return out;
}

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'oj.loader': 'dl-loader', 'oj.approver': 'dl-approver' } });
  ({ 'oj.loader': loader, 'oj.approver': approver } = s.users);
  day = await today();
  asAt = addDays(s.cutover, -1);
  await ensureCalendar(pool, s.cutover);
});
afterAll(async () => {
  for (const f of written) fs.rmSync(path.join(sapFolder(), f), { force: true });
  await pool.end();
});

describe('the opening balance journal', () => {
  let batch;
  it('is a header numbered OBJ, status opening, origin migrated, without journal lines', async () => {
    batch = await loaded({ ...businessRows(s, 1), ...opening() });
    const j = await journalOf();
    expect(j).toMatchObject({ status: 'opening', kind: 'standard', jv_date: asAt, origin: 'migrated', legacy_number: batch.loadNumber, load_batch_id: batch.id,
      reference_type: 'DataLoadBatch', total_debit: 10000, total_credit: 10000, posted_at: null, sap_exported_at: null });
    expect(j.jv_number).toBe(`OBJ-${s.cutover.slice(0, 4)}-0001`);
    expect(j.description).toBe(`Opening balances as at ${asAt}, load ${batch.loadNumber}`);
    expect(await one('SELECT count(*)::int AS n FROM journal_lines WHERE jv_id = $1', [j.id])).toEqual({ n: 0 });
  });

  it('shows the lines of its opening balances set, read-only, with its origin, and prints', async () => {
    const j = await journalOf();
    const v = await s.api('get', `/journal-vouchers/${j.jv_number}`);
    expect(v.status).toBe(200);
    expect(v.body.data).toMatchObject({ status: 'opening', readOnly: true, totalDebit: 10000, totalCredit: 10000,
      origin: { kind: 'migrated', legacyNumber: batch.loadNumber, loadNumber: batch.loadNumber } });
    expect(v.body.data.entries.map((e) => [e.accountCode, e.debit, e.credit])).toEqual([['1202001', 10000, 0], ['2201001', 0, 10000]]);
    const list = (await s.api('get', '/journal-vouchers/history?pageSize=50')).body.data;
    expect(list.map((x) => x.transactionNumber)).toContain(j.jv_number);
    const pdf = await s.api('get', `/journal-vouchers/${j.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('cannot be posted, reversed, cancelled, approved, rejected or corrected (409)', async () => {
    const j = await journalOf();
    for (const action of ['post', 'reverse', 'cancel']) {
      const r = await s.api('put', `/accounting/transactions/${j.jv_number}/${action}`);
      expect(r.status, action).toBe(409);
      expect(r.body.message).toContain('opening balance journal');
    }
    expect((await s.api('post', `/journal-vouchers/${j.id}/approve`)).status).toBe(409);
    expect((await s.api('post', `/journal-vouchers/${j.id}/reject`).send({ reason: 'Not ours' })).status).toBe(409);
    expect((await s.api('post', '/journal-vouchers/reversal').send({ transactionNumber: j.jv_number })).status).toBe(409);
    expect((await s.api('post', '/journal-vouchers/correction').send({ transactionNumber: j.jv_number, entries: [{ mainAccount: '1202001', entryType: 'Debit', localAmount: 1 },
      { mainAccount: '2201001', entryType: 'Credit', localAmount: 1 }] })).status).toBe(409);
    expect(await journalOf()).toMatchObject({ status: 'opening', posted_at: null });
  });

  it('leaves the GL entry search, ledger, trial balance, statements and year-end close as they are without it', async () => {
    const withJournal = await ledgerViews();
    const j = await journalOf();
    const row = await one('SELECT to_jsonb(j) AS r FROM journal_vouchers j WHERE id = $1', [j.id]);
    await query('DELETE FROM journal_vouchers WHERE id = $1', [j.id]);
    const without = await ledgerViews();
    await query('INSERT INTO journal_vouchers SELECT * FROM jsonb_populate_record(NULL::journal_vouchers, $1)', [row.r]);
    expect(withJournal).toEqual(without);
    expect(withJournal.searchAll.length ?? withJournal.searchAll.rows?.length ?? 0).toBe(0);
    // the opening balances themselves are in the trial balance once
    const tb = withJournal.tbStatement;
    expect(JSON.stringify(tb)).toContain('1202001');
  });

  it('counts the opening balances in the trial balance API and keeps an account with an opening balance active', async () => {
    const tb = await s.api('get', `/accounting/trial-balance?asOf=${s.cutover}`);
    expect(tb.status).toBe(200);
    expect(tb.body.data.rows.find((r) => r.accountCode === '2201001')).toMatchObject({ opening: -10000, credit: 10000, balance: -10000 });
    expect(tb.body.data.totals).toMatchObject({ balanced: true });
    const off = await s.api('put', '/accounting/accounts/2201001').send({ status: 'inactive' });
    expect(off.status).toBe(409);
    expect(off.body.message).toMatch(/has a balance of -10000.00/);
  });

  it('the trial balance statuses can never include it', async () => {
    const r = await s.api('put', '/settings').send({ settings: { 'reports.trial_balance_statuses': ['approved', 'posted', 'opening'] } });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].path).toBe('reports.trial_balance_statuses');
    expect((await s.api('put', '/settings').send({ settings: { 'reports.trial_balance_statuses': ['approved', 'posted'] } })).status).toBe(200);
  });

  it('is replaced with its set (a new number) and written by the single-object import too', async () => {
    const before = await journalOf();
    const b2 = await loaded(opening('12000'));
    const after = await journalOf();
    expect(after.jv_number).toBe(`OBJ-${s.cutover.slice(0, 4)}-0002`);
    expect(after).toMatchObject({ total_debit: 12000, legacy_number: b2.loadNumber });
    expect(await one('SELECT count(*)::int AS n FROM journal_vouchers WHERE id = $1', [before.id])).toEqual({ n: 0 });
    // undo of the later load: its journal goes, the set it replaced gets its journal again
    expect((await loader.api('post', `/data-load/batches/${b2.id}/undo-request`).send({ reason: 'Wrong trial balance' })).status).toBe(200);
    expect((await approver.api('post', `/data-load/batches/${b2.id}/undo-approve`)).status).toBe(202);
    expect((await settle(loader.api, b2.id)).status).toBe('undone');
    expect(await many('SELECT total_debit, legacy_number FROM journal_vouchers WHERE source = \'go-live-opening\'')).toEqual([{ total_debit: 10000, legacy_number: batch.loadNumber }]);
  });
});

describe('SAP GL files', () => {
  it('the daily file never carries it', async () => {
    // a journal posted today, so the day has a file
    await withTransaction((db) => createJournal(db, { date: day, description: 'Bank charges', source: 'manual', status: 'posted',
      lines: [{ accountCode: '1202001', debit: 100, credit: 0 }, { accountCode: '2201001', debit: 0, credit: 100 }] }, { id: s.admin.id }));
    const r = await s.api('post', '/sap-gl/runs').send({ date: day });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    written.push(...r.body.data.files.map((f) => f.fileName));
    const files = await many('SELECT content FROM sap_gl_export_files WHERE export_id = $1', [r.body.data.id]);
    expect(files.length).toBe(2);
    const j = await journalOf();
    for (const f of files) expect(f.content).not.toContain(j.jv_number);
    expect(r.body.data.lineCount).toBe(2);
  });

  it('the one-time opening file: requested, approved by another user once go-live is locked, generated once', async () => {
    const state = (await loader.api('get', '/data-load/golive/sap-opening-file')).body.data;
    expect(state).toMatchObject({ enabled: false, journal: { journalNumber: (await journalOf()).jv_number, sapExportedAt: null }, run: null });
    expect((await loader.api('post', '/data-load/golive/sap-opening-file').send({ reason: 'SAP takes the opening position from BrokerVerse' })).status).toBe(409);
    const on = await loader.api('put', '/data-load/golive/settings').send({ settings: { sapGlIncludeOpening: true }, reason: 'SAP takes the opening position from BrokerVerse' });
    expect(on.status, JSON.stringify(on.body)).toBe(201);
    expect((await approver.api('post', `/data-load/golive/lock-requests/${on.body.data.id}/approve`).send({})).status).toBe(200);
    expect((await loader.api('post', '/data-load/golive/sap-opening-file').send({})).status).toBe(400);
    const req = await loader.api('post', '/data-load/golive/sap-opening-file').send({ reason: 'SAP takes the opening position from BrokerVerse' });
    expect(req.status, JSON.stringify(req.body)).toBe(201);
    expect(req.body.data.pendingRequest).toMatchObject({ status: 'pending', requestedBy: 'oj.loader' });
    expect((await loader.api('post', '/data-load/golive/sap-opening-file').send({ reason: 'again' })).status).toBe(409);
    expect((await loader.api('post', '/data-load/golive/sap-opening-file/approve')).status).toBe(403);
    expect((await approver.api('post', '/data-load/golive/sap-opening-file/approve')).status).toBe(409);
    await setLock(true);
    try {
      const ok = await approver.api('post', '/data-load/golive/sap-opening-file/approve');
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      const run = ok.body.data.run;
      written.push(...run.files.map((f) => f.fileName));
      expect(run).toMatchObject({ trigger: 'opening', status: 'done', lineCount: 2, totalDebit: 10000, totalCredit: 10000 });
      expect(run.files.every((f) => /_OPENING\.txt$/.test(f.fileName))).toBe(true);
      expect(ok.body.data.journal.sapExportedAt).toBeTruthy();
      const line = await s.api('get', '/data-load/golive/sap-opening-file/files/line');
      expect(line.status).toBe(200);
      expect(line.text).toContain('1202001');
      expect(line.text).toContain(asAt);
      // generated once: no second request, and the set behind it can no longer change
      expect((await loader.api('post', '/data-load/golive/sap-opening-file').send({ reason: 'again' })).status).toBe(409);
      await expect(withTransaction((db) => writeOpeningJournal(db, { goLiveDate: s.cutover }))).rejects.toMatchObject({ status: 409 });
      const audit = await many('SELECT action FROM audit_log WHERE entity = \'sap_opening_file\' ORDER BY id');
      expect(audit.map((a) => a.action)).toEqual(['request', 'approve', 'download']);
    } finally {
      await setLock(false);
    }
  });

  it('the daily file of the next run still does not carry it', async () => {
    const r = await s.api('post', '/sap-gl/runs').send({ date: day });
    written.push(...r.body.data.files.map((f) => f.fileName));
    const j = await journalOf();
    for (const f of await many('SELECT content FROM sap_gl_export_files WHERE export_id = $1', [r.body.data.id])) expect(f.content).not.toContain(j.jv_number);
    expect(await one('SELECT count(*)::int AS n FROM sap_gl_exports WHERE trigger = \'opening\'')).toEqual({ n: 1 });
  });
});

describe('the single-object opening balances import', () => {
  it('writes the opening balance journal of its set, without a load', async () => {
    await query('UPDATE journal_vouchers SET sap_exported_at = NULL WHERE source = \'go-live-opening\'');
    await query('DELETE FROM journal_vouchers WHERE source = \'manual\' AND description = \'Bank charges\'');
    const file = writeXlsx({ sheets: [{ name: 'Data', columns: ['Account Code', 'Debit', 'Credit'].map((header) => ({ header })),
      rows: [['1202001', '7000', ''], ['2201001', '', '7000']] }] });
    const r = await s.api('post', '/period-end/opening-balances/import').field('goLiveDate', s.cutover).attach('file', file, 'tb.xlsx');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const j = await journalOf();
    expect(r.body.data.journalNumber).toBe(j.jv_number);
    expect(j).toMatchObject({ total_debit: 7000, origin: 'migrated', legacy_number: null, load_batch_id: null, reference_type: 'OpeningBalances', status: 'opening' });
  });
});
