/**
 * Environment comparison (POST /data-load/comparisons, npm run compare:environments): the configuration workbook exported
 * from another environment ("Current data") compared with this environment, or two exports compared with each other.
 * Comparing never loads anything and writes no business data: this environment is only read (the same export as the
 * "Current data" download) and the result is kept in data_load_comparisons. The engine is compare.js.
 */
import { many, one } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { today } from '../../lib/dates.js';
import { kitSheets, goLiveState } from './service.js';
import { STATUSES, VERDICT_TEXT, catalogueOf, compareSides, comparisonWorkbook, environmentRules, readSheets } from './compare.js';

const KIT = 'configuration';
const environmentName = () => process.env.APP_ENVIRONMENT || '';

/** Labels of the two sides: { file, here } (short, for column headers and the screen). */
export function sideLabels(c) {
  if (c.mode === 'files') return { file: 'File A', here: 'File B' };
  return { file: 'File', here: c.environment ? `This environment (${c.environment})` : 'This environment' };
}

/** This environment as a compared side: the current data of every sheet (the "Current data" export). */
async function environmentSide(sheets, user) {
  const { cutoverDate } = await goLiveState();
  const ctx = { cutover: cutoverDate, user };
  const out = {};
  for (const s of sheets) if (s.exportRows) out[s.key] = { columns: null, rows: (await s.exportRows(ctx)).map((values) => ({ rowNumber: null, values })) };
  return out;
}

const toComparison = (c) => c && ({
  id: Number(c.id), kit: c.kit, mode: c.mode, fileName: c.file_name, fileBName: c.file_b_name, environment: c.environment, options: c.options || {},
  verdict: c.verdict, verdictText: VERDICT_TEXT[c.verdict], totals: c.totals, sheets: c.sheets, labels: sideLabels(c),
  createdBy: c.created_by_name || c.created_by, createdAt: c.created_at,
});
const SELECT = `SELECT c.id, c.kit, c.mode, c.file_name, c.file_b_name, c.environment, c.options, c.verdict, c.totals, c.sheets, c.created_by, c.created_at,
  u.display_name AS created_by_name FROM data_load_comparisons c LEFT JOIN users u ON u.id = c.created_by`;

/**
 * Compare an uploaded export with this environment (no fileB) or with a second export (fileB: this environment is not
 * read). options: { includeNumbering }. Returns the stored comparison (summary).
 */
export async function createComparison({ file, fileB = null, options = {}, user }) {
  if (!file?.buffer?.length) throw badRequest('Upload the configuration workbook (.xlsx) exported from the other environment in the "file" field');
  const opts = { includeNumbering: options.includeNumbering === true };
  const sheets = await kitSheets(KIT);
  const catalogue = catalogueOf(sheets);
  const mode = fileB?.buffer?.length ? 'files' : 'environment';
  const a = readSheets(file.buffer, catalogue, { label: mode === 'files' ? 'File A' : 'The workbook' });
  const b = mode === 'files' ? readSheets(fileB.buffer, catalogue, { label: 'File B' }) : await environmentSide(sheets, user);
  const result = compareSides({ catalogue, file: a, here: b, options: opts });
  const row = await one(`INSERT INTO data_load_comparisons(kit, mode, file_name, file_b_name, environment, options, verdict, totals, sheets, rows, environment_specific, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [KIT, mode, file.originalname || null, mode === 'files' ? fileB.originalname || null : null,
    mode === 'environment' ? environmentName() || null : null, JSON.stringify(opts), result.verdict, JSON.stringify(result.totals), JSON.stringify(result.sheets),
    JSON.stringify(result.rows), JSON.stringify(result.environmentSpecific), user.id]);
  return getComparison(row.id);
}

async function stored(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Comparison not found');
  const c = await one(`${SELECT} WHERE c.id = $1`, [Number(id)]);
  if (!c) throw notFound('Comparison not found');
  return c;
}

/** One comparison: summary per sheet, environment-specific values and rules (no rows). */
export async function getComparison(id) {
  const c = await stored(id);
  const env = (await one('SELECT environment_specific FROM data_load_comparisons WHERE id = $1', [c.id])).environment_specific;
  return { ...toComparison(c), environmentSpecific: env, rules: environmentRules(c.options || {}) };
}

/**
 * Rows of a comparison for the drill-down: filters sheet, status (identical, different, only-in-file, only-here; a
 * comma list; default every status but identical), search (key or a value), paging.
 */
export async function comparisonRows(id, { sheet = null, status = null, search = null } = {}, pg = { limit: 50, offset: 0 }) {
  const c = await stored(id);
  const statuses = String(status || '').split(',').map((s) => s.trim()).filter((s) => STATUSES.includes(s));
  const wanted = statuses.length ? statuses : STATUSES.filter((s) => s !== 'identical');
  const q = String(search || '').trim().toLowerCase();
  const rows = await many(`SELECT r FROM data_load_comparisons c, jsonb_array_elements(c.rows) WITH ORDINALITY AS x(r, n)
    WHERE c.id = $1 AND ($2::text IS NULL OR r->>'sheet' = $2) AND r->>'status' = ANY($3) AND ($4::text = '' OR lower(r::text) LIKE '%' || $4 || '%')
    ORDER BY x.n`, [c.id, sheet || null, wanted, q]);
  return { total: rows.length, rows: rows.slice(pg.offset, pg.offset + pg.limit).map((r) => r.r) };
}

export async function listComparisons(pg = { limit: 20, offset: 0 }) {
  const total = (await one('SELECT count(*)::int AS n FROM data_load_comparisons')).n;
  const rows = await many(`${SELECT} ORDER BY c.created_at DESC, c.id DESC LIMIT $1 OFFSET $2`, [pg.limit, pg.offset]);
  return { total, rows: rows.map(toComparison) };
}

/** The comparison workbook (Summary, one sheet per object with a Difference column, environment-specific, rules). */
export async function comparisonFile(id) {
  const c = await stored(id);
  const full = await one('SELECT rows, environment_specific FROM data_load_comparisons WHERE id = $1', [c.id]);
  const catalogue = catalogueOf(await kitSheets(c.kit));
  const labels = sideLabels(c);
  const fileLabel = c.mode === 'files' ? 'File A' : 'File';
  const named = { file: c.file_name ? `${fileLabel} (${c.file_name})` : fileLabel, here: c.mode === 'files' ? (c.file_b_name ? `File B (${c.file_b_name})` : 'File B') : labels.here };
  const context = [['Comparison', `${c.id}, ${new Date(c.created_at).toISOString().slice(0, 16).replace('T', ' ')} UTC by ${c.created_by_name || c.created_by || ''}`]];
  const buffer = comparisonWorkbook({
    catalogue, labels: { file: labels.file, here: labels.here }, options: c.options || {},
    context: [['File', named.file], ['Compared with', named.here], ...context],
    result: { verdict: c.verdict, totals: c.totals, sheets: c.sheets, rows: full.rows, environmentSpecific: full.environment_specific },
  });
  return { fileName: `GoLive_Environment_Comparison_${c.id}_${await today()}.xlsx`, buffer };
}
