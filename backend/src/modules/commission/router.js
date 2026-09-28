import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { withTransaction, pool } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { conflict } from '../../lib/errors.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Commission', '/commission');
const read = [requireAuth, requirePermission('read:commission', 'read:quotations')];
const write = [requireAuth, requirePermission('write:commission')];
const SCREEN = 'Commission > Agents/Referrer Accounts';
const lineExample = { id: 'cm_1', policyNo: 'POL-2026-00001', productInsurer: 'Motor · Malayan', cycle: 'Sep 2026', comsub: 1200, comsubRateLabel: '8%', wht: 60, net: 1140, status: 'Eligible', lifecycle: { accruedAt: '02 Sep', eligibleAt: '10 Sep', approvedAt: null, paidAt: null } };
const accountExample = { referrer: { id: 'ref-dcruz', name: 'Juan Dela Cruz', type: 'Agent', level: 'L1', whtApplicable: true }, summary: { cycleLabel: 'Sep 2026', dueThisCycle: 1140, upcoming: 0, paidToDate: 0 }, currentCycle: { label: 'Sep 2026', totalNet: 1140, lines: [lineExample] }, futureCycles: { totalNet: 0, lines: [] }, past: { totalNet: 0, lines: [] }, actions: { approveCount: 1, generatePayoutCount: 0, markEligibleCount: 0 } };

define({
  method: 'GET', path: '/dashboard', summary: 'Commission KPIs, comsub by referrer / product, brokerage by insurer, payable funnel, trend', screen: 'Commission > Commission Dashboard', middleware: read,
  response: { success: true, data: { kpis: { brokerageIncome: 448530, comsubGross: 221706, netMargin: 226824, marginPct: 50.6, outstandingPayable: 150146, whtWithheldPaid: 1228 }, linesByStatus: [{ status: 'Accrued', count: 9 }] } },
  handler: async (_req, res) => ok(res, await svc.dashboard(pool), 'Commission dashboard retrieved'),
});
define({
  method: 'GET', path: '/agents-ready-to-pay', summary: 'Referrers with Approved lines not yet on a payout voucher', screen: 'Accounts > Disbursement > Bulk Disburse', middleware: read,
  response: { success: true, data: { agents: [{ id: 'ref-dcruz', name: 'Juan Dela Cruz', approvedLineCount: 2, comsubGross: 2400, netPayable: 2280 }], summary: { agentCount: 1, totalComsubGross: 2400, totalNet: 2280 } } },
  handler: async (_req, res) => ok(res, await svc.agentsReadyToPay(pool)),
});
define({
  method: 'GET', path: '/referrer-accounts', summary: 'Referrer accounts with net payable this cycle', screen: `${SCREEN}; Quote > Order summary > Commission referral`, middleware: read,
  response: { success: true, data: { summary: { cycleLabel: 'Sep 2026', dueThisCycle: 1140, readyToPay: 0 }, referrers: [{ id: 'ref-dcruz', name: 'Juan Dela Cruz', type: 'Agent', level: 'L1', policies: 1, netPayable: 1140, whtType: 'Individual 5%', whtApplicable: true, bankAccount: 'BDO ***4521', status: 'Active' }] } },
  handler: async (_req, res) => ok(res, await svc.listReferrers(pool), 'Referrer accounts retrieved'),
});
const referrerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).optional(), name: z.string().min(2), type: z.enum(['Agent', 'Sub-agent', 'External']).optional(), level: z.enum(['L1', 'L2']).nullable().optional(),
  parentReferrerId: z.string().nullable().optional(), userId: z.string().nullable().optional(), tin: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(), whtRate: z.number().min(0).max(1).nullable().optional(), whtApplicable: z.boolean().optional(), bankName: z.string().optional(),
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
      whtRate: before.wht_rate, whtApplicable: before.wht_applicable, bankName: before.bank_name, bankAccountNo: before.bank_account_no, status: before.status, ...req.body };
    await withTransaction((db) => svc.upsertReferrer(db, req.params.id, b, req.user));
    await audit(req, { entity: 'commission_referrer', entityId: req.params.id, action: 'update', before, after: req.body });
    ok(res, await svc.buildAccount(pool, req.params.id), 'Referrer updated');
  },
});
define({
  method: 'GET', path: '/referrer-accounts/:id', summary: 'Referrer account: current cycle, future cycles, past lines and available actions', screen: SCREEN, middleware: read,
  response: { success: true, data: accountExample },
  handler: async (req, res) => ok(res, await svc.buildAccount(pool, req.params.id), 'Referrer account retrieved'),
});
define({
  method: 'GET', path: '/referrer-accounts/:id/approved-lines', summary: 'Approved lines not yet on a voucher', screen: SCREEN, middleware: read,
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
      const data = await withTransaction((db) => svc.accountAction(db, req.params.id, action, req.user));
      await audit(req, { entity: 'commission_referrer', entityId: req.params.id, action });
      ok(res, data, action === 'approve' ? 'Lines approved' : 'Lines marked eligible');
    },
  });
}
define({
  method: 'POST', path: '/referrer-accounts/:id/generate-payout', summary: 'Validate approved lines and hand over to Payment Voucher creation', screen: SCREEN, middleware: write,
  request: {}, response: { success: true, data: { redirect: { referrerId: 'ref-dcruz', referrerName: 'Juan Dela Cruz' }, approvedLineCount: 2, totalNet: 2280 } },
  handler: async (req, res) => {
    const ref = await svc.getReferrer(pool, req.params.id);
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
  method: 'POST', path: '/referrer-accounts/:id/wht', summary: 'Toggle withholding tax for a referrer (recomputes unpaid lines)', screen: SCREEN, middleware: [...write, validate(z.object({ whtApplicable: z.boolean() }))],
  request: { whtApplicable: false }, response: { success: true, data: accountExample },
  handler: async (req, res) => {
    const data = await withTransaction((db) => svc.setWht(db, req.params.id, req.body.whtApplicable));
    await audit(req, { entity: 'commission_referrer', entityId: req.params.id, action: 'wht', after: req.body });
    ok(res, data, 'WHT setting updated');
  },
});
define({
  method: 'GET', path: '/referrer-accounts/:id/lines/:lineId', summary: 'One commission line', screen: `${SCREEN} > Line drawer`, middleware: read,
  response: { success: true, data: lineExample },
  handler: async (req, res) => {
    const acct = await svc.buildAccount(pool, req.params.id);
    const line = [...acct.currentCycle.lines, ...acct.futureCycles.lines, ...acct.past.lines].find((l) => l.id === req.params.lineId);
    if (!line) { res.status(404).json({ success: false, message: 'Commission line not found' }); return; }
    ok(res, line);
  },
});
const LINE_ACTIONS = {
  approve: 'Approve an Eligible line (maker-checker; posts Dr Commission Expense / Cr Commission Payable)',
  reverse: 'Reverse a line (reverses the accrual; clawback journal if already paid)',
  'mark-eligible': 'Mark an Accrued line Eligible once the premium is fully collected',
  pay: 'Pay one Approved line (creates a paid voucher; Dr Commission Payable / Cr Cash / Cr WHT Payable)',
  rate: 'Override comsub rate (pct and / or fixed) before approval',
};
for (const [action, summary] of Object.entries(LINE_ACTIONS)) {
  define({
    method: 'POST', path: `/referrer-accounts/:id/lines/:lineId/${action}`, summary, screen: `${SCREEN} > Line drawer`,
    middleware: [...write, validate(action === 'rate' ? z.object({ comsubPct: z.coerce.number().min(0).max(100).optional(), comsubFixed: z.coerce.number().min(0).optional() }) : z.object({}).passthrough())],
    request: action === 'rate' ? { comsubPct: 7.5, comsubFixed: 0 } : {}, response: { success: true, data: { account: accountExample, line: lineExample } },
    handler: async (req, res) => {
      const data = await withTransaction((db) => svc.lineAction(db, req.params.id, req.params.lineId, action, req.user, req.body));
      await audit(req, { entity: 'commission_line', entityId: req.params.lineId, action, after: { ...req.body, status: data.line.status } });
      ok(res, data, `Line ${action} done`);
    },
  });
}
define({
  method: 'POST', path: '/accrue', summary: 'Accrue commission lines for a policy from its commission details (primary + chain)', screen: 'Agent > Quote > Payment confirmation',
  middleware: [requireAuth, requirePermission('write:commission', 'write:policies'), validate(z.object({ policyId: z.string(), commissionDetails: z.any().optional() }))],
  request: { policyId: 'pol_1', commissionDetails: { brokeragePct: 18, primary: { referrerId: 'ref-dcruz', level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: [] } },
  response: { success: true, data: { created: ['cm_1'] } },
  handler: async (req, res) => {
    const ids = await withTransaction((db) => svc.accrueForPolicy(db, req.body.policyId, req.body.commissionDetails));
    await audit(req, { entity: 'commission_line', entityId: req.body.policyId, action: 'accrue', after: { ids } });
    created(res, { created: ids });
  },
});
export default router;
export const mount = '/commission';
