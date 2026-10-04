/**
 * Operations > My Work: what waits on the signed-in user (scope "me"), on the people reporting to them ("team") or on
 * anyone ("all", within the user's permissions and record scope), read from the modules through sources.js.
 *
 * Scope rules: "me" = items owned by the user plus queue items they may decide (approvals, unassigned claims,
 * collection follow-ups, data subject requests of their team); "team" = items owned by users reporting to them through
 * users.reporting_to (any depth); "all" = every item of the categories the user may read.
 */
import { pool } from '../../db/pool.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { isAdmin } from '../../lib/auth.js';
import { today as businessToday, addDays } from '../../lib/dates.js';
import { CATEGORIES, CATEGORY_CODES, buildContext, unionSql, visibleCategories } from './sources.js';
import { teamOf } from './team.js';

export const SCOPES = ['me', 'team', 'all'];
const PRIORITY_RANK = "CASE eff_priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END";
const SORTS = {
  due: (dir) => `due_date ${dir} NULLS LAST, ${PRIORITY_RANK} DESC, created_at`,
  priority: (dir) => `${PRIORITY_RANK} ${dir}, due_date ASC NULLS LAST`,
  client: (dir) => `client_name ${dir} NULLS LAST, due_date ASC NULLS LAST`,
  category: (dir) => `category ${dir}, due_date ASC NULLS LAST`,
  created: (dir) => `created_at ${dir} NULLS LAST`,
  amount: (dir) => `amount ${dir} NULLS LAST, due_date ASC NULLS LAST`,
};

/** The query context and the scope condition on the union (owner_id / queue columns). */
async function prepare(user, { scope = 'me', recordScope = null, assignee = null, db = pool }) {
  if (!SCOPES.includes(scope)) throw badRequest(`scope must be one of ${SCOPES.join(', ')}`);
  const today = await businessToday();
  const ctx = await buildContext(user, { scope: recordScope, today, db });
  let team = [];
  let where;
  if (scope === 'me') {
    where = `(owner_id = ${ctx.P(user.id)} OR (owner_id IS NULL AND queue))`;
  } else if (scope === 'team') {
    team = await teamOf(user.id, db);
    if (assignee && !team.some((u) => u.id === assignee)) throw forbidden('That user does not report to you');
    where = `owner_id = ANY(${ctx.P(assignee ? [assignee] : team.map((u) => u.id))}::text[])`;
  } else {
    where = assignee ? `owner_id = ${ctx.P(assignee)}` : 'TRUE';
  }
  return { ctx, today, team, where };
}

/** Condition of a due-date bucket: overdue, today, soon (the next myWork.due_soon_days days), later, none. */
function dueCondition(ctx, due) {
  const T = ctx.T;
  switch (due) {
    case 'overdue': return `due_date < ${T}::date`;
    case 'today': return `due_date = ${T}::date`;
    case 'soon': return `due_date > ${T}::date AND due_date <= ${T}::date + ${ctx.P(ctx.soonDays)}::int`;
    case 'open': return `(due_date IS NULL OR due_date <= ${T}::date + ${ctx.P(ctx.soonDays)}::int)`;
    case 'later': return `due_date > ${T}::date + ${ctx.P(ctx.soonDays)}::int`;
    case 'none': return 'due_date IS NULL';
    default: return null;
  }
}

/** The filtered set as a CTE: `f` with eff_priority (an overdue item is at least high). */
async function filtered(user, q, { db = pool, categories = null } = {}) {
  const prep = await prepare(user, { scope: q.scope || 'me', recordScope: q.recordScope, assignee: q.assignee || null, db });
  const { ctx } = prep;
  const allowed = visibleCategories(user).map((c) => c.code);
  let cats = categories || allowed;
  if (q.category) {
    const asked = String(q.category).split(',').map((s) => s.trim()).filter(Boolean);
    for (const c of asked) if (!CATEGORY_CODES.includes(c)) throw badRequest(`Unknown category ${c}`);
    cats = cats.filter((c) => asked.includes(c));
  }
  cats = cats.filter((c) => allowed.includes(c));
  const union = await unionSql(ctx, cats);
  const conds = [prep.where];
  const due = dueCondition(ctx, q.due);
  if (q.due && !due) throw badRequest('due must be overdue, today, soon, open, later or none');
  if (due) conds.push(due);
  if (q.priority) conds.push(`eff_priority = ANY(${ctx.P(String(q.priority).split(','))}::text[])`);
  if (q.kind) conds.push(`kind = ${ctx.P(String(q.kind))}`);
  if (q.search) {
    conds.push(`concat_ws(' ', ref, title, client_name, kind, next_action) ILIKE '%' || ${ctx.P(String(q.search).trim())} || '%'`);
  }
  if (q.from) conds.push(`due_date >= ${ctx.P(String(q.from))}::date`);
  if (q.to) conds.push(`due_date <= ${ctx.P(String(q.to))}::date`);
  const cte = union
    ? `WITH u AS (${union}), f AS (SELECT u.*, CASE WHEN u.priority = 'urgent' THEN 'urgent' WHEN u.due_date < ${ctx.T}::date THEN 'high' ELSE u.priority END AS eff_priority FROM u)
       , w AS (SELECT * FROM f WHERE ${conds.join(' AND ')})`
    : null;
  return { ...prep, cte, cats };
}

const toItem = (r, today, owners) => ({
  category: r.category, kind: r.kind, id: r.id, ref: r.ref, title: r.title, clientName: r.client_name, dueDate: r.due_date,
  overdue: !!r.due_date && r.due_date < today, dueToday: r.due_date === today, priority: r.eff_priority, status: r.status, nextAction: r.next_action,
  ownerId: r.owner_id, ownerName: r.owner_id ? owners.get(r.owner_id) || null : null, queue: !!r.queue && !r.owner_id, link: r.link,
  amount: r.amount === null || r.amount === undefined ? null : Number(r.amount), createdAt: r.created_at, reassign: r.reassign || null,
});

async function ownerNames(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const { rows } = await db.query('SELECT id, display_name FROM users WHERE id = ANY($1::text[])', [list]);
  return new Map(rows.map((r) => [r.id, r.display_name]));
}

/** GET /my-work/items: one page of open items, open tasks included (category=tasks for the tasks alone). */
export async function listItems(user, q, pg, { db = pool } = {}) {
  const f = await filtered(user, q, { db });
  if (!f.cte) return { rows: [], total: 0 };
  const dir = String(q.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sort = (SORTS[q.sort] || SORTS.due)(dir);
  const { ctx } = f;
  const { rows } = await db.query(`${f.cte} SELECT w.*, count(*) OVER () AS total FROM w ORDER BY ${sort}, id
    LIMIT ${ctx.P(pg.limit)} OFFSET ${ctx.P(pg.offset)}`, ctx.params);
  const owners = await ownerNames(db, rows.map((r) => r.owner_id));
  return { rows: rows.map((r) => toItem(r, f.today, owners)), total: rows.length ? Number(rows[0].total) : 0 };
}

/** GET /my-work/summary: header figures and one entry per category (count, overdue, due today, due soon, next due date). */
export async function summary(user, q, { db = pool } = {}) {
  const scope = q.scope || 'me';
  const f = await filtered(user, { scope, recordScope: q.recordScope, assignee: q.assignee }, { db });
  const { ctx } = f;
  const byCat = new Map();
  if (f.cte) {
    const { rows } = await db.query(`${f.cte} SELECT category, count(*)::int AS total,
        count(*) FILTER (WHERE due_date < ${ctx.T}::date)::int AS overdue,
        count(*) FILTER (WHERE due_date = ${ctx.T}::date)::int AS due_today,
        count(*) FILTER (WHERE due_date > ${ctx.T}::date AND due_date <= ${ctx.T}::date + ${ctx.P(ctx.soonDays)}::int)::int AS due_soon,
        count(*) FILTER (WHERE eff_priority IN ('high', 'urgent'))::int AS high,
        min(due_date) FILTER (WHERE due_date >= ${ctx.T}::date) AS next_due
      FROM w GROUP BY category`, ctx.params);
    for (const r of rows) byCat.set(r.category, r);
  }
  const visible = visibleCategories(user);
  const categories = visible.map((c) => {
    const r = byCat.get(c.code) || {};
    return { code: c.code, label: c.label, icon: c.icon, count: r.total || 0, overdue: r.overdue || 0, dueToday: r.due_today || 0, dueSoon: r.due_soon || 0, high: r.high || 0, nextDue: r.next_due || null };
  });
  const sum = (k) => categories.reduce((s, c) => s + c[k], 0);
  const team = scope === 'team' ? f.team : await teamOf(user.id, db);
  return {
    asOf: f.today, scope, dueSoonDays: ctx.soonDays,
    totals: { open: sum('count'), overdue: sum('overdue'), dueToday: sum('dueToday'), dueSoon: sum('dueSoon'), high: sum('high') },
    categories,
    team: { size: team.length, isManager: team.length > 0 },
    isAdmin: isAdmin(user),
  };
}

/** GET /my-work/team: per team member, open items by category with overdue and due today (tasks included). */
export async function teamBreakdown(user, q, { db = pool } = {}) {
  const f = await filtered(user, { scope: 'team', recordScope: q.recordScope, category: q.category }, { db });
  const { ctx } = f;
  const per = new Map(f.team.map((u) => [u.id, { userId: u.id, username: u.username, name: u.displayName, designation: u.designation, managerId: u.managerId, depth: u.depth,
    total: 0, overdue: 0, dueToday: 0, high: 0, byCategory: {} }]));
  if (f.cte && f.team.length) {
    const { rows } = await db.query(`${f.cte} SELECT owner_id, category, count(*)::int AS total,
        count(*) FILTER (WHERE due_date < ${ctx.T}::date)::int AS overdue, count(*) FILTER (WHERE due_date = ${ctx.T}::date)::int AS due_today,
        count(*) FILTER (WHERE eff_priority IN ('high', 'urgent'))::int AS high
      FROM w GROUP BY owner_id, category`, ctx.params);
    for (const r of rows) {
      const m = per.get(r.owner_id);
      if (!m) continue;
      m.total += r.total; m.overdue += r.overdue; m.dueToday += r.due_today; m.high += r.high;
      m.byCategory[r.category] = { count: r.total, overdue: r.overdue };
    }
  }
  const managers = await ownerNames(db, f.team.map((u) => u.managerId));
  return {
    asOf: f.today,
    categories: visibleCategories(user).map((c) => ({ code: c.code, label: c.label, icon: c.icon })),
    members: [...per.values()].map((m) => ({ ...m, managerName: managers.get(m.managerId) || null })),
  };
}

/** GET /my-work/agenda: items and open tasks due between from and to (at most 31 days), for the calendar. */
export async function agenda(user, q, { db = pool } = {}) {
  const from = String(q.from || '');
  const to = String(q.to || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw badRequest('from and to are dates (YYYY-MM-DD)');
  if (to < from || addDays(from, 42) < to) throw badRequest('The agenda covers at most 6 weeks');
  const cats = visibleCategories(user).map((c) => c.code).filter((c) => c !== 'tasks');
  const f = await filtered(user, { scope: q.scope || 'me', recordScope: q.recordScope, assignee: q.assignee, from, to, category: q.category }, { db, categories: cats });
  if (!f.cte) return { from, to, items: [] };
  const { rows } = await db.query(`${f.cte} SELECT * FROM w ORDER BY due_date, ${PRIORITY_RANK} DESC LIMIT 500`, f.ctx.params);
  const owners = await ownerNames(db, rows.map((r) => r.owner_id));
  return { from, to, items: rows.map((r) => toItem(r, f.today, owners)) };
}

export { CATEGORIES };
