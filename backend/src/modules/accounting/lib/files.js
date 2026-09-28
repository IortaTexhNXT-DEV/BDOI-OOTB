/** Generated documents: minimal text PDFs and CSVs, stored through the uploads area (documents table + disk). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../../config.js';

const pdfText = (s) => String(s ?? '').replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1');

/** Build a simple multi-page A4 PDF (Helvetica / Courier) from a title and an array of text lines. */
export function makePdf(title, lines, { perPage = 60 } = {}) {
  const pages = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += perPage) pages.push(lines.slice(i, i + perPage));
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalog = add(null);
  const pagesObj = add(null);
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const fontMono = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const kids = [];
  pages.forEach((pl, idx) => {
    const text = [`BT /F1 13 Tf 40 800 Td (${pdfText(title)}) Tj ET`,
      `BT /F2 8 Tf 40 780 Td 11 TL ${pl.map((l) => `(${pdfText(l)}) Tj T*`).join(' ')} ET`,
      `BT /F2 7 Tf 500 30 Td (Page ${idx + 1} of ${pages.length}) Tj ET`].join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontBold} 0 R /F2 ${fontMono} 0 R >> >> /Contents ${content} 0 R >>`));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV text from [{key, label}] columns and row objects. */
export const toCsv = (columns, rows) => [columns.map((c) => csvCell(c.label)).join(','),
  ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','))].join('\r\n');

/** Fixed-width text columns for PDF listings. */
export const padRow = (cells, widths) => cells.map((c, i) => String(c ?? '').slice(0, widths[i]).padEnd(widths[i])).join(' ');

/** Persist a generated file under the uploads directory and register it in documents; returns { key, url, fileName }. */
export async function storeFile(db, { category = 'generated', fileName, contentType, buffer, entity = null, entityId = null, userId = null }) {
  const key = `${category}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const full = path.join(config.uploadDir, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  await db.query(`INSERT INTO documents(storage_key, file_name, content_type, size_bytes, category, entity, entity_id, uploaded_by, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')`, [key, fileName, contentType, buffer.length, category, entity, entityId, userId]);
  return { key, url: `${config.publicBaseUrl}/api/upload/file/${key}`, fileName };
}
