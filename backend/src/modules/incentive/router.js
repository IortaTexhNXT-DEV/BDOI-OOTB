import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { forbidden } from '../../lib/errors.js';
import { created, ok } from '../../lib/respond.js';
import { many } from '../../db/pool.js';
import { canRead, canWrite } from '../masters/helpers.js';
import * as svc from './service.js';

/** Incentive (Accounts > Incentive, 4 screens + reports) and Master > Incentive Programs. */
const { router, define } = moduleRouter('Incentive', '/incentive');
const read = canRead('incentive');
const write = canWrite('incentive');
// Program set-up is master data (Master > Incentive Programs): business / IT administrators, not the finance users who pay (D102).
const programWrite = canWrite('masters');
// Agents see their own programs and statements with the profile permission; incentive readers may look up any agent.
const self = canRead('incentive', 'read:profile');
const S = (n) => `Accounts > Incentive > ${n}`;
const program = { id: 1, programCode: 'INC-2026-001', programName: 'Q3 Premium Achievers', programType: 'Target Based', applicableTo: ['Individual Agent'], startDate: '2026-07-01', endDate: '2026-09-30', targetMetric: 'Premium Volume', baseTarget: 500000, stretchTarget: 750000, Currency: 'PHP', calculationFrequency: 'Quarterly', status: 'Active', structure: [{ level: '80-90%', type: 'Percentage', value: 2, maxPayout: 20000 }] };
const batch = { batchId: 'CALC-2026-00001', period: 'August 2026', calculationDate: '2026-09-01', programsIncluded: ['INC-2026-002'], totalAmount: 61500, agentCount: 3, status: 'Pending Approval', details: [{ agentName: 'Juan Dela Cruz', program: 'New Business Champion', target: 20, achieved: 18, achievementPercent: 90, baseIncentive: 13500, adjustments: 0, finalAmount: 13500, status: 'Calculated' }] };
const run = async (req, entity, action, fn) => {
  const out = await fn();
  await audit(req, { entity, entityId: out?.after?.batchId ?? out?.after?.id ?? out?.batchId ?? out?.id ?? req.params.id, action, before: out?.before, after: out?.after ?? out });
  return out?.after ?? out;
};
const isReader = (u) => (u.roles || []).some((r) => ['it-admin', 'ba'].includes(r)) || (u.permissions || []).some((p) => ['read:incentive', 'write:incentive'].includes(p));
const agentFor = (req) => {
  const wanted = req.query.agentId;
  if (wanted && wanted !== req.user.id && !isReader(req.user)) throw forbidden('You can only view your own incentives');
  return wanted || req.user.id;
};

// ---------- programs (Master > Incentive Programs) ----------
define({
  method: 'GET', path: '/programs', summary: 'Incentive programs (status, search) with participants and total payout', screen: 'Master > Incentive Programs; Incentive screens', middleware: self,
  query: { status: 'Active' }, response: { success: true, data: [program] },
  handler: async (req, res) => ok(res, await svc.listPrograms(req.query)),
});
define({
  method: 'GET', path: '/programs/:id', summary: 'One program (id or program code)', screen: 'Master > Incentive Programs > View', middleware: self, response: { success: true, data: program },
  handler: async (req, res) => ok(res, await svc.getProgram(req.params.id)),
});
define({
  method: 'POST', path: '/programs', summary: 'Create a program (metric, types and frequencies validated against configuration)', screen: 'Master > Incentive Programs > Add Program', middleware: programWrite,
  request: { ...program, id: undefined, programCode: 'INC-2026-010' }, response: { success: true, data: program },
  handler: async (req, res) => created(res, await run(req, 'incentive_program', 'create', () => svc.createProgram(req.body || {}, req.user)), 'Program created'),
});
define({
  method: 'PUT', path: '/programs/:id', summary: 'Update a program (partial; also used to toggle status)', screen: 'Master > Incentive Programs > Edit', middleware: programWrite,
  request: { status: 'Inactive' }, response: { success: true, data: { ...program, status: 'Inactive' } },
  handler: async (req, res) => ok(res, await run(req, 'incentive_program', 'update', () => svc.updateProgram(req.params.id, req.body || {}, req.user)), 'Program updated'),
});
define({
  method: 'DELETE', path: '/programs/:id', summary: 'Delete a program (soft; blocked while calculations are pending or approved)', screen: 'Master > Incentive Programs', middleware: programWrite,
  response: { success: true, message: 'Program deleted successfully' },
  handler: async (req, res) => ok(res, await run(req, 'incentive_program', 'delete', () => svc.deleteProgram(req.params.id, req.user)), 'Program deleted successfully'),
});

// ---------- calculations and approvals ----------
define({
  method: 'GET', path: '/calculations', summary: 'Calculation batches with agent details (status filter; details=false for summaries)', screen: S('Calculations'), middleware: read,
  query: { status: 'Pending Approval' }, response: { success: true, data: [batch] },
  handler: async (req, res) => ok(res, await svc.listCalculations(req.query)),
});
define({
  method: 'GET', path: '/calculations/:batchId', summary: 'One calculation batch', screen: S('Calculations > Details'), middleware: read, response: { success: true, data: batch },
  handler: async (req, res) => ok(res, await svc.getCalculation(req.params.batchId)),
});
define({
  method: 'POST', path: '/calculations', summary: 'Run a calculation for a period and programs (achievement from policies / quotes, payout from program tiers)', screen: S('Calculations > New Calculation'), middleware: write,
  request: { period: '2026-09', selectedPrograms: ['INC-2026-002'], description: 'September run' }, response: { success: true, data: { ...batch, status: 'Calculated' } },
  handler: async (req, res) => created(res, await run(req, 'incentive_calculation', 'calculate', () => svc.runCalculation(req.body || {}, req.user)), 'Calculation complete'),
});
define({
  method: 'POST', path: '/calculations/:batchId/adjust', summary: 'Adjust agent lines before submission (amount and reason per line)', screen: S('Calculations > Details'), middleware: write,
  request: { lines: [{ id: 12, adjustments: -1000, reason: 'Chargeback on cancelled policy' }] }, response: { success: true, data: batch },
  handler: async (req, res) => ok(res, await run(req, 'incentive_calculation', 'adjust', () => svc.adjustCalculation(req.params.batchId, req.body || {})), 'Adjustments saved'),
});
define({
  method: 'POST', path: '/calculations/:batchId/submit', summary: 'Submit a batch for approval', screen: S('Calculations'), middleware: write, response: { success: true, data: { ...batch, status: 'Pending Approval' } },
  handler: async (req, res) => ok(res, await run(req, 'incentive_calculation', 'submit', () => svc.submitCalculation(req.params.batchId, req.user)), 'Submitted for approval'),
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/calculations/:batchId/${action}`, summary: `${action === 'approve' ? 'Approve' : 'Reject'} a batch (maker-checker: not the creator or submitter)`, screen: S('Approvals'), middleware: write,
    request: action === 'reject' ? { reason: 'Targets not verified' } : {}, response: { success: true, data: { ...batch, status: action === 'approve' ? 'Approved' : 'Rejected' } },
    handler: async (req, res) => ok(res, await run(req, 'incentive_calculation', action, () => svc.decideCalculation(req.params.batchId, action, req.body || {}, req.user)), `Batch ${action}d`),
  });
}
define({
  method: 'POST', path: '/calculations/:batchId/pay', summary: 'Mark an approved batch as paid', screen: S('Approvals'), middleware: write, request: { paymentDate: '2026-09-30', paymentReference: 'PV-2026-00123' },
  response: { success: true, data: { ...batch, status: 'Paid' } },
  handler: async (req, res) => ok(res, await run(req, 'incentive_calculation', 'pay', () => svc.payCalculation(req.params.batchId, req.body || {}, req.user)), 'Batch marked as paid'),
});
define({
  method: 'GET', path: '/approvals', summary: 'Approval board: all batches with waiting days and a summary', screen: S('Approvals'), middleware: read,
  response: { success: true, data: { approvals: [batch], summary: { pending: 1, pendingAmount: 61500, approvedToday: 0, rejectedToday: 0 } } },
  handler: async (_req, res) => ok(res, await svc.approvalsBoard()),
});

// ---------- agent views ----------
define({
  method: 'GET', path: '/my-programs', summary: 'Programs of the signed-in agent with live achievement and potential earnings (readers may pass agentId)', screen: S('My Programs'), middleware: self,
  query: { agentId: 'usr_1' }, response: { success: true, data: { agentId: 'usr_1', agentName: 'Juan Dela Cruz', agentCode: 'AG001', branch: 'Head Office', assignedPrograms: [{ programId: 1, programName: 'Q3 Premium Achievers', target: 500000, achieved: 425000, achievementPercent: 85, potentialEarning: 8500, daysRemaining: 2 }], recentActivities: [] } },
  handler: async (req, res) => {
    const [data] = await svc.agentPrograms(agentFor(req));
    ok(res, data || { agentId: req.user.id, assignedPrograms: [], recentActivities: [], eligible: false });
  },
});
define({
  method: 'GET', path: '/agent-programs', summary: 'Every eligible agent with program progress', screen: `${S('My Programs')} (managers)`, middleware: read,
  response: { success: true, data: [{ agentId: 'usr_1', agentName: 'Juan Dela Cruz', assignedPrograms: [] }] },
  handler: async (_req, res) => ok(res, await svc.agentPrograms()),
});
define({
  method: 'GET', path: '/statement', summary: "Agent incentive statement for a period (own statement, or any agent's for incentive readers)", screen: S('Statement'), middleware: self,
  query: { agentId: 'usr_1', period: '2026-08' }, response: { success: true, data: { agentName: 'Juan Dela Cruz', period: 'August 2026', totalEarnings: 13500, ytdEarnings: 38500, pendingPayment: 13500, pendingPeriods: ['August 2026'], lastPaymentPeriods: ['July 2026'], contact: { companyName: 'BrokerVerse Insurance Brokerage', email: 'info@brokerverse.ph', phone: '+63 2 8888 0000' }, programBreakdown: [], monthlyTrend: [] } },
  handler: async (req, res) => {
    const agentId = agentFor(req);
    // A manager (finance, administrator) who is not an agent opens the screen without choosing an agent: answer with an
    // empty statement flagged eligible: false (the screen then offers GET /incentive/agents) instead of 404 (D101).
    if (!req.query.agentId && !(await svc.eligibleAgents(agentId)).length) {
      return ok(res, { ...(await svc.emptyStatement(req.query.period)), eligible: false, selectAgent: isReader(req.user) });
    }
    return ok(res, { ...(await svc.statement(agentId, req.query.period)), eligible: true });
  },
});
define({
  method: 'GET', path: '/agents', summary: 'Agents eligible for incentives (roles from configuration)', screen: `${S('Reports')}; ${S('Statement')}`, middleware: read,
  response: { success: true, data: [{ id: 'usr_1', name: 'Juan Dela Cruz', code: 'AG001', branch: 'Head Office' }] },
  handler: async (_req, res) => ok(res, (await svc.eligibleAgents()).map((a) => ({ id: a.id, name: a.display_name, code: a.code, branch: a.branch_name || a.branch_code }))),
});
define({
  method: 'GET', path: '/branches', summary: 'Branches for report filters', screen: S('Reports'), middleware: read, response: { success: true, data: [{ id: 1, code: 'HO', name: 'Head Office', region: 'Metro Manila' }] },
  handler: async (_req, res) => ok(res, (await many('SELECT id, code, name, attrs->>\'State\' AS region FROM branches WHERE status = \'active\' ORDER BY name'))),
});

// ---------- reports ----------
define({
  method: 'GET', path: '/reports/templates', summary: 'Report templates (incentive-report-template master)', screen: S('Reports'), middleware: read,
  response: { success: true, data: [{ id: 1, code: 'IRT-001', name: 'Monthly Payout Summary', category: 'Payout Reports', parameters: ['Period', 'Program', 'Branch'], formats: ['PDF', 'Excel'] }] },
  handler: async (_req, res) => ok(res, await svc.reportTemplates()),
});
define({
  method: 'GET', path: '/reports', summary: 'Generated incentive reports', screen: S('Reports'), middleware: read, response: { success: true, data: [{ reportId: 'rpt_1', reportType: 'Monthly Payout Summary', generatedDate: '2026-09-28T00:00:00Z' }] },
  handler: async (_req, res) => ok(res, await svc.reportHistory()),
});
define({
  method: 'POST', path: '/reports/generate', summary: 'Generate a report (CSV) from a template with parameters', screen: S('Reports > Generate'), middleware: read,
  request: { templateId: 1, parameters: { period: '2026-08', program: 'INC-2026-002' }, format: 'Excel' },
  response: { success: true, data: { reportId: 'rpt_1', reportType: 'Monthly Payout Summary', generatedDate: '2026-09-28T00:00:00Z', fileUrl: 'http://host/api/s3/object/incentive-reports/x.csv' } },
  handler: async (req, res) => created(res, await run(req, 'incentive_report', 'generate', () => svc.generateReport(req.body || {}, req.user)), 'Report generated'),
});

export default router;
export const mount = '/incentive';
