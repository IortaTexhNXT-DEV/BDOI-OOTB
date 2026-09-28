import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('addresses', () => {
  it('walks country -> province -> city -> district by id', async () => {
    const countries = await ctx.api('get', '/addresses/countries');
    const ph = countries.body.data.find((c) => c.code === 'PH');
    expect(ph).toBeTruthy();
    const provinces = await ctx.api('get', `/addresses/countries/${ph.id}/provinces`);
    const ncr = provinces.body.data.find((p) => p.name === 'Metro Manila');
    const cities = await ctx.api('get', `/addresses/provinces/${ncr.id}/cities`);
    const makati = cities.body.data.find((c) => c.name === 'Makati');
    const districts = await ctx.api('get', `/addresses/cities/${makati.id}/districts`);
    expect(districts.body.data.map((d) => d.name)).toEqual(expect.arrayContaining(['Bel-Air', 'Poblacion']));
  });
  it('accepts codes and names for the parent, and serves Thailand', async () => {
    const byCode = await ctx.api('get', '/addresses/countries/TH/provinces');
    expect(byCode.body.data.map((p) => p.name)).toContain('Bangkok');
    const cities = await ctx.api('get', '/addresses/provinces/Bangkok/cities');
    expect(cities.body.data.map((c) => c.name)).toContain('Pathum Wan');
    expect((await ctx.api('get', '/addresses/countries/XX/provinces')).body.data).toEqual([]);
  });
  it('looks up postal codes for auto-fill', async () => {
    const r = await ctx.api('get', '/addresses/postal-code?countryCode=PH&code=1209');
    expect(r.body.data[0]).toMatchObject({ province: 'Metro Manila', city: 'Makati', district: 'Bel-Air' });
    const th = await ctx.api('get', '/addresses/postal-code?countryCode=TH&code=10500');
    expect(th.body.data.map((x) => x.district)).toEqual(['Si Lom', 'Suriya Wong']);
    expect((await ctx.api('get', '/addresses/postal-code?countryCode=PH')).body.data).toEqual([]);
  });
  it('requires a signed-in user', async () => {
    expect((await request(ctx.app).get('/api/addresses/countries')).status).toBe(401);
  });
});
