#!/usr/bin/env node
/**
 * Optional load of the Philippine barangays (about 42,000, PSGC of the Philippine Statistics Authority) into the
 * Barangay master (districts table), so the address forms offer a barangay list for every city and municipality.
 * Metro Manila's barangays are part of the reference seed; without this load the other cities take the barangay as
 * free text.
 *
 *   node scripts/load-barangays.js                         # dry run: what would be added, from the shipped PSGC file
 *   node scripts/load-barangays.js --execute               # load
 *   node scripts/load-barangays.js --execute --region=VII,NCR       # only some regions (PSGC region code or 2 digits)
 *   node scripts/load-barangays.js --execute /path/to/barangays.csv # another file (a newer PSGC release)
 *
 * The file is a CSV with the header psgc_code,name,city_psgc (10-digit PSGC codes; zip_code optional), as
 * src/db/reference/psgc/barangays.csv. A barangay is matched on its PSGC code, then on its name within its city /
 * municipality (a barangay added by hand gets the PSGC code); nothing is deleted or renamed. A barangay of a city that
 * is not in the City / Municipality master is reported and skipped. Its ZIP code is taken from the PhilPost list when a
 * ZIP code names the barangay. Everything runs in one transaction. DATABASE_URL selects the database (as for the API).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';
import { PSGC_DIR, psgcVersion, readCsvFile } from './lib/psgc.js';

const REGION_PREFIX = { NCR: '13', CAR: '14', I: '01', II: '02', III: '03', 'IV-A': '04', MIMAROPA: '17', V: '05', VI: '06', NIR: '18', VII: '07',
  VIII: '08', IX: '09', X: '10', XI: '11', XII: '12', XIII: '16', BARMM: '19' };
const CHUNK = 5000;

export function parseArgs(argv) {
  const opts = { execute: false, regions: null, file: path.join(PSGC_DIR, 'barangays.csv') };
  for (const a of argv) {
    if (a === '--execute') opts.execute = true;
    else if (a.startsWith('--region=')) {
      opts.regions = a.slice(9).split(',').map((r) => r.trim().toUpperCase()).filter(Boolean).map((r) => REGION_PREFIX[r] || r.padStart(2, '0').slice(0, 2));
    } else if (!a.startsWith('--')) opts.file = path.resolve(a);
    else throw new Error(`Unknown option ${a}`);
  }
  return opts;
}

/** Load (or count, on a dry run) the barangays of a file. Returns { read, skipped, unknownCities, added, coded, zip }. */
export async function loadBarangays({ file, regions = null, execute = false, log = console.log } = {}) {
  const rows = readCsvFile(file).filter((r) => /^\d{10}$/.test(r.psgc_code || '') && r.name && /^\d{10}$/.test(r.city_psgc || ''))
    .filter((r) => !regions || regions.includes(r.city_psgc.slice(0, 2)));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE load_barangay(psgc text, name text, city text, zip text) ON COMMIT DROP');
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      await client.query('INSERT INTO load_barangay SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])',
        [part.map((r) => r.psgc_code), part.map((r) => r.name), part.map((r) => r.city_psgc), part.map((r) => r.zip_code || null)]);
    }
    const unknown = (await client.query(`SELECT DISTINCT b.city FROM load_barangay b WHERE NOT EXISTS (SELECT 1 FROM cities ci WHERE ci.psgc_code = b.city) ORDER BY 1`)).rows.map((r) => r.city);
    // a barangay entered before (same name in the same city, no PSGC code yet) gets its PSGC code
    const coded = (await client.query(`UPDATE districts d SET psgc_code = b.psgc, updated_by = 'psgc-load', updated_at = now()
      FROM load_barangay b JOIN cities ci ON ci.psgc_code = b.city
      WHERE d.city_id = ci.id AND d.psgc_code IS NULL AND lower(d.name) = lower(b.name)
        AND NOT EXISTS (SELECT 1 FROM districts x WHERE x.psgc_code = b.psgc)`)).rowCount;
    const added = (await client.query(`INSERT INTO districts(city_id, name, psgc_code, postal_code, created_by)
      SELECT ci.id, b.name, b.psgc, b.zip, 'psgc-load' FROM load_barangay b JOIN cities ci ON ci.psgc_code = b.city
      WHERE NOT EXISTS (SELECT 1 FROM districts d WHERE d.psgc_code = b.psgc OR (d.city_id = ci.id AND lower(d.name) = lower(b.name)))`)).rowCount;
    // ZIP code of the PhilPost list that names the barangay (place = barangay name, same city and province)
    const zip = (await client.query(`UPDATE districts d SET postal_code = p.code
      FROM load_barangay b JOIN cities ci ON ci.psgc_code = b.city JOIN states s ON s.id = ci.state_id
      JOIN postal_codes p ON upper(p.country_code) = 'PH' AND lower(p.city) = lower(ci.name) AND lower(p.province) = lower(s.name)
      WHERE d.psgc_code = b.psgc AND d.postal_code IS NULL AND ph_place_key(p.district) = ph_place_key(b.name)`)).rowCount;
    await client.query(execute ? 'COMMIT' : 'ROLLBACK');
    const out = { read: rows.length, skipped: rows.filter((r) => unknown.includes(r.city_psgc)).length, unknownCities: unknown, added, coded, zip };
    log(`${execute ? 'Loaded' : 'Dry run (nothing saved; add --execute to load)'}: ${out.read} barangays read from ${file}`);
    log(`  added ${added}, PSGC code given to ${coded} barangays entered before, ZIP code set on ${zip}`);
    if (unknown.length) log(`  skipped ${out.skipped} barangays of ${unknown.length} cities / municipalities not in the master: ${unknown.slice(0, 20).join(', ')}${unknown.length > 20 ? ' ...' : ''}`);
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`PSGC release of the shipped files: ${psgcVersion()}`);
  loadBarangays(opts)
    .then(() => pool.end())
    .catch(async (e) => {
      console.error(e.message);
      await pool.end();
      process.exit(1);
    });
}
