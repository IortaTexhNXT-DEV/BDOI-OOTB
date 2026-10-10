/**
 * Segregation of Duties (Master > Users and Access): the rules, who breaks them, and the conflicts accepted for one
 * person (exceptions).
 *
 * Conflicts by user: every user (active by default) whose effective roles break an active rule (roles held together,
 * or access combined on the permissions of the active roles, full-access roles left out). A conflict is open,
 * accepted until a date (an exception in force), waiting for approval (an exception requested), or expired (the
 * exception's date has passed: open again, without any job).
 *
 * Changes: a new rule, a changed rule and switching a rule off or on (reason of access_change) are changes of kind
 * sod-rule; an exception (reason of sod_exception, end date at most access.sod_exception_max_days away) is a change of
 * kind sod-exception. With access.change_approval (on by default) they apply once a different user holding
 * approve:access-control approves them (changes.js), never the person an exception is for; without it they apply at
 * once. Nobody requests an exception for himself or herself. Ending an exception only reduces access: at once.
 * An exception does not lift a Block rule when roles are given (service.assertSod).
 */
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { adminEquivalentRoles, hasPermission } from '../../lib/auth.js';
import { addDays, today } from '../../lib/dates.js';
import { formatDate, formatDateTime } from '../../lib/pdf/format.js';
import { requiredReason } from '../ops-masters/records.js';
import { businessName } from './catalogue.js';
import { changeApproval, listAccessChanges, registerAccessKind, requestAccessChange } from './changes.js';
import { departmentOf, roleDirectory } from './roles.js';
import { breaksAccessRule, listSodRules, sodSides } from './service.js';

export const RULE_KIND = 'sod-rule';
export const EXCEPTION_KIND = 'sod-exception';
export const SOD_PATH = '/master/generals/usermanagement/segregation-of-duties';
const EDIT = 'write:access-control';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const STATE_WORDS = { open: 'Open', accepted: 'Accepted', pending: 'Waiting for approval', expired: 'Exception expired' };

const between = (r) => (r.kind === 'access' ? `${r.accessANames.join(', ')} with ${r.accessBNames.join(', ')}` : `${r.roleAName || r.roleA} with ${r.roleBName || r.roleB}`);

// ---------------------------------------------------------------- conflicts by user

/** Effective roles and permissions of the users (status: active by default, or all). */
async function holders(db, { status = 'active', userId = null } = {}) {
  const { rows } = await db.query(`SELECT u.id, u.username, u.display_name AS name, u.status, u.designation,
      COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS roles,
      COALESCE((SELECT array_agg(DISTINCT er.code) FROM user_effective_roles(u.id) er), '{}') AS effective
    FROM users u WHERE u.status <> 'deleted' AND ($1::text = 'all' OR u.status = $1) AND ($2::text IS NULL OR u.id = $2) ORDER BY u.display_name`, [status || 'active', userId]);
  const full = await adminEquivalentRoles(db);
  const { rows: perms } = await db.query(`SELECT u.id, array_agg(DISTINCT p.code) AS codes FROM users u CROSS JOIN LATERAL user_effective_roles(u.id) er
    JOIN role_permissions rp ON rp.role_id = er.role_id JOIN permissions p ON p.id = rp.permission_id WHERE NOT (er.code = ANY($1)) GROUP BY u.id`, [full]);
  const codes = new Map(perms.map((r) => [r.id, new Set(r.codes)]));
  return rows.map((u) => ({ ...u, codes: codes.get(u.id) || new Set() }));
}

/** Rules a user breaks: role rules on the effective roles, access rules on the permissions. */
export const brokenRules = (rules, u) => rules.filter((s) => s.active
  && (s.kind === 'access' ? breaksAccessRule(s, u.codes) : u.effective.includes(s.roleA) && u.effective.includes(s.roleB)));

/** Exceptions with their rule and user names (status: active, ended or all). */
export async function listExceptions(db, { status = 'all', userId = null } = {}) {
  const { rows } = await db.query(`SELECT e.id, e.rule_id AS "ruleId", s.name AS "ruleName", e.user_id AS "userId", u.display_name AS "userName", e.reason_code AS "reasonCode",
      e.reason, to_char(e.valid_until, 'YYYY-MM-DD') AS "validUntil", e.status, e.change_id AS "changeId", rq.display_name AS "requestedBy", e.requested_at AS "requestedAt",
      ap.display_name AS "approvedBy", e.approved_at AS "approvedAt", en.display_name AS "endedBy", e.ended_at AS "endedAt"
    FROM sod_exceptions e JOIN sod_rules s ON s.id = e.rule_id JOIN users u ON u.id = e.user_id LEFT JOIN users rq ON rq.id = e.requested_by
    LEFT JOIN users ap ON ap.id = e.approved_by LEFT JOIN users en ON en.id = e.ended_by
    WHERE ($1::text = 'all' OR e.status = $1) AND ($2::text IS NULL OR e.user_id = $2) ORDER BY e.requested_at DESC, e.id DESC`, [status || 'all', userId]);
  return rows.map((e) => ({ ...e, id: Number(e.id), ruleId: Number(e.ruleId), changeId: e.changeId === null ? null : Number(e.changeId) }));
}

/**
 * Users x rules broken, with the state of each conflict (open, accepted, pending, expired) and what this user may do.
 * status: users active (default) or all; userId, ruleId: one user or one rule.
 */
export async function sodConflictList(db, { status = 'active', userId = null, ruleId = null } = {}, user = null) {
  const day = await today();
  const dir = await roleDirectory(db);
  const roleName = new Map(dir.roles.map((r) => [r.code, r.name]));
  const rules = (await listSodRules(db)).filter((s) => s.active && (!ruleId || s.id === Number(ruleId)));
  const users = await holders(db, { status, userId });
  const exceptions = await listExceptions(db, { status: 'active' });
  const pending = await listAccessChanges(db, { kind: EXCEPTION_KIND, status: 'pending' }, user);
  const edit = !!user && hasPermission(user, EDIT);
  const out = [];
  for (const u of users) {
    for (const r of brokenRules(rules, u)) {
      const mine = exceptions.filter((e) => e.ruleId === Number(r.id) && e.userId === u.id);
      const inForce = mine.find((e) => e.status === 'active' && e.validUntil >= day) || null;
      const lapsed = mine.find((e) => e.status === 'active' && e.validUntil < day) || null;
      const waiting = pending.find((c) => c.target === `${r.id}:${u.id}`) || null;
      let state = 'open';
      if (inForce) state = 'accepted';
      else if (waiting) state = 'pending';
      else if (lapsed) state = 'expired';
      const held = r.kind === 'access' ? [] : u.effective.filter((c) => c === r.roleA || c === r.roleB);
      out.push({
        key: `${r.id}:${u.id}`, ruleId: Number(r.id), ruleCode: r.code, ruleName: r.name, kind: r.kind, action: r.action, risk: r.reason, userId: u.id, username: u.username,
        userName: u.name, userStatus: u.status, designation: u.designation, department: departmentOf(dir, u.roles), roles: u.roles,
        heldTogether: r.kind === 'access' ? [r.accessANames.join(', '), r.accessBNames.join(', ')] : held.map((c) => roleName.get(c) || c),
        state, exception: inForce || lapsed, change: waiting,
        canRequest: edit && ['open', 'expired'].includes(state) && u.id !== user?.id && u.status === 'active',
        canEnd: edit && state === 'accepted',
      });
    }
  }
  return { asOf: day, rows: out };
}

/** Number of active users breaking each active rule (accepted conflicts included). */
async function usersPerRule(db, rules) {
  const users = await holders(db, { status: 'active' });
  const counts = new Map();
  for (const u of users) for (const r of brokenRules(rules, u)) counts.set(Number(r.id), (counts.get(Number(r.id)) || 0) + 1);
  return counts;
}

/** The rules as the screen shows them: users breaking each, platform flag, the change waiting for approval. */
export async function sodRuleList(db, user = null) {
  const dir = await roleDirectory(db);
  const byCode = new Map(dir.roles.map((r) => [r.code, r]));
  const rules = await listSodRules(db);
  const counts = await usersPerRule(db, rules);
  const pending = await listAccessChanges(db, { kind: RULE_KIND, status: 'pending' }, user);
  const edit = !!user && hasPermission(user, EDIT);
  const rows = rules.map((r) => {
    const change = pending.find((c) => c.target === r.code) || null;
    return {
      ...r, id: Number(r.id), users: r.active ? counts.get(Number(r.id)) || 0 : 0, platform: r.kind === 'roles' && !!byCode.get(r.roleA)?.platform && !!byCode.get(r.roleB)?.platform,
      roleADepartment: byCode.get(r.roleA)?.department || null, roleBDepartment: byCode.get(r.roleB)?.department || null, change, canEdit: edit && !change,
    };
  });
  const added = pending.filter((c) => c.payload?.op === 'create');
  return { rows, pendingNew: added, approval: await changeApproval(), maxExceptionDays: Number(await getSetting('access.sod_exception_max_days', 365)) || 365,
    asOf: await today(), abilities: { edit, approve: !!user && hasPermission(user, 'approve:access-control') } };
}

// ---------------------------------------------------------------- rule changes

const ruleText = (r) => `${r.name}: ${between(r)}, ${r.action === 'block' ? 'Block' : 'Warn'}${r.active === false ? ', switched off' : ''}`;

async function namedRule(db, rule) {
  const names = new Map((await db.query('SELECT code, name FROM roles WHERE code = ANY($1)', [[rule.roleA, rule.roleB].filter(Boolean)])).rows.map((r) => [r.code, r.name]));
  return { ...rule, roleAName: names.get(rule.roleA) || null, roleBName: names.get(rule.roleB) || null,
    accessANames: (rule.accessA || []).map((c) => businessName(c)), accessBNames: (rule.accessB || []).map((c) => businessName(c)) };
}

/** The next free rule code SOD-<n>. */
async function nextCode(db) {
  const { rows } = await db.query(`SELECT COALESCE(max(substring(code FROM '^SOD-([0-9]+)$')::int), 0) + 1 AS n FROM sod_rules`);
  const pending = (await db.query(`SELECT COALESCE(max(substring(target FROM '^SOD-([0-9]+)$')::int), 0) + 1 AS n FROM accounting_config_changes
    WHERE kind = $1 AND status = 'pending'`, [RULE_KIND])).rows[0].n;
  return `SOD-${Math.max(Number(rows[0].n), Number(pending))}`;
}

/**
 * Request a new rule (id null), a change of a rule or switching it off or on (`active`): body { name, kind, roleA,
 * roleB, accessA, accessB, action, reason (the risk), active, code (optional; given by the server otherwise), reasonCode,
 * note }. With approval: { change }; without: { rule, audit }.
 */
export async function requestSodRule(db, b, id, user) {
  const before = id ? (await listSodRules(db)).find((r) => r.id === Number(id)) : null;
  if (id && !before) throw notFound('Rule not found');
  const kind = before?.kind || b.kind || 'roles';
  const merged = { name: b.name ?? before?.name, action: b.action ?? before?.action, reason: b.reason ?? before?.reason ?? null, active: b.active ?? before?.active ?? true,
    roleA: b.roleA ?? before?.roleA, roleB: b.roleB ?? before?.roleB, accessA: b.accessA ?? before?.accessA, accessB: b.accessB ?? before?.accessB };
  if (!String(merged.name || '').trim()) throw badRequest('Validation failed', [{ path: 'name', message: 'Enter the name of the rule' }]);
  if (!['block', 'warn'].includes(merged.action)) throw badRequest('Validation failed', [{ path: 'action', message: 'Choose Block or Warn' }]);
  const sides = await sodSides(db, merged, kind);
  const code = before?.code || String(b.code || '').trim().toUpperCase() || await nextCode(db);
  if (!before && (await db.query('SELECT 1 FROM sod_rules WHERE code = $1', [code])).rowCount) throw conflict(`A rule ${code} exists already`);
  const reason = await requiredReason(db, 'access_change', b);
  const rule = await namedRule(db, { code, kind, name: String(merged.name).trim(), action: merged.action, reason: merged.reason || null, active: merged.active !== false, ...sides });
  const op = !before ? 'create' : before.active !== rule.active && ruleText({ ...before, active: rule.active }) === ruleText(rule) ? 'status' : 'update';
  if (before && ruleText(before) === ruleText(rule) && (before.reason || null) === rule.reason) throw badRequest('Validation failed', [{ path: 'name', message: 'Nothing is changed' }]);
  const payload = { op, rule, reasonCode: reason.code, reason: reason.text, title: `${rule.name} (${op === 'create' ? 'new rule' : op === 'status' ? (rule.active ? 'switch on' : 'switch off') : 'change'})` };
  const beforeOut = before ? { code: before.code, name: before.name, kind: before.kind, roleA: before.roleA, roleB: before.roleB, accessA: before.accessA, accessB: before.accessB,
    action: before.action, reason: before.reason, active: before.active, text: ruleText(before) } : null;
  if (await changeApproval()) return { change: await requestAccessChange(db, { kind: RULE_KIND, target: code, payload, before: beforeOut, note: reason.text, user }) };
  const saved = await saveRule(db, rule, user);
  return { rule: saved, audit: { entity: 'sod_rule', entityId: String(saved.id), action: op === 'create' ? 'create' : 'update', before: beforeOut, after: saved } };
}

async function saveRule(db, r, user) {
  await db.query(`INSERT INTO sod_rules(code, name, kind, role_a, role_b, access_a, access_b, action, reason, active, updated_by, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, role_a = EXCLUDED.role_a, role_b = EXCLUDED.role_b, access_a = EXCLUDED.access_a, access_b = EXCLUDED.access_b,
      action = EXCLUDED.action, reason = EXCLUDED.reason, active = EXCLUDED.active, updated_by = EXCLUDED.updated_by, updated_at = now()`,
  [r.code, r.name, r.kind, r.roleA, r.roleB, r.accessA, r.accessB, r.action, r.reason, r.active, user?.id ?? null]);
  return (await listSodRules(db)).find((x) => x.code === r.code);
}

/** What a rule would do: the active users who hold both sides today. */
export async function checkSodRule(db, b) {
  const kind = b.kind || 'roles';
  const sides = await sodSides(db, b, kind);
  const rule = { id: 0, kind, active: true, ...sides };
  const users = await holders(db, { status: 'active' });
  const broken = users.filter((u) => brokenRules([rule], u).length);
  return { users: broken.length, names: broken.slice(0, 20).map((u) => u.name) };
}

registerAccessKind(RULE_KIND, {
  label: 'Segregation of duties rule',
  link: (c) => `${SOD_PATH}?tab=pending&change=${c.id}`,
  describe: async (_db, c) => ({ targetLabel: c.payload?.rule?.name || c.target,
    summary: [c.before?.text ? `${c.before.text} → ${ruleText(c.payload.rule)}` : ruleText(c.payload.rule), c.payload?.reason ? `Reason: ${c.payload.reason}` : null].filter(Boolean) }),
  apply: async (db, c, user) => {
    const saved = await saveRule(db, c.payload.rule, user);
    return { audit: { entity: 'sod_rule', entityId: String(saved.id), action: c.payload.op === 'create' ? 'create' : 'update', before: c.before, after: { ...saved, change: c.id } } };
  },
  requested: (c, user) => `${user.username} requested a change of the segregation-of-duties rules: ${c.summary.join('; ')}`,
  applied: (c) => `the rule ${c.payload?.rule?.name} is ${c.payload?.op === 'create' ? 'added' : 'changed'}`,
});

// ---------------------------------------------------------------- exceptions

/**
 * Request an exception for a conflict: { ruleId, userId, reasonCode, note, validUntil }. The user must break the
 * rule today and have no exception in force or waiting. With approval: { change }; without: { exception }.
 */
export async function requestSodException(db, b, user) {
  const day = await today();
  const max = Number(await getSetting('access.sod_exception_max_days', 365)) || 365;
  const errors = [];
  if (!DATE.test(b.validUntil || '')) errors.push({ path: 'validUntil', message: 'Enter the last day of the exception' });
  else if (b.validUntil <= day) errors.push({ path: 'validUntil', message: 'The exception must end after today' });
  else if (b.validUntil > addDays(day, max)) errors.push({ path: 'validUntil', message: `An exception lasts at most ${max} days` });
  if (errors.length) throw badRequest('Validation failed', errors);
  if (b.userId === user.id) throw forbidden('You cannot request an exception for yourself');
  const found = (await sodConflictList(db, { status: 'active', userId: b.userId, ruleId: b.ruleId }, user)).rows[0];
  if (!found) throw conflict('This person does not break the rule today; no exception is needed');
  if (found.state === 'accepted') throw conflict(`An exception is in force until ${found.exception.validUntil}`);
  if (found.state === 'pending') throw conflict(`An exception is waiting for approval (${found.change.ref})`);
  const reason = await requiredReason(db, 'sod_exception', b);
  const payload = { ruleId: found.ruleId, ruleName: found.ruleName, action: found.action, userId: found.userId, userName: found.userName, heldTogether: found.heldTogether,
    validUntil: b.validUntil, reasonCode: reason.code, reason: reason.text, title: `${found.userName} · ${found.ruleName} until ${b.validUntil}` };
  if (await changeApproval()) return { change: await requestAccessChange(db, { kind: EXCEPTION_KIND, target: found.key, payload, note: reason.text, user }) };
  const id = await insertException(db, payload, { requestedBy: user.id });
  return { exception: (await listExceptions(db, { userId: found.userId })).find((e) => e.id === id) };
}

async function insertException(db, p, { requestedBy, requestedAt = null, changeId = null, approvedBy = null }) {
  // an exception that has expired is ended when a new one is recorded (one active exception per rule and person)
  await db.query(`UPDATE sod_exceptions SET status = 'ended', ended_at = now() WHERE rule_id = $1 AND user_id = $2 AND status = 'active'`, [p.ruleId, p.userId]);
  const { rows } = await db.query(`INSERT INTO sod_exceptions(rule_id, user_id, reason_code, reason, valid_until, change_id, requested_by, requested_at, approved_by, approved_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()), $9, CASE WHEN $9::text IS NULL THEN NULL ELSE now() END) RETURNING id`,
  [p.ruleId, p.userId, p.reasonCode, p.reason, p.validUntil, changeId, requestedBy, requestedAt, approvedBy]);
  return Number(rows[0].id);
}

/** End an exception in force at once (the conflict is open again). */
export async function endSodException(db, id, user) {
  const { rows } = await db.query(`UPDATE sod_exceptions SET status = 'ended', ended_by = $2, ended_at = now() WHERE id = $1 AND status = 'active' RETURNING id, user_id`, [Number(id) || 0, user.id]);
  if (!rows[0]) throw notFound('No exception in force with this id');
  return (await listExceptions(db, { userId: rows[0].user_id })).find((e) => e.id === Number(id));
}

registerAccessKind(EXCEPTION_KIND, {
  label: 'Segregation of duties exception',
  link: (c) => `${SOD_PATH}?tab=pending&change=${c.id}`,
  describe: async (_db, c) => ({ targetLabel: `${c.payload?.userName} · ${c.payload?.ruleName}`,
    summary: [`${c.payload?.userName} may hold ${(c.payload?.heldTogether || []).join(' with ')} (${c.payload?.ruleName}) until ${c.payload?.validUntil}`,
      c.payload?.reason ? `Reason: ${c.payload.reason}` : null].filter(Boolean) }),
  assertDecider: async (_db, c, user) => {
    if (c.payload?.userId === user.id) throw forbidden('You cannot approve an exception for yourself');
  },
  apply: async (db, c, user) => {
    const p = c.payload;
    if (p.validUntil <= (await today())) throw conflict('The end date of this exception has passed; reject it');
    const id = await insertException(db, p, { requestedBy: c.requested_by, requestedAt: c.requested_at, changeId: c.id, approvedBy: user.id });
    return { audit: { entity: 'sod_exception', entityId: String(id), action: 'approve', after: { ...p, id, change: c.id } } };
  },
  requested: (c, user) => `${user.username} requested a segregation-of-duties exception: ${c.summary.join('; ')}`,
  applied: (c) => `the conflict of ${c.payload?.userName} is accepted until ${c.payload?.validUntil}`,
});

// ---------------------------------------------------------------- export for audit

const col = (header, width = 20, type = 'text') => ({ header, width, type });

/** Workbook of the screen: Rules, Conflicts by user, Exceptions, Waiting for approval. */
export async function sodSheets(db, user, fmt, { technical = false, base = false } = {}) {
  const rules = (await sodRuleList(db, user)).rows.filter((r) => base || !r.platform);
  const conflicts = (await sodConflictList(db, { status: 'all' }, user)).rows;
  const exceptions = await listExceptions(db);
  const pending = await listAccessChanges(db, { kind: RULE_KIND }, user).then(async (a) => a.concat(await listAccessChanges(db, { kind: EXCEPTION_KIND }, user)));
  const code = (v) => (technical ? [v || ''] : []);
  const codeCol = (h) => (technical ? [col(h, 22)] : []);
  const dt = (v) => (v ? formatDateTime(v, fmt) : '');
  const d = (v) => (v ? formatDate(v, fmt) : '');
  return [
    { name: 'Rules', columns: [col('Rule', 34), col('Between', 60), col('Departments', 34), col('When assigned', 14), col('Risk', 50), col('Status', 10),
      col('Users breaking it', 14, 'integer'), col('Waiting for approval', 18), col('Last changed by', 22), col('Last changed at', 18), ...codeCol('Rule code')],
    rows: rules.map((r) => [r.name, between(r), [r.roleADepartment, r.roleBDepartment].filter(Boolean).join(' / '), r.action === 'block' ? 'Block' : 'Warn', r.reason || '',
      r.active ? 'On' : 'Off', r.users, r.change ? r.change.ref : '', r.updatedBy || '', dt(r.updatedAt), ...code(r.code)]) },
    { name: 'Conflicts by user', columns: [col('User', 28), col('Username', 20), col('Account status', 12), col('Department', 22), col('Held together', 50), col('Rule', 34),
      col('When assigned', 14), col('State', 22), col('Exception reason', 40), col('Valid until', 14), col('Approved by', 22), col('Approved at', 18), ...codeCol('Rule code')],
    rows: conflicts.map((c) => [c.userName, c.username, c.userStatus, c.department || '', c.heldTogether.join(' with '), c.ruleName, c.action === 'block' ? 'Block' : 'Warn',
      STATE_WORDS[c.state], c.exception?.reason || '', d(c.exception?.validUntil), c.exception?.approvedBy || '', dt(c.exception?.approvedAt), ...code(c.ruleCode)]) },
    { name: 'Exceptions', columns: [col('User', 28), col('Rule', 34), col('Reason', 44), col('Valid until', 14), col('Status', 12), col('Requested by', 22), col('Requested at', 18),
      col('Approved by', 22), col('Approved at', 18), col('Ended by', 22), col('Ended at', 18)],
    rows: exceptions.map((e) => [e.userName, e.ruleName, e.reason, d(e.validUntil), e.status === 'active' ? 'Active' : 'Ended', e.requestedBy || '', dt(e.requestedAt),
      e.approvedBy || '', dt(e.approvedAt), e.endedBy || '', dt(e.endedAt)]) },
    { name: 'Waiting for approval', columns: [col('Request', 12), col('What', 24), col('Change', 70), col('Requested by', 22), col('Requested at', 18)],
      rows: pending.map((c) => [c.ref, c.kindLabel, c.summary.join('; '), c.requestedBy || '', dt(c.requestedAt)]) },
  ];
}
