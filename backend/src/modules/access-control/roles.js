/**
 * Role directory of the access screens: the department of each role, its one-line summary and its order, and the
 * roles of the base platform. The source is the settings the user form groups its roles by (migration 0391):
 *   access.role_groups     [{ name, roles: [{ code, summary }] }]: departments in screen order, roles in order inside
 *   access.platform_roles  [code]: the generic roles of the base platform, shown only when asked for
 * A role in no department (created later) has department null and sorts after the others. Full access: the
 * administrator role and every role that includes it (they bypass every permission check).
 */
import { getSetting } from '../../lib/settings.js';
import { adminEquivalentRoles } from '../../lib/auth.js';

const list = (v) => (Array.isArray(v) ? v : []);

export async function roleDirectory(db) {
  const [groups, platform] = await Promise.all([getSetting('access.role_groups', []), getSetting('access.platform_roles', [])]);
  const place = new Map();
  const departments = [];
  list(groups).forEach((g, gi) => {
    const name = String(g?.name || '').trim();
    if (!name) return;
    departments.push({ name, order: gi + 1 });
    list(g.roles).forEach((r, ri) => {
      if (r?.code && !place.has(r.code)) place.set(r.code, { department: name, summary: r.summary || null, order: (gi + 1) * 100 + ri });
    });
  });
  const platformRoles = new Set(list(platform));
  const fullAccess = new Set(await adminEquivalentRoles(db));
  const { rows } = await db.query('SELECT id, code, name, description, status, inherits FROM roles ORDER BY id');
  const roles = rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, description: r.description, status: r.status, inherits: r.inherits || [],
    department: place.get(r.code)?.department || null, summary: place.get(r.code)?.summary || null,
    order: place.get(r.code)?.order ?? 100000 + r.id, platform: platformRoles.has(r.code), fullAccess: fullAccess.has(r.code),
  }));
  roles.sort((a, b) => a.order - b.order);
  return { departments, roles };
}

/** The administrator account created by the seed (never deactivated by the dormant job or an access review). */
export const BUILT_IN_ADMIN = 'BrokerVerse';

/**
 * Is the user an administrator account: the built-in administrator, or a holder of a full-access role (directly or
 * through an included role)? Only a System Administrator changes, signs out or removes the access of such an account.
 */
export async function isAdminAccount(db, userId) {
  const full = await adminEquivalentRoles(db);
  const { rows } = await db.query(`SELECT u.username = $3 OR EXISTS (SELECT 1 FROM user_effective_roles(u.id) er WHERE er.code = ANY($2)) AS admin
    FROM users u WHERE u.id = $1`, [userId, full, BUILT_IN_ADMIN]);
  return !!rows[0]?.admin;
}

/** The department of a person: the department of the first of their roles in the order of the directory (null: none). */
export const departmentOf = (dir, roleCodes) => {
  const held = new Set(roleCodes || []);
  return dir.roles.find((r) => held.has(r.code) && r.department)?.department || null;
};
