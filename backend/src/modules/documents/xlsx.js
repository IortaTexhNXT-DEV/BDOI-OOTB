/**
 * Minimal XLSX support without dependencies: read the first worksheet of an uploaded workbook into rows (XLSX files
 * are ZIP archives of XML parts; zlib handles DEFLATE), and write a single-sheet workbook through lib/xlsx.js.
 */
import { assertRowLimit, inflateEntry } from '../../lib/uploadLimits.js';
import { writeXlsx as writeWorkbook } from '../../lib/xlsx.js';

// ---------- ZIP ----------
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid XLSX (zip) file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    files.set(name, { method, csize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const get = (name) => {
    const f = files.get(name);
    if (!f) return null;
    const start = f.local + 30 + buf.readUInt16LE(f.local + 26) + buf.readUInt16LE(f.local + 28);
    const data = buf.subarray(start, start + f.csize);
    return inflateEntry(data, f.method).toString('utf8');
  };
  return { get, names: [...files.keys()] };
}

// ---------- XML helpers ----------
const codePoint = (n) => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');
/**
 * Text of an XML text node: the five named entities and numeric character references (&#8211; &#xF1;), which some
 * spreadsheet writers (e.g. openpyxl) use for every character outside ASCII.
 */
export const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => codePoint(Number(d))).replace(/&amp;/g, '&');
/** Cell text: OOXML escapes _xHHHH_ (Excel writes a carriage return as _x000D_; _x005F_ is a literal underscore). */
export const cellText = (s) => unxml(s).replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
/** Text of a shared or inline string: its runs (<r><t>), without the phonetic guides (<rPh>). */
export const texts = (frag) => [...frag.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => cellText(m[1])).join('');
const colIndex = (ref) => {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Rows (arrays of strings) of one worksheet part. */
function sheetRows(xml, shared, { positions = false } = {}) {
  const rows = [];
  for (const rm of xml.matchAll(/<row([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row = [];
    for (const cm of (rm[2] || '').matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/t="(\w+)"/) || [])[1];
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = texts(body);
      else if (v !== undefined) value = unxml(v);
      row[ref ? colIndex(ref) : row.length] = value;
    }
    // keep the row position: a workbook may skip empty rows (r="5" after r="3")
    const r = Number((rm[1].match(/\br="(\d+)"/) || [])[1]);
    const out = Array.from(row, (x) => x ?? '');
    if (positions && r && r > rows.length + 1) while (rows.length < r - 1) rows.push([]);
    rows.push(out);
    assertRowLimit(rows.length - 1);
  }
  return rows;
}

const sharedStrings = (zip) => [...(zip.get('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

/** Parse the first worksheet into an array of arrays of strings. */
export function readXlsx(buf) {
  const zip = readZip(buf);
  const shared = sharedStrings(zip);
  const sheetName = zip.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!sheetName) throw new Error('Workbook has no worksheet');
  return sheetRows(zip.get(sheetName), shared);
}

/**
 * Every worksheet of a workbook, in workbook order: [{ name, rows }] (rows: arrays of strings; row i is sheet row
 * i + 1, empty rows kept as []). Sheet names come from xl/workbook.xml and its relationships.
 */
export function readWorkbook(buf) {
  const zip = readZip(buf);
  const shared = sharedStrings(zip);
  const book = zip.get('xl/workbook.xml') || '';
  const rels = zip.get('xl/_rels/workbook.xml.rels') || '';
  const targets = new Map([...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [
    (m[1].match(/\bId="([^"]+)"/) || [])[1], (m[1].match(/\bTarget="([^"]+)"/) || [])[1]]));
  const sheets = [];
  for (const m of book.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = unxml((m[1].match(/\bname="([^"]*)"/) || [])[1] || '');
    const rid = (m[1].match(/\br:id="([^"]+)"/) || [])[1];
    let target = targets.get(rid) || '';
    target = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = zip.get(target);
    if (xml !== null && xml !== undefined) sheets.push({ name, rows: sheetRows(xml, shared, { positions: true }) });
  }
  if (!sheets.length) throw new Error('Workbook has no worksheet');
  return sheets;
}

/** Build a one-sheet XLSX from a header row and data rows (numbers stay numeric). */
export function writeXlsx(header, rows, sheetName = 'Report') {
  return writeWorkbook({ sheets: [{ name: sheetName, columns: header.map((h) => ({ header: String(h ?? ''), type: 'auto' })), rows }] });
}
