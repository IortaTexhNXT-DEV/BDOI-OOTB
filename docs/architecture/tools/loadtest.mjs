/**
 * Indicative load test for the BrokerVerse API (docs/architecture, document 06).
 *
 * Starts an in-process instance of the API (createApp from backend/src/app.js) on an ephemeral 127.0.0.1 port, so the
 * running system on :8000 / :5080 is not touched, signs an access token for the administrator the same way the backend
 * tests do (lib/auth.js signAccess), and drives read-only requests at a fixed concurrency for a fixed time per endpoint.
 * The global API rate limit (security.api_rate_limit) is per process; the harness clears its counters every 100 ms
 * with the test hook resetRateLimits() so the limiter does not cap the measurement.
 *
 * Usage (from the repository root):
 *   DATABASE_URL=postgres://... LOG_LEVEL=warn node docs/architecture/tools/loadtest.mjs [seconds=10] [concurrency=10]
 * Output: a JSON summary on stdout (also written to docs/architecture/tools/loadtest-results-c<concurrency>.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, '../../../backend/src');
const imp = (p) => import(pathToFileURL(path.join(backend, p)).href);

const seconds = Number(process.argv[2] || 10);
const concurrency = Number(process.argv[3] || 10);

const { createApp } = await imp('app.js');
const { signAccess, loadUser } = await imp('lib/auth.js');
const { resetRateLimits } = await imp('lib/rateLimit.js');
const { pool } = await imp('db/pool.js');

const admin = await loadUser('u.username = $1', ['BrokerVerse']);
if (!admin) throw new Error('administrator BrokerVerse not found');
const token = signAccess(admin);
const app = await createApp();
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}/api`;
const timer = setInterval(resetRateLimits, 100);

const auth = { Authorization: `Bearer ${token}` };
const json = { ...auth, 'Content-Type': 'application/json' };
const today = new Date().toISOString().slice(0, 10);
const endpoints = [
  { name: 'GET /health (readiness, DB ping)', url: '/health' },
  { name: 'GET /health/live (liveness)', url: '/health/live' },
  { name: 'GET /policies?page=1&perPage=10', url: '/policies?page=1&perPage=10', headers: auth },
  { name: 'GET /leads?page=1&perPage=10', url: '/leads?page=1&perPage=10', headers: auth },
  { name: 'GET /claims?page=1&perPage=10', url: '/claims?page=1&perPage=10', headers: auth },
  { name: 'GET /dashboard/executive', url: '/dashboard/executive', headers: auth },
  { name: 'GET /notifications/unread-count', url: '/notifications/unread-count', headers: auth },
  { name: 'GET /search?q=santos', url: '/search?q=santos', headers: auth },
  { name: 'POST /reports/production-register/run (on-screen preview)', url: '/reports/production-register/run', method: 'POST', headers: json,
    body: JSON.stringify({ FromDate: `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`, ToDate: today, page: 1, perPage: 50 }) },
];

const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];
const results = [];
for (const ep of endpoints) {
  const lat = [];
  let errors = 0;
  const statuses = {};
  const end = Date.now() + seconds * 1000;
  const worker = async () => {
    while (Date.now() < end) {
      const t0 = performance.now();
      try {
        const r = await fetch(base + ep.url, { method: ep.method || 'GET', headers: ep.headers, body: ep.body });
        await r.arrayBuffer();
        statuses[r.status] = (statuses[r.status] || 0) + 1;
        if (r.status >= 400) errors += 1;
      } catch { errors += 1; }
      lat.push(performance.now() - t0);
    }
  };
  const started = Date.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsed = (Date.now() - started) / 1000;
  lat.sort((a, b) => a - b);
  results.push({
    endpoint: ep.name, requests: lat.length, throughputRps: Math.round(lat.length / elapsed),
    p50ms: +pct(lat, 50).toFixed(1), p95ms: +pct(lat, 95).toFixed(1), p99ms: +pct(lat, 99).toFixed(1), maxMs: +lat[lat.length - 1].toFixed(1),
    errors, statuses,
  });
  process.stderr.write(`${ep.name}: ${lat.length} requests\n`);
}
clearInterval(timer);
server.close();
await pool.end();
const out = { date: new Date().toISOString(), seconds, concurrency, node: process.version, results };
fs.writeFileSync(path.join(here, `loadtest-results-c${concurrency}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
