/**
 * BIR forms, invoicing and tax (/bir): withholding and percentage tax returns with their filing records (0619-E,
 * 1601-EQ, 1604-E, 2551Q), DAT files of the alphalists, sales invoices under the EOPT Act with payment
 * acknowledgements, the EIS e-invoicing outbox and the CAS registration pack (loose-leaf books, system description,
 * backup procedure, audit trail extract).
 * Permissions: read:period-end to view and download; write:period-end to record filings, issue and cancel invoices,
 * record payments, print books, operate the EIS outbox, keep the CAS registration values and edit and submit the CAS
 * documents (Accounting); approve:period-end to approve or reject a CAS document version (another user than its maker).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { printFormat, sendPdf } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { renderReportPdf } from '../../lib/pdf/index.js';
import * as ret from './returns.js';
import * as dat from './dat.js';
import * as inv from './invoices.js';
import * as eis from './eis.js';
import * as cas from './cas.js';
import * as casDocs from './casDocuments.js';
import { returnPdf, returnXlsx } from './output.js';
import { requiredReason } from '../ops-masters/records.js';

const { router, define } = moduleRouter('BIR Forms and Invoicing', '/bir');
const read = [requireAuth, requirePermission('read:period-end')];
const write = [requireAuth, requirePermission('write:period-end')];
const approve = [requireAuth, requirePermission('approve:period-end')];
const tx = (fn) => withTransaction(fn);
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const sendFile = (res, buf, name, type) => {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${String(name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
  res.send(buf);
};

// a real calendar date (2026-02-31 is refused)
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'date is not a calendar date');
const periodQ = z.object({ year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12).optional(), quarter: z.coerce.number().int().min(1).max(4).optional() });
const formParam = z.object({ form: z.enum(ret.FORM_CODES) });
const returnExample = { form: '1601-EQ', title: 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)', period: { key: '2026-Q3', from: '2026-07-01', to: '2026-09-30' },
  header: [['TIN', '123-456-789-00000']], items: [{ no: '19', label: 'Total taxes withheld for the quarter', amount: 1335.6 }], schedules: [], reconciliation: { reconciled: true, checks: [] }, taxDue: 445.2, filing: null };

// ---------------------------------------------------------------- returns and filing records

define({
  method: 'GET', path: '/returns/calendar', summary: 'BIR returns of a year (0619-E, 1601-EQ, 1604-E, 2551Q for a non-VAT broker) with due date and filing status', screen: 'Accounts > Tax > Withholding Returns',
  middleware: [...read, validate(periodQ.pick({ year: true }), 'query')], query: { year: 2026 },
  response: { success: true, data: [{ form: '0619-E', periodKey: '2026-07', dueDate: '2026-08-10', status: 'filed', amountPaid: 445.2 }] },
  handler: async (req, res) => ok(res, await ret.returnCalendar(pool, req.query.year)),
});
define({
  method: 'GET', path: '/returns/:form', summary: 'A BIR return computed from the books, laid out as the form (items, schedules per ATC, alphalist, reconciliation with the QAP and the ledger, filing record)',
  screen: 'Accounts > Tax > Withholding Returns', middleware: [...read, validate(formParam, 'params'), validate(periodQ, 'query')], query: { year: 2026, quarter: 3 },
  response: { success: true, data: returnExample },
  handler: async (req, res) => ok(res, await ret.computeReturn(pool, req.params.form, req.query)),
});
define({
  method: 'GET', path: '/returns/:form/pdf', summary: 'Print of a BIR return (PDF on the letterhead, BIR item order)', screen: 'Accounts > Tax > Withholding Returns > Print',
  middleware: [...read, validate(formParam, 'params'), validate(periodQ, 'query')], query: { year: 2026, quarter: 3 },
  handler: async (req, res) => {
    const r = await ret.computeReturn(pool, req.params.form, req.query);
    sendPdf(res, await returnPdf(r), `BIR-${r.form}-${r.period.key}.pdf`);
  },
});
define({
  method: 'GET', path: '/returns/:form/xlsx', summary: 'Excel of a BIR return: the form, each schedule on a sheet, the reconciliation', screen: 'Accounts > Tax > Withholding Returns > Excel',
  middleware: [...read, validate(formParam, 'params'), validate(periodQ, 'query')], query: { year: 2026, quarter: 3 },
  handler: async (req, res) => {
    const r = await ret.computeReturn(pool, req.params.form, req.query);
    sendFile(res, returnXlsx(r, await printFormat()), `BIR-${r.form}-${r.period.key}.xlsx`, XLSX);
  },
});
const filingSchema = periodQ.extend({
  dateFiled: dateField, filingReference: z.string().max(100).optional(), amountPaid: z.coerce.number().min(0), penalties: z.coerce.number().min(0).optional(),
  paymentDate: dateField.optional(), paymentReference: z.string().max(100).optional(), paymentChannel: z.string().max(60).optional(), amended: z.boolean().optional(), remarks: z.string().max(500).optional(),
});
define({
  method: 'POST', path: '/returns/:form/filings', summary: 'Record the filing of a return: date filed, eFPS / eBIRForms reference, amount paid, payment reference; keeps the figures as filed. amended: true supersedes the active filing',
  screen: 'Accounts > Tax > Withholding Returns > Record filing', middleware: [...write, validate(formParam, 'params'), validate(filingSchema)],
  request: { year: 2026, quarter: 3, dateFiled: '2026-10-28', filingReference: 'EFPS-1601EQ-0001', amountPaid: 445.2, paymentReference: 'LBP-778899', paymentChannel: 'eFPS' },
  response: { success: true, data: { id: 'brf_1a2b', form: '1601-EQ', periodKey: '2026-Q3', status: 'filed' } },
  handler: async (req, res) => {
    const f = await tx((db) => ret.recordFiling(db, req.params.form, req.body, req.user));
    await audit(req, { entity: 'bir_return_filing', entityId: f.id, action: f.amended ? 'amend' : 'create', after: f });
    created(res, f);
  },
});
define({
  method: 'GET', path: '/filings', summary: 'Filing records of BIR returns (filter year, form)', screen: 'Accounts > Tax > Withholding Returns', middleware: read, query: { year: 2026, form: '0619-E' },
  response: { success: true, data: [{ id: 'brf_1a2b', form: '0619-E', periodKey: '2026-07', dateFiled: '2026-08-10', amountPaid: 445.2, status: 'filed' }] },
  handler: async (req, res) => ok(res, await ret.listFilings(pool, req.query)),
});
define({
  method: 'PUT', path: '/filings/:id', summary: 'Correct the references of a filing record (date filed, references, amount paid, penalties)', screen: 'Accounts > Tax > Withholding Returns > Filing record',
  middleware: [...write, validate(filingSchema.omit({ year: true, month: true, quarter: true, amended: true }).partial())], request: { paymentReference: 'LBP-778900' },
  handler: async (req, res) => {
    const r = await ret.updateFiling(pool, req.params.id, req.body, req.user);
    await audit(req, { entity: 'bir_return_filing', entityId: req.params.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after);
  },
});
define({
  method: 'POST', path: '/filings/:id/cancel', summary: 'Cancel a filing record entered in error (with a reason)', screen: 'Accounts > Tax > Withholding Returns > Filing record',
  middleware: [...write, validate(z.object({ reason: z.string().min(3).max(300) }))], request: { reason: 'Recorded against the wrong month' },
  handler: async (req, res) => {
    const f = await ret.cancelFiling(pool, req.params.id, req.body.reason, req.user);
    await audit(req, { entity: 'bir_return_filing', entityId: f.id, action: 'cancel', after: { reason: req.body.reason } });
    ok(res, f);
  },
});

// ---------------------------------------------------------------- DAT files

const datQ = z.object({ year: z.coerce.number().int().min(2000).max(2100), quarter: z.coerce.number().int().min(1).max(4).optional(), form: z.string().regex(/^[0-9A-Z]{4,8}$/i).optional(), amended: z.enum(['true', 'false']).optional() });
const datParam = z.object({ type: z.enum(dat.DAT_TYPES) });
const needQuarter = (req) => { if (req.params.type !== '1604e' && !req.query.quarter) throw badRequest('quarter is required'); };
const datExample = { id: 'bdf_1a2b', type: 'qap', form: null, year: 2026, quarter: 3, periodKey: '2026-Q3', fileName: '12345678900000920261601EQ.DAT', records: 4, rows: 2,
  totals: { incomePayment: 35000.5, taxWithheld: 3000.05 }, valid: true, checks: [{ code: 'records', report: 2, file: 2, difference: 0, agrees: true }], errors: [],
  generatedBy: 'u_17', generatedByName: 'Maria Santos', generatedAt: '2026-10-05T02:15:00.000Z' };
define({
  method: 'GET', path: '/dat-files', summary: 'Register of the generated DAT files, newest first (filter year, type); without the file content', screen: 'Accounts > Tax > BIR DAT Files',
  middleware: [...read, validate(z.object({ year: z.coerce.number().int().min(2000).max(2100).optional(), type: z.enum(dat.DAT_TYPES).optional() }), 'query')], query: { year: 2026 },
  response: { success: true, data: [datExample] }, handler: async (req, res) => ok(res, await dat.listDatFiles(pool, req.query)),
});
define({
  method: 'POST', path: '/dat-files/:type/generate', summary: 'Generate a DAT file (QAP, SAWT, SLSP per quarter; 1604-E per year), validate it against its report (detail records, control totals, fields per record) and keep it in the register',
  screen: 'Accounts > Tax > BIR DAT Files > Generate file', middleware: [...write, validate(datParam, 'params'), validate(datQ.omit({ amended: true }).extend({ amended: z.boolean().optional() }))],
  request: { year: 2026, quarter: 3 }, response: { success: true, data: datExample },
  handler: async (req, res) => {
    if (req.params.type !== '1604e' && !req.body.quarter) throw badRequest('quarter is required');
    const f = await dat.generateDat(pool, req.params.type, req.body, req.user);
    await audit(req, { entity: 'bir_dat_file', entityId: f.id, action: 'generate', after: { type: f.type, period: f.periodKey, fileName: f.fileName, records: f.records, totals: f.totals, valid: f.valid } });
    created(res, f);
  },
});
define({
  method: 'GET', path: '/dat-files/generated/:id', summary: 'A generated DAT file with its validation, content and record layout', screen: 'Accounts > Tax > BIR DAT Files',
  middleware: read, response: { success: true, data: { ...datExample, content: 'HQAP,H1601EQ,...', layout: { name: '{TIN}{BRANCH}{MMYYYY}1601EQ.DAT', records: [] } } },
  handler: async (req, res) => ok(res, await dat.getDatFile(pool, req.params.id)),
});
define({
  method: 'GET', path: '/dat-files/generated/:id/download', summary: 'Download a generated DAT file exactly as it was generated', screen: 'Accounts > Tax > BIR DAT Files > Download', middleware: read,
  handler: async (req, res) => {
    const f = await dat.getDatFile(pool, req.params.id);
    await audit(req, { entity: 'bir_dat_file', entityId: f.id, action: 'download', after: { fileName: f.fileName, records: f.records } });
    sendFile(res, Buffer.from(f.content, 'latin1'), f.fileName, 'text/plain; charset=us-ascii');
  },
});
define({
  method: 'GET', path: '/dat-files/layout', summary: 'Record layouts and version of the BIR DAT files the system produces', screen: 'Accounts > Tax > BIR DAT Files', middleware: read,
  response: { success: true, data: { version: dat.DAT_LAYOUT.version } }, handler: async (_req, res) => ok(res, dat.DAT_LAYOUT),
});
define({
  method: 'GET', path: '/dat-files/:type', summary: 'Preview of a DAT file (QAP, SAWT, SLSP sales / purchases per quarter; 1604-E per year): file name, records, totals, warnings and content',
  screen: 'Accounts > Tax > BIR DAT Files', middleware: [...read, validate(datParam, 'params'), validate(datQ, 'query')], query: { year: 2026, quarter: 3 },
  response: { success: true, data: { type: 'qap', fileName: '12345678900000920261601EQ.DAT', records: 4, rows: 2, totals: { taxWithheld: 1335.6 }, warnings: [] } },
  handler: async (req, res) => { needQuarter(req); ok(res, await dat.datFile(pool, req.params.type, req.query)); },
});
define({
  method: 'GET', path: '/dat-files/:type/download', summary: 'Download a DAT file for validation with the BIR module and submission', screen: 'Accounts > Tax > BIR DAT Files > Download',
  middleware: [...read, validate(datParam, 'params'), validate(datQ, 'query')], query: { year: 2026, quarter: 3 },
  handler: async (req, res) => {
    needQuarter(req);
    const f = await dat.datFile(pool, req.params.type, req.query);
    await audit(req, { entity: 'bir_dat_file', entityId: f.fileName, action: 'download', after: { type: f.type, records: f.records, totals: f.totals } });
    sendFile(res, Buffer.from(f.content, 'latin1'), f.fileName, 'text/plain; charset=us-ascii');
  },
});

// ---------------------------------------------------------------- sales invoices (EOPT)

const lineSchema = z.object({ description: z.string().min(2).max(300), quantity: z.coerce.number().positive().optional(), unitPrice: z.coerce.number().min(0).optional(),
  amount: z.coerce.number().positive().optional(), vatClass: z.enum(inv.VAT_CLASSES).optional(), reference: z.string().max(60).optional() });
const invoiceSchema = z.object({
  sourceType: z.enum(inv.SOURCE_TYPES).default('manual'), sourceId: z.string().max(60).optional(), invoiceDate: dateField.optional(), dueDate: dateField.optional(),
  buyer: z.object({ buyerType: z.enum(['insurer', 'client', 'other']).optional(), buyerId: z.string().max(60).optional(), buyerName: z.string().min(2).max(200).optional(),
    buyerTin: z.string().max(20).optional(), buyerBranchCode: z.string().max(5).optional(), buyerAddress: z.string().max(300).optional(), buyerBusinessStyle: z.string().max(200).optional() }).optional(),
  lines: z.array(lineSchema).max(50).optional(), incomeAccount: z.string().max(20).optional(), ewtRate: z.coerce.number().min(0).max(50).optional(),
  paymentTerms: z.string().max(100).optional(), remarks: z.string().max(500).optional(), reference: z.string().max(60).optional(),
});
const reasonBody = z.object({ reasonCode: z.string().trim().min(1).max(60), note: z.string().trim().max(1000).optional() });
const invoiceExample = { id: 'sin_1a2b', invoiceNumber: 'SI-0000000001', invoiceDate: '2026-10-04', buyerName: 'Malayan Insurance Co., Inc.', vatableSales: 10000, vatAmount: 1200, totalAmount: 11200, status: 'issued' };
define({
  method: 'GET', path: '/invoices', summary: 'Sales invoices (filter from, to, status, sourceType, search)', screen: 'Accounts > Tax > Sales Invoices', middleware: read, query: { from: '2026-10-01', to: '2026-10-31' },
  response: { success: true, data: [invoiceExample] }, handler: async (req, res) => ok(res, await inv.listInvoices(pool, req.query)),
});
define({
  method: 'GET', path: '/invoices/seller', summary: 'Seller details printed on the invoices (Company master and invoice.* settings: TIN with branch, ATP / CAS permit, serial range) and whether invoicing is set up (setup.state ready or incomplete, setup.missing: tin, address, permit, permitDate, serialRange)',
  screen: 'Accounts > Tax > Sales Invoices', middleware: read,
  response: { success: true, data: { registeredName: 'Toyota Insurance Services Philippines Corporation', tinFormatted: '685-442-861-00000', vatRegistered: true, serialFrom: 1, serialTo: 9999999999,
    setup: { state: 'incomplete', missing: ['permit'] } } },
  handler: async (_req, res) => {
    const seller = await inv.sellerSnapshot();
    ok(res, { ...seller, setup: inv.invoicingSetup(seller) });
  },
});
define({
  method: 'GET', path: '/invoices/candidates', summary: 'Approved commission debit notes or overriding commission computations not yet invoiced', screen: 'Accounts > Tax > Sales Invoices > New',
  middleware: [...read, validate(z.object({ type: z.enum(['debit_note', 'override_commission']) }), 'query')], query: { type: 'debit_note' },
  handler: async (req, res) => ok(res, await inv.invoiceCandidates(pool, req.query.type)),
});
define({
  method: 'GET', path: '/invoices/:id', summary: 'A sales invoice with its lines and payments', screen: 'Accounts > Tax > Sales Invoices', middleware: read,
  response: { success: true, data: invoiceExample }, handler: async (req, res) => ok(res, await inv.getInvoice(pool, req.params.id)),
});
define({
  method: 'POST', path: '/invoices', summary: 'Issue a sales invoice: for a commission debit note, an overriding commission computation, a broker-billed policy\'s commission, or a manual service invoice (posts sales_invoice.issue)',
  screen: 'Accounts > Tax > Sales Invoices > New', middleware: [...write, validate(invoiceSchema)], request: { sourceType: 'debit_note', sourceId: 'DN-2026-00001' },
  response: { success: true, data: invoiceExample },
  handler: async (req, res) => {
    const i = await tx((db) => inv.issueInvoice(db, req.body, req.user));
    await audit(req, { entity: 'sales_invoice', entityId: i.invoiceNumber, action: 'issue', after: { invoiceNumber: i.invoiceNumber, buyer: i.buyerName, totalAmount: i.totalAmount, source: i.sourceReference } });
    created(res, i);
  },
});
define({
  method: 'POST', path: '/invoices/:id/cancel', summary: 'Cancel a sales invoice with a reason of the Reason Codes master (context sales_invoice_cancel) and a note when the reason needs one; kept with its number, a manual invoice\'s journal is reversed, the EIS is told',
  screen: 'Accounts > Tax > Sales Invoices > Cancel invoice', middleware: [...write, validate(reasonBody)], request: { reasonCode: 'SIC-WRONGBUYER' },
  handler: async (req, res) => {
    const i = await tx(async (db) => {
      const reason = await requiredReason(db, 'sales_invoice_cancel', req.body);
      return inv.cancelInvoice(db, req.params.id, reason.text, req.user, { reasonCode: reason.code });
    });
    await audit(req, { entity: 'sales_invoice', entityId: i.invoiceNumber, action: 'cancel', after: { reasonCode: i.cancelReasonCode, reason: i.cancelReason } });
    ok(res, i);
  },
});
define({
  method: 'GET', path: '/invoices/:id/pdf', summary: 'Print of a sales invoice (every field RR 7-2024 lists)', screen: 'Accounts > Tax > Sales Invoices > Print', middleware: read,
  handler: async (req, res) => {
    const i = await inv.getInvoice(pool, req.params.id);
    await pool.query('UPDATE sales_invoices SET print_count = print_count + 1, last_printed_at = now() WHERE id = $1', [i.id]);
    sendPdf(res, await inv.invoicePdf(i), `${i.invoiceNumber}.pdf`);
  },
});
define({
  method: 'POST', path: '/invoices/:id/payments', summary: 'Record a payment on a manual sales invoice: payment acknowledgement (supplementary document) and journal sales_invoice.payment', screen: 'Accounts > Tax > Sales Invoices > Payment',
  middleware: [...write, validate(z.object({ paymentDate: dateField.optional(), amount: z.coerce.number().min(0), ewtAmount: z.coerce.number().min(0).optional(), form2307No: z.string().max(40).optional(),
    paymentMode: z.string().max(30).optional(), bankAccount: z.string().max(40).optional(), referenceNo: z.string().max(60).optional() }))],
  request: { amount: 10200, ewtAmount: 1000, paymentMode: 'bank-transfer', referenceNo: 'BDO-123' },
  handler: async (req, res) => {
    const p = await tx((db) => inv.recordPayment(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'sales_invoice_payment', entityId: p.ackNumber, action: 'create', after: p });
    created(res, p);
  },
});
define({
  method: 'POST', path: '/invoices/payments/:paymentId/cancel', summary: 'Cancel a payment acknowledgement with a reason of the Reason Codes master (context invoice_payment_cancel); journal reversed, invoice balance restored',
  screen: 'Accounts > Tax > Sales Invoices > Cancel payment', middleware: [...write, validate(reasonBody)], request: { reasonCode: 'IPC-RETURNED' },
  handler: async (req, res) => {
    const p = await tx(async (db) => {
      const reason = await requiredReason(db, 'invoice_payment_cancel', req.body);
      return inv.cancelPayment(db, req.params.paymentId, reason.text, req.user, { reasonCode: reason.code });
    });
    await audit(req, { entity: 'sales_invoice_payment', entityId: p.ackNumber, action: 'cancel', after: { reasonCode: p.cancelReasonCode, reason: p.cancelReason } });
    ok(res, p);
  },
});
define({
  method: 'GET', path: '/invoices/payments/:paymentId/pdf', summary: 'Print of a payment acknowledgement (supplementary document)', screen: 'Accounts > Tax > Sales Invoices > Payment', middleware: read,
  handler: async (req, res) => {
    const p = (await pool.query('SELECT invoice_id FROM sales_invoice_payments WHERE id = $1', [req.params.paymentId])).rows[0];
    if (!p) throw badRequest('Payment not found');
    const i = await inv.getInvoice(pool, p.invoice_id);
    const pay = i.payments.find((x) => x.id === req.params.paymentId);
    sendPdf(res, await inv.paymentPdf(i, pay), `${pay.ackNumber}.pdf`);
  },
});

// ---------------------------------------------------------------- EIS outbox

define({
  method: 'GET', path: '/eis/status', summary: 'EIS connection status: switched on, mode, endpoint, whether the credential variables are set (never their values), outbox counts, last sent, setup (state off, incomplete or ready; missing: accreditationId, endpoint, credentials, signingKey)',
  screen: 'Accounts > Tax > E-Invoicing (EIS)', middleware: read,
  response: { success: true, data: { enabled: false, mode: 'test', counts: { accepted: 3, failed: 1 }, lastSentAt: '2026-10-04T03:00:00.000Z', setup: { state: 'off', missing: ['accreditationId'] } } },
  handler: async (_req, res) => ok(res, await eis.eisStatus(pool)),
});
define({
  method: 'GET', path: '/eis/submissions', summary: 'EIS outbox (filter status, search)', screen: 'Accounts > Tax > E-Invoicing (EIS)', middleware: read, query: { status: 'failed' },
  handler: async (req, res) => ok(res, await eis.listSubmissions(pool, req.query)),
});
define({
  method: 'GET', path: '/eis/submissions/:id', summary: 'One EIS submission with its payload and the response', screen: 'Accounts > Tax > E-Invoicing (EIS)', middleware: read,
  handler: async (req, res) => ok(res, await eis.getSubmission(pool, req.params.id)),
});
define({
  method: 'POST', path: '/eis/process', summary: 'Send the queued and due e-invoices now (what the eis-outbox job does)', screen: 'Accounts > Tax > E-Invoicing (EIS)', middleware: write,
  handler: async (req, res) => {
    const r = await eis.processOutbox();
    await audit(req, { entity: 'eis_outbox', entityId: 'process', action: 'run', after: r });
    ok(res, r);
  },
});
define({
  method: 'POST', path: '/eis/queue-backlog', summary: 'Queue the issued invoices of a date range that are not in the outbox yet', screen: 'Accounts > Tax > E-Invoicing (EIS)',
  middleware: [...write, validate(z.object({ from: dateField, to: dateField }))], request: { from: '2026-10-01', to: '2026-10-31' },
  handler: async (req, res) => {
    const r = await eis.queueBacklog(pool, req.body, req.user);
    await audit(req, { entity: 'eis_outbox', entityId: 'backlog', action: 'create', after: { ...req.body, ...r } });
    ok(res, r);
  },
});
define({
  method: 'POST', path: '/eis/submissions/:id/retry', summary: 'Put a failed or rejected submission back in the queue', screen: 'Accounts > Tax > E-Invoicing (EIS)', middleware: write,
  handler: async (req, res) => {
    const r = await eis.retrySubmission(pool, req.params.id);
    await audit(req, { entity: 'eis_submission', entityId: r.id, action: 'retry', after: { invoiceNumber: r.invoiceNumber } });
    ok(res, r);
  },
});
define({
  method: 'POST', path: '/eis/submissions/:id/manual', summary: 'Manual fallback: record the EIS reference of a payload uploaded outside the system', screen: 'Accounts > Tax > E-Invoicing (EIS)',
  middleware: [...write, validate(z.object({ reference: z.string().min(3).max(100) }))], request: { reference: 'EIS-ACK-000123' },
  handler: async (req, res) => {
    const r = await eis.markManual(pool, req.params.id, req.body.reference);
    await audit(req, { entity: 'eis_submission', entityId: r.id, action: 'update', after: { status: 'manual', reference: req.body.reference } });
    ok(res, r);
  },
});
define({
  method: 'GET', path: '/eis/export', summary: 'Manual fallback: the queued and failed e-invoice payloads as one JSON file', screen: 'Accounts > Tax > E-Invoicing (EIS)', middleware: read,
  handler: async (req, res) => {
    const r = await eis.exportPayloads(pool, { ids: req.query.ids ? String(req.query.ids).split(',') : null });
    sendFile(res, Buffer.from(JSON.stringify(r, null, 2)), `eis-payloads-${r.generatedAt.slice(0, 10)}.json`, 'application/json');
  },
});

// ---------------------------------------------------------------- CAS registration pack

const bookParam = z.object({ book: z.enum(cas.BOOK_CODES) });
const periodYm = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be YYYY-MM') });
define({
  method: 'GET', path: '/cas/checklist', summary: 'Readiness of the CAS registration pack: one row per item (code, business name, complete / missing, value, action: company, permit, atp, custodian, contact, document, books)',
  screen: 'Accounts > Tax > CAS Books and Documents', middleware: read,
  response: { success: true, data: { books: [{ code: 'general_journal', title: 'General Journal' }], checklist: [{ code: 'permit', item: 'CAS permit or acknowledgement number and date', done: false, status: 'missing', value: null, action: 'permit' }] } },
  handler: async (_req, res) => ok(res, { books: Object.entries(cas.BOOKS).map(([code, b]) => ({ code, title: b.title })), checklist: await cas.casChecklist(pool) }),
});
const registrationSchema = z.object({
  permitNumber: z.string().trim().max(100).optional(), permitDate: dateField.or(z.literal('')).optional(), atpNumber: z.string().trim().max(100).optional(), atpDateIssued: dateField.or(z.literal('')).optional(),
  custodianUserId: z.string().max(60).optional(), custodianPosition: z.string().trim().max(120).optional(), contactUserId: z.string().max(60).optional(), contactPosition: z.string().trim().max(120).optional(),
}).strict();
define({
  method: 'GET', path: '/cas/registration', summary: 'CAS registration values kept on the CAS screen (permit number and date, invoice ATP and date, backup custodian, system contact) and the active users to name',
  screen: 'Accounts > Tax > CAS Books and Documents', middleware: read,
  response: { success: true, data: { permitNumber: 'CAS-2026-0001', permitDate: '2026-02-01', atpNumber: '', atpDateIssued: '', custodianUserId: 'usr_1', custodian: 'Ana Reyes, IT Officer', contactUserId: '', contact: '', casPermitNumber: '', people: [{ userId: 'usr_1', name: 'Ana Reyes', email: 'ana@example.ph', position: 'IT Officer' }] } },
  handler: async (_req, res) => ok(res, await cas.registration(pool)),
});
define({
  method: 'PUT', path: '/cas/registration', summary: 'Save CAS registration values (only the fields sent; a custodian or contact is an active user, printed with the position given)',
  screen: 'Accounts > Tax > CAS Books and Documents > Readiness', middleware: [...write, validate(registrationSchema)],
  request: { permitNumber: 'CAS-2026-0001', permitDate: '2026-02-01' },
  handler: async (req, res) => {
    const r = await cas.saveRegistration(pool, req.body, req.user);
    await audit(req, { entity: 'settings', entityId: 'cas', action: 'update', before: r.before, after: r.after });
    ok(res, await cas.registration(pool), 'Saved');
  },
});
define({
  method: 'GET', path: '/cas/books/:book/preview', summary: 'Entries of a book of accounts for a month (on screen)', screen: 'Accounts > Tax > CAS Books and Documents',
  middleware: [...read, validate(bookParam, 'params'), validate(periodYm, 'query')], query: { period: '2026-09' },
  handler: async (req, res) => ok(res, await cas.previewBook(pool, req.params.book, req.query.period)),
});
define({
  method: 'GET', path: '/cas/books/:book/xlsx', summary: 'Excel of a book of accounts for a month', screen: 'Accounts > Tax > CAS Books and Documents',
  middleware: [...read, validate(bookParam, 'params'), validate(periodYm, 'query')], query: { period: '2026-09' },
  handler: async (req, res) => sendFile(res, await cas.bookXlsx(pool, req.params.book, req.query.period), `${req.params.book}-${req.query.period}.xlsx`, XLSX),
});
define({
  method: 'POST', path: '/cas/books/:book/print', summary: 'Print a loose-leaf book for a month (PDF): the next page numbers of the book\'s year, recorded', screen: 'Accounts > Tax > CAS Books and Documents > Print',
  middleware: [...write, validate(bookParam, 'params'), validate(periodYm)], request: { period: '2026-09' },
  handler: async (req, res) => {
    const r = await cas.printBook(pool, req.params.book, req.body.period, req.user);
    await audit(req, { entity: 'cas_book_print', entityId: r.print.id, action: 'print', after: { book: r.print.book, period: r.print.period, firstPage: r.print.firstPage, lastPage: r.print.lastPage } });
    res.setHeader('X-Book-Pages', `${r.print.firstPage}-${r.print.lastPage}`);
    sendPdf(res, r.pdf, `${req.params.book}-${req.body.period}.pdf`);
  },
});
define({
  method: 'GET', path: '/cas/prints', summary: 'Register of loose-leaf book prints (filter year, book)', screen: 'Accounts > Tax > CAS Books and Documents', middleware: read, query: { year: 2026 },
  handler: async (req, res) => ok(res, await cas.listPrints(pool, req.query)),
});
define({
  method: 'GET', path: '/cas/prints/:id/pdf', summary: 'Reprint a book print with its original page numbers (marked REPRINT)', screen: 'Accounts > Tax > CAS Books and Documents', middleware: write,
  handler: async (req, res) => {
    const r = await cas.reprintBook(pool, req.params.id, req.user);
    await audit(req, { entity: 'cas_book_print', entityId: r.print.id, action: 'print', after: { reprint: true } });
    sendPdf(res, r.pdf, `${r.print.book}-${r.print.period}-reprint.pdf`);
  },
});
define({
  method: 'POST', path: '/cas/prints/:id/void', summary: 'Void the latest print of a book with a reason of the Reason Codes master (context cas_print_void; the note when the reason asks for one); its pages are used again',
  screen: 'Accounts > Tax > CAS Books and Documents', middleware: [...write, validate(z.object({ reasonCode: z.string().trim().min(1).max(60), note: z.string().trim().max(1000).optional() }))],
  request: { reasonCode: 'CPV-DAMAGED', note: 'Printer jam: pages 14 to 16 torn' },
  handler: async (req, res) => {
    const r = await cas.voidPrint(pool, req.params.id, req.body, req.user);
    await audit(req, { entity: 'cas_book_print', entityId: r.id, action: 'void', before: { status: 'printed' }, after: { status: r.status, reasonCode: r.voidReasonCode, reason: r.voidReason } });
    ok(res, r);
  },
});
const docParam = z.object({ type: z.enum(casDocs.DOCUMENT_SLUGS) });
const sectionsSchema = z.object({ sections: z.array(z.object({ key: z.string().max(40).optional(), heading: z.string().max(200), text: z.string().max(20000) })).min(1).max(40) });
const docExample = { type: 'system_description', slug: 'system-description', title: 'System Description and Controls',
  approved: { id: 'casd_1', version: 1, status: 'approved', statusLabel: 'Approved', changeNote: 'First approved version', approvedByName: 'Maria Santos', approvedAt: '2026-10-01T02:00:00Z' },
  open: { id: 'casd_2', version: 2, status: 'draft', statusLabel: 'Draft', sections: [{ key: 's1', heading: 'Purpose and scope', text: '{{software}} is the accounting system of {{taxpayerName}}.' }] } };
const docLink = (type) => `/accounts/tax/cas?document=${type}`;
/** Audit entry and approval notifications of a document action. */
async function docAction(req, action, r, remarks = null) {
  await audit(req, { entity: 'cas_document', entityId: r.after.id, action, before: casDocs.auditSnapshot(r.before), after: casDocs.auditSnapshot(r.after, remarks) });
  const d = casDocs.DOCUMENTS[r.after.doc_type];
  const base = { document: d.title, number: `version ${r.after.version}`, link: docLink(d.slug), entity: 'cas_document', entityId: r.after.id };
  if (action === 'submit') await notifyApprovers({ ...base, audience: 'approve:period-end', by: req.user.username });
  if (action === 'approve' || action === 'reject') {
    await notifyDecision({ ...base, userId: r.before.submitted_by, decidedBy: req.user.id, approved: action === 'approve', by: req.user.username, reason: action === 'reject' ? remarks : null });
  }
}
define({
  method: 'GET', path: '/cas/documents', summary: 'The CAS documents (system description and controls, backup and restore procedure): approved version and version in progress',
  screen: 'Accounts > Tax > CAS Books and Documents', middleware: read, response: { success: true, data: [docExample] },
  handler: async (_req, res) => ok(res, await casDocs.listDocuments(pool)),
});
define({
  method: 'GET', path: '/cas/documents/:type', summary: 'PDF of a CAS document: the approved version, or ?version=n (draft, submitted or nothing approved: DRAFT mark; superseded: SUPERSEDED mark)',
  screen: 'Accounts > Tax > CAS Books and Documents', middleware: [...read, validate(docParam, 'params'), validate(z.object({ version: z.coerce.number().int().min(1).optional() }), 'query')], query: { version: 2 },
  handler: async (req, res) => {
    const r = await casDocs.documentPdf(pool, req.params.type, { version: req.query.version, user: req.user });
    sendPdf(res, r.pdf, r.fileName);
  },
});
define({
  method: 'GET', path: '/cas/documents/:type/versions', summary: 'A CAS document: every version (who and when prepared, submitted, approved; change note), the open and the approved version with their sections, the standard text while none is approved, the live fields with their values and the activity log',
  screen: 'Accounts > Tax > CAS Books and Documents > Document', middleware: [...read, validate(docParam, 'params')], response: { success: true, data: docExample },
  handler: async (req, res) => ok(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user })),
});
define({
  method: 'GET', path: '/cas/documents/:type/versions/:version', summary: 'One version of a CAS document with its sections', screen: 'Accounts > Tax > CAS Books and Documents > Document > Versions',
  middleware: [...read, validate(docParam.extend({ version: z.coerce.number().int().min(1) }), 'params')],
  handler: async (req, res) => ok(res, await casDocs.getVersion(pool, req.params.type, req.params.version)),
});
define({
  method: 'GET', path: '/cas/documents/:type/compare', summary: 'Comparison of two versions of a CAS document: sections added, removed, changed or unchanged, with the lines removed and added',
  screen: 'Accounts > Tax > CAS Books and Documents > Document > Versions', middleware: [...read, validate(docParam, 'params'), validate(z.object({ from: z.coerce.number().int().min(1), to: z.coerce.number().int().min(1) }), 'query')],
  query: { from: 1, to: 2 },
  response: { success: true, data: { from: { version: 1, status: 'superseded' }, to: { version: 2, status: 'approved' }, summary: { added: 0, removed: 0, changed: 1 },
    sections: [{ key: 's1', change: 'changed', heading: 'Purpose and scope', headingBefore: null, lines: [{ type: 'removed', text: 'Old line' }, { type: 'added', text: 'New line' }] }] } },
  handler: async (req, res) => ok(res, await casDocs.compareVersions(pool, req.params.type, req.query.from, req.query.to)),
});
define({
  method: 'POST', path: '/cas/documents/:type/draft', summary: 'Start a new version (draft) of a CAS document from the approved version, or from the standard text while none is approved; one version in progress at a time',
  screen: 'Accounts > Tax > CAS Books and Documents > Document > Edit', middleware: [...write, validate(docParam, 'params')],
  handler: async (req, res) => {
    const r = await tx((db) => casDocs.createDraft(db, req.params.type, req.user));
    await docAction(req, 'create', r);
    created(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user }));
  },
});
define({
  method: 'PUT', path: '/cas/documents/:type/draft', summary: 'Save the sections of the draft (heading and plain text; {{field}} placeholders of the live fields only)',
  screen: 'Accounts > Tax > CAS Books and Documents > Document > Edit', middleware: [...write, validate(docParam, 'params'), validate(sectionsSchema)],
  request: { sections: [{ key: 's1', heading: 'Purpose and scope', text: '{{software}} is the accounting system of {{taxpayerName}}.' }] },
  handler: async (req, res) => {
    const r = await tx((db) => casDocs.saveDraft(db, req.params.type, req.body.sections, req.user));
    await docAction(req, 'update', r);
    ok(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user }), 'Saved');
  },
});
define({
  method: 'POST', path: '/cas/documents/:type/draft/submit', summary: 'Submit the draft for approval with a reason of the Reason Codes master (context cas_document_change) and a change note',
  screen: 'Accounts > Tax > CAS Books and Documents > Document', middleware: [...write, validate(docParam, 'params'),
    validate(z.object({ reasonCode: z.string().trim().min(1).max(60), note: z.string().trim().max(1000).optional(), changeNote: z.string().trim().min(1).max(2000) }))],
  request: { reasonCode: 'CDC-CUSTODIAN', changeNote: 'New backup custodian named' },
  handler: async (req, res) => {
    const r = await tx((db) => casDocs.submitDraft(db, req.params.type, req.body, req.user));
    await docAction(req, 'submit', r, r.after.change_note);
    ok(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user }));
  },
});
define({
  method: 'POST', path: '/cas/documents/:type/draft/approve', summary: 'Approve the submitted version (approve:period-end; a different user than the one who prepared, edited or submitted it); the previous approved version is superseded',
  screen: 'Accounts > Tax > CAS Books and Documents > Document', middleware: [...approve, validate(docParam, 'params'), validate(z.object({ remarks: z.string().trim().max(1000).optional() }))],
  request: { remarks: 'Checked against the registration file' },
  handler: async (req, res) => {
    const r = await tx((db) => casDocs.approveVersion(db, req.params.type, req.body, req.user));
    await docAction(req, 'approve', r, req.body.remarks || null);
    ok(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user }));
  },
});
define({
  method: 'POST', path: '/cas/documents/:type/draft/reject', summary: 'Return the submitted version to its preparer as a draft, with remarks (approve:period-end; a different user than the one who prepared, edited or submitted it)',
  screen: 'Accounts > Tax > CAS Books and Documents > Document', middleware: [...approve, validate(docParam, 'params'), validate(z.object({ remarks: z.string().trim().min(1).max(1000) }))],
  request: { remarks: 'Name the restore test frequency' },
  handler: async (req, res) => {
    const r = await tx((db) => casDocs.rejectVersion(db, req.params.type, req.body, req.user));
    await docAction(req, 'reject', r, req.body.remarks);
    ok(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user }));
  },
});
define({
  method: 'POST', path: '/cas/documents/:type/draft/withdraw', summary: 'Take back the version you submitted, before it is decided: it returns to draft (write:period-end; the submitter only)',
  screen: 'Accounts > Tax > CAS Books and Documents > Document', middleware: [...write, validate(docParam, 'params')],
  handler: async (req, res) => {
    const r = await tx((db) => casDocs.withdrawSubmission(db, req.params.type, req.user));
    await docAction(req, 'withdraw', r, null);
    ok(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user }));
  },
});
define({
  method: 'POST', path: '/cas/documents/:type/draft/discard', summary: 'Discard the draft (cancelled; the approved version stays in force)',
  screen: 'Accounts > Tax > CAS Books and Documents > Document', middleware: [...write, validate(docParam, 'params')],
  handler: async (req, res) => {
    const r = await tx((db) => casDocs.discardDraft(db, req.params.type));
    await docAction(req, 'cancel', r);
    ok(res, await casDocs.documentDetail(pool, req.params.type, { viewer: req.user }));
  },
});
define({
  method: 'GET', path: '/cas/audit-extract', summary: 'Audit trail extract for a date range (Excel or PDF)', screen: 'Accounts > Tax > CAS Books and Documents',
  middleware: [...read, validate(z.object({ from: dateField, to: dateField, format: z.enum(['xlsx', 'pdf']).optional() }), 'query')], query: { from: '2026-09-01', to: '2026-09-30', format: 'xlsx' },
  handler: async (req, res) => {
    const rows = await cas.auditExtract(pool, req.query);
    await audit(req, { entity: 'audit_extract', entityId: `${req.query.from}..${req.query.to}`, action: 'download', after: { rows: rows.length } });
    if (req.query.format === 'pdf') {
      return sendPdf(res, await renderReportPdf({ title: 'Audit Trail Extract', params: `${req.query.from} to ${req.query.to}`, columns: cas.AUDIT_COLUMNS, rows }), `audit-trail-${req.query.from}-${req.query.to}.pdf`);
    }
    return sendFile(res, writeXlsx({ title: 'Audit trail extract', sheets: [{ name: 'Audit trail', columns: cas.AUDIT_COLUMNS.map((c) => ({ key: c.key, header: c.label, width: 24 })), rows }] }),
      `audit-trail-${req.query.from}-${req.query.to}.xlsx`, XLSX);
  },
});

export default router;
export const mount = '/bir';
