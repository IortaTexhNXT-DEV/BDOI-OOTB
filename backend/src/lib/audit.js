import { query } from '../db/pool.js';
import { currentRequest } from './requestContext.js';

/**
 * Where a request came from, for the audit trail: a browser (a BrokerVerse screen) sends Origin / Referer /
 * Sec-Fetch-* headers, an integration calling the API does not; a call without a request (a job) has no headers.
 * Returns { channel: 'screen' | 'api' | 'job', name } or null when nothing is known.
 */
export function auditSource(req) {
  if (!req) return { channel: 'job', name: null };
  if (req.auditSource) return req.auditSource;
  // a handler may pass its own { user, ip } object (sign-in): the request being served tells where it came from
  if (!req.headers && !req.routeInfo) {
    const served = currentRequest();
    return served && served !== req && served.headers ? auditSource(served) : null;
  }
  const header = (h) => (typeof req.get === 'function' ? req.get(h) : req.headers?.[h]);
  const route = req.routeInfo || {};
  const browser = !!(header('sec-fetch-mode') || header('origin') || header('referer'));
  if (browser) return { channel: 'screen', name: route.screen || null };
  return { channel: 'api', name: route.method ? `${route.method} ${route.path}` : null };
}

/** Record who did what to which record; called by every mutating handler. */
export async function audit(req, { entity, entityId, action, before = null, after = null }) {
  const source = auditSource(req);
  await query(
    `INSERT INTO audit_log(user_id, username, entity, entity_id, action, before_data, after_data, ip, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [req.user?.id ?? null, req.user?.username ?? null, entity, entityId == null ? null : String(entityId), action,
      before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, req.ip, source ? JSON.stringify(source) : null],
  );
}
