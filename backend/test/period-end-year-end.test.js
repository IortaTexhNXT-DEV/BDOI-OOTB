/**
 * Year-End Close as a guided process: the screen's overview (run, five steps, checks, previews of the closing entries
 * and of the opening balances, history, the user's actions with the reason they are refused), the pre-checks (unposted
 * journals, suspense account, soft-closed months), maker-checker on the close and on the reversal, and the reversal
 * request with a reason of the Reason Codes master (context year_end_reverse).
 * Fiscal year on the calendar year (FY2025 = 2025); business date of the suite: the real today.
 */
import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance } from './accounting.fixtures.js';
import { withCalendarFiscalYear } from './helpers.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { createJournal, cancelJournal } from '../src/modules/accounting/lib/ledger.js';

let ctx;
let maker;
let checker;
let mgr1;
let mgr2;
let ids;
let run;
beforeAll(async () => {
  ctx = await setupFinance();
  await withCalendarFiscalYear();
  maker = ctx.as('maker');
  checker = ctx.as('checker');
  ids = { ...ctx.userIds };
  const as = async (username) => {
    const u = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: `Manager ${username}`, roles: ['accounting-manager'], email: `${username}@example.ph` });
    ids[username] = u.body.data.userId;
    const token = (await request(ctx.app).post('/api/auth/login').send({ username, password: 'Welcome@123' })).body.accessToken;
    return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  };
  mgr1 = await as('ye.mgr1');
  mgr2 = await as('ye.mgr2');
});
afterAll(async () => { await pool.end(); });

const overview = async (as, fiscalYear = 'FY2025') => {
  const r = await as('get', `/period-end/year-end/overview${fiscalYear ? `?fiscalYear=${fiscalYear}` : ''}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
};
const check = (o, code) => o.checks.find((c) => c.code === code);
const step = (o, key) => o.steps.find((s) => s.key === key).status;
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const months = (status) => query('UPDATE accounting_periods SET status = $1 WHERE fiscal_year = \'FY2025\' AND NOT is_adjustment', [status]);
const journal = (date, lines, status = 'posted') => withTransaction((db) => createJournal(db, { date, lines, description: 'year-end test', status }, { id: null }));

describe('starting a year-end close', () => {
  it('lists the new run under its year, and the overview returns it with its checks, previews and history', async () => {
    const started = await mgr1('post', '/period-end/year-end').send({ fiscalYear: 'FY2025' });
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    run = started.body.data;
    expect(run).toMatchObject({ fiscalYear: 'FY2025', status: 'draft', preparedBy: ids['ye.mgr1'], preparedByName: 'Manager ye.mgr1' });
    expect(run.checks.find((c) => c.code === 'periods_closed').status).toBe('failed');

    const years = (await maker('get', '/period-end/year-end')).body.data;
    expect(years.find((y) => y.code === 'FY2025')).toMatchObject({ status: 'closing', runs: [expect.objectContaining({ id: run.id, status: 'draft' })] });

    const o = await overview(maker, null);
    expect(o.fiscalYear).toMatchObject({ code: 'FY2025', status: 'closing', adjustmentPeriod: '2025-13' });
    expect(o.run).toMatchObject({ id: run.id, runNumber: run.runNumber, preparedByName: 'Manager ye.mgr1' });
    expect(o.steps.map((s) => s.key)).toEqual(['prerequisites', 'adjustments', 'closing', 'approval', 'opening']);
    expect(step(o, 'prerequisites')).toBe('failed');
    expect(step(o, 'approval')).toBe('blocked');
    expect(o.currentStep).toBe('prerequisites');
    expect(check(o, 'periods_closed').data).toMatchObject({ required: 'closed', total: 12 });
    expect(o.closing).toMatchObject({ source: 'preview', period: '2025-13', date: '2025-12-31' });
    expect(o.opening).toMatchObject({ source: 'preview', fiscalYear: 'FY2026' });
    expect(o.activity).toEqual([expect.objectContaining({ action: 'start', toStatus: 'draft', byName: 'Manager ye.mgr1', roles: ['Accounting Manager'] })]);
    expect(o.actions).toMatchObject({ start: null, check: { allowed: true }, close: { allowed: false, reason: 'permission' }, adjust: { allowed: true } });
    expect((await overview(mgr1)).actions.close).toEqual({ allowed: false, reason: 'maker-checker' });
    expect((await overview(mgr2)).actions.close).toEqual({ allowed: false, reason: 'checks' });
  });

  it('is read with period-end or journal access only', async () => {
    expect((await ctx.as('agent')('get', '/period-end/year-end/overview')).status).toBe(403);
    expect((await ctx.as('claims')('get', '/period-end/year-end/overview')).status).toBe(403);
    expect((await ctx.as('sales')('post', '/period-end/year-end').send({ fiscalYear: 'FY2025' })).status).toBe(403);
  });
});

describe('pre-checks', () => {
  it('leave the period 13 adjustments to step 2 and count the other unposted journals of the year', async () => {
    const before = check(await overview(maker), 'unposted_journals').data.count;
    const adj = await maker('post', '/period-end/adjustments').send({ fiscalYear: 'FY2025', description: 'Audit fee accrual',
      lines: [{ accountCode: '4401003', debit: 1500, credit: 0 }, { accountCode: '2208001', debit: 0, credit: 1500 }] });
    expect(adj.status, JSON.stringify(adj.body)).toBe(201);
    let o = await overview(maker);
    expect(check(o, 'unposted_journals').data.count).toBe(before);
    expect(check(o, 'adjustments_posted')).toMatchObject({ status: 'failed', data: { count: 1 } });
    expect(step(o, 'adjustments')).toBe('pending');
    expect(o.adjustments).toEqual([expect.objectContaining({ journalId: adj.body.data.id, status: 'for-approval', amount: 1500, createdByName: 'maker user' })]);
    // approved on the journal voucher by a second user (maker-checker of the journal vouchers)
    expect((await maker('post', `/journal-vouchers/${adj.body.data.id}/approve`)).status).toBe(403);
    const approved = await checker('post', `/journal-vouchers/${adj.body.data.id}/approve`);
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    o = await overview(maker);
    expect(check(o, 'adjustments_posted').status).toBe('passed');
    expect(o.adjustments[0]).toMatchObject({ status: 'posted', postedByName: 'checker user' });

    const pending = (await query('SELECT id FROM journal_vouchers WHERE status IN (\'for-approval\',\'pending\',\'draft\',\'approved\') AND jv_date <= \'2025-12-31\'')).rows;
    for (const j of pending) await withTransaction((db) => cancelJournal(db, j.id, { id: null }));
    expect(check(await overview(maker), 'unposted_journals')).toMatchObject({ status: 'passed', data: { count: 0 } });
  });

  it('fail while the suspense account has a balance at the year end', async () => {
    const suspense = (await query('SELECT value #>> \'{}\' AS code FROM app_settings WHERE key = \'accounting.account.suspense\'')).rows[0].code;
    const lines = [{ accountCode: suspense, debit: 250, credit: 0 }, { accountCode: '1101001', debit: 0, credit: 250 }];
    await journal('2025-12-15', lines);
    let c = check(await overview(maker), 'suspense_balance');
    expect(c).toMatchObject({ status: 'failed', data: { account: { code: suspense }, balance: 250 } });
    await journal('2025-12-16', lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })));
    c = check(await overview(maker), 'suspense_balance');
    expect(c).toMatchObject({ status: 'passed', data: { balance: 0 } });
  });

  it('accept soft-closed months only when accounting.year_end_accepts_soft_closed is on', async () => {
    await months('soft_closed');
    let c = check(await overview(maker), 'periods_closed');
    expect(c).toMatchObject({ status: 'failed', data: { required: 'closed', closed: 0 } });
    expect(c.data.open).toHaveLength(12);
    await setSetting('accounting.year_end_accepts_soft_closed', true);
    c = check(await overview(maker), 'periods_closed');
    expect(c).toMatchObject({ status: 'passed', data: { required: 'soft_closed', closed: 12, open: [] } });
    await setSetting('accounting.year_end_accepts_soft_closed', false);
    await months('closed');
    const o = await overview(mgr2);
    expect(o.checks.filter((x) => x.status === 'failed')).toEqual([]);
    expect(step(o, 'closing')).toBe('ready');
    expect(step(o, 'approval')).toBe('pending-approval');
    expect(o.currentStep).toBe('approval');
    expect(o.actions.close).toEqual({ allowed: true, reason: null });
    // the preparer, who may not close, lands on the closing entries to review
    expect((await overview(mgr1)).currentStep).toBe('closing');
  });
});

describe('closing the year', () => {
  it('is refused to the user who started the run (maker-checker), on the server too', async () => {
    const r = await mgr1('post', `/period-end/year-end/${run.id}/close`).send({});
    expect(r.status).toBe(403);
    expect(r.body.message).toMatch(/Maker-checker/);
    expect((await maker('post', `/period-end/year-end/${run.id}/close`).send({})).status).toBe(403);
    expect((await query('SELECT status FROM year_end_runs WHERE id = $1', [run.id])).rows[0].status).not.toBe('closed');
  });

  it('posts what the preview showed: closing entries, net income and the opening balances of the next year', async () => {
    const chk = await maker('post', `/period-end/year-end/${run.id}/check`).send({});
    expect(chk.body.data.status).toBe('checked');
    const preview = await overview(mgr2);
    expect(preview.opening.totalDebit).toBeCloseTo(preview.opening.totalCredit, 2);
    expect(preview.closing.lines.length).toBeGreaterThan(0);
    expect(preview.opening.lines.find((l) => l.accountCode === preview.closing.currentYearPl.code)).toBeUndefined();

    const closed = await mgr2('post', `/period-end/year-end/${run.id}/close`).send({ remarks: 'Audit adjustments reviewed' });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.data).toMatchObject({ status: 'closed', closedByName: 'Manager ye.mgr2', remarks: 'Audit adjustments reviewed' });

    const after = await overview(maker);
    expect(after.closing.source).toBe('posted');
    expect(after.closing.netIncome).toBeCloseTo(preview.closing.netIncome, 2);
    expect(after.closing.transfer).toBeCloseTo(preview.closing.transfer, 2);
    const key = (l) => `${l.accountCode}:${l.debit.toFixed(2)}:${l.credit.toFixed(2)}`;
    expect(after.closing.lines.map(key).sort()).toEqual(preview.closing.lines.map(key).sort());
    expect(after.closing.journals.map((j) => j.kind)).toEqual(['CLOSE_PL', 'TRANSFER_RE']);
    expect(after.opening).toMatchObject({ source: 'carried-forward', fiscalYear: 'FY2026' });
    expect(after.opening.lines.map(key)).toEqual(preview.opening.lines.map(key));
    expect(after.steps.map((s) => s.status)).toEqual(['passed', 'passed', 'posted', 'done', 'done']);
    expect(after.activity[0]).toMatchObject({ action: 'close', fromStatus: 'checked', toStatus: 'closed', byName: 'Manager ye.mgr2', remarks: 'Audit adjustments reviewed' });
    expect(after.actions).toMatchObject({ close: null, adjust: null, requestReversal: { allowed: true } });
    const told = (await query('SELECT title FROM notifications WHERE entity = \'year_end_run\' AND entity_id = $1 AND user_id = $2', [run.id, ids['ye.mgr1']])).rows;
    expect(told.map((n) => n.title)).toContain(`Year-end close ${run.runNumber} closed`);
  });
});

describe('reversing the close', () => {
  it('needs a reason of the year-end reversal context, with a note when the reason asks for one', async () => {
    const ask = (as, body) => as('post', `/period-end/year-end/${run.id}/reverse-request`).send(body);
    expect((await ask(ctx.as('agent'), { reasonCode: 'YER-AUDITADJ' })).status).toBe(403);
    expect((await ask(maker, {})).status).toBe(400);
    const wrong = await ask(maker, { reasonCode: 'PCL-OTHER', note: 'x' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors[0].path).toBe('reasonCode');
    const noNote = await ask(maker, { reasonCode: 'YER-WRONGRUN' });
    expect(noNote.status).toBe(400);
    expect(noNote.body.errors[0].path).toBe('note');
    expect((await mgr2('post', `/period-end/year-end/${run.id}/reverse`).send({})).status).toBe(409);
  });

  it('can be withdrawn by the requester before it is approved', async () => {
    const asked = await mgr1('post', `/period-end/year-end/${run.id}/reverse-request`).send({ reasonCode: 'YER-RETEARN' });
    expect(asked.status, JSON.stringify(asked.body)).toBe(200);
    expect(asked.body.data.reverseRequest).toMatchObject({ by: ids['ye.mgr1'], reasonCode: 'YER-RETEARN' });
    expect((await mgr1('post', `/period-end/year-end/${run.id}/reverse-request`).send({ reasonCode: 'YER-RETEARN' })).status).toBe(409);
    expect((await maker('post', `/period-end/year-end/${run.id}/reverse-request/withdraw`).send({})).status).toBe(403);
    const back = await mgr1('post', `/period-end/year-end/${run.id}/reverse-request/withdraw`).send({});
    expect(back.status).toBe(200);
    expect(back.body.data).toMatchObject({ status: 'closed', reverseRequest: null, reverseReasonCode: null });
    expect((await overview(maker)).activity[0]).toMatchObject({ action: 'reverse-withdraw', reasonCode: 'YER-RETEARN', byName: 'Manager ye.mgr1' });
  });

  it('is approved by another Accounting Manager than the requester and reopens the year with the reason', async () => {
    const asked = await mgr1('post', `/period-end/year-end/${run.id}/reverse-request`).send({ reasonCode: 'YER-AUDITADJ', note: 'Late audit adjustment' });
    expect(asked.status).toBe(200);
    expect((await overview(mgr1)).actions).toMatchObject({ approveReversal: { allowed: false, reason: 'maker-checker' }, withdrawReversal: { allowed: true } });
    expect((await overview(maker)).actions).toMatchObject({ approveReversal: { allowed: false, reason: 'permission' }, withdrawReversal: { allowed: false, reason: 'permission' } });
    expect((await overview(mgr2)).actions.approveReversal).toEqual({ allowed: true, reason: null });
    const own = await mgr1('post', `/period-end/year-end/${run.id}/reverse`).send({});
    expect(own.status).toBe(403);
    expect(own.body.message).toMatch(/Maker-checker/);

    const rev = await mgr2('post', `/period-end/year-end/${run.id}/reverse`).send({ remarks: 'Agreed with the auditor' });
    expect(rev.status, JSON.stringify(rev.body)).toBe(200);
    expect(rev.body.data).toMatchObject({ status: 'reversed', reversedByName: 'Manager ye.mgr2', reverseReasonCode: 'YER-AUDITADJ',
      reverseReason: 'Audit adjustments after the year-end close: Late audit adjustment' });
    expect((await query('SELECT count(*)::int AS n FROM opening_balances WHERE fiscal_year = \'FY2026\'')).rows[0].n).toBe(0);
    const audit = (await query('SELECT after_data FROM audit_log WHERE entity = \'year_end_run\' AND entity_id = $1 AND action = \'reverse\'', [run.id])).rows[0];
    expect(audit.after_data).toMatchObject({ status: 'reversed', reverseReasonCode: 'YER-AUDITADJ' });

    const o = await overview(maker);
    expect(o.run).toBeNull();
    expect(o.fiscalYear.status).toBe('closing');
    expect(o.actions.start).toEqual({ allowed: true, reason: null });
    expect(o.runs).toEqual([expect.objectContaining({ id: run.id, status: 'reversed' })]);
    expect(o.activity.map((a) => a.action)).toEqual(['reverse', 'reverse-request', 'reverse-withdraw', 'reverse-request', 'close', 'check', 'start']);
    expect(o.activity[0]).toMatchObject({ fromStatus: 'closed', toStatus: 'reversed', reasonCode: 'YER-AUDITADJ', byName: 'Manager ye.mgr2', roles: ['Accounting Manager'] });
  });
});

describe('migration 0384', () => {
  it('rebuilds the history of the runs that existed before it and can run again', async () => {
    const sql = fs.readFileSync(new URL('../src/db/migrations/0384_year_end_close_review.sql', import.meta.url), 'utf8');
    await query('DELETE FROM year_end_run_history WHERE run_id = $1', [run.id]);
    await query(sql);
    await query(sql);
    const rows = (await query('SELECT action, from_status, to_status, reason_code FROM year_end_run_history WHERE run_id = $1 ORDER BY changed_at', [run.id])).rows;
    expect(rows).toEqual([
      { action: 'start', from_status: null, to_status: 'draft', reason_code: null },
      { action: 'close', from_status: 'checked', to_status: 'closed', reason_code: null },
      { action: 'reverse', from_status: 'closed', to_status: 'reversed', reason_code: 'YER-AUDITADJ' },
    ]);
  });
});
