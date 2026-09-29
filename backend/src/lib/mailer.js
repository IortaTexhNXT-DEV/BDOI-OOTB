import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { many, query } from '../db/pool.js';
import { getSetting } from './settings.js';

/** A message is tried this many times, then marked failed (the error of the last try is kept). */
const MAX_ATTEMPTS = 5;
/** Messages sent per job run. */
const BATCH_SIZE = 50;

let transport = null;
const getTransport = () => {
  if (!config.smtpUrl) return null;
  if (!transport) transport = nodemailer.createTransport(config.smtpUrl);
  return transport;
};

/** Queue an e-mail in email_outbox. The email-outbox job sends it (every 5 minutes by the seed). */
export async function queueEmail({ to, cc, subject, html, template, entity, entityId }) {
  const r = await query('INSERT INTO email_outbox(to_address, cc, subject, body_html, template, entity, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [to, cc || null, subject, html, template || null, entity || null, entityId == null ? null : String(entityId)]);
  return r.rows[0].id;
}

export async function sendQueuedEmails() {
  const enabled = await getSetting('notification.email_enabled', false);
  const t = getTransport();
  const rows = await many('SELECT * FROM email_outbox WHERE status = \'queued\' AND attempts < $1 ORDER BY id LIMIT $2', [MAX_ATTEMPTS, BATCH_SIZE]);
  if (!enabled || !t) return { sent: 0, queued: rows.length, reason: !enabled ? 'notification.email_enabled is false' : 'SMTP_URL not set' };
  let sent = 0;
  for (const m of rows) {
    try {
      await t.sendMail({ from: await getSetting('notification.from_address', 'BrokerVerse <connect@iortatechnxt.com>'), to: m.to_address, cc: m.cc || undefined, subject: m.subject, html: m.body_html });
      await query('UPDATE email_outbox SET status = \'sent\', sent_at = now(), attempts = attempts + 1 WHERE id = $1', [m.id]);
      sent += 1;
    } catch (e) {
      await query('UPDATE email_outbox SET status = CASE WHEN attempts + 1 >= $3 THEN \'failed\' ELSE \'queued\' END, error = $2, attempts = attempts + 1 WHERE id = $1', [m.id, e.message, MAX_ATTEMPTS]);
    }
  }
  return { sent, queued: rows.length - sent };
}
