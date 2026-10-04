/**
 * Shared helpers of the Insurance Commission compliance screens (Compliance > Insurance Commission): dates, attached
 * documents, option lists from the settings, users for the assignment pickers and Excel downloads.
 */
import { z } from '../../lib/validate.js';
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { publicUrl, safeKey } from '../uploads/storage.js';
import { writeXlsx } from '../../lib/xlsx.js';

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD');
export const optDate = dateStr.optional().nullable().or(z.literal('').transform(() => null));
export const optText = (max = 500) => z.string().trim().max(max).optional().nullable();

/** Documents attached to a register entry: files uploaded through /s3/upload, kept as { key, name, uploadedAt, uploadedBy }. */
export const documentsSchema = z.array(z.object({
  key: z.string().trim().min(1).max(400), name: z.string().trim().max(255).optional().nullable(), url: z.string().max(2000).optional().nullable(),
  uploadedAt: z.string().max(40).optional().nullable(), uploadedBy: z.string().max(120).optional().nullable(),
}).passthrough()).max(30);

/** Normalise the documents of a request (keys made safe, the canonical URL rebuilt, the uploader stamped). */
export function documentsIn(list, user) {
  if (!Array.isArray(list)) return [];
  return list.map((d) => {
    const key = safeKey(d.key);
    return { key, name: d.name || key.split('/').pop(), url: publicUrl(key), uploadedAt: d.uploadedAt || new Date().toISOString(), uploadedBy: d.uploadedBy || user?.username || null };
  });
}

/** YYYY-MM-DD of a date column (the pool returns DATE as text) or a timestamp. */
export const iso = (v) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
/** Whole days from a to b (YYYY-MM-DD). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** A list setting (array of strings), with the default when it is missing or malformed. */
export async function listSetting(key, fallback) {
  const v = await getSetting(key, fallback);
  return Array.isArray(v) && v.length ? v.map(String) : fallback;
}

/** Active users holding one of the permissions (administrators included), for assignment pickers: [{ id, name, username }]. */
export async function usersWithPermission(...perms) {
  return many(`SELECT DISTINCT u.id, COALESCE(u.display_name, u.username) AS name, u.username FROM users u
      CROSS JOIN LATERAL user_effective_roles(u.id) er
      LEFT JOIN role_permissions rp ON rp.role_id = er.role_id LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE u.status = 'active' AND (er.code = 'system-admin' OR p.code = ANY($1::text[]))
     ORDER BY 2`, [perms]);
}

/** Answer an Excel workbook as a download. */
export function sendXlsx(res, fileName, sheets, title = '') {
  const buf = writeXlsx({ sheets, title });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buf);
}

/** Add one step to the history of a register entry (kept in its `actions` JSON). */
export const historyEntry = (action, user, extra = {}) => ({ at: new Date().toISOString(), action, by: user?.username || user?.id || 'system', ...extra });
