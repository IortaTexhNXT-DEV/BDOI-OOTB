import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, ledgerIntegrity } from './accounting.fixtures.js';
import { pool } from '../src/db/pool.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

const entries = (amount = 25000) => [
  { mainAccount: '4401003', subAccount: '4401003001', entryType: 'Debit', currencyCode: 'PHP', foreignAmount: amount, remarks: 'Statutory audit', branchCode: 'PHP', departmentCode: 'FI' },
  { mainAccount: '2206001', subAccount: '', entryType: 'Credit', currencyCode: 'PHP', foreignAmount: amount, remarks: 'Accrued audit fee', branchCode: 'PHP', departmentCode: 'FI' },
];

describe('journal vouchers', () => {
  let jv;
  it('history lists seeded manual vouchers with the pagination keys the screen reads', async () => {
    const h = await ctx.as('maker')('get', '/journal-vouchers/history?page=1&pageSize=20');
    expect(h.status).toBe(200);
    expect(h.body.data.length).toBeGreaterThanOrEqual(3);
    expect(h.body.pagination).toMatchObject({ currentPage: 1, pageSize: 20 });
    expect(h.body.pagination.totalRecords).toBeGreaterThanOrEqual(3);
  });

  it('maker creates a voucher for approval; maker cannot approve; checker approves and it posts', async () => {
    const c = await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', transactionDescription: 'Audit accrual', entries: entries() });
    expect(c.status).toBe(201);
    jv = c.body.data;
    expect(jv.status).toBe('for-approval');
    expect(c.body.message).toContain(jv.transactionNumber);
    // The approval notification shows the amount formatted with the configured currency (not "(25000)")
    const n = (await pool.query("SELECT message FROM notifications WHERE entity = 'journal_voucher' AND title LIKE '%awaiting approval' ORDER BY id DESC LIMIT 1")).rows[0];
    expect(n.message).toContain('(₱25,000.00)');
    const d = await ctx.as('checker')('get', `/journal-vouchers?transactionNumber=${jv.transactionNumber}&page=1&pageSize=10`);
    expect(d.body.data).toHaveLength(2);
    expect(d.body.data[0]).toMatchObject({ mainAccount: '4401003', subAccount: '4401003001', entryType: 'Debit', localAmount: 25000, transactionNumber: jv.transactionNumber });
    expect((await ctx.as('maker')('post', `/journal-vouchers/${jv.id}/approve`)).status).toBe(403);
    const a = await ctx.as('checker')('post', `/journal-vouchers/${jv.id}/approve`);
    expect(a.status).toBe(200);
    expect(a.body.data.status).toBe('posted');
    expect((await ctx.as('checker')('post', `/journal-vouchers/${jv.id}/approve`)).status).toBe(409);
  });

  // Rates come from the dated Exchange Rate master (sample USD 56.50 effective 1-30 Sep 2026), no longer from the
  // Currency master's rate (USD 0.0177 per peso): 177 USD on 15 Sep 2026 = 10,000.50 (was 177 / 0.0177 = 10,000).
  it('foreign currency lines convert at the dated Exchange Rate master rate of the voucher date; unbalanced or unknown accounts are rejected', async () => {
    const usdLines = [{ mainAccount: '4401006', entryType: 'Debit', currencyCode: 'USD', foreignAmount: 177 }, { mainAccount: '2206001', entryType: 'Credit', currencyCode: 'USD', foreignAmount: 177 }];
    const usd = await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV05', date: '2026-09-15', entries: usdLines });
    expect(usd.status).toBe(201);
    expect(usd.body.data.totalDebit).toBe(10000.5);
    const noRate = await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV05', date: '2026-08-15', entries: usdLines });
    expect(noRate.status).toBe(400);
    expect(noRate.body.message).toMatch(/No exchange rate from USD to PHP in force on 2026-08-15/);
    expect((await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', entries: [entries()[0], { ...entries()[1], foreignAmount: 100 }] })).status).toBe(400);
    expect((await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', entries: [entries()[0], { ...entries()[1], mainAccount: '9999999' }] })).status).toBe(400);
    expect((await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', entries: [entries()[0]] })).status).toBe(400);
  });

  it('checker rejects with a reason', async () => {
    const c = await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', entries: entries(500) });
    expect((await ctx.as('checker')('post', `/journal-vouchers/${c.body.data.id}/reject`).send({})).status).toBe(400);
    const r = await ctx.as('checker')('post', `/journal-vouchers/${c.body.data.id}/reject`).send({ reason: 'Wrong period' });
    expect(r.body.data.status).toBe('rejected');
    expect(r.body.data.rejectionReason).toBe('Wrong period');
  });

  it('correction JV reverses the original and posts corrected lines on approval; reversal JV of the correction', async () => {
    const corr = await ctx.as('maker')('post', '/journal-vouchers/correction').send({ transactionNumber: jv.transactionNumber, correctionJVTransactionCode: 'CJV01', entries: entries(24000) });
    expect(corr.status).toBe(201);
    expect(corr.body.data.kind).toBe('correction');
    expect(corr.body.data.totalDebit).toBe(49000);
    expect((await ctx.as('maker')('post', '/journal-vouchers/correction').send({ transactionNumber: jv.transactionNumber, entries: entries(1) })).status).toBe(409);
    const a = await ctx.as('checker')('post', `/journal-vouchers/${corr.body.data.id}/approve`);
    expect(a.body.data.status).toBe('posted');
    const orig = await ctx.as('checker')('get', `/journal-vouchers/${jv.id}`);
    expect(orig.body.data.status).toBe('reversed');
    const rev = await ctx.as('maker')('post', '/journal-vouchers/reversal').send({ transactionNumber: corr.body.data.transactionNumber, reversalJVTransactionCode: 'RJV01', description: 'Undo correction' });
    expect(rev.status).toBe(201);
    expect(rev.body.data.kind).toBe('reversal');
    const ra = await ctx.as('checker')('post', `/journal-vouchers/${rev.body.data.id}/approve`);
    expect(ra.status).toBe(200);
    expect((await ctx.as('maker')('post', '/journal-vouchers/reversal').send({ transactionNumber: corr.body.data.transactionNumber })).status).toBe(409);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    const tb = await ctx.as('maker')('get', '/accounting/trial-balance');
    expect(tb.body.data.totals.balanced).toBe(true);
  });

  it('permissions', async () => {
    expect((await ctx.as('sales')('get', '/journal-vouchers/history')).status).toBe(403);
    expect((await ctx.as('agent')('post', '/journal-vouchers').send({ transactionCode: 'X', entries: entries() })).status).toBe(403);
    expect((await ctx.as('maker')('get', '/journal-vouchers/jv_missing')).status).toBe(404);
  });
});
