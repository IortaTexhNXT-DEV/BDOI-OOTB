/** RFC 4180 CSV with a UTF-8 BOM (so Excel detects the encoding) and formula-injection guarding. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (FORMULA_START.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** columns: [{key, label}]; rows: objects (by key) or arrays. */
export function toCsv(columns, rows, { bom = true } = {}) {
  const lines = [columns.map((c) => csvCell(c.label ?? c.header ?? c.key)).join(',')];
  for (const r of rows) lines.push((Array.isArray(r) ? r : columns.map((c) => r[c.key])).map(csvCell).join(','));
  return (bom ? '﻿' : '') + lines.join('\r\n') + '\r\n';
}
