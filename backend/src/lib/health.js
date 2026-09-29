/**
 * Health and readiness for load balancers and orchestrators (no sign-in, not rate limited, not logged).
 *
 *   GET /api/health       readiness: 200 when the instance is ready (startup finished: migrations and seed applied, no
 *                         pending migrations) and PostgreSQL answers; 503 otherwise (starting, shutting down, database
 *                         down). Body: { status, ready, time, uptimeSeconds, database: { reachable, latencyMs }, pendingMigrations }.
 *   GET /api/health/live  liveness: 200 while the process serves HTTP (no database check), for restart probes.
 */
import { pool } from '../db/pool.js';
import { pendingMigrations } from '../db/migrate.js';

// Instances built by createApp() are ready unless the server says otherwise: server.js marks the instance not ready
// before migrations and seed, ready once they are applied, and not ready again when it starts shutting down.
let started = true;
export const setReady = (value) => { started = Boolean(value); };

// Once every migration file is applied the answer cannot change while this process runs (files are fixed at build).
let migrationsDone = false;

const DB_TIMEOUT_MS = Number(process.env.HEALTH_DB_TIMEOUT_MS) > 0 ? Number(process.env.HEALTH_DB_TIMEOUT_MS) : 2000;

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms); })])
    .finally(() => clearTimeout(timer));
}

/** Readiness report (also used by tests). */
export async function healthReport() {
  const t0 = Date.now();
  let reachable = false;
  let latencyMs = null;
  let pending = migrationsDone ? 0 : null;
  let error;
  try {
    await withTimeout(pool.query('SELECT 1'), DB_TIMEOUT_MS);
    reachable = true;
    latencyMs = Date.now() - t0;
    if (!migrationsDone) {
      pending = (await withTimeout(pendingMigrations(), DB_TIMEOUT_MS)).length;
      migrationsDone = pending === 0;
    }
  } catch (e) {
    error = e.code || 'unreachable';
  }
  const ready = started && reachable && pending === 0;
  return {
    status: ready ? 'ok' : !started ? 'starting' : 'unavailable',
    ready,
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: { reachable, latencyMs, ...(error ? { error } : {}) },
    pendingMigrations: pending,
  };
}

export async function healthHandler(_req, res) {
  const report = await healthReport();
  res.status(report.ready ? 200 : 503).set('Cache-Control', 'no-store').json(report);
}

export function livenessHandler(_req, res) {
  res.set('Cache-Control', 'no-store').json({ status: 'ok', time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) });
}
