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
import { businessTimeZone } from '../../lib/dates.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { commissionDebitNoteDoc, remittanceAdviceDoc } from '../documents/templates.js';
import { sendTable } from '../documents/tabular.js';
import * as approvals from './approvals.js';
import { ACTIVITY_HEADER, activityRows, remittanceActivity } from './activity.js';
import * as register from './register.js';
import * as documents from './documents.js';
import * as imports from './imports.js';

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
  summary: 'Remittance record: insurer, policies, documents, version, the decision block of its approval for the caller (canDecide, blockedCode / blockedReason, eligible approvers) with the next step, the activity log (as GET /remittances/:id/activity) and, for a direct-bill remittance, the register row (status label, flags, source and import, off-cycle reason, coverage week, basis, actions), the lines with the expected amount and variance of an import, the payment through the settlement voucher and the downloads',
  screen: `${S('Remittances > Record')}; ${S('Tracking > View')}`, middleware: read,
  response: { success: true, data: { ...rem, ...regRow, statusCode: 'for-approval', insurerDetails: { code: 'MALAYAN', name: 'Malayan Insurance Co., Inc.' },
    policies: [{ policyNo: 'POL-2026-00001', premium: 15000, commission: 2250 }],
    lines: [{ id: 1, policyNo: 'TISPH-PC-0001234', insuredName: 'J. Santos', premium: 64159.68, commission: 24022.5, tax: 0, netAmount: 40137.18, expectedDue: 40191.18, variance: -54, insurerReference: 'SOA-2026-10-001', remark: null }],
    payment: null, downloads: [{ code: 'schedule-xlsx', label: 'schedule (XLSX)', href: '/remittance/remittances/rm_21/schedule.xlsx' }], activityLog: [activity] } },
  handler: async (req, res) => ok(res, await register.remittanceRecord(req.params.id, req.user)),
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
  method: 'POST', path: '/remittances/:id/settle', summary: 'Mark an approved remittance as settled (paid to the insurer)', screen: S('Settlement'), middleware: write,
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
  method: 'GET', path: '/direct-bill', summary: 'Commission debit notes (insurerCode, status code or label, from / to, search, paging)', screen: S('Direct Bill Processing > Debit Notes'), middleware: read,
  query: { status: 'Open,Partially Collected', insurerCode: 'MALAYAN', page: 1, perPage: 20 }, response: { success: true, data: [dnExample] },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total, summary } = await directBill.listDebitNotes(req.query, pg);
    sendList(res, rows, total, pg, { summary });
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
  method: 'GET', path: '/direct-bill/:id', summary: 'One commission debit note with its policy lines and collections', screen: S('Direct Bill Processing > Debit Notes > View'), middleware: read,
  response: { success: true, data: { ...dnExample, lines: [], collections: [] } }, handler: async (req, res) => ok(res, await directBill.getDebitNote(req.params.id)),
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
  method: 'POST', path: '/direct-bill/:id/submit', summary: 'Submit a draft debit note for approval', screen: S('Direct Bill Processing > Debit Notes'), middleware: write,
  response: { success: true, data: { ...dnExample } },
  handler: async (req, res) => ok(res, (await logged('commission_debit_note', 'submit', (r) => directBill.submitDebitNote(r.params.id, r.user))(req, res)).after, 'Debit note submitted for approval'),
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/direct-bill/:id/${action}`,
    summary: `${action === 'approve' ? 'Approve (opens it for sending and collection)' : 'Reject (reason required; its commission becomes unbilled again)'} a debit note; maker-checker: not the maker`,
    screen: S('Direct Bill Processing > Debit Notes'), middleware: write, request: action === 'approve' ? { remarks: 'Checked against the placements' } : { reason: 'Wrong period' },
    response: { success: true, data: { ...dnExample, status: action === 'approve' ? 'Open' : 'Rejected' } },
    handler: async (req, res) => ok(res, (await logged('commission_debit_note', action, (r) => directBill.decideDebitNote(r.params.id, action, r.body || {}, r.user))(req, res)).after,
      `Debit note ${action === 'approve' ? 'approved' : 'rejected'}`),
  });
}
define({
  method: 'POST', path: '/direct-bill/:id/cancel', summary: 'Cancel a debit note without collections (reason required once approved); its commission becomes unbilled again', screen: S('Direct Bill Processing > Debit Notes'), middleware: write,
  request: { reason: 'Raised to the wrong insurer' }, response: { success: true, data: { ...dnExample, status: 'Cancelled' } },
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
  summary: 'Approvals. With view=mine|submitted|all|decided (type=remittance|settlement|adjustment|transfer, insurerId, q, page, perPage): the inbox rows with the decision block, next step, SLA and level, server totals and the KPI figures (awaiting my decision, past SLA, submitted by me, decided by me today in the business time zone); decided covers the last 30 days. Without view: the legacy queue (status=Pending by default; filter transactionType, priority)',
  screen: `${S('Approvals')}; ${S('Approval')}`, middleware: read,
  query: { view: 'mine', type: 'remittance', insurerId: 3, q: 'REM-2026', page: 1, perPage: 50 },
  response: { success: true, data: [inboxRow], total: 1, page: 1, perPage: 50, totalPages: 1, view: 'mine', totals: { count: 1, amount: 409141.43 },
    kpis: { awaitingMine: { count: 1, amount: 409141.43 }, pastSla: { count: 0, oldestHours: 0 }, submittedByMe: { count: 0 }, decidedByMeToday: { count: 2, approved: 2, rejected: 0 } } },
  handler: async (req, res) => {
    if (!req.query.view) return ok(res, await svc.listApprovals(req.query));
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const r = await approvals.approvalInbox(req.query, req.user, pg);
    return sendList(res, r.rows, r.total, pg, { view: r.view, totals: r.totals, kpis: r.kpis });
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
      { code: 'period-open', label: 'Period Oct 2026 open', result: 'pass', detail: null }],
    exceptions: { count: 0, items: [] }, activity: [activity] } },
  handler: async (req, res) => ok(res, await approvals.approvalSummary(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/approvals/:id/remind',
  summary: 'Remind the eligible approvers of a pending approval (its submitter; at most once per remittance.reminder_interval_hours, 409 REMINDED "Reminded 10:15 · next at 14:15"; 409 NO_ELIGIBLE_APPROVER)',
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

// ---------------- electronic transfers ----------------
define({
  method: 'GET', path: '/transfers/methods', summary: 'Transfer methods and limits (configuration)', screen: S('Electronic Transfer'), middleware: read,
  response: { success: true, data: [{ label: 'PESONet', value: 'PESONet', limit: 10000000 }] },
  handler: async (_req, res) => ok(res, await items.transferMethods()),
});
define({
  method: 'GET', path: '/transfers', summary: 'Electronic transfers (status: Pending, Approved, Completed, Failed, Rejected)', screen: S('Electronic Transfer'), middleware: read, query: { status: 'Pending,Approved' },
  response: { success: true, data: [{ id: 'rmi_3', reference: 'TRF-2026-00001', beneficiary: 'Malayan Insurance Co., Inc.', amount: 125000, method: 'PESONet', status: 'Pending', date: '2026-09-26' }] },
  handler: async (req, res) => listOf(req, res, 'transfer', items.transferOut),
});
define({
  method: 'POST', path: '/transfers', summary: 'New electronic transfer (limit check, then approval)', screen: S('Electronic Transfer > New Transfer'), middleware: write,
  request: { beneficiary: 'Malayan Insurance Co., Inc.', amount: 125000, method: 'PESONet', accountNumber: '0012-3456-78', bankName: 'BDO', purpose: 'September premium remittance', remittanceNo: 'REM-2026-00001' },
  response: { success: true, data: { reference: 'TRF-2026-00001', status: 'Pending' } },
  handler: async (req, res) => {
    const t = await items.createTransfer(req.body || {}, req.user);
    await audit(req, { entity: 'remittance_item', entityId: t.id, action: 'create-transfer', after: t });
    created(res, t, 'Transfer created and sent for approval');
  },
});
define({
  method: 'POST', path: '/transfers/:id/execute', summary: 'Record the bank result of an approved transfer (Completed / Failed)', screen: S('Electronic Transfer'), middleware: write,
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
  method: 'GET', path: '/exceptions', summary: 'Remittance exceptions (status: Open, In Progress, Escalated, Resolved)', screen: S('Exceptions'), middleware: read,
  response: { success: true, data: [{ id: 'rmi_4', exceptionId: 'EXC-2026-00001', severity: 'Critical', type: 'Amount Mismatch', remittanceNo: 'REM-2026-00001', amount: 25000, age: 2, assignedTo: 'Finance Officer', status: 'Open' }] },
  handler: async (req, res) => listOf(req, res, 'exception', items.exceptionOut),
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
const EXC_ACTIONS = { assign: ['In Progress', (b) => ({ assignedTo: b.assignedTo })], resolve: ['Resolved', (b) => ({ resolution: b.resolution, resolvedAt: new Date().toISOString() })], escalate: ['Escalated', (b) => ({ escalationReason: b.reason })] };
for (const [action, [to, extra]] of Object.entries(EXC_ACTIONS)) {
  define({
    method: 'POST', path: `/exceptions/:id/${action}`, summary: `${action[0].toUpperCase()}${action.slice(1)} an exception`, screen: S('Exceptions'), middleware: write,
    request: action === 'assign' ? { assignedTo: 'finance.officer' } : action === 'resolve' ? { resolution: 'Insurer credited the difference' } : { reason: 'Past SLA' }, response: { success: true, data: { status: to } },
    handler: async (req, res) => {
      const b = req.body || {};
      if (action === 'assign' && !b.assignedTo) throw badRequest('Validation failed', [{ path: 'assignedTo', message: 'assignedTo is required' }]);
      if (action === 'resolve' && !b.resolution) throw badRequest('Validation failed', [{ path: 'resolution', message: 'resolution is required' }]);
      const out = await logged('remittance_item', `exception-${action}`, (r) => items.completeItem('exception', r.params.id, ['Open', 'In Progress', 'Escalated'], to, extra(b), r.user))(req, res);
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

// ---------------- scheduling ----------------
// What to remit (insurers, cut-off, frequency, next run date). The schedules have no timer of their own: the
// "Remittance schedules" job of Master > Schedules runs the due ones (items.runDueSchedules).
define({
  method: 'GET', path: '/schedules', summary: 'Remittance schedules (remittance-schedule master), upcoming run dates and the Master > Schedules job that runs them', screen: S('Scheduling'), middleware: read,
  response: { success: true, data: { scheduledJobs: [{ id: 1, code: 'SCH-001', name: 'Monthly remittance - Malayan', insurers: ['MALAYAN'], cutOffDays: 5, nextRun: '2026-10-01', frequency: 'Monthly', status: 'Active' }],
    upcomingEvents: [{ status: '2026-10-01', date: '2026-10-01', content: 'Monthly remittance - Malayan' }], timeZone: 'Asia/Manila', job: { code: 'remittance-schedules', cron: '15 6 * * *', enabled: false } } },
  handler: async (_req, res) => ok(res, await items.schedules()),
});
define({
  method: 'POST', path: '/schedules', summary: 'New remittance schedule: insurers, cut-off days, frequency and next run date (stored in the remittance-schedule master)', screen: S('Scheduling > New Schedule'), middleware: write,
  request: { code: 'SCH-0003', name: 'Weekly remittance - Pioneer', insurers: ['PIONEER'], cutOffDays: 3, frequency: 'Weekly', nextRun: '2026-10-05' },
  response: { success: true, data: { id: 3, code: 'SCH-0003', status: 'Active' } },
  handler: async (req, res) => {
    const t = await masters.getType('remittance-schedule');
    await items.assertScheduleInsurers(req.body || {});
    const s = await masters.createRecord(t, { timezone: await businessTimeZone(), ...(req.body || {}) }, req.user);
    await audit(req, { entity: 'master:remittance-schedule', entityId: s.id, action: 'create', after: s });
    created(res, s, 'Schedule created');
  },
});
define({
  method: 'PUT', path: '/schedules/:id', summary: 'Change a remittance schedule (insurers, cut-off days, frequency, next run date)', screen: S('Scheduling > Edit Schedule'), middleware: write,
  request: { insurers: ['PIONEER', 'MALAYAN'], cutOffDays: 5, nextRun: '2026-10-12' }, response: { success: true, data: { id: 3, code: 'SCH-0003', status: 'Active' } },
  handler: async (req, res) => {
    const t = await masters.getType('remittance-schedule');
    await items.assertScheduleInsurers(req.body || {});
    const { before, after } = await masters.updateRecord(t, req.params.id, req.body || {}, req.user);
    await audit(req, { entity: 'master:remittance-schedule', entityId: req.params.id, action: 'update', before, after });
    ok(res, after, 'Schedule saved');
  },
});
define({
  method: 'PATCH', path: '/schedules/:id/status', summary: 'Pause / resume a schedule', screen: S('Scheduling'), middleware: write, request: { status: 'Paused' }, response: { success: true, data: { status: 'Inactive' } },
  handler: async (req, res) => {
    const t = await masters.getType('remittance-schedule');
    const status = ['Paused', 'Inactive', false].includes(req.body?.status) ? 'inactive' : 'active';
    const { before, after } = await masters.setRecordStatus(t, req.params.id, status, req.user);
    await audit(req, { entity: 'master:remittance-schedule', entityId: req.params.id, action: `status:${status}`, before, after });
    ok(res, after, status === 'active' ? 'Schedule resumed' : 'Schedule paused');
  },
});
define({
  method: 'POST', path: '/schedules/:id/run', summary: 'Run a schedule now: draft remittances for its insurers up to the cut-off date (or its linked automated remittance)', screen: S('Scheduling > Run Now'), middleware: write,
  response: { success: true, data: { schedule: { id: 1 }, execution: { executionId: 'BLK-2026-00003', remittances: [] } } },
  handler: async (req, res) => ok(res, await logged('remittance_schedule', 'run', (r) => items.runSchedule(r.params.id, r.user))(req, res), 'Schedule executed'),
});

// ---------------- import policy list ----------------
const impExample = { id: 'imp_1', importNo: 'IMP-2026-0004', status: 'validated', statusLabel: 'Validated', expired: false, version: 1,
  purpose: { code: 'ROC-GOLIVE', name: 'Go-live opening', note: null, text: 'Go-live opening' }, file: { name: 'opening.xlsx', size: 18342, sizeText: '18 KB', hash: '9f2c...' },
  counts: { rows: 52, ready: 46, warnings: 4, errors: 6, held: 0, exceptions: 0 }, uploadedBy: { id: 'usr_4', name: 'M. Reyes' }, uploadedAt: '2026-10-12T02:00:00.000Z',
  committedBy: null, committedAt: null, discardedAt: null, drafts: [], sameFile: null,
  toCreate: [{ insurer: { id: 3, name: 'Pioneer Insurance & Surety Corp.' }, productLine: 'Motor', policies: 46, dueToInsurer: 1204553.1, varianceRows: 4 }],
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
