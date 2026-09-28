import { many, one, query } from '../db/pool.js';
/** Configuration-driven behaviour: every business parameter is read from app_settings, never hard-coded. */
const cache = new Map();
export async function getSetting(key, fallback = null) {
  if (cache.has(key)) return cache.get(key);
  const row = await one('SELECT value FROM app_settings WHERE key = $1', [key]);
  const v = row ? row.value : fallback;
  cache.set(key, v);
  return v;
}
export async function getSettings(group) {
  const rows = await many(group ? 'SELECT key, value, "group", label, type FROM app_settings WHERE "group" = $1 ORDER BY key' : 'SELECT key, value, "group", label, type FROM app_settings ORDER BY "group", key', group ? [group] : []);
  return rows;
}
export async function setSetting(key, value, userId = null) {
  const r = await query('UPDATE app_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1', [key, JSON.stringify(value), userId]);
  if (!r.rowCount) throw new Error(`Unknown setting ${key}`);
  cache.delete(key);
}
export const clearSettingsCache = () => cache.clear();
