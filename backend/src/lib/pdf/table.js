/**
 * Table preparation and column-width allocation for printed tables. Rules: numbers, amounts, dates, document numbers
 * and codes are never truncated or wrapped (their column is at least as wide as the widest value); text columns share
 * the remaining width and wrap onto more lines. When even the minimum widths do not fit, `fits` is false and the
 * caller reduces the font size or uses a larger page.
 */
import { formatAmount, formatDate, DEFAULT_FORMAT } from './format.js';
import { longestWord, textWidth } from './fonts.js';

export const NUMERIC_TYPES = new Set(['money', 'amount', 'number', 'integer', 'percent', 'decimal']);
const NOWRAP_TYPES = new Set([...NUMERIC_TYPES, 'date', 'code']);
export const CELL_PAD = 3;

const NUMERIC_TEXT = /^[-(]?[A-Z]{0,3}\s?-?[\d,]+(\.\d+)?%?\)?$/;
const DATE_TEXT = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2} [A-Z][a-z]{2} \d{4})$/;
// A document number or code: one token with a digit or all capitals (POL-2026-00003, OR-2026-00012, CL-2026-00001, PHP)
const CODE_TEXT = /^(?=.*[\dA-Z])[A-Za-z0-9][A-Za-z0-9\-/._#:]*$/;
const isCodeLike = (s) => s.length <= 32 && CODE_TEXT.test(s) && (/\d/.test(s) || /^[A-Z0-9\-/._]+$/.test(s));

/** Normalise a column definition: a string label or { label, key, type, align, wrap }. */
export const normColumn = (c) => (typeof c === 'string' || typeof c === 'number' ? { label: String(c) } : { ...c, label: c.label ?? c.header ?? c.key ?? '' });

/** Text of one cell: amounts with separators, dates in the configured format. */
export function formatCell(v, type, fmt = DEFAULT_FORMAT) {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'integer') return formatAmount(v, 0);
  if (NUMERIC_TYPES.has(type)) return typeof v === 'number' || /^-?[\d,]+(\.\d+)?$/.test(String(v).trim()) ? formatAmount(v, fmt.decimals ?? 2) : String(v);
  if (type === 'date') return formatDate(v, fmt);
  if (typeof v === 'number') return formatAmount(v, fmt.decimals ?? 2);
  if (v instanceof Date) return formatDate(v, fmt);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return Array.isArray(v) ? v.join(', ') : JSON.stringify(v);
  return String(v);
}

/**
 * Prepare a table: formatted cell text, alignment and wrapping per column. Legacy tables (string columns, number
 * cells) are recognised: a column whose values are all numbers is an amount column.
 */
export function prepareTable(table, fmt = DEFAULT_FORMAT) {
  const columns = (table.columns || []).map(normColumn);
  const rawRows = (table.rows || []).map((r) => (Array.isArray(r) ? r : columns.map((c) => r[c.key])));
  const cols = columns.map((c, i) => {
    let { type } = c;
    const vals = rawRows.map((r) => r[i]).filter((v) => v !== null && v !== undefined && v !== '');
    if (!type && vals.length) {
      if (vals.every((v) => typeof v === 'number')) type = 'money';
      else if (vals.every((v) => v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)))) type = 'date';
    }
    return { ...c, type };
  });
  const rows = rawRows.map((r) => cols.map((c, i) => formatCell(r[i], c.type, fmt)));
  const totals = (table.totals ? [table.totals] : []).map((t) => (Array.isArray(t) ? t : cols.map((c, i) => (i === 0 && (t[c.key] === undefined || t[c.key] === null) ? 'TOTAL' : t[c.key]))))
    .map((r) => cols.map((c, i) => formatCell(r[i], c.type, fmt)));
  const all = [...rows, ...totals];
  for (const [i, c] of cols.entries()) {
    const texts = all.map((r) => r[i]).filter(Boolean);
    // a column declared as text (account codes, years) stays left-aligned; an undeclared one is numeric when its values are
    const numeric = NUMERIC_TYPES.has(c.type) || (!c.type && texts.length > 0 && texts.every((s) => NUMERIC_TEXT.test(s.trim()) || s.trim() === '-'));
    c.align = c.align || (numeric ? 'right' : 'left');
    c.nowrap = c.wrap === true ? false : c.wrap === false || NOWRAP_TYPES.has(c.type) || numeric
      || (texts.length > 0 && texts.every((s) => DATE_TEXT.test(s) || isCodeLike(s) || s === '-'));
  }
  const totalFrom = table.totalRow ? rows.length - 1 : rows.length;
  return { columns: cols, rows: [...rows, ...totals], totalFrom, widths: table.widths || null };
}

/**
 * Column widths for a prepared table in `avail` points at font `size`:
 * { widths, fits, min } - min is the sum of the minimum widths (fits = min <= avail).
 */
export function allocateWidths(prepared, avail, size) {
  const pad = CELL_PAD * 2;
  const sample = prepared.rows.length > 1500 ? prepared.rows.slice(0, 1500) : prepared.rows;
  const spec = prepared.columns.map((c, i) => {
    let natural = 0;
    let word = 0;
    for (const r of sample) {
      const s = r[i];
      if (!s) continue;
      const w = textWidth(s, size, false);
      if (w > natural) natural = w;
      if (!c.nowrap) { const lw = longestWord(s, size); if (lw > word) word = lw; }
    }
    natural = Math.max(natural * 1.04, textWidth('0', size) * 2) + pad; // bold total rows are slightly wider
    const headWord = longestWord(c.label, size, true) + pad;
    const headFull = textWidth(c.label, size, true) + pad;
    if (c.nowrap) { const min = Math.max(natural, headWord); return { min, want: Math.max(min, Math.min(headFull, natural * 1.6, natural + 40)) }; }
    const min = Math.max(headWord, Math.min(word + pad, size * 11), Math.min(natural, size * 6));
    return { min, want: Math.max(min, Math.min(natural, size * 36), Math.min(headFull, size * 18)) };
  });
  const sumMin = spec.reduce((s, x) => s + x.min, 0);
  const sumWant = spec.reduce((s, x) => s + x.want, 0);
  // Preferred widths from the caller, honoured when every column still gets its minimum
  if (prepared.widths?.length === spec.length) {
    const total = prepared.widths.reduce((a, b) => a + b, 0) || 1;
    const scaled = prepared.widths.map((w) => (w * avail) / total);
    if (scaled.every((w, i) => w + 0.01 >= spec[i].min)) return { widths: scaled, fits: true, min: sumMin };
  }
  if (sumMin > avail) return { widths: spec.map((x) => (x.min * avail) / sumMin), fits: false, min: sumMin };
  if (sumWant <= avail) {
    // Spread the spare width, text columns (which can use it) at twice the weight of number / date / code columns
    const weight = spec.map((x, i) => x.want * (prepared.columns[i].nowrap ? 1 : 2));
    const total = weight.reduce((a, b) => a + b, 0) || 1;
    return { widths: spec.map((x, i) => x.want + ((avail - sumWant) * weight[i]) / total), fits: true, min: sumMin };
  }
  const deficit = spec.reduce((s, x) => s + (x.want - x.min), 0) || 1;
  const spare = avail - sumMin;
  return { widths: spec.map((x) => x.min + (spare * (x.want - x.min)) / deficit), fits: true, min: sumMin };
}
