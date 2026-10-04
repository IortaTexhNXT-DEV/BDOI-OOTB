/**
 * Document numbers from the Document Numbering master (document_numbering, Master > Document Numbering).
 * Every module takes its numbers through nextDocumentNumber(); prefix, pattern, width and reset rule are configuration.
 */
import { query } from '../db/pool.js';
import { HttpError, badRequest } from './errors.js';

const IDENT = /^[a-z_][a-z0-9_]*$/;
const MAX_ATTEMPTS = 20;

/**
 * Next number of a series, e.g. nextDocumentNumber('policy', { db }) -> POL-2026-00001.
 * - db: the caller's transaction client (the counter is then rolled back with the transaction); the pool otherwise.
 * - branch / lob: values of the {BRANCH} / {LOB} pattern tokens (optional).
 * - date: business date the number is issued for (default today in general.timezone).
 * - unique: { table, column } of a unique target column; a number already present there is skipped
 *   (numbers entered by hand or imported can collide with the series).
 */
export async function nextDocumentNumber(code, { db = null, branch = null, lob = null, date = null, unique = null } = {}) {
  const run = db || { query };
  if (unique && (!IDENT.test(unique.table) || !IDENT.test(unique.column))) throw new Error(`Invalid unique target ${unique.table}.${unique.column}`);
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    let n;
    try {
      n = (await run.query('SELECT next_document_number($1, $2, $3, $4) AS n', [code, branch || null, lob || null, date || null])).rows[0].n;
    } catch (e) {
      if (e.code === '22023') throw badRequest(e.message);
      throw e;
    }
    if (!unique) return n;
    const taken = (await run.query(`SELECT 1 FROM ${unique.table} WHERE ${unique.column} = $1 LIMIT 1`, [n])).rowCount;
    if (!taken) return n;
  }
  throw new HttpError(500, `Could not allocate a ${code} number`);
}
