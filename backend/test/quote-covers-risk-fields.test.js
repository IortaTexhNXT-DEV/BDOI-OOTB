/**
 * Product rules drive the quotation fully (gap 3.11): the quote set-up of the governing template (Coverage Builder
 * covers with the premium each is priced on, and the risk fields its acceptance rules and rating factors test), a
 * quotation priced on the covers chosen (mandatory always in, optional added or removed), and the risk fields the
 * wizard captures (driver date of birth, claims in the last 3 years, fair market value, vehicle modifications, number
 * of members) so that no acceptance rule is left "not evaluated".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withProducts } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today } from '../src/lib/dates.js';

let ctx; let sales; let leadId; let asOf;
const year = new Date().getFullYear();

/** A motor quotation (Own damage 1,000,000 at 1.5%) of a private car with the risk fields the wizard captures. */
const motor = (extra = {}) => ({
  leadRefId: leadId, productType: 'Motor', insurancePolicyType: 'PC', lossAndDamageCoverage: '1000000', lossAndDamageCoverageRate: '1.5', actsOfNatureRate: '0.5',
  bodilyInjury: '200000', propertyDamage: '200000', autoPassengerPersonalAccident: '50000', includeCTPL: false,
  participantDetails: [{ insuranceCompanyName: 'Pioneer Insurance & Surety Corp.' }],
  insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: String(year - 3), vehicleType: 'private_cars', seatingCapacity: '5' }],
  vehicleType: 'private_cars', ...extra,
});
const riskFields = (dob, extra = {}) => ({ vehicleUse: 'Private', driverDateOfBirth: dob, claimsLast3Years: 0, fairMarketValue: 1000000, modified: false, ...extra });

beforeAll(async () => {
  ctx = await setup();
  await withProducts();
  await ctx.api('post', '/users').send({ username: 'qc.sales', password: 'Welcome@123', displayName: 'qc.sales', email: 'qc.sales@example.ph', roles: ['sales'] });
  const token = await loginAs(ctx.app, 'qc.sales', 'Welcome@123');
  sales = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  leadId = (await sales('post', '/leads').send({ firstName: 'Noel', lastName: 'Bautista', emailId: 'noel.b@example.ph', contactNumber: '09170004321', leadCategory: 'Retail' })).body.leadId;
  asOf = await today();
});
afterAll(async () => { await pool.end(); });

describe('quote set-up of the governing template', () => {
  it('lists the Coverage Builder covers with their quotation premium and the risk fields the rules and factors test', async () => {
    const r = await sales('get', '/product-configurator/quote-setup?lob=MOTOR');
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(s.templateCode).toBe('MOT-003-2025');
    expect(s.covers.map((c) => c.code)).toEqual(['OD', 'THEFT', 'CTPL', 'AOG', 'VTPL-BI', 'VTPL-PD', 'APA', 'RSA', 'PAC']);
    expect(s.covers.find((c) => c.code === 'OD')).toMatchObject({ type: 'Mandatory', quoteField: 'lossAndDamageCoveragePremium', deductible: 3000 });
    expect(s.covers.find((c) => c.code === 'RSA')).toMatchObject({ type: 'Optional', quoteField: 'roadsideAssistancePremium' });
    const fields = s.riskFields.map((f) => f.field);
    expect(fields).toEqual(expect.arrayContaining(['driverAge', 'claimsLast3Years', 'fairMarketValue', 'modified', 'vehicleUse', 'vehicleAge', 'sumInsured', 'ncbYears', 'fleetSize']));
    expect(s.riskFields.find((f) => f.field === 'driverAge').usedBy).toEqual(expect.arrayContaining([expect.stringContaining('YOUNG_DRV'), expect.stringContaining('DRV_AGE')]));
    // fields of acceptance rules are asked for as required; those only rated on (claim-free years) are optional
    expect(s.riskFields.find((f) => f.field === 'claimsLast3Years')).toMatchObject({ acceptanceRule: true, required: false });
    expect(s.riskFields.find((f) => f.field === 'ncbYears')).toMatchObject({ acceptanceRule: false });
    const group = (await sales('get', '/product-configurator/quote-setup?templateCode=HEALTH-GROUP-2026')).body.data;
    expect(group.riskFields.map((f) => f.field)).toContain('memberCount');
    expect((await sales('get', '/product-configurator/quote-setup?lob=NOPE')).body.data).toMatchObject({ templateCode: null, covers: [] });
  });
});

describe('risk fields captured: every acceptance rule is evaluated', () => {
  it('evaluates the driver age (from the date of birth), the claims count, the fair market value and modifications', async () => {
    const dob = `${Number(asOf.slice(0, 4)) - 19}-01-01`;
    // the wizard sends the total sum insured with the liability limits; the vehicle's own damage is what the value rules test
    const r = await sales('post', '/quotations').send(motor(riskFields(dob, { claimsLast3Years: 2, totalSumInsured: '1450000' })));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const uw = r.body.premiumBreakdown.underwriting;
    expect(uw.results.filter((x) => x.outcome === 'not-evaluated')).toEqual([]);
    expect(uw.facts).toMatchObject({ driverAge: 19, claimsLast3Years: 2, fairMarketValue: 1000000, modified: false, vehicleUse: 'Private', sumInsured: 1000000 });
    const by = Object.fromEntries(uw.results.map((x) => [x.ruleCode, x.outcome]));
    expect(by).toMatchObject({ YOUNG_DRV: 'loaded', CLAIMS_HIST: 'loaded', SI_VALIDATION: 'passed', MODIFIED: 'passed', PUV: 'passed', VEH_AGE_LIMIT: 'accepted', HIGH_SI: 'passed' });
    // the 15% young driver and 20% claims loadings on the net premium of the covers
    const b = r.body.premiumBreakdown;
    const covers = 15000 + b.actsOfNaturePremium + b.bodilyInjuryCoveragePremium + b.propertyDamageCoveragePremium + b.APPAcoveragePremium;
    expect(b.underwritingLoading).toBeCloseTo(covers * 0.35, 2);
    expect(r.body.netPremium).toBeCloseTo(covers * 1.35, 2);
  });

  it('a fair market value well below the sum insured refers the quotation; the group size is tested on a group risk', async () => {
    const r = await sales('post', '/quotations').send(motor(riskFields('1985-06-15', { fairMarketValue: 800000 })));
    expect(r.status).toBe(201);
    expect(r.body.premiumBreakdown.underwriting.results.find((x) => x.ruleCode === 'SI_VALIDATION')).toMatchObject({ outcome: 'referred' });
    expect(r.body.underwritingReferral).toMatchObject({ status: 'pending', ruleCodes: ['SI_VALIDATION'] });
    const g = await ctx.api('post', '/product-configurator/underwriting/evaluate').send({ templateCode: 'HEALTH-GROUP-2026', risk: { riskDetails: { memberCount: 8 } } });
    expect(g.body.data.results.find((x) => x.ruleCode === 'GRP_SIZE_MIN')).toMatchObject({ outcome: 'referred' });
    const ok = await ctx.api('post', '/product-configurator/underwriting/evaluate').send({ templateCode: 'HEALTH-GROUP-2026', risk: { memberCount: 25 } });
    expect(ok.body.data.results.find((x) => x.ruleCode === 'GRP_SIZE_MIN')).toMatchObject({ outcome: 'accepted' });
  });

  it('with underwriting.require_rule_fields a quotation missing a tested field is refused', async () => {
    await query("UPDATE app_settings SET value = 'true' WHERE key = 'underwriting.require_rule_fields'");
    clearSettingsCache();
    try {
      const r = await sales('post', '/quotations').send(motor({ vehicleUse: 'Private', fairMarketValue: 1000000, modified: false }));
      expect(r.status).toBe(400);
      expect(r.body.errors.map((e) => e.path).sort()).toEqual(['claimsLast3Years', 'driverAge']);
      expect((await sales('get', '/product-configurator/quote-setup?lob=MOTOR')).body.data.riskFields.filter((f) => f.required).map((f) => f.field)).toContain('driverAge');
      expect((await sales('post', '/quotations').send(motor(riskFields('1980-02-02')))).status).toBe(201);
    } finally {
      await query("UPDATE app_settings SET value = 'false' WHERE key = 'underwriting.require_rule_fields'");
      clearSettingsCache();
    }
  });
});

describe('covers of the Coverage Builder in the quotation', () => {
  it('prices only the covers chosen: optional covers left out are zero, mandatory ones are always in', async () => {
    const all = await sales('post', '/quotations').send(motor(riskFields('1980-02-02')));
    const a = all.body.premiumBreakdown;
    expect(a.bodilyInjuryCoveragePremium).toBeGreaterThan(0);
    expect(a.APPAcoveragePremium).toBeGreaterThan(0);
    expect(a.ctplCoveragePremium).toBe(0);
    expect(a.coverSelection).toMatchObject({ templateCode: 'MOT-003-2025', explicit: false });
    const r = await sales('post', '/quotations').send(motor({ ...riskFields('1980-02-02'), selectedCovers: ['AOG'] }));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const b = r.body.premiumBreakdown;
    expect(b).toMatchObject({ lossAndDamageCoveragePremium: 15000, actsOfNaturePremium: 5000, bodilyInjuryCoveragePremium: 0, propertyDamageCoveragePremium: 0, APPAcoveragePremium: 0,
      roadsideAssistancePremium: 0, personalAccidentCoverPremium: 0 });
    // CTPL is a mandatory cover of the template: priced from the tariff even though the quotation did not ask for it
    expect(b.ctplCoveragePremium).toBeGreaterThan(0);
    expect(r.body.netPremium).toBe(20000);
    expect(b.totalSumInsured).toBe(1000000);
    const sel = Object.fromEntries(b.coverSelection.covers.map((c) => [c.code, c.selected]));
    expect(sel).toEqual({ OD: true, THEFT: true, CTPL: true, AOG: true, 'VTPL-BI': false, 'VTPL-PD': false, APA: false, RSA: false, PAC: false });
    expect(b.coverSelection.covers.find((c) => c.code === 'AOG')).toMatchObject({ premium: 5000, type: 'Optional' });
    // the cover terms printed on the quotation follow the covers chosen
    expect((await sales('put', `/quotations/${r.body.quotationId}`).send({ selectedCovers: ['AOG', 'VTPL-BI'] })).body.premiumBreakdown.bodilyInjuryCoveragePremium).toBeGreaterThan(0);
  });

  it('refuses a cover that is not on the template', async () => {
    const r = await sales('post', '/quotations').send(motor({ ...riskFields('1980-02-02'), selectedCovers: ['AOG', 'BAIL_BOND'] }));
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('BAIL_BOND');
  });
});
