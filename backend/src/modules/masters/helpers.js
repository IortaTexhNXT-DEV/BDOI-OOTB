/**
 * Helpers shared by the configuration, masters, product configurator, remittance, reinsurance and incentive modules.
 */
import { one } from '../../db/pool.js';
import { publicUrl, reserveKey, writeObject } from '../uploads/storage.js';

export { publicUrl as fileUrl };
import { getSetting } from '../../lib/settings.js';
import { forbidden } from '../../lib/errors.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { ok, pageMeta } from '../../lib/respond.js';

/** Middleware chains: authenticated + read / write permission on a module (admin roles always pass). */
export const canRead = (module, ...alt) => [requireAuth, requirePermission(`read:${module}`, `write:${module}`, ...alt)];
export const canWrite = (module, ...alt) => [requireAuth, requirePermission(`write:${module}`, ...alt)];

/** Number coercion that tolerates formatted input ("1,250.50"). */
export function toNumber(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}
export { round2 } from '../../lib/money.js';

/** YYYY-MM-DD from a Date, ISO string or date string; null when empty or invalid. */
export function isoDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export const asBool = (v) => v === true || v === 1 || ['true', '1', 'yes', 'active', 'y'].includes(String(v).toLowerCase());

/** 'active' | 'inactive' from the many ways the front end expresses a status; undefined when absent. */
export function parseStatus(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean' || typeof v === 'number') return v ? 'active' : 'inactive';
  const s = String(v).toLowerCase();
  if (['active', 'true', '1', 'enabled', 'yes'].includes(s)) return 'active';
  if (['inactive', 'false', '0', 'disabled', 'no'].includes(s)) return 'inactive';
  return undefined;
}
export const statusLabel = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Next document number; the prefix is read from app_settings numbering.<entity>.prefix. */
export async function nextNumber(entity) {
  const prefix = await getSetting(`numbering.${entity}.prefix`, entity.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4));
  return (await one('SELECT next_number($1, $2) AS n', [entity, prefix])).n;
}

/** Maker-checker: the person approving must not be the person who created / submitted the record. */
export function assertChecker(req, makerId, what = 'record') {
  if (makerId && req.user?.id === makerId) throw forbidden(`Maker-checker: you cannot approve a ${what} you created or submitted`);
}

/** List envelope used by the paged endpoints of these modules. */
export const sendList = (res, rows, total, pg, extra = {}) => ok(res, rows, 'OK', { ...pageMeta(total, pg), ...extra });

/** Simple parameter collector for dynamic SQL: add(value) returns the $n placeholder. */
export function params(initial = []) {
  const values = [...initial];
  return { values, add: (v) => { values.push(v); return `$${values.length}`; } };
}

/** CSV text from rows and [{key,label}] columns. */
export function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))].join('\n');
}

/** Store a generated or uploaded file through the shared storage (UPLOAD_DIR + documents); returns its public URL. */
export async function saveFile({ category, fileName, content, contentType, entity = null, entityId = null, userId = null }) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  const key = await reserveKey({ folder: category, fileName: fileName || 'file', contentType, userId, entity, entityId });
  await writeObject(key, buffer, contentType);
  return { key, url: publicUrl(key), fileName, size: buffer.length };
}

/** Human-readable size (1.2 MB). */
export function fileSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Month bucket helper: the last n months as { key: 'YYYY-MM', label: 'Jan' }. */
export function lastMonths(n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1));
    out.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) });
  }
  return out;
}
