/**
 * TFS account status upload (TIS-BRD-SCHM-03 FR-LCK-020): the list of financed accounts with their loan status, loaded
 * row by row. TFS status codes are read through lockin.tfs_status_map; a row is failed for a loan account that is not
 * 10 digits, an unknown status, a status date in the future or a loan account linked to no policy; the others update
 * every active policy of the loan account (or the POLICY_NUMBER of the row) through applyLoanStatus: a newer status
 * date wins, the same date replaces, an older one and a status set by hand are Not changed. The batch
 * (LS-yyyy-nnnnn) keeps the counts, the failed rows and the notices held and holds lifted.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { mapColumns, normKey } from '../documents/tabular.js';
import { applyLoanStatus } from './service.js';

/** Columns of the TFS account status file (FRS SCHM-03 13.1); the template (TFS_Loan_Status_Upload_Template.xlsx) is built from this list. */
export const LOAN_STATUS_COLUMNS = [
  { key: 'loanAccount', header: 'LOAN_ACCOUNT_NO', aliases: ['loan account', 'loan account no'], required: true, format: '10 digits; the TFS loan account of at least one policy', example: '8003828889' },
  { key: 'loanStatus', header: 'LOAN_STATUS', aliases: ['status'], required: true, format: 'A TFS status of the mapping (Configuration lockin.tfs_status_map)',
    allowed: ['CURRENT', 'PAST DUE', 'MISSED PAYMENT', 'FRAUD', 'EARLY TERMINATED', 'TERMINATED', 'LEGAL DISPUTE', 'CLOSED'], example: 'PAST DUE' },
  { key: 'statusDate', header: 'STATUS_DATE', aliases: ['status date'], required: true, format: 'Date DD/MM/YYYY (or YYYY-MM-DD), not in the future', example: '30/09/2026' },
  { key: 'daysPastDue', header: 'DAYS_PAST_DUE', format: 'Whole number', example: '32' },
  { key: 'maturity', header: 'LOAN_MATURITY_DATE', aliases: ['maturity date'], format: 'Date DD/MM/YYYY', example: '05/10/2031' },
  { key: 'scheme', header: 'SCHEME', format: 'SCHEME 1 or SCHEME 2; a mismatch with the lock-in source is a warning on the row', example: 'SCHEME 2' },
  { key: 'policyNumber', header: 'POLICY_NUMBER', format: 'When filled, the row updates that policy only', example: '' },
  { key: 'borrowerName', header: 'BORROWER_NAME', format: 'For reading only', example: 'Mark Ileto' },
  { key: 'remarks', header: 'REMARKS', format: 'Text, up to 250 characters; kept with the status', example: 'Two amortisations unpaid' },
];

/** DD/MM/YYYY, YYYY-MM-DD or a spreadsheet date number. */
export function statusDateOf(v) {
  const s = String(v || '').trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  return isoDate(s);
}

/** The BrokerVerse loan status of a TFS status code (lockin.tfs_status_map), or null. */
export async function mapStatus(code) {
  const map = (await getSetting('lockin.tfs_status_map', {})) || {};
  const key = String(code || '').trim().toUpperCase().replace(/[_\s]+/g, ' ');
  return map[key] || null;
}

export async function uploadLoanStatus({ rows, headers, fileName }, user) {
  const fail = (message, code) => badRequest(message, [{ path: 'file', message, code }]);
  if (!String(fileName || '').toLowerCase().endsWith('.xlsx')) throw fail('Upload an Excel (.xlsx) file', 'MSG-LCK-016');
  const have = new Set(headers || []);
  if (!LOAN_STATUS_COLUMNS.filter((c) => c.required).every((c) => [c.key, c.header, ...(c.aliases || [])].some((h) => have.has(normKey(h))))) {
    throw fail('The file must have the columns LOAN_ACCOUNT_NO, LOAN_STATUS and STATUS_DATE', 'MSG-LCK-017');
  }
  const max = Number(await getSetting('lockin.upload_max_rows', 5000));
  if (rows.length > max) throw fail(`A file can hold at most ${max} rows`, 'MSG-LCK-018');
  const now = await today();
  const batchNumber = await nextDocumentNumber('loan_status_batch', { unique: { table: 'loan_status_batches', column: 'batch_number' } });
  const batch = await one('INSERT INTO loan_status_batches(batch_number, file_name, rows_total, created_by) VALUES ($1,$2,$3,$4) RETURNING id', [batchNumber, fileName, rows.length, user.id]);
  const errors = [];
  const warnings = [];
  const notChanged = [];
  let loaded = 0;
  let updatedRows = 0;
  let held = 0;
  let lifted = 0;
  let latest = null;
  for (const [i, raw] of rows.entries()) {
    const n = i + 2;
    const v = mapColumns(raw, LOAN_STATUS_COLUMNS);
    const account = String(v.loanAccount || '').trim();
    if (!/^\d{10}$/.test(account)) { errors.push({ row: n, message: `Row ${n}: loan account ${account || '(blank)'} must have 10 digits` }); continue; }
    const status = await mapStatus(v.loanStatus);
    if (!status) { errors.push({ row: n, message: `Row ${n}: loan status ${v.loanStatus || '(blank)'} is not a known TFS status` }); continue; }
    const date = statusDateOf(v.statusDate);
    if (!date) { errors.push({ row: n, message: `Row ${n}: the status date ${v.statusDate || '(blank)'} is not a date (DD/MM/YYYY)` }); continue; }
    if (date > now) { errors.push({ row: n, message: `Row ${n}: the status date cannot be in the future` }); continue; }
    const out = await withTransaction((db) => applyLoanStatus(db, { loanAccount: account, policyId: v.policyNumber || null, status, statusDate: date, source: 'upload', batchId: batch.id,
      remark: v.remarks ? String(v.remarks).slice(0, 250) : null, daysPastDue: v.daysPastDue ? Number(v.daysPastDue) : null, maturity: v.maturity ? statusDateOf(v.maturity) : null, user }));
    if (!out.found) { errors.push({ row: n, message: `Row ${n}: no policy is linked to loan account ${account}` }); continue; }
    loaded += 1;
    if (!latest || date > latest) latest = date;
    if (out.updated.length) updatedRows += 1;
    else notChanged.push({ row: n, message: `Row ${n}: ${out.notChanged.map((x) => `${x.policyNumber} ${x.reason}`).join('; ')}` });
    held += out.updated.filter((u) => u.held).length;
    lifted += out.updated.filter((u) => u.lifted).length;
    if (v.scheme) {
      const sources = (await many('SELECT DISTINCT source FROM policy_lock_ins WHERE tfs_loan_account = $1', [account])).map((x) => x.source);
      const want = /2/.test(v.scheme) ? 'scheme2' : /1/.test(v.scheme) ? 'scheme1-ara' : null;
      if (want && sources.length && !sources.includes(want)) warnings.push({ row: n, message: `Row ${n}: the file says ${v.scheme} but the lock-in of loan ${account} is ${sources.join(', ')}` });
    }
  }
  await one(`UPDATE loan_status_batches SET status_date = $2, rows_loaded = $3, rows_not_changed = $4, rows_failed = $5, notices_held = $6, holds_lifted = $7, errors = $8, not_changed = $9
    WHERE id = $1 RETURNING id`, [batch.id, latest, updatedRows, notChanged.length, errors.length, held, lifted, JSON.stringify(errors), JSON.stringify([...notChanged, ...warnings])]);
  return { batchId: batch.id, batchNumber, total: rows.length, loaded, updated: updatedRows, notChanged: notChanged.length, failed: errors.length, noticesHeld: held, holdsLifted: lifted,
    errors, notChangedRows: notChanged, warnings, message: `Processed ${rows.length} rows: ${loaded} loaded, ${errors.length} failed` };
}

export async function listBatches() {
  return many(`SELECT b.id, b.batch_number AS "batchNumber", b.file_name AS "fileName", b.status_date AS "statusDate", b.rows_total AS "rowsTotal", b.rows_loaded AS "updated",
      b.rows_not_changed AS "notChanged", b.rows_failed AS "failed", b.notices_held AS "noticesHeld", b.holds_lifted AS "holdsLifted", b.errors, b.not_changed AS "notChangedRows",
      b.created_at AS "createdAt", u.display_name AS "createdBy"
    FROM loan_status_batches b LEFT JOIN users u ON u.id = b.created_by ORDER BY b.created_at DESC LIMIT 200`);
}

/** The failed rows of a batch as a sheet (download of the failed rows). */
export async function failedRows(batchId) {
  const b = await one('SELECT batch_number, errors FROM loan_status_batches WHERE id = $1 OR batch_number = $1', [String(batchId)]);
  return b ? { batchNumber: b.batch_number, rows: (b.errors || []).map((e) => ({ row: e.row, message: e.message })) } : null;
}
