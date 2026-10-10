/**
 * Talkbot call lists (Operations > Renewals > Talkbot Calls, FRS LEAD-09). read:talkbot-calls opens the lists and the
 * Talkbot outcome of renewals; write:talkbot-calls creates, downloads, sends, cancels and closes lists, uploads the call
 * results and records outcomes; Create renewal batch also needs write:renewals. A record-scoped user sees the lines of
 * the policies of their own book only. Mobile numbers are masked on screen; the full number is only in the downloaded file.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { scopeOf } from '../../lib/scope.js';
import { uploadFile } from '../documents/tabular.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { resolveKey } from '../uploads/storage.js';
import * as svc from './service.js';
import * as results from './results.js';

const { router, define } = moduleRouter('Talkbot calls', '/talkbot');
const SCREEN = 'Operations > Renewals > Talkbot Calls';
const read = [requireAuth, requirePermission('read:talkbot-calls')];
const write = [requireAuth, requirePermission('write:talkbot-calls')];
const batchWrite = [requireAuth, requirePermission('read:talkbot-calls'), requirePermission('write:renewals')];

const criteria = z.object({
  expiryFrom: z.string().max(30), expiryTo: z.string().max(30), insurerId: z.union([z.string(), z.number()]).optional().nullable(),
  includeExpired: z.boolean().optional(), recallOf: z.string().max(60).optional().nullable(), includeCallBack: z.boolean().optional(),
  salesPersonId: z.string().max(60).optional().nullable(), channelId: z.union([z.string(), z.number()]).optional().nullable(),
});
const reasonBody = z.object({ reasonCode: z.string().max(60).optional().nullable(), reason: z.string().max(500).optional().nullable() });
const outcomeBody = z.object({ outcome: z.string().max(40), date: z.string().max(30).optional().nullable(), remark: z.string().max(500).optional().nullable() });

const listExample = { id: 'tcl_1', listNumber: 'TCL-2026-00014', status: 'sent', statusLabel: 'Sent to Talkbot', taskName: 'TIS_MV - OCT 07, 2026', expiryFrom: '2026-10-10',
  expiryTo: '2026-10-10', accounts: 500, willing: 37, notCalled: 0, batchNumbers: ['RB-2026-90014'], leftOut: '11 accounts left out: 6 No mobile number, 3 Already on call list TCL-2026-00013, 2 Lock-in or Scheme 2' };
const lineExample = { id: 41, policyNumber: 'POL-2025-41187', clientName: 'ANDREA M. VILLANUEVA', mobile: '0917 *** 7105', vehicle: '2023 TOYOTA Raize 1.0 Turbo CVT', expiryDate: '2026-10-10',
  outcome: 'willing', outcomeLabel: 'Willing to renew', outcomeDetail: 'Will Renew (Closing)', calls: 3, manual: false, batchNumber: 'RB-2026-90014', quoteStatus: 'Quoted', quoteNumber: 'RQ-2026-90031' };

define({
  method: 'GET', path: '/options', summary: 'New call list defaults: expiry dates (today + talkbot.days_before_expiry, extended over the coming non-working days), proposed task name, insurers, sales persons, lists to call again, outcomes',
  screen: `${SCREEN} > New call list`, middleware: read,
  response: { success: true, data: { expiryFrom: '2026-10-12', expiryTo: '2026-10-14', taskName: 'TIS_MV - OCT 09, 2026', insurers: [{ id: 2, name: 'Malayan Insurance Co., Inc.' }] } },
  handler: async (_req, res) => ok(res, await svc.listOptions()),
});
define({
  method: 'POST', path: '/preview', summary: 'Accounts the criteria give: how many can be called and how many are left out, by reason (nothing is saved)',
  screen: `${SCREEN} > New call list`, middleware: [...write, validate(criteria)], request: { expiryFrom: '2026-10-10', expiryTo: '2026-10-10', includeExpired: true },
  response: { success: true, data: { eligible: 500, maxAccounts: 2000, excluded: { 'No mobile number': 6 }, leftOut: '6 accounts left out: 6 No mobile number' } },
  handler: async (req, res) => ok(res, await svc.preview(req.body, await scopeOf(req))),
});
define({
  method: 'GET', path: '/lists', summary: 'Call lists, newest first (status, search by list number or task name, page, pageSize)', screen: SCREEN, middleware: read,
  query: { status: 'sent', page: 1, pageSize: 20 }, response: { success: true, data: [listExample], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { total, items } = await svc.listLists(req.query, pg);
    res.json({ success: true, message: 'OK', data: items, ...pageMeta(total, pg) });
  },
});
define({
  method: 'POST', path: '/lists', summary: 'Create a call list in Draft from the Motor policies due for renewal of the criteria (eligibility rules applied; refused when no account or more than talkbot.max_accounts)',
  screen: `${SCREEN} > New call list > Create call list`, middleware: [...write, validate(criteria)], request: { expiryFrom: '2026-10-10', expiryTo: '2026-10-10' },
  response: { success: true, message: 'Call list TCL-2026-00016 created with 41 accounts', data: listExample },
  handler: async (req, res) => {
    const l = await svc.createList(req.body, req.user.id, { scope: await scopeOf(req) });
    await audit(req, { entity: 'talkbot_call_list', entityId: l.id, action: 'create', after: { listNumber: l.listNumber, accounts: l.accounts, criteria: l.criteria, leftOut: l.leftOut } });
    created(res, l, `Call list ${l.listNumber} created with ${l.accounts} accounts`);
  },
});
define({
  method: 'GET', path: '/lists/:id', summary: 'One call list with its accounts (outcome, lineStatus active | removed, search); mobile numbers masked', screen: `${SCREEN} > Call list`,
  middleware: read, query: { outcome: 'call-back' }, response: { success: true, data: { ...listExample, lines: [lineExample] } },
  handler: async (req, res) => ok(res, await svc.getList(req.params.id, { scope: await scopeOf(req), outcome: req.query.outcome, lineStatus: req.query.lineStatus, search: req.query.search })),
});
define({
  method: 'POST', path: '/lists/:id/lines/:lineId/remove', summary: 'Take an account off a Draft call list with a reason code (context talkbot_line_remove)',
  screen: `${SCREEN} > Call list > Remove`, middleware: [...write, validate(reasonBody)], request: { reasonCode: 'TBR-COMPLAINT' }, response: { success: true, data: lineExample },
  handler: async (req, res) => {
    const r = await svc.removeLine(req.params.id, req.params.lineId, req.body, req.user.id);
    await audit(req, { entity: 'talkbot_call_line', entityId: r.after.id, action: 'remove', before: { lineStatus: r.before.lineStatus }, after: { listNumber: r.listNumber, policyNumber: r.after.policyNumber, lineStatus: 'removed', reason: r.after.removedReason } });
    ok(res, r.after, `Policy ${r.after.policyNumber} removed from the call list`);
  },
});
define({
  method: 'POST', path: '/lists/:id/lines/:lineId/restore', summary: 'Put a removed account back on a Draft call list', screen: `${SCREEN} > Call list > Put back`, middleware: write,
  response: { success: true, data: lineExample },
  handler: async (req, res) => {
    const r = await svc.restoreLine(req.params.id, req.params.lineId);
    await audit(req, { entity: 'talkbot_call_line', entityId: r.after.id, action: 'restore', before: { lineStatus: 'removed', reason: r.before.removedReason }, after: { listNumber: r.listNumber, policyNumber: r.after.policyNumber, lineStatus: 'active' } });
    ok(res, r.after, `Policy ${r.after.policyNumber} put back on the call list`);
  },
});
define({
  method: 'POST', path: '/lists/:id/download', summary: 'Download call list: the Contact Import file (.xlsx, sheet Contact Import); accounts no longer eligible are taken off the list first',
  screen: `${SCREEN} > Call list > Download call list`, middleware: write, response: '(xlsx file)',
  handler: async (req, res) => {
    const f = await svc.downloadList(req.params.id, req.user.id);
    await audit(req, { entity: 'talkbot_call_list', entityId: f.listId, action: 'download', after: { listNumber: f.listNumber, rows: f.rows, dropped: f.dropped } });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${f.fileName}"`);
    res.send(f.buffer);
  },
});
define({
  method: 'POST', path: '/lists/:id/send', summary: 'Mark a downloaded Draft list as sent to Talkbot with the Talkbot task name', screen: `${SCREEN} > Call list > Mark as sent`,
  middleware: [...write, validate(z.object({ taskName: z.string().max(200).optional().nullable() }))], request: { taskName: 'TIS_MV - OCT 07, 2026' }, response: { success: true, data: listExample },
  handler: async (req, res) => {
    const r = await svc.markSent(req.params.id, req.body.taskName, req.user.id);
    await audit(req, { entity: 'talkbot_call_list', entityId: r.after.id, action: 'mark-sent', before: { status: r.before.status }, after: { status: r.after.status, taskName: r.after.taskName } });
    ok(res, r.after, `Call list ${r.after.listNumber} marked as sent to Talkbot`);
  },
});
define({
  method: 'POST', path: '/lists/:id/cancel', summary: 'Cancel a Draft or Sent call list with a reason code (context talkbot_list_cancel)', screen: `${SCREEN} > Call list > Cancel list`,
  middleware: [...write, validate(reasonBody)], request: { reasonCode: 'TBC-NOT-RUN' }, response: { success: true, data: listExample },
  handler: async (req, res) => {
    const r = await svc.cancelList(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'talkbot_call_list', entityId: r.after.id, action: 'cancel', before: { status: r.before.status }, after: { status: r.after.status, reason: r.reason.text, reasonCode: r.reason.code } });
    ok(res, r.after, `Call list ${r.after.listNumber} cancelled`);
  },
});
define({
  method: 'POST', path: '/lists/:id/close', summary: 'Close a call list whose results were loaded', screen: `${SCREEN} > Call list > Close list`, middleware: write,
  response: { success: true, data: listExample },
  handler: async (req, res) => {
    const r = await svc.closeList(req.params.id, req.user.id);
    await audit(req, { entity: 'talkbot_call_list', entityId: r.after.id, action: 'close', before: { status: r.before.status }, after: { status: r.after.status } });
    ok(res, r.after, `Call list ${r.after.listNumber} closed`);
  },
});
define({
  method: 'GET', path: '/results/template', summary: 'Talkbot call results template (Data, Columns and Instructions sheets with the 13 columns BrokerVerse reads)',
  screen: `${SCREEN} > Upload results > Download template`, middleware: read, response: '(xlsx file)',
  handler: async (_req, res) => sendTemplate(res, 'talkbot-results'),
});
define({
  method: 'POST', path: '/lists/:id/results', summary: 'Upload the Talkbot Call Records file of a call list (multipart field "file", .xlsx; confirmTaskName=true loads a file of another Talkbot task)',
  screen: `${SCREEN} > Upload results`, middleware: [...write, uploadFile], request: 'multipart/form-data file, confirmTaskName',
  response: { success: true, message: 'Processed 1,529 rows: 1,529 loaded, 0 failed', data: { total: 1529, loaded: 1529, failed: 0, errors: [], outcomeCounts: { willing: 37, 'missed-call': 261 } } },
  handler: async (req, res) => {
    const r = await results.uploadResults(req.params.id, req.file, { confirmTaskName: ['true', true, '1'].includes(req.body?.confirmTaskName) }, req.user);
    await audit(req, { entity: 'talkbot_call_list', entityId: req.params.id, action: 'upload-results', after: { listNumber: r.listNumber, uploadNumber: r.uploadNumber, fileName: req.file?.originalname,
      rows: r.total, loaded: r.loaded, failed: r.failed, outcomeCounts: r.outcomeCounts } });
    ok(res, r, r.message);
  },
});
define({
  method: 'GET', path: '/lists/:id/uploads', summary: 'Uploads of a call list with their counts and failed rows', screen: `${SCREEN} > Call list > Uploads`, middleware: read,
  response: { success: true, data: [{ uploadNumber: 1, fileName: 'CallRecords_07-10-2026.xlsx', total: 1529, loaded: 1529, failed: 0, fileAvailable: true }] },
  handler: async (req, res) => ok(res, await results.listUploads(req.params.id)),
});
define({
  method: 'GET', path: '/lists/:id/uploads/:uploadId/file', summary: 'The call records file of an upload as it was uploaded (kept talkbot.file_retention_days)', screen: `${SCREEN} > Call list > Uploads`,
  middleware: write, response: '(xlsx file)',
  handler: async (req, res) => {
    const f = await results.uploadFile(req.params.id, req.params.uploadId);
    res.setHeader('Content-Disposition', `attachment; filename="${String(f.fileName).replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.sendFile(resolveKey(f.key));
  },
});
define({
  method: 'GET', path: '/lists/:id/lines/:lineId/attempts', summary: 'The call attempts of an account with the Call ID and the upload they came from', screen: `${SCREEN} > Call list > Calls`,
  middleware: read, response: { success: true, data: [{ callId: '3422766876', result: 'Connected(200)', callTime: '2026-10-07T06:52:10Z', callResult: 'Will Renew', outcome: 'willing', uploadNumber: 1 }] },
  handler: async (req, res) => ok(res, await results.lineAttempts(req.params.id, req.params.lineId)),
});
define({
  method: 'POST', path: '/lists/:id/lines/:lineId/outcome', summary: 'Record or correct the Talkbot outcome of an account by hand (remark required; any outcome but Not called)',
  screen: `${SCREEN} > Call list > Record outcome`, middleware: [...write, validate(outcomeBody)], request: { outcome: 'willing', date: '2026-10-08', remark: 'Client called the hotline 08/10/2026' },
  response: { success: true, message: 'Outcome recorded for policy POL-2025-41187', data: { policyNumber: 'POL-2025-41187', after: { outcome: 'willing', source: 'manual' } } },
  handler: async (req, res) => {
    const r = await results.recordOutcome(req.params.id, req.params.lineId, req.body, req.user);
    await audit(req, { entity: 'talkbot_call_line', entityId: req.params.lineId, action: 'record-outcome', before: r.before, after: { listNumber: r.listNumber, policyNumber: r.policyNumber, ...r.after, remark: r.after.detail } });
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/lists/:id/renewal-batches', summary: 'Create renewal batch: a Draft renewal batch (at most renewals.batch_max_policies policies each) with the Talkbot-confirmed accounts not yet in a batch',
  screen: `${SCREEN} > Call list > Create renewal batch`, middleware: batchWrite,
  response: { success: true, message: 'Renewal batch RB-2026-90014 created with 37 policies', data: { listNumber: 'TCL-2026-00014', batches: [{ batchNumber: 'RB-2026-90014', policies: 37 }] } },
  handler: async (req, res) => {
    const r = await svc.createRenewalBatches(req.params.id, req.user);
    for (const b of r.batches) await audit(req, { entity: 'renewal-batch', entityId: b.id, action: 'create', after: { batchId: b.batchNumber, totalPolicies: b.policies, talkbotCallList: r.listNumber } });
    await audit(req, { entity: 'talkbot_call_list', entityId: req.params.id, action: 'create-renewal-batch', after: { listNumber: r.listNumber, batches: r.batches.map((b) => b.batchNumber) } });
    const message = r.batches.map((b) => `Renewal batch ${b.batchNumber} created with ${b.policies} policies`).join('; ');
    created(res, r, message);
  },
});

export default router;
export const mount = '/talkbot';
