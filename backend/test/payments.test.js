import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

describe('payments, open items and petty cash', () => {
  it('payments list by status with summary; agents only see their own policies', async () => {
    const all = await ctx.as('sales')('get', '/payments?page=1&pageSize=50');
    expect(all.status).toBe(200);
    expect(all.body.summary.paid.count).toBeGreaterThan(0);
    const paid = await ctx.as('sales')('get', '/payments?status=PAID');
    expect(paid.body.data.every((x) => x.status === 'PAID')).toBe(true);
    const own = await makePolicy({ net: 6000, owner: ctx.userIds.agent });
    await ctx.as('agent')('post', '/receipts').send({ policyId: own.policy.id, amount: 1000 });
    const mine = await ctx.as('agent')('get', '/payments');
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].status).toBe('REVIEWING');
    const d = await ctx.as('agent')('get', `/payments/${mine.body.data[0].id}`);
    expect(d.body.data.payments[0].amount).toBe(1000);
    const other = all.body.data.find((x) => x.policyNumber !== own.policy.policy_number);
    expect((await ctx.as('agent')('get', `/payments/${other.id}`)).status).toBe(404);
  });

  it('open items and events', async () => {
    const oi = await ctx.as('sales')('get', '/open-items');
    expect(oi.status).toBe(200);
    expect(oi.body.data.summary.map((s) => s.status)).toEqual(['Pending Payments', 'Renewal Request', 'Quote Pending', 'Expiring Policy']);
    expect(oi.body.data.items.length).toBeGreaterThan(0);
    const onlyPay = await ctx.as('sales')('get', '/open-items?type=payment');
    expect(onlyPay.body.data.items.every((i) => i.type === 'payment')).toBe(true);
    const e = await ctx.as('agent')('post', '/open-items/events').send({ date: '2099-10-01', notes: 'Policy review with client', startTime: '10:00', endTime: '11:00' });
    expect(e.status).toBe(201);
    const list = await ctx.as('agent')('get', '/open-items/events');
    expect(list.body.data.map((x) => x.id)).toContain(e.body.data.id);
    expect((await ctx.as('sales')('delete', `/open-items/events/${e.body.data.id}`)).status).toBe(404);
    expect((await ctx.as('agent')('delete', `/open-items/events/${e.body.data.id}`)).status).toBe(200);
    expect((await ctx.as('agent')('post', '/open-items/events').send({ date: 'x' })).status).toBe(400);
  });

  it('petty cash: fund, request (maker-checker), disbursement, receipt, replenishment', async () => {
    const f = await ctx.as('maker')('post', '/petty-cash/funds').send({ code: 'PCF-TST', description: 'Test fund', fundSize: 10000, maxLimit: 3000, minimumCashbox: 9000, branchCode: 'PHP' });
    expect(f.status).toBe(201);
    expect(f.body.data.availableCash).toBe(10000);
    expect((await ctx.as('maker')('post', '/petty-cash/funds').send({ code: 'PCF-TST', fundSize: 1 })).status).toBe(409);
    const r = await ctx.as('maker')('post', '/petty-cash/requests').send({ pettyCashCode: 'PCF-TST', requesterName: 'Ana Reyes', purpose: 'Courier', lines: [{ narration: 'LBC', amount: 1500 }, { narration: 'Grab', amount: 500 }] });
    expect(r.status).toBe(201);
    expect(r.body.data.totalAmount).toBe(2000);
    const rid = r.body.data.id;
    expect((await ctx.as('maker')('post', `/petty-cash/requests/${rid}/approve`)).status).toBe(409);
    expect((await ctx.as('maker')('post', `/petty-cash/requests/${rid}/submit`)).status).toBe(200);
    expect((await ctx.as('maker')('post', `/petty-cash/requests/${rid}/approve`)).status).toBe(403);
    expect((await ctx.as('checker')('post', `/petty-cash/requests/${rid}/approve`)).body.data.status).toBe('approved');
    expect((await ctx.as('maker')('post', '/petty-cash/disbursements').send({ pettyCashCode: 'PCF-TST', requestId: rid, expenseAccount: '4401007', amount: 2500 })).status).toBe(400);
    const d = await ctx.as('maker')('post', '/petty-cash/disbursements').send({ pettyCashCode: 'PCF-TST', requestId: r.body.data.requestNumber, expenseAccount: '4401007', amount: 2000, vat: 214.29, wht: 20, remarks: 'Courier' });
    expect(d.status).toBe(201);
    expect(d.body.data.netAmount).toBe(1980);
    const jl = (await query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [d.body.data.journalId])).rows.map((x) => x.account_code);
    expect(jl).toEqual(['4401007', '1301001', '1103001', '2204001']);
    expect((await ctx.as('maker')('get', `/petty-cash/requests/${rid}`)).body.data.status).toBe('disbursed');
    const n = (await query('SELECT count(*)::int AS n FROM notifications WHERE entity = \'petty_cash_fund\'')).rows[0].n;
    expect(n).toBe(1);
    const rc = await ctx.as('maker')('post', '/petty-cash/receipts').send({ pettyCashCode: 'PCF-TST', amount: 300, requesterName: 'Ana Reyes', remarks: 'Change returned' });
    expect(rc.status).toBe(201);
    const rp = await ctx.as('maker')('post', '/petty-cash/replenishments').send({ pettyCashCode: 'PCF-TST', remarks: 'Top up' });
    expect(rp.status).toBe(201);
    expect(rp.body.data.amount).toBe(1680);
    const fund = await ctx.as('maker')('get', '/petty-cash/funds/PCF-TST');
    expect(fund.body.data.availableCash).toBe(10000);
    expect((await ctx.as('maker')('post', '/petty-cash/replenishments').send({ pettyCashCode: 'PCF-TST' })).status).toBe(409);
    const lists = await Promise.all(['funds', 'requests', 'disbursements', 'receipts', 'replenishments'].map((k) => ctx.as('maker')('get', `/petty-cash/${k}?search=PCF-TST`)));
    expect(lists.map((l) => l.body.data.length)).toEqual([1, 1, 1, 1, 1]);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('permissions', async () => {
    expect((await ctx.as('sales')('get', '/petty-cash/funds')).status).toBe(403);
    expect((await ctx.as('claims')('get', '/payments')).status).toBe(200);
    expect((await ctx.as('claims')('post', '/petty-cash/funds').send({ code: 'X', fundSize: 1 })).status).toBe(403);
  });
});
