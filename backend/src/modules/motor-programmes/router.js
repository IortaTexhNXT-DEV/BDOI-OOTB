/** Brand-new vehicle programmes API (/motor-programmes): Operations > Sales & Marketing > Dealer Programmes. */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { emailSendingStatus } from '../../lib/mailer.js';
import { uploadFile, parseUploadedRows } from '../documents/tabular.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { buildPdf, buildPdfBatch, sendPdf } from '../documents/pdf.js';
import * as svc from './service.js';
import { bankLetterSpec, batchLetterSpecs } from './letters.js';

const { router, define } = moduleRouter('Dealer programmes', '/motor-programmes');
const SCREEN = 'Operations > Sales & Marketing > Dealer Programmes';
const canRead = [requireAuth, requirePermission('read:motor-programmes', 'write:motor-programmes')];
const canWrite = [requireAuth, requirePermission('write:motor-programmes')];

const text = (n) => z.string().max(n).optional().nullable();
const body = z.object({
  code: z.string().trim().min(1).max(30), name: z.string().trim().min(1).max(200), dealerChannelId: z.string().min(1), bankChannelId: text(40),
  insuranceCompanyId: z.coerce.number().int().optional().nullable(), productId: z.coerce.number().int().optional().nullable(), vehicleType: text(60),
  ownDamageRate: z.coerce.number().min(0).max(100), actsOfNatureRate: z.coerce.number().min(0).max(100).optional(),
  bodilyInjury: z.coerce.number().min(0).optional(), propertyDamage: z.coerce.number().min(0).optional(), includeCtpl: z.boolean().optional(),
  ctplTermYears: z.coerce.number().int().refine((v) => v === 1 || v === 3, 'ctplTermYears must be 1 or 3').optional(),
  freeFirstYear: z.boolean().optional(), subsidyPayer: z.enum(['none', 'dealer', 'bank']).optional(), subsidyType: z.enum(['percent', 'amount', 'full']).optional(),
  subsidyValue: z.coerce.number().min(0).optional(), issueMode: z.enum(['quotation', 'policy']).optional(), mortgageeClause: text(2000),
  effectiveFrom: text(10), effectiveTo: text(10), status: z.enum(['active', 'inactive']).optional(), notes: text(2000),
});
const example = { id: 1, code: 'TOY-BDO-2026', name: 'Toyota Makati x BDO auto loans 2026', dealerChannelId: 'ch_1', dealerName: 'Toyota Makati', bankChannelId: 'ch_2', bankName: 'BDO Unibank',
  insuranceCompanyId: 3, ownDamageRate: 1.5, actsOfNatureRate: 0.5, includeCtpl: true, ctplTermYears: 3, freeFirstYear: true, subsidyPayer: 'dealer', subsidyType: 'full', issueMode: 'policy', status: 'active' };

define({
  method: 'GET', path: '/', summary: 'Brand-new vehicle programmes (filter status, search) with sales and policies counts', screen: SCREEN, middleware: canRead,
  query: { status: 'active' }, response: { success: true, data: [example] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listProgrammes(req.query) }),
});
define({
  method: 'GET', path: '/preview-options', summary: 'Choices of the premium preview: vehicle classes of the motor tariff (with their CTPL) and the LGUs with a tax rate', screen: `${SCREEN} > Programme > Preview`,
  middleware: canRead, response: { success: true, data: { vehicleTypes: [{ value: 'private_cars', label: 'Private cars', ctplPremium: 610.4, ctplPremium3Year: 1660.4 }], lgus: [{ code: 'MKT', name: 'Makati', province: 'Metro Manila', rate: 0.2 }] } },
  handler: async (_req, res) => res.json({ success: true, data: await svc.previewOptions() }),
});
define({
  method: 'GET', path: '/upload-template', summary: 'Dealer Sales upload template (XLSX)', screen: `${SCREEN} > Dealer Sales Upload > Template`, middleware: canRead, response: 'binary file',
  handler: async (_req, res) => sendTemplate(res, 'dealer-sales'),
});
define({
  method: 'GET', path: '/batches', summary: 'Dealer sales uploads (filter programmeId)', screen: `${SCREEN} > Dealer Sales Upload`, middleware: canRead,
  response: { success: true, data: [{ id: 'dsb_1', batchNumber: 'DSB-2026-00001', programmeCode: 'TOY-BDO-2026', rowsTotal: 12, rowsCreated: 11, rowsFailed: 1, status: 'partial' }] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listBatches(req.query) }),
});
define({
  method: 'GET', path: '/batches/:id/bank-letters', summary: 'Bank endorsement letters of a batch in one PDF (optionally of one bank: bankChannelId)', screen: `${SCREEN} > Dealer Sales Upload > Bank Letters`,
  middleware: canRead, query: { bankChannelId: 'ch_2' }, response: 'application/pdf',
  handler: async (req, res) => {
    const specs = await batchLetterSpecs(req.params.id, req.query.bankChannelId || null);
    await audit(req, { entity: 'dealer_sales_batch', entityId: req.params.id, action: 'print-bank-letters', after: { letters: specs.length } });
    sendPdf(res, buildPdfBatch(specs, { title: 'Bank Endorsement Letters' }), `bank-letters-${req.params.id}.pdf`);
  },
});
define({
  method: 'GET', path: '/sales', summary: 'Dealer sales (filter batchId, programmeId, status created / failed, bankChannelId)', screen: `${SCREEN} > Dealer Sales Upload > Sales`, middleware: canRead,
  query: { batchId: 'dsb_1', status: 'failed' },
  response: { success: true, data: [{ id: 'dsl_1', rowNo: 2, buyerName: 'Ramon Villanueva', vehicle: '2026 Toyota Vios 1.3 XLE CVT', invoicePrice: 1015000, grossPremium: 25780.5, buyerShare: 0, payerShare: 25780.5, policyNumber: 'POL-2026-00120', status: 'created' }] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listSales(req.query) }),
});
define({
  method: 'GET', path: '/sales/:id/bank-letter', summary: 'Bank endorsement letter of a financed sale (PDF): the car insured with the bank as mortgagee', screen: `${SCREEN} > Sales > Bank Letter`,
  middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const spec = await bankLetterSpec(req.params.id);
    await audit(req, { entity: 'dealer_sale', entityId: req.params.id, action: 'print-bank-letter' });
    sendPdf(res, buildPdf(spec), `bank-letter-${spec.number || req.params.id}.pdf`);
  },
});
define({
  method: 'POST', path: '/sales/:id/bank-letter/email', summary: 'E-mail the bank endorsement letter to the bank\'s contact (through the e-mail outbox)', screen: `${SCREEN} > Sales > E-mail Bank Letter`,
  middleware: [...canWrite, validate(z.object({ to: z.string().email().optional() }))], request: { to: 'autoloans@bdo.example.ph' },
  response: { success: true, message: 'Bank letter queued', data: { outboxId: 41, to: 'autoloans@bdo.example.ph' } },
  handler: async (req, res) => {
    const out = await svc.emailBankLetter(req.params.id, req.body.to || null);
    if (!out) throw badRequest('The bank has no contact e-mail (Distribution Channels): enter the address to send to');
    const { outboxId, to } = out;
    const s = { id: req.params.id };
    await audit(req, { entity: 'dealer_sale', entityId: s.id, action: 'email-bank-letter', after: { to, outboxId } });
    const sending = await emailSendingStatus();
    res.json({ success: true, message: sending.active ? 'Bank letter queued for sending' : 'Bank letter queued; it goes out once e-mail sending is enabled', data: { outboxId, to } });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'One programme (id or code)', screen: `${SCREEN} > Programme`, middleware: canRead, response: { success: true, data: example },
  handler: async (req, res) => res.json({ success: true, data: await svc.getProgramme(req.params.id) }),
});
const previewQuery = z.object({
  invoicePrice: z.coerce.number().gt(0, 'invoicePrice must be greater than zero').max(999999999999.99), vehicleType: z.string().trim().max(60).optional(),
  lguCode: z.string().trim().max(20).optional(), financed: z.enum(['true', 'false']).optional(),
});
const previewExample = { netPremium: 19500, taxes: 4923.75, ctplPremium: 660.4, grossPremium: 25084.15, commissionAmount: 2925, buyer: 25084.15, payer: 0, payerType: null,
  lines: [{ code: 'lossAndDamageCoveragePremium', kind: 'cover', name: 'Own Damage / Theft', base: 1000000, rate: 1.15, amount: 11500, payer: 0, buyer: 11500 },
    { code: 'DST', kind: 'tax', name: 'Documentary Stamp Tax', base: 19500, rate: 12.5, amount: 2437.5, payer: 0, buyer: 2437.5 }],
  basis: { programmeCode: 'TCB-TFS-2026', sumInsured: 1000000, ownDamageRate: 1.15, actsOfNatureRate: 0.5, vehicleType: 'light_medium_trucks', ctplTermYears: 1, lgu: null, lgtRate: 0.75 } };
define({
  method: 'GET', path: '/:id/premium-preview', screen: `${SCREEN} > Programme > Preview`,
  summary: 'Premium of a car under the programme, priced as the upload\'s quotation, line by line with who pays what (invoicePrice, vehicleType, lguCode, financed), nothing saved',
  middleware: [...canRead, validate(previewQuery, 'query')], query: { invoicePrice: 1000000, vehicleType: 'light_medium_trucks', lguCode: 'MKT' },
  response: { success: true, data: previewExample },
  handler: async (req, res) => {
    const q = req.query;
    res.json({ success: true, data: await svc.previewPremium(req.params.id, { invoicePrice: q.invoicePrice, vehicleType: q.vehicleType || null, lguCode: q.lguCode || null,
      financed: q.financed === undefined ? null : q.financed === 'true' }) });
  },
});
define({
  method: 'POST', path: '/', summary: 'Add a programme (dealer, financing bank, insurer, rates, CTPL, free or subsidised first year and who pays, issue mode)', screen: `${SCREEN} > Add Programme`,
  middleware: [...canWrite, validate(body)], request: { code: 'TOY-BDO-2026', name: 'Toyota Makati x BDO auto loans 2026', dealerChannelId: 'ch_1', bankChannelId: 'ch_2', insuranceCompanyId: 3, ownDamageRate: 1.5,
    includeCtpl: true, ctplTermYears: 3, freeFirstYear: true, subsidyPayer: 'dealer', subsidyType: 'full', issueMode: 'policy' },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const p = await svc.createProgramme(req.body, req.user.id);
    await audit(req, { entity: 'motor_programme', entityId: p.id, action: 'create', after: p });
    res.status(201).json({ success: true, message: 'Programme added', data: p });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change a programme (applies to the next uploads)', screen: `${SCREEN} > Edit Programme`, middleware: [...canWrite, validate(body.partial())],
  request: { subsidyType: 'percent', subsidyValue: 50 }, response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateProgramme(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'motor_programme', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Programme saved', data: after });
  },
});
define({
  method: 'POST', path: '/:id/sales/upload', summary: 'Upload a dealer\'s vehicle sales (multipart field "file", Dealer Sales template): prospects, quotations and, in issue mode policy, the policies',
  screen: `${SCREEN} > Dealer Sales Upload`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
  response: { success: true, data: { batchId: 'dsb_1', batchNumber: 'DSB-2026-00001', total: 12, created: 11, failed: 1, errors: [{ row: 7, message: 'Chassis Number is required' }] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file);
    const out = await svc.uploadSales(req.params.id, rows, { fileName: req.file?.originalname || null, userId: req.user.id });
    await audit(req, { entity: 'dealer_sales_batch', entityId: out.batchId, action: 'upload', after: { ...out, errors: out.errors.slice(0, 50) } });
    res.json({ success: true, message: `Processed ${out.total} sales: ${out.created} created, ${out.failed} failed`, data: out });
  },
});

export default router;
export const mount = '/motor-programmes';
