import { importUpload } from '../../lib/uploadLimits.js';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, pageParams, sendList, sendNoData } from '../accounting/lib/http.js';
import { storeFile } from '../accounting/lib/files.js';
import { receiptsPdf } from '../documents/finance.js';
import { camel, excelDate, readSheet } from '../accounting/lib/sheet.js';
import { mapColumns } from '../documents/tabular.js';
import { ownRecord, withScope, scopeOf, scopeSql, canSee } from '../../lib/scope.js';
import * as svc from './service.js';
import * as billing from './billing.js';
import { emailBill, emailReceipt } from './email.js';
import { emailSendingStatus } from '../../lib/mailer.js';
import { loadOpenItem, OPEN_ITEM_COLUMNS } from './opening.js';
import { sendTemplate } from '../documents/uploadTemplates.js';

const { router, define } = moduleRouter('Receipts', '/receipts');
const read = [requireAuth, requirePermission('read:receipts')];
const write = [requireAuth, requirePermission('write:receipts')];
// Official receipts (cash posting) are Accounting-only (segregation of duties). Sales, Operations and Processing record the
// client's payment with POST /policies/:id/payments, which Accounting verifies (POST /policies/:id/payments/:paymentId/confirm).
const SCREEN = 'Accounts > Receipts';
const upload = importUpload();
const line = { receiptListId: 'rl_1', policies: 'POL-2026-00001', netPremium: '10000.00', paid: '11862.50', unPaid: '0.00', discounts: '0.00', dst: '1250.00', lgt: '75.00', vat: '1200.00', ewt: '0.00', other: '0.00', fcAmount: '0.00', lcAmount: '11862.50', status: 'Paid' };
const example = { receiptId: 'or_1', receiptNumber: 'OR-2026-00001', receiptType: 'Payment', receiptDate: '2026-09-28', customerCode: 'CL-2026-00001', currencyCode: 'PHP', transactionCode: 'PAYMENT', transactionNumber: 'RT-2026-00001', name: 'Maria Santos', policyRefId: 'pol_1', policyNumber: 'POL-2026-00001', receiptStatus: 'Converted', amount: 11862.5, receiptsList: [line] };

const lineSchema = z.object({
  receiptListId: z.string().optional(), policies: z.string().optional(), policyId: z.string().optional(), netPremium: z.union([z.string(), z.number()]).optional(),
  paid: z.union([z.string(), z.number()]).optional(), unPaid: z.union([z.string(), z.number()]).optional(), lcAmount: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
}).passthrough();
const emailList = z.string().trim().max(1000).refine((v) => v.split(/[,;]/).map((x) => x.trim()).filter(Boolean).every((x) => z.string().email().safeParse(x).success), 'Enter e-mail addresses separated by commas');
/** Body of the e-mail actions: recipients (default: the client's e-mail address) and a note added to the message. */
const emailSchema = z.object({ to: z.string().trim().email().optional().or(z.literal('')), cc: emailList.optional().or(z.literal('')), note: z.string().max(2000).optional() });
const emailExample = { emailId: 41, to: 'maria.santos@example.ph', cc: null, subject: 'Official receipt OR-2026-00001 for policy POL-2026-00001' };
const queuedMessage = async (to) => ((await emailSendingStatus()).active ? `E-mail to ${to} queued` : `E-mail to ${to} queued; it goes out once e-mail sending is enabled`);

const receiptSchema = z.object({
  receiptType: z.string().optional(), receiptDate: z.string().optional(), customerCode: z.string().optional(), currencyCode: z.string().optional(), transactionCode: z.string().optional(),
  transactionNumber: z.string().optional(), remarks: z.string().optional(), policyRefId: z.string().optional(), name: z.string().optional(), branchCode: z.string().nullable().optional(),
  departmentCode: z.string().nullable().optional(), receiptsList: z.array(lineSchema).optional(), receivableId: z.string().optional(), policyId: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(), paymentMode: z.enum(svc.PAYMENT_MODES).optional(), referenceNo: z.string().optional(),
  bankId: z.number().int().optional(), receivedDate: z.string().optional(),
}).passthrough();

define({
  method: 'GET', path: '/', summary: 'Receipts (paging; filter customerCode, name, transactionNumber, transactionCode, policyId, receiptStatus, fromDate, toDate, search)', screen: SCREEN,
  middleware: read, query: { page: 1, pageSize: 10, customerCode: 'CL-2026-00001', receiptStatus: 'Converted' },
  response: { success: true, data: [example], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
  handler: async (req, res) => {
    const pg = pageParams(req.query);
    const { rows, total } = await svc.listReceipts(pool, await withScope(req), pg);
    sendList(res, rows, total, pg);
  },
});
define({
  method: 'GET', path: '/search', summary: 'Search receipts by one field (name, customerCode, transactionNumber, transactionCode, receiptNumber, policyNumber)', screen: `${SCREEN} > Search`,
  middleware: read, query: { name: 'Santos', page: 1, pageSize: 10 }, response: { success: true, data: [example] },
  handler: async (req, res) => {
    const pg = pageParams(req.query);
    const { rows, total } = await svc.listReceipts(pool, await withScope(req), pg);
    sendList(res, rows, total, pg);
  },
});
define({
  method: 'GET', path: '/open-receivables', summary: 'Open (unpaid / partial) bills to collect: customer, policy, bill number, amount, balance, due date (filter customerCode, policyNumber, search)',
  screen: `${SCREEN} > Add receipt`, middleware: read, query: { customerCode: 'CL-2026-00001', policyNumber: 'POL-2026-00001' },
  response: { success: true, data: [{ receivableId: 'rcv_1', billNumber: 'INV-2026-00002', source: 'endorsement', customerCode: 'CL-2026-00001', customerName: 'Maria Santos', policyId: 'pol_1', policyNumber: 'POL-2026-00001', amount: 5010, paidAmount: 0, balance: 5010, dueDate: '2026-10-28', status: 'Open', currency: 'PHP' }] },
  handler: async (req, res) => ok(res, await svc.listOpenReceivables(pool, await withScope(req))),
});
define({
  method: 'GET', path: '/printReceipt', summary: 'Print official receipts, one per page (one receiptId, or customer-code and date range) to a PDF download URL', screen: `${SCREEN} > Bulk print / Print`, middleware: read,
  query: { customerCodeFrom: 'CL-2026-00001', customerCodeTo: 'CL-2026-00099', createdAtFrom: '2026-09-01', createdAtTo: '2026-09-30' },
  response: { success: true, message: 'Receipts exported', data: { url: 'http://host/api/s3/object/print/…pdf?exp=1767225600&sig=...', filename: 'receipts.pdf', count: 2 } },
  handler: async (req, res) => {
    const q = req.query;
    const from = q.customerCodeFrom || q.customerCode || null;
    const params = [q.receiptId || null, from, q.customerCodeTo || from, isoDate(q.createdAtFrom), isoDate(q.createdAtTo)];
    const own = scopeSql(await scopeOf(req), 'receipt', 'r', params);
    const rows = (await pool.query(`SELECT * FROM receipts r WHERE receipt_status <> 'Cancelled' AND ($1::text IS NULL OR id = $1 OR receipt_number = $1)
      AND ($2::text IS NULL OR customer_code >= $2) AND ($3::text IS NULL OR customer_code <= $3) AND ($4::date IS NULL OR received_date >= $4) AND ($5::date IS NULL OR received_date <= $5)
      AND ${own} ORDER BY customer_code, received_date`, params)).rows;
    if (!rows.length) { sendNoData(res, 'No receipts found for the selected filters'); return; }
    const file = await storeFile(pool, { category: 'print', fileName: rows.length === 1 ? `${rows[0].receipt_number}.pdf` : 'receipts.pdf', contentType: 'application/pdf', buffer: await receiptsPdf(pool, rows), entity: 'receipt', entityId: rows.length === 1 ? rows[0].id : null, userId: req.user.id });
    ok(res, { url: file.url, filename: file.fileName, key: file.key, count: rows.length }, 'Receipts exported');
  },
});
define({
  method: 'POST', path: '/bulk-upload', summary: 'Bulk official receipts from an .xlsx / .csv file (multipart "file"); each row pays a policy', screen: `${SCREEN} > Bulk upload`, middleware: [...write, upload.single('file')],
  request: { file: '(xlsx) columns: policyNumber, amount, receiptDate, paymentMode, referenceNo, customerCode, remarks' },
  response: { success: true, data: { message: '2 of 2 rows imported', total: 2, created: 2, failed: 0, errors: [] } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('Attach the file in the "file" field');
    const rows = readSheet(req.file.buffer, req.file.originalname);
    const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
    if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
    const errors = []; const ids = [];
    for (const [i, r] of rows.entries()) {
      try {
        const v = mapColumns(r, svc.RECEIPT_UPLOAD_COLUMNS, camel);
        const body = receiptSchema.parse({ policyId: v.policyNumber, amount: v.amount, receiptDate: excelDate(v.receiptDate) || undefined,
          paymentMode: v.paymentMode ? String(v.paymentMode).toLowerCase().replace(/\s+/g, '-') : undefined, referenceNo: v.referenceNo,
          customerCode: v.customerCode, remarks: v.remarks, transactionCode: v.transactionCode });
        const rc = await withTransaction((db) => svc.createReceipt(db, body, req.user, { source: 'bulk-upload' }));
        ids.push(rc.receiptId);
      } catch (e) {
        errors.push({ row: i + 2, error: e.issues ? e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') : e.message });
      }
    }
    await audit(req, { entity: 'receipt', entityId: null, action: 'bulk-upload', after: { file: req.file.originalname, created: ids.length, failed: errors.length } });
    ok(res, { message: `${ids.length} of ${rows.length} rows imported`, total: rows.length, created: ids.length, failed: errors.length, errors, ids }, `${ids.length} receipts imported`);
  },
});
define({
  method: 'GET', path: '/opening-items/template', summary: 'Go-live open items upload template (XLSX)', screen: 'Accounts > Collections > Import open items', middleware: read,
  response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'open-items'),
});
define({
  method: 'POST', path: '/opening-items/import', summary: 'Go-live: load unpaid premium bills of the old system (multipart "file" + goLiveDate) against existing policies; no journal (the GL opening balance carries them); rows already loaded for the date are skipped',
  screen: 'Accounts > Collections > Import open items', middleware: [...write, upload.single('file')], request: { goLiveDate: '2026-10-01', file: '(multipart) Open_Items_Upload_Template.xlsx' },
  response: { success: true, data: { message: 'Processed 2 rows: 2 created, 0 already loaded, 0 failed', total: 2, created: 2, skipped: 0, failed: 0, errors: [] } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('Attach the file in the "file" field');
    const goLiveDate = String(req.body?.goLiveDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goLiveDate)) throw badRequest('goLiveDate is required (YYYY-MM-DD)');
    const rows = readSheet(req.file.buffer, req.file.originalname);
    const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
    if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
    const errors = []; let createdCount = 0; let skipped = 0;
    for (const [i, r] of rows.entries()) {
      try {
        const x = await withTransaction((db) => loadOpenItem(db, mapColumns(r, OPEN_ITEM_COLUMNS, camel), { goLiveDate, user: req.user }));
        if (x.status === 'created') createdCount += 1; else skipped += 1;
      } catch (e) {
        errors.push({ row: i + 2, message: e.code === '23505' ? 'This bill reference was loaded by another upload at the same time' : e.message });
      }
    }
    const data = { message: `Processed ${rows.length} rows: ${createdCount} created, ${skipped} already loaded, ${errors.length} failed`, goLiveDate, total: rows.length, created: createdCount, skipped, failed: errors.length, errors };
    await audit(req, { entity: 'receivable', entityId: null, action: 'go-live-open-items', after: { file: req.file.originalname, goLiveDate, created: createdCount, skipped, failed: errors.length } });
    ok(res, data, data.message);
  },
});
define({
  method: 'POST', path: '/', summary: 'Finance (write:receipts): create an official receipt: receiptsList lines (Draft/pay-later or Paid) or a simple payment {receivableId|policyId, amount}. Paid amounts reduce the receivable and post Dr Cash / Cr Premium Receivable',
  screen: `${SCREEN} > Add receipt`, middleware: [...write, validate(receiptSchema)],
  request: { receiptType: 'Payment', receiptDate: '2026-09-28T00:00:00.000Z', customerCode: 'CL-2026-00001', currencyCode: 'PHP', transactionCode: 'PAYMENT', remarks: 'Payment receipt for policy POL-2026-00001', policyRefId: 'pol_1', receiptsList: [line] },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.createReceipt(db, req.body, req.user));
    await audit(req, { entity: 'receipt', entityId: r.receiptId, action: 'create', after: r });
    created(res, r, `Receipt ${r.receiptNumber} created`);
  },
});
define({
  method: 'GET', path: '/:id', summary: 'One receipt (by id or receipt number) with receiptsList', screen: `${SCREEN} > Add receipt edit / View`, middleware: [...read, ownRecord('receipt')],
  response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.getReceipt(pool, req.params.id)),
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a receipt; lines newly marked Paid (or with a higher paid amount) are applied and journalised; status is recalculated', screen: `${SCREEN} > Add receipt edit > Approve`,
  middleware: [...write, ownRecord('receipt'), validate(receiptSchema)], request: { receiptsList: [{ ...line, receiptListId: undefined }] }, response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.updateReceipt(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'receipt', entityId: r.after.receiptId, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Receipt updated');
  },
});
define({
  method: 'POST', path: '/:id/add-payment', summary: 'Add a payment line to an existing receipt', screen: `${SCREEN} > Add receipt edit`,
  middleware: [...write, ownRecord('receipt'), validate(z.object({ amount: z.union([z.string(), z.number()]).optional(), paid: z.union([z.string(), z.number()]).optional(), paymentMode: z.string().optional(), referenceNo: z.string().optional() }).passthrough())],
  request: { amount: 5000, paymentMode: 'gcash', referenceNo: 'GC-0001' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.addPayment(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'receipt', entityId: r.after.receiptId, action: 'add-payment', before: r.before, after: r.after });
    ok(res, r.after, 'Payment added');
  },
});
define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel a receipt: reverses its payment journals and restores receivable balances', screen: `${SCREEN} > View`,
  middleware: [...write, ownRecord('receipt'), validate(z.object({ reason: z.string().min(3) }))], request: { reason: 'Cheque bounced' }, response: { success: true, data: { ...example, receiptStatus: 'Cancelled' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.cancelReceipt(db, req.params.id, req.body.reason, req.user));
    await audit(req, { entity: 'receipt', entityId: r.after.receiptId, action: 'cancel', before: r.before, after: r.after });
    ok(res, r.after, 'Receipt cancelled');
  },
});

define({
  method: 'POST', path: '/:id/email', summary: 'E-mail the official receipt to the client with its PDF attached (to: default the client\'s e-mail address; cc; note); 400 without an address',
  screen: `${SCREEN} > View > E-mail receipt`, middleware: [...write, ownRecord('receipt'), validate(emailSchema)], request: { to: 'maria.santos@example.ph', cc: 'accounts@example.ph', note: 'Thank you for your prompt payment.' },
  response: { success: true, message: 'E-mail to maria.santos@example.ph queued', data: emailExample },
  handler: async (req, res) => {
    const r = await withTransaction((db) => emailReceipt(db, req.params.id, req.body || {}));
    await audit(req, { entity: 'receipt', entityId: r.receiptId, action: 'email', after: { emailId: r.emailId, to: r.to, cc: r.cc, subject: r.subject } });
    ok(res, r, await queuedMessage(r.to));
  },
});

// Billing statements (PDF) used by Policy detail > Generate invoice
const b = moduleRouter('Billing statements', '/billing-statement');
const bRead = [requireAuth, requirePermission('read:policies', 'read:receipts')];
const ownPolicy = ownRecord('policy', 'policyId');
/** The endorsement statements accept an endorsement or a policy id. */
const ownEndorsementOrPolicy = (req, _res, next) => (async () => {
  const scope = await scopeOf(req);
  if (scope && !(await canSee(scope, 'endorsement', req.params.id)) && !(await canSee(scope, 'policy', req.params.id))) throw notFound('Endorsement not found');
})().then(() => next(), next);
/** A bill (receivable id or bill number) of a policy the user may see. */
const ownBill = (req, _res, next) => (async () => {
  const scope = await scopeOf(req);
  if (!scope) return;
  const { policy } = await billing.findBill(pool, req.params.id);
  if (!(await canSee(scope, 'policy', policy.id))) throw notFound('Bill not found');
})().then(() => next(), next);
const sendPdf = (res, { fileName, pdf }) => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`); res.send(pdf); };
b.define({ method: 'GET', path: '/policy/:policyId/generate', summary: 'Policy billing statement (PDF)', screen: 'Agent > Policy detail > Generate invoice (policy)', middleware: [...bRead, ownPolicy], response: '(application/pdf)',
  handler: async (req, res) => sendPdf(res, await billing.policyStatement(pool, req.params.policyId)) });
b.define({ method: 'GET', path: '/endorsement/:id/preview', summary: 'Endorsement billing preview (JSON); id = endorsement or policy id', screen: 'Agent > Endorsement', middleware: [...bRead, ownEndorsementOrPolicy],
  response: { success: true, data: { policyNumber: 'POL-2026-00001', endorsement: { endorsementNumber: 'END-2026-00001', premiumDelta: 1500 }, bills: [], totalDue: 0 } },
  handler: async (req, res) => ok(res, await billing.endorsementPreview(pool, req.params.id)) });
b.define({ method: 'GET', path: '/endorsement/:id/generate', summary: 'Endorsement billing statement (PDF); id = endorsement or policy id', screen: 'Agent > Policy detail > Generate invoice (endorsement)', middleware: [...bRead, ownEndorsementOrPolicy], response: '(application/pdf)',
  handler: async (req, res) => sendPdf(res, await billing.endorsementStatement(pool, req.params.id)) });
b.define({ method: 'GET', path: '/renewal/:policyId/generate', summary: 'Renewal billing statement (PDF)', screen: 'Agent > Policy detail > Generate invoice (renewal)', middleware: [...bRead, ownPolicy], response: '(application/pdf)',
  handler: async (req, res) => sendPdf(res, await billing.renewalStatement(pool, req.params.policyId)) });

b.define({ method: 'GET', path: '/bills/:id/generate', summary: 'Premium invoice / statement of account of one bill (PDF); id = receivable id or bill number', screen: 'Accounts > Collections > Detail > Invoice',
  middleware: [...bRead, ownBill], response: '(application/pdf)', handler: async (req, res) => sendPdf(res, await billing.billStatement(pool, req.params.id)) });
b.define({ method: 'POST', path: '/bills/:id/email', summary: 'E-mail the premium invoice / statement of account of a bill to the client with its PDF attached (to: default the client\'s e-mail address; cc; note); 400 without an address',
  screen: 'Accounts > Collections > Detail > E-mail invoice', middleware: [requireAuth, requirePermission('write:receipts', 'write:collections'), ownBill, validate(emailSchema)],
  request: { to: 'maria.santos@example.ph', note: 'The first instalment is due on 28 October.' },
  response: { success: true, message: 'E-mail to maria.santos@example.ph queued', data: { ...emailExample, subject: 'Premium invoice INV-2026-00002 for policy POL-2026-00001' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => emailBill(db, req.params.id, req.body || {}, { user: req.user }));
    await audit(req, { entity: 'receivable', entityId: r.receivableId, action: 'email', after: { emailId: r.emailId, to: r.to, cc: r.cc, subject: r.subject } });
    ok(res, r, await queuedMessage(r.to));
  } });

export default router;
export const mount = '/receipts';
export const extraMounts = [['/billing-statement', b.router]];
