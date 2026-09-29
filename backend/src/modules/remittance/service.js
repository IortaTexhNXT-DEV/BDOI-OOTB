/**
 * Remittance core: remittances / bills to insurers and agencies, their lines, the approval queue (maker-checker)
 * and automated remittance generation from policies not yet remitted.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { renderTemplate } from '../documents/common.js';
import { today as businessToday } from '../../lib/dates.js';
import { notify } from '../notifications/router.js';
import { queueEmail } from '../../lib/mailer.js';
import { isoDate, params, round2, toNumber } from '../masters/helpers.js';
import { createInsurerRemittance } from '../disbursements/service.js';
import { nextDocumentNumber } from '../../lib/numbering.js';

// ---------------- configuration helpers ----------------

export async function statusLabels() {
  return (await getSetting('remittance.status_labels', {})) || {};
}
/** Accept either a status code (for-approval) or its label (Pending Approval). */
export async function statusCode(v) {
  if (!v) return null;
  const labels = await statusLabels();
  const hit = Object.entries(labels).find(([k, l]) => k === v || String(l).toLowerCase() === String(v).toLowerCase());
  return hit ? hit[0] : String(v).toLowerCase();
}

export async function priorityFor(amount) {
  const rules = (await getSetting('remittance.priority_thresholds', [])) || [];
  const rule = [...rules].sort((a, b) => b.min - a.min).find((r) => Math.abs(amount) >= r.min);
  const priority = rule?.priority || 'Normal';
  const sla = (await getSetting('remittance.priority_sla_hours', {})) || {};
  return { priority, slaHours: Number(sla[priority]) || 24 };
}

export async function levelsFor(amount) {
  const levels = (await getSetting('remittance.approval_levels', [])) || [];
  const hit = levels.find((l) => l.maxAmount === null || l.maxAmount === undefined || Math.abs(amount) <= l.maxAmount);
  return hit ? Number(hit.level) : 1;
}

export async function findInsurer(ref, { required = true } = {}) {
  if (ref === undefined || ref === null || ref === '') {
    if (required) throw badRequest('Validation failed', [{ path: 'insurerCode', message: 'Insurer is required' }]);
    return null;
  }
  const r = await one(`SELECT * FROM insurance_companies WHERE (id::text = $1 OR lower(code) = lower($1) OR lower(name) = lower($1) OR lower(short_name) = lower($1))
                       AND status <> 'deleted' ORDER BY id LIMIT 1`, [String(ref)]);
  if (!r) throw badRequest('Validation failed', [{ path: 'insurerCode', message: `Insurer ${ref} was not found` }]);
  return r;
}

const userName = (id) => one('SELECT display_name, username FROM users WHERE id = $1', [id]).then((u) => u?.display_name || u?.username || null);
const ts = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : null);

// ---------------- remittances ----------------

const REM_SELECT = `SELECT r.*, i.code AS insurer_code, i.name AS insurer_name, i.address AS insurer_address, i.contact_email AS insurer_email, i.contact_phone AS insurer_phone,
  (SELECT display_name FROM users u WHERE u.id = r.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = r.approved_by) AS approved_by_name
  FROM remittances r LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id`;

export function remittanceOut(r, labels) {
  const billAmount = round2(Number(r.net_due) + Number(r.previous_balance || 0));
  return {
    id: r.id, remittanceNo: r.remittance_number, remittanceDate: r.remittance_date, kind: r.kind, period: r.period,
    insurerId: r.insurance_company_id, insurerCode: r.insurer_code, insurerName: r.insurer_name,
    policyCount: r.policy_count, grossAmount: r.gross_premium, commission: r.commission, tax: r.tax, adjustments: r.adjustments, netAmount: r.net_due,
    status: labels[r.status] || r.status, statusCode: r.status, dueDate: r.due_date, currency: r.currency,
    billNumber: r.bill_number, billNo: r.bill_number, billDate: r.remittance_date, billAmount, totalDue: billAmount, previousBalance: r.previous_balance,
    billStatus: r.sent_at ? 'Sent' : (r.bill_number ? 'Generated' : 'Draft'), sentAt: r.sent_at, deliveryMethod: r.delivery_method,
    agencyCode: r.agency_code, agencyName: r.agency_name, agentUserId: r.agent_user_id, configCode: r.config_code, batchRef: r.batch_ref,
    remarks: r.remarks, createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, submittedAt: r.submitted_at,
    approvedBy: r.approved_by_name || r.approved_by, approvedAt: r.approved_at, settledAt: r.settled_at, updatedAt: r.updated_at,
  };
}

export async function getRemittanceRow(id) {
  const r = await one(`${REM_SELECT} WHERE r.id = $1 OR r.remittance_number = $1 OR r.bill_number = $1`, [String(id)]);
  if (!r) throw notFound('Remittance not found');
  return r;
}

export async function getRemittance(id) {
  return remittanceOut(await getRemittanceRow(id), await statusLabels());
}

export async function listRemittances(qs, pg) {
  const p = params();
  const conds = ['TRUE'];
  if (qs.kind) conds.push(`r.kind = ${p.add(qs.kind)}`);
  const st = await statusCode(qs.status);
  if (st && st !== 'all') conds.push(`r.status = ${p.add(st)}`);
  if (qs.insurer || qs.insurerCode) conds.push(`(i.code ILIKE ${p.add(qs.insurer || qs.insurerCode)} OR i.id::text = $${p.values.length})`);
  if (qs.from) conds.push(`r.remittance_date >= ${p.add(isoDate(qs.from))}::date`);
  if (qs.to) conds.push(`r.remittance_date <= ${p.add(isoDate(qs.to))}::date`);
  if (qs.agencyCode) conds.push(`r.agency_code = ${p.add(qs.agencyCode)}`);
  if (qs.search) conds.push(`(r.remittance_number ILIKE ${p.add(`%${qs.search}%`)} OR r.bill_number ILIKE $${p.values.length} OR i.name ILIKE $${p.values.length} OR r.agency_name ILIKE $${p.values.length})`);
  const where = conds.join(' AND ');
  const total = (await one(`SELECT count(*)::int AS n FROM remittances r LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id WHERE ${where}`, p.values)).n;
  const summary = await one(`SELECT COALESCE(sum(r.gross_premium),0) AS gross, COALESCE(sum(r.net_due),0) AS net, count(*)::int AS n
                             FROM remittances r LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id WHERE ${where}`, p.values);
  const rows = await many(`${REM_SELECT} WHERE ${where} ORDER BY r.remittance_date DESC, r.created_at DESC LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  const labels = await statusLabels();
  return { total, rows: rows.map((r) => remittanceOut(r, labels)), summary: { count: summary.n, grossAmount: round2(summary.gross), netAmount: round2(summary.net) } };
}

const lineOut = (l) => ({
  id: l.id, policyId: l.policy_id, policyNo: l.policy_number, insuredName: l.insured_name, product: l.product, effectiveDate: l.effective_date,
  premium: l.premium, commission: l.commission, tax: l.tax, netAmount: l.net, commissionRate: l.premium ? round2((l.commission / l.premium) * 100) : 0, status: l.status,
});

/** Detail view used by Tracking / Approval dialogs: insurer, policies, documents and the activity log. */
export async function remittanceDetails(id) {
  const r = await getRemittanceRow(id);
  const lines = await many('SELECT * FROM remittance_lines WHERE remittance_id = $1 ORDER BY id', [r.id]);
  const docs = await many('SELECT storage_key, file_name, size_bytes, created_at FROM documents WHERE entity = \'remittance\' AND entity_id = $1 ORDER BY created_at', [r.id]);
  const log = await many('SELECT action, username, at, after_data FROM audit_log WHERE entity = \'remittance\' AND entity_id = $1 ORDER BY id', [r.id]);
  const base = remittanceOut(r, await statusLabels());
  return {
    ...base, createdDate: r.created_at, lastModified: r.updated_at,
    insurerDetails: { code: r.insurer_code, name: r.insurer_name, address: r.insurer_address, contact: r.insurer_email, phone: r.insurer_phone },
    policies: lines.map(lineOut),
    documents: docs.map((d) => ({ name: d.file_name, size: d.size_bytes, key: d.storage_key, uploadedAt: d.created_at })),
    activityLog: log.map((a) => ({ action: a.action, by: a.username, at: a.at, notes: a.after_data?.remarks || a.after_data?.comments || null })),
  };
}

/**
 * Policy rows eligible for billing / remittance (issued or active, not yet on a live remittance of this kind).
 * Direct-bill policies are never remitted: the client paid the insurer, so no premium is payable (their commission is
 * billed with a commission debit note, see directbill.js).
 */
export async function eligiblePolicies({ insurerId, agentUserId, from, to, productLine, policyIds, kind = 'direct-bill' }) {
  const p = params([kind]);
  const conds = ['p.status IN (\'issued\', \'active\', \'renewed\')', 'p.billing_mode <> \'direct\'',
    `NOT EXISTS (SELECT 1 FROM remittance_lines rl JOIN remittances rr ON rr.id = rl.remittance_id WHERE rl.policy_id = p.id AND rr.kind = $1 AND rr.status NOT IN ('rejected', 'cancelled'))`];
  if (insurerId) conds.push(`p.insurance_company_id = ${p.add(insurerId)}`);
  if (agentUserId) conds.push(`p.owner_user_id = ${p.add(agentUserId)}`);
  if (from) conds.push(`p.inception_date >= ${p.add(from)}::date`);
  if (to) conds.push(`p.inception_date <= ${p.add(to)}::date`);
  if (productLine && productLine !== 'All') conds.push(`(pr.line ILIKE ${p.add(productLine)} OR pr.name ILIKE $${p.values.length})`);
  if (policyIds) conds.push(`(p.id = ANY(${p.add(policyIds.map(String))}) OR p.policy_number = ANY($${p.values.length}))`);
  return many(`SELECT p.id, p.policy_number, p.premium_total, p.commission_amount, p.inception_date, p.insurance_company_id, p.owner_user_id, p.details,
                 c.display_name AS insured_name, pr.name AS product_name, pr.line AS product_line,
                 COALESCE((SELECT sum(balance) FROM receivables rv WHERE rv.policy_id = p.id AND rv.status <> 'paid'), 0) AS outstanding,
                 EXISTS (SELECT 1 FROM receivables rv WHERE rv.policy_id = p.id) AS billed,
                 (SELECT max(received_date) FROM receipts rc WHERE rc.policy_id = p.id AND rc.status <> 'cancelled') AS last_payment
               FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
               WHERE ${conds.join(' AND ')} ORDER BY p.inception_date, p.policy_number`, p.values);
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Lines from explicit input rows or from policies; returns normalised lines. */
async function buildLines(lines) {
  const out = [];
  for (const l of lines || []) {
    let pol = null;
    if (l.policyId || l.policyNo) {
      pol = await one(`SELECT p.*, c.display_name AS insured_name, pr.line AS product_line FROM policies p LEFT JOIN clients c ON c.id = p.client_id
                       LEFT JOIN products pr ON pr.id = p.product_id WHERE p.id = $1 OR p.policy_number = $1`, [String(l.policyId || l.policyNo)]);
      if (!pol && l.policyId) throw badRequest('Validation failed', [{ path: 'lines', message: `Policy ${l.policyId} was not found` }]);
    }
    const premium = toNumber(l.premium ?? pol?.premium_total, NaN);
    const commission = toNumber(l.commission ?? pol?.commission_amount, 0);
    const tax = toNumber(l.tax ?? pol?.details?.taxTotal, 0);
    if (!Number.isFinite(premium)) throw badRequest('Validation failed', [{ path: 'lines', message: 'Each line needs a premium' }]);
    out.push({ policyId: pol?.id || null, policyNo: pol?.policy_number || l.policyNo || null, insuredName: pol?.insured_name || l.insuredName || null,
      product: cap(pol?.product_line) || l.product || null, effectiveDate: pol?.inception_date || isoDate(l.effectiveDate), premium, commission, tax, net: round2(premium - commission - tax) });
  }
  return out;
}

async function insertRemittance(c, { kind, insurerId, period, dueDate, lines, billNumber, agency, previousBalance = 0, configCode, deliveryMethod, remarks, date, userId }) {
  const gross = round2(lines.reduce((s, l) => s + l.premium, 0));
  const comm = round2(lines.reduce((s, l) => s + l.commission, 0));
  const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
  const number = await nextDocumentNumber('remittance');
  const currency = await getSetting('currency.default', 'PHP');
  const r = await c.query(`INSERT INTO remittances(remittance_number, insurance_company_id, kind, period, gross_premium, commission, tax, net_due, status, remarks, created_by,
      remittance_date, due_date, policy_count, currency, bill_number, agent_user_id, agency_code, agency_name, previous_balance, config_code, delivery_method, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10, COALESCE($11::date, current_date), $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $10) RETURNING id`,
  [number, insurerId || null, kind, period || null, gross, comm, tax, round2(gross - comm - tax), remarks || null, userId, date || null, dueDate || null, lines.length, currency,
    billNumber || null, agency?.userId || null, agency?.code || null, agency?.name || null, previousBalance, configCode || null, JSON.stringify(deliveryMethod || [])]);
  const id = r.rows[0].id;
  for (const l of lines) {
    await c.query(`INSERT INTO remittance_lines(remittance_id, policy_id, premium, commission, net, policy_number, insured_name, product, tax, effective_date)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, l.policyId, l.premium, l.commission, l.net, l.policyNo, l.insuredName, l.product, l.tax, l.effectiveDate]);
  }
  return id;
}

async function defaultDueDate(from) {
  const days = Number(await getSetting('remittance.default_due_days', 30)) || 30;
  const d = new Date(`${isoDate(from) || (await businessToday())}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createRemittance(b, user) {
  const kind = b.kind || 'direct-bill';
  if (!['direct-bill', 'agency-bill'].includes(kind)) throw badRequest('Validation failed', [{ path: 'kind', message: 'kind must be direct-bill or agency-bill' }]);
  const ins = await findInsurer(b.insurerId ?? b.insurerCode, { required: kind === 'direct-bill' });
  if (!Array.isArray(b.lines) || !b.lines.length) throw badRequest('Validation failed', [{ path: 'lines', message: 'At least one policy line is required' }]);
  const lines = await buildLines(b.lines);
  const dueDate = isoDate(b.dueDate) || await defaultDueDate(b.remittanceDate);
  const id = await withTransaction((c) => insertRemittance(c, { kind, insurerId: ins?.id, period: b.period, dueDate, lines, remarks: b.remarks, date: isoDate(b.remittanceDate), userId: user.id }));
  return getRemittance(id);
}

export async function validateRemittances(ids) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Select at least one remittance');
  const labels = await statusLabels();
  const results = [];
  for (const id of ids) {
    const r = await one(`${REM_SELECT} WHERE r.id = $1 OR r.remittance_number = $1`, [String(id)]);
    const errors = [];
    if (!r) { results.push({ id, code: null, valid: false, errors: ['Remittance not found'] }); continue; }
    if (!['draft', 'rejected'].includes(r.status)) errors.push(`Status ${labels[r.status] || r.status} cannot be processed`);
    if (!r.policy_count) errors.push('No policies on the remittance');
    if (Number(r.net_due) <= 0) errors.push('Net amount must be greater than zero');
    if (r.kind === 'direct-bill' && !r.insurance_company_id) errors.push('Insurer is missing');
    if (r.insurance_company_id && !(await one('SELECT 1 FROM insurance_companies WHERE id = $1 AND status = \'active\'', [r.insurance_company_id]))) errors.push('Insurer is not active');
    results.push({ id: r.id, code: r.remittance_number, valid: !errors.length, errors });
  }
  return { totalValidated: results.length, validCount: results.filter((x) => x.valid).length, invalidCount: results.filter((x) => !x.valid).length, results };
}

// ---------------- approvals ----------------

export async function openApproval(c, { entity, entityId, referenceNo, transactionType, amount, description, initiatorId }) {
  const { priority, slaHours } = await priorityFor(amount);
  const levels = await levelsFor(amount);
  const hist = [{ action: 'Submitted', by: initiatorId, at: new Date().toISOString(), remarks: description || null }];
  const r = await c.query(`INSERT INTO remittance_approvals(entity, entity_id, reference_no, transaction_type, amount, description, priority, sla_hours, required_levels, initiator_id, history)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
  [entity, entityId, referenceNo, transactionType, round2(amount), description || null, priority, slaHours, levels, initiatorId, JSON.stringify(hist)]);
  return r.rows[0].id;
}

/** Submit draft remittances for approval as one processing batch. */
export async function processRemittances(ids, user) {
  const started = Date.now();
  const v = await validateRemittances(ids);
  const ok = v.results.filter((x) => x.valid);
  if (!ok.length) throw badRequest('None of the selected remittances can be processed', v.results.filter((x) => !x.valid).map((x) => ({ path: x.code || x.id, message: x.errors.join('; ') })));
  const batchId = await nextDocumentNumber('remittance_batch');
  let total = 0;
  await withTransaction(async (c) => {
    for (const x of ok) {
      const r = (await c.query('SELECT * FROM remittances WHERE id = $1 FOR UPDATE', [x.id])).rows[0];
      total += Number(r.net_due);
      await c.query('UPDATE remittances SET status = \'for-approval\', submitted_by = $2, submitted_at = now(), batch_ref = $3, updated_by = $2, updated_at = now() WHERE id = $1', [r.id, user.id, batchId]);
      await c.query('DELETE FROM remittance_approvals WHERE entity = \'remittance\' AND entity_id = $1 AND status = \'Pending\'', [r.id]);
      await openApproval(c, { entity: 'remittance', entityId: r.id, referenceNo: r.remittance_number, transactionType: r.kind === 'agency-bill' ? 'Agency Bill' : 'Insurer Remittance', amount: Number(r.net_due), description: `Remittance ${r.remittance_number} (${r.policy_count} policies)`, initiatorId: user.id });
    }
    await c.query(`INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by) VALUES ('batch', $1, $2, 'Pending Approval', $3, $4, $4)`,
      [batchId, round2(total), JSON.stringify({ processedIds: ok.map((x) => x.id), itemCount: ok.length, durationMs: Date.now() - started }), user.id]);
  });
  await notify({ audience: 'write:remittance', type: 'approval', title: 'Remittances awaiting approval', message: `${ok.length} remittance(s) in batch ${batchId} need approval`, link: '/finance/remittance/approval', entity: 'remittance_batch', entityId: batchId });
  return { success: true, message: `Successfully submitted ${ok.length} remittance(s) for approval`, processedIds: ok.map((x) => x.id), failed: v.results.filter((x) => !x.valid), batchId, processedAt: new Date().toISOString() };
}

export async function processingHistory() {
  const rows = await many(`SELECT b.*, (SELECT display_name FROM users u WHERE u.id = b.created_by) AS by_name FROM remittance_items b WHERE b.kind IN ('batch', 'execution') ORDER BY b.created_at DESC LIMIT 100`);
  return rows.map((b) => ({ id: b.id, batchId: b.reference_no, type: b.kind, processedAt: b.created_at, processedBy: b.by_name || 'System', itemCount: b.data.itemCount ?? b.data.recordsProcessed ?? 0,
    totalAmount: b.amount, status: b.status, duration: `${Math.max(1, Math.round((b.data.durationMs || 0) / 1000))}s` }));
}

/**
 * An approved settlement becomes money out: the premium collected on its policies (net of commission) is put on an
 * insurer payment voucher in Disbursement, for the finance checker to approve (cheque approval posts the journal).
 * Premium not collected by the broker is not paid out; the settlement records that instead.
 */
async function raiseInsurerVoucher(c, item, lineIds, user) {
  if (!item.insurance_company_id || !lineIds.length) return;
  const policyIds = (await c.query('SELECT DISTINCT policy_id FROM remittance_lines WHERE id = ANY($1) AND policy_id IS NOT NULL', [lineIds.map(Number)])).rows.map((r) => r.policy_id);
  if (!policyIds.length) return;
  let voucher = null;
  try {
    // the settlement's maker owns the voucher, so the cheque approval stays with a different finance user
    const maker = item.created_by ? { id: item.created_by } : user;
    voucher = await createInsurerRemittance(c, { insuranceCompanyId: item.insurance_company_id, policyIds, transactionCode: 'REMT', remarks: `Settlement ${item.reference_no}` }, maker);
  } catch (e) {
    if (e.status !== 409) throw e; // 409: nothing collected and not yet remitted for these policies
  }
  const link = voucher
    ? { disbursementId: voucher.disbursementId || voucher.id, voucherNumber: voucher.voucherNumber, voucherAmount: voucher.amount }
    : { voucherNote: 'No collected premium awaiting remittance for these policies; no payment voucher raised' };
  await c.query('UPDATE remittance_items SET data = data || $2 WHERE id = $1', [item.id, JSON.stringify(link)]);
}

async function applyDecision(c, a, decision, user, remarks) {
  if (a.entity === 'remittance') {
    const status = decision === 'approve' ? 'approved' : 'rejected';
    await c.query(`UPDATE remittances SET status = $2, approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END, approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
                   rejected_by = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_by END, rejected_at = CASE WHEN $2 = 'rejected' THEN now() ELSE rejected_at END,
                   remarks = COALESCE($4, remarks), updated_by = $3, updated_at = now() WHERE id = $1`, [a.entity_id, status, user.id, remarks || null]);
    return;
  }
  const item = (await c.query('SELECT * FROM remittance_items WHERE id = $1 FOR UPDATE', [a.entity_id])).rows[0];
  if (!item) return;
  const status = decision === 'approve' ? 'Approved' : 'Rejected';
  await c.query(`UPDATE remittance_items SET status = $2, approved_by = CASE WHEN $2 = 'Approved' THEN $3 ELSE approved_by END, approved_at = CASE WHEN $2 = 'Approved' THEN now() ELSE approved_at END,
                 remarks = COALESCE($4, remarks), updated_by = $3, updated_at = now() WHERE id = $1`, [item.id, status, user.id, remarks || null]);
  if (decision !== 'approve') return;
  if (item.kind === 'settlement') {
    const remIds = item.data.remittanceIds || [];
    if (remIds.length) await c.query('UPDATE remittances SET status = \'settled\', settled_at = now(), updated_by = $2, updated_at = now() WHERE id = ANY($1) AND status = \'approved\'', [remIds, user.id]);
    const lineIds = item.data.lineIds || [];
    if (lineIds.length) await c.query('UPDATE remittance_lines SET status = \'Settled\' WHERE id = ANY($1)', [lineIds.map(Number)]);
    await raiseInsurerVoucher(c, item, lineIds, user);
  }
  if (item.kind === 'adjustment' && item.remittance_id) {
    const amt = toNumber(item.data.adjustmentAmount, 0);
    await c.query('UPDATE remittances SET adjustments = adjustments + $2, net_due = net_due + $2, updated_by = $3, updated_at = now() WHERE id = $1', [item.remittance_id, amt, user.id]);
  }
}

const APPROVAL_SELECT = `SELECT a.*, (SELECT display_name FROM users u WHERE u.id = a.initiator_id) AS initiator_name,
  (SELECT display_name FROM users u WHERE u.id = a.action_by) AS action_by_name, (SELECT display_name FROM users u WHERE u.id = a.delegated_to) AS delegated_to_name
  FROM remittance_approvals a`;

function approvalOut(a) {
  const ageHours = (Date.now() - new Date(a.created_at).getTime()) / 3600000;
  return {
    id: Number(a.id), priority: a.priority, referenceNo: a.reference_no, transactionType: a.transaction_type, initiator: a.initiator_name, initiatorId: a.initiator_id,
    submissionDate: ts(a.created_at), amount: a.amount, description: a.description, slaHours: a.sla_hours, slaRemaining: Math.round((a.sla_hours - ageHours) * 10) / 10,
    currentLevel: a.current_level, requiredLevels: a.required_levels, status: a.status, entity: a.entity, entityId: a.entity_id,
    delegatedTo: a.delegated_to_name, actionBy: a.action_by_name, actionDate: ts(a.action_at), remarks: a.remarks,
  };
}

export async function listApprovals(qs) {
  const status = qs.status && qs.status !== 'All' ? qs.status : 'Pending';
  const p = params([status]);
  let extra = '';
  if (qs.transactionType) extra += ` AND a.transaction_type = ${p.add(qs.transactionType)}`;
  if (qs.priority) extra += ` AND a.priority = ${p.add(qs.priority)}`;
  const rows = await many(`${APPROVAL_SELECT} WHERE a.status = $1${extra} ORDER BY CASE a.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Normal' THEN 3 ELSE 4 END, a.created_at`, p.values);
  return rows.map(approvalOut);
}

export async function approvalHistory(limit = 200) {
  const rows = await many(`SELECT a.reference_no, a.transaction_type, a.amount, h.value AS h,
                             (SELECT display_name FROM users u WHERE u.id = h.value->>'by') AS by_name
                           FROM remittance_approvals a, jsonb_array_elements(a.history) h
                           WHERE h.value->>'action' <> 'Submitted' ORDER BY (h.value->>'at') DESC LIMIT $1`, [limit]);
  return rows.map((r) => ({ referenceNo: r.reference_no, transactionType: r.transaction_type, amount: r.amount, action: r.h.action, actionDate: ts(r.h.at), actionBy: r.by_name, remarks: r.h.remarks || null, level: r.h.level ?? null }));
}

export async function getApproval(id) {
  const a = await one(`${APPROVAL_SELECT} WHERE a.id = $1`, [Number(id) || 0]);
  if (!a) throw notFound('Approval not found');
  return a;
}

/** Approve / reject / delegate a pending approval. The approver must not be the initiator nor an earlier approver. */
export async function decide(id, action, body, user) {
  const a = await getApproval(id);
  if (a.status !== 'Pending') throw conflict(`Approval is already ${a.status.toLowerCase()}`);
  if (a.delegated_to && a.delegated_to !== user.id && !(user.roles || []).some((r) => ['it-admin', 'ba'].includes(r))) throw forbidden('This approval has been delegated to another user');
  const remarks = body.comments ?? body.remarks ?? body.reason ?? null;
  if (action !== 'delegate') {
    if (a.initiator_id === user.id) throw forbidden('Maker-checker: you cannot approve or reject a transaction you initiated');
    if ((a.history || []).some((h) => h.action === 'Approved' && h.by === user.id)) throw forbidden('Maker-checker: you have already approved an earlier level of this transaction');
  }
  if (action === 'reject' && !remarks) throw badRequest('Validation failed', [{ path: 'comments', message: 'A reason is required to reject' }]);
  const hist = [...(a.history || [])];
  await withTransaction(async (c) => {
    if (action === 'delegate') {
      const to = await one('SELECT id FROM users WHERE (id = $1 OR lower(username) = lower($1)) AND status = \'active\'', [String(body.delegateTo || '')]);
      if (!to) throw badRequest('Validation failed', [{ path: 'delegateTo', message: 'Delegate user was not found' }]);
      if (to.id === a.initiator_id) throw badRequest('Cannot delegate to the initiator');
      hist.push({ action: 'Delegated', by: user.id, to: to.id, at: new Date().toISOString(), remarks });
      await c.query('UPDATE remittance_approvals SET delegated_to = $2, history = $3 WHERE id = $1', [a.id, to.id, JSON.stringify(hist)]);
      return;
    }
    if (action === 'approve' && a.current_level < a.required_levels) {
      hist.push({ action: 'Approved', by: user.id, at: new Date().toISOString(), remarks, level: a.current_level });
      await c.query('UPDATE remittance_approvals SET current_level = current_level + 1, delegated_to = NULL, history = $2 WHERE id = $1', [a.id, JSON.stringify(hist)]);
      return;
    }
    const status = action === 'approve' ? 'Approved' : 'Rejected';
    hist.push({ action: status, by: user.id, at: new Date().toISOString(), remarks, level: a.current_level });
    await c.query('UPDATE remittance_approvals SET status = $2, action_by = $3, action_at = now(), remarks = $4, history = $5 WHERE id = $1', [a.id, status, user.id, remarks, JSON.stringify(hist)]);
    await applyDecision(c, a, action, user, remarks);
  });
  const after = approvalOut(await getApproval(id));
  if (after.status !== 'Pending') {
    await notify({ userId: a.initiator_id, type: 'info', title: `${a.transaction_type} ${after.status.toLowerCase()}`, message: `${a.reference_no} was ${after.status.toLowerCase()} by ${await userName(user.id)}`, link: '/finance/remittance/approval', entity: a.entity, entityId: a.entity_id });
  }
  return { before: approvalOut(a), after };
}

/** Approve / reject through the underlying record (remittance or item) instead of the approval id. */
export async function decideFor(entity, entityId, action, body, user) {
  const a = await one('SELECT id FROM remittance_approvals WHERE entity = $1 AND entity_id = $2 AND status = \'Pending\'', [entity, entityId]);
  if (!a) throw conflict('There is no pending approval for this record');
  return decide(a.id, action, body, user);
}

export async function settleRemittance(id, b, user) {
  const r = await getRemittanceRow(id);
  if (r.status !== 'approved') throw conflict('Only approved remittances can be settled');
  await query(`UPDATE remittances SET status = 'settled', settled_at = now(), remarks = COALESCE($2, remarks), data = data || $3, updated_by = $4, updated_at = now() WHERE id = $1`,
    [r.id, b.remarks || null, JSON.stringify({ paymentReference: b.referenceNo || null, paymentMethod: b.paymentMethod || null, paymentDate: isoDate(b.paymentDate) }), user.id]);
  return getRemittance(r.id);
}

/**
 * Users an approval can be delegated to: active users who hold write:remittance through a role, or an administrator role,
 * other than the caller. Finance reads this without read:users (D106).
 */
export async function approvers(user) {
  const rows = await many(`SELECT u.id, u.username, u.display_name FROM users u
    WHERE u.status = 'active' AND u.id <> $1 AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND (r.code IN ('it-admin', 'ba') OR EXISTS (
        SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id AND p.code = 'write:remittance')))
    ORDER BY lower(COALESCE(u.display_name, u.username))`, [user?.id || '']);
  return rows.map((u) => ({ userId: u.id, username: u.username, displayName: u.display_name || u.username }));
}

export async function listDelegations() {
  const rows = await many(`SELECT d.*, (SELECT display_name FROM users u WHERE u.id = d.delegate_id) AS delegate_name, (SELECT display_name FROM users u WHERE u.id = d.delegator_id) AS delegator_name
                           FROM remittance_delegations d ORDER BY d.from_date DESC`);
  const today = await businessToday();
  return rows.map((d) => ({ id: Number(d.id), delegatedTo: d.delegate_name, delegatedBy: d.delegator_name, fromDate: d.from_date, toDate: d.to_date, transTypes: d.trans_types,
    amountLimit: d.amount_limit, reason: d.reason, status: d.status === 'Active' && d.to_date < today ? 'Expired' : d.status }));
}

export async function createDelegation(b, user) {
  const to = await one('SELECT id FROM users WHERE (id = $1 OR lower(username) = lower($1) OR lower(display_name) = lower($1)) AND status = \'active\'', [String(b.delegateTo || '')]);
  const errors = [];
  if (!to) errors.push({ path: 'delegateTo', message: 'Delegate user was not found' });
  else if (to.id === user.id) errors.push({ path: 'delegateTo', message: 'You cannot delegate to yourself' });
  const from = isoDate(b.fromDate);
  const until = isoDate(b.toDate);
  if (!from || !until || until < from) errors.push({ path: 'toDate', message: 'A valid date range is required' });
  if (!b.reason) errors.push({ path: 'reason', message: 'Reason is required' });
  if (errors.length) throw badRequest('Validation failed', errors);
  const r = await one(`INSERT INTO remittance_delegations(delegator_id, delegate_id, from_date, to_date, trans_types, amount_limit, reason) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [user.id, to.id, from, until, JSON.stringify(b.transTypes || ['All']), b.amountLimit == null ? null : toNumber(b.amountLimit), b.reason]);
  return (await listDelegations()).find((d) => d.id === Number(r.id));
}

// ---------------- agency bill (direct bill: see directbill.js) ----------------

/** Agents / agencies with their production for a bill period and unpaid balance of earlier agency bills. */
export async function agencies(qs) {
  const period = qs.billPeriod ? String(qs.billPeriod).slice(0, 7) : null;
  const roles = (await getSetting('incentive.eligible_roles', [])) || [];
  const p = params([roles]);
  const periodCond = period ? `AND to_char(p.inception_date, 'YYYY-MM') = ${p.add(period)}` : '';
  const rows = await many(`
    SELECT u.id, COALESCE(u.employee_code, u.username) AS code, u.display_name, COALESCE(u.designation, 'Agent') AS agency_type,
      count(p.id)::int AS policies, COALESCE(sum(p.premium_total), 0) AS gross, COALESCE(sum(p.commission_amount), 0) AS commission,
      COALESCE((SELECT sum(r.net_due) FROM remittances r WHERE r.kind = 'agency-bill' AND r.agent_user_id = u.id AND r.status NOT IN ('settled', 'rejected', 'cancelled')), 0) AS prev
    FROM users u
    LEFT JOIN policies p ON p.owner_user_id = u.id AND p.status IN ('issued', 'active', 'renewed') AND p.billing_mode <> 'direct' ${periodCond}
      AND NOT EXISTS (SELECT 1 FROM remittance_lines rl JOIN remittances rr ON rr.id = rl.remittance_id WHERE rl.policy_id = p.id AND rr.kind = 'agency-bill' AND rr.status NOT IN ('rejected', 'cancelled'))
    WHERE u.status = 'active' AND (EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id AND ro.code = ANY($1)) OR p.id IS NOT NULL)
    GROUP BY u.id ORDER BY u.display_name`, p.values);
  return rows.map((r) => ({ id: r.id, agencyCode: r.code, agencyName: r.display_name, agencyType: r.agency_type, policyCount: r.policies, grossPremium: round2(r.gross),
    commission: round2(r.commission), previousBalance: round2(r.prev), totalDue: round2(Number(r.gross) - Number(r.commission) + Number(r.prev)) }));
}

export async function generateAgencyBills(b, user) {
  const period = b.billPeriod ? isoDate(b.billPeriod)?.slice(0, 7) || String(b.billPeriod).slice(0, 7) : null;
  if (!period || !/^\d{4}-\d{2}$/.test(period)) throw badRequest('Validation failed', [{ path: 'billPeriod', message: 'billPeriod (YYYY-MM) is required' }]);
  const codes = Array.isArray(b.agencyCodes) ? b.agencyCodes : [];
  if (!codes.length) throw badRequest('Validation failed', [{ path: 'agencyCodes', message: 'Select at least one agency' }]);
  const all = await agencies({ billPeriod: period });
  const billDate = isoDate(b.billRunDate) || (await businessToday());
  const cfg = await one('SELECT data FROM master_records WHERE type_code = \'remittance-agency-bill\' AND status = \'active\' ORDER BY id LIMIT 1');
  const dueDays = Number(b.dueDays ?? cfg?.data?.dueDays ?? (await getSetting('remittance.default_due_days', 30)));
  const due = new Date(`${billDate}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + dueDays);
  const bills = [];
  const skipped = [];
  for (const code of codes) {
    const ag = all.find((a) => a.agencyCode === code || a.id === code);
    if (!ag) { skipped.push({ agencyCode: code, reason: 'Agency not found' }); continue; }
    if (await one('SELECT 1 FROM remittances WHERE kind = \'agency-bill\' AND agent_user_id = $1 AND period = $2 AND status NOT IN (\'rejected\', \'cancelled\')', [ag.id, period])) {
      skipped.push({ agencyCode: ag.agencyCode, reason: `Already billed for ${period}` });
      continue;
    }
    const [from, to] = [`${period}-01`, new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).toISOString().slice(0, 10)];
    const pols = await eligiblePolicies({ agentUserId: ag.id, from, to, kind: 'agency-bill' });
    if (!pols.length && !ag.previousBalance) { skipped.push({ agencyCode: ag.agencyCode, reason: 'Nothing to bill' }); continue; }
    const lines = await buildLines(pols.map((p) => ({ policyId: p.id })));
    const billNumber = await nextDocumentNumber('remittance_bill');
    const id = await withTransaction((c) => insertRemittance(c, { kind: 'agency-bill', period, dueDate: due.toISOString().slice(0, 10), lines, billNumber, agency: { userId: ag.id, code: ag.agencyCode, name: ag.agencyName }, previousBalance: ag.previousBalance, configCode: cfg?.data?.code, date: billDate, userId: user.id }));
    bills.push(await getRemittance(id));
  }
  if (!bills.length) throw badRequest('No bills were generated', skipped.map((s) => ({ path: s.agencyCode, message: s.reason })));
  return { agencyBills: bills.map((x) => ({ ...x, status: 'Generated' })), skipped };
}

export async function sendBill(id, b, user) {
  const r = await getRemittanceRow(id);
  if (!r.bill_number) throw badRequest('Only bills can be sent');
  if (['rejected', 'cancelled'].includes(r.status)) throw conflict('Bill is rejected or cancelled');
  let to = b.email;
  if (!to && r.agent_user_id) to = (await one('SELECT email FROM users WHERE id = $1', [r.agent_user_id]))?.email;
  if (!to && r.insurance_company_id) to = r.insurer_email;
  if (to) {
    const currency = r.currency || (await getSetting('currency.default', 'PHP'));
    const vars = { billNumber: r.bill_number, billDate: r.remittance_date, currency, amount: round2(Number(r.net_due) + Number(r.previous_balance)).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      dueDate: r.due_date, companyName: (await getSetting('general.company_name')) ?? '' };
    await queueEmail({ to, subject: renderTemplate(await getSetting('remittance.bill_email_subject'), vars), html: renderTemplate(await getSetting('remittance.bill_email_body'), vars),
      template: 'remittance-bill', entity: 'remittance', entityId: r.id });
  }
  await query('UPDATE remittances SET sent_at = now(), delivery_method = $2, updated_by = $3, updated_at = now() WHERE id = $1', [r.id, JSON.stringify(b.deliveryMethod || r.delivery_method || ['email']), user.id]);
  return { ...(await getRemittance(r.id)), emailedTo: to || null };
}

// ---------------- automated remittance ----------------

const nextRunDate = (day, frequency) => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(28, Number(day) || 1)));
  if (d <= now) d.setUTCMonth(d.getUTCMonth() + (frequency === 'Quarterly' ? 3 : 1));
  return d.toISOString().slice(0, 10);
};

export async function automatedCandidates(configCode) {
  const cfgs = await many('SELECT id, data FROM master_records WHERE type_code = \'remittance-automated\' AND status = \'active\' AND ($1::text IS NULL OR code = $1) ORDER BY code', [configCode || null]);
  const out = [];
  for (const { data: cfg } of cfgs) {
    for (const code of cfg.insurers || []) {
      const ins = await one('SELECT * FROM insurance_companies WHERE lower(code) = lower($1) AND status = \'active\'', [code]);
      if (!ins) continue;
      const pols = await eligiblePolicies({ insurerId: ins.id, kind: 'direct-bill' });
      const gross = pols.reduce((s, x) => s + Number(x.premium_total), 0);
      const comm = pols.reduce((s, x) => s + Number(x.commission_amount), 0);
      out.push({ id: `${cfg.code}:${ins.code}`, scheduleCode: cfg.code, configName: cfg.name, frequency: cfg.frequency, insurerId: ins.id, insurerCode: ins.code, insurerName: ins.name,
        policyCount: pols.length, grossPremium: round2(gross), commission: round2(comm), estimatedAmount: round2(gross - comm), dueDate: nextRunDate(cfg.dayOfExecution, cfg.frequency),
        status: pols.length >= (Number(cfg.minTransactionCount) || 1) ? 'Ready' : 'Below minimum' });
    }
  }
  return out;
}

/** Create draft remittances for every ready candidate (optionally limited to candidate ids) and log the execution. */
export async function executeAutomated(b, user, triggeredBy = 'manual') {
  const started = Date.now();
  let cands = (await automatedCandidates(b.configCode)).filter((x) => x.status === 'Ready');
  if (Array.isArray(b.ids) && b.ids.length) cands = cands.filter((x) => b.ids.includes(x.id));
  const created = [];
  for (const cnd of cands) {
    const pols = await eligiblePolicies({ insurerId: cnd.insurerId, kind: 'direct-bill' });
    if (!pols.length) continue;
    const lines = await buildLines(pols.map((p) => ({ policyId: p.id })));
    const id = await withTransaction((c) => insertRemittance(c, { kind: 'direct-bill', insurerId: cnd.insurerId, period: new Date().toISOString().slice(0, 7), dueDate: cnd.dueDate, lines, configCode: cnd.scheduleCode, userId: user.id }));
    created.push(await getRemittance(id));
  }
  const total = round2(created.reduce((s, r) => s + Number(r.netAmount), 0));
  const ref = await nextDocumentNumber('remittance_batch');
  await query(`INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by) VALUES ('execution', $1, $2, $3, $4, $5, $5)`,
    [ref, total, created.length ? 'Success' : 'No Items', JSON.stringify({ configCode: b.configCode || 'ALL', executionDate: (await businessToday()), recordsProcessed: created.reduce((s, r) => s + r.policyCount, 0),
      itemCount: created.length, remittanceIds: created.map((r) => r.id), durationMs: Date.now() - started, triggeredBy }), user.id]);
  for (const code of [...new Set(cands.map((c) => c.scheduleCode))]) {
    await query(`UPDATE master_records SET data = data || jsonb_build_object('lastRun', $2::text, 'nextRun', $3::text), updated_at = now() WHERE type_code = 'remittance-automated' AND code = $1`,
      [code, (await businessToday()), cands.find((c) => c.scheduleCode === code).dueDate]);
  }
  return { executionId: ref, remittances: created, recordsProcessed: created.reduce((s, r) => s + r.policyCount, 0), totalAmount: total, duration: `${Math.max(1, Math.round((Date.now() - started) / 1000))}s` };
}

export async function executionHistory() {
  const rows = await many('SELECT * FROM remittance_items WHERE kind = \'execution\' ORDER BY created_at DESC LIMIT 100');
  return rows.map((r) => ({ id: r.id, executionId: r.reference_no, configCode: r.data.configCode, executionDate: r.data.executionDate, status: r.status, recordsProcessed: r.data.recordsProcessed,
    totalAmount: r.amount, duration: `${Math.max(1, Math.round((r.data.durationMs || 0) / 1000))}s`, remittanceIds: r.data.remittanceIds || [] }));
}
