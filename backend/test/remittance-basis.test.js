/**
 * Remittance basis per insurer and product (migration 0344, FGA.09): net by default (the booking credits commission
 * income and the insurer is paid the premium net of commission); gross by rule (the premium is due to the insurer in full,
 * the commission is billed on a billing statement that posts on approval, the insurer voucher pays the whole premium).
 * Also the TISPH accounts of the premium payable (seed 81_tisph_finance.sql: the placeholder Accounts Payable - Insurance
 * Company).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { matchBasis } from '../src/modules/remittance/basis.js';
import { findPolicy, returnPremium } from '../src/modules/receipts/receivables.js';
import { eligiblePolicies } from '../src/modules/remittance/service.js';
import { subledgerTieOut } from '../src/modules/period-end/tieout.js';
import { withoutConfigurationApproval } from './helpers.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); await withoutConfigurationApproval(); });
afterAll(async () => { await pool.end(); });

const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const linesOf = async (jvId) => (await query('SELECT account_code AS a, debit::float AS d, credit::float AS c FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId])).rows;
const bills = async (policyId) => (await query('SELECT * FROM receivables WHERE policy_id = $1 ORDER BY created_at', [policyId])).rows;
const items = async (policyId) => (await query('SELECT * FROM direct_bill_items WHERE policy_id = $1 ORDER BY created_at', [policyId])).rows;

describe('remittance basis rules', () => {
  it('takes the most specific rule, else the default basis', () => {
    const rules = [{ insurer: 'MALAYAN', basis: 'gross' }, { insurer: 'MALAYAN', product: 'PA', basis: 'net' }, { product: 'TRAVEL', basis: 'gross' }, { insurer: 'AXA', basis: 'other' }];
    expect(matchBasis(rules, 'net', { insurer: 'MALAYAN', product: 'MOTOR' })).toBe('gross');
    expect(matchBasis(rules, 'net', { insurer: 'malayan', product: 'pa' })).toBe('net');
    expect(matchBasis(rules, 'net', { insurer: 'PIONEER', product: 'TRAVEL' })).toBe('gross');
    expect(matchBasis(rules, 'net', { insurer: 'AXA', product: 'MOTOR' })).toBe('net');
    expect(matchBasis([], 'gross', { insurer: 'AXA', product: 'MOTOR' })).toBe('gross');
    expect(matchBasis(null, undefined, { insurer: 'AXA' })).toBe('net');
  });

  it('defaults to net and books the premium payable on the TISPH placeholder account', async () => {
    expect((await query("SELECT value FROM app_settings WHERE key = 'remittance.default_basis'")).rows[0].value).toBe('net');
    const [acct] = (await query("SELECT name, account_type, is_open_item FROM gl_accounts WHERE code = '210245'")).rows;
    expect(acct).toMatchObject({ name: 'Accounts Payable - Insurance Company (placeholder)', account_type: 'liability', is_open_item: true });
    const roles = (await query("SELECT key, value #>> '{}' AS v FROM app_settings WHERE key IN ('accounting.account.due_to_insurer', 'accounting.account.premium_vat_payable', 'accounting.account.premium_dst_payable', 'accounting.account.premium_lgt_payable') ORDER BY key")).rows;
    expect(roles.map((r) => r.v)).toEqual(['210245', '210245', '210245', '210245']);
    expect((await query("SELECT value->>'Insurer' AS v FROM app_settings WHERE key = 'accounting.payable_account_by_payee'")).rows[0].v).toBe('210245');
    const m = await makePolicy({ net: 10000 });
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross })).status).toBe(201);
    const [rcv] = await bills(m.policy.id);
    expect(rcv.remittance_basis).toBe('net');
    expect(Number(rcv.commission_amount)).toBe(1500);
    const lines = await linesOf(rcv.booking_jv_id);
    expect(lines.find((l) => l.a === '3201001')).toMatchObject({ c: 1500 });
    expect(lines.find((l) => l.a === '210245').c).toBe(12525 - 1500 - 180 + 150);
    expect(await items(m.policy.id)).toHaveLength(0);
  });
});

describe('gross remittance', () => {
  let m;
  let statement;
  beforeAll(async () => {
    await setSetting('remittance.basis_rules', [{ insurer: 'MALAYAN', product: 'MOTOR', basis: 'gross' }]);
    m = await makePolicy({ net: 10000 });
  });
  afterAll(async () => { await setSetting('remittance.basis_rules', []); });

  it('books the whole premium as payable to the insurer and the commission as an unbilled item without a journal', async () => {
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross })).status).toBe(201);
    const [rcv] = await bills(m.policy.id);
    expect(rcv).toMatchObject({ remittance_basis: 'gross' });
    expect([Number(rcv.commission_amount), Number(rcv.commission_vat), Number(rcv.commission_ewt)]).toEqual([0, 0, 0]);
    expect(await linesOf(rcv.booking_jv_id)).toEqual([{ a: '1202001', d: 12525, c: 0 }, { a: '210245', d: 0, c: 12525 }]);
    const [it] = await items(m.policy.id);
    expect(it).toMatchObject({ basis: 'gross', status: 'unbilled', booking_jv_id: null, reference: rcv.bill_number });
    expect([Number(it.commission), Number(it.vat), Number(it.amount)]).toEqual([1500, 180, 1680]);
    // collected premium: Dr Cash / Cr Premium Receivable, so the premium sits on Accounts Payable - Insurance Company (FGA.09)
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });

  it('remits the whole premium collected and shows no commission on the remittance lines', async () => {
    const pols = await eligiblePolicies({ insurerId: m.policy.insurance_company_id, policyIds: [m.policy.id] });
    expect(pols[0]).toMatchObject({ gross_billed: true });
    expect(Number(pols[0].commission_amount)).toBe(0);
    const v = await ctx.as('maker')('post', '/disbursements/insurer-remittance').send({ insuranceCompanyId: m.policy.insurance_company_id, policyIds: [m.policy.id] });
    expect(v.status, JSON.stringify(v.body)).toBe(201);
    expect(Number(v.body.data.amount)).toBe(12525);
  });

  it('bills the commission on a billing statement that posts when a second user approves it', async () => {
    const [it] = await items(m.policy.id);
    const unbilled = await ctx.as('maker')('get', '/remittance/direct-bill/policies?insurerCode=MALAYAN&basis=gross');
    expect(unbilled.body.data.find((x) => x.id === it.id)).toMatchObject({ basis: 'gross', totalDue: 1680 });
    const raised = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'MALAYAN', itemIds: [it.id], submit: true });
    expect(raised.status, JSON.stringify(raised.body)).toBe(201);
    statement = raised.body.data;
    expect(statement).toMatchObject({ basis: 'gross', documentType: 'Billing Statement', statusCode: 'for-approval', amount: 1680, journalNumber: null });
    expect(statement.dnNumber).toMatch(/^CBS-\d{4}-\d{5}$/);
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${statement.id}/approve`).send({})).status).toBe(403);
    // a billing statement is approved only when the insurer has a TIN (FRS FR-RMT-021)
    const noTin = await ctx.as('checker')('post', `/remittance/direct-bill/${statement.id}/approve`).send({});
    expect(noTin.status).toBe(409);
    expect(noTin.body.message).toMatch(/has no TIN/);
    await query("UPDATE insurance_companies SET tin = '000-123-456-000' WHERE code = 'MALAYAN'");
    const ok = await ctx.as('checker')('post', `/remittance/direct-bill/${statement.id}/approve`).send({});
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data).toMatchObject({ statusCode: 'open' });
    const jv = (await query('SELECT j.*, p.event_code FROM commission_debit_notes d JOIN journal_vouchers j ON j.id = d.journal_id JOIN posting_rules p ON p.id = j.posting_rule_id WHERE d.id = $1',
      [statement.id])).rows[0];
    expect(jv).toMatchObject({ event_code: 'commission.billing_statement', status: 'posted', transaction_code: statement.dnNumber });
    expect(await linesOf(jv.id)).toEqual([{ a: '110400', d: 1680, c: 0 }, { a: '3201001', d: 0, c: 1500 }, { a: '235000', d: 0, c: 180 }]);
    const pdf = await ctx.as('maker')('get', `/remittance/direct-bill/${statement.id}/pdf`);
    expect(pdf.status).toBe(200);
    // the commission receivable sub-ledger follows the GL: the unbilled gross item and the statement awaiting approval were not in it
    const tie = (await withTransaction((db) => subledgerTieOut(db))).find((r) => r.ledger === 'Commission receivable');
    expect(tie.difference).toBe(0);
  });

  it('refuses a statement mixing gross-remittance and direct-bill commission', async () => {
    const d = await makePolicy({ net: 4000 });
    await query('UPDATE policies SET billing_mode = \'direct\' WHERE id = $1', [d.policy.id]);
    const { bookDirectBill } = await import('../src/modules/remittance/directbill.js');
    const direct = await withTransaction(async (db) => bookDirectBill(db, { policy: await findPolicy(db, d.policy.id), amount: 5010, breakdown: { netPremium: 4000 }, user: { id: ctx.userIds.maker } }));
    const g = await makePolicy({ net: 2000 });
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: g.policy.id, amount: g.gross })).status).toBe(201);
    const [gross] = await items(g.policy.id);
    const r = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'MALAYAN', itemIds: [direct.id, gross.id] });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/billing statement separately/);
    const dn = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'MALAYAN', basis: 'direct', itemIds: [direct.id] });
    expect(dn.body.data.dnNumber).toMatch(/^DN-/);
  });

  it('collects the statement with creditable withholding tax and reverses an approved statement on cancellation', async () => {
    const c = await ctx.as('maker')('post', `/remittance/direct-bill/${statement.id}/collections`).send({ cashAmount: 1455, ewtAmount: 225, paymentMode: 'bank-transfer', referenceNo: 'MIC-1' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    expect(c.body.data).toMatchObject({ statusCode: 'collected', balance: 0 });
    expect(await linesOf(c.body.data.collection.journalId)).toEqual([{ a: '106010', d: 1455, c: 0 }, { a: '1302001', d: 225, c: 0 }, { a: '110400', d: 0, c: 1680 }]);
    // a second statement, approved then cancelled before collection: its journal is reversed and the commission unbilled again
    const g = await makePolicy({ net: 6000 });
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: g.policy.id, amount: g.gross })).status).toBe(201);
    const [it] = await items(g.policy.id);
    const s2 = (await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'MALAYAN', itemIds: [it.id], submit: true })).body.data;
    expect((await ctx.as('checker')('post', `/remittance/direct-bill/${s2.id}/approve`).send({})).status).toBe(200);
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${s2.id}/cancel`).send({})).status).toBe(400);
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${s2.id}/cancel`).send({ reasonCode: 'BRJ-INSURER' })).status).toBe(400);
    const x = await ctx.as('maker')('post', `/remittance/direct-bill/${s2.id}/cancel`).send({ reasonCode: 'BCN-INSURER' });
    expect(x.status, JSON.stringify(x.body)).toBe(200);
    expect(x.body.data.remarks).toBe('Wrong insurer or product line');
    const row = (await query('SELECT d.journal_id, d.reversal_jv_id, j.status AS original, r.reversal_of FROM commission_debit_notes d JOIN journal_vouchers j ON j.id = d.journal_id JOIN journal_vouchers r ON r.id = d.reversal_jv_id WHERE d.id = $1', [s2.id])).rows[0];
    expect(row).toMatchObject({ original: 'reversed', reversal_of: row.journal_id });
    expect((await items(g.policy.id))[0].status).toBe('unbilled');
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });

  it('a return premium gives back the whole premium due to the insurer and credits the commission on the next statement', async () => {
    const r = await withTransaction(async (db) => returnPremium(db, { policy: await findPolicy(db, m.policy.id), amount: 2505, reference: 'END-G-1', user: { id: ctx.userIds.maker } }));
    const lines = await linesOf(r.journalId);
    expect(lines.find((l) => l.a === '210245')).toMatchObject({ d: 2505 });
    expect(lines.some((l) => l.a === '3201001')).toBe(false);
    const credit = (await items(m.policy.id)).find((i) => Number(i.amount) < 0);
    expect(credit).toMatchObject({ basis: 'gross', status: 'unbilled', reference: 'END-G-1' });
    expect([Number(credit.gross_premium), Number(credit.commission), Number(credit.vat)]).toEqual([-2505, -300, -36]);
  });

  it('a cancellation credits the commission computed on the net premium returned, not the share of the gross', async () => {
    // net 10,000 returned in full: the taxes kept (DST) do not reduce the commission taken back (1,500)
    const r = await withTransaction(async (db) => returnPremium(db, { policy: await findPolicy(db, m.policy.id), amount: 11275, kind: 'cancellation',
      breakdown: { netPremium: 10000, vat: 1200, lgt: 75, commissionAmount: 1500 }, reference: 'END-G-2', user: { id: ctx.userIds.maker } }));
    expect(r.amount).toBe(11275);
    const credit = (await items(m.policy.id)).find((i) => i.reference === 'END-G-2');
    expect(Number(credit.commission)).toBe(-1200);
  });
});
