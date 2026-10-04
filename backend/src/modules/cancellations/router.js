/**
 * Policy cancellation (Operations > Policy Cancellation): the return premium of a cancellation computed from the days
 * left (pro-rata, short-period scale when the insured cancels, flat from inception), with its premium taxes from the
 * charge engine and the commission taken back. The cancellation endorsement itself is created with
 * POST /endorsements/create-endorsement (isCancelPolicy, cancellationReason, cancellationMethod, effectiveDate), which
 * recomputes the same figures on the server.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool } from '../../db/pool.js';
import { ok } from '../../lib/respond.js';
import { ownRecord } from '../../lib/scope.js';
import { getPolicyRow } from '../policies/service.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Cancellations', '/cancellations');
const read = [requireAuth, requirePermission('read:endorsements')];
const S = 'Operations > Policy Cancellation';

define({
  method: 'GET', path: '/reasons', summary: 'Cancellation reasons (master cancellation-reason): who initiates and the return premium method', screen: S, middleware: read,
  response: { success: true, data: [{ code: 'INSURED_REQUEST', name: 'Cancelled at the request of the insured', initiatedBy: 'insured', method: 'auto' }] },
  handler: async (_req, res) => ok(res, await svc.cancellationReasons(pool)),
});
define({
  method: 'GET', path: '/short-period-scale', summary: 'Short-period scale (master short-period-rate): premium retained by days in force', screen: S, middleware: read,
  response: { success: true, data: [{ code: 'SP01', maxDays: 31, retainedPercent: 20, description: 'Not exceeding 1 month' }] },
  handler: async (_req, res) => ok(res, await svc.shortPeriodScale(pool)),
});
const quoteBody = z.object({
  policyId: z.string().min(1), effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), reason: z.string().max(60).optional(),
  method: z.enum(['auto', 'pro-rata', 'short-period', 'flat', 'manual']).optional(), cancellationType: z.string().max(30).optional(),
  partialPremium: z.number().min(0).optional(), partialPercent: z.number().min(0).max(100).optional(), returnPremium: z.number().min(0).optional(),
});
define({
  method: 'POST', path: '/quote', summary: 'Compute the return premium of cancelling a policy on a date (method from the reason: pro-rata, short-period or flat), with taxes and commission; nothing is saved',
  screen: S, middleware: [...read, validate(quoteBody), ownRecord('policy', (req) => req.body.policyId)],
  request: { policyId: 'pol_1', effectiveDate: '2026-12-01', reason: 'INSURED_REQUEST' },
  response: { success: true, data: { method: 'short-period', totalDays: 365, daysInForce: 120, daysLeft: 245, returnNetPremium: 5000, taxes: { vat: 600, dst: 0, lgt: 37.5 }, grossReturn: 5637.5, commissionReversed: 750 } },
  handler: async (req, res) => ok(res, await svc.computeReturn(pool, await getPolicyRow(req.body.policyId), req.body)),
});

export default router;
export const mount = '/cancellations';
