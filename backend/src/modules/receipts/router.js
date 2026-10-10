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
import { columnMessage, issueText, mapColumns, sendTable, uploadResult } from '../documents/tabular.js';
import { ownRecord, withScope, scopeOf, scopeSql, canSee } from '../../lib/scope.js';
import * as svc from './service.js';
import * as billing from './billing.js';
import * as reversal from './reversal.js';
import * as batches from './batches.js';
import * as unapplied from './unapplied.js';
import * as bankPayments from './bankPayments.js';
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
  method: 'GET', path: '/bulk-upload/template', summary: 'Official receipts upload template (XLSX: Data, Columns and Instructions sheets)', screen: `${SCREEN} > Bulk upload > Download template`,
  middleware: read, response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'receipts'),
});
define({
  method: 'POST', path: '/bulk-upload', summary: 'Bulk official receipts from an .xlsx / .csv file (multipart "file"); each row pays a policy', screen: `${SCREEN} > Bulk upload`, middleware: [...write, upload.single('file')],
  request: { file: '(xlsx) columns: policyNumber, amount, receiptDate, paymentMode, referenceNo, customerCode, remarks' },
  response: { success: true, data: { message: 'Processed 2 rows: 2 created, 0 failed', total: 2, created: 2, failed: 0, errors: [] } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('Attach the file in the "file" field');
    const rows = readSheet(req.file.buffer, req.file.originalname);
    const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
    if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
    const parse = (v) => receiptSchema.parse({ policyId: v.policyNumber, amount: v.amount, receiptDate: excelDate(v.receiptDate) || undefined,
      paymentMode: v.paymentMode ? String(v.paymentMode).toLowerCase().replace(/\s+/g, '-') : undefined, referenceNo: v.referenceNo,
      customerCode: v.customerCode, remarks: v.remarks, transactionCode: v.transactionCode });
    const r = await batches.runBatch(rows, { fileName: req.file.originalname, parse, user: req.user });
    await audit(req, { entity: 'receipt_batch', entityId: r.batch.id, action: 'bulk-upload', after: { file: req.file.originalname, batchNumber: r.batch.batchNumber, created: r.ids.length,
      failed: r.errors.length, commissionTotal: r.batch.commissionTotal } });
    const data = uploadResult(rows.length, r.ids.length, r.errors.map((e) => ({ row: e.row, message: e.issues ? issueText(e.issues, svc.RECEIPT_UPLOAD_COLUMNS) : columnMessage(e.message, svc.RECEIPT_UPLOAD_COLUMNS) })),
      { ids: r.ids, batch: r.batch });
    if (r.batch.commissionRows) data.message = `${data.message}; commission of ${r.commissionText} on ${r.batch.commissionRows} row(s) kept apart in batch ${r.batch.batchNumber}`;
    ok(res, data, data.message);
  },
});
define({
  method: 'GET', path: '/batches', summary: 'Receipt voucher batches (bulk uploads), newest first, with their premium and commission totals', screen: `${SCREEN} > Receipt batches`, middleware: read,
  response: { success: true, data: [{ id: 'rvb_1', batchNumber: 'RVB-2026-00004', fileName: 'rv-2026-10-05.xlsx', rows: 240, created: 238, failed: 2, premiumTotal: 1250000, commissionTotal: 182300, commissionRows: 51 }] },
  handler: async (_req, res) => ok(res, await batches.listBatches()),
});
define({
  method: 'GET', path: '/batches/:id', summary: 'One receipt batch: the commission part kept apart, or for a bank payment upload its lines and how each was matched; format=xlsx or csv exports them',
  screen: `${SCREEN} > Receipt batches > Export commission`, middleware: read,
  response: { success: true, data: { batchNumber: 'RVB-2026-00004', commissionLines: [{ row: 5, policyNumber: 'POL-2026-90004', insurer: 'Malayan Insurance Co., Inc.', amount: 4200, referenceNo: 'BDO-1', receiptNumber: 'OR-2026-00120' }] } },
  handler: async (req, res) => {
    const b = await batches.getBatch(req.params.id);
    if (['xlsx', 'csv'].includes(req.query.format) && b.kind === 'bank-payments') {
      const cols = [['Row', 'row'], ['Date', 'paidOn'], ['Reference', 'reference'], ['Amount', 'amount'], ['Outcome', 'outcome'], ['Policy No.', 'policyNumber'], ['Client', 'clientName'],
        ['Expected', 'expected'], ['Difference', 'difference'], ['Receipt No.', 'receiptNumber'], ['Note', 'message']];
      await sendTable(res, { header: cols.map((c) => c[0]), rows: b.lines.map((l) => cols.map((c) => l[c[1]] ?? '')), fileBase: `bank-payments-${b.batchNumber}`, format: req.query.format,
        sheetName: b.batchNumber });
      return;
    }
    if (['xlsx', 'csv'].includes(req.query.format)) {
      const cols = [['Row', 'row'], ['Policy No.', 'policyNumber'], ['Client', 'clientName'], ['Insurer', 'insurer'], ['Commission', 'amount'], ['Premium receipted', 'premium'],
        ['Receipt No.', 'receiptNumber'], ['Reference', 'referenceNo'], ['Receipt Date', 'receiptDate']];
      await sendTable(res, { header: cols.map((c) => c[0]), rows: b.commissionLines.map((l) => cols.map((c) => l[c[1]] ?? '')), fileBase: `commission-${b.batchNumber}`, format: req.query.format,
        sheetName: b.batchNumber });
      return;
    }
    ok(res, b);
  },
});
const uploadRows = async (req) => {
  if (!req.file) throw badRequest('Attach the file in the "file" field');
  const rows = readSheet(req.file.buffer, req.file.originalname);
  const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
  if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
  return rows;
};
define({
  method: 'GET', path: '/bank-payments/template', summary: 'Bank payments upload template (XLSX)', screen: `${SCREEN} > Bulk Upload > Bank payments (matched by reference) > Download template`, middleware: read,
  response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'bank-payments'),
});
define({
  method: 'POST', path: '/bank-payments', summary: "A bank's report of payments (multipart \"file\"): each line matched by its reference to what the policy owes within bank_matching.tolerance; overpaid: the excess held On Account; underpaid: listed as insufficient; no bill found: a floating payment",
  screen: `${SCREEN} > Bulk Upload > Bank payments (matched by reference)`, middleware: [...write, upload.single('file')],
  request: { file: '(xlsx) columns: Date, Reference, Amount, Bank Account, Payer, Remarks' },
  response: { success: true, data: { message: 'Processed 4 rows: 2 matched, 1 overpaid, 1 underpaid, 0 not found, 0 failed', batch: { batchNumber: 'RVB-2026-00006', kind: 'bank-payments' } } },
  handler: async (req, res) => {
    const rows = await uploadRows(req);
    const r = await bankPayments.runBankUpload(rows, { fileName: req.file.originalname, user: req.user });
    await audit(req, { entity: 'receipt_batch', entityId: r.batch.id, action: 'bank-payments', after: { file: req.file.originalname, batchNumber: r.batch.batch_number, ...r.counts } });
    const c = r.counts;
    const data = uploadResult(rows.length, rows.length - c.failed, r.errors.map((e) => ({ row: e.row, message: e.issues ? issueText(e.issues, bankPayments.BANK_PAYMENT_COLUMNS) : columnMessage(e.message, bankPayments.BANK_PAYMENT_COLUMNS) })),
      { ids: r.ids, batch: batches.batchOut(r.batch), counts: c });
    data.message = `Processed ${rows.length} rows: ${c.matched} matched, ${c.overpaid} overpaid, ${c.underpaid} underpaid, ${c.unmatched} not found, ${c.failed} failed`;
    ok(res, data, data.message);
  },
});
define({
  method: 'GET', path: '/insurer-direct/template', summary: 'Payments made directly to the insurer: upload template (XLSX)', screen: `${SCREEN} > Bulk Upload > Payments made to the insurer > Download template`, middleware: read,
  response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'insurer-direct-payments'),
});
define({
  method: 'POST', path: '/insurer-direct', summary: 'Payments the clients made directly to the insurance company (multipart "file"): each settles the policy\'s bills with a receipt of channel insurer-direct (Dr premium payable / Cr premium receivable)',
  screen: `${SCREEN} > Bulk Upload > Payments made to the insurer`, middleware: [...write, upload.single('file')],
  request: { file: '(xlsx) columns: Policy Number, Amount, Date Paid, Insurer Reference, Remarks' },
  response: { success: true, data: { message: 'Processed 2 rows: 2 created, 0 failed', batch: { batchNumber: 'RVB-2026-00007', kind: 'insurer-direct' } } },
  handler: async (req, res) => {
    const rows = await uploadRows(req);
    const r = await bankPayments.runInsurerDirectUpload(rows, { fileName: req.file.originalname, user: req.user });
    await audit(req, { entity: 'receipt_batch', entityId: r.batch.id, action: 'insurer-direct', after: { file: req.file.originalname, batchNumber: r.batch.batch_number, created: r.ids.length, failed: r.errors.length } });
    const data = uploadResult(rows.length, r.ids.length, r.errors.map((e) => ({ row: e.row, message: e.issues ? issueText(e.issues, bankPayments.INSURER_DIRECT_COLUMNS) : columnMessage(e.message, bankPayments.INSURER_DIRECT_COLUMNS) })),
      { ids: r.ids, batch: batches.batchOut(r.batch) });
    ok(res, data, data.message);
  },
});
const uacExample = { id: 'uac_1', kind: 'excess', kindText: 'Excess payment', status: 'open', amount: 1500, balance: 1500, receiptNumber: 'OR-2026-00120', clientName: 'Andrea Villanueva',
  policyNumber: 'POL-2026-90004', receivedDate: '2026-10-05', allocateBy: '2026-10-07', overdue: false };
define({
  method: 'GET', path: '/unapplied', summary: 'Unapplied collections (excess On Account, floating, advance): open first by the date they are to be allocated; filter status, kind, overdue, search',
  screen: 'Accounts > Unapplied Collections', middleware: read, query: { status: 'open', overdue: 'true' },
  response: { success: true, data: { rows: [uacExample], summary: { open: 1, openAmount: 1500, overdue: 0 } } },
  handler: async (req, res) => ok(res, await unapplied.listUnapplied(pool, req.query)),
});
define({
  method: 'GET', path: '/unapplied/:id', summary: 'One unapplied collection with its allocations', screen: 'Accounts > Unapplied Collections > View', middleware: read,
  response: { success: true, data: { ...uacExample, allocations: [] } },
  handler: async (req, res) => ok(res, await unapplied.getUnapplied(pool, req.params.id)),
});
define({
  method: 'POST', path: '/unapplied', summary: 'Record a floating payment (no client or bill identified yet) or an advance payment (a client paying before the bill); posted Dr cash / Cr unapplied collections',
  screen: 'Accounts > Unapplied Collections > Record payment', middleware: [...write, validate(z.object({ kind: z.enum(['floating', 'advance']), amount: z.coerce.number().positive(),
    receivedDate: z.string().optional(), paymentMode: z.string().optional(), referenceNo: z.string().max(80).optional().nullable(), bankAccount: z.string().max(40).optional().nullable(),
    customerCode: z.string().max(40).optional().nullable(), payerName: z.string().max(120).optional().nullable(), remarks: z.string().max(500).optional().nullable() }))],
  request: { kind: 'floating', amount: 12500, receivedDate: '2026-10-05', referenceNo: 'MBT-0099812', payerName: 'Unknown depositor' }, response: { success: true, data: { ...uacExample, kind: 'floating' } },
  handler: async (req, res) => {
    const u = await withTransaction((db) => unapplied.recordUnapplied(db, req.body, req.user));
    await audit(req, { entity: 'unapplied_collection', entityId: u.id, action: 'create', after: u });
    created(res, u, `${u.kindText} recorded`);
  },
});
define({
  method: 'POST', path: '/unapplied/:id/allocate', summary: 'Allocate an unapplied collection to open bills (the bill settled as by a receipt; Dr unapplied collections / Cr premium receivable)',
  screen: 'Accounts > Unapplied Collections > Allocate', middleware: [...write, validate(z.object({ allocations: z.array(z.object({ receivableId: z.string().min(1), amount: z.coerce.number().positive() })).min(1).max(50) }))],
  request: { allocations: [{ receivableId: 'INV-2026-00104', amount: 1500 }] }, response: { success: true, data: { ...uacExample, status: 'allocated', balance: 0 }, message: 'PHP 1,500.00 allocated' },
  handler: async (req, res) => {
    const r = await withTransaction((db) => unapplied.allocateUnapplied(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'unapplied_collection', entityId: r.item.id, action: 'allocate', after: { allocations: req.body.allocations, balance: r.item.balance } });
    ok(res, r.item, r.message);
  },
});
define({
  method: 'POST', path: '/unapplied/:id/refund', summary: 'Refund what is left of an unapplied collection to the client with a reason (context unapplied_refund): Dr unapplied collections / Cr client refund payable',
  screen: 'Accounts > Unapplied Collections > Refund', middleware: [...write, validate(z.object({ reasonCode: z.string().min(1), note: z.string().max(1000).optional() }))],
  request: { reasonCode: 'UAC-REF-OVERPAID' }, response: { success: true, data: { ...uacExample, status: 'refunded', balance: 0 } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => unapplied.refundUnapplied(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'unapplied_collection', entityId: r.item.id, action: 'refund', after: { amount: r.item.amount, reason: r.item.refundReason } });
    ok(res, r.item, r.message);
  },
});
define({
  method: 'POST', path: '/unapplied/:id/reverse', summary: 'Reverse a floating or advance payment recorded in error, nothing allocated (reason of context receipt_reversal)',
  screen: 'Accounts > Unapplied Collections > Reverse', middleware: [requireAuth, requirePermission('reverse:receipts'), validate(z.object({ reasonCode: z.string().min(1), note: z.string().max(1000).optional() }))],
  request: { reasonCode: 'RCT-REV-DUPLICATE' }, response: { success: true, data: { ...uacExample, status: 'reversed', balance: 0 } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => unapplied.reverseUnapplied(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'unapplied_collection', entityId: r.item.id, action: 'reverse', after: { reason: r.item.refundReason } });
    ok(res, r.item, r.message);
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
  method: 'POST', path: '/:id/reversal', summary: 'Reverse a receipt with a reason (context receipt_reversal): sent to a checker when receipts.reversal_requires_approval, else cancelled at once (payment journals reversed, bills re-opened)',
  screen: `${SCREEN} > View > Reverse receipt`,
  middleware: [requireAuth, requirePermission('reverse:receipts'), ownRecord('receipt'), validate(z.object({ reasonCode: z.string().min(1), note: z.string().max(1000).optional() }))],
  request: { reasonCode: 'RCT-REV-DAIF' }, response: { success: true, data: { ...example, reversal: { status: 'pending', reasonCode: 'RCT-REV-DAIF', reason: 'Cheque returned DAIF' } }, message: 'Reversal of receipt OR-2026-00012 sent for approval' },
  handler: async (req, res) => {
    const r = await withTransaction((db) => reversal.requestReversal(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'receipt', entityId: r.after.receiptId, action: r.action, before: r.before, after: r.after });
    ok(res, r.after, r.message);
  },
});
define({
  method: 'POST', path: '/:id/reversal/decision', summary: 'Approve or return a receipt reversal requested by another user (maker-checker); a return needs a reason (context receipt_reversal_reject)',
  screen: `${SCREEN} > View > Reversal; My Work > Approvals`,
  middleware: [requireAuth, requirePermission(reversal.APPROVE), ownRecord('receipt'),
    validate(z.object({ action: z.enum(['approve', 'return']), reasonCode: z.string().optional(), note: z.string().max(1000).optional() }))],
  request: { action: 'approve' }, response: { success: true, data: { ...example, receiptStatus: 'Cancelled' }, message: 'Receipt OR-2026-00012 reversed' },
  handler: async (req, res) => {
    const r = await withTransaction((db) => reversal.decideReversal(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'receipt', entityId: r.after.receiptId, action: r.action, before: r.before, after: r.after });
    ok(res, r.after, r.message);
  },
});

define({
  method: 'POST', path: '/:id/proof', summary: 'Attach the proof of payment of a receipt (deposit slip, transfer confirmation, cheque copy: an uploaded file key and its name); a remittance run on the fully paid basis needs it',
  screen: `${SCREEN} > View > Proof of payment`, middleware: [...write, ownRecord('receipt'), validate(z.object({ proofKey: z.string().min(1).max(500), proofFileName: z.string().max(255).optional().nullable() }))],
  request: { proofKey: '/api/s3/object/receipts/deposit-slip-0091.pdf', proofFileName: 'deposit-slip-0091.pdf' }, response: { success: true, data: { ...example, proof: { fileName: 'deposit-slip-0091.pdf' } } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.attachProof(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'receipt', entityId: r.after.receiptId, action: 'attach-proof', before: { proof: r.before.proof?.fileName || null }, after: { proof: r.after.proof?.fileName || null } });
    ok(res, r.after, 'Proof of payment attached');
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
