/**
 * The Philippine Standard Geographic Code files shipped in src/db/reference/psgc (regions, provinces, cities and
 * municipalities, PhilPost ZIP codes, barangays), read by scripts/build-ph-geography.js and scripts/load-barangays.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PSGC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'db', 'reference', 'psgc');

/** RFC 4180 CSV text -> rows of cells (no row limit: these are reference files, not uploads). */
export function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** Rows of a CSV file as objects keyed by its header row. */
export function readCsvFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const [header, ...rows] = csvRows(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** Rows of one file of the PSGC folder (regions.csv, provinces.csv, cities.csv, postal_codes.csv, barangays.csv). */
export const readPsgc = (file, dir = PSGC_DIR) => readCsvFile(path.join(dir, file));

/** Release of the PSGC files (VERSION). */
export const psgcVersion = (dir = PSGC_DIR) => fs.readFileSync(path.join(dir, 'VERSION'), 'utf8').trim();
