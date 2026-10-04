import { inTransaction, many, one, query } from '../db/pool.js';
/**
 * Configuration-driven behaviour: every business parameter is read from app_settings, never hard-coded.
 *
 * Values are cached per API instance. So that a change saved through one instance reaches the others without a
 * restart, the cache is checked against the table's version (row count + latest updated_at) at most every
 * SETTINGS_CHECK_MS (default 5 s) and dropped when it moved; every entry also expires after SETTINGS_CACHE_TTL_MS
 * (default 60 s) as a safety net for changes made outside the API. The check is one index-free aggregate over a small
 * table, run only when a setting is read.
 */
const cache = new Map();
const envMs = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};
const state = { version: null, checkedAt: 0, pending: null };

/** Version of app_settings: changes on every insert, update or delete. */
async function tableVersion() {
  const r = await one('SELECT count(*)::int AS n, max(updated_at) AS at FROM app_settings');
  return `${r.n}|${r.at ? new Date(r.at).toISOString() : ''}`;
}

/** Drop the cache when app_settings changed since the last check (at most one check per SETTINGS_CHECK_MS). */
export async function refreshSettingsCache({ force = false, now = Date.now() } = {}) {
  if (!force && now - state.checkedAt < envMs('SETTINGS_CHECK_MS', 5000)) return false;
  if (state.pending) return state.pending;
  state.pending = (async () => {
    try {
      const v = await tableVersion();
      state.checkedAt = Date.now();
      const changed = state.version !== null && v !== state.version;
      if (changed || state.version === null) cache.clear();
      state.version = v;
      return changed;
    } finally {
      state.pending = null;
    }
  })();
  return state.pending;
}

export async function getSetting(key, fallback = null) {
  // Inside an ambient transaction (go-live workbench dry run or load) the value is read from the transaction, never
  // from or into the cache: a value changed there may still be rolled back.
  if (inTransaction()) {
    const row = await one('SELECT value FROM app_settings WHERE key = $1', [key]);
    return row ? row.value : fallback;
  }
  await refreshSettingsCache();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < envMs('SETTINGS_CACHE_TTL_MS', 60000)) return hit.value;
  const row = await one('SELECT value FROM app_settings WHERE key = $1', [key]);
  const v = row ? row.value : fallback;
  cache.set(key, { value: v, at: Date.now() });
  return v;
}
/** Settings with who changed them last (display name when the editor is a user) and whether they can be edited on screen. */
export async function getSettings(group) {
  const rows = await many(`SELECT s.key, s.value, s."group", s.label, s.type, s.editable, s.updated_at AS "updatedAt", COALESCE(u.display_name, s.updated_by) AS "updatedBy"
    FROM app_settings s LEFT JOIN users u ON u.id = s.updated_by
    ${group ? 'WHERE s."group" = $1' : ''} ORDER BY s."group", s.key`, group ? [group] : []);
  return rows;
}
export async function setSetting(key, value, userId = null) {
  const r = await query('UPDATE app_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1', [key, JSON.stringify(value), userId]);
  if (!r.rowCount) throw new Error(`Unknown setting ${key}`);
  cache.delete(key);
}
export const clearSettingsCache = () => { cache.clear(); state.version = null; state.checkedAt = 0; };
