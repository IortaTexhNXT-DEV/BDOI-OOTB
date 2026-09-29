/**
 * Low-level PDF 1.4 writer: pages with drawing operations, the Helvetica / Helvetica-Bold base fonts in
 * WinAnsiEncoding, and image XObjects (PNG as /FlateDecode with an /SMask for transparency, JPEG as /DCTDecode).
 * Content streams stay uncompressed (small, and readable in tests); image data is compressed.
 */
import zlib from 'node:zlib';
import { toWinAnsi } from './fonts.js';

export const PAGE_SIZES = { A4: [595.28, 841.89], A3: [841.89, 1190.55], LETTER: [612, 792], LEGAL: [612, 1008] };

/** PDF string literal body: WinAnsi text with \ ( ) escaped. */
export const pdfString = (s) => toWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const n = (v) => (Math.round(v * 100) / 100).toString();

/** "#1f4e79" / "1F4E79" / [r, g, b] (0..1) -> [r, g, b]; black when invalid. */
export function rgb(color) {
  if (Array.isArray(color)) return color;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(color || '').trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255].map((x) => Math.round(x * 1000) / 1000);
}

export class Page {
  constructor(width, height) { this.width = width; this.height = height; this.ops = []; this.images = new Set(); }

  text(x, y, s, { size = 9, bold = false, color = null } = {}) {
    const c = color ? `${rgb(color).map(n).join(' ')} rg ` : '';
    this.ops.push(`BT ${c}/${bold ? 'F2' : 'F1'} ${n(size)} Tf ${n(x)} ${n(y)} Td (${pdfString(s)}) Tj ET${color ? ' 0 g' : ''}`);
  }

  rect(x, y, w, h, { fill = null, stroke = null, width = 0.5 } = {}) {
    const ops = [];
    if (fill) ops.push(`${rgb(fill).map(n).join(' ')} rg`);
    if (stroke) ops.push(`${rgb(stroke).map(n).join(' ')} RG ${n(width)} w`);
    ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
    this.ops.push(`q ${ops.join(' ')} Q`);
  }

  line(x1, y1, x2, y2, { color = '#999999', width = 0.5, dash = null } = {}) {
    this.ops.push(`q ${rgb(color).map(n).join(' ')} RG ${n(width)} w ${dash ? `[${dash.join(' ')}] 0 d ` : ''}${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S Q`);
  }

  /** Draw a registered image (see PdfWriter#addImage) with its lower-left corner at (x, y). */
  image(img, x, y, w, h) {
    this.images.add(img);
    this.ops.push(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(y)} cm /${img.name} Do Q`);
  }
}

export class PdfWriter {
  constructor({ title = '', author = '', subject = '' } = {}) { this.pages = []; this.images = []; this.info = { title, author, subject }; }

  addPage(width, height) { const p = new Page(width, height); this.pages.push(p); return p; }

  /** Register a decoded image (lib/pdf/image.js#loadImage); returns a handle for Page#image. */
  addImage(img) {
    if (!img) return null;
    const existing = this.images.find((i) => i.src === img);
    if (existing) return existing;
    const handle = { name: `Im${this.images.length + 1}`, src: img, width: img.width, height: img.height };
    this.images.push(handle);
    return handle;
  }

  toBuffer() {
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };
    const catalog = add(null);
    const pagesId = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const stream = (dict, data) => Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);
    for (const h of this.images) {
      const img = h.src;
      if (img.type === 'jpeg') {
        const cs = img.components === 1 ? '/DeviceGray' : img.components === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
        h.id = add(stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode`, img.data));
      } else {
        const smask = img.alpha ? add(stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, zlib.deflateSync(img.alpha))) : null;
        h.id = add(stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /${img.colorSpace} /BitsPerComponent 8 /Filter /FlateDecode${smask ? ` /SMask ${smask} 0 R` : ''}`, zlib.deflateSync(img.pixels)));
      }
    }
    const kids = [];
    for (const p of this.pages) {
      const content = add(stream('', Buffer.from(p.ops.join('\n'), 'latin1')));
      const xobj = [...p.images].map((h) => `/${h.name} ${h.id} 0 R`).join(' ');
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(p.width)} ${n(p.height)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xobj ? ` /XObject << ${xobj} >>` : ''} /ProcSet [/PDF /Text /ImageB /ImageC] >> /Contents ${content} 0 R >>`));
    }
    const d = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    const created = `D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    const info = add(`<< /Title (${pdfString(this.info.title)}) /Author (${pdfString(this.info.author)}) /Subject (${pdfString(this.info.subject)}) /Producer (BrokerVerse) /CreationDate (${created}) >>`);
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

    const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
    let offset = parts[0].length;
    const offsets = [];
    objs.forEach((o, i) => {
      const buf = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), Buffer.isBuffer(o) ? o : Buffer.from(o, 'latin1'), Buffer.from('\nendobj\n', 'latin1')]);
      offsets.push(offset);
      parts.push(buf);
      offset += buf.length;
    });
    const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
    return Buffer.concat(parts);
  }
}
