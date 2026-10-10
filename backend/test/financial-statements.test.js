/**
 * Accounts > Period End > Financial Statements: the period choice, the statement layout (sections, groups, totals,
 * column ranges, card figures), natural signs of clawbacks and reversals, the income statement against the trial
 * balance, the balance sheet with current year earnings and go-live opening balances, the Excel / PDF files and the
 * permissions. Fiscal year on the calendar year; the journals of the suite are dated in 2026 and 2030.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { withCalendarFiscalYear } from './helpers.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { today } from '../src/lib/dates.js';
import { createJournal, reverseJournal } from '../src/modules/accounting/lib/ledger.js';
import { createFiscalYear } from '../src/modules/period-end/fiscal.js';
import { buildStatement } from '../src/modules/period-end/statements.js';

let ctx;
let admin;
const SYSTEM = { id: null };
beforeAll(async () => {
  ctx = await setupFinance();
  await withCalendarFiscalYear();
  admin = ctx.api;
});
afterAll(async () => { await pool.end(); });

const get = (path, q = {}, as = admin) => as('get', `${path}?${new URLSearchParams(q)}`);
const statement = async (type, q) => {
  const r = await get(`/period-end/statements/${type}`, q);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
};
const journal = (date, lines, description = 'statement test') => withTransaction((db) => createJournal(db, { date, description, lines }, SYSTEM));
/** A file download as a Buffer. */
const download = (path, q) => get(path, q).buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});
const linesOf = (st) => st.statement.sections.flatMap((s) => s.groups.flatMap((g) => g.lines));
const lineOf = (st, code) => linesOf(st).find((l) => l.accountCode === code);
/** Active accounts of a type without any posting, so the suite's own amounts are the only ones on them. */
const unusedAccounts = async (type, n) => (await query(`SELECT code FROM gl_accounts a WHERE account_type = $1 AND status = 'active'
  AND NOT EXISTS (SELECT 1 FROM journal_lines l WHERE l.account_code = a.code) ORDER BY code LIMIT $2`, [type, n])).rows.map((r) => r.code);
const CASH = '1101001';

describe('period choice', () => {
  it('lists the fiscal years with their twelve periods and defaults to the period of today', async () => {
    const r = await get('/period-end/statements/periods');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const cal = r.body.data;
    const day = await today();
    expect(cal.today).toBe(day);
    expect(cal.current).toEqual({ fiscalYear: `FY${day.slice(0, 4)}`, period: day.slice(0, 7) });
    expect(cal.fiscalYears[0].code).toBe(`FY${day.slice(0, 4)}`);
    const fy = cal.fiscalYears.find((f) => f.code === 'FY2026');
    expect(fy).toMatchObject({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(fy.periods).toHaveLength(12);
    expect(fy.periods[9]).toMatchObject({ period: '2026-10', periodNo: 10, startDate: '2026-10-01', endDate: '2026-10-31' });
  });

  it('refuses an invalid range or an unknown statement, and users without the finance or report permissions', async () => {
    expect((await get('/period-end/statements/income-statement', { FromDate: '2026-09-30', ToDate: '2026-09-01' })).status).toBe(400);
    expect((await get('/period-end/statements/income-statement', { FromDate: '30/09/2026', ToDate: '2026-09-30' })).status).toBe(400);
    expect((await get('/period-end/statements/cash-flow', { FromDate: '2026-09-01', ToDate: '2026-09-30' })).status).toBe(404);
    const agent = ctx.as('agent');
    expect((await get('/period-end/statements/periods', {}, agent)).status).toBe(403);
    expect((await get('/period-end/statements/balance-sheet', { ToDate: '2026-09-30' }, agent)).status).toBe(403);
    expect((await get('/period-end/statements/income-statement/export', { FromDate: '2026-09-01', ToDate: '2026-09-30', format: 'pdf' }, agent)).status).toBe(403);
  });
});

describe('income statement', () => {
  let clawed;
  let reversed;
  beforeAll(async () => {
    [clawed, reversed] = await unusedAccounts('expense', 2);
    // a commission paid in August and clawed back in September
    await journal('2026-08-10', [{ accountCode: clawed, debit: 500, credit: 0 }, { accountCode: CASH, debit: 0, credit: 500 }], 'commission');
    await journal('2026-09-05', [{ accountCode: CASH, debit: 500, credit: 0 }, { accountCode: clawed, debit: 0, credit: 500 }], 'commission clawback');
    // an August expense reversed in September
    const jv = await journal('2026-08-12', [{ accountCode: reversed, debit: 300, credit: 0 }, { accountCode: CASH, debit: 0, credit: 300 }], 'accrual');
    await withTransaction((db) => reverseJournal(db, jv.id, SYSTEM, { date: '2026-09-03' }));
  });

  it('shows expenses in their natural sign: a clawback or a reversal in a later month is negative, and the two months net to zero', async () => {
    const aug = await statement('income-statement', { FromDate: '2026-08-01', ToDate: '2026-08-31' });
    const sep = await statement('income-statement', { FromDate: '2026-09-01', ToDate: '2026-09-30' });
    const both = await statement('income-statement', { FromDate: '2026-08-01', ToDate: '2026-09-30' });
    expect(lineOf(aug, clawed).values.currentPeriod).toBe(500);
    expect(lineOf(sep, clawed).values.currentPeriod).toBe(-500);
    expect(lineOf(aug, reversed).values.currentPeriod).toBe(300);
    expect(lineOf(sep, reversed).values.currentPeriod).toBe(-300);
    // lines whose columns are all zero are left out
    expect(lineOf(both, clawed)?.values.currentPeriod ?? 0).toBe(0);
    expect(lineOf(both, reversed)?.values.currentPeriod ?? 0).toBe(0);
    expect(lineOf(sep, clawed).drill).toBe(true);
    expect(linesOf(sep).every((l) => Object.values(l.values).some((v) => v !== 0))).toBe(true);
  });

  it('net income equals the income and expense accounts of the trial balance for the same range', async () => {
    for (const range of [{ FromDate: '2026-09-01', ToDate: '2026-09-30' }, { FromDate: '2026-01-01', ToDate: '2026-09-30' }, { FromDate: '2025-08-01', ToDate: '2026-10-31' }]) {
      const is = await statement('income-statement', range);
      const tb = await statement('trial-balance', range);
      const pl = tb.rows.filter((r) => ['income', 'expense'].includes(r.accountType)).reduce((s, r) => s + Number(r.periodCredit) - Number(r.periodDebit), 0);
      expect(is.statement.result.values.currentPeriod).toBeCloseTo(pl, 2);
      expect(is.statement.result.values.currentPeriod).toBeCloseTo(Number(tb.summary.periodNetIncome), 2);
      expect(is.statement.cards.netIncome).toBeCloseTo(Number(is.summary.netIncome), 2);
      expect(is.statement.cards.totalIncome).toBeCloseTo(Number(is.summary.totalIncome), 2);
      expect(is.statement.cards.totalExpense).toBeCloseTo(Number(is.summary.totalExpense), 2);
      expect(tb.statement.cards).toMatchObject({ difference: 0, balanced: true });
    }
  });

  it('labels each column with its dates and leaves out the year-to-date pair when the range is the year to date', async () => {
    const sep = await statement('income-statement', { FromDate: '2026-09-01', ToDate: '2026-09-30' });
    expect(sep.statement.measures.map((m) => [m.key, m.from, m.to])).toEqual([
      ['currentPeriod', '2026-09-01', '2026-09-30'], ['yearToDate', '2026-01-01', '2026-09-30'],
      ['priorPeriod', '2025-09-01', '2025-09-30'], ['priorYearToDate', '2025-01-01', '2025-09-30']]);
    const sectionTotal = (st, key) => st.statement.sections.find((s) => s.key === key).total;
    expect(sep.statement.cards.netIncomeYearToDate).toBeCloseTo(sectionTotal(sep, 'income').yearToDate - sectionTotal(sep, 'expense').yearToDate, 2);
    for (const s of sep.statement.sections) {
      for (const g of s.groups) expect(g.total.currentPeriod).toBeCloseTo(g.lines.reduce((x, l) => x + l.values.currentPeriod, 0), 2);
    }
    const ytd = await statement('income-statement', { FromDate: '2026-01-01', ToDate: '2026-09-30' });
    expect(ytd.statement.measures.map((m) => m.key)).toEqual(['currentPeriod', 'priorPeriod']);
    expect(ytd.statement.cards.netIncomeYearToDate).toBe(ytd.statement.cards.netIncome);
  });
});

describe('balance sheet', () => {
  it('balances with this year\'s earnings and the unclosed earnings of earlier years under equity', async () => {
    const bs = await statement('balance-sheet', { ToDate: '2026-09-30' });
    const ytd = await statement('income-statement', { FromDate: '2026-01-01', ToDate: '2026-09-30' });
    const earlier = await statement('income-statement', { FromDate: '2000-01-01', ToDate: '2025-12-31' });
    expect(bs.statement.cards).toMatchObject({ difference: 0, balanced: true });
    expect(bs.statement.from).toBeNull();
    expect(Number(bs.summary.difference)).toBe(0);
    const equity = bs.statement.sections.find((s) => s.key === 'equity');
    const cye = equity.groups.flatMap((g) => g.lines).find((l) => l.accountCode === 'CYE');
    expect(cye).toMatchObject({ accountName: 'Current year earnings', drill: false });
    expect(cye.values.balance).toBeCloseTo(ytd.statement.result.values.currentPeriod, 2);
    const pye = equity.groups.flatMap((g) => g.lines).find((l) => l.accountCode === 'PYE');
    expect(pye.values.balance).toBeCloseTo(earlier.statement.result.values.currentPeriod, 2);
    expect(bs.statement.cards.totalEquity).toBe(equity.total.balance);
    expect(bs.statement.cards.totalAssets).toBeCloseTo(bs.statement.cards.totalLiabilities + bs.statement.cards.totalEquity, 2);
    expect(bs.statement.measures.map((m) => [m.key, m.to])).toEqual([['balance', '2026-09-30'], ['priorYearEnd', '2025-12-31']]);
  });

  it('starts from the opening balances loaded at go-live and counts their income and expense in the year to date only', async () => {
    const [liability] = await unusedAccounts('liability', 1);
    const [capital] = await unusedAccounts('equity', 1);
    const [income] = await unusedAccounts('income', 1);
    const [expense] = await unusedAccounts('expense', 1);
    await withTransaction((db) => createFiscalYear(db, '2030-01-01'));
    // the old system's trial balance at 28/02/2030 (go-live 01/03/2030)
    for (const [code, balance] of [[CASH, 1000], [liability, -600], [capital, -300], [income, -400], [expense, 300]]) {
      await query('INSERT INTO opening_balances(fiscal_year, account_code, balance, source_run) VALUES (\'FY2030\', $1, $2, \'go-live:2030-03-01\')', [code, balance]);
    }
    await journal('2030-03-15', [{ accountCode: CASH, debit: 100, credit: 0 }, { accountCode: income, debit: 0, credit: 100 }], 'fee');

    const bs = await statement('balance-sheet', { ToDate: '2030-03-31' });
    expect(bs.statement.cards).toEqual({ totalAssets: 1100, totalLiabilities: 600, totalEquity: 500, difference: 0, balanced: true });
    const lines = linesOf(bs);
    expect(lines.find((l) => l.accountCode === CASH).values).toEqual({ balance: 1100, priorYearEnd: 0 });
    expect(lines.find((l) => l.accountCode === 'CYE').values.balance).toBe(200);
    // journals before the fiscal year with opening balances are not counted twice
    expect(lines.map((l) => l.accountCode).sort()).toEqual([CASH, 'CYE', capital, liability].sort());

    const is = await statement('income-statement', { FromDate: '2030-03-01', ToDate: '2030-03-31' });
    expect(lineOf(is, income).values).toMatchObject({ currentPeriod: 100, yearToDate: 500 });
    expect(lineOf(is, expense).values).toMatchObject({ currentPeriod: 0, yearToDate: 300 });
    expect(is.statement.cards).toMatchObject({ netIncome: 100, netIncomeYearToDate: 200 });
    const tb = await statement('trial-balance', { FromDate: '2030-03-01', ToDate: '2030-03-31' });
    expect(Number(tb.summary.periodNetIncome)).toBe(100);
    expect(Number(tb.summary.netIncome)).toBe(200);
    expect(tb.statement.cards).toMatchObject({ totalDebit: 1400, totalCredit: 1400, balanced: true });
  });
});

describe('layout', () => {
  it('builds sections, groups and totals from report rows and leaves out zero lines', () => {
    const rows = [
      { accountType: 'income', fsGroup: 'Revenue', accountCode: '3201001', accountName: 'Commission income', currentPeriod: 1000, priorPeriod: 800 },
      { accountType: 'income', fsGroup: 'Other Income', accountCode: '3301001', accountName: 'Interest income', currentPeriod: 0, priorPeriod: 0 },
      { accountType: 'expense', fsGroup: 'Cost of Services', accountCode: '4401010', accountName: 'Commission expense', currentPeriod: -250.5, priorPeriod: 100 },
    ];
    const ranges = { fiscalYear: 'FY2026', current: { from: '2026-01-01', to: '2026-01-31' }, yearToDate: { from: '2026-01-01', to: '2026-01-31' },
      priorPeriod: { from: '2025-01-01', to: '2025-01-31' }, priorYearToDate: { from: '2025-01-01', to: '2025-01-31' } };
    const st = buildStatement('income-statement', { rows }, ranges);
    expect(st.sections.map((s) => [s.key, s.groups.map((g) => g.label)])).toEqual([['income', ['Revenue']], ['expense', ['Cost of Services']]]);
    expect(st.result.values).toEqual({ currentPeriod: 1250.5, priorPeriod: 700 });
    expect(st.cards).toEqual({ totalIncome: 1000, totalExpense: -250.5, netIncome: 1250.5, netIncomeYearToDate: 1250.5 });
  });
});

describe('files', () => {
  it('exports the statement to Excel and PDF with an audit entry', async () => {
    const q = { FromDate: '2026-09-01', ToDate: '2026-09-30' };
    const xlsx = await download('/period-end/statements/income-statement/export', { ...q, format: 'xlsx' });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect(xlsx.headers['content-disposition']).toContain('income-statement_2026-09-01_2026-09-30.xlsx');
    expect(xlsx.body.subarray(0, 2).toString()).toBe('PK');
    const pdf = await download('/period-end/statements/balance-sheet/export', { ToDate: '2026-09-30', format: 'pdf' });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await get('/period-end/statements/trial-balance/export', { ...q, format: 'csv' })).status).toBe(400);
    const logged = (await query('SELECT entity_id, after_data FROM audit_log WHERE entity = \'financial_statement\' AND action = \'export\' ORDER BY id')).rows;
    expect(logged.map((r) => [r.entity_id, r.after_data.format])).toEqual([['income-statement', 'xlsx'], ['balance-sheet', 'pdf']]);
  });

  it('the PDF and the sheet carry the period, the printer and the result line', async () => {
    const { statementPdfSpec, statementSheet } = await import('../src/modules/period-end/statements.js');
    const st = (await statement('balance-sheet', { ToDate: '2026-09-30' })).statement;
    const fmt = { dateFormat: 'DD/MM/YYYY', decimals: 2 };
    const spec = statementPdfSpec(st, { format: fmt, currency: 'PHP', generatedBy: 'Finance Maker', generatedAt: '09/10/2026 10:00' });
    expect(spec.title).toBe('Balance Sheet');
    expect(spec.meta).toEqual(expect.arrayContaining([['Period', 'As of 30/09/2026'], ['Printed by', 'Finance Maker'], ['Printed at', '09/10/2026 10:00'], ['Balance check', 'Balanced']]));
    const table = spec.sections[0].table;
    expect(table.totalRow).toBe(true);
    expect(table.rows[table.rows.length - 1][1]).toBe('TOTAL LIABILITIES AND EQUITY');
    expect(table.columns.map((c) => c.label)).toEqual(['Account', 'Description', 'As of 30/09/2026', 'Previous year end 31/12/2025']);
    const sheet = statementSheet(st, { companyName: 'Toyota Insurance Services Philippines', generatedBy: 'Finance Maker', generatedAt: '09/10/2026 10:00', currency: 'PHP', format: fmt });
    expect(sheet.banner).toEqual(['Toyota Insurance Services Philippines', 'Balance Sheet', 'As of 30/09/2026', 'Printed by Finance Maker at 09/10/2026 10:00', 'Amounts in PHP']);
    // any account line: the suite's cash account may have no balance left on the TISPH sample book
    expect(typeof sheet.rows.find((r) => r[0])[2]).toBe('number');
  });
});
