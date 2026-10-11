/**
 * Go-live lock (setting golive.locked, Data Migration & Go-Live > Go-Live). It is switched on by two users (a lock
 * request approved by a second user, data-load/golive.js) once the migration is reconciled and the Go decision taken.
 * From then on every migration import is refused: the migration workbook (upload, validation, approval, load), the undo
 * of a load, the policies go-live upload and the rows of the ordinary policy upload dated before the cutover, the open
 * items import and the opening balances import. The transaction reset (scripts/reset-transactions.js) refuses to run:
 * the database holds the live book.
 *
 * An approved unlock lifts the lock for the imports it names (scope) until its expires_at; the lock itself stays on, so
 * the reset and the undo stay refused during an unlock.
 *
 * The scripts import this file outside the API: the pool and the audit trail are loaded only when the API uses them.
 */
import { conflict } from './errors.js';
import { formatDate } from './pdf/format.js';

export const GO_LIVE_LOCK_KEY = 'golive.locked';

/** Imports an unlock may reopen, with their names on screen. */
export const IMPORT_SCOPES = {
  migration: 'Migration workbook',
  'policies-go-live': 'Policies go-live upload',
  'opening-items': 'Open items import',
  'opening-balances': 'Opening balances import',
};

/** True when the go-live lock is on (read directly, not from the settings cache: scripts run outside the API). */
export async function isGoLiveLocked(db) {
  const r = await db.query('SELECT value FROM app_settings WHERE key = $1', [GO_LIVE_LOCK_KEY]);
  const v = r.rows[0]?.value;
  return v === true || v === 'true';
}

/**
 * State of the lock: { locked, lockedAt, lockedBy (lock request id), unlock: the unlock in force { id, scope, expiresAt }
 * or null }. Read from the database, never from the settings cache.
 */
export async function lockState(db = null) {
  db ||= (await import('../db/pool.js')).pool;
  const rows = (await db.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [[GO_LIVE_LOCK_KEY, 'golive.locked_at', 'golive.locked_by']])).rows;
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const locked = v[GO_LIVE_LOCK_KEY] === true || v[GO_LIVE_LOCK_KEY] === 'true';
  const unlock = locked ? (await db.query(`SELECT id, scope, expires_at FROM go_live_lock_requests
    WHERE action = 'unlock' AND status = 'approved' AND relocked_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 1`).catch(() => ({ rows: [] }))).rows[0] : null;
  return {
    locked, lockedAt: locked ? v['golive.locked_at'] || null : null, lockedBy: locked ? v['golive.locked_by'] || null : null,
    unlock: unlock ? { id: Number(unlock.id), scope: unlock.scope, expiresAt: unlock.expires_at } : null,
  };
}

const lockedOn = (state) => (state.lockedAt ? ` (locked on ${formatDate(state.lockedAt)})` : '');

/**
 * Refuse a migration import once go-live is locked (409). kind: an import of IMPORT_SCOPES (open again while an unlock
 * names it), 'undo' (a load is never undone after the lock) or 'reset'. req: the request refused, recorded in the
 * audit trail (go_live_lock refused-locked).
 */
export async function assertMigrationOpen(kind, { db = null, req = null } = {}) {
  const state = await lockState(db);
  if (!state.locked) return state;
  if (IMPORT_SCOPES[kind] && state.unlock?.scope.includes(kind)) return state;
  if (req) await (await import('./audit.js')).audit(req, { entity: 'go_live_lock', entityId: kind, action: 'refused-locked', after: { import: IMPORT_SCOPES[kind] || kind, lockedAt: state.lockedAt } });
  if (kind === 'undo') throw conflict(`Go-live is locked: a migration load can no longer be undone${lockedOn(state)}; correct the records on their screens`);
  throw conflict(`Go-live is locked: migration imports are closed${lockedOn(state)}`);
}

/** Route middleware of a single-object go-live import: 409 once go-live is locked (unless an unlock reopens it). */
export const migrationImportOpen = (kind) => (req, _res, next) => assertMigrationOpen(kind, { req }).then(() => next(), next);
