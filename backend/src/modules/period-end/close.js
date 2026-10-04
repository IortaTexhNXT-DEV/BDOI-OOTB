/**
 * Month-End Close runs (document number period_close, prefix MEC). One active run per period:
 *   create -> execute (steps a-e; rerunnable) -> sign manual checklist items -> submit (soft-close or close)
 *   -> approve by a second user when accounting.period_close_requires_approval (maker-checker) -> period closed.
 * Steps: (a) accrual templates for the period, auto-reversed on day 1 of the next period; (b) recurring journals due
 * up to the period end (idempotent per template and date); (c) unearned commission deferral; (d) FX revaluation;
 * (e) the checklist. A rerun first neutralises the run's own previous accrual / deferral / FX journals.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { APPROVE, mayPostSoftClosed } from './posting.js';
import { applyStatus, ensureCalendar, getPeriod, iso, periodRow } from './fiscal.js';
import { bounds, checklistItems, runChecks } from './checks.js';
import { generateDue, reverseDue, undoEntry } from './journals.js';
import { deferCommission, revalueFx } from './steps.js';

// depreciation: the monthly fixed asset depreciation (modules/fixed-assets), idempotent per asset and period
export const STEPS = ['accruals', 'recurring', 'deferral', 'fx', 'depreciation', 'checks'];
const ENTRY_STEP = { accruals: 'accrual', deferral: 'deferral', fx: 'fx' };
const ACTIVE = ['draft', 'in-progress', 'blocked', 'ready', 'pending-approval', 'soft-closed'];

const runRow = (r, users = new Map()) => r && ({
  id: r.id, runNumber: r.run_number, period: r.period, fiscalYear: r.fiscal_year, status: r.status, targetStatus: r.target_status, steps: r.steps,
  executionCount: r.execution_count, preparedBy: r.prepared_by, preparedByName: users.get(r.prepared_by) || null, preparedAt: r.prepared_at,
  submittedBy: r.submitted_by, submittedByName: users.get(r.submitted_by) || null, submittedAt: r.submitted_at,
  approvedBy: r.approved_by, approvedByName: users.get(r.approved_by) || null, approvedAt: r.approved_at,
  rejectedBy: r.rejected_by, rejectedAt: r.rejected_at, rejectionReason: r.rejection_reason, remarks: r.remarks, createdAt: r.created_at, updatedAt: r.updated_at,
});
const checkRow = (c, users = new Map()) => ({
  code: c.code, label: c.label, itemType: c.item_type, severity: c.severity, sortOrder: c.sort_order, status: c.status, count: c.item_count,
  amount: c.amount === null ? null : Number(c.amount), message: c.message, detail: c.detail || [], checkedAt: c.checked_at,
  signedBy: c.signed_by, signedByName: users.get(c.signed_by) || null, signedAt: c.signed_at, remarks: c.remarks,
});

async function userNames(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  return new Map((await db.query('SELECT id, COALESCE(display_name, username) AS n FROM users WHERE id = ANY($1)', [list])).rows.map((u) => [u.id, u.n]));
}

async function lockRun(db, id) {
  const r = (await db.query('SELECT * FROM period_close_runs WHERE id = $1 OR run_number = $1 FOR UPDATE', [id])).rows[0];
  if (!r) throw notFound('Month-end close run not found');
  return r;
}

export async function listRuns(db, q = {}) {
  const rows = (await db.query(`SELECT r.*, p.status AS period_status,
      (SELECT count(*)::int FROM period_close_run_checks c WHERE c.run_id = r.id AND c.status = 'failed') AS failed,
      (SELECT count(*)::int FROM period_close_run_checks c WHERE c.run_id = r.id AND c.status = 'warning') AS warnings,
      (SELECT count(*)::int FROM period_close_entries e WHERE e.run_id = r.id AND e.status = 'active') AS journals
    FROM period_close_runs r JOIN accounting_periods p ON p.period = r.period
    WHERE ($1::text IS NULL OR r.period = $1) AND ($2::text IS NULL OR r.status = $2) AND ($3::text IS NULL OR r.fiscal_year = $3)
    ORDER BY r.period DESC, r.created_at DESC LIMIT 200`, [q.period || null, q.status || null, q.fiscalYear || null])).rows;
  const users = await userNames(db, rows.flatMap((r) => [r.prepared_by, r.submitted_by, r.approved_by]));
  return rows.map((r) => ({ ...runRow(r, users), periodStatus: r.period_status, failedChecks: r.failed, warnings: r.warnings, journalCount: r.journals }));
}

export async function createRun(db, period, user, remarks = null) {
  await ensureCalendar(db);
  const p = await getPeriod(db, period);
  if (p.is_adjustment) throw badRequest('The adjustment period is closed by the year-end close, not by a month-end run');
  if (['closed', 'locked'].includes(p.status)) throw conflict(`Period ${period} is already ${p.status}`);
  const active = (await db.query('SELECT run_number FROM period_close_runs WHERE period = $1 AND status = ANY($2)', [period, ACTIVE])).rows[0];
  if (active) throw conflict(`Period ${period} already has an open month-end close run (${active.run_number})`);
  const number = await nextDocumentNumber('period_close');
  const steps = Object.fromEntries(STEPS.map((s) => [s, { status: 'pending' }]));
  const run = (await db.query(`INSERT INTO period_close_runs(run_number, period, fiscal_year, status, steps, remarks, created_by) VALUES ($1,$2,$3,'draft',$4,$5,$6) RETURNING *`,
    [number, period, p.fiscal_year, JSON.stringify(steps), remarks, user?.id ?? null])).rows[0];
  for (const it of await checklistItems(db)) {
    await db.query(`INSERT INTO period_close_run_checks(run_id, code, label, item_type, severity, sort_order, status) VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [run.id, it.code, it.label, it.item_type, it.severity, it.sort_order]);
  }
  return run;
}

export async function getRun(db, id) {
  const r = (await db.query('SELECT * FROM period_close_runs WHERE id = $1 OR run_number = $1', [id])).rows[0];
  if (!r) throw notFound('Month-end close run not found');
  const checks = (await db.query('SELECT * FROM period_close_run_checks WHERE run_id = $1 ORDER BY sort_order, code', [r.id])).rows;
  const entries = (await db.query(`SELECT e.*, j.jv_number, j.jv_date, j.status AS jv_status, j.total_debit, j.description, rj.jv_number AS reversal_number, rj.jv_date AS reversal_date
      FROM period_close_entries e JOIN journal_vouchers j ON j.id = e.jv_id LEFT JOIN journal_vouchers rj ON rj.id = e.reversal_jv_id
     WHERE e.run_id = $1 ORDER BY e.id`, [r.id])).rows;
  const recurring = (await db.query(`SELECT x.*, j.jv_number, j.status AS jv_status, j.total_debit, t.code, t.name FROM recurring_journal_runs x
      JOIN recurring_journals t ON t.id = x.recurring_id LEFT JOIN journal_vouchers j ON j.id = x.jv_id WHERE x.close_run_id = $1 AND t.kind = 'recurring' ORDER BY x.id`, [r.id])).rows;
  const undoIds = entries.flatMap((e) => e.undo_jv_ids || []);
  const undo = new Map((await db.query('SELECT id, jv_number FROM journal_vouchers WHERE id = ANY($1)', [undoIds])).rows.map((j) => [j.id, j.jv_number]));
  const period = (await db.query('SELECT * FROM accounting_periods WHERE period = $1', [r.period])).rows[0];
  const history = (await db.query('SELECT * FROM period_status_history WHERE period = $1 ORDER BY changed_at DESC LIMIT 50', [r.period])).rows;
  const users = await userNames(db, [r.prepared_by, r.submitted_by, r.approved_by, r.rejected_by, ...checks.map((c) => c.signed_by), ...history.map((h) => h.changed_by)]);
  return {
    ...runRow(r, users), period: r.period, periodInfo: periodRow(period),
    checks: checks.map((c) => checkRow(c, users)),
    journals: [
      ...entries.map((e) => ({ entryId: e.id, step: e.step, journalId: e.jv_id, journalNumber: e.jv_number, date: iso(e.jv_date), journalStatus: e.jv_status,
        amount: Number(e.total_debit), description: e.description, autoReverseOn: e.auto_reverse_on ? iso(e.auto_reverse_on) : null, reversalId: e.reversal_jv_id,
        reversalNumber: e.reversal_number, reversalDate: e.reversal_date ? iso(e.reversal_date) : null, status: e.status, error: e.error,
        undoJournals: (e.undo_jv_ids || []).map((id) => ({ journalId: id, journalNumber: undo.get(id) })) })),
      ...recurring.map((x) => ({ entryId: `rj-${x.id}`, step: 'recurring', journalId: x.jv_id, journalNumber: x.jv_number, date: iso(x.occurrence_date), journalStatus: x.jv_status,
        amount: Number(x.total_debit || 0), description: `${x.code} ${x.name}`, status: x.status === 'undone' ? 'undone' : 'active' })),
    ],
    history: history.map((h) => ({ from: h.from_status, to: h.to_status, remarks: h.remarks, source: h.source, changedBy: users.get(h.changed_by) || h.changed_by, changedAt: h.changed_at })),
  };
}

/** Status of a run from its checks: blocked (blocking auto check failed), ready (all blocking items passed / signed), in-progress. */
async function statusFromChecks(db, runId) {
  const rows = (await db.query('SELECT * FROM period_close_run_checks WHERE run_id = $1', [runId])).rows;
  if (rows.some((c) => c.severity === 'blocking' && c.item_type === 'auto' && c.status === 'failed')) return 'blocked';
  if (rows.some((c) => c.severity === 'blocking' && (c.item_type === 'manual' ? c.status !== 'signed-off' : ['pending', 'failed'].includes(c.status)))) return 'in-progress';
  return 'ready';
}

async function refreshChecks(db, run) {
  const p = await getPeriod(db, run.period);
  const items = (await db.query('SELECT * FROM period_close_run_checks WHERE run_id = $1 AND item_type = \'auto\'', [run.id])).rows
    .map((c) => ({ code: c.code, label: c.label, item_type: 'auto', severity: c.severity, sort_order: c.sort_order }));
  const results = await runChecks(db, p, items);
  for (const r of results) {
    await db.query(`UPDATE period_close_run_checks SET status = $3, item_count = $4, amount = $5, message = $6, detail = $7, checked_at = now() WHERE run_id = $1 AND code = $2`,
      [run.id, r.code, r.status, r.count ?? null, r.amount ?? null, r.message || null, JSON.stringify(r.detail || [])]);
  }
  return results;
}

async function guardPeriodForPosting(db, run, user) {
  const p = await getPeriod(db, run.period);
  if (['closed', 'locked'].includes(p.status)) throw conflict(`Period ${run.period} is ${p.status}; reopen it before running the month-end steps again`);
  if (p.status === 'soft_closed' && !mayPostSoftClosed(user)) throw forbidden(`Period ${run.period} is soft-closed; only finance managers (${APPROVE}) can run the steps`);
  return p;
}

/** Execute the run's steps (all, or those listed). Safe to repeat. */
export async function executeRun(db, id, user, { steps = STEPS } = {}) {
  const run = await lockRun(db, id);
  if (['pending-approval', 'closed', 'cancelled'].includes(run.status)) throw conflict(`Run ${run.run_number} is ${run.status}`);
  const p = await guardPeriodForPosting(db, run, user);
  const { start, end } = bounds(p);
  const now = await today();
  const wanted = STEPS.filter((s) => steps.includes(s));
  const state = { ...run.steps };
  const by = user?.id ?? null;
  // reversals of earlier periods that are due (e.g. last month's accruals) come first
  await reverseDue(db, { asOf: now, user });
  for (const step of wanted) {
    if (step === 'checks') continue;
    await db.query('SAVEPOINT step');
    try {
      const undone = [];
      if (ENTRY_STEP[step]) {
        const previous = (await db.query('SELECT * FROM period_close_entries WHERE run_id = $1 AND step = $2 AND status = \'active\' ORDER BY id DESC', [run.id, ENTRY_STEP[step]])).rows;
        for (const e of previous) undone.push(...(await undoEntry(db, e, user)));
      }
      let r;
      if (step === 'accruals' || step === 'recurring') {
        const g = await generateDue(db, { kind: step === 'accruals' ? 'accrual' : 'recurring', asOf: end, from: step === 'accruals' ? start : null, user, closeRunId: run.id });
        const existing = step === 'recurring' ? (await db.query(`SELECT count(*)::int AS n FROM recurring_journal_runs x JOIN recurring_journals t ON t.id = x.recurring_id
          WHERE t.kind = 'recurring' AND x.period = $1 AND x.status IN ('posted','pending')`, [run.period])).rows[0].n : null;
        r = { status: g.errors.length ? 'warning' : 'done', journals: g.created.map((c) => c.jvId),
          message: [`${g.created.length} journal(s) generated`, existing !== null ? `${existing} recurring journal(s) in the period` : null, ...g.errors.map((e) => `${e.code} ${e.occurrence}: ${e.error}`)].filter(Boolean).join('; '),
          amount: null, detail: g.created };
      } else if (step === 'deferral') {
        r = await deferCommission(db, p, { user, runId: run.id });
      } else if (step === 'fx') {
        r = await revalueFx(db, p, { user, runId: run.id });
      } else if (step === 'depreciation') {
        const { depreciationStep } = await import('../fixed-assets/service.js');
        r = await depreciationStep(db, p, { user, runId: run.id });
      }
      await db.query('RELEASE SAVEPOINT step');
      state[step] = { ...r, undone, at: new Date().toISOString(), by };
    } catch (e) {
      await db.query('ROLLBACK TO SAVEPOINT step');
      state[step] = { status: 'failed', message: e.message, at: new Date().toISOString(), by };
    }
  }
  // auto-reversals of this run whose date has come (a past period is closed after the 1st of the next month)
  const rev = await reverseDue(db, { asOf: now, user, runId: run.id });
  if (rev.errors.length) {
    for (const s of ['accruals', 'deferral', 'fx']) {
      if (state[s] && state[s].status === 'done') state[s] = { ...state[s], reversalWarning: rev.errors.map((e) => `${e.jvNumber}: ${e.error}`).join('; ') };
    }
  }
  if (wanted.includes('checks')) {
    const results = await refreshChecks(db, run);
    const failed = results.filter((x) => x.status === 'failed').length;
    const warnings = results.filter((x) => x.status === 'warning').length;
    state.checks = { status: failed ? 'failed' : warnings ? 'warning' : 'done', message: `${failed} blocking failure(s), ${warnings} warning(s)`, at: new Date().toISOString(), by };
  }
  const status = run.status === 'soft-closed' ? 'soft-closed' : await statusFromChecks(db, run.id);
  await db.query(`UPDATE period_close_runs SET steps = $2, status = $3, prepared_by = $4, prepared_at = now(), execution_count = execution_count + 1, updated_at = now() WHERE id = $1`,
    [run.id, JSON.stringify(state), status, by]);
  return getRun(db, run.id);
}

export async function recheck(db, id) {
  const run = await lockRun(db, id);
  if (['closed', 'cancelled'].includes(run.status)) throw conflict(`Run ${run.run_number} is ${run.status}`);
  await refreshChecks(db, run);
  if (!['pending-approval', 'soft-closed'].includes(run.status)) {
    await db.query('UPDATE period_close_runs SET status = $2, updated_at = now() WHERE id = $1', [run.id, await statusFromChecks(db, run.id)]);
  }
  return getRun(db, run.id);
}

export async function signCheck(db, id, code, user, { remarks = null, signed = true } = {}) {
  const run = await lockRun(db, id);
  if (['closed', 'cancelled', 'pending-approval'].includes(run.status)) throw conflict(`Run ${run.run_number} is ${run.status}`);
  const c = (await db.query('SELECT * FROM period_close_run_checks WHERE run_id = $1 AND code = $2', [run.id, code])).rows[0];
  if (!c) throw notFound(`Checklist item ${code} not found on this run`);
  if (c.item_type !== 'manual') throw badRequest('Automatic checks cannot be signed off; fix the cause and run the checks again');
  await db.query(`UPDATE period_close_run_checks SET status = $3, signed_by = $4, signed_at = CASE WHEN $5 THEN now() END, remarks = $6, checked_at = now() WHERE run_id = $1 AND code = $2`,
    [run.id, code, signed ? 'signed-off' : 'pending', signed ? user.id : null, signed, remarks]);
  if (run.status !== 'soft-closed') await db.query('UPDATE period_close_runs SET status = $2, updated_at = now() WHERE id = $1', [run.id, await statusFromChecks(db, run.id)]);
  return getRun(db, run.id);
}

async function assertClosable(db, run) {
  await refreshChecks(db, run);
  const rows = (await db.query('SELECT * FROM period_close_run_checks WHERE run_id = $1 ORDER BY sort_order', [run.id])).rows;
  const failed = rows.filter((c) => c.severity === 'blocking' && c.item_type === 'auto' && c.status === 'failed');
  const unsigned = rows.filter((c) => c.severity === 'blocking' && c.item_type === 'manual' && c.status !== 'signed-off');
  if (failed.length || unsigned.length) {
    const msg = [...failed.map((c) => `${c.label}: ${c.message}`), ...unsigned.map((c) => `${c.label}: not signed off`)].join('; ');
    throw conflict(`Period ${run.period} cannot be closed – ${msg}`);
  }
}

async function finalize(db, run, user, target, remarks) {
  const p = await getPeriod(db, run.period, { lock: true });
  if (p.status === 'locked' || p.status === 'closed') throw conflict(`Period ${run.period} is already ${p.status}`);
  if (p.status === target) throw conflict(`Period ${run.period} is already ${target.replace('_', '-')}`);
  await applyStatus(db, p, target, { remarks: remarks || `Month-end close ${run.run_number}`, source: 'close-run', referenceId: run.id, user });
  await db.query(`UPDATE period_close_runs SET status = $2, target_status = $3, approved_by = $4, approved_at = now(), updated_at = now() WHERE id = $1`,
    [run.id, target === 'closed' ? 'closed' : 'soft-closed', target, user.id]);
}

/** Submit for approval (or close directly when approval is not required). target: soft_closed | closed. */
export async function submitRun(db, id, user, { target = 'closed', remarks = null } = {}) {
  if (!['soft_closed', 'closed'].includes(target)) throw badRequest('target must be soft_closed or closed');
  const run = await lockRun(db, id);
  if (!['in-progress', 'blocked', 'ready', 'soft-closed', 'draft'].includes(run.status)) throw conflict(`Run ${run.run_number} is ${run.status}`);
  if (run.status === 'draft' || !run.execution_count) throw conflict('Execute the month-end steps before submitting the close');
  if (run.status === 'soft-closed' && target === 'soft_closed') throw conflict(`Period ${run.period} is already soft-closed`);
  await assertClosable(db, run);
  if (await getSetting('accounting.period_close_requires_approval', true)) {
    await db.query(`UPDATE period_close_runs SET status = 'pending-approval', target_status = $2, submitted_by = $3, submitted_at = now(), remarks = COALESCE($4, remarks),
      rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL, updated_at = now() WHERE id = $1`, [run.id, target, user.id, remarks]);
  } else {
    await db.query('UPDATE period_close_runs SET submitted_by = $2, submitted_at = now(), remarks = COALESCE($3, remarks) WHERE id = $1', [run.id, user.id, remarks]);
    await finalize(db, run, user, target, remarks);
  }
  return getRun(db, run.id);
}

export async function approveRun(db, id, user, { remarks = null } = {}) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Approving a month-end close requires permission ${APPROVE}`);
  const run = await lockRun(db, id);
  if (run.status !== 'pending-approval') throw conflict(`Run ${run.run_number} is not awaiting approval (${run.status})`);
  if ((await getSetting('finance.maker_checker_enabled', true)) && [run.submitted_by, run.prepared_by].includes(user.id)) {
    throw forbidden('Maker-checker: the close must be approved by a different user than the one who prepared or submitted it');
  }
  await assertClosable(db, run);
  await finalize(db, run, user, run.target_status || 'closed', remarks);
  return getRun(db, run.id);
}

export async function rejectRun(db, id, user, { reason }) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Rejecting a month-end close requires permission ${APPROVE}`);
  if (!String(reason || '').trim()) throw badRequest('A reason is required');
  const run = await lockRun(db, id);
  if (run.status !== 'pending-approval') throw conflict(`Run ${run.run_number} is not awaiting approval (${run.status})`);
  await db.query(`UPDATE period_close_runs SET status = 'in-progress', rejected_by = $2, rejected_at = now(), rejection_reason = $3, updated_at = now() WHERE id = $1`, [run.id, user.id, reason]);
  await db.query('UPDATE period_close_runs SET status = $2 WHERE id = $1', [run.id, await statusFromChecks(db, run.id)]);
  return getRun(db, run.id);
}

/** Cancel an unfinished run; its accrual / deferral / FX journals are neutralised. */
export async function cancelRun(db, id, user, { reason = null } = {}) {
  const run = await lockRun(db, id);
  if (['closed', 'soft-closed', 'cancelled'].includes(run.status)) throw conflict(`Run ${run.run_number} is ${run.status}`);
  const entries = (await db.query('SELECT * FROM period_close_entries WHERE run_id = $1 AND status = \'active\' ORDER BY id DESC', [run.id])).rows;
  if (entries.length) await guardPeriodForPosting(db, run, user);
  for (const e of entries) await undoEntry(db, e, user);
  await db.query('UPDATE period_close_runs SET status = \'cancelled\', remarks = COALESCE($2, remarks), updated_at = now() WHERE id = $1', [run.id, reason]);
  return getRun(db, run.id);
}
