import { moduleRouter } from '../../lib/registry.js';
import { requireAuth } from '../../lib/auth.js';
import { many } from '../../db/pool.js';
import { ok } from '../../lib/respond.js';

/**
 * Address pickers of the Philippine address format (House / Unit No., Street, Barangay, City / Municipality, Province,
 * Region, ZIP code) used by lead creation (Motor / Fire / IAR), clients, claims, endorsements and My Profile:
 * country -> region -> province -> city / municipality -> barangay, the ZIP codes of a city, and a ZIP code look-up for
 * auto-fill. Regions, provinces, cities and barangays carry their PSGC code (Philippine Standard Geographic Code).
 * Reads only reference data, so any signed-in user may call them.
 */
const { router, define } = moduleRouter('Addresses', '/addresses');
const SCREEN = 'Operations > Sales & Marketing > Prospects > Create Lead (address fields)';

/** Accept a numeric id, a code, a PSGC code or a name for the parent record. */
const parentMatch = (alias, { code = true } = {}) => `(${alias}.id::text = $1 OR ${alias}.psgc_code = $1${code ? ` OR lower(${alias}.code) = lower($1)` : ''} OR lower(${alias}.name) = lower($1))`;

const PROVINCE_COLUMNS = `s.id, s.code, s.name, s.psgc_code AS "psgcCode", s.attrs->>'Level' AS level,
  r.id AS "regionId", r.code AS "regionCode", r.name AS "regionName"`;
const CITY_COLUMNS = `ci.id, ci.name, ci.psgc_code AS "psgcCode", ci.psgc_code AS code, ci.city_class AS "cityClass", ci.zip_code AS "zipCode",
  ci.state_id AS "provinceId", r.id AS "regionId", r.code AS "regionCode", r.name AS "regionName"`;

define({
  method: 'GET', path: '/countries', summary: 'Countries for the address picker', screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, code: 'PH', name: 'Philippines' }] },
  handler: async (_req, res) => ok(res, await many("SELECT id, code, name FROM countries WHERE status = 'active' ORDER BY name")),
});
define({
  method: 'GET', path: '/countries/:countryId/regions', summary: 'Regions of a country (id, code or name), in the PSA order (NCR, CAR, Region I ... BARMM)', screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, code: 'NCR', name: 'National Capital Region (NCR)', designation: 'NCR', psgcCode: '1300000000' }] },
  handler: async (req, res) => ok(res, await many(`SELECT r.id, r.code, r.name, r.designation, r.psgc_code AS "psgcCode" FROM regions r
    JOIN countries c ON c.id = r.country_id WHERE (c.id::text = $1 OR lower(c.code) = lower($1) OR lower(c.name) = lower($1)) AND r.status = 'active'
    ORDER BY r.sort_order, r.name`, [req.params.countryId])),
});
define({
  method: 'GET', path: '/countries/:countryId/provinces', summary: 'Provinces of a country (id, code or name); ?region= (id, code, PSGC code or name) keeps those of one region',
  screen: SCREEN, middleware: [requireAuth], query: { region: 'NCR' },
  response: { success: true, data: [{ id: 1, code: 'NCR', name: 'Metro Manila', psgcCode: null, level: 'Metropolitan area', regionId: 1, regionCode: 'NCR', regionName: 'National Capital Region (NCR)' }] },
  handler: async (req, res) => {
    const region = String(req.query.region || '').trim();
    return ok(res, await many(`SELECT ${PROVINCE_COLUMNS} FROM states s JOIN countries c ON c.id = s.country_id LEFT JOIN regions r ON r.id = s.region_id
      WHERE (c.id::text = $1 OR lower(c.code) = lower($1) OR lower(c.name) = lower($1)) AND s.status = 'active'
        AND ($2 = '' OR r.id::text = $2 OR r.psgc_code = $2 OR lower(r.code) = lower($2) OR lower(r.name) = lower($2))
      ORDER BY s.name`, [req.params.countryId, region]));
  },
});
define({
  method: 'GET', path: '/regions/:regionId/provinces', summary: 'Provinces of a region (id, code, PSGC code or name)', screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 2, code: 'CEB', name: 'Cebu', psgcCode: '0702200000', level: 'Province', regionId: 7, regionCode: 'VII', regionName: 'Region VII (Central Visayas)' }] },
  handler: async (req, res) => ok(res, await many(`SELECT ${PROVINCE_COLUMNS} FROM states s JOIN regions r ON r.id = s.region_id
    WHERE ${parentMatch('r')} AND s.status = 'active' ORDER BY s.name`, [req.params.regionId])),
});
define({
  method: 'GET', path: '/provinces/:provinceId/cities', summary: 'Cities and municipalities of a province (id, code, PSGC code or name), with class, ZIP code and region',
  screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, name: 'Makati City', psgcCode: '1380300000', code: '1380300000', cityClass: 'Highly Urbanized City', zipCode: '1200', provinceId: 1, regionId: 1, regionCode: 'NCR', regionName: 'National Capital Region (NCR)' }] },
  handler: async (req, res) => ok(res, await many(`SELECT ${CITY_COLUMNS} FROM cities ci JOIN states s ON s.id = ci.state_id
    LEFT JOIN regions r ON r.id = COALESCE(ci.region_id, s.region_id)
    WHERE ${parentMatch('s')} AND ci.status = 'active' ORDER BY ci.name`, [req.params.provinceId])),
});
/** One city / municipality for an id, PSGC code or name (a name shared by several, e.g. San Jose, names the first active one). */
const ONE_CITY = `SELECT ci.id FROM cities ci WHERE ${parentMatch('ci', { code: false })} ORDER BY (ci.id::text = $1 OR ci.psgc_code = $1) DESC, (ci.status = 'active') DESC, ci.id LIMIT 1`;
const barangays = {
  screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, name: 'Bel-Air', psgcCode: '1380300003', postalCode: '1209' }] },
  handler: async (req, res) => ok(res, await many(`SELECT d.id, d.name, d.psgc_code AS "psgcCode", d.postal_code AS "postalCode" FROM districts d
    WHERE d.city_id = (${ONE_CITY}) AND d.status = 'active' ORDER BY d.name`, [req.params.cityId])),
};
define({ method: 'GET', path: '/cities/:cityId/barangays', summary: 'Barangays of a city / municipality (id, PSGC code or name); empty when the barangay list is not loaded (free text then)', ...barangays });
define({ method: 'GET', path: '/cities/:cityId/districts', summary: 'Barangays of a city / municipality (earlier name of /cities/:cityId/barangays)', ...barangays });
define({
  method: 'GET', path: '/cities/:cityId/postal-codes', summary: 'ZIP codes of a city / municipality (id, PSGC code or name): its main ZIP code first, then the PhilPost list',
  screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ postalCode: '1200', place: 'Makati City', main: true }, { postalCode: '1209', place: 'Bel-air', main: false }] },
  handler: async (req, res) => {
    const city = (await many(`SELECT ci.id, ci.name, ci.zip_code, s.name AS province FROM cities ci JOIN states s ON s.id = ci.state_id
      WHERE ci.id = (${ONE_CITY})`, [req.params.cityId]))[0];
    if (!city) return ok(res, []);
    const list = await many(`SELECT DISTINCT code AS "postalCode", district AS place FROM postal_codes
      WHERE upper(country_code) = 'PH' AND lower(city) = lower($1) AND lower(province) = lower($2) ORDER BY code, district`, [city.name, city.province]);
    const main = city.zip_code ? [{ postalCode: city.zip_code, place: city.name, main: true }] : [];
    return ok(res, [...main, ...list.filter((z) => z.postalCode !== city.zip_code || z.place.toLowerCase() !== city.name.toLowerCase()).map((z) => ({ ...z, main: false }))]);
  },
});
define({
  method: 'GET', path: '/postal-code', summary: 'ZIP / postal code look-up: region, province, city and place for a country + code', screen: SCREEN, middleware: [requireAuth],
  query: { countryCode: 'PH', code: '1209' },
  response: { success: true, data: [{ region: 'National Capital Region (NCR)', province: 'Metro Manila', city: 'Makati City', district: 'Bel-air', postalCode: '1209' }] },
  handler: async (req, res) => {
    const country = String(req.query.countryCode || '').trim();
    const code = String(req.query.code || '').trim();
    if (!country || !code) return ok(res, []);
    return ok(res, await many(`SELECT (SELECT r.name FROM states s JOIN regions r ON r.id = s.region_id
        WHERE lower(s.name) = lower(p.province) AND s.status = 'active' ORDER BY s.id LIMIT 1) AS region,
      p.province, p.city, p.district, p.code AS "postalCode" FROM postal_codes p
      WHERE (upper(p.country_code) = upper($1) OR p.country_code = (SELECT code FROM countries WHERE lower(name) = lower($1) LIMIT 1)) AND p.code = $2
      ORDER BY p.district`, [country, code]));
  },
});

export default router;
export const mount = '/addresses';
