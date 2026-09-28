import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let sales;
let finance;
let claims;

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('d.sales', ['sales']);
  finance = await persona('d.finance', ['finance']);
  claims = await persona('d.claims', ['claims']);
});
afterAll(async () => { await pool.end(); });

describe('dashboards', () => {
  it('executive KPIs are computed from the tables', async () => {
    const r = await ctx.api('get', '/dashboard/executive?period=year');
    const d = r.body.data;
    const total = Number((await pool.query("SELECT sum(premium_total) AS s FROM policies WHERE created_at >= now() - interval '1 year'")).rows[0].s);
    expect(d.executiveKPIs.totalRevenue.value).toBeCloseTo(total, 2);
    expect(d.executiveKPIs.activePolicies.value).toBeGreaterThanOrEqual(8);
    expect(d.revenueByProduct.labels.length).toBe(d.revenueByProduct.data.length);
    expect(d.monthlyTrend.labels.length).toBe(12);
    expect(d.monthlyTrend.premium.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(d.agentPerformance[0].name).toBe('BrokerVerse Administrator');
    expect(d.claimsAnalytics.totalClaims).toBeGreaterThanOrEqual(0);
  });
  it('sales funnel, underwriting workbench and claims summary', async () => {
    const s = await sales('get', '/dashboard/sales');
    expect(s.body.data.funnel.leads).toBeGreaterThanOrEqual(16);
    expect(s.body.data.funnel.policies).toBeGreaterThanOrEqual(8);
    expect(s.body.data.quotationsByStatus.find((x) => x.status === 'ConvertedToPolicy').count).toBe(8);
    const mine = await sales('get', '/dashboard/sales?scope=mine');
    expect(mine.body.data.funnel.leads).toBe(0);
    const u = await sales('get', '/dashboard/underwriting');
    expect(u.body.data.workbenchMetrics.newSubmissions).toBeGreaterThanOrEqual(3);
    expect(u.body.data.myCases.map((c) => c.status)).toEqual(expect.arrayContaining(['PendingCustomer', 'CustomerAccepted', 'SubmittedToInsurer']));
    const c = await claims('get', '/dashboard/claims');
    expect(c.body.data.totalClaims).toBeGreaterThanOrEqual(0);
  });
  it('agent home shows the signed-in user\'s own figures', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Own', lastName: 'Lead', emailId: 'own@example.ph' });
    await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', netPremium: '1000' });
    const r = await sales('get', '/agent/get-dashboard-details');
    expect(r.body.data.funnel).toMatchObject({ leads: 1, quotations: 1, policies: 0 });
    expect(r.body.data.recentQuotations[0].status).toBe('Draft');
    const all = await ctx.api('get', '/agent/get-dashboard-details?scope=all');
    expect(all.body.data.funnel.leads).toBeGreaterThanOrEqual(17);
  });
  it('enforces permissions', async () => {
    expect((await finance('get', '/dashboard/sales')).status).toBe(403);
    expect((await finance('get', '/dashboard/claims')).status).toBe(200); // finance reads claims KPIs
    expect((await claims('get', '/dashboard/underwriting')).status).toBe(403);
    expect((await request(ctx.app).get('/api/dashboard/executive')).status).toBe(401);
  });
});
