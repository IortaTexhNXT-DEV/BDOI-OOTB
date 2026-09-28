/**
 * Minimal PDF writer (no dependencies): A4 pages, Helvetica / Helvetica-Bold, headings, key-value blocks,
 * tables and paragraphs with automatic page breaks. Enough for schedules, billing statements, slips and receipts.
 *
 * Document spec: { title, subtitle, meta: [[label, value]], sections: [
 *   { heading, rows: [[label, value], ...] } | { heading, table: { columns: [...], rows: [[...]], widths?: [...] } }
 *   | { heading, text } ], footer }
 */
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const LINE = 13;

/** Keep text printable in WinAnsi; the peso sign has no glyph in the base fonts. */
const clean = (s) => String(s ?? '').replace(/₱/g, 'PHP ').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
const esc = (s) => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
/** Approximate Helvetica advance width (points) used for truncation and right alignment. */
const textWidth = (s, size) => clean(s).length * size * 0.5;
const fit = (s, size, width) => {
  const t = clean(s);
  const max = Math.max(1, Math.floor(width / (size * 0.5)));
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 2))}..`;
};
const wrap = (s, size, width) => {
  const max = Math.max(10, Math.floor(width / (size * 0.5)));
  const out = [];
  for (const para of clean(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if ((`${line} ${word}`).trim().length > max) { if (line) out.push(line); line = word; } else line = `${line} ${word}`.trim();
    }
    out.push(line);
  }
  return out;
};

class Canvas {
  constructor() { this.pages = []; this.newPage(); }
  newPage() { this.ops = []; this.pages.push(this.ops); this.y = PAGE_H - MARGIN; }
  ensure(h) { if (this.y - h < MARGIN + 20) this.newPage(); }
  text(x, y, s, { size = 9, bold = false } = {}) { this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`); }
  line(x1, y1, x2, y2, gray = 0.6) { this.ops.push(`${gray} G 0.5 w ${x1} ${y1} m ${x2} ${y2} l S 0 G`); }
  band(y, h, gray = 0.92) { this.ops.push(`${gray} g ${MARGIN} ${y} ${PAGE_W - 2 * MARGIN} ${h} re f 0 g`); }
}

function drawHeader(c, doc) {
  c.text(MARGIN, c.y - 16, doc.title || 'Document', { size: 16, bold: true });
  c.y -= 22;
  if (doc.subtitle) { c.text(MARGIN, c.y - 10, doc.subtitle, { size: 10 }); c.y -= 14; }
  c.line(MARGIN, c.y - 4, PAGE_W - MARGIN, c.y - 4, 0.3);
  c.y -= 14;
  if (doc.meta?.length) drawRows(c, doc.meta);
}

function drawHeading(c, heading) {
  c.ensure(LINE * 3);
  c.band(c.y - 14, 16);
  c.text(MARGIN + 4, c.y - 10, heading, { size: 10, bold: true });
  c.y -= 22;
}

function drawRows(c, rows) {
  const half = (PAGE_W - 2 * MARGIN) / 2;
  for (let i = 0; i < rows.length; i += 2) {
    c.ensure(LINE);
    [rows[i], rows[i + 1]].forEach((r, k) => {
      if (!r) return;
      const x = MARGIN + k * half;
      c.text(x, c.y - 9, fit(r[0], 8, 110), { size: 8, bold: true });
      c.text(x + 115, c.y - 9, fit(r[1], 9, half - 125), { size: 9 });
    });
    c.y -= LINE;
  }
  c.y -= 4;
}

function drawTable(c, { columns, rows, widths }) {
  const total = PAGE_W - 2 * MARGIN;
  const w = widths || columns.map(() => total / columns.length);
  const numeric = (v) => typeof v === 'number';
  const rightCol = columns.map((_, i) => rows.length > 0 && rows.every((r) => numeric(r[i])));
  const drawRow = (cells, bold) => {
    c.ensure(LINE);
    let x = MARGIN;
    cells.forEach((v, i) => {
      const s = numeric(v) ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fit(v, 8, w[i] - 6);
      const tx = numeric(v) || rightCol[i] ? x + w[i] - 4 - textWidth(s, 8) : x + 3;
      c.text(tx, c.y - 9, s, { size: 8, bold });
      x += w[i];
    });
    c.y -= LINE;
  };
  drawRow(columns, true);
  c.line(MARGIN, c.y + 2, PAGE_W - MARGIN, c.y + 2);
  for (const r of rows) drawRow(r, false);
  c.y -= 6;
}

function drawText(c, text) {
  for (const l of wrap(text, 9, PAGE_W - 2 * MARGIN)) { c.ensure(LINE); c.text(MARGIN, c.y - 9, l, { size: 9 }); c.y -= LINE; }
  c.y -= 4;
}

/** Render a document spec into a PDF Buffer. */
export function buildPdf(doc) {
  const c = new Canvas();
  drawHeader(c, doc);
  for (const s of doc.sections || []) {
    if (s.heading) drawHeading(c, s.heading);
    if (s.rows) drawRows(c, s.rows);
    if (s.table) drawTable(c, s.table);
    if (s.text) drawText(c, s.text);
  }
  const footer = doc.footer || '';
  c.pages.forEach((ops, i) => {
    ops.push(`BT /F1 7 Tf ${MARGIN} 24 Td (${esc(`${footer}${footer ? '  |  ' : ''}Page ${i + 1} of ${c.pages.length}`)}) Tj ET`);
  });
  return serialize(c.pages);
}

function serialize(pages) {
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const catalog = add(null);
  const pagesObj = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const ops of pages) {
    const stream = ops.join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Send a PDF buffer inline (the front end opens it in a tab or downloads it as a blob). */
export function sendPdf(res, buffer, fileName, disposition = 'inline') {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}
