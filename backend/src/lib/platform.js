/**
 * The iorta TechNXT platform administrator: the vendor role that decides which releases of the platform an environment
 * runs (Master > Platform > Features & Releases). It is apart from every role of the tenant:
 *   - only this role holds the vendor permissions; the administrator role of the tenant (and SUPERID through it) does
 *     not, whatever its full access elsewhere (requirePlatformAdmin never lets an administrator through);
 *   - the vendor permissions are never offered on Role Permissions, never granted by a role change or the Role form;
 *   - the role is never assigned from User Management or the go-live workbook, and a platform account is changed only
 *     by another platform administrator;
 *   - the role holds no business permission: it reaches no transaction and no client data;
 *   - two-factor authentication is always required (whatever security.require_2fa_roles says).
 * The first account comes from the environment (PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD; db/seed.js).
 */
import { forbidden } from './errors.js';

export const PLATFORM_ROLE = 'iorta-platform-admin';
export const MANAGE_FEATURES = 'manage:feature-entitlements';
/** Permissions only the platform role may hold. */
export const PLATFORM_PERMISSIONS = Object.freeze([MANAGE_FEATURES]);

export const isPlatformPermission = (code) => PLATFORM_PERMISSIONS.includes(code);
export const isPlatformAdmin = (user) => !!user && (user.roles || []).includes(PLATFORM_ROLE) && (user.permissions || []).includes(MANAGE_FEATURES);

/** Require the platform administrator. No bypass for the administrator role of the tenant. */
export const requirePlatformAdmin = (() => {
  const mw = (req, _res, next) => (isPlatformAdmin(req.user) ? next() : next(forbidden('Requires the iorta TechNXT platform administrator')));
  mw.roles = [PLATFORM_ROLE];
  mw.permissions = [MANAGE_FEATURES];
  return mw;
})();

/** Refuse a grant of a vendor permission to a role of the tenant. */
export function assertNoPlatformGrant(codes) {
  const bad = (codes || []).filter(isPlatformPermission);
  if (bad.length) throw forbidden('Platform permissions are held only by the iorta TechNXT platform administrator and cannot be granted to a role');
}

/** Refuse an assignment of the platform role from the screens of the tenant. */
export function assertNoPlatformRole(codes) {
  if ((codes || []).includes(PLATFORM_ROLE)) throw forbidden('The iorta TechNXT platform administrator role is not assigned from User Management');
}

/** Refuse a change of a platform account by anyone but another platform administrator. */
export function assertCanChangeAccount(actor, targetRoles) {
  if ((targetRoles || []).includes(PLATFORM_ROLE) && !isPlatformAdmin(actor)) throw forbidden('A platform administrator account is changed only by the iorta TechNXT platform administrator');
}
