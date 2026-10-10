/**
 * Receipt reversal with a checker (PBSM-M17v4-REVERSALS, TIS-BRD-COLL-06; migration 0524). A holder of
 * reverse:receipts asks for the reversal of a receipt with a reason (context receipt_reversal). With
 * receipts.reversal_requires_approval the receipt waits, still posted, for a holder of approve:receipt-reversal who did
 * not ask for it: approved, the receipt is cancelled (cancelReceipt: its payment journals reversed, the bills
 * re-opened); returned, with a reason (context receipt_reversal_reject), it stays as it was. Without the setting the
 * receipt is cancelled at once.
 */
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney } from '../../lib/money.js';
import { notify } from '../notifications/service.js';
import { requiredReason } from '../ops-masters/records.js';
import { cancelReceipt, getReceipt } from './service.js';

export const APPROVE = 'approve:receipt-reversal';
const link = (id) => `/accounts/receipts/receiptdetailview?receipt=${encodeURIComponent(id)}`;

async function lockReceipt(db, id) {
  const r = (await db.query('SELECT * FROM receipts WHERE id = $1 OR receipt_number = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!r) throw notFound('Receipt not found');
  return r;
}

/** Ask for the reversal of a receipt (b: { reasonCode, note }); cancelled at once when no checker is required. */
export async function requestReversal(db, id, b, user) {
  const r = await lockReceipt(db, id);
  if (r.receipt_status === 'Cancelled') throw conflict(`Receipt ${r.receipt_number} is already cancelled`);
  if (r.reversal_status === 'pending') throw conflict(`The reversal of receipt ${r.receipt_number} is already waiting for approval`);
  const reason = await requiredReason(db, 'receipt_reversal', { reasonCode: b.reasonCode, note: b.note });
  const before = await getReceipt(db, r.id);
  if (!(await getSetting('receipts.reversal_requires_approval', true))) {
    await db.query(`UPDATE receipts SET reversal_status = 'approved', reversal_reason_code = $2, reversal_reason = $3, reversal_requested_by = $4,
      reversal_requested_at = now(), reversal_decided_by = $4, reversal_decided_at = now(), reversal_return_reason = NULL WHERE id = $1`, [r.id, reason.code, reason.text, user.id]);
    const done = await cancelReceipt(db, r.id, reason.text, user);
    return { before, after: done.after, action: 'reverse', message: `Receipt ${r.receipt_number} reversed` };
  }
  await db.query(`UPDATE receipts SET reversal_status = 'pending', reversal_reason_code = $2, reversal_reason = $3, reversal_requested_by = $4, reversal_requested_at = now(),
    reversal_decided_by = NULL, reversal_decided_at = NULL, reversal_return_reason = NULL, updated_by = $4, updated_at = now() WHERE id = $1`, [r.id, reason.code, reason.text, user.id]);
  await notify({ type: 'approval', title: `Reversal of receipt ${r.receipt_number} to approve`, audience: APPROVE,
    message: `${r.customer_name || 'Client'}: ${await formatMoney(r.amount)}, ${reason.text}.`, link: link(r.id), entity: 'receipt', entityId: r.id });
  return { before, after: await getReceipt(db, r.id), action: 'reversal-request', message: `Reversal of receipt ${r.receipt_number} sent for approval` };
}

/** Approve or return a reversal request (b: { action: approve | return, reasonCode, note }); never by the requester. */
export async function decideReversal(db, id, b, user) {
  const r = await lockReceipt(db, id);
  if (r.reversal_status !== 'pending') throw conflict(`Receipt ${r.receipt_number} has no reversal waiting for approval`);
  if (r.reversal_requested_by === user.id) throw forbidden('Maker-checker: the reversal must be approved by a different user from the one who requested it');
  const before = await getReceipt(db, r.id);
  if (b.action === 'return') {
    const reason = await requiredReason(db, 'receipt_reversal_reject', { reasonCode: b.reasonCode, note: b.note });
    await db.query(`UPDATE receipts SET reversal_status = 'returned', reversal_decided_by = $2, reversal_decided_at = now(), reversal_return_reason = $3, updated_by = $2,
      updated_at = now() WHERE id = $1`, [r.id, user.id, reason.text]);
    if (r.reversal_requested_by) {
      await notify({ userId: r.reversal_requested_by, type: 'info', title: `Reversal of receipt ${r.receipt_number} returned`, message: reason.text, link: link(r.id),
        entity: 'receipt', entityId: r.id });
    }
    return { before, after: await getReceipt(db, r.id), action: 'reversal-return', message: `Reversal of receipt ${r.receipt_number} returned` };
  }
  await db.query('UPDATE receipts SET reversal_status = \'approved\', reversal_decided_by = $2, reversal_decided_at = now() WHERE id = $1', [r.id, user.id]);
  const done = await cancelReceipt(db, r.id, r.reversal_reason, user);
  return { before, after: done.after, action: 'reverse', message: `Receipt ${r.receipt_number} reversed` };
}

