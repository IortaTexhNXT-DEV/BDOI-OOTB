import { moduleRouter } from '../../lib/registry.js';
import { requireAuth } from '../../lib/auth.js';
import { many } from '../../db/pool.js';
import { ok } from '../../lib/respond.js';

/**
 * Address pickers used by lead creation (Motor / Fire / IAR), claims and endorsements:
 * country -> province (states master) -> city -> district / barangay, plus a postal-code lookup for auto-fill.
 * Reads only reference data, so any signed-in user may call them.
 */
const { router, define } = moduleRouter('Addresses', '/addresses');
const SCREEN = 'Operations > Leads/Prospects > Create Lead (address fields)';

/** Accept a numeric id, a code or a name for the parent record. */
const parentMatch = (alias) => `(${alias}.id::text = $1 OR lower(${alias}.code) = lower($1) OR lower(${alias}.name) = lower($1))`;

define({
  method: 'GET', path: '/countries', summary: 'Countries for the address picker', screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, code: 'PH', name: 'Philippines' }] },
  handler: async (_req, res) => ok(res, await many("SELECT id, code, name FROM countries WHERE status = 'active' ORDER BY name")),
});
define({
  method: 'GET', path: '/countries/:countryId/provinces', summary: 'Provinces / states of a country (id, code or name)', screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, code: 'NCR', name: 'Metro Manila' }] },
  handler: async (req, res) => ok(res, await many(`SELECT s.id, s.code, s.name FROM states s JOIN countries c ON c.id = s.country_id
    WHERE ${parentMatch('c')} AND s.status = 'active' ORDER BY s.name`, [req.params.countryId])),
});
define({
  method: 'GET', path: '/provinces/:provinceId/cities', summary: 'Cities of a province (id, code or name)', screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, name: 'Makati' }] },
  handler: async (req, res) => ok(res, await many(`SELECT ci.id, ci.name FROM cities ci JOIN states s ON s.id = ci.state_id
    WHERE ${parentMatch('s')} AND ci.status = 'active' ORDER BY ci.name`, [req.params.provinceId])),
});
define({
  method: 'GET', path: '/cities/:cityId/districts', summary: 'Districts / barangays of a city (id or name)', screen: SCREEN, middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, name: 'Poblacion', postalCode: '1210' }] },
  handler: async (req, res) => ok(res, await many(`SELECT d.id, d.name, d.postal_code AS "postalCode" FROM districts d JOIN cities ci ON ci.id = d.city_id
    WHERE (ci.id::text = $1 OR lower(ci.name) = lower($1)) AND d.status = 'active' ORDER BY d.name`, [req.params.cityId])),
});
define({
  method: 'GET', path: '/postal-code', summary: 'Postal code lookup: province / city / district for a country + code', screen: SCREEN, middleware: [requireAuth],
  query: { countryCode: 'PH', code: '1226' },
  response: { success: true, data: [{ province: 'Metro Manila', city: 'Makati', district: 'Bel-Air', postalCode: '1209' }] },
  handler: async (req, res) => {
    const country = String(req.query.countryCode || '').trim();
    const code = String(req.query.code || '').trim();
    if (!country || !code) return ok(res, []);
    return ok(res, await many(`SELECT province, city, district, code AS "postalCode" FROM postal_codes
      WHERE (upper(country_code) = upper($1) OR country_code = (SELECT code FROM countries WHERE lower(name) = lower($1) LIMIT 1)) AND code = $2
      ORDER BY district`, [country, code]));
  },
});

export default router;
export const mount = '/addresses';
