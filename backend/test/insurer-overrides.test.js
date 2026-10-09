/**
 * Overriding, profit and contingent commission from insurers (10.10): agreements with tiers, computation per period
 * from production and claims (production, loss ratio and growth bases; slab and banded tiers), maker-checker approval
 * posting the receivable, the sales invoice of the commission, and settlement against the insurer's statement.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { checkTiers, commissionFor, periodsOf, tierFor } from '../src/modules/insurer-overrides/service.js';

let ctx;
let maker;
let checker;
beforeAll(async () => {
  ctx = await setupFinance();
  maker = ctx.as('maker');
  checker = ctx.as('checker');
});
afterAll(async () => { await pool.end(); });

const lines = async (jvId) => (await query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId])).rows
  .map((l) => [l.account_code, Number(l.debit), Number(l.credit)]);
const insurerId = async (code) => (await query('SELECT id FROM insurance_companies WHERE code = $1', [code])).rows[0].id;
/** Net premium of an insurer's policies issued in a window (the production the agreement reads). */
const productionOf = async (id, from, to) => Number((await query(`SELECT COALESCE(sum(COALESCE(net_premium, NULLIF(details->>'netPremium','')::numeric, premium_total)), 0) AS s FROM policies
  WHERE insurance_company_id = $1 AND COALESCE(issued_date, inception_date) BETWEEN $2 AND $3 AND lower(status) NOT IN ('cancelled','void','draft','rejected')`, [id, from, to])).rows[0].s);

describe('tiers and periods', () => {
  it('validates tiers and reads slab and banded tiers', () => {
    expect(() => checkTiers([{ fromValue: 0, toValue: 100, rate: 1 }, { fromValue: 50, toValue: null, rate: 2 }])).toThrow(/overlaps/);
    expect(() => checkTiers([{ fromValue: 0, toValue: null, rate: 1 }, { fromValue: 100, toValue: 200, rate: 2 }])).toThrow(/open ended/);
    expect(() => checkTiers([{ fromValue: 0, toValue: 100, rate: 120 }])).toThrow(/between 0 and 100/);
    const tiers = checkTiers([{ fromValue: 100000, toValue: null, rate: 3 }, { fromValue: 0, toValue: 100000, rate: 1 }]);
    expect(tiers.map((t) => t.tierNo)).toEqual([1, 2]);
    expect(tierFor(tiers, 99999.99).tierNo).toBe(1);
    expect(tierFor(tiers, 100000).tierNo).toBe(2);
    expect(commissionFor({ tiers, tierMethod: 'slab', basis: 'production', minProduction: 0 }, 150000, 150000)).toMatchObject({ commission: 4500, rate: 3, tier: 2 });
    expect(commissionFor({ tiers, tierMethod: 'banded', basis: 'production', minProduction: 0 }, 150000, 150000)).toMatchObject({ commission: 2500, tier: 2 });
    expect(commissionFor({ tiers, tierMethod: 'slab', basis: 'production', minProduction: 200000 }, 150000, 150000).commission).toBe(0);
    expect(periodsOf('quarterly', 2026).map((p) => [p.label, p.from, p.to])[2]).toEqual(['2026-Q3', '2026-07-01', '2026-09-30']);
    expect(periodsOf('semi_annual', 2026)[1]).toMatchObject({ label: '2026-H2', from: '2026-07-01', to: '2026-12-31' });
  });
});

describe('agreements, computation, approval and settlement', () => {
  let agreement;
  it('creates an agreement with tiers (validated) and lists the sample agreements', async () => {
    const list = (await maker('get', '/insurer-overrides/agreements')).body.data;
    expect(list.map((a) => a.agreementCode)).toEqual(expect.arrayContaining(['MERC-OVR-SAMPLE', 'PIONEER-LR-SAMPLE']));
    const id = await insurerId('STANDARD');
    const bad = await maker('post', '/insurer-overrides/agreements').send({ agreementCode: 'STD-OVR', name: 'Standard override', insurerId: id, effectiveFrom: '2025-01-01',
      tiers: [{ fromValue: 0, toValue: 100, rate: 1 }, { fromValue: 50, rate: 2 }] });
    expect(bad.status).toBe(400);
    const r = await maker('post', '/insurer-overrides/agreements').send({ agreementCode: 'STD-OVR', name: 'Standard annual override', insurerId: id, basis: 'production', periodType: 'annual',
      effectiveFrom: '2025-01-01', tiers: [{ fromValue: 0, toValue: 20000, rate: 1 }, { fromValue: 20000, toValue: null, rate: 2.5 }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    agreement = r.body.data;
    expect(agreement.tiers).toHaveLength(2);
    expect((await maker('post', '/insurer-overrides/agreements').send({ agreementCode: 'STD-OVR', name: 'Duplicate code', insurerId: id, effectiveFrom: '2025-01-01', tiers: [{ fromValue: 0, rate: 1 }] })).status).toBe(409);
    const upd = await maker('put', `/insurer-overrides/agreements/${agreement.id}`).send({ remarks: 'Signed 2025-01-15' });
    expect(upd.body.data.remarks).toBe('Signed 2025-01-15');
    expect((await ctx.as('sales')('get', '/insurer-overrides/agreements')).status).toBe(403);
  });

  it('computes from the production, approves by a second user and posts the receivable', async () => {
    const id = await insurerId('STANDARD');
    const year = Number(String((await query('SELECT max(COALESCE(issued_date, inception_date))::text AS d FROM policies WHERE insurance_company_id = $1', [id])).rows[0].d).slice(0, 4));
    const periods = (await maker('get', `/insurer-overrides/agreements/${agreement.id}/periods?year=${year}`)).body.data;
    expect(periods).toHaveLength(1);
    const prod = await productionOf(id, `${year}-01-01`, `${year}-12-31`);
    expect(prod).toBeGreaterThan(0);
    const preview = (await maker('get', `/insurer-overrides/agreements/${agreement.id}/preview?year=${year}&periodLabel=${year}`)).body.data;
    expect(preview.production).toBeCloseTo(prod, 2);
    const c = await maker('post', `/insurer-overrides/agreements/${agreement.id}/compute`).send({ year, periodLabel: String(year) });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const comp = c.body.data;
    const rate = prod >= 20000 ? 2.5 : 1;
    expect(comp).toMatchObject({ status: 'draft', production: prod, rate, tierNo: prod >= 20000 ? 2 : 1 });
    expect(comp.computationNumber).toMatch(/^OVC-\d{4}-\d{5}$/);
    expect(comp.commission).toBeCloseTo(Math.round(prod * rate) / 100, 2);
    expect(comp.vat).toBeCloseTo(Math.round(comp.commission * 12) / 100, 2);
    expect(comp.expectedEwt).toBeCloseTo(Math.round(comp.commission * 10) / 100, 2);
    // recompute keeps the number; approval needs a submission and another user
    const again = (await maker('post', `/insurer-overrides/agreements/${agreement.id}/compute`).send({ year, periodLabel: String(year), remarks: 'rerun' })).body.data;
    expect(again.computationNumber).toBe(comp.computationNumber);
    expect((await checker('post', `/insurer-overrides/computations/${comp.id}/approve`)).status).toBe(409);
    expect((await maker('post', `/insurer-overrides/computations/${comp.id}/submit`)).body.data.status).toBe('submitted');
    expect((await maker('post', `/insurer-overrides/computations/${comp.id}/approve`)).status).toBe(403);
    const ap = await checker('post', `/insurer-overrides/computations/${comp.id}/approve`).send({});
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect(ap.body.data).toMatchObject({ status: 'approved', balance: comp.receivable });
    expect(await lines(ap.body.data.journalId)).toEqual([['1203006', comp.receivable, 0], ['3201002', 0, comp.commission], ['235000', 0, comp.vat]]);
    expect((await maker('post', `/insurer-overrides/agreements/${agreement.id}/compute`).send({ year, periodLabel: String(year) })).status).toBe(409);

    // the sales invoice of the commission (EOPT): no second posting
    await query('UPDATE insurance_companies SET tin = \'000-555-666-000\', address = \'Makati City\' WHERE id = $1', [id]);
    const inv = await maker('post', '/bir/invoices').send({ sourceType: 'override_commission', sourceId: comp.computationNumber });
    expect(inv.status, JSON.stringify(inv.body)).toBe(201);
    expect(inv.body.data).toMatchObject({ vatableSales: comp.commission, vatAmount: comp.vat, totalAmount: comp.receivable, journalId: null });
    expect((await maker('post', `/insurer-overrides/computations/${comp.id}/cancel`).send({ reason: 'Wrong period' })).status).toBe(409);

    // settlement: part payment left open, then the rest with the difference taken to income
    const half = Math.round(comp.receivable * 50) / 100;
    const ewt = comp.expectedEwt;
    const s1 = await maker('post', `/insurer-overrides/computations/${comp.id}/settlements`).send({ statementReference: 'SOA-STD-1', statementAmount: comp.receivable, cashReceived: half - ewt, ewtWithheld: ewt, form2307No: 'STD-2307-1' });
    expect(s1.status, JSON.stringify(s1.body)).toBe(200);
    expect(s1.body.data.computation).toMatchObject({ status: 'partially_settled' });
    expect(s1.body.data.statementMatches).toBe(true);
    expect(await lines(s1.body.data.settlement.journalId)).toEqual([['106010', Math.round((half - ewt) * 100) / 100, 0], ['1302001', ewt, 0], ['1203006', 0, half]]);
    const rest = Math.round((comp.receivable - half) * 100) / 100;
    const s2 = await maker('post', `/insurer-overrides/computations/${comp.id}/settlements`).send({ statementReference: 'SOA-STD-2', cashReceived: rest - 10, differenceTreatment: 'adjust_income' });
    expect(s2.body.data.computation).toMatchObject({ status: 'settled', balance: 0 });
    expect(s2.body.data.settlement.difference).toBe(-10);
    expect(await lines(s2.body.data.settlement.journalId)).toEqual([['106010', Math.round((rest - 10) * 100) / 100, 0], ['1203006', 0, rest], ['3201002', 10, 0]]);
    const full = (await maker('get', `/insurer-overrides/computations/${comp.id}`)).body.data;
    expect(full.settlements).toHaveLength(2);
    expect((await maker('post', `/insurer-overrides/computations/${comp.id}/settlements`).send({ statementReference: 'SOA-X', cashReceived: 1 })).status).toBe(409);
    const audit = (await query('SELECT action FROM audit_log WHERE entity = \'override_computation\'')).rows.map((a) => a.action);
    expect(audit).toEqual(expect.arrayContaining(['run', 'submit', 'approve', 'settle']));
  });

  it('reads the loss ratio (system claims or the insurer\'s figure) and the growth against the prior year', async () => {
    const lr = (await maker('get', '/insurer-overrides/agreements')).body.data.find((a) => a.agreementCode === 'PIONEER-LR-SAMPLE');
    const id = lr.insurerId;
    const year = Number(String((await query('SELECT max(COALESCE(issued_date, inception_date))::text AS d FROM policies WHERE insurance_company_id = $1', [id])).rows[0].d).slice(0, 4));
    const prod = await productionOf(id, `${year}-01-01`, `${year}-12-31`);
    const low = (await maker('get', `/insurer-overrides/agreements/${lr.id}/preview?year=${year}&periodLabel=${year}&claimsIncurred=${Math.round(prod * 0.3)}`)).body.data;
    expect(low.lossRatioPct).toBeCloseTo(30, 0);
    expect(low).toMatchObject({ tierNo: 1, rate: 5 });
    const high = (await maker('get', `/insurer-overrides/agreements/${lr.id}/preview?year=${year}&periodLabel=${year}&claimsIncurred=${Math.round(prod * 0.7)}`)).body.data;
    expect(high).toMatchObject({ tierNo: null, commission: 0 });
    const c = (await maker('post', `/insurer-overrides/agreements/${lr.id}/compute`).send({ year, periodLabel: String(year), claimsIncurred: Math.round(prod * 0.5), claimsNote: 'Insurer bordereau' })).body.data;
    expect(c).toMatchObject({ claimsSource: 'insurer', tierNo: 2, rate: 2.5, claimsNote: 'Insurer bordereau' });
    expect((await maker('post', `/insurer-overrides/computations/${c.id}/cancel`).send({ reason: 'Recompute later' })).body.data.status).toBe('cancelled');

    const g = await maker('post', '/insurer-overrides/agreements').send({ agreementCode: 'PIO-GROWTH', name: 'Pioneer growth bonus', insurerId: id, commissionType: 'contingent', basis: 'growth',
      periodType: 'annual', effectiveFrom: '2025-01-01', tiers: [{ fromValue: -100, toValue: 0, rate: 0 }, { fromValue: 0, toValue: null, rate: 1 }] });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    const gp = (await maker('get', `/insurer-overrides/agreements/${g.body.data.id}/preview?year=${year}&periodLabel=${year}`)).body.data;
    const prior = await productionOf(id, `${year - 1}-01-01`, `${year - 1}-12-31`);
    expect(gp.priorProduction).toBeCloseTo(prior, 2);
    if (prior > 0) expect(gp.growthPct).toBeCloseTo(Math.round((10000 * (prod - prior)) / prior) / 100, 2);
    const x = await maker('get', `/insurer-overrides/computations/export?year=${year}`).buffer(true).parse((res, cb) => { const b = []; res.on('data', (d) => b.push(d)); res.on('end', () => cb(null, Buffer.concat(b))); });
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
  });
});
