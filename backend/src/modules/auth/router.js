import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { moduleRouter } from '../../lib/registry.js';
import { loadUser, publicUser, requireAuth, signAccess, signRefresh, verify } from '../../lib/auth.js';
import { badRequest, unauthorized } from '../../lib/errors.js';
import { validate, z } from '../../lib/validate.js';
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { audit } from '../../lib/audit.js';
import { config } from '../../config.js';

const { router, define } = moduleRouter('Auth', '/auth');

async function issueTokens(user, deviceId) {
  const jti = crypto.randomUUID();
  await query('INSERT INTO refresh_tokens(jti, user_id, device_id, expires_at) VALUES ($1,$2,$3, now() + ($4 || \' seconds\')::interval)', [jti, user.id, deviceId || null, String(config.refreshTtl)]);
  return { accessToken: signAccess(user), refreshToken: signRefresh(user, jti), expiresIn: config.accessTtl, issuedAt: new Date().toISOString(), user: publicUser(user) };
}

define({
  method: 'POST', path: '/login', auth: false, summary: 'Sign in with username and password', screen: 'Sign-in',
  request: { username: 'BrokerVerse', password: 'Technxt@1' },
  response: { accessToken: '<jwt>', refreshToken: '<jwt>', expiresIn: 86400, issuedAt: '2026-01-01T00:00:00Z', user: { userId: 'usr_1', username: 'BrokerVerse', displayName: 'BrokerVerse Administrator', roles: ['it-admin'], permissions: ['read:leads'] } },
  middleware: [validate(z.object({ username: z.string().min(1), password: z.string().min(1), deviceId: z.string().optional() }))],
  handler: async (req, res) => {
    const { username, password, deviceId } = req.body;
    const user = await loadUser('lower(u.username) = lower($1)', [username]);
    if (!user) throw unauthorized('Invalid username or password');
    if (user.status === 'locked') throw unauthorized('Account locked. Contact the administrator');
    if (user.status !== 'active') throw unauthorized('Account inactive');
    const okPw = await bcrypt.compare(password, user.password_hash);
    if (!okPw) {
      const max = Number(await getSetting('limits.max_login_attempts', 5));
      await query('UPDATE users SET failed_logins = failed_logins + 1, status = CASE WHEN failed_logins + 1 >= $2 THEN \'locked\' ELSE status END WHERE id = $1', [user.id, max]);
      throw unauthorized('Invalid username or password');
    }
    await query('UPDATE users SET failed_logins = 0, last_login_at = now() WHERE id = $1', [user.id]);
    const tokens = await issueTokens(user, deviceId);
    await audit({ user: { id: user.id, username: user.username }, ip: req.ip }, { entity: 'session', entityId: user.id, action: 'login' });
    res.json(tokens);
  },
});

define({
  method: 'POST', path: '/refresh', auth: false, summary: 'Exchange a refresh token for a new access token', screen: 'Session',
  request: { refreshToken: '<jwt>' }, response: { accessToken: '<jwt>', refreshToken: '<jwt>', expiresIn: 86400 },
  middleware: [validate(z.object({ refreshToken: z.string().min(1) }))],
  handler: async (req, res) => {
    let p;
    try { p = verify(req.body.refreshToken); } catch { throw unauthorized('Invalid refresh token'); }
    if (p.type !== 'refresh') throw unauthorized('Invalid refresh token');
    const row = (await query('SELECT jti FROM refresh_tokens WHERE jti = $1 AND revoked_at IS NULL AND expires_at > now()', [p.jti])).rows[0];
    if (!row) throw unauthorized('Refresh token expired or revoked');
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1', [p.jti]);
    const user = await loadUser('u.id = $1', [p.sub]);
    if (!user || user.status !== 'active') throw unauthorized('Account inactive');
    res.json(await issueTokens(user));
  },
});

define({
  method: 'POST', path: '/logout', auth: false, summary: 'Revoke the refresh token and end the session (works with an expired access token)', screen: 'Profile menu',
  request: { refreshToken: '<jwt>', deviceId: 'device-1' }, response: { success: true },
  handler: async (req, res) => {
    let userId = null;
    if (req.body?.refreshToken) {
      try { const p = verify(req.body.refreshToken); userId = p.sub; await query('UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1', [p.jti]); } catch { /* already invalid */ }
    }
    if (userId) await audit({ user: { id: userId }, ip: req.ip }, { entity: 'session', entityId: userId, action: 'logout' });
    res.json({ success: true, message: 'Logged out' });
  },
});

define({
  method: 'GET', path: '/profile', summary: 'Current user profile', screen: 'Profile', middleware: [requireAuth],
  response: { success: true, data: { userId: 'usr_1', username: 'BrokerVerse', roles: ['it-admin'] } },
  handler: async (req, res) => {
    const user = await loadUser('u.id = $1', [req.user.id]);
    res.json({ success: true, data: { ...publicUser(user), firstName: user.first_name, lastName: user.last_name, phone: user.phone, branchCode: user.branch_code, employeeCode: user.employee_code } });
  },
});

define({
  method: 'PUT', path: '/profile', summary: 'Update own profile', screen: 'Profile', middleware: [requireAuth, validate(z.object({ displayName: z.string().min(1).optional(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional() }))],
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
  method: 'POST', path: '/change-password', summary: 'Change own password', screen: 'Profile > Change password',
  middleware: [requireAuth, validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) }))],
  request: { currentPassword: 'old', newPassword: 'new' }, response: { success: true },
  handler: async (req, res) => {
    const user = await loadUser('u.id = $1', [req.user.id]);
    if (!(await bcrypt.compare(req.body.currentPassword, user.password_hash))) throw badRequest('Current password is incorrect');
    const min = Number(await getSetting('limits.password_min_length', 8));
    if (req.body.newPassword.length < min) throw badRequest(`Password must be at least ${min} characters`);
    await query('UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1', [user.id, await bcrypt.hash(req.body.newPassword, 10)]);
    await audit(req, { entity: 'user', entityId: user.id, action: 'change-password' });
    res.json({ success: true, message: 'Password changed' });
  },
});

define({
  method: 'POST', path: '/forgot-password', auth: false, summary: 'Request a password reset code (queued to the e-mail outbox)', screen: 'Forgot password',
  middleware: [validate(z.object({ username: z.string().optional(), email: z.string().optional() }))],
  request: { email: 'user@example.com' }, response: { success: true },
  handler: async (req, res) => {
    const { username, email } = req.body;
    if (!username && !email) throw badRequest('username or email is required');
    const user = await loadUser(username ? 'lower(u.username) = lower($1)' : 'lower(u.email) = lower($1)', [username || email]);
    if (user) {
      const code = String(crypto.randomInt(100000, 999999));
      await query('INSERT INTO password_resets(user_id, code, expires_at) VALUES ($1,$2, now() + interval \'15 minutes\')', [user.id, code]);
      await query('INSERT INTO email_outbox(to_address, subject, body_html, template, entity, entity_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [user.email || '', 'Your BrokerVerse password reset code', `<p>Your verification code is <b>${code}</b>. It expires in 15 minutes.</p>`, 'password-reset', 'user', user.id]);
    }
    res.json({ success: true, message: 'If the account exists, a verification code has been sent' });
  },
});

define({
  method: 'POST', path: '/reset-password', auth: false, summary: 'Reset the password with the emailed code', screen: 'Verify code / Reset password',
  middleware: [validate(z.object({ username: z.string().optional(), email: z.string().optional(), code: z.string().min(4), newPassword: z.string().min(1) }))],
  request: { username: 'juan.santos', code: '123456', newPassword: 'new' }, response: { success: true },
  handler: async (req, res) => {
    const { username, email, code, newPassword } = req.body;
    const user = await loadUser(username ? 'lower(u.username) = lower($1)' : 'lower(u.email) = lower($1)', [username || email]);
    const reset = user && (await query('SELECT id FROM password_resets WHERE user_id = $1 AND code = $2 AND used_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 1', [user.id, code])).rows[0];
    if (!reset) throw badRequest('Invalid or expired code');
    await query('UPDATE password_resets SET used_at = now() WHERE id = $1', [reset.id]);
    await query('UPDATE users SET password_hash = $2, failed_logins = 0, status = CASE WHEN status = \'locked\' THEN \'active\' ELSE status END WHERE id = $1', [user.id, await bcrypt.hash(newPassword, 10)]);
    res.json({ success: true, message: 'Password reset' });
  },
});

export default router;
export const mount = '/auth';
