import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { ownRecord, scopeOf } from '../../lib/scope.js';
import { validate, z } from '../../lib/validate.js';
import { withTransaction, pool } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { conflict, notFound } from '../../lib/errors.js';
import * as svc from './service.js';
import * as schemes from './schemes.js';
import { policyBreakdown, recomputeBasis } from './breakdown.js';

const { router, define } = moduleRouter('Commission', '/commission');
const read = [requireAuth, requirePermission('read:commission', 'read:quotations')];
const write = [requireAuth, requirePermission('write:commission')];
const SCREEN = 'Commission > Agents/Referrer Accounts';

/** Lines marked eligible go to the approvers (write:commission); approved lines are reported to whoever made them eligible. */
async function notifyPayout(req, action, makers) {
  try {
    if (action === 'mark-eligible') await svc.askPayoutApproval(pool, req.params.id, { by: req.user.username });
    else if (action === 'approve') await svc.tellPayoutApproved(pool, req.params.id, makers, req.user);
  } catch { /* notifications never fail the action */ }
}
const lineExample = { id: 'cm_1', policyNo: 'POL-2026-00001', productInsurer: 'Motor · Malayan', cycle: 'Sep 2026', comsub: 1200, comsubRateLabel: '8%', wht: 60, net: 1140, status: 'Eligible', lifecycle: { accruedAt: '02 Sep', eligibleAt: '10 Sep', approvedAt: null, paidAt: null } };
const accountExample = { referrer: { id: 'ref-dcruz', name: 'Juan Dela Cruz', type: 'Agent', level: 'L1', whtApplicable: true }, summary: { cycleLabel: 'Sep 2026', dueThisCycle: 1140, upcoming: 0, paidToDate: 0 }, currentCycle: { label: 'Sep 2026', totalNet: 1140, lines: [lineExample] }, futureCycles: { totalNet: 0, lines: [] }, past: { totalNet: 0, lines: [] }, actions: { approveCount: 1, generatePayoutCount: 0, markEligibleCount: 0 } };

define({
  method: 'GET', path: '/dashboard', summary: 'Commission KPIs, comsub by referrer / product, brokerage by insurer, payable funnel, trend', screen: 'Commission > Commission Dashboard', middleware: read,
  response: { success: true, data: { kpis: { brokerageIncome: 448530, comsubGross: 221706, netMargin: 226824, marginPct: 50.6, outstandingPayable: 150146, whtWithheldPaid: 1228 }, linesByStatus: [{ status: 'Accrued', count: 9 }] } },
  handler: async (req, res) => ok(res, await svc.dashboard(pool, await scopeOf(req)), 'Commission dashboard retrieved'),
});
define({
  method: 'GET', path: '/agents-ready-to-pay', summary: 'Referrers with Approved lines not yet on a payout voucher', screen: 'Accounts > Disbursement > Bulk Disburse', middleware: read,
  response: { success: true, data: { agents: [{ id: 'ref-dcruz', name: 'Juan Dela Cruz', approvedLineCount: 2, comsubGross: 2400, netPayable: 2280 }], summary: { agentCount: 1, totalComsubGross: 2400, totalNet: 2280 } } },
  handler: async (req, res) => ok(res, await svc.agentsReadyToPay(pool, await scopeOf(req))),
});
define({
  method: 'GET', path: '/referrer-accounts', summary: 'Referrer accounts with net payable this cycle', screen: `${SCREEN}; Quote > Order summary > Commission referral`, middleware: read,
  response: { success: true, data: { summary: { cycleLabel: 'Sep 2026', dueThisCycle: 1140, readyToPay: 0 }, referrers: [{ id: 'ref-dcruz', name: 'Juan Dela Cruz', type: 'Agent', level: 'L1', policies: 1, netPayable: 1140, whtType: 'Individual 5%', whtApplicable: true, bankAccount: 'BDO ***4521', status: 'Active' }] } },
  handler: async (req, res) => ok(res, await svc.listReferrers(pool, await scopeOf(req)), 'Referrer accounts retrieved'),
});
const referrerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).optional(), name: z.string().min(2), type: z.enum(svc.REFERRER_TYPES).optional(), level: z.enum(['L1', 'L2']).nullable().optional(),
  parentReferrerId: z.string().nullable().optional(), userId: z.string().nullable().optional(), tin: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(), whtCode: z.string().nullable().optional(), whtApplicable: z.boolean().optional(), bankName: z.string().optional(),
  bankAccountNo: z.string().optional(), status: z.enum(['Active', 'Inactive']).optional(),
}).passthrough();
define({
  method: 'POST', path: '/referrer-accounts', summary: 'Create a referrer (agent, sub-agent or external)', screen: SCREEN, middleware: [...write, validate(referrerSchema)],
  request: { name: 'Juan Dela Cruz', type: 'Agent', level: 'L1', bankName: 'BDO', bankAccountNo: '001234564521' }, response: { success: true, data: accountExample },
  handler: async (req, res) => {
    const id = await withTransaction((db) => svc.upsertReferrer(db, null, req.body, req.user));
    await audit(req, { entity: 'commission_referrer', entityId: id, action: 'create', after: req.body });
    created(res, await svc.buildAccount(pool, id));
  },
});
define({
  method: 'PUT', path: '/referrer-accounts/:id', summary: 'Update a referrer', screen: SCREEN, middleware: [...write, validate(referrerSchema.partial().extend({ name: z.string().min(2).optional() }))],
  request: { bankAccountNo: '001234567777', status: 'Active' }, response: { success: true, data: accountExample },
  handler: async (req, res) => {
    const before = await svc.getReferrer(pool, req.params.id);
    const b = { name: before.name, type: before.referrer_type, level: before.level, parentReferrerId: before.parent_referrer_id, userId: before.user_id, tin: before.tin, email: before.email, phone: before.phone,
      whtCode: before.wht_code, whtApplicable: before.wht_applicable, bankName: before.bank_name, bankAccountNo: before.bank_account_no, status: before.status, ...req.body };
    await withTransaction((db) => svc.upsertReferrer(db, req.params.id, b, req.user));
    await audit(req, { entity: 'commission_referrer', entityId: req.params.id, action: 'update', before, after: req.body });
    ok(res, await svc.buildAccount(pool, req.params.id), 'Referrer updated');
  },
});
define({
  method: 'GET', path: '/referrer-accounts/:id', summary: 'Referrer account: current cycle, future cycles, past lines and available actions', screen: SCREEN, middleware: [...read, ownRecord('referrer')],
  response: { success: true, data: accountExample },
  handler: async (req, res) => ok(res, await svc.buildAccount(pool, req.params.id), 'Referrer account retrieved'),
});
define({
  method: 'GET', path: '/referrer-accounts/:id/approved-lines', summary: 'Approved lines not yet on a voucher', screen: SCREEN, middleware: [...read, ownRecord('referrer')],
  response: { success: true, data: { lines: [lineExample], totalNet: 1140 } },
  handler: async (req, res) => {
    const lines = await Promise.all((await svc.approvedLines(pool, req.params.id)).map(svc.lineView));
    ok(res, { lines, totalNet: lines.reduce((s, l) => s + l.net, 0) });
  },
});
for (const action of ['approve', 'mark-eligible']) {
  define({
    method: 'POST', path: `/referrer-accounts/:id/${action}`, summary: action === 'approve' ? 'Approve every Eligible line (maker-checker; posts comsub accrual)' : 'Mark Accrued lines with fully collected premium as Eligible',
    screen: SCREEN, middleware: write, request: {}, response: { success: true, data: accountExample },
    handler: async (req, res) => {
      const makers = action === 'approve' ? await svc.eligibleMakers(pool, req.params.id) : [];
      const data = await withTransaction((db) => svc.accountAction(db, req.params.id, action, req.user));
      await audit(req, { entity: 'commission_referrer', entityId: req.params.id, action });
      await notifyPayout(req, action, makers);
      ok(res, data, action === 'approve' ? 'Lines approved' : 'Lines marked eligible');
    },
  });
}
define({
  method: 'POST', path: '/referrer-accounts/:id/generate-payout', summary: 'Validate approved lines and hand over to Payment Voucher creation', screen: SCREEN, middleware: write,
  request: {}, response: { success: true, data: { redirect: { referrerId: 'ref-dcruz', referrerName: 'Juan Dela Cruz' }, approvedLineCount: 2, totalNet: 2280 } },
  handler: async (req, res) => {
    const ref = await svc.getReferrer(pool, req.params.id);
    await svc.assertPayable(ref);
    const lines = await svc.approvedLines(pool, ref.id);
    if (!lines.length) throw conflict('No approved lines to pay');
    await audit(req, { entity: 'commission_referrer', entityId: ref.id, action: 'generate-payout', after: { lines: lines.map((l) => l.id) } });
    ok(res, { redirect: { referrerId: ref.id, referrerName: ref.name }, approvedLineCount: lines.length, totalNet: lines.reduce((s, l) => s + Number(l.net_amount), 0), account: await svc.buildAccount(pool, ref.id) });
  },
});
define({
  method: 'POST', path: '/referrer-accounts/:id/pay-lines', summary: 'Pay selected Approved lines on one voucher (maker-checker vs approver)', screen: SCREEN, middleware: [...write, validate(z.object({ lineIds: z.array(z.string()).min(1) }).passthrough())],
  request: { lineIds: ['cm_1'] }, response: { success: true, data: accountExample },
  handler: async (req, res) => {
    const { createCommissionVoucher } = await import('../disbursements/service.js');
    const data = await withTransaction(async (db) => {
      const ref = await svc.getReferrer(db, req.params.id);
      await svc.assertPayable(ref);
      const lines = (await svc.approvedLines(db, ref.id)).filter((l) => req.body.lineIds.includes(l.id));
      if (lines.length !== req.body.lineIds.length) throw conflict('Some lines are not Approved or are already on a voucher');
      const d = await createCommissionVoucher(db, { referrer: ref, lines, user: req.user, status: 'paid' });
      await svc.payLines(db, { lines, disbursement: d, user: req.user, checkApprover: true });
      return svc.buildAccount(db, ref.id);
    });
    await audit(req, { entity: 'commission_referrer', entityId: req.params.id, action: 'pay-lines', after: req.body });
    ok(res, data, 'Lines paid');
  },
});
define({
  method: 'POST', path: '/referrer-accounts/:id/wht', summary: 'Toggle withholding tax for a referrer (recomputes unpaid lines); the reason is kept in the audit trail', screen: SCREEN,
  middleware: [...write, validate(z.object({ whtApplicable: z.boolean(), reason: z.string().trim().min(3) }))],
  request: { whtApplicable: false, reason: 'BIR certificate of exemption received' }, response: { success: true, data: accountExample },
  handler: async (req, res) => {
    const data = await withTransaction((db) => svc.setWht(db, req.params.id, req.body.whtApplicable));
    await audit(req, { entity: 'commission_referrer', entityId: req.params.id, action: 'wht', after: req.body });
    ok(res, data, 'WHT setting updated');
  },
});
define({
  method: 'GET', path: '/referrer-accounts/:id/lines/:lineId', summary: 'One commission line', screen: `${SCREEN} > Line drawer`, middleware: [...read, ownRecord('referrer')],
  response: { success: true, data: lineExample },
  handler: async (req, res) => {
    const acct = await svc.buildAccount(pool, req.params.id);
    const line = [...acct.currentCycle.lines, ...acct.futureCycles.lines, ...acct.past.lines].find((l) => l.id === req.params.lineId);
    if (!line) throw notFound('Commission line not found');
    ok(res, line);
  },
});
const LINE_ACTIONS = {
  approve: 'Approve an Eligible line (maker-checker; posts Dr Commission Expense / Cr Commission Payable)',
  reverse: 'Reverse a line, with the reason (reverses the accrual; clawback journal if already paid)',
  'mark-eligible': 'Mark an Accrued line Eligible once the premium is fully collected',
  pay: 'Pay one Approved line (creates a paid voucher; Dr Commission Payable / Cr Cash / Cr WHT Payable)',
  rate: 'Override comsub rate (pct and / or fixed) before approval',
};
for (const [action, summary] of Object.entries(LINE_ACTIONS)) {
  define({
    method: 'POST', path: `/referrer-accounts/:id/lines/:lineId/${action}`, summary, screen: `${SCREEN} > Line drawer`,
    middleware: [...write, validate(action === 'rate' ? z.object({ comsubPct: z.coerce.number().min(0).max(100).optional(), comsubFixed: z.coerce.number().min(0).optional() })
      : action === 'reverse' ? z.object({ reason: z.string().trim().min(3) }).passthrough() : z.object({}).passthrough())],
    request: action === 'rate' ? { comsubPct: 7.5, comsubFixed: 0 } : action === 'reverse' ? { reason: 'Policy cancelled from inception' } : {}, response: { success: true, data: { account: accountExample, line: lineExample } },
    handler: async (req, res) => {
      const makers = action === 'approve' ? await svc.eligibleMakers(pool, req.params.id, req.params.lineId) : [];
      const data = await withTransaction((db) => svc.lineAction(db, req.params.id, req.params.lineId, action, req.user, req.body));
      await audit(req, { entity: 'commission_line', entityId: req.params.lineId, action, after: { ...req.body, status: data.line.status } });
      await notifyPayout(req, action, makers);
      ok(res, data, `Line ${action} done`);
    },
  });
}
define({
  method: 'POST', path: '/accrue', summary: 'Accrue commission lines for a policy from its commission details (primary + chain)', screen: 'Agent > Quote > Payment confirmation',
  middleware: [requireAuth, requirePermission('write:commission', 'write:policies'), validate(z.object({ policyId: z.string(), commissionDetails: z.any().optional() })), ownRecord('policy', (req) => req.body.policyId)],
  request: { policyId: 'pol_1', commissionDetails: { brokeragePct: 18, primary: { referrerId: 'ref-dcruz', level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: [] } },
  response: { success: true, data: { created: ['cm_1'] } },
  handler: async (req, res) => {
    const ids = await withTransaction((db) => svc.accrueForPolicy(db, req.body.policyId, req.body.commissionDetails));
    await audit(req, { entity: 'commission_line', entityId: req.body.policyId, action: 'accrue', after: { ids } });
    created(res, { created: ids });
  },
});
// ---------- requests: rate change, reversal, withholding tax (maker-checker; TIS-BRD-COMM-02) ----------
const approveCommission = [requireAuth, requirePermission('approve:commission')];
const requestExample = { id: 7, kind: 'rate', commissionId: 'cm_1', referrerId: 'ref-dcruz', policyNumber: 'POL-2026-00001', fromValue: { comsubPct: 8, comsubFixed: 0 }, toValue: { comsubPct: 7.5, comsubFixed: 0 },
  reasonCode: 'CRT-SPECIAL', reason: 'Agreed special rate', status: 'pending', requestedBy: 'Finance user' };
define({
  method: 'POST', path: '/referrer-accounts/:id/lines/:lineId/requests', summary: 'Ask for a rate change (comsubPct, comsubFixed), a reversal or a withholding tax change (whtApplicable) on a line, with a reason of the Reason Codes master; approved by a second user holding approve:commission (applied at once while no approval is required)',
  screen: `${SCREEN} > Line drawer`, middleware: [...write, validate(z.object({ kind: z.enum(svc.REQUEST_KINDS), comsubPct: z.coerce.number().min(0).max(100).optional(), comsubFixed: z.coerce.number().min(0).optional(),
    whtApplicable: z.boolean().optional(), reasonCode: z.string().trim().min(1), note: z.string().trim().max(500).optional() }).passthrough())],
  request: { kind: 'rate', comsubPct: 7.5, reasonCode: 'CRT-SPECIAL' }, response: { success: true, data: { request: requestExample, account: accountExample, line: lineExample } },
  handler: async (req, res) => {
    const data = await withTransaction((db) => svc.requestLineChange(db, req.params.id, req.params.lineId, req.body, req.user));
    await audit(req, { entity: 'commission_line', entityId: req.params.lineId, action: `request-${req.body.kind}`, after: { ...req.body, requestId: data.request.id, status: data.request.status } });
    ok(res, data, data.request.status === 'pending' ? 'Request sent for approval' : 'Change applied');
  },
});
define({
  method: 'GET', path: '/requests', summary: 'Rate change, reversal and withholding tax requests (status pending by default, approved, rejected or all; referrerId)', screen: `${SCREEN} > Requests`, middleware: read,
  query: { status: 'pending' }, response: { success: true, data: [requestExample] },
  handler: async (req, res) => ok(res, await svc.listLineRequests(pool, req.query)),
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/requests/:requestId/${action}`, summary: `${action === 'approve' ? 'Approve and apply' : 'Reject (note required)'} a commission change request; never the requester`, screen: `${SCREEN} > Requests`,
    middleware: [...approveCommission, validate(z.object({ note: z.string().trim().max(500).optional() }).passthrough())], request: { note: action === 'approve' ? 'Checked' : 'Rate not agreed' },
    response: { success: true, data: { request: { ...requestExample, status: action === 'approve' ? 'approved' : 'rejected' }, account: accountExample } },
    handler: async (req, res) => {
      const data = await withTransaction((db) => svc.decideLineRequest(db, req.params.requestId, action, req.body, req.user));
      await audit(req, { entity: 'commission_line', entityId: data.request.commissionId, action: `request-${action}`, after: { requestId: data.request.id, kind: data.request.kind, note: req.body.note || null } });
      ok(res, data, `Request ${action === 'approve' ? 'approved' : 'rejected'}`);
    },
  });
}
define({
  method: 'POST', path: '/referrer-accounts/:id/lines/:lineId/share', summary: 'Change the share of an unapproved line inside the minimum and maximum of its sharing scheme (write:commission-share), with a reason', screen: `${SCREEN} > Line drawer`,
  middleware: [requireAuth, requirePermission('write:commission-share'), validate(z.object({ value: z.coerce.number().min(0), reasonCode: z.string().trim().optional(), note: z.string().trim().max(500).optional() }).passthrough())],
  request: { value: 0.2, reasonCode: 'CSH-NEGOTIATED' }, response: { success: true, data: { account: accountExample, line: lineExample } },
  handler: async (req, res) => {
    const data = await withTransaction((db) => svc.changeShare(db, req.params.id, req.params.lineId, req.body, req.user));
    await audit(req, { entity: 'commission_line', entityId: req.params.lineId, action: 'share', after: { value: req.body.value, reason: data.reason, amount: data.line.comsub } });
    ok(res, data, 'Share changed');
  },
});

// ---------- commission breakdown of a policy (TIS-BRD-COMM-06) ----------
const breakdownRead = [requireAuth, requirePermission('read:commission-rules', 'read:remittance', 'write:remittance', 'read:commission', 'read:policies')];
define({
  method: 'GET', path: '/policies/:policyId/breakdown', summary: 'Commission breakdown of a policy: per peril the sum insured, premium, issuing, insurer net and TIS remitting rates, insurer remitting, commission and variance share; gross commission, shares, retained; the remittance and billing statement carrying it; whether Recompute is allowed',
  screen: 'Operations > Policy > Commission breakdown', middleware: breakdownRead,
  response: { success: true, data: { policyNumber: 'POL-2026-00412', basis: { rateBasis: 'issuing-remitting', grossCommission: 16131.25, varianceShare: 4800, retained: 11331.25, perils: [] }, recompute: { allowed: true, reason: null } } },
  handler: async (req, res) => ok(res, await policyBreakdown(req.params.policyId)),
});
define({
  method: 'POST', path: '/policies/:policyId/recompute', summary: 'Recompute the commission of a policy from the rules register on its inception date (write:remittance); refused once the policy is on an approved remittance',
  screen: 'Operations > Policy > Commission breakdown', middleware: [requireAuth, requirePermission('write:remittance')],
  response: { success: true, data: { message: 'Commission recomputed: 0.00 to 7,891.25.' } },
  handler: async (req, res) => {
    const r = await recomputeBasis(req.params.policyId, req.user);
    await audit(req, { entity: 'commission_basis', entityId: req.params.policyId, action: 'recompute', before: r.before, after: r.basis });
    ok(res, { ...r, breakdown: await policyBreakdown(req.params.policyId) }, r.message);
  },
});

// ---------- sharing schemes (TIS-BRD-PROD-16; Commission > Sharing Schemes) ----------
const schemeRead = [requireAuth, requirePermission('read:sharing-schemes', 'write:sharing-schemes', 'approve:sharing-schemes')];
const schemeWrite = [requireAuth, requirePermission('write:sharing-schemes')];
const schemeApprove = [requireAuth, requirePermission('approve:sharing-schemes')];
const SCHEMES = 'Commission > Sharing Schemes';
const schemeExample = { id: 1, code: 'EXT-AGENT-STD', name: 'External agents, TFS team members and referrals', partyTypes: ['Agent', 'TFS team member', 'Referral', 'External'], productIds: [2], policyType: 'any',
  effectiveFrom: '2026-11-01', effectiveTo: null, status: 'active', statusLabel: 'Active', version: 1, lines: [{ lineNo: 1, paidTo: 'referrer', basis: 'variance', perils: ['OD', 'AON'], defaultValue: 0.3, min: 0, max: 0.3 }] };
const lineSchema = z.object({ paidTo: z.enum(schemes.PAID_TO), basis: z.enum(schemes.SHARE_BASES), perils: z.array(z.string()).optional(), defaultValue: z.coerce.number().min(0), min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).nullable().optional(), addToReferrer: z.boolean().optional(), description: z.string().max(200).nullable().optional() }).passthrough();
const schemeFields = { code: z.string().trim().max(20).optional(), name: z.string().trim().max(120).optional(), partyTypes: z.array(z.string()).optional(), productIds: z.array(z.coerce.number()).optional(),
  insurerIds: z.array(z.coerce.number()).optional(), policyType: z.enum(['new', 'renewal', 'any']).optional(), effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), payWhenFullyPaid: z.boolean().optional(), combineWithReferrer: z.boolean().optional(), lines: z.array(lineSchema).optional(),
  remarks: z.string().max(500).nullable().optional(), submit: z.boolean().optional(), changeNote: z.string().max(500).nullable().optional() };
define({
  method: 'GET', path: '/sharing-schemes', summary: 'Sharing schemes (status, partyType, productId, search; superseded versions left out by default)', screen: SCHEMES, middleware: schemeRead,
  response: { success: true, data: [schemeExample] }, handler: async (req, res) => ok(res, await schemes.listSchemes(req.query)),
});
define({
  method: 'GET', path: '/sharing-schemes/options', summary: 'Lists of the scheme dialog: party types, share bases, paid-to values, whether schemes are approved', screen: `${SCHEMES} > Add scheme`, middleware: schemeRead,
  response: { success: true, data: { partyTypes: schemes.PARTY_TYPES } },
  handler: async (req, res) => ok(res, { ...schemes.schemeOptions(), approvalRequired: await schemes.approvalRequired() }),
});
define({
  method: 'POST', path: '/sharing-schemes/example', summary: 'Worked example of split lines on a sample policy (sum insured, net premium, commission): the amount of each line and what TISPH keeps', screen: `${SCHEMES} > Split lines`,
  middleware: [...schemeRead, validate(z.object({ lines: z.array(lineSchema), sumInsured: z.coerce.number().optional(), netPremium: z.coerce.number().optional(), commission: z.coerce.number().optional() }).passthrough())],
  request: { lines: schemeExample.lines, sumInsured: 800000, netPremium: 20000, commission: 7200 }, response: { success: true, data: { rows: [{ paidTo: 'referrer', basis: 'variance', amount: 3200 }], shared: 3200, retained: 4000 } },
  handler: async (req, res) => ok(res, schemes.exampleShares(await schemes.cleanLines(req.body.lines), req.body)),
});
define({
  method: 'POST', path: '/sharing-schemes/assign', summary: 'Assign a scheme (or none) with an override inside its limits to a referrer (referrerId) or a distribution channel (channelId); approved on Configuration Approvals under review', screen: `${SCHEMES} > Assignments; ${SCREEN}; Master > Insurance > Distribution Channels`,
  middleware: [...schemeWrite, validate(z.object({ referrerId: z.string().nullable().optional(), channelId: z.string().nullable().optional(), schemeCode: z.string().nullable().optional(), override: z.coerce.number().nullable().optional(), note: z.string().max(500).nullable().optional() }).passthrough())],
  request: { referrerId: 'ref-dcruz', schemeCode: 'EXT-AGENT-STD', override: 0.25 }, response: { success: true, data: { pending: true, change: { id: 12 } } },
  handler: async (req, res) => {
    if (!req.body.referrerId && !req.body.channelId) throw conflict('Name a referrer or a distribution channel');
    const r = await schemes.assignScheme(req.body, req.user);
    await audit(req, { entity: 'scheme_assignment', entityId: req.body.referrerId || req.body.channelId, action: r.pending ? 'request' : 'assign', after: req.body });
    ok(res, r, r.pending ? 'Scheme assignment sent for approval' : 'Scheme assigned');
  },
});
define({
  method: 'GET', path: '/sharing-schemes/:ref/assignments', summary: 'The referrers and channels using a scheme, with their override', screen: `${SCHEMES} > Assignments`, middleware: schemeRead,
  response: { success: true, data: { referrers: [], channels: [] } }, handler: async (req, res) => ok(res, await schemes.schemeAssignments(req.params.ref)),
});
define({
  method: 'GET', path: '/sharing-schemes/:ref', summary: 'One sharing scheme (id or code)', screen: SCHEMES, middleware: schemeRead, response: { success: true, data: schemeExample },
  handler: async (req, res) => ok(res, await schemes.getScheme(req.params.ref)),
});
define({
  method: 'POST', path: '/sharing-schemes', summary: 'Add a sharing scheme (code, name, party types, products, split lines); a draft under review (submit: true sends it for approval), else active at once', screen: `${SCHEMES} > Add scheme`,
  middleware: [...schemeWrite, validate(z.object({ ...schemeFields, code: z.string().trim().max(20), name: z.string().trim().max(120) }).passthrough())],
  request: { code: 'DLR-STD', name: 'Dealer standard share', partyTypes: ['Dealer'], productIds: [2], effectiveFrom: '2026-12-01', lines: [{ paidTo: 'channel', basis: 'commission-pct', defaultValue: 40, min: 30, max: 50 }] },
  response: { success: true, data: schemeExample },
  handler: async (req, res) => {
    const s = await schemes.createScheme(req.body, req.user);
    await audit(req, { entity: 'sharing_scheme', entityId: String(s.id), action: req.body.submit ? 'submit' : 'create', after: s });
    created(res, s, s.status === 'pending' ? 'Sharing scheme sent for approval' : 'Sharing scheme saved');
  },
});
define({
  method: 'PUT', path: '/sharing-schemes/:ref', summary: 'Change a sharing scheme: a draft or returned one in place; an active one as a new version (submit: true sends it for approval)', screen: `${SCHEMES} > Edit scheme`,
  middleware: [...schemeWrite, validate(z.object(schemeFields).passthrough())], request: { lines: schemeExample.lines, submit: true }, response: { success: true, data: schemeExample },
  handler: async (req, res) => {
    const before = await schemes.getScheme(req.params.ref);
    const s = await schemes.updateScheme(req.params.ref, req.body, req.user);
    await audit(req, { entity: 'sharing_scheme', entityId: String(s.id), action: s.id !== before.id ? 'amend' : 'update', before, after: s });
    ok(res, s, s.status === 'pending' ? 'Sharing scheme sent for approval' : 'Sharing scheme saved');
  },
});
define({
  method: 'POST', path: '/sharing-schemes/:ref/submit', summary: 'Submit a draft or returned scheme for approval (at least one split line)', screen: SCHEMES, middleware: [...schemeWrite, validate(z.object({ changeNote: z.string().max(500).nullable().optional() }).passthrough())],
  response: { success: true, data: { ...schemeExample, status: 'pending' } },
  handler: async (req, res) => {
    const s = await schemes.submitScheme(req.params.ref, req.user, req.body);
    await audit(req, { entity: 'sharing_scheme', entityId: String(s.id), action: 'submit', after: s });
    ok(res, s, 'Sharing scheme sent for approval');
  },
});
define({
  method: 'POST', path: '/sharing-schemes/:ref/withdraw', summary: 'Withdraw a pending scheme (its maker or an approver)', screen: SCHEMES, middleware: schemeWrite, response: { success: true, data: { ...schemeExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const s = await schemes.withdrawScheme(req.params.ref, req.user);
    await audit(req, { entity: 'sharing_scheme', entityId: String(s.id), action: 'withdraw', after: s });
    ok(res, s, 'Sharing scheme withdrawn');
  },
});
for (const action of ['suspend', 'resume', 'end']) {
  define({
    method: 'POST', path: `/sharing-schemes/:ref/${action}`, summary: `${action === 'suspend' ? 'Suspend an active scheme (no new quotation uses it; a remark is required)' : action === 'resume' ? 'Resume a suspended scheme' : 'End a scheme today (scheme_end reason; a scheme with assignments needs a replacement scheme or the confirmation that the business is no longer shared)'}`,
    screen: SCHEMES, middleware: [...schemeApprove, validate(z.object({ note: z.string().max(500).optional(), remarks: z.string().max(500).optional(), reasonCode: z.string().optional(), replacementCode: z.string().optional(), confirmNoSharing: z.boolean().optional() }).passthrough())],
    request: action === 'end' ? { reasonCode: 'SEN-REPLACED', replacementCode: 'DLR-STD-2' } : { note: 'Terms under review' }, response: { success: true, data: schemeExample },
    handler: async (req, res) => {
      const s = await schemes.changeSchemeState(req.params.ref, action, req.body, req.user);
      await audit(req, { entity: 'sharing_scheme', entityId: String(s.id), action, after: { ...req.body, status: s.status } });
      ok(res, s, `Sharing scheme ${action === 'suspend' ? 'suspended' : action === 'resume' ? 'resumed' : 'ended'}`);
    },
  });
}

export default router;
export const mount = '/commission';
