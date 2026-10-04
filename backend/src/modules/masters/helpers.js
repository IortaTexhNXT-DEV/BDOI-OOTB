/**
 * Helpers shared by the configuration, masters, product configurator, remittance, reinsurance and incentive modules.
 */
import { publicUrl, reserveKey, writeObject } from '../uploads/storage.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { ok, pageMeta } from '../../lib/respond.js';
import { csvCell } from '../../lib/csv.js';

export { publicUrl as fileUrl };

/** Middleware chains: authenticated + read / write permission on a module (admin roles always pass). */
export const canRead = (module, ...alt) => [requireAuth, requirePermission(`read:${module}`, `write:${module}`, ...alt)];
export const canWrite = (module, ...alt) => [requireAuth, requirePermission(`write:${module}`, ...alt)];

export { round2, toNumber } from '../../lib/money.js';
export { isoDate } from '../../lib/dates.js';
export { assertChecker } from '../../lib/makerChecker.js';

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

/** List envelope used by the paged endpoints of these modules. */
export const sendList = (res, rows, total, pg, extra = {}) => ok(res, rows, 'OK', { ...pageMeta(total, pg), ...extra });

/** Simple parameter collector for dynamic SQL: add(value) returns the $n placeholder. */
export function params(initial = []) {
  const values = [...initial];
  return { values, add: (v) => { values.push(v); return `$${values.length}`; } };
}

/** CSV text from rows and [{key,label}] columns. */
export function toCsv(rows, columns) {
  return [columns.map((c) => csvCell(c.label)).join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','))].join('\n');
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
