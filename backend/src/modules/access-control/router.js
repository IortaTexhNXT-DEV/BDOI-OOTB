/**
 * Access control (Master > Users and Access): user access matrix, role permissions (with changes of a role's access
 * through approval, roleAccess.js and changes.js), authority matrix (authority.js: limits, their changes through the
 * same approval, the upload template and the exports), delegation of authority, segregation-of-duties rules, access
 * reviews, and ending a user's sessions. Rules and their use by the approval steps: service.js.
 * Permissions: read:access-control (System Administrator, Accounting Manager read), write:access-control and
 * approve:access-control (System Administrator; the approver of a limit or of a change of access is not the one who
 * proposed it); a change of a role's access is requested with write:roles.
 */
import { moduleRouter } from '../../lib/registry.js';
import { hasPermission, requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { mapColumns, parseUploadedRows, uploadFile } from '../documents/tabular.js';
import { storeFile } from '../uploads/storage.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
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
import * as authority from './authority.js';
import * as delegations from './delegations.js';
import * as sod from './sod.js';
import * as reviews from './reviews.js';
import * as userAccess from './userAccess.js';
import * as controls from './controls.js';
import { roleDirectory } from './roles.js';
import { countOf } from './catalogue.js';
import { formatDate } from '../../lib/pdf/format.js';

const { router, define } = moduleRouter('Access Control', '/access-control');
const read = [requireAuth, requirePermission('read:access-control')];
const write = [requireAuth, requirePermission('write:access-control')];
const approve = [requireAuth, requirePermission('approve:access-control')];
const roleWrite = [requireAuth, requirePermission('write:roles')];
const S = 'Master > Users and Access';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const format = (q) => (String(q.format || '').toLowerCase() === 'csv' ? 'csv' : 'xlsx');

// Approval notifications: a proposed limit goes to approve:access-control (the decision route), the decision to the proposer.
const AUTHORITY = '/master/generals/usermanagement/authority-matrix';
const limitNumber = (l) => `#${l.id}`;
const limitText = async (l) => `${l.transactionName || l.transactionType} for ${l.roleName || l.roleCode || l.userName || l.username}: `
  + `${l.unlimited ? 'no limit' : l.measure === 'percent' ? `${l.maxAmount}%` : await formatMoney(l.maxAmount)}`;

// ---------- matrices ----------
define({
  method: 'GET', path: '/directory', summary: 'Role directory of the access screens: the departments in order and each role with its department, summary, base platform flag and full access; the settings of the screens and what the signed-in user may do',
  screen: `${S}`, middleware: read,
  response: { success: true, data: { asOf: '2026-10-10', approval: true, departments: [{ name: 'Cash Control', order: 3 }],
    roles: [{ code: 'tis-ccd-bp', name: 'CCD-BP / QRPh (Receipting)', department: 'Cash Control', platform: false, fullAccess: false, status: 'active' }],
    settings: { delegationMaxDays: 90, sodExceptionMaxDays: 365, reviewDueDays: 14, dormantDays: 90 }, abilities: { edit: true, approve: true, signOut: true } } },
  handler: async (req, res) => {
    const dir = await roleDirectory(pool);
    const n = async (key, fallback) => Number(await getSetting(key, fallback)) || fallback;
    ok(res, { asOf: await today(), approval: await changes.changeApproval(), departments: dir.departments,
      roles: dir.roles.map((r) => ({ code: r.code, name: r.name, department: r.department, summary: r.summary, platform: r.platform, fullAccess: r.fullAccess, status: r.status, inherits: r.inherits })),
      settings: { delegationMaxDays: await n('access.delegation_max_days', 90), sodExceptionMaxDays: await n('access.sod_exception_max_days', 365),
        reviewDueDays: await n('access.review_due_days', 14), dormantDays: Number(await getSetting('access.dormant_days', 90)) || 0 },
      abilities: { edit: hasPermission(req.user, 'write:access-control'), approve: hasPermission(req.user, 'approve:access-control'), signOut: hasPermission(req.user, 'write:users') } });
  },
});
define({
  method: 'GET', path: '/user-matrix', summary: 'Every user with roles by name (and the roles they include), department, branch, status, last sign-in, two-step, password age, segregation-of-duties conflicts with their exceptions, changes waiting for approval and the last review (?status; ?format=xlsx|csv: Users, Roles of users, Segregation of duties, Delegations in effect; &technical=1 adds the codes)',
  screen: `${S} > User Access Matrix`, middleware: read, query: { status: 'active', format: 'xlsx' },
  response: { success: true, data: { asOf: '2026-10-10', dormantDays: 90, departments: [{ name: 'Cash Control', order: 3 }], roles: [{ code: 'tis-ccd-bp', name: 'CCD-BP / QRPh (Receipting)', department: 'Cash Control', platform: false }],
    rows: [{ id: 'usr_9', username: 'gene.jaen', displayName: 'Gene Kelly Jaen', department: 'Cash Control', roles: ['tis-ccd-bp', 'tis-ccd-recon'], roleNames: ['CCD-BP / QRPh (Receipting)', 'CCD-Recon'],
      included: [], status: 'active', dormant: false, sodConflicts: [{ name: 'Receipting and reversals', action: 'warn', state: 'accepted', validUntil: '2027-03-31' }], openConflicts: 0, pending: [], lastReview: null }] } },
  handler: async (req, res) => {
    const status = ['active', 'inactive', 'locked'].includes(req.query.status) ? req.query.status : null;
    if (!req.query.format) return ok(res, await userAccess.userMatrix(pool, { status }, req.user));
    const ctx = await printContext();
    const sheets = await userAccess.userMatrixSheets(pool, req.user, ctx.format, { technical: technicalOf(req), status });
    await audit(req, { entity: 'user', entityId: 'access-matrix', action: 'export', after: { users: sheets[0].rows.length, format: format(req.query) } });
    return sendSheets(res, { title: 'User access matrix', fileBase: 'user-access-matrix', format: format(req.query), sheets, ctx });
  },
});
define({
  method: 'GET', path: '/users/:id/access', summary: 'The access panel of one person: roles with the roles they include, what he or she can do by area and module, approval authority today, delegations, conflicts, last review and changes waiting for approval',
  screen: `${S} > User Access Matrix`, middleware: read,
  response: { success: true, data: { asOf: '2026-10-10', user: { id: 'usr_9', displayName: 'Gene Kelly Jaen' }, roles: [{ code: 'tis-ccd-bp', name: 'CCD-BP / QRPh (Receipting)', included: [] }],
    fullAccess: false, access: [{ code: 'accounts', name: 'Accounts', modules: [{ code: 'receipts', name: 'Receipts', levels: ['view', 'edit'] }] }], authority: [], delegations: { given: [], received: [] } } },
  handler: async (req, res) => ok(res, await userAccess.userAccessPanel(pool, req.params.id, req.user)),
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
    const names = new Map((await roleDirectory(pool)).roles.map((r) => [r.code, r.name]));
    const scope = roles.length ? `Roles: ${roles.map((c) => names.get(c) || c).join(', ')}`
      : `All ${['1', 'true'].includes(String(req.query.base)) ? 'roles, base platform roles included' : 'TISPH roles'}`;
    const banner = [ctx.letterhead?.name, 'Role permissions', scope, `As at ${ctx.generatedAt} · exported by ${ctx.generatedBy}`].filter(Boolean);
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
    if (r.result?.notices) await sendNotices(r.result.notices, req.user, c.link);
    await notifyDecision({ userId: c.requestedById, decidedBy: req.user.id, document: `${c.kindLabel} change`, number: c.ref, approved, by: req.user.username,
      reason: approved ? null : c.decisionRemarks, message: approved ? `${changes.appliedText(c)}, approved by ${req.user.username}`.replace(/^./, (x) => x.toUpperCase()) : null,
      link: c.link, entity: 'accounting_config_change', entityId: c.id });
    ok(res, c, approved ? `Change ${c.ref} approved; ${changes.appliedText(c)}` : `Change ${c.ref} rejected`);
  },
});
define({
  method: 'POST', path: '/changes/:id/withdraw', summary: 'Withdraw a change of access waiting for approval (the requester only; an approver rejects it with a reason)', screen: `${S} > Role Permissions`,
  middleware: [requireAuth, requirePermission('write:roles', 'write:access-control', 'approve:access-control')], response: { success: true, data: { ...changeExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const c = await withTransaction((db) => changes.withdrawAccessChange(db, req.params.id, req.user));
    await audit(req, { entity: 'accounting_config_change', entityId: c.id, action: 'withdraw', after: c });
    ok(res, c, `Change ${c.ref} withdrawn`);
  },
});

// ---------- access controls ----------
define({
  method: 'GET', path: '/controls', summary: 'The access controls (approval of access changes, segregation of duties and approval limits enforced) with their values and the change waiting for approval',
  screen: `${S} > Role Permissions`, middleware: read,
  response: { success: true, data: { items: [{ key: 'access.change_approval', name: 'Changes of access wait for a second administrator', type: 'boolean', options: null, value: true }], pending: null } },
  handler: async (req, res) => ok(res, await controls.controlsOverview(pool, req.user)),
});
define({
  method: 'POST', path: '/controls', summary: 'Propose new values of the access controls with a reason (access_change); applies only once a different administrator approves it, whatever access.change_approval says',
  screen: `${S} > Role Permissions`, middleware: [...write, validate(z.object({ values: z.record(z.union([z.boolean(), z.string().max(20)])), reasonCode: z.string().max(40).optional(),
    note: z.string().max(500).optional() }))],
  request: { values: { 'access.sod_enforced': false }, reasonCode: 'ACC-REDESIGN', note: 'Data migration week' },
  response: { success: true, data: { ...changeExample, kind: 'access-controls', kindLabel: 'Access controls', target: 'access-controls', targetLabel: 'Access controls',
    summary: ['Segregation of duties is checked when roles are given: On → Off'] } },
  handler: async (req, res) => {
    const c = await withTransaction((db) => controls.proposeControls(db, req.body, req.user));
    await audit(req, { entity: 'accounting_config_change', entityId: c.id, action: 'request', after: c });
    await changes.askAccessApproval(c, req.user);
    created(res, c, `Change ${c.ref} sent for approval; it applies once another administrator approves it`);
  },
});

// ---------- authority matrix ----------
const limitBody = { maxAmount: z.number().min(0).nullable().optional(), unlimited: z.boolean().optional(), effectiveFrom: date.optional(),
  referenceNo: z.string().max(60).optional(), referenceDate: date.optional(), remarks: z.string().max(500).optional() };
// lines are checked by authority.proposeChange, which names the wrong line and field
const lineSchema = z.object({ transactionType: z.string().max(60), roleCode: z.string().max(80).nullable().optional(), userId: z.string().max(80).nullable().optional(),
  removes: z.boolean().optional(), maxAmount: z.number().nullable().optional(), unlimited: z.boolean().optional(), effectiveFrom: z.string().max(20).nullable().optional(),
  referenceNo: z.string().max(200).nullable().optional(), referenceDate: z.string().max(20).nullable().optional(), remarks: z.string().max(2000).nullable().optional() });
const cellExample = { limitId: 41, maxAmount: 1000000, unlimited: false, set: true, effectiveFrom: '2026-10-01', endsOn: null, referenceNo: 'BR-2026-014', referenceDate: '2026-09-25',
  approvedBy: 'IT administrator', scheduled: null, pending: null };
const authorityChange = { id: 31, ref: 'CFG-31', kind: 'authority-limits', kindLabel: 'Authority matrix', target: 'journal_voucher|role:tis-finance',
  targetLabel: 'Journal voucher approval · TIS Finance & General Accounting', summary: ['Journal voucher approval · TIS Finance & General Accounting: Not set → PHP 1,000,000.00 from 2026-10-10 (BR-2026-014)'],
  status: 'pending', canDecide: false, canWithdraw: true, link: `${AUTHORITY}?tab=pending&change=31` };
const yes = (v) => ['1', 'true', 'yes'].includes(String(v || '').toLowerCase());

/** The authority reference is asked on every change made through the API while access.authority_reference_required is on. */
async function assertReference(b) {
  if (!(await getSetting('access.authority_reference_required', true))) return;
  const errors = [];
  if (!String(b.referenceNo || '').trim()) errors.push({ path: 'referenceNo', message: 'Enter the authority reference (for example the board resolution number)' });
  if (!b.referenceDate) errors.push({ path: 'referenceDate', message: 'Enter the date of the authority reference' });
  if (errors.length) throw badRequest('Validation failed', errors);
}

/** Excel download with the letterhead and an "as at" line on the first sheet (CSV: the first sheet only). */
async function sendSheets(res, { title, fileBase, sheets, format: fmt, ctx: given = null }) {
  const name = `${fileBase}-${(await today()).replace(/-/g, '')}`;
  if (fmt === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
    return res.send(toCsv(sheets[0].columns, sheets[0].rows));
  }
  const ctx = given || await printContext();
  const banner = [ctx.letterhead?.name, title, `As at ${ctx.generatedAt} · exported by ${ctx.generatedBy}`].filter(Boolean);
  const buf = writeXlsx({ title, brand: excelBrand(ctx), sheets: sheets.map((sh, i) => (i === 0 ? { ...sh, banner, logo: true } : sh)) });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
  return res.send(buf);
}
/** Personal notices of an access change ({ userId, document, number, status, message }) after it has committed. */
const sendNotices = async (notices, user, link) => {
  for (const n of notices || []) {
    await notifyDecision({ userId: n.userId, decidedBy: user.id, document: n.document, number: n.number, approved: true, status: n.status, by: user.username, message: n.message,
      link: n.link || link, entity: 'user_delegation', entityId: n.number });
  }
};
const columnsOf = (header) => header.map((h) => ({ header: h, width: Math.max(12, Math.min(40, h.length + 6)) }));

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
  method: 'GET', path: '/authority-matrix', summary: 'Approval limits: transaction types down (with the approval step that checks each), the roles across by department with the types they can approve, each limit in effect, scheduled and waiting for approval, the personal limits and the rule for a cell without a limit (?format=xlsx|csv: every role and type for audit)',
  screen: `${S} > Authority Matrix`, middleware: read, query: { format: 'xlsx' },
  response: { success: true, data: { asOf: '2026-10-10', withoutLimit: 'allow', referenceRequired: true, departments: [{ name: 'Finance and Accounting', order: 4 }],
    roles: [{ code: 'tis-finance', name: 'TIS Finance & General Accounting', department: 'Finance and Accounting', platform: false, fullAccess: false, approves: ['payment_voucher', 'journal_voucher'] }],
    rows: [{ code: 'journal_voucher', name: 'Journal voucher approval', measure: 'amount', checked: true, step: 'Accounts > Journal Vouchers > Approve', cells: { 'tis-finance': cellExample } }],
    userLimits: [], pendingCount: 0, abilities: { edit: true, approve: true } } },
  handler: async (req, res) => {
    if (!req.query.format) return ok(res, await authority.authorityMatrix(pool, req.user));
    const rows = await authority.authorityMatrixRows(pool, req.user);
    await audit(req, { entity: 'authority_limit', entityId: 'matrix', action: 'export', after: { rows: rows.length, format: format(req.query) } });
    return sendSheets(res, { title: 'Authority matrix', fileBase: 'authority-matrix', format: format(req.query),
      sheets: [{ name: 'Authority matrix', columns: columnsOf(authority.AUTHORITY_MATRIX_HEADER), rows }] });
  },
});
define({
  method: 'GET', path: '/authority-limits', summary: 'Authority limits with their history, newest first (?status=pending|active|rejected|retired|withdrawn|all, transactionType; ?format=xlsx|csv: the change history for audit)',
  screen: `${S} > Authority Matrix`, middleware: read, query: { status: 'all', transactionType: 'payment_voucher' },
  response: { success: true, data: [{ id: 41, transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 1000000, status: 'active', statusLabel: 'In effect', referenceNo: 'BR-2026-014', changeId: 31 }] },
  handler: async (req, res) => {
    const status = req.query.status || null;
    if (!req.query.format && status && status !== 'all') return ok(res, await svc.listLimits(pool, { status, transactionType: req.query.transactionType || null }));
    const list = await authority.limitHistory(pool, { transactionType: req.query.transactionType || null });
    if (!req.query.format) return ok(res, list);
    await audit(req, { entity: 'authority_limit', entityId: 'history', action: 'export', after: { rows: list.length, format: format(req.query) } });
    return sendSheets(res, { title: 'Authority limits: change history', fileBase: 'authority-limit-history', format: format(req.query),
      sheets: [{ name: 'Change history', columns: columnsOf(authority.LIMIT_HISTORY_HEADER), rows: authority.limitHistoryRows(list) }] });
  },
});
define({
  method: 'POST', path: '/authority-changes', summary: 'Propose a change of the Authority Matrix: one or more limits of roles or people (set, no limit, removal), each with its effective date (today or later) and authority reference; it applies once another administrator approves it',
  screen: `${S} > Authority Matrix`,
  middleware: [...write, validate(z.object({ lines: z.array(lineSchema).min(1).max(2000), remarks: z.string().max(1000).optional(),
    file: z.object({ key: z.string().max(500), name: z.string().max(260).optional() }).nullable().optional(), rowsRead: z.number().int().min(0).optional(), unchanged: z.number().int().min(0).optional() }))],
  request: { lines: [{ transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 1000000, effectiveFrom: '2026-10-10', referenceNo: 'BR-2026-014', referenceDate: '2026-09-25' }] },
  response: { success: true, data: authorityChange },
  handler: async (req, res) => {
    const c = await withTransaction((db) => authority.proposeChange(db, req.body, req.user));
    await audit(req, { entity: 'accounting_config_change', entityId: c.id, action: 'request', after: c });
    await changes.askAccessApproval(c, req.user);
    created(res, c, `Change ${c.ref} sent for approval; it applies once another administrator approves it`);
  },
});
define({
  method: 'GET', path: '/authority-matrix/template', summary: 'Upload template of the Authority Matrix (XLSX): the matrix as it is, one row per transaction and role, with drop-down lists and the rules (?base=1 base platform roles, unchecked=1 transactions no approval step checks, all=1 every role)',
  screen: `${S} > Authority Matrix > Upload > Download template`, middleware: read, query: { base: 0, unchecked: 0, all: 0 }, response: '(xlsx file)',
  handler: async (req, res) => {
    const sheets = await authority.templateSheets(pool, req.user, { base: yes(req.query.base), unchecked: yes(req.query.unchecked), all: yes(req.query.all) });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="authority-matrix-upload.xlsx"');
    res.send(writeXlsx({ title: 'Authority matrix upload', sheets }));
  },
});
define({
  method: 'POST', path: '/authority-matrix/uploads', summary: 'Check a filled Authority Matrix template (multipart "file", XLSX or CSV) without changing anything: every row is checked first; without errors the file is kept and the changes are returned for review, then sent for approval together (POST /authority-changes)',
  screen: `${S} > Authority Matrix > Upload`, middleware: [...write, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: 'Checked 24 rows: 3 changes ready to review, 21 unchanged.', data: { rowsRead: 24, updated: 3, created: 0, unchanged: 21, errors: [],
    changes: [{ row: 5, transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 1000000, effectiveFrom: '2026-10-10', referenceNo: 'BR-2026-014' }],
    file: { key: 'authority-matrix/1760000000000-ab12-authority.xlsx', name: 'authority.xlsx' } } },
  handler: async (req, res) => {
    // only the template's own formats are read and kept as evidence of the change
    if (req.file && !/\.(xlsx|csv)$/i.test(req.file.originalname || '')) {
      throw badRequest('Validation failed', [{ path: 'file', message: 'Upload the template as an Excel workbook (.xlsx) or a CSV file (.csv)' }]);
    }
    const rows = parseUploadedRows(req.file);
    const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
    if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
    const r = await authority.checkUpload(pool, rows.map((row) => mapColumns(row, authority.AUTHORITY_UPLOAD_COLUMNS)), req.user);
    const checked = `Checked ${r.rowsRead} row${r.rowsRead === 1 ? '' : 's'}`;
    if (r.errors.length) {
      return ok(res, { ...r, created: 0, updated: 0, file: null }, `${checked}: ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}. Nothing was saved.`);
    }
    if (!r.changes.length) return ok(res, { ...r, created: 0, updated: 0, file: null }, `${checked}: no change, the file matches the matrix.`);
    const stored = await storeFile(req.file, { folder: authority.UPLOAD_FOLDER, userId: req.user.id });
    await audit(req, { entity: 'authority_limit', entityId: 'upload', action: 'upload-check', after: { file: stored.fileName, rows: r.rowsRead, changes: r.changes.length } });
    return ok(res, { ...r, created: 0, updated: r.changes.length, file: { key: stored.key, name: stored.fileName } },
      `${checked}: ${r.changes.length} change${r.changes.length === 1 ? '' : 's'} ready to review, ${r.unchanged} unchanged.`);
  },
});
define({
  method: 'POST', path: '/authority-limits', summary: 'Propose a limit for a role or a user (API and go-live workbook); it applies once another administrator approves it, from its effective date (today or later)',
  screen: `${S} > Authority Matrix`,
  middleware: [...write, validate(z.object({ transactionType: z.string(), roleCode: z.string().optional(), userId: z.string().optional(), ...limitBody }))],
  request: { transactionType: 'payment_voucher', roleCode: 'tis-finance', maxAmount: 1000000, referenceNo: 'BR-2026-014', referenceDate: '2026-09-25' },
  response: { success: true, data: { id: 1, status: 'pending' } },
  handler: async (req, res) => {
    await assertReference(req.body);
    const r = await withTransaction((db) => svc.proposeLimit(db, req.body, req.user));
    await audit(req, { entity: 'authority_limit', entityId: String(r.id), action: 'propose', after: r });
    await notifyApprovers({ audience: 'approve:access-control', document: 'Authority limit', number: limitNumber(r), by: req.user.username,
      message: `${req.user.username} proposed ${await limitText(r)}${r.remarks ? ` (${r.remarks})` : ''}${r.referenceNo ? `, authority reference ${r.referenceNo}` : ''}`, link: AUTHORITY,
      entity: 'authority_limit', entityId: r.id });
    created(res, r, 'Limit proposed; it applies once another administrator approves it');
  },
});
define({
  method: 'POST', path: '/authority-limits/:id/decision', summary: 'Approve (in effect from its effective date) or reject (note required) a proposed limit; never by the person who proposed it', screen: `${S} > Authority Matrix`,
  middleware: [...approve, validate(z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() }))],
  request: { decision: 'approve' }, response: { success: true, data: { id: 1, status: 'active' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.decideLimit(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'authority_limit', entityId: req.params.id, action: req.body.decision, after: r });
    const approved = req.body.decision === 'approve';
    await notifyDecision({ userId: r.requestedById, decidedBy: req.user.id, document: 'Authority limit', number: limitNumber(r), approved, by: req.user.username,
      reason: approved ? null : req.body.note || null, message: approved ? `${await limitText(r)}, approved by ${req.user.username}, in effect from ${formatDate(r.effectiveFrom)}` : null,
      link: AUTHORITY, entity: 'authority_limit', entityId: r.id });
    ok(res, r, approved ? `Limit approved; in effect from ${formatDate(r.effectiveFrom)}` : 'Limit rejected');
  },
});
define({
  method: 'DELETE', path: '/authority-limits/:id', summary: 'A proposal waiting for approval: withdraw it (the proposer only). A limit in effect or scheduled: propose its removal (write permission; authority reference in the body), which applies once another administrator approves it',
  screen: `${S} > Authority Matrix`, middleware: [requireAuth, requirePermission('write:access-control', 'approve:access-control')],
  request: { referenceNo: 'BR-2026-020', referenceDate: '2026-10-05', remarks: 'Role merged into Finance' },
  response: { success: true, data: { id: 1, status: 'withdrawn' } },
  handler: async (req, res) => {
    const l = await svc.getLimit(pool, req.params.id);
    if (!l) throw notFound('Authority limit not found');
    if (l.status === 'pending') {
      const r = await withTransaction((db) => svc.withdrawLimit(db, req.params.id, req.user));
      await audit(req, { entity: 'authority_limit', entityId: req.params.id, action: 'withdraw', after: r });
      return ok(res, r, 'Proposal withdrawn');
    }
    if (l.status !== 'active') throw conflict(`This limit is ${l.status}`);
    if (!hasPermission(req.user, 'write:access-control')) throw forbidden('Requires permission: write:access-control');
    const b = req.body || {};
    const c = await withTransaction((db) => authority.proposeChange(db, { lines: [{ transactionType: l.transactionType, roleCode: l.roleCode, userId: l.userId, removes: true,
      referenceNo: b.referenceNo, referenceDate: b.referenceDate, remarks: b.remarks }] }, req.user));
    await audit(req, { entity: 'accounting_config_change', entityId: c.id, action: 'request', after: c });
    await changes.askAccessApproval(c, req.user);
    return created(res, c, `Removal ${c.ref} sent for approval; the limit stays in effect until another administrator approves it`);
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
const reasonBody = { reasonCode: z.string().max(40).optional(), note: z.string().max(1000).optional() };
const technicalOf = (req) => yes(req.query.technical) && hasPermission(req.user, 'write:access-control');
const delegationExample = { key: 'D-4', id: 4, changeId: 40, ref: 'CFG-40', delegatorId: 'usr_1', delegatorName: 'Mariela S. Valentino', delegatorDepartment: 'Finance and Accounting',
  delegateId: 'usr_2', delegateName: 'Chrystal G. Malinay', delegateDepartment: 'Finance and Accounting', transactionTypes: ['journal_voucher'],
  transactionNames: ['Journal voucher approval'], dateFrom: '2026-10-12', dateTo: '2026-10-16', days: 5, reasonCode: 'DLG-LEAVE', reason: 'Vacation or annual leave',
  status: 'in-effect', requestedBy: 'IT administrator', approvedBy: 'General Manager', canEnd: true, change: null };
define({
  method: 'GET', path: '/delegations', summary: 'Delegations of approval authority and the requests not yet in effect (?view=current|pending|ended|all, default current; ?active=true is current; ?format=xlsx|csv for audit, &technical=1 adds the codes)',
  screen: `${S} > Delegations`, middleware: read, query: { view: 'current', format: 'xlsx' },
  response: { success: true, data: { asOf: '2026-10-10', approval: true, counts: { current: 1, pending: 0, ended: 3, all: 4 }, rows: [delegationExample] } },
  handler: async (req, res) => {
    const view = String(req.query.active) === 'true' ? 'current' : delegations.VIEWS.includes(req.query.view) ? req.query.view : 'current';
    const list = await delegations.listDelegations(pool, { view }, req.user);
    if (!req.query.format) return ok(res, list);
    const ctx = await printContext();
    await audit(req, { entity: 'user_delegation', entityId: view, action: 'export', after: { rows: list.rows.length, format: format(req.query) } });
    return sendSheets(res, { title: 'Delegations', fileBase: 'delegations', format: format(req.query), ctx,
      sheets: [{ name: 'Delegations', columns: delegations.delegationColumns({ technical: technicalOf(req) }), rows: delegations.delegationRows(list.rows, ctx.format, { technical: technicalOf(req) }) }] });
  },
});
define({
  method: 'GET', path: '/delegations/options', summary: 'What a new delegation offers: the transactions an approval step checks, every active person with the transactions he or she can approve and the authority today, the departments, the longest delegation',
  screen: `${S} > Delegations > New delegation`, middleware: read,
  response: { success: true, data: { asOf: '2026-10-10', maxDays: 90, approval: true, withoutLimit: 'allow', departments: [{ name: 'Finance and Accounting', order: 4 }],
    types: [{ code: 'journal_voucher', name: 'Journal voucher approval', measure: 'amount', step: 'Accounts > Journal Vouchers > Approve' }],
    people: [{ id: 'usr_1', name: 'Mariela S. Valentino', department: 'Finance and Accounting', roleNames: ['TIS Finance & General Accounting'], approves: ['journal_voucher'],
      authority: { journal_voucher: { set: true, limit: 750000, unlimited: false, source: 'personal limit' } } }] } },
  handler: async (_req, res) => ok(res, await delegations.delegationOptions(pool)),
});
define({
  method: 'POST', path: '/delegations/preview', summary: 'The effect of a delegation per transaction: the approver\'s own limit and the authority of the person covering with and without it (a delegation never lowers authority)',
  screen: `${S} > Delegations > New delegation`, middleware: [...read, validate(z.object({ delegatorId: z.string().max(80).optional(), delegateId: z.string().max(80).optional(),
    transactionTypes: z.array(z.string().max(60)).max(50).default([]), dateFrom: z.string().max(20).optional() }))],
  request: { delegatorId: 'usr_1', delegateId: 'usr_2', transactionTypes: ['journal_voucher'], dateFrom: '2026-10-12' },
  response: { success: true, data: { asOf: '2026-10-12', lines: [{ transactionType: 'journal_voucher', name: 'Journal voucher approval', measure: 'amount',
    lent: { set: true, limit: 750000 }, before: { set: false }, after: { set: false }, changes: false }] } },
  handler: async (req, res) => ok(res, await delegations.previewDelegation(pool, req.body)),
});
define({
  method: 'POST', path: '/delegations', summary: 'Request a delegation of approval authority for a period (reason from the Reason Codes master, context delegation); it applies once another administrator approves it (at once with access.change_approval off). Empty transaction types = every transaction the approver away can approve',
  screen: `${S} > Delegations > New delegation`,
  middleware: [...write, validate(z.object({ delegatorId: z.string().max(80), delegateId: z.string().max(80), transactionTypes: z.array(z.string().max(60)).max(50).optional(),
    dateFrom: date, dateTo: date, ...reasonBody }))],
  request: { delegatorId: 'usr_1', delegateId: 'usr_2', transactionTypes: ['journal_voucher'], dateFrom: '2026-10-12', dateTo: '2026-10-16', reasonCode: 'DLG-LEAVE' },
  response: { success: true, data: { change: { ...changeExample, kind: 'delegation', kindLabel: 'Delegation' }, delegation: null } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => delegations.requestDelegation(db, req.body, req.user));
    if (r.change) {
      await audit(req, { entity: 'accounting_config_change', entityId: r.change.id, action: 'request', after: r.change });
      await changes.askAccessApproval(r.change, req.user);
      return created(res, r, `Delegation ${r.change.ref} sent for approval; it applies once another administrator approves it`);
    }
    await audit(req, { entity: 'user_delegation', entityId: String(r.delegation.id), action: 'create', after: r.delegation });
    return created(res, r, 'Delegation recorded');
  },
});
const endDelegation = async (req, res) => {
  const r = await withTransaction((db) => delegations.endDelegation(db, req.params.id, req.body || {}, req.user));
  await audit(req, { entity: 'user_delegation', entityId: req.params.id, action: 'end', before: r.before, after: r.delegation });
  await sendNotices(r.notices, req.user, `${delegations.DELEGATIONS_PATH}?view=ended`);
  ok(res, r.delegation, 'Delegation ended');
};
define({
  method: 'POST', path: '/delegations/:id/end', summary: 'End a delegation before its last day (reason of context delegation_end); it stops at once and both people are told',
  screen: `${S} > Delegations`, middleware: [...write, validate(z.object(reasonBody))], request: { reasonCode: 'DLE-RETURNED' },
  response: { success: true, data: { ...delegationExample, status: 'ended-early' } }, handler: endDelegation,
});
define({
  method: 'POST', path: '/delegations/:id/revoke', summary: 'End a delegation early (the earlier name of /delegations/:id/end)', screen: `${S} > Delegations`,
  middleware: [...write, validate(z.object(reasonBody))], request: { reasonCode: 'DLE-RETURNED' }, response: { success: true, data: { ...delegationExample, status: 'ended-early' } },
  handler: endDelegation,
});
define({
  method: 'GET', path: '/users/:id/authority', summary: 'The approval authority of a person on a date (?date, default today) for every transaction an approval step checks, delegations included, and whether he or she reaches the step',
  screen: `${S} > Delegations`, middleware: read, query: { date: '2026-10-12' },
  response: { success: true, data: { asOf: '2026-10-12', lines: [{ transactionType: 'journal_voucher', name: 'Journal voucher approval', canApprove: true, set: true, limit: 750000,
    unlimited: false, source: 'delegated by Mariela S. Valentino (personal limit)' }] } },
  handler: async (req, res) => ok(res, await delegations.userAuthority(pool, req.params.id, req.query.date || null)),
});

// ---------- segregation of duties ----------
const SOD = z.object({ code: z.string().min(2).max(40).optional(), name: z.string().min(2).max(120).optional(), kind: z.enum(['roles', 'access']).optional(),
  roleA: z.string().nullable().optional(), roleB: z.string().nullable().optional(), accessA: z.array(z.string()).max(100).optional(), accessB: z.array(z.string()).max(100).optional(),
  action: z.enum(['block', 'warn']).optional(), reason: z.string().max(500).nullable().optional(), active: z.boolean().optional(), ...reasonBody });
const ruleExample = { id: 6, code: 'SOD-TIS-BP-RECON', name: 'Receipting and reversals', kind: 'roles', roleA: 'tis-ccd-bp', roleAName: 'CCD-BP / QRPh (Receipting)',
  roleB: 'tis-ccd-recon', roleBName: 'CCD-Recon', accessA: [], accessB: [], action: 'warn', reason: 'Receipts and their reversals are kept apart', active: true, users: 2,
  platform: false, change: null, canEdit: true };
const sodAnswer = async (req, res, r, verb) => {
  if (r.change) {
    await audit(req, { entity: 'accounting_config_change', entityId: r.change.id, action: 'request', after: r.change });
    await changes.askAccessApproval(r.change, req.user);
    return created(res, r, `Change ${r.change.ref} sent for approval; it applies once another administrator approves it`);
  }
  await audit(req, r.audit);
  return ok(res, r, verb);
};
define({
  method: 'GET', path: '/sod-rules', summary: 'Segregation-of-duties rules: pairs of roles one person may not hold together, and access a role or a person should not combine, with the active users breaking each and the change waiting for approval (?format=xlsx|csv: the workbook of the screen, &technical=1 adds the codes, &base=1 the rules between base platform roles)',
  screen: `${S} > Segregation of Duties`, middleware: read, query: { format: 'xlsx' },
  response: { success: true, data: { rows: [ruleExample], pendingNew: [], approval: true, maxExceptionDays: 365, asOf: '2026-10-10', abilities: { edit: true, approve: true } } },
  handler: async (req, res) => {
    if (!req.query.format) return ok(res, await sod.sodRuleList(pool, req.user));
    const ctx = await printContext();
    const sheets = await sod.sodSheets(pool, req.user, ctx.format, { technical: technicalOf(req), base: yes(req.query.base) });
    await audit(req, { entity: 'sod_rule', entityId: 'workbook', action: 'export', after: { rules: sheets[0].rows.length, conflicts: sheets[1].rows.length } });
    return sendSheets(res, { title: 'Segregation of duties', fileBase: 'segregation-of-duties', format: format(req.query), sheets, ctx });
  },
});
define({
  method: 'POST', path: '/sod-rules', summary: 'Request a new segregation-of-duties rule (reason of context access_change; the code is given by the server unless sent); it applies once another administrator approves it',
  screen: `${S} > Segregation of Duties`, middleware: [...write, validate(SOD.required({ name: true, action: true }))],
  request: { name: 'Cheque encoding and reversals', roleA: 'tis-ccd-pdu', roleB: 'tis-ccd-recon', action: 'warn', reason: 'The person who encodes cheques should not reverse them', reasonCode: 'ACC-AUDIT' },
  response: { success: true, data: { change: { ...changeExample, kind: 'sod-rule', kindLabel: 'Segregation of duties rule' } } },
  handler: async (req, res) => sodAnswer(req, res, await withTransaction((db) => sod.requestSodRule(db, req.body, null, req.user)), 'Rule added'),
});
define({
  method: 'PUT', path: '/sod-rules/:id', summary: 'Request a change of a segregation-of-duties rule, or switch it off or on with active (reason of context access_change)', screen: `${S} > Segregation of Duties`,
  middleware: [...write, validate(SOD)], request: { action: 'block', reasonCode: 'ACC-AUDIT' },
  response: { success: true, data: { change: { ...changeExample, kind: 'sod-rule', kindLabel: 'Segregation of duties rule' } } },
  handler: async (req, res) => sodAnswer(req, res, await withTransaction((db) => sod.requestSodRule(db, req.body, req.params.id, req.user)), 'Rule saved'),
});
define({
  method: 'DELETE', path: '/sod-rules/:id', summary: 'Request to switch a segregation-of-duties rule off (reason of context access_change in the body; the rule is kept for the record)',
  screen: `${S} > Segregation of Duties`, middleware: [...write, validate(z.object(reasonBody))], request: { reasonCode: 'ACC-NOTNEEDED' },
  response: { success: true, data: { change: { ...changeExample, kind: 'sod-rule', kindLabel: 'Segregation of duties rule' } } },
  handler: async (req, res) => sodAnswer(req, res, await withTransaction((db) => sod.requestSodRule(db, { ...req.body, active: false }, req.params.id, req.user)), 'Rule switched off'),
});
define({
  method: 'POST', path: '/sod-rules/check', summary: 'What a rule would do: the active users who hold both sides today', screen: `${S} > Segregation of Duties`,
  middleware: [...read, validate(z.object({ kind: z.enum(['roles', 'access']).optional(), roleA: z.string().nullable().optional(), roleB: z.string().nullable().optional(),
    accessA: z.array(z.string()).max(100).optional(), accessB: z.array(z.string()).max(100).optional() }))],
  request: { roleA: 'tis-ccd-bp', roleB: 'tis-ccd-recon' }, response: { success: true, data: { users: 2, names: ['Gene Kelly Jaen', 'Marta Loi Dapula'] } },
  handler: async (req, res) => ok(res, await sod.checkSodRule(pool, req.body)),
});
define({
  method: 'GET', path: '/sod-conflicts', summary: 'Segregation-of-duties conflicts by user: every user (active by default, ?status=all) breaking an active rule, with the state of the conflict (open, accepted with its exception, waiting for approval, expired) (?userId, ruleId)',
  screen: `${S} > Segregation of Duties`, middleware: read, query: { status: 'active', ruleId: 6 },
  response: { success: true, data: { asOf: '2026-10-10', rows: [{ key: '6:usr_9', ruleId: 6, ruleName: 'Receipting and reversals', action: 'warn', userId: 'usr_9',
    userName: 'Gene Kelly Jaen', department: 'Cash Control', heldTogether: ['CCD-BP / QRPh (Receipting)', 'CCD-Recon'], state: 'open', exception: null, change: null,
    canRequest: true, canEnd: false }] } },
  handler: async (req, res) => ok(res, await sod.sodConflictList(pool, { status: req.query.status === 'all' ? 'all' : 'active', userId: req.query.userId || null,
    ruleId: req.query.ruleId || null }, req.user)),
});
define({
  method: 'POST', path: '/sod-exceptions', summary: 'Request an exception for a conflict (one person, one rule) until a date, with a reason of context sod_exception; it applies once another administrator approves it, who is not the person concerned. Not for oneself',
  screen: `${S} > Segregation of Duties`, middleware: [...write, validate(z.object({ ruleId: z.coerce.number().int(), userId: z.string().max(80), validUntil: date, ...reasonBody }))],
  request: { ruleId: 6, userId: 'usr_9', validUntil: '2027-03-31', reasonCode: 'SXE-REVIEWED', note: 'Reversals reviewed weekly by the Finance head' },
  response: { success: true, data: { change: { ...changeExample, kind: 'sod-exception', kindLabel: 'Segregation of duties exception' } } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => sod.requestSodException(db, req.body, req.user));
    if (r.change) {
      await audit(req, { entity: 'accounting_config_change', entityId: r.change.id, action: 'request', after: r.change });
      await changes.askAccessApproval(r.change, req.user);
      return created(res, r, `Exception ${r.change.ref} sent for approval; it applies once another administrator approves it`);
    }
    await audit(req, { entity: 'sod_exception', entityId: String(r.exception.id), action: 'create', after: r.exception });
    return created(res, r, 'Exception recorded');
  },
});
define({
  method: 'POST', path: '/sod-exceptions/:id/end', summary: 'End an exception in force; the conflict is open again at once', screen: `${S} > Segregation of Duties`, middleware: write,
  response: { success: true, data: { id: 3, status: 'ended' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => sod.endSodException(db, req.params.id, req.user));
    await audit(req, { entity: 'sod_exception', entityId: req.params.id, action: 'end', after: r });
    ok(res, r, 'Exception ended');
  },
});
define({
  method: 'POST', path: '/sod-check', summary: 'Rules a set of roles would break (the user form before saving); with userId, the warnings say when an exception is in force',
  screen: `${S} > User`, middleware: [requireAuth, requirePermission('write:users', 'read:access-control'), validate(z.object({ roles: z.array(z.string()), userId: z.string().max(80).optional() }))],
  request: { roles: ['processing', 'accounting'] }, response: { success: true, data: [{ name: 'Placement and payment', action: 'block', exceptionUntil: null }] },
  handler: async (req, res) => {
    const found = await svc.sodConflicts(pool, req.body.roles);
    const day = await today();
    const accepted = req.body.userId ? (await sod.listExceptions(pool, { status: 'active', userId: req.body.userId })).filter((e) => e.validUntil >= day) : [];
    ok(res, found.map((r) => ({ ...r, exceptionUntil: accepted.find((e) => e.ruleId === Number(r.id))?.validUntil || null })));
  },
});

// ---------- access reviews ----------
const scopeSchema = z.object({ kind: z.enum(['all', 'departments', 'roles']).default('all'), departments: z.array(z.string().max(120)).max(50).optional(),
  roles: z.array(z.string().max(80)).max(100).optional() });
const reviewExample = { id: 3, name: 'Access review Q3 FY2026', scopeText: 'All active users', dueDate: '2026-10-24', status: 'open', overdue: false, users: 17, pending: 5, kept: 10,
  removeRoles: 1, deactivate: 1, removals: 2, applied: 0, createdBy: 'IT administrator' };
define({
  method: 'GET', path: '/reviews', summary: 'Access reviews with scope, progress, removals and the overdue state (?format=xlsx|csv for audit)', screen: `${S} > Access Reviews`, middleware: read,
  query: { format: 'xlsx' }, response: { success: true, data: [reviewExample] },
  handler: async (req, res) => {
    if (!req.query.format) return ok(res, await reviews.listReviews(pool));
    const ctx = await printContext();
    return sendSheets(res, { title: 'Access reviews', fileBase: 'access-reviews', format: format(req.query), sheets: await reviews.reviewListSheets(pool, ctx.format), ctx });
  },
});
define({
  method: 'POST', path: '/reviews/preview', summary: 'How many active users a scope reviews', screen: `${S} > Access Reviews > Start a review`,
  middleware: [...read, validate(scopeSchema)], request: { kind: 'departments', departments: ['Cash Control'] },
  response: { success: true, data: { users: 4, scopeText: 'Cash Control' } },
  handler: async (req, res) => ok(res, await reviews.previewReview(pool, req.body)),
});
define({
  method: 'POST', path: '/reviews', summary: 'Start an access review of the active users of a scope (all, departments or roles); due date today or later', screen: `${S} > Access Reviews`,
  middleware: [...write, validate(z.object({ name: z.string().min(3).max(120), dueDate: date, scope: scopeSchema.optional() }))],
  request: { name: 'Access review Q3 FY2026', dueDate: '2026-10-24', scope: { kind: 'all' } }, response: { success: true, data: { ...reviewExample, items: [] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => reviews.startReview(db, req.body, req.user));
    await audit(req, { entity: 'access_review', entityId: String(r.id), action: 'start', after: { name: r.name, scope: r.scope, users: r.items.length, dueDate: r.dueDate } });
    // the users are decided with write:access-control (not by the person reviewed)
    await notifyApprovers({ audience: 'write:access-control', document: 'Access review', number: r.name, by: req.user.username, title: `Access review ${r.name} awaiting decisions`,
      message: `${req.user.username} started ${r.name} (${r.scopeText}): ${countOf(r.items.length, 'user')} to decide by ${formatDate(r.dueDate)}`,
      link: `${reviews.REVIEWS_PATH}?review=${r.id}`, entity: 'access_review', entityId: r.id });
    created(res, r, `Access review started for ${countOf(r.items.length, 'user')}`);
  },
});
define({
  method: 'GET', path: '/reviews/:id', summary: 'One access review with every user, outcome and removal state and the sign-off waiting for approval (?format=xlsx|csv: Summary and Users, &technical=1 adds the role codes)',
  screen: `${S} > Access Reviews`, middleware: read,
  response: { success: true, data: { ...reviewExample, canSubmit: false, items: [{ id: 41, displayName: 'Wendy Siading', department: 'Cash Control', roleNamesAtStart: ['CCD-Recon'],
    decision: 'remove-roles', removeRoleNames: ['CCD-Recon'], remarks: 'Moved to another job or department', removalState: 'waiting', blocked: null, canDecide: true }] } },
  handler: async (req, res) => {
    if (!req.query.format) return ok(res, await reviews.getReview(pool, req.params.id, req.user));
    const ctx = await printContext();
    const sheets = await reviews.reviewSheets(pool, req.params.id, req.user, ctx.format, { technical: technicalOf(req) });
    await audit(req, { entity: 'access_review', entityId: req.params.id, action: 'export', after: { rows: sheets[1].rows.length } });
    return sendSheets(res, { title: `Access review ${sheets[0].rows[0][1]}`, fileBase: `access-review-${req.params.id}`, format: format(req.query), sheets, ctx });
  },
});
define({
  method: 'POST', path: '/reviews/:id/items/keep', summary: 'Keep several users at once (optional note); lines that need a note or may not be decided by this user are left out and named',
  screen: `${S} > Access Reviews`, middleware: [...write, validate(z.object({ itemIds: z.array(z.coerce.number().int()).min(1).max(1000), note: z.string().max(1000).optional() }))],
  request: { itemIds: [41, 42] }, response: { success: true, data: { kept: ['Wendy Siading'], skipped: [{ name: 'Gene Kelly Jaen', reason: 'The user has a segregation-of-duties conflict without an exception' }] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => reviews.keepReviewItems(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'access_review_item', entityId: `AR-${req.params.id}`, action: 'keep', after: { kept: r.kept, skipped: r.skipped, note: req.body.note || null } });
    ok(res, r, `${countOf(r.kept.length, 'user')} kept${r.skipped.length ? `; ${r.skipped.length} left out` : ''}`);
  },
});
define({
  method: 'POST', path: '/reviews/:id/items/:itemId', summary: 'Decide one user: keep access, remove roles or deactivate the account (reason of context access_review for a removal; a note for keeping a dormant user or one with an open conflict). The earlier decision revoke means deactivate',
  screen: `${S} > Access Reviews`,
  middleware: [...write, validate(z.object({ outcome: z.enum(['keep', 'remove-roles', 'deactivate']).optional(), decision: z.enum(['keep', 'revoke']).optional(),
    removeRoles: z.array(z.string().max(80)).max(50).optional(), remarks: z.string().max(1000).optional(), ...reasonBody }))],
  request: { outcome: 'remove-roles', removeRoles: ['tis-ccd-recon'], reasonCode: 'ARV-MOVED' }, response: { success: true, data: { ...reviewExample, items: [] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => reviews.decideReviewItem(db, req.params.id, req.params.itemId, req.body, req.user));
    const item = r.review.items.find((i) => i.id === Number(req.params.itemId));
    await audit(req, { entity: 'access_review_item', entityId: req.params.itemId, action: r.outcome, before: r.before,
      after: { outcome: r.outcome, removeRoles: item?.removeRoles, reason: item?.remarks, applied: !!item?.appliedAt } });
    ok(res, r.review, `${reviews.OUTCOME_WORDS[r.outcome]}: ${item?.displayName || ''}${item?.appliedAt ? ' (applied)' : ''}`);
  },
});
define({
  method: 'POST', path: '/reviews/:id/submit', summary: 'Submit a review whose users are all decided for sign-off by another administrator; its removals apply at sign-off',
  screen: `${S} > Access Reviews`, middleware: write, response: { success: true, data: { review: { ...reviewExample, status: 'awaiting-signoff' }, change: { ...changeExample, kind: 'access-review' } } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => reviews.submitReview(db, req.params.id, req.user));
    await audit(req, { entity: 'access_review', entityId: req.params.id, action: 'submit', after: r.change });
    await changes.askAccessApproval(r.change, req.user);
    created(res, r, `Access review sent for sign-off (${r.change.ref})`);
  },
});
define({
  method: 'POST', path: '/reviews/:id/close', summary: 'Close a review once every user is decided (only with access.change_approval off; otherwise the sign-off closes it)', screen: `${S} > Access Reviews`,
  middleware: write, response: { success: true, data: { ...reviewExample, status: 'closed' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => reviews.closeReview(db, req.params.id, req.user));
    await audit(req, { entity: 'access_review', entityId: req.params.id, action: 'close', after: { removals: r.removals, applied: r.applied } });
    ok(res, r, 'Access review closed');
  },
});

// ---------- sessions ----------
define({
  method: 'POST', path: '/users/:id/sign-out', summary: 'End every session of a user (lost device, suspected misuse, role change); an administrator account only by a System Administrator', screen: `${S} > User`,
  middleware: [requireAuth, requirePermission('write:users')], response: { success: true, data: { userId: 'usr_1', signedOut: true } },
  handler: async (req, res) => {
    const r = await svc.signOutEverywhere(pool, req.params.id, req.user);
    await audit(req, { entity: 'user', entityId: req.params.id, action: 'sign-out', after: r });
    ok(res, r, `${r.username} is signed out on every device`);
  },
});

export default router;
export const mount = '/access-control';
