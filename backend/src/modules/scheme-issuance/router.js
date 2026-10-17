/**
 * Scheme Issuance API (/scheme-issuance, Operations > Sales & Marketing > Scheme Issuance): TIS-BRD-SCHM-01, CR-05.
 * Applications on TFS loan documents, the loan bookings upload, the document checklist with its waivers, the direct
 * placement to the insurer, the policy and the cancellation.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { normKey, uploadFile } from '../documents/tabular.js';
import { readXlsx } from '../documents/xlsx.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import * as svc from './service.js';
import * as checklist from './checklist.js';
import * as issue from './issue.js';
import { listBatches, uploadBookings } from './upload.js';

const { router, define } = moduleRouter('Scheme Issuance', '/scheme-issuance');
const SCREEN = 'Sales & Placement > Scheme Issuance';
const APP = `${SCREEN} > Application`;
const canRead = [requireAuth, requirePermission('read:scheme-issuance', 'write:scheme-issuance', 'approve:scheme-issuance')];
const canWrite = [requireAuth, requirePermission('write:scheme-issuance')];
const canApprove = [requireAuth, requirePermission('approve:scheme-issuance')];
const singleFile = (req, res, next) => memoryUpload({ files: 1 }).single('file')(req, res, (e) => next(e ? badRequest(e.message) : undefined));

const opt = (t) => t.optional().nullable();
const body = z.object({
  schemeId: opt(z.string().max(40)), schemeNo: opt(z.string().max(40)), loanAccount: opt(z.string().max(20)), bankChannelId: opt(z.string().max(40)),
  bookingDate: opt(z.string().max(10)), loanTermMonths: z.union([z.null(), z.literal(''), z.coerce.number()]).optional(), releaseDate: opt(z.string().max(10)),
  clientId: opt(z.string().max(40)), borrower: z.record(z.any()).optional(), kycSource: opt(z.enum(['tfs', 'full'])), idType: opt(z.string().max(80)), idNumber: opt(z.string().max(60)),
  idType2: opt(z.string().max(80)), idNumber2: opt(z.string().max(60)), dealerChannelId: opt(z.string().max(40)), make: opt(z.string().max(80)), model: opt(z.string().max(80)),
  variant: opt(z.string().max(120)), yearModel: z.union([z.null(), z.literal(''), z.coerce.number()]).optional(), color: opt(z.string().max(60)), chassisNumber: opt(z.string().max(40)),
  engineNumber: opt(z.string().max(40)), conductionSticker: opt(z.string().max(20)), plateNumber: opt(z.string().max(20)),
  invoicePrice: z.union([z.null(), z.literal(''), z.coerce.number()]).optional(), insuranceCompanyId: z.union([z.null(), z.literal(''), z.coerce.number()]).optional(),
  araSignedOn: opt(z.string().max(10)), araPaymentMode: opt(z.string().max(20)),
}).passthrough();
const example = { id: 'sap_1', applicationNumber: 'SAP-2026-90012', status: 'documents-pending', statusLabel: 'Documents pending', schemeNo: 'S1-STD-2026', schemeType: 'scheme1',
  loanAccount: '8005123456', bookingDate: '2026-10-05', loanTermMonths: 60, releaseDate: '2026-10-07', borrowerName: 'Ramon Villanueva', kycSource: 'tfs', dealerName: 'Toyota Makati',
  vehicleLabel: '2026 Toyota Vios 1.3 XLE CVT', invoicePrice: 1015000, insurerName: 'Pioneer Insurance & Surety Corp.', araSignedOn: '2026-10-05', araPaymentMode: 'ADA',
  grossPremium: 35947.71, checklist: { required: 8, in: 6, missing: 2 } };
const itemExample = { id: 1, code: 'SCH-LOAN', document: 'Loan booking advice from TFSPH', kyc: false, required: true, canWaive: false, status: 'received', fileName: 'booking-8005123456.pdf' };
const after = async (req, action, out, extra = {}) => audit(req, { entity: 'scheme_application', entityId: req.params.id, action, before: out.before || undefined,
  after: { status: out.status ?? out.application?.status ?? null, ...extra } });

define({
  method: 'GET', path: '/', summary: 'Scheme applications (status comma list, search number, borrower, loan account or chassis, schemeType, batchId), newest first, with the checklist count',
  screen: SCREEN, middleware: canRead, query: { status: 'documents-pending,ready', search: '8005' }, response: { success: true, data: [example], counts: { all: 3, ready: 1 } },
  handler: async (req, res) => res.json({ success: true, data: await svc.listApplications(req.query), counts: await svc.statusCounts() }),
});
define({
  method: 'GET', path: '/choices', summary: 'Choices of the application form: schemes in force, TFSPH channels, ARA payment modes, KYC sources, accepted IDs, loan term and backdating limits',
  screen: `${SCREEN} > New application`, middleware: canRead,
  response: { success: true, data: { schemes: [{ value: 'sch_1', schemeNo: 'S1-STD-2026', schemeType: 'scheme1' }], banks: [{ value: 'ch_seed_tfs', label: 'Toyota Financial Services Philippines Corporation' }],
    paymentModes: [{ code: 'ADA', label: 'Automatic Debit Arrangement (ADA)' }], kycSources: [{ value: 'tfs', label: 'TFSPH KYC confirmation' }], primaryIds: ['PhilID'], secondaryIds: ['NBI clearance'] } },
  handler: async (_req, res) => res.json({ success: true, data: await svc.applicationChoices() }),
});
define({
  method: 'GET', path: '/bookings/template', summary: 'Loan bookings template (XLSX: Data, Columns, Instructions)', screen: `${SCREEN} > Loan Bookings Upload > Template`, middleware: canRead,
  response: 'binary file', handler: async (_req, res) => sendTemplate(res, 'scheme-loan-bookings'),
});
define({
  method: 'GET', path: '/bookings', summary: 'Loan bookings uploads (batch, file, rows, created, failed, status, uploaded) with the failed rows', screen: `${SCREEN} > Loan Bookings Upload`, middleware: canRead,
  response: { success: true, data: [{ id: 'sbb_1', batchNumber: 'SB-2026-90003', fileName: 'tfs-bookings-1007.xlsx', rowsTotal: 25, rowsCreated: 23, rowsFailed: 2, status: 'partial' }] },
  handler: async (_req, res) => res.json({ success: true, data: await listBatches() }),
});
define({
  method: 'POST', path: '/bookings/upload', summary: 'Upload the day\'s TFSPH loan bookings (.xlsx, multipart "file"): each row is checked, priced and given its checklist on its own; a failed row creates nothing',
  screen: `${SCREEN} > Upload loan bookings`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: 'Processed 25 rows: 23 created, 2 failed', data: { batchNumber: 'SB-2026-90003', total: 25, created: 23, failed: 2, errors: [{ row: 7, text: 'Row 7: Chassis number is required' }] } },
  handler: async (req, res) => {
    const name = req.file?.originalname || '';
    if (!req.file?.buffer?.length || !name.toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file', code: 'MSG-SIS-009' }]);
    let table;
    try { table = readXlsx(req.file.buffer); } catch (e) { throw badRequest(`Could not read the file: ${e.message}`); }
    const headers = (table[0] || []).map(normKey);
    const rows = table.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
    const out = await uploadBookings({ rows, headers, fileName: name }, req.user);
    await audit(req, { entity: 'scheme_booking_batch', entityId: out.batchId, action: 'upload', after: { ...out, errors: out.errors.slice(0, 50), applicationIds: undefined } });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'A scheme application with its pricing (year 1 and the premium schedule), its checklist and the gate', screen: APP, middleware: canRead,
  response: { success: true, data: { ...example, items: [itemExample], gate: { missing: 2, documents: ['Delivery receipt', 'Chattel mortgage'] } } },
  handler: async (req, res) => {
    const row = await svc.applicationRow(req.params.id);
    if (await issue.syncDeclined(row)) return res.json({ success: true, data: await svc.getApplication(row.id) });
    res.json({ success: true, data: await svc.getApplication(row.id) });
  },
});
define({
  method: 'POST', path: '/', summary: 'Create a scheme application: Draft when a mandatory field or a scheme check is missing, else Documents pending; priced from the scheme and given its checklist',
  screen: `${SCREEN} > New application`, middleware: [...canWrite, validate(body)], request: { schemeNo: 'S1-STD-2026', loanAccount: '8005123456', bookingDate: '2026-10-05', loanTermMonths: 60,
    releaseDate: '2026-10-07', borrower: { firstName: 'Ramon', lastName: 'Villanueva', birthday: '1992-03-14', nationality: 'Filipino', idType: 'PhilID', idNumber: '1234-5678-9012' },
    dealerChannelId: 'ch_seed_tmk_mkt', make: 'Toyota', model: 'Vios', variant: '1.3 XLE CVT', yearModel: 2026, chassisNumber: 'MR2B29F30R1123456', engineNumber: '2NR-F123456',
    invoicePrice: 1015000, insuranceCompanyId: 3, araSignedOn: '2026-10-05', araPaymentMode: 'ADA' },
  response: { success: true, message: 'Application SAP-2026-90012 saved', data: example },
  handler: async (req, res) => {
    const r = await svc.saveApplication(null, req.body, req.user);
    const app = await svc.getApplication(r.id);
    await audit(req, { entity: 'scheme_application', entityId: app.id, action: 'create', after: { applicationNumber: app.applicationNumber, status: app.status, loanAccount: app.loanAccount,
      schemeNo: app.schemeNo, invoicePrice: app.invoicePrice, grossPremium: app.grossPremium, problems: app.problems } });
    res.status(201).json({ success: true, message: await svc.saveMessage(app), data: app });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Edit an application (Draft, Documents pending, Ready to issue, Declined by insurer): re-checked, re-priced, checklist rebuilt; refused once sent to the insurer',
  screen: `${SCREEN} > Edit application`, middleware: [...canWrite, validate(body)], request: { invoicePrice: 1050000 }, response: { success: true, message: 'Application SAP-2026-90012 saved', data: example },
  handler: async (req, res) => {
    const before = await svc.getApplication(req.params.id);
    await svc.saveApplication(before.id, req.body, req.user);
    const app = await svc.getApplication(before.id);
    await audit(req, { entity: 'scheme_application', entityId: app.id, action: 'update',
      before: { status: before.status, invoicePrice: before.invoicePrice, grossPremium: before.grossPremium, insuranceCompanyId: before.insuranceCompanyId, kycSource: before.kycSource },
      after: { status: app.status, invoicePrice: app.invoicePrice, grossPremium: app.grossPremium, insuranceCompanyId: app.insuranceCompanyId, kycSource: app.kycSource, problems: app.problems } });
    res.json({ success: true, message: await svc.saveMessage(app), data: app });
  },
});
define({
  method: 'POST', path: '/:id/items', summary: 'Add a document the master does not list (optional unless required)', screen: `${APP} > Document checklist`,
  middleware: [...canWrite, validate(z.object({ document: z.string().max(200), required: z.boolean().optional() }))], request: { document: 'Insurer letter of undertaking', required: false },
  response: { success: true, data: itemExample },
  handler: async (req, res) => {
    const r = await checklist.addItem(req.params.id, req.body, req.user);
    await audit(req, { entity: 'scheme_checklist_item', entityId: String(r.item.id), action: 'add', after: r.item });
    res.status(201).json({ success: true, message: `${r.item.document} added to the checklist`, data: r.item });
  },
});
define({
  method: 'POST', path: '/:id/items/:itemId/upload', summary: 'Upload the file of a checklist item (multipart "file"; type by content, at most schemes.max_document_mb): the item is Received',
  screen: `${APP} > Document checklist > Upload`, middleware: [...canWrite, singleFile], request: 'multipart/form-data file', response: { success: true, message: 'Loan booking advice from TFSPH received', data: itemExample },
  handler: async (req, res) => {
    const r = await checklist.uploadItem(req.params.id, req.params.itemId, req.file, req.user);
    await audit(req, { entity: 'scheme_checklist_item', entityId: req.params.itemId, action: 'upload', before: r.before, after: { status: 'received', fileName: r.item.fileName, applicationStatus: r.status } });
    res.json({ success: true, message: r.message, data: r.item, status: r.status });
  },
});
const itemAct = (action, fn, schema) => ({
  middleware: [...(action === 'waiver-approve' || action === 'waiver-reject' ? canApprove : canWrite), validate(schema)],
  handler: async (req, res) => {
    const r = await fn(req);
    await audit(req, { entity: 'scheme_checklist_item', entityId: req.params.itemId, action, before: r.before, after: { ...req.body, applicationStatus: r.status } });
    res.json({ success: true, message: r.message, status: r.status });
  },
});
define({
  method: 'POST', path: '/:id/items/:itemId/receive', summary: 'Mark an item Received without a file (paper original on file): remark required; never a KYC item', screen: `${APP} > Document checklist > Received`,
  request: { remark: 'Original kept in the loan folder' }, response: { success: true, message: 'Delivery receipt received', status: 'ready' },
  ...itemAct('receive', (req) => checklist.receiveItem(req.params.id, req.params.itemId, req.body, req.user), z.object({ remark: opt(z.string().max(500)) })),
});
define({
  method: 'POST', path: '/:id/items/:itemId/reopen', summary: 'Reopen a Received or Waived item with a remark (back to Pending)', screen: `${APP} > Document checklist > Reopen`,
  request: { remark: 'Blurred scan' }, response: { success: true, message: 'Delivery receipt reopened', status: 'documents-pending' },
  ...itemAct('reopen', (req) => checklist.reopenItem(req.params.id, req.params.itemId, req.body, req.user), z.object({ remark: opt(z.string().max(500)) })),
});
define({
  method: 'POST', path: '/:id/items/:itemId/waive', summary: 'Request the waiver of a Pending item the master allows to be waived, with the reason: an item in My Work > Approvals', screen: `${APP} > Document checklist > Waive`,
  request: { reason: 'Registration in progress at LTO' }, response: { success: true, message: 'Waiver of Chattel mortgage requested', status: 'documents-pending' },
  ...itemAct('waiver-request', (req) => checklist.requestWaiver(req.params.id, req.params.itemId, req.body, req.user), z.object({ reason: opt(z.string().max(500)) })),
});
define({
  method: 'POST', path: '/:id/items/:itemId/waiver/approve', summary: 'Approve a waiver (approve:scheme-issuance, never its requester): the item is Waived', screen: `${APP} > Document checklist > Approve`,
  request: { note: 'Copy to follow' }, response: { success: true, message: 'Waiver of Chattel mortgage approved', status: 'ready' },
  ...itemAct('waiver-approve', (req) => checklist.decideWaiver(req.params.id, req.params.itemId, { decision: 'approve', note: req.body?.note }, req.user), z.object({ note: opt(z.string().max(500)) })),
});
define({
  method: 'POST', path: '/:id/items/:itemId/waiver/reject', summary: 'Reject a waiver with a remark (approve:scheme-issuance, never its requester): the item is Pending again', screen: `${APP} > Document checklist > Reject`,
  request: { note: 'Registration done, ask TFSPH for the copy' }, response: { success: true, message: 'Waiver of Chattel mortgage rejected', status: 'documents-pending' },
  ...itemAct('waiver-reject', (req) => checklist.decideWaiver(req.params.id, req.params.itemId, { decision: 'reject', note: req.body?.note }, req.user), z.object({ note: opt(z.string().max(500)) })),
});
define({
  method: 'POST', path: '/:id/send', summary: 'Send a Ready to issue application to its insurer: gate and KYC / vehicle checks, Placement Slip of source scheme e-mailed with the checklist files',
  screen: `${APP} > Send to insurer`, middleware: canWrite, request: {},
  response: { success: true, message: 'Application SAP-2026-90011 sent to Malayan Insurance Co., Inc. on placement slip PS-2026-90007', data: { placementNumber: 'PS-2026-90007' } },
  handler: async (req, res) => {
    const r = await issue.sendToInsurer(req.params.id, req.user);
    await after(req, 'send', { before: { status: 'ready' }, status: 'sent' }, { placementId: r.placement.id, placementNumber: r.placement.placementNumber, warning: r.warning });
    res.json({ success: true, message: r.message, warning: r.warning, data: { placementId: r.placement.id, placementNumber: r.placement.placementNumber, placementStatus: r.placement.placementStatus } });
  },
});
define({
  method: 'POST', path: '/:id/decline', summary: 'Record the insurer\'s decline (reason required): the slip is Declined, the application Declined by insurer', screen: `${APP} > Insurer declined`,
  middleware: [...canWrite, validate(z.object({ reason: opt(z.string().max(500)) }))], request: { reason: 'Fortuner capacity full for October' },
  response: { success: true, message: 'Application SAP-2026-90011 declined by Pioneer Insurance & Surety Corp.' },
  handler: async (req, res) => {
    const r = await issue.recordDecline(req.params.id, req.body, req.user);
    await after(req, 'decline', { before: r.before, status: 'declined' }, { reason: req.body.reason });
    res.json({ success: true, message: r.message });
  },
});
define({
  method: 'POST', path: '/:id/insurer', summary: 'Change the insurer of a declined application to another insurer of the scheme: re-priced, back to Ready to issue', screen: `${APP} > Change insurer`,
  middleware: [...canWrite, validate(z.object({ insuranceCompanyId: z.coerce.number().int() }))], request: { insuranceCompanyId: 2 }, response: { success: true, message: 'Insurer changed', status: 'ready' },
  handler: async (req, res) => {
    const r = await issue.changeInsurer(req.params.id, req.body, req.user);
    await after(req, 'change-insurer', r, { insuranceCompanyId: req.body.insuranceCompanyId });
    res.json({ success: true, message: 'Insurer changed', status: r.status });
  },
});
define({
  method: 'POST', path: '/:id/issue', summary: 'Issue the policy once the insurer has confirmed the placement (write:policies): client, policy, bill to the dealer or TFSPH, commission, files, lock-in record',
  screen: `${APP} > Issue policy`, middleware: [...canWrite], request: {},
  response: { success: true, message: 'Policy POL-2026-00120 issued for application SAP-2026-90012', data: { policyId: 'pol_1', policyNumber: 'POL-2026-00120', billNumber: 'BILL-2026-00077' } },
  handler: async (req, res) => {
    const r = await issue.issueApplication(req.params.id, req.user);
    await after(req, 'issue', { before: { status: 'sent' }, status: 'issued' }, { policyId: r.policyId, policyNumber: r.policyNumber, billNumber: r.billNumber, lockIn: r.lockIn });
    res.json({ success: true, message: r.message, data: { policyId: r.policyId, policyNumber: r.policyNumber, billNumber: r.billNumber, lockIn: r.lockIn, filesCopied: r.filesCopied } });
  },
});
define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel an application with a reason (reasonCode of scheme_application_cancel and / or reason); once sent only approve:scheme-issuance, the slip cancelled with it',
  screen: `${APP} > Cancel application`, middleware: [...canRead, validate(z.object({ reasonCode: opt(z.string().max(40)), reason: opt(z.string().max(500)) }))],
  request: { reasonCode: 'SAC-NOT-RELEASED', reason: 'Loan not released' }, response: { success: true, message: 'Application SAP-2026-90007 cancelled' },
  handler: async (req, res) => {
    const { hasPermission } = await import('../../lib/auth.js');
    if (!hasPermission(req.user, 'write:scheme-issuance') && !hasPermission(req.user, 'approve:scheme-issuance')) {
      const { forbidden } = await import('../../lib/errors.js');
      throw forbidden('You do not have permission to cancel the application');
    }
    const r = await issue.cancelApplication(req.params.id, req.body, req.user);
    await after(req, 'cancel', { before: r.before, status: 'cancelled' }, { reason: r.reason, reasonCode: req.body.reasonCode || null });
    res.json({ success: true, message: r.message });
  },
});

export default router;
export const mount = '/scheme-issuance';
