/**
 * Document renderer: turns a document spec into pages of a PdfWriter. Every document gets the company letterhead on
 * page 1 (logo, name, address, TIN / licence / contact), a compact running header on later pages and a footer on
 * every page (company, "Generated <date time> by <user>", "Page X of Y").
 *
 * Spec: { title, number, subtitle, params, meta: [[label, value]], sections: [...], letterhead, generatedAt,
 *   generatedBy, format, footerNote | footer, pageSize: 'A4' | 'A3' | 'LETTER', orientation: 'portrait' | 'landscape',
 *   autoFit (reports: shrink the font, then A3) }
 * Sections: { heading, rows: [[label, value]], columns: 2 } | { heading, table: { columns, rows, widths?, totals?,
 *   totalRow?, fontSize? } } | { heading, text } | { heading, signatures: ['Prepared by' | { label, name }] }
 *   | { note } | { spacer: points } | { pageBreak: true }
 */
import { PAGE_SIZES } from './writer.js';
import { loadImage } from './image.js';
import { textWidth, wrapText } from './fonts.js';
import { DEFAULT_FORMAT, formatDate } from './format.js';
import { allocateWidths, prepareTable, CELL_PAD } from './table.js';

const COLORS = { text: '#1a1a1a', muted: '#5f6b76', rule: '#b8c2cc', zebra: '#f3f6f9', total: '#e3e9f0', headingBg: '#e9eff5' };
const decoded = new WeakMap();

/** Decoded logo image for a letterhead ({ buffer } or an already decoded image); cached per buffer. */
function logoImage(letterhead) {
  const logo = letterhead?.logo;
  if (!logo) return null;
  if (logo.pixels || logo.type === 'jpeg') return logo.width ? logo : null;
  if (!Buffer.isBuffer(logo.buffer)) return null;
  if (!decoded.has(logo.buffer)) decoded.set(logo.buffer, loadImage(logo.buffer));
  return decoded.get(logo.buffer);
}

export class DocRenderer {
  constructor(writer, spec, { pageSize, orientation, fontScale = 1 } = {}) {
    this.w = writer;
    this.spec = spec;
    this.fmt = { ...DEFAULT_FORMAT, ...(spec.format || {}) };
    const [a, b] = PAGE_SIZES[String(pageSize || spec.pageSize || 'A4').toUpperCase()] || PAGE_SIZES.A4;
    const landscape = (orientation || spec.orientation) === 'landscape';
    [this.W, this.H] = landscape ? [b, a] : [a, b];
    this.M = landscape ? 30 : 40;
    this.avail = this.W - 2 * this.M;
    this.accent = spec.accentColor || '#1f4e79';
    this.fontScale = fontScale;
    this.pages = [];
    this.lh = spec.letterhead || null;
    this.logo = logoImage(this.lh);
    this.logoHandle = this.logo ? writer.addImage(this.logo) : null;
    const note = spec.footerNote ?? spec.footer ?? '';
    this.noteLines = note ? wrapText(note, 7, this.avail).slice(0, 3) : [];
    this.bottom = 52 + this.noteLines.length * 9;
  }

  get company() { return this.lh?.name || ''; }

  // ---------- pages ----------

  newPage() {
    this.page = this.w.addPage(this.W, this.H);
    this.pages.push(this.page);
    if (this.pages.length === 1) this.drawLetterhead(); else this.drawRunningHeader();
    return this.page;
  }

  /** Make room for h points, starting a new page when needed; returns true when a page was added. */
  ensure(h) {
    if (this.y - h >= this.bottom) return false;
    this.newPage();
    return true;
  }

  drawLetterhead() {
    const p = this.page;
    const { M, W } = this;
    const top = this.H - (this.W > 700 ? 26 : 32);
    const lh = this.lh || {};
    const title = this.spec.title || 'Document';
    const number = this.spec.number || '';
    const sub = this.spec.number ? '' : (this.spec.subtitle || '');
    // logo size first: the company text starts to its right
    let x0 = M;
    let logoBottom = top;
    let logoBox = null;
    if (this.logo) {
      const maxH = this.W > 700 ? 40 : 46;
      const s2 = Math.min(maxH / this.logo.height, 150 / this.logo.width);
      logoBox = [this.logo.width * s2, this.logo.height * s2];
      x0 = M + logoBox[0] + 14;
      logoBottom = top - logoBox[1];
    }
    const reg = [lh.tin ? `TIN ${lh.tin}` : '', lh.licence ? `IC Licence No. ${lh.licence}` : ''].filter(Boolean).join('   |   ');
    const contact = [lh.phone ? `Tel. ${lh.phone}` : '', lh.email || '', lh.website || ''].filter(Boolean).join('   |   ');
    // the company block keeps the width it needs (up to 230 pt); the title block gets the rest, at least 30%
    const companyNeed = Math.min(230, Math.max(0, textWidth(lh.name || '', 12, true), ...(lh.addressLines || []).map((a) => textWidth(a, 8)),
      textWidth(reg, 7.5), textWidth(contact, 7.5)) + 4);
    const maxRight = Math.max(this.avail * 0.3, W - M - 18 - x0 - companyNeed);
    let titleSize = this.W > 700 ? 14 : 15;
    while (titleSize > 12 && textWidth(title, titleSize, true) > maxRight) titleSize -= 0.5;
    const rightW = Math.min(Math.max(textWidth(title, titleSize, true), textWidth(`No. ${number}`, 10, true), textWidth(sub, 9), textWidth(this.spec.dateLine || '', 8.5)) + 2, maxRight);
    const titleLines = wrapText(title, titleSize, rightW, { bold: true });
    let ry = top - titleSize;
    for (const l of titleLines) { p.text(W - M - textWidth(l, titleSize, true), ry, l, { size: titleSize, bold: true, color: this.accent }); ry -= titleSize + 3; }
    if (number) { ry -= 2; p.text(W - M - textWidth(`No. ${number}`, 10, true), ry, `No. ${number}`, { size: 10, bold: true, color: COLORS.text }); ry -= 13; }
    for (const l of sub ? wrapText(sub, 9, rightW) : []) { p.text(W - M - textWidth(l, 9), ry, l, { size: 9, color: COLORS.muted }); ry -= 12; }
    if (this.spec.dateLine) { p.text(W - M - textWidth(this.spec.dateLine, 8.5), ry, this.spec.dateLine, { size: 8.5, color: COLORS.muted }); ry -= 12; }
    // left block: logo, company name, address, registration and contact lines
    if (logoBox) p.image(this.logoHandle, M, top - logoBox[1], logoBox[0], logoBox[1]);
    const textW = Math.max(100, W - M - rightW - 18 - x0);
    let y = top - 11;
    if (lh.name) for (const l of wrapText(lh.name, 12, textW, { bold: true })) { p.text(x0, y, l, { size: 12, bold: true, color: COLORS.text }); y -= 14; }
    y -= 1;
    for (const a of lh.addressLines || []) for (const l of wrapText(a, 8, textW)) { p.text(x0, y, l, { size: 8, color: COLORS.text }); y -= 10; }
    for (const t of [reg, contact].filter(Boolean)) for (const l of wrapText(t, 7.5, textW)) { p.text(x0, y, l, { size: 7.5, color: COLORS.muted }); y -= 9.5; }
    const bandBottom = Math.min(y + 4, logoBottom, ry + 6);
    const ruleY = bandBottom - 8;
    p.rect(M, ruleY, this.avail, 1.6, { fill: this.accent });
    this.y = ruleY - 10;
    if (this.spec.params) {
      for (const l of wrapText(this.spec.params, 8, this.avail)) { p.text(M, this.y - 8, l, { size: 8, color: COLORS.muted }); this.y -= 11; }
      this.y -= 6;
    }
  }

  drawRunningHeader() {
    const p = this.page;
    const top = this.H - 28;
    const left = this.company;
    const right = [this.spec.title, this.spec.number].filter(Boolean).join('  -  ');
    p.text(this.M, top, left, { size: 8.5, bold: true, color: COLORS.text });
    p.text(this.W - this.M - textWidth(right, 8.5, true), top, right, { size: 8.5, bold: true, color: this.accent });
    p.rect(this.M, top - 7, this.avail, 0.8, { fill: this.accent });
    this.y = top - 18;
  }

  /** Footers once the page count is known: company, generated-by line, page X of Y and the optional note. */
  finish() {
    const total = this.pages.length;
    const gen = [this.spec.generatedAt ? `Generated ${this.spec.generatedAt}` : '', this.spec.generatedBy ? `by ${this.spec.generatedBy}` : ''].filter(Boolean).join(' ');
    this.pages.forEach((p, i) => {
      let ny = 44 + this.noteLines.length * 9;
      for (const l of this.noteLines) { p.text(this.M + (this.avail - textWidth(l, 7)) / 2, ny - 9, l, { size: 7, color: COLORS.muted }); ny -= 9; }
      p.line(this.M, 38, this.W - this.M, 38, { color: COLORS.rule, width: 0.6 });
      if (this.company) p.text(this.M, 28, this.company, { size: 7, bold: true, color: COLORS.muted });
      if (gen) p.text(this.M, 19, gen, { size: 7, color: COLORS.muted });
      const pg = `Page ${i + 1} of ${total}`;
      p.text(this.W - this.M - textWidth(pg, 7), 28, pg, { size: 7, color: COLORS.muted });
    });
  }

  // ---------- sections ----------

  heading(text) {
    this.ensure(18 + 40);
    const p = this.page;
    this.y -= 4;
    p.rect(this.M, this.y - 15, this.avail, 15, { fill: COLORS.headingBg });
    p.rect(this.M, this.y - 15, 2.5, 15, { fill: this.accent });
    p.text(this.M + 8, this.y - 10.8, text, { size: 9.5, bold: true, color: this.accent });
    this.y -= 21;
  }

  keyValues(rows, columns = 2) {
    const list = rows.filter((r) => r && r.length);
    if (!list.length) return;
    const gap = 14;
    const cellW = (this.avail - gap * (columns - 1)) / columns;
    const labelW = Math.min(Math.max(...list.map((r) => textWidth(r[0], 7.5, true))) + 10, cellW * 0.42);
    const valueW = cellW - labelW;
    for (let i = 0; i < list.length; i += columns) {
      const cells = list.slice(i, i + columns).map((r) => {
        const v = r[1] === null || r[1] === undefined || r[1] === '' ? '-' : String(r[1]);
        return { label: wrapText(r[0], 7.5, labelW - 8, { bold: true }), value: wrapText(v, 9, valueW - 2, { bold: !!r[2]?.bold }), bold: !!r[2]?.bold };
      });
      const lines = Math.max(...cells.map((c) => Math.max(c.label.length, c.value.length)));
      const h = lines * 11.5 + 2;
      this.ensure(h);
      cells.forEach((c, k) => {
        const x = this.M + k * (cellW + gap);
        c.label.forEach((l, j) => this.page.text(x, this.y - 9 - j * 11.5, l, { size: 7.5, bold: true, color: COLORS.muted }));
        c.value.forEach((l, j) => this.page.text(x + labelW, this.y - 9 - j * 11.5, l, { size: 9, bold: c.bold, color: COLORS.text }));
      });
      this.y -= h;
    }
    this.y -= 6;
  }

  paragraph(text, { size = 9, color = COLORS.text, bold = false } = {}) {
    const lead = size * 1.4;
    for (const l of wrapText(text, size, this.avail)) {
      this.ensure(lead);
      this.page.text(this.M, this.y - size, l, { size, color, bold });
      this.y -= lead;
    }
    this.y -= 6;
  }

  signatures(items, perRow) {
    const list = items.map((s) => (typeof s === 'string' ? { label: s } : s));
    const n = perRow || Math.min(list.length, this.W > 700 ? 5 : 4);
    const gap = 22;
    const bw = (this.avail - gap * (n - 1)) / n;
    for (let i = 0; i < list.length; i += n) {
      this.ensure(62);
      const lineY = this.y - 38;
      list.slice(i, i + n).forEach((s, k) => {
        const x = this.M + k * (bw + gap);
        this.page.line(x, lineY, x + bw, lineY, { color: '#333333', width: 0.6 });
        this.page.text(x, lineY - 10, s.label, { size: 8, bold: true, color: COLORS.text });
        if (s.name) this.page.text(x, lineY - 20, s.name, { size: 8, color: COLORS.muted });
        else this.page.text(x, lineY - 20, 'Signature over printed name / date', { size: 6.5, color: COLORS.muted });
      });
      this.y = lineY - 30;
    }
  }

  /** Draw a table; header row repeated after page breaks, zebra rows, total rows bold on a grey band. */
  table(tbl, { fontSize } = {}) {
    const prepared = tbl.prepared || prepareTable(tbl, this.fmt);
    if (!prepared.columns.length) return;
    let size = (fontSize || tbl.fontSize || (this.W > 700 ? 7.5 : 8)) * (tbl.fontSize ? 1 : this.fontScale);
    let alloc = allocateWidths(prepared, this.avail, size);
    // A document table that does not fit: shrink the font down to 6 pt before letting codes wrap
    while (!alloc.fits && size > 6) { size = Math.max(6, size - 0.5); alloc = allocateWidths(prepared, this.avail, size); }
    const { widths } = alloc;
    const cols = prepared.columns;
    const lead = size * 1.28;
    const padV = 3;
    const cellLines = (cells, bold) => cells.map((s, i) => wrapText(s, size, widths[i] - 2 * CELL_PAD, { bold }));
    const headerLines = cellLines(cols.map((c) => c.label), true);
    const headerH = Math.max(...headerLines.map((l) => l.length)) * lead + 2 * padV;
    const drawHeader = () => {
      const p = this.page;
      p.rect(this.M, this.y - headerH, this.avail, headerH, { fill: this.accent });
      let x = this.M;
      headerLines.forEach((lines, i) => {
        lines.forEach((l, j) => {
          const tx = cols[i].align === 'right' ? x + widths[i] - CELL_PAD - textWidth(l, size, true) : x + CELL_PAD;
          p.text(tx, this.y - padV - size * 0.92 - j * lead, l, { size, bold: true, color: '#ffffff' });
        });
        x += widths[i];
      });
      this.y -= headerH;
    };
    this.ensure(headerH + lead + 2 * padV);
    drawHeader();
    prepared.rows.forEach((cells, r) => {
      const isTotal = r >= prepared.totalFrom;
      const lines = cellLines(cells, isTotal);
      const h = Math.max(1, ...lines.map((l) => l.length)) * lead + 2 * padV;
      if (this.ensure(h)) drawHeader();
      const p = this.page;
      if (isTotal) {
        p.rect(this.M, this.y - h, this.avail, h, { fill: COLORS.total });
        p.line(this.M, this.y, this.M + this.avail, this.y, { color: '#6b7a89', width: 0.8 });
      } else if (r % 2 === 1) p.rect(this.M, this.y - h, this.avail, h, { fill: COLORS.zebra });
      let x = this.M;
      lines.forEach((ls, i) => {
        ls.forEach((l, j) => {
          const tx = cols[i].align === 'right' ? x + widths[i] - CELL_PAD - textWidth(l, size, isTotal) : x + CELL_PAD;
          p.text(tx, this.y - padV - size * 0.92 - j * lead, l, { size, bold: isTotal, color: COLORS.text });
        });
        x += widths[i];
      });
      this.y -= h;
    });
    this.page.line(this.M, this.y, this.M + this.avail, this.y, { color: COLORS.rule, width: 0.6 });
    this.y -= 10;
  }

  // ---------- whole document ----------

  render() {
    const s = this.spec;
    this.newPage();
    if (s.meta?.length) this.keyValues(s.meta, s.metaColumns || 2);
    for (const sec of s.sections || []) {
      if (!sec) continue;
      if (sec.pageBreak) { this.newPage(); continue; }
      if (sec.spacer) { this.y -= sec.spacer; continue; }
      const empty = !sec.rows?.length && !sec.table && !sec.text && !sec.signatures?.length && !sec.note;
      if (empty) continue;
      if (sec.heading) this.heading(sec.heading);
      if (sec.rows?.length) this.keyValues(sec.rows, sec.columns || 2);
      if (sec.table) this.table(sec.table);
      if (sec.text) this.paragraph(sec.text, { bold: !!sec.bold });
      if (sec.note) this.paragraph(sec.note, { size: 7.5, color: COLORS.muted });
      if (sec.signatures?.length) this.signatures(sec.signatures, sec.perRow);
    }
    this.finish();
    return this.pages.length;
  }
}

/** Format a date for display in a spec (used by templates that print dates in meta rows). */
export const displayDate = (v, fmt) => formatDate(v, { ...DEFAULT_FORMAT, ...(fmt || {}) });
