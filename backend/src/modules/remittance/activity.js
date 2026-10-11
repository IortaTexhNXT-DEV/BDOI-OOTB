/**
 * Activity log of a remittance (record page > Activity, the approval review panel, the Tracking view), oldest first.
 *
 * It merges, as entries of lib/auditEvents#activityEntries (action label, user display name and roles, status from /
 * to, remarks, changed fields):
 *   - the audit rows of the remittance and its lines;
 *   - the decisions on its approval (audited as remittance_approval, and since migration 0401 under the remittance as
 *     well), each with the level, the limit at decision and its source and the reason from the approval history;
 *   - the approval of the settlement that settled it;
 *   - the payment voucher that settlement raised, and the audit of that voucher, of its bank payment batches and of
 *     its cheques;
 *   - the e-mails sent about the remittance;
 *   - its creation from an imported policy list ("Imported from IMP-2026-0004", with the off-cycle reason) or by a
 *     remittance run (the weekly run, or Run now with its off-cycle reason, and the window).
 * The same action by the same user within 2 seconds is one entry (a decision is audited twice). Reason codes, role
 * codes and limit sources never reach an entry raw.
 */
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { activityEntries, instant } from '../../lib/auditEvents.js';
import { printFormat } from '../../lib/pdf/index.js';
import { decisionContext, limitSourceLabel, amountText, roleNames } from './decision.js';

const DUPLICATE_MS = 2000;
const HISTORY_MATCH_MS = 5000;

/** Approval level and delegate of an approval decision (the other fields of an approval snapshot are bookkeeping). */
function approvalChanges(before, after) {
  const out = [];
  if (!before || !after) return out;
  const of = (x) => (x.currentLevel ? `${x.currentLevel} of ${x.requiredLevels}` : null);
  if (before.currentLevel !== after.currentLevel) out.push({ field: 'currentLevel', label: 'Approval level', before: of(before), after: of(after) });
  if ((before.delegatedTo || null) !== (after.delegatedTo || null)) out.push({ field: 'delegatedTo', label: 'Delegated to', before: before.delegatedTo || null, after: after.delegatedTo || null });
  return out;
}

/** The payment vouchers raised for the remittance (by the settlements that settled it), with their batches and cheques. */
async function paymentRecords(remittanceId) {
  const vouchers = await many(`SELECT d.id, d.voucher_number, d.amount, d.created_at, d.created_by FROM disbursements d
    WHERE d.id IN (SELECT x.data->>'disbursementId' FROM remittance_items x WHERE x.kind = 'settlement' AND x.data->'remittanceIds' ? $1)`, [remittanceId]);
  const ids = vouchers.map((v) => v.id);
  if (!ids.length) return { vouchers, batches: [], cheques: [] };
  const batches = await many(`SELECT DISTINCT b.id, b.batch_number FROM bank_payment_batches b JOIN bank_payment_batch_lines l ON l.batch_id = b.id
    WHERE l.disbursement_id = ANY($1)`, [ids]);
  const cheques = await many('SELECT id, instrument_no FROM checkbooks WHERE disbursement_id = ANY($1)', [ids]);
  return { vouchers, batches, cheques };
}

async function auditRows(remittanceId, pay) {
  return many(`SELECT a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source FROM audit_log a
    WHERE (a.entity = 'remittance' AND a.entity_id = $1)
       OR (a.entity = 'remittance_line' AND a.entity_id IN (SELECT id::text FROM remittance_lines WHERE remittance_id = $1))
       OR (a.entity = 'remittance_approval' AND a.entity_id IN (SELECT id::text FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1))
       OR (a.entity = 'remittance_approval' AND a.action = 'approve' AND a.after_data->>'status' = 'Approved' AND a.entity_id IN (
             SELECT ra.id::text FROM remittance_approvals ra JOIN remittance_items x ON x.id = ra.entity_id
             WHERE ra.entity = 'item' AND x.kind = 'settlement' AND x.data->'remittanceIds' ? $1))
       OR (a.entity = 'disbursement' AND a.entity_id = ANY($2))
       OR (a.entity = 'bank_payment_batch' AND a.entity_id = ANY($3))
       OR (a.entity = 'checkbook' AND a.entity_id = ANY($4))
    ORDER BY a.at, a.id`, [remittanceId, pay.vouchers.map((v) => v.id), pay.batches.map((b) => b.id), pay.cheques.map((c) => c.id)]);
}

/** The decisions kept on the remittance's approvals (approval history), with the approval they belong to. */
async function approvalDecisions(remittanceId) {
  const rows = await many(`SELECT a.id, a.required_levels, h.value AS h, u.username, u.display_name
    FROM remittance_approvals a CROSS JOIN LATERAL jsonb_array_elements(a.history) h LEFT JOIN users u ON u.id = h.value->>'by'
    WHERE a.entity = 'remittance' AND a.entity_id = $1 AND h.value->>'action' IN ('Approved', 'Rejected')`, [remittanceId]);
  return rows.map((r) => ({ approvalId: String(r.id), requiredLevels: r.required_levels, username: r.username, displayName: r.display_name || r.username, ...r.h }));
}

/** The approval history entry of an audited decision: same approval, same user, within a few seconds. */
function historyOf(decisions, row) {
  const approvalId = row.entity === 'remittance_approval' ? String(row.entity_id) : String(row.after_data?.approvalId ?? '');
  const at = new Date(row.at).getTime();
  return decisions.find((d) => d.approvalId === approvalId && (d.by === row.user_id || d.username === row.username)
    && Math.abs(new Date(d.at).getTime() - at) <= HISTORY_MATCH_MS) || null;
}

const isDecision = (r) => ['approve', 'reject'].includes(r.action) && (r.entity === 'remittance' || r.entity === 'remittance_approval')
  && !(r.entity === 'remittance_approval' && r.after_data?.transactionType === 'Settlement');

/** The approval facts of a decision as entry fields and readable changes (no reason or role codes). */
function decisionFields(h, row, ctx, names, labels) {
  const approved = row.action === 'approve';
  const finalStep = row.after_data?.status ? !['Pending', 'for-approval'].includes(row.after_data.status) : true;
  const level = h?.level ?? row.after_data?.level ?? null;
  const required = h?.requiredLevels ?? row.after_data?.requiredLevels ?? null;
  const limit = h ? h.limitAtDecision : row.after_data?.limitAtDecision;
  const source = h ? h.limitSource : row.after_data?.limitSource;
  const approval = { level, requiredLevels: required, limitAtDecision: limit ?? null, limitSource: source ?? null,
    limitSourceLabel: limitSourceLabel(source, names), reason: approved ? null : (h?.remarks ?? row.after_data?.remarks ?? null) };
  const changes = [];
  if (required > 1 && level) changes.push({ field: 'level', label: 'Approval level', before: null, after: `${level} of ${required}` });
  if (source) changes.push({ field: 'limitAtDecision', label: 'Limit at decision', before: null, after: limit === null || limit === undefined ? 'No limit' : amountText(ctx, limit) });
  if (source) changes.push({ field: 'limitSource', label: 'Limit source', before: null, after: approval.limitSourceLabel });
  const actionLabel = approved ? (finalStep ? 'Remittance approved' : `Approval level ${level} of ${required} given`) : 'Remittance returned to the maker';
  const moved = approved ? (finalStep ? labels.approved || 'Approved' : null) : labels.rejected || 'Rejected';
  return { actionCode: approved ? 'approve' : 'reject', actionLabel, changes, approval, remarks: h?.remarks ?? row.after_data?.remarks ?? null,
    fromStatus: moved ? labels['for-approval'] || 'Pending approval' : null, toStatus: moved };
}

/** Entries of the e-mails sent about the remittance (e-mail outbox). */
async function emailEntries(remittanceId, fmt) {
  const rows = await many(`SELECT id, to_address, subject, status, created_at, sent_at FROM email_outbox WHERE entity = 'remittance' AND entity_id = $1 ORDER BY created_at, id`, [remittanceId]);
  return rows.map((m) => {
    const at = m.sent_at || m.created_at;
    const when = instant(at, fmt);
    const word = m.status === 'sent' ? 'sent' : m.status === 'failed' ? 'not delivered' : 'queued';
    return { id: `mail-${m.id}`, at: new Date(at).toISOString(), day: when?.day ?? null, date: when?.date ?? null, time: when?.time ?? null, atText: when?.text ?? null,
      actionCode: 'email', actionLabel: `E-mail ${word} to ${m.to_address}`, user: { username: null, displayName: 'System', roles: [], role: null },
      fromStatus: null, toStatus: null, remarks: m.subject, changes: [], source: { channel: 'job', label: 'E-mail', name: null } };
  });
}

/** The voucher raised for the remittance as an entry (the voucher is created with the settlement approval, unaudited). */
function voucherEntries(vouchers, fmt) {
  return vouchers.map((v) => {
    const when = instant(v.created_at, fmt);
    return { id: `pv-${v.id}`, at: new Date(v.created_at).toISOString(), day: when?.day ?? null, date: when?.date ?? null, time: when?.time ?? null, atText: when?.text ?? null,
      actionCode: 'raise-voucher', actionLabel: `Payment voucher ${v.voucher_number} raised`, user: { username: null, displayName: 'System', roles: [], role: null },
      fromStatus: null, toStatus: null, remarks: null, changes: [{ field: 'voucherNumber', label: 'Payment voucher', before: null, after: v.voucher_number }],
      source: { channel: 'application', label: 'Application', name: null } };
  });
}

/** One entry for the same action of the same user within 2 seconds; the entry that moves the status is kept. */
export function collapseDuplicates(entries) {
  const out = [];
  for (const e of entries) {
    const at = new Date(e.at).getTime();
    const twin = out.find((x) => x.actionCode === e.actionCode && (x.user?.username || null) === (e.user?.username || null)
      && Math.abs(new Date(x.at).getTime() - at) <= DUPLICATE_MS);
    if (!twin) { out.push(e); continue; }
    if (!twin.toStatus && e.toStatus) {
      Object.assign(twin, { actionLabel: e.actionLabel, fromStatus: e.fromStatus, toStatus: e.toStatus, changes: e.changes.length ? e.changes : twin.changes,
        ...(e.approval ? { approval: e.approval } : {}) });
    }
  }
  return out;
}

/**
 * Activity log of a remittance (oldest first). Each entry keeps the fields of earlier releases (action, by, at,
 * notes) and adds the activity log entry (action label, user display name and roles, status from / to, remarks,
 * changes); a decision carries `approval` { level, requiredLevels, limitAtDecision, limitSource, limitSourceLabel,
 * reason }; voucher, batch and cheque entries name the record in `record`.
 */
export async function remittanceActivity(remittanceId, { viewer = null } = {}) {
  const labels = (await getSetting('remittance.status_labels', {})) || {};
  const fmt = await printFormat();
  const ctx = await decisionContext(viewer || { id: null });
  const names = await roleNames(ctx);
  const pay = await paymentRecords(remittanceId);
  const rows = await auditRows(remittanceId, pay);
  const decisions = await approvalDecisions(remittanceId);
  const records = new Map([
    ...pay.vouchers.map((v) => [`disbursement|${v.id}`, { type: 'Payment voucher', reference: v.voucher_number }]),
    ...pay.batches.map((b) => [`bank_payment_batch|${b.id}`, { type: 'Bank payment batch', reference: b.batch_number }]),
    ...pay.cheques.map((c) => [`checkbook|${c.id}`, { type: 'Cheque', reference: c.instrument_no }]),
  ]);
  const entries = await activityEntries(rows, { viewer, statusLabels: labels });
  const audited = entries.map((e, i) => {
    const r = rows[i];
    let entry;
    if (r.entity === 'remittance_approval' && r.after_data?.transactionType === 'Settlement') {
      entry = { ...e, actionCode: 'settle', actionLabel: `Settled by settlement ${r.after_data.referenceNo}`, fromStatus: labels.approved || 'Approved', toStatus: labels.settled || 'Settled',
        changes: [{ field: 'settlementNo', label: 'Settlement', before: null, after: r.after_data.referenceNo }] };
    } else if (isDecision(r)) {
      entry = { ...e, ...decisionFields(historyOf(decisions, r), r, ctx, names, labels) };
    } else if (r.entity === 'remittance' && r.action === 'import') {
      entry = { ...e, actionLabel: `Imported from ${r.after_data?.importNo || 'a policy list'}`, fromStatus: null, toStatus: labels.draft || 'Draft',
        remarks: r.after_data?.offCycleReason ? `Off-cycle: ${r.after_data.offCycleReason}` : e.remarks,
        changes: [{ field: 'importNo', label: 'Import', before: null, after: r.after_data?.importNo || null }] };
    } else if (r.entity === 'remittance' && r.action === 'run') {
      const a = r.after_data || {};
      entry = { ...e, actionLabel: a.source === 'run-now' ? `Created by Run now (${a.scheduleCode || 'schedule'})` : `Created by the weekly run (${a.scheduleCode || 'schedule'})`,
        fromStatus: null, toStatus: labels.draft || 'Draft', remarks: a.offCycleReason ? `Off-cycle: ${a.offCycleReason}` : e.remarks,
        changes: [{ field: 'window', label: 'Window', before: null, after: a.window || null }] };
    } else if (r.entity === 'remittance_approval') {
      entry = { ...e, changes: approvalChanges(r.before_data, r.after_data) };
    } else {
      entry = { ...e, ...(records.has(`${r.entity}|${r.entity_id}`) ? { record: records.get(`${r.entity}|${r.entity_id}`) } : {}) };
    }
    return { action: entry.actionCode, by: r.username, notes: entry.remarks, ...entry };
  });
  // decisions kept on the approval history without an audit row (taken before the audit trail named them)
  const matched = new Set(rows.filter(isDecision).map((r) => historyOf(decisions, r)).filter(Boolean));
  const fromHistory = decisions.filter((d) => !matched.has(d)).map((d) => {
    const row = { action: d.action === 'Approved' ? 'approve' : 'reject', after_data: { status: d.action === 'Approved' && d.level < d.requiredLevels ? 'Pending' : d.action, level: d.level, requiredLevels: d.requiredLevels } };
    const when = instant(d.at, fmt);
    const f = decisionFields(d, row, ctx, names, labels);
    return { id: `h-${d.approvalId}-${d.at}`, at: new Date(d.at).toISOString(), day: when?.day ?? null, date: when?.date ?? null, time: when?.time ?? null, atText: when?.text ?? null,
      user: { username: d.username, displayName: d.displayName || 'System', roles: [], role: null }, source: { channel: 'application', label: 'Application', name: null },
      ...f, action: f.actionCode, by: d.username, notes: f.remarks };
  });
  const others = [...voucherEntries(pay.vouchers, fmt), ...(await emailEntries(remittanceId, fmt))].map((e) => ({ action: e.actionCode, by: e.user.username, notes: e.remarks, ...e }));
  const all = [...audited, ...fromHistory, ...others].sort((a, b) => new Date(a.at) - new Date(b.at));
  // the screen an action was taken on is a menu path: the log names jobs and e-mails only
  return collapseDuplicates(all).map((e) => (e.source?.channel === 'screen' ? { ...e, source: null } : e));
}

export const ACTIVITY_HEADER = ['Date', 'Time', 'User', 'Role', 'Action', 'Status', 'Remarks', 'Details'];

/** Activity entries as the rows of "Download log (XLSX)". */
export const activityRows = (entries) => entries.map((e) => [e.date || '', e.time || '', e.user?.displayName || '', e.user?.role || '', e.actionLabel || '',
  e.toStatus ? `${e.fromStatus || ''} → ${e.toStatus}`.trim() : '', e.remarks || '',
  [...(e.record ? [`${e.record.type} ${e.record.reference || ''}`.trim()] : []), ...(e.changes || []).map((c) => `${c.label}: ${c.before ? `${c.before} → ` : ''}${c.after ?? ''}`)].join('; ')]);
