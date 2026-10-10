/**
 * TISPH report layouts (seed 95, queries in src/modules/reports/tisphQueries.js) and the financial statement versions
 * (migration 0527, seed 94): CR-16 FS by version and Daily GL Balance, CR-15 cash control, CR-14 net remittance and
 * premium by payment status; who may run them; version maintenance.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';

let ctx; let day; let finance; let bp; let sales; let ops;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const r2 = (n) => Math.round(Number(n) * 100) / 100;
async function person(username, role) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles: [role] });
  expect(r.status).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const run = async (who, code, body) => {
  const r = await who('post', `/reports/${code}/run`).send({ perPage: 500, ...body });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
};

beforeAll(async () => {
  ctx = await setup();
  day = await today();
  finance = await person('rpt.tis.finance', 'tis-finance');
  bp = await person('rpt.tis.bp', 'tis-ccd-bp');
  sales = await person('rpt.tis.sales', 'tis-sales-officer');
  ops = await person('rpt.tis.ops', 'tis-ops-officer');
});
afterAll(async () => { await pool.end(); });

describe('catalogue', () => {
  it('runs every TISPH layout over the sample business', async () => {
    const codes = (await q("SELECT code FROM report_definitions WHERE code LIKE 'tisph-%' ORDER BY sort_order")).map((r) => r.code);
    expect(codes).toHaveLength(13);
    for (const code of codes) await run(ctx.api, code, { FromDate: addDays(day, -20), ToDate: day });
  });

  it('shows each layout to the roles that use it', async () => {
    expect((await sales('post', '/reports/tisph-pdc-maturing/run').send({})).status).toBe(403);
    expect((await sales('post', '/reports/tisph-daily-gl-balance/run').send({})).status).toBe(403);
    expect((await ops('post', '/reports/tisph-payment-summary/run').send({})).status).toBe(403);
    await run(bp, 'tisph-payment-summary', {});
    await run(bp, 'tisph-pdc-maturing', {});
    await run(ops, 'tisph-premium-payment-status', {});
    await run(finance, 'tisph-fs-by-version', {});
  });
});

describe('CR-16 financial statement versions', () => {
  it('Finance keeps a version; a range must run forward; Operations cannot change it; the default stays active', async () => {
    const lines = [
      { lineNo: 10, statement: 'bs', section: 'Assets', caption: 'All assets', glFrom: '1', glTo: '1', normalBalance: 'debit' },
      { lineNo: 20, statement: 'bs', section: 'Liabilities and equity', caption: 'Liabilities, equity and income', glFrom: '2', glTo: '5', normalBalance: 'credit' },
    ];
    expect((await ops('post', '/accounting/fs-versions').send({ code: 'TST1', name: 'Test', lines })).status).toBe(403);
    const bad = await finance('post', '/accounting/fs-versions').send({ code: 'TST1', name: 'Test', lines: [{ ...lines[0], glFrom: '5', glTo: '1' }] });
    expect(bad.status).toBe(400);
    const made = await finance('post', '/accounting/fs-versions').send({ code: 'TST1', name: 'Test version', lines });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(made.body.data.lines[0].accounts).toBeGreaterThan(0);
    expect((await finance('put', '/accounting/fs-versions/TIS01').send({ status: 'inactive' })).status).toBe(409);
    const tis01 = (await finance('get', '/accounting/fs-versions/TIS01')).body.data;
    expect(tis01.lines.find((l) => l.caption === 'Cash and cash equivalents')).toMatchObject({ glFrom: '100', glTo: '109', normalBalance: 'debit' });
  });

  it('the lines of a version add up with the trial balance; zero lines are left out', async () => {
    const data = await run(finance, 'tisph-fs-by-version', { FsVersion: 'TST1', FromDate: addDays(day, -30), ToDate: day });
    const closing = (caption) => r2(data.rows.filter((r) => r.caption === caption).reduce((s, r) => s + Number(r.closingBalance), 0));
    const unmapped = closing('Accounts not in this version');
    expect(r2(closing('All assets') - closing('Liabilities, equity and income') + unmapped)).toBe(0);
    for (const row of data.rows) expect([row.openingBalance, row.periodMovement, row.yearToDate, row.priorYearToDate].some((v) => Number(v) !== 0)).toBe(true);
    const byAccount = await run(finance, 'tisph-fs-by-version', { FsVersion: 'TST1', ReportCriteria: 'GL Account', FromDate: addDays(day, -30), ToDate: day });
    expect(byAccount.rows[0]).toHaveProperty('accountCode');
    const tis02 = await run(finance, 'tisph-fs-by-version', { FromDate: addDays(day, -30), ToDate: day, FsVersion: 'TIS02' });
    expect(tis02.rows.map((r) => r.section)).toEqual(expect.arrayContaining(['Assets']));
  });

  it('Daily GL Balance: a column per day from From Date, ending on the last day', async () => {
    const data = await run(finance, 'tisph-daily-gl-balance', { FromDate: addDays(day, -2), ToDate: day });
    expect(data.rows.length).toBeGreaterThan(0);
    for (const row of data.rows) {
      expect(row.d04).toBeNull();
      expect(r2(row.d03)).toBe(r2(row.endingBalance));
    }
    expect(data.columns.map((c) => c.key)).toEqual(expect.arrayContaining(['beginningBalance', 'd01', 'd31', 'endingBalance']));
  });
});

describe('CR-15 cash control', () => {
  it('lists cancelled and bounced cheques with their reasons, and the cheque history', async () => {
    const [c] = await q('SELECT id FROM clients ORDER BY id LIMIT 1');
    await q(`INSERT INTO post_dated_cheques(id, pdc_number, client_id, cheque_number, cheque_date, amount, received_date, status, payee, cancel_reason_code, cancel_remarks, cancelled_on, created_by)
      VALUES ('pdc_rpt_1', 'PDC-RPT-0001', $1, '000123', $2, 12500, $2, 'cancelled', 'tisph', 'PDC-CXL-CASH', 'Cash replacement', $2, 'test'),
             ('pdc_rpt_2', 'PDC-RPT-0002', $1, '000124', $2, 7300, $2, 'bounced', 'tisph', NULL, NULL, NULL, 'test')`, [c.id, day]);
    await q("UPDATE post_dated_cheques SET bounced_on = $1, bounce_reason_code = 'PDC-BNC-DAIF', deposit_account = 'ACC-MBT-001' WHERE id = 'pdc_rpt_2'", [day]);
    await q(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, after_data) VALUES ('usr_admin', 'admin', 'post_dated_cheque', 'pdc_rpt_2', 'bounce', '{"statusText":"Bounced"}')`);
    const cancelled = await run(bp, 'tisph-pdc-cancelled', { FromDate: day, ToDate: day });
    expect(cancelled.rows.find((r) => r.pdcNumber === 'PDC-RPT-0001')).toMatchObject({ reason: 'Cash replacement', amount: 12500 });
    const reversals = await run(bp, 'tisph-daily-reversals', { FromDate: day, ToDate: day });
    expect(reversals.rows.find((r) => r.reference === 'PDC-RPT-0002')).toMatchObject({ kind: 'Bounced cheque', reason: 'DAIF - drawn against insufficient funds', bankAccount: 'ACC-MBT-001' });
    expect(reversals.groups.find((g) => g.group === 'ACC-MBT-001')).toBeTruthy();
    const history = await run(bp, 'tisph-pdc-history', { FromDate: day, ToDate: day });
    expect(history.rows.find((r) => r.pdcNumber === 'PDC-RPT-0002')).toMatchObject({ event: 'Bounce', statusAfter: 'Bounced' });
    const maturing = await run(bp, 'tisph-pdc-maturing', { FromDate: day, ToDate: day });
    expect(maturing.rows.find((r) => r.pdcNumber === 'PDC-RPT-0002')).toMatchObject({ status: 'Bounced' });
    expect(maturing.rows.find((r) => r.pdcNumber === 'PDC-RPT-0001')).toBeUndefined();
  });
});

describe('CR-14 premium and net remittance', () => {
  it('a fully paid policy is on the fully paid report with its remitting rate and receipt', async () => {
    const [p] = await q(`SELECT p.id, p.policy_number, p.premium_total, p.commission_amount FROM policies p WHERE p.billing_mode <> 'direct' AND EXISTS (
        SELECT 1 FROM receivables r WHERE r.policy_id = p.id AND r.status = 'paid') AND NOT EXISTS (SELECT 1 FROM receivables r WHERE r.policy_id = p.id AND r.balance > 0
        AND r.status NOT IN ('cancelled', 'written-off', 'credited')) AND p.premium_total > 0 LIMIT 1`);
    expect(p).toBeTruthy();
    const data = await run(ops, 'tisph-net-remittance-fully-paid', { FromDate: '2000-01-01', ToDate: day });
    const row = data.rows.find((r) => r.policyNumber === p.policy_number);
    expect(row).toMatchObject({ paymentStatus: 'Fully paid', outstanding: 0 });
    expect(r2(row.netRemittance)).toBe(r2(Number(p.premium_total) - Number(p.commission_amount || 0)));
    const premium = await run(ops, 'tisph-premium-payment-status', { FromDate: '2000-01-01', ToDate: day });
    expect(premium.rows.find((r) => r.policyNumber === p.policy_number)).toMatchObject({ paymentStatus: 'Fully paid' });
    expect(premium.groups.map((g) => g.group)).toEqual(expect.arrayContaining(['Fully paid']));
  });
});
