/**
 * Incentive programs, calculations (achievement from policies / quotes, payout from the program's tier structure),
 * maker-checker approval, payment, agent statements, "my programs" and reports.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { baseCurrency } from '../../lib/currency.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { assertChecker, fileUrl, isoDate, lastMonths, round2, saveFile, toCsv, toNumber } from '../masters/helpers.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { getLetterhead } from '../../lib/letterhead.js';

const need = (b, fields) => {
  const errors = fields.filter((f) => b[f] === undefined || b[f] === null || (typeof b[f] === 'string' && !b[f].trim()) || (Array.isArray(b[f]) && !b[f].length))
    .map((f) => ({ path: f, message: `${f} is required` }));
  if (errors.length) throw badRequest('Validation failed', errors);
};

// ---------------- programs ----------------

const programOut = (p) => ({
  id: p.id, programCode: p.program_code, programName: p.name, description: p.description, programType: p.program_type, applicableTo: p.applicable_to,
  startDate: p.period_from, endDate: p.period_to, targetMetric: p.target_metric, metric: p.metric, baseTarget: p.target, stretchTarget: p.stretch_target,
  Currency: p.currency, currency: p.currency, calculationFrequency: p.calculation_frequency, status: p.status, reward: p.reward, structure: p.structure, eligibility: p.eligibility,
  createdDate: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : null, createdBy: p.created_by_name || p.created_by, updatedAt: p.updated_at,
  participants: p.participants ?? 0, totalPayout: p.total_payout ?? 0,
});
const PROGRAM_SELECT = `SELECT p.*, (SELECT display_name FROM users u WHERE u.id = p.created_by) AS created_by_name,
  (SELECT count(DISTINCT r.agent_user_id)::int FROM incentive_results r WHERE r.program_id = p.id) AS participants,
  (SELECT COALESCE(sum(r.payout), 0) FROM incentive_results r JOIN incentive_calculations c ON c.batch_id = r.calculation_id WHERE r.program_id = p.id AND c.status IN ('Approved', 'Paid')) AS total_payout
  FROM incentive_programs p`;

export async function listPrograms(qs = {}) {
  const rows = await many(`${PROGRAM_SELECT} WHERE p.status <> 'Deleted' AND ($1::text IS NULL OR p.status = $1) AND ($2::text IS NULL OR p.name ILIKE $2 OR p.program_code ILIKE $2)
                           ORDER BY p.period_from DESC, p.id`, [qs.status || null, qs.search ? `%${qs.search}%` : null]);
  return rows.map(programOut);
}

async function programRow(id) {
  const p = await one(`${PROGRAM_SELECT} WHERE (p.id::text = $1 OR lower(p.program_code) = lower($1)) AND p.status <> 'Deleted'`, [String(id)]);
  if (!p) throw notFound('Incentive program not found');
  return p;
}
export const getProgram = async (id) => programOut(await programRow(id));

async function metricOf(targetMetric) {
  const map = (await getSetting('incentive.metric_map', {})) || {};
  const m = map[targetMetric];
  if (!m) throw badRequest('Validation failed', [{ path: 'targetMetric', message: `Target metric must be one of: ${Object.keys(map).join(', ')}` }]);
  return m;
}

function validateStructure(structure) {
  if (!Array.isArray(structure)) throw badRequest('Validation failed', [{ path: 'structure', message: 'structure must be an array of tiers' }]);
  structure.forEach((s, i) => {
    if (!s || !s.level || !['Percentage', 'Fixed Amount'].includes(s.type) || !Number.isFinite(toNumber(s.value, NaN))) {
      throw badRequest('Validation failed', [{ path: `structure.${i}`, message: 'Each tier needs level, type (Percentage | Fixed Amount) and value' }]);
    }
  });
  return structure.map((s) => ({ ...s, value: toNumber(s.value), maxPayout: s.maxPayout == null || s.maxPayout === '' ? null : toNumber(s.maxPayout) }));
}

async function programValues(b, before) {
  const from = isoDate(b.startDate) || before?.period_from;
  const to = isoDate(b.endDate) || before?.period_to;
  if (!from || !to || to < from) throw badRequest('Validation failed', [{ path: 'endDate', message: 'End date must be on or after the start date' }]);
  const targetMetric = b.targetMetric ?? before?.target_metric;
  const metric = await metricOf(targetMetric);
  const types = (await getSetting('incentive.program_types', [])) || [];
  const programType = b.programType ?? before?.program_type;
  if (types.length && programType && !types.includes(programType)) throw badRequest('Validation failed', [{ path: 'programType', message: `programType must be one of: ${types.join(', ')}` }]);
  const freqs = (await getSetting('incentive.calculation_frequencies', [])) || [];
  const freq = b.calculationFrequency ?? before?.calculation_frequency;
  if (freqs.length && freq && !freqs.includes(freq)) throw badRequest('Validation failed', [{ path: 'calculationFrequency', message: `calculationFrequency must be one of: ${freqs.join(', ')}` }]);
  const baseTarget = toNumber(b.baseTarget ?? before?.target, NaN);
  if (!(baseTarget > 0)) throw badRequest('Validation failed', [{ path: 'baseTarget', message: 'baseTarget must be greater than zero' }]);
  const stretch = b.stretchTarget === undefined ? before?.stretch_target ?? null : (b.stretchTarget === null || b.stretchTarget === '' ? null : toNumber(b.stretchTarget));
  if (stretch !== null && stretch < baseTarget) throw badRequest('Validation failed', [{ path: 'stretchTarget', message: 'stretchTarget must not be below baseTarget' }]);
  const status = b.status ?? before?.status ?? 'Active';
  if (!['Active', 'Inactive', 'Draft', 'Completed'].includes(status)) throw badRequest('Validation failed', [{ path: 'status', message: 'status must be Active, Inactive, Draft or Completed' }]);
  return {
    name: b.programName ?? before?.name, description: b.description ?? before?.description ?? null, metric, target: baseTarget, reward: b.reward ?? before?.reward ?? null,
    period_from: from, period_to: to, status, program_type: programType || null, applicable_to: JSON.stringify(b.applicableTo ?? before?.applicable_to ?? []), target_metric: targetMetric,
    stretch_target: stretch, currency: b.Currency || b.currency || before?.currency || (await baseCurrency()), calculation_frequency: freq || null,
    structure: JSON.stringify(b.structure !== undefined ? validateStructure(b.structure) : before?.structure ?? []), eligibility: JSON.stringify(b.eligibility ?? before?.eligibility ?? {}),
  };
}

export async function createProgram(b, user) {
  need(b, ['programName', 'applicableTo', 'startDate', 'endDate', 'targetMetric', 'calculationFrequency', 'baseTarget']);
  const code = b.programCode ? String(b.programCode).trim() : await nextDocumentNumber('incentive_program');
  if (await one('SELECT 1 FROM incentive_programs WHERE lower(program_code) = lower($1)', [code])) throw conflict(`Program code ${code} already exists`);
  const v = await programValues(b);
  const cols = Object.keys(v);
  const r = await one(`INSERT INTO incentive_programs(${[...cols, 'program_code', 'created_by', 'updated_by'].join(', ')})
                       VALUES (${[...cols.map((_, i) => `$${i + 1}`), `$${cols.length + 1}`, `$${cols.length + 2}`, `$${cols.length + 2}`].join(', ')}) RETURNING id`, [...cols.map((c) => v[c]), code, user.id]);
  return getProgram(r.id);
}

export async function updateProgram(id, b, user) {
  const before = await programRow(id);
  if (b.programCode && b.programCode !== before.program_code && await one('SELECT 1 FROM incentive_programs WHERE lower(program_code) = lower($1) AND id <> $2', [b.programCode, before.id])) {
    throw conflict(`Program code ${b.programCode} already exists`);
  }
  const v = await programValues(b, before);
  if (b.programCode) v.program_code = b.programCode;
  const cols = Object.keys(v);
  await query(`UPDATE incentive_programs SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2}, updated_at = now() WHERE id = $1`, [before.id, ...cols.map((c) => v[c]), user.id]);
  return { before: programOut(before), after: await getProgram(before.id) };
}

export async function deleteProgram(id, user) {
  const before = await programRow(id);
  if (await one('SELECT 1 FROM incentive_results r JOIN incentive_calculations c ON c.batch_id = r.calculation_id WHERE r.program_id = $1 AND c.status IN (\'Pending Approval\', \'Approved\')', [before.id])) {
    throw conflict('The program has calculations pending or approved; deactivate it instead');
  }
  await query('UPDATE incentive_programs SET status = \'Deleted\', updated_by = $2, updated_at = now() WHERE id = $1', [before.id, user.id]);
  return programOut(before);
}

// ---------------- achievement and payout ----------------

export async function eligibleAgents(agentId) {
  const roles = (await getSetting('incentive.eligible_roles', [])) || [];
  return many(`SELECT u.id, u.display_name, COALESCE(u.employee_code, u.username) AS code, u.branch_code,
                 (SELECT name FROM branches b WHERE b.code = u.branch_code) AS branch_name
               FROM users u WHERE u.status = 'active' AND ($2::text IS NULL OR u.id = $2)
                 AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = ANY($1))
               ORDER BY u.display_name`, [roles, agentId || null]);
}

/** Achievement of one agent for a metric over a date range. */
export async function achievement(metric, agentId, from, to) {
  if (metric === 'premium' || metric === 'policies') {
    const r = await one(`SELECT count(*)::int AS n, COALESCE(sum(premium_total), 0) AS v FROM policies
                         WHERE owner_user_id = $1 AND inception_date BETWEEN $2::date AND $3::date AND status <> 'cancelled'`, [agentId, from, to]);
    return metric === 'premium' ? round2(r.v) : r.n;
  }
  if (metric === 'renewal-rate') {
    const r = await one(`SELECT count(*) FILTER (WHERE renewed_to IS NOT NULL OR status = 'renewed')::int AS renewed, count(*)::int AS due FROM policies
                         WHERE owner_user_id = $1 AND expiry_date BETWEEN $2::date AND $3::date`, [agentId, from, to]);
    return r.due ? round2((r.renewed / r.due) * 100) : 0;
  }
  if (metric === 'conversion') {
    const r = await one(`SELECT count(*) FILTER (WHERE status = 'converted')::int AS won, count(*)::int AS total FROM quotes
                         WHERE agent_user_id = $1 AND created_at::date BETWEEN $2::date AND $3::date`, [agentId, from, to]);
    return r.total ? round2((r.won / r.total) * 100) : 0;
  }
  return 0;
}

function tierRange(level) {
  const s = String(level);
  const range = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]), percent: s.includes('%') };
  const plus = s.match(/(\d+(?:\.\d+)?)\s*%?\s*\+/);
  if (plus) return { min: Number(plus[1]), max: Infinity, percent: s.includes('%') };
  return null;
}

/** Payout from the program tiers: tiers keyed on achievement % (levels with %) or on the achieved count. */
export function payout(program, achieved, target) {
  const pct = target ? round2((achieved / target) * 100) : 0;
  const monetary = program.metric === 'premium';
  let hit = null;
  for (const t of program.structure || []) {
    const r = tierRange(t.level);
    if (!r) continue;
    const x = r.percent ? pct : achieved;
    if (x >= r.min && (x < r.max || (r.max !== Infinity && x === r.max && !r.percent))) hit = t;
  }
  if (!hit) return { achievementPercent: pct, amount: 0, tier: null };
  let amount;
  if (hit.type === 'Percentage') amount = monetary ? achieved * hit.value / 100 : toNumber(program.target) * hit.value / 100;
  else amount = program.metric === 'policies' ? hit.value * achieved : hit.value;
  if (hit.maxPayout) amount = Math.min(amount, hit.maxPayout);
  return { achievementPercent: pct, amount: round2(amount), tier: hit.level };
}

// ---------------- calculations ----------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Period from 'YYYY-MM', a date or a label such as 'September 2026' -> { label, from, to }. */
export function parsePeriod(v, fromOverride, toOverride) {
  if (fromOverride && toOverride) return { label: String(v || `${fromOverride} to ${toOverride}`), from: isoDate(fromOverride), to: isoDate(toOverride) };
  let d = null;
  const s = String(v || '').trim();
  const named = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (/^\d{4}-\d{2}$/.test(s)) d = new Date(`${s}-01T00:00:00Z`);
  else if (named) {
    const m = MONTHS.findIndex((x) => x.startsWith(named[1].slice(0, 3).toLowerCase()));
    if (m >= 0) d = new Date(Date.UTC(Number(named[2]), m, 1));
  } else if (s) {
    const iso = isoDate(s);
    if (iso) d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  }
  if (!d || Number.isNaN(d.getTime())) throw badRequest('Validation failed', [{ path: 'period', message: 'period must be YYYY-MM, a date or a month label' }]);
  const from = d.toISOString().slice(0, 10);
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { label: d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }), from, to };
}

const CALC_SELECT = `SELECT c.*, (SELECT display_name FROM users u WHERE u.id = c.submitted_by) AS submitted_by_name, (SELECT display_name FROM users u WHERE u.id = c.approved_by) AS approved_by_name,
  (SELECT display_name FROM users u WHERE u.id = c.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = c.rejected_by) AS rejected_by_name FROM incentive_calculations c`;

async function calcOut(c, withDetails = true) {
  const details = withDetails ? (await many(`SELECT r.*, u.display_name, COALESCE(u.employee_code, u.username) AS code, p.name AS program_name, p.program_code
      FROM incentive_results r JOIN users u ON u.id = r.agent_user_id JOIN incentive_programs p ON p.id = r.program_id WHERE r.calculation_id = $1 ORDER BY u.display_name, p.name`, [c.batch_id]))
    .map((r) => ({ id: Number(r.id), agentId: r.agent_user_id, agentName: r.display_name, agentCode: r.code, programId: r.program_id, program: r.program_name, programCode: r.program_code,
      target: r.target, achieved: r.achieved, achievementPercent: r.achievement_percent, tier: r.tier, baseIncentive: r.base_incentive, adjustments: r.adjustments, adjustmentReason: r.adjustment_reason,
      finalAmount: r.payout, status: r.status })) : undefined;
  const ts = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  return {
    batchId: c.batch_id, period: c.period, periodFrom: c.period_from, periodTo: c.period_to, calculationDate: ts(c.created_at), programsIncluded: c.programs_included, description: c.description,
    totalAmount: c.total_amount, agentCount: c.agent_count, status: c.status, createdBy: c.created_by_name, submittedBy: c.submitted_by_name, submittedDate: ts(c.submitted_date),
    approvedBy: c.approved_by_name, approvalDate: ts(c.approval_date), rejectedBy: c.rejected_by_name, rejectionDate: ts(c.rejection_date), rejectionReason: c.rejection_reason,
    paymentDate: c.payment_date, paymentReference: c.payment_reference,
    daysWaiting: c.status === 'Pending Approval' && c.submitted_date ? Math.floor((Date.now() - new Date(c.submitted_date).getTime()) / 86400000) : 0, details,
  };
}

async function calcRow(batchId) {
  const c = await one(`${CALC_SELECT} WHERE c.batch_id = $1`, [String(batchId)]);
  if (!c) throw notFound('Calculation batch not found');
  return c;
}
export const getCalculation = async (id) => calcOut(await calcRow(id));

export async function listCalculations(qs = {}) {
  const statuses = qs.status && qs.status !== 'All' ? String(qs.status).split(',') : null;
  const rows = await many(`${CALC_SELECT} WHERE ($1::text[] IS NULL OR c.status = ANY($1)) ORDER BY c.period_from DESC, c.created_at DESC`, [statuses]);
  const out = [];
  for (const c of rows) out.push(await calcOut(c, String(qs.details) !== 'false'));
  return out;
}

export async function runCalculation(b, user) {
  const period = parsePeriod(b.period, b.periodFrom, b.periodTo);
  const refs = b.selectedPrograms || b.programs || b.programIds || [];
  if (!Array.isArray(refs) || !refs.length) throw badRequest('Validation failed', [{ path: 'selectedPrograms', message: 'Select at least one program' }]);
  const programs = [];
  for (const ref of refs) {
    const p = await programRow(typeof ref === 'object' ? ref.value ?? ref.id : ref);
    if (p.status !== 'Active') throw badRequest('Validation failed', [{ path: 'selectedPrograms', message: `${p.program_code} is not active` }]);
    if (p.period_to < period.from || p.period_from > period.to) throw badRequest('Validation failed', [{ path: 'selectedPrograms', message: `${p.program_code} does not run in ${period.label}` }]);
    programs.push(p);
  }
  const agents = await eligibleAgents();
  const lines = [];
  for (const p of programs) {
    const from = p.period_from > period.from ? p.period_from : period.from;
    const to = p.period_to < period.to ? p.period_to : period.to;
    for (const a of agents) {
      const achieved = await achievement(p.metric, a.id, from, to);
      if (!achieved) continue;
      const pay = payout(p, achieved, Number(p.target));
      lines.push({ program: p, agent: a, achieved, ...pay });
    }
  }
  const periodKey = period.from.slice(0, 7);
  const batchId = await nextDocumentNumber('incentive_calc');
  await withTransaction(async (c) => {
    for (const l of lines) {
      const prior = (await c.query(`SELECT r.id, k.status FROM incentive_results r LEFT JOIN incentive_calculations k ON k.batch_id = r.calculation_id
                                    WHERE r.program_id = $1 AND r.agent_user_id = $2 AND r.period = $3`, [l.program.id, l.agent.id, periodKey])).rows[0];
      if (prior && prior.status !== 'Rejected') throw conflict(`${l.program.program_code} for ${l.agent.display_name} is already calculated for ${period.label} (batch ${prior.status})`);
      if (prior) await c.query('DELETE FROM incentive_results WHERE id = $1', [prior.id]);
    }
    await c.query(`INSERT INTO incentive_calculations(batch_id, period, period_from, period_to, programs_included, description, total_amount, agent_count, status, created_by)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Calculated',$9)`,
    [batchId, period.label, period.from, period.to, JSON.stringify(programs.map((p) => p.program_code)), b.description || null, round2(lines.reduce((s, l) => s + l.amount, 0)),
      new Set(lines.map((l) => l.agent.id)).size, user.id]);
    for (const l of lines) {
      await c.query(`INSERT INTO incentive_results(program_id, agent_user_id, achieved, payout, status, period, calculation_id, target, achievement_percent, base_incentive, tier)
                     VALUES ($1,$2,$3,$4,'Calculated',$5,$6,$7,$8,$4,$9)`, [l.program.id, l.agent.id, l.achieved, l.amount, periodKey, batchId, l.program.target, l.achievementPercent, l.tier]);
    }
  });
  return getCalculation(batchId);
}

async function refreshTotals(c, batchId) {
  await c.query(`UPDATE incentive_calculations SET total_amount = (SELECT COALESCE(sum(payout), 0) FROM incentive_results WHERE calculation_id = $1),
                 agent_count = (SELECT count(DISTINCT agent_user_id) FROM incentive_results WHERE calculation_id = $1), updated_at = now() WHERE batch_id = $1`, [batchId]);
}

export async function adjustCalculation(batchId, b) {
  const c = await calcRow(batchId);
  if (!['Calculated', 'Rejected'].includes(c.status)) throw conflict(`A ${c.status.toLowerCase()} batch cannot be adjusted`);
  if (!Array.isArray(b.lines) || !b.lines.length) throw badRequest('Validation failed', [{ path: 'lines', message: 'lines [{ id, adjustments, reason }] are required' }]);
  await withTransaction(async (tx) => {
    for (const l of b.lines) {
      const adj = toNumber(l.adjustments, NaN);
      if (!Number.isFinite(adj)) throw badRequest('Validation failed', [{ path: 'lines', message: 'adjustments must be a number' }]);
      if (!l.reason) throw badRequest('Validation failed', [{ path: 'lines', message: 'A reason is required for each adjustment' }]);
      const r = await tx.query(`UPDATE incentive_results SET adjustments = $3, adjustment_reason = $4, payout = GREATEST(base_incentive + $3, 0), status = 'Adjusted'
                                WHERE id = $1 AND calculation_id = $2 RETURNING id`, [Number(l.id), c.batch_id, adj, l.reason]);
      if (!r.rowCount) throw badRequest('Validation failed', [{ path: 'lines', message: `Line ${l.id} is not in batch ${c.batch_id}` }]);
    }
    await tx.query('UPDATE incentive_calculations SET status = \'Calculated\' WHERE batch_id = $1', [c.batch_id]);
    await refreshTotals(tx, c.batch_id);
  });
  return { before: await calcOut(c), after: await getCalculation(c.batch_id) };
}

export async function submitCalculation(batchId, user) {
  const c = await calcRow(batchId);
  if (!['Calculated', 'Rejected'].includes(c.status)) throw conflict(`Batch is already ${c.status.toLowerCase()}`);
  await query('UPDATE incentive_calculations SET status = \'Pending Approval\', submitted_by = $2, submitted_date = now(), rejection_reason = NULL, updated_at = now() WHERE batch_id = $1', [c.batch_id, user.id]);
  await notifyApprovers({ audience: 'write:incentive', document: 'Incentive calculation', number: c.batch_id, by: user.username, detail: `period ${c.period}`,
    link: '/incentive/approvals', entity: 'incentive_calculation', entityId: c.batch_id });
  return { before: await calcOut(c, false), after: await getCalculation(c.batch_id) };
}

export async function decideCalculation(batchId, action, b, user) {
  const c = await calcRow(batchId);
  if (c.status !== 'Pending Approval') throw conflict(`Batch is ${c.status}; only batches pending approval can be ${action}d`);
  await assertChecker(user, c.submitted_by, 'calculation batch');
  await assertChecker(user, c.created_by, 'calculation batch');
  await withTransaction(async (tx) => {
    if (action === 'approve') {
      await tx.query('UPDATE incentive_calculations SET status = \'Approved\', approved_by = $2, approval_date = now(), updated_at = now() WHERE batch_id = $1', [c.batch_id, user.id]);
      await tx.query('UPDATE incentive_results SET status = \'Approved\' WHERE calculation_id = $1', [c.batch_id]);
      // incentives earned are accrued (posting rule incentive.accrual)
      const total = round2((await tx.query('SELECT COALESCE(sum(payout), 0) AS t FROM incentive_results WHERE calculation_id = $1', [c.batch_id])).rows[0].t);
      if (total > 0) {
        const { postEvent } = await import('../accounting/lib/posting.js');
        const jv = await postEvent('incentive.accrual', { source: 'incentive', entryType: 'INCENTIVE_ACCRUAL', transactionCode: c.batch_id, referenceType: 'IncentiveCalculation', referenceId: c.batch_id,
          description: `Incentives ${c.batch_id} (${c.period}) approved`, amounts: { amount: total }, vars: { batchId: c.batch_id, period: c.period } }, { db: tx, user });
        await tx.query('UPDATE incentive_calculations SET accrual_jv_id = $2 WHERE batch_id = $1', [c.batch_id, jv.id]);
      }
    } else {
      if (!b.reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required to reject' }]);
      await tx.query('UPDATE incentive_calculations SET status = \'Rejected\', rejected_by = $2, rejection_date = now(), rejection_reason = $3, updated_at = now() WHERE batch_id = $1', [c.batch_id, user.id, b.reason]);
      await tx.query('UPDATE incentive_results SET status = \'Rejected\' WHERE calculation_id = $1', [c.batch_id]);
    }
  });
  await notifyDecision({ userId: c.submitted_by || c.created_by, decidedBy: user.id, document: 'Incentive calculation', number: c.batch_id, approved: action === 'approve', by: user.username,
    reason: action === 'approve' ? null : b.reason, link: '/incentive/calculations', entity: 'incentive_calculation', entityId: c.batch_id });
  return { before: await calcOut(c, false), after: await getCalculation(c.batch_id) };
}

export async function payCalculation(batchId, b, user = null) {
  const c = await calcRow(batchId);
  if (c.status !== 'Approved') throw conflict('Only approved batches can be paid');
  const date = isoDate(b.paymentDate) || (await today());
  await withTransaction(async (tx) => {
    // payout of the accrued incentives from the chosen bank account (posting rule incentive.payout)
    const total = round2((await tx.query('SELECT COALESCE(sum(payout), 0) AS t FROM incentive_results WHERE calculation_id = $1', [c.batch_id])).rows[0].t);
    if (total > 0 && c.accrual_jv_id) {
      const { postEvent } = await import('../accounting/lib/posting.js');
      const jv = await postEvent('incentive.payout', { source: 'incentive', entryType: 'INCENTIVE_PAYMENT', transactionCode: c.batch_id, referenceType: 'IncentiveCalculation', referenceId: c.batch_id,
        date: date <= (await today()) ? date : undefined, description: `Incentives ${c.batch_id} (${c.period}) paid`, bankAccount: b.bankAccount || null, paymentMode: b.paymentMode || 'bank-transfer',
        amounts: { amount: total }, vars: { batchId: c.batch_id, period: c.period, memoRef: b.paymentReference || `Incentives ${c.batch_id}` } }, { db: tx, user });
      await tx.query('UPDATE incentive_calculations SET payment_jv_id = $2 WHERE batch_id = $1', [c.batch_id, jv.id]);
    }
    await tx.query('UPDATE incentive_calculations SET status = \'Paid\', payment_date = $2, payment_reference = $3, updated_at = now() WHERE batch_id = $1', [c.batch_id, date, b.paymentReference || null]);
    await tx.query('UPDATE incentive_results SET status = \'Paid\', paid_at = $2::date WHERE calculation_id = $1', [c.batch_id, date]);
  });
  return { before: await calcOut(c, false), after: await getCalculation(c.batch_id) };
}

export async function approvalsBoard() {
  const all = await listCalculations({});
  const t = (await today());
  const pending = all.filter((a) => a.status === 'Pending Approval');
  return {
    approvals: all,
    summary: { pending: pending.length, pendingAmount: round2(pending.reduce((s, a) => s + Number(a.totalAmount), 0)),
      approvedToday: all.filter((a) => a.approvalDate === t).length, rejectedToday: all.filter((a) => a.rejectionDate === t).length },
  };
}

// ---------------- agent views ----------------

export async function agentPrograms(agentId) {
  const agents = await eligibleAgents(agentId);
  const lookback = Number(await getSetting('incentive.program_lookback_days', 30)) || 0;
  const t = await today();
  const programs = await many('SELECT * FROM incentive_programs WHERE status = \'Active\' AND period_to >= $1::date - $2::int ORDER BY period_from', [t, lookback]);
  const out = [];
  for (const a of agents) {
    const assigned = [];
    for (const p of programs) {
      const to = p.period_to < t ? p.period_to : t;
      const achieved = await achievement(p.metric, a.id, p.period_from, to);
      const pay = payout(p, achieved, Number(p.target));
      assigned.push({ programId: p.id, programCode: p.program_code, programName: p.name, targetMetric: p.target_metric, target: p.target, stretchTarget: p.stretch_target, achieved,
        achievementPercent: pay.achievementPercent, potentialEarning: pay.amount, tier: pay.tier, daysRemaining: Math.max(0, Math.ceil((Date.parse(p.period_to) - Date.parse(t)) / 86400000)),
        startDate: p.period_from, endDate: p.period_to, lastUpdated: t });
    }
    const acts = await many(`SELECT p.inception_date, p.premium_total, p.renewed_from, pr.name AS product FROM policies p LEFT JOIN products pr ON pr.id = p.product_id
                             WHERE p.owner_user_id = $1 ORDER BY p.inception_date DESC LIMIT 10`, [a.id]);
    out.push({ agentId: a.id, agentName: a.display_name, agentCode: a.code, branch: a.branch_name || a.branch_code, assignedPrograms: assigned,
      recentActivities: acts.map((x) => ({ date: x.inception_date, activity: `${x.renewed_from ? 'Policy Renewal' : 'New Policy'} - ${x.product || 'Policy'}`, impact: round2(x.premium_total), points: Math.round(Number(x.premium_total) / 100) })) });
  }
  return out;
}

/** Contact block of the statement: the letterhead company (Company master, primary company) name, e-mail and phone. */
async function statementContact() {
  const l = await getLetterhead();
  return { companyName: l.name || '', email: l.email || '', phone: l.phone || '' };
}
const periodLabels = (keys) => [...new Set(keys.filter(Boolean))].sort().map((k) => parsePeriod(k).label);

/** Statement shape with no agent: the period label and zero totals. */
export async function emptyStatement(periodRef) {
  const t = await today();
  const period = parsePeriod(periodRef || t.slice(0, 7));
  return { agentId: null, agentName: '', agentCode: '', branch: '', period: period.label, statementDate: t, totalEarnings: 0, ytdEarnings: 0, pendingPayment: 0,
    lastPayment: 0, lastPaymentDate: null, lastPaymentPeriods: [], pendingPeriods: [], programBreakdown: [], monthlyTrend: [], contact: await statementContact() };
}

export async function statement(agentId, periodRef) {
  const [a] = await eligibleAgents(agentId);
  if (!a) throw notFound('Agent not found or not eligible for incentives');
  const period = parsePeriod(periodRef || (await today()).slice(0, 7));
  const key = period.from.slice(0, 7);
  const lines = await many(`SELECT r.*, p.name, p.structure, p.metric FROM incentive_results r JOIN incentive_programs p ON p.id = r.program_id
                            WHERE r.agent_user_id = $1 AND r.period = $2 AND r.status <> 'Rejected'`, [a.id, key]);
  const earned = (statuses, extra = '', params = []) => one(`SELECT COALESCE(sum(payout), 0) AS v FROM incentive_results WHERE agent_user_id = $1 AND status = ANY($2) ${extra}`, [a.id, statuses, ...params]);
  const ytd = await earned(['Approved', 'Paid'], 'AND left(period, 4) = $3', [key.slice(0, 4)]);
  const pending = await earned(['Approved']);
  const last = await one('SELECT paid_at, sum(payout) AS v, array_agg(DISTINCT period) AS periods FROM incentive_results WHERE agent_user_id = $1 AND status = \'Paid\' GROUP BY paid_at ORDER BY paid_at DESC LIMIT 1', [a.id]);
  const pendingPeriods = (await many('SELECT DISTINCT period FROM incentive_results WHERE agent_user_id = $1 AND status = \'Approved\'', [a.id])).map((r) => r.period);
  const months = lastMonths(13, new Date(`${key}-01T00:00:00Z`));
  const trend = await many('SELECT period, COALESCE(sum(payout), 0) AS v FROM incentive_results WHERE agent_user_id = $1 AND status IN (\'Approved\', \'Paid\') AND period >= $2 GROUP BY period', [a.id, months[0].key]);
  return {
    agentId: a.id, agentName: a.display_name, agentCode: a.code, branch: a.branch_name || a.branch_code, period: period.label, statementDate: (await today()),
    totalEarnings: round2(lines.filter((l) => ['Approved', 'Paid'].includes(l.status)).reduce((s, l) => s + Number(l.payout), 0)), ytdEarnings: round2(ytd.v), pendingPayment: round2(pending.v),
    lastPayment: last ? round2(last.v) : 0, lastPaymentDate: last?.paid_at ? new Date(last.paid_at).toISOString().slice(0, 10) : null,
    // incentive periods of the last payment and of the approved, unpaid results (labels such as "August 2026")
    lastPaymentPeriods: periodLabels(last?.periods || []), pendingPeriods: periodLabels(pendingPeriods), contact: await statementContact(),
    programBreakdown: lines.map((l) => ({ program: l.name, target: l.target, achievement: l.achieved, achievementPercent: l.achievement_percent, rate: l.tier || '-', earnedAmount: l.payout, status: l.status })),
    monthlyTrend: months.map(({ key: k }) => ({ month: new Date(`${k}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + '-' + k.slice(2, 4), period: k, earnings: round2(trend.find((t) => t.period === k)?.v || 0) })),
  };
}

// ---------------- reports ----------------

export async function reportTemplates() {
  const rows = await many('SELECT id, data FROM master_records WHERE type_code = \'incentive-report-template\' AND status = \'active\' ORDER BY code');
  return rows.map((r) => ({ id: r.id, ...r.data }));
}

export async function generateReport(b, user) {
  const ref = b.templateId ?? b.reportType ?? b.templateCode;
  if (!ref) throw badRequest('Validation failed', [{ path: 'templateId', message: 'templateId is required' }]);
  const tpl = await one('SELECT id, data FROM master_records WHERE type_code = \'incentive-report-template\' AND status = \'active\' AND (id::text = $1 OR code = $1 OR name = $1)', [String(ref)]);
  if (!tpl) throw notFound('Report template not found');
  const p = b.parameters?.parameters || b.parameters || {};
  const periodKey = p.period || p.Period ? parsePeriod(p.period || p.Period).from.slice(0, 7) : null;
  const program = p.program || p.Program || null;
  let rows;
  let columns;
  if (tpl.data.category === 'Program Analysis') {
    rows = await many(`SELECT p.program_code, p.name, p.target_metric, count(DISTINCT r.agent_user_id)::int AS agents, COALESCE(sum(r.achieved), 0) AS achieved, COALESCE(sum(r.payout), 0) AS payout
                       FROM incentive_programs p LEFT JOIN incentive_results r ON r.program_id = p.id AND r.status <> 'Rejected' WHERE p.status <> 'Deleted' AND ($1::text IS NULL OR p.program_code = $1)
                       GROUP BY p.id ORDER BY p.program_code`, [program]);
    columns = ['program_code', 'name', 'target_metric', 'agents', 'achieved', 'payout'].map((k) => ({ key: k, label: k }));
  } else {
    rows = await many(`SELECT r.period, u.display_name AS agent, COALESCE(u.employee_code, u.username) AS agent_code, p.program_code, p.name AS program, r.target, r.achieved, r.achievement_percent,
                         r.base_incentive, r.adjustments, r.payout, r.status FROM incentive_results r JOIN users u ON u.id = r.agent_user_id JOIN incentive_programs p ON p.id = r.program_id
                       WHERE r.status <> 'Rejected' AND ($1::text IS NULL OR r.period = $1) AND ($2::text IS NULL OR p.program_code = $2)
                       ORDER BY ${tpl.data.category === 'Performance Reports' ? 'r.achievement_percent DESC NULLS LAST' : 'r.period DESC, u.display_name'}`, [periodKey, program]);
    const top = toNumber(p.topN ?? p['Top N'], 0);
    if (top > 0) rows = rows.slice(0, top);
    columns = ['period', 'agent', 'agent_code', 'program_code', 'program', 'target', 'achieved', 'achievement_percent', 'base_incentive', 'adjustments', 'payout', 'status'].map((k) => ({ key: k, label: k }));
  }
  const saved = await saveFile({ category: 'incentive-reports', fileName: `${tpl.data.code}_${(await today())}.csv`, content: toCsv(rows, columns), contentType: 'text/csv', entity: 'incentive_report', entityId: tpl.data.code, userId: user.id });
  const r = await one(`INSERT INTO generated_reports(code, name, params, format, storage_key, row_count, generated_by, status) VALUES ($1,$2,$3,'csv',$4,$5,$6,'done') RETURNING id, created_at`,
    [`incentive:${tpl.data.code}`, tpl.data.name, JSON.stringify({ parameters: p, format: b.format || b.parameters?.format || 'CSV' }), saved.key, rows.length, user.id]);
  return { reportId: r.id, reportType: tpl.data.name, templateCode: tpl.data.code, generatedDate: r.created_at, fileUrl: saved.url, rowCount: rows.length, format: 'CSV', requestedFormat: b.format || b.parameters?.format || null };
}

export async function reportHistory() {
  const rows = await many(`SELECT g.*, (SELECT display_name FROM users u WHERE u.id = g.generated_by) AS by_name FROM generated_reports g WHERE g.code LIKE 'incentive:%' ORDER BY g.created_at DESC LIMIT 200`);
  return rows.map((g) => ({ reportId: g.id, reportType: g.name, templateCode: g.code.split(':')[1], generatedDate: g.created_at, generatedBy: g.by_name, rowCount: g.row_count, fileUrl: g.storage_key ? fileUrl(g.storage_key) : null, status: g.status }));
}
