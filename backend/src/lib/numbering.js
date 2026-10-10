/**
 * Document numbers from the Document Numbering master (document_numbering, Master > Document Numbering).
 * Every module takes its numbers through nextDocumentNumber(); prefix, pattern, width and reset rule are configuration.
 */
import { query } from '../db/pool.js';
import { HttpError, badRequest } from './errors.js';
import { getSetting } from './settings.js';

const IDENT = /^[a-z_][a-z0-9_]*$/;
const MAX_ATTEMPTS = 20;
/** Segment tokens a pattern may carry besides {BRANCH} and {LOB}; their values come from numberingContext(). */
export const SEGMENT_KEYS = ['OFFICE', 'PRODUCT', 'SUBLINE', 'BUSINESS', 'PARENT'];

/**
 * Next number of a series, e.g. nextDocumentNumber('policy', { db }) -> POL-2026-00001.
 * - db: the caller's transaction client (the counter is then rolled back with the transaction); the pool otherwise.
 * - branch / lob: values of the {BRANCH} / {LOB} pattern tokens (optional).
 * - segments: values of the {OFFICE} {PRODUCT} {SUBLINE} {BUSINESS} tokens (numberingContext()); parent: the number of
 *   the parent document for {PARENT} and the per_document reset rule.
 * - date: business date the number is issued for (default today in general.timezone).
 * - unique: { table, column } of a unique target column; a number already present there is skipped
 *   (numbers entered by hand or imported can collide with the series).
 */
export async function nextDocumentNumber(code, { db = null, branch = null, lob = null, date = null, unique = null, segments = null, parent = null } = {}) {
  const run = db || { query };
  if (unique && (!IDENT.test(unique.table) || !IDENT.test(unique.column))) throw new Error(`Invalid unique target ${unique.table}.${unique.column}`);
  const seg = { ...(segments || {}), ...(parent ? { PARENT: String(parent) } : {}) };
  const segJson = Object.keys(seg).length ? JSON.stringify(seg) : null;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    let n;
    try {
      n = (await run.query('SELECT next_document_number($1, $2, $3, $4, $5::jsonb) AS n', [code, branch || null, lob || null, date || null, segJson])).rows[0].n;
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

/** Does the series exist and issue numbers (an inactive series is skipped by callers that have an alternative)? */
export async function seriesActive(code, db = null) {
  const r = await (db || { query }).query('SELECT active FROM document_numbering WHERE code = $1', [code]);
  return !!r.rows[0]?.active;
}

/** Value of a segment of the Numbering Segments master (Master > Configuration, type numbering-segment); '*' is the fallback key. */
async function segmentValue(db, segment, key) {
  const r = await db.query(`SELECT data ->> 'value' AS v FROM master_records WHERE type_code = 'numbering-segment' AND status = 'active'
      AND data ->> 'segment' = $1 AND (upper(data ->> 'key') = upper($2) OR data ->> 'key' = '*') ORDER BY (data ->> 'key' = '*') LIMIT 1`, [segment, String(key ?? '')]);
  return r.rows[0]?.v ?? null;
}

/**
 * The issuing office and the segment codes a document number is built from: { branch, segments }.
 * - branch: the office code of the user (users.branch_code), else the office of numbering.default_office; its
 *   numbering code (Branch master, Numbering Code) fills {OFFICE}
 * - product: the product code (products.code), else the line of business, through the PRODUCT segment
 * - policyType: the policy type code (policy_types.code) through the SUBLINE segment ('*' when it has no row)
 * - business: 'NEW' or 'RENEWAL' through the BUSINESS segment
 */
export async function numberingContext({ db = null, userId = null, productId = null, productCode = null, lob = null, policyTypeId = null, policyTypeCode = null, renewal = false } = {}) {
  const run = db || { query };
  let branch = null;
  if (userId) branch = (await run.query('SELECT branch_code FROM users WHERE id = $1 OR username = $1 LIMIT 1', [String(userId)])).rows[0]?.branch_code || null;
  if (!branch) branch = String((await getSetting('numbering.default_office', 'HO')) || '').trim() || null;
  const office = branch ? (await run.query("SELECT attrs ->> 'NumberingCode' AS n FROM branches WHERE upper(code) = upper($1)", [branch])).rows[0]?.n || null : null;
  let product = productCode;
  if (!product && productId) product = (await run.query('SELECT code FROM products WHERE id = $1', [productId])).rows[0]?.code || null;
  if (!product) product = lob || null;
  let subline = policyTypeCode;
  if (!subline && policyTypeId) subline = (await run.query('SELECT code FROM policy_types WHERE id = $1', [policyTypeId])).rows[0]?.code || null;
  const segments = {
    OFFICE: office,
    PRODUCT: product ? await segmentValue(run, 'PRODUCT', product) : null,
    SUBLINE: await segmentValue(run, 'SUBLINE', subline || '*'),
    BUSINESS: await segmentValue(run, 'BUSINESS', renewal ? 'RENEWAL' : 'NEW'),
  };
  return { branch, lob: lob || null, segments };
}
