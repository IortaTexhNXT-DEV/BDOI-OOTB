/**
 * Access control (Master > User Management): user access matrix, role permissions (with changes of a role's access
 * through approval, roleAccess.js and changes.js), authority matrix with maker-checker approval of limits, delegation of
 * authority, segregation-of-duties rules, access reviews, and ending a user's sessions. Rules and their use by the
 * approval steps: service.js.
 * Permissions: read:access-control (System Administrator, Accounting Manager read), write:access-control and
 * approve:access-control (System Administrator; the approver of a limit or of a change of access is not the one who
 * proposed it); a change of a role's access is requested with write:roles.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { sendTable } from '../documents/tabular.js';
import { toCsv } from '../../lib/csv.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { printContext } from '../documents/pdf.js';
import { excelBrand } from '../reports/service.js';
import { formatMoney } from '../../lib/money.js';
import { today } from '../../lib/dates.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import * as svc from './service.js';
import * as roleAccess from './roleAccess.js';
import * as changes from './changes.js';

const { router, define } = moduleRouter('Access Control', '/access-control');
const read = [requireAuth, requirePermission('read:access-control')];
const write = [requireAuth, requirePermission('write:access-control')];
const approve = [requireAuth, requirePermission('approve:access-control')];
const roleWrite = [requireAuth, requirePermission('write:roles')];
const S = 'Master > User Management';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const format = (q) => (String(q.format || '').toLowerCase() === 'csv' ? 'csv' : 'xlsx');

// Approval notifications: a proposed limit goes to approve:access-control (the decision route), the decision to the proposer.
const AUTHORITY = '/master/generals/usermanagement/authority-matrix';
const limitNumber = (l) => `#${l.id}`;
const limitText = async (l) => `${l.transactionName || l.transactionType} for ${l.roleName || l.roleCode || l.userName || l.username}: `
  + `${l.unlimited ? 'no limit' : l.measure === 'percent' ? `${l.maxAmount}%` : await formatMoney(l.maxAmount)}`;

// ---------- matrices ----------
define({
  method: 'GET', path: '/user-matrix', summary: 'Every user with roles, branch, status, last sign-in, two-factor, password age and segregation-of-duties conflicts (?format=xlsx|csv to download)',
  screen: `${S} > User Access Matrix`, middleware: read, query: { status: 'active', format: 'xlsx' },
  response: { success: true, data: { roles: [{ code: 'sales', name: 'Sales & Marketing' }], dormantDays: 90, rows: [{ username: 'maria.rivera', roles: ['sales'], status: 'active', dormant: false, sodConflicts: [] }] } },
  handler: async (req, res) => {
    const m = await svc.userMatrix(pool, { status: req.query.status || null });
    if (req.query.format) return sendTable(res, { header: svc.USER_MATRIX_HEADER, rows: svc.userMatrixRows(m), fileBase: 'user-access-matrix', format: format(req.query), sheetName: 'Users' });
    return ok(res, m);
  },
});
define({
  method: 'GET', path: '/role-matrix', summary: 'Permissions down, roles across: what each role may do (inherited roles listed per role)', screen: `${S} > Role Permissions`, middleware: read,
  response: { success: true, data: { roles: [{ code: 'accounting', name: 'Accounting', inherits: [] }], rows: [{ code: 'read:policies', module: 'policies', grants: { accounting: true } }] } },
  handler: async (_req, res) => ok(res, await svc.roleMatrix(pool)),
});

// ---------- role permissions and changes of access ----------
const codes = z.array(z.string().max(80)).max(300).default([]);
const roleAccessExample = { approval: true, catalogue: { areas: [{ code: 'accounts', name: 'Accounts', order: 3 }], modules: [{ code: 'receipts', area: 'accounts', name: 'Receipts',
  screens: ['Receipts', 'Post-Dated Cheques'], levels: ['view', 'edit'] }], permissions: [{ code: 'read:receipts', area: 'accounts', module: 'receipts', level: 'view',
  meaning: 'See receipts and post-dated cheques', checked: true, baseline: false }] }, departments: [{ name: 'Cash Control', order: 3 }],
roles: [{ code: 'tis-ccd-bp', name: 'CCD-BP / QRPh (Receipting)', department: 'Cash Control', platform: false, fullAccess: false, status: 'active', inherits: [], includedBy: [],
  users: { active: 2, inactive: 0 }, own: ['read:receipts', 'write:receipts'], included: {}, pending: null, editBlocked: null }], pendingCount: 0, abilities: { edit: true, approve: true } };
const changeExample = { id: 12, ref: 'CFG-12', kind: 'role-access', kindLabel: 'Role access', target: 'tis-finance', targetLabel: 'TIS Finance & General Accounting',
  summary: ['Added: Accounts › Bank reconciliation › Approve'], status: 'pending', requestedBy: 'IT administrator', requestedAt: '2026-10-09T02:15:00Z', canDecide: true, canWithdraw: true,
  link: '/master/generals/usermanagement/role-permissions?view=pending&change=12' };
define({
  method: 'GET', path: '/role-access', summary: 'Role permissions in business words: the access catalogue (areas, modules, levels), the departments, and each role with its own and included access, users and change waiting for approval',
  screen: `${S} > Role Permissions`, middleware: read, response: { success: true, data: roleAccessExample },
  handler: async (req, res) => ok(res, await roleAccess.overview(pool, req.user)),
});
define({
  method: 'POST', path: '/role-access/check', summary: 'What a change of a role\'s access would do (dry run): the change without no-ops, segregation-of-duties warnings for the role and its users, who is affected',
  screen: `${S} > Role Permissions`, middleware: [...roleWrite, validate(z.object({ role: z.string(), grant: codes, revoke: codes }))],
  request: { role: 'tis-finance', grant: ['approve:bank-reconciliation'], revoke: [] },
  response: { success: true, data: { grant: ['approve:bank-reconciliation'], revoke: [], added: ['Accounts › Bank reconciliation › Approve'], removed: [], warnings: [], blocked: false,
    affected: { users: 6, throughUsers: 0, throughRoles: [] } } },
  handler: async (req, res) => ok(res, await roleAccess.checkChange(pool, req.body.role, req.body)),
});
define({
  method: 'POST', path: '/role-access/:role/changes', summary: 'Change the access of a role (reason required); it applies once another administrator approves it (or at once with access.change_approval off)',
  screen: `${S} > Role Permissions`, middleware: [...roleWrite, validate(z.object({ grant: codes, revoke: codes, reasonCode: z.string().max(40).optional(), note: z.string().max(1000).optional() }))],
  request: { grant: ['approve:bank-reconciliation'], revoke: ['write:fixed-assets'], reasonCode: 'ACC-REDESIGN', note: 'Bank reconciliation approval moves to Finance' },
  response: { success: true, data: { change: changeExample, applied: null } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => roleAccess.proposeRoleAccess(db, req.params.role, req.body, req.user));
    if (r.change) {
      await audit(req, { entity: 'accounting_config_change', entityId: r.change.id, action: 'request', after: r.change });
      await changes.askAccessApproval(r.change, req.user);
      return created(res, { change: r.change, applied: null, warnings: r.check.warnings }, `Change ${r.change.ref} sent for approval; it applies once another administrator approves it`);
    }
    await audit(req, r.applied.audit);
    return ok(res, { change: null, applied: r.applied, warnings: r.check.warnings }, `Access of ${r.applied.roleName} changed`);
  },
});
define({
  method: 'GET', path: '/role-access/export', summary: 'Role permissions for audit (?roles=a,b&base=1&format=xlsx|csv): access by role x module x level, the matrix, the changes waiting for approval and the permission codes',
  screen: `${S} > Role Permissions`, middleware: read, query: { roles: 'tis-sales-associate,tis-sales-officer', base: 0, format: 'xlsx' },
  handler: async (req, res) => {
    const ctx = await printContext();
    const roles = String(req.query.roles || '').split(',').map((x) => x.trim()).filter(Boolean);
    const sheets = await roleAccess.exportSheets(pool, { roles, base: ['1', 'true'].includes(String(req.query.base)) }, req.user, ctx.format);
    const base = `role-permissions-${(await today()).replace(/-/g, '')}`;
    if (format(req.query) === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
      return res.send(toCsv(sheets[0].columns, sheets[0].rows));
    }
    const banner = [ctx.letterhead?.name, 'Role permissions', `As at ${ctx.generatedAt} · exported by ${ctx.generatedBy}`].filter(Boolean);
    const buf = writeXlsx({ title: 'Role permissions', brand: excelBrand(ctx), sheets: sheets.map((sh, i) => (i === 0 ? { ...sh, banner, logo: true } : sh)) });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    return res.send(buf);
  },
});
define({
  method: 'GET', path: '/changes', summary: 'Changes of access (role access) with their summary in business words and what the signed-in user may do (?status=pending|approved|rejected|withdrawn|all&kind&target)',
  screen: `${S} > Role Permissions`, middleware: read, query: { status: 'pending', kind: 'role-access' }, response: { success: true, data: [changeExample] },
  handler: async (req, res) => ok(res, await changes.listAccessChanges(pool, { kind: req.query.kind || null, status: req.query.status || 'pending', target: req.query.target || null }, req.user)),
});
define({
  method: 'GET', path: '/changes/:id', summary: 'One change of access', screen: `${S} > Role Permissions`, middleware: read, response: { success: true, data: changeExample },
  handler: async (req, res) => ok(res, await changes.getAccessChange(pool, req.params.id, req.user)),
});
define({
  method: 'POST', path: '/changes/:id/decision', summary: 'Approve (applies it) or reject (remarks required) a change of access; never by the requester',
  screen: `${S} > Role Permissions`, middleware: [...approve, validate(z.object({ decision: z.enum(['approve', 'reject']), remarks: z.string().max(1000).optional() }))],
  request: { decision: 'approve' }, response: { success: true, data: { ...changeExample, status: 'approved' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => changes.decideAccessChange(db, req.params.id, req.body, req.user));
    const c = r.change;
    const approved = req.body.decision === 'approve';
    await audit(req, { entity: 'accounting_config_change', entityId: c.id, action: req.body.decision, after: c });
    if (r.result?.audit) await audit(req, r.result.audit);
    await notifyDecision({ userId: c.requestedById, decidedBy: req.user.id, document: `${c.kindLabel} change`, number: c.ref, approved, by: req.user.username,
      reason: approved ? null : c.decisionRemarks, message: approved ? `The access of ${c.targetLabel} is changed, approved by ${req.user.username}` : null,
      link: c.link, entity: 'accounting_config_change', entityId: c.id });
    ok(res, c, approved ? `Change ${c.ref} approved; the access of ${c.targetLabel} is changed` : `Change ${c.ref} rejected`);
  },
});
define({
  method: 'POST', path: '/changes/:id/withdraw', summary: 'Withdraw a change of access waiting for approval (the requester or an approver)', screen: `${S} > Role Permissions`,
  middleware: [requireAuth, requirePermission('write:roles', 'write:access-control', 'approve:access-control')], response: { success: true, data: { ...changeExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const c = await withTransaction((db) => changes.withdrawAccessChange(db, req.params.id, req.user));
    await audit(req, { entity: 'accounting_config_change', entityId: c.id, action: 'withdraw', after: c });
    ok(res, c, `Change ${c.ref} withdrawn`);
  },
});

// ---------- authority matrix ----------
define({
  method: 'GET', path: '/transaction-types', summary: 'Transaction types of the authority matrix', screen: `${S} > Authority Matrix`, middleware: read,
  response: { success: true, data: [{ code: 'payment_voucher', name: 'Payment voucher and cheque release', measure: 'amount', active: true }] },
  handler: async (_req, res) => ok(res, await svc.transactionTypes(pool)),
});
define({
  method: 'PUT', path: '/transaction-types/:code', summary: 'Rename, describe or switch off a transaction type', screen: `${S} > Authority Matrix`,
  middleware: [...write, validate(z.object({ name: z.string().min(2).max(120).optional(), description: z.string().max(500).optional(), active: z.boolean().optional() }))],
  request: { name: 'Cheque release' }, response: { success: true, data: { code: 'payment_voucher', name: 'Cheque release' } },
  handler: async (req, res) => {
    const r = await svc.updateTransactionType(pool, req.params.code, req.body);
    await audit(req, { entity: 'authority_transaction_type', entityId: r.code, action: 'update', after: r });
    ok(res, r, 'Transaction type updated');
  },
});
define({
  method: 'GET', path: '/authority-matrix', summary: 'Approval limits: transaction types down, roles across, with changes waiting for approval and the user-specific limits',
  screen: `${S} > Authority Matrix`, middleware: read,
  response: { success: true, data: { roles: [], rows: [{ code: 'journal_voucher', cells: { accounting: { maxAmount: 500000, set: true, pending: null } } }], userLimits: [], withoutLimit: 'allow' } },
  handler: async (_req, res) => ok(res, await svc.authorityMatrix(pool)),
});
define({
  method: 'GET', path: '/authority-limits', summary: 'Authority limits with their history (filter by status / transaction type)', screen: `${S} > Authority Matrix`, middleware: read,
  query: { status: 'pending', transactionType: 'payment_voucher' }, response: { success: true, data: [] },
  handler: async (req, res) => ok(res, await svc.listLimits(pool, { status: req.query.status || null, transactionType: req.query.transactionType || null })),
});
define({
  method: 'POST', path: '/authority-limits', summary: 'Propose a limit for a role or a user; it applies once another administrator approves it', screen: `${S} > Authority Matrix`,
  middleware: [...write, validate(z.object({ transactionType: z.string(), roleCode: z.string().optional(), userId: z.string().optional(), maxAmount: z.number().min(0).nullable().optional(),
    unlimited: z.boolean().optional(), effectiveFrom: date.optional(), remarks: z.string().max(500).optional() }))],
  request: { transactionType: 'payment_voucher', roleCode: 'accounting', maxAmount: 1000000, remarks: 'Per the board resolution on signing authority' },
  response: { success: true, data: { id: 1, status: 'pending' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.proposeLimit(db, req.body, req.user));
    await audit(req, { entity: 'authority_limit', entityId: String(r.id), action: 'propose', after: r });
    await notifyApprovers({ audience: 'approve:access-control', document: 'Authority limit', number: limitNumber(r), by: req.user.username,
      message: `${req.user.username} proposed ${await limitText(r)}${r.remarks ? ` (${r.remarks})` : ''}`, link: AUTHORITY, entity: 'authority_limit', entityId: r.id });
    created(res, r, 'Limit proposed; it applies once another administrator approves it');
  },
});
define({
  method: 'POST', path: '/authority-limits/:id/decision', summary: 'Approve or reject a proposed limit (not by the person who proposed it)', screen: `${S} > Authority Matrix`,
  middleware: [...approve, validate(z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() }))],
  request: { decision: 'approve' }, response: { success: true, data: { id: 1, status: 'active' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.decideLimit(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'authority_limit', entityId: req.params.id, action: req.body.decision, after: r });
    const approved = req.body.decision === 'approve';
    await notifyDecision({ userId: r.requestedById, decidedBy: req.user.id, document: 'Authority limit', number: limitNumber(r), approved, by: req.user.username,
      reason: approved ? null : req.body.note || null, message: approved ? `${await limitText(r)}, approved by ${req.user.username} and in effect` : null,
      link: AUTHORITY, entity: 'authority_limit', entityId: r.id });
    ok(res, r, req.body.decision === 'approve' ? 'Limit approved and in effect' : 'Limit rejected');
  },
});
define({
  method: 'DELETE', path: '/authority-limits/:id', summary: 'Withdraw an active limit', screen: `${S} > Authority Matrix`, middleware: approve,
  response: { success: true, data: { id: 1, status: 'retired' } },
  handler: async (req, res) => {
    const r = await svc.retireLimit(pool, req.params.id, req.user);
    await audit(req, { entity: 'authority_limit', entityId: req.params.id, action: 'withdraw', after: r });
    ok(res, r, 'Limit withdrawn');
  },
});
define({
  method: 'GET', path: '/authority-check', summary: 'The approval authority of a user (default: the signed-in user) for a transaction type, and whether an amount is within it',
  screen: `${S} > Authority Matrix`, middleware: [requireAuth], query: { type: 'payment_voucher', amount: 250000, userId: 'usr_1' },
  response: { success: true, data: { found: true, limit: 1000000, unlimited: false, source: 'role accounting', withinLimit: true } },
  handler: async (req, res) => {
    const userId = req.query.userId && req.user.permissions?.includes('read:access-control') ? req.query.userId : req.user.id;
    const a = await svc.effectiveAuthority(pool, userId, String(req.query.type || ''));
    const amount = req.query.amount === undefined ? null : Number(req.query.amount);
    ok(res, { ...a, withinLimit: amount === null ? null : (!a.found || a.unlimited || amount <= a.limit) });
  },
});

// ---------- delegations ----------
define({
  method: 'GET', path: '/delegations', summary: 'Delegations of authority (?active=true for current and future ones)', screen: `${S} > Delegations`, middleware: read,
  response: { success: true, data: [{ id: 1, delegatorName: 'Teresa Villaroman', delegateName: 'Ramon Almario', dateFrom: '2026-10-01', dateTo: '2026-10-10', inEffect: false }] },
  handler: async (req, res) => ok(res, await svc.listDelegations(pool, { activeOnly: String(req.query.active) === 'true' })),
});
define({
  method: 'POST', path: '/delegations', summary: 'Delegate approval authority for a period (leave, travel); empty transaction types = all', screen: `${S} > Delegations`,
  middleware: [...write, validate(z.object({ delegatorId: z.string(), delegateId: z.string(), transactionTypes: z.array(z.string()).optional(), dateFrom: date, dateTo: date, reason: z.string().max(500).optional() }))],
  request: { delegatorId: 'usr_1', delegateId: 'usr_2', transactionTypes: ['payment_voucher'], dateFrom: '2026-10-01', dateTo: '2026-10-10', reason: 'Annual leave' },
  response: { success: true, data: { id: 1, status: 'active' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.createDelegation(db, req.body, req.user));
    await audit(req, { entity: 'user_delegation', entityId: String(r.id), action: 'create', after: r });
    created(res, r, 'Delegation recorded');
  },
});
define({
  method: 'POST', path: '/delegations/:id/revoke', summary: 'End a delegation early', screen: `${S} > Delegations`, middleware: write, response: { success: true, data: { id: 1, status: 'revoked' } },
  handler: async (req, res) => {
    const r = await svc.revokeDelegation(pool, req.params.id, req.user);
    await audit(req, { entity: 'user_delegation', entityId: req.params.id, action: 'revoke', after: r });
    ok(res, r, 'Delegation revoked');
  },
});

// ---------- segregation of duties ----------
const SOD = z.object({ code: z.string().min(2).max(40).optional(), name: z.string().min(2).max(120), kind: z.enum(['roles', 'access']).optional(),
  roleA: z.string().nullable().optional(), roleB: z.string().nullable().optional(), accessA: z.array(z.string()).max(100).optional(), accessB: z.array(z.string()).max(100).optional(),
  action: z.enum(['block', 'warn']), reason: z.string().max(500).optional(), active: z.boolean().optional() });
define({
  method: 'GET', path: '/sod-rules', summary: 'Segregation-of-duties rules: pairs of roles one person may not hold together, and access a role or a person should not combine',
  screen: `${S} > Segregation of Duties`, middleware: read,
  response: { success: true, data: [{ id: 1, code: 'SOD-PROC-ACCT', kind: 'roles', roleA: 'processing', roleB: 'accounting', accessA: [], accessB: [], action: 'block' },
    { id: 7, code: 'SOD-ACC-CLAIM-PAY', kind: 'access', roleA: null, roleB: null, accessA: ['write:claims'], accessB: ['write:disbursements'],
      accessANames: ['Operations › Claims › Create and edit'], accessBNames: ['Accounts › Disbursements and petty cash › Create and edit'], action: 'warn' }] },
  handler: async (_req, res) => ok(res, await svc.listSodRules(pool)),
});
define({
  method: 'POST', path: '/sod-rules', summary: 'Add a segregation-of-duties rule', screen: `${S} > Segregation of Duties`, middleware: [...write, validate(SOD.required({ code: true }))],
  request: { code: 'SOD-OPS-ACCT', name: 'Servicing and payment', roleA: 'operations', roleB: 'accounting', action: 'warn' }, response: { success: true, data: { id: 6 } },
  handler: async (req, res) => {
    const r = await svc.saveSodRule(pool, req.body);
    await audit(req, { entity: 'sod_rule', entityId: String(r.id), action: 'create', after: r });
    created(res, r, 'Rule added');
  },
});
define({
  method: 'PUT', path: '/sod-rules/:id', summary: 'Change a segregation-of-duties rule', screen: `${S} > Segregation of Duties`, middleware: [...write, validate(SOD)],
  request: { name: 'Sales and collection', roleA: 'sales', roleB: 'accounting', action: 'block' }, response: { success: true, data: { id: 4 } },
  handler: async (req, res) => {
    const r = await svc.saveSodRule(pool, req.body, req.params.id);
    await audit(req, { entity: 'sod_rule', entityId: req.params.id, action: 'update', after: r });
    ok(res, r, 'Rule saved');
  },
});
define({
  method: 'DELETE', path: '/sod-rules/:id', summary: 'Switch off a segregation-of-duties rule', screen: `${S} > Segregation of Duties`, middleware: write, response: { success: true, data: { id: 4 } },
  handler: async (req, res) => {
    const r = await svc.deleteSodRule(pool, req.params.id);
    await audit(req, { entity: 'sod_rule', entityId: req.params.id, action: 'delete', after: r });
    ok(res, r, 'Rule switched off');
  },
});
define({
  method: 'POST', path: '/sod-check', summary: 'Rules a set of roles would break (used by the user form before saving)', screen: `${S} > User`,
  middleware: [requireAuth, requirePermission('write:users', 'read:access-control'), validate(z.object({ roles: z.array(z.string()) }))], request: { roles: ['processing', 'accounting'] },
  response: { success: true, data: [{ name: 'Placement and payment', action: 'block' }] },
  handler: async (req, res) => ok(res, await svc.sodConflicts(pool, req.body.roles)),
});

// ---------- access reviews ----------
define({
  method: 'GET', path: '/reviews', summary: 'Access reviews (recertification campaigns) with progress', screen: `${S} > Access Reviews`, middleware: read,
  response: { success: true, data: [{ id: 1, name: 'Q4 2026 access review', dueDate: '2026-12-15', status: 'open', users: 14, pending: 3 }] },
  handler: async (_req, res) => ok(res, await svc.listReviews(pool)),
});
define({
  method: 'POST', path: '/reviews', summary: 'Start an access review of every active user', screen: `${S} > Access Reviews`,
  middleware: [...write, validate(z.object({ name: z.string().min(3).max(120), dueDate: date }))], request: { name: 'Q4 2026 access review', dueDate: '2026-12-15' },
  response: { success: true, data: { id: 1, items: [] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.startReview(db, req.body, req.user));
    await audit(req, { entity: 'access_review', entityId: String(r.id), action: 'start', after: { name: r.name, users: r.items.length } });
    // the users are kept or revoked with write:access-control (not by the person reviewed)
    await notifyApprovers({ audience: 'write:access-control', document: 'Access review', number: r.name, by: req.user.username, title: `Access review ${r.name} awaiting decisions`,
      message: `${req.user.username} started ${r.name}: ${r.items.length} user(s) to keep or revoke by ${r.dueDate instanceof Date ? r.dueDate.toISOString().slice(0, 10) : r.dueDate}`,
      link: '/master/generals/usermanagement/access-reviews', entity: 'access_review', entityId: r.id });
    created(res, r, `Access review started for ${r.items.length} user(s)`);
  },
});
define({
  method: 'GET', path: '/reviews/:id', summary: 'One access review with every user and decision (?format=xlsx|csv to download)', screen: `${S} > Access Reviews`, middleware: read,
  response: { success: true, data: { id: 1, items: [{ username: 'maria.rivera', roles: ['sales'], decision: 'pending' }] } },
  handler: async (req, res) => {
    const r = await svc.getReview(pool, req.params.id);
    if (req.query.format) return sendTable(res, { header: svc.REVIEW_HEADER, rows: svc.reviewRows(r), fileBase: `access-review-${r.id}`, format: format(req.query), sheetName: 'Review' });
    return ok(res, r);
  },
});
define({
  method: 'POST', path: '/reviews/:id/items/:itemId', summary: 'Keep or revoke one user\'s access (revoke deactivates the account and signs it out)', screen: `${S} > Access Reviews`,
  middleware: [...write, validate(z.object({ decision: z.enum(['keep', 'revoke']), remarks: z.string().max(500).optional() }))], request: { decision: 'keep' },
  response: { success: true, data: { id: 1 } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.decideReviewItem(db, req.params.id, req.params.itemId, req.body, req.user));
    await audit(req, { entity: 'access_review_item', entityId: req.params.itemId, action: req.body.decision, after: req.body });
    ok(res, r, req.body.decision === 'revoke' ? 'Access revoked; the account is deactivated' : 'Access confirmed');
  },
});
define({
  method: 'POST', path: '/reviews/:id/close', summary: 'Close a review once every user has been decided', screen: `${S} > Access Reviews`, middleware: write,
  response: { success: true, data: { id: 1, status: 'closed' } },
  handler: async (req, res) => {
    const r = await svc.closeReview(pool, req.params.id, req.user);
    await audit(req, { entity: 'access_review', entityId: req.params.id, action: 'close', after: { revoked: r.revoked } });
    ok(res, r, 'Access review closed');
  },
});

// ---------- sessions ----------
define({
  method: 'POST', path: '/users/:id/sign-out', summary: 'End every session of a user (lost device, suspected misuse, role change)', screen: `${S} > User`,
  middleware: [requireAuth, requirePermission('write:users')], response: { success: true, data: { userId: 'usr_1', signedOut: true } },
  handler: async (req, res) => {
    const r = await svc.signOutEverywhere(pool, req.params.id, req.user);
    await audit(req, { entity: 'user', entityId: req.params.id, action: 'sign-out', after: r });
    ok(res, r, `${r.username} is signed out on every device`);
  },
});

export default router;
export const mount = '/access-control';
