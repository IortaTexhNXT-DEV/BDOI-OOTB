/**
 * Integration outbox and inbox.
 *
 * enqueue()        a module queues a message in its own transaction (the message exists only if the business change
 *                  is committed); an idempotency key keeps one message per business event
 * processOutbox()  sends what is due: picks queued / retry messages (FOR UPDATE SKIP LOCKED, so several instances never
 *                  send the same message), calls the adapter (the fake provider in test mode), records the attempt and
 *                  either marks the message sent and applies the answer (message type onSent) or schedules the next
 *                  attempt after base x 2^(attempt - 1) seconds (capped), until max_attempts; then failed (onFailed)
 * resend()         a failed or cancelled message is queued again with a fresh attempt count (monitor)
 * receive()        a message pushed by a third party or read from a file is stored in the inbox and processed by its
 *                  message type (onInbound); reprocess() runs a failed one again
 */
import crypto from 'node:crypto';
import { many, one, query, withTransaction } from '../../../db/pool.js';
import { badRequest, conflict, notFound } from '../../../lib/errors.js';
import { getSetting } from '../../../lib/settings.js';
import { logger } from '../../../lib/logger.js';
import { adapterOf, messageTypeOf } from './registry.js';
import { connectorRow, credentialsOf, liveBlockers } from './connectors.js';
import { fakeAdapter } from '../adapters/fake.js';

const run = (db) => db || { query };
export const OUTBOX_STATUSES = ['queued', 'processing', 'retry', 'sent', 'failed', 'cancelled', 'skipped'];
export const INBOX_STATUSES = ['received', 'processed', 'failed', 'ignored'];

/** Seconds to wait before attempt n + 1 after n failed attempts. */
export const backoffSeconds = (connector, attempts) => Math.min(Number(connector.retry_max_seconds) || 3600, (Number(connector.retry_base_seconds) || 60) * 2 ** Math.max(0, attempts - 1));

export function toMessage(m) {
  return {
    id: Number(m.id), connectorCode: m.connector_code, connectorName: m.connector_name || null, messageType: m.message_type, entity: m.entity, entityId: m.entity_id,
    reference: m.reference, status: m.status, mode: m.mode, attempts: m.attempts, maxAttempts: m.max_attempts, nextAttemptAt: m.next_attempt_at, lastError: m.last_error,
    externalRef: m.external_ref, payload: m.payload || {}, response: m.response ?? null, createdBy: m.created_by_name || m.created_by, createdAt: m.created_at,
    updatedAt: m.updated_at, sentAt: m.sent_at,
  };
}

/**
 * Queue a message: { connectorCode, messageType, entity, entityId, reference, payload, idempotencyKey, status, lastError }.
 * Returns the message (an existing one when the idempotency key was used before). status 'skipped' records a message
 * that is deliberately not sent (no consent, no mobile number) with the reason in lastError.
 */
export async function enqueue(db, m, user = null) {
  const c = await connectorRow(m.connectorCode, db);
  const type = messageTypeOf(m.messageType);
  if (!type) throw badRequest(`Unknown message type ${m.messageType}`);
  if (type.kind !== c.kind) throw badRequest(`Connector ${c.code} is a ${c.kind} connector: it cannot send ${m.messageType} messages`);
  const status = m.status || 'queued';
  const r = (await run(db).query(`INSERT INTO integration_outbox(connector_code, message_type, entity, entity_id, reference, idempotency_key, payload, status, mode, max_attempts, last_error, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
  [c.code, m.messageType, m.entity || null, m.entityId == null ? null : String(m.entityId), m.reference ? String(m.reference).slice(0, 200) : null, m.idempotencyKey || null,
    JSON.stringify(m.payload || {}), status, c.mode, c.max_attempts, m.lastError || null, user?.id ?? null])).rows[0];
  if (r) return toMessage(r);
  // the same business event was queued before: that message is returned, flagged as a duplicate
  return { ...toMessage((await run(db).query('SELECT * FROM integration_outbox WHERE idempotency_key = $1', [m.idempotencyKey])).rows[0]), duplicate: true };
}

async function recordAttempt(db, msg, { attempt, mode, ok, httpStatus = null, durationMs, error = null }) {
  await db.query('INSERT INTO integration_attempts(outbox_id, attempt, mode, ok, http_status, duration_ms, error) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [msg.id, attempt, mode, ok, httpStatus, durationMs, error ? String(error).slice(0, 1000) : null]);
}

/** Send one message (already marked processing). Returns the message after the attempt. */
async function dispatchOne(row, { fetchImpl } = {}) {
  const connector = await connectorRow(row.connector_code);
  const type = messageTypeOf(row.message_type);
  if (!connector.enabled) {
    // a switched-off connector holds its messages: nothing is attempted and the attempt count is kept
    await query(`UPDATE integration_outbox SET status = 'queued', locked_at = NULL, last_error = $2, next_attempt_at = now() + make_interval(secs => $3), updated_at = now() WHERE id = $1`,
      [row.id, `Connector ${connector.code} is switched off; the message waits until it is enabled`, Number(connector.retry_base_seconds) || 60]);
    return one('SELECT * FROM integration_outbox WHERE id = $1', [row.id]);
  }
  const mode = connector.mode;
  const attempt = row.attempts + 1;
  const started = Date.now();
  let result = null;
  let error = null;
  try {
    if (!type) throw Object.assign(new Error(`Unknown message type ${row.message_type}`), { retryable: false });
    let adapter;
    if (mode === 'test') adapter = fakeAdapter;
    else {
      const blockers = liveBlockers(connector);
      if (blockers.length) throw Object.assign(new Error(`Connector ${connector.code} is not ready for live use: ${blockers.join('; ')}`), { retryable: true });
      adapter = adapterOf(connector.adapter);
    }
    const message = { id: Number(row.id), type: row.message_type, entity: row.entity, entityId: row.entity_id, reference: row.reference, payload: row.payload || {}, attempt };
    result = await adapter.send(message, connector, { credentials: credentialsOf(connector).values, fetchImpl, timeoutMs: connector.timeout_ms, mode, kind: connector.kind }) || {};
  } catch (e) {
    error = e;
  }
  const durationMs = Date.now() - started;
  return withTransaction(async (db) => {
    const msg = (await db.query('SELECT * FROM integration_outbox WHERE id = $1 FOR UPDATE', [row.id])).rows[0];
    if (!error) {
      await recordAttempt(db, msg, { attempt, mode, ok: true, httpStatus: result.httpStatus || null, durationMs });
      await db.query(`UPDATE integration_outbox SET status = 'sent', mode = $2, attempts = $3, locked_at = NULL, last_error = NULL, external_ref = $4, response = $5, sent_at = now(), updated_at = now()
        WHERE id = $1`, [msg.id, mode, attempt, result.externalRef ? String(result.externalRef).slice(0, 200) : null, JSON.stringify(result.response ?? null)]);
      await db.query('UPDATE integration_connectors SET last_success_at = now() WHERE code = $1', [connector.code]);
      if (type?.onSent) {
        // the answer is applied with a savepoint: a failure here leaves the message sent with the reason, never half-applied
        try {
          await db.query('SAVEPOINT integration_on_sent');
          await type.onSent(db, { ...toMessage({ ...msg, attempts: attempt }), payload: msg.payload || {} }, result, { mode });
          await db.query('RELEASE SAVEPOINT integration_on_sent');
        } catch (e) {
          await db.query('ROLLBACK TO SAVEPOINT integration_on_sent');
          await db.query(`UPDATE integration_outbox SET status = 'failed', last_error = $2, updated_at = now() WHERE id = $1`,
            [msg.id, `Sent, but the answer could not be applied: ${String(e.message).slice(0, 900)}`]);
        }
      }
    } else {
      const retryable = error.retryable !== false && attempt < msg.max_attempts;
      await recordAttempt(db, msg, { attempt, mode, ok: false, httpStatus: error.httpStatus || null, durationMs, error: error.message });
      await db.query(`UPDATE integration_outbox SET status = $2, mode = $3, attempts = $4, locked_at = NULL, last_error = $5, response = COALESCE($6, response),
          next_attempt_at = CASE WHEN $2 = 'retry' THEN now() + make_interval(secs => $7) ELSE next_attempt_at END, updated_at = now() WHERE id = $1`,
      [msg.id, retryable ? 'retry' : 'failed', mode, attempt, String(error.message || 'Unknown error').slice(0, 1000),
        error.response === undefined || error.response === null ? null : JSON.stringify(error.response), backoffSeconds(connector, attempt)]);
      await db.query('UPDATE integration_connectors SET last_failure_at = now() WHERE code = $1', [connector.code]);
      if (!retryable && type?.onFailed) {
        try {
          await db.query('SAVEPOINT integration_on_failed');
          await type.onFailed(db, { ...toMessage({ ...msg, attempts: attempt }), payload: msg.payload || {} }, error);
          await db.query('RELEASE SAVEPOINT integration_on_failed');
        } catch (e) {
          await db.query('ROLLBACK TO SAVEPOINT integration_on_failed');
          logger.warn?.(`integration message ${msg.id}: failure handler: ${e.message}`);
        }
      }
    }
    return (await db.query('SELECT * FROM integration_outbox WHERE id = $1', [row.id])).rows[0];
  });
}

/**
 * Send the messages that are due (or the ids given, whatever their next attempt time). Options: { ids, limit,
 * connectorCode, fetchImpl }. Returns { sent, retry, failed, held, processed: [ids] }.
 */
export async function processOutbox({ ids = null, limit = null, connectorCode = null, fetchImpl } = {}) {
  const stuck = Number(await getSetting('integrations.stuck_minutes', 10)) || 10;
  await query(`UPDATE integration_outbox SET status = 'retry', locked_at = NULL, last_error = COALESCE(last_error, 'Sending was interrupted; queued again')
    WHERE status = 'processing' AND locked_at < now() - make_interval(mins => $1)`, [stuck]);
  const n = Number(limit || (await getSetting('integrations.dispatch_batch_size', 50))) || 50;
  const picked = await withTransaction(async (db) => (await db.query(`UPDATE integration_outbox SET status = 'processing', locked_at = now(), updated_at = now()
      WHERE id IN (SELECT id FROM integration_outbox WHERE status IN ('queued', 'retry')
        AND ($1::bigint[] IS NOT NULL OR next_attempt_at <= now()) AND ($1::bigint[] IS NULL OR id = ANY($1))
        AND ($2::text IS NULL OR connector_code = $2)
        ORDER BY next_attempt_at, id LIMIT $3 FOR UPDATE SKIP LOCKED) RETURNING *`,
  [ids && ids.length ? ids.map(Number) : null, connectorCode, n])).rows);
  const out = { sent: 0, retry: 0, failed: 0, held: 0, processed: [] };
  for (const row of picked.sort((a, b) => Number(a.id) - Number(b.id))) {
    try {
      const after = await dispatchOne(row, { fetchImpl });
      if (after.status === 'sent') out.sent += 1;
      else if (after.status === 'retry') out.retry += 1;
      else if (after.status === 'failed') out.failed += 1;
      else out.held += 1;
      out.processed.push(Number(row.id));
    } catch (e) {
      logger.error?.({ err: e, outboxId: row.id }, 'integration outbox: dispatch failed');
      await query("UPDATE integration_outbox SET status = 'retry', locked_at = NULL, last_error = $2, next_attempt_at = now() + interval '1 minute' WHERE id = $1",
        [row.id, String(e.message).slice(0, 1000)]);
      out.retry += 1;
    }
  }
  return out;
}

/** Send one message now (monitor or a screen action): queued / retry are sent at once. */
export async function sendNow(id, opts = {}) {
  await processOutbox({ ...opts, ids: [Number(id)], limit: 1 });
  return getMessage(id);
}

const MESSAGE_SELECT = `SELECT o.*, c.name AS connector_name, (SELECT display_name FROM users u WHERE u.id = o.created_by) AS created_by_name
  FROM integration_outbox o JOIN integration_connectors c ON c.code = o.connector_code`;

export async function getMessage(id) {
  const m = await one(`${MESSAGE_SELECT} WHERE o.id = $1`, [Number(id) || 0]);
  if (!m) throw notFound('Integration message not found');
  const attempts = await many('SELECT attempt, mode, ok, http_status, duration_ms, error, at FROM integration_attempts WHERE outbox_id = $1 ORDER BY attempt, id', [m.id]);
  return { ...toMessage(m), attemptLog: attempts.map((a) => ({ attempt: a.attempt, mode: a.mode, ok: a.ok, httpStatus: a.http_status, durationMs: a.duration_ms, error: a.error, at: a.at })) };
}

export async function listMessages(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.connectorCode) add('o.connector_code = upper(?)', q.connectorCode);
  if (q.status) add('o.status = ANY(?)', String(q.status).split(',').map((s) => s.trim()));
  if (q.messageType) add('o.message_type = ANY(?)', String(q.messageType).split(',').map((s) => s.trim()));
  if (q.kind) add('c.kind = ?', q.kind);
  if (q.entity) add('o.entity = ?', q.entity);
  if (q.entityId) add('o.entity_id = ?', String(q.entityId));
  if (q.clientId) add("o.payload->>'clientId' = ?", String(q.clientId));
  if (q.from) add('o.created_at >= ?::date', q.from);
  if (q.to) add("o.created_at < ?::date + 1", q.to);
  if (q.search) add("(o.reference ILIKE '%' || ? || '%' OR o.external_ref ILIKE '%' || ? || '%' OR o.entity_id ILIKE '%' || ? || '%' OR o.last_error ILIKE '%' || ? || '%')", String(q.search).trim());
  const w = where.join(' AND ');
  const from = 'FROM integration_outbox o JOIN integration_connectors c ON c.code = o.connector_code';
  const total = (await one(`SELECT count(*)::int AS n ${from} WHERE ${w}`, params)).n;
  const rows = await many(`${MESSAGE_SELECT} WHERE ${w} ORDER BY o.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  const counts = Object.fromEntries(OUTBOX_STATUSES.map((s) => [s, 0]));
  for (const c of await many(`SELECT o.status, count(*)::int AS n ${from} WHERE ($1::text IS NULL OR c.kind = $1) GROUP BY o.status`, [q.kind || null])) counts[c.status] = c.n;
  return { total, rows: rows.map(toMessage), counts };
}

/** Queue a failed, cancelled or skipped message again with a fresh attempt count; then send it at once. */
export async function resend(id, user, opts = {}) {
  const m = await one('SELECT * FROM integration_outbox WHERE id = $1', [Number(id) || 0]);
  if (!m) throw notFound('Integration message not found');
  if (['sent', 'processing'].includes(m.status)) throw conflict(`This message is ${m.status}: it cannot be sent again`);
  const before = toMessage(m);
  const c = await connectorRow(m.connector_code);
  await query(`UPDATE integration_outbox SET status = 'queued', attempts = 0, max_attempts = $2, last_error = NULL, next_attempt_at = now(), locked_at = NULL, updated_at = now()
    WHERE id = $1`, [m.id, c.max_attempts]);
  const type = messageTypeOf(m.message_type);
  if (type?.onRequeued) await withTransaction((db) => type.onRequeued(db, toMessage(m), user));
  const after = await sendNow(m.id, opts);
  return { before, after };
}

/** Cancel a message that has not been sent. */
export async function cancel(id, user, reason = null) {
  const m = await one('SELECT * FROM integration_outbox WHERE id = $1', [Number(id) || 0]);
  if (!m) throw notFound('Integration message not found');
  if (!['queued', 'retry', 'failed', 'skipped'].includes(m.status)) throw conflict(`A ${m.status} message cannot be cancelled`);
  await query("UPDATE integration_outbox SET status = 'cancelled', last_error = $2, locked_at = NULL, updated_at = now() WHERE id = $1",
    [m.id, `Cancelled${reason ? `: ${reason}` : ''} by ${user?.username || 'a user'}`]);
  return { before: toMessage(m), after: await getMessage(m.id) };
}

// ------------------------------------------------------------------ inbox

export function toInbox(r) {
  return {
    id: Number(r.id), connectorCode: r.connector_code, messageType: r.message_type, source: r.source, externalRef: r.external_ref, entity: r.entity, entityId: r.entity_id,
    signatureValid: r.signature_valid, payload: r.payload || {}, status: r.status, attempts: r.attempts, lastError: r.last_error, result: r.result ?? null,
    receivedBy: r.received_by_name || r.received_by, receivedAt: r.received_at, processedAt: r.processed_at,
  };
}

async function processInbox(id) {
  const r = await one('SELECT * FROM integration_inbox WHERE id = $1', [id]);
  const type = messageTypeOf(r.message_type);
  if (!type?.onInbound) {
    await query("UPDATE integration_inbox SET status = 'ignored', last_error = $2, attempts = attempts + 1, processed_at = now() WHERE id = $1", [id, `No handler for ${r.message_type}`]);
    return toInbox(await one('SELECT * FROM integration_inbox WHERE id = $1', [id]));
  }
  try {
    const result = await withTransaction(async (db) => {
      const out = await type.onInbound(db, toInbox(r));
      await db.query(`UPDATE integration_inbox SET status = 'processed', attempts = attempts + 1, last_error = NULL, result = $2, entity = COALESCE($3, entity), entity_id = COALESCE($4, entity_id),
        processed_at = now() WHERE id = $1`, [id, JSON.stringify(out?.result ?? out ?? null), out?.entity || null, out?.entityId ? String(out.entityId) : null]);
      return out;
    });
    return { ...toInbox(await one('SELECT * FROM integration_inbox WHERE id = $1', [id])), outcome: result };
  } catch (e) {
    await query("UPDATE integration_inbox SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE id = $1", [id, String(e.message).slice(0, 1000)]);
    return toInbox(await one('SELECT * FROM integration_inbox WHERE id = $1', [id]));
  }
}

/** Store and process an inbound message: { connectorCode, messageType, source, externalRef, payload, signatureValid }. */
export async function receive(m, user = null) {
  const r = await one(`INSERT INTO integration_inbox(connector_code, message_type, source, external_ref, entity, entity_id, signature_valid, payload, received_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [m.connectorCode || null, m.messageType, m.source || 'webhook', m.externalRef || null, m.entity || null,
    m.entityId == null ? null : String(m.entityId), m.signatureValid ?? null, JSON.stringify(m.payload || {}), user?.id ?? null]);
  if (m.signatureValid === false) {
    await query("UPDATE integration_inbox SET status = 'ignored', last_error = 'Invalid signature' WHERE id = $1", [r.id]);
    return toInbox(await one('SELECT * FROM integration_inbox WHERE id = $1', [r.id]));
  }
  return processInbox(r.id);
}

export async function reprocess(id) {
  const r = await one('SELECT * FROM integration_inbox WHERE id = $1', [Number(id) || 0]);
  if (!r) throw notFound('Inbox message not found');
  if (r.status === 'processed') throw conflict('This message was processed already');
  if (r.signature_valid === false) throw conflict('A message with an invalid signature is never processed');
  return { before: toInbox(r), after: await processInbox(r.id) };
}

export async function listInbox(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.connectorCode) add('i.connector_code = upper(?)', q.connectorCode);
  if (q.status) add('i.status = ?', q.status);
  if (q.messageType) add('i.message_type = ?', q.messageType);
  if (q.source) add('i.source = ?', q.source);
  if (q.search) add("(i.external_ref ILIKE '%' || ? || '%' OR i.entity_id ILIKE '%' || ? || '%' OR i.last_error ILIKE '%' || ? || '%')", String(q.search).trim());
  const w = where.join(' AND ');
  const total = (await one(`SELECT count(*)::int AS n FROM integration_inbox i WHERE ${w}`, params)).n;
  const rows = await many(`SELECT i.*, (SELECT display_name FROM users u WHERE u.id = i.received_by) AS received_by_name FROM integration_inbox i WHERE ${w}
    ORDER BY i.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  return { total, rows: rows.map(toInbox) };
}

/** Signing key of a connector's inbound messages: its webhookSecret credential, else (test mode) a key derived from DATA_ENCRYPTION_KEY. */
export function inboundKey(connector, config) {
  const creds = credentialsOf(connector).values;
  if (creds.webhookSecret) return creds.webhookSecret;
  if (connector.mode === 'test') return crypto.createHmac('sha256', String(config.dataEncryptionKey)).update(`brokerverse:integration-inbound:${connector.code}`).digest('hex');
  return null;
}
export const signInbound = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');
export function verifyInbound(key, text, signature) {
  if (!key || !signature) return false;
  const want = Buffer.from(signInbound(key, text));
  const got = Buffer.from(String(signature).replace(/^sha256=/, ''));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

