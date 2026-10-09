/** Small helpers shared by the claims and renewals modules. */
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../lib/errors.js';
import { many, query } from '../../db/pool.js';
import { ADMIN_ROLES } from '../../lib/auth.js';
import { detectType } from '../uploads/fileTypes.js';
import { newKey, resolveKey } from '../uploads/storage.js';

export const unprocessable = (message, details) => new HttpError(422, message, details);

/** Parse a JSON string field sent through multipart/form-data (objects pass through). */
export function parseJsonField(v, fallback = {}) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

export const toBool = (v) => v === true || v === 'true' || v === '1' || v === 1;
export const toNum = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
export { round2 } from '../../lib/money.js';
export { today } from '../../lib/dates.js';

export const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

/** Store an uploaded (multer memory) file on disk and register it in documents. */
export async function storeUpload(file, { category, entity, entityId, userId }) {
  const key = newKey(entity, file.originalname || category);
  const full = resolveKey(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, file.buffer);
  await query(`INSERT INTO documents(storage_key, file_name, content_type, size_bytes, category, entity, entity_id, uploaded_by, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')`, [key, file.originalname || category, file.detectedType || detectType(file.buffer, file.originalname) || 'application/octet-stream', file.size ?? file.buffer.length, category, entity, entityId, userId]);
  return key;
}

/** Active users holding a role code. */
export const usersWithRole = (role) => many(`SELECT u.id, u.display_name, u.email FROM users u JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id WHERE r.code = $1 AND u.status = 'active' ORDER BY u.created_at`, [role]);
/** Active users holding a permission through their roles (inherited roles included), System Administrators left out. */
export const usersWithPermission = (permission) => many(`SELECT u.id, u.display_name, u.email FROM users u WHERE u.status = 'active'
  AND EXISTS (SELECT 1 FROM user_effective_roles(u.id) er JOIN role_permissions rp ON rp.role_id = er.role_id JOIN permissions p ON p.id = rp.permission_id WHERE p.code = $1)
  AND NOT EXISTS (SELECT 1 FROM user_effective_roles(u.id) er WHERE er.code = ANY($2)) ORDER BY u.created_at`, [permission, ADMIN_ROLES]);
