import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { loginAs, setup } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { buildIdentity } from '../src/modules/system/router.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { seed } from '../src/db/seed.js';

// GET /api/version: the deployment pipeline's post-deploy smoke test compares `commit` with the commit it deployed.
let ctx;
const saved = {};
const KEYS = ['GIT_COMMIT', 'BUILD_TIME', 'GIT_REF', 'APP_ENVIRONMENT'];

beforeAll(async () => {
  ctx = await setup();
  for (const k of KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
afterAll(async () => { await pool.end(); });

describe('GET /api/version', () => {
  it('reports the commit, build time, release ref and environment from the environment variables, without sign-in', async () => {
    process.env.GIT_COMMIT = '0123456789abcdef0123456789abcdef01234567';
    process.env.BUILD_TIME = '2026-10-04T01:02:03Z';
    process.env.GIT_REF = 'v1.4.0';
    process.env.APP_ENVIRONMENT = 'UAT';
    const r = await request(ctx.app).get('/api/version');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      name: 'brokerverse-backend',
      commit: '0123456789abcdef0123456789abcdef01234567',
      buildTime: '2026-10-04T01:02:03Z',
      ref: 'v1.4.0',
      appEnvironment: 'UAT',
      database: { reachable: true },
      pendingMigrations: 0,
    });
    expect(r.body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('answers null for an unknown build rather than failing', async () => {
    for (const k of KEYS) delete process.env[k];
    const r = await request(ctx.app).get('/api/version');
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('commit');
    expect(r.body).toHaveProperty('buildTime');
  });
});

// Help > About: the release identity of settings release.* (TISPH values of seeds/92_tisph_release.sql).
describe('GET /api/version release', () => {
  const setRelease = async (values) => {
    for (const [k, v] of Object.entries(values)) await pool.query('UPDATE app_settings SET value = $2 WHERE key = $1', [k, JSON.stringify(v)]);
    clearSettingsCache();
  };
  const TISPH = {
    'release.web_version': 'PH-WEB-2026.1.3', 'release.api_version': 'PH-API-2026.1.3', 'release.environment_label': 'Development',
    'release.requirements_approver': 'Andrew', 'release.version_approver': 'Vijay',
  };
  afterEach(() => setRelease(TISPH));

  it('gives the TISPH release, environment and approvers to a signed-in user', async () => {
    delete process.env.APP_ENVIRONMENT;
    clearSettingsCache();
    const r = await ctx.api('get', '/version');
    expect(r.status).toBe(200);
    expect(r.body.release).toEqual({
      webVersion: 'PH-WEB-2026.1.3', apiVersion: 'PH-API-2026.1.3', environment: 'Development', requirementsApprover: 'Andrew', versionApprover: 'Vijay',
    });
  });

  it('leaves the approvers out without sign-in or with an invalid token', async () => {
    delete process.env.APP_ENVIRONMENT;
    clearSettingsCache();
    const anonymous = await request(ctx.app).get('/api/version');
    expect(anonymous.body.release).toEqual({ webVersion: 'PH-WEB-2026.1.3', apiVersion: 'PH-API-2026.1.3', environment: 'Development' });
    const forged = await request(ctx.app).get('/api/version').set('Authorization', 'Bearer not-a-token');
    expect(forged.status).toBe(200);
    expect(forged.body.release).not.toHaveProperty('requirementsApprover');
  });

  it('lets APP_ENVIRONMENT win over the environment name of the settings', async () => {
    process.env.APP_ENVIRONMENT = 'UAT';
    const r = await ctx.api('get', '/version');
    expect(r.body.release.environment).toBe('UAT');
    expect(r.body.appEnvironment).toBe('UAT');
  });

  it('falls back to the package version for an API release not set, and hides an approver not set', async () => {
    delete process.env.APP_ENVIRONMENT;
    await setRelease({ 'release.web_version': '', 'release.api_version': ' ', 'release.environment_label': '', 'release.version_approver': '' });
    const r = await ctx.api('get', '/version');
    expect(r.body.release).toEqual({ webVersion: null, apiVersion: r.body.version, environment: null, requirementsApprover: 'Andrew' });
  });

  it('takes a change saved on Master > Configuration, records it in the audit trail and keeps it when seeding again', async () => {
    delete process.env.APP_ENVIRONMENT;
    const save = await ctx.api('put', '/settings').send({ settings: { 'release.environment_label': 'SIT', 'release.version_approver': 'Maria Santos' } });
    expect(save.status).toBe(200);
    const row = save.body.data.find((s) => s.key === 'release.environment_label');
    expect(row).toMatchObject({ group: 'release', value: 'SIT', editable: true });
    clearSettingsCache();
    const r = await ctx.api('get', '/version');
    expect(r.body.release).toMatchObject({ environment: 'SIT', versionApprover: 'Maria Santos' });
    const { rows } = await pool.query("SELECT after_data FROM audit_log WHERE entity = 'settings' AND action = 'update' ORDER BY id DESC LIMIT 1");
    expect(rows[0].after_data).toEqual({ 'release.environment_label': 'SIT', 'release.version_approver': 'Maria Santos' });
    await seed({ log: () => {} });
    const kept = await pool.query("SELECT value FROM app_settings WHERE key = 'release.environment_label'");
    expect(kept.rows[0].value).toBe('SIT');
  });

  it('is changed by an administrator only', async () => {
    expect((await request(ctx.app).put('/api/settings').send({ settings: { 'release.environment_label': 'Production' } })).status).toBe(401);
    const user = await ctx.api('post', '/users').send({ username: 'rel.finance', password: 'Release#2026a', displayName: 'Finance user', roles: ['tis-finance'], email: 'rel.finance@example.ph' });
    expect(user.status).toBe(201);
    const token = await loginAs(ctx.app, 'rel.finance', 'Release#2026a');
    const r = await request(ctx.app).put('/api/settings').set('Authorization', `Bearer ${token}`).send({ settings: { 'release.environment_label': 'Production' } });
    expect(r.status).toBe(403);
    clearSettingsCache();
    expect((await request(ctx.app).get('/api/version').set('Authorization', `Bearer ${token}`)).body.release).toMatchObject({ environment: 'Development', versionApprover: 'Vijay' });
  });
});

describe('buildIdentity', () => {
  it('takes build-info.json from the release artefact when the variables are not set', () => {
    expect(buildIdentity({}, { commit: 'abc123', buildTime: '2026-10-01T00:00:00Z', ref: 'brokerverse-platform' })).toEqual({
      commit: 'abc123', buildTime: '2026-10-01T00:00:00Z', ref: 'brokerverse-platform', appEnvironment: null,
    });
  });

  it('lets the environment variables win over build-info.json', () => {
    expect(buildIdentity({ GIT_COMMIT: 'fff', BUILD_TIME: 't', APP_ENVIRONMENT: 'SIT' }, { commit: 'abc', buildTime: 'x' })).toMatchObject({
      commit: 'fff', buildTime: 't', appEnvironment: 'SIT',
    });
    expect(buildIdentity({}, {})).toEqual({ commit: null, buildTime: null, ref: null, appEnvironment: null });
  });
});
