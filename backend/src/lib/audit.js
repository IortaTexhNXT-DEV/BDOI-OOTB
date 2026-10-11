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

/**
 * Several audit entries of one request in one insert (a data load writes one entry per record it creates, changes or
 * removes): entries [{ entity, entityId, action, before, after }]. Runs in the caller's transaction when there is one.
 */
export async function auditMany(req, entries) {
  if (!entries.length) return;
  const source = auditSource(req);
  const json = (v) => (v ? JSON.stringify(v) : null);
  await query(
    `INSERT INTO audit_log(user_id, username, entity, entity_id, action, before_data, after_data, ip, source)
     SELECT $1::text, $2::text, x.entity, x.entity_id, x.action, x.before_data::jsonb, x.after_data::jsonb, $3::text, $4::jsonb
       FROM unnest($5::text[], $6::text[], $7::text[], $8::text[], $9::text[]) AS x(entity, entity_id, action, before_data, after_data)`,
    [req?.user?.id ?? null, req?.user?.username ?? null, req?.ip ?? null, source ? JSON.stringify(source) : null,
      entries.map((e) => e.entity), entries.map((e) => (e.entityId == null ? null : String(e.entityId))), entries.map((e) => e.action),
      entries.map((e) => json(e.before)), entries.map((e) => json(e.after))],
  );
}
