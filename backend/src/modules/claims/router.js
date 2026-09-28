import multer from 'multer';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { sendSheet } from './docs.js';
import * as svc from './service.js';

/**
 * Claims (Operations > Claims wizard, Claims Dashboard, Operational Reports > Claims).
 * Multipart bodies (claim document, adjuster file, settlement document) are accepted where the front end sends FormData.
 */
const { router, define } = moduleRouter('Claims', '/claims');
const multerAny = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 5 } }).any();
/** Parse multipart bodies (no-op for JSON); upload errors become 400s. */
const upload = { any: () => (req, res, next) => multerAny(req, res, (e) => next(e ? badRequest(e.message) : undefined)) };
const read = [requireAuth, requirePermission('read:claims')];
const write = [requireAuth, requirePermission('write:claims')];
const str = z.union([z.string(), z.number(), z.boolean()]).optional().nullable();

const createSchema = z.object({
  policyNumber: str, policyRefId: str, policyId: str, dateOfIncident: z.string().min(1, 'dateOfIncident is required'),
  reportedDate: str, timeOfIncident: str, addressOfIncident: str, cityOfIncident: str, provinceOfIncident: str, typeOfIncident: str,
  estimatedClaimAmount: str, claimType: str, claimPriority: str, lob: str, handlerUserId: str, description: z.string().max(4000).optional().nullable(),
}).passthrough();
const settleSchema = z.object({ settlementType: str, settlementAmount: str, settlementIssueDate: str, settlementDate: str }).passthrough();

const claimExample = { id: 'clm_1a2b', claimNumber: 'CLM-2026-00001', status: 'Pending', claimStatus: 'Pending', lifecycleStatus: 'registered', policyNumber: 'POL-2026-00001', policyHolderName: 'Maria Santos', lob: 'MOTOR', dateOfIncident: '2026-09-20', reportedDate: '2026-09-21', estimatedClaimAmount: 85000, policy: { policyNumber: 'POL-2026-00001', clientId: 'cl_1' } };

define({
  method: 'GET', path: '/report', summary: 'Claims dashboard data (summary, breakdowns, ageing, detailed rows); format=excel downloads an .xlsx', screen: 'Claims > Claims Dashboard',
  middleware: [requireAuth, requirePermission('read:claims', 'read:reports')], query: { startDate: '2026-01-01', endDate: '2026-09-28', includeData: true, format: 'excel' },
  response: { success: true, data: { dateRange: { startDate: '2026-01-01', endDate: '2026-09-28' }, summary: { totalOpenClaims: 8, totalAgingClaims: 2, todaysClaims: 1, maxClaimsByState: { state: 'Metro Manila', count: 6, percentage: 40 } }, breakdown: { byType: [{ type: 'Motor', count: 12 }], byStatus: [{ status: 'Settled', count: 5 }], byLOB: [{ lob: 'MOTOR', count: 12 }], byState: [], agingBreakdown: { recent: 3, moderate: 2, high: 1, critical: 2 } }, detailedClaims: [] } },
  handler: async (req, res) => {
    const data = await svc.claimsReport(req.query);
    if (['excel', 'xlsx', 'csv'].includes(String(req.query.format || '').toLowerCase())) {
      const rows = data.detailedClaims || (await svc.claimsReport({ ...req.query, includeData: 'true' })).detailedClaims;
      const summary = [
        { k: 'Period', v: `${data.dateRange.startDate} to ${data.dateRange.endDate}` }, { k: 'Total claims', v: data.summary.totalClaims },
        { k: 'Open claims', v: data.summary.totalOpenClaims }, { k: 'Overdue claims', v: data.summary.totalAgingClaims },
        { k: "Today's claims", v: data.summary.todaysClaims }, { k: 'Estimated amount', v: data.summary.totalEstimatedAmount }, { k: 'Settled amount', v: data.summary.totalSettledAmount },
        ...data.breakdown.byStatus.map((s) => ({ k: `Status: ${s.status}`, v: s.count })),
      ];
      return sendSheet(res, { fileName: `claims-report-${data.dateRange.startDate}-to-${data.dateRange.endDate}`, format: String(req.query.format).toLowerCase() === 'csv' ? 'csv' : 'excel',
        sheets: [{ name: 'Claims', columns: svc.REPORT_COLUMNS, rows }, { name: 'Summary', columns: [{ key: 'k', header: 'Measure' }, { key: 'v', header: 'Value' }], rows: summary }] });
    }
    return ok(res, data);
  },
});
define({
  method: 'GET', path: '/reports/criteria', summary: 'Claims report by criteria (All | Open | Settled | Rejected | Aging) as an .xlsx download (reportType=json for JSON)', screen: 'Reports > Operational Reports > Claims',
  middleware: [requireAuth, requirePermission('read:claims', 'read:reports')], query: { startDate: '2026-01-01', endDate: '2026-09-28', criteria: 'Open', reportType: 'excel' },
  response: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (claims-report-Open-2026-01-01-to-2026-09-28.xlsx)',
  handler: async (req, res) => {
    const { start, end, rows } = await svc.criteriaRows(req.query);
    if (String(req.query.reportType).toLowerCase() === 'json') return ok(res, { criteria: req.query.criteria || 'All', startDate: start, endDate: end, rows, total: rows.length });
    return sendSheet(res, { fileName: `claims-report-${req.query.criteria || 'All'}-${start}-to-${end}`, format: String(req.query.reportType).toLowerCase() === 'csv' ? 'csv' : 'excel', sheets: [{ name: 'Claims', columns: svc.REPORT_COLUMNS, rows }] });
  },
});
define({
  method: 'GET', path: '/audit-trail/:id', summary: 'Field-level audit trail of a claim', screen: 'Operations > Claims > Audit trail', middleware: read,
  query: { sort: 'desc' }, response: { success: true, data: [{ id: 1, timestamp: '2026-09-21T02:00:00Z', action: 'Status Changed', fieldName: 'claimStatus', oldValue: 'registered', newValue: 'in-review', user: 'j.claims' }], total: 1, sort: 'desc' },
  handler: async (req, res) => { const rows = await svc.auditTrail(req.params.id, req.query.sort); res.json({ success: true, data: rows, total: rows.length, sort: req.query.sort === 'asc' ? 'asc' : 'desc' }); },
});
define({
  method: 'GET', path: '/getdocuments/:id', summary: 'Download a claim document (uploaded file, or generated PDF: Claims Acknowledgement Letter, Claims Discharge Voucher, Claims Data Sheet)', screen: 'Operations > Claims > Claim detailed view',
  middleware: read, query: { documentName: 'Claims Acknowledgement Letter' }, response: 'application/pdf',
  handler: async (req, res) => {
    const doc = await svc.claimDocument(req.params.id, req.query.documentName);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${String(doc.fileName).replace(/"/g, '')}"`);
    return doc.file ? res.sendFile(doc.file) : res.send(doc.buffer);
  },
});
define({
  method: 'PUT', path: '/updatestatus/:id', summary: 'Move a claim to review / closed / rejected (claimStatus accepts a code or label, e.g. Processing)', screen: 'Operations > Claims > Request approval',
  middleware: [...write, validate(z.object({ claimStatus: z.string().min(1), note: z.string().max(2000).optional() }).passthrough())],
  request: { claimStatus: 'Processing', note: 'Documents complete' }, response: { success: true, message: 'Claim status updated', data: claimExample },
  handler: async (req, res) => {
    const r = await svc.updateStatus(req.params.id, req.body.claimStatus, req.user, req.body.note);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'status', before: { status: r.from }, after: { status: r.claim.lifecycleStatus } });
    ok(res, r.claim, 'Claim status updated');
  },
});
define({
  method: 'PUT', path: '/rejectclaim/:id', summary: 'Reject a claim', screen: 'Operations > Claims > Settlement approval', middleware: write,
  request: { reason: 'Loss not covered' }, response: { success: true, message: 'Claim rejected', data: { ...claimExample, status: 'Rejected' } },
  handler: async (req, res) => {
    const r = await svc.rejectClaim(req.params.id, req.user, req.body?.reason);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'reject', before: { status: r.from }, after: { status: 'rejected', reason: req.body?.reason } });
    ok(res, r.claim, 'Claim rejected');
  },
});
define({
  method: 'PUT', path: '/settle/:id', summary: 'Submit the settlement (multipart; goes to Pending Approval when maker-checker is on) or mark an approved claim settled', screen: 'Operations > Claims > Settlement details',
  middleware: [...write, upload.any(), validate(settleSchema)],
  request: { settlementType: 'Cash', settlementAmount: 75000, settlementIssueDate: '2026-09-25', settlementDate: '2026-09-28', settlementDocument: '(file)' },
  response: { success: true, message: 'Settlement submitted for approval', data: { ...claimExample, status: 'Pending Approval' } },
  handler: async (req, res) => {
    const r = await svc.settleClaim(req.params.id, req.body, req.user, req.files);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'settle', before: { status: r.from }, after: { status: r.claim.lifecycleStatus, settlement: r.claim.settlement } });
    ok(res, r.claim, r.pendingApproval ? 'Settlement submitted for approval' : 'Claim settled');
  },
});
define({
  method: 'PUT', path: '/approve-settlement/:id', summary: 'Checker decision on a pending settlement (decision approve | return); the approver must differ from the requester', screen: 'Operations > Claims > Settlement approval',
  middleware: [...write, validate(z.object({ decision: z.enum(['approve', 'return', 'reject']).default('approve'), approvedAmount: z.coerce.number().positive().optional(), note: z.string().max(2000).optional() }))],
  request: { decision: 'approve', approvedAmount: 75000, note: 'Within authority' }, response: { success: true, message: 'Settlement approved', data: { ...claimExample, status: 'Settled' } },
  handler: async (req, res) => {
    const r = await svc.approveSettlement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: req.body.decision === 'approve' ? 'approve-settlement' : 'return-settlement', before: { status: r.from }, after: { status: r.claim.lifecycleStatus, approvedAmount: r.claim.approvedAmount } });
    ok(res, r.claim, req.body.decision === 'approve' ? 'Settlement approved' : 'Settlement returned for review');
  },
});
define({
  method: 'PUT', path: '/close/:id', summary: 'Close a settled or rejected claim', screen: 'Operations > Claims', middleware: write,
  request: { note: 'File closed' }, response: { success: true, message: 'Claim closed', data: { ...claimExample, status: 'Closed' } },
  handler: async (req, res) => {
    const r = await svc.updateStatus(req.params.id, 'closed', req.user, req.body?.note);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'close', before: { status: r.from }, after: { status: 'closed' } });
    ok(res, r.claim, 'Claim closed');
  },
});
define({
  method: 'GET', path: '/', summary: 'Claims list (filters: status, clientId, policyId, lob, handlerUserId, search, dateFrom, dateTo; paging page/pageSize)', screen: 'Operations > Claims; Clients > Claims tab',
  middleware: read, query: { page: 1, pageSize: 10, status: 'Processing', search: 'CLM-2026' },
  response: { success: true, data: { claims: [claimExample], pagination: { total: 1, page: 1, pageSize: 10, limit: 10, totalPages: 1 } }, total: 1, page: 1, perPage: 10, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, items } = await svc.listClaims(req.query, pg);
    const meta = pageMeta(total, pg);
    res.json({ success: true, message: 'OK', data: { claims: items, pagination: { total, page: pg.page, pageSize: pg.perPage, limit: pg.perPage, totalPages: meta.totalPages } }, ...meta });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Claim details (by id or claim number) with policy, documents and status history', screen: 'Operations > Claims > Claim wizard / detailed view',
  middleware: read, response: { success: true, data: claimExample },
  handler: async (req, res) => ok(res, await svc.getClaim(req.params.id)),
});
define({
  method: 'POST', path: '/', summary: 'Register a claim (multipart). Blocked when premium is unpaid or the loss date is outside the policy period; sends the Preliminary Loss Advice', screen: 'Operations > Claims > Send mail',
  middleware: [...write, upload.any(), validate(createSchema)],
  request: { policyNumber: 'POL-2026-00001', policyRefId: 'pol_1', lob: 'MOTOR', claimType: 'Motor', claimPriority: 'High', dateOfIncident: '2026-09-20', timeOfIncident: '14:30', addressOfIncident: 'EDSA cor. Ayala Ave', cityOfIncident: 'Makati', provinceOfIncident: 'Metro Manila', typeOfIncident: 'Collision', estimatedClaimAmount: 85000, policyInfo: '{"policyHolderName":"Maria Santos"}', driverDetails: '{"driverName":"Jose Santos"}', thirdPartyDetails: '{"thirdPartyName":"Pedro Cruz"}', emailData: '{"mailSubject":"New Claim Notification","write":"Please see attached"}', claimDocument: '(file)' },
  response: { success: true, message: 'Claim registered', data: claimExample },
  handler: async (req, res) => {
    const claim = await svc.createClaim(req.body, req.user, req.files);
    await audit(req, { entity: 'claim', entityId: claim.id, action: 'create', after: { claimNumber: claim.claimNumber, policyNumber: claim.policyNumber, status: claim.lifecycleStatus } });
    created(res, claim, 'Claim registered');
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Update claim details / adjuster report (multipart; file stored as FIR)', screen: 'Operations > Claims > Adjuster submission',
  middleware: [...write, upload.any()],
  request: { insuranceCompanyClaimNumber: 'MAPFRE-CL-7781', reportedDate: '2026-09-21', dateOfIncident: '2026-09-20', addressOfIncident: 'EDSA', driverName: 'Jose Santos', adjusterName: 'Cunningham Lindsey PH', adjusterStatus: 'Assigned', 'thirdPartyDetails[thirdPartyName]': 'Pedro Cruz', file: '(file)' },
  response: { success: true, message: 'Claim updated', data: claimExample },
  handler: async (req, res) => {
    const r = await svc.updateClaim(req.params.id, req.body || {}, req.user, req.files);
    await audit(req, { entity: 'claim', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Claim updated');
  },
});

export default router;
export const mount = '/claims';
