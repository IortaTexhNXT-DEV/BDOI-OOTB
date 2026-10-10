/**
 * Access Reviews (Master > Users and Access): a periodic confirmation that each user still needs his or her access.
 *
 * A review takes a snapshot of the active users of its scope (all active users, departments or roles of the role
 * directory) and their roles. Each line is decided: Keep access, Remove roles (some of the roles held) or Deactivate
 * account, the last two with a reason of access_review; Keep needs a note when the user is dormant or has an open
 * segregation-of-duties conflict. Nobody decides his or her own line; an administrator account (a holder of a
 * full-access role, or the built-in administrator) is decided only by a System Administrator, and the built-in
 * administrator is never deactivated.
 *
 * With access.change_approval (on by default) the removals wait: once every line is decided the review is submitted
 * for sign-off (status awaiting-signoff, a change of kind access-review in changes.js). A different user holding
 * approve:access-control, who decided none of its removals, signs it off: the removals apply (only roles still held;
 * an account already inactive is noted), the sessions of the users concerned are renewed and the review closes.
 * Returning it (a rejection, remarks required) or withdrawing it opens it again for changes. Without approval the
 * removals apply when decided and the review is closed when every line is decided.
 */
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { businessTimeZone, today } from '../../lib/dates.js';
import { formatDate, formatDateTime } from '../../lib/pdf/format.js';
import { requiredReason } from '../ops-masters/records.js';
import { changeApproval, listAccessChanges, registerAccessKind, requestAccessChange } from './changes.js';
import { BUILT_IN_ADMIN, departmentOf, isAdminAccount, roleDirectory } from './roles.js';
import { sodConflictList } from './sod.js';

export const KIND = 'access-review';
export const REVIEWS_PATH = '/master/generals/usermanagement/access-reviews';
const EDIT = 'write:access-control';
const APPROVE = 'approve:access-control';
export const OUTCOMES = ['keep', 'remove-roles', 'deactivate'];
export const OUTCOME_WORDS = { pending: 'To review', keep: 'Keep access', 'remove-roles': 'Remove roles', deactivate: 'Deactivate account' };
export const STATUS_WORDS = { open: 'Open', 'awaiting-signoff': 'Waiting for sign-off', closed: 'Closed' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const removal = (d) => d === 'remove-roles' || d === 'deactivate';

// ---------------------------------------------------------------- scope

/** The role codes of a scope: null for all active users, otherwise the roles of the departments or the roles chosen. */
function scopeRoles(dir, scope) {
  if (!scope || scope.kind === 'all') return null;
  if (scope.kind === 'departments') return dir.roles.filter((r) => (scope.departments || []).includes(r.department)).map((r) => r.code);
  return dir.roles.filter((r) => (scope.roles || []).includes(r.code)).map((r) => r.code);
}

function scopeOf(b) {
  const kind = ['all', 'departments', 'roles'].includes(b?.kind) ? b.kind : 'all';
  const out = { kind, departments: kind === 'departments' ? [...new Set(b.departments || [])] : [], roles: kind === 'roles' ? [...new Set(b.roles || [])] : [] };
  if (kind === 'departments' && !out.departments.length) throw badRequest('Validation failed', [{ path: 'scope', message: 'Choose at least one department' }]);
  if (kind === 'roles' && !out.roles.length) throw badRequest('Validation failed', [{ path: 'scope', message: 'Choose at least one role' }]);
  return out;
}

/** "All active users", "Cash Control, IT", "TIS Finance & General Accounting". */
export function scopeText(dir, scope) {
  if (!scope || scope.kind === 'all') return 'All active users';
  if (scope.kind === 'departments') return (scope.departments || []).join(', ');
  const names = new Map(dir.roles.map((r) => [r.code, r.name]));
  return (scope.roles || []).map((c) => names.get(c) || c).join(', ');
}

async function scopeUsers(db, dir, scope) {
  const codes = scopeRoles(dir, scope);
  const { rows } = await db.query(`SELECT u.id FROM users u WHERE u.status = 'active'
    AND ($1::text[] IS NULL OR EXISTS (SELECT 1 FROM user_effective_roles(u.id) er WHERE er.code = ANY($1))) ORDER BY u.display_name`, [codes]);
  return rows.map((r) => r.id);
}

/** How many active users a scope reviews: { users, scopeText }. */
export async function previewReview(db, b) {
  const dir = await roleDirectory(db);
  const scope = scopeOf(b);
  return { users: (await scopeUsers(db, dir, scope)).length, scopeText: scopeText(dir, scope) };
}

// ---------------------------------------------------------------- reading

const REVIEW_SELECT = `SELECT a.id, a.name, to_char(a.due_date, 'YYYY-MM-DD') AS "dueDate", a.status, a.scope, a.change_id AS "changeId",
    a.created_by AS "createdById", c.display_name AS "createdBy", a.created_at AS "createdAt", s.display_name AS "submittedBy", a.submitted_by AS "submittedById",
    a.submitted_at AS "submittedAt", so.display_name AS "signedOffBy", a.signed_off_at AS "signedOffAt", cl.display_name AS "closedBy", a.closed_at AS "closedAt",
    count(i.id)::int AS users, count(i.id) FILTER (WHERE i.decision = 'pending')::int AS pending, count(i.id) FILTER (WHERE i.decision = 'keep')::int AS kept,
    count(i.id) FILTER (WHERE i.decision = 'remove-roles')::int AS "removeRoles", count(i.id) FILTER (WHERE i.decision = 'deactivate')::int AS deactivate,
    count(i.id) FILTER (WHERE i.applied_at IS NOT NULL)::int AS applied
  FROM access_reviews a LEFT JOIN access_review_items i ON i.review_id = a.id LEFT JOIN users c ON c.id = a.created_by LEFT JOIN users s ON s.id = a.submitted_by
  LEFT JOIN users so ON so.id = a.signed_off_by LEFT JOIN users cl ON cl.id = a.closed_by`;
const GROUP = 'GROUP BY a.id, c.display_name, s.display_name, so.display_name, cl.display_name';

const reviewOut = (r, dir, day) => ({
  ...r, id: Number(r.id), changeId: r.changeId === null ? null : Number(r.changeId), scopeText: scopeText(dir, r.scope), removals: r.removeRoles + r.deactivate,
  overdue: r.status !== 'closed' && r.dueDate < day, revoked: r.deactivate,
});

/** Reviews, newest first, with progress, removals and the overdue state. */
export async function listReviews(db) {
  const day = await today();
  const dir = await roleDirectory(db);
  const { rows } = await db.query(`${REVIEW_SELECT} ${GROUP} ORDER BY a.created_at DESC, a.id DESC`);
  return rows.map((r) => reviewOut(r, dir, day));
}

/** Why this reviewer may not decide a line: own, admin (needs a System Administrator), or null. */
const blockedFor = (item, user) => {
  if (item.userId === user?.id) return 'own';
  if (item.adminAccount && !isAdmin(user)) return 'admin';
  return null;
};

/**
 * One review with every line: roles at the start and now (by name), department, last sign-in and dormancy, conflicts,
 * outcome, removal state and what this user may do; the sign-off waiting for approval.
 */
export async function getReview(db, id, user = null) {
  const day = await today();
  const dir = await roleDirectory(db);
  const r = (await db.query(`${REVIEW_SELECT} WHERE a.id = $1 ${GROUP}`, [Number(id) || 0])).rows[0];
  if (!r) throw notFound('Access review not found');
  const review = reviewOut(r, dir, day);
  const tz = await businessTimeZone();
  const dormantDays = Number(await getSetting('access.dormant_days', 90)) || 0;
  const { rows } = await db.query(`SELECT i.id, i.user_id AS "userId", u.username, u.display_name AS "displayName", u.designation, u.branch_code AS branch, b.name AS "branchName",
      u.status AS "currentStatus", i.roles AS "rolesAtStart",
      COALESCE((SELECT array_agg(x.code ORDER BY x.code) FROM user_roles ur JOIN roles x ON x.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS "rolesNow",
      i.last_login_at AS "lastLoginAt", ($2::date - (COALESCE(u.last_login_at, u.created_at) AT TIME ZONE $3)::date) AS "daysSinceLogin",
      i.decision, i.remove_roles AS "removeRoles", i.reason_code AS "reasonCode", i.remarks, i.decided_by AS "decidedById", d.display_name AS "decidedBy", i.decided_at AS "decidedAt",
      ap.display_name AS "appliedBy", i.applied_at AS "appliedAt", i.apply_note AS "applyNote",
      (u.username = $4 OR EXISTS (SELECT 1 FROM user_effective_roles(u.id) er WHERE er.code = ANY($5))) AS "adminAccount", u.username = $4 AS "builtIn"
    FROM access_review_items i JOIN users u ON u.id = i.user_id LEFT JOIN branches b ON b.code = u.branch_code LEFT JOIN users d ON d.id = i.decided_by
    LEFT JOIN users ap ON ap.id = i.applied_by WHERE i.review_id = $1 ORDER BY u.display_name`,
  [review.id, day, tz, BUILT_IN_ADMIN, dir.roles.filter((x) => x.fullAccess).map((x) => x.code)]);
  const conflicts = new Map();
  for (const c of (await sodConflictList(db, { status: 'all' }, user)).rows) {
    if (!conflicts.has(c.userId)) conflicts.set(c.userId, []);
    conflicts.get(c.userId).push({ ruleName: c.ruleName, action: c.action, state: c.state, validUntil: c.exception?.validUntil || null });
  }
  const names = new Map(dir.roles.map((x) => [x.code, x.name]));
  const named = (codes) => (codes || []).map((c) => names.get(c) || c);
  const edit = !!user && hasPermission(user, EDIT);
  const items = rows.map((i) => {
    const sod = conflicts.get(i.userId) || [];
    const dormant = dormantDays > 0 && Number(i.daysSinceLogin) >= dormantDays;
    const item = {
      ...i, id: Number(i.id), department: departmentOf(dir, i.rolesAtStart), roleNamesAtStart: named(i.rolesAtStart), roleNamesNow: named(i.rolesNow),
      rolesChanged: [...i.rolesAtStart].sort().join() !== [...i.rolesNow].sort().join(), removeRoleNames: named(i.removeRoles), dormant, conflicts: sod,
      openConflicts: sod.filter((c) => c.state === 'open' || c.state === 'expired').length,
      removalState: !removal(i.decision) ? null : i.appliedAt ? 'applied' : 'waiting',
      roles: i.rolesAtStart,
    };
    item.needsNote = dormant || item.openConflicts > 0;
    item.blocked = blockedFor(item, user);
    item.canDecide = edit && review.status === 'open' && !item.blocked && !item.appliedAt;
    return item;
  });
  const change = review.changeId ? (await listAccessChanges(db, { kind: KIND, status: 'all', target: `AR-${review.id}` }, user)).find((c) => c.id === review.changeId) || null : null;
  const approval = await changeApproval();
  const allDecided = items.every((i) => i.decision !== 'pending');
  return {
    ...review, items, approval, dormantDays, asOf: day, change,
    canSubmit: edit && approval && review.status === 'open' && allDecided && items.length > 0,
    canClose: edit && !approval && review.status === 'open' && allDecided,
    abilities: { edit, approve: !!user && hasPermission(user, APPROVE), technical: !!user && isAdmin(user) },
  };
}

// ---------------------------------------------------------------- start, decide, submit

/** Start a review of the active users of a scope: { name, dueDate (today or later), scope: { kind, departments, roles } }. */
export async function startReview(db, b, user) {
  const day = await today();
  if (!DATE.test(b.dueDate || '') || b.dueDate < day) throw badRequest('Validation failed', [{ path: 'dueDate', message: 'The due date cannot be in the past' }]);
  const dir = await roleDirectory(db);
  const scope = scopeOf(b.scope);
  const users = await scopeUsers(db, dir, scope);
  if (!users.length) throw badRequest('Validation failed', [{ path: 'scope', message: 'No active user is in this scope' }]);
  const { rows } = await db.query('INSERT INTO access_reviews(name, due_date, created_by, scope) VALUES ($1, $2, $3, $4) RETURNING id',
    [String(b.name).trim(), b.dueDate, user.id, JSON.stringify(scope)]);
  await db.query(`INSERT INTO access_review_items(review_id, user_id, roles, last_login_at)
    SELECT $1, u.id, COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}'), u.last_login_at
    FROM users u WHERE u.id = ANY($2)`, [rows[0].id, users]);
  return getReview(db, rows[0].id, user);
}

/** Remove the roles still held or deactivate the account of a decided line, renew its sessions and record it. */
async function applyRemoval(db, item, user) {
  let note = null;
  if (item.decision === 'deactivate') {
    const { rowCount } = await db.query(`UPDATE users SET status = 'inactive', token_version = token_version + 1, updated_by = $2, updated_at = now()
      WHERE id = $1 AND status = 'active'`, [item.user_id, user.id]);
    if (!rowCount) note = 'Already inactive';
  } else {
    const { rows } = await db.query(`DELETE FROM user_roles ur USING roles r WHERE r.id = ur.role_id AND ur.user_id = $1 AND r.code = ANY($2) RETURNING r.code`,
      [item.user_id, item.remove_roles]);
    const gone = item.remove_roles.filter((c) => !rows.some((x) => x.code === c));
    if (gone.length) note = `No longer held: ${gone.join(', ')}`;
    await db.query('UPDATE users SET token_version = token_version + 1, updated_by = $2, updated_at = now() WHERE id = $1', [item.user_id, user.id]);
  }
  await db.query('UPDATE access_review_items SET applied_by = $2, applied_at = now(), apply_note = $3 WHERE id = $1', [item.id, user.id, note]);
}

async function lockItem(db, reviewId, itemId) {
  const item = (await db.query(`SELECT i.*, a.status AS review_status, u.username, u.display_name FROM access_review_items i JOIN access_reviews a ON a.id = i.review_id
    JOIN users u ON u.id = i.user_id WHERE i.id = $1 AND i.review_id = $2 FOR UPDATE OF i`, [Number(itemId) || 0, Number(reviewId) || 0])).rows[0];
  if (!item) throw notFound('Review item not found');
  return item;
}

async function assertMayDecide(db, item, user) {
  if (item.review_status !== 'open') throw conflict(item.review_status === 'closed' ? 'This review is closed' : 'This review is waiting for sign-off; it is returned to make changes');
  if (item.user_id === user.id) throw forbidden('You cannot review your own access');
  if (!isAdmin(user) && (await isAdminAccount(db, item.user_id))) throw forbidden('Only a System Administrator can decide the access of an administrator account');
  if (item.applied_at) throw conflict('The removal of this line is already applied; give the access back on the user form');
}

/** Facts that decide whether Keep needs a note: dormant, or a conflict with no exception in force. */
async function needsNote(db, item, user) {
  const days = Number(await getSetting('access.dormant_days', 90)) || 0;
  const tz = await businessTimeZone();
  const since = (await db.query(`SELECT ($2::date - (COALESCE(last_login_at, created_at) AT TIME ZONE $3)::date) AS d FROM users WHERE id = $1`,
    [item.user_id, await today(), tz])).rows[0]?.d;
  if (days > 0 && Number(since) >= days) return 'The user has not signed in for a long time';
  const open = (await sodConflictList(db, { status: 'all', userId: item.user_id }, user)).rows.filter((c) => c.state === 'open' || c.state === 'expired');
  return open.length ? 'The user has a segregation-of-duties conflict without an exception' : null;
}

/**
 * Decide one line: { outcome: keep | remove-roles | deactivate (or the earlier decision: keep | revoke), removeRoles,
 * reasonCode, note }. Without approval a removal applies at once.
 */
export async function decideReviewItem(db, reviewId, itemId, b, user) {
  const item = await lockItem(db, reviewId, itemId);
  await assertMayDecide(db, item, user);
  let outcome = b.outcome || (b.decision === 'revoke' ? 'deactivate' : b.decision);
  if (!OUTCOMES.includes(outcome)) throw badRequest('Validation failed', [{ path: 'outcome', message: 'Choose Keep access, Remove roles or Deactivate account' }]);
  const note = String(b.note ?? b.remarks ?? '').trim() || null;
  let removeRoles = [];
  if (outcome === 'remove-roles') {
    const held = (await db.query('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1', [item.user_id])).rows.map((r) => r.code);
    removeRoles = [...new Set(b.removeRoles || [])];
    if (!removeRoles.length) throw badRequest('Validation failed', [{ path: 'removeRoles', message: 'Choose the roles to remove' }]);
    const notHeld = removeRoles.filter((c) => !held.includes(c));
    if (notHeld.length) throw badRequest('Validation failed', [{ path: 'removeRoles', message: `Not held by ${item.display_name}: ${notHeld.join(', ')}` }]);
    if (held.every((c) => removeRoles.includes(c))) {
      outcome = 'deactivate';
      removeRoles = [];
    }
  }
  if (outcome === 'deactivate' && item.username === BUILT_IN_ADMIN) throw forbidden('The built-in administrator account is never deactivated');
  let reason = { code: null, text: note };
  if (removal(outcome)) {
    reason = await requiredReason(db, 'access_review', { reasonCode: b.reasonCode, note });
  } else {
    const why = await needsNote(db, item, user);
    if (why && !note) throw badRequest('Validation failed', [{ path: 'note', message: `${why}: say why the access is kept` }]);
  }
  await db.query(`UPDATE access_review_items SET decision = $2, remove_roles = $3, reason_code = $4, remarks = $5, decided_by = $6, decided_at = now() WHERE id = $1`,
    [item.id, outcome, removeRoles, reason.code, reason.text, user.id]);
  if (removal(outcome) && !(await changeApproval())) {
    await applyRemoval(db, { ...item, decision: outcome, remove_roles: removeRoles }, user);
  }
  return { review: await getReview(db, reviewId, user), outcome, before: { decision: item.decision, removeRoles: item.remove_roles, remarks: item.remarks } };
}

/** Keep several lines at once with an optional note; lines that may not be kept this way are left out and named. */
export async function keepReviewItems(db, reviewId, { itemIds = [], note = null }, user) {
  const kept = [];
  const skipped = [];
  for (const itemId of [...new Set(itemIds.map(Number))]) {
    const item = await lockItem(db, reviewId, itemId);
    try {
      await assertMayDecide(db, item, user);
      const why = await needsNote(db, item, user);
      if (why && !String(note || '').trim()) throw badRequest(why);
      await db.query(`UPDATE access_review_items SET decision = 'keep', remove_roles = '{}', reason_code = NULL, remarks = $2, decided_by = $3, decided_at = now() WHERE id = $1`,
        [item.id, String(note || '').trim() || null, user.id]);
      kept.push(item.display_name);
    } catch (e) {
      if (e.status === 409 && /closed|sign-off/.test(e.message)) throw e;
      skipped.push({ name: item.display_name, reason: e.message });
    }
  }
  return { review: await getReview(db, reviewId, user), kept, skipped };
}

/** Submit a review whose lines are all decided for sign-off by another administrator (approval on). */
export async function submitReview(db, id, user) {
  const r = (await db.query('SELECT * FROM access_reviews WHERE id = $1 FOR UPDATE', [Number(id) || 0])).rows[0];
  if (!r) throw notFound('Access review not found');
  if (r.status !== 'open') throw conflict(r.status === 'closed' ? 'This review is closed' : 'This review is already waiting for sign-off');
  if (!(await changeApproval())) throw conflict('Removals apply when they are decided; close the review instead');
  const review = await getReview(db, r.id, user);
  if (!review.items.length || review.pending > 0) throw conflict(`${review.pending} user(s) still to be reviewed`);
  const removals = review.items.filter((i) => removal(i.decision)).map((i) => ({ itemId: i.id, userId: i.userId, userName: i.displayName, outcome: i.decision,
    roles: i.removeRoles, roleNames: i.removeRoleNames, reason: i.remarks }));
  const payload = { reviewId: r.id, name: r.name, users: review.users, kept: review.kept, removals, title: r.name };
  const change = await requestAccessChange(db, { kind: KIND, target: `AR-${r.id}`, payload, user, note: `${removals.length} removal(s), ${review.kept} kept` });
  await db.query("UPDATE access_reviews SET status = 'awaiting-signoff', submitted_by = $2, submitted_at = now(), change_id = $3 WHERE id = $1", [r.id, user.id, change.id]);
  return { review: await getReview(db, r.id, user), change };
}

/** Close a review once every line is decided, while access.change_approval is off (with it, the sign-off closes it). */
export async function closeReview(db, id, user) {
  if (await changeApproval()) throw conflict('A review is closed by its sign-off: submit it for sign-off');
  const r = await getReview(db, id, user);
  if (r.status !== 'open') throw conflict('This review is already closed');
  if (r.pending > 0) throw conflict(`${r.pending} user(s) still to be reviewed`);
  await db.query("UPDATE access_reviews SET status = 'closed', closed_by = $2, closed_at = now() WHERE id = $1", [r.id, user.id]);
  return getReview(db, id, user);
}

const removalText = (x) => (x.outcome === 'deactivate' ? `Deactivate ${x.userName}` : `Remove ${(x.roleNames || x.roles || []).join(', ')} from ${x.userName}`)
  + (x.reason ? ` · ${x.reason}` : '');

registerAccessKind(KIND, {
  label: 'Access review',
  link: (c) => `${REVIEWS_PATH}?review=${c.payload?.reviewId}`,
  describe: async (_db, c) => {
    const removals = c.payload?.removals || [];
    return { targetLabel: c.payload?.name || c.target, summary: removals.length ? removals.map(removalText) : [`${c.payload?.users || 0} user(s) kept; nothing to remove`] };
  },
  assertDecider: async (db, c, user) => {
    const deciders = (await db.query(`SELECT DISTINCT decided_by FROM access_review_items WHERE review_id = $1 AND decision IN ('remove-roles', 'deactivate')`,
      [c.payload.reviewId])).rows.map((r) => r.decided_by);
    if (deciders.includes(user.id)) throw forbidden('You decided a removal of this review; another administrator signs it off');
    if (!isAdmin(user)) {
      for (const x of c.payload.removals || []) {
        if (await isAdminAccount(db, x.userId)) throw forbidden('A removal of an administrator account is signed off by a System Administrator');
      }
    }
  },
  apply: async (db, c, user) => {
    const items = (await db.query(`SELECT * FROM access_review_items WHERE review_id = $1 AND decision IN ('remove-roles', 'deactivate') AND applied_at IS NULL FOR UPDATE`,
      [c.payload.reviewId])).rows;
    for (const item of items) await applyRemoval(db, item, user);
    await db.query(`UPDATE access_reviews SET status = 'closed', signed_off_by = $2, signed_off_at = now(), closed_by = $2, closed_at = now() WHERE id = $1`,
      [c.payload.reviewId, user.id]);
    return { audit: { entity: 'access_review', entityId: String(c.payload.reviewId), action: 'sign-off', after: { change: c.id, applied: items.length } } };
  },
  closed: async (db, c) => {
    await db.query(`UPDATE access_reviews SET status = 'open', change_id = NULL WHERE id = $1 AND status = 'awaiting-signoff'`, [c.payload.reviewId]);
  },
  requested: (c, user) => `${user.username} submitted the access review ${c.payload?.name} for sign-off: ${(c.payload?.removals || []).length} removal(s)`,
  applied: (c) => `the access review ${c.payload?.name} is signed off and closed${(c.payload?.removals || []).length ? '; its removals are applied' : ''}`,
});

// ---------------------------------------------------------------- export for audit

const col = (header, width = 20, type = 'text') => ({ header, width, type });

/** One sheet of the reviews (list page). */
export async function reviewListSheets(db, fmt) {
  const list = await listReviews(db);
  const d = (v) => (v ? formatDate(v, fmt) : '');
  const dt = (v) => (v ? formatDateTime(v, fmt) : '');
  return [{ name: 'Access reviews', columns: [col('Review', 34), col('Scope', 34), col('Due', 12), col('Status', 20), col('Overdue', 10), col('Users', 10, 'integer'),
    col('To review', 10, 'integer'), col('Kept', 10, 'integer'), col('Removals', 10, 'integer'), col('Applied', 10, 'integer'), col('Started by', 22), col('Started at', 18),
    col('Submitted by', 22), col('Submitted at', 18), col('Signed off by', 22), col('Signed off at', 18), col('Closed at', 18)],
  rows: list.map((r) => [r.name, r.scopeText, d(r.dueDate), STATUS_WORDS[r.status], r.overdue ? 'Yes' : 'No', r.users, r.pending, r.kept, r.removals, r.applied,
    r.createdBy || '', dt(r.createdAt), r.submittedBy || '', dt(r.submittedAt), r.signedOffBy || '', dt(r.signedOffAt), dt(r.closedAt)]) }];
}

/** Workbook of one review: Summary and Users (role codes added with technical names). */
export async function reviewSheets(db, id, user, fmt, { technical = false } = {}) {
  const r = await getReview(db, id, user);
  const d = (v) => (v ? formatDate(v, fmt) : '');
  const dt = (v) => (v ? formatDateTime(v, fmt) : '');
  const summary = [['Review', r.name], ['Scope', r.scopeText], ['Started by', `${r.createdBy || ''} · ${dt(r.createdAt)}`], ['Due', d(r.dueDate)],
    ['Status', STATUS_WORDS[r.status]], ['Submitted by', r.submittedBy ? `${r.submittedBy} · ${dt(r.submittedAt)}` : ''],
    ['Signed off by', r.signedOffBy ? `${r.signedOffBy} · ${dt(r.signedOffAt)}` : ''], ['Returned', r.change?.status === 'rejected' ? `${r.change.decidedBy}: ${r.change.decisionRemarks}` : ''],
    ['Users', r.users], ['Keep access', r.kept], ['Remove roles', r.removeRoles], ['Deactivate account', r.deactivate], ['Removals applied', r.applied]];
  const codes = technical ? [col('Roles at start (codes)', 30), col('Roles removed (codes)', 30)] : [];
  return [
    { name: 'Summary', columns: [col('Item', 24), col('Value', 60)], rows: summary.map(([a, b]) => [a, String(b ?? '')]) },
    { name: 'Users', columns: [col('Department', 22), col('User', 28), col('Username', 20), col('Designation', 22), col('Branch', 20), col('Roles at start', 44),
      col('Roles now', 44), col('Last sign-in', 18), col('Dormant', 10), col('Segregation of duties', 40), col('Outcome', 18), col('Roles removed', 34), col('Reason or note', 44),
      col('Decided by', 22), col('Decided at', 18), col('Applied by', 22), col('Applied at', 18), col('Applied note', 26), ...codes],
    rows: r.items.map((i) => [i.department || 'Other', i.displayName, i.username, i.designation || '', i.branchName || i.branch || '', i.roleNamesAtStart.join(', '),
      i.roleNamesNow.join(', '), i.lastLoginAt ? dt(i.lastLoginAt) : 'Never', i.dormant ? 'Yes' : 'No',
      i.conflicts.map((c) => `${c.ruleName} (${c.state === 'accepted' ? `accepted until ${d(c.validUntil)}` : c.state})`).join('; '), OUTCOME_WORDS[i.decision],
      i.removeRoleNames.join(', '), i.remarks || '', i.decidedBy || '', dt(i.decidedAt), i.appliedBy || '', dt(i.appliedAt), i.applyNote || '',
      ...(technical ? [i.rolesAtStart.join(', '), i.removeRoles.join(', ')] : [])]) },
  ];
}
