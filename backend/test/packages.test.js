import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { premiumOnRate } from '../src/modules/packages/rateTables.js';
import { insurerTotals } from '../src/modules/packages/issue.js';
import { eligiblePolicies } from '../src/modules/remittance/service.js';

let ctx;
let sales;
let processing;
let claims;
const q1 = async (sql, params) => (await pool.query(sql, params)).rows[0];
const idOf = async (table, code) => (await q1(`SELECT id FROM ${table} WHERE code = $1`, [code])).id;

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('pk.sales', ['sales']);
  processing = await persona('pk.processing', ['processing']);
  claims = await persona('pk.claims', ['claims']);
});
afterAll(async () => { await pool.end(); });

describe('rate formulas and insurer grouping', () => {
  it('prices percent, per mille and flat rates with the minimum premium', () => {
    expect(premiumOnRate({ rateBasis: 'percent', rate: 0.25, minimumPremium: 1500 }, 1000000)).toEqual({ premium: 2500, computed: 2500, minimumApplied: false });
    expect(premiumOnRate({ rateBasis: 'per_mille', rate: 3, minimumPremium: 0 }, 500000).premium).toBe(1500);
    expect(premiumOnRate({ rateBasis: 'flat', rate: 999.5 }, 1).premium).toBe(999.5);
    expect(premiumOnRate({ rateBasis: 'percent', rate: 0.1, minimumPremium: 1500 }, 100000)).toMatchObject({ premium: 1500, computed: 100, minimumApplied: true });
  });
  it('groups sections per insurer with the largest gross as lead and shares totalling 100', () => {
    const g = insurerTotals([
      { sectionNo: 1, insuranceCompanyId: 2, totalAmount: 100, netPremium: 80, commissionAmount: 10 },
      { sectionNo: 2, insuranceCompanyId: 3, totalAmount: 200, netPremium: 160, commissionAmount: 20 },
      { sectionNo: 3, insuranceCompanyId: 2, totalAmount: 33.33, netPremium: 26, commissionAmount: 3 },
    ]);
    expect(g.map((x) => x.insuranceCompanyId)).toEqual([3, 2]);
    expect(g[0].isLead).toBe(true);
    expect(g[1]).toMatchObject({ totalAmount: 133.33, sections: [1, 3] });
    expect(Math.round((g[0].sharePercent + g[1].sharePercent) * 1e4) / 1e4).toBe(100);
  });
});

describe('insurer rate tables and comparison', () => {
  let homeId;
  it('lets the Processing Team maintain rate tables; Sales reads them', async () => {
    homeId = await idOf('products', 'HOME');
    const list = await sales('get', `/packages/rate-tables?productId=${homeId}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(4);
    const body = { insuranceCompanyId: await idOf('insurance_companies', 'FPG'), productId: homeId, rateBasis: 'percent', rate: 0.3, minimumPremium: 1000, effectiveFrom: '2026-01-01',
      keyBenefits: ['Fire and lightning'], deductible: 'PHP 1,000' };
    expect((await sales('post', '/packages/rate-tables').send(body)).status).toBe(403);
    const add = await processing('post', '/packages/rate-tables').send(body);
    expect(add.status).toBe(201);
    expect((await processing('post', '/packages/rate-tables').send({ ...body, effectiveFrom: '2026-06-01' })).status).toBe(409);
    const upd = await processing('put', `/packages/rate-tables/${add.body.data.id}`).send({ rate: 0.35, active: false });
    expect(upd.body.data).toMatchObject({ rate: 0.35, active: false });
    expect((await processing('delete', `/packages/rate-tables/${add.body.data.id}`)).body.data.deactivated).toBe(false);
  });

  it('compares the insurers of a product side by side, cheapest total first', async () => {
    const r = await sales('post', '/packages/compare').send({ productId: homeId, sumInsured: 1000000, lguCode: 'MKT' });
    expect(r.status).toBe(200);
    const cols = r.body.data.columns;
    expect(cols.map((c) => c.insurerCode)).toEqual(['MAPFRE', 'STANDARD', 'MALAYAN', 'PIONEER']);
    expect(cols[0]).toMatchObject({ premium: 2000, vat: 240, dst: 250, fst: 40, lgt: 4, total: 2534, commissionRate: 0.15, commissionAmount: 300 });
    expect(cols[2]).toMatchObject({ premium: 2500, vat: 300, dst: 312.5, fst: 50, lgt: 5, total: 3167.5, deductible: 'PHP 2,500 each and every loss' });
    expect(cols[2].keyBenefits.length).toBe(5);
    const client = await sales('post', '/packages/compare').send({ productId: 'HOME', sumInsured: 1000000, clientView: true });
    expect(client.body.data.columns[0].commissionRate).toBeUndefined();
    expect(client.body.data.columns[0].lgt).toBe(15); // LGT rule rate without a location: 0.75% since migration 0236 (was 0.2%: 4)
    expect((await sales('post', '/packages/compare').send({ productId: homeId, sumInsured: 0 })).status).toBe(400);
    expect((await sales('post', '/packages/compare').send({ productId: homeId, sumInsured: 1000, lguCode: 'NOPE' })).status).toBe(400);
    expect((await claims('post', '/packages/compare').send({ productId: homeId, sumInsured: 1000 })).status).toBe(403);
  });

  it('prints the comparison for the client and proceeds to a quotation priced with the engine', async () => {
    const pdf = await sales('post', '/packages/compare/pdf').send({ productId: homeId, sumInsured: 1000000, lguCode: 'MKT', preparedFor: 'Maria Santos' });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.body.toString('latin1')).not.toMatch(/Commission/i);
    const lead = await sales('post', '/leads').send({ firstName: 'Nina', lastName: 'Villareal', emailId: 'nina.villareal@example.ph', contactNumber: '09170000021', leadCategory: 'Retail' });
    const quote = await sales('post', '/packages/compare/quotation').send({ productId: homeId, sumInsured: 1000000, lguCode: 'MKT', insuranceCompanyId: await idOf('insurance_companies', 'MALAYAN'),
      leadRefId: lead.body.leadId, insurersCompared: 4 });
    expect(quote.status).toBe(201);
    expect(quote.body.data).toMatchObject({ premiumTotal: 3167.5 });
    const row = await q1('SELECT product_id, premium_base, vat, dst, fst, lgt, commission_rate, doc FROM quotes WHERE id = $1', [quote.body.data.quotationId]);
    expect(row).toMatchObject({ product_id: homeId, premium_base: 2500, vat: 300, dst: 312.5, fst: 50, lgt: 5 });
    expect(Number(row.commission_rate)).toBe(0.2);
    expect(row.doc.chargeEngine).toBe(true);
  });
});

describe('bundles: master, quotation, issuance, endorsement, renewal', () => {
  let clientId;
  let quoteId;
  let policyId;
  let ids;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    ids = { MALAYAN: await idOf('insurance_companies', 'MALAYAN'), PIONEER: await idOf('insurance_companies', 'PIONEER'), FPG: await idOf('insurance_companies', 'FPG'),
      MAPFRE: await idOf('insurance_companies', 'MAPFRE') };
    const c = await sales('post', '/clients').send({ firstName: 'Rosario', lastName: 'Dizon', emailId: 'rosario.dizon@example.ph', leadCategory: 'Retail', city: 'Makati' });
    clientId = c.body.clientId;
  });

  it('maintains bundle products (Processing Team)', async () => {
    const list = await sales('get', '/packages/bundles?status=active');
    expect(list.body.data.map((b) => b.code)).toEqual(['HOME-PROTECT', 'SME-SHIELD']);
    const body = { code: 'shop-lite', name: 'Shop Lite', discountPercent: 5, sections: [{ name: 'Burglary', productId: await idOf('products', 'BURGLARY'), defaultSumInsured: 100000, ratePercent: 0.5, insurerIds: [ids.FPG] }] };
    expect((await sales('post', '/packages/bundles').send(body)).status).toBe(403);
    const add = await processing('post', '/packages/bundles').send(body);
    expect(add.status).toBe(201);
    expect(add.body.data).toMatchObject({ code: 'SHOP-LITE', sections: [{ sectionNo: 1, insurers: [{ id: ids.FPG }] }] });
    expect((await processing('post', '/packages/bundles').send({ ...body, code: 'X1', sections: [{ ...body.sections[0], insurerIds: [] }] })).status).toBe(400);
    expect((await processing('post', '/packages/bundles').send({ ...body, code: 'X2', sections: [{ ...body.sections[0], optional: true }] })).status).toBe(400);
    const upd = await processing('put', '/packages/bundles/SHOP-LITE').send({ discountPercent: 7.5 });
    expect(upd.body.data.discountPercent).toBe(7.5);
    expect((await processing('delete', '/packages/bundles/SHOP-LITE')).body.data.deactivated).toBe(false);
  });

  it('prices a bundle per section: insurer rate, discount spread, taxes per section', async () => {
    const r = await sales('post', '/packages/quotes/preview').send({ bundleId: 'SME-SHIELD', lguCode: 'MKT', inceptionDate: today });
    expect(r.status).toBe(200);
    const [fire, cgl, burglary] = r.body.data.sections;
    expect(fire).toMatchObject({ insuranceCompanyId: ids.MALAYAN, rateTableId: null, basePremium: 4000, discountAmount: 400, netPremium: 3600, vat: 432, dst: 450, fst: 72, lgt: 7.2, totalAmount: 4561.2 });
    expect(cgl).toMatchObject({ insuranceCompanyId: ids.PIONEER, basePremium: 1500, minimumApplied: false, discountAmount: 150, netPremium: 1350, vat: 162, dst: 169, fst: 0, lgt: 2.7, totalAmount: 1683.7 });
    expect(burglary).toMatchObject({ insuranceCompanyId: ids.FPG, basePremium: 1000, netPremium: 900, dst: 112.5, fst: 0, totalAmount: 1122.3, commissionRate: 0.25, commissionAmount: 225 });
    expect(r.body.data.totals).toMatchObject({ basePremium: 6500, discountAmount: 650, netPremium: 5850, totalAmount: 7367.2 });
    const other = await sales('post', '/packages/quotes/preview').send({ bundleId: 'SME-SHIELD', sections: [{ sectionNo: 2, insuranceCompanyId: ids.MAPFRE }] });
    expect(other.body.data.sections[1].insuranceCompanyId).toBe(ids.MAPFRE);
    expect((await sales('post', '/packages/quotes/preview').send({ bundleId: 'SME-SHIELD', sections: [{ sectionNo: 2, insuranceCompanyId: ids.FPG }] })).status).toBe(400);
    expect((await sales('post', '/packages/quotes/preview').send({ bundleId: 'SME-SHIELD', sections: [{ sectionNo: 1, included: false }] })).status).toBe(400);
    const home = await sales('post', '/packages/quotes/preview').send({ bundleId: 'HOME-PROTECT' });
    expect(home.body.data.sections.map((s) => s.sectionNo)).toEqual([1, 2]);
    const withOptional = await sales('post', '/packages/quotes/preview').send({ bundleId: 'HOME-PROTECT', sections: [{ sectionNo: 3, included: true }] });
    expect(withOptional.body.data.sections.map((s) => s.sectionNo)).toEqual([1, 2, 3]);
  });

  it('creates, updates and accepts a package quotation', async () => {
    const r = await sales('post', '/packages/quotes').send({ bundleId: 'SME-SHIELD', clientId, lguCode: 'MKT', inceptionDate: today, insuredName: 'Rosario Bakeshop Corp.' });
    expect(r.status).toBe(201);
    expect(r.body.data.quoteNumber).toMatch(/^PQ-\d{4}-\d{5}$/);
    expect(r.body.data).toMatchObject({ status: 'draft', totalAmount: 7367.2, sections: [{ sectionNo: 1 }, { sectionNo: 2 }, { sectionNo: 3 }] });
    quoteId = r.body.data.id;
    const upd = await sales('put', `/packages/quotes/${quoteId}`).send({ remarks: 'Walk-in client' });
    expect(upd.body.data).toMatchObject({ remarks: 'Walk-in client', totalAmount: 7367.2 });
    expect((await sales('get', '/packages/quotes?status=draft')).body.total).toBeGreaterThanOrEqual(1);
    expect((await sales('post', `/packages/quotes/${quoteId}/accept`)).body.data.status).toBe('accepted');
    expect((await sales('put', `/packages/quotes/${quoteId}`).send({ remarks: 'x' })).status).toBe(400);
    const pdf = await sales('get', `/packages/quotes/${quoteId}/pdf`);
    expect(pdf.headers['content-type']).toBe('application/pdf');
  });

  it('issues ONE policy with sections per insurer, exact participant amounts and a booking per carrier', async () => {
    expect((await claims('post', `/packages/quotes/${quoteId}/issue`).send({})).status).toBe(403);
    const r = await sales('post', `/packages/quotes/${quoteId}/issue`).send({});
    expect(r.status).toBe(201);
    expect(r.body.data.policyNumber).toMatch(/^PKG-\d{4}-\d{5}$/);
    policyId = r.body.data.policyId;
    const pol = await q1('SELECT policy_number, premium_total, net_premium, insurance_company_id, lob, billing_mode, bill_number, expiry_date, inception_date FROM policies WHERE id = $1', [policyId]);
    expect(pol).toMatchObject({ premium_total: 7367.2, net_premium: 5850, insurance_company_id: ids.MALAYAN, lob: 'PACKAGE', billing_mode: 'broker' });
    const parts = (await pool.query("SELECT insurance_company_id, premium_total, premium, taxes, commission_amount, share_percent, is_lead FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 ORDER BY premium_total DESC", [policyId])).rows;
    expect(parts.map((p) => [p.insurance_company_id, p.premium_total, p.premium])).toEqual([[ids.MALAYAN, 4561.2, 3600], [ids.PIONEER, 1683.7, 1350], [ids.FPG, 1122.3, 900]]);
    expect(Math.round(parts.reduce((s, p) => s + Number(p.share_percent), 0) * 1e4) / 1e4).toBe(100);
    expect(parts[0].is_lead).toBe(true);
    const rcv = await q1('SELECT id, amount, booking_jv_id, vat, dst, lgt FROM receivables WHERE policy_id = $1', [policyId]);
    expect(rcv).toMatchObject({ amount: 7367.2, vat: 702, dst: 731.5 });
    const rp = (await pool.query('SELECT insurance_company_id, gross, commission, taxes FROM receivable_participants WHERE receivable_id = $1 ORDER BY gross DESC', [rcv.id])).rows;
    expect(rp.map((x) => x.gross)).toEqual([4561.2, 1683.7, 1122.3]);
    expect(rp[2].commission).toBe(225);
    const lines = (await pool.query('SELECT debit, credit, insurance_company_id FROM journal_lines WHERE jv_id = $1', [rcv.booking_jv_id])).rows;
    const dr = Math.round(lines.reduce((s, l) => s + Number(l.debit), 0) * 100);
    const cr = Math.round(lines.reduce((s, l) => s + Number(l.credit), 0) * 100);
    expect(dr).toBe(cr);
    expect(new Set(lines.map((l) => l.insurance_company_id).filter(Boolean))).toEqual(new Set([ids.MALAYAN, ids.PIONEER, ids.FPG]));
    const due = await eligiblePolicies({ insurerId: ids.PIONEER, policyIds: [policyId] });
    expect(due[0]).toMatchObject({ premium_total: 1683.7 });
    const detail = await sales('get', `/packages/policies/${policyId}`);
    expect(detail.body.data.sections.map((s) => s.insurerName)).toHaveLength(3);
    const again = await sales('post', `/packages/quotes/${quoteId}/issue`).send({});
    expect(again.status).toBe(409);
    const sched = await sales('get', `/packages/policies/${policyId}/schedule`);
    expect(sched.headers['content-type']).toBe('application/pdf');
  });

  it('endorses one section: the additional premium is billed and due to that insurer only', async () => {
    const inception = (await q1('SELECT inception_date FROM policies WHERE id = $1', [policyId])).inception_date;
    const r = await sales('post', `/packages/policies/${policyId}/sections/3/endorse`).send({ sumInsured: 300000, effectiveDate: inception, remarks: 'More stock' });
    expect(r.status).toBe(201);
    expect(r.body.data.endorsement).toMatchObject({ sectionNo: 3, prorataFactor: 1, netPremium: 450, totalAmount: 561.4, commissionAmount: 112.5 });
    const bill = await q1("SELECT amount, source FROM receivables WHERE policy_id = $1 AND source = 'endorsement'", [policyId]);
    expect(bill).toMatchObject({ amount: 561.4 });
    const fpg = await q1("SELECT premium_total, sum_insured FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 AND insurance_company_id = $2", [policyId, ids.FPG]);
    expect(fpg).toMatchObject({ premium_total: 1683.7, sum_insured: 300000 });
    const shares = await q1("SELECT sum(share_percent) AS s FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1", [policyId]);
    expect(Number(shares.s)).toBe(100);
    expect(r.body.data.policy.grossPremium).toBe(7928.6);
    expect((await sales('post', `/packages/policies/${policyId}/sections/3/endorse`).send({ sumInsured: 100000 })).status).toBe(400);
    expect((await sales('post', `/packages/policies/${policyId}/sections/9/endorse`).send({ sumInsured: 100000 })).status).toBe(404);
  });

  it('renews the whole package into a quotation for the next term and marks the policy renewed on issue', async () => {
    const r = await sales('post', `/packages/policies/${policyId}/renew`).send({});
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ renewalOf: policyId, status: 'draft' });
    expect(r.body.data.sections.find((s) => s.sectionNo === 3).sumInsured).toBe(300000);
    expect((await sales('post', `/packages/policies/${policyId}/renew`).send({})).status).toBe(409);
    const issued = await sales('post', `/packages/quotes/${r.body.data.id}/issue`).send({});
    expect(issued.status).toBe(201);
    const old = await q1('SELECT status, renewed_to FROM policies WHERE id = $1', [policyId]);
    expect(old).toMatchObject({ status: 'renewed', renewed_to: issued.body.data.policyId });
    const list = await sales('get', '/packages/policies');
    expect(list.body.total).toBe(2);
  });
});
