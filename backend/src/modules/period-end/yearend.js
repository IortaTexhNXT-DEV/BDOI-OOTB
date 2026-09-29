/**
 * Year-End Close (document number year_end_close, prefix YEC).
 *   checks   all twelve periods closed, adjustment period 13 open with no unposted journal, no unposted journal in the
 *            year, trial balance balanced, closing accounts configured, the previous fiscal year closed
 *   close    (1) closing entries in adjustment period 13, dated the fiscal year end: every income and expense account
 *                to Current Year P/L (accounting.account.current_year_pl), then Current Year P/L to Retained Earnings
 *                (accounting.account.retained_earnings)
 *            (2) opening balances of the next fiscal year: the balance-sheet balances at the year end are written to
 *                opening_balances (reports read them through pe_balance_before; no opening journal is posted, so the
 *                ledger is never double counted)
 *            (3) the fiscal year is closed and all its periods locked; the next fiscal year and its periods are created
 *            (4) the fiscal-year rollover hook of document numbering is called when a numbering module provides one
 *   reverse  by a user with approve:period-end until the first period of the next fiscal year is closed: the closing
 *            entries are reversed in period 13, the opening balances removed, the periods unlocked (months closed,
 *            period 13 open) and the fiscal year returns to "closing"
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { round2 } from '../../lib/money.js';
import { addDays } from '../../lib/dates.js';
import { nextNumber } from '../masters/helpers.js';
import { account, createJournal } from '../accounting/lib/ledger.js';
import { APPROVE } from './posting.js';
import { applyStatus, createFiscalYear, ensureCalendar, fyRow, getFiscalYear, iso, periodRow, periodsOf } from './fiscal.js';
import { mirrorJournal } from './journals.js';

const OPEN_JV = ['pending', 'draft', 'for-approval', 'approved'];
const adjCode = (fy) => `${iso(fy.end_date).slice(0, 4)}-13`;

const yeRow = (r) => r && ({
  id: r.id, runNumber: r.run_number, fiscalYear: r.fiscal_year, nextFiscalYear: r.next_fiscal_year, status: r.status, checks: r.checks,
  closingJournalId: r.closing_jv_id, transferJournalId: r.transfer_jv_id, reversalJournalIds: r.reversal_jv_ids, netIncome: r.net_income === null ? null : Number(r.net_income),
  openingAccounts: r.opening_accounts, preparedBy: r.prepared_by, preparedAt: r.prepared_at, closedBy: r.closed_by, closedAt: r.closed_at,
  reversedBy: r.reversed_by, reversedAt: r.reversed_at, reverseReason: r.reverse_reason, remarks: r.remarks, createdAt: r.created_at,
});

async function lockRun(db, id) {
  const r = (await db.query('SELECT * FROM year_end_runs WHERE id = $1 OR run_number = $1 FOR UPDATE', [id])).rows[0];
  if (!r) throw notFound('Year-end close run not found');
  return r;
}

export async function listYearEnd(db) {
  await ensureCalendar(db);
  const years = (await db.query('SELECT * FROM fiscal_years ORDER BY start_date DESC')).rows;
  const runs = (await db.query('SELECT * FROM year_end_runs ORDER BY created_at DESC')).rows;
  return years.map((f) => ({ ...fyRow(f), runs: runs.filter((r) => r.fiscal_year === f.code).map(yeRow) }));
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
  return { ...yeRow(r), fiscalYearInfo: fyRow(fy), periods: (await periodsOf(db, fy.code)).map(periodRow), journals, openingBalances: opening };
}

export async function createYearEnd(db, fiscalYear, user) {
  await ensureCalendar(db);
  const fy = await getFiscalYear(db, fiscalYear);
  if (fy.status === 'closed') throw conflict(`Fiscal year ${fy.code} is already closed`);
  const active = (await db.query('SELECT run_number FROM year_end_runs WHERE fiscal_year = $1 AND status IN (\'draft\',\'checked\',\'closed\')', [fy.code])).rows[0];
  if (active) throw conflict(`Fiscal year ${fy.code} already has a year-end close run (${active.run_number})`);
  const number = await nextNumber('year_end_close');
  const r = (await db.query('INSERT INTO year_end_runs(run_number, fiscal_year, status, prepared_by, prepared_at, created_by) VALUES ($1,$2,\'draft\',$3,now(),$3) RETURNING *',
    [number, fy.code, user?.id ?? null])).rows[0];
  await db.query('UPDATE fiscal_years SET status = \'closing\', updated_at = now() WHERE code = $1 AND status = \'open\'', [fy.code]);
  return r;
}

/** Pre-checks of a year-end close: [{ code, label, status: passed | failed, message }]. */
export async function yearEndChecks(db, fy) {
  const start = iso(fy.start_date); const end = iso(fy.end_date);
  const periods = await periodsOf(db, fy.code);
  const out = [];
  const add = (code, label, failedMsg) => out.push({ code, label, status: failedMsg ? 'failed' : 'passed', message: failedMsg || 'OK' });
  const notClosed = periods.filter((p) => !p.is_adjustment && p.status !== 'closed');
  add('periods_closed', 'All twelve periods closed', notClosed.length ? `Not closed: ${notClosed.map((p) => `${p.period} (${p.status.replace('_', '-')})`).join(', ')}` : null);
  const adj = periods.find((p) => p.is_adjustment);
  const adjOpen = (await db.query('SELECT count(*)::int AS n FROM journal_vouchers WHERE period = $1 AND status = ANY($2)', [adjCode(fy), OPEN_JV])).rows[0].n;
  add('adjustment_period', 'Adjustment period 13 posted and open for the closing entries',
    !adj ? `Adjustment period ${adjCode(fy)} is missing` : adj.status !== 'open' ? `Adjustment period ${adj.period} is ${adj.status}` : adjOpen ? `${adjOpen} adjustment journal(s) not posted` : null);
  const unposted = (await db.query('SELECT count(*)::int AS n FROM journal_vouchers WHERE jv_date BETWEEN $1 AND $2 AND status = ANY($3)', [start, end, OPEN_JV])).rows[0].n;
  add('unposted_journals', 'No unposted journals in the fiscal year', unposted ? `${unposted} journal(s) dated in ${fy.code} not posted` : null);
  const tb = (await db.query(`SELECT COALESCE(sum(l.debit),0) AS d, COALESCE(sum(l.credit),0) AS c FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
    WHERE j.status IN ('posted','reversed') AND j.jv_date <= $1`, [end])).rows[0];
  add('trial_balance', 'Trial balance balances at the year end', round2(tb.d) !== round2(tb.c) ? `Debits ${round2(tb.d)} vs credits ${round2(tb.c)}` : null);
  let accountsMsg = null;
  try {
    const codes = [await account('current_year_pl'), await account('retained_earnings')];
    const found = (await db.query('SELECT code FROM gl_accounts WHERE code = ANY($1) AND status = \'active\' AND account_type = \'equity\'', [codes])).rows.length;
    if (found !== 2) accountsMsg = `Accounts ${codes.join(' / ')} must be active equity accounts`;
  } catch (e) { accountsMsg = e.message; }
  add('closing_accounts', 'Current year P/L and retained earnings accounts configured', accountsMsg);
  const prev = (await db.query('SELECT * FROM fiscal_years WHERE end_date = $1::date - 1', [start])).rows[0];
  add('previous_year', 'Previous fiscal year closed', prev && prev.status !== 'closed' ? `Fiscal year ${prev.code} is ${prev.status}; close it first` : null);
  return out;
}

export async function checkYearEnd(db, id) {
  const r = await lockRun(db, id);
  if (!['draft', 'checked'].includes(r.status)) throw conflict(`Run ${r.run_number} is ${r.status}`);
  const checks = await yearEndChecks(db, await getFiscalYear(db, r.fiscal_year));
  const status = checks.every((c) => c.status === 'passed') ? 'checked' : 'draft';
  await db.query('UPDATE year_end_runs SET checks = $2, status = $3, updated_at = now() WHERE id = $1', [r.id, JSON.stringify(checks), status]);
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

export async function closeYearEnd(db, id, user) {
  const r = await lockRun(db, id);
  if (!['draft', 'checked'].includes(r.status)) throw conflict(`Run ${r.run_number} is ${r.status}`);
  const fy = await getFiscalYear(db, r.fiscal_year);
  const checks = await yearEndChecks(db, fy);
  await db.query('UPDATE year_end_runs SET checks = $2, updated_at = now() WHERE id = $1', [r.id, JSON.stringify(checks)]);
  const failed = checks.filter((c) => c.status !== 'passed');
  if (failed.length) throw conflict(`Year-end close of ${fy.code} blocked – ${failed.map((c) => `${c.label}: ${c.message}`).join('; ')}`);
  const end = iso(fy.end_date);
  const period = adjCode(fy);
  const cypl = await account('current_year_pl');
  const re = await account('retained_earnings');
  const base = { date: end, period, source: 'year-end-close', kind: 'closing', entryType: 'YEAR_END_CLOSE', referenceType: 'YearEndClose', referenceId: r.id, status: 'posted' };

  // (1) income and expense accounts to Current Year P/L
  const pl = (await db.query(`SELECT l.account_code, sum(l.debit - l.credit) AS bal FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
     WHERE a.account_type IN ('income','expense') AND j.status IN ('posted','reversed') AND j.jv_date <= $1 GROUP BY 1 HAVING round(sum(l.debit - l.credit), 2) <> 0 ORDER BY 1`, [end])).rows;
  let closing = null;
  const net = round2(-pl.reduce((s, x) => s + Number(x.bal), 0)); // profit is positive
  if (pl.length) {
    const lines = pl.map((x) => ({ accountCode: x.account_code, debit: Number(x.bal) < 0 ? round2(-x.bal) : 0, credit: Number(x.bal) > 0 ? round2(x.bal) : 0, memo: `Close to current year P/L ${fy.code}` }));
    if (net !== 0) lines.push({ accountCode: cypl, debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0, memo: `Net ${net >= 0 ? 'income' : 'loss'} ${fy.code}` });
    closing = await createJournal(db, { ...base, entrySubType: 'CLOSE_PL', description: `Year-end closing entries ${fy.code}: income and expense to current year P/L`, lines }, user);
  }
  // (2) Current Year P/L to Retained Earnings
  const cyplBal = round2((await db.query(`SELECT COALESCE(sum(l.debit - l.credit),0) AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
     WHERE l.account_code = $1 AND j.status IN ('posted','reversed') AND j.jv_date <= $2`, [cypl, end])).rows[0].b);
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
  const ob = await db.query(`INSERT INTO opening_balances(fiscal_year, account_code, balance, source_run)
     SELECT $1, l.account_code, round(sum(l.debit - l.credit), 2), $3 FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
      WHERE j.status IN ('posted','reversed') AND j.jv_date <= $2 GROUP BY l.account_code HAVING round(sum(l.debit - l.credit), 2) <> 0`, [next.code, end, r.id]);
  // (4) lock the year
  for (const p of await periodsOf(db, fy.code)) await applyStatus(db, p, 'locked', { remarks: `Year-end close ${r.run_number}`, source: 'year-end', referenceId: r.id, user });
  await db.query('UPDATE fiscal_years SET status = \'closed\', closed_by = $2, closed_at = now(), updated_at = now() WHERE code = $1', [fy.code, user?.id ?? null]);
  await db.query(`UPDATE year_end_runs SET status = 'closed', closing_jv_id = $2, transfer_jv_id = $3, net_income = $4, opening_accounts = $5, next_fiscal_year = $6,
      closed_by = $7, closed_at = now(), updated_at = now() WHERE id = $1`, [r.id, closing?.id || null, transfer?.id || null, net, ob.rowCount, next.code, user?.id ?? null]);
  const hook = await rolloverHook(fy.code, next.code);
  return { ...(await getYearEnd(db, r.id)), numberingRollover: hook };
}

export async function reverseYearEnd(db, id, user, { reason }) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Reversing a year-end close requires permission ${APPROVE}`);
  if (!String(reason || '').trim()) throw badRequest('A reason is required to reverse a year-end close');
  const r = await lockRun(db, id);
  if (r.status !== 'closed') throw conflict(`Run ${r.run_number} is ${r.status}; only a closed year can be reversed`);
  const fy = await getFiscalYear(db, r.fiscal_year);
  const nextFirst = (await db.query('SELECT * FROM accounting_periods WHERE fiscal_year = $1 AND period_no = 1', [r.next_fiscal_year])).rows[0];
  if (nextFirst && nextFirst.status !== 'open') throw conflict(`The first period of ${r.next_fiscal_year} (${nextFirst.period}) is ${nextFirst.status.replace('_', '-')}; the year-end close can no longer be reversed`);
  const later = (await db.query('SELECT run_number FROM year_end_runs WHERE fiscal_year = $1 AND status = \'closed\'', [r.next_fiscal_year])).rows[0];
  if (later) throw conflict(`Fiscal year ${r.next_fiscal_year} is closed (${later.run_number}); reverse it first`);
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
  await db.query(`UPDATE year_end_runs SET status = 'reversed', reversed_by = $2, reversed_at = now(), reverse_reason = $3, reversal_jv_ids = $4, updated_at = now() WHERE id = $1`,
    [r.id, user.id, reason, reversals]);
  return getYearEnd(db, r.id);
}

export async function cancelYearEnd(db, id) {
  const r = await lockRun(db, id);
  if (!['draft', 'checked'].includes(r.status)) throw conflict(`Run ${r.run_number} is ${r.status}`);
  await db.query('UPDATE year_end_runs SET status = \'cancelled\', updated_at = now() WHERE id = $1', [r.id]);
  await db.query('UPDATE fiscal_years SET status = \'open\', updated_at = now() WHERE code = $1 AND status = \'closing\'', [r.fiscal_year]);
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
