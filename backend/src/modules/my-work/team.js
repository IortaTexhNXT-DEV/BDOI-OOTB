/**
 * The reporting line of My Work: a manager's team is every active user who reports to them through users.reporting_to,
 * directly or through other managers (the reporting line set on Master > User Management > Users).
 */
import { query } from '../../db/pool.js';
import { isAdmin } from '../../lib/auth.js';

/** Active users reporting to `userId` at any depth (the manager excluded): [{ id, username, displayName, designation, managerId, depth }]. */
export async function teamOf(userId, db = { query }) {
  const { rows } = await db.query(`WITH RECURSIVE t AS (
      SELECT u.id, u.username, u.display_name, u.designation, u.reporting_to, 1 AS depth, ARRAY[u.id] AS path
        FROM users u WHERE u.reporting_to = $1 AND u.id <> $1 AND u.status = 'active'
      UNION ALL
      SELECT u.id, u.username, u.display_name, u.designation, u.reporting_to, t.depth + 1, t.path || u.id
        FROM users u JOIN t ON u.reporting_to = t.id WHERE u.status = 'active' AND NOT u.id = ANY(t.path) AND u.id <> $1 AND t.depth < 12)
    SELECT DISTINCT ON (id) id, username, display_name, designation, reporting_to, depth FROM t ORDER BY id, depth`, [userId]);
  return rows.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name, designation: r.designation, managerId: r.reporting_to, depth: r.depth }))
    .sort((a, b) => a.depth - b.depth || String(a.displayName).localeCompare(String(b.displayName)));
}

/** Ids of the team (without the manager). */
export const teamIds = async (userId, db) => (await teamOf(userId, db)).map((u) => u.id);

/** True when `managerId` may act for `userId`: the same user, a manager above them, or an administrator. */
export async function manages(manager, userId, db) {
  if (!manager?.id || !userId) return false;
  if (manager.id === userId || isAdmin(manager)) return true;
  return (await teamIds(manager.id, db)).includes(userId);
}

/** People a user may assign work to: themselves and their team (an administrator: every active user). */
export async function assignableUsers(user, db = { query }) {
  if (isAdmin(user)) {
    const { rows } = await db.query("SELECT id, username, display_name, designation, reporting_to FROM users WHERE status = 'active' ORDER BY display_name");
    return rows.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name, designation: r.designation, managerId: r.reporting_to, self: r.id === user.id }));
  }
  const me = (await db.query('SELECT id, username, display_name, designation, reporting_to FROM users WHERE id = $1', [user.id])).rows[0];
  const self = me ? [{ id: me.id, username: me.username, displayName: me.display_name, designation: me.designation, managerId: me.reporting_to, self: true }] : [];
  return [...self, ...(await teamOf(user.id, db)).map((u) => ({ ...u, self: false }))];
}
