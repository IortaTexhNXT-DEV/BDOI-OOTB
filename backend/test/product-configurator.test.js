import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let salesToken;
beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'p.sales', password: 'Welcome@123', displayName: 'P Sales', roles: ['sales'] });
  salesToken = await loginAs(ctx.app, 'p.sales', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);

describe('product templates', () => {
  let id;
  it('lists seeded templates in the captured shape', async () => {
    const r = await ctx.api('get', '/product-configurator/products');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ page: 1, total: expect.any(Number) });
    const mot = r.body.data.find((t) => t.templateCode === 'MOT-003-2025');
    expect(mot).toMatchObject({ name: 'Motor Insurance Basic Plan', status: 'Active', version: 'v3.2', baseRate: 2.5, _count: { coverages: 7, ratingFactors: 8, underwritingRules: 7 } });
    expect(mot.configuration.premiumRates.private_cars).toBe('2');
  });
  it('configurator returns the template at the top level and under data', async () => {
    const r = await as(salesToken, 'get', '/product-configurator/products/configurator?templateCode=MOT-003-2025');
    expect(r.status).toBe(200);
    expect(r.body.configuration.ctplSetting.private_cars).toBe('447.01');
    expect(r.body.data.coverages).toHaveLength(7);
    expect((await ctx.api('get', '/product-configurator/products/configurator')).status).toBe(400);
    expect((await ctx.api('get', '/product-configurator/products/configurator?templateCode=NOPE')).status).toBe(404);
  });
  it('creates, updates, versions, retires and reactivates a template', async () => {
    const bad = await ctx.api('post', '/product-configurator/products').send({ name: 'x' });
    expect(bad.status).toBe(400);
    const c = await ctx.api('post', '/product-configurator/products').send({ templateCode: 'FIRE-RES-2026', name: 'Home Fire Protect', category: 'Fire', lineOfBusiness: 'Fire', effectiveDate: '2026-01-01T00:00:00.000Z', status: 'Draft', description: 'Residential' });
    expect(c.status).toBe(201);
    id = c.body.data.id;
    expect(c.body.data).toMatchObject({ templateCode: 'FIRE-RES-2026', effectiveDate: '2026-01-01', version: 'v1' });
    expect((await ctx.api('post', '/product-configurator/products').send({ templateCode: 'fire-res-2026', name: 'd', category: 'Fire', lineOfBusiness: 'Fire', effectiveDate: '2026-01-01', status: 'Draft' })).status).toBe(409);
    const u = await ctx.api('put', `/product-configurator/products/${id}`).send({ status: 'Active', baseRate: 0.35, minPremium: 1500, commissionRate: 20, configuration: { perils: ['Fire', 'Lightning'] } });
    expect(u.body.data).toMatchObject({ status: 'Active', baseRate: 0.35, configuration: { perils: ['Fire', 'Lightning'] } });
    const s = await ctx.api('get', '/product-configurator/products?search=home fire');
    expect(s.body.data.map((t) => t.id)).toContain(id);
    const cov = await ctx.api('post', '/product-configurator/coverages').send({ productId: id, coverageCode: 'FLEXA', coverageName: 'Fire & Lightning', type: 'Mandatory', deductible: '1,000', waitingPeriod: 0, premiumImpact: 'Base', description: 'Basic' });
    expect(cov.status).toBe(201);
    expect(cov.body.data).toMatchObject({ productId: id, deductible: 1000 });
    const v = await ctx.api('post', `/product-configurator/products/${id}/versions`).send({});
    expect(v.status).toBe(201);
    expect(v.body.data).toMatchObject({ status: 'Draft', version: 'v2', parentId: id, _count: { coverages: 1 } });
    expect((await ctx.api('get', `/product-configurator/products/${id}/versions`)).body.data).toHaveLength(2);
    const ret = await ctx.api('post', `/product-configurator/products/${id}/retire`).send({ reason: 'Superseded' });
    expect(ret.body.data).toMatchObject({ status: 'Retired', retiredReason: 'Superseded' });
    expect((await ctx.api('post', `/product-configurator/products/${id}/retire`)).status).toBe(400);
    expect((await ctx.api('post', `/product-configurator/products/${id}/reactivate`)).body.data.status).toBe('Active');
  });
  it('manages the insurer panel and calculates a premium illustration', async () => {
    const p = await ctx.api('put', `/product-configurator/products/${id}/insurers`).send({ insurers: ['MALAYAN', 'FPG'] });
    expect(p.body.data.insurers).toEqual(['Malayan Insurance Co., Inc.', 'FPG Insurance Co., Inc.']);
    expect((await ctx.api('put', `/product-configurator/products/${id}/insurers`).send({ insurers: ['Nobody Insurance'] })).status).toBe(400);
    const panel = await ctx.api('get', `/product-configurator/products/${id}/insurers`);
    expect(panel.body.data[0]).toMatchObject({ insurerCode: 'MALAYAN', onPanel: true });
    const q = await ctx.api('post', `/product-configurator/products/${id}/calculate-premium`).send({ sumInsured: 1000000, factors: { CONST: 1.2 } });
    expect(q.body.data).toMatchObject({ basePremium: 3500, ratedPremium: 4200, adjustedPremium: 4200, commission: 840 });
    expect(q.body.data.taxes.find((t) => t.code === 'DST').amount).toBe(525);
    expect((await ctx.api('post', `/product-configurator/products/${id}/calculate-premium`).send({})).status).toBe(400);
  });
  it('denies writes without products permission', async () => {
    await ctx.api('post', '/users').send({ username: 'p.claims', password: 'Welcome@123', displayName: 'P Claims', roles: ['claims'] });
    const tok = await loginAs(ctx.app, 'p.claims', 'Welcome@123');
    expect((await as(tok, 'get', '/product-configurator/products')).status).toBe(403);
    expect((await as(salesToken, 'post', '/product-configurator/products').send({})).status).toBe(403);
  });
});

describe('components, analytics and dashboard', () => {
  it('CRUD for every component kind used by the mock-only screens', async () => {
    for (const [kind, body] of Object.entries({
      'rating-factors': { factorCode: 'TST_F', factorName: 'Test factor', type: 'Multiplicative', rules: [{ condition: 'x', factor: 1.1 }] },
      'underwriting-rules': { ruleCode: 'TST_R', ruleName: 'Test rule', type: 'Acceptance', condition: 'SI < 1M', action: 'Auto-Accept' },
      documents: { documentCode: 'TST_D', documentName: 'Schedule', type: 'Policy Document', format: 'PDF' },
      taxes: { taxCode: 'PT', taxName: 'Premium tax', rate: 2, basis: 'Premium' },
      'acceptance-limits': { limitCode: 'L1', limitName: 'Limit', maxSumInsured: 5000000 },
      'rating-parameters': { parameterCode: 'P1', parameterName: 'Param', value: 3 },
      'market-mappings': { insurerName: 'Pioneer Insurance & Surety Corp.', productCode: 'PIO-X', commissionRate: 14 },
      commissions: { structureName: 'Tiered', type: 'Tiered', tiers: [{ from: 0, to: null, rate: 12 }] },
    })) {
      const c = await ctx.api('post', `/product-configurator/${kind}`).send({ templateCode: 'MOT-003-2025', ...body });
      expect(c.status, kind).toBe(201);
      const u = await ctx.api('put', `/product-configurator/${kind}/${c.body.data.id}`).send({ status: 'Inactive' });
      expect(u.body.data.status).toBe('Inactive');
      const l = await ctx.api('get', `/product-configurator/${kind}?templateCode=MOT-003-2025`);
      expect(l.body.data.some((x) => x.id === c.body.data.id)).toBe(true);
      expect((await ctx.api('delete', `/product-configurator/${kind}/${c.body.data.id}`)).status).toBe(200);
      expect((await ctx.api('get', `/product-configurator/${kind}/${c.body.data.id}`)).status).toBe(404);
    }
    const wf = await ctx.api('post', '/product-configurator/workflows').send({ workflowCode: 'WF_T', workflowName: 'Global', type: 'Sequential', stages: [] });
    expect(wf.status).toBe(201);
    expect(wf.body.data.productId).toBeNull();
    expect((await ctx.api('post', '/product-configurator/coverages').send({ coverageCode: 'X', coverageName: 'X', type: 'Optional' })).status).toBe(400);
    const dup = await ctx.api('post', '/product-configurator/coverages').send({ templateCode: 'MOT-003-2025', coverageCode: 'OD', coverageName: 'Dup', type: 'Optional' });
    expect(dup.status).toBe(409);
  });
  it('analytics and dashboard return the screen shapes', async () => {
    const a = await ctx.api('get', '/product-configurator/analytics');
    expect(a.status).toBe(200);
    expect(Array.isArray(a.body.data.topProducts)).toBe(true);
    expect(a.body.data.performanceTrend).toHaveLength(6);
    const d = await ctx.api('get', '/product-configurator/dashboard');
    expect(d.body.data.summary.totalTemplates).toBeGreaterThanOrEqual(12);
    expect(d.body.data.summary.retired).toBeGreaterThanOrEqual(1);
  });
});

describe('risk mappings', () => {
  it('lists, reads and updates configuration', async () => {
    const l = await ctx.api('get', '/product-configurator/risk-mappings?definitionType=RISK_SECTIONS');
    expect(l.body).toMatchObject({ success: true, total: 1 });
    expect(l.body.data[0]).toMatchObject({ id: 'prm_iar', sectionCount: 4 });
    const g = await ctx.api('get', '/product-configurator/risk-mappings/prm_ctpl');
    expect(g.body.data).toMatchObject({ productCode: 'PRD-CTP', sections: [] });
    const u = await ctx.api('put', '/product-configurator/risk-mappings/prm_ctpl').send({ configuration: { fields: ['plateNo'] } });
    expect(u.body.data.configuration).toEqual({ fields: ['plateNo'], type: 'CTPL' });
    expect((await ctx.api('put', '/product-configurator/risk-mappings/prm_ctpl').send({ configuration: [] })).status).toBe(400);
    expect((await ctx.api('get', '/product-configurator/risk-mappings/nope')).status).toBe(404);
  });
  it('adds, updates, deactivates and re-adds IAR sections', async () => {
    const opts = await ctx.api('get', '/product-configurator/risk-mappings/prm_iar/section-options');
    const codes = opts.body.data.map((o) => o.sectionCode);
    expect(codes).toContain('MB');
    expect(codes).not.toContain('FIRE');
    const add = await ctx.api('post', '/product-configurator/risk-mappings/prm_iar/sections').send({ sectionCode: 'MB', remarks: 'Plant', defaultRatePercent: 0.2 });
    expect(add.status).toBe(201);
    const sec = add.body.data.sections.find((s) => s.sectionCode === 'MB');
    expect(sec).toMatchObject({ sectionLabel: 'Machinery Breakdown', defaultRatePercent: 0.2 });
    expect((await ctx.api('post', '/product-configurator/risk-mappings/prm_iar/sections').send({ sectionCode: 'MB' })).status).toBe(409);
    expect((await ctx.api('post', '/product-configurator/risk-mappings/prm_iar/sections').send({ sectionCode: 'ZZZ' })).status).toBe(400);
    const up = await ctx.api('put', `/product-configurator/risk-mappings/prm_iar/sections/${sec.id}`).send({ defaultRatePercent: 0.4 });
    expect(up.body.data.sections.find((s) => s.id === sec.id).defaultRatePercent).toBe(0.4);
    const de = await ctx.api('post', `/product-configurator/risk-mappings/prm_iar/sections/${sec.id}/deactivate`);
    expect(de.body.data.sections.some((s) => s.id === sec.id)).toBe(false);
    const all = await ctx.api('get', '/product-configurator/risk-mappings/prm_iar?includeInactive=true');
    expect(all.body.data.sections.find((s) => s.id === sec.id).isActive).toBe(false);
    const again = await ctx.api('post', '/product-configurator/risk-mappings/prm_iar/sections').send({ sectionCode: 'MB' });
    expect(again.body.data.sectionCount).toBe(5);
    const nm = await ctx.api('post', '/product-configurator/risk-mappings').send({ productCode: 'PRD-MAR', lobCode: 'MARINE', productName: 'Marine Cargo', definitionType: 'PROPERTY_RISK_FIELDS' });
    expect(nm.status).toBe(201);
    expect(nm.body.data).toMatchObject({ status: 'Draft', configuration: { type: 'MARINE' } });
  });
});
