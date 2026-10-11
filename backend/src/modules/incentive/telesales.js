/**
 * Telesales incentive (TIS-BRD-COMM-08, FRS COMM-08): a program of type Telesales pays the callers of the accredited
 * insurance partners a monthly incentive on the Motor policies of their official call-out leads.
 *
 * - Program versions by month (FR-TSI-001 to 005): minimum policies, withholding tax %, Motor products, ANC tier table
 *   (new-business and renewal amount per policy) and production-excess table; each version is approved on Master >
 *   Finance > Configuration Approvals (change kind incentive-program, approve:incentive, never its maker). The version
 *   in force on the first day of a month calculates that month.
 * - Callers (FR-TSI-004): who takes part, with insurance partner, Team Leader and dates; Disqualify / Reinstate by two
 *   different holders of approve:incentive.
 * - Telesales policies (FR-TSI-011, 020 to 022): a policy is a caller's when the caller owned the prospect on the
 *   quotation date, the prospect carried a valid call-out endorsement for the caller (../leads/callout.js) and the
 *   policy is placed with the caller's insurance partner (incentive.telesales.same_insurer_only). It is eligible on the
 *   later of full payment and commission settlement, counted once in the month of that date, NB or renewal by its
 *   renewal link, with its net commission (commission less referrer / agent shares) stored at that date.
 * - Monthly calculation (FR-TSI-030 to 037): one batch per program and month (the incentive batch of service.js): the
 *   minimum-policy trigger, ANC level and base, additional incentive (incentive.telesales.excess_method), recovery of
 *   policies cancelled after payout, withholding tax; exclusions and adjustments with reasons are kept on recalculation.
 *
 * Messages carry their FRS id (code MSG-TSI-nnn).
 */
import { many, one, pool, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { businessTimeZone, today } from '../../lib/dates.js';
import { round2, toNumber } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { baseCurrency } from '../../lib/currency.js';
import { notify } from '../notifications/service.js';
import { notifyApprovers } from '../notifications/approvals.js';
import { requiredReason } from '../ops-masters/records.js';
import { writeXlsx } from '../../lib/xlsx.js';

export const TELESALES = 'Telesales';
export const ANC_METRIC = 'Average Net Commission (ANC)';
const APPLICABLE_TO = 'Telesales caller';
const APPROVALS_LINK = '/master/finance/configuration-approvals';
/** Policy statuses that can count (FR-TSI-020 R2); cancelled and lapsed never do. */
const COUNTABLE = ['active', 'expired', 'renewed'];
const CANCELLED = ['cancelled', 'lapsed'];
/** Lines of a calculation batch: the caller line results (FRS 6.3). */
export const RESULTS = ['Qualified', 'Not qualified', 'Below level 1', 'Disqualified', 'Recovery outstanding'];
/** Policy incentive statuses of the Policies tab (FRS 5.4, 6.3) and the two informative ones of the review. */
export const POLICY_STATUSES = ['Counted', 'Excluded', 'Waiting for commission', 'Not fully paid', 'Cancelled', 'Recovery', 'Disqualified', 'Not eligible', 'Not a call-out lead'];

const MAX_ROWS = 10;
const fail = (errors) => { throw badRequest('Validation failed', errors); };
const err = (path, id, message) => ({ path, message, code: `MSG-TSI-${id}` });
const isMonthStart = (d) => /^\d{4}-\d{2}-01$/.test(String(d || ''));
const monthKey = (d) => String(d).slice(0, 7);
const monthLabel = (d) => new Date(`${String(d).slice(0, 7)}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthEnd = (d) => new Date(Date.UTC(Number(String(d).slice(0, 4)), Number(String(d).slice(5, 7)), 0)).toISOString().slice(0, 10);
const nextMonth = (d) => new Date(Date.UTC(Number(String(d).slice(0, 4)), Number(String(d).slice(5, 7)), 1)).toISOString().slice(0, 10);
const prevMonth = (d) => new Date(Date.UTC(Number(String(d).slice(0, 4)), Number(String(d).slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
const iso = (v) => (v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null);
const dmy = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : '');
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const maxIso = (a, b) => (!a ? b : !b ? a : a > b ? a : b);

// ---------------------------------------------------------------- rules (pure)

/** The ANC tier table as stored: [{ ancFrom, nbAmount, renewalAmount }] with numbers. */
export const cleanTiers = (tiers) => (Array.isArray(tiers) ? tiers : []).map((t) => ({
  ancFrom: round2(toNumber(t?.ancFrom, NaN)), nbAmount: round2(toNumber(t?.nbAmount, NaN)), renewalAmount: round2(toNumber(t?.renewalAmount ?? 0, NaN)),
}));
/** The production-excess table as stored: [{ over, every, amount }]. */
export const cleanBands = (bands) => (Array.isArray(bands) ? bands : []).map((b) => ({ over: toNumber(b?.over, NaN), every: toNumber(b?.every, NaN), amount: round2(toNumber(b?.amount, NaN)) }));

/** The tier table checks (FR-TSI-002): errors and the warning of a renewal paid as new business (MSG-TSI-014). */
export function tierProblems(tiers) {
  const errors = [];
  const warnings = [];
  if (!tiers.length) errors.push(err('tiers', '010', 'Add at least one ANC level'));
  if (tiers.length > MAX_ROWS) errors.push(err('tiers', '015', 'A tier table can have at most 10 levels'));
  tiers.forEach((t, i) => {
    const n = i + 1;
    if (!Number.isFinite(t.ancFrom) || (i === 0 && !(t.ancFrom > 0))) errors.push(err(`tiers[${i}].ancFrom`, '011', `Level ${n}: ANC from must be more than 0`));
    else if (i > 0 && !(t.ancFrom > tiers[i - 1].ancFrom)) errors.push(err(`tiers[${i}].ancFrom`, '011', `Level ${n}: ANC from must be higher than level ${n - 1}`));
    if (!(t.nbAmount > 0)) errors.push(err(`tiers[${i}].nbAmount`, '012', `Level ${n}: the new-business amount must be more than 0`));
    if (!Number.isFinite(t.renewalAmount) || t.renewalAmount < 0) errors.push(err(`tiers[${i}].renewalAmount`, '013', `Level ${n}: the renewal amount must be 0 or more`));
    else if (t.nbAmount > 0 && t.renewalAmount > t.nbAmount) errors.push(err(`tiers[${i}].renewalAmount`, '013', `Level ${n}: the renewal amount cannot be higher than the new-business amount`));
    else if (t.nbAmount > 0 && t.renewalAmount === t.nbAmount) warnings.push(err(`tiers[${i}].renewalAmount`, '014', `Level ${n}: renewal pays the same as new business`));
  });
  return { errors, warnings };
}

/** The production-excess table checks (FR-TSI-003). No band is allowed (no additional incentive). */
export function bandProblems(bands, minPolicies) {
  const errors = [];
  if (bands.length > MAX_ROWS) errors.push(err('bands', '016', 'A production-excess table can have at most 10 bands'));
  bands.forEach((b, i) => {
    const n = i + 1;
    if (!Number.isInteger(b.over) || b.over < 0) errors.push(err(`bands[${i}].over`, '016', `Band ${n}: In excess of must be a whole number`));
    else if (i === 0 && Number.isInteger(minPolicies) && b.over < minPolicies) errors.push(err('bands[0].over', '017', `The first band must start at or above the minimum of ${minPolicies} policies`));
    else if (i > 0 && !(b.over > bands[i - 1].over)) errors.push(err(`bands[${i}].over`, '016', `Band ${n}: In excess of must be higher than band ${n - 1}`));
    if (!Number.isInteger(b.every) || b.every < 1) errors.push(err(`bands[${i}].every`, '018', `Band ${n}: Every must be a whole number of 1 or more`));
    if (!(b.amount > 0)) errors.push(err(`bands[${i}].amount`, '019', `Band ${n}: the additional incentive must be more than 0`));
  });
  return { errors };
}

/** The tiers with their level and ANC to (next ANC from - 0.01; null on the last: "and above"). */
export const tiersOut = (tiers) => tiers.map((t, i) => ({ level: i + 1, ...t, ancTo: tiers[i + 1] ? round2(tiers[i + 1].ancFrom - 0.01) : null }));
/** The bands with their Up to (the next threshold; null on the last: "no limit"). */
export const bandsOut = (bands) => bands.map((b, i) => ({ band: i + 1, ...b, upTo: bands[i + 1] ? bands[i + 1].over : null }));

/** The level (1..n) whose range holds the ANC, or null below level 1 (FR-TSI-032 R1). */
export function levelOf(tiers, anc) {
  let level = null;
  tiers.forEach((t, i) => { if (anc >= t.ancFrom) level = i + 1; });
  return level;
}

/** Average net commission: sum / count, rounded half up to 2 decimals (FR-TSI-022 R2); 0 without a policy. */
export const ancOf = (sum, count) => (count > 0 ? round2(sum / count) : 0);

/**
 * Additional incentive for n counted policies (FR-TSI-033): banded (each band pays its full blocks of the policies
 * between its threshold and the next) or highest_band (only the highest band whose threshold n exceeds).
 */
export function excessIncentive(bands, n, method = 'banded') {
  if (!bands.length || !(n > 0)) return 0;
  if (method === 'highest_band') {
    const top = [...bands].reverse().find((b) => n > b.over);
    return top ? round2(Math.floor((n - top.over) / top.every) * top.amount) : 0;
  }
  return round2(bands.reduce((s, b, i) => {
    const next = bands[i + 1]?.over ?? Infinity;
    const inBand = Math.max(0, Math.min(n, next) - b.over);
    return s + Math.floor(inBand / b.every) * b.amount;
  }, 0));
}

/**
 * The totals of a caller line (FR-TSI-034): gross = base + additional + recovery + adjustments; tax on a positive gross
 * at the withholding tax %; total never below 0; a negative gross is carried to the next month.
 */
export function lineTotals({ base = 0, additional = 0, recovery = 0, adjustments = 0, whtPct = 0 }) {
  const gross = round2(Number(base) + Number(additional) + Number(recovery) + Number(adjustments));
  const tax = round2((Math.max(gross, 0) * Number(whtPct)) / 100);
  return { gross, tax, total: round2(Math.max(gross - tax, 0)), carried: gross < 0 ? round2(-gross) : 0 };
}

/** Policies still needed for the next additional payment above n (null when no band pays more). */
export function toNextBand(bands, n, method = 'banded') {
  if (!bands.length) return null;
  const now = excessIncentive(bands, n, method);
  for (let k = n + 1; k <= n + 1000; k += 1) if (excessIncentive(bands, k, method) > now) return k - n;
  return null;
}

// ---------------------------------------------------------------- settings and helpers

async function settingsOf() {
  return {
    method: (await getSetting('incentive.telesales.excess_method', 'banded')) === 'highest_band' ? 'highest_band' : 'banded',
    runDay: Number(await getSetting('incentive.telesales.run_day', 5)) || 5,
    validityDays: Number(await getSetting('incentive.telesales.callout_validity_days', 90)) || 0,
    sameInsurer: (await getSetting('incentive.telesales.same_insurer_only', true)) !== false,
    minPolicies: Number(await getSetting('incentive.telesales.default_min_policies', 15)) || 15,
    whtPct: Number(await getSetting('incentive.telesales.default_wht_pct', 5)),
    lines: ((await getSetting('incentive.telesales.eligible_lines', ['motor'])) || ['motor']).map((l) => String(l).toLowerCase()),
    tiers: cleanTiers(await getSetting('incentive.telesales.default_tiers', [])),
    bands: cleanBands(await getSetting('incentive.telesales.default_bands', [])),
  };
}

/** Whether a user holds a permission through the roles they have (System Administrator holds every one). */
export async function userHas(userId, code, db = pool) {
  const r = (await db.query(`SELECT EXISTS (SELECT 1 FROM user_effective_roles($1) er JOIN role_permissions rp ON rp.role_id = er.role_id
    JOIN permissions p ON p.id = rp.permission_id WHERE p.code = $2) AS ok`, [userId, code])).rows[0];
  return !!r?.ok;
}

/** The products a Telesales program may count: active products of the eligible lines (Motor). */
export async function eligibleProducts() {
  const { lines } = await settingsOf();
  return many('SELECT id, code, name, line FROM products WHERE lower(line) = ANY($1) AND status = \'active\' ORDER BY name', [lines]);
}

/** Defaults of a new Telesales program and the lists of its screens. */
export async function telesalesDefaults() {
  const s = await settingsOf();
  const products = await eligibleProducts();
  const t = await today();
  return { minPolicies: s.minPolicies, whtPct: s.whtPct, excessMethod: s.method, tiers: tiersOut(s.tiers), bands: bandsOut(s.bands), products,
    defaultProducts: products.map((p) => p.id), effectiveFrom: nextMonth(t), targetMetric: ANC_METRIC, calculationFrequency: 'Monthly', applicableTo: [APPLICABLE_TO],
    callerResults: RESULTS, policyStatuses: POLICY_STATUSES };
}

// ---------------------------------------------------------------- programs and versions

const VERSION_SELECT = `SELECT v.*, (SELECT display_name FROM users u WHERE u.id = v.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = v.updated_by) AS updated_by_name,
  (SELECT display_name FROM users u WHERE u.id = v.submitted_by) AS submitted_by_name, (SELECT display_name FROM users u WHERE u.id = v.approved_by) AS approved_by_name,
  (SELECT display_name FROM users u WHERE u.id = v.returned_by) AS returned_by_name,
  (SELECT array_agg(p.name ORDER BY p.name) FROM products p WHERE p.id = ANY(v.products)) AS product_names
  FROM incentive_program_versions v`;

async function versionRows(programId, db = pool) {
  return (await db.query(`${VERSION_SELECT} WHERE v.program_id = $1 ORDER BY v.version`, [programId])).rows;
}

/** The approved version in force on a date: the latest effective from on or before it (then the highest version). */
export function inForce(versions, date) {
  return versions.filter((v) => v.status === 'Approved' && iso(v.effective_from) <= date)
    .sort((a, b) => (iso(b.effective_from) > iso(a.effective_from) ? 1 : iso(b.effective_from) < iso(a.effective_from) ? -1 : b.version - a.version))[0] || null;
}

function versionOut(v, versions, t) {
  const approved = versions.filter((x) => x.status === 'Approved');
  const current = inForce(versions, t);
  // superseded from the effective month of the next approved version
  const later = approved.filter((x) => x.id !== v.id && iso(x.effective_from) > iso(v.effective_from)).sort((a, b) => (iso(a.effective_from) > iso(b.effective_from) ? 1 : -1))[0];
  let displayStatus = v.status;
  if (v.status === 'Approved') displayStatus = current?.id === v.id ? 'In force' : later && iso(later.effective_from) <= t ? 'Superseded' : iso(v.effective_from) > t ? 'Approved' : 'Superseded';
  const tiers = cleanTiers(v.tiers);
  const bands = cleanBands(v.bands);
  return {
    id: v.id, version: v.version, effectiveFrom: iso(v.effective_from), minPolicies: v.min_policies, whtPct: Number(v.wht_pct), products: v.products || [], productNames: v.product_names || [],
    tiers: tiersOut(tiers), bands: bandsOut(bands), status: v.status, displayStatus, supersededFrom: later ? iso(later.effective_from) : null,
    changeReason: v.change_reason, returnRemark: v.return_remark, changeId: v.change_id ? Number(v.change_id) : null,
    createdBy: v.created_by_name || v.created_by, createdById: v.created_by, createdAt: v.created_at, updatedBy: v.updated_by_name || v.updated_by, updatedById: v.updated_by, updatedAt: v.updated_at,
    submittedBy: v.submitted_by_name || v.submitted_by, submittedById: v.submitted_by, submittedAt: v.submitted_at,
    approvedBy: v.approved_by_name || v.approved_by, approvedAt: v.approved_at, returnedBy: v.returned_by_name || v.returned_by, returnedAt: v.returned_at,
  };
}

const CALLER_SELECT = `SELECT c.*, u.display_name AS user_name, COALESCE(u.employee_code, u.username) AS user_code, tl.display_name AS team_leader_name, ic.name AS insurer_name,
  dq.display_name AS disqualified_by_name, rq.display_name AS reinstated_by_name
  FROM incentive_callers c JOIN users u ON u.id = c.user_id LEFT JOIN users tl ON tl.id = c.team_leader_id LEFT JOIN insurance_companies ic ON ic.id = c.insurance_company_id
  LEFT JOIN users dq ON dq.id = c.disqualified_by LEFT JOIN users rq ON rq.id = c.reinstated_by`;

/** Whether a caller row is disqualified in a month (from the month of its date until reinstated; FR-TSI-004 R4). */
export const disqualifiedIn = (c, from, to) => !!c.disqualified_from && iso(c.disqualified_from) <= to && (!c.reinstated_on || iso(c.reinstated_on) > to);

function callerOut(c, t) {
  const disqualified = !!c.disqualified_from && !c.reinstated_on;
  const ended = c.date_to && iso(c.date_to) < t;
  return {
    id: c.id, programId: c.program_id, userId: c.user_id, name: c.user_name, code: c.user_code, insuranceCompanyId: c.insurance_company_id, insurer: c.insurer_name,
    teamLeaderId: c.team_leader_id, teamLeader: c.team_leader_name, dateFrom: iso(c.date_from), dateTo: iso(c.date_to),
    status: ended ? 'Ended' : disqualified ? 'Disqualified' : 'Active',
    disqualifiedFrom: iso(c.disqualified_from), disqualifyReasonCode: c.disqualify_reason_code, disqualifyReason: c.disqualify_reason, disqualifiedBy: c.disqualified_by_name, disqualifiedById: c.disqualified_by,
    reinstatedOn: iso(c.reinstated_on), reinstateRemark: c.reinstate_remark, reinstatedBy: c.reinstated_by_name,
  };
}

async function programRow(id, db = pool) {
  const p = (await db.query('SELECT * FROM incentive_programs WHERE (id::text = $1 OR lower(program_code) = lower($1)) AND status <> \'Deleted\'', [String(id)])).rows[0];
  if (!p) throw notFound('Incentive program not found');
  if (p.program_type !== TELESALES) throw badRequest(`${p.program_code} is not a Telesales program`);
  return p;
}

/** First month a new version may start: the month after the last month with a batch that is not rejected (FR-TSI-001 R5). */
async function firstOpenMonth(programId, db = pool) {
  const r = (await db.query(`SELECT max(period_from) AS last FROM incentive_calculations c WHERE c.status <> 'Rejected' AND c.program_kind = 'telesales'
    AND EXISTS (SELECT 1 FROM incentive_results r WHERE r.calculation_id = c.batch_id AND r.program_id = $1)`, [programId])).rows[0];
  return r?.last ? nextMonth(iso(r.last)) : null;
}

/** Another Telesales program in force in a month (FR-TSI-001 R6), or null. */
async function otherInForce(programId, month, db = pool) {
  const others = (await db.query(`SELECT p.id, p.program_code, p.inactive_from FROM incentive_programs p WHERE p.program_type = $1 AND p.status NOT IN ('Deleted')
    AND p.id <> $2`, [TELESALES, programId || 0])).rows;
  for (const o of others) {
    if (o.inactive_from && iso(o.inactive_from) <= month) continue;
    const v = inForce(await versionRows(o.id, db), month);
    if (v) return o;
  }
  return null;
}

/** The program with its versions, callers and the version in force today (Edit dialog: tabs and History). */
export async function getTelesalesProgram(id) {
  const p = await programRow(id);
  const t = await today();
  const versions = await versionRows(p.id);
  const callers = (await many(`${CALLER_SELECT} WHERE c.program_id = $1 ORDER BY u.display_name, c.date_from`, [p.id])).map((c) => callerOut(c, t));
  const current = inForce(versions, monthKey(t) + '-01') || inForce(versions, t);
  const open = versions.find((v) => ['Draft', 'Pending approval'].includes(v.status)) || null;
  return {
    id: p.id, programCode: p.program_code, programName: p.name, description: p.description, programType: p.program_type, applicableTo: p.applicable_to, targetMetric: p.target_metric,
    calculationFrequency: p.calculation_frequency, startDate: iso(p.period_from), endDate: iso(p.period_to), status: p.status, inactiveFrom: iso(p.inactive_from), currency: p.currency,
    current: current ? versionOut(current, versions, t) : null, open: open ? versionOut(open, versions, t) : null,
    versions: versions.map((v) => versionOut(v, versions, t)).reverse(), callers, firstOpenMonth: await firstOpenMonth(p.id),
    versionLabel: versionLabel(versions, t),
  };
}

/** "v1 in force; v2 Draft" for the program list. */
function versionLabel(versions, t) {
  const current = inForce(versions, t);
  const open = versions.find((v) => ['Draft', 'Pending approval'].includes(v.status));
  return [current ? `v${current.version} in force` : null, open ? `v${open.version} ${open.status}` : null].filter(Boolean).join('; ') || null;
}

/** Program list columns of the Telesales programs: minimum policies, version, effective from (Incentive Program Master). */
export async function decoratePrograms(list) {
  const t = await today();
  for (const p of list) {
    if (p.programType !== TELESALES) continue;
    const versions = await versionRows(p.id);
    const v = inForce(versions, t) || versions[versions.length - 1];
    Object.assign(p, { isTelesales: true, minPolicies: v ? v.min_policies : null, effectiveFrom: v ? iso(v.effective_from) : null, versionLabel: versionLabel(versions, t) });
  }
  return list;
}

/** Validate the values of a version; returns the clean values and the warnings (errors throw 400 with every message). */
async function versionValues(b, base = {}, { programId = null, db = pool } = {}) {
  const errors = [];
  const s = await settingsOf();
  const products = b.products !== undefined ? [...new Set((b.products || []).map(Number).filter(Boolean))] : base.products || [];
  if (!products.length) errors.push(err('products', '002', 'Select at least one Motor product'));
  else {
    const found = (await db.query('SELECT id, name, line FROM products WHERE id = ANY($1)', [products])).rows;
    const bad = products.filter((id) => !found.some((f) => f.id === id && s.lines.includes(String(f.line || '').toLowerCase())));
    if (bad.length) errors.push(err('products', '003', 'Telesales programs apply to Motor products only'));
  }
  const minPolicies = b.minPolicies !== undefined ? toNumber(b.minPolicies, NaN) : base.min_policies;
  if (!Number.isInteger(minPolicies) || minPolicies < 1 || minPolicies > 999) errors.push(err('minPolicies', '004', 'Minimum policies to qualify must be a whole number from 1 to 999'));
  const whtPct = b.whtPct !== undefined ? toNumber(b.whtPct, NaN) : Number(base.wht_pct);
  if (!Number.isFinite(whtPct) || whtPct < 0 || whtPct > 100 || round2(whtPct) !== whtPct) errors.push(err('whtPct', '005', 'Withholding tax % must be between 0.00 and 100.00'));
  const effectiveFrom = b.effectiveFrom !== undefined ? iso(b.effectiveFrom) : iso(base.effective_from);
  if (!isMonthStart(effectiveFrom)) errors.push(err('effectiveFrom', '006', 'Effective from must be the first day of a month'));
  else if (programId) {
    const open = await firstOpenMonth(programId, db);
    if (open && effectiveFrom < open) errors.push(err('effectiveFrom', '007', `Incentives for ${monthLabel(prevMonth(open))} are already calculated; choose ${monthLabel(open)} or later`));
  }
  const tiers = cleanTiers(b.tiers !== undefined ? b.tiers : base.tiers || []);
  const bands = cleanBands(b.bands !== undefined ? b.bands : base.bands || []);
  const tp = tierProblems(tiers);
  errors.push(...tp.errors, ...bandProblems(bands, Number.isInteger(minPolicies) ? minPolicies : null).errors);
  if (errors.length) fail(errors);
  return { values: { products, min_policies: minPolicies, wht_pct: whtPct, effective_from: effectiveFrom, tiers, bands }, warnings: tp.warnings };
}

async function assertSingleInForce(programId, month, db) {
  const o = await otherInForce(programId, month, db);
  if (o) fail([err('programType', '008', `Telesales program ${o.program_code} is already in force for ${monthLabel(month)}`)]);
}

/** Create a Telesales program with version 1 in Draft (FR-TSI-001). */
export async function createTelesalesProgram(b, user) {
  const name = String(b.programName || '').trim();
  if (!name) fail([err('programName', '001', 'Program name is required')]);
  const s = await settingsOf();
  const t = await today();
  const base = { products: (await eligibleProducts()).map((p) => p.id), min_policies: s.minPolicies, wht_pct: s.whtPct, effective_from: nextMonth(t), tiers: s.tiers, bands: s.bands };
  const { values, warnings } = await versionValues(b, base);
  await assertSingleInForce(null, values.effective_from, pool);
  const code = b.programCode ? String(b.programCode).trim() : await nextDocumentNumber('incentive_program');
  if (await one('SELECT 1 FROM incentive_programs WHERE lower(program_code) = lower($1)', [code])) throw conflict(`Program code ${code} already exists`);
  const id = await withTransaction(async (db) => {
    const p = (await db.query(`INSERT INTO incentive_programs(name, description, metric, target, period_from, period_to, status, program_code, program_type, applicable_to, target_metric,
        currency, calculation_frequency, structure, eligibility, created_by, updated_by)
      VALUES ($1,$2,'anc',$3,$4,$5,'Draft',$6,$7,$8,$9,$10,'Monthly','[]','{}',$11,$11) RETURNING id`,
    [name, b.description || null, values.min_policies, iso(b.startDate) || values.effective_from, iso(b.endDate) || null, code, TELESALES, JSON.stringify([APPLICABLE_TO]), ANC_METRIC,
      b.currency || b.Currency || (await baseCurrency()), user.id])).rows[0];
    await db.query(`INSERT INTO incentive_program_versions(program_id, version, effective_from, min_policies, wht_pct, products, tiers, bands, status, change_reason, created_by, updated_by)
      VALUES ($1,1,$2,$3,$4,$5,$6,$7,'Draft',$8,$9,$9)`, [p.id, values.effective_from, values.min_policies, values.wht_pct, values.products, JSON.stringify(values.tiers), JSON.stringify(values.bands),
      b.changeReason || null, user.id]);
    return p.id;
  });
  return { ...(await getTelesalesProgram(id)), warnings };
}

/**
 * Save the open version (Save draft): the Draft is updated; with no open version a new version is opened as a copy of
 * the latest approved one with the changes (R4: a version in force is never edited). A version pending approval
 * blocks it (MSG-TSI-026). Name, description and end date are kept on the program.
 */
export async function saveTelesalesDraft(id, b, user) {
  const p = await programRow(id);
  return withTransaction(async (db) => {
    const versions = await versionRows(p.id, db);
    const open = versions.find((v) => ['Draft', 'Pending approval'].includes(v.status));
    if (open?.status === 'Pending approval') throw conflict(`Version ${open.version} of ${p.program_code} is already in Draft or Pending approval`);
    const before = open ? versionOut(open, versions, await today()) : null;
    const latest = [...versions].reverse().find((v) => v.status === 'Approved');
    const base = open || latest || {};
    const { values, warnings } = await versionValues(b, base, { programId: p.id, db });
    if (b.programName !== undefined && !String(b.programName).trim()) fail([err('programName', '001', 'Program name is required')]);
    await db.query('UPDATE incentive_programs SET name = COALESCE($2, name), description = COALESCE($3, description), period_to = $4, updated_by = $5, updated_at = now() WHERE id = $1',
      [p.id, b.programName ? String(b.programName).trim() : null, b.description ?? null, b.endDate !== undefined ? iso(b.endDate) : p.period_to, user.id]);
    const reason = b.changeReason !== undefined ? (String(b.changeReason || '').trim() || null) : open?.change_reason ?? null;
    if (open) {
      await db.query(`UPDATE incentive_program_versions SET effective_from = $2, min_policies = $3, wht_pct = $4, products = $5, tiers = $6, bands = $7, change_reason = $8,
          updated_by = $9, updated_at = now() WHERE id = $1`, [open.id, values.effective_from, values.min_policies, values.wht_pct, values.products, JSON.stringify(values.tiers), JSON.stringify(values.bands), reason, user.id]);
    } else {
      await db.query(`INSERT INTO incentive_program_versions(program_id, version, effective_from, min_policies, wht_pct, products, tiers, bands, status, change_reason, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Draft',$9,$10,$10)`, [p.id, (versions[versions.length - 1]?.version || 0) + 1, values.effective_from, values.min_policies, values.wht_pct, values.products,
        JSON.stringify(values.tiers), JSON.stringify(values.bands), reason, user.id]);
    }
    return { before, after: await getTelesalesProgramIn(db, p.id), warnings };
  });
}

// the program read inside a transaction (the same shape as getTelesalesProgram, read after commit by the caller)
async function getTelesalesProgramIn(db, id) {
  const versions = await versionRows(id, db);
  const t = await today();
  const open = versions.find((v) => ['Draft', 'Pending approval'].includes(v.status));
  return { id, open: open ? versionOut(open, versions, t) : null, versionLabel: versionLabel(versions, t) };
}

/** The values of a version as the approver compares them (Configuration Approvals). */
const versionPayload = (p, v) => ({
  programCode: p.program_code, version: v.version, effectiveFrom: iso(v.effective_from), minPolicies: v.min_policies, whtPct: Number(v.wht_pct), products: v.product_names || [],
  tiers: tiersOut(cleanTiers(v.tiers)).map((t) => `Level ${t.level}: ANC ${money(t.ancFrom)} to ${t.ancTo === null ? 'and above' : money(t.ancTo)}, NB ${money(t.nbAmount)}, renewal ${money(t.renewalAmount)}`),
  bands: bandsOut(cleanBands(v.bands)).map((b) => `Band ${b.band}: in excess of ${b.over} up to ${b.upTo ?? 'no limit'}, every ${b.every}, ${money(b.amount)}`),
});

/** Submit the Draft for approval (FR-TSI-005): a change on Configuration Approvals decided with approve:incentive. */
export async function submitTelesalesVersion(id, b, user) {
  const p = await programRow(id);
  const out = await withTransaction(async (db) => {
    const versions = await versionRows(p.id, db);
    const v = versions.find((x) => x.status === 'Draft');
    if (!v) {
      const pending = versions.find((x) => x.status === 'Pending approval');
      throw conflict(pending ? `Version ${pending.version} of ${p.program_code} is already in Draft or Pending approval` : `${p.program_code} has no version in Draft`);
    }
    const reason = String(b.changeReason ?? v.change_reason ?? '').trim();
    if (v.version > 1 && !reason) fail([err('changeReason', '025', 'Change reason is required')]);
    await versionValues({}, v, { programId: p.id, db });
    await assertSingleInForce(p.id, iso(v.effective_from), db);
    const current = inForce(versions, iso(v.effective_from));
    const { requestChange } = await import('../posting-rules/service.js');
    const change = await requestChange(db, { kind: 'incentive-program', target: `incentive-program:${p.id}`,
      payload: { label: `Incentive program ${p.program_code} version ${v.version}`, programId: p.id, versionId: v.id, ...versionPayload(p, v), changeReason: reason || null },
      before: current ? versionPayload(p, current) : null, note: reason || null, user });
    await db.query(`UPDATE incentive_program_versions SET status = 'Pending approval', change_reason = $2, submitted_by = $3, submitted_at = now(), change_id = $4, return_remark = NULL
      WHERE id = $1`, [v.id, reason || null, user.id, change.id]);
    return { change, version: v.version };
  });
  await notifyApprovers({ audience: 'approve:incentive', document: 'Incentive program version', number: `${p.program_code} v${out.version}`, by: user.username,
    detail: `effective ${dmy(b.effectiveFrom) || ''}`.trim(), link: APPROVALS_LINK, entity: 'accounting_config_change', entityId: out.change.id });
  return { ...(await getTelesalesProgram(p.id)), change: out.change };
}

/** Recall a version pending approval (the maker takes it back): the change is withdrawn and the version is Draft again. */
export async function recallTelesalesVersion(id, user) {
  const p = await programRow(id);
  const v = await one('SELECT * FROM incentive_program_versions WHERE program_id = $1 AND status = \'Pending approval\'', [p.id]);
  if (!v) throw conflict(`${p.program_code} has no version pending approval`);
  const { withdrawChange } = await import('../posting-rules/service.js');
  await withTransaction((db) => withdrawChange(db, v.change_id, user));
  return getTelesalesProgram(p.id);
}

/**
 * The decision of Configuration Approvals on a version (posting-rules/service.js decideChange and withdrawChange):
 * approve (maker-checker against the creator, the last saver and the submitter; the effective month must still have no
 * batch and no other Telesales program in force), reject (Return: back to Draft with the remark) or withdraw (Recall).
 */
export async function applyVersionDecision(db, c, action, user, remarks = null) {
  const v = (await db.query('SELECT * FROM incentive_program_versions WHERE id = $1 FOR UPDATE', [Number(c.payload?.versionId) || 0])).rows[0];
  if (!v) throw notFound('Program version not found');
  if (v.status !== 'Pending approval') throw conflict(`Version ${v.version} is ${v.status}`);
  if (action === 'approve') {
    if ([v.created_by, v.updated_by, v.submitted_by].includes(user?.id)) throw forbidden('The approver must be different from the user who created this version');
    const open = await firstOpenMonth(v.program_id, db);
    if (open && iso(v.effective_from) < open) fail([err('effectiveFrom', '007', `Incentives for ${monthLabel(prevMonth(open))} are already calculated; choose ${monthLabel(open)} or later`)]);
    await assertSingleInForce(v.program_id, iso(v.effective_from), db);
    await db.query('UPDATE incentive_program_versions SET status = \'Approved\', approved_by = $2, approved_at = now() WHERE id = $1', [v.id, user?.id ?? null]);
    await db.query(`UPDATE incentive_programs SET status = CASE WHEN status = 'Draft' THEN 'Active' ELSE status END, target = $2,
        period_from = LEAST(COALESCE(period_from, $3), $3), updated_at = now() WHERE id = $1`, [v.program_id, v.min_policies, iso(v.effective_from)]);
  } else if (action === 'reject') {
    await db.query('UPDATE incentive_program_versions SET status = \'Draft\', return_remark = $2, returned_by = $3, returned_at = now() WHERE id = $1', [v.id, remarks || null, user?.id ?? null]);
  } else {
    await db.query('UPDATE incentive_program_versions SET status = \'Draft\' WHERE id = $1', [v.id]);
  }
}

/**
 * Deactivate (from the next month that has no batch; months already calculated are not touched) or activate again a
 * Telesales program (the Active toggle of the program list).
 */
export async function setTelesalesStatus(id, status, user) {
  const p = await programRow(id);
  const before = await getTelesalesProgram(p.id);
  if (status === 'Inactive') {
    const t = await today();
    const open = await firstOpenMonth(p.id);
    const from = maxIso(nextMonth(t), open);
    await query('UPDATE incentive_programs SET status = \'Inactive\', inactive_from = $2, updated_by = $3, updated_at = now() WHERE id = $1', [p.id, from, user.id]);
  } else if (status === 'Active') {
    if (!inForce(await versionRows(p.id), '9999-12-31')) throw conflict(`${p.program_code} has no approved version yet; submit version 1 for approval`);
    await query('UPDATE incentive_programs SET status = \'Active\', inactive_from = NULL, updated_by = $2, updated_at = now() WHERE id = $1', [p.id, user.id]);
  } else throw badRequest('Validation failed', [{ path: 'status', message: 'status must be Active or Inactive' }]);
  return { before, after: await getTelesalesProgram(p.id) };
}

// ---------------------------------------------------------------- callers

/** Users who may be callers (a role of incentive.eligible_roles) and Team Leaders (write:callout-endorsement), and the insurers. */
export async function callerOptions() {
  const roles = (await getSetting('incentive.eligible_roles', [])) || [];
  const callers = await many(`SELECT u.id, u.display_name AS name, COALESCE(u.employee_code, u.username) AS code FROM users u WHERE u.status = 'active'
    AND EXISTS (SELECT 1 FROM user_effective_roles(u.id) er WHERE er.code = ANY($1)) ORDER BY u.display_name`, [roles]);
  const leaders = await many(`SELECT u.id, u.display_name AS name, COALESCE(u.employee_code, u.username) AS code FROM users u WHERE u.status = 'active'
    AND EXISTS (SELECT 1 FROM user_effective_roles(u.id) er JOIN role_permissions rp ON rp.role_id = er.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'write:callout-endorsement') ORDER BY u.display_name`);
  const insurers = await many('SELECT id, code, name FROM insurance_companies WHERE status = \'active\' ORDER BY name');
  return { callers, teamLeaders: leaders, insurers };
}

async function callerRow(id, db = pool) {
  const c = (await db.query(`${CALLER_SELECT} WHERE c.id = $1`, [Number(id) || 0])).rows[0];
  if (!c) throw notFound('Caller not found');
  return c;
}

/** Add a caller to a program (FR-TSI-004): an eligible user, one active row at a time, a Team Leader who can endorse. */
export async function addCaller(programId, b, user) {
  const p = await programRow(programId);
  const t = await today();
  const errors = [];
  const u = await one('SELECT id, display_name FROM users WHERE id = $1 AND status = \'active\'', [b.userId || '']);
  if (!u) fail([{ path: 'userId', message: 'Choose an active user' }]);
  const roles = (await getSetting('incentive.eligible_roles', [])) || [];
  if (!(await one('SELECT 1 FROM user_effective_roles($1) er WHERE er.code = ANY($2)', [u.id, roles]))) {
    errors.push(err('userId', '020', `${u.display_name} does not have a role that takes part in incentives`));
  }
  const from = iso(b.dateFrom) || t;
  const to = b.dateTo ? iso(b.dateTo) : null;
  if (to && to < from) errors.push({ path: 'dateTo', message: 'To must be on or after From' });
  const active = await one(`SELECT c.date_from FROM incentive_callers c JOIN incentive_programs p ON p.id = c.program_id WHERE c.user_id = $1 AND p.status <> 'Deleted'
    AND c.date_from <= COALESCE($3::date, '9999-12-31') AND COALESCE(c.date_to, '9999-12-31') >= $2::date`, [u.id, from, to]);
  if (active) errors.push(err('userId', '021', `${u.display_name} is already an active caller from ${dmy(iso(active.date_from))}`));
  if (!b.insuranceCompanyId || !(await one('SELECT 1 FROM insurance_companies WHERE id = $1', [Number(b.insuranceCompanyId) || 0]))) errors.push({ path: 'insuranceCompanyId', message: 'Choose the insurance partner' });
  const leader = b.teamLeaderId ? await one('SELECT id, display_name FROM users WHERE id = $1 AND status = \'active\'', [b.teamLeaderId]) : null;
  if (!leader) errors.push({ path: 'teamLeaderId', message: 'Choose the Team Leader' });
  else if (!(await userHas(leader.id, 'write:callout-endorsement'))) errors.push(err('teamLeaderId', '022', `${leader.display_name} cannot endorse call-out leads`));
  if (errors.length) fail(errors);
  const r = await one(`INSERT INTO incentive_callers(program_id, user_id, insurance_company_id, team_leader_id, date_from, date_to, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id`, [p.id, u.id, Number(b.insuranceCompanyId), leader.id, from, to, user.id]);
  return callerOut(await callerRow(r.id), t);
}

/** Change a caller row: the To date (end of participation) or the Team Leader (past endorsements stay valid). */
export async function updateCaller(id, b, user) {
  const c = await callerRow(id);
  const t = await today();
  const to = b.dateTo !== undefined ? (b.dateTo ? iso(b.dateTo) : null) : iso(c.date_to);
  if (to && to < iso(c.date_from)) fail([{ path: 'dateTo', message: 'To must be on or after From' }]);
  let leaderId = c.team_leader_id;
  if (b.teamLeaderId && b.teamLeaderId !== c.team_leader_id) {
    const leader = await one('SELECT id, display_name FROM users WHERE id = $1 AND status = \'active\'', [b.teamLeaderId]);
    if (!leader) fail([{ path: 'teamLeaderId', message: 'Choose the Team Leader' }]);
    if (!(await userHas(leader.id, 'write:callout-endorsement'))) fail([err('teamLeaderId', '022', `${leader.display_name} cannot endorse call-out leads`)]);
    leaderId = leader.id;
  }
  await query('UPDATE incentive_callers SET date_to = $2, team_leader_id = $3, updated_by = $4, updated_at = now() WHERE id = $1', [c.id, to, leaderId, user.id]);
  return { before: callerOut(c, t), after: callerOut(await callerRow(c.id), t) };
}

/** Disqualify a caller from a date (approve:incentive; a reason of context incentive_disqualify and a remark). */
export async function disqualifyCaller(id, b, user) {
  const c = await callerRow(id);
  const t = await today();
  if (!b.reasonCode || !String(b.note ?? b.remark ?? '').trim()) fail([err('reason', '023', 'A reason and a remark are required to disqualify a caller')]);
  const reason = await requiredReason(pool, 'incentive_disqualify', { reasonCode: b.reasonCode, note: b.note ?? b.remark });
  const from = iso(b.date) || t;
  await query(`UPDATE incentive_callers SET disqualified_from = $2, disqualify_reason_code = $3, disqualify_reason = $4, disqualified_by = $5, disqualified_at = now(),
      reinstated_on = NULL, reinstate_remark = NULL, reinstated_by = NULL, reinstated_at = NULL, updated_by = $5, updated_at = now() WHERE id = $1`, [c.id, from, reason.code, reason.text, user.id]);
  return { before: callerOut(c, t), after: callerOut(await callerRow(c.id), t), message: `${c.user_name} is disqualified from ${dmy(from)}` };
}

/** Reinstate a disqualified caller (approve:incentive; never the user who disqualified the row; a remark). */
export async function reinstateCaller(id, b, user) {
  const c = await callerRow(id);
  const t = await today();
  if (!c.disqualified_from || c.reinstated_on) throw conflict(`${c.user_name} is not disqualified`);
  if (c.disqualified_by === user.id) throw forbidden('The user who disqualified a caller cannot reinstate the same caller');
  const remark = String(b.note ?? b.remark ?? '').trim();
  if (!remark) fail([{ path: 'remark', message: 'A remark is required to reinstate a caller' }]);
  const on = iso(b.date) || t;
  await query('UPDATE incentive_callers SET reinstated_on = $2, reinstate_remark = $3, reinstated_by = $4, reinstated_at = now(), updated_by = $4, updated_at = now() WHERE id = $1',
    [c.id, on, remark, user.id]);
  return { before: callerOut(c, t), after: callerOut(await callerRow(c.id), t) };
}

/** The caller rows active on a date (any Telesales program not deleted), by user. */
export async function activeCallerRows(date, db = pool) {
  return (await db.query(`SELECT c.*, p.program_code FROM incentive_callers c JOIN incentive_programs p ON p.id = c.program_id
    WHERE p.program_type = $1 AND p.status <> 'Deleted' AND c.date_from <= $2::date AND COALESCE(c.date_to, '9999-12-31') >= $2::date`, [TELESALES, date])).rows;
}

// ---------------------------------------------------------------- telesales policies

/** Date of the commission settlement of policies: approved remittance (commission kept) or settled direct-bill statement. */
async function settlementDates(ids, tz) {
  if (!ids.length) return new Map();
  const rows = await many(`SELECT policy_id, min(d) AS d FROM (
      SELECT l.policy_id, (COALESCE(r.approved_at, r.settled_at) AT TIME ZONE $2)::date AS d FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id
       WHERE l.policy_id = ANY($1) AND COALESCE(r.approved_at, r.settled_at) IS NOT NULL AND r.status NOT IN ('draft', 'for-approval', 'rejected', 'cancelled', 'withdrawn')
      UNION ALL
      SELECT dl.policy_id, (n.settled_at AT TIME ZONE $2)::date FROM commission_debit_note_lines dl JOIN commission_debit_notes n ON n.id = dl.debit_note_id
       WHERE dl.policy_id = ANY($1) AND n.settled_at IS NOT NULL) x GROUP BY policy_id`, [ids, tz]);
  return new Map(rows.map((r) => [r.policy_id, iso(r.d)]));
}

/** Net commission of policies (FR-TSI-022 R1): commission kept less the referrer / agent shares, before VAT. */
async function netCommissions(ids) {
  if (!ids.length) return new Map();
  const rows = await many(`SELECT p.id, COALESCE(p.commission_amount, 0) - COALESCE((SELECT sum(c.amount) FROM commissions c WHERE c.policy_id = p.id AND c.status <> 'Reversed'
      AND NOT COALESCE(c.clawback, false) AND c.endorsement_id IS NULL), 0) AS net FROM policies p WHERE p.id = ANY($1)`, [ids]);
  return new Map(rows.map((r) => [r.id, round2(r.net)]));
}

/**
 * Attribute a policy to a caller (FR-TSI-011): the prospect owner on the quotation date is a caller with a caller row
 * active on that date, the prospect carried a call-out endorsement for that caller dated on or before the quotation
 * and within its validity, and (incentive.telesales.same_insurer_only) the policy is placed with the caller's insurance
 * partner. Returns { link } or { reason }.
 */
export async function attribute(p, { validityDays, sameInsurer, tz }, db = pool) {
  if (!p.lead_id) return { reason: 'No prospect' };
  const quotedAt = p.quoted_at;
  const owner = (await db.query(`SELECT COALESCE(
      (SELECT h.to_user_id FROM lead_assignment_history h WHERE h.lead_id = $1 AND h.assigned_at <= $2 AND h.action IN ('auto', 'manual', 'bulk', 'taken', 'queued', 'queue')
        ORDER BY h.assigned_at DESC, h.id DESC LIMIT 1),
      (SELECT h.from_user_id FROM lead_assignment_history h WHERE h.lead_id = $1 AND h.assigned_at > $2 AND h.action IN ('auto', 'manual', 'bulk', 'taken', 'queued', 'queue')
        ORDER BY h.assigned_at, h.id LIMIT 1),
      (SELECT owner_user_id FROM leads WHERE id = $1)) AS owner`, [p.lead_id, quotedAt])).rows[0]?.owner;
  if (!owner) return { reason: 'Prospect without an owner on the quotation date' };
  const quotedOn = (await db.query('SELECT ($1::timestamptz AT TIME ZONE $2)::date AS d', [quotedAt, tz])).rows[0].d;
  const row = (await db.query(`SELECT c.* FROM incentive_callers c JOIN incentive_programs pr ON pr.id = c.program_id WHERE pr.program_type = $1 AND pr.status <> 'Deleted'
    AND c.user_id = $2 AND c.date_from <= $3::date AND COALESCE(c.date_to, '9999-12-31') >= $3::date ORDER BY c.date_from DESC LIMIT 1`, [TELESALES, owner, quotedOn])).rows[0];
  if (!row) return { reason: 'The prospect owner is not a caller on the quotation date' };
  const e = (await db.query(`SELECT * FROM callout_endorsements WHERE lead_id = $1 AND caller_user_id = $2 AND endorsed_at <= $3::timestamptz
    AND ($4::int <= 0 OR $3::timestamptz < endorsed_at + make_interval(days => $4)) AND (ended_at IS NULL OR ended_at > $3::timestamptz)
    ORDER BY endorsed_at DESC LIMIT 1`, [p.lead_id, owner, quotedAt, validityDays])).rows[0];
  if (!e) {
    const later = (await db.query('SELECT 1 FROM callout_endorsements WHERE lead_id = $1 AND caller_user_id = $2 AND endorsed_at > $3::timestamptz LIMIT 1', [p.lead_id, owner, quotedAt])).rows[0];
    return { reason: later ? 'Endorsed after the quotation' : 'Not endorsed as a call-out lead (or the endorsement had expired)' };
  }
  if (sameInsurer && row.insurance_company_id && Number(p.insurance_company_id) !== Number(row.insurance_company_id)) return { reason: 'Placed with another insurer than the caller\'s insurance partner' };
  const endorsedOn = (await db.query('SELECT ($1::timestamptz AT TIME ZONE $2)::date AS d', [e.endorsed_at, tz])).rows[0].d;
  return { link: { programId: row.program_id, callerUserId: owner, callerRowId: row.id, endorsementId: e.id, quotedOn: iso(quotedOn), endorsedOn: iso(endorsedOn) } };
}

/** The Motor policies with a prospect to attribute, with the quotation date (quotation created, else policy created). */
const CANDIDATE_SELECT = `SELECT p.id, p.policy_number, p.product_id, p.insurance_company_id, p.renewed_from, p.status, p.owner_user_id, COALESCE(q.lead_id, p.lead_id) AS lead_id,
  q.id AS quote_id, COALESCE(q.created_at, p.created_at) AS quoted_at
  FROM policies p JOIN products pr ON pr.id = p.product_id LEFT JOIN quotes q ON q.id = p.quote_id`;

/**
 * Bring the telesales policies up to date (the job, every calculation and My Programs): link new Motor policies of
 * endorsed prospects to their caller; for the policies not yet counted, the full payment and commission settlement
 * dates and, once both are reached, the eligible date and the net commission (stored once, FR-TSI-022 R3); the date of
 * a cancellation or refund. A policy whose eligible month is already calculated goes to the month of the sync.
 */
export async function syncTelesalesPolicies({ asOf = null } = {}) {
  const t = asOf || (await today());
  const tz = await businessTimeZone();
  const s = await settingsOf();
  const candidates = await many(`${CANDIDATE_SELECT} WHERE lower(pr.line) = ANY($1) AND NOT EXISTS (SELECT 1 FROM telesales_policies tp WHERE tp.policy_id = p.id)
    AND EXISTS (SELECT 1 FROM callout_endorsements e WHERE e.lead_id = COALESCE(q.lead_id, p.lead_id))`, [s.lines]);
  let linked = 0;
  for (const p of candidates) {
    const a = await attribute(p, { validityDays: s.validityDays, sameInsurer: s.sameInsurer, tz });
    if (!a.link) continue;
    await query(`INSERT INTO telesales_policies(policy_id, program_id, caller_user_id, caller_row_id, endorsement_id, quote_id, quoted_on, endorsed_on, kind)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (policy_id) DO NOTHING`, [p.id, a.link.programId, a.link.callerUserId, a.link.callerRowId, a.link.endorsementId, p.quote_id,
      a.link.quotedOn, a.link.endorsedOn, p.renewed_from ? 'Renewal' : 'NB']);
    linked += 1;
  }
  const open = await many(`SELECT tp.*, p.status AS policy_status, p.payment_status, (p.paid_at AT TIME ZONE $1)::date AS paid_on, p.issued_date, p.renewed_from,
      (COALESCE(p.status_changed_at, p.lapsed_at, p.updated_at) AT TIME ZONE $1)::date AS changed_on,
      (SELECT k.status FROM incentive_calculations k WHERE k.batch_id = tp.counted_batch_id) AS counted_status
    FROM telesales_policies tp JOIN policies p ON p.id = tp.policy_id
    WHERE tp.cancelled_on IS NULL OR tp.eligible_on IS NULL`, [tz]);
  const ids = open.map((r) => r.policy_id);
  const { paymentPositions } = await import('../remittance/eligibility.js');
  const positions = await paymentPositions(ids);
  const settled = await settlementDates(ids, tz);
  const nets = await netCommissions(ids);
  let eligible = 0;
  for (const r of open) {
    const free = !r.counted_batch_id || r.counted_status === 'Rejected';
    const cancelled = CANCELLED.includes(String(r.policy_status || '').toLowerCase()) || String(r.payment_status || '').toLowerCase() === 'refunded';
    const cancelledOn = iso(r.cancelled_on) || (cancelled ? iso(r.changed_on) || t : null);
    let fullyPaid = iso(r.fully_paid_on);
    let settledOn = iso(r.commission_settled_on);
    let eligibleOn = iso(r.eligible_on);
    let net = r.net_commission === null ? null : Number(r.net_commission);
    if (free && !eligibleOn) {
      fullyPaid = String(r.payment_status || '').toLowerCase() === 'completed' ? positions.get(r.policy_id)?.fullyPaidOn || iso(r.paid_on) || iso(r.issued_date) : null;
      settledOn = settled.get(r.policy_id) || null;
      const candidate = fullyPaid && settledOn ? maxIso(fullyPaid, settledOn) : null;
      if (candidate && !(cancelledOn && cancelledOn <= candidate)) {
        // the production month is closed (a batch that is not rejected): the policy counts in the month of this sync
        const closed = await one(`SELECT 1 FROM incentive_calculations k WHERE k.program_kind = 'telesales' AND k.status <> 'Rejected' AND k.period_from = $1::date
          AND EXISTS (SELECT 1 FROM incentive_results x WHERE x.calculation_id = k.batch_id AND x.program_id = $2)`, [`${monthKey(candidate)}-01`, r.program_id]);
        eligibleOn = closed && candidate < t ? t : candidate;
        net = nets.get(r.policy_id) ?? 0;
        eligible += 1;
      }
    }
    const kind = r.renewed_from ? 'Renewal' : 'NB';
    await query(`UPDATE telesales_policies SET fully_paid_on = $2, commission_settled_on = $3, eligible_on = $4, net_commission = $5, cancelled_on = $6, kind = CASE WHEN eligible_on IS NULL THEN $7 ELSE kind END,
        updated_at = now() WHERE policy_id = $1`, [r.policy_id, fullyPaid, settledOn, eligibleOn, net, cancelledOn, kind]);
  }
  return { linked, checked: open.length, eligible };
}

/** The telesales link of a policy (Operations > Policy, Related Records): "Telesales: <caller>, call-out endorsed <date>". */
export async function policyLink(policyId) {
  const r = await one(`SELECT tp.*, u.display_name AS caller, p.policy_number, pr.program_code FROM telesales_policies tp JOIN policies p ON p.id = tp.policy_id
    JOIN users u ON u.id = tp.caller_user_id JOIN incentive_programs pr ON pr.id = tp.program_id WHERE tp.policy_id = $1 OR p.policy_number = $1`, [String(policyId)]);
  if (!r) return { telesales: false };
  return { telesales: true, policyId: r.policy_id, policyNumber: r.policy_number, programCode: r.program_code, caller: r.caller, callerId: r.caller_user_id, kind: r.kind,
    quotedOn: iso(r.quoted_on), endorsedOn: iso(r.endorsed_on), fullyPaidOn: iso(r.fully_paid_on), commissionSettledOn: iso(r.commission_settled_on), eligibleOn: iso(r.eligible_on),
    netCommission: r.net_commission === null ? null : Number(r.net_commission), countedBatchId: r.counted_batch_id, countedPeriod: r.counted_period,
    label: `Telesales: ${r.caller}, call-out endorsed ${dmy(iso(r.endorsed_on))}` };
}

// ---------------------------------------------------------------- monthly calculation

/** The Telesales program of a batch (null for another batch). */
export async function telesalesProgramOfBatch(batchId, db = pool) {
  return (await db.query(`SELECT p.* FROM incentive_calculations c JOIN incentive_programs p ON p.program_code = c.programs_included->>0
    WHERE c.batch_id = $1 AND c.program_kind = 'telesales'`, [batchId])).rows[0] || null;
}

/** The batch of a Telesales program for a month that is not rejected, if any. */
async function liveBatch(programId, from, db = pool) {
  return (await db.query(`SELECT * FROM incentive_calculations c WHERE c.program_kind = 'telesales' AND c.period_from = $1::date AND c.status <> 'Rejected'
    AND c.programs_included->>0 = (SELECT program_code FROM incentive_programs WHERE id = $2) ORDER BY c.created_at DESC LIMIT 1`, [from, programId])).rows[0] || null;
}

/** The checks before a calculation of a month (MSG-TSI-032 to 034). Returns the version in force. */
async function checkMonth(p, period, { asOf, batchId = null }) {
  const t = asOf || (await today());
  if (period.to >= t) fail([err('period', '032', `The month of ${monthLabel(period.from)} has not ended yet`)]);
  const live = await liveBatch(p.id, period.from);
  if (live && live.batch_id !== batchId) throw conflict(`${p.program_code} is already calculated for ${monthLabel(period.from)} (batch ${live.status})`);
  if (p.inactive_from && iso(p.inactive_from) <= period.from) fail([err('selectedPrograms', '034', `${p.program_code} is inactive from ${monthLabel(iso(p.inactive_from))}`)]);
  const v = inForce(await versionRows(p.id), period.from);
  if (!v) fail([err('selectedPrograms', '034', `${p.program_code} has no approved version for ${monthLabel(period.from)}`)]);
  return v;
}

/**
 * Calculate (or recalculate) the batch of a Telesales program for a month. The callers active in the month get one
 * line each, even without a policy; every telesales policy considered is listed with its status. Exclusions and
 * adjustments made before a recalculation are kept. trigger: user | job | recalculate.
 */
export async function calculateTelesales(programRef, periodIn, { user = null, batchId = null, asOf = null, trigger = 'user', description = null } = {}) {
  const p = await programRow(programRef);
  const period = { from: `${monthKey(periodIn.from)}-01`, to: monthEnd(periodIn.from) };
  const t = asOf || (await today());
  const v = await checkMonth(p, period, { asOf: t, batchId });
  const log = [{ at: new Date().toISOString(), step: trigger === 'job' ? 'Job Telesales incentive calculation started' : trigger === 'recalculate' ? 'Recalculation started' : 'Calculation started',
    detail: `${p.program_code}, ${monthLabel(period.from)}` }];
  const sync = await syncTelesalesPolicies({ asOf: t });
  log.push({ at: new Date().toISOString(), step: 'Policies brought up to date', detail: `${sync.linked} linked, ${sync.eligible} became eligible` });
  const s = await settingsOf();
  const tiers = cleanTiers(v.tiers);
  const bands = cleanBands(v.bands);
  const whtPct = Number(v.wht_pct);
  log.push({ at: new Date().toISOString(), step: `Version ${v.version} in force`, detail: `minimum ${v.min_policies}, withholding tax ${whtPct.toFixed(2)}%, ${tiers.length} levels, ${bands.length} bands, ${s.method}` });
  const id = batchId || (await nextDocumentNumber('incentive_calc'));
  const prev = batchId ? await one('SELECT * FROM incentive_calculations WHERE batch_id = $1', [batchId]) : null;
  const callerRows = await many(`${CALLER_SELECT} WHERE c.program_id = $1 AND c.date_from <= $3::date AND COALESCE(c.date_to, '9999-12-31') >= $2::date ORDER BY u.display_name`,
    [p.id, period.from, period.to]);
  const callers = new Map();
  for (const c of callerRows) {
    const known = callers.get(c.user_id);
    callers.set(c.user_id, { userId: c.user_id, name: c.user_name, disqualified: (known?.disqualified || false) || disqualifiedIn(c, period.from, period.to) });
  }
  const pols = await many(`SELECT tp.*, p.policy_number, p.status AS policy_status, p.product_id, COALESCE(p.issued_date, (p.created_at AT TIME ZONE 'UTC')::date) AS issued_on,
      k.status AS counted_status, rk.status AS recovery_status
    FROM telesales_policies tp JOIN policies p ON p.id = tp.policy_id LEFT JOIN incentive_calculations k ON k.batch_id = tp.counted_batch_id
      LEFT JOIN incentive_calculations rk ON rk.batch_id = tp.recovery_batch_id
    WHERE tp.program_id = $1 AND (tp.eligible_on BETWEEN $2 AND $3 OR tp.counted_batch_id = $4 OR tp.recovery_batch_id = $4 OR tp.excluded_batch_id = $4
      OR (tp.eligible_on IS NULL AND COALESCE(p.issued_date, (p.created_at AT TIME ZONE 'UTC')::date) <= $3)
      OR (tp.cancelled_on BETWEEN $2 AND $3)
      OR (k.status IN ('Approved', 'Paid') AND tp.paid_amount > 0 AND tp.cancelled_on IS NOT NULL AND tp.cancelled_on <= $5))
    ORDER BY p.policy_number`, [p.id, period.from, period.to, id, t]);
  const rows = [];
  for (const x of pols) {
    const mine = x.counted_batch_id === id;
    const countedElsewhere = x.counted_batch_id && !mine && x.counted_status && x.counted_status !== 'Rejected';
    const caller = callers.get(x.caller_user_id);
    const base = { policyId: x.policy_id, policyNumber: x.policy_number, callerId: x.caller_user_id, kind: x.kind, fullyPaidOn: iso(x.fully_paid_on), settledOn: iso(x.commission_settled_on),
      eligibleOn: iso(x.eligible_on), net: x.net_commission === null ? null : Number(x.net_commission), amount: 0, detail: null };
    if (countedElsewhere) {
      const recoverable = ['Approved', 'Paid'].includes(x.counted_status) && Number(x.paid_amount) > 0 && x.cancelled_on && iso(x.cancelled_on) <= t
        && (!x.recovery_batch_id || x.recovery_batch_id === id || x.recovery_status === 'Rejected');
      if (recoverable) rows.push({ ...base, status: 'Recovery', amount: -round2(x.paid_amount), level: x.paid_level, detail: `Counted in ${x.counted_batch_id} (${monthLabel(`${x.counted_period}-01`)}), cancelled ${dmy(iso(x.cancelled_on))}` });
      continue;
    }
    const inMonth = x.eligible_on && iso(x.eligible_on) >= period.from && iso(x.eligible_on) <= period.to;
    if (x.excluded_at) {
      if (inMonth || x.excluded_batch_id === id) rows.push({ ...base, status: 'Excluded', detail: x.excluded_reason });
      continue;
    }
    if (x.cancelled_on) {
      if (inMonth || (iso(x.cancelled_on) >= period.from && iso(x.cancelled_on) <= period.to)) rows.push({ ...base, status: 'Cancelled', detail: `Cancelled or refunded ${dmy(iso(x.cancelled_on))}` });
      continue;
    }
    if (!x.eligible_on) {
      if (!caller) continue;
      rows.push({ ...base, status: x.fully_paid_on ? 'Waiting for commission' : 'Not fully paid' });
      continue;
    }
    if (!inMonth) continue;
    if (!COUNTABLE.includes(String(x.policy_status || '').toLowerCase())) { rows.push({ ...base, status: 'Not eligible', detail: `Policy status ${x.policy_status}` }); continue; }
    if (!(v.products || []).includes(Number(x.product_id))) { rows.push({ ...base, status: 'Not eligible', detail: 'Product not in the program' }); continue; }
    if (!caller) { rows.push({ ...base, status: 'Not eligible', detail: 'Caller not active in the month' }); continue; }
    rows.push({ ...base, status: caller.disqualified ? 'Disqualified' : 'Counted' });
  }
  // policies of the callers' prospects that are not telesales policies (never endorsed, endorsed late, other insurer)
  const lines = s.lines;
  const others = callers.size ? await many(`${CANDIDATE_SELECT} WHERE lower(pr.line) = ANY($1) AND p.owner_user_id = ANY($2)
      AND COALESCE(p.issued_date, (p.created_at AT TIME ZONE 'UTC')::date) BETWEEN $3 AND $4 AND NOT EXISTS (SELECT 1 FROM telesales_policies tp WHERE tp.policy_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM incentive_batch_policies b JOIN incentive_calculations k ON k.batch_id = b.calculation_id WHERE b.policy_id = p.id AND k.batch_id <> $5 AND k.status <> 'Rejected')`,
  [lines, [...callers.keys()], period.from, period.to, id]) : [];
  const tz = await businessTimeZone();
  for (const o of others) {
    const a = await attribute(o, { validityDays: s.validityDays, sameInsurer: s.sameInsurer, tz });
    rows.push({ policyId: o.id, policyNumber: o.policy_number, callerId: o.owner_user_id, kind: o.renewed_from ? 'Renewal' : 'NB', fullyPaidOn: null, settledOn: null, eligibleOn: null, net: null,
      amount: 0, status: 'Not a call-out lead', detail: a.reason || 'Not linked to the caller' });
  }
  log.push({ at: new Date().toISOString(), step: `${rows.length} policies read`, detail: `${rows.filter((r) => r.status === 'Counted').length} counted` });

  // carried recoveries of the previous batch of the program (negative gross of a caller)
  const carriedIn = new Map((await many(`SELECT r.id, r.agent_user_id, r.carried_forward, r.calculation_id FROM incentive_results r JOIN incentive_calculations k ON k.batch_id = r.calculation_id
      WHERE r.program_id = $1 AND k.status IN ('Approved', 'Paid') AND r.carried_forward > 0 AND k.period_from < $2::date AND (r.carry_taken_by IS NULL OR r.carry_taken_by = $3
        OR (SELECT status FROM incentive_calculations x WHERE x.batch_id = r.carry_taken_by) = 'Rejected')`, [p.id, period.from, id]))
    .map((r) => [r.agent_user_id, r]));
  const kept = new Map((await many('SELECT agent_user_id, adjustments, adjustment_reason, adjustment_reason_code FROM incentive_results WHERE calculation_id = $1 AND adjustments <> 0', [id]))
    .map((r) => [r.agent_user_id, r]));
  const users = new Set([...callers.keys(), ...rows.filter((r) => r.status === 'Recovery').map((r) => r.callerId), ...[...carriedIn.keys()].filter((u) => callers.has(u))]);
  const names = new Map((await many('SELECT id, display_name FROM users WHERE id = ANY($1)', [[...users]])).map((u) => [u.id, u.display_name]));
  const out = [];
  for (const userId of users) {
    const caller = callers.get(userId);
    const mine = rows.filter((r) => r.callerId === userId);
    const counted = mine.filter((r) => r.status === 'Counted');
    const n = counted.length;
    const nb = counted.filter((r) => r.kind !== 'Renewal').length;
    const anc = ancOf(counted.reduce((sum, r) => sum + Number(r.net || 0), 0), n);
    const carry = caller ? carriedIn.get(userId) : null;
    const recovery = round2(mine.filter((r) => r.status === 'Recovery').reduce((sum, r) => sum + r.amount, 0) - Number(carry?.carried_forward || 0));
    let result;
    let level = null;
    let baseAmt = 0;
    let additional = 0;
    if (!caller) result = 'Recovery outstanding';
    else if (caller.disqualified) result = 'Disqualified';
    else if (n < v.min_policies) result = `Not qualified (${n} < ${v.min_policies})`;
    else {
      level = levelOf(tiers, anc);
      additional = excessIncentive(bands, n, s.method);
      if (!level) result = 'Below level 1';
      else {
        result = 'Qualified';
        const tier = tiers[level - 1];
        for (const r of counted) r.amount = r.kind === 'Renewal' ? tier.renewalAmount : tier.nbAmount;
        baseAmt = round2(counted.reduce((sum, r) => sum + r.amount, 0));
      }
    }
    for (const r of counted) r.level = level;
    const adj = kept.get(userId);
    const totals = caller ? lineTotals({ base: baseAmt, additional, recovery, adjustments: Number(adj?.adjustments || 0), whtPct }) : { gross: recovery, tax: 0, total: 0, carried: 0 };
    out.push({ userId, name: names.get(userId), n, nb, renewals: n - nb, anc, level, base: baseAmt, additional, recovery, adj, result, carry, ...totals });
  }
  out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const gross = round2(out.reduce((sum, l) => sum + l.tax + l.total, 0));
  const tax = round2(out.reduce((sum, l) => sum + l.tax, 0));
  const total = round2(out.reduce((sum, l) => sum + l.total, 0));
  if (!out.length) fail([{ path: 'selectedPrograms', message: `${p.program_code} has no caller in ${monthLabel(period.from)}; there is nothing to calculate` }]);
  log.push({ at: new Date().toISOString(), step: `${out.length} lines written`, detail: `gross ${money(gross)}, tax ${money(tax)}, total ${money(total)}` });
  log.push({ at: new Date().toISOString(), step: 'Calculation complete', detail: null });
  const label = monthLabel(period.from);
  const key = monthKey(period.from);
  await withTransaction(async (db) => {
    if (prev) {
      await db.query('DELETE FROM incentive_results WHERE calculation_id = $1', [id]);
      await db.query('DELETE FROM incentive_batch_policies WHERE calculation_id = $1', [id]);
      await db.query('UPDATE telesales_policies SET counted_batch_id = NULL, counted_period = NULL, paid_level = NULL, paid_amount = NULL WHERE counted_batch_id = $1', [id]);
      await db.query('UPDATE telesales_policies SET recovery_batch_id = NULL, recovery_amount = NULL WHERE recovery_batch_id = $1', [id]);
      await db.query('UPDATE incentive_results SET carry_taken_by = NULL WHERE carry_taken_by = $1', [id]);
      await db.query(`UPDATE incentive_calculations SET total_amount = $2, agent_count = $3, status = 'Calculated', gross_total = $4, tax_total = $5, version_id = $6,
          execution_log = execution_log || $7::jsonb, updated_at = now() WHERE batch_id = $1`, [id, total, out.length, gross, tax, v.id, JSON.stringify(log)]);
    } else {
      // a new calculation of a month whose batch was rejected replaces the lines of that batch (one line per caller and month)
      await db.query(`DELETE FROM incentive_results r USING incentive_calculations k WHERE k.batch_id = r.calculation_id AND k.status = 'Rejected' AND r.program_id = $1 AND r.period = $2`, [p.id, key]);
      await db.query(`INSERT INTO incentive_calculations(batch_id, period, period_from, period_to, programs_included, description, total_amount, agent_count, status, created_by,
          program_kind, version_id, gross_total, tax_total, execution_log, triggered_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Calculated',$9,'telesales',$10,$11,$12,$13,$14)`,
      [id, label, period.from, period.to, JSON.stringify([p.program_code]), description, total, out.length, user?.id ?? null, v.id, gross, tax, JSON.stringify(log), trigger === 'job' ? 'job' : 'user']);
    }
    for (const l of out) {
      await db.query(`INSERT INTO incentive_results(program_id, agent_user_id, achieved, payout, status, period, calculation_id, target, achievement_percent, base_incentive, adjustments,
          adjustment_reason, adjustment_reason_code, tier, nb_count, renewal_count, anc, level, base_amount, additional_amount, recovery_amount, gross_amount, tax_amount, wht_pct, result, carried_forward)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [p.id, l.userId, l.n, l.total, l.adj ? 'Adjusted' : 'Calculated', key, id, v.min_policies, round2(l.base + l.additional + l.recovery), Number(l.adj?.adjustments || 0),
        l.adj?.adjustment_reason || null, l.adj?.adjustment_reason_code || null, l.level ? `Level ${l.level}` : null, l.nb, l.renewals, l.anc, l.level, l.base, l.additional, l.recovery,
        l.gross, l.tax, whtPct, l.result, l.carried]);
      if (l.carry) await db.query('UPDATE incentive_results SET carry_taken_by = $2 WHERE id = $1', [l.carry.id, id]);
    }
    for (const r of rows) {
      await db.query(`INSERT INTO incentive_batch_policies(calculation_id, program_id, policy_id, caller_user_id, kind, fully_paid_on, commission_settled_on, eligible_on, net_commission,
          status, detail, amount, level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (calculation_id, policy_id) DO NOTHING`,
      [id, p.id, r.policyId, r.callerId, r.kind, r.fullyPaidOn, r.settledOn, r.eligibleOn, r.net, r.status, r.detail, r.amount, r.level ?? null]);
      if (r.status === 'Counted' || r.status === 'Disqualified') {
        await db.query('UPDATE telesales_policies SET counted_batch_id = $2, counted_period = $3, paid_level = $4, paid_amount = $5 WHERE policy_id = $1', [r.policyId, id, key, r.level ?? null, r.amount]);
      } else if (r.status === 'Recovery') {
        await db.query('UPDATE telesales_policies SET recovery_batch_id = $2, recovery_amount = $3 WHERE policy_id = $1', [r.policyId, id, r.amount]);
      } else if (r.status === 'Excluded') {
        await db.query('UPDATE telesales_policies SET excluded_batch_id = COALESCE(excluded_batch_id, $2) WHERE policy_id = $1', [r.policyId, id]);
      }
    }
  });
  if (trigger === 'job') {
    await notify({ type: 'info', title: `Telesales incentives ${label} calculated`, message: `Batch ${id} of ${p.program_code}: ${out.length} callers, total ${money(total)}. Review it and submit it for approval.`,
      link: '/incentive/calculations', entity: 'incentive_calculation', entityId: id, audience: 'write:incentive' }).catch(() => null);
  }
  return { batchId: id, lines: out.length, policies: rows.length, total, recalculated: !!prev };
}

/** Recalculate a Calculated or Rejected telesales batch (exclusions and adjustments kept). */
export async function recalculateTelesales(batchId, user) {
  const c = await one('SELECT * FROM incentive_calculations WHERE batch_id = $1', [batchId]);
  if (!c) throw notFound('Calculation batch not found');
  const p = await telesalesProgramOfBatch(c.batch_id);
  if (!p) throw badRequest(`Batch ${c.batch_id} is not a telesales batch`);
  if (!['Calculated', 'Rejected'].includes(c.status)) throw conflict(`Batch ${c.batch_id} is ${c.status}; only a calculated or rejected batch can be recalculated`);
  return calculateTelesales(p.id, { from: iso(c.period_from) }, { user, batchId: c.batch_id, trigger: 'recalculate' });
}

/** Exclude a counted policy of a batch with a reason and a remark (FR-TSI-035); the caller's line is recalculated. */
export async function excludePolicy(batchId, policyId, b, user) {
  const c = await one('SELECT * FROM incentive_calculations WHERE batch_id = $1', [batchId]);
  if (!c) throw notFound('Calculation batch not found');
  if (!['Calculated', 'Rejected'].includes(c.status)) throw conflict(`Batch ${c.batch_id} is ${c.status}; policies can no longer be excluded`);
  const line = await one(`SELECT b.*, p.policy_number, u.display_name AS caller FROM incentive_batch_policies b JOIN policies p ON p.id = b.policy_id LEFT JOIN users u ON u.id = b.caller_user_id
    WHERE b.calculation_id = $1 AND (b.policy_id = $2 OR p.policy_number = $2)`, [c.batch_id, String(policyId)]);
  if (!line) throw notFound(`Policy ${policyId} is not in batch ${c.batch_id}`);
  if (!['Counted', 'Disqualified'].includes(line.status)) throw conflict(`Policy ${line.policy_number} is ${line.status}; only a counted policy can be excluded`);
  if (!b.reasonCode || !String(b.note ?? b.remark ?? '').trim()) fail([err('reason', '036', 'A reason and a remark are required to exclude a policy')]);
  const reason = await requiredReason(pool, 'incentive_exclude', { reasonCode: b.reasonCode, note: b.note ?? b.remark });
  await query(`UPDATE telesales_policies SET excluded_reason_code = $2, excluded_reason = $3, excluded_by = $4, excluded_at = now(), excluded_batch_id = $5 WHERE policy_id = $1`,
    [line.policy_id, reason.code, reason.text, user.id, c.batch_id]);
  await recalculateTelesales(c.batch_id, user);
  return { policyId: line.policy_id, policyNumber: line.policy_number, caller: line.caller, reason: reason.text, message: `Policy ${line.policy_number} excluded; ${line.caller} recalculated` };
}

/** Include an excluded policy again (while the batch is Calculated or Rejected); the caller's line is recalculated. */
export async function includePolicy(batchId, policyId, user) {
  const c = await one('SELECT * FROM incentive_calculations WHERE batch_id = $1', [batchId]);
  if (!c) throw notFound('Calculation batch not found');
  if (!['Calculated', 'Rejected'].includes(c.status)) throw conflict(`Batch ${c.batch_id} is ${c.status}; policies can no longer be included again`);
  const line = await one(`SELECT b.*, p.policy_number, u.display_name AS caller FROM incentive_batch_policies b JOIN policies p ON p.id = b.policy_id LEFT JOIN users u ON u.id = b.caller_user_id
    WHERE b.calculation_id = $1 AND (b.policy_id = $2 OR p.policy_number = $2) AND b.status = 'Excluded'`, [c.batch_id, String(policyId)]);
  if (!line) throw notFound(`Policy ${policyId} is not excluded in batch ${c.batch_id}`);
  await query(`UPDATE telesales_policies SET excluded_reason_code = NULL, excluded_reason = NULL, excluded_by = NULL, excluded_at = NULL, excluded_batch_id = NULL WHERE policy_id = $1`, [line.policy_id]);
  await recalculateTelesales(c.batch_id, user);
  return { policyId: line.policy_id, policyNumber: line.policy_number, caller: line.caller, message: `Policy ${line.policy_number} included again; ${line.caller} recalculated` };
}

/** The adjusted telesales lines with their totals again (adjustments are part of the gross, FR-TSI-037). */
export async function retotalAdjusted(db, batchId) {
  const rows = (await db.query('SELECT * FROM incentive_results WHERE calculation_id = $1', [batchId])).rows;
  for (const r of rows) {
    if (r.result === 'Recovery outstanding') continue;
    const x = lineTotals({ base: r.base_amount, additional: r.additional_amount, recovery: r.recovery_amount, adjustments: r.adjustments, whtPct: r.wht_pct });
    await db.query('UPDATE incentive_results SET gross_amount = $2, tax_amount = $3, payout = $4, carried_forward = $5 WHERE id = $1', [r.id, x.gross, x.tax, x.total, x.carried]);
  }
  await db.query(`UPDATE incentive_calculations SET gross_total = (SELECT COALESCE(sum(tax_amount + payout), 0) FROM incentive_results WHERE calculation_id = $1),
      tax_total = (SELECT COALESCE(sum(tax_amount), 0) FROM incentive_results WHERE calculation_id = $1) WHERE batch_id = $1`, [batchId]);
}

/** The amounts of the accrual of a batch: { amount (payable), gross, tax } (FR-TSI-041). */
export async function accrualAmounts(db, batchId) {
  const r = (await db.query(`SELECT COALESCE(sum(payout), 0) AS amount, COALESCE(sum(COALESCE(tax_amount, 0)), 0) AS tax FROM incentive_results WHERE calculation_id = $1`, [batchId])).rows[0];
  const amount = round2(r.amount);
  const tax = round2(r.tax);
  return { amount, tax, gross: round2(amount + tax) };
}

/** Telesales columns of an agent line of a batch (Agent Details). */
export const lineFields = (r) => (r.result ? {
  counted: r.achieved === null ? 0 : Number(r.achieved), nbCount: r.nb_count, renewalCount: r.renewal_count, anc: r.anc === null ? null : Number(r.anc), level: r.level,
  baseAmount: Number(r.base_amount || 0), additionalAmount: Number(r.additional_amount || 0), recoveryAmount: Number(r.recovery_amount || 0), grossAmount: Number(r.gross_amount || 0),
  taxAmount: Number(r.tax_amount || 0), whtPct: r.wht_pct === null ? null : Number(r.wht_pct), result: r.result, carriedForward: Number(r.carried_forward || 0),
} : {});

/** The policies of a batch (Policies tab), filtered by caller and status. */
export async function batchPolicies(batchId, { callerId = null, status = null } = {}) {
  const c = await one('SELECT batch_id FROM incentive_calculations WHERE batch_id = $1', [batchId]);
  if (!c) throw notFound('Calculation batch not found');
  const rows = await many(`SELECT b.*, p.policy_number, p.insured_name, pr.name AS product, u.display_name AS caller, tp.excluded_reason, xb.display_name AS excluded_by
    FROM incentive_batch_policies b JOIN policies p ON p.id = b.policy_id LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN users u ON u.id = b.caller_user_id
    LEFT JOIN telesales_policies tp ON tp.policy_id = b.policy_id LEFT JOIN users xb ON xb.id = tp.excluded_by
    WHERE b.calculation_id = $1 AND ($2::text IS NULL OR b.caller_user_id = $2) AND ($3::text IS NULL OR b.status = $3) ORDER BY u.display_name, p.policy_number`, [c.batch_id, callerId || null, status || null]);
  return rows.map((r) => ({ id: Number(r.id), policyId: r.policy_id, policyNumber: r.policy_number, insuredName: r.insured_name, product: r.product, callerId: r.caller_user_id, caller: r.caller,
    kind: r.kind, fullyPaidOn: iso(r.fully_paid_on), commissionSettledOn: iso(r.commission_settled_on), eligibleOn: iso(r.eligible_on),
    netCommission: r.net_commission === null ? null : Number(r.status === 'Recovery' ? r.amount : r.net_commission), amount: Number(r.amount), level: r.level, status: r.status,
    detail: r.detail, excludedBy: r.status === 'Excluded' ? r.excluded_by : null }));
}

/** Excel of a batch (FR-TSI-042): one sheet of caller lines, one of policies. */
export async function exportBatch(batchId) {
  const c = await one('SELECT * FROM incentive_calculations WHERE batch_id = $1', [batchId]);
  if (!c) throw notFound('Calculation batch not found');
  const lines = await many(`SELECT r.*, u.display_name FROM incentive_results r JOIN users u ON u.id = r.agent_user_id WHERE r.calculation_id = $1 ORDER BY u.display_name`, [c.batch_id]);
  const v = c.version_id ? await one('SELECT * FROM incentive_program_versions WHERE id = $1', [c.version_id]) : null;
  const tiers = v ? cleanTiers(v.tiers) : [];
  const lineRows = lines.map((r) => ({
    caller: r.display_name, counted: Number(r.achieved || 0), nb: r.nb_count ?? 0, renewal: r.renewal_count ?? 0, anc: Number(r.anc || 0),
    tierAmount: r.level ? `${money(tiers[r.level - 1]?.nbAmount)} / ${money(tiers[r.level - 1]?.renewalAmount)}` : '-', level: r.level ? `Level ${r.level}` : '-',
    base: Number(r.base_amount || 0), additional: Number(r.additional_amount || 0), recoveryAdj: round2(Number(r.recovery_amount || 0) + Number(r.adjustments || 0)),
    tax: Number(r.tax_amount || 0), total: Number(r.payout || 0),
    remarks: [r.result, r.adjustment_reason, Number(r.carried_forward) > 0 ? `${money(r.carried_forward)} carried to the next month` : null, ['Approved', 'Paid'].includes(c.status) ? null : 'Not approved']
      .filter(Boolean).join('; '),
  }));
  const policies = await batchPolicies(c.batch_id);
  const columns = [
    { key: 'caller', label: 'Caller Name' }, { key: 'counted', label: 'No. Issued & Paid Policies', type: 'integer' }, { key: 'nb', label: 'NB', type: 'integer' },
    { key: 'renewal', label: 'Renewal', type: 'integer' }, { key: 'anc', label: 'Average Net Commission (ANC)', type: 'money' }, { key: 'tierAmount', label: 'Tier Level (Amount)' },
    { key: 'level', label: 'Incentive Level' }, { key: 'base', label: 'Base Incentives', type: 'money' }, { key: 'additional', label: 'Additional', type: 'money' },
    { key: 'recoveryAdj', label: 'Recovery / Adjustment', type: 'money' }, { key: 'tax', label: 'Tax', type: 'money' }, { key: 'total', label: 'Total Incentive', type: 'money' },
    { key: 'remarks', label: 'Remarks' },
  ];
  const pcols = [
    { key: 'caller', label: 'Caller' }, { key: 'policyNumber', label: 'Policy No.' }, { key: 'insuredName', label: 'Insured' }, { key: 'product', label: 'Product' },
    { key: 'kind', label: 'NB / Ren.' }, { key: 'fullyPaidOn', label: 'Fully paid', type: 'date' }, { key: 'commissionSettledOn', label: 'Commission settled', type: 'date' },
    { key: 'eligibleOn', label: 'Eligible on', type: 'date' }, { key: 'netCommission', label: 'Net commission', type: 'money' }, { key: 'amount', label: 'Amount', type: 'money' },
    { key: 'status', label: 'Status' }, { key: 'detail', label: 'Remarks' },
  ];
  return {
    fileName: `${c.batch_id}_telesales.xlsx`,
    content: writeXlsx({ title: `Telesales incentive ${c.batch_id}`, sheets: [
      { name: c.batch_id, columns, rows: lineRows, freeze: true, banner: [`Telesales incentive ${c.period}`, `Batch ${c.batch_id} - ${c.status}`] },
      { name: 'Policies', columns: pcols, rows: policies, freeze: true }] }),
  };
}

// ---------------------------------------------------------------- caller views

/** The Telesales programs a user takes part in now (a caller row active today). */
async function callerPrograms(userId, date) {
  return many(`SELECT DISTINCT p.* FROM incentive_programs p JOIN incentive_callers c ON c.program_id = p.id WHERE p.program_type = $1 AND p.status = 'Active'
    AND c.user_id = $2 AND c.date_from <= $3::date AND COALESCE(c.date_to, '9999-12-31') >= $3::date`, [TELESALES, userId, date]);
}

/**
 * My Programs of a caller (FR-TSI-042): the month to date, policies counted so far, ANC to date and the level it would
 * give, the policies still needed to reach the minimum and the next band.
 */
export async function callerProgress(userId, { asOf = null, sync = true } = {}) {
  const t = asOf || (await today());
  if (sync) await syncTelesalesPolicies({ asOf: t });
  const from = `${monthKey(t)}-01`;
  const out = [];
  for (const p of await callerPrograms(userId, t)) {
    const v = inForce(await versionRows(p.id), from);
    if (!v) continue;
    const s = await settingsOf();
    const tiers = cleanTiers(v.tiers);
    const bands = cleanBands(v.bands);
    const pols = await many(`SELECT tp.kind, tp.net_commission FROM telesales_policies tp JOIN policies x ON x.id = tp.policy_id WHERE tp.program_id = $1 AND tp.caller_user_id = $2
      AND tp.eligible_on BETWEEN $3 AND $4 AND tp.excluded_at IS NULL AND tp.cancelled_on IS NULL AND (tp.counted_batch_id IS NULL OR
        (SELECT status FROM incentive_calculations k WHERE k.batch_id = tp.counted_batch_id) = 'Rejected' OR tp.counted_period = $5) AND x.product_id = ANY($6)`,
    [p.id, userId, from, t, monthKey(t), v.products]);
    const n = pols.length;
    const nb = pols.filter((x) => x.kind !== 'Renewal').length;
    const anc = ancOf(pols.reduce((sum, x) => sum + Number(x.net_commission || 0), 0), n);
    const level = levelOf(tiers, anc);
    const tier = level ? tiers[level - 1] : null;
    const qualified = n >= v.min_policies;
    const additional = qualified ? excessIncentive(bands, n, s.method) : 0;
    const base = qualified && tier ? round2(nb * tier.nbAmount + (n - nb) * tier.renewalAmount) : 0;
    const toMinimum = Math.max(0, v.min_policies - n);
    out.push({ programId: p.id, programCode: p.program_code, programName: p.name, programType: TELESALES, isTelesales: true, targetMetric: ANC_METRIC, calculationFrequency: 'Monthly',
      periodFrom: from, periodTo: monthEnd(from), achieved: n, target: v.min_policies, counted: n, nbCount: nb, renewalCount: n - nb, anc, level, minPolicies: v.min_policies,
      toMinimum, toNextBand: toNextBand(bands, n, s.method),
      potentialEarning: round2(base + additional), base, additional, whtPct: Number(v.wht_pct), tiers: tiersOut(tiers), bands: bandsOut(bands),
      message: toMinimum > 0 ? `${toMinimum} more to qualify` : null, lastUpdated: t });
  }
  return out;
}

/** The statement lines of a caller for a month (FR-TSI-042): counted (NB / renewal), ANC, level, amounts; "Not approved". */
export async function statementLines(userId, monthKeyIn) {
  const rows = await many(`SELECT r.*, p.name AS program_name, p.program_code, k.status AS batch_status, k.batch_id FROM incentive_results r JOIN incentive_programs p ON p.id = r.program_id
    JOIN incentive_calculations k ON k.batch_id = r.calculation_id WHERE r.agent_user_id = $1 AND r.period = $2 AND p.program_type = $3 AND k.status <> 'Rejected'`, [userId, monthKeyIn, TELESALES]);
  return rows.map((r) => ({ program: r.program_name, programCode: r.program_code, metric: 'anc', isTelesales: true, batchId: r.batch_id, target: Number(r.target), achievement: Number(r.achieved),
    achievementPercent: null, rate: r.level ? `Level ${r.level}` : '-', earnedAmount: Number(r.payout), status: r.status, approved: ['Approved', 'Paid'].includes(r.batch_status),
    notApproved: !['Approved', 'Paid'].includes(r.batch_status), adjustments: Number(r.adjustments || 0), ...lineFields(r) }));
}

// ---------------------------------------------------------------- job

/**
 * Daily job (FRS 6.2): brings the telesales policies up to date; on the run day (incentive.telesales.run_day) creates
 * the Calculated batch of the previous month for each Telesales program in force, unless the month has a batch.
 */
export async function telesalesJob({ asOf = null } = {}) {
  const t = asOf || (await today());
  const s = await settingsOf();
  const sync = await syncTelesalesPolicies({ asOf: t });
  if (Number(t.slice(8, 10)) !== s.runDay) return { ...sync, calculated: [], skipped: `Not the run day (${s.runDay})` };
  const from = prevMonth(`${monthKey(t)}-01`);
  const calculated = [];
  const skipped = [];
  for (const p of await many('SELECT * FROM incentive_programs WHERE program_type = $1 AND status = \'Active\' ORDER BY id', [TELESALES])) {
    if (p.inactive_from && iso(p.inactive_from) <= from) continue;
    if (!inForce(await versionRows(p.id), from)) continue;
    const live = await liveBatch(p.id, from);
    if (live) { skipped.push(`${p.program_code}: ${monthLabel(from)} already has batch ${live.batch_id} (${live.status})`); continue; }
    const r = await calculateTelesales(p.id, { from }, { asOf: t, trigger: 'job', description: `Telesales incentive calculation ${monthLabel(from)} (job)` });
    await query(`INSERT INTO audit_log(entity, entity_id, action, after_data, source) VALUES ('incentive_calculation', $1, 'calculate', $2, '{"channel": "job", "name": "telesales-incentive-calc"}')`,
      [r.batchId, JSON.stringify({ batchId: r.batchId, status: 'Calculated', programCode: p.program_code, period: monthLabel(from), lines: r.lines, policies: r.policies, total: r.total })]);
    calculated.push(r.batchId);
  }
  return { ...sync, calculated, skipped };
}

