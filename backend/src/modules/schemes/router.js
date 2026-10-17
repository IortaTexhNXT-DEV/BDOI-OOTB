/**
 * Scheme Master API (/schemes, Operations > Sales & Marketing > Scheme Master): TIS-BRD-SCHM-02, CR-05. The register,
 * its approval and life cycle, the vehicle lines upload, the premium preview and the scheme kept on a policy.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { today } from '../../lib/dates.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { normKey, uploadFile } from '../documents/tabular.js';
import { readXlsx } from '../documents/xlsx.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { printContext } from '../documents/pdf.js';
import { excelBrand } from '../reports/service.js';
import { badRequest } from '../../lib/errors.js';
import * as svc from './service.js';
import { previewPremiums } from './rating.js';
import { policySchemePanel } from './panel.js';

const { router, define } = moduleRouter('Scheme Master', '/schemes');
const SCREEN = 'Sales & Placement > Scheme Master';
const canRead = [requireAuth, requirePermission('read:schemes', 'write:schemes', 'approve:schemes')];
const canWrite = [requireAuth, requirePermission('write:schemes')];
const canApprove = [requireAuth, requirePermission('approve:schemes')];

const opt = (t) => t.optional().nullable();
const numberish = z.union([z.null(), z.literal(''), z.coerce.number()]).optional();
const peril = z.object({ code: z.string().max(10), included: z.boolean().optional(), rate: numberish, premium: numberish, limit: numberish }).passthrough();
const line = z.object({ brandId: numberish, make: opt(z.string().max(80)), modelId: numberish, model: opt(z.string().max(80)), variantId: numberish, variant: opt(z.string().max(120)),
  yearFrom: z.coerce.number().int(), yearTo: z.coerce.number().int().optional(), siFrom: z.coerce.number(), siTo: z.coerce.number(), vehicleClass: opt(z.string().max(60)),
  odRate: numberish, aonRate: numberish }).passthrough();
const body = z.object({
  schemeNo: opt(z.string().max(40)), schemeType: opt(z.enum(['scheme1', 'scheme2'])), description: opt(z.string().max(400)), effectiveFrom: opt(z.string().max(10)),
  effectiveTo: opt(z.string().max(10)), bankChannelId: opt(z.string().max(40)), allDealers: z.boolean().optional(), dealerChannelIds: z.array(z.string().max(40)).optional(),
  insurerIds: z.array(z.coerce.number().int()).optional(), notes: opt(z.string().max(2000)), productId: numberish, vehicleClasses: z.array(z.string().max(60)).optional(),
  odDeductible: numberish, perils: z.array(peril).max(20).optional(), commissionPct: numberish, dealerCommissionPct: numberish, termYears: numberish,
  year1PaidBy: opt(z.enum(['dealer', 'client-ada', 'client-ma'])), siSchedule: z.array(z.union([z.null(), z.literal(''), z.coerce.number()])).max(10).optional(),
  lines: z.array(line).max(5000).optional(),
}).passthrough();
const remark = validate(z.object({ note: opt(z.string().max(2000)), reasonCode: opt(z.string().max(40)) }));

const perilExample = { code: 'OD', name: 'Own Damage / Theft', basis: 'si-pct', mandatory: true, included: true, rate: 2, premium: null, limit: null };
const lineExample = { lineNo: 1, brandId: 1, brand: 'Toyota', modelId: 4, model: 'Vios', variantId: null, variant: null, vehicle: 'Toyota Vios, All variants', yearFrom: 2026, yearTo: 2027,
  siFrom: 500000, siTo: 1300000, vehicleClass: 'private_cars', odRate: null, aonRate: null, check: 'OK' };
const example = { id: 'sch_1', schemeNo: 'S1-STD-2027', version: 1, schemeType: 'scheme1', schemeTypeLabel: 'Scheme 1 - Lock-in (Auto Renewal Agreement)', description: 'Scheme 1 standard 2027',
  effectiveFrom: '2027-01-01', effectiveTo: '2027-12-31', bankChannelId: 'ch_seed_tfs', bankName: 'Toyota Financial Services Philippines Corporation', allDealers: true, insurerIds: [2, 3],
  productId: 2, vehicleClasses: ['private_cars'], perils: [perilExample], commissionPct: 25, dealerCommissionPct: 85, tisphPct: 15, termYears: 5, year1PaidBy: 'dealer',
  siSchedule: [100, 90, 80, 70, 60], status: 'draft', statusLabel: 'Draft', lineCount: 14,
  equivalents: { ownDamageRate: 2, commission: 0.5, remitting: 1.5, dealer: 0.425, tisph: 0.075, tisphPct: 15 } };

define({
  method: 'GET', path: '/', summary: 'Schemes (status or tab expired-withdrawn, search Scheme No. or description, schemeType, dealerChannelId, insurerId, inForceOn); superseded versions left out',
  screen: SCREEN, middleware: canRead, query: { status: 'active', search: 'S1', inForceOn: '2027-03-15' }, response: { success: true, data: [example], counts: { all: 4, active: 2 } },
  handler: async (req, res) => res.json({ success: true, data: await svc.listSchemes(req.query), counts: await svc.statusCounts() }),
});
define({
  method: 'GET', path: '/choices', summary: 'Choices of the scheme form: Motor products and their peril table, vehicle classes, limits, vehicles of the Vehicle master, scheme types, standard rates, term settings',
  screen: SCREEN, middleware: canRead,
  response: { success: true, data: { products: [{ value: 2, label: 'Motor Vehicle Insurance' }], vehicleClasses: [{ value: 'private_cars', label: 'Private cars' }], perils: { 2: [perilExample] },
    limits: { bi: [100000], pd: [100000], appa: [25000, 50000] }, schemeTypes: [{ value: 'scheme1', label: 'Scheme 1 - Lock-in (Auto Renewal Agreement)' }], standardRates: { ownDamage: 2, actsOfNature: 0.5 },
    maxTermYears: 5, defaultTermYears: 5, defaultSchedule: [100, 90, 80, 70, 60] } },
  handler: async (_req, res) => res.json({ success: true, data: await svc.schemeChoices() }),
});
define({
  method: 'GET', path: '/export', summary: 'Excel of the listed schemes (same filters as the list): one sheet of schemes, one of perils, one of vehicle lines, with the brand logo',
  screen: `${SCREEN} > Export`, middleware: canRead, query: { status: 'active' }, response: 'binary file',
  handler: async (req, res) => {
    const sheets = await svc.exportSheets(req.query);
    const ctx = await printContext();
    const banner = [ctx.letterhead?.name, 'Scheme Master', `As at ${ctx.generatedAt}`].filter(Boolean);
    const buf = writeXlsx({ title: 'Scheme Master', brand: excelBrand(ctx), dateFormat: ctx.format?.dateFormat, sheets: sheets.map((s, i) => (i === 0 ? { ...s, banner, logo: true } : s)) });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="scheme-master-${(await today()).replace(/-/g, '')}.xlsx"`);
    res.send(buf);
  },
});
define({
  method: 'GET', path: '/lines/template', summary: 'Upload vehicle lines template (XLSX: Data, Columns, Instructions)', screen: `${SCREEN} > Upload vehicle lines > Download template`,
  middleware: canRead, response: 'binary file', handler: async (_req, res) => sendTemplate(res, 'scheme-vehicle-lines'),
});
define({
  method: 'POST', path: '/lines/upload', summary: 'Upload vehicle lines from Excel (multipart "file"; fields schemeId and mode add | replace): rows checked and added one by one, Replace only when a row is valid',
  screen: `${SCREEN} > Upload vehicle lines`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file, schemeId, mode',
  response: { success: true, message: 'Processed 14 rows: 12 created, 2 failed', data: { total: 14, created: 12, failed: 2, errors: [{ row: 7, message: 'Year model to must be on or after Year model from', text: 'Row 7: Year model to must be on or after Year model from' }] } },
  handler: async (req, res) => {
    const name = req.file?.originalname || '';
    if (!req.file?.buffer?.length) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file' }]);
    if (!name.toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file' }]);
    let table;
    try { table = readXlsx(req.file.buffer); } catch (e) { throw badRequest(`Could not read the file: ${e.message}`); }
    const headers = (table[0] || []).map(normKey);
    const rows = table.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
    const out = await svc.uploadLines({ rows, headers, schemeId: req.body?.schemeId || null, mode: req.body?.mode || 'add', fileName: name }, req.user);
    await audit(req, { entity: 'scheme', entityId: req.body?.schemeId || out.schemes.join(','), action: 'upload-lines', after: { mode: req.body?.mode || 'add', ...out, errors: out.errors.slice(0, 50) } });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/policies/:policyId', summary: 'Scheme panel of a policy: scheme, version, vehicle line, policy year of the term, sums insured, rates, commission, dealer and TISPH shares, and the issuance data (application, loan, KYC source, ARA, waived documents)',
  screen: 'Policy Servicing > Policy > Policy detail > Scheme', middleware: [requireAuth, requirePermission('read:policies')],
  response: { success: true, data: { schemeNo: 'S1-STD-2027', version: 1, lineNo: 1, policyYear: 1, termYears: 5, label: 'S1-STD-2027 v1, line 1, Year 1 of 5', commission: 6781.25, dealerShare: 5764.06, tisphShare: 1017.19 } },
  handler: async (req, res) => res.json({ success: true, data: await policySchemePanel(req.params.policyId) }),
});
define({
  method: 'GET', path: '/:id', summary: 'A scheme version with its perils, vehicle lines (with their check), equivalent rates, warnings, versions (History), the changes from the version before and the policies in force',
  screen: SCREEN, middleware: canRead, response: { success: true, data: { ...example, lines: [lineExample], warnings: [], versions: [example], changes: null, policiesInForce: 0 } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getScheme(req.params.id) }),
});
define({
  method: 'GET', path: '/:id/preview', summary: 'Premium preview of a scheme (Draft or approved) for a vehicle and year-1 sum insured: every year of the term with the main perils, NET Premium, taxes, CTPL, gross premium, commission and dealer share; nothing saved',
  screen: `${SCREEN} > Premium preview`, middleware: canRead, query: { make: 'Toyota', model: 'Vios', variant: '1.3 XLE CVT', yearModel: 2026, sumInsured: 1000000, insurerId: 2 },
  response: { success: true, data: { schemeNo: 'S1-STD-2027', version: 1, lineNo: 1, years: [{ year: 1, sumInsured: 1000000, netPremium: 27125, vat: 3255, dst: 3391, lgt: 203.44, ctpl: 1660.4, grossPremium: 35634.84, commission: 6781.25, dealerShare: 5764.06 }] } },
  handler: async (req, res) => {
    const q = req.query;
    res.json({ success: true, data: await previewPremiums(req.params.id, { make: q.make, model: q.model, variant: q.variant, brandId: q.brandId, modelId: q.modelId, variantId: q.variantId,
      yearModel: q.yearModel, sumInsured: Number(q.sumInsured), insurerId: q.insurerId ? Number(q.insurerId) : null }) });
  },
});
define({
  method: 'POST', path: '/', summary: 'Save a new scheme as Draft, version 1 (General, Products & perils, Vehicles, Commission & term)', screen: `${SCREEN} > Add scheme`,
  middleware: [...canWrite, validate(body)], request: { ...example, lines: [lineExample] }, response: { success: true, message: 'Scheme saved', data: example },
  handler: async (req, res) => {
    const s = await svc.createScheme(req.body, req.user);
    await audit(req, { entity: 'scheme', entityId: s.id, action: 'create', after: s });
    res.status(201).json({ success: true, message: 'Scheme saved', data: s, warnings: s.warnings });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change a Draft version (an approved version is amended instead)', screen: `${SCREEN} > Edit scheme`, middleware: [...canWrite, validate(body)],
  request: { perils: [perilExample] }, response: { success: true, message: 'Scheme saved', data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateScheme(req.params.id, req.body, req.user);
    await audit(req, { entity: 'scheme', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Scheme saved', data: after, warnings: after.warnings });
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Delete a Draft version 1 that was never submitted (its maker only)', screen: SCREEN, middleware: canWrite, response: { success: true, message: 'Scheme deleted' },
  handler: async (req, res) => {
    const s = await svc.deleteScheme(req.params.id, req.user);
    await audit(req, { entity: 'scheme', entityId: s.id, action: 'delete', before: s });
    res.json({ success: true, message: 'Scheme deleted' });
  },
});
define({
  method: 'POST', path: '/:id/copy', summary: 'Copy a scheme into a new Draft with every tab copied, under a new Scheme No. and dates', screen: `${SCREEN} > Copy`,
  middleware: [...canWrite, validate(z.object({ schemeNo: z.string().max(40), description: opt(z.string().max(400)), effectiveFrom: opt(z.string().max(10)), effectiveTo: opt(z.string().max(10)) }))],
  request: { schemeNo: 'S1-MMG-2027', effectiveFrom: '2027-01-01', effectiveTo: '2027-12-31' }, response: { success: true, message: 'Scheme saved', data: example },
  handler: async (req, res) => {
    const s = await svc.copyScheme(req.params.id, req.body, req.user);
    await audit(req, { entity: 'scheme', entityId: s.id, action: 'copy', after: { ...s, copiedFrom: req.params.id } });
    res.status(201).json({ success: true, message: 'Scheme saved', data: s });
  },
});
const act = (action, message, fn) => async (req, res) => {
  const out = await fn(req);
  const s = out.scheme || out;
  await audit(req, { entity: 'scheme', entityId: s.id, action, before: out.before || undefined,
    after: { schemeNo: s.schemeNo, version: s.version, status: s.status, note: req.body?.note || null, reasonCode: req.body?.reasonCode || null } });
  const extra = out.policiesInForce ? { warning: `${out.policiesInForce} policies are in force on this scheme; they keep it to the end of their term` } : {};
  res.json({ success: true, message, data: s, ...extra });
};
define({
  method: 'POST', path: '/:id/submit', summary: 'Submit a Draft for approval: every check of the four tabs must pass; an item is raised in My Work > Approvals', screen: SCREEN, middleware: canWrite,
  request: {}, response: { success: true, message: 'Scheme submitted for approval', data: { ...example, status: 'pending-approval' } },
  handler: act('submit', 'Scheme submitted for approval', (req) => svc.submitScheme(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/:id/recall', summary: 'Recall an own submitted scheme to Draft before it is actioned', screen: SCREEN, middleware: canWrite,
  request: {}, response: { success: true, message: 'Scheme recalled', data: { ...example, status: 'draft' } },
  handler: act('recall', 'Scheme recalled', (req) => svc.recallScheme(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/:id/approve', summary: 'Approve a submitted scheme (approve:schemes, never its maker): Scheduled or Active', screen: `${SCREEN} > Approve`,
  middleware: [...canApprove, remark], request: { note: 'Rates agreed with the insurers' }, response: { success: true, message: 'Scheme approved', data: { ...example, status: 'scheduled' } },
  handler: act('approve', 'Scheme approved', (req) => svc.decideScheme(req.params.id, { decision: 'approve', note: req.body?.note }, req.user)),
});
define({
  method: 'POST', path: '/:id/return', summary: 'Return a submitted scheme to Draft with a remark (approve:schemes, never its maker)', screen: `${SCREEN} > Return`,
  middleware: [...canApprove, remark], request: { note: 'Commission % to be agreed with TIS Sales' }, response: { success: true, message: 'Scheme returned to the maker', data: example },
  handler: act('return', 'Scheme returned to the maker', (req) => svc.decideScheme(req.params.id, { decision: 'return', note: req.body?.note, reasonCode: req.body?.reasonCode }, req.user)),
});
for (const [action, message] of [['suspend', 'Scheme suspended'], ['resume', 'Scheme resumed'], ['withdraw', 'Scheme withdrawn']]) {
  define({
    method: 'POST', path: `/:id/${action}`, summary: `${message.split(' ')[1].replace(/^./, (c) => c.toUpperCase())} the scheme with a remark (approve:schemes); policies already issued keep their scheme`,
    screen: `${SCREEN} > ${action.replace(/^./, (c) => c.toUpperCase())}`, middleware: [...canApprove, remark], request: { note: 'Rate disputed with the insurer' },
    response: { success: true, message, data: example, warning: '3 policies are in force on this scheme; they keep it to the end of their term' },
    handler: act(action, message, (req) => svc.changeSchemeStatus(req.params.id, action, req.body || {}, req.user)),
  });
}
define({
  method: 'POST', path: '/:id/amend', summary: 'Amend a scheme in force as the next version in Draft (the current version stays in force until the new one is approved)', screen: `${SCREEN} > Amend`,
  middleware: canWrite, request: {}, response: { success: true, message: 'Version 2 created as Draft', data: { ...example, version: 2 } },
  handler: async (req, res) => {
    const s = await svc.amendScheme(req.params.id, req.user);
    await audit(req, { entity: 'scheme', entityId: s.id, action: 'amend', after: { schemeNo: s.schemeNo, version: s.version, status: s.status, amendedFrom: req.params.id } });
    res.status(201).json({ success: true, message: `Version ${s.version} created as Draft`, data: s });
  },
});
define({
  method: 'POST', path: '/:id/discard', summary: 'Discard the Draft version of an amendment (the version in force is unchanged)', screen: `${SCREEN} > Amend`, middleware: canWrite,
  request: {}, response: { success: true, message: 'Draft version discarded' },
  handler: async (req, res) => {
    const s = await svc.discardVersion(req.params.id, req.user);
    await audit(req, { entity: 'scheme', entityId: s.id, action: 'discard', before: s });
    res.json({ success: true, message: 'Draft version discarded' });
  },
});

export default router;
export const mount = '/schemes';
