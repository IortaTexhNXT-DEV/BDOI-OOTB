import { importUpload } from '../../lib/uploadLimits.js';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, num, pageParams, sendList, sendNoData } from '../accounting/lib/http.js';
import { storeFile } from '../accounting/lib/files.js';
import { vouchersPdf } from '../documents/finance.js';
import { excelDate, readSheet } from '../accounting/lib/sheet.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Disbursements', '/disbursements');
const read = [requireAuth, requirePermission('read:disbursements')];
const write = [requireAuth, requirePermission('write:disbursements')];
const SCREEN = 'Accounts > Disbursement (Payment Voucher)';
const upload = importUpload();
const PAYEE_TYPES = ['Customer', 'Client', 'Insurer', 'Agent/Referrer', 'Supplier'];
const example = { disbursementId: 'pv_1', voucherNumber: 'PV-2026-00001', transactionNumber: 'DT-2026-00001', voucherDate: '2026-09-28', payeeType: 'Insurer', payeeName: 'Malayan Insurance Co., Inc.', customerCode: 'CL-2026-00001', insurerName: 'Malayan Insurance Co., Inc.', policyNumber: 'POL-2026-00001', amount: 12500, status: 'draft' };

const createSchema = z.object({
  voucherDate: z.string().optional(), departmentCode: z.string().optional(), branchCode: z.string().optional(), payeeType: z.enum(PAYEE_TYPES),
  criteria: z.string().optional(), customerCode: z.string().optional(), referrerId: z.string().optional(), referrerName: z.string().optional(),
  insurerName: z.string().optional(), policyNumber: z.string().optional(), transactionCode: z.string().optional(), transactionDescription: z.string().optional(),
  instrumentCurrency: z.string().optional(), remarks: z.string().optional(), amount: z.union([z.string(), z.number()]).optional(), paymentMode: z.string().optional(),
}).passthrough();

define({
  method: 'GET', path: '/', summary: 'Payment vouchers (paging; filter customerCode, voucherNumber, transactionNumber, fromDate, toDate, status, payeeType, referrerId, search)', screen: SCREEN,
  middleware: read, query: { page: 1, pageSize: 10, customerCode: 'CL-2026-00001', fromDate: '2026-09-01', toDate: '2026-09-30' },
  response: { success: true, data: [example], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
  handler: async (req, res) => {
    const pg = pageParams(req.query);
    const { rows, total } = await svc.listDisbursements(pool, req.query, pg);
    sendList(res, rows, total, pg);
  },
});
define({
  method: 'POST', path: '/', summary: 'Create a payment voucher (draft)', screen: `${SCREEN} > Create Voucher`, middleware: [...write, validate(createSchema)],
  request: { voucherDate: '2026-09-28', departmentCode: 'FI', branchCode: 'PHP', payeeType: 'Insurer', criteria: 'Specific', customerCode: 'CL-2026-00001', insurerName: 'Malayan Insurance Co., Inc.', transactionCode: 'REMT', instrumentCurrency: 'PHP', amount: '0.00' },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const d = await withTransaction((db) => svc.createDisbursement(db, req.body, req.user));
    await audit(req, { entity: 'disbursement', entityId: d.id, action: 'create', after: svc.disbursementRow(d) });
    created(res, svc.disbursementRow(d), 'Disbursement created');
  },
});
define({
  method: 'GET', path: '/printDisbursement', summary: 'Print payment vouchers, one per page, for a customer-code and date range or one disbursementId (PDF download URL)', screen: `${SCREEN} > Bulk print`, middleware: read,
  query: { customerCodeFrom: 'CL-2026-00001', customerCodeTo: 'CL-2026-00099', createdAtFrom: '2026-09-01', createdAtTo: '2026-09-30' },
  response: { success: true, message: 'Disbursements exported', data: { url: 'http://host/api/s3/object/print/…pdf?exp=1767225600&sig=...', filename: 'disbursements.pdf', count: 3 } },
  handler: async (req, res) => {
    const q = req.query;
    const rows = (await pool.query(`SELECT * FROM disbursements WHERE ($1::text IS NULL OR customer_code >= $1) AND ($2::text IS NULL OR customer_code <= $2)
      AND ($3::date IS NULL OR voucher_date >= $3) AND ($4::date IS NULL OR voucher_date <= $4) AND ($5::text IS NULL OR id = $5) ORDER BY customer_code, voucher_date`,
    [q.customerCodeFrom || q.customerCode || null, q.customerCodeTo || q.customerCodeFrom || q.customerCode || null, isoDate(q.createdAtFrom), isoDate(q.createdAtTo), q.disbursementId || null])).rows;
    if (!rows.length) { sendNoData(res, 'No disbursements found for the selected filters'); return; }
    const file = await storeFile(pool, { category: 'print', fileName: rows.length === 1 ? `${rows[0].voucher_number}.pdf` : 'disbursements.pdf', contentType: 'application/pdf', buffer: await vouchersPdf(pool, rows), entity: 'disbursement', entityId: rows.length === 1 ? rows[0].id : null, userId: req.user.id });
    ok(res, { url: file.url, filename: file.fileName, key: file.key, count: rows.length }, 'Disbursements exported');
  },
});
define({
  method: 'POST', path: '/bulk-upload', summary: 'Bulk create vouchers from an .xlsx / .csv file (multipart field "file")', screen: `${SCREEN} > Bulk upload`, middleware: [...write, upload.single('file')],
  request: { file: '(xlsx) columns: voucherDate, payeeType, customerCode, insurerName, policyNumber, referrerId, amount, transactionCode, transactionDescription, remarks' },
  response: { success: true, data: { message: '2 of 2 rows imported', total: 2, created: 2, failed: 0, errors: [] } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('Attach the file in the "file" field');
    const rows = readSheet(req.file.buffer, req.file.originalname);
    const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
    if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
    const errors = []; const ids = [];
    for (const [i, r] of rows.entries()) {
      try {
        const parsed = createSchema.parse({ ...r, payeeType: r.payeeType || 'Customer', voucherDate: excelDate(r.voucherDate) || undefined, amount: r.amount || '0' });
        if (parsed.payeeType !== 'Agent/Referrer' && !(num(parsed.amount) > 0)) throw badRequest('amount must be greater than zero');
        const d = await withTransaction((db) => svc.createDisbursement(db, parsed, req.user, { source: 'bulk-upload' }));
        ids.push(d.id);
      } catch (e) {
        errors.push({ row: i + 2, error: e.issues ? e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') : e.message });
      }
    }
    await audit(req, { entity: 'disbursement', entityId: null, action: 'bulk-upload', after: { file: req.file.originalname, created: ids.length, failed: errors.length } });
    ok(res, { message: `${ids.length} of ${rows.length} rows imported`, total: rows.length, created: ids.length, failed: errors.length, errors, ids }, `${ids.length} disbursements imported`);
  },
});

const checkbookExample = { checkbookId: 'chk_1', invoiceListRefId: 'il_1', customerCode: 'CL-2026-00001', customerName: 'Maria Santos', mainAccount: '1102001', instrumentBookId: 'BDO-CB-01', instrumentNo: '000123', instrumentDate: '2026-09-28', totaleAmount: 12500, status: 'Pending' };
define({
  method: 'POST', path: '/checkbook', summary: 'Issue a cheque (checkbook entry) for an invoice-list row', screen: `${SCREEN} > Specific voucher`,
  middleware: [...write, validate(z.object({ invoiceListRefId: z.string().optional(), disbursementId: z.string().optional(), customerCode: z.string().optional(), customerName: z.string().optional(),
    mainAccount: z.string().optional(), instrumentBookId: z.string().optional(), instrumentNo: z.string().optional(), instrumentDate: z.string().optional(),
    totaleAmount: z.union([z.string(), z.number()]).optional(), status: z.string().optional() }).passthrough())],
  request: { customerCode: 'CL-2026-00001', customerName: 'Maria Santos', mainAccount: '1102001', instrumentBookId: 'BDO-CB-01', instrumentNo: '000123', instrumentDate: '2026-09-28', totaleAmount: '12500', status: 'Pending', invoiceListRefId: 'il_1' },
  response: { success: true, data: checkbookExample },
  handler: async (req, res) => {
    const c = await withTransaction((db) => svc.createCheckbook(db, req.body, req.user));
    await audit(req, { entity: 'checkbook', entityId: c.id, action: 'create', after: svc.checkbookRow(c) });
    created(res, svc.checkbookRow(c), 'Checkbook created');
  },
});
define({
  method: 'PUT', path: '/checkbook/:id', summary: 'Cheque status: Pending -> Approved (maker-checker; posts payment journal) -> Printed (voucher paid) or Cancelled', screen: `${SCREEN} > Bank detail selection`,
  middleware: [...write, validate(z.object({ status: z.enum(['Pending', 'Approved', 'Printed', 'Cancelled']).optional(), totaleAmount: z.union([z.string(), z.number()]).optional() }).passthrough())],
  request: { status: 'Approved', totaleAmount: '12500' }, response: { success: true, data: { ...checkbookExample, status: 'Approved' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.updateCheckbook(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'checkbook', entityId: req.params.id, action: req.body.status ? `status:${req.body.status}` : 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Checkbook updated');
  },
});

const invoiceExample = { invoiceListId: 'il_1', invoiceNumber: 'IL-2026-00001', customerCode: 'CL-2026-00001', payables: 12500, outstanding: 0, fcAmount: 0, lcAmount: 12500, excess: 0, balAmount: 0, vat: 1339.29, wht: 0, totalAmount: 12500, bankCode: 'BDO', isInvoicePaid: true, status: 'open', checkbooks: [] };
define({
  method: 'GET', path: '/invoice-list', summary: 'Invoice-list rows (payables) with cheques; filter customerCode, status, disbursementId, payeeType', screen: `${SCREEN} > Specific voucher`,
  middleware: read, query: { page: 1, pageSize: 10, customerCode: 'CL-2026-00001' }, response: { success: true, data: [invoiceExample], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
  handler: async (req, res) => {
    const pg = pageParams(req.query);
    const { rows, total } = await svc.listInvoiceLists(pool, req.query, pg);
    sendList(res, rows, total, pg);
  },
});
define({
  method: 'POST', path: '/invoice-list', summary: 'Record a payable (e.g. premium collected to remit, refund due) for a customer', screen: 'Accounts > Receipts > Add receipt (approve); Endorsement payment',
  middleware: [requireAuth, requirePermission('write:disbursements', 'write:receipts', 'write:endorsements'), validate(z.object({ customerCode: z.string().nullable().optional() }).passthrough())],
  request: { customerCode: 'CL-2026-00001', payables: '12500.00', outstanding: '0.00', fcAmount: '0.00', lcAmount: '12500.00', excess: '0.00', balAmount: '0.00', vat: '1339.29', wht: '0.00', totalAmount: '12500.00', bankCode: 'BDO', bankAmount: '12500.00', isInvoicePaid: true },
  response: { success: true, data: invoiceExample },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.createInvoiceList(db, req.body, req.user));
    await audit(req, { entity: 'invoice_list', entityId: r.id, action: 'create', after: req.body });
    created(res, svc.invoiceRow(r), 'Invoice list created');
  },
});
define({
  method: 'GET', path: '/invoice-list/:id', summary: 'One invoice-list row with its cheques', screen: `${SCREEN} > Bank detail selection`, middleware: read,
  response: { success: true, data: invoiceExample },
  handler: async (req, res) => ok(res, await svc.getInvoiceList(pool, req.params.id)),
});
define({
  method: 'GET', path: '/agent-invoice-lines', summary: 'Approved commission lines of a referrer as invoice-list rows', screen: `${SCREEN} > Specific voucher (Agent/Referrer)`, middleware: read,
  query: { referrerId: 'ref-dcruz' }, response: { success: true, data: { referrer: { id: 'ref-dcruz', name: 'Juan Dela Cruz' }, invoiceList: [{ commissionLineId: 'cm_1', policyNumber: 'POL-2026-00001', comsub: 1200, wht: 60, totalAmount: 1140 }] } },
  handler: async (req, res) => {
    if (!req.query.referrerId) throw badRequest('referrerId is required');
    ok(res, await svc.agentInvoiceLines(pool, req.query.referrerId));
  },
});
define({
  method: 'POST', path: '/bulk-agent-disburse', summary: 'One payout voucher (for approval) per selected referrer with Approved lines', screen: `${SCREEN} > Bulk Disburse`,
  middleware: [...write, validate(z.object({ referrerIds: z.array(z.string()).min(1), transactionCode: z.string().optional(), instrumentCurrency: z.string().optional() }))],
  request: { referrerIds: ['ref-dcruz'], transactionCode: 'COMSUB', instrumentCurrency: 'PHP' },
  response: { success: true, data: { vouchers: [{ referrerId: 'ref-dcruz', disbursementId: 'pv_1', voucherNumber: 'PV-2026-00002', amount: 2280 }], errors: [] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.bulkAgentDisburse(db, req.body, req.user));
    await audit(req, { entity: 'disbursement', entityId: null, action: 'bulk-agent-disburse', after: r });
    ok(res, r, `${r.vouchers.length} voucher(s) created`);
  },
});
define({
  method: 'POST', path: '/insurer-remittance', summary: 'Build an insurer remittance voucher from collected premium not yet remitted (net of commission)', screen: `${SCREEN} > Create Voucher (Insurer)`,
  middleware: [...write, validate(z.object({ insuranceCompanyId: z.union([z.string(), z.number()]).optional(), insurerName: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), transactionCode: z.string().optional(), remarks: z.string().optional(), policyIds: z.array(z.string()).optional() }))],
  request: { insurerName: 'Malayan Insurance Co., Inc.', fromDate: '2026-09-01', toDate: '2026-09-30' }, response: { success: true, data: { ...example, invoiceList: [invoiceExample] } },
  handler: async (req, res) => {
    const d = await withTransaction((db) => svc.createInsurerRemittance(db, req.body, req.user));
    await audit(req, { entity: 'disbursement', entityId: d.id, action: 'create-remittance', after: { amount: d.amount, invoices: d.invoiceList.length } });
    created(res, d, 'Remittance voucher created');
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Voucher with invoice list, cheques and (agent payouts) commission lines', screen: `${SCREEN} > Detail view`, middleware: read,
  response: { success: true, data: { ...example, invoiceList: [invoiceExample] } },
  handler: async (req, res) => ok(res, await svc.getDisbursement(pool, req.params.id)),
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a voucher (amount, header fields, draft / for-approval / cancelled)', screen: `${SCREEN} > Bank detail selection`,
  middleware: [...write, validate(z.object({ amount: z.union([z.string(), z.number()]).optional(), status: z.string().optional() }).passthrough())],
  request: { amount: '12500.00' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.updateDisbursement(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'disbursement', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Disbursement updated');
  },
});
define({
  method: 'POST', path: '/:id/approve-agent-payout', summary: 'Checker approves an agent payout: pays the selected Approved lines (Dr Commission Payable / Cr Cash / Cr WHT)', screen: `${SCREEN} > Bank detail selection (Agent/Referrer)`,
  middleware: [...write, validate(z.object({ lineIds: z.array(z.string()).min(1) }))],
  request: { lineIds: ['cm_1', 'cm_2'] }, response: { success: true, data: { disbursementId: 'pv_1', voucherNumber: 'PV-2026-00002', amount: 2280, grossAmount: 2400, whtAmount: 120, status: 'paid' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.approveAgentPayout(db, req.params.id, req.body.lineIds, req.user));
    await audit(req, { entity: 'disbursement', entityId: r.disbursementId, action: 'approve-agent-payout', after: r });
    ok(res, r, `Approved — voucher ${r.voucherNumber}`);
  },
});
export default router;
export const mount = '/disbursements';
