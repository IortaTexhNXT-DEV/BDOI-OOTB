/**
 * Commercial screening provider adapter (aml.screening_provider).
 *
 *   provider  lists  no provider: only the lists uploaded on Compliance > Screening Lists are screened (the fallback
 *                    that always runs, whatever the provider)
 *             fake   test provider, no network: a name containing SANCTIONED matches with score 0.99, a name containing
 *                    PROVIDER DOWN fails as if the service were unreachable (sandbox tests, training)
 *             http   the provider's API: POST <endpoint> with { name, birthDate, entityType, mode } and the API key read
 *                    from the environment variable named in apiKeyEnv (the key itself is never stored); the answer is
 *                    { matches: [{ name, score, list, reference, details }] } with score 0 to 1 (or 0 to 100)
 *   mode      sandbox | live (sent to the provider; a sandbox key is expected in sandbox mode)
 *
 * Every call is written to the outbox aml_provider_requests with its status; a failed call is retried by the
 * aml-provider-retry job until maxAttempts, then abandoned and reported to the compliance officer.
 */
import { query } from '../../db/pool.js';
import { amlSetting } from './common.js';

export const PROVIDER_NAMES = ['lists', 'fake', 'http'];

const fakeProvider = {
  async screen({ name }) {
    const n = String(name || '').toUpperCase();
    if (n.includes('PROVIDER DOWN')) throw new Error('Screening provider unreachable (fake provider outage)');
    if (n.includes('SANCTIONED')) {
      return { matches: [{ name: String(name).toUpperCase(), score: 0.99, list: 'FAKE-SANCTIONS', reference: 'FAKE-0001', details: { source: 'fake provider' } }] };
    }
    return { matches: [] };
  },
};

const httpProvider = {
  async screen(request, cfg) {
    if (!cfg.endpoint) throw new Error('aml.screening_provider.endpoint is not set');
    const key = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : null;
    if (!key) throw new Error(`The API key environment variable ${cfg.apiKeyEnv || '(apiKeyEnv)'} is not set`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(cfg.timeoutMs) || 10000);
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ ...request, mode: cfg.mode || 'sandbox' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Provider answered ${res.status}: ${body.message || body.error || 'error'}`);
      const matches = Array.isArray(body.matches) ? body.matches : [];
      return { matches: matches.map((m) => ({ name: m.name || m.matchedName || '', score: Number(m.score) > 1 ? Number(m.score) / 100 : Number(m.score) || 0,
        list: m.list || m.source || 'PROVIDER', reference: m.reference || m.id || null, details: m.details || {} })) };
    } finally {
      clearTimeout(timer);
    }
  },
};

const ADAPTERS = { fake: fakeProvider, http: httpProvider };

/** The provider configuration (aml.screening_provider), with defaults. */
export async function providerConfig() {
  const cfg = (await amlSetting('aml.screening_provider')) || {};
  return { provider: 'lists', mode: 'sandbox', timeoutMs: 10000, maxAttempts: 5, ...cfg };
}

/**
 * Call the provider for one name, logging the request in the outbox. Returns { requestId, ok, matches, error } or null
 * when no provider is configured (lists only).
 */
export async function callProvider({ name, birthDate = null, entityType = 'individual', screeningId = null }, cfg = null) {
  const c = cfg || await providerConfig();
  const adapter = ADAPTERS[c.provider];
  if (!adapter) return null;
  const request = { name, birthDate, entityType };
  const row = (await query('INSERT INTO aml_provider_requests(provider, mode, screening_id, party_name, request) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [c.provider, c.mode === 'live' ? 'live' : 'sandbox', screeningId, name, JSON.stringify(request)])).rows[0];
  return attempt(row.id, adapter, request, c);
}

async function attempt(id, adapter, request, cfg) {
  try {
    const out = await adapter.screen(request, cfg);
    await query("UPDATE aml_provider_requests SET status = 'succeeded', attempts = attempts + 1, response = $2, last_error = NULL, next_attempt_at = NULL, updated_at = now() WHERE id = $1",
      [id, JSON.stringify(out)]);
    return { requestId: Number(id), ok: true, matches: out.matches || [] };
  } catch (e) {
    const r = (await query(`UPDATE aml_provider_requests SET attempts = attempts + 1, last_error = $2, updated_at = now(),
      status = CASE WHEN attempts + 1 >= $3 THEN 'abandoned' ELSE 'failed' END,
      next_attempt_at = CASE WHEN attempts + 1 >= $3 THEN NULL ELSE now() + make_interval(mins => power(2, attempts + 1)::int) END
      WHERE id = $1 RETURNING status`, [id, String(e.message || e).slice(0, 500), Number(cfg.maxAttempts) || 5])).rows[0];
    return { requestId: Number(id), ok: false, matches: [], error: String(e.message || e), status: r?.status };
  }
}

/** Send one outbox request again (retry job or the Retry action). Returns the attempt result. */
export async function retryRequest(id, { force = false } = {}) {
  const r = (await query('SELECT * FROM aml_provider_requests WHERE id = $1', [id])).rows[0];
  if (!r) return null;
  if (r.status === 'succeeded') return { requestId: Number(id), ok: true, matches: r.response?.matches || [], already: true };
  const cfg = { ...(await providerConfig()), provider: r.provider };
  const adapter = ADAPTERS[r.provider];
  if (!adapter) return { requestId: Number(id), ok: false, error: `Unknown provider ${r.provider}` };
  if (force && r.status === 'abandoned') await query("UPDATE aml_provider_requests SET status = 'failed', attempts = 0 WHERE id = $1", [id]);
  return attempt(id, adapter, r.request || { name: r.party_name }, cfg);
}

export const requestRow = (r) => ({
  id: Number(r.id), provider: r.provider, mode: r.mode, screeningId: r.screening_id === null ? null : Number(r.screening_id), partyName: r.party_name, status: r.status,
  attempts: r.attempts, lastError: r.last_error, matches: r.response?.matches?.length ?? null, nextAttemptAt: r.next_attempt_at, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function listRequests(q = {}) {
  const params = [];
  const where = [];
  if (q.status) { params.push(String(q.status).split(',')); where.push(`status = ANY($${params.length})`); }
  return (await query(`SELECT * FROM aml_provider_requests ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 200`, params)).rows.map(requestRow);
}

/** Requests due for a retry (failed, next attempt time reached). */
export async function dueRequests() {
  return (await query("SELECT id FROM aml_provider_requests WHERE status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= now()) ORDER BY id LIMIT 100")).rows.map((r) => Number(r.id));
}
