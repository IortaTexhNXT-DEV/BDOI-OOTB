/**
 * Philippine address format: House / Unit No., Street, Barangay, City / Municipality, Province, Region, ZIP code.
 * The region is part of the address but follows from the city or the province (Province master, PSGC): when an address
 * names a province (or city) and no region, the region is filled from the masters.
 */
import { query } from '../db/pool.js';

/**
 * Region name of a city / municipality in a province (the city's own region first: Isabela City lies in Basilan but
 * in Region IX), else of the province; null when the province is not in the Province master.
 */
export async function regionOf({ province = null, city = null } = {}, db = null) {
  if (!province && !city) return null;
  const run = db || { query };
  const r = (await run.query(`SELECT r.name FROM states s
      LEFT JOIN cities ci ON ci.state_id = s.id AND $2::text IS NOT NULL AND ph_place_key(ci.name) = ph_place_key($2) AND ci.status <> 'deleted'
      JOIN regions r ON r.id = COALESCE(ci.region_id, s.region_id)
    WHERE ($1::text IS NULL OR lower(s.name) = lower($1) OR lower(s.code) = lower($1)) AND s.status <> 'deleted'
      AND ($1::text IS NOT NULL OR ci.id IS NOT NULL)
    ORDER BY (ci.id IS NOT NULL) DESC, s.id LIMIT 1`, [province ? String(province).trim() : null, city ? String(city).trim() : null])).rows[0];
  return r ? r.name : null;
}

/**
 * Fill the region column of a row being saved from its province / city columns when the caller gave none
 * (columns: names of the province, city and region columns of that table).
 */
export async function fillRegion(cols, { province = 'state', city = 'city', region = 'region' } = {}, db = null) {
  if (cols[region] || (!cols[province] && !cols[city])) return cols;
  if (cols[region] === undefined && cols[province] === undefined) return cols;
  const name = await regionOf({ province: cols[province] || null, city: cols[city] || null }, db);
  if (name) cols[region] = name;
  return cols;
}
