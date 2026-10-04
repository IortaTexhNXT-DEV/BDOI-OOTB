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
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';

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
    l.effective_from AS "effectiveFrom", l.effective_to AS "effectiveTo", rq.display_name AS "requestedBy", l.requested_by AS "requestedById", l.requested_at AS "requestedAt",
    dc.display_name AS "decidedBy", l.decided_at AS "decidedAt", l.decision_note AS "decisionNote"
  FROM authority_limits l JOIN authority_transaction_types t ON t.code = l.transaction_type
  LEFT JOIN roles r ON r.code = l.role_code LEFT JOIN users u ON u.id = l.user_id
  LEFT JOIN users rq ON rq.id = l.requested_by LEFT JOIN users dc ON dc.id = l.decided_by`;

const shapeLimit = (r) => ({ ...r, maxAmount: money(r.maxAmount), unlimited: r.maxAmount === null });

export async function listLimits(db, { status = null, transactionType = null } = {}) {
  const { rows } = await db.query(`${LIMIT_SELECT}
    WHERE ($1::text IS NULL OR l.status = $1) AND ($2::text IS NULL OR l.transaction_type = $2)
    ORDER BY t.sort_order, l.role_code NULLS LAST, u.username, l.requested_at DESC`, [status, transactionType]);
  return rows.map(shapeLimit);
}

/** Types down, roles across: the active limit of each role, and whether a change is waiting for approval. */
export async function authorityMatrix(db) {
  const types = await transactionTypes(db, { activeOnly: true });
  const roles = (await db.query("SELECT code, name FROM roles WHERE status = 'active' ORDER BY id")).rows;
  const limits = await listLimits(db);
  const cell = (type, role) => {
    const active = limits.find((l) => l.transactionType === type && l.roleCode === role && l.status === 'active');
    const pending = limits.find((l) => l.transactionType === type && l.roleCode === role && l.status === 'pending');
    return { limitId: active?.id ?? null, maxAmount: active ? active.maxAmount : null, unlimited: !!active && active.unlimited, set: !!active,
      pending: pending ? { id: pending.id, maxAmount: pending.maxAmount, unlimited: pending.unlimited, requestedBy: pending.requestedBy } : null };
  };
  return {
    roles,
    rows: types.map((t) => ({ ...t, cells: Object.fromEntries(roles.map((r) => [r.code, cell(t.code, r.code)])) })),
    userLimits: limits.filter((l) => l.userId && ['active', 'pending'].includes(l.status)),
    withoutLimit: String(await getSetting('access.authority_without_limit', 'allow')),
  };
}

/** Propose a limit for a role or a user. It waits for another administrator's approval before it applies. */
export async function proposeLimit(db, b, user) {
  if (!b.roleCode === !b.userId) throw badRequest('Give either a role or a user');
  const type = (await db.query('SELECT code, measure FROM authority_transaction_types WHERE code = $1', [b.transactionType])).rows[0];
  if (!type) throw badRequest('Unknown transaction type');
  const max = b.unlimited ? null : money(b.maxAmount);
  if (!b.unlimited && (max === null || max < 0)) throw badRequest('Enter the limit, or mark it as no limit');
  if (type.measure === 'percent' && max !== null && max > 100) throw badRequest('A percent limit cannot be over 100');
  if (b.roleCode && !(await db.query('SELECT 1 FROM roles WHERE code = $1', [b.roleCode])).rowCount) throw badRequest('Unknown role');
  if (b.userId && !(await db.query('SELECT 1 FROM users WHERE id = $1', [b.userId])).rowCount) throw badRequest('Unknown user');
  const scope = b.roleCode ? ['role_code', b.roleCode] : ['user_id', b.userId];
  const current = (await db.query(`SELECT id FROM authority_limits WHERE transaction_type = $1 AND ${scope[0]} = $2 AND status = 'active'`, [type.code, scope[1]])).rows[0];
  // one open proposal per role / user and type: a new proposal replaces the earlier one
  await db.query(`UPDATE authority_limits SET status = 'rejected', decided_by = $3, decided_at = now(), decision_note = 'Replaced by a newer proposal'
    WHERE transaction_type = $1 AND ${scope[0]} = $2 AND status = 'pending'`, [type.code, scope[1], user.id]);
  const { rows } = await db.query(`INSERT INTO authority_limits(transaction_type, role_code, user_id, max_amount, remarks, replaces_id, effective_from, requested_by)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8) RETURNING id`,
  [type.code, b.roleCode || null, b.userId || null, max, b.remarks || null, current?.id ?? null, b.effectiveFrom || null, user.id]);
  return (await listLimits(db)).find((l) => l.id === rows[0].id);
}

/** Approve or reject a proposed limit (maker-checker: not the person who proposed it). */
export async function decideLimit(db, id, { decision, note }, user) {
  const l = (await db.query('SELECT * FROM authority_limits WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!l) throw notFound('Authority limit not found');
  if (l.status !== 'pending') throw conflict(`This limit is ${l.status}; only proposals waiting for approval can be decided`);
  if (l.requested_by === user.id) throw forbidden('Maker-checker: a limit is approved by another administrator, not the one who proposed it');
  if (decision === 'approve') {
    const scope = l.role_code ? ['role_code', l.role_code] : ['user_id', l.user_id];
    await db.query(`UPDATE authority_limits SET status = 'retired', effective_to = CURRENT_DATE WHERE transaction_type = $1 AND ${scope[0]} = $2 AND status = 'active'`,
      [l.transaction_type, scope[1]]);
  }
  await db.query('UPDATE authority_limits SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4 WHERE id = $1',
    [id, decision === 'approve' ? 'active' : 'rejected', user.id, note || null]);
  return (await listLimits(db)).find((x) => x.id === Number(id));
}

/** Withdraw an active limit (the role or user then falls back to the other rows, or to the no-limit setting). */
export async function retireLimit(db, id, user) {
  const { rows } = await db.query(`UPDATE authority_limits SET status = 'retired', effective_to = CURRENT_DATE, decided_by = $2, decided_at = now(),
    decision_note = 'Withdrawn' WHERE id = $1 AND status = 'active' RETURNING id`, [id, user.id]);
  if (!rows[0]) throw notFound('No active limit with this id');
  return { id: Number(id), status: 'retired' };
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

export async function listSodRules(db) {
  const { rows } = await db.query(`SELECT s.id, s.code, s.name, s.role_a AS "roleA", a.name AS "roleAName", s.role_b AS "roleB", b.name AS "roleBName", s.action, s.reason, s.active
    FROM sod_rules s JOIN roles a ON a.code = s.role_a JOIN roles b ON b.code = s.role_b ORDER BY s.code`);
  return rows;
}

export async function saveSodRule(db, b, id = null) {
  if (b.roleA === b.roleB) throw badRequest('Pick two different roles');
  const known = (await db.query('SELECT code FROM roles WHERE code = ANY($1)', [[b.roleA, b.roleB]])).rows;
  if (known.length !== 2) throw badRequest('Unknown role');
  if (id) {
    const { rows } = await db.query(`UPDATE sod_rules SET name = $2, role_a = $3, role_b = $4, action = $5, reason = $6, active = $7 WHERE id = $1 RETURNING id`,
      [id, b.name, b.roleA, b.roleB, b.action, b.reason || null, b.active !== false]);
    if (!rows[0]) throw notFound('Rule not found');
  } else {
    await db.query(`INSERT INTO sod_rules(code, name, role_a, role_b, action, reason, active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [b.code, b.name, b.roleA, b.roleB, b.action, b.reason || null, b.active !== false]);
  }
  return (await listSodRules(db)).find((r) => (id ? r.id === Number(id) : r.code === b.code));
}

/** Removing a rule switches it off (kept for the record; the default rules would otherwise come back with the seed). */
export async function deleteSodRule(db, id) {
  const { rowCount } = await db.query('UPDATE sod_rules SET active = false WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Rule not found');
  return { id: Number(id), active: false };
}

/** Rules broken by a set of role codes (inherited roles count). */
export async function sodConflicts(db, roleCodes) {
  if (!(await db.query("SELECT to_regclass('sod_rules') IS NOT NULL AS ok")).rows[0].ok) return [];
  const { rows: expanded } = await db.query(`WITH RECURSIVE r(code) AS (SELECT unnest($1::text[]) UNION SELECT unnest(x.inherits) FROM roles x JOIN r ON r.code = x.code)
    SELECT DISTINCT code FROM r`, [roleCodes || []]);
  const have = new Set(expanded.map((r) => r.code));
  return (await listSodRules(db)).filter((s) => s.active && have.has(s.roleA) && have.has(s.roleB));
}

/** Throws when a blocking rule is broken; returns the warnings otherwise. */
export async function assertSod(db, roleCodes) {
  if (!(await getSetting('access.sod_enforced', true))) return [];
  const found = await sodConflicts(db, roleCodes);
  const blocking = found.filter((s) => s.action === 'block');
  if (blocking.length) {
    throw conflict(`Segregation of duties: ${blocking.map((s) => `${s.roleAName} and ${s.roleBName} (${s.name})`).join('; ')} may not be held by the same person`);
  }
  return found.map((s) => `${s.roleAName} with ${s.roleBName}: ${s.reason || s.name}`);
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

/** Every user with roles, branch, status and sign-in facts, plus their segregation-of-duties conflicts. */
export async function userMatrix(db, { status = null } = {}) {
  const { rows } = await db.query(USER_MATRIX_SQL, [status]);
  const dormantDays = Number(await getSetting('access.dormant_days', 90)) || 0;
  const rules = (await listSodRules(db)).filter((s) => s.active);
  const roles = (await db.query("SELECT code, name FROM roles ORDER BY id")).rows;
  return {
    roles,
    dormantDays,
    rows: rows.map((u) => {
      const have = new Set(u.effectiveRoles);
      return { ...u, sodConflicts: rules.filter((s) => have.has(s.roleA) && have.has(s.roleB)).map((s) => ({ name: s.name, action: s.action })),
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
