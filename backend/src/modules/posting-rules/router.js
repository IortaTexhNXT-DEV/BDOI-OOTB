import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import * as svc from './service.js';
import { accountingFlow } from './flow.js';

const { router, define } = moduleRouter('Posting Rules', '/posting-rules');
const ad = moduleRouter('Account Determination', '/account-determination');
// Finance reads the rules and the account map. Changes are proposed by configuration users or Accounting
// (write:posting-rules) and, with accounting.configuration_maker_checker, take effect when a different user with
// approve:posting-rules (Accounting Manager, System Administrator) approves them.
const read = [requireAuth, requirePermission('read:journal-vouchers', 'read:masters', 'read:settings')];
const write = [requireAuth, requirePermission('write:settings', 'write:masters', 'write:posting-rules')];
const approve = [requireAuth, requirePermission('approve:posting-rules')];
// Configuration Approvals (Master > Finance): a change waiting for approval goes to approve:posting-rules, the decision to the requester.
const APPROVALS = '/master/finance/configuration-approvals';
const changeLabel = (c) => `${c.kindLabel}: ${c.target}${c.kind === 'posting-rule-version' && c.payload?.version ? ` version ${c.payload.version}` : ''}`;
async function askApproval(r, user) {
  if (!r.change) return;
  await notifyApprovers({ audience: 'approve:posting-rules', document: 'Configuration change', number: String(r.change.id), by: user.username,
    message: `${user.username} requested ${changeLabel(r.change)}${r.change.changeNote ? ` (${r.change.changeNote})` : ''}`, link: APPROVALS, entity: 'accounting_config_change', entityId: r.change.id });
}
const pendingNote = (r, applied) => (r.change ? `${applied}; it takes effect once approved (request ${r.change.id})` : applied);
const S = 'Master > Finance > Posting Rules';
const A = 'Master > Finance > Account Determination';

const LINE = z.object({ side: z.string(), accountType: z.string(), account: z.string(), fallbackRole: z.string().nullable().optional(), amountKey: z.string(),
  perParticipant: z.boolean().optional(), narration: z.string().nullable().optional() }).passthrough();
const lineExample = { lineNo: 1, side: 'Dr', accountType: 'role', account: 'premium_receivable', fallbackRole: null, amountKey: 'gross', perParticipant: false, narration: 'Premium receivable {{billNumber}}' };
const ruleExample = { id: 1, eventCode: 'policy.issue.broker_billed', event: 'Policy issued – broker billed', version: 1, name: 'Policy issued – broker billed', module: 'policies', entryType: 'NEW_BUSINESS',
  source: 'booking', narration: 'Premium billed – {{policyNumber}} ({{billNumber}})', branchSource: 'policy_owner', effectiveFrom: '2000-01-01', active: true, lines: [lineExample] };
const simExample = { eventCode: 'receipt.apply', description: 'Premium collected – POL-SAMPLE (OR-SAMPLE)', balanced: true, totalDebit: 11200, totalCredit: 11200,
  lines: [{ lineNo: 1, accountCode: '1102001', accountName: 'Cash in Bank – Operating Account', debit: 11200, credit: 0, memo: 'Premium collection' },
    { lineNo: 2, accountCode: '1202001', accountName: 'Premiums Receivable – Direct Clients', debit: 0, credit: 11200, memo: 'Settles INV-SAMPLE' }] };

define({
  method: 'GET', path: '/events', summary: 'Business events with the rule version in force, the amounts each event supplies and its template variables', screen: S, middleware: read,
  response: { success: true, data: [{ eventCode: 'receipt.apply', label: 'Premium collection applied', module: 'receipts', amountKeys: ['amount'], activeRuleId: 7, activeVersion: 1, versions: 1 }] },
  handler: async (req, res) => ok(res, await svc.events(pool)),
});
define({
  method: 'GET', path: '/meta', summary: 'Pickers of the rule editor: sides, account types, account roles (with GL), resolvers, amount keys, branch sources', screen: S, middleware: read,
  response: { success: true, data: { sides: ['Dr', 'Cr'], accountTypes: ['role', 'gl', 'resolver', 'context'], roles: [{ role: 'premium_receivable', glCode: '1202001', glName: 'Premiums Receivable – Direct Clients' }], resolvers: [{ name: 'bank_account', label: 'Bank account of the receipt / payment' }], amountKeys: ['amount', 'gross'] } },
  handler: async (req, res) => ok(res, await svc.meta(pool)),
});
define({
  method: 'GET', path: '/flow', summary: 'Accounting flow: for every business event, the screen that triggers it, the approval before posting and the debit / credit lines of the rule in force (GL accounts resolved today)',
  screen: 'Master > Finance > Accounting Flow', middleware: read,
  response: { success: true, data: { asOf: '2026-09-30', events: [{ eventCode: 'receipt.apply', label: 'Premium collection applied', trigger: 'Accounts > Receipts', approval: 'Finance only',
    version: 1, debits: [{ side: 'Dr', amountKey: 'amount', account: { kind: 'resolver', label: 'Bank account of the receipt', glCode: null } }],
    credits: [{ side: 'Cr', amountKey: 'amount', account: { kind: 'role', label: 'Premiums receivable', glCode: '1202001', glName: 'Premiums Receivable' } }] }] } },
  handler: async (_req, res) => ok(res, await accountingFlow(pool)),
});
const changeExample = { id: 3, kind: 'account-role', kindLabel: 'Account role', target: 'premium_receivable', payload: { glCode: '1202002' }, before: { glCode: '1202001' }, status: 'pending',
  requestedBy: 'Accounting user', requestedAt: '2026-09-30T02:00:00Z' };
define({
  method: 'GET', path: '/changes', summary: 'Posting rule and account determination changes (status pending by default, approved, rejected, withdrawn or all)', screen: `${S} > Approvals`,
  middleware: read, query: { status: 'pending' }, response: { success: true, data: [changeExample] },
  handler: async (req, res) => ok(res, await svc.listChanges(pool, req.query)),
});
define({
  method: 'GET', path: '/changes/:changeId', summary: 'One configuration change with the rule version it concerns', screen: `${S} > Approvals`, middleware: read,
  response: { success: true, data: changeExample }, handler: async (req, res) => ok(res, await svc.getChange(pool, req.params.changeId)),
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/changes/:changeId/${action}`, summary: `${action === 'approve' ? 'Approve and apply' : 'Reject (reason required)'} a pending change; never the requester`,
    screen: `${S} > Approvals`, middleware: [...approve, validate(z.object({ remarks: z.string().max(1000).optional() }))], request: { remarks: action === 'approve' ? 'Checked' : 'Wrong account' },
    response: { success: true, data: { ...changeExample, status: action === 'approve' ? 'approved' : 'rejected' } },
    handler: async (req, res) => {
      const r = await withTransaction((db) => svc.decideChange(db, req.params.changeId, action, req.body?.remarks, req.user));
      await audit(req, { entity: 'accounting_config_change', entityId: r.id, action, after: r });
      await notifyDecision({ userId: r.requestedById, decidedBy: req.user.id, document: 'Configuration change', number: String(r.id), approved: action === 'approve', by: req.user.username,
        reason: action === 'reject' ? r.decisionRemarks : null, message: action === 'approve' ? `${changeLabel(r)} approved by ${req.user.username} and in effect` : null,
        link: APPROVALS, entity: 'accounting_config_change', entityId: r.id });
      ok(res, r, `Change ${r.id} ${r.status}`);
    },
  });
}
define({
  method: 'POST', path: '/changes/:changeId/withdraw', summary: 'Withdraw a pending change (the requester or an approver)', screen: `${S} > Approvals`, middleware: write,
  response: { success: true, data: { ...changeExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.withdrawChange(db, req.params.changeId, req.user));
    await audit(req, { entity: 'accounting_config_change', entityId: r.id, action: 'withdraw', after: r });
    ok(res, r, `Change ${r.id} withdrawn`);
  },
});
define({
  method: 'GET', path: '/', summary: 'Posting rules with their lines, every version (filter eventCode, module)', screen: S, middleware: read, query: { eventCode: 'receipt.apply' },
  response: { success: true, data: [ruleExample] },
  handler: async (req, res) => ok(res, await svc.listRules(pool, req.query)),
});
define({
  method: 'POST', path: '/simulate', summary: 'Journal a rule builds for a sample (or given) context – the saved version (ruleId), unsaved lines or the version in force; nothing is posted',
  screen: S, middleware: [...read, validate(z.object({ eventCode: z.string(), ruleId: z.union([z.number(), z.string()]).optional(), lines: z.array(LINE).optional(), context: z.object({}).passthrough().optional(), coInsurance: z.boolean().optional() }).passthrough())],
  request: { eventCode: 'receipt.apply', coInsurance: false }, response: { success: true, data: simExample },
  handler: async (req, res) => ok(res, await svc.simulateRule(pool, req.body)),
});
define({
  method: 'GET', path: '/:id', summary: 'One posting rule version with its lines', screen: S, middleware: read, response: { success: true, data: ruleExample },
  handler: async (req, res) => ok(res, await svc.getRule(pool, req.params.id)),
});
define({
  method: 'POST', path: '/events/:eventCode/versions', summary: 'Save a new version of an event\'s rule (effective from a date); lines are validated and the sample journal must balance',
  screen: S, middleware: [...write, validate(z.object({ lines: z.array(LINE).min(2), name: z.string().optional(), description: z.string().nullable().optional(), entryType: z.string().nullable().optional(),
    source: z.string().nullable().optional(), narration: z.string().nullable().optional(), branchSource: z.string().optional(), effectiveFrom: z.string().optional(), changeNote: z.string().optional() }).passthrough())],
  request: { effectiveFrom: '2026-10-01', changeNote: 'Premium taxes on their own lines', lines: [lineExample] }, response: { success: true, data: { ...ruleExample, version: 2 } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.createVersion(db, req.params.eventCode, req.body, req.user));
    await audit(req, { entity: 'posting_rule', entityId: r.after.id, action: 'create-version', before: r.before, after: r.after });
    await askApproval(r, req.user);
    created(res, { ...r.after, change: r.change }, pendingNote(r, `Version ${r.after.version} of ${r.after.eventCode} saved`));
  },
});
define({
  method: 'PUT', path: '/:id/status', summary: 'Activate or deactivate a rule version (an event keeps at least one version in force)', screen: S,
  middleware: [...write, validate(z.object({ active: z.boolean() }))], request: { active: false }, response: { success: true, data: { ...ruleExample, active: false } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.setActive(db, req.params.id, req.body.active, req.user));
    await audit(req, { entity: 'posting_rule', entityId: r.after.id, action: req.body.active ? 'activate' : 'deactivate', before: r.before, after: r.after });
    await askApproval(r, req.user);
    ok(res, { ...r.after, change: r.change }, pendingNote(r, `Version ${r.after.version} ${req.body.active ? 'activated' : 'deactivated'}`));
  },
});
define({
  method: 'GET', path: '/:id/history', summary: 'Audit trail of a posting rule (versions saved, activated, deactivated)', screen: S, middleware: read,
  response: { success: true, data: [{ action: 'create-version', username: 'BrokerVerse', at: '2026-09-29T08:00:00Z', version: 2 }] },
  handler: async (req, res) => {
    const r = await svc.getRule(pool, req.params.id);
    const rows = (await pool.query(`SELECT a.action, a.username, a.at, a.after_data->>'version' AS version, a.after_data->>'changeNote' AS change_note, a.entity_id FROM audit_log a
      WHERE a.entity = 'posting_rule' AND a.entity_id IN (SELECT id::text FROM posting_rules WHERE event_code = $1) ORDER BY a.at DESC LIMIT 200`, [r.eventCode])).rows;
    ok(res, rows.map((x) => ({ action: x.action, username: x.username, at: x.at, version: x.version ? Number(x.version) : null, changeNote: x.change_note, ruleId: Number(x.entity_id) })));
  },
});

// ---------- account determination ----------
ad.define({
  method: 'GET', path: '/', summary: 'Account roles the posting rules use (by section), payable account per payee type, cash account per payment mode, write-off reasons', screen: A, middleware: read,
  response: { success: true, data: { sections: [{ section: 'premium', roles: [{ role: 'premium_receivable', label: 'Premiums receivable', glCode: '1202001', glName: 'Premiums Receivable – Direct Clients', usedBy: ['policy.issue.broker_billed'] }] }],
    payableByPayee: { Insurer: '2201001' }, cashByPaymentMode: { cash: '1101001' }, writeOffReasons: [{ code: 'BAD_DEBT', name: 'Uncollectible premium', glAccount: '4401009' }] } },
  handler: async (req, res) => ok(res, await svc.accountDetermination(pool)),
});
ad.define({
  method: 'PUT', path: '/roles/:role', summary: 'Set the GL account of an account role (accounting.account.<role>) used by the posting rules', screen: A,
  middleware: [...write, validate(z.object({ glCode: z.string().min(1) }))], request: { glCode: '1202002' }, response: { success: true, data: { role: 'premium_receivable', glCode: '1202002', glName: 'Premiums Receivable – Corporate Clients' } },
  handler: async (req, res) => {
    const r = await svc.setRoleAccount(pool, req.params.role, req.body.glCode, req.user);
    await audit(req, { entity: 'account_role', entityId: req.params.role, action: 'update', before: r.before, after: r.after });
    await askApproval(r, req.user);
    ok(res, { ...r.after, change: r.change }, r.change ? pendingNote(r, `${req.params.role} to post to ${r.change.payload.glCode}`) : `${req.params.role} now posts to ${r.after.glCode}`);
  },
});
ad.define({
  method: 'PUT', path: '/maps/:name', summary: 'Replace the payable account per payee type (payable-by-payee) or the cash account per payment mode (cash-by-payment-mode)', screen: A,
  middleware: [...write, validate(z.object({ map: z.record(z.string()) }))], request: { map: { cash: '1101001', check: '1102001' } }, response: { success: true, data: { cash: '1101001', check: '1102001' } },
  handler: async (req, res) => {
    const r = await svc.setMap(pool, req.params.name, req.body.map, req.user);
    await audit(req, { entity: 'account_map', entityId: req.params.name, action: 'update', before: r.before, after: r.after });
    await askApproval(r, req.user);
    ok(res, r.change ? { ...r.after, change: r.change } : r.after, pendingNote(r, 'Account map saved'));
  },
});
const taxExample = { vat: { enabled: true, code: 'VAT12-OUT', ratePercent: 12, glAccount: '2204003', fallbackRole: 'output_vat' },
  ewt: { enabled: true, code: 'WC139', ratePercent: 10, atc: 'WC139', glAccount: '1302001', fallbackRole: 'creditable_wht' } };
ad.define({
  method: 'GET', path: '/commission-taxes', summary: 'Output VAT and EWT on broker-billed commission: switches, tax codes (rate, ATC, GL account) and the tax codes to choose from', screen: A, middleware: read,
  response: { success: true, data: { ...taxExample, taxCodes: [{ code: 'WC139', taxType: 'EWT', rate: 10, atc: 'WC139', glAccount: '1302001', active: true }] } },
  handler: async (req, res) => ok(res, await svc.commissionTaxes(pool)),
});
ad.define({
  method: 'PUT', path: '/commission-taxes', summary: 'Change the commission tax set-up (switch VAT / EWT on or off, choose their tax codes)', screen: A,
  middleware: [...write, validate(z.object({ vatEnabled: z.boolean().optional(), ewtEnabled: z.boolean().optional(), vatCode: z.string().optional(), ewtCode: z.string().optional() }))],
  request: { ewtCode: 'WC140' }, response: { success: true, data: taxExample },
  handler: async (req, res) => {
    const r = await svc.setCommissionTaxes(pool, req.body, req.user);
    await audit(req, { entity: 'account_map', entityId: 'commission-taxes', action: 'update', before: r.before, after: r.after });
    await askApproval(r, req.user);
    ok(res, { ...r.after, change: r.change }, pendingNote(r, 'Commission tax set-up saved'));
  },
});
ad.define({
  method: 'GET', path: '/write-off-reasons', summary: 'Write-off reasons with their GL account (all statuses)', screen: A, middleware: read,
  response: { success: true, data: [{ id: 1, code: 'BAD_DEBT', name: 'Uncollectible premium (bad debt)', glAccount: '4401009', maxAmount: null, status: 'active' }] },
  handler: async (req, res) => ok(res, await svc.listWriteOffReasons(pool, { all: true })),
});
ad.define({
  method: 'POST', path: '/write-off-reasons', summary: 'Add a write-off reason', screen: A,
  middleware: [...write, validate(z.object({ code: z.string(), name: z.string(), glAccount: z.string(), maxAmount: z.union([z.number(), z.string()]).nullable().optional(), description: z.string().nullable().optional(), status: z.string().optional() }))],
  request: { code: 'WAIVED_FEE', name: 'Fee waived', glAccount: '4409001', maxAmount: 500 }, response: { success: true, data: { code: 'WAIVED_FEE', name: 'Fee waived', glAccount: '4409001', maxAmount: 500, status: 'active' } },
  handler: async (req, res) => {
    const r = await svc.saveWriteOffReason(pool, null, req.body, req.user);
    await audit(req, { entity: 'write_off_reason', entityId: r.after.code, action: 'create', after: r.after });
    created(res, r.after, `Write-off reason ${r.after.code} added`);
  },
});
ad.define({
  method: 'PUT', path: '/write-off-reasons/:code', summary: 'Update a write-off reason (name, GL account, limit, status)', screen: A,
  middleware: [...write, validate(z.object({ name: z.string().optional(), glAccount: z.string().optional(), maxAmount: z.union([z.number(), z.string()]).nullable().optional(), description: z.string().nullable().optional(), status: z.string().optional() }))],
  request: { glAccount: '4401009', status: 'active' }, response: { success: true, data: { code: 'BAD_DEBT', glAccount: '4401009', status: 'active' } },
  handler: async (req, res) => {
    const r = await svc.saveWriteOffReason(pool, req.params.code, req.body, req.user);
    await audit(req, { entity: 'write_off_reason', entityId: r.after.code, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, `Write-off reason ${r.after.code} saved`);
  },
});

export default router;
export const mount = '/posting-rules';
export const extraMounts = [['/account-determination', ad.router]];
