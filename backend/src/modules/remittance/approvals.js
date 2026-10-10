/**
 * Accounts > Remittance > Approvals: the decision inbox of remittance approvals (remittances, and until R2 the
 * legacy settlement, adjustment and transfer items).
 *
 * Views: mine (the pending approvals the user can decide now), submitted (the user's own submissions, with who they
 * wait on), all (every pending approval, each with the user's decision block) and decided (the last 30 days). Each row
 * carries the decision block (decision.js), the next step, the SLA and the level; the list answers totals and the KPI
 * figures of the page, computed on the server. Instants are ISO (UTC); "today" and the SLA ages are taken in the
 * business time zone (general.timezone).
 *
 * Remittances of kind agency-bill are not on the inbox (agency bills are not used by TISPH).
 */
import { many, one, pool } from '../../db/pool.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { isoDate } from '../../lib/dates.js';
import { audit } from '../../lib/audit.js';
import { round2 } from '../masters/helpers.js';
import { requiredReason } from '../ops-masters/records.js';
import { notifyApprovers } from '../notifications/approvals.js';
import { activityEntries, instant } from '../../lib/auditEvents.js';
import { APPROVAL_SELECT, approvalLink, decide, refusal, remittanceLink, statusLabels } from './service.js';
import { approversFor, clockText, decisionBlock, decisionContext, limitRequired, limitSourceLabel, myAuthority, nextStepFor, roleNames } from './decision.js';
import { remittanceActivity } from './activity.js';
import { SOURCES } from './register.js';

export const VIEWS = ['mine', 'submitted', 'all', 'decided'];
const TYPES = { remittance: 'Remittance', settlement: 'Settlement', adjustment: 'Adjustment', transfer: 'Electronic transfer' };
const DECIDED_DAYS = 30;
const MAX_ITEMS = 100;

const LIST_SELECT = `SELECT a.*, (SELECT display_name FROM users u WHERE u.id = a.initiator_id) AS initiator_name,
    (SELECT display_name FROM users u WHERE u.id = a.action_by) AS action_by_name, (SELECT display_name FROM users u WHERE u.id = a.delegated_to) AS delegated_to_name,
    (SELECT display_name FROM users u WHERE u.id = a.reminded_by) AS reminded_by_name,
    r.created_by AS maker_id, r.status AS record_status, r.version AS record_version, r.net_due AS record_amount, x.kind AS item_kind,
    ic.id AS insurer_id, ic.name AS insurer_name,
    (SELECT string_agg(DISTINCT rl.product, ', ') FROM remittance_lines rl WHERE rl.remittance_id = r.id) AS product_line
  FROM remittance_approvals a
  LEFT JOIN remittances r ON a.entity = 'remittance' AND r.id = a.entity_id
  LEFT JOIN remittance_items x ON a.entity = 'item' AND x.id = a.entity_id
  LEFT JOIN insurance_companies ic ON ic.id = COALESCE(r.insurance_company_id, x.insurance_company_id)`;

const typeOf = (a) => (a.entity === 'remittance' ? 'remittance' : a.item_kind || 'item');
const hoursBetween = (from, to) => (new Date(to).getTime() - new Date(from).getTime()) / 3600000;

/** Filters shared by the views: type, insurer, reference search. */
function filters(qs, p) {
  const conds = ["(r.id IS NULL OR r.kind = 'direct-bill')"];
  const add = (v) => { p.push(v); return `$${p.length}`; };
  if (qs.type && qs.type !== 'all') {
    conds.push(qs.type === 'remittance' ? "a.entity = 'remittance'" : `(a.entity = 'item' AND x.kind = ${add(String(qs.type))})`);
  }
  if (qs.insurerId) conds.push(`ic.id::text = ${add(String(qs.insurerId))}`);
  if (qs.q) conds.push(`(a.reference_no ILIKE ${add(`%${qs.q}%`)} OR ic.name ILIKE $${p.length})`);
  return conds;
}

/** SLA of a pending approval at `now`: due instant, age, overdue and the chip text. */
function slaOf(a, now) {
  const age = hoursBetween(a.created_at, now);
  const left = Number(a.sla_hours || 0) - age;
  const dueAt = new Date(new Date(a.created_at).getTime() + Number(a.sla_hours || 0) * 3600000).toISOString();
  return { hours: a.sla_hours, dueAt, ageHours: Math.round(age * 10) / 10, overdue: left < 0,
    label: left < 0 ? `Overdue ${Math.max(1, Math.ceil(-left))} h` : `Due in ${Math.max(1, Math.ceil(left))} h` };
}

/** The reminder state of an approval: when it was last sent and from when the next one is allowed. */
function reminderOf(a, ctx, hours) {
  if (!a.reminded_at) return { remindedAt: null, nextAt: null, allowed: true };
  const nextAt = new Date(new Date(a.reminded_at).getTime() + hours * 3600000);
  return { remindedAt: new Date(a.reminded_at).toISOString(), remindedBy: a.reminded_by_name || null, nextAt: nextAt.toISOString(), allowed: nextAt <= ctx.now };
}

/** "Reminded 10:15 · next from 14:15" (with the date when not today). */
const remindedText = (ctx, reminder) => `Reminded ${clockText(ctx, reminder.remindedAt)} · next from ${clockText(ctx, reminder.nextAt)}`;

/** The decision recorded on a decided approval (last history entry), in words: no reason or role codes. */
async function outcomeOf(a, ctx) {
  const h = [...(a.history || [])].reverse().find((x) => x.action === a.status) || {};
  return { action: a.status, by: { id: a.action_by, name: a.action_by_name }, decidedAt: a.action_at ? new Date(a.action_at).toISOString() : null,
    reason: a.status === 'Rejected' ? h.remarks ?? a.remarks ?? null : null, note: a.status === 'Approved' ? h.remarks ?? null : null,
    limitAtDecision: h.limitAtDecision ?? null, limitSource: h.limitSource ?? null, limitSourceLabel: limitSourceLabel(h.limitSource, await roleNames(ctx)) };
}

/** One row of the inbox (any view) for `user`. */
async function rowOut(a, user, ctx, { labels, reminderHours }) {
  const decision = await decisionBlock(a, user, ctx);
  const type = typeOf(a);
  const pending = a.status === 'Pending';
  const reminder = reminderOf(a, ctx, reminderHours);
  const mineSubmitted = a.initiator_id === user.id;
  return {
    id: Number(a.id), version: a.version, type, typeLabel: TYPES[type] || a.transaction_type, transactionType: a.transaction_type, reference: a.reference_no,
    entity: a.entity, entityId: a.entity_id, recordLink: a.entity === 'remittance' ? remittanceLink(a.entity_id) : approvalLink(a.id),
    insurer: a.insurer_id ? { id: a.insurer_id, name: a.insurer_name } : null, productLine: a.product_line || null, amount: round2(a.amount), description: a.description,
    submittedBy: { id: a.initiator_id, name: a.initiator_name }, submittedAt: new Date(a.created_at).toISOString(), priority: a.priority,
    status: a.status, statusLabel: a.entity === 'remittance' && a.record_status ? labels[a.record_status] || a.record_status : a.status,
    level: { current: a.current_level, required: a.required_levels, label: `${Math.min(a.current_level, a.required_levels)} of ${a.required_levels}` },
    sla: pending ? slaOf(a, ctx.now) : null, decision, nextStep: nextStepFor(a, decision.eligibleApprovers), reminder: pending ? reminder : null,
    outcome: pending ? null : await outcomeOf(a, ctx),
    actions: [
      { code: 'view', label: 'View', allowed: true },
      { code: 'approve', label: 'Approve', allowed: decision.canDecide, ...(decision.canDecide ? {} : { blockedCode: decision.blockedCode, blockedReason: decision.blockedReason }) },
      { code: 'reject', label: 'Reject', allowed: decision.canDecide || ['ABOVE_LIMIT', 'CONTENT_CHANGED', 'TRANSFERS_OFF'].includes(decision.blockedCode) },
      { code: 'remind', label: 'Remind approver', allowed: pending && mineSubmitted && reminder.allowed && decision.eligibleApprovers.length > 0,
        ...(pending && mineSubmitted && !reminder.allowed ? { blockedReason: remindedText(ctx, reminder) } : {}) },
    ],
  };
}

/** KPI figures of the page for `user`: awaiting my decision, past SLA, submitted by me, decided by me today. */
async function kpis(pendingRows, user, ctx) {
  const mine = pendingRows.filter((r) => r.decision.canDecide);
  const late = pendingRows.filter((r) => r.sla?.overdue);
  const tz = ctx.fmt.timeZone;
  const today = await many(`SELECT h->>'action' AS action, count(*)::int AS n FROM remittance_approvals a CROSS JOIN LATERAL jsonb_array_elements(a.history) h
    WHERE h->>'by' = $1 AND h->>'action' IN ('Approved', 'Rejected') AND (((h->>'at')::timestamptz) AT TIME ZONE $2)::date = $3::date GROUP BY 1`, [user.id, tz, ctx.onDate]);
  const n = (action) => today.find((t) => t.action === action)?.n || 0;
  return {
    awaitingMine: { count: mine.length, amount: round2(mine.reduce((s, r) => s + r.amount, 0)) },
    pastSla: { count: late.length, oldestHours: late.length ? Math.max(...late.map((r) => Math.floor(r.sla.ageHours))) : 0 },
    submittedByMe: { count: pendingRows.filter((r) => r.submittedBy.id === user.id).length },
    decidedByMeToday: { count: n('Approved') + n('Rejected'), approved: n('Approved'), rejected: n('Rejected') },
  };
}

/**
 * The inbox of `user`: { view, rows (one page), total, page, perPage, totals { count, amount } of the view, kpis }.
 * `now` is for tests (the business date of "today").
 */
export async function approvalInbox(qs, user, pg, { now = new Date() } = {}) {
  const view = VIEWS.includes(qs.view) ? qs.view : 'mine';
  const ctx = await decisionContext(user, { now });
  const labels = await statusLabels();
  const reminderHours = Math.max(1, Number(await getSetting('remittance.reminder_interval_hours', 4)) || 4);
  const opts = { labels, reminderHours };
  const pendingParams = [];
  const pendingWhere = ["a.status = 'Pending'", ...filters(qs, pendingParams)];
  const pending = await many(`${LIST_SELECT} WHERE ${pendingWhere.join(' AND ')} ORDER BY a.created_at, a.id`, pendingParams);
  const pendingRows = [];
  for (const a of pending) pendingRows.push(await rowOut(a, user, ctx, opts));
  const summary = await kpis(pendingRows, user, ctx);
  let rows;
  let total;
  let amount;
  if (view === 'decided') {
    const p = [DECIDED_DAYS];
    const where = ["a.status IN ('Approved', 'Rejected')", "a.action_at >= now() - make_interval(days => $1::int)", ...filters(qs, p)];
    const agg = await one(`SELECT count(*)::int AS n, COALESCE(sum(a.amount), 0) AS amount FROM remittance_approvals a
      LEFT JOIN remittances r ON a.entity = 'remittance' AND r.id = a.entity_id LEFT JOIN remittance_items x ON a.entity = 'item' AND x.id = a.entity_id
      LEFT JOIN insurance_companies ic ON ic.id = COALESCE(r.insurance_company_id, x.insurance_company_id) WHERE ${where.join(' AND ')}`, p);
    const page = await many(`${LIST_SELECT} WHERE ${where.join(' AND ')} ORDER BY a.action_at DESC, a.id DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    rows = [];
    for (const a of page) rows.push(await rowOut(a, user, ctx, opts));
    total = agg.n;
    amount = round2(agg.amount);
  } else {
    const inView = pendingRows.filter((r) => (view === 'mine' ? r.decision.canDecide : view === 'submitted' ? r.submittedBy.id === user.id : true));
    total = inView.length;
    amount = round2(inView.reduce((s, r) => s + r.amount, 0));
    rows = inView.slice(pg.offset, pg.offset + pg.limit);
  }
  return { view, rows, total, totals: { count: total, amount }, kpis: summary, authority: await authorityOf(ctx) };
}

/**
 * The authority chips of the inbox: whether the user may decide remittance approvals at all (approve:remittance and,
 * where one is required, an Authority Matrix limit), the limit and its source, and the people the user covers for
 * today through a dated delegation (Master > User Management > Delegations) with its last day.
 */
export async function authorityOf(ctx) {
  const permission = hasPermission(ctx.user, 'approve:remittance');
  const a = await myAuthority(ctx, 'remittance');
  const covering = await many(`SELECT u.display_name AS name, d.date_to FROM user_delegations d JOIN users u ON u.id = d.delegator_id
    WHERE d.delegate_id = $1 AND d.status = 'active' AND $2::date BETWEEN d.date_from AND d.date_to
      AND (cardinality(d.transaction_types) = 0 OR 'remittance' = ANY(d.transaction_types)) AND u.status = 'active' ORDER BY d.date_to, u.display_name`, [ctx.user.id, ctx.onDate]);
  return {
    permission, canDecide: permission && (a.found || !limitRequired(ctx)), limit: a.found && !a.unlimited ? a.limit : null, unlimited: permission && (!!a.unlimited || (!a.found && !limitRequired(ctx))),
    limitSourceLabel: limitSourceLabel(a.source, await roleNames(ctx)), covering: covering.map((c) => ({ name: c.name, until: isoDate(c.date_to) })),
  };
}

export const EXPORT_HEADER = ['Reference', 'Type', 'Insurer', 'Product line', 'Amount', 'Submitted by', 'Submitted on', 'SLA', 'Level', 'Can I decide?', 'Next step',
  'Decision', 'By', 'Reason', 'Limit at decision', 'Decided on'];

/** The rows of Export XLSX: every row of the view and filters (not one page), with the instants in the business time zone. */
export async function approvalExport(qs, user) {
  const r = await approvalInbox(qs, user, { limit: 100000, offset: 0 });
  const ctx = await decisionContext(user);
  const at = (v) => (v ? instant(v, ctx.fmt)?.text || '' : '');
  const rows = r.rows.map((x) => [x.reference, x.typeLabel, x.insurer?.name || '', x.productLine || '', x.amount, x.submittedBy?.name || '', at(x.submittedAt),
    x.sla?.label || '', x.level.label, x.decision.canDecide ? 'Yes' : `No · ${x.decision.blockedReason || ''}`.trim(), x.nextStep?.label || '',
    x.outcome?.action || '', x.outcome?.by?.name || '', x.outcome?.reason || '', x.outcome?.limitAtDecision ?? '', at(x.outcome?.decidedAt)]);
  return { view: r.view, rows };
}

/**
 * The approval of a remittance for its record page: the pending approval, else the latest decided one, as the inbox
 * row (decision block, level, SLA, reminder, outcome with the limit at decision and its source) with the checks while
 * it is pending and its actions (approve, reject, remind). null when the remittance was never submitted.
 */
export async function recordApproval(remittanceId, user) {
  const a = await one(`${LIST_SELECT} WHERE a.entity = 'remittance' AND a.entity_id = $1 ORDER BY (a.status = 'Pending') DESC, a.created_at DESC, a.id DESC LIMIT 1`, [remittanceId]);
  if (!a) return null;
  const ctx = await decisionContext(user);
  const row = await rowOut(a, user, ctx, { labels: await statusLabels(), reminderHours: Math.max(1, Number(await getSetting('remittance.reminder_interval_hours', 4)) || 4) });
  const pending = a.status === 'Pending';
  const submitted = a.entity_version === null || a.entity_version === undefined ? null : a.entity_version;
  const checks = pending ? await checksOf(a, { contentUnchanged: submitted === null ? null : submitted === a.record_version, contentVersion: a.record_version }, ctx) : [];
  return {
    id: row.id, version: row.version, status: row.status, level: row.level, submittedBy: row.submittedBy, submittedAt: row.submittedAt, sla: row.sla,
    reminder: row.reminder, outcome: row.outcome, nextStep: row.nextStep, authorityType: 'Remittance', amount: row.amount,
    contentVersion: a.record_version, submittedVersion: submitted, contentUnchanged: pending && submitted !== null ? submitted === a.record_version : null,
    checks, actions: row.actions.filter((x) => x.code !== 'view'),
  };
}

/** Source and off-cycle reason of a remittance (remittances.data until the Phase 2 columns): an import or Run now is off-cycle. */
export function offCycleOf(r) {
  const d = r.data || {};
  const source = d.source || (r.config_code ? 'weekly-run' : 'manual');
  const offCycle = ['import', 'run-now'].includes(source);
  return { source: { code: source, label: source === 'import' && d.importNo ? `Import ${d.importNo}` : SOURCES[source] || source,
    importId: d.importId || null, importNo: d.importNo || null },
  offCycle, offCycleReason: offCycle ? d.offCycleReason?.text || d.offCycleReason?.name || null : null };
}

/**
 * Header, totals and the first lines of a remittance under approval, with the previous remittance of its insurer: the
 * latest one dated before it (remittance date, then creation), so remittances loaded together still find theirs.
 */
async function remittanceSummary(a, labels) {
  const r = await one(`SELECT r.*, i.name AS insurer_name, (SELECT display_name FROM users u WHERE u.id = r.created_by) AS created_by_name,
      (SELECT display_name FROM users u WHERE u.id = r.submitted_by) AS submitted_by_name FROM remittances r
    LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id WHERE r.id = $1`, [a.entity_id]);
  if (!r) return null;
  const lines = await many(`SELECT policy_number, insured_name, product, premium, commission, tax, net FROM remittance_lines WHERE remittance_id = $1 ORDER BY id LIMIT 10`, [r.id]);
  const previous = await one(`SELECT p.id, p.remittance_number, p.net_due, p.remittance_date FROM remittances p
    WHERE p.kind = $1 AND p.insurance_company_id = $2 AND p.id <> $3 AND p.status NOT IN ('draft', 'rejected', 'cancelled')
      AND (p.remittance_date, p.created_at, p.id) < ($4::date, $5::timestamptz, $3::text)
    ORDER BY p.remittance_date DESC, p.created_at DESC, p.id DESC LIMIT 1`, [r.kind, r.insurance_company_id, r.id, r.remittance_date, r.created_at]);
  const net = Number(r.net_due);
  return {
    record: { id: r.id, remittanceNo: r.remittance_number, statusCode: r.status, statusLabel: labels[r.status] || r.status, insurer: { id: r.insurance_company_id, name: r.insurer_name },
      productLine: [...new Set(lines.map((l) => l.product).filter(Boolean))].join(', ') || null, period: r.period, remittanceDate: r.remittance_date, dueDate: r.due_date,
      preparedBy: r.created_by_name || 'System', submittedBy: r.submitted_by_name || null, submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null, version: r.version, link: remittanceLink(r.id),
      ...offCycleOf(r) },
    totals: { policies: r.policy_count, premium: round2(r.gross_premium), commission: round2(r.commission), tax: round2(r.tax), adjustments: round2(r.adjustments), dueToInsurer: round2(net) },
    lines: lines.map((l) => ({ policyNo: l.policy_number, client: l.insured_name, product: l.product, premium: round2(l.premium), commission: round2(l.commission), tax: round2(l.tax), dueToInsurer: round2(l.net) })),
    lineCount: r.policy_count,
    previous: previous ? { id: previous.id, remittanceNo: previous.remittance_number, amount: round2(previous.net_due), date: previous.remittance_date,
      changePercent: Number(previous.net_due) ? round2(((net - Number(previous.net_due)) / Math.abs(Number(previous.net_due))) * 100) : null } : null,
    contentUnchanged: a.entity_version === null || a.entity_version === undefined ? null : a.entity_version === r.version,
    contentVersion: r.version,
  };
}

/** Header and lines of a legacy settlement, adjustment or transfer item. */
async function itemSummary(a) {
  const x = await one('SELECT x.*, i.name AS insurer_name FROM remittance_items x LEFT JOIN insurance_companies i ON i.id = x.insurance_company_id WHERE x.id = $1', [a.entity_id]);
  if (!x) return null;
  const lineIds = (x.data?.lineIds || []).map(Number).filter(Number.isFinite);
  const lines = lineIds.length ? await many(`SELECT l.policy_number, l.insured_name, l.product, l.premium, l.commission, l.tax, l.net FROM remittance_lines l
    WHERE l.id = ANY($1) ORDER BY l.id LIMIT 10`, [lineIds]) : [];
  return {
    record: { id: x.id, reference: x.reference_no, kind: x.kind, status: x.status, insurer: x.insurance_company_id ? { id: x.insurance_company_id, name: x.insurer_name } : null,
      period: Array.isArray(x.data?.settlementPeriod) ? x.data.settlementPeriod : null, remarks: x.remarks },
    totals: { policies: lineIds.length || null, dueToInsurer: round2(x.amount) },
    lines: lines.map((l) => ({ policyNo: l.policy_number, client: l.insured_name, product: l.product, premium: round2(l.premium), commission: round2(l.commission), tax: round2(l.tax), dueToInsurer: round2(l.net) })),
    lineCount: lineIds.length, previous: null, contentUnchanged: null, contentVersion: null,
  };
}

/** The checks R1 can answer: content unchanged since submission, and today's accounting period (information). */
async function checksOf(a, s, ctx) {
  const out = [];
  if (a.entity === 'remittance' && s?.contentUnchanged !== null && s?.contentUnchanged !== undefined) {
    out.push({ code: 'content-unchanged', label: 'Content unchanged since submission', result: s.contentUnchanged ? 'pass' : 'fail',
      detail: s.contentUnchanged ? `v${s.contentVersion} · unchanged since submission` : `v${s.contentVersion} · changed since submission (v${a.entity_version})` });
  }
  const period = ctx.onDate.slice(0, 7);
  const month = new Date(`${period}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const p = await one('SELECT status FROM accounting_periods WHERE period = $1', [period]).catch(() => null);
  out.push({ code: 'period-open', label: `Accounting period ${month}`, result: !p ? 'info' : p.status === 'open' ? 'pass' : 'fail',
    detail: !p ? 'Not in the accounting calendar' : p.status === 'open' ? 'Open' : `${String(p.status).charAt(0).toUpperCase()}${String(p.status).slice(1).replace('_', '-')}` });
  return out;
}

/** Open legacy exceptions raised on the remittance (Exceptions screen): count and the first five. */
async function exceptionsOf(a) {
  if (a.entity !== 'remittance') return { count: 0, items: [] };
  const rows = await many(`SELECT reference_no, status, data FROM remittance_items WHERE kind = 'exception' AND remittance_id = $1 AND status <> 'Resolved' ORDER BY created_at`, [a.entity_id]);
  return { count: rows.length, items: rows.slice(0, 5).map((x) => ({ reference: x.reference_no, type: x.data?.type || null, description: x.data?.description || null, status: x.status })) };
}

/** The activity of an approval: the remittance's activity log, or the audit of a legacy item and its approval. */
async function activityOf(a, user) {
  if (a.entity === 'remittance') return remittanceActivity(a.entity_id, { viewer: user });
  const rows = await many(`SELECT id, at, user_id, username, entity, entity_id, action, before_data, after_data, source FROM audit_log
    WHERE (entity = 'remittance_approval' AND entity_id = $1) OR (entity = 'remittance_item' AND entity_id = $2) ORDER BY at, id`, [String(a.id), a.entity_id]);
  return activityEntries(rows, { viewer: user });
}

/**
 * The review panel of one approval (?approval=<id>): the row of the inbox, the record's header, totals and first ten
 * lines, the previous remittance of the insurer with the change in %, the checks, the open exceptions and the
 * activity (latest ten entries; the record page has the whole log).
 */
export async function approvalSummary(id, user) {
  const ref = String(id).replace(/^remittance:/, '');
  const a = await one(`${LIST_SELECT} WHERE a.id = $1`, [Number(ref) || 0]);
  if (!a) throw notFound('Approval not found');
  const ctx = await decisionContext(user);
  const labels = await statusLabels();
  const row = await rowOut(a, user, ctx, { labels, reminderHours: Math.max(1, Number(await getSetting('remittance.reminder_interval_hours', 4)) || 4) });
  const s = a.entity === 'remittance' ? await remittanceSummary(a, labels) : await itemSummary(a);
  const activity = await activityOf(a, user);
  const summary = { record: s?.record ?? null, totals: s?.totals ?? null, lines: s?.lines ?? [], lineCount: s?.lineCount ?? 0, previous: s?.previous ?? null };
  // the checks are those of a pending approval: a decision moves the remittance's version on, so a decided one has none
  const checks = a.status === 'Pending' ? await checksOf(a, s, ctx) : [];
  return { ...row, ...summary, checks, exceptions: await exceptionsOf(a), activity: activity.slice(-10) };
}

/** A failed item of a bulk decision as its result row. */
function failure(item, e) {
  const code = e.details?.[0]?.code || (e.status === 409 ? 'CONFLICT' : e.status === 400 ? 'INVALID' : 'REFUSED');
  const message = code === 'ALREADY_DECIDED' ? `Already ${e.message.charAt(0).toLowerCase()}${e.message.slice(1)}` : e.message;
  return { id: Number(item.id), ok: false, code, message };
}

/**
 * Approve or reject several approvals: { items: [{ id, version }], action, reasonCode, note }. Each item is decided on
 * its own (decide()); one refused item does not stop the others. A rejection needs a remittance_reject reason, checked
 * once for the request. Returns { action, results: [{ id, reference, ok, status, message } | { id, ok: false, code,
 * message }], decided, refused }.
 */
export async function decideMany(b, user, req) {
  const action = b?.action;
  if (!['approve', 'reject'].includes(action)) throw badRequest('Validation failed', [{ path: 'action', message: 'action must be approve or reject' }]);
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length || items.length > MAX_ITEMS || items.some((i) => !i || !Number(i.id))) {
    throw badRequest('Validation failed', [{ path: 'items', message: `Select between 1 and ${MAX_ITEMS} approvals, each with its id` }]);
  }
  const note = b.note ?? b.comments ?? null;
  if (action === 'reject') await requiredReason(pool, 'remittance_reject', { reasonCode: b.reasonCode, note });
  const ctx = await decisionContext(user);
  const results = [];
  for (const item of items) {
    try {
      const r = await decide(item.id, action, { reasonCode: b.reasonCode, note }, user, { req, version: item.version ?? null, ctx });
      const message = r.after.status === 'Pending' ? `Level ${r.before.currentLevel} approved; next level pending` : action === 'approve' ? 'Approved' : 'Rejected';
      results.push({ id: Number(item.id), reference: r.after.referenceNo, ok: true, status: r.after.status, message });
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      results.push(failure(item, e));
    }
  }
  return { action, results, decided: results.filter((r) => r.ok).length, refused: results.filter((r) => !r.ok).length };
}

/**
 * "Remind approver": the submitter asks the eligible approvers of a pending approval again, at most once per
 * remittance.reminder_interval_hours (4). Audited under the approval and, for a remittance, under the remittance.
 */
export async function remindApprovers(id, user, req) {
  const ctx = await decisionContext(user);
  const a = await one(`${APPROVAL_SELECT} WHERE a.id = $1`, [Number(id) || 0]);
  if (!a) throw notFound('Approval not found');
  if (a.status !== 'Pending') throw refusal('ALREADY_DECIDED', (await decisionBlock(a, user, ctx)).blockedReason);
  if (a.initiator_id !== user.id && !isAdmin(user)) throw forbidden('Only the submitter can remind the approvers.');
  const hours = Math.max(1, Number(await getSetting('remittance.reminder_interval_hours', 4)) || 4);
  const reminder = reminderOf(a, ctx, hours);
  if (!reminder.allowed) {
    const message = remindedText(ctx, reminder);
    throw new HttpError(409, message, [{ path: 'approval', code: 'REMINDED', message }]);
  }
  const approvers = await approversFor(a, ctx);
  if (!approvers.length) throw new HttpError(409, 'No eligible approver', [{ path: 'approval', code: 'NO_ELIGIBLE_APPROVER', message: 'No eligible approver' }]);
  const updated = await one(`UPDATE remittance_approvals SET reminded_at = now(), reminded_by = $2 WHERE id = $1 AND status = 'Pending'
    AND (reminded_at IS NULL OR reminded_at <= now() - make_interval(hours => $3::int)) RETURNING reminded_at`, [a.id, user.id, hours]);
  if (!updated) throw conflict('The approvers were reminded a moment ago');
  const names = approvers.map((u) => u.name).join(', ');
  await notifyApprovers({ users: approvers.map((u) => u.id), document: a.transaction_type, number: a.reference_no, by: user.username,
    title: `Reminder: ${a.transaction_type} ${a.reference_no} awaiting approval`, message: `${user.username} asks you to decide ${a.reference_no}`,
    link: approvalLink(a.id), entity: a.entity, entityId: a.entity_id });
  const after = { approvalId: Number(a.id), sentTo: names };
  await audit(req, { entity: 'remittance_approval', entityId: a.id, action: 'remind', after });
  if (a.entity === 'remittance') await audit(req, { entity: 'remittance', entityId: a.entity_id, action: 'remind', after });
  const nextAt = new Date(new Date(updated.reminded_at).getTime() + hours * 3600000).toISOString();
  return { id: Number(a.id), sentTo: approvers.map((u) => ({ id: u.id, name: u.name })), remindedAt: new Date(updated.reminded_at).toISOString(), nextReminderAt: nextAt,
    message: `Reminder sent to ${names}.` };
}
