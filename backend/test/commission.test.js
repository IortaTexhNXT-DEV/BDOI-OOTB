import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool } from '../src/db/pool.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

const details = (ref, sub) => ({ commissionDetails: { brokeragePct: 18, productLabel: 'Motor · All insurers', primary: { referrerId: ref, level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: sub ? [{ referrerId: sub, level: 'L2' }] : [] } });

describe('commission', () => {
  let ref; let pol;
  it('dashboard, referrer list and agents ready to pay (seeded data)', async () => {
    const d = await ctx.as('maker')('get', '/commission/dashboard');
    expect(d.status).toBe(200);
    expect(d.body.data.kpis.comsubGross).toBeGreaterThan(0);
    expect(d.body.data.linesByStatus.map((x) => x.status)).toEqual(['Accrued', 'Eligible', 'Approved', 'Paid']);
    expect(d.body.data.clawback.lines).toBeGreaterThanOrEqual(1);
    const l = await ctx.as('sales')('get', '/commission/referrer-accounts');
    expect(l.status).toBe(200);
    expect(l.body.data.referrers.length).toBeGreaterThanOrEqual(8);
    const rp = await ctx.as('maker')('get', '/commission/agents-ready-to-pay');
    expect(rp.body.data.summary.agentCount).toBeGreaterThan(0);
  });

  it('creates a referrer and accrues lines from policy commission details', async () => {
    const c = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Teodoro Lim', type: 'Agent', level: 'L1', bankName: 'BDO', bankAccountNo: '001122334455' });
    expect(c.status).toBe(201);
    ref = c.body.data.referrer.id;
    expect(c.body.data.referrer.bankAccount).toBe('BDO ***4455');
    expect((await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Teodoro Lim' })).status).toBe(409);
    pol = await makePolicy({ net: 50000, details: details(ref, 'ref-mreyes') });
    const a = await ctx.as('maker')('post', '/commission/accrue').send({ policyId: pol.policy.id });
    expect(a.status).toBe(201);
    expect(a.body.data.created).toHaveLength(2);
    const acct = (await ctx.as('maker')('get', `/commission/referrer-accounts/${ref}`)).body.data;
    const line = [...acct.currentCycle.lines, ...acct.futureCycles.lines][0];
    expect(line.status).toBe('Accrued');
    expect(line.comsub).toBe(4000);
    expect(line.wht).toBe(200);
    expect(line.net).toBe(3800);
    expect(line.brokerageAmount).toBe(9000);
  });

  it('eligibility requires collected premium; payment makes lines eligible automatically', async () => {
    const acct = (await ctx.as('maker')('get', `/commission/referrer-accounts/${ref}`)).body.data;
    const lineId = [...acct.currentCycle.lines, ...acct.futureCycles.lines][0].id;
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/lines/${lineId}/mark-eligible`)).status).toBe(409);
    const rate = await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/lines/${lineId}/rate`).send({ comsubPct: 10, comsubFixed: 500 });
    expect(rate.status).toBe(200);
    expect(rate.body.data.line.comsub).toBe(5500);
    const r = await ctx.as('maker')('post', '/receipts').send({ policyId: pol.policy.id, amount: pol.gross });
    expect(r.status).toBe(201);
    const after = (await ctx.as('maker')('get', `/commission/referrer-accounts/${ref}/lines/${lineId}`)).body.data;
    expect(after.status).toBe('Eligible');
    expect(after.receiptNo).toBe(r.body.data.receiptNumber);
  });

  it('approval is maker-checker; approved lines post the accrual and can be bulk-disbursed and paid', async () => {
    const acct = (await ctx.as('maker')('get', `/commission/referrer-accounts/${ref}`)).body.data;
    expect(acct.actions.approveCount).toBe(1);
    // with auto-eligibility off, the maker marks the second policy's line eligible and therefore cannot approve it
    expect((await ctx.api('put', '/settings').send({ settings: { 'commission.auto_eligible_on_full_payment': false } })).status).toBe(200);
    const p2 = await makePolicy({ net: 20000, details: details(ref) });
    await ctx.as('maker')('post', '/commission/accrue').send({ policyId: p2.policy.id });
    await ctx.as('maker')('post', '/receipts').send({ policyId: p2.policy.id, amount: p2.gross });
    const me = await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/mark-eligible`);
    expect(me.status).toBe(200);
    expect(me.body.data.actions.approveCount).toBe(2);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/approve`)).status).toBe(403);
    const ok = await ctx.as('checker')('post', `/commission/referrer-accounts/${ref}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.actions.generatePayoutCount).toBe(2);
    const gp = await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/generate-payout`);
    expect(gp.body.data.redirect.referrerId).toBe(ref);
    const lines = (await ctx.api('get', `/disbursements/agent-invoice-lines?referrerId=${ref}`)).body.data.invoiceList;
    expect(lines).toHaveLength(2);
    const bulk = await ctx.as('maker')('post', '/disbursements/bulk-agent-disburse').send({ referrerIds: [ref, 'ref-nobody'], transactionCode: 'COMSUB', instrumentCurrency: 'PHP' });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.vouchers).toHaveLength(1);
    expect(bulk.body.data.errors).toHaveLength(1);
    const v = bulk.body.data.vouchers[0];
    expect((await ctx.as('maker')('post', `/disbursements/${v.disbursementId}/approve-agent-payout`).send({ lineIds: v.lineIds })).status).toBe(403);
    const ap = await ctx.as('checker')('post', `/disbursements/${v.disbursementId}/approve-agent-payout`).send({ lineIds: v.lineIds });
    expect(ap.status).toBe(200);
    expect(ap.body.data.status).toBe('paid');
    expect(ap.body.data.whtAmount).toBeGreaterThan(0);
    const a2 = (await ctx.as('maker')('get', `/commission/referrer-accounts/${ref}`)).body.data;
    expect(a2.past.lines.filter((l) => l.status === 'Paid')).toHaveLength(2);
    expect(a2.summary.paidToDate).toBe(ap.body.data.amount);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('WHT toggle recomputes open lines; reversal after payment is a clawback; single-line pay', async () => {
    const w = await ctx.as('maker')('post', '/commission/referrer-accounts/ref-mreyes/wht').send({ whtApplicable: false, reason: 'Certificate of exemption received' });
    expect(w.status).toBe(200);
    const open = [...w.body.data.currentCycle.lines, ...w.body.data.futureCycles.lines].filter((l) => l.status !== 'Paid');
    expect(open.every((l) => l.wht === 0)).toBe(true);
    const a = (await ctx.as('maker')('get', `/commission/referrer-accounts/${ref}`)).body.data;
    const paid = a.past.lines.find((l) => l.status === 'Paid');
    const rev = await ctx.as('checker')('post', `/commission/referrer-accounts/${ref}/lines/${paid.id}/reverse`).send({ reason: 'Policy cancelled from inception' });
    expect(rev.status).toBe(200);
    expect(rev.body.data.line.status).toBe('Reversed');
    expect(rev.body.data.line.clawback).toBe(true);
    // Eligible sub-agent line: checker approves, maker pays it alone
    const sub = (await ctx.as('maker')('get', '/commission/referrer-accounts/ref-mreyes')).body.data;
    const el = sub.currentCycle.lines.find((l) => l.status === 'Eligible' && l.policyNo === pol.policy.policy_number);
    expect((await ctx.as('checker')('post', `/commission/referrer-accounts/ref-mreyes/lines/${el.id}/approve`)).status).toBe(200);
    const pay = await ctx.as('maker')('post', `/commission/referrer-accounts/ref-mreyes/lines/${el.id}/pay`);
    expect(pay.status).toBe(200);
    expect(pay.body.data.line.status).toBe('Paid');
    expect(pay.body.data.line.voucherNo).toBeTruthy();
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('validation and permissions', async () => {
    expect((await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'X', type: 'Boss' })).status).toBe(400);
    expect((await ctx.as('maker')('get', '/commission/referrer-accounts/ref-none')).status).toBe(404);
    expect((await ctx.as('claims')('get', '/commission/dashboard')).status).toBe(403);
    expect((await ctx.as('sales')('post', '/commission/referrer-accounts/ref-mreyes/approve')).status).toBe(403);
  });
});
