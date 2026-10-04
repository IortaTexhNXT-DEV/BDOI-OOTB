import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let ops;
let claims;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  ops = await persona('mc.ops', ['operations']);
  claims = await persona('mc.claims', ['claims']);
});
afterAll(async () => { await pool.end(); });

describe('marine cargo open cover', () => {
  let coverId;
  let policyId;
  const contract = { clientId: 'cl_sls_06', insuranceCompanyId: 4, periodFrom: '2026-01-01', periodTo: '2026-12-31', goodsDescription: 'Frozen seafood in reefer containers',
    voyageScope: 'Imports from Asia to Philippine ports', clauses: 'Institute Cargo Clauses (A); Institute Frozen Food Clauses',
    rates: [{ conveyance: 'Sea', ratePercent: 0.15, limit: 20000000 }, { conveyance: 'Air', ratePercent: 0.1, limit: 5000000 }], markupPercent: 10, minimumPremium: 500 };

  it('sets up the contract: rates and limits per conveyance are checked', async () => {
    expect((await claims('post', '/marine/open-covers').send(contract)).status).toBe(403);
    const bad = await ops('post', '/marine/open-covers').send({ ...contract, rates: [{ conveyance: 'Rail', ratePercent: 0.1, limit: 1 }] });
    expect(bad.status).toBe(400);
    const r = await ops('post', '/marine/open-covers').send(contract);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: 'draft', markupPercent: 10, minimumPremium: 500 });
    coverId = r.body.data.id;
    expect((await ops('post', `/marine/open-covers/${coverId}/certificates`).send({ shipmentDate: '2026-03-01', conveyance: 'Sea', voyageFrom: 'Shanghai', voyageTo: 'Manila', invoiceValue: 100000 })).status).toBe(409);
  });

  it('activating issues the open policy without a bill', async () => {
    const r = await ops('post', `/marine/open-covers/${coverId}/activate`);
    expect(r.status).toBe(200);
    policyId = r.body.data.policyId;
    const p = (await pool.query('SELECT lob, premium_total, inception_date, expiry_date, doc FROM policies WHERE id = $1', [policyId])).rows[0];
    expect(p).toMatchObject({ lob: 'MARINE', premium_total: 0, inception_date: '2026-01-01', expiry_date: '2026-12-31' });
    expect(p.doc.isOpenCover).toBe(true);
    expect((await pool.query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [policyId])).rows[0].n).toBe(0);
  });

  let certA;
  it('issues certificates: insured value with mark-up, rate of the conveyance, minimum premium, limit per conveyance', async () => {
    const a = await ops('post', `/marine/open-covers/${coverId}/certificates`).send({ shipmentDate: '2026-03-08', conveyance: 'Sea', vesselName: 'MV Lorenzo Pride',
      voyageFrom: 'Shanghai, China', voyageTo: 'Manila, Philippines', billOfLading: 'SHMNL2603088', invoiceValue: 4200000 });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ insuredValue: 4620000, ratePercent: 0.15, premium: 6930, status: 'issued' });
    certA = a.body.data;
    const small = await ops('post', `/marine/open-covers/${coverId}/certificates`).send({ shipmentDate: '2026-03-20', conveyance: 'Air', voyageFrom: 'Singapore', voyageTo: 'Cebu', invoiceValue: 50000 });
    expect(small.body.data.premium).toBe(500);
    const over = await ops('post', `/marine/open-covers/${coverId}/certificates`).send({ shipmentDate: '2026-03-21', conveyance: 'Air', voyageFrom: 'Singapore', voyageTo: 'Cebu', invoiceValue: 5000000 });
    expect(over.status).toBe(400);
    expect(JSON.stringify(over.body)).toMatch(/exceeds the Air limit per conveyance/);
    const outside = await ops('post', `/marine/open-covers/${coverId}/certificates`).send({ shipmentDate: '2027-01-02', conveyance: 'Sea', voyageFrom: 'A', voyageTo: 'B', invoiceValue: 1000 });
    expect(outside.status).toBe(400);
    const declared = await ops('post', `/marine/open-covers/${coverId}/declared-items`).send({ shipmentDate: '2026-03-25', conveyance: 'Sea', voyageFrom: 'Busan', voyageTo: 'Batangas', invoiceValue: 1000000 });
    expect(declared.body.data).toMatchObject({ kind: 'declared', premium: 1650 });
    const cancelled = await ops('post', `/marine/open-covers/${coverId}/certificates`).send({ shipmentDate: '2026-03-28', conveyance: 'Sea', voyageFrom: 'A', voyageTo: 'B', invoiceValue: 800000 });
    const c = await ops('post', `/marine/certificates/${cancelled.body.data.id}/cancel`).send({ reason: 'Shipment did not proceed' });
    expect(c.body.data.status).toBe('cancelled');
  });

  it('prints the certificate', async () => {
    const pdf = await claims('get', `/marine/certificates/${certA.id}/print`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  let declId;
  it('the monthly declaration takes the shipments of the month with the premium taxes; billing raises the bill on the open policy', async () => {
    const d = await ops('post', `/marine/open-covers/${coverId}/declarations`).send({ period: '2026-03' });
    expect(d.status).toBe(201);
    declId = d.body.data.id;
    expect(d.body.data).toMatchObject({ shipments: 3, premium: 6930 + 500 + 1650, periodFrom: '2026-03-01', periodTo: '2026-03-31' });
    expect(d.body.data.dst).toBeGreaterThan(0);
    expect(d.body.data.grossPremium).toBeCloseTo(d.body.data.premium + d.body.data.vat + d.body.data.dst + d.body.data.lgt + d.body.data.otherCharges, 2);
    expect((await ops('post', `/marine/open-covers/${coverId}/declarations`).send({ period: '2026-03' })).status).toBe(409);
    expect((await ops('post', `/marine/declarations/${declId}/bill`)).status).toBe(409);
    // a late certificate of the month joins the open declaration
    await ops('post', `/marine/open-covers/${coverId}/certificates`).send({ shipmentDate: '2026-03-30', conveyance: 'Sea', voyageFrom: 'Kaohsiung', voyageTo: 'Manila', invoiceValue: 2000000 });
    const ref = await ops('get', `/marine/declarations/${declId}`);
    expect(ref.body.data.shipments).toBe(4);
    const s = await ops('post', `/marine/declarations/${declId}/submit`).send({ notes: 'Confirmed by the client' });
    expect(s.body.data.status).toBe('submitted');
    const b = await ops('post', `/marine/declarations/${declId}/bill`);
    expect(b.status).toBe(200);
    const rcv = (await pool.query('SELECT * FROM receivables WHERE id = $1', [b.body.data.receivableId])).rows[0];
    expect(rcv).toMatchObject({ policy_id: policyId, source: 'declaration', status: 'open' });
    expect(Number(rcv.amount)).toBeCloseTo(s.body.data.grossPremium, 2);
    expect(rcv.booking_jv_id).toBeTruthy();
    const jl = (await pool.query('SELECT sum(debit) AS d, sum(credit) AS c FROM journal_lines WHERE jv_id = $1', [rcv.booking_jv_id])).rows[0];
    expect(Number(jl.d)).toBeCloseTo(Number(jl.c), 2);
    expect((await pool.query('SELECT 1 FROM collection_items WHERE receivable_id = $1', [rcv.id])).rows.length).toBe(1);
    const cert = (await pool.query('SELECT status FROM open_cover_certificates WHERE id = $1', [certA.id])).rows[0];
    expect(cert.status).toBe('declared');
    expect((await ops('post', `/marine/certificates/${certA.id}/cancel`).send({ reason: 'late' })).status).toBe(409);
    const pdf = await ops('get', `/marine/declarations/${declId}/print`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
  });

  it('a month without shipments is a nil declaration with nothing to bill', async () => {
    const d = await ops('post', `/marine/open-covers/${coverId}/declarations`).send({ period: '2026-04' });
    const s = await ops('post', `/marine/declarations/${d.body.data.id}/submit`).send({});
    expect(s.body.data.status).toBe('nil');
    expect((await ops('post', `/marine/declarations/${d.body.data.id}/bill`)).status).toBe(409);
    const cover = await ops('get', `/marine/open-covers/${coverId}`);
    expect(cover.body.data.declarations.map((x) => x.status)).toEqual(['nil', 'billed']);
    expect(cover.body.data.billedPremium).toBeGreaterThan(0);
  });
});
