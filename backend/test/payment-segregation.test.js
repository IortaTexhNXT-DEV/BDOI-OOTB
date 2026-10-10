/**
 * Segregation of duties on premium payments.
 * - Official receipts (POST /receipts), direct payment entries (POST /accounting/payment-entries) and setting the payment
 *   status (PATCH /policies/:id/payment-status, PUT paymentStatus) are finance-only.
 * - Sales, underwriting, customer services and agents record the client's payment as pending (POST /policies/:id/payments),
 *   for policy and endorsement bills alike; finance verifies it and the official receipt is raised then.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { withOwnDamageOnly } from './helpers.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { createReceivable } from '../src/modules/policies/service.js';

let ctx;
let uw;
let cs;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const today = new Date().toISOString().slice(0, 10);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const receiptCount = async (policyId) => (await q('SELECT count(*)::int AS n FROM receipts WHERE policy_id = $1', [policyId]))[0].n;
const balanceOf = async (id) => Number((await q('SELECT balance FROM receivables WHERE id = $1', [id]))[0].balance);

/** A user with the given role; the password is generated for the run and never stored. */
async function persona(username, role) {
  const secret = `Aa1!${crypto.randomBytes(12).toString('base64url')}`;
  await ctx.api('post', '/users').send({ username, password: secret, displayName: username, roles: [role], email: `${username}@example.ph` });
  const token = (await request(ctx.app).post('/api/auth/login').send({ username, password: secret })).body.accessToken;
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

async function billedPolicy(net, owner = null) {
  const p = await makePolicy({ net, owner });
  const bill = await withTransaction((db) => createReceivable(db, { policyId: p.policy.id, amount: p.gross, user: { id: ctx.userIds.maker } }));
  return { ...p, bill };
}

beforeAll(async () => {
  ctx = await setupFinance();
  uw = await persona('sod.uw', 'processing');
  cs = await persona('sod.cs', 'operations');
  await withOwnDamageOnly('pol_sls_02', 980000, 1.75);
});
afterAll(async () => { await pool.end(); });

describe('Official receipts are finance-only', () => {
  it('sales, underwriting, customer services and agents get 403 on POST /receipts; finance posts it', async () => {
    const p = await billedPolicy(8000, ctx.userIds.agent);
    const body = { policyId: p.policy.id, amount: 1000, paymentMode: 'cash' };
    for (const who of [ctx.as('sales'), ctx.as('agent'), uw, cs]) {
      expect((await who('post', '/receipts').send(body)).status).toBe(403);
      expect((await who('post', '/receipts/bulk-upload')).status).toBe(403);
    }
    expect(await receiptCount(p.policy.id)).toBe(0);
    expect(await balanceOf(p.bill.id)).toBeCloseTo(p.gross, 2);
    const fin = await ctx.as('maker')('post', '/receipts').send(body);
    expect(fin.status).toBe(201);
    expect(fin.body.data.receiptNumber).toMatch(/^OR-/);
    expect(await balanceOf(p.bill.id)).toBeCloseTo(p.gross - 1000, 2);
  });

  it('only Accounting, the TISPH Cash Control roles (and the System Administrator) hold write:receipts; migration 0084 revokes it from sales on existing databases', async () => {
    const holders = await q(`SELECT DISTINCT r.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'write:receipts' ORDER BY r.code`);
    expect(holders.map((r) => r.code)).toEqual(['accounting', 'system-admin', 'tis-ccd-bp', 'tis-ccd-pdc', 'tis-ccd-pdu', 'tis-ccd-recon']);
    const sales = await q(`SELECT p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.code = 'sales' AND p.module = 'receipts'`);
    expect(sales.map((r) => r.code)).toEqual([]); // the receipt register is finance-only too
    // an existing database seeded before the fix
    await q(`INSERT INTO role_permissions(role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'sales' AND p.code = 'write:receipts'`);
    const sql = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations/0084_finance_only_receipts.sql'), 'utf8');
    await q(sql);
    const after = await q(`SELECT 1 FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.code = 'sales' AND p.code = 'write:receipts'`);
    expect(after).toHaveLength(0);
  });
});

describe('No direct-paid path for policy editors', () => {
  it('payment-entries, PATCH payment-status and PUT paymentStatus are refused to sales, underwriting, customer services and agents', async () => {
    const p = await billedPolicy(9000, ctx.userIds.agent);
    const entry = { amount: p.gross, clientId: p.client.id, referenceType: 'Policy', referenceId: p.policy.id, policyId: p.policy.id };
    for (const who of [ctx.as('sales'), ctx.as('agent'), uw, cs]) {
      expect((await who('post', '/accounting/payment-entries').send(entry)).status).toBe(403);
      expect((await who('patch', `/policies/${p.policy.id}/payment-status`).send({ paymentStatus: 'Completed', paymentMethod: 'Cash' })).status).toBe(403);
      expect((await who('put', `/policies/${p.policy.id}`).send({ paymentStatus: 'Completed' })).status).toBe(403);
    }
    const [pol] = await q('SELECT payment_status, paid_at FROM policies WHERE id = $1', [p.policy.id]);
    expect(pol.payment_status).not.toBe('Completed');
    expect(pol.paid_at).toBeNull();
    expect(await balanceOf(p.bill.id)).toBeCloseTo(p.gross, 2);
    // editing other details (and re-sending the unchanged status) still works
    expect((await uw('put', `/policies/${p.policy.id}`).send({ plateNumber: 'SOD 1234', paymentStatus: pol.payment_status })).status).toBe(200);
    // finance keeps the direct path
    const fin = await ctx.as('maker')('post', '/accounting/payment-entries').send(entry);
    expect(fin.status).toBe(201);
    expect(fin.body.data.applied).toBeCloseTo(p.gross, 2);
  });
});

describe('pending payment capture, verified by finance', () => {
  it('sales, underwriting and agents record a pending payment (no receipt, no journal); finance verifies it', async () => {
    const p = await billedPolicy(12000, ctx.userIds.agent);
    const pay = (amount, ref) => ({ option: 'payment', paymentMode: 'bank-transfer', referenceNo: ref, amount, paymentDate: today, proofKey: 'payment-proofs/slip.jpg' });
    const jvBefore = (await q('SELECT count(*)::int AS n FROM journal_vouchers'))[0].n;
    const ids = [];
    for (const [who, ref] of [[ctx.as('sales'), 'SLS-1'], [uw, 'UW-1'], [ctx.as('agent'), 'AGT-1']]) {
      const r = await who('post', `/policies/${p.policy.id}/payments`).send(pay(1000, ref));
      expect(r.status).toBe(201);
      expect(r.body.data).toMatchObject({ posted: false, receipt: null, capture: { status: 'submitted', referenceNo: ref } });
      ids.push(r.body.data.capture.id);
    }
    expect((await q('SELECT count(*)::int AS n FROM journal_vouchers'))[0].n).toBe(jvBefore);
    expect(await receiptCount(p.policy.id)).toBe(0);
    expect(await balanceOf(p.bill.id)).toBeCloseTo(p.gross, 2);
    expect((await q('SELECT payment_status FROM policies WHERE id = $1', [p.policy.id]))[0].payment_status).toBe('Reviewing');
    // none of them can verify
    for (const who of [ctx.as('sales'), uw, ctx.as('agent')]) expect((await who('post', `/policies/${p.policy.id}/payments/${ids[0]}/confirm`)).status).toBe(403);
    const ok = await ctx.as('maker')('post', `/policies/${p.policy.id}/payments/${ids[0]}/confirm`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.receipt.receiptNumber).toMatch(/^OR-/);
    expect(await balanceOf(p.bill.id)).toBeCloseTo(p.gross - 1000, 2);
    expect((await ctx.as('maker')('post', `/policies/${p.policy.id}/payments/${ids[1]}/reject`).send({ reason: 'No matching credit' })).status).toBe(200);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });
});

describe('endorsement premium payment follows the pending flow', () => {
  const screen = (od) => ({ LossandDamagecoverage: String(od), LossandDamagecoverageRate: '1.75', BodilyInjury: '', PropertyDamage: '', APPATotalCoverage: '' });
  async function grossOf(net) {
    const rows = await q("SELECT key, (value#>>'{}')::numeric AS v FROM app_settings WHERE key IN ('tax.vat_rate', 'tax.dst_rate', 'tax.lgt_rate')");
    const rate = Object.fromEntries(rows.map((r) => [r.key, Number(r.v)]));
    return r2(net + r2(net * rate['tax.vat_rate']) + r2(net * rate['tax.dst_rate']) + r2(net * rate['tax.lgt_rate']));
  }

  it('the endorsement bill is paid through a pending capture that finance verifies', async () => {
    const before = Number((await q("SELECT premium_total FROM policies WHERE id = 'pol_sls_02'"))[0].premium_total);
    const delta = r2((await grossOf(r2(1180000 * 0.0175))) - before);
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_02', endorsementTypeIds: [3], coverageChanges: screen(1180000), premiumDelta: delta });
    expect(e.status).toBe(201);
    const done = await cs('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId, endorsementNumber: 'INS-SOD-1', issuedDate: today });
    expect(done.status).toBe(200);
    const rcv = done.body.receivableId;
    expect(rcv).toBeTruthy();

    // the payment screen lists the endorsement bill
    const s = await cs('get', '/policies/pol_sls_02/payments');
    expect(s.body.data.canConfirm).toBe(false);
    expect(s.body.data.receivables.find((b) => b.receivableId === rcv)).toMatchObject({ source: 'endorsement' });
    expect(s.body.data.receivables.find((b) => b.receivableId === rcv).balance).toBeCloseTo(delta, 2);

    // the old direct paths are closed
    expect((await cs('post', '/receipts').send({ receivableId: rcv, amount: delta })).status).toBe(403);
    expect((await cs('patch', '/policies/pol_sls_02/payment-status').send({ paymentStatus: 'Completed' })).status).toBe(403);
    expect((await cs('post', '/accounting/payment-entries').send({ amount: delta, clientId: 'x', referenceType: 'Endorsement', referenceId: e.body.endorsementId, policyId: 'pol_sls_02' })).status).toBe(403);

    // pending capture against the endorsement bill
    const receiptsBefore = await receiptCount('pol_sls_02');
    const c = await cs('post', '/policies/pol_sls_02/payments').send({ option: 'payment', paymentMode: 'check', referenceNo: 'CHK-END-1', amount: delta, paymentDate: today, receivableId: rcv, proofKey: 'payment-proofs/slip.jpg' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ posted: false, receipt: null, capture: { status: 'submitted', receivableId: rcv } });
    expect(await balanceOf(rcv)).toBeCloseTo(delta, 2);
    expect(await receiptCount('pol_sls_02')).toBe(receiptsBefore);
    const listed = await ctx.as('maker')('get', '/policies/payment-captures');
    expect(listed.body.data.map((x) => x.id)).toContain(c.body.data.capture.id);

    // finance verifies: official receipt against the endorsement bill
    const ok = await ctx.as('maker')('post', `/policies/pol_sls_02/payments/${c.body.data.capture.id}/confirm`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.receipt.receiptNumber).toMatch(/^OR-/);
    expect(await balanceOf(rcv)).toBe(0);
    expect(await receiptCount('pol_sls_02')).toBe(receiptsBefore + 1);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });
});
