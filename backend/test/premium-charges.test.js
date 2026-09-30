import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { calculateCharges, chargeAmount, lineOf, ruleApplies, sumCharges } from '../src/modules/premium-charges/calculator.js';

const RULES = [
  { code: 'VAT', name: 'Value Added Tax', kind: 'vat', method: 'percent', rate: 12, regimes: ['vat'], sortOrder: 10, active: true },
  { code: 'PT', name: 'Premium Tax', kind: 'premium_tax', method: 'percent', rate: 2, regimes: ['premium_tax'], sortOrder: 20, active: true },
  { code: 'DST', name: 'Documentary Stamp Tax', kind: 'dst', method: 'per_unit', unitAmount: 0.5, unitSize: 4, fractionRule: 'round_up', sortOrder: 30, active: true },
  { code: 'FST', name: 'Fire Service Tax', kind: 'fst', method: 'percent', rate: 2, lines: ['fire'], sortOrder: 40, active: true },
  { code: 'LGT', name: 'Local Government Tax', kind: 'lgt', method: 'percent', rate: 0.2, sortOrder: 50, active: true },
];

describe('premium tax formulas', () => {
  it('prices VAT, DST per P4.00, FST on fire and LGT for a fire premium', () => {
    const c = calculateCharges(RULES, { premium: 10000, line: 'fire', lguRate: 0.2 });
    expect(c).toMatchObject({ vat: 1200, premiumTax: 0, dst: 1250, fst: 200, lgt: 20, other: 0, taxes: 2670, totalCharges: 2670, total: 12670 });
    expect(c.lines.map((l) => l.code)).toEqual(['VAT', 'DST', 'FST', 'LGT']);
  });
  it('charges DST on every P4.00 or fractional part (round up) or proportionally (prorate)', () => {
    const dst = RULES[2];
    expect(chargeAmount(dst, 1000).amount).toBe(125);
    expect(chargeAmount(dst, 1001).amount).toBe(125.5);
    expect(chargeAmount(dst, 1000.01).amount).toBe(125.5);
    expect(chargeAmount(dst, 3.99).amount).toBe(0.5);
    expect(chargeAmount({ ...dst, fractionRule: 'prorate' }, 1001).amount).toBe(125.13);
    expect(chargeAmount(dst, 1000).rate).toBe(12.5);
  });
  it('leaves the fire service tax out of non-property lines unless the section is flagged as property', () => {
    expect(calculateCharges(RULES, { premium: 5000, line: 'casualty' }).fst).toBe(0);
    expect(calculateCharges(RULES, { premium: 5000, line: 'casualty', property: true }).fst).toBe(100);
    expect(calculateCharges(RULES, { premium: 5000, line: 'fire', property: false }).fst).toBe(0);
    expect(ruleApplies(RULES[3], { line: 'IAR' })).toBe(true);
    expect(lineOf('Householder Insurance')).toBe('fire');
    expect(lineOf('MOTOR')).toBe('motor');
  });
  it('uses the premium tax instead of VAT for premium-tax products and neither for exempt ones', () => {
    const pt = calculateCharges(RULES, { premium: 10000, line: 'accident', regime: 'premium_tax' });
    expect(pt).toMatchObject({ vat: 0, premiumTax: 200, dst: 1250, lgt: 20 });
    const ex = calculateCharges(RULES, { premium: 10000, line: 'accident', regime: 'exempt' });
    expect(ex).toMatchObject({ vat: 0, premiumTax: 0, dst: 1250 });
  });
  it('rounds every amount to 2 decimals half away from zero and totals the rounded lines', () => {
    const c = calculateCharges(RULES, { premium: 1234.565, line: 'fire', lguRate: 0.75 });
    expect(c.premium).toBe(1234.57);
    expect(c.vat).toBe(148.15); // 1234.57 x 12% = 148.1484
    expect(c.fst).toBe(24.69); // 24.6914
    expect(c.lgt).toBe(9.26); // 9.259275
    expect(c.dst).toBe(154.5); // 308.64 units -> 309 x 0.50
    expect(c.total).toBe(Math.round((1234.57 + 148.15 + 154.5 + 24.69 + 9.26) * 100) / 100);
    expect(chargeAmount({ kind: 'vat', method: 'percent', rate: 12 }, 0.125).amount).toBe(0.02); // 0.015 -> 0.02
  });
  it('applies the LGU rate, the rule rate without one, flat charges once and minimum amounts', () => {
    expect(calculateCharges(RULES, { premium: 10000, line: 'motor', lguRate: 0.5 }).lgt).toBe(50);
    expect(calculateCharges(RULES, { premium: 10000, line: 'motor' }).lgt).toBe(20);
    const flat = { code: 'NOTARIAL', name: 'Notarial Fee', kind: 'other', method: 'flat', unitAmount: 100, sortOrder: 90, active: true };
    expect(calculateCharges([...RULES, flat], { premium: 1000, line: 'motor' }).other).toBe(100);
    expect(calculateCharges([...RULES, flat], { premium: 1000, line: 'motor', includeFlat: false }).other).toBe(0);
    expect(chargeAmount({ kind: 'other', method: 'percent', rate: 1, minimumAmount: 50 }, 1000).amount).toBe(50);
  });
  it('skips rules outside their effective dates and gives negative charges on a return premium', () => {
    const old = { ...RULES[0], effectiveFrom: '2020-01-01', effectiveTo: '2020-12-31' };
    expect(calculateCharges([old], { premium: 1000, date: '2026-09-30' }).vat).toBe(0);
    const r = calculateCharges(RULES, { premium: -1000, line: 'fire' });
    expect(r).toMatchObject({ vat: -120, dst: -125, fst: -20, lgt: -2, total: -1267 });
  });
  it('adds section results line by line', () => {
    const a = calculateCharges(RULES, { premium: 1000, line: 'fire' });
    const b = calculateCharges(RULES, { premium: 2000, line: 'casualty' });
    const s = sumCharges([a, b]);
    expect(s).toMatchObject({ premium: 3000, vat: 360, dst: 375, fst: 20, total: a.total + b.total });
    expect(s.lines.find((l) => l.code === 'VAT').amount).toBe(360);
  });
});

let ctx;
let sales;
let accounting;
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

describe('premium charges API', () => {
  beforeAll(async () => {
    ctx = await setup();
    sales = await persona('pc.sales', ['sales']);
    accounting = await persona('pc.accounting', ['accounting']);
  });
  afterAll(async () => { await pool.end(); });

  it('lists the seeded rules and Metro Manila LGU rates', async () => {
    const rules = await sales('get', '/premium-charges/rules');
    expect(rules.status).toBe(200);
    expect(rules.body.data.map((r) => r.code)).toEqual(expect.arrayContaining(['VAT', 'PT', 'DST', 'FST', 'LGT', 'NOTARIAL']));
    const lgus = await sales('get', '/premium-charges/lgu-rates?search=Makati');
    expect(lgus.body.data[0]).toMatchObject({ code: 'MKT', rate: 0.2, province: 'Metro Manila' });
  });

  it('calculates the charges of a product premium at a location', async () => {
    const r = await sales('post', '/premium-charges/calculate').send({ premium: 10000, productId: 'HOME', lguCode: 'MKT' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ vat: 1200, dst: 1250, fst: 200, lgt: 20, total: 12670, line: 'fire', regime: 'vat', lgu: { code: 'MKT' } });
    const pa = await sales('post', '/premium-charges/calculate').send({ premium: 1000, productId: 'PA' });
    expect(pa.body.data).toMatchObject({ fst: 0, lgt: 2, total: 1000 + 120 + 125 + 2 });
    expect((await sales('post', '/premium-charges/calculate').send({ premium: 'x' })).status).toBe(400);
  });

  it('lets Accounting maintain rules and LGU rates; Sales cannot', async () => {
    expect((await sales('post', '/premium-charges/lgu-rates').send({ code: 'VAL', name: 'Valenzuela', rate: 0.3 })).status).toBe(403);
    const add = await accounting('post', '/premium-charges/lgu-rates').send({ code: 'val', name: 'Valenzuela', province: 'Metro Manila', rate: 0.3 });
    expect(add.status).toBe(201);
    expect(add.body.data.code).toBe('VAL');
    expect((await accounting('post', '/premium-charges/lgu-rates').send({ code: 'VAL', name: 'Again', rate: 0.3 })).status).toBe(409);
    const upd = await accounting('put', `/premium-charges/lgu-rates/${add.body.data.id}`).send({ rate: 0.35 });
    expect(upd.body.data.rate).toBe(0.35);
    const c = await sales('post', '/premium-charges/calculate').send({ premium: 10000, line: 'motor', city: 'Valenzuela' });
    expect(c.body.data.lgt).toBe(35);
    expect((await accounting('delete', `/premium-charges/lgu-rates/${add.body.data.id}`)).status).toBe(200);

    const rule = await accounting('post', '/premium-charges/rules').send({ code: 'STAMPS', name: 'Policy stamps', kind: 'other', method: 'flat', unitAmount: 30 });
    expect(rule.status).toBe(201);
    expect((await accounting('post', '/premium-charges/rules').send({ code: 'BAD', name: 'Bad', kind: 'other', method: 'per_unit' })).status).toBe(400);
    const off = await accounting('put', '/premium-charges/rules/STAMPS').send({ active: false });
    expect(off.body.data.active).toBe(false);
    expect((await accounting('delete', '/premium-charges/rules/DST')).status).toBe(400);
    expect((await accounting('delete', '/premium-charges/rules/STAMPS')).status).toBe(200);
    expect((await sales('put', '/premium-charges/rules/VAT').send({ rate: 10 })).status).toBe(403);
  });

  it('keeps quotations on the settings rates unless the engine is asked for', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Tess', lastName: 'Aquino', emailId: 'tess.aquino@example.ph', contactNumber: '09170000011', leadCategory: 'Retail' });
    const plain = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Fire', lob: 'FIRE', netPremium: '1001', participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }] });
    expect(plain.status).toBe(201);
    const row = (await pool.query('SELECT vat, dst, lgt, fst, others FROM quotes WHERE id = $1', [plain.body.quotationId])).rows[0];
    expect(row).toMatchObject({ vat: 120.12, dst: 125.13, lgt: 7.51, fst: 20.02 });
    const engine = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Fire', lob: 'FIRE', netPremium: '1001', chargeEngine: true, lguCode: 'MKT',
      participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }] });
    expect(engine.status).toBe(201);
    const e = (await pool.query('SELECT vat, dst, lgt, fst, others, premium_total, doc FROM quotes WHERE id = $1', [engine.body.quotationId])).rows[0];
    expect(e).toMatchObject({ vat: 120.12, dst: 125.5, lgt: 2, fst: 20.02, premium_total: 1268.64 });
    expect(e.doc.premiumBreakdown.charges.lgu).toMatchObject({ code: 'MKT' });
  });
});
