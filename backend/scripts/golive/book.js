/**
 * Workbook helper of the rehearsal: reads a go-live workbook (every sheet, cells as text), lets the rehearsal read and
 * change cells by sheet name and column header, and writes it back in the same layout (row 1 headers, row 2 sample,
 * data from row 3), so the row numbers the API reports are the row numbers of this book.
 */
import { readWorkbook } from '../../src/modules/documents/xlsx.js';
import { writeXlsx } from '../../src/lib/xlsx.js';

const clean = (h) => String(h ?? '').replace(/\s*\*$/, '').trim();
const FIRST_DATA_ROW = 3;

export class Book {
  constructor(buffer) {
    this.sheets = readWorkbook(buffer).map((s) => ({ name: s.name, rows: s.rows.map((r) => [...(r || [])]) }));
  }

  static from(buffer) { return new Book(buffer); }

  sheet(name) {
    const s = this.sheets.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!s) throw new Error(`The workbook has no sheet ${name}`);
    return s;
  }

  has(name) { return this.sheets.some((x) => x.name.toLowerCase() === name.toLowerCase()); }

  headers(name) { return (this.sheet(name).rows[0] || []).map(clean); }

  col(name, header) {
    const i = this.headers(name).findIndex((h) => h.toLowerCase() === header.toLowerCase());
    if (i < 0) throw new Error(`Sheet ${name} has no column ${header}`);
    return i;
  }

  /** Data rows (from row 3): [{ row (sheet row number), values: { header: text } }]; empty rows left out. */
  rows(name) {
    const s = this.sheet(name);
    const hs = this.headers(name);
    const out = [];
    for (let i = FIRST_DATA_ROW - 1; i < s.rows.length; i += 1) {
      const cells = s.rows[i] || [];
      if (!cells.some((c) => String(c ?? '').trim() !== '')) continue;
      out.push({ row: i + 1, values: Object.fromEntries(hs.map((h, k) => [h, String(cells[k] ?? '').trim()])) });
    }
    return out;
  }

  get(name, row, header) { return String((this.sheet(name).rows[row - 1] || [])[this.col(name, header)] ?? ''); }

  set(name, row, header, value) {
    const s = this.sheet(name);
    const k = this.col(name, header);
    while (s.rows.length < row) s.rows.push([]);
    const r = s.rows[row - 1];
    while (r.length <= k) r.push('');
    r[k] = value === null || value === undefined ? '' : String(value);
  }

  /** The first data row whose column equals the value (case-insensitive), or null. */
  find(name, header, value) {
    return this.rows(name).find((r) => r.values[header]?.toLowerCase() === String(value).toLowerCase()) || null;
  }

  /** Append a data row given by header: returns its sheet row number. */
  append(name, values) {
    const s = this.sheet(name);
    const hs = this.headers(name);
    const unknown = Object.keys(values).filter((k) => !hs.some((h) => h.toLowerCase() === k.toLowerCase()));
    if (unknown.length) throw new Error(`Sheet ${name} has no column ${unknown.join(', ')}`);
    while (s.rows.length < FIRST_DATA_ROW - 1) s.rows.push([]);
    s.rows.push(hs.map((h) => {
      const key = Object.keys(values).find((k) => k.toLowerCase() === h.toLowerCase());
      return key === undefined || values[key] === null || values[key] === undefined ? '' : String(values[key]);
    }));
    return s.rows.length;
  }

  /** Remove the data rows of a sheet (headers and sample row kept). */
  clear(name) { this.sheet(name).rows.length = Math.min(this.sheet(name).rows.length, FIRST_DATA_ROW - 1); }

  /** Remove one data row (the rows below move up). */
  remove(name, row) { this.sheet(name).rows.splice(row - 1, 1); }

  /** Keep only some sheets (by name). */
  only(names) {
    const keep = new Set(names.map((n) => n.toLowerCase()));
    this.sheets = this.sheets.filter((s) => keep.has(s.name.toLowerCase()));
    return this;
  }

  copy() {
    const b = Object.create(Book.prototype);
    b.sheets = this.sheets.map((s) => ({ name: s.name, rows: s.rows.map((r) => [...r]) }));
    return b;
  }

  toBuffer() {
    return writeXlsx({
      title: 'Go-live rehearsal workbook', creator: 'BrokerVerse go-live rehearsal',
      sheets: this.sheets.map((s) => ({
        name: s.name, columns: (s.rows[0] || []).map((h) => ({ header: String(h ?? '') })), rows: s.rows.slice(1).map((r) => r.map((c) => String(c ?? ''))),
        textColumns: true, autoFilter: false, freeze: false,
      })),
    });
  }
}

/** Object sheets of a book with their data row counts (Instructions and Lists left out). */
export function sheetCounts(book) {
  return Object.fromEntries(book.sheets.filter((s) => !['instructions', 'lists'].includes(s.name.toLowerCase())).map((s) => [s.name, book.rows(s.name).length]));
}
