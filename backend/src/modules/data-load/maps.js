/**
 * Value maps (legacy code tables): a legacy value of an object (insurer, product, branch, user, channel, client,
 * payment status, claim status, vehicle type) translated to the BrokerVerse code before the master lookup of a
 * migration load. Kept in migration_value_maps (migration 0441), unique per object on the normalised legacy value, so
 * the spellings of one legacy value resolve alike. Maintained on Templates > Value Maps (list, add, change, remove,
 * download and upload as one sheet) and written by the "Use existing" resolution of a duplicate row (client legacy code
 * -> existing client code, insurer variant -> insurer code), so later rows and later loads resolve the same way.
 *
 * A validation reads the maps once (ctx.maps) and keeps the latest change it saw (ctx.mapsVersion, stored on the
 * batch); a map changed after the validation sends the batch back to validation before it is loaded.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { readSheets } from './compare.js';
import { normaliseCompany, normaliseInsurer, normaliseText } from './duplicates.js';
import { cellString } from './common.js';

/** Objects a value can be mapped for: label, the normalisation of the legacy value, and how the target is checked. */
export const MAP_OBJECTS = {
  insurer: { label: 'Insurer', norm: normaliseInsurer, target: 'SELECT code FROM insurance_companies WHERE lower(code) = lower($1) AND status <> \'deleted\'' },
  product: { label: 'Product', norm: normaliseText, target: 'SELECT code FROM products WHERE lower(code) = lower($1) AND status <> \'deleted\'' },
  branch: { label: 'Branch', norm: normaliseText, target: 'SELECT code FROM branches WHERE lower(code) = lower($1)' },
  user: { label: 'User', norm: normaliseText, target: 'SELECT username AS code FROM users WHERE lower(username) = lower($1) AND status <> \'deleted\'' },
  channel: { label: 'Distribution channel', norm: normaliseText, target: 'SELECT code FROM distribution_channels WHERE lower(code) = lower($1)' },
  client: { label: 'Client', norm: normaliseText, target: 'SELECT client_code AS code FROM clients WHERE lower(client_code) = lower($1)' },
  'payment-status': { label: 'Payment status', norm: normaliseText, values: async () => getSetting('policies.payment_statuses', ['Pending', 'Reviewing', 'Partial', 'Completed', 'Refunded']) },
  'claim-status': { label: 'Claim status', norm: normaliseText, values: async () => ['registered', 'in-review'] },
  'vehicle-type': { label: 'Vehicle type', norm: normaliseCompany },
};
export const MAP_OBJECT_KEYS = Object.keys(MAP_OBJECTS);

const objectOf = (object) => {
  const o = String(object || '').trim().toLowerCase();
  if (!MAP_OBJECTS[o]) throw badRequest('Validation failed', [{ path: 'object', message: `Object must be one of ${MAP_OBJECT_KEYS.join(', ')}` }]);
  return o;
};
/** Normalised form of a legacy value of an object. */
export const normaliseLegacy = (object, value) => MAP_OBJECTS[object].norm(value) || normaliseText(value);

const SELECT = `SELECT m.*, cu.display_name AS created_by_name, uu.display_name AS updated_by_name FROM migration_value_maps m
  LEFT JOIN users cu ON cu.id = m.created_by LEFT JOIN users uu ON uu.id = m.updated_by`;
const toMap = (m) => m && ({
  id: Number(m.id), object: m.object, objectLabel: MAP_OBJECTS[m.object]?.label || m.object, legacyValue: m.legacy_value, targetCode: m.target_code, note: m.note,
  createdBy: m.created_by_name || m.created_by, createdAt: m.created_at, updatedBy: m.updated_by_name || m.updated_by, updatedAt: m.updated_at,
});

/** The BrokerVerse code a map points to, checked against its master (canonical spelling), or an error on targetCode. */
async function checkedTarget(object, code) {
  const value = cellString(code);
  if (!value) throw badRequest('Validation failed', [{ path: 'targetCode', message: 'BrokerVerse code is required' }]);
  const def = MAP_OBJECTS[object];
  if (def.target) {
    const r = await one(def.target, [value]);
    if (!r) throw badRequest('Validation failed', [{ path: 'targetCode', message: `${value} is not a ${def.label.toLowerCase()} code of BrokerVerse` }]);
    return r.code;
  }
  if (def.values) {
    const found = (await def.values()).find((x) => x.toLowerCase() === value.toLowerCase());
    if (!found) throw badRequest('Validation failed', [{ path: 'targetCode', message: `${def.label} must be one of ${(await def.values()).join(', ')}` }]);
    return found;
  }
  return value;
}

export async function listMaps({ object = null, search = null } = {}, pg = { limit: 500, offset: 0 }) {
  const where = `WHERE ($1::text IS NULL OR m.object = $1) AND ($2::text IS NULL OR m.legacy_value ILIKE '%' || $2 || '%' OR m.target_code ILIKE '%' || $2 || '%')`;
  const params = [object ? objectOf(object) : null, search ? String(search).trim() : null];
  const total = (await one(`SELECT count(*)::int AS n FROM migration_value_maps m ${where}`, params)).n;
  const rows = await many(`${SELECT} ${where} ORDER BY m.object, m.legacy_value, m.id LIMIT $3 OFFSET $4`, [...params, pg.limit, pg.offset]);
  return { total, rows: rows.map(toMap) };
}

export async function getMap(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Value map not found');
  const m = await one(`${SELECT} WHERE m.id = $1`, [Number(id)]);
  if (!m) throw notFound('Value map not found');
  return toMap(m);
}

/**
 * Add a map, or change the target of the map of the same legacy value (upsert on object + normalised value, so the
 * "Use existing" resolution of a second batch keeps one map). db: the caller's transaction (resolution).
 */
export async function saveMap({ object, legacyValue, targetCode, note = null }, user, { db = null } = {}) {
  const o = objectOf(object);
  const legacy = cellString(legacyValue);
  if (!legacy) throw badRequest('Validation failed', [{ path: 'legacyValue', message: 'Legacy value is required' }]);
  const target = await checkedTarget(o, targetCode);
  const run = db ? (sql, p) => db.query(sql, p) : query;
  const r = (await run(`INSERT INTO migration_value_maps(object, legacy_value, legacy_norm, target_code, note, created_by, updated_by, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$6,now())
    ON CONFLICT (object, legacy_norm) DO UPDATE SET legacy_value = EXCLUDED.legacy_value, target_code = EXCLUDED.target_code,
      note = COALESCE(EXCLUDED.note, migration_value_maps.note), updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING id, (xmax = 0) AS inserted`, [o, legacy, normaliseLegacy(o, legacy), target, note ? String(note).slice(0, 500) : null, user?.id ?? null])).rows[0];
  return { id: Number(r.id), created: r.inserted };
}

export async function updateMap(id, { legacyValue, targetCode, note }, user) {
  const before = await getMap(id);
  const legacy = legacyValue === undefined ? before.legacyValue : cellString(legacyValue);
  if (!legacy) throw badRequest('Validation failed', [{ path: 'legacyValue', message: 'Legacy value is required' }]);
  const target = targetCode === undefined ? before.targetCode : await checkedTarget(before.object, targetCode);
  const norm = normaliseLegacy(before.object, legacy);
  const clash = await one('SELECT id FROM migration_value_maps WHERE object = $1 AND legacy_norm = $2 AND id <> $3', [before.object, norm, before.id]);
  if (clash) throw conflict(`${MAP_OBJECTS[before.object].label} value ${legacy} is mapped already`);
  await query(`UPDATE migration_value_maps SET legacy_value = $2, legacy_norm = $3, target_code = $4, note = $5, updated_by = $6, updated_at = now() WHERE id = $1`,
    [before.id, legacy, norm, target, note === undefined ? before.note : (note ? String(note).slice(0, 500) : null), user?.id ?? null]);
  return { before, after: await getMap(before.id) };
}

export async function deleteMap(id) {
  const before = await getMap(id);
  await query('DELETE FROM migration_value_maps WHERE id = $1', [before.id]);
  return before;
}

/** Latest change of the maps (null when there is none): the version a validation read. */
export async function mapsVersion() {
  return (await one('SELECT max(COALESCE(updated_at, created_at)) AS v FROM migration_value_maps')).v || null;
}

/** Read the maps for a validation: ctx.maps (object -> normalised value -> code) and ctx.mapsVersion. */
export async function loadMaps(ctx) {
  const maps = new Map(MAP_OBJECT_KEYS.map((o) => [o, new Map()]));
  for (const m of await many('SELECT object, legacy_norm, target_code FROM migration_value_maps')) maps.get(m.object)?.set(m.legacy_norm, m.target_code);
  ctx.maps = maps;
  ctx.mapsVersion = await mapsVersion();
  return maps;
}

/** The BrokerVerse code of a legacy value through the maps of ctx, or the value as it is when no map holds it. */
export function resolveValue(ctx, object, value) {
  if (value === undefined || value === null || value === '') return value;
  const code = ctx.maps?.get(object)?.get(normaliseLegacy(object, value));
  return code ?? value;
}

// ------------------------------------------------------------------ one-sheet workbook

const SHEET = {
  key: 'value-maps', name: 'Value Maps', keyColumns: ['object', 'legacyValue'],
  columns: [
    { key: 'object', header: 'Object', required: true, list: 'Object' },
    { key: 'legacyValue', header: 'Legacy Value', required: true },
    { key: 'targetCode', header: 'BrokerVerse Code', required: true },
    { key: 'note', header: 'Note' },
  ],
};

/** The maps as one sheet (current data), with the objects as a drop-down. */
export async function mapsWorkbook() {
  const rows = (await listMaps({}, { limit: 100000, offset: 0 })).rows;
  return writeXlsx({
    title: 'Value maps', creator: 'BrokerVerse',
    sheets: [
      { name: SHEET.name, headerStyle: 'navy', textColumns: true, columns: SHEET.columns.map((c) => ({ header: `${c.header}${c.required ? ' *' : ''}`, width: c.key === 'note' ? 40 : 24 })),
        rows: rows.map((m) => [m.object, m.legacyValue, m.targetCode, m.note || '']),
        validations: [{ sqref: 'A2:A5000', formula: `Lists!$A$2:$A$${MAP_OBJECT_KEYS.length + 1}`, strict: true }] },
      { name: 'Lists', headerStyle: 'navy', autoFilter: false, columns: [{ header: 'Object', width: 18 }, { header: 'Label', width: 24 }],
        rows: MAP_OBJECT_KEYS.map((o) => [o, MAP_OBJECTS[o].label]) },
    ],
  });
}

/**
 * Load the Value Maps sheet: each row added or changed (upsert), all or nothing. Returns { created, updated, errors:
 * [{ row, column, message }] }; with errors nothing is saved.
 */
export async function uploadMaps(buffer, user) {
  const rows = readSheets(buffer, [SHEET], { label: 'The value maps workbook' })[SHEET.key]?.rows || [];
  if (!rows.length) throw badRequest('The Value Maps sheet has no data rows');
  const errors = [];
  const seen = new Map();
  for (const r of rows) {
    const v = r.values;
    for (const c of SHEET.columns.filter((x) => x.required && !v[x.key])) errors.push({ row: r.rowNumber, column: c.header, message: `${c.header} is required` });
    if (!v.object || !v.legacyValue) continue;
    const o = String(v.object).trim().toLowerCase();
    if (!MAP_OBJECTS[o]) { errors.push({ row: r.rowNumber, column: 'Object', message: `Object must be one of ${MAP_OBJECT_KEYS.join(', ')}` }); continue; }
    const k = `${o}|${normaliseLegacy(o, v.legacyValue)}`;
    if (seen.has(k)) errors.push({ row: r.rowNumber, column: 'Legacy Value', message: `Same legacy value as row ${seen.get(k)}` });
    else seen.set(k, r.rowNumber);
  }
  if (errors.length) return { created: 0, updated: 0, errors };
  let created = 0;
  let updated = 0;
  try {
    await withTransaction(async (db) => {
      for (const r of rows) {
        try {
          const s = await saveMap(r.values, user, { db });
          if (s.created) created += 1;
          else updated += 1;
        } catch (e) {
          if (!e.status) throw e;
          for (const d of e.details?.length ? e.details : [{ message: e.message }]) {
            errors.push({ row: r.rowNumber, column: SHEET.columns.find((c) => c.key === d.path)?.header || null, message: d.message });
          }
        }
      }
      if (errors.length) throw Object.assign(new Error('rows in error'), { rowsInError: true });
    });
  } catch (e) {
    if (!e.rowsInError) throw e;
    return { created: 0, updated: 0, errors };
  }
  return { created, updated, errors: [] };
}
