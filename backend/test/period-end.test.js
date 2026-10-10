/**
 * Period-end processing: fiscal calendar, period statuses, month-end close runs (checks, accruals with auto-reversal,
 * recurring journals, commission deferral, FX revaluation, rerun idempotency, maker-checker), year-end close
 * (closing entries, opening balances, lock, reversal), financial statements and BIR Form 2307 / alphalists.
 * Business date of the suite: the real today (sample ledger from 2025-08 to the current month).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { withCalendarFiscalYear } from './helpers.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { createJournal, cancelJournal } from '../src/modules/accounting/lib/ledger.js';
import * as jobs from '../src/modules/period-end/jobs.js';
import { advance } from '../src/modules/period-end/journals.js';

let ctx;
let admin;
let maker;
beforeAll(async () => {
  ctx = await setupFinance();
  await withCalendarFiscalYear();
  admin = ctx.api;
  maker = ctx.as('maker');
});
afterAll(async () => { await pool.end(); });

const bal = async (code, asOf, from = null) => Number((await query(`SELECT COALESCE(sum(l.debit - l.credit), 0) AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
  WHERE l.account_code = $1 AND j.status IN ('posted','reversed') AND j.jv_date <= $2 AND ($3::date IS NULL OR j.jv_date >= $3)`, [code, asOf, from])).rows[0].b);
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const journal = (j) => withTransaction((db) => createJournal(db, j, { id: null }));
const run = async (period) => {
  const r = await maker('post', '/period-end/close-runs').send({ period });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data;
};
const execute = (id, steps) => maker('post', `/period-end/close-runs/${id}/execute`).send(steps ? { steps } : {});
const report = async (code, params) => {
  const r = await admin('post', `/reports/${code}/run`).send({ ...params, perPage: 500 });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
};

describe('fiscal calendar and period statuses', () => {
  it('generates fiscal years from the first journal with 12 periods and adjustment period 13', async () => {
    const r = await maker('get', '/period-end/fiscal-years');
    expect(r.status).toBe(200);
    const codes = r.body.data.map((f) => f.code);
    expect(codes).toContain('FY2025');
    expect(codes).toContain('FY2026');
    const fy = (await maker('get', '/period-end/fiscal-years/FY2025')).body.data;
    expect(fy).toMatchObject({ startDate: '2025-01-01', endDate: '2025-12-31', status: 'open' });
    expect(fy.periods).toHaveLength(13);
    expect(fy.periods[0]).toMatchObject({ period: '2025-01', periodNo: 1, startDate: '2025-01-01', endDate: '2025-01-31', status: 'open' });
    expect(fy.periods[12]).toMatchObject({ period: '2025-13', periodNo: 13, isAdjustment: true, startDate: '2025-12-31' });
    expect((await ctx.as('agent')('get', '/period-end/fiscal-years')).status).toBe(403);
  });

  it('soft-closed periods accept postings only from finance managers; reopening needs approve:period-end and a reason', async () => {
    const soft = await maker('post', '/period-end/periods/2026-02/status').send({ status: 'soft_closed', reasonCode: 'PCL-OTHER', note: 'waiting for statements' });
    expect(soft.status, JSON.stringify(soft.body)).toBe(200);
    expect(soft.body.data.status).toBe('soft_closed');
    const lines = [{ accountCode: '4401008', debit: 100, credit: 0 }, { accountCode: '1101001', debit: 0, credit: 100 }];
    const fin = { id: ctx.userIds.maker, roles: ['accounting'], permissions: ['write:journal-vouchers', 'write:period-end'] };
    await expect(withTransaction((db) => createJournal(db, { date: '2026-02-10', lines }, fin))).rejects.toThrow(/soft-closed/);
    const mgr = { id: 'x', roles: ['accounting'], permissions: ['approve:period-end'] };
    const ok = await withTransaction((db) => createJournal(db, { date: '2026-02-10', lines, description: 'late supplies' }, mgr));
    expect(ok.status).toBe('posted');
    expect((await maker('post', '/period-end/periods/2026-02/status').send({ status: 'open', reasonCode: 'PRO-OTHER', note: 'x' })).status).toBe(403);
    expect((await admin('post', '/period-end/periods/2026-02/status').send({ status: 'open' })).status).toBe(400);
    const reopen = await admin('post', '/period-end/periods/2026-02/status').send({ status: 'open', reasonCode: 'PRO-OTHER', note: 'statement received' });
    expect(reopen.status).toBe(200);
    const hist = (await maker('get', '/period-end/periods/2026-02/history')).body.data;
    expect(hist.map((h) => h.to)).toEqual(['open', 'soft_closed']);
    expect(hist[0]).toMatchObject({ remarks: 'Other: statement received', reasonCode: 'PRO-OTHER', reasonName: 'Other' });
  });
});

describe('month-end close run', () => {
  let pending;
  let runJul;
  it('blocking checks (unposted journals, manual sign-off) block the close', async () => {
    pending = await journal({ date: '2026-07-15', description: 'pending accrual', status: 'pending',
      lines: [{ accountCode: '4402002', debit: 5000, credit: 0 }, { accountCode: '2208001', debit: 0, credit: 5000 }] });
    runJul = await run('2026-07');
    expect(runJul.runNumber).toMatch(/^MEC-\d{4}-\d{5}$/);
    expect((await maker('post', '/period-end/close-runs').send({ period: '2026-07' })).status).toBe(409);
    const ex = await execute(runJul.id);
    expect(ex.status, JSON.stringify(ex.body)).toBe(200);
    expect(ex.body.data.status).toBe('blocked');
    const unposted = ex.body.data.checks.find((c) => c.code === 'unposted_journals');
    expect(unposted).toMatchObject({ status: 'failed', count: 1 });
    expect(ex.body.data.checks.find((c) => c.code === 'trial_balance').status).toBe('passed');
    expect((await maker('post', `/period-end/close-runs/${runJul.id}/submit`).send({ target: 'closed' })).status).toBe(409);
    const direct = await admin('post', '/period-end/periods/2026-07/status').send({ status: 'closed', reasonCode: 'PCL-OTHER', note: 'force' });
    expect(direct.status).toBe(409);
    expect(direct.body.message).toMatch(/not posted/);

    await withTransaction((db) => cancelJournal(db, pending.id, { id: null }));
    const re = await maker('post', `/period-end/close-runs/${runJul.id}/checks`).send({});
    expect(re.body.data.status).toBe('in-progress'); // the manual blocking sign-off is still open
    const sub = await maker('post', `/period-end/close-runs/${runJul.id}/submit`).send({ target: 'closed' });
    expect(sub.status).toBe(409);
    expect(sub.body.message).toMatch(/not signed off/);
    expect((await maker('post', `/period-end/close-runs/${runJul.id}/checks/unposted_journals/sign`).send({})).status).toBe(400);
    const signed = await maker('post', `/period-end/close-runs/${runJul.id}/checks/bank_reconciliation_signoff/sign`).send({ remarks: 'BDO and GCash reconciled' });
    expect(signed.body.data.status).toBe('ready');
  });

  it('maker-checker: the preparer submits, another user with approve:period-end approves and the period closes', async () => {
    const sub = await maker('post', `/period-end/close-runs/${runJul.id}/submit`).send({ target: 'closed', remarks: 'July books' });
    expect(sub.status).toBe(200);
    expect(sub.body.data.status).toBe('pending-approval');
    expect((await maker('post', `/period-end/close-runs/${runJul.id}/approve`).send({})).status).toBe(403);
    const rej = await admin('post', `/period-end/close-runs/${runJul.id}/reject`).send({ reason: 'attach bank statements' });
    expect(rej.body.data.status).toBe('ready');
    expect(rej.body.data.rejectionReason).toBe('attach bank statements');
    await maker('post', `/period-end/close-runs/${runJul.id}/submit`).send({ target: 'closed' });
    const ap = await admin('post', `/period-end/close-runs/${runJul.id}/approve`).send({ remarks: 'approved' });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect(ap.body.data.status).toBe('closed');
    expect(ap.body.data.periodInfo.status).toBe('closed');
    expect(ap.body.data.preparedBy).toBe(ctx.userIds.maker);
    await expect(journal({ date: '2026-07-20', lines: [{ accountCode: '4401008', debit: 1, credit: 0 }, { accountCode: '1101001', debit: 0, credit: 1 }] })).rejects.toThrow(/2026-07 is closed/);
    // the database refuses the posting too
    await expect(query('UPDATE journal_vouchers SET status = \'pending\' WHERE id = $1', [pending.id]).then(() => query('UPDATE journal_vouchers SET status = \'posted\' WHERE id = $1', [pending.id])))
      .rejects.toThrow(/closed/);
    const list = (await maker('get', '/period-end/close-runs?period=2026-07')).body.data;
    expect(list[0]).toMatchObject({ runNumber: runJul.runNumber, status: 'closed', periodStatus: 'closed' });
  });

  it('accrual templates post at the period end and reverse on day 1 of the next period', async () => {
    const t = await maker('post', '/period-end/recurring-journals').send({ name: 'Accrued audit fee', kind: 'accrual', frequency: 'monthly', startDate: '2026-04-30',
      lines: [{ accountCode: '4401003', debit: 10000, credit: 0, memo: 'audit fee' }, { accountCode: '2208001', debit: 0, credit: 10000 }] });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    expect(t.body.data).toMatchObject({ kind: 'accrual', autoReverse: true, nextRunDate: '2026-04-30' });
    expect(t.body.data.code).toMatch(/^RJV-/);
    const before = await bal('2208001', '2026-04-30');
    const r = await run('2026-04');
    const ex = await execute(r.id, ['accruals', 'checks']);
    expect(ex.status, JSON.stringify(ex.body)).toBe(200);
    expect(ex.body.data.steps.accruals.status).toBe('done');
    const acc = ex.body.data.journals.filter((j) => j.step === 'accrual');
    expect(acc).toHaveLength(1);
    expect(acc[0]).toMatchObject({ date: '2026-04-30', autoReverseOn: '2026-05-01', reversalDate: '2026-05-01', journalStatus: 'reversed' });
    expect(await bal('2208001', '2026-04-30') - before).toBe(-10000);
    expect(await bal('2208001', '2026-05-01') - before).toBe(0);
    const tpl = (await maker('get', `/period-end/recurring-journals/${t.body.data.id}`)).body.data;
    expect(tpl.nextRunDate).toBe('2026-05-31');
    expect(tpl.runs).toHaveLength(1);
  });

  it('recurring journals follow their schedule (month ends stay month ends), are idempotent and stop at the end date', async () => {
    expect(advance('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(advance('2026-02-28', 'monthly')).toBe('2026-03-31');
    expect(advance('2026-01-15', 'quarterly')).toBe('2026-04-15');
    expect(advance('2025-12-31', 'yearly')).toBe('2026-12-31');
    const t = (await maker('post', '/period-end/recurring-journals').send({ name: 'Office rent', frequency: 'monthly', startDate: '2026-01-31', endDate: '2026-03-31',
      lines: [{ accountCode: '4402001', debit: 85000, credit: 0 }, { accountCode: '1102001', debit: 0, credit: 85000 }] })).body.data;
    expect((await maker('post', '/period-end/recurring-journals').send({ name: 'Bad', startDate: '2026-01-31',
      lines: [{ accountCode: '4402001', debit: 10, credit: 0 }, { accountCode: '1102001', debit: 0, credit: 9 }] })).status).toBe(400);
    const r1 = await maker('post', '/period-end/recurring-journals/run-due').send({ asOf: '2026-02-28', id: t.id });
    expect(r1.body.data.created.map((c) => c.occurrence)).toEqual(['2026-01-31', '2026-02-28']);
    const r2 = await maker('post', '/period-end/recurring-journals/run-due').send({ asOf: '2026-02-28', id: t.id });
    expect(r2.body.data.created).toHaveLength(0);
    const r3 = await maker('post', '/period-end/recurring-journals/run-due').send({ asOf: '2026-06-30', id: t.id });
    expect(r3.body.data.created.map((c) => c.occurrence)).toEqual(['2026-03-31']);
    const tpl = (await maker('get', `/period-end/recurring-journals/${t.id}`)).body.data;
    expect(tpl.status).toBe('completed');
    expect(tpl.runs.every((x) => x.journalStatus === 'posted')).toBe(true);
    expect(await bal('4402001', '2026-03-31', '2026-01-01')).toBe(255000);
  });

  it('commission deferral moves unearned commission to 2209001 pro rata by days and reverses next period', async () => {
    await setSetting('accounting.defer_commission', true);
    const pol = (await query(`INSERT INTO policies(policy_number, client_id, status, inception_date, expiry_date, premium_total, commission_amount)
      VALUES ('POL-DEF-1', (SELECT id FROM clients LIMIT 1), 'active', '2026-05-01', '2027-05-01', 100000, 12000) RETURNING id`)).rows[0];
    await journal({ date: '2026-05-10', description: 'commission booked', policyId: pol.id,
      lines: [{ accountCode: '1203002', debit: 12000, credit: 0 }, { accountCode: '3201001', debit: 0, credit: 12000 }] });
    const r = await run('2026-05');
    const ex = await execute(r.id, ['deferral']);
    expect(ex.body.data.steps.deferral.status, JSON.stringify(ex.body.data.steps)).toBe('done');
    const line = ex.body.data.steps.deferral.detail.find((d) => d.policyNumber === 'POL-DEF-1');
    expect(line).toMatchObject({ commission: 12000, coverDays: 365, unearnedDays: 334, deferred: 10980.82 });
    const lines = (await query(`SELECT l.* FROM journal_lines l JOIN period_close_entries e ON e.jv_id = l.jv_id WHERE e.run_id = $1 AND l.policy_id = $2 ORDER BY l.line_no`, [r.id, pol.id])).rows;
    expect(lines.map((l) => [l.account_code, Number(l.debit), Number(l.credit)])).toEqual([['3201001', 10980.82, 0], ['2209001', 0, 10980.82]]);
    const unearnedEnd = await bal('2209001', '2026-05-31');
    expect(unearnedEnd).toBeLessThanOrEqual(-10980.82);
    expect(await bal('2209001', '2026-06-01')).toBe(0);
    await setSetting('accounting.defer_commission', false);
  });

  it('FX revaluation restates foreign-currency balances at the month-end rate; a rerun gives the same ledger', async () => {
    await query(`INSERT INTO master_records(type_code, name, data, status, created_by) VALUES ('exchange-rate', 'USD', $1, 'active', 'test')`,
      [JSON.stringify({ EffectiveFrom: '2026-03-01', EffectiveTo: '2026-03-31', CurrencyCode: 'USD', ToCurrencyCode: 'PHP', ExchangeRate: 58 })]);
    await journal({ date: '2026-03-10', description: 'USD receivable', lines: [
      { accountCode: '1203002', debit: 56000, credit: 0, currencyCode: 'USD', foreignAmount: 1000, exchangeRate: 56 },
      { accountCode: '3201002', debit: 0, credit: 56000 }] });
    const r = await run('2026-03');
    const first = await execute(r.id);
    expect(first.body.data.steps.fx.status, JSON.stringify(first.body.data.steps.fx)).toBe('done');
    expect(first.body.data.steps.fx.detail[0]).toMatchObject({ accountCode: '1203002', currency: 'USD', foreignBalance: 1000, rate: 58, revalued: 58000, difference: 2000 });
    const snap = async () => [await bal('3301003', '2026-03-31'), await bal('1203002', '2026-03-31'), await bal('3301003', '2026-04-30'), await bal('1203002', '2026-04-30'),
      await bal('2208001', '2026-03-31'), await bal('2208001', '2026-04-30')];
    const s1 = await snap();
    expect(s1[0]).toBe(-2000);
    expect(s1[2]).toBe(0);
    const second = await execute(r.id);
    expect(second.status).toBe(200);
    expect(await snap()).toEqual(s1);
    const fx = second.body.data.journals.filter((j) => j.step === 'fx');
    expect(fx.filter((j) => j.status === 'active')).toHaveLength(1);
    expect(fx.filter((j) => j.status === 'undone')).toHaveLength(1);
    expect(fx.find((j) => j.status === 'undone').undoJournals.length).toBe(2);
    expect(second.body.data.executionCount).toBe(2);
    // a cancelled run neutralises its journals
    const cancel = await maker('post', `/period-end/close-runs/${r.id}/cancel`).send({ reason: 'test' });
    expect(cancel.body.data.status).toBe('cancelled');
    expect(await bal('3301003', '2026-03-31')).toBe(0);
  });

  it('the checklist master is configurable', async () => {
    const add = await maker('post', '/period-end/checklist').send({ code: 'insurer_soa', label: 'Insurer statements reconciled', itemType: 'manual', severity: 'warning', sortOrder: 130 });
    expect(add.status).toBe(201);
    expect((await maker('post', '/period-end/checklist').send({ code: 'made_up', label: 'Auto', itemType: 'auto' })).status).toBe(400);
    expect((await maker('put', '/period-end/checklist/unapplied_receipts').send({ severity: 'blocking' })).body.data.severity).toBe('blocking');
    expect((await maker('delete', '/period-end/checklist/trial_balance')).status).toBe(409);
    expect((await maker('delete', '/period-end/checklist/insurer_soa')).status).toBe(200);
    await maker('put', '/period-end/checklist/unapplied_receipts').send({ severity: 'warning' });
    const list = (await maker('get', '/period-end/checklist')).body.data;
    expect(list.autoChecks).toContain('suspense_balance');
  });
});

describe('financial statements reconcile', () => {
  it('income statement net income = trial balance P&L; the balance sheet balances', async () => {
    const params = { FromDate: '2026-01-01', ToDate: '2026-09-30' };
    const is = await report('income-statement', params);
    const tb = (await admin('get', '/accounting/trial-balance?from=2026-01-01&asOf=2026-09-30')).body.data;
    expect(Number(is.summary.netIncome)).toBeCloseTo(tb.totals.netIncome, 2);
    const ocm = await report('trial-balance-ocm', params);
    expect(ocm.summary.balanced).toBe(true);
    expect(Number(ocm.summary.periodNetIncome)).toBeCloseTo(tb.totals.netIncome, 2);
    const bs = await report('balance-sheet', { ToDate: '2026-09-30', FromDate: '2026-09-01' });
    expect(Number(bs.summary.difference)).toBe(0);
    expect(Number(bs.summary.totalAssets)).toBeGreaterThan(0);
    const st = await admin('get', '/period-end/statements/income-statement?FromDate=2026-09-01&ToDate=2026-09-30');
    expect(st.status).toBe(200);
    expect(st.body.data.rows.length).toBeGreaterThan(0);
    const gl = await report('gl-detail', { FromDate: '2026-03-01', ToDate: '2026-03-31', Account: '1203002' });
    expect(gl.rows.every((r) => r.accountCode === '1203002')).toBe(true);
    expect(Number(gl.summary.closingBalance)).toBe(await bal('1203002', '2026-03-31'));
    for (const code of ['aged-payables-insurers', 'month-end-close-status', 'bir-vat-summary', 'bir-sawt', 'bir-qap', 'bir-slsp-sales', 'bir-slsp-purchases']) {
      const r = await admin('post', `/reports/${code}/run`).send({ FromDate: '2025-01-01', ToDate: '2026-09-30' });
      expect(r.status, `${code} ${JSON.stringify(r.body)}`).toBe(200);
    }
    const status = await report('month-end-close-status', { FromDate: '2026-07-01', ToDate: '2026-07-31' });
    expect(status.rows[0]).toMatchObject({ period: '2026-07', periodStatus: 'closed', runStatus: 'closed' });
  });
});

describe('year-end close', () => {
  let ye;
  let netIncome;
  it('pre-checks require all twelve periods closed', async () => {
    const pendingJv = (await query('SELECT id FROM journal_vouchers WHERE status IN (\'for-approval\',\'pending\') AND jv_date <= \'2025-12-31\'')).rows;
    for (const j of pendingJv) await withTransaction((db) => cancelJournal(db, j.id, { id: null }));
    const created = await maker('post', '/period-end/year-end').send({ fiscalYear: 'FY2025' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    ye = created.body.data;
    expect(ye.runNumber).toMatch(/^YEC-/);
    const chk = await maker('post', `/period-end/year-end/${ye.id}/check`).send({});
    expect(chk.body.data.status).toBe('draft');
    expect(chk.body.data.checks.find((c) => c.code === 'periods_closed').status).toBe('failed');
    expect((await admin('post', `/period-end/year-end/${ye.id}/close`).send({})).status).toBe(409);
    for (let m = 1; m <= 12; m += 1) {
      const p = `2025-${String(m).padStart(2, '0')}`;
      const r = await admin('post', `/period-end/periods/${p}/status`).send({ status: 'closed', reasonCode: 'PCL-OTHER', note: 'year end' });
      expect(r.status, `${p} ${r.body.message}`).toBe(200);
    }
    const ok = await maker('post', `/period-end/year-end/${ye.id}/check`).send({});
    expect(ok.body.data.checks.filter((c) => c.status !== 'passed')).toEqual([]);
    expect(ok.body.data.status).toBe('checked');
  });

  it('closing entries zero income and expense, move the result to retained earnings and keep the trial balance balanced', async () => {
    const is = await report('income-statement', { FromDate: '2025-01-01', ToDate: '2025-12-31' });
    const tbBefore = (await admin('get', '/accounting/trial-balance?asOf=2025-12-31')).body.data;
    netIncome = Number(is.summary.netIncome);
    expect(netIncome).toBeCloseTo(tbBefore.totals.netIncome, 2);
    const reBefore = await bal('340000', '2025-12-31');
    expect((await maker('post', `/period-end/year-end/${ye.id}/close`).send({})).status).toBe(403);
    const closed = await admin('post', `/period-end/year-end/${ye.id}/close`).send({});
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const d = closed.body.data;
    expect(d.status).toBe('closed');
    expect(d.netIncome).toBeCloseTo(netIncome, 2);
    expect(d.nextFiscalYear).toBe('FY2026');
    expect(d.journals.map((j) => j.period)).toEqual(['2025-13', '2025-13']);
    expect(d.periods.every((p) => p.status === 'locked')).toBe(true);
    const pl = (await query(`SELECT COALESCE(sum(l.debit - l.credit), 0) AS b, count(DISTINCT l.account_code) FILTER (WHERE true) AS n FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      JOIN gl_accounts a ON a.code = l.account_code WHERE a.account_type IN ('income','expense') AND j.status IN ('posted','reversed') AND j.jv_date <= '2025-12-31'
      GROUP BY l.account_code HAVING sum(l.debit - l.credit) <> 0`)).rows;
    expect(pl).toEqual([]);
    expect(await bal('340020', '2025-12-31')).toBe(0);
    expect(await bal('340000', '2025-12-31') - reBefore).toBeCloseTo(-netIncome, 2);
    const tb = (await admin('get', '/accounting/trial-balance?asOf=2025-12-31')).body.data;
    expect(tb.totals.balanced).toBe(true);
    expect(tb.totals.netIncome).toBe(0);
    // the income statement of the closed year still shows its result
    expect(Number((await report('income-statement', { FromDate: '2025-01-01', ToDate: '2025-12-31' })).summary.netIncome)).toBeCloseTo(netIncome, 2);
  });

  it('opening balances of the next year equal the closing balance-sheet balances and feed the trial balance', async () => {
    const ob = (await query('SELECT account_code, balance FROM opening_balances WHERE fiscal_year = \'FY2026\' ORDER BY account_code')).rows;
    expect(ob.length).toBeGreaterThan(3);
    for (const o of ob) expect(Number(o.balance)).toBeCloseTo(await bal(o.account_code, '2025-12-31'), 2);
    expect(ob.find((o) => o.account_code === '3201001')).toBeUndefined();
    const ocm = await report('trial-balance-ocm', { FromDate: '2026-01-01', ToDate: '2026-09-30' });
    expect(ocm.summary.openingBalanced).toBe(true);
    expect(ocm.summary.balanced).toBe(true);
    const re = ocm.rows.find((r) => r.accountCode === '340000');
    expect(Number(re.openingCredit) - Number(re.openingDebit)).toBeCloseTo(-(await bal('340000', '2025-12-31')), 2);
    const bs = await report('balance-sheet', { FromDate: '2026-01-01', ToDate: '2026-09-30' });
    expect(Number(bs.summary.difference)).toBe(0);
    expect(Number(bs.summary.priorTotalAssets)).toBeCloseTo(Number(bs.summary.priorTotalLiabilitiesAndEquity), 2);
  });

  it('a locked year refuses postings and reopening; the close is reversible until the next year\'s first period closes', async () => {
    await expect(journal({ date: '2025-06-10', lines: [{ accountCode: '4401008', debit: 1, credit: 0 }, { accountCode: '1101001', debit: 0, credit: 1 }] })).rejects.toThrow(/locked/);
    const reopen = await admin('post', '/period-end/periods/2025-06/status').send({ status: 'open', reasonCode: 'PRO-OTHER', note: 'fix' });
    expect(reopen.status).toBe(409);
    expect(reopen.body.message).toMatch(/locked/);
    await expect(query('UPDATE accounting_periods SET status = \'open\' WHERE period = \'2025-06\'')).rejects.toThrow(/locked/);
    expect((await maker('post', `/period-end/year-end/${ye.id}/reverse`).send({ reason: 'x' })).status).toBe(403);
    expect((await admin('post', `/period-end/year-end/${ye.id}/reverse`).send({})).status).toBe(400);
    const rev = await admin('post', `/period-end/year-end/${ye.id}/reverse`).send({ reason: 'late audit adjustment' });
    expect(rev.status, JSON.stringify(rev.body)).toBe(200);
    expect(rev.body.data.status).toBe('reversed');
    expect(rev.body.data.fiscalYearInfo.status).toBe('closing');
    expect(rev.body.data.periods.filter((p) => !p.isAdjustment).every((p) => p.status === 'closed')).toBe(true);
    expect(rev.body.data.periods.find((p) => p.isAdjustment).status).toBe('open');
    expect((await query('SELECT count(*)::int AS n FROM opening_balances WHERE fiscal_year = \'FY2026\'')).rows[0].n).toBe(0);
    expect((await admin('get', '/accounting/trial-balance?asOf=2025-12-31')).body.data.totals.netIncome).toBeCloseTo(netIncome, 2);

    // adjustment in period 13, approved by a second user, then close again
    const adj = await maker('post', '/period-end/adjustments').send({ fiscalYear: 'FY2025', description: 'Audit adjustment', lines: [{ accountCode: '4401003', debit: 1500, credit: 0 }, { accountCode: '2208001', debit: 0, credit: 1500 }] });
    expect(adj.status, JSON.stringify(adj.body)).toBe(201);
    expect(adj.body.data).toMatchObject({ period: '2025-13', date: '2025-12-31', status: 'pending' });
    const again = (await maker('post', '/period-end/year-end').send({ fiscalYear: 'FY2025' })).body.data;
    const blocked = await admin('post', `/period-end/year-end/${again.id}/close`).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/adjustment journal/);
    expect((await ctx.as('checker')('put', `/accounting/transactions/${adj.body.data.id}/post`)).status).toBe(200);
    const closed = await admin('post', `/period-end/year-end/${again.id}/close`).send({});
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.data.netIncome).toBeCloseTo(netIncome - 1500, 2);

    const jan = await admin('post', '/period-end/periods/2026-01/status').send({ status: 'closed', reasonCode: 'PCL-OTHER', note: 'January' });
    expect(jan.status, jan.body.message).toBe(200);
    const late = await admin('post', `/period-end/year-end/${again.id}/reverse`).send({ reason: 'too late' });
    expect(late.status).toBe(409);
    expect(late.body.message).toMatch(/2026-01/);
  });
});

describe('BIR tax', () => {
  it('tax codes master holds the PH codes with ATCs and is editable', async () => {
    const list = (await maker('get', '/period-end/tax-codes')).body.data;
    for (const atc of ['WC158', 'WI158', 'WC160', 'WI160', 'WI515']) expect(list.find((t) => t.atc === atc), atc).toBeTruthy();
    expect(list.find((t) => t.code === 'VAT12-OUT')).toMatchObject({ taxType: 'VAT', rate: 12, glAccount: '235000', editable: true });
    const upd = await maker('put', '/period-end/tax-codes/WC160').send({ rate: 2, remarks: 'RR 11-2018' });
    expect(upd.body.data.remarks).toBe('RR 11-2018');
    expect((await maker('post', '/period-end/tax-codes').send({ code: 'WC999', description: 'Test code', taxType: 'EWT', rate: 3, atc: 'WC158' })).status).toBe(409);
    expect((await maker('post', '/period-end/tax-codes').send({ code: 'WC999', description: 'Test code', taxType: 'EWT', rate: 3, atc: 'WC999', glAccount: '2204001' })).status).toBe(201);
    expect((await ctx.as('agent')('put', '/period-end/tax-codes/WC160').send({ rate: 5 })).status).toBe(403);
  });

  it('BIR Form 2307 per payee per quarter sums the withholding of the quarter by month and ATC', async () => {
    const v = (await query(`SELECT voucher_date, gross_amount, wht_amount FROM disbursements WHERE referrer_id = 'ref-jdelacruz' AND wht_amount > 0 AND status IN ('approved','paid')`)).rows;
    expect(v.length).toBeGreaterThan(0);
    const d0 = String(v[0].voucher_date);
    const year = Number(d0.slice(0, 4)); const quarter = Math.floor((Number(d0.slice(5, 7)) - 1) / 3) + 1;
    const inQ = v.filter((x) => Number(String(x.voucher_date).slice(0, 4)) === year && Math.floor((Number(String(x.voucher_date).slice(5, 7)) - 1) / 3) + 1 === quarter);
    const income = Math.round(inQ.reduce((s, x) => s + Number(x.gross_amount), 0) * 100) / 100;
    const tax = Math.round(inQ.reduce((s, x) => s + Number(x.wht_amount), 0) * 100) / 100;
    const list = await maker('get', `/period-end/bir/2307?year=${year}&quarter=${quarter}`);
    expect(list.status).toBe(200);
    const payee = list.body.data.payees.find((p) => p.payeeKey === 'Agent/Referrer:ref-jdelacruz');
    expect(payee).toMatchObject({ totalIncome: income, totalTax: tax, atcs: ['WI515'] });
    const cert = (await maker('get', `/period-end/bir/2307/certificate?year=${year}&quarter=${quarter}&payeeKey=${encodeURIComponent(payee.payeeKey)}`)).body.data;
    expect(cert.lines).toHaveLength(1);
    const monthIdx = (Number(d0.slice(5, 7)) - 1) % 3;
    expect(cert.lines[0][`month${monthIdx + 1}`]).toBeGreaterThan(0);
    expect(cert.lines[0].month1 + cert.lines[0].month2 + cert.lines[0].month3).toBeCloseTo(income, 2);
    expect(cert).toMatchObject({ totalIncome: income, totalTax: tax, periodFrom: `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01` });
    const issued = await maker('post', '/period-end/bir/2307/issue').send({ year, quarter, payeeKey: payee.payeeKey });
    expect(issued.status).toBe(201);
    expect(issued.body.data.certificateNumber).toMatch(/^CWT-/);
    const again = await maker('post', '/period-end/bir/2307/issue').send({ year, quarter, payeeKey: payee.payeeKey });
    expect(again.status).toBe(200);
    expect(again.body.data.certificateNumber).toBe(issued.body.data.certificateNumber);
    const other = quarter === 1 ? 2 : quarter - 1;
    expect((await maker('get', `/period-end/bir/2307/certificate?year=${year}&quarter=${other}&payeeKey=${encodeURIComponent(payee.payeeKey)}`)).status).toBe(404);
    const qap = await report('bir-qap', { FromDate: cert.periodFrom, ToDate: cert.periodTo });
    const row = qap.rows.find((r) => r.registeredName === null && r.lastName === 'Cruz' && r.firstName === 'Juan');
    expect(Number(row.taxWithheld)).toBeCloseTo(tax, 2);
    expect(Number(qap.totals.taxWithheld)).toBeCloseTo(Number((await query('SELECT sum(wht_amount) AS s FROM disbursements WHERE wht_amount > 0 AND status IN (\'approved\',\'paid\') AND voucher_date BETWEEN $1 AND $2', [cert.periodFrom, cert.periodTo])).rows[0].s), 2);
  });
});

describe('period-end jobs', () => {
  it('run the reminder, recurring, reversal and auto soft-close jobs', async () => {
    const rem = await jobs.monthEndReminder({ daysBefore: 31 });
    expect(rem.notified).toBeGreaterThan(0);
    expect((await jobs.monthEndReminder({ daysBefore: 31 })).notified).toBe(0);
    const n = (await query('SELECT audience FROM notifications WHERE entity = \'accounting_period\' LIMIT 1')).rows[0];
    expect(n.audience).toBe('write:period-end');
    expect((await jobs.recurringJournals()).errors).toEqual([]);
    expect((await jobs.accrualReversal()).errors).toEqual([]);
    const soft = await jobs.periodAutoSoftClose({ graceDays: 5 });
    expect(soft.softClosed.length + soft.skipped.length).toBeGreaterThan(0);
    const jobsRows = (await query('SELECT code, enabled, handler FROM scheduled_jobs WHERE code IN (\'month-end-reminder\',\'recurring-journals\',\'accrual-reversal\',\'period-auto-soft-close\') ORDER BY code')).rows;
    expect(jobsRows).toHaveLength(4);
    expect(jobsRows.every((j) => j.enabled === false)).toBe(true);
    const runNow = await admin('post', '/schedules/recurring-journals/run');
    expect([200, 201]).toContain(runNow.status);
  });
});

describe('locked periods through the accounting route', () => {
  it('reopening a period locked by the year-end close answers 409 with a clear message', async () => {
    const { setPeriodStatus } = await import('../src/modules/accounting/service.js');
    const { pool } = await import('../src/db/pool.js');
    await pool.query("INSERT INTO accounting_periods(period, status) VALUES ('2019-03','locked') ON CONFLICT (period) DO UPDATE SET status = 'locked'");
    await expect(setPeriodStatus(pool, '2019-03', 'open', 'test', { id: 'usr_test' })).rejects.toMatchObject({ status: 409 });
  });
});
