/** Report engine: normalises screen parameters, builds the parameterised SQL around a base query and runs it. */
import { many, one, query as dbQuery } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { businessTimeZone, isoInZone } from '../../lib/dates.js';
import { badRequest } from '../../lib/errors.js';
import { QUERIES } from './queries.js';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMERIC_TYPES = new Set(['money', 'number', 'integer']);
const q = (k) => {
  if (!IDENT.test(k)) throw new Error(`Invalid column key ${k}`);
  return `"${k}"`;
};

/** Filter SQL per filter key; p is the positional parameter ($n) holding the value. */
const FILTERS = {
  agent: (p) => `(t._agent_id = ${p} OR lower(t._agent_username) = lower(${p}) OR lower(t.agent) = lower(${p}))`,
  insurer: (p) => `(t._insurer_id = ${p} OR lower(t._insurer_code) = lower(${p}) OR lower(t.insurer) = lower(${p}))`,
  branch: (p) => `(lower(t._branch_code) = lower(${p}) OR lower(t.branch) = lower(${p}))`,
  client: (p) => `(t._client_id = ${p} OR lower(t._client_code) = lower(${p}) OR lower(t.client) = lower(${p}))`,
  product: (p) => `(t._product_id = ${p} OR lower(t._product_code) = lower(${p}) OR lower(t.product) = lower(${p}))`,
  status: (p) => `lower(t.status) = lower(${p})`,
  // GL account (exact code or main-account prefix); the ledger reports expose it as _account
  account: (p) => `(t._account = ${p} OR t._account LIKE ${p} || '%')`,
};
/** Accepted parameter names: the screen's formik field names first, then API-style aliases. */
const ALIASES = {
  from: ['FromDate', 'fromDate', 'startDate', 'from', 'dateFrom'],
  to: ['ToDate', 'toDate', 'endDate', 'to', 'dateTo'],
  criteria: ['ReportCriteria', 'reportCriteria', 'criteria'],
  agent: ['Agent', 'agent', 'agentId', 'agentUserId'],
  insurer: ['Company', 'company', 'companyId', 'insurer', 'insurerId', 'insuranceCompanyId'],
  branch: ['Branch', 'branch', 'branchCode'],
  client: ['Client', 'client', 'clientId'],
  product: ['Product', 'product', 'productId'],
  status: ['Status', 'status'],
  account: ['Account', 'account', 'accountCode', 'glCode'],
  period: ['period', 'datePreset'],
};
const pick = (raw, key) => {
  for (const k of ALIASES[key]) {
    let v = raw?.[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) v = v.value;
    if (v !== undefined && v !== null && String(v).trim() !== '') return typeof v === 'string' ? v.trim() : v;
  }
  return null;
};

async function toDate(v, label) {
  if (v === null) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} is not a valid date`);
  // Browsers send Date objects as UTC instants; read them in the business time zone
  return isoInZone(d, await businessTimeZone());
}

/** Relative periods for schedules: yesterday, today, last-7-days, last-30-days, month-to-date, previous-month, year-to-date. */
export function resolvePeriod(period, today) {
  const [y, m, d] = today.split('-').map(Number);
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const t = new Date(Date.UTC(y, m - 1, d));
  const minus = (n) => iso(new Date(t.getTime() - n * 86400000));
  switch (period) {
    case 'today': return [today, today];
    case 'yesterday': return [minus(1), minus(1)];
    case 'last-7-days': return [minus(6), today];
    case 'last-30-days': return [minus(29), today];
    case 'month-to-date': return [iso(new Date(Date.UTC(y, m - 1, 1))), today];
    case 'previous-month': return [iso(new Date(Date.UTC(y, m - 2, 1))), iso(new Date(Date.UTC(y, m - 1, 0)))];
    case 'year-to-date': return [`${y}-01-01`, today];
    default: throw badRequest(`Unknown period ${period}`);
  }
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CRITERIA_ALIASES = { principleinsurance: 'principalinsurer', principalinsurance: 'principalinsurer', principleinsurer: 'principalinsurer' };

/** Turn screen/API parameters into { from, to, criteria, filters } for a query definition. */
export async function normalizeParams(query, raw = {}) {
  const today = isoInZone(new Date(), await businessTimeZone());
  let from = await toDate(pick(raw, 'from'), 'From date');
  let to = await toDate(pick(raw, 'to'), 'To date');
  const period = pick(raw, 'period');
  if (period && !from && !to) [from, to] = resolvePeriod(period, today);
  to = to || today;
  if (!from) {
    const days = Number(await getSetting('reports.default_range_days', 365)) || 365;
    from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  }
  if (from > to) throw badRequest('From date must be on or before To date');
  const keys = Object.keys(query.criteria || {});
  const wanted = pick(raw, 'criteria');
  // "Overall" / "All" is the screens' generic default: it means the report's first (overall) view
  const generic = wanted && ['overall', 'all'].includes(norm(wanted));
  // Older spellings stay accepted (saved schedules, API clients): "Principle Insurance" = "Principal Insurer"
  const want = CRITERIA_ALIASES[norm(wanted)] || norm(wanted);
  const criteria = wanted ? keys.find((k) => norm(k) === want) || (generic ? keys[0] : undefined) : keys[0];
  if (wanted && !criteria) throw badRequest(`Report criteria must be one of: ${keys.join(', ')}`);
  const filters = {};
  const ignored = [];
  for (const f of Object.keys(FILTERS)) {
    const v = pick(raw, f);
    if (v === null) continue;
    if (!query.filters?.includes(f)) { ignored.push(f); continue; }
    filters[f] = String(v);
  }
  // The screens list the broker itself under "Company"; that means "all insurers", not a filter
  if (filters.insurer && norm(filters.insurer) === norm(((await getSetting('general.company_name')) ?? ''))) delete filters.insurer;
  return { from, to, criteria: criteria || null, filters, ignoredFilters: ignored };
}

async function extraValues(query) {
  const out = [];
  for (const e of query.extras || []) out.push((await getSetting(e.key, e.fallback)) ?? e.fallback);
  return out;
}

/** Build the filtered (and, for aggregate reports, grouped) SQL. Returns { sql, values, order, groupBy, dims }. */
export async function buildSql(query, np) {
  const values = [np.from, np.to, ...(await extraValues(query))];
  const conds = ['$1::date IS NOT NULL', '$2::date IS NOT NULL', ...(query.extras || []).map((e, i) => `($${i + 3}::${e.type} IS NULL OR TRUE)`)];
  for (const [k, v] of Object.entries(np.filters)) {
    values.push(v);
    conds.push(FILTERS[k](`$${values.length}`));
  }
  const crit = (np.criteria && query.criteria?.[np.criteria]) || {};
  if (crit.where) conds.push(crit.where);
  const where = conds.join(' AND ');
  let sql = `SELECT * FROM (${query.sql}) t WHERE ${where}`;
  let dims = null;
  if (query.aggregate) {
    dims = crit.dims || Object.values(query.criteria)[0].dims;
    const measures = Object.entries(query.aggregate).map(([k, e]) => `${e} AS ${q(k)}`);
    sql = `SELECT ${dims.map((d) => `t.${q(d)}`).join(', ')}, ${measures.join(', ')} FROM (${query.sql}) t WHERE ${where} GROUP BY ${dims.map((_, i) => i + 1).join(', ')}`;
  }
  let order = typeof query.orderBy === 'function' ? query.orderBy(dims || []) : query.orderBy;
  if (!order) order = dims ? dims.map((d) => `f.${q(d)}`).join(', ') : '1';
  return { sql, values, order, groupBy: crit.groupBy || null, dims };
}

const stripInternal = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')));

/**
 * Execute a report definition. opts: { page, perPage } for on-screen paging, or { all: true, maxRows } for files.
 * Returns { columns, rows, totals, summary, groups, total, params }.
 */
export async function execute(def, rawParams, opts = {}) {
  const query = QUERIES[def.query_name];
  if (!query) throw badRequest(`Report ${def.code} has no query named ${def.query_name}`);
  const np = await normalizeParams(query, rawParams);
  const { sql, values, order, groupBy } = await buildSql(query, np);
  const n = values.length;
  const limit = opts.all ? Number(opts.maxRows) || 50000 : opts.perPage;
  const offset = opts.all ? 0 : (opts.page - 1) * opts.perPage;
  const res = await dbQuery(`SELECT * FROM (${sql}) f ORDER BY ${order} LIMIT $${n + 1} OFFSET $${n + 2}`, [...values, limit, offset]);
  const present = new Set(res.fields.map((f) => f.name));
  let columns = (def.default_columns || []).filter((c) => present.has(c.key));
  if (!columns.length) columns = res.fields.filter((f) => !f.name.startsWith('_')).map((f) => ({ key: f.name, label: f.name, type: 'text' }));
  const sumCols = columns.filter((c) => NUMERIC_TYPES.has(c.type) && c.total !== false);
  const summaryExprs = Object.entries(query.summary || {}).map(([k, e]) => `${e} AS ${q(k)}`);
  const agg = await one(`SELECT count(*)::int AS "__rows"${sumCols.map((c) => `, COALESCE(sum(f.${q(c.key)}), 0) AS ${q(c.key)}`).join('')}${summaryExprs.map((e) => `, ${e}`).join('')} FROM (${sql}) f`, values);
  const totals = Object.fromEntries(sumCols.map((c) => [c.key, agg[c.key]]));
  const summary = Object.fromEntries(Object.keys(query.summary || {}).map((k) => [k, agg[k]]));
  let groups = null;
  if (groupBy && present.has(groupBy)) {
    groups = await many(`SELECT f.${q(groupBy)} AS "group", count(*)::int AS "count"${sumCols.map((c) => `, COALESCE(sum(f.${q(c.key)}), 0) AS ${q(c.key)}`).join('')} FROM (${sql}) f GROUP BY 1 ORDER BY 1 NULLS LAST`, values);
    groups = groups.map((g) => ({ ...g, group: g.group ?? '(none)' }));
  }
  return { columns, rows: res.rows.map(stripInternal), totals, summary, groups, groupBy, total: agg.__rows, params: np };
}
