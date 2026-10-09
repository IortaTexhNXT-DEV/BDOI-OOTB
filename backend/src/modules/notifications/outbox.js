/**
 * E-mail outbox (Master > E-mail Outbox): every message the system queued, whether it went out, and Retry for a
 * failed one. The banner state (sending enabled or not) comes from emailSendingStatus. Read with read:settings, Retry
 * with write:settings (the System Administrator and the IT AppSupport role).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { paging } from '../../lib/respond.js';
import { many, one, query } from '../../db/pool.js';
import { emailSendingStatus, sendQueuedEmails } from '../../lib/mailer.js';

const { router, define } = moduleRouter('E-mail outbox', '/email');
const SCREEN = 'Master > E-mail Outbox';
const canRead = [requireAuth, requirePermission('read:settings', 'write:settings')];
const canWrite = [requireAuth, requirePermission('write:settings')];
const STATUSES = ['queued', 'sent', 'failed'];

const row = (m) => ({
  id: Number(m.id), status: m.status, to: m.to_address, cc: m.cc, subject: m.subject, template: m.template, entity: m.entity, entityId: m.entity_id,
  attempts: m.attempts, lastError: m.error, createdAt: m.created_at, sentAt: m.sent_at,
  // what is attached (file names; a document is generated as a PDF when the message is sent)
  attachments: (Array.isArray(m.attachments) ? m.attachments : []).map((a) => ({ fileName: a.fileName, contentType: a.contentType, kind: a.kind, document: a.document || null })),
});

define({
  method: 'GET', path: '/outbox', summary: 'E-mail outbox (status queued / sent / failed, search on recipient or subject; paging) with whether sending is enabled', screen: SCREEN, middleware: canRead,
  query: { status: 'failed', search: 'juan@', page: 1, pageSize: 20 },
  response: { success: true, data: [{ id: 12, status: 'failed', to: 'juan@example.com', subject: 'Official receipt OR-2026-00001 for policy POL-2026-00001', attempts: 5, lastError: 'Connection timeout', createdAt: '2026-09-30T02:00:00Z',
      attachments: [{ fileName: 'receipt-OR-2026-00001.pdf', contentType: 'application/pdf', kind: 'document', document: 'official-receipt' }] }],
    sending: { enabled: false, smtpConfigured: false, active: false }, counts: { queued: 3, sent: 40, failed: 1 }, total: 1, page: 1, pageSize: 20 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
    const where = `($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR to_address ILIKE $2 OR subject ILIKE $2 OR entity_id ILIKE $2)`;
    const total = (await one(`SELECT count(*)::int AS n FROM email_outbox WHERE ${where}`, [status, search])).n;
    const rows = await many(`SELECT id, status, to_address, cc, subject, template, entity, entity_id, attempts, error, created_at, sent_at, attachments FROM email_outbox
      WHERE ${where} ORDER BY id DESC LIMIT $3 OFFSET $4`, [status, search, pg.limit, pg.offset]);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const c of await many('SELECT status, count(*)::int AS n FROM email_outbox GROUP BY status')) counts[c.status] = c.n;
    res.json({ success: true, data: rows.map(row), sending: await emailSendingStatus(), counts, total, page: pg.page, pageSize: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'POST', path: '/outbox/:id/retry', summary: 'Queue a failed (or still queued) e-mail again with a fresh attempt count; sent at once when sending is enabled', screen: `${SCREEN} > Retry`, middleware: canWrite,
  response: { success: true, message: 'E-mail sent', data: { id: 12, status: 'sent', attempts: 1 } },
  handler: async (req, res) => {
    const m = await one('SELECT * FROM email_outbox WHERE id = $1', [Number(req.params.id) || 0]);
    if (!m) throw notFound('E-mail not found');
    if (m.status === 'sent') throw badRequest('This e-mail was already sent');
    await query("UPDATE email_outbox SET status = 'queued', attempts = 0, error = NULL WHERE id = $1", [m.id]);
    const sending = await emailSendingStatus();
    if (sending.active) await sendQueuedEmails({ ids: [m.id] });
    const after = row(await one('SELECT * FROM email_outbox WHERE id = $1', [m.id]));
    await audit(req, { entity: 'email', entityId: m.id, action: 'retry', before: { status: m.status, attempts: m.attempts, error: m.error }, after: { status: after.status } });
    const message = !sending.active ? 'Queued again. E-mail sending is not configured, so it will go out once sending is enabled'
      : after.status === 'sent' ? 'E-mail sent' : `Sending failed again: ${after.lastError || 'unknown error'}`;
    res.json({ success: true, message, data: after, sending });
  },
});
define({
  method: 'GET', path: '/sending-status', summary: 'Whether e-mail actually leaves the system (SMTP configured and notification.email_enabled on); used by the send and share dialogs', screen: 'Share / send dialogs',
  middleware: [requireAuth], response: { success: true, data: { enabled: false, smtpConfigured: false, active: false } },
  handler: async (_req, res) => res.json({ success: true, data: await emailSendingStatus() }),
});

export default router;
