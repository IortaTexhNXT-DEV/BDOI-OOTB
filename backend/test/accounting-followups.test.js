/**
 * Accounting follow-ups: comsub clawback / reversal on return premium, claim settlement cash (funds received from the
 * insurer, payment to the claimant) and refunds due from insurers netted against the next remittance.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ledgerIntegrity, makePolicy, setupFinance } from './accounting.fixtures.js';
import { one, pool, query, withTransaction } from '../src/db/pool.js';
import { adjustForReturnPremium } from '../src/modules/commission/service.js';
import { findPolicy, returnPremium } from '../src/modules/receipts/receivables.js';
import { createInsurerRemittance } from '../src/modules/disbursements/service.js';
import { postBrokerSettlement } from '../src/modules/claims/service.js';

let ctx; let admin;
beforeAll(async () => {
  ctx = await setupFinance();
  admin = await one("SELECT id, username FROM users WHERE username = 'BrokerVerse'");
});
afterAll(async () => { await pool.end(); });

const details = { commissionDetails: { brokeragePct: 18, productLabel: 'Motor', primary: { referrerId: 'ref-jdelacruz', level: 'L1', comsubPct: 8 }, chain: [{ referrerId: 'ref-mreyes', level: 'L2', comsubPct: 4 }] } };
const jvLines = (jvId) => query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY id', [jvId]).then((r) => r.rows.map((l) => ({ a: l.account_code, d: Number(l.debit), c: Number(l.credit) })));

describe('comsub follows a return premium', () => {
  let pol; let paid; let approved;
  it('prepares a paid and an approved comsub line', async () => {
    pol = await makePolicy({ net: 40000, details });
    expect((await ctx.as('maker')('post', '/commission/accrue').send({ policyId: pol.policy.id })).status).toBe(201);
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: pol.policy.id, amount: pol.gross })).status).toBe(201);
    const lines = (await query('SELECT * FROM commissions WHERE policy_id = $1 ORDER BY chain_position', [pol.policy.id])).rows;
    expect(lines.map((l) => l.status)).toEqual(['Eligible', 'Eligible']);
    for (const l of lines) expect((await ctx.as('checker')('post', `/commission/referrer-accounts/${l.referrer_id}/lines/${l.id}/approve`)).status).toBe(200);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${lines[0].referrer_id}/lines/${lines[0].id}/pay`)).status).toBe(200);
    [paid, approved] = (await query('SELECT * FROM commissions WHERE policy_id = $1 ORDER BY chain_position', [pol.policy.id])).rows;
    expect(paid.status).toBe('Paid');
    expect(approved.status).toBe('Approved');
  });

  it('a 25% return claws back 25% of the paid line and reverses 25% of the approved accrual through the posting rules', async () => {
    const r = await withTransaction((db) => adjustForReturnPremium(db, { policyId: pol.policy.id, returnedGross: pol.gross * 0.25, baseGross: pol.gross, reference: 'END-T-1', user: admin }));
    expect(r.ratio).toBe(0.25);
    const claw = r.adjustments.find((a) => a.kind === 'clawback');
    const rev = r.adjustments.find((a) => a.kind === 'reversal');
    expect(claw.amount).toBe(Math.round(Number(paid.amount) * 0.25 * 100) / 100);
    expect(await jvLines(claw.journalId)).toEqual([{ a: '1204001', d: claw.amount, c: 0 }, { a: '4401010', d: 0, c: claw.amount }]);
    expect(rev.amount).toBe(Math.round(Number(approved.amount) * 0.25 * 100) / 100);
    expect(await jvLines(rev.journalId)).toEqual([{ a: '4401010', d: 0, c: rev.amount }, { a: '2203001', d: rev.amount, c: 0 }]);
    const after = (await query('SELECT * FROM commissions WHERE id = $1', [approved.id])).rows[0];
    expect(Number(after.amount)).toBe(Math.round((Number(approved.amount) - rev.amount) * 100) / 100);
    expect((await query('SELECT status FROM commissions WHERE id = $1', [paid.id])).rows[0].status).toBe('Paid');
  });

  it('a later cancellation of the rest claws back only what is left and reverses the lines', async () => {
    const r = await withTransaction((db) => adjustForReturnPremium(db, { policyId: pol.policy.id, returnedGross: pol.gross * 0.75, baseGross: pol.gross * 0.75, reference: 'END-T-2', user: admin }));
    expect(r.ratio).toBe(1);
    const clawed = Number((await one('SELECT sum(amount) AS a FROM commission_adjustments WHERE commission_id = $1 AND kind = \'clawback\'', [paid.id])).a);
    expect(clawed).toBe(Number(paid.amount));
    const rows = (await query('SELECT status, clawback FROM commissions WHERE policy_id = $1 ORDER BY chain_position', [pol.policy.id])).rows;
    expect(rows).toEqual([{ status: 'Reversed', clawback: true }, { status: 'Reversed', clawback: false }]);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });
});

describe('claim settlement cash', () => {
  let claimId;
  it('books the settlement through the broker', async () => {
    const { policy } = await makePolicy({ net: 30000 });
    claimId = (await one(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, estimate_amount, settled_amount, settlement)
      VALUES ('CLM-T-CASH', $1, $2, 'settled', current_date - 5, 20000, 20000, '{"paidThroughBroker": true, "payee": "Test Claimant"}') RETURNING id`, [policy.id, policy.client_id])).id;
    const jv = await postBrokerSettlement(claimId, admin);
    expect(jv).toBeTruthy();
    const pos = (await ctx.api('get', `/claims/${claimId}/settlement-cash`)).body.data;
    expect(pos).toMatchObject({ canRecord: true, settlementAmount: 20000, totalRecoverable: 20000, totalReceived: 0, payableToClaimant: 20000 });
  });

  it('records funds received from the insurer into a bank account (claim.funds_received), never more than due', async () => {
    expect((await ctx.api('post', `/claims/${claimId}/settlement-cash/funds-received`).send({ amount: 25000, bankAccount: '1102001' })).status).toBe(409);
    expect((await ctx.as('claims')('post', `/claims/${claimId}/settlement-cash/funds-received`).send({ amount: 100, bankAccount: '1102001' })).status).toBe(403);
    const r = await ctx.as('maker')('post', `/claims/${claimId}/settlement-cash/funds-received`).send({ amount: 20000, bankAccount: '1102001', reference: 'RA-1' });
    expect(r.status).toBe(200);
    expect(await jvLines(r.body.data.journalId)).toEqual([{ a: '1102001', d: 20000, c: 0 }, { a: '1203005', d: 0, c: 20000 }]);
    expect(r.body.data.position).toMatchObject({ totalReceived: 20000 });
  });

  it('records the payment to the claimant (claim.paid_to_claimant), never more than payable', async () => {
    expect((await ctx.api('post', `/claims/${claimId}/settlement-cash/paid-to-claimant`).send({ amount: 20000.01, bankAccount: '1102001' })).status).toBe(409);
    const r = await ctx.as('maker')('post', `/claims/${claimId}/settlement-cash/paid-to-claimant`).send({ amount: 20000, bankAccount: '1102001', paymentMode: 'check', reference: 'PV-1 chq 0001' });
    expect(r.status).toBe(200);
    expect(await jvLines(r.body.data.journalId)).toEqual([{ a: '2205003', d: 20000, c: 0 }, { a: '1102001', d: 0, c: 20000 }]);
    expect(r.body.data.position).toMatchObject({ paidToClaimant: 20000, payableToClaimant: 0 });
    expect(r.body.data.position.movements).toHaveLength(2);
  });
});

describe('refund due from the insurer on premium already remitted', () => {
  let insurerId; let credit;
  it('raises a refund receivable for the remitted share of a return on paid premium', async () => {
    const { policy, gross } = await makePolicy({ net: 20000, insurer: 'PIONEER' });
    insurerId = policy.insurance_company_id;
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: policy.id, amount: gross })).status).toBe(201);
    const voucher = await withTransaction((db) => createInsurerRemittance(db, { insuranceCompanyId: insurerId, policyIds: [policy.id] }, admin));
    await query('UPDATE disbursements SET status = \'paid\' WHERE id = $1', [voucher.disbursementId || voucher.id]);
    const r = await withTransaction(async (db) => returnPremium(db, { policy: await findPolicy(db, policy.id), amount: 2000, kind: 'return-premium', reference: 'END-T-RP', user: admin }));
    expect(r.refund).toBe(2000);
    expect(r.insurerRefunds).toHaveLength(1);
    credit = r.insurerRefunds[0];
    expect(credit.amount).toBeGreaterThan(0);
    expect(credit.amount).toBeLessThan(2000); // the insurer's share, net of the broker's commission
    const list = (await ctx.as('maker')('get', `/remittance/insurer-credits?insurer=${insurerId}`)).body.data;
    expect(list.openBalance).toBe(credit.amount);
    const receivable = await one('SELECT COALESCE(sum(debit - credit), 0) AS b FROM journal_lines WHERE account_code = \'1203002\'');
    expect(Number(receivable.b)).toBe(credit.amount);
  });

  it('nets the refund against the next remittance voucher to the insurer', async () => {
    const { policy, gross } = await makePolicy({ net: 30000, insurer: 'PIONEER' });
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: policy.id, amount: gross })).status).toBe(201);
    const v = await withTransaction((db) => createInsurerRemittance(db, { insuranceCompanyId: insurerId, policyIds: [policy.id] }, admin));
    expect(v.refundsNetted).toBe(credit.amount);
    expect(Number(v.amount)).toBe(Math.round((v.grossRemittance - credit.amount) * 100) / 100);
    const c = await one('SELECT status, balance FROM insurer_refund_credits WHERE id = $1', [credit.id]);
    expect(c).toMatchObject({ status: 'applied' });
    expect(Number(c.balance)).toBe(0);
    const receivable = await one('SELECT COALESCE(sum(debit - credit), 0) AS b FROM journal_lines WHERE account_code = \'1203002\'');
    expect(Number(receivable.b)).toBe(0);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });
});
