/**
 * Lead assignment (Operations > Sales & Marketing > Lead Assignment): rules that give each new prospect an account
 * executive, the reassignment queue, single and bulk reassignment, and the team view by reporting line.
 *
 * A rule matches on the prospect's branch, line of business, source, category, distribution channel and territory
 * (Province, City / Municipality); an empty condition matches anything. The first active rule by priority (then id)
 * that matches picks an active assignee: round_robin (the next one after the last assigned), load (fewest open
 * prospects) or fixed (the first one). With no active rule at all the creator keeps the prospect; when rules exist
 * but none matches, leads.assignment_fallback decides (queue or creator).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { lobOf } from '../documents/common.js';
import { notify } from '../notifications/service.js';

export const METHODS = ['round_robin', 'load', 'fixed'];
export const CONDITION_KEYS = ['branchCode', 'lob', 'source', 'leadCategory', 'channelId', 'province', 'city'];
/** Prospect statuses that are no longer worked (not counted as open, never queued). */
const CLOSED = ['Converted', 'Lost', 'converted', 'lost'];

const db0 = { query };
const norm = (v) => String(v ?? '').trim().toLowerCase();

export const ruleOut = (r) => ({
  id: r.id, name: r.name, priority: r.priority, method: r.method, conditions: r.conditions || {}, assignees: r.assignees || [],
  assigneeNames: r.assignee_names || [], lastAssignedUserId: r.last_assigned_user_id, status: r.status, description: r.description,
  createdBy: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by, updatedAt: r.updated_at,
});

const RULE_SELECT = `SELECT r.*, (SELECT array_agg(u.display_name ORDER BY array_position(r.assignees, u.id)) FROM users u WHERE u.id = ANY(r.assignees)) AS assignee_names
  FROM lead_assignment_rules r`;

export async function listRules({ status } = {}) {
  return (await many(`${RULE_SELECT} WHERE ($1::text IS NULL OR r.status = $1) ORDER BY r.priority, r.id`, [status || null])).map(ruleOut);
}

export async function getRule(id, db = db0) {
  const r = (await db.query(`${RULE_SELECT} WHERE r.id = $1`, [Number(id) || 0])).rows[0];
  if (!r) throw notFound('Assignment rule not found');
  return r;
}

/** Conditions kept: known keys with a value; the line of business as its code. */
function cleanConditions(c = {}) {
  const out = {};
  for (const k of CONDITION_KEYS) {
    const v = c[k];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    out[k] = k === 'lob' ? lobOf(v) : String(v).trim();
  }
  return out;
}

async function checkAssignees(ids) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Validation failed', [{ path: 'assignees', message: 'At least one account executive is required' }]);
  const found = await many("SELECT id FROM users WHERE id = ANY($1) AND status = 'active'", [ids]);
  const missing = ids.filter((id) => !found.some((f) => f.id === id));
  if (missing.length) throw badRequest('Validation failed', [{ path: 'assignees', message: `Not an active user: ${missing.join(', ')}` }]);
  return [...new Set(ids)];
}

export async function createRule(b, userId) {
  const assignees = await checkAssignees(b.assignees);
  const r = await one(`INSERT INTO lead_assignment_rules(name, priority, method, conditions, assignees, status, description, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`, [b.name.trim(), Number(b.priority ?? 100), b.method || 'round_robin', JSON.stringify(cleanConditions(b.conditions)),
    assignees, b.status || 'active', b.description || null, userId]);
  return ruleOut(await getRule(r.id));
}

export async function updateRule(id, b, userId) {
  const before = await getRule(id);
  const assignees = b.assignees !== undefined ? await checkAssignees(b.assignees) : before.assignees;
  await query(`UPDATE lead_assignment_rules SET name = $2, priority = $3, method = $4, conditions = $5, assignees = $6, status = $7, description = $8,
      last_assigned_user_id = CASE WHEN last_assigned_user_id = ANY($6) THEN last_assigned_user_id END, updated_by = $9, updated_at = now() WHERE id = $1`,
  [before.id, (b.name ?? before.name).trim(), Number(b.priority ?? before.priority), b.method || before.method,
    JSON.stringify(b.conditions !== undefined ? cleanConditions(b.conditions) : before.conditions), assignees, b.status || before.status,
    b.description !== undefined ? b.description : before.description, userId]);
  return { before: ruleOut(before), after: ruleOut(await getRule(before.id)) };
}

/** A rule that assigned prospects is made inactive (its history refers to it); one never used is removed. */
export async function deleteRule(id, userId) {
  const r = await getRule(id);
  const used = await one('SELECT 1 FROM lead_assignment_history WHERE rule_id = $1 LIMIT 1', [r.id]);
  if (used) await query("UPDATE lead_assignment_rules SET status = 'inactive', updated_by = $2, updated_at = now() WHERE id = $1", [r.id, userId]);
  else await query('DELETE FROM lead_assignment_rules WHERE id = $1', [r.id]);
  return { rule: ruleOut(r), removed: !used };
}

/** The lead's values the conditions are compared with. */
const leadFacts = (l) => ({
  branchCode: l.branch_code, lob: l.lob, source: l.source, leadCategory: l.lead_category, channelId: l.channel_id, province: l.state, city: l.city,
});

/** Whether every condition of the rule holds for the lead (text compared without case). */
export function ruleMatches(rule, lead) {
  const facts = leadFacts(lead);
  return Object.entries(rule.conditions || {}).every(([k, v]) => norm(facts[k]) === norm(v));
}

/** Active users among the rule's assignees, in the rule's order. */
async function activeAssignees(db, rule) {
  const rows = (await db.query("SELECT id FROM users WHERE id = ANY($1) AND status = 'active'", [rule.assignees || []])).rows.map((r) => r.id);
  return (rule.assignees || []).filter((id) => rows.includes(id));
}

/** The assignee the rule's method picks (null when none of its assignees is active). */
export async function pickAssignee(db, rule) {
  const users = await activeAssignees(db, rule);
  if (!users.length) return null;
  if (rule.method === 'fixed') return users[0];
  if (rule.method === 'load') {
    const counts = (await db.query(`SELECT owner_user_id AS id, count(*)::int AS n FROM leads WHERE owner_user_id = ANY($1) AND deleted_at IS NULL
      AND NOT (status = ANY($2)) GROUP BY 1`, [users, CLOSED])).rows;
    const load = (id) => counts.find((c) => c.id === id)?.n || 0;
    return [...users].sort((a, b) => load(a) - load(b) || users.indexOf(a) - users.indexOf(b))[0];
  }
  const last = users.indexOf(rule.last_assigned_user_id);
  return users[(last + 1) % users.length];
}

async function history(db, { leadId, from, to, ruleId = null, action, reason = null, by = null }) {
  await db.query(`INSERT INTO lead_assignment_history(lead_id, from_user_id, to_user_id, rule_id, action, reason, assigned_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [leadId, from || null, to || null, ruleId, action, reason, by]);
}

async function tellAssignee(userId, lead, why) {
  if (!userId || (await getSetting('leads.assignment_notify', true)) === false) return;
  await notify({ userId, type: 'info', title: 'Prospect assigned to you', message: `${lead.display_name} (${lead.lead_number})${why ? `: ${why}` : ''}`,
    link: `/agent/leadedit/${lead.id}`, entity: 'lead', entityId: lead.id }).catch(() => null);
}

/** Put a prospect in the reassignment queue. */
async function queueLead(db, lead, reason, by = null) {
  await db.query("UPDATE leads SET assignment_status = 'queued', queue_reason = $2, queued_at = now(), updated_at = now() WHERE id = $1", [lead.id, reason]);
  await history(db, { leadId: lead.id, from: lead.owner_user_id, to: null, action: 'queued', reason, by });
}

/**
 * Assign a new prospect (called inside the transaction that created it). Returns { userId, ruleId, queued } or null
 * when assignment is off or no rule is active.
 */
export async function assignNewLead(db, leadId, creatorId) {
  if ((await getSetting('leads.assignment_enabled', true)) === false) return null;
  const rules = (await db.query("SELECT * FROM lead_assignment_rules WHERE status = 'active' ORDER BY priority, id")).rows;
  if (!rules.length) return null;
  const lead = (await db.query('SELECT * FROM leads WHERE id = $1', [leadId])).rows[0];
  if (!lead) return null;
  for (const rule of rules) {
    if (!ruleMatches(rule, lead)) continue;
    // lock the rule so two prospects created together do not both take the same next assignee
    const locked = (await db.query('SELECT * FROM lead_assignment_rules WHERE id = $1 FOR UPDATE', [rule.id])).rows[0];
    const userId = await pickAssignee(db, locked);
    if (!userId) {
      await queueLead(db, lead, `No active account executive in rule "${rule.name}"`, creatorId);
      return { userId: null, ruleId: rule.id, queued: true };
    }
    await db.query(`UPDATE leads SET owner_user_id = $2, assignment_rule_id = $3, assignment_status = 'assigned', assigned_at = now(), queue_reason = NULL, queued_at = NULL
      WHERE id = $1`, [lead.id, userId, rule.id]);
    await db.query('UPDATE lead_assignment_rules SET last_assigned_user_id = $2 WHERE id = $1', [rule.id, userId]);
    await history(db, { leadId: lead.id, from: lead.owner_user_id, to: userId, ruleId: rule.id, action: 'auto', reason: `Rule "${rule.name}"`, by: creatorId });
    if (userId !== creatorId) await tellAssignee(userId, lead, `rule ${rule.name}`);
    return { userId, ruleId: rule.id, queued: false };
  }
  if ((await getSetting('leads.assignment_fallback', 'creator')) !== 'queue') return { userId: creatorId, ruleId: null, queued: false };
  await queueLead(db, lead, 'No assignment rule matched', creatorId);
  return { userId: null, ruleId: null, queued: true };
}

/** Reassign prospects to a user (one, a bulk selection, or from the queue). */
export async function reassign(leadIds, toUserId, { reason = null, action = 'manual', by }) {
  const ids = [...new Set((leadIds || []).map(String))];
  if (!ids.length) throw badRequest('Validation failed', [{ path: 'leadIds', message: 'Select at least one prospect' }]);
  const to = await one("SELECT id, display_name FROM users WHERE id = $1 AND status = 'active'", [toUserId]);
  if (!to) throw badRequest('Validation failed', [{ path: 'toUserId', message: 'Choose an active user' }]);
  return withTransaction(async (db) => {
    const leads = (await db.query('SELECT * FROM leads WHERE (id = ANY($1) OR lead_number = ANY($1)) AND deleted_at IS NULL FOR UPDATE', [ids])).rows;
    const missing = ids.filter((id) => !leads.some((l) => l.id === id || l.lead_number === id));
    if (missing.length) throw notFound(`Prospect not found: ${missing.join(', ')}`);
    for (const l of leads) {
      await db.query(`UPDATE leads SET owner_user_id = $2, assignment_status = 'assigned', assigned_at = now(), queue_reason = NULL, queued_at = NULL, updated_by = $3, updated_at = now()
        WHERE id = $1`, [l.id, to.id, by]);
      await history(db, { leadId: l.id, from: l.owner_user_id, to: to.id, action, reason, by });
    }
    for (const l of leads) await tellAssignee(to.id, l, reason);
    return { reassigned: leads.length, toUserId: to.id, toName: to.display_name, leads: leads.map((l) => ({ id: l.id, leadNumber: l.lead_number, fromUserId: l.owner_user_id })) };
  });
}

/** Send prospects to the reassignment queue by hand (an account executive leaving, a complaint ...). */
export async function sendToQueue(leadIds, reason, by) {
  if (!reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required' }]);
  return withTransaction(async (db) => {
    const leads = (await db.query('SELECT * FROM leads WHERE (id = ANY($1) OR lead_number = ANY($1)) AND deleted_at IS NULL FOR UPDATE', [leadIds.map(String)])).rows;
    if (!leads.length) throw notFound('Prospect not found');
    for (const l of leads) await queueLead(db, l, reason, by);
    return { queued: leads.length };
  });
}

const LEAD_ROW = `l.id, l.lead_number AS "leadNumber", l.display_name AS name, l.status, l.lob, l.source, l.lead_category AS "leadCategory",
  l.state AS province, l.city, l.branch_code AS "branchCode", l.channel_id AS "channelId", ch.name AS "channelName", l.owner_user_id AS "ownerUserId",
  u.display_name AS "ownerName", l.assignment_status AS "assignmentStatus", l.queue_reason AS "queueReason", l.queued_at AS "queuedAt",
  l.assigned_at AS "assignedAt", l.created_at AS "createdAt"`;
const LEAD_FROM = 'FROM leads l LEFT JOIN users u ON u.id = l.owner_user_id LEFT JOIN distribution_channels ch ON ch.id = l.channel_id';

/** The reassignment queue, oldest first. */
export async function queueList({ search } = {}) {
  return many(`SELECT ${LEAD_ROW} ${LEAD_FROM} WHERE l.deleted_at IS NULL AND l.assignment_status = 'queued'
    AND ($1::text IS NULL OR l.display_name ILIKE '%' || $1 || '%' OR l.lead_number ILIKE '%' || $1 || '%') ORDER BY l.queued_at NULLS FIRST, l.created_at`, [search || null]);
}

/** The assignment history of a prospect. */
export async function leadHistory(leadId) {
  return many(`SELECT h.id, h.action, h.reason, h.assigned_at AS "assignedAt", h.from_user_id AS "fromUserId", fu.display_name AS "fromName",
      h.to_user_id AS "toUserId", tu.display_name AS "toName", h.rule_id AS "ruleId", r.name AS "ruleName", bu.display_name AS "assignedBy"
    FROM lead_assignment_history h JOIN leads l ON l.id = h.lead_id LEFT JOIN users fu ON fu.id = h.from_user_id LEFT JOIN users tu ON tu.id = h.to_user_id
    LEFT JOIN users bu ON bu.id = h.assigned_by LEFT JOIN lead_assignment_rules r ON r.id = h.rule_id
    WHERE l.id = $1 OR l.lead_number = $1 ORDER BY h.assigned_at DESC, h.id DESC`, [String(leadId)]);
}

/** The user and everyone reporting to them, directly or not (users.reporting_to), with their depth. */
export async function teamOf(userId) {
  return many(`WITH RECURSIVE team AS (
      SELECT id, 0 AS depth, ARRAY[id] AS path FROM users WHERE id = $1
      UNION ALL SELECT u.id, t.depth + 1, t.path || u.id FROM users u JOIN team t ON u.reporting_to = t.id WHERE NOT u.id = ANY(t.path) AND t.depth < 10)
    SELECT t.id, t.depth, u.display_name AS name, u.username, u.branch_code AS "branchCode", u.designation, u.reporting_to AS "reportingTo", u.status
    FROM team t JOIN users u ON u.id = t.id ORDER BY t.depth, u.display_name`, [userId]);
}

/**
 * Team view: the members of a manager's team (the signed-in user unless they hold read:lead-assignment) with their
 * prospects by status, and the prospects of the team (or of one member).
 */
export async function teamView(user, { managerId = null, memberId = null, status = null } = {}) {
  const canAll = hasPermission(user, 'read:lead-assignment');
  const head = managerId && managerId !== user.id ? managerId : user.id;
  if (head !== user.id && !canAll) {
    const mine = await teamOf(user.id);
    if (!mine.some((m) => m.id === head)) throw forbidden('You can only view your own team');
  }
  const members = await teamOf(head);
  if (!members.length) throw notFound('User not found');
  const ids = members.map((m) => m.id);
  const counts = await many(`SELECT owner_user_id AS id, count(*)::int AS total,
      count(*) FILTER (WHERE NOT (status = ANY($2)))::int AS open,
      count(*) FILTER (WHERE status IN ('New', 'new'))::int AS new,
      count(*) FILTER (WHERE status IN ('Converted', 'converted'))::int AS converted,
      count(*) FILTER (WHERE status IN ('Lost', 'lost'))::int AS lost,
      count(*) FILTER (WHERE assignment_status = 'queued')::int AS queued,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last30
    FROM leads WHERE owner_user_id = ANY($1) AND deleted_at IS NULL GROUP BY 1`, [ids, CLOSED]);
  const zero = { total: 0, open: 0, new: 0, converted: 0, lost: 0, queued: 0, last30: 0 };
  const out = members.map((m) => ({ ...m, ...zero, ...(counts.find((c) => c.id === m.id) || {}), id: m.id }));
  const scope = memberId && ids.includes(memberId) ? [memberId] : ids;
  const leads = await many(`SELECT ${LEAD_ROW} ${LEAD_FROM} WHERE l.deleted_at IS NULL AND l.owner_user_id = ANY($1) AND ($2::text IS NULL OR l.status = $2)
    ORDER BY l.created_at DESC LIMIT 500`, [scope, status || null]);
  const totals = out.reduce((t, m) => Object.fromEntries(Object.keys(zero).map((k) => [k, t[k] + m[k]])), zero);
  return { managerId: head, members: out, totals, leads };
}

/** Daily job: prospects still New after leads.assignment_sla_hours go to the queue; the lead assignment team is told. */
export async function leadAssignmentSla() {
  const hours = Number(await getSetting('leads.assignment_sla_hours', 48));
  if (!(hours > 0)) return { skipped: 'leads.assignment_sla_hours is 0' };
  const stale = await many(`SELECT * FROM leads WHERE deleted_at IS NULL AND assignment_status = 'assigned' AND status IN ('New', 'new')
    AND COALESCE(assigned_at, created_at) < now() - make_interval(hours => $1)`, [hours]);
  for (const l of stale) await queueLead(db0, l, `Not worked within ${hours} hours`, null);
  if (stale.length) {
    await notify({ type: 'reminder', title: `${stale.length} prospect(s) queued for reassignment`, message: `Prospects still New after ${hours} hours were moved to the reassignment queue`,
      link: '/sales/lead-assignment', entity: 'lead_assignment', audience: 'write:lead-assignment' });
  }
  return { queued: stale.length };
}

/** Active users who may own prospects (they hold write:leads), with their open prospects. */
export async function assigneeOptions() {
  return many(`SELECT u.id, u.display_name AS name, u.username, u.branch_code AS "branchCode",
      (SELECT count(*)::int FROM leads l WHERE l.owner_user_id = u.id AND l.deleted_at IS NULL AND NOT (l.status = ANY($1))) AS open
    FROM users u WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM user_effective_roles(u.id) er JOIN role_permissions rp ON rp.role_id = er.role_id
      JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'write:leads')
    ORDER BY u.display_name`, [CLOSED]);
}
