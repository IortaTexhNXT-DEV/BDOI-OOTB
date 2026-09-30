/**
 * Security hardening: file storage, passwords, production
 * configuration, log redaction, session revocation, reset codes and 2FA secrets at rest, user administration,
 * upload limits and rate limits, route registry and error bodies.
 */
import crypto from 'node:crypto';
import { Writable } from 'node:stream';
import zlib from 'node:zlib';
import express from 'express';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, loginAs, createUserDeskRole } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { buildConfig, config, productionConfigProblems } from '../src/config.js';
import { REDACT_PATHS, redactRequest, redactUrl } from '../src/lib/logger.js';
import { ROUTES } from '../src/lib/registry.js';
import { errorHandler } from '../src/lib/errors.js';
import { resetRateLimits } from '../src/lib/rateLimit.js';
import { decryptSecret, encryptSecret, hashCode, linkExpiry, signFileQuery, temporaryPassword, verifyFileSignature } from '../src/lib/secrets.js';
import { signUrlsInText } from '../src/lib/fileLinks.js';
import { assertRowLimit, inflateEntry } from '../src/lib/uploadLimits.js';
import { detectType } from '../src/modules/uploads/fileTypes.js';
import { owningModule } from '../src/modules/uploads/router.js';
import { parseUploadedRows } from '../src/modules/documents/tabular.js';
import { policyProblems, passwordPolicy } from '../src/lib/password.js';

const PW = 'Harden#2026x';
let ctx;
const ids = {};
const tokens = {};
const bearer = (token, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
const login = (username, password) => request(ctx.app).post('/api/auth/login').send({ username, password });
const setSettings = (settings) => ctx.api('put', '/settings').send({ settings });
const pathOf = (url) => { const u = new URL(url); return u.pathname + u.search; };

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const HTML = Buffer.from('<!doctype html><html><body><script>alert(localStorage.accessToken)</script></body></html>');

async function makeUser(username, roles, extra = {}) {
  const r = await ctx.api('post', '/users').send({ username, password: PW, displayName: username, email: `${username}@example.ph`, roles, ...extra });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
  tokens[username] = await loginAs(ctx.app, username, PW);
  return r.body.data;
}

beforeAll(async () => {
  ctx = await setup();
  resetRateLimits();
  await makeUser('hd.sales', ['sales']);
  await makeUser('hd.sales2', ['sales']);
  await makeUser('hd.claims', ['claims']);
  await makeUser('hd.uw', ['processing']);
  // user administration without the administrator role (a custom role; the User Access Administrator role was merged into system-admin)
  await makeUser('hd.uaa', [await createUserDeskRole(ctx.api)]);
});
afterAll(async () => { resetRateLimits(); await pool.end(); });

// ------------------------------------------------------------------------------------------------ 1. file storage
describe('file storage', () => {
  it('detects file types from their signature, not from the name or the browser', () => {
    expect(detectType(PNG, 'a.jpg')).toBe('image/png');
    expect(detectType(PDF, 'x.pdf')).toBe('application/pdf');
    expect(detectType(HTML, 'photo.jpg')).toBe('text/html');
    expect(detectType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'), 'a.svg')).toBe('image/svg+xml');
    expect(detectType(Buffer.from('a,b\n1,2\n'), 'x.csv')).toBe('text/csv');
    expect(detectType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]), 'book.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(detectType(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), 'tool.exe')).toBeNull();
  });

  it('refuses HTML, scripts and unknown binaries; stores the detected type', async () => {
    const html = await bearer(tokens['hd.sales'], 'post', '/s3/upload').field('folder', 'vehicle-photos').attach('file', HTML, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(html.status).toBe(415);
    const exe = await bearer(tokens['hd.sales'], 'post', '/s3/upload').attach('file', Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(exe.status).toBe(415);
    const multi = await bearer(tokens['hd.sales'], 'post', '/s3/upload-multiple').attach('files', PNG, 'a.png').attach('files', HTML, 'b.html');
    expect(multi.status).toBe(415); // all or nothing
    const png = await bearer(tokens['hd.sales'], 'post', '/s3/upload').field('folder', 'vehicle-photos').attach('file', PNG, { filename: 'front.png', contentType: 'text/html' });
    expect(png.status).toBe(200);
    expect((await query('SELECT content_type, uploaded_by FROM documents WHERE storage_key = $1', [png.body.data.key])).rows[0]).toEqual({ content_type: 'image/png', uploaded_by: ids['hd.sales'] });
    ids.photoKey = png.body.data.key;
    ids.photoUrl = png.body.data.url;
  });

  it('serves objects only with a bearer header or a signed, unexpired link, with safe headers', async () => {
    const key = ids.photoKey;
    expect(ids.photoUrl).toMatch(/\?exp=\d+&sig=[\w-]+$/); // upload responses carry a signed link
    expect((await request(ctx.app).get(`/api/s3/object/${key}`)).status).toBe(401);
    const signed = await request(ctx.app).get(pathOf(ids.photoUrl));
    expect(signed.status).toBe(200);
    expect(signed.headers['content-type']).toBe('image/png');
    expect(signed.headers['x-content-type-options']).toBe('nosniff');
    expect(signed.headers['content-security-policy']).toMatch(/^sandbox; default-src 'none'/);
    expect(signed.headers['content-disposition']).toMatch(/^inline;/);
    const past = Math.floor(Date.now() / 1000) - 10;
    expect((await request(ctx.app).get(`/api/s3/object/${key}?${signFileQuery(key, past)}`)).status).toBe(401);
    expect((await request(ctx.app).get(`/api/s3/object/${key}?exp=${linkExpiry()}&sig=forged`)).status).toBe(401);
    const other = `/api/s3/object/${key}?${signFileQuery('vehicle-photos/other.png')}`;
    expect((await request(ctx.app).get(other)).status).toBe(401); // a signature is bound to its key
    expect((await bearer(tokens['hd.claims'], 'get', `/s3/object/${key}`)).status).toBe(200);
    expect(verifyFileSignature(key, linkExpiry(), signFileQuery(key).split('sig=')[1])).toBe(true);
  });

  it('sends non-image, non-PDF files as attachments; legacy unsafe types as octet-stream', async () => {
    const csv = await bearer(tokens['hd.sales'], 'post', '/s3/upload').attach('file', Buffer.from('a,b\n1,2\n'), 'list.csv');
    const r = await bearer(tokens['hd.sales'], 'get', `/s3/object/${csv.body.data.key}`);
    expect(r.headers['content-disposition']).toMatch(/^attachment;/);
    expect(r.headers['content-security-policy']).toMatch(/sandbox/);
    // a document stored before the allow-list with a client-claimed text/html type
    await query("UPDATE documents SET content_type = 'text/html' WHERE storage_key = $1", [csv.body.data.key]);
    const legacy = await bearer(tokens['hd.sales'], 'get', `/s3/object/${csv.body.data.key}`);
    expect(legacy.headers['content-type']).toBe('application/octet-stream');
    expect(legacy.headers['content-disposition']).toMatch(/^attachment;/);
    const pdf = await bearer(tokens['hd.sales'], 'post', '/s3/upload').attach('file', PDF, 'policy.pdf');
    const p = await bearer(tokens['hd.sales'], 'get', `/s3/object/${pdf.body.data.key}`);
    expect(p.headers['content-type']).toMatch(/application\/pdf/);
    expect(p.headers['content-disposition']).toMatch(/^inline;/);
  });

  it('signs object URLs in every JSON response and replaces stale signatures', async () => {
    const stale = `http://h/api/s3/object/a/b.png?exp=1&sig=old&size=2`;
    const out = signUrlsInText(JSON.stringify({ u: stale, v: 'http://h/api/upload/file/print/x.pdf' }));
    const parsed = JSON.parse(out);
    expect(parsed.u).toMatch(/^http:\/\/h\/api\/s3\/object\/a\/b\.png\?exp=\d+&sig=[\w-]+&size=2$/);
    expect(parsed.u).not.toContain('sig=old');
    expect(parsed.v).toMatch(/^http:\/\/h\/api\/s3\/object\/print\/x\.pdf\?exp=\d+&sig=/);
    const map = await bearer(tokens['hd.claims'], 'post', '/s3/presigned-download-urls').send({ urls: [`${config.publicBaseUrl}/api/s3/object/${ids.photoKey}`] });
    const signed = Object.values(map.body.data)[0];
    expect(Object.keys(map.body.data)[0]).toBe(`${config.publicBaseUrl}/api/s3/object/${ids.photoKey}`);
    expect((await request(ctx.app).get(pathOf(signed))).status).toBe(200);
    const one = await bearer(tokens['hd.claims'], 'get', `/s3/file/${ids.photoKey}/public-url`);
    expect(one.body.url).toMatch(/\?exp=\d+&sig=/);
  });

  it('lets only the uploader, a writer of the owning module or an administrator replace or delete a file', async () => {
    expect(owningModule({ category: 'vehicle-photos' })).toBe('policies');
    expect(owningModule({ entity: 'claim', category: 'Police report' })).toBe('claims');
    expect(owningModule({ category: 'print' })).toBeNull();
    const key = ids.photoKey;
    // claims officers have read:policies only
    expect((await bearer(tokens['hd.claims'], 'put', `/s3/put/${key}`).set('Content-Type', 'image/png').send(PNG)).status).toBe(403);
    expect((await bearer(tokens['hd.claims'], 'delete', `/s3/file/${key}`)).status).toBe(403);
    // another sales user holds write:policies (the owning module)
    expect((await bearer(tokens['hd.sales2'], 'put', `/s3/put/${key}`).set('Content-Type', 'image/png').send(PNG)).status).toBe(200);
    // replacing with HTML is refused even for the uploader
    expect((await bearer(tokens['hd.sales'], 'put', `/s3/put/${key}`).set('Content-Type', 'image/png').send(HTML)).status).toBe(415);
    // a generated file (no owning module) can only be removed by its creator or an administrator
    const gen = await bearer(tokens['hd.sales'], 'post', '/s3/upload').field('folder', 'print').attach('file', PDF, 'x.pdf');
    expect((await bearer(tokens['hd.sales2'], 'delete', `/s3/file/${gen.body.data.key}`)).status).toBe(403);
    expect((await bearer(tokens['hd.sales'], 'delete', `/s3/file/${gen.body.data.key}`)).status).toBe(200);
    expect((await ctx.api('delete', `/s3/file/${key}`)).status).toBe(200);
    expect((await query("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'document' AND entity_id = $1", [key])).rows[0].n).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------ 2. passwords
describe('passwords', () => {
  it('generates a policy-compliant temporary password for a user created without one; it must be changed', async () => {
    const tp = temporaryPassword(await passwordPolicy());
    expect(policyProblems(tp, await passwordPolicy())).toEqual([]);
    expect(temporaryPassword()).not.toBe(temporaryPassword());
    const r = await ctx.api('post', '/users').send({ username: 'hd.new', displayName: 'New', email: 'hd.new@example.ph', roles: ['sales'] });
    expect(r.status).toBe(201);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.data).toMatchObject({ mustChangePassword: true, temporaryPassword: expect.any(String) });
    expect((await login('hd.new', 'Welcome@1')).status).toBe(401); // the old fixed default is gone
    const first = await login('hd.new', r.body.data.temporaryPassword);
    expect(first.body).toMatchObject({ passwordChangeRequired: true, mustChangePassword: true });
    expect(first.body.refreshToken).toBeUndefined();
    expect((await bearer(first.body.accessToken, 'get', '/policies')).status).toBe(403);
    expect((await bearer(first.body.accessToken, 'get', '/auth/password-policy')).status).toBe(200);
    const done = await bearer(first.body.accessToken, 'post', '/auth/change-password').send({ currentPassword: r.body.data.temporaryPassword, newPassword: 'MyOwn#Pass1' });
    expect(done.status).toBe(200);
    expect((await bearer(done.body.accessToken, 'get', '/policies')).status).toBe(200);
    // the audit trail never holds the temporary password
    const a = await query("SELECT after_data::text AS t FROM audit_log WHERE entity = 'user' AND entity_id = $1", [r.body.data.userId]);
    expect(a.rows.every((x) => !String(x.t).includes(r.body.data.temporaryPassword))).toBe(true);
  });

  it('administrator reset without a password returns a temporary one once and ends the user\'s sessions', async () => {
    const before = await login('hd.sales2', PW);
    const reset = await ctx.api('post', `/users/${ids['hd.sales2']}/reset-password`).send({});
    expect(reset.status).toBe(200);
    expect(reset.body.data).toMatchObject({ mustChangePassword: true, temporaryPassword: expect.any(String) });
    expect((await bearer(before.body.accessToken, 'get', '/policies')).status).toBe(401);
    expect((await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: before.body.refreshToken })).status).toBe(401);
    const next = await login('hd.sales2', reset.body.data.temporaryPassword);
    expect(next.body.passwordChangeRequired).toBe(true);
    const done = await bearer(next.body.accessToken, 'post', '/auth/change-password').send({ currentPassword: reset.body.data.temporaryPassword, newPassword: PW.replace('x', 'y') });
    expect(done.status).toBe(200);
    tokens['hd.sales2'] = done.body.accessToken;
  });
});

// ------------------------------------------------------------------------------------------------ 3. production config
describe('production start-up check', () => {
  const good = { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(48), DATA_ENCRYPTION_KEY: 'b'.repeat(48), CORS_ORIGINS: 'https://app.example.ph', PUBLIC_BASE_URL: 'https://api.example.ph' };
  const problems = (env) => productionConfigProblems(buildConfig(env), env);
  it('refuses missing or default secrets, CORS * and a localhost base URL in production only', () => {
    expect(problems(good)).toEqual([]);
    expect(problems({ ...good, JWT_SECRET: '' }).join()).toMatch(/JWT_SECRET is not set/);
    expect(problems({ ...good, JWT_SECRET: 'dev-only-secret-change-me' }).join()).toMatch(/placeholder/);
    expect(problems({ ...good, JWT_SECRET: 'short-secret' }).join()).toMatch(/at least 32/);
    expect(problems({ ...good, DATA_ENCRYPTION_KEY: undefined }).join()).toMatch(/DATA_ENCRYPTION_KEY is not set/);
    expect(problems({ ...good, DATA_ENCRYPTION_KEY: good.JWT_SECRET }).join()).toMatch(/differ/);
    expect(problems({ ...good, CORS_ORIGINS: '*' }).join()).toMatch(/CORS_ORIGINS/);
    expect(problems({ ...good, CORS_ORIGINS: undefined }).join()).toMatch(/CORS_ORIGINS/);
    expect(problems({ ...good, PUBLIC_BASE_URL: 'http://localhost:8000' }).join()).toMatch(/not localhost/);
    expect(problems({ ...good, PUBLIC_BASE_URL: 'http://127.0.0.1:8080/' }).join()).toMatch(/not localhost/);
    expect(problems({ NODE_ENV: 'development' })).toEqual([]);
    expect(problems({})).toEqual([]);
  });
  it('defaults: 30-minute access tokens; development keeps its fallbacks', () => {
    expect(buildConfig({}).accessTtl).toBe(1800);
    expect(buildConfig({ JWT_ACCESS_TTL_SECONDS: '900' }).accessTtl).toBe(900);
    expect(buildConfig({}).jwtSecret).toBe('dev-only-secret-change-me');
  });
  it('accepts only HS256 tokens', async () => {
    const t384 = jwt.sign({ sub: ids['hd.sales'], type: 'access', roles: ['system-admin'], permissions: [], tv: 0 }, config.jwtSecret, { algorithm: 'HS384' });
    expect((await bearer(t384, 'get', '/users')).status).toBe(401);
  });
});

// ------------------------------------------------------------------------------------------------ 4. logging
describe('log redaction', () => {
  it('never writes bearer tokens, cookies or link tokens to the log', async () => {
    const lines = [];
    const sink = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
    const log = pino({ redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, sink);
    log.info({ req: redactRequest({ url: '/api/reports/generated/1/download?token=SECRET-LINK&x=1', query: { token: 'SECRET-LINK' }, headers: { authorization: 'Bearer SECRET-TOKEN', cookie: 'sid=SECRET-COOKIE' } }) }, 'request completed');
    const out = lines.join('');
    expect(out).not.toMatch(/SECRET-(TOKEN|COOKIE|LINK)/);
    expect(out).toContain('[redacted]');
    expect(redactUrl('/api/s3/object/a.png?exp=1&sig=abc')).toBe('/api/s3/object/a.png?exp=1&sig=[redacted]');
  });
});

// ------------------------------------------------------------------------------------------------ 5. sessions
describe('sessions', () => {
  it('ends access at once on deactivation and on role change; refresh issues a token with the new roles', async () => {
    const s = await login('hd.uw', PW);
    expect((await bearer(s.body.accessToken, 'get', '/reinsurance/treaties')).status).not.toBe(401);
    expect((await ctx.api('put', `/users/${ids['hd.uw']}`).send({ roles: ['claims'] })).status).toBe(200);
    expect((await bearer(s.body.accessToken, 'get', '/policies')).status).toBe(401);
    const r = await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: s.body.refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.user.roles).toEqual(['claims']);
    expect((await bearer(r.body.accessToken, 'get', '/claims')).status).toBe(200);
    // an unchanged role list does not end the session
    expect((await ctx.api('put', `/users/${ids['hd.uw']}`).send({ roles: ['claims'], phone: '0917' })).status).toBe(200);
    expect((await bearer(r.body.accessToken, 'get', '/claims')).status).toBe(200);
    expect((await ctx.api('patch', `/users/${ids['hd.uw']}/status`).send({ status: 'inactive' })).status).toBe(200);
    expect((await bearer(r.body.accessToken, 'get', '/claims')).status).toBe(401);
    expect((await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: r.body.refreshToken })).status).toBe(401);
    expect((await ctx.api('patch', `/users/${ids['hd.uw']}/status`).send({ status: 'active' })).status).toBe(200);
  });

  it('role permission changes renew the tokens of the role\'s users', async () => {
    const created = await ctx.api('post', '/roles').send({ code: 'hd-role', name: 'HD role', permissions: ['read:leads'] });
    expect(created.status).toBe(201);
    await makeUser('hd.role', ['hd-role']);
    expect((await bearer(tokens['hd.role'], 'get', '/leads')).status).toBe(200);
    expect((await ctx.api('put', '/roles/hd-role').send({ permissions: ['read:clients'] })).status).toBe(200);
    expect((await bearer(tokens['hd.role'], 'get', '/leads')).status).toBe(401);
  });

  it('detects reuse of a rotated refresh token and revokes the whole sign-in', async () => {
    const s = await login('hd.claims', PW);
    const r1 = await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: s.body.refreshToken });
    expect(r1.status).toBe(200);
    // within the grace period (two tabs refreshing together) the old token is just refused
    expect((await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: s.body.refreshToken })).status).toBe(401);
    expect((await bearer(r1.body.accessToken, 'get', '/claims')).status).toBe(200);
    // later, a replay means the token was copied: the family and every access token are revoked
    const { jti } = jwt.decode(s.body.refreshToken);
    await query("UPDATE refresh_tokens SET revoked_at = now() - interval '5 minutes' WHERE jti = $1", [jti]);
    const replay = await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: s.body.refreshToken });
    expect(replay.status).toBe(401);
    expect((await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken })).status).toBe(401);
    expect((await bearer(r1.body.accessToken, 'get', '/claims')).status).toBe(401);
    expect((await query("SELECT count(*)::int AS n FROM audit_log WHERE action = 'refresh-token-reuse' AND entity_id = $1", [ids['hd.claims']])).rows[0].n).toBe(1);
    tokens['hd.claims'] = await loginAs(ctx.app, 'hd.claims', PW);
  });
});

// ------------------------------------------------------------------------------------------------ 6. reset codes and 2FA secrets
describe('reset codes and two-factor secrets at rest', () => {
  it('stores reset codes hashed, keeps only the latest valid, withdraws a code after too many wrong entries', async () => {
    const forgot = () => request(ctx.app).post('/api/auth/forgot-password').send({ username: 'hd.sales' });
    const lastCode = async () => (await query("SELECT body_html FROM email_outbox WHERE template = 'password-reset' AND entity_id = $1 ORDER BY id DESC LIMIT 1", [ids['hd.sales']])).rows[0].body_html.match(/<b>(\d{6})<\/b>/)[1];
    resetRateLimits();
    await forgot();
    const first = await lastCode();
    await forgot();
    const second = await lastCode();
    const rows = (await query('SELECT code, code_hash FROM password_resets WHERE user_id = $1', [ids['hd.sales']])).rows;
    expect(rows.every((r) => r.code === null && /^[0-9a-f]{64}$/.test(r.code_hash))).toBe(true);
    expect(rows.some((r) => r.code_hash === hashCode(first, ids['hd.sales']))).toBe(true);
    const reset = (code, newPassword = 'Reset#Pass9') => request(ctx.app).post('/api/auth/reset-password').send({ username: 'hd.sales', code, newPassword });
    if (first !== second) expect((await reset(first)).status).toBe(400); // the earlier code was withdrawn
    const session = await login('hd.sales', PW);
    expect((await reset(second)).status).toBe(200);
    expect((await reset(second, 'Again#Pass9')).status).toBe(400); // used
    expect((await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: session.body.refreshToken })).status).toBe(401);
    resetRateLimits();
    await forgot();
    const third = await lastCode();
    const wrong = third === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i += 1) expect((await reset(wrong)).status).toBe(400);
    expect((await reset(third)).status).toBe(400); // withdrawn after security.reset_code_max_attempts
    resetRateLimits();
    tokens['hd.sales'] = await loginAs(ctx.app, 'hd.sales', 'Reset#Pass9');
  });

  it('encrypts TOTP secrets with DATA_ENCRYPTION_KEY', async () => {
    const enc = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(enc).toMatch(/^enc:v1:/);
    expect(enc).not.toBe(encryptSecret('JBSWY3DPEHPK3PXP'));
    expect(decryptSecret(enc)).toBe('JBSWY3DPEHPK3PXP');
    expect(decryptSecret('LEGACYPLAIN')).toBe('LEGACYPLAIN');
    expect(() => decryptSecret(enc, 'another-key')).toThrow();
    const s = await bearer(tokens['hd.claims'], 'post', '/auth/2fa/setup');
    const row = (await query('SELECT totp_pending_secret FROM users WHERE id = $1', [ids['hd.claims']])).rows[0];
    expect(row.totp_pending_secret).toMatch(/^enc:v1:/);
    expect(row.totp_pending_secret).not.toContain(s.body.data.secret);
    expect(decryptSecret(row.totp_pending_secret)).toBe(s.body.data.secret);
  });

  it('rate limits two-factor code checks of a signed-in user', async () => {
    await setSettings({ 'security.login_rate_limit': { max: 3, windowSeconds: 60 } });
    resetRateLimits();
    for (let i = 0; i < 3; i += 1) expect((await bearer(tokens['hd.claims'], 'post', '/auth/2fa/enable').send({ code: '000000' })).status).toBe(400);
    expect((await bearer(tokens['hd.claims'], 'post', '/auth/2fa/enable').send({ code: '000000' })).status).toBe(429);
    await setSettings({ 'security.login_rate_limit': { max: 10, windowSeconds: 300 } });
    resetRateLimits();
  });
});

// ------------------------------------------------------------------------------------------------ 8. user administration
describe('user administration', () => {
  it('unlocks a locked account and records it', async () => {
    await query("UPDATE users SET status = 'locked', failed_logins = 5 WHERE id = $1", [ids['hd.role']]);
    const r = await bearer(tokens['hd.uaa'], 'patch', `/users/${ids['hd.role']}/status`).send({ status: 'active' });
    expect(r.status).toBe(200);
    expect(r.body.message).toBe('User unlocked');
    expect((await query('SELECT status, failed_logins FROM users WHERE id = $1', [ids['hd.role']])).rows[0]).toEqual({ status: 'active', failed_logins: 0 });
    expect((await login('hd.role', PW)).status).toBe(200);
  });

  it('a non-administrator user desk cannot reset, lock or turn off 2FA of a System Administrator, nor change their own access', async () => {
    const admin = (await query("SELECT id FROM users WHERE username = 'BrokerVerse'")).rows[0].id;
    const uaa = (m, p) => bearer(tokens['hd.uaa'], m, p);
    expect((await uaa('post', `/users/${admin}/reset-password`).send({})).status).toBe(403);
    expect((await uaa('post', `/users/${admin}/password`).send({ password: 'Takeover#123' })).status).toBe(403);
    expect((await uaa('patch', `/users/${admin}/status`).send({ status: 'locked' })).status).toBe(403);
    expect((await uaa('post', `/users/${admin}/2fa/reset`)).status).toBe(403);
    expect((await uaa('put', `/users/${admin}`).send({ email: 'attacker@example.ph' })).status).toBe(403);
    expect((await uaa('post', `/users/${ids['hd.uaa']}/reset-password`).send({})).status).toBe(403);
    expect((await uaa('patch', `/users/${ids['hd.uaa']}/status`).send({ status: 'active' })).status).toBe(403);
    // but can manage ordinary users
    const ok = await uaa('post', `/users/${ids['hd.role']}/reset-password`).send({});
    expect(ok.status).toBe(200);
    expect(ok.body.data.temporaryPassword).toBeTruthy();
    expect((await uaa('post', `/users/${ids['hd.role']}/2fa/reset`)).status).toBe(200);
    expect((await uaa('get', `/users/${ids['hd.role']}/login-history`)).status).toBe(200);
    expect((await bearer(tokens['hd.claims'], 'post', `/users/${ids['hd.role']}/reset-password`).send({})).status).toBe(403);
  });

  it('only a System Administrator grants the administrator role or edits it; nobody changes their own roles or status', async () => {
    const uaa = (m, p) => bearer(tokens['hd.uaa'], m, p);
    expect((await uaa('post', '/users').send({ username: 'hd.sneaky', password: PW, displayName: 'X', roles: ['system-admin'] })).status).toBe(403);
    expect((await uaa('put', `/users/${ids['hd.role']}`).send({ roles: ['system-admin'] })).status).toBe(403);
    expect((await uaa('put', '/roles/system-admin').send({ permissions: [] })).status).toBe(403);
    expect((await uaa('put', '/roles/user-desk').send({ permissions: ['read:users', 'write:users', 'read:receipts'] })).status).toBe(403);
    // an administrator cannot change their own roles or lock themselves either; saving the same roles is fine
    const admin = (await query("SELECT id FROM users WHERE username = 'BrokerVerse'")).rows[0].id;
    expect((await ctx.api('put', `/users/${admin}`).send({ roles: ['sales'] })).status).toBe(403);
    expect((await ctx.api('patch', `/users/${admin}/status`).send({ status: 'locked' })).status).toBe(403);
    expect((await ctx.api('put', `/users/${admin}`).send({ displayName: 'BrokerVerse Administrator', roles: ['system-admin'] })).status).toBe(200);
    // a second System Administrator can
    const second = await makeUser('hd.admin2', ['system-admin']);
    expect((await bearer(tokens['hd.admin2'], 'put', `/users/${ids['hd.role']}`).send({ roles: ['sales'] })).status).toBe(200);
    expect(second.roles).toEqual(['system-admin']);
  });
});

// ------------------------------------------------------------------------------------------------ 9. DoS limits
describe('upload and request limits', () => {
  it('caps workbook decompression and import rows', () => {
    const bomb = zlib.deflateRawSync(Buffer.alloc(config.importMaxInflatedBytes + 1024));
    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(() => inflateEntry(bomb, 8)).toThrow(/too large when uncompressed/);
    expect(inflateEntry(zlib.deflateRawSync(Buffer.from('ok')), 8).toString()).toBe('ok');
    expect(() => assertRowLimit(config.importMaxRows + 1)).toThrow(/more than/);
    const rows = `a,b\n${'1,2\n'.repeat(config.importMaxRows + 1)}`;
    expect(() => parseUploadedRows({ buffer: Buffer.from(rows), originalname: 'x.csv' })).toThrow(/more than/);
    expect(parseUploadedRows({ buffer: Buffer.from('a,b\n1,2\n'), originalname: 'x.csv' })).toEqual([{ a: '1', b: '2' }]);
  });

  it('refuses uploads above UPLOAD_MAX_MB with 413', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(config.uploadMaxBytes + 10)]);
    const r = await bearer(tokens['hd.claims'], 'post', '/s3/upload').attach('file', big, 'big.pdf');
    expect(r.status).toBe(413);
  });

  it('applies a configurable global API rate limit per user', async () => {
    await setSettings({ 'security.api_rate_limit': { max: 5, windowSeconds: 60 } });
    resetRateLimits();
    const codes = [];
    for (let i = 0; i < 7; i += 1) codes.push((await bearer(tokens['hd.claims'], 'get', '/auth/profile')).status);
    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes[6]).toBe(429);
    expect((await request(ctx.app).get('/api/health')).status).toBe(200);
    resetRateLimits();
    await setSettings({ 'security.api_rate_limit': { max: 600, windowSeconds: 60 } });
    resetRateLimits();
  });
});

// ------------------------------------------------------------------------------------------------ 10. registry
describe('route registry', () => {
  const PUBLIC = new Set([
    'GET /version', 'POST /auth/login', 'POST /auth/login/2fa', 'POST /auth/refresh', 'POST /auth/logout', 'GET /auth/password-policy',
    'POST /auth/forgot-password', 'POST /auth/reset-password', 'POST /quotations/approve-by-customer', 'GET /quotations/approve-by-customer',
    'GET /reports/generated/:id/download', 'GET /settings/public', 'GET /system-settings/', 'GET /s3/object/*', 'GET /upload/file/*',
    // client checkout by the payment link's random token, and the gateways' signed webhooks / postbacks
    'GET /public/payments/:token', 'POST /public/payments/:token/sandbox', 'GET /public/payments/:token/policy.pdf',
    'POST /public/payments/webhooks/:gateway', 'GET /public/payments/webhooks/:gateway',
  ]);
  it('declares only the intended public routes', () => {
    const open = ROUTES.filter((r) => !r.auth).map((r) => `${r.method} ${r.path}`);
    expect(open.filter((r) => !PUBLIC.has(r))).toEqual([]);
  });
  it('every non-public route answers 401 without a token', async () => {
    // several hundred anonymous requests from one address: more than the per-minute API limit, so it is off here
    await setSettings({ 'security.api_rate_limit': { max: 0, windowSeconds: 60 } });
    resetRateLimits();
    const failures = [];
    try {
      for (const r of ROUTES.filter((x) => x.auth)) {
        const p = r.path.replace(/:\w+(\([^)]*\))?\??/g, '1').replace(/\*/g, 'x/y');
        const res = await request(ctx.app)[r.method.toLowerCase()](`/api${p}`);
        if (res.status !== 401) failures.push(`${r.method} ${r.path} -> ${res.status}`);
      }
    } finally {
      await setSettings({ 'security.api_rate_limit': { max: 600, windowSeconds: 60 } });
      resetRateLimits();
    }
    expect(failures).toEqual([]);
    expect(ROUTES.filter((x) => x.auth).length).toBeGreaterThan(500);
  });
  it('records the permissions required by middleware in the registry', () => {
    const find = (m, p) => ROUTES.find((r) => r.method === m && r.path === p);
    expect(find('GET', '/users/').permissions).toEqual(['read:users']);
    expect(find('POST', '/users/').permissions).toEqual(['write:users']);
    expect(find('PUT', '/roles/:id').permissions).toEqual(['write:roles']);
    expect(ROUTES.filter((r) => r.permissions.length || r.roles.length).length).toBeGreaterThan(450);
  });
});

// ------------------------------------------------------------------------------------------------ 13. read scope
describe('least-privilege reads', () => {
  it('claims officers do not list leads; sales and operations do not read the receipt register', async () => {
    const cs = await makeUser('hd.cs', ['operations']);
    expect(cs.roles).toEqual(['operations']);
    expect((await bearer(tokens['hd.claims'], 'get', '/leads')).status).toBe(403);
    expect((await bearer(tokens['hd.claims'], 'get', '/policies')).status).toBe(200);
    for (const u of ['hd.sales', 'hd.cs']) {
      expect((await bearer(tokens[u], 'get', '/receipts')).status).toBe(403);
      expect((await bearer(tokens[u], 'get', '/policies/payment-captures')).status).toBe(403);
      expect((await bearer(tokens[u], 'get', '/policies')).status).toBe(200);
    }
  });
  it('migration 0091 removes the grants from an existing database', async () => {
    await query(`INSERT INTO role_permissions(role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p
      WHERE (r.code = 'claims' AND p.code = 'read:leads') OR (r.code = 'sales' AND p.code = 'read:receipts') ON CONFLICT DO NOTHING`);
    const fs = await import('node:fs');
    await query(fs.readFileSync(new URL('../src/db/migrations/0091_least_privilege_reads.sql', import.meta.url), 'utf8'));
    const left = await query(`SELECT r.code, p.code AS perm FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE (r.code = 'claims' AND p.code = 'read:leads') OR (r.code = 'sales' AND p.code = 'read:receipts')`);
    expect(left.rows).toEqual([]);
    for (const u of ['hd.sales', 'hd.cs', 'hd.claims']) tokens[u] = await loginAs(ctx.app, u, u === 'hd.sales' ? 'Reset#Pass9' : PW);
  });
});

// ------------------------------------------------------------------------------------------------ 11. errors
describe('error bodies', () => {
  it('answers 500 with a generic message and the request id; client errors keep their message', async () => {
    const app = express();
    const logged = [];
    app.use((req, _res, next) => { req.id = 'req-500'; req.log = { error: (o) => logged.push(o) }; next(); });
    app.get('/boom', () => { throw new Error('relation "secret_table" does not exist'); });
    app.get('/bad', () => { throw Object.assign(new Error('Amount is required'), { status: 400 }); });
    app.use(errorHandler);
    const r = await request(app).get('/boom');
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ success: false, message: expect.stringMatching(/^Internal server error/), requestId: 'req-500' });
    expect(JSON.stringify(r.body)).not.toContain('secret_table');
    expect(logged[0].err.message).toContain('secret_table');
    expect((await request(app).get('/bad')).body.message).toBe('Amount is required');
  });
});
