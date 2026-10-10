import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { notFound } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { assertVisible, withScope } from '../../lib/scope.js';
import * as svc from './service.js';
import { syncAutoTasksQuietly } from '../my-work/tasks.js';
import { usersWithPermission } from '../claims/util.js';
import * as an from './analytics.js';
import * as notices from './notices.js';
import { sendSheet } from '../claims/docs.js';

/**
 * Operations > Renewals workspace (/renewal/queue, /renewal/at-risk, /renewal/negotiations, /renewal/lapse-management,
 * /renewal/performance, /renewal/analytics, /renewal/generate-quote): pipeline, re-rated quotes, ordered notices,
 * maker-checker approval, completion (new policy term) and lapse / reinstatement.
 */
const { router, define } = moduleRouter('Renewals workspace', '/renewals');
const read = [requireAuth, requirePermission('read:renewals')];
const write = [requireAuth, requirePermission('write:renewals')];
const approve = [requireAuth, requirePermission('write:renewals'), requirePermission('approve:renewals')];
/** Dispositions of the renewal owner's unit (reassign, not for renewal): assign:renewals. */
const assign = [requireAuth, requirePermission('write:renewals'), requirePermission('assign:renewals')];
const reasonSchema = z.object({ reasonCode: z.string().min(1).max(40), note: z.string().max(2000).optional().nullable() });
const noteSchema = z.object({ note: z.string().max(2000).optional(), reason: z.string().max(2000).optional() }).passthrough();
const queueItem = { id: 'rnw_1', renewalNumber: 'RN-2026-00001', policyNumber: 'POL-2025-00012', insuredName: 'Maria Santos', product: 'Motor Vehicle Insurance', insurer: 'MAPFRE Insurance Corporation', expiryDate: '2026-10-30', daysToExpiry: 32, currentPremium: 18500, renewalPremium: 21450.5, premiumVariancePct: 15.95, status: 'Quote Sent', statusCode: 'quoted', retentionRisk: 'Medium', riskScore: 35, noticeStage: 1, nextNotice: { stage: 2, code: 'second', label: 'Second Notice' }, assignedAgent: 'Ana Reyes', renewalAttempts: 1 };

/** Run a renewal command, audit it and answer with the updated renewal. */
// Record-level scope: a renewal (/:id...) or policy (/policies/:policyId) of someone else's book answers 404.
// (param callbacks run before the route middleware, so authenticate first; the route's own requireAuth runs again after.)
const visible = (entity, skip = () => false) => (req, res, next, id) => (skip(req) ? next() : requireAuth(req, res, (e) => (e ? next(e) : assertVisible(req, entity, id).then(() => next(), next))));
router.param('id', visible('renewal', (req) => req.path.startsWith('/campaigns/')));
router.param('policyId', visible('policy'));

const command = (action, fn, message) => async (req, res) => {
  const r = await fn(req);
  await audit(req, { entity: 'renewal', entityId: r.renewal?.id || req.params.id, action, before: r.before ? { status: r.before.status, premiumNew: r.before.premium_new, noticeStage: r.before.notice_stage } : null, after: r.audit || { status: r.renewal?.statusCode, premium: r.renewal?.renewalPremium, noticeStage: r.renewal?.noticeStage } });
  ok(res, r.data || r.renewal, message);
};

define({
  method: 'GET', path: '/queue', summary: 'Renewal pipeline / queue with dashboard counters (search, status, risk, agent, from, to, page, pageSize)', screen: 'Operations > Renewals > Renewal Queue',
  middleware: read, query: { search: 'Santos', status: 'Pending', risk: 'High', from: '2026-10-01', to: '2026-12-31', page: 1, pageSize: 20 },
  response: { success: true, data: [queueItem], dashboard: { totalPolicies: 14, dueSoon: 5, atRisk: 3, inGracePeriod: 1 }, total: 14, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const r = await an.renewalQueue(await withScope(req), pg);
    res.json({ success: true, message: 'OK', data: r.items, dashboard: r.dashboard, ...pageMeta(r.total, pg) });
  },
});
define({
  method: 'POST', path: '/pipeline/refresh', summary: 'Add policies expiring within renewals.pipeline_days to the pipeline; lapse renewals past the grace period', screen: 'Operations > Renewals > Renewal Queue',
  middleware: write, response: { success: true, data: { created: 3, lapsed: 0 } },
  handler: async (req, res) => { const r = await svc.refreshPipeline(req.user); await audit(req, { entity: 'renewal', action: 'pipeline-refresh', after: r }); ok(res, r, 'Pipeline refreshed'); },
});
define({
  method: 'POST', path: '/policies/:policyId', summary: 'Put one policy into the renewal pipeline (returns the open renewal)', screen: 'Operations > Renewals > Renewal Queue', middleware: write,
  response: { success: true, data: queueItem },
  handler: async (req, res) => {
    const r = await svc.ensureRenewal(req.params.policyId, req.user);
    if (r.created) await audit(req, { entity: 'renewal', entityId: r.id, action: 'create', after: { policyId: r.policy.id } });
    const data = await svc.getRenewal(r.id);
    return r.created ? created(res, data, 'Renewal created') : ok(res, data);
  },
});
define({
  method: 'GET', path: '/at-risk', summary: 'At-risk register: open renewals of Medium risk or above, highest score first, with the score breakdown (factor, finding, weight, points), recommended actions (renewals.risk_actions), next open task or step and last contact',
  screen: 'Operations > Renewals > At-Risk Policies', middleware: read,
  response: { success: true, data: [{ id: 'rnw_1', renewalNumber: 'RN-2026-00001', policyNumber: 'POL-2025-00012', insuredName: 'Maria Santos', riskScore: 60, riskCategory: 'High',
    riskFactors: [{ code: 'claims', factor: 'Claims History', score: 25, details: '2 claims in the current term' }],
    scoreBreakdown: [{ code: 'claims', factor: 'Claims History', value: '2 claims in the current term', weight: 25, points: 25 }, { code: 'unpaid', factor: 'Unpaid Premium', value: null, weight: 20, points: 0 }],
    recommendedActions: ['Review the claims record with the insurer', 'Prepare an alternative quote'], nextAction: { kind: 'task', taskId: 'tsk_1', title: 'Call the client', dueDate: '2026-10-12', assignee: 'Ana Reyes' },
    lastContactDate: null, assignedAgent: 'Ana Reyes', assignedAgentId: 'usr_1' }] },
  handler: async (req, res) => ok(res, await an.atRisk(await withScope(req))),
});
define({
  method: 'GET', path: '/negotiations', summary: 'Renewals under negotiation with their contact timeline', screen: 'Operations > Renewals > Negotiations', middleware: read,
  response: { success: true, data: [{ negotiationId: 'RN-2026-00001', policyNumber: 'POL-2025-00012', clientName: 'Maria Santos', currentStage: 'Pending Approval', timeline: [{ date: '2026-09-20T02:00:00Z', type: 'Meeting', method: 'Face-to-face', description: 'Discussed terms', outcome: 'Client asked for 5% discount' }] }] },
  handler: async (req, res) => ok(res, await an.negotiations(await withScope(req))),
});
define({
  method: 'GET', path: '/approvals', summary: 'Renewal terms awaiting checker approval', screen: 'Operations > Renewals > Negotiations (approval queue)', middleware: read,
  response: { success: true, data: [{ approvalId: 'rnw_1', type: 'Renewal Terms', policyNumber: 'POL-2025-00012', clientName: 'Maria Santos', requestedBy: 'Ana Reyes', details: { standardPremium: 18500, requestedPremium: 21450.5, variancePercent: 15.95 } }] },
  handler: async (req, res) => ok(res, await an.pendingApprovals(await withScope(req))),
});
define({
  method: 'GET', path: '/lapsed', summary: 'Lapsed renewals with win-back attempts and reinstatement eligibility', screen: 'Operations > Renewals > Lapse Management', middleware: read,
  response: { success: true, data: [{ policyNumber: 'POL-2025-00007', insuredName: 'Tech Solutions Ltd', lapseDate: '2026-09-01', daysLapsed: 27, premiumLost: 85000, lapseReason: 'Customer No Longer Needs Coverage: sold the vehicle', lapseReasonCode: 'LAP-COV', reinstatementEligible: true, winBackAttempts: [] }] },
  handler: async (req, res) => ok(res, await an.lapsed(await withScope(req))),
});
define({
  method: 'GET', path: '/performance', summary: 'Retention KPIs: renewal rate, premium retention, cycle time, by product, by agent, monthly trend', screen: 'Operations > Renewals > Performance; Retention Analytics',
  middleware: read, query: { from: '2025-10-01', to: '2026-09-30' },
  response: { success: true, data: { overall: { renewalRate: 82.5, premiumRetention: 87.3, avgCycleTime: 18 }, byProduct: { motor: { renewalRate: 85, avgPremium: 18000 } }, byAgent: [{ agentName: 'Ana Reyes', renewalRate: 88.2, policiesRenewed: 38, premiumRetained: 4250000, ranking: 1 }], trends: { monthly: [{ month: '2026-09', rate: 82.5 }] } } },
  handler: async (req, res) => ok(res, await an.performance(req.query)),
});
define({
  method: 'GET', path: '/campaigns', summary: 'Win-back campaigns with statistics', screen: 'Operations > Renewals > Lapse Management', middleware: read,
  response: { success: true, data: [{ campaignId: 'WB-2026-00001', campaignName: 'Q4 Win-back', offer: { discount: 10 }, statistics: { targetedPolicies: 4, contacted: 2, converted: 1 } }] },
  handler: async (_req, res) => ok(res, await an.listCampaigns()),
});
define({
  method: 'POST', path: '/campaigns', summary: 'Create a win-back campaign', screen: 'Operations > Renewals > Lapse Management > Create Campaign',
  middleware: [...write, validate(z.object({ campaignName: z.string().min(2).max(200), targetSegment: z.string().max(200).optional(), startDate: z.string().min(8), endDate: z.string().min(8), discount: z.coerce.number().min(0).max(100).optional(), budget: z.coerce.number().min(0).optional(), offers: z.array(z.string()).optional() }).refine((v) => v.endDate >= v.startDate, { message: 'endDate must be on or after startDate', path: ['endDate'] }))],
  request: { campaignName: 'Q4 Win-back', targetSegment: 'Lapsed in Q3', startDate: '2026-10-01', endDate: '2026-12-31', discount: 10, budget: 50000, offers: ['Waived reinstatement fee'] },
  response: { success: true, data: { campaignId: 'WB-2026-00001', campaignName: 'Q4 Win-back' } },
  handler: async (req, res) => { const c = await an.createCampaign(req.body, req.user); await audit(req, { entity: 'winback-campaign', entityId: c.id, action: 'create', after: c }); created(res, c, 'Campaign created'); },
});
define({
  method: 'GET', path: '/campaigns/:id', summary: 'One win-back campaign', screen: 'Operations > Renewals > Lapse Management', middleware: read, response: { success: true, data: { campaignId: 'WB-2026-00001' } },
  handler: async (req, res) => { const c = await an.getCampaign(req.params.id); if (!c) throw notFound('Campaign not found'); ok(res, c); },
});
define({
  method: 'GET', path: '/lock-ins', summary: 'Lock-in and Scheme 2 accounts expiring from asOf to asOf + days (default lockin.review_days_before) with lock-in year, review date, TFS loan status and the notice treatment of their renewal (source, loanStatus, treatment, search); format=excel downloads the extract',
  screen: 'Operations > Renewals > Lock-in Accounts', middleware: read, query: { asOf: '2026-10-10', days: 60, loanStatus: 'All', format: 'excel' },
  response: { success: true, data: { asOf: '2026-10-10', days: 60, to: '2026-12-09', items: [{ policyNumber: 'POL-2025-00412', clientName: 'Maria Santos', sourceLabel: 'Scheme 2', year: 2, reviewDate: '2026-10-21', tfsLoanAccount: 'TFS-0012345', loanStatusLabel: 'Current', noticeTreatment: { code: 'scheme2', label: 'Suppressed: Scheme 2' } }] } },
  handler: async (req, res) => {
    const r = await notices.lockInAccounts(req.query);
    if (['excel', 'xlsx'].includes(String(req.query.format || '').toLowerCase())) {
      return sendSheet(res, { fileName: `lock-in-accounts-${r.asOf}`, sheets: [{ name: 'Lock-in accounts', columns: notices.LOCK_IN_COLUMNS_REPORT, rows: notices.lockInReportRows(r.items) }] });
    }
    return ok(res, r);
  },
});
define({
  method: 'PUT', path: '/lock-ins/:policyId/loan-status', summary: 'Set the TFS loan status of a lock-in account by hand; a blocking status (lockin.blocking_loan_statuses) needs a note and skips the queued renewal notices of the policy',
  screen: 'Operations > Renewals > Lock-in Accounts > Set loan status', middleware: [...write, validate(z.object({ loanStatus: z.string().min(1).max(40), note: z.string().max(1000).optional().nullable() }))],
  request: { loanStatus: 'legal-dispute', note: 'Case filed by TFS on 02/10/2026' }, response: { success: true, data: { before: { loanStatus: 'current' }, after: { loanStatus: 'legal-dispute' }, skippedNotices: 1 } },
  handler: async (req, res) => {
    const r = await notices.setLoanStatus(req.params.policyId, req.body, req.user);
    await audit(req, { entity: 'policy', entityId: req.params.policyId, action: 'loan-status', before: r.before, after: { ...r.after, skippedNotices: r.skippedNotices } });
    ok(res, r, 'Loan status updated');
  },
});
define({
  method: 'GET', path: '/assignees', summary: 'Active users a renewal can be reassigned to (holders of write:renewals)', screen: 'Operations > Renewals > Renewal Queue > Reassign',
  middleware: assign, response: { success: true, data: [{ id: 'usr_1', name: 'Ana Reyes' }] },
  handler: async (_req, res) => ok(res, (await usersWithPermission('write:renewals')).map((u) => ({ id: u.id, name: u.display_name }))),
});
define({
  method: 'GET', path: '/:id', summary: 'Renewal with quotes, notices and activity timeline', screen: 'Operations > Renewals > Renewal Queue > View', middleware: read,
  response: { success: true, data: { ...queueItem, quotes: [], notices: [], activities: [] } },
  handler: async (req, res) => ok(res, await svc.getRenewal(req.params.id)),
});
define({
  method: 'GET', path: '/:id/timeline', summary: 'Negotiation timeline of a renewal, newest first (notes, contacts, notices, quotes, quotations, status changes)', screen: 'Operations > Renewals > Negotiations',
  middleware: read, response: { success: true, data: [{ id: 'act-5', date: '2026-09-27T05:31:28Z', type: 'Counter Offer', category: 'offer', method: 'Phone', description: 'Client asked for a 5% discount', by: 'ana.reyes' }] },
  handler: async (req, res) => { const r = await svc.getRenewal(req.params.id, { withDetail: false }); ok(res, (await an.timelines([r.id])).get(r.id) || []); },
});
define({
  method: 'POST', path: '/:id/quote', summary: 'Generate a renewal quote re-rated at current rates (claims loading, loyalty discount, current taxes) with premium variance', screen: 'Operations > Renewals > Quote Generation',
  middleware: write, response: { success: true, data: { quoteNumber: 'RQ-2026-00001', previousPremium: 18500, quotedPremium: 21450.5, premiumVariance: 2950.5, premiumVariancePct: 15.95, premiumCalculation: { basePremium: 23375, claimsLoading: 0, loyaltyDiscount: -467.5, subtotal: 22907.5, taxes: { vat: 2748.9, dst: 2863.44, lgt: 171.81, fst: 0 }, totalPremium: 28691.65 } } },
  handler: command('quote', async (req) => { const r = await svc.generateQuote(req.params.id, req.user); return { before: r.before, data: r.quote, audit: { quoteNumber: r.quote.quoteNumber, premium: r.quote.quotedPremium, variancePct: r.quote.premiumVariancePct } }; }, 'Renewal quote generated'),
});
define({
  method: 'POST', path: '/:id/notices', summary: 'Send the next renewal notice (first, second, final in order); stage may be given explicitly', screen: 'Operations > Renewals > Renewal Queue',
  middleware: [...write, validate(z.object({ stage: z.coerce.number().int().min(1).max(10).optional(), method: z.enum(['Email', 'SMS', 'Letter', 'Phone']).default('Email') }))],
  request: { stage: 1, method: 'Email' }, response: { success: true, data: { ...queueItem, noticeStage: 1, status: 'First Notice Sent' } },
  handler: command('notice', (req) => svc.sendNotice(req.params.id, req.user, req.body), 'Renewal notice sent'),
});
define({
  method: 'POST', path: '/:id/reminders', summary: 'Send / log a renewal reminder (Email | SMS | Phone | Letter)', screen: 'Operations > Renewals > Renewal Queue > Send Reminder',
  middleware: [...write, validate(z.object({ method: z.enum(['Email', 'SMS', 'Phone', 'Letter']).default('Email'), note: z.string().max(2000).optional() }))],
  request: { method: 'SMS', note: 'Reminded about expiry' }, response: { success: true, data: { ...queueItem, renewalAttempts: 2 } },
  handler: command('reminder', (req) => svc.sendReminder(req.params.id, req.user, req.body), 'Reminder recorded'),
});
define({
  method: 'POST', path: '/:id/activities', summary: 'Add a negotiation update / contact to the renewal timeline', screen: 'Operations > Renewals > Negotiations > Add Update',
  middleware: [...write, validate(z.object({ type: z.string().min(2).max(60), method: z.string().max(40).optional(), description: z.string().min(1).max(4000), outcome: z.string().max(2000).optional(), nextAction: z.string().max(500).optional(), followUpDate: z.string().optional(), details: z.record(z.any()).optional() }))],
  request: { type: 'Counter Offer', method: 'Email', description: 'Client asked for a 5% discount', outcome: 'Pending processing review', nextAction: 'Submit for approval', followUpDate: '2026-10-05' },
  response: { success: true, data: { id: 1, type: 'Counter Offer', method: 'Email', description: 'Client asked for a 5% discount' } },
  handler: async (req, res) => {
    const a = await svc.addActivity(req.params.id, req.user, req.body);
    await audit(req, { entity: 'renewal', entityId: req.params.id, action: 'activity', after: a });
    // a follow-up date becomes a task of the renewal's owner (Operations > My Work)
    if (req.body?.followUpDate) await syncAutoTasksQuietly(req.log);
    created(res, a, 'Update added');
  },
});
define({
  method: 'POST', path: '/:id/escalate', summary: 'Escalate an at-risk renewal to the unit head (manager of the renewal owner, else renewals.approver_roles): recorded on the timeline and notified',
  screen: 'Operations > Renewals > At-Risk Policies > Escalate', middleware: [...write, validate(z.object({ note: z.string().max(2000).optional() }))],
  request: { note: 'Client is comparing quotes from two other brokers' },
  response: { success: true, data: { activity: { id: 12, type: 'Escalation', description: 'Client is comparing quotes from two other brokers' }, escalatedTo: [{ id: 'usr_1', name: 'Carlo Mendoza' }] } },
  handler: command('escalate', (req) => svc.escalate(req.params.id, req.user, req.body), 'Escalated'),
});
define({
  method: 'POST', path: '/:id/win-back', summary: 'Record a win-back offer on a lapsed renewal (optionally linked to a campaign)', screen: 'Operations > Renewals > Lapse Management',
  middleware: [...write, validate(z.object({ offer: z.string().min(1).max(500), method: z.string().max(40).default('Email'), campaignId: z.string().optional(), response: z.string().max(500).optional() }))],
  request: { offer: '10% discount + waived reinstatement fee', method: 'Phone', campaignId: 'wb_1' }, response: { success: true, data: { id: 3, type: 'Win-back', offer: '10% discount' } },
  handler: async (req, res) => {
    const a = await svc.addActivity(req.params.id, req.user, { type: 'Win-back', method: req.body.method, description: req.body.offer, outcome: req.body.response, details: { offer: req.body.offer, campaignId: req.body.campaignId || null } });
    await audit(req, { entity: 'renewal', entityId: req.params.id, action: 'win-back', after: a });
    created(res, a, 'Win-back offer recorded');
  },
});
define({
  method: 'POST', path: '/:id/submit', summary: 'Submit the quoted renewal terms for checker approval', screen: 'Operations > Renewals > Quote Generation', middleware: [...write, validate(noteSchema)],
  request: { note: 'Loyal client, 5% below re-rated premium' }, response: { success: true, data: { ...queueItem, status: 'Pending Approval', statusCode: 'pending-approval' } },
  handler: command('submit', (req) => svc.submitForApproval(req.params.id, req.user, req.body.note), 'Submitted for approval'),
});
define({
  method: 'POST', path: '/:id/approve', summary: 'Checker decision on renewal terms (decision approve | reject; approve:renewals); approver must differ from the submitter', screen: 'Operations > Renewals > Negotiations (approval)',
  middleware: [...approve, validate(z.object({ decision: z.enum(['approve', 'reject']).default('approve'), note: z.string().max(2000).optional() }))],
  request: { decision: 'approve', note: 'Within authority' }, response: { success: true, data: { ...queueItem, status: 'Approved', statusCode: 'approved' } },
  handler: command('approve', (req) => svc.decide(req.params.id, req.user, req.body), 'Decision recorded'),
});
define({
  method: 'POST', path: '/:id/complete', summary: 'Complete the renewal: create the new policy term, mark the old policy renewed, raise the premium receivable', screen: 'Operations > Renewals > Renewal Queue',
  middleware: [...write, validate(z.object({ inceptionDate: z.string().optional(), expiryDate: z.string().optional(), policyNumber: z.string().max(60).optional(), premium: z.coerce.number().positive().optional() }))],
  request: { inceptionDate: '2026-10-31', expiryDate: '2027-10-30' }, response: { success: true, data: { newPolicy: { id: 'pol_9', policyNumber: 'POL-2026-00031', inceptionDate: '2026-10-31', expiryDate: '2027-10-30', premium: 21450.5 }, renewal: { ...queueItem, status: 'Renewed' } } },
  handler: command('complete', async (req) => { const r = await svc.completeRenewal(req.params.id, req.user, req.body); return { before: r.before, renewal: r.renewal, data: { newPolicy: r.newPolicy, renewal: r.renewal }, audit: { status: 'renewed', newPolicy: r.newPolicy } }; }, 'Policy renewed'),
});
define({
  method: 'POST', path: '/:id/lapse', summary: 'Lapse a renewal: reason (text), or reasonCode of the Reason Codes master (lapse) with the reason as its note', screen: 'Operations > Renewals > Lapse Management',
  middleware: [...write, validate(z.object({ reason: z.string().max(2000).optional().nullable(), reasonCode: z.string().max(40).optional().nullable() })
    .refine((b) => (b.reasonCode && String(b.reasonCode).trim()) || String(b.reason || '').trim().length >= 3, { message: 'Give the reason of the lapse (at least 3 characters) or a reason code', path: ['reason'] }))],
  request: { reasonCode: 'LAP-NONRENEW', reason: 'Client moved to another broker' },
  response: { success: true, data: { ...queueItem, status: 'Lapsed', statusCode: 'lapsed' } },
  handler: command('lapse', async (req) => {
    const r = await svc.lapseRenewal(req.params.id, req.user, req.body.reason, req.body.reasonCode);
    return { ...r, audit: { status: 'lapsed', reason: r.renewal?.lapseReason, reasonCode: r.renewal?.lapseReasonCode } };
  }, 'Renewal lapsed'),
});
define({
  method: 'POST', path: '/:id/reassign', summary: 'Reassign an open renewal to another user with a reason (Reason Codes, context renewal_reassign) and remark; the new owner is notified',
  screen: 'Operations > Renewals > Renewal Queue > Reassign', middleware: [...assign, validate(reasonSchema.extend({ toUserId: z.string().min(1).max(60) }))],
  request: { toUserId: 'usr_2', reasonCode: 'RRA-WORKLOAD', note: 'Ana is on leave until 20/10/2026' },
  response: { success: true, data: { ...queueItem, assignedAgent: 'Carlo Mendoza' } },
  handler: command('reassign', (req) => svc.reassignRenewal(req.params.id, req.user, req.body), 'Renewal reassigned'),
});
define({
  method: 'POST', path: '/:id/not-for-renewal', summary: 'Mark an open renewal Not for renewal with a reason (Reason Codes, context non_renewal) and remark',
  screen: 'Operations > Renewals > Renewal Queue > Not for renewal', middleware: [...assign, validate(reasonSchema)],
  request: { reasonCode: 'NFR-LOANCLOSED', note: 'Loan fully paid; client insures elsewhere' },
  response: { success: true, data: { ...queueItem, status: 'Not for renewal', statusCode: 'not-renewed' } },
  handler: command('not-for-renewal', (req) => svc.markNotForRenewal(req.params.id, req.user, req.body), 'Marked not for renewal'),
});
define({
  method: 'POST', path: '/:id/reinstate', summary: 'Reinstate a lapsed renewal, or one marked not for renewal, within the reinstatement window', screen: 'Operations > Renewals > Lapse Management',
  middleware: [...write, validate(noteSchema)], request: { note: 'Client accepted win-back offer' }, response: { success: true, data: { ...queueItem, status: 'Pending', statusCode: 'pipeline' } },
  handler: command('reinstate', (req) => svc.reinstateRenewal(req.params.id, req.user, req.body.note), 'Renewal reinstated'),
});

export default router;
