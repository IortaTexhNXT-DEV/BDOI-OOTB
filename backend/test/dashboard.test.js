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

describe('dashboard period: calendar month in Manila time', () => {
  it('"This Month" runs from the 1st of the Manila month; a policy at 00:30 Manila on the 1st counts, 23:30 the day before does not', async () => {
    const { calendarPeriod } = await import('../src/lib/dates.js');
    const range = await calendarPeriod('month');
    // Two policies moved to just after / just before the Manila month start (16:00 UTC the day before)
    const ids = (await pool.query('SELECT id FROM policies ORDER BY id LIMIT 2')).rows.map((r) => r.id);
    const saved = (await pool.query('SELECT id, created_at FROM policies WHERE id = ANY($1)', [ids])).rows;
    try {
      await pool.query(`UPDATE policies SET created_at = ($2::date::timestamp AT TIME ZONE 'Asia/Manila') + interval '30 minutes' WHERE id = $1`, [ids[0], range.from]);
      await pool.query(`UPDATE policies SET created_at = ($2::date::timestamp AT TIME ZONE 'Asia/Manila') - interval '30 minutes' WHERE id = $1`, [ids[1], range.from]);
      const d = (await ctx.api('get', '/dashboard/executive?period=month')).body.data;
      expect(d.period).toMatchObject({ code: 'month', from: range.from, to: range.to, previousTo: range.prevTo });
      const sum = async (from, to) => Number((await pool.query(`SELECT COALESCE(sum(premium_total), 0) AS s FROM policies
        WHERE (created_at AT TIME ZONE 'Asia/Manila')::date BETWEEN $1::date AND $2::date`, [from, to])).rows[0].s);
      expect(d.executiveKPIs.totalRevenue.value).toBeCloseTo(await sum(range.from, range.end), 2);
      const inMonth = (await pool.query(`SELECT count(*)::int AS n FROM policies WHERE id = $1
        AND created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Manila')`, [ids[0], range.from])).rows[0].n;
      expect(inMonth).toBe(1);
      // the previous-period figure is the whole previous calendar month (the 00:00 - 00:30 policy is in it)
      const prev = await sum(range.prevFrom, range.prevTo);
      expect(prev).toBeGreaterThan(0);
    } finally {
      for (const r of saved) await pool.query('UPDATE policies SET created_at = $2 WHERE id = $1', [r.id, r.created_at]);
    }
  });

  it('calendar periods at month, quarter and year boundaries (Manila vs UTC midnight)', async () => {
    const { calendarPeriod } = await import('../src/lib/dates.js');
    // 16:30 UTC on 31 Aug = 00:30 on 1 Sep in Manila: already September
    expect(await calendarPeriod('month', new Date('2026-08-31T16:30:00Z'))).toMatchObject({
      from: '2026-09-01', to: '2026-09-01', end: '2026-09-30', prevFrom: '2026-08-01', prevTo: '2026-08-31', timeZone: 'Asia/Manila' });
    // 15:59 UTC on 31 Aug = 23:59 Manila: still August
    expect(await calendarPeriod('month', new Date('2026-08-31T15:59:00Z'))).toMatchObject({ from: '2026-08-01', to: '2026-08-31', prevFrom: '2026-07-01' });
    expect(await calendarPeriod('quarter', new Date('2026-09-29T03:00:00Z'))).toMatchObject({ from: '2026-07-01', end: '2026-09-30', prevFrom: '2026-04-01', prevTo: '2026-06-30' });
    expect(await calendarPeriod('quarter', new Date('2026-01-15T03:00:00Z'))).toMatchObject({ from: '2026-01-01', prevFrom: '2025-10-01', prevTo: '2025-12-31' });
    // 16:30 UTC on 31 Dec = 1 Jan in Manila: the new year
    expect(await calendarPeriod('year', new Date('2026-12-31T16:30:00Z'))).toMatchObject({ from: '2027-01-01', end: '2027-12-31', prevFrom: '2026-01-01', prevTo: '2026-12-31' });
    expect((await calendarPeriod('bogus', new Date('2026-09-29T03:00:00Z'))).period).toBe('month');
  });
});

describe('dashboards', () => {
  it('executive KPIs are computed from the tables', async () => {
    const r = await ctx.api('get', '/dashboard/executive?period=year');
    const d = r.body.data;
    // "This Year" is the calendar year to date in Manila time (not a rolling 365 days)
    const total = Number((await pool.query(`SELECT COALESCE(sum(premium_total), 0) AS s FROM policies
      WHERE (created_at AT TIME ZONE 'Asia/Manila')::date >= date_trunc('year', now() AT TIME ZONE 'Asia/Manila')::date`)).rows[0].s);
    expect(d.executiveKPIs.totalRevenue.value).toBeCloseTo(total, 2);
    expect(d.period.from).toMatch(/^\d{4}-01-01$/);
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
