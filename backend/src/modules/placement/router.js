/**
 * Placement journey API: Broker Slips (market submission, insurer offers, comparison), Placement Slips (firm order,
 * binding per participant, policy issuance), direct policy entry and the journey configuration per line of business.
 * Access follows the quotation permissions (Sales & Marketing, Processing Team, Operations);
 * issuing a policy also needs write:policies.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { paging } from '../../lib/respond.js';
import { ownRecord, withScope } from '../../lib/scope.js';
import { sendEntity } from '../documents/common.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { brokerSlipDoc, placementSlipDoc } from '../documents/templates.js';
import { getPolicyRow, toPolicy } from '../policies/service.js';
import * as slips from './brokerSlips.js';
import * as plc from './placements.js';
import { journeyFor } from './journey.js';
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';

const canRead = [requireAuth, requirePermission('read:quotations')];
const canWrite = [requireAuth, requirePermission('write:quotations')];
const canIssue = [requireAuth, requirePermission('write:quotations'), requirePermission('write:policies')];

const money = z.union([z.number(), z.string()]).optional().nullable();
const participantBody = z.object({
  insuranceCompanyId: z.union([z.number(), z.string()]).optional(), insuranceCompanyName: z.string().optional(),
  sharePercent: money, sharePercentage: money, isLead: z.boolean().optional(), commissionRate: money, insurerReference: z.string().max(80).optional().nullable(),
}).passthrough();
const insurerRef = z.union([z.number(), z.string().min(1), z.object({}).passthrough()]);

// ---------------------------------------------------------------- Broker slips
const bs = moduleRouter('Broker Slips', '/broker-slips');
const BS = 'Operations > Sales & Marketing > Request for Quotation (Broker Slip)';
const slipExample = { brokerSlipId: 'bs_1', slipNumber: 'BS-2026-00001', status: 'submitted', insuredName: 'Cebu Cold Storage Corp.', productType: 'Fire and Allied Perils', lob: 'FIRE', sumInsured: 85000000,
  submissionDate: '2026-09-20', responseDueDate: '2026-09-27', offers: [{ offerId: 'ofr_1', offerNumber: 'OFR-2026-00001', insuranceCompanyName: 'Malayan Insurance Co., Inc.', status: 'offered', premium: 212500, rate: 0.25, taxes: 31556.25, premiumTotal: 244056.25, offeredShare: 60, validityDate: '2026-10-20' }] };
const slipBody = z.object({
  leadRefId: z.string().optional().nullable(), clientId: z.string().optional().nullable(), productId: z.union([z.number(), z.string()]).optional().nullable(), productType: z.string().max(120).optional(),
  lob: z.string().max(40).optional(), insuredName: z.string().max(200).optional(), riskDetails: z.record(z.any()).optional(), doc: z.record(z.any()).optional(),
  requestedCovers: z.array(z.object({ cover: z.string().optional(), sumInsured: money, deductible: z.string().optional().nullable(), remarks: z.string().optional().nullable() }).passthrough()).optional(),
  sumInsured: money, currency: z.string().max(3).optional(), inceptionDate: z.string().optional().nullable(), expiryDate: z.string().optional().nullable(), responseDueDate: z.string().optional().nullable(),
  insurers: z.array(insurerRef).optional(), remarks: z.string().max(2000).optional().nullable(),
  // a new prospect entered on the Request for Quotation instead of an existing lead or client
  prospect: z.object({
    companyName: z.string().trim().max(200).optional().nullable(), firstName: z.string().trim().max(100).optional().nullable(),
    lastName: z.string().trim().max(100).optional().nullable(), emailId: z.string().email('emailId must be a valid e-mail').optional().nullable().or(z.literal('')),
    contactNumber: z.string().max(40).optional().nullable(),
  }).refine((p) => p.companyName || p.firstName, { message: 'Enter the company name or the first name of the prospect', path: ['companyName'] }).optional(),
});

bs.define({
  method: 'GET', path: '/', summary: 'List broker slips (status (comma-separated), lob, leadRefId, clientId, insurerId, search; paging) with offer counts and status counts', screen: BS, middleware: canRead,
  query: { status: 'submitted,responses-in', search: 'BS-2026' }, response: { success: true, data: [slipExample], total: 1, counts: { submitted: 1 } },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows, counts } = await slips.listSlips(await withScope(req), pg);
    res.json({ success: true, data: rows.map((r) => slips.toSlip(r)), total, counts, page: pg.page, pageSize: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
bs.define({
  method: 'POST', path: '/', summary: 'Create a broker slip (market submission / RFQ): customer, product / LOB, risk details (motor: quote-shaped doc), requested covers, insurers to approach',
  screen: `${BS} > New`, middleware: [...canWrite, validate(slipBody), ownRecord('lead', (req) => req.body.leadRefId), ownRecord('client', (req) => req.body.clientId)],
  request: { leadRefId: 'ld_1', productType: 'Fire and Allied Perils', riskDetails: { location: 'Mandaue City, Cebu', occupancy: 'Cold storage warehouse', construction: 'Class A' },
    requestedCovers: [{ cover: 'Fire and lightning', sumInsured: 85000000 }, { cover: 'Earthquake', sumInsured: 85000000, deductible: '2% of loss' }], insurers: ['MALAYAN', 'PIONEER', 'FPG'], responseDueDate: '2026-09-27' },
  response: { success: true, ...slipExample, status: 'draft' },
  handler: async (req, res) => {
    const s = await slips.createSlip(req.body, req.user.id);
    if (s.newProspectId) await audit(req, { entity: 'lead', entityId: s.newProspectId, action: 'create', after: { ...req.body.prospect, source: 'request-for-quotation', slipNumber: s.slipNumber } });
    await audit(req, { entity: 'broker_slip', entityId: s.id, action: 'create', after: { slipNumber: s.slipNumber, insurers: s.offers.map((o) => o.insuranceCompanyName) } });
    sendEntity(res, s, { status: 201, message: `Broker slip ${s.slipNumber} created` });
  },
});
bs.define({
  method: 'GET', path: '/:id', summary: 'Broker slip with insurer offers, comparison (ranked by gross premium, capacity), journey and links', screen: `${BS} > Detail`, middleware: [...canRead, ownRecord('broker_slip')],
  response: { success: true, ...slipExample, comparison: { summary: { approached: 3, offered: 2, declined: 1, pending: 0, bestPremium: 244056.25, capacityPercent: 100 } } },
  handler: async (req, res) => sendEntity(res, await slips.slipById(req.params.id)),
});
bs.define({
  method: 'PUT', path: '/:id', summary: 'Edit an open broker slip (risk, covers, dates, insurers approached: pending insurers taken off the list are removed)', screen: `${BS} > Edit`,
  middleware: [...canWrite, ownRecord('broker_slip'), validate(slipBody)], request: { responseDueDate: '2026-09-30', insurers: ['MALAYAN', 'PIONEER', 'STANDARD'] }, response: { success: true, ...slipExample },
  handler: async (req, res) => {
    const r = await slips.updateSlip(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'broker_slip', entityId: r.after.id, action: 'update', before: r.before, after: slips.toSlip(await slips.getSlipRow(r.after.id)) });
    sendEntity(res, r.after, { message: 'Broker slip updated' });
  },
});
bs.define({
  method: 'POST', path: '/:id/submit', summary: 'Submit the broker slip to the market: queues the request for quotation to each insurer (outbox) and sets the response due date',
  screen: `${BS} > Submit to market`, middleware: [...canWrite, ownRecord('broker_slip')], request: {}, response: { success: true, data: { sent: [{ insurer: 'Malayan Insurance Co., Inc.', email: 'uw@malayan.example' }], failed: [] } },
  handler: async (req, res) => {
    const r = await slips.submitSlip(req.params.id, req.user);
    await audit(req, { entity: 'broker_slip', entityId: r.after.id, action: 'submit', before: { status: r.before.status }, after: { status: r.after.status, sent: r.sent.map((s) => s.insurer), failed: r.failed } });
    res.json({ success: true, message: `Broker slip sent to ${r.sent.length} insurer(s)`, sent: r.sent, failed: r.failed, data: r.after });
  },
});
bs.define({
  method: 'POST', path: '/:id/insurers', summary: 'Approach one more insurer (on a submitted slip the request is queued at once)', screen: `${BS} > Detail > Add insurer`,
  middleware: [...canWrite, ownRecord('broker_slip'), validate(z.object({ insurer: insurerRef }))], request: { insurer: 'STANDARD' }, response: { success: true, data: slipExample },
  handler: async (req, res) => {
    const r = await slips.addInsurer(req.params.id, req.body.insurer, req.user);
    await audit(req, { entity: 'broker_slip', entityId: r.slip.id, action: 'add-insurer', after: { insurer: req.body.insurer, mail: r.mail } });
    sendEntity(res, r.slip, { message: 'Insurer added', extra: { mail: r.mail } });
  },
});
const offerBody = z.object({
  status: z.enum(['pending', 'offered', 'declined']).default('offered'), premium: money, rate: money, taxes: money, premiumTotal: money, sumInsured: money,
  deductibles: z.string().max(2000).optional().nullable(), terms: z.string().max(4000).optional().nullable(), validityDate: z.string().optional().nullable(),
  offeredShare: z.union([z.number(), z.string()]).optional().nullable().refine((v) => v === undefined || v === null || v === '' || (Number(v) > 0 && Number(v) <= 100), { message: 'offeredShare must be more than 0 and at most 100' }),
  insurerReference: z.string().max(80).optional().nullable(), attachmentKey: z.string().max(500).optional().nullable(), attachmentName: z.string().max(255).optional().nullable(),
  declineReason: z.string().max(1000).optional().nullable(), remarks: z.string().max(2000).optional().nullable(),
});
bs.define({
  method: 'PUT', path: '/:id/offers/:offerId', summary: 'Record an insurer\'s response: offer (premium, rate, taxes, deductibles, terms, validity, line %, reference, attachment) or decline',
  screen: `${BS} > Detail > Record offer`, middleware: [...canWrite, ownRecord('broker_slip'), validate(offerBody)],
  request: { status: 'offered', premium: 212500, deductibles: 'PHP 50,000 each and every loss', terms: 'Warranted: sprinkler system maintained', validityDate: '2026-10-20', offeredShare: 60, insurerReference: 'MAL-Q-7781' },
  response: { success: true, data: slipExample.offers[0] },
  handler: async (req, res) => {
    const r = await slips.recordOffer(req.params.id, req.params.offerId, req.body, req.user);
    await audit(req, { entity: 'broker_slip', entityId: r.slip.id, action: `offer-${r.offer.status}`, after: r.offer });
    res.json({ success: true, message: `Response of ${r.offer.insuranceCompanyName} recorded`, offer: r.offer, data: r.offer, slip: r.slip });
  },
});
bs.define({
  method: 'GET', path: '/:id/comparison', summary: 'Comparison of the insurer offers (ranked by gross premium, difference from the best, market capacity)', screen: `${BS} > Detail > Compare offers`,
  middleware: [...canRead, ownRecord('broker_slip')], response: { success: true, data: { rows: slipExample.offers, summary: { offered: 2, bestPremium: 244056.25, capacityPercent: 100 } } },
  handler: async (req, res) => { const s = await slips.slipById(req.params.id); res.json({ success: true, data: s.comparison }); },
});
const selectBody = z.object({ offerIds: z.array(z.string().min(1)).min(1, 'Select at least one insurer offer'), leadOfferId: z.string().optional().nullable(),
  shares: z.record(z.union([z.number(), z.string()])).optional(), inceptionDate: z.string().optional().nullable(), expiryDate: z.string().optional().nullable(),
  billingMode: z.string().optional().nullable(), remarks: z.string().max(2000).optional().nullable() });
bs.define({
  method: 'POST', path: '/:id/prepare-quotation', summary: 'Prepare the Quotation Slip from the selected offer(s): several offers make it co-insurance with their lines as shares (must total 100%)',
  screen: `${BS} > Detail > Prepare Quotation Slip`, middleware: [...canWrite, ownRecord('broker_slip'), validate(selectBody)],
  request: { offerIds: ['ofr_1', 'ofr_2'], leadOfferId: 'ofr_1' }, response: { success: true, data: { quotationId: 'qt_1', quotationNumber: 'QT-2026-00007' } },
  handler: async (req, res) => {
    const r = await slips.prepareQuotation(req.params.id, req.body, req.user);
    const { quoteById } = await import('../quotations/service.js');
    const q = await quoteById(r.quoteId);
    await audit(req, { entity: 'broker_slip', entityId: r.slip.id, action: 'prepare-quotation', after: { quotationId: q.id, quotationNumber: q.quotationNumber, offers: req.body.offerIds } });
    await audit(req, { entity: 'quotation', entityId: q.id, action: 'create-from-broker-slip', after: { brokerSlip: r.slip.slipNumber, grossPremium: q.grossPremium } });
    res.status(201).json({ success: true, message: `Quotation slip ${q.quotationNumber} prepared`, quotationId: q.id, data: q, slip: r.slip });
  },
});
bs.define({
  method: 'POST', path: '/:id/prepare-placement', summary: 'Prepare the Placement Slip straight from the selected offer(s) (journeys where the Quotation Slip is optional or skipped)',
  screen: `${BS} > Detail > Prepare Placement Slip`, middleware: [...canWrite, ownRecord('broker_slip'), validate(selectBody)],
  request: { offerIds: ['ofr_1', 'ofr_2'], leadOfferId: 'ofr_1', inceptionDate: '2026-10-01' }, response: { success: true, data: { placementId: 'plc_1', placementNumber: 'PS-2026-00001' } },
  handler: async (req, res) => {
    const p = await plc.createPlacement({ ...req.body, brokerSlipId: (await slips.getSlipRow(req.params.id)).id }, req.user);
    await audit(req, { entity: 'placement', entityId: p.id, action: 'create-from-broker-slip', after: { placementNumber: p.placementNumber, brokerSlip: p.brokerSlipNumber } });
    sendEntity(res, p, { status: 201, message: `Placement slip ${p.placementNumber} prepared` });
  },
});
for (const [path, status, label] of [['/:id/cancel', 'cancelled', 'Cancel the broker slip'], ['/:id/close', 'closed', 'Close the broker slip without a quotation (e.g. not taken up)']]) {
  bs.define({
    method: 'POST', path, summary: label, screen: `${BS} > Detail`, middleware: [...canWrite, ownRecord('broker_slip'), validate(z.object({ reason: z.string().max(1000).optional().nullable() }))],
    request: { reason: 'Client renewed with the incumbent insurer' }, response: { success: true, data: { ...slipExample, status } },
    handler: async (req, res) => {
      const r = await slips.closeSlip(req.params.id, { status, reason: req.body.reason }, req.user);
      await audit(req, { entity: 'broker_slip', entityId: r.after.id, action: status === 'cancelled' ? 'cancel' : 'close', before: { status: r.before.status }, after: { status, reason: req.body.reason } });
      sendEntity(res, r.after, { message: `Broker slip ${status}` });
    },
  });
}
bs.define({
  method: 'GET', path: '/:id/documents/broker-slip', summary: 'Broker Slip PDF (request for quotation); insurerId= addresses it to one insurer of the market', screen: `${BS} > Detail > Broker Slip PDF`,
  middleware: [...canRead, ownRecord('broker_slip')], query: { insurerId: 2 }, response: 'application/pdf',
  handler: async (req, res) => {
    const s = await slips.slipById(req.params.id);
    const offer = req.query.insurerId ? s.offers.find((o) => Number(o.insuranceCompanyId) === Number(req.query.insurerId)) : null;
    sendPdf(res, buildPdf(await brokerSlipDoc(s, offer)), `broker-slip-${s.slipNumber}${offer ? `-${offer.insuranceCompanyId}` : ''}.pdf`);
  },
});

// ---------------------------------------------------------------- Placement slips
const { router, define } = moduleRouter('Placement Slips', '/placements');
const PS = 'Operations > Sales & Marketing > Placement Slips';
const participantExample = { participantId: 11, insuranceCompanyId: 2, insuranceCompanyName: 'Malayan Insurance Co., Inc.', isLead: true, sharePercent: 60, sumInsured: 51000000, premium: 127500, taxes: 18933.75, premiumTotal: 146433.75, commissionAmount: 19125, insurerReference: null, status: 'pending' };
const placementExample = { placementId: 'plc_1', placementNumber: 'PS-2026-00001', source: 'quote', status: 'draft', placementStatus: 'Draft', quotationNumber: 'QT-2026-00007', insuredName: 'Cebu Cold Storage Corp.',
  productType: 'Fire and Allied Perils', lob: 'FIRE', sumInsured: 85000000, netPremium: 212500, grossPremium: 244056.25, inceptionDate: '2026-10-01', expiryDate: '2027-10-01', participants: [participantExample] };
const placementBody = z.object({
  quoteId: z.string().optional(), brokerSlipId: z.string().optional(), offerIds: z.array(z.string()).optional(), leadOfferId: z.string().optional().nullable(), shares: z.record(z.union([z.number(), z.string()])).optional(),
  leadRefId: z.string().optional().nullable(), clientId: z.string().optional().nullable(), firstName: z.string().max(100).optional(), lastName: z.string().max(100).optional(), companyName: z.string().max(200).optional(),
  emailId: z.string().max(200).optional().nullable(), contactNumber: z.string().max(40).optional().nullable(),
  productId: z.union([z.number(), z.string()]).optional().nullable(), productType: z.string().max(120).optional(), lob: z.string().max(40).optional(), insuredName: z.string().max(200).optional(),
  riskDetails: z.record(z.any()).optional(), doc: z.record(z.any()).optional(), sumInsured: money, netPremium: money, discount: money, accountPremiumOthers: money, commissionRate: money,
  insuranceCompanyId: z.union([z.number(), z.string()]).optional(), insuranceCompanyName: z.string().optional(),
  participants: z.array(participantBody).optional(), inceptionDate: z.string().optional().nullable(), expiryDate: z.string().optional().nullable(),
  billingMode: z.enum(['broker', 'direct']).optional().nullable(), remarks: z.string().max(2000).optional().nullable(),
});

define({
  method: 'GET', path: '/journey', summary: 'Placement journey for a line of business / product type: the business type default (placement.journey_by_business_type) overridden by placement.journey; brokerSlip, quotationSlip, placementSlip, directPolicy = required | optional | skip',
  screen: `${PS} / Quotation > Send to insurer`, middleware: canRead, query: { lob: 'FIRE', productType: 'Fire and Allied Perils' },
  response: { success: true, data: { brokerSlip: 'optional', quotationSlip: 'optional', placementSlip: 'required', directPolicy: 'optional', lob: 'FIRE', businessType: 'non_package', source: 'businessType', key: 'non_package' } },
  handler: async (req, res) => res.json({ success: true, data: await journeyFor({ lob: req.query.lob, productType: req.query.productType, productId: req.query.productId }) }),
});
define({
  method: 'GET', path: '/options', summary: 'Reference data of the placement screens: active insurers (insurer master), products with their LOB, business type, customer segment and journey (businessType=package | non_package filters them), default billing mode',
  // reference data only: also read by the premium charges calculator (Master > Finance > Premium Taxes & LGU Rates)
  screen: `${PS} / ${BS} (forms)`, middleware: [requireAuth, requirePermission('read:quotations', 'write:premium-charges')], query: { businessType: 'non_package' },
  response: { success: true, data: { insurers: [{ id: 2, code: 'MALAYAN', name: 'Malayan Insurance Co., Inc.', commissionRate: 0.15 }], products: [{ id: 3, code: 'FIRE', name: 'Fire and Allied Perils', lob: 'FIRE', businessType: 'non_package', customerSegment: 'corporate', journey: { placementSlip: 'required' } }], defaultBillingMode: 'broker' } },
  handler: async (req, res) => {
    const insurers = await many(`SELECT id, code, name, short_name AS "shortName", commission_rate AS "commissionRate", contact_email AS "contactEmail"
      FROM insurance_companies WHERE status = 'active' ORDER BY name`);
    const businessType = ['package', 'non_package'].includes(req.query.businessType) ? req.query.businessType : null;
    const products = [];
    for (const p of await many(`SELECT id, code, name, line, business_type, customer_segment FROM products
      WHERE status = 'active' AND ($1::text IS NULL OR business_type = $1) ORDER BY name`, [businessType])) {
      const journey = await journeyFor({ productId: p.id, productType: p.name });
      products.push({ id: p.id, code: p.code, name: p.name, line: p.line, lob: journey.lob, businessType: p.business_type, customerSegment: p.customer_segment, journey });
    }
    const defaultBillingMode = (await getSetting('direct_bill.default_billing_mode', 'broker')) || 'broker';
    res.json({ success: true, data: { insurers: insurers.map((i) => ({ ...i, commissionRate: i.commissionRate === null ? null : Number(i.commissionRate) })), products, defaultBillingMode } });
  },
});
define({
  method: 'GET', path: '/', summary: 'List placement slips (status (comma-separated), source, lob, quoteId, brokerSlipId, clientId, insurerId, search; paging) with status counts', screen: PS, middleware: canRead,
  query: { status: 'draft,sent', search: 'PS-2026' }, response: { success: true, data: [placementExample], total: 1, counts: { draft: 1 } },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows, counts } = await plc.listPlacements(await withScope(req), pg);
    res.json({ success: true, data: rows.map((r) => plc.toPlacement(r)), total, counts, page: pg.page, pageSize: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'POST', path: '/', summary: 'Create a placement slip: from an accepted quotation (quoteId), from broker slip offers (brokerSlipId + offerIds) or directly (client / lead or new insured, product, insurer(s) with shares, risk, agreed net premium)',
  screen: `${PS} > New`, middleware: [...canWrite, validate(placementBody), ownRecord('quote', (req) => req.body.quoteId), ownRecord('broker_slip', (req) => req.body.brokerSlipId),
    ownRecord('lead', (req) => req.body.leadRefId), ownRecord('client', (req) => req.body.clientId)],
  request: { clientId: 'cl_1', productType: 'Marine Cargo', riskDetails: { voyage: 'Manila to Davao', cargo: 'Canned goods' }, sumInsured: 12000000, netPremium: 36000, inceptionDate: '2026-10-01',
    participants: [{ insuranceCompanyId: 2, sharePercent: 70, isLead: true }, { insuranceCompanyId: 3, sharePercent: 30 }] },
  response: { success: true, ...placementExample },
  handler: async (req, res) => {
    const p = await plc.createPlacement(req.body, req.user);
    await audit(req, { entity: 'placement', entityId: p.id, action: 'create', after: { placementNumber: p.placementNumber, source: p.source, quotationNumber: p.quotationNumber, participants: p.participants.map((x) => `${x.insuranceCompanyName} ${x.sharePercent}%`) } });
    sendEntity(res, p, { status: 201, message: `Placement slip ${p.placementNumber} created` });
  },
});
define({
  method: 'POST', path: '/record-issued-policy', summary: 'Record Issued Policy (direct policy entry): a policy the insurer already issued, with its participants and their policy / certificate numbers; creates a bound placement slip and issues the policy in one step',
  screen: `${PS} / Policy > Record Issued Policy`, middleware: [...canIssue, validate(placementBody.extend({ policyNumber: z.string().max(60).optional().nullable(), issuedDate: z.string().optional().nullable(),
    inceptionDate: z.string().min(1, 'inceptionDate is required'), paymentMethod: z.string().optional() })), ownRecord('lead', (req) => req.body.leadRefId), ownRecord('client', (req) => req.body.clientId)],
  request: { companyName: 'Visayas Logistics Inc.', productType: 'Comprehensive General Liability', policyNumber: 'PIO-CGL-2026-0415', inceptionDate: '2026-09-01', expiryDate: '2027-09-01', sumInsured: 20000000, netPremium: 85000,
    participants: [{ insuranceCompanyId: 3, sharePercent: 100, insurerReference: 'PIO-CGL-2026-0415' }] },
  response: { success: true, data: { policyId: 'pol_1', policyNumber: 'PIO-CGL-2026-0415', placement: placementExample } },
  handler: async (req, res) => {
    const r = await plc.recordIssuedPolicy(req.body, req.user);
    const policy = toPolicy(await getPolicyRow(r.policyId));
    await audit(req, { entity: 'placement', entityId: r.placementId, action: 'record-issued-policy', after: { placementNumber: r.placement.placementNumber, policyNumber: policy.policyNumber } });
    await audit(req, { entity: 'policy', entityId: policy.id, action: 'issue', after: { policyNumber: policy.policyNumber, placement: r.placement.placementNumber, grossPremium: policy.grossPremium } });
    res.status(201).json({ success: true, message: `Policy ${policy.policyNumber} recorded`, policyId: policy.id, policyNumber: policy.policyNumber, data: { policy, placement: r.placement, receivable: r.receivable || null } });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Placement slip with participants (shares, amounts, confirmations), journey and timeline (Broker Slip -> Quotation Slip -> Placement Slip -> Policy)', screen: `${PS} > Detail`,
  middleware: [...canRead, ownRecord('placement')], response: { success: true, ...placementExample, timeline: [{ key: 'quotationSlip', label: 'Quotation Slip', done: true, reference: 'QT-2026-00007' }] },
  handler: async (req, res) => sendEntity(res, await plc.placementById(req.params.id)),
});
define({
  method: 'PUT', path: '/:id', summary: 'Edit a draft / declined placement slip: participants (validated: one lead, shares total 100%), period, billing mode, agreed premium, remarks', screen: `${PS} > Edit`,
  middleware: [...canWrite, ownRecord('placement'), validate(placementBody)], request: { participants: [{ insuranceCompanyId: 2, sharePercent: 50, isLead: true }, { insuranceCompanyId: 4, sharePercent: 50 }] },
  response: { success: true, ...placementExample },
  handler: async (req, res) => {
    const r = await plc.updatePlacement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'placement', entityId: r.after.id, action: 'update', before: r.before, after: plc.toPlacement(await plc.getPlacementRow(r.after.id)) });
    sendEntity(res, r.after, { message: 'Placement slip updated' });
  },
});
define({
  method: 'POST', path: '/:id/send', summary: 'Send the firm order to the participating insurers (queued e-mail per participant showing its share); insurerIds limits it to some', screen: `${PS} > Detail > Send to insurer(s)`,
  middleware: [...canWrite, ownRecord('placement'), validate(z.object({ insurerIds: z.array(z.union([z.number(), z.string()])).optional() }))], request: {},
  response: { success: true, data: { ...placementExample, status: 'sent' }, sent: [{ insurer: 'Malayan Insurance Co., Inc.', email: 'uw@malayan.example' }] },
  handler: async (req, res) => {
    const r = await plc.sendPlacement(req.params.id, req.user, req.body || {});
    await audit(req, { entity: 'placement', entityId: r.placement.id, action: 'send', after: { status: r.placement.status, sent: r.sent.map((s) => s.insurer), failed: r.failed } });
    res.json({ success: true, message: `Placement slip sent to ${r.sent.length} insurer(s)`, sent: r.sent, failed: r.failed, data: r.placement });
  },
});
define({
  method: 'POST', path: '/:id/confirm', summary: 'Record insurer confirmation (binding) per participant with the insurer\'s policy / certificate number; when all have confirmed the placement is Bound',
  screen: `${PS} > Detail > Record confirmation`, middleware: [...canWrite, ownRecord('placement'), validate(z.object({ confirmations: z.array(z.object({
    participantId: z.union([z.number(), z.string()]).optional(), insuranceCompanyId: z.union([z.number(), z.string()]).optional(),
    insurerReference: z.string().trim().min(1, 'insurerReference (the insurer\'s policy / certificate number) is required').max(80), confirmedAt: z.string().optional().nullable(), remarks: z.string().max(1000).optional().nullable(),
  }).refine((c) => c.participantId || c.insuranceCompanyId, { message: 'participantId or insuranceCompanyId is required' })).min(1) }))],
  request: { confirmations: [{ insuranceCompanyId: 2, insurerReference: 'MAL-FI-2026-11881' }] }, response: { success: true, data: { ...placementExample, status: 'bound' } },
  handler: async (req, res) => {
    const p = await plc.confirmPlacement(req.params.id, req.body.confirmations, req.user);
    await audit(req, { entity: 'placement', entityId: p.id, action: 'confirm', after: { status: p.status, confirmations: req.body.confirmations } });
    sendEntity(res, p, { message: p.status === 'bound' ? 'All insurers confirmed: the placement is bound' : 'Confirmation recorded' });
  },
});
define({
  method: 'POST', path: '/:id/decline', summary: 'Record that an insurer declined its line (the placement is Declined until the participants are re-arranged)', screen: `${PS} > Detail > Insurer declined`,
  middleware: [...canWrite, ownRecord('placement'), validate(z.object({ insuranceCompanyId: z.union([z.number(), z.string()]), reason: z.string().max(1000).optional().nullable() }))],
  request: { insuranceCompanyId: 4, reason: 'Capacity exhausted' }, response: { success: true, data: { ...placementExample, status: 'declined' } },
  handler: async (req, res) => {
    const p = await plc.declineParticipant(req.params.id, req.body, req.user);
    await audit(req, { entity: 'placement', entityId: p.id, action: 'decline', after: req.body });
    sendEntity(res, p, { message: 'Declined line recorded' });
  },
});
define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel the placement slip', screen: `${PS} > Detail > Cancel`,
  middleware: [...canWrite, ownRecord('placement'), validate(z.object({ reason: z.string().max(1000).optional().nullable() }))], request: { reason: 'Client withdrew' }, response: { success: true, data: { ...placementExample, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await plc.cancelPlacement(req.params.id, req.body.reason, req.user);
    await audit(req, { entity: 'placement', entityId: r.after.id, action: 'cancel', before: { status: r.before.status }, after: { status: 'cancelled', reason: req.body.reason } });
    sendEntity(res, r.after, { message: 'Placement slip cancelled' });
  },
});
define({
  method: 'POST', path: '/:id/issue-policy', summary: 'Issue the policy from a bound placement slip (client from the lead, policy number, receivable or direct-bill commission, commission accrual, participants copied to the policy)',
  screen: `${PS} > Detail > Issue Policy`, middleware: [...canIssue, ownRecord('placement'), validate(z.object({ policyNumber: z.string().max(60).optional().nullable() }).passthrough())],
  request: { additionalPolicyData: { insuredName: 'Cebu Cold Storage Corp.', paymentMethod: 'Bank transfer' } },
  response: { success: true, data: { policy: { policyId: 'pol_1', policyNumber: 'POL-2026-00012' }, placement: { ...placementExample, status: 'issued' } } },
  handler: async (req, res) => {
    const r = await plc.issueFromPlacement(req.params.id, req.body || {}, req.user);
    const policy = toPolicy(await getPolicyRow(r.policyId));
    await audit(req, { entity: 'placement', entityId: r.placement.id, action: 'issue-policy', after: { policyNumber: policy.policyNumber } });
    await audit(req, { entity: 'policy', entityId: policy.id, action: 'issue', after: { policyNumber: policy.policyNumber, placement: r.placement.placementNumber, grossPremium: policy.grossPremium } });
    res.status(201).json({ success: true, message: `Policy ${policy.policyNumber} issued`, policyId: policy.id, data: { policy, placement: r.placement, receivable: r.receivable || null, commission: r.commission || null } });
  },
});
define({
  method: 'GET', path: '/:id/documents/placement-slip', summary: 'Placement Slip PDF: insurerId= gives that participant\'s slip showing its own share (default: the lead insurer)', screen: `${PS} > Detail > Placement Slip PDF`,
  middleware: [...canRead, ownRecord('placement')], query: { insurerId: 2 }, response: 'application/pdf',
  handler: async (req, res) => {
    const p = await plc.placementById(req.params.id);
    const focus = req.query.insurerId || (req.query.all ? null : p.participants.find((x) => x.isLead)?.insuranceCompanyId);
    sendPdf(res, buildPdf(await placementSlipDoc(p, focus)), `placement-slip-${p.placementNumber}${focus ? `-${focus}` : ''}.pdf`);
  },
});

export default router;
export const mount = '/placements';
export const extraMounts = [['/broker-slips', bs.router]];
