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

/** A calendar date YYYY-MM-DD that exists (2026-02-30 is not one: the parser would roll it over to March). */
export const isDate = (s) => {
  if (!DATE.test(String(s || ''))) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === String(s);
};

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

/**
 * A number cell as text without the binary noise a spreadsheet may write (9902.860000000001 is 9902.86): 15
 * significant digits, so no digit typed in a cell is ever dropped. Text that is no plain number stays as it is.
 */
export function numberText(s) {
  const t = cellString(s);
  if (!/^-?\d+\.\d{10,}$/.test(t)) return t;
  return String(Number(Number(t).toPrecision(15)));
}

/** Clean a value read from a workbook for its column type (dates from Excel serial numbers, numbers, trimmed text). */
export function cleanValue(col, v) {
  const s = cellString(v);
  if (!s) return '';
  if (col.type === 'date') return toIsoDate(s);
  if (col.type === 'number') return numberText(s);
  return s;
}

/** Comparable form of a value (unchanged-row check): dates, numbers, booleans and lists normalised. */
export function comparable(col, v) {
  const s = cellString(v);
  if (!s) return '';
  if (col.type === 'date') return toIsoDate(s);
  if (col.type === 'number') {
    const n = numberCell(numberText(s));
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

/** Whole centavos of an amount, or null when it has more than two decimals (the binary noise of a spreadsheet aside). */
export function centavos(n) {
  const c = Math.round(n * 100);
  return Math.abs(n * 100 - c) > 1e-6 * Math.max(1, Math.abs(n)) ? null : c;
}

/**
 * Peso amount column check: as amountValue, and never more than two decimals. The amount is not rounded, so the
 * workbook total and the stored total are sums of the same values and agree to the centavo.
 */
export function pesoValue(column, value, label, options = {}) {
  const n = amountValue(column, value, label, options);
  if (n === null) return null;
  if (centavos(n) === null) fail(column, `${label} has more than two decimals`);
  return n;
}

/** Sum of peso cells in whole centavos (each cell rounded to the centavo, then added), as a peso amount. */
export function pesoSum(values) {
  let c = 0;
  for (const v of values) {
    const n = numberCell(v);
    if (n !== null && !Number.isNaN(n)) c += Math.round(n * 100);
  }
  return c / 100;
}
