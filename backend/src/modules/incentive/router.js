import { isAdmin, requireAuth, requirePermission } from '../../lib/auth.js';
import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { forbidden } from '../../lib/errors.js';
import { created, ok } from '../../lib/respond.js';
import { many } from '../../db/pool.js';
import { canRead, canWrite } from '../masters/helpers.js';
import * as svc from './service.js';
import * as tsi from './telesales.js';

/** Incentive (Accounts > Incentive, 4 screens + reports) and Master > Incentive Programs. */
const { router, define } = moduleRouter('Incentive', '/incentive');
const read = canRead('incentive');
const write = canWrite('incentive');
// Approving or rejecting a batch (maker-checker: never its creator or submitter), apart from calculating it (migration 0387).
const approve = [requireAuth, requirePermission('approve:incentive')];
// Program set-up is master data (Master > Incentive Programs): the System Administrator, not the Accounting users who pay.
const programWrite = canWrite('masters');
// Producers (Sales & Marketing) see their own programs and statements with the profile permission; incentive readers may look up any agent.
const self = canRead('incentive', 'read:profile');
const S = (n) => `Accounts > Incentive > ${n}`;
const program = { id: 1, programCode: 'INC-2026-001', programName: 'Q3 Premium Achievers', programType: 'Target Based', applicableTo: ['Individual Agent'], startDate: '2026-07-01', endDate: '2026-09-30', targetMetric: 'Premium Volume', baseTarget: 500000, stretchTarget: 750000, Currency: 'PHP', calculationFrequency: 'Quarterly', status: 'Active', structure: [{ level: '80-90%', type: 'Percentage', value: 2, maxPayout: 20000 }] };
const batch = { batchId: 'CALC-2026-00001', period: 'August 2026', calculationDate: '2026-09-01', programsIncluded: ['INC-2026-002'], totalAmount: 61500, agentCount: 3, status: 'Pending Approval', details: [{ agentName: 'Juan Dela Cruz', program: 'New Business Champion', target: 20, achieved: 18, achievementPercent: 90, baseIncentive: 13500, adjustments: 0, finalAmount: 13500, status: 'Calculated' }] };
const run = async (req, entity, action, fn) => {
  const out = await fn();
  await audit(req, { entity, entityId: out?.after?.batchId ?? out?.after?.id ?? out?.batchId ?? out?.id ?? req.params.id, action, before: out?.before, after: out?.after ?? out });
  return out?.after ?? out;
};
const isReader = (u) => isAdmin(u) || (u.permissions || []).some((p) => ['read:incentive', 'write:incentive'].includes(p));
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
  method: 'POST', path: '/calculations', summary: 'Run a calculation for a month and programs: each program over its calculation period (month, quarter, half or year of its frequency) ending with that month, once per period; a run with no agent line is refused', screen: S('Calculations > New Calculation'), middleware: write,
  request: { period: '2026-09', selectedPrograms: ['INC-2026-002'], description: 'September run' }, response: { success: true, data: { ...batch, status: 'Calculated' } },
  handler: async (req, res) => created(res, await run(req, 'incentive_calculation', 'calculate', () => svc.runCalculation(req.body || {}, req.user)), 'Calculation complete'),
});
define({
  method: 'POST', path: '/calculations/:batchId/adjust',
  summary: 'Adjust agent lines before submission (amount per line) with a reason of the Reason Codes master (context incentive_adjustment; a note when the reason needs one). The adjusting user may not approve the batch',
  screen: S('Calculations > Details'), middleware: write,
  request: { lines: [{ id: 12, adjustments: -1000 }], reasonCode: 'IAD-CLAWBACK', note: 'Policy cancelled 12/09/2026' }, response: { success: true, data: batch },
  handler: async (req, res) => ok(res, await run(req, 'incentive_calculation', 'adjust', () => svc.adjustCalculation(req.params.batchId, req.body || {}, req.user)), 'Adjustments saved'),
});
define({
  method: 'POST', path: '/calculations/:batchId/submit', summary: 'Submit a batch for approval', screen: S('Calculations'), middleware: write, response: { success: true, data: { ...batch, status: 'Pending Approval' } },
  handler: async (req, res) => ok(res, await run(req, 'incentive_calculation', 'submit', () => svc.submitCalculation(req.params.batchId, req.user)), 'Submitted for approval'),
});
define({
  method: 'GET', path: '/calculations/:batchId/activity', summary: 'Activity log of a batch, oldest first: action, user display name and roles, date and time, status from / to, remarks', screen: S('Calculations > Details; Approvals > Details'),
  middleware: read,
  response: { success: true, data: [{ id: '901', at: '2026-09-01T02:15:00.000Z', date: '01/09/2026', time: '10:15', actionCode: 'reject', actionLabel: 'Rejected',
    user: { username: 'acct.head', displayName: 'Ana Reyes', roles: ['Accounting Manager'], role: 'Accounting Manager' }, fromStatus: 'Pending Approval', toStatus: 'Rejected',
    remarks: 'Rates or targets to be corrected: tier 2 rate', changes: [] }] },
  handler: async (req, res) => ok(res, await svc.calculationActivity(req.params.batchId, { viewer: req.user })),
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/calculations/:batchId/${action}`, screen: S('Approvals; Calculations > Details'), middleware: approve,
    summary: action === 'approve'
      ? 'Approve a batch with optional remarks (approve:incentive; maker-checker: not the creator, an adjuster or the submitter); posts the accrual at the end of the incentive period when it is open'
      : 'Reject a batch with a reason of the Reason Codes master (context incentive_batch_reject) and a note when the reason needs one (approve:incentive; maker-checker)',
    request: action === 'reject' ? { reasonCode: 'IBR-RATES', note: 'Tier 2 rate' } : { remarks: 'Checked against the production report' },
    response: { success: true, data: { ...batch, status: action === 'approve' ? 'Approved' : 'Rejected' } },
    handler: async (req, res) => ok(res, await run(req, 'incentive_calculation', action, () => svc.decideCalculation(req.params.batchId, action, req.body || {}, req.user)),
      action === 'approve' ? 'Batch approved' : 'Batch rejected'),
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
    // empty statement flagged eligible: false (the screen then offers GET /incentive/agents) instead of 404.
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

// ---------- Telesales program (FR-TSI-001 to 005), callers (FR-TSI-004), batch policies (FR-TSI-035, 036, 042) ----------
const M = 'Master > Finance > Incentive Programs';
const tsRead = [requireAuth, requirePermission('write:masters', 'read:incentive', 'approve:incentive')];
const tsProgram = { id: 7, programCode: 'TSI-2026-001', programName: 'Telesales Incentive Program', programType: 'Telesales', targetMetric: 'Average Net Commission (ANC)', calculationFrequency: 'Monthly',
  status: 'Active', current: { version: 1, effectiveFrom: '2026-04-01', minPolicies: 15, whtPct: 5, products: [2, 3], displayStatus: 'In force',
    tiers: [{ level: 1, ancFrom: 2500, ancTo: 3999.99, nbAmount: 300, renewalAmount: 150 }], bands: [{ band: 1, over: 30, upTo: 50, every: 5, amount: 2000 }] },
  open: null, versions: [], callers: [{ id: 3, userId: 'usr_5', name: 'Geralyn Ramos', insurer: 'Apex Assurance', teamLeader: 'Marco Villanueva', dateFrom: '2026-04-01', status: 'Active' }],
  versionLabel: 'v1 in force' };
const tsVersion = { programName: 'Telesales Incentive Program', products: [2, 3], minPolicies: 18, whtPct: 5, effectiveFrom: '2026-11-01', changeReason: 'Agreed with management on 30/09/2026',
  tiers: [{ ancFrom: 2500, nbAmount: 300, renewalAmount: 150 }, { ancFrom: 4000, nbAmount: 500, renewalAmount: 250 }], bands: [{ over: 30, every: 5, amount: 2000 }] };
const tsCaller = { id: 3, programId: 7, userId: 'usr_5', name: 'Geralyn Ramos', code: 'TS-014', insuranceCompanyId: 4, insurer: 'Apex Assurance', teamLeaderId: 'usr_9', teamLeader: 'Marco Villanueva',
  dateFrom: '2026-04-01', dateTo: null, status: 'Active' };
const tsRun = async (req, entity, entityId, action, fn) => {
  const out = await fn();
  await audit(req, { entity, entityId: entityId(out), action, before: out?.before, after: out?.after ?? out });
  return out?.after ?? out;
};
define({
  method: 'GET', path: '/telesales/defaults', summary: 'Defaults of a new Telesales program (settings incentive.telesales.*): minimum policies, withholding tax %, ANC tier and production-excess tables, Motor products, next month', screen: M,
  middleware: tsRead, response: { success: true, data: { minPolicies: 15, whtPct: 5, excessMethod: 'banded', effectiveFrom: '2026-11-01', products: [{ id: 2, code: 'MOTOR', name: 'Motor Vehicle Insurance' }] } },
  handler: async (_req, res) => ok(res, await tsi.telesalesDefaults()),
});
define({
  method: 'GET', path: '/telesales/options', summary: 'Users who may be callers (incentive.eligible_roles), Team Leaders (write:callout-endorsement) and insurance partners', screen: `${M} > Callers`,
  middleware: tsRead, response: { success: true, data: { callers: [{ id: 'usr_5', name: 'Geralyn Ramos', code: 'TS-014' }], teamLeaders: [{ id: 'usr_9', name: 'Marco Villanueva' }], insurers: [{ id: 4, name: 'Apex Assurance' }] } },
  handler: async (_req, res) => ok(res, await tsi.callerOptions()),
});
define({
  method: 'GET', path: '/telesales/programs/:id', summary: 'A Telesales program with the version in force, the open version (Draft or Pending approval), every version (History) and its callers', screen: `${M} > Edit`,
  middleware: tsRead, response: { success: true, data: tsProgram },
  handler: async (req, res) => ok(res, await tsi.getTelesalesProgram(req.params.id)),
});
define({
  method: 'POST', path: '/telesales/programs', summary: 'Create a Telesales program: version 1 in Draft (Motor products, minimum 1-999, withholding tax 0-100, effective from the first day of a month, tier and excess tables; MSG-TSI-001 to 019)',
  screen: `${M} > Add Program`, middleware: programWrite, request: { ...tsVersion, effectiveFrom: '2026-04-01', changeReason: undefined }, response: { success: true, data: tsProgram },
  handler: async (req, res) => created(res, await tsRun(req, 'incentive_program', (o) => o.id, 'create', () => tsi.createTelesalesProgram(req.body || {}, req.user)), 'Program saved'),
});
define({
  method: 'PUT', path: '/telesales/programs/:id', summary: 'Save draft: update the Draft version, or open the next version as a copy of the one in force with the changes (refused while a version is pending approval, MSG-TSI-026)',
  screen: `${M} > Edit`, middleware: programWrite, request: tsVersion, response: { success: true, data: tsProgram },
  handler: async (req, res) => {
    const out = await tsi.saveTelesalesDraft(req.params.id, req.body || {}, req.user);
    await audit(req, { entity: 'incentive_program', entityId: req.params.id, action: 'save-version', before: out.before, after: out.after });
    ok(res, { ...(await tsi.getTelesalesProgram(req.params.id)), warnings: out.warnings }, 'Program saved');
  },
});
define({
  method: 'POST', path: '/telesales/programs/:id/submit', summary: 'Submit the Draft version for approval on Configuration Approvals (change reason from version 2; decided with approve:incentive, never by its maker)',
  screen: `${M} > Edit`, middleware: programWrite, request: { changeReason: 'Agreed with management on 30/09/2026' }, response: { success: true, data: tsProgram },
  handler: async (req, res) => ok(res, await tsRun(req, 'incentive_program', (o) => o.id, 'submit-version', () => tsi.submitTelesalesVersion(req.params.id, req.body || {}, req.user)), 'Program version submitted for approval'),
});
define({
  method: 'POST', path: '/telesales/programs/:id/recall', summary: 'Recall the version pending approval (back to Draft)', screen: `${M} > Edit`, middleware: programWrite, response: { success: true, data: tsProgram },
  handler: async (req, res) => ok(res, await tsRun(req, 'incentive_program', (o) => o.id, 'recall-version', () => tsi.recallTelesalesVersion(req.params.id, req.user)), 'Program version recalled'),
});
define({
  method: 'POST', path: '/telesales/programs/:id/callers', summary: 'Add a caller: an active user of an incentive role, the insurance partner, a Team Leader with write:callout-endorsement, From / To (MSG-TSI-020 to 022)',
  screen: `${M} > Callers`, middleware: programWrite, request: { userId: 'usr_5', insuranceCompanyId: 4, teamLeaderId: 'usr_9', dateFrom: '2026-04-01' }, response: { success: true, data: tsCaller },
  handler: async (req, res) => created(res, await tsRun(req, 'incentive_caller', (o) => o.id, 'create', () => tsi.addCaller(req.params.id, req.body || {}, req.user)), 'Caller added'),
});
define({
  method: 'PUT', path: '/telesales/callers/:callerId', summary: 'Change a caller row: To date (end of participation) or Team Leader', screen: `${M} > Callers`, middleware: programWrite,
  request: { dateTo: '2026-12-31' }, response: { success: true, data: { ...tsCaller, dateTo: '2026-12-31' } },
  handler: async (req, res) => ok(res, await tsRun(req, 'incentive_caller', (o) => o.after.id, 'update', () => tsi.updateCaller(req.params.callerId, req.body || {}, req.user)), 'Caller saved'),
});
define({
  method: 'POST', path: '/telesales/callers/:callerId/disqualify', summary: 'Disqualify a caller from a date with a reason (context incentive_disqualify) and a remark (approve:incentive; MSG-TSI-023, 024)',
  screen: `${M} > Callers`, middleware: approve, request: { date: '2026-08-01', reasonCode: 'TDQ-GRAB', note: 'Took over accounts of another caller' },
  response: { success: true, data: { ...tsCaller, status: 'Disqualified', disqualifiedFrom: '2026-08-01' } },
  handler: async (req, res) => {
    const out = await tsi.disqualifyCaller(req.params.callerId, req.body || {}, req.user);
    await audit(req, { entity: 'incentive_caller', entityId: out.after.id, action: 'disqualify', before: out.before, after: out.after });
    ok(res, out.after, out.message);
  },
});
define({
  method: 'POST', path: '/telesales/callers/:callerId/reinstate', summary: 'Reinstate a disqualified caller with a remark (approve:incentive; never the user who disqualified the row)',
  screen: `${M} > Callers`, middleware: approve, request: { date: '2026-10-01', note: 'Cleared after review' }, response: { success: true, data: tsCaller },
  handler: async (req, res) => ok(res, await tsRun(req, 'incentive_caller', (o) => o.after.id, 'reinstate', () => tsi.reinstateCaller(req.params.callerId, req.body || {}, req.user)), 'Caller reinstated'),
});
define({
  method: 'GET', path: '/telesales/policies/:policyId', summary: 'The telesales link of a policy: caller, call-out endorsement, NB / renewal, payment, commission settlement, eligible date, batch',
  screen: 'Policy Servicing > Policy > Related Records', middleware: [requireAuth, requirePermission('read:policies', 'read:incentive')],
  response: { success: true, data: { telesales: true, policyNumber: 'POL-2026-004655', caller: 'Geralyn Ramos', kind: 'NB', endorsedOn: '2026-09-22', label: 'Telesales: Geralyn Ramos, call-out endorsed 22/09/2026' } },
  handler: async (req, res) => ok(res, await tsi.policyLink(req.params.policyId)),
});
define({
  method: 'POST', path: '/calculations/:batchId/recalculate', summary: 'Recalculate a Calculated or Rejected telesales batch: reads the policies again, keeps exclusions and adjustments', screen: S('Calculations > Details'), middleware: write,
  response: { success: true, data: { ...batch, status: 'Calculated' } },
  handler: async (req, res) => {
    const before = await svc.getCalculation(req.params.batchId);
    await tsi.recalculateTelesales(req.params.batchId, req.user);
    const after = await svc.getCalculation(req.params.batchId);
    await audit(req, { entity: 'incentive_calculation', entityId: req.params.batchId, action: 'recalculate', before, after });
    ok(res, after, 'Calculation complete');
  },
});
define({
  method: 'GET', path: '/calculations/:batchId/policies', summary: 'Policies tab of a telesales batch: every policy considered with NB / renewal, fully paid, commission settled, eligible date, net commission and status (filters callerId, status)',
  screen: S('Calculations > Details > Policies'), middleware: read, query: { callerId: 'usr_5', status: 'Counted' },
  response: { success: true, data: [{ policyNumber: 'POL-2026-004655', caller: 'Geralyn Ramos', kind: 'NB', fullyPaidOn: '2026-09-30', commissionSettledOn: '2026-10-05', eligibleOn: '2026-10-05', netCommission: 5318.79, status: 'Counted' }] },
  handler: async (req, res) => ok(res, await tsi.batchPolicies(req.params.batchId, req.query)),
});
for (const action of ['exclude', 'include']) {
  define({
    method: 'POST', path: `/calculations/:batchId/policies/:policyId/${action}`, screen: S('Calculations > Details > Policies'), middleware: write,
    summary: action === 'exclude' ? 'Exclude a counted policy with a reason (context incentive_exclude) and a remark while the batch is Calculated or Rejected; the caller is recalculated (MSG-TSI-036 to 038)'
      : 'Include an excluded policy again while the batch is Calculated or Rejected; the caller is recalculated',
    request: action === 'exclude' ? { reasonCode: 'TEX-GRAB', note: 'Prospect of another caller' } : {},
    response: { success: true, data: { policyNumber: 'POL-2026-004655', caller: 'Geralyn Ramos', message: 'Policy POL-2026-004655 excluded; Geralyn Ramos recalculated' } },
    handler: async (req, res) => {
      const out = action === 'exclude' ? await tsi.excludePolicy(req.params.batchId, req.params.policyId, req.body || {}, req.user) : await tsi.includePolicy(req.params.batchId, req.params.policyId, req.user);
      await audit(req, { entity: 'incentive_policy', entityId: out.policyId, action, after: { ...out, batchId: req.params.batchId } });
      ok(res, out, out.message);
    },
  });
}
define({
  method: 'GET', path: '/calculations/:batchId/export', summary: 'Export a batch to Excel: one sheet of caller lines (policies, NB, renewal, ANC, level, base, additional, recovery / adjustment, tax, total, remarks) and one of policies',
  screen: S('Calculations > Details > Export to Excel'), middleware: read, response: { success: true },
  handler: async (req, res) => {
    const out = await tsi.exportBatch(req.params.batchId);
    await audit(req, { entity: 'incentive_calculation', entityId: req.params.batchId, action: 'export', after: { fileName: out.fileName } });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.content);
  },
});

export default router;
export const mount = '/incentive';
