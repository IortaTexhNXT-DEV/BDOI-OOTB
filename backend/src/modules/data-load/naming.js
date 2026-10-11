/**
 * Document file naming convention of the migration (BRD MIG-01): the files of the legacy system are named so that each
 * one names the record it belongs to, before they are attached on the record screens.
 *
 *   <RecordType>_<RecordNumber>_<DocumentType>_<YYYYMMDD>[_<n>].<ext>
 *   RecordType    CLT client, POL policy, END endorsement, CLM claim, BIL bill
 *   RecordNumber  the legacy number as loaded (client code, policy number, claim number, bill reference), / and spaces as -
 *   DocumentType  a code of the setting migration.document_types (POLSCH, COC, OR, ID, ORCR, LOAN, ENDT ...)
 *   YYYYMMDD      the document date; _<n> a sequence when several files share the rest of the name
 *   ext           pdf, jpg, jpeg, png, tif, tiff
 *
 * The checker reads a list of file names (never the files): an .xlsx or .csv with the names in its first column (or a
 * column "File Name"), or a .txt with one name per line. Each name is valid or invalid with the reason, and the record it
 * names is found in BrokerVerse or not (by legacy number, the / and spaces of the stored number read as -). The result is
 * kept (generated_reports, code migration-document-names) so its workbook can be downloaded once the check is done.
 */
import { many, one } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { readWorkbook } from '../documents/xlsx.js';
import { isDate } from './common.js';

export const RECORD_TYPES = { CLT: 'Client', POL: 'Policy', END: 'Endorsement', CLM: 'Claim', BIL: 'Bill' };
export const EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];
export const NAMING_PATTERN = '<RecordType>_<RecordNumber>_<DocumentType>_<YYYYMMDD>[_<n>].<ext>';
export const NAMING_EXAMPLE = 'POL_PC-MLY-2026-000101_POLSCH_20260225.pdf';
const REPORT_CODE = 'migration-document-names';
const MAX_NAMES = 20000;

/** Document type codes of the convention (setting migration.document_types). */
export async function documentTypes() {
  const v = await getSetting('migration.document_types', []);
  return Array.isArray(v) ? v.map((x) => String(x).trim().toUpperCase()).filter(Boolean) : [];
}

/** The convention as the Templates tab shows it: the pattern, an example, the record types, document types and extensions. */
export async function namingConvention() {
  return { pattern: NAMING_PATTERN, example: NAMING_EXAMPLE, recordTypes: Object.entries(RECORD_TYPES).map(([code, label]) => ({ code, label })),
    documentTypes: await documentTypes(), extensions: EXTENSIONS };
}

/** The parts of a file name, or the reason it does not follow the convention: { valid, reason?, recordType, recordNumber, documentType, date, sequence, ext }. */
export function parseName(name, types) {
  const file = String(name || '').trim();
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return { valid: false, reason: 'No file extension' };
  const ext = file.slice(dot + 1);
  if (!EXTENSIONS.includes(ext.toLowerCase())) return { valid: false, reason: `Extension .${ext} is not one of ${EXTENSIONS.join(', ')}` };
  if (ext !== ext.toLowerCase()) return { valid: false, reason: `Extension .${ext} must be in lower case` };
  const parts = file.slice(0, dot).split('_');
  if (parts.length < 4 || parts.length > 5) return { valid: false, reason: `The name must have the parts ${NAMING_PATTERN}` };
  const [recordType, recordNumber, documentType, date, sequence = null] = parts;
  if (!RECORD_TYPES[recordType]) return { valid: false, reason: `Record type ${recordType} is not one of ${Object.keys(RECORD_TYPES).join(', ')}` };
  if (!recordNumber || /[\s/]/.test(recordNumber)) return { valid: false, reason: 'The record number is empty or holds / or spaces (write them as -)' };
  if (!types.includes(documentType)) return { valid: false, reason: `Document type ${documentType} is not one of ${types.join(', ')}` };
  const iso = /^\d{8}$/.test(date) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` : null;
  if (!iso || !isDate(iso)) return { valid: false, reason: `Date ${date} is not a date YYYYMMDD` };
  if (sequence !== null && !/^[1-9]\d*$/.test(sequence)) return { valid: false, reason: `Sequence ${sequence} must be a number from 1` };
  return { valid: true, recordType, recordNumber, documentType, date: iso, sequence: sequence === null ? null : Number(sequence), ext: ext.toLowerCase() };
}

/** Where the record of each type is found by its legacy number (stored / and spaces read as -). */
const LOOKUP = {
  CLT: "SELECT n FROM unnest($1::text[]) n WHERE EXISTS (SELECT 1 FROM clients c WHERE regexp_replace(COALESCE(c.legacy_number, c.client_code), '[/[:space:]]', '-', 'g') = n)",
  POL: "SELECT n FROM unnest($1::text[]) n WHERE EXISTS (SELECT 1 FROM policies p WHERE regexp_replace(COALESCE(p.legacy_number, p.policy_number), '[/[:space:]]', '-', 'g') = n OR regexp_replace(p.policy_number, '[/[:space:]]', '-', 'g') = n)",
  END: "SELECT n FROM unnest($1::text[]) n WHERE EXISTS (SELECT 1 FROM endorsements e WHERE regexp_replace(e.endorsement_number, '[/[:space:]]', '-', 'g') = n)",
  CLM: "SELECT n FROM unnest($1::text[]) n WHERE EXISTS (SELECT 1 FROM claims c WHERE regexp_replace(COALESCE(c.legacy_number, c.claim_number), '[/[:space:]]', '-', 'g') = n)",
  BIL: "SELECT n FROM unnest($1::text[]) n WHERE EXISTS (SELECT 1 FROM receivables r WHERE regexp_replace(COALESCE(r.legacy_number, r.reference, r.bill_number), '[/[:space:]]', '-', 'g') = n OR regexp_replace(r.bill_number, '[/[:space:]]', '-', 'g') = n)",
};

/** File names of an uploaded list: .txt one per line, .xlsx / .csv the column "File Name" or the first column. */
export function namesOf(file) {
  if (!file?.buffer?.length) throw badRequest('Upload the list of file names (.xlsx, .csv or .txt) in the "file" field');
  const ext = String(file.originalname || '').toLowerCase().split('.').pop();
  let names;
  if (ext === 'txt' || ext === 'csv') {
    const lines = file.buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const cells = ext === 'csv' ? lines.map((l) => l.split(',')[0].replace(/^"|"$/g, '').trim()) : lines;
    names = cells.length && /^file ?name$/i.test(cells[0]) ? cells.slice(1) : cells;
  } else if (ext === 'xlsx') {
    let book;
    try {
      book = readWorkbook(file.buffer);
    } catch (e) {
      throw badRequest(`Could not read the workbook: ${e.message}`);
    }
    const rows = book[0].rows;
    const col = Math.max(0, (rows[0] || []).findIndex((h) => /^file ?name$/i.test(String(h ?? '').trim())));
    const header = rows.length && /^file ?name$/i.test(String(rows[0][col] ?? '').trim());
    names = rows.slice(header ? 1 : 0).map((r) => String(r[col] ?? '').trim()).filter(Boolean);
  } else throw badRequest('The list of file names must be an .xlsx, .csv or .txt file');
  if (!names.length) throw badRequest('The list holds no file name');
  if (names.length > MAX_NAMES) throw badRequest(`The list holds ${names.length} names; check at most ${MAX_NAMES} at a time`);
  return names;
}

/** Check names: [{ name, valid, reason, recordType, recordNumber, documentType, date, recordFound }]. */
export async function checkNames(names) {
  const types = await documentTypes();
  const parsed = names.map((name) => ({ name, ...parseName(name, types) }));
  const seen = new Map();
  for (const p of parsed) {
    if (!p.valid) continue;
    const k = p.name.toLowerCase();
    if (seen.has(k)) Object.assign(p, { valid: false, reason: 'Same file name as an earlier line: add a sequence _<n>' });
    else seen.set(k, true);
  }
  const found = new Set();
  for (const type of Object.keys(LOOKUP)) {
    const numbers = [...new Set(parsed.filter((p) => p.valid && p.recordType === type).map((p) => p.recordNumber))];
    if (!numbers.length) continue;
    for (const r of await many(LOOKUP[type], [numbers])) found.add(`${type}|${r.n}`);
  }
  return parsed.map((p) => ({ name: p.name, valid: p.valid, reason: p.reason || null, recordType: p.recordType || null, recordTypeLabel: RECORD_TYPES[p.recordType] || null,
    recordNumber: p.recordNumber || null, documentType: p.documentType || null, date: p.date || null, recordFound: p.valid ? found.has(`${p.recordType}|${p.recordNumber}`) : null }));
}

const summaryOf = (results) => ({ names: results.length, valid: results.filter((r) => r.valid).length, invalid: results.filter((r) => !r.valid).length,
  recordFound: results.filter((r) => r.recordFound).length, recordMissing: results.filter((r) => r.valid && !r.recordFound).length });

/** Check an uploaded list and keep the result: { token, fileName, summary, results }. */
export async function checkUpload(file, user) {
  const results = await checkNames(namesOf(file));
  const summary = summaryOf(results);
  const r = await one(`INSERT INTO generated_reports(code, name, params, format, row_count, generated_by, status, file_name, totals)
    VALUES ($1, 'Document name check', $2, 'xlsx', $3, $4, 'done', $5, $6) RETURNING id`,
  [REPORT_CODE, JSON.stringify({ fileName: file.originalname || null, results }), results.length, user?.id ?? null, 'Document_Name_Check.xlsx', JSON.stringify(summary)]);
  return { token: r.id, fileName: file.originalname || null, summary, results };
}

/** Workbook of a kept check (only the user who ran it): Summary and one row per name. */
export async function checkWorkbook(token, user) {
  const r = await one('SELECT params, totals, generated_by, created_at FROM generated_reports WHERE id = $1 AND code = $2', [String(token), REPORT_CODE]);
  if (!r || (r.generated_by && r.generated_by !== user?.id)) throw notFound('Document name check not found');
  const results = r.params?.results || [];
  const s = r.totals || summaryOf(results);
  return {
    fileName: 'Document_Name_Check.xlsx',
    buffer: writeXlsx({
      title: 'Document name check', creator: 'BrokerVerse',
      sheets: [
        { name: 'Summary', headerStyle: 'navy', autoFilter: false, columns: [{ header: 'Item', width: 30 }, { header: 'Value', width: 50 }],
          rows: [['List', r.params?.fileName || ''], ['Convention', NAMING_PATTERN], ['Example', NAMING_EXAMPLE], ['Names', s.names], ['Valid', s.valid], ['Invalid', s.invalid],
            ['Record found', s.recordFound], ['Record not found', s.recordMissing]] },
        { name: 'Names', headerStyle: 'navy',
          columns: [{ header: 'File Name', width: 50 }, { header: 'Result', width: 12 }, { header: 'Reason', width: 60, type: 'wrap' }, { header: 'Record Type', width: 14 },
            { header: 'Record Number', width: 26 }, { header: 'Document Type', width: 16 }, { header: 'Document Date', width: 14 }, { header: 'Record in BrokerVerse', width: 20 }],
          rows: results.map((x) => [x.name, x.valid ? 'Valid' : 'Invalid', x.reason || '', x.recordTypeLabel || '', x.recordNumber || '', x.documentType || '', x.date || '',
            x.recordFound === null ? '' : x.recordFound ? 'Found' : 'Not found']),
          rowStyles: results.map((x) => (!x.valid ? 'bad' : x.recordFound ? 'good' : 'changed')) },
      ],
    }),
  };
}
