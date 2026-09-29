import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, createOwnBookRole } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let sales;
let finance;
let agent;

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('c.sales', ['sales']);
  finance = await persona('c.finance', ['accounting']);
  agent = await persona('c.agent', [await createOwnBookRole(ctx.api)]);
});
afterAll(async () => { await pool.end(); });

describe('clients', () => {
  let clientId;
  it('lists clients in the { data: { clients, pagination } } shape', async () => {
    const r = await sales('get', '/clients?page=1&pageSize=5');
    expect(r.body.data.clients.length).toBe(5);
    expect(r.body.data.pagination).toMatchObject({ page: 1, pageSize: 5 });
    expect(r.body.data.pagination.totalCount).toBeGreaterThanOrEqual(10);
    const s = await sales('get', '/clients?search=Kalayaan');
    expect(s.body.data.clients[0].companyName).toBe('Kalayaan Foods Corp.');
  });
  it('returns a client with its policies (by id or code)', async () => {
    const r = await sales('get', '/clients/cl_sls_01');
    expect(r.body.clientId).toBe('cl_sls_01');
    expect(r.body.generatedClientId).toMatch(/^CL-/);
    expect(r.body.policies[0].policyNumber).toMatch(/^POL-/);
    expect(r.body.data.firstName).toBe('Miguel');
    expect((await sales('get', `/clients/${r.body.generatedClientId}`)).body.clientId).toBe('cl_sls_01');
    expect((await sales('get', '/clients/cl_missing')).status).toBe(404);
  });
  it('creates and updates a client', async () => {
    const c = await sales('post', '/clients').send({ firstName: 'Olivia', lastName: 'Chua', emailId: 'olivia@example.ph', leadCategory: 'Retail', city: 'Taguig' });
    expect(c.status).toBe(201);
    clientId = c.body.clientId;
    expect(c.body.generatedClientId).toMatch(/^CL-\d{4}-\d{5}$/);
    const u = await sales('put', `/clients/${clientId}`).send({ contactNumber: '09175550000', lastName: 'Chua-Tan' });
    expect(u.body.contactNumber).toBe('09175550000');
    expect(u.body.displayName).toBe('Olivia Chua-Tan');
    expect((await sales('post', '/clients').send({ lastName: 'x' })).status).toBe(400);
    expect((await sales('post', '/clients').send({ firstName: 'x', emailId: 'nope' })).status).toBe(400);
  });
  it('refuses an implausible date of birth (D68)', async () => {
    const young = await sales('post', '/clients').send({ firstName: 'Baby', lastName: 'Chua', DOB: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10) });
    expect(young.status).toBe(400);
    expect(young.body.message).toMatch(/the age must be between 18 and 100 years/);
    expect((await sales('put', `/clients/${clientId}`).send({ DOB: '1890-01-01' })).status).toBe(400);
    const ok = await sales('put', `/clients/${clientId}`).send({ DOB: '1985-06-30' });
    expect(ok.status).toBe(200);
    expect(ok.body.DOB).toBe('1985-06-30');
  });
  it('converts a lead into a client once', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Iris', lastName: 'Macaraeg', emailId: 'iris@example.ph' });
    const a = await sales('post', `/clients/from-lead/${lead.body.leadId}`).send({});
    expect(a.status).toBe(201);
    expect(a.body.leadId).toBe(lead.body.leadId);
    const b = await sales('post', `/clients/from-lead/${lead.body.leadId}`).send({});
    expect(b.body.clientId).toBe(a.body.clientId);
    expect((await sales('get', `/leads/${lead.body.leadId}`)).body.status).toBe('Converted');
  });
  it('serves customer codes and enforces permissions', async () => {
    const codes = await finance('get', '/customers/codes');
    expect(codes.body.data.length).toBeGreaterThanOrEqual(10);
    expect((await finance('post', '/clients').send({ firstName: 'x' })).status).toBe(403);
    // Agents see Clients in their menu: read allowed, create refused.
    expect((await agent('get', '/clients')).status).toBe(200);
    expect((await agent('post', '/clients').send({ firstName: 'x' })).status).toBe(403);
  });
});
