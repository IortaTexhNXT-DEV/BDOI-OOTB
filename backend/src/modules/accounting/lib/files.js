/** Generated files (CSV here; PDFs come from lib/pdf) stored through the uploads area (documents table + disk). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../../config.js';

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV text from [{key, label}] columns and row objects. */
export const toCsv = (columns, rows) => [columns.map((c) => csvCell(c.label)).join(','),
  ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','))].join('\r\n');

/** Persist a generated file under the uploads directory and register it in documents; returns { key, url, fileName }. */
export async function storeFile(db, { category = 'generated', fileName, contentType, buffer, entity = null, entityId = null, userId = null }) {
  const key = `${category}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const full = path.join(config.uploadDir, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  await db.query(`INSERT INTO documents(storage_key, file_name, content_type, size_bytes, category, entity, entity_id, uploaded_by, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')`, [key, fileName, contentType, buffer.length, category, entity, entityId, userId]);
  return { key, url: `${config.publicBaseUrl}/api/s3/object/${key}`, fileName };
}
