/**
 * Credit Life API (/credit-life): Operations > Credit Life (TIS-BRD-PJRN-01, PJRN-02; FGA CL-01 to CL-04; GAP-QUOTE-18).
 * Monthly batches of a financing bank, their members uploaded or encoded and checked against the Credit Life rules,
 * certificates of cover on one master policy per customer, e-mailed as password-protected PDFs, the batch forwarded to
 * the insurer. Access: read:credit-life; write:credit-life.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { sendPdf } from '../documents/pdf.js';
import { normKey, uploadFile } from '../documents/tabular.js';
import { readXlsx } from '../documents/xlsx.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import * as svc from './service.js';
import * as docs from './certificates.js';

const { router, define } = moduleRouter('Credit Life', '/credit-life');
const SCREEN = 'Operations > Credit Life';
const canRead = [requireAuth, requirePermission('read:credit-life', 'write:credit-life')];
const canWrite = [requireAuth, requirePermission('write:credit-life')];
const text = (n) => z.string().max(n).optional().nullable();
const num = z.union([z.null(), z.literal(''), z.coerce.number()]).optional();
const memberBody = z.object({
  customerNo: text(40), lastName: text(120), firstName: text(120), birthDate: text(10), loanAccount: text(30), loanAmount: num, loanTermMonths: num, releaseDate: text(10),
  accountCount: num, sumInsured: num, email: text(200), mobile: text(20), address: text(300), city: text(120), province: text(120),
});
const batch = { id: 'clb_1', batchNumber: 'CLB-2026-00010', bankName: 'Toyota Financial Services Philippines Corporation', insurerName: 'Pioneer Life', productName: 'Credit Life - Compulsory',
  period: '2026-10', status: 'draft', members: 8000, valid: 7980, errors: 20, issued: 0, totalSumInsured: 7980000000, totalPremium: 15960000 };
const member = { id: 'clmb_1', rowNo: 2, loanAccount: '8005123456', borrowerName: 'Juan Dela Cruz', birthDate: '1980-03-14', loanTermMonths: 60, releaseDate: '2026-10-05', sumInsured: 1000000,
  premium: 2000, coverFrom: '2026-10-05', coverTo: '2031-10-04', status: 'valid', errors: [] };

define({
  method: 'GET', path: '/batches', summary: 'Credit Life batches (status draft / issued / sent; search number or bank) with their counts and totals', screen: SCREEN, middleware: canRead,
  query: { status: 'draft' }, response: { success: true, data: [batch] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listBatches(req.query) }),
});
define({
  method: 'GET', path: '/choices', summary: 'Choices of a new batch: the Credit Life products, the rules, the sum insured and premium defaults', screen: `${SCREEN} > New Batch`, middleware: canRead,
  response: { success: true, data: { products: [{ value: 5, label: 'Credit Life - Compulsory', code: 'CL-COMP' }], sumInsured: 1000000, premiumBasis: 'fixed', premiumPerAccount: 2000 } },
  handler: async (_req, res) => res.json({ success: true, data: await svc.batchChoices() }),
});
define({
  method: 'POST', path: '/batches', summary: 'Open the monthly Credit Life batch of a financing bank with an insurer', screen: `${SCREEN} > New Batch`,
  middleware: [...canWrite, validate(z.object({ financingClientId: z.string().min(1).max(40), insuranceCompanyId: z.coerce.number().int(), productId: z.coerce.number().int().optional().nullable(),
    period: z.string().max(7), notes: text(1000) }))],
  request: { financingClientId: 'cl_1', insuranceCompanyId: 7, period: '2026-10' }, response: { success: true, data: batch },
  handler: async (req, res) => {
    const b = await svc.createBatch(req.body, req.user);
    await audit(req, { entity: 'credit_life_batch', entityId: b.id, action: 'create', after: { ...b, memberList: undefined } });
    res.status(201).json({ success: true, message: `Batch ${b.batchNumber} opened`, data: b });
  },
});
define({
  method: 'GET', path: '/batches/:id', summary: 'One batch with its members (status valid / error / issued / cancelled; search loan account, name or certificate)', screen: `${SCREEN} > Batch`, middleware: canRead,
  query: { status: 'error' }, response: { success: true, data: { ...batch, memberList: [member] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getBatch(req.params.id, req.query) }),
});
define({
  method: 'GET', path: '/template', summary: 'Credit Life members template (XLSX: Data, Columns, Instructions)', screen: `${SCREEN} > Batch > Upload Members > Template`, middleware: canRead,
  response: 'binary file', handler: async (_req, res) => sendTemplate(res, 'credit-life-members'),
});
define({
  method: 'POST', path: '/batches/:id/upload', summary: 'Upload the members of a draft batch (.xlsx, multipart "file"): every row is checked against the Credit Life rules and kept, valid or with its messages',
  screen: `${SCREEN} > Batch > Upload Members`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: 'Processed 8000 rows: 7980 valid, 20 failed', data: { total: 8000, valid: 7980, failed: 20, errors: [{ row: 17, text: 'Row 17: The borrower is 66: Credit Life excludes borrowers aged 65 and over' }] } },
  handler: async (req, res) => {
    const name = req.file?.originalname || '';
    if (!req.file?.buffer?.length || !name.toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file' }]);
    let table;
    try { table = readXlsx(req.file.buffer); } catch (e) { throw badRequest(`Could not read the file: ${e.message}`); }
    const headers = (table[0] || []).map(normKey);
    const rows = table.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
    const out = await svc.uploadMembers(req.params.id, { rows, headers, fileName: name }, req.user);
    await audit(req, { entity: 'credit_life_batch', entityId: req.params.id, action: 'upload', after: { fileName: name, rows: out.total, valid: out.valid, failed: out.failed, errors: out.errors.slice(0, 50) } });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'POST', path: '/batches/:id/members', summary: 'Encode one member of a draft batch: refused with its messages when a Credit Life rule or a data check fails', screen: `${SCREEN} > Batch > Add Member`,
  middleware: [...canWrite, validate(memberBody)], request: { lastName: 'Dela Cruz', firstName: 'Juan', birthDate: '1980-03-14', loanAccount: '8005123456', loanTermMonths: 60, releaseDate: '2026-10-05' },
  response: { success: true, data: member },
  handler: async (req, res) => {
    const m = await svc.addMember(req.params.id, req.body, req.user);
    await audit(req, { entity: 'credit_life_member', entityId: m.id, action: 'create', after: m });
    res.status(201).json({ success: true, message: `Loan account ${m.loanAccount} added`, data: m });
  },
});
define({
  method: 'DELETE', path: '/members/:id', summary: 'Remove a member of a draft batch', screen: `${SCREEN} > Batch > Remove Member`, middleware: canWrite,
  response: { success: true, data: member },
  handler: async (req, res) => {
    const m = await svc.removeMember(req.params.id);
    await audit(req, { entity: 'credit_life_member', entityId: m.id, action: 'delete', before: m });
    res.json({ success: true, message: `Loan account ${m.loanAccount} removed`, data: m });
  },
});
define({
  method: 'POST', path: '/batches/:id/issue', summary: 'Issue a draft batch: a certificate of cover on the customer\'s master policy for every valid member, e-mailed as a password-protected PDF',
  screen: `${SCREEN} > Batch > Issue`, middleware: canWrite, response: { success: true, data: { issued: 7980, emailed: 7650 } },
  handler: async (req, res) => {
    const out = await svc.issueBatch(req.params.id, req.user);
    await audit(req, { entity: 'credit_life_batch', entityId: req.params.id, action: 'issue', after: out });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'POST', path: '/batches/:id/send', summary: 'Forward the issued accounts of a batch to the insurer (e-mail with the list; to: the insurer\'s contact e-mail unless given)', screen: `${SCREEN} > Batch > Send to Insurer`,
  middleware: [...canWrite, validate(z.object({ to: text(200) }))], request: { to: 'creditlife@insurer.example.ph' }, response: { success: true, data: { emailId: 31, to: 'creditlife@insurer.example.ph', accounts: 7980 } },
  handler: async (req, res) => {
    const out = await docs.sendBatch(req.params.id, req.body.to, req.user);
    await audit(req, { entity: 'credit_life_batch', entityId: req.params.id, action: 'send', after: out });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/batches/:id/soa', summary: 'Statement of account of a batch to the financing bank (PDF): the issued accounts and the premium due', screen: `${SCREEN} > Batch > Statement of Account`,
  middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const { pdf, number } = await docs.batchSoaPdf(req.params.id);
    sendPdf(res, pdf, `credit-life-soa-${number}.pdf`);
  },
});
define({
  method: 'POST', path: '/batches/:id/soa/send', summary: 'Send the statement of account of a sent batch to the financing bank (to: the bank client e-mail unless given; the insurer SOA reference may be recorded)',
  screen: `${SCREEN} > Batch > Send SOA to Bank`, middleware: [...canWrite, validate(z.object({ to: text(200), insurerSoaReference: text(80) }))],
  request: { to: 'insurance@tfs.example.ph', insurerSoaReference: 'SOA-2026-10-0012' }, response: { success: true, data: { emailId: 32, to: 'insurance@tfs.example.ph', accounts: 7980, total: 15960000 } },
  handler: async (req, res) => {
    const out = await docs.sendSoa(req.params.id, req.body);
    await audit(req, { entity: 'credit_life_batch', entityId: req.params.id, action: 'send-soa', after: out });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/batches/:id/list', summary: 'The issued accounts of a batch (Excel), as forwarded to the insurer', screen: `${SCREEN} > Batch > Accounts List`, middleware: canRead, response: 'binary file',
  handler: async (req, res) => {
    const out = await docs.batchList(req.params.id);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.content);
  },
});
define({
  method: 'POST', path: '/members/:id/cancel', summary: 'Cancel an issued certificate of cover (reason)', screen: `${SCREEN} > Batch > Cancel Certificate`,
  middleware: [...canWrite, validate(z.object({ reason: z.string().trim().max(500).optional().nullable() }))], request: { reason: 'Loan cancelled before release' }, response: { success: true, data: { ...member, status: 'cancelled' } },
  handler: async (req, res) => {
    const m = await svc.cancelMember(req.params.id, req.body.reason, req.user);
    await audit(req, { entity: 'credit_life_member', entityId: m.id, action: 'cancel', after: { status: m.status, reason: req.body.reason } });
    res.json({ success: true, message: `Certificate ${m.certificateNumber} cancelled`, data: m });
  },
});
define({
  method: 'GET', path: '/members/:id/certificate', summary: 'Certificate of cover (PDF); protected=1 gives the password-protected copy e-mailed to the borrower', screen: `${SCREEN} > Batch > Print Certificate`,
  middleware: canRead, query: { protected: '1' }, response: 'application/pdf',
  handler: async (req, res) => {
    const { pdf, row } = await docs.certificatePdf(req.params.id, { protect: req.query.protected === '1' });
    await audit(req, { entity: 'credit_life_member', entityId: row.id, action: 'print' });
    sendPdf(res, pdf, `credit-life-certificate-${row.certificate_number || row.loan_account}.pdf`);
  },
});
define({
  method: 'GET', path: '/master-policies', summary: 'Credit Life master policies, one per customer of a financing bank (search number, name or customer number)', screen: `${SCREEN} > Master Policies`, middleware: canRead,
  query: { search: 'Dela Cruz' }, response: { success: true, data: [{ id: 'clm_1', masterNumber: 'CLMP-2026-000123', borrowerName: 'Juan Dela Cruz', certificates: 2, sumInsured: 2000000 }] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listMasterPolicies(req.query) }),
});
define({
  method: 'GET', path: '/master-policies/:id', summary: 'One master policy with the certificates of cover of the customer\'s loans', screen: `${SCREEN} > Master Policy`, middleware: canRead,
  response: { success: true, data: { id: 'clm_1', masterNumber: 'CLMP-2026-000123', borrowerName: 'Juan Dela Cruz', certificates: [member] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getMasterPolicy(req.params.id) }),
});
define({
  method: 'GET', path: '/master-policies/:id/print', summary: 'Master policy schedule (PDF): the customer and the certificates of cover of the loans', screen: `${SCREEN} > Master Policy > Print`, middleware: canRead,
  response: 'application/pdf',
  handler: async (req, res) => {
    const { pdf, number } = await docs.masterPolicyPdf(req.params.id);
    sendPdf(res, pdf, `credit-life-master-${number}.pdf`);
  },
});

export default router;
export const mount = '/credit-life';
