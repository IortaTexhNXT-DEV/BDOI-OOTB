/**
 * Motor rating controls of a quotation (TIS-BRD-PROD-12, PROD-09, PROD-10, QUOT-02; MC-01, MC-02; migration 0615):
 * FMV from a reference value less depreciation and the right to edit it with a reason; default issuing rates and the
 * right to change them (never the associate); a rate below the minimum referred; the discount cap and authority without
 * a promotion; the excess.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { motorTermsSection } from '../src/modules/documents/templates.js';

let ctx;
let associate;
let officer;
let unitHead;
let leadId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
const motor = (extra = {}) => ({
  leadRefId: leadId, productType: 'Motor', insurancePolicyType: 'COMP', vehicleCondition: 'Used', bodilyInjury: '100000', propertyDamage: '100000',
  participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }],
  insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelVariant: '1.3 XE CVT', modelYear: '2022', vehicleType: 'private_cars', seatingCapacity: '5' }],
  ...extra,
});
const setSetting = async (key, value) => {
  await q('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};

beforeAll(async () => {
  ctx = await setup();
  associate = await persona('mr.associate', ['tis-sales-associate']);
  officer = await persona('mr.officer', ['tis-sales-officer']);
  unitHead = await persona('mr.unithead', ['tis-sales-unit-head']);
  leadId = (await associate.api('post', '/leads').send({ firstName: 'Ramon', lastName: 'Bautista', emailId: 'ramon.bautista@example.ph', contactNumber: '09175550188', leadCategory: 'Retail' })).body.leadId;
});
afterAll(async () => { await pool.end(); });

describe('fair market value (PROD-12, MC-01)', () => {
  it('works out the FMV from the reference value less the default depreciation of 10%', async () => {
    const r = await associate.api('post', '/quotations').send(motor({ fmvRating: { referenceValue: 1000000 } }));
    expect(r.status).toBe(201);
    expect(Number(r.body.lossAndDamageCoverage)).toBe(900000);
    expect(r.body.motorRating.fmv).toMatchObject({ referenceValue: 1000000, referenceBasis: 'reference', depreciationPct: 10, computedFmv: 900000, fmv: 900000, edited: false });
  });

  it('takes a depreciation of the options only', async () => {
    const bad = await associate.api('post', '/quotations').send(motor({ fmvRating: { referenceValue: 1000000, depreciationPct: 12 } }));
    expect(bad.status).toBe(400);
    expect(bad.body.message).toContain('8, 10, 15, 20');
    const r = await associate.api('post', '/quotations').send(motor({ fmvRating: { referenceValue: 1000000, depreciationPct: 15 } }));
    expect(Number(r.body.lossAndDamageCoverage)).toBe(850000);
  });

  it('refuses an edited FMV from an associate; a user with the right gives a reason', async () => {
    const asked = motor({ lossAndDamageCoverage: '950000', fmvRating: { referenceValue: 1000000 } });
    const refused = await associate.api('post', '/quotations').send(asked);
    expect(refused.status).toBe(403);
    expect(refused.body.message).toContain('only users with the right to edit the FMV');
    const noReason = await officer.api('post', '/quotations').send(asked);
    expect(noReason.status).toBe(400);
    expect(noReason.body.message).toContain('reason for changing the fair market value');
    const ok = await officer.api('post', '/quotations').send({ ...asked, fmvRating: { referenceValue: 1000000, reasonCode: 'FMV-ACCESSORIES' } });
    expect(ok.status).toBe(201);
    expect(ok.body.motorRating.fmv).toMatchObject({ fmv: 950000, computedFmv: 900000, edited: true, reasonCode: 'FMV-ACCESSORIES', reason: 'Accessories added to the vehicle' });
    // another user changing another field keeps the edited FMV without asking again
    const later = await associate.api('put', `/quotations/${ok.body.quotationId}`).send({ remarks: 'Client called back' });
    expect(later.status).toBe(200);
    expect(later.body.motorRating.fmv.reasonCode).toBe('FMV-ACCESSORIES');
  });

  it('starts from the SRP of a TFS prospect; a brand-new vehicle is not depreciated', async () => {
    const lead = (await associate.api('post', '/leads').send({ firstName: 'Nina', lastName: 'Ocampo', emailId: 'nina.ocampo@example.ph', contactNumber: '09175550189', leadCategory: 'Retail', srp: 1250000 })).body.leadId;
    const brandNew = await associate.api('post', '/quotations').send(motor({ leadRefId: lead, vehicleCondition: 'Brand New' }));
    expect(brandNew.body.motorRating.fmv).toMatchObject({ referenceBasis: 'srp', depreciationPct: 0, fmv: 1250000 });
    const used = await associate.api('post', '/quotations').send(motor({ leadRefId: lead }));
    expect(used.body.motorRating.fmv).toMatchObject({ referenceBasis: 'srp', depreciationPct: 10, fmv: 1125000 });
  });

  it('keys the FMV as before when there is no reference value', async () => {
    const r = await associate.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '780000' }));
    expect(r.status).toBe(201);
    expect(r.body.motorRating.fmv).toBeNull();
    expect(Number(r.body.lossAndDamageCoverage)).toBe(780000);
  });
});

describe('issuing rates (PROD-12, MC-02, FR-CMR-020)', () => {
  it('fills the default Own Damage rate and prices on it', async () => {
    const r = await associate.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '1000000' }));
    expect(r.status).toBe(201);
    expect(r.body.motorRating.rates.default.OD).toBe(2);
    expect(Number(r.body.lossAndDamageCoverageRate)).toBe(2);
    expect(r.body.premiumBreakdown.lossAndDamageCoveragePremium).toBe(20000);
  });

  it('refuses a changed rate from an associate; an officer changes it and the change is recorded', async () => {
    const asked = motor({ lossAndDamageCoverage: '1000000', lossAndDamageCoverageRate: '1.8', rateOverride: { reasonCode: 'RTO-INSURER' } });
    const refused = await associate.api('post', '/quotations').send(asked);
    expect(refused.status).toBe(403);
    expect(refused.body.message).toContain('Own Damage rate 1.8% differs from the issuing rate of 2%');
    const ok = await officer.api('post', '/quotations').send(asked);
    expect(ok.status).toBe(201);
    expect(ok.body.motorRating.rates.override).toMatchObject({ perils: ['OD'], rates: { OD: 1.8 }, reasonCode: 'RTO-INSURER' });
    expect(ok.body.premiumBreakdown.lossAndDamageCoveragePremium).toBe(18000);
    expect(ok.body.underwritingReferral?.ruleCodes || []).not.toContain('RATE_BELOW_MIN');
  });

  it('refers a rate below the lowest Own Damage rate of the discount cap to the approvers', async () => {
    const r = await officer.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '1000000', lossAndDamageCoverageRate: '1.3' }));
    expect(r.status).toBe(201);
    const ref = r.body.underwritingReferral;
    expect(ref).toMatchObject({ status: 'pending', minimumRates: { OD: 1.3 } });
    expect(ref.ruleCodes).toContain('RATE_BELOW_MIN');
    expect(ref.authorityRoles).toContain('tis-sales-unit-head');
    expect(ref.reasons.join(' ')).toContain('below the minimum issuing rate of 1.4%');
    expect((await officer.api('post', `/quotations/${r.body.quotationId}/underwriting-referral`).send({ decision: 'approve' })).status).toBe(403);
    const ok = await unitHead.api('post', `/quotations/${r.body.quotationId}/underwriting-referral`).send({ decision: 'approve' });
    expect(ok.status).toBe(200);
  });

  it('lets anyone change the rates once motor.rate_override_controlled is off', async () => {
    await setSetting('motor.rate_override_controlled', false);
    try {
      const r = await associate.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '1000000', lossAndDamageCoverageRate: '1.9' }));
      expect(r.status).toBe(201);
      expect(r.body.motorRating.rates.override.rates.OD).toBe(1.9);
    } finally {
      await setSetting('motor.rate_override_controlled', true);
    }
  });
});

describe('discount without a promotion (PROD-09) and excess (PROD-10)', () => {
  it('refuses a discount above the cap and refers one above the maker\'s authority', async () => {
    const base = (await officer.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '1000000' }))).body;
    const discountable = base.grossPremium;
    const above = await officer.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '1000000', discount: Math.round(discountable * 0.3) }));
    expect(above.status).toBe(400);
    expect(above.body.message).toContain('above the maximum of 25.00%');
    const referred = await officer.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '1000000', discount: Math.round(discountable * 0.12) }));
    expect(referred.status).toBe(201);
    expect(referred.body.underwritingReferral.ruleCodes).toContain('PROMO_DISCOUNT');
    const within = await officer.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '1000000', discount: Math.round(discountable * 0.05) }));
    expect(within.body.underwritingReferral).toBeFalsy();
  });

  it('shows the Motor excess at 5% of the sum insured, and the FMV basis on the quotation slip', async () => {
    const r = await associate.api('post', '/quotations').send(motor({ lossAndDamageCoverage: '800000' }));
    expect(r.body.motorRating.excess).toMatchObject({ basis: 'sum-insured', pct: 5, amount: 40000, source: 'setting' });
    const f = { ccy: (v, c) => `${c || 'PHP'} ${Number(v).toFixed(2)}` };
    const fmv = (await associate.api('post', '/quotations').send(motor({ fmvRating: { referenceValue: 1000000 } }))).body;
    expect(motorTermsSection(fmv, f).rows).toEqual([['Fair market value', 'PHP 900000.00'], ['Basis', 'Reference value PHP 1000000.00 less 10% depreciation'],
      ['Excess (deductible)', 'PHP 45000.00']]);
    expect(motorTermsSection({ ...fmv, motorRating: null }, f)).toBeNull();
  });
});

describe('motor rating for Create Quote', () => {
  it('gives the defaults and the rights of the user', async () => {
    const draft = motor({ fmvRating: { referenceValue: 1000000, depreciationPct: 8 } });
    const a = await associate.api('post', '/quotations/motor-rating').send(draft);
    expect(a.status).toBe(200);
    expect(a.body.data).toMatchObject({ fmv: { computedFmv: 920000, depreciationPct: 8 }, depreciationOptions: [8, 10, 15, 20], rates: { OD: 2, AON: 0.5 },
      canChangeRates: false, canEditFmv: false, excess: { amount: 46000 } });
    const o = await officer.api('post', '/quotations/motor-rating').send(draft);
    expect(o.body.data).toMatchObject({ canChangeRates: true, canEditFmv: true });
  });
});
