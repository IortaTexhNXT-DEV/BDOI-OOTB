/**
 * Audit trail queries for the screens: the history of one record (timeline on its detail screen) and the filtered,
 * paged log of Master > Audit Trail, both as business events (lib/auditEvents.js). Read only: the stored audit rows
 * are never changed.
 */
import { many, one } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { businessTimeZone } from '../../lib/dates.js';
import { ENTITIES } from '../../lib/scope.js';
import { RECORD_KEYS, groupFieldChanges, toEvents } from '../../lib/auditEvents.js';
import { actionText, entityLabel } from '../../lib/auditLabels.js';

const COLUMNS = 'a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source';

/** Audit entity names used for a record type in audit_log (the scope registry calls a quotation "quote"). */
const AUDIT_ENTITY = { quote: 'quotation' };
/** Scope registry key of an audit entity. */
export const SCOPE_ENTITY = { quotation: 'quote', policy: 'policy', claim: 'claim', client: 'client', lead: 'lead', endorsement: 'endorsement',
  receipt: 'receipt', renewal: 'renewal', placement: 'placement', broker_slip: 'broker_slip' };

/** The stored id of a record given its id or number (policy number, claim number ...); the reference itself when unknown. */
export async function recordId(entity, ref) {
  const scopeKey = SCOPE_ENTITY[entity];
  const e = scopeKey && ENTITIES[scopeKey];
  if (!e) return String(ref);
  const row = await one(`SELECT id::text AS id FROM ${e.table} WHERE ${e.keys.map((k) => `${k}::text = $1`).join(' OR ')} LIMIT 1`, [String(ref)]);
  return row?.id || String(ref);
}

/**
 * Events of one record, newest first (sort=asc for oldest first). A claim's history is its field-level trail
 * (claim_field_changes, grouped per action) plus the audited actions the trail does not hold (funds received,
 * payment to the claimant); the source of a trail action is taken from the audit row written with it.
 */
export async function recordHistory(entityIn, ref, { viewer = null, sort = 'desc', limit = 500 } = {}) {
  const entity = AUDIT_ENTITY[entityIn] || entityIn;
  const id = await recordId(entity, ref);
  const dir = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const cap = Math.min(2000, Math.max(1, Number(limit) || 500));
  let rows = await many(`SELECT ${COLUMNS} FROM audit_log a WHERE a.entity = $1 AND a.entity_id = $2 ORDER BY a.at ${dir}, a.id ${dir} LIMIT $3`, [entity, id, cap]);
  if (entity === 'claim') {
    const trail = await many(`SELECT id, at, user_id, username, claim_id, action, field_name, old_value, new_value FROM claim_field_changes
      WHERE claim_id = $1 ORDER BY at, id`, [id]);
    const grouped = groupFieldChanges(trail);
    // audit rows written by the same requests as the trail (the trail already tells these actions field by field)
    const covered = new Set(['create', 'update', 'close', 'reject', 'settle', 'status', 'Settlement Submitted', 'approve-settlement', 'return-settlement']);
    // source of a trail action: the audit row the same request wrote just after it (same user, within a few seconds)
    for (const g of grouped) {
      const t = new Date(g.at).getTime();
      let best = null;
      for (const r of rows) {
        const d = new Date(r.at).getTime() - t;
        if ((r.username || '') !== (g.username || '') || d < 0 || d > 10000) continue;
        if (!best || d < best.d) best = { r, d };
      }
      if (best) g.source = best.r.source;
    }
    rows = [...grouped, ...rows.filter((r) => !covered.has(r.action))]
      .sort((a, b) => (dir === 'ASC' ? 1 : -1) * (new Date(a.at) - new Date(b.at) || String(a.id).localeCompare(String(b.id))));
  }
  return toEvents(rows, { viewer });
}

/** WHERE clause of the audit log filters: from / to (business dates), username, entity, entity number, action, text. */
async function logFilter(q) {
  const params = [];
  const where = [];
  const add = (sql, ...vals) => {
    let out = sql;
    for (const v of vals) { params.push(v); out = out.replace('?', `$${params.length}`); }
    where.push(out);
  };
  const isoDay = (v, field) => {
    if (v === undefined || v === null || v === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw badRequest('Validation failed', [{ path: field, message: `${field} must be a date (YYYY-MM-DD)` }]);
    return String(v);
  };
  const from = isoDay(q.from, 'from');
  const to = isoDay(q.to, 'to');
  if (from && to && from > to) throw badRequest('Validation failed', [{ path: 'to', message: 'to must be on or after from' }]);
  const tz = (from || to) ? await businessTimeZone() : null;
  if (from) add('a.at >= (?::date)::timestamp AT TIME ZONE ?', from, tz);
  if (to) add('a.at < (?::date + 1)::timestamp AT TIME ZONE ?', to, tz);
  if (q.username) add('a.username = ?', String(q.username));
  if (q.entity) {
    const list = String(q.entity).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.includes('master')) add('(a.entity = ANY(?::text[]) OR a.entity LIKE \'master:%\')', list);
    else add('a.entity = ANY(?::text[])', list);
  }
  if (q.action) add('a.action ILIKE ?', `%${String(q.action).trim()}%`);
  const ref = String(q.entityRef ?? q.entityId ?? '').trim();
  if (ref) {
    // the id itself, or the id of a record whose number is the reference (policy, claim, quotation ... number)
    const ids = new Set([ref]);
    const types = q.entity ? String(q.entity).split(',').map((s) => s.trim()) : Object.keys(RECORD_KEYS);
    for (const t of types) {
      const [table, col] = RECORD_KEYS[t] || [];
      if (!table) continue;
      const found = await many(`SELECT id::text AS id FROM ${table} WHERE lower(${col}) = lower($1) LIMIT 5`, [ref]).catch(() => []);
      found.forEach((f) => ids.add(f.id));
    }
    add('a.entity_id = ANY(?::text[])', [...ids]);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** A page of the audit log as events, newest first: { events, total }. */
export async function logPage(q, { page = 1, perPage = 20, offset = 0 } = {}, viewer = null) {
  const f = await logFilter(q);
  const total = (await one(`SELECT count(*)::int AS n FROM audit_log a ${f.sql}`, f.params)).n;
  const rows = await many(`SELECT ${COLUMNS} FROM audit_log a ${f.sql} ORDER BY a.at DESC, a.id DESC LIMIT $${f.params.length + 1} OFFSET $${f.params.length + 2}`,
    [...f.params, perPage, offset]);
  return { events: await toEvents(rows, { viewer }), total, page, perPage };
}

/** Every matching event (newest first, at most `max`) for the download. */
export async function logExport(q, viewer = null, max = 10000) {
  const f = await logFilter(q);
  const rows = await many(`SELECT ${COLUMNS} FROM audit_log a ${f.sql} ORDER BY a.at DESC, a.id DESC LIMIT $${f.params.length + 1}`, [...f.params, max]);
  return toEvents(rows, { viewer });
}

/** Filter choices of Master > Audit Trail: record types and actions found in the log (labelled), and the users. */
export async function logOptions() {
  const entities = await many('SELECT entity, count(*)::int AS n FROM audit_log GROUP BY entity ORDER BY entity');
  const types = await many('SELECT code, label FROM master_types').catch(() => []);
  const masterLabels = Object.fromEntries(types.map((t) => [t.code, t.label]));
  const recordTypes = [];
  let masters = 0;
  for (const e of entities) {
    if (e.entity.startsWith('master:')) masters += e.n;
    recordTypes.push({ value: e.entity, label: entityLabel(e.entity, masterLabels), count: e.n });
  }
  recordTypes.sort((a, b) => a.label.localeCompare(b.label));
  const actions = await many('SELECT DISTINCT action FROM audit_log ORDER BY action');
  const actionOptions = actions.map((a) => ({ value: a.action, label: actionText(a.action) })).sort((a, b) => a.label.localeCompare(b.label));
  const users = await many(`SELECT DISTINCT a.username AS value, COALESCE(u.display_name, a.username) AS label FROM audit_log a
    LEFT JOIN users u ON u.username = a.username WHERE a.username IS NOT NULL AND a.username NOT LIKE 'customer:%' ORDER BY label`);
  return { recordTypes, actions: actionOptions, users, masterRecords: masters };
}
