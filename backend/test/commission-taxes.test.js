import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { findPolicy, premiumSplit, returnPremium } from '../src/modules/receipts/receivables.js';
import { commissionTaxes } from '../src/modules/accounting/lib/commissionTax.js';
import { withoutConfigurationApproval } from './helpers.js';

let ctx;
// set-up changes apply at once here; their approval is covered in configuration-controls.test.js
beforeAll(async () => { ctx = await setupFinance(); await withoutConfigurationApproval(); });
afterAll(async () => { await pool.end(); });

const r2 = (n) => Math.round(n * 100) / 100;
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const linesOf = async (jvId) => (await query('SELECT account_code, debit::float AS debit, credit::float AS credit, memo FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId])).rows
  .map((l) => [l.account_code, r2(l.debit), r2(l.credit)]);
const booking = async (policyId) => (await query('SELECT * FROM receivables WHERE policy_id = $1 ORDER BY created_at', [policyId])).rows;

describe('commission taxes on broker-billed business', () => {
  it('the booking journal books output VAT on the commission and the EWT the insurer withholds (rule version 2)', async () => {
    const m = await makePolicy({ net: 10000 });
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross })).status).toBe(201);
    const [rcv] = await booking(m.policy.id);
    // commission 1,500; VAT 12% = 180 (VAT12-OUT); EWT 10% = 150 (WC139)
    expect(Number(rcv.commission_vat)).toBe(180);
    expect(Number(rcv.commission_ewt)).toBe(150);
    expect(await linesOf(rcv.booking_jv_id)).toEqual([
      ['1202001', 12525, 0], ['2201001', 0, r2(12525 - 1500 - 180 + 150)], ['3201001', 0, 1500], ['2204003', 0, 180], ['1302001', 150, 0]]);
    const rule = (await query('SELECT p.version FROM journal_vouchers j JOIN posting_rules p ON p.id = j.posting_rule_id WHERE j.id = $1', [rcv.booking_jv_id])).rows[0];
    expect(rule.version).toBe(2);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('the insurer voucher pays the premium net of commission and VAT plus the EWT, which clears the premium due to the insurer', async () => {
    const m = await makePolicy({ net: 20000, insurer: 'PIONEER' });
    await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross });
    const r = await ctx.as('maker')('post', '/disbursements/insurer-remittance').send({ insurerName: 'PIONEER' });
    expect(r.status).toBe(201);
    const row = r.body.data.invoiceList.find((x) => x.policyNumber === m.policy.policy_number);
    const due = r2(m.gross - 3000 - 360 + 300);
    expect(row).toMatchObject({ comsub: 3000, vat: 360, wht: 300, totalAmount: due });
    const cb = await ctx.as('maker')('post', '/disbursements/checkbook').send({ mainAccount: '1102001', instrumentNo: '000901', totaleAmount: String(r.body.data.amount),
      disbursementId: r.body.data.disbursementId, invoiceListRefId: row.invoiceListId });
    expect(cb.status).toBe(201);
    const ap = await ctx.as('checker')('put', `/disbursements/checkbook/${cb.body.data.checkbookId}`).send({ status: 'Approved' });
    expect(ap.status).toBe(200);
    // the policy's line on the voucher is exactly what its booking credited to the premium due to the insurer
    const [rcv] = await booking(m.policy.id);
    const booked = (await query('SELECT sum(credit)::float AS c FROM journal_lines WHERE jv_id = $1 AND account_code = \'2201001\'', [rcv.booking_jv_id])).rows[0].c;
    expect(r2(booked)).toBe(due);
    const paid = (await query('SELECT sum(debit)::float AS d FROM journal_lines WHERE jv_id = $1 AND account_code = \'2201001\'', [ap.body.data.journalId])).rows[0].d;
    expect(r2(paid)).toBe(r2(r.body.data.amount));
  });

  it('a return premium reverses the commission taxes at the rates booked; bills booked without them return none', async () => {
    const m = await makePolicy({ net: 10000 });
    await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross });
    const out = await withTransaction(async (db) => returnPremium(db, { policy: await findPolicy(db, m.policy.id), amount: 1252.5, reference: 'END-CT-1' }));
    const lines = await linesOf(out.journalId);
    expect(lines).toEqual(expect.arrayContaining([['3201001', 150, 0], ['2204003', 18, 0], ['1302001', 0, 15], ['2201001', r2(1252.5 - 150 - 18 + 15), 0]]));

    await setSetting('accounting.broker_billed_commission_vat', false);
    await setSetting('accounting.broker_billed_commission_ewt', false);
    const old = await makePolicy({ net: 10000 });
    await ctx.as('maker')('post', '/receipts').send({ policyId: old.policy.id, amount: old.gross });
    await setSetting('accounting.broker_billed_commission_vat', true);
    await setSetting('accounting.broker_billed_commission_ewt', true);
    const back = await withTransaction(async (db) => returnPremium(db, { policy: await findPolicy(db, old.policy.id), amount: 1252.5, reference: 'END-CT-2' }));
    const codes = (await linesOf(back.journalId)).map((l) => l[0]);
    expect(codes).not.toContain('2204003');
    expect(codes).not.toContain('1302001');
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('co-insured: each insurer is billed VAT on, and withholds EWT from, its own commission', async () => {
    const { policy } = await makePolicy({ net: 10000 });
    const p = await findPolicy(pool, policy.id);
    const parts = [{ insurerId: 1, insurerName: 'Lead', share: 60, isLead: true, commissionRate: 0.15 }, { insurerId: 2, insurerName: 'Co', share: 40, isLead: false, commissionRate: 0.1 }];
    const split = await premiumSplit(pool, p, 10000, { netPremium: 10000 }, 'policy', { parts });
    expect(split.parts.map((x) => [x.amounts.commission, x.amounts.commission_vat, x.amounts.commission_ewt, x.amounts.due_to_insurer]))
      .toEqual([[900, 108, 90, 6000 - 900 - 108 + 90], [400, 48, 40, 4000 - 400 - 48 + 40]]);
    expect(split.commissionTaxes).toEqual({ commission_vat: 156, commission_ewt: 130 });
  });

  it('simulate shows the tax lines; rates and GL accounts follow the tax codes master', async () => {
    const sim = await ctx.as('maker')('post', '/posting-rules/simulate').send({ eventCode: 'policy.issue.broker_billed' });
    expect(sim.status).toBe(200);
    expect(sim.body.data.balanced).toBe(true);
    expect(sim.body.data.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual(expect.arrayContaining([['2204003', 0, 180], ['1302001', 150, 0]]));
    await query('UPDATE tax_codes SET gl_account = \'1301001\' WHERE code = \'WC139\'');
    const moved = await ctx.as('maker')('post', '/posting-rules/simulate').send({ eventCode: 'policy.issue.broker_billed' });
    expect(moved.body.data.lines.find((l) => l.debit === 150).accountCode).toBe('1301001');
    await query('UPDATE tax_codes SET gl_account = \'1302001\' WHERE code = \'WC139\'');
    expect(commissionTaxes(1000, { vat: 0.12, ewt: 0.15 })).toEqual({ commission_vat: 120, commission_ewt: 150 });
  });

  it('the set-up screen reads and changes the switches and tax codes', async () => {
    const g = await ctx.as('maker')('get', '/account-determination/commission-taxes');
    expect(g.status).toBe(200);
    expect(g.body.data.vat).toMatchObject({ enabled: true, code: 'VAT12-OUT', ratePercent: 12, glAccount: '2204003' });
    expect(g.body.data.ewt).toMatchObject({ enabled: true, code: 'WC139', ratePercent: 10, atc: 'WC139' });
    expect((await ctx.as('maker')('put', '/account-determination/commission-taxes').send({ ewtCode: 'WC140' })).status).toBe(403);
    expect((await ctx.api('put', '/account-determination/commission-taxes').send({ vatCode: 'WC139' })).status).toBe(400);
    const u = await ctx.api('put', '/account-determination/commission-taxes').send({ ewtCode: 'WC140' });
    expect(u.status).toBe(200);
    expect(u.body.data.ewt.ratePercent).toBe(15);
    await ctx.api('put', '/account-determination/commission-taxes').send({ ewtCode: 'WC139' });
  });
});
