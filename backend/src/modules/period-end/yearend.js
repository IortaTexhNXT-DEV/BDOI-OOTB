/**
 * Year-End Close (document number year_end_close, prefix YEC), a guided process of five steps:
 *   1 prerequisites  the twelve periods closed (or soft-closed when accounting.year_end_accepts_soft_closed), no
 *                    unposted journal dated in the year, the suspense account nil, the trial balance balanced, the
 *                    closing accounts configured, the previous fiscal year closed
 *   2 adjustments    adjustment period 13 open and every adjustment journal in it posted (approved by a second user)
 *   3 closing        (previewed before the close) every income and expense account to Current Year P/L
 *                    (accounting.account.current_year_pl), then Current Year P/L to Retained Earnings
 *                    (accounting.account.retained_earnings), posted in period 13 and dated the fiscal year end
 *   4 approval       the close itself, by a user with approve:period-end other than the one who started the run
 *                    (maker-checker, finance.maker_checker_enabled): closing entries posted, opening balances written,
 *                    the year closed and its periods locked, the next fiscal year created, and the fiscal-year rollover
 *                    hook of document numbering called when a numbering module provides one
 *   5 opening        (previewed before the close) the balance-sheet balances at the year end written to
 *                    opening_balances of the next year (reports read them through pe_balance_before; no opening journal
 *                    is posted, so the ledger is never double counted). Year-end balances include the year's own opening
 *                    balances (carried forward, or loaded at go-live by opening.js) plus the year's journals
 *   reverse  requested with a reason (Reason Codes master, context year_end_reverse) and approved by another user with
 *            approve:period-end, until the first period of the next fiscal year is closed: the closing entries are
 *            reversed in period 13, the opening balances removed, the periods unlocked (months closed, period 13 open)
 *            and the fiscal year returns to "closing"
 * Every action on a run is kept in year_end_run_history (who, with the roles held then, when, from / to status, reason).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { round2 } from '../../lib/money.js';
import { addDays } from '../../lib/dates.js';
import { getSetting } from '../../lib/settings.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { account, createJournal } from '../accounting/lib/ledger.js';
import { requiredReason } from '../ops-masters/records.js';
import { APPROVE } from './posting.js';
import { applyStatus, createFiscalYear, ensureCalendar, fyRow, getFiscalYear, iso, periodRow, periodsOf } from './fiscal.js';
import { mirrorJournal } from './journals.js';

export const WRITE = 'write:period-end';
const OPEN_JV = ['pending', 'draft', 'for-approval', 'approved'];
const ACTIVE = ['draft', 'checked'];
const SAMPLE = 20;
const adjCode = (fy) => `${iso(fy.end_date).slice(0, 4)}-13`;
const sum = (rows, f) => round2(rows.reduce((s, x) => s + Number(f(x)), 0));
/** Step of a check (runs closed before the steps existed stored their checks without it). */
const stepOf = (c) => c.step || (['adjustment_period', 'adjustments_posted'].includes(c.code) ? 'adjustments' : 'prerequisites');

const yeRow = (r, users = new Map()) => r && ({
  id: r.id, runNumber: r.run_number, fiscalYear: r.fiscal_year, nextFiscalYear: r.next_fiscal_year, status: r.status, checks: r.checks,
  closingJournalId: r.closing_jv_id, transferJournalId: r.transfer_jv_id, reversalJournalIds: r.reversal_jv_ids, netIncome: r.net_income === null ? null : Number(r.net_income),
  openingAccounts: r.opening_accounts, preparedBy: r.prepared_by, preparedByName: users.get(r.prepared_by) || null, preparedAt: r.prepared_at,
  checkedBy: r.checked_by, checkedByName: users.get(r.checked_by) || null, checkedAt: r.checked_at,
  closedBy: r.closed_by, closedByName: users.get(r.closed_by) || null, closedAt: r.closed_at,
  reversedBy: r.reversed_by, reversedByName: users.get(r.reversed_by) || null, reversedAt: r.reversed_at,
  reverseReasonCode: r.reverse_reason_code, reverseReason: r.reverse_reason,
  reverseRequest: r.reverse_requested_at ? {
    by: r.reverse_requested_by, byName: users.get(r.reverse_requested_by) || null, at: r.reverse_requested_at, reasonCode: r.reverse_reason_code, reason: r.reverse_reason,
  } : null,
  remarks: r.remarks, createdAt: r.created_at,
});

async function userNames(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  return new Map((await db.query('SELECT id, COALESCE(display_name, username) AS n FROM users WHERE id = ANY($1)', [list])).rows.map((u) => [u.id, u.n]));
}
const runUsers = (r) => [r.prepared_by, r.checked_by, r.closed_by, r.reversed_by, r.reverse_requested_by];

async function lockRun(db, id) {
  const r = (await db.query('SELECT * FROM year_end_runs WHERE id = $1 OR run_number = $1 FOR UPDATE', [id])).rows[0];
  if (!r) throw notFound('Year-end close run not found');
  return r;
}

/** One row of the run's history, with the roles assigned to the user when acting. */
async function record(db, r, action, { from = r.status, to = null, reasonCode = null, remarks = null, user = null } = {}) {
  await db.query(`INSERT INTO year_end_run_history(run_id, fiscal_year, action, from_status, to_status, reason_code, remarks, changed_by, changed_by_roles)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text,
      COALESCE((SELECT array_agg(ro.code ORDER BY ro.code) FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = $8::text), '{}'))`,
  [r.id, r.fiscal_year, action, from, to, reasonCode, remarks, user?.id ?? null]);
}

/** Whether maker-checker applies (finance.maker_checker_enabled, the switch of assertChecker), to tell the user before acting. */
const makerChecker = () => getSetting('finance.maker_checker_enabled', true);

export async function listYearEnd(db) {
  await ensureCalendar(db);
  const years = (await db.query('SELECT * FROM fiscal_years ORDER BY start_date DESC')).rows;
  const runs = (await db.query('SELECT * FROM year_end_runs ORDER BY created_at DESC')).rows;
  return years.map((f) => ({ ...fyRow(f), runs: runs.filter((r) => r.fiscal_year === f.code).map((r) => yeRow(r)) }));
}

export async function getYearEnd(db, id) {
  const r = (await db.query('SELECT * FROM year_end_runs WHERE id = $1 OR run_number = $1', [id])).rows[0];
  if (!r) throw notFound('Year-end close run not found');
  const fy = await getFiscalYear(db, r.fiscal_year);
  const ids = [r.closing_jv_id, r.transfer_jv_id, ...(r.reversal_jv_ids || [])].filter(Boolean);
  const journals = (await db.query('SELECT id, jv_number, jv_date, period, status, total_debit, description FROM journal_vouchers WHERE id = ANY($1) ORDER BY created_at', [ids])).rows
    .map((j) => ({ journalId: j.id, journalNumber: j.jv_number, date: iso(j.jv_date), period: j.period, status: j.status, amount: Number(j.total_debit), description: j.description }));
  const opening = (await db.query(`SELECT o.account_code, a.name, a.account_type, o.balance FROM opening_balances o JOIN gl_accounts a ON a.code = o.account_code
     WHERE o.source_run = $1 ORDER BY o.account_code`, [r.id])).rows.map((o) => ({ accountCode: o.account_code, accountName: o.name, accountType: o.account_type, balance: Number(o.balance) }));
  return { ...yeRow(r, await userNames(db, runUsers(r))), fiscalYearInfo: fyRow(fy), periods: (await periodsOf(db, fy.code)).map(periodRow), journals, openingBalances: opening };
}

export async function createYearEnd(db, fiscalYear, user) {
  await ensureCalendar(db);
  const fy = await getFiscalYear(db, fiscalYear);
  if (fy.status === 'closed') throw conflict(`Fiscal year ${fy.code} is already closed`);
  const active = (await db.query('SELECT run_number FROM year_end_runs WHERE fiscal_year = $1 AND status IN (\'draft\',\'checked\',\'closed\')', [fy.code])).rows[0];
  if (active) throw conflict(`Fiscal year ${fy.code} already has a year-end close run (${active.run_number})`);
  const number = await nextDocumentNumber('year_end_close');
  const checks = await yearEndChecks(db, fy);
  const status = checks.some((c) => c.status === 'failed') ? 'draft' : 'checked';
  const r = (await db.query(`INSERT INTO year_end_runs(run_number, fiscal_year, status, checks, prepared_by, prepared_at, checked_by, checked_at, created_by)
    VALUES ($1,$2,$3,$4,$5,now(),$5,now(),$5) RETURNING *`, [number, fy.code, status, JSON.stringify(checks), user?.id ?? null])).rows[0];
  await db.query('UPDATE fiscal_years SET status = \'closing\', updated_at = now() WHERE code = $1 AND status = \'open\'', [fy.code]);
  await record(db, r, 'start', { from: null, to: status, user });
  return r;
}

/**
 * Checks of steps 1 (prerequisites) and 2 (adjustments): [{ code, step, label, status: passed | failed |
 * not-applicable, message, data }]. `data` holds the figures the screen shows; `message` is the English summary of the
 * API and of a refused close.
 */
export async function yearEndChecks(db, fy) {
  const start = iso(fy.start_date); const end = iso(fy.end_date);
  const periods = await periodsOf(db, fy.code);
  const out = [];
  const add = (step, code, label, failedMsg, data = {}, status = null) => out.push({ code, step, label, status: status || (failedMsg ? 'failed' : 'passed'), message: failedMsg || 'OK', data });

  // 1 prerequisites
  const softClosed = await getSetting('accounting.year_end_accepts_soft_closed', false);
  const done = new Set(softClosed ? ['soft_closed', 'closed', 'locked'] : ['closed', 'locked']);
  const months = periods.filter((p) => !p.is_adjustment);
  const notClosed = months.filter((p) => !done.has(p.status));
  add('prerequisites', 'periods_closed', softClosed ? 'All twelve periods soft-closed or closed' : 'All twelve periods closed',
    notClosed.length ? `Not closed: ${notClosed.map((p) => `${p.period} (${p.status.replace('_', '-')})`).join(', ')}` : null,
    { required: softClosed ? 'soft_closed' : 'closed', total: months.length, closed: months.length - notClosed.length, open: notClosed.map((p) => ({ period: p.period, status: p.status })) });

  const unposted = (await db.query(`SELECT id, jv_number, jv_date, status, total_debit, description FROM journal_vouchers
     WHERE jv_date BETWEEN $1 AND $2 AND status = ANY($3) AND COALESCE(period, '') <> $4 ORDER BY jv_date, jv_number`, [start, end, OPEN_JV, adjCode(fy)])).rows;
  add('prerequisites', 'unposted_journals', 'No unposted journals in the fiscal year', unposted.length ? `${unposted.length} journal(s) dated in ${fy.code} not posted` : null, {
    count: unposted.length,
    journals: unposted.slice(0, SAMPLE).map((j) => ({ journalId: j.id, journalNumber: j.jv_number, date: iso(j.jv_date), status: j.status, amount: Number(j.total_debit), description: j.description })),
  });

  const suspense = await getSetting('accounting.account.suspense', null);
  if (!suspense) {
    add('prerequisites', 'suspense_balance', 'Suspense account nil', null, { account: null }, 'not-applicable');
  } else {
    const code = String(suspense);
    const name = (await db.query('SELECT name FROM gl_accounts WHERE code = $1', [code])).rows[0]?.name || null;
    const b = round2((await db.query(`SELECT COALESCE(sum(l.debit - l.credit),0) AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      WHERE l.account_code = $1 AND j.status IN ('posted','reversed') AND j.jv_date <= $2`, [code, end])).rows[0].b);
    add('prerequisites', 'suspense_balance', 'Suspense account nil', b !== 0 ? `Suspense account ${code} has a balance of ${b} at ${end}` : null, { account: { code, name }, balance: b });
  }

  const tb = (await db.query(`SELECT COALESCE(sum(l.debit),0) AS d, COALESCE(sum(l.credit),0) AS c FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
    WHERE j.status IN ('posted','reversed') AND j.jv_date <= $1`, [end])).rows[0];
  const difference = round2(Number(tb.d) - Number(tb.c));
  add('prerequisites', 'trial_balance', 'Trial balance balances at the year end', difference !== 0 ? `Debits ${round2(tb.d)} vs credits ${round2(tb.c)}` : null,
    { debit: round2(tb.d), credit: round2(tb.c), difference });

  const accounts = await closingAccounts(db);
  const bad = [accounts.currentYearPl, accounts.retainedEarnings].filter((a) => !a?.ok);
  add('prerequisites', 'closing_accounts', 'Current year P/L and retained earnings accounts configured',
    bad.length ? (accounts.error || `Accounts ${[accounts.currentYearPl?.code, accounts.retainedEarnings?.code].join(' / ')} must be active equity accounts`) : null,
    { currentYearPl: accounts.currentYearPl, retainedEarnings: accounts.retainedEarnings });

  const prev = (await db.query('SELECT * FROM fiscal_years WHERE end_date = $1::date - 1', [start])).rows[0];
  if (!prev) add('prerequisites', 'previous_year', 'Previous fiscal year closed', null, { fiscalYear: null }, 'not-applicable');
  else add('prerequisites', 'previous_year', 'Previous fiscal year closed', prev.status !== 'closed' ? `Fiscal year ${prev.code} is ${prev.status}; close it first` : null, { fiscalYear: prev.code, status: prev.status });

  // 2 adjustments
  const adj = periods.find((p) => p.is_adjustment);
  add('adjustments', 'adjustment_period', 'Adjustment period 13 open for the closing entries',
    !adj ? `Adjustment period ${adjCode(fy)} is missing` : adj.status !== 'open' ? `Adjustment period ${adj.period} is ${adj.status}` : null,
    { period: adjCode(fy), status: adj?.status || null });
  const adjOpen = (await db.query('SELECT count(*)::int AS n FROM journal_vouchers WHERE period = $1 AND status = ANY($2)', [adjCode(fy), OPEN_JV])).rows[0].n;
  add('adjustments', 'adjustments_posted', 'Adjustment journals posted', adjOpen ? `${adjOpen} adjustment journal(s) in ${adjCode(fy)} not posted` : null, { count: adjOpen });
  return out;
}

/** The two accounts of the closing entries: { currentYearPl, retainedEarnings } as { code, name, ok }, or error. */
async function closingAccounts(db) {
  let codes;
  try {
    codes = [await account('current_year_pl'), await account('retained_earnings')];
  } catch (e) {
    return { currentYearPl: null, retainedEarnings: null, error: e.message };
  }
  const rows = new Map((await db.query('SELECT code, name, status, account_type FROM gl_accounts WHERE code = ANY($1)', [codes])).rows.map((a) => [a.code, a]));
  const one = (code) => ({ code, name: rows.get(code)?.name || null, ok: rows.get(code)?.status === 'active' && rows.get(code)?.account_type === 'equity' });
  return { currentYearPl: one(codes[0]), retainedEarnings: one(codes[1]) };
}

export async function checkYearEnd(db, id, user = null) {
  const r = await lockRun(db, id);
  if (!ACTIVE.includes(r.status)) throw conflict(`Run ${r.run_number} is ${r.status}`);
  const checks = await yearEndChecks(db, await getFiscalYear(db, r.fiscal_year));
  const status = checks.some((c) => c.status === 'failed') ? 'draft' : 'checked';
  await db.query('UPDATE year_end_runs SET checks = $2, status = $3, checked_by = $4, checked_at = now(), updated_at = now() WHERE id = $1',
    [r.id, JSON.stringify(checks), status, user?.id ?? null]);
  await record(db, r, 'check', { to: status, user });
  return getYearEnd(db, r.id);
}

async function rolloverHook(fiscalYear, nextFiscalYear) {
  const file = new URL('../numbering/rollover.js', import.meta.url);
  if (!fs.existsSync(fileURLToPath(file))) return { called: false };
  const m = await import(file.href);
  if (typeof m.onFiscalYearRollover !== 'function') return { called: false };
  await m.onFiscalYearRollover({ fiscalYear, nextFiscalYear });
  return { called: true };
}

/**
 * Balances at the fiscal year end (debit-positive, rounded, non-zero) with the account name and type: the year's
 * opening balances (carried forward by the previous close or loaded at go-live) plus the year's posted journals; without
 * opening balances, every posted journal up to the year end. Optionally only some account types or one account.
 */
async function yearEndBalances(db, fy, { types = null, account: code = null } = {}) {
  const hasOpening = (await db.query('SELECT 1 FROM opening_balances WHERE fiscal_year = $1 LIMIT 1', [fy.code])).rows.length > 0;
  return (await db.query(`SELECT x.account_code, a.name, a.account_type, round(sum(x.b), 2) AS bal FROM (
      SELECT account_code, balance AS b FROM opening_balances WHERE fiscal_year = $1 AND $4
      UNION ALL
      SELECT l.account_code, l.debit - l.credit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
       WHERE j.status IN ('posted','reversed') AND j.jv_date <= $3 AND (NOT $4 OR j.jv_date >= $2)
    ) x JOIN gl_accounts a ON a.code = x.account_code
    WHERE ($5::text[] IS NULL OR a.account_type = ANY($5)) AND ($6::text IS NULL OR x.account_code = $6)
    GROUP BY x.account_code, a.name, a.account_type HAVING round(sum(x.b), 2) <> 0 ORDER BY 1`,
  [fy.code, iso(fy.start_date), iso(fy.end_date), hasOpening, types, code])).rows.map((x) => ({ account_code: x.account_code, name: x.name, type: x.account_type, bal: Number(x.bal) }));
}

const entryLine = (code, name, type, balance) => ({ accountCode: code, accountName: name, accountType: type, balance, debit: balance < 0 ? round2(-balance) : 0, credit: balance > 0 ? round2(balance) : 0 });
const balanceLine = (code, name, type, balance) => ({ accountCode: code, accountName: name, accountType: type, balance, debit: balance > 0 ? balance : 0, credit: balance < 0 ? round2(-balance) : 0 });
const totals = (lines) => ({ totalDebit: sum(lines, (l) => l.debit), totalCredit: sum(lines, (l) => l.credit) });

/**
 * What the close would post and carry forward, from the ledger at the year end (steps 3 and 5 before the close):
 * the entry closing each income and expense account, the net income (positive) or loss, the balance of Current Year
 * P/L moved to Retained Earnings, and the balance-sheet balances of the next year's opening.
 */
async function closingPreview(db, fy) {
  const balances = await yearEndBalances(db, fy);
  const accounts = await closingAccounts(db);
  const cypl = accounts.currentYearPl?.code || null;
  const re = accounts.retainedEarnings?.code || null;
  const pl = balances.filter((b) => ['income', 'expense'].includes(b.type));
  const net = round2(-sum(pl, (b) => b.bal));
  const transfer = round2((balances.find((b) => b.account_code === cypl)?.bal || 0) - net);
  const sheet = balances.filter((b) => !['income', 'expense'].includes(b.type) && b.account_code !== cypl);
  const opening = sheet.map((b) => ({ ...b, bal: b.account_code === re ? round2(b.bal + transfer) : b.bal }));
  if (re && !sheet.some((b) => b.account_code === re) && transfer) opening.push({ account_code: re, name: accounts.retainedEarnings.name, type: 'equity', bal: transfer });
  const lines = pl.map((b) => entryLine(b.account_code, b.name, b.type, b.bal));
  const openingLines = opening.filter((b) => b.bal !== 0).sort((a, b) => a.account_code.localeCompare(b.account_code)).map((b) => balanceLine(b.account_code, b.name, b.type, b.bal));
  return {
    closing: {
      source: 'preview', lines, totalIncome: round2(-sum(pl.filter((b) => b.type === 'income'), (b) => b.bal)), totalExpense: sum(pl.filter((b) => b.type === 'expense'), (b) => b.bal),
      netIncome: net, transfer, currentYearPl: accounts.currentYearPl, retainedEarnings: accounts.retainedEarnings, journals: [],
    },
    opening: { source: 'preview', lines: openingLines, ...totals(openingLines) },
  };
}

/** Steps 3 and 5 of a closed (or reversed) run: the posted closing journals and the opening balances it wrote. */
async function closingPosted(db, r) {
  const accounts = await closingAccounts(db);
  const ids = [r.closing_jv_id, r.transfer_jv_id, ...(r.reversal_jv_ids || [])].filter(Boolean);
  const journals = (await db.query(`SELECT id, jv_number, jv_date, period, status, total_debit, description, entry_sub_type FROM journal_vouchers
     WHERE id = ANY($1) ORDER BY created_at`, [ids])).rows
    .map((j) => ({ journalId: j.id, journalNumber: j.jv_number, date: iso(j.jv_date), period: j.period, status: j.status, amount: Number(j.total_debit), description: j.description, kind: j.entry_sub_type }));
  const lines = (await db.query(`SELECT l.account_code, a.name, a.account_type, l.debit, l.credit FROM journal_lines l JOIN gl_accounts a ON a.code = l.account_code
     WHERE l.jv_id = $1 AND a.account_type IN ('income','expense') ORDER BY l.line_no`, [r.closing_jv_id])).rows
    .map((l) => entryLine(l.account_code, l.name, l.account_type, round2(Number(l.credit) - Number(l.debit))));
  const cyplLine = r.transfer_jv_id && accounts.currentYearPl
    ? (await db.query('SELECT debit, credit FROM journal_lines WHERE jv_id = $1 AND account_code = $2', [r.transfer_jv_id, accounts.currentYearPl.code])).rows[0] : null;
  const opening = (await db.query(`SELECT o.account_code, a.name, a.account_type, o.balance FROM opening_balances o JOIN gl_accounts a ON a.code = o.account_code
     WHERE o.source_run = $1 ORDER BY o.account_code`, [r.id])).rows.map((o) => balanceLine(o.account_code, o.name, o.account_type, Number(o.balance)));
  const income = lines.filter((l) => l.accountType === 'income');
  return {
    closing: {
      source: 'posted', lines, totalIncome: round2(-sum(income, (l) => l.balance)), totalExpense: sum(lines.filter((l) => l.accountType === 'expense'), (l) => l.balance),
      netIncome: r.net_income === null ? null : Number(r.net_income), transfer: cyplLine ? round2(Number(cyplLine.credit) - Number(cyplLine.debit)) : 0,
      currentYearPl: accounts.currentYearPl, retainedEarnings: accounts.retainedEarnings, journals,
    },
    opening: { source: 'carried-forward', lines: opening, ...totals(opening) },
  };
}

/** Why the closed run `r` can no longer be reversed: { code, message }, or null. */
async function reversalBlock(db, r) {
  const nextFirst = (await db.query('SELECT * FROM accounting_periods WHERE fiscal_year = $1 AND period_no = 1', [r.next_fiscal_year])).rows[0];
  if (nextFirst && nextFirst.status !== 'open') {
    return { code: 'next-period', period: nextFirst.period, message: `The first period of ${r.next_fiscal_year} (${nextFirst.period}) is ${nextFirst.status.replace('_', '-')}; the year-end close can no longer be reversed` };
  }
  const later = (await db.query('SELECT run_number FROM year_end_runs WHERE fiscal_year = $1 AND status = \'closed\'', [r.next_fiscal_year])).rows[0];
  if (later) return { code: 'next-year', fiscalYear: r.next_fiscal_year, message: `Fiscal year ${r.next_fiscal_year} is closed (${later.run_number}); reverse it first` };
  return null;
}

const allow = (reason = null) => ({ allowed: !reason, reason });

/**
 * The actions the user may take on the year (null when the action does not apply), each with the reason it is
 * refused: permission, maker-checker, checks, period (adjustment period not open), disabled (adjustments switched off),
 * next-period / next-year (reversal too late).
 */
async function actionsFor(db, { fy, run, checks, adjustmentPeriod, user }) {
  const write = hasPermission(user, WRITE);
  const approve = hasPermission(user, APPROVE);
  const mc = await makerChecker();
  const active = run && ACTIVE.includes(run.status);
  const out = { start: null, check: null, cancel: null, adjust: null, close: null, requestReversal: null, approveReversal: null, withdrawReversal: null };
  if (!run && fy.status !== 'closed') out.start = allow(write ? null : 'permission');
  if (active) {
    out.check = allow(write ? null : 'permission');
    out.cancel = allow(write ? null : 'permission');
    out.close = allow(!approve ? 'permission' : mc && run.prepared_by === user?.id ? 'maker-checker' : checks.some((c) => c.status === 'failed') ? 'checks' : null);
  }
  if (fy.status !== 'closed') {
    const enabled = await getSetting('accounting.adjustment_period_enabled', true);
    out.adjust = allow(!write ? 'permission' : !enabled ? 'disabled' : adjustmentPeriod?.status !== 'open' ? 'period' : null);
  }
  if (run?.status === 'closed' && !run.reverse_requested_at) {
    const block = await reversalBlock(db, run);
    out.requestReversal = { ...allow(!write ? 'permission' : block?.code || null), ...(block ? { period: block.period || null, fiscalYear: block.fiscalYear || null } : {}) };
  }
  if (run?.status === 'closed' && run.reverse_requested_at) {
    out.approveReversal = allow(!approve ? 'permission' : mc && run.reverse_requested_by === user?.id ? 'maker-checker' : null);
    out.withdrawReversal = allow(approve || run.reverse_requested_by === user?.id ? null : 'permission');
  }
  return out;
}

/**
 * Everything the Year-End Close screen shows for one fiscal year (the year being closed, else the oldest open year,
 * when none is given): the year, its run (the active or closed one; null before a run is started or after a reversal
 * or cancellation), the five steps with their status, the checks, the adjustment journals, the closing entries and the
 * opening balances (previewed until the close), the history of all runs of the year and the user's actions.
 */
export async function yearEndOverview(db, fiscalYear, user) {
  const years = await ensureCalendar(db);
  const fy = fiscalYear ? await getFiscalYear(db, fiscalYear)
    : years.find((y) => y.status === 'closing') || years.find((y) => y.status !== 'closed') || years[years.length - 1];
  const runs = (await db.query('SELECT * FROM year_end_runs WHERE fiscal_year = $1 ORDER BY created_at DESC', [fy.code])).rows;
  const run = runs.find((r) => [...ACTIVE, 'closed'].includes(r.status)) || null;
  const periods = await periodsOf(db, fy.code);
  const adjustmentPeriod = periods.find((p) => p.is_adjustment) || null;
  const closed = run?.status === 'closed';
  const checks = (closed ? (run.checks || []) : await yearEndChecks(db, fy)).map((c) => ({ ...c, step: stepOf(c), data: c.data || null }));
  const prev = (await db.query('SELECT code, status FROM fiscal_years WHERE end_date = $1::date - 1', [iso(fy.start_date)])).rows[0] || null;
  const next = (await db.query('SELECT code, status FROM fiscal_years WHERE start_date = $1::date + 1', [iso(fy.end_date)])).rows[0] || null;

  const adjustments = (await db.query(`SELECT id, jv_number, jv_date, status, total_debit, description, created_by, created_at, posted_by, posted_at FROM journal_vouchers
     WHERE period = $1 AND source <> 'year-end-close' ORDER BY created_at`, [adjCode(fy)])).rows;
  const history = (await db.query(`SELECT h.*, r.run_number FROM year_end_run_history h JOIN year_end_runs r ON r.id = h.run_id
     WHERE h.fiscal_year = $1 ORDER BY h.changed_at DESC, h.id DESC`, [fy.code])).rows;
  const users = await userNames(db, [...runs.flatMap(runUsers), ...adjustments.flatMap((j) => [j.created_by, j.posted_by]), ...history.map((h) => h.changed_by)]);
  const roleCodes = [...new Set(history.flatMap((h) => h.changed_by_roles || []))];
  const roleNames = roleCodes.length ? new Map((await db.query('SELECT code, name FROM roles WHERE code = ANY($1)', [roleCodes])).rows.map((x) => [x.code, x.name])) : new Map();

  const failed = (step) => checks.some((c) => c.step === step && c.status === 'failed');
  const pendingAdjustments = adjustments.filter((j) => OPEN_JV.includes(j.status)).length;
  const steps = closed
    ? [['prerequisites', 'passed'], ['adjustments', 'passed'], ['closing', 'posted'], ['approval', 'done'], ['opening', 'done']]
    : [['prerequisites', failed('prerequisites') ? 'failed' : 'passed'],
      ['adjustments', !failed('adjustments') ? 'passed' : pendingAdjustments && adjustmentPeriod?.status === 'open' ? 'pending' : 'failed'],
      ['closing', 'pending'],
      ['approval', failed('prerequisites') || failed('adjustments') ? 'blocked' : 'pending-approval'],
      ['opening', 'pending']];
  // the step to work on: the first of steps 1 and 2 still to resolve, else the close (steps 3 and 5 are previews)
  const current = closed ? 'approval' : (steps.slice(0, 2).find(([, s]) => s !== 'passed') || ['approval'])[0];
  const { closing, opening } = run ? (closed ? await closingPosted(db, run) : await closingPreview(db, fy)) : { closing: null, opening: null };

  return {
    fiscalYear: { ...fyRow(fy), closedByName: (await userNames(db, [fy.closed_by])).get(fy.closed_by) || null, adjustmentPeriod: adjCode(fy), adjustmentPeriodStatus: adjustmentPeriod?.status || null },
    previousYear: prev, nextYear: next ? { code: next.code, status: next.status } : { code: `FY${Number(iso(fy.end_date).slice(0, 4)) + 1}`, status: null },
    run: run ? yeRow(run, users) : null,
    runs: runs.map((r) => ({ id: r.id, runNumber: r.run_number, status: r.status, preparedByName: users.get(r.prepared_by) || null, preparedAt: r.prepared_at, closedAt: r.closed_at, reversedAt: r.reversed_at })),
    steps: steps.map(([key, status]) => ({ key, status })),
    currentStep: current,
    checks,
    adjustments: adjustments.map((j) => ({ journalId: j.id, journalNumber: j.jv_number, date: iso(j.jv_date), status: j.status, amount: Number(j.total_debit), description: j.description,
      createdBy: j.created_by, createdByName: users.get(j.created_by) || null, createdAt: j.created_at, postedByName: users.get(j.posted_by) || null, postedAt: j.posted_at })),
    closing: closing && { ...closing, period: adjCode(fy), date: iso(fy.end_date) },
    opening: opening && { ...opening, fiscalYear: run?.next_fiscal_year || (next ? next.code : `FY${Number(iso(fy.end_date).slice(0, 4)) + 1}`) },
    activity: history.map((h) => ({ id: Number(h.id), runNumber: h.run_number, action: h.action, fromStatus: h.from_status, toStatus: h.to_status, reasonCode: h.reason_code, remarks: h.remarks,
      by: h.changed_by, byName: users.get(h.changed_by) || null, roles: (h.changed_by_roles || []).map((c) => roleNames.get(c) || c), at: h.changed_at })),
    actions: await actionsFor(db, { fy, run, checks, adjustmentPeriod, user }),
  };
}

export async function closeYearEnd(db, id, user, { remarks = null } = {}) {
  const r = await lockRun(db, id);
  if (!ACTIVE.includes(r.status)) throw conflict(`Run ${r.run_number} is ${r.status}`);
  await assertChecker(user, r.prepared_by, 'year-end close');
  const fy = await getFiscalYear(db, r.fiscal_year);
  const checks = await yearEndChecks(db, fy);
  await db.query('UPDATE year_end_runs SET checks = $2, updated_at = now() WHERE id = $1', [r.id, JSON.stringify(checks)]);
  const failed = checks.filter((c) => c.status === 'failed');
  if (failed.length) throw conflict(`Year-end close of ${fy.code} blocked – ${failed.map((c) => `${c.label}: ${c.message}`).join('; ')}`);
  const end = iso(fy.end_date);
  const period = adjCode(fy);
  const cypl = await account('current_year_pl');
  const re = await account('retained_earnings');
  const base = { date: end, period, source: 'year-end-close', kind: 'closing', entryType: 'YEAR_END_CLOSE', referenceType: 'YearEndClose', referenceId: r.id, status: 'posted' };

  // (1) income and expense accounts to Current Year P/L
  const pl = await yearEndBalances(db, fy, { types: ['income', 'expense'] });
  let closing = null;
  const net = round2(-pl.reduce((s, x) => s + Number(x.bal), 0)); // profit is positive
  if (pl.length) {
    const lines = pl.map((x) => ({ accountCode: x.account_code, debit: Number(x.bal) < 0 ? round2(-x.bal) : 0, credit: Number(x.bal) > 0 ? round2(x.bal) : 0, memo: `Close to current year P/L ${fy.code}` }));
    if (net !== 0) lines.push({ accountCode: cypl, debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0, memo: `Net ${net >= 0 ? 'income' : 'loss'} ${fy.code}` });
    closing = await createJournal(db, { ...base, entrySubType: 'CLOSE_PL', description: `Year-end closing entries ${fy.code}: income and expense to current year P/L`, lines }, user);
  }
  // (2) Current Year P/L to Retained Earnings
  const cyplBal = round2((await yearEndBalances(db, fy, { account: cypl }))[0]?.bal || 0);
  let transfer = null;
  if (cyplBal !== 0) {
    transfer = await createJournal(db, { ...base, entrySubType: 'TRANSFER_RE', description: `Year-end closing entries ${fy.code}: current year P/L to retained earnings`,
      lines: [{ accountCode: cypl, debit: cyplBal < 0 ? -cyplBal : 0, credit: cyplBal > 0 ? cyplBal : 0, memo: `Transfer to retained earnings ${fy.code}` },
        { accountCode: re, debit: cyplBal > 0 ? cyplBal : 0, credit: cyplBal < 0 ? -cyplBal : 0, memo: `Net ${net >= 0 ? 'income' : 'loss'} ${fy.code}` }] }, user);
  }
  // (3) next fiscal year and opening balances
  let next = (await db.query('SELECT * FROM fiscal_years WHERE start_date = $1', [addDays(end, 1)])).rows[0];
  if (!next) next = await createFiscalYear(db, addDays(end, 1), user);
  await db.query('DELETE FROM opening_balances WHERE fiscal_year = $1', [next.code]);
  const closingBalances = await yearEndBalances(db, fy);
  for (const b of closingBalances) {
    await db.query('INSERT INTO opening_balances(fiscal_year, account_code, balance, source_run) VALUES ($1,$2,$3,$4)', [next.code, b.account_code, b.bal, r.id]);
  }
  // (4) lock the year
  for (const p of await periodsOf(db, fy.code)) await applyStatus(db, p, 'locked', { remarks: `Year-end close ${r.run_number}`, source: 'year-end', referenceId: r.id, user });
  await db.query('UPDATE fiscal_years SET status = \'closed\', closed_by = $2, closed_at = now(), updated_at = now() WHERE code = $1', [fy.code, user?.id ?? null]);
  await db.query(`UPDATE year_end_runs SET status = 'closed', closing_jv_id = $2, transfer_jv_id = $3, net_income = $4, opening_accounts = $5, next_fiscal_year = $6,
      closed_by = $7, closed_at = now(), remarks = COALESCE($8, remarks), updated_at = now() WHERE id = $1`,
  [r.id, closing?.id || null, transfer?.id || null, net, closingBalances.length, next.code, user?.id ?? null, remarks]);
  await record(db, r, 'close', { to: 'closed', remarks, user });
  const hook = await rolloverHook(fy.code, next.code);
  return { ...(await getYearEnd(db, r.id)), numberingRollover: hook };
}

/** Request the reversal of a closed year (write:period-end), with a reason of context year_end_reverse. */
export async function requestReversal(db, id, user, body) {
  const reason = await requiredReason(db, 'year_end_reverse', body);
  const r = await lockRun(db, id);
  if (r.status !== 'closed') throw conflict(`Run ${r.run_number} is ${r.status}; only a closed year can be reversed`);
  if (r.reverse_requested_at) throw conflict(`The reversal of ${r.run_number} has already been requested`);
  const block = await reversalBlock(db, r);
  if (block) throw conflict(block.message);
  await db.query(`UPDATE year_end_runs SET reverse_requested_by = $2, reverse_requested_at = now(), reverse_reason_code = $3, reverse_reason = $4, updated_at = now()
    WHERE id = $1`, [r.id, user.id, reason.code, reason.text]);
  await record(db, r, 'reverse-request', { to: r.status, reasonCode: reason.code, remarks: reason.text, user });
  return getYearEnd(db, r.id);
}

/** Withdraw a reversal request: the requester, or a user with approve:period-end. */
export async function withdrawReversal(db, id, user) {
  const r = await lockRun(db, id);
  if (!r.reverse_requested_at) throw conflict(`No reversal of ${r.run_number} is waiting for approval`);
  if (r.reverse_requested_by !== user.id && !hasPermission(user, APPROVE)) throw forbidden('Only the requester or an approver may withdraw the reversal request');
  await db.query(`UPDATE year_end_runs SET reverse_requested_by = NULL, reverse_requested_at = NULL, reverse_reason_code = NULL, reverse_reason = NULL, updated_at = now()
    WHERE id = $1`, [r.id]);
  await record(db, r, 'reverse-withdraw', { to: r.status, reasonCode: r.reverse_reason_code, remarks: r.reverse_reason, user });
  return getYearEnd(db, r.id);
}

/** Approve the requested reversal (approve:period-end, not the requester) and reverse the close with its reason. */
export async function reverseYearEnd(db, id, user, { remarks = null } = {}) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Reversing a year-end close requires permission ${APPROVE}`);
  const r = await lockRun(db, id);
  if (r.status !== 'closed') throw conflict(`Run ${r.run_number} is ${r.status}; only a closed year can be reversed`);
  if (!r.reverse_requested_at) throw conflict(`Request the reversal of ${r.run_number} with a reason first; another user approves it`);
  await assertChecker(user, r.reverse_requested_by, 'reversal of the year-end close');
  const block = await reversalBlock(db, r);
  if (block) throw conflict(block.message);
  const reason = r.reverse_reason;
  const fy = await getFiscalYear(db, r.fiscal_year);
  await db.query('SELECT set_config(\'brokerverse.period_unlock\', \'on\', true)');
  for (const p of await periodsOf(db, fy.code)) {
    await applyStatus(db, p, p.is_adjustment ? 'open' : 'closed', { remarks: `Year-end close ${r.run_number} reversed: ${reason}`, source: 'year-end-reversal', referenceId: r.id, user });
  }
  await db.query('SELECT set_config(\'brokerverse.period_unlock\', \'\', true)');
  await db.query('UPDATE fiscal_years SET status = \'closing\', closed_by = NULL, closed_at = NULL, remarks = $2, updated_at = now() WHERE code = $1', [fy.code, `Year-end close reversed: ${reason}`]);
  await db.query('DELETE FROM opening_balances WHERE source_run = $1', [r.id]);
  const reversals = [];
  for (const jvId of [r.transfer_jv_id, r.closing_jv_id].filter(Boolean)) {
    const jv = (await db.query('SELECT * FROM journal_vouchers WHERE id = $1 FOR UPDATE', [jvId])).rows[0];
    if (jv.status !== 'posted') continue;
    const m = await mirrorJournal(db, jv, { date: iso(fy.end_date), period: adjCode(fy), description: `Reversal of ${jv.jv_number} (year-end close ${r.run_number} reversed)`, source: 'year-end-close', user, markOriginal: true });
    reversals.push(m.id);
  }
  await db.query(`UPDATE year_end_runs SET status = 'reversed', reversed_by = $2, reversed_at = now(), reversal_jv_ids = $3, updated_at = now() WHERE id = $1`,
    [r.id, user.id, reversals]);
  await record(db, r, 'reverse', { to: 'reversed', reasonCode: r.reverse_reason_code, remarks: remarks ? `${reason}; ${remarks}` : reason, user });
  return getYearEnd(db, r.id);
}

export async function cancelYearEnd(db, id, user = null) {
  const r = await lockRun(db, id);
  if (!ACTIVE.includes(r.status)) throw conflict(`Run ${r.run_number} is ${r.status}`);
  await db.query('UPDATE year_end_runs SET status = \'cancelled\', updated_at = now() WHERE id = $1', [r.id]);
  await db.query('UPDATE fiscal_years SET status = \'open\', updated_at = now() WHERE code = $1 AND status = \'closing\'', [r.fiscal_year]);
  await record(db, r, 'cancel', { to: 'cancelled', user });
  return getYearEnd(db, r.id);
}

/** Year-end adjustment journal in adjustment period 13 (pending, approved and posted by a second user). */
export async function createAdjustment(db, b, user, adjustmentEnabled) {
  if (!adjustmentEnabled) throw conflict('Adjustment journals are disabled (accounting.adjustment_period_enabled)');
  const fy = await getFiscalYear(db, b.fiscalYear);
  if (fy.status === 'closed') throw conflict(`Fiscal year ${fy.code} is closed`);
  const p = (await db.query('SELECT status FROM accounting_periods WHERE period = $1', [adjCode(fy)])).rows[0];
  if (p?.status !== 'open') throw conflict(`Adjustment period ${adjCode(fy)} is ${p?.status || 'missing'}`);
  return createJournal(db, { date: iso(fy.end_date), period: adjCode(fy), description: b.description, source: 'adjustment', kind: 'standard', manual: true,
    entryType: 'YEAR_END_ADJUSTMENT', referenceType: 'FiscalYear', referenceId: fy.code, status: 'pending', requiresApproval: true, lines: b.lines }, user);
}
