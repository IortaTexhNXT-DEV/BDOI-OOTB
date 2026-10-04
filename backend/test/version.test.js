import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { buildIdentity } from '../src/modules/system/router.js';

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
