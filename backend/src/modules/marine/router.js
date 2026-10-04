/** Marine cargo open covers API (/marine): Operations > Marine Open Covers. */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { renderPdf, sendPdf } from '../documents/pdf.js';
import { formatters, kv } from '../documents/templates.js';
import { signatoryFor, signatureBlock } from '../documents/signatory.js';
import { printContext } from '../../lib/pdf/index.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Marine open covers', '/marine');
const SCREEN = 'Operations > Marine Open Covers';
const canRead = [requireAuth, requirePermission('read:marine', 'write:marine')];
const canWrite = [requireAuth, requirePermission('write:marine')];

const text = (n) => z.string().max(n).optional().nullable();
const amount = z.coerce.number().min(0);
const rate = z.object({ conveyance: z.string().min(1).max(20), ratePercent: z.coerce.number().positive(), limit: z.coerce.number().positive() });
const coverBody = z.object({
  clientId: z.string().min(1), insuranceCompanyId: z.coerce.number().int(), productId: z.coerce.number().int().optional().nullable(), insurerReference: text(60),
  periodFrom: z.string().min(8).max(10), periodTo: z.string().min(8).max(10), goodsDescription: z.string().trim().min(1).max(1000), voyageScope: text(1000), clauses: text(2000),
  currency: z.string().length(3).optional(), rates: z.array(rate).min(1), markupPercent: z.coerce.number().min(0).max(100).optional(), minimumPremium: amount.optional(),
  estimatedAnnualValue: amount.optional().nullable(), declarationFrequency: z.enum(['monthly', 'quarterly']).optional(), commissionRate: z.coerce.number().min(0).max(1).optional().nullable(),
});
const shipment = z.object({
  shipmentDate: z.string().min(8).max(10), conveyance: z.string().min(1).max(20), vesselName: text(120), voyageFrom: z.string().trim().min(1).max(200), voyageTo: z.string().trim().min(1).max(200),
  billOfLading: text(60), goodsDescription: text(500), packing: text(200), consignee: text(200), invoiceValue: z.coerce.number().positive(), markupPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});
const reasonBody = z.object({ reason: z.string().trim().min(1).max(500) });
const cover = { id: 'ocv_1', coverNumber: 'MOC-2026-00002', clientName: 'Visayas Cold Storage Inc.', insurerName: 'FPG Insurance Co., Inc.', policyNumber: 'POL-2026-00140',
  periodFrom: '2026-10-01', periodTo: '2027-09-30', rates: [{ conveyance: 'Sea', ratePercent: 0.15, limit: 20000000 }, { conveyance: 'Air', ratePercent: 0.1, limit: 5000000 }],
  markupPercent: 10, minimumPremium: 500, declarationFrequency: 'monthly', status: 'active', certificates: 4, billedPremium: 18450.75 };
const certificate = { id: 'occ_1', certificateNumber: 'MIC-2026-000011', kind: 'certificate', shipmentDate: '2026-10-08', conveyance: 'Sea', vesselName: 'MV Lorenzo Pride', voyageFrom: 'Shanghai, China', voyageTo: 'Manila, Philippines',
  invoiceValue: 4200000, markupPercent: 10, insuredValue: 4620000, ratePercent: 0.15, premium: 6930, status: 'issued' };
const declaration = { id: 'ocd_1', declarationNumber: 'MDC-2026-00003', period: '2026-10', shipments: 4, totalInsured: 11880000, premium: 17820, vat: 2138.4, dst: 2227.5, lgt: 35.64, grossPremium: 22221.54, status: 'billed', billNumber: 'INV-2026-00230' };

define({
  method: 'GET', path: '/open-covers', summary: 'Open covers (filter status draft / active / expired / cancelled, search on number, client or policy)', screen: SCREEN, middleware: canRead,
  query: { status: 'active' }, response: { success: true, data: [cover] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listCovers(req.query) }),
});
define({
  method: 'GET', path: '/open-covers/:id', summary: 'One open cover with its certificates and declarations', screen: `${SCREEN} > Open Cover`, middleware: canRead,
  response: { success: true, data: { ...cover, certificateList: [certificate], declarations: [declaration] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getCover(req.params.id) }),
});
define({
  method: 'POST', path: '/open-covers', summary: 'Set up an open cover contract (client, insurer, period, goods, voyages, rate and limit per conveyance, mark-up, minimum premium)', screen: `${SCREEN} > New Open Cover`,
  middleware: [...canWrite, validate(coverBody)], request: { clientId: 'cl_1', insuranceCompanyId: 3, periodFrom: '2026-10-01', periodTo: '2027-09-30', goodsDescription: 'Frozen seafood and meat in reefer containers',
    voyageScope: 'Imports from Asia and Australia to Philippine ports', rates: [{ conveyance: 'Sea', ratePercent: 0.15, limit: 20000000 }], markupPercent: 10, minimumPremium: 500 },
  response: { success: true, data: cover },
  handler: async (req, res) => {
    const c = await svc.createCover(req.body, req.user.id);
    await audit(req, { entity: 'open_cover', entityId: c.id, action: 'create', after: { ...c, certificateList: undefined, declarations: undefined } });
    res.status(201).json({ success: true, message: `Open cover ${c.coverNumber} created`, data: c });
  },
});
define({
  method: 'PUT', path: '/open-covers/:id', summary: 'Change an open cover (an active one: period end, clauses, rates and limits for new certificates)', screen: `${SCREEN} > Open Cover > Edit`,
  middleware: [...canWrite, validate(coverBody.partial())], request: { rates: [{ conveyance: 'Sea', ratePercent: 0.14, limit: 25000000 }] }, response: { success: true, data: cover },
  handler: async (req, res) => {
    const { before, after } = await svc.updateCover(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'open_cover', entityId: after.id, action: 'update', before, after: { ...after, certificateList: undefined, declarations: undefined } });
    res.json({ success: true, message: 'Open cover saved', data: after });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/activate', summary: 'Activate the open cover: its open policy is issued without a bill (premium is billed on the declarations)', screen: `${SCREEN} > Open Cover > Activate`,
  middleware: canWrite, response: { success: true, data: { policyId: 'pol_1' } },
  handler: async (req, res) => {
    const out = await svc.activateCover(req.params.id, req.user);
    await audit(req, { entity: 'open_cover', entityId: req.params.id, action: 'activate', after: out });
    res.json({ success: true, message: 'Open cover activated', data: out });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/cancel', summary: 'Cancel an open cover (no open declaration may remain)', screen: `${SCREEN} > Open Cover > Cancel`, middleware: [...canWrite, validate(reasonBody)],
  request: { reason: 'Client moved its cargo account' }, response: { success: true, data: cover },
  handler: async (req, res) => {
    const { before, after } = await svc.cancelCover(req.params.id, req.body.reason, req.user.id);
    await audit(req, { entity: 'open_cover', entityId: after.id, action: 'cancel', before, after: { status: after.status, reason: req.body.reason } });
    res.json({ success: true, message: 'Open cover cancelled', data: after });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/certificates', summary: 'Issue a marine insurance certificate for a shipment (within the period and the limit of its conveyance; premium = insured value x rate, at least the minimum)',
  screen: `${SCREEN} > Open Cover > Issue Certificate`, middleware: [...canWrite, validate(shipment)],
  request: { shipmentDate: '2026-10-08', conveyance: 'Sea', vesselName: 'MV Lorenzo Pride', voyageFrom: 'Shanghai, China', voyageTo: 'Manila, Philippines', billOfLading: 'SHMNL2610088', invoiceValue: 4200000 },
  response: { success: true, data: certificate },
  handler: async (req, res) => {
    const x = await svc.issueCertificate(req.params.id, req.body, req.user.id, 'certificate');
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'issue', after: x });
    res.status(201).json({ success: true, message: `Certificate ${x.certificateNumber} issued`, data: x });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/declared-items', summary: 'Enter a shipment sent without a certificate, to be declared and billed with its period', screen: `${SCREEN} > Open Cover > Declarations > Add Shipment`,
  middleware: [...canWrite, validate(shipment)], request: { shipmentDate: '2026-10-21', conveyance: 'Air', voyageFrom: 'Singapore', voyageTo: 'Cebu', invoiceValue: 650000 },
  response: { success: true, data: { ...certificate, kind: 'declared' } },
  handler: async (req, res) => {
    const x = await svc.issueCertificate(req.params.id, req.body, req.user.id, 'declared');
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'declare', after: x });
    res.status(201).json({ success: true, message: `Shipment ${x.certificateNumber} entered`, data: x });
  },
});
define({
  method: 'POST', path: '/certificates/:id/cancel', summary: 'Cancel a certificate not yet on a submitted declaration', screen: `${SCREEN} > Open Cover > Certificates > Cancel`, middleware: [...canWrite, validate(reasonBody)],
  request: { reason: 'Shipment did not proceed' }, response: { success: true, data: { ...certificate, status: 'cancelled' } },
  handler: async (req, res) => {
    const x = await svc.cancelCertificate(req.params.id, req.body.reason, req.user.username);
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'cancel', after: { status: x.status, reason: req.body.reason } });
    res.json({ success: true, message: `Certificate ${x.certificateNumber} cancelled`, data: x });
  },
});
define({
  method: 'GET', path: '/certificates/:id/print', summary: 'Marine insurance certificate (PDF)', screen: `${SCREEN} > Open Cover > Certificates > Print`, middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const x = await svc.getCertificateRow(req.params.id);
    const c = await svc.getCoverRow(x.open_cover_id);
    const f = formatters(await printContext());
    const signatory = await signatoryFor(null);
    const pdf = await renderPdf({
      title: x.kind === 'declared' ? 'Declared Shipment' : 'Marine Insurance Certificate', number: x.certificate_number,
      meta: kv([['Open cover', c.cover_number], ['Policy number', c.policy_number], ['Insurer', c.insurer_name], ['Assured', c.client_name], ['Date issued', f.date(String(x.issued_at).slice(0, 10))],
        ['Status', x.status === 'cancelled' ? 'CANCELLED' : '']]),
      sections: [
        { heading: 'Shipment', rows: kv([['Conveyance', x.conveyance], ['Vessel / flight', x.vessel_name], ['Voyage', `${x.voyage_from} to ${x.voyage_to}`], ['Sailing / shipment date', f.date(x.shipment_date)],
          ['Bill of lading / airway bill', x.bill_of_lading], ['Goods', x.goods_description], ['Packing', x.packing], ['Consignee', x.consignee]]) },
        { heading: 'Insured value', rows: kv([['Invoice value', f.ccy(x.invoice_value, c.currency)], ['Mark-up', `${Number(x.markup_percent)}%`], ['Insured value', f.ccy(x.insured_value, c.currency)],
          ['Rate', `${Number(x.rate_percent)}%`], ['Premium', f.ccy(x.premium, c.currency)]]) },
        { heading: 'Conditions', text: c.clauses || 'Institute Cargo Clauses (A), Institute War and Strikes Clauses (Cargo), as per the open cover.' },
        { text: (await getSetting('marine.certificate_wording', null)) || '' },
        { signatures: [signatureBlock('For and on behalf of the insurer', signatory)] },
      ],
    });
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'print' });
    sendPdf(res, pdf, `marine-certificate-${x.certificate_number}.pdf`);
  },
});
define({
  method: 'POST', path: '/open-covers/:id/declarations', summary: 'Open the declaration of a period (YYYY-MM): the shipments of the period are attached and priced with the premium taxes', screen: `${SCREEN} > Open Cover > Declarations > New`,
  middleware: [...canWrite, validate(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) }))], request: { period: '2026-10' }, response: { success: true, data: { ...declaration, status: 'draft' } },
  handler: async (req, res) => {
    const d = await svc.createDeclaration(req.params.id, req.body.period, req.user.id);
    await audit(req, { entity: 'marine_declaration', entityId: d.id, action: 'create', after: { ...d, items: undefined } });
    res.status(201).json({ success: true, message: `Declaration ${d.declarationNumber} opened`, data: d });
  },
});
define({
  method: 'GET', path: '/declarations/:id', summary: 'One declaration with its shipments', screen: `${SCREEN} > Open Cover > Declarations`, middleware: canRead,
  response: { success: true, data: { ...declaration, items: [certificate] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getDeclaration(req.params.id) }),
});
define({
  method: 'POST', path: '/declarations/:id/refresh', summary: 'Recompute a draft declaration (shipments added since)', screen: `${SCREEN} > Open Cover > Declarations > Refresh`, middleware: canWrite,
  response: { success: true, data: declaration },
  handler: async (req, res) => res.json({ success: true, message: 'Declaration recomputed', data: await svc.refreshDeclaration(req.params.id) }),
});
define({
  method: 'POST', path: '/declarations/:id/submit', summary: 'Submit the declaration (no shipments: nil return)', screen: `${SCREEN} > Open Cover > Declarations > Submit`,
  middleware: [...canWrite, validate(z.object({ notes: text(1000) }))], request: { notes: 'Confirmed by the client on 3 November' }, response: { success: true, data: { ...declaration, status: 'submitted' } },
  handler: async (req, res) => {
    const d = await svc.submitDeclaration(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'marine_declaration', entityId: d.id, action: 'submit', after: { status: d.status, premium: d.premium, grossPremium: d.grossPremium } });
    res.json({ success: true, message: d.status === 'nil' ? 'Nil declaration recorded' : `Declaration ${d.declarationNumber} submitted`, data: d });
  },
});
define({
  method: 'POST', path: '/declarations/:id/bill', summary: 'Bill a submitted declaration on the open policy (premium receivable, booking journal, collection item)', screen: `${SCREEN} > Open Cover > Declarations > Bill`,
  middleware: canWrite, response: { success: true, data: { receivableId: 'rcv_1', billNumber: 'INV-2026-00230', amount: 22221.54 } },
  handler: async (req, res) => {
    const out = await svc.billDeclaration(req.params.id, req.user);
    await audit(req, { entity: 'marine_declaration', entityId: req.params.id, action: 'bill', after: out });
    res.json({ success: true, message: `Bill ${out.billNumber} raised`, data: out });
  },
});
define({
  method: 'DELETE', path: '/declarations/:id', summary: 'Delete a draft declaration (its shipments become undeclared again)', screen: `${SCREEN} > Open Cover > Declarations > Delete`, middleware: canWrite,
  response: { success: true, data: { declarationNumber: 'MDC-2026-00003' } },
  handler: async (req, res) => {
    const d = await svc.deleteDeclaration(req.params.id);
    await audit(req, { entity: 'marine_declaration', entityId: d.id, action: 'delete', before: d });
    res.json({ success: true, message: 'Declaration deleted', data: d });
  },
});
define({
  method: 'GET', path: '/declarations/:id/print', summary: 'Declaration of shipments (PDF) with the premium and taxes of the period', screen: `${SCREEN} > Open Cover > Declarations > Print`, middleware: canRead,
  response: 'application/pdf',
  handler: async (req, res) => {
    const d = await svc.getDeclaration(req.params.id);
    const c = await svc.getCoverRow(d.openCoverId);
    const f = formatters(await printContext());
    const items = d.items.filter((x) => x.status !== 'cancelled');
    const pdf = await renderPdf({
      title: 'Declaration of Shipments', number: d.declarationNumber, orientation: 'landscape',
      meta: kv([['Open cover', c.cover_number], ['Policy number', c.policy_number], ['Assured', c.client_name], ['Insurer', c.insurer_name],
        ['Period', `${f.date(d.periodFrom)} to ${f.date(d.periodTo)}`], ['Status', d.status], ['Bill', d.billNumber]]),
      sections: [
        { heading: 'Shipments', table: {
          columns: [{ key: 'certificateNumber', label: 'Certificate' }, { key: 'shipmentDate', label: 'Date' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'voyage', label: 'Voyage' },
            { key: 'vesselName', label: 'Vessel / flight' }, { key: 'insuredValue', label: 'Insured value', type: 'money' }, { key: 'ratePercent', label: 'Rate %', type: 'number' },
            { key: 'premium', label: 'Premium', type: 'money' }],
          rows: items.map((x) => ({ ...x, shipmentDate: f.date(x.shipmentDate), voyage: `${x.voyageFrom} to ${x.voyageTo}`, vesselName: x.vesselName || '' })),
          totals: { certificateNumber: `${items.length} shipment(s)`, insuredValue: d.totalInsured, premium: d.premium } } },
        { heading: 'Premium', rows: kv([['Premium', f.ccy(d.premium, c.currency)], ['VAT', f.ccy(d.vat, c.currency)], ['Documentary stamp tax', f.ccy(d.dst, c.currency)],
          ['Local government tax', f.ccy(d.lgt, c.currency)], ['Other charges', d.otherCharges ? f.ccy(d.otherCharges, c.currency) : ''], ['Total premium due', f.ccy(d.grossPremium, c.currency)]]) },
      ],
    });
    sendPdf(res, pdf, `marine-declaration-${d.declarationNumber}.pdf`);
  },
});

export default router;
export const mount = '/marine';
