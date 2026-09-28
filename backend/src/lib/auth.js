import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db/pool.js';
import { forbidden, unauthorized } from './errors.js';

export const signAccess = (user) => jwt.sign(
  { sub: user.id, username: user.username, roles: user.roles, permissions: user.permissions, type: 'access' },
  config.jwtSecret, { expiresIn: config.accessTtl },
);
export const signRefresh = (user, jti) => jwt.sign({ sub: user.id, jti, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshTtl });
export const verify = (token) => jwt.verify(token, config.jwtSecret);

/** Load a user with its roles and permissions (null if missing). */
export async function loadUser(where, params) {
  return one(`
    SELECT u.id, u.username, u.display_name, u.email, u.status, u.password_hash, u.last_login_at, u.must_change_password,
           u.first_name, u.last_name, u.phone, u.branch_code, u.employee_code,
           COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS roles,
           COALESCE((SELECT array_agg(DISTINCT p.code ORDER BY p.code) FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = u.id), '{}') AS permissions
    FROM users u WHERE ${where}`, params);
}

/** Shape returned to the front end (matches the login payload it expects). */
export const publicUser = (u) => ({
  userId: u.id, username: u.username, displayName: u.display_name, email: u.email,
  roles: u.roles, permissions: u.permissions, lastLoginAt: u.last_login_at, status: u.status,
});

/** Require a valid bearer token; attaches req.user = {id, username, roles, permissions}. */
export function requireAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(unauthorized('Missing bearer token'));
  try {
    const p = verify(token);
    if (p.type !== 'access') throw new Error('wrong token type');
    req.user = { id: p.sub, username: p.username, roles: p.roles || [], permissions: p.permissions || [] };
    return next();
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }
}

const ADMIN_ROLES = ['it-admin', 'ba'];
/** Require one of the given roles (admin roles always pass). */
export const requireRole = (...roles) => (req, _res, next) => {
  const mine = req.user?.roles || [];
  if (mine.some((r) => ADMIN_ROLES.includes(r) || roles.includes(r))) return next();
  return next(forbidden(`Requires role: ${roles.join(' or ')}`));
};
/** Require a permission code such as write:leads (admin roles always pass). */
export const requirePermission = (...perms) => (req, _res, next) => {
  const mine = req.user || { roles: [], permissions: [] };
  if (mine.roles.some((r) => ADMIN_ROLES.includes(r)) || perms.some((p) => mine.permissions.includes(p))) return next();
  return next(forbidden(`Requires permission: ${perms.join(' or ')}`));
};
