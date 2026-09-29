import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one, query } from '../db/pool.js';
import { forbidden, unauthorized } from './errors.js';

/**
 * Access token. `restrict` marks a restricted token: 'enrol2fa' only reaches the two-factor enrolment endpoints,
 * 'pwchange' only reaches change-password (the password must be changed first). `tv` is the user's token version:
 * raising users.token_version (password change or reset, deactivation, role change) invalidates every access token
 * issued before.
 */
export const signAccess = (user, { restrict = null, expiresIn = config.accessTtl } = {}) => jwt.sign(
  { sub: user.id, username: user.username, roles: user.roles, permissions: user.permissions, type: 'access', tv: Number(user.token_version || 0), ...(restrict ? { restrict } : {}) },
  config.jwtSecret, { expiresIn, algorithm: 'HS256' },
);
export const signRefresh = (user, jti) => jwt.sign({ sub: user.id, jti, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshTtl, algorithm: 'HS256' });
/** Sign any other short-lived token with the same secret (the `type` claim keeps the kinds apart). */
export const signToken = (payload, options = {}) => jwt.sign(payload, config.jwtSecret, { ...options, algorithm: 'HS256' });
/** Verify a token; only HS256 is accepted. */
export const verify = (token) => jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });

/**
 * Invalidate every access token of the user (token_version + 1) and, with `refresh`, every refresh token as well.
 * Used on password change / reset, deactivation, role and permission changes.
 */
export async function revokeSessions(userId, { refresh = false, db = { query } } = {}) {
  await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
  if (refresh) await db.query("UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'revoked' WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}

/** Load a user with its roles and permissions (null if missing). */
export async function loadUser(where, params) {
  return one(`
    SELECT u.id, u.username, u.display_name, u.email, u.status, u.password_hash, u.last_login_at, u.must_change_password, u.password_changed_at,
           u.totp_enabled, u.totp_secret, u.totp_pending_secret, u.totp_last_step, u.token_version,
           u.first_name, u.last_name, u.phone, u.branch_code, u.employee_code,
           -- effective roles: assigned roles plus the roles they inherit (roles.inherits)
           COALESCE((SELECT array_agg(DISTINCT er.code ORDER BY er.code) FROM user_effective_roles(u.id) er), '{}') AS roles,
           COALESCE((SELECT array_agg(DISTINCT p.code ORDER BY p.code) FROM user_effective_roles(u.id) er JOIN role_permissions rp ON rp.role_id = er.role_id JOIN permissions p ON p.id = rp.permission_id), '{}') AS permissions
    FROM users u WHERE ${where}`, params);
}

/** Shape returned to the front end (matches the login payload it expects). */
export const publicUser = (u) => ({
  userId: u.id, username: u.username, displayName: u.display_name, email: u.email,
  roles: u.roles, permissions: u.permissions, lastLoginAt: u.last_login_at, status: u.status,
  mustChangePassword: !!u.must_change_password, twoFactorEnabled: !!u.totp_enabled,
});

/** Paths a restricted token may call. */
const RESTRICTED_PATHS = {
  enrol2fa: /^\/api\/auth\/(2fa(\/|$|\?)|profile(\?|$)|logout|password-policy)/,
  pwchange: /^\/api\/auth\/(change-password|profile(\?|$)|logout|password-policy)/,
};
const RESTRICTED_MESSAGE = {
  enrol2fa: 'Two-factor authentication must be set up before using the application',
  pwchange: 'Your password must be changed before using the application',
};

const bearerToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

/**
 * Check the bearer token of a request: signature (HS256 only), token type, and that the user still exists, is active
 * and has the same token version. Returns the req.user object; throws 401 (or 403 for a restricted token used
 * outside its paths).
 */
export async function authenticate(req) {
  const token = bearerToken(req);
  if (!token) throw unauthorized('Missing bearer token');
  let p;
  try {
    p = verify(token);
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  if (p.type !== 'access') throw unauthorized('Invalid or expired token');
  const row = await one('SELECT status, token_version FROM users WHERE id = $1', [p.sub]);
  if (!row || row.status !== 'active' || Number(row.token_version) !== Number(p.tv || 0)) throw unauthorized('Session ended; sign in again');
  const restrict = p.restrict || (p.enrol2fa ? 'enrol2fa' : null);
  const user = {
    id: p.sub, username: p.username, roles: p.roles || [], permissions: p.permissions || [],
    restrict, enrol2fa: restrict === 'enrol2fa', pwchange: restrict === 'pwchange',
  };
  if (restrict && !RESTRICTED_PATHS[restrict]?.test(req.originalUrl || '')) throw forbidden(RESTRICTED_MESSAGE[restrict] || 'Restricted session');
  return user;
}

/** Require a valid bearer token; attaches req.user = {id, username, roles, permissions, restrict}. */
export async function requireAuth(req, _res, next) {
  try {
    req.user = await authenticate(req);
    return next();
  } catch (e) {
    return next(e);
  }
}

/**
 * The administrator role(s): the System Administrator (Super Admin Access) holds every permission, passes every role
 * check and is the only role that may grant the administrator role. The single place that names it: code elsewhere uses
 * isAdmin / ADMIN_ROLES / ADMIN_ROLE rather than repeating the code.
 */
export const ADMIN_ROLE = 'system-admin';
export const ADMIN_ROLES = Object.freeze([ADMIN_ROLE]);
export const isAdmin = (user) => !!user && (user.roles || []).some((r) => ADMIN_ROLES.includes(r));
/** Does the user hold the permission (administrator roles hold every permission)? */
export const hasPermission = (user, perm) => isAdmin(user) || (user?.permissions || []).includes(perm);

/** Require one of the given roles (admin roles always pass). The roles are recorded in the route registry. */
export const requireRole = (...roles) => {
  const mw = (req, _res, next) => {
    const mine = req.user?.roles || [];
    if (mine.some((r) => ADMIN_ROLES.includes(r) || roles.includes(r))) return next();
    return next(forbidden(`Requires role: ${roles.join(' or ')}`));
  };
  mw.roles = roles;
  return mw;
};
/** Require a permission code such as write:leads (admin roles always pass). The codes are recorded in the route registry. */
export const requirePermission = (...perms) => {
  const mw = (req, _res, next) => {
    const mine = req.user || { roles: [], permissions: [] };
    if (isAdmin(mine) || perms.some((p) => mine.permissions.includes(p))) return next();
    return next(forbidden(`Requires permission: ${perms.join(' or ')}`));
  };
  mw.permissions = perms;
  return mw;
};
