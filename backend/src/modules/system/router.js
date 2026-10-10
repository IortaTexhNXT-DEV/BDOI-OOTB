/** Operations: build / runtime information for monitoring and support (GET /api/version, no sign-in). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleRouter } from '../../lib/registry.js';
import { pool } from '../../db/pool.js';
import { pendingMigrations } from '../../db/migrate.js';
import { getSetting } from '../../lib/settings.js';
import { authenticate } from '../../lib/auth.js';

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

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Release identity shown in Help > About (settings release.*, Master > Configuration): the web and API releases (the
 * API release falls back to the package version, the web release to the version of the web build, shown by the front
 * end), the environment name (APP_ENVIRONMENT wins over release.environment_label) and, for a signed-in user only, the
 * approvers of the release; an approver not set is left out.
 */
export const releaseIdentity = async ({ env = process.env, signedIn = false } = {}) => {
  const [webVersion, apiVersion, environment, requirementsApprover, versionApprover] = await Promise.all(
    ['release.web_version', 'release.api_version', 'release.environment_label', 'release.requirements_approver', 'release.version_approver']
      .map((k) => getSetting(k, '').then(text)),
  );
  return {
    webVersion: webVersion || null,
    apiVersion: apiVersion || pkg.version,
    environment: text(env.APP_ENVIRONMENT) || environment || null,
    ...(signedIn && requirementsApprover ? { requirementsApprover } : {}),
    ...(signedIn && versionApprover ? { versionApprover } : {}),
  };
};

const signedIn = async (req) => {
  if (!req.headers.authorization) return false;
  try {
    await authenticate(req);
    return true;
  } catch {
    return false;
  }
};

define({
  method: 'GET', path: '/version', auth: false, summary: 'Build and runtime information: name, version, git commit (GIT_COMMIT), build time (BUILD_TIME), release ref (GIT_REF), environment name (APP_ENVIRONMENT), start time, Node version, database reachability, pending migrations; release: the release identity of Help > About (settings release.*: web and API release, environment name, and with a bearer token the approvers of the release)',
  screen: 'Operations / monitoring; Help > About',
  response: { name: 'brokerverse-backend', version: '2026.1.3', commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', buildTime: '2026-09-27T23:10:00Z', ref: 'v1.2.0', appEnvironment: 'UAT', startedAt: '2026-09-28T00:00:00.000Z', uptimeSeconds: 3600, node: 'v20.18.0', database: { reachable: true, latencyMs: 2 }, pendingMigrations: 0,
    release: { webVersion: 'PH-WEB-2026.1.3', apiVersion: 'PH-API-2026.1.3', environment: 'Development', requirementsApprover: 'Andrew', versionApprover: 'Vijay' } },
  handler: async (req, res) => {
    const t0 = Date.now();
    let reachable = false;
    let pending = null;
    let error;
    let release = { webVersion: null, apiVersion: pkg.version, environment: text(process.env.APP_ENVIRONMENT) || null };
    try {
      await pool.query('SELECT 1');
      reachable = true;
      pending = (await pendingMigrations()).length;
    } catch (e) { error = e.code || 'unreachable'; }
    // the release settings are read only from a reachable database; without them the build's own versions are shown
    if (reachable) release = await releaseIdentity({ signedIn: await signedIn(req) }).catch(() => release);
    res.json({
      name: pkg.name, version: pkg.version, ...buildIdentity(), startedAt, uptimeSeconds: Math.round(process.uptime()),
      node: process.version, environment: process.env.NODE_ENV || 'development',
      database: { reachable, latencyMs: reachable ? Date.now() - t0 : null, ...(error ? { error } : {}) }, pendingMigrations: pending, release,
    });
  },
});

export default router;
export const order = 1;
