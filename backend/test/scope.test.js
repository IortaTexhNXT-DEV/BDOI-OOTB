import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, createOwnBookRole, enableFeatures } from './helpers.js';
import { pool, query } from '../src/db/pool.js';

let ctx;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}

beforeAll(async () => {
  ctx = await setup();
  // functions of a later release (modules/features), enabled as the platform administrators do
  await enableFeatures(ctx.app, ['sales-dashboard']);
  const ownBook = await createOwnBookRole(ctx.api);
  await makeUser('ag.one', [ownBook]);
  await makeUser('ag.two', [ownBook]);
  await makeUser('clm.officer', ['claims']);
  for (const [who, name] of [['ag.one', 'Scopia Uno'], ['ag.two', 'Scopia Dos']]) {
    const r = await as(who, 'post', '/leads').send({ firstName: name.split(' ')[0], lastName: name.split(' ')[1], emailId: `${who}@lead.example.ph`, lob: 'MOTOR' });
    expect(r.status).toBe(201);
    ids[`lead:${who}`] = r.body.leadId;
  }
  const q = await as('ag.one', 'post', '/quotations').send({ leadRefId: ids['lead:ag.one'], productType: 'Motor', netPremium: '5000' });
  expect(q.status).toBe(201);
  ids['quote:ag.one'] = q.body.quotationId;
  const q2 = await as('ag.two', 'post', '/quotations').send({ leadRefId: ids['lead:ag.two'], productType: 'Motor', netPremium: '7000' });
  ids['quote:ag.two'] = q2.body.quotationId;
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, owner_user_id, created_by) VALUES
    ('cl_sc1','CL-SC-1','Scopia Uno','Scopia','Uno',$1,$1), ('cl_sc2','CL-SC-2','Scopia Dos','Scopia','Dos',$2,$2)`, [ids['ag.one'], ids['ag.two']]);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, owner_user_id, created_by, status, inception_date, expiry_date, sum_insured, premium_total, insured_name, doc)
    VALUES ('pol_sc1','POL-SC-0001','cl_sc1',(SELECT id FROM products WHERE code='MOTOR'),$1,$1,'active',current_date - 30,current_date + 335,900000,20000,'Scopia Uno','{"plateNumber":"SCP 1111"}'),
           ('pol_sc2','POL-SC-0002','cl_sc2',(SELECT id FROM products WHERE code='MOTOR'),$2,$2,'active',current_date - 30,current_date + 335,900000,20000,'Scopia Dos','{"plateNumber":"SCP 2222"}')`, [ids['ag.one'], ids['ag.two']]);
  await query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES
    ('INV-SC-1','pol_sc1','cl_sc1',20000,0,current_date - 20,'paid'), ('INV-SC-2','pol_sc2','cl_sc2',20000,0,current_date - 20,'paid')`);
});
afterAll(async () => { await new Promise((r) => { setTimeout(r, 50); }); await pool.end(); });

const fnol = (who, policyRefId) => as(who, 'post', '/claims').send({ policyRefId, dateOfIncident: daysAgo(2), typeOfIncident: 'Collision', estimatedClaimAmount: 40000, lob: 'MOTOR' });

describe('record-level scoping (agents see only their own book)', () => {
  it('leads: each agent lists, reads and updates only their own; admin sees all', async () => {
    const one = await as('ag.one', 'get', '/leads?pageSize=100');
    expect(one.status).toBe(200);
    expect(one.body.data.map((l) => l.leadId)).toEqual([ids['lead:ag.one']]);
    const two = await as('ag.two', 'get', '/lead/get-all-lead?pageSize=100');
    expect(two.body.data.map((l) => l.leadId)).toEqual([ids['lead:ag.two']]);
    expect((await as('ag.one', 'get', `/leads/${ids['lead:ag.two']}`)).status).toBe(404);
    expect((await as('ag.one', 'put', `/leads/${ids['lead:ag.two']}`).send({ notes: 'x' })).status).toBe(404);
    expect((await as('ag.one', 'delete', `/leads/${ids['lead:ag.two']}`)).status).toBe(404);
    expect((await as('ag.one', 'put', `/leads/${ids['lead:ag.one']}`).send({ notes: 'called' })).status).toBe(200);
    const stats = await as('ag.one', 'get', '/leads/stats');
    expect(stats.body.totalLeads).toBe(1);
    const admin = await ctx.api('get', '/leads?pageSize=500');
    const all = admin.body.data.map((l) => l.leadId);
    expect(all).toEqual(expect.arrayContaining([ids['lead:ag.one'], ids['lead:ag.two']]));
    expect(all.length).toBeGreaterThan(2);
  });

  it('quotations: own list and stats; someone else\'s quote (or lead) answers 404', async () => {
    const one = await as('ag.one', 'get', '/quotations?pageSize=100');
    expect(one.body.data.map((q) => q.quotationId)).toEqual([ids['quote:ag.one']]);
    expect((await as('ag.one', 'get', '/quotations/stats')).body.totalQuotations).toBe(1);
    expect((await as('ag.one', 'get', `/quotations/${ids['quote:ag.two']}`)).status).toBe(404);
    expect((await as('ag.one', 'put', `/quotations/${ids['quote:ag.two']}`).send({ discount: '1' })).status).toBe(404);
    expect((await as('ag.one', 'post', `/quotations/${ids['quote:ag.two']}/send-for-approval`).send({})).status).toBe(404);
    expect((await as('ag.one', 'get', `/quotations/compare?quotationId1=${ids['quote:ag.one']}&quotationId2=${ids['quote:ag.two']}`)).status).toBe(404);
    expect((await as('ag.one', 'post', '/quotations').send({ leadRefId: ids['lead:ag.two'], productType: 'Motor' })).status).toBe(404);
    expect((await as('ag.two', 'get', `/quotations/${ids['quote:ag.two']}`)).status).toBe(200);
    const admin = await ctx.api('get', '/quotations?pageSize=500');
    expect(admin.body.data.map((q) => q.quotationId)).toEqual(expect.arrayContaining([ids['quote:ag.one'], ids['quote:ag.two']]));
  });

  it('policies and clients: own book only; admin sees both agents\' policies', async () => {
    const one = await as('ag.one', 'get', '/policies?pageSize=500');
    expect(one.body.data.map((p) => p.policyNumber)).toEqual(['POL-SC-0001']);
    expect((await as('ag.one', 'get', '/policies/pol_sc2')).status).toBe(404);
    expect((await as('ag.one', 'get', '/policies/POL-SC-0002')).status).toBe(404);
    expect((await as('ag.one', 'put', '/policies/pol_sc2').send({ insuredName: 'x' })).status).toBe(404);
    expect((await as('ag.one', 'get', '/policies/pol_sc1')).status).toBe(200);
    const clients = await as('ag.one', 'get', '/clients?pageSize=100');
    expect(clients.body.data.clients.map((c) => c.clientId)).toEqual(['cl_sc1']);
    expect((await as('ag.one', 'get', '/clients/cl_sc2')).status).toBe(404);
    const admin = await ctx.api('get', '/policies?pageSize=500');
    expect(admin.body.data.map((p) => p.policyNumber)).toEqual(expect.arrayContaining(['POL-SC-0001', 'POL-SC-0002']));
    // non-scoped users can still ask for their own book
    const mine = await ctx.api('get', '/policies?mine=true&pageSize=500');
    expect(mine.body.data.some((p) => ['POL-SC-0001', 'POL-SC-0002'].includes(p.policyNumber))).toBe(false);
    expect(mine.body.total).toBeLessThan(admin.body.total);
  });

  it('claims: agents register first notice of loss on their own policies only and see only those claims', async () => {
    const c1 = await fnol('ag.one', 'pol_sc1');
    expect(c1.status).toBe(201);
    ids['claim:1'] = c1.body.data.id;
    expect((await fnol('ag.one', 'pol_sc2')).status).toBe(404);
    const c2 = await fnol('clm.officer', 'pol_sc2');
    expect(c2.status).toBe(201);
    ids['claim:2'] = c2.body.data.id;
    const one = await as('ag.one', 'get', '/claims?pageSize=100');
    expect(one.body.data.claims.map((c) => c.id)).toEqual([ids['claim:1']]);
    const two = await as('ag.two', 'get', '/claims?pageSize=100');
    expect(two.body.data.claims.map((c) => c.id)).toEqual([ids['claim:2']]);
    expect((await as('ag.one', 'get', `/claims/${ids['claim:2']}`)).status).toBe(404);
    expect((await as('ag.one', 'get', `/claims/${ids['claim:1']}`)).status).toBe(200);
    expect((await as('ag.one', 'get', '/claims/report')).body.data.summary.totalClaims).toBe(1);
    const admin = await ctx.api('get', '/claims?pageSize=100');
    expect(admin.body.data.claims.map((c) => c.id)).toEqual(expect.arrayContaining([ids['claim:1'], ids['claim:2']]));
  });

  it('agents may update their claim but claim decisions need the claims (or admin) role', async () => {
    const id = ids['claim:1'];
    expect((await as('ag.one', 'put', `/claims/${id}`).send({ description: 'Rear bumper damage' })).status).toBe(200);
    expect((await as('ag.one', 'put', `/claims/updatestatus/${id}`).send({ claimStatus: 'in-review' })).status).toBe(403);
    expect((await as('ag.one', 'put', `/claims/rejectclaim/${id}`).send({ reason: 'x' })).status).toBe(403);
    expect((await as('ag.one', 'put', `/claims/settle/${id}`).send({ settlementAmount: 1000 })).status).toBe(403);
    expect((await as('ag.one', 'put', `/claims/approve-settlement/${id}`).send({ decision: 'approve' })).status).toBe(403);
    expect((await as('clm.officer', 'put', `/claims/updatestatus/${id}`).send({ claimStatus: 'in-review' })).status).toBe(200);
    expect((await as('clm.officer', 'put', `/claims/settle/${id}`).send({ settlementAmount: 30000 })).status).toBe(200);
    const approve = await ctx.api('put', `/claims/approve-settlement/${id}`).send({ decision: 'approve' });
    expect(approve.status).toBe(200);
  });

  it('endorsements: agents endorse their own policies only', async () => {
    const e = await as('ag.one', 'post', '/endorsements/create-endorsement').send({ policyId: 'pol_sc1', endorsementTypeIds: [1], personalDetails: { City: 'Pasig' } });
    expect(e.status).toBe(201);
    expect((await as('ag.one', 'post', '/endorsements/create-endorsement').send({ policyId: 'pol_sc2', endorsementTypeIds: [1] })).status).toBe(404);
    const list = await as('ag.one', 'get', '/endorsements/get-All-Endorsements');
    expect(list.body.data.items.map((x) => x.endorsementId)).toEqual([e.body.endorsementId]);
    expect((await as('ag.two', 'get', `/endorsements/${e.body.endorsementId}`)).status).toBe(404);
  });

  it('dashboards use the agent\'s own book', async () => {
    const s = await as('ag.one', 'get', '/dashboard/sales');
    expect(s.body.funnel.leads).toBe(1);
    expect(s.body.funnel.policies).toBe(1);
    const home = await as('ag.one', 'get', '/agent/get-dashboard-details?scope=all');
    expect(home.body.funnel.leads).toBe(1);
  });

  it('global search returns typed results with front-end links and respects scoping', async () => {
    const one = await as('ag.one', 'get', '/search?q=POL-SC');
    expect(one.status).toBe(200);
    const pol = one.body.data.filter((r) => r.type === 'policy');
    expect(pol.map((r) => r.title)).toEqual(['POL-SC-0001']);
    expect(pol[0]).toMatchObject({ id: 'pol_sc1', link: '/agent/policydetail/pol_sc1', status: expect.any(String) });
    expect(one.body.data.some((r) => r.type === 'claim' && r.link === `/agent/claimdetail/${ids['claim:1']}`)).toBe(true);
    const plate = await as('ag.one', 'get', '/search?q=SCP 2222');
    expect(plate.body.data).toEqual([]);
    const admin = await ctx.api('get', '/search?q=SCP 2222');
    expect(admin.body.data.find((r) => r.type === 'policy')).toMatchObject({ title: 'POL-SC-0002', subtitle: expect.stringContaining('SCP 2222') });
    const lead = await as('ag.two', 'get', '/search?q=Scopia&limit=5');
    expect(lead.body.data.find((r) => r.type === 'lead')).toMatchObject({ id: ids['lead:ag.two'], link: `/agent/leaddetail/${ids['lead:ag.two']}` });
    expect(lead.body.data.every((r) => !String(r.title).includes('Uno'))).toBe(true);
    expect((await as('ag.one', 'get', '/search?q=x')).status).toBe(400);
  });

  it('scoped roles come from security.scoped_roles', async () => {
    expect((await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': [] } })).status).toBe(200);
    const r = await as('ag.one', 'get', '/leads?pageSize=500');
    expect(r.body.data.length).toBeGreaterThan(1);
    await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': ['own-book'] } });
    expect((await as('ag.one', 'get', '/leads?pageSize=500')).body.data.length).toBe(1);
  });
});
