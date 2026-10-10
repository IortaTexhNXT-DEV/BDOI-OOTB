/**
 * Incentive programs, calculations (achievement from policies / quotes, payout from the program's tier structure),
 * maker-checker approval, payment, agent statements, "my programs" and reports.
 */
import { many, one, pool, query, withTransaction } from '../../db/pool.js';
import { activityEntries } from '../../lib/auditEvents.js';
import { baseCurrency } from '../../lib/currency.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { assertChecker, fileUrl, isoDate, lastMonths, round2, saveFile, toCsv, toNumber } from '../masters/helpers.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { getLetterhead } from '../../lib/letterhead.js';
import { requiredReason } from '../ops-masters/records.js';
import { renderReportPdf } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';

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

// How a tier pays, by measure: a fixed amount, a % of the premium achieved (premium), an amount per policy (policy
// count) or, for tiers kept from before the basis was stored, a % of the target.
const TIER_BASES = { fixed: 'Fixed Amount', perUnit: 'Fixed Amount', percentOfAchieved: 'Percentage', percentOfTarget: 'Percentage' };
const BASIS_METRIC = { percentOfAchieved: 'premium', perUnit: 'policies' };

/**
 * Tiers in ascending bands of one kind (% of target, or a count), each band starting where the one before ends
 * (percentages share the edge, counts follow on by one), with an open-ended band ("110%+") only at the top.
 */
function validateStructure(structure, metric) {
  if (!Array.isArray(structure)) throw badRequest('Validation failed', [{ path: 'structure', message: 'structure must be an array of tiers' }]);
  const fail = (i, message) => { throw badRequest('Validation failed', [{ path: `structure.${i}`, message }]); };
  let prev = null;
  const tiers = structure.map((s, i) => {
    const basis = s?.basis || null;
    const type = basis ? TIER_BASES[basis] : s?.type;
    if (!s || !s.level || !['Percentage', 'Fixed Amount'].includes(type) || !Number.isFinite(toNumber(s.value, NaN)) || toNumber(s.value) < 0) {
      fail(i, 'Each tier needs level, type (Percentage | Fixed Amount) and value');
    }
    if (basis && (!TIER_BASES[basis] || (BASIS_METRIC[basis] && BASIS_METRIC[basis] !== metric))) fail(i, `Payout basis ${basis} does not apply to this measure`);
    const r = tierRange(s.level);
    if (!r || r.min > r.max) fail(i, 'The achievement band must read like 80-90%, 110%+, 0-10 or 31+');
    if (prev) {
      if (r.percent !== prev.percent) fail(i, 'All tiers must use the same kind of band');
      if (prev.max === Infinity) fail(i, 'Only the top tier may be open-ended');
      const expected = r.percent ? prev.max : prev.max + 1;
      if (r.min < expected) fail(i, 'Tiers must be in ascending order without overlapping bands');
      if (r.min > expected) fail(i, `The band from ${prev.max} to ${r.min} is not covered by any tier`);
    }
    prev = r;
    return { ...s, type, ...(basis ? { basis } : {}), value: toNumber(s.value), maxPayout: s.maxPayout == null || s.maxPayout === '' ? null : toNumber(s.maxPayout) };
  });
  return tiers;
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
  const structure = b.structure !== undefined ? validateStructure(b.structure, metric) : before?.structure ?? [];
  if (status === 'Active' && !structure.length) throw badRequest('Validation failed', [{ path: 'structure', message: 'An active program needs at least one tier' }]);
  return {
    name: b.programName ?? before?.name, description: b.description ?? before?.description ?? null, metric, target: baseTarget, reward: b.reward ?? before?.reward ?? null,
    period_from: from, period_to: to, status, program_type: programType || null, applicable_to: JSON.stringify(b.applicableTo ?? before?.applicable_to ?? []), target_metric: targetMetric,
    stretch_target: stretch, currency: b.Currency || b.currency || before?.currency || (await baseCurrency()), calculation_frequency: freq || null,
    structure: JSON.stringify(structure), eligibility: JSON.stringify(b.eligibility ?? before?.eligibility ?? {}),
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

/** Months in one calculation period of a program (Master > Incentive Programs, incentive.calculation_frequencies). */
const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, 'semi-annual': 6, semiannual: 6, 'half-yearly': 6, annual: 12, annually: 12, yearly: 12 };
const maxDate = (a, b) => (a > b ? a : b);
const minDate = (a, b) => (a < b ? a : b);

/**
 * The calculation period of a program that contains a date: the calendar month, quarter, half or year of its
 * calculation frequency, within the program's own dates (the whole program period when the frequency is not known).
 * Targets and tiers apply per calculation period, so this is the window "My Programs" shows progress for.
 */
export function programPeriodOn(program, date) {
  const months = FREQUENCY_MONTHS[String(program.calculation_frequency || '').trim().toLowerCase()];
  if (!months) return { from: program.period_from, to: program.period_to };
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  const start = new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / months) * months, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 0));
  const iso = (x) => x.toISOString().slice(0, 10);
  return { from: maxDate(iso(start), program.period_from), to: minDate(iso(end), program.period_to) };
}

/**
 * Key of the calculation period of a program that contains a date, as incentive_results.period keeps it: YYYY-MM for a
 * monthly program (and one of unknown frequency), YYYY-Qn quarterly, YYYY-Hn semi-annual, YYYY annual. A program is
 * calculated once per key.
 */
export function programPeriodKey(program, date) {
  const months = FREQUENCY_MONTHS[String(program.calculation_frequency || '').trim().toLowerCase()];
  const d = String(date).slice(0, 10);
  const month = Number(d.slice(5, 7));
  if (months === 3) return `${d.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
  if (months === 6) return `${d.slice(0, 4)}-H${month <= 6 ? 1 : 2}`;
  if (months === 12) return d.slice(0, 4);
  return d.slice(0, 7);
}

/** Whether a program is calculated per calendar month, quarter, half or year (else per month, as before). */
const hasFrequency = (program) => !!FREQUENCY_MONTHS[String(program.calculation_frequency || '').trim().toLowerCase()];

/**
 * Achievement of one agent in a program over a window: the program's metric, within the program's dates, and never
 * counting activity dated after today (a policy incepting next week is not achieved yet). The single source of the
 * calculation run and of My Programs.
 */
export async function programAchievement(program, agentId, from, to) {
  const t = await today();
  const start = maxDate(from, program.period_from);
  const end = minDate(minDate(to, program.period_to), t);
  if (start > end) return 0;
  return achievement(program.metric, agentId, start, end);
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
  let hit = null;
  for (const t of program.structure || []) {
    const r = tierRange(t.level);
    if (!r) continue;
    const x = r.percent ? pct : achieved;
    if (x >= r.min && (x < r.max || (r.max !== Infinity && x === r.max && !r.percent))) hit = t;
  }
  if (!hit) return { achievementPercent: pct, amount: 0, tier: null };
  const basis = tierBasis(program, hit);
  let amount;
  if (basis === 'percentOfAchieved') amount = achieved * hit.value / 100;
  else if (basis === 'percentOfTarget') amount = toNumber(program.target) * hit.value / 100;
  else amount = basis === 'perUnit' ? hit.value * achieved : hit.value;
  if (hit.maxPayout) amount = Math.min(amount, hit.maxPayout);
  return { achievementPercent: pct, amount: round2(amount), tier: hit.level };
}

/**
 * How a tier pays, for the screens: percentOfAchieved (a % of the premium achieved), percentOfTarget (a % of the
 * target), perUnit (an amount per policy) or fixed (one amount); the same rules as payout().
 */
function tierBasis(program, tier) {
  if (tier.basis) return tier.basis;
  if (tier.type === 'Percentage') return program.metric === 'premium' ? 'percentOfAchieved' : 'percentOfTarget';
  return program.metric === 'policies' ? 'perUnit' : 'fixed';
}
export const tiersOf = (program) => (program.structure || []).map((t) => ({ level: t.level, type: t.type, value: toNumber(t.value), maxPayout: t.maxPayout == null ? null : toNumber(t.maxPayout),
  basis: tierBasis(program, t) }));

/** The next tier above an achievement and what is still needed to reach it, in the program's measure; null at the top. */
export function nextTier(program, achieved, target) {
  const pct = target ? (achieved / target) * 100 : 0;
  const bands = (program.structure || []).map((t) => ({ t, r: tierRange(t.level) })).filter((x) => x.r).sort((a, b) => a.r.min - b.r.min);
  for (const { t, r } of bands) {
    const needed = r.percent ? round2((target * r.min) / 100 - achieved) : round2(r.min - achieved);
    if ((r.percent ? r.min > pct : r.min > achieved) && needed > 0) return { level: t.level, needed };
  }
  return null;
}

// ---------------- calculations ----------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/**
 * Period from 'YYYY-MM', a date or a label such as 'September 2026' -> { label, from, to }. A quarter or half-year
 * key of a result ('2026-Q3', '2026-H1', '2026': quarterly, semi-annual and annual programs) gives its months ('July to September 2026').
 */
export function parsePeriod(v, fromOverride, toOverride) {
  if (fromOverride && toOverride) return { label: String(v || `${fromOverride} to ${toOverride}`), from: isoDate(fromOverride), to: isoDate(toOverride) };
  let d = null;
  const s = String(v || '').trim();
  const named = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  const span = s.match(/^(\d{4})-([QH])([1-4])$/i);
  if (/^\d{4}$/.test(s)) return { label: `January to December ${s}`, from: `${s}-01-01`, to: `${s}-12-31` };
  if (span && (span[2].toUpperCase() === 'Q' || span[3] <= '2')) {
    const months = span[2].toUpperCase() === 'Q' ? 3 : 6;
    const start = new Date(Date.UTC(Number(span[1]), (Number(span[3]) - 1) * months, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 0));
    const name = (x) => x.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    return { label: `${name(start)} to ${name(end)} ${span[1]}`, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
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
  (SELECT display_name FROM users u WHERE u.id = c.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = c.rejected_by) AS rejected_by_name,
  (SELECT username FROM users u WHERE u.id = c.created_by) AS created_by_username, (SELECT username FROM users u WHERE u.id = c.submitted_by) AS submitted_by_username,
  (SELECT array_agg(COALESCE(p.name, x.code) ORDER BY x.n) FROM jsonb_array_elements_text(c.programs_included) WITH ORDINALITY AS x(code, n)
     LEFT JOIN incentive_programs p ON p.program_code = x.code) AS program_names,
  (SELECT array_agg(u.username ORDER BY x.n) FROM unnest(c.adjusted_by) WITH ORDINALITY AS x(id, n) JOIN users u ON u.id = x.id) AS adjusted_by_usernames,
  (SELECT array_agg(COALESCE(u.display_name, u.username) ORDER BY x.n) FROM unnest(c.adjusted_by) WITH ORDINALITY AS x(id, n) JOIN users u ON u.id = x.id) AS adjusted_by_names
  FROM incentive_calculations c`;

async function calcOut(c, withDetails = true) {
  const details = withDetails ? (await many(`SELECT r.*, u.display_name, COALESCE(u.employee_code, u.username) AS code, p.name AS program_name, p.program_code, p.metric
      FROM incentive_results r JOIN users u ON u.id = r.agent_user_id JOIN incentive_programs p ON p.id = r.program_id WHERE r.calculation_id = $1 ORDER BY u.display_name, p.name`, [c.batch_id]))
    .map((r) => ({ id: Number(r.id), agentId: r.agent_user_id, agentName: r.display_name, agentCode: r.code, programId: r.program_id, program: r.program_name, programCode: r.program_code,
      metric: r.metric, target: r.target, achieved: r.achieved, achievementPercent: r.achievement_percent, tier: r.tier, baseIncentive: r.base_incentive, adjustments: r.adjustments,
      adjustmentReason: r.adjustment_reason, adjustmentReasonCode: r.adjustment_reason_code, finalAmount: r.payout, status: r.status })) : undefined;
  const ts = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const at = (d) => (d ? new Date(d).toISOString() : null);
  return {
    batchId: c.batch_id, period: c.period, periodFrom: c.period_from, periodTo: c.period_to, calculationDate: ts(c.created_at), programsIncluded: c.programs_included, description: c.description,
    totalAmount: c.total_amount, agentCount: c.agent_count, status: c.status, createdBy: c.created_by_name, submittedBy: c.submitted_by_name, submittedDate: ts(c.submitted_date),
    approvedBy: c.approved_by_name, approvalDate: ts(c.approval_date), rejectedBy: c.rejected_by_name, rejectionDate: ts(c.rejection_date), rejectionReason: c.rejection_reason,
    paymentDate: c.payment_date, paymentReference: c.payment_reference,
    // who made the batch (maker-checker: neither may approve it) and the decision details
    createdById: c.created_by, createdByUsername: c.created_by_username, submittedById: c.submitted_by, submittedByUsername: c.submitted_by_username,
    createdAt: at(c.created_at), submittedAt: at(c.submitted_date), approvedAt: at(c.approval_date), rejectedAt: at(c.rejection_date),
    approvalRemarks: c.approval_remarks, rejectionReasonCode: c.rejection_reason_code,
    // program names in the order of programsIncluded, and the users who adjusted lines (they may not approve either)
    programNames: c.program_names || [], adjustedByIds: c.adjusted_by || [], adjustedByUsernames: c.adjusted_by_usernames || [], adjustedBy: c.adjusted_by_names || [],
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

/**
 * Run a calculation for the month chosen and the programs selected. Each program is calculated over its calculation
 * period (programPeriodOn: the month, quarter, half or year of its frequency) that ends with the month chosen, against
 * the target of that period, and once per period: a quarterly program is run in the last month of its quarter. A run
 * that gives no agent line is refused (there would be nothing to approve).
 */
export async function runCalculation(b, user) {
  const period = parsePeriod(b.period, b.periodFrom, b.periodTo);
  const refs = b.selectedPrograms || b.programs || b.programIds || [];
  if (!Array.isArray(refs) || !refs.length) throw badRequest('Validation failed', [{ path: 'selectedPrograms', message: 'Select at least one program' }]);
  const programs = [];
  for (const ref of refs) {
    const p = await programRow(typeof ref === 'object' ? ref.value ?? ref.id : ref);
    if (p.status !== 'Active') throw badRequest('Validation failed', [{ path: 'selectedPrograms', message: `${p.program_code} is not active` }]);
    if (p.period_to < period.from || p.period_from > period.to) throw badRequest('Validation failed', [{ path: 'selectedPrograms', message: `${p.program_code} does not run in ${period.label}` }]);
    const window = hasFrequency(p) ? programPeriodOn(p, minDate(period.to, p.period_to)) : { from: period.from, to: period.to };
    if (window.to > period.to) {
      const last = parsePeriod(window.to.slice(0, 7)).label;
      throw badRequest('Validation failed', [{ path: 'period', message: `${p.program_code} is calculated ${String(p.calculation_frequency).toLowerCase()}: its period ends in ${last}; run it for ${last}` }]);
    }
    programs.push({ ...p, window, periodKey: hasFrequency(p) ? programPeriodKey(p, window.to) : period.from.slice(0, 7) });
  }
  const agents = await eligibleAgents();
  const lines = [];
  for (const p of programs) {
    for (const a of agents) {
      const achieved = await programAchievement(p, a.id, p.window.from, p.window.to);
      if (!achieved) continue;
      const pay = payout(p, achieved, Number(p.target));
      lines.push({ program: p, agent: a, achieved, ...pay });
    }
  }
  const from = programs.reduce((m, p) => minDate(m, p.window.from), period.from);
  const to = programs.reduce((m, p) => maxDate(m, p.window.to), programs[0].window.to);
  const label = from.slice(0, 7) === to.slice(0, 7) ? parsePeriod(to.slice(0, 7)).label
    : `${parsePeriod(from.slice(0, 7)).label.replace(/ \d{4}$/, from.slice(0, 4) === to.slice(0, 4) ? '' : ` ${from.slice(0, 4)}`)} to ${parsePeriod(to.slice(0, 7)).label}`;
  if (!lines.length) {
    throw badRequest('Validation failed', [{ path: 'selectedPrograms', message: `No agent has an achievement in ${programs.map((p) => p.program_code).join(', ')} for ${label}; there is nothing to calculate` }]);
  }
  const batchId = await nextDocumentNumber('incentive_calc');
  await withTransaction(async (c) => {
    for (const l of lines) {
      const prior = (await c.query(`SELECT r.id, k.status FROM incentive_results r LEFT JOIN incentive_calculations k ON k.batch_id = r.calculation_id
                                    WHERE r.program_id = $1 AND r.agent_user_id = $2 AND r.period = $3`, [l.program.id, l.agent.id, l.program.periodKey])).rows[0];
      if (prior && prior.status !== 'Rejected') {
        throw conflict(`${l.program.program_code} for ${l.agent.display_name} is already calculated for ${parsePeriod(l.program.periodKey).label} (batch ${prior.status})`);
      }
      if (prior) await c.query('DELETE FROM incentive_results WHERE id = $1', [prior.id]);
    }
    await c.query(`INSERT INTO incentive_calculations(batch_id, period, period_from, period_to, programs_included, description, total_amount, agent_count, status, created_by)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Calculated',$9)`,
    [batchId, label, from, to, JSON.stringify(programs.map((p) => p.program_code)), b.description || null, round2(lines.reduce((s, l) => s + l.amount, 0)),
      new Set(lines.map((l) => l.agent.id)).size, user.id]);
    for (const l of lines) {
      await c.query(`INSERT INTO incentive_results(program_id, agent_user_id, achieved, payout, status, period, calculation_id, target, achievement_percent, base_incentive, tier)
                     VALUES ($1,$2,$3,$4,'Calculated',$5,$6,$7,$8,$4,$9)`, [l.program.id, l.agent.id, l.achieved, l.amount, l.program.periodKey, batchId, l.program.target, l.achievementPercent, l.tier]);
    }
  });
  return getCalculation(batchId);
}

async function refreshTotals(c, batchId) {
  await c.query(`UPDATE incentive_calculations SET total_amount = (SELECT COALESCE(sum(payout), 0) FROM incentive_results WHERE calculation_id = $1),
                 agent_count = (SELECT count(DISTINCT agent_user_id) FROM incentive_results WHERE calculation_id = $1), updated_at = now() WHERE batch_id = $1`, [batchId]);
}

/**
 * Adjust agent lines of a batch before it is decided: the amount added (or taken off) per line, with a reason of the
 * Reason Codes master (context incentive_adjustment; a note when the reason asks for one) for the whole change. The
 * adjusting user is kept on the batch (adjusted_by): like its creator and submitter, they may not approve it.
 */
export async function adjustCalculation(batchId, b, user) {
  const c = await calcRow(batchId);
  if (!['Calculated', 'Rejected'].includes(c.status)) throw conflict(`A ${c.status.toLowerCase()} batch cannot be adjusted`);
  if (!Array.isArray(b.lines) || !b.lines.length) throw badRequest('Validation failed', [{ path: 'lines', message: 'lines [{ id, adjustments }] are required' }]);
  const reason = await requiredReason(pool, 'incentive_adjustment', b);
  await withTransaction(async (tx) => {
    for (const l of b.lines) {
      const adj = toNumber(l.adjustments, NaN);
      if (!Number.isFinite(adj)) throw badRequest('Validation failed', [{ path: 'lines', message: 'adjustments must be a number' }]);
      const r = await tx.query(`UPDATE incentive_results SET adjustments = $3, adjustment_reason = $4, adjustment_reason_code = $5, payout = GREATEST(base_incentive + $3, 0), status = 'Adjusted'
                                WHERE id = $1 AND calculation_id = $2 RETURNING id`, [Number(l.id), c.batch_id, adj, reason.text, reason.code]);
      if (!r.rowCount) throw badRequest('Validation failed', [{ path: 'lines', message: `Line ${l.id} is not in batch ${c.batch_id}` }]);
    }
    await tx.query(`UPDATE incentive_calculations SET status = 'Calculated', adjusted_by = CASE WHEN $2 = ANY(adjusted_by) THEN adjusted_by ELSE array_append(adjusted_by, $2) END
                    WHERE batch_id = $1`, [c.batch_id, user.id]);
    await refreshTotals(tx, c.batch_id);
  });
  return { before: await calcOut(c), after: await getCalculation(c.batch_id) };
}

export async function submitCalculation(batchId, user) {
  const c = await calcRow(batchId);
  if (!['Calculated', 'Rejected'].includes(c.status)) throw conflict(`Batch is already ${c.status.toLowerCase()}`);
  if (!Number(c.agent_count)) throw conflict(`Batch ${c.batch_id} has no agent lines; there is nothing to approve`);
  await query(`UPDATE incentive_calculations SET status = 'Pending Approval', submitted_by = $2, submitted_date = now(), rejection_reason = NULL, rejection_reason_code = NULL,
                 updated_at = now() WHERE batch_id = $1`, [c.batch_id, user.id]);
  await notifyApprovers({ audience: 'approve:incentive', document: 'Incentive calculation', number: c.batch_id, by: user.username, detail: `period ${c.period}`,
    link: '/incentive/approvals', entity: 'incentive_calculation', entityId: c.batch_id });
  return { before: await calcOut(c, false), after: await getCalculation(c.batch_id) };
}

/**
 * Approve or reject a batch pending approval. Maker-checker: neither the user who ran the calculation, nor one who
 * adjusted its lines, nor the one who submitted it may decide it. The accrual of an approval is dated at the end of the
 * incentive period when that period is open, else on the day of the approval. A rejection needs a reason of the Reason Codes master (context incentive_batch_reject,
 * a note when the reason asks for one); an approval takes optional remarks.
 */
/** Date of the accrual of a batch: the last day of its incentive period when that period is open, else today. */
export async function accrualDate(db, c) {
  const t = await today();
  const end = isoDate(c.period_to);
  if (!end || end >= t) return t;
  const p = (await db.query('SELECT status FROM accounting_periods WHERE period = $1', [end.slice(0, 7)])).rows[0];
  return !p || p.status === 'open' ? end : t;
}

export async function decideCalculation(batchId, action, b, user) {
  const c = await calcRow(batchId);
  if (c.status !== 'Pending Approval') throw conflict(`Batch is ${c.status}; only batches pending approval can be ${action}d`);
  for (const maker of [c.submitted_by, c.created_by, ...(c.adjusted_by || [])]) await assertChecker(user, maker, 'calculation batch');
  const reason = action === 'reject' ? await requiredReason(pool, 'incentive_batch_reject', b) : null;
  const remarks = action === 'approve' ? String(b.remarks ?? b.comments ?? '').trim().slice(0, 1000) || null : null;
  await withTransaction(async (tx) => {
    if (action === 'approve') {
      await tx.query(`UPDATE incentive_calculations SET status = 'Approved', approved_by = $2, approval_date = now(), approval_remarks = $3, updated_at = now()
                      WHERE batch_id = $1`, [c.batch_id, user.id, remarks]);
      await tx.query('UPDATE incentive_results SET status = \'Approved\' WHERE calculation_id = $1', [c.batch_id]);
      // incentives earned are accrued (posting rule incentive.accrual)
      const total = round2((await tx.query('SELECT COALESCE(sum(payout), 0) AS t FROM incentive_results WHERE calculation_id = $1', [c.batch_id])).rows[0].t);
      if (total > 0) {
        const { postEvent } = await import('../accounting/lib/posting.js');
        const jv = await postEvent('incentive.accrual', { source: 'incentive', entryType: 'INCENTIVE_ACCRUAL', transactionCode: c.batch_id, referenceType: 'IncentiveCalculation', referenceId: c.batch_id,
          date: await accrualDate(tx, c), description: `Incentives ${c.batch_id} (${c.period}) approved`, amounts: { amount: total }, vars: { batchId: c.batch_id, period: c.period } }, { db: tx, user });
        await tx.query('UPDATE incentive_calculations SET accrual_jv_id = $2 WHERE batch_id = $1', [c.batch_id, jv.id]);
      }
    } else {
      await tx.query(`UPDATE incentive_calculations SET status = 'Rejected', rejected_by = $2, rejection_date = now(), rejection_reason = $3, rejection_reason_code = $4, updated_at = now()
                      WHERE batch_id = $1`, [c.batch_id, user.id, reason.text, reason.code]);
      await tx.query('UPDATE incentive_results SET status = \'Rejected\' WHERE calculation_id = $1', [c.batch_id]);
    }
  });
  await notifyDecision({ userId: c.submitted_by || c.created_by, decidedBy: user.id, document: 'Incentive calculation', number: c.batch_id, approved: action === 'approve', by: user.username,
    reason: action === 'approve' ? null : reason.text, link: '/incentive/calculations', entity: 'incentive_calculation', entityId: c.batch_id });
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

/** The actions of a batch as its activity log names them. */
const ACTIVITY_LABELS = { calculate: 'Calculated', adjust: 'Adjusted', submit: 'Submitted for approval', approve: 'Approved', reject: 'Rejected', pay: 'Paid' };

/** The remarks of a batch action as the activity log shows them, from the batch after the action. */
function activityRemarks(action, after) {
  if (!after || typeof after !== 'object') return null;
  if (action === 'calculate') return after.description || null;
  if (action === 'adjust') return [...new Set((after.details || []).map((d) => d.adjustmentReason).filter(Boolean))].join('; ') || null;
  if (action === 'approve') return after.approvalRemarks || null;
  if (action === 'reject') return after.rejectionReason || null;
  if (action === 'pay') return after.paymentReference || null;
  return null;
}

/**
 * Activity log of a calculation batch, oldest first: its audit rows (calculated, adjusted, submitted, approved,
 * rejected, paid) as lib/auditEvents#activityEntries gives them (user display name and roles, date and time, status
 * from / to), with the remarks of each action. The batch snapshots hold every agent line, so their field changes are
 * not listed.
 */
export async function calculationActivity(batchId, { viewer = null } = {}) {
  const c = await calcRow(batchId);
  const rows = await many(`SELECT a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source FROM audit_log a
                           WHERE a.entity = 'incentive_calculation' AND a.entity_id = $1 ORDER BY a.at, a.id`, [c.batch_id]);
  const entries = await activityEntries(rows, { viewer });
  // the action and the status words of the batch screens; the screen or API the action came from is not shown
  const status = (snap) => (snap && typeof snap === 'object' && snap.status) || null;
  return entries.map((e, i) => ({ ...e, actionLabel: ACTIVITY_LABELS[rows[i].action] || e.actionLabel, source: null,
    fromStatus: status(rows[i].before_data) === status(rows[i].after_data) ? null : status(rows[i].before_data) || e.fromStatus,
    toStatus: status(rows[i].before_data) === status(rows[i].after_data) ? null : status(rows[i].after_data) || e.toStatus,
    remarks: activityRemarks(rows[i].action, rows[i].after_data), changes: [] }));
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
      // progress in the current calculation period (targets and tiers apply per period), to date
      const current = programPeriodOn(p, minDate(t, p.period_to));
      const achieved = await programAchievement(p, a.id, current.from, current.to);
      const pay = payout(p, achieved, Number(p.target));
      assigned.push({ programId: p.id, programCode: p.program_code, programName: p.name, targetMetric: p.target_metric, target: p.target, stretchTarget: p.stretch_target, achieved,
        achievementPercent: pay.achievementPercent, potentialEarning: pay.amount, tier: pay.tier, daysRemaining: Math.max(0, Math.ceil((Date.parse(p.period_to) - Date.parse(t)) / 86400000)),
        startDate: p.period_from, endDate: p.period_to, calculationFrequency: p.calculation_frequency, periodFrom: current.from, periodTo: current.to,
        periodDaysRemaining: Math.max(0, Math.ceil((Date.parse(current.to) - Date.parse(t)) / 86400000)), lastUpdated: t,
        // facts of the program details: measure, eligibility, tiers and the next tier to reach
        metric: p.metric, programType: p.program_type, programStatus: p.status, applicableTo: p.applicable_to, currency: p.currency, ended: isoDate(p.period_to) < t,
        tiers: tiersOf(p), nextTier: nextTier(p, Number(achieved), Number(p.target)) });
    }
    // activity to date only: a policy incepting after today is not an achievement yet
    const acts = await many(`SELECT p.inception_date, p.premium_total, p.renewed_from, pr.name AS product FROM policies p LEFT JOIN products pr ON pr.id = p.product_id
                             WHERE p.owner_user_id = $1 AND p.inception_date <= $2::date AND p.status <> 'cancelled' ORDER BY p.inception_date DESC LIMIT 10`, [a.id, t]);
    out.push({ agentId: a.id, agentName: a.display_name, agentCode: a.code, branch: a.branch_name || a.branch_code, assignedPrograms: assigned,
      recentActivities: acts.map((x) => ({ date: x.inception_date, activity: `${x.renewed_from ? 'Policy Renewal' : 'New Policy'} - ${x.product || 'Policy'}`, impact: round2(x.premium_total), points: Math.round(Number(x.premium_total) / 100) })),
      activity: await incentiveEvents(a.id) });
  }
  return out;
}

/**
 * The incentive events of an agent, newest first: each result calculated, approved, rejected or paid, with its
 * program, incentive period, batch and amount (the incentive_results of the agent and their batches).
 */
export async function incentiveEvents(agentId, limit = 10) {
  const rows = await many(`SELECT r.period, r.payout, p.name AS program_name, p.program_code, c.batch_id, c.created_at, c.approval_date, c.rejection_date, c.payment_date
                           FROM incentive_results r JOIN incentive_calculations c ON c.batch_id = r.calculation_id JOIN incentive_programs p ON p.id = r.program_id
                           WHERE r.agent_user_id = $1 ORDER BY c.created_at DESC LIMIT 50`, [agentId]);
  const events = rows.flatMap((r) => {
    const base = { programName: r.program_name, programCode: r.program_code, period: parsePeriod(r.period).label, batchId: r.batch_id, amount: round2(r.payout) };
    return [['calculated', r.created_at], ['approved', r.approval_date], ['rejected', r.rejection_date], ['paid', r.payment_date]]
      .filter(([, at]) => at).map(([action, at]) => ({ ...base, action, date: new Date(at).toISOString() }));
  });
  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
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
    lastPayment: 0, lastPaymentDate: null, lastPaymentPeriods: [], pendingPeriods: [], paymentHistory: [], programBreakdown: [], monthlyTrend: [], contact: await statementContact() };
}

/** Approved and paid incentives of an agent, one row per batch and incentive period, newest period first. */
async function paymentHistory(agentId) {
  const rows = await many(`SELECT c.batch_id, r.period, array_agg(DISTINCT p.name ORDER BY p.name) AS programs, sum(r.payout) AS amount, c.status, c.approval_date, c.payment_date, c.payment_reference
                           FROM incentive_results r JOIN incentive_calculations c ON c.batch_id = r.calculation_id JOIN incentive_programs p ON p.id = r.program_id
                           WHERE r.agent_user_id = $1 AND c.status IN ('Approved', 'Paid')
                           GROUP BY c.batch_id, r.period ORDER BY r.period DESC, c.batch_id DESC LIMIT 24`, [agentId]);
  return rows.map((r) => ({ batchId: r.batch_id, period: parsePeriod(r.period).label, periodKey: r.period, programs: r.programs, amount: round2(r.amount), status: r.status,
    approvalDate: r.approval_date ? new Date(r.approval_date).toISOString().slice(0, 10) : null, paymentDate: r.payment_date ? isoDate(r.payment_date) : null, paymentReference: r.payment_reference }));
}

/** The result keys of a statement month: the month, and the quarter, half and year that end with it. */
export function keysEndingIn(month) {
  const [y, m] = [month.slice(0, 4), Number(month.slice(5, 7))];
  return [month, ...(m % 3 === 0 ? [`${y}-Q${m / 3}`] : []), ...(m % 6 === 0 ? [`${y}-H${m / 6}`] : []), ...(m === 12 ? [y] : [])];
}

export async function statement(agentId, periodRef) {
  const [a] = await eligibleAgents(agentId);
  if (!a) throw notFound('Agent not found or not eligible for incentives');
  const period = parsePeriod(periodRef || (await today()).slice(0, 7));
  const key = period.from.slice(0, 7);
  const lines = await many(`SELECT r.*, p.name, p.structure, p.metric FROM incentive_results r JOIN incentive_programs p ON p.id = r.program_id
                            WHERE r.agent_user_id = $1 AND r.period = ANY($2) AND r.status <> 'Rejected'`, [a.id, keysEndingIn(key)]);
  // Programs running in the period that are not calculated yet: progress to date from the same source as My Programs
  const running = await many(`SELECT * FROM incentive_programs WHERE status = 'Active' AND period_from <= $2::date AND period_to >= $1::date
                              AND id <> ALL($3::int[]) ORDER BY period_from`, [period.from, period.to, lines.map((l) => l.program_id)]);
  const inProgress = [];
  for (const p of running) {
    const achieved = await programAchievement(p, a.id, period.from, period.to);
    if (!achieved) continue;
    const pay = payout(p, achieved, Number(p.target));
    inProgress.push({ program: p.name, metric: p.metric, target: Number(p.target), achievement: achieved, achievementPercent: pay.achievementPercent, rate: pay.tier || '-', earnedAmount: 0,
      potentialEarning: pay.amount, status: 'In Progress' });
  }
  const earned = (statuses, extra = '', params = []) => one(`SELECT COALESCE(sum(payout), 0) AS v FROM incentive_results WHERE agent_user_id = $1 AND status = ANY($2) ${extra}`, [a.id, statuses, ...params]);
  const ytd = await earned(['Approved', 'Paid'], 'AND left(period, 4) = $3', [key.slice(0, 4)]);
  const pending = await earned(['Approved']);
  const last = await one('SELECT paid_at, sum(payout) AS v, array_agg(DISTINCT period) AS periods FROM incentive_results WHERE agent_user_id = $1 AND status = \'Paid\' GROUP BY paid_at ORDER BY paid_at DESC LIMIT 1', [a.id]);
  const pendingPeriods = (await many('SELECT DISTINCT period FROM incentive_results WHERE agent_user_id = $1 AND status = \'Approved\'', [a.id])).map((r) => r.period);
  const months = lastMonths(13, new Date(`${key}-01T00:00:00Z`));
  // a quarter, half or year counts in its last month
  const trend = (await many('SELECT period, COALESCE(sum(payout), 0) AS v FROM incentive_results WHERE agent_user_id = $1 AND status IN (\'Approved\', \'Paid\') AND left(period, 4) >= $2 GROUP BY period',
    [a.id, months[0].key.slice(0, 4)])).map((r) => ({ period: parsePeriod(r.period).to.slice(0, 7), v: Number(r.v) }));
  return {
    agentId: a.id, agentName: a.display_name, agentCode: a.code, branch: a.branch_name || a.branch_code, period: period.label, statementDate: (await today()),
    totalEarnings: round2(lines.filter((l) => ['Approved', 'Paid'].includes(l.status)).reduce((s, l) => s + Number(l.payout), 0)), ytdEarnings: round2(ytd.v), pendingPayment: round2(pending.v),
    lastPayment: last ? round2(last.v) : 0, lastPaymentDate: last?.paid_at ? new Date(last.paid_at).toISOString().slice(0, 10) : null,
    // incentive periods of the last payment and of the approved, unpaid results (labels such as "August 2026")
    lastPaymentPeriods: periodLabels(last?.periods || []), pendingPeriods: periodLabels(pendingPeriods), contact: await statementContact(),
    paymentHistory: await paymentHistory(a.id),
    programBreakdown: [...lines.map((l) => ({ program: l.name, metric: l.metric, target: l.target, achievement: l.achieved, achievementPercent: l.achievement_percent, rate: l.tier || '-', earnedAmount: l.payout, status: l.status })),
      ...inProgress],
    monthlyTrend: months.map(({ key: k }) => ({ month: new Date(`${k}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + '-' + k.slice(2, 4), period: k, earnings: round2(trend.filter((t) => t.period === k).reduce((x, t) => x + t.v, 0)) })),
  };
}

// ---------------- reports ----------------

export async function reportTemplates() {
  const rows = await many('SELECT id, data FROM master_records WHERE type_code = \'incentive-report-template\' AND status = \'active\' ORDER BY code');
  return rows.map((r) => ({ id: r.id, ...r.data }));
}

/** Column headings of the report files. */
const REPORT_LABELS = {
  period: 'Period', agent: 'Agent', agent_code: 'Agent code', branch: 'Branch', program_code: 'Program code', program: 'Program', name: 'Program', target_metric: 'Measure',
  agents: 'Agents', target: 'Target', achieved: 'Achieved', achievement_percent: 'Achievement %', tier: 'Tier', base_incentive: 'Base incentive', adjustments: 'Adjustments',
  payout: 'Payout', status: 'Status',
};
const reportColumns = (keys) => keys.map((k) => ({ key: k, label: REPORT_LABELS[k] || k }));
/** Numeric columns of the report files (right-aligned amounts in the PDF, numbers in Excel). */
const REPORT_TYPES = { agents: 'integer', target: 'number', achieved: 'number', achievement_percent: 'number', base_incentive: 'money', adjustments: 'money', payout: 'money' };
/** The file formats a template may list (Master > Incentive Report Templates). */
const REPORT_FORMATS = {
  pdf: { ext: 'pdf', type: 'application/pdf', label: 'PDF' },
  excel: { ext: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
  csv: { ext: 'csv', type: 'text/csv', label: 'CSV' },
};
const periodKeyOf = (v) => (v ? parsePeriod(v).from.slice(0, 7) : null);

export async function generateReport(b, user) {
  const ref = b.templateId ?? b.reportType ?? b.templateCode;
  if (!ref) throw badRequest('Validation failed', [{ path: 'templateId', message: 'templateId is required' }]);
  const tpl = await one('SELECT id, data FROM master_records WHERE type_code = \'incentive-report-template\' AND status = \'active\' AND (id::text = $1 OR code = $1 OR name = $1)', [String(ref)]);
  if (!tpl) throw notFound('Report template not found');
  const p = b.parameters?.parameters || b.parameters || {};
  // parameters of the template (Master > Incentive Report Templates): period, program, agent, branch (code), a range of
  // incentive periods (from / to: months or dates), a minimum achievement % and the number of top performers
  const periodKey = periodKeyOf(p.period || p.Period);
  const program = p.program || p.Program || null;
  const agent = p.agent || p.agentId || null;
  const branch = p.branch || null;
  const fromKey = periodKeyOf(p.from || p.dateFrom || p.daterangeFrom);
  const toKey = periodKeyOf(p.to || p.dateTo || p.daterangeTo);
  const minAchievement = p.minAchievement === undefined || p.minAchievement === null || p.minAchievement === '' ? null : toNumber(p.minAchievement, null);
  let rows;
  let columns;
  const formats = (tpl.data.formats || []).map(String);
  const requested = String(b.format || b.parameters?.format || formats[0] || 'Excel');
  const format = REPORT_FORMATS[requested.toLowerCase()];
  if (!format || (formats.length && !formats.some((f) => f.toLowerCase() === requested.toLowerCase()))) {
    throw badRequest('Validation failed', [{ path: 'format', message: `${tpl.data.name} is produced as ${formats.join(' or ') || 'Excel'}` }]);
  }
  if (tpl.data.layout === 'summary') {
    // incentives paid, by incentive period, program and branch
    rows = await many(`SELECT r.period, p.program_code, p.name AS program, COALESCE(b.name, u.branch_code) AS branch, count(DISTINCT r.agent_user_id)::int AS agents, sum(r.payout) AS payout
                       FROM incentive_results r JOIN users u ON u.id = r.agent_user_id JOIN incentive_programs p ON p.id = r.program_id LEFT JOIN branches b ON b.code = u.branch_code
                       WHERE r.status = 'Paid' AND ($1::text IS NULL OR r.period = $1) AND ($2::text IS NULL OR p.program_code = $2) AND ($3::text IS NULL OR u.branch_code = $3)
                         AND ($4::text IS NULL OR r.period >= $4) AND ($5::text IS NULL OR r.period <= $5)
                       GROUP BY r.period, p.program_code, p.name, COALESCE(b.name, u.branch_code) ORDER BY r.period DESC, p.program_code, 4`, [periodKey, program, branch, fromKey, toKey]);
    rows = rows.map((r) => ({ ...r, period: parsePeriod(r.period).label }));
    columns = reportColumns(['period', 'program_code', 'program', 'branch', 'agents', 'payout']);
  } else if (tpl.data.category === 'Program Analysis') {
    rows = await many(`SELECT p.program_code, p.name, p.target_metric, count(DISTINCT r.agent_user_id)::int AS agents, COALESCE(sum(r.achieved), 0) AS achieved, COALESCE(sum(r.payout), 0) AS payout
                       FROM incentive_programs p LEFT JOIN incentive_results r ON r.program_id = p.id AND r.status <> 'Rejected'
                         AND ($2::text IS NULL OR r.period >= $2) AND ($3::text IS NULL OR r.period <= $3)
                       WHERE p.status <> 'Deleted' AND ($1::text IS NULL OR p.program_code = $1)
                       GROUP BY p.id ORDER BY p.program_code`, [program, fromKey, toKey]);
    columns = reportColumns(['program_code', 'name', 'target_metric', 'agents', 'achieved', 'payout']);
  } else {
    rows = await many(`SELECT r.period, u.display_name AS agent, COALESCE(u.employee_code, u.username) AS agent_code, COALESCE(b.name, u.branch_code) AS branch, p.program_code, p.name AS program,
                         r.target, r.achieved, r.achievement_percent, r.tier, r.base_incentive, r.adjustments, r.payout, r.status
                       FROM incentive_results r JOIN users u ON u.id = r.agent_user_id JOIN incentive_programs p ON p.id = r.program_id LEFT JOIN branches b ON b.code = u.branch_code
                       WHERE r.status <> 'Rejected' AND ($1::text IS NULL OR r.period = $1) AND ($2::text IS NULL OR p.program_code = $2) AND ($3::text IS NULL OR u.id = $3)
                         AND ($4::text IS NULL OR u.branch_code = $4) AND ($5::text IS NULL OR r.period >= $5) AND ($6::text IS NULL OR r.period <= $6)
                         AND ($7::numeric IS NULL OR r.achievement_percent >= $7)
                       ORDER BY ${tpl.data.category === 'Performance Reports' ? 'r.achievement_percent DESC NULLS LAST' : 'r.period DESC, u.display_name'}`,
    [periodKey, program, agent, branch, fromKey, toKey, minAchievement]);
    const top = toNumber(p.topN ?? p['Top N'], 0);
    if (top > 0) rows = rows.slice(0, top);
    rows = rows.map((r) => ({ ...r, period: parsePeriod(r.period).label }));
    columns = reportColumns(['period', 'agent', 'agent_code', 'branch', 'program_code', 'program', 'target', 'achieved', 'achievement_percent', 'tier', 'base_incentive', 'adjustments', 'payout', 'status']);
  }
  const typed = columns.map((c) => ({ ...c, ...(REPORT_TYPES[c.key] ? { type: REPORT_TYPES[c.key] } : {}) }));
  const values = rows.map((r) => Object.fromEntries(typed.map((c) => [c.key, c.type && r[c.key] !== null && r[c.key] !== undefined ? Number(r[c.key]) : r[c.key]])));
  let content;
  if (format.ext === 'pdf') {
    const params = Object.entries(p).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`).join('; ');
    content = await renderReportPdf({ title: tpl.data.name, params, columns: typed, rows: values }, { user: user.id });
  } else if (format.ext === 'xlsx') {
    content = writeXlsx({ title: tpl.data.name, sheets: [{ name: tpl.data.name, columns: typed, rows: values, freeze: true }] });
  } else content = toCsv(rows, columns);
  const saved = await saveFile({ category: 'incentive-reports', fileName: `${tpl.data.code}_${(await today())}.${format.ext}`, content, contentType: format.type, entity: 'incentive_report', entityId: tpl.data.code, userId: user.id });
  const r = await one(`INSERT INTO generated_reports(code, name, params, format, storage_key, row_count, generated_by, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'done') RETURNING id, created_at`,
    [`incentive:${tpl.data.code}`, tpl.data.name, JSON.stringify({ parameters: p, format: format.label }), format.ext, saved.key, rows.length, user.id]);
  return { reportId: r.id, reportType: tpl.data.name, templateCode: tpl.data.code, generatedDate: r.created_at, fileUrl: saved.url, rowCount: rows.length, format: format.label };
}

export async function reportHistory() {
  const rows = await many(`SELECT g.*, (SELECT display_name FROM users u WHERE u.id = g.generated_by) AS by_name FROM generated_reports g WHERE g.code LIKE 'incentive:%' ORDER BY g.created_at DESC LIMIT 200`);
  return rows.map((g) => ({ reportId: g.id, reportType: g.name, templateCode: g.code.split(':')[1], generatedDate: g.created_at, generatedBy: g.by_name, rowCount: g.row_count, fileUrl: g.storage_key ? fileUrl(g.storage_key) : null, status: g.status,
    format: REPORT_FORMATS[g.format === 'xlsx' ? 'excel' : g.format]?.label || String(g.format || '').toUpperCase() }));
}
