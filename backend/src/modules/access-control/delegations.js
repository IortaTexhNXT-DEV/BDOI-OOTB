/**
 * Delegations (Master > Users and Access > Delegations): an approver who is away lends his or her approval authority
 * for chosen transactions and dates to the person who covers.
 *
 * A delegation lends a limit, not the access to the approval step: the approver away must be able to approve each
 * transaction, and the person covering must already reach its approval step (AUTHORITY_STEPS). It never lowers the
 * authority of the person covering (service.effectiveAuthority). Dates are business dates (lib/dates today()).
 *
 * With access.change_approval (on by default) a new delegation is a change of kind delegation in the configuration
 * approval (changes.js): it applies once a different user holding approve:access-control approves it, never the
 * person covering. Without it the delegation is recorded at once, and nobody records a delegation to himself or
 * herself. Ending a delegation early only reduces access and applies at once (with a reason).
 */
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { formatDate, formatDateTime } from '../../lib/pdf/format.js';
import { requiredReason } from '../ops-masters/records.js';
import { AUTHORITY_STEPS, approvalsByUser } from './authority.js';
import { changeApproval, listAccessChanges, registerAccessKind, requestAccessChange } from './changes.js';
import { departmentOf, roleDirectory } from './roles.js';
import { effectiveAuthority, ownLimit, transactionTypes } from './service.js';

export const KIND = 'delegation';
export const DELEGATIONS_PATH = '/master/generals/usermanagement/delegations';
const EDIT = 'write:access-control';
export const VIEWS = ['current', 'pending', 'ended', 'all'];
const IN_VIEW = {
  current: ['scheduled', 'in-effect'],
  pending: ['pending'],
  ended: ['ended', 'ended-early', 'rejected', 'withdrawn'],
};
export const STATUS_WORDS = { pending: 'Waiting for approval', scheduled: 'Scheduled', 'in-effect': 'In effect', ended: 'Ended', 'ended-early': 'Ended early',
  rejected: 'Rejected', withdrawn: 'Withdrawn' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
const uniq = (list) => [...new Set((list || []).map(String))];

/** The transaction types an approval step checks (the only ones a delegation can lend), active ones in order. */
async function checkedTypes(db) {
  return (await transactionTypes(db, { activeOnly: true })).filter((t) => AUTHORITY_STEPS[t.code]).map((t) => ({ ...t, step: AUTHORITY_STEPS[t.code].step }));
}

const authorityOut = (a) => ({ set: !!a.found, limit: a.limit ?? null, unlimited: !!a.unlimited, source: a.source || null });

/** Active users with their department, roles and the transactions they can approve. One query after the other. */
async function people(db) {
  const dir = await roleDirectory(db);
  const approvals = await approvalsByUser(db);
  const { rows } = await db.query(`SELECT u.id, u.username, u.display_name AS name, u.designation,
      COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS roles
    FROM users u WHERE u.status = 'active' ORDER BY u.display_name`);
  const byCode = new Map(dir.roles.map((r) => [r.code, r]));
  return {
    dir,
    list: rows.map((u) => ({
      id: u.id, username: u.username, name: u.name, designation: u.designation, roles: u.roles, roleNames: u.roles.map((c) => byCode.get(c)?.name || c),
      platformOnly: u.roles.length > 0 && u.roles.every((c) => byCode.get(c)?.platform), department: departmentOf(dir, u.roles), approves: approvals.get(u.id) || [],
    })),
  };
}

/**
 * What the New delegation panel offers: the checked transactions, every active person with the transactions he or she
 * can approve (and the authority today for each), the departments, the longest delegation and the business date.
 */
export async function delegationOptions(db) {
  const day = await today();
  const types = await checkedTypes(db);
  const { dir, list } = await people(db);
  for (const p of list) {
    p.authority = {};
    for (const t of p.approves) p.authority[t] = authorityOut(await effectiveAuthority(db, p.id, t, day));
  }
  return { asOf: day, maxDays: Number(await getSetting('access.delegation_max_days', 90)) || 90, approval: await changeApproval(),
    withoutLimit: String(await getSetting('access.authority_without_limit', 'allow')), departments: dir.departments, types, people: list };
}

/**
 * The authority of the person covering per transaction with the delegation and without it: { transactionType, name,
 * measure, lent (the approver's own limit), before, after, changes }. A delegation never lowers authority.
 */
export async function previewDelegation(db, b) {
  const day = await today();
  const types = await checkedTypes(db);
  const from = b.dateFrom && DATE.test(b.dateFrom) && b.dateFrom > day ? b.dateFrom : day;
  const restrictedWithout = String(await getSetting('access.authority_without_limit', 'allow')) === 'refuse';
  const out = [];
  for (const t of types.filter((x) => uniq(b.transactionTypes).includes(x.code))) {
    const lent = b.delegatorId ? await ownLimit(db, b.delegatorId, t.code, from) : { found: false };
    const before = b.delegateId ? await effectiveAuthority(db, b.delegateId, t.code, from) : { found: false };
    let after = before;
    const restricted = before.found || restrictedWithout;
    if (lent.found && restricted && !before.unlimited && (lent.limit === null || !before.found || lent.limit > before.limit)) {
      after = { found: true, limit: lent.limit, unlimited: lent.limit === null, source: 'delegated' };
    }
    out.push({ transactionType: t.code, name: t.name, measure: t.measure, lent: authorityOut(lent), before: authorityOut(before), after: authorityOut(after),
      changes: after !== before });
  }
  return { asOf: from, lines: out };
}

/** The authority of a person on a date for every checked transaction, delegations included, and whether the step is reached. */
export async function userAuthority(db, userId, onDate = null) {
  const day = onDate && DATE.test(onDate) ? onDate : await today();
  const approvals = await approvalsByUser(db);
  const reach = approvals.get(userId) || [];
  const out = [];
  for (const t of await checkedTypes(db)) {
    out.push({ transactionType: t.code, name: t.name, measure: t.measure, step: t.step, canApprove: reach.includes(t.code),
      ...authorityOut(await effectiveAuthority(db, userId, t.code, day)) });
  }
  return { asOf: day, lines: out };
}

// ---------------------------------------------------------------- list

const ROW_SELECT = `SELECT d.id, d.delegator_id, a.display_name AS delegator_name, d.delegate_id, b.display_name AS delegate_name, d.transaction_types,
    to_char(d.date_from, 'YYYY-MM-DD') AS date_from, to_char(d.date_to, 'YYYY-MM-DD') AS date_to, d.reason, d.reason_code, d.status, d.change_id,
    COALESCE(c.display_name, d.created_by) AS requested_by, d.created_at AS requested_at, ap.display_name AS approved_by, d.approved_at,
    rv.display_name AS ended_by, d.revoked_at AS ended_at, d.end_reason, d.end_reason_code
  FROM user_delegations d JOIN users a ON a.id = d.delegator_id JOIN users b ON b.id = d.delegate_id LEFT JOIN users c ON c.id = d.created_by
  LEFT JOIN users ap ON ap.id = d.approved_by LEFT JOIN users rv ON rv.id = d.revoked_by`;

const rowStatus = (d, day) => {
  if (d.status === 'revoked') return 'ended-early';
  if (d.date_to < day) return 'ended';
  return d.date_from > day ? 'scheduled' : 'in-effect';
};

/**
 * Delegations and the requests not (yet) in effect, newest period first. view: current (scheduled and in effect,
 * the default), pending, ended (ended, ended early, rejected, withdrawn) or all.
 */
export async function listDelegations(db, { view = 'current' } = {}, user = null) {
  const day = await today();
  const types = new Map((await transactionTypes(db)).map((t) => [t.code, t.name]));
  const dir = await roleDirectory(db);
  const { rows } = await db.query(ROW_SELECT);
  const roles = new Map((await db.query(`SELECT ur.user_id, array_agg(r.code) AS roles FROM user_roles ur JOIN roles r ON r.id = ur.role_id GROUP BY ur.user_id`)).rows
    .map((r) => [r.user_id, r.roles]));
  const dept = (id) => departmentOf(dir, roles.get(id));
  const edit = !!user && hasPermission(user, EDIT);
  const names = (codes) => (codes.length ? codes.map((c) => types.get(c) || c) : ['All transactions']);
  const list = rows.map((d) => {
    const status = rowStatus(d, day);
    return {
      key: `D-${d.id}`, id: Number(d.id), changeId: d.change_id === null ? null : Number(d.change_id), ref: d.change_id ? `CFG-${d.change_id}` : `DLG-${d.id}`,
      delegatorId: d.delegator_id, delegatorName: d.delegator_name, delegatorDepartment: dept(d.delegator_id), delegateId: d.delegate_id, delegateName: d.delegate_name,
      delegateDepartment: dept(d.delegate_id), transactionTypes: d.transaction_types, transactionNames: names(d.transaction_types), dateFrom: d.date_from, dateTo: d.date_to,
      days: days(d.date_from, d.date_to), reasonCode: d.reason_code, reason: d.reason, status, requestedBy: d.requested_by, requestedAt: d.requested_at,
      approvedBy: d.approved_by, approvedAt: d.approved_at, endedBy: d.ended_by, endedAt: d.ended_at, endReason: d.end_reason, endReasonCode: d.end_reason_code,
      change: null, canEnd: edit && ['scheduled', 'in-effect'].includes(status),
    };
  });
  const changes = await listAccessChanges(db, { kind: KIND, status: 'all' }, user);
  for (const c of changes.filter((x) => x.status !== 'approved')) {
    const p = c.payload || {};
    list.push({
      key: c.ref, id: null, changeId: c.id, ref: c.ref, delegatorId: p.delegatorId, delegatorName: p.delegatorName, delegatorDepartment: dept(p.delegatorId),
      delegateId: p.delegateId, delegateName: p.delegateName, delegateDepartment: dept(p.delegateId), transactionTypes: p.transactionTypes || [],
      transactionNames: names(p.transactionTypes || []), dateFrom: p.dateFrom, dateTo: p.dateTo, days: days(p.dateFrom, p.dateTo), reasonCode: p.reasonCode, reason: p.reason,
      status: c.status, requestedBy: c.requestedBy, requestedAt: c.requestedAt, approvedBy: null, approvedAt: null, endedBy: c.status === 'pending' ? null : c.decidedBy,
      endedAt: c.status === 'pending' ? null : c.decidedAt, endReason: c.decisionRemarks, endReasonCode: null, change: c, canEnd: false,
    });
  }
  const wanted = view === 'all' ? null : IN_VIEW[view] || IN_VIEW.current;
  const counts = Object.fromEntries(Object.entries(IN_VIEW).map(([v, statuses]) => [v, list.filter((d) => statuses.includes(d.status)).length]));
  counts.all = list.length;
  return {
    asOf: day, approval: await changeApproval(), counts,
    rows: list.filter((d) => !wanted || wanted.includes(d.status)).sort((a, b) => String(b.dateFrom).localeCompare(String(a.dateFrom)) || String(b.key).localeCompare(String(a.key))),
  };
}

// ---------------------------------------------------------------- request, approve, end

/**
 * Check a delegation before it is requested and again before it applies: dates (from today, at most
 * access.delegation_max_days), two active people, transactions the approver away can approve and whose approval step
 * the person covering reaches, no other delegation of the approver away for the same days and transactions (approved
 * or waiting), and the person covering not away himself or herself. Field problems: 400; overlaps: 409.
 */
async function assertDelegation(db, b, { exceptChange = null } = {}) {
  const day = await today();
  const errors = [];
  if (!b.delegatorId) errors.push({ path: 'delegatorId', message: 'Choose the approver who is away' });
  if (!b.delegateId) errors.push({ path: 'delegateId', message: 'Choose the person who covers' });
  if (b.delegatorId && b.delegatorId === b.delegateId) errors.push({ path: 'delegateId', message: 'A person cannot cover for himself or herself' });
  const max = Number(await getSetting('access.delegation_max_days', 90)) || 90;
  if (!DATE.test(b.dateFrom || '')) errors.push({ path: 'dateFrom', message: 'Enter the first day' });
  else if (b.dateFrom < day) errors.push({ path: 'dateFrom', message: 'A delegation cannot start in the past' });
  if (!DATE.test(b.dateTo || '')) errors.push({ path: 'dateTo', message: 'Enter the last day' });
  else if (DATE.test(b.dateFrom || '') && b.dateTo < b.dateFrom) errors.push({ path: 'dateTo', message: 'The last day is before the first day' });
  else if (DATE.test(b.dateFrom || '') && days(b.dateFrom, b.dateTo) > max) errors.push({ path: 'dateTo', message: `A delegation lasts at most ${max} days` });
  if (errors.length) throw badRequest('Validation failed', errors);

  const users = new Map((await db.query('SELECT id, display_name, status FROM users WHERE id = ANY($1)', [[b.delegatorId, b.delegateId]])).rows.map((u) => [u.id, u]));
  if (users.get(b.delegatorId)?.status !== 'active') errors.push({ path: 'delegatorId', message: 'The approver away must have an active account' });
  if (users.get(b.delegateId)?.status !== 'active') errors.push({ path: 'delegateId', message: 'The person covering must have an active account' });
  if (errors.length) throw badRequest('Validation failed', errors);

  const types = await checkedTypes(db);
  const approvals = await approvalsByUser(db);
  const away = approvals.get(b.delegatorId) || [];
  const cover = approvals.get(b.delegateId) || [];
  const chosen = uniq(b.transactionTypes).length ? uniq(b.transactionTypes) : away;
  if (!chosen.length) throw badRequest('Validation failed', [{ path: 'delegatorId', message: `${users.get(b.delegatorId).display_name} cannot approve any transaction checked by the Authority Matrix` }]);
  const name = (code) => types.find((t) => t.code === code)?.name || code;
  for (const t of chosen) {
    if (!types.some((x) => x.code === t)) errors.push({ path: 'transactionTypes', message: `${t} is not a transaction an approval step checks` });
    else if (!away.includes(t)) errors.push({ path: 'transactionTypes', message: `${users.get(b.delegatorId).display_name} cannot approve ${name(t)}` });
    else if (!cover.includes(t)) errors.push({ path: 'delegateId', message: `${users.get(b.delegateId).display_name} cannot approve ${name(t)}: the approval step needs access he or she does not have` });
  }
  if (errors.length) throw badRequest('Validation failed', errors);

  const overlap = (await db.query(`SELECT 'DLG-' || id AS ref FROM user_delegations WHERE delegator_id = $1 AND status = 'active' AND date_from <= $3::date AND date_to >= $2::date
      AND (cardinality(transaction_types) = 0 OR transaction_types && $4::text[])
    UNION ALL SELECT 'CFG-' || id FROM accounting_config_changes WHERE kind = $5 AND status = 'pending' AND id IS DISTINCT FROM $6 AND payload->>'delegatorId' = $1
      AND (payload->>'dateFrom')::date <= $3::date AND (payload->>'dateTo')::date >= $2::date
      AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(payload->'transactionTypes') t WHERE t = ANY($4::text[])) LIMIT 1`,
  [b.delegatorId, b.dateFrom, b.dateTo, chosen, KIND, exceptChange])).rows[0];
  if (overlap) throw conflict(`${users.get(b.delegatorId).display_name} already has a delegation for some of these days and transactions (${overlap.ref})`);
  const awayToo = (await db.query(`SELECT 'DLG-' || id AS ref FROM user_delegations WHERE delegator_id = $1 AND status = 'active' AND date_from <= $3::date AND date_to >= $2::date
    UNION ALL SELECT 'CFG-' || id FROM accounting_config_changes WHERE kind = $4 AND status = 'pending' AND id IS DISTINCT FROM $5 AND payload->>'delegatorId' = $1
      AND (payload->>'dateFrom')::date <= $3::date AND (payload->>'dateTo')::date >= $2::date LIMIT 1`, [b.delegateId, b.dateFrom, b.dateTo, KIND, exceptChange])).rows[0];
  if (awayToo) throw conflict(`${users.get(b.delegateId).display_name} is away during these days (${awayToo.ref}); choose another person to cover`);
  return { types: chosen, names: chosen.map(name), delegatorName: users.get(b.delegatorId).display_name, delegateName: users.get(b.delegateId).display_name };
}

/** "Chrystal Malinay covers Journal voucher approval for Mariela Valentino from 12/10/2026 to 16/10/2026 (5 days)". */
export const delegationText = (p) => `${p.delegateName} covers ${(p.transactionNames || []).join(', ')} for ${p.delegatorName} from ${formatDate(p.dateFrom)} to ${formatDate(p.dateTo)}`
  + ` (${days(p.dateFrom, p.dateTo)} day${days(p.dateFrom, p.dateTo) === 1 ? '' : 's'})`;

async function insertDelegation(db, p, { requestedBy, changeId = null, approvedBy = null }) {
  const { rows } = await db.query(`INSERT INTO user_delegations(delegator_id, delegate_id, transaction_types, date_from, date_to, reason, reason_code, created_by, change_id,
      approved_by, approved_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $10::text IS NULL THEN NULL ELSE now() END) RETURNING id`,
  [p.delegatorId, p.delegateId, p.transactionTypes, p.dateFrom, p.dateTo, p.reason, p.reasonCode, requestedBy, changeId, approvedBy]);
  return Number(rows[0].id);
}

/**
 * Request a delegation: { delegatorId, delegateId, transactionTypes (empty = every transaction the approver away can
 * approve), dateFrom, dateTo, reasonCode, note }. With approval: { change } (201); without: { delegation }.
 */
export async function requestDelegation(db, b, user) {
  const ok = await assertDelegation(db, b);
  const reason = await requiredReason(db, 'delegation', b);
  const payload = { delegatorId: b.delegatorId, delegatorName: ok.delegatorName, delegateId: b.delegateId, delegateName: ok.delegateName, transactionTypes: ok.types,
    transactionNames: ok.names, dateFrom: b.dateFrom, dateTo: b.dateTo, reasonCode: reason.code, reason: reason.text, note: reason.note };
  payload.title = delegationText(payload);
  if (await changeApproval()) {
    const change = await requestAccessChange(db, { kind: KIND, target: `${b.delegatorId}:${b.delegateId}:${b.dateFrom}`, payload, note: reason.text, user });
    return { change, delegation: null };
  }
  if (b.delegateId === user.id) throw forbidden('You cannot record a delegation to yourself; another administrator records it');
  const id = await insertDelegation(db, payload, { requestedBy: user.id });
  return { change: null, delegation: (await listDelegations(db, { view: 'all' }, user)).rows.find((d) => d.id === id) };
}

/** End a delegation before its last day (reason of delegation_end): it stops at once; it only reduces access. */
export async function endDelegation(db, id, b, user) {
  const d = (await db.query(`${ROW_SELECT} WHERE d.id = $1 FOR UPDATE OF d`, [Number(id) || 0])).rows[0];
  if (!d) throw notFound('Delegation not found');
  const status = rowStatus(d, await today());
  if (!['scheduled', 'in-effect'].includes(status)) throw conflict(`This delegation is already ${STATUS_WORDS[status].toLowerCase()}`);
  const reason = await requiredReason(db, 'delegation_end', b);
  await db.query(`UPDATE user_delegations SET status = 'revoked', revoked_by = $2, revoked_at = now(), end_reason_code = $3, end_reason = $4 WHERE id = $1`,
    [d.id, user.id, reason.code, reason.text]);
  const out = (await listDelegations(db, { view: 'all' }, user)).rows.find((x) => x.id === Number(d.id));
  return { delegation: out, before: { status }, notices: [d.delegator_id, d.delegate_id].map((userId) => ({ userId, document: 'Delegation', number: `DLG-${d.id}`,
    status: 'ended', message: `${d.delegate_name} no longer covers for ${d.delegator_name}: ${reason.text}` })) };
}

registerAccessKind(KIND, {
  label: 'Delegation',
  link: (c) => `${DELEGATIONS_PATH}?view=pending&change=${c.id}`,
  describe: async (_db, c) => ({ targetLabel: `${c.payload?.delegatorName} · ${c.payload?.delegateName}`,
    summary: [c.payload?.title || delegationText(c.payload || {}), c.payload?.reason ? `Reason: ${c.payload.reason}` : null].filter(Boolean) }),
  assertDecider: async (_db, c, user) => {
    if (c.payload?.delegateId === user.id) throw forbidden('The person covering cannot approve the delegation');
  },
  apply: async (db, c, user) => {
    const p = c.payload;
    if (p.dateTo < (await today())) throw conflict('The period of this delegation has ended; reject it');
    const ok = await assertDelegation(db, { ...p, dateFrom: p.dateFrom < (await today()) ? await today() : p.dateFrom }, { exceptChange: c.id });
    const id = await insertDelegation(db, { ...p, transactionTypes: ok.types }, { requestedBy: c.requested_by, changeId: c.id, approvedBy: user.id });
    return {
      audit: { entity: 'user_delegation', entityId: String(id), action: 'approve', after: { ...p, id, change: c.id } },
      notices: [p.delegatorId, p.delegateId].map((userId) => ({ userId, document: 'Delegation', number: `DLG-${id}`, status: 'approved', message: `${p.title}, approved by ${user.username}` })),
    };
  },
  requested: (c, user) => `${user.username} requested a delegation: ${c.summary.join('; ')}`,
  applied: (c) => `${c.payload?.delegateName} covers for ${c.payload?.delegatorName} from ${formatDate(c.payload?.dateFrom)}`,
});

// ---------------------------------------------------------------- export for audit

export const DELEGATION_HEADER = ['Reference', 'Approver away', 'Department', 'Covered by', 'Department of the person covering', 'Transactions', 'From', 'To', 'Days',
  'Reason', 'Status', 'Requested by', 'Requested at', 'Approved by', 'Approved at', 'Ended or decided by', 'Ended or decided at', 'End or decision reason'];

export const delegationRows = (list, fmt, { technical = false } = {}) => list.map((d) => [d.ref, d.delegatorName, d.delegatorDepartment || '', d.delegateName,
  d.delegateDepartment || '', d.transactionNames.join(', '), formatDate(d.dateFrom, fmt), formatDate(d.dateTo, fmt), d.days, d.reason || '', STATUS_WORDS[d.status] || d.status,
  d.requestedBy || '', d.requestedAt ? formatDateTime(d.requestedAt, fmt) : '', d.approvedBy || '', d.approvedAt ? formatDateTime(d.approvedAt, fmt) : '', d.endedBy || '',
  d.endedAt ? formatDateTime(d.endedAt, fmt) : '', d.endReason || '', ...(technical ? [d.transactionTypes.join(', '), d.reasonCode || ''] : [])]);

export const delegationColumns = ({ technical = false } = {}) => [...DELEGATION_HEADER, ...(technical ? ['Transaction codes', 'Reason code'] : [])]
  .map((header) => ({ header, width: header === 'Days' ? 8 : Math.max(14, Math.min(44, header.length + 10)), type: header === 'Days' ? 'integer' : 'text' }));
