/**
 * Sales activities: calls, meetings, e-mails and visits of account executives on a prospect (lead), a quotation or a
 * client, shown as a timeline on those records and summed in the activity report.
 *
 * The activity type (master sales-activity-type: channel call / meeting / email / visit / other, default days to the
 * next step) and the outcome (master sales-activity-outcome) are generic masters the broker maintains. An activity on
 * a quotation also appears on the timeline of the quotation's prospect and client (lead_id / client_id are kept on
 * the activity). The next step with its date becomes a follow-up task in the account executive's My Work diary,
 * created through the My Work task service (source sales-activity); a later activity on the same record completes the
 * earlier open follow-up when sales_activities.close_previous_follow_up is on. Cancelling an activity cancels its open
 * follow-up task. A scoped user (security.scoped_roles) only logs and sees activities on records of their own book.
 */
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, today } from '../../lib/dates.js';
import { scopeSql } from '../../lib/scope.js';
import { isAdmin } from '../../lib/auth.js';
import { activeRecord, activeRecords } from '../ops-masters/records.js';
import { createTask } from '../my-work/tasks.js';
import { assignableUsers } from '../my-work/team.js';

export const ENTITIES = ['lead', 'quote', 'client'];
export const CHANNELS = ['call', 'meeting', 'email', 'visit', 'other'];

/** The record an activity is logged on: table, document number and name, and the prospect / client it belongs to. */
const RECORD = {
  lead: { table: 'leads', number: 'x.lead_number', name: 'x.display_name', lead: 'x.id', client: 'x.client_id', link: '/agent/leaddetail/' },
  client: { table: 'clients', number: 'x.client_code', name: 'x.display_name', lead: 'x.lead_id', client: 'x.id', link: '/agent/clientview/' },
  quote: { table: 'quotes', number: 'x.quote_number', name: 'COALESCE((SELECT c.display_name FROM clients c WHERE c.id = x.client_id), (SELECT l.display_name FROM leads l WHERE l.id = x.lead_id))',
    lead: 'x.lead_id', client: 'x.client_id', link: '/agent/quotedetailview/' },
};

/** The record (by id or document number), visible to the user's record scope; 404 otherwise. */
export async function recordOf(db, entity, ref, recordScope = null) {
  const d = RECORD[entity];
  if (!d) throw badRequest(`entity must be one of ${ENTITIES.join(', ')}`);
  const params = [String(ref)];
  const pred = recordScope ? scopeSql(recordScope, entity, 'x', params) : 'TRUE';
  const deleted = entity === 'client' ? 'TRUE' : 'x.deleted_at IS NULL';
  const r = (await db.query(`SELECT x.id::text AS id, ${d.number} AS number, ${d.name} AS name, ${d.lead} AS lead_id, ${d.client} AS client_id
    FROM ${d.table} x WHERE (x.id::text = $1 OR ${d.number} = $1) AND ${deleted} AND ${pred}`, params)).rows[0];
  if (!r) throw notFound(`${entity === 'quote' ? 'Quotation' : entity === 'lead' ? 'Prospect' : 'Client'} not found`);
  return { entity, id: r.id, number: r.number, name: r.name, leadId: r.lead_id || null, clientId: r.client_id || null, link: `${d.link}${r.id}` };
}

const SELECT = `SELECT a.*, t.name AS type_name, o.name AS outcome_name, ae.display_name AS ae_name, cu.display_name AS created_by_name,
  wt.status AS task_status, wt.due_date AS task_due_date,
  CASE a.entity WHEN 'lead' THEN (SELECT l.lead_number FROM leads l WHERE l.id = a.entity_id) WHEN 'client' THEN (SELECT c.client_code FROM clients c WHERE c.id = a.entity_id)
    ELSE (SELECT q.quote_number FROM quotes q WHERE q.id = a.entity_id) END AS record_number,
  COALESCE((SELECT c.display_name FROM clients c WHERE c.id = a.client_id), (SELECT l.display_name FROM leads l WHERE l.id = a.lead_id)) AS party_name
  FROM sales_activities a
  LEFT JOIN master_records t ON t.type_code = 'sales-activity-type' AND t.code = a.activity_type
  LEFT JOIN master_records o ON o.type_code = 'sales-activity-outcome' AND o.code = a.outcome
  LEFT JOIN users ae ON ae.id = a.account_executive LEFT JOIN users cu ON cu.id = a.created_by
  LEFT JOIN work_tasks wt ON wt.id = a.task_id`;

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null);
export const activityOut = (r) => r && ({
  id: r.id, entity: r.entity, entityId: r.entity_id, recordNumber: r.record_number || null, partyName: r.party_name || null, leadId: r.lead_id, clientId: r.client_id,
  link: `${RECORD[r.entity].link}${r.entity_id}`,
  activityType: r.activity_type, activityTypeName: r.type_name || r.activity_type, channel: r.channel, subject: r.subject, notes: r.notes,
  activityAt: r.activity_at, durationMinutes: r.duration_minutes, contactPerson: r.contact_person, location: r.location,
  outcome: r.outcome, outcomeName: r.outcome ? r.outcome_name || r.outcome : null, nextStep: r.next_step, nextStepDate: iso(r.next_step_date),
  taskId: r.task_id, taskStatus: r.task_status || null, taskDueDate: iso(r.task_due_date),
  accountExecutive: r.account_executive, accountExecutiveName: r.ae_name || r.account_executive, status: r.status, cancelReason: r.cancel_reason,
  createdBy: r.created_by, createdByName: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

/** Activity types and outcomes (active master records) for the log form. */
export async function options(db) {
  const types = (await activeRecords(db, 'sales-activity-type')).map((t) => ({ code: t.code, name: t.name, channel: CHANNELS.includes(t.channel) ? t.channel : 'other',
    followUpDays: t.followUpDays === undefined || t.followUpDays === null || t.followUpDays === '' ? null : Number(t.followUpDays), sortOrder: Number(t.sortOrder ?? 100) }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const outcomes = (await activeRecords(db, 'sales-activity-outcome')).map((o) => ({ code: o.code, name: o.name, result: o.result || 'neutral', sortOrder: Number(o.sortOrder ?? 100) }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return { types, outcomes, channels: CHANNELS, nextStepRequired: (await getSetting('sales_activities.next_step_required', false)) === true };
}

/**
 * Timeline of a record, newest first: the activities logged on it and, for a prospect or a client, those logged on
 * its quotations (and, for a client, on the prospect it came from).
 */
export async function timeline(db, entity, ref, { recordScope = null, includeCancelled = false } = {}) {
  const rec = await recordOf(db, entity, ref, recordScope);
  const params = [rec.entity, rec.id];
  let related = '';
  if (entity === 'lead') related = ' OR a.lead_id = $2';
  else if (entity === 'client') { params.push(rec.leadId); related = ' OR a.client_id = $2 OR ($3::text IS NOT NULL AND a.lead_id = $3)'; }
  const rows = (await db.query(`${SELECT} WHERE ((a.entity = $1 AND a.entity_id = $2)${related}) ${includeCancelled ? '' : "AND a.status = 'logged'"}
    ORDER BY a.activity_at DESC, a.created_at DESC`, params)).rows.map(activityOut);
  const open = rows.find((a) => a.status === 'logged' && a.nextStepDate && a.taskStatus === 'open');
  return { record: rec, activities: rows, nextStep: open ? { activityId: open.id, nextStep: open.nextStep, dueDate: open.nextStepDate, taskId: open.taskId } : null };
}

export async function getActivity(db, id) {
  const r = (await db.query(`${SELECT} WHERE a.id = $1`, [String(id)])).rows[0];
  if (!r) throw notFound('Sales activity not found');
  return activityOut(r);
}

/** The account executive of an activity: the user logging it, or someone in their team (managers log for their team). */
async function accountExecutiveOf(db, user, ref) {
  if (!ref || ref === user.id) return user.id;
  if (isAdmin(user)) {
    const u = (await db.query("SELECT id FROM users WHERE id = $1 AND status = 'active'", [ref])).rows[0];
    if (!u) throw badRequest('Validation failed', [{ path: 'accountExecutive', message: 'Unknown or inactive user' }]);
    return u.id;
  }
  const team = await assignableUsers(user, db);
  if (!team.some((u) => u.id === ref)) throw forbidden('An activity can be logged for yourself or for someone who reports to you');
  return ref;
}

async function checkFields(db, b, { partial = false } = {}) {
  const errors = [];
  let type = null;
  if (!partial || b.activityType !== undefined) {
    type = await activeRecord(db, 'sales-activity-type', b.activityType);
    if (!type) errors.push({ path: 'activityType', message: `${b.activityType || 'The activity type'} is not an active activity type (Master > Sales Activity Types)` });
  }
  if (b.outcome) {
    const o = await activeRecord(db, 'sales-activity-outcome', b.outcome);
    if (!o) errors.push({ path: 'outcome', message: `${b.outcome} is not an active outcome (Master > Sales Activity Outcomes)` });
    else b.outcome = o.code;
  }
  const now = await today();
  if (b.activityAt !== undefined) {
    const day = String(b.activityAt).slice(0, 10);
    const back = Number(await getSetting('sales_activities.backdate_days', 30)) || 0;
    if (day > addDays(now, 1)) errors.push({ path: 'activityAt', message: 'An activity is logged when it has taken place (not in the future)' });
    else if (back && day < addDays(now, -back)) errors.push({ path: 'activityAt', message: `An activity can be logged up to ${back} days back (sales_activities.backdate_days)` });
  }
  if (b.nextStepDate && b.nextStepDate < now) errors.push({ path: 'nextStepDate', message: 'The next step date is in the past' });
  if (b.nextStepDate && !String(b.nextStep || '').trim()) errors.push({ path: 'nextStep', message: 'Describe the next step' });
  if (!partial && (await getSetting('sales_activities.next_step_required', false)) === true && (!b.nextStep || !b.nextStepDate)) {
    errors.push({ path: 'nextStepDate', message: 'Every activity needs its next step and date (sales_activities.next_step_required)' });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  return { type };
}

/** Follow-up task of the next step in the account executive's My Work (source sales-activity). */
async function followUpTask(db, a, rec, user, recordScope) {
  const priority = String(await getSetting('sales_activities.follow_up_priority', 'normal'));
  const title = `${a.next_step} (${rec.number || rec.name || rec.entity})`.slice(0, 200);
  const task = await createTask({ title, notes: `Next step of ${a.subject}${rec.name ? `, ${rec.name}` : ''}`, dueDate: iso(a.next_step_date), priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
    assignedTo: a.account_executive, entity: rec.entity, entityId: rec.id }, user, { db, recordScope, source: 'sales-activity', sourceKey: `sales_activity:${a.id}` });
  await db.query('UPDATE sales_activities SET task_id = $2 WHERE id = $1', [a.id, task.id]);
  return task;
}

/** Complete the open follow-ups of the earlier activities on the record (a later activity has followed them up). */
async function closeEarlierFollowUps(db, a, user) {
  if ((await getSetting('sales_activities.close_previous_follow_up', true)) === false) return 0;
  const r = await db.query(`UPDATE work_tasks t SET status = 'done', completed_at = now(), completed_by = $3, completion_note = 'Followed up by a later sales activity', updated_by = $3, updated_at = now()
    FROM sales_activities x WHERE x.task_id = t.id AND x.entity = $1 AND x.entity_id = $2 AND x.id <> $4 AND t.status = 'open' AND x.activity_at <= $5`,
  [a.entity, a.entity_id, user.id, a.id, a.activity_at]);
  return r.rowCount;
}

/** Log an activity on a record (POST /sales-activities). */
export async function logActivity(db, b, user, { recordScope = null } = {}) {
  const rec = await recordOf(db, b.entity, b.entityId, recordScope);
  const { type } = await checkFields(db, b);
  const ae = await accountExecutiveOf(db, user, b.accountExecutive);
  const a = (await db.query(`INSERT INTO sales_activities(entity, entity_id, lead_id, client_id, activity_type, channel, subject, notes, activity_at, duration_minutes, contact_person, location,
      outcome, next_step, next_step_date, account_executive, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) RETURNING *`,
  [rec.entity, rec.id, rec.leadId, rec.clientId, type.code, CHANNELS.includes(type.channel) ? type.channel : 'other', String(b.subject || type.name).trim(), b.notes || null,
    b.activityAt, b.durationMinutes ?? null, b.contactPerson || null, b.location || null, b.outcome || null, b.nextStep ? String(b.nextStep).trim() : null, b.nextStepDate || null,
    ae, user.id])).rows[0];
  const closed = await closeEarlierFollowUps(db, a, user);
  if (a.next_step && a.next_step_date) await followUpTask(db, a, rec, user, recordScope);
  if (rec.entity === 'lead') await db.query("UPDATE leads SET status = 'Contacted', updated_at = now() WHERE id = $1 AND status = 'New'", [rec.id]);
  return { activity: await getActivity(db, a.id), closedFollowUps: closed };
}

async function editable(db, id, user) {
  const a = (await db.query('SELECT * FROM sales_activities WHERE id = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!a) throw notFound('Sales activity not found');
  if (a.status !== 'logged') throw conflict('The activity is cancelled');
  if (!(isAdmin(user) || a.account_executive === user.id || a.created_by === user.id || (await assignableUsers(user, db)).some((u) => u.id === a.account_executive))) {
    throw forbidden('Only the account executive, who logged it or their manager can change this activity');
  }
  return a;
}

/** Change an activity; a changed next step (or date) moves its open follow-up task, or creates one. */
export async function updateActivity(db, id, b, user, { recordScope = null } = {}) {
  const before = await editable(db, id, user);
  const merged = { activityType: before.activity_type, outcome: before.outcome, nextStep: before.next_step, nextStepDate: iso(before.next_step_date), ...b };
  const { type } = await checkFields(db, { ...merged, activityAt: b.activityAt }, { partial: true });
  const cols = {};
  if (b.activityType !== undefined) { cols.activity_type = type.code; cols.channel = CHANNELS.includes(type.channel) ? type.channel : 'other'; }
  for (const [k, c] of [['subject', 'subject'], ['notes', 'notes'], ['activityAt', 'activity_at'], ['durationMinutes', 'duration_minutes'], ['contactPerson', 'contact_person'],
    ['location', 'location'], ['outcome', 'outcome'], ['nextStep', 'next_step'], ['nextStepDate', 'next_step_date']]) if (b[k] !== undefined) cols[c] = b[k] === '' ? null : (k === 'outcome' ? merged.outcome : b[k]);
  if (!Object.keys(cols).length) return { before: await getActivity(db, before.id), after: await getActivity(db, before.id) };
  const beforeOut = await getActivity(db, before.id);
  const keys = Object.keys(cols);
  await db.query(`UPDATE sales_activities SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
    [before.id, ...Object.values(cols), user.id]);
  const a = (await db.query('SELECT * FROM sales_activities WHERE id = $1', [before.id])).rows[0];
  if (b.nextStep !== undefined || b.nextStepDate !== undefined) {
    const task = a.task_id ? (await db.query('SELECT id, status FROM work_tasks WHERE id = $1', [a.task_id])).rows[0] : null;
    if (task?.status === 'open') {
      if (a.next_step && a.next_step_date) {
        await db.query('UPDATE work_tasks SET title = $2, due_date = $3, updated_by = $4, updated_at = now(), reminded_at = NULL, overdue_notified_at = NULL WHERE id = $1',
          [task.id, String(a.next_step).slice(0, 200), iso(a.next_step_date), user.id]);
      } else {
        await db.query("UPDATE work_tasks SET status = 'cancelled', completed_at = now(), completed_by = $2, completion_note = 'Next step removed from the activity', updated_at = now() WHERE id = $1", [task.id, user.id]);
      }
    } else if (!task && a.next_step && a.next_step_date) {
      await followUpTask(db, a, await recordOf(db, a.entity, a.entity_id), user, recordScope);
    }
  }
  return { before: beforeOut, after: await getActivity(db, before.id) };
}

/** Cancel an activity logged in error (kept, marked cancelled); its open follow-up task is cancelled. */
export async function cancelActivity(db, id, reason, user) {
  const a = await editable(db, id, user);
  await db.query("UPDATE sales_activities SET status = 'cancelled', cancel_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1", [a.id, reason, user.id]);
  if (a.task_id) {
    await db.query("UPDATE work_tasks SET status = 'cancelled', completed_at = now(), completed_by = $2, completion_note = 'Sales activity cancelled', updated_at = now() WHERE id = $1 AND status = 'open'",
      [a.task_id, user.id]);
  }
  return getActivity(db, a.id);
}

/** Activities (Sales > Sales Activities): period, account executive, type, outcome, channel, entity, search. */
export async function listActivities(db, q = {}, { recordScope = null } = {}) {
  const params = [];
  const where = ["a.status = 'logged'"];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status === 'all') where.shift(); else if (q.status === 'cancelled') where[0] = "a.status = 'cancelled'";
  if (q.from) add('a.activity_at >= ?::date', q.from);
  if (q.to) add("a.activity_at < (?::date + interval '1 day')", q.to);
  if (q.accountExecutive) add('a.account_executive = ?', q.accountExecutive);
  if (q.activityType) add('a.activity_type = ?', q.activityType);
  if (q.outcome) add('a.outcome = ?', q.outcome);
  if (q.channel) add('a.channel = ?', q.channel);
  if (q.entity) add('a.entity = ?', q.entity);
  if (q.search) add("(a.subject ILIKE '%' || ? || '%' OR a.notes ILIKE '%' || ? || '%' OR a.contact_person ILIKE '%' || ? || '%')", q.search);
  if (recordScope) { params.push(recordScope.ids); where.push(`(a.account_executive = ANY($${params.length}) OR a.created_by = ANY($${params.length}))`); }
  return (await db.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY a.activity_at DESC LIMIT 2000`, params)).rows.map(activityOut);
}

/**
 * Activity report of a period: per account executive the activities by channel, the outcomes, the next steps set
 * and how many of their follow-up tasks are done, open or overdue; and the totals per activity type.
 */
export async function activityReport(db, q = {}, { recordScope = null } = {}) {
  const to = q.to || (await today());
  const from = q.from || `${to.slice(0, 7)}-01`;
  if (from > to) throw badRequest('Validation failed', [{ path: 'from', message: 'From is after to' }]);
  const rows = await listActivities(db, { ...q, from, to, status: 'logged' }, { recordScope });
  const now = await today();
  const byAe = new Map();
  for (const a of rows) {
    const r = byAe.get(a.accountExecutive) || { accountExecutive: a.accountExecutive, accountExecutiveName: a.accountExecutiveName, total: 0, call: 0, meeting: 0, email: 0, visit: 0, other: 0,
      prospects: new Set(), clients: new Set(), quotations: new Set(), withOutcome: 0, positive: 0, nextSteps: 0, followUpsDone: 0, followUpsOpen: 0, followUpsOverdue: 0 };
    r.total += 1; r[a.channel] += 1;
    if (a.entity === 'lead') r.prospects.add(a.entityId); else if (a.entity === 'client') r.clients.add(a.entityId); else r.quotations.add(a.entityId);
    if (a.outcome) r.withOutcome += 1;
    if (a.nextStepDate) {
      r.nextSteps += 1;
      if (a.taskStatus === 'done') r.followUpsDone += 1;
      else if (a.taskStatus === 'open') { r.followUpsOpen += 1; if (a.taskDueDate && a.taskDueDate < now) r.followUpsOverdue += 1; }
    }
    byAe.set(a.accountExecutive, r);
  }
  const positive = new Set((await activeRecords(db, 'sales-activity-outcome')).filter((o) => o.result === 'positive').map((o) => o.code));
  for (const a of rows) if (a.outcome && positive.has(a.outcome)) byAe.get(a.accountExecutive).positive += 1;
  const perAe = [...byAe.values()].map((r) => ({ ...r, prospects: r.prospects.size, clients: r.clients.size, quotations: r.quotations.size }))
    .sort((x, y) => y.total - x.total || String(x.accountExecutiveName).localeCompare(String(y.accountExecutiveName)));
  const byType = new Map();
  for (const a of rows) {
    const t = byType.get(a.activityType) || { activityType: a.activityType, activityTypeName: a.activityTypeName, total: 0 };
    t.total += 1;
    byType.set(a.activityType, t);
  }
  const byOutcome = new Map();
  for (const a of rows.filter((x) => x.outcome)) {
    const o = byOutcome.get(a.outcome) || { outcome: a.outcome, outcomeName: a.outcomeName, total: 0 };
    o.total += 1;
    byOutcome.set(a.outcome, o);
  }
  const sum = (k) => perAe.reduce((s, r) => s + r[k], 0);
  return { from, to, totals: { activities: rows.length, accountExecutives: perAe.length, nextSteps: sum('nextSteps'), followUpsDone: sum('followUpsDone'), followUpsOpen: sum('followUpsOpen'),
    followUpsOverdue: sum('followUpsOverdue'), positive: sum('positive') },
  rows: perAe, byType: [...byType.values()].sort((x, y) => y.total - x.total), byOutcome: [...byOutcome.values()].sort((x, y) => y.total - x.total), activities: rows };
}
