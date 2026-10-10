/**
 * Access control of the broker's staff: the authority matrix (who may approve how much, per transaction type), delegation
 * of authority, segregation-of-duties rules, the user and role matrices, periodic access reviews and dormant accounts.
 *
 * Authority check (assertAuthority): the approver's limit for a transaction type is
 *   - their own user limit when one is active, otherwise the highest limit of their roles (inherited roles included),
 *   - raised by any active delegation to them that covers the type (the delegator's limit, worked out the same way),
 *   - "no limit" when a matching row has max_amount NULL.
 * When no row applies at all, access.authority_without_limit decides (allow, the default, or refuse).
 */
import { adminEquivalentRoles, hasPermission } from '../../lib/auth.js';
import { businessName } from './catalogue.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';

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

/** Withdraw a proposal waiting for approval: the person who proposed it, or a user who may approve it. */
export async function withdrawLimit(db, id, user) {
  const l = (await db.query('SELECT * FROM authority_limits WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!l) throw notFound('Authority limit not found');
  if (l.status !== 'pending') throw conflict(`This limit is ${l.status}; only a proposal waiting for approval can be withdrawn`);
  if (l.requested_by !== user.id && !hasPermission(user, 'approve:access-control')) throw forbidden('Only the person who proposed the limit or an approver can withdraw it');
  await db.query("UPDATE authority_limits SET status = 'withdrawn', decided_by = $2, decided_at = now(), decision_note = 'Withdrawn' WHERE id = $1", [id, user.id]);
  return getLimit(db, id);
}

/** The limit of one user for a type, without delegations: { found, limit (null = no limit), source }. */
async function ownLimit(db, userId, type, onDate) {
  const inEffect = `status = 'active' AND effective_from <= $3::date AND (effective_to IS NULL OR effective_to >= $3::date)`;
  const own = (await db.query(`SELECT max_amount FROM authority_limits WHERE transaction_type = $1 AND user_id = $2 AND ${inEffect}
    ORDER BY requested_at DESC LIMIT 1`, [type, userId, onDate])).rows[0];
  if (own) return { found: true, limit: money(own.max_amount), source: 'user limit' };
  const { rows } = await db.query(`SELECT role_code, max_amount FROM authority_limits
    WHERE transaction_type = $1 AND role_code IN (SELECT code FROM user_effective_roles($2)) AND ${inEffect}`, [type, userId, onDate]);
  if (!rows.length) return { found: false, limit: null, source: null };
  const unlimited = rows.find((r) => r.max_amount === null);
  if (unlimited) return { found: true, limit: null, source: `role ${unlimited.role_code}` };
  const best = rows.reduce((a, r) => (Number(r.max_amount) > Number(a.max_amount) ? r : a));
  return { found: true, limit: money(best.max_amount), source: `role ${best.role_code}` };
}

/** Effective authority of a user for a transaction type on a date, delegations included. */
export async function effectiveAuthority(db, userId, type, onDate = null) {
  onDate = onDate || (await today());
  const candidates = [await ownLimit(db, userId, type, onDate)];
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

// ---------------------------------------------------------------- delegations

export async function listDelegations(db, { activeOnly = false } = {}) {
  const { rows } = await db.query(`SELECT d.id, d.delegator_id AS "delegatorId", a.display_name AS "delegatorName", d.delegate_id AS "delegateId", b.display_name AS "delegateName",
      d.transaction_types AS "transactionTypes", d.date_from AS "dateFrom", d.date_to AS "dateTo", d.reason, d.status,
      (d.status = 'active' AND CURRENT_DATE BETWEEN d.date_from AND d.date_to) AS "inEffect", c.display_name AS "createdBy", d.created_at AS "createdAt"
    FROM user_delegations d JOIN users a ON a.id = d.delegator_id JOIN users b ON b.id = d.delegate_id LEFT JOIN users c ON c.id = d.created_by
    WHERE ($1::boolean IS FALSE OR (d.status = 'active' AND d.date_to >= CURRENT_DATE)) ORDER BY d.date_from DESC, d.id DESC`, [activeOnly]);
  return rows;
}

export async function createDelegation(db, b, user) {
  if (b.delegatorId === b.delegateId) throw badRequest('A person cannot delegate to themselves');
  if (b.dateTo < b.dateFrom) throw badRequest('The end date is before the start date');
  const users = (await db.query("SELECT id, status FROM users WHERE id = ANY($1)", [[b.delegatorId, b.delegateId]])).rows;
  if (users.length !== 2) throw badRequest('Unknown user');
  if (users.some((u) => u.status !== 'active')) throw badRequest('Both people must have active accounts');
  const types = b.transactionTypes || [];
  if (types.length) {
    const known = (await db.query('SELECT code FROM authority_transaction_types WHERE code = ANY($1)', [types])).rows.map((r) => r.code);
    const unknown = types.filter((t) => !known.includes(t));
    if (unknown.length) throw badRequest(`Unknown transaction type: ${unknown.join(', ')}`);
  }
  const { rows } = await db.query(`INSERT INTO user_delegations(delegator_id, delegate_id, transaction_types, date_from, date_to, reason, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [b.delegatorId, b.delegateId, types, b.dateFrom, b.dateTo, b.reason || null, user.id]);
  return (await listDelegations(db)).find((d) => d.id === rows[0].id);
}

export async function revokeDelegation(db, id, user) {
  const { rows } = await db.query(`UPDATE user_delegations SET status = 'revoked', revoked_by = $2, revoked_at = now() WHERE id = $1 AND status = 'active' RETURNING id`, [id, user.id]);
  if (!rows[0]) throw notFound('No active delegation with this id');
  return { id: Number(id), status: 'revoked' };
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
      s.access_a AS "accessA", s.access_b AS "accessB", s.action, s.reason, s.active
    FROM sod_rules s LEFT JOIN roles a ON a.code = s.role_a LEFT JOIN roles b ON b.code = s.role_b ORDER BY s.code`);
  return rows.map(sodOut);
}

/** The two sides of a rule: two different known roles, or two sets of known permissions that do not overlap. */
async function sodSides(db, b, kind) {
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

export async function saveSodRule(db, b, id = null) {
  const existing = id ? (await db.query('SELECT kind FROM sod_rules WHERE id = $1', [id])).rows[0] : null;
  if (id && !existing) throw notFound('Rule not found');
  const kind = b.kind || existing?.kind || 'roles';
  const x = await sodSides(db, b, kind);
  if (id) {
    await db.query(`UPDATE sod_rules SET name = $2, kind = $3, role_a = $4, role_b = $5, access_a = $6, access_b = $7, action = $8, reason = $9, active = $10 WHERE id = $1`,
      [id, b.name, kind, x.roleA, x.roleB, x.accessA, x.accessB, b.action, b.reason || null, b.active !== false]);
  } else {
    await db.query(`INSERT INTO sod_rules(code, name, kind, role_a, role_b, access_a, access_b, action, reason, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [b.code, b.name, kind, x.roleA, x.roleB, x.accessA, x.accessB, b.action, b.reason || null, b.active !== false]);
  }
  return (await listSodRules(db)).find((r) => (id ? r.id === Number(id) : r.code === b.code));
}

/** Removing a rule switches it off (kept for the record; the default rules would otherwise come back with the seed). */
export async function deleteSodRule(db, id) {
  const { rowCount } = await db.query('UPDATE sod_rules SET active = false WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Rule not found');
  return { id: Number(id), active: false };
}

/** Does a set of permission codes break an access rule (a code of each side)? */
export const breaksAccessRule = (rule, codes) => rule.accessA.some((c) => codes.has(c)) && rule.accessB.some((c) => codes.has(c));

/** Rules broken by a set of role codes (inherited roles count; access rules on the permissions of the active roles). */
export async function sodConflicts(db, roleCodes) {
  if (!(await db.query("SELECT to_regclass('sod_rules') IS NOT NULL AS ok")).rows[0].ok) return [];
  const { rows: expanded } = await db.query(`WITH RECURSIVE r(code) AS (SELECT unnest($1::text[]) UNION SELECT unnest(x.inherits) FROM roles x JOIN r ON r.code = x.code)
    SELECT DISTINCT code FROM r`, [roleCodes || []]);
  const have = new Set(expanded.map((r) => r.code));
  const rules = (await listSodRules(db)).filter((s) => s.active);
  const byRoles = rules.filter((s) => s.kind !== 'access' && have.has(s.roleA) && have.has(s.roleB));
  const access = rules.filter((s) => s.kind === 'access');
  if (!access.length) return byRoles;
  const full = await adminEquivalentRoles(db);
  const { rows } = await db.query(`SELECT DISTINCT p.code FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
    WHERE r.code = ANY($1) AND r.status = 'active'`, [[...have].filter((c) => !full.includes(c))]);
  const codes = new Set(rows.map((r) => r.code));
  return [...byRoles, ...access.filter((s) => breaksAccessRule(s, codes))];
}

const sodBetween = (s) => (s.kind === 'access' ? `${s.accessANames.join(', ')} with ${s.accessBNames.join(', ')} (${s.name})` : `${s.roleAName} and ${s.roleBName} (${s.name})`);

/** Throws when a blocking rule is broken; returns the warnings otherwise. */
export async function assertSod(db, roleCodes) {
  if (!(await getSetting('access.sod_enforced', true))) return [];
  const found = await sodConflicts(db, roleCodes);
  const blocking = found.filter((s) => s.action === 'block');
  if (blocking.length) {
    throw conflict(`Segregation of duties: ${blocking.map(sodBetween).join('; ')} may not be held by the same person`);
  }
  return found.map((s) => (s.kind === 'access' ? `${s.name}: ${s.reason || sodBetween(s)}` : `${s.roleAName} with ${s.roleBName}: ${s.reason || s.name}`));
}

// ---------------------------------------------------------------- matrices

const USER_MATRIX_SQL = `SELECT u.id, u.username, u.display_name AS "displayName", u.employee_code AS "employeeCode", u.branch_code AS "branch", u.department,
    u.designation, u.status, u.email, rt.display_name AS "reportingTo",
    COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS roles,
    COALESCE((SELECT array_agg(DISTINCT er.code ORDER BY er.code) FROM user_effective_roles(u.id) er), '{}') AS "effectiveRoles",
    u.last_login_at AS "lastLoginAt", u.totp_enabled AS "twoFactor", u.must_change_password AS "mustChangePassword", u.failed_logins AS "failedLogins",
    (CURRENT_DATE - u.password_changed_at::date) AS "passwordAgeDays",
    (CURRENT_DATE - COALESCE(u.last_login_at, u.created_at)::date) AS "daysSinceLogin", u.created_at AS "createdAt"
  FROM users u LEFT JOIN users rt ON rt.id = u.reporting_to
  WHERE ($1::text IS NULL OR u.status = $1) ORDER BY u.display_name`;

/** The permissions of every user through their active roles, full-access roles left out (only when an access rule is active). */
async function userAccessCodes(db, rules) {
  if (!rules.some((s) => s.kind === 'access')) return new Map();
  const { rows } = await db.query(`SELECT u.id, array_agg(DISTINCT p.code) AS codes FROM users u CROSS JOIN LATERAL user_effective_roles(u.id) er
    JOIN role_permissions rp ON rp.role_id = er.role_id JOIN permissions p ON p.id = rp.permission_id
    WHERE NOT (er.code = ANY($1)) GROUP BY u.id`, [await adminEquivalentRoles(db)]);
  return new Map(rows.map((r) => [r.id, new Set(r.codes)]));
}

/** Every user with roles, branch, status and sign-in facts, plus their segregation-of-duties conflicts. */
export async function userMatrix(db, { status = null } = {}) {
  const { rows } = await db.query(USER_MATRIX_SQL, [status]);
  const dormantDays = Number(await getSetting('access.dormant_days', 90)) || 0;
  const rules = (await listSodRules(db)).filter((s) => s.active);
  const roles = (await db.query("SELECT code, name FROM roles ORDER BY id")).rows;
  const access = await userAccessCodes(db, rules);
  return {
    roles,
    dormantDays,
    rows: rows.map((u) => {
      const have = new Set(u.effectiveRoles);
      const codes = access.get(u.id) || new Set();
      const broken = rules.filter((s) => (s.kind === 'access' ? breaksAccessRule(s, codes) : have.has(s.roleA) && have.has(s.roleB)));
      return { ...u, sodConflicts: broken.map((s) => ({ name: s.name, action: s.action, kind: s.kind })),
        dormant: dormantDays > 0 && u.status === 'active' && Number(u.daysSinceLogin) >= dormantDays };
    }),
  };
}

export const USER_MATRIX_HEADER = ['Username', 'Name', 'Employee code', 'Branch', 'Department', 'Designation', 'Reporting to', 'Status', 'Roles',
  'Last sign-in', 'Days since sign-in', 'Two-factor', 'Password age (days)', 'Segregation of duties'];
export const userMatrixRows = (m) => m.rows.map((u) => [u.username, u.displayName, u.employeeCode || '', u.branch || '', u.department || '', u.designation || '',
  u.reportingTo || '', u.status, u.roles.join(', '), u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 16).replace('T', ' ') : 'never',
  u.daysSinceLogin, u.twoFactor ? 'on' : 'off', u.passwordAgeDays, u.sodConflicts.map((c) => `${c.name} (${c.action})`).join('; ')]);

/** Permissions down, roles across (what each role may do), grouped by module. */
export async function roleMatrix(db) {
  const roles = (await db.query("SELECT id, code, name, inherits FROM roles WHERE status = 'active' ORDER BY id")).rows;
  const perms = (await db.query('SELECT id, code, module, description FROM permissions ORDER BY module, code')).rows;
  const grants = (await db.query('SELECT role_id, permission_id FROM role_permissions')).rows;
  const has = new Set(grants.map((g) => `${g.role_id}:${g.permission_id}`));
  return {
    roles: roles.map((r) => ({ code: r.code, name: r.name, inherits: r.inherits })),
    rows: perms.map((p) => ({ code: p.code, module: p.module, description: p.description, grants: Object.fromEntries(roles.map((r) => [r.code, has.has(`${r.id}:${p.id}`)])) })),
  };
}

// ---------------------------------------------------------------- access reviews

export async function listReviews(db) {
  const { rows } = await db.query(`SELECT a.id, a.name, a.due_date AS "dueDate", a.status, c.display_name AS "createdBy", a.created_at AS "createdAt", a.closed_at AS "closedAt",
      count(i.id)::int AS users, count(i.id) FILTER (WHERE i.decision = 'pending')::int AS pending, count(i.id) FILTER (WHERE i.decision = 'revoke')::int AS revoked
    FROM access_reviews a LEFT JOIN access_review_items i ON i.review_id = a.id LEFT JOIN users c ON c.id = a.created_by
    GROUP BY a.id, c.display_name ORDER BY a.created_at DESC`);
  return rows;
}

/** Start a review: a snapshot of every active user and their roles, to be confirmed or revoked one by one. */
export async function startReview(db, { name, dueDate }, user) {
  const { rows } = await db.query('INSERT INTO access_reviews(name, due_date, created_by) VALUES ($1, $2, $3) RETURNING id', [name, dueDate, user.id]);
  await db.query(`INSERT INTO access_review_items(review_id, user_id, roles, last_login_at)
    SELECT $1, u.id, COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}'), u.last_login_at
    FROM users u WHERE u.status = 'active'`, [rows[0].id]);
  return getReview(db, rows[0].id);
}

export async function getReview(db, id) {
  const review = (await listReviews(db)).find((r) => r.id === Number(id));
  if (!review) throw notFound('Access review not found');
  const { rows } = await db.query(`SELECT i.id, i.user_id AS "userId", u.username, u.display_name AS "displayName", u.branch_code AS branch, u.status AS "currentStatus",
      i.roles, i.last_login_at AS "lastLoginAt", i.decision, i.remarks, d.display_name AS "decidedBy", i.decided_at AS "decidedAt"
    FROM access_review_items i JOIN users u ON u.id = i.user_id LEFT JOIN users d ON d.id = i.decided_by WHERE i.review_id = $1 ORDER BY u.display_name`, [id]);
  return { ...review, items: rows };
}

/** Keep or revoke one user's access. Revoking deactivates the account and signs it out (roles stay for the record). */
export async function decideReviewItem(db, reviewId, itemId, { decision, remarks }, user) {
  const item = (await db.query(`SELECT i.*, a.status AS review_status FROM access_review_items i JOIN access_reviews a ON a.id = i.review_id
    WHERE i.id = $1 AND i.review_id = $2 FOR UPDATE`, [itemId, reviewId])).rows[0];
  if (!item) throw notFound('Review item not found');
  if (item.review_status !== 'open') throw conflict('This review is closed');
  if (item.user_id === user.id) throw forbidden('You cannot review your own access');
  if (decision === 'revoke' && !remarks) throw badRequest('Give the reason for revoking the access');
  await db.query('UPDATE access_review_items SET decision = $2, remarks = $3, decided_by = $4, decided_at = now() WHERE id = $1', [itemId, decision, remarks || null, user.id]);
  if (decision === 'revoke') {
    await db.query("UPDATE users SET status = 'inactive', token_version = token_version + 1, updated_by = $2, updated_at = now() WHERE id = $1", [item.user_id, user.id]);
  }
  return getReview(db, reviewId);
}

export async function closeReview(db, id, user) {
  const r = await getReview(db, id);
  if (r.status !== 'open') throw conflict('This review is already closed');
  if (r.pending > 0) throw conflict(`${r.pending} user(s) still to be reviewed`);
  await db.query("UPDATE access_reviews SET status = 'closed', closed_by = $2, closed_at = now() WHERE id = $1", [id, user.id]);
  return getReview(db, id);
}

export const REVIEW_HEADER = ['Username', 'Name', 'Branch', 'Roles', 'Last sign-in', 'Decision', 'Remarks', 'Decided by', 'Decided at'];
export const reviewRows = (r) => r.items.map((i) => [i.username, i.displayName, i.branch || '', i.roles.join(', '),
  i.lastLoginAt ? new Date(i.lastLoginAt).toISOString().slice(0, 10) : 'never', i.decision, i.remarks || '', i.decidedBy || '', i.decidedAt ? new Date(i.decidedAt).toISOString().slice(0, 16).replace('T', ' ') : '']);

// ---------------------------------------------------------------- sessions and dormant accounts

/** End every session of a user (their tokens stop working at the next request). */
export async function signOutEverywhere(db, userId, user) {
  if (userId === user.id) throw badRequest('Use Sign out to end your own session');
  const { rows } = await db.query('UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = $1 RETURNING username', [userId]);
  if (!rows[0]) throw notFound('User not found');
  return { userId, username: rows[0].username, signedOut: true };
}

/** Daily job: deactivate active accounts not signed in for access.dormant_days (the built-in administrator excepted). */
export async function deactivateDormant(db, { adminUsername = 'BrokerVerse' } = {}) {
  const days = Number(await getSetting('access.dormant_days', 90)) || 0;
  if (days <= 0) return { deactivated: 0, reason: 'access.dormant_days is 0' };
  const { rows } = await db.query(`UPDATE users SET status = 'inactive', token_version = token_version + 1, updated_by = 'system', updated_at = now()
    WHERE status = 'active' AND username <> $2 AND COALESCE(last_login_at, created_at) < now() - make_interval(days => $1::int)
    RETURNING username`, [days, adminUsername]);
  return { deactivated: rows.length, users: rows.map((r) => r.username), days };
}
