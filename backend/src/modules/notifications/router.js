import { moduleRouter } from '../../lib/registry.js';
import { requireAuth } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { many, one, query } from '../../db/pool.js';
import { paging, pageMeta } from '../../lib/respond.js';

const { router, define } = moduleRouter('Notifications', '/notifications');
const row = (n) => ({ id: n.id, type: n.type, priority: n.priority, title: n.title, message: n.message, link: n.link, entity: n.entity, entityId: n.entity_id, isRead: n.is_read, readAt: n.read_at, createdAt: n.created_at });

/** Create a notification for a user (or broadcast when userId is null). Used by every module. */
export async function notify({ userId = null, type = 'info', priority = 'normal', title, message, link = null, entity = null, entityId = null }) {
  const r = await query('INSERT INTO notifications(user_id, type, priority, title, message, link, entity, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [userId, type, priority, title, message, link, entity, entityId == null ? null : String(entityId)]);
  return r.rows[0].id;
}

define({
  method: 'GET', path: '/', summary: 'Notifications for the signed-in user (paged; filter type / isRead)', screen: 'Top bar > Notifications', middleware: [requireAuth],
  query: { page: 1, pageSize: 20, type: 'reminder', isRead: false },
  response: { success: true, data: { notifications: [{ id: 'ntf_1', type: 'reminder', priority: 'normal', title: 'Renewal due in 30 days', message: 'Policy POL-2026-00001 expires', isRead: false }], unreadCount: 1, pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 } } },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { type } = req.query; const isRead = req.query.isRead === undefined ? null : String(req.query.isRead) === 'true';
    const where = '(user_id = $1 OR user_id IS NULL) AND ($2::text IS NULL OR type = $2) AND ($3::boolean IS NULL OR is_read = $3)';
    const params = [req.user.id, type || null, isRead];
    const total = (await one(`SELECT count(*)::int AS n FROM notifications WHERE ${where}`, params)).n;
    const unread = (await one('SELECT count(*)::int AS n FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND NOT is_read', [req.user.id])).n;
    const rows = await many(`SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT $4 OFFSET $5`, [...params, pg.limit, pg.offset]);
    const meta = pageMeta(total, pg);
    const pagination = { total, page: pg.page, pageSize: pg.perPage, totalPages: meta.totalPages };
    res.json({ success: true, data: { notifications: rows.map(row), pagination, unreadCount: unread } });
  },
});
define({
  method: 'GET', path: '/stats', summary: 'Notification totals by type', screen: 'Top bar > Notifications', middleware: [requireAuth],
  response: { total: 5, unread: 2, byType: { reminder: 3 } },
  handler: async (req, res) => {
    const t = await one('SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT is_read)::int AS unread FROM notifications WHERE user_id = $1 OR user_id IS NULL', [req.user.id]);
    const by = await many('SELECT type, count(*)::int AS n FROM notifications WHERE user_id = $1 OR user_id IS NULL GROUP BY type', [req.user.id]);
    res.json({ success: true, ...t, byType: Object.fromEntries(by.map((b) => [b.type, b.n])) });
  },
});
define({
  method: 'DELETE', path: '/', summary: 'Delete several notifications', screen: 'Top bar > Notifications', middleware: [requireAuth, validate(z.object({ notificationIds: z.array(z.string()).min(1) }))],
  request: { notificationIds: ['ntf_1'] }, response: { success: true, deleted: 1 },
  handler: async (req, res) => { const r = await query('DELETE FROM notifications WHERE id = ANY($2) AND user_id = $1', [req.user.id, req.body.notificationIds]); res.json({ success: true, deleted: r.rowCount }); },
});
define({
  method: 'GET', path: '/unread-count', summary: 'Unread notification count', screen: 'Top bar > Bell', middleware: [requireAuth], response: { success: true, unreadCount: 3 },
  handler: async (req, res) => { const n = (await one('SELECT count(*)::int AS n FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND NOT is_read', [req.user.id])).n; res.json({ success: true, unreadCount: n, data: { unreadCount: n } }); },
});
define({
  method: 'PUT', path: '/read-all', summary: 'Mark all notifications as read', screen: 'Top bar > Notifications', middleware: [requireAuth], response: { success: true, data: { updated: 3 } },
  handler: async (req, res) => { const r = await query('UPDATE notifications SET is_read = true, read_at = now() WHERE (user_id = $1 OR user_id IS NULL) AND NOT is_read', [req.user.id]); res.json({ success: true, updated: r.rowCount }); },
});
define({
  method: 'PUT', path: '/read', summary: 'Mark several notifications as read', screen: 'Top bar > Notifications', middleware: [requireAuth, validate(z.object({ notificationIds: z.array(z.string()).min(1) }))],
  request: { notificationIds: ['ntf_1'] }, response: { success: true, data: { updated: 1 } },
  handler: async (req, res) => { const r = await query('UPDATE notifications SET is_read = true, read_at = now() WHERE id = ANY($2) AND (user_id = $1 OR user_id IS NULL)', [req.user.id, req.body.notificationIds]); res.json({ success: true, updated: r.rowCount }); },
});
define({
  method: 'PUT', path: '/:id/read', summary: 'Mark one notification as read', screen: 'Top bar > Notifications', middleware: [requireAuth], response: { success: true },
  handler: async (req, res) => { const r = await query('UPDATE notifications SET is_read = true, read_at = now() WHERE id = $2 AND (user_id = $1 OR user_id IS NULL) RETURNING *', [req.user.id, req.params.id]); res.json({ success: true, data: r.rows[0] ? row(r.rows[0]) : null }); },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Delete one notification', screen: 'Top bar > Notifications', middleware: [requireAuth], response: { success: true },
  handler: async (req, res) => { await query('DELETE FROM notifications WHERE id = $2 AND user_id = $1', [req.user.id, req.params.id]); res.json({ success: true }); },
});
export default router;
export const mount = '/notifications';
