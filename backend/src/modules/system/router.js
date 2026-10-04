/** Operations: build / runtime information for monitoring and support (GET /api/version, no sign-in). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleRouter } from '../../lib/registry.js';
import { pool } from '../../db/pool.js';
import { pendingMigrations } from '../../db/migrate.js';

const { router, define } = moduleRouter('System', '');
const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, '..', '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));
const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();

/** build-info.json, written into the release artefact by CI (.github/workflows/ci.yml); absent in a source checkout. */
const readBuildInfo = () => {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(backendRoot, 'build-info.json'), 'utf8'));
    return info && typeof info === 'object' ? info : {};
  } catch {
    return {};
  }
};
const buildInfo = readBuildInfo();

/**
 * Build identity: the environment variables win (GIT_COMMIT, BUILD_TIME, GIT_REF, APP_ENVIRONMENT), then
 * build-info.json. The deployment pipeline compares `commit` with the commit it deployed (post-deploy smoke test).
 */
export const buildIdentity = (env = process.env, info = buildInfo) => ({
  commit: env.GIT_COMMIT || info.commit || null,
  buildTime: env.BUILD_TIME || info.buildTime || null,
  ref: env.GIT_REF || info.ref || null,
  appEnvironment: env.APP_ENVIRONMENT || null,
});

define({
  method: 'GET', path: '/version', auth: false, summary: 'Build and runtime information: name, version, git commit (GIT_COMMIT), build time (BUILD_TIME), release ref (GIT_REF), environment name (APP_ENVIRONMENT), start time, Node version, database reachability, pending migrations',
  screen: 'Operations / monitoring',
  response: { name: 'brokerverse-backend', version: '1.0.0', commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', buildTime: '2026-09-27T23:10:00Z', ref: 'v1.2.0', appEnvironment: 'UAT', startedAt: '2026-09-28T00:00:00.000Z', uptimeSeconds: 3600, node: 'v20.18.0', database: { reachable: true, latencyMs: 2 }, pendingMigrations: 0 },
  handler: async (_req, res) => {
    const t0 = Date.now();
    let reachable = false;
    let pending = null;
    let error;
    try {
      await pool.query('SELECT 1');
      reachable = true;
      pending = (await pendingMigrations()).length;
    } catch (e) { error = e.code || 'unreachable'; }
    res.json({
      name: pkg.name, version: pkg.version, ...buildIdentity(), startedAt, uptimeSeconds: Math.round(process.uptime()),
      node: process.version, environment: process.env.NODE_ENV || 'development',
      database: { reachable, latencyMs: reachable ? Date.now() - t0 : null, ...(error ? { error } : {}) }, pendingMigrations: pending,
    });
  },
});

export default router;
export const order = 1;
