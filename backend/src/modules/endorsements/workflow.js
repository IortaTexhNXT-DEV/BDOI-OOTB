/**
 * The broker-mediated endorsement flow (TIS-BRD-ENDT-02): raise -> submit for approval -> approve (maker-checker,
 * approve:policies, never the raiser) -> send to the insurer -> insurer confirmed (its endorsement number) -> book (a
 * user other than the raiser). Endorsement types of the Endorsement Types master (M12, ENDT-01) and their
 * applicability to the policy's line; the pro-rata term of a financial change (ENDT-03). Settings of migration 0482.
 */
import { many, query, withTransaction } from '../../db/pool.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { isoDate, today } from '../../lib/dates.js';
import { activeRecords, requiredReason } from '../ops-masters/records.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { endorsementStatusOut } from '../documents/statuses.js';

const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const yes = (v) => v === true || ['true', 'yes', '1', 'y'].includes(String(v).toLowerCase());
/** Statuses in which the insurer holds the endorsement request. */
export const WITH_INSURER = ['submitted', 'cancel-initiated'];

/** Whether money goes back to the client: a return premium or a cancellation. */
export const returnsMoney = (e) => Number(e.premium_delta) < 0 || Boolean(e.is_cancel);

/** The Endorsement Types master rows that apply to a line of business (lines "*" or listing the line). */
export async function typesForLine(db, lob) {
  const line = String(lob || '').toUpperCase();
  const nonFinancial = (await getSetting('endorsements.non_financial_lines', ['LIFE'])) || [];
  return (await activeRecords(db, 'endorsement-type'))
    .map((r) => ({ code: r.code, name: r.name, financial: yes(r.financial), premiumImpact: yes(r.premiumImpact), section: r.section || 'other',
      lines: String(r.lines || '*').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean), sortOrder: Number(r.sortOrder) || 0 }))
    .filter((t) => t.lines.includes('*') || t.lines.includes(line))
    .filter((t) => !(nonFinancial.includes(line) && (t.financial || t.premiumImpact)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/**
 * The endorsement types chosen for a policy, checked against the master: each active and applicable to the policy's
 * line (a line of endorsements.non_financial_lines takes no financial type: Credit Life). Returns the stored form.
 */
export async function resolveTypes(db, policy, codes) {
  const list = (Array.isArray(codes) ? codes : [codes]).map((c) => String(c || '').trim()).filter(Boolean);
  if (!list.length) return [];
  const allowed = await typesForLine(db, policy.lob);
  const out = [];
  for (const code of [...new Set(list)]) {
    const t = allowed.find((x) => x.code.toLowerCase() === code.toLowerCase());
    if (!t) throw badRequest('Validation failed', [{ path: 'endorsementTypeCodes', message: `Endorsement type ${code} does not apply to a ${String(policy.lob || '').toLowerCase()} policy` }]);
    out.push({ code: t.code, name: t.name, section: t.section, financial: t.financial, premiumImpact: t.premiumImpact });
  }
  return out;
}

/**
 * Pro-rata term of a financial change effective on `effective` (ENDT-03): the unexpired days over the days of the
 * policy period. factor 1 when endorsements.prorata is off. The effective date lies within the period.
 */
export async function prorataTerm(policy, effective) {
  const inception = isoDate(policy.inception_date);
  const expiry = isoDate(policy.expiry_date);
  const on = isoDate(effective) || (await today());
  if (!(await getSetting('endorsements.prorata', true)) || !inception || !expiry) return { basis: 'annual', factor: 1, effectiveDate: on };
  if (on < inception || on >= expiry) {
    throw badRequest('Validation failed', [{ path: 'effectiveDate', message: `The effective date must be within the policy period (${inception} to ${expiry})` }]);
  }
  const termDays = Math.max(1, days(inception, expiry));
  const unexpiredDays = days(on, expiry);
  return { basis: 'pro-rata', effectiveDate: on, termDays, unexpiredDays, factor: Math.round((unexpiredDays / termDays) * 1e6) / 1e6 };
}

/** The workflow of an endorsement for the user: what the detail screen offers. */
export async function workflowOf(e, user) {
  const approval = await getSetting('endorsements.approval_before_send', true);
  const makerChecker = await getSetting('endorsements.complete_maker_checker', true);
  const mine = Boolean(user && e.created_by === user.id);
  const canWrite = Boolean(user && hasPermission(user, 'write:endorsements'));
  const canApprove = Boolean(user && hasPermission(user, 'approve:policies'));
  return {
    approvalRequired: approval,
    canSubmit: approval && canWrite && e.status === 'draft',
    canApprove: e.status === 'for-approval' && canApprove && !mine,
    canSend: canWrite && (approval ? e.status === 'approved' : e.status === 'draft'),
    canComplete: canWrite && WITH_INSURER.includes(e.status) && !(makerChecker && mine),
    makerOwn: mine,
  };
}

const typesRequired = async (db, e, lob) => (await getSetting('endorsements.types_required', true)) && (await typesForLine(db, lob)).length > 0
  && !(e.endorsement_type_codes || []).length;

/**
 * Draft -> PendingApproval: the endorsement goes to the approvers (approve:policies). It carries its endorsement types
 * (endorsements.types_required) and, for a cancellation, its note (endorsements.cancellation_note_required).
 */
export async function submitForApproval(e, user) {
  if (!(await getSetting('endorsements.approval_before_send', true))) throw badRequest('Endorsements are sent to the insurer without an approval step');
  if (e.status !== 'draft') throw badRequest(`A ${endorsementStatusOut(e.status)} endorsement cannot be submitted for approval`);
  if (await typesRequired({ query }, e, e.lob)) throw badRequest('Choose the endorsement types before submitting the endorsement');
  await query("UPDATE endorsements SET status = 'for-approval', submitted_at = now(), submitted_by = $2, updated_by = $2, updated_at = now() WHERE id = $1", [e.id, user.id]);
  await notifyApprovers({ audience: 'approve:policies', document: e.is_cancel ? 'Cancellation' : 'Endorsement', number: e.endorsement_number, by: user.username,
    detail: `${e.policy_number}, ${Number(e.premium_delta).toFixed(2)}`, link: `/agent/endorsementdetailedview/${e.id}`, entity: 'endorsement', entityId: e.id });
}

/**
 * PendingApproval -> Approved, or Rejected with a reason code of endorsement_reject: approve:policies, never the user
 * who raised it; a return premium or cancellation within the approver's Authority Matrix limit (return_premium).
 */
export async function decide(e, { decision, reasonCode = null, note = null }, user) {
  if (!['approve', 'reject'].includes(decision)) throw badRequest('decision must be approve or reject');
  if (!hasPermission(user, 'approve:policies')) throw forbidden('Requires permission: approve:policies');
  if (e.status !== 'for-approval') throw badRequest(`Endorsement ${e.endorsement_number} is not waiting for approval (${endorsementStatusOut(e.status)})`);
  if (e.created_by === user.id) throw forbidden('Maker-checker: the user who raised the endorsement cannot approve or reject it');
  let reason = null;
  await withTransaction(async (db) => {
    if (decision === 'approve') {
      if (returnsMoney(e)) {
        const { assertAuthority } = await import('../access-control/service.js');
        await assertAuthority(db, user, 'return_premium', Math.abs(Number(e.premium_delta)));
      }
      await db.query("UPDATE endorsements SET status = 'approved', approved_at = now(), approved_by = $2, updated_by = $2, updated_at = now() WHERE id = $1", [e.id, user.id]);
      return;
    }
    reason = await requiredReason(db, 'endorsement_reject', { reasonCode, note });
    await db.query(`UPDATE endorsements SET status = 'rejected', rejected_at = now(), rejected_by = $2, rejection_reason_code = $3, rejection_reason = $4, updated_by = $2,
      updated_at = now() WHERE id = $1`, [e.id, user.id, reason.code, reason.text]);
  });
  await notifyDecision({ userId: e.created_by, decidedBy: user.id, document: e.is_cancel ? 'Cancellation' : 'Endorsement', number: e.endorsement_number,
    approved: decision === 'approve', by: user.username, reason: reason?.text || null, link: `/agent/endorsementdetailedview/${e.id}`, entity: 'endorsement', entityId: e.id });
  return reason;
}

/** The send step: an approved endorsement (endorsements.approval_before_send), else a draft as before. */
export async function assertSendable(e) {
  const approval = await getSetting('endorsements.approval_before_send', true);
  const allowed = approval ? ['approved', ...WITH_INSURER] : ['draft', ...WITH_INSURER];
  if (allowed.includes(e.status)) return;
  if (approval && ['draft', 'for-approval'].includes(e.status)) {
    throw badRequest(`Endorsement ${e.endorsement_number} is sent to the insurer once approved by a second user`);
  }
  throw badRequest(`A ${endorsementStatusOut(e.status)} endorsement cannot be sent`);
}

/**
 * The booking step on screen: the insurer holds the request and has confirmed it with its endorsement number
 * (endorsements.complete_needs_insurer), and the user booking it did not raise it (endorsements.complete_maker_checker).
 */
export async function assertBookable(e, body, user) {
  if (await getSetting('endorsements.complete_needs_insurer', true)) {
    if (!WITH_INSURER.includes(e.status)) throw badRequest(`Endorsement ${e.endorsement_number} is booked once it has been sent to the insurer (${endorsementStatusOut(e.status)})`);
    if (!String(body.endorsementNumber || '').trim()) {
      throw badRequest('Validation failed', [{ path: 'endorsementNumber', message: "Enter the insurer's endorsement number: no endorsement is booked without the insurer's confirmation" }]);
    }
  }
  if (await getSetting('endorsements.complete_maker_checker', true) && e.created_by === user.id) {
    throw forbidden(`Maker-checker: endorsement ${e.endorsement_number} is booked by a user other than the one who raised it`);
  }
}

/** The endorsement types of the line of a policy, for the screen. */
export const typesOfPolicy = async (policy) => typesForLine({ query }, policy.lob);

/** Policy versions: the policy as issued and after each booked endorsement (ENDT-03), oldest first. */
export async function policyVersions(policy) {
  const rows = await many(`SELECT id, endorsement_number, endorsement_type, endorsement_type_codes, effective_date, premium_delta, completion, completed_at, status
    FROM endorsements WHERE policy_id = $1 AND status IN ('completed', 'cancelled') ORDER BY completed_at, endorsement_number`, [policy.id]);
  return rows.map((r, i) => ({ version: i + 2, endorsementId: r.id, endorsementNumber: r.endorsement_number, types: r.endorsement_type_codes || [], effectiveDate: r.effective_date,
    premiumDelta: Number(r.premium_delta), bookedAt: r.completed_at, before: r.completion?.policyBefore || null, after: r.completion?.policyAfter || null }));
}
