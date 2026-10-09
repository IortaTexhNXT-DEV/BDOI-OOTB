/**
 * Customer responses recorded by staff. A customer who answers by phone, Viber, in a meeting or on a signed form
 * (rather than through the e-mailed approval link) has the answer recorded with its evidence; the quotation moves
 * to the status configured for the outcome (quotations.customer_response_status), within quotations.transitions.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { quoteStatusIn, quoteStatusOut } from '../documents/statuses.js';
import { findDocument, safeKey } from '../uploads/storage.js';
import { notify } from '../notifications/service.js';
import { getQuoteRow } from './service.js';

export const OUTCOMES = ['accepted', 'declined', 'revise'];
const DEFAULT_STATUS = { accepted: 'CustomerAccepted', declined: 'Rejected', revise: 'Draft' };

export async function responseChannels() {
  const list = await getSetting('quotations.customer_response_channels', []);
  return Array.isArray(list) ? list.map(String) : [];
}

const toResponse = (r) => ({
  id: Number(r.id), quotationId: r.quote_id, outcome: r.outcome, channel: r.channel, responseDate: r.response_date,
  reference: r.reference, remarks: r.remarks, attachmentKey: r.attachment_key, attachmentName: r.attachment_name,
  fromStatus: quoteStatusOut(r.from_status), toStatus: quoteStatusOut(r.to_status),
  recordedBy: r.recorded_by_name || r.recorded_by, createdAt: r.created_at,
});

export async function listResponses(quoteId) {
  const q = await getQuoteRow(quoteId);
  const rows = await many(`SELECT r.*, u.display_name AS recorded_by_name FROM quote_customer_responses r
    LEFT JOIN users u ON u.id = r.recorded_by WHERE r.quote_id = $1 ORDER BY r.created_at DESC, r.id DESC`, [q.id]);
  return rows.map(toResponse);
}

/**
 * Record the customer's answer and move the quotation. body: { outcome, channel, responseDate, reference, remarks,
 * attachmentKey, attachmentName }. Returns { before, after, response }.
 */
export async function recordResponse(quoteId, body, user) {
  const q = await getQuoteRow(quoteId);
  const channels = await responseChannels();
  if (channels.length && !channels.some((c) => c.toLowerCase() === String(body.channel).toLowerCase())) {
    throw badRequest(`Channel must be one of: ${channels.join(', ')}`, [{ path: 'channel', message: 'Unknown channel' }]);
  }
  if (body.responseDate > await today()) throw badRequest('The response date cannot be in the future', [{ path: 'responseDate', message: 'Future date' }]);
  if (body.attachmentKey && !(await findDocument(body.attachmentKey))) {
    throw badRequest('The attachment was not found; upload it again', [{ path: 'attachmentKey', message: 'Unknown file' }]);
  }

  const mapping = { ...DEFAULT_STATUS, ...((await getSetting('quotations.customer_response_status', {})) || {}) };
  const target = quoteStatusIn(mapping[body.outcome]);
  if (!target) throw badRequest(`No quotation status is configured for the response "${body.outcome}"`);
  const from = quoteStatusOut(q.status);
  const to = quoteStatusOut(target);
  const transitions = (await getSetting('quotations.transitions', {})) || {};
  if (!(transitions[from] || []).includes(to)) throw badRequest(`A ${from} quotation cannot be moved to ${to} by a customer response`);

  const response = await withTransaction(async (db) => {
    const locked = (await db.query('SELECT status FROM quotes WHERE id = $1 FOR UPDATE', [q.id])).rows[0];
    if (locked.status !== q.status) throw badRequest('The quotation was changed by another user; reload it and try again');
    // accepted: the same stamp the approval link sets; revise: the link sent for the old terms stops working
    const stamps = { accepted: ', customer_accepted_at = now()', draft: ', approval_token = NULL, approval_token_hash = NULL' };
    await db.query(`UPDATE quotes SET status = $2, updated_by = $3, updated_at = now()${stamps[target] || ''} WHERE id = $1`, [q.id, target, user.id]);
    const r = await db.query(`INSERT INTO quote_customer_responses(quote_id, outcome, channel, response_date, reference, remarks, attachment_key,
      attachment_name, from_status, to_status, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [q.id, body.outcome, body.channel, body.responseDate, body.reference || null, body.remarks || null,
      body.attachmentKey ? safeKey(body.attachmentKey) : null, body.attachmentName || null, q.status, target, user.id]);
    return r.rows[0];
  });

  if (target === 'accepted' && q.created_by && q.created_by !== user.id) {
    await notify({ userId: q.created_by, type: 'task', title: 'Customer accepted quotation', message: `The customer accepted quotation ${q.quote_number} (${body.channel}); you can proceed to policy`,
      link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
  }
  const { autoRaisePlacement } = await import('../placement/placements.js');
  const placement = target === 'accepted' ? await autoRaisePlacement(q.id, user) : null;
  const recordedBy = await one('SELECT display_name FROM users WHERE id = $1', [user.id]);
  return { before: q, after: await getQuoteRow(q.id), response: toResponse({ ...response, recorded_by_name: recordedBy?.display_name }), placement };
}
