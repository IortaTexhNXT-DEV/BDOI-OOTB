/**
 * Call-out leads of the telesales incentive (TIS-BRD-COMM-08, FRS FR-TSI-010): on Lead Assignment the Team Leader of a
 * caller endorses the prospects given to the caller as official call-out leads, before the quotation is created. Only
 * a policy quoted on an endorsed prospect within incentive.telesales.callout_validity_days counts for the caller
 * (incentive/telesales.js attribute()).
 *
 * - Endorse: write:callout-endorsement; the prospect's owner is an active caller of a Telesales program whose Team
 *   Leader is the signed-in user (or the user holds approve:incentive). Others are skipped with the reason (MSG-TSI-029).
 * - Withdraw: only while the prospect has no quotation (MSG-TSI-030), with a reason.
 * - Reassignment: the Team Leader moving an endorsed prospect to another caller of the team moves the endorsement; a
 *   reassignment by anyone else ends it. A call-out assignment rule endorses every prospect it gives to a caller.
 * Each step is an entry of the prospect's Assignment history.
 */
import { many, withTransaction } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';

const TELESALES = 'Telesales';

/** The caller row of a user active on a date (any Telesales program not deleted), or null. */
async function callerRowOf(db, userId, date) {
  return (await db.query(`SELECT c.* FROM incentive_callers c JOIN incentive_programs p ON p.id = c.program_id WHERE p.program_type = $1 AND p.status NOT IN ('Deleted', 'Inactive')
    AND c.user_id = $2 AND c.date_from <= $3::date AND COALESCE(c.date_to, '9999-12-31') >= $3::date ORDER BY c.date_from DESC LIMIT 1`, [TELESALES, userId, date])).rows[0] || null;
}

async function history(db, leadId, { to = null, action, reason, by }) {
  await db.query('INSERT INTO lead_assignment_history(lead_id, from_user_id, to_user_id, rule_id, action, reason, assigned_by) VALUES ($1,NULL,$2,NULL,$3,$4,$5)', [leadId, to, action, reason, by]);
}

async function lockedLeads(db, leadIds) {
  const ids = [...new Set((leadIds || []).map(String))];
  if (!ids.length) throw badRequest('Validation failed', [{ path: 'leadIds', message: 'Select at least one prospect' }]);
  const leads = (await db.query(`SELECT l.*, u.display_name AS owner_name FROM leads l LEFT JOIN users u ON u.id = l.owner_user_id
    WHERE (l.id = ANY($1) OR l.lead_number = ANY($1)) AND l.deleted_at IS NULL FOR UPDATE OF l`, [ids])).rows;
  const missing = ids.filter((id) => !leads.some((l) => l.id === id || l.lead_number === id));
  if (missing.length) throw notFound(`Prospect not found: ${missing.join(', ')}`);
  return leads;
}

/** Whether the user may endorse for the caller row (its Team Leader, or a holder of approve:incentive). */
const mayAct = (user, row) => !!row && (row.team_leader_id === user.id || hasPermission(user, 'approve:incentive'));

/** Endorse prospects as call-out leads for their callers. Returns { endorsed, skipped: [{ leadNumber, reason }] }. */
export async function endorse(leadIds, user) {
  const t = await today();
  return withTransaction(async (db) => {
    const leads = await lockedLeads(db, leadIds);
    const endorsed = [];
    const skipped = [];
    for (const l of leads) {
      const row = l.owner_user_id ? await callerRowOf(db, l.owner_user_id, t) : null;
      if (!mayAct(user, row)) { skipped.push({ leadId: l.id, leadNumber: l.lead_number, reason: `${l.lead_number} is not assigned to a caller of your team` }); continue; }
      const open = (await db.query('SELECT * FROM callout_endorsements WHERE lead_id = $1 AND status = \'endorsed\'', [l.id])).rows[0];
      if (open?.caller_user_id === l.owner_user_id) { skipped.push({ leadId: l.id, leadNumber: l.lead_number, reason: `${l.lead_number} is already endorsed for ${l.owner_name}` }); continue; }
      if (open) await db.query('UPDATE callout_endorsements SET status = \'ended\', ended_at = now(), ended_by = $2, end_reason = $3 WHERE id = $1', [open.id, user.id, 'Endorsed again for the prospect owner']);
      const e = (await db.query('INSERT INTO callout_endorsements(lead_id, caller_user_id, endorsed_by) VALUES ($1,$2,$3) RETURNING id, endorsed_at', [l.id, l.owner_user_id, user.id])).rows[0];
      await history(db, l.id, { to: l.owner_user_id, action: 'callout-endorse', reason: `Endorsed as call-out lead for ${l.owner_name}`, by: user.id });
      endorsed.push({ leadId: l.id, leadNumber: l.lead_number, callerId: l.owner_user_id, caller: l.owner_name, endorsementId: Number(e.id), endorsedAt: e.endorsed_at });
    }
    return { endorsed, skipped, message: `${endorsed.length} prospects endorsed as call-out leads` };
  });
}

/** Withdraw the endorsement of prospects that have no quotation yet; a reason is required. */
export async function withdraw(leadIds, reason, user) {
  const why = String(reason || '').trim();
  if (!why) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required to withdraw the endorsement' }]);
  const t = await today();
  return withTransaction(async (db) => {
    const leads = await lockedLeads(db, leadIds);
    const withdrawn = [];
    const skipped = [];
    for (const l of leads) {
      const open = (await db.query('SELECT * FROM callout_endorsements WHERE lead_id = $1 AND status = \'endorsed\'', [l.id])).rows[0];
      if (!open) { skipped.push({ leadId: l.id, leadNumber: l.lead_number, reason: `${l.lead_number} is not endorsed as a call-out lead` }); continue; }
      const row = await callerRowOf(db, open.caller_user_id, t);
      if (!(open.endorsed_by === user.id || mayAct(user, row))) { skipped.push({ leadId: l.id, leadNumber: l.lead_number, reason: `${l.lead_number} is not assigned to a caller of your team` }); continue; }
      const q = (await db.query('SELECT quote_number FROM quotes WHERE lead_id = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1', [l.id])).rows[0];
      if (q) { skipped.push({ leadId: l.id, leadNumber: l.lead_number, reason: `${l.lead_number} already has quotation ${q.quote_number}; the endorsement cannot be withdrawn` }); continue; }
      await db.query('UPDATE callout_endorsements SET status = \'withdrawn\', ended_at = now(), ended_by = $2, end_reason = $3 WHERE id = $1', [open.id, user.id, why]);
      await history(db, l.id, { to: open.caller_user_id, action: 'callout-withdraw', reason: `Call-out endorsement withdrawn: ${why}`, by: user.id });
      withdrawn.push({ leadId: l.id, leadNumber: l.lead_number });
    }
    if (!withdrawn.length && skipped.length) throw badRequest(skipped[0].reason, skipped.map((s) => ({ path: 'leadIds', message: s.reason })));
    return { withdrawn, skipped, message: `${withdrawn.length} endorsements withdrawn` };
  });
}

/**
 * A prospect reassigned (inside the reassignment transaction): its open endorsement moves to the new owner when the
 * Team Leader gives it to another caller of the team, and ends otherwise.
 */
export async function onReassign(db, lead, toUserId, by) {
  const open = (await db.query('SELECT * FROM callout_endorsements WHERE lead_id = $1 AND status = \'endorsed\'', [lead.id])).rows[0];
  if (!open || open.caller_user_id === toUserId) return null;
  const t = await today();
  const row = await callerRowOf(db, toUserId, t);
  const names = new Map((await db.query('SELECT id, display_name FROM users WHERE id = ANY($1)', [[toUserId, by].filter(Boolean)])).rows.map((u) => [u.id, u.display_name]));
  if (row && by && row.team_leader_id === by) {
    await db.query('UPDATE callout_endorsements SET status = \'moved\', ended_at = now(), ended_by = $2, end_reason = $3 WHERE id = $1', [open.id, by, `Moved to ${names.get(toUserId)}`]);
    await db.query('INSERT INTO callout_endorsements(lead_id, caller_user_id, endorsed_by) VALUES ($1,$2,$3)', [lead.id, toUserId, by]);
    await history(db, lead.id, { to: toUserId, action: 'callout-move', reason: `Call-out endorsement moved to ${names.get(toUserId)} by the Team Leader`, by });
    return 'moved';
  }
  const why = `Reassigned to ${names.get(toUserId) || 'another user'}${by ? ` by ${names.get(by) || 'another user'}` : ''}, not by the caller's Team Leader`;
  await db.query('UPDATE callout_endorsements SET status = \'ended\', ended_at = now(), ended_by = $2, end_reason = $3 WHERE id = $1', [open.id, by || null, why]);
  await history(db, lead.id, { to: toUserId, action: 'callout-end', reason: `Call-out endorsement ended: ${why}`, by: by || null });
  return 'ended';
}

/** A prospect assigned by a call-out rule to a caller is endorsed at assignment (by the user who saved the rule). */
export async function onRuleAssign(db, lead, rule, userId) {
  if (!rule?.callout || !userId) return null;
  const row = await callerRowOf(db, userId, await today());
  if (!row) return null;
  const open = (await db.query('SELECT * FROM callout_endorsements WHERE lead_id = $1 AND status = \'endorsed\'', [lead.id])).rows[0];
  if (open?.caller_user_id === userId) return null;
  const by = rule.updated_by || rule.created_by || null;
  if (open) await db.query('UPDATE callout_endorsements SET status = \'ended\', ended_at = now(), ended_by = $2, end_reason = $3 WHERE id = $1', [open.id, by, `Assigned by rule "${rule.name}"`]);
  await db.query('INSERT INTO callout_endorsements(lead_id, caller_user_id, endorsed_by, rule_id) VALUES ($1,$2,$3,$4)', [lead.id, userId, by, rule.id]);
  await history(db, lead.id, { to: userId, action: 'callout-endorse', reason: `Endorsed as call-out lead by call-out rule "${rule.name}"`, by });
  return 'endorsed';
}

/** The Call-out lead column of a prospect row (SQL): { endorsedAt, endorsedBy, callerId, expired } or null. */
export const CALLOUT_COLUMN = `(SELECT json_build_object('endorsedAt', e.endorsed_at, 'endorsedBy', eu.display_name, 'callerId', e.caller_user_id, 'ruleId', e.rule_id)
  FROM callout_endorsements e LEFT JOIN users eu ON eu.id = e.endorsed_by WHERE e.lead_id = l.id AND e.status = 'endorsed' LIMIT 1) AS "callout"`;

/** Open endorsements of the prospects of users (the Call-out count of the Team View). */
export async function calloutCounts(userIds) {
  if (!userIds.length) return new Map();
  const rows = await many(`SELECT l.owner_user_id AS id, count(*)::int AS n FROM callout_endorsements e JOIN leads l ON l.id = e.lead_id
    WHERE e.status = 'endorsed' AND l.owner_user_id = ANY($1) AND l.deleted_at IS NULL GROUP BY 1`, [userIds]);
  return new Map(rows.map((r) => [r.id, r.n]));
}
