/**
 * Helpers shared by the go-live workbench kits: column value normalisation, row errors and lookups.
 *
 * A sheet definition (configuration.js, migration.js):
 *   { key, name (worksheet name), menu (screen where the same data is kept), columns, sample, keyOf(v),
 *     check?(ctx, v)       validation that runs on every row, before the comparison with the stored data,
 *     exportRows?(ctx)     the current data in the column keys (download with current data, and "unchanged" check),
 *     importRow?(ctx, v)   create or update one row: returns created | updated | unchanged | proposed,
 *     importSheet?(ctx, rows)  whole-sheet import (opening balances): returns { rows: [{ action, note? } | { errors } |
 *                          { held }] per row, sheetError? } (held: not loaded because of other rows, no error of its own),
 *     totals?(rows)        control totals of the rows (reconciliation) }
 * Column: { key, header, required, format, list (name of a Lists column), type: text | date | number | bool, aliases }
 */
import { badRequest } from '../../lib/errors.js';

export const MIGRATION_SOURCE = 'go-live-migration';
export const SAMPLE_PREFIX = 'SAMPLE';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Excel serial number or text to YYYY-MM-DD; the text unchanged when it is not a date. */
export function toIsoDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000).toISOString().slice(0, 10);
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(s);
  return m ? m[1] : s;
}

export const isDate = (s) => DATE.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Number from a cell (thousands separators allowed); NaN when it is not a number, null when empty. */
export function numberCell(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

const YES = ['yes', 'y', 'true', '1', 'active'];
const NO = ['no', 'n', 'false', '0', 'inactive'];
/** true / false from Yes / No (and true / false, 1 / 0); undefined when empty; null when not readable. */
export function toBool(v) {
  if (v === undefined || v === null || String(v).trim() === '') return undefined;
  const s = String(v).trim().toLowerCase();
  if (YES.includes(s)) return true;
  if (NO.includes(s)) return false;
  return null;
}
export const yesNo = (b) => (b === null || b === undefined ? '' : b ? 'Yes' : 'No');

/** Cell text of a stored value (export). */
export function cell(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  if (typeof v === 'object') return v instanceof Date ? v.toISOString().slice(0, 10) : JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/**
 * Text of a cell as compared and loaded: trimmed, line breaks as \n (a spreadsheet program may save \r\n), Unicode in
 * composed form (ñ typed or pasted as n + combining tilde is the same letter).
 */
export const cellString = (v) => String(v ?? '').normalize('NFC').replace(/\r\n?/g, '\n').trim();

/** Clean a value read from a workbook for its column type (dates from Excel serial numbers, trimmed text). */
export function cleanValue(col, v) {
  const s = cellString(v);
  if (!s) return '';
  if (col.type === 'date') return toIsoDate(s);
  return s;
}

/** Comparable form of a value (unchanged-row check): dates, numbers, booleans and lists normalised. */
export function comparable(col, v) {
  const s = cellString(v);
  if (!s) return '';
  if (col.type === 'date') return toIsoDate(s);
  if (col.type === 'number') {
    const n = numberCell(s);
    return Number.isNaN(n) ? s : String(n);
  }
  if (col.type === 'bool') {
    const b = toBool(s);
    return b === null || b === undefined ? s.toLowerCase() : String(b);
  }
  if (col.type === 'multi') return s.split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean).sort().join(',');
  if (col.list) return s.toLowerCase();
  return s;
}

/** Throw a row error on one column (header shown in the error list and the errors workbook). */
export function fail(column, message) {
  throw badRequest(message, [{ path: column, message }]);
}

/** Natural key text of a row from some of its column values (compared without case). */
export const keyText = (...parts) => parts.map((p) => String(p ?? '').normalize('NFC').trim().toLowerCase()).join('|');

/** Required date before the cutover date (migration rule: rows dated on or after cutover are refused). */
export function beforeCutover(ctx, column, value, label) {
  if (!value) return;
  if (!isDate(value)) fail(column, `${label} must be a date YYYY-MM-DD`);
  if (ctx.cutover && value >= ctx.cutover) fail(column, `${label} ${value} is on or after the cutover date ${ctx.cutover}; only business dated before the cutover is migrated (enter later transactions in BrokerVerse)`);
}

/** Date column check (optional value). */
export function dateValue(column, value, label) {
  if (!value) return null;
  if (!isDate(value)) fail(column, `${label} must be a date YYYY-MM-DD`);
  return value;
}

/** Amount column check (optional value, zero or more). */
export function amountValue(column, value, label, { positive = false } = {}) {
  const n = numberCell(value);
  if (n === null) return null;
  if (Number.isNaN(n)) fail(column, `${label} must be a number (no currency sign)`);
  if (positive ? !(n > 0) : n < 0) fail(column, `${label} must be ${positive ? 'greater than zero' : 'zero or more'}`);
  return n;
}
