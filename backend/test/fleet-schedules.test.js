import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
let ops;
let sales;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const HEADER = 'Plate Number,Chassis Number,Engine Number,Make,Model,Year Model,Vehicle Type,Usage,Sum Insured,Own Damage Rate %,Acts of Nature Rate %,Excess Bodily Injury,Property Damage,Include CTPL';

beforeAll(async () => {
  ctx = await setup();
  ops = await persona('fl.ops', ['operations']);
  sales = await persona('fl.sales', ['sales']);
});
afterAll(async () => { await pool.end(); });

describe('fleet schedule', () => {
  let fleetId;
  let policyId;
  it('starts a draft schedule and prices each vehicle on its own (own damage, liability, CTPL tariff, taxes)', async () => {
    expect((await sales('post', '/fleet').send({ clientId: 'cl_sls_04', inceptionDate: '2026-10-01' })).status).toBe(403);
    const s = await ops('post', '/fleet').send({ clientId: 'cl_sls_04', insuranceCompanyId: 2, inceptionDate: '2026-10-01', expiryDate: '2027-10-01', description: 'Delivery fleet' });
    expect(s.status).toBe(201);
    fleetId = s.body.data.id;
    const v = await ops('post', `/fleet/${fleetId}/vehicles`).send({ plateNumber: 'NBC 1234', chassisNumber: 'MPATFS86JMT004321', make: 'Isuzu', model: 'D-Max', vehicleType: 'light_medium_trucks',
      sumInsured: 1450000, ownDamageRate: 1.25, actsOfNatureRate: 0.5, includeCtpl: true });
    expect(v.status).toBe(201);
    expect(v.body.data).toMatchObject({ itemNo: 1, ctplPremium: 660.4, sumInsured: 1450000 });
    // net premium = 1.25% + 0.5% of the sum insured
    expect(v.body.data.netPremium).toBeCloseTo(25375, 2);
    expect(v.body.data.grossPremium).toBeCloseTo(v.body.data.netPremium + v.body.data.taxes + 660.4, 2);
    const dup = await ops('post', `/fleet/${fleetId}/vehicles`).send({ plateNumber: 'nbc 1234', make: 'Isuzu', model: 'D-Max', sumInsured: 1000000, ownDamageRate: 1 });
    expect(dup.status).toBe(400);
  });

  it('uploads vehicles from the Fleet Vehicles template, reporting the bad rows', async () => {
    const tpl = await ops('get', '/fleet/upload-template').buffer(true).parse(binary);
    expect(tpl.headers['content-disposition']).toMatch(/Fleet_Vehicles_Upload_Template\.xlsx/);
    const file = Buffer.from([HEADER,
      'NDE 5521,JTFSS22P5R0123987,1GD-8812345,Toyota,Hiace,2025,light_medium_trucks,Commercial,"1,880,000",1.25,0.5,200000,200000,Yes',
      'NAB 7788,MHKA4DE3JNJ012345,1KR-1111,Toyota,Wigo,2024,private_cars,Private,620000,1.4,0,,,No',
      ',,,,Bus,2024,,,500000,1,0,,,No'].join('\r\n'));
    const r = await ops('post', `/fleet/${fleetId}/vehicles/upload`).attach('file', file, 'fleet.csv');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ total: 3, created: 2, failed: 1 });
    const s = await ops('get', `/fleet/${fleetId}`);
    expect(s.body.data.vehicleList.map((v) => v.itemNo)).toEqual([1, 2, 3]);
    expect(s.body.data.vehicleList[2]).toMatchObject({ includeCtpl: false, ctplPremium: 0 });
  });

  it('issues one policy for the total premium of the vehicles, with its bill', async () => {
    const s = (await ops('get', `/fleet/${fleetId}`)).body.data;
    const r = await ops('post', `/fleet/${fleetId}/issue`);
    expect(r.status).toBe(200);
    policyId = r.body.data.policyId;
    expect(r.body.data.vehicles).toBe(3);
    const p = (await pool.query('SELECT * FROM policies WHERE id = $1', [policyId])).rows[0];
    expect(Number(p.premium_total)).toBeCloseTo(s.grossPremium, 2);
    expect(Number(p.sum_insured)).toBe(1450000 + 1880000 + 620000);
    expect(p.inception_date).toBe('2026-10-01');
    expect(p.doc.isFleet).toBe(true);
    const bill = (await pool.query('SELECT amount FROM receivables WHERE policy_id = $1', [policyId])).rows;
    expect(bill.length).toBe(1);
    expect(Number(bill[0].amount)).toBeCloseTo(s.grossPremium, 2);
    expect((await ops('post', `/fleet/${fleetId}/vehicles`).send({ plateNumber: 'X', make: 'A', model: 'B', sumInsured: 1, ownDamageRate: 1 })).status).toBe(409);
  });

  it('adds a vehicle by endorsement at the pro-rata premium of the days left; the additional premium is billed', async () => {
    const r = await ops('post', `/fleet/${fleetId}/endorse/add-vehicle`).send({ effectiveDate: '2027-04-01', plateNumber: 'NFG 3030', chassisNumber: 'CH-NEW-1', make: 'Mitsubishi', model: 'L300',
      vehicleType: 'light_medium_trucks', sumInsured: 1000000, ownDamageRate: 1.25, includeCtpl: true });
    expect(r.status).toBe(200);
    expect(r.body.data.daysLeft).toBe(183);
    expect(r.body.data.factor).toBeCloseTo(183 / 365, 6);
    const v = r.body.data.vehicle;
    expect(r.body.data.premium).toBeCloseTo(v.grossPremium * 183 / 365, 0);
    const e = (await pool.query('SELECT e.*, r.amount FROM endorsements e LEFT JOIN receivables r ON r.id = e.receivable_id WHERE e.id = $1', [r.body.data.endorsementId])).rows[0];
    expect(e.status).toBe('completed');
    expect(e.endorsement_type).toBe('Fleet: add vehicle');
    expect(Number(e.amount)).toBeCloseTo(r.body.data.premium, 2);
    const s = (await ops('get', `/fleet/${fleetId}`)).body.data;
    expect(s.vehicleList.find((x) => x.plateNumber === 'NFG 3030')).toMatchObject({ coverFrom: '2027-04-01', addedEndorsementNumber: e.endorsement_number });
    expect(s.endorsements.length).toBe(1);
  });

  it('deletes a vehicle by endorsement: return premium credited pro-rata, the vehicle keeps its dates on cover', async () => {
    const before = (await pool.query('SELECT premium_total FROM policies WHERE id = $1', [policyId])).rows[0];
    const v = (await pool.query("SELECT id, gross_premium FROM fleet_vehicles WHERE plate_number = 'NAB 7788'")).rows[0];
    const r = await ops('post', `/fleet/${fleetId}/endorse/delete-vehicle/${v.id}`).send({ effectiveDate: '2027-04-01', reason: 'Vehicle sold' });
    expect(r.status).toBe(200);
    expect(r.body.data.premium).toBeLessThan(0);
    expect(Math.abs(r.body.data.premium)).toBeCloseTo(Number(v.gross_premium) * 183 / 365, 0);
    const after = (await pool.query('SELECT premium_total, sum_insured FROM policies WHERE id = $1', [policyId])).rows[0];
    expect(Number(after.premium_total)).toBeCloseTo(Number(before.premium_total) + r.body.data.premium, 2);
    expect(Number(after.sum_insured)).toBe(1450000 + 1880000 + 1000000);
    const credit = (await pool.query("SELECT sum(amount) AS a FROM receivable_credits WHERE policy_id = $1 AND kind = 'return-premium'", [policyId])).rows[0];
    expect(Number(credit.a)).toBeCloseTo(Math.abs(r.body.data.premium), 2);
    const row = (await pool.query('SELECT status, cover_to FROM fleet_vehicles WHERE id = $1', [v.id])).rows[0];
    expect(row).toEqual({ status: 'deleted', cover_to: '2027-04-01' });
    const outside = await ops('post', `/fleet/${fleetId}/endorse/delete-vehicle/${v.id}`).send({ effectiveDate: '2027-04-01' });
    expect(outside.status).toBe(404);
    const bad = await ops('post', `/fleet/${fleetId}/endorse/add-vehicle`).send({ effectiveDate: '2028-01-01', plateNumber: 'ZZ', make: 'A', model: 'B', sumInsured: 100000, ownDamageRate: 1 });
    expect(bad.status).toBe(400);
  });

  it('with fleet.return_premium_on_delete off a deletion returns nothing', async () => {
    await pool.query("UPDATE app_settings SET value = 'false' WHERE key = 'fleet.return_premium_on_delete'");
    clearSettingsCache();
    const v = (await pool.query("SELECT id FROM fleet_vehicles WHERE plate_number = 'NFG 3030'")).rows[0];
    const r = await ops('post', `/fleet/${fleetId}/endorse/delete-vehicle/${v.id}`).send({ effectiveDate: '2027-06-01' });
    expect(r.status).toBe(200);
    expect(r.body.data.premium).toBe(0);
  });

  it('prints and exports the schedule of vehicles', async () => {
    const pdf = await sales('get', `/fleet/${fleetId}/schedule.pdf`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    const xlsx = await sales('get', `/fleet/${fleetId}/schedule.xlsx`).buffer(true).parse(binary);
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toMatch(/spreadsheetml/);
    const csv = await sales('get', `/fleet/${fleetId}/schedule.xlsx?format=csv`);
    expect(csv.text).toMatch(/NBC 1234/);
    expect(csv.text).toMatch(/deleted/);
  });
});
