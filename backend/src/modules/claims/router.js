import { memoryUpload } from '../../lib/uploadLimits.js';
import { checkUploadedFiles } from '../uploads/fileTypes.js';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { assertVisible, ownRecord, withScope } from '../../lib/scope.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { sendSheet } from './docs.js';
import { printFormat } from '../../lib/pdf/index.js';
import { formatDatesIn } from '../../lib/pdf/format.js';
import * as svc from './service.js';
import * as cash from './cash.js';
import * as insurer from './insurer.js';

/**
 * Claims (Operations > Claims wizard, Claims Dashboard, Operational Reports > Claims).
 * Multipart bodies (claim document, adjuster file, settlement document) are accepted where the front end sends FormData.
 */
const { router, define } = moduleRouter('Claims', '/claims');
const multerAny = memoryUpload({ files: 5 }).any();
/** Parse multipart bodies (no-op for JSON); upload errors become 400s. */
const upload = { any: () => (req, res, next) => multerAny(req, res, (e) => next(e ? badRequest(e.message) : undefined)) };
const read = [requireAuth, requirePermission('read:claims')];
const write = [requireAuth, requirePermission('write:claims')];
/** Status decisions (review, reject, settle, approve settlement, close) need approve:claims; the others register, update and upload only. */
const decide = [...write, requirePermission('approve:claims')];
const policyRef = (req) => [req.body?.policyRefId, req.body?.policyId, req.body?.policyNumber].find((v) => v && !svc.PLACEHOLDER_REFS.has(String(v)));
const str = z.union([z.string(), z.number(), z.boolean()]).optional().nullable();

const createSchema = z.object({
  policyNumber: str, policyRefId: str, policyId: str, dateOfIncident: z.string().min(1, 'dateOfIncident is required'),
  reportedDate: str, timeOfIncident: str, addressOfIncident: str, cityOfIncident: str, provinceOfIncident: str, typeOfIncident: str,
  estimatedClaimAmount: str, claimType: str, claimPriority: str, lob: str, handlerUserId: str, description: z.string().max(4000).optional().nullable(),
  fnolSource: z.string().max(60).optional().nullable(), lossExtent: z.enum(['partial', 'total', '']).optional().nullable(), confirmDuplicate: str,
}).passthrough();
const settleSchema = z.object({ settlementType: str, settlementAmount: str, settlementIssueDate: str, settlementDate: str, settlementKind: z.enum(['partial', 'final']).optional() }).passthrough();

const claimExample = { id: 'clm_1a2b', claimNumber: 'CLM-2026-00001', status: 'Pending', claimStatus: 'Pending', lifecycleStatus: 'registered', policyNumber: 'POL-2026-00001', policyHolderName: 'Maria Santos', lob: 'MOTOR', dateOfIncident: '2026-09-20', reportedDate: '2026-09-21', estimatedClaimAmount: 85000, policy: { policyNumber: 'POL-2026-00001', clientId: 'cl_1' } };

define({
  method: 'GET', path: '/report', summary: 'Claims dashboard data (summary, breakdowns, ageing, detailed rows); format=excel downloads an .xlsx', screen: 'Claims > Claims Dashboard',
  middleware: read, query: { startDate: '2026-01-01', endDate: '2026-09-28', includeData: true, format: 'excel' },
  response: { success: true, data: { dateRange: { startDate: '2026-01-01', endDate: '2026-09-28' }, summary: { totalOpenClaims: 8, totalAgingClaims: 2, todaysClaims: 1, maxClaimsByState: { state: 'Metro Manila', count: 6, percentage: 40 } }, breakdown: { byType: [{ type: 'Motor', count: 12 }], byStatus: [{ status: 'Settled', count: 5 }], byLOB: [{ lob: 'MOTOR', count: 12 }], byState: [], agingBreakdown: { recent: 3, moderate: 2, high: 1, critical: 2 } }, detailedClaims: [] } },
  handler: async (req, res) => {
    const data = await svc.claimsReport(await withScope(req));
    if (['excel', 'xlsx', 'csv'].includes(String(req.query.format || '').toLowerCase())) {
      const rows = data.detailedClaims || (await svc.claimsReport(await withScope(req, { ...req.query, includeData: 'true' }))).detailedClaims;
      const summary = [
        { k: 'Period', v: formatDatesIn(`${data.dateRange.startDate} to ${data.dateRange.endDate}`, await printFormat()) }, { k: 'Total claims', v: data.summary.totalClaims },
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
  method: 'GET', path: '/reports/criteria', summary: 'Insurance Claims Report by criteria (All | Open | Partial | Settled | Rejected | Cancelled | Aging), claim type, insurer and line, over the reported or (dateBasis=settlement) settlement date, as an .xlsx download (reportType=json for JSON)', screen: 'Reports > Operational Reports > Claims',
  middleware: read, query: { startDate: '2026-01-01', endDate: '2026-09-28', criteria: 'Settled', dateBasis: 'settlement', claimType: 'Motor', insurerId: 2, reportType: 'excel' },
  response: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (claims-report-Open-2026-01-01-to-2026-09-28.xlsx)',
  handler: async (req, res) => {
    const { start, end, rows } = await svc.criteriaRows(await withScope(req));
    if (String(req.query.reportType).toLowerCase() === 'json') return ok(res, { criteria: req.query.criteria || 'All', startDate: start, endDate: end, rows, total: rows.length });
    return sendSheet(res, { fileName: `claims-report-${req.query.criteria || 'All'}-${start}-to-${end}`, format: String(req.query.reportType).toLowerCase() === 'csv' ? 'csv' : 'excel', sheets: [{ name: 'Claims', columns: svc.REPORT_COLUMNS, rows }] });
  },
});
define({
  method: 'GET', path: '/config', summary: 'Claim masters for the claim screens: status labels, settlement types, causes of loss per line, sections per line of business', screen: 'Operations > Claims (all steps)',
  middleware: read,
  response: { success: true, data: { statusLabels: { registered: 'Pending', 'in-review': 'Processing' }, settlementTypes: [{ value: 'Cheque', label: 'Cheque to claimant (insurer direct)' }, { value: 'Through Broker', label: 'Paid through the broker', paidThroughBroker: true }],
    lossCauses: { MOTOR: ['Collision', 'Other'], default: ['Other'] }, lobFields: { MOTOR: ['driver', 'vehicle'], default: [] }, makerChecker: true } },
  handler: async (_req, res) => ok(res, await svc.claimsConfig()),
});
define({
  method: 'GET', path: '/registration-check', summary: 'Before registering a claim on a policy: acceptance problems, outstanding premium, claims ratio of the customer, late intimation and claims already registered for the same date of loss',
  screen: 'Operations > Claims > Claim details', middleware: write, query: { policyId: 'pol_1', lossDate: '2026-09-20', reportedDate: '2026-10-02' },
  response: { success: true, data: { policyNumber: 'POL-2026-00001', outstandingPremium: 0, claimsRatio: { claims: 1, claimsAmount: 20000, premium: 45000, ratio: 44.44 }, intimation: { days: 12, limit: 30, late: false }, duplicates: [], problems: [] } },
  handler: async (req, res) => {
    if (!req.query.policyId) throw badRequest('Validation failed', [{ path: 'policyId', message: 'policyId is required' }]);
    await assertVisible(req, 'policy', req.query.policyId);
    ok(res, await svc.registrationCheck({ policyRef: req.query.policyId, lossDate: req.query.lossDate, reportedDate: req.query.reportedDate }));
  },
});
define({
  method: 'GET', path: '/audit-trail/:id', summary: 'Field-level audit trail of a claim', screen: 'Operations > Claims > Audit trail', middleware: [...read, ownRecord('claim')],
  query: { sort: 'desc' }, response: { success: true, data: [{ id: 1, timestamp: '2026-09-21T02:00:00Z', action: 'Status Changed', fieldName: 'claimStatus', oldValue: 'registered', newValue: 'in-review', user: 'j.claims' }], total: 1, sort: 'desc' },
  handler: async (req, res) => { const rows = await svc.auditTrail(req.params.id, req.query.sort); res.json({ success: true, data: rows, total: rows.length, sort: req.query.sort === 'asc' ? 'asc' : 'desc' }); },
});
define({
  method: 'GET', path: '/getdocuments/:id', summary: 'Download a claim document (uploaded file, or generated PDF: Claims Acknowledgement Letter, Claims Discharge Voucher, Claims Data Sheet)', screen: 'Operations > Claims > Claim detailed view',
  middleware: [...read, ownRecord('claim')], query: { documentName: 'Claims Acknowledgement Letter' }, response: 'application/pdf',
  handler: async (req, res) => {
    const doc = await svc.claimDocument(req.params.id, req.query.documentName);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${String(doc.fileName).replace(/"/g, '')}"`);
    return doc.file ? res.sendFile(doc.file) : res.send(doc.buffer);
  },
});
define({
  method: 'PUT', path: '/updatestatus/:id', summary: 'Move a claim to review / closed / rejected (claimStatus accepts a code or label, e.g. Processing)', screen: 'Operations > Claims > Request approval',
  middleware: [...decide, ownRecord('claim'), validate(z.object({ claimStatus: z.string().min(1), note: z.string().max(2000).optional(), reasonCode: z.string().max(40).optional().nullable() }).passthrough())],
  request: { claimStatus: 'Processing', note: 'Documents complete' }, response: { success: true, message: 'Claim status updated', data: claimExample },
  handler: async (req, res) => {
    const r = await svc.updateStatus(req.params.id, req.body.claimStatus, req.user, req.body.note, req.body.reasonCode);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'status', before: { status: r.from },
      after: { status: r.claim.lifecycleStatus, ...(r.claim.lifecycleStatus === 'rejected' ? { reason: r.claim.rejectedReason, reasonCode: r.claim.rejectedReasonCode } : {}) } });
    ok(res, r.claim, 'Claim status updated');
  },
});
define({
  method: 'PUT', path: '/rejectclaim/:id', summary: 'Reject (repudiate) a claim: reasonCode of the Reason Codes master (repudiation) with the reason as its note, or the reason as text (one is required); the client is e-mailed the reason',
  screen: 'Operations > Claims > Settlement approval', middleware: [...decide, ownRecord('claim')],
  request: { reasonCode: 'REP-NOTCOVERED', reason: 'Flood damage excluded from the motor policy' }, response: { success: true, message: 'Claim rejected', data: { ...claimExample, status: 'Rejected' } },
  handler: async (req, res) => {
    const r = await svc.rejectClaim(req.params.id, req.user, req.body?.reason, req.body?.reasonCode);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'reject', before: { status: r.from }, after: { status: 'rejected', reason: r.claim.rejectedReason, reasonCode: r.claim.rejectedReasonCode } });
    ok(res, r.claim, 'Claim rejected');
  },
});
define({
  method: 'PUT', path: '/cancel/:id', summary: 'Cancel a claim registered in error (pending or processing): reasonCode of the Reason Codes master (claim_cancel) and a note',
  screen: 'Operations > Claims > Claim detail > Cancel claim', middleware: [...decide, ownRecord('claim'), validate(z.object({ reasonCode: z.string().min(1).max(40), note: z.string().max(2000).optional().nullable() }))],
  request: { reasonCode: 'CCN-DUPLICATE', note: 'Same loss as CLM-2026-00014' }, response: { success: true, message: 'Claim cancelled', data: { ...claimExample, status: 'Cancelled' } },
  handler: async (req, res) => {
    const r = await svc.cancelClaim(req.params.id, req.user, req.body);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'cancel', before: { status: r.from }, after: { status: 'cancelled', reason: r.claim.cancelledReason, reasonCode: r.claim.cancelledReasonCode } });
    ok(res, r.claim, 'Claim cancelled');
  },
});
define({
  method: 'PUT', path: '/settle/:id', summary: 'Submit a settlement, partial (settlementKind partial: the claim stays open) or final (multipart; goes to Pending Approval when maker-checker is on), or release an approved claim (not by its requester)', screen: 'Operations > Claims > Settlement details',
  middleware: [...decide, ownRecord('claim'), upload.any(), checkUploadedFiles, validate(settleSchema)],
  request: { settlementType: 'Cash', settlementAmount: 75000, settlementIssueDate: '2026-09-25', settlementDate: '2026-09-28', settlementDocument: '(file)' },
  response: { success: true, message: 'Settlement submitted for approval', data: { ...claimExample, status: 'Pending Approval' } },
  handler: async (req, res) => {
    const r = await svc.settleClaim(req.params.id, req.body, req.user, req.files);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'settle', before: { status: r.from }, after: { status: r.claim.lifecycleStatus, settlement: r.claim.settlement } });
    ok(res, r.claim, r.pendingApproval ? 'Settlement submitted for approval' : 'Claim settled');
  },
});
define({
  method: 'PUT', path: '/approve-settlement/:id', summary: 'Checker decision on a pending settlement (decision approve | return): the approver differs from the requester, approves no more than requested and within the claim settlement limit of the Authority Matrix', screen: 'Operations > Claims > Settlement approval',
  middleware: [...decide, ownRecord('claim'), validate(z.object({ decision: z.enum(['approve', 'return', 'reject']).default('approve'), approvedAmount: z.coerce.number().positive().optional(), note: z.string().max(2000).optional() }))],
  request: { decision: 'approve', approvedAmount: 75000, note: 'Within authority' }, response: { success: true, message: 'Settlement approved', data: { ...claimExample, status: 'Settled' } },
  handler: async (req, res) => {
    const r = await svc.approveSettlement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: req.body.decision === 'approve' ? 'approve-settlement' : 'return-settlement', before: { status: r.from }, after: { status: r.claim.lifecycleStatus, approvedAmount: r.claim.approvedAmount } });
    ok(res, r.claim, req.body.decision === 'approve' ? 'Settlement approved' : 'Settlement returned for review');
  },
});
define({
  method: 'PUT', path: '/close/:id', summary: 'Close a settled or rejected claim', screen: 'Operations > Claims', middleware: [...decide, ownRecord('claim')],
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
    const { total, items } = await svc.listClaims(await withScope(req), pg);
    const meta = pageMeta(total, pg);
    res.json({ success: true, message: 'OK', data: { claims: items, pagination: { total, page: pg.page, pageSize: pg.perPage, limit: pg.perPage, totalPages: meta.totalPages } }, ...meta });
  },
});
// ---------- cash of a settlement paid through the broker (posting rules claim.funds_received / claim.paid_to_claimant) ----------
const cashExample = { claimNumber: 'CLM-2026-00001', settlementAmount: 75000, paidThroughBroker: true, canRecord: true, claimant: 'Maria Santos',
  insurers: [{ insurerId: 1, insurer: 'Malayan Insurance Co., Inc.', share: 100, recoverable: 75000, received: 75000, outstanding: 0 }],
  totalRecoverable: 75000, totalReceived: 75000, paidToClaimant: 0, payableToClaimant: 75000,
  movements: [{ id: 1, kind: 'funds-received', insurer: 'Malayan Insurance Co., Inc.', amount: 75000, date: '2026-09-29', bankAccount: 'ACC-OPS-001', reference: 'RA-8812', journalNumber: 'JV-2026-00140' }],
  bankAccounts: [{ code: 'ACC-OPS-001', name: 'Operating Account', glAccount: '1102001' }] };
define({
  method: 'GET', path: '/:id/settlement-cash', summary: 'Cash position of a settlement paid through the broker: recoverable from / received from each insurer, payable to / paid to the claimant, movements, bank accounts',
  screen: 'Operations > Claims > Claim settlement', middleware: [...read, ownRecord('claim')], response: { success: true, data: cashExample },
  handler: async (req, res) => ok(res, await cash.cashPosition(req.params.id)),
});
const cashSchema = z.object({ amount: z.coerce.number().positive(), bankAccount: z.string().min(1).max(100), date: z.string().max(40).optional().nullable(), reference: z.string().max(100).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(), insurerId: z.union([z.string(), z.number()]).optional().nullable(), paymentMode: z.enum(['check', 'bank-transfer', 'cash']).optional(),
  payee: z.string().max(200).optional().nullable() });
define({
  method: 'POST', path: '/:id/settlement-cash/funds-received', summary: 'Record settlement funds received from an insurer into a bank account (posting rule claim.funds_received; not more than the insurer\'s outstanding share)',
  screen: 'Operations > Claims > Claim settlement > Funds received', middleware: [requireAuth, requirePermission('write:claim-funds'), validate(cashSchema)],
  request: { insurerId: 1, amount: 75000, bankAccount: 'ACC-OPS-001', date: '2026-09-29', reference: 'RA-8812' }, response: { success: true, data: { journalNumber: 'JV-2026-00140', position: cashExample } },
  handler: async (req, res) => {
    const r = await cash.recordMovement(req.params.id, 'funds-received', req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.position.claimId, action: 'funds-received', after: { ...req.body, journalId: r.journalId } });
    ok(res, r, 'Funds received recorded');
  },
});
define({
  method: 'POST', path: '/:id/settlement-cash/paid-to-claimant', summary: 'Record the payment of the settlement to the claimant by voucher / cheque or transfer (posting rule claim.paid_to_claimant; not more than the amount still payable)',
  screen: 'Operations > Claims > Claim settlement > Pay claimant', middleware: [requireAuth, requirePermission('write:disbursements'), validate(cashSchema)],
  request: { amount: 75000, bankAccount: 'ACC-OPS-001', paymentMode: 'check', reference: 'PV-2026-00031 / chq 000512', payee: 'Maria Santos' }, response: { success: true, data: { journalNumber: 'JV-2026-00141', position: cashExample } },
  handler: async (req, res) => {
    const r = await cash.recordMovement(req.params.id, 'paid-to-claimant', req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.position.claimId, action: 'paid-to-claimant', after: { ...req.body, journalId: r.journalId } });
    ok(res, r, 'Payment to claimant recorded');
  },
});
const adviceSchema = z.object({ insurerClaimNumber: z.string().max(60).optional(), insurerHandler: z.string().max(120).optional(), insurerHandlerContact: z.string().max(120).optional(),
  adviceStatus: z.string().max(40).optional(), authorisationCode: z.string().max(60).optional(), offerAmount: z.union([z.number(), z.string()]).optional().nullable(), note: z.string().max(2000).optional() });
define({
  method: 'PUT', path: '/:id/insurer-advice', summary: 'Record the insurer\'s advice: insurer claim number, claim handler, advice status (claims.insurer_advice_statuses), authorisation code, offered amount',
  screen: 'Operations > Claims > Claim detail > Insurer advice', middleware: [...write, ownRecord('claim'), validate(adviceSchema)],
  request: { insurerClaimNumber: 'MAPFRE-CL-7781', insurerHandler: 'Rosa Lim', adviceStatus: 'loa-issued', authorisationCode: 'AUTH-55102', offerAmount: 72000 },
  response: { success: true, message: 'Insurer advice recorded', data: { ...claimExample, insurerAdvice: 'loa-issued', insurerAdviceLabel: 'LOA issued' } },
  handler: async (req, res) => {
    const r = await insurer.recordAdvice(req.params.id, req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'insurer-advice', before: r.before, after: req.body });
    ok(res, r.claim, 'Insurer advice recorded');
  },
});
define({
  method: 'POST', path: '/:id/verify-death', summary: 'Record the verification of the death on a death benefit claim; the follow-up date counts from it', screen: 'Operations > Claims > Claim detail > Verify death',
  middleware: [...write, ownRecord('claim'), validate(z.object({ verifiedOn: z.string().max(40).optional(), note: z.string().max(1000).optional() }))],
  request: { verifiedOn: '2026-10-05', note: 'PSA death certificate seen' }, response: { success: true, message: 'Death verified', data: { ...claimExample, deathVerifiedOn: '2026-10-05' } },
  handler: async (req, res) => {
    const r = await insurer.verifyDeath(req.params.id, req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.claim.id, action: 'verify-death', before: r.before, after: { deathVerifiedOn: r.claim.deathVerifiedOn, dueDate: r.claim.claimDueDate } });
    ok(res, r.claim, 'Death verified');
  },
});
const commExample = { id: 1, party: 'insurer', partyLabel: 'Insurer', direction: 'out', method: 'Email', subject: 'Follow-up', message: 'Status of the LOA?', followUpDate: '2026-10-08', overdue: false, by: 'Paolo Reyes' };
define({
  method: 'GET', path: '/:id/communications', summary: 'Communication log of a claim (insurer, client, adjuster, repair shop) with follow-up dates and overdue flags, newest first',
  screen: 'Operations > Claims > Claim detail > Communications', middleware: [...read, ownRecord('claim')], response: { success: true, data: [commExample] },
  handler: async (req, res) => ok(res, await insurer.communications(req.params.id)),
});
define({
  method: 'POST', path: '/:id/communications', summary: 'Log an exchange on the claim (party, direction, method, subject, message, follow-up date)', screen: 'Operations > Claims > Claim detail > Communications',
  middleware: [...write, ownRecord('claim'), validate(z.object({ party: z.string().max(20), direction: z.enum(['in', 'out']).default('out'), method: z.string().max(20), subject: z.string().max(200).optional().nullable(),
    message: z.string().min(1).max(4000), followUpDate: z.string().max(40).optional().nullable() }))],
  request: { party: 'insurer', direction: 'in', method: 'Phone', message: 'Adjuster visit set for 07/10/2026', followUpDate: '2026-10-08' }, response: { success: true, data: commExample },
  handler: async (req, res) => {
    const c = await insurer.addCommunication(req.params.id, req.body, req.user);
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'communication', after: c });
    created(res, c, 'Communication logged');
  },
});
define({
  method: 'POST', path: '/:id/communications/:commId/done', summary: 'Mark the follow-up of a communication done', screen: 'Operations > Claims > Claim detail > Communications',
  middleware: [...write, ownRecord('claim')], response: { success: true, data: { ...commExample, followUpDone: true } },
  handler: async (req, res) => {
    const c = await insurer.completeFollowUp(req.params.id, req.params.commId, req.user);
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'follow-up-done', after: { communicationId: c.id } });
    ok(res, c, 'Follow-up done');
  },
});
define({
  method: 'POST', path: '/:id/insurer-follow-up', summary: 'E-mail a follow-up to the insurer (template claim_insurer_followup; to defaults to the insurer\'s address) and log it with its follow-up date',
  screen: 'Operations > Claims > Claim detail > Follow up insurer', middleware: [...write, ownRecord('claim'), validate(z.object({ message: z.string().min(1).max(4000), to: z.string().email().max(200).optional(), followUpDate: z.string().max(40).optional().nullable() }))],
  request: { message: 'May we have the status of the LOA?', followUpDate: '2026-10-09' }, response: { success: true, data: { to: 'claims@insurer.ph', communication: commExample } },
  handler: async (req, res) => {
    const r = await insurer.followUpInsurer(req.params.id, req.body, req.user);
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'insurer-follow-up', after: { to: r.to, communicationId: r.communication.id } });
    ok(res, r, `Follow-up e-mailed to ${r.to}`);
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Claim details (by id or claim number) with policy, documents and status history', screen: 'Operations > Claims > Claim wizard / detailed view',
  middleware: [...read, ownRecord('claim')], response: { success: true, data: claimExample },
  handler: async (req, res) => ok(res, await svc.getClaim(req.params.id)),
});
define({
  method: 'POST', path: '/', summary: 'Register a claim (multipart). Blocked when premium is unpaid or the loss date is outside the policy period; sends the Preliminary Loss Advice', screen: 'Operations > Claims > Send mail',
  middleware: [...write, upload.any(), checkUploadedFiles, validate(createSchema), ownRecord('policy', policyRef)],
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
  middleware: [...write, ownRecord('claim'), upload.any(), checkUploadedFiles],
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
