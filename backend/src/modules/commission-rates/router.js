import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { created, ok } from '../../lib/respond.js';
import { getSetting } from '../../lib/settings.js';
import { importUpload } from '../../lib/uploadLimits.js';
import { CHANNEL_TYPES, POLICY_TYPES, resolveCommissionRate } from './resolve.js';
import { resolveCreditTerms } from './terms.js';
import { PERIL_BASES, PERILS, RATE_BASES, defaultPerilRates } from './perils.js';
import { sendRulesTemplate, uploadRules } from './upload.js';
import * as svc from './service.js';

/**
 * Master > Finance > Commission Rate Matrix: the commission rules register (rules by insurer / product / line of
 * business / policy type / channel type / motor type / sum insured band and date range, with one rate or the issuing,
 * TIS remitting and insurer net rate per peril), the rule approval flow, the Excel upload, the Test rate lookup and the
 * insurer credit terms lookup. Kept by Finance (write:commission-rules) or master administrators (write:masters).
 */
const { router, define } = moduleRouter('Commission Rate Matrix', '/commission-rates');
const SCREEN = 'Master > Finance > Commission Rate Matrix';
const read = [requireAuth, requirePermission('read:masters', 'write:masters', 'read:commission', 'read:commission-rules', 'write:commission-rules')];
const write = [requireAuth, requirePermission('write:masters', 'write:commission-rules')];
const upload = importUpload();
const singleFile = (req, res, next) => upload.single('file')(req, res, (e) => next(e ? badRequest(e.message) : undefined));
const example = {
  id: 1, insuranceCompanyId: 3, insurerName: 'Malayan Insurance Co., Inc.', productId: 1, productName: 'Motor Car', lineOfBusiness: null, policyType: 'new', channelType: null, motorType: 'PC-OTHER',
  rateBasis: 'issuing-remitting', rate: 0, ratePercent: 0, perilRates: [{ peril: 'OD', basis: 'issuing-remitting', issuing: 2, tisRemitting: 1.7, insurerNet: 0.95, commissionPct: 1.05, variance: 0.3 }],
  effectiveFrom: '2026-11-01', effectiveTo: null, active: true, approvalStatus: 'approved', statusLabel: 'Approved', version: 1, level: 'insurer + product + motor type',
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const id = z.coerce.number().int().positive();
const perilRate = z.object({
  peril: z.string().trim().max(10), basis: z.enum(PERIL_BASES).optional(), issuing: z.coerce.number().nullable().optional(), tisRemitting: z.coerce.number().nullable().optional(),
  insurerNet: z.coerce.number().nullable().optional(), commissionPct: z.coerce.number().nullable().optional(),
}).passthrough();
const fields = {
  insuranceCompanyId: id.nullable().optional(),
  productId: id.nullable().optional(),
  lineOfBusiness: z.string().trim().max(40).nullable().optional(),
  policyType: z.enum(POLICY_TYPES).optional(),
  channelType: z.enum(CHANNEL_TYPES).nullable().optional(),
  motorType: z.string().trim().max(20).nullable().optional(),
  siFrom: z.coerce.number().min(0).nullable().optional(),
  siTo: z.coerce.number().min(0).nullable().optional(),
  rateBasis: z.enum(RATE_BASES).optional(),
  rate: z.coerce.number().min(0).max(1).optional(),
  perilRates: z.array(perilRate).optional(),
  effectiveFrom: date,
  effectiveTo: date.nullable().optional(),
  active: z.boolean().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
  submit: z.boolean().optional(),
  changeNote: z.string().trim().max(500).nullable().optional(),
};
const createSchema = z.object(fields).strict();
const updateSchema = z.object({ ...fields, effectiveFrom: date.optional() }).strict();

define({
  method: 'GET', path: '/', summary: 'Commission rules (filters: insuranceCompanyId, productId, lineOfBusiness, policyType, channelType, motorType, status draft | pending | approved | returned | withdrawn | all, active, uploadId, search)', screen: SCREEN,
  middleware: read, query: { insuranceCompanyId: 3, status: 'approved' }, response: { success: true, data: [example] },
  handler: async (req, res) => ok(res, await svc.listRates(req.query)),
});
define({
  method: 'GET', path: '/options', summary: 'Lists of the rule dialog: motor types, channel types, perils with their default basis and rates, whether rule changes are approved', screen: `${SCREEN} > Add rule`,
  middleware: read, response: { success: true, data: { approvalRequired: true, motorTypes: [{ code: 'PC-OTHER', name: 'PC-Other than Sedan' }], channelTypes: [{ code: 'dealer', label: 'Dealer' }], perils: [] } },
  handler: async (req, res) => ok(res, {
    approvalRequired: await svc.approvalRequired(),
    motorTypes: (await getSetting('commission.motor_types', [])) || [],
    channelTypes: CHANNEL_TYPES.map((code) => ({ code, label: svc.CHANNEL_TYPE_LABELS[code] })),
    dualRateLines: (await getSetting('commission.dual_rate_lines', ['motor'])) || [],
    perils: PERILS.map((p) => ({ code: p.code, name: p.name })),
    defaultPerilRates: await defaultPerilRates(),
  }),
});
define({
  method: 'GET', path: '/resolve', summary: 'Test rate: the rule that applies to an insurer / product / line of business / policy type / channel type / motor type / sum insured on a date, its level and peril rates', screen: `${SCREEN} > Test rate`,
  middleware: read, query: { insurerId: 3, productId: 1, lob: 'motor', policyType: 'new', motorType: 'PC-OTHER', date: '2026-11-29' },
  response: { success: true, data: { rate: 0, source: 'matrix', ruleId: 1, level: 'insurer + product + motor type', rateBasis: 'issuing-remitting', perilRates: example.perilRates } },
  handler: async (req, res) => {
    const q = z.object({ insurerId: id.optional(), productId: id.optional(), lob: z.string().max(40).optional(), policyType: z.enum(['new', 'renewal']).optional(),
      channelType: z.enum(CHANNEL_TYPES).optional(), motorType: z.string().max(20).optional(), sumInsured: z.coerce.number().optional(), date: date.optional() }).parse(req.query);
    ok(res, await resolveCommissionRate(q));
  },
});
define({
  method: 'GET', path: '/credit-terms/:insurerId', summary: 'Insurer credit terms with fallbacks: premium payment warranty days, remittance terms days, default billing mode', screen: 'Master > Generals > Insurance Company',
  middleware: read,
  response: { success: true, data: { premiumWarrantyDays: 30, remittanceTermsDays: 30, billingMode: 'broker', source: { premiumWarrantyDays: 'setting', remittanceTermsDays: 'setting', billingMode: 'setting' } } },
  handler: async (req, res) => ok(res, await resolveCreditTerms(req.params.insurerId)),
});
define({
  method: 'GET', path: '/upload/template', summary: 'Download the commission rules upload template (Data, Columns and Instructions sheets)', screen: `${SCREEN} > Upload rules`, middleware: read,
  handler: async (req, res) => sendRulesTemplate(res),
});
define({
  method: 'POST', path: '/upload', summary: 'Upload rules from an .xlsx (one row per peril; rows with the same keys and dates form one rule, each sent for approval): "Processed n rows: c created, f failed" with the failed rows',
  screen: `${SCREEN} > Upload rules`, middleware: [...write, singleFile],
  response: { success: true, data: { uploadId: 'upl_1', processed: 28, created: 26, failed: 2, rules: [12, 13], errors: [{ row: 7, message: 'Row 7: OD: the rates must be insurer net <= TIS remitting <= issuing' }] } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', code: 'FILE_TYPE', message: 'Upload an Excel (.xlsx) file' }]);
    const r = await uploadRules(req.file, req.user);
    await audit(req, { entity: 'commission_rate', entityId: r.uploadId, action: 'upload', after: { file: req.file.originalname, processed: r.processed, created: r.created, failed: r.failed, rules: r.rules } });
    ok(res, r, r.message);
  },
});
define({
  method: 'GET', path: '/:id/history', summary: 'The versions of a rule (each with its rates, maker, approver and dates)', screen: `${SCREEN} > Edit rule > History`, middleware: read,
  response: { success: true, data: [example] },
  handler: async (req, res) => ok(res, await svc.ruleHistory(id.parse(req.params.id))),
});
define({
  method: 'GET', path: '/:id', summary: 'One commission rule', screen: SCREEN, middleware: read,
  response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.getRate(id.parse(req.params.id))),
});
define({
  method: 'POST', path: '/', summary: 'Add a commission rule (insurer, product and / or line of business; motor type, band and issuing vs remitting for Motor only; no overlap with a rule of the same keys). Under review a draft, or pending approval with submit: true; else in force at once', screen: SCREEN,
  middleware: [...write, validate(createSchema)],
  request: { insuranceCompanyId: 3, productId: 1, policyType: 'new', motorType: 'PC-OTHER', rateBasis: 'issuing-remitting', effectiveFrom: '2026-11-01', submit: true,
    perilRates: [{ peril: 'OD', basis: 'issuing-remitting', issuing: 2, tisRemitting: 1.7, insurerNet: 0.95 }, { peril: 'BI', basis: 'premium-pct', commissionPct: 25 }] },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const row = await svc.createRate(req.body, req.user);
    await audit(req, { entity: 'commission_rate', entityId: row.id, action: req.body.submit ? 'submit' : 'create', after: row });
    created(res, row, row.approvalStatus === 'pending' ? 'Commission rule sent for approval' : 'Commission rule added');
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change a commission rule: a draft or returned rule in place; an approved rule as a new version from effectiveFrom (submit: true sends it for approval); same overlap rule', screen: SCREEN,
  middleware: [...write, validate(updateSchema)], request: { effectiveFrom: '2027-01-01', submit: true, perilRates: example.perilRates }, response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateRate(id.parse(req.params.id), req.body, req.user);
    await audit(req, { entity: 'commission_rate', entityId: after.id, action: after.id !== before.id ? 'amend' : 'update', before, after });
    ok(res, after, after.approvalStatus === 'pending' ? 'Commission rule sent for approval' : 'Commission rule saved');
  },
});
define({
  method: 'POST', path: '/:id/submit', summary: 'Submit a draft or returned rule for approval on Configuration Approvals (effective from not before today)', screen: SCREEN,
  middleware: [...write, validate(z.object({ changeNote: z.string().trim().max(500).nullable().optional() }))], request: { changeNote: 'Net rate schedule of November' },
  response: { success: true, data: { ...example, approvalStatus: 'pending', statusLabel: 'Pending approval' } },
  handler: async (req, res) => {
    const row = await svc.submitRate(id.parse(req.params.id), req.user, req.body);
    await audit(req, { entity: 'commission_rate', entityId: row.id, action: 'submit', after: row });
    ok(res, row, 'Commission rule sent for approval');
  },
});
define({
  method: 'POST', path: '/:id/withdraw', summary: 'Withdraw a pending rule (its maker or an approver): the change is withdrawn, the rule is editable again', screen: SCREEN, middleware: write,
  response: { success: true, data: { ...example, approvalStatus: 'withdrawn', statusLabel: 'Withdrawn' } },
  handler: async (req, res) => {
    const row = await svc.withdrawRate(id.parse(req.params.id), req.user);
    await audit(req, { entity: 'commission_rate', entityId: row.id, action: 'withdraw', after: row });
    ok(res, row, 'Commission rule withdrawn');
  },
});
define({
  method: 'POST', path: '/:id/end', summary: 'End an approved rule on a date (sent for approval under review; applied at once otherwise)', screen: SCREEN,
  middleware: [...write, validate(z.object({ effectiveTo: date, changeNote: z.string().trim().max(500).nullable().optional() }))], request: { effectiveTo: '2026-12-31' },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const row = await svc.endRate(id.parse(req.params.id), req.body, req.user);
    await audit(req, { entity: 'commission_rate', entityId: row.id, action: 'end', after: { ...row, requestedEffectiveTo: req.body.effectiveTo } });
    ok(res, row, row.pendingChangeId ? 'Commission rule end sent for approval' : 'Commission rule ended');
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Delete a rule that is not in force (a draft, returned or withdrawn one; under review an approved rule is ended, never deleted)', screen: SCREEN, middleware: write,
  response: { success: true, data: example },
  handler: async (req, res) => {
    const before = await svc.deleteRate(id.parse(req.params.id));
    await audit(req, { entity: 'commission_rate', entityId: before.id, action: 'delete', before });
    ok(res, before, 'Commission rate deleted');
  },
});

export default router;
export const mount = '/commission-rates';
