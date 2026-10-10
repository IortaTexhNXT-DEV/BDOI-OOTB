/**
 * Security controls made verifiable (migration 0591): lockout release, idle timeout at the API, single session,
 * MFA for every user with the one-time code by e-mail, the append-only audit trail, data retention, the time zone
 * and date checks, the dormancy clock and the Security Controls register.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { resetRateLimits } from '../src/lib/rateLimit.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { housekeeping } from '../src/jobs/housekeeping.js';
import { dataRetention } from '../src/jobs/retention.js';
import { deactivateDormant } from '../src/modules/access-control/service.js';

let ctx;
const ids = {};
const PASSWORD = 'Welcome@123';
const login = (username, password = PASSWORD) => request(ctx.app).post('/api/auth/login').send({ username, password });
const bearer = (token, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
const setSettings = async (settings) => {
  const r = await ctx.api('put', '/settings').send({ settings });
  expect(r.status).toBe(200);
  clearSettingsCache();
};

async function makeUser(username, roles = ['sales'], extra = {}) {
  const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: username, email: `${username}@example.ph`, roles, ...extra });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
  return r.body.data.userId;
}

beforeAll(async () => {
  ctx = await setup();
  for (const u of ['sc.lock', 'sc.idle', 'sc.single', 'sc.otp', 'sc.dormant']) await makeUser(u);
  await makeUser('sc.claims', ['claims']);
  resetRateLimits();
});
afterAll(async () => { await pool.end(); });

describe('account lockout', () => {
  it('a lock by failed sign-ins is released after limits.lockout_minutes; an administrator lock stays', async () => {
    await setSettings({ 'limits.max_login_attempts': 3, 'limits.lockout_minutes': 15 });
    for (let i = 0; i < 3; i += 1) expect((await login('sc.lock', 'wrong')).status).toBe(401);
    const locked = await login('sc.lock');
    expect(locked.status).toBe(401);
    expect(locked.body.message).toMatch(/Account locked after failed sign-ins\. Try again in 15 minutes/);
    expect(await one('SELECT status, lock_reason FROM users WHERE id = $1', [ids['sc.lock']])).toEqual({ status: 'locked', lock_reason: 'failed-logins' });
    // the lockout period has passed: the next sign-in releases the lock (audited) and succeeds
    await query("UPDATE users SET locked_at = now() - interval '16 minutes' WHERE id = $1", [ids['sc.lock']]);
    resetRateLimits();
    const ok = await login('sc.lock');
    expect(ok.status).toBe(200);
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'user' AND entity_id = $1 AND action = 'auto-unlock'", [ids['sc.lock']])).n).toBe(1);
    // an administrator's lock is not released by the timer
    expect((await ctx.api('patch', `/users/${ids['sc.lock']}/status`).send({ status: 'locked' })).status).toBe(200);
    await query("UPDATE users SET locked_at = now() - interval '1 day' WHERE id = $1", [ids['sc.lock']]);
    const still = await login('sc.lock');
    expect(still.status).toBe(401);
    expect(still.body.message).toBe('Account locked. Contact the administrator');
    expect((await ctx.api('patch', `/users/${ids['sc.lock']}/status`).send({ status: 'active' })).status).toBe(200);
    await setSettings({ 'limits.max_login_attempts': 5 });
  });
});

describe('sessions', () => {
  it('the idle timeout is enforced by the API, and signing out ends the access token at once', async () => {
    await setSettings({ 'limits.session_idle_minutes': 3 });
    const r = await login('sc.idle');
    expect(r.status).toBe(200);
    expect((await bearer(r.body.accessToken, 'get', '/auth/profile')).status).toBe(200);
    await query("UPDATE refresh_tokens SET last_seen_at = now() - interval '4 minutes' WHERE user_id = $1", [ids['sc.idle']]);
    const idle = await bearer(r.body.accessToken, 'get', '/auth/profile');
    expect(idle.status).toBe(401);
    expect(idle.body.message).toBe('Session ended after inactivity; sign in again');
    expect((await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: r.body.refreshToken })).status).toBe(401);
    // a fresh sign-in works; its last request is recorded; sign-out ends the session for the access token too
    const r2 = await login('sc.idle');
    expect(r2.status).toBe(200);
    expect((await bearer(r2.body.accessToken, 'get', '/auth/profile')).status).toBe(200);
    expect((await request(ctx.app).post('/api/auth/logout').send({ refreshToken: r2.body.refreshToken })).status).toBe(200);
    expect((await bearer(r2.body.accessToken, 'get', '/auth/profile')).status).toBe(401);
    await setSettings({ 'limits.session_idle_minutes': 30 });
  });

  it('single-session control: a fresh sign-in ends the earlier sessions of the user (security.single_session)', async () => {
    const a = await login('sc.single');
    const b = await login('sc.single');
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await bearer(a.body.accessToken, 'get', '/auth/profile')).status).toBe(200);
    await setSettings({ 'security.single_session': true });
    const c = await login('sc.single');
    expect(c.status).toBe(200);
    expect((await bearer(a.body.accessToken, 'get', '/auth/profile')).status).toBe(401);
    expect((await bearer(b.body.accessToken, 'get', '/auth/profile')).status).toBe(401);
    expect((await bearer(c.body.accessToken, 'get', '/auth/profile')).status).toBe(200);
    expect((await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: a.body.refreshToken })).status).toBe(401);
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'session' AND entity_id = $1 AND action = 'session-superseded'", [ids['sc.single']])).n).toBe(1);
    await setSettings({ 'security.single_session': false });
  });
});

describe('MFA for every user', () => {
  it('security.require_2fa_all with the one-time code by e-mail for a user without an authenticator app', async () => {
    await setSettings({ 'security.require_2fa_all': true, 'security.email_otp_enabled': true });
    const r = await login('sc.otp');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ twoFactorRequired: true, method: 'email' });
    expect(r.body.accessToken).toBeUndefined();
    const mail = await one("SELECT body_html FROM email_outbox WHERE template = 'sign-in-code' AND entity_id = $1 ORDER BY id DESC LIMIT 1", [ids['sc.otp']]);
    const code = mail.body_html.match(/<strong>(\d{6})<\/strong>/)[1];
    const wrong = await request(ctx.app).post('/api/auth/login/2fa').send({ challengeToken: r.body.challengeToken, code: code === '111111' ? '222222' : '111111' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.message).toBe('Invalid or expired sign-in code');
    const ok = await request(ctx.app).post('/api/auth/login/2fa').send({ challengeToken: r.body.challengeToken, code });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    expect((await bearer(ok.body.accessToken, 'get', '/auth/profile')).status).toBe(200);
    expect((await one('SELECT email_otp_hash FROM users WHERE id = $1', [ids['sc.otp']])).email_otp_hash).toBeNull();
    // the same code is not valid twice
    expect((await request(ctx.app).post('/api/auth/login/2fa').send({ challengeToken: r.body.challengeToken, code })).status).toBe(401);
    // without the e-mail code, the user is sent to enrol an authenticator app
    await setSettings({ 'security.email_otp_enabled': false });
    const enrol = await login('sc.otp');
    expect(enrol.body.twoFactorSetupRequired).toBe(true);
    await setSettings({ 'security.require_2fa_all': false });
    expect((await login('sc.otp')).body.accessToken).toBeTruthy();
  });
});

describe('audit trail, time zone, dates and dormancy', () => {
  it('the audit trail cannot be changed or deleted, except by the housekeeping purge past the statutory minimum', async () => {
    const row = await one("SELECT id FROM audit_log ORDER BY id DESC LIMIT 1");
    await expect(query('UPDATE audit_log SET action = $2 WHERE id = $1', [row.id, 'tampered'])).rejects.toThrow(/cannot be changed or deleted/);
    await expect(query('DELETE FROM audit_log WHERE id = $1', [row.id])).rejects.toThrow(/cannot be changed or deleted/);
    await query("INSERT INTO audit_log(at, username, entity, entity_id, action) VALUES (now() - interval '8 years', 'test', 'policy', 'old', 'update')");
    await setSettings({ 'housekeeping.audit_log_days': 2600 });
    const r = await housekeeping();
    expect(r.deleted.audit_log).toBe(1);
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity_id = 'old'")).n).toBe(0);
    await setSettings({ 'housekeeping.audit_log_days': 0 });
  });

  it('refuses an unknown time zone and an impossible date on the audit trail filters', async () => {
    const bad = await ctx.api('put', '/settings').send({ settings: { 'general.timezone': 'Manila' } });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toMatch(/time zone name such as Asia\/Manila/);
    expect((await ctx.api('put', '/settings').send({ settings: { 'general.timezone': '' } })).status).toBe(400);
    expect((await one("SELECT value FROM app_settings WHERE key = 'general.timezone'")).value).toBe('Asia/Manila');
    expect((await ctx.api('get', '/settings/audit').query({ from: '2026-02-30' })).status).toBe(400);
    expect((await ctx.api('get', '/settings/audit/events').query({ to: '2026-13-01' })).status).toBe(400);
    expect((await ctx.api('get', '/settings/audit').query({ from: '2026-02-28', to: '2026-03-01' })).status).toBe(200);
  });

  it('a reactivated user is not deactivated again by the dormant-accounts job until the dormancy period has passed again', async () => {
    await setSettings({ 'access.dormant_days': 90 });
    await query("UPDATE users SET last_login_at = now() - interval '120 days' WHERE id = $1", [ids['sc.dormant']]);
    expect((await deactivateDormant(pool)).users).toContain('sc.dormant');
    expect((await ctx.api('patch', `/users/${ids['sc.dormant']}/status`).send({ status: 'active' })).status).toBe(200);
    expect((await deactivateDormant(pool)).users).not.toContain('sc.dormant');
    expect((await one('SELECT status FROM users WHERE id = $1', [ids['sc.dormant']])).status).toBe('active');
  });
});

describe('data retention', () => {
  it('flags closed contracts past their period (5 years, 10 with a claim) and anonymises when configured', async () => {
    await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, email, phone, created_by) VALUES
      ('cl_ret1','CL-RET-1','Reten Uno','Reten','Uno','reten.uno@example.ph','09170000001','seed'), ('cl_ret2','CL-RET-2','Reten Dos','Reten','Dos','reten.dos@example.ph','09170000002','seed')`);
    await query(`INSERT INTO policies(id, policy_number, client_id, product_id, status, inception_date, expiry_date, sum_insured, premium_total, insured_name, doc, created_by, updated_at) VALUES
      ('pol_ret1','POL-RET-0001','cl_ret1',(SELECT id FROM products WHERE code='MOTOR'),'expired',current_date - 2600,current_date - 2235,100000,5000,'Reten Uno','{}','seed',now() - interval '6 years'),
      ('pol_ret2','POL-RET-0002','cl_ret2',(SELECT id FROM products WHERE code='MOTOR'),'expired',current_date - 2600,current_date - 2235,100000,5000,'Reten Dos','{}','seed',now() - interval '6 years'),
      ('pol_ret3','POL-RET-0003','cl_ret2',(SELECT id FROM products WHERE code='MOTOR'),'expired',current_date - 400,current_date - 35,100000,5000,'Reten Dos','{}','seed',now())`);
    await query(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date) VALUES ('CLM-RET-0002','pol_ret2','cl_ret2','closed',current_date - 2300)`);
    const r = await dataRetention();
    expect(r).toMatchObject({ action: 'flag', flagged: 1, anonymised: 0 });
    expect((await one('SELECT retention_rule FROM policies WHERE id = $1', ['pol_ret1'])).retention_rule).toBe('closed-contract');
    expect((await one('SELECT retention_due_at FROM policies WHERE id = $1', ['pol_ret2'])).retention_due_at).toBeNull();
    // the contract with a claim is kept ten years
    await query("UPDATE policies SET expiry_date = current_date - 3700, updated_at = now() - interval '11 years' WHERE id = 'pol_ret2'");
    await setSettings({ 'retention.action': 'anonymise' });
    const r2 = await dataRetention();
    expect(r2).toMatchObject({ action: 'anonymise', flagged: 1, anonymised: 1, clients: ['CL-RET-1'] });
    const c1 = await one('SELECT display_name, first_name, email, phone, anonymised_at FROM clients WHERE id = $1', ['cl_ret1']);
    expect(c1).toMatchObject({ display_name: 'Anonymised client CL-RET-1', first_name: null, email: null, phone: null });
    expect(c1.anonymised_at).not.toBeNull();
    // the second client still has a contract in its retention period
    expect((await one('SELECT anonymised_at FROM clients WHERE id = $1', ['cl_ret2'])).anonymised_at).toBeNull();
    await setSettings({ 'retention.action': 'flag' });
  });
});

describe('Security Controls register', () => {
  it('lists every control with its state and evidence; evidence is recorded with validation and an audit entry', async () => {
    const r = await ctx.api('get', '/system-controls');
    expect(r.status).toBe(200);
    const byKey = Object.fromEntries(r.body.data.map((c) => [c.key, c]));
    expect(byKey['idle-timeout']).toMatchObject({ kind: 'enforced', status: 'review', requirements: expect.arrayContaining(['TIS-BRD-NFR-03']) });
    expect(byKey['audit-trail'].status).toBe('met');
    expect(byKey['login-throttling'].status).toBe('met');
    expect(byKey['account-lockout'].status).toBe('met');
    expect(byKey.backups).toMatchObject({ kind: 'evidence', status: 'pending', requirements: expect.arrayContaining(['TIS-BRD-NFR-11']) });
    expect(r.body.data.every((c) => Array.isArray(c.requirements) && c.requirements.length > 0 && c.current && c.target)).toBe(true);
    // the time zone control follows the configuration
    await setSettings({ 'limits.session_idle_minutes': 3 });
    expect((await ctx.api('get', '/system-controls')).body.data.find((c) => c.key === 'idle-timeout').status).toBe('met');
    await setSettings({ 'limits.session_idle_minutes': 30 });

    const bad = await ctx.api('post', '/system-controls/backups/evidence').send({ evidenceDate: '2026-02-30', result: 'met', reference: 'x' });
    expect(bad.status).toBe(400);
    expect((await ctx.api('post', '/system-controls/nope/evidence').send({ evidenceDate: '2026-10-01', result: 'met', reference: 'x' })).status).toBe(404);
    expect((await ctx.api('post', '/system-controls/backups/evidence').send({ evidenceDate: '2026-10-01', result: 'done', reference: 'x' })).status).toBe(400);
    const ok = await ctx.api('post', '/system-controls/backups/evidence').send({ evidenceDate: '2026-10-01', result: 'met', reference: 'Azure backup report 2026-09', remarks: 'Restore drill 42 minutes' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ controlKey: 'backups', evidenceDate: '2026-10-01', result: 'met', reference: 'Azure backup report 2026-09' });
    const after = (await ctx.api('get', '/system-controls')).body.data.find((c) => c.key === 'backups');
    expect(after.status).toBe('met');
    expect(after.current).toMatch(/Met on 2026-10-01/);
    const history = await ctx.api('get', '/system-controls/backups/evidence');
    expect(history.body.data).toHaveLength(1);
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'system_control' AND entity_id = 'backups' AND action = 'record-evidence'")).n).toBe(1);
    // evidence that says not met sets the control not met; the register is for the configuration roles only
    await ctx.api('post', '/system-controls/backups/evidence').send({ evidenceDate: '2026-10-05', result: 'not-met', reference: 'Restore drill failed' });
    expect((await ctx.api('get', '/system-controls')).body.data.find((c) => c.key === 'backups').status).toBe('not-met');
    const claims = await loginAs(ctx.app, 'sc.claims', PASSWORD);
    expect((await bearer(claims, 'get', '/system-controls')).status).toBe(403);
    expect((await bearer(claims, 'post', '/system-controls/backups/evidence').send({ evidenceDate: '2026-10-01', result: 'met', reference: 'x' })).status).toBe(403);
  });
});
