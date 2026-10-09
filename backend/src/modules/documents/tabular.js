/**
 * Tabular import / export shared by the bulk-upload and report endpoints: multipart upload (field "file"),
 * CSV and XLSX parsing into objects keyed by normalised header, and CSV / XLSX downloads.
 */
import { assertRowLimit, importUpload } from '../../lib/uploadLimits.js';
import { badRequest } from '../../lib/errors.js';
import { csvCell } from '../../lib/csv.js';
import { getSetting } from '../../lib/settings.js';
import { DEFAULT_FORMAT } from '../../lib/pdf/format.js';
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

/**
 * Upload column specification, shared by an importer and its template (scripts/build-upload-templates.js):
 * { key, header, aliases?, required?, format?, allowed?, example?, note? }. The importer reads a value from the
 * column named key, header or any alias (compared without case, spaces or punctuation); the template shows header.
 */
export const headerNames = (c) => [c.key, c.header, ...(c.aliases || [])];

/** Values of a parsed row by column specification: { key: value } for the columns present and not empty. */
export function mapColumns(row, columns, keyOf = normKey) {
  const out = {};
  for (const c of columns) {
    for (const name of headerNames(c)) {
      const v = row[keyOf(name)];
      if (v !== undefined && v !== '') { out[c.key] = v; break; }
    }
  }
  return out;
}

/**
 * Error text of an uploaded row with the field names of the API replaced by the column headers of the upload
 * ("emailId must be a valid e-mail" -> "Email must be a valid e-mail"); only camel-case names are replaced, so plain
 * words such as amount or source in a message stay as they are.
 */
export function columnMessage(text, columns) {
  return columns.filter((c) => /[A-Z]/.test(c.key) && c.key !== c.header)
    .reduce((s, c) => s.replace(new RegExp(`\\b${c.key}\\b`, 'g'), c.header), String(text ?? ''));
}

/** Validation issues of an uploaded row, each named by the column header of its field ("Account Name: Required"). */
export const issueText = (issues, columns) => issues.map((x) => {
  const column = columns.find((c) => c.key === x.path[0]);
  return `${column ? column.header : x.path.join('.')}: ${x.message}`;
}).join('; ');

/** Result of a row-by-row upload: "Processed n rows: c created, f failed", the counters and the failed rows ({ row, message }). */
export const uploadResult = (total, created, errors, extra = {}) => ({
  message: `Processed ${total} rows: ${created} created, ${errors.length} failed`, total, created, failed: errors.length, errors, ...extra,
});

export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Send a download as XLSX (default; dates in general.date_format) or CSV. */
export async function sendTable(res, { header, rows, fileBase, format = 'xlsx', sheetName }) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    return res.send(`\ufeff${toCsv(header, rows)}`);
  }
  const buf = writeXlsx(header, rows, sheetName, { dateFormat: (await getSetting('general.date_format', DEFAULT_FORMAT.dateFormat)) || DEFAULT_FORMAT.dateFormat });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xlsx"`);
  return res.send(buf);
}
