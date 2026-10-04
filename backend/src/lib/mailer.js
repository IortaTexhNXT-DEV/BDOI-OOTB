import fs from 'node:fs';
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { many, query } from '../db/pool.js';
import { getSetting } from './settings.js';

/** A message is tried this many times, then marked failed (the error of the last try is kept). */
const MAX_ATTEMPTS = 5;
/** Messages sent per job run. */
const BATCH_SIZE = 50;
const MB = 1024 * 1024;

let transport = null;
const getTransport = () => {
  if (!config.smtpUrl) return null;
  if (!transport) transport = nodemailer.createTransport(config.smtpUrl);
  return transport;
};

/**
 * Whether queued e-mail actually leaves the system: SMTP_URL must be set and notification.email_enabled on.
 * Screens use it to tell the user that a message was only queued.
 */
export async function emailSendingStatus() {
  const enabled = Boolean(await getSetting('notification.email_enabled', false));
  const smtpConfigured = Boolean(config.smtpUrl);
  return { enabled, smtpConfigured, active: enabled && smtpConfigured };
}

/**
 * An attachment generated when the message is sent: `document` names a generator of
 * modules/documents/emailDocuments.js (official-receipt, premium-invoice, commission-debit-note, policy-schedule) and
 * `params` the record it prints. The queue keeps only this reference, so the PDF shows the record as it is when sent.
 */
export const documentAttachment = (document, params, fileName, contentType = 'application/pdf') => ({ fileName, contentType, kind: 'document', document, params: params || {} });
/** An attachment read from the uploads store (a file stored earlier, e.g. a generated print). */
export const fileAttachment = (key, fileName, contentType = 'application/pdf') => ({ fileName, contentType, kind: 'file', key });

const cleanAttachments = (list) => (Array.isArray(list) ? list : []).filter((a) => a && a.fileName && (a.kind === 'document' ? a.document : a.kind === 'file' && a.key))
  .map((a) => (a.kind === 'document' ? documentAttachment(a.document, a.params, a.fileName, a.contentType) : fileAttachment(a.key, a.fileName, a.contentType)));

/**
 * Queue an e-mail in email_outbox. The email-outbox job sends it (every 5 minutes by the seed). `attachments`: see
 * documentAttachment / fileAttachment. `db` queues it in the caller's transaction (it is dropped when that rolls back).
 */
export async function queueEmail({ to, cc, subject, html, template, entity, entityId, attachments = [], db = null }) {
  const r = await (db || { query }).query(`INSERT INTO email_outbox(to_address, cc, subject, body_html, template, entity, entity_id, attachments)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [to, cc || null, subject, html, template || null, entity || null, entityId == null ? null : String(entityId), JSON.stringify(cleanAttachments(attachments))]);
  return Number(r.rows[0].id);
}

/** An error that retrying cannot fix (attachments too large, a document that no longer exists): the message fails at once. */
class PermanentMailError extends Error {}

/** The attachments of an outbox row as nodemailer attachments ({ filename, content, contentType }), size-checked. */
export async function buildAttachments(list) {
  const items = cleanAttachments(list);
  if (!items.length) return [];
  const { generateDocument } = await import('../modules/documents/emailDocuments.js');
  const out = [];
  for (const a of items) {
    let content;
    if (a.kind === 'document') {
      try {
        content = (await generateDocument(a.document, a.params)).content;
      } catch (e) {
        throw new PermanentMailError(`Attachment ${a.fileName}: ${e.message}`);
      }
    } else {
      const { resolveKey } = await import('../modules/uploads/storage.js');
      try {
        content = fs.readFileSync(resolveKey(a.key));
      } catch {
        throw new PermanentMailError(`Attachment ${a.fileName}: the stored file is missing`);
      }
    }
    out.push({ filename: a.fileName, content, contentType: a.contentType || 'application/octet-stream' });
  }
  const limit = Number(await getSetting('email.max_attachment_mb', 10)) || 10;
  const size = out.reduce((s, a) => s + a.content.length, 0);
  if (size > limit * MB) throw new PermanentMailError(`The attachments are ${(size / MB).toFixed(1)} MB; the limit is ${limit} MB (email.max_attachment_mb)`);
  return out;
}

/**
 * The nodemailer message of an outbox row (attachments generated now). The body is wrapped in the broker's e-mail
 * layout (Theme and Branding > E-mail: header band with the logo, footer line) at send time; the inline logo follows
 * the document attachments.
 */
export async function buildMessage(m) {
  const attachments = await buildAttachments(m.attachments);
  const { emailLayout } = await import('../modules/branding/service.js');
  const branded = await emailLayout(m.body_html).catch(() => ({ html: m.body_html, attachments: [] }));
  const all = [...attachments, ...branded.attachments];
  return { from: await getSetting('notification.from_address', 'BrokerVerse <connect@iortatechnxt.com>'), to: m.to_address, cc: m.cc || undefined, subject: m.subject, html: branded.html,
    ...(all.length ? { attachments: all } : {}) };
}

/** Send queued messages (the email-outbox job); `ids` limits the run to those messages (Retry on the outbox screen). */
export async function sendQueuedEmails({ ids = null } = {}) {
  const enabled = await getSetting('notification.email_enabled', false);
  const t = getTransport();
  const rows = await many(`SELECT * FROM email_outbox WHERE status = 'queued' AND attempts < $1 AND ($3::bigint[] IS NULL OR id = ANY($3))
    ORDER BY id LIMIT $2`, [MAX_ATTEMPTS, BATCH_SIZE, ids]);
  if (!enabled || !t) return { sent: 0, queued: rows.length, reason: !enabled ? 'notification.email_enabled is false' : 'SMTP_URL not set' };
  let sent = 0;
  for (const m of rows) {
    try {
      await t.sendMail(await buildMessage(m));
      await query('UPDATE email_outbox SET status = \'sent\', sent_at = now(), attempts = attempts + 1 WHERE id = $1', [m.id]);
      sent += 1;
    } catch (e) {
      await query('UPDATE email_outbox SET status = CASE WHEN $4 OR attempts + 1 >= $3 THEN \'failed\' ELSE \'queued\' END, error = $2, attempts = attempts + 1 WHERE id = $1',
        [m.id, e.message, MAX_ATTEMPTS, e instanceof PermanentMailError]);
    }
  }
  return { sent, queued: rows.length - sent };
}
