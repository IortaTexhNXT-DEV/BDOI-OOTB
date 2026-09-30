/**
 * Layering and co-insurance ledger (/bespoke/layers): layers of a placement or policy, participant remittance and
 * insurer statement reconciliation, claim split per layer and participant, outstanding recoveries.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { assertVisible, ownRecord } from '../../lib/scope.js';
import { sendTable } from '../documents/tabular.js';
import * as lay from './layers.js';
import { canRead, canWrite } from './composerRouter.js';

const SCREEN = 'Operations > Placement > Layering & Co-insurance';
const canFinance = [requireAuth, requirePermission('write:bespoke-finance')];
const readClaims = [requireAuth, requirePermission('read:bespoke', 'read:claims')];
const writeClaims = [requireAuth, requirePermission('write:bespoke', 'write:claims')];
const writeRecovery = [requireAuth, requirePermission('write:bespoke', 'write:bespoke-finance', 'write:claims')];
const money = z.union([z.number(), z.string()]).optional().nullable();
const idRef = z.union([z.number(), z.string().min(1)]);

const layerExample = { layerNo: 2, name: 'First excess', layerType: 'excess', limit: 500000000, attachmentPoint: 300000000, premium: 400000, taxes: 50000, premiumTotal: 450000,
  participants: [{ insuranceCompanyId: 2, insuranceCompanyName: 'Sample Insurer A', isLead: true, sharePercent: 40, premium: 160000, taxes: 20000, premiumTotal: 180000, commissionRate: 0.15, commissionAmount: 24000, netDue: 156000 }] };
const layerBody = z.object({ layers: z.array(z.object({
  name: z.string().max(120).optional(), limit: money, limitAmount: money, attachmentPoint: money, premium: money, remarks: z.string().max(1000).optional().nullable(),
  participants: z.array(z.object({ insuranceCompanyId: idRef.optional(), insuranceCompanyName: z.string().optional(), sharePercent: money, isLead: z.boolean().optional(), commissionRate: money,
    insurerReference: z.string().max(80).optional().nullable() }).passthrough()).min(1, 'Add at least one participant to every layer'),
}).passthrough()).min(1, 'Add at least one layer') });

const entityGuard = (req) => (req.params.entityType === 'placement' ? assertVisible(req, 'placement', req.params.entityId)
  : req.params.entityType === 'policy' ? assertVisible(req, 'policy', req.params.entityId) : Promise.resolve());

const r = moduleRouter('Layering and Co-insurance', '/bespoke/layers');
r.define({
  method: 'GET', path: '/', summary: 'Placements and policies with layers (search)', screen: SCREEN, middleware: canRead, query: { search: 'PS-2026' },
  response: { success: true, data: [{ entityType: 'placement', entityId: 'plc_1', number: 'PS-2026-00003', insured: 'Sample Corp.', layers: 3, insurers: 4, topLimit: 1500000000, premium: 2000000 }] },
  handler: async (req, res) => res.json({ success: true, data: await lay.listLayered(req.query) }),
});
r.define({
  method: 'GET', path: '/reports/outstanding-recoveries', summary: 'Participant claim ledger / outstanding recoveries: per claim, layer and participant the paid share, recovered and outstanding (insurerId, all=true for every row, asOf, format=xlsx | csv)',
  screen: `${SCREEN} > Outstanding recoveries`, middleware: readClaims, query: { insurerId: 2, format: 'xlsx' },
  response: { success: true, data: { asOf: '2026-09-30', rows: [{ claimNumber: 'CLM-2026-00001', layerNo: 1, insurer: 'Sample Insurer A', paid: 400000, recovered: 100000, outstanding: 300000, daysSinceLastPayment: 12 }], outstanding: 300000 } },
  handler: async (req, res) => {
    const data = await lay.recoveriesReport({ ...req.query, all: ['true', '1'].includes(String(req.query.all)) });
    if (req.query.format === 'xlsx' || req.query.format === 'csv') {
      const header = ['Insurer', 'Claim', 'Policy', 'Insured', 'Layer', 'Share %', 'Incurred', 'Paid share', 'Recovered', 'Outstanding', 'Days since last payment'];
      return sendTable(res, { header, rows: data.rows.map((x) => [x.insurer, x.claimNumber, x.policyNumber, x.insured, `${x.layerNo} ${x.layerName}`, x.sharePercent, x.incurred, x.paid, x.recovered, x.outstanding, x.daysSinceLastPayment ?? '']),
        fileBase: `outstanding-recoveries-${data.asOf}`, format: req.query.format, sheetName: 'Outstanding recoveries' });
    }
    return res.json({ success: true, data });
  },
});
r.define({
  method: 'GET', path: '/claims/:claimId', summary: 'Claim split: reserve, paid and incurred per layer and participant, recoveries collected and outstanding, movements', screen: `${SCREEN} > Claim split; Claims`,
  middleware: [...readClaims, ownRecord('claim', 'claimId')],
  response: { success: true, data: { totals: { reserve: 200000, paid: 800000, incurred: 1000000, recovered: 100000 }, layers: [{ layerNo: 1, paid: 800000, participants: [{ insuranceCompanyName: 'Sample Insurer A', paid: 320000, recovered: 100000, outstandingRecovery: 220000 }] }] } },
  handler: async (req, res) => res.json({ success: true, data: await lay.claimSplit(req.params.claimId) }),
});
r.define({
  method: 'POST', path: '/claims/:claimId/movements', summary: 'Claim split movement: reserve (sets the outstanding reserve) or payment (paid to the claimant; reduces the reserve)', screen: `${SCREEN} > Claim split`,
  middleware: [...writeClaims, ownRecord('claim', 'claimId'), validate(z.object({ kind: z.enum(['reserve', 'payment']), amount: z.union([z.number(), z.string()]), date: z.string().optional().nullable(),
    reference: z.string().max(80).optional().nullable(), remarks: z.string().max(1000).optional().nullable() }))],
  request: { kind: 'payment', amount: 800000, date: '2026-09-25', reference: 'CV-2026-0101' }, response: { success: true, data: { totals: { paid: 800000 } } },
  handler: async (req, res) => {
    const s = await lay.addClaimMovement(req.params.claimId, req.body, req.user.id);
    await audit(req, { entity: 'claim', entityId: s.claim.id, action: `split-${req.body.kind}`, after: { amount: Number(req.body.amount), totals: s.totals } });
    res.status(201).json({ success: true, message: req.body.kind === 'reserve' ? 'Reserve updated' : 'Payment recorded', data: s });
  },
});
r.define({
  method: 'POST', path: '/claims/:claimId/recoveries', summary: 'Recovery collected from a participant for its share of the claim payments (layerNo optional: else the lowest layer first); at most its outstanding share',
  screen: `${SCREEN} > Claim split > Recovery`, middleware: [...writeRecovery, ownRecord('claim', 'claimId'), validate(z.object({ insuranceCompanyId: idRef, amount: z.union([z.number(), z.string()]),
    layerNo: z.union([z.number(), z.string()]).optional().nullable(), date: z.string().optional().nullable(), reference: z.string().max(80).optional().nullable(), remarks: z.string().max(1000).optional().nullable() }))],
  request: { insuranceCompanyId: 3, amount: 240000, reference: 'OR-88121' }, response: { success: true, data: { totals: { recovered: 340000 } } },
  handler: async (req, res) => {
    const s = await lay.addClaimMovement(req.params.claimId, { ...req.body, kind: 'recovery' }, req.user.id);
    await audit(req, { entity: 'claim', entityId: s.claim.id, action: 'split-recovery', after: { insurerId: req.body.insuranceCompanyId, amount: Number(req.body.amount), layerNo: req.body.layerNo ?? null } });
    res.status(201).json({ success: true, message: 'Recovery recorded', data: s });
  },
});
r.define({
  method: 'GET', path: '/:entityType/:entityId', summary: 'Layers of a placement or policy (else those of the placement it came from, else one layer from its participants) with participant allocations and the consolidated shares',
  screen: SCREEN, middleware: canRead,
  response: { success: true, data: { entity: { type: 'placement', number: 'PS-2026-00003', premium: 2000000, editable: true }, source: 'own', layers: [layerExample], participants: [{ insuranceCompanyName: 'Sample Insurer A', sharePercent: 36.5, netDue: 600000 }] } },
  handler: async (req, res) => {
    await entityGuard(req);
    const x = await lay.layersFor(req.params.entityType, req.params.entityId);
    res.json({ success: true, data: { entity: x.info, source: x.source, layers: x.layers, participants: lay.consolidate(x.layers) } });
  },
});
r.define({
  method: 'PUT', path: '/:entityType/:entityId', summary: 'Save the layers (primary then excess: limit, attachment point, premium; participants with shares totalling 100% per layer, one lead): amounts allocated per participant and the consolidated shares written to the co-insurance participants',
  screen: `${SCREEN} > Save`, middleware: [...canWrite, validate(layerBody)],
  request: { layers: [{ name: 'Primary', limit: 300000000, attachmentPoint: 0, premium: 1200000, participants: [{ insuranceCompanyId: 'MALAYAN', sharePercent: 40, isLead: true }, { insuranceCompanyId: 'PIONEER', sharePercent: 30 }, { insuranceCompanyId: 'FPG', sharePercent: 30 }] },
    { name: 'First excess', limit: 500000000, attachmentPoint: 300000000, premium: 800000, participants: [{ insuranceCompanyId: 'PIONEER', sharePercent: 60, isLead: true }, { insuranceCompanyId: 'MAPFRE', sharePercent: 40 }] }] },
  response: { success: true, data: { layers: [layerExample], warnings: [] } },
  handler: async (req, res) => {
    await entityGuard(req);
    const x = await lay.saveLayers(req.params.entityType, req.params.entityId, req.body.layers, req.user.id);
    await audit(req, { entity: x.info.type, entityId: x.info.id, action: 'layers', before: { layers: x.before.map((l) => ({ layerNo: l.layerNo, limit: l.limit, participants: l.participants.map((p) => `${p.insuranceCompanyName} ${p.sharePercent}%`) })) },
      after: { layers: x.layers.map((l) => ({ layerNo: l.layerNo, limit: l.limit, attachmentPoint: l.attachmentPoint, premium: l.premium, participants: l.participants.map((p) => `${p.insuranceCompanyName} ${p.sharePercent}%`) })) } });
    res.json({ success: true, message: `${x.layers.length} layer(s) saved`, warnings: x.warnings, data: { entity: x.info, source: x.source, layers: x.layers, participants: x.participants, warnings: x.warnings } });
  },
});
r.define({
  method: 'GET', path: '/:entityType/:entityId/remittance', summary: 'Per participant and layer: due to the insurer (gross less commission), remitted (from the remittance allocations of the policy bills) and outstanding, with the statement reconciliations',
  screen: `${SCREEN} > Remittance and reconciliation`, middleware: canRead,
  response: { success: true, data: { issued: true, insurers: [{ insuranceCompanyName: 'Sample Insurer A', netDue: 600000, remitted: 400000, outstanding: 200000, lastReconciliation: { status: 'matched' } }], rows: [] } },
  handler: async (req, res) => { await entityGuard(req); res.json({ success: true, data: await lay.remittanceView(req.params.entityType, req.params.entityId) }); },
});
r.define({
  method: 'POST', path: '/:entityType/:entityId/reconcile', summary: 'Reconcile a participant\'s statement (amount it shows as received) with the amount remitted to it, for all its layers or one (layerNo); matched within bespoke.reconciliation_tolerance',
  screen: `${SCREEN} > Reconcile`, middleware: [...canFinance, validate(z.object({ insuranceCompanyId: idRef, layerNo: z.union([z.number(), z.string()]).optional().nullable(),
    statementRef: z.string().max(80).optional().nullable(), statementAmount: z.union([z.number(), z.string()]), note: z.string().max(1000).optional().nullable() }))],
  request: { insuranceCompanyId: 3, statementRef: 'SOA-2026-09', statementAmount: 400000 }, response: { success: true, data: { status: 'matched', difference: 0, outstanding: 200000 } },
  handler: async (req, res) => {
    await entityGuard(req);
    const x = await lay.reconcileParticipant(req.params.entityType, req.params.entityId, req.body, req.user.id);
    await audit(req, { entity: req.params.entityType, entityId: req.params.entityId, action: 'participant-reconciliation', after: x });
    res.status(201).json({ success: true, message: x.status === 'matched' ? 'Statement matched' : `Difference of ${x.difference}`, data: x });
  },
});

export const layersRouter = r.router;
