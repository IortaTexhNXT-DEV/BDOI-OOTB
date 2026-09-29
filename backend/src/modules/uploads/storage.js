/** Local-disk object storage with an S3-like key space (folder/uuid-name). Swap for S3 by replacing these functions. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { one, query } from '../../db/pool.js';
import { signFileQuery } from '../../lib/secrets.js';
import { assertAllowedFile } from './fileTypes.js';

const root = () => path.resolve(config.uploadDir);
export const safeSegment = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 120);
export const safeKey = (k) => String(k || '').split('/').map(safeSegment).filter(Boolean).join('/');
/** Canonical (unsigned) object URL: what is stored in records. API responses carry it signed (see lib/fileLinks.js). */
export const publicUrl = (key) => `${config.publicBaseUrl}/api/s3/object/${key}`;
/** Signed, expiring object URL (usable in img tags and new tabs without a bearer header). */
export const signedUrl = (key) => `${publicUrl(safeKey(key))}?${signFileQuery(safeKey(key))}`;

export function resolveKey(key) {
  const p = path.resolve(root(), safeKey(key));
  if (!p.startsWith(root() + path.sep)) throw new Error('Invalid key');
  return p;
}

/** Random part of new keys: 128 bits, so keys cannot be guessed. */
const nonce = () => crypto.randomBytes(16).toString('hex');

/** Reserve a key (and a documents row) for a file that will be written later. */
export async function reserveKey({ folder = 'uploads', fileName = 'file', contentType = null, userId = null, entity = null, entityId = null }) {
  const key = `${safeSegment(folder) || 'uploads'}/${Date.now()}-${nonce()}-${safeSegment(fileName)}`;
  await query('INSERT INTO documents(storage_key, file_name, content_type, category, entity, entity_id, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [key, fileName, contentType, folder, entity, entityId == null ? null : String(entityId), userId]);
  return key;
}

export async function writeObject(key, buffer, contentType) {
  const p = resolveKey(key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buffer);
  await query('UPDATE documents SET status = \'uploaded\', size_bytes = $2, content_type = COALESCE($3, content_type) WHERE storage_key = $1', [key, buffer.length, contentType || null]);
}

/**
 * Store a file uploaded by a user (multer memory file) and return { url, key }. The type is checked against the
 * allow-list by its signature; the detected type (not the browser's claim) is stored.
 */
export async function storeFile(file, { folder, userId, entity, entityId } = {}) {
  const contentType = await assertAllowedFile(file.buffer, file.originalname);
  const key = await reserveKey({ folder, fileName: file.originalname, contentType, userId, entity, entityId });
  await writeObject(key, file.buffer, contentType);
  return { url: publicUrl(key), key, fileName: file.originalname, size: file.size, contentType };
}

export const objectExists = (key) => { try { return fs.existsSync(resolveKey(key)); } catch { return false; } };
export const findDocument = (key) => one('SELECT * FROM documents WHERE storage_key = $1', [safeKey(key)]);

export async function deleteObject(key) {
  const p = resolveKey(key);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  await query('DELETE FROM documents WHERE storage_key = $1', [safeKey(key)]);
}

/** Accept a stored URL or a bare key and return the key. */
export function keyFromUrlOrKey(v) {
  const s = String(v || '');
  const i = s.indexOf('/api/s3/object/');
  if (i >= 0) return safeKey(decodeURIComponent(s.slice(i + '/api/s3/object/'.length).split('?')[0]));
  const j = s.indexOf('/api/upload/file/');
  if (j >= 0) return safeKey(decodeURIComponent(s.slice(j + '/api/upload/file/'.length).split('?')[0]));
  return safeKey(s.split('?')[0]);
}
