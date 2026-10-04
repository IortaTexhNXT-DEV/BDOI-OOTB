/** Calls of the Go-Live Data Workbench API (/api/data-load) and the comparison of two workbooks of the same kit. */
import { dataOf } from '../uat/http.js';
import { Book } from './book.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function template(session, kit, { prefill = false } = {}) {
  return Book.from(await session.file(`/data-load/kits/${kit}/template`, prefill ? { prefill: 'true' } : {}));
}

/** Upload and validate: { batch, errors }. */
export async function upload(session, kit, book, fileName) {
  const buf = Buffer.isBuffer(book) ? book : book.toBuffer();
  return dataOf(await session.upload('POST', '/data-load/batches', { kit }, [{ field: 'file', name: fileName, type: XLSX, data: buf }]));
}

export const batch = async (session, id) => dataOf(await session.get(`/data-load/batches/${id}`));
export const load = async (session, id, { validRowsOnly = false } = {}) => dataOf(await session.post(`/data-load/batches/${id}/load`, { validRowsOnly }));
export const errorsBook = async (session, id) => Book.from(await session.file(`/data-load/batches/${id}/errors`));
export const reconciliationBook = async (session, id) => Book.from(await session.file(`/data-load/batches/${id}/reconciliation`));
export const kits = async (session) => dataOf(await session.get('/data-load/kits'));

/** Totals of a batch's sheet summary: { read, valid, errors, created, updated, unchanged, proposed, skipped }. */
export function totals(b) {
  const t = { read: 0, valid: 0, errors: 0, held: 0, created: 0, updated: 0, unchanged: 0, proposed: 0, ignored: 0, skipped: 0 };
  for (const s of b.sheets || []) for (const k of Object.keys(t)) t[k] += Number(s[k] || 0);
  return t;
}

export const summaryText = (b) => {
  const t = totals(b);
  return `batch ${b.id}: ${t.read} rows read, ${t.valid} valid, ${t.errors} with errors${t.held ? `, ${t.held} held` : ''} (${t.created} new, ${t.updated} changed, ${t.unchanged} unchanged, ${t.proposed} for approval${t.ignored ? `, ${t.ignored} ignored (zero balance)` : ''}${t.skipped ? `, ${t.skipped} skipped` : ''})`;
};

/** Sheets with something to report: "Sheet: 3 new, 1 changed". */
export function sheetLines(b, { only = ['created', 'updated', 'proposed', 'errors'] } = {}) {
  return (b.sheets || []).filter((s) => only.some((k) => s[k])).map((s) => `${s.name}: ${only.filter((k) => s[k]).map((k) => `${s[k]} ${k}`).join(', ')}`);
}

const norm = (v) => {
  const s = String(v ?? '').trim();
  if (s !== '' && /^-?[\d,]*\.?\d+$/.test(s)) return String(Number(s.replace(/,/g, '')));
  if (/^(yes|true)$/i.test(s)) return 'true';
  if (/^(no|false)$/i.test(s)) return 'false';
  // lists of codes (roles, lines, regimes) compare without order
  if (/^[\w.@-]+(\s*[,;]\s*[\w.@-]+)+$/.test(s)) return s.split(/[,;]/).map((x) => x.trim().toLowerCase()).sort().join(',');
  return s.toLowerCase();
};

/**
 * Compare two workbooks of a kit sheet by sheet on the natural keys of the kit (GET /data-load/kits). Returns
 * [{ sheet, onlyA: [key], onlyB: [key], changed: [{ key, columns: [{ column, a, b }] }] }] for the sheets that differ.
 */
export function compareBooks(kitInfo, a, b) {
  const out = [];
  for (const s of kitInfo.sheets) {
    if (!a.has(s.name) || !b.has(s.name)) continue;
    const headerOf = Object.fromEntries(s.columns.map((c) => [c.key, c.header]));
    const keyHeaders = s.keyColumns.map((k) => headerOf[k]);
    const keyOf = (r) => keyHeaders.map((h) => String(r.values[h] ?? '').trim().toLowerCase()).join(' | ');
    const index = (book) => new Map(book.rows(s.name).map((r) => [keyOf(r), r.values]));
    const ia = index(a);
    const ib = index(b);
    const diff = { sheet: s.name, onlyA: [], onlyB: [], changed: [] };
    for (const [k, va] of ia) {
      const vb = ib.get(k);
      if (!vb) { diff.onlyA.push(k); continue; }
      const columns = s.columns.map((c) => c.header).filter((h) => norm(va[h]) !== norm(vb[h])).map((h) => ({ column: h, a: va[h] ?? '', b: vb[h] ?? '' }));
      if (columns.length) diff.changed.push({ key: k, columns });
    }
    for (const k of ib.keys()) if (!ia.has(k)) diff.onlyB.push(k);
    if (diff.onlyA.length || diff.onlyB.length || diff.changed.length) out.push(diff);
  }
  return out;
}
