/**
 * Server-rendered PDFs for services/documentTemplateService.js: quotation templates, policy schedules and receipts.
 * (Billing statements, /billing-statement/*, are served by the receipts module from the receivables.)
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { many, one, withTransaction } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { buildPdf, printContext, sendPdf } from './pdf.js';
import { ok } from '../../lib/respond.js';
import { quoteDoc, policyScheduleDoc, receiptDoc, acknowledgementReceiptDoc, printablePolicy } from './templates.js';
import { captureForReceipt } from '../policies/payments.js';
import { quoteById } from '../quotations/service.js';
import { getPolicyRow, toPolicy } from '../policies/service.js';
import { ownRecord, assertVisible } from '../../lib/scope.js';
import { productDocumentSpec } from './productDocuments.js';

const { router, define } = moduleRouter('Documents', '');
const readQuotes = [requireAuth, requirePermission('read:quotations')];
const readPolicies = [requireAuth, requirePermission('read:policies')];

const policyPdf = async (req, res) => {
  const row = await getPolicyRow(req.params.id);
  const p = await printablePolicy(toPolicy(row), row);
  sendPdf(res, buildPdf(await policyScheduleDoc(p)), `policy-schedule-${p.policyNumber}.pdf`);
};
const quotePdf = async (req, res) => {
  const q = await quoteById(req.params.id);
  sendPdf(res, buildPdf(await quoteDoc(q)), `quotation-${q.quotationNumber}.pdf`);
};

for (const [path, handler, label] of [
  ['/document-templates/quote-template/:id', quotePdf, 'Motor quotation PDF'], ['/document-templates/quote-template-fire/:id', quotePdf, 'Fire / IAR quotation PDF'],
]) define({ method: 'GET', path, summary: label, screen: 'Operations > Quotation > Quote detail > Share > Download', middleware: [...readQuotes, ownRecord('quote')], response: 'application/pdf', handler });
for (const [path, label] of [['/document-templates/policy-schedule/:id', 'Motor policy schedule PDF'], ['/document-templates/policy-schedule-fire/:id', 'Fire / IAR policy schedule PDF']]) {
  define({ method: 'GET', path, summary: label, screen: 'Operations > Policy > Policy detail > Policy schedule', middleware: [...readPolicies, ownRecord('policy')], response: 'application/pdf', handler: policyPdf });
}
define({
  method: 'GET', path: '/document-templates/product-document/:documentId/policy/:id', summary: 'A product document template (Product Configurator > Document Manager, e.g. CTPL certificate) printed for a policy: its uploaded layout, else the default layout',
  screen: 'Operations > Policy > Policy detail > Documents', middleware: [...readPolicies, ownRecord('policy')], response: 'application/pdf',
  handler: async (req, res) => {
    const row = await getPolicyRow(req.params.id);
    const p = await printablePolicy(toPolicy(row), row);
    const spec = await productDocumentSpec('policy', p, { documentId: req.params.documentId });
    if (!spec) throw notFound('This document template is not an active document of the policy\'s product template');
    sendPdf(res, buildPdf(spec), `${String(spec.title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.policyNumber}.pdf`);
  },
});
define({
  method: 'GET', path: '/document-templates/product-document/:documentId/quote/:id', summary: 'A product document template (e.g. member enrollment form) printed for a quotation',
  screen: 'Operations > Quotation > Quote detail', middleware: [...readQuotes, ownRecord('quote')], response: 'application/pdf',
  handler: async (req, res) => {
    const q = await quoteById(req.params.id);
    const spec = await productDocumentSpec('quote', q, { documentId: req.params.documentId });
    if (!spec) throw notFound('This document template is not an active document of the quotation\'s product template');
    sendPdf(res, buildPdf(spec), `${String(spec.title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${q.quotationNumber}.pdf`);
  },
});
define({
  method: 'GET', path: '/document-templates/receipt/:id', summary: 'Official receipt PDF (optionally only some lines: lineIds=a,b)', screen: 'Accounts > Receipts > Print',
  middleware: [requireAuth, requirePermission('read:receipts', 'read:policies'), ownRecord('receipt')], query: { lineIds: 'rl_1,rl_2' }, response: 'application/pdf',
  handler: async (req, res) => {
    const r = await one('SELECT r.*, c.display_name AS client_name FROM receipts r LEFT JOIN clients c ON c.id = r.client_id WHERE r.id = $1 OR r.receipt_number = $1', [req.params.id]);
    if (!r) throw notFound('Receipt not found');
    const ids = String(req.query.lineIds || '').split(',').map((s) => s.trim()).filter(Boolean);
    let lines = [];
    try {
      lines = await many(`SELECT * FROM receipt_lines WHERE receipt_id = $1 AND ($2::text[] IS NULL OR id = ANY($2)) ORDER BY line_no`, [r.id, ids.length ? ids : null]);
    } catch { lines = []; }
    sendPdf(res, buildPdf(await receiptDoc(r, lines)), `receipt-${r.receipt_number}.pdf`);
  },
});
define({
  method: 'GET', path: '/document-templates/acknowledgement-receipt/:paymentId', summary: 'Acknowledgement receipt (AR) PDF of a premium payment recorded on a policy (payment id or AR number)',
  screen: 'Operations > Policy > Payment > Payments recorded > Print acknowledgement receipt',
  middleware: [requireAuth, requirePermission('read:policies', 'read:receipts')],
  response: 'application/pdf',
  handler: async (req, res) => {
    const ref = await one('SELECT policy_id FROM policy_payments WHERE id = $1 OR ar_number = $1', [req.params.paymentId]);
    if (!ref) throw notFound('Payment not found');
    await assertVisible(req, 'policy', ref.policy_id);
    const c = await withTransaction((db) => captureForReceipt(db, req.params.paymentId));
    sendPdf(res, buildPdf(await acknowledgementReceiptDoc(c)), `acknowledgement-receipt-${c.arNumber}.pdf`);
  },
});
define({
  method: 'GET', path: '/document-templates/letterhead',
  summary: 'Letterhead and document colours for a page printed from the browser (the same as on the server documents): company name, address lines, TIN, licence, contact, the print logo as a data URL and the documents section of the theme',
  screen: 'Printable views (Print on screens that print a page of their own)',
  response: { success: true, data: { name: 'Toyota Insurance Services Philippines, Inc.', addressLines: ['31F Net Park, 5th Avenue', 'Taguig City, Metro Manila 1634, Philippines'], tin: '000-000-000-000',
    licence: 'IC-B-1234', phone: '+63 2 8888 0000', email: 'tisph@example.ph', website: '', logo: 'data:image/png;base64,...',
    documents: { accent: '#eb0a1e', headingColor: '#eb0a1e', headingBg: '#f7f7f7', tableHeaderBg: '#eb0a1e', tableHeaderText: '#ffffff', footerText: 'Authorized by the Insurance Commission ...', showLogo: true, logoHeight: 46 },
    generatedBy: 'Rosa Finance', generatedAt: '10/10/2026 09:03' } },
  handler: async (req, res) => {
    const ctx = await printContext({ user: req.user });
    const lh = ctx.letterhead || {};
    const b = ctx.brand || {};
    const logo = lh.logo?.buffer && b.showLogo !== false ? `data:image/${lh.logo.type};base64,${lh.logo.buffer.toString('base64')}` : null;
    ok(res, {
      name: lh.name || '', addressLines: lh.addressLines || [], tin: lh.tin || '', licence: lh.licence || '', phone: lh.phone || '', email: lh.email || '', website: lh.website || '', logo,
      documents: { accent: b.accent || ctx.accentColor, headingColor: b.headingColor || b.accent, headingBg: b.headingBg || null, tableHeaderBg: b.tableHeaderBg || b.accent,
        tableHeaderText: b.tableHeaderText || '#ffffff', footerText: b.footerText || '', showLogo: b.showLogo !== false, logoHeight: b.logoHeight || 46 },
      generatedBy: ctx.generatedBy, generatedAt: ctx.generatedAt,
    });
  },
});
export default router;
