/**
 * User Access Matrix (Master > Users and Access): who has access to what, with the sign-in facts an auditor asks for
 * (last sign-in, two-step, password age, dormant accounts), segregation-of-duties conflicts with their exceptions,
 * the changes of access waiting for approval that concern each person, and the last access review outcome. The
 * access panel of one person: roles with the roles they include, what the person can do in business words, approval
 * authority today, delegations, conflicts, last review and pending changes. Ages are counted on the business date.
 */
import { getSetting } from '../../lib/settings.js';
import { businessTimeZone, today } from '../../lib/dates.js';
import { formatDate, formatDateTime } from '../../lib/pdf/format.js';
import { notFound } from '../../lib/errors.js';
import { AREAS, LEVELS, LEVEL_NAMES, MODULES, describe } from './catalogue.js';
import { listAccessChanges } from './changes.js';
import { departmentOf, roleDirectory } from './roles.js';
import { sodConflictList, STATE_WORDS } from './sod.js';
import { listDelegations, STATUS_WORDS as DELEGATION_WORDS, userAuthority } from './delegations.js';
import { OUTCOME_WORDS } from './reviews.js';
import { isPlatformPermission } from '../../lib/platform.js';

const USER_SQL = `SELECT u.id, u.username, u.display_name AS "displayName", u.employee_code AS "employeeCode", u.branch_code AS "branch", b.name AS "branchName",
    u.department AS "hrDepartment", u.designation, u.status, u.email, rt.display_name AS "reportingTo",
    COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS roles,
    COALESCE((SELECT array_agg(DISTINCT er.code ORDER BY er.code) FROM user_effective_roles(u.id) er), '{}') AS "effectiveRoles",
    u.last_login_at AS "lastLoginAt", u.totp_enabled AS "twoFactor", u.must_change_password AS "mustChangePassword", u.failed_logins AS "failedLogins",
    ($2::date - (u.password_changed_at AT TIME ZONE $3)::date) AS "passwordAgeDays",
    ($2::date - (COALESCE(u.last_login_at, u.created_at) AT TIME ZONE $3)::date) AS "daysSinceLogin", u.created_at AS "createdAt"
  FROM users u LEFT JOIN users rt ON rt.id = u.reporting_to LEFT JOIN branches b ON b.code = u.branch_code
  WHERE u.status <> 'deleted' AND ($1::text IS NULL OR u.status = $1) AND ($4::text IS NULL OR u.id = $4) ORDER BY u.display_name`;

/** Roles a person holds only through another role: [{ code, name, through }] (nearest inclusion first, active roles). */
function includedRoles(dir, direct) {
  const byCode = new Map(dir.roles.map((r) => [r.code, r]));
  const seen = new Set(direct);
  const out = [];
  const queue = direct.flatMap((c) => (byCode.get(c)?.inherits || []).map((x) => ({ code: x, through: c })));
  while (queue.length) {
    const { code, through } = queue.shift();
    const r = byCode.get(code);
    if (seen.has(code) || !r || r.status !== 'active') continue;
    seen.add(code);
    out.push({ code, name: r.name, through, throughName: byCode.get(through)?.name || through });
    queue.push(...(r.inherits || []).map((x) => ({ code: x, through })));
  }
  return out;
}

/** The users each change waiting for approval concerns: Map user id -> [{ ref, kindLabel, title, link }]. */
async function pendingByUser(db, user) {
  const changes = await listAccessChanges(db, { status: 'pending' }, user);
  const holders = new Map();
  for (const r of (await db.query(`SELECT u.id, er.code FROM users u CROSS JOIN LATERAL user_effective_roles(u.id) er WHERE u.status <> 'deleted'`)).rows) {
    if (!holders.has(r.code)) holders.set(r.code, []);
    holders.get(r.code).push(r.id);
  }
  const out = new Map();
  const add = (id, c) => {
    if (!id) return;
    if (!out.has(id)) out.set(id, []);
    if (!out.get(id).some((x) => x.ref === c.ref)) out.get(id).push({ ref: c.ref, id: c.id, kind: c.kind, kindLabel: c.kindLabel, title: c.targetLabel, link: c.link });
  };
  for (const c of changes) {
    const p = c.payload || {};
    if (c.kind === 'role-access') (holders.get(c.target) || []).forEach((id) => add(id, c));
    else if (c.kind === 'delegation') [p.delegatorId, p.delegateId].forEach((id) => add(id, c));
    else if (c.kind === 'sod-exception') add(p.userId, c);
    else if (c.kind === 'access-review') (p.removals || []).forEach((x) => add(x.userId, c));
    else if (c.kind === 'authority-limits') (p.lines || []).forEach((l) => (l.userId ? add(l.userId, c) : (holders.get(l.roleCode) || []).forEach((id) => add(id, c))));
  }
  return out;
}

/** The latest decided access review line of each user. */
async function lastReviews(db, userId = null) {
  const { rows } = await db.query(`SELECT DISTINCT ON (i.user_id) i.user_id AS "userId", a.id AS "reviewId", a.name, i.decision, i.remarks, i.decided_at AS "decidedAt",
      d.display_name AS "decidedBy" FROM access_review_items i JOIN access_reviews a ON a.id = i.review_id LEFT JOIN users d ON d.id = i.decided_by
    WHERE i.decision <> 'pending' AND ($1::text IS NULL OR i.user_id = $1) ORDER BY i.user_id, i.decided_at DESC`, [userId]);
  return new Map(rows.map((r) => [r.userId, { ...r, reviewId: Number(r.reviewId), outcome: OUTCOME_WORDS[r.decision] || r.decision }]));
}

/**
 * Every user (or those of one status) with roles by name, included roles, department, branch, sign-in facts,
 * conflicts and their exception state, pending changes and the last review; the role directory for the filters.
 */
export async function userMatrix(db, { status = null, userId = null } = {}, user = null) {
  const day = await today();
  const tz = await businessTimeZone();
  const dir = await roleDirectory(db);
  const { rows } = await db.query(USER_SQL, [status, day, tz, userId]);
  const dormantDays = Number(await getSetting('access.dormant_days', 90)) || 0;
  const conflicts = new Map();
  for (const c of (await sodConflictList(db, { status: 'all', userId }, user)).rows) {
    if (!conflicts.has(c.userId)) conflicts.set(c.userId, []);
    conflicts.get(c.userId).push({ ruleId: c.ruleId, ruleCode: c.ruleCode, name: c.ruleName, action: c.action, kind: c.kind, state: c.state,
      validUntil: c.exception?.validUntil || null, exceptionReason: c.exception?.reason || null, approvedBy: c.exception?.approvedBy || null,
      approvedAt: c.exception?.approvedAt || null, heldTogether: c.heldTogether });
  }
  const pending = await pendingByUser(db, user);
  const reviews = await lastReviews(db, userId);
  const byCode = new Map(dir.roles.map((r) => [r.code, r]));
  return {
    asOf: day,
    dormantDays,
    departments: dir.departments,
    roles: dir.roles.map((r) => ({ code: r.code, name: r.name, department: r.department, summary: r.summary, platform: r.platform, fullAccess: r.fullAccess, status: r.status })),
    rows: rows.map((u) => {
      const sod = conflicts.get(u.id) || [];
      return {
        ...u, department: departmentOf(dir, u.roles), roleNames: u.roles.map((c) => byCode.get(c)?.name || c), platformRoles: u.roles.filter((c) => byCode.get(c)?.platform),
        included: includedRoles(dir, u.roles), sodConflicts: sod, openConflicts: sod.filter((c) => c.state === 'open' || c.state === 'expired').length,
        dormant: dormantDays > 0 && u.status === 'active' && Number(u.daysSinceLogin) >= dormantDays, pending: pending.get(u.id) || [], lastReview: reviews.get(u.id) || null,
      };
    }),
  };
}

/** What a person can do: the areas and modules of the catalogue with the levels held (full access: everything). */
async function accessOf(db, userId, fullAccess) {
  const { rows } = await db.query(fullAccess ? 'SELECT code, module, description FROM permissions'
    : `SELECT DISTINCT p.code, p.module, p.description FROM user_effective_roles($1) er JOIN role_permissions rp ON rp.role_id = er.role_id
      JOIN permissions p ON p.id = rp.permission_id`, fullAccess ? [] : [userId]);
  const held = rows.filter((r) => !isPlatformPermission(r.code)).map((r) => describe(r.code, r)).filter((p) => p.checked);
  const modules = new Map();
  for (const p of held) {
    if (!modules.has(p.module)) {
      const m = MODULES.find((x) => x.code === p.module);
      modules.set(p.module, { code: p.module, area: p.area, name: m?.name || p.module.replace(/^other:/, ''), order: m?.order ?? 1000, levels: [], codes: [] });
    }
    const m = modules.get(p.module);
    if (!m.levels.includes(p.level)) m.levels.push(p.level);
    m.codes.push(p.code);
  }
  return AREAS.map((a) => ({ code: a.code, name: a.name,
    modules: [...modules.values()].filter((m) => m.area === a.code).sort((x, y) => x.order - y.order)
      .map((m) => ({ ...m, levels: LEVELS.filter((l) => m.levels.includes(l)), codes: m.codes.sort() })) }))
    .filter((a) => a.modules.length);
}

/** The access panel of one person. */
export async function userAccessPanel(db, userId, user) {
  const m = await userMatrix(db, { userId }, user);
  const u = m.rows[0];
  if (!u) throw notFound('User not found');
  const dir = await roleDirectory(db);
  const byCode = new Map(dir.roles.map((r) => [r.code, r]));
  const fullAccess = u.effectiveRoles.some((c) => byCode.get(c)?.fullAccess);
  const delegations = (await listDelegations(db, { view: 'all' }, user)).rows
    .filter((d) => (d.delegatorId === userId || d.delegateId === userId) && ['pending', 'scheduled', 'in-effect'].includes(d.status));
  const authority = await userAuthority(db, userId);
  return {
    asOf: m.asOf,
    user: u,
    roles: u.roles.map((c) => {
      const r = byCode.get(c);
      return { code: c, name: r?.name || c, department: r?.department || null, summary: r?.summary || null, platform: !!r?.platform, fullAccess: !!r?.fullAccess,
        included: u.included.filter((x) => x.through === c).map((x) => ({ code: x.code, name: x.name })) };
    }),
    fullAccess,
    access: await accessOf(db, userId, fullAccess),
    levelNames: LEVEL_NAMES,
    authority: authority.lines.filter((l) => l.canApprove),
    delegations: { given: delegations.filter((d) => d.delegatorId === userId), received: delegations.filter((d) => d.delegateId === userId) },
  };
}

// ---------------------------------------------------------------- export for audit

const col = (header, width = 20, type = 'text') => ({ header, width, type });

/** Workbook: Users, Roles of users, Segregation of duties, Delegations in effect (codes added with technical names). */
export async function userMatrixSheets(db, user, fmt, { technical = false, status = null } = {}) {
  const m = await userMatrix(db, { status }, user);
  const dt = (v) => (v ? formatDateTime(v, fmt) : '');
  const d = (v) => (v ? formatDate(v, fmt) : '');
  const yes = (v) => (v ? 'Yes' : 'No');
  const words = { active: 'Active', inactive: 'Inactive', locked: 'Locked' };
  const users = m.rows.map((u) => [u.username, u.displayName, u.employeeCode || '', u.department || '', u.designation || '', u.branchName || u.branch || '', u.reportingTo || '',
    words[u.status] || u.status, u.roleNames.join(', '), u.included.map((x) => `${x.name} (through ${x.throughName})`).join(', '), u.lastLoginAt ? dt(u.lastLoginAt) : 'Never',
    Number(u.daysSinceLogin), yes(u.dormant), u.twoFactor ? 'On' : 'Off', Number(u.passwordAgeDays), u.openConflicts,
    u.sodConflicts.filter((c) => c.state === 'accepted').map((c) => `${c.name} until ${d(c.validUntil)}`).join('; '), u.pending.map((p) => `${p.ref} ${p.kindLabel}`).join('; '),
    u.lastReview ? `${u.lastReview.outcome} (${u.lastReview.name})` : '', u.lastReview ? dt(u.lastReview.decidedAt) : '', ...(technical ? [u.roles.join(', ')] : [])]);
  const roleRows = [];
  for (const u of m.rows) {
    const role = (code) => m.roles.find((r) => r.code === code);
    for (const c of u.roles) roleRows.push([u.username, u.displayName, words[u.status] || u.status, role(c)?.name || c, role(c)?.platform ? 'Base platform roles' : role(c)?.department || 'Other roles', 'Direct', ...(technical ? [c] : [])]);
    for (const x of u.included) roleRows.push([u.username, u.displayName, words[u.status] || u.status, x.name, role(x.code)?.department || 'Other roles', `Through ${x.throughName}`, ...(technical ? [x.code] : [])]);
  }
  const sodRows = m.rows.flatMap((u) => u.sodConflicts.map((c) => [u.username, u.displayName, words[u.status] || u.status, c.heldTogether.join(' with '), c.name,
    c.action === 'block' ? 'Block' : 'Warn', STATE_WORDS[c.state], c.exceptionReason || '', d(c.validUntil), c.approvedBy || '', ...(technical ? [c.ruleCode] : [])]));
  const dels = (await listDelegations(db, { view: 'current' }, user)).rows;
  const delRows = dels.map((x) => [x.ref, x.delegatorName, x.delegateName, x.transactionNames.join(', '), d(x.dateFrom), d(x.dateTo), DELEGATION_WORDS[x.status], x.reason || '',
    x.approvedBy || '']);
  const code = (h) => (technical ? [col(h, 30)] : []);
  return [
    { name: 'Users', rows: users, columns: [col('Username', 20), col('Name', 28), col('Employee code', 14), col('Department', 22), col('Designation', 24), col('Branch', 20),
      col('Reporting to', 24), col('Status', 10), col('Roles', 44), col('Included roles', 40), col('Last sign-in', 18), col('Days since sign-in', 12, 'integer'), col('Dormant', 10),
      col('Two-step', 10), col('Password age (days)', 12, 'integer'), col('Open conflicts', 12, 'integer'), col('Exceptions', 40), col('Waiting for approval', 30),
      col('Last review outcome', 34), col('Last review date', 18), ...code('Role codes')] },
    { name: 'Roles of users', rows: roleRows, columns: [col('Username', 20), col('Name', 28), col('Status', 10), col('Role', 36), col('Department', 24), col('How held', 34), ...code('Role code')] },
    { name: 'Segregation of duties', rows: sodRows, columns: [col('Username', 20), col('Name', 28), col('Status', 10), col('Held together', 50), col('Rule', 34), col('When assigned', 14),
      col('State', 22), col('Exception reason', 40), col('Valid until', 14), col('Approved by', 22), ...code('Rule code')] },
    { name: 'Delegations in effect', rows: delRows, columns: [col('Reference', 12), col('Approver away', 28), col('Covered by', 28), col('Transactions', 50), col('From', 12),
      col('To', 12), col('Status', 16), col('Reason', 40), col('Approved by', 22)] },
  ];
}
