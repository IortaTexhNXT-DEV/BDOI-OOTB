import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { paging } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { withTransaction } from '../../db/pool.js';
import { queueEmail } from '../../lib/mailer.js';
import { sendEntity, actor, renderTemplate, emailTemplate } from '../documents/common.js';
import { uploadFile, parseUploadedRows } from '../documents/tabular.js';
import { getPolicyRow, toPolicy } from '../policies/service.js';
import { getClient, toClient } from '../clients/service.js';
import { toQuote } from './shape.js';
import { premiumBreakdown } from './premium.js';
import { motorTariff, vehicleClass, vehicleOf } from './motorTariff.js';
import { ownRecord, withScope, assertVisible } from '../../lib/scope.js';
import * as svc from './service.js';
import mastersRouter from './masters.js';
import emailRouter from './email.js';

const { router, define } = moduleRouter('Quotations', '/quotations');
const SCREEN = 'Operations > Quotation';
const canRead = [requireAuth, requirePermission('read:quotations')];
const canWrite = [requireAuth, requirePermission('write:quotations')];

const quoteBody = z.object({
  leadRefId: z.string().min(1).optional(), clientId: z.string().optional(), productType: z.string().max(100).optional(),
  insurancePolicyType: z.string().max(100).optional().nullable(), discount: z.union([z.string(), z.number()]).optional().nullable(),
}).passthrough();
const statusBody = z.object({ status: z.string().min(1), updatedBy: z.string().optional(), reason: z.string().optional() });
const example = { quotationId: 'qt_1', quotationNumber: 'QT-2026-00001', quotationStatus: 'Draft', leadRefId: 'ld_1', productType: 'Motor', netPremium: 18500, valueAddedTax: 2220, documentaryStampTax: 2312.5, localGovernmentTax: 138.75, grossPremium: 23171.25, totalSumInsured: 1200000, lead: { firstName: 'Juan', lastName: 'Dela Cruz' } };
const out = (r) => toQuote(r);

async function listHandler(req, res) {
  const pg = paging(req.query);
  const { total, rows } = await svc.listQuotes(await withScope(req, { ...req.query, status: req.params.status || req.query.status }), pg);
  res.json({ success: true, data: rows.map(out), page: pg.page, pageSize: pg.perPage, total, totalPages: Math.ceil(total / pg.perPage) });
}

define({
  method: 'GET', path: '/', summary: 'List quotations (leadRefId, search, lob, productType, status; paging)', screen: SCREEN, middleware: canRead,
  query: { page: 1, pageSize: 10, leadRefId: 'ld_1', search: 'QT-2026', lob: 'FIRE' }, response: { success: true, data: [example], page: 1, pageSize: 10, total: 1 }, handler: listHandler,
});
define({
  method: 'GET', path: '/motor-tariff', summary: 'Motor tariff from the Product Configurator: vehicle classes with the fixed CTPL premium, own damage rate and default seats; Auto Passenger PA limits and rate',
  screen: `${SCREEN} > Policy details / Coverage details`, middleware: canRead,
  response: { success: true, data: { templateCode: 'MOT-003-2025', vehicleTypes: [{ value: 'private_cars', label: 'Private cars', defaultSeats: 5, ctplPremium: 560, ownDamageRate: 2 }], appa: { limits: [50000, 100000], ratePercent: 0.1 } } },
  handler: async (_req, res) => res.json({ success: true, data: await motorTariff() }),
});
define({
  method: 'GET', path: '/stats', summary: 'Quotation KPIs (optionally for one lead)', screen: `${SCREEN} (stats cards)`, middleware: canRead, query: { leadRefId: 'ld_1' },
  response: { totalQuotations: 14, convertedToPolicyCount: 8, activeQuotationsCount: 5, conversionRate: 57.1, quotationsByStatus: [{ status: 'Draft', count: 2 }] },
  handler: async (req, res) => { const s = await svc.quoteStats(await withScope(req)); res.json({ success: true, ...s, data: s }); },
});
define({
  method: 'GET', path: '/compare', summary: 'Compare two quotations side by side with rule-based insights', screen: `${SCREEN} > Compare`, middleware: canRead,
  query: { quotationId1: 'qt_1', quotationId2: 'qt_2' }, response: { success: true, quotation1: example, quotation2: example, aiInsights: { summary: '...', keyDifferences: [], pricingAnalysis: {}, recommendation: {} } },
  handler: async (req, res) => {
    if (!req.query.quotationId1 || !req.query.quotationId2) throw badRequest('quotationId1 and quotationId2 are required');
    await assertVisible(req, 'quote', req.query.quotationId1);
    await assertVisible(req, 'quote', req.query.quotationId2);
    const q1 = await svc.quoteById(req.query.quotationId1);
    const q2 = await svc.quoteById(req.query.quotationId2);
    const data = { quotation1: q1, quotation2: q2, aiInsights: svc.compareInsights(q1, q2) };
    res.json({ success: true, ...data, data });
  },
});
define({
  method: 'GET', path: '/by-status/:status', summary: 'Quotations in one status', screen: SCREEN, middleware: canRead, query: { page: 1, pageSize: 10, leadRefId: 'ld_1' },
  response: { success: true, data: [example], total: 1 }, handler: listHandler,
});
define({
  method: 'GET', path: '/audit-trail/:id', summary: 'Audit trail of a quotation (one row per changed field)', screen: `${SCREEN} > Audit trail`, middleware: [...canRead, ownRecord('quote')], query: { sort: 'desc' },
  response: { success: true, data: [{ action: 'update', field: 'discount', oldValue: '0', newValue: '500', createdAt: '2026-09-01T02:00:00Z', user: { displayName: 'Maria Santos' } }] },
  handler: async (req, res) => res.json({ success: true, data: await svc.auditTrail(req.params.id, req.query.sort) }),
});
define({
  method: 'POST', path: '/calculate-premium', summary: 'Premium breakdown (cover premiums, VAT, DST, LGT, FST, gross, commission) from rates in settings and the coverages master', screen: `${SCREEN} > Coverage details / Order summary`,
  middleware: canRead, request: { productType: 'Motor', lossAndDamageCoverage: 1000000, lossAndDamageCoverageRate: 1.5, actsOfNatureRate: 0.5, bodilyInjury: 200000, propertyDamage: 200000, APPAtotalCoverage: 250000, discount: 0 },
  response: { success: true, data: { netPremium: 26250, valueAddedTax: 3150, documentaryStampTax: 3281.25, localGovernmentTax: 196.88, grossPremium: 32878.13 } },
  handler: async (req, res) => res.json({ success: true, data: await premiumBreakdown(req.body || {}) }),
});
define({
  method: 'POST', path: '/bulk-upload', summary: 'Bulk upload quotations from CSV / XLSX (leadRefId or customer name columns, productType, sum insured, rate or net premium)', screen: `${SCREEN} > Bulk Upload`,
  middleware: [...canWrite, uploadFile], request: 'multipart/form-data file', response: { success: true, data: { message: 'Processed 2 rows: 2 created, 0 failed', created: 2, failed: 0, errors: [] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file);
    const errors = [];
    let created = 0;
    for (const [i, row] of rows.entries()) {
      try {
        const q = await withTransaction(async (db) => svc.createQuote(await svc.quoteFromRow(db, row, actor(req)), actor(req), db));
        await audit(req, { entity: 'quotation', entityId: q.id, action: 'bulk-create', after: out(q) });
        created += 1;
      } catch (e) { errors.push({ row: i + 2, message: e.message }); }
    }
    const data = { message: `Processed ${rows.length} rows: ${created} created, ${errors.length} failed`, total: rows.length, created, failed: errors.length, errors };
    res.json({ success: true, message: data.message, data });
  },
});
define({
  method: 'POST', path: '/approve-by-customer', auth: false, summary: 'Public approval link: preview (preview=true) or accept the quotation with the signed token (no login)', screen: 'Public /approve-quote',
  middleware: [validate(z.object({ token: z.string().min(10), preview: z.boolean().optional() }))], request: { token: '<jwt from the e-mail link>', preview: true },
  response: { success: true, message: 'Quotation approved', ...example, quotationStatus: 'CustomerAccepted' },
  handler: async (req, res) => {
    const r = await svc.approveByCustomer(req.body.token, req.body.preview);
    const quote = out(r.quote);
    // the customer sees the vehicle class name, not its code
    quote.vehicleTypeLabel = vehicleClass(await motorTariff(), vehicleOf(quote).vehicleType)?.label || null;
    if (r.changed) {
      await audit({ ip: req.ip, user: { id: null, username: `customer:${r.quote.approval_sent_to || ''}` } },
        { entity: 'quotation', entityId: quote.id, action: 'customer-accept', before: { quotationStatus: 'PendingCustomer' }, after: { quotationStatus: quote.quotationStatus } });
    }
    res.json({ ...quote, success: true, message: req.body.preview ? 'Quotation preview' : 'Quotation approved', data: quote });
  },
});
define({
  method: 'POST', path: '/', summary: 'Create a quotation (Motor order summary, Fire / IAR cards, renewal); premiums recalculated server-side', screen: `${SCREEN} > Create Quote (order summary)`,
  middleware: [...canWrite, validate(quoteBody.refine((b) => b.leadRefId || b.clientId, { message: 'leadRefId is required', path: ['leadRefId'] })), ownRecord('lead', (req) => req.body.leadRefId), ownRecord('client', (req) => req.body.clientId)],
  request: { leadRefId: 'ld_1', productType: 'Motor', insurancePolicyType: 'PC', lossAndDamageCoverage: '1000000', lossAndDamageCoverageRate: '1.5', bodilyInjury: '200000', propertyDamage: '200000', APPAtotalCoverage: '250000', participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }], insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: '2024' }] },
  response: { ...example, success: true },
  handler: async (req, res) => {
    const q = out(await svc.createQuote(req.body, actor(req)));
    await audit(req, { entity: 'quotation', entityId: q.id, action: 'create', after: q });
    sendEntity(res, q, { status: 201, message: 'Quotation created' });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Get one quotation (by id or number) with lead summary and premium breakdown', screen: `${SCREEN} > Quote detail`, middleware: [...canRead, ownRecord('quote')],
  response: { ...example, success: true }, handler: async (req, res) => sendEntity(res, await svc.quoteById(req.params.id)),
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a quotation (not once converted); premiums recalculated', screen: `${SCREEN} > Edit quote`, middleware: [...canWrite, ownRecord('quote'), validate(quoteBody)],
  request: { discount: '500', remarks: 'Loyalty discount' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.updateQuote(req.params.id, req.body, actor(req));
    await audit(req, { entity: 'quotation', entityId: after.id, action: 'update', before: out(before), after: out(after) });
    sendEntity(res, out(after), { message: 'Quotation updated' });
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Delete a Draft / Rejected / Dropped quotation', screen: `${SCREEN} > Delete`, middleware: [...canWrite, ownRecord('quote')],
  response: { success: true, message: 'Quotation deleted', data: { quotationId: 'qt_1' } },
  handler: async (req, res) => {
    const q = await svc.deleteQuote(req.params.id, actor(req));
    await audit(req, { entity: 'quotation', entityId: q.id, action: 'delete', before: out(q) });
    res.json({ success: true, message: 'Quotation deleted', quotationId: q.id, data: { quotationId: q.id } });
  },
});
const statusHandler = async (req, res) => {
  const { before, after } = await svc.changeStatus(req.params.id, req.body.status, req.user);
  await audit(req, { entity: 'quotation', entityId: after.id, action: 'status', before: { quotationStatus: out(before).quotationStatus }, after: { quotationStatus: out(after).quotationStatus, reason: req.body.reason } });
  sendEntity(res, out(after), { message: `Status changed to ${out(after).quotationStatus}` });
};
for (const method of ['PUT', 'PATCH']) {
  define({
    method, path: '/:id/status', summary: 'Change quotation status along quotations.transitions (Approved is maker-checker: approver differs from creator)', screen: `${SCREEN} > Quote detail (status)`,
    middleware: [...canWrite, ownRecord('quote'), validate(statusBody)], request: { status: 'Approved', updatedBy: 'agent' }, response: { ...example, quotationStatus: 'Approved', success: true }, handler: statusHandler,
  });
}
define({
  method: 'POST', path: '/:id/send-for-approval', summary: 'Send the quotation to the customer for approval (signed link e-mail) and notify underwriting', screen: `${SCREEN} > Quote detail > Send for customer approval`,
  middleware: [...canWrite, ownRecord('quote')], request: { sentBy: 'agent' }, response: { success: true, message: 'Quotation sent for approval', sentTo: 'juan@example.com', approvalUrl: 'http://localhost:3000/approve-quote?token=...' },
  handler: async (req, res) => {
    const r = await svc.sendForApproval(req.params.id, req.user);
    await audit(req, { entity: 'quotation', entityId: r.after.id, action: 'send-for-approval', before: { quotationStatus: out(r.before).quotationStatus }, after: { quotationStatus: out(r.after).quotationStatus, sentTo: r.sentTo } });
    res.json({ success: true, message: `Quotation sent to ${r.sentTo} for approval`, sentTo: r.sentTo, approvalUrl: r.approvalUrl, data: out(r.after) });
  },
});
define({
  method: 'POST', path: '/:id/submit-to-insurer', summary: 'Submit a customer-accepted quotation to the insurer (e-mail to the insurer contact)', screen: `${SCREEN} > Quote detail > Submit to insurer`,
  middleware: [...canWrite, ownRecord('quote')], request: { submittedBy: 'agent' }, response: { success: true, message: 'Quotation submitted to insurer', data: { ...example, quotationStatus: 'SubmittedToInsurer' } },
  handler: async (req, res) => {
    const r = await svc.submitToInsurer(req.params.id, req.user);
    await audit(req, { entity: 'quotation', entityId: r.after.id, action: 'submit-to-insurer', before: { quotationStatus: out(r.before).quotationStatus }, after: { quotationStatus: out(r.after).quotationStatus, insurer: r.insurer?.name } });
    res.json({ success: true, message: 'Quotation submitted to insurer', insurer: r.insurer?.name || null, data: out(r.after) });
  },
});
define({
  method: 'POST', path: '/:id/convert-to-policy', summary: 'Convert to policy: client from lead, policy number, receivable (bill number), commission accrual; repeat calls update the issued policy', screen: `${SCREEN} > Convert to policy / Payment confirmation`,
  middleware: [...canWrite, ownRecord('quote')], request: { additionalPolicyData: { insuredName: 'Juan Dela Cruz', plateNumber: 'ABC 1234', inception: '2026-10-01', paymentStatus: 'Pending', paymentMethod: 'Direct Debit' }, createdBy: 'agent' },
  response: { success: true, message: 'Policy created', data: { policy: { policyId: 'pol_1', policyNumber: 'POL-2026-00001', billNumber: 'INV-2026-00001' }, client: { clientId: 'cl_1' } } },
  handler: async (req, res) => {
    const r = await svc.convertToPolicy(req.params.id, req.body || {}, req.user);
    const policy = toPolicy(await getPolicyRow(r.policyId));
    const client = policy.clientId ? toClient(await getClient(policy.clientId)) : null;
    await audit(req, { entity: 'quotation', entityId: req.params.id, action: r.created ? 'convert-to-policy' : 'update-converted-policy', after: { quotationStatus: 'ConvertedToPolicy', policyId: policy.id, policyNumber: policy.policyNumber, billNumber: policy.billNumber } });
    if (r.created) await audit(req, { entity: 'policy', entityId: policy.id, action: 'issue', after: { policyNumber: policy.policyNumber, quoteRefId: policy.quoteRefId, grossPremium: policy.grossPremium } });
    const data = { policy, client, receivable: r.receivable || null, commission: r.commission || null };
    res.status(r.created ? 201 : 200).json({ success: true, message: r.created ? 'Policy created' : 'Policy updated', ...data, policyId: policy.id, clientId: client?.id, data });
  },
});
define({
  method: 'PATCH', path: '/:id/vehicle-info', summary: 'Save customer / vehicle information and photo keys on the quotation (convert-to-policy steps)', screen: `${SCREEN} > Convert to policy > Customer info / Vehicle photos`,
  middleware: [...canWrite, ownRecord('quote')], request: { plateNumber: 'ABC 1234', chassisNumber: 'JTDBT923', motorNumber: '2NR123', vehicleFrontSidePhoto: 'vehicle/abc.jpg' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.updateVehicleInfo(req.params.id, req.body || {}, actor(req));
    await audit(req, { entity: 'quotation', entityId: after.id, action: 'vehicle-info', before: out(before), after: out(after) });
    sendEntity(res, out(after), { message: 'Vehicle information saved' });
  },
});
define({
  method: 'POST', path: '/:id/send-mail-policy-quote/customer', summary: 'E-mail the policy / quotation summary to the customer', screen: `${SCREEN} > Coverage detailed view`,
  middleware: [...canWrite, ownRecord('quote')], query: { policyId: 'pol_1' }, response: { success: true, message: 'E-mail queued', data: { to: 'juan@example.com' } },
  handler: async (req, res) => {
    const q = await svc.getQuoteRow(req.params.id);
    const policy = req.query.policyId || q.policy_id ? toPolicy(await getPolicyRow(req.query.policyId || q.policy_id)) : null;
    const to = policy?.client?.emailId || q.lead_row?.email;
    if (!to) throw badRequest('No customer e-mail address on the lead or client');
    const t = await emailTemplate(policy ? 'policy_issued' : 'share_quote');
    const v = { customerName: policy?.insuredName || q.lead_row?.first_name || 'Customer', quotationNumber: q.quote_number, policyNumber: policy?.policyNumber || '',
      grossPremium: Number(q.premium_total).toLocaleString('en-US', { minimumFractionDigits: 2 }), currency: q.currency, productType: q.product_type || q.lob, message: '' };
    const id = await queueEmail({ to, subject: renderTemplate(t.subject, v), html: renderTemplate(t.html, v), template: policy ? 'policy_issued' : 'share_quote', entity: policy ? 'policy' : 'quotation', entityId: policy?.id || q.id });
    await audit(req, { entity: 'quotation', entityId: q.id, action: 'email-customer', after: { to, emailId: id, policyId: policy?.id } });
    res.json({ success: true, message: 'E-mail queued', data: { to, emailId: id } });
  },
});

export default router;
export const mount = '/quotations';
export const extraMounts = [['/email', emailRouter], ['/', mastersRouter]];
