/**
 * Accounts > Remittance > Remittances: the worklist and register of insurer remittances, the data of the remittance
 * record page, the register export and the submission of several drafts with a result per draft.
 *
 * Only remittances of kind direct-bill are listed: agency bills are not used by TISPH. A row carries the status code
 * and its label (remittance.status_labels), the flags (off-cycle with its reason, overdue, open exceptions), the next
 * step and who it waits on (decision.js for a pending approval), and the actions the viewer may take (view, submit,
 * the schedule and advice downloads, open voucher). The list answers the totals of the filtered set and the four KPI
 * figures and segment counts of the page over the same filters, computed in SQL, never over one page.
 *
 * Segments map onto today's statuses: My work and Drafts are draft and rejected (Returned), In approval is
 * for-approval, In payment is approved, and settled (voucher raised) with a voucher not paid yet (the figure of the KPI
 * Approved, not paid); a settled remittance without a voucher (earlier releases) is under All only. All takes a status
 * filter. The payment of a
 * remittance is the voucher its settlement raised (remittance_items.data.disbursementId) until the Phase 2 lifecycle.
 * The source and the off-cycle reason are kept in remittances.data (source run-now / import, importId, importNo,
 * offCycleReason); a remittance of a schedule run without a source is a weekly run, any other is manual.
 */
import { many, one } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { hasPermission } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { businessTimeZone, today as businessToday, addDays, isoDate } from '../../lib/dates.js';
import { formatDate, isoDateOf } from '../../lib/pdf/format.js';
import { round2, params } from '../masters/helpers.js';
import { APPROVAL_SELECT, lineOut, processRemittances, remittanceDetails, statusCode, statusLabels, validateRemittances } from './service.js';
import { decisionBlock, decisionContext, nextStepFor, whenText } from './decision.js';
import { voucherDifferences } from './payments.js';

export const SEGMENTS = { 'my-work': ['draft', 'rejected'], drafts: ['draft', 'rejected'], 'in-approval': ['for-approval'], 'in-payment': ['approved', 'settled'], all: null };
export const SOURCES = { 'weekly-run': 'Weekly run', 'run-now': 'Run now', import: 'Import', manual: 'Manual' };
/** Payment modes of a voucher (disbursements.payment_mode) as the record names them. */
const PAYMENT_MODES = { check: 'Cheque', 'bank-transfer': 'Bank transfer', cash: 'Cash', card: 'Card', gcash: 'GCash' };
export const KPIS = ['to-submit', 'awaiting-approval', 'approved-not-paid', 'overdue'];
const MAX_ITEMS = 100;
const voucherLink = (id) => `/accounts/paymentvoucher/detailview/${id}`;
const recordLink = (id) => `/finance/remittance/remittances/${id}`;

const SOURCE_SQL = "COALESCE(r.data->>'source', CASE WHEN r.config_code IS NOT NULL THEN 'weekly-run' ELSE 'manual' END)";
const WEEK_SQL = "COALESCE((r.data->>'windowFrom')::date, date_trunc('week', r.remittance_date)::date)";
// approved, or settled with a voucher that is not paid yet
const UNPAID_SQL = "(r.status = 'approved' OR (r.status = 'settled' AND v.id IS NOT NULL AND v.paid_at IS NULL AND v.status NOT IN ('paid', 'cancelled')))";
const overdueSql = (today) => `(r.due_date < ${today}::date AND (r.status IN ('draft', 'rejected', 'for-approval') OR ${UNPAID_SQL}))`;

const FROM = `FROM remittances r LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id
  LEFT JOIN LATERAL (SELECT d.id, d.voucher_number, d.status, d.paid_at, d.reference_no, d.payment_mode, d.amount, d.voucher_date, x.id AS settlement_id, x.reference_no AS settlement_no
    FROM remittance_items x JOIN disbursements d ON d.id = x.data->>'disbursementId'
    WHERE x.kind = 'settlement' AND x.data->'remittanceIds' ? r.id ORDER BY x.created_at DESC LIMIT 1) v ON TRUE`;

const ROW_SELECT = `SELECT r.*, i.code AS insurer_code, i.name AS insurer_name, i.short_name AS insurer_short_name, i.status AS insurer_status,
    ${SOURCE_SQL} AS source, ${WEEK_SQL} AS week_from,
    (SELECT string_agg(DISTINCT rl.product, ', ') FROM remittance_lines rl WHERE rl.remittance_id = r.id) AS product_line,
    CASE WHEN EXISTS (SELECT 1 FROM remittance_lines rl JOIN receivables rv ON rv.policy_id = rl.policy_id AND rv.status <> 'cancelled'
                      WHERE rl.remittance_id = r.id AND rv.remittance_basis = 'gross') THEN 'gross' ELSE 'net' END AS basis,
    (SELECT count(*)::int FROM remittance_items e WHERE e.kind = 'exception' AND e.remittance_id = r.id AND e.status <> 'Resolved') AS open_exceptions,
    (SELECT display_name FROM users u WHERE u.id = r.submitted_by) AS submitted_by_name, (SELECT display_name FROM users u WHERE u.id = r.created_by) AS created_by_name,
    v.id AS voucher_id, v.voucher_number, v.status AS voucher_status, v.paid_at AS voucher_paid_at, v.reference_no AS voucher_reference, v.payment_mode AS voucher_method,
    v.amount AS voucher_amount, v.voucher_date, v.settlement_id, v.settlement_no
  ${FROM}`;

const SORTS = { remittanceNo: 'r.remittance_number', insurer: 'i.name', dueDate: 'r.due_date', dueToInsurer: 'r.net_due', policies: 'r.policy_count', status: 'r.status',
  createdAt: 'r.created_at', remittanceDate: 'r.remittance_date', week: WEEK_SQL };

function orderBy(sort) {
  const s = String(sort || '');
  const key = s.replace(/^-/, '');
  if (!SORTS[key]) return 'r.remittance_date DESC, r.created_at DESC, r.id';
  return `${SORTS[key]} ${s.startsWith('-') ? 'DESC' : 'ASC'} NULLS LAST, r.remittance_number, r.id`;
}

/** The filters of the page shared by the rows, the totals, the KPI figures and the export (not the segment). */
async function filterConds(qs, p, today) {
  const conds = ["r.kind = 'direct-bill'"];
  const week = qs.week && qs.week !== 'all' ? isoDate(qs.week) : null;
  if (week) conds.push(`${WEEK_SQL} = date_trunc('week', ${p.add(week)}::date)::date`);
  if (qs.insurerId) conds.push(`(r.insurance_company_id::text = ${p.add(String(qs.insurerId))} OR lower(i.code) = lower($${p.values.length}))`);
  if (qs.productLine && qs.productLine !== 'all') conds.push(`EXISTS (SELECT 1 FROM remittance_lines rl WHERE rl.remittance_id = r.id AND rl.product ILIKE ${p.add(String(qs.productLine))})`);
  if (qs.source && qs.source !== 'all') {
    const code = Object.keys(SOURCES).find((k) => k === qs.source || SOURCES[k].toLowerCase() === String(qs.source).toLowerCase()) || String(qs.source);
    conds.push(`${SOURCE_SQL} = ${p.add(code)}`);
  }
  if (qs.q) {
    const like = p.add(`%${String(qs.q).trim()}%`);
    conds.push(`(r.remittance_number ILIKE ${like} OR EXISTS (SELECT 1 FROM remittance_lines rl WHERE rl.remittance_id = r.id AND rl.policy_number ILIKE ${like})
      OR EXISTS (SELECT 1 FROM remittance_lines rl JOIN receipts rc ON rc.policy_id = rl.policy_id WHERE rl.remittance_id = r.id AND rc.receipt_number ILIKE ${like}))`);
  }
  const kpi = KPIS.includes(qs.kpi) ? qs.kpi : null;
  if (kpi === 'to-submit') conds.push("r.status IN ('draft', 'rejected')");
  if (kpi === 'awaiting-approval') conds.push("r.status = 'for-approval'");
  if (kpi === 'approved-not-paid') conds.push(UNPAID_SQL);
  if (kpi === 'overdue') conds.push(overdueSql(p.add(today)));
  return conds;
}

/** The segment (and on All the status filter) as conditions; My work is empty for a user who cannot prepare. */
async function segmentConds(segment, qs, user, p) {
  if (segment === 'my-work' && !hasPermission(user, 'write:remittance')) return ['FALSE'];
  if (segment === 'in-payment') return [UNPAID_SQL];
  const statuses = SEGMENTS[segment];
  if (statuses) return [`r.status = ANY(${p.add(statuses)})`];
  const wanted = [];
  for (const s of String(qs.status || '').split(',').map((x) => x.trim()).filter((x) => x && x !== 'all')) wanted.push(await statusCode(s));
  return wanted.length ? [`r.status = ANY(${p.add(wanted)})`] : [];
}

const userOf = (id, name) => (id ? { id, name: name || null } : null);

/** The next step of a remittance that is not pending approval (a pending one waits on its approvers). */
function nextStepOf(r, returned) {
  if (r.status === 'draft') return { code: 'submit', label: 'Submit for approval', actor: { type: 'permission', name: 'Remittance preparer' }, dueAt: null };
  if (r.status === 'rejected') return { code: 'resubmit', label: 'Correct and resubmit', actor: { type: 'permission', name: 'Remittance preparer' }, reason: returned?.reason ?? null, dueAt: null };
  if (r.status === 'approved') return { code: 'settle', label: 'Include in a settlement', actor: { type: 'permission', name: 'Remittance preparer' }, dueAt: null };
  if (r.status === 'settled' && r.voucher_id && !r.voucher_paid_at) {
    const step = { draft: ['submit-voucher', 'Submit voucher'], 'for-approval': ['approve-voucher', 'Approve voucher'], approved: ['pay-voucher', 'Pay voucher'] }[r.voucher_status];
    if (step) return { code: step[0], label: `${step[1]} ${r.voucher_number} (Disbursement)`, actor: { type: 'permission', name: 'Disbursement' }, dueAt: null };
  }
  return null;
}

/** Why a draft cannot be submitted (the guards of validateRemittances), or null. */
function submitBlock(r) {
  const errors = [];
  if (!r.policy_count) errors.push('No policies on the remittance');
  if (Number(r.net_due) <= 0) errors.push('Due to insurer must be greater than zero');
  if (r.insurance_company_id && r.insurer_status !== 'active') errors.push('Insurer is not active');
  return errors.length ? errors.join('; ') : null;
}

/** The actions of a row for `user`, from its status and the user's permissions (R1: view, submit, downloads, voucher). */
export function actionsFor(r, user) {
  const out = [{ code: 'view', label: 'View', allowed: true, link: recordLink(r.id) }];
  if (['draft', 'rejected'].includes(r.status) && hasPermission(user, 'write:remittance')) {
    const blocked = submitBlock(r);
    out.push({ code: 'submit', label: 'Submit for approval', allowed: !blocked, ...(blocked ? { blockedCode: 'INVALID', blockedReason: blocked } : {}) });
  }
  if (r.status !== 'cancelled') {
    out.push({ code: 'download-schedule-xlsx', label: 'Download schedule (XLSX)', allowed: true, href: `/remittance/remittances/${r.id}/schedule.xlsx` },
      { code: 'download-schedule-pdf', label: 'Download schedule (PDF)', allowed: true, href: `/remittance/remittances/${r.id}/schedule.pdf` });
  }
  if (r.status === 'settled') out.push({ code: 'download-advice', label: 'Download advice (PDF)', allowed: true, href: `/remittance/remittances/${r.id}/advice.pdf` });
  if (r.voucher_id && hasPermission(user, 'read:disbursements')) out.push({ code: 'open-voucher', label: 'Open voucher', allowed: true, link: voucherLink(r.voucher_id) });
  return out;
}

/** The decided approvals that returned the rejected remittances: { remittanceId: { reason, by, at } }. */
async function returnsOf(ids) {
  if (!ids.length) return new Map();
  const rows = await many(`SELECT DISTINCT ON (a.entity_id) a.entity_id, a.remarks, a.action_at, (SELECT display_name FROM users u WHERE u.id = a.action_by) AS by_name
    FROM remittance_approvals a WHERE a.entity = 'remittance' AND a.entity_id = ANY($1) AND a.status = 'Rejected' ORDER BY a.entity_id, a.action_at DESC`, [ids]);
  return new Map(rows.map((x) => [x.entity_id, { reason: x.remarks, by: x.by_name, at: x.action_at ? new Date(x.action_at).toISOString() : null }]));
}

/** Register rows of `user` from ROW_SELECT rows: flags, next step, decision of a pending approval and actions. */
async function rowsOut(raw, user, { today, ctx }) {
  const labels = await statusLabels();
  const ids = raw.map((r) => r.id);
  const pending = ids.length ? await many(`${APPROVAL_SELECT} WHERE a.entity = 'remittance' AND a.entity_id = ANY($1) AND a.status = 'Pending'`, [ids]) : [];
  const byId = new Map(pending.map((a) => [a.entity_id, a]));
  const returns = await returnsOf(raw.filter((r) => r.status === 'rejected').map((r) => r.id));
  const out = [];
  for (const r of raw) {
    const a = byId.get(r.id);
    const decision = a ? await decisionBlock(a, user, ctx) : null;
    const weekFrom = isoDate(r.week_from);
    const offCycle = ['run-now', 'import'].includes(r.source);
    const overdue = !!r.due_date && isoDate(r.due_date) < today && (['draft', 'rejected', 'for-approval', 'approved'].includes(r.status)
      || (r.status === 'settled' && !!r.voucher_id && !r.voucher_paid_at && !['paid', 'cancelled'].includes(r.voucher_status)));
    const reason = r.data?.offCycleReason || null;
    out.push({
      id: r.id, remittanceNo: r.remittance_number, kind: r.kind, status: r.status, statusLabel: labels[r.status] || r.status,
      insurer: r.insurance_company_id ? { id: r.insurance_company_id, code: r.insurer_code, name: r.insurer_name, shortName: r.insurer_short_name || r.insurer_name } : null,
      productLine: r.product_line || null, basis: r.basis, basisLabel: r.basis === 'gross' ? 'Gross' : 'Net',
      coverageWeek: weekFrom ? { from: weekFrom, to: isoDate(r.data?.windowTo) || addDays(weekFrom, 4) } : null,
      source: { code: r.source, label: r.source === 'import' && r.data?.importNo ? `Import ${r.data.importNo}` : SOURCES[r.source] || r.source,
        importId: r.data?.importId || null, importNo: r.data?.importNo || null },
      offCycleReason: offCycle && reason ? { code: reason.code || null, name: reason.name || null, note: reason.note || null, text: reason.text || reason.name || null } : null,
      policyCount: r.policy_count, heldCount: null, premium: round2(r.gross_premium), commission: round2(r.commission), tax: round2(r.tax), adjustments: round2(r.adjustments),
      dueToInsurer: round2(r.net_due), currency: r.currency, remittanceDate: isoDate(r.remittance_date), dueDate: isoDate(r.due_date), overdue,
      flags: { offCycle, offCycleReason: offCycle ? reason?.text || reason?.name || null : null, overdue, adviceSent: false, bankMatched: false, openExceptions: r.open_exceptions },
      nextStep: a ? nextStepFor(a, decision.eligibleApprovers, { compact: true }) : nextStepOf(r, returns.get(r.id)),
      returned: returns.get(r.id) || null,
      decision, approvalId: a ? Number(a.id) : null, approvalVersion: a ? a.version : null,
      actions: actionsFor(r, user), version: r.version,
      voucher: r.voucher_id ? { id: r.voucher_id, number: r.voucher_number, status: r.voucher_status, amount: round2(r.voucher_amount), link: voucherLink(r.voucher_id) } : null,
      paidOn: r.voucher_paid_at ? new Date(r.voucher_paid_at).toISOString() : null, bankReference: r.voucher_paid_at ? r.voucher_reference || null : null,
      submittedBy: userOf(r.submitted_by, r.submitted_by_name), submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
      createdBy: r.created_by ? { id: r.created_by, name: r.created_by_name || null } : { id: null, name: 'System' }, createdAt: new Date(r.created_at).toISOString(),
      link: recordLink(r.id),
    });
  }
  return out;
}

/** KPI figures and segment counts over the filters (not the segment) of the page. */
async function kpisOf(conds, values, today) {
  const tz = await businessTimeZone();
  const p = params([...values]);
  const t = p.add(today);
  const z = p.add(tz);
  const k = await one(`SELECT
      count(*) FILTER (WHERE r.status IN ('draft', 'rejected'))::int AS to_submit, COALESCE(sum(r.net_due) FILTER (WHERE r.status IN ('draft', 'rejected')), 0) AS to_submit_amount,
      count(*) FILTER (WHERE r.status = 'for-approval')::int AS awaiting, COALESCE(sum(r.net_due) FILTER (WHERE r.status = 'for-approval'), 0) AS awaiting_amount,
      count(*) FILTER (WHERE ${UNPAID_SQL})::int AS unpaid, COALESCE(sum(r.net_due) FILTER (WHERE ${UNPAID_SQL}), 0) AS unpaid_amount,
      COALESCE(max(${t}::date - (COALESCE(r.approved_at, r.updated_at) AT TIME ZONE ${z})::date) FILTER (WHERE ${UNPAID_SQL}), 0) AS oldest_days,
      count(*) FILTER (WHERE ${overdueSql(t)})::int AS overdue, COALESCE(sum(r.net_due) FILTER (WHERE ${overdueSql(t)}), 0) AS overdue_amount,
      count(*)::int AS all_count
    ${FROM} WHERE ${conds.join(' AND ')}`, p.values);
  return {
    kpis: {
      toSubmit: { count: k.to_submit, amount: round2(k.to_submit_amount) },
      awaitingApproval: { count: k.awaiting, amount: round2(k.awaiting_amount) },
      approvedNotPaid: { count: k.unpaid, amount: round2(k.unpaid_amount), oldestDays: Number(k.oldest_days) || 0 },
      overdue: { count: k.overdue, amount: round2(k.overdue_amount) },
    },
    segments: { 'my-work': k.to_submit, drafts: k.to_submit, 'in-approval': k.awaiting, 'in-payment': k.unpaid, all: k.all_count },
  };
}

/** The where clause and values of a register request (filters, then the segment). */
async function whereOf(qs, user, today) {
  const segment = Object.hasOwn(SEGMENTS, qs.segment) ? qs.segment : 'all';
  const p = params();
  const base = await filterConds(qs, p, today);
  const baseValues = [...p.values];
  const seg = await segmentConds(segment, qs, user, p);
  return { segment, p, base, baseValues, conds: [...base, ...seg] };
}

/**
 * GET /remittance/remittances?segment=: { segment, rows (one page), total, totals of the filtered set (count, policies,
 * premium, commission, tax, due to insurer), kpis and segment counts over the filters }. `now` is for tests.
 */
export async function registerList(qs, user, pg, { now = new Date() } = {}) {
  const today = await businessToday(now);
  const { segment, p, base, baseValues, conds } = await whereOf(qs, user, today);
  const where = conds.join(' AND ');
  const agg = await one(`SELECT count(*)::int AS n, COALESCE(sum(r.policy_count), 0)::int AS policies, COALESCE(sum(r.gross_premium), 0) AS premium,
      COALESCE(sum(r.commission), 0) AS commission, COALESCE(sum(r.tax), 0) AS tax, COALESCE(sum(r.net_due), 0) AS due ${FROM} WHERE ${where}`, p.values);
  const raw = await many(`${ROW_SELECT} WHERE ${where} ORDER BY ${orderBy(qs.sort)} LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  const ctx = await decisionContext(user, { now });
  const rows = await rowsOut(raw, user, { today, ctx });
  const { kpis, segments } = await kpisOf(base, baseValues, today);
  if (!hasPermission(user, 'write:remittance')) segments['my-work'] = 0;
  return {
    segment, rows, total: agg.n, kpis, segments,
    totals: { count: agg.n, policies: agg.policies, premium: round2(agg.premium), commission: round2(agg.commission), tax: round2(agg.tax), dueToInsurer: round2(agg.due) },
  };
}

/** One register row of a remittance for `user` (the record page's header data); null when it is not a direct-bill one. */
export async function registerRow(id, user, { now = new Date() } = {}) {
  const r = await one(`${ROW_SELECT} WHERE (r.id = $1 OR r.remittance_number = $1) AND r.kind = 'direct-bill'`, [String(id)]);
  if (!r) return null;
  const [row] = await rowsOut([r], user, { today: await businessToday(now), ctx: await decisionContext(user, { now }) });
  return row;
}

/**
 * GET /remittance/remittances/:id: the details of earlier releases (insurer, policies, documents, decision block, next
 * step, activity log) and, for a direct-bill remittance, the register row (status label, flags, source, off-cycle
 * reason, coverage week, basis, actions), the lines with the values of an import, the payment through the settlement
 * voucher and the documents to download.
 */
export async function remittanceRecord(id, user) {
  const details = await remittanceDetails(id, { viewer: user });
  const row = await registerRow(details.id, user);
  if (!row) return details;
  const lines = await many('SELECT * FROM remittance_lines WHERE remittance_id = $1 ORDER BY id', [details.id]);
  const v = row.voucher;
  const voucher = v ? await one('SELECT voucher_date, payment_mode, reference_no, paid_at FROM disbursements WHERE id = $1', [v.id]) : null;
  const settlement = v ? await one(`SELECT x.id, x.reference_no FROM remittance_items x WHERE x.kind = 'settlement' AND x.data->>'disbursementId' = $1 ORDER BY x.created_at DESC LIMIT 1`, [v.id]) : null;
  const differences = v ? await voucherDifferences([v.id]) : new Map();
  const downloads = row.actions.filter((a) => a.code.startsWith('download-')).map((a) => ({ code: a.code.replace(/^download-/, ''), label: a.label.replace(/^Download /, ''), href: a.href }));
  return {
    ...details, ...row,
    // the record names every eligible approver (the register row names one, or how many)
    nextStep: details.nextStep || row.nextStep,
    // `status` stays the label the Tracking screen of earlier releases shows until it is retired; statusCode is the code
    status: details.status, statusCode: row.status, decision: details.decision ?? null,
    lines: lines.map(lineOut),
    payment: v ? { voucher: v, method: voucher?.payment_mode ? PAYMENT_MODES[voucher.payment_mode] || voucher.payment_mode : null,
      amountDifference: differences.has(v.id) ? { amount: differences.get(v.id).difference, text: differences.get(v.id).text } : null, valueDate: isoDate(voucher?.voucher_date), bankReference: voucher?.paid_at ? voucher.reference_no || null : null,
      paidOn: voucher?.paid_at ? new Date(voucher.paid_at).toISOString() : null, settlement: settlement ? { id: settlement.id, reference: settlement.reference_no } : null } : null,
    downloads,
  };
}

/**
 * POST /remittance/remittances/submit { items: [{ id, version }] }: each draft is checked on its own (the version it
 * was shown, its status, the guards of validateRemittances); the ready ones are submitted together as one processing
 * batch. Returns { submitted, refused, batchId, results: [{ id, reference, ok, status, statusLabel, message } |
 * { id, reference, ok: false, code, message }] } in the order of the request.
 */
export async function submitMany(b, user, req) {
  const items = Array.isArray(b?.items) ? b.items : [];
  if (!items.length || items.length > MAX_ITEMS || items.some((i) => !i || !i.id)) {
    throw badRequest('Validation failed', [{ path: 'items', message: `Select between 1 and ${MAX_ITEMS} remittances, each with its id` }]);
  }
  const labels = await statusLabels();
  const ctx = await decisionContext(user);
  const results = new Array(items.length);
  const ready = [];
  for (const [n, item] of items.entries()) {
    const r = await one(`SELECT r.*, (SELECT display_name FROM users u WHERE u.id = r.submitted_by) AS submitted_by_name FROM remittances r
      WHERE (r.id = $1 OR r.remittance_number = $1) AND r.kind = 'direct-bill'`, [String(item.id)]);
    const fail = (code, message) => { results[n] = { id: r?.id ?? String(item.id), reference: r?.remittance_number ?? null, ok: false, code, message }; };
    if (!r) { fail('NOT_FOUND', 'Not submitted: remittance not found'); continue; }
    if (r.status === 'for-approval') {
      const when = whenText(ctx, r.submitted_at);
      fail('ALREADY_SUBMITTED', `${r.remittance_number} was submitted by ${r.submitted_by_name || 'another user'}${when ? ` ${when}` : ''}.`);
      continue;
    }
    if (!['draft', 'rejected'].includes(r.status)) { fail('WRONG_STATUS', `Not submitted: the remittance is ${labels[r.status] || r.status}`); continue; }
    if (item.version !== undefined && item.version !== null && Number(item.version) !== r.version) {
      fail('STALE', `Not submitted: ${r.remittance_number} changed since it was shown. Reload.`);
      continue;
    }
    const v = (await validateRemittances([r.id])).results[0];
    if (!v.valid) { fail('INVALID', `Not submitted: ${v.errors.join('; ')}`); continue; }
    ready.push({ n, id: r.id, reference: r.remittance_number });
  }
  let batchId = null;
  if (ready.length) {
    const out = await processRemittances(ready.map((x) => x.id), user);
    batchId = out.batchId;
    await audit(req, { entity: 'remittance_batch', entityId: batchId, action: 'submit', after: out });
    const failed = new Map((out.failed || []).map((f) => [f.id, f]));
    for (const x of ready) {
      if (failed.has(x.id)) {
        results[x.n] = { id: x.id, reference: x.reference, ok: false, code: 'INVALID', message: `Not submitted: ${failed.get(x.id).errors.join('; ')}` };
        continue;
      }
      await audit(req, { entity: 'remittance', entityId: x.id, action: 'submit', after: { status: 'for-approval', batchId } });
      results[x.n] = { id: x.id, reference: x.reference, ok: true, status: 'for-approval', statusLabel: labels['for-approval'] || 'Pending approval', message: 'Submitted' };
    }
  }
  const list = results.filter(Boolean);
  return { submitted: list.filter((r) => r.ok).length, refused: list.filter((r) => !r.ok).length, batchId, results: list };
}

export const EXPORT_COLUMNS = [
  { key: 'remittanceNo', header: 'Remittance no', width: 18 }, { key: 'insurer', header: 'Insurer', width: 28 }, { key: 'productLine', header: 'Product line', width: 18 },
  { key: 'basis', header: 'Basis', width: 8 }, { key: 'coverageWeek', header: 'Coverage week', width: 24 }, { key: 'offCycle', header: 'Off-cycle reason', width: 24 },
  { key: 'policies', header: 'Policies', width: 10, type: 'integer' }, { key: 'dueToInsurer', header: 'Due to insurer', width: 16, type: 'money' },
  { key: 'dueDate', header: 'Due date', width: 12, type: 'date' }, { key: 'status', header: 'Status', width: 22 }, { key: 'nextStep', header: 'Next step', width: 34 },
  { key: 'source', header: 'Source', width: 18 }, { key: 'voucherNo', header: 'Voucher no', width: 18 }, { key: 'paidOn', header: 'Paid on', width: 12, type: 'date' },
  { key: 'bankRef', header: 'Bank ref', width: 18 }, { key: 'submittedBy', header: 'Submitted by', width: 20 }, { key: 'createdOn', header: 'Created on', width: 12, type: 'date' },
];

/** The filters of a register request in words, for the export's header ("Segment All · Insurer Pioneer ..."). */
async function filterSummary(qs, segment, fmt) {
  const parts = [`Segment ${{ 'my-work': 'My work', drafts: 'Drafts', 'in-approval': 'In approval', 'in-payment': 'In payment', all: 'All' }[segment]}`];
  if (qs.week && qs.week !== 'all') parts.push(`Coverage week ${formatDate(isoDate(qs.week), fmt)}`);
  if (qs.insurerId) {
    const i = await one('SELECT name FROM insurance_companies WHERE id::text = $1 OR lower(code) = lower($1)', [String(qs.insurerId)]);
    parts.push(`Insurer ${i?.name || qs.insurerId}`);
  }
  if (qs.productLine && qs.productLine !== 'all') parts.push(`Product line ${qs.productLine}`);
  if (segment === 'all' && qs.status && qs.status !== 'all') {
    const labels = await statusLabels();
    const names = [];
    for (const s of String(qs.status).split(',').filter(Boolean)) names.push(labels[await statusCode(s.trim())] || s.trim());
    parts.push(`Status ${names.join(', ')}`);
  }
  if (qs.source && qs.source !== 'all') parts.push(`Source ${SOURCES[qs.source] || qs.source}`);
  if (qs.kpi && KPIS.includes(qs.kpi)) parts.push({ 'to-submit': 'To submit', 'awaiting-approval': 'Awaiting approval', 'approved-not-paid': 'Approved, not paid', overdue: 'Overdue to insurer' }[qs.kpi]);
  if (qs.q) parts.push(`Search "${qs.q}"`);
  return parts.join(' · ');
}

/**
 * Rows of the register export (every visible and hidden column) over the whole filtered set, up to reports.max_rows,
 * with the filter summary: { columns, rows, summary, totals }.
 */
export async function registerExport(qs, user, fmt, { now = new Date() } = {}) {
  const max = Number(await getSetting('reports.max_rows', 50000)) || 50000;
  const r = await registerList(qs, user, { limit: max, offset: 0 }, { now });
  const date = (v) => (v ? isoDate(v) : '');
  const day = (v) => (v ? isoDateOf(v, fmt.timeZone) : '');
  const rows = r.rows.map((x) => ({
    remittanceNo: x.remittanceNo, insurer: x.insurer?.name || '', productLine: x.productLine || '', basis: x.basisLabel,
    coverageWeek: x.coverageWeek ? `${formatDate(x.coverageWeek.from, fmt)} – ${formatDate(x.coverageWeek.to, fmt)}` : '', offCycle: x.offCycleReason?.text || '',
    policies: x.policyCount, dueToInsurer: x.dueToInsurer, dueDate: date(x.dueDate), status: x.overdue ? `${x.statusLabel} (overdue)` : x.statusLabel, nextStep: x.nextStep?.label || '',
    source: x.source.label, voucherNo: x.voucher?.number || '', paidOn: day(x.paidOn), bankRef: x.bankReference || '', submittedBy: x.submittedBy?.name || '',
    createdOn: day(x.createdAt),
  }));
  return { columns: EXPORT_COLUMNS, rows, summary: await filterSummary(qs, r.segment, fmt), totals: r.totals };
}
