import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { createReceivable, accrueCommission } from '../src/modules/policies/service.js';

let ctx;
let pol;
let bill;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const journals = async () => (await q('SELECT count(*)::int AS n FROM journal_vouchers'))[0].n;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  ctx = await setupFinance();
  pol = await makePolicy({ net: 10000, owner: ctx.userIds.agent });
  bill = await withTransaction((db) => createReceivable(db, { policyId: pol.policy.id, amount: pol.gross, user: { id: ctx.userIds.agent } }));
});
afterAll(async () => { await pool.end(); });

describe('policy payment capture (no mock payment)', () => {
  let captureId;

  it('the bill raised at issuance stays open until a payment is confirmed', async () => {
    const s = await ctx.as('agent')('get', `/policies/${pol.policy.id}/payments`);
    expect(s.status).toBe(200);
    expect(s.body.data.outstanding).toBeCloseTo(pol.gross, 2);
    expect(s.body.data.canConfirm).toBe(false);
    expect(s.body.data.gateway.enabled).toBe(false);
    expect(s.body.data.modes.map((m) => m.value)).toEqual(['bank-transfer', 'check', 'online', 'cash']);
    const later = await ctx.as('agent')('post', `/policies/${pol.policy.id}/payments`).send({ option: 'pay-later' });
    expect(later.status).toBe(200);
    const [r] = await q('SELECT * FROM receivables WHERE id = $1', [bill.id]);
    expect(r.status).toBe('open');
    expect(Number(r.balance)).toBeCloseTo(pol.gross, 2);
  });

  it('validates the capture: reference, amount within the balance, date not in the future', async () => {
    const api = ctx.as('agent');
    const base = { option: 'payment', paymentMode: 'bank-transfer', referenceNo: 'BDO-778812', amount: pol.gross, paymentDate: today };
    expect((await api('post', `/policies/${pol.policy.id}/payments`).send({ ...base, referenceNo: '' })).status).toBe(400);
    expect((await api('post', `/policies/${pol.policy.id}/payments`).send({ ...base, amount: pol.gross + 1 })).status).toBe(400);
    expect((await api('post', `/policies/${pol.policy.id}/payments`).send({ ...base, paymentDate: '2999-01-01' })).status).toBe(400);
    expect((await api('post', `/policies/${pol.policy.id}/payments`).send({ ...base, paymentMode: 'mock' })).status).toBe(400);
  });

  it("a non-finance user's capture is recorded for verification and posts no receipt or journal", async () => {
    const before = await journals();
    const r = await ctx.as('agent')('post', `/policies/${pol.policy.id}/payments`).send({
      option: 'payment', paymentMode: 'bank-transfer', referenceNo: 'BDO-778812', amount: pol.gross, paymentDate: today, proofKey: 'payment-proofs/slip.jpg', proofFileName: 'slip.jpg',
    });
    expect(r.status).toBe(201);
    expect(r.body.data.posted).toBe(false);
    expect(r.body.data.receipt).toBeNull();
    expect(r.body.data.capture.status).toBe('submitted');
    captureId = r.body.data.capture.id;
    expect(await journals()).toBe(before);
    expect((await q('SELECT count(*)::int AS n FROM receipts WHERE policy_id = $1', [pol.policy.id]))[0].n).toBe(0);
    const [rcv] = await q('SELECT * FROM receivables WHERE id = $1', [bill.id]);
    expect(Number(rcv.balance)).toBeCloseTo(pol.gross, 2);
    expect((await q('SELECT payment_status FROM policies WHERE id = $1', [pol.policy.id]))[0].payment_status).toBe('Reviewing');
    // a second capture cannot exceed what is left after payments awaiting verification
    expect((await ctx.as('agent')('post', `/policies/${pol.policy.id}/payments`).send({ option: 'payment', paymentMode: 'cash', amount: 1, paymentDate: today })).status).toBe(400);
    // finance is told there is something to verify
    const n = await q("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND title = 'Premium payment to verify'", [ctx.userIds.maker]);
    expect(n[0].n).toBe(1);
    // the agent cannot confirm it
    expect((await ctx.as('agent')('post', `/policies/${pol.policy.id}/payments/${captureId}/confirm`)).status).toBe(403);
  });

  it('finance confirms the capture: official receipt against the bill, journal posted, policy Completed', async () => {
    const list = await ctx.as('maker')('get', '/policies/payment-captures');
    expect(list.body.data.map((c) => c.id)).toContain(captureId);
    const before = await journals();
    const r = await ctx.as('maker')('post', `/policies/${pol.policy.id}/payments/${captureId}/confirm`);
    expect(r.status).toBe(200);
    expect(r.body.data.receipt.receiptNumber).toMatch(/^OR-/);
    expect(r.body.data.capture.status).toBe('confirmed');
    expect(await journals()).toBeGreaterThan(before);
    const [rcv] = await q('SELECT * FROM receivables WHERE id = $1', [bill.id]);
    expect(Number(rcv.balance)).toBe(0);
    expect((await q('SELECT payment_status FROM policies WHERE id = $1', [pol.policy.id]))[0].payment_status).toBe('Completed');
    expect((await ctx.as('maker')('post', `/policies/${pol.policy.id}/payments/${captureId}/confirm`)).status).toBe(409);
    const integrity = await ledgerIntegrity();
    expect(integrity.unbalanced).toBe(0);
  });

  it('every capture has an acknowledgement receipt number and a printable acknowledgement receipt', async () => {
    const s = await ctx.as('agent')('get', `/policies/${pol.policy.id}/payments`);
    const capture = s.body.data.captures.find((c) => c.id === captureId);
    expect(capture.arNumber).toMatch(/^AR-\d{4}-\d{5}$/);
    const binary = (res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); };
    const pdf = await ctx.as('agent')('get', `/document-templates/acknowledgement-receipt/${captureId}`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/);
    const text = pdf.body.toString('latin1');
    expect(text).toContain('(Acknowledgment Receipt)');
    expect(text).toContain(capture.arNumber);
    expect(text).toContain(`(${pol.policy.policy_number})`);
    expect(text).toContain('(Received by)');
    // a payment recorded before acknowledgement receipts were numbered is numbered on its first print
    await q('UPDATE policy_payments SET ar_number = NULL WHERE id = $1', [captureId]);
    const again = await ctx.as('agent')('get', `/document-templates/acknowledgement-receipt/${captureId}`).buffer(true).parse(binary);
    expect(again.status).toBe(200);
    expect((await q('SELECT ar_number FROM policy_payments WHERE id = $1', [captureId]))[0].ar_number).toMatch(/^AR-/);
    expect((await ctx.as('agent')('get', '/document-templates/acknowledgement-receipt/pp_missing')).status).toBe(404);
  });

  it('finance can reject a capture; a finance capture is confirmed at once', async () => {
    const p2 = await makePolicy({ net: 4000, owner: ctx.userIds.agent });
    await withTransaction((db) => createReceivable(db, { policyId: p2.policy.id, amount: p2.gross, user: { id: ctx.userIds.agent } }));
    const c = await ctx.as('agent')('post', `/policies/${p2.policy.id}/payments`).send({ option: 'payment', paymentMode: 'check', referenceNo: 'CHK-001', amount: 1000, paymentDate: today });
    const rej = await ctx.as('maker')('post', `/policies/${p2.policy.id}/payments/${c.body.data.capture.id}/reject`).send({ reason: 'Cheque not received' });
    expect(rej.body.data.capture.status).toBe('rejected');
    expect((await q('SELECT payment_status FROM policies WHERE id = $1', [p2.policy.id]))[0].payment_status).toBe('Pending');
    const fin = await ctx.as('maker')('post', `/policies/${p2.policy.id}/payments`).send({ option: 'payment', paymentMode: 'bank-transfer', referenceNo: 'BPI-1', amount: 1000, paymentDate: today });
    expect(fin.status).toBe(201);
    expect(fin.body.data.posted).toBe(true);
    expect((await q('SELECT payment_status FROM policies WHERE id = $1', [p2.policy.id]))[0].payment_status).toBe('Partial');
  });
});

describe('commission accrues only to producers (Sales & Marketing) and referrers', () => {
  it('no commission line for an administrator who issues a policy; an Account Executive earns one', async () => {
    const adminId = (await q("SELECT id FROM users WHERE username = 'BrokerVerse'"))[0].id;
    const p = await makePolicy({ net: 10000, owner: adminId });
    const none = await withTransaction((db) => accrueCommission(db, { policyId: p.policy.id, agentUserId: adminId, basis: 10000, rate: 0.15, period: '2026-09' }));
    expect(none).toBeNull();
    const line = await withTransaction((db) => accrueCommission(db, { policyId: p.policy.id, agentUserId: ctx.userIds.sales, basis: 10000, rate: 0.15, period: '2026-09' }));
    expect(Number(line.amount)).toBe(1500);
    // no referrer account for the administrator after seeding, and one linked to an administrator is not listed
    const list = await ctx.as('maker')('get', '/commission/referrer-accounts');
    expect(list.body.data.referrers.some((r) => /Administrator/.test(r.name))).toBe(false);
    await ctx.as('maker')('post', '/commission/referrer-accounts').send({ id: 'ref-admin-test', name: 'Admin Linked', userId: adminId, bankName: 'BDO', bankAccountNo: '0011' });
    const again = await ctx.as('maker')('get', '/commission/referrer-accounts');
    expect(again.body.data.referrers.some((r) => r.id === 'ref-admin-test')).toBe(false);
  });

  it('a referrer without a bank account cannot be approved or paid out; the account shows the configured WHT rate', async () => {
    const c = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Nobank Referrer', type: 'Agent', level: 'L1' });
    const ref = c.body.data.referrer.id;
    expect(c.body.data.referrer.bankAccountMissing).toBe(true);
    expect(c.body.data.referrer.payoutBlockedReason).toContain('no bank account');
    expect(c.body.data.referrer.whtPct).toBe(5);
    expect(c.body.data.referrer.whtType).toBe('Individual 5%');
    const p = await makePolicy({ net: 20000, details: { commissionDetails: { brokeragePct: 18, primary: { referrerId: ref, level: 'L1', comsubPct: 8 }, chain: [] } } });
    await ctx.as('maker')('post', '/commission/accrue').send({ policyId: p.policy.id });
    await q("UPDATE commissions SET status = 'Eligible', eligible_at = now() WHERE referrer_id = $1", [ref]);
    const ap = await ctx.as('checker')('post', `/commission/referrer-accounts/${ref}/approve`);
    expect(ap.status).toBe(409);
    expect(ap.body.message).toContain('no bank account');
    await q("UPDATE commissions SET status = 'Approved', approved_at = now() WHERE referrer_id = $1", [ref]);
    const gp = await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/generate-payout`);
    expect(gp.status).toBe(409);
    expect(gp.body.message).toContain('no bank account');
    const [lineId] = (await q('SELECT id FROM commissions WHERE referrer_id = $1', [ref])).map((x) => x.id);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/pay-lines`).send({ lineIds: [lineId] })).status).toBe(409);
    // once the bank account is on file the payout proceeds
    await ctx.as('maker')('put', `/commission/referrer-accounts/${ref}`).send({ bankName: 'BPI', bankAccountNo: '3179000011' });
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${ref}/generate-payout`)).status).toBe(200);
  });
});
