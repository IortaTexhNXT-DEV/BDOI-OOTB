/**
 * Credit control of broker-billed premium (Accounts > Credit Control): instalment plans and their ageing, the premium
 * warranty monitor (reminders, extensions, cancellation requests for non-payment), client credit limits and the ageing
 * of premium collected but not yet remitted to insurers.
 * Permissions: read:collections / write:collections; approve:credit-control (Accounting Manager) approves warranty
 * extensions and sets credit limits; the remittance ageing also opens with read:remittance.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { sendTable } from '../documents/tabular.js';
import * as inst from './instalments.js';
import * as wr from './warranty.js';
import * as lim from './limits.js';
import { AGEING_HEADER, ageingRows, remittanceAgeing } from './remittanceAgeing.js';

const { router, define } = moduleRouter('Credit Control', '/credit-control');
const read = [requireAuth, requirePermission('read:collections')];
const write = [requireAuth, requirePermission('write:collections')];
const approve = [requireAuth, requirePermission('approve:credit-control')];
const readRemittance = [requireAuth, requirePermission('read:collections', 'read:remittance')];
const S = 'Accounts > Credit Control';
const tx = (fn) => withTransaction(fn);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const planExample = { id: 'ipl_1', policyId: 'pol_1', receivableId: 'rcv_1', billNumber: 'INV-2026-00012', frequency: 'monthly', instalmentCount: 4, status: 'active',
  instalments: [{ seq: 1, dueDate: '2026-10-15', amount: 3131.25, paid: 3131.25, outstanding: 0, status: 'paid', daysPastDue: 0 }] };

// ---------- instalment plans ----------
define({
  method: 'GET', path: '/policies/:policyId/instalment-plans', summary: 'Premium bills of a broker-billed policy, their instalment plans and a proposed schedule', screen: `${S} > Instalment Plans`, middleware: read,
  response: { success: true, data: { policyNumber: 'POL-2026-00001', bills: [], plans: [planExample], frequencies: { monthly: 1, quarterly: 3 }, proposal: { count: 4, instalments: [] } } },
  handler: async (req, res) => ok(res, await inst.policyPlans(pool, req.params.policyId)),
});
const GENERATE = { receivableId: z.string().optional(), frequency: z.string().optional(), count: z.number().int().min(1).max(60).optional(), firstDueDate: date.optional(),
  downPayment: z.number().min(0).optional(), remarks: z.string().max(500).nullable().optional() };
define({
  method: 'POST', path: '/policies/:policyId/instalment-plans/preview', summary: 'Schedule generated from the terms (frequency, number of instalments, first due date, down payment); nothing is saved',
  screen: `${S} > Instalment Plans`, middleware: [...read, validate(z.object(GENERATE))], request: { frequency: 'monthly', count: 4, firstDueDate: '2026-10-15', downPayment: 0 },
  response: { success: true, data: [{ seq: 1, dueDate: '2026-10-15', amount: 3131.25 }] },
  handler: async (req, res) => ok(res, await inst.previewSchedule(pool, req.params.policyId, req.body)),
});
define({
  method: 'POST', path: '/policies/:policyId/instalment-plans', summary: 'Save the instalment plan of a bill: generated from the terms, or the edited instalments (must add up to the bill); replaces its active plan',
  screen: `${S} > Instalment Plans`, middleware: [...write, validate(z.object({ ...GENERATE, instalments: z.array(z.object({ dueDate: date, amount: z.number(), remarks: z.string().nullable().optional() })).optional() }))],
  request: { receivableId: 'rcv_1', frequency: 'monthly', instalments: [{ dueDate: '2026-10-15', amount: 6262.5 }, { dueDate: '2026-11-15', amount: 6262.5 }] }, response: { success: true, data: planExample },
  handler: async (req, res) => {
    const r = await tx((db) => inst.savePlan(db, req.params.policyId, req.body, req.user));
    await audit(req, { entity: 'instalment_plan', entityId: r.after.id, action: r.before ? 'update' : 'create', before: r.before, after: r.after });
    created(res, r.after, `Instalment plan saved (${r.after.instalmentCount} instalments)`);
  },
});
define({
  method: 'POST', path: '/instalment-plans/:planId/cancel', summary: 'Cancel an instalment plan (the bill keeps its current due date)', screen: `${S} > Instalment Plans`,
  middleware: [...write, validate(z.object({ reason: z.string().max(500).optional() }))], request: { reason: 'Client paid in full' }, response: { success: true, data: { ...planExample, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await tx((db) => inst.cancelPlan(db, req.params.planId, req.body?.reason, req.user));
    await audit(req, { entity: 'instalment_plan', entityId: r.after.id, action: 'cancel', before: r.before, after: r.after });
    ok(res, r.after, 'Instalment plan cancelled');
  },
});
define({
  method: 'GET', path: '/instalments/ageing', summary: 'Outstanding instalments of active plans aged on their due dates (clientId, policyId, insurerId, overdueOnly)', screen: `${S} > Instalment Plans`, middleware: read,
  query: { overdueOnly: 'true' }, response: { success: true, data: { summary: { count: 1, outstanding: 3131.25, current: 0, b1: 3131.25 }, rows: [] } },
  handler: async (req, res) => ok(res, await inst.instalmentAgeing(pool, req.query)),
});

// ---------- premium warranty monitor ----------
define({
  method: 'GET', path: '/warranty', summary: 'Premium warranty monitor: broker-billed policies past (breached) or near (at-risk) their premium payment warranty and unpaid (status attention | breached | at-risk | all, search)',
  screen: `${S} > Premium Warranty Monitor`, middleware: read, query: { status: 'breached' },
  response: { success: true, data: { summary: { breached: 1, atRisk: 0 }, rows: [{ policyNumber: 'POL-2026-00001', deadline: '2026-09-15', daysPastDeadline: 15, premiumDue: 12525, status: 'breached' }] } },
  handler: async (req, res) => ok(res, await wr.warrantyMonitor(pool, req.query)),
});
define({
  method: 'GET', path: '/warranty/extensions', summary: 'Warranty extension requests awaiting approval', screen: `${S} > Premium Warranty Monitor`, middleware: read,
  response: { success: true, data: [{ id: 1, policyNumber: 'POL-2026-00001', currentDeadline: '2026-09-15', requestedDeadline: '2026-10-15', reason: 'Awaiting corporate cheque' }] },
  handler: async (req, res) => ok(res, await wr.pendingExtensions(pool)),
});
define({
  method: 'GET', path: '/warranty/:policyId/actions', summary: 'Reminders, extensions and cancellation requests of a policy', screen: `${S} > Premium Warranty Monitor`, middleware: read,
  response: { success: true, data: [{ action: 'reminder', notes: 'Premium due', createdBy: 'Accounting' }] },
  handler: async (req, res) => ok(res, await wr.policyActions(pool, req.params.policyId)),
});
define({
  method: 'POST', path: '/warranty/:policyId/remind', summary: 'Send the client a premium reminder (collection e-mail) and log it', screen: `${S} > Premium Warranty Monitor`,
  middleware: [...write, validate(z.object({ notes: z.string().max(2000).optional(), to: z.string().email().optional() }))], request: { notes: 'Your premium is past the warranty date' },
  response: { success: true, data: { emailId: 'em_1', to: 'client@example.ph' } },
  handler: async (req, res) => {
    const r = await tx((db) => wr.remind(db, req.params.policyId, req.body, req.user));
    await audit(req, { entity: 'policy', entityId: req.params.policyId, action: 'warranty-reminder', after: r });
    ok(res, r, `Reminder queued to ${r.to}`);
  },
});
define({
  method: 'POST', path: '/warranty/:policyId/extensions', summary: 'Request an extension of the premium warranty deadline (approved by another user with approve:credit-control)', screen: `${S} > Premium Warranty Monitor`,
  middleware: [...write, validate(z.object({ requestedDeadline: date, reason: z.string().max(1000) }))], request: { requestedDeadline: '2026-10-15', reason: 'Awaiting corporate cheque' },
  response: { success: true, data: { id: 1, status: 'pending' } },
  handler: async (req, res) => {
    const r = await tx((db) => wr.requestExtension(db, req.params.policyId, req.body, req.user));
    await audit(req, { entity: 'premium_warranty_extension', entityId: r.id, action: 'request', after: r });
    created(res, r, `Extension of ${r.policyNumber} to ${r.requestedDeadline} sent for approval`);
  },
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/warranty/extensions/:id/${action}`, summary: `${action === 'approve' ? 'Approve' : 'Reject (reason required)'} a warranty extension request; not the requester`,
    screen: `${S} > Premium Warranty Monitor`, middleware: [...approve, validate(z.object({ remarks: z.string().max(1000).optional() }))], request: { remarks: 'Cheque confirmed' },
    response: { success: true, data: { id: 1, status: action === 'approve' ? 'approved' : 'rejected' } },
    handler: async (req, res) => {
      const r = await tx((db) => wr.decideExtension(db, req.params.id, action, req.body?.remarks, req.user));
      await audit(req, { entity: 'premium_warranty_extension', entityId: r.id, action, after: r });
      ok(res, r, `Extension ${r.status}`);
    },
  });
}
define({
  method: 'POST', path: '/warranty/:policyId/cancellation-request', summary: 'Request the cancellation of a breached policy for non-payment: a draft cancellation endorsement for Operations; the policy is not cancelled here',
  screen: `${S} > Premium Warranty Monitor`, middleware: [...write, validate(z.object({ notes: z.string().max(1000).optional() }))], request: { notes: 'Three reminders sent' },
  response: { success: true, data: { endorsementNumber: 'END-2026-00031' } },
  handler: async (req, res) => {
    const r = await tx((db) => wr.requestCancellation(db, req.params.policyId, req.body, req.user));
    await audit(req, { entity: 'policy', entityId: req.params.policyId, action: 'cancellation-request', after: r });
    created(res, r, `Cancellation request ${r.endorsementNumber || ''} raised for Operations`.replace(/\s+/g, ' '));
  },
});

// ---------- client credit limits ----------
define({
  method: 'GET', path: '/clients', summary: 'Client credit limits with the open broker-billed premium (exposure) and what is left (search, overOnly)', screen: `${S} > Client Credit Limits`, middleware: read,
  query: { overOnly: 'true' }, response: { success: true, data: [{ clientCode: 'CL-2026-00001', clientName: 'ABC Corp', creditLimit: 500000, exposure: 520000, available: -20000, overLimit: true }] },
  handler: async (req, res) => ok(res, await lim.listLimits(pool, req.query)),
});
define({
  method: 'GET', path: '/clients/:clientId/credit-check', summary: 'Exposure of a client with a new premium amount against its credit limit (warning before issuing a policy)', screen: `${S} > Client Credit Limits`,
  middleware: read, query: { amount: 125250 }, response: { success: true, data: { creditLimit: 500000, exposure: 400000, exposureAfter: 525250, exceeds: true, exceededBy: 25250 } },
  handler: async (req, res) => ok(res, await lim.creditCheck(pool, req.params.clientId, req.query.amount)),
});
define({
  method: 'PUT', path: '/clients/:clientId/credit-limit', summary: 'Set a client\'s credit limit (null removes it)', screen: `${S} > Client Credit Limits`,
  middleware: [...approve, validate(z.object({ creditLimit: z.number().min(0).nullable() }))], request: { creditLimit: 500000 }, response: { success: true, data: { creditLimit: 500000 } },
  handler: async (req, res) => {
    const r = await tx((db) => lim.setLimit(db, req.params.clientId, req.body.creditLimit, req.user));
    await audit(req, { entity: 'client', entityId: r.after.clientId, action: 'set-credit-limit', before: r.before, after: r.after });
    ok(res, r.after, `Credit limit of ${r.after.clientName} saved`);
  },
});
define({
  method: 'GET', path: '/credit-exceptions', summary: 'Broker-billed policies issued over the client\'s credit limit (openOnly = not yet acknowledged)', screen: `${S} > Client Credit Limits`, middleware: read,
  response: { success: true, data: [{ id: 1, clientName: 'ABC Corp', policyNumber: 'POL-2026-00001', creditLimit: 500000, exposureAfter: 525250, exceededBy: 25250 }] },
  handler: async (req, res) => ok(res, await lim.listExceptions(pool, req.query)),
});
define({
  method: 'POST', path: '/credit-exceptions/:id/acknowledge', summary: 'Acknowledge a credit limit exception (remarks)', screen: `${S} > Client Credit Limits`,
  middleware: [...write, validate(z.object({ remarks: z.string().max(1000).optional() }))], request: { remarks: 'Approved by the account manager' }, response: { success: true, data: { acknowledged: true } },
  handler: async (req, res) => {
    const r = await tx((db) => lim.acknowledgeException(db, req.params.id, req.body?.remarks, req.user));
    await audit(req, { entity: 'client_credit_exception', entityId: r.id, action: 'acknowledge', after: { ...r, remarks: req.body?.remarks || null } });
    ok(res, r, 'Exception acknowledged');
  },
});

// ---------- remittance ageing ----------
define({
  method: 'GET', path: '/remittance-ageing', summary: 'Premium collected and not yet remitted to insurers, aged on the remittance terms (insurerId, asOf, overdueOnly; format=xlsx or csv to download)',
  screen: `${S} > Remittance Ageing`, middleware: readRemittance, query: { overdueOnly: 'true' },
  response: { success: true, data: { summary: { total: 11025, current: 0, b1: 11025 }, insurers: [{ insurerName: 'FPG Insurance', total: 11025 }], rows: [] } },
  handler: async (req, res) => {
    const r = await remittanceAgeing(pool, req.query);
    if (['xlsx', 'csv'].includes(req.query.format)) {
      sendTable(res, { header: AGEING_HEADER, rows: ageingRows(r), fileBase: `remittance-ageing-${r.asOf}`, format: req.query.format, sheetName: 'Remittance ageing' });
      return;
    }
    ok(res, r);
  },
});

export default router;
export const mount = '/credit-control';
