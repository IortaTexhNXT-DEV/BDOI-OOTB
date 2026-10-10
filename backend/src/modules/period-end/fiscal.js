/**
 * Fiscal calendar: fiscal years (FYyyyy, named after the calendar year in which they end), their twelve monthly
 * periods (code YYYY-MM of the month) and the adjustment period 13 (code yyyy-13, dated the fiscal year end, used for
 * year-end adjustments and the closing entries). The first fiscal year starts in accounting.fiscal_year_start_month;
 * each later one starts the day after its predecessor ends. Years are generated on demand from the first journal date
 * up to the year containing today.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { addDays, today } from '../../lib/dates.js';
import { APPROVE, isAdjustmentPeriod } from './posting.js';
import { requiredReason } from '../ops-masters/records.js';

export const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
/** First day of the month n months after the month of `date` (n may be negative). */
export const addMonths = (date, n) => {
  const [y, m] = iso(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};
export const monthEnd = (date) => addDays(addMonths(date, 1), -1);
export const monthStart = (date) => `${iso(date).slice(0, 7)}-01`;

const PERIOD_STATUSES = ['open', 'soft_closed', 'closed', 'locked'];

export const fyRow = (f) => f && ({ code: f.code, fiscalYear: f.code, startDate: iso(f.start_date), endDate: iso(f.end_date), status: f.status,
  closedBy: f.closed_by, closedAt: f.closed_at, remarks: f.remarks, createdAt: f.created_at });
export const periodRow = (p) => p && ({ period: p.period, fiscalYear: p.fiscal_year, periodNo: p.period_no, startDate: p.start_date ? iso(p.start_date) : null,
  endDate: p.end_date ? iso(p.end_date) : null, isAdjustment: !!p.is_adjustment, status: p.status, closedBy: p.closed_by, closedAt: p.closed_at,
  softClosedBy: p.soft_closed_by, softClosedAt: p.soft_closed_at, reopenedBy: p.reopened_by, reopenedAt: p.reopened_at, lockedAt: p.locked_at, remarks: p.remarks });

async function startMonth() {
  const m = Number(await getSetting('accounting.fiscal_year_start_month', 4));
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : 4;
}

/** Start date of the fiscal year (per the configured start month) that contains `date`. */
export async function fiscalStartFor(date) {
  const sm = await startMonth();
  const [y, m] = iso(date).split('-').map(Number);
  const year = m >= sm ? y : y - 1;
  return `${year}-${String(sm).padStart(2, '0')}-01`;
}

/** Insert a fiscal year starting on `start` with its 12 periods and adjustment period 13. */
export async function createFiscalYear(db, start, user = null) {
  const end = addDays(addMonths(start, 12), -1);
  const code = `FY${end.slice(0, 4)}`;
  const clash = (await db.query('SELECT code FROM fiscal_years WHERE code = $1 OR (start_date <= $3 AND end_date >= $2)', [code, start, end])).rows[0];
  if (clash) throw conflict(`Fiscal year ${clash.code} already covers ${start} to ${end}`);
  await db.query('INSERT INTO fiscal_years(code, start_date, end_date, created_by) VALUES ($1,$2,$3,$4)', [code, start, end, user?.id ?? null]);
  for (let i = 0; i < 12; i += 1) {
    const ps = addMonths(start, i);
    const pe = addDays(addMonths(start, i + 1), -1);
    await db.query(`INSERT INTO accounting_periods(period, status, fiscal_year, period_no, start_date, end_date, is_adjustment) VALUES ($1,'open',$2,$3,$4,$5,false)
      ON CONFLICT (period) DO UPDATE SET fiscal_year = EXCLUDED.fiscal_year, period_no = EXCLUDED.period_no, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, updated_at = now()`,
    [ps.slice(0, 7), code, i + 1, ps, pe]);
  }
  await db.query(`INSERT INTO accounting_periods(period, status, fiscal_year, period_no, start_date, end_date, is_adjustment) VALUES ($1,'open',$2,13,$3,$3,true)
    ON CONFLICT (period) DO NOTHING`, [`${end.slice(0, 4)}-13`, code, end]);
  return (await db.query('SELECT * FROM fiscal_years WHERE code = $1', [code])).rows[0];
}

/**
 * Make sure fiscal years exist from the one containing the earliest journal (or today) up to the one containing
 * `upTo` (default today). Returns the fiscal years in date order.
 */
export async function ensureCalendar(db, upTo = null) {
  const target = iso(upTo || (await today()));
  let years = (await db.query('SELECT * FROM fiscal_years ORDER BY start_date')).rows;
  const first = (await db.query('SELECT min(jv_date) AS d FROM journal_vouchers')).rows[0].d;
  const earliest = first && iso(first) < target ? iso(first) : target;
  if (!years.length) {
    await createFiscalYear(db, await fiscalStartFor(earliest));
    years = (await db.query('SELECT * FROM fiscal_years ORDER BY start_date')).rows;
  }
  // earlier years (journals dated before the first fiscal year), unless a year has already been closed
  while (iso(years[0].start_date) > earliest && !years.some((y) => y.status === 'closed')) {
    const start = addMonths(years[0].start_date, -12);
    await createFiscalYear(db, start);
    years = (await db.query('SELECT * FROM fiscal_years ORDER BY start_date')).rows;
  }
  while (iso(years[years.length - 1].end_date) < target) {
    await createFiscalYear(db, addDays(iso(years[years.length - 1].end_date), 1));
    years = (await db.query('SELECT * FROM fiscal_years ORDER BY start_date')).rows;
  }
  return years;
}

export async function getFiscalYear(db, code) {
  const f = (await db.query('SELECT * FROM fiscal_years WHERE code = $1', [code])).rows[0];
  if (!f) throw notFound(`Fiscal year ${code} not found`);
  return f;
}
export async function periodsOf(db, fiscalYear) {
  return (await db.query('SELECT * FROM accounting_periods WHERE fiscal_year = $1 ORDER BY period_no', [fiscalYear])).rows;
}
export async function getPeriod(db, period, { lock = false } = {}) {
  const p = (await db.query(`SELECT * FROM accounting_periods WHERE period = $1${lock ? ' FOR UPDATE' : ''}`, [period])).rows[0];
  if (!p) throw notFound(`Accounting period ${period} not found`);
  return p;
}

/** Create the next fiscal year after the last one (or the one starting on `startDate`). */
export async function createNextFiscalYear(db, user, startDate = null) {
  await ensureCalendar(db);
  if (startDate) return createFiscalYear(db, iso(startDate), user);
  const last = (await db.query('SELECT * FROM fiscal_years ORDER BY start_date DESC LIMIT 1')).rows[0];
  return createFiscalYear(db, addDays(iso(last.end_date), 1), user);
}

export async function recordStatus(db, p, to, { remarks = null, source = 'manual', referenceId = null, user = null, reasonCode = null } = {}) {
  await db.query(`INSERT INTO period_status_history(period, fiscal_year, from_status, to_status, remarks, source, reference_id, changed_by, reason_code)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [p.period, p.fiscal_year, p.status, to, remarks, source, referenceId, user?.id ?? null, reasonCode]);
}

/** Write a new status on a period (no rule checks; callers check) and record it in the history. */
export async function applyStatus(db, p, to, { remarks = null, source = 'manual', referenceId = null, user = null, reasonCode = null } = {}) {
  if (!PERIOD_STATUSES.includes(to)) throw badRequest(`Unknown period status ${to}`);
  if (p.status === to) return p;
  const uid = user?.id ?? null;
  const sets = { soft_closed: 'soft_closed_by = $3, soft_closed_at = now()', closed: 'closed_by = $3, closed_at = now()', open: 'reopened_by = $3, reopened_at = now()', locked: 'locked_at = now(), closed_by = COALESCE(closed_by, $3), closed_at = COALESCE(closed_at, now())' }[to];
  const row = (await db.query(`UPDATE accounting_periods SET status = $2, ${sets}, remarks = COALESCE($4, remarks), updated_at = now() WHERE period = $1 RETURNING *`,
    [p.period, to, uid, remarks])).rows[0];
  await recordStatus(db, p, to, { remarks, source, referenceId, user, reasonCode });
  return row;
}

const RANK = { open: 0, soft_closed: 1, closed: 2 };
/** Reason context of a manual status change: period_reopen for a move back towards open, period_close otherwise. */
export const reasonContextOf = (from, to) => (RANK[to] < RANK[from] ? 'period_reopen' : 'period_close');

/**
 * Why a period cannot move to `to` by hand (Period Management), as { status: 403 | 409, code, message }, or null when it
 * can. The blocking checks of a close are not part of it (they are reported one by one).
 */
export async function transitionProblem(db, p, to, user) {
  const fail = (status, code, message) => ({ status, code, message });
  if (p.status === 'locked') return fail(409, 'locked', `Period ${p.period} is locked: fiscal year ${p.fiscal_year} is closed. Reverse the year-end close to reopen it`);
  if (p.status === to) return fail(409, 'unchanged', `Period ${p.period} is already ${to.replace('_', '-')}`);
  const fy = p.fiscal_year ? await getFiscalYear(db, p.fiscal_year) : null;
  if (fy?.status === 'closed') return fail(409, 'year-closed', `Fiscal year ${fy.code} is closed`);
  // a close is the checker's: the maker submits the month-end close for approval instead
  if (to === 'closed' && !hasPermission(user, APPROVE)) {
    return fail(403, 'approval', `Closing a period requires permission ${APPROVE}; submit the month-end close of ${p.period} for approval`);
  }
  if (RANK[to] < RANK[p.status]) {
    if (!hasPermission(user, APPROVE)) return fail(403, 'permission', `Reopening a period requires permission ${APPROVE}`);
    if (to === 'open' && isAdjustmentPeriod(p.period) && !(await getSetting('accounting.adjustment_period_enabled', true))) {
      return fail(409, 'adjustment-disabled', 'The adjustment period is disabled (accounting.adjustment_period_enabled)');
    }
    const closedYe = (await db.query('SELECT run_number FROM year_end_runs WHERE fiscal_year = $1 AND status = \'closed\'', [p.fiscal_year])).rows[0];
    if (closedYe) return fail(409, 'year-end-closed', `Fiscal year ${p.fiscal_year} was closed by ${closedYe.run_number}; reverse it first`);
  }
  return null;
}

/**
 * Status change requested from Period Management. Every change needs a reason of the Reason Codes master (context
 * period_close to soft-close or close, period_reopen to reopen; the note when the reason asks for one). Closing (soft
 * or hard) runs the blocking month-end checks (`runBlockingChecks(db, period, to)` supplied by the caller; a close also needs
 * the blocking manual items signed off); closing and reopening need approve:period-end; a locked period (closed fiscal year) cannot be reopened here.
 */
export async function changePeriodStatus(db, period, to, { reasonCode, note, user, runBlockingChecks }) {
  const p = await getPeriod(db, period, { lock: true });
  if (!['open', 'soft_closed', 'closed'].includes(to)) throw badRequest('status must be open, soft_closed or closed');
  const problem = await transitionProblem(db, p, to, user);
  if (problem) throw (problem.status === 403 ? forbidden : conflict)(problem.message);
  const context = reasonContextOf(p.status, to);
  const reason = await requiredReason(db, context, { reasonCode, note });
  if (context === 'period_close' && runBlockingChecks) {
    const failed = await runBlockingChecks(db, p, to);
    if (failed.length) throw conflict(`Period ${period} cannot be ${to.replace('_', '-')}: ${failed.map((f) => f.message).join('; ')}`);
  }
  const row = await applyStatus(db, p, to, { remarks: reason.text, source: 'manual', user, reasonCode: reason.code });
  return { row, reason };
}
