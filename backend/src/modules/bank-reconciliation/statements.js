/**
 * Bank statements: parsing a bank's CSV / XLSX export with a statement format (column mapping, date format, rows to
 * skip, signed or debit / credit amounts), preview, import, manual entry and deletion.
 *
 * Checks: the statement balances (opening + credits - debits = closing, bank_reconciliation.require_balanced_statement);
 * a file already imported for the account is refused (file hash); lines already on file for the account (hash of date,
 * amount, reference, description and the occurrence within the file) are duplicates: they are refused unless
 * skipDuplicates, in which case they are left out and the opening balance is carried to the first new line.
 */
import crypto from 'node:crypto';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { normKey, parseCsv } from '../documents/tabular.js';
import { readXlsx } from '../documents/xlsx.js';
import { assertOpenDate, iso, linkedAccount, round2, userNames } from './common.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const DATE_FORMATS = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'M/D/YYYY', 'D/M/YYYY', 'MM-DD-YYYY', 'DD-MM-YYYY', 'DD-MMM-YYYY', 'DD MMM YYYY', 'MMM DD, YYYY', 'MMM D, YYYY', 'YYYY/MM/DD', 'MM/DD/YY', 'DD/MM/YY'];
export const COLUMN_KEYS = ['date', 'valueDate', 'description', 'reference', 'debit', 'credit', 'amount', 'balance', 'drCr'];

export const formatRow = (f) => f && ({
  code: f.code, name: f.name, bankCode: f.bank_code, description: f.description, fileType: f.file_type, skipRows: f.skip_rows, hasHeader: f.has_header,
  columns: f.columns || {}, dateFormat: f.date_format, amountSign: f.amount_sign, skipPattern: f.skip_pattern, isExample: f.is_example, active: f.active, updatedAt: f.updated_at,
});

/** Date regex and field order for a date format (YYYY, YY, MMM, MM, M, DD, D; other characters literal). */
function datePattern(fmt) {
  const order = [];
  let re = '';
  const tokens = String(fmt).match(/YYYY|YY|MMMM|MMM|MM|M|DD|D|[^YMD]+/g) || [];
  for (const t of tokens) {
    if (t === 'YYYY') { re += '(\\d{4})'; order.push('Y'); } else if (t === 'YY') { re += '(\\d{2})'; order.push('y'); } else if (t === 'MMM' || t === 'MMMM') { re += '([A-Za-z]{3,9})\\.?'; order.push('b'); } else if (t === 'MM' || t === 'M') { re += '(\\d{1,2})'; order.push('m'); } else if (t === 'DD' || t === 'D') { re += '(\\d{1,2})'; order.push('d'); } else re += t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*').replace(/,/g, ',?');
  }
  return { re: new RegExp(`^\\s*${re}`), order };
}

/** Parse a cell into YYYY-MM-DD with the format; ISO dates and Excel serial numbers are always accepted. */
export function parseDate(v, fmt) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const valid = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
  };
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000).toISOString().slice(0, 10);
  const { re, order } = datePattern(fmt || 'YYYY-MM-DD');
  const m = s.match(re);
  if (m) {
    let y; let mo; let d;
    order.forEach((k, i) => {
      const x = m[i + 1];
      if (k === 'Y') y = Number(x); else if (k === 'y') y = 2000 + Number(x); else if (k === 'm') mo = Number(x); else if (k === 'd') d = Number(x);
      else if (k === 'b') mo = MONTHS.indexOf(x.slice(0, 3).toLowerCase()) + 1;
    });
    const r = y && mo && d ? valid(y, mo, d) : null;
    if (r) return r;
  }
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return isoM ? valid(Number(isoM[1]), Number(isoM[2]), Number(isoM[3])) : null;
}

/** Parse an amount: thousands separators, currency, (negative), trailing CR / DR, "-" for none. NaN when not a number. */
export function parseAmount(v) {
  let s = String(v ?? '').trim();
  if (!s || s === '-' || s === '--') return 0;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  const suffix = s.match(/\s*(CR|DR)\.?$/i);
  if (suffix) { if (suffix[1].toUpperCase() === 'DR') sign *= -1; s = s.slice(0, suffix.index); }
  s = s.replace(/PHP|₱|\s|,/gi, '');
  if (s.endsWith('-')) { sign *= -1; s = s.slice(0, -1); }
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return NaN;
  return round2(sign * Number(s));
}

/** Column index of a mapping value: a 1-based number, or header text with "|" alternatives. -1 when absent. */
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

/** Read the uploaded file into rows of cells. */
export function readTable(file) {
  if (!file?.buffer?.length) throw badRequest('Upload the bank statement (CSV or XLSX) in the "file" field');
  const name = (file.originalname || '').toLowerCase();
  const isZip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
  try {
    return isZip || name.endsWith('.xlsx') ? readXlsx(file.buffer) : parseCsv(file.buffer.toString('utf8'));
  } catch (e) {
    throw badRequest(`Could not read the file: ${e.message}`);
  }
}

/**
 * Turn table rows into statement lines with a format. Returns { lines, errors, skipped, columns }.
 * lines: { lineNo, row, date, valueDate, description, reference, debit, credit, amount, balance }.
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
  if (idx.date < 0) missing.push('date');
  if (idx.description < 0 && idx.reference < 0) missing.push('description');
  if (idx.amount < 0 && idx.debit < 0 && idx.credit < 0) missing.push('debit / credit or amount');
  if (missing.length) throw badRequest(`The file does not have the columns of format ${f.code || ''}: ${missing.join(', ')} not found${header ? ` (headers: ${header.filter(Boolean).join(', ')})` : ''}`);
  const skip = f.skipPattern ? new RegExp(f.skipPattern, 'i') : null;
  const cell = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');
  const lines = []; const errors = []; let skipped = 0;
  rows.slice(first).forEach((r, i) => {
    const rowNo = Number(f.skipRows || 0) + first + i + 1;
    if (!r.some((c) => String(c).trim() !== '')) return;
    if (skip && skip.test(r.map((c) => String(c).trim()).filter(Boolean).join(' '))) { skipped += 1; return; }
    const date = parseDate(cell(r, 'date'), f.dateFormat);
    let debit = 0; let credit = 0;
    if (idx.amount >= 0) {
      const a = parseAmount(cell(r, 'amount'));
      if (Number.isNaN(a)) { errors.push({ row: rowNo, message: `Amount "${cell(r, 'amount')}" is not a number` }); return; }
      let signed = f.amountSign === 'debit-positive' ? -a : a;
      const drcr = cell(r, 'drCr').toUpperCase();
      if (drcr.startsWith('DR') || drcr === 'D') signed = -Math.abs(a); else if (drcr.startsWith('CR') || drcr === 'C') signed = Math.abs(a);
      if (signed < 0) debit = -signed; else credit = signed;
    }
    if (idx.debit >= 0 || idx.credit >= 0) {
      const d = parseAmount(cell(r, 'debit')); const c = parseAmount(cell(r, 'credit'));
      if (Number.isNaN(d) || Number.isNaN(c)) { errors.push({ row: rowNo, message: 'Debit / credit is not a number' }); return; }
      debit = round2(debit + Math.abs(d)); credit = round2(credit + Math.abs(c));
    }
    if (!date) {
      // rows without a date and without an amount are titles / footers
      if (!debit && !credit) { skipped += 1; return; }
      errors.push({ row: rowNo, message: `Date "${cell(r, 'date')}" does not match the format ${f.dateFormat}` });
      return;
    }
    if (!debit && !credit) { skipped += 1; return; }
    const bal = cell(r, 'balance') ? parseAmount(cell(r, 'balance')) : null;
    lines.push({ lineNo: lines.length + 1, row: rowNo, date, valueDate: parseDate(cell(r, 'valueDate'), f.dateFormat), description: cell(r, 'description') || cell(r, 'reference'),
      reference: cell(r, 'reference') || null, debit: round2(debit), credit: round2(credit), amount: round2(credit - debit), balance: bal === null || Number.isNaN(bal) ? null : bal });
  });
  return { lines, errors, skipped, columns: idx };
}

/** Hash of a line for duplicate detection; `occurrence` separates identical lines within one file. */
export const lineHash = (accountId, l, occurrence) => crypto.createHash('sha256')
  .update([accountId, l.date, Number(l.amount).toFixed(2), String(l.reference || '').toUpperCase().replace(/\s+/g, ''), String(l.description || '').toUpperCase().replace(/\s+/g, ' ').trim(), occurrence].join('|'))
  .digest('hex');

/** Suggested bank transaction type of each line (first active type of the line's direction whose pattern matches). */
async function suggestTypes(db, lines) {
  const types = (await db.query('SELECT code, direction, match_pattern FROM bank_transaction_types WHERE active AND match_pattern IS NOT NULL ORDER BY sort_order, code')).rows;
  const compiled = types.flatMap((t) => { try { return [{ ...t, re: new RegExp(t.match_pattern, 'i') }]; } catch { return []; } });
  for (const l of lines) {
    const dir = l.amount < 0 ? 'debit' : 'credit';
    l.typeCode = compiled.find((t) => t.direction === dir && t.re.test(`${l.description} ${l.reference || ''}`))?.code || null;
  }
}

/**
 * Validate parsed lines against the account and header: totals, balance check, duplicates. Returns the preview.
 * header: { openingBalance, closingBalance, periodFrom, periodTo, statementRef, skipDuplicates }.
 */
export async function analyse(db, account, lines, header = {}, { fileHash = null } = {}) {
  if (!lines.length) throw badRequest('The statement has no transaction lines');
  const counts = new Map();
  for (const l of lines) {
    const base = lineHash(account.bank_account_id, l, 0);
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    l.hash = lineHash(account.bank_account_id, l, n - 1);
  }
  const existing = new Set((await db.query('SELECT line_hash FROM bank_statement_lines WHERE bank_account_id = $1 AND status = \'active\' AND line_hash = ANY($2)',
    [account.bank_account_id, lines.map((l) => l.hash)])).rows.map((r) => r.line_hash));
  for (const l of lines) l.duplicate = existing.has(l.hash);
  await suggestTypes(db, lines);
  const dates = lines.map((l) => l.date).sort();
  const totalDebits = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredits = round2(lines.reduce((s, l) => s + l.credit, 0));
  const withBal = lines.filter((l) => l.balance !== null);
  let opening = header.openingBalance ?? null;
  let closing = header.closingBalance ?? null;
  if (opening === null && lines[0].balance !== null) opening = round2(lines[0].balance - lines[0].amount);
  if (closing === null && withBal.length) closing = withBal[withBal.length - 1].balance;
  if (opening === null) {
    // continue from the previous statement of the account
    const prev = (await db.query('SELECT closing_balance FROM bank_statements WHERE bank_account_id = $1 AND status = \'active\' AND period_to <= $2 ORDER BY period_to DESC, created_at DESC LIMIT 1',
      [account.bank_account_id, dates[0]])).rows[0];
    opening = prev ? Number(prev.closing_balance) : 0;
  }
  opening = round2(opening);
  const computed = round2(opening + totalCredits - totalDebits);
  if (closing === null) closing = computed;
  closing = round2(closing);
  const runningErrors = [];
  let run = opening;
  for (const l of lines) {
    run = round2(run + l.amount);
    if (l.balance !== null && round2(l.balance) !== run) runningErrors.push({ lineNo: l.lineNo, row: l.row, expected: run, balance: l.balance });
  }
  const prev = (await db.query('SELECT statement_number, closing_balance, period_to FROM bank_statements WHERE bank_account_id = $1 AND status = \'active\' AND period_to < $2 ORDER BY period_to DESC, created_at DESC LIMIT 1',
    [account.bank_account_id, header.periodFrom || dates[0]])).rows[0];
  const duplicates = lines.filter((l) => l.duplicate).length;
  const fileDuplicate = fileHash ? (await db.query('SELECT statement_number FROM bank_statements WHERE bank_account_id = $1 AND file_hash = $2 AND status = \'active\'', [account.bank_account_id, fileHash])).rows[0] : null;
  return {
    bankAccount: account.bank_account_code, glAccountCode: account.gl_account_code, statementRef: header.statementRef || null,
    periodFrom: header.periodFrom || dates[0], periodTo: header.periodTo || dates[dates.length - 1],
    openingBalance: opening, closingBalance: closing, totalDebits, totalCredits, computedClosing: computed, balanced: computed === closing, difference: round2(closing - computed),
    runningBalanceErrors: runningErrors.slice(0, 20),
    previousStatement: prev ? { statementNumber: prev.statement_number, closingBalance: Number(prev.closing_balance), periodTo: iso(prev.period_to), continues: round2(prev.closing_balance) === opening } : null,
    lineCount: lines.length, duplicates, fileAlreadyImported: fileDuplicate?.statement_number || null,
    lines: lines.map((l) => ({ lineNo: l.lineNo, row: l.row, date: l.date, valueDate: l.valueDate, description: l.description, reference: l.reference, debit: l.debit, credit: l.credit,
      amount: l.amount, balance: l.balance, duplicate: l.duplicate, suggestedType: l.typeCode })),
    _lines: lines,
  };
}

export async function getFormat(db, code) {
  const f = (await db.query('SELECT * FROM bank_statement_formats WHERE code = $1', [String(code || '')])).rows[0];
  if (!f) throw notFound(`Statement format ${code} not found`);
  if (!f.active) throw badRequest(`Statement format ${code} is inactive`);
  return f;
}

/** Parse an uploaded file for an account (format from the request, else the account's default, else GENERIC). */
export async function previewFile(db, file, b) {
  const account = await linkedAccount(db, b.bankAccount);
  const format = await getFormat(db, b.format || account.statement_format || 'GENERIC');
  const name = (file?.originalname || '').toLowerCase();
  if (format.file_type === 'csv' && name.endsWith('.xlsx')) throw badRequest(`Statement format ${format.code} reads CSV files`);
  if (format.file_type === 'xlsx' && name.endsWith('.csv')) throw badRequest(`Statement format ${format.code} reads XLSX files`);
  const parsed = parseRows(readTable(file), format);
  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const header = { statementRef: b.statementRef || null, openingBalance: numOrNull(b.openingBalance), closingBalance: numOrNull(b.closingBalance), periodFrom: b.periodFrom || null, periodTo: b.periodTo || null };
  const a = parsed.lines.length ? await analyse(db, account, parsed.lines, header, { fileHash }) : { lines: [], lineCount: 0, _lines: [] };
  return { ...a, format: format.code, fileName: file.originalname || null, fileHash, errors: parsed.errors, skippedRows: parsed.skipped, account };
}
const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Save a statement (analysed preview) with its lines. */
export async function saveStatement(db, a, { account, source, format = null, fileName = null, fileHash = null, remarks = null, skipDuplicates = false }, user) {
  if (a.errors?.length) throw badRequest(`${a.errors.length} row(s) could not be read; fix the file or the statement format`, a.errors.slice(0, 20).map((e) => ({ path: `row ${e.row}`, message: e.message })));
  if (a.fileAlreadyImported) throw conflict(`This file was already imported for ${account.bank_account_code} (${a.fileAlreadyImported})`);
  if (!a.balanced && (await getSetting('bank_reconciliation.require_balanced_statement', true))) {
    throw badRequest(`The statement does not balance: opening ${a.openingBalance} + credits ${a.totalCredits} - debits ${a.totalDebits} = ${a.computedClosing}, not the closing balance ${a.closingBalance}`);
  }
  if (a.duplicates && !skipDuplicates) throw conflict(`${a.duplicates} line(s) are already on file for ${account.bank_account_code} (duplicate import); import again with "skip duplicates" to leave them out`);
  const keep = a._lines.filter((l) => !l.duplicate);
  if (!keep.length) throw conflict('Every line of this statement is already on file (duplicate import)');
  await assertOpenDate(db, account.bank_account_id, keep.map((l) => l.date).sort()[0], 'The statement');
  // lines left out as duplicates: the opening balance carries to the first new line (the closing balance is the bank's)
  const opening = a.duplicates ? round2(a.closingBalance - keep.reduce((s, l) => s + l.amount, 0)) : a.openingBalance;
  const dates = keep.map((l) => l.date).sort();
  const number = await nextDocumentNumber('bank_statement', { db });
  const debits = round2(keep.reduce((s, l) => s + l.debit, 0));
  const credits = round2(keep.reduce((s, l) => s + l.credit, 0));
  const s = (await db.query(`INSERT INTO bank_statements(statement_number, bank_account_id, bank_account_code, gl_account_code, statement_ref, period_from, period_to, opening_balance,
      closing_balance, total_debits, total_credits, line_count, format_code, file_name, file_hash, source, remarks, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
  [number, account.bank_account_id, account.bank_account_code, account.gl_account_code, a.statementRef, a.duplicates ? dates[0] : (a.periodFrom < dates[0] ? a.periodFrom : dates[0]),
    a.periodTo > dates[dates.length - 1] ? a.periodTo : dates[dates.length - 1], opening, a.closingBalance, debits, credits, keep.length, format, fileName, fileHash, source,
    [remarks, a.duplicates ? `${a.duplicates} duplicate line(s) left out` : null].filter(Boolean).join('; ') || null, user?.id ?? null])).rows[0];
  let n = 0;
  for (const l of keep) {
    n += 1;
    await db.query(`INSERT INTO bank_statement_lines(statement_id, bank_account_id, line_no, txn_date, value_date, description, reference, debit, credit, amount, running_balance,
        line_hash, source, type_code, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`,
    [s.id, account.bank_account_id, n, l.date, l.valueDate || null, l.description || '', l.reference || null, l.debit, l.credit, l.amount, l.balance, l.hash, source === 'manual' ? 'manual' : 'import', l.typeCode || null, user?.id ?? null]);
  }
  return s;
}

/** Manual statement entry: { bankAccount, statementRef, periodFrom, periodTo, openingBalance, closingBalance, lines: [{ date, valueDate, description, reference, debit, credit }] }. */
export async function manualStatement(db, b, user) {
  const account = await linkedAccount(db, b.bankAccount);
  const lines = (b.lines || []).map((l, i) => {
    const debit = round2(Math.abs(Number(l.debit || 0))); const credit = round2(Math.abs(Number(l.credit || 0)));
    const date = parseDate(l.date, 'YYYY-MM-DD');
    if (!date) throw badRequest(`Line ${i + 1}: date is required (YYYY-MM-DD)`);
    if (!debit && !credit) throw badRequest(`Line ${i + 1}: enter a debit or a credit`);
    if (debit && credit) throw badRequest(`Line ${i + 1}: a line is either a debit or a credit`);
    return { lineNo: i + 1, row: i + 1, date, valueDate: parseDate(l.valueDate, 'YYYY-MM-DD'), description: String(l.description || '').trim(), reference: l.reference ? String(l.reference).trim() : null,
      debit, credit, amount: round2(credit - debit), balance: null };
  });
  const a = await analyse(db, account, lines, { statementRef: b.statementRef, openingBalance: numOrNull(b.openingBalance), closingBalance: numOrNull(b.closingBalance), periodFrom: b.periodFrom, periodTo: b.periodTo });
  return saveStatement(db, a, { account, source: 'manual', remarks: b.remarks || null, skipDuplicates: !!b.skipDuplicates }, user);
}

export const statementRow = (s, users = new Map()) => s && ({
  id: s.id, statementNumber: s.statement_number, bankAccount: s.bank_account_code, glAccountCode: s.gl_account_code, statementRef: s.statement_ref, periodFrom: iso(s.period_from),
  periodTo: iso(s.period_to), openingBalance: Number(s.opening_balance), closingBalance: Number(s.closing_balance), totalDebits: Number(s.total_debits), totalCredits: Number(s.total_credits),
  lineCount: s.line_count, format: s.format_code, fileName: s.file_name, source: s.source, status: s.status, remarks: s.remarks, matchedLines: s.matched_lines ?? undefined,
  createdBy: users.get(s.created_by) || s.created_by, createdAt: s.created_at,
});

export async function listStatements(db, q = {}) {
  const account = q.bankAccount ? await linkedAccount(db, q.bankAccount) : null;
  const rows = (await db.query(`SELECT s.*, (SELECT count(*)::int FROM bank_statement_lines l JOIN bank_rec_match_items mi ON mi.bank_line_id = l.id AND mi.active WHERE l.statement_id = s.id) AS matched_lines
    FROM bank_statements s WHERE s.status = 'active' AND ($1::int IS NULL OR s.bank_account_id = $1) ORDER BY s.period_from DESC, s.created_at DESC LIMIT 200`, [account?.bank_account_id ?? null])).rows;
  const users = await userNames(db, rows.map((r) => r.created_by));
  return rows.map((r) => statementRow(r, users));
}

export async function getStatement(db, id) {
  const s = (await db.query('SELECT * FROM bank_statements WHERE id = $1 OR statement_number = $1', [String(id)])).rows[0];
  if (!s) throw notFound('Bank statement not found');
  const lines = (await db.query(`SELECT l.*, mi.match_id FROM bank_statement_lines l LEFT JOIN bank_rec_match_items mi ON mi.bank_line_id = l.id AND mi.active
    WHERE l.statement_id = $1 AND l.status = 'active' ORDER BY l.line_no`, [s.id])).rows;
  const users = await userNames(db, [s.created_by]);
  return { ...statementRow(s, users), lines: lines.map((l) => ({ id: l.id, lineNo: l.line_no, date: iso(l.txn_date), valueDate: l.value_date ? iso(l.value_date) : null, description: l.description,
    reference: l.reference, debit: Number(l.debit), credit: Number(l.credit), amount: Number(l.amount), balance: l.running_balance === null ? null : Number(l.running_balance), typeCode: l.type_code, matchId: l.match_id })) };
}

/** Delete a statement that has no matched lines, adjustments or lines in an approved reconciliation. */
export async function deleteStatement(db, id, user) {
  const s = (await db.query('SELECT * FROM bank_statements WHERE (id = $1 OR statement_number = $1) AND status = \'active\' FOR UPDATE', [String(id)])).rows[0];
  if (!s) throw notFound('Bank statement not found');
  const used = (await db.query(`SELECT count(*) FILTER (WHERE mi.id IS NOT NULL)::int AS matched, count(*) FILTER (WHERE l.adjustment_jv_id IS NOT NULL)::int AS adjusted
    FROM bank_statement_lines l LEFT JOIN bank_rec_match_items mi ON mi.bank_line_id = l.id AND mi.active WHERE l.statement_id = $1 AND l.status = 'active'`, [s.id])).rows[0];
  if (used.matched || used.adjusted) throw conflict(`Statement ${s.statement_number} has ${used.matched} matched line(s) and ${used.adjusted} adjustment(s); unmatch them first`);
  await assertOpenDate(db, s.bank_account_id, s.period_from, 'The statement');
  await db.query('UPDATE bank_statement_lines SET status = \'deleted\', updated_by = $2, updated_at = now() WHERE statement_id = $1', [s.id, user.id]);
  await db.query('UPDATE bank_statements SET status = \'deleted\', deleted_by = $2, deleted_at = now() WHERE id = $1', [s.id, user.id]);
  return statementRow(s);
}
