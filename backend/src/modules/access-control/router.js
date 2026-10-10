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
import { mapColumns, parseUploadedRows, sendTable, uploadFile } from '../documents/tabular.js';
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
      reason: approved ? null : c.decisionRemarks, message: approved ? `${changes.appliedText(c)}, approved by ${req.user.username}`.replace(/^./, (x) => x.toUpperCase()) : null,
      link: c.link, entity: 'accounting_config_change', entityId: c.id });
    ok(res, c, approved ? `Change ${c.ref} approved; ${changes.appliedText(c)}` : `Change ${c.ref} rejected`);
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
async function sendSheets(res, { title, fileBase, sheets, format: fmt }) {
  const name = `${fileBase}-${(await today()).replace(/-/g, '')}`;
  if (fmt === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
    return res.send(toCsv(sheets[0].columns, sheets[0].rows));
  }
  const ctx = await printContext();
  const banner = [ctx.letterhead?.name, title, `As at ${ctx.generatedAt} · exported by ${ctx.generatedBy}`].filter(Boolean);
  const buf = writeXlsx({ title, brand: excelBrand(ctx), sheets: sheets.map((sh, i) => (i === 0 ? { ...sh, banner, logo: true } : sh)) });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
  return res.send(buf);
}
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
      reason: approved ? null : req.body.note || null, message: approved ? `${await limitText(r)}, approved by ${req.user.username}, in effect from ${r.effectiveFrom}` : null,
      link: AUTHORITY, entity: 'authority_limit', entityId: r.id });
    ok(res, r, approved ? `Limit approved; in effect from ${r.effectiveFrom}` : 'Limit rejected');
  },
});
define({
  method: 'DELETE', path: '/authority-limits/:id', summary: 'A proposal waiting for approval: withdraw it (the proposer or an approver). A limit in effect or scheduled: propose its removal (write permission; authority reference in the body), which applies once another administrator approves it',
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
