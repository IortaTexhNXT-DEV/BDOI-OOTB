/** Operations: build / runtime information for monitoring and support (GET /api/version, no sign-in). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleRouter } from '../../lib/registry.js';
import { pool } from '../../db/pool.js';
import { pendingMigrations } from '../../db/migrate.js';

const { router, define } = moduleRouter('System', '');
const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', 'package.json'), 'utf8'));
const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();

define({
  method: 'GET', path: '/version', auth: false, summary: 'Build and runtime information: name, version, git commit (GIT_COMMIT), start time, Node version, database reachability, pending migrations',
  screen: 'Operations / monitoring',
  response: { name: 'brokerverse-backend', version: '1.0.0', commit: 'a1b2c3d', startedAt: '2026-09-28T00:00:00.000Z', uptimeSeconds: 3600, node: 'v20.18.0', database: { reachable: true, latencyMs: 2 }, pendingMigrations: 0 },
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
      name: pkg.name, version: pkg.version, commit: process.env.GIT_COMMIT || null, startedAt, uptimeSeconds: Math.round(process.uptime()),
      node: process.version, environment: process.env.NODE_ENV || 'development',
      database: { reachable, latencyMs: reachable ? Date.now() - t0 : null, ...(error ? { error } : {}) }, pendingMigrations: pending,
    });
  },
});

export default router;
export const order = 1;
