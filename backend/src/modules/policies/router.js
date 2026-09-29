import { moduleRouter } from '../../lib/registry.js';
import { formatMoney } from '../../lib/money.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { paging } from '../../lib/respond.js';
import { pool, withTransaction } from '../../db/pool.js';
import { usersWithRoles } from '../documents/common.js';
import { notify } from '../notifications/router.js';
import * as payments from './payments.js';
import { config } from '../../config.js';
import { forbidden } from '../../lib/errors.js';
import { sendEntity, actor } from '../documents/common.js';
import { uploadFile, parseUploadedRows } from '../documents/tabular.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { placingSlipDoc, printablePolicy } from '../documents/templates.js';
import { ownRecord, withScope } from '../../lib/scope.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Policies', '/policies');
const SCREEN = 'Operations > Policy';
const canRead = [requireAuth, requirePermission('read:policies')];
const canWrite = [requireAuth, requirePermission('write:policies')];
const out = svc.toPolicy;
const example = { policyId: 'pol_1', policyNumber: 'POL-2026-00001', clientId: 'cl_1', insuredName: 'Juan Dela Cruz', status: 'Active', paymentStatus: 'Pending', inception: '2026-10-01', expiry: '2027-10-01', grossPremium: 23171.25, billNumber: 'INV-2026-00001', quoteRefId: 'qt_1' };

define({
  method: 'GET', path: '/', summary: 'List policies (mine=true for own book; agents always get their own; paymentStatus, quoteRefId, clientId, productType, lob, status, insurer, client name, issued / expiry ranges, premium range, search; paging)',
  screen: `${SCREEN} / Renewal Policy / Client view`, middleware: canRead,
  query: { page: 1, pageSize: 10, mine: true, paymentStatus: 'Pending', clientId: 'cl_1', expiryDateFrom: '2026-10-01T00:00:00.000Z', query: 'POL-2026' },
  response: { success: true, data: [example], total: 1, page: 1, pageSize: 10, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await svc.listPolicies({ ...(await withScope(req)), currentUserId: req.user.id }, pg);
    res.json({ success: true, data: rows.map(out), total, page: pg.page, pageSize: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'POST', path: '/bulk-upload', summary: 'Bulk upload issued policies from CSV / XLSX (policy number, insured, product, insurer, inception, expiry, premiums)', screen: `${SCREEN} > Bulk Upload`,
  middleware: [...canWrite, uploadFile], request: 'multipart/form-data file', response: { success: true, data: { message: 'Processed 2 rows: 2 created, 0 failed', created: 2, failed: 0, errors: [] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file);
    const errors = [];
    let created = 0;
    for (const [i, row] of rows.entries()) {
      try {
        const r = await withTransaction((db) => svc.importPolicy(db, svc.policyFromRow(row), actor(req)));
        await audit(req, { entity: 'policy', entityId: r.policyId, action: 'bulk-create', after: { policyId: r.policyId, billNumber: r.receivable.bill_number } });
        created += 1;
      } catch (e) { errors.push({ row: i + 2, message: e.message }); }
    }
    const data = { message: `Processed ${rows.length} rows: ${created} created, ${errors.length} failed`, total: rows.length, created, failed: errors.length, errors };
    res.json({ success: true, message: data.message, data });
  },
});
const canConfirmPayments = [requireAuth, requirePermission('write:receipts')];
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
      for (const u of await usersWithRoles(['finance'])) {
        await notify({ userId: u.id, type: 'approval', title: 'Premium payment to verify', message: `${r.capture.paymentModeLabel} ${await formatMoney(r.capture.amount)} (ref ${r.capture.referenceNo || '-'}) on policy ${policy.policy_number}`,
          link: `/agent/policy/paymentoptions/${policy.id}`, entity: 'policy', entityId: policy.id });
      }
    }
    const message = r.option === 'pay-later' ? 'Pay later recorded: the bill stays open' : r.posted ? `Payment confirmed, receipt ${r.receipt.receiptNumber}` : 'Payment recorded; finance will verify it';
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
    res.json({ success: true, message: 'Payment rejected', data: r });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Get one policy (by id or number) with client, lead and quotation', screen: `${SCREEN} > Policy detail`, middleware: [...canRead, ownRecord('policy')],
  response: { ...example, participants: [{ insuranceCompanyId: 2, insuranceCompanyName: 'Malayan Insurance Co., Inc.', isLead: true, sharePercent: 100, premium: 18500, premiumTotal: 23171.25 }], success: true },
  handler: async (req, res) => sendEntity(res, await svc.policyWithParticipants(await svc.getPolicyRow(req.params.id))),
});
define({
  method: 'PUT', path: '/:id', summary: 'Update policy details (upload policy: insurer policy number, dates, vehicle ids, photos, document); only finance may change paymentStatus', screen: 'Operations > Quotation > Upload policy',
  middleware: [...canWrite, ownRecord('policy'), validate(z.object({ policyNumber: z.string().max(60).optional().nullable(), paymentStatus: z.string().optional() }).passthrough())],
  request: { policyNumber: 'MAL-MC-2026-0099', inception: '2026-10-01', expiry: '2027-10-01', plateNumber: 'ABC 1234', policyDocument: 'document/abc.pdf' },
  response: { ...example, success: true },
  handler: async (req, res) => {
    // the payment status is set by payment capture / finance verification, not by a policy editor (D70)
    if (req.body.paymentStatus && !payments.canPostReceipts(req.user)) {
      const current = await svc.getPolicyRow(req.params.id);
      if (String(req.body.paymentStatus).toLowerCase() !== String(current.payment_status || '').toLowerCase()) {
        throw forbidden('Only finance can change the payment status; record the payment on the Payment screen for finance to verify');
      }
    }
    const { before, after } = await svc.updatePolicy(req.params.id, req.body, actor(req));
    await audit(req, { entity: 'policy', entityId: after.id, action: 'update', before: out(before), after: out(after) });
    sendEntity(res, out(after), { message: 'Policy updated' });
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
