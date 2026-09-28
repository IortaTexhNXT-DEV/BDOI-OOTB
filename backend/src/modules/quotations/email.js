/**
 * E-mail actions of the quote Share dialog (quoteDetailView/Modal/ShareOption.jsx). Every message goes through the
 * outbox (queueEmail) and is recorded in the audit log against the quotation.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { queueEmail } from '../../lib/mailer.js';
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { renderTemplate, emailTemplate, num } from '../documents/common.js';
import { getQuoteRow } from './service.js';

const { router, define } = moduleRouter('E-mail', '/email');
const SCREEN = 'Operations > Quotation > Quote detail > Share';
const canSend = [requireAuth, requirePermission('write:quotations')];
const money = (v) => num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function quoteVars(q, extra = {}) {
  return {
    companyName: await getSetting('general.company_name', ''), quotationNumber: q.quote_number, productType: q.product_type || q.lob,
    customerName: [q.lead_row?.first_name, q.lead_row?.last_name].filter(Boolean).join(' ') || q.lead_row?.company_name || 'Customer',
    grossPremium: money(q.premium_total), netPremium: money(q.premium_base), sumInsured: money(q.sum_insured), currency: q.currency,
    validUntil: q.valid_until || '', insurerName: q.insurer_name || '', ...extra,
  };
}

define({
  method: 'POST', path: '/generate', summary: 'Generate e-mail content (subject, preview, html, text) for a quote from the configured template', screen: SCREEN,
  middleware: canSend, request: { template: 'custom', context: { quotationNumber: 'QT-2026-00001', productType: 'Motor', grossPremium: 23171.25, customMessage: 'Please review' }, recipient: { email: 'juan@example.com', name: 'Juan' } },
  response: { success: true, data: { subject: 'Your Motor quotation QT-2026-00001', previewText: '...', html: '<p>...</p>', text: '...' } },
  handler: async (req, res) => {
    const { context = {}, recipient = {} } = req.body || {};
    const t = await emailTemplate('share_quote');
    const v = { companyName: await getSetting('general.company_name', ''), customerName: recipient.name || 'Customer', quotationNumber: context.quotationNumber || '',
      productType: context.productType || '', grossPremium: money(context.grossPremium), netPremium: money(context.netPremium),
      currency: await getSetting('currency.default', 'PHP'), message: context.customMessage || '', insurerName: context.insuranceCompany || '', validUntil: context.expiryDate || '' };
    const html = renderTemplate(t.html, v);
    const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    res.json({ success: true, data: { subject: renderTemplate(t.subject, v), previewText: text.slice(0, 140), html, text } });
  },
});
define({
  method: 'POST', path: '/send', summary: 'Send an e-mail composed in the Share dialog', screen: SCREEN,
  middleware: [...canSend, validate(z.object({ to: z.string().email(), subject: z.string().min(1).max(300), html: z.string().optional(), text: z.string().optional(), cc: z.string().optional(), quotationId: z.string().optional() }).passthrough())],
  request: { to: 'juan@example.com', subject: 'Your quotation', html: '<p>Hello</p>' }, response: { success: true, message: 'E-mail queued', data: { emailId: 1 } },
  handler: async (req, res) => {
    const { to, cc, subject, html, text, quotationId } = req.body;
    const id = await queueEmail({ to, cc, subject, html: html || `<pre>${String(text || '').replace(/</g, '&lt;')}</pre>`, template: 'custom', entity: quotationId ? 'quotation' : null, entityId: quotationId });
    await audit(req, { entity: quotationId ? 'quotation' : 'email', entityId: quotationId || id, action: 'email', after: { to, subject, emailId: id } });
    res.json({ success: true, message: 'E-mail queued', data: { emailId: id } });
  },
});
define({
  method: 'POST', path: '/share-quote', summary: 'E-mail a quotation to a recipient with the standard template', screen: SCREEN,
  middleware: [...canSend, validate(z.object({ to: z.string().email(), quotationData: z.object({ quotationId: z.string().optional() }).passthrough(), message: z.string().optional() }))],
  request: { to: 'juan@example.com', quotationData: { quotationId: 'qt_1' }, message: 'Please review' }, response: { success: true, message: 'Quote shared', data: { emailId: 1 } },
  handler: async (req, res) => {
    const q = await getQuoteRow(req.body.quotationData.quotationId || req.body.quotationData.id || req.body.quotationData.quotationNumber);
    const t = await emailTemplate('share_quote');
    const v = await quoteVars(q, { message: req.body.message || '' });
    const id = await queueEmail({ to: req.body.to, subject: renderTemplate(t.subject, v), html: renderTemplate(t.html, v), template: 'share_quote', entity: 'quotation', entityId: q.id });
    await audit(req, { entity: 'quotation', entityId: q.id, action: 'share-quote', after: { to: req.body.to, emailId: id } });
    res.json({ success: true, message: `Quote shared with ${req.body.to}`, data: { emailId: id, to: req.body.to } });
  },
});
define({
  method: 'POST', path: '/share-quote-to-insurers', summary: 'Send the quotation to selected insurers (contact e-mail from the insurance company master)', screen: `${SCREEN} > Send to insurer`,
  middleware: [...canSend, validate(z.object({ quotationId: z.string().min(1), insuranceCompanies: z.array(z.union([z.string(), z.number()])).min(1) }).passthrough())],
  request: { quotationId: 'qt_1', insuranceCompanies: ['Malayan Insurance Co., Inc.', 'SecureGuard Insurance'] },
  response: { success: true, data: { sent: [{ insurer: 'Malayan Insurance Co., Inc.', email: 'uw@malayan.example' }], failed: [] } },
  handler: async (req, res) => {
    const q = await getQuoteRow(req.body.quotationId);
    const t = await emailTemplate('insurer_submission');
    const sent = [];
    const failed = [];
    for (const ref of req.body.insuranceCompanies) {
      const [ic] = await many(`SELECT id, name, contact_email FROM insurance_companies WHERE id::text = $1 OR lower(name) = lower($1) OR lower(code) = lower($1)
        OR lower(short_name) = lower($1) LIMIT 1`, [String(ref)]);
      if (!ic?.contact_email) { failed.push({ insurer: String(ref), reason: ic ? 'No contact e-mail on the insurer record' : 'Insurer not found in the master' }); continue; }
      const v = await quoteVars(q, { insurerName: ic.name });
      const id = await queueEmail({ to: ic.contact_email, subject: renderTemplate(t.subject, v), html: renderTemplate(t.html, v), template: 'insurer_submission', entity: 'quotation', entityId: q.id });
      sent.push({ insurer: ic.name, email: ic.contact_email, emailId: id });
    }
    await audit(req, { entity: 'quotation', entityId: q.id, action: 'share-to-insurers', after: { sent: sent.map((s) => s.insurer), failed } });
    const ok = sent.length > 0;
    res.status(ok ? 200 : 400).json({ success: ok, partial: ok && failed.length > 0, message: ok ? `Sent to ${sent.length} insurer(s)` : 'No insurer could be e-mailed', data: { sent, failed } });
  },
});

export default router;
