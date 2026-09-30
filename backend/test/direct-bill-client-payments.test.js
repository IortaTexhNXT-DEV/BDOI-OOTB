/**
 * Direct bill: recording the client's payment to the insurer, its payment status on the Direct Bill Processing screen
 * and the direct_bill.client_payment_required check on the approval of a commission debit note.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { issuePolicy } from '../src/modules/policies/service.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

const setting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const journalCount = async (policyId) => (await query('SELECT count(*)::int AS n FROM journal_vouchers WHERE policy_id = $1', [policyId])).rows[0].n;

let seq = 0;
async function issueDirect(insurer = 'MALAYAN') {
  seq += 1;
  const client = (await query(`INSERT INTO clients(client_code, display_name, first_name, last_name, created_by) VALUES ($1,$2,'Direct','Payer','test') RETURNING *`,
    [`CL-DP-${Date.now().toString(36)}${seq}`, `Direct Payer ${seq}`])).rows[0];
  const ic = (await query('SELECT id FROM insurance_companies WHERE code = $1', [insurer])).rows[0];
  const product = (await query('SELECT id FROM products WHERE code = \'MOTOR\'')).rows[0];
  const r = await withTransaction((db) => issuePolicy(db, {
    clientId: client.id, insuranceCompanyId: ic.id, productId: product.id, sumInsured: 1000000, netPremium: 100000, grossPremium: 125250, commissionAmount: 15000,
    commissionRate: 0.15, currency: 'PHP', insuredName: client.display_name, productType: 'Private Car Comprehensive', lob: 'MOTOR', ownerUserId: ctx.userIds.sales,
  }, { billingMode: 'direct' }, ctx.userIds.maker));
  return (await query('SELECT * FROM policies WHERE id = $1', [r.policyId])).rows[0];
}

describe('client payment to the insurer on direct-bill policies', () => {
  let policy;
  let first;
  it('records a payment with the insurer reference and proof, without posting anything, and shows the payment status', async () => {
    policy = await issueDirect();
    const journals = await journalCount(policy.id);
    const items = await ctx.as('maker')('get', `/remittance/direct-bill/policies?insurerCode=MALAYAN&search=${policy.policy_number}`);
    expect(items.body.data[0]).toMatchObject({ policyNo: policy.policy_number, clientPaymentStatus: 'Unpaid', clientPaid: 0 });
    const r = await ctx.as('maker')('post', `/remittance/direct-bill/policies/${policy.id}/client-payments`)
      .send({ paymentDate: '2026-01-10', amount: 50000, insurerReference: 'MIC-OR-1001', paymentMode: 'bank-transfer', proofKey: '/api/s3/object/payment-proofs/or-1001.pdf', proofFileName: 'or-1001.pdf' });
    expect(r.status).toBe(201);
    first = r.body.data;
    expect(first).toMatchObject({ amount: 50000, insurerReference: 'MIC-OR-1001', status: 'recorded', proofFileName: 'or-1001.pdf' });
    expect(await journalCount(policy.id)).toBe(journals);
    const s = await ctx.as('maker')('get', `/remittance/direct-bill/policies/${policy.id}/client-payments`);
    expect(s.body.data).toMatchObject({ premium: 125250, paid: 50000, balance: 75250, status: 'partial', statusLabel: 'Partially paid', lastReference: 'MIC-OR-1001' });
    const again = await ctx.as('maker')('get', `/remittance/direct-bill/policies?insurerCode=MALAYAN&search=${policy.policy_number}`);
    expect(again.body.data[0]).toMatchObject({ clientPaymentStatus: 'Partially paid', clientPaid: 50000 });
  });

  it('validates the entry', async () => {
    const post = (id, body) => ctx.as('maker')('post', `/remittance/direct-bill/policies/${id}/client-payments`).send(body);
    expect((await post(policy.id, { paymentDate: '2026-01-11', amount: 10, insurerReference: 'mic-or-1001' })).status).toBe(409);
    expect((await post(policy.id, { paymentDate: '2099-01-01', amount: 10, insurerReference: 'X-2' })).status).toBe(400);
    expect((await post(policy.id, { paymentDate: '2026-01-11', amount: 0, insurerReference: 'X-2' })).status).toBe(400);
    expect((await post(policy.id, { paymentDate: '2026-01-11', amount: 10 })).status).toBe(400);
    const broker = await makePolicy({ net: 1000 });
    expect((await post(broker.policy.id, { paymentDate: '2026-01-11', amount: 10, insurerReference: 'X-3' })).status).toBe(409);
    expect((await ctx.as('sales')('post', `/remittance/direct-bill/policies/${policy.id}/client-payments`).send({ paymentDate: '2026-01-11', amount: 10, insurerReference: 'X-4' })).status).toBe(403);
  });

  it('with client_payment_required = full a debit note waits until its policies are paid in full', async () => {
    await setting('direct_bill.client_payment_required', 'full');
    const item = (await query('SELECT id FROM direct_bill_items WHERE policy_id = $1', [policy.id])).rows[0];
    const dn = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'MALAYAN', itemIds: [item.id], submit: true });
    expect(dn.status).toBe(201);
    const refused = await ctx.as('checker')('post', `/remittance/direct-bill/${dn.body.data.id}/approve`).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.message).toContain(policy.policy_number);
    await ctx.as('maker')('post', `/remittance/direct-bill/policies/${policy.id}/client-payments`).send({ paymentDate: '2026-02-10', amount: 75250, insurerReference: 'MIC-OR-1002' });
    const ok = await ctx.as('checker')('post', `/remittance/direct-bill/${dn.body.data.id}/approve`).send({});
    expect(ok.status).toBe(200);
    const view = await ctx.as('maker')('get', `/remittance/direct-bill/${dn.body.data.id}`);
    expect(view.body.data.lines[0]).toMatchObject({ clientPaymentStatus: 'Paid', clientPaid: 125250 });
  });

  it('with any, one recorded payment is enough; a voided payment no longer counts', async () => {
    await setting('direct_bill.client_payment_required', 'any');
    const p = await issueDirect();
    const pay = await ctx.as('maker')('post', `/remittance/direct-bill/policies/${p.id}/client-payments`).send({ paymentDate: '2026-03-01', amount: 1000, insurerReference: 'ANY-1' });
    const v = await ctx.as('maker')('post', `/remittance/direct-bill/client-payments/${pay.body.data.id}/void`).send({ reason: 'Entered on the wrong policy' });
    expect(v.status).toBe(200);
    expect(v.body.data.status).toBe('voided');
    const item = (await query('SELECT id FROM direct_bill_items WHERE policy_id = $1', [p.id])).rows[0];
    const dn = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'MALAYAN', itemIds: [item.id], submit: true });
    expect((await ctx.as('checker')('post', `/remittance/direct-bill/${dn.body.data.id}/approve`).send({})).status).toBe(409);
    await ctx.as('maker')('post', `/remittance/direct-bill/policies/${p.id}/client-payments`).send({ paymentDate: '2026-03-02', amount: 1000, insurerReference: 'ANY-2' });
    expect((await ctx.as('checker')('post', `/remittance/direct-bill/${dn.body.data.id}/approve`).send({})).status).toBe(200);
    const list = await ctx.as('maker')('get', '/remittance/direct-bill/client-payments?search=ANY-');
    expect(list.body.data.map((x) => [x.insurerReference, x.status])).toEqual(expect.arrayContaining([['ANY-1', 'voided'], ['ANY-2', 'recorded']]));
    await setting('direct_bill.client_payment_required', 'none');
  });
});
