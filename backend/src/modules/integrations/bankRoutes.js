import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok, paging } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { many } from '../../db/pool.js';
import { uploadFile } from '../documents/tabular.js';
import * as lay from './bankfiles/layouts.js';
import * as bat from './bankfiles/batches.js';

/**
 * Bank payment files.
 *   Master > Finance > Bank File Layouts   layouts (write:disbursements) and payee bank accounts
 *   Accounts > Bank Payment Files          batches of payment vouchers: create, submit, approve (maker-checker,
 *                                          Authority Matrix payment_voucher), write and download the file, status
 *                                          file import or manual result per line (read / write:disbursements)
 */
const { router, define } = moduleRouter('Bank Payment Files', '/bank-payments');
const LAYOUTS = 'Master > Finance > Bank File Layouts';
const BATCHES = 'Accounts > Bank Payment Files';
const read = [requireAuth, requirePermission('read:disbursements')];
const write = [requireAuth, requirePermission('write:disbursements')];
const layoutExample = { code: 'BDO-BULK', name: 'BDO bulk credit (example)', bankCode: 'BDO', channels: ['bulk_credit', 'pesonet'], format: 'delimited', delimiter: ',',
  detailFields: [{ name: 'Account number', source: 'line.accountNumber', format: 'digits' }, { name: 'Amount', source: 'line.amount', format: 'amount' }],
  statusFile: { format: 'delimited', hasHeader: true, columns: { reference: 'Reference', status: 'Status' }, paidValues: ['SUCCESS'], rejectedValues: ['FAILED'] }, isExample: true, active: true };
const batchExample = { id: 'bpb_0123456789abcdef', batchNumber: 'BPB-2026-00001', layoutCode: 'BDO-BULK', bankAccountCode: 'ACC-BDO-001', channel: 'pesonet', valueDate: '2026-10-05',
  status: 'file-generated', lineCount: 2, totalAmount: 153250.5, paidCount: 0, rejectedCount: 0, pendingCount: 2, fileName: 'BDO_BPB-2026-00001_20261005.csv',
  lines: [{ id: 1, seq: 1, voucherNumber: 'PV-2026-00011', payeeName: 'Malayan Insurance Co., Inc.', bankCode: 'MBT', accountNumber: '0012345678', amount: 125000, status: 'pending' }] };
const decisionExample = { canDecide: false, blockedCode: 'SUBMITTER', blockedReason: 'You submitted this batch. Another user must approve it.' };

// ------------------------------------------------------------------ layouts
define({
  method: 'GET', path: '/layouts', summary: 'Bank file layouts (all=true includes inactive ones) with the sources and formats a field may use', screen: LAYOUTS, middleware: read,
  query: { all: 'true' }, response: { success: true, data: [layoutExample], sources: lay.SOURCES, formats: lay.FORMATS },
  handler: async (req, res) => ok(res, await lay.listLayouts({ all: req.query.all === 'true' }), 'OK', { sources: lay.SOURCES, formats: lay.FORMATS, channels: lay.CHANNELS }),
});
define({
  method: 'POST', path: '/layouts', summary: 'New bank file layout', screen: `${LAYOUTS} > New layout`,
  middleware: [...write, validate(lay.layoutSchema.extend({ code: z.string().trim().regex(/^[A-Z0-9_-]{2,30}$/, 'capital letters, digits, _ and -') }))],
  request: { code: 'BDO-BULK-2', ...layoutExample }, response: { success: true, data: layoutExample },
  handler: async (req, res) => {
    const { code, ...body } = req.body;
    const l = await lay.createLayout(code, body, req.user);
    await audit(req, { entity: 'bank_file_layout', entityId: l.code, action: 'create', after: l });
    created(res, l, `Layout ${l.code} created`);
  },
});
define({
  method: 'PUT', path: '/layouts/:code', summary: 'Change a bank file layout (a starter layout stops being marked as example once changed)', screen: `${LAYOUTS} > Edit`,
  middleware: [...write, validate(lay.layoutSchema.partial().strict())], request: { detailFields: layoutExample.detailFields }, response: { success: true, data: layoutExample },
  handler: async (req, res) => {
    const { before, after } = await lay.updateLayout(req.params.code, req.body, req.user);
    await audit(req, { entity: 'bank_file_layout', entityId: after.code, action: 'update', before, after });
    ok(res, after, `Layout ${after.code} saved`);
  },
});
define({
  method: 'POST', path: '/layouts/preview', summary: 'The file a layout writes for two example payments (layout as edited, not saved)', screen: `${LAYOUTS} > Preview`,
  middleware: [...read, validate(lay.layoutSchema.partial({ name: true, channels: true }).strict())], request: { format: 'delimited', detailFields: layoutExample.detailFields },
  response: { success: true, data: { fileName: 'BDO_BPB-2026-00001_20261005.csv', content: '1234567890,28250.50\r\n' } },
  handler: async (req, res) => {
    const b = req.body;
    const row = { code: 'PREVIEW', format: b.format, delimiter: b.delimiter || ',', quote_values: !!b.quoteValues, line_ending: b.lineEnding || 'CRLF', file_name_pattern: b.fileNamePattern || '{batchNumber}.txt',
      header_fields: b.headerFields || [], detail_fields: b.detailFields || [], trailer_fields: b.trailerFields || [] };
    const { fileName, content } = lay.renderFile(row, lay.SAMPLE.batch, lay.SAMPLE.lines);
    ok(res, { fileName, content });
  },
});

// ------------------------------------------------------------------ payee bank accounts
const payeeBody = z.object({
  payeeType: z.enum(bat.PAYEE_TYPES), payeeId: z.string().trim().min(1).max(60), payeeName: z.string().trim().max(200).optional(), bankCode: z.string().trim().min(2).max(20),
  bankBranch: z.string().trim().max(120).nullable().optional(), accountNumber: z.string().trim().regex(/^[0-9 -]{6,34}$/, 'digits, spaces and -'), accountName: z.string().trim().min(2).max(200),
  accountType: z.enum(['savings', 'current']).optional(), isDefault: z.boolean().optional(), email: z.string().trim().email().max(200).nullable().optional().or(z.literal('')), active: z.boolean().optional(),
}).strict();
const payeeExample = { id: 1, payeeType: 'Insurer', payeeId: '3', payeeName: 'Malayan Insurance Co., Inc.', bankCode: 'MBT', accountNumber: '0012-3456-78', accountName: 'Malayan Insurance Co., Inc.', accountType: 'current', isDefault: true, active: true };
define({
  method: 'GET', path: '/payee-accounts', summary: 'Bank accounts of payees credited by bank payment files (payeeType, search)', screen: `${LAYOUTS} > Payee Bank Accounts`, middleware: read,
  query: { payeeType: 'Insurer' }, response: { success: true, data: [payeeExample] }, handler: async (req, res) => ok(res, await bat.listPayeeAccounts(req.query)),
});
define({
  method: 'POST', path: '/payee-accounts', summary: 'Record a payee\'s bank account (insurer, referrer, client or supplier)', screen: `${LAYOUTS} > Payee Bank Accounts > New`,
  middleware: [...write, validate(payeeBody)], request: payeeExample, response: { success: true, data: payeeExample },
  handler: async (req, res) => {
    const { after } = await bat.savePayeeAccount(null, req.body, req.user);
    await audit(req, { entity: 'payee_bank_account', entityId: after.id, action: 'create', after });
    created(res, after, 'Bank account saved');
  },
});
define({
  method: 'PUT', path: '/payee-accounts/:id', summary: 'Change a payee\'s bank account', screen: `${LAYOUTS} > Payee Bank Accounts > Edit`, middleware: [...write, validate(payeeBody)],
  request: payeeExample, response: { success: true, data: payeeExample },
  handler: async (req, res) => {
    const { before, after } = await bat.savePayeeAccount(req.params.id, req.body, req.user);
    await audit(req, { entity: 'payee_bank_account', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Bank account saved');
  },
});

// ------------------------------------------------------------------ batches
define({
  method: 'GET', path: '/bank-accounts', summary: 'The broker\'s active bank accounts (bank account master) a batch can be paid from', screen: BATCHES, middleware: read,
  response: { success: true, data: [{ code: 'ACC-BDO-001', name: 'BrokerVerse - Operating Account', bankCode: 'BDO', accountNumber: '001234567890' }] },
  handler: async (_req, res) => ok(res, (await many("SELECT bank_account_code, bank_account_name, bank_code, account_number FROM bank_account_links WHERE status = 'active' ORDER BY bank_account_code"))
    .map((a) => ({ code: a.bank_account_code, name: a.bank_account_name, bankCode: a.bank_code, accountNumber: a.account_number }))),
});
define({
  method: 'GET', path: '/eligible-vouchers', summary: 'Payment vouchers that can go on a batch (submitted for approval, unpaid, no cheque, not on another batch) with the payee\'s bank account (payeeType, search)',
  screen: `${BATCHES} > New batch`, middleware: read, query: { payeeType: 'Insurer' },
  response: { success: true, data: [{ disbursementId: 'pv_1', voucherNumber: 'PV-2026-00011', payeeType: 'Insurer', payeeName: 'Malayan Insurance Co., Inc.', amount: 125000, bankCode: 'MBT', accountNumber: '0012-3456-78', ready: true }] },
  handler: async (req, res) => ok(res, await bat.eligibleVouchers(req.query)),
});
define({
  method: 'GET', path: '/batches', summary: 'Bank payment batches (status (comma-separated), search on batch, voucher or payee; paging), each with the caller\'s decision block (canDecide, blockedCode, blockedReason)',
  screen: BATCHES, middleware: read, query: { status: 'approved,file-generated' },
  response: { success: true, data: [{ ...batchExample, decision: decisionExample }], total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { total, rows } = await bat.listBatches(req.query, pg);
    const out = [];
    for (const b of rows) out.push(await bat.withDecision(b, req.user));
    ok(res, out, 'OK', { total, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'GET', path: '/batches/:id',
  summary: 'One batch with its lines and the caller\'s decision block: Approve and Reject are offered only when canDecide; otherwise blockedCode (MAKER, SUBMITTER, VOUCHER_MAKER, NO_AUTHORITY, ABOVE_LIMIT, NO_PERMISSION, WRONG_STATUS) and the reason',
  screen: `${BATCHES} > Batch`, middleware: read, response: { success: true, data: { ...batchExample, decision: decisionExample } },
  handler: async (req, res) => ok(res, await bat.withDecision(await bat.getBatch(req.params.id), req.user)),
});
define({
  method: 'POST', path: '/batches', summary: 'New batch (draft) from payment vouchers: layout, bank account paid from, channel (bulk_credit, instapay, pesonet), value date',
  screen: `${BATCHES} > New batch`, middleware: [...write, validate(z.object({ layoutCode: z.string().trim().min(2).max(30), bankAccountCode: z.string().trim().min(1).max(40), channel: z.enum(lay.CHANNELS),
    valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), disbursementIds: z.array(z.string().trim().min(1)).min(1).max(1000), remarks: z.string().max(500).optional() }).strict())],
  request: { layoutCode: 'BDO-BULK', bankAccountCode: 'ACC-BDO-001', channel: 'pesonet', valueDate: '2026-10-05', disbursementIds: ['pv_1', 'pv_2'] }, response: { success: true, data: { ...batchExample, status: 'draft' } },
  handler: async (req, res) => {
    const b = await bat.createBatch(req.body, req.user);
    await audit(req, { entity: 'bank_payment_batch', entityId: b.id, action: 'create', after: { ...b, lines: b.lines.map((l) => l.voucherNumber) } });
    created(res, b, `Batch ${b.batchNumber} created with ${b.lineCount} payment(s)`);
  },
});
const step = (path, summary, fn, action, message, body = null) => define({
  method: 'POST', path: `/batches/:id/${path}`, summary, screen: `${BATCHES} > Batch > ${action}`, middleware: body ? [...write, validate(body)] : write,
  request: body ? { reason: 'Wrong value date' } : undefined, response: { success: true, data: batchExample },
  handler: async (req, res) => {
    const { before, after } = await fn(req);
    await audit(req, { entity: 'bank_payment_batch', entityId: after.id, action: path, before: { status: before.status }, after: { status: after.status, ...(req.body?.reason ? { reason: req.body.reason } : {}) } });
    ok(res, after, message(after));
  },
});
step('submit', 'Submit a draft batch for approval', (req) => bat.submitBatch(req.params.id, req.user), 'Submit', (b) => `Batch ${b.batchNumber} submitted for approval`);
step('approve', 'Approve a batch (not by its maker or the maker of one of its vouchers; Authority Matrix payment_voucher on the total)', (req) => bat.approveBatch(req.params.id, req.user), 'Approve', (b) => `Batch ${b.batchNumber} approved`);
step('reject', 'Send a batch back to draft with the reason', (req) => bat.rejectBatch(req.params.id, req.body.reason, req.user), 'Reject', (b) => `Batch ${b.batchNumber} returned to draft`,
  z.object({ reason: z.string().trim().min(3).max(500) }).strict());
step('generate', 'Write the payment file from the layout (approved batch; again until a result is recorded)', (req) => bat.generateFile(req.params.id, req.user), 'Write file', (b) => `File ${b.fileName} written`);
step('sent', 'Record that the file was uploaded on the bank portal', (req) => bat.markSent(req.params.id, req.user), 'Mark uploaded', (b) => `Batch ${b.batchNumber} marked as uploaded to the bank`);
step('cancel', 'Cancel a batch that has no paid line (its vouchers become free again)', (req) => bat.cancelBatch(req.params.id, req.body.reason, req.user), 'Cancel', (b) => `Batch ${b.batchNumber} cancelled`,
  z.object({ reason: z.string().trim().min(3).max(500) }).strict());
define({
  method: 'GET', path: '/batches/:id/file', summary: 'Download the payment file of a batch for upload on the bank portal', screen: `${BATCHES} > Batch > Download file`, middleware: read,
  response: '(file) BDO_BPB-2026-00001_20261005.csv',
  handler: async (req, res) => {
    const f = await bat.fileOf(req.params.id);
    await audit(req, { entity: 'bank_payment_batch', entityId: req.params.id, action: 'download-file', after: { fileName: f.fileName } });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${f.fileName}"`);
    res.send(f.content);
  },
});
define({
  method: 'POST', path: '/batches/:id/status-file', summary: 'Import the bank\'s payment status file (read with the layout\'s status file definition): paid lines post their payment and mark the voucher paid, rejected lines free the voucher',
  screen: `${BATCHES} > Batch > Import status file`, middleware: [...write, uploadFile], request: { file: '(multipart) status.csv' },
  response: { success: true, data: { outcome: { applied: 2, paid: 1, rejected: 1, skipped: [] }, batch: { ...batchExample, status: 'completed' } } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('Attach the status file from the bank');
    const out = await bat.importStatusFile(req.params.id, req.file.buffer.toString('utf8'), req.file.originalname, req.user);
    await audit(req, { entity: 'bank_payment_batch', entityId: out.batch.id, action: 'status-file', after: { file: req.file.originalname, ...out.outcome, status: out.batch.status } });
    ok(res, out, `${out.outcome.applied} result(s) applied${out.outcome.skipped.length ? `, ${out.outcome.skipped.length} row(s) skipped` : ''}`);
  },
});
define({
  method: 'POST', path: '/batches/:id/lines/:lineId/result', summary: 'Manual result of one payment (as shown on the bank portal): paid with the bank reference, or rejected with the reason',
  screen: `${BATCHES} > Batch > Record result`, middleware: [...write, validate(z.object({ status: z.enum(['paid', 'rejected']), bankReference: z.string().trim().max(80).optional(), reason: z.string().trim().max(500).optional() })
    .strict().refine((b) => b.status !== 'rejected' || b.reason, 'Give the reason of the rejection'))],
  request: { status: 'paid', bankReference: 'PESONET-889201' }, response: { success: true, data: { outcome: { applied: 1, paid: 1 }, batch: batchExample } },
  handler: async (req, res) => {
    const out = await bat.setLineResult(req.params.id, req.params.lineId, req.body, req.user);
    await audit(req, { entity: 'bank_payment_batch', entityId: out.batch.id, action: 'line-result', after: { lineId: Number(req.params.lineId), ...req.body } });
    ok(res, out, req.body.status === 'paid' ? 'Payment recorded and posted' : 'Rejection recorded');
  },
});

export default [['/bank-payments', router]];
