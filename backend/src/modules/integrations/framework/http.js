/**
 * HTTP and mapping helpers shared by the adapters.
 *
 *   httpRequest   one call with a timeout; network errors, timeouts, 429 and 5xx are retryable, other 4xx are not
 *   getPath       read a value by dotted path ("data.items.0.policyNo")
 *   fillTemplate  {{name}} placeholders in a string (URL parts are encoded with { url: true })
 *   mapObject     build an object from a map { target: "source.path" | "{{template}}" | literal } over a source
 */
import { IntegrationError } from './registry.js';

export function getPath(obj, path) {
  if (path === undefined || path === null || path === '') return undefined;
  return String(path).split('.').reduce((v, k) => (v === undefined || v === null ? undefined : v[k]), obj);
}

export function fillTemplate(text, vars, { url = false } = {}) {
  return String(text ?? '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, k) => {
    const v = getPath(vars, k);
    if (v === undefined || v === null) return '';
    return url ? encodeURIComponent(String(v)) : String(v);
  });
}

/** Value of one map entry: "{{...}}" is a template, "=text" a literal, anything else a path in the source. */
export function mapValue(spec, source) {
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) return mapObject(spec, source);
  if (typeof spec !== 'string') return spec;
  if (spec.startsWith('=')) return spec.slice(1);
  if (spec.includes('{{')) return fillTemplate(spec, source);
  return getPath(source, spec);
}

export function mapObject(map, source) {
  const out = {};
  for (const [k, spec] of Object.entries(map || {})) {
    const v = mapValue(spec, source);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * One HTTP call. bodyFormat json (default) or form (application/x-www-form-urlencoded). Returns { status, json, text }.
 */
export async function httpRequest({ url, method = 'POST', headers = {}, body, bodyFormat = 'json', timeoutMs = 15000, fetchImpl = globalThis.fetch }) {
  if (!url) throw new IntegrationError('The connector has no endpoint', { retryable: false });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const h = { Accept: 'application/json', ...headers };
  let payload;
  if (body !== undefined && method !== 'GET') {
    if (bodyFormat === 'form') {
      h['Content-Type'] = 'application/x-www-form-urlencoded';
      payload = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])).toString();
    } else {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }
  let res;
  try {
    res = await fetchImpl(url, { method, headers: h, body: payload, signal: controller.signal });
  } catch (e) {
    throw new IntegrationError(e.name === 'AbortError' ? `No answer within ${Math.round(timeoutMs / 1000)} s` : `Connection failed: ${e.message}`, { retryable: true });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const detail = (json && (json.message || json.error?.message || json.error)) || text.slice(0, 200) || res.statusText;
    throw new IntegrationError(`HTTP ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`, {
      retryable: res.status === 429 || res.status === 408 || res.status >= 500, httpStatus: res.status, response: json ?? text.slice(0, 2000),
    });
  }
  return { status: res.status, json, text };
}
