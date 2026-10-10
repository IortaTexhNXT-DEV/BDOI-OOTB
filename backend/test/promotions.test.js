import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { promotionStatus } from '../src/modules/promotions/service.js';
import { countPromotionUnit } from '../src/modules/promotions/quote.js';

let ctx;
let maker;
let approver;
let associate;
let officer;
let gm;
let now;
let motorId;
let fortuner;
let malayan;
let leadId;
let promoId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
const line = (extra = {}) => ({ variantId: fortuner, yearFrom: Number(now.slice(0, 4)) - 1, yearTo: Number(now.slice(0, 4)) + 1, promoOd: 1.5, minOd: 1.45, promoAon: 0.45, remitOd: 1.3, remitAon: 0.3, ...extra });
const promo = (extra = {}) => ({ code: 'PRM-TEST-FORT', name: 'Fortuner launch rate', periodFrom: now, periodTo: addDays(now, 60), benefit: 'rate', excess: { [motorId]: 2000 },
  unitQuota: 2, productIds: [motorId], insurerIds: [malayan], channelTypes: ['direct', 'financing_bank'], lines: [line()], ...extra });
const motor = (extra = {}) => ({
  leadRefId: leadId, productType: 'Motor', insurancePolicyType: 'COMP', vehicleCondition: 'Brand New', lossAndDamageCoverage: '1200000', bodilyInjury: '100000', propertyDamage: '100000',
  participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }],
  insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Fortuner', modelVariant: '2.4 G 4x2 AT', modelYear: now.slice(0, 4), vehicleType: 'private_cars', seatingCapacity: '7' }],
  ...extra,
});

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  maker = await persona('pr.maker', ['tis-ops-officer']);
  approver = await persona('pr.approver', ['tis-sales-unit-head']);
  associate = await persona('pr.associate', ['tis-sales-associate']);
  officer = await persona('pr.officer', ['tis-sales-officer']);
  gm = await persona('pr.gm', ['tis-general-manager']);
  motorId = (await q("SELECT id FROM products WHERE code = 'MOTOR'"))[0].id;
  malayan = (await q("SELECT id FROM insurance_companies WHERE name = 'Malayan Insurance Co., Inc.'"))[0].id;
  fortuner = (await q(`SELECT v.id FROM vehicle_variants v JOIN vehicle_models m ON m.id = v.model_id WHERE m.name = 'Fortuner' AND v.name = '2.4 G 4x2 AT'`))[0].id;
  leadId = (await associate.api('post', '/leads').send({ firstName: 'Lorna', lastName: 'Dizon', emailId: 'lorna.dizon@example.ph', contactNumber: '09175550101', leadCategory: 'Retail' })).body.leadId;
});
afterAll(async () => { await pool.end(); });

describe('promotion set-up (FR-PRM-001 to 003)', () => {
  it('refuses a bad code, a non-motor product, a long period and wrong rates', async () => {
    const bad = async (extra, text) => {
      const r = await maker.api('post', '/promotions').send(promo(extra));
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toContain(text);
    };
    await bad({ code: 'P!' }, 'capital letters, digits and hyphens');
    await bad({ productIds: [(await q("SELECT id FROM products WHERE code = 'PA'"))[0].id] }, 'Motor products only');
    await bad({ periodTo: addDays(now, 400) }, 'cannot be longer than 12 months');
    await bad({ lines: [line({ remitOd: 1.6 })] }, 'a remitting rate cannot be higher than the promo rate');
    await bad({ lines: [line({ minOd: 1.6 })] }, 'Min OD % cannot be higher than Promo OD %');
    await bad({ lines: [line(), line()] }, 'listed twice for overlapping year models');
    await bad({ unitQuota: 0 }, 'Unit quota must be a whole number');
  });

  it('saves a draft; the code is unique and the sales associate cannot set up promotions', async () => {
    const r = await maker.api('post', '/promotions').send(promo({ code: 'prm-test-fort', channelTypes: ['direct', 'financing_bank', 'dealer'] }));
    expect(r.status).toBe(201);
    promoId = r.body.data.id;
    expect(r.body.data).toMatchObject({ code: 'PRM-TEST-FORT', version: 1, status: 'draft', lineCount: 1 });
    expect((await maker.api('post', '/promotions').send(promo())).status).toBe(409);
    expect((await associate.api('post', '/promotions').send(promo({ code: 'PRM-OTHER' }))).status).toBe(403);
  });

  it('checks every line against the caps: the dealer cap blocks the submission', async () => {
    const detail = (await maker.api('get', `/promotions/${promoId}`)).body.data;
    expect(detail.capCheck.lines[0].rateDiscount).toBe(24);
    const dealer = detail.capCheck.lines[0].checks.find((c) => c.channelType === 'dealer');
    expect(dealer.result).toBe('below-lowest-od');
    const r = await maker.api('post', `/promotions/${promoId}/submit`).send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('below the lowest OD rate of 1.5%');
    expect((await maker.api('put', `/promotions/${promoId}`).send({ channelTypes: ['direct', 'financing_bank'] })).status).toBe(200);
    expect((await maker.api('post', `/promotions/${promoId}/submit`).send({})).body.data.status).toBe('pending-approval');
  });

  it('is approved by a second user only; a return needs a reason', async () => {
    expect((await maker.api('post', `/promotions/${promoId}/approve`).send({})).status).toBe(403);
    expect((await approver.api('post', `/promotions/${promoId}/return`).send({})).status).toBe(400);
    const r = await approver.api('post', `/promotions/${promoId}/approve`).send({ note: 'Rates agreed with Malayan' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('active');
    expect((await maker.api('put', `/promotions/${promoId}`).send({ name: 'Changed' })).status).toBe(409);
  });
});

describe('promotion on a motor quotation (FR-PRM-020 to 024)', () => {
  let quoteId;
  it('lists the promotions open to a brand-new vehicle and none to a used one', async () => {
    const open = await associate.api('post', '/promotions/open').send({ doc: motor(), insuranceCompanyId: malayan });
    expect(open.body.data.promotions.map((p) => p.code)).toEqual(['PRM-TEST-FORT']);
    expect(open.body.data.channelType).toBe('direct');
    const used = await associate.api('post', '/promotions/open').send({ doc: motor({ vehicleCondition: 'Used' }), insuranceCompanyId: malayan });
    expect(used.body.data).toMatchObject({ promotions: [], reason: 'Promotions apply to brand-new vehicles only' });
  });

  it('prices the quotation at the promotion rates and measures the discount against the standard rates', async () => {
    const r = await associate.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT' } }));
    expect(r.status).toBe(201);
    quoteId = r.body.quotationId;
    const p = r.body.promotion;
    expect(p).toMatchObject({ code: 'PRM-TEST-FORT', version: 1, odRate: 1.5, promoAon: 0.45, remitOd: 1.3, excess: 2000, channelType: 'direct' });
    expect(Number(r.body.lossAndDamageCoverageRate)).toBe(1.5);
    expect(r.body.premiumBreakdown.lossAndDamageCoveragePremium).toBe(18000);
    expect(r.body.premiumBreakdown.actsOfNaturePremium).toBe(5400);
    expect(p.promoDiscount).toBeCloseTo(p.standardGrossPremium - r.body.grossPremium, 2);
    expect(p.totalDiscountPct).toBeGreaterThan(15);
    expect(p.totalDiscountPct).toBeLessThanOrEqual(25);
    expect(r.body.underwritingReferral).toBeUndefined();
  });

  it('refuses a used vehicle, another insurer and an order discount the promotion does not allow', async () => {
    const used = await associate.api('post', '/quotations').send(motor({ vehicleCondition: 'Used', promotion: { code: 'PRM-TEST-FORT' } }));
    expect(used.body.message).toBe('Promotions apply to brand-new vehicles only');
    const other = await associate.api('post', '/quotations').send(motor({ participantDetails: [{ insuranceCompanyName: 'Pioneer Insurance & Surety Corp.' }], promotion: { code: 'PRM-TEST-FORT' } }));
    expect(other.body.message).toContain('is not open to this vehicle, product, insurer or channel');
    const disc = await associate.api('post', '/quotations').send(motor({ discount: 500, promotion: { code: 'PRM-TEST-FORT' } }));
    expect(disc.body.message).toBe('Promotion PRM-TEST-FORT cannot be combined with an Order Summary discount');
  });

  it('only a holder of write:promotion-rates lowers the rate, to the line minimum, with a reason', async () => {
    const own = await associate.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT', odRate: 1.45, rateReason: 'Fleet account' } }));
    expect(own.status).toBe(403);
    const low = await officer.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT', odRate: 1.4, rateReason: 'Fleet account' } }));
    expect(low.body.message).toBe('Own Damage coverage Rate cannot be lower than 1.45% for this promotion');
    const noReason = await officer.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT', odRate: 1.45 } }));
    expect(noReason.body.message).toBe('Reason for the rate change is required');
    const ok = await officer.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT', odRate: 1.45, rateReason: 'Fleet account' } }));
    expect(ok.status).toBe(201);
    expect(ok.body.promotion.rateChange).toMatchObject({ from: 1.5, to: 1.45, reason: 'Fleet account' });
  });

  it("a discount above the maker's limit is referred to a role whose limit covers it (FR-PRM-023)", async () => {
    const r = await officer.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT' } }));
    expect(r.body.underwritingReferral).toMatchObject({ status: 'pending', ruleCodes: ['PROMO_DISCOUNT'] });
    expect(r.body.underwritingReferral.authorityRoles).toContain('tis-general-manager');
    expect(r.body.underwritingReferral.authorityRoles).not.toContain('tis-sales-unit-head');
    const head = await approver.api('post', `/quotations/${r.body.quotationId}/underwriting-referral`).send({ decision: 'approve' });
    expect(head.status).toBe(403);
    const ok = await gm.api('post', `/quotations/${r.body.quotationId}/underwriting-referral`).send({ decision: 'approve', remarks: 'Fleet of 12 units' });
    expect(ok.status).toBe(200);
  });

  it('removing the promotion prices the quotation at the standard rates again', async () => {
    const r = await associate.api('put', `/quotations/${quoteId}`).send({ promotion: null });
    expect(r.status).toBe(200);
    expect(r.body.promotion).toBeUndefined();
    expect(r.body.premiumBreakdown.lossAndDamageCoveragePremium).toBe(24000);
    const back = await associate.api('put', `/quotations/${quoteId}`).send({ promotion: { code: 'PRM-TEST-FORT' } });
    expect(back.body.promotion.code).toBe('PRM-TEST-FORT');
  });
});

describe('life cycle, versions and quota (FR-PRM-005, 006, 024, 030)', () => {
  it('a suspended promotion is not offered on a new quotation; an open quotation keeps it', async () => {
    const quote = (await associate.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT' } }))).body;
    expect((await approver.api('post', `/promotions/${promoId}/suspend`).send({})).status).toBe(400);
    const s = await approver.api('post', `/promotions/${promoId}/suspend`).send({ reasonCode: 'PRMS-INSURER' });
    expect(s.body.data.status).toBe('suspended');
    expect(s.body.openQuotes).toBeGreaterThan(0);
    const fresh = await associate.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT' } }));
    expect(fresh.body.message).toBe('Promotion PRM-TEST-FORT is suspended');
    const kept = await associate.api('put', `/quotations/${quote.quotationId}`).send({ remarks: 'Client asked for the schedule' });
    expect(kept.body.promotion.code).toBe('PRM-TEST-FORT');
    expect((await approver.api('post', `/promotions/${promoId}/resume`).send({ reasonCode: 'PRMS-RESUME' })).body.data.status).toBe('active');
  });

  it('an amendment is the next version; the version in force stays until it is approved', async () => {
    const quote = (await associate.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT' } }))).body;
    const v2 = await maker.api('post', `/promotions/${promoId}/amend`).send({});
    expect(v2.status).toBe(201);
    expect(v2.body.data).toMatchObject({ version: 2, status: 'draft' });
    expect((await maker.api('post', `/promotions/${promoId}/amend`).send({})).status).toBe(409);
    await maker.api('put', `/promotions/${v2.body.data.id}`).send({ lines: [line({ promoOd: 1.55, minOd: 1.5 })] });
    await maker.api('post', `/promotions/${v2.body.data.id}/submit`).send({});
    expect((await approver.api('post', `/promotions/${v2.body.data.id}/approve`).send({})).body.data.status).toBe('active');
    expect((await q('SELECT status FROM promotions WHERE id = $1', [promoId]))[0].status).toBe('superseded');
    const repriced = await associate.api('put', `/quotations/${quote.quotationId}`).send({ remarks: 'Repriced' });
    expect(repriced.body.promotion).toMatchObject({ version: 2, odRate: 1.55 });
    expect(repriced.body.promotionNotice).toContain('changed since this quotation was priced (version 1 to version 2)');
    promoId = v2.body.data.id;
  });

  it('counts a unit per policy; the quota expires the promotion; a chassis on an earlier policy is refused', async () => {
    const rows = await q("SELECT * FROM quotes WHERE doc->'promotion'->>'code' = 'PRM-TEST-FORT' ORDER BY created_at LIMIT 3");
    const c = await pool.connect();
    try {
      expect(await countPromotionUnit(c, rows[0], {}, 'pol_test_1')).toMatchObject({ used: 1, quota: 2 });
      await q("UPDATE policies SET doc = doc || '{\"chassisNumber\": \"MHF-PROMO-0001\"}' WHERE id = (SELECT id FROM policies ORDER BY id LIMIT 1)");
      await expect(countPromotionUnit(c, rows[2], { chassisNumber: 'MHF-PROMO-0001' }, null)).rejects.toThrow('is not brand new');
      expect(await countPromotionUnit(c, rows[1], {}, 'pol_test_2')).toMatchObject({ used: 2, quota: 2 });
    } finally {
      c.release();
    }
    expect((await q('SELECT status FROM promotions WHERE id = $1', [promoId]))[0].status).toBe('expired');
    const fresh = await associate.api('post', '/quotations').send(motor({ promotion: { code: 'PRM-TEST-FORT' } }));
    expect(fresh.status).toBe(400);
  });

  it('the daily job activates a scheduled promotion and expires an ended one', async () => {
    const r = await maker.api('post', '/promotions').send(promo({ code: 'PRM-TEST-HILUX', periodFrom: addDays(now, 5), periodTo: addDays(now, 40), unitQuota: null }));
    await maker.api('post', `/promotions/${r.body.data.id}/submit`).send({});
    expect((await approver.api('post', `/promotions/${r.body.data.id}/approve`).send({})).body.data.status).toBe('scheduled');
    await q('UPDATE promotions SET period_from = $2 WHERE id = $1', [r.body.data.id, now]);
    await promotionStatus();
    expect((await q('SELECT status FROM promotions WHERE id = $1', [r.body.data.id]))[0].status).toBe('active');
    await q('UPDATE promotions SET period_to = $2, period_from = $3 WHERE id = $1', [r.body.data.id, addDays(now, -1), addDays(now, -10)]);
    await promotionStatus();
    expect((await q('SELECT status FROM promotions WHERE id = $1', [r.body.data.id]))[0].status).toBe('expired');
  });
});

describe('discount caps (FR-PRM-010)', () => {
  let capId;
  let ctplId;
  it('a cap is proposed, never approved by its maker, and live once approved', async () => {
    ctplId = (await q("SELECT id FROM products WHERE code = 'CTPL'"))[0].id;
    const body = { productId: ctplId, channelType: 'affinity', minPct: 0, maxPct: 18, lowestOd: 1.5, effectiveFrom: now };
    expect((await maker.api('post', '/discount-caps').send({ ...body, minPct: 30 })).body.errors[0].message).toBe('Min discount % cannot be higher than max discount %');
    expect((await maker.api('post', '/discount-caps').send({ ...body, effectiveFrom: addDays(now, -1) })).body.errors[0].message).toBe('effectiveFrom cannot be before today');
    const r = await maker.api('post', '/discount-caps').send(body);
    expect(r.status).toBe(201);
    capId = r.body.data.id;
    expect((await maker.api('post', `/discount-caps/${capId}/approve`).send({})).status).toBe(403);
    expect((await approver.api('post', `/discount-caps/${capId}/return`).send({})).status).toBe(400);
    expect((await approver.api('post', `/discount-caps/${capId}/approve`).send({})).body.data.status).toBe('approved');
    const again = await maker.api('post', '/discount-caps').send(body);
    expect(again.status).toBe(409);
  });

  it('a replacement ends the cap it replaces the day before it starts', async () => {
    const r = await maker.api('post', '/discount-caps').send({ productId: ctplId, channelType: 'affinity', minPct: 0, maxPct: 15, lowestOd: 1.5, effectiveFrom: addDays(now, 10), replacesId: capId });
    expect(r.status).toBe(201);
    await approver.api('post', `/discount-caps/${r.body.data.id}/approve`).send({});
    const old = (await approver.api('get', `/discount-caps?channelType=affinity&productId=${ctplId}`).send()).body.data.find((c) => c.id === capId);
    expect(old.effectiveTo).toBe(addDays(now, 9));
  });
});
