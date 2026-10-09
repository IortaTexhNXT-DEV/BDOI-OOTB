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
