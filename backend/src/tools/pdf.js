/**
 * Minimal, dependency-free tabular PDF writer (PDF 1.4, standard Helvetica fonts, WinAnsi text).
 * Landscape A4 by default, repeated header row, zebra rows, totals row, page numbers.
 */
const PAGE = { A4: [842, 595], LETTER: [792, 612] };
const MARGIN = 30;
const FONT = 7;
const ROW_H = 11;
const CHAR_W = 0.53; // average Helvetica glyph width as a fraction of the font size

const winAnsi = (s) => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, (ch) => ({ '₱': 'PHP ', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"' }[ch] ?? '?'));
const esc = (s) => winAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const textWidth = (s, size = FONT) => winAnsi(s).length * size * CHAR_W;
const fmtNum = (v, type) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const digits = type === 'integer' ? 0 : 2;
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const NUMERIC = new Set(['money', 'number', 'integer', 'percent']);
export const formatCell = (v, type) => {
  if (NUMERIC.has(type)) return fmtNum(v, type);
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

function fit(s, width, size = FONT) {
  const max = Math.max(1, Math.floor((width - 4) / (size * CHAR_W)));
  const t = winAnsi(s);
  return t.length <= max ? t : `${t.slice(0, Math.max(1, max - 2))}..`;
}

function columnWidths(columns, rows, avail) {
  const natural = columns.map((c) => {
    let len = String(c.label ?? c.key).length;
    for (const r of rows.slice(0, 300)) len = Math.max(len, formatCell(r[c.key], c.type).length);
    return Math.min(Math.max(len, 4), 40) * FONT * CHAR_W + 6;
  });
  const sum = natural.reduce((a, b) => a + b, 0);
  return natural.map((w) => (w * avail) / sum);
}

function rowOps(cells, columns, widths, y, { bold = false } = {}) {
  let x = MARGIN;
  const ops = [];
  cells.forEach((text, i) => {
    const t = fit(text, widths[i]);
    const right = NUMERIC.has(columns[i].type);
    const tx = right ? x + widths[i] - 2 - textWidth(t) : x + 2;
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${FONT} Tf ${tx.toFixed(2)} ${(y + 3).toFixed(2)} Td (${esc(t)}) Tj ET`);
    x += widths[i];
  });
  return ops;
}

/**
 * @param {{title: string, subtitle?: string, columns: {key: string, label: string, type?: string}[], rows: object[], totals?: object, pageSize?: string, landscape?: boolean}} doc
 * @returns {Buffer}
 */
export function writePdf({ title, subtitle = '', columns, rows, totals = null, pageSize = 'A4', landscape = true }) {
  const [a, b] = PAGE[pageSize] || PAGE.A4;
  const [W, H] = landscape ? [a, b] : [b, a];
  const avail = W - 2 * MARGIN;
  const widths = columnWidths(columns, rows, avail);
  const header = columns.map((c) => c.label ?? c.key);
  const body = rows.map((r) => columns.map((c) => formatCell(r[c.key], c.type)));
  if (totals) body.push(columns.map((c, i) => (i === 0 ? 'TOTAL' : (totals[c.key] !== undefined ? formatCell(totals[c.key], c.type) : ''))));
  const firstTop = H - MARGIN - 34;
  const perFirst = Math.max(1, Math.floor((firstTop - MARGIN - 14) / ROW_H) - 1);
  const perNext = Math.max(1, Math.floor((H - 2 * MARGIN - 14) / ROW_H) - 1);
  const pages = [];
  let i = 0;
  do {
    const n = pages.length === 0 ? perFirst : perNext;
    pages.push(body.slice(i, i + n).map((cells, k) => ({ cells, index: i + k })));
    i += n;
  } while (i < body.length);

  const streams = pages.map((pageRows, p) => {
    const ops = [];
    let y = H - MARGIN;
    if (p === 0) {
      ops.push(`BT /F2 12 Tf ${MARGIN} ${y - 12} Td (${esc(title)}) Tj ET`);
      if (subtitle) ops.push(`BT /F1 8 Tf ${MARGIN} ${y - 24} Td (${esc(subtitle)}) Tj ET`);
      y = firstTop;
    }
    y -= ROW_H;
    ops.push(`0.12 0.31 0.47 rg ${MARGIN} ${y} ${avail} ${ROW_H} re f 1 g`);
    ops.push(...rowOps(header, columns, widths, y, { bold: true }));
    ops.push('0 g');
    for (const r of pageRows) {
      y -= ROW_H;
      const isTotal = totals && r.index === body.length - 1;
      if (isTotal) ops.push(`0.85 g ${MARGIN} ${y} ${avail} ${ROW_H} re f 0 g`);
      else if (r.index % 2 === 1) ops.push(`0.95 g ${MARGIN} ${y} ${avail} ${ROW_H} re f 0 g`);
      ops.push(...rowOps(r.cells, columns, widths, y, { bold: isTotal }));
    }
    ops.push(`0.6 G 0.3 w ${MARGIN} ${y} m ${MARGIN + avail} ${y} l S`);
    ops.push(`BT /F1 7 Tf ${W - MARGIN - 50} ${MARGIN - 14} Td (Page ${p + 1} of ${pages.length}) Tj ET`);
    return Buffer.from(ops.join('\n'), 'latin1');
  });

  const objs = [];
  const add = (body2) => { objs.push(body2); return objs.length; };
  const catalog = add(null);
  const pagesId = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const info = add(`<< /Title (${esc(title)}) /Producer (BrokerVerse) >>`);
  const kids = [];
  for (const s of streams) {
    const content = add(Buffer.concat([Buffer.from(`<< /Length ${s.length} >>\nstream\n`), s, Buffer.from('\nendstream')]));
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let offset = parts[0].length;
  const offsets = [];
  objs.forEach((o, idx) => {
    const buf = Buffer.concat([Buffer.from(`${idx + 1} 0 obj\n`), Buffer.isBuffer(o) ? o : Buffer.from(o, 'latin1'), Buffer.from('\nendobj\n')]);
    offsets.push(offset);
    parts.push(buf);
    offset += buf.length;
  });
  const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}
