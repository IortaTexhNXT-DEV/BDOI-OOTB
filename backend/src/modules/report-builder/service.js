/**
 * Report Builder (Reports > Report Builder): ad hoc reports over the curated datasets (datasets.js) with chosen
 * columns, filters, grouping with totals and sort; saved reports private to their owner or shared with roles; Excel
 * export. And the BI extract: one CSV per dataset written to the storage folder for a data warehouse or BI tool.
 */
import { many, one, query } from '../../db/pool.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { scopeSql } from '../../lib/scope.js';
import { today } from '../../lib/dates.js';
import { csvCell } from '../../lib/csv.js';
import { safeSegment, writeObject, publicUrl } from '../uploads/storage.js';
import { DATASETS, NUMERIC, OPERATORS } from './datasets.js';

const quoteKey = (k) => `"${k.replace(/[^A-Za-z0-9_]/g, '')}"`;

export function datasetOf(key) {
  const d = DATASETS[key];
  if (!d) throw badRequest('Validation failed', [{ path: 'dataset', message: `Unknown dataset ${key}; one of ${Object.keys(DATASETS).join(', ')}` }]);
  return d;
}

/** The user may use the dataset: read:reports and the dataset's own read permission. */
export function assertDataset(user, key) {
  const d = datasetOf(key);
  if (!hasPermission(user, 'read:reports') || !hasPermission(user, d.permission)) throw forbidden(`The ${d.label} dataset needs ${d.permission}`);
  return d;
}

/** A filter as SQL on a column; values go to params. */
function filterSql(col, f, params) {
  const p = (v) => { params.push(v); return `$${params.length}`; };
  const cast = col.type === 'date' ? '::date' : NUMERIC.has(col.type) ? '::numeric' : '';
  const ops = OPERATORS[col.type];
  if (!ops.includes(f.op)) throw badRequest('Validation failed', [{ path: 'filters', message: `${col.label}: operator ${f.op} is not available for a ${col.type} column` }]);
  const e = col.sql;
  switch (f.op) {
    case 'eq': return col.type === 'text' ? `lower(${e}::text) = lower(${p(String(f.value ?? ''))})` : `${e} = ${p(f.value)}${cast}`;
    case 'neq': return col.type === 'text' ? `lower(COALESCE(${e}::text, '')) <> lower(${p(String(f.value ?? ''))})` : `${e} IS DISTINCT FROM ${p(f.value)}${cast}`;
    case 'contains': return `${e}::text ILIKE '%' || ${p(String(f.value ?? ''))} || '%'`;
    case 'starts': return `${e}::text ILIKE ${p(String(f.value ?? ''))} || '%'`;
    case 'in': {
      const list = (Array.isArray(f.value) ? f.value : String(f.value ?? '').split(',')).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
      return `lower(${e}::text) = ANY(${p(list)}::text[])`;
    }
    case 'gt': return `${e} > ${p(f.value)}${cast}`;
    case 'gte': return `${e} >= ${p(f.value)}${cast}`;
    case 'lt': return `${e} < ${p(f.value)}${cast}`;
    case 'lte': return `${e} <= ${p(f.value)}${cast}`;
    case 'between': return `${e} BETWEEN ${p(f.value)}${cast} AND ${p(f.value2)}${cast}`;
    case 'empty': return `(${e} IS NULL OR ${e}::text = '')`;
    case 'notEmpty': return `(${e} IS NOT NULL AND ${e}::text <> '')`;
    default: throw badRequest(`Unknown operator ${f.op}`);
  }
}

/**
 * SQL of a report definition { dataset, columns, filters, groupBy, sort } for a scope. Returns
 * { sql, params, columns } where columns are the output columns. Grouped: the group columns, then every numeric
 * column chosen, summed (a count column counts the rows).
 */
export function buildReportSql(def, scope = null) {
  const d = datasetOf(def.dataset);
  const byKey = new Map(d.columns.map((c) => [c.key, c]));
  const pick = (k, path) => {
    const c = byKey.get(k);
    if (!c) throw badRequest('Validation failed', [{ path, message: `Unknown column ${k} in the ${d.label} dataset` }]);
    return c;
  };
  const chosen = (def.columns?.length ? def.columns : d.columns.slice(0, 8).map((c) => c.key)).map((k) => pick(k, 'columns'));
  const groups = (def.groupBy || []).map((k) => pick(k, 'groupBy'));
  const params = [];
  const where = [d.where || 'TRUE'];
  for (const f of def.filters || []) where.push(filterSql(pick(f.column, 'filters'), f, params));
  if (scope) where.push(scopeSql(scope, d.scope.entity, d.scope.alias, params));
  let columns;
  let select;
  let groupClause = '';
  if (groups.length) {
    const measures = chosen.filter((c) => NUMERIC.has(c.type) && !groups.includes(c));
    columns = [...groups, ...measures];
    select = [...groups.map((c) => `${c.sql} AS ${quoteKey(c.key)}`), ...measures.map((c) => `COALESCE(sum(${c.sql}), 0) AS ${quoteKey(c.key)}`)];
    groupClause = ` GROUP BY ${groups.map((_, i) => i + 1).join(', ')}`;
  } else {
    columns = chosen;
    select = chosen.map((c) => `${c.sql} AS ${quoteKey(c.key)}`);
  }
  const outKeys = new Set(columns.map((c) => c.key));
  const order = (def.sort || []).filter((s) => outKeys.has(s.column)).map((s) => `${quoteKey(s.column)} ${s.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`);
  const sql = `SELECT ${select.join(', ')} FROM ${d.from} WHERE ${where.join(' AND ')}${groupClause} ORDER BY ${order.length ? order.join(', ') : '1'}`;
  return { sql, params, columns: columns.map((c) => ({ key: c.key, label: c.label, type: c.type })) };
}

/** Run a definition: rows (up to the limit), totals of the numeric columns, and the full row count. */
export async function runReport(def, { scope = null, limit = null } = {}) {
  const max = Number(await getSetting('report_builder.max_rows', 50000)) || 50000;
  const { sql, params, columns } = buildReportSql(def, scope);
  const cap = Math.min(limit || max, max);
  const n = params.length;
  const rows = (await query(`${sql} LIMIT $${n + 1}`, [...params, cap])).rows;
  const numeric = columns.filter((c) => NUMERIC.has(c.type));
  const agg = await one(`SELECT count(*)::int AS "__rows"${numeric.map((c) => `, COALESCE(sum(t.${quoteKey(c.key)}), 0) AS ${quoteKey(c.key)}`).join('')} FROM (${sql}) t`, params);
  const totals = Object.fromEntries(numeric.map((c) => [c.key, Number(agg[c.key])]));
  const out = rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, NUMERIC.has(c.type) && r[c.key] !== null ? Number(r[c.key]) : r[c.key]])));
  return { columns, rows: out, totals, total: agg.__rows, truncated: agg.__rows > out.length };
}

// ---------- saved reports ----------

export const savedOut = (r) => r && ({
  id: r.id, name: r.name, description: r.description, dataset: r.dataset, columns: r.columns || [], filters: r.filters || [], groupBy: r.group_by || [], sort: r.sort || [],
  sharedRoles: r.shared_roles || [], ownerUserId: r.owner_user_id, ownerName: r.owner_name ?? null, lastRunAt: r.last_run_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const SAVED_SELECT = 'SELECT r.*, u.display_name AS owner_name FROM report_builder_reports r LEFT JOIN users u ON u.id = r.owner_user_id';

/** Saved reports the user may see: their own, those shared with one of their roles, all for the administrator. */
export async function listSaved(user) {
  const rows = await many(`${SAVED_SELECT} WHERE $1::boolean OR r.owner_user_id = $2 OR r.shared_roles && $3::text[] ORDER BY r.name`, [isAdmin(user), user.id, user.roles || []]);
  return rows.map(savedOut).filter((r) => hasPermission(user, DATASETS[r.dataset]?.permission || 'read:reports'));
}

export async function getSaved(id, user) {
  const r = await one(`${SAVED_SELECT} WHERE r.id = $1`, [String(id)]);
  if (!r) throw notFound('Report not found');
  const visible = isAdmin(user) || r.owner_user_id === user.id || (r.shared_roles || []).some((x) => (user.roles || []).includes(x));
  if (!visible) throw notFound('Report not found');
  return r;
}

const definition = (b) => ({ dataset: b.dataset, columns: b.columns || [], filters: b.filters || [], groupBy: b.groupBy || [], sort: b.sort || [] });

export async function createSaved(b, user) {
  assertDataset(user, b.dataset);
  buildReportSql(definition(b));
  const r = await one(`INSERT INTO report_builder_reports(name, description, dataset, columns, filters, group_by, sort, shared_roles, owner_user_id, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$9) RETURNING id`, [b.name, b.description || null, b.dataset, JSON.stringify(b.columns || []), JSON.stringify(b.filters || []),
    JSON.stringify(b.groupBy || []), JSON.stringify(b.sort || []), await validRoles(b.sharedRoles), user.id]);
  return savedOut(await getSaved(r.id, user));
}

async function validRoles(roles = []) {
  const list = [...new Set((roles || []).map(String))];
  if (!list.length) return [];
  const found = (await many('SELECT code FROM roles WHERE code = ANY($1)', [list])).map((r) => r.code);
  const unknown = list.filter((r) => !found.includes(r));
  if (unknown.length) throw badRequest('Validation failed', [{ path: 'sharedRoles', message: `Unknown role: ${unknown.join(', ')}` }]);
  return list;
}

/** Only the owner (or the administrator) changes or deletes a saved report. */
function assertOwner(r, user) {
  if (!isAdmin(user) && r.owner_user_id !== user.id) throw forbidden('Only the owner of a report can change it; save a copy instead');
}

export async function updateSaved(id, b, user) {
  const before = await getSaved(id, user);
  assertOwner(before, user);
  const def = definition({ ...savedOut(before), ...b });
  assertDataset(user, def.dataset);
  buildReportSql(def);
  await query(`UPDATE report_builder_reports SET name = COALESCE($2, name), description = COALESCE($3, description), dataset = $4, columns = $5, filters = $6, group_by = $7, sort = $8,
      shared_roles = COALESCE($9, shared_roles), updated_by = $10, updated_at = now() WHERE id = $1`,
  [before.id, b.name || null, b.description ?? null, def.dataset, JSON.stringify(def.columns), JSON.stringify(def.filters), JSON.stringify(def.groupBy), JSON.stringify(def.sort),
    b.sharedRoles !== undefined ? await validRoles(b.sharedRoles) : null, user.id]);
  return { before: savedOut(before), after: savedOut(await getSaved(before.id, user)) };
}

export async function deleteSaved(id, user) {
  const r = await getSaved(id, user);
  assertOwner(r, user);
  await query('DELETE FROM report_builder_reports WHERE id = $1', [r.id]);
  return savedOut(r);
}

export const touchRun = (id) => query('UPDATE report_builder_reports SET last_run_at = now() WHERE id = $1', [id]);

// ---------- BI extract ----------

const csvOf = (columns, rows) => [columns.map((c) => csvCell(c.key)).join(','), ...rows.map((r) => columns.map((c) => {
  const v = r[c.key];
  return csvCell(v instanceof Date ? v.toISOString() : v ?? '');
}).join(','))].join('\r\n');

/**
 * Write one CSV per dataset (bi.extract_datasets, every column, the whole book) to <bi.extract_folder>/<date>/<dataset>.csv
 * in the storage area; a run of the same day replaces that day's files. Old runs beyond bi.extract_keep_runs are dropped
 * from the history. Returns the run.
 */
export async function runBiExtract({ trigger = 'schedule', userId = null } = {}) {
  const wanted = (await getSetting('bi.extract_datasets', Object.keys(DATASETS))) || [];
  const folder = safeSegment(await getSetting('bi.extract_folder', 'bi-extract')) || 'bi-extract';
  const date = await today();
  const run = await one('INSERT INTO bi_extract_runs(trigger, folder, created_by) VALUES ($1,$2,$3) RETURNING id', [trigger, `${folder}/${date}`, userId]);
  const files = [];
  try {
    for (const key of wanted) {
      const d = DATASETS[key];
      if (!d) continue;
      const def = { dataset: key, columns: d.columns.map((c) => c.key) };
      const { sql, params, columns } = buildReportSql(def);
      const rows = (await query(sql, params)).rows;
      const content = Buffer.from(`\ufeff${csvOf(columns, rows)}`, 'utf8');
      const storageKey = `${folder}/${date}/${key}.csv`;
      await query('DELETE FROM documents WHERE storage_key = $1', [storageKey]);
      await query(`INSERT INTO documents(storage_key, file_name, content_type, category, entity, entity_id, uploaded_by) VALUES ($1,$2,'text/csv',$3,'bi_extract',$4,$5)`,
        [storageKey, `${key}.csv`, folder, String(run.id), userId]);
      await writeObject(storageKey, content, 'text/csv');
      files.push({ dataset: key, key: storageKey, fileName: `${key}.csv`, rows: rows.length, bytes: content.length, url: publicUrl(storageKey) });
    }
    const total = files.reduce((s, f) => s + f.rows, 0);
    await query("UPDATE bi_extract_runs SET status = 'done', finished_at = now(), files = $2, rows_total = $3 WHERE id = $1", [run.id, JSON.stringify(files), total]);
  } catch (e) {
    await query("UPDATE bi_extract_runs SET status = 'failed', finished_at = now(), files = $2, error = $3 WHERE id = $1", [run.id, JSON.stringify(files), e.message]);
    throw e;
  }
  const keep = Number(await getSetting('bi.extract_keep_runs', 30)) || 30;
  await query('DELETE FROM bi_extract_runs WHERE id NOT IN (SELECT id FROM bi_extract_runs ORDER BY started_at DESC LIMIT $1)', [keep]);
  return biRunOut(await one('SELECT * FROM bi_extract_runs WHERE id = $1', [run.id]));
}

export const biRunOut = (r) => ({ id: Number(r.id), startedAt: r.started_at, finishedAt: r.finished_at, status: r.status, trigger: r.trigger, folder: r.folder,
  files: r.files || [], rowsTotal: r.rows_total, error: r.error });
export const listBiRuns = async () => (await many('SELECT * FROM bi_extract_runs ORDER BY started_at DESC LIMIT 50')).map(biRunOut);

/** Job bi-extract (Master > Schedules, disabled until switched on). */
export async function biExtract() {
  if (!(await one("SELECT to_regclass('bi_extract_runs') IS NOT NULL AS ok")).ok) return { skipped: 'report builder not migrated' };
  const run = await runBiExtract({ trigger: 'schedule' });
  return { folder: run.folder, files: run.files.length, rows: run.rowsTotal };
}
