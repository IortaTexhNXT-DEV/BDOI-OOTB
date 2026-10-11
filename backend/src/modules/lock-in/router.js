/**
 * Lock-in API (/lock-in, Operations > Renewals > Lock-in Review and the Lock-in & loan panel of Policy detail):
 * TIS-BRD-SCHM-03 and TIS-BRD-RPT-SLS-05, CR-05. The review list and its decisions, the TFS account status upload,
 * the loan status set by hand, the lock-in changes with approval and the Lock-in / Scheme 2 expiry extract.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit, auditMany } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { normKey, uploadFile } from '../documents/tabular.js';
import { readXlsx } from '../documents/xlsx.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { printContext } from '../documents/pdf.js';
import { excelBrand } from '../reports/service.js';
import * as svc from './service.js';
import * as review from './review.js';
import * as changes from './changes.js';
import { failedRows, listBatches, uploadLoanStatus } from './upload.js';

const { router, define } = moduleRouter('Lock-in', '/lock-in');
const SCREEN = 'Operations > Renewals > Lock-in Review';
const PANEL = 'Operations > Policy > Policy detail > Lock-in & loan';
const canRead = [requireAuth, requirePermission('read:lock-in', 'write:lock-in', 'approve:lock-in', 'write:loan-status')];
const canWrite = [requireAuth, requirePermission('write:lock-in')];
const canApprove = [requireAuth, requirePermission('approve:lock-in')];
const canLoan = [requireAuth, requirePermission('write:loan-status')];
const opt = (t) => t.optional().nullable();

const account = { policyId: 'pol_1', policyNumber: 'POL-2026-90004', insured: 'Andrea Villanueva', sourceLabel: 'Scheme 1 ARA', yearLabel: '2 of 5', expiryDate: '2026-12-12',
  reviewDate: '2026-10-13', loanAccount: '8005123456', loanStatusLabel: 'Current', reviewStatus: 'review-due', reviewStatusLabel: 'Review due', treatment: { code: 'lock-in', label: 'Suppressed: lock-in' } };
const query = { tab: 'due', asOf: '2026-10-09', daysFrom: 0, daysTo: 60, source: 'scheme2', loanStatus: 'past-due', reviewStatus: 'review-due', insurerId: 2, search: '8003828889' };

define({
  method: 'GET', path: '/reviews', summary: 'Lock-in Review accounts of a tab (due, held, pending, in-lock-in) with filters as of date, days to expiry (from, to), source, insurer, loan status, review status and search; counts of every tab',
  screen: SCREEN, middleware: canRead, query, response: { success: true, data: { asOf: '2026-10-09', daysFrom: 0, daysTo: 60, tab: 'due', items: [account] }, counts: { due: 6, held: 1, pending: 1, 'in-lock-in': 9, uploads: 2 } },
  handler: async (req, res) => res.json({ success: true, data: await review.listAccounts(req.query), counts: await review.tabCounts(req.query) }),
});
define({
  method: 'GET', path: '/reviews/export', summary: 'The Lock-in / Scheme 2 expiry report (Excel, TIS-BRD-RPT-SLS-05) with the filters of the list; the parameters and run time on the first rows',
  screen: `${SCREEN} > Export to Excel`, middleware: canRead, query, response: 'binary file',
  handler: async (req, res) => {
    const r = await review.listAccounts(req.query);
    if (!r.items.length) throw badRequest(`No lock-in or Scheme 2 account expires within ${r.daysFrom} to ${r.daysTo} days of ${r.asOf.split('-').reverse().join('/')}`);
    const ctx = await printContext();
    const banner = [ctx.letterhead?.name, 'Lock-in / Scheme 2 expiry', `As of ${r.asOf.split('-').reverse().join('/')}, days to expiry ${r.daysFrom} - ${r.daysTo}${req.query.source ? `, source ${req.query.source}` : ''}${req.query.loanStatus ? `, loan status ${req.query.loanStatus}` : ''}`,
      `Run ${ctx.generatedAt} by ${ctx.generatedBy}`].filter(Boolean);
    const buf = writeXlsx({ title: 'Lock-in / Scheme 2 expiry', brand: excelBrand(ctx), dateFormat: ctx.format?.dateFormat,
      sheets: [{ name: 'Lock-in Scheme 2 expiry', columns: review.REPORT_COLUMNS, rows: review.reportRows(r), banner, logo: true }] });
    await audit(req, { entity: 'report', entityId: 'lock-in-expiry', action: 'export', after: { ...req.query, rows: r.items.length } });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="lock-in-scheme2-expiry-${r.asOf}.xlsx"`);
    res.send(buf);
  },
});
define({
  method: 'GET', path: '/reviews/:id', summary: 'A review item: the account, lock-in, loan status history, notices sent / skipped / cancelled, decision and its history', screen: `${SCREEN} > Review`,
  middleware: canRead, response: { success: true, data: { id: 'lkr_1', status: 'review-due', account, loanHistory: [], notices: [], history: [] } },
  handler: async (req, res) => res.json({ success: true, data: await review.getReview(req.params.id) }),
});
define({
  method: 'POST', path: '/reviews/:id/decision', summary: 'Record the decision of a review (write:lock-in): renew, hold (reReviewDate), release, not-renewed; reasonCode of the decision and a remark of 10 characters',
  screen: `${SCREEN} > Review > Save decision`, middleware: [...canWrite, validate(z.object({ decision: z.enum(['renew', 'hold', 'release', 'not-renewed']), reasonCode: opt(z.string().max(40)),
    remark: opt(z.string().max(500)), reReviewDate: opt(z.string().max(10)) }))],
  request: { decision: 'hold', reasonCode: 'LKH-PAST-DUE', remark: 'Awaiting the TFS collection update', reReviewDate: '2026-10-23' },
  response: { success: true, message: 'Decision saved: Hold', status: 'on-hold' },
  handler: async (req, res) => {
    const r = await review.decide(req.params.id, req.body, req.user);
    await audit(req, { entity: 'lock-in-review', entityId: req.params.id, action: 'decision', before: r.before, after: { ...req.body, status: r.status } });
    res.json({ success: true, message: r.message, status: r.status });
  },
});
for (const [path, decision, message] of [['approve', 'approve', 'Approve'], ['return', 'return', 'Return']]) {
  define({
    method: 'POST', path: `/reviews/:id/${path}`, summary: `${message} a Release or Not for renewal decision (approve:lock-in, never its maker)${decision === 'return' ? '; remark required' : ''}`,
    screen: `My Work > Approvals > Lock-in review > ${message}`, middleware: [...canApprove, validate(z.object({ note: opt(z.string().max(500)) }))], request: { note: 'Loan early terminated per TFS' },
    response: { success: true, message: decision === 'approve' ? 'Decision approved: Not for renewal' : 'Decision returned to J. Santos' },
    handler: async (req, res) => {
      const r = await review.approve(req.params.id, { decision, note: req.body?.note }, req.user);
      await audit(req, { entity: 'lock-in-review', entityId: req.params.id, action: decision, before: r.before, after: { note: req.body?.note || null } });
      res.json({ success: true, message: r.message });
    },
  });
}
define({
  method: 'GET', path: '/uploads', summary: 'TFS account status uploads (Loan status uploads tab): file, status date, rows, updated, not changed, failed, notices held, holds lifted',
  screen: `${SCREEN} > Loan status uploads`, middleware: canRead,
  response: { success: true, data: [{ id: 'lsb_1', batchNumber: 'LS-2026-00041', fileName: 'TFS_ACCT_STATUS_20261008.xlsx', rowsTotal: 1284, updated: 1200, notChanged: 76, failed: 8, noticesHeld: 6, holdsLifted: 1 }] },
  handler: async (_req, res) => res.json({ success: true, data: await listBatches() }),
});
define({
  method: 'GET', path: '/uploads/template', summary: 'TFS account status template (XLSX: Data, Columns, Instructions)', screen: `${SCREEN} > Upload loan status > Template`, middleware: canRead,
  response: 'binary file', handler: async (_req, res) => sendTemplate(res, 'tfs-loan-status'),
});
define({
  method: 'GET', path: '/uploads/:id/failed', summary: 'The failed rows of an upload (Excel)', screen: `${SCREEN} > Loan status uploads > Failed rows`, middleware: canRead, response: 'binary file',
  handler: async (req, res) => {
    const f = await failedRows(req.params.id);
    if (!f) throw badRequest('Upload not found');
    const buf = writeXlsx({ title: 'Failed rows', sheets: [{ name: 'Failed rows', columns: [{ key: 'row', header: 'Row', type: 'integer' }, { key: 'message', header: 'Message', width: 90 }], rows: f.rows }] });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${f.batchNumber}-failed.xlsx"`);
    res.send(buf);
  },
});
define({
  method: 'POST', path: '/uploads', summary: 'Upload the TFS account status file (.xlsx, multipart "file"; write:loan-status): row by row, a newer status date wins, a manual status is kept, blocking statuses hold the notices',
  screen: `${SCREEN} > Upload loan status`, middleware: [...canLoan, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: 'Processed 1284 rows: 1276 loaded, 8 failed', data: { batchNumber: 'LS-2026-00041', loaded: 1276, failed: 8, noticesHeld: 6, errors: [{ row: 17, message: 'Row 17: loan account 80051163 must have 10 digits' }] } },
  handler: async (req, res) => {
    const name = req.file?.originalname || '';
    if (!req.file?.buffer?.length || !name.toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file', code: 'MSG-LCK-016' }]);
    let table;
    try { table = readXlsx(req.file.buffer); } catch (e) { throw badRequest(`Could not read the file: ${e.message}`); }
    const headers = (table[0] || []).map(normKey);
    const rows = table.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
    const out = await uploadLoanStatus({ rows, headers, fileName: name }, req.user);
    await audit(req, { entity: 'loan-status-batch', entityId: out.batchId, action: 'upload', after: { ...out, errors: out.errors.slice(0, 50), notChangedRows: out.notChangedRows.slice(0, 50) } });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/policies/:policyId', summary: 'Lock-in & loan panel of a policy: lock-in source, period, year of the term, review date, notice treatment, last review, TFS loan account and status (stale warning), pending change, history; null without lock-in or loan account',
  screen: PANEL, middleware: [requireAuth, requirePermission('read:lock-in', 'read:policies')],
  response: { success: true, data: { source: 'scheme1-ara', sourceLabel: 'Scheme 1 ARA', startDate: '2024-12-13', endDate: '2029-12-12', years: 5, year: 2, reviewDate: '2026-10-13', treatment: { code: 'lock-in', label: 'Suppressed: lock-in' }, tfsLoanAccount: '8005123456', loanStatusLabel: 'Current' } },
  handler: async (req, res) => res.json({ success: true, data: await svc.policyPanel(req.params.policyId) }),
});
define({
  method: 'PUT', path: '/policies/:policyId/loan-status', summary: 'Set the loan status of the policy\'s TFS loan account by hand (write:loan-status): every policy of the loan; remark of 10 characters; kept as manual',
  screen: `${PANEL} > Set loan status`, middleware: [...canLoan, validate(z.object({ loanStatus: z.string().max(30), statusDate: opt(z.string().max(10)), remark: opt(z.string().max(500)) }))],
  request: { loanStatus: 'fraud', remark: 'Fraud case FC-2026-014 reported by TFS Legal' }, response: { success: true, message: 'Loan status of 8005649469 set to Fraud; notices are held' },
  handler: async (req, res) => {
    const r = await svc.setLoanStatus(req.params.policyId, req.body, req.user);
    await auditMany(req, r.out.updated.map((u) => ({ entity: 'loan-status', entityId: u.policyId, action: 'set', before: { loanStatus: u.from }, after: { loanStatus: u.to, loanAccount: r.loanAccount,
      treatment: u.treatment.code, remark: req.body.remark, manual: req.body.loanStatus !== 'current' } })));
    res.json({ success: true, message: r.message });
  },
});
define({
  method: 'POST', path: '/policies/:policyId/changes', summary: 'Request a lock-in change (write:lock-in): add, correct or end (reasonCode of lockin_end); applied once another user approves it',
  screen: `${PANEL} > Change lock-in`, middleware: [...canWrite, validate(z.object({ action: z.enum(['add', 'correct', 'end']), source: opt(z.string().max(20)), reference: opt(z.string().max(60)),
    startDate: opt(z.string().max(10)), years: z.union([z.null(), z.coerce.number()]).optional(), tfsLoanAccount: opt(z.string().max(20)), reasonCode: opt(z.string().max(40)), remark: opt(z.string().max(500)) }))],
  request: { action: 'add', source: 'scheme1-ara', reference: 'S1-STD-2024', startDate: '2024-12-13', years: 5, tfsLoanAccount: '8005123456', remark: 'Account under ARA before go-live' },
  response: { success: true, message: 'Lock-in change sent for approval', data: { id: 'lkc_1', preview: { endDate: '2029-12-12', treatment: 'Suppressed: lock-in' } } },
  handler: async (req, res) => {
    const r = await changes.requestChange(req.params.policyId, req.body, req.user);
    await audit(req, { entity: 'lock-in', entityId: r.policyId, action: 'change-request', before: r.before, after: { ...r.proposed, action: req.body.action, remark: req.body.remark, changeId: r.id } });
    res.status(201).json({ success: true, message: r.message, data: r });
  },
});
for (const [path, decision] of [['approve', 'approve'], ['return', 'return']]) {
  define({
    method: 'POST', path: `/changes/:id/${path}`, summary: `${decision === 'approve' ? 'Approve' : 'Return'} a lock-in change (approve:lock-in, never its requester)`,
    screen: `My Work > Approvals > Lock-in change > ${decision === 'approve' ? 'Approve' : 'Return'}`, middleware: [...canApprove, validate(z.object({ note: opt(z.string().max(500)) }))],
    request: { note: 'ARA deed checked' }, response: { success: true, message: decision === 'approve' ? 'Lock-in change approved' : 'Lock-in change returned' },
    handler: async (req, res) => {
      const r = await changes.decideChange(req.params.id, { decision, note: req.body?.note }, req.user);
      await audit(req, { entity: 'lock-in', entityId: r.policyId, action: `change-${decision}`, before: r.before, after: r.after });
      res.json({ success: true, message: r.message });
    },
  });
}

export default router;
export const mount = '/lock-in';
