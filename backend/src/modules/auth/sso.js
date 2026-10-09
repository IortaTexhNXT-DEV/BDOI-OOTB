/**
 * Microsoft Entra ID accounts and BrokerVerse users (sign-in with Microsoft, lib/entraId.js). Users are provisioned in
 * User Management (or from Entra ID by the administrators); a Microsoft account is matched to the user whose e-mail
 * address or user ID equals its e-mail or user principal name, then bound to that user (users.sso_subject) so later
 * sign-ins must come from the same account. Nothing is created unless security.sso_register_users is on, and then
 * only as an inactive user without roles.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { loadUser } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { audit } from '../../lib/audit.js';
import { entraConfigured } from '../../config.js';
import { many, one, query } from '../../db/pool.js';

/** Is the user ID and password sign-in offered (security.password_sign_in_enabled; always when Entra ID is not configured)? */
export async function passwordSignInEnabled() {
  if (!entraConfigured()) return true;
  return (await getSetting('security.password_sign_in_enabled', true)) !== false;
}

/** May this user sign in with a password: password sign-in on, or one of the roles in security.password_sign_in_roles. */
export async function passwordSignInAllowed(user) {
  if (await passwordSignInEnabled()) return true;
  const roles = (await getSetting('security.password_sign_in_roles', [])) || [];
  return Array.isArray(roles) && (user?.roles || []).some((r) => roles.includes(r));
}

/**
 * The BrokerVerse user of a Microsoft identity ({ subject, addresses, name } from identityOf). Answers { user } or
 * { reason } when there is none: 'unknown' (no match), 'ambiguous' (several users match), 'other-account' (the user is
 * bound to another Microsoft account), 'registered' (just registered as an inactive user).
 */
export async function resolveSsoUser(identity, req) {
  const bound = await one('SELECT id FROM users WHERE sso_subject = $1', [identity.subject]);
  if (bound) return { user: await loadUser('u.id = $1', [bound.id]) };
  if (!identity.addresses.length) return { reason: 'unknown' };
  const matches = await many('SELECT id, sso_subject FROM users WHERE lower(email) = ANY($1::text[]) OR lower(username) = ANY($1::text[])', [identity.addresses]);
  if (matches.length > 1) return { reason: 'ambiguous' };
  if (matches.length === 1) {
    const m = matches[0];
    if (m.sso_subject && m.sso_subject !== identity.subject) return { reason: 'other-account' };
    if (!m.sso_subject) {
      await query('UPDATE users SET sso_subject = $2 WHERE id = $1 AND sso_subject IS NULL', [m.id, identity.subject]);
      await audit({ user: { id: m.id }, ip: req.ip }, { entity: 'user', entityId: m.id, action: 'sso-link', after: { account: identity.addresses[0] } });
    }
    return { user: await loadUser('u.id = $1', [m.id]) };
  }
  if ((await getSetting('security.sso_register_users', false)) !== true) return { reason: 'unknown' };
  return registerSsoUser(identity, req);
}

/** Register an unknown Microsoft account as an inactive user without roles (no usable password). */
async function registerSsoUser(identity, req) {
  const username = identity.addresses[0];
  const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const r = await query(`INSERT INTO users(username, password_hash, display_name, email, status, sso_subject, created_by)
    VALUES ($1,$2,$3,$4,'inactive',$5,'entra-id') ON CONFLICT (username) DO NOTHING RETURNING id`,
  [username, hash, identity.name || username, username, identity.subject]);
  if (!r.rowCount) return { reason: 'ambiguous' };
  await audit({ user: { id: r.rows[0].id, username }, ip: req.ip }, { entity: 'user', entityId: r.rows[0].id, action: 'sso-register', after: { username, displayName: identity.name || username } });
  return { reason: 'registered' };
}
