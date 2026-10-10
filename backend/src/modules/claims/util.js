/** Small helpers shared by the claims and renewals modules. */
import fs from 'node:fs';
import path from 'node:path';
import { HttpError, forbidden } from '../../lib/errors.js';
import { many, pool, query } from '../../db/pool.js';
import { ADMIN_ROLES } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { DEFAULT_FORMAT, formatDate } from '../../lib/pdf/format.js';
import { assertAuthority, effectiveAuthority } from '../access-control/service.js';
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

/** A date as the screens show it (general.date_format, dd/mm/yyyy for TISPH), for messages. */
export async function shownDate(iso) {
  return formatDate(iso, { ...DEFAULT_FORMAT, dateFormat: (await getSetting('general.date_format', DEFAULT_FORMAT.dateFormat)) || DEFAULT_FORMAT.dateFormat });
}

/**
 * Refuse an approval above the approver's Authority Matrix limit of `type`. With `requireLimit` (the module's
 * <module>.require_authority_limit setting) an approver without a limit of that type is refused whatever
 * access.authority_without_limit says; otherwise the access rule decides (assertAuthority).
 */
export async function assertApprovalLimit(user, type, amount, { requireLimit = false } = {}) {
  if (!requireLimit || !(await getSetting('access.authority_enforced', true))) return assertAuthority(pool, user, type, amount);
  const a = await effectiveAuthority(pool, user.id, type, null, { requireLimit: true });
  const label = (await many('SELECT name FROM authority_transaction_types WHERE code = $1', [type]))[0]?.name || type;
  const peso = (v) => `PHP ${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!a.found) throw forbidden(`You have no approval authority for ${label}. Ask an administrator to set a limit in the Authority Matrix.`);
  if (!a.unlimited && Number(amount) > a.limit) {
    throw forbidden(`${label} of ${peso(amount)} is above your approval authority of ${peso(a.limit)} (${a.source}). It needs an approver with a higher limit.`);
  }
  return a;
}
