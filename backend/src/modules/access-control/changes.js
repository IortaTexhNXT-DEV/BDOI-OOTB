/**
 * Changes of access waiting for approval (maker-checker), kept in the configuration approval table
 * accounting_config_changes beside the accounting changes of posting-rules/service.js, which leaves these kinds alone.
 *
 * A change is requested by one administrator and approved (applied) or rejected by a different user holding
 * approve:access-control, whatever finance.maker_checker_enabled says; the requester or an approver may withdraw it.
 * One change per kind and target waits at a time. access.change_approval (on by default) switches the approval off for
 * a small team: the change is then applied at once by the module that requests it.
 *
 * Each kind registers its handler (registerAccessKind): label, screen link, business summary, the extra checks on the
 * person deciding, what approving it applies, what a rejection or a withdrawal undoes and, optionally, the words of
 * its notifications. Kinds: role-access (roleAccess.js), authority-limits (authority.js), delegation (delegations.js),
 * sod-rule and sod-exception (sod.js), access-review (reviews.js).
 */
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { hasPermission } from '../../lib/auth.js';
import { notifyApprovers } from '../notifications/approvals.js';

const KINDS = new Map();
export const APPROVER = 'approve:access-control';

/**
 * handler: { label, link(change) -> screen path, describe(db, row) -> { targetLabel, summary: [lines] },
 * assertDecider(db, row, user) (throws when this user may not decide it), apply(db, row, user) -> result,
 * closed(db, row, status, user) (a rejection or a withdrawal; optional), requested(change, user) -> text of the approval
 * request, applied(change) -> what approving it did }
 */
export function registerAccessKind(kind, handler) {
  KINDS.set(kind, handler);
}
export const accessKinds = () => [...KINDS.keys()];

/** Whether changes of access wait for another administrator's approval (access.change_approval). */
export const changeApproval = async () => (await getSetting('access.change_approval', true)) !== false;

const kindOf = (kind) => {
  const k = KINDS.get(kind);
  if (!k) throw notFound('Access change not found');
  return k;
};

const SELECT = `SELECT c.*, rq.display_name AS requested_by_name, dc.display_name AS decided_by_name FROM accounting_config_changes c
  LEFT JOIN users rq ON rq.id = c.requested_by LEFT JOIN users dc ON dc.id = c.decided_by`;

const mayApprove = (user) => hasPermission(user, APPROVER);

async function changeOut(db, c, user) {
  const k = kindOf(c.kind);
  const { targetLabel, summary } = await k.describe(db, c);
  const pending = c.status === 'pending';
  let canDecide = pending && !!user && mayApprove(user) && c.requested_by !== user.id;
  if (canDecide && k.assertDecider) canDecide = await k.assertDecider(db, c, user).then(() => true, () => false);
  return {
    id: Number(c.id), ref: `CFG-${c.id}`, kind: c.kind, kindLabel: k.label, target: c.target, targetLabel, summary, payload: c.payload, before: c.before,
    changeNote: c.change_note, status: c.status, requestedBy: c.requested_by_name || c.requested_by, requestedById: c.requested_by, requestedAt: c.requested_at,
    decidedBy: c.decided_by_name || c.decided_by, decidedAt: c.decided_at, decisionRemarks: c.decision_remarks, link: k.link(c),
    canDecide, canWithdraw: pending && !!user && (c.requested_by === user.id || mayApprove(user)),
  };
}

/** Record a change waiting for approval; 409 when one of the same kind and target is already waiting. */
export async function requestAccessChange(db, { kind, target, payload, before = null, note = null, user }) {
  kindOf(kind);
  const open = (await db.query("SELECT id FROM accounting_config_changes WHERE kind = $1 AND target = $2 AND status = 'pending'", [kind, target])).rows[0];
  if (open) throw conflict(`A change is already waiting for approval (request CFG-${open.id}); approve, reject or withdraw it first`);
  const { rows } = await db.query(`INSERT INTO accounting_config_changes(kind, target, payload, before, change_note, requested_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [kind, target, JSON.stringify(payload || {}), before === null ? null : JSON.stringify(before), note || null, user?.id ?? null]);
  return getAccessChange(db, rows[0].id, user);
}

export async function getAccessChange(db, id, user) {
  const c = (await db.query(`${SELECT} WHERE c.id = $1 AND c.kind = ANY($2)`, [Number(id) || 0, accessKinds()])).rows[0];
  if (!c) throw notFound('Access change not found');
  return changeOut(db, c, user);
}

/** Access changes, newest first: status pending by default (approved, rejected, withdrawn or all), a kind, a target. */
export async function listAccessChanges(db, { kind = null, status = 'pending', target = null } = {}, user = null) {
  const kinds = kind ? [kind].filter((k) => KINDS.has(k)) : accessKinds();
  const { rows } = await db.query(`${SELECT} WHERE c.kind = ANY($1) AND ($2 = 'all' OR c.status = $2) AND ($3::text IS NULL OR c.target = $3)
    ORDER BY c.requested_at DESC, c.id DESC LIMIT 500`, [kinds, status || 'pending', target || null]);
  const out = [];
  for (const c of rows) out.push(await changeOut(db, c, user));
  return out;
}

const lock = async (db, id) => {
  const c = (await db.query('SELECT * FROM accounting_config_changes WHERE id = $1 AND kind = ANY($2) FOR UPDATE', [Number(id) || 0, accessKinds()])).rows[0];
  if (!c) throw notFound('Access change not found');
  if (c.status !== 'pending') throw conflict(`Request CFG-${c.id} is already ${c.status}`);
  return c;
};

/**
 * Approve (the kind applies the change) or reject (remarks required) a waiting change. The approver holds
 * approve:access-control (checked by the route) and is never the requester. Returns { change, result }.
 */
export async function decideAccessChange(db, id, { decision, remarks }, user) {
  const c = await lock(db, id);
  const k = kindOf(c.kind);
  await assertChecker(user, c.requested_by, 'change of access', { configurable: false });
  if (k.assertDecider) await k.assertDecider(db, c, user);
  let result = null;
  if (decision === 'reject') {
    if (!String(remarks || '').trim()) throw badRequest('Validation failed', [{ path: 'remarks', message: 'Give the reason for rejecting the change' }]);
    if (k.closed) await k.closed(db, c, 'rejected', user);
  } else {
    result = await k.apply(db, c, user);
  }
  await db.query('UPDATE accounting_config_changes SET status = $2, decided_by = $3, decided_at = now(), decision_remarks = $4 WHERE id = $1',
    [c.id, decision === 'approve' ? 'approved' : 'rejected', user?.id ?? null, String(remarks || '').trim() || null]);
  return { change: await getAccessChange(db, c.id, user), result };
}

/** "Role access change CFG-12 awaiting approval" to the users who may approve it (after the request has committed). */
export const askAccessApproval = (c, user) => notifyApprovers({ audience: APPROVER, document: `${c.kindLabel} change`, number: c.ref, by: user.username,
  message: KINDS.get(c.kind)?.requested?.(c, user)
    || `${user.username} requested a change of the access of ${c.targetLabel}: ${c.summary.join('; ')}${c.changeNote ? ` (${c.changeNote})` : ''}`,
  link: c.link, entity: 'accounting_config_change', entityId: c.id });

/** What approving a change did, for the requester and the screen: "the access of TIS Finance is changed". */
export const appliedText = (c) => KINDS.get(c.kind)?.applied?.(c) || `the access of ${c.targetLabel} is changed`;

/** Withdraw a waiting change: the requester, or a user who may approve it. */
export async function withdrawAccessChange(db, id, user) {
  const c = await lock(db, id);
  if (c.requested_by !== user?.id && !mayApprove(user)) throw forbidden('Only the requester or an approver can withdraw the change');
  if (KINDS.get(c.kind).closed) await KINDS.get(c.kind).closed(db, c, 'withdrawn', user);
  await db.query("UPDATE accounting_config_changes SET status = 'withdrawn', decided_by = $2, decided_at = now() WHERE id = $1", [c.id, user?.id ?? null]);
  return getAccessChange(db, c.id, user);
}
