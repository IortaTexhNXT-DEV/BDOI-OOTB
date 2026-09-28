import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

describe('accounting ledger', () => {
  let m;
  it('seeded ledger is balanced and the trial balance agrees', async () => {
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    const tb = await ctx.as('maker')('get', '/accounting/trial-balance');
    expect(tb.status).toBe(200);
    expect(tb.body.data.totals.balanced).toBe(true);
    expect(tb.body.data.rows.find((r) => r.accountCode === '1202001')).toBeTruthy();
  });

  it('payment-entries books and collects once (idempotent with the receipt flow)', async () => {
    m = await makePolicy({ net: 10000 });
    const body = { amount: m.gross, grossPremium: m.gross, netPremium: m.net, valueAddedTax: 1200, documentaryStampTax: 1250, localGovernmentTax: 75, paymentDate: new Date().toISOString(),
      description: `Quote payment for policy ${m.policy.policy_number}`, referenceType: 'Policy', referenceId: m.policy.id, clientId: m.client.id, policyId: m.policy.id, policyNumber: m.policy.policy_number, isDirectBilled: false };
    const r1 = await ctx.as('agent')('post', '/accounting/payment-entries').send(body);
    expect(r1.status).toBe(201);
    expect(r1.body.data.applied).toBe(m.gross);
    const r2 = await ctx.as('agent')('post', '/accounting/payment-entries').send(body);
    expect(r2.body.data.alreadyApplied).toBe(true);
    const e = await ctx.as('maker')('get', `/accounting/policies/${m.policy.id}/entries`);
    expect(e.status).toBe(200);
    const types = new Set(e.body.data.map((x) => x.entryType));
    expect([...types].sort()).toEqual(['NEW_BUSINESS', 'PAYMENT_RECEIPT']);
    expect(e.body.totals.totalDebits).toBe(e.body.totals.totalCredits);
    const lv = await ctx.as('maker')('get', `/accounting/policies/${m.policy.id}/ledger-view`);
    expect(lv.body.data.at(-1).runningBalance).toBe(0);
    const dir = await ctx.as('agent')('post', '/accounting/payment-entries').send({ ...body, isDirectBilled: true });
    expect(dir.body.data.directBilled).toBe(true);
    expect((await ctx.as('agent')('post', '/accounting/payment-entries').send({ amount: -1, clientId: 'x', referenceType: 'Policy', referenceId: 'x' })).status).toBe(400);
  });

  it('entries search, client ledger, all-clients view and export', async () => {
    const s = await ctx.as('maker')('get', `/accounting/entries/search?clientId=${m.client.client_code}&status=Posted&page=1&pageSize=50`);
    expect(s.status).toBe(200);
    expect(s.body.data.length).toBeGreaterThan(0);
    expect(s.body.data[0].client.clientId).toBe(m.client.client_code);
    expect(s.body.pagination.total).toBe(s.body.data.length);
    const cl = await ctx.as('maker')('get', `/accounting/clients/${m.client.id}/ledger-view`);
    expect(cl.body.data.length).toBe(s.body.data.length);
    const all = await ctx.as('maker')('get', '/accounting/all-clients-accounting?page=1&pageSize=5');
    expect(all.body.data.length).toBe(5);
    expect(all.body.totals.totalClients).toBeGreaterThan(5);
    expect(all.body.totals.grandTotalDebits).toBeGreaterThan(0);
    const ex = await ctx.as('maker')('get', `/accounting/export?clientId=${m.client.client_code}`);
    expect(ex.status).toBe(200);
    expect(ex.headers['content-disposition']).toMatch(/attachment; filename=".*\.csv"/);
    expect(ex.text.split('\r\n').length).toBe(s.body.data.length + 1);
    expect((await ctx.as('maker')('get', '/accounting/export?clientId=NOBODY')).status).toBe(404);
  });

  it('open-entry matching and unmatching (POST and GET)', async () => {
    const debits = (await ctx.as('maker')('get', `/accounting/entries/unmatched?debitCredit=DEBIT&clientId=${m.client.id}&accountCode=1202001`)).body.data;
    const credits = (await ctx.as('maker')('get', `/accounting/entries/unmatched?debitCredit=CREDIT&clientId=${m.client.id}&accountCode=1202001`)).body.data;
    expect(debits.length).toBeGreaterThan(0);
    expect(credits.length).toBeGreaterThan(0);
    const mt = await ctx.as('maker')('post', '/accounting/entries/match').send({ matchPairs: [{ debitTransactionId: debits[0].id, creditTransactionId: credits[0].id, matchedAmount: 100 }], metadata: { documentRef: 'M-1', narration: 'partial' } });
    expect(mt.status).toBe(200);
    expect(mt.body.data[0].matchedAmount).toBe(100);
    const after = (await ctx.as('maker')('get', `/accounting/entries/unmatched?debitCredit=DEBIT&clientId=${m.client.id}&accountCode=1202001`)).body.data.find((x) => x.id === debits[0].id);
    expect(after.amount).toBe(Math.round((debits[0].amount - 100) * 100) / 100);
    expect((await ctx.as('maker')('post', '/accounting/entries/match').send({ matchPairs: [{ debitTransactionId: debits[0].id, creditTransactionId: credits[0].id, matchedAmount: 99999999 }] })).status).toBe(400);
    const matched = await ctx.as('maker')('get', '/accounting/entries/matched');
    expect(matched.body.data.find((x) => x.id === mt.body.data[0].id).debitTransaction.id).toBe(debits[0].id);
    const mt2 = await ctx.as('maker')('post', '/accounting/entries/match').send({ matchPairs: [{ debitTransactionId: debits[0].id, creditTransactionId: credits[0].id, matchedAmount: 50 }] });
    const un1 = await ctx.as('maker')('post', '/accounting/entries/unmatch').send({ matchingIds: [mt.body.data[0].id] });
    expect(un1.body.data).toEqual([mt.body.data[0].id]);
    const un2 = await ctx.as('maker')('get', `/accounting/entries/unmatch?matchingIds=${mt2.body.data[0].id}`);
    expect(un2.status).toBe(200);
    expect((await ctx.as('maker')('post', '/accounting/entries/unmatch').send({ matchingIds: [mt2.body.data[0].id] })).status).toBe(404);
  });

  it('transactions: post a pending journal, reverse it, cancel another', async () => {
    expect((await ctx.api('put', '/settings').send({ settings: { 'accounting.auto_post_system_entries': false } })).status).toBe(200);
    const p = await makePolicy({ net: 4000 });
    await ctx.as('maker')('post', '/receipts').send({ policyId: p.policy.id, amount: p.gross });
    const pending = (await ctx.as('maker')('get', `/accounting/entries/search?policyId=${p.policy.id}&status=Pending`)).body.data;
    expect(pending.length).toBeGreaterThan(0);
    const booking = pending.find((x) => x.entryType === 'NEW_BUSINESS');
    const receipt = pending.find((x) => x.entryType === 'PAYMENT_RECEIPT');
    const post = await ctx.as('maker')('put', `/accounting/transactions/${booking.id}/post`);
    expect(post.body.data.status).toBe('Posted');
    const rev = await ctx.as('maker')('put', `/accounting/transactions/${booking.transactionId}/reverse`);
    expect(rev.status).toBe(200);
    expect(rev.body.data.reversalNumber).toMatch(/^JV-/);
    expect((await ctx.as('maker')('put', `/accounting/transactions/${booking.id}/reverse`)).status).toBe(409);
    const bulk = await ctx.as('maker')('put', '/accounting/transactions/bulk-post').send({ transactionIds: [receipt.id, 'jv_missing'] });
    expect(bulk.body.data.posted).toHaveLength(1);
    expect(bulk.body.data.errors).toHaveLength(1);
    expect((await ctx.as('maker')('put', `/accounting/transactions/${receipt.id}/cancel`)).status).toBe(409);
    await ctx.api('put', '/settings').send({ settings: { 'accounting.auto_post_system_entries': true } });
    const tb = await ctx.as('maker')('get', '/accounting/trial-balance');
    expect(tb.body.data.totals.balanced).toBe(true);
  });

  it('period close blocks postings into the period; reopen allows them again', async () => {
    const period = new Date().toISOString().slice(0, 7);
    expect((await ctx.as('maker')('post', `/accounting/periods/${period}/close`).send({})).status).toBe(409);
    await query('UPDATE journal_vouchers SET status = \'cancelled\' WHERE status IN (\'pending\',\'for-approval\',\'draft\',\'approved\')');
    expect((await ctx.as('maker')('post', `/accounting/periods/${period}/close`).send({})).status).toBe(400);
    const c = await ctx.as('maker')('post', `/accounting/periods/${period}/close`).send({ remarks: 'Test close' });
    expect(c.body.data.status).toBe('closed');
    const p = await makePolicy({ net: 1000 });
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: p.policy.id, amount: p.gross })).status).toBe(409);
    const o = await ctx.as('maker')('post', `/accounting/periods/${period}/reopen`).send({ remarks: 'Late receipts' });
    expect(o.body.data.status).toBe('open');
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: p.policy.id, amount: p.gross })).status).toBe(201);
    const list = await ctx.as('maker')('get', '/accounting/periods');
    expect(list.body.data.find((x) => x.period === period).reopenedAt).toBeTruthy();
  });

  it('chart of accounts is configurable', async () => {
    const c = await ctx.as('maker')('post', '/accounting/accounts').send({ code: '4401011', name: 'Seminars and Training', accountType: 'expense' });
    expect(c.status).toBe(201);
    expect((await ctx.as('maker')('post', '/accounting/accounts').send({ code: '4401011', name: 'Dup', accountType: 'expense' })).status).toBe(400);
    const u = await ctx.as('maker')('put', '/accounting/accounts/4401011').send({ name: 'Seminars & Training' });
    expect(u.body.data.name).toBe('Seminars & Training');
    expect((await ctx.as('maker')('put', '/accounting/accounts/1202001').send({ status: 'inactive' })).status).toBe(409);
    const l = await ctx.as('maker')('get', '/accounting/accounts?type=expense&search=Seminar');
    expect(l.body.data).toHaveLength(1);
  });

  it('permissions', async () => {
    expect((await ctx.as('claims')('get', '/accounting/entries/search')).status).toBe(403);
    expect((await ctx.as('sales')('put', '/accounting/transactions/1/post')).status).toBe(403);
    expect((await ctx.as('claims')('post', '/accounting/payment-entries').send({})).status).toBe(403);
  });
});
