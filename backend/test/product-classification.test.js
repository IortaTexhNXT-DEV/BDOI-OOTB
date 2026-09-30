import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let sales;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const journey = async (params) => (await sales('get', `/placements/journey?${new URLSearchParams(params)}`)).body.data;
const setSettings = (settings) => ctx.api('put', '/settings').send({ settings });

beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'pc.sales', password: 'Welcome@123', displayName: 'pc.sales', email: 'pc.sales@example.ph', roles: ['sales'] });
  const token = await loginAs(ctx.app, 'pc.sales', 'Welcome@123');
  sales = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
});
afterAll(async () => { await pool.end(); });

describe('product classification', () => {
  it('seeds package and non-package products with their customer segment', async () => {
    const rows = Object.fromEntries((await q('SELECT code, business_type, customer_segment FROM products')).map((p) => [p.code, p]));
    for (const code of ['MOTOR', 'CTPL', 'PA', 'TRAVEL', 'HOME', 'MICRO', 'GPA']) expect(rows[code].business_type).toBe('package');
    for (const code of ['FIRE', 'IAR', 'CAR', 'EAR', 'MB', 'MARINE', 'HULL', 'CGL', 'BOND', 'MONEY', 'EB']) expect(rows[code].business_type).toBe('non_package');
    expect(rows.MOTOR.customer_segment).toBe('retail');
    expect(rows.FIRE.customer_segment).toBe('corporate');
    expect(rows.GPA.customer_segment).toBe('both');
  });

  it('shows and filters the classification on the placement options and the product master', async () => {
    const all = (await sales('get', '/placements/options')).body.data.products;
    expect(all.find((p) => p.code === 'HOME')).toMatchObject({ businessType: 'package', customerSegment: 'retail' });
    const pkg = (await sales('get', '/placements/options?businessType=package')).body.data.products;
    expect(pkg.map((p) => p.code)).toEqual(expect.arrayContaining(['MOTOR', 'PA', 'TRAVEL']));
    expect(pkg.every((p) => p.businessType === 'package')).toBe(true);
    const def = (await ctx.api('get', '/masters/product/definition')).body.data;
    expect(def.fields.find((f) => f.name === 'businessType')).toMatchObject({ type: 'select', options: ['package', 'non_package'] });
    expect(def.fields.find((f) => f.name === 'customerSegment')).toMatchObject({ type: 'select', options: ['retail', 'corporate', 'both'] });
  });
});

describe('journey defaults from the business type', () => {
  it('the seeded line entries equal to the business-type defaults were removed', async () => {
    const [row] = await q("SELECT value FROM app_settings WHERE key = 'placement.journey'");
    expect(Object.keys(row.value)).toEqual(['default']);
  });

  it('package: quotation required, broker and placement slips optional', async () => {
    for (const productType of ['Personal Accident', 'Travel Insurance', 'Householder Insurance', 'Motor']) {
      expect(await journey({ productType })).toMatchObject({ businessType: 'package', source: 'businessType', quotationSlip: 'required', placementSlip: 'optional', brokerSlip: 'optional' });
    }
    // a line known only by its code takes the type of its products
    expect(await journey({ lob: 'ACCIDENT' })).toMatchObject({ businessType: 'package', lob: 'ACCIDENT' });
    expect(await journey({ lob: 'MOTOR' })).toMatchObject({ businessType: 'package', quotationSlip: 'required' });
  });

  it('non-package: placement slip required', async () => {
    for (const productType of ['Fire and Allied Perils', 'Industrial All Risks', 'Contractor\'s All Risks', 'Marine Hull', 'Money and Securities', 'Group Employee Benefits']) {
      expect(await journey({ productType })).toMatchObject({ businessType: 'non_package', source: 'businessType', placementSlip: 'required', brokerSlip: 'optional' });
    }
    expect(await journey({ lob: 'FIRE' })).toMatchObject({ businessType: 'non_package', lob: 'FIRE' });
  });

  it('a placement.journey entry for the line or product type still overrides the business type', async () => {
    const [saved] = await q("SELECT value FROM app_settings WHERE key = 'placement.journey'");
    try {
      await setSettings({ 'placement.journey': { ...saved.value, ACCIDENT: { placementSlip: 'required' }, 'Travel Insurance': { brokerSlip: 'skip' } } });
      expect(await journey({ productType: 'Personal Accident' })).toMatchObject({ source: 'entry', key: 'ACCIDENT', placementSlip: 'required', quotationSlip: 'required' });
      expect(await journey({ productType: 'Travel Insurance' })).toMatchObject({ source: 'entry', key: 'Travel Insurance', brokerSlip: 'skip', placementSlip: 'optional' });
    } finally {
      await setSettings({ 'placement.journey': saved.value });
    }
  });

  it('reclassifying a product on the Product master changes its journey without a code change', async () => {
    const [pa] = await q("SELECT id FROM products WHERE code = 'PA'");
    const bad = await ctx.api('put', `/masters/product/${pa.id}`).send({ businessType: 'retail' });
    expect(bad.status).toBe(400);
    const r = await ctx.api('put', `/masters/product/${pa.id}`).send({ businessType: 'non_package', customerSegment: 'corporate' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ businessType: 'non_package', customerSegment: 'corporate' });
    try {
      expect(await journey({ productType: 'Personal Accident' })).toMatchObject({ businessType: 'non_package', placementSlip: 'required' });
    } finally {
      await ctx.api('put', `/masters/product/${pa.id}`).send({ businessType: 'package', customerSegment: 'retail' });
    }
  });

  it('the business-type journey is itself a setting', async () => {
    const [saved] = await q("SELECT value FROM app_settings WHERE key = 'placement.journey_by_business_type'");
    try {
      await setSettings({ 'placement.journey_by_business_type': { ...saved.value, package: { ...saved.value.package, brokerSlip: 'skip', placementSlip: 'skip' } } });
      expect(await journey({ productType: 'Travel Insurance' })).toMatchObject({ brokerSlip: 'skip', placementSlip: 'skip' });
      const lead = await sales('post', '/leads').send({ firstName: 'Tess', lastName: 'Ramos', emailId: 'tess.r@example.ph', contactNumber: '09170000451', leadCategory: 'Retail' });
      const slip = await sales('post', '/broker-slips').send({ leadRefId: lead.body.leadId, productType: 'Travel Insurance', sumInsured: 50000 });
      expect(slip.status).toBe(400);
    } finally {
      await setSettings({ 'placement.journey_by_business_type': saved.value });
    }
  });
});
