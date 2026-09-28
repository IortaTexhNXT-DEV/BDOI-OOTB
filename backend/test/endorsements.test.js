import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let cs;
let finance;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  cs = await persona('e.cs', ['customer-services']);
  finance = await persona('e.finance', ['finance']);
});
afterAll(async () => { await pool.end(); });

describe('endorsements', () => {
  let endorsementId;
  let grossBefore;

  it('creates an endorsement with the premium delta from the coverage changes', async () => {
    grossBefore = (await cs('get', '/policies/pol_sls_05')).body.grossPremium;
    const r = await cs('post', '/endorsements/create-endorsement').send({
      policyId: 'pol_sls_05', endorsementTypeIds: [1, 2, 3],
      personalDetails: { FirstName: 'Bianca', LastName: 'Lorenzo-Reyes', ContactNumber: '09178881234', City: 'Bacoor', EmailID: 'bianca.lr@example.ph' },
      motorDetails: { PlateNumber: 'NEF 7777', VehicleColor: 'Graphite' }, coverageChanges: { BodilyInjury: '300000', Grosspremium: String(grossBefore + 2500) },
    });
    expect(r.status).toBe(201);
    expect(r.body.endorsementId).toMatch(/^end_/);
    expect(r.body.endorsementNumber).toMatch(/^END-\d{4}-\d{5}$/);
    expect(r.body).toMatchObject({ status: 'Draft', premiumDelta: 2500, policyNumber: expect.stringMatching(/^POL-/), endorsementTypeIds: [1, 2, 3] });
    expect(r.body.personalDetails.LastName).toBe('Lorenzo-Reyes');
    endorsementId = r.body.endorsementId;
  });

  it('validates and enforces permissions', async () => {
    expect((await cs('post', '/endorsements/create-endorsement').send({ endorsementTypeIds: [1] })).status).toBe(400);
    expect((await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_missing' })).status).toBe(404);
    expect((await finance('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_05' })).status).toBe(403);
    expect((await finance('get', '/endorsements/get-All-Endorsements')).status).toBe(403);
  });

  it('reads back and lists (by policy and client)', async () => {
    const one = await cs('get', `/endorsements/${endorsementId}`);
    expect(one.body.summary.status).toBe('Draft');
    const byPolicy = await cs('get', '/endorsements/get-All-Endorsements?pageNo=1&perPage=10&policyId=pol_sls_05');
    expect(byPolicy.body.data.items.map((e) => e.endorsementId)).toEqual([endorsementId]);
    const byClient = await cs('get', '/endorsements/get-All-Endorsements?clientId=cl_sls_01');
    expect(byClient.body.data.items[0].policyId).toBe('pol_sls_01');
    expect(byClient.body.data.pagination.total).toBe(1);
    const pol = await cs('get', '/endorsements/get-endorsement/policy-id?policyId=pol_sls_05');
    expect(pol.body.policyNumber).toMatch(/^POL-/);
    expect(pol.body.endorsements.length).toBe(1);
  });

  it('sends to the customer, uploads the document and completes', async () => {
    const s = await cs('post', `/endorsements/send-endorsement-to-customer/${endorsementId}`).send({ sentBy: 'agent' });
    expect(s.body.success).toBe(true);
    expect(s.body.endorsement.status).toBe('PendingCustomer');
    expect((await q("SELECT count(*)::int AS n FROM email_outbox WHERE template = 'endorsement_customer' AND entity_id = $1", [endorsementId]))[0].n).toBe(1);
    const up = await cs('post', '/endorsements/upload-document').field('endorsementId', endorsementId).attach('file', Buffer.from('%PDF-1.4 test'), 'endorsement.pdf');
    expect(up.status).toBe(200);
    expect(up.body.data.documentKey).toBeTruthy();
    const c = await cs('post', '/endorsements/complete-endorsement').send({ endorsementId, policyNumber: 'x', endorsementNumber: 'INS-END-1', issuedDate: '2026-09-28T00:00:00.000Z', expiryDate: '2027-09-28T00:00:00.000Z', documentKey: up.body.data.documentKey });
    expect(c.status).toBe(200);
    expect(c.body.status).toBe('Completed');
    expect(c.body.completionDetails).toMatchObject({ issuedDate: '2026-09-28', insurerEndorsementNumber: 'INS-END-1' });
    const p = (await cs('get', '/policies/pol_sls_05')).body;
    expect(p.grossPremium).toBeCloseTo(grossBefore + 2500, 2);
    expect(p.plateNumber).toBe('NEF 7777');
    expect(p.insuredName).toBe('Bianca Lorenzo-Reyes');
    expect(p.client.contactNumber).toBe('09178881234');
    const rcv = await q('SELECT r.amount FROM receivables r JOIN endorsements e ON e.receivable_id = r.id WHERE e.id = $1', [endorsementId]);
    expect(Number(rcv[0].amount)).toBe(2500);
    const n = await q("SELECT title FROM notifications WHERE entity = 'endorsement' AND entity_id = $1", [endorsementId]);
    expect(n[0].title).toBe('Endorsement completed');
    expect((await cs('post', '/endorsements/complete-endorsement').send({ endorsementId })).status).toBe(400);
  });

  it('cancels a policy through a cancellation endorsement', async () => {
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_07', endorsementTypeIds: [5], isCancelPolicy: true, cancellationType: 'FULL', premiumDelta: -1000 });
    expect(e.body.endorsementType).toBe('cancellation');
    const s = await cs('post', `/endorsements/initiate-cancel-policy/${e.body.endorsementId}`).send({ sentBy: 'agent' });
    expect(s.body.endorsement.status).toBe('InitiateCancel');
    const c = await cs('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId });
    expect(c.body.status).toBe('Cancelled');
    expect((await cs('get', '/policies/pol_sls_07')).body.status).toBe('Cancelled');
    expect((await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_07', endorsementTypeIds: [1] })).status).toBe(400);
  });
});
