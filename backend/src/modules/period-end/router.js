/**
 * Period-end processing: fiscal calendar and period management, month-end close runs, recurring / accrual journals,
 * the close checklist, year-end close, financial statements and BIR tax (tax codes, Form 2307).
 * Permissions: read:period-end (or read:journal-vouchers) to view; write:period-end to prepare; approve:period-end
 * (finance manager) to approve closes, reopen periods, post into soft-closed periods and reverse a year-end close.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { APPROVE } from './posting.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import * as fiscal from './fiscal.js';
import * as close from './close.js';
import * as ye from './yearend.js';
import * as tax from './tax.js';
import { AUTO_CHECKS, blockingFailures, checklistItems, runChecks } from './checks.js';
import { generateDue, rjRow, saveRecurring } from './journals.js';
import { importOpeningBalances, listOpeningBalances, OPENING_BALANCE_COLUMNS } from './opening.js';
import { mapColumns, parseUploadedRows, uploadFile } from '../documents/tabular.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { buildPdf, printContext, sendPdf } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { companyName } from '../../lib/letterhead.js';
import * as st from './statements.js';

const { router, define } = moduleRouter('Period End', '/period-end');
const read = [requireAuth, requirePermission('read:period-end', 'read:journal-vouchers')];
const write = [requireAuth, requirePermission('write:period-end')];
const approve = [requireAuth, requirePermission(APPROVE)];
const readTax = [requireAuth, requirePermission('read:period-end', 'read:masters')];
const writeTax = [requireAuth, requirePermission('write:period-end', 'write:masters')];
const S = 'Accounts > Period End';
const tx = (fn) => withTransaction(fn);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

// ---------- go-live opening balances ----------
define({
  method: 'GET', path: '/opening-balances', summary: 'Opening balances of a fiscal year (go-live load or carried forward by the year-end close) with totals',
  screen: `${S} > Period Management > Opening balances`, middleware: read, query: { fiscalYear: 'FY2026' },
  response: { success: true, data: { fiscalYear: 'FY2026', source: 'go-live', goLiveDate: '2026-10-01', totalDebit: 2102400, totalCredit: 2102400, lines: [{ accountCode: '1102001', accountName: 'Cash in Bank – Operating Account', debit: 1250000, credit: 0 }] } },
  handler: async (req, res) => ok(res, await listOpeningBalances(pool, { fiscalYear: req.query.fiscalYear || null })),
});
define({
  method: 'GET', path: '/opening-balances/template', summary: 'Opening balances upload template (XLSX)', screen: `${S} > Period Management > Import opening balances`,
  middleware: read, response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'opening-balances'),
});
define({
  method: 'POST', path: '/opening-balances/import', summary: 'Go-live: load the old system\'s trial balance (multipart "file" + goLiveDate) into the opening balances of the fiscal year of the go-live date; all or nothing, debits must equal credits; rows with no debit or credit (zero balance) are ignored; loading the same date again replaces it',
  screen: `${S} > Period Management > Import opening balances`, middleware: [...write, uploadFile], request: { goLiveDate: '2026-10-01', file: '(multipart) Opening_Balances_Upload_Template.xlsx' },
  response: { success: true, data: { fiscalYear: 'FY2026', goLiveDate: '2026-10-01', asAt: '2026-09-30', accounts: 7, totalDebit: 2102400, totalCredit: 2102400, replaced: 0, ignored: [{ row: 9, accountCode: '1301001' }] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file).map((r) => mapColumns(r, OPENING_BALANCE_COLUMNS));
    const out = await tx((db) => importOpeningBalances(db, rows, { goLiveDate: String(req.body?.goLiveDate || '').slice(0, 10) }));
    await audit(req, { entity: 'opening_balances', entityId: out.fiscalYear, action: 'go-live-import', after: out });
    const zero = out.ignored.length ? `; ${out.ignored.length} row(s) with no debit or credit (zero balance) ignored: ${out.ignored.map((x) => x.accountCode).join(', ')}` : '';
    ok(res, out, `Opening balances of ${out.fiscalYear} loaded: ${out.accounts} accounts, debits = credits = ${out.totalDebit.toFixed(2)}${zero}`);
  },
});

// ---------- fiscal calendar ----------
define({
  method: 'GET', path: '/fiscal-years', summary: 'Fiscal years (generated from the first journal up to today) with period status counts', screen: `${S} > Period Management`, middleware: read,
  response: { success: true, data: [{ code: 'FY2026', startDate: '2026-01-01', endDate: '2026-12-31', status: 'open', periods: { open: 13 } }] },
  handler: async (_req, res) => {
    const years = await tx((db) => fiscal.ensureCalendar(db));
    const counts = (await pool.query('SELECT fiscal_year, status, count(*)::int AS n FROM accounting_periods WHERE fiscal_year IS NOT NULL GROUP BY 1, 2')).rows;
    ok(res, years.slice().reverse().map((f) => ({ ...fiscal.fyRow(f), periods: Object.fromEntries(counts.filter((c) => c.fiscal_year === f.code).map((c) => [c.status, c.n])) })));
  },
});
define({
  method: 'POST', path: '/fiscal-years', summary: 'Create the next fiscal year (or one starting on startDate) with its 12 periods and adjustment period 13', screen: `${S} > Period Management`,
  middleware: [...write, validate(z.object({ startDate: date.optional() }))], request: { startDate: '2027-01-01' }, response: { success: true, data: { code: 'FY2027' } },
  handler: async (req, res) => {
    const f = await tx((db) => fiscal.createNextFiscalYear(db, req.user, req.body.startDate || null));
    await audit(req, { entity: 'fiscal_year', entityId: f.code, action: 'create', after: fiscal.fyRow(f) });
    created(res, fiscal.fyRow(f));
  },
});
define({
  method: 'GET', path: '/fiscal-years/:code', summary: 'A fiscal year with its periods', screen: `${S} > Period Management`, middleware: read,
  response: { success: true, data: { code: 'FY2026', periods: [{ period: '2026-01', periodNo: 1, status: 'closed' }] } },
  handler: async (req, res) => {
    const f = await tx(async (db) => { await fiscal.ensureCalendar(db); return fiscal.getFiscalYear(db, req.params.code); });
    const periods = await fiscal.periodsOf(pool, f.code);
    const runs = (await pool.query('SELECT DISTINCT ON (period) period, run_number, status, id FROM period_close_runs WHERE fiscal_year = $1 ORDER BY period, created_at DESC', [f.code])).rows;
    const runOf = new Map(runs.map((r) => [r.period, r]));
    ok(res, { ...fiscal.fyRow(f), periods: periods.map((p) => ({ ...fiscal.periodRow(p), closeRun: runOf.get(p.period) ? { id: runOf.get(p.period).id, runNumber: runOf.get(p.period).run_number, status: runOf.get(p.period).status } : null })) });
  },
});
define({
  method: 'POST', path: '/periods/:period/status', summary: 'Open, soft-close or close a period (closing runs the blocking checks; reopening needs approve:period-end and remarks; locked periods cannot change)',
  screen: `${S} > Period Management`, middleware: [...write, validate(z.object({ status: z.enum(['open', 'soft_closed', 'closed']), remarks: z.string().max(1000).optional() }))],
  request: { status: 'soft_closed', remarks: 'Pending insurer statements' }, response: { success: true, data: { period: '2026-08', status: 'soft_closed' } },
  handler: async (req, res) => {
    const before = (await pool.query('SELECT * FROM accounting_periods WHERE period = $1', [req.params.period])).rows[0];
    const p = await tx((db) => fiscal.changePeriodStatus(db, req.params.period, req.body.status, { remarks: req.body.remarks, user: req.user, runBlockingChecks: blockingFailures }));
    await audit(req, { entity: 'accounting_period', entityId: req.params.period, action: `status:${req.body.status}`, before: before && fiscal.periodRow(before), after: fiscal.periodRow(p) });
    ok(res, fiscal.periodRow(p), `Period ${req.params.period} is ${req.body.status.replace('_', '-')}`);
  },
});
define({
  method: 'GET', path: '/periods/:period/history', summary: 'Status history of a period (who opened, soft-closed, closed, reopened or locked it and why)', screen: `${S} > Period Management`, middleware: read,
  response: { success: true, data: [{ from: 'open', to: 'closed', remarks: 'August closed', changedBy: 'Finance Manager', changedAt: '2026-09-05T02:00:00Z' }] },
  handler: async (req, res) => {
    const rows = (await pool.query(`SELECT h.*, COALESCE(u.display_name, u.username) AS name FROM period_status_history h LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.period = $1 ORDER BY h.changed_at DESC, h.id DESC`, [req.params.period])).rows;
    ok(res, rows.map((h) => ({ from: h.from_status, to: h.to_status, remarks: h.remarks, source: h.source, referenceId: h.reference_id, changedBy: h.name || (h.changed_by ? h.changed_by : 'system'), changedAt: h.changed_at })));
  },
});
define({
  method: 'GET', path: '/periods/:period/checks', summary: 'Run the month-end checklist for a period without a close run (preview)', screen: `${S} > Period Management`, middleware: read,
  response: { success: true, data: [{ code: 'unposted_journals', status: 'failed', count: 2, message: '2 journal(s) in 2026-08 not posted' }] },
  handler: async (req, res) => {
    const p = await fiscal.getPeriod(pool, req.params.period);
    ok(res, await runChecks(pool, p, await checklistItems(pool)));
  },
});

// ---------- checklist master ----------
const checklistRow = (c) => ({ code: c.code, label: c.label, description: c.description, itemType: c.item_type, severity: c.severity, active: c.active, sortOrder: c.sort_order,
  isSystem: c.is_system, updatedAt: c.updated_at });
define({
  method: 'GET', path: '/checklist', summary: 'Month-end close checklist items (auto checks and manual sign-offs)', screen: 'Master > Finance > Close Checklist', middleware: read,
  response: { success: true, data: [{ code: 'unposted_journals', label: 'No unposted or pending journals in the period', itemType: 'auto', severity: 'blocking', active: true, sortOrder: 10 }] },
  handler: async (_req, res) => ok(res, { items: (await pool.query('SELECT * FROM period_close_checklist ORDER BY sort_order, code')).rows.map(checklistRow), autoChecks: Object.keys(AUTO_CHECKS) }),
});
const checklistSchema = z.object({ code: z.string().regex(/^[a-z0-9_]{2,40}$/).optional(), label: z.string().min(2).max(200).optional(), description: z.string().max(1000).nullable().optional(),
  itemType: z.enum(['auto', 'manual']).optional(), severity: z.enum(['blocking', 'warning']).optional(), active: z.boolean().optional(), sortOrder: z.coerce.number().int().optional() });
define({
  method: 'POST', path: '/checklist', summary: 'Add a checklist item (manual sign-off, or an auto item bound to a built-in check)', screen: 'Master > Finance > Close Checklist',
  middleware: [...write, validate(checklistSchema.required({ code: true, label: true }))], request: { code: 'insurer_statements', label: 'Insurer statements of account reconciled', itemType: 'manual', severity: 'warning', sortOrder: 130 },
  response: { success: true, data: { code: 'insurer_statements' } },
  handler: async (req, res) => {
    const b = req.body;
    if ((b.itemType || 'manual') === 'auto' && !AUTO_CHECKS[b.code]) throw badRequest(`An auto item must use a built-in check: ${Object.keys(AUTO_CHECKS).join(', ')}`);
    const r = (await pool.query(`INSERT INTO period_close_checklist(code, label, description, item_type, severity, active, sort_order, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (code) DO NOTHING RETURNING *`, [b.code, b.label, b.description || null, b.itemType || 'manual', b.severity || 'warning', b.active !== false, b.sortOrder ?? 100, req.user.id])).rows[0];
    if (!r) throw conflict(`Checklist item ${b.code} already exists`);
    await audit(req, { entity: 'period_close_checklist', entityId: r.code, action: 'create', after: r });
    created(res, checklistRow(r));
  },
});
define({
  method: 'PUT', path: '/checklist/:code', summary: 'Change a checklist item (label, severity, active, order)', screen: 'Master > Finance > Close Checklist', middleware: [...write, validate(checklistSchema)],
  request: { severity: 'blocking', active: true }, response: { success: true, data: { code: 'unapplied_receipts', severity: 'blocking' } },
  handler: async (req, res) => {
    const before = (await pool.query('SELECT * FROM period_close_checklist WHERE code = $1', [req.params.code])).rows[0];
    if (!before) throw notFound('Checklist item not found');
    const b = req.body;
    if (b.itemType === 'auto' && !AUTO_CHECKS[before.code]) throw badRequest(`${before.code} is not a built-in check`);
    if (before.is_system && b.itemType === 'manual') throw badRequest('A built-in automatic check cannot become manual');
    const r = (await pool.query(`UPDATE period_close_checklist SET label = COALESCE($2, label), description = COALESCE($3, description), item_type = COALESCE($4, item_type),
      severity = COALESCE($5, severity), active = COALESCE($6, active), sort_order = COALESCE($7, sort_order), updated_by = $8, updated_at = now() WHERE code = $1 RETURNING *`,
    [req.params.code, b.label, b.description, b.itemType, b.severity, b.active, b.sortOrder, req.user.id])).rows[0];
    await audit(req, { entity: 'period_close_checklist', entityId: r.code, action: 'update', before, after: r });
    ok(res, checklistRow(r));
  },
});
define({
  method: 'DELETE', path: '/checklist/:code', summary: 'Delete a checklist item added by users (built-in checks can only be deactivated)', screen: 'Master > Finance > Close Checklist', middleware: write,
  response: { success: true, data: { code: 'insurer_statements' } },
  handler: async (req, res) => {
    const r = (await pool.query('DELETE FROM period_close_checklist WHERE code = $1 AND NOT is_system RETURNING *', [req.params.code])).rows[0];
    if (!r) throw conflict('Checklist item not found or built-in (deactivate it instead)');
    await audit(req, { entity: 'period_close_checklist', entityId: r.code, action: 'delete', before: r });
    ok(res, { code: r.code });
  },
});

// ---------- month-end close runs ----------
const runExample = { id: 'pcr_1', runNumber: 'MEC-2026-00001', period: '2026-08', status: 'ready', steps: { accruals: { status: 'done', journals: ['jv_1'] } } };
define({
  method: 'GET', path: '/close-runs', summary: 'Month-end close runs (filter period, status, fiscalYear)', screen: `${S} > Month-End Close`, middleware: read, query: { fiscalYear: 'FY2026' },
  response: { success: true, data: [runExample] }, handler: async (req, res) => ok(res, await close.listRuns(pool, req.query)),
});
define({
  method: 'POST', path: '/close-runs', summary: 'Start the month-end close of a period (one open run per period; checklist copied to the run)', screen: `${S} > Month-End Close`,
  middleware: [...write, validate(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/), remarks: z.string().max(1000).optional() }))], request: { period: '2026-08' }, response: { success: true, data: runExample },
  handler: async (req, res) => {
    const r = await tx((db) => close.createRun(db, req.body.period, req.user, req.body.remarks));
    await audit(req, { entity: 'period_close_run', entityId: r.id, action: 'create', after: { runNumber: r.run_number, period: r.period } });
    created(res, await close.getRun(pool, r.id));
  },
});
define({
  method: 'GET', path: '/close-runs/:id', summary: 'A month-end close run: steps, checklist results, generated journals, approvals and period history', screen: `${S} > Month-End Close > Run`, middleware: read,
  response: { success: true, data: runExample }, handler: async (req, res) => ok(res, await close.getRun(pool, req.params.id)),
});
// Approval notifications: a close submitted for approval goes to approve:period-end, the decision to the submitter.
async function notifyClose(action, r, req) {
  const base = { document: 'Month-end close', number: r.runNumber, link: `/accounts/period-end/close/${r.id}`, entity: 'period_close_run', entityId: r.id };
  const target = r.targetStatus === 'soft_closed' ? 'soft close' : 'close';
  if (action === 'submit' && r.status === 'pending-approval') {
    await notifyApprovers({ ...base, audience: APPROVE, by: req.user.username, message: `${req.user.username} submitted ${r.runNumber}: ${target} of period ${r.period}` });
  } else if (action === 'approve' || action === 'reject') {
    await notifyDecision({ ...base, userId: r.submittedBy, decidedBy: req.user.id, approved: action === 'approve', by: req.user.username, reason: action === 'reject' ? req.body.reason : null,
      message: action === 'approve' ? `Period ${r.period} ${r.status === 'soft-closed' ? 'soft-closed' : 'closed'}; approved by ${req.user.username}` : null });
  }
}
const runAction = (path, summary, schema, fn, action, mw = write) => define({
  method: 'POST', path, summary, screen: `${S} > Month-End Close > Run`, middleware: [...mw, validate(schema)], request: {}, response: { success: true, data: runExample },
  handler: async (req, res) => {
    const r = await tx((db) => fn(db, req));
    await audit(req, { entity: 'period_close_run', entityId: r.id, action, after: { runNumber: r.runNumber, status: r.status, period: r.period, ...req.body } });
    await notifyClose(action, r, req);
    ok(res, r);
  },
});
runAction('/close-runs/:id/execute', 'Execute the steps (accruals, recurring, deferral, fx, depreciation, checks); a rerun first reverses the run\'s own previous accrual, deferral and FX journals',
  z.object({ steps: z.array(z.enum(close.STEPS)).optional() }), (db, req) => close.executeRun(db, req.params.id, req.user, { steps: req.body.steps || close.STEPS }), 'execute');
runAction('/close-runs/:id/checks', 'Run the automatic checklist items again', z.object({}).passthrough(), (db, req) => close.recheck(db, req.params.id), 'recheck');
runAction('/close-runs/:id/checks/:code/sign', 'Sign off (or withdraw the sign-off of) a manual checklist item', z.object({ remarks: z.string().max(1000).optional(), signed: z.boolean().optional() }),
  (db, req) => close.signCheck(db, req.params.id, req.params.code, req.user, { remarks: req.body.remarks, signed: req.body.signed !== false }), 'sign');
runAction('/close-runs/:id/submit', 'Submit the close (target soft_closed or closed); closes directly when accounting.period_close_requires_approval is false',
  z.object({ target: z.enum(['soft_closed', 'closed']).optional(), remarks: z.string().max(1000).optional() }), (db, req) => close.submitRun(db, req.params.id, req.user, req.body), 'submit');
runAction('/close-runs/:id/approve', 'Approve the close (a different user than the preparer; approve:period-end) and close the period', z.object({ remarks: z.string().max(1000).optional() }),
  (db, req) => close.approveRun(db, req.params.id, req.user, req.body), 'approve', approve);
runAction('/close-runs/:id/reject', 'Return a submitted close to the preparer with a reason', z.object({ reason: z.string().min(1).max(1000) }),
  (db, req) => close.rejectRun(db, req.params.id, req.user, req.body), 'reject', approve);
runAction('/close-runs/:id/cancel', 'Cancel an unfinished run (its accrual, deferral and FX journals are reversed)', z.object({ reason: z.string().max(1000).optional() }),
  (db, req) => close.cancelRun(db, req.params.id, req.user, req.body), 'cancel');

// ---------- recurring and accrual journals ----------
const lineSchema = z.object({ accountCode: z.string().min(1), debit: z.coerce.number().min(0).default(0), credit: z.coerce.number().min(0).default(0), memo: z.string().max(500).nullable().optional() });
const rjSchema = z.object({ name: z.string().min(2).max(200).optional(), description: z.string().max(1000).nullable().optional(), kind: z.enum(['recurring', 'accrual']).optional(),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(), startDate: date.optional(), nextRunDate: date.optional(), endDate: date.nullable().optional(),
  autoPost: z.boolean().optional(), autoReverse: z.boolean().optional(), currency: z.string().max(3).optional(), status: z.enum(['active', 'inactive', 'completed']).optional(),
  lines: z.array(lineSchema).optional() });
const rjExample = { id: 'rj_1', code: 'RJV-2026-00001', name: 'Office rent', kind: 'recurring', frequency: 'monthly', startDate: '2026-01-31', nextRunDate: '2026-09-30', autoPost: true,
  lines: [{ accountCode: '4402001', debit: 85000, credit: 0 }, { accountCode: '1102001', debit: 0, credit: 85000 }] };
define({
  method: 'GET', path: '/recurring-journals', summary: 'Recurring and accrual journal templates (filter kind, status)', screen: 'Accounts > Period End > Recurring Journals', middleware: read,
  response: { success: true, data: [rjExample] },
  handler: async (req, res) => ok(res, (await pool.query(`SELECT * FROM recurring_journals WHERE ($1::text IS NULL OR kind = $1) AND ($2::text IS NULL OR status = $2) ORDER BY status, next_run_date NULLS LAST, code`,
    [req.query.kind || null, req.query.status || null])).rows.map(rjRow)),
});
define({
  method: 'POST', path: '/recurring-journals', summary: 'Create a recurring or accrual journal template (RJV number)', screen: 'Accounts > Period End > Recurring Journals',
  middleware: [...write, validate(rjSchema.required({ name: true, startDate: true, lines: true }))], request: rjExample, response: { success: true, data: rjExample },
  handler: async (req, res) => {
    const r = await tx((db) => saveRecurring(db, req.body, req.user));
    await audit(req, { entity: 'recurring_journal', entityId: r.id, action: 'create', after: rjRow(r) });
    created(res, rjRow(r));
  },
});
define({
  method: 'GET', path: '/recurring-journals/:id', summary: 'A recurring journal template with its generated journals', screen: 'Accounts > Period End > Recurring Journals', middleware: read,
  response: { success: true, data: { ...rjExample, runs: [{ occurrenceDate: '2026-08-31', journalNumber: 'JV-2026-00100', status: 'posted' }] } },
  handler: async (req, res) => {
    const r = (await pool.query('SELECT * FROM recurring_journals WHERE id = $1 OR code = $1', [req.params.id])).rows[0];
    if (!r) throw notFound('Recurring journal not found');
    const runs = (await pool.query(`SELECT x.*, j.jv_number, j.status AS jv_status FROM recurring_journal_runs x LEFT JOIN journal_vouchers j ON j.id = x.jv_id
      WHERE x.recurring_id = $1 ORDER BY x.occurrence_date DESC, x.id DESC LIMIT 200`, [r.id])).rows;
    ok(res, { ...rjRow(r), runs: runs.map((x) => ({ occurrenceDate: fiscal.iso(x.occurrence_date), period: x.period, journalId: x.jv_id, journalNumber: x.jv_number, journalStatus: x.jv_status,
      status: x.status, closeRunId: x.close_run_id, createdAt: x.created_at })) });
  },
});
define({
  method: 'PUT', path: '/recurring-journals/:id', summary: 'Change a recurring journal template (lines, frequency, next run date, end date, auto-post, status)', screen: 'Accounts > Period End > Recurring Journals',
  middleware: [...write, validate(rjSchema)], request: { endDate: '2026-12-31', autoPost: false }, response: { success: true, data: rjExample },
  handler: async (req, res) => {
    const r = await tx((db) => saveRecurring(db, req.body, req.user, req.params.id));
    await audit(req, { entity: 'recurring_journal', entityId: r.id, action: 'update', after: rjRow(r) });
    ok(res, rjRow(r));
  },
});
define({
  method: 'POST', path: '/recurring-journals/run-due', summary: 'Post the recurring journals due up to asOf (default today); what the recurring-journals job does', screen: 'Accounts > Period End > Recurring Journals',
  middleware: [...write, validate(z.object({ asOf: date.optional(), id: z.string().optional() }))], request: { asOf: '2026-09-30' },
  response: { success: true, data: { created: [{ code: 'RJV-2026-00001', occurrence: '2026-09-30', jvNumber: 'JV-2026-00120' }], errors: [] } },
  handler: async (req, res) => {
    const asOf = req.body.asOf || (await (await import('../../lib/dates.js')).today());
    const r = await tx((db) => generateDue(db, { kind: 'recurring', asOf, user: req.user, onlyId: req.body.id || null }));
    await audit(req, { entity: 'recurring_journal', entityId: req.body.id || null, action: 'run-due', after: { asOf, created: r.created.length, errors: r.errors.length } });
    ok(res, r, `${r.created.length} recurring journal(s) generated`);
  },
});

// ---------- year-end close ----------
const yeExample = { id: 'yec_1', runNumber: 'YEC-2026-00001', fiscalYear: 'FY2025', status: 'closed', netIncome: 1250000, nextFiscalYear: 'FY2026' };
define({
  method: 'GET', path: '/year-end', summary: 'Fiscal years with their year-end close runs', screen: `${S} > Year-End Close`, middleware: read,
  response: { success: true, data: [{ code: 'FY2025', status: 'closed', runs: [yeExample] }] }, handler: async (_req, res) => ok(res, await tx((db) => ye.listYearEnd(db))),
});
define({
  method: 'POST', path: '/year-end', summary: 'Start the year-end close of a fiscal year (the year becomes "closing")', screen: `${S} > Year-End Close`,
  middleware: [...write, validate(z.object({ fiscalYear: z.string().regex(/^FY\d{4}$/) }))], request: { fiscalYear: 'FY2025' }, response: { success: true, data: yeExample },
  handler: async (req, res) => {
    const r = await tx((db) => ye.createYearEnd(db, req.body.fiscalYear, req.user));
    await audit(req, { entity: 'year_end_run', entityId: r.id, action: 'create', after: { runNumber: r.run_number, fiscalYear: r.fiscal_year } });
    created(res, await ye.getYearEnd(pool, r.id));
  },
});
define({
  method: 'GET', path: '/year-end/:id', summary: 'A year-end close run with its checks, closing journals and opening balances', screen: `${S} > Year-End Close`, middleware: read,
  response: { success: true, data: yeExample }, handler: async (req, res) => ok(res, await ye.getYearEnd(pool, req.params.id)),
});
const yeAction = (path, summary, schema, fn, action, mw = write) => define({
  method: 'POST', path, summary, screen: `${S} > Year-End Close`, middleware: [...mw, validate(schema)], request: {}, response: { success: true, data: yeExample },
  handler: async (req, res) => {
    const r = await tx((db) => fn(db, req));
    await audit(req, { entity: 'year_end_run', entityId: r.id, action, after: { runNumber: r.runNumber, status: r.status, fiscalYear: r.fiscalYear, netIncome: r.netIncome, ...req.body } });
    ok(res, r);
  },
});
yeAction('/year-end/:id/check', 'Run the year-end pre-checks', z.object({}).passthrough(), (db, req) => ye.checkYearEnd(db, req.params.id), 'check');
yeAction('/year-end/:id/close', 'Close the fiscal year: closing entries (P&L to current year P/L to retained earnings), opening balances of the next year, lock the periods, create the next year (approve:period-end)',
  z.object({}).passthrough(), (db, req) => ye.closeYearEnd(db, req.params.id, req.user), 'close', approve);
yeAction('/year-end/:id/reverse', 'Reverse a year-end close until the first period of the next year is closed (approve:period-end; reason required)', z.object({ reason: z.string().min(1).max(1000) }),
  (db, req) => ye.reverseYearEnd(db, req.params.id, req.user, req.body), 'reverse', approve);
yeAction('/year-end/:id/cancel', 'Cancel a year-end close run that has not closed the year', z.object({}).passthrough(), (db, req) => ye.cancelYearEnd(db, req.params.id), 'cancel');
define({
  method: 'POST', path: '/adjustments', summary: 'Year-end adjustment journal in adjustment period 13 (pending; approved and posted by a second user through POST /accounting/transactions/:id/post)',
  screen: `${S} > Year-End Close`, middleware: [...write, validate(z.object({ fiscalYear: z.string(), description: z.string().min(2).max(500), lines: z.array(lineSchema).min(2) }))],
  request: { fiscalYear: 'FY2025', description: 'Audit adjustment – accrued audit fee', lines: [{ accountCode: '4401003', debit: 150000, credit: 0 }, { accountCode: '2208001', debit: 0, credit: 150000 }] },
  response: { success: true, data: { id: 'jv_1', jvNumber: 'JV-2026-00200', period: '2025-13', status: 'pending' } },
  handler: async (req, res) => {
    const enabled = await getSetting('accounting.adjustment_period_enabled', true);
    const jv = await tx((db) => ye.createAdjustment(db, req.body, req.user, enabled));
    await audit(req, { entity: 'journal', entityId: jv.id, action: 'create-adjustment', after: { jvNumber: jv.jv_number, period: jv.period } });
    // posted by a second user from the journal (Accounts > Journal Voucher, or the accounting queue): write:journal-vouchers
    await notifyApprovers({ audience: 'write:journal-vouchers', document: 'Journal voucher', number: jv.jv_number, by: req.user.username,
      detail: `year-end adjustment, period ${jv.period}`, link: `/accounts/journalvoucher/detailsjournalvocture/${jv.id}`, entity: 'journal_voucher', entityId: jv.id });
    created(res, { id: jv.id, jvNumber: jv.jv_number, period: jv.period, date: fiscal.iso(jv.jv_date), status: jv.status });
  },
});

// ---------- financial statements (catalogue reports shaped for the statement screens) ----------
const readStatements = [requireAuth, requirePermission('read:period-end', 'read:journal-vouchers', 'read:reports')];
const FS = 'Accounts > Period End > Financial Statements';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const statementFields = { FromDate: day.optional(), ToDate: day.optional(), Account: z.string().trim().max(20).optional(), ReportCriteria: z.string().max(40).optional() };
const fromBeforeTo = (q) => !q.FromDate || !q.ToDate || q.FromDate <= q.ToDate;
const rangeError = { message: 'From date must be on or before To date', path: ['ToDate'] };
const statementQuery = z.object(statementFields).refine(fromBeforeTo, rangeError);
const exportQuery = z.object({ ...statementFields, format: z.enum(['xlsx', 'pdf']).default('xlsx') }).refine(fromBeforeTo, rangeError);
const statementType = (type) => {
  if (!st.STATEMENT_TYPES[type]) throw notFound('Unknown statement');
  return st.STATEMENT_TYPES[type];
};

/** Run the catalogue report of a statement and lay it out (statements.js). */
async function loadStatement(type, q, user) {
  const def = statementType(type);
  const { runReport } = await import('../reports/service.js');
  const r = await runReport(def.report, { ...q, ReportCriteria: def.criteria }, { user, page: 1, perPage: 5000 });
  const ranges = await st.statementRanges(pool, r.params.from, r.params.to);
  return { report: r, statement: st.buildStatement(type, r, ranges) };
}

define({
  method: 'GET', path: '/statements/periods', summary: 'Fiscal years with their twelve periods for the period choice of the financial statements, and the default period (the one containing today)',
  screen: FS, middleware: readStatements,
  response: { success: true, data: { today: '2026-10-09', current: { fiscalYear: 'FY2027', period: '2026-10' }, fiscalYears: [{ code: 'FY2027', startDate: '2026-04-01', endDate: '2027-03-31', status: 'open', periods: [{ period: '2026-10', periodNo: 7, startDate: '2026-10-01', endDate: '2026-10-31', status: 'open' }] }] } },
  handler: async (_req, res) => ok(res, await tx((db) => st.statementCalendar(db))),
});
define({
  method: 'GET', path: '/statements/:type', summary: 'Financial statement (income-statement, balance-sheet, trial-balance; gl-detail: postings of an Account with the opening and running balance) for FromDate / ToDate, from the report catalogue; statement: the layout (sections, groups, lines, totals, the date range of each column, the card figures)',
  screen: FS, middleware: [...readStatements, validate(statementQuery, 'query')], query: { FromDate: '2026-10-01', ToDate: '2026-10-31' },
  response: { success: true, data: { rows: [{ accountType: 'income', fsGroup: 'Revenue', accountCode: '3201001', currentPeriod: 183803.75 }], summary: { netIncome: 120000 },
    statement: { type: 'income-statement', title: 'Income Statement', from: '2026-10-01', to: '2026-10-31', measures: [{ key: 'currentPeriod', label: 'This period', from: '2026-10-01', to: '2026-10-31' }],
      sections: [{ key: 'income', label: 'Income', groups: [{ label: 'Revenue', lines: [{ accountCode: '3201001', accountName: 'Brokerage Commission Income', values: { currentPeriod: 183803.75 }, drill: true }], total: { currentPeriod: 183803.75 } }] }],
      result: { key: 'netIncome', label: 'Net income (loss)', values: { currentPeriod: 120000 } }, cards: { totalIncome: 183803.75, totalExpense: 63803.75, netIncome: 120000 } } } },
  handler: async (req, res) => {
    if (req.params.type === 'gl-detail') {
      const { runReport } = await import('../reports/service.js');
      const r = await runReport('gl-detail', { ...req.query, ReportCriteria: 'Account' }, { user: req.user, page: 1, perPage: 5000 });
      return ok(res, { report: r.report, columns: r.columns, rows: r.rows, totals: r.totals, summary: r.summary, params: r.params, total: r.total });
    }
    const { report: r, statement } = await loadStatement(req.params.type, req.query, req.user);
    return ok(res, { report: r.report, columns: r.columns, rows: r.rows, totals: r.totals, summary: r.summary, params: r.params, total: r.total, statement });
  },
});
define({
  method: 'GET', path: '/statements/:type/export', summary: 'Financial statement file: format=xlsx (default) or pdf, with the company, the statement title, the period, printed by / at and the currency',
  screen: `${FS} > Export, Print`, middleware: [...readStatements, validate(exportQuery, 'query')],
  query: { FromDate: '2026-10-01', ToDate: '2026-10-31', format: 'pdf' }, response: '(application/pdf | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)',
  handler: async (req, res) => {
    const { format, ...q } = req.query;
    const { statement } = await loadStatement(req.params.type, q, req.user);
    const print = await printContext({ user: req.user });
    const currency = (await getSetting('currency.default', 'PHP')) || 'PHP';
    const name = `${req.params.type}_${statement.from || statement.to}_${statement.to}`;
    await audit(req, { entity: 'financial_statement', entityId: req.params.type, action: 'export', after: { format, from: statement.from, to: statement.to } });
    if (format === 'pdf') {
      sendPdf(res, buildPdf({ ...print, ...st.statementPdfSpec(statement, { ...print, currency }) }), `${name}.pdf`, 'attachment');
      return;
    }
    const { excelBrand } = await import('../reports/service.js');
    const sheet = st.statementSheet(statement, { companyName: print.letterhead?.name || (await companyName()), generatedBy: print.generatedBy, generatedAt: print.generatedAt,
      currency, format: print.format, logo: !!print.brand?.excel?.logo });
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
    res.send(writeXlsx({ sheets: [sheet], title: statement.title, brand: excelBrand(print) }));
  },
});

// ---------- tax codes and BIR 2307 ----------
const taxSchema = z.object({ code: z.string().regex(/^[A-Z0-9-]{2,20}$/).optional(), description: z.string().min(2).max(300).optional(), taxType: z.enum(tax.TAX_TYPES).optional(),
  rate: z.coerce.number().min(0).max(100).optional(), atc: z.string().max(10).nullable().optional(), natureOfPayment: z.string().max(200).nullable().optional(),
  glAccount: z.string().max(20).nullable().optional(), appliesTo: z.enum(['sales', 'purchases', 'both']).optional(), payeeKind: z.enum(['individual', 'corporate', 'any']).optional(),
  effectiveFrom: date.nullable().optional(), effectiveTo: date.nullable().optional(), active: z.boolean().optional(), sortOrder: z.coerce.number().int().optional(), remarks: z.string().max(500).nullable().optional() });
const taxExample = { code: 'WC158', description: 'EWT 1% – purchases of goods by top withholding agents from corporate suppliers', taxType: 'EWT', rate: 1, atc: 'WC158', glAccount: '2204001', active: true };
define({
  method: 'GET', path: '/tax-codes', summary: 'Tax codes master (VAT, EWT / FWT with BIR ATC, DST, LGT, premium tax); filter taxType, active, search', screen: 'Master > Finance > Taxation', middleware: readTax,
  response: { success: true, data: [taxExample] }, handler: async (req, res) => ok(res, await tax.listTaxCodes(pool, req.query)),
});
define({
  method: 'POST', path: '/tax-codes', summary: 'Add a tax code', screen: 'Master > Finance > Taxation', middleware: [...writeTax, validate(taxSchema.required({ code: true, description: true, taxType: true, rate: true }))],
  request: taxExample, response: { success: true, data: taxExample },
  handler: async (req, res) => {
    const t = await tx((db) => tax.saveTaxCode(db, req.body.code, req.body, req.user, { create: true }));
    await audit(req, { entity: 'tax_code', entityId: t.code, action: 'create', after: t });
    created(res, t);
  },
});
define({
  method: 'PUT', path: '/tax-codes/:code', summary: 'Change a tax code (rate, ATC, GL account, active)', screen: 'Master > Finance > Taxation', middleware: [...writeTax, validate(taxSchema)],
  request: { rate: 2 }, response: { success: true, data: taxExample },
  handler: async (req, res) => {
    const before = (await pool.query('SELECT * FROM tax_codes WHERE code = $1', [req.params.code])).rows[0];
    const t = await tx((db) => tax.saveTaxCode(db, req.params.code, req.body, req.user));
    await audit(req, { entity: 'tax_code', entityId: t.code, action: 'update', before: tax.taxRow(before), after: t });
    ok(res, t);
  },
});
const q2307 = z.object({ year: z.coerce.number().int(), quarter: z.coerce.number().int().min(1).max(4), direction: z.enum(['issued', 'received']).optional(), payeeKey: z.string().optional(),
  payeeType: z.string().max(40).optional() });
define({
  method: 'GET', path: '/bir/2307', summary: 'Payees (issued) or payors (received) with creditable withholding in a quarter, with their certificate numbers (payeeType=Supplier: the suppliers of accounts payable)',
  screen: 'Accounts > Tax > BIR Form 2307; Accounts > Payables > Supplier 2307',
  middleware: [...read, validate(q2307, 'query')], query: { year: 2026, quarter: 3, direction: 'issued' },
  response: { success: true, data: { payees: [{ payeeKey: 'Agent/Referrer:ref-jdelacruz', payeeName: 'Juan Dela Cruz', totalIncome: 5298.72, totalTax: 264.93, certificateNumber: null }] } },
  handler: async (req, res) => ok(res, await tax.payees2307(pool, req.query)),
});
define({
  method: 'GET', path: '/bir/2307/certificate', summary: 'BIR Form 2307 data of one payee and quarter (per ATC: income per month of the quarter, total, tax withheld)', screen: 'Accounts > Tax > BIR Form 2307 > Print',
  middleware: [...read, validate(q2307.required({ payeeKey: true }), 'query')], query: { year: 2026, quarter: 3, payeeKey: 'Agent/Referrer:ref-jdelacruz' },
  response: { success: true, data: { lines: [{ atc: 'WI515', month1: 0, month2: 0, month3: 5298.72, total: 5298.72, tax: 264.93 }], totalTax: 264.93 } },
  handler: async (req, res) => ok(res, await tax.certificate2307(pool, req.query)),
});
define({
  method: 'POST', path: '/bir/2307/issue', summary: 'Issue (number with the CWT series and record) the BIR Form 2307 of a payee and quarter; an issued one is returned unchanged', screen: 'Accounts > Tax > BIR Form 2307',
  middleware: [...write, validate(q2307.required({ payeeKey: true }))], request: { year: 2026, quarter: 3, payeeKey: 'Agent/Referrer:ref-jdelacruz' },
  response: { success: true, data: { certificateNumber: 'CWT-2026-00001', totalTax: 264.93 } },
  handler: async (req, res) => {
    const c = await tx((db) => tax.issue2307(db, req.body, req.user));
    if (!c.alreadyIssued) await audit(req, { entity: 'bir_2307', entityId: c.certificateId, action: 'issue', after: { certificateNumber: c.certificateNumber, payeeKey: c.payeeKey, totalTax: c.totalTax } });
    (c.alreadyIssued ? ok : created)(res, c);
  },
});
define({
  method: 'POST', path: '/bir/2307/issue-all', summary: 'Issue the BIR Form 2307 of every payee of a quarter without one (payeeType=Supplier: the suppliers of accounts payable)',
  screen: 'Accounts > Payables > Supplier 2307', middleware: [...write, validate(z.object({ year: z.number().int(), quarter: z.number().int().min(1).max(4), payeeType: z.string().max(40).optional() }))],
  request: { year: 2026, quarter: 3, payeeType: 'Supplier' },
  response: { success: true, data: { year: 2026, quarter: 3, payeeType: 'Supplier', issued: [{ payeeName: 'Makati Office Supplies Inc.', certificateNumber: 'CWT-2026-00007', totalTax: 450 }], alreadyIssued: 0 } },
  handler: async (req, res) => {
    const r = await tx((db) => tax.issueAll2307(db, req.body, req.user));
    for (const c of r.issued) await audit(req, { entity: 'bir_2307', entityId: c.certificateId, action: 'issue', after: { certificateNumber: c.certificateNumber, payeeKey: c.payeeKey, totalTax: c.totalTax } });
    ok(res, r, `${r.issued.length} certificate(s) issued`);
  },
});
define({
  method: 'GET', path: '/bir/2307/certificates', summary: 'Register of issued BIR Form 2307 certificates (filter year, quarter, direction)', screen: 'Accounts > Tax > BIR Form 2307', middleware: read,
  response: { success: true, data: [{ certificateNumber: 'CWT-2026-00001', payeeName: 'Juan Dela Cruz', totalTax: 264.93, status: 'issued' }] },
  handler: async (req, res) => ok(res, await tax.listCertificates(pool, req.query)),
});
define({
  method: 'POST', path: '/bir/2307/certificates/:id/cancel', summary: 'Cancel an issued certificate (a new one can then be issued)', screen: 'Accounts > Tax > BIR Form 2307',
  middleware: [...write, validate(z.object({ reason: z.string().min(1).max(500) }))], request: { reason: 'Wrong ATC' }, response: { success: true, data: { id: 'cwt_1' } },
  handler: async (req, res) => {
    const r = await tax.cancelCertificate(pool, req.params.id, req.user, req.body.reason);
    await audit(req, { entity: 'bir_2307', entityId: r.id, action: 'cancel', after: req.body });
    ok(res, r);
  },
});

export default router;
export const mount = '/period-end';
