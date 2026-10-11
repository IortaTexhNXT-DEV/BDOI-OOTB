/**
 * Receipt reversal with a checker (migration 0524; PBSM-M17v4-REVERSALS, TIS-BRD-COLL-06): requested with a reason by a
 * holder of reverse:receipts (CCD-Recon, not CCD-BP), approved or returned by another holder of
 * approve:receipt-reversal; the receipt stays posted until approved; without the approval setting it is reversed at once.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { createReceivable } from '../src/modules/receipts/receivables.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx; let recon; let recon2; let bp; let finance;
const PASSWORD = 'Welcome@123';
async function person(username, role) {
  const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: `${username} user`, roles: [role], email: `${username}@example.ph` });
  expect(r.status).toBe(201);
  const token = (await request(ctx.app).post('/api/auth/login').send({ username, password: PASSWORD })).body.accessToken;
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

/** A posted receipt paying a new bill in full; returns the receipt id and the bill. */
async function paidBill() {
  const { policy, gross } = await makePolicy({ net: 8000 });
  const bill = await createReceivable(pool, { policy, amount: gross, source: 'policy' });
  const r = await ctx.as('maker')('post', '/receipts').send({ receivableId: bill.id, amount: gross, paymentMode: 'check', referenceNo: 'CHK-1001' });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { id: r.body.data.receiptId, number: r.body.data.receiptNumber, bill };
}
const billOf = async (id) => (await query('SELECT balance, status FROM receivables WHERE id = $1', [id])).rows[0];

beforeAll(async () => {
  ctx = await setupFinance();
  recon = await person('rev.recon', 'tis-ccd-recon');
  recon2 = await person('rev.recon2', 'tis-ccd-recon');
  bp = await person('rev.bp', 'tis-ccd-bp');
  finance = await person('rev.finance', 'tis-finance');
});
afterAll(async () => { await pool.end(); });

describe('receipt reversal', () => {
  it('CCD-BP cannot reverse; CCD-Recon asks with a reason; the receipt stays posted until a second user approves', async () => {
    const { id, number, bill } = await paidBill();
    expect((await bp('post', `/receipts/${id}/reversal`).send({ reasonCode: 'RCT-REV-DAIF' })).status).toBe(403);
    expect((await recon('post', `/receipts/${id}/reversal`).send({ reasonCode: 'PDC-BNC-DAIF' })).status).toBe(400);
    expect((await recon('post', `/receipts/${id}/reversal`).send({ reasonCode: 'RCT-REV-OTHER' })).status).toBe(400);
    const asked = await recon('post', `/receipts/${id}/reversal`).send({ reasonCode: 'RCT-REV-DAIF' });
    expect(asked.status, JSON.stringify(asked.body)).toBe(200);
    expect(asked.body.message).toBe(`Reversal of receipt ${number} sent for approval`);
    expect(asked.body.data).toMatchObject({ receiptStatus: 'Converted', reversal: { status: 'pending', reason: 'Cheque returned DAIF', requestedBy: 'rev.recon user' } });
    expect(await billOf(bill.id)).toMatchObject({ status: 'paid' });
    expect((await recon('post', `/receipts/${id}/reversal`).send({ reasonCode: 'RCT-REV-DAIF' })).status).toBe(409);

    expect((await recon('post', `/receipts/${id}/reversal/decision`).send({ action: 'approve' })).status).toBe(403);
    expect((await bp('post', `/receipts/${id}/reversal/decision`).send({ action: 'approve' })).status).toBe(403);
    const work = await recon2('get', '/my-work/items?category=approvals&scope=all');
    expect(JSON.stringify(work.body)).toContain(number);
    const ok = await recon2('post', `/receipts/${id}/reversal/decision`).send({ action: 'approve' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data).toMatchObject({ receiptStatus: 'Cancelled', cancelReason: 'Cheque returned DAIF', reversal: { status: 'approved', decidedBy: 'rev.recon2 user' } });
    expect(await billOf(bill.id)).toMatchObject({ status: 'open' });
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    const trail = (await query("SELECT action FROM audit_log WHERE entity = 'receipt' AND entity_id = $1 ORDER BY id", [id])).rows.map((a) => a.action);
    expect(trail).toEqual(expect.arrayContaining(['reversal-request', 'reverse']));
  });

  it('Finance returns a request with a reason; the receipt is unchanged', async () => {
    const { id, bill } = await paidBill();
    await recon('post', `/receipts/${id}/reversal`).send({ reasonCode: 'RCT-REV-AMOUNT' });
    expect((await finance('post', `/receipts/${id}/reversal/decision`).send({ action: 'return' })).status).toBe(400);
    const back = await finance('post', `/receipts/${id}/reversal/decision`).send({ action: 'return', reasonCode: 'RCT-REJ-NOPROOF' });
    expect(back.status, JSON.stringify(back.body)).toBe(200);
    expect(back.body.data).toMatchObject({ receiptStatus: 'Converted', reversal: { status: 'returned', returnReason: 'No supporting document' } });
    expect(await billOf(bill.id)).toMatchObject({ status: 'paid' });
    expect((await finance('post', `/receipts/${id}/reversal/decision`).send({ action: 'approve' })).status).toBe(409);
  });

  it('without the approval setting the receipt is reversed at once', async () => {
    await query("UPDATE app_settings SET value = 'false' WHERE key = 'receipts.reversal_requires_approval'");
    clearSettingsCache();
    const { id, bill } = await paidBill();
    const r = await recon('post', `/receipts/${id}/reversal`).send({ reasonCode: 'RCT-REV-OTHER', note: 'Paid twice by the dealer' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ receiptStatus: 'Cancelled', cancelReason: 'Other: Paid twice by the dealer' });
    expect(await billOf(bill.id)).toMatchObject({ status: 'open' });
    await query("UPDATE app_settings SET value = 'true' WHERE key = 'receipts.reversal_requires_approval'");
    clearSettingsCache();
  });
});
