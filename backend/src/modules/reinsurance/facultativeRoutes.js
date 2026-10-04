/** Facultative placements API (/reinsurance/facultative), mounted by the reinsurance module: Reinsurance > Facultative Placements. */
import { moduleRouter } from '../../lib/registry.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { queueEmail, documentAttachment, emailSendingStatus } from '../../lib/mailer.js';
import { one } from '../../db/pool.js';
import { canRead, canWrite } from '../masters/helpers.js';
import { sendTable } from '../documents/tabular.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { renderReportPdf } from '../../lib/pdf/index.js';
import { isoDate } from '../../lib/dates.js';
import * as fac from './facultative.js';
import { facDocumentSpec, FAC_DOCUMENTS } from './facultativeDocs.js';

const { router, define } = moduleRouter('Reinsurance', '/reinsurance/facultative');
const SCREEN = 'Reinsurance > Facultative Placements';
const read = canRead('reinsurance');
const write = canWrite('reinsurance');

const text = (n) => z.string().max(n).optional().nullable();
const shareBody = z.object({ reinsurerId: z.string().min(1), sharePct: z.coerce.number().min(0).max(100), status: z.enum(['approached', 'quoted', 'accepted', 'declined']).optional(),
  reinsurerReference: text(60), notes: text(500) });
const body = z.object({
  cedantId: z.coerce.number().int(), cedantPolicyNumber: text(60), policyId: text(40), insuredName: z.string().trim().min(1).max(200), riskDescription: z.string().trim().min(1).max(2000),
  riskLocation: text(500), lineOfBusiness: text(60), periodFrom: z.string().min(8).max(10), periodTo: z.string().min(8).max(10), currency: z.string().length(3).optional(),
  sumInsured: z.coerce.number().positive(), grossPremium: z.coerce.number().positive(), facSharePct: z.coerce.number().positive().max(100),
  cedingCommissionPct: z.coerce.number().min(0).max(99).optional(), brokeragePct: z.coerce.number().min(0).max(99).optional(), deductibles: text(1000), conditions: text(2000), claimsBasis: text(500),
  shares: z.array(shareBody).optional(),
});
const settleBody = z.object({ direction: z.enum(['received', 'paid']), shareId: z.coerce.number().int().optional().nullable(), amount: z.coerce.number().positive(),
  settledOn: text(10), reference: text(80), bankAccount: text(40), paymentMode: text(30) });
const example = { id: 'fac_1', slipNumber: 'FAC-2026-00003', cedantName: 'Pioneer Insurance & Surety Corp.', insuredName: 'Mindanao Power Holdings Inc.', riskDescription: 'Coal-fired power plant, property damage and machinery breakdown',
  sumInsured: 4500000000, grossPremium: 6750000, facSharePct: 40, facPremium: 2700000, cedingCommissionPct: 25, brokeragePct: 10, cedingCommission: 675000, brokerage: 270000, dueFromCedant: 2025000,
  status: 'bound', placedPct: 100, shares: [{ id: 1, reinsurerName: 'Swiss Re Asia Pte Ltd', sharePct: 60, status: 'accepted', premium: 1620000, netPremium: 1053000 }] };

define({
  method: 'GET', path: '/', summary: 'Facultative slips (filter status, cedantId, search on slip, insured or original policy)', screen: SCREEN, middleware: read,
  query: { status: 'in-market' }, response: { success: true, data: [example] },
  handler: async (req, res) => res.json({ success: true, data: await fac.listPlacements(req.query) }),
});
define({
  method: 'GET', path: '/bordereau', summary: 'Facultative premium bordereau of bound lines (from, to, reinsurerId; format xlsx, csv or pdf)', screen: `${SCREEN} > Bordereau`, middleware: read,
  query: { from: '2026-10-01', to: '2026-10-31', reinsurerId: 'RE002', format: 'xlsx' }, response: 'binary file',
  handler: async (req, res) => {
    const from = isoDate(req.query.from);
    const to = isoDate(req.query.to);
    if (!from || !to || to < from) throw badRequest('Validation failed', [{ path: 'to', message: 'Give the period (from and to)' }]);
    const rows = await fac.bordereauRows({ from, to, reinsurerId: req.query.reinsurerId || null });
    const fileBase = `facultative-bordereau-${from}-${to}`;
    if (req.query.format === 'pdf') {
      const totals = Object.fromEntries(['premium', 'ceding_commission', 'brokerage', 'net_premium', 'paid_amount', 'outstanding'].map((k) => [k, rows.reduce((s, r) => s + Number(r[k]), 0)]));
      const columns = fac.BORDEREAU_COLUMNS.map((c) => ({ ...c, type: ['premium', 'ceding_commission', 'brokerage', 'net_premium', 'paid_amount', 'outstanding', 'sum_insured_share'].includes(c.key) ? 'money' : undefined }));
      return sendPdf(res, await renderReportPdf({ title: 'Facultative Premium Bordereau', params: `${from} to ${to}`, columns, rows, totals }), `${fileBase}.pdf`);
    }
    return sendTable(res, { header: fac.BORDEREAU_COLUMNS.map((c) => c.label), rows: rows.map((r) => fac.BORDEREAU_COLUMNS.map((c) => r[c.key])), fileBase,
      format: req.query.format === 'csv' ? 'csv' : 'xlsx', sheetName: 'Bordereau' });
  },
});
define({
  method: 'POST', path: '/bordereau', summary: 'Generate and keep the facultative bordereau of a month for a reinsurer (listed with the other bordereaux, type Facultative)', screen: `${SCREEN} > Bordereau > Generate`,
  middleware: [...write, validate(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/), reinsurerId: z.string().min(1) }))], request: { period: '2026-10', reinsurerId: 'RE002' },
  response: { success: true, data: { reference: 'BDX-2026-00012', entries: 3, totals: { premium: 1620000, netPremium: 1053000 } } },
  handler: async (req, res) => {
    const out = await fac.generateBordereau(req.body, req.user);
    await audit(req, { entity: 'bordereau', entityId: out.id, action: 'generate', after: out });
    res.status(201).json({ success: true, message: `Bordereau ${out.reference} generated`, data: out });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'One facultative slip with its lines and settlements', screen: `${SCREEN} > Slip`, middleware: read, response: { success: true, data: example },
  handler: async (req, res) => res.json({ success: true, data: await fac.getPlacement(req.params.id) }),
});
define({
  method: 'POST', path: '/', summary: 'Prepare a facultative slip for a cedant\'s risk (share offered, reinsurance commission, brokerage; reinsurers to approach)', screen: `${SCREEN} > New Slip`,
  middleware: [...write, validate(body)], request: { cedantId: 4, insuredName: 'Mindanao Power Holdings Inc.', riskDescription: 'Coal-fired power plant', periodFrom: '2026-11-01', periodTo: '2027-11-01',
    sumInsured: 4500000000, grossPremium: 6750000, facSharePct: 40, cedingCommissionPct: 25, brokeragePct: 10, shares: [{ reinsurerId: 'RE002', sharePct: 60 }, { reinsurerId: 'RE003', sharePct: 40 }] },
  response: { success: true, data: { ...example, status: 'draft' } },
  handler: async (req, res) => {
    const p = await fac.createPlacement(req.body, req.user.id);
    await audit(req, { entity: 'fac_placement', entityId: p.id, action: 'create', after: p });
    res.status(201).json({ success: true, message: `Slip ${p.slipNumber} prepared`, data: p });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change the terms of a slip (draft or in the market)', screen: `${SCREEN} > Slip > Edit`, middleware: [...write, validate(body.partial())],
  request: { brokeragePct: 12.5 }, response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await fac.updatePlacement(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'fac_placement', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Slip saved', data: after });
  },
});
define({
  method: 'POST', path: '/:id/shares', summary: 'Add or change a reinsurer\'s line (approached, quoted, accepted, declined); the slip is placed when the accepted lines reach 100%', screen: `${SCREEN} > Slip > Lines`,
  middleware: [...write, validate(shareBody)], request: { reinsurerId: 'RE002', sharePct: 60, status: 'accepted', reinsurerReference: 'SRA-FAC-77812' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const p = await fac.saveShare(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'fac_placement', entityId: p.id, action: 'line', after: req.body });
    res.json({ success: true, message: p.status === 'placed' ? 'Line saved: the slip is fully placed' : 'Line saved', data: p });
  },
});
define({
  method: 'DELETE', path: '/:id/shares/:shareId', summary: 'Remove a reinsurer from the slip', screen: `${SCREEN} > Slip > Lines`, middleware: write, response: { success: true, data: example },
  handler: async (req, res) => {
    const p = await fac.removeShare(req.params.id, req.params.shareId);
    await audit(req, { entity: 'fac_placement', entityId: p.id, action: 'remove-line', before: { shareId: req.params.shareId } });
    res.json({ success: true, message: 'Line removed', data: p });
  },
});
define({
  method: 'POST', path: '/:id/send', summary: 'Send the slip to the market (status in-market); with email=true the slip PDF is queued to each approached reinsurer\'s contact', screen: `${SCREEN} > Slip > Send to Market`,
  middleware: [...write, validate(z.object({ email: z.boolean().optional() }))], request: { email: true }, response: { success: true, data: { ...example, status: 'in-market' }, queued: 2 },
  handler: async (req, res) => {
    const p = await fac.sendToMarket(req.params.id, req.user.id);
    let queued = 0;
    if (req.body.email) {
      for (const s of p.shares.filter((x) => x.status !== 'declined')) {
        const r = await one('SELECT contact FROM reinsurers WHERE id = $1', [s.reinsurerId]);
        const to = r?.contact?.email;
        if (!to) continue;
        await queueEmail({ to, subject: `Facultative offer ${p.slipNumber}: ${p.insuredName}`, html: `<p>Please find attached our facultative slip ${p.slipNumber} for ${p.insuredName}. We would be glad to receive your line.</p>`,
          template: 'fac-slip', entity: 'fac_placement', entityId: p.id, attachments: [documentAttachment('fac-slip', { placementId: p.id, kind: 'slip' }, `slip-${p.slipNumber}.pdf`)] });
        queued += 1;
      }
    }
    await audit(req, { entity: 'fac_placement', entityId: p.id, action: 'send', after: { status: p.status, emailed: queued } });
    const sending = await emailSendingStatus();
    res.json({ success: true, message: queued ? `Slip in the market; ${queued} e-mail(s) queued${sending.active ? '' : ' (they go out once e-mail sending is enabled)'}` : 'Slip in the market', data: p, queued });
  },
});
define({
  method: 'POST', path: '/:id/bind', summary: 'Bind a fully placed slip: amounts per line and the journal (due from cedant, due to each reinsurer, brokerage)', screen: `${SCREEN} > Slip > Bind`, middleware: write,
  response: { success: true, data: { journalNumber: 'JV-2026-00412', dueFromCedant: 2025000, brokerage: 270000, cedingCommission: 675000, lines: 2 } },
  handler: async (req, res) => {
    const out = await fac.bindPlacement(req.params.id, req.user);
    await audit(req, { entity: 'fac_placement', entityId: req.params.id, action: 'bind', after: out });
    res.json({ success: true, message: `Slip bound; journal ${out.journalNumber}`, data: out });
  },
});
define({
  method: 'POST', path: '/:id/settlements', summary: 'Record premium received from the cedant or paid to a reinsurer line (journal); the slip closes when both sides are settled', screen: `${SCREEN} > Slip > Settlements`,
  middleware: [...write, validate(settleBody)], request: { direction: 'paid', shareId: 1, amount: 1053000, settledOn: '2026-12-15', reference: 'TT-55881', bankAccount: 'BDO-CA-001' },
  response: { success: true, data: { journalNumber: 'JV-2026-00430', closed: false } },
  handler: async (req, res) => {
    const out = await fac.recordSettlement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'fac_placement', entityId: req.params.id, action: `settlement-${req.body.direction}`, after: { ...req.body, ...out } });
    res.json({ success: true, message: out.closed ? 'Settlement recorded; the slip is fully settled and closed' : 'Settlement recorded', data: out });
  },
});
define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel a slip not yet bound', screen: `${SCREEN} > Slip > Cancel`, middleware: [...write, validate(z.object({ reason: z.string().trim().min(1).max(500) }))],
  request: { reason: 'Cedant retained the risk' }, response: { success: true, data: { ...example, status: 'cancelled' } },
  handler: async (req, res) => {
    const { before, after } = await fac.cancelPlacement(req.params.id, req.body.reason, req.user.id);
    await audit(req, { entity: 'fac_placement', entityId: after.id, action: 'cancel', before, after: { status: after.status, reason: req.body.reason } });
    res.json({ success: true, message: 'Slip cancelled', data: after });
  },
});
define({
  method: 'GET', path: '/:id/documents/:kind', summary: `Documents of a slip (PDF): ${FAC_DOCUMENTS.join(', ')} (credit-note needs shareId)`, screen: `${SCREEN} > Slip > Documents`, middleware: read,
  query: { shareId: 1 }, response: 'application/pdf',
  handler: async (req, res) => {
    const spec = await facDocumentSpec(req.params.id, req.params.kind, req.query.shareId || null);
    await audit(req, { entity: 'fac_placement', entityId: req.params.id, action: `print-${req.params.kind}` });
    sendPdf(res, buildPdf(spec), `${req.params.kind}-${spec.number}.pdf`);
  },
});

export default router;
