/**
 * Server-rendered PDFs for services/documentTemplateService.js: quotation templates, policy schedules and receipts.
 * (Billing statements, /billing-statement/*, are served by the receipts module from the receivables.)
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { many, one } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { buildPdf, sendPdf } from './pdf.js';
import { quoteDoc, policyScheduleDoc, receiptDoc } from './templates.js';
import { quoteById } from '../quotations/service.js';
import { getPolicyRow, toPolicy } from '../policies/service.js';

const { router, define } = moduleRouter('Documents', '');
const readQuotes = [requireAuth, requirePermission('read:quotations')];
const readPolicies = [requireAuth, requirePermission('read:policies')];

const policyPdf = async (req, res) => {
  const p = toPolicy(await getPolicyRow(req.params.id));
  sendPdf(res, buildPdf(await policyScheduleDoc(p)), `policy-schedule-${p.policyNumber}.pdf`);
};
const quotePdf = async (req, res) => {
  const q = await quoteById(req.params.id);
  sendPdf(res, buildPdf(await quoteDoc(q)), `quotation-${q.quotationNumber}.pdf`);
};

for (const [path, handler, label] of [
  ['/document-templates/quote-template/:id', quotePdf, 'Motor quotation PDF'], ['/document-templates/quote-template-fire/:id', quotePdf, 'Fire / IAR quotation PDF'],
]) define({ method: 'GET', path, summary: label, screen: 'Operations > Quotation > Quote detail > Share > Download', middleware: readQuotes, response: 'application/pdf', handler });
for (const [path, label] of [['/document-templates/policy-schedule/:id', 'Motor policy schedule PDF'], ['/document-templates/policy-schedule-fire/:id', 'Fire / IAR policy schedule PDF']]) {
  define({ method: 'GET', path, summary: label, screen: 'Operations > Policy > Policy detail > Policy schedule', middleware: readPolicies, response: 'application/pdf', handler: policyPdf });
}
define({
  method: 'GET', path: '/document-templates/receipt/:id', summary: 'Official receipt PDF (optionally only some lines: lineIds=a,b)', screen: 'Accounts > Receipts > Print',
  middleware: [requireAuth, requirePermission('read:receipts', 'read:policies')], query: { lineIds: 'rl_1,rl_2' }, response: 'application/pdf',
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
export default router;
