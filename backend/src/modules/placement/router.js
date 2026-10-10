/**
 * Placement journey API: Broker Slips (market submission, insurer offers, comparison), Placement Slips (raised, sent to
 * the insurer with the slip, acknowledged, e-policy received, checked against the slip by a second user, booked once
 * the insurer has issued) and the journey configuration per line of business. Access follows the quotation permissions
 * (Sales & Marketing, Processing Team, Operations); booking the policy, and accepting an e-policy that differs from the
 * slip, also need write:policies.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { badRequest } from '../../lib/errors.js';
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
import { productLines } from './productLines.js';
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';

const canRead = [requireAuth, requirePermission('read:quotations')];
const canWrite = [requireAuth, requirePermission('write:quotations')];
const canIssue = [requireAuth, requirePermission('write:quotations'), requirePermission('write:policies')];
// the check against the slip is the checker's step of the placement: approve:policies (migration 0348)
const canCheck = [requireAuth, requirePermission('write:quotations'), requirePermission('approve:policies')];

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
const placementExample = { placementId: 'plc_1', placementNumber: 'PS-2026-00001', source: 'quote', status: 'draft', placementStatus: 'PlacementRaised', quotationNumber: 'QT-2026-00007', insuredName: 'Cebu Cold Storage Corp.',
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
  method: 'GET', path: '/product-lines', summary: 'Products grouped by line of business for the product pickers: active lines (Line of Business master) with their active products (Product master); businessType=package | non_package filters the products',
  screen: 'Operations > Sales & Marketing > Prospects (Create Prospect, Tag product), Quick Quote, Quotations (Create Quote), Request for Quotation, Placement Slips',
  middleware: [requireAuth, requirePermission('read:quotations', 'read:leads')], query: { businessType: 'package' },
  response: { success: true, data: { lines: [{ code: 'ACCIDENT', name: 'Personal Accident', products: [{ id: 9, code: 'PA', name: 'Personal Accident', line: 'ACCIDENT', lob: 'ACCIDENT', businessType: 'package', customerSegment: 'retail' }] }] } },
  handler: async (req, res) => {
    const businessType = ['package', 'non_package'].includes(req.query.businessType) ? req.query.businessType : null;
    res.json({ success: true, data: { lines: await productLines({ businessType }) } });
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
  method: 'GET', path: '/:id', summary: 'Placement slip with participants (shares, amounts, insurer references), acknowledgement, e-policy, check against the slip, journey and timeline (Placement raised -> Sent to insurer -> Acknowledged -> e-Policy received -> Checked against slip -> Insurer issued)',
  screen: `${PS} > Detail`, middleware: [...canRead, ownRecord('placement')],
  response: { success: true, ...placementExample, timeline: [{ key: 'quotationSlip', label: 'Quotation Slip', done: true, reference: 'QT-2026-00007' }, { key: 'acknowledged', label: 'Acknowledged', done: false }] },
  handler: async (req, res) => sendEntity(res, await plc.placementById(req.params.id)),
});
define({
  method: 'PUT', path: '/:id', summary: 'Edit a draft / declined placement slip: participants (validated: one lead, shares total 100%), period, billing mode, agreed premium, remarks; the stored slip PDF is generated again', screen: `${PS} > Edit`,
  middleware: [...canWrite, ownRecord('placement'), validate(placementBody)], request: { participants: [{ insuranceCompanyId: 2, sharePercent: 50, isLead: true }, { insuranceCompanyId: 4, sharePercent: 50 }] },
  response: { success: true, ...placementExample },
  handler: async (req, res) => {
    const r = await plc.updatePlacement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'placement', entityId: r.after.id, action: 'update', before: r.before, after: plc.toPlacement(await plc.getPlacementRow(r.after.id)) });
    sendEntity(res, r.after, { message: 'Placement slip updated' });
  },
});
define({
  method: 'POST', path: '/:id/send', summary: 'Send the firm order to the participating insurers: one queued e-mail per participant with its placement slip PDF (its own share) and any LTO document attached; insurerIds limits it to some. A sent or acknowledged placement can be sent again', screen: `${PS} > Detail > Send to insurer`,
  middleware: [...canWrite, ownRecord('placement'), validate(z.object({ insurerIds: z.array(z.union([z.number(), z.string()])).optional() }))], request: {},
  response: { success: true, data: { ...placementExample, status: 'sent' }, sent: [{ insurer: 'Malayan Insurance Co., Inc.', email: 'uw@malayan.example' }] },
  handler: async (req, res) => {
    const r = await plc.sendPlacement(req.params.id, req.user, req.body || {});
    await audit(req, { entity: 'placement', entityId: r.placement.id, action: 'send', before: { status: r.previousStatus },
      after: { status: r.placement.status, sent: r.sent.map((s) => s.insurer), failed: r.failed.map((f) => f.insurer) } });
    res.json({ success: true, message: `Placement slip sent to ${r.sent.length} insurer(s)`, sent: r.sent, failed: r.failed, data: r.placement });
  },
});
define({
  method: 'POST', path: '/:id/acknowledge', summary: 'Record the insurer\'s acknowledgement of the order (Sent to insurer -> Acknowledged): its reference, date and remark', screen: `${PS} > Detail > Record acknowledgement`,
  middleware: [...canWrite, ownRecord('placement'), validate(z.object({ reference: z.string().trim().max(80).optional().nullable(), acknowledgedAt: z.string().optional().nullable(),
    remarks: z.string().max(1000).optional().nullable() }))],
  request: { reference: 'MAL-ACK-2026-0412', remarks: 'Acknowledged by the motor underwriting desk' }, response: { success: true, data: { ...placementExample, status: 'acknowledged', placementStatus: 'Acknowledged' } },
  handler: async (req, res) => {
    const p = await plc.acknowledgePlacement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'placement', entityId: p.id, action: 'acknowledge', before: { status: 'sent' }, after: { status: p.status, reference: req.body.reference || null, remarks: req.body.remarks || null } });
    sendEntity(res, p, { message: 'Insurer acknowledgement recorded' });
  },
});
const vehicleBody = z.object({ chassisNumber: z.string().max(60).optional().nullable(), motorNumber: z.string().max(60).optional().nullable(),
  plateNumber: z.string().max(20).optional().nullable(), mvFileNumber: z.string().max(40).optional().nullable() });
const epolicyBody = z.object({
  documentKey: z.string().min(1, 'documentKey (the e-policy file uploaded through /s3/upload) is required').max(500), documentName: z.string().max(255).optional().nullable(),
  insurerPolicyNumber: z.string().trim().min(1, 'insurerPolicyNumber is required').max(60), brokerPolicyNumber: z.string().trim().max(60).optional().nullable(),
  participantName: z.string().trim().min(1, 'participantName (the insured named on the policy) is required').max(200),
  sumInsured: z.coerce.number().min(0), netPremium: z.coerce.number().positive('netPremium must be more than 0'), grossPremium: money, commissionAmount: money,
  issueDate: z.string().min(1, 'issueDate is required'), issuanceDate: z.string().optional().nullable(), effectiveDate: z.string().min(1, 'effectiveDate is required'),
  expiryDate: z.string().optional().nullable(), productionDate: z.string().optional().nullable(), deductible: z.string().max(500).optional().nullable(),
  vehicle: vehicleBody.optional().nullable(), vehiclePhotoKey: z.string().max(500).optional().nullable(), vehiclePhotoName: z.string().max(255).optional().nullable(),
  participants: z.array(z.object({ insuranceCompanyId: z.union([z.number(), z.string()]), insurerReference: z.string().trim().max(80).optional().nullable() })).optional(),
  remarks: z.string().max(2000).optional().nullable(),
});
const checkExample = { result: 'mismatch', tolerance: { amount: 1, percent: 0 }, differences: ['netPremium'],
  items: [{ key: 'netPremium', label: 'Net premium', slip: 18250, epolicy: 18400, difference: 150, status: 'mismatch' }, { key: 'plateNumber', label: 'Plate number', slip: null, epolicy: 'NCA 4521', difference: null, status: 'captured' }] };
define({
  method: 'POST', path: '/:id/epolicy', summary: 'Record the e-policy returned by the insurer (Sent / Acknowledged -> e-Policy received): the uploaded PDF (documentKey from /s3/upload), insurer and BrokerVerse policy numbers, participant name, sum insured, premium, commission, issue / issuance / effective / expiry / production dates, deductible, vehicle identifiers (plate or MV file mandatory for motor, TBA not accepted), optional vehicle photo; compared with the slip at once',
  screen: `${PS} > Detail > Upload e-policy / Record e-Policy`, middleware: [...canWrite, ownRecord('placement'), validate(epolicyBody)],
  request: { documentKey: 'placement-epolicies/1767225600-ab12-e-policy.pdf', documentName: 'MAL-MC-2026-004512.pdf', insurerPolicyNumber: 'MAL-MC-2026-004512', participantName: 'Maria Santos',
    sumInsured: 1250000, netPremium: 18250, grossPremium: 22813.13, commissionAmount: 2737.5, issueDate: '2026-10-05', effectiveDate: '2026-10-06', expiryDate: '2027-10-06',
    vehicle: { chassisNumber: 'MHFXW42G5P0077777', motorNumber: '2NRX777777', plateNumber: 'NCA 4521' } },
  response: { success: true, data: { ...placementExample, status: 'epolicy_received', placementStatus: 'EPolicyReceived', check: checkExample } },
  handler: async (req, res) => {
    const p = await plc.recordEpolicy(req.params.id, req.body, req.user);
    await audit(req, { entity: 'placement', entityId: p.id, action: 'record-epolicy', after: { status: p.status, insurerPolicyNumber: p.epolicy.insurerPolicyNumber, document: p.epolicy.documentName,
      check: p.check?.status, differences: p.check?.differences } });
    sendEntity(res, p, { message: p.check?.status === 'match' ? 'e-Policy recorded: it matches the slip' : 'e-Policy recorded: it differs from the slip' });
  },
});
define({
  method: 'GET', path: '/:id/check', summary: 'Check against slip: the slip and the e-policy side by side with the differences (tolerance placement.check_tolerance_amount / placement.check_tolerance_pct, items placement.check_fields)',
  screen: `${PS} > Detail > Check against slip`, middleware: [...canRead, ownRecord('placement')], response: { success: true, data: checkExample },
  handler: async (req, res) => {
    const row = await plc.getPlacementRow(req.params.id);
    if (!row.epolicy_received_at) throw badRequest('No e-policy has been recorded for this placement slip');
    res.json({ success: true, data: await plc.compareWithSlip(row) });
  },
});
define({
  method: 'POST', path: '/:id/check', summary: 'Decide the check against the slip (approve:policies; never the user who recorded the e-policy): confirm (matches -> Checked), accept (differences accepted with a reason by an approver with write:policies -> Checked) or return (back to the insurer with the differences -> Acknowledged)',
  screen: `${PS} > Detail > Confirm check / Return to insurer`, middleware: [...canCheck, ownRecord('placement'), validate(z.object({ decision: z.enum(['confirm', 'accept', 'return']), reason: z.string().max(2000).optional().nullable() }))],
  request: { decision: 'return', reason: 'Premium on the e-policy is PHP 150.00 above the agreed premium' },
  response: { success: true, data: { ...placementExample, status: 'acknowledged' }, comparison: checkExample, mail: { to: 'uw@malayan.example', emailId: 812 } },
  handler: async (req, res) => {
    const r = await plc.checkPlacement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'placement', entityId: r.placement.id, action: `check-${req.body.decision}`, before: { status: 'epolicy_received' },
      after: { status: r.placement.status, result: r.comparison.result, differences: r.comparison.differences, reason: req.body.reason || null, mailedTo: r.mail?.to || null } });
    const message = { confirm: 'Checked against the slip', accept: 'Differences accepted: checked against the slip', return: 'e-Policy returned to the insurer' }[req.body.decision];
    sendEntity(res, r.placement, { message, extra: { comparison: r.comparison, mail: r.mail } });
  },
});
define({
  method: 'POST', path: '/:id/decline', summary: 'Record that an insurer declined its line before issuing (the placement is Declined until the participants are re-arranged)', screen: `${PS} > Detail > Insurer declined`,
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
  method: 'POST', path: '/:id/book', summary: 'Book the checked placement (Insurer issued): the policy is created with the e-policy numbers and dates and comes into force; bill or direct-bill commission, journal, commission accrual, participants copied, cover notes superseded, policy schedule e-mailed to the client. The only way a policy is issued for TISPH',
  screen: `${PS} > Detail > Book (Insurer issued)`, middleware: [...canIssue, ownRecord('placement'), validate(z.object({ additionalPolicyData: z.record(z.any()).optional() }).passthrough())],
  request: { additionalPolicyData: { idType: 'PhilSys ID', idCardNumber: '1234-5678-9012-3456', idCardImage: 'id-cards/maria.jpg', paymentMethod: 'Bank transfer' } },
  response: { success: true, data: { policy: { policyId: 'pol_1', policyNumber: 'POL-2026-00012' }, placement: { ...placementExample, status: 'issued', placementStatus: 'InsurerIssued' }, schedule: { emailId: 813, to: 'maria.santos@example.ph' } } },
  handler: async (req, res) => {
    const r = await plc.bookPlacement(req.params.id, req.body || {}, req.user);
    const policy = toPolicy(await getPolicyRow(r.policyId));
    await audit(req, { entity: 'placement', entityId: r.placement.id, action: 'book', before: { status: 'checked' }, after: { status: 'issued', policyNumber: policy.policyNumber, insurerPolicyNumber: r.placement.epolicy?.insurerPolicyNumber } });
    await audit(req, { entity: 'policy', entityId: policy.id, action: 'issue', after: { policyNumber: policy.policyNumber, placement: r.placement.placementNumber, grossPremium: policy.grossPremium, scheduleEmailedTo: r.schedule?.to || null } });
    res.status(201).json({ success: true, message: `Policy ${policy.policyNumber} booked`, policyId: policy.id,
      data: { policy, placement: r.placement, receivable: r.receivable || null, commission: r.commission || null, schedule: r.schedule } });
  },
});
define({
  method: 'GET', path: '/:id/documents/placement-slip', summary: 'Placement Slip PDF: insurerId= gives that participant\'s slip showing its own share (default: the lead insurer); the file stored when the placement was raised is slipDocument.key', screen: `${PS} > Detail > Placement Slip PDF`,
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
