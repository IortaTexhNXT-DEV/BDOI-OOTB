/**
 * Insurer statements of account: formats (column mapping per insurer), parsing a CSV / XLSX with a format, preview and
 * import. Parsing reuses the date and amount readers of the bank statement import.
 */
import crypto from 'node:crypto';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { normKey } from '../documents/tabular.js';
import { parseAmount, parseDate, readTable } from '../bank-reconciliation/statements.js';
import { round2 } from '../../lib/money.js';

export const COLUMN_KEYS = ['policyNo', 'insured', 'date', 'reference', 'grossPremium', 'commission', 'taxes', 'amountPaid'];
const AMOUNT_KEYS = { grossPremium: 'gross', commission: 'commission', taxes: 'taxes', amountPaid: 'paid' };
const AMOUNT_LABELS = { grossPremium: 'Gross premium', commission: 'Commission', taxes: 'Taxes', amountPaid: 'Amount paid' };
export const STATEMENT_TYPES = { premium: 'Premium remittance confirmation', commission: 'Commission statement' };

export const formatRow = (f) => f && ({
  code: f.code, name: f.name, insurerId: f.insurance_company_id, insurerName: f.insurer_name || null, description: f.description, fileType: f.file_type,
  skipRows: f.skip_rows, hasHeader: f.has_header, columns: f.columns || {}, dateFormat: f.date_format, skipPattern: f.skip_pattern, active: f.active, updatedAt: f.updated_at,
});

export async function listFormats(db, { insurerId = null, all = false } = {}) {
  return (await db.query(`SELECT f.*, ic.name AS insurer_name FROM insurer_statement_formats f LEFT JOIN insurance_companies ic ON ic.id = f.insurance_company_id
    WHERE ($1 OR f.active) AND ($2::int IS NULL OR f.insurance_company_id IS NULL OR f.insurance_company_id = $2) ORDER BY f.insurance_company_id NULLS LAST, f.code`,
  [all, insurerId ? Number(insurerId) : null])).rows.map(formatRow);
}

export async function getFormat(db, code) {
  const f = (await db.query('SELECT f.*, ic.name AS insurer_name FROM insurer_statement_formats f LEFT JOIN insurance_companies ic ON ic.id = f.insurance_company_id WHERE f.code = $1', [String(code || '')])).rows[0];
  if (!f) throw notFound(`Insurer statement format ${code} not found`);
  return f;
}

/** Create (code null) or update a format. Returns { before, after }. */
export async function saveFormat(db, code, b, user) {
  const existing = code ? await getFormat(db, code) : null;
  const newCode = String(b.code ?? existing?.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,30}$/.test(newCode)) throw badRequest('Validation failed', [{ path: 'code', message: 'Code: 2-30 letters, digits, _ or -' }]);
  if (!existing && (await db.query('SELECT 1 FROM insurer_statement_formats WHERE code = $1', [newCode])).rows[0]) throw conflict(`Format ${newCode} already exists`);
  const name = String(b.name ?? existing?.name ?? '').trim();
  if (!name) throw badRequest('Validation failed', [{ path: 'name', message: 'Name is required' }]);
  const columns = b.columns ?? existing?.columns ?? {};
  const unknown = Object.keys(columns).filter((k) => !COLUMN_KEYS.includes(k));
  if (unknown.length) throw badRequest('Validation failed', [{ path: 'columns', message: `Unknown columns ${unknown.join(', ')} (allowed: ${COLUMN_KEYS.join(', ')})` }]);
  if (!columns.policyNo) throw badRequest('Validation failed', [{ path: 'columns.policyNo', message: 'The policy number column is required' }]);
  if (!['grossPremium', 'commission', 'amountPaid'].some((k) => columns[k])) throw badRequest('Validation failed', [{ path: 'columns', message: 'Map at least one amount: gross premium, commission or amount paid' }]);
  if (b.skipPattern) { try { new RegExp(b.skipPattern); } catch { throw badRequest('Validation failed', [{ path: 'skipPattern', message: 'Not a valid regular expression' }]); } }
  const v = [newCode, name, b.insurerId === undefined ? existing?.insurance_company_id ?? null : (b.insurerId ? Number(b.insurerId) : null), b.description ?? existing?.description ?? null,
    b.fileType ?? existing?.file_type ?? 'any', Number(b.skipRows ?? existing?.skip_rows ?? 0), b.hasHeader ?? existing?.has_header ?? true, JSON.stringify(columns),
    b.dateFormat ?? existing?.date_format ?? 'YYYY-MM-DD', b.skipPattern === undefined ? existing?.skip_pattern ?? null : (b.skipPattern || null), b.active ?? existing?.active ?? true, user?.id ?? null];
  if (existing) {
    await db.query(`UPDATE insurer_statement_formats SET name = $2, insurance_company_id = $3, description = $4, file_type = $5, skip_rows = $6, has_header = $7, columns = $8,
      date_format = $9, skip_pattern = $10, active = $11, updated_by = $12, updated_at = now() WHERE code = $1`, v);
  } else {
    await db.query(`INSERT INTO insurer_statement_formats(code, name, insurance_company_id, description, file_type, skip_rows, has_header, columns, date_format, skip_pattern, active, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`, v);
  }
  return { before: formatRow(existing), after: formatRow(await getFormat(db, newCode)) };
}

function columnIndex(spec, header) {
  if (spec === null || spec === undefined || spec === '') return -1;
  if (typeof spec === 'number' || /^\d+$/.test(String(spec))) return Number(spec) - 1;
  if (!header) return -1;
  for (const alt of String(spec).split('|')) {
    const i = header.indexOf(normKey(alt));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Statement lines from table rows with a format. Returns { lines, errors, skipped }. A row without a policy number and
 * without amounts is a title or footer and is skipped; one with amounts but no policy number is an error.
 */
export function parseRows(table, format) {
  const f = formatRow(format) || format;
  const cols = f.columns || {};
  const rows = table.slice(Number(f.skipRows || 0));
  let header = null;
  let first = 0;
  if (f.hasHeader !== false) {
    const hi = rows.findIndex((r) => r.some((c) => String(c).trim() !== ''));
    if (hi < 0) throw badRequest('The file has no rows');
    header = rows[hi].map(normKey);
    first = hi + 1;
  }
  const idx = Object.fromEntries(COLUMN_KEYS.map((k) => [k, columnIndex(cols[k], header)]));
  const missing = [];
  if (idx.policyNo < 0) missing.push('policy number');
  if (idx.grossPremium < 0 && idx.commission < 0 && idx.amountPaid < 0) missing.push('an amount (gross premium, commission or amount paid)');
  if (missing.length) throw badRequest(`The file does not have the columns of format ${f.code || ''}: ${missing.join(', ')} not found${header ? ` (headers: ${header.filter(Boolean).join(', ')})` : ''}`);
  const skip = f.skipPattern ? new RegExp(f.skipPattern, 'i') : null;
  const cell = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');
  const lines = []; const errors = []; let skipped = 0;
  rows.slice(first).forEach((r, i) => {
    const rowNo = Number(f.skipRows || 0) + first + i + 1;
    if (!r.some((c) => String(c).trim() !== '')) return;
    if (skip && skip.test(r.map((c) => String(c).trim()).filter(Boolean).join(' '))) { skipped += 1; return; }
    const amounts = {};
    for (const [k, out] of Object.entries(AMOUNT_KEYS)) {
      const a = cell(r, k) ? parseAmount(cell(r, k)) : 0;
      if (Number.isNaN(a)) { errors.push({ row: rowNo, message: `${AMOUNT_LABELS[k]} "${cell(r, k)}" is not a number` }); return; }
      amounts[out] = a;
    }
    const policyNo = cell(r, 'policyNo');
    if (!policyNo) {
      if (Object.values(amounts).some(Boolean)) errors.push({ row: rowNo, message: 'Policy number is missing' });
      else skipped += 1;
      return;
    }
    const rawDate = cell(r, 'date');
    const date = rawDate ? parseDate(rawDate, f.dateFormat) : null;
    if (rawDate && !date) { errors.push({ row: rowNo, message: `Date "${rawDate}" does not match the format ${f.dateFormat}` }); return; }
    lines.push({ lineNo: lines.length + 1, row: rowNo, policyNo, insured: cell(r, 'insured') || null, date, reference: cell(r, 'reference') || null,
      grossPremium: round2(amounts.gross), commission: round2(amounts.commission), taxes: round2(amounts.taxes), amountPaid: round2(amounts.paid) });
  });
  return { lines, errors, skipped };
}

const totalsOf = (lines) => ({
  count: lines.length, grossPremium: round2(lines.reduce((s, l) => s + l.grossPremium, 0)), commission: round2(lines.reduce((s, l) => s + l.commission, 0)),
  taxes: round2(lines.reduce((s, l) => s + l.taxes, 0)), amountPaid: round2(lines.reduce((s, l) => s + l.amountPaid, 0)),
});

async function insurerRow(db, ref) {
  if (ref === undefined || ref === null || ref === '') throw badRequest('Validation failed', [{ path: 'insurerId', message: 'Insurer is required' }]);
  const r = (await db.query(`SELECT * FROM insurance_companies WHERE (id::text = $1 OR lower(code) = lower($1)) AND status <> 'deleted' LIMIT 1`, [String(ref)])).rows[0];
  if (!r) throw badRequest('Validation failed', [{ path: 'insurerId', message: `Insurer ${ref} was not found` }]);
  return r;
}

/** The format to read a file with: the one named, else the insurer's own format, else GENERIC. */
async function formatFor(db, code, insurerId) {
  if (code) return getFormat(db, code);
  const own = (await db.query('SELECT * FROM insurer_statement_formats WHERE insurance_company_id = $1 AND active ORDER BY code LIMIT 1', [insurerId])).rows[0];
  return own || getFormat(db, 'GENERIC');
}

/** Parse an uploaded statement for the preview (nothing is saved). */
export async function previewStatement(db, file, b) {
  const insurer = await insurerRow(db, b.insurerId ?? b.insurerCode);
  const format = await formatFor(db, b.formatCode, insurer.id);
  const parsed = parseRows(readTable(file), format);
  return { insurerId: insurer.id, insurerName: insurer.name, format: format.code, ...parsed, totals: totalsOf(parsed.lines) };
}

/**
 * Import a statement: header { insurerId, statementType, periodFrom, periodTo, statementRef, formatCode, tolerance, remarks }.
 * Refused when a row cannot be read or the same file was already imported for the insurer. Returns the statement id.
 */
export async function importStatement(db, file, b, user) {
  const insurer = await insurerRow(db, b.insurerId ?? b.insurerCode);
  const type = String(b.statementType || 'premium');
  if (!STATEMENT_TYPES[type]) throw badRequest('Validation failed', [{ path: 'statementType', message: `Statement type must be one of ${Object.keys(STATEMENT_TYPES).join(', ')}` }]);
  const from = String(b.periodFrom || ''); const to = String(b.periodTo || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw badRequest('Validation failed', [{ path: 'periodTo', message: 'Enter the statement period (from / to, YYYY-MM-DD)' }]);
  const format = await formatFor(db, b.formatCode, insurer.id);
  const parsed = parseRows(readTable(file), format);
  if (parsed.errors.length) throw badRequest(`${parsed.errors.length} row(s) of the file cannot be read; correct the file or the format`, parsed.errors.map((e) => ({ path: `row ${e.row}`, message: e.message })));
  if (!parsed.lines.length) throw badRequest('The statement has no policy lines');
  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const dup = (await db.query('SELECT statement_number FROM insurer_statements WHERE insurance_company_id = $1 AND file_hash = $2 AND status <> \'cancelled\'', [insurer.id, hash])).rows[0];
  if (dup) throw conflict(`This file was already imported for ${insurer.name} as ${dup.statement_number}`);
  const tolerance = b.tolerance !== undefined && b.tolerance !== null && b.tolerance !== '' ? round2(Number(b.tolerance)) : round2(Number(await getSetting('insurer_reconciliation.amount_tolerance', 1)) || 0);
  if (!(tolerance >= 0)) throw badRequest('Validation failed', [{ path: 'tolerance', message: 'Tolerance must be zero or more' }]);
  const t = totalsOf(parsed.lines);
  const number = await nextDocumentNumber('insurer_statement', { db, unique: { table: 'insurer_statements', column: 'statement_number' } });
  const s = (await db.query(`INSERT INTO insurer_statements(statement_number, insurance_company_id, statement_type, statement_ref, period_from, period_to, format_code, file_name, file_hash, tolerance,
      line_count, total_gross, total_commission, total_taxes, total_paid, remarks, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) RETURNING id`,
  [number, insurer.id, type, b.statementRef || null, from, to, format.code, file.originalname || null, hash, tolerance, t.count, t.grossPremium, t.commission, t.taxes, t.amountPaid,
    b.remarks || null, user?.id ?? null])).rows[0];
  for (const l of parsed.lines) {
    await db.query(`INSERT INTO insurer_statement_lines(statement_id, line_no, row_no, policy_number, insured_name, txn_date, reference, gross_premium, commission, taxes, amount_paid)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [s.id, l.lineNo, l.row, l.policyNo, l.insured, l.date, l.reference, l.grossPremium, l.commission, l.taxes, l.amountPaid]);
  }
  return s.id;
}
