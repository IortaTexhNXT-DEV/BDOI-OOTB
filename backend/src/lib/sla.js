/**
 * Service levels (Master > System Configuration > Service Levels; table sla_targets): the turnaround of every status a
 * document waits in, measured in working time (the working week and the holiday calendar, calendar.working_day_hours
 * per working day) or in calendar time. The sla-monitor job keeps a clock (sla_clocks) for every open item of an
 * active target: My Work lists the clocks due or breached, and a breach is escalated once to the roles of the target.
 */
import { many, one, query } from '../db/pool.js';
import { getSetting } from './settings.js';
import { workingCalendar } from './workingCalendar.js';
import { addDays, isoInZone, businessTimeZone } from './dates.js';
import { notify } from '../modules/notifications/service.js';

const HOUR_MS = 3600000;

/**
 * The open items of a target: SQL returning record_id, ref, title, client_name, owner_id, link and started_at (the
 * time the item entered the status). One entry per delivered target code; a target without one keeps no clock.
 */
export const OPEN_ITEMS = {
  'LEAD-NURTURE': `SELECT l.id::text AS record_id, l.lead_number AS ref, 'Prospect' AS title, l.display_name AS client_name, COALESCE(l.owner_user_id, l.created_by) AS owner_id,
      '/agent/leaddetail/' || l.id AS link, COALESCE(l.assigned_at, l.created_at) AS started_at
    FROM leads l WHERE l.deleted_at IS NULL AND lower(l.status) = 'new'`,
  'QUOTE-DESPATCH': `SELECT q.id::text AS record_id, q.quote_number AS ref, 'Quotation' AS title, c.display_name AS client_name, COALESCE(q.agent_user_id, q.created_by) AS owner_id, '/agent/quotation-detail/' || q.id AS link, q.created_at AS started_at
    FROM quotes q LEFT JOIN clients c ON c.id = q.client_id WHERE q.deleted_at IS NULL AND q.status IN ('draft', 'quoted')`,
  'POL-PEND': `SELECT pl.id::text AS record_id, pl.placement_number AS ref, 'Placement slip' AS title, COALESCE(c.display_name, pl.insured_name) AS client_name, COALESCE(pl.owner_user_id, pl.created_by) AS owner_id, '/placement/placement-slips/' || pl.id AS link, pl.created_at AS started_at
    FROM placements pl LEFT JOIN clients c ON c.id = pl.client_id WHERE pl.status = 'draft'`,
  'POL-PLACED': `SELECT pl.id::text AS record_id, pl.placement_number AS ref, 'Placement slip' AS title, COALESCE(c.display_name, pl.insured_name) AS client_name, COALESCE(pl.owner_user_id, pl.created_by) AS owner_id, '/placement/placement-slips/' || pl.id AS link, COALESCE(pl.sent_at, pl.updated_at) AS started_at
    FROM placements pl LEFT JOIN clients c ON c.id = pl.client_id WHERE pl.status IN ('sent', 'acknowledged')`,
  'POL-RECVD': `SELECT pl.id::text AS record_id, pl.placement_number AS ref, 'Placement slip' AS title, COALESCE(c.display_name, pl.insured_name) AS client_name, COALESCE(pl.owner_user_id, pl.created_by) AS owner_id, '/placement/placement-slips/' || pl.id AS link, COALESCE(pl.epolicy_received_at, pl.updated_at) AS started_at
    FROM placements pl LEFT JOIN clients c ON c.id = pl.client_id WHERE pl.status IN ('epolicy_received', 'checked')`,
  'END-REQ': `SELECT e.id::text AS record_id, e.endorsement_number AS ref, 'Endorsement' AS title, c.display_name AS client_name, e.created_by AS owner_id, '/agent/endorsementdetailedview/' || e.id AS link, e.created_at AS started_at
    FROM endorsements e LEFT JOIN clients c ON c.id = e.client_id WHERE NOT e.is_cancel AND e.status IN ('draft', 'submitted')`,
  'END-PLACED': `SELECT e.id::text AS record_id, e.endorsement_number AS ref, 'Endorsement' AS title, c.display_name AS client_name, e.created_by AS owner_id, '/agent/endorsementdetailedview/' || e.id AS link, COALESCE(e.sent_at, e.updated_at) AS started_at
    FROM endorsements e LEFT JOIN clients c ON c.id = e.client_id WHERE NOT e.is_cancel AND e.status = 'sent'`,
  'CAN-REQ': `SELECT e.id::text AS record_id, e.endorsement_number AS ref, 'Cancellation' AS title, c.display_name AS client_name, e.created_by AS owner_id, '/agent/endorsementdetailedview/' || e.id AS link, e.created_at AS started_at
    FROM endorsements e LEFT JOIN clients c ON c.id = e.client_id WHERE e.is_cancel AND e.status IN ('draft', 'submitted')`,
  'CAN-DONE': `SELECT e.id::text AS record_id, e.endorsement_number AS ref, 'Cancellation' AS title, c.display_name AS client_name, e.created_by AS owner_id, '/agent/endorsementdetailedview/' || e.id AS link, COALESCE(e.sent_at, e.updated_at) AS started_at
    FROM endorsements e LEFT JOIN clients c ON c.id = e.client_id WHERE e.is_cancel AND e.status IN ('sent', 'cancel-initiated')`,
  'CLAIM-HANDLING': `SELECT k.id::text AS record_id, k.claim_number AS ref, 'Claim' AS title, c.display_name AS client_name, COALESCE(k.handler_user_id, k.created_by) AS owner_id, '/agent/claimdetail/' || k.id AS link, COALESCE(k.reported_date::timestamptz, k.created_at) AS started_at
    FROM claims k LEFT JOIN clients c ON c.id = k.client_id WHERE lower(COALESCE(k.status, '')) NOT IN ('closed', 'settled', 'rejected', 'withdrawn', 'repudiated', 'cancelled')`,
};

export const toTarget = (r) => ({
  id: r.id, code: r.code, document: r.document, name: r.name, description: r.description, targetHours: Number(r.target_hours), workingTime: r.working_time,
  escalateToRoles: Array.isArray(r.escalate_to_roles) ? r.escalate_to_roles : [], active: r.active, sortOrder: r.sort_order, monitored: !!OPEN_ITEMS[r.code],
  updatedBy: r.updated_by_name || r.updated_by, updatedAt: r.updated_at,
});

export async function listTargets({ document = null, active = null } = {}) {
  const where = ['TRUE'];
  const values = [];
  if (document) { values.push(String(document)); where.push(`t.document = $${values.length}`); }
  if (active === true || active === 'true') where.push('t.active');
  if (active === false || active === 'false') where.push('NOT t.active');
  return (await many(`SELECT t.*, (SELECT u.display_name FROM users u WHERE u.id = t.updated_by) AS updated_by_name FROM sla_targets t WHERE ${where.join(' AND ')} ORDER BY t.sort_order, t.code`, values)).map(toTarget);
}

/**
 * The deadline of an item that entered a status at `startedAt` under a target. Working time counts the hours of the
 * working days only (calendar.working_day_hours each, from the start of the next working day when the item starts on
 * a non-working day; the remainder of a day counted on the day it falls in); calendar time adds the hours as they are.
 */
export async function deadlineOf(target, startedAt, { calendar = null } = {}) {
  const start = new Date(startedAt);
  const hours = Number(target.targetHours ?? target.target_hours);
  if (!(target.workingTime ?? target.working_time)) return new Date(start.getTime() + hours * HOUR_MS);
  const perDay = Math.max(1, Number(await getSetting('calendar.working_day_hours', 8)) || 8);
  const tz = await businessTimeZone();
  const startDay = isoInZone(start, tz);
  const cal = calendar || await workingCalendar(startDay, addDays(startDay, Math.ceil(hours / perDay) * 3 + 14));
  const wholeDays = Math.floor(hours / perDay);
  const rest = hours - wholeDays * perDay;
  // a start on a non-working day counts from the next working day
  let day = cal.isWorking(startDay) ? startDay : cal.onOrAfter(startDay);
  let at = day === startDay ? start : new Date(`${day}T00:00:00Z`);
  if (wholeDays) { day = cal.add(day, wholeDays); at = new Date(at.getTime() + (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${isoInZone(at, tz)}T00:00:00Z`))); }
  if (rest) {
    at = new Date(at.getTime() + rest * HOUR_MS);
    const landing = isoInZone(at, tz);
    if (!cal.isWorking(landing)) at = new Date(at.getTime() + (Date.parse(`${cal.onOrAfter(landing)}T00:00:00Z`) - Date.parse(`${landing}T00:00:00Z`)));
  }
  return at;
}

/** Users holding one of the roles (their ids), for the escalation of a breach. */
async function usersOfRoles(roles) {
  if (!roles.length) return [];
  return (await many(`SELECT DISTINCT u.id FROM users u JOIN user_effective_roles(u.id) er ON TRUE WHERE u.status = 'active' AND er.code = ANY($1::text[])`, [roles])).map((r) => r.id);
}

/**
 * The sla-monitor job: open a clock for every open item of every active target, close the clocks of items that left
 * their status, mark the breaches and escalate each breach once to the target's roles. `now` is for tests.
 */
export async function slaMonitor(_params = {}, { now = new Date() } = {}) {
  const targets = (await listTargets({ active: true })).filter((t) => OPEN_ITEMS[t.code]);
  const escalate = (await getSetting('sla.escalation_enabled', true)) !== false;
  const out = { opened: 0, closed: 0, breached: 0, escalated: 0 };
  const tz = await businessTimeZone();
  const today = isoInZone(now, tz);
  const calendar = await workingCalendar(addDays(today, -120), addDays(today, 60));
  for (const t of targets) {
    const items = await many(OPEN_ITEMS[t.code]);
    const ids = items.map((i) => i.record_id);
    const closed = await query('UPDATE sla_clocks SET closed_at = $3, updated_at = $3 WHERE target_code = $1 AND closed_at IS NULL AND NOT (record_id = ANY($2::text[])) RETURNING id', [t.code, ids, now]);
    out.closed += closed.rowCount;
    for (const i of items) {
      const due = await deadlineOf(t, i.started_at, { calendar });
      const r = await query(`INSERT INTO sla_clocks(target_code, document, record_id, ref, title, client_name, owner_id, link, started_at, due_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (target_code, record_id) WHERE closed_at IS NULL DO UPDATE SET due_at = EXCLUDED.due_at, owner_id = EXCLUDED.owner_id, client_name = EXCLUDED.client_name, updated_at = now()
        RETURNING id, (xmax = 0) AS inserted, breached_at, escalated_at, due_at`, [t.code, t.document, i.record_id, i.ref, i.title, i.client_name, i.owner_id, i.link, i.started_at, due]);
      const row = r.rows[0];
      if (row.inserted) out.opened += 1;
      if (!row.breached_at && new Date(row.due_at) < now) {
        await query('UPDATE sla_clocks SET breached_at = $2, updated_at = $2 WHERE id = $1', [row.id, now]);
        out.breached += 1;
        if (escalate && !row.escalated_at) {
          const users = await usersOfRoles(t.escalateToRoles);
          const title = `Service level breached: ${t.name}`;
          const message = `${i.title} ${i.ref || ''} (${i.client_name || 'no client'}) has passed its ${t.targetHours}-hour turnaround`;
          for (const userId of users) await notify({ userId, type: 'alert', priority: 'high', title, message, link: i.link, entity: 'sla_clock', entityId: row.id });
          if (i.owner_id && !users.includes(i.owner_id)) await notify({ userId: i.owner_id, type: 'alert', priority: 'high', title, message, link: i.link, entity: 'sla_clock', entityId: row.id });
          await query('UPDATE sla_clocks SET escalated_at = $2 WHERE id = $1', [row.id, now]);
          out.escalated += 1;
        }
      }
    }
  }
  return out;
}

/** The open clocks (optionally of one target or one owner), newest breach first. */
export async function listClocks({ targetCode = null, ownerId = null, breached = null, limit = 200 } = {}) {
  const where = ['c.closed_at IS NULL'];
  const values = [];
  if (targetCode) { values.push(targetCode); where.push(`c.target_code = $${values.length}`); }
  if (ownerId) { values.push(ownerId); where.push(`c.owner_id = $${values.length}`); }
  if (breached === true || breached === 'true') where.push('c.breached_at IS NOT NULL');
  values.push(Math.min(1000, Number(limit) || 200));
  return (await many(`SELECT c.*, t.name AS target_name, t.target_hours, u.display_name AS owner_name FROM sla_clocks c JOIN sla_targets t ON t.code = c.target_code
    LEFT JOIN users u ON u.id = c.owner_id WHERE ${where.join(' AND ')} ORDER BY c.breached_at DESC NULLS LAST, c.due_at LIMIT $${values.length}`, values)).map((r) => ({
    id: Number(r.id), targetCode: r.target_code, targetName: r.target_name, targetHours: Number(r.target_hours), document: r.document, recordId: r.record_id, ref: r.ref, title: r.title,
    clientName: r.client_name, ownerId: r.owner_id, ownerName: r.owner_name, link: r.link, startedAt: r.started_at, dueAt: r.due_at, breachedAt: r.breached_at, escalatedAt: r.escalated_at,
  }));
}

export const summary = async () => one(`SELECT count(*)::int AS open, count(*) FILTER (WHERE breached_at IS NOT NULL)::int AS breached,
  count(*) FILTER (WHERE breached_at IS NULL AND due_at < now() + interval '8 hours')::int AS due_soon FROM sla_clocks WHERE closed_at IS NULL`);
