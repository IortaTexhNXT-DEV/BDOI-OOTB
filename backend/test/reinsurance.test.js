import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let uw;
let sales;
beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'ri.uw', password: 'Welcome@123', displayName: 'RI Underwriter', roles: ['underwriting'] });
  await ctx.api('post', '/users').send({ username: 'ri.sales', password: 'Welcome@123', displayName: 'RI Sales', roles: ['sales'] });
  uw = await loginAs(ctx.app, 'ri.uw', 'Welcome@123');
  sales = await loginAs(ctx.app, 'ri.sales', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);

describe('reinsurers and security gate', () => {
  it('lists reinsurers against the configured minimum rating', async () => {
    const r = await ctx.api('get', '/reinsurance/reinsurers');
    expect(r.body.minimumRating).toBe('A-');
    expect(r.body.data.find((x) => x.id === 'RE005')).toMatchObject({ rating: 'BBB+', meetsMinimumRating: false });
    expect(r.body.data.find((x) => x.id === 'RE001').meetsMinimumRating).toBe(true);
    const p = await ctx.api('get', '/reinsurance/security-policy');
    expect(p.body.data.scale[0]).toMatchObject({ rating: 'AAA' });
  });
  it('creates and updates a reinsurer; rejects unknown ratings', async () => {
    expect((await ctx.api('post', '/reinsurance/reinsurers').send({ name: 'X Re', type: 'Regional', rating: 'Z' })).status).toBe(400);
    const c = await ctx.api('post', '/reinsurance/reinsurers').send({ name: 'Luzon Re', type: 'Local', rating: 'a', country: 'Philippines' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ rating: 'A', meetsMinimumRating: true });
    const u = await ctx.api('put', `/reinsurance/reinsurers/${c.body.data.id}`).send({ rating: 'BB' });
    expect(u.body.data.meetsMinimumRating).toBe(false);
  });
});

describe('treaties', () => {
  let id;
  it('blocks treaties with reinsurers below the minimum rating', async () => {
    const r = await ctx.api('post', '/reinsurance/treaties').send({ treatyNumber: 'QS-X', name: 'X', type: 'Quota Share', lineOfBusiness: 'Motor', reinsurers: ['RE001', 'RE005'], effectiveDate: '2027-01-01', expiryDate: '2027-12-31' });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toMatch(/BBB\+.*minimum.*A-/);
    expect((await ctx.api('post', '/reinsurance/treaties').send({ name: 'X' })).status).toBe(400);
  });
  it('creates a treaty pending approval; maker cannot approve; checker approves', async () => {
    const c = await ctx.api('post', '/reinsurance/treaties').send({ treatyNumber: 'QS-PA-2026', name: 'PA Quota Share 2026', type: 'Quota Share', lineOfBusiness: 'Personal Accident', reinsurers: ['RE002'], effectiveDate: '2026-01-01', expiryDate: '2026-12-31', capacity: 1000000, cession: { percentage: 50, maxLimit: 1000000 }, commission: { type: 'Flat', rate: 30 } });
    expect(c.status).toBe(201);
    id = c.body.data.id;
    expect(c.body.data).toMatchObject({ status: 'Pending Approval', securityRating: 'AA-', cession: { percentage: 50 }, utilization: 0 });
    expect((await ctx.api('post', '/reinsurance/treaties').send({ treatyNumber: 'qs-pa-2026', name: 'd', type: 'Quota Share', lineOfBusiness: 'Motor', reinsurers: ['RE002'], effectiveDate: '2026-01-01', expiryDate: '2026-12-31' })).status).toBe(409);
    expect((await ctx.api('post', `/reinsurance/treaties/${id}/approve`)).status).toBe(403);
    expect((await as(uw, 'post', `/reinsurance/treaties/${id}/reject`).send({})).status).toBe(400);
    const a = await as(uw, 'post', `/reinsurance/treaties/${id}/approve`);
    expect(a.status).toBe(200);
    expect(a.body.data.status).toBe('Active');
    expect((await ctx.api('get', '/reinsurance/treaties?status=Pending Approval'.replace(' ', '%20'))).body.data.map((t) => t.treatyNumber)).toContain('QS-MARINE-2027');
  });
  it('seeded treaties report premium ceded, claims recovered and utilization', async () => {
    const t = await ctx.api('get', '/reinsurance/treaties/QS-MOTOR-2026');
    expect(t.body.data.premiumCeded).toBeGreaterThan(0);
    expect(t.body.data.utilization).toBeGreaterThan(0);
    expect(t.body.data.reinsurerDetails.map((r) => r.id)).toEqual(['RE001', 'RE002']);
    expect((await ctx.api('get', `/reinsurance/treaties/${t.body.data.id}/cessions`)).body.data.length).toBeGreaterThan(0);
    expect((await ctx.api('get', `/reinsurance/treaties/${t.body.data.id}/claims`)).body.data.length).toBeGreaterThan(0);
    const cap = await ctx.api('get', `/reinsurance/treaties/${t.body.data.id}/capacity`);
    expect(cap.body.data).toMatchObject({ capacity: 50000000, cessionPercentage: 40 });
  });
  it('cessions: share, capacity check, maker-checker confirmation, facultative gate', async () => {
    const c = await ctx.api('post', '/reinsurance/cessions').send({ treatyId: id, policyNumber: 'EXT-PA-1', insured: 'Test Insured', sumInsured: 1000000, grossPremium: 20000, cessionDate: '2026-09-01' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ cessionPercentage: 50, cededSumInsured: 500000, cededPremium: 10000, commission: 3000, netPremium: 7000, status: 'Pending' });
    const over = await ctx.api('post', '/reinsurance/cessions').send({ treatyId: id, policyNumber: 'EXT-PA-2', sumInsured: 1200000, grossPremium: 20000, cessionDate: '2026-09-01' });
    expect(over.status).toBe(400);
    expect(over.body.errors[0].message).toMatch(/capacity/);
    expect((await ctx.api('post', '/reinsurance/cessions').send({ treatyId: id, policyNumber: 'EXT', sumInsured: 10, grossPremium: 1, cessionDate: '2025-01-01' })).status).toBe(400);
    expect((await ctx.api('post', `/reinsurance/cessions/${c.body.data.id}/confirm`)).status).toBe(403);
    expect((await as(uw, 'post', `/reinsurance/cessions/${c.body.data.id}/confirm`)).body.data.status).toBe('Confirmed');
    const fac = await ctx.api('post', '/reinsurance/cessions').send({ type: 'Facultative', facultativeReinsurer: 'RE005', policyNumber: 'EXT-MAR', sumInsured: 1000, grossPremium: 100, cessionPercentage: 50 });
    expect(fac.status).toBe(400);
    const surplus = await ctx.api('post', '/reinsurance/cessions').send({ treatyNumber: 'SURPLUS-PROP-2026', policyNumber: 'EXT-PROP', sumInsured: 30000000, grossPremium: 90000, cessionDate: '2026-09-10' });
    expect(surplus.body.data).toMatchObject({ cededSumInsured: 20000000, cessionPercentage: 66.67 });
  });
  it('recoveries: register, submit, settle', async () => {
    const r = await ctx.api('post', '/reinsurance/claims').send({ claimNumber: 'EXT-CLM-1', treatyId: id, grossClaim: 100000, causeOfLoss: 'Accident' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ recoverableAmount: 50000, status: 'Pending' });
    expect((await ctx.api('post', `/reinsurance/claims/${r.body.data.id}/settle`).send({ settlementAmount: 1 })).status).toBe(409);
    expect((await ctx.api('post', `/reinsurance/claims/${r.body.data.id}/submit-recovery`)).body.data.status).toBe('Processing');
    const s = await ctx.api('post', `/reinsurance/claims/${r.body.data.id}/settle`).send({ settlementAmount: 50000 });
    expect(s.body.data).toMatchObject({ status: 'Recovered', settlementAmount: 50000 });
    expect((await ctx.api('get', `/reinsurance/treaties/${id}`)).body.data.claimsRecovered).toBe(50000);
    const xol = await ctx.api('post', '/reinsurance/claims').send({ claimNumber: 'CAT-1', treatyNumber: 'CAT-XOL-2026', treatyId: (await ctx.api('get', '/reinsurance/treaties/CAT-XOL-2026')).body.data.id, grossClaim: 250000000 });
    expect(xol.body.data.recoverableAmount).toBe(150000000);
  });
  it('bordereaux, reconciliation, analytics and reports', async () => {
    const b = await ctx.api('post', '/reinsurance/bordereaux/generate').send({ type: 'Premium', period: '2026-09', treatyId: id });
    expect(b.status).toBe(201);
    expect(b.body.data).toMatchObject({ entries: 1, cededPremium: 10000, status: 'Draft', periodLabel: 'September 2026' });
    expect((await ctx.api('post', '/reinsurance/bordereaux/generate').send({ type: 'Premium', period: '2026-09', treatyId: id })).status).toBe(400);
    expect((await ctx.api('post', `/reinsurance/bordereaux/${b.body.data.id}/submit`)).body.data.status).toBe('Submitted');
    expect((await ctx.api('post', `/reinsurance/bordereaux/${b.body.data.id}/confirm`)).body.data.status).toBe('Confirmed');
    const rc = await ctx.api('post', '/reinsurance/reconciliation').send({ type: 'Premium', reinsurerId: 'RE002', period: '2026-09', theirAmount: 5000 });
    expect(rc.body.data.status).toBe('Pending Review');
    const res = await ctx.api('post', `/reinsurance/reconciliation/${rc.body.data.id}/resolve`).send({ resolution: 'Timing difference' });
    expect(res.body.data.status).toBe('Resolved');
    const rec = await ctx.api('get', '/reinsurance/reconciliation');
    expect(rec.body.data.pending.length).toBeGreaterThanOrEqual(3);
    const ex = await ctx.api('post', '/reinsurance/exceptions').send({ type: 'Missing Policy', description: 'x', amount: 10 });
    expect((await ctx.api('post', `/reinsurance/exceptions/${ex.body.data.id}/resolve`).send({ resolution: 'ok' })).body.data.status).toBe('Resolved');
    const an = await ctx.api('get', '/reinsurance/analytics');
    expect(an.body.data.treatyUtilization.length).toBeGreaterThanOrEqual(5);
    expect(an.body.data.lossRatioTrend).toHaveLength(9);
    expect(an.body.data.catastropheExposure.perils.map((p) => p.peril)).toEqual(['Typhoon', 'Earthquake', 'Flood']);
    const tpl = await ctx.api('get', '/reinsurance/reports/templates');
    expect(tpl.body.data[0].id).toBe('RPT001');
    const g = await ctx.api('post', '/reinsurance/reports/generate').send({ templateId: 'RPT001' });
    expect(g.body.data.rowCount).toBeGreaterThan(0);
  });
  it('denies users without reinsurance permission', async () => {
    expect((await as(sales, 'get', '/reinsurance/treaties')).status).toBe(403);
    expect((await as(uw, 'get', '/reinsurance/treaties')).status).toBe(200);
  });
});
