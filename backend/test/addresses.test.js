import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup } from './helpers.js';
import fs from 'node:fs';
import { pool, query } from '../src/db/pool.js';
import { buildSql, SEED_FILE } from '../scripts/build-ph-geography.js';
import { loadBarangays, parseArgs } from '../scripts/load-barangays.js';
import { readPsgc } from '../scripts/lib/psgc.js';

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

const rows = async (sql, params) => (await query(sql, params)).rows;

describe('Philippine geography seeded from the PSGC', () => {
  it('ships 18 regions, 82 provinces, 1,642 cities and municipalities with PSGC codes', async () => {
    const [counts] = await rows(`SELECT
      (SELECT count(*)::int FROM regions WHERE status = 'active') AS regions,
      (SELECT count(*)::int FROM states WHERE attrs->>'Level' = 'Province' AND status = 'active') AS provinces,
      (SELECT count(*)::int FROM states s JOIN countries c ON c.id = s.country_id WHERE c.code = 'PH' AND s.status = 'active') AS areas,
      (SELECT count(*)::int FROM cities WHERE psgc_code IS NOT NULL AND status = 'active') AS cities,
      (SELECT count(*)::int FROM cities WHERE city_class = 'Highly Urbanized City') AS huc,
      (SELECT count(*)::int FROM cities WHERE city_class = 'Municipality') AS municipalities,
      (SELECT count(*)::int FROM cities ci JOIN states s ON s.id = ci.state_id WHERE ci.zip_code IS NULL AND s.country_id = (SELECT id FROM countries WHERE code = 'PH')) AS no_zip`);
    // 17 regions plus the Negros Island Region (Republic Act No. 12000, 2024): 18 in the PSGC of 2026
    expect(counts).toEqual({ regions: 18, provinces: 82, areas: 84, cities: 1642, huc: 33, municipalities: 1493, no_zip: 0 });
    const ncr = await rows("SELECT r.code, r.psgc_code, (SELECT count(*)::int FROM cities ci WHERE ci.region_id = r.id) AS lgus FROM regions r WHERE r.code = 'NCR'");
    expect(ncr).toEqual([{ code: 'NCR', psgc_code: '1300000000', lgus: 17 }]);
    // every PSGC code is unique and has 10 digits
    const [bad] = await rows("SELECT count(*)::int AS n FROM cities WHERE psgc_code IS NOT NULL AND psgc_code !~ '^[0-9]{10}$'");
    expect(bad.n).toBe(0);
  });
  it('has no active Thai reference record', async () => {
    const [th] = await rows(`SELECT
      (SELECT count(*)::int FROM states s JOIN countries c ON c.id = s.country_id WHERE c.code = 'TH' AND s.status = 'active') AS provinces,
      (SELECT count(*)::int FROM cities WHERE name IN ('Pathum Wan', 'Bang Rak', 'Mueang Chiang Mai', 'Mueang Phuket') AND status = 'active') AS cities,
      (SELECT count(*)::int FROM states WHERE name IN ('Bangkok', 'Chiang Mai', 'Phuket') AND status = 'active') AS named,
      (SELECT count(*)::int FROM postal_codes WHERE upper(country_code) = 'TH') AS postal`);
    expect(th).toEqual({ provinces: 0, cities: 0, named: 0, postal: 0 });
    const languages = await rows("SELECT value FROM app_settings WHERE key = 'general.languages'");
    expect(JSON.stringify(languages[0].value)).not.toContain('"th"');
  });
  it('labels the State master Province and keeps its API code and field names', async () => {
    const def = await ctx.api('get', '/masters/state/definition');
    expect(def.body.data.label).toBe('Province');
    expect(def.body.data.fields.find((f) => f.name === 'StateName').label).toBe('Province Name');
    expect(def.body.data.fields.find((f) => f.name === 'Region')).toMatchObject({ optionsFrom: 'region' });
    // the new name is accepted too
    const byAlias = await ctx.api('get', '/masters/province?search=Cebu');
    expect(byAlias.status).toBe(200);
    expect(byAlias.body.data.find((p) => p.StateName === 'Cebu')).toMatchObject({ StateCode: 'CEB', Region: 'Region VII (Central Visayas)', PsgcCode: '0702200000' });
    const branch = await ctx.api('get', '/masters/branch/definition');
    expect(branch.body.data.fields.find((f) => f.name === 'State').label).toBe('Province');
    expect(branch.body.data.fields.find((f) => f.name === 'City').label).toBe('City / Municipality');
    const city = await ctx.api('get', '/masters/city?State=Metro%20Manila&perPage=50');
    expect(city.body.data).toHaveLength(17);
    expect(city.body.data.find((c) => c.CityName === 'Makati City')).toMatchObject({ PostalCode: '1200', CityClass: 'Highly Urbanized City', Region: 'National Capital Region (NCR)', NcrDistrict: 'Fourth District' });
    const regions = await ctx.api('get', '/masters/region/options?valueField=code');
    expect(regions.body.data.map((r) => r.value)).toEqual(expect.arrayContaining(['NCR', 'CAR', 'I', 'IV-A', 'MIMAROPA', 'XIII', 'BARMM', 'NIR']));
  });
});

describe('address cascade: region -> province -> city / municipality -> barangay', () => {
  it('walks NCR -> Metro Manila -> Makati City -> barangays, by id', async () => {
    const countries = await ctx.api('get', '/addresses/countries');
    const ph = countries.body.data.find((c) => c.code === 'PH');
    const regions = await ctx.api('get', `/addresses/countries/${ph.id}/regions`);
    expect(regions.body.data).toHaveLength(18);
    expect(regions.body.data[0]).toMatchObject({ code: 'NCR', psgcCode: '1300000000' });
    const ncr = regions.body.data[0];
    const provinces = await ctx.api('get', `/addresses/regions/${ncr.id}/provinces`);
    expect(provinces.body.data.map((p) => p.name)).toEqual(['Metro Manila']);
    const cities = await ctx.api('get', `/addresses/provinces/${provinces.body.data[0].id}/cities`);
    const names = cities.body.data.map((c) => c.name);
    expect(names).toHaveLength(17);
    expect(names).toEqual(expect.arrayContaining(['Makati City', 'Quezon City', 'Manila City', 'Taguig City', 'Pateros', 'Las Piñas City']));
    const makati = cities.body.data.find((c) => c.name === 'Makati City');
    expect(makati).toMatchObject({ psgcCode: '1380300000', zipCode: '1200', cityClass: 'Highly Urbanized City', regionCode: 'NCR' });
    const barangays = await ctx.api('get', `/addresses/cities/${makati.id}/barangays`);
    expect(barangays.body.data.map((d) => d.name)).toEqual(expect.arrayContaining(['Bel-Air', 'Poblacion', 'San Lorenzo']));
    // earlier route name
    expect((await ctx.api('get', `/addresses/cities/${makati.id}/districts`)).body.data).toEqual(barangays.body.data);
  });
  it('accepts codes, PSGC codes and names for the parent; filters provinces by region', async () => {
    const cebu = await ctx.api('get', '/addresses/regions/VII/provinces');
    expect(cebu.body.data.map((p) => p.name)).toEqual(['Bohol', 'Cebu']);
    const byRegion = await ctx.api('get', '/addresses/countries/PH/provinces?region=CAR');
    expect(byRegion.body.data.map((p) => p.code)).toEqual(['ABR', 'APA', 'BEN', 'IFU', 'KAL', 'MOU']);
    for (const parent of ['CEB', '0702200000', 'Cebu']) {
      const cities = await ctx.api('get', `/addresses/provinces/${parent}/cities`);
      expect(cities.body.data.map((c) => c.name)).toEqual(expect.arrayContaining(['Cebu City', 'Lapu-Lapu City', 'Mandaue City', 'Danao City']));
    }
    // Isabela City lies in Basilan (BARMM) but belongs to Region IX
    const basilan = await ctx.api('get', '/addresses/provinces/Basilan/cities');
    expect(basilan.body.data.find((c) => c.name === 'Isabela City')).toMatchObject({ regionCode: 'IX' });
    // a province outside the list, a country without regions
    expect((await ctx.api('get', '/addresses/countries/XX/provinces')).body.data).toEqual([]);
    expect((await ctx.api('get', '/addresses/countries/SG/regions')).body.data).toEqual([]);
    // barangays outside Metro Manila are an optional load: empty list, the screens take free text
    expect((await ctx.api('get', '/addresses/cities/0730600000/barangays')).body.data).toEqual([]);
  });
  it('suggests the ZIP code of a city and fills an address from a ZIP code', async () => {
    const zips = await ctx.api('get', '/addresses/cities/1380300000/postal-codes');
    expect(zips.body.data[0]).toEqual({ postalCode: '1200', place: 'Makati City', main: true });
    expect(zips.body.data.map((z) => z.postalCode)).toEqual(expect.arrayContaining(['1209', '1226']));
    const r = await ctx.api('get', '/addresses/postal-code?countryCode=PH&code=1209');
    expect(r.body.data[0]).toMatchObject({ region: 'National Capital Region (NCR)', province: 'Metro Manila', city: 'Makati City', postalCode: '1209' });
    const cebu = await ctx.api('get', '/addresses/postal-code?countryCode=Philippines&code=6000');
    expect(cebu.body.data.map((x) => x.city)).toContain('Cebu City');
    expect((await ctx.api('get', '/addresses/postal-code?countryCode=PH')).body.data).toEqual([]);
  });
  it('requires a signed-in user', async () => {
    expect((await request(ctx.app).get('/api/addresses/countries')).status).toBe(401);
    expect((await request(ctx.app).get('/api/addresses/countries/PH/regions')).status).toBe(401);
  });
});

describe('Philippine address on leads and clients', () => {
  it('stores street and region; fills the region from the province', async () => {
    const lead = await ctx.api('post', '/leads').send({ firstName: 'Ana', lastName: 'Reyes', emailId: 'ana.reyes@example.ph', contactNumber: '09171234567', gender: 'Female',
      houseNo: 'Unit 5B', street: 'Gorordo Ave.', barangay: 'Lahug', city: 'Cebu City', province: 'Cebu', zipCode: '6000', country: 'Philippines', lob: 'MOTOR' });
    expect(lead.status).toBe(201);
    expect(lead.body.data).toMatchObject({ street: 'Gorordo Ave.', roadThanon: 'Gorordo Ave.', region: 'Region VII (Central Visayas)', province: 'Cebu' });
    const client = await ctx.api('post', '/clients').send({ firstName: 'Ben', lastName: 'Cruz', city: 'Isabela City', province: 'Basilan', country: 'Philippines' });
    expect(client.status).toBe(201);
    expect(client.body.data.region).toBe('Region IX (Zamboanga Peninsula)');
    const given = await ctx.api('post', '/clients').send({ firstName: 'Cora', lastName: 'Lim', province: 'Metro Manila', region: 'NCR' });
    expect(given.body.data.region).toBe('NCR');
  });
});

describe('PSGC files and the optional barangay load', () => {
  it('the reference seed is the one generated from the shipped PSGC files', () => {
    expect(fs.readFileSync(SEED_FILE, 'utf8')).toBe(buildSql());
    expect(readPsgc('barangays.csv').length).toBeGreaterThan(42000);
  });
  it('loads the barangays of a region once (dry run first), keeps those entered by hand, and fills ZIP codes', async () => {
    const opts = parseArgs(['--region=VII']);
    expect(opts).toMatchObject({ execute: false, regions: ['07'] });
    const before = (await rows('SELECT count(*)::int AS n FROM districts'))[0].n;
    const city = (await rows("SELECT id FROM cities WHERE psgc_code = '0730600000'"))[0].id;
    await query("INSERT INTO districts(city_id, name) VALUES ($1, 'LAHUG')", [city]);
    const dry = await loadBarangays({ ...opts, log: () => {} });
    expect(dry.added).toBeGreaterThan(2000);
    expect((await rows('SELECT count(*)::int AS n FROM districts'))[0].n).toBe(before + 1);
    const done = await loadBarangays({ ...opts, execute: true, log: () => {} });
    expect(done).toMatchObject({ added: dry.added, coded: 1, unknownCities: [] });
    const lahug = await rows("SELECT name, psgc_code FROM districts WHERE city_id = $1 AND lower(name) = 'lahug'", [city]);
    expect(lahug).toEqual([{ name: 'LAHUG', psgc_code: '0730600041' }]);
    const again = await loadBarangays({ ...opts, execute: true, log: () => {} });
    expect(again).toMatchObject({ added: 0, coded: 0 });
    const cebu = await ctx.api('get', '/addresses/cities/0730600000/barangays');
    expect(cebu.body.data.length).toBe(80);
  });
});
