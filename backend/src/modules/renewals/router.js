import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { sendSheet } from '../claims/docs.js';
import * as svc from './service.js';
import * as batches from './batches.js';
import { getJob, queueStats } from './queue.js';
import workspace from './workspace.js';

/**
 * Policy renewals used by the agent screens: client view renewals tab, renewal quote wizard (coverage -> order summary),
 * Renewal Batch (queued notices) and its PostgreSQL job queue.
 */
const { router, define } = moduleRouter('Policy renewals', '/policy-renewals');
const read = [requireAuth, requirePermission('read:renewals')];
const write = [requireAuth, requirePermission('write:renewals')];
const captureSchema = z.object({
  coverageDetails: z.record(z.any()).optional(), accessories: z.any().optional(), orderSummary: z.record(z.any()).optional(),
  policyLimits: z.any().optional(), premiumBreakdown: z.record(z.any()).optional(), effectiveDate: z.any().optional(), expiryDate: z.any().optional(),
  remarks: z.string().max(2000).optional().nullable(), priority: z.string().max(20).optional(),
}).passthrough();
const renewalExample = { id: 'rnw_1', renewalNumber: 'RN-2026-00001', policyId: 'pol_1', policyNumber: 'POL-2025-00012', clientId: 'cl_1', insuredName: 'Maria Santos', status: 'Quote Sent', statusCode: 'quoted', policyExpiry: '2026-10-30', grossPremium: 21450.5, paymentStatus: 'Paid', coverageDetails: { lossAndDamageCoverage: '850000', totalSumInsured: '850000' }, policy: { policyNumber: 'POL-2025-00012' } };
const batchExample = { id: 'rb_1', batchId: 'RB-2026-00001', status: 'Draft', totalPolicies: 12, processedCount: 0, createdAt: '2026-09-28T01:00:00Z' };
const listMeta = (res, items, total, pg, key) => res.json({ success: true, message: 'OK', data: items, [key]: items, pagination: { page: pg.page, limit: pg.perPage, pageSize: pg.perPage, total, totalPages: Math.ceil(total / pg.perPage) }, ...pageMeta(total, pg) });

// ---------------------------------------------------------------- queue
define({
  method: 'GET', path: '/queue-stats', summary: 'Job queue counters (waiting, processing, completed, failed)', screen: 'Operations > Renewals > Renewal Batch', middleware: read,
  query: { queue: 'renewal-notices' }, response: { success: true, data: { waiting: 0, processing: 1, active: 1, completed: 12, failed: 0, delayed: 0, total: 13 } },
  handler: async (req, res) => ok(res, await queueStats(req.query.queue || batches.QUEUE)),
});
define({
  method: 'GET', path: '/queue/:jobId', summary: 'Status and progress of a queued job', screen: 'Operations > Renewals > Renewal Batch (polling)', middleware: read,
  response: { success: true, data: { jobId: '15', status: 'processing', progress: { total: 10, processed: 4, succeeded: 4, failed: 0 } } },
  handler: async (req, res) => ok(res, await getJob(req.params.jobId)),
});

// ---------------------------------------------------------------- batches
define({
  method: 'POST', path: '/create-batches', summary: 'Create a renewal batch from selected policies (id or policy number) or from criteria', screen: 'Operations > Renewals > Renewal Batch > Create Batch',
  middleware: [...write, validate(z.object({ criteriaOption: z.record(z.any()).optional(), policies: z.array(z.union([z.string(), z.object({ policyId: z.string().optional(), policyNumber: z.string().optional(), isSelected: z.boolean().optional() }).passthrough()])).optional(), status: z.string().optional() }).passthrough())],
  request: { criteriaOption: { expiryDateFrom: '2026-10-01', expiryDateTo: '2026-10-31', insuranceCompanyName: '', productType: 'Motor' }, policies: [{ policyId: 'POL-2025-00012', isSelected: false }], status: 'Draft' },
  response: { success: true, message: 'Renewal batch created', data: { ...batchExample, policies: [] } },
  handler: async (req, res) => {
    const b = await batches.createBatch(req.body, req.user);
    await audit(req, { entity: 'renewal-batch', entityId: b.id, action: 'create', after: { batchId: b.batchId, totalPolicies: b.totalPolicies } });
    created(res, b, 'Renewal batch created');
  },
});
define({
  method: 'GET', path: '/batches', summary: 'Renewal batches (status, search, sortField, sortOrder, page, limit)', screen: 'Operations > Renewals > Renewal Batch', middleware: read,
  query: { page: 1, limit: 20, status: 'Draft' }, response: { success: true, data: [batchExample], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
  handler: async (req, res) => { const pg = paging(req.query, { page: 1, perPage: 50 }); const { total, items } = await batches.listBatches(req.query, pg); listMeta(res, items, total, pg, 'batches'); },
});
define({
  method: 'GET', path: '/batches/:id', summary: 'Batch with its policies and notice status', screen: 'Operations > Renewals > Renewal Batch > Batch details', middleware: read,
  response: { success: true, data: { ...batchExample, policies: [{ id: 1, policyId: 'pol_1', isSelected: true, noticeStatus: 'Sent', noticeSentAt: '2026-09-28T01:05:00Z', policy: { policyNumber: 'POL-2025-00012', insuranceCompanyName: 'MAPFRE Insurance Corporation' } }] } },
  handler: async (req, res) => ok(res, await batches.getBatch(req.params.id)),
});
define({
  method: 'PUT', path: '/batches/:id', summary: 'Update batch criteria or status (Draft | Cancelled | Completed)', screen: 'Operations > Renewals > Renewal Batch',
  middleware: [...write, validate(z.object({ criteriaOption: z.record(z.any()).optional(), status: z.string().optional() }).passthrough())],
  request: { status: 'Cancelled' }, response: { success: true, data: batchExample },
  handler: async (req, res) => {
    const r = await batches.updateBatch(req.params.id, req.body);
    await audit(req, { entity: 'renewal-batch', entityId: r.after.id, action: 'update', before: r.before, after: { status: r.after.status, criteriaOption: r.after.criteriaOption } });
    ok(res, r.after, 'Batch updated');
  },
});
define({
  method: 'DELETE', path: '/batches/:id', summary: 'Delete a batch that has not sent notices', screen: 'Operations > Renewals > Renewal Batch', middleware: write,
  response: { success: true, message: 'Batch deleted' },
  handler: async (req, res) => { const b = await batches.deleteBatch(req.params.id); await audit(req, { entity: 'renewal-batch', entityId: b.id, action: 'delete', before: b }); ok(res, { id: b.id, batchId: b.batchId }, 'Batch deleted'); },
});
define({
  method: 'GET', path: '/batches/:id/policies', summary: 'Batch policies (noticeStatus, isSelected, page, pageSize)', screen: 'Operations > Renewals > Renewal Batch', middleware: read,
  query: { noticeStatus: 'Failed', page: 1, pageSize: 20 }, response: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
  handler: async (req, res) => { const pg = paging(req.query, { page: 1, perPage: 50 }); const { total, items } = await batches.batchPolicies(req.params.id, req.query, pg); listMeta(res, items, total, pg, 'policies'); },
});
define({
  method: 'PUT', path: '/batches/:id/policies/:policyId', summary: 'Select / unselect a policy in a batch', screen: 'Operations > Renewals > Renewal Batch',
  middleware: [...write, validate(z.object({ isSelected: z.boolean() }))], request: { isSelected: true }, response: { success: true, data: { id: 1, isSelected: true } },
  handler: async (req, res) => {
    const p = await batches.setSelection(req.params.id, req.params.policyId, req.body.isSelected);
    await audit(req, { entity: 'renewal-batch', entityId: req.params.id, action: 'select', after: { policyId: p.policyId, isSelected: p.isSelected } });
    ok(res, p);
  },
});
define({
  method: 'POST', path: '/batches/:id/send-notices', summary: 'Queue renewal notices for the selected policies (background job; poll /queue/:jobId)', screen: 'Operations > Renewals > Renewal Batch > Send Renewal Notices',
  middleware: [...write, validate(z.object({ selectedPolicyIds: z.array(z.string()).optional(), policyIds: z.array(z.string()).optional() }).passthrough())],
  request: { batchId: 'RB-2026-00001', selectedPolicyIds: ['pol_1', 'pol_2'] }, response: { success: true, message: 'Renewal notices queued', data: { jobId: '15', queued: 2, batchId: 'RB-2026-00001' } },
  handler: async (req, res) => {
    const r = await batches.queueNotices(req.params.id, req.body.selectedPolicyIds || req.body.policyIds, req.user);
    await audit(req, { entity: 'renewal-batch', entityId: req.params.id, action: 'send-notices', after: r });
    ok(res, r, 'Renewal notices queued');
  },
});
define({
  method: 'POST', path: '/batches/:id/retry-failed', summary: 'Requeue failed notices of a batch', screen: 'Operations > Renewals > Renewal Batch > Retry Failed', middleware: write,
  response: { success: true, message: 'Failed notices requeued', data: { jobId: '16', queued: 1 } },
  handler: async (req, res) => {
    const r = await batches.retryFailed(req.params.id, req.user);
    await audit(req, { entity: 'renewal-batch', entityId: req.params.id, action: 'retry-failed', after: r });
    ok(res, r, 'Failed notices requeued');
  },
});
define({
  method: 'GET', path: '/batches/:id/notice-status', summary: 'Notice status counts of a batch', screen: 'Operations > Renewals > Renewal Batch', middleware: read,
  response: { success: true, data: { total: 12, NotSent: 2, Queued: 0, Sent: 9, Failed: 1 } },
  handler: async (req, res) => ok(res, await batches.noticeStatus(req.params.id)),
});
define({
  method: 'GET', path: '/batches/:id/statistics', summary: 'Batch statistics (counts, premium, success rate)', screen: 'Operations > Renewals > Renewal Batch', middleware: read,
  response: { success: true, data: { total: 12, Sent: 9, Failed: 1, totalPremium: 254000, successRate: 75 } },
  handler: async (req, res) => ok(res, await batches.statistics(req.params.id)),
});
define({
  method: 'GET', path: '/batches/:id/report', summary: 'Batch report download (.xlsx; format=csv for CSV)', screen: 'Operations > Renewals > Renewal Batch > Generate Report', middleware: read,
  response: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  handler: async (req, res) => {
    const { batch, rows } = await batches.reportRows(req.params.id);
    sendSheet(res, { fileName: `renewal-batch-${batch.batchId}`, format: req.query.format === 'csv' ? 'csv' : 'excel', sheets: [{ name: batch.batchId, columns: batches.REPORT_COLUMNS, rows }] });
  },
});

// ---------------------------------------------------------------- renewals of a policy
define({
  method: 'POST', path: '/policies/:policyId/renewals', summary: 'Create (or update the open) renewal of a policy with the wizard data', screen: 'Operations > Policy > Renew (coverage details, order summary)',
  middleware: [...write, validate(captureSchema)],
  request: { coverageDetails: { lossAndDamageCoverage: '850000', bodilyInjury: '200000' }, accessories: [], orderSummary: { netPremium: 17800, grossPremium: 21450.5 }, effectiveDate: '2026-10-31', expiryDate: '2027-10-30' },
  response: { success: true, message: 'Renewal saved', data: renewalExample },
  handler: async (req, res) => {
    const { id, created: isNew } = await svc.ensureRenewal(req.params.policyId, req.user);
    const r = await svc.captureRenewal(id, req.body);
    await audit(req, { entity: 'renewal', entityId: id, action: isNew ? 'create' : 'update', before: isNew ? null : svc.toApi(r.before, await svc.readContext()), after: r.after });
    res.status(isNew ? 201 : 200).json({ success: true, message: isNew ? 'Renewal created' : 'Renewal updated', data: r.after });
  },
});
define({
  method: 'GET', path: '/', summary: 'Renewals (clientId, policyId, status, search, page, limit)', screen: 'Clients > Renewals tab; renewal quote wizard', middleware: read,
  query: { clientId: 'cl_1', page: 1, limit: 50 }, response: { success: true, data: [renewalExample], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } },
  handler: async (req, res) => { const pg = paging(req.query, { page: 1, perPage: 50 }); const { total, items } = await svc.listRenewals(req.query, pg); listMeta(res, items, total, pg, 'renewals'); },
});
define({
  method: 'GET', path: '/:renewalId', summary: 'Renewal with quotes, notices and activity timeline', screen: 'Operations > Renewals', middleware: read,
  response: { success: true, data: { ...renewalExample, quotes: [], notices: [], activities: [] } },
  handler: async (req, res) => ok(res, await svc.getRenewal(req.params.renewalId)),
});
define({
  method: 'PUT', path: '/:renewalId', summary: 'Update the renewal wizard data (coverage, accessories, order summary, dates)', screen: 'Operations > Policy > Renew (coverage details)',
  middleware: [...write, validate(captureSchema)], request: { coverageDetails: { lossAndDamageCoverage: '900000' }, orderSummary: { grossPremium: 22800 } },
  response: { success: true, message: 'Renewal updated', data: renewalExample },
  handler: async (req, res) => {
    const r = await svc.captureRenewal(req.params.renewalId, req.body);
    await audit(req, { entity: 'renewal', entityId: r.after.id, action: 'update', before: svc.toApi(r.before, await svc.readContext()), after: r.after });
    ok(res, r.after, 'Renewal updated');
  },
});

export default router;
export const mount = '/policy-renewals';
export const extraMounts = [['/renewals', workspace]];
