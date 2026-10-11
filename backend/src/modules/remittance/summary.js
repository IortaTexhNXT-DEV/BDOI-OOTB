/**
 * GET /remittance/summary: what Accounts > Remittance holds for the signed-in user, computed on the server (the screens
 * no longer count over the first 500 rows):
 *   counts   per menu entry: Remittances (my work), Approvals (awaiting my decision), Insurer payments (to pay, for a
 *            user with write:disbursements), Reconciliation (insurer statements I must act on), Exceptions (assigned to
 *            me), Insurer billing (my draft debit notes and the overdue ones), Setup (0 until rule changes need
 *            approval); `overdue` marks the entries with something past due
 *   runStrip the last run, the next run of the active schedules and the automation state
 *   landing  where /finance/remittance opens: Approvals when something awaits the user's decision, Exceptions when
 *            some are assigned to the user, else Remittances > My work
 * Each count is the total of the list it opens, read the same way (register, approvals inbox, payments, exceptions
 * and debit notes with the same filters).
 */
import { one } from '../../db/pool.js';
import { hasPermission } from '../../lib/auth.js';
import { today as businessToday } from '../../lib/dates.js';
import { registerList } from './register.js';
import { approvalInbox } from './approvals.js';
import { paymentList } from './payments.js';
import { listItems, assigneeNames } from './items.js';
import { listDebitNotes } from './directbill.js';
import { latestRun, listSchedules } from './runs.js';

const FIRST = { limit: 1, offset: 0 };
export const LANDINGS = {
  approvals: '/finance/remittance/approvals',
  exceptions: '/finance/remittance/exceptions',
  remittances: '/finance/remittance/remittances?segment=my-work',
};

/** Insurer statements waiting on the user: their drafts, and the submitted ones they may approve (not their own). */
async function statementsToAct(user) {
  const approver = hasPermission(user, 'approve:insurer-reconciliation');
  const r = await one(`SELECT count(*)::int AS n FROM insurer_statements s
    WHERE (s.status = 'draft' AND s.created_by = $1) OR ($2::boolean AND s.status = 'submitted' AND s.created_by IS DISTINCT FROM $1 AND s.submitted_by IS DISTINCT FROM $1)`,
  [user.id, approver]);
  return r.n;
}

/** The run strip of Remittances: last run, next run of the active schedules, automation on or off. */
async function runStrip(user) {
  const { automation, schedules } = await listSchedules(user);
  const active = schedules.filter((s) => s.isActive && s.nextRun).sort((a, b) => String(a.nextRun).localeCompare(String(b.nextRun)));
  const last = await latestRun();
  return {
    lastRun: last ? { id: last.id, scheduleCode: last.scheduleCode, at: last.startedAt, text: last.startedText, result: last.result.code, resultLabel: last.result.label,
      counts: last.counts, message: last.message, failed: last.result.code === 'failed' } : null,
    nextRun: active.length ? { scheduleCode: active[0].code, date: active[0].nextRun, text: active[0].nextRunText } : null,
    automation: { on: automation.jobEnabled, label: automation.jobEnabled ? 'Automation On' : 'Automation Off', checkedDaily: automation.checkedDaily, timeZone: automation.timeZone },
  };
}

export async function remittanceSummary(user) {
  const remittances = await registerList({ segment: 'my-work' }, user, FIRST);
  const approvals = await approvalInbox({ view: 'mine' }, user, FIRST);
  const payments = hasPermission(user, 'write:disbursements') ? await paymentList({ segment: 'to-pay' }, user, FIRST) : null;
  const exceptions = await listItems('exception', { status: 'Open,In Progress,Escalated', assignedToAny: await assigneeNames(user) }, FIRST);
  const billing = await listDebitNotes({ attention: 'mine', userId: user.id }, FIRST);
  const overdueNotes = (await one("SELECT count(*)::int AS n FROM commission_debit_notes WHERE status IN ('open', 'partial') AND due_date < $1::date", [await businessToday()])).n;
  const counts = {
    remittances: remittances.total, approvals: approvals.total, payments: payments ? payments.total : null, reconciliation: await statementsToAct(user),
    exceptions: exceptions.total, billing: billing.total, setup: 0,
  };
  const overdue = { remittances: remittances.kpis.overdue.count > 0, approvals: (approvals.kpis?.pastSla?.count || 0) > 0, payments: (payments?.kpis.failed.count || 0) > 0,
    reconciliation: false, exceptions: false, billing: overdueNotes > 0, setup: false };
  const landing = counts.approvals > 0 ? 'approvals' : counts.exceptions > 0 ? 'exceptions' : 'remittances';
  return { counts, overdue, runStrip: await runStrip(user), landing: { code: landing, link: LANDINGS[landing] } };
}
