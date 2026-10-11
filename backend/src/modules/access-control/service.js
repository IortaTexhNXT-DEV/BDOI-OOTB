/**
 * Access control of the broker's staff: the authority limits (who may approve how much, per transaction type) and the
 * check of the approval steps, segregation-of-duties rules and the check when roles are given, the role matrix,
 * ending sessions and dormant accounts. Delegations, the segregation-of-duties screen, access reviews and the user
 * access matrix are in delegations.js, sod.js, reviews.js and userAccess.js.
 *
 * Authority check (assertAuthority): the approver's limit for a transaction type is
 *   - their own user limit when one is active, otherwise the highest limit of their roles (inherited roles included),
 *   - raised by any active delegation to them that covers the type (the delegator's limit, worked out the same way),
 *   - "no limit" when a matching row has max_amount NULL.
 * When no row applies at all, access.authority_without_limit decides (allow, the default, or refuse); under allow a
 * person without a limit of their own is not restricted, and a delegation does not restrict them.
 */
import { adminEquivalentRoles, isAdmin } from '../../lib/auth.js';
import { businessName } from './catalogue.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { formatDate } from '../../lib/pdf/format.js';
import { BUILT_IN_ADMIN, isAdminAccount } from './roles.js';
import { rolesHeldBy } from './changes.js';
import { PLATFORM_PERMISSIONS, PLATFORM_ROLE } from '../../lib/platform.js';

const money = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);

// ---------------------------------------------------------------- transaction types

export async function transactionTypes(db, { activeOnly = false } = {}) {
  const { rows } = await db.query(`SELECT code, name, measure, description, sort_order AS "sortOrder", active FROM authority_transaction_types
    ${activeOnly ? 'WHERE active' : ''} ORDER BY sort_order, code`);
  return rows;
}

export async function updateTransactionType(db, code, { name, description, active }) {
  const { rows } = await db.query(`UPDATE authority_transaction_types SET name = COALESCE($2, name), description = COALESCE($3, description), active = COALESCE($4, active)
    WHERE code = $1 RETURNING code, name, measure, description, active`, [code, name ?? null, description ?? null, active ?? null]);
  if (!rows[0]) throw notFound('Transaction type not found');
  return rows[0];
}

// ---------------------------------------------------------------- authority limits

const LIMIT_SELECT = `SELECT l.id, l.transaction_type AS "transactionType", t.name AS "transactionName", t.measure, l.role_code AS "roleCode", r.name AS "roleName",
    l.user_id AS "userId", u.username, u.display_name AS "userName", l.max_amount AS "maxAmount", l.currency, l.remarks, l.status, l.replaces_id AS "replacesId",
    to_char(l.effective_from, 'YYYY-MM-DD') AS "effectiveFrom", to_char(l.effective_to, 'YYYY-MM-DD') AS "effectiveTo", l.reference_no AS "referenceNo",
    to_char(l.reference_date, 'YYYY-MM-DD') AS "referenceDate", l.change_id AS "changeId", rq.display_name AS "requestedBy", l.requested_by AS "requestedById",
    l.requested_at AS "requestedAt", dc.display_name AS "decidedBy", l.decided_at AS "decidedAt", l.decision_note AS "decisionNote"
  FROM authority_limits l JOIN authority_transaction_types t ON t.code = l.transaction_type
  LEFT JOIN roles r ON r.code = l.role_code LEFT JOIN users u ON u.id = l.user_id
  LEFT JOIN users rq ON rq.id = l.requested_by LEFT JOIN users dc ON dc.id = l.decided_by`;

const shapeLimit = (r) => ({ ...r, changeId: r.changeId === null ? null : Number(r.changeId), maxAmount: money(r.maxAmount), unlimited: r.maxAmount === null });

/** Limits with their history: status (pending, active, rejected, retired, withdrawn; null or 'all' = every status), a transaction type. */
export async function listLimits(db, { status = null, transactionType = null } = {}) {
  const { rows } = await db.query(`${LIMIT_SELECT}
    WHERE ($1::text IS NULL OR $1 = 'all' OR l.status = $1) AND ($2::text IS NULL OR l.transaction_type = $2)
    ORDER BY t.sort_order, l.role_code NULLS LAST, u.username, l.requested_at DESC, l.id DESC`, [status, transactionType]);
  return rows.map(shapeLimit);
}

export const getLimit = async (db, id) => {
  const { rows } = await db.query(`${LIMIT_SELECT} WHERE l.id = $1`, [Number(id) || 0]);
  return rows[0] ? shapeLimit(rows[0]) : null;
};

/**
 * Put an approved limit in effect, or end the limit in effect (`removes`), from its effective date (today at the
 * earliest). Rows of the same role or person and type that would start on or after that date never take effect; the
 * row in effect then ends the day before, and is retired at once when that day has passed; rows that have already
 * ended are retired. `rowId`: the proposal in authority_limits to activate; otherwise a row is written with the
 * change it comes from. Returns the id of the limit in effect from that date (null for a removal).
 */
export async function applyLimit(db, l, user, { rowId = null } = {}) {
  const day = await today();
  const from = l.effectiveFrom && l.effectiveFrom > day ? l.effectiveFrom : day;
  const scope = l.roleCode ? 'role_code = $2' : 'user_id = $2';
  const params = [l.transactionType, l.roleCode || l.userId, from, rowId, day];
  await db.query(`UPDATE authority_limits SET status = 'retired', decision_note = concat_ws(' · ', decision_note, 'Superseded before taking effect')
    WHERE transaction_type = $1 AND ${scope} AND status = 'active' AND effective_from >= $3::date AND effective_from > $5::date AND id IS DISTINCT FROM $4`, params);
  const current = (await db.query(`UPDATE authority_limits SET effective_to = $3::date - 1,
      status = CASE WHEN $3::date <= $5::date THEN 'retired' ELSE status END
    WHERE transaction_type = $1 AND ${scope} AND status = 'active' AND effective_from <= $3::date AND (effective_to IS NULL OR effective_to >= $3::date)
      AND id IS DISTINCT FROM $4 RETURNING id`, params)).rows[0];
  await db.query(`UPDATE authority_limits SET status = 'retired' WHERE transaction_type = $1 AND ${scope} AND status = 'active' AND effective_to < $3::date
    AND id IS DISTINCT FROM $4`, [l.transactionType, l.roleCode || l.userId, day, rowId]);
  if (l.removes) return null;
  if (rowId) {
    await db.query(`UPDATE authority_limits SET status = 'active', effective_from = $2, replaces_id = COALESCE($3, replaces_id), decided_by = $4, decided_at = now()
      WHERE id = $1`, [rowId, from, current?.id ?? null, user.id]);
    return Number(rowId);
  }
  const { rows } = await db.query(`INSERT INTO authority_limits(transaction_type, role_code, user_id, max_amount, remarks, status, replaces_id, effective_from,
      reference_no, reference_date, change_id, requested_by, requested_at, decided_by, decided_at)
    VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10, $11, COALESCE($12, now()), $13, now()) RETURNING id`,
  [l.transactionType, l.roleCode || null, l.userId || null, l.unlimited ? null : money(l.maxAmount), l.remarks || null, current?.id ?? null, from,
    l.referenceNo || null, l.referenceDate || null, l.changeId ?? null, l.requestedBy ?? null, l.requestedAt ?? null, user.id]);
  return Number(rows[0].id);
}

/**
 * Propose a limit for a role or a user (API and go-live workbook). It waits for another administrator's approval
 * before it applies, from its effective date (today or later). A role or person and type with a change of the
 * Authority Matrix waiting for approval is refused.
 */
export async function proposeLimit(db, b, user) {
  if (!b.roleCode === !b.userId) throw badRequest('Give either a role or a user');
  const type = (await db.query('SELECT code, measure FROM authority_transaction_types WHERE code = $1', [b.transactionType])).rows[0];
  if (!type) throw badRequest('Unknown transaction type');
  const max = b.unlimited ? null : money(b.maxAmount);
  if (!b.unlimited && (max === null || max < 0)) throw badRequest('Enter the limit, or mark it as no limit');
  if (type.measure === 'percent' && max !== null && max > 100) throw badRequest('A percent limit cannot be over 100');
  if (b.effectiveFrom && b.effectiveFrom < (await today())) throw badRequest('The effective date cannot be in the past');
  if (b.roleCode && !(await db.query('SELECT 1 FROM roles WHERE code = $1', [b.roleCode])).rowCount) throw badRequest('Unknown role');
  if (b.userId && !(await db.query('SELECT 1 FROM users WHERE id = $1', [b.userId])).rowCount) throw badRequest('Unknown user');
  const scope = b.roleCode ? ['role_code', b.roleCode] : ['user_id', b.userId];
  const open = (await db.query(`SELECT id FROM accounting_config_changes c, jsonb_array_elements(c.payload->'lines') x
    WHERE c.kind = 'authority-limits' AND c.status = 'pending' AND x->>'transactionType' = $1 AND x->>$2 = $3 LIMIT 1`,
  [type.code, b.roleCode ? 'roleCode' : 'userId', scope[1]])).rows[0];
  if (open) throw conflict(`A change of this limit is waiting for approval (request CFG-${open.id}); approve, reject or withdraw it first`);
  const current = (await db.query(`SELECT id FROM authority_limits WHERE transaction_type = $1 AND ${scope[0]} = $2 AND status = 'active'
    AND effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1`, [type.code, scope[1]])).rows[0];
  // one open proposal per role / user and type: a new proposal replaces the earlier one
  await db.query(`UPDATE authority_limits SET status = 'rejected', decided_by = $3, decided_at = now(), decision_note = 'Replaced by a newer proposal'
    WHERE transaction_type = $1 AND ${scope[0]} = $2 AND status = 'pending'`, [type.code, scope[1], user.id]);
  const { rows } = await db.query(`INSERT INTO authority_limits(transaction_type, role_code, user_id, max_amount, remarks, replaces_id, effective_from, reference_no,
      reference_date, requested_by)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, $9, $10) RETURNING id`,
  [type.code, b.roleCode || null, b.userId || null, max, b.remarks || null, current?.id ?? null, b.effectiveFrom || null, b.referenceNo || null,
    b.referenceDate || null, user.id]);
  return getLimit(db, rows[0].id);
}

/** Approve (in effect from its effective date) or reject (reason required) a proposed limit; never by the person who proposed it. */
export async function decideLimit(db, id, { decision, note }, user) {
  const l = (await db.query('SELECT * FROM authority_limits WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!l) throw notFound('Authority limit not found');
  if (l.status !== 'pending') throw conflict(`This limit is ${l.status}; only proposals waiting for approval can be decided`);
  if (l.requested_by === user.id) throw forbidden('Maker-checker: a limit is approved by another administrator, not the one who proposed it');
  if (decision === 'approve' && l.user_id === user.id) throw forbidden('You cannot approve a change of your own approval limit');
  if (decision === 'approve' && l.role_code && (await rolesHeldBy(db, user.id)).has(l.role_code)) {
    throw forbidden('You cannot approve a change of the approval limit of a role you hold');
  }
  if (decision === 'reject' && !String(note || '').trim()) throw badRequest('Validation failed', [{ path: 'note', message: 'Give the reason for rejecting the limit' }]);
  if (decision === 'approve') {
    const live = (await db.query(`SELECT t.active AND (r.code IS NULL OR r.status = 'active') AS ok FROM authority_transaction_types t
      LEFT JOIN roles r ON r.code = $2 WHERE t.code = $1`, [l.transaction_type, l.role_code])).rows[0];
    if (!live?.ok) throw conflict('The transaction type or the role is no longer active; reject the proposal');
    await applyLimit(db, { transactionType: l.transaction_type, roleCode: l.role_code, userId: l.user_id, effectiveFrom: isoDate(l.effective_from) }, user, { rowId: l.id });
    await db.query('UPDATE authority_limits SET decision_note = $2 WHERE id = $1', [id, String(note || '').trim() || null]);
  } else {
    await db.query("UPDATE authority_limits SET status = 'rejected', decided_by = $2, decided_at = now(), decision_note = $3 WHERE id = $1", [id, user.id, String(note).trim()]);
  }
  return getLimit(db, id);
}

/** Withdraw a proposal waiting for approval: only the person who proposed it (an approver rejects it with a reason). */
export async function withdrawLimit(db, id, user) {
  const l = (await db.query('SELECT * FROM authority_limits WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!l) throw notFound('Authority limit not found');
  if (l.status !== 'pending') throw conflict(`This limit is ${l.status}; only a proposal waiting for approval can be withdrawn`);
  if (l.requested_by !== user.id) throw forbidden('Only the person who proposed the limit can withdraw it; an approver rejects it with a reason');
  await db.query("UPDATE authority_limits SET status = 'withdrawn', decided_by = $2, decided_at = now(), decision_note = 'Withdrawn' WHERE id = $1", [id, user.id]);
  return getLimit(db, id);
}

/** The limit of one user for a type, without delegations: { found, limit (null = no limit), source }. */
export async function ownLimit(db, userId, type, onDate) {
  const inEffect = `status = 'active' AND effective_from <= $3::date AND (effective_to IS NULL OR effective_to >= $3::date)`;
  const own = (await db.query(`SELECT max_amount FROM authority_limits WHERE transaction_type = $1 AND user_id = $2 AND ${inEffect}
    ORDER BY requested_at DESC LIMIT 1`, [type, userId, onDate])).rows[0];
  if (own) return { found: true, limit: money(own.max_amount), source: 'personal limit' };
  const { rows } = await db.query(`SELECT l.role_code, COALESCE(r.name, l.role_code) AS role_name, l.max_amount FROM authority_limits l
    LEFT JOIN roles r ON r.code = l.role_code
    WHERE l.transaction_type = $1 AND l.role_code IN (SELECT code FROM user_effective_roles($2)) AND l.status = 'active'
      AND l.effective_from <= $3::date AND (l.effective_to IS NULL OR l.effective_to >= $3::date)`, [type, userId, onDate]);
  if (!rows.length) return { found: false, limit: null, source: null };
  const unlimited = rows.find((r) => r.max_amount === null);
  if (unlimited) return { found: true, limit: null, source: `role ${unlimited.role_name}` };
  const best = rows.reduce((a, r) => (Number(r.max_amount) > Number(a.max_amount) ? r : a));
  return { found: true, limit: money(best.max_amount), source: `role ${best.role_name}` };
}

/**
 * Effective authority of a user for a transaction type on a date, delegations included. A delegation never lowers it:
 * a person with no limit of their own while access.authority_without_limit is allow is not restricted, so a delegated
 * limit is not applied to them. `requireLimit`: the step refuses an approver without a limit whatever that setting
 * says (remittance approvals with remittance.require_authority_limit), so a delegated limit applies.
 */
export async function effectiveAuthority(db, userId, type, onDate = null, { requireLimit = false } = {}) {
  onDate = onDate || (await today());
  const own = await ownLimit(db, userId, type, onDate);
  if (!own.found && !requireLimit && String(await getSetting('access.authority_without_limit', 'allow')) !== 'refuse') {
    return { found: false, limit: null, unlimited: false, source: null };
  }
  const candidates = [own];
  const { rows: dels } = await db.query(`SELECT d.delegator_id, u.display_name FROM user_delegations d JOIN users u ON u.id = d.delegator_id
    WHERE d.delegate_id = $1 AND d.status = 'active' AND $2::date BETWEEN d.date_from AND d.date_to
      AND (cardinality(d.transaction_types) = 0 OR $3 = ANY(d.transaction_types)) AND u.status = 'active'`, [userId, onDate, type]);
  for (const d of dels) {
    const l = await ownLimit(db, d.delegator_id, type, onDate);
    if (l.found) candidates.push({ ...l, source: `delegated by ${d.display_name} (${l.source})` });
  }
  const found = candidates.filter((c) => c.found);
  if (!found.length) return { found: false, limit: null, unlimited: false, source: null };
  const unlimited = found.find((c) => c.limit === null);
  if (unlimited) return { found: true, limit: null, unlimited: true, source: unlimited.source };
  const best = found.reduce((a, c) => (c.limit > a.limit ? c : a));
  return { found: true, limit: best.limit, unlimited: false, source: best.source };
}

/**
 * Refuse an approval above the approver's authority. Called by the approval steps (journal vouchers, cheque release,
 * claim settlement...). `amount` is in the type's measure (PHP, or percent for discounts).
 */
export async function assertAuthority(db, user, type, amount, { onDate } = {}) {
  if (!user?.id || !(await getSetting('access.authority_enforced', true))) return null;
  const hasTable = (await db.query("SELECT to_regclass('authority_limits') IS NOT NULL AS ok")).rows[0].ok;
  if (!hasTable) return null;
  const a = await effectiveAuthority(db, user.id, type, onDate || (await today()));
  const name = (await db.query('SELECT name, measure FROM authority_transaction_types WHERE code = $1', [type])).rows[0];
  const label = name?.name || type;
  if (!a.found) {
    if (String(await getSetting('access.authority_without_limit', 'allow')) === 'refuse') {
      throw forbidden(`You have no approval authority for ${label}. Ask an administrator to set a limit in the Authority Matrix.`);
    }
    return a;
  }
  const value = money(amount) ?? 0;
  if (!a.unlimited && value > a.limit) {
    const shown = (v) => (name?.measure === 'percent' ? `${v}%` : `PHP ${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
    throw forbidden(`${label} of ${shown(value)} is above your approval authority of ${shown(a.limit)} (${a.source}). It needs an approver with a higher limit.`);
  }
  return a;
}

// ---------------------------------------------------------------- segregation of duties
//
// Two kinds of rule. Roles held together (kind roles): two roles one person may not hold. Access combined (kind access):
// two sets of permissions a role or a person should not combine (issuing receipts and issuing policies); a set of
// permissions breaks it when it holds a code of each set. The administrator role and the roles that include it hold
// every permission and are left out of the access rules (the role rules control who holds them).

const sodOut = (r) => ({ ...r, accessANames: r.accessA.map((c) => businessName(c)), accessBNames: r.accessB.map((c) => businessName(c)) });

export async function listSodRules(db) {
  const { rows } = await db.query(`SELECT s.id, s.code, s.name, s.kind, s.role_a AS "roleA", a.name AS "roleAName", s.role_b AS "roleB", b.name AS "roleBName",
      s.access_a AS "accessA", s.access_b AS "accessB", s.action, s.reason, s.active, u.display_name AS "updatedBy", s.updated_at AS "updatedAt"
    FROM sod_rules s LEFT JOIN roles a ON a.code = s.role_a LEFT JOIN roles b ON b.code = s.role_b LEFT JOIN users u ON u.id = s.updated_by ORDER BY s.code`);
  return rows.map(sodOut);
}

/** The two sides of a rule: two different known roles, or two sets of known permissions that do not overlap. */
export async function sodSides(db, b, kind) {
  if (kind === 'access') {
    const a = [...new Set(b.accessA || [])];
    const c = [...new Set(b.accessB || [])];
    if (!a.length || !c.length) throw badRequest('Choose the access on both sides of the rule');
    if (a.some((x) => c.includes(x))) throw badRequest('The same access cannot be on both sides of the rule');
    const known = (await db.query('SELECT code FROM permissions WHERE code = ANY($1)', [[...a, ...c]])).rows.map((r) => r.code);
    const unknown = [...a, ...c].filter((x) => !known.includes(x));
    if (unknown.length) throw badRequest(`Unknown permission: ${unknown.join(', ')}`);
    return { roleA: null, roleB: null, accessA: a, accessB: c };
  }
  if (!b.roleA || !b.roleB) throw badRequest('Pick the two roles');
  if (b.roleA === b.roleB) throw badRequest('Pick two different roles');
  const known = (await db.query('SELECT code FROM roles WHERE code = ANY($1)', [[b.roleA, b.roleB]])).rows;
  if (known.length !== 2) throw badRequest('Unknown role');
  return { roleA: b.roleA, roleB: b.roleB, accessA: [], accessB: [] };
}

/** Does a set of permission codes break an access rule (a code of each side)? */
export const breaksAccessRule = (rule, codes) => rule.accessA.some((c) => codes.has(c)) && rule.accessB.some((c) => codes.has(c));

/**
 * Rules broken by a set of role codes: the active roles and the active roles they include (as user_effective_roles
 * gives them to a user); access rules on the permissions of those roles, every permission with a full-access role.
 */
export async function sodConflicts(db, roleCodes) {
  if (!(await db.query("SELECT to_regclass('sod_rules') IS NOT NULL AS ok")).rows[0].ok) return [];
  const { rows: expanded } = await db.query(`WITH RECURSIVE r(code) AS (SELECT code FROM roles WHERE code = ANY($1::text[]) AND status = 'active'
      UNION SELECT i.code FROM roles x JOIN r ON r.code = x.code JOIN roles i ON i.code = ANY(x.inherits) AND i.status = 'active')
    SELECT DISTINCT code FROM r`, [roleCodes || []]);
  const have = new Set(expanded.map((r) => r.code));
  const rules = (await listSodRules(db)).filter((s) => s.active);
  const byRoles = rules.filter((s) => s.kind !== 'access' && have.has(s.roleA) && have.has(s.roleB));
  const access = rules.filter((s) => s.kind === 'access');
  if (!access.length) return byRoles;
  const full = await adminEquivalentRoles(db);
  const { rows } = [...have].some((c) => full.includes(c)) ? await db.query('SELECT code FROM permissions')
    : await db.query(`SELECT DISTINCT p.code FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
      WHERE r.code = ANY($1) AND r.status = 'active'`, [[...have]]);
  const codes = new Set(rows.map((r) => r.code));
  return [...byRoles, ...access.filter((s) => breaksAccessRule(s, codes))];
}

const sodBetween = (s) => (s.kind === 'access' ? `${s.accessANames.join(', ')} with ${s.accessBNames.join(', ')} (${s.name})` : `${s.roleAName} and ${s.roleBName} (${s.name})`);

/** The exceptions in force of a user (rule id -> valid until), for the warnings of assertSod. */
async function exceptionsInForce(db, userId) {
  if (!userId || !(await db.query("SELECT to_regclass('sod_exceptions') IS NOT NULL AS ok")).rows[0].ok) return new Map();
  const { rows } = await db.query(`SELECT rule_id, to_char(valid_until, 'YYYY-MM-DD') AS until FROM sod_exceptions
    WHERE user_id = $1 AND status = 'active' AND valid_until >= $2::date`, [userId, await today()]);
  return new Map(rows.map((r) => [Number(r.rule_id), r.until]));
}

/**
 * Throws when a blocking rule is broken (an exception does not lift a Block); returns the warnings otherwise. With
 * `userId`, a warning says when the conflict is accepted for that person until a date.
 */
export async function assertSod(db, roleCodes, { userId = null } = {}) {
  if (!(await getSetting('access.sod_enforced', true))) return [];
  const found = await sodConflicts(db, roleCodes);
  const blocking = found.filter((s) => s.action === 'block');
  if (blocking.length) {
    throw conflict(`Segregation of duties: ${blocking.map(sodBetween).join('; ')} may not be held by the same person`);
  }
  const accepted = await exceptionsInForce(db, userId);
  return found.map((s) => {
    const text = s.kind === 'access' ? `${s.name}: ${s.reason || sodBetween(s)}` : `${s.roleAName} with ${s.roleBName}: ${s.reason || s.name}`;
    return accepted.has(Number(s.id)) ? `${text} (exception in force until ${formatDate(accepted.get(Number(s.id)))})` : text;
  });
}

// ---------------------------------------------------------------- matrices

/** Permissions down, roles across (what each role may do), grouped by module. */
export async function roleMatrix(db) {
  const roles = (await db.query("SELECT id, code, name, inherits FROM roles WHERE status = 'active' AND code <> $1 ORDER BY id", [PLATFORM_ROLE])).rows;
  const perms = (await db.query('SELECT id, code, module, description FROM permissions WHERE NOT (code = ANY($1)) ORDER BY module, code', [PLATFORM_PERMISSIONS])).rows;
  const grants = (await db.query('SELECT role_id, permission_id FROM role_permissions')).rows;
  const has = new Set(grants.map((g) => `${g.role_id}:${g.permission_id}`));
  return {
    roles: roles.map((r) => ({ code: r.code, name: r.name, inherits: r.inherits })),
    rows: perms.map((p) => ({ code: p.code, module: p.module, description: p.description, grants: Object.fromEntries(roles.map((r) => [r.code, has.has(`${r.id}:${p.id}`)])) })),
  };
}

// ---------------------------------------------------------------- sessions and dormant accounts

/** End every session of a user (their tokens stop working at the next request); an administrator account only by a System Administrator. */
export async function signOutEverywhere(db, userId, user) {
  if (userId === user.id) throw badRequest('Use Sign out to end your own session');
  if (!isAdmin(user) && (await isAdminAccount(db, userId))) throw forbidden('Only a System Administrator can end the sessions of an administrator account');
  const { rows } = await db.query('UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = $1 RETURNING username', [userId]);
  if (!rows[0]) throw notFound('User not found');
  return { userId, username: rows[0].username, signedOut: true };
}

/** Daily job: deactivate active accounts not signed in for access.dormant_days (the built-in administrator excepted). */
export async function deactivateDormant(db, { adminUsername = BUILT_IN_ADMIN } = {}) {
  const days = Number(await getSetting('access.dormant_days', 90)) || 0;
  if (days <= 0) return { deactivated: 0, reason: 'access.dormant_days is 0' };
  const { rows } = await db.query(`UPDATE users SET status = 'inactive', token_version = token_version + 1, updated_by = 'system', updated_at = now()
    WHERE status = 'active' AND username <> $2 AND COALESCE(last_login_at, created_at) < now() - make_interval(days => $1::int)
    RETURNING username`, [days, adminUsername]);
  return { deactivated: rows.length, users: rows.map((r) => r.username), days };
}
