/** Client comparison and recommendation reports API (/comparison-reports): Operations > Sales & Marketing > Comparison Reports. */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { emailSendingStatus } from '../../lib/mailer.js';
import { getSetting } from '../../lib/settings.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Comparison reports', '/comparison-reports');
const SCREEN = 'Operations > Sales & Marketing > Comparison Reports';
const canRead = [requireAuth, requirePermission('read:quotations', 'write:quotations')];
const canWrite = [requireAuth, requirePermission('write:quotations')];

const text = (n) => z.string().max(n).optional().nullable();
const createBody = z.object({
  brokerSlipId: text(40), quoteIds: z.array(z.string().min(1)).max(10).optional(), preparedFor: text(200), title: text(200), introduction: text(3000),
  recommendedKey: text(60), reasons: z.array(z.string().trim().min(1).max(500)).max(10).optional(), disclaimer: text(3000), highlights: z.record(z.string().max(1000)).optional(),
  criteria: z.array(z.object({ label: z.string().max(100), note: z.string().max(500).optional() })).max(10).optional(),
}).refine((b) => b.brokerSlipId || (b.quoteIds && b.quoteIds.length >= 2), { message: 'Choose a request for quotation or at least two quotations', path: ['brokerSlipId'] });
const updateBody = z.object({
  preparedFor: text(200), title: text(200), introduction: text(3000), recommendedKey: text(60), reasons: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  disclaimer: text(3000), highlights: z.record(z.string().max(1000)).optional(), criteria: z.array(z.object({ label: z.string().max(100), note: z.string().max(500).optional() })).max(10).optional(),
});
const example = { id: 'cmp_1', reportNumber: 'CMP-2026-00008', sourceType: 'broker_slip', brokerSlipNumber: 'BS-2026-00014', preparedFor: 'Visayas Cold Storage Inc.', title: 'Insurance Proposal and Recommendation',
  options: [{ key: 'ofr_1', insurer: 'FPG Insurance Co., Inc.', sumInsured: 25000000, premium: 62500, taxes: 15937.5, grossPremium: 78437.5, deductible: 'PHP 50,000 each loss', rank: 1 }],
  recommendedKey: 'ofr_1', reasons: ['Lowest total premium for the cover requested'], status: 'issued' };

define({
  method: 'GET', path: '/', summary: 'Comparison reports (filter status draft / issued / accepted, brokerSlipId, search)', screen: SCREEN, middleware: canRead,
  query: { status: 'issued' }, response: { success: true, data: [example] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listReports(req.query) }),
});
define({
  method: 'GET', path: '/defaults', summary: 'Default title, introduction, disclaimer and reasons (Configuration, comparison.*)', screen: `${SCREEN} > New Report`, middleware: canRead,
  response: { success: true, data: { title: 'Insurance Proposal and Recommendation', reasons: ['Lowest total premium for the cover requested'] } },
  handler: async (_req, res) => res.json({ success: true, data: {
    title: (await getSetting('comparison.report_title', null)) || '', introduction: (await getSetting('comparison.introduction', null)) || '', disclaimer: (await getSetting('comparison.disclaimer', null)) || '',
    reasons: (await getSetting('comparison.default_reasons', [])) || [] } }),
});
define({
  method: 'GET', path: '/:id', summary: 'One comparison report', screen: `${SCREEN} > Report`, middleware: canRead, response: { success: true, data: example },
  handler: async (req, res) => res.json({ success: true, data: await svc.getReport(req.params.id) }),
});
define({
  method: 'POST', path: '/', summary: 'Prepare a comparison report from the offers of a request for quotation or from two or more quotations of the same prospect or client', screen: `${SCREEN} > New Report`,
  middleware: [...canWrite, validate(createBody)], request: { brokerSlipId: 'bs_1', recommendedKey: 'ofr_1', reasons: ['Lowest total premium for the cover requested', 'Fast claims service in the Visayas'] },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await svc.createReport(req.body, req.user.id);
    await audit(req, { entity: 'comparison_report', entityId: r.id, action: 'create', after: r });
    res.status(201).json({ success: true, message: `Comparison report ${r.reportNumber} prepared`, data: r });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change the recommendation, reasons, wording or highlights of a report', screen: `${SCREEN} > Report > Edit`, middleware: [...canWrite, validate(updateBody)],
  request: { recommendedKey: 'ofr_2', reasons: ['Broadest cover and lowest deductible among the offers'] }, response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateReport(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'comparison_report', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Report saved', data: after });
  },
});
define({
  method: 'GET', path: '/:id/pdf', summary: 'The client report (PDF): letterhead, comparison table, recommended option and the reasons, disclaimer; no commission', screen: `${SCREEN} > Report > Print`,
  middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const spec = await svc.comparisonReportSpec(req.params.id);
    await svc.markIssued((await svc.getReportRow(req.params.id)).id);
    await audit(req, { entity: 'comparison_report', entityId: req.params.id, action: 'print' });
    sendPdf(res, buildPdf(spec), `comparison-report-${spec.number}.pdf`);
  },
});
define({
  method: 'POST', path: '/:id/email', summary: 'E-mail the report to the client (PDF attached, through the e-mail outbox)', screen: `${SCREEN} > Report > E-mail`,
  middleware: [...canWrite, validate(z.object({ to: z.string().email().optional() }))], request: { to: 'finance@visayascold.example.ph' },
  response: { success: true, data: { outboxId: 52, to: 'finance@visayascold.example.ph' } },
  handler: async (req, res) => {
    const out = await svc.emailReport(req.params.id, req.body.to || null, req.user.id);
    await audit(req, { entity: 'comparison_report', entityId: req.params.id, action: 'email', after: out });
    const sending = await emailSendingStatus();
    res.json({ success: true, message: sending.active ? `Report queued to ${out.to}` : `Report queued to ${out.to}; it goes out once e-mail sending is enabled`, data: out });
  },
});
define({
  method: 'POST', path: '/:id/accept', summary: 'Record the option the client chose', screen: `${SCREEN} > Report > Client Decision`, middleware: [...canWrite, validate(z.object({ chosenKey: z.string().min(1) }))],
  request: { chosenKey: 'ofr_1' }, response: { success: true, data: { ...example, status: 'accepted', chosenKey: 'ofr_1' } },
  handler: async (req, res) => {
    const r = await svc.acceptReport(req.params.id, req.body.chosenKey, req.user.id);
    await audit(req, { entity: 'comparison_report', entityId: r.id, action: 'accept', after: { chosenKey: r.chosenKey } });
    res.json({ success: true, message: 'Client decision recorded', data: r });
  },
});

export default router;
export const mount = '/comparison-reports';
