/**
 * My Work > My Tasks: the work diary. A task belongs to its assignee; it can be created by the assignee, by a manager
 * of the assignee (users.reporting_to, any depth) or automatically from a follow-up date on another record
 * (syncAutoTasks). Who may do what:
 *   see / edit / complete   the assignee, the creator, a manager of the assignee, an administrator
 *   reassign                the creator, a manager of the assignee, an administrator; only to themselves or their team
 *   cancel (DELETE)         the creator or a manager of the assignee (manual and assigned tasks; follow-ups are completed)
 */
import { pool } from '../../db/pool.js';
import { badRequest, forbidden, notFound, conflict } from '../../lib/errors.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { today as businessToday, addDays } from '../../lib/dates.js';
import { scopeSql } from '../../lib/scope.js';
import { notify } from '../notifications/service.js';
import { teamIds, assignableUsers } from './team.js';

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
export const STATUSES = ['open', 'done', 'cancelled'];
export const SOURCE_LABELS = { manual: 'Own task', manager: 'Assigned by manager', collection: 'Collection follow-up', renewal: 'Renewal follow-up', claim: 'Claim follow-up' };
const AUTO_SOURCES = ['collection', 'renewal', 'claim'];
const DEFAULT_TIME = '09:00';

/** Records a task can be related to: table, document number, label, front-end link, permission and record scope. */
export const RELATED = {
  client: { table: 'clients', ref: 'x.client_code', label: 'x.display_name', link: '/agent/clientview/', permission: 'read:clients', scope: 'client' },
  lead: { table: 'leads', ref: 'x.lead_number', label: 'x.display_name', link: '/agent/leaddetail/', permission: 'read:leads', scope: 'lead' },
  policy: { table: 'policies', ref: 'x.policy_number', label: 'COALESCE((SELECT c.display_name FROM clients c WHERE c.id = x.client_id), x.insured_name)', link: '/agent/policydetail/', permission: 'read:policies', scope: 'policy' },
  quote: { table: 'quotes', ref: 'x.quote_number', label: 'COALESCE((SELECT c.display_name FROM clients c WHERE c.id = x.client_id), (SELECT l.display_name FROM leads l WHERE l.id = x.lead_id))', link: '/agent/quotedetailview/', permission: 'read:quotations', scope: 'quote' },
  claim: { table: 'claims', ref: 'x.claim_number', label: '(SELECT c.display_name FROM clients c WHERE c.id = x.client_id)', link: '/agent/claimdetail/', permission: 'read:claims', scope: 'claim' },
  renewal: { table: 'renewals', ref: 'x.renewal_number', label: '(SELECT p.policy_number FROM policies p WHERE p.id = x.policy_id)', link: '/renewal/queue', fixedLink: true, permission: 'read:renewals', scope: 'renewal' },
  endorsement: { table: 'endorsements', ref: 'x.endorsement_number', label: '(SELECT p.policy_number FROM policies p WHERE p.id = x.policy_id)', link: '/agent/endorsementdetailedview/', permission: 'read:endorsements', scope: 'endorsement' },
  placement: { table: 'placements', ref: 'x.placement_number', label: 'x.insured_name', link: '/placement/placement-slips/', permission: 'read:quotations', scope: 'placement' },
  broker_slip: { table: 'broker_slips', ref: 'x.slip_number', label: 'x.insured_name', link: '/placement/broker-slips/', permission: 'read:quotations', scope: 'broker_slip' },
  collection: { table: 'collection_items', ref: '(SELECT r.bill_number FROM receivables r WHERE r.id = x.receivable_id)', label: '(SELECT c.display_name FROM clients c WHERE c.id = x.client_id)', link: '/agent/collections/', permission: 'read:collections', scope: null },
};
const linkOf = (entity, id) => (RELATED[entity] ? (RELATED[entity].fixedLink ? RELATED[entity].link : `${RELATED[entity].link}${id}`) : null);

const timeZone = async () => String(await getSetting('general.timezone', 'Asia/Manila'));

/** SELECT of task rows with the names of the people and the reminder offset; pushes its two parameters. */
const taskSelect = (params, tz) => {
  params.push(DEFAULT_TIME, tz);
  const time = `$${params.length - 1}`;
  const zone = `$${params.length}`;
  return `SELECT t.*, to_char(t.due_time, 'HH24:MI') AS due_hm, au.display_name AS assignee_name, au.reporting_to AS assignee_manager,
    cu.display_name AS creator_name, ku.display_name AS completer_name,
    round(EXTRACT(epoch FROM (((t.due_date + COALESCE(t.due_time, ${time}::time)) AT TIME ZONE ${zone}::text) - t.remind_at)) / 60)::int AS reminder_minutes
  FROM work_tasks t LEFT JOIN users au ON au.id = t.assigned_to LEFT JOIN users cu ON cu.id = t.created_by LEFT JOIN users ku ON ku.id = t.completed_by`;
};

/** Describe related records in one query per type: Map 'entity:id' -> { ref, label }. */
async function describe(db, rows) {
  const out = new Map();
  const byType = new Map();
  for (const r of rows) if (r.entity && r.entity_id && RELATED[r.entity]) byType.set(r.entity, [...(byType.get(r.entity) || []), r.entity_id]);
  for (const [type, ids] of byType) {
    const d = RELATED[type];
    const { rows: found } = await db.query(`SELECT x.id::text AS id, ${d.ref} AS ref, ${d.label} AS label FROM ${d.table} x WHERE x.id::text = ANY($1::text[])`, [[...new Set(ids)]]);
    for (const f of found) out.set(`${type}:${f.id}`, { ref: f.ref, label: f.label });
  }
  return out;
}

const toTask = (t, today, related, user, team) => {
  const rel = related.get(`${t.entity}:${t.entity_id}`) || {};
  const mine = t.assigned_to === user.id;
  const manager = isAdmin(user) || team.includes(t.assigned_to);
  const creator = t.created_by === user.id;
  return {
    id: t.id, title: t.title, notes: t.notes, dueDate: t.due_date, dueTime: t.due_hm || null, priority: t.priority, status: t.status,
    overdue: t.status === 'open' && t.due_date < today, dueToday: t.status === 'open' && t.due_date === today,
    assignedTo: t.assigned_to, assignedToName: t.assignee_name, createdBy: t.created_by, createdByName: t.creator_name || (t.created_by === 'system' ? 'BrokerVerse' : t.created_by),
    source: t.source, sourceLabel: SOURCE_LABELS[t.source] || t.source, automatic: AUTO_SOURCES.includes(t.source),
    entity: t.entity, entityId: t.entity_id, entityRef: rel.ref || null, entityLabel: rel.label || null, link: t.entity ? linkOf(t.entity, t.entity_id) : null,
    remindAt: t.remind_at, reminderMinutes: t.remind_at ? t.reminder_minutes : null, remindedAt: t.reminded_at,
    completedAt: t.completed_at, completedByName: t.completer_name || (t.completed_by === 'system' ? 'BrokerVerse' : null), completionNote: t.completion_note,
    createdAt: t.created_at, updatedAt: t.updated_at,
    canEdit: mine || creator || manager, canReassign: creator || manager, canDelete: !AUTO_SOURCES.includes(t.source) && (creator || manager) && t.status === 'open',
  };
};

async function context(user, db) {
  return { today: await businessToday(), tz: await timeZone(), team: await teamIds(user.id, db) };
}

/** One task row (with names), or 404 when it does not exist or the user may not see it. */
async function loadVisible(db, id, user, ctx) {
  const params = [];
  const sql = taskSelect(params, ctx.tz);
  const t = (await db.query(`${sql} WHERE t.id = $${params.length + 1}`, [...params, id])).rows[0];
  if (!t) throw notFound('Task not found');
  const visible = isAdmin(user) || t.assigned_to === user.id || t.created_by === user.id || ctx.team.includes(t.assigned_to);
  if (!visible) throw notFound('Task not found');
  return t;
}

export async function getTask(id, user, { db = pool } = {}) {
  const ctx = await context(user, db);
  const t = await loadVisible(db, id, user, ctx);
  return toTask(t, ctx.today, await describe(db, [t]), user, ctx.team);
}

/**
 * GET /my-work/tasks. scope: mine (assigned to me, default), created (created by me for others), team (assigned to
 * my team), all (administrators). Filters: status (open, done, cancelled, all), due (overdue, today, soon, later),
 * priority, search, assignee, from / to (due date range), entity + entityId. Sort: due (default), priority, created.
 */
export async function listTasks(user, q, pg, { db = pool } = {}) {
  const ctx = await context(user, db);
  const params = [];
  const base = taskSelect(params, ctx.tz);
  const P = (v) => { params.push(v); return `$${params.length}`; };
  const w = [];
  const scope = q.scope || 'mine';
  if (scope === 'mine') w.push(`t.assigned_to = ${P(user.id)}`);
  else if (scope === 'created') w.push(`t.created_by = ${P(user.id)} AND t.assigned_to <> ${P(user.id)}`);
  else if (scope === 'team') w.push(`t.assigned_to = ANY(${P(ctx.team)}::text[])`);
  else if (scope === 'all') { if (!isAdmin(user)) w.push(`(t.assigned_to = ANY(${P([user.id, ...ctx.team])}::text[]) OR t.created_by = ${P(user.id)})`); }
  else throw badRequest('scope must be mine, created, team or all');
  if (q.assignee) {
    if (!(isAdmin(user) || q.assignee === user.id || ctx.team.includes(q.assignee))) throw forbidden('That user does not report to you');
    w.push(`t.assigned_to = ${P(q.assignee)}`);
  }
  const status = q.status || 'open';
  if (status !== 'all') {
    if (!STATUSES.includes(status)) throw badRequest('status must be open, done, cancelled or all');
    w.push(`t.status = ${P(status)}`);
  }
  const soon = Number(await getSetting('myWork.due_soon_days', 7)) || 7;
  if (q.due === 'overdue') w.push(`t.due_date < ${P(ctx.today)}::date`);
  else if (q.due === 'today') w.push(`t.due_date = ${P(ctx.today)}::date`);
  else if (q.due === 'soon') w.push(`t.due_date > ${P(ctx.today)}::date AND t.due_date <= ${P(addDays(ctx.today, soon))}::date`);
  else if (q.due === 'later') w.push(`t.due_date > ${P(addDays(ctx.today, soon))}::date`);
  else if (q.due) throw badRequest('due must be overdue, today, soon or later');
  if (q.priority) w.push(`t.priority = ANY(${P(String(q.priority).split(','))}::text[])`);
  if (q.source) w.push(`t.source = ANY(${P(String(q.source).split(','))}::text[])`);
  if (q.search) w.push(`(t.title ILIKE '%' || ${P(q.search)} || '%' OR t.notes ILIKE '%' || ${P(q.search)} || '%')`);
  if (q.from) w.push(`t.due_date >= ${P(q.from)}::date`);
  if (q.to) w.push(`t.due_date <= ${P(q.to)}::date`);
  if (q.entity) w.push(`t.entity = ${P(q.entity)}`);
  if (q.entityId) w.push(`t.entity_id = ${P(q.entityId)}`);
  const rank = "CASE t.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END";
  const order = q.sort === 'priority' ? `${rank} DESC, t.due_date, t.due_time NULLS LAST`
    : q.sort === 'created' ? 't.created_at DESC'
      : status === 'open' ? `t.due_date, t.due_time NULLS LAST, ${rank} DESC` : 'COALESCE(t.completed_at, t.updated_at) DESC';
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM (${base} ${where}) x`, params)).rows[0].n;
  const rows = (await db.query(`${base} ${where} ORDER BY ${order}, t.id LIMIT ${P(pg.limit)} OFFSET ${P(pg.offset)}`, params)).rows;
  const related = await describe(db, rows);
  const counts = (await db.query(`SELECT count(*) FILTER (WHERE t.due_date < $2::date)::int AS overdue, count(*) FILTER (WHERE t.due_date = $2::date)::int AS today,
      count(*)::int AS open FROM work_tasks t WHERE t.status = 'open' AND t.assigned_to = $1`, [user.id, ctx.today])).rows[0];
  return { rows: rows.map((t) => toTask(t, ctx.today, related, user, ctx.team)), total, counts };
}

/** The related record must exist and be visible to the user (permission and record scope). */
async function checkRelated(db, user, recordScope, entity, entityId) {
  if (!entity && !entityId) return { entity: null, entityId: null };
  if (!entity || !entityId) throw badRequest('Give both the type and the record of the related record');
  const d = RELATED[entity];
  if (!d) throw badRequest(`Unknown record type ${entity}`);
  if (!hasPermission(user, d.permission)) throw forbidden(`You cannot see ${entity} records`);
  const params = [String(entityId)];
  const pred = d.scope ? scopeSql(recordScope, d.scope, 'x', params) : 'TRUE';
  const r = (await db.query(`SELECT x.id::text AS id FROM ${d.table} x WHERE x.id::text = $1 AND ${pred}`, params)).rows[0];
  if (!r) throw badRequest('The related record was not found');
  return { entity, entityId: r.id };
}

/** remind_at for a due date / time and a number of minutes before it (null: no reminder). */
async function remindAt(db, dueDate, dueTime, minutes, tz) {
  if (minutes === null || minutes === undefined) return null;
  const r = await db.query('SELECT ((($1::date + $2::time) AT TIME ZONE $3::text) - make_interval(mins => $4::int)) AS at', [dueDate, dueTime || DEFAULT_TIME, tz, Number(minutes)]);
  return r.rows[0].at;
}

async function assertAssignable(db, user, assigneeId) {
  if (assigneeId === user.id) return;
  const list = await assignableUsers(user, db);
  if (!list.some((u) => u.id === assigneeId)) throw forbidden('Tasks can be assigned only to yourself or to people who report to you');
}

/** POST /my-work/tasks */
export async function createTask(body, user, { db = pool, recordScope = null } = {}) {
  const assignee = body.assignedTo || user.id;
  await assertAssignable(db, user, assignee);
  const rel = await checkRelated(db, user, recordScope, body.entity, body.entityId);
  const tz = await timeZone();
  const minutes = body.reminderMinutes === undefined ? Number(await getSetting('myWork.default_reminder_minutes', 60)) : body.reminderMinutes;
  const at = await remindAt(db, body.dueDate, body.dueTime, minutes, tz);
  const source = assignee === user.id ? 'manual' : 'manager';
  const { rows } = await db.query(`INSERT INTO work_tasks(title, notes, due_date, due_time, priority, assigned_to, source, entity, entity_id, remind_at, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id`,
  [body.title, body.notes || null, body.dueDate, body.dueTime || null, body.priority || 'normal', assignee, source, rel.entity, rel.entityId, at, user.id]);
  const task = await getTask(rows[0].id, user, { db });
  if (assignee !== user.id) {
    await notify({ userId: assignee, type: 'info', priority: task.priority === 'urgent' ? 'high' : 'normal', title: `New task: ${task.title}`,
      message: `${user.username} assigned you a task due ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''}`, link: `/operations/my-work?tab=tasks&task=${task.id}`, entity: 'task', entityId: task.id });
  }
  return task;
}

/** PUT /my-work/tasks/:id */
export async function updateTask(id, body, user, { db = pool, recordScope = null } = {}) {
  const ctx = await context(user, db);
  const before = await loadVisible(db, id, user, ctx);
  const beforeApi = toTask(before, ctx.today, new Map(), user, ctx.team);
  if (!beforeApi.canEdit) throw forbidden('You cannot change this task');
  if (before.status !== 'open' && Object.keys(body).some((k) => k !== 'notes')) throw conflict('Reopen the task before changing it');
  const cols = {};
  if (body.title !== undefined) cols.title = body.title;
  if (body.notes !== undefined) cols.notes = body.notes || null;
  if (body.priority !== undefined) cols.priority = body.priority;
  if (body.dueDate !== undefined) cols.due_date = body.dueDate;
  if (body.dueTime !== undefined) cols.due_time = body.dueTime || null;
  if (body.assignedTo !== undefined && body.assignedTo !== before.assigned_to) {
    if (!beforeApi.canReassign) throw forbidden('Only the creator or a manager can reassign this task');
    await assertAssignable(db, user, body.assignedTo);
    cols.assigned_to = body.assignedTo;
  }
  if (body.entity !== undefined || body.entityId !== undefined) {
    if (AUTO_SOURCES.includes(before.source)) throw badRequest('The record of a follow-up task cannot be changed');
    const rel = await checkRelated(db, user, recordScope, body.entity ?? before.entity, body.entityId ?? before.entity_id);
    cols.entity = rel.entity;
    cols.entity_id = rel.entityId;
  }
  const rescheduled = cols.due_date !== undefined || cols.due_time !== undefined || body.reminderMinutes !== undefined;
  if (rescheduled) {
    const minutes = body.reminderMinutes !== undefined ? body.reminderMinutes : (before.remind_at ? before.reminder_minutes : null);
    cols.remind_at = await remindAt(db, cols.due_date ?? before.due_date, cols.due_time !== undefined ? cols.due_time : before.due_hm, minutes, ctx.tz);
    cols.reminded_at = null;
    cols.overdue_notified_at = null;
  }
  if (!Object.keys(cols).length) return { before: beforeApi, after: await getTask(id, user, { db }) };
  const data = { ...cols, updated_by: user.id, updated_at: new Date() };
  const keys = Object.keys(data);
  await db.query(`UPDATE work_tasks SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  const after = await getTask(id, user, { db }).catch(() => null) || { ...beforeApi, assignedTo: cols.assigned_to };
  if (cols.assigned_to && cols.assigned_to !== user.id) {
    await notify({ userId: cols.assigned_to, type: 'info', title: `Task assigned to you: ${after.title}`, message: `${user.username} assigned you a task due ${after.dueDate}`,
      link: `/operations/my-work?tab=tasks&task=${before.id}`, entity: 'task', entityId: before.id });
  }
  return { before: beforeApi, after };
}

/** POST /my-work/tasks/:id/complete | /reopen; DELETE (cancel). */
export async function setStatus(id, action, user, { note = null, db = pool } = {}) {
  const ctx = await context(user, db);
  const before = await loadVisible(db, id, user, ctx);
  const api = toTask(before, ctx.today, new Map(), user, ctx.team);
  if (!api.canEdit) throw forbidden('You cannot change this task');
  if (action === 'complete') {
    if (before.status !== 'open') throw conflict(`The task is already ${before.status}`);
    await db.query("UPDATE work_tasks SET status = 'done', completed_at = now(), completed_by = $2, completion_note = $3, updated_by = $2, updated_at = now() WHERE id = $1", [id, user.id, note]);
  } else if (action === 'reopen') {
    if (before.status === 'open') throw conflict('The task is open');
    await db.query("UPDATE work_tasks SET status = 'open', completed_at = NULL, completed_by = NULL, completion_note = NULL, overdue_notified_at = NULL, updated_by = $2, updated_at = now() WHERE id = $1", [id, user.id]);
  } else if (action === 'cancel') {
    if (!api.canDelete) throw forbidden(AUTO_SOURCES.includes(before.source) ? 'A follow-up task is completed, not deleted' : 'Only the creator or a manager can delete this task');
    await db.query("UPDATE work_tasks SET status = 'cancelled', completed_at = now(), completed_by = $2, completion_note = COALESCE($3, 'Cancelled'), updated_by = $2, updated_at = now() WHERE id = $1", [id, user.id, note]);
  }
  return { before: api, after: await getTask(id, user, { db }) };
}

/** GET /my-work/records: records a task can be related to, found by number or name (10 at most). */
export async function findRecords(user, { type, search }, { db = pool, recordScope = null } = {}) {
  const d = RELATED[type];
  if (!d) throw badRequest(`type must be one of ${Object.keys(RELATED).join(', ')}`);
  if (!hasPermission(user, d.permission)) return [];
  const params = [String(search || '').trim()];
  const pred = d.scope ? scopeSql(recordScope, d.scope, 'x', params) : 'TRUE';
  const { rows } = await db.query(`SELECT x.id::text AS id, ${d.ref} AS ref, ${d.label} AS label FROM ${d.table} x
    WHERE ($1 = '' OR concat_ws(' ', ${d.ref}, ${d.label}) ILIKE '%' || $1 || '%') AND ${pred} ORDER BY x.created_at DESC NULLS LAST LIMIT 10`, params);
  return rows.map((r) => ({ entity: type, id: r.id, ref: r.ref, label: r.label, link: linkOf(type, r.id) }));
}

// ------------------------------------------------------------------------------------------- automatic follow-ups

/**
 * Create the follow-up tasks of the records (one per source record, key source_key) and close those whose record was
 * closed. Idempotent; run by the my-work-reminders job and after the actions that set a follow-up date.
 *   collection  a collection action with a promise-to-pay date (assignee: the collector of the item, else who recorded it)
 *   renewal     a renewal activity with a follow-up date (the renewal's owner, else who recorded it)
 *   claim       a claim's follow-up (due) date (the claim handler); a new date replaces the task
 */
export async function syncAutoTasks({ db = pool } = {}) {
  const today = await businessToday();
  const tz = await timeZone();
  const since = addDays(today, -7);
  const user = (col) => `(SELECT uu.id FROM users uu WHERE (uu.id = ${col} OR uu.username = ${col}) AND uu.status = 'active' ORDER BY (uu.id = ${col}) DESC LIMIT 1)`;
  const at = (d) => `((${d} + time '${DEFAULT_TIME}') AT TIME ZONE $2::text)`;
  let created = 0;
  if ((await getSetting('myWork.auto_tasks', true)) !== false) {
    const ins = async (sql) => { created += (await db.query(sql, [since, tz])).rowCount; };
    await ins(`INSERT INTO work_tasks(title, notes, due_date, priority, assigned_to, source, source_key, entity, entity_id, remind_at, created_by)
      SELECT 'Confirm the payment promised by ' || COALESCE(c.display_name, 'the client') || ' (' || rv.bill_number || ')', a.notes, a.commitment_date,
        CASE WHEN ci.escalated_at IS NOT NULL THEN 'high' ELSE 'normal' END, x.assignee, 'collection', 'collection_action:' || a.id, 'collection', ci.id, ${at('a.commitment_date')}, 'system'
      FROM collection_actions a JOIN collection_items ci ON ci.id = a.collection_id JOIN receivables rv ON rv.id = ci.receivable_id
      LEFT JOIN clients c ON c.id = COALESCE(rv.client_id, ci.client_id)
      CROSS JOIN LATERAL (SELECT COALESCE(${user('ci.assigned_to')}, ${user('a.action_by')}) AS assignee) x
      WHERE a.commitment_date IS NOT NULL AND a.commitment_date >= $1::date AND ci.closed_at IS NULL AND rv.balance > 0 AND x.assignee IS NOT NULL
        AND a.id = (SELECT max(a2.id) FROM collection_actions a2 WHERE a2.collection_id = a.collection_id AND a2.commitment_date IS NOT NULL)
      ON CONFLICT (source_key) DO NOTHING`);
    await ins(`INSERT INTO work_tasks(title, notes, due_date, priority, assigned_to, source, source_key, entity, entity_id, remind_at, created_by)
      SELECT 'Renewal ' || COALESCE(r.renewal_number, p.policy_number) || ': ' || COALESCE(NULLIF(ra.next_action, ''), 'follow up ' || COALESCE(c.display_name, 'the client')),
        NULLIF(concat_ws(' - ', ra.activity_type, ra.outcome, ra.description), ''), ra.follow_up_date, ${prioSql('r.priority')}, x.assignee, 'renewal', 'renewal_activity:' || ra.id,
        'renewal', r.id, ${at('ra.follow_up_date')}, 'system'
      FROM renewal_activities ra JOIN renewals r ON r.id = ra.renewal_id JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = COALESCE(r.client_id, p.client_id)
      CROSS JOIN LATERAL (SELECT COALESCE(${user('r.owner_user_id')}, ${user('ra.by_user')}, ${user('p.owner_user_id')}) AS assignee) x
      WHERE ra.follow_up_date IS NOT NULL AND ra.follow_up_date >= $1::date AND r.status IN ('pipeline', 'notice-1', 'notice-2', 'final-notice', 'quoted', 'pending-approval', 'approved')
        AND x.assignee IS NOT NULL
        AND ra.id = (SELECT max(r2.id) FROM renewal_activities r2 WHERE r2.renewal_id = ra.renewal_id AND r2.follow_up_date IS NOT NULL)
      ON CONFLICT (source_key) DO NOTHING`);
    await ins(`INSERT INTO work_tasks(title, due_date, priority, assigned_to, source, source_key, entity, entity_id, remind_at, created_by)
      SELECT 'Claim ' || cl.claim_number || ': follow up' || COALESCE(' with ' || ic.name, ' the insurer'), cl.due_date, ${prioSql('cl.priority')}, cl.handler_user_id, 'claim',
        'claim:' || cl.id || ':' || cl.due_date, 'claim', cl.id, ${at('cl.due_date')}, 'system'
      FROM claims cl LEFT JOIN policies p ON p.id = cl.policy_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
      JOIN users hu ON hu.id = cl.handler_user_id AND hu.status = 'active'
      WHERE cl.due_date IS NOT NULL AND cl.due_date >= $1::date AND cl.status IN ('registered', 'in-review', 'approved')
      ON CONFLICT (source_key) DO NOTHING`);
  }
  // follow-ups whose record is closed, or replaced by a later follow-up date
  const closed = await db.query(`UPDATE work_tasks t SET status = 'done', completed_at = now(), completed_by = 'system', completion_note = 'Closed with its record', updated_at = now()
    WHERE t.status = 'open' AND (
      (t.source = 'collection' AND (EXISTS (SELECT 1 FROM collection_items ci JOIN receivables rv ON rv.id = ci.receivable_id WHERE ci.id = t.entity_id AND (ci.closed_at IS NOT NULL OR rv.balance <= 0))
         OR t.source_key <> (SELECT 'collection_action:' || max(a2.id) FROM collection_actions a2 WHERE a2.collection_id = t.entity_id AND a2.commitment_date IS NOT NULL)))
      OR (t.source = 'renewal' AND (EXISTS (SELECT 1 FROM renewals r WHERE r.id = t.entity_id AND r.status NOT IN ('pipeline', 'notice-1', 'notice-2', 'final-notice', 'quoted', 'pending-approval', 'approved'))
         OR t.source_key <> (SELECT 'renewal_activity:' || max(r2.id) FROM renewal_activities r2 WHERE r2.renewal_id = t.entity_id AND r2.follow_up_date IS NOT NULL)))
      OR (t.source = 'claim' AND EXISTS (SELECT 1 FROM claims cl WHERE cl.id = t.entity_id AND (cl.status NOT IN ('registered', 'in-review', 'approved') OR t.source_key <> 'claim:' || cl.id || ':' || COALESCE(cl.due_date::text, ''))))
    )`);
  return { created, closed: closed.rowCount };
}
function prioSql(x) {
  return `(CASE lower(COALESCE(${x}, '')) WHEN 'critical' THEN 'urgent' WHEN 'urgent' THEN 'urgent' WHEN 'high' THEN 'high' WHEN 'low' THEN 'low' ELSE 'normal' END)`;
}

/** Run the follow-up synchronisation after an action without ever failing that action. */
export async function syncAutoTasksQuietly(log) {
  try {
    if (!(await pool.query("SELECT to_regclass('work_tasks') IS NOT NULL AS ok")).rows[0].ok) return null;
    return await syncAutoTasks();
  } catch (e) {
    log?.warn?.({ err: e }, 'my work follow-up tasks not synchronised');
    return null;
  }
}

/**
 * Scheduled job my-work-reminders: follow-up tasks, then a notification to the assignee of every open task whose
 * reminder time has come, and once to the assignee of every open task that has become overdue
 * (myWork.overdue_task_alert).
 */
export async function runReminders({ db = pool } = {}) {
  const auto = await syncAutoTasks({ db });
  const tz = await timeZone();
  const due = (await db.query(`UPDATE work_tasks SET reminded_at = now() WHERE status = 'open' AND reminded_at IS NULL AND remind_at IS NOT NULL AND remind_at <= now()
    RETURNING id, title, assigned_to, due_date, to_char(due_time, 'HH24:MI') AS due_hm, priority, entity, entity_id`)).rows;
  for (const t of due) {
    await notify({ userId: t.assigned_to, type: 'reminder', priority: ['high', 'urgent'].includes(t.priority) ? 'high' : 'normal', title: `Task due: ${t.title}`,
      message: `Due ${t.due_date}${t.due_hm ? ` at ${t.due_hm}` : ''}`, link: `/operations/my-work?tab=tasks&task=${t.id}`, entity: 'task', entityId: t.id });
  }
  let overdue = [];
  if ((await getSetting('myWork.overdue_task_alert', true)) !== false) {
    overdue = (await db.query(`UPDATE work_tasks SET overdue_notified_at = now() WHERE status = 'open' AND overdue_notified_at IS NULL
        AND ((due_date + COALESCE(due_time, time '23:59')) AT TIME ZONE $1::text) < now()
      RETURNING id, title, assigned_to, due_date`, [tz])).rows;
    for (const t of overdue) {
      await notify({ userId: t.assigned_to, type: 'alert', priority: 'high', title: `Task overdue: ${t.title}`, message: `It was due on ${t.due_date}`,
        link: `/operations/my-work?tab=tasks&task=${t.id}`, entity: 'task', entityId: t.id });
    }
  }
  return { ...auto, reminders: due.length, overdue: overdue.length };
}
