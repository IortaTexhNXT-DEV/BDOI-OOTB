/**
 * Journal voucher upload (TIS-BRD-NIA-05): the three-sheet template, all-or-nothing validation (balanced vouchers,
 * accounts that exist and take manual entries, valid cost centres, open period, one date and transaction code per
 * voucher) and the vouchers parked for approval by another user.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { today } from '../src/lib/dates.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { withoutConfigurationApproval } from './helpers.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
let day;
beforeAll(async () => { ctx = await setupFinance(); await withoutConfigurationApproval(); day = await today(); });
afterAll(async () => { await pool.end(); });

const HEADER = 'Voucher Ref,Voucher Date,Transaction Code,Description,Account Code,Debit,Credit,Line Text,Cost Center';
const csv = (rows) => Buffer.from([HEADER, ...rows].join('\r\n'));
const upload = (who, rows, name = 'jv.csv') => ctx.as(who)('post', '/journal-vouchers/upload').attach('file', csv(rows), name);
const mode = async (m) => { await query('UPDATE app_settings SET value = $1 WHERE key = \'journal.upload_mode\'', [JSON.stringify(m)]); clearSettingsCache(); };
const count = async () => (await query("SELECT count(*)::int AS n FROM journal_vouchers WHERE reference_type = 'JournalVoucherUpload'")).rows[0].n;

describe('journal voucher upload', () => {
  it('downloads the template with its Data, Columns and Instructions sheets', async () => {
    const r = await ctx.as('maker')('get', '/journal-vouchers/upload/template').buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toContain('Journal_Vouchers_Upload_Template.xlsx');
    const sheets = readWorkbook(r.body);
    expect(sheets.map((s) => s.name)).toEqual(['Data', 'Columns', 'Instructions']);
    expect(sheets[0].rows[0]).toEqual(expect.arrayContaining(['Voucher Ref', 'Voucher Date', 'Account Code', 'Debit', 'Credit', 'Cost Center']));
  });

  it('creates one voucher per reference, parked for approval by another user', async () => {
    const r = await upload('maker', [
      `ACCR-1,${day},JV,Accrual of audit fees,658000,25000,,Audit FY2026,`,
      `ACCR-1,${day},JV,,210030,,25000,Accrued audit fee,`,
      `BANK-1,${day},JV,Bank charges,650010,150,,Service charge,900901`,
      `BANK-1,${day},JV,Bank charges,106010,,150,Service charge,900901`,
    ]);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.total).toBe(4);
    expect(r.body.data.vouchers.map((v) => [v.voucherRef, v.status, v.totalDebit, v.lineCount])).toEqual([['ACCR-1', 'for-approval', 25000, 2], ['BANK-1', 'for-approval', 150, 2]]);
    const accr = r.body.data.vouchers[0];
    expect(accr.transactionNumber).toMatch(/^JV-/);
    expect(accr.description).toBe('Accrual of audit fees');
    const lines = (await query('SELECT account_code, debit::float AS d, credit::float AS c, memo, cost_centre FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [accr.id])).rows;
    expect(lines).toEqual([{ account_code: '658000', d: 25000, c: 0, memo: 'Audit FY2026', cost_centre: '900901' }, { account_code: '210030', d: 0, c: 25000, memo: 'Accrued audit fee', cost_centre: '900901' }]);
    expect((await ctx.as('maker')('post', `/journal-vouchers/${accr.id}/approve`)).status).toBe(403);
    expect((await ctx.as('checker')('post', `/journal-vouchers/${accr.id}/approve`)).body.data.status).toBe('posted');
  });

  it('all-or-nothing: checks the whole file first and saves nothing when a voucher is wrong', async () => {
    await mode('all-or-nothing');
    const before = await count();
    const r = await upload('maker', [
      `OK-1,${day},JV,Fine,658000,100,,,`,
      `OK-1,${day},JV,Fine,210030,,100,,`,
      `UNBAL,${day},JV,Out by 1,658000,100,,,`,
      `UNBAL,${day},JV,Out by 1,210030,,99,,`,
      `BADACCT,${day},JV,No such account,999999,50,,,`,
      `BADACCT,${day},JV,No such account,210030,,50,,`,
      `BOTH,${day},JV,Two amounts,658000,10,10,,`,
      `BOTH,${day},JV,Two amounts,210030,,10,,`,
      `DATES,${day},JV,Two dates,658000,10,,,`,
      'DATES,2020-01-01,JV,Two dates,210030,,10,,',
      `CC,${day},JV,Unknown cost centre,658000,10,,,ZZZ`,
      `CC,${day},JV,Unknown cost centre,210030,,10,,`,
    ]);
    expect(r.status).toBe(400);
    const messages = r.body.errors.map((e) => `${e.path}: ${e.message}`);
    expect(messages.find((m) => m.startsWith('row 4 (UNBAL)'))).toMatch(/not balanced/);
    expect(messages.find((m) => m.startsWith('row 6 (BADACCT)'))).toMatch(/999999/);
    expect(messages.find((m) => m.startsWith('row 8 (BOTH)'))).toMatch(/Debit or in Credit/);
    expect(messages.find((m) => m.startsWith('row 11 (DATES)'))).toMatch(/Voucher Date differs/);
    expect(messages.find((m) => m.startsWith('row 12 (CC)'))).toMatch(/ZZZ/);
    expect(messages.some((m) => m.includes('OK-1'))).toBe(false);
    expect(await count()).toBe(before);
    await mode('partial');
  });

  it('partial (the default, NFR-07.4): saves the valid vouchers and lists the rows of the failed ones', async () => {
    const before = await count();
    const r = await upload('maker', [
      `GOOD-1,${day},JV,Fine,658000,100,,,`,
      `GOOD-1,${day},JV,Fine,210030,,100,,`,
      `UNBAL-2,${day},JV,Out by 1,658000,100,,,`,
      `UNBAL-2,${day},JV,Out by 1,210030,,99,,`,
      `CODE-3,${day},NOPE,Unknown code,658000,10,,,`,
      `CODE-3,${day},NOPE,Unknown code,210030,,10,,`,
    ]);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.mode).toBe('partial');
    expect(r.body.data.vouchers.map((v) => v.voucherRef)).toEqual(['GOOD-1']);
    const failed = r.body.data.failed.map((e) => `${e.path}: ${e.message}`);
    expect(failed.find((m) => m.startsWith('row 4 (UNBAL-2)'))).toMatch(/not balanced/);
    expect(failed.find((m) => m.startsWith('row 6 (CODE-3)'))).toMatch(/Transaction Code NOPE/);
    expect(r.body.message).toMatch(/2 row error/);
    expect(await count()).toBe(before + 1);
    // a file where every voucher fails is refused as before
    expect((await upload('maker', [`CODE-4,${day},NOPE,x,658000,10,,,`, `CODE-4,${day},NOPE,x,210030,,10,,`])).status).toBe(400);
  });

  it('refuses accounts closed to manual entries and periods closed for posting', async () => {
    await query("UPDATE gl_accounts SET allow_manual = false WHERE code = '650010'");
    const manual = await upload('maker', [`M-1,${day},JV,Charges,650010,10,,,`, `M-1,${day},JV,Charges,106010,,10,,`]);
    expect(manual.status).toBe(400);
    expect(JSON.stringify(manual.body.errors)).toMatch(/not allowed on manual vouchers/);
    await query("UPDATE gl_accounts SET allow_manual = true WHERE code = '650010'");
    const period = `${day.slice(0, 7)}`;
    await query(`INSERT INTO accounting_periods(period, status) VALUES ($1, 'closed') ON CONFLICT (period) DO UPDATE SET status = 'closed'`, [period]);
    const closed = await upload('maker', [`P-1,${day},JV,Late,658000,10,,,`, `P-1,${day},JV,Late,210030,,10,,`]);
    expect(closed.status).toBe(400);
    expect(JSON.stringify(closed.body.errors)).toMatch(/closed/i);
    await query('UPDATE accounting_periods SET status = \'open\' WHERE period = $1', [period]);
    expect((await ctx.as('sales')('post', '/journal-vouchers/upload').attach('file', csv([]), 'jv.csv')).status).toBe(403);
  });
});
