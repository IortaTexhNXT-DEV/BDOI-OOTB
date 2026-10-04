/**
 * Accounts payable (Accounts > Payables): supplier invoices with input VAT and EWT (maker-checker approval, posting rule
 * ap.invoice), supplier payments (posting rule ap.payment), the AP ageing and the AP voucher. read:payables to view,
 * write:payables to record and pay, approve:payables (Accounting Manager) to approve or reject. Suppliers are maintained
 * on /ops-masters/supplier.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { sendTable } from '../documents/tabular.js';
import { sendPdf } from '../../lib/pdf/index.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import * as svc from './service.js';
import { invoicePdf, paymentPdf } from './print.js';

const { router, define } = moduleRouter('Payables', '/payables');
const read = [requireAuth, requirePermission('read:payables', 'write:payables')];
const write = [requireAuth, requirePermission('write:payables')];
const approve = [requireAuth, requirePermission('approve:payables')];
const S = 'Accounts > Payables';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tx = (fn) => withTransaction(fn);
const LINK = '/accounts/payables/invoices';
const invoice = { id: 'sin_1', voucherNumber: 'APV-2026-00001', supplierName: 'Sample Office Supplies Trading', supplierInvoiceNo: 'SI-10021', invoiceDate: '2026-10-01', dueDate: '2026-10-31',
  netAmount: 10000, inputVat: 1200, grossAmount: 11200, ewtCode: 'WC158', ewtRate: 1, ewtAmount: 100, payableAmount: 11100, balance: 11100, status: 'for-approval', lines: [] };

define({
  method: 'GET', path: '/invoices', summary: 'Supplier invoices (status draft | for-approval | approved | partially-paid | paid | rejected | cancelled | open | all, supplierId, search)',
  screen: `${S} > Supplier Invoices`, middleware: read, query: { status: 'open' }, response: { success: true, data: [invoice] },
  handler: async (req, res) => ok(res, await svc.listInvoices(pool, req.query)),
});
define({
  method: 'GET', path: '/invoices/:id', summary: 'One supplier invoice with its lines and journal', screen: `${S} > Supplier Invoices`, middleware: read, response: { success: true, data: invoice },
  handler: async (req, res) => ok(res, await svc.getInvoice(pool, req.params.id)),
});
define({
  method: 'GET', path: '/invoices/:id/pdf', summary: 'AP voucher of a supplier invoice (PDF with the journal)', screen: `${S} > Supplier Invoices`, middleware: read, response: 'application/pdf',
  handler: async (req, res) => {
    const r = await invoicePdf(pool, req.params.id);
    sendPdf(res, r.pdf, r.fileName);
  },
});
const line = z.object({ description: z.string().max(300).optional(), accountCode: z.string().max(20).optional(), amount: z.number().positive(), vatable: z.boolean().optional(), assetClass: z.string().max(40).optional().nullable() });
define({
  method: 'POST', path: '/invoices', summary: 'Record a supplier invoice: input VAT on vatable lines of a VAT-registered supplier, EWT of the supplier\'s tax code on the net amount (submit: true sends it for approval)',
  screen: `${S} > Supplier Invoices > New`, middleware: [...write, validate(z.object({ supplierId: z.union([z.string(), z.number()]), supplierInvoiceNo: z.string().min(1).max(60), invoiceDate: date,
    dueDate: date.optional(), receivedDate: date.optional(), description: z.string().max(500).optional().nullable(), ewtCode: z.string().max(20).optional().nullable(), vatCode: z.string().max(20).optional(),
    lines: z.array(line).min(1), submit: z.boolean().optional() }))],
  request: { supplierId: 'SUP-001', supplierInvoiceNo: 'SI-10021', invoiceDate: '2026-10-01', lines: [{ description: 'Office supplies October', accountCode: '4401008', amount: 10000 }], submit: true },
  response: { success: true, data: invoice },
  handler: async (req, res) => {
    const r = await tx((db) => svc.createInvoice(db, req.body, req.user));
    await audit(req, { entity: 'supplier_invoice', entityId: r.id, action: 'create', after: r });
    if (r.status === 'for-approval') {
      await notifyApprovers({ audience: 'approve:payables', document: 'Supplier invoice', number: r.voucherNumber, by: req.user.username,
        detail: `${r.supplierName} ${r.supplierInvoiceNo}: ${r.grossAmount.toFixed(2)}`, link: LINK, entity: 'supplier_invoice', entityId: r.id });
    }
    created(res, r, `Supplier invoice ${r.voucherNumber} ${r.status === 'draft' ? 'saved' : r.status === 'approved' ? 'posted' : 'sent for approval'}`);
  },
});
define({
  method: 'POST', path: '/invoices/:id/submit', summary: 'Send a draft (or rejected) invoice for approval; without payables.maker_checker it is approved and posted at once', screen: `${S} > Supplier Invoices`,
  middleware: write, response: { success: true, data: invoice },
  handler: async (req, res) => {
    const r = await tx((db) => svc.submitInvoice(db, req.params.id, req.user));
    await audit(req, { entity: 'supplier_invoice', entityId: r.id, action: 'submit', after: { status: r.status } });
    if (r.status === 'for-approval') {
      await notifyApprovers({ audience: 'approve:payables', document: 'Supplier invoice', number: r.voucherNumber, by: req.user.username,
        detail: `${r.supplierName} ${r.supplierInvoiceNo}: ${r.grossAmount.toFixed(2)}`, link: LINK, entity: 'supplier_invoice', entityId: r.id });
    }
    ok(res, r, `Supplier invoice ${r.voucherNumber} ${r.status === 'approved' ? 'posted' : 'sent for approval'}`);
  },
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/invoices/:id/${action}`, summary: action === 'approve' ? 'Approve and post a supplier invoice (posting rule ap.invoice); not the preparer' : 'Reject a supplier invoice (reason required); not the submitter',
    screen: `${S} > Supplier Invoices > Approval`, middleware: [...approve, validate(z.object({ reason: action === 'reject' ? z.string().min(1).max(500) : z.string().max(500).optional() }))],
    request: action === 'reject' ? { reason: 'Wrong expense account' } : {}, response: { success: true, data: { ...invoice, status: action === 'approve' ? 'approved' : 'rejected' } },
    handler: async (req, res) => {
      const r = await tx((db) => (action === 'approve' ? svc.approveInvoice(db, req.params.id, req.user) : svc.rejectInvoice(db, req.params.id, req.body.reason, req.user)));
      await audit(req, { entity: 'supplier_invoice', entityId: r.id, action, after: { status: r.status, journalNumber: r.journalNumber, reason: req.body?.reason } });
      await notifyDecision({ userId: r.createdById, decidedBy: req.user.id, document: 'Supplier invoice', number: r.voucherNumber, approved: action === 'approve', by: req.user.username,
        reason: req.body?.reason || null, link: LINK, entity: 'supplier_invoice', entityId: r.id });
      ok(res, r, `Supplier invoice ${r.voucherNumber} ${r.status}${r.journalNumber ? ` (${r.journalNumber})` : ''}`);
    },
  });
}
define({
  method: 'POST', path: '/invoices/:id/cancel', summary: 'Cancel a supplier invoice without payments (an approved one is reversed)', screen: `${S} > Supplier Invoices`,
  middleware: [...write, validate(z.object({ reason: z.string().min(1).max(500) }))], request: { reason: 'Duplicate of APV-2026-00003' }, response: { success: true, data: { ...invoice, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.cancelInvoice(db, req.params.id, req.body.reason, req.user));
    await audit(req, { entity: 'supplier_invoice', entityId: r.id, action: 'cancel', after: { status: r.status, reason: req.body.reason } });
    ok(res, r, `Supplier invoice ${r.voucherNumber} cancelled`);
  },
});

const payment = { id: 'spy_1', paymentNumber: 'SPV-2026-00001', supplierName: 'Sample Office Supplies Trading', paymentDate: '2026-10-31', paymentMode: 'check', amount: 11100, status: 'posted',
  allocations: [{ voucherNumber: 'APV-2026-00001', amount: 11100 }] };
define({
  method: 'GET', path: '/payments', summary: 'Supplier payments (supplierId, search)', screen: `${S} > Supplier Payments`, middleware: read, response: { success: true, data: [payment] },
  handler: async (req, res) => ok(res, await svc.listPayments(pool, req.query)),
});
define({
  method: 'GET', path: '/payments/:id', summary: 'One supplier payment with the invoices it settles', screen: `${S} > Supplier Payments`, middleware: read, response: { success: true, data: payment },
  handler: async (req, res) => ok(res, await svc.getPayment(pool, req.params.id)),
});
define({
  method: 'GET', path: '/payments/:id/pdf', summary: 'Supplier payment voucher (PDF)', screen: `${S} > Supplier Payments`, middleware: read, response: 'application/pdf',
  handler: async (req, res) => {
    const r = await paymentPdf(pool, req.params.id);
    sendPdf(res, r.pdf, r.fileName);
  },
});
define({
  method: 'POST', path: '/payments', summary: 'Pay approved invoices of a supplier from a bank account (posting rule ap.payment)', screen: `${S} > Supplier Payments > New`,
  middleware: [...write, validate(z.object({ supplierId: z.union([z.string(), z.number()]), paymentDate: date.optional(), paymentMode: z.enum(['check', 'bank-transfer', 'cash']).optional(),
    payFromAccount: z.string().min(1).max(60), chequeNumber: z.string().max(40).optional().nullable(), reference: z.string().max(100).optional().nullable(), remarks: z.string().max(500).optional().nullable(),
    allocations: z.array(z.object({ invoiceId: z.string().min(1), amount: z.number().positive().optional() })).min(1) }))],
  request: { supplierId: 'SUP-001', paymentMode: 'check', payFromAccount: 'ACC-OPS-001', chequeNumber: '000781', allocations: [{ invoiceId: 'sin_1' }] }, response: { success: true, data: payment },
  handler: async (req, res) => {
    const r = await tx((db) => svc.createPayment(db, req.body, req.user));
    await audit(req, { entity: 'supplier_payment', entityId: r.id, action: 'create', after: r });
    created(res, r, `Payment ${r.paymentNumber} posted (${r.journalNumber})`);
  },
});
define({
  method: 'POST', path: '/payments/:id/cancel', summary: 'Cancel a supplier payment (journal reversed, invoices open again)', screen: `${S} > Supplier Payments`,
  middleware: [...write, validate(z.object({ reason: z.string().min(1).max(500) }))], request: { reason: 'Cheque spoiled' }, response: { success: true, data: { ...payment, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.cancelPayment(db, req.params.id, req.body.reason, req.user));
    await audit(req, { entity: 'supplier_payment', entityId: r.id, action: 'cancel', after: { status: r.status, reason: req.body.reason } });
    ok(res, r, `Payment ${r.paymentNumber} cancelled`);
  },
});
define({
  method: 'GET', path: '/ageing', summary: 'AP ageing of open supplier invoices on their due dates (asOf, supplierId; format=xlsx or csv)', screen: `${S} > AP Ageing`, middleware: read,
  query: { asOf: '2026-10-31' }, response: { success: true, data: { asOf: '2026-10-31', summary: { total: 11100, current: 11100 }, suppliers: [], rows: [] } },
  handler: async (req, res) => {
    const r = await svc.apAgeing(pool, req.query);
    if (['xlsx', 'csv'].includes(req.query.format)) {
      const header = ['Supplier', 'AP Voucher', 'Supplier Invoice', 'Invoice Date', 'Due Date', 'Days Past Due', 'Balance', 'Bucket'];
      sendTable(res, { header, rows: r.rows.map((x) => [x.supplierName, x.voucherNumber, x.supplierInvoiceNo, x.invoiceDate, x.dueDate, x.daysPastDue, x.balance, x.bucket]),
        fileBase: `ap-ageing-${r.asOf}`, format: req.query.format, sheetName: 'AP ageing' });
      return;
    }
    ok(res, r);
  },
});

export default router;
export const mount = '/payables';
