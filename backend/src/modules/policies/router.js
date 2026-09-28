import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { paging } from '../../lib/respond.js';
import { withTransaction } from '../../db/pool.js';
import { config } from '../../config.js';
import { sendEntity, actor } from '../documents/common.js';
import { uploadFile, parseUploadedRows } from '../documents/tabular.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { placingSlipDoc } from '../documents/templates.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Policies', '/policies');
const SCREEN = 'Operations > Policy';
const canRead = [requireAuth, requirePermission('read:policies')];
const canWrite = [requireAuth, requirePermission('write:policies')];
const out = svc.toPolicy;
const example = { policyId: 'pol_1', policyNumber: 'POL-2026-00001', clientId: 'cl_1', insuredName: 'Juan Dela Cruz', status: 'Active', paymentStatus: 'Pending', inception: '2026-10-01', expiry: '2027-10-01', grossPremium: 23171.25, billNumber: 'INV-2026-00001', quoteRefId: 'qt_1' };

define({
  method: 'GET', path: '/', summary: 'List policies (paymentStatus, quoteRefId, clientId, productType, lob, status, insurer, client name, issued / expiry ranges, premium range, search; paging)',
  screen: `${SCREEN} / Renewal Policy / Client view`, middleware: canRead,
  query: { page: 1, pageSize: 10, paymentStatus: 'Pending', clientId: 'cl_1', expiryDateFrom: '2026-10-01T00:00:00.000Z', query: 'POL-2026' },
  response: { success: true, data: [example], total: 1, page: 1, pageSize: 10, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await svc.listPolicies(req.query, pg);
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
define({
  method: 'GET', path: '/:id', summary: 'Get one policy (by id or number) with client, lead and quotation', screen: `${SCREEN} > Policy detail`, middleware: canRead,
  response: { ...example, success: true }, handler: async (req, res) => sendEntity(res, out(await svc.getPolicyRow(req.params.id))),
});
define({
  method: 'PUT', path: '/:id', summary: 'Update policy details (upload policy: insurer policy number, dates, vehicle ids, photos, document)', screen: 'Operations > Quotation > Upload policy',
  middleware: [...canWrite, validate(z.object({ policyNumber: z.string().max(60).optional().nullable(), paymentStatus: z.string().optional() }).passthrough())],
  request: { policyNumber: 'MAL-MC-2026-0099', inception: '2026-10-01', expiry: '2027-10-01', plateNumber: 'ABC 1234', policyDocument: 'document/abc.pdf' },
  response: { ...example, success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.updatePolicy(req.params.id, req.body, actor(req));
    await audit(req, { entity: 'policy', entityId: after.id, action: 'update', before: out(before), after: out(after) });
    sendEntity(res, out(after), { message: 'Policy updated' });
  },
});
define({
  method: 'PATCH', path: '/:id/payment-status', summary: 'Set the payment status (policies.payment_statuses) and method', screen: 'Operations > Quotation / Endorsement > Payment confirmation',
  middleware: [...canWrite, validate(z.object({ paymentStatus: z.string().min(1), paymentMethod: z.string().optional() }).passthrough())],
  request: { paymentStatus: 'Completed', paymentMethod: 'Direct Debit' }, response: { ...example, paymentStatus: 'Completed', success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.updatePaymentStatus(req.params.id, req.body, actor(req));
    await audit(req, { entity: 'policy', entityId: after.id, action: 'payment-status', before: { paymentStatus: before.payment_status }, after: { paymentStatus: after.payment_status, paymentMethod: after.payment_method } });
    sendEntity(res, out(after), { message: `Payment status set to ${after.payment_status}` });
  },
});
define({
  method: 'GET', path: '/:id/documents', summary: 'Documents of a policy: uploaded files (policy, quotation photos, endorsements) and generated PDFs', screen: `${SCREEN} > Policy detail > Documents`,
  middleware: canRead, response: { success: true, data: { files: [{ key: 'vehicle/abc.jpg', fileName: 'front.jpg' }], generated: [{ type: 'policy-schedule', url: 'http://host/api/document-templates/policy-schedule/pol_1' }] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.policyDocuments(await svc.getPolicyRow(req.params.id), config.publicBaseUrl) }),
});
define({
  method: 'GET', path: '/:id/documents/insurance-placing-slip-fire', summary: 'Insurance placing slip PDF', screen: `${SCREEN} > Policy detail > Insurance placing slip`,
  middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const p = out(await svc.getPolicyRow(req.params.id));
    sendPdf(res, buildPdf(await placingSlipDoc(p)), `placing-slip-${p.policyNumber}.pdf`);
  },
});

export default router;
export const mount = '/policies';
