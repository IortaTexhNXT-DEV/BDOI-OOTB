/** Notifications: the bell in the header. Other modules create them with notify(). */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';

/** notification.approval_requests: the one switch for every approval notification (requests and decisions); default on. */
export const approvalNotificationsOn = async () => (await getSetting('notification.approval_requests', true)) !== false;

/**
 * Create a notification for a user, or for everyone who holds `audience` (a permission code, e.g.
 * 'write:journal-vouchers') when userId is null. A notification with neither is a broadcast to every user.
 * Approval requests (type 'approval') are not created when notification.approval_requests is off (returns null);
 * the maker-checker flows use approvals.js, which also covers the decision sent to the maker.
 */
export async function notify({ userId = null, type = 'info', priority = 'normal', title, message, link = null, entity = null, entityId = null, audience = null }) {
  if (type === 'approval' && !(await approvalNotificationsOn())) return null;
  const r = await query('INSERT INTO notifications(user_id, type, priority, title, message, link, entity, entity_id, audience) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
    [userId, type, priority, title, message, link, entity, entityId == null ? null : String(entityId), userId ? null : audience]);
  return r.rows[0].id;
}

/** Notifications visible to the user: their own, and those addressed to a permission they hold (or to everyone). $1 = user id, $2 = permissions. */
export const VISIBLE_TO_USER = '(user_id = $1 OR (user_id IS NULL AND (audience IS NULL OR audience = ANY($2::text[]))))';
