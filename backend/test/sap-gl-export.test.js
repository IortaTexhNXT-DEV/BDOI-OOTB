/**
 * SAP GL text files (migration 0347, TIS-BRD-INTG-04): the default layout reproduces the sample rows of the workbook
 * sheet "Text File - SAP"; a day's run takes the entries posted between the previous and this cut-off, writes the
 * header (ARHD) and line (ARLI) files to the pick-up folder and keeps them with the run; re-generation is a new run;
 * an empty day writes nothing; the layout can be changed by configuration (fixed width).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache, getSetting } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { createJournal } from '../src/modules/accounting/lib/ledger.js';
import { resolveKey } from '../src/modules/uploads/storage.js';
import { checkLayout, fillTemplate, formatDate, renderFiles } from '../src/modules/sap-gl/layout.js';
import * as handlers from '../src/jobs/handlers.js';
import { withoutConfigurationApproval } from './helpers.js';

let ctx;
let day;
const folder = () => path.dirname(resolveKey('sap-outbound/x'));
const written = [];
beforeAll(async () => { ctx = await setupFinance(); await withoutConfigurationApproval(); day = await today(); });
afterAll(async () => {
  for (const f of written) fs.rmSync(path.join(folder(), f), { force: true });
  await pool.end();
});

const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
/** A posted journal on the given accounts (dated on `date`, posted now unless postedAt is given). */
async function journal({ date = day, lines, description = 'Remittance of Philhealth Contributions', transactionCode = 'APV2026-07-090-938', postedAt = null }) {
  const jv = await withTransaction((db) => createJournal(db, { date, description, transactionCode, source: 'manual', lines }, { id: ctx.userIds.maker }));
  if (postedAt) await query('UPDATE journal_vouchers SET posted_at = $2 WHERE id = $1', [jv.id, postedAt]);
  return jv;
}

describe('SAP GL file layout', () => {
  it('the default layout is valid and renders the sample rows of the sheet', async () => {
    const layout = await getSetting('sap_gl.layout');
    expect(checkLayout(layout)).toEqual([]);
    const files = renderFiles(layout, { exportDate: '2026-08-01', runNo: 1, docs: [{ docNo: 1, postingDate: '2026-08-01', currency: 'PHP', lines: [
      { glCode: '210090', debit: 2120.89, credit: 0, text: 'Remittance of Philhealth Contributions (Employee-Employer Share) - June 2026', costCentre: '900901', valueDate: '2026-08-01',
        assignment: '901314440', journalNumber: 'JV-2026-00001', sourceDocument: 'APV2026-07-090-938' },
      { glCode: '210000', debit: 0, credit: 2120.89, text: 'Remittance of Philhealth Contributions (Employee-Employer Share) - June 2026', costCentre: '900901', valueDate: '2026-08-01',
        assignment: '901314440', journalNumber: 'JV-2026-00001', sourceDocument: 'PV2026-07-090-940' }] }] });
    expect(files.header.fileName).toBe('ARHDTISPH20260801.txt');
    expect(files.line.fileName).toBe('ARLITISPH20260801.txt');
    const header = files.header.content.split('\r\n');
    expect(header[0]).toBe(['DOCNO', 'BLART', 'BELNR', 'BUKRS', 'BLDAT', 'BUDAT', 'XBLNR', 'BKTXT', 'WAERS'].join('\t'));
    expect(header[1]).toBe(['1', 'ZI', '', '4F29', '2026-08-01', '2026-08-01', 'UPLOAD_GL', 'Aug 01 2026 TISPH GL Bal #01', 'PHP'].join('\t'));
    const lines = files.line.content.split('\r\n');
    expect(lines[0].split('\t')).toEqual(['DOCNO', 'BSCHL', 'SAKNR', 'HKONT', 'UMSKZ', 'WRBTR', 'MWSKZ', 'SGTXT', 'KOSTL', 'PRCTR', 'POSID', 'NPLNR', 'VORNR', 'ZTERM', 'VALUT',
      'ZFBDT', 'ZUONR', 'EBLN', 'VBELN', 'POSN2', 'XREF1', 'XREF2', 'XREF3']);
    expect(lines[1].split('\t')).toEqual(['1', '40', '210090', '210090', '', '2120.89', '', 'Remittance of Philhealth Contributions (Employee-Employer Share) - June 2026', '900901', '900901',
      '', '', '', '', '2026-08-01', '', '901314440', '', '', '', '900901', 'JV-2026-00001', 'APV2026-07-090-938']);
    expect(lines[2].split('\t').slice(0, 6)).toEqual(['1', '50', '210000', '210000', '', '2120.89']);
    expect(files.line.records).toBe(2);
  });

  it('fills templates, formats dates and reports unusable layouts', () => {
    expect(formatDate('2026-08-01', 'MMM DD YYYY')).toBe('Aug 01 2026');
    expect(formatDate('2026-12-31', 'YYMMDD')).toBe('261231');
    expect(fillTemplate('ARHD{date:YYYYMMDD}-{runNo}-{docNo:000}', { date: '2026-08-01', runNo: 2, docNo: 7 })).toBe('ARHD20260801-2-007');
    expect(checkLayout({ format: 'fixed', header: { fileName: 'h', fields: [{ name: 'A', source: 'nope' }] }, line: { fileName: 'l', fields: [] } })).toEqual([
      'header.fields[0] (A): unknown source nope', 'header.fields[0] (A): a fixed layout needs a width', 'line.fields must list the fields']);
  });

  it('writes fixed-width records when the layout says so', () => {
    const layout = { format: 'fixed', lineEnding: 'LF', fieldNames: false, dateFormat: 'YYYYMMDD', debitKey: '40', creditKey: '50',
      header: { fileName: 'H{date:YYMMDD}.txt', text: '', fields: [{ name: 'DOCNO', source: 'docNo', width: 3, align: 'right', pad: '0' }, { name: 'BUDAT', source: 'postingDate', width: 8 }] },
      line: { fileName: 'L.txt', fields: [{ name: 'BSCHL', source: 'postingKey', width: 2 }, { name: 'WRBTR', source: 'amount', width: 10, align: 'right' }, { name: 'SGTXT', source: 'text', width: 5 }] } };
    expect(checkLayout(layout)).toEqual([]);
    const f = renderFiles(layout, { exportDate: '2026-08-01', runNo: 1, docs: [{ docNo: 1, postingDate: '2026-08-01', lines: [{ debit: 5, credit: 0, text: 'Accrual of rent' }] }] });
    expect(f.header).toMatchObject({ fileName: 'H260801.txt', content: '00120260801\n' });
    expect(f.line.content).toBe('40      5.00Accru\n');
  });
});

describe('SAP GL file of a day', () => {
  it('takes the entries posted since the previous cut-off, one document per posting date, and writes both files', async () => {
    const yesterday = addDays(day, -1);
    const lines = (amount) => [{ accountCode: '658000', debit: amount, credit: 0, memo: 'Audit fee' }, { accountCode: '210030', debit: 0, credit: amount, memo: 'Accrued' }];
    const a = await journal({ lines: lines(100) });
    const b = await journal({ date: yesterday, lines: lines(250), transactionCode: 'APV-B' });
    // posted before yesterday's cut-off: in yesterday's file, not today's
    const old = await journal({ lines: lines(999), postedAt: (await query(`SELECT (($1::date - 1) + time '23:00') AT TIME ZONE 'Asia/Manila' AS t`, [day])).rows[0].t });
    const r = await ctx.as('maker')('post', '/sap-gl/runs').send({ date: day });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const run = r.body.data;
    const ymd = day.replace(/-/g, '');
    expect(run).toMatchObject({ exportDate: day, runNo: 1, status: 'done', trigger: 'manual', folder: 'sap-outbound' });
    expect(run.files.map((f) => f.fileName)).toEqual([`ARHDTISPH${ymd}.txt`, `ARLITISPH${ymd}.txt`]);
    written.push(...run.files.map((f) => f.fileName));
    const lineFile = fs.readFileSync(path.join(folder(), `ARLITISPH${ymd}.txt`), 'utf8');
    expect(lineFile).toContain(a.jv_number);
    expect(lineFile).toContain(b.jv_number);
    expect(lineFile).not.toContain(old.jv_number);
    const rows = lineFile.trim().split('\r\n').slice(1).map((l) => l.split('\t'));
    const header = fs.readFileSync(path.join(folder(), `ARHDTISPH${ymd}.txt`), 'utf8').trim().split('\r\n').slice(1).map((l) => l.split('\t'));
    // one SAP document per posting date (BUDAT), in date order; each line belongs to the document of its posting date
    expect(header).toHaveLength(run.documentCount);
    expect(header.map((h) => h[5])).toEqual([...header.map((h) => h[5])].sort());
    const docOf = Object.fromEntries(header.map((h) => [h[5], h[0]]));
    for (const x of rows) expect(x[0]).toBe(docOf[x[14]]);
    expect(header.find((h) => h[0] === docOf[day])[7]).toMatch(new RegExp(` TISPH GL Bal #${docOf[day].padStart(2, '0')}$`));
    expect(rows.filter((x) => x[22] === 'APV-B').map((x) => x[14])).toEqual([yesterday, yesterday]);
    expect(rows.filter((x) => x[21] === a.jv_number).map((x) => [x[1], x[5], x[8], x[14]])).toEqual([['40', '100.00', '900901', day], ['50', '100.00', '900901', day]]);
    expect(run.totalDebit).toBe(run.totalCredit);
    // download as written
    const dl = await ctx.as('maker')('get', `/sap-gl/runs/${run.id}/files/line`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain(`ARLITISPH${ymd}.txt`);
    expect(dl.text).toBe(lineFile);
  });

  it('re-generates a day as a new run, flags accounts outside the SAP chart and records an empty day', async () => {
    await journal({ lines: [{ accountCode: '4401004', debit: 30, credit: 0 }, { accountCode: '106010', debit: 0, credit: 30 }] });
    const again = await ctx.as('maker')('post', '/sap-gl/runs').send({ date: day });
    expect(again.body.data).toMatchObject({ runNo: 2, status: 'done' });
    expect(again.body.data.warnings.join(' ')).toMatch(/4401004/);
    const list = await ctx.as('maker')('get', '/sap-gl/runs');
    expect(list.body.data.slice(0, 2).map((x) => x.runNo)).toEqual([2, 1]);
    const empty = await ctx.as('maker')('post', '/sap-gl/runs').send({ date: '2025-01-15' });
    expect(empty.body.data).toMatchObject({ status: 'empty', lineCount: 0, files: [] });
    expect((await ctx.as('maker')('post', '/sap-gl/runs').send({ date: addDays(day, 1) })).status).toBe(400);
    expect((await ctx.as('sales')('get', '/sap-gl/runs')).status).toBe(403);
  });

  it('runs as the scheduled job sap-gl-export at the cut-off', async () => {
    const job = (await query("SELECT cron, handler, enabled FROM scheduled_jobs WHERE code = 'sap-gl-export'")).rows[0];
    expect(job).toEqual({ cron: '59 23 * * *', handler: 'sapGlExport', enabled: true });
    const out = await handlers.sapGlExport();
    expect(out).toMatchObject({ exportDate: day, runNo: 3, status: 'done' });
    expect((await query('SELECT trigger FROM sap_gl_exports WHERE export_date = $1 AND run_no = 3', [day])).rows[0].trigger).toBe('schedule');
    await setSetting('sap_gl.layout', { format: 'csv' });
    expect((await ctx.as('maker')('post', '/sap-gl/runs').send({ date: day })).status).toBe(400);
  });
});
