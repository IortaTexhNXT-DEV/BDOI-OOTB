/**
 * Period Management: the preview of a status change (blocking checks, who may reopen), the reason of every status
 * change (Reason Codes master, contexts period_close and period_reopen), the latest change and the allowed moves of
 * each period, the history with names, roles and reasons, and the Validate step of the opening balance import.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { withCalendarFiscalYear } from './helpers.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { cancelJournal, createJournal } from '../src/modules/accounting/lib/ledger.js';

let ctx;
let admin;
let maker;
beforeAll(async () => {
  ctx = await setupFinance();
  await withCalendarFiscalYear();
  admin = ctx.api;
  maker = ctx.as('maker');
  expect((await admin('get', '/period-end/fiscal-years')).status).toBe(200); // generates the calendar
});
afterAll(async () => { await pool.end(); });

const lines = [{ accountCode: '4402002', debit: 500, credit: 0 }, { accountCode: '2208001', debit: 0, credit: 500 }];
const status = (who, period, body) => who('post', `/period-end/periods/${period}/status`).send(body);
const preview = (who, period, to) => who('get', `/period-end/periods/${period}/status-preview?status=${to}`);
const periodOf = async (who, fy, period) => (await who('get', `/period-end/fiscal-years/${fy}`)).body.data.periods.find((p) => p.period === period);

describe('status change preview', () => {
  it('lists the blocking checks before a close and is not allowed while one fails; nothing changes', async () => {
    const pending = await withTransaction((db) => createJournal(db, { date: '2026-03-12', description: 'pending accrual', status: 'pending', lines }, { id: null }));
    const r = await preview(maker, '2026-03', 'soft_closed');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ period: '2026-03', from: 'open', to: 'soft_closed', reasonContext: 'period_close', allowed: false, reason: 'checks' });
    expect(r.body.data.checks.map((c) => c.code)).toEqual(expect.arrayContaining(['unposted_journals', 'trial_balance']));
    expect(r.body.data.checks.every((c) => c.severity === 'blocking')).toBe(true);
    expect(r.body.data.checks.find((c) => c.code === 'unposted_journals')).toMatchObject({ status: 'failed', count: 1 });
    expect((await query('SELECT status FROM accounting_periods WHERE period = \'2026-03\'')).rows[0].status).toBe('open');

    await withTransaction((db) => cancelJournal(db, pending.id, { id: null }));
    const clear = (await preview(maker, '2026-03', 'soft_closed')).body.data;
    expect(clear.checks.find((c) => c.code === 'unposted_journals')).toMatchObject({ status: 'passed', count: 0 });
  });

  it('answers a reopen preview with the permission it needs, without running checks', async () => {
    expect((await status(maker, '2026-04', { status: 'soft_closed', reasonCode: 'PCL-MONTHEND' })).status).toBe(200);
    const asMaker = (await preview(maker, '2026-04', 'open')).body.data;
    expect(asMaker).toMatchObject({ from: 'soft_closed', to: 'open', reasonContext: 'period_reopen', allowed: false, reason: 'permission', checks: [] });
    expect((await preview(admin, '2026-04', 'open')).body.data).toMatchObject({ allowed: true, reason: null });
    expect((await preview(maker, '2026-04', 'locked')).status).toBe(400);
    expect((await ctx.as('agent')('get', '/period-end/periods/2026-04/status-preview?status=open')).status).toBe(403);
  });
});

describe('reason of a status change', () => {
  it('needs a reason of the right context, and the note when the reason asks for one', async () => {
    const none = await status(maker, '2026-05', { status: 'soft_closed', remarks: 'free text' });
    expect(none.status).toBe(400);
    expect(none.body.errors[0].path).toBe('reasonCode');
    expect((await status(maker, '2026-05', { status: 'soft_closed', reasonCode: 'PRO-LATEDOC' })).status).toBe(400);
    const other = await status(maker, '2026-05', { status: 'soft_closed', reasonCode: 'PCL-OTHER' });
    expect(other.status).toBe(400);
    expect(other.body.errors[0].path).toBe('note');
    expect((await query('SELECT status FROM accounting_periods WHERE period = \'2026-05\'')).rows[0].status).toBe('open');
  });

  it('keeps the reason code and text in the history and the audit trail, and shows the latest change on the period', async () => {
    const r = await status(maker, '2026-05', { status: 'soft_closed', reasonCode: 'PCL-SIGNOFF', note: 'Insurer statements pending' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const h = (await query('SELECT reason_code, remarks FROM period_status_history WHERE period = \'2026-05\' ORDER BY id DESC LIMIT 1')).rows[0];
    expect(h).toEqual({ reason_code: 'PCL-SIGNOFF', remarks: 'Reconciliations reviewed and signed off: Insurer statements pending' });
    const a = (await query('SELECT after_data FROM audit_log WHERE entity = \'accounting_period\' AND entity_id = \'2026-05\' ORDER BY id DESC LIMIT 1')).rows[0].after_data;
    expect(a).toMatchObject({ status: 'soft_closed', reasonCode: 'PCL-SIGNOFF', note: 'Insurer statements pending' });

    const p = await periodOf(maker, 'FY2026', '2026-05');
    expect(p.lastChange).toMatchObject({ to: 'soft_closed', byName: 'maker user', reasonCode: 'PCL-SIGNOFF', reasonName: 'Reconciliations reviewed and signed off', source: 'manual' });
    // closing is the checker's (approve:period-end): the maker sees it refused, with the reason
    expect(p.actions).toEqual({ close: { allowed: false, reason: 'approval', message: expect.any(String) }, reopen: { allowed: false, reason: 'permission', message: expect.any(String) } });
    expect((await periodOf(admin, 'FY2026', '2026-05')).actions.reopen).toEqual({ allowed: true });
    expect((await periodOf(maker, 'FY2026', '2026-06')).actions).toEqual({ softClose: { allowed: true }, close: { allowed: false, reason: 'approval', message: expect.any(String) } });
    expect((await periodOf(admin, 'FY2026', '2026-06')).actions.close).toEqual({ allowed: true });
  });

  it('refuses a reopen without approve:period-end before looking at the reason, and takes a period_reopen reason from an approver', async () => {
    expect((await status(maker, '2026-05', { status: 'open', reasonCode: 'PRO-LATEDOC' })).status).toBe(403);
    expect((await status(admin, '2026-05', { status: 'open', reasonCode: 'PCL-MONTHEND' })).status).toBe(400);
    expect((await status(admin, '2026-05', { status: 'open', reasonCode: 'PRO-LATEDOC' })).status).toBe(200);
    const hist = (await maker('get', '/period-end/periods/2026-05/history')).body.data;
    expect(hist[0]).toMatchObject({ from: 'soft_closed', to: 'open', reasonCode: 'PRO-LATEDOC', reasonName: 'Late insurer statement or supplier invoice', source: 'manual' });
    expect(hist[0].changedByName).toBeTruthy();
    expect(Array.isArray(hist[0].changedByRoles)).toBe(true);
    expect(hist[1]).toMatchObject({ to: 'soft_closed', changedByName: 'maker user', changedByRoles: expect.arrayContaining([expect.any(String)]) });
  });
});

describe('opening balances: validate before loading', () => {
  const tb = (rows) => Buffer.from([['Account Code', 'Account Name', 'Debit', 'Credit'], ...rows].map((r) => r.join(',')).join('\r\n'));
  const GOOD = [['1102001', 'Cash in bank', '1000000', ''], ['2201001', 'Due to insurers', '', '30000'], ['5101001', 'Retained earnings', '', '970000'], ['1101001', 'Cash on hand', '', '']];
  const send = (who, route, rows, goLiveDate = '2030-01-01') => who('post', `/period-end/opening-balances/${route}`).field('goLiveDate', goLiveDate).attach('file', tb(rows), 'tb.csv');
  const count = async () => (await query('SELECT count(*)::int AS n FROM opening_balances')).rows[0].n;

  it('reports the totals of a balanced file without loading it', async () => {
    const r = await send(maker, 'validate', GOOD);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ valid: true, fiscalYear: 'FY2030', goLiveDate: '2030-01-01', asAt: '2029-12-31', rows: 4, accounts: 3,
      totalDebit: 1000000, totalCredit: 1000000, difference: 0, errors: [], previous: null, ignored: [{ row: 5, accountCode: '1101001' }] });
    expect(await count()).toBe(0);
  });

  it('lists every error with its row and column, and an unbalanced file with its difference', async () => {
    const bad = (await send(maker, 'validate', [['9999999', '', '100', ''], ['2201001', '', '50', '50'], ['2201001', '', 'abc', ''], ['5101001', '', '', '10']])).body.data;
    expect(bad.valid).toBe(false);
    expect(bad.errors).toEqual(expect.arrayContaining([
      { row: 2, column: 'Account Code', message: 'Account 9999999 is not in the chart of accounts' },
      { row: 3, column: 'Debit / Credit', message: 'Enter the balance as a debit or a credit, not both' },
      { row: 4, column: 'Debit', message: 'Debit must be a number' },
      { row: 4, column: 'Account Code', message: 'Account 2201001 appears more than once' },
    ]));
    const unbalanced = (await send(maker, 'validate', [['1102001', '', '100', ''], ['5101001', '', '', '90']])).body.data;
    expect(unbalanced).toMatchObject({ valid: false, totalDebit: 100, totalCredit: 90, difference: 10 });
    expect(unbalanced.errors).toEqual([{ row: null, column: null, message: 'Debits ₱100.00 and credits ₱90.00 do not balance (difference ₱10.00)' }]);
    // the difference of the rows read is listed beside the row errors
    const both = (await send(maker, 'validate', [['1102001', '', '100', ''], ['5101001', '', '', '90'], ['5101002', '', '-5', '']])).body.data;
    expect(both.errors).toEqual(expect.arrayContaining([{ row: 4, column: 'Debit', message: 'Debit cannot be negative' },
      { row: null, column: null, message: expect.stringMatching(/do not balance/) }]));
    expect((await send(maker, 'validate', GOOD, '')).status).toBe(400);
    expect(await count()).toBe(0);
  });

  it('names the earlier load that a load for the same date replaces, and a load for another date as an error', async () => {
    const load = await send(maker, 'import', GOOD);
    expect(load.status, JSON.stringify(load.body)).toBe(200);
    const again = (await send(maker, 'validate', GOOD)).body.data;
    expect(again.valid).toBe(true);
    expect(again.previous).toMatchObject({ goLiveDate: '2030-01-01', accounts: 3, loadedBy: 'maker user' });
    expect(again.previous.loadedAt).toBeTruthy();
    const other = (await send(maker, 'validate', GOOD, '2030-02-01')).body.data;
    expect(other.valid).toBe(false);
    expect(other.errors[0]).toMatchObject({ row: null, column: 'Go-live date' });
    expect(other.errors[0].message).toMatch(/loaded for go-live date 2030-01-01/);
  });

  it('keeps the error rows of the import in the format of the go-live workbench, with row and column', async () => {
    const r = await send(maker, 'import', [['9999999', '', '100', ''], ['5101001', '', '', '100']]);
    expect(r.status).toBe(400);
    expect(r.body.errors[0]).toEqual({ path: 'row 2', row: 2, column: 'Account Code', message: 'Row 2: Account 9999999 is not in the chart of accounts' });
  });

  it('is refused without write:period-end', async () => {
    expect((await send(ctx.as('agent'), 'validate', GOOD)).status).toBe(403);
  });
});
