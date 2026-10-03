/**
 * Authorised signatories (Master > Insurance Management > Signatories) for the order summary and the prints.
 * The default is the signatory named in documents.default_signatory, else the first active one.
 */
import { many, one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { resolveLogo } from '../../lib/letterhead.js';

const clean = (v) => String(v ?? '').trim();

/** Active signatories { id, name, designation, signatureKey, isDefault }, the default one first. */
export async function activeSignatories() {
  const rows = await many(`SELECT id, name, designation, signature_key AS "signatureKey" FROM signatories WHERE status = 'active' ORDER BY name`);
  const wanted = clean(await getSetting('documents.default_signatory', '')).toLowerCase();
  const def = rows.find((r) => wanted && r.name.toLowerCase() === wanted) || rows[0];
  return rows.map((r) => ({ ...r, isDefault: r === def })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

/**
 * The signatory to print: the one chosen on the document (by name or id, even if since deactivated), else the default.
 * Returns { name, designation, image } (image: { buffer, type } of the uploaded signature, or null), or null.
 */
export async function signatoryFor(chosen) {
  const ref = clean(chosen);
  let row = ref ? await one(`SELECT name, designation, signature_key FROM signatories WHERE status <> 'deleted' AND (lower(name) = lower($1) OR id::text = $1)
    ORDER BY (status = 'active') DESC, id LIMIT 1`, [ref]).catch(() => null) : null;
  if (!row) {
    const def = (await activeSignatories())[0];
    row = def ? { name: def.name, designation: def.designation, signature_key: def.signatureKey } : null;
  }
  if (!row && ref) return { name: ref, designation: null, image: null };
  if (!row) return null;
  const key = clean(row.signature_key);
  return { name: row.name, designation: row.designation || null, image: key ? await resolveLogo(key).catch(() => null) : null };
}

/** Signature block of a document for a signatory (signatoryFor) under a label ("Authorized signature"). */
export const signatureBlock = (label, s) => ({ label, name: s?.name || null, title: s?.designation || null, image: s?.image || null });
