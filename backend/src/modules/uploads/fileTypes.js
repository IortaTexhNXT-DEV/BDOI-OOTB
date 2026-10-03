/**
 * Upload type checks. The content type of a stored file is decided by its signature ("magic bytes") and file
 * extension, never by the type the browser claims; only types in the setting uploads.allowed_types are accepted.
 * Text formats (CSV, plain text) have no signature: they are accepted by extension when the content is text and does
 * not look like HTML, XML or script.
 */
import { HttpError } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';

export const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
];

/** Types a browser may display inline (in an img tag or its PDF viewer); every other type is sent as an attachment. */
export const INLINE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'application/pdf'];

const ext = (name) => (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const starts = (buf, bytes, offset = 0) => buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf, text, offset = 0) => buf.length >= offset + text.length && buf.toString('latin1', offset, offset + text.length) === text;

/** Is the start of the buffer UTF-8 text (no NUL bytes, decodes cleanly)? */
function looksLikeText(buf) {
  const head = buf.subarray(0, 8192);
  if (head.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head.length === buf.length ? head : head.subarray(0, Math.max(0, head.length - 4)));
    return true;
  } catch {
    return false;
  }
}
const MARKUP = /<\s*(!doctype|html|head|body|script|iframe|object|embed|svg|\?xml|meta|link|style)\b/i;

/**
 * Detect the content type from the bytes (and the extension for container formats). Returns a MIME type or null
 * when the format is not recognised.
 */
export function detectType(buffer, fileName = '') {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!buf.length) return null;
  const e = ext(fileName);
  if (starts(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(buf, 'GIF87a') || ascii(buf, 'GIF89a')) return 'image/gif';
  if (ascii(buf, 'RIFF') && ascii(buf, 'WEBP', 8)) return 'image/webp';
  if (ascii(buf, 'BM') && e === 'bmp') return 'image/bmp';
  if (starts(buf, [0x00, 0x00, 0x01, 0x00]) && e === 'ico') return 'image/x-icon';
  if (ascii(buf, 'ftyp', 4) && /^(heic|heix|mif1)$/.test(buf.toString('latin1', 8, 12))) return 'image/heic';
  if (ascii(buf, '%PDF-')) return 'application/pdf';
  if (starts(buf, [0x50, 0x4b, 0x03, 0x04])) {
    if (e === 'xlsx' || e === 'xlsm') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (e === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (e === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'application/zip';
  }
  if (starts(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (e === 'xls') return 'application/vnd.ms-excel';
    if (e === 'doc') return 'application/msword';
    return 'application/x-ole-storage';
  }
  if (looksLikeText(buf)) {
    const text = buf.toString('utf8', 0, Math.min(buf.length, 8192));
    if (e === 'svg' && /<svg[\s>]/i.test(text)) return 'image/svg+xml';
    if (MARKUP.test(text)) return 'text/html';
    if (e === 'csv') return 'text/csv';
    if (e === 'txt' || e === 'log') return 'text/plain';
    return 'text/plain';
  }
  return null;
}

export async function allowedTypes() {
  const v = await getSetting('uploads.allowed_types', DEFAULT_ALLOWED_TYPES);
  return Array.isArray(v) && v.length ? v : DEFAULT_ALLOWED_TYPES;
}

/**
 * Check an uploaded file against the allow-list (default: uploads.allowed_types) and return its detected type.
 * Throws 415 when the type is not recognised or not allowed.
 */
export async function assertAllowedFile(buffer, fileName, { allowed = null } = {}) {
  const list = allowed || await allowedTypes();
  const type = detectType(buffer, fileName);
  if (!type || !list.includes(type)) {
    const label = type ? `${type} files` : 'This file type';
    throw new HttpError(415, `${label} cannot be uploaded (${String(fileName || 'file').slice(0, 80)}). Allowed: ${list.map((t) => t.split('/').pop()).join(', ')}`);
  }
  return type;
}

/**
 * Middleware after multer: check every uploaded file (req.file / req.files) against the allow-list before the handler
 * runs, and record the detected type on the file (file.detectedType).
 */
export async function checkUploadedFiles(req, _res, next) {
  try {
    const files = [...(req.file ? [req.file] : []), ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())];
    if (files.length) {
      const allowed = await allowedTypes();
      for (const f of files) f.detectedType = await assertAllowedFile(f.buffer, f.originalname, { allowed });
    }
    next();
  } catch (e) {
    next(e);
  }
}
