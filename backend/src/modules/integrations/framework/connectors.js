/**
 * Connectors: the configured connections to third parties (integration_connectors).
 *
 * Credentials are never stored: a connector names the environment variables that hold them (credential_env, e.g.
 * { apiKey: "SEMAPHORE_API_KEY" }); the API returns the names and whether each is set, never the values. Live mode
 * needs every credential its adapter requires and, for a network adapter, an endpoint. Test mode sends through the fake
 * provider of the connector's kind and needs neither.
 */
import { query } from '../../../db/pool.js';
import { badRequest, notFound } from '../../../lib/errors.js';
import { adapterOf } from './registry.js';
import { assertFeature, connectorAllowed, featureOfConnector } from '../../features/service.js';

const run = (db) => db || { query };
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

/** Credentials of a connector: { values: { key: value }, required: [{ key, envName, present }], configured }. */
export function credentialsOf(c, env = process.env) {
  const adapter = adapterOf(c.adapter);
  const names = c.credential_env || {};
  const keys = [...new Set([...(adapter?.credentialKeys || []), ...Object.keys(names)])];
  const required = keys.map((key) => {
    const envName = names[key] || null;
    // every credential the adapter needs and every one the connector names is required in live mode
    return { key, envName, present: Boolean(envName && env[envName]), required: true };
  });
  const values = Object.fromEntries(required.filter((r) => r.present).map((r) => [r.key, env[r.envName]]));
  return { values, required, configured: required.filter((r) => r.required).every((r) => r.present) };
}

/** What is missing before the connector can run live (empty when ready). */
export function liveBlockers(c) {
  const adapter = adapterOf(c.adapter);
  const out = [];
  if (!adapter) out.push(`adapter ${c.adapter} is not installed`);
  if (adapter?.needsEndpoint && !String(c.endpoint || '').trim()) out.push('the endpoint is empty');
  for (const r of credentialsOf(c).required.filter((x) => x.required && !x.present)) {
    out.push(r.envName ? `environment variable ${r.envName} (${r.key}) is not set` : `no environment variable is named for ${r.key}`);
  }
  return out;
}

export function toConnector(c, counts = {}) {
  const creds = credentialsOf(c);
  const adapter = adapterOf(c.adapter);
  return {
    code: c.code, name: c.name, kind: c.kind, adapter: c.adapter, adapterLabel: adapter?.label || c.adapter, enabled: c.enabled, mode: c.mode, endpoint: c.endpoint,
    credentialEnv: c.credential_env || {}, credentials: creds.required, credentialsConfigured: creds.configured, liveBlockers: liveBlockers(c),
    options: c.options || {}, timeoutMs: c.timeout_ms, maxAttempts: c.max_attempts, retryBaseSeconds: c.retry_base_seconds, retryMaxSeconds: c.retry_max_seconds,
    description: c.description, sortOrder: c.sort_order, lastSuccessAt: c.last_success_at, lastFailureAt: c.last_failure_at,
    queued: counts.queued || 0, failed: counts.failed || 0, sentToday: counts.sent_today || 0, updatedBy: c.updated_by, updatedAt: c.updated_at,
  };
}

export async function connectorRow(code, db = null) {
  const c = (await run(db).query('SELECT * FROM integration_connectors WHERE code = upper($1)', [String(code || '')])).rows[0];
  if (!c) throw notFound(`Connector ${code} not found`);
  return c;
}

export async function listConnectors({ kind } = {}) {
  // connectors of features this environment does not run (modules/features) are not part of its integrations
  const all = (await query(`SELECT * FROM integration_connectors WHERE ($1::text IS NULL OR kind = $1) ORDER BY sort_order, code`, [kind || null])).rows;
  const allowed = await Promise.all(all.map((c) => connectorAllowed(c.code)));
  const rows = all.filter((_c, i) => allowed[i]);
  const counts = (await query(`SELECT connector_code,
      count(*) FILTER (WHERE status IN ('queued', 'retry', 'processing'))::int AS queued,
      count(*) FILTER (WHERE status = 'failed')::int AS failed,
      count(*) FILTER (WHERE status = 'sent' AND sent_at >= date_trunc('day', now()))::int AS sent_today
    FROM integration_outbox GROUP BY connector_code`)).rows;
  const byCode = Object.fromEntries(counts.map((r) => [r.connector_code, r]));
  return rows.map((c) => toConnector(c, byCode[c.code]));
}

const COLUMNS = { name: 'name', enabled: 'enabled', mode: 'mode', endpoint: 'endpoint', credentialEnv: 'credential_env', options: 'options', timeoutMs: 'timeout_ms',
  maxAttempts: 'max_attempts', retryBaseSeconds: 'retry_base_seconds', retryMaxSeconds: 'retry_max_seconds', description: 'description', sortOrder: 'sort_order', adapter: 'adapter' };

/** Change a connector's settings. Going live, or enabling a live connector, is refused while something is missing. */
export async function updateConnector(code, b, user) {
  const c = await connectorRow(code);
  if (featureOfConnector(c.code)) await assertFeature(featureOfConnector(c.code), { write: true });
  const before = toConnector(c);
  if (b.credentialEnv) {
    const bad = Object.entries(b.credentialEnv).filter(([, v]) => v && !ENV_NAME.test(String(v)));
    if (bad.length) throw badRequest('Validation failed', bad.map(([k]) => ({ path: `credentialEnv.${k}`, message: 'An environment variable name: capital letters, digits and _ (the value itself is never entered here)' })));
  }
  if (b.adapter !== undefined) {
    const a = adapterOf(b.adapter);
    if (!a) throw badRequest(`Unknown adapter ${b.adapter}`);
    if (!a.kinds.includes(c.kind)) throw badRequest(`Adapter ${b.adapter} does not serve ${c.kind} connectors`);
  }
  const next = { ...c };
  for (const [k, col] of Object.entries(COLUMNS)) if (b[k] !== undefined) next[col] = b[k];
  if (next.retry_max_seconds < next.retry_base_seconds) throw badRequest('Validation failed', [{ path: 'retryMaxSeconds', message: 'The longest wait cannot be shorter than the first wait' }]);
  if (next.enabled && next.mode === 'live') {
    const blockers = liveBlockers(next);
    if (blockers.length) throw badRequest(`${c.name} cannot run live: ${blockers.join('; ')}`);
  }
  const keys = Object.values(COLUMNS).filter((col) => next[col] !== c[col]);
  if (keys.length) {
    const values = keys.map((k) => (['credential_env', 'options'].includes(k) ? JSON.stringify(next[k] || {}) : next[k]));
    await query(`UPDATE integration_connectors SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE code = $1`,
      [c.code, ...values, user?.id ?? null]);
  }
  return { before, after: toConnector(await connectorRow(c.code)) };
}
