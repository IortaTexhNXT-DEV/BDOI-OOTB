/**
 * Approval of the data loads and of their undo, by a second user (maker-checker, never switched off: the setting
 * finance.maker_checker_enabled does not apply).
 *
 * Load: the uploader (or another holder of write:data-load) submits a validated batch; a holder of approve:data-load
 * who is neither its uploader, its submitter nor a user who resolved one of its duplicates approves it, which starts the
 * load job as the approver, or rejects it with a reason of the Reason Codes master (context data_load_reject). What is
 * approved is the batch as validated: the approval is refused when the file, the value maps or the cutover date changed
 * since the validation ("validate again"), or after migration.approval_expiry_hours (the sweep expires it). The
 * submitter may withdraw it. A second approval of the same batch finds it running (409): a load runs at most once.
 *
 * Undo (migration loads, before the go-live lock): requested with a reason by a holder of write:data-load, approved by
 * another user (approve:data-load), which starts the undo job, or rejected; the requester may withdraw it.
 *
 * Approvers are notified on submit and on an undo request (notification and My Work, category Approvals), the maker on
 * the decision and at the end of the job.
 */
import { many, one, pool } from '../../db/pool.js';
import { badRequest, conflict, forbidden } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { requiredReason } from '../ops-masters/records.js';
import * as svc from './service.js';
import { startJob } from './jobs.js';
import { assertUndoable } from './undo.js';

export const APPROVE = 'approve:data-load';
export const REJECT_CONTEXT = 'data_load_reject';
const linkOf = (id) => `/master/configuration/go-live/loads/${id}`;
const KIT_LABELS = { migration: 'Migration workbook', configuration: 'Configuration workbook' };

/**
 * Refuse a decision on a load by one of its makers (403): the uploader, the submitter and every user who resolved one
 * of its duplicates.
 */
async function assertNotMaker(user, batch) {
  for (const maker of [batch.createdById, batch.submittedById]) await assertChecker(user, maker, 'load', { configurable: false });
  const resolved = await one('SELECT 1 AS x FROM data_load_rows WHERE batch_id = $1 AND resolved_by = $2 LIMIT 1', [batch.id, user.id]);
  if (resolved) throw forbidden(`Maker-checker: you resolved duplicates of ${batch.loadNumber}; another user decides on the load`);
}

/**
 * Users who may not decide on a load or on its undo, for the screen to show the rule before the click: load (the
 * uploader, the submitter and the users who resolved one of its duplicates) and undo (the requester).
 */
export async function makersOf(batch) {
  const resolvers = await many('SELECT DISTINCT resolved_by FROM data_load_rows WHERE batch_id = $1 AND resolved_by IS NOT NULL', [batch.id]);
  return {
    load: [...new Set([batch.createdById, batch.submittedById, ...resolvers.map((r) => r.resolved_by)].filter(Boolean))],
    undo: batch.undoRequestedById ? [batch.undoRequestedById] : [],
  };
}

/** Submit a validated batch (validRowsOnly: a batch with rows in error, the valid rows only) for approval. */
export async function submit(id, user, { validRowsOnly = false, req = null } = {}) {
  const batch = await svc.getBatch(id);
  if (!['validated', 'failed'].includes(batch.status) || (batch.status === 'failed' && !batch.validatedAt)) throw conflict(svc.statusConflict(batch));
  await svc.assertLoadable(batch, { validRowsOnly, req });
  const hours = Math.max(1, Number(await getSetting('migration.approval_expiry_hours', 72)) || 72);
  const moved = await svc.moveBatch(batch.id, ['validated', 'failed'], 'pending-approval', { submitted_by: user.id, submitted_at: new Date(),
    expires_at: new Date(Date.now() + hours * 3600000), valid_rows_only: !!validRowsOnly, decided_by: null, decided_at: null, decision: null, decision_reason_code: null,
    decision_remarks: null, message: null });
  if (!moved) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  const b = await svc.getBatch(id);
  await audit(req, { entity: 'data_load_batch', entityId: b.id, action: 'submit', after: { loadNumber: b.loadNumber, kit: b.kit, rowsValid: b.rowsValid, validRowsOnly: !!validRowsOnly, expiresAt: b.expiresAt } });
  await notifyApprovers({ audience: APPROVE, document: 'Data load', number: b.loadNumber, by: user.username, detail: `${KIT_LABELS[b.kit]}, ${b.rowsValid} rows`,
    link: linkOf(b.id), entity: 'data_load_batch', entityId: b.id });
  return b;
}

/** Withdraw a load waiting for approval (its submitter or uploader). */
export async function withdraw(id, user, { req = null } = {}) {
  const batch = await svc.getBatch(id);
  if (batch.status !== 'pending-approval') throw conflict(svc.statusConflict(batch));
  if (![batch.submittedById, batch.createdById].includes(user.id)) throw forbidden('Only the user who submitted the load or uploaded it can withdraw it');
  if (!await svc.moveBatch(batch.id, 'pending-approval', 'withdrawn', { expires_at: null })) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'withdraw', after: { loadNumber: batch.loadNumber } });
  return svc.getBatch(id);
}

/** Approve a load waiting for approval: the load job starts as the approver. Returns { batch, job }. */
export async function approve(id, user, { req = null } = {}) {
  const batch = await svc.getBatch(id);
  if (batch.status !== 'pending-approval') throw conflict(svc.statusConflict(batch));
  await assertNotMaker(user, batch);
  if (batch.expiresAt && new Date(batch.expiresAt) < new Date()) {
    await svc.moveBatch(batch.id, 'pending-approval', 'expired', { message: 'Not approved in time: validate the load again and submit it' });
    throw conflict(`Load ${batch.loadNumber} was not approved in time: validate it again and submit it`);
  }
  await svc.assertLoadable(batch, { validRowsOnly: batch.validRowsOnly, req });
  const moved = await svc.moveBatch(batch.id, 'pending-approval', 'running', { decided_by: user.id, decided_at: new Date(), decision: 'approved', message: null, job_id: null });
  if (!moved) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  const job = await startJob('load', batch, user, { validRowsOnly: batch.validRowsOnly });
  await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'approve', after: { loadNumber: batch.loadNumber, jobId: job.id } });
  await notifyDecision({ userId: batch.submittedById, decidedBy: user.id, document: 'Data load', number: batch.loadNumber, approved: true, by: user.username,
    message: `Approved by ${user.username}: the load is running`, link: linkOf(batch.id), entity: 'data_load_batch', entityId: batch.id });
  return { batch: await svc.getBatch(id), job };
}

/** Reject a load waiting for approval with a reason (context data_load_reject) and remarks. */
export async function reject(id, user, { reasonCode, remarks, req = null } = {}) {
  const batch = await svc.getBatch(id);
  if (batch.status !== 'pending-approval') throw conflict(svc.statusConflict(batch));
  await assertNotMaker(user, batch);
  const reason = await requiredReason(pool, REJECT_CONTEXT, { reasonCode, note: remarks });
  const moved = await svc.moveBatch(batch.id, 'pending-approval', 'rejected', { decided_by: user.id, decided_at: new Date(), decision: 'rejected',
    decision_reason_code: reason.code, decision_remarks: reason.text, expires_at: null });
  if (!moved) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'reject', after: { loadNumber: batch.loadNumber, reasonCode: reason.code, reason: reason.text } });
  await notifyDecision({ userId: batch.submittedById, decidedBy: user.id, document: 'Data load', number: batch.loadNumber, approved: false, by: user.username,
    reason: reason.text, link: linkOf(batch.id), entity: 'data_load_batch', entityId: batch.id });
  return svc.getBatch(id);
}

// ------------------------------------------------------------------ undo

/** Request the undo of a loaded migration batch, with a reason. */
export async function requestUndo(id, user, { reason, req = null } = {}) {
  const why = String(reason || '').trim();
  if (!why) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason of the undo' }]);
  const batch = await svc.getBatch(id);
  await assertUndoable(batch, { req });
  const moved = await svc.moveBatch(batch.id, 'loaded', 'undo-pending', { undo_requested_by: user.id, undo_requested_at: new Date(), undo_reason: why.slice(0, 500), message: null });
  if (!moved) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'undo-request', after: { loadNumber: batch.loadNumber, reason: why } });
  await notifyApprovers({ audience: APPROVE, document: 'Undo of data load', number: batch.loadNumber, by: user.username, detail: why.slice(0, 120),
    link: linkOf(batch.id), entity: 'data_load_batch', entityId: batch.id });
  return svc.getBatch(id);
}

/** Approve the undo of a batch: the undo job starts as the approver (another user than the requester). Returns { batch, job }. */
export async function approveUndo(id, user, { req = null } = {}) {
  const batch = await svc.getBatch(id);
  if (batch.status !== 'undo-pending') throw conflict(svc.statusConflict(batch));
  await assertChecker(user, batch.undoRequestedById, 'undo', { configurable: false });
  await assertUndoable(batch, { req, statuses: ['undo-pending'] });
  const moved = await svc.moveBatch(batch.id, 'undo-pending', 'undoing', { message: null, job_id: null });
  if (!moved) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  const job = await startJob('undo', batch, user);
  await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'undo-approve', after: { loadNumber: batch.loadNumber, jobId: job.id } });
  return { batch: await svc.getBatch(id), job };
}

/** Reject the undo of a batch (remarks required): the load stays. */
export async function rejectUndo(id, user, { remarks, req = null } = {}) {
  const note = String(remarks || '').trim();
  if (!note) throw badRequest('Validation failed', [{ path: 'remarks', message: 'Give the reason of the rejection' }]);
  const batch = await svc.getBatch(id);
  if (batch.status !== 'undo-pending') throw conflict(svc.statusConflict(batch));
  await assertChecker(user, batch.undoRequestedById, 'undo', { configurable: false });
  if (!await svc.moveBatch(batch.id, 'undo-pending', 'loaded', { message: `Undo rejected: ${note.slice(0, 300)}` })) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'undo-reject', after: { loadNumber: batch.loadNumber, remarks: note } });
  await notifyDecision({ userId: batch.undoRequestedById, decidedBy: user.id, document: 'Undo of data load', number: batch.loadNumber, approved: false, by: user.username,
    reason: note, link: linkOf(batch.id), entity: 'data_load_batch', entityId: batch.id });
  return svc.getBatch(id);
}

/** Withdraw an undo request (its requester). */
export async function withdrawUndo(id, user, { req = null } = {}) {
  const batch = await svc.getBatch(id);
  if (batch.status !== 'undo-pending') throw conflict(svc.statusConflict(batch));
  if (batch.undoRequestedById !== user.id) throw forbidden('Only the user who requested the undo can withdraw it');
  if (!await svc.moveBatch(batch.id, 'undo-pending', 'loaded', { undo_requested_by: null, undo_requested_at: null, undo_reason: null })) throw conflict(svc.statusConflict(await svc.getBatch(id)));
  await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'undo-withdraw', after: { loadNumber: batch.loadNumber } });
  return svc.getBatch(id);
}

