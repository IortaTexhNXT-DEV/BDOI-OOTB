/**
 * Role Permissions (Master > Users and Access): what each role may do in business words, and changes of a role's
 * access through the approval of another administrator.
 *
 * Effective access of a role = its own grants + the grants of the roles it includes (roles.inherits, recursively,
 * active roles only, as user_effective_roles gives them to a user). The administrator role and the roles that include
 * it have full access: they pass every permission check and are not changed here.
 *
 * A change is a delta { grant, revoke } on the role's own grants (never a replacement, so grants the screen does not
 * show are kept). It is checked (known codes, Basic access kept, segregation-of-duties access rules for the role and
 * for every active user who holds it) and, with access.change_approval, stored as a role-access change that a
 * different user with approve:access-control approves (changes.js). Applying it renews the sessions of the users of
 * the role and of every role that includes it, so their permissions change at their next request.
 */
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { formatDateTime } from '../../lib/pdf/format.js';
import { requiredReason } from '../ops-masters/records.js';
import { AREAS, BASELINE, LEVEL_NAMES, LEVELS, businessName, catalogue } from './catalogue.js';
import { roleDirectory } from './roles.js';
import { changeApproval, listAccessChanges, registerAccessKind, requestAccessChange, rolesHeldBy } from './changes.js';
import { breaksAccessRule as breaks, listSodRules } from './service.js';

export const KIND = 'role-access';
export const ROLE_PERMISSIONS_PATH = '/master/generals/usermanagement/role-permissions';
const EDIT = 'write:roles';
const REASON_CONTEXT = 'access_change';

const uniq = (list) => [...new Set((list || []).map(String))];

async function grantsByRole(db) {
  const { rows } = await db.query(`SELECT r.code AS role, p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
    ORDER BY p.code`);
  const own = new Map();
  for (const r of rows) {
    if (!own.has(r.role)) own.set(r.role, []);
    own.get(r.role).push(r.code);
  }
  return own;
}

/** Included grants of a role: { code: the included role it comes through } (nearest inclusion first, active roles only). */
function includedGrants(role, byCode, own) {
  const via = {};
  const seen = new Set([role.code]);
  const queue = (role.inherits || []).map((c) => ({ code: c, through: c }));
  while (queue.length) {
    const { code, through } = queue.shift();
    const r = byCode.get(code);
    if (seen.has(code) || !r || r.status !== 'active') continue;
    seen.add(code);
    for (const p of own.get(code) || []) if (!(p in via)) via[p] = through;
    for (const next of r.inherits || []) queue.push({ code: next, through });
  }
  const mine = new Set(own.get(role.code) || []);
  return Object.fromEntries(Object.entries(via).filter(([p]) => !mine.has(p)));
}

/** Roles that include a role, at any depth (the role itself first). */
async function includingRoles(db, code) {
  const { rows } = await db.query(`WITH RECURSIVE inc(code) AS (SELECT $1::text UNION SELECT r.code FROM roles r JOIN inc ON inc.code = ANY(r.inherits))
    SELECT code FROM inc`, [code]);
  return rows.map((r) => r.code);
}

async function userCounts(db) {
  const { rows } = await db.query(`SELECT r.code, count(*) FILTER (WHERE u.status = 'active')::int AS active, count(*) FILTER (WHERE u.status NOT IN ('active', 'deleted'))::int AS inactive
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id GROUP BY r.code`);
  return new Map(rows.map((r) => [r.code, { active: r.active, inactive: r.inactive }]));
}

/** Why this user may not change the access of a role (null when they may). */
function editBlocked(role, user, pending) {
  if (!hasPermission(user, EDIT)) return 'no-permission';
  if (role.fullAccess) return 'full-access';
  if (!isAdmin(user) && (user.roles || []).includes(role.code)) return 'own-role';
  if (pending) return 'pending';
  return null;
}

function assertMayChange(role, user) {
  if (role.fullAccess) throw forbidden(`${role.name} has full access (it is or includes the System Administrator); its access is not changed here`);
  if (!isAdmin(user) && (user.roles || []).includes(role.code)) throw forbidden('You cannot change the access of a role you hold');
}

async function permissionRows(db) {
  return (await db.query('SELECT code, module, description FROM permissions ORDER BY code')).rows;
}

/** Everything the screen shows: catalogue, departments, roles with their own and included grants, users and pending change. */
export async function overview(db, user) {
  const [rows, dir, own, counts, pending] = await Promise.all([permissionRows(db), roleDirectory(db), grantsByRole(db), userCounts(db),
    listAccessChanges(db, { kind: KIND }, user)]);
  const byCode = new Map(dir.roles.map((r) => [r.code, r]));
  const pendingOf = new Map(pending.map((c) => [c.target, c]));
  const includedBy = (code) => dir.roles.filter((r) => r.inherits.includes(code)).map((r) => r.code);
  return {
    asOf: await today(),
    approval: await changeApproval(),
    catalogue: catalogue(rows),
    departments: dir.departments,
    roles: dir.roles.map((r) => ({
      ...r, includedBy: includedBy(r.code), users: counts.get(r.code) || { active: 0, inactive: 0 },
      own: own.get(r.code) || [], included: r.fullAccess ? {} : includedGrants(r, byCode, own),
      pending: pendingOf.get(r.code) || null, editBlocked: editBlocked(r, user, pendingOf.has(r.code)),
    })),
    pendingCount: pending.length,
    abilities: { edit: hasPermission(user, EDIT), approve: hasPermission(user, 'approve:access-control') },
  };
}

// ---------------------------------------------------------------- segregation of duties on access

const sides = (rule, set) => ({ sideA: rule.accessA.filter((c) => set.has(c)), sideB: rule.accessB.filter((c) => set.has(c)) });

/**
 * What a change of a role's access would do: the delta without no-ops, the segregation-of-duties access rules it
 * newly breaks for the role itself and, for the others, for the active users who hold the role (directly or through a
 * role that includes it), and who is affected. `strict` refuses a revoke of a grant the role only has through an
 * included role (the screen never offers it).
 */
export async function checkChange(db, roleCode, { grant = [], revoke = [] } = {}, { strict = true } = {}) {
  // one after the other: db may be the client of a transaction
  const rows = await permissionRows(db);
  const dir = await roleDirectory(db);
  const own = await grantsByRole(db);
  const role = dir.roles.find((r) => r.code === roleCode);
  if (!role) throw notFound('Role not found');
  const known = new Set(rows.map((r) => r.code));
  const unknown = uniq([...grant, ...revoke]).filter((c) => !known.has(c));
  if (unknown.length) throw badRequest('Validation failed', [{ path: 'grant', message: `Unknown permission: ${unknown.join(', ')}` }]);
  const both = uniq(grant).filter((c) => uniq(revoke).includes(c));
  if (both.length) throw badRequest('Validation failed', [{ path: 'revoke', message: `Both added and removed: ${both.join(', ')}` }]);
  const baseline = uniq(revoke).filter((c) => BASELINE.includes(c));
  if (baseline.length) throw badRequest('Validation failed', [{ path: 'revoke', message: 'Basic access stays on for every role' }]);
  const byCode = new Map(dir.roles.map((r) => [r.code, r]));
  const mine = new Set(own.get(role.code) || []);
  const included = includedGrants(role, byCode, own);
  const throughOnly = uniq(revoke).filter((c) => !mine.has(c) && c in included);
  if (strict && throughOnly.length) {
    throw badRequest('Validation failed', [{ path: 'revoke', message: `${throughOnly.map((c) => businessName(c)).join('; ')} comes from ${byCode.get(included[throughOnly[0]])?.name}; change that role` }]);
  }
  const add = uniq(grant).filter((c) => !mine.has(c));
  const remove = uniq(revoke).filter((c) => mine.has(c));
  const after = new Set([...mine, ...add].filter((c) => !remove.includes(c)));

  const rules = (await listSodRules(db)).filter((s) => s.active && s.kind === 'access');
  const warnings = [];
  const effective = (set) => new Set([...set, ...Object.keys(included)]);
  const roleBefore = effective(mine);
  const roleAfter = effective(after);
  const onRole = new Set();
  if (!role.fullAccess) {
    for (const s of rules) {
      if (breaks(s, roleAfter) && !breaks(s, roleBefore)) {
        onRole.add(s.code);
        warnings.push({ code: s.code, name: s.name, action: s.action, reason: s.reason, scope: 'role', ...sides(s, roleAfter), users: [], more: 0 });
      }
    }
  }
  const holders = await includingRoles(db, role.code);
  const { rows: users } = await db.query(`SELECT u.id, u.display_name AS name, array_agg(DISTINCT er.code) AS roles,
      EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = (SELECT id FROM roles WHERE code = $1)) AS direct
    FROM users u CROSS JOIN LATERAL user_effective_roles(u.id) er WHERE u.status = 'active'
    GROUP BY u.id, u.display_name HAVING bool_or(er.code = $1) ORDER BY u.display_name`, [role.code]);
  const fullAccess = new Set(dir.roles.filter((r) => r.fullAccess).map((r) => r.code));
  const perUser = new Map();
  for (const u of users) {
    const held = u.roles.filter((c) => !fullAccess.has(c));
    const before = new Set(held.flatMap((c) => own.get(c) || []));
    const later = new Set(held.flatMap((c) => (c === role.code ? [...after] : own.get(c) || [])));
    for (const s of rules) {
      if (onRole.has(s.code) || !breaks(s, later) || breaks(s, before)) continue;
      if (!perUser.has(s.code)) perUser.set(s.code, { rule: s, names: [], set: later });
      perUser.get(s.code).names.push(u.name);
    }
  }
  for (const { rule: s, names, set } of perUser.values()) {
    warnings.push({ code: s.code, name: s.name, action: s.action, reason: s.reason, scope: 'users', ...sides(s, set), users: names.slice(0, 10), more: Math.max(0, names.length - 10) });
  }
  const enforced = (await getSetting('access.sod_enforced', true)) !== false;
  const through = holders.filter((c) => c !== role.code);
  return {
    role: { code: role.code, name: role.name, fullAccess: role.fullAccess },
    grant: add, revoke: remove,
    added: add.map((c) => businessName(c)), removed: remove.map((c) => businessName(c)),
    warnings, blocked: enforced && warnings.some((w) => w.action === 'block'),
    affected: { users: users.filter((u) => u.direct).length, throughUsers: users.filter((u) => !u.direct).length, throughRoles: through.map((c) => byCode.get(c)?.name || c) },
  };
}

// ---------------------------------------------------------------- request, apply, describe

/**
 * Change the access of a role: { grant, revoke, reasonCode, note }. With access.change_approval the change waits for
 * another administrator (returns { change }); without it, it applies at once (returns { applied }). `reason` replaces
 * the coded reason for a change that comes from the Role form ({ code: null, text }).
 */
export async function proposeRoleAccess(db, roleCode, body, user, { reason = null } = {}) {
  const dir = await roleDirectory(db);
  const role = dir.roles.find((r) => r.code === roleCode);
  if (!role) throw notFound('Role not found');
  assertMayChange(role, user);
  const check = await checkChange(db, role.code, body);
  if (!check.grant.length && !check.revoke.length) throw badRequest('Validation failed', [{ path: 'grant', message: 'Nothing to change: the role already has this access' }]);
  const why = reason || await requiredReason(db, REASON_CONTEXT, body);
  if (check.blocked) {
    throw conflict(`Segregation of duties: ${check.warnings.filter((w) => w.action === 'block').map((w) => w.name).join('; ')} may not be combined`);
  }
  const before = (await grantsByRole(db)).get(role.code) || [];
  if (await changeApproval()) {
    const change = await requestAccessChange(db, { kind: KIND, target: role.code, user, note: why.text, before: { permissions: before },
      payload: { title: role.name, grant: check.grant, revoke: check.revoke, reasonCode: why.code, reason: why.text, warnings: check.warnings } });
    return { change, applied: null, check };
  }
  const applied = await applyRoleAccess(db, { target: role.code, payload: { grant: check.grant, revoke: check.revoke } }, user);
  return { change: null, applied, check };
}

/** Apply an approved change (or one made with the approval switched off): checked again, then the delta. */
export async function applyRoleAccess(db, change, user) {
  const code = change.target;
  const locked = (await db.query('SELECT id FROM roles WHERE code = $1 FOR UPDATE', [code])).rows[0];
  if (!locked) throw conflict('The role no longer exists');
  const role = (await roleDirectory(db)).roles.find((r) => r.code === code);
  assertMayChange(role, user);
  const check = await checkChange(db, code, change.payload || {}, { strict: false });
  if (check.blocked) {
    throw conflict(`Segregation of duties: ${check.warnings.filter((w) => w.action === 'block').map((w) => w.name).join('; ')} may not be combined`);
  }
  const before = (await grantsByRole(db)).get(code) || [];
  if (check.grant.length) {
    await db.query('INSERT INTO role_permissions(role_id, permission_id) SELECT $1, id FROM permissions WHERE code = ANY($2) ON CONFLICT DO NOTHING', [locked.id, check.grant]);
  }
  if (check.revoke.length) {
    await db.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id IN (SELECT id FROM permissions WHERE code = ANY($2))', [locked.id, check.revoke]);
  }
  // permissions travel in the access token: the users of the role and of every role that includes it sign in again
  const holders = await includingRoles(db, code);
  const renewed = await db.query(`UPDATE users SET token_version = token_version + 1
    WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code = ANY($1))`, [holders]);
  await db.query('UPDATE roles SET updated_at = now() WHERE id = $1', [locked.id]);
  const after = (await grantsByRole(db)).get(code) || [];
  return { role: code, roleName: role.name, grant: check.grant, revoke: check.revoke, before, after, renewedSessions: renewed.rowCount,
    audit: { entity: 'role', entityId: locked.id, action: 'access-change', before: { permissions: before },
      after: { permissions: after, added: check.grant, removed: check.revoke, change: change.id ? `CFG-${change.id}` : null } } };
}

/** Business lines of a change: "Added: Accounts › Bank reconciliation › Approve". */
export function describeRoleAccess(payload = {}) {
  return [...(payload.grant || []).map((c) => `Added: ${businessName(c)}`), ...(payload.revoke || []).map((c) => `Removed: ${businessName(c)}`)];
}

registerAccessKind(KIND, {
  label: 'Role access',
  link: (c) => `${ROLE_PERMISSIONS_PATH}?view=pending&change=${c.id}`,
  describe: async (db, c) => {
    const name = (await db.query('SELECT name FROM roles WHERE code = $1', [c.target])).rows[0]?.name;
    return { targetLabel: name || c.payload?.title || c.target, summary: describeRoleAccess(c.payload) };
  },
  assertDecider: async (db, c, user) => {
    const role = (await roleDirectory(db)).roles.find((r) => r.code === c.target);
    if (role) assertMayChange(role, user);
    if ((await rolesHeldBy(db, user.id)).has(c.target)) throw forbidden('You cannot approve a change of the access of a role you hold');
  },
  apply: (db, c, user) => applyRoleAccess(db, c, user),
});

// ---------------------------------------------------------------- export for audit

const yesNo = (v) => (v ? 'Yes' : 'No');

/**
 * Workbook of Role Permissions: Access by role (role x module x level), Matrix (modules down, roles across),
 * Waiting for approval, Permission codes. `roles`: codes to export (all the roles shown otherwise); `base`: include the
 * roles of the base platform.
 */
export async function exportSheets(db, { roles = [], base = false } = {}, user, fmt) {
  const o = await overview(db, user);
  const cat = o.catalogue;
  const wanted = uniq(roles);
  const chosen = o.roles.filter((r) => (wanted.length ? wanted.includes(r.code) : base || !r.platform));
  const area = (code) => AREAS.find((a) => a.code === code)?.name || 'Other';
  const byCode = new Map(o.roles.map((r) => [r.code, r]));
  const modules = cat.modules.filter((m) => m.levels.length);
  const codeOf = (m, level) => cat.permissions.find((p) => p.module === m.code && p.level === level && p.checked)?.code;
  const state = (r, code) => {
    if (r.fullAccess) return { granted: true, how: 'Full access' };
    if (r.own.includes(code)) return { granted: true, how: 'Own' };
    if (code in r.included) return { granted: true, how: `Through ${byCode.get(r.included[code])?.name || r.included[code]}` };
    return { granted: false, how: '' };
  };
  const pendingMark = (r, code) => {
    if (!r.pending) return '';
    if (r.pending.payload.grant?.includes(code)) return 'Will be added';
    if (r.pending.payload.revoke?.includes(code)) return 'Will be removed';
    return '';
  };
  const department = (r) => (r.platform ? 'Base platform roles' : r.department || 'Other roles');
  const status = (r) => (r.status === 'active' ? 'Active' : 'Inactive');

  const byRole = [];
  for (const r of chosen) {
    for (const m of modules) {
      for (const level of m.levels) {
        const code = codeOf(m, level);
        const s = state(r, code);
        byRole.push([r.name, department(r), status(r), area(m.area), m.name, LEVEL_NAMES[level], yesNo(s.granted), s.how, pendingMark(r, code), r.users.active]);
      }
    }
  }
  const matrix = modules.map((m) => [area(m.area), m.name, ...chosen.map((r) => m.levels.filter((l) => state(r, codeOf(m, l)).granted).map((l) => LEVEL_NAMES[l]).join(', '))]);
  const pending = [];
  for (const r of chosen.filter((x) => x.pending)) {
    const c = r.pending;
    const lines = [...(c.payload.grant || []).map((code) => ['Add', code]), ...(c.payload.revoke || []).map((code) => ['Remove', code])];
    for (const [change, code] of lines) {
      const p = cat.permissions.find((x) => x.code === code);
      pending.push([c.ref, r.name, change, area(p?.area), cat.modules.find((m) => m.code === p?.module)?.name || code, LEVEL_NAMES[p?.level] || '', c.payload.reason || c.changeNote || '',
        c.requestedBy || '', formatDateTime(c.requestedAt, fmt), (c.payload.warnings || []).map((w) => w.name).join('; ')]);
    }
  }
  const moduleOrder = (p) => cat.modules.find((m) => m.code === p.module)?.order ?? 0;
  const codes = [...cat.permissions].sort((a, b) => moduleOrder(a) - moduleOrder(b) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
    .map((p) => [p.code, area(p.area), cat.modules.find((m) => m.code === p.module)?.name || p.module, LEVEL_NAMES[p.level], p.meaning, yesNo(p.checked)]);
  const col = (header, width = 18) => ({ header, width });
  return [
    { name: 'Access by role', rows: byRole, columns: [col('Role', 34), col('Department', 24), col('Role status', 12), col('Area', 26), col('Module', 34), col('Level', 16),
      col('Granted', 10), col('How', 30), col('Pending', 16), { header: 'Active users', width: 12, type: 'integer' }] },
    { name: 'Matrix', rows: matrix, columns: [col('Area', 26), col('Module', 34), ...chosen.map((r) => col(r.name, 24))] },
    { name: 'Waiting for approval', rows: pending, columns: [col('Request', 12), col('Role', 34), col('Change', 10), col('Area', 26), col('Module', 34), col('Level', 16),
      col('Reason', 40), col('Requested by', 24), col('Requested at', 18), col('Segregation of duties warnings', 40)] },
    { name: 'Permission codes', rows: codes, columns: [col('Code', 30), col('Area', 26), col('Module', 34), col('Level', 16), col('Meaning', 70), col('Checked by the system', 14)] },
  ].map((s) => ({ ...s, columns: s.columns.map((c) => ({ type: 'text', ...c })) }));
}

