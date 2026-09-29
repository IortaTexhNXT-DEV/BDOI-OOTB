/**
 * The letterhead printed on every document and report: the primary active company of the Company master
 * (master_records type "company", IsPrimary = true), else the first active company, else general.company_name.
 * When the customer changes their company details in the master, every print follows.
 *
 * The logo is read from the uploads storage (a logo uploaded through the master form: .../api/s3/object/<key>), or from
 * a file in backend/assets with the same name as the logo path ("/bdoi/iorta-technxt.png"), or, when the company has
 * no logo, from the documents.default_logo_path setting (a path relative to the backend folder).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { one } from '../db/pool.js';
import { getSetting } from './settings.js';
import { resolveKey } from '../modules/uploads/storage.js';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ASSETS_DIR = path.join(BACKEND_DIR, 'assets');
const TTL_MS = 30000;
let cache = null;

/** Forget the cached letterhead (after a Company master change). */
export const clearLetterheadCache = () => { cache = null; };

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const imageType = (buf) => (buf?.[0] === 0x89 && buf[1] === 0x50 ? 'png' : buf?.[0] === 0xff && buf[1] === 0xd8 ? 'jpeg' : null);

function readImage(file) {
  try {
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
    const buffer = fs.readFileSync(file);
    const type = imageType(buffer);
    return type ? { buffer, type } : null;
  } catch {
    return null;
  }
}

/** Resolve a logo reference (uploaded object URL / storage key / front-end path / configured path) to image bytes. */
export async function resolveLogo(ref) {
  const s = str(ref);
  if (s) {
    const obj = /\/api\/s3\/object\/([^?#]+)/.exec(s);
    if (obj) {
      try { const img = readImage(resolveKey(decodeURIComponent(obj[1]))); if (img) return img; } catch { /* invalid key */ }
    }
    if (!/^[a-z]+:/i.test(s) && !s.startsWith('/')) {
      try { const img = readImage(resolveKey(s)); if (img) return img; } catch { /* not a storage key */ }
    }
    // A front-end asset path such as /bdoi/iorta-technxt.png: the backend ships the same file in assets/
    const base = path.basename(s.split(/[?#]/)[0]);
    const img = base && readImage(path.join(ASSETS_DIR, base));
    if (img) return img;
    return null;
  }
  const configured = str(await getSetting('documents.default_logo_path', 'assets/iorta-technxt.png'));
  if (!configured) return null;
  return readImage(path.isAbsolute(configured) ? configured : path.join(BACKEND_DIR, configured));
}

/** Address lines of a Company master record: the address lines, then "City, State Postal code, Country". */
export function companyAddressLines(d) {
  const cityLine = [str(d.City), [str(d.State), str(d.PinCode)].filter(Boolean).join(' '), str(d.Country)].filter(Boolean).join(', ');
  return [str(d.AddressLine1), str(d.AddressLine2), str(d.AddressLine3), cityLine].filter(Boolean);
}

/** The primary active company record (master_records row) or the first active one; null when there is none. */
export async function primaryCompany() {
  return one(`SELECT id, code, name, data FROM master_records WHERE type_code = 'company' AND status = 'active'
    ORDER BY (lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1')) DESC, id LIMIT 1`);
}

/**
 * { name, addressLines[], tin, licence, phone, email, website, logo: { buffer, type } | null, code }.
 * Cached for a few seconds; `fresh` skips the cache.
 */
export async function getLetterhead({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await primaryCompany().catch(() => null);
  let value;
  if (row) {
    const d = row.data || {};
    value = {
      code: row.code, name: str(d.CompanyName) || str(row.name), addressLines: companyAddressLines(d), tin: str(d.TIN), licence: str(d.LicenseNumber),
      phone: str(d.PhoneNumber), email: str(d.EmailID), website: str(d.Websitelink), logo: await resolveLogo(d.Logo),
    };
  } else {
    value = { code: null, name: str(await getSetting('general.company_name')), addressLines: [], tin: '', licence: '', phone: '', email: '', website: '', logo: await resolveLogo(null) };
  }
  cache = { at: Date.now(), value };
  return value;
}

/** The company name printed on documents, e-mails and reports (the letterhead company). */
export async function companyName() {
  return (await getLetterhead()).name || str(await getSetting('general.company_name'));
}
