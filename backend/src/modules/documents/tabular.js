/**
 * Tabular import / export shared by the bulk-upload and report endpoints: multipart upload (field "file"),
 * CSV and XLSX parsing into objects keyed by normalised header, and CSV / XLSX downloads.
 */
import { assertRowLimit, importUpload } from '../../lib/uploadLimits.js';
import { badRequest } from '../../lib/errors.js';
import { readXlsx, writeXlsx } from './xlsx.js';

export const uploadFile = importUpload().single('file');

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^\ufeff/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
      assertRowLimit(rows.length - 1);
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/** "First Name" / "first_name" / "FirstName" -> "firstname" */
export const normKey = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Parse req.file (CSV or XLSX) into [{ normalisedHeader: value }]. */
export function parseUploadedRows(file) {
  if (!file?.buffer?.length) throw badRequest('Upload a CSV or XLSX file in the "file" field');
  const name = (file.originalname || '').toLowerCase();
  const isZip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
  let table;
  try {
    table = isZip || name.endsWith('.xlsx') ? readXlsx(file.buffer) : parseCsv(file.buffer.toString('utf8'));
  } catch (e) {
    throw badRequest(`Could not read the file: ${e.message}`);
  }
  if (table.length < 2) throw badRequest('The file has no data rows (first row must be the column headers)');
  const header = table[0].map(normKey);
  return table.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, String(r[i] ?? '').trim()])));
}

/** Pick the first non-empty value among header aliases. */
export const pick = (row, ...aliases) => {
  for (const a of aliases) { const v = row[normKey(a)]; if (v !== undefined && v !== '') return v; }
  return undefined;
};

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Send a download as XLSX (default) or CSV. */
export function sendTable(res, { header, rows, fileBase, format = 'xlsx', sheetName }) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    return res.send(`\ufeff${toCsv(header, rows)}`);
  }
  const buf = writeXlsx(header, rows, sheetName);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xlsx"`);
  return res.send(buf);
}
