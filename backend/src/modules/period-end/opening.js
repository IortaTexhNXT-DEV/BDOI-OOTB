/**
 * Go-live opening balances: the trial balance of the old system at the day before the go-live date, loaded into
 * opening_balances of the fiscal year that contains the go-live date (source_run 'go-live:<date>'). Reports read them
 * through pe_balance_before like the balances carried forward by a year-end close; no journal is posted.
 *
 * Rules: every account exists and is active; each row has a debit or a credit, not both; debits equal credits; the
 * fiscal year is open, has no balances carried forward by a year-end close and no posted journal before the go-live
 * date. A row with neither a debit nor a credit (or zero), the usual line of an account whose movements net to zero in
 * a trial balance export, is accepted and ignored (listed in `ignored`). Loading the same go-live date again replaces
 * the earlier load (idempotent); another date is refused. validateOpeningBalances runs the same rules without loading
 * (the Validate step of the import dialog) and lists every error with its row and column.
 */
import { badRequest, conflict } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';
import { ensureCalendar, iso } from './fiscal.js';

export const GO_LIVE_PREFIX = 'go-live:';

/** Columns of the opening balance upload; the upload template is built from this list. */
export const OPENING_BALANCE_COLUMNS = [
  { key: 'accountCode', header: 'Account Code', aliases: ['account', 'gl account', 'code'], required: true, format: 'GL account code of the chart of accounts (active)', example: '1102001' },
  { key: 'accountName', header: 'Account Name', aliases: ['name'], format: 'For your reference only; not imported', example: 'Cash in Bank – Operating Account' },
  { key: 'debit', header: 'Debit', aliases: ['dr'], format: 'Amount in PHP, no sign; the account balance when it is a debit balance. A row with no debit and no credit (zero balance) is ignored', example: '1250000.00' },
  { key: 'credit', header: 'Credit', aliases: ['cr'], format: 'Amount in PHP, no sign; the account balance when it is a credit balance', example: '' },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const amount = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
};

/** Fiscal year of a go-live date (created when the calendar does not reach it yet). */
async function fiscalYearOf(db, goLiveDate) {
  await ensureCalendar(db, goLiveDate);
  const fy = (await db.query('SELECT * FROM fiscal_years WHERE $1::date BETWEEN start_date AND end_date', [goLiveDate])).rows[0];
  if (!fy) throw badRequest(`No fiscal year covers ${goLiveDate}; create it under Accounts > Period End > Period Management`);
  return fy;
}

/** True when a row carries no balance: neither a debit nor a credit, or zero (an amount that is not a number is not zero). */
export const zeroBalanceRow = (r) => {
  const debit = amount(r.debit);
  const credit = amount(r.credit);
  return debit === 0 && credit === 0;
};

/** Conflicts of the fiscal year with a load for this go-live date (a closed year, carried balances, another date, posted journals). */
async function yearConflicts(db, fy, goLiveDate) {
  if (fy.status !== 'open') return [`Fiscal year ${fy.code} is ${fy.status}; opening balances can only be loaded into an open fiscal year`];
  const runs = (await db.query('SELECT DISTINCT source_run FROM opening_balances WHERE fiscal_year = $1', [fy.code])).rows.map((r) => String(r.source_run || ''));
  if (runs.some((r) => !r.startsWith(GO_LIVE_PREFIX))) return [`Fiscal year ${fy.code} already has the opening balances carried forward by a year-end close`];
  const other = runs.find((r) => r !== `${GO_LIVE_PREFIX}${goLiveDate}`);
  if (other) return [`Opening balances of ${fy.code} were loaded for go-live date ${other.slice(GO_LIVE_PREFIX.length)}; load again with that date to replace them`];
  const posted = (await db.query(`SELECT count(*)::int AS n FROM journal_vouchers WHERE status IN ('posted','reversed') AND jv_date >= $1 AND jv_date < $2`,
    [iso(fy.start_date), goLiveDate])).rows[0].n;
  if (posted) return [`${posted} journal(s) are posted in ${fy.code} before the go-live date ${goLiveDate}; the opening balances would count them twice`];
  return [];
}

/** Errors of the rows ({ row, column, message }), the lines to load and the rows with no balance. */
function checkRows(rows, accounts) {
  const errors = [];
  const seen = new Set();
  const lines = [];
  const ignored = [];
  rows.forEach((r, i) => {
    const row = i + 2;
    const fail = (column, message) => errors.push({ row, column, message });
    const code = String(r.accountCode || '').trim();
    const debit = amount(r.debit);
    const credit = amount(r.credit);
    if (!code && !debit && !credit) return; // blank line
    const a = accounts.get(code);
    if (debit === 0 && credit === 0) {
      // zero balance (an account whose movements net to zero): nothing to load; an unknown code is still reported
      if (!a) fail('Account Code', `Account ${code} is not in the chart of accounts`);
      else ignored.push({ row, accountCode: code });
      return;
    }
    if (!code) fail('Account Code', 'Account Code is required');
    else if (!a) fail('Account Code', `Account ${code} is not in the chart of accounts`);
    else if (a.status !== 'active') fail('Account Code', `Account ${code} is inactive`);
    if (Number.isNaN(debit) || Number.isNaN(credit) || debit < 0 || credit < 0) fail(Number.isNaN(debit) || debit < 0 ? 'Debit' : 'Credit', 'Debit and Credit must be amounts of zero or more');
    else if (debit && credit) fail('Debit / Credit', 'Enter the balance as a debit or a credit, not both');
    if (code && seen.has(code)) fail('Account Code', `Account ${code} appears more than once`);
    seen.add(code);
    lines.push({ code, balance: round2((debit || 0) - (credit || 0)), debit: round2(debit || 0), credit: round2(credit || 0) });
  });
  return { errors, lines, ignored };
}

/** The earlier load of a fiscal year (go-live date, accounts, who loaded it and when), or null. */
async function previousLoad(db, fiscalYear) {
  const ob = (await db.query(`SELECT min(source_run) AS run, count(*)::int AS n FROM opening_balances WHERE fiscal_year = $1 AND source_run LIKE $2`,
    [fiscalYear, `${GO_LIVE_PREFIX}%`])).rows[0];
  if (!ob.n) return null;
  const a = (await db.query(`SELECT l.at, COALESCE(u.display_name, u.username, l.username) AS name FROM audit_log l LEFT JOIN users u ON u.id = l.user_id
    WHERE l.entity = 'opening_balances' AND l.entity_id = $1 AND l.action = 'go-live-import' ORDER BY l.at DESC, l.id DESC LIMIT 1`, [fiscalYear])).rows[0];
  return { goLiveDate: ob.run.slice(GO_LIVE_PREFIX.length), accounts: ob.n, loadedAt: a?.at || null, loadedBy: a?.name || null };
}

const asAtOf = (goLiveDate) => iso(new Date(Date.parse(`${goLiveDate}T00:00:00Z`) - 86400000));

/**
 * Check the rows ({ accountCode, debit, credit } by column key) without loading anything: the summary of the load
 * (rows, accounts, totals, difference, ignored rows with no balance), every error as { row, column, message } (row
 * null for an error of the whole file or of the fiscal year) and the earlier load of the year that a load replaces.
 */
export async function validateOpeningBalances(db, rows, { goLiveDate }) {
  if (!DATE.test(String(goLiveDate || ''))) throw badRequest('goLiveDate is required (YYYY-MM-DD): the first day of live transactions');
  const fy = await fiscalYearOf(db, goLiveDate);
  const accounts = new Map((await db.query('SELECT code, name, status FROM gl_accounts')).rows.map((a) => [a.code, a]));
  const { errors, lines, ignored } = checkRows(rows, accounts);
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  const difference = round2(totalDebit - totalCredit);
  const fileErrors = (await yearConflicts(db, fy, goLiveDate)).map((message) => ({ row: null, column: 'Go-live date', message }));
  if (!rows.length) fileErrors.push({ row: null, column: null, message: 'The file has no rows' });
  else if (!errors.length && !lines.length) fileErrors.push({ row: null, column: null, message: 'The file has no amounts' });
  else if (!errors.length && difference !== 0) {
    fileErrors.push({ row: null, column: null, message: `Debits ${totalDebit.toFixed(2)} and credits ${totalCredit.toFixed(2)} do not balance (difference ${difference.toFixed(2)})` });
  }
  const all = [...fileErrors, ...errors];
  return {
    valid: !all.length, fiscalYear: fy.code, goLiveDate, asAt: asAtOf(goLiveDate), rows: lines.length + ignored.length, accounts: lines.length,
    totalDebit, totalCredit, difference, ignored, errors: all, previous: await previousLoad(db, fy.code),
  };
}

/**
 * Validate and load the rows ({ accountCode, debit, credit } by column key). Returns the summary (ignored: the rows
 * with no balance, [{ row, accountCode }]); throws 400 with every row error when anything is wrong (nothing is loaded).
 */
export async function importOpeningBalances(db, rows, { goLiveDate }) {
  if (!DATE.test(String(goLiveDate || ''))) throw badRequest('goLiveDate is required (YYYY-MM-DD): the first day of live transactions');
  if (!rows.length) throw badRequest('The file has no rows');
  const fy = await fiscalYearOf(db, goLiveDate);
  const [problem] = await yearConflicts(db, fy, goLiveDate);
  if (problem) throw conflict(problem);

  const accounts = new Map((await db.query('SELECT code, name, status FROM gl_accounts')).rows.map((a) => [a.code, a]));
  const { errors, lines, ignored } = checkRows(rows, accounts);
  if (errors.length) {
    throw badRequest(`${errors.length} row error(s); nothing was loaded`, errors.slice(0, 50).map((e) => ({ path: `row ${e.row}`, row: e.row, column: e.column, message: `Row ${e.row}: ${e.message}` })));
  }
  if (!lines.length) throw badRequest('The file has no amounts');
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (totalDebit !== totalCredit) throw badRequest(`Debits ${totalDebit.toFixed(2)} and credits ${totalCredit.toFixed(2)} do not balance (difference ${round2(totalDebit - totalCredit).toFixed(2)}); nothing was loaded`);

  const run = `${GO_LIVE_PREFIX}${goLiveDate}`;
  const replaced = (await db.query('DELETE FROM opening_balances WHERE fiscal_year = $1 AND source_run = $2', [fy.code, run])).rowCount;
  for (const l of lines) {
    await db.query('INSERT INTO opening_balances(fiscal_year, account_code, balance, source_run) VALUES ($1,$2,$3,$4)', [fy.code, l.code, l.balance, run]);
  }
  return { fiscalYear: fy.code, goLiveDate, asAt: asAtOf(goLiveDate), accounts: lines.length, totalDebit, totalCredit, replaced, ignored };
}

/** Opening balances of a fiscal year (default: the latest year that has any) with account names and totals. */
export async function listOpeningBalances(db, { fiscalYear } = {}) {
  const fy = fiscalYear || (await db.query('SELECT fiscal_year FROM opening_balances o JOIN fiscal_years f ON f.code = o.fiscal_year ORDER BY f.start_date DESC LIMIT 1')).rows[0]?.fiscal_year;
  if (!fy) return { fiscalYear: null, source: null, lines: [], totalDebit: 0, totalCredit: 0 };
  const rows = (await db.query(`SELECT o.account_code, a.name, a.account_type, o.balance, o.source_run FROM opening_balances o JOIN gl_accounts a ON a.code = o.account_code
    WHERE o.fiscal_year = $1 ORDER BY o.account_code`, [fy])).rows;
  const lines = rows.map((r) => ({ accountCode: r.account_code, accountName: r.name, accountType: r.account_type,
    debit: Number(r.balance) > 0 ? Number(r.balance) : 0, credit: Number(r.balance) < 0 ? -Number(r.balance) : 0 }));
  const src = rows[0]?.source_run || '';
  return {
    fiscalYear: fy, source: src.startsWith(GO_LIVE_PREFIX) ? 'go-live' : 'year-end close', goLiveDate: src.startsWith(GO_LIVE_PREFIX) ? src.slice(GO_LIVE_PREFIX.length) : null,
    lines, totalDebit: round2(lines.reduce((s, l) => s + l.debit, 0)), totalCredit: round2(lines.reduce((s, l) => s + l.credit, 0)),
  };
}
