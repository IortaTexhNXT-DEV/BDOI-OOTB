#!/usr/bin/env node
/**
 * Rotation of the personal identifier key (npm run pii:rotate). Procedure (deploy/REFERENCE.md):
 *   1. generate a new key (openssl rand -hex 32);
 *   2. set PII_ENCRYPTION_KEY to the new key and PII_ENCRYPTION_KEY_PREVIOUS to the old one, restart the API
 *      (both keys are readable, new values are written with the new key);
 *   3. run this script: every identifier still encrypted with the previous key is decrypted and encrypted again with
 *      the new one, and the blind indexes are recomputed; it is safe to run again (dry run without --execute);
 *   4. when it reports 0 values left, remove PII_ENCRYPTION_KEY_PREVIOUS and restart.
 * Keep the old key with the backups taken before the rotation: they can only be read with it.
 */
import { fileURLToPath } from 'node:url';
import { PII_STORAGE } from '../src/lib/pii.js';

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

/** Count (dry run) or re-encrypt the values not encrypted with the current key. Returns [{ table, column, left, rotated }]. */
export async function rotate(db, { execute = false, batch = 500 } = {}) {
  // the key of the connection (its session settings), which is the key the database encrypts with
  const kid = (await db.query("SELECT NULLIF(current_setting('brokerverse.pii_kid', true), '') AS kid")).rows[0].kid;
  if (!kid) throw new Error('The connection has no personal data key (PII_ENCRYPTION_KEY)');
  const out = [];
  for (const s of PII_STORAGE) {
    const exists = (await db.query('SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2', [s.table, s.column])).rows.length;
    if (!exists) continue;
    const stale = s.json
      ? `pii_jsonb_needs(${ident(s.column)}) AND ${ident(s.column)}::text LIKE '%pii:1:%'`
      : `${ident(s.column)} LIKE 'pii:1:%' AND ${ident(s.column)} NOT LIKE $1`;
    const params = s.json ? [] : [`pii:1:${kid}:%`];
    const left = Number((await db.query(`SELECT count(*)::int AS n FROM ${ident(s.table)} WHERE ${stale}`, params)).rows[0].n);
    let rotated = 0;
    if (execute && left) {
      const set = s.json ? `${ident(s.column)} = pii_protect_jsonb(${ident(s.column)}, NULL)` : `${ident(s.column)} = pii_encrypt(pii_decrypt(${ident(s.column)}))`;
      for (;;) {
        const r = await db.query(`UPDATE ${ident(s.table)} SET ${set} WHERE ctid IN (SELECT ctid FROM ${ident(s.table)} WHERE ${stale} LIMIT ${Number(batch)})`, params);
        rotated += r.rowCount;
        if (r.rowCount < batch) break;
      }
    }
    out.push({ table: s.table, column: s.column, left, rotated });
  }
  return out;
}

async function main(argv = process.argv.slice(2)) {
  const execute = argv.includes('--execute');
  const { pool } = await import('../src/db/pool.js');
  try {
    const rows = await rotate(pool, { execute });
    for (const r of rows) console.log(`${`${r.table}.${r.column}`.padEnd(40)} ${execute ? `re-encrypted ${r.rotated}` : `to re-encrypt ${r.left}`}`);
    if (!execute) console.log('Dry run: add --execute to re-encrypt with the current key (PII_ENCRYPTION_KEY).');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
