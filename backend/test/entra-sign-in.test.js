import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Sign-in with Microsoft is configured for this file only (the configuration is read when the modules load).
const TENANT = vi.hoisted(() => {
  const tenant = '6f1c2a9e-0000-4000-8000-00000000c0de';
  Object.assign(process.env, {
    ENTRA_TENANT_ID: tenant, ENTRA_CLIENT_ID: 'b1d9a0e4-0000-4000-8000-0000000a99c1',
    ENTRA_CLIENT_SECRET: 'test-client-secret', ENTRA_REDIRECT_URI: 'https://brokerverse.tisph.example/login',
  });
  return tenant;
});

const { setup } = await import('./helpers.js');
const { pool, query } = await import('../src/db/pool.js');
const { resetRateLimits } = await import('../src/lib/rateLimit.js');
const { clearSettingsCache } = await import('../src/lib/settings.js');
const { identityOf, resetEntraCache, startSignIn, verifyIdToken } = await import('../src/lib/entraId.js');

const CLIENT_ID = process.env.ENTRA_CLIENT_ID;
const AUTHORITY = 'https://login.microsoftonline.com';
const ISSUER = `${AUTHORITY}/${TENANT}/v2.0`;
const KID = 'tenant-key-1';
const signing = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const stranger = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...signing.publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };

/** Microsoft's side: discovery, key set and token endpoint. `idp.idToken` is what the token endpoint answers next. */
const idp = { idToken: null, tokenRequests: [], keysCalls: 0, keys: [jwk] };
async function fakeFetch(url, init = {}) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const u = String(url);
  if (u === `${AUTHORITY}/${TENANT}/v2.0/.well-known/openid-configuration`) {
    return json({ issuer: `${AUTHORITY}/{tenantid}/v2.0`, authorization_endpoint: `${AUTHORITY}/${TENANT}/oauth2/v2.0/authorize`, token_endpoint: `${AUTHORITY}/${TENANT}/oauth2/v2.0/token`, jwks_uri: `${AUTHORITY}/${TENANT}/discovery/v2.0/keys` });
  }
  if (u === `${AUTHORITY}/${TENANT}/discovery/v2.0/keys`) {
    idp.keysCalls += 1;
    return json({ keys: idp.keys });
  }
  if (u === `${AUTHORITY}/${TENANT}/oauth2/v2.0/token`) {
    const form = new URLSearchParams(init.body);
    idp.tokenRequests.push(Object.fromEntries(form));
    if (form.get('code') !== 'good-code') return json({ error: 'invalid_grant' }, 400);
    return json({ token_type: 'Bearer', id_token: idp.idToken, access_token: 'opaque' });
  }
  return json({ error: 'not found' }, 404);
}

const idToken = (claims = {}, { key = signing.privateKey, kid = KID, expiresIn = 600 } = {}) => jwt.sign(
  { iss: ISSUER, aud: CLIENT_ID, tid: TENANT, oid: 'oid-default', name: 'Test User', ...claims }, key, { algorithm: 'RS256', keyid: kid, ...(expiresIn ? { expiresIn } : {}) },
);

let ctx;
const ids = {};
const setSettings = (settings) => ctx.api('put', '/settings').send({ settings });

/** The whole browser round trip: /auth/sso/start, Microsoft answers with `claims`, /auth/sso/callback. */
async function signInWithMicrosoft(claims, { tamperState = false, code = 'good-code' } = {}) {
  const start = await request(ctx.app).post('/api/auth/sso/start').send({ deviceId: 'device-sso' });
  expect(start.status).toBe(200);
  const { authorizationUrl, transaction } = start.body.data;
  const state = new URL(authorizationUrl).searchParams.get('state');
  idp.idToken = idToken({ nonce: jwt.decode(transaction).nonce, ...claims });
  return request(ctx.app).post('/api/auth/sso/callback').send({ code, state: tamperState ? `${state}x` : state, transaction });
}

async function makeUser(username, email, roles = ['sales']) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles, ...(email ? { email } : {}) });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fakeFetch);
  ctx = await setup();
  await makeUser('sso.maria', 'maria.reyes@tisph.example');
  await makeUser('juan.cruz@tisph.example', null);
  await makeUser('sso.locked', 'locked.user@tisph.example');
  await makeUser('sso.twin1', 'shared.box@tisph.example');
  await makeUser('sso.twin2', 'Shared.Box@tisph.example');
});
beforeEach(() => resetRateLimits());
afterAll(async () => {
  vi.unstubAllGlobals();
  resetRateLimits();
  await pool.end();
});

describe('ID token validation', () => {
  const nonce = 'nonce-1';
  const check = (token) => verifyIdToken(token, { nonce });

  it('accepts a token signed with the tenant key for this application, issuer and nonce', async () => {
    const claims = await check(idToken({ nonce, oid: 'o-1', preferred_username: 'A.User@tisph.example' }));
    expect(claims.oid).toBe('o-1');
    expect(identityOf(claims)).toEqual({ subject: `${TENANT}:o-1`, addresses: ['a.user@tisph.example'], name: 'Test User' });
  });

  it('refuses another key, audience, issuer, tenant, nonce, an expired token and other algorithms', async () => {
    await expect(check(idToken({ nonce }, { key: stranger.privateKey }))).rejects.toMatchObject({ status: 401 });
    await expect(check(idToken({ nonce, aud: 'another-app' }))).rejects.toMatchObject({ status: 401 });
    await expect(check(idToken({ nonce, iss: `${AUTHORITY}/another-tenant/v2.0` }))).rejects.toMatchObject({ status: 401 });
    await expect(check(idToken({ nonce, tid: 'another-tenant' }))).rejects.toMatchObject({ status: 401 });
    await expect(check(idToken({ nonce: 'replayed' }))).rejects.toMatchObject({ status: 401 });
    await expect(check(idToken({ nonce }))).resolves.toBeTruthy();
    await expect(check(idToken({ nonce, exp: Math.floor(Date.now() / 1000) - 600 }, { expiresIn: 0 }))).rejects.toMatchObject({ status: 401 });
    const hs = jwt.sign({ iss: ISSUER, aud: CLIENT_ID, tid: TENANT, nonce }, 'shared-secret', { algorithm: 'HS256', keyid: KID });
    await expect(check(hs)).rejects.toMatchObject({ status: 401 });
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', kid: KID })).toString('base64url')}.${Buffer.from(JSON.stringify({ iss: ISSUER, aud: CLIENT_ID, nonce })).toString('base64url')}.`;
    await expect(check(unsigned)).rejects.toMatchObject({ status: 401 });
  });

  it('reloads the key set once for an unknown key id (key rollover) and not on every token', async () => {
    resetEntraCache();
    const rolled = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    await check(idToken({ nonce }));
    const calls = idp.keysCalls;
    idp.keys = [jwk, { ...rolled.publicKey.export({ format: 'jwk' }), kid: 'tenant-key-2', use: 'sig' }];
    // the new key is not in the cached set; a reload within the minute is not allowed, so the token is refused
    await expect(check(idToken({ nonce }, { key: rolled.privateKey, kid: 'tenant-key-2' }))).rejects.toMatchObject({ status: 401 });
    expect(idp.keysCalls).toBe(calls);
    resetEntraCache();
    await expect(check(idToken({ nonce }, { key: rolled.privateKey, kid: 'tenant-key-2' }))).resolves.toBeTruthy();
    await check(idToken({ nonce }));
    expect(idp.keysCalls).toBe(calls + 1);
    idp.keys = [jwk];
    resetEntraCache();
  });

  it('starts with PKCE (S256 of the verifier kept in the transaction), state and nonce', async () => {
    const { authorizationUrl, transaction } = await startSignIn({ deviceId: 'd1' });
    const url = new URL(authorizationUrl);
    const tx = jwt.decode(transaction);
    expect(url.origin + url.pathname).toBe(`${AUTHORITY}/${TENANT}/oauth2/v2.0/authorize`);
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(process.env.ENTRA_REDIRECT_URI);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(crypto.createHash('sha256').update(tx.verifier).digest('base64url'));
    expect(url.searchParams.get('state')).toBe(tx.state);
    expect(url.searchParams.get('nonce')).toBe(tx.nonce);
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(tx).toMatchObject({ type: 'sso-transaction', deviceId: 'd1' });
  });
});

describe('sign-in with Microsoft', () => {
  it('offers the Microsoft button and the password form', async () => {
    const r = await request(ctx.app).get('/api/auth/options');
    expect(r.body.data).toEqual({ passwordSignIn: true, sso: { enabled: true, provider: 'entra-id' } });
  });

  it('matches the user by e-mail, binds the Microsoft account and returns a normal session', async () => {
    idp.tokenRequests = [];
    const r = await signInWithMicrosoft({ oid: 'oid-maria', email: 'Maria.Reyes@tisph.example', preferred_username: 'mreyes@tisph.onmicrosoft.example' });
    expect(r.status).toBe(200);
    expect(r.body.user.username).toBe('sso.maria');
    expect(r.body.accessToken).toBeTruthy();
    expect(r.body.refreshToken).toBeTruthy();
    const sent = idp.tokenRequests.at(-1);
    expect(sent).toMatchObject({ grant_type: 'authorization_code', code: 'good-code', client_secret: 'test-client-secret', redirect_uri: process.env.ENTRA_REDIRECT_URI });
    expect(sent.code_verifier).toHaveLength(43);
    const u = (await query('SELECT sso_subject, last_login_at FROM users WHERE id = $1', [ids['sso.maria']])).rows[0];
    expect(u.sso_subject).toBe(`${TENANT}:oid-maria`);
    expect(u.last_login_at).toBeTruthy();
    const h = (await query("SELECT success, reason, method FROM login_history WHERE user_id = $1 AND method = 'sso' ORDER BY id DESC LIMIT 1", [ids['sso.maria']])).rows[0];
    expect(h).toEqual({ success: true, reason: 'ok', method: 'sso' });
    const tokens = (await query('SELECT device_id FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [ids['sso.maria']])).rows[0];
    expect(tokens.device_id).toBe('device-sso');
    // the session works like any other
    const me = await request(ctx.app).get('/api/auth/profile').set('Authorization', `Bearer ${r.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('matches by user principal name when the user ID is the UPN', async () => {
    const r = await signInWithMicrosoft({ oid: 'oid-juan', preferred_username: 'JUAN.CRUZ@tisph.example' });
    expect(r.status).toBe(200);
    expect(r.body.user.username).toBe('juan.cruz@tisph.example');
  });

  it('refuses another Microsoft account presenting the same address once a user is bound', async () => {
    const r = await signInWithMicrosoft({ oid: 'oid-impostor', email: 'maria.reyes@tisph.example' });
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/linked to another Microsoft account/);
    // the bound account still signs in, even after its address changed in Microsoft 365
    expect((await signInWithMicrosoft({ oid: 'oid-maria', email: 'maria.r@tisph.example' })).status).toBe(200);
  });

  it('refuses unknown, ambiguous, locked and inactive users without creating anyone', async () => {
    const before = (await query('SELECT count(*)::int AS n FROM users')).rows[0].n;
    const unknown = await signInWithMicrosoft({ oid: 'oid-new', email: 'new.joiner@tisph.example' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toMatch(/not set up/);
    expect((await signInWithMicrosoft({ oid: 'oid-twin', email: 'shared.box@tisph.example' })).status).toBe(401);
    expect((await query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(before);
    await query("UPDATE users SET status = 'locked' WHERE id = $1", [ids['sso.locked']]);
    const locked = await signInWithMicrosoft({ oid: 'oid-locked', email: 'locked.user@tisph.example' });
    expect(locked.status).toBe(401);
    expect(locked.body.message).toMatch(/locked/);
    await query("UPDATE users SET status = 'inactive' WHERE id = $1", [ids['sso.locked']]);
    expect((await signInWithMicrosoft({ oid: 'oid-locked', email: 'locked.user@tisph.example' })).status).toBe(401);
    const reasons = (await query("SELECT reason FROM login_history WHERE method = 'sso' AND NOT success ORDER BY id")).rows.map((r) => r.reason);
    expect(reasons).toEqual(expect.arrayContaining(['sso-unknown-user', 'sso-ambiguous-user', 'locked', 'inactive', 'sso-other-account']));
  });

  it('registers an unknown account as an inactive user without roles when security.sso_register_users is on', async () => {
    expect((await setSettings({ 'security.sso_register_users': true })).status).toBe(200);
    clearSettingsCache();
    const r = await signInWithMicrosoft({ oid: 'oid-joiner', email: 'new.joiner@tisph.example', name: 'New Joiner' });
    expect(r.status).toBe(403);
    expect(r.body.message).toMatch(/administrator must activate/);
    const u = (await query("SELECT id, status, display_name, sso_subject FROM users WHERE username = 'new.joiner@tisph.example'")).rows[0];
    expect(u).toMatchObject({ status: 'inactive', display_name: 'New Joiner', sso_subject: `${TENANT}:oid-joiner` });
    expect((await query('SELECT count(*)::int AS n FROM user_roles WHERE user_id = $1', [u.id])).rows[0].n).toBe(0);
    // signing in again before activation: refused as inactive, not registered twice
    expect((await signInWithMicrosoft({ oid: 'oid-joiner', email: 'new.joiner@tisph.example' })).status).toBe(401);
    await setSettings({ 'security.sso_register_users': false });
    clearSettingsCache();
  });

  it('refuses a changed state, an unknown code and a token for another nonce', async () => {
    expect((await signInWithMicrosoft({ oid: 'oid-maria' }, { tamperState: true })).status).toBe(401);
    expect((await signInWithMicrosoft({ oid: 'oid-maria' }, { code: 'stolen-code' })).status).toBe(401);
    const start = await request(ctx.app).post('/api/auth/sso/start').send({});
    const { authorizationUrl, transaction } = start.body.data;
    idp.idToken = idToken({ oid: 'oid-maria', nonce: 'from-another-sign-in' });
    const r = await request(ctx.app).post('/api/auth/sso/callback').send({ code: 'good-code', state: new URL(authorizationUrl).searchParams.get('state'), transaction });
    expect(r.status).toBe(401);
  });

  it('is rate limited per address like the password sign-in', async () => {
    await setSettings({ 'security.login_rate_limit': { max: 2, windowSeconds: 60 } });
    clearSettingsCache();
    resetRateLimits();
    for (let i = 0; i < 2; i += 1) expect((await signInWithMicrosoft({ oid: 'oid-nobody', email: 'nobody@tisph.example' })).status).toBe(401);
    expect((await signInWithMicrosoft({ oid: 'oid-maria' })).status).toBe(429);
    await setSettings({ 'security.login_rate_limit': { max: 10, windowSeconds: 300 } });
    clearSettingsCache();
  });
});

describe('password sign-in switched off', () => {
  it('keeps it for the break-glass roles only and hides the form', async () => {
    expect((await setSettings({ 'security.password_sign_in_enabled': false })).status).toBe(200);
    clearSettingsCache();
    expect((await request(ctx.app).get('/api/auth/options')).body.data.passwordSignIn).toBe(false);
    const staff = await request(ctx.app).post('/api/auth/login').send({ username: 'sso.maria', password: 'Welcome@123' });
    expect(staff.status).toBe(403);
    expect(staff.body.message).toMatch(/Microsoft/);
    // a wrong password still answers as before (no hint that the account exists)
    expect((await request(ctx.app).post('/api/auth/login').send({ username: 'sso.maria', password: 'Wrong@pass1' })).status).toBe(401);
    const admin = await request(ctx.app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
    expect(admin.status).toBe(200);
    // no reset code is sent to a user who cannot use a password
    const outbox = async () => (await query("SELECT count(*)::int AS n FROM email_outbox WHERE template = 'password-reset' AND to_address = 'maria.reyes@tisph.example'")).rows[0].n;
    const sent = await outbox();
    expect((await request(ctx.app).post('/api/auth/forgot-password').send({ username: 'sso.maria' })).status).toBe(200);
    expect(await outbox()).toBe(sent);
    expect((await signInWithMicrosoft({ oid: 'oid-maria' })).status).toBe(200);
    await setSettings({ 'security.password_sign_in_enabled': true });
    clearSettingsCache();
    expect((await request(ctx.app).post('/api/auth/login').send({ username: 'sso.maria', password: 'Welcome@123' })).status).toBe(200);
  });
});
