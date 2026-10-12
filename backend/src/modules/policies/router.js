import { moduleRouter } from '../../lib/registry.js';
import { formatMoney } from '../../lib/money.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission, requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { paging } from '../../lib/respond.js';
import { pool, withTransaction } from '../../db/pool.js';
import { usersWithRoles } from '../documents/common.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import * as payments from './payments.js';
import { config } from '../../config.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { isoDate } from '../../lib/dates.js';
import { assertMigrationOpen } from '../../lib/goLiveLock.js';
import { sendEntity, actor } from '../documents/common.js';
import { uploadFile, parseUploadedRows, columnMessage, uploadResult } from '../documents/tabular.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { placingSlipDoc, printablePolicy } from '../documents/templates.js';
import { ownRecord, withScope } from '../../lib/scope.js';
import * as svc from './service.js';
import { TRANSITIONS, availableMoves, movePolicy } from './lifecycle.js';
import * as corrections from './corrections.js';
import { policyVersions } from '../endorsements/workflow.js';

const { router, define } = moduleRouter('Policies', '/policies');
const SCREEN = 'Policy Servicing > Policy';
const canRead = [requireAuth, requirePermission('read:policies')];
const canWrite = [requireAuth, requirePermission('write:policies')];
const out = svc.toPolicy;
const example = { policyId: 'pol_1', policyNumber: 'POL-2026-00001', clientId: 'cl_1', insuredName: 'Juan Dela Cruz', status: 'Active', paymentStatus: 'Pending', inception: '2026-10-01', expiry: '2027-10-01', grossPremium: 23171.25, billNumber: 'INV-2026-00001', quoteRefId: 'qt_1' };

define({
  method: 'GET', path: '/', summary: 'List policies (mine=true for own book; agents always get their own; paymentStatus, quoteRefId, clientId, productType, lob, status, insurer, client name, issued / expiry ranges, premium range, origin issued / migrated, search; paging); each policy carries its origin block',
  screen: `${SCREEN} / Renewal Policy / Client view`, middleware: canRead,
  query: { page: 1, pageSize: 10, mine: true, paymentStatus: 'Pending', clientId: 'cl_1', expiryDateFrom: '2026-10-01T00:00:00.000Z', query: 'POL-2026', source: 'go-live-migration', origin: 'migrated' },
  response: { success: true, data: [example], total: 1, page: 1, pageSize: 10, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await svc.listPolicies({ ...(await withScope(req)), currentUserId: req.user.id }, pg);
    res.json({ success: true, data: rows.map(out), total, page: pg.page, pageSize: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'GET', path: '/bulk-upload/template', summary: 'Policies upload template (XLSX: Data, Columns and Instructions sheets)', screen: `${SCREEN} > Bulk Upload > Download template`,
  middleware: canRead, response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'policies'),
});
define({
  method: 'POST', path: '/bulk-upload', summary: 'Bulk upload issued policies from CSV / XLSX (policy number, insured, product, insurer, inception, expiry, premiums) where policies.bulk_upload_issue is on (TISPH: off, policies are issued through the placement slip); mode=go-live loads in-force policies of the old system without bill, journal or commission (also write:data-load; refused once go-live is locked). Once go-live is locked a file with rows issued before the cutover date is refused (409): legacy business is loaded by the migration workbook',
  screen: `${SCREEN} > Bulk Upload`,
  middleware: [...canWrite, uploadFile], request: 'multipart/form-data file', response: { success: true, data: { message: 'Processed 2 rows: 2 created, 0 failed', created: 2, failed: 0, errors: [] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file);
    const mode = String(req.body?.mode || req.query.mode || '');
    if (mode && mode !== 'go-live') throw badRequest('mode must be go-live or empty');
    const migration = mode === 'go-live';
    // TISPH (policies.bulk_upload_issue off): a policy is issued through its placement slip; the upload only loads the
    // in-force book at go-live, by the go-live data owner (write:data-load), while the go-live lock allows it
    if (!migration && !(await getSetting('policies.bulk_upload_issue', false))) {
      throw badRequest('Policies are issued through the placement slip once the insurer confirms; the bulk upload only loads the in-force policies at go-live');
    }
    const parsed = rows.map((row) => { try { return { p: svc.policyFromRow(row) }; } catch (e) { return { e }; } });
    if (migration) {
      if (!hasPermission(req.user, 'write:data-load')) throw forbidden('Loading the policies of the old system needs the permission to load migration data (write:data-load)');
      await assertMigrationOpen('policies-go-live', { req });
    } else {
      await refuseLegacyRows(req, parsed);
    }
    const errors = [];
    let created = 0;
    for (const [i, { p, e: parseError }] of parsed.entries()) {
      try {
        if (parseError) throw parseError;
        const missing = migration ? svc.goLiveMissing(p) : [];
        if (missing.length) throw badRequest(`An existing policy (go-live) needs ${missing.join(', ')}`);
        const r = await withTransaction((db) => svc.importPolicy(db, p, actor(req), { migration }));
        await audit(req, { entity: 'policy', entityId: r.policyId, action: migration ? 'go-live-migration' : 'bulk-create', after: { policyId: r.policyId, billNumber: r.receivable?.bill_number ?? null } });
        created += 1;
      } catch (e) { errors.push({ row: i + 2, message: columnMessage(e.details?.length ? e.details.map((d) => d.message).join('; ') : e.message, svc.POLICY_UPLOAD_COLUMNS) }); }
    }
    const data = uploadResult(rows.length, created, errors);
    res.json({ success: true, message: data.message, data });
  },
});
/**
 * Rows of the ordinary upload issued before the cutover date are legacy business: once go-live is locked (and no unlock
 * reopens the policies go-live upload) the file is refused, listing them.
 */
async function refuseLegacyRows(req, parsed) {
  const cutover = String((await getSetting('golive.cutover_date', '')) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutover)) return;
  const legacy = parsed.map((x, i) => ({ row: i + 2, issued: x.p ? isoDate(x.p.issuedDate) : null })).filter((x) => x.issued && x.issued < cutover);
  if (!legacy.length) return;
  try {
    await assertMigrationOpen('policies-go-live', { req });
  } catch (e) {
    throw Object.assign(e, { details: legacy.map((x) => ({ path: `row ${x.row}`, message: `Row ${x.row}: Issue date before go-live: legacy business is loaded by the migration workbook` })) });
  }
}
const canConfirmPayments = [requireAuth, requirePermission('write:receipts')];
/** A captured payment confirmed or rejected by Accounting: the user who recorded it is told. */
const tellPaymentMaker = (policy, capture, req, confirmed) => notifyDecision({ userId: capture?.submittedById, decidedBy: req.user.id, document: 'Premium payment',
  number: capture?.referenceNo || capture?.arNumber || policy.policy_number, approved: confirmed, status: confirmed ? 'confirmed' : 'rejected', by: req.user.username,
  reason: confirmed ? null : req.body.reason, message: confirmed ? `Confirmed by ${req.user.username} on policy ${policy.policy_number}${capture?.receiptNumber ? `, receipt ${capture.receiptNumber}` : ''}` : null,
  link: `/agent/policydetail/${policy.id}`, entity: 'policy', entityId: policy.id });
const captureExample = { id: 'pp_1', policyId: 'pol_1', policyNumber: 'POL-2026-00001', receivableId: 'rcv_1', billNumber: 'INV-2026-00001', amount: 11862.5, paymentMode: 'bank-transfer', referenceNo: 'BDO-778812', paymentDate: '2026-09-28', status: 'submitted', receiptNumber: null };
define({
  method: 'GET', path: '/payment-captures', summary: 'Premium payments captured on policies, for finance verification (status submitted | confirmed | rejected | all)', screen: `${SCREEN} > Payment (finance verification)`,
  middleware: [requireAuth, requirePermission('read:receipts')], query: { status: 'submitted' }, response: { success: true, data: [captureExample] },
  handler: async (req, res) => res.json({ success: true, data: await payments.listCaptures(pool, req.query) }),
});
define({
  method: 'GET', path: '/:id/payments', summary: 'Payment screen: open bills, captured payments, payment modes, gateway (if configured), whether the user can confirm', screen: `${SCREEN} > Payment`,
  middleware: [...canRead, ownRecord('policy')],
  response: { success: true, data: { policyId: 'pol_1', outstanding: 11862.5, receivables: [{ receivableId: 'rcv_1', billNumber: 'INV-2026-00001', balance: 11862.5, pendingVerification: 0 }], captures: [captureExample], modes: [{ value: 'bank-transfer', label: 'Bank transfer', referenceRequired: true }], gateway: { enabled: false, url: null }, canConfirm: false } },
  handler: async (req, res) => res.json({ success: true, data: await payments.paymentSummary(pool, await svc.getPolicyRow(req.params.id), req.user) }),
});
define({
  method: 'POST', path: '/:id/payments', summary: 'Payment capture (policy and endorsement bills): record how the client pays: pay later (bill stays open) or a payment (mode, reference, amount, date, proof; receivableId picks the bill, e.g. an endorsement bill) as pending for finance to verify; only users with write:receipts (finance) post the official receipt at once',
  screen: `${SCREEN} > Payment; Endorsement > Payment`,
  middleware: [requireAuth, requirePermission('write:policies', 'write:receipts'), ownRecord('policy'), validate(z.object({
    option: z.enum(['pay-later', 'payment']), paymentMode: z.string().optional(), referenceNo: z.string().max(80).optional().nullable(), amount: z.union([z.number(), z.string()]).optional(),
    paymentDate: z.string().optional(), proofKey: z.string().max(500).optional().nullable(), proofFileName: z.string().max(255).optional().nullable(), remarks: z.string().max(500).optional().nullable(),
    receivableId: z.string().optional(),
  }))],
  request: { option: 'payment', paymentMode: 'bank-transfer', referenceNo: 'BDO-778812', amount: 11862.5, paymentDate: '2026-09-28', proofKey: 'payment-proofs/abc.jpg' },
  response: { success: true, data: { option: 'payment', capture: captureExample, receipt: null, posted: false } },
  handler: async (req, res) => {
    const policy = await svc.getPolicyRow(req.params.id);
    const r = await withTransaction((db) => payments.capturePayment(db, policy, req.body, req.user));
    await audit(req, { entity: 'policy', entityId: policy.id, action: r.option === 'pay-later' ? 'pay-later' : 'payment-capture', after: { ...(r.capture || {}), receiptNumber: r.receipt?.receiptNumber } });
    if (r.capture && !r.posted) {
      // verified by the receipting roles of payments.verification_notify_roles (the confirm route checks the permission)
      const roles = (await getSetting('payments.verification_notify_roles', ['accounting'])) || ['accounting'];
      await notifyApprovers({ users: (await usersWithRoles(roles)).map((u) => u.id).filter((id) => id !== req.user.id), title: 'Premium payment to verify',
        message: `${req.user.username} recorded ${r.capture.paymentModeLabel} ${await formatMoney(r.capture.amount)} (ref ${r.capture.referenceNo || '-'}) on policy ${policy.policy_number}`,
        link: `/agent/policy/paymentoptions/${policy.id}`, entity: 'policy', entityId: policy.id });
    }
    const message = r.option === 'pay-later' ? 'Pay later recorded: the bill stays open' : r.posted ? `Payment confirmed, receipt ${r.receipt.receiptNumber}` : 'Payment recorded; Accounting will verify it';
    res.status(r.capture ? 201 : 200).json({ success: true, message, data: r });
  },
});
define({
  method: 'POST', path: '/:id/payments/:paymentId/confirm', summary: 'Finance: verify a captured payment; raises the official receipt (Dr Cash / Cr Premium Receivable)', screen: `${SCREEN} > Payment (finance verification)`,
  middleware: canConfirmPayments, request: {}, response: { success: true, data: { capture: { ...captureExample, status: 'confirmed', receiptNumber: 'OR-2026-00001' } } },
  handler: async (req, res) => {
    const policy = await svc.getPolicyRow(req.params.id);
    const r = await withTransaction((db) => payments.confirmCapture(db, policy, req.params.paymentId, req.user));
    await audit(req, { entity: 'policy', entityId: policy.id, action: 'payment-confirm', after: { paymentId: req.params.paymentId, receiptNumber: r.receipt.receiptNumber } });
    await tellPaymentMaker(policy, r.capture, req, true);
    res.json({ success: true, message: `Payment confirmed, receipt ${r.receipt.receiptNumber}`, data: r });
  },
});
define({
  method: 'POST', path: '/:id/payments/:paymentId/reject', summary: 'Finance: reject a captured payment (not received / wrong reference)', screen: `${SCREEN} > Payment (finance verification)`,
  middleware: [...canConfirmPayments, validate(z.object({ reason: z.string().min(3) }))], request: { reason: 'No matching credit in the bank statement' }, response: { success: true, data: { capture: { ...captureExample, status: 'rejected' } } },
  handler: async (req, res) => {
    const policy = await svc.getPolicyRow(req.params.id);
    const r = await withTransaction((db) => payments.rejectCapture(db, policy, req.params.paymentId, req.body.reason, req.user));
    await audit(req, { entity: 'policy', entityId: policy.id, action: 'payment-reject', after: { paymentId: req.params.paymentId, reason: req.body.reason } });
    await tellPaymentMaker(policy, r.capture, req, false);
    res.json({ success: true, message: 'Payment rejected', data: r });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Get one policy (by id or number) with client, lead and quotation', screen: `${SCREEN} > Policy detail`, middleware: [...canRead, ownRecord('policy')],
  response: { ...example, participants: [{ insuranceCompanyId: 2, insuranceCompanyName: 'Malayan Insurance Co., Inc.', isLead: true, sharePercent: 100, premium: 18500, premiumTotal: 23171.25 }], success: true },
  handler: async (req, res) => sendEntity(res, await svc.policyWithParticipants(await svc.getPolicyRow(req.params.id))),
});
define({
  method: 'PUT', path: '/:id', summary: 'Update policy details (upload policy: insurer policy number, dates, vehicle ids, photos, document); only finance may change paymentStatus', screen: 'Policy Servicing > Quotation > Upload policy',
  middleware: [...canWrite, ownRecord('policy'), validate(z.object({ policyNumber: z.string().max(60).optional().nullable(), paymentStatus: z.string().optional() }).passthrough())],
  request: { policyNumber: 'MAL-MC-2026-0099', inception: '2026-10-01', expiry: '2027-10-01', plateNumber: 'ABC 1234', policyDocument: 'document/abc.pdf' },
  response: { ...example, success: true },
  handler: async (req, res) => {
    // the payment status is set by payment capture / finance verification, not by a policy editor
    if (req.body.paymentStatus && !payments.canPostReceipts(req.user)) {
      const current = await svc.getPolicyRow(req.params.id);
      if (String(req.body.paymentStatus).toLowerCase() !== String(current.payment_status || '').toLowerCase()) {
        throw forbidden('Only finance can change the payment status; record the payment on the Payment screen for finance to verify');
      }
    }
    await corrections.assertEditable(pool, await svc.getPolicyRow(req.params.id), req.body);
    const { before, after } = await svc.updatePolicy(req.params.id, req.body, actor(req));
    await audit(req, { entity: 'policy', entityId: after.id, action: 'update', before: out(before), after: out(after) });
    sendEntity(res, out(after), { message: 'Policy updated' });
  },
});
define({
  method: 'GET', path: '/:id/moves', summary: 'The lifecycle moves available on the policy (suspended, reinstated, lapsed) and the reason context of each', screen: `${SCREEN} > Policy detail`,
  middleware: [...canRead, ownRecord('policy')], response: { success: true, data: { status: 'active', moves: [{ status: 'suspended', context: 'policy_suspend' }, { status: 'lapsed', context: 'lapse' }] } },
  handler: async (req, res) => {
    const p = await svc.getPolicyRow(req.params.id);
    res.json({ success: true, data: { status: p.status, moves: availableMoves(p.status).map((s) => ({ status: s, context: TRANSITIONS[s].context })) } });
  },
});
define({
  method: 'POST', path: '/:id/status', summary: 'Move the policy in its lifecycle: suspended (premium warranty, reason context policy_suspend), reinstated (policy_reinstate; back to active) or lapsed (lapse reasons); the move is guarded by the current status, carries the reason and is audited', screen: `${SCREEN} > Policy detail > Status`,
  middleware: [...canWrite, ownRecord('policy'), validate(z.object({ status: z.enum(Object.keys(TRANSITIONS)), reasonCode: z.string().min(1).max(40), note: z.string().max(1000).nullable().optional() }).strict())],
  request: { status: 'suspended', reasonCode: 'SUS-WARRANTY', note: 'Premium unpaid 60 days after inception' }, response: { ...example, status: 'Suspended', success: true },
  handler: async (req, res) => {
    const { before, after, reason, move } = await movePolicy(req.params.id, req.body, req.user);
    await audit(req, { entity: 'policy', entityId: after.id, action: move, before: { status: before.status }, after: { status: after.status, reason: reason.code, remarks: reason.text } });
    sendEntity(res, out(after), { message: `Policy ${after.status}` });
  },
});
define({
  method: 'GET', path: '/:id/versions', summary: 'Versions of a policy: as issued and after each booked endorsement, with the figures before and after (ENDT-03)', screen: `${SCREEN} > Policy detail > Endorsements`,
  middleware: [...canRead, ownRecord('policy')],
  response: { success: true, data: [{ version: 2, endorsementNumber: 'END-2026-00001', premiumDelta: 1520.5, before: { grossPremium: 23171.25 }, after: { grossPremium: 24691.75 } }] },
  handler: async (req, res) => res.json({ success: true, data: await policyVersions(await svc.getPolicyRow(req.params.id)) }),
});
const correctionExample = { id: 'pcr_1', policyId: 'pol_1', status: 'pending', statusLabel: 'Pending approval', changes: [{ field: 'expiry', label: 'Expiry date', from: '2027-10-01', to: '2027-10-02', fromText: '01/10/2027', toText: '02/10/2027' }],
  reasonCode: 'PCR-INSURER', reason: 'Insurer issued a corrected policy', insurerReference: 'MAL-END-2026-0042', requestedBy: 'Maria Santos', requestedAt: '2026-10-10T02:00:00Z' };
define({
  method: 'GET', path: '/:id/corrections', summary: 'Corrections of the core data of a policy (requested, approved, rejected), newest first', screen: `${SCREEN} > Policy detail > Corrections`,
  middleware: [...canRead, ownRecord('policy')], response: { success: true, data: [correctionExample] },
  handler: async (req, res) => res.json({ success: true, data: await corrections.listCorrections(req.params.id) }),
});
define({
  method: 'POST', path: '/:id/corrections', summary: 'Request a correction of the policy number, insured name, period or insurer (policies.correction_fields) with a reason code (policy_correction) and the insurer\'s reference (policies.correction_insurer_fields); applied once a second user approves it',
  screen: `${SCREEN} > Policy detail > Request correction`,
  middleware: [...canWrite, ownRecord('policy'), validate(z.object({ changes: z.record(z.any()), reasonCode: z.string().min(1).max(40), note: z.string().max(2000).optional().nullable(),
    insurerReference: z.string().max(120).optional().nullable() }))],
  request: { changes: { expiry: '2027-10-02' }, reasonCode: 'PCR-INSURER', note: 'Corrected policy issued by the insurer', insurerReference: 'MAL-END-2026-0042' },
  response: { success: true, message: 'Correction requested', data: correctionExample },
  handler: async (req, res) => {
    const r = await corrections.requestCorrection(req.params.id, req.body, req.user);
    await audit(req, { entity: 'policy', entityId: r.policy.id, action: 'correction-request', after: r.correction });
    res.status(201).json({ success: true, message: 'Correction requested: a second user approves it', data: r.correction });
  },
});
const decide = (decision) => async (req, res) => {
  const r = await corrections.decideCorrection(req.params.id, req.params.correctionId, { decision, reasonCode: req.body?.reasonCode, note: req.body?.note }, req.user);
  await audit(req, { entity: 'policy', entityId: r.policy.id, action: decision === 'approve' ? 'correction-approve' : 'correction-reject',
    before: decision === 'approve' ? out(r.before) : null, after: decision === 'approve' ? { ...out(r.after), correctionId: r.correction.id } : { correctionId: r.correction.id, reason: r.correction.decisionReason } });
  res.json({ success: true, message: decision === 'approve' ? 'Correction approved and applied' : 'Correction rejected', data: r.correction });
};
define({
  method: 'POST', path: '/:id/corrections/:correctionId/approve', summary: 'Approve a pending correction and apply it to the policy (approve:policies; never the requester)', screen: `${SCREEN} > Policy detail > Corrections`,
  middleware: [requireAuth, requirePermission('approve:policies'), ownRecord('policy')], request: {}, response: { success: true, message: 'Correction approved and applied', data: { ...correctionExample, status: 'approved' } },
  handler: decide('approve'),
});
define({
  method: 'POST', path: '/:id/corrections/:correctionId/reject', summary: 'Reject a pending correction with a reason code (policy_correction_reject) (approve:policies; never the requester)', screen: `${SCREEN} > Policy detail > Corrections`,
  middleware: [requireAuth, requirePermission('approve:policies'), ownRecord('policy'), validate(z.object({ reasonCode: z.string().min(1).max(40), note: z.string().max(2000).optional().nullable() }))],
  request: { reasonCode: 'PCRR-NOPROOF', note: 'No corrected policy from the insurer yet' }, response: { success: true, message: 'Correction rejected', data: { ...correctionExample, status: 'rejected' } },
  handler: decide('reject'),
});
define({
  method: 'POST', path: '/:id/corrections/:correctionId/withdraw', summary: 'Withdraw an own pending correction', screen: `${SCREEN} > Policy detail > Corrections`,
  middleware: [...canWrite, ownRecord('policy')], request: {}, response: { success: true, message: 'Correction withdrawn', data: { ...correctionExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const r = await corrections.withdrawCorrection(req.params.id, req.params.correctionId, req.user);
    await audit(req, { entity: 'policy', entityId: r.policy.id, action: 'correction-withdraw', after: { correctionId: r.correction.id } });
    res.json({ success: true, message: 'Correction withdrawn', data: r.correction });
  },
});
define({
  method: 'PATCH', path: '/:id/payment-status', summary: 'Finance (write:receipts): set the payment status (policies.payment_statuses) and method. Other users record payments with POST /policies/:id/payments for finance to verify', screen: 'Accounts > Receipts',
  middleware: [...canConfirmPayments, ownRecord('policy'), validate(z.object({ paymentStatus: z.string().min(1), paymentMethod: z.string().optional() }).passthrough())],
  request: { paymentStatus: 'Completed', paymentMethod: 'Direct Debit' }, response: { ...example, paymentStatus: 'Completed', success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.updatePaymentStatus(req.params.id, req.body, actor(req));
    await audit(req, { entity: 'policy', entityId: after.id, action: 'payment-status', before: { paymentStatus: before.payment_status }, after: { paymentStatus: after.payment_status, paymentMethod: after.payment_method } });
    sendEntity(res, out(after), { message: `Payment status set to ${after.payment_status}` });
  },
});
define({
  method: 'GET', path: '/:id/documents', summary: 'Documents of a policy: uploaded files (policy, quotation photos, endorsements) and generated PDFs', screen: `${SCREEN} > Policy detail > Documents`,
  middleware: [...canRead, ownRecord('policy')], response: { success: true, data: { files: [{ key: 'vehicle/abc.jpg', fileName: 'front.jpg' }], generated: [{ type: 'policy-schedule', url: 'http://host/api/document-templates/policy-schedule/pol_1' }] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.policyDocuments(await svc.getPolicyRow(req.params.id), config.publicBaseUrl) }),
});
define({
  method: 'GET', path: '/:id/documents/insurance-placing-slip-fire', summary: 'Insurance placing slip PDF: the security (each participating insurer with its share); insurerId= gives one participant\'s slip showing its share',
  screen: `${SCREEN} > Policy detail > Insurance placing slip`, middleware: [...canRead, ownRecord('policy')], query: { insurerId: 2 }, response: 'application/pdf',
  handler: async (req, res) => {
    const row = await svc.getPolicyRow(req.params.id);
    const p = await printablePolicy(await svc.policyWithParticipants(row), row);
    sendPdf(res, buildPdf(await placingSlipDoc(p, req.query.insurerId)), `placing-slip-${p.policyNumber}.pdf`);
  },
});

export default router;
export const mount = '/policies';
