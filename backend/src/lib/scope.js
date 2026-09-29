/**
 * Record-level data scoping ("a scoped role sees only its own book").
 *
 * A user is scoped when every role they hold is listed in the setting security.scoped_roles (default: none).
 * A scoped user only sees and acts on records they own (owner_user_id / agent_user_id / created_by, whichever the
 * table uses) or records that belong to clients they own. Everyone else is unaffected.
 *
 * Usage:
 *  - lists / stats: `svc.list({ ...req.query, [SCOPE]: await scopeOf(req) })`, and in the WHERE builder
 *    `if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'lead', 'l', params))`.
 *  - detail / update / workflow: `ownRecord('lead')` middleware answers 404 for someone else's record
 *    (404 rather than 403, so the existence of the record is not disclosed).
 */
import { query } from '../db/pool.js';
import { notFound } from './errors.js';
import { getSetting } from './settings.js';

/** Key under which the scope travels inside a service query object (a Symbol, so it can never come from the query string). */
export const SCOPE = Symbol('record-scope');

/** Roles whose holders only see their own book (setting security.scoped_roles). */
export async function scopedRoles() {
  const v = await getSetting('security.scoped_roles', []);
  return Array.isArray(v) ? v : [];
}

/** True when every role the user holds is a scoped role (a user without roles is not scoped; they are refused by permissions). */
export async function isScoped(user) {
  const roles = user?.roles || [];
  if (!roles.length) return false;
  const scoped = await scopedRoles();
  return roles.every((r) => scoped.includes(r));
}

/** The request's scope: null (sees everything) or { userId, ids } where ids are the values the owner columns may hold. Cached on req. */
export async function scopeOf(req) {
  if (!req.user) return null;
  if (req.recordScope !== undefined) return req.recordScope;
  req.recordScope = (await isScoped(req.user)) ? { userId: req.user.id, ids: [req.user.id, req.user.username].filter(Boolean) } : null;
  return req.recordScope;
}

/** Query object for a service call: the incoming query plus the scope under the SCOPE symbol. */
export const withScope = async (req, q = req.query) => ({ ...q, [SCOPE]: await scopeOf(req) });

// Ownership predicates. `$P` is replaced with the placeholder of a text[] parameter holding the user's id and username.
const OWNED_CLIENTS = 'SELECT sc.id FROM clients sc WHERE sc.owner_user_id = ANY($P) OR sc.created_by = ANY($P)';
const OWNED_LEADS = 'SELECT sl.id FROM leads sl WHERE sl.owner_user_id = ANY($P) OR sl.created_by = ANY($P)';
const OWNED_POLICIES = `SELECT sp.id FROM policies sp WHERE sp.owner_user_id = ANY($P) OR sp.created_by = ANY($P) OR sp.client_id IN (${OWNED_CLIENTS})`;
const OWNED_REFERRERS = 'SELECT sr.id FROM commission_referrers sr WHERE sr.user_id = ANY($P)';

const PREDICATES = {
  lead: (a) => `(${a}.owner_user_id = ANY($P) OR ${a}.created_by = ANY($P) OR ${a}.client_id IN (${OWNED_CLIENTS}))`,
  client: (a) => `(${a}.owner_user_id = ANY($P) OR ${a}.created_by = ANY($P))`,
  quote: (a) => `(${a}.agent_user_id = ANY($P) OR ${a}.created_by = ANY($P) OR ${a}.client_id IN (${OWNED_CLIENTS}) OR ${a}.lead_id IN (${OWNED_LEADS}))`,
  policy: (a) => `(${a}.owner_user_id = ANY($P) OR ${a}.created_by = ANY($P) OR ${a}.client_id IN (${OWNED_CLIENTS}))`,
  endorsement: (a) => `(${a}.created_by = ANY($P) OR ${a}.policy_id IN (${OWNED_POLICIES}) OR ${a}.client_id IN (${OWNED_CLIENTS}))`,
  claim: (a) => `(${a}.created_by = ANY($P) OR ${a}.policy_id IN (${OWNED_POLICIES}) OR ${a}.client_id IN (${OWNED_CLIENTS}))`,
  renewal: (a) => `(${a}.owner_user_id = ANY($P) OR ${a}.created_by = ANY($P) OR ${a}.policy_id IN (${OWNED_POLICIES}))`,
  receipt: (a) => `(${a}.created_by = ANY($P))`,
  commission: (a) => `(${a}.agent_user_id = ANY($P) OR ${a}.referrer_id IN (${OWNED_REFERRERS}))`,
  referrer: (a) => `(${a}.user_id = ANY($P))`,
  broker_slip: (a) => `(${a}.owner_user_id = ANY($P) OR ${a}.created_by = ANY($P) OR ${a}.client_id IN (${OWNED_CLIENTS}) OR ${a}.lead_id IN (${OWNED_LEADS}))`,
  placement: (a) => `(${a}.owner_user_id = ANY($P) OR ${a}.created_by = ANY($P) OR ${a}.client_id IN (${OWNED_CLIENTS}) OR ${a}.lead_id IN (${OWNED_LEADS}))`,
};

/** Tables and lookup keys (id or document number) for ownRecord / canSee. */
export const ENTITIES = {
  lead: { table: 'leads', keys: ['id', 'lead_number'], label: 'Lead' },
  client: { table: 'clients', keys: ['id', 'client_code'], label: 'Client' },
  quote: { table: 'quotes', keys: ['id', 'quote_number'], label: 'Quotation' },
  policy: { table: 'policies', keys: ['id', 'policy_number'], label: 'Policy' },
  endorsement: { table: 'endorsements', keys: ['id', 'endorsement_number'], label: 'Endorsement' },
  claim: { table: 'claims', keys: ['id', 'claim_number'], label: 'Claim' },
  renewal: { table: 'renewals', keys: ['id', 'renewal_number'], label: 'Renewal' },
  receipt: { table: 'receipts', keys: ['id', 'receipt_number'], label: 'Receipt' },
  referrer: { table: 'commission_referrers', keys: ['id'], label: 'Referrer' },
  broker_slip: { table: 'broker_slips', keys: ['id', 'slip_number'], label: 'Broker slip' },
  placement: { table: 'placements', keys: ['id', 'placement_number'], label: 'Placement slip' },
};

/**
 * SQL predicate restricting `alias` (a row of `entity`) to the scope; pushes one parameter onto `params`.
 * Returns 'TRUE' (and pushes nothing) when scope is null.
 */
export function scopeSql(scope, entity, alias, params) {
  if (!scope) return 'TRUE';
  const pred = PREDICATES[entity];
  if (!pred) throw new Error(`No scope predicate for ${entity}`);
  params.push(scope.ids);
  return pred(alias).replaceAll('$P', `$${params.length}::text[]`);
}

/** True when the record (by id or document number) exists and is visible to the scope. */
export async function canSee(scope, entity, ref) {
  const e = ENTITIES[entity];
  const params = [String(ref)];
  const where = `(${e.keys.map((k) => `x.${k}::text = $1`).join(' OR ')})`;
  const pred = scopeSql(scope, entity, 'x', params);
  const r = await query(`SELECT 1 FROM ${e.table} x WHERE ${where} AND ${pred} LIMIT 1`, params);
  return r.rowCount > 0;
}

/** Throw 404 when a scoped user refers to a record they do not own (no-op for unscoped users or an empty reference). */
export async function assertVisible(req, entity, ref) {
  const scope = await scopeOf(req);
  if (!scope || ref === undefined || ref === null || ref === '') return;
  if (!(await canSee(scope, entity, ref))) throw notFound(`${ENTITIES[entity].label} not found`);
}

/**
 * Middleware: 404 unless the record named by the request is visible to the user.
 * `from` is a route parameter name (default 'id') or a function (req) => reference.
 */
export const ownRecord = (entity, from = 'id') => (req, _res, next) => {
  const ref = typeof from === 'function' ? from(req) : req.params[from];
  assertVisible(req, entity, ref).then(() => next(), next);
};
