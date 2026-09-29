import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { moduleRouter } from '../../lib/registry.js';
import { loadUser, publicUser, revokeSessions, signAccess, signRefresh, signToken, verify } from '../../lib/auth.js';
import { badRequest, conflict, forbidden, unauthorized } from '../../lib/errors.js';
import { validate, z } from '../../lib/validate.js';
import { query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { audit } from '../../lib/audit.js';
import { config } from '../../config.js';
import { assertPasswordAllowed, passwordExpired, passwordPolicy, savePassword } from '../../lib/password.js';
import { loginHistory, recordLogin } from '../../lib/loginHistory.js';
import { clearKey, hit, ipKey, isLimited, loginLimits, userKey } from '../../lib/rateLimit.js';
import { generateSecret, otpauthUrl, verifyTotp } from '../../lib/totp.js';
import { decryptSecret, encryptSecret, hashCode, sameHash } from '../../lib/secrets.js';

const { router, define } = moduleRouter('Auth', '/auth');

/** Lifetime of restricted tokens (two-factor enrolment, forced password change). */
const RESTRICTED_TTL = 900;
/**
 * A rotated refresh token presented again within this many seconds is refused without further action (two browser tabs
 * refreshing at the same moment); later it is treated as theft and the whole sign-in family is revoked.
 */
const REUSE_GRACE_SECONDS = 30;
/** bcrypt hash compared for unknown usernames, so the response time does not reveal whether the account exists. */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

async function issueTokens(user, deviceId, familyId = null) {
  const jti = crypto.randomUUID();
  await query('INSERT INTO refresh_tokens(jti, user_id, device_id, family_id, expires_at) VALUES ($1,$2,$3,$4, now() + ($5 || \' seconds\')::interval)',
    [jti, user.id, deviceId || null, familyId || jti, String(config.refreshTtl)]);
  return { jti, accessToken: signAccess(user), refreshToken: signRefresh(user, jti), expiresIn: config.accessTtl, issuedAt: new Date().toISOString(), user: publicUser(user) };
}
const tokenBody = ({ jti: _jti, ...rest }) => rest;

/** Roles that must enrol in two-factor authentication (security.require_2fa_roles). */
async function twoFactorRequiredFor(user) {
  const roles = (await getSetting('security.require_2fa_roles', [])) || [];
  return Array.isArray(roles) && (user.roles || []).some((r) => roles.includes(r));
}

/** Does the user have to change the password before using the application (flag set, or older than the maximum age)? */
async function passwordChangeState(user) {
  const expired = await passwordExpired(user);
  return { required: !!user.must_change_password || expired, expired };
}

/**
 * Finish a sign-in (password, two-factor code or forced enrolment). When the password must be changed, only a
 * restricted token is issued (no refresh token): it reaches /auth/change-password, which then returns the normal
 * payload.
 */
async function completeSignIn(req, user, { deviceId, method }) {
  await query('UPDATE users SET failed_logins = 0, last_login_at = now() WHERE id = $1', [user.id]);
  const change = await passwordChangeState(user);
  if (change.required) {
    await recordLogin(req, { userId: user.id, username: user.username, success: false, reason: change.expired ? 'password-expired' : 'password-change-required', method });
    return {
      success: true, message: change.expired ? 'Your password has expired; choose a new one' : 'Choose a new password to continue',
      passwordChangeRequired: true, mustChangePassword: true, ...(change.expired ? { passwordExpired: true } : {}),
      accessToken: signAccess(user, { restrict: 'pwchange', expiresIn: RESTRICTED_TTL }), expiresIn: RESTRICTED_TTL,
      user: { ...publicUser(user), mustChangePassword: true, ...(change.expired ? { passwordExpired: true } : {}) },
    };
  }
  const tokens = tokenBody(await issueTokens(user, deviceId));
  tokens.mustChangePassword = false;
  await recordLogin(req, { userId: user.id, username: user.username, success: true, reason: 'ok', method });
  await audit({ user: { id: user.id, username: user.username }, ip: req.ip }, { entity: 'session', entityId: user.id, action: 'login' });
  return tokens;
}

/** 429 when the IP or the username has used up its attempts in the window; the attempt is still logged. */
async function throttle(req, res, scope, username, { log = true } = {}) {
  const limits = await loginLimits();
  const keys = [ipKey(scope, req.ip), ...(username ? [userKey(scope, username)] : [])];
  const r = isLimited(keys, limits);
  if (!r.limited) return { keys, limited: false };
  if (log) await recordLogin(req, { username, success: false, reason: 'rate-limited', method: scope === 'login' ? 'password' : scope });
  res.set('Retry-After', String(r.retryAfter));
  res.status(429).json({ success: false, message: `Too many attempts. Try again in ${r.retryAfter} seconds`, retryAfter: r.retryAfter, requestId: req.id });
  return { keys, limited: true };
}

const loginExample = { accessToken: '<jwt>', refreshToken: '<jwt>', expiresIn: 1800, issuedAt: '2026-01-01T00:00:00Z', mustChangePassword: false, user: { userId: 'usr_1', username: 'BrokerVerse', displayName: 'BrokerVerse Administrator', roles: ['it-admin'], permissions: ['read:leads'], mustChangePassword: false, twoFactorEnabled: false } };

define({
  method: 'POST', path: '/login', auth: false,
  summary: 'Sign in with username and password (rate limited). Answers twoFactorRequired + challengeToken when two-factor is on, twoFactorSetupRequired + a restricted token when the role requires enrolment, passwordChangeRequired + a restricted token when the password must be changed',
  screen: 'Sign-in',
  request: { username: 'BrokerVerse', password: '<password>' },
  response: loginExample,
  middleware: [validate(z.object({ username: z.string().min(1), password: z.string().min(1), deviceId: z.string().max(200).optional() }))],
  handler: async (req, res) => {
    const { username, password, deviceId } = req.body;
    const t = await throttle(req, res, 'login', username);
    if (t.limited) return;
    // Failed attempts count against the IP and the username; a successful sign-in clears the username counter.
    const fail = async (user, reason, message) => {
      hit(t.keys);
      await recordLogin(req, { userId: user?.id ?? null, username, success: false, reason });
      throw unauthorized(message);
    };
    const user = await loadUser('lower(u.username) = lower($1)', [username]);
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return fail(null, 'unknown-user', 'Invalid username or password');
    }
    const okPw = await bcrypt.compare(password, user.password_hash);
    if (user.status === 'locked') return fail(user, 'locked', 'Account locked. Contact the administrator');
    if (user.status !== 'active') return fail(user, 'inactive', 'Account inactive');
    if (!okPw) {
      const max = Number(await getSetting('limits.max_login_attempts', 5));
      await query('UPDATE users SET failed_logins = failed_logins + 1, status = CASE WHEN failed_logins + 1 >= $2 THEN \'locked\' ELSE status END WHERE id = $1', [user.id, max]);
      return fail(user, 'bad-password', 'Invalid username or password');
    }
    clearKey(userKey('login', username));
    if (user.totp_enabled) {
      const minutes = Number(await getSetting('security.two_factor_challenge_minutes', 5)) || 5;
      const challengeToken = signToken({ sub: user.id, type: '2fa-challenge', deviceId: deviceId || null }, { expiresIn: minutes * 60 });
      await query('UPDATE users SET failed_logins = 0 WHERE id = $1', [user.id]);
      await recordLogin(req, { userId: user.id, username: user.username, success: false, reason: '2fa-required' });
      return res.json({ success: true, message: 'Enter the code from your authenticator app', twoFactorRequired: true, challengeToken, expiresIn: minutes * 60 });
    }
    if (await twoFactorRequiredFor(user)) {
      // Restricted session: only the enrolment endpoints; /auth/2fa/enable then returns the normal token payload.
      await query('UPDATE users SET failed_logins = 0 WHERE id = $1', [user.id]);
      await recordLogin(req, { userId: user.id, username: user.username, success: false, reason: '2fa-setup-required' });
      return res.json({ success: true, message: 'Two-factor authentication must be set up for your role', twoFactorSetupRequired: true,
        accessToken: signAccess(user, { restrict: 'enrol2fa', expiresIn: RESTRICTED_TTL }), expiresIn: RESTRICTED_TTL, user: publicUser(user) });
    }
    return res.json(await completeSignIn(req, user, { deviceId, method: 'password' }));
  },
});

define({
  method: 'POST', path: '/login/2fa', auth: false, summary: 'Second sign-in step: the challengeToken from /auth/login and the 6-digit authenticator code; returns the normal token payload (or passwordChangeRequired)', screen: 'Sign-in > Two-factor code',
  request: { challengeToken: '<jwt from /auth/login>', code: '123456' },
  response: { accessToken: '<jwt>', refreshToken: '<jwt>', expiresIn: 1800, user: { userId: 'usr_1', username: 'BrokerVerse', twoFactorEnabled: true } },
  middleware: [validate(z.object({ challengeToken: z.string().min(10), code: z.string().min(6).max(10), deviceId: z.string().max(200).optional() }))],
  handler: async (req, res) => {
    let p;
    try { p = verify(req.body.challengeToken); } catch { throw unauthorized('Sign-in challenge expired; sign in again'); }
    if (p.type !== '2fa-challenge') throw unauthorized('Invalid sign-in challenge');
    const user = await loadUser('u.id = $1', [p.sub]);
    if (!user || user.status !== 'active' || !user.totp_enabled) throw unauthorized('Invalid sign-in challenge');
    const t = await throttle(req, res, 'login', user.username);
    if (t.limited) return;
    const step = verifyTotp(decryptSecret(user.totp_secret), req.body.code, { afterStep: user.totp_last_step });
    if (step === null) {
      hit(t.keys);
      await recordLogin(req, { userId: user.id, username: user.username, success: false, reason: 'bad-2fa-code', method: '2fa' });
      throw unauthorized('Invalid authentication code');
    }
    await query('UPDATE users SET totp_last_step = $2 WHERE id = $1', [user.id, step]);
    clearKey(userKey('login', user.username));
    res.json(await completeSignIn(req, user, { deviceId: req.body.deviceId || p.deviceId, method: '2fa' }));
  },
});

define({
  method: 'POST', path: '/refresh', auth: false,
  summary: 'Exchange a refresh token for a new access and refresh token (rotation). A rotated token used again revokes the whole sign-in; a password change or reset requires signing in again',
  screen: 'Session',
  request: { refreshToken: '<jwt>' }, response: { accessToken: '<jwt>', refreshToken: '<jwt>', expiresIn: 1800, user: { userId: 'usr_1', roles: ['sales'] } },
  middleware: [validate(z.object({ refreshToken: z.string().min(1) }))],
  handler: async (req, res) => {
    let p;
    try { p = verify(req.body.refreshToken); } catch { throw unauthorized('Invalid refresh token'); }
    if (p.type !== 'refresh') throw unauthorized('Invalid refresh token');
    const row = (await query('SELECT jti, user_id, device_id, family_id, revoked_at, revoked_reason, expires_at > now() AS live FROM refresh_tokens WHERE jti = $1', [p.jti])).rows[0];
    if (!row || !row.live) throw unauthorized('Refresh token expired or revoked');
    if (row.revoked_at) {
      const ageSeconds = (Date.now() - new Date(row.revoked_at).getTime()) / 1000;
      if (row.revoked_reason === 'rotated' && ageSeconds > REUSE_GRACE_SECONDS) {
        // Reuse of a rotated token: someone else holds a copy. End every session of this sign-in and every access token.
        await query("UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'reuse' WHERE family_id = $1 AND revoked_at IS NULL", [row.family_id]);
        await revokeSessions(row.user_id);
        await audit({ user: { id: row.user_id }, ip: req.ip }, { entity: 'session', entityId: row.user_id, action: 'refresh-token-reuse', after: { family: row.family_id } });
        await recordLogin(req, { userId: row.user_id, success: false, reason: 'refresh-token-reuse', method: 'refresh' });
        throw unauthorized('This session was ended for your security; sign in again');
      }
      throw unauthorized('Refresh token expired or revoked');
    }
    const user = await loadUser('u.id = $1', [row.user_id]);
    if (!user || user.status !== 'active') throw unauthorized('Account inactive');
    if ((await passwordChangeState(user)).required) throw unauthorized('Your password must be changed; sign in again');
    // Rotate: only one caller can revoke the presented token.
    const rotated = await query("UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'rotated' WHERE jti = $1 AND revoked_at IS NULL", [row.jti]);
    if (!rotated.rowCount) throw unauthorized('Refresh token expired or revoked');
    const tokens = await issueTokens(user, row.device_id, row.family_id);
    await query('UPDATE refresh_tokens SET replaced_by = $2 WHERE jti = $1', [row.jti, tokens.jti]);
    res.json(tokenBody(tokens));
  },
});

define({
  method: 'POST', path: '/logout', auth: false, summary: 'Revoke the refresh token and end the session (works with an expired access token)', screen: 'Profile menu',
  request: { refreshToken: '<jwt>', deviceId: 'device-1' }, response: { success: true },
  handler: async (req, res) => {
    let userId = null;
    if (req.body?.refreshToken) {
      try {
        const p = verify(req.body.refreshToken);
        if (p.type === 'refresh') {
          userId = p.sub;
          await query("UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'logout' WHERE jti = $1 AND revoked_at IS NULL", [p.jti]);
        }
      } catch { /* already invalid */ }
    }
    if (userId) await audit({ user: { id: userId }, ip: req.ip }, { entity: 'session', entityId: userId, action: 'logout' });
    res.json({ success: true, message: 'Logged out' });
  },
});

define({
  method: 'GET', path: '/profile', summary: 'Current user profile', screen: 'Profile',
  response: { success: true, data: { userId: 'usr_1', username: 'BrokerVerse', roles: ['it-admin'] } },
  handler: async (req, res) => {
    const user = await loadUser('u.id = $1', [req.user.id]);
    res.json({ success: true, data: { ...publicUser(user), firstName: user.first_name, lastName: user.last_name, phone: user.phone, branchCode: user.branch_code, employeeCode: user.employee_code } });
  },
});

define({
  method: 'PUT', path: '/profile', summary: 'Update own profile', screen: 'Profile', middleware: [validate(z.object({ displayName: z.string().min(1).optional(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional() }))],
  request: { displayName: 'Juan Santos', email: 'juan@example.com', phone: '+63 900 000 0000' }, response: { success: true },
  handler: async (req, res) => {
    const b = req.body;
    await query('UPDATE users SET display_name = COALESCE($2, display_name), first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name), email = COALESCE($5, email), phone = COALESCE($6, phone), updated_by = $7 WHERE id = $1',
      [req.user.id, b.displayName, b.firstName, b.lastName, b.email, b.phone, req.user.username]);
    await audit(req, { entity: 'user', entityId: req.user.id, action: 'update-profile', after: b });
    res.json({ success: true, message: 'Profile updated', data: publicUser(await loadUser('u.id = $1', [req.user.id])) });
  },
});

define({
  method: 'POST', path: '/change-password',
  summary: 'Change own password (password policy and history from settings group "security"). Ends every other session and returns a new token payload; also completes a sign-in that required a password change',
  screen: 'Profile > Change password; Sign-in > Change password',
  middleware: [validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1), deviceId: z.string().max(200).optional() }))],
  request: { currentPassword: '<current password>', newPassword: '<new password>' }, response: { success: true, message: 'Password changed', ...loginExample },
  handler: async (req, res) => {
    const user = await loadUser('u.id = $1', [req.user.id]);
    const t = await throttle(req, res, 'change-password', user.username, { log: false });
    if (t.limited) return;
    if (!(await bcrypt.compare(req.body.currentPassword, user.password_hash))) {
      hit(t.keys);
      throw badRequest('Current password is incorrect', [{ path: 'currentPassword', message: 'Current password is incorrect' }]);
    }
    await assertPasswordAllowed(req.body.newPassword, { userId: user.id });
    await withTransaction(async (c) => {
      await savePassword(user.id, req.body.newPassword, { db: c, extraSql: 'must_change_password = false' });
      await revokeSessions(user.id, { refresh: true, db: c });
    });
    await audit(req, { entity: 'user', entityId: user.id, action: 'change-password' });
    const fresh = await loadUser('u.id = $1', [user.id]);
    const payload = req.user.pwchange
      ? await completeSignIn(req, fresh, { deviceId: req.body.deviceId, method: 'password-change' })
      : tokenBody(await issueTokens(fresh, req.body.deviceId));
    res.json({ ...payload, success: true, message: 'Password changed' });
  },
});

define({
  method: 'GET', path: '/password-policy', auth: false, summary: 'Password rules from settings (for the change / reset password forms)', screen: 'Profile > Change password; Reset password',
  response: { success: true, data: { minLength: 8, requireUpper: true, requireLower: true, requireDigit: true, requireSymbol: true, historyCount: 5, maxAgeDays: 90 } },
  handler: async (_req, res) => res.json({ success: true, data: await passwordPolicy() }),
});

define({
  method: 'GET', path: '/login-history', summary: 'Own sign-in history (success, from, to; paging)', screen: 'Profile > Sign-in history',
  query: { page: 1, perPage: 20, success: 'false' },
  response: { success: true, data: [{ id: 1, at: '2026-09-28T01:00:00Z', username: 'BrokerVerse', ip: '10.0.0.5', userAgent: 'Mozilla/5.0', success: true, reason: 'ok', method: 'password' }], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => { const r = await loginHistory(req.user.id, req.query); res.json({ success: true, data: r.items, total: r.total, page: r.page, perPage: r.perPage, totalPages: r.totalPages }); },
});

define({
  method: 'POST', path: '/forgot-password', auth: false, summary: 'Request a password reset code (queued to the e-mail outbox; earlier codes are withdrawn; rate limited per IP and username)', screen: 'Forgot password',
  middleware: [validate(z.object({ username: z.string().max(200).optional(), email: z.string().max(320).optional() }))],
  request: { email: 'user@example.com' }, response: { success: true },
  handler: async (req, res) => {
    const { username, email } = req.body;
    if (!username && !email) throw badRequest('username or email is required');
    const t = await throttle(req, res, 'forgot', username || email, { log: false });
    if (t.limited) return;
    hit(t.keys);
    const user = await loadUser(username ? 'lower(u.username) = lower($1)' : 'lower(u.email) = lower($1)', [username || email]);
    if (user && user.status !== 'inactive' && user.email) {
      const code = String(crypto.randomInt(100000, 1000000));
      await withTransaction(async (c) => {
        await c.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
        await c.query('INSERT INTO password_resets(user_id, code_hash, expires_at) VALUES ($1,$2, now() + interval \'15 minutes\')', [user.id, hashCode(code, user.id)]);
        await c.query('INSERT INTO email_outbox(to_address, subject, body_html, template, entity, entity_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [user.email, 'Your BrokerVerse password reset code', `<p>Your verification code is <b>${code}</b>. It expires in 15 minutes. If you did not ask for it, ignore this e-mail.</p>`, 'password-reset', 'user', user.id]);
      });
    }
    res.json({ success: true, message: 'If the account exists, a verification code has been sent' });
  },
});

define({
  method: 'POST', path: '/reset-password', auth: false, summary: 'Reset the password with the e-mailed code (only the latest code is valid; password policy applies; wrong codes are rate limited and withdraw the code after security.reset_code_max_attempts)', screen: 'Forgot password > Reset password',
  middleware: [validate(z.object({ username: z.string().max(200).optional(), email: z.string().max(320).optional(), code: z.string().min(4).max(12), newPassword: z.string().min(1) }))],
  request: { username: 'juan.santos', code: '123456', newPassword: '<new password>' }, response: { success: true },
  handler: async (req, res) => {
    const { username, email, code, newPassword } = req.body;
    if (!username && !email) throw badRequest('username or email is required');
    const t = await throttle(req, res, 'reset', username || email, { log: false });
    if (t.limited) return;
    const user = await loadUser(username ? 'lower(u.username) = lower($1)' : 'lower(u.email) = lower($1)', [username || email]);
    const reset = user && (await query('SELECT id, code_hash, attempts FROM password_resets WHERE user_id = $1 AND used_at IS NULL AND expires_at > now() AND code_hash IS NOT NULL ORDER BY id DESC LIMIT 1', [user.id])).rows[0];
    if (!reset || !sameHash(reset.code_hash, hashCode(code, user.id))) {
      hit(t.keys);
      if (reset) {
        const max = Math.max(1, Number(await getSetting('security.reset_code_max_attempts', 5)) || 5);
        await query('UPDATE password_resets SET attempts = attempts + 1, used_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE used_at END WHERE id = $1', [reset.id, max]);
      }
      throw badRequest('Invalid or expired code');
    }
    await assertPasswordAllowed(newPassword, { userId: user.id });
    await withTransaction(async (c) => {
      await c.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
      await savePassword(user.id, newPassword, { db: c, extraSql: 'failed_logins = 0, must_change_password = false, status = CASE WHEN status = \'locked\' THEN \'active\' ELSE status END' });
      await revokeSessions(user.id, { refresh: true, db: c });
    });
    await audit({ user: { id: user.id, username: user.username }, ip: req.ip }, { entity: 'user', entityId: user.id, action: 'reset-password' });
    res.json({ success: true, message: 'Password reset' });
  },
});

// ---------------------------------------------------------------- two-factor authentication (TOTP, RFC 6238)
const codeBody = validate(z.object({ code: z.string().min(6).max(10) }));

/** Rate limit on code checks of a signed-in user (enable / disable): the sign-in limits, keyed by user. */
async function codeThrottle(req, res) {
  return throttle(req, res, '2fa-code', req.user.id, { log: false });
}

define({
  method: 'GET', path: '/2fa/status', summary: 'Own two-factor status (enabled, required by role)', screen: 'Profile > Security',
  response: { success: true, data: { enabled: false, required: false, enabledAt: null } },
  handler: async (req, res) => {
    const u = await loadUser('u.id = $1', [req.user.id]);
    const row = (await query('SELECT totp_enabled_at FROM users WHERE id = $1', [req.user.id])).rows[0];
    res.json({ success: true, data: { enabled: !!u.totp_enabled, required: await twoFactorRequiredFor(u), enabledAt: row?.totp_enabled_at || null, setupPending: !!u.totp_pending_secret } });
  },
});
define({
  method: 'POST', path: '/2fa/setup', summary: 'Start two-factor enrolment: returns a new base32 secret and the otpauth:// URL for the QR code (the secret is stored encrypted)', screen: 'Profile > Security > Set up two-factor',
  response: { success: true, data: { secret: 'JBSWY3DPEHPK3PXP...', otpauthUrl: 'otpauth://totp/BrokerVerse:BrokerVerse?secret=...&issuer=BrokerVerse', issuer: 'BrokerVerse', account: 'BrokerVerse' } },
  handler: async (req, res) => {
    const u = await loadUser('u.id = $1', [req.user.id]);
    if (u.totp_enabled) throw conflict('Two-factor authentication is already enabled; disable it first');
    const secret = generateSecret();
    await query('UPDATE users SET totp_pending_secret = $2 WHERE id = $1', [u.id, encryptSecret(secret)]);
    const issuer = String(await getSetting('security.two_factor_issuer', 'BrokerVerse') || 'BrokerVerse');
    await audit(req, { entity: 'user', entityId: u.id, action: '2fa-setup' });
    res.json({ success: true, message: 'Scan the QR code, then confirm with a code', data: { secret, otpauthUrl: otpauthUrl({ secret, account: u.username, issuer }), issuer, account: u.username } });
  },
});
define({
  method: 'POST', path: '/2fa/enable', summary: 'Confirm enrolment with a code from the authenticator app (rate limited); after a forced enrolment the normal sign-in payload is returned', screen: 'Profile > Security > Set up two-factor',
  middleware: [codeBody], request: { code: '123456' },
  response: { success: true, message: 'Two-factor authentication enabled', data: { enabled: true } },
  handler: async (req, res) => {
    const u = await loadUser('u.id = $1', [req.user.id]);
    if (u.totp_enabled) throw conflict('Two-factor authentication is already enabled');
    if (!u.totp_pending_secret) throw badRequest('Call /auth/2fa/setup first');
    const t = await codeThrottle(req, res);
    if (t.limited) return;
    const step = verifyTotp(decryptSecret(u.totp_pending_secret), req.body.code);
    if (step === null) { hit(t.keys); throw badRequest('Invalid authentication code'); }
    await query('UPDATE users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled = true, totp_enabled_at = now(), totp_last_step = $2 WHERE id = $1', [u.id, step]);
    await audit(req, { entity: 'user', entityId: u.id, action: '2fa-enable' });
    const body = { success: true, message: 'Two-factor authentication enabled', data: { enabled: true } };
    if (req.user.enrol2fa) Object.assign(body, await completeSignIn(req, await loadUser('u.id = $1', [u.id]), { method: '2fa' }));
    res.json(body);
  },
});
define({
  method: 'POST', path: '/2fa/disable', summary: 'Turn two-factor off with a current code (rate limited; refused while a role requires it)', screen: 'Profile > Security',
  middleware: [codeBody], request: { code: '123456' }, response: { success: true, message: 'Two-factor authentication disabled', data: { enabled: false } },
  handler: async (req, res) => {
    const u = await loadUser('u.id = $1', [req.user.id]);
    if (!u.totp_enabled) throw badRequest('Two-factor authentication is not enabled');
    if (await twoFactorRequiredFor(u)) throw forbidden('Two-factor authentication is required for your role');
    const t = await codeThrottle(req, res);
    if (t.limited) return;
    if (verifyTotp(decryptSecret(u.totp_secret), req.body.code, { afterStep: u.totp_last_step }) === null) { hit(t.keys); throw badRequest('Invalid authentication code'); }
    await query('UPDATE users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled = false, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = $1', [u.id]);
    await audit(req, { entity: 'user', entityId: u.id, action: '2fa-disable' });
    res.json({ success: true, message: 'Two-factor authentication disabled', data: { enabled: false } });
  },
});

export default router;
export const mount = '/auth';
