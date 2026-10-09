import { moduleRouter } from '../../lib/registry.js';
import { formatMoney } from '../../lib/money.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { pageParams, sendList } from '../accounting/lib/http.js';
import * as svc from './service.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { journalVoucherDoc } from '../documents/finance.js';
import { mapColumns, parseUploadedRows, uploadFile } from '../documents/tabular.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';

const { router, define } = moduleRouter('Journal Vouchers', '/journal-vouchers');
const read = [requireAuth, requirePermission('read:journal-vouchers')];
const write = [requireAuth, requirePermission('write:journal-vouchers')];
const SCREEN = 'Accounts > Journal Voucher';
const header = { id: 'jv_1', transactionCode: 'JV01', transactionNumber: 'JV-2026-00001', transactionDescription: 'Accrual of audit fees', date: '2026-09-28', totalDebit: 25000, totalCredit: 25000, status: 'for-approval', kind: 'standard' };
const entrySchema = z.object({
  mainAccount: z.string().min(1), subAccount: z.string().optional().nullable(), entryType: z.string(), foreignAmount: z.union([z.number(), z.string()]).optional(),
  localAmount: z.union([z.number(), z.string()]).optional(), currencyCode: z.string().optional(), remarks: z.string().optional(), branchCode: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(), costCentre: z.string().optional().nullable(),
}).passthrough();
const entryExample = [{ mainAccount: '4401003', subAccount: '4401003001', entryType: 'Debit', currencyCode: 'PHP', foreignAmount: 25000, remarks: 'Statutory audit FY2026', branchCode: 'PHP', departmentCode: 'FI' },
  { mainAccount: '2206001', entryType: 'Credit', currencyCode: 'PHP', foreignAmount: 25000, remarks: 'Accrued audit fee' }];

const jvLink = (jv) => `/accounts/journalvoucher/detailsjournalvocture/${jv.id}`;
async function askApproval(jv, req) {
  if (jv.status !== 'for-approval') return;
  await notifyApprovers({ audience: 'write:journal-vouchers', document: 'Journal voucher', number: jv.jv_number, by: req.user.username, detail: await formatMoney(jv.total_debit),
    link: jvLink(jv), entity: 'journal_voucher', entityId: jv.id });
}

define({
  method: 'GET', path: '/history', summary: 'Journal voucher register (manual, correction and reversal JVs; all=true for system journals too; parked=true for the system journals parked for approval)',
  screen: SCREEN, middleware: read,
  query: { page: 1, pageSize: 20, transactionCode: 'JV01', transactionNumber: 'JV-2026', status: 'posted', parked: false },
  response: { success: true, data: [header], pagination: { currentPage: 1, pageSize: 20, totalRecords: 1, totalPages: 1 } },
  handler: async (req, res) => { const pg = pageParams(req.query, 20); const r = await svc.history(pool, req.query, pg); sendList(res, r.rows, r.total, pg); },
});
define({
  method: 'GET', path: '/', summary: 'With transactionNumber: the voucher lines (header fields repeated on each line); otherwise the voucher register', screen: `${SCREEN} > Details`, middleware: read,
  query: { transactionNumber: 'JV-2026-00001', page: 1, pageSize: 10 },
  response: { success: true, data: [{ ...header, id: '55', mainAccount: '4401003', subAccount: '4401003001', entryType: 'Debit', localAmount: 25000, foreignAmount: 25000, currencyCode: 'PHP', remarks: 'Statutory audit FY2026' }] },
  handler: async (req, res) => {
    const pg = pageParams(req.query);
    if (!req.query.transactionNumber) { const r = await svc.history(pool, req.query, pg); sendList(res, r.rows, r.total, pg); return; }
    const d = await svc.jvDetail(pool, req.query.transactionNumber);
    sendList(res, d.entries.slice(pg.offset, pg.offset + pg.limit), d.entries.length, pg, { voucher: { ...d, entries: undefined } });
  },
});
define({
  method: 'POST', path: '/', summary: 'Create a manual journal voucher (balanced; for approval by a different user when journal.require_approval)', screen: `${SCREEN} > Add`,
  middleware: [...write, validate(z.object({ transactionCode: z.string().min(1), transactionDescription: z.string().optional(), description: z.string().optional(), date: z.string().optional(), entries: z.array(entrySchema).min(2) }).passthrough())],
  request: { transactionCode: 'JV01', transactionDescription: 'Accrual of audit fees', entries: entryExample },
  response: { success: true, message: 'Transaction Number JV-2026-00001 is created', data: header },
  handler: async (req, res) => {
    const jv = await withTransaction((db) => svc.createManual(db, req.body, req.user));
    await audit(req, { entity: 'journal_voucher', entityId: jv.id, action: 'create', after: req.body });
    await askApproval(jv, req);
    created(res, { ...svc.headerRow(jv), transactionNumber: jv.jv_number }, `Transaction Number ${jv.jv_number} is created`);
  },
});
define({
  method: 'POST', path: '/reversal', summary: 'Reversal JV for a posted voucher (by transactionNumber); approval as for manual vouchers', screen: 'Accounts > Reversal JV',
  middleware: [...write, validate(z.object({ transactionNumber: z.string().min(1), reversalJVTransactionCode: z.string().optional(), transactionCode: z.string().optional(), description: z.string().optional(), date: z.string().optional() }).passthrough())],
  request: { transactionNumber: 'JV-2026-00001', reversalJVTransactionCode: 'RJV01', description: 'Reverse duplicate accrual' }, response: { success: true, data: { ...header, kind: 'reversal', reversalOf: 'jv_1' } },
  handler: async (req, res) => {
    const jv = await withTransaction((db) => svc.createReversal(db, req.body, req.user));
    await audit(req, { entity: 'journal_voucher', entityId: jv.id, action: 'create-reversal', after: req.body });
    await askApproval(jv, req);
    created(res, svc.headerRow(jv), `Transaction Number ${jv.jv_number} is created`);
  },
});
define({
  method: 'POST', path: '/correction', summary: 'Correction JV: reverses the original voucher and posts corrected entries in one voucher', screen: 'Accounts > Correction JV',
  middleware: [...write, validate(z.object({ transactionNumber: z.string().min(1), correctionJVTransactionCode: z.string().optional(), description: z.string().optional(), entries: z.array(entrySchema).min(2) }).passthrough())],
  request: { transactionNumber: 'JV-2026-00001', correctionJVTransactionCode: 'CJV01', entries: entryExample }, response: { success: true, data: { ...header, kind: 'correction', correctionOf: 'jv_1' } },
  handler: async (req, res) => {
    const jv = await withTransaction((db) => svc.createCorrection(db, req.body, req.user));
    await audit(req, { entity: 'journal_voucher', entityId: jv.id, action: 'create-correction', after: req.body });
    await askApproval(jv, req);
    created(res, svc.headerRow(jv), `Transaction Number ${jv.jv_number} is created`);
  },
});
define({
  method: 'GET', path: '/upload/template', summary: 'Journal voucher upload template (XLSX: Data, Columns and Instructions sheets)', screen: `${SCREEN} > Upload > Download template`, middleware: read,
  response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'journal-vouchers'),
});
define({
  method: 'POST', path: '/upload', summary: 'Upload journal vouchers from CSV / XLSX (multipart "file"): rows grouped by Voucher Ref, the whole file checked first (balanced, accounts active and open to manual entries, cost centres, period open); each voucher is parked for approval by a different user',
  screen: `${SCREEN} > Upload`, middleware: [...write, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: '2 journal vouchers uploaded for approval', data: { total: 4, vouchers: [{ voucherRef: 'ACCR-2026-10-01', ...header, lineCount: 2 }] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file);
    const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
    if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
    const created = await withTransaction((db) => svc.uploadVouchers(db, rows.map((r) => mapColumns(r, svc.JV_UPLOAD_COLUMNS)), req.user));
    for (const jv of created) {
      await audit(req, { entity: 'journal_voucher', entityId: jv.id, action: 'upload', after: { voucherRef: jv.voucher_ref, file: req.file.originalname, lines: jv.line_count } });
      await askApproval(jv, req);
    }
    const vouchers = created.map((jv) => ({ voucherRef: jv.voucher_ref, ...svc.headerRow(jv), lineCount: jv.line_count }));
    ok(res, { total: rows.length, vouchers }, `${vouchers.length} journal voucher${vouchers.length === 1 ? '' : 's'} uploaded for approval`);
  },
});
define({
  method: 'GET', path: '/:id/pdf', summary: 'Printable journal voucher (PDF, broker letterhead and branding; prepared / approved signatures once posted)', screen: `${SCREEN} > Details > Print`, middleware: read,
  query: { download: 1 }, response: '(application/pdf)',
  handler: async (req, res) => {
    const jv = await svc.jvDetail(pool, req.params.id);
    const row = await svc.getJv(pool, req.params.id);
    sendPdf(res, buildPdf(await journalVoucherDoc(jv, row)), `journal-voucher-${jv.transactionNumber || jv.id}.pdf`, req.query.download ? 'attachment' : 'inline');
  },
});
define({
  method: 'GET', path: '/:id', summary: 'One voucher (id or number) with its entries', screen: `${SCREEN} > Details`, middleware: read,
  response: { success: true, data: { ...header, entries: [] } }, handler: async (req, res) => ok(res, await svc.jvDetail(pool, req.params.id)),
});
define({
  method: 'POST', path: '/:id/approve', summary: 'Checker approves and posts a voucher (maker cannot approve own voucher)', screen: `${SCREEN} > Details`, middleware: write,
  request: {}, response: { success: true, data: { ...header, status: 'posted' } },
  handler: async (req, res) => {
    const jv = await withTransaction((db) => svc.approve(db, req.params.id, req.user));
    await audit(req, { entity: 'journal_voucher', entityId: jv.id, action: 'approve', after: { status: jv.status } });
    await notifyDecision({ userId: jv.created_by, decidedBy: req.user.id, document: 'Journal voucher', number: jv.jv_number, approved: true, by: req.user.username,
      message: `Approved and posted by ${req.user.username}`, link: jvLink(jv), entity: 'journal_voucher', entityId: jv.id });
    ok(res, svc.headerRow(jv), `Journal voucher ${jv.jv_number} approved and posted`);
  },
});
define({
  method: 'POST', path: '/:id/reject', summary: 'Checker rejects a voucher awaiting approval', screen: `${SCREEN} > Details`, middleware: [...write, validate(z.object({ reason: z.string().min(3) }))],
  request: { reason: 'Wrong expense account' }, response: { success: true, data: { ...header, status: 'rejected' } },
  handler: async (req, res) => {
    const jv = await withTransaction((db) => svc.reject(db, req.params.id, req.body.reason, req.user));
    await audit(req, { entity: 'journal_voucher', entityId: jv.id, action: 'reject', after: { reason: req.body.reason } });
    await notifyDecision({ userId: jv.created_by, decidedBy: req.user.id, document: 'Journal voucher', number: jv.jv_number, approved: false, by: req.user.username, reason: req.body.reason,
      link: jvLink(jv), entity: 'journal_voucher', entityId: jv.id });
    ok(res, svc.headerRow(jv), `Journal voucher ${jv.jv_number} rejected`);
  },
});
export default router;
export const mount = '/journal-vouchers';
