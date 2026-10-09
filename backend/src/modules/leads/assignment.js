/**
 * Lead assignment (Operations > Sales & Marketing > Lead Assignment): rules that give each new prospect an account
 * executive, the reassignment queue, single and bulk reassignment, and the team view by reporting line.
 *
 * A rule matches on the prospect's branch, line of business, product, source, category, distribution channel and
 * territory (Province, City / Municipality); an empty condition matches anything. The first active rule by priority
 * (then id) that matches picks an active assignee: round_robin (the next one after the last assigned), load (fewest
 * open prospects) or fixed (the first one). With no active rule at all the creator keeps the prospect; when rules exist
 * but none matches, leads.assignment_fallback decides (queue or creator). A rule with a line of business does not match
 * a prospect whose product is not yet tagged, and the line NONE matches only such prospects; once tagged, a prospect
 * queued because no rule matched is offered to the rules again. The queue can also be run through the rules on demand.
 *
 * Reassigning, or sending a prospect to the queue, takes a reason: a reason code of the Reason Codes master (context
 * reassignment) with an optional note, or a note alone (leads.reassignment_reason_required for a reassignment).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { lobOf } from '../documents/common.js';
import { notify } from '../notifications/service.js';
import { decisionReason } from '../ops-masters/records.js';

export const METHODS = ['round_robin', 'load', 'fixed'];
export const CONDITION_KEYS = ['branchCode', 'lob', 'productId', 'source', 'leadCategory', 'channelId', 'province', 'city'];
/** Line condition of a rule for the prospects whose product is not yet tagged. */
export const UNTAGGED_LOB = 'NONE';
/** Reason codes of a reassignment or of a prospect sent to the queue (master reason-code). */
const REASON_CONTEXT = ['reassignment'];
/** Queue reason of a new prospect that no rule matched. */
const NO_RULE_MATCHED = 'No assignment rule matched';
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

const untaggedLine = (v) => norm(v) === norm(UNTAGGED_LOB);

/** Conditions kept: known keys with a value; the line of business as its code (NONE: product not yet tagged). */
function cleanConditions(c = {}) {
  const out = {};
  for (const k of CONDITION_KEYS) {
    const v = c[k];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    if (k === 'lob') out[k] = untaggedLine(v) ? UNTAGGED_LOB : lobOf(v);
    else out[k] = String(v).trim();
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

/** New priorities in the order given (10, 20, 30 ...); rules not listed keep theirs. */
export async function reorderRules(ids, userId) {
  const known = (await many('SELECT id FROM lead_assignment_rules WHERE id = ANY($1)', [ids.map(Number)])).map((r) => r.id);
  const missing = ids.filter((id) => !known.includes(Number(id)));
  if (missing.length) throw notFound(`Assignment rule not found: ${missing.join(', ')}`);
  await withTransaction(async (db) => {
    for (const [i, id] of ids.entries()) {
      await db.query('UPDATE lead_assignment_rules SET priority = $2, updated_by = $3, updated_at = now() WHERE id = $1', [Number(id), (i + 1) * 10, userId]);
    }
  });
  return listRules();
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
  branchCode: l.branch_code, lob: l.lob, productId: l.product_id, source: l.source, leadCategory: l.lead_category, channelId: l.channel_id, province: l.state, city: l.city,
});

/** Whether every condition of the rule holds for the lead (text compared without case; line NONE: no product yet). */
export function ruleMatches(rule, lead) {
  const facts = leadFacts(lead);
  return Object.entries(rule.conditions || {}).every(([k, v]) => (k === 'lob' && untaggedLine(v) ? !facts.lob : norm(facts[k]) === norm(v)));
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

async function history(db, { leadId, from, to, ruleId = null, action, reason = null, reasonCode = null, by = null }) {
  await db.query(`INSERT INTO lead_assignment_history(lead_id, from_user_id, to_user_id, rule_id, action, reason, reason_code, assigned_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [leadId, from || null, to || null, ruleId, action, reason, reasonCode, by]);
}

async function tellAssignee(userId, lead, why) {
  if (!userId || (await getSetting('leads.assignment_notify', true)) === false) return;
  await notify({ userId, type: 'info', title: 'Prospect assigned to you', message: `${lead.display_name} (${lead.lead_number})${why ? `: ${why}` : ''}`,
    link: `/agent/leadedit/${lead.id}`, entity: 'lead', entityId: lead.id }).catch(() => null);
}

/** Put a prospect in the reassignment queue. */
async function queueLead(db, lead, reason, by = null, reasonCode = null) {
  await db.query("UPDATE leads SET assignment_status = 'queued', queue_reason = $2, queue_reason_code = $3, queued_at = now(), updated_at = now() WHERE id = $1",
    [lead.id, reason, reasonCode]);
  await history(db, { leadId: lead.id, from: lead.owner_user_id, to: null, action: 'queued', reason, reasonCode, by });
}

/** Give the lead to the assignee the rule picks (null when none of its assignees is active). */
async function applyRule(db, lead, rule, by, why = `Rule "${rule.name}"`) {
  // lock the rule so two prospects assigned together do not both take the same next assignee
  const locked = (await db.query('SELECT * FROM lead_assignment_rules WHERE id = $1 FOR UPDATE', [rule.id])).rows[0];
  const userId = await pickAssignee(db, locked);
  if (!userId) return null;
  await db.query(`UPDATE leads SET owner_user_id = $2, assignment_rule_id = $3, assignment_status = 'assigned', assigned_at = now(), queue_reason = NULL,
      queue_reason_code = NULL, queued_at = NULL WHERE id = $1`, [lead.id, userId, rule.id]);
  await db.query('UPDATE lead_assignment_rules SET last_assigned_user_id = $2 WHERE id = $1', [rule.id, userId]);
  await history(db, { leadId: lead.id, from: lead.owner_user_id, to: userId, ruleId: rule.id, action: 'auto', reason: why, by });
  if (userId !== by) await tellAssignee(userId, lead, `rule ${rule.name}`);
  return userId;
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
    const userId = await applyRule(db, lead, rule, creatorId);
    if (!userId) {
      await queueLead(db, lead, `No active account executive in rule "${rule.name}"`, creatorId);
      return { userId: null, ruleId: rule.id, queued: true };
    }
    return { userId, ruleId: rule.id, queued: false };
  }
  if ((await getSetting('leads.assignment_fallback', 'creator')) !== 'queue') return { userId: creatorId, ruleId: null, queued: false };
  await queueLead(db, lead, NO_RULE_MATCHED, creatorId);
  return { userId: null, ruleId: null, queued: true };
}

/**
 * A prospect whose product was just tagged: when it waits in the queue because no rule matched it, the rules run again
 * and assign it if one now matches (a rule for its line). Returns the assignment, or null when nothing changed.
 */
export async function assignTaggedLead(db, leadId, by) {
  const lead = (await db.query('SELECT * FROM leads WHERE id = $1', [leadId])).rows[0];
  if (lead?.assignment_status !== 'queued' || lead.queue_reason !== NO_RULE_MATCHED) return null;
  if ((await getSetting('leads.assignment_enabled', true)) === false) return null;
  const rules = (await db.query("SELECT * FROM lead_assignment_rules WHERE status = 'active'")).rows;
  if (!rules.some((r) => ruleMatches(r, lead))) return null;
  return assignNewLead(db, leadId, by);
}

/** The reason of a reassignment or of a prospect sent to the queue: { code, text } (both null when none is given). */
async function reassignmentReason({ reasonCode, reason }, required) {
  const why = await decisionReason({ query }, REASON_CONTEXT, { reasonCode, reason });
  if (required && !why.text) throw badRequest('Validation failed', [{ path: 'reasonCode', message: 'Choose the reason or enter a note' }]);
  return why;
}

/** The prospects of the ids or numbers given, locked; all must exist. */
async function lockedLeads(db, leadIds) {
  const ids = [...new Set((leadIds || []).map(String))];
  if (!ids.length) throw badRequest('Validation failed', [{ path: 'leadIds', message: 'Select at least one prospect' }]);
  const leads = (await db.query('SELECT * FROM leads WHERE (id = ANY($1) OR lead_number = ANY($1)) AND deleted_at IS NULL FOR UPDATE', [ids])).rows;
  const missing = ids.filter((id) => !leads.some((l) => l.id === id || l.lead_number === id));
  if (missing.length) throw notFound(`Prospect not found: ${missing.join(', ')}`);
  return leads;
}

/**
 * Reassign prospects to a user (one, a bulk selection, or from the queue). action taken: the signed-in user takes
 * prospects waiting in the queue (no reason needed); other reassignments follow leads.reassignment_reason_required.
 */
export async function reassign(leadIds, toUserId, { reasonCode = null, reason = null, action = 'manual', by }) {
  const to = await one("SELECT id, display_name FROM users WHERE id = $1 AND status = 'active'", [toUserId]);
  if (!to) throw badRequest('Validation failed', [{ path: 'toUserId', message: 'Choose an active user' }]);
  const required = action !== 'taken' && (await getSetting('leads.reassignment_reason_required', true)) !== false;
  const why = await reassignmentReason({ reasonCode, reason }, required);
  return withTransaction(async (db) => {
    const leads = await lockedLeads(db, leadIds);
    if (action === 'taken') {
      const notQueued = leads.filter((l) => l.assignment_status !== 'queued');
      if (notQueued.length) throw badRequest('Validation failed', [{ path: 'leadIds', message: `Not in the reassignment queue: ${notQueued.map((l) => l.lead_number).join(', ')}` }]);
    }
    for (const l of leads) {
      await db.query(`UPDATE leads SET owner_user_id = $2, assignment_status = 'assigned', assigned_at = now(), queue_reason = NULL, queue_reason_code = NULL, queued_at = NULL,
          updated_by = $3, updated_at = now() WHERE id = $1`, [l.id, to.id, by]);
      await history(db, { leadId: l.id, from: l.owner_user_id, to: to.id, action, reason: why.text, reasonCode: why.code, by });
    }
    for (const l of leads) if (to.id !== by) await tellAssignee(to.id, l, why.text);
    return { reassigned: leads.length, toUserId: to.id, toName: to.display_name, reason: why.text, reasonCode: why.code,
      leads: leads.map((l) => ({ id: l.id, leadNumber: l.lead_number, fromUserId: l.owner_user_id })) };
  });
}

/** Send prospects to the reassignment queue by hand (an account executive leaving, a complaint ...); a reason is required. */
export async function sendToQueue(leadIds, { reasonCode = null, reason = null } = {}, by) {
  const why = await reassignmentReason({ reasonCode, reason }, true);
  return withTransaction(async (db) => {
    const leads = await lockedLeads(db, leadIds);
    for (const l of leads) await queueLead(db, l, why.text, by, why.code);
    return { queued: leads.length, reason: why.text, reasonCode: why.code };
  });
}

/**
 * Run the prospects waiting in the queue through the active rules: each one the first matching rule can give to an
 * active assignee is assigned (history action auto); the others stay. dryRun shows what would happen without changing
 * anything (round robin followed in memory). Returns { assigned: [{ leadId, leadNumber, name, ruleName, toUserId, toName }], unmatched }.
 */
export async function runQueue({ dryRun = false } = {}, by = null) {
  const rules = await many("SELECT * FROM lead_assignment_rules WHERE status = 'active' ORDER BY priority, id");
  const queued = await many("SELECT * FROM leads WHERE deleted_at IS NULL AND assignment_status = 'queued' ORDER BY queued_at NULLS FIRST, created_at");
  const names = Object.fromEntries((await many("SELECT id, display_name FROM users WHERE status = 'active'")).map((u) => [u.id, u.display_name]));
  const assigned = [];
  const lastOf = new Map(rules.map((r) => [r.id, r.last_assigned_user_id]));
  for (const lead of queued) {
    const rule = rules.find((r) => ruleMatches(r, lead) && (r.assignees || []).some((id) => names[id]));
    if (!rule) continue;
    let userId;
    if (dryRun) {
      userId = await pickAssignee(db0, { ...rule, last_assigned_user_id: lastOf.get(rule.id) });
      lastOf.set(rule.id, userId);
    } else {
      userId = await withTransaction((db) => applyRule(db, lead, rule, by, `Rule "${rule.name}" (queue run)`));
    }
    if (userId) assigned.push({ leadId: lead.id, leadNumber: lead.lead_number, name: lead.display_name, ruleId: rule.id, ruleName: rule.name, toUserId: userId, toName: names[userId] });
  }
  return { dryRun: Boolean(dryRun), assigned, unmatched: queued.length - assigned.length };
}

const LEAD_ROW = `l.id, l.lead_number AS "leadNumber", l.display_name AS name, l.status, l.lob, l.product_id AS "productId", p.name AS "productName", l.source,
  l.lead_category AS "leadCategory", l.state AS province, l.city, l.branch_code AS "branchCode", l.channel_id AS "channelId", ch.name AS "channelName",
  l.owner_user_id AS "ownerUserId", u.display_name AS "ownerName", l.assignment_status AS "assignmentStatus", l.queue_reason AS "queueReason",
  l.queue_reason_code AS "queueReasonCode", l.queued_at AS "queuedAt", l.assigned_at AS "assignedAt", l.created_at AS "createdAt"`;
const LEAD_FROM = `FROM leads l LEFT JOIN users u ON u.id = l.owner_user_id LEFT JOIN distribution_channels ch ON ch.id = l.channel_id
  LEFT JOIN products p ON p.id = l.product_id`;

/**
 * The reassignment queue, oldest first. Filters: search (name or number), lob (NONE: product not yet tagged),
 * branchCode, reasonCode (the reason code of a prospect sent by hand; NONE: queued by the system or without a code).
 */
export async function queueList({ search, lob, branchCode, reasonCode } = {}) {
  const untagged = lob && untaggedLine(lob);
  return many(`SELECT ${LEAD_ROW} ${LEAD_FROM} WHERE l.deleted_at IS NULL AND l.assignment_status = 'queued'
    AND ($1::text IS NULL OR l.display_name ILIKE '%' || $1 || '%' OR l.lead_number ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR ($2 = 'NONE' AND l.lob IS NULL) OR l.lob = $2) AND ($3::text IS NULL OR l.branch_code = $3)
    AND ($4::text IS NULL OR ($4 = 'NONE' AND l.queue_reason_code IS NULL) OR l.queue_reason_code = $4)
    ORDER BY l.queued_at NULLS FIRST, l.created_at`,
  [search || null, lob ? (untagged ? 'NONE' : lobOf(lob)) : null, branchCode || null, reasonCode ? (untaggedLine(reasonCode) ? 'NONE' : reasonCode) : null]);
}

/** The assignment history of a prospect. */
export async function leadHistory(leadId) {
  return many(`SELECT h.id, h.action, h.reason, h.reason_code AS "reasonCode", h.assigned_at AS "assignedAt", h.from_user_id AS "fromUserId", fu.display_name AS "fromName",
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

/**
 * Active users who may own prospects (they hold write:leads), with their open prospects. With leadIds, each user is
 * marked suggested when they are an assignee of the active rule that matches one of those prospects (the account
 * executives the assignment rules give that business to), with the names of those rules.
 */
export async function assigneeOptions({ leadIds = [] } = {}) {
  const users = await many(`SELECT u.id, u.display_name AS name, u.username, u.branch_code AS "branchCode", u.designation,
      (SELECT count(*)::int FROM leads l WHERE l.owner_user_id = u.id AND l.deleted_at IS NULL AND NOT (l.status = ANY($1))) AS open
    FROM users u WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM user_effective_roles(u.id) er JOIN role_permissions rp ON rp.role_id = er.role_id
      JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'write:leads')
    ORDER BY u.display_name`, [CLOSED]);
  const ids = [...new Set((leadIds || []).map(String))].filter(Boolean);
  const byUser = new Map();
  if (ids.length) {
    const leads = await many('SELECT * FROM leads WHERE (id = ANY($1) OR lead_number = ANY($1)) AND deleted_at IS NULL', [ids]);
    const rules = await many("SELECT * FROM lead_assignment_rules WHERE status = 'active' ORDER BY priority, id");
    for (const lead of leads) {
      const rule = rules.find((r) => ruleMatches(r, lead));
      for (const id of rule?.assignees || []) byUser.set(id, [...new Set([...(byUser.get(id) || []), rule.name])]);
    }
  }
  return users.map((u) => ({ ...u, suggested: byUser.has(u.id), rules: byUser.get(u.id) || [] }));
}
