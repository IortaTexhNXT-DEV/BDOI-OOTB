/** Marketing campaigns API (/campaigns): Operations > Sales & Marketing > Campaigns, and the public opt-out link. */
import express from 'express';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { emailSendingStatus } from '../../lib/mailer.js';
import { companyName } from '../../lib/letterhead.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Campaigns', '/campaigns');
const SCREEN = 'Operations > Sales & Marketing > Campaigns';
const canRead = [requireAuth, requirePermission('read:campaigns', 'write:campaigns')];
const canWrite = [requireAuth, requirePermission('write:campaigns')];

const text = (n) => z.string().max(n).optional().nullable();
const criteria = z.object({
  partyType: z.enum(['client', 'lead', 'both']).optional(), lob: text(40), province: text(120), city: text(120), channelId: text(40), clientType: text(40), leadStatus: text(40),
  expiringWithinDays: z.coerce.number().int().min(0).max(366).optional().nullable(), hasActivePolicy: z.boolean().optional(),
});
const segmentBody = z.object({ name: z.string().trim().min(1).max(120), description: text(500), criteria: criteria.optional(), status: z.enum(['active', 'inactive']).optional() });
const templateBody = z.object({ code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), subject: z.string().trim().min(1).max(200),
  bodyHtml: z.string().trim().min(1).max(50000), status: z.enum(['active', 'inactive']).optional() });
const campaignBody = z.object({ name: z.string().trim().min(1).max(200), segmentId: z.coerce.number().int(), templateId: z.coerce.number().int(), notes: text(2000) });
const segment = { id: 1, name: 'Motor clients in Metro Manila renewing in 60 days', criteria: { partyType: 'client', lob: 'MOTOR', province: 'Metro Manila', expiringWithinDays: 60 }, status: 'active' };
const template = { id: 1, code: 'MOTOR-RENEW', name: 'Motor renewal reminder', subject: 'Your car insurance renews soon, {{firstName}}', bodyHtml: '<p>Dear {{firstName}},</p><p>...</p><p><a href="{{optOutLink}}">Unsubscribe</a></p>', status: 'active' };
const campaign = { id: 'cpg_1', campaignNumber: 'CPG-2026-0003', name: 'October motor renewals', segmentName: segment.name, templateName: template.name, status: 'sent', recipients: 182, excluded: 41 };

define({
  method: 'GET', path: '/segments', summary: 'Campaign segments', screen: `${SCREEN} > Segments`, middleware: canRead, response: { success: true, data: [segment] },
  handler: async (_req, res) => res.json({ success: true, data: await svc.listSegments() }),
});
define({
  method: 'POST', path: '/segments/preview', summary: 'Who a segment reaches: total, consenting recipients with an e-mail, the excluded by reason', screen: `${SCREEN} > Segments > Preview`,
  middleware: [...canRead, validate(z.object({ criteria }))], request: { criteria: segment.criteria },
  response: { success: true, data: { total: 223, eligible: 182, excluded: { 'No marketing consent recorded': 30, 'No valid e-mail address': 11 }, sample: [{ partyType: 'client', name: 'Maria Santos', email: 'maria.santos@example.ph' }] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.previewSegment(req.body.criteria) }),
});
define({
  method: 'POST', path: '/segments', summary: 'Add a segment (clients, prospects or both; line, province, city, channel, client type, prospect status, policies expiring within days)', screen: `${SCREEN} > Segments > Add`,
  middleware: [...canWrite, validate(segmentBody)], request: segment, response: { success: true, data: segment },
  handler: async (req, res) => {
    const { after } = await svc.saveSegment(null, req.body, req.user.id);
    await audit(req, { entity: 'campaign_segment', entityId: after.id, action: 'create', after });
    res.status(201).json({ success: true, message: 'Segment added', data: after });
  },
});
define({
  method: 'PUT', path: '/segments/:id', summary: 'Change a segment', screen: `${SCREEN} > Segments > Edit`, middleware: [...canWrite, validate(segmentBody.partial())],
  request: { criteria: { partyType: 'both', province: 'Cebu' } }, response: { success: true, data: segment },
  handler: async (req, res) => {
    const { before, after } = await svc.saveSegment(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'campaign_segment', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Segment saved', data: after });
  },
});
define({
  method: 'GET', path: '/templates', summary: 'Campaign e-mail templates', screen: `${SCREEN} > Templates`, middleware: canRead, response: { success: true, data: [template] },
  handler: async (_req, res) => res.json({ success: true, data: await svc.listTemplates() }),
});
define({
  method: 'POST', path: '/templates', summary: 'Add an e-mail template ({{firstName}}, {{fullName}}, {{companyName}}, {{optOutLink}})', screen: `${SCREEN} > Templates > Add`,
  middleware: [...canWrite, validate(templateBody)], request: template, response: { success: true, data: template },
  handler: async (req, res) => {
    const { after } = await svc.saveTemplate(null, req.body, req.user.id);
    await audit(req, { entity: 'campaign_template', entityId: after.id, action: 'create', after });
    res.status(201).json({ success: true, message: 'Template added', data: after });
  },
});
define({
  method: 'PUT', path: '/templates/:id', summary: 'Change an e-mail template', screen: `${SCREEN} > Templates > Edit`, middleware: [...canWrite, validate(templateBody.partial())],
  request: { subject: 'Renew your car insurance with us, {{firstName}}' }, response: { success: true, data: template },
  handler: async (req, res) => {
    const { before, after } = await svc.saveTemplate(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'campaign_template', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Template saved', data: after });
  },
});
define({
  method: 'POST', path: '/templates/:id/preview', summary: 'The template filled in for a sample recipient (subject and HTML)', screen: `${SCREEN} > Templates > Preview`, middleware: canRead,
  response: { success: true, data: { subject: 'Your car insurance renews soon, Maria', html: '<p>Dear Maria,</p>' } },
  handler: async (req, res) => {
    const t = await svc.getTemplate(req.params.id);
    res.json({ success: true, data: await svc.renderMessage(t, { first_name: 'Maria', name: 'Maria Santos' }, '#opt-out-link') });
  },
});
define({
  method: 'GET', path: '/', summary: 'Campaigns (filter status draft / scheduled / sent / cancelled)', screen: SCREEN, middleware: canRead, query: { status: 'sent' }, response: { success: true, data: [campaign] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listCampaigns(req.query) }),
});
define({
  method: 'POST', path: '/', summary: 'Prepare a campaign (segment and template)', screen: `${SCREEN} > New Campaign`, middleware: [...canWrite, validate(campaignBody)],
  request: { name: 'October motor renewals', segmentId: 1, templateId: 1 }, response: { success: true, data: { ...campaign, status: 'draft' } },
  handler: async (req, res) => {
    const c = await svc.createCampaign(req.body, req.user.id);
    await audit(req, { entity: 'campaign', entityId: c.id, action: 'create', after: c });
    res.status(201).json({ success: true, message: `Campaign ${c.campaignNumber} prepared`, data: c });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change a draft or scheduled campaign', screen: `${SCREEN} > Campaign > Edit`, middleware: [...canWrite, validate(campaignBody.partial())],
  request: { templateId: 2 }, response: { success: true, data: campaign },
  handler: async (req, res) => {
    const { before, after } = await svc.updateCampaign(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'campaign', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Campaign saved', data: after });
  },
});
define({
  method: 'POST', path: '/:id/schedule', summary: 'Schedule a campaign (sent by the campaign-dispatch job at that time)', screen: `${SCREEN} > Campaign > Schedule`,
  middleware: [...canWrite, validate(z.object({ scheduledAt: z.string().min(10) }))], request: { scheduledAt: '2026-10-15T01:00:00Z' }, response: { success: true, data: { ...campaign, status: 'scheduled' } },
  handler: async (req, res) => {
    const c = await svc.scheduleCampaign(req.params.id, req.body.scheduledAt, req.user.id);
    await audit(req, { entity: 'campaign', entityId: c.id, action: 'schedule', after: { scheduledAt: c.scheduledAt } });
    res.json({ success: true, message: 'Campaign scheduled', data: c });
  },
});
define({
  method: 'POST', path: '/:id/send', summary: 'Send now: consenting recipients with an e-mail are queued to the outbox, the others recorded as excluded', screen: `${SCREEN} > Campaign > Send`, middleware: canWrite,
  response: { success: true, data: { campaignNumber: 'CPG-2026-0003', queued: 182, excluded: 41 } },
  handler: async (req, res) => {
    const out = await svc.dispatchCampaign(req.params.id, req.user.id);
    await audit(req, { entity: 'campaign', entityId: req.params.id, action: 'send', after: out });
    const sending = await emailSendingStatus();
    res.json({ success: true, message: `${out.queued} e-mail(s) queued, ${out.excluded} excluded${sending.active ? '' : '; they go out once e-mail sending is enabled'}`, data: out });
  },
});
define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel a draft or scheduled campaign', screen: `${SCREEN} > Campaign > Cancel`, middleware: canWrite, response: { success: true, data: { ...campaign, status: 'cancelled' } },
  handler: async (req, res) => {
    const c = await svc.cancelCampaign(req.params.id, req.user.id);
    await audit(req, { entity: 'campaign', entityId: c.id, action: 'cancel' });
    res.json({ success: true, message: 'Campaign cancelled', data: c });
  },
});
define({
  method: 'GET', path: '/:id/results', summary: 'Campaign results: sent, queued, failed (e-mail outbox), excluded by reason, opted out, quoted and insured within the conversion window', screen: `${SCREEN} > Campaign > Results`,
  middleware: canRead, response: { success: true, data: { totals: { recipients: 182, sent: 176, failed: 6, excluded: 41, optedOut: 3, quoted: 21, insured: 9 } } },
  handler: async (req, res) => res.json({ success: true, data: await svc.campaignResults(req.params.id) }),
});

// ---------- public opt-out link (no sign-in) ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const page = (company, title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#f3f6f9;color:#1a1a1a;margin:0;padding:24px}main{max-width:520px;margin:40px auto;background:#fff;border:1px solid #d8dee4;border-radius:6px;padding:28px}
h1{font-size:20px;margin:0 0 12px}p{line-height:1.5}button{background:#1f4e79;color:#fff;border:0;border-radius:4px;padding:10px 18px;font-size:15px;cursor:pointer}small{color:#5f6b76}</style></head>
<body><main><small>${esc(company)}</small><h1>${esc(title)}</h1>${body}</main></body></html>`;

define({
  method: 'GET', path: '/opt-out/:token', auth: false, summary: 'Public opt-out page of a campaign e-mail (asks to confirm; nothing changes until confirmed)', screen: 'Campaign e-mail > Unsubscribe link',
  response: 'text/html',
  handler: async (req, res) => {
    const company = await companyName();
    res.type('html').send(page(company, 'Stop marketing e-mails', `<p>Confirm that you no longer wish to receive offers and news by e-mail from ${esc(company)}. You will still receive e-mails about your policies and claims.</p>
      <form method="post" action=""><button type="submit">Unsubscribe</button></form>`));
  },
});
define({
  method: 'POST', path: '/opt-out/:token', auth: false, middleware: [express.urlencoded({ extended: false })], summary: 'Confirm the opt-out: records a refusal of the marketing purpose in the consent register (channel E-mail)',
  screen: 'Campaign e-mail > Unsubscribe link', response: 'text/html',
  handler: async (req, res) => {
    const company = await companyName();
    try {
      const out = await svc.optOut(req.params.token);
      await audit(req, { entity: 'campaign_recipient', entityId: out.recipientId, action: 'opt-out', after: { campaign: out.campaignNumber, already: out.already } });
      res.type('html').send(page(company, 'You are unsubscribed', '<p>We have recorded your choice. You will not receive marketing e-mails from us any more.</p>'));
    } catch (e) {
      res.status(e.status || 400).type('html').send(page(company, 'Link not valid', `<p>${esc(e.message)}</p>`));
    }
  },
});

export default router;
export const mount = '/campaigns';
