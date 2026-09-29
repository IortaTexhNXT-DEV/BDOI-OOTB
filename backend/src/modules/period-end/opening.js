/**
 * Go-live opening balances: the trial balance of the old system at the day before the go-live date, loaded into
 * opening_balances of the fiscal year that contains the go-live date (source_run 'go-live:<date>'). Reports read them
 * through pe_balance_before like the balances carried forward by a year-end close; no journal is posted.
 *
 * Rules: every account exists and is active; each row has a debit or a credit, not both; debits equal credits; the
 * fiscal year is open, has no balances carried forward by a year-end close and no posted journal before the go-live
 * date. Loading the same go-live date again replaces the earlier load (idempotent); another date is refused.
 */
import { badRequest, conflict } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';
import { ensureCalendar, iso } from './fiscal.js';

export const GO_LIVE_PREFIX = 'go-live:';

/** Columns of the opening balance upload; the upload template is built from this list. */
export const OPENING_BALANCE_COLUMNS = [
  { key: 'accountCode', header: 'Account Code', aliases: ['account', 'gl account', 'code'], required: true, format: 'GL account code of the chart of accounts (active)', example: '1102001' },
  { key: 'accountName', header: 'Account Name', aliases: ['name'], format: 'For your reference only; not imported', example: 'Cash in Bank – Operating Account' },
  { key: 'debit', header: 'Debit', aliases: ['dr'], required: 'Debit or Credit', format: 'Amount in PHP, no sign; the account balance when it is a debit balance', example: '1250000.00' },
  { key: 'credit', header: 'Credit', aliases: ['cr'], required: 'Debit or Credit', format: 'Amount in PHP, no sign; the account balance when it is a credit balance', example: '' },
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

/**
 * Validate and load the rows ({ accountCode, debit, credit } by column key). Returns the summary; throws 400 with
 * every row error when anything is wrong (nothing is loaded).
 */
export async function importOpeningBalances(db, rows, { goLiveDate }) {
  if (!DATE.test(String(goLiveDate || ''))) throw badRequest('goLiveDate is required (YYYY-MM-DD): the first day of live transactions');
  if (!rows.length) throw badRequest('The file has no rows');
  const fy = await fiscalYearOf(db, goLiveDate);
  if (fy.status !== 'open') throw conflict(`Fiscal year ${fy.code} is ${fy.status}; opening balances can only be loaded into an open fiscal year`);
  const runs = (await db.query('SELECT DISTINCT source_run FROM opening_balances WHERE fiscal_year = $1', [fy.code])).rows.map((r) => String(r.source_run || ''));
  const carried = runs.find((r) => !r.startsWith(GO_LIVE_PREFIX));
  if (carried) throw conflict(`Fiscal year ${fy.code} already has the opening balances carried forward by a year-end close`);
  const other = runs.find((r) => r !== `${GO_LIVE_PREFIX}${goLiveDate}`);
  if (other) throw conflict(`Opening balances of ${fy.code} were loaded for go-live date ${other.slice(GO_LIVE_PREFIX.length)}; load again with that date to replace them`);
  const posted = (await db.query(`SELECT count(*)::int AS n FROM journal_vouchers WHERE status IN ('posted','reversed') AND jv_date >= $1 AND jv_date < $2`,
    [iso(fy.start_date), goLiveDate])).rows[0].n;
  if (posted) throw conflict(`${posted} journal(s) are posted in ${fy.code} before the go-live date ${goLiveDate}; the opening balances would count them twice`);

  const accounts = new Map((await db.query('SELECT code, name, status FROM gl_accounts')).rows.map((a) => [a.code, a]));
  const errors = [];
  const seen = new Set();
  const lines = [];
  rows.forEach((r, i) => {
    const row = i + 2;
    const fail = (message) => errors.push({ path: `row ${row}`, message: `Row ${row}: ${message}` });
    const code = String(r.accountCode || '').trim();
    const debit = amount(r.debit);
    const credit = amount(r.credit);
    if (!code && !debit && !credit) return; // blank line
    const a = accounts.get(code);
    if (!code) fail('Account Code is required');
    else if (!a) fail(`Account ${code} is not in the chart of accounts`);
    else if (a.status !== 'active') fail(`Account ${code} is inactive`);
    if (Number.isNaN(debit) || Number.isNaN(credit) || debit < 0 || credit < 0) fail('Debit and Credit must be amounts of zero or more');
    else if (debit && credit) fail('Enter the balance as a debit or a credit, not both');
    else if (!debit && !credit) fail('The row has no amount');
    if (code && seen.has(code)) fail(`Account ${code} appears more than once`);
    seen.add(code);
    lines.push({ code, balance: round2((debit || 0) - (credit || 0)), debit: round2(debit || 0), credit: round2(credit || 0) });
  });
  if (errors.length) throw badRequest(`${errors.length} row error(s); nothing was loaded`, errors.slice(0, 50));
  if (!lines.length) throw badRequest('The file has no amounts');
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (totalDebit !== totalCredit) throw badRequest(`Debits ${totalDebit.toFixed(2)} and credits ${totalCredit.toFixed(2)} do not balance (difference ${round2(totalDebit - totalCredit).toFixed(2)}); nothing was loaded`);

  const run = `${GO_LIVE_PREFIX}${goLiveDate}`;
  const replaced = (await db.query('DELETE FROM opening_balances WHERE fiscal_year = $1 AND source_run = $2', [fy.code, run])).rowCount;
  for (const l of lines) {
    await db.query('INSERT INTO opening_balances(fiscal_year, account_code, balance, source_run) VALUES ($1,$2,$3,$4)', [fy.code, l.code, l.balance, run]);
  }
  return { fiscalYear: fy.code, goLiveDate, asAt: iso(new Date(Date.parse(`${goLiveDate}T00:00:00Z`) - 86400000)), accounts: lines.length, totalDebit, totalCredit, replaced };
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
