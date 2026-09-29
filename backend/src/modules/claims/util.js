/** Small helpers shared by the claims and renewals modules. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { getSetting } from '../../lib/settings.js';
import { HttpError } from '../../lib/errors.js';
import { many, query } from '../../db/pool.js';
import { detectType } from '../uploads/fileTypes.js';

export const unprocessable = (message, details) => new HttpError(422, message, details);

/** Parse a JSON string field sent through multipart/form-data (objects pass through). */
export function parseJsonField(v, fallback = {}) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

export const toBool = (v) => v === true || v === 'true' || v === '1' || v === 1;
export const toNum = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Normalise a date input (YYYY-MM-DD or ISO timestamp) to YYYY-MM-DD in the configured time zone. */
export async function toDate(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const tz = await getSetting('general.timezone', 'Asia/Manila');
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch { return d.toISOString().slice(0, 10); }
}
export const today = () => toDate(new Date().toISOString());
export const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

/** Next document number, e.g. CLM-2026-00001; retries if the number already exists in the target table. */
export async function nextNumber(seq, prefixKey, fallbackPrefix, { table, column } = {}) {
  const prefix = await getSetting(prefixKey, fallbackPrefix);
  for (let i = 0; i < 20; i += 1) {
    const n = (await query('SELECT next_number($1, $2) AS n', [seq, prefix])).rows[0].n;
    if (!table) return n;
    const exists = (await query(`SELECT 1 FROM ${table} WHERE ${column} = $1`, [n])).rowCount;
    if (!exists) return n;
  }
  throw new HttpError(500, `Could not allocate a ${seq} number`);
}

/** Store an uploaded (multer memory) file on disk and register it in documents. */
export async function storeUpload(file, { category, entity, entityId, userId }) {
  const key = `${entity}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const full = path.join(config.uploadDir, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, file.buffer);
  await query(`INSERT INTO documents(storage_key, file_name, content_type, size_bytes, category, entity, entity_id, uploaded_by, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')`, [key, file.originalname || category, file.detectedType || detectType(file.buffer, file.originalname) || 'application/octet-stream', file.size ?? file.buffer.length, category, entity, entityId, userId]);
  return key;
}

/** Active users holding a role code. */
export const usersWithRole = (role) => many(`SELECT u.id, u.display_name, u.email FROM users u JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id WHERE r.code = $1 AND u.status = 'active' ORDER BY u.created_at`, [role]);
