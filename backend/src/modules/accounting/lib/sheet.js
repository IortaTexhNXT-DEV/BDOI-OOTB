/** Read the first worksheet of an .xlsx file (or a CSV) into row objects keyed by camel-cased header names. */
import zlib from 'node:zlib';
import { badRequest } from '../../../lib/errors.js';

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw badRequest('The file is not a valid .xlsx workbook');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10); const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28); const extraLen = buf.readUInt16LE(p + 30); const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42); const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = () => (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
const texts = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function xlsxRows(buf) {
  const files = unzip(buf);
  const shared = files['xl/sharedStrings.xml'] ? [...files['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : [];
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  if (!sheetName) throw badRequest('The workbook has no worksheet');
  const rows = [];
  for (const rm of files[sheetName]().matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]; const inner = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/t="(\w+)"/) || [])[1];
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val = v === undefined ? '' : decode(v);
      if (type === 's') val = shared[Number(val)] ?? '';
      else if (type === 'inlineStr') val = texts(inner);
      row[ref ? colIndex(ref) : row.length] = val;
    }
    rows.push(row);
  }
  return rows;
}

function csvRows(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch; } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** "Policy Number", "POLICY_NUMBER", "policyNumber" -> policyNumber */
const camel = (h) => {
  const words = String(h || '').trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length === 1) { const w = words[0]; return w === w.toUpperCase() ? w.toLowerCase() : w[0].toLowerCase() + w.slice(1); }
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
};
/** Excel serial date -> YYYY-MM-DD */
export const excelDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (/^\d+(\.\d+)?$/.test(String(v))) return new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000).toISOString().slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Parse an uploaded file buffer into [{header: value}] (header keys camel-cased). */
export function readSheet(buffer, fileName = '') {
  if (!buffer?.length) throw badRequest('Empty file');
  const isZip = buffer.readUInt32LE(0) === 0x04034b50;
  const rows = isZip ? xlsxRows(buffer) : (/\.csv$/i.test(fileName) || !isZip ? csvRows(buffer.toString('utf8')) : []);
  const [header, ...data] = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!header) throw badRequest('The file has no header row');
  const keys = header.map(camel);
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] === undefined ? '' : String(r[i]).trim()])));
}
