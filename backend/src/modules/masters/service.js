/**
 * Metadata-driven master service. A master type (master_types) declares the fields a screen edits, under the
 * front end's own field names. Records live either in the generic store (master_records.data) or in an existing
 * reference table (countries, currencies, banks, ...) where declared fields map to columns and the rest go to attrs.
 */
import { many, one, query } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { asBool, isoDate, params, parseStatus, statusLabel } from './helpers.js';
import { assertSinglePrimary, afterCompanyChange } from './company.js';
import { checkBaseCurrency, setBaseCurrency, withoutBaseFlag } from './currency.js';
import { nextDocumentNumber } from '../../lib/numbering.js';

const IDENT = /^[a-z_][a-z0-9_]*$/;
/** Reference tables a master type may be stored in (identifiers are never taken from user input). */
export const TABLES = new Set(['countries', 'states', 'cities', 'currencies', 'banks', 'insurance_companies', 'products',
  'policy_types', 'vehicle_brands', 'vehicle_models', 'vehicle_variants', 'coverages', 'signatories', 'branches', 'write_off_reasons']);
const SYSTEM_KEYS = new Set(['id', 'status', 'isActive', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const q = (s) => {
  if (!IDENT.test(s)) throw new Error(`Invalid identifier: ${s}`);
  return `"${s}"`;
};

// ---------- master types ----------

export async function getType(code) {
  const t = await one('SELECT * FROM master_types WHERE code = $1 AND status <> \'deleted\'', [code]);
  if (!t) throw notFound(`Unknown master type: ${code}`);
  if (t.storage === 'table' && !TABLES.has(t.table_name)) throw badRequest(`Master type ${code} has an invalid table`);
  return t;
}

const publicField = ({ column: _column, ref, ...f }) => ({ ...f, ...(ref ? { optionsFrom: f.optionsFrom || ref.type } : {}) });

export const typeOut = (t, count) => ({
  code: t.code, label: t.label, category: t.category, screen: t.screen, storage: t.storage,
  codeField: t.code_field, labelField: t.label_field, fields: (t.fields || []).map(publicField),
  uniqueKeys: t.unique_keys, allowExtra: t.allow_extra, sortOrder: t.sort_order, isSystem: t.is_system,
  status: statusLabel(t.status), count, updatedAt: t.updated_at,
});

async function countRecords(t) {
  if (t.storage === 'table') return (await one(`SELECT count(*)::int AS n FROM ${q(t.table_name)} WHERE status <> 'deleted'`)).n;
  return (await one('SELECT count(*)::int AS n FROM master_records WHERE type_code = $1 AND status <> \'deleted\'', [t.code])).n;
}

export async function listTypes({ category } = {}) {
  const rows = await many(`SELECT * FROM master_types WHERE status <> 'deleted' AND ($1::text IS NULL OR category = $1)
                           ORDER BY category, sort_order, label`, [category || null]);
  const out = [];
  for (const t of rows) out.push(typeOut(t, await countRecords(t)));
  return out;
}

const FIELD_TYPES = ['string', 'text', 'number', 'integer', 'boolean', 'date', 'email', 'select', 'multiselect', 'json', 'color', 'url', 'audit-user', 'audit-date'];

/** Validate an administrator-supplied field list (for generic types only; column/ref mappings are never accepted). */
export function cleanFieldDefs(fields) {
  if (!Array.isArray(fields) || !fields.length) throw badRequest('fields must be a non-empty array');
  const seen = new Set();
  return fields.map((f) => {
    if (!f || typeof f.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(f.name)) throw badRequest(`Invalid field name: ${f?.name}`);
    if (seen.has(f.name)) throw badRequest(`Duplicate field: ${f.name}`);
    seen.add(f.name);
    const type = f.type || 'string';
    if (!FIELD_TYPES.includes(type)) throw badRequest(`Invalid type for ${f.name}: ${type}`);
    const out = { name: f.name, label: String(f.label || f.name), type, required: !!f.required };
    if (Array.isArray(f.options)) out.options = f.options.map(String);
    if (f.optionsFrom) out.optionsFrom = String(f.optionsFrom);
    if (f.maxLength) out.maxLength = Number(f.maxLength);
    if (f.default !== undefined) out.default = f.default;
    if (f.numbering && /^[a-z][a-z0-9_]*$/.test(String(f.numbering))) out.numbering = String(f.numbering);
    if (f.notBefore && typeof f.notBefore === 'string') out.notBefore = f.notBefore;
    if (f.blankMatchesAll) out.blankMatchesAll = true;
    return out;
  });
}

export async function createType(body, user) {
  const code = String(body.code || '').toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,60}$/.test(code)) throw badRequest('code must be lowercase letters, digits and dashes');
  if (await one('SELECT 1 FROM master_types WHERE code = $1', [code])) throw conflict(`Master type ${code} already exists`);
  const fields = cleanFieldDefs(body.fields);
  const names = fields.map((f) => f.name);
  const codeField = body.codeField && names.includes(body.codeField) ? body.codeField : null;
  const labelField = body.labelField && names.includes(body.labelField) ? body.labelField : names[0];
  const uniqueKeys = cleanUniqueKeys(body.uniqueKeys, names, codeField);
  await query(`INSERT INTO master_types(code, label, category, screen, storage, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by, updated_by)
               VALUES ($1,$2,$3,$4,'generic',$5,$6,$7,$8,$9,$10,false,$11,$11)`,
  [code, body.label || code, body.category || 'general', body.screen || null, codeField, labelField, JSON.stringify(fields),
    JSON.stringify(uniqueKeys), !!body.allowExtra, Number(body.sortOrder) || 100, user.id]);
  return typeOut(await getType(code), 0);
}

function cleanUniqueKeys(keys, names, codeField) {
  const list = Array.isArray(keys) ? keys.map((k) => (Array.isArray(k) ? k : [k])) : (codeField ? [[codeField]] : []);
  for (const k of list) for (const n of k) if (!names.includes(n)) throw badRequest(`Unique key field not declared: ${n}`);
  return list;
}

export async function updateType(code, body, user) {
  const t = await getType(code);
  let { fields } = t;
  if (body.fields !== undefined) {
    if (t.storage === 'table') {
      // Table-backed types keep their column mappings; only labels / required flags / options may change.
      const incoming = new Map(cleanFieldDefs(body.fields).map((f) => [f.name, f]));
      fields = t.fields.map((f) => (incoming.has(f.name) ? { ...f, ...incoming.get(f.name), column: f.column, ref: f.ref, type: f.type } : f));
      for (const [n, f] of incoming) if (!fields.some((x) => x.name === n)) fields.push(f); // new fields are stored in attrs
    } else fields = cleanFieldDefs(body.fields);
  }
  const names = fields.map((f) => f.name);
  const uniqueKeys = body.uniqueKeys !== undefined ? cleanUniqueKeys(body.uniqueKeys, names, t.code_field) : t.unique_keys;
  const status = parseStatus(body.status) || t.status;
  await query(`UPDATE master_types SET label = $2, screen = $3, fields = $4, unique_keys = $5, allow_extra = $6, sort_order = $7,
               status = $8, updated_by = $9, updated_at = now() WHERE code = $1`,
  [code, body.label || t.label, body.screen ?? t.screen, JSON.stringify(fields), JSON.stringify(uniqueKeys),
    body.allowExtra === undefined ? t.allow_extra : !!body.allowExtra, Number(body.sortOrder) || t.sort_order, status, user.id]);
  const nt = await getType(code);
  return typeOut(nt, await countRecords(nt));
}

// ---------- validation ----------

function coerce(f, v, errors) {
  const label = f.label || f.name;
  switch (f.type) {
    case 'number': case 'integer': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
      if (!Number.isFinite(n) || (f.type === 'integer' && !Number.isInteger(n))) { errors.push({ path: f.name, message: `${label} must be a ${f.type}` }); return undefined; }
      if (typeof f.min === 'number' && n < f.min) errors.push({ path: f.name, message: `${label} must be at least ${f.min}` });
      if (typeof f.max === 'number' && n > f.max) errors.push({ path: f.name, message: `${label} must be at most ${f.max}` });
      return n;
    }
    case 'boolean': return asBool(v);
    case 'date': {
      const d = isoDate(v);
      if (!d) errors.push({ path: f.name, message: `${label} must be a date` });
      return d;
    }
    case 'email': {
      const s = String(v).trim();
      if (!EMAIL.test(s)) errors.push({ path: f.name, message: `${label} must be a valid e-mail address` });
      return s;
    }
    case 'color': {
      const s = String(v).trim();
      if (!/^#[0-9a-fA-F]{3,8}$/.test(s)) errors.push({ path: f.name, message: `${label} must be a hex colour` });
      return s;
    }
    case 'multiselect': {
      if (Array.isArray(v)) return v;
      // an uploaded cell lists values with semicolons when a value itself has a comma, else with commas
      const s = String(v);
      return s.split(s.includes(';') ? ';' : ',').map((x) => x.trim()).filter(Boolean);
    }
    case 'json': return v;
    case 'select': {
      const s = typeof v === 'object' ? v : String(v);
      if (Array.isArray(f.options) && f.options.length && !f.options.includes(s)) errors.push({ path: f.name, message: `${label} must be one of: ${f.options.join(', ')}` });
      return s;
    }
    default: {
      if (typeof v === 'object') return v;
      const s = String(v).trim();
      if (s.length > (f.maxLength || 2000)) errors.push({ path: f.name, message: `${label} is too long` });
      return s;
    }
  }
}

/** Validate a record body against the type definition; returns { values, status }. */
export function validateRecord(t, body, { partial = false } = {}) {
  const errors = [];
  const values = {};
  for (const f of t.fields) {
    if (f.auto || f.type === 'audit-user' || f.type === 'audit-date') continue;
    const v = body[f.name];
    // A code the system issues may be left out; it is filled in when the record is saved.
    if (f.numbering && !partial && (v === undefined || v === null || String(v).trim() === '')) continue;
    if (v === undefined) {
      if (!partial && f.required) errors.push({ path: f.name, message: `${f.label || f.name} is required` });
      else if (!partial && f.default !== undefined) values[f.name] = f.default;
      continue;
    }
    if (v === null || v === '' || (Array.isArray(v) && !v.length && f.required)) {
      if (f.required) errors.push({ path: f.name, message: `${f.label || f.name} is required` });
      else values[f.name] = f.type === 'multiselect' ? [] : null;
      continue;
    }
    const c = coerce(f, v, errors);
    if (c !== undefined) values[f.name] = c;
  }
  if (t.allow_extra) {
    const declared = new Set(t.fields.map((f) => f.name));
    for (const [k, v] of Object.entries(body)) if (!declared.has(k) && !SYSTEM_KEYS.has(k) && v !== undefined) values[k] = v;
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  return { values, status: parseStatus(body.status ?? body.isActive) };
}

/** Date fields declared with notBefore (e.g. Effective To after Effective From); a blank end date is open ended. */
export function assertDateOrder(t, rec) {
  const errors = [];
  for (const f of t.fields) {
    if (!f.notBefore || !rec[f.name] || !rec[f.notBefore]) continue;
    if (String(rec[f.name]).slice(0, 10) < String(rec[f.notBefore]).slice(0, 10)) {
      const other = t.fields.find((x) => x.name === f.notBefore);
      errors.push({ path: f.name, message: `${f.label || f.name} must be on or after ${other?.label || f.notBefore}` });
    }
  }
  if (errors.length) throw badRequest('Validation failed', errors);
}

/**
 * Codes issued by the system: a field declared with numbering (a Document Numbering series) gets the next number of
 * that series when the record is created without one.
 */
async function withIssuedCodes(t, body) {
  const out = { ...body };
  for (const f of t.fields) {
    if (!f.numbering) continue;
    const v = out[f.name];
    if (v !== undefined && v !== null && String(v).trim() !== '') continue;
    const unique = t.storage === 'generic' ? { table: 'master_records', column: 'code' } : null;
    out[f.name] = await nextDocumentNumber(f.numbering, { unique });
  }
  return out;
}

// ---------- storage adapters ----------

const refSelect = (f) => {
  const r = f.ref;
  return `(SELECT r.${q(r.labelColumn || 'name')} FROM ${q(r.table)} r WHERE r.id = t.${q(f.column)})`;
};

function fieldExpr(t, f) {
  if (t.storage === 'generic') return null;
  if (f.ref) return refSelect(f);
  if (f.column) return `t.${q(f.column)}`;
  return null;
}

/** SQL expression (text) for a field, used by search filters, sorting and uniqueness checks. */
function textExpr(t, f, add) {
  if (t.storage === 'generic') return `(m.data->>${add(f.name)})`;
  const e = fieldExpr(t, f);
  return e ? `(${e})::text` : `(t.attrs->>${add(f.name)})`;
}

function genericOut(t, row) {
  const rec = { id: row.id, ...row.data };
  return withAudit(t, rec, row);
}

function tableOut(t, row) {
  const rec = { id: row.id };
  for (const f of t.fields) {
    if (f.ref) { rec[f.name] = row[`__ref_${f.name}`] ?? null; rec[`${f.name}Id`] = row[f.column] ?? null; } else if (f.column) rec[f.name] = row[f.column] ?? null;
    else if (!f.auto && f.type !== 'audit-user' && f.type !== 'audit-date') rec[f.name] = row.attrs?.[f.name] ?? null;
  }
  if (t.allow_extra) for (const [k, v] of Object.entries(row.attrs || {})) if (rec[k] === undefined) rec[k] = v;
  return withAudit(t, rec, row);
}

/** Set-up actors written in created_by / updated_by by seeds, migrations and the chart-of-accounts sync. */
const SETUP_ACTORS = "('seed', 'system', 'migration', 'gl-sync')";

/** Who last changed a record (display name): the last editor, else its creator. */
const lastChangedBy = (row) => row.updated_by_name || row.created_by_name || row.updated_by || row.created_by || null;

function withAudit(t, rec, row) {
  const updatedOn = row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : null;
  for (const f of t.fields) {
    if (f.type === 'audit-user') rec[f.name] = lastChangedBy(row);
    if (f.type === 'audit-date') rec[f.name] = updatedOn;
  }
  return {
    ...rec, status: statusLabel(row.status), isActive: row.status === 'active',
    createdBy: row.created_by_name || row.created_by || null, updatedBy: row.updated_by_name || row.updated_by || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function selectSql(t) {
  const a = t.storage === 'generic' ? 'm' : 't';
  // rows loaded at set-up (seed, migrations, ledger sync) are shown under the administrator who owns the set-up
  const who = (col) => `COALESCE((SELECT u.display_name FROM users u WHERE u.id = ${a}.${col}),
    CASE WHEN ${a}.${col} IN ${SETUP_ACTORS} THEN (SELECT u.display_name FROM users u WHERE u.username = 'BrokerVerse') END) AS ${col}_name`;
  if (t.storage === 'generic') return `SELECT m.*, ${who('created_by')}, ${who('updated_by')} FROM master_records m`;
  const refs = t.fields.filter((f) => f.ref).map((f) => `${refSelect(f)} AS "__ref_${f.name}"`);
  return `SELECT t.*, ${[...refs, who('created_by'), who('updated_by')].join(', ')} FROM ${q(t.table_name)} t`;
}

const RESERVED_QUERY = new Set(['page', 'perPage', 'pageSize', 'pageNo', 'pageNumber', 'limit', 'offset', 'search', 'q', 'status', 'sortBy', 'sortOrder', 'includeDeleted', 'valueField']);

/** JSON value of a field kept in the document (generic data or the attrs of a table row); null for column fields. */
function jsonExpr(t, f, add) {
  if (t.storage === 'generic') return `(m.data->${add(f.name)})`;
  return fieldExpr(t, f) ? null : `(t.attrs->${add(f.name)})`;
}

/**
 * Filter on one field. A multi-select field matches when the list holds the value (older records kept one value as
 * text); a field declared blankMatchesAll also matches records that leave it empty (e.g. a commission for every
 * sales person).
 */
function fieldFilter(t, f, value, add) {
  const text = textExpr(t, f, add);
  // the JSON expression is built only when used: every parameter added must appear in the query
  const needsJson = f.type === 'multiselect' || f.blankMatchesAll;
  const json = needsJson ? jsonExpr(t, f, add) : null;
  const v = add(value);
  const cond = f.type === 'multiselect' && json
    ? `(CASE WHEN jsonb_typeof(${json}) = 'array'
         THEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(${json}) e WHERE lower(e) = lower(${v}))
         ELSE ${text} ILIKE ${v} END)`
    : `${text} ILIKE ${v}`;
  if (!f.blankMatchesAll) return cond;
  const blank = json ? `(${json} IS NULL OR ${json} IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb))` : `COALESCE(${text}, '') = ''`;
  return `(${cond} OR ${blank})`;
}

function whereFor(t, qs, p) {
  const conds = [];
  const alias = t.storage === 'generic' ? 'm' : 't';
  if (t.storage === 'generic') conds.push(`m.type_code = ${p.add(t.code)}`);
  conds.push(`${alias}.status <> 'deleted'`);
  const st = parseStatus(qs.status);
  if (st) conds.push(`${alias}.status = ${p.add(st)}`);
  const term = qs.search ?? qs.q;
  if (term) conds.push(`${alias}::text ILIKE ${p.add(`%${term}%`)}`);
  for (const f of t.fields) {
    if (RESERVED_QUERY.has(f.name) || qs[f.name] === undefined || qs[f.name] === '') continue;
    conds.push(fieldFilter(t, f, String(qs[f.name]), p.add));
  }
  return conds.join(' AND ');
}

function orderFor(t, qs, p) {
  const dir = String(qs.sortOrder || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const alias = t.storage === 'generic' ? 'm' : 't';
  const f = t.fields.find((x) => x.name === qs.sortBy);
  if (f) return `${textExpr(t, f, p.add)} ${dir} NULLS LAST, ${alias}.id`;
  if (['createdAt', 'updatedAt'].includes(qs.sortBy)) return `${alias}.${qs.sortBy === 'createdAt' ? 'created_at' : 'updated_at'} ${dir}, ${alias}.id`;
  const lf = t.fields.find((x) => x.name === t.label_field);
  return lf ? `${textExpr(t, lf, p.add)} ASC NULLS LAST, ${alias}.id` : `${alias}.id ${dir}`;
}

export async function listRecords(t, qs, pg) {
  const p = params();
  const where = whereFor(t, qs, p);
  const whereValues = [...p.values];
  const order = orderFor(t, qs, p);
  const from = t.storage === 'generic' ? 'master_records m' : `${q(t.table_name)} t`;
  const total = (await one(`SELECT count(*)::int AS n FROM ${from} WHERE ${where}`, whereValues)).n;
  const rows = await many(`${selectSql(t)} WHERE ${where} ORDER BY ${order} LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  return { total, rows: rows.map((r) => (t.storage === 'generic' ? genericOut(t, r) : tableOut(t, r))) };
}

export async function getRecord(t, id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Record not found');
  const alias = t.storage === 'generic' ? 'm' : 't';
  const extra = t.storage === 'generic' ? ' AND m.type_code = $2' : '';
  const row = await one(`${selectSql(t)} WHERE ${alias}.id = $1 AND ${alias}.status <> 'deleted'${extra}`, t.storage === 'generic' ? [Number(id), t.code] : [Number(id)]);
  if (!row) throw notFound(`${t.label} record not found`);
  return t.storage === 'generic' ? genericOut(t, row) : tableOut(t, row);
}

async function resolveRef(f, value) {
  if (value === null || value === undefined || value === '') return null;
  const r = f.ref;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const hit = await one(`SELECT id FROM ${q(r.table)} WHERE id = $1`, [Number(value)]);
    if (hit) return hit.id;
  }
  const hit = await refId(f, value);
  if (!hit) throw badRequest('Validation failed', [{ path: f.name, message: `${f.label || f.name} '${value}' was not found` }]);
  return hit;
}

/**
 * Id of the referenced record named by its code or its label (case-insensitive); the code wins, so a code tells
 * apart records that share a label (e.g. two states named Cebu in two countries). Null when none.
 */
async function refId(f, value) {
  const r = f.ref;
  const text = String(value).trim();
  if (r.codeColumn) {
    const byCode = await one(`SELECT id FROM ${q(r.table)} WHERE lower(${q(r.codeColumn)}) = lower($1) AND status <> 'deleted' ORDER BY id LIMIT 1`, [text]);
    if (byCode) return byCode.id;
  }
  const byLabel = await one(`SELECT id FROM ${q(r.table)} WHERE lower(${q(r.labelColumn || 'name')}) = lower($1) AND status <> 'deleted' ORDER BY id LIMIT 1`, [text]);
  return byLabel ? byLabel.id : null;
}

/**
 * Labels of the records a reference field points to that several records share ({ id -> code } of those records),
 * for exports that must name the record without ambiguity (go-live configuration workbook).
 */
export async function ambiguousRefCodes(f) {
  const r = f.ref;
  if (!r?.codeColumn) return new Map();
  const label = q(r.labelColumn || 'name');
  const rows = await many(`SELECT id, ${q(r.codeColumn)} AS code FROM ${q(r.table)} WHERE status <> 'deleted' AND ${q(r.codeColumn)} IS NOT NULL
      AND lower(${label}) IN (SELECT lower(${label}) FROM ${q(r.table)} WHERE status <> 'deleted' GROUP BY lower(${label}) HAVING count(*) > 1)`);
  return new Map(rows.map((x) => [x.id, x.code]));
}

async function assertUnique(t, values, exceptId) {
  for (const key of t.unique_keys || []) {
    const fields = key.map((n) => t.fields.find((f) => f.name === n)).filter(Boolean);
    if (!fields.length || fields.some((f) => values[f.name] === undefined || values[f.name] === null)) continue;
    const p = params();
    const alias = t.storage === 'generic' ? 'm' : 't';
    const from = t.storage === 'generic' ? `master_records m WHERE m.type_code = ${p.add(t.code)} AND` : `${q(t.table_name)} t WHERE`;
    const conds = [];
    for (const f of fields) {
      // a reference compares the record it names (id, code or label), not its label text
      if (t.storage !== 'generic' && f.ref && f.column) conds.push(`t.${q(f.column)} = ${p.add(await resolveRef(f, values[f.name]))}`);
      else conds.push(`lower(${textExpr(t, f, p.add)}) = lower(${p.add(String(values[f.name]))})`);
    }
    if (exceptId) conds.push(`${alias}.id <> ${p.add(Number(exceptId))}`);
    const hit = await one(`SELECT 1 FROM ${from} ${alias}.status <> 'deleted' AND ${conds.join(' AND ')} LIMIT 1`, p.values);
    if (hit) throw conflict(`${t.label} with the same ${fields.map((f) => f.label || f.name).join(' + ')} already exists`);
  }
}

/**
 * The record whose natural key (the first unique key of the type, e.g. the code) has the values of `values`, or null
 * (deleted records are not matched; text compared without case). Used by the go-live configuration workbook, which
 * updates a record when its key exists and creates it otherwise.
 */
export async function findRecordByKey(t, values) {
  const key = (t.unique_keys || [])[0] || (t.code_field ? [t.code_field] : []);
  const fields = key.map((n) => t.fields.find((f) => f.name === n)).filter(Boolean);
  if (!fields.length || fields.length !== key.length || fields.some((f) => values[f.name] === undefined || values[f.name] === null || values[f.name] === '')) return null;
  const p = params();
  const alias = t.storage === 'generic' ? 'm' : 't';
  const from = t.storage === 'generic' ? `master_records m WHERE m.type_code = ${p.add(t.code)} AND` : `${q(t.table_name)} t WHERE`;
  const conds = [];
  for (const f of fields) {
    // a reference is matched on the record it names (code or label), as createRecord resolves it
    if (t.storage !== 'generic' && f.ref && f.column) {
      const id = await refId(f, values[f.name]);
      if (!id) return null;
      conds.push(`t.${q(f.column)} = ${p.add(id)}`);
    } else conds.push(`lower(${textExpr(t, f, p.add)}) = lower(${p.add(String(values[f.name]).trim())})`);
  }
  const hit = await one(`SELECT ${alias}.id FROM ${from} ${alias}.status <> 'deleted' AND ${conds.join(' AND ')} ORDER BY ${alias}.id LIMIT 1`, p.values);
  return hit ? hit.id : null;
}

const pgConflict = (t) => (e) => {
  if (e.code === '23505') throw conflict(`${t.label} with the same code already exists`);
  throw e;
};

async function tableColumns(t, values) {
  const cols = {};
  const attrs = {};
  for (const [k, v] of Object.entries(values)) {
    const f = t.fields.find((x) => x.name === k);
    if (f?.ref) cols[f.column] = await resolveRef(f, v);
    else if (f?.column) cols[f.column] = v;
    else attrs[k] = v;
  }
  return { cols, attrs };
}

export async function createRecord(t, body, user) {
  assertNotRetired(t);
  const valid = validateRecord(t, body);
  assertDateOrder(t, valid.values);
  const values = await withIssuedCodes(t, valid.values);
  const { status } = valid;
  await assertUnique(t, values);
  await assertSinglePrimary(t, values, status || 'active');
  const { makeBase } = await checkBaseCurrency(t, values, { status: status || 'active' });
  let id;
  if (t.storage === 'generic') {
    const r = await query(`INSERT INTO master_records(type_code, code, name, data, status, created_by, updated_by)
                           VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
    [t.code, t.code_field ? values[t.code_field] ?? null : null, t.label_field ? values[t.label_field] ?? null : null,
      JSON.stringify(values), status || 'active', user.id]).catch(pgConflict(t));
    id = r.rows[0].id;
  } else {
    const { cols, attrs } = await tableColumns(t, makeBase ? withoutBaseFlag(t, values) : values);
    const p = params();
    const names = Object.keys(cols);
    const sql = `INSERT INTO ${q(t.table_name)} (${[...names.map(q), 'attrs', 'status', 'created_by', 'updated_by'].join(', ')})
                 VALUES (${[...names.map((n) => p.add(cols[n])), p.add(JSON.stringify(attrs)), p.add(status || 'active'), p.add(user.id), p.add(user.id)].join(', ')}) RETURNING id`;
    const r = await query(sql, p.values).catch(pgConflict(t));
    id = r.rows[0].id;
  }
  if (makeBase) await setBaseCurrency(id);
  await afterCompanyChange(t, user.id);
  return getRecord(t, id);
}

export async function updateRecord(t, id, body, user) {
  assertNotRetired(t);
  const before = await getRecord(t, id);
  const { values, status } = validateRecord(t, body, { partial: true });
  assertDateOrder(t, { ...before, ...values });
  // an unchanged reference keeps the record it points to (its id), not its label, which other records may share
  const refIds = Object.fromEntries(t.fields.filter((f) => f.ref && before[`${f.name}Id`]).map((f) => [f.name, before[`${f.name}Id`]]));
  await assertUnique(t, { ...before, ...refIds, ...values }, id);
  await assertSinglePrimary(t, { ...before, ...values }, status || (before.isActive ? 'active' : 'inactive'), id);
  const { makeBase } = await checkBaseCurrency(t, values, { before, status: status || (before.isActive ? 'active' : 'inactive') });
  if (t.storage === 'generic') {
    const keep = ([k]) => t.fields.some((f) => f.name === k) || (t.allow_extra && !SYSTEM_KEYS.has(k));
    const merged = { ...Object.fromEntries(Object.entries(before).filter(keep)), ...values };
    for (const f of t.fields) if (f.type === 'audit-user' || f.type === 'audit-date') delete merged[f.name];
    await query(`UPDATE master_records SET data = $2, code = $3, name = $4, status = COALESCE($5, status), updated_by = $6, updated_at = now() WHERE id = $1`,
      [Number(id), JSON.stringify(merged), t.code_field ? merged[t.code_field] ?? null : null, t.label_field ? merged[t.label_field] ?? null : null, status || null, user.id]).catch(pgConflict(t));
  } else {
    const { cols, attrs } = await tableColumns(t, makeBase ? withoutBaseFlag(t, values) : values);
    const p = params([Number(id)]);
    const sets = Object.keys(cols).map((c) => `${q(c)} = ${p.add(cols[c])}`);
    sets.push(`attrs = attrs || ${p.add(JSON.stringify(attrs))}::jsonb`, `updated_by = ${p.add(user.id)}`, 'updated_at = now()');
    if (status) sets.push(`status = ${p.add(status)}`);
    await query(`UPDATE ${q(t.table_name)} SET ${sets.join(', ')} WHERE id = $1`, p.values).catch(pgConflict(t));
  }
  if (makeBase) await setBaseCurrency(id);
  await afterCompanyChange(t, user.id);
  return { before, after: await getRecord(t, id) };
}

export async function setRecordStatus(t, id, status, user) {
  assertNotRetired(t);
  const before = await getRecord(t, id);
  await assertSinglePrimary(t, before, status, id);
  await checkBaseCurrency(t, {}, { before, status });
  const table = t.storage === 'generic' ? 'master_records' : q(t.table_name);
  await query(`UPDATE ${table} SET status = $2, updated_by = $3, updated_at = now() WHERE id = $1`, [Number(id), status, user.id]);
  await afterCompanyChange(t, user.id);
  return { before, after: status === 'deleted' ? { ...before, status: 'Deleted' } : await getRecord(t, id) };
}

// ---------- bulk upload ----------

/** Master types that are copies of another register and are never uploaded here (the chart of accounts is). */
/**
 * Master types withdrawn from use, with the screen that replaced them. Their records are kept for reference (read
 * only); creating, changing or (de)activating a record is refused. taxation: the legacy taxation master, whose records
 * also wrote tax.* settings, replaced by the tax codes master and Premium Taxes & LGU Rates (migration 0233). The
 * others duplicated another screen or were read by nothing (migration 0241): each value now has one place.
 */
export const RETIRED_TYPES = new Map([
  ['taxation', 'Master > Finance > Taxation (tax codes) and Master > Finance > Premium Taxes & LGU Rates'],
  ['remittance-approval-workflow', 'Master > User Management > Authority Matrix (remittance approval limits)'],
  ['remittance-reconciliation-rule', 'Master > Configuration (remittance.reconciliation_tolerance)'],
  ['remittance-electronic-transfer', 'Master > Configuration (remittance.transfer_methods)'],
  ['remittance-history-config', 'Accounts > Remittance > History'],
  ['remittance-analytics-config', 'Master > Configuration (remittance.kpi_targets)'],
  ['remittance-direct-bill', 'Master > Configuration (direct_bill.* settings)'],
  ['remittance-report-template', 'Reports > Remittance summary'],
  ['commission', 'Master > Finance > Commission Rate Matrix'],
  ['employee', 'Master > User Management > User'],
  ['petty-cash', 'Accounts > Petty Cash > Initiate'],
]);
function assertNotRetired(t) {
  if (RETIRED_TYPES.has(t.code)) throw badRequest(`The ${t.label} master is retired and can no longer be changed; use ${RETIRED_TYPES.get(t.code)}`);
}

/**
 * Master types without an upload (and without an upload template): the main and sub accounts are copies of the chart
 * of accounts; the account set-up has one record per fixed set-up code, all shipped, edited on the screen.
 */
export const NOT_UPLOADABLE = new Map([['main-account', 'the Chart of Accounts upload'], ['sub-account', 'the Chart of Accounts upload'],
  ['account-setup', 'Master > Finance > Account Determination (one record per set-up code, edited on the screen)']]);

/** Why a master type has no upload template (retired or not uploadable), or null when it has one. */
export function noTemplateReason(t) {
  if (RETIRED_TYPES.has(t.code) || t.status === 'inactive') return `The ${t.label} master is retired; use ${RETIRED_TYPES.get(t.code) || 'the screen that replaced it'}`;
  if (NOT_UPLOADABLE.has(t.code)) return `${t.label} records are not uploaded here; use ${NOT_UPLOADABLE.get(t.code)}`;
  return null;
}

const FORMAT = {
  string: 'Text', text: 'Text', number: 'Number', integer: 'Whole number', boolean: 'Yes or No', date: 'Date YYYY-MM-DD', email: 'E-mail address',
  select: 'One of the allowed values', multiselect: 'Values separated by commas (semicolons when a value has a comma)', json: 'JSON text', color: 'Colour, e.g. #1F4E78', url: 'Web address',
};

/**
 * Upload columns of a master type, in the field order of its definition: header = field label (the field name is
 * also accepted). Audit and automatic fields are left out; Status (Active / Inactive) is the last, optional column.
 */
export function uploadColumns(t) {
  const cols = (t.fields || []).filter((f) => !f.auto && f.type !== 'audit-user' && f.type !== 'audit-date').map((f) => ({
    key: f.name, header: f.label || f.name, aliases: [], required: !!f.required && !f.numbering,
    format: f.ref ? `Name${f.ref.codeColumn ? ' or code' : ''} of an existing ${f.ref.type.replace(/-/g, ' ')} record` : FORMAT[f.type || 'string'] || 'Text',
    ...(Array.isArray(f.options) && f.options.length ? { allowed: f.options } : {}),
  }));
  return [...cols, { key: 'status', header: 'Status', aliases: [], required: false, format: 'Active when empty', allowed: ['Active', 'Inactive'] }];
}

/** Record body of an uploaded row (keys normalised by parseUploadedRows); JSON fields are parsed. */
export function bodyFromRow(t, row, pickValue) {
  const body = {};
  for (const c of uploadColumns(t)) {
    const v = pickValue(row, c.header, c.key);
    if (v === undefined) continue;
    const f = t.fields.find((x) => x.name === c.key);
    if (f?.type === 'json' && typeof v === 'string') {
      try { body[c.key] = JSON.parse(v); } catch { throw badRequest(`${c.header} must be JSON text`); }
    } else body[c.key] = v;
  }
  return body;
}

/** Dropdown options: [{ id, code, label, value }]; value is the label unless valueField=id|code. */
export async function listOptions(t, qs) {
  const { rows } = await listRecords(t, { ...qs, status: qs.status || 'active', sortBy: qs.sortBy || t.label_field }, { limit: Math.min(1000, Number(qs.limit) || 500), offset: 0 });
  return rows.map((r) => {
    const label = r[t.label_field] ?? r.name ?? String(r.id);
    const code = t.code_field ? r[t.code_field] : null;
    const value = qs.valueField === 'id' ? r.id : qs.valueField === 'code' ? code : label;
    return { id: r.id, code, label, value };
  });
}
