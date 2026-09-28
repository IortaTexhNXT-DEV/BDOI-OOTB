import bcrypt from 'bcryptjs';
import { moduleRouter } from '../../lib/registry.js';
import { loadUser, publicUser, requireAuth, requireRole } from '../../lib/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { validate, z } from '../../lib/validate.js';
import { many, one, query, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { assertPasswordAllowed, recordHistory, savePassword } from '../../lib/password.js';
import { loginHistory } from '../../lib/loginHistory.js';

const { router, define } = moduleRouter('User Management', '/users');
const admin = [requireAuth, requireRole('it-admin', 'ba')];

const userRow = (u) => ({
  ...publicUser(u), firstName: u.first_name, lastName: u.last_name, phone: u.phone, employeeCode: u.employee_code,
  branchCode: u.branch_code, department: u.department, designation: u.designation, reportingTo: u.reporting_to,
  mustChangePassword: u.must_change_password, passwordChangedAt: u.password_changed_at, createdAt: u.created_at, updatedAt: u.updated_at,
});
const listSql = `SELECT u.*,
  COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS roles,
  '{}'::text[] AS permissions FROM users u`;

const userSchema = z.object({
  username: z.string().min(3), password: z.string().min(1).optional(), displayName: z.string().min(1).optional(),
  firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(), employeeCode: z.string().optional(), branchCode: z.string().optional(), department: z.string().optional(),
  designation: z.string().optional(), reportingTo: z.string().optional(), status: z.enum(['active', 'inactive', 'locked']).optional(),
  roles: z.array(z.string()).min(1), mustChangePassword: z.boolean().optional(),
});

async function setRoles(client, userId, codes) {
  const rows = (await client.query('SELECT id, code FROM roles WHERE code = ANY($1)', [codes])).rows;
  if (rows.length !== codes.length) throw badRequest(`Unknown role(s): ${codes.filter((c) => !rows.find((r) => r.code === c)).join(', ')}`);
  await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  for (const r of rows) await client.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1,$2)', [userId, r.id]);
}

define({
  method: 'GET', path: '/', summary: 'List users (search, role, status, paging)', screen: 'Master > User Management > User', middleware: admin,
  query: { search: 'juan', role: 'sales', status: 'active', page: 1, perPage: 10 },
  response: { success: true, data: [{ userId: 'usr_1', username: 'juan.santos', displayName: 'Juan Santos', roles: ['agent'], status: 'active' }], total: 1, page: 1, perPage: 10 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { search, role, status } = req.query;
    const where = ['($1::text IS NULL OR u.username ILIKE \'%\' || $1 || \'%\' OR u.display_name ILIKE \'%\' || $1 || \'%\' OR u.email ILIKE \'%\' || $1 || \'%\')',
      '($2::text IS NULL OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = $2))', '($3::text IS NULL OR u.status = $3)'].join(' AND ');
    const params = [search || null, role || null, status || null];
    const total = (await one(`SELECT count(*)::int AS n FROM users u WHERE ${where}`, params)).n;
    const rows = await many(`${listSql} WHERE ${where} ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`, [...params, pg.limit, pg.offset]);
    const meta = pageMeta(total, pg);
    res.json({ success: true, data: rows.map(userRow), pagination: { page: pg.page, pageSize: pg.perPage, limit: pg.perPage, total, totalPages: meta.totalPages }, total, page: pg.page, perPage: pg.perPage });
  },
});
define({
  method: 'GET', path: '/stats', summary: 'User counts (total, active, by role)', screen: 'Master > User Management > User', middleware: admin,
  response: { success: true, data: { totalUsers: 12, activeUsers: 11, byRole: { sales: 3 } } },
  handler: async (_req, res) => {
    const t = await one("SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'active')::int AS active FROM users");
    const by = await many('SELECT r.code, count(ur.user_id)::int AS n FROM roles r LEFT JOIN user_roles ur ON ur.role_id = r.id GROUP BY r.code');
    ok(res, { totalUsers: t.total, activeUsers: t.active, byRole: Object.fromEntries(by.map((b) => [b.code, b.n])) });
  },
});
define({
  method: 'POST', path: '/:id/password', summary: 'Set a user password (administrator; password policy and history apply)', screen: 'Master > User Management > User > Edit', middleware: [...admin, validate(z.object({ password: z.string().min(1) }))],
  request: { password: 'Welcome@123' }, response: { success: true, data: { userId: 'usr_1' } },
  handler: async (req, res) => {
    if (!(await one('SELECT 1 FROM users WHERE id = $1', [req.params.id]))) throw notFound('User not found');
    await assertPasswordAllowed(req.body.password, { userId: req.params.id });
    await savePassword(req.params.id, req.body.password, { extraSql: "failed_logins = 0, status = CASE WHEN status = 'locked' THEN 'active' ELSE status END" });
    await audit(req, { entity: 'user', entityId: req.params.id, action: 'set-password' });
    ok(res, { userId: req.params.id }, 'Password updated');
  },
});
define({
  method: 'GET', path: '/:id/login-history', summary: 'Sign-in history of a user (success, from, to; paging)', screen: 'Master > User Management > User > View > Sign-in history', middleware: admin,
  query: { page: 1, perPage: 20, success: 'false', from: '2026-09-01', to: '2026-09-30' },
  response: { success: true, data: [{ id: 1, at: '2026-09-28T01:00:00Z', userId: 'usr_1', username: 'juan.santos', ip: '10.0.0.5', userAgent: 'Mozilla/5.0', success: false, reason: 'bad-password', method: 'password' }], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const u = await one('SELECT id FROM users WHERE id = $1 OR username = $1', [req.params.id]);
    if (!u) throw notFound('User not found');
    const r = await loginHistory(u.id, req.query);
    res.json({ success: true, data: r.items, total: r.total, page: r.page, perPage: r.perPage, totalPages: r.totalPages });
  },
});
define({
  method: 'POST', path: '/:id/2fa/reset', summary: 'Administrator turns off a user\'s two-factor authentication (lost device); the user enrols again', screen: 'Master > User Management > User > Edit',
  middleware: admin, response: { success: true, data: { userId: 'usr_1', twoFactorEnabled: false } },
  handler: async (req, res) => {
    const r = await query('UPDATE users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled = false, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rowCount) throw notFound('User not found');
    await audit(req, { entity: 'user', entityId: req.params.id, action: '2fa-reset' });
    ok(res, { userId: req.params.id, twoFactorEnabled: false }, 'Two-factor authentication reset');
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Get one user', screen: 'Master > User Management > User > View', middleware: admin,
  response: { success: true, data: { userId: 'usr_1', username: 'juan.santos', roles: ['agent'] } },
  handler: async (req, res) => {
    const u = await loadUser('u.id = $1 OR u.username = $1', [req.params.id]);
    if (!u) throw notFound('User not found');
    ok(res, userRow(u));
  },
});
define({
  method: 'POST', path: '/', summary: 'Create a user with roles (persona)', screen: 'Master > User Management > User > Add', middleware: [...admin, validate(userSchema)],
  request: { username: 'maria.cruz', password: 'Welcome@1', displayName: 'Maria Cruz', email: 'maria@example.com', roles: ['sales'] },
  response: { success: true, data: { userId: 'usr_2', username: 'maria.cruz', roles: ['sales'] } },
  handler: async (req, res) => {
    const b = req.body;
    if (await one('SELECT 1 FROM users WHERE lower(username) = lower($1)', [b.username])) throw conflict('Username already exists');
    if (b.password) await assertPasswordAllowed(b.password);
    const hash = await bcrypt.hash(b.password || 'Welcome@1', 10);
    const id = await withTransaction(async (c) => {
      const r = await c.query(`INSERT INTO users(username, password_hash, display_name, first_name, last_name, email, phone, employee_code, branch_code, department, designation, reporting_to, status, must_change_password, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [b.username, hash, b.displayName || [b.firstName, b.lastName].filter(Boolean).join(' ') || b.username, b.firstName, b.lastName, b.email || null, b.phone, b.employeeCode, b.branchCode, b.department, b.designation, b.reportingTo, b.status || 'active', b.mustChangePassword ?? !b.password, req.user.username]);
      await setRoles(c, r.rows[0].id, b.roles);
      await recordHistory(r.rows[0].id, hash, c);
      return r.rows[0].id;
    });
    const u = await loadUser('u.id = $1', [id]);
    await audit(req, { entity: 'user', entityId: id, action: 'create', after: { ...b, password: undefined } });
    created(res, userRow(u), 'User created');
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a user and its roles', screen: 'Master > User Management > User > Edit', middleware: [...admin, validate(userSchema.partial())],
  request: { displayName: 'Maria Cruz', roles: ['sales', 'customer-services'], status: 'active' }, response: { success: true },
  handler: async (req, res) => {
    const before = await loadUser('u.id = $1', [req.params.id]);
    if (!before) throw notFound('User not found');
    const b = req.body;
    if (b.password) await assertPasswordAllowed(b.password, { userId: before.id });
    await withTransaction(async (c) => {
      await c.query(`UPDATE users SET display_name = COALESCE($2, display_name), first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name), email = COALESCE($5, email),
        phone = COALESCE($6, phone), employee_code = COALESCE($7, employee_code), branch_code = COALESCE($8, branch_code), department = COALESCE($9, department), designation = COALESCE($10, designation),
        reporting_to = COALESCE($11, reporting_to), status = COALESCE($12, status), must_change_password = COALESCE($13, must_change_password), updated_by = $14 WHERE id = $1`,
        [before.id, b.displayName, b.firstName, b.lastName, b.email || null, b.phone, b.employeeCode, b.branchCode, b.department, b.designation, b.reportingTo, b.status, b.mustChangePassword, req.user.username]);
      if (b.password) await savePassword(before.id, b.password, { db: c });
      if (b.roles) await setRoles(c, before.id, b.roles);
    });
    const after = await loadUser('u.id = $1', [before.id]);
    await audit(req, { entity: 'user', entityId: before.id, action: 'update', before: publicUser(before), after: publicUser(after) });
    ok(res, userRow(after), 'User updated');
  },
});
define({
  method: 'PATCH', path: '/:id/status', summary: 'Activate / deactivate / unlock a user', screen: 'Master > User Management > User', middleware: [...admin, validate(z.object({ status: z.enum(['active', 'inactive', 'locked']) }))],
  request: { status: 'inactive' }, response: { success: true },
  handler: async (req, res) => {
    const r = await query('UPDATE users SET status = $2, failed_logins = 0, updated_by = $3 WHERE id = $1 RETURNING id', [req.params.id, req.body.status, req.user.username]);
    if (!r.rowCount) throw notFound('User not found');
    if (req.body.status !== 'active') await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.params.id]);
    await audit(req, { entity: 'user', entityId: req.params.id, action: 'status', after: req.body });
    ok(res, { userId: req.params.id, status: req.body.status }, 'Status updated');
  },
});
define({
  method: 'POST', path: '/:id/reset-password', summary: 'Administrator resets a user password', screen: 'Master > User Management > User', middleware: [...admin, validate(z.object({ newPassword: z.string().min(1), mustChangePassword: z.boolean().optional() }))],
  request: { newPassword: 'Welcome@1', mustChangePassword: true }, response: { success: true },
  handler: async (req, res) => {
    if (!(await one('SELECT 1 FROM users WHERE id = $1', [req.params.id]))) throw notFound('User not found');
    await assertPasswordAllowed(req.body.newPassword, { userId: req.params.id });
    await savePassword(req.params.id, req.body.newPassword, { extraSql: `must_change_password = ${(req.body.mustChangePassword ?? true) ? 'true' : 'false'}, failed_logins = 0, status = CASE WHEN status = 'locked' THEN 'active' ELSE status END` });
    await audit(req, { entity: 'user', entityId: req.params.id, action: 'admin-reset-password' });
    ok(res, { userId: req.params.id }, 'Password reset');
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Deactivate (soft delete) a user', screen: 'Master > User Management > User', middleware: admin, response: { success: true },
  handler: async (req, res) => {
    if (req.params.id === req.user.id) throw badRequest('You cannot deactivate your own account');
    const r = await query('UPDATE users SET status = \'inactive\', updated_by = $2 WHERE id = $1 RETURNING id', [req.params.id, req.user.username]);
    if (!r.rowCount) throw notFound('User not found');
    await audit(req, { entity: 'user', entityId: req.params.id, action: 'deactivate' });
    ok(res, { userId: req.params.id }, 'User deactivated');
  },
});

// ---- Roles & permissions
const rolesRouter = moduleRouter('User Management', '/roles');
rolesRouter.define({
  method: 'GET', path: '/', summary: 'List roles with their permissions and user counts', screen: 'Master > User Management > Role', middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, code: 'sales', name: 'Sales / Relationship Manager', permissions: ['read:leads'], users: 3 }] },
  handler: async (_req, res) => ok(res, await many(`SELECT r.id, r.code, r.name, r.description, r.is_system AS "isSystem", r.status, r.created_at AS "createdAt",
      COALESCE((SELECT array_agg(p.code ORDER BY p.code) FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id), '{}') AS permissions,
      (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS users FROM roles r ORDER BY r.id`)),
});
rolesRouter.define({
  method: 'GET', path: '/permissions', summary: 'All permission codes grouped by module', screen: 'Master > User Management > Role > Add', middleware: [requireAuth],
  response: { success: true, data: [{ code: 'read:leads', module: 'leads', description: 'View leads' }] },
  handler: async (_req, res) => ok(res, await many('SELECT code, module, description FROM permissions ORDER BY module, code')),
});
const roleSchema = z.object({ code: z.string().min(2).regex(/^[a-z0-9-]+$/), name: z.string().min(1), description: z.string().optional(), permissions: z.array(z.string()).default([]), status: z.enum(['active', 'inactive']).optional() });
async function setPerms(client, roleId, codes) {
  await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  if (codes.length) await client.query('INSERT INTO role_permissions(role_id, permission_id) SELECT $1, id FROM permissions WHERE code = ANY($2)', [roleId, codes]);
}
rolesRouter.define({
  method: 'POST', path: '/', summary: 'Create a role', screen: 'Master > User Management > Role > Add', middleware: [...admin, validate(roleSchema)],
  request: { code: 'branch-manager', name: 'Branch Manager', permissions: ['read:leads', 'read:policies', 'read:reports'] }, response: { success: true, data: { id: 9, code: 'branch-manager' } },
  handler: async (req, res) => {
    const b = req.body;
    if (await one('SELECT 1 FROM roles WHERE code = $1', [b.code])) throw conflict('Role code already exists');
    const id = await withTransaction(async (c) => {
      const r = await c.query('INSERT INTO roles(code, name, description, status) VALUES ($1,$2,$3,$4) RETURNING id', [b.code, b.name, b.description || null, b.status || 'active']);
      await setPerms(c, r.rows[0].id, b.permissions);
      return r.rows[0].id;
    });
    await audit(req, { entity: 'role', entityId: id, action: 'create', after: b });
    created(res, { id, ...b }, 'Role created');
  },
});
rolesRouter.define({
  method: 'PUT', path: '/:id', summary: 'Update a role and its permissions', screen: 'Master > User Management > Role > Edit', middleware: [...admin, validate(roleSchema.partial())],
  request: { name: 'Branch Manager', permissions: ['read:leads'] }, response: { success: true },
  handler: async (req, res) => {
    const role = await one('SELECT * FROM roles WHERE id::text = $1 OR code = $1', [req.params.id]);
    if (!role) throw notFound('Role not found');
    const b = req.body;
    await withTransaction(async (c) => {
      await c.query('UPDATE roles SET name = COALESCE($2, name), description = COALESCE($3, description), status = COALESCE($4, status) WHERE id = $1', [role.id, b.name, b.description, b.status]);
      if (b.permissions) await setPerms(c, role.id, b.permissions);
    });
    await audit(req, { entity: 'role', entityId: role.id, action: 'update', before: role, after: b });
    ok(res, { id: role.id, ...b }, 'Role updated');
  },
});
rolesRouter.define({
  method: 'DELETE', path: '/:id', summary: 'Delete a non-system role with no users', screen: 'Master > User Management > Role', middleware: admin, response: { success: true },
  handler: async (req, res) => {
    const role = await one('SELECT * FROM roles WHERE id::text = $1 OR code = $1', [req.params.id]);
    if (!role) throw notFound('Role not found');
    if (role.is_system) throw badRequest('System roles cannot be deleted');
    if (await one('SELECT 1 FROM user_roles WHERE role_id = $1', [role.id])) throw conflict('Role is assigned to users');
    await query('DELETE FROM roles WHERE id = $1', [role.id]);
    await audit(req, { entity: 'role', entityId: role.id, action: 'delete', before: role });
    ok(res, { id: role.id }, 'Role deleted');
  },
});

export default router;
export const mount = '/users';
export const extraMounts = [['/roles', rolesRouter.router]];
