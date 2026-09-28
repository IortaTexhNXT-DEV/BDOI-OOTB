import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { many, query } from '../db/pool.js';
import { getSetting } from './settings.js';

let transport = null;
const getTransport = () => {
  if (!config.smtpUrl) return null;
  if (!transport) transport = nodemailer.createTransport(config.smtpUrl);
  return transport;
};

/** Queue an e-mail; delivery happens from the outbox job (or immediately if SMTP is set and sending is enabled). */
export async function queueEmail({ to, cc, subject, html, template, entity, entityId }) {
  const r = await query('INSERT INTO email_outbox(to_address, cc, subject, body_html, template, entity, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [to, cc || null, subject, html, template || null, entity || null, entityId == null ? null : String(entityId)]);
  return r.rows[0].id;
}

export async function sendQueuedEmails() {
  const enabled = await getSetting('notification.email_enabled', false);
  const t = getTransport();
  const rows = await many('SELECT * FROM email_outbox WHERE status = \'queued\' AND attempts < 5 ORDER BY id LIMIT 50');
  if (!enabled || !t) return { sent: 0, queued: rows.length, reason: !enabled ? 'notification.email_enabled is false' : 'SMTP_URL not set' };
  let sent = 0;
  for (const m of rows) {
    try {
      await t.sendMail({ from: await getSetting('notification.from_address', 'no-reply@brokerverse.local'), to: m.to_address, cc: m.cc || undefined, subject: m.subject, html: m.body_html });
      await query('UPDATE email_outbox SET status = \'sent\', sent_at = now(), attempts = attempts + 1 WHERE id = $1', [m.id]);
      sent += 1;
    } catch (e) {
      await query('UPDATE email_outbox SET status = CASE WHEN attempts + 1 >= 5 THEN \'failed\' ELSE \'queued\' END, error = $2, attempts = attempts + 1 WHERE id = $1', [m.id, e.message]);
    }
  }
  return { sent, queued: rows.length - sent };
}
