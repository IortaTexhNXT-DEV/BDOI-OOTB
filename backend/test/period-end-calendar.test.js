/**
 * Fiscal calendar with a non-January start (accounting.fiscal_year_start_month = 4: April to March, named after the
 * calendar year in which it ends): periods, year-to-date of the income statement and the year-end close.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { cancelJournal } from '../src/modules/accounting/lib/ledger.js';

let ctx;
beforeAll(async () => {
  ctx = await setupFinance();
  await query('UPDATE app_settings SET value = \'4\' WHERE key = \'accounting.fiscal_year_start_month\'');
  await query('UPDATE app_settings SET value = \'false\' WHERE key = \'accounting.period_close_requires_approval\'');
  clearSettingsCache();
});
afterAll(async () => { await pool.end(); });

describe('fiscal year starting in April', () => {
  it('generates April-March fiscal years named after their end year', async () => {
    const years = (await ctx.api('get', '/period-end/fiscal-years')).body.data;
    const fy26 = years.find((f) => f.code === 'FY2026');
    expect(fy26).toMatchObject({ startDate: '2025-04-01', endDate: '2026-03-31' });
    expect(years.find((f) => f.code === 'FY2027')).toMatchObject({ startDate: '2026-04-01', endDate: '2027-03-31' });
    const periods = (await ctx.api('get', '/period-end/fiscal-years/FY2027')).body.data.periods;
    expect(periods.map((p) => p.period)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-13']);
    expect(periods[9]).toMatchObject({ periodNo: 10, startDate: '2027-01-01', endDate: '2027-01-31' });
    expect(periods[12]).toMatchObject({ periodNo: 13, startDate: '2027-03-31', isAdjustment: true });
    const next = await ctx.api('post', '/period-end/fiscal-years').send({});
    expect(next.body.data).toMatchObject({ code: 'FY2028', startDate: '2027-04-01', endDate: '2028-03-31' });
    expect((await ctx.api('post', '/period-end/fiscal-years').send({ startDate: '2027-06-01' })).status).toBe(409);
  });

  it('year to date of the income statement starts at the fiscal year start', async () => {
    const r = await ctx.api('post', '/reports/income-statement/run').send({ FromDate: '2026-09-01', ToDate: '2026-09-30', perPage: 500 });
    expect(r.status).toBe(200);
    const tb = (await ctx.api('get', '/accounting/trial-balance?from=2026-04-01&asOf=2026-09-30')).body.data;
    expect(Number(r.body.data.summary.netIncomeYearToDate)).toBeCloseTo(tb.totals.netIncome, 2);
  });

  it('closes the April-March year into adjustment period 2026-13', async () => {
    for (const j of (await query('SELECT id FROM journal_vouchers WHERE status IN (\'for-approval\',\'pending\') AND jv_date <= \'2026-03-31\'')).rows) {
      await withTransaction((db) => cancelJournal(db, j.id, { id: null }));
    }
    // a month-end run closes directly when approval is not required
    const run = (await ctx.as('maker')('post', '/period-end/close-runs').send({ period: '2025-04' })).body.data;
    await ctx.as('maker')('post', `/period-end/close-runs/${run.id}/execute`).send({});
    await ctx.as('maker')('post', `/period-end/close-runs/${run.id}/checks/bank_reconciliation_signoff/sign`).send({});
    const sub = await ctx.as('maker')('post', `/period-end/close-runs/${run.id}/submit`).send({ target: 'closed' });
    expect(sub.body.data.status).toBe('closed');
    for (const p of ['2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']) {
      const r = await ctx.api('post', `/period-end/periods/${p}/status`).send({ status: 'closed', reasonCode: 'PCL-OTHER', note: 'FY2026 close' });
      expect(r.status, `${p} ${r.body.message}`).toBe(200);
    }
    const prev = (await ctx.api('get', '/period-end/fiscal-years')).body.data.find((f) => f.code === 'FY2025');
    expect(prev).toBeUndefined(); // the first journal is dated in FY2026 (from 2025-04)
    const ye = (await ctx.as('maker')('post', '/period-end/year-end').send({ fiscalYear: 'FY2026' })).body.data;
    const closed = await ctx.api('post', `/period-end/year-end/${ye.id}/close`).send({});
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.data.journals.every((j) => j.period === '2026-13' && j.date === '2026-03-31')).toBe(true);
    expect(closed.body.data.nextFiscalYear).toBe('FY2027');
    const pl = (await query(`SELECT count(*)::int AS n FROM (SELECT l.account_code FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
      WHERE a.account_type IN ('income','expense') AND j.status IN ('posted','reversed') AND j.jv_date <= '2026-03-31' GROUP BY 1 HAVING sum(l.debit - l.credit) <> 0) x`)).rows[0].n;
    expect(pl).toBe(0);
    const ocm = (await ctx.api('post', '/reports/trial-balance-ocm/run').send({ FromDate: '2026-04-01', ToDate: '2026-09-30', perPage: 500 })).body.data;
    expect(ocm.summary.openingBalanced).toBe(true);
    expect(ocm.summary.balanced).toBe(true);
    expect(ocm.rows.filter((r) => ['income', 'expense'].includes(r.accountType)).every((r) => Number(r.openingDebit) === 0 && Number(r.openingCredit) === 0)).toBe(true);
  });
});
