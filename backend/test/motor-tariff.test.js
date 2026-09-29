import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
const vehicle = (vehicleType, seatingCapacity = '5') => ({ insuranceVehicleDetails: [{ vehicleType, seatingCapacity }] });
const motor = (extra) => ({ productType: 'Motor', lossAndDamageCoverage: 1200000, lossAndDamageCoverageRate: 2, ...extra });
const price = async (body) => ctx.api('post', '/quotations/calculate-premium').send(body);

beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('Motor tariff (CTPL fixed premium, Auto Passenger PA per seat)', () => {
  it('lists the Insurance Commission vehicle classes with the CTPL tariff and the APPA limits', async () => {
    const r = await ctx.api('get', '/quotations/motor-tariff');
    expect(r.status).toBe(200);
    const byCode = Object.fromEntries(r.body.data.vehicleTypes.map((v) => [v.value, v]));
    expect(byCode.private_cars).toMatchObject({ ctplPremium: 560, defaultSeats: 5, ownDamageRate: 2 });
    expect(byCode.motorcycles_tricycles.ctplPremium).toBe(250);
    expect(byCode.pub_and_tourist_bus.ctplPremium).toBe(1450);
    expect(r.body.data.appa).toEqual({ limits: [25000, 50000, 75000, 100000, 150000, 200000], ratePercent: 0.1 });
  });

  it('prices CTPL at the tariff of the vehicle class, whatever amount the browser sends', async () => {
    const r = await price(motor({ includeCTPL: true, ctplCoverageRate: '1.00', ...vehicle('private_cars') }));
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ vehicleType: 'private_cars', ctplCoveragePremium: 560, netPremium: 24560 });
    const truck = await price(motor({ includeCTPL: true, ...vehicle('Heavy trucks (own goods) and private buses over 3,930 kg', '3') }));
    expect(truck.body.data).toMatchObject({ vehicleType: 'heavy_trucks', ctplCoveragePremium: 1200 });
  });

  it('leaves CTPL out when it is not included and refuses CTPL without a vehicle class', async () => {
    expect((await price(motor({ includeCTPL: false, ...vehicle('private_cars') }))).body.data.ctplCoveragePremium).toBe(0);
    const r = await price(motor({ includeCTPL: true }));
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/vehicle type/i);
  });

  it('prices Auto Passenger PA as limit per person x seats x rate and counts the cover in the sum insured', async () => {
    const r = await price(motor({ autoPassengerPersonalAccident: '50,000', APPAtotalCoverage: '1000', APPAcoveragePremium: '5.00', ...vehicle('private_cars', '7') }));
    expect(r.body.data).toMatchObject({ appaSeats: 7, APPAtotalCoverage: 350000, APPAcoveragePremium: 350, netPremium: 24350, totalSumInsured: 1550000 });
    // seats default to the vehicle class when the vehicle has none
    const d = await price(motor({ autoPassengerPersonalAccident: '100000', insuranceVehicleDetails: [{ vehicleType: 'motorcycles_tricycles' }] }));
    expect(d.body.data).toMatchObject({ appaSeats: 2, APPAtotalCoverage: 200000, APPAcoveragePremium: 200 });
  });

  it('refuses an APPA limit outside the tariff', async () => {
    const r = await price(motor({ autoPassengerPersonalAccident: '60000', ...vehicle('private_cars') }));
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/limit per person/i);
  });

  it('follows tariff changes made in the Product Configurator', async () => {
    await pool.query(`UPDATE product_templates SET config = jsonb_set(config, '{ctplSetting,private_cars}', '"610.00"') WHERE template_code = 'MOT-003-2025'`);
    clearSettingsCache();
    expect((await price(motor({ includeCTPL: true, ...vehicle('private_cars') }))).body.data.ctplCoveragePremium).toBe(610);
  });
});

describe('Brokerage rate', () => {
  it('books the brokerage % of the commission rule shown on the order summary', async () => {
    const r = await price(motor({ commissionDetails: { brokeragePct: 18 } }));
    expect(r.body.data.commissionRate).toBe(0.18);
    expect(r.body.data.commissionAmount).toBe(4320);
  });
});

describe('Saved quotation', () => {
  it('stores the server-priced CTPL and Auto Passenger PA in the quotation', async () => {
    const lead = await ctx.api('post', '/leads').send({ firstName: 'Carlo', lastName: 'Tan', emailId: 'carlo.tan@example.ph', contactNumber: '09170000009', leadCategory: 'Retail' });
    const r = await ctx.api('post', '/quotations').send(motor({ leadRefId: lead.body.leadId, includeCTPL: true, ctplCoverageRate: '999', autoPassengerPersonalAccident: '50,000',
      APPAtotalCoverage: '1000', APPAcoveragePremium: '5.00', participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }], ...vehicle('private_cars', '5') }));
    expect(r.status).toBe(201);
    const [row] = (await pool.query('SELECT doc, premium_base FROM quotes WHERE quote_number = $1', [r.body.quotationNumber])).rows;
    // 610: the private car tariff as changed in the Product Configurator test above
    expect(row.doc).toMatchObject({ ctplCoveragePremium: 610, ctplCoverageRate: '610.00', APPAtotalCoverage: 250000, APPAcoveragePremium: 250, appaSeats: 5 });
    expect(Number(row.premium_base)).toBe(24000 + 610 + 250);
  });
});
