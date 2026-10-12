/**
 * Sales targets (TIS-BRD-RPT-02, migration 0689; Master > Finance > Sales Targets).
 *
 * The commission target of an agent (a payee of the Commission Payees master) or of a sales unit (a branch) for a month.
 * Maker-checker as on the other masters: a target is drafted (write:incentive), submitted, and approved by a holder of
 * approve:incentive who neither created, last changed nor submitted it; a return sends it back to Draft with the
 * reviewer's note. Only an Approved target counts in the reports (Agent Policy Conversion: Target and Variance; Sales
 * Target Variance). One target is in force per agent or unit and month: a new draft for the same agent or unit and
 * month replaces the approved one when it is approved (the old one becomes Superseded).
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { mapColumns } from '../documents/tabular.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';

export const TARGET_STATUSES = ['draft', 'pending-approval', 'approved', 'superseded', 'withdrawn'];
export const STATUS_LABELS = { draft: 'Draft', 'pending-approval': 'Pending approval', approved: 'Approved', superseded: 'Superseded', withdrawn: 'Withdrawn' };
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Columns of the Sales Targets upload (template: Sales_Targets_Upload_Template.xlsx). */
export const SALES_TARGET_COLUMNS = [
  { key: 'scope', header: 'TARGET_FOR', aliases: ['scope', 'target for'], required: true, format: 'Agent or Sales unit', allowed: ['Agent', 'Sales unit'], example: 'Agent' },
  { key: 'agent', header: 'AGENT', aliases: ['agent id', 'payee', 'payee id'], required: 'when TARGET_FOR is Agent', format: 'Payee id or name of the Commission Payees master', example: 'ref-dcruz' },
  { key: 'salesUnit', header: 'SALES_UNIT', aliases: ['branch', 'branch code', 'sales unit code'], required: 'when TARGET_FOR is Sales unit', format: 'Branch code of the Branch master', example: 'MNL' },
  { key: 'period', header: 'PERIOD', aliases: ['month'], required: true, format: 'Month YYYY-MM', example: '2026-11' },
  { key: 'targetAmount', header: 'TARGET_AMOUNT', aliases: ['target', 'amount'], required: true, format: 'Total commission targeted for the month (PHP), 0 or more, up to 2 decimals', example: '150000.00' },
  { key: 'remarks', header: 'REMARKS', format: 'Text, up to 250 characters', example: 'Q4 push' },
];

const SELECT = `SELECT st.*, r.name AS agent_name, r.referrer_type, b.code AS branch_code, b.name AS branch_name,
    (SELECT display_name FROM users u WHERE u.id = st.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = st.submitted_by) AS submitted_by_name,
    (SELECT display_name FROM users u WHERE u.id = st.decided_by) AS decided_by_name
  FROM sales_targets st LEFT JOIN commission_referrers r ON r.id = st.referrer_id LEFT JOIN branches b ON b.id = st.branch_id`;

export const targetOut = (r) => r && ({
  id: Number(r.id), scope: r.scope, agentId: r.referrer_id, agentName: r.agent_name || null, payeeType: r.referrer_type || null,
  salesUnitId: r.branch_id, salesUnitCode: r.branch_code || null, salesUnitName: r.branch_name || null,
  name: r.scope === 'agent' ? r.agent_name : r.branch_name, period: r.period, targetAmount: Number(r.target_amount), remarks: r.remarks,
  status: r.status, statusLabel: STATUS_LABELS[r.status] || r.status, replacesId: r.replaces_id ? Number(r.replaces_id) : null,
  createdBy: r.created_by_name || r.created_by, createdById: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  submittedBy: r.submitted_by_name || r.submitted_by, submittedAt: r.submitted_at, decidedBy: r.decided_by_name || r.decided_by, decidedAt: r.decided_at,
  decisionNote: r.decision_note,
});

const fail = (path, message) => badRequest('Validation failed', [{ path, message }]);

async function rowOf(id, db = null) {
  const r = db ? (await db.query(`${SELECT} WHERE st.id = $1`, [Number(id) || 0])).rows[0] : await one(`${SELECT} WHERE st.id = $1`, [Number(id) || 0]);
  if (!r) throw notFound('Sales target not found');
  return r;
}
export const getTarget = async (id) => targetOut(await rowOf(id));

/** Targets (status, scope, period or a period range, search on the agent or unit). */
export async function listTargets(q = {}) {
  const status = TARGET_STATUSES.includes(q.status) ? q.status : null;
  const scope = ['agent', 'unit'].includes(q.scope) ? q.scope : null;
  const search = String(q.search || '').trim();
  const rows = await many(`${SELECT}
    WHERE ($1::text IS NULL OR st.status = $1) AND ($1::text IS NOT NULL OR st.status NOT IN ('superseded', 'withdrawn') OR $5::boolean)
      AND ($2::text IS NULL OR st.scope = $2) AND ($3::text IS NULL OR st.period >= $3) AND ($4::text IS NULL OR st.period <= $4)
      AND ($6::text = '' OR r.name ILIKE '%' || $6 || '%' OR r.id ILIKE '%' || $6 || '%' OR b.name ILIKE '%' || $6 || '%' OR b.code ILIKE '%' || $6 || '%')
    ORDER BY st.period DESC, COALESCE(r.name, b.name), st.id DESC LIMIT 1000`,
  [status, scope, PERIOD.test(q.periodFrom || q.period || '') ? q.periodFrom || q.period : null, PERIOD.test(q.periodTo || q.period || '') ? q.periodTo || q.period : null,
    q.all === 'true' || q.all === true, search]);
  return rows.map(targetOut);
}

/** The agent or the sales unit of a target body: { scope, referrer_id, branch_id }. */
async function subjectOf(db, b) {
  const raw = String(b.scope || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  const scope = raw === 'agent' ? 'agent' : ['unit', 'sales unit', 'branch'].includes(raw) ? 'unit' : null;
  if (!scope) throw fail('scope', 'Choose whether the target is for an agent or a sales unit');
  if (scope === 'agent') {
    const ref = String(b.agentId ?? b.agent ?? '').trim();
    if (!ref) throw fail('agentId', 'Choose the agent');
    const r = (await db.query(`SELECT id FROM commission_referrers WHERE (id = $1 OR lower(name) = lower($1)) AND status = 'Active' ORDER BY (id = $1) DESC LIMIT 1`, [ref])).rows[0];
    if (!r) throw fail('agentId', `${ref} is not an active payee of the Commission Payees master`);
    return { scope, referrer_id: r.id, branch_id: null };
  }
  const ref = String(b.salesUnitId ?? b.salesUnit ?? b.salesUnitCode ?? '').trim();
  if (!ref) throw fail('salesUnitId', 'Choose the sales unit');
  const u = (await db.query("SELECT id FROM branches WHERE (id::text = $1 OR lower(code) = lower($1) OR lower(name) = lower($1)) AND status = 'active' ORDER BY (id::text = $1) DESC LIMIT 1", [ref])).rows[0];
  if (!u) throw fail('salesUnitId', `${ref} is not an active branch of the Branch master`);
  return { scope, referrer_id: null, branch_id: u.id };
}

function amountOf(v) {
  const s = String(v ?? '').replace(/[,₱\s]/g, '');
  if (s === '' || !/^\d+(\.\d{1,2})?$/.test(s)) throw fail('targetAmount', 'Enter the target amount: 0 or more, up to 2 decimals');
  return s;
}
function periodOf(v) {
  const s = String(v ?? '').trim();
  if (!PERIOD.test(s)) throw fail('period', 'Enter the month as YYYY-MM');
  return s;
}

async function assertNoOpen(db, s, period, exceptId = null) {
  const open = (await db.query(`SELECT id FROM sales_targets WHERE scope = $1 AND COALESCE(referrer_id, '') = COALESCE($2, '') AND COALESCE(branch_id, 0) = COALESCE($3, 0)
    AND period = $4 AND status IN ('draft', 'pending-approval') AND ($5::bigint IS NULL OR id <> $5)`, [s.scope, s.referrer_id, s.branch_id, period, exceptId])).rows[0];
  if (open) throw conflict(`A draft or pending target for the same ${s.scope === 'agent' ? 'agent' : 'sales unit'} and month already exists (target ${open.id}): change that one`);
}

/** New draft target (a new draft for an agent or unit and month with an approved target replaces it once approved). */
export async function createTarget(b, user, db = null) {
  const run = async (c) => {
    const s = await subjectOf(c, b);
    const period = periodOf(b.period);
    const amount = amountOf(b.targetAmount);
    await assertNoOpen(c, s, period);
    const current = (await c.query(`SELECT id FROM sales_targets WHERE scope = $1 AND COALESCE(referrer_id, '') = COALESCE($2, '') AND COALESCE(branch_id, 0) = COALESCE($3, 0)
      AND period = $4 AND status = 'approved'`, [s.scope, s.referrer_id, s.branch_id, period])).rows[0];
    const r = (await c.query(`INSERT INTO sales_targets(scope, referrer_id, branch_id, period, target_amount, remarks, replaces_id, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`, [s.scope, s.referrer_id, s.branch_id, period, amount, String(b.remarks || '').slice(0, 250) || null, current?.id ?? null, user?.id ?? null])).rows[0];
    return Number(r.id);
  };
  const id = db ? await run(db) : await withTransaction(run);
  return db ? targetOut(await rowOf(id, db)) : getTarget(id);
}

/** Change a draft target (amount, month, remarks, agent or unit). */
export async function updateTarget(id, b, user) {
  return withTransaction(async (db) => {
    const before = await rowOf(id, db);
    if (before.status !== 'draft') throw conflict(`A ${STATUS_LABELS[before.status].toLowerCase()} target cannot be changed: ${before.status === 'approved' ? 'add a new target for the month' : 'return it first'}`);
    const s = b.scope || b.agentId || b.salesUnitId ? await subjectOf(db, { scope: b.scope || before.scope, agentId: b.agentId ?? before.referrer_id, salesUnitId: b.salesUnitId ?? before.branch_id })
      : { scope: before.scope, referrer_id: before.referrer_id, branch_id: before.branch_id };
    const period = b.period !== undefined ? periodOf(b.period) : before.period;
    const amount = b.targetAmount !== undefined ? amountOf(b.targetAmount) : before.target_amount;
    await assertNoOpen(db, s, period, before.id);
    await db.query(`UPDATE sales_targets SET scope = $2, referrer_id = $3, branch_id = $4, period = $5, target_amount = $6, remarks = $7, updated_by = $8, updated_at = now() WHERE id = $1`,
      [before.id, s.scope, s.referrer_id, s.branch_id, period, amount, b.remarks !== undefined ? String(b.remarks || '').slice(0, 250) || null : before.remarks, user.id]);
    return { before: targetOut(before), after: targetOut(await rowOf(before.id, db)) };
  });
}

/** Send drafts for approval. */
export async function submitTargets(ids, user) {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean))];
  if (!list.length) throw fail('ids', 'Choose the targets to submit');
  const out = await withTransaction(async (db) => {
    const done = [];
    for (const id of list) {
      const r = await rowOf(id, db);
      if (r.status !== 'draft') throw conflict(`Target ${id} is ${STATUS_LABELS[r.status].toLowerCase()}: only a draft is submitted`);
      await db.query("UPDATE sales_targets SET status = 'pending-approval', submitted_by = $2, submitted_at = now(), decision_note = NULL, updated_at = now() WHERE id = $1", [id, user.id]);
      done.push(targetOut(await rowOf(id, db)));
    }
    return done;
  });
  await notifyApprovers({ audience: 'approve:incentive', document: 'Sales target', number: out.length === 1 ? `${out[0].name} ${out[0].period}` : `${out.length} targets`, by: user.username,
    link: '/master/incentive/sales-targets', entity: 'sales_target', entityId: String(out[0].id) });
  return out;
}

/**
 * Approve or return pending targets. Maker-checker: the approver neither created, last changed nor submitted a
 * target. A return needs a note. An approval puts the target in force and supersedes the one it replaces.
 */
export async function decideTargets(ids, { decision, note = null }, user) {
  if (!['approve', 'return'].includes(decision)) throw fail('decision', 'decision must be approve or return');
  const text = String(note || '').trim();
  if (decision === 'return' && !text) throw fail('note', 'Say why the target is returned');
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean))];
  if (!list.length) throw fail('ids', 'Choose the targets to decide');
  const out = await withTransaction(async (db) => {
    const done = [];
    for (const id of list) {
      const r = (await db.query('SELECT * FROM sales_targets WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!r) throw notFound(`Sales target ${id} not found`);
      if (r.status !== 'pending-approval') throw conflict(`Target ${id} is ${STATUS_LABELS[r.status].toLowerCase()}, not pending approval`);
      if ([r.created_by, r.updated_by, r.submitted_by].includes(user.id)) {
        throw forbidden('Maker-checker: a sales target must be approved by a different user than the one who created, changed or submitted it');
      }
      if (decision === 'approve') {
        await db.query(`UPDATE sales_targets SET status = 'superseded', updated_at = now() WHERE status = 'approved' AND scope = $1 AND COALESCE(referrer_id, '') = COALESCE($2, '')
          AND COALESCE(branch_id, 0) = COALESCE($3, 0) AND period = $4`, [r.scope, r.referrer_id, r.branch_id, r.period]);
        await db.query("UPDATE sales_targets SET status = 'approved', decided_by = $2, decided_at = now(), decision_note = $3, updated_at = now() WHERE id = $1", [id, user.id, text || null]);
      } else {
        await db.query("UPDATE sales_targets SET status = 'draft', decided_by = $2, decided_at = now(), decision_note = $3, updated_at = now() WHERE id = $1", [id, user.id, text]);
      }
      done.push({ maker: r.submitted_by || r.created_by, target: targetOut(await rowOf(id, db)) });
    }
    return done;
  });
  for (const makers of [...new Set(out.map((d) => d.maker).filter(Boolean))]) {
    const mine = out.filter((d) => d.maker === makers);
    await notifyDecision({ userId: makers, decidedBy: user.id, document: 'Sales target', number: mine.length === 1 ? `${mine[0].target.name} ${mine[0].target.period}` : `${mine.length} targets`,
      approved: decision === 'approve', by: user.username, reason: decision === 'approve' ? null : text, link: '/master/incentive/sales-targets', entity: 'sales_target', entityId: String(mine[0].target.id) });
  }
  return out.map((d) => d.target);
}

/** Withdraw a draft or pending target (it never comes into force). */
export async function withdrawTarget(id, user) {
  return withTransaction(async (db) => {
    const before = await rowOf(id, db);
    if (!['draft', 'pending-approval'].includes(before.status)) throw conflict(`A ${STATUS_LABELS[before.status].toLowerCase()} target cannot be withdrawn`);
    await db.query("UPDATE sales_targets SET status = 'withdrawn', updated_by = $2, updated_at = now() WHERE id = $1", [before.id, user.id]);
    return { before: targetOut(before), after: targetOut(await rowOf(before.id, db)) };
  });
}

/** Upload of the Sales Targets template: each row becomes a draft target on its own; failed rows are listed. */
export async function uploadTargets(rows, user) {
  const max = Number(await getSetting('incentive.sales_target_max_rows', 2000));
  if (rows.length > max) throw badRequest(`A file can hold at most ${max} rows (incentive.sales_target_max_rows)`);
  const errors = [];
  const created = [];
  for (const [i, raw] of rows.entries()) {
    const n = i + 2;
    const v = mapColumns(raw, SALES_TARGET_COLUMNS);
    try {
      const t = await withTransaction((db) => createTarget({ scope: v.scope, agentId: v.agent, salesUnitId: v.salesUnit, period: v.period, targetAmount: v.targetAmount, remarks: v.remarks }, user, db));
      created.push(t);
    } catch (e) {
      if (!e.status) throw e;
      errors.push({ row: n, message: `Row ${n}: ${e.details?.[0]?.message || e.message}` });
    }
  }
  return { loaded: created.length, failed: errors.length, errors, created, message: `Processed ${rows.length} rows: ${created.length} drafts added, ${errors.length} failed` };
}
