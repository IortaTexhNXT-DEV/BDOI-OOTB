/**
 * Unapplied collections (migration 0529; TIS-BRD-COLL-04, PBSM-M15-COL-SLA): a payment above what the policy owes is
 * held On Account instead of raising a bill; floating and advance payments are recorded; each is allocated to open
 * bills or refunded with a reason; a reversed receipt takes its hold back; My Work lists what is to allocate.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { findPolicy, createReceivable } from '../src/modules/receipts/receivables.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { allocateBy } from '../src/modules/receipts/unapplied.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

/** A policy with one open bill of its gross premium. */
async function billed(net = 4000) {
  const made = await makePolicy({ net });
  const pol = await findPolicy(pool, made.policy.id);
  const bill = await createReceivable(pool, { policy: pol, amount: made.gross, source: 'policy' });
  return { ...made, bill };
}
const maker = () => ctx.as('maker');
const linesOf = async (jvId) => (await query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId])).rows;

describe('unapplied collections', () => {
  it('holds an overpayment On Account, posted to unapplied collections, and allocates it to another bill of the client', async () => {
    const a = await billed();
    const r = await maker()('post', '/receipts').send({ policyId: a.policy.id, amount: a.gross + 1500, paymentMode: 'bank-transfer', referenceNo: 'BDO-OVR-1' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [a.policy.id])).rows[0].n).toBe(1);
    const list = (await maker()('get', '/receipts/unapplied?status=open')).body.data;
    const held = list.rows.find((u) => u.receiptNumber === r.body.data.receiptNumber);
    expect(held).toMatchObject({ kind: 'excess', amount: 1500, balance: 1500, policyNumber: a.policy.policy_number, overdue: false });
    expect(held.allocateBy).toBe(await allocateBy(held.receivedDate));
    const hold = (await query('SELECT journal_id FROM unapplied_collections WHERE id = $1', [held.id])).rows[0];
    expect((await linesOf(hold.journal_id)).find((l) => Number(l.credit) === 1500).account_code).toBe('2202001');

    const work = await maker()('get', '/my-work/items?category=collections&scope=all');
    expect(JSON.stringify(work.body)).toContain(r.body.data.receiptNumber);

    const pol2 = await findPolicy(pool, (await query("INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount) SELECT 'POL-UAC-2', client_id, product_id, insurance_company_id, 'active', inception_date, expiry_date, 1000, 0 FROM policies WHERE id = $1 RETURNING id", [a.policy.id])).rows[0].id);
    const bill2 = await createReceivable(pool, { policy: pol2, amount: 1000, source: 'policy' });
    const other = await billed(1000);
    expect((await maker()('post', `/receipts/unapplied/${held.id}/allocate`).send({ allocations: [{ receivableId: other.bill.id, amount: 100 }] })).status).toBe(400);
    expect((await maker()('post', `/receipts/unapplied/${held.id}/allocate`).send({ allocations: [{ receivableId: bill2.id, amount: 1600 }] })).status).toBe(400);
    const done = await maker()('post', `/receipts/unapplied/${held.id}/allocate`).send({ allocations: [{ receivableId: bill2.id, amount: 1000 }] });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.data).toMatchObject({ status: 'open', balance: 500, allocations: [expect.objectContaining({ billNumber: bill2.bill_number, amount: 1000 })] });
    expect((await query('SELECT status, balance FROM receivables WHERE id = $1', [bill2.id])).rows[0]).toMatchObject({ status: 'paid' });
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });

    expect((await maker()('post', `/receipts/unapplied/${held.id}/refund`).send({ reasonCode: 'UAC-REF-OTHER' })).status).toBe(400);
    const refund = await maker()('post', `/receipts/unapplied/${held.id}/refund`).send({ reasonCode: 'UAC-REF-OVERPAID' });
    expect(refund.status, JSON.stringify(refund.body)).toBe(200);
    expect(refund.body.data).toMatchObject({ status: 'refunded', balance: 0, refundReason: 'Overpayment' });
    const rj = (await query('SELECT refund_journal_id FROM unapplied_collections WHERE id = $1', [held.id])).rows[0];
    expect((await linesOf(rj.refund_journal_id)).find((l) => Number(l.credit) === 500).account_code).toBe('210230');
  });

  it('records a floating payment and sets its client from the bill it pays; an advance needs its client', async () => {
    expect((await maker()('post', '/receipts/unapplied').send({ kind: 'advance', amount: 800 })).status).toBe(400);
    expect((await maker()('post', '/receipts/unapplied').send({ kind: 'floating', amount: 800 })).status).toBe(400);
    expect((await ctx.as('agent')('post', '/receipts/unapplied').send({ kind: 'floating', amount: 800, referenceNo: 'MBT-1' })).status).toBe(403);
    const f = await maker()('post', '/receipts/unapplied').send({ kind: 'floating', amount: 800, referenceNo: 'MBT-0099812', payerName: 'Unknown depositor' });
    expect(f.status, JSON.stringify(f.body)).toBe(201);
    expect(f.body.data).toMatchObject({ kind: 'floating', clientId: null, balance: 800 });
    const c = await billed(1000);
    const done = await maker()('post', `/receipts/unapplied/${f.body.data.id}/allocate`).send({ allocations: [{ receivableId: c.bill.bill_number, amount: 800 }] });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.data).toMatchObject({ status: 'allocated', clientId: c.policy.client_id });
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('a reversed receipt takes its hold back; with excess_handling bill the overpayment is billed as before', async () => {
    const a = await billed();
    const r = await maker()('post', '/receipts').send({ policyId: a.policy.id, amount: a.gross + 300, paymentMode: 'cash' });
    await maker()('post', `/receipts/${r.body.data.receiptId}/reversal`).send({ reasonCode: 'RCT-REV-DUPLICATE' });
    expect((await ctx.api('post', `/receipts/${r.body.data.receiptId}/reversal/decision`).send({ action: 'approve' })).status).toBe(200);
    expect((await query('SELECT status, balance FROM unapplied_collections WHERE receipt_id = $1', [r.body.data.receiptId])).rows[0]).toMatchObject({ status: 'reversed' });
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });

    await query("UPDATE app_settings SET value = '\"bill\"' WHERE key = 'receipts.excess_handling'");
    clearSettingsCache();
    const b = await billed();
    await maker()('post', '/receipts').send({ policyId: b.policy.id, amount: b.gross + 300, paymentMode: 'cash' });
    expect((await query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [b.policy.id])).rows[0].n).toBe(2);
    await query("UPDATE app_settings SET value = '\"on-account\"' WHERE key = 'receipts.excess_handling'");
    clearSettingsCache();
  });
});
