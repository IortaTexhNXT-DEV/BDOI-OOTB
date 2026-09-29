import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { resetRateLimits } from '../src/lib/rateLimit.js';
import { base32Decode, base32Encode, hotp } from '../src/lib/totp.js';

let ctx;
const ids = {};
const bearer = (token, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
const login = (username, password) => request(ctx.app).post('/api/auth/login').send({ username, password });
const setSettings = (settings) => ctx.api('put', '/settings').send({ settings });

/** Independent RFC 6238 implementation (HMAC-SHA1, 30 s steps, 6 digits) for the tests. */
function totpAt(secret, offsetSteps = 0) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secret.replace(/=+$/, '')) bits += B32.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offsetSteps));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

async function makeUser(username, roles, password = 'Welcome@123') {
  const r = await ctx.api('post', '/users').send({ username, password, displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
}

beforeAll(async () => {
  ctx = await setup();
  await makeUser('sec.rate', ['sales']);
  await makeUser('sec.pw', ['sales']);
  await makeUser('sec.mfa', ['sales']);
  await makeUser('sec.claims', ['claims']);
  resetRateLimits();
});
afterAll(async () => { resetRateLimits(); await pool.end(); });

describe('sign-in protection', () => {
  it('rate limits sign-in per username and per IP (429 + Retry-After) and logs every attempt', async () => {
    await setSettings({ 'security.login_rate_limit': { max: 3, windowSeconds: 60 } });
    resetRateLimits();
    for (let i = 0; i < 3; i += 1) expect((await login('sec.rate', 'Wrong@pass1')).status).toBe(401);
    const limited = await login('sec.rate', 'Welcome@123');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    // the IP is also at its limit now (failures of any username count)
    expect((await login('sec.pw', 'Welcome@123')).status).toBe(429);
    resetRateLimits();
    for (let i = 0; i < 3; i += 1) expect((await request(ctx.app).post('/api/auth/forgot-password').send({ username: 'sec.rate' })).status).toBe(200);
    expect((await request(ctx.app).post('/api/auth/forgot-password').send({ username: 'sec.rate' })).status).toBe(429);
    resetRateLimits();
    // successful sign-ins do not use up the allowance
    for (let i = 0; i < 4; i += 1) expect((await login('sec.rate', 'Welcome@123')).status).toBe(200);
    const rows = (await query('SELECT success, reason FROM login_history WHERE username = $1 ORDER BY id', ['sec.rate'])).rows;
    expect(rows.filter((r) => r.reason === 'bad-password').length).toBe(3);
    expect(rows.some((r) => r.reason === 'rate-limited' && !r.success)).toBe(true);
    expect(rows.filter((r) => r.success).length).toBe(4);
    await setSettings({ 'security.login_rate_limit': { max: 10, windowSeconds: 300 } });
    resetRateLimits();
  });

  it('exposes sign-in history to administrators and to the user', async () => {
    const h = await ctx.api('get', `/users/${ids['sec.rate']}/login-history?success=false`);
    expect(h.status).toBe(200);
    expect(h.body.data[0]).toMatchObject({ userId: ids['sec.rate'], username: 'sec.rate', success: false, ip: expect.any(String) });
    expect(h.body.total).toBeGreaterThanOrEqual(3);
    const own = await bearer(await loginAs(ctx.app, 'sec.rate', 'Welcome@123'), 'get', '/auth/login-history');
    expect(own.status).toBe(200);
    expect(own.body.data.every((r) => r.userId === ids['sec.rate'])).toBe(true);
    expect((await bearer(await loginAs(ctx.app, 'sec.pw', 'Welcome@123'), 'get', `/users/${ids['sec.rate']}/login-history`)).status).toBe(403);
    expect((await ctx.api('get', '/users/usr_missing/login-history')).status).toBe(404);
  });
});

describe('password policy', () => {
  it('enforces length, character classes and history on change-password', async () => {
    let token = await loginAs(ctx.app, 'sec.pw', 'Welcome@123');
    const change = (currentPassword, newPassword) => bearer(token, 'post', '/auth/change-password').send({ currentPassword, newPassword });
    const short = await change('Welcome@123', 'Ab1!');
    expect(short.status).toBe(400);
    expect(short.body.errors[0].message).toMatch(/at least 8/);
    expect((await change('Welcome@123', 'alllowercase1!')).status).toBe(400);
    expect((await change('Welcome@123', 'NoDigits!!x')).status).toBe(400);
    expect((await change('Welcome@123', 'NoSymbol123')).status).toBe(400);
    expect((await change('Welcome@123', 'Welcome@123')).body.message).toMatch(/used recently/);
    const second = await change('Welcome@123', 'Second@456');
    expect(second.status).toBe(200);
    // a password change ends the other sessions and returns a fresh token payload for this one
    expect(second.body).toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect((await change('Second@456', 'Welcome@123')).status).toBe(401);
    token = second.body.accessToken;
    expect((await change('Second@456', 'Welcome@123')).status).toBe(400);
    expect((await change('Second@456', 'Third@789x')).status).toBe(200);
    const policy = await request(ctx.app).get('/api/auth/password-policy');
    expect(policy.body.data).toMatchObject({ minLength: 8, requireSymbol: true, historyCount: 5 });
  });

  it('enforces the policy on administrator set / reset password and on user create', async () => {
    expect((await ctx.api('post', `/users/${ids['sec.pw']}/password`).send({ password: 'weak' })).status).toBe(400);
    expect((await ctx.api('post', `/users/${ids['sec.pw']}/password`).send({ password: 'Third@789x' })).status).toBe(400);
    expect((await ctx.api('post', `/users/${ids['sec.pw']}/reset-password`).send({ newPassword: 'nosymbol123A' })).status).toBe(400);
    expect((await ctx.api('post', `/users/${ids['sec.pw']}/password`).send({ password: 'Fourth@012y' })).status).toBe(200);
    expect((await ctx.api('post', '/users').send({ username: 'sec.weak', password: 'password', roles: ['sales'] })).status).toBe(400);
    await setSettings({ 'security.password_require_symbol': false, 'security.password_min_length': 6 });
    expect((await ctx.api('post', '/users').send({ username: 'sec.relaxed', password: 'Abc123', roles: ['sales'] })).status).toBe(201);
    await setSettings({ 'security.password_require_symbol': true, 'security.password_min_length': 8 });
  });

  it('flags mustChangePassword when the password is older than security.password_max_age_days', async () => {
    const fresh = await login('sec.pw', 'Fourth@012y');
    expect(fresh.body.user.mustChangePassword).toBe(false);
    await query("UPDATE users SET password_changed_at = now() - interval '120 days' WHERE id = $1", [ids['sec.pw']]);
    const old = await login('sec.pw', 'Fourth@012y');
    expect(old.status).toBe(200);
    expect(old.body).toMatchObject({ passwordChangeRequired: true, passwordExpired: true, user: { mustChangePassword: true, passwordExpired: true } });
    // only a restricted token: no refresh token, and nothing but change-password / profile until the password is changed
    expect(old.body.refreshToken).toBeUndefined();
    const restricted = old.body.accessToken;
    expect((await bearer(restricted, 'get', '/leads')).status).toBe(403);
    expect((await bearer(restricted, 'get', '/auth/profile')).status).toBe(200);
    const changed = await bearer(restricted, 'post', '/auth/change-password').send({ currentPassword: 'Fourth@012y', newPassword: 'Fifth@345z' });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String), mustChangePassword: false });
    expect((await bearer(changed.body.accessToken, 'get', '/leads')).status).toBe(200);
    expect((await login('sec.pw', 'Fifth@345z')).body.refreshToken).toBeTruthy();
  });
});

describe('two-factor authentication (TOTP)', () => {
  it('implements RFC 6238 / RFC 4226 correctly', () => {
    const key = Buffer.from('12345678901234567890');
    expect(hotp(key, 1, 8)).toBe('94287082'); // RFC 6238 test vector, T = 59 s
    expect(hotp(key, 0, 6)).toBe('755224'); // RFC 4226 test vector, counter 0
    const secret = base32Encode(key);
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
  });

  it('enrols, then requires the code at sign-in; disables with a code', async () => {
    const token = await loginAs(ctx.app, 'sec.mfa', 'Welcome@123');
    const setup = await bearer(token, 'post', '/auth/2fa/setup');
    expect(setup.status).toBe(200);
    const { secret, otpauthUrl } = setup.body.data;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\/BrokerVerse:sec\.mfa\?secret=[A-Z2-7]+&issuer=BrokerVerse/);
    const valid = new Set([-1, 0, 1].map((o) => totpAt(secret, o)));
    const wrong = ['000000', '111111', '222222', '333333'].find((c) => !valid.has(c));
    expect((await bearer(token, 'post', '/auth/2fa/enable').send({ code: wrong })).status).toBe(400);
    const enrolCode = totpAt(secret, -1);
    expect((await bearer(token, 'post', '/auth/2fa/enable').send({ code: enrolCode })).status).toBe(200);
    expect((await bearer(token, 'get', '/auth/2fa/status')).body.data.enabled).toBe(true);

    const first = await login('sec.mfa', 'Welcome@123');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ twoFactorRequired: true, challengeToken: expect.any(String) });
    expect(first.body.accessToken).toBeUndefined();
    const bad = await request(ctx.app).post('/api/auth/login/2fa').send({ challengeToken: first.body.challengeToken, code: enrolCode });
    expect(bad.status).toBe(401); // the enrolment code cannot be replayed
    const ok = await request(ctx.app).post('/api/auth/login/2fa').send({ challengeToken: first.body.challengeToken, code: totpAt(secret) });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String), user: { username: 'sec.mfa', twoFactorEnabled: true } });
    expect((await bearer(ok.body.accessToken, 'get', '/leads')).status).toBe(200);
    expect((await request(ctx.app).post('/api/auth/login/2fa').send({ challengeToken: 'not-a-token', code: '123456' })).status).toBe(401);
    const methods = (await query("SELECT reason FROM login_history WHERE user_id = $1 AND method = '2fa'", [ids['sec.mfa']])).rows.map((r) => r.reason);
    expect(methods).toEqual(expect.arrayContaining(['bad-2fa-code', 'ok']));

    expect((await bearer(ok.body.accessToken, 'post', '/auth/2fa/disable').send({ code: totpAt(secret, 1) })).status).toBe(200);
    const plain = await login('sec.mfa', 'Welcome@123');
    expect(plain.body.accessToken).toBeTruthy();
  });

  it('forces enrolment for roles in security.require_2fa_roles; administrators can reset a user\'s second factor', async () => {
    await setSettings({ 'security.require_2fa_roles': ['claims'] });
    const r = await login('sec.claims', 'Welcome@123');
    expect(r.body).toMatchObject({ twoFactorSetupRequired: true, accessToken: expect.any(String) });
    expect(r.body.refreshToken).toBeUndefined();
    const limited = r.body.accessToken;
    expect((await bearer(limited, 'get', '/claims')).status).toBe(403);
    const setup = await bearer(limited, 'post', '/auth/2fa/setup');
    expect(setup.status).toBe(200);
    const enabled = await bearer(limited, 'post', '/auth/2fa/enable').send({ code: totpAt(setup.body.data.secret) });
    expect(enabled.status).toBe(200);
    expect(enabled.body.accessToken).toBeTruthy();
    expect((await bearer(enabled.body.accessToken, 'get', '/claims')).status).toBe(200);
    expect((await bearer(enabled.body.accessToken, 'post', '/auth/2fa/disable').send({ code: totpAt(setup.body.data.secret, 1) })).status).toBe(403);
    expect((await login('sec.claims', 'Welcome@123')).body.twoFactorRequired).toBe(true);
    expect((await ctx.api('post', `/users/${ids['sec.claims']}/2fa/reset`)).status).toBe(200);
    await setSettings({ 'security.require_2fa_roles': [] });
    expect((await login('sec.claims', 'Welcome@123')).body.accessToken).toBeTruthy();
  });
});

describe('operations', () => {
  it('GET /api/version reports build and runtime information without sign-in', async () => {
    const r = await request(ctx.app).get('/api/version');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: 'brokerverse-backend', version: expect.any(String), node: process.version, database: { reachable: true }, pendingMigrations: 0 });
    expect(r.body.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('adds x-request-id to every response, echoes a caller id and returns it in error bodies', async () => {
    const a = await request(ctx.app).get('/api/health');
    expect(a.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const b = await request(ctx.app).get('/api/leads').set('x-request-id', 'trace-abc.123');
    expect(b.status).toBe(401);
    expect(b.headers['x-request-id']).toBe('trace-abc.123');
    expect(b.body.requestId).toBe('trace-abc.123');
    const c = await request(ctx.app).get('/api/nope').set('x-request-id', 'bad id with spaces');
    expect(c.status).toBe(404);
    expect(c.body.requestId).toBe(c.headers['x-request-id']);
    expect(c.body.requestId).not.toBe('bad id with spaces');
  });
});
