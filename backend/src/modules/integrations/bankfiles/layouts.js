/**
 * Bank file layouts: the definition master (bank_file_layouts) and the engine that writes a payment file and reads a
 * payment status file from a definition. Nothing about a bank is in the code: a layout lists its records and fields.
 *
 * Field: { name, source, value, width, align (left | right), pad (" " or "0"), format, map }
 *   source   line.<key> (seq, voucherNumber, reference, payeeName, accountName, accountNumber, bankCode, accountType,
 *            amount, email, payeeType), batch.<key> (batchNumber, valueDate, bankAccountNumber, bankAccountName,
 *            bankCode, companyName, totalAmount, count, channel, createdDate), or const (the field's value)
 *   format   text, upper, digits, alnum, amount (2 decimals with a point), amount_cents (whole centavos),
 *            date:<pattern> (YYYY, YY, MM, DD, e.g. date:MMDDYYYY)
 *   map      replaces a value before formatting (e.g. channel { "instapay": "IP", "pesonet": "PN" })
 * A fixed-width layout cuts and pads every field to its width; a delimited layout separates fields with the delimiter
 * (cut to the width when one is given) and quotes a value holding the delimiter or a quote.
 *
 * Status file: { format, delimiter, skipRows, hasHeader, columns: { reference, status, bankReference, reason, amount },
 * paidValues, rejectedValues }. A column is a header text, a 1-based column number or, for a fixed-width file,
 * { start (1-based), width }.
 */
import crypto from 'node:crypto';
import { many, one, query } from '../../../db/pool.js';
import { badRequest, conflict, notFound } from '../../../lib/errors.js';
import { z } from '../../../lib/validate.js';

export const CHANNELS = ['bulk_credit', 'instapay', 'pesonet'];
export const LINE_SOURCES = ['seq', 'voucherNumber', 'reference', 'payeeName', 'accountName', 'accountNumber', 'bankCode', 'accountType', 'amount', 'email', 'payeeType'];
export const BATCH_SOURCES = ['batchNumber', 'valueDate', 'bankAccountNumber', 'bankAccountName', 'bankCode', 'companyName', 'totalAmount', 'count', 'channel', 'createdDate'];
export const SOURCES = ['const', ...LINE_SOURCES.map((s) => `line.${s}`), ...BATCH_SOURCES.map((s) => `batch.${s}`)];
export const FORMATS = ['text', 'upper', 'digits', 'alnum', 'amount', 'amount_cents'];

export const fieldSchema = z.object({
  name: z.string().trim().min(1).max(60),
  source: z.string().refine((s) => SOURCES.includes(s), 'Unknown source'),
  value: z.string().max(200).optional().nullable(),
  width: z.coerce.number().int().min(1).max(500).optional().nullable(),
  align: z.enum(['left', 'right']).optional().nullable(),
  pad: z.string().max(1).optional().nullable(),
  format: z.string().refine((f) => FORMATS.includes(f) || /^date:[YMD/\-.]+$/.test(f), 'Unknown format').optional().nullable(),
  map: z.record(z.string()).optional().nullable(),
}).strict();
const column = z.union([z.string().min(1).max(80), z.number().int().min(1).max(200), z.object({ start: z.number().int().min(1), width: z.number().int().min(1).max(200) })]);
export const statusFileSchema = z.object({
  format: z.enum(['fixed', 'delimited']).optional(),
  delimiter: z.string().min(1).max(3).optional(),
  skipRows: z.number().int().min(0).max(50).optional(),
  hasHeader: z.boolean().optional(),
  columns: z.object({ reference: column, status: column, bankReference: column.optional(), reason: column.optional(), amount: column.optional() }),
  paidValues: z.array(z.string().max(40)).max(30),
  rejectedValues: z.array(z.string().max(40)).max(30),
}).strict();
export const layoutSchema = z.object({
  name: z.string().trim().min(1).max(120),
  bankCode: z.string().trim().max(20).nullable().optional(),
  channels: z.array(z.enum(CHANNELS)).min(1).max(3),
  format: z.enum(['fixed', 'delimited']),
  delimiter: z.string().min(1).max(3).optional(),
  quoteValues: z.boolean().optional(),
  lineEnding: z.enum(['CRLF', 'LF']).optional(),
  fileNamePattern: z.string().trim().min(3).max(120).optional(),
  headerFields: z.array(fieldSchema).max(60).optional(),
  detailFields: z.array(fieldSchema).min(1).max(80),
  trailerFields: z.array(fieldSchema).max(60).optional(),
  statusFile: statusFileSchema.optional().nullable(),
  maxAmountPerLine: z.coerce.number().min(0).nullable().optional(),
  active: z.boolean().optional(),
  description: z.string().max(1000).nullable().optional(),
}).strict();

export const toLayout = (l) => ({
  code: l.code, name: l.name, bankCode: l.bank_code, channels: l.channels || [], format: l.format, delimiter: l.delimiter, quoteValues: l.quote_values, lineEnding: l.line_ending,
  fileNamePattern: l.file_name_pattern, headerFields: l.header_fields || [], detailFields: l.detail_fields || [], trailerFields: l.trailer_fields || [], statusFile: l.status_file || {},
  maxAmountPerLine: l.max_amount_per_line === null ? null : Number(l.max_amount_per_line), isExample: l.is_example, active: l.active, description: l.description, updatedAt: l.updated_at,
});

export const listLayouts = async ({ all = false } = {}) => (await many(`SELECT * FROM bank_file_layouts ${all ? '' : 'WHERE active'} ORDER BY bank_code NULLS LAST, code`)).map(toLayout);
export async function layoutRow(code, db = null) {
  const l = (await (db || { query }).query('SELECT * FROM bank_file_layouts WHERE code = upper($1)', [String(code || '')])).rows[0];
  if (!l) throw notFound(`Bank file layout ${code} not found`);
  return l;
}

const COLS = { name: 'name', bankCode: 'bank_code', channels: 'channels', format: 'format', delimiter: 'delimiter', quoteValues: 'quote_values', lineEnding: 'line_ending',
  fileNamePattern: 'file_name_pattern', headerFields: 'header_fields', detailFields: 'detail_fields', trailerFields: 'trailer_fields', statusFile: 'status_file',
  maxAmountPerLine: 'max_amount_per_line', active: 'active', description: 'description' };
const JSON_COLS = ['header_fields', 'detail_fields', 'trailer_fields', 'status_file'];

function assertFixedWidths(b) {
  if (b.format !== 'fixed') return;
  const missing = ['headerFields', 'detailFields', 'trailerFields'].flatMap((k) => (b[k] || []).filter((f) => !f.width).map((f) => `${k}.${f.name}`));
  if (missing.length) throw badRequest('Validation failed', missing.map((p) => ({ path: p, message: 'A fixed-width field needs its width' })));
}

export async function createLayout(code, b, user) {
  if (await one('SELECT 1 FROM bank_file_layouts WHERE code = $1', [code])) throw conflict(`Layout ${code} exists already`);
  assertFixedWidths(b);
  const keys = Object.keys(COLS).filter((k) => b[k] !== undefined);
  const cols = keys.map((k) => COLS[k]);
  const vals = keys.map((k) => (JSON_COLS.includes(COLS[k]) ? JSON.stringify(b[k] || (k === 'statusFile' ? {} : [])) : b[k]));
  await query(`INSERT INTO bank_file_layouts(code, ${cols.join(', ')}, created_by, updated_by) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}, $${cols.length + 2}, $${cols.length + 2})`,
    [code, ...vals, user?.id ?? null]);
  return toLayout(await layoutRow(code));
}

export async function updateLayout(code, b, user) {
  const l = await layoutRow(code);
  assertFixedWidths({ ...toLayout(l), ...b });
  const keys = Object.keys(COLS).filter((k) => b[k] !== undefined);
  if (keys.length) {
    await query(`UPDATE bank_file_layouts SET ${keys.map((k, i) => `${COLS[k]} = $${i + 2}`).join(', ')}, is_example = false, updated_by = $${keys.length + 2}, updated_at = now() WHERE code = $1`,
      [l.code, ...keys.map((k) => (JSON_COLS.includes(COLS[k]) ? JSON.stringify(b[k] || (k === 'statusFile' ? {} : [])) : b[k])), user?.id ?? null]);
  }
  return { before: toLayout(l), after: toLayout(await layoutRow(l.code)) };
}

// ------------------------------------------------------------------ engine

export function formatDatePattern(iso, pattern) {
  const d = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const [y, m, dd] = d.split('-');
  return pattern.replace('YYYY', y).replace('YY', y.slice(2)).replace('MM', m).replace('DD', dd);
}

export function formatValue(raw, f) {
  let v = raw === undefined || raw === null ? '' : raw;
  if (f.map && Object.prototype.hasOwnProperty.call(f.map, String(v))) v = f.map[String(v)];
  const fmt = f.format || 'text';
  if (fmt === 'amount') v = Number(v || 0).toFixed(2);
  else if (fmt === 'amount_cents') v = String(Math.round(Number(v || 0) * 100));
  else if (fmt === 'upper') v = String(v).toUpperCase();
  else if (fmt === 'digits') v = String(v).replace(/\D/g, '');
  else if (fmt === 'alnum') v = String(v).replace(/[^A-Za-z0-9 ]/g, '');
  else if (fmt.startsWith('date:')) v = formatDatePattern(v, fmt.slice(5));
  return String(v).replace(/[\r\n]+/g, ' ');
}

function fieldText(f, ctx, layout) {
  const raw = f.source === 'const' ? f.value ?? '' : f.source.startsWith('line.') ? ctx.line?.[f.source.slice(5)] : ctx.batch?.[f.source.slice(6)];
  let v = formatValue(raw, f);
  const fixed = layout.format === 'fixed';
  if (f.width) {
    if (v.length > f.width) v = f.align === 'right' ? v.slice(v.length - f.width) : v.slice(0, f.width);
    if (fixed) {
      const pad = f.pad || (f.align === 'right' ? '0' : ' ');
      v = f.align === 'right' ? v.padStart(f.width, pad) : v.padEnd(f.width, pad);
    }
  }
  if (!fixed) {
    const d = layout.delimiter || ',';
    if (layout.quote_values || v.includes(d) || v.includes('"')) v = `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

const record = (fields, ctx, layout) => fields.map((f) => fieldText(f, ctx, layout)).join(layout.format === 'fixed' ? '' : layout.delimiter || ',');

/** Write a payment file: { fileName, content, hash }. batch and lines use the source keys listed above. */
export function renderFile(layout, batch, lines) {
  const out = [];
  if ((layout.header_fields || []).length) out.push(record(layout.header_fields, { batch }, layout));
  for (const line of lines) out.push(record(layout.detail_fields, { batch, line }, layout));
  if ((layout.trailer_fields || []).length) out.push(record(layout.trailer_fields, { batch }, layout));
  const eol = layout.line_ending === 'LF' ? '\n' : '\r\n';
  const content = out.join(eol) + eol;
  const fileName = String(layout.file_name_pattern || '{batchNumber}.txt').replace(/\{(\w+)(?::([^}]+))?\}/g, (_m, k, p) => {
    const v = batch[k];
    return p ? formatDatePattern(v, p) : String(v ?? '');
  }).replace(/[^A-Za-z0-9._-]/g, '_');
  return { fileName, content, hash: crypto.createHash('sha256').update(content).digest('hex') };
}

function splitDelimited(line, d) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (line.startsWith(d, i)) { out.push(cur); cur = ''; i += d.length - 1; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Read a payment status (return) file: [{ row, reference, status: paid | rejected | unknown, rawStatus, bankReference,
 * reason, amount }].
 */
export function parseStatusFile(layout, text) {
  const sf = layout.status_file || {};
  if (!sf.columns?.reference || !sf.columns?.status) throw badRequest(`Layout ${layout.code} has no status file definition (reference and status columns)`);
  const rows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '').slice(sf.skipRows || 0);
  const fixed = (sf.format || 'delimited') === 'fixed';
  let header = null;
  if (!fixed && sf.hasHeader !== false && rows.length) header = splitDelimited(rows.shift(), sf.delimiter || ',').map(norm);
  const paid = (sf.paidValues || []).map((v) => String(v).trim().toUpperCase());
  const rejected = (sf.rejectedValues || []).map((v) => String(v).trim().toUpperCase());
  const pick = (cells, line, col) => {
    if (col === undefined || col === null) return null;
    if (typeof col === 'object') return line.substr(col.start - 1, col.width).trim();
    if (typeof col === 'number') return cells[col - 1] ?? null;
    if (header) {
      const alts = String(col).split('|').map(norm);
      const i = header.findIndex((h) => alts.includes(h));
      if (i < 0) throw badRequest(`The status file has no column "${col}" (found: ${header.join(', ')})`);
      return cells[i] ?? null;
    }
    return null;
  };
  return rows.map((line, i) => {
    const cells = fixed ? [] : splitDelimited(line, sf.delimiter || ',');
    const rawStatus = String(pick(cells, line, sf.columns.status) || '').trim();
    const up = rawStatus.toUpperCase();
    const amount = pick(cells, line, sf.columns.amount);
    return {
      row: i + 1 + (sf.skipRows || 0) + (header ? 1 : 0), reference: String(pick(cells, line, sf.columns.reference) || '').trim(), rawStatus,
      status: paid.includes(up) ? 'paid' : rejected.includes(up) ? 'rejected' : 'unknown', bankReference: pick(cells, line, sf.columns.bankReference) || null,
      reason: pick(cells, line, sf.columns.reason) || null, amount: amount === null || amount === '' ? null : Number(String(amount).replace(/,/g, '')),
    };
  }).filter((r) => r.reference);
}

/** Sample batch and lines for the layout preview on the master screen. */
export const SAMPLE = {
  batch: { batchNumber: 'BPB-2026-00001', valueDate: '2026-10-05', bankAccountNumber: '001234567890', bankAccountName: 'iorta TechNXT Corp.', bankCode: 'BDO',
    companyName: 'iorta TechNXT Corp.', totalAmount: 153250.5, count: 2, channel: 'pesonet', createdDate: '2026-10-04' },
  lines: [
    { seq: 1, voucherNumber: 'PV-2026-00011', reference: 'PV-2026-00011', payeeName: 'Malayan Insurance Co., Inc.', accountName: 'Malayan Insurance Co., Inc.', accountNumber: '0012-3456-78',
      bankCode: 'MBT', accountType: 'current', amount: 125000, email: 'remittance@malayan.example.ph', payeeType: 'Insurer' },
    { seq: 2, voucherNumber: 'PV-2026-00012', reference: 'PV-2026-00012', payeeName: 'Dela Cruz, Juan', accountName: 'Juan Dela Cruz', accountNumber: '1234567890',
      bankCode: 'BPI', accountType: 'savings', amount: 28250.5, email: 'juan@example.ph', payeeType: 'Agent/Referrer' },
  ],
};
