import { importUpload } from '../../lib/uploadLimits.js';
import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { badRequest } from '../../lib/errors.js';
import { created, ok, paging } from '../../lib/respond.js';
import { canRead, canWrite, sendList } from '../masters/helpers.js';
import * as masters from '../masters/service.js';
import * as svc from './service.js';
import * as items from './items.js';
import { remittanceUpload, sendWorkbook, staticUploads, templateCsv } from '../documents/uploadTemplates.js';
import * as directBill from './directbill.js';
import * as clientPayments from './clientPayments.js';
import { pool, withTransaction } from '../../db/pool.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { commissionDebitNoteDoc, remittanceAdviceDoc } from '../documents/templates.js';
import { sendTable } from '../documents/tabular.js';
import * as approvals from './approvals.js';
import { ACTIVITY_HEADER, activityRows, remittanceActivity } from './activity.js';
import * as register from './register.js';
import * as documents from './documents.js';
import * as imports from './imports.js';
import * as runs from './runs.js';
import { listHeld } from './holds.js';
import * as billing from './billing.js';
import * as payments from './payments.js';
import { remittanceSummary } from './summary.js';
import { requiredReason } from '../ops-masters/records.js';

/** Remittance (Accounts > Remittance, 16 screens) and the Remittance Master overview. */
const { router, define } = moduleRouter('Remittance', '/remittance');
const read = canRead('remittance');
const write = canWrite('remittance');
// deciding an approval is the checker's permission, without the maker's write:remittance
const approve = [requireAuth, requirePermission('approve:remittance')];
const upload = importUpload();
const singleFile = (req, res, next) => upload.single('file')(req, res, (e) => next(e ? badRequest(e.message) : undefined));
// the bulk upload of earlier releases, while remittance.bulk_upload_enabled is on (409 with a pointer to Import policy list)
const bulkOpen = (req, res, next) => items.assertBulkUpload().then(() => next(), next);
// electronic transfers of earlier releases, while remittance.transfers_enabled is on (409: insurers are paid from Insurer payments)
const transfersOpen = (req, res, next) => svc.assertTransfersEnabled().then(() => next(), next);
const S = (name) => `Accounts > Remittance > ${name}`;
const sendXlsx = (res, { buffer, fileName }) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};
const rem = { id: 'rm_1', remittanceNo: 'REM-2026-00001', remittanceDate: '2026-09-15', insurerCode: 'MALAYAN', insurerName: 'Malayan Insurance Co., Inc.', policyCount: 3, grossAmount: 45000, commission: 6750, tax: 0, netAmount: 38250, status: 'Pending Approval', statusCode: 'for-approval' };
const listOf = async (req, res, kind, mapper) => {
  const pg = paging(req.query, { page: 1, perPage: 50 });
  const { rows, total } = await items.listItems(kind, req.query, pg, mapper);
  sendList(res, rows, total, pg);
};
const logged = (entity, action, fn) => async (req) => {
  const out = await fn(req);
  const id = out?.id ?? out?.after?.id ?? req.params.id ?? null;
  await audit(req, { entity, entityId: id, action, before: out?.before, after: out?.after ?? out });
  return out;
};

// ---------------- summary ----------------
define({
  method: 'GET', path: '/summary',
  summary: 'What Accounts > Remittance holds for the caller: counts per menu entry (remittances in my work, approvals awaiting my decision, insurer payments to pay (write:disbursements, else null), insurer statements to act on, exceptions assigned to me, my draft and overdue debit notes, setup), the entries with something overdue, the run strip (last run, next run, automation on or off) and the landing page',
  screen: S('Landing'), middleware: read,
  response: { success: true, data: { counts: { remittances: 3, approvals: 1, payments: 2, reconciliation: 0, exceptions: 0, billing: 1, setup: 0 },
    overdue: { remittances: false, approvals: false, payments: false, reconciliation: false, exceptions: false, billing: true, setup: false },
    runStrip: { lastRun: { id: 'run_0123456789abcdef', scheduleCode: 'TIS-WEEKLY', at: '2026-10-11T22:15:00.000Z', text: '12/10/2026 06:15', result: 'success', resultLabel: 'Success',
      counts: { scanned: 14, ready: 14, held: 0, exceptions: 0, created: 3 }, message: 'Weekly run done: 3 remittance(s) created, 0 policies held, 0 exceptions.', failed: false },
    nextRun: { scheduleCode: 'TIS-WEEKLY', date: '2026-10-19', text: 'Mon 19/10/2026 06:15' }, automation: { on: false, label: 'Automation Off', checkedDaily: '06:15', timeZone: 'Asia/Manila' } },
    landing: { code: 'approvals', link: '/finance/remittance/approvals' } } },
  handler: async (req, res) => ok(res, await remittanceSummary(req.user)),
});

// ---------------- remittances (tracking, direct / agency bills) ----------------
const regRow = { id: 'rm_21', remittanceNo: 'REM-2026-00021', kind: 'direct-bill', status: 'for-approval', statusLabel: 'Pending Approval',
  insurer: { id: 3, code: 'PIONEER', name: 'Pioneer Insurance & Surety Corp.', shortName: 'Pioneer' }, productLine: 'Motor', basis: 'net', basisLabel: 'Net',
  coverageWeek: { from: '2026-10-05', to: '2026-10-09' }, source: { code: 'import', label: 'Import IMP-2026-0004', importId: 'imp_1', importNo: 'IMP-2026-0004' },
  offCycleReason: { code: 'ROC-GOLIVE', name: 'Go-live opening', note: null, text: 'Go-live opening' }, policyCount: 12, heldCount: null, premium: 520000, commission: 98000, tax: 12858.57,
  adjustments: 0, dueToInsurer: 409141.43, currency: 'PHP', remittanceDate: '2026-10-12', dueDate: '2026-10-16', overdue: false,
  flags: { offCycle: true, offCycleReason: 'Go-live opening', overdue: false, adviceSent: false, bankMatched: false, openExceptions: 0 },
  nextStep: { code: 'approve', label: 'Awaiting remittance approver (2)', actor: { type: 'users', ids: ['usr_9', 'usr_12'], name: 'J. Cruz, A. Tan' }, dueAt: '2026-10-13T02:12:00.000Z' },
  decision: { canDecide: false, blockedCode: 'SUBMITTER', blockedReason: 'You submitted this remittance. Another user with remittance authority must approve it.' }, approvalId: 21, approvalVersion: 1,
  actions: [{ code: 'view', label: 'View', allowed: true, link: '/finance/remittance/remittances/rm_21' },
    { code: 'download-schedule-xlsx', label: 'Download schedule (XLSX)', allowed: true, href: '/remittance/remittances/rm_21/schedule.xlsx' },
    { code: 'download-schedule-pdf', label: 'Download schedule (PDF)', allowed: true, href: '/remittance/remittances/rm_21/schedule.pdf' }],
  version: 3, voucher: null, paidOn: null, bankReference: null, submittedBy: { id: 'usr_4', name: 'M. Reyes' }, submittedAt: '2026-10-12T02:12:00.000Z',
  createdBy: { id: 'usr_4', name: 'M. Reyes' }, createdAt: '2026-10-12T01:40:00.000Z', link: '/finance/remittance/remittances/rm_21' };
define({
  method: 'GET', path: '/remittances',
  summary: 'Remittances register (Remittances screen) with segment=my-work|drafts|in-approval|in-payment|all (direct-bill only; week (a Monday), insurerId, productLine, status (All), source weekly-run|run-now|import|manual, kpi to-submit|awaiting-approval|approved-not-paid|overdue, q (REM, policy or OR no.), sort (remittanceNo, dueDate, dueToInsurer, -createdAt ...), paging): rows with status label, flags, next step and actions, totals of the filtered set, the 4 KPI figures and segment counts over the filters. Without segment: the remittances / bills of earlier screens (kind, status label or code, insurer, from, to, search, paging)',
  screen: `${S('Remittances')}; ${S('Tracking')}; ${S('Automated Processing')}`,
  middleware: read, query: { segment: 'all', week: '2026-10-05', insurerId: 3, productLine: 'Motor', status: 'for-approval', source: 'import', q: 'REM-2026', page: 1, perPage: 50, sort: '-dueDate' },
  response: { success: true, data: [regRow], total: 1, page: 1, perPage: 50, totalPages: 1, segment: 'all',
    totals: { count: 1, policies: 12, premium: 520000, commission: 98000, tax: 12858.57, dueToInsurer: 409141.43 },
    kpis: { toSubmit: { count: 3, amount: 1234567.89 }, awaitingApproval: { count: 1, amount: 409141.43 }, approvedNotPaid: { count: 2, amount: 120000, oldestDays: 4 }, overdue: { count: 0, amount: 0 } },
    segments: { 'my-work': 3, drafts: 3, 'in-approval': 1, 'in-payment': 2, all: 9 } },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    if (req.query.segment) {
      const r = await register.registerList(req.query, req.user, pg);
      return sendList(res, r.rows, r.total, pg, { segment: r.segment, totals: r.totals, kpis: r.kpis, segments: r.segments });
    }
    const { rows, total, summary } = await svc.listRemittances(req.query, pg);
    return sendList(res, rows, total, pg, { summary });
  },
});
define({
  method: 'GET', path: '/remittances/export.xlsx',
  summary: 'Register export (Remittances > Export XLSX): every visible and hidden column over the whole filtered set (the filters of GET /remittances), the letterhead block and the filter summary above the table',
  screen: S('Remittances > Export XLSX'), middleware: read, query: { segment: 'all', week: '2026-10-05', insurerId: 3 }, response: '(xlsx file)',
  handler: async (req, res) => sendXlsx(res, await documents.registerXlsx({ ...req.query, segment: req.query.segment || 'all' }, req.user)),
});
define({
  method: 'POST', path: '/remittances/submit',
  summary: 'Submit several draft or returned remittances for approval, each checked on its own with the version it was shown (write:remittance); the ready ones go as one processing batch to their eligible approvers. Per-item results: Submitted, or the reason (ALREADY_SUBMITTED "REM-2026-00021 was submitted by J. Cruz at 10:12.", STALE, WRONG_STATUS, INVALID "Not submitted: ...")',
  screen: S('Remittances > Submit for approval'), middleware: write,
  request: { items: [{ id: 'rm_21', version: 2 }, { id: 'rm_22', version: 1 }] },
  response: { success: true, data: { submitted: 1, refused: 1, batchId: 'BLK-2026-00007', results: [{ id: 'rm_21', reference: 'REM-2026-00021', ok: true, status: 'for-approval', statusLabel: 'Pending Approval', message: 'Submitted' },
    { id: 'rm_22', reference: 'REM-2026-00022', ok: false, code: 'INVALID', message: 'Not submitted: Due to insurer must be greater than zero' }] } },
  handler: async (req, res) => {
    const r = await register.submitMany(req.body || {}, req.user, req);
    ok(res, r, `${r.submitted} remittance(s) submitted for approval`);
  },
});
const activity = {
  action: 'submit', by: 'r.finance', at: '2026-10-10T01:03:00.000Z', notes: null, id: '812', day: '2026-10-10', date: '10/10/2026', time: '09:03', atText: '10/10/2026 09:03',
  actionCode: 'submit', actionLabel: 'Remittance submitted', user: { username: 'r.finance', displayName: 'Rosa Finance', roles: ['Finance Officer'], role: 'Finance Officer' },
  fromStatus: 'Draft', toStatus: 'Pending Approval', remarks: null, changes: [{ field: 'batchId', label: 'Batch ID', before: null, after: 'BLK-2026-00001' }],
  source: { channel: 'screen', label: 'Screen', name: 'Accounts > Remittance > Tracking' },
};
define({
  method: 'GET', path: '/remittances/:id',
  summary: 'Remittance record: insurer, policies, documents, version, the decision block of its approval for the caller (canDecide, blockedCode / blockedReason, eligible approvers) with the next step, the activity log (as GET /remittances/:id/activity) and, for a direct-bill remittance, the register row (status label, flags, source and import, off-cycle reason, coverage week, basis, actions), the lines with the expected amount and variance of an import, the payment through the settlement voucher and the downloads, and the approval of the record page (level, SLA, reminder, outcome with the limit at decision and its source, the checks while pending, approve / reject / remind)',
  screen: `${S('Remittances > Record')}; ${S('Tracking > View')}`, middleware: read,
  response: { success: true, data: { ...rem, ...regRow, statusCode: 'for-approval', insurerDetails: { code: 'MALAYAN', name: 'Malayan Insurance Co., Inc.' },
    policies: [{ policyNo: 'POL-2026-00001', premium: 15000, commission: 2250 }],
    lines: [{ id: 1, policyNo: 'TISPH-PC-0001234', insuredName: 'J. Santos', premium: 64159.68, commission: 24022.5, tax: 0, netAmount: 40137.18, expectedDue: 40191.18, variance: -54, insurerReference: 'SOA-2026-10-001', remark: null }],
    payment: null, downloads: [{ code: 'schedule-xlsx', label: 'schedule (XLSX)', href: '/remittance/remittances/rm_21/schedule.xlsx' }], activityLog: [activity],
    approval: { id: 21, version: 1, status: 'Pending', level: { current: 1, required: 1, label: '1 of 1' }, submittedBy: { id: 'usr_4', name: 'M. Reyes' }, submittedAt: '2026-10-06T02:12:00.000Z',
      sla: { hours: 24, dueAt: '2026-10-07T02:12:00.000Z', ageHours: 6.5, overdue: false, label: 'Due in 18 h' }, reminder: { remindedAt: null, nextAt: null, allowed: true }, outcome: null,
      authorityType: 'Remittance', amount: 409141.43, contentVersion: 3, submittedVersion: 3, contentUnchanged: true,
      checks: [{ code: 'content-unchanged', label: 'Content unchanged since submission', result: 'pass', detail: 'v3 · unchanged since submission' }],
      actions: [{ code: 'approve', label: 'Approve', allowed: false, blockedCode: 'SUBMITTER' }, { code: 'reject', label: 'Reject', allowed: false }, { code: 'remind', label: 'Remind approver', allowed: true }] } } },
  handler: async (req, res) => {
    const r = await register.remittanceRecord(req.params.id, req.user);
    ok(res, { ...r, approval: await approvals.recordApproval(r.id, req.user) });
  },
});
define({
  method: 'GET', path: '/remittances/:id/activity',
  summary: 'Activity log of a remittance, oldest first: its audit, the approval decisions (display name, level, limit at decision and its source, reason), the settlement, the payment voucher with its batch and cheque audit, and the e-mails sent; the same action of the same user within 2 s is one entry (format=xlsx: Download log)',
  screen: S('Remittances > Record > Activity'), middleware: read, query: { format: 'xlsx' },
  response: { success: true, data: [{ ...activity, actionCode: 'approve', actionLabel: 'Remittance approved', fromStatus: 'Pending Approval', toStatus: 'Approved', changes: [
    { field: 'limitAtDecision', label: 'Limit at decision', before: null, after: 'PHP 1,000,000.00' }, { field: 'limitSource', label: 'Limit source', before: null, after: 'Role limit: TIS Finance & General Accounting' }],
  approval: { level: 1, requiredLevels: 1, limitAtDecision: 1000000, limitSource: 'role tis-finance', limitSourceLabel: 'Role limit: TIS Finance & General Accounting', reason: null } }] },
  handler: async (req, res) => {
    const r = await svc.getRemittanceRow(req.params.id);
    const entries = await remittanceActivity(r.id, { viewer: req.user });
    if (String(req.query.format || '').toLowerCase() === 'xlsx') {
      return sendTable(res, { header: ACTIVITY_HEADER, rows: activityRows(entries), fileBase: `activity-${r.remittance_number}`, format: 'xlsx', sheetName: 'Activity' });
    }
    return ok(res, entries);
  },
});
define({
  method: 'GET', path: '/remittances/:id/pdf', summary: 'Printable remittance advice (agency bill for an agency bill): broker letterhead, the policies, the amount due and the signatures (PDF; download=1 for an attachment)',
  screen: S('Tracking > Print'), middleware: read, query: { download: 1 }, response: 'application/pdf',
  handler: async (req, res) => {
    const r = await svc.remittanceDetails(req.params.id, { viewer: req.user });
    sendPdf(res, buildPdf(await remittanceAdviceDoc(r, r.policies)), `remittance-${r.remittanceNo}.pdf`, req.query.download ? 'attachment' : 'inline');
  },
});
for (const [ext, doc] of [['xlsx', 'XLSX'], ['pdf', 'PDF']]) {
  define({
    method: 'GET', path: `/remittances/:id/schedule.${ext}`,
    summary: `Remittance schedule (${doc}${ext === 'pdf' ? ', A4 landscape' : ''}): letterhead, insurer, product line, coverage date, remittance no. and date, one row per policy (issued date, client, car model, insurer, policy no., business type, inception, sum insured, premium, commission, taxes, due to insurer), totals and the note that it is valid without signature; file <REM no>_Schedule_<yyyymmdd>.${ext}`,
    screen: `${S('Remittances > Download schedule')}; ${S('Remittances > Record > Documents')}`, middleware: read, response: ext === 'pdf' ? 'application/pdf' : '(xlsx file)',
    handler: async (req, res) => {
      if (ext === 'pdf') {
        const { buffer, fileName } = await documents.schedulePdf(req.params.id, req.user);
        return sendPdf(res, buffer, fileName, 'attachment');
      }
      return sendXlsx(res, await documents.scheduleXlsx(req.params.id, req.user));
    },
  });
}
define({
  method: 'GET', path: '/remittances/:id/advice.pdf',
  summary: 'Remittance advice letter (PDF, portrait): the insurer\'s name, address and TIN, the remittance no., coverage week, product line and basis, the payment block of the settlement voucher (voucher no., method, value date, bank reference) and the amounts (total premium, commission, VAT and EWT on commission, due to insurer, refund credits netted, amount paid); file <REM no>_Advice_<yyyymmdd>.pdf',
  screen: `${S('Remittances > Download advice')}; ${S('Remittances > Record > Documents')}`, middleware: read, query: { download: 1 }, response: 'application/pdf',
  handler: async (req, res) => {
    const { buffer, fileName } = await documents.advicePdf(req.params.id, req.user);
    sendPdf(res, buffer, fileName, req.query.download === '0' ? 'inline' : 'attachment');
  },
});
define({
  method: 'POST', path: '/remittances', summary: 'Create a draft remittance from policy lines', screen: S('Tracking'), middleware: write,
  request: { kind: 'direct-bill', insurerCode: 'MALAYAN', period: '2026-09', dueDate: '2026-10-15', lines: [{ policyNo: 'POL-2026-00001' }, { policyNo: 'EXT-1', premium: 12000, commission: 1800, tax: 0 }] },
  response: { success: true, data: rem },
  handler: async (req, res) => {
    const r = await svc.createRemittance(req.body || {}, req.user);
    await audit(req, { entity: 'remittance', entityId: r.id, action: 'create', after: r });
    created(res, r, 'Remittance created');
  },
});
define({
  method: 'POST', path: '/remittances/validate', summary: 'Validate selected remittances before processing', screen: S('Automated Processing > Validate'), middleware: read,
  request: { ids: ['rm_1'] }, response: { success: true, data: { totalValidated: 1, validCount: 1, invalidCount: 0, results: [{ id: 'rm_1', code: 'REM-2026-00001', valid: true, errors: [] }] } },
  handler: async (req, res) => ok(res, await svc.validateRemittances(req.body?.ids)),
});
define({
  method: 'POST', path: '/remittances/process', summary: 'Submit selected draft remittances for approval as one batch', screen: `${S('Automated Processing > Process')}; ${S('Tracking > Process')}`, middleware: write,
  request: { ids: ['rm_1'] }, response: { success: true, data: { success: true, processedIds: ['rm_1'], batchId: 'BLK-2026-00001', processedAt: '2026-09-28T00:00:00Z' } },
  handler: async (req, res) => {
    const r = await svc.processRemittances(req.body?.ids, req.user);
    await audit(req, { entity: 'remittance_batch', entityId: r.batchId, action: 'submit', after: r });
    for (const id of r.processedIds) await audit(req, { entity: 'remittance', entityId: id, action: 'submit', after: { status: 'for-approval', batchId: r.batchId } });
    ok(res, r, r.message);
  },
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/remittances/:id/${action}`,
    summary: `${action === 'approve' ? 'Approve' : 'Reject (return to the maker, with a remittance_reject reason)'} a remittance (approve:remittance; maker-checker: not the submitter or maker; within the approver's Authority Matrix limit; version: 409 STALE when the approval moved on, 409 ALREADY_DECIDED when decided)`, screen: S('Approval'), middleware: approve,
    request: action === 'approve' ? { comments: 'Verified', version: 1 } : { reasonCode: 'RRJ-OTHER', note: 'Missing documents', version: 1 }, response: { success: true, data: { status: action === 'approve' ? 'Approved' : 'Rejected' } },
    handler: async (req, res) => {
      const r = await svc.getRemittanceRow(req.params.id);
      await svc.decideFor('remittance', r.id, action, req.body || {}, req.user, { req, version: req.body?.version ?? null });
      ok(res, await svc.getRemittance(r.id), `Remittance ${action === 'approve' ? 'approved' : 'returned to the maker'}`);
    },
  });
}
define({
  method: 'POST', path: '/remittances/:id/settle', summary: 'Mark an approved remittance as settled (paid to the insurer); 409 SETTLE_OFF while remittance.direct_settle_enabled is off (TISPH: paid through the voucher of its settlement)', screen: S('Settlement'), middleware: write,
  request: { referenceNo: 'PESONET-889201', paymentMethod: 'bank_transfer', paymentDate: '2026-09-30' }, response: { success: true, data: { ...rem, status: 'Completed', statusCode: 'settled' } },
  handler: async (req, res) => ok(res, await logged('remittance', 'settle', (r) => svc.settleRemittance(r.params.id, r.body || {}, r.user))(req, res), 'Remittance settled'),
});
define({
  method: 'GET', path: '/processing-history', summary: 'Processing batches and automated executions', screen: S('Automated Processing > History'), middleware: read,
  response: { success: true, data: [{ batchId: 'BLK-2026-00001', processedAt: '2026-09-28T00:00:00Z', processedBy: 'Finance Officer', itemCount: 3, totalAmount: 120000, status: 'Pending Approval', duration: '1s' }] },
  handler: async (_req, res) => ok(res, await svc.processingHistory()),
});

// ---------------- automated processing ----------------
define({
  method: 'GET', path: '/automated/candidates', summary: 'Remittances the active automated configurations would generate (unremitted policies per insurer)', screen: S('Automated Processing'), middleware: read,
  query: { configCode: 'ARM-001' }, response: { success: true, data: [{ id: 'ARM-001:MALAYAN', scheduleCode: 'ARM-001', insurerCode: 'MALAYAN', policyCount: 4, estimatedAmount: 51000, dueDate: '2026-10-15', status: 'Ready' }] },
  handler: async (req, res) => ok(res, await svc.automatedCandidates(req.query.configCode)),
});
define({
  method: 'POST', path: '/automated/execute', summary: 'Generate draft remittances now (all ready candidates or the selected ids)', screen: S('Automated Processing > Execute'), middleware: write,
  request: { configCode: 'ARM-001', ids: ['ARM-001:MALAYAN'] }, response: { success: true, data: { executionId: 'BLK-2026-00002', remittances: [rem], recordsProcessed: 4, totalAmount: 51000 } },
  handler: async (req, res) => {
    const r = await svc.executeAutomated(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_execution', entityId: r.executionId, action: 'execute', after: { remittances: r.remittances.map((x) => x.id), totalAmount: r.totalAmount } });
    ok(res, r, `${r.remittances.length} remittance(s) generated`);
  },
});
define({
  method: 'GET', path: '/automated/history', summary: 'Automated remittance execution history', screen: S('Automated Processing'), middleware: read,
  response: { success: true, data: [{ executionId: 'BLK-2026-00002', configCode: 'ARM-001', executionDate: '2026-09-15', status: 'Success', recordsProcessed: 12, totalAmount: 250000 }] },
  handler: async (_req, res) => ok(res, await svc.executionHistory()),
});

// ---------------- direct bill: commission debit notes to insurers (the client pays the insurer) ----------------
const dnExample = { id: 'dn_1', dnNumber: 'DN-2026-00001', dnDate: '2026-09-30', dueDate: '2026-10-30', periodFrom: '2026-09-01', periodTo: '2026-09-30', insurerCode: 'MALAYAN',
  insurerName: 'Malayan Insurance Co., Inc.', policyCount: 2, grossPremium: 45000, commission: 6750, vat: 810, amount: 7560, ewtRate: 0.1, expectedEwt: 675, netPayable: 6885,
  collectedCash: 0, collectedEwt: 0, balance: 7560, status: 'Pending Approval', statusCode: 'for-approval', currency: 'PHP' };
const itemExample = { id: 'dbi_1', policyId: 'pol_1', policyNo: 'POL-2026-00001', reference: 'POL-2026-00001', source: 'policy', insuredName: 'Juan Dela Cruz', product: 'Private Car Comprehensive',
  lineOfBusiness: 'MOTOR', bookedOn: '2026-09-15', grossPremium: 30000, netPremium: 25000, commissionRate: 18, commission: 4500, vat: 540, totalDue: 5040, expectedEwt: 450, netReceivable: 4590, bookingJournal: 'JV-2026-00012' };
define({
  method: 'GET', path: '/direct-bill/summary', summary: 'Commission receivable from insurers on direct-bill policies: unbilled, billed outstanding, overdue, notes pending approval', screen: S('Direct Bill Processing'), middleware: read,
  response: { success: true, data: { unbilled: 5040, billedOutstanding: 7560, overdue: 0, total: 12600, pendingApproval: 1 } },
  handler: async (_req, res) => ok(res, await directBill.receivableSummary()),
});
define({
  method: 'GET', path: '/direct-bill/policies', summary: 'Unbilled direct-bill commission, insurer-wise (insurerCode, from / to booking date, productLine, search) with commission, VAT, total due and expected EWT',
  screen: S('Direct Bill Processing'), middleware: read, query: { insurerCode: 'MALAYAN', from: '2026-09-01', to: '2026-09-30', productLine: 'MOTOR' },
  response: { success: true, data: [itemExample], summary: { count: 1, grossPremium: 30000, commission: 4500, vat: 540, totalDue: 5040, expectedEwt: 450, netReceivable: 4590, ewtRate: 0.1 } },
  handler: async (req, res) => {
    const r = await directBill.unbilledItems(req.query);
    ok(res, r.data, 'OK', { summary: r.summary });
  },
});
define({
  method: 'GET', path: '/direct-bill', summary: 'Commission debit notes (insurerCode, status code or label, from / to, search, attention=mine: my drafts and the notes overdue with a balance; paging), each with the caller\'s decision block (canDecide, blockedCode MAKER / SUBMITTER / NO_PERMISSION / WRONG_STATUS, blockedReason)', screen: S('Direct Bill Processing > Debit Notes'), middleware: read,
  query: { status: 'Open,Partially Collected', insurerCode: 'MALAYAN', page: 1, perPage: 20 }, response: { success: true, data: [dnExample] },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total, summary } = await directBill.listDebitNotes({ ...req.query, userId: req.user.id }, pg);
    const out = [];
    for (const dn of rows) out.push(await directBill.withDecision(dn, req.user));
    sendList(res, out, total, pg, { summary });
  },
});
define({
  method: 'POST', path: '/direct-bill', summary: 'Raise a commission debit note to an insurer for unbilled direct-bill commission (itemIds / policyIds, else all of the period); submit=true sends it for approval',
  screen: S('Direct Bill Processing > Raise Debit Note'), middleware: write,
  request: { insurerCode: 'MALAYAN', periodFrom: '2026-09-01', periodTo: '2026-09-30', dnDate: '2026-09-30', itemIds: ['dbi_1'], remarks: 'September 2026 placements', submit: true },
  response: { success: true, data: { ...dnExample, lines: [] } },
  handler: async (req, res) => {
    const r = await directBill.raiseDebitNote(req.body || {}, req.user);
    await audit(req, { entity: 'commission_debit_note', entityId: r.id, action: 'create', after: r });
    created(res, r, `Debit note ${r.dnNumber} ${r.statusCode === 'for-approval' ? 'raised and submitted for approval' : 'saved as draft'}`);
  },
});
define({
  method: 'POST', path: '/direct-bill/billing-mode', summary: 'Change the billing mode of an issued policy (broker billed or direct bill): refused once premium is collected or remitted, or the commission is on a debit note',
  screen: S('Direct Bill Processing > Billing Mode'), middleware: write, request: { policyNumber: 'POL-2026-00001', billingMode: 'direct', reason: 'Client pays Malayan directly' },
  response: { success: true, data: { policyNumber: 'POL-2026-00001', before: 'Broker billed', billingMode: 'direct', billingModeLabel: 'Direct bill', directBill: { items: 1, commissionDue: 5040, unbilled: 5040, collected: 0 } } },
  handler: async (req, res) => {
    const b = req.body || {};
    if (!b.policyId && !b.policyNumber) throw badRequest('Validation failed', [{ path: 'policyNumber', message: 'policyNumber is required' }]);
    const r = await directBill.changeBillingMode(b.policyId || b.policyNumber, b.billingMode, req.user, { reason: b.reason });
    await audit(req, { entity: 'policy', entityId: r.policyId, action: 'change-billing-mode', before: { billingMode: r.before }, after: r });
    ok(res, r, `${r.policyNumber} is now ${r.billingModeLabel.toLowerCase()}`);
  },
});
// client's payment to the insurer on direct-bill policies (recorded only; nothing is posted)
const paymentExample = { id: 1, policyId: 'pol_1', policyNo: 'POL-2026-00001', paymentDate: '2026-09-20', amount: 125250, insurerReference: 'MIC-OR-778812', paymentMode: 'bank-transfer',
  proofKey: '/api/s3/object/direct-bill-payments/or-778812.pdf', proofFileName: 'or-778812.pdf', status: 'recorded' };
define({
  method: 'GET', path: '/direct-bill/client-payments', summary: 'Client payments to insurers recorded on direct-bill policies (insurerCode, from / to payment date, status recorded | voided | all, search)',
  screen: S('Direct Bill Processing'), middleware: read, query: { insurerCode: 'MALAYAN', from: '2026-09-01', to: '2026-09-30' }, response: { success: true, data: [paymentExample] },
  handler: async (req, res) => ok(res, await clientPayments.listClientPayments(pool, req.query)),
});
define({
  method: 'GET', path: '/direct-bill/policies/:policyId/client-payments', summary: 'Payments the client made to the insurer on a direct-bill policy, with its payment status (Unpaid, Partially paid, Paid)',
  screen: S('Direct Bill Processing > Client payment'), middleware: read,
  response: { success: true, data: { policyId: 'pol_1', policyNo: 'POL-2026-00001', premium: 125250, paid: 125250, balance: 0, status: 'paid', statusLabel: 'Paid', items: [paymentExample] } },
  handler: async (req, res) => ok(res, await clientPayments.policyClientPayments(pool, req.params.policyId)),
});
define({
  method: 'POST', path: '/direct-bill/policies/:policyId/client-payments', summary: 'Record the client\'s payment to the insurer on a direct-bill policy (date, amount, insurer OR / reference, proof); no journal is posted',
  screen: S('Direct Bill Processing > Client payment'), middleware: write,
  request: { paymentDate: '2026-09-20', amount: 125250, insurerReference: 'MIC-OR-778812', paymentMode: 'bank-transfer', proofKey: '/api/s3/object/direct-bill-payments/or-778812.pdf', proofFileName: 'or-778812.pdf' },
  response: { success: true, data: paymentExample },
  handler: async (req, res) => {
    const r = await withTransaction((db) => clientPayments.recordClientPayment(db, req.params.policyId, req.body || {}, req.user));
    await audit(req, { entity: 'direct_bill_client_payment', entityId: r.id, action: 'create', after: r });
    created(res, r, `Payment ${r.insurerReference} recorded on ${r.policyNo}`);
  },
});
define({
  method: 'POST', path: '/direct-bill/client-payments/:paymentId/void', summary: 'Void a client payment recorded in error (reason required)', screen: S('Direct Bill Processing > Client payment'), middleware: write,
  request: { reason: 'Recorded on the wrong policy' }, response: { success: true, data: { ...paymentExample, status: 'voided' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => clientPayments.voidClientPayment(db, req.params.paymentId, req.body?.reason, req.user));
    await audit(req, { entity: 'direct_bill_client_payment', entityId: r.after.id, action: 'void', before: r.before, after: r.after });
    ok(res, r.after, `Payment ${r.after.insurerReference} voided`);
  },
});
define({
  method: 'GET', path: '/direct-bill/:id', summary: 'One commission debit note with its policy lines, collections and the caller\'s decision block (Approve and Reject only when canDecide; otherwise the reason)',
  screen: S('Direct Bill Processing > Debit Notes > View'), middleware: read,
  response: { success: true, data: { ...dnExample, lines: [], collections: [], decision: { canDecide: false, blockedCode: 'MAKER', blockedReason: 'You raised DN-2026-00001. Another user must approve it.' } } },
  handler: async (req, res) => ok(res, await directBill.withDecision(await directBill.getDebitNote(req.params.id), req.user)),
});
define({
  method: 'GET', path: '/direct-bill/:id/pdf', summary: 'Printable commission debit note (PDF, broker letterhead; download=1 for an attachment)', screen: S('Direct Bill Processing > Debit Notes > Print'), middleware: read,
  query: { download: 1 }, response: 'application/pdf',
  handler: async (req, res) => {
    const dn = await directBill.getDebitNote(req.params.id);
    sendPdf(res, buildPdf(await commissionDebitNoteDoc(dn, dn.lines)), `debit-note-${dn.dnNumber}.pdf`, req.query.download ? 'attachment' : 'inline');
  },
});
define({
  method: 'GET', path: '/direct-bill/:id/export', summary: 'A billing statement with its schedule as Excel or CSV (format=xlsx | csv): particulars per product line (Gross Amount, VAT, Net of VAT, EWT, Net Amount Payable) and the policy lines',
  screen: S('Insurer billing > Billing statement > Export'), middleware: read, query: { format: 'xlsx' }, response: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  handler: async (req, res) => {
    const dn = await directBill.getDebitNote(req.params.id);
    const fmt = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const cols = ['Line', 'Policy', 'Insured', 'Remittance', 'Premium', 'Commission (Net of VAT)', 'VAT', 'Gross Amount', 'EWT', 'Net Amount Payable'];
    const rows = dn.lines.map((l) => [l.lineNo, l.policyNo, l.insuredName, l.remittanceNumber || '', l.grossPremium, l.commission, l.vat, l.amount, l.ewt,
      Math.round((l.amount - l.ewt) * 100) / 100]);
    rows.push(['', 'Total', `${dn.policyCount} booked account/s`, '', dn.grossPremium, dn.commission, dn.vat, dn.amount, dn.expectedEwt, dn.netPayable]);
    await sendTable(res, { header: cols, rows, fileBase: `billing-statement-${dn.dnNumber}`, format: fmt, sheetName: dn.dnNumber });
  },
});
define({
  method: 'GET', path: '/billing-runs', summary: 'Insurer billing runs (newest first) and the next billing dates (insurer_billing.run_days moved off non-working days)', screen: S('Insurer billing > Billing run'),
  middleware: read, response: { success: true, data: { nextBillingDates: ['2026-10-26', '2026-11-13'], runs: [{ id: 3, billingDate: '2026-10-15', trigger: 'job', statements: 2, result: 'success',
    message: 'Billing run done: 2 billing statement(s) drafted.' }] } },
  handler: async (_req, res) => ok(res, await billing.billingRuns()),
});
define({
  method: 'POST', path: '/billing-runs', summary: 'Run the insurer billing now for a billing date (default today, not in the future) and optionally one insurer: drafts the billing statements of the remittances approved before that date and not yet billed',
  screen: S('Insurer billing > Billing run'), middleware: write, request: { billingDate: '2026-10-15', insurerId: 4 },
  response: { success: true, data: { run: { id: 4, billingDate: '2026-10-15', statements: 1 }, notes: [{ number: 'CBS-2026-00031', insurer: 'Malayan Insurance Co., Inc.', productLine: 'Motor', basis: 'net', amount: 26905.2 }] },
    message: 'Billing run done: 1 billing statement(s) drafted.' },
  handler: async (req, res) => {
    const r = await billing.runBilling({ billingDate: req.body?.billingDate, insurerId: req.body?.insurerId, trigger: 'user', user: req.user });
    await audit(req, { entity: 'insurer_billing', entityId: String(r.run.id), action: 'run', after: { billingDate: r.run.billingDate, statements: r.notes.map((n) => n.number), message: r.message } });
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/direct-bill/:id/submit', summary: 'Submit a draft debit note for approval', screen: S('Direct Bill Processing > Debit Notes'), middleware: write,
  response: { success: true, data: { ...dnExample } },
  handler: async (req, res) => ok(res, (await logged('commission_debit_note', 'submit', (r) => directBill.submitDebitNote(r.params.id, r.user))(req, res)).after, 'Debit note submitted for approval'),
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/direct-bill/:id/${action}`,
    summary: `${action === 'approve' ? 'Approve (opens it for sending and collection; a net-basis billing statement is settled by retention)' : 'Reject (a billing_reject reasonCode with its note, or a reason; its commission becomes unbilled again)'} a debit note (write:remittance) or billing statement (approve:insurer-billing, insurer TIN required); maker-checker: not the maker`,
    screen: S('Direct Bill Processing > Debit Notes'), middleware: [requireAuth, requirePermission('write:remittance', 'approve:insurer-billing')],
    request: action === 'approve' ? { remarks: 'Checked against the placements' } : { reasonCode: 'BRJ-AMOUNT', note: 'Wrong period' },
    response: { success: true, data: { ...dnExample, status: action === 'approve' ? 'Open' : 'Rejected' } },
    handler: async (req, res) => ok(res, (await logged('commission_debit_note', action, (r) => directBill.decideDebitNote(r.params.id, action, r.body || {}, r.user))(req, res)).after,
      `Debit note ${action === 'approve' ? 'approved' : 'rejected'}`),
  });
}
define({
  method: 'POST', path: '/direct-bill/:id/cancel', summary: 'Cancel a debit note without collections (a billing_cancel reasonCode with its note, or a reason; required once approved); its commission becomes unbilled again', screen: S('Direct Bill Processing > Debit Notes'), middleware: write,
  request: { reasonCode: 'BCN-INSURER', note: 'Raised to the wrong insurer' }, response: { success: true, data: { ...dnExample, status: 'Cancelled' } },
  handler: async (req, res) => ok(res, (await logged('commission_debit_note', 'cancel', (r) => directBill.cancelDebitNote(r.params.id, r.body || {}, r.user))(req, res)).after, 'Debit note cancelled'),
});
define({
  method: 'POST', path: '/direct-bill/:id/send', summary: 'E-mail an approved debit note to the insurer (direct_bill.email_subject / email_body)', screen: S('Direct Bill Processing > Debit Notes'), middleware: write,
  request: { email: 'billing@malayan.example' }, response: { success: true, data: { ...dnExample, sentTo: 'billing@malayan.example' } },
  handler: async (req, res) => ok(res, await logged('commission_debit_note', 'send', (r) => directBill.sendDebitNote(r.params.id, r.body || {}, r.user))(req, res), 'Debit note sent'),
});
define({
  method: 'POST', path: '/direct-bill/:id/collections', summary: 'Record a payment from the insurer (partial allowed): Dr Cash in Bank + Dr Creditable Withholding Tax / Cr Commission Receivable',
  screen: S('Direct Bill Processing > Debit Notes > Collect'), middleware: write,
  request: { receivedDate: '2026-10-15', cashAmount: 6885, ewtAmount: 675, paymentMode: 'bank-transfer', referenceNo: 'MAL-OR-55812', form2307No: '2307-2026-0091' },
  response: { success: true, data: { ...dnExample, status: 'Collected', statusCode: 'collected', collectedCash: 6885, collectedEwt: 675, balance: 0, collection: { collectionNumber: 'DNC-2026-00001' } } },
  handler: async (req, res) => {
    const r = await directBill.collectDebitNote(req.params.id, req.body || {}, req.user);
    await audit(req, { entity: 'commission_debit_note', entityId: r.id, action: 'collect', after: { collection: r.collection, balance: r.balance, status: r.status } });
    created(res, r, `Collection ${r.collection.collectionNumber} posted; ${r.dnNumber} is ${r.status.toLowerCase()}`);
  },
});
define({
  method: 'POST', path: '/direct-bill/:id/collections/:collectionId/reverse', summary: 'Reverse a collection entered in error (reversing journal; balance restored)', screen: S('Direct Bill Processing > Debit Notes'), middleware: write,
  request: { reason: 'Keyed against the wrong debit note' }, response: { success: true, data: { ...dnExample } },
  handler: async (req, res) => {
    const r = await directBill.reverseCollection(req.params.id, req.params.collectionId, req.body || {}, req.user);
    await audit(req, { entity: 'commission_debit_note', entityId: r.id, action: 'reverse-collection', after: { collectionId: req.params.collectionId, reason: req.body?.reason || null } });
    ok(res, r, 'Collection reversed');
  },
});

// ---------------- agency bill ----------------
define({
  method: 'GET', path: '/agency-bill/agencies', summary: 'Agencies / agents with production, previous balance and total due for a bill period', screen: S('Agency Bill Processing'), middleware: read,
  query: { billPeriod: '2026-09' }, response: { success: true, data: [{ agencyCode: 'AG001', agencyName: 'Juan Dela Cruz', agencyType: 'Agent', policyCount: 5, grossPremium: 75000, commission: 11250, previousBalance: 0, totalDue: 63750 }] },
  handler: async (req, res) => ok(res, await svc.agencies(req.query)),
});
define({
  method: 'POST', path: '/agency-bill/generate', summary: 'Generate agency bills for the selected agencies', screen: S('Agency Bill Processing > Generate Bills'), middleware: write,
  request: { billPeriod: '2026-09', billRunDate: '2026-09-28', agencyCodes: ['AG001'], dueDays: 30 },
  response: { success: true, data: { agencyBills: [{ agencyCode: 'AG001', agencyName: 'Juan Dela Cruz', billNumber: 'BIL-2026-00002', billDate: '2026-09-28', dueDate: '2026-10-28', billAmount: 63750, status: 'Generated' }], skipped: [] } },
  handler: async (req, res) => {
    const r = await svc.generateAgencyBills(req.body || {}, req.user);
    for (const b of r.agencyBills) await audit(req, { entity: 'remittance', entityId: b.id, action: 'create-agency-bill', after: b });
    created(res, r, `${r.agencyBills.length} agency bill(s) generated`);
  },
});
define({
  method: 'GET', path: '/agency-bill', summary: 'Agency bills (outstanding and paid)', screen: S('Agency Bill Processing'), middleware: read,
  response: { success: true, data: [{ ...rem, billNumber: 'BIL-2026-00002', agencyCode: 'AG001', billAmount: 63750 }] },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total } = await svc.listRemittances({ ...req.query, kind: 'agency-bill' }, pg);
    sendList(res, rows, total, pg);
  },
});
define({
  method: 'POST', path: '/bills/:id/send', summary: 'Send an agency bill or insurer remittance statement (queues an e-mail to the agent or insurer)', screen: S('Agency Bill Processing'), middleware: write,
  request: { deliveryMethod: ['email'], email: 'billing@example.com' }, response: { success: true, data: { billStatus: 'Sent' } },
  handler: async (req, res) => ok(res, await logged('remittance', 'send-bill', (r) => svc.sendBill(r.params.id, r.body || {}, r.user))(req, res), 'Bill sent'),
});

// ---------------- approvals ----------------
const decisionExample = { canDecide: false, blockedCode: 'SUBMITTER', blockedReason: 'You submitted this remittance. Another user with remittance authority must approve it.',
  level: { current: 1, required: 1 }, amount: 409141.43, myLimit: null, unlimited: false, limitSource: null, limitSourceLabel: null,
  eligibleApprovers: [{ id: 'usr_9', name: 'J. Cruz', role: 'TIS Finance & General Accounting', limit: 1000000, limitSourceLabel: 'Role limit: TIS Finance & General Accounting', coveringFor: null }] };
const inboxRow = { id: 21, version: 1, type: 'remittance', typeLabel: 'Remittance', reference: 'REM-2026-00021', entity: 'remittance', entityId: 'rm_21', recordLink: '/finance/remittance/remittances/rm_21',
  insurer: { id: 3, name: 'Pioneer Insurance' }, productLine: 'Motor', amount: 409141.43, submittedBy: { id: 'usr_4', name: 'M. Reyes' }, submittedAt: '2026-10-06T02:12:00.000Z',
  status: 'Pending', statusLabel: 'Pending Approval', level: { current: 1, required: 1, label: '1 of 1' },
  sla: { hours: 24, dueAt: '2026-10-07T02:12:00.000Z', ageHours: 6.5, overdue: false, label: 'Due in 18 h' }, decision: decisionExample,
  nextStep: { code: 'approve', label: 'Awaiting remittance approver: J. Cruz', actor: { type: 'user', id: 'usr_9', name: 'J. Cruz' }, dueAt: '2026-10-07T02:12:00.000Z' },
  reminder: { remindedAt: null, nextAt: null, allowed: true }, outcome: null,
  actions: [{ code: 'view', label: 'View', allowed: true }, { code: 'approve', label: 'Approve', allowed: false, blockedCode: 'SUBMITTER' }, { code: 'remind', label: 'Remind approver', allowed: true }] };
define({
  method: 'GET', path: '/approvals',
  summary: 'Approvals. With view=mine|submitted|all|decided (type=remittance|settlement|adjustment|transfer, insurerId, q, page, perPage): the inbox rows with the decision block, next step, SLA and level, server totals, the KPI figures (awaiting my decision, past SLA, submitted by me, decided by me today in the business time zone) and the authority chips (limit and its source, the people covered for through a dated delegation and until when); decided covers the last 30 days. Without view: the legacy queue (status=Pending by default; filter transactionType, priority)',
  screen: `${S('Approvals')}; ${S('Approval')}`, middleware: read,
  query: { view: 'mine', type: 'remittance', insurerId: 3, q: 'REM-2026', page: 1, perPage: 50 },
  response: { success: true, data: [inboxRow], total: 1, page: 1, perPage: 50, totalPages: 1, view: 'mine', totals: { count: 1, amount: 409141.43 },
    kpis: { awaitingMine: { count: 1, amount: 409141.43 }, pastSla: { count: 0, oldestHours: 0 }, submittedByMe: { count: 0 }, decidedByMeToday: { count: 2, approved: 2, rejected: 0 } },
    authority: { permission: true, canDecide: true, limit: 1000000, unlimited: false, limitSourceLabel: 'Delegation from A. Santos (Role limit: TIS Finance & General Accounting)',
      covering: [{ name: 'A. Santos', until: '2026-10-16' }] } },
  handler: async (req, res) => {
    if (!req.query.view) return ok(res, await svc.listApprovals(req.query));
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const r = await approvals.approvalInbox(req.query, req.user, pg);
    return sendList(res, r.rows, r.total, pg, { view: r.view, totals: r.totals, kpis: r.kpis, authority: r.authority });
  },
});
define({
  method: 'GET', path: '/approvals/export.xlsx',
  summary: 'Approvals > Export XLSX: every row of the view and filters of GET /approvals (not one page), with "Can I decide?", the next step and, on Decided, the decision, reason and limit at decision',
  screen: S('Approvals > Export XLSX'), middleware: read, query: { view: 'all', type: 'remittance', insurerId: 3 }, response: '(xlsx file)',
  handler: async (req, res) => {
    const r = await approvals.approvalExport(req.query, req.user);
    return sendTable(res, { header: approvals.EXPORT_HEADER, rows: r.rows, fileBase: `approvals-${r.view}`, format: 'xlsx', sheetName: 'Approvals' });
  },
});
define({
  method: 'POST', path: '/approvals/decide',
  summary: 'Approve or reject several approvals, each decided on its own with the version it was shown (approve:remittance); per-item results: Approved / Rejected, or the refusal code and text (ALREADY_DECIDED "Already approved by J. Cruz at 10:32", STALE, ABOVE_LIMIT ...). A rejection needs a remittance_reject reasonCode',
  screen: S('Approvals > Approve selected'), middleware: approve,
  request: { items: [{ id: 21, version: 1 }, { id: 22, version: 1 }], action: 'approve', note: 'Checked against the statement' },
  response: { success: true, data: { action: 'approve', decided: 1, refused: 1, results: [{ id: 21, reference: 'REM-2026-00021', ok: true, status: 'Approved', message: 'Approved' },
    { id: 22, ok: false, code: 'ALREADY_DECIDED', message: 'Already approved by J. Cruz at 10:32.' }] } },
  handler: async (req, res) => ok(res, await approvals.decideMany(req.body || {}, req.user, req)),
});
define({
  method: 'GET', path: '/approvals/approvers', summary: 'Users who may take over a remittance approval (active, hold approve:remittance or an administrator role; not the caller), for the delegation drop-down',
  screen: S('Approval > Delegate'), middleware: read,
  response: { success: true, data: [{ userId: 'usr_1', username: 'fe.approver', displayName: 'Fe Approver' }] },
  handler: async (req, res) => ok(res, await svc.approvers(req.user)),
});
define({
  method: 'GET', path: '/approvals/history', summary: 'Approval actions (approved / rejected / delegated)', screen: S('Approval > History'), middleware: read,
  response: { success: true, data: [{ referenceNo: 'TRF-2026-00001', transactionType: 'Electronic Transfer', amount: 156000, action: 'Approved', actionDate: '2026-09-20 15:30', remarks: 'Verified' }] },
  handler: async (_req, res) => ok(res, await svc.approvalHistory()),
});
define({
  method: 'GET', path: '/approvals/:id',
  summary: 'Review panel of one approval (id, or remittance:<id>): the inbox row with the decision block, the record header, totals and first 10 lines, the previous remittance of the insurer with the change in %, the checks (content unchanged since submission; accounting period open, as information), open exceptions and the latest activity',
  screen: S('Approvals > Review'), middleware: read,
  response: { success: true, data: { ...inboxRow, record: { id: 'rm_21', remittanceNo: 'REM-2026-00021', statusLabel: 'Pending Approval', insurer: { id: 3, name: 'Pioneer Insurance' }, version: 3 },
    totals: { policies: 12, premium: 520000, commission: 98000, tax: 12858.57, adjustments: 0, dueToInsurer: 409141.43 },
    lines: [{ policyNo: 'POL-2026-95021', client: 'J. Santos', premium: 64159.68, dueToInsurer: 40857.86 }], lineCount: 12,
    previous: { id: 'rm_17', remittanceNo: 'REM-2026-00017', amount: 371210, changePercent: 10.22 },
    checks: [{ code: 'content-unchanged', label: 'Content unchanged since submission', result: 'pass', detail: 'v3 · unchanged since submission' },
      { code: 'period-open', label: 'Accounting period Oct 2026', result: 'pass', detail: 'Open' }],
    exceptions: { count: 0, items: [] }, activity: [activity] } },
  handler: async (req, res) => ok(res, await approvals.approvalSummary(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/approvals/:id/remind',
  summary: 'Remind the eligible approvers of a pending approval (its submitter; at most once per remittance.reminder_interval_hours, 409 REMINDED "Reminded 10:15 · next from 14:15"; 409 NO_ELIGIBLE_APPROVER)',
  screen: S('Approvals > Remind approver'), middleware: write,
  response: { success: true, data: { id: 21, sentTo: [{ id: 'usr_9', name: 'J. Cruz' }], remindedAt: '2026-10-06T02:15:00.000Z', nextReminderAt: '2026-10-06T06:15:00.000Z', message: 'Reminder sent to J. Cruz.' } },
  handler: async (req, res) => {
    const r = await approvals.remindApprovers(req.params.id, req.user, req);
    ok(res, r, r.message);
  },
});
for (const action of ['approve', 'reject', 'delegate']) {
  define({
    method: 'POST', path: `/approvals/:id/${action}`,
    summary: action === 'delegate' ? 'Hand a pending approval to another approver (approve:remittance; 409 while remittance.item_delegation_enabled is off)'
      : `${action[0].toUpperCase()}${action.slice(1)} an approval (approve:remittance; refused with errors[0].code SUBMITTER, MAKER, EARLIER_LEVEL, ABOVE_LIMIT, NO_AUTHORITY, DELEGATED_AWAY (403) or ALREADY_DECIDED, STALE (409); a rejection needs a remittance_reject reasonCode)`,
    screen: S('Approval'), middleware: approve,
    request: action === 'delegate' ? { delegateTo: 'finance.head', comments: 'On leave' } : action === 'approve' ? { comments: 'Verified', version: 1 } : { reasonCode: 'RRJ-OTHER', note: 'Missing documents', version: 1 },
    response: { success: true, data: { id: 1, status: action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Pending' } },
    handler: async (req, res) => {
      const { after } = await svc.decide(req.params.id, action, req.body || {}, req.user, { req, version: req.body?.version ?? null });
      ok(res, after, `Approval ${action === 'delegate' ? 'delegated' : after.status === 'Pending' ? 'recorded; next level pending' : after.status.toLowerCase()}`);
    },
  });
}
// ---------------- refunds due from insurers ----------------
define({
  method: 'GET', path: '/insurer-credits', summary: 'Refunds due from insurers (return premium on premium already remitted); open credits are netted against the next premium remittance voucher to the insurer',
  screen: `${S('Settlement')}; ${S('Tracking')}`, middleware: read, query: { insurer: 'MALAYAN', status: 'open' },
  response: { success: true, data: { openBalance: 970, items: [{ id: 1, insurer: 'Malayan Insurance Co., Inc.', policyNumber: 'POL-2026-00001', reference: 'END-2026-00003', kind: 'return-premium', amount: 970, balance: 970, status: 'open' }] } },
  handler: async (req, res) => {
    const { pool } = await import('../../db/pool.js');
    const { listInsurerCredits } = await import('./insurerCredits.js');
    ok(res, await listInsurerCredits(pool, { insurer: req.query.insurer || req.query.insurerCode || req.query.insurerId || null, status: ['open', 'applied', 'all'].includes(req.query.status) ? req.query.status : 'open' }));
  },
});

// ---------------- settlements ----------------
define({
  method: 'GET', path: '/settlements/available-policies', summary: 'Policy lines of approved remittances available for settlement with an insurer', screen: S('Settlement'), middleware: read,
  query: { insurerCode: 'MALAYAN' }, response: { success: true, data: [{ id: 1, remittanceNo: 'REM-2026-00001', policyNo: 'POL-2026-00001', insuredName: 'Juan Dela Cruz', premium: 15000, commissionRate: 15, commission: 2250, tax: 0, netAmount: 12750 }] },
  handler: async (req, res) => ok(res, await items.availableLines(req.query.insurerCode ?? req.query.insurerId)),
});
define({
  method: 'POST', path: '/settlements/calculate', summary: 'Settlement totals (premium - commission - tax + previous balance + credit notes - debit notes + other adjustments)', screen: S('Settlement > Calculate'), middleware: read,
  request: { lineIds: [1, 2], adjustments: { previousBalance: 0, creditNotes: 500, debitNotes: 0, otherAdjustments: 0 } },
  response: { success: true, data: { totalPremium: 30000, totalCommission: 4500, totalTax: 0, totalAdjustments: 500, netAmount: 26000 } },
  handler: async (req, res) => ok(res, await items.calculateSettlement(req.body || {})),
});
define({
  method: 'GET', path: '/settlements', summary: 'Settlements (status filter)', screen: S('Settlement'), middleware: read, query: { status: 'Pending Approval' },
  response: { success: true, data: [{ id: 'rmi_1', settlementNo: 'SET-2026-00001', insurerName: 'Malayan Insurance Co., Inc.', netAmount: 26000, status: 'Draft' }] },
  handler: async (req, res) => listOf(req, res, 'settlement'),
});
define({
  method: 'GET', path: '/settlements/:id', summary: 'One settlement with its policies and totals', screen: S('Settlement'), middleware: read, response: { success: true, data: { settlementNo: 'SET-2026-00001' } },
  handler: async (req, res) => ok(res, items.itemOut(await items.getItem('settlement', req.params.id))),
});
define({
  method: 'POST', path: '/settlements', summary: 'Save a settlement draft (submit=true also submits it for approval)', screen: S('Settlement > Save Draft / Submit'), middleware: write,
  request: { insurerCode: 'MALAYAN', settlementType: 'Regular', settlementPeriod: ['2026-09-01', '2026-09-30'], lineIds: [1, 2], creditNotes: 500, paymentMethod: 'bank_transfer', bankAccount: 'ACC-BDO-001', submit: false },
  response: { success: true, data: { settlementNo: 'SET-2026-00001', status: 'Draft', netAmount: 26000 } },
  handler: async (req, res) => {
    const s = await items.createSettlement(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_item', entityId: s.id, action: 'create-settlement', after: s });
    created(res, s, s.status === 'Draft' ? 'Settlement draft saved' : 'Settlement submitted for approval');
  },
});
define({
  method: 'PUT', path: '/settlements/:id', summary: 'Update a draft / rejected settlement', screen: S('Settlement'), middleware: write, request: { lineIds: [1], otherAdjustments: -250 },
  response: { success: true, data: { status: 'Draft' } },
  handler: async (req, res) => ok(res, (await logged('remittance_item', 'update-settlement', (r) => items.updateSettlement(r.params.id, r.body || {}, r.user))(req, res)).after, 'Settlement updated'),
});
define({
  method: 'POST', path: '/settlements/:id/submit', summary: 'Submit a settlement for approval', screen: S('Settlement > Submit For Approval'), middleware: write,
  request: { paymentMethod: 'bank_transfer', bankAccount: 'ACC-BDO-001' }, response: { success: true, data: { status: 'Pending Approval' } },
  handler: async (req, res) => ok(res, await logged('remittance_item', 'submit-settlement', (r) => items.submitSettlement(r.params.id, r.body || {}, r.user))(req, res), 'Settlement submitted for approval'),
});

// ---------------- adjustments ----------------
define({
  method: 'GET', path: '/adjustments', summary: 'Adjustments (status filter: Pending Approval, Approved, Completed, Rejected)', screen: S('Adjustments'), middleware: read,
  response: { success: true, data: [{ id: 'rmi_2', referenceNo: 'ADJ-2026-00001', adjustmentType: 'Premium Adjustment', policyNo: 'POL-2026-00001', originalAmount: 125000, adjustmentAmount: -5000, newAmount: 120000, status: 'Pending Approval' }] },
  handler: async (req, res) => listOf(req, res, 'adjustment'),
});
define({
  method: 'GET', path: '/adjustments/history', summary: 'Processed adjustments', screen: S('Adjustments > History'), middleware: read,
  response: { success: true, data: [{ referenceNo: 'ADJ-2026-00001', adjustmentType: 'Tax Adjustment', amount: 1500, status: 'Completed', processedDate: '2026-09-20 15:30', processedBy: 'Finance Team' }] },
  handler: async (req, res) => listOf({ ...req, query: { ...req.query, status: req.query.status || 'Approved,Completed,Rejected' } }, res, 'adjustment', items.adjustmentHistoryOut),
});
define({
  method: 'POST', path: '/adjustments', summary: 'New adjustment (type from the adjustment-type master; approval when the type requires it)', screen: S('Adjustments > New Adjustment'), middleware: write,
  request: { referenceNo: 'ADJ-MEMO-0091', adjustmentType: 'Premium Adjustment', adjustmentAmount: -5000, effectiveDate: '2026-09-30', description: 'Coverage change', reason: 'Policy correction', policyNo: 'POL-2026-00001', remittanceNo: 'REM-2026-00001' },
  response: { success: true, data: { referenceNo: 'ADJ-MEMO-0091', status: 'Pending Approval' } },
  handler: async (req, res) => {
    const a = await items.createAdjustment(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_item', entityId: a.id, action: 'create-adjustment', after: a });
    created(res, a, 'Adjustment created');
  },
});
define({
  method: 'POST', path: '/adjustments/:id/complete', summary: 'Mark an approved adjustment as processed', screen: S('Adjustments'), middleware: write, response: { success: true, data: { status: 'Completed' } },
  handler: async (req, res) => ok(res, (await logged('remittance_item', 'complete-adjustment', (r) => items.completeItem('adjustment', r.params.id, ['Approved'], 'Completed', { processedDate: new Date().toISOString() }, r.user))(req, res)).after, 'Adjustment completed'),
});

// ---------------- insurer payments ----------------
// A read model of the insurer vouchers with their batch or cheque (payments.js); it pays and posts nothing.
// the payment vouchers, payees and their bank accounts belong to Disbursement: read:remittance alone does not open them
const readPayments = [requireAuth, requirePermission('read:disbursements', 'write:disbursements')];
const payRow = { id: 'pv_102', voucherNo: 'PV-2026-00102', voucherStatus: 'for-approval', voucherStatusLabel: 'Submitted', state: 'to-pay', stateLabel: 'To pay', amount: 409141.43, currency: 'PHP',
  insurer: { id: 3, code: 'PIONEER', name: 'Pioneer Insurance & Surety Corp.', shortName: 'Pioneer' },
  remittance: { id: 'rm_21', remittanceNo: 'REM-2026-00021', dueToInsurer: 409141.43, link: '/finance/remittance/remittances/rm_21' }, remittances: [], settlement: { id: 'rmi_5', reference: 'SET-2026-00005' },
  payee: { bank: { code: 'MBT', name: 'Metropolitan Bank and Trust Company' }, accountMasked: '···4821', accountName: 'Pioneer Insurance & Surety Corp.', label: 'Metropolitan Bank and Trust Company ···4821',
    chip: { code: 'on-file', label: 'On file' } },
  method: null, batch: null, cheque: null, valueDate: '2026-10-12', bankReference: null, paidOn: null, failureReason: null,
  nextStep: { code: 'create-batch', label: 'Create batch', actor: { type: 'permission', name: 'Bank Payment Files' } }, selectable: true,
  actions: [{ code: 'view', label: 'View payment', allowed: true, link: '/finance/remittance/payments?payment=PV-2026-00102' }, { code: 'open-remittance', label: 'Open remittance', allowed: true, link: '/finance/remittance/remittances/rm_21' },
    { code: 'pay-by-cheque', label: 'Pay by cheque', allowed: true, link: '/accounts/paymentvoucher/detailview/pv_102' }],
  link: '/finance/remittance/payments?payment=PV-2026-00102', voucherLink: '/accounts/paymentvoucher/detailview/pv_102' };
const batchingExample = { allowed: false, code: 'NO_LAYOUT', reason: payments.NO_LAYOUT, bankCode: 'MBT', layout: null, chequeAllowed: true };
define({
  method: 'GET', path: '/payments',
  summary: 'Insurer payments (read:remittance or read:disbursements): the payment vouchers of insurer remittances with segment=to-pay|in-payment|paid|failed|all (a draft voucher is To pay, next step "Submit voucher (Disbursement)"), insurerId, from / to (value date), method fund-transfer|cheque, q (PV, REM, batch or bank ref.), paging: rows with state, masked payee account, method, batch, next step, selectable and actions; totals of the filtered set, the 4 KPI figures and segment counts over the filters, batching { allowed, code, reason } (NO_LAYOUT "No Metrobank layout configured. Pay by cheque or ask the administrator.", NO_PERMISSION) and the count of legacy transfers',
  screen: S('Insurer payments'), middleware: readPayments, query: { segment: 'to-pay', insurerId: 3, from: '2026-10-01', to: '2026-10-31', method: 'fund-transfer', q: 'PV-2026', page: 1, perPage: 50 },
  response: { success: true, data: [payRow], total: 1, page: 1, perPage: 50, totalPages: 1, segment: 'to-pay', totals: { count: 1, amount: 409141.43 },
    kpis: { toPay: { count: 1, amount: 409141.43 }, inPayment: { count: 0, amount: 0 }, paidThisWeek: { count: 0, amount: 0 }, failed: { count: 0, amount: 0 } },
    segments: { 'to-pay': 1, 'in-payment': 0, paid: 0, failed: 0, all: 1 }, batching: batchingExample, legacyTransfers: 4 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const r = await payments.paymentList(req.query, req.user, pg);
    sendList(res, r.rows, r.total, pg, { segment: r.segment, totals: r.totals, kpis: r.kpis, segments: r.segments, batching: r.batching, legacyTransfers: r.legacyTransfers });
  },
});
define({
  method: 'GET', path: '/payments/export.xlsx',
  summary: 'Insurer payments > Export XLSX: every payment of the segment and filters of GET /payments (not one page), with the payee account chip, batch, value date, bank reference, paid on, state and next step',
  screen: S('Insurer payments > Export XLSX'), middleware: readPayments, query: { segment: 'all', insurerId: 3 }, response: '(xlsx file)',
  handler: async (req, res) => {
    const r = await payments.paymentExport(req.query, req.user);
    return sendTable(res, { header: payments.EXPORT_HEADER, rows: r.rows, fileBase: `insurer-payments-${r.segment}`, format: 'xlsx', sheetName: 'Insurer payments' });
  },
});
define({
  method: 'GET', path: '/payments/:voucherId',
  summary: 'Payment record (voucher id or no.): the row with the sections Payee (masked account, canReveal), Payment (method, value date, debit account, bank reference, paid on, failure reason), Amounts (due to insurer, refund credits netted, voucher and bank amount, check Pass / Difference), Links (remittances and schedules, voucher, batch, bank file, status file, cheque, journal), Approvals (remittance approvals with limit, voucher maker, batch created / approved, file generated, result imported), the timeline and the activity of the voucher, its batch and cheques',
  screen: S('Insurer payments > View payment'), middleware: readPayments,
  response: { success: true, data: { ...payRow, payee: { ...payRow.payee, canReveal: true, verification: payRow.payee.chip },
    payment: { method: null, amount: 409141.43, valueDate: '2026-10-12', debitAccount: null, bankReference: null, paidOn: null, failureReason: null },
    amounts: { dueToInsurer: 409141.43, refundCredits: 0, voucherAmount: 409141.43, bankAmount: null, check: { code: 'pass', label: 'Pass', difference: 0 } },
    links: { remittances: [{ remittanceNo: 'REM-2026-00021', link: '/finance/remittance/remittances/rm_21', schedule: '/remittance/remittances/rm_21/schedule.xlsx' }], voucher: { number: 'PV-2026-00102', link: payRow.voucherLink },
      batch: null, bankFile: null, statusFile: null, cheque: null, journal: null, bankReconciliation: null },
    approvals: { remittances: [{ remittanceNo: 'REM-2026-00021', by: 'J. Cruz', at: '2026-10-12T02:32:00.000Z', limitAtDecision: 1000000, limitSourceLabel: 'Role limit: TIS Finance & General Accounting' }],
      voucherMaker: { name: 'M. Reyes', at: '2026-10-12T03:00:00.000Z' }, batchCreatedBy: null, batchApprovedBy: null, fileGeneratedBy: null, resultImportedBy: null },
    timeline: [{ code: 'voucher-raised', label: 'Voucher raised', done: true, at: '2026-10-12T03:00:00.000Z', by: 'M. Reyes' }], activity: [], batching: batchingExample } },
  handler: async (req, res) => ok(res, await payments.paymentRecord(req.params.voucherId, req.user)),
});
define({
  method: 'GET', path: '/payments/:voucherId/account', summary: 'Show full number: the insurer\'s bank account number of a payment in full (write:disbursements; every reveal is audited)',
  screen: S('Insurer payments > View payment > Show full number'), middleware: [requireAuth, requirePermission('write:disbursements')],
  response: { success: true, data: { voucherId: 'pv_102', voucherNo: 'PV-2026-00102', bank: 'Metropolitan Bank and Trust Company', accountNumber: '0071-5566-4821', accountName: 'Pioneer Insurance & Surety Corp.' } },
  handler: async (req, res) => {
    const a = await payments.paymentAccount(req.params.voucherId);
    await audit(req, { entity: 'payee_bank_account', entityId: a.voucherId, action: 'reveal', after: { voucherId: a.voucherId, voucherNo: a.voucherNo, account: payments.maskAccount(a.accountNumber) } });
    ok(res, a);
  },
});

// ---------------- electronic transfers ----------------
define({
  method: 'GET', path: '/transfers/methods', summary: 'Transfer methods and limits (configuration)', screen: S('Electronic Transfer'), middleware: read,
  response: { success: true, data: [{ label: 'PESONet', value: 'PESONet', limit: 10000000 }] },
  handler: async (_req, res) => ok(res, await items.transferMethods()),
});
define({
  method: 'GET', path: '/transfers',
  summary: 'Electronic transfers (status: Pending, Approved, Completed, Failed, Rejected). legacy=1 (Insurer payments > Legacy transfers, read-only): the TRF- items with the masked account, approved by, the journal posted at approval and its reversal or "Not reversed", totals (status, q, paging)',
  screen: `${S('Electronic Transfer')}; ${S('Insurer payments > Legacy transfers')}`, middleware: readPayments, query: { legacy: 1, status: 'Pending,Approved' },
  response: { success: true, data: [{ id: 'rmi_3', reference: 'TRF-2026-00001', beneficiary: 'Malayan Insurance Co., Inc.', bank: 'Metrobank', accountMasked: '···6612', amount: 125000, method: 'PESONet', status: 'Approved',
    approvedBy: { name: 'Fe Approver', at: '2026-09-27T02:00:00.000Z' }, journal: { id: 'jv_1', number: 'JV-2026-00031' }, reversal: { reversed: false, number: null, date: null, label: 'Not reversed' },
    readOnly: true, chip: { code: 'legacy', label: 'Recorded outside a payment voucher' }, creationDisabled: true, date: '2026-09-26' }], total: 1, totals: { count: 1, amount: 125000 } },
  handler: async (req, res) => {
    if (!['1', 'true'].includes(String(req.query.legacy || ''))) return listOf(req, res, 'transfer', items.transferOut);
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const r = await payments.legacyTransfers(req.query, pg);
    return sendList(res, r.rows, r.total, pg, { totals: r.totals });
  },
});
define({
  method: 'GET', path: '/transfers/:id', summary: 'One electronic transfer (id or TRF no.), read-only: beneficiary, masked account, method, amount, status, the approval and its decisions, the journal posted at approval, its reversal, the activity',
  screen: S('Insurer payments > Legacy transfers > View'), middleware: readPayments,
  response: { success: true, data: { id: 'rmi_3', reference: 'TRF-2026-00001', readOnly: true, chip: { code: 'legacy', label: 'Recorded outside a payment voucher' }, journal: { id: 'jv_1', number: 'JV-2026-00031' },
    reversal: { reversed: false, label: 'Not reversed' }, approval: { status: 'Approved', decisions: [{ action: 'Approved', by: 'Fe Approver', at: '2026-09-27T02:00:00.000Z', remarks: null }] }, activity: [] } },
  handler: async (req, res) => ok(res, await payments.legacyTransfer(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/transfers', summary: 'New electronic transfer (limit check, then approval); 409 TRANSFERS_OFF "Electronic transfers are replaced by Insurer payments." while remittance.transfers_enabled is off',
  screen: S('Electronic Transfer > New Transfer'), middleware: [...write, transfersOpen],
  request: { beneficiary: 'Malayan Insurance Co., Inc.', amount: 125000, method: 'PESONet', accountNumber: '0012-3456-78', bankName: 'BDO', purpose: 'September premium remittance', remittanceNo: 'REM-2026-00001' },
  response: { success: true, data: { reference: 'TRF-2026-00001', status: 'Pending' } },
  handler: async (req, res) => {
    const t = await items.createTransfer(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_item', entityId: t.id, action: 'create-transfer', after: t });
    created(res, t, 'Transfer created and sent for approval');
  },
});
define({
  method: 'POST', path: '/transfers/:id/execute', summary: 'Record the bank result of an approved transfer (Completed / Failed); 409 TRANSFERS_OFF while remittance.transfers_enabled is off',
  screen: S('Electronic Transfer'), middleware: [...write, transfersOpen],
  request: { status: 'Completed', bankReference: 'PSN-20260930-7781' }, response: { success: true, data: { status: 'Completed' } },
  handler: async (req, res) => {
    const status = req.body?.status === 'Failed' ? 'Failed' : 'Completed';
    if (status === 'Failed' && !req.body?.failureReason) throw badRequest('Validation failed', [{ path: 'failureReason', message: 'failureReason is required' }]);
    const out = await logged('remittance_item', `transfer-${status.toLowerCase()}`, (r) => items.completeItem('transfer', r.params.id, ['Approved'], status, { bankReference: r.body?.bankReference || null, failureReason: r.body?.failureReason || null, executedAt: new Date().toISOString() }, r.user))(req, res);
    ok(res, out.after, `Transfer ${status.toLowerCase()}`);
  },
});

// ---------------- statements ----------------
define({
  method: 'GET', path: '/statements', summary: 'Generated statements', screen: S('Statements'), middleware: read,
  response: { success: true, data: [{ statementId: 'STMT-2026-00001', period: '2026-09', fileName: 'Statement_2026_09.csv', downloadUrl: 'http://host/api/s3/object/remittance-statements/x.csv', status: 'Generated' }] },
  handler: async (req, res) => listOf(req, res, 'statement'),
});
define({
  method: 'GET', path: '/statements/preview', summary: 'Statement rows for a period / insurers (preview before generating)', screen: S('Statements > Preview'), middleware: read,
  query: { period: '2026-09', insurers: 'MALAYAN,FPG' }, response: { success: true, data: { rows: [{ transactionDate: '2026-09-15', policyNumber: 'POL-2026-00001', insuredName: 'Juan Dela Cruz', premium: 15000, commission: 2250, netAmount: 12750, status: 'Approved' }], totalRows: 1 } },
  handler: async (req, res) => ok(res, await items.statementPreview(req.query)),
});
define({
  method: 'POST', path: '/statements/generate', summary: 'Generate a statement file (CSV) for a period and insurers; optionally e-mail it', screen: S('Statements > Generate'), middleware: write,
  request: { period: '2026-09', statementType: 'Account Statement', selectionType: 'specific', insurers: ['MALAYAN'], templateCode: 'STM-001', emailTo: ['uw@malayan.example'] },
  response: { success: true, data: { success: true, statementId: 'STMT-2026-00001', fileName: 'Statement_2026_09_STMT-2026-00001.csv', fileSize: '1 KB', generatedAt: '2026-09-28T00:00:00Z', downloadUrl: 'http://host/api/s3/object/...', previewUrl: 'http://host/api/s3/object/...' } },
  handler: async (req, res) => {
    const s = await items.generateStatement(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_statement', entityId: s.statementId, action: 'generate', after: s });
    created(res, s, 'Statement generated');
  },
});

// ---------------- exceptions ----------------
define({
  method: 'GET', path: '/exceptions', summary: 'Remittance exceptions (status: Open, In Progress, Escalated, Resolved; assignedTo=me: assigned to the caller)', screen: S('Exceptions'), middleware: read,
  query: { status: 'Open,In Progress,Escalated', assignedTo: 'me' },
  response: { success: true, data: [{ id: 'rmi_4', exceptionId: 'EXC-2026-00001', severity: 'Critical', type: 'Amount Mismatch', remittanceNo: 'REM-2026-00001', amount: 25000, age: 2, assignedTo: 'Finance Officer', status: 'Open' }] },
  handler: async (req, res) => listOf(req.query.assignedTo === 'me' ? { ...req, query: { ...req.query, assignedToAny: await items.assigneeNames(req.user) } } : req, res, 'exception', items.exceptionOut),
});
define({
  method: 'POST', path: '/exceptions', summary: 'Log an exception (type from the exception master)', screen: S('Exceptions'), middleware: write,
  request: { type: 'Amount Mismatch', severity: 'High', remittanceNo: 'REM-2026-00001', amount: 800, description: 'Bank credit short by 800', assignedTo: 'finance.officer' },
  response: { success: true, data: { exceptionId: 'EXC-2026-00002', status: 'Open' } },
  handler: async (req, res) => {
    const e = await items.createException(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_item', entityId: e.id, action: 'create-exception', after: e });
    created(res, e, 'Exception logged');
  },
});
// escalation takes a reason of the exception_escalate context (Reason Codes master) and an optional note
const escalation = async (b) => {
  const r = await requiredReason(pool, 'exception_escalate', { reasonCode: b.reasonCode, note: b.note });
  return { escalationReason: r.text, escalationReasonCode: r.code };
};
const EXC_ACTIONS = { assign: ['In Progress', (b) => ({ assignedTo: b.assignedTo })], resolve: ['Resolved', (b) => ({ resolution: b.resolution, resolvedAt: new Date().toISOString() })], escalate: ['Escalated', escalation] };
for (const [action, [to, extra]] of Object.entries(EXC_ACTIONS)) {
  define({
    method: 'POST', path: `/exceptions/:id/${action}`,
    summary: action === 'escalate' ? 'Escalate an exception with a reason of the exception_escalate context ({ reasonCode, note }; the note is required when the reason asks for one)' : `${action[0].toUpperCase()}${action.slice(1)} an exception`,
    screen: S('Exceptions'), middleware: write,
    request: action === 'assign' ? { assignedTo: 'finance.officer' } : action === 'resolve' ? { resolution: 'Insurer credited the difference' } : { reasonCode: 'EXE-SLA', note: 'Insurer has not answered for 5 days' }, response: { success: true, data: { status: to } },
    handler: async (req, res) => {
      const b = req.body || {};
      if (action === 'assign' && !b.assignedTo) throw badRequest('Validation failed', [{ path: 'assignedTo', message: 'assignedTo is required' }]);
      if (action === 'resolve' && !b.resolution) throw badRequest('Validation failed', [{ path: 'resolution', message: 'resolution is required' }]);
      const data = await extra(b);
      const out = await logged('remittance_item', `exception-${action}`, (r) => items.completeItem('exception', r.params.id, ['Open', 'In Progress', 'Escalated'], to, data, r.user))(req, res);
      ok(res, items.exceptionOut({ ...(await items.getItem('exception', out.after.id)) }), `Exception ${to.toLowerCase()}`);
    },
  });
}

// ---------------- notifications ----------------
define({
  method: 'GET', path: '/notifications/inbox', summary: 'Remittance notifications for the signed-in user', screen: S('Notifications > Inbox'), middleware: read,
  response: { success: true, data: [{ id: 'ntf_1', type: 'Approval Request', subject: 'Remittances awaiting approval', sender: 'Remittance System', status: 'Delivered', isRead: false }] },
  handler: async (req, res) => ok(res, await items.inbox(req.user)),
});
define({
  method: 'GET', path: '/notifications/sent', summary: 'Sent notifications', screen: S('Notifications > Sent'), middleware: read,
  response: { success: true, data: [{ id: 'rmi_5', type: 'Payment Reminder', subject: 'Payment due', recipients: 'client@example.com', sentDate: '2026-09-25 14:30', status: 'Sent', channel: 'Email' }] },
  handler: async (req, res) => listOf(req, res, 'notification', items.sentOut),
});
define({
  method: 'GET', path: '/notifications/templates', summary: 'Notification templates (remittance-notification-template master)', screen: S('Notifications > Templates'), middleware: read,
  response: { success: true, data: [{ id: 1, code: 'NTF-001', name: 'Payment Due Reminder', channel: 'Email', status: 'Active' }] },
  handler: async (req, res) => ok(res, (await masters.listRecords(await masters.getType('remittance-notification-template'), req.query, { limit: 500, offset: 0 })).rows),
});
define({
  method: 'POST', path: '/notifications', summary: 'Compose and send a notification (e-mails are queued through the outbox)', screen: S('Notifications > Compose'), middleware: write,
  request: { type: 'Payment Reminder', subject: 'Payment due - POL-2026-00001', content: 'Your premium is due on 2026-10-15.', recipients: ['client@example.com'], recipientType: 'Client', channel: 'Email', priority: 'High' },
  response: { success: true, data: { referenceNo: 'NTF-2026-00001', status: 'Sent' } },
  handler: async (req, res) => {
    const n = await items.sendNotification(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_item', entityId: n.id, action: 'send-notification', after: n });
    created(res, n, 'Notification sent');
  },
});

// ---------------- schedules and runs ----------------
// What to remit and when (remittance-schedule master). The schedules have no timer of their own: the "Remittance
// schedules" job of Master > Schedules runs the due ones (runs.runDueSchedules); Run now runs one off-cycle.
const runExample = { id: 'run_0123456789abcdef', scheduleCode: 'TIS-WEEKLY', startedAt: '2026-10-12T22:15:00.000Z', startedText: '13/10/2026 06:15', finishedAt: '2026-10-12T22:15:04.000Z',
  trigger: { code: 'user', label: 'Run now · M. Reyes', user: { id: 'usr_4', name: 'M. Reyes' } }, reason: { code: 'ROC-MISSED', text: 'Missed run' },
  window: { from: '2026-10-05', to: '2026-10-09', catchUpFrom: null, text: '05/10/2026 – 09/10/2026' }, counts: { scanned: 14, ready: 14, held: 0, exceptions: 0, created: 3 },
  dueToInsurer: 1234567.89, drafts: [{ id: 'rm_21', remittanceNo: 'REM-2026-00021', link: '/finance/remittance/remittances/rm_21' }], executionRef: 'BLK-2026-00003',
  result: { code: 'success', label: 'Success' }, message: 'Weekly run done: 3 remittance(s) created, 0 policies held, 0 exceptions.' };
const scheduleExample = { id: 7, code: 'TIS-WEEKLY', name: 'Weekly remittance', kind: 'Remittance run', frequency: 'Weekly', paymentWindow: 'Previous Monday to Friday', cutOffDays: 0,
  groupBy: 'Insurer and product line', runTime: '06:15', allInsurers: true, insurers: [], covers: { allActive: true, count: 4, insurers: [{ id: 3, code: 'PIONEER', name: 'Pioneer Insurance & Surety Corp.' }], label: 'All active (4)' },
  runs: 'Mondays 06:15', nextRun: '2026-10-19', nextRunText: 'Mon 19/10/2026 06:15',
  lastRun: { id: runExample.id, at: runExample.startedAt, text: '12/10/2026 06:15', result: 'success', resultLabel: 'Success', counts: runExample.counts, message: runExample.message, trigger: runExample.trigger },
  status: 'Active', isActive: true, timeZone: 'Asia/Manila',
  actions: [{ code: 'view', label: 'View', allowed: true }, { code: 'edit', label: 'Edit', allowed: true }, { code: 'preview', label: 'Preview run', allowed: true },
    { code: 'run-now', label: 'Run now…', allowed: false, blockedCode: 'WINDOW_DONE', blockedReason: 'This week\'s run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15.' },
    { code: 'pause', label: 'Pause', allowed: true }] };
const scheduleBody = { name: 'Weekly remittance', kind: 'Remittance run', allInsurers: true, frequency: 'Weekly', paymentWindow: 'Previous Monday to Friday', groupBy: 'Insurer and product line',
  runTime: '06:15', nextRun: '2026-10-19' };
define({
  method: 'GET', path: '/held', summary: 'Held policies (instalment hold): part-paid policies not remitted until fully paid, with the plan, premium, paid to date, balance, next due date and bounced cheques (status held | released, insurerId, q)',
  screen: S('Held policies'), middleware: read, query: { status: 'held' },
  response: { success: true, data: { asOf: '2026-10-19', totals: { count: 1, premium: 25817.34, paidToDate: 12908.68, balance: 12908.66 },
    rows: [{ policyNumber: 'POL-2026-95034', clientName: 'R. Santos', insurerName: 'Malayan Insurance Co., Inc.', plan: '4 instalments', premium: 25817.34, paidToDate: 12908.68,
      balance: 12908.66, nextDue: '2026-11-03', heldSince: '2026-10-12', status: 'held' }] } },
  handler: async (req, res) => ok(res, await listHeld(req.query)),
});
define({
  method: 'GET', path: '/schedules',
  summary: 'Remittance schedules (Setup > Schedules): the automation state (jobEnabled, checked daily at, time zone, last check and its status; the cron and the job link for administrators only) and per schedule its kind, the insurers it covers, frequency, payment window, grouping, runs ("Mondays 06:15"), next run (none while paused), last run (time, result, counts, message, trigger), status and the row menu of the caller (actions: View; Edit, Preview run, Run now (disabled with the reason while paused or once the window has run) and Pause / Resume with write:remittance); scheduledJobs, upcomingEvents and job for the Scheduling screen of earlier releases',
  screen: `${S('Setup > Schedules')}; ${S('Scheduling')}`, middleware: read,
  response: { success: true, data: { automation: { jobEnabled: false, checkedDaily: '06:15', timeZone: 'Asia/Manila', lastCheckAt: null, lastStatus: null, cron: '15 6 * * *', jobCode: 'remittance-schedules', link: '/master/configuration/schedules' },
    schedules: [scheduleExample], timeZone: 'Asia/Manila', job: { code: 'remittance-schedules', enabled: false } } },
  handler: async (req, res) => ok(res, await runs.listSchedules(req.user)),
});
define({
  method: 'POST', path: '/schedules',
  summary: 'New remittance schedule (write:remittance): kind, insurers or all active insurers, frequency, payment window, grouping, run time, next run date; the code comes from the remittance_schedule series (SCH-003) when none is given. The window "Previous Monday to Friday" needs the frequency Weekly (400, errors[0].code MSG-RMT-007) and a Monday as next run',
  screen: S('Setup > Schedules > New schedule'), middleware: write, request: scheduleBody, response: { success: true, data: { id: 9, code: 'SCH-003', status: 'Active' } },
  handler: async (req, res) => created(res, await runs.createSchedule(req.body || {}, req.user, req), 'Schedule created'),
});
define({
  method: 'GET', path: '/schedules/:id', summary: 'One remittance schedule as listed on Setup > Schedules', screen: S('Setup > Schedules > View'), middleware: read,
  response: { success: true, data: scheduleExample },
  handler: async (req, res) => ok(res, await runs.getSchedule(req.params.id, req.user)),
});
define({
  method: 'PUT', path: '/schedules/:id',
  summary: 'Change a remittance schedule (write:remittance; checked as it will be saved, MSG-RMT-007 for a window that needs a weekly schedule; audited with before and after)',
  screen: S('Setup > Schedules > Edit'), middleware: write, request: { frequency: 'Monthly' },
  response: { success: false, message: 'Validation failed', errors: [{ path: 'frequency', code: 'MSG-RMT-007', message: runs.MSG_RMT_007 }] },
  handler: async (req, res) => ok(res, await runs.updateSchedule(req.params.id, req.body || {}, req.user, req), 'Schedule saved'),
});
define({
  method: 'PATCH', path: '/schedules/:id/status', summary: 'Pause / resume a schedule (a paused schedule has no next run; audited)', screen: S('Setup > Schedules > Pause schedule'), middleware: write,
  request: { status: 'Paused' }, response: { success: true, data: { status: 'Inactive' } },
  handler: async (req, res) => {
    const paused = ['Paused', 'Inactive', false].includes(req.body?.status);
    ok(res, await runs.setScheduleStatus(req.params.id, paused, req.user, req), paused ? 'Schedule paused' : 'Schedule resumed');
  },
});
define({
  method: 'GET', path: '/schedules/:id/runs', summary: 'Run history of a schedule, newest first: started, trigger (Job, or Run now · user), reason, window, counts, drafts, result and message (paging)',
  screen: `${S('Remittances > Run history')}; ${S('Setup > Schedules > View')}`, middleware: read, query: { page: 1, perPage: 20 },
  response: { success: true, data: [runExample], total: 1, page: 1, perPage: 20, totalPages: 1, schedule: { id: 7, code: 'TIS-WEEKLY', name: 'Weekly remittance' } },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const r = await runs.scheduleRuns(req.params.id, pg);
    sendList(res, r.rows, r.total, pg, { schedule: r.schedule });
  },
});
define({
  method: 'GET', path: '/schedules/:id/activity', summary: 'Activity log of a schedule: its changes (before and after) and its runs, oldest first', screen: S('Setup > Schedules > View'), middleware: read,
  response: { success: true, data: [{ ...activity, actionCode: 'run', actionLabel: 'Run now: Weekly run done: 3 remittance(s) created, 0 policies held, 0 exceptions.', remarks: 'Off-cycle: Missed run' }] },
  handler: async (req, res) => ok(res, await runs.scheduleActivity(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/schedules/:id/preview',
  summary: 'Preview a run (dry run, writes nothing): the window, per insurer the policies ready, the product lines, basis and due to insurer, and "Draft will be created" or "Nothing to remit", the totals and the verb; windowDone with the reason when the window already has a run',
  screen: `${S('Remittances > Run now')}; ${S('Setup > Schedules > Preview run')}`, middleware: write,
  response: { success: true, data: { schedule: { id: 7, code: 'TIS-WEEKLY', name: 'Weekly remittance' }, runDate: '2026-10-12', window: runExample.window, windowDone: { done: false }, paused: false,
    rows: [{ insurer: { id: 3, code: 'PIONEER', name: 'Pioneer Insurance & Surety Corp.' }, productLine: 'Motor', basis: 'Net', ready: 12, held: 0, exceptions: 0, dueToInsurer: 409141.43,
      result: { code: 'draft', label: 'Draft will be created' } }], totals: { insurers: 1, drafts: 1, ready: 12, held: 0, exceptions: 0, dueToInsurer: 409141.43 }, verb: 'Create 1 draft remittance' } },
  handler: async (req, res) => ok(res, await runs.previewRun(req.params.id)),
});
define({
  method: 'POST', path: '/schedules/:id/run',
  summary: 'Run now (write:remittance): an off-cycle run of the schedule\'s window with a remittance_off_cycle reason (reasonCode, note when the reason needs one); drafts per insurer, recorded in the run history. 409 WINDOW_DONE "This week\'s run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15." when the window already has a run, 409 PAUSED. The message is MSG-RMT-008',
  screen: `${S('Remittances > Run now')}; ${S('Setup > Schedules > Run now')}`, middleware: write, request: { reasonCode: 'ROC-MISSED', note: null },
  response: { success: true, message: runExample.message, data: { run: runExample, message: runExample.message, drafts: [{ id: 'rm_21', remittanceNo: 'REM-2026-00021', insurer: 'Pioneer Insurance & Surety Corp.', policies: 12, dueToInsurer: 409141.43, link: '/finance/remittance/remittances/rm_21' }], schedule: scheduleExample } },
  handler: async (req, res) => {
    const r = await runs.runNow(req.params.id, req.body || {}, req.user, req);
    ok(res, r, r.message);
  },
});

// ---------------- import policy list ----------------
const impExample = { id: 'imp_1', importNo: 'IMP-2026-0004', status: 'validated', statusLabel: 'Validated', expired: false, version: 1,
  purpose: { code: 'ROC-GOLIVE', name: 'Go-live opening', note: null, text: 'Go-live opening' }, file: { name: 'opening.xlsx', size: 18342, sizeText: '18 KB', hash: '9f2c...' },
  counts: { rows: 52, ready: 46, warnings: 4, errors: 6, held: 0, exceptions: 0 }, uploadedBy: { id: 'usr_4', name: 'M. Reyes' }, uploadedAt: '2026-10-12T02:00:00.000Z',
  committedBy: null, committedAt: null, discardedAt: null, drafts: [], sameFile: null,
  toCreate: [{ insurer: { id: 3, name: 'Pioneer Insurance & Surety Corp.' }, productLine: 'Motor', basis: 'net', basisLabel: 'Net', policies: 46, dueToInsurer: 1204553.1, varianceRows: 4 }],
  totals: { remittances: 1, policies: 46, dueToInsurer: 1204553.1 }, canCommit: true, commitBlockedReason: null, canDiscard: true };
define({
  method: 'GET', path: '/imports/template', summary: 'Remittance_Policy_List_Template.xlsx: Data (required headers dark red, 2 samples), Columns (the active insurer codes, the product lines, other accepted headers) and Instructions',
  screen: `${S('Remittances > Import policy list > Download template')}; ${S('Setup > Templates')}`, middleware: read, response: '(xlsx file)',
  handler: async (_req, res) => sendWorkbook(res, await documents.policyListTemplate()),
});
define({
  method: 'GET', path: '/imports/limits', summary: 'Limits of an imported policy list: file size (IMPORT_MAX_MB), data rows (remittance.import_max_rows), file types and the message of the dialog',
  screen: S('Remittances > Import policy list'), middleware: read,
  response: { success: true, data: { maxBytes: 10485760, maxMb: 10, maxRows: 5000, fileTypes: ['.xlsx', '.csv'], message: 'Choose an .xlsx or .csv file of at most 10 MB.' } },
  handler: async (_req, res) => ok(res, await imports.importLimits()),
});
define({
  method: 'POST', path: '/imports/validate',
  summary: 'Validate a policy list (multipart field "file", .xlsx or .csv of at most IMPORT_MAX_MB; purposeCode a remittance_off_cycle reason, note): keeps the file, its hash and a result per row under a new import IMP-yyyy-nnnn (validated) and creates nothing. 400 FILE_TOO_LARGE / FILE_TYPE "Choose an .xlsx or .csv file of at most 10 MB.", HEADER_MISSING "Column Policy No not found.", TOO_MANY_ROWS',
  screen: S('Remittances > Import policy list > Validate'),
  middleware: [...write, (req, res, next) => upload.single('file')(req, res, (e) => next(e ? imports.uploadError(e) : undefined))],
  request: { file: '(XLSX: Policy No, Insurer Code, Product Line, Expected Due to Insurer, Insurer Reference, Remark)', purposeCode: 'ROC-GOLIVE' },
  response: { success: true, data: impExample },
  handler: async (req, res) => created(res, await imports.validateImport(req.file, req.body || {}, req.user, req), 'File validated'),
});
define({
  method: 'GET', path: '/imports', summary: 'Import history, newest first (paging)', screen: S('Remittances > Import history'), middleware: read, query: { page: 1, perPage: 50 },
  response: { success: true, data: [{ ...impExample, status: 'committed', statusLabel: 'Committed', drafts: [{ id: 'rm_31', remittanceNo: 'REM-2026-00031' }] }], total: 1, page: 1, perPage: 50, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const r = await imports.listImports(req.query, pg);
    sendList(res, r.rows, r.total, pg);
  },
});
define({
  method: 'GET', path: '/imports/:id', summary: 'One import (id or IMP no.): counts, the remittances to create per insurer and product line, the drafts created, the same committed file and whether it can be committed',
  screen: S('Remittances > Import policy list > Preview'), middleware: read, response: { success: true, data: impExample },
  handler: async (req, res) => ok(res, await imports.getImport(req.params.id)),
});
define({
  method: 'GET', path: '/imports/:id/rows', summary: 'Row results of an import in file order (result: a result code, ready, warnings or errors; paging): system amount, expected amount of the file, variance, message',
  screen: S('Remittances > Import policy list > Preview'), middleware: read, query: { result: 'errors', page: 1, perPage: 50 },
  response: { success: true, data: [{ rowNo: 14, policyNo: 'TISPH-PC-0001240', insurerCode: 'PIONEER', insurer: 'Pioneer Insurance & Surety Corp.', productLine: 'Motor', result: 'ready-variance',
    resultLabel: 'Ready · Variance', kind: 'warning', message: 'File 25,871.34, system 25,817.34, difference -54.00', systemDue: 25817.34, expectedDue: 25871.34, variance: -54 }], total: 1, page: 1, perPage: 50, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const r = await imports.importRows(req.params.id, req.query, pg);
    sendList(res, r.rows, r.total, pg);
  },
});
define({
  method: 'GET', path: '/imports/:id/errors.xlsx', summary: 'Error report of an import: the columns of the file plus Result and Message, one row per file row in file order',
  screen: S('Remittances > Import policy list > Download error report'), middleware: read, response: '(xlsx file)',
  handler: async (req, res) => sendXlsx(res, await imports.errorReport(req.params.id)),
});
define({
  method: 'GET', path: '/imports/:id/file', summary: 'The file of an import as it was uploaded (.xlsx or .csv)',
  screen: S('Remittances > Import history > Download file'), middleware: read, response: '(xlsx or csv file)',
  handler: async (req, res) => {
    const f = await imports.importFile(req.params.id);
    res.type(f.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${String(f.fileName).replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"`);
    res.sendFile(f.path);
  },
});
define({
  method: 'POST', path: '/imports/:id/commit',
  summary: 'Create the draft remittances of a validated import: one per insurer and product line of the ready rows, at the system amounts, source import with the import and the off-cycle reason; a policy remitted meanwhile is skipped. 409 SAME_FILE when the same file was committed, ALREADY_COMMITTED, DISCARDED (also 7 days after validation), STALE, NOTHING_READY',
  screen: S('Remittances > Import policy list > Create drafts'), middleware: write, request: { version: 1 },
  response: { success: true, data: { import: { ...impExample, status: 'committed', statusLabel: 'Committed' }, drafts: [{ id: 'rm_31', remittanceNo: 'REM-2026-00031', policies: 46, dueToInsurer: 1204553.1 }],
    skipped: [], message: '1 draft created: REM-2026-00031 · Off-cycle · IMP-2026-0004' } },
  handler: async (req, res) => {
    const r = await imports.commitImport(req.params.id, req.body || {}, req.user, req);
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/imports/:id/discard', summary: 'Discard a validated import (nothing was created from it)', screen: S('Remittances > Import policy list > Discard'), middleware: write,
  response: { success: true, data: { ...impExample, status: 'discarded', statusLabel: 'Discarded' } },
  handler: async (req, res) => ok(res, await imports.discardImport(req.params.id, req.user, req), 'Import discarded'),
});

// ---------------- bulk processing ----------------
define({
  method: 'GET', path: '/bulk', summary: 'Bulk uploads (processing history)', screen: S('Bulk Processing'), middleware: read,
  response: { success: true, data: [{ id: 'rmi_6', fileName: 'september.csv', uploadDate: '2026-09-20 10:00', processedBy: 'finance.officer', totalRecords: 120, successCount: 118, errorCount: 2, status: 'Processed' }] },
  handler: async (req, res) => listOf(req, res, 'upload', items.bulkOut),
});
define({
  method: 'GET', path: '/bulk/template', summary: 'Remittance bulk upload template of a bulk-processing configuration (configCode; default: the first active one): the columns of its field mappings (XLSX: Data, Columns and Instructions sheets)',
  screen: S('Bulk Processing > Upload File > Download template'), middleware: [...read, bulkOpen], query: { configCode: 'ARM-001' }, response: '(xlsx file)',
  handler: async (req, res) => {
    const { cfg, maps } = await items.bulkConfig(req.query.configCode || null);
    sendWorkbook(res, remittanceUpload(maps, cfg.code));
  },
});
define({
  method: 'POST', path: '/bulk/upload', summary: 'Upload a remittance file (multipart file + configCode); validates against the bulk-processing master (409 USE_IMPORT while remittance.bulk_upload_enabled is off)', screen: S('Bulk Processing > Upload / Validate'), middleware: [...write, bulkOpen, singleFile],
  request: { file: '(CSV: PolicyNo,Premium,Commission)', configCode: 'BFM-001' }, response: { success: true, data: { totalRecords: 2, successCount: 1, errorCount: 1, errors: [{ row: 3, field: 'policy_number', message: 'Policy not found' }], status: 'Validated' } },
  handler: async (req, res) => {
    const u = await items.uploadBulk(req.file, req.body || {}, req.user);
    await audit(req, { entity: 'remittance_item', entityId: u.id, action: 'bulk-upload', after: { fileName: u.fileName, totalRecords: u.totalRecords, errorCount: u.errorCount } });
    created(res, u, 'File validated');
  },
});
define({
  method: 'POST', path: '/bulk/:id/process', summary: 'Create draft remittances from the valid rows of an upload, at the booked premium, commission and tax of the policies (the typed amounts are not used; 409 USE_IMPORT while remittance.bulk_upload_enabled is off)', screen: S('Bulk Processing > Process'), middleware: [...write, bulkOpen],
  response: { success: true, data: { upload: { status: 'Processed' }, remittances: [rem] } },
  handler: async (req, res) => ok(res, await logged('remittance_item', 'bulk-process', (r) => items.processBulk(r.params.id, r.user))(req, res), 'Upload processed'),
});

// ---------------- reconciliation ----------------
define({
  method: 'GET', path: '/reconciliation', summary: 'Bank vs system transactions, exceptions and match summary', screen: S('Reconciliation'), middleware: read,
  response: { success: true, data: { bankTransactions: [{ id: 'rmi_7', transDate: '2026-09-20', reference: 'BNK-2026-00001', amount: 38250, status: 'matched' }], systemTransactions: [{ id: 'rm_1', policyNo: 'POL-2026-00001', premium: 38250, transDate: '2026-09-18', reference: 'REM-2026-00001', status: 'matched' }], exceptions: [], summary: { matched: 1, unmatched: 0, successRate: 100 } } },
  handler: async (_req, res) => ok(res, await items.reconciliation()),
});
define({
  method: 'GET', path: '/reconciliation/bank-transactions/template', summary: 'Bank transactions import template (CSV: TransDate, Reference, Amount, Description)',
  screen: S('Reconciliation > Import > Template'), middleware: read, response: '(csv file)',
  handler: async (_req, res) => {
    const def = staticUploads().find((d) => d.id === 'remittance-bank-transactions');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${def.csv}"`);
    res.send(templateCsv(def));
  },
});
define({
  method: 'POST', path: '/reconciliation/bank-transactions', summary: 'Import bank statement lines', screen: S('Reconciliation > Import'), middleware: write,
  request: { transactions: [{ transDate: '2026-09-20', reference: 'PSN-889201', amount: 38250, description: 'PESONet credit' }] }, response: { success: true, data: [{ id: 'rmi_7', status: 'unmatched' }] },
  handler: async (req, res) => {
    const list = await items.importBankTransactions(req.body?.transactions, req.user);
    await audit(req, { entity: 'remittance_item', action: 'import-bank-transactions', after: { count: list.length } });
    created(res, list, `${list.length} bank transaction(s) imported`);
  },
});
define({
  method: 'POST', path: '/reconciliation/auto-match', summary: 'Auto-match bank lines to approved remittances within the tolerance', screen: S('Reconciliation > Auto Match'), middleware: write,
  request: { tolerance: 0.5 }, response: { success: true, data: { matched: 3, total: 5, unmatched: 2, successRate: 60 } },
  handler: async (req, res) => ok(res, await logged('remittance_reconciliation', 'auto-match', (r) => items.autoMatch(r.body || {}, r.user))(req, res), 'Auto-match complete'),
});
define({
  method: 'POST', path: '/reconciliation/match', summary: 'Manually match a bank line to a remittance (difference beyond tolerance logs an exception)', screen: S('Reconciliation > Match'), middleware: write,
  request: { bankId: 'rmi_7', remittanceId: 'REM-2026-00001' }, response: { success: true, data: { status: 'matched', difference: 0 } },
  handler: async (req, res) => ok(res, await logged('remittance_reconciliation', 'match', (r) => items.manualMatch(r.body || {}, r.user))(req, res), 'Matched'),
});
define({
  method: 'POST', path: '/reconciliation/unmatch', summary: 'Undo a match', screen: S('Reconciliation'), middleware: write, request: { bankId: 'rmi_7' }, response: { success: true, data: { matched: 0 } },
  handler: async (req, res) => ok(res, await logged('remittance_reconciliation', 'unmatch', (r) => items.unmatch(r.body?.bankId, r.user))(req, res), 'Unmatched'),
});

// ---------------- analytics / history / masters ----------------
define({
  method: 'GET', path: '/analytics', summary: 'KPIs (targets from configuration), top insurers, monthly trend, status distribution', screen: S('Analytics'), middleware: read, query: { from: '2026-04-01', to: '2026-09-30' },
  response: { success: true, data: { kpiData: [{ id: 1, name: 'Settlement Efficiency', value: 92, target: 95, trend: 2.1, status: 'warning', unit: '%' }], topClients: [{ clientName: 'Malayan Insurance Co., Inc.', transactionCount: 12, totalValue: 560000, avgProcessingTime: 16, successRate: 98.5 }], monthlyTrend: [], statusDistribution: {} } },
  handler: async (req, res) => ok(res, await items.analytics(req.query)),
});
define({
  method: 'GET', path: '/history', summary: 'Transaction history across remittances, settlements, adjustments and transfers', screen: S('History'), middleware: read, query: { search: 'REM', type: 'Settlement', page: 1 },
  response: { success: true, data: [{ id: 'rm_1', referenceNo: 'REM-2026-00001', type: 'Insurer Remittance', policyNo: 'POL-2026-00001', clientName: 'Malayan Insurance Co., Inc.', amount: 38250, status: 'Approved', createdBy: 'Finance Officer', version: 3, hasAuditTrail: true }] },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total } = await items.history(req.query, pg);
    sendList(res, rows, total, pg);
  },
});
define({
  method: 'GET', path: '/history/audit', summary: 'Audit trail of remittance records (filter referenceNo)', screen: S('History > Audit Trail'), middleware: read, query: { referenceNo: 'REM-2026-00001' },
  response: { success: true, data: [{ referenceNo: 'REM-2026-00001', actionType: 'approve', actionLabel: 'Approved', previousValue: 'Pending Approval', newValue: 'Approved', changedBy: 'finance.head',
    changedByName: 'Fe Head', changedByRoles: ['Finance Manager'], changeDate: '2026-09-26 15:45', changedAt: '2026-09-26T15:45:00.000Z' }] },
  handler: async (req, res) => ok(res, await items.auditTrail(req.query)),
});
define({
  method: 'GET', path: '/history/system-logs', summary: 'Processing logs (executions, batches, uploads, statements, reports)', screen: S('History > System Logs'), middleware: read,
  response: { success: true, data: [{ timestamp: '2026-09-26 16:30:15', level: 'INFO', module: 'Automated Remittance', message: 'Automated Remittance BLK-2026-00002: Success', recordsProcessed: 12 }] },
  handler: async (_req, res) => ok(res, await items.systemLogs()),
});
define({
  method: 'GET', path: '/masters', summary: 'Remittance Master overview: the remittance configuration types in one list (edit through /masters/:type)', screen: 'Master > Finance > Remittance Master', middleware: canRead('remittance', 'read:masters'),
  query: { type: 'Automated', search: 'ARM' }, response: { success: true, data: [{ id: 1, code: 'ARM-001', name: 'Monthly Auto Remittance', type: 'Automated', typeCode: 'remittance-automated', status: true, lastUpdated: '2026-09-15' }] },
  handler: async (req, res) => ok(res, await items.masterOverview(req.query)),
});

export default router;
export const mount = '/remittance';
