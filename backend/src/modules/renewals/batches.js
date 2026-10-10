/** Renewal batches (Operations > Renewals > Renewal Batch): selection, queued notice sending, retry and report. */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { round2 } from '../claims/util.js';
import { enqueue, registerJobType } from './queue.js';
import { ensureRenewal, generateQuote, renewablePolicies, sendNotice } from './service.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { LOCK_IN_COLUMNS, gateContext, gatedPolicies, treatmentOf } from './noticeGate.js';

export const QUEUE = 'renewal-notices';
export const JOB_TYPE = 'renewal-batch-notices';
export const QUOTE_JOB_TYPE = 'renewal-batch-quotes';

const POLICY_COLS = `bp.*, p.policy_number, p.expiry_date, p.premium_total, p.status AS policy_status, p.lob, p.product_type, cl.display_name AS client_name, cl.email AS client_email,
  ic.name AS insurer_name, pr.name AS product_name, pr.line AS product_line, ${LOCK_IN_COLUMNS},
  (SELECT COALESCE(sum(rv.balance), 0) FROM receivables rv WHERE rv.policy_id = p.id AND rv.balance > 0 AND rv.status NOT IN ('paid','written-off'))::numeric AS unpaid`;
const POLICY_FROM = `FROM renewal_batch_policies bp JOIN policies p ON p.id = bp.policy_id LEFT JOIN clients cl ON cl.id = p.client_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN policy_lock_ins lk ON lk.policy_id = p.id`;

const policyApi = (r, gate) => ({
  id: r.id, policyId: r.policy_id, renewalId: r.renewal_id, isSelected: r.is_selected, noticeStatus: r.notice_status, noticeSentAt: r.notice_sent_at,
  noticeTreatment: gate ? treatmentOf(r, gate) : null,
  error: r.error, attempts: r.attempts, createdAt: r.created_at,
  quoteStatus: r.quote_status, quoteNumber: r.quote_number, quotedPremium: r.quoted_premium, quotedAt: r.quoted_at,
  policy: {
    id: r.policy_id, policyNumber: r.policy_number, insuranceCompanyName: r.insurer_name, clientName: r.client_name, ClientName: r.client_name,
    productType: r.product_name, expiry: r.expiry_date, expiryDate: r.expiry_date, grossPremium: r.premium_total, status: r.policy_status,
    paymentStatus: r.unpaid > 0 ? 'Unpaid' : 'Paid', email: r.client_email,
  },
});
const batchApi = (b) => ({
  id: b.id, batchId: b.batch_number, batchNumber: b.batch_number, status: b.status, criteriaOption: b.criteria || {},
  totalPolicies: b.total_policies ?? 0, processedCount: b.sent_count ?? 0, sentCount: b.sent_count ?? 0, failedCount: b.failed_count ?? 0,
  queuedCount: b.queued_count ?? 0, notSentCount: b.not_sent_count ?? 0, skippedCount: b.skipped_count ?? 0, quotedCount: b.quoted_count ?? 0, selectedCount: b.selected_count ?? 0, createdBy: b.created_by, createdAt: b.created_at, updatedAt: b.updated_at, completedAt: b.completed_at,
});
const COUNTS = `(SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id)::int AS total_policies,
  (SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id AND x.notice_status = 'Sent')::int AS sent_count,
  (SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id AND x.notice_status = 'Failed')::int AS failed_count,
  (SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id AND x.notice_status = 'Queued')::int AS queued_count,
  (SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id AND x.notice_status = 'NotSent')::int AS not_sent_count,
  (SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id AND x.notice_status = 'Skipped')::int AS skipped_count,
  (SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id AND x.quote_status = 'Quoted')::int AS quoted_count,
  (SELECT count(*) FROM renewal_batch_policies x WHERE x.batch_id = b.id AND x.is_selected)::int AS selected_count`;

async function loadBatch(id) {
  const b = await one(`SELECT b.*, ${COUNTS} FROM renewal_batches b WHERE b.id = $1 OR b.batch_number = $1`, [String(id)]);
  if (!b) throw notFound('Renewal batch not found');
  return b;
}

/** Renewable policies matching the batch criteria (expiry range, insurer, product, premium range, client, payment status). */
async function policiesByCriteria(c = {}, limit) {
  const { all } = await renewablePolicies({ ...c, renewableOnly: 'true' }, { limit, offset: 0 });
  // a policy with a renewal already in progress stays with that renewal (it is not batched a second time)
  return all.filter((p) => p.renewalState !== 'in-progress').slice(0, limit).map((p) => ({ id: p.policyId }));
}

export async function createBatch(input, user) {
  const max = Number(await getSetting('renewals.batch_max_policies', 500));
  let ids = [];
  const refs = (input.policies || []).map((p) => (typeof p === 'string' ? p : p.policyId || p.policyNumber || p.id)).filter(Boolean);
  if (refs.length) {
    const found = await many('SELECT id, policy_number, status, renewed_to FROM policies WHERE id = ANY($1) OR policy_number = ANY($1)', [refs.map(String)]);
    const missing = refs.filter((r) => !found.some((f) => f.id === r || f.policy_number === r));
    if (missing.length) throw badRequest(`Unknown policies: ${missing.join(', ')}`);
    const done = found.filter((f) => f.renewed_to || ['renewed', 'cancelled'].includes(f.status));
    if (done.length) throw conflict(`Already renewed or cancelled: ${done.map((f) => f.policy_number).join(', ')}`);
    // only policies still renewable (before expiry, in the grace period or within the lapsed-renewal window)
    const { all } = await renewablePolicies({ expiryFrom: '1900-01-01', expiryTo: '2999-12-31' }, { limit: 100000, offset: 0 });
    const closed = found.filter((f) => !all.some((x) => x.policyId === f.id && x.canRenew));
    if (closed.length) throw conflict(`No longer renewable: ${closed.map((f) => f.policy_number).join(', ')}`);
    ids = [...new Set(found.map((f) => f.id))];
  } else {
    ids = (await policiesByCriteria(input.criteriaOption || {}, max)).map((p) => p.id);
  }
  if (!ids.length) throw badRequest('No policies selected for the batch');
  if (ids.length > max) throw badRequest(`A batch can hold at most ${max} policies`);
  const selected = new Set((input.policies || []).filter((p) => p && p.isSelected).map((p) => String(p.policyId || p.policyNumber || p.id)));
  const number = await nextDocumentNumber('renewal_batch', { unique: { table: 'renewal_batches', column: 'batch_number' } });
  const id = await withTransaction(async (db) => {
    const b = await db.query('INSERT INTO renewal_batches(batch_number, status, criteria, created_by) VALUES ($1,\'Draft\',$2,$3) RETURNING id', [number, JSON.stringify(input.criteriaOption || {}), user?.username ?? null]);
    for (const pid of ids) {
      const pol = await db.query('SELECT policy_number FROM policies WHERE id = $1', [pid]);
      const isSel = selected.has(pid) || selected.has(pol.rows[0].policy_number);
      await db.query('INSERT INTO renewal_batch_policies(batch_id, policy_id, is_selected) VALUES ($1,$2,$3)', [b.rows[0].id, pid, isSel]);
    }
    return b.rows[0].id;
  });
  return getBatch(id);
}

export async function listBatches(q, pg) {
  const where = [];
  const params = [];
  if (q.status) { params.push(q.status); where.push(`b.status = $${params.length}`); }
  if (q.search) { params.push(`%${q.search}%`); where.push(`b.batch_number ILIKE $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = { batchId: 'b.batch_number', status: 'b.status', createdAt: 'b.created_at' }[q.sortField] || 'b.created_at';
  const dir = ['asc', '1'].includes(String(q.sortOrder).toLowerCase()) ? 'ASC' : 'DESC';
  const total = (await one(`SELECT count(*)::int AS n FROM renewal_batches b ${w}`, params)).n;
  const rows = await many(`SELECT b.*, ${COUNTS} FROM renewal_batches b ${w} ORDER BY ${sortCol} ${dir}, b.batch_number ${dir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  return { total, items: rows.map(batchApi) };
}

export async function getBatch(id) {
  const b = await loadBatch(id);
  const policies = await many(`SELECT ${POLICY_COLS} ${POLICY_FROM} WHERE bp.batch_id = $1 ORDER BY p.expiry_date, p.policy_number`, [b.id]);
  const gate = await gateContext();
  return { ...batchApi(b), policies: policies.map((x) => policyApi(x, gate)) };
}

export async function batchPolicies(id, q, pg) {
  const b = await loadBatch(id);
  const params = [b.id];
  let w = 'bp.batch_id = $1';
  if (q.noticeStatus) { params.push(q.noticeStatus); w += ` AND bp.notice_status = $${params.length}`; }
  if (q.isSelected !== undefined) { params.push(String(q.isSelected) === 'true'); w += ` AND bp.is_selected = $${params.length}`; }
  const total = (await one(`SELECT count(*)::int AS n FROM renewal_batch_policies bp WHERE ${w}`, params)).n;
  const rows = await many(`SELECT ${POLICY_COLS} ${POLICY_FROM} WHERE ${w} ORDER BY p.expiry_date, p.policy_number LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  const gate = await gateContext();
  return { total, items: rows.map((x) => policyApi(x, gate)) };
}

export async function updateBatch(id, input) {
  const b = await loadBatch(id);
  if (b.status === 'Processing') throw conflict('Batch is processing; wait until it completes');
  if (input.status && !['Draft', 'Cancelled', 'Completed'].includes(input.status)) throw badRequest('status must be Draft, Cancelled or Completed');
  await query('UPDATE renewal_batches SET criteria = COALESCE($2, criteria), status = COALESCE($3, status), updated_at = now() WHERE id = $1',
    [b.id, input.criteriaOption ? JSON.stringify(input.criteriaOption) : null, input.status || null]);
  return { before: batchApi(b), after: await getBatch(b.id) };
}

export async function deleteBatch(id) {
  const b = await loadBatch(id);
  if (b.sent_count || b.queued_count || b.status === 'Processing') throw conflict('Notices were already sent from this batch; cancel it instead');
  await query('DELETE FROM renewal_batches WHERE id = $1', [b.id]);
  return batchApi(b);
}

export async function setSelection(id, policyRef, isSelected) {
  const b = await loadBatch(id);
  const r = await one(`UPDATE renewal_batch_policies bp SET is_selected = $3 FROM policies p
    WHERE bp.batch_id = $1 AND p.id = bp.policy_id AND (p.id = $2 OR p.policy_number = $2 OR bp.id::text = $2) RETURNING bp.id`, [b.id, String(policyRef), Boolean(isSelected)]);
  if (!r) throw notFound('Policy is not in this batch');
  return (await getBatch(b.id)).policies.find((p) => p.id === r.id);
}

/**
 * Queue notices for the selected policies (NotSent only); processed by the renewal-batch-notices job. A policy whose
 * notices are suppressed or held (notice gate) is not queued: its line is Skipped with the reason (FR-LCK-012).
 */
export async function queueNotices(id, policyRefs, user) {
  const b = await loadBatch(id);
  if (b.status === 'Cancelled') throw conflict('Batch is cancelled');
  const refs = (policyRefs || []).map(String);
  if (!refs.length) throw badRequest('Select at least one policy to send renewal notices');
  const lines = await many(`SELECT bp.id, bp.policy_id FROM renewal_batch_policies bp JOIN policies p ON p.id = bp.policy_id
    WHERE bp.batch_id = $1 AND (p.id = ANY($2) OR p.policy_number = ANY($2) OR bp.id::text = ANY($2)) AND bp.notice_status = 'NotSent'`, [b.id, refs]);
  if (!lines.length) throw conflict('None of the selected policies is waiting for a notice');
  const gated = await gatedPolicies(lines.map((l) => l.policy_id));
  for (const l of lines.filter((x) => gated.has(x.policy_id))) {
    const t = gated.get(l.policy_id);
    await query('UPDATE renewal_batch_policies SET is_selected = true, notice_status = \'Skipped\', error = $2 WHERE id = $1', [l.id, `${t.label}: ${t.reason}`]);
  }
  const queued = lines.filter((x) => !gated.has(x.policy_id)).map((x) => x.id);
  if (!queued.length) {
    await settleBatch(b.id);
    return { jobId: null, queued: 0, skipped: lines.length, batchId: b.batch_number };
  }
  await query('UPDATE renewal_batch_policies SET is_selected = true, notice_status = \'Queued\', error = NULL WHERE id = ANY($1)', [queued]);
  return { ...(await startJob(b, queued, user)), skipped: lines.length - queued.length };
}

export async function retryFailed(id, user) {
  const b = await loadBatch(id);
  const rows = await many('UPDATE renewal_batch_policies SET notice_status = \'Queued\', error = NULL WHERE batch_id = $1 AND notice_status = \'Failed\' RETURNING id', [b.id]);
  if (!rows.length) throw conflict('There are no failed notices to retry');
  return startJob(b, rows.map((r) => r.id), user);
}

/** Queue re-rated renewal quotes for the selected policies (not yet quoted); processed by the renewal-batch-quotes job. */
export async function queueQuotes(id, policyRefs, user) {
  const b = await loadBatch(id);
  if (b.status === 'Cancelled') throw conflict('Batch is cancelled');
  const refs = (policyRefs || []).map(String);
  if (!refs.length) throw badRequest('Select at least one policy to prepare renewal quotes');
  const rows = await many(`UPDATE renewal_batch_policies bp SET is_selected = true, quote_status = 'Queued', error = NULL FROM policies p
    WHERE bp.batch_id = $1 AND p.id = bp.policy_id AND (p.id = ANY($2) OR p.policy_number = ANY($2) OR bp.id::text = ANY($2)) AND bp.quote_status IN ('NotQuoted', 'Failed') RETURNING bp.id`, [b.id, refs]);
  if (!rows.length) throw conflict('The selected policies already have a renewal quote');
  return startJob(b, rows.map((r) => r.id), user, QUOTE_JOB_TYPE);
}

async function startJob(b, itemIds, user, type = JOB_TYPE) {
  await query('UPDATE renewal_batches SET status = \'Processing\', updated_at = now() WHERE id = $1', [b.id]);
  const job = await enqueue(QUEUE, type, { batchId: b.id, itemIds, user: user ? { id: user.id, username: user.username } : null }, { userId: user?.id, total: itemIds.length });
  return { jobId: job.id, queued: itemIds.length, batchId: b.batch_number };
}

/** Job handler: send the next renewal notice for each queued batch policy, recording Sent / Failed per policy. */
export async function runBatchNoticesJob(payload, { progress }) {
  const { batchId, itemIds = [], user = null } = payload;
  let succeeded = 0;
  let failed = 0;
  for (const itemId of itemIds) {
    const item = await one('SELECT * FROM renewal_batch_policies WHERE id = $1', [itemId]);
    if (item && item.notice_status === 'Queued') {
      // the gate is asked again just before sending: a loan status set since queueing skips the line (FR-LCK-022)
      const gated = (await gatedPolicies([item.policy_id])).get(item.policy_id);
      if (gated) {
        await query('UPDATE renewal_batch_policies SET notice_status = \'Skipped\', error = $2 WHERE id = $1', [itemId, `${gated.label}: ${gated.reason}`]);
        await progress({ processed: succeeded + failed, succeeded, failed });
        continue;
      }
      try {
        const { id: renewalId } = await ensureRenewal(item.policy_id, user);
        await sendNotice(renewalId, user, { batchId, method: 'Email' });
        await query('UPDATE renewal_batch_policies SET notice_status = \'Sent\', notice_sent_at = now(), renewal_id = $2, attempts = attempts + 1 WHERE id = $1', [itemId, renewalId]);
        succeeded += 1;
      } catch (e) {
        await query('UPDATE renewal_batch_policies SET notice_status = \'Failed\', error = $2, attempts = attempts + 1 WHERE id = $1', [itemId, e.message]);
        failed += 1;
      }
    }
    await progress({ processed: succeeded + failed, succeeded, failed });
  }
  await settleBatch(batchId);
  return { batchId, succeeded, failed, total: itemIds.length };
}
registerJobType(JOB_TYPE, runBatchNoticesJob);

/** When nothing is queued: Completed once every selected policy had its notice sent (or tried), else back to Draft. */
async function settleBatch(batchId) {
  const c = await one(`SELECT count(*) FILTER (WHERE notice_status = 'Queued' OR quote_status = 'Queued')::int AS queued,
    count(*) FILTER (WHERE is_selected AND notice_status = 'NotSent')::int AS open FROM renewal_batch_policies WHERE batch_id = $1`, [batchId]);
  if (c.queued) return;
  await query(`UPDATE renewal_batches SET status = CASE WHEN $2 THEN 'Completed' ELSE 'Draft' END, completed_at = CASE WHEN $2 THEN now() END, updated_at = now()
    WHERE id = $1 AND status = 'Processing'`, [batchId, c.open === 0]);
}

/** Job handler: open the renewal and prepare its re-rated quote for each queued batch policy (Quoted / Failed per policy). */
export async function runBatchQuotesJob(payload, { progress }) {
  const { batchId, itemIds = [], user = null } = payload;
  let succeeded = 0;
  let failed = 0;
  for (const itemId of itemIds) {
    const item = await one('SELECT * FROM renewal_batch_policies WHERE id = $1', [itemId]);
    if (item && item.quote_status === 'Queued') {
      try {
        const { id: renewalId } = await ensureRenewal(item.policy_id, user);
        const { quote } = await generateQuote(renewalId, user);
        await query(`UPDATE renewal_batch_policies SET quote_status = 'Quoted', quote_number = $3, quoted_premium = $4, quoted_at = now(), renewal_id = $2 WHERE id = $1`,
          [itemId, renewalId, quote.quoteNumber, quote.quotedPremium]);
        succeeded += 1;
      } catch (e) {
        await query('UPDATE renewal_batch_policies SET quote_status = \'Failed\', error = $2 WHERE id = $1', [itemId, e.message]);
        failed += 1;
      }
    }
    await progress({ processed: succeeded + failed, succeeded, failed });
  }
  await settleBatch(batchId);
  return { batchId, succeeded, failed, total: itemIds.length };
}
registerJobType(QUOTE_JOB_TYPE, runBatchQuotesJob);

export async function noticeStatus(id) {
  const b = await loadBatch(id);
  return { batchId: b.batch_number, status: b.status, total: b.total_policies, NotSent: b.not_sent_count, Queued: b.queued_count, Sent: b.sent_count, Failed: b.failed_count,
    Skipped: b.skipped_count, notSent: b.not_sent_count, queued: b.queued_count, sent: b.sent_count, failed: b.failed_count, skipped: b.skipped_count, quoted: b.quoted_count };
}

export async function statistics(id) {
  const b = await loadBatch(id);
  const s = await one(`SELECT COALESCE(sum(p.premium_total), 0)::numeric AS premium, min(p.expiry_date) AS first_expiry, max(p.expiry_date) AS last_expiry,
    count(*) FILTER (WHERE bp.is_selected)::int AS selected FROM renewal_batch_policies bp JOIN policies p ON p.id = bp.policy_id WHERE bp.batch_id = $1`, [b.id]);
  return { ...(await noticeStatus(b.id)), selected: s.selected, totalPremium: round2(s.premium), firstExpiry: s.first_expiry, lastExpiry: s.last_expiry,
    successRate: b.total_policies ? round2((b.sent_count / b.total_policies) * 100) : 0 };
}

export const REPORT_COLUMNS = [
  ['policyNumber', 'Policy No.'], ['clientName', 'Client'], ['email', 'E-mail'], ['insurer', 'Insurer'], ['product', 'Product'], ['expiryDate', 'Expiry'],
  ['premium', 'Gross premium'], ['paymentStatus', 'Payment'], ['quoteNumber', 'Renewal quote'], ['quotedPremium', 'Renewal premium'], ['noticeStatus', 'Notice status'], ['noticeSentAt', 'Sent at'], ['attempts', 'Attempts'], ['error', 'Error'],
].map(([key, header]) => ({ key, header }));
export async function reportRows(id) {
  const b = await getBatch(id);
  return {
    batch: b,
    rows: b.policies.map((p) => ({
      policyNumber: p.policy.policyNumber, clientName: p.policy.clientName, email: p.policy.email, insurer: p.policy.insuranceCompanyName, product: p.policy.productType,
      expiryDate: p.policy.expiryDate, premium: p.policy.grossPremium, paymentStatus: p.policy.paymentStatus, quoteNumber: p.quoteNumber || '', quotedPremium: p.quotedPremium ?? '', noticeStatus: p.noticeStatus,
      noticeSentAt: p.noticeSentAt ? new Date(p.noticeSentAt).toISOString() : '', attempts: p.attempts, error: p.error || '',
    })),
  };
}
