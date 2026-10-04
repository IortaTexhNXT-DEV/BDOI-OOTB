/**
 * Motor claim repairs (Operations > Motor Claim Repairs): repair estimates of accredited shops (Repair Shop master),
 * the insurer adjuster's decision as recorded by the claims officer, supplementary estimates, the letter of authority
 * (LOA) with the insured's participation, and the release of the vehicle. read:claims to view, write:claims to act.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { ownRecord } from '../../lib/scope.js';
import { sendPdf } from '../../lib/pdf/index.js';
import * as svc from './service.js';
import { loaPdf, releasePdf } from './print.js';

const { router, define } = moduleRouter('Motor Claim Repairs', '/motor-claims');
const read = [requireAuth, requirePermission('read:claims')];
const write = [requireAuth, requirePermission('write:claims')];
const S = 'Operations > Motor Claim Repairs';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tx = (fn) => withTransaction(fn);
const estimate = { id: 'cre_1', kind: 'initial', seq: 1, repairShopName: 'Sample Auto Body Works', parts: 32000, labour: 9500, paint: 6000, other: 0, vat: 5700, total: 53200, status: 'approved', approvedAmount: 48000, adjusterName: 'R. Dizon' };
const loa = { id: 'loa_1', loaNumber: 'LOA-2026-00001', kind: 'original', approvedRepairCost: 48000, participation: 3000, depreciation: 0, payableByInsurer: 45000, payableByInsured: 3000, status: 'issued' };

define({
  method: 'GET', path: '/', summary: 'Motor claims and the stage of their repair (stage no-estimate | awaiting-approval | approved | in-repair | released | all, search)', screen: S, middleware: read,
  response: { success: true, data: [{ claimNumber: 'CLM-2026-00001', policyNumber: 'POL-2026-00001', insured: 'Maria Santos', estimates: 1, approvedAmount: 48000, loaNumbers: 'LOA-2026-00001', stage: 'in-repair' }] },
  handler: async (req, res) => ok(res, await svc.listRepairs(pool, req.query)),
});
define({
  method: 'GET', path: '/repair-shops', summary: 'Active repair shops (Repair Shop master) for the estimate form', screen: S, middleware: read,
  response: { success: true, data: [{ code: 'RS-001', name: 'Sample Auto Body Works', city: 'Quezon City', accredited: true }] },
  handler: async (_req, res) => ok(res, await svc.repairShops(pool)),
});
define({
  method: 'GET', path: '/claims/:id', summary: 'Repair file of a motor claim: estimates, adjuster decisions, letters of authority, release, default participation',
  screen: S, middleware: [...read, ownRecord('claim')], response: { success: true, data: { claimNumber: 'CLM-2026-00001', defaultParticipation: 3000, estimates: [estimate], loas: [loa], releases: [] } },
  handler: async (req, res) => ok(res, await svc.repairFile(pool, req.params.id)),
});
const money = z.number().min(0).optional().nullable();
define({
  method: 'POST', path: '/claims/:id/estimates', summary: 'Record a repair estimate of an accredited shop (initial, or supplementary once an estimate is approved)', screen: `${S} > Estimate`,
  middleware: [...write, ownRecord('claim'), validate(z.object({ repairShopCode: z.string().min(1), shopReference: z.string().max(60).optional().nullable(), estimateDate: date.optional(),
    parts: money, labour: money, paint: money, other: money, vat: money }))],
  request: { repairShopCode: 'RS-001', shopReference: 'EST-8812', estimateDate: '2026-10-04', parts: 32000, labour: 9500, paint: 6000, vat: 5700 }, response: { success: true, data: { ...estimate, status: 'submitted' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.addEstimate(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'repair-estimate', after: r });
    created(res, r, `${r.kind === 'initial' ? 'Estimate' : 'Supplementary estimate'} ${r.seq} recorded`);
  },
});
define({
  method: 'POST', path: '/claims/:id/estimates/:estimateId/decision', summary: 'Record the insurer adjuster\'s decision on an estimate (approve with the approved amount, or reject with the reason)',
  screen: `${S} > Adjuster decision`, middleware: [...write, ownRecord('claim'), validate(z.object({ decision: z.enum(['approve', 'reject']), approvedAmount: z.number().positive().optional(),
    adjusterName: z.string().min(1).max(120), adjusterCompany: z.string().max(120).optional().nullable(), decidedOn: date.optional(), approvalReference: z.string().max(100).optional().nullable(),
    remarks: z.string().max(1000).optional().nullable() }))],
  request: { decision: 'approve', approvedAmount: 48000, adjusterName: 'R. Dizon', adjusterCompany: 'Sample Adjusters Inc.', approvalReference: 'MIC-ADJ-5512' }, response: { success: true, data: estimate },
  handler: async (req, res) => {
    const r = await tx((db) => svc.decideEstimate(db, req.params.id, req.params.estimateId, req.body, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: `estimate-${r.status}`, after: r });
    ok(res, r, `Estimate ${r.seq} ${r.status}`);
  },
});
define({
  method: 'POST', path: '/claims/:id/loas', summary: 'Issue the letter of authority to the shop for the approved estimates not yet covered (participation and depreciation from the settings unless given)',
  screen: `${S} > Letter of authority`, middleware: [...write, ownRecord('claim'), validate(z.object({ estimateIds: z.array(z.string()).optional(), participation: z.number().min(0).optional(),
    depreciation: z.number().min(0).optional(), validUntil: date.optional(), remarks: z.string().max(1000).optional().nullable() }))],
  request: { participation: 3000 }, response: { success: true, data: loa },
  handler: async (req, res) => {
    const r = await tx((db) => svc.issueLoa(db, req.params.id, req.body || {}, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'loa-issued', after: r });
    created(res, r, `Letter of authority ${r.loaNumber} issued`);
  },
});
define({
  method: 'GET', path: '/claims/:id/loas/:loaId/pdf', summary: 'Letter of authority (PDF with the company letterhead)', screen: `${S} > Letter of authority`, middleware: [...read, ownRecord('claim')], response: 'application/pdf',
  handler: async (req, res) => {
    const r = await loaPdf(pool, req.params.id, req.params.loaId);
    sendPdf(res, r.pdf, r.fileName);
  },
});
define({
  method: 'POST', path: '/claims/:id/loas/:loaId/cancel', summary: 'Cancel a letter of authority (reason required; not after the vehicle is released)', screen: `${S} > Letter of authority`,
  middleware: [...write, ownRecord('claim'), validate(z.object({ reason: z.string().min(1).max(500) }))], request: { reason: 'Shop changed at the insured\'s request' }, response: { success: true, data: { ...loa, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.cancelLoa(db, req.params.id, req.params.loaId, req.body.reason, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'loa-cancelled', after: r });
    ok(res, r, `Letter of authority ${r.loaNumber} cancelled`);
  },
});
define({
  method: 'POST', path: '/claims/:id/releases', summary: 'Record the release of the repaired vehicle to the insured', screen: `${S} > Release of vehicle`,
  middleware: [...write, ownRecord('claim'), validate(z.object({ loaId: z.string().optional(), repairCompletedOn: date.optional(), releasedOn: date.optional(), releasedTo: z.string().min(1).max(200),
    participationCollected: z.number().min(0).optional(), odometer: z.string().max(30).optional().nullable(), remarks: z.string().max(1000).optional().nullable() }))],
  request: { releasedOn: '2026-10-20', releasedTo: 'Maria Santos', participationCollected: 3000 }, response: { success: true, data: { id: 1, releasedOn: '2026-10-20', releasedTo: 'Maria Santos' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.releaseVehicle(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'vehicle-released', after: r });
    created(res, r, `Vehicle released to ${r.releasedTo}`);
  },
});
define({
  method: 'GET', path: '/claims/:id/releases/:releaseId/pdf', summary: 'Vehicle release acknowledgement (PDF) signed by the insured', screen: `${S} > Release of vehicle`, middleware: [...read, ownRecord('claim')], response: 'application/pdf',
  handler: async (req, res) => {
    const r = await releasePdf(pool, req.params.id, req.params.releaseId);
    sendPdf(res, r.pdf, r.fileName);
  },
});

export default router;
export const mount = '/motor-claims';
