/**
 * Remittance work items: settlements, adjustments, electronic transfers, statements, exceptions, notifications,
 * schedules, bulk uploads, bank reconciliation, analytics, reports, history and the master overview.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { renderTemplate } from '../documents/common.js';
import { today } from '../../lib/dates.js';
import { queueEmail } from '../../lib/mailer.js';
import { assertRowLimit } from '../../lib/uploadLimits.js';
import { fileSize, isoDate, lastMonths, params, round2, saveFile, toCsv, toNumber } from '../masters/helpers.js';
import * as masters from '../masters/service.js';
import { createRemittance, eligiblePolicies, executeAutomated, findInsurer, getRemittance, openApproval, postItemJournal, statusLabels } from './service.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { companyName } from '../../lib/letterhead.js';

const ts = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : null);
const ITEM_SELECT = `SELECT x.*, (SELECT display_name FROM users u WHERE u.id = x.created_by) AS created_by_name,
  (SELECT display_name FROM users u WHERE u.id = x.updated_by) AS updated_by_name, (SELECT display_name FROM users u WHERE u.id = x.approved_by) AS approved_by_name
  FROM remittance_items x`;

export function itemOut(x) {
  return {
    ...x.data, id: x.id, kind: x.kind, referenceNo: x.reference_no, amount: x.amount, status: x.status, priority: x.priority, remarks: x.remarks,
    remittanceId: x.remittance_id, insurerId: x.insurance_company_id, createdBy: x.created_by_name || x.created_by, createdDate: ts(x.created_at), createdAt: x.created_at,
    lastModified: ts(x.updated_at), modifiedBy: x.updated_by_name || x.updated_by, approvedBy: x.approved_by_name || x.approved_by, approvedAt: x.approved_at,
  };
}

export async function getItem(kind, id) {
  const x = await one(`${ITEM_SELECT} WHERE x.kind = $1 AND (x.id = $2 OR x.reference_no = $2)`, [kind, String(id)]);
  if (!x) throw notFound(`${kind} not found`);
  return x;
}

export async function listItems(kind, qs, pg, mapper = itemOut) {
  const p = params([Array.isArray(kind) ? kind : [kind]]);
  const conds = ['x.kind = ANY($1)'];
  if (qs.status && qs.status !== 'All') conds.push(`x.status = ANY(${p.add(String(qs.status).split(','))})`);
  if (qs.search) conds.push(`(x.reference_no ILIKE ${p.add(`%${qs.search}%`)} OR x.data::text ILIKE $${p.values.length})`);
  if (qs.from) conds.push(`x.created_at >= ${p.add(isoDate(qs.from))}::date`);
  if (qs.to) conds.push(`x.created_at < (${p.add(isoDate(qs.to))}::date + 1)`);
  const where = conds.join(' AND ');
  const total = (await one(`SELECT count(*)::int AS n FROM remittance_items x WHERE ${where}`, p.values)).n;
  const rows = await many(`${ITEM_SELECT} WHERE ${where} ORDER BY x.created_at DESC LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  return { total, rows: rows.map(mapper) };
}

async function insertItem(c, { kind, referenceNo, remittanceId = null, insurerId = null, amount = 0, status, priority = null, data, remarks = null, userId }) {
  const r = await c.query(`INSERT INTO remittance_items(kind, reference_no, remittance_id, insurance_company_id, amount, status, priority, data, remarks, created_by, updated_by)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id`, [kind, referenceNo, remittanceId, insurerId, round2(amount), status, priority, JSON.stringify(data), remarks, userId]);
  return r.rows[0].id;
}
const insertItemNoTx = (args) => insertItem({ query: (t, v) => query(t, v) }, args);
const requireFields = (b, fields) => {
  const errors = fields.filter((f) => b[f] === undefined || b[f] === null || String(b[f]).trim() === '').map((f) => ({ path: f, message: `${f} is required` }));
  if (errors.length) throw badRequest('Validation failed', errors);
};

// ---------------- settlements ----------------

/** Lines of approved remittances for an insurer that are not on a live settlement. */
export async function availableLines(insurerRef) {
  const ins = await findInsurer(insurerRef);
  const rows = await many(`SELECT l.*, r.remittance_number, r.id AS rem_id FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id
    WHERE r.insurance_company_id = $1 AND r.status = 'approved' AND l.status <> 'Settled'
      AND NOT EXISTS (SELECT 1 FROM remittance_items s WHERE s.kind = 'settlement' AND s.status NOT IN ('Rejected', 'Cancelled') AND s.data->'lineIds' @> to_jsonb(l.id))
    ORDER BY r.remittance_date, l.id`, [ins.id]);
  return rows.map((l) => ({ id: Number(l.id), remittanceId: l.rem_id, remittanceNo: l.remittance_number, policyNo: l.policy_number, insuredName: l.insured_name, product: l.product,
    premium: l.premium, commissionRate: l.premium ? round2((l.commission / l.premium) * 100) : 0, commission: l.commission, tax: l.tax, netAmount: l.net }));
}

export function calculateTotals(policies, adj = {}) {
  const totalPremium = round2(policies.reduce((s, p) => s + toNumber(p.premium), 0));
  const totalCommission = round2(policies.reduce((s, p) => s + toNumber(p.commission), 0));
  const totalTax = round2(policies.reduce((s, p) => s + toNumber(p.tax), 0));
  const totalAdjustments = round2(toNumber(adj.previousBalance) + toNumber(adj.creditNotes) - toNumber(adj.debitNotes) + toNumber(adj.otherAdjustments));
  return { totalPremium, totalCommission, totalTax, totalAdjustments, netAmount: round2(totalPremium - totalCommission - totalTax + totalAdjustments), calculatedAt: new Date().toISOString() };
}

export async function calculateSettlement(b) {
  let pols = Array.isArray(b.policies) ? b.policies : [];
  if (Array.isArray(b.lineIds) && b.lineIds.length) pols = await many('SELECT premium, commission, tax FROM remittance_lines WHERE id = ANY($1)', [b.lineIds.map(Number)]);
  return calculateTotals(pols, b.adjustments || b);
}

async function settlementData(b, existing = {}) {
  const ins = await findInsurer(b.insurerCode ?? existing.insurerCode);
  const lineIds = (b.lineIds ?? existing.lineIds ?? []).map(Number);
  if (!lineIds.length) throw badRequest('Validation failed', [{ path: 'lineIds', message: 'Select at least one policy' }]);
  const avail = await availableLines(ins.code);
  const own = new Set((existing.lineIds || []).map(Number));
  const lines = await many('SELECT l.*, r.insurance_company_id, r.status AS rem_status FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id WHERE l.id = ANY($1)', [lineIds]);
  const bad = lineIds.filter((id) => !avail.some((a) => a.id === id) && !own.has(id));
  if (bad.length || lines.length !== lineIds.length) throw badRequest('Validation failed', [{ path: 'lineIds', message: `Lines ${bad.join(', ')} are not available for settlement with ${ins.name}` }]);
  const period = b.settlementPeriod ?? existing.settlementPeriod;
  if (!Array.isArray(period) || !isoDate(period[0]) || !isoDate(period[1])) throw badRequest('Validation failed', [{ path: 'settlementPeriod', message: 'Settlement period [from, to] is required' }]);
  const adj = { previousBalance: b.previousBalance ?? existing.previousBalance ?? 0, creditNotes: b.creditNotes ?? existing.creditNotes ?? 0, debitNotes: b.debitNotes ?? existing.debitNotes ?? 0, otherAdjustments: b.otherAdjustments ?? existing.otherAdjustments ?? 0 };
  const totals = calculateTotals(lines, adj);
  const param = await one('SELECT data FROM master_records WHERE type_code = \'remittance-settlement-parameter\' AND status = \'active\' AND (code = $1 OR $1 IS NULL) ORDER BY id LIMIT 1', [b.parameterCode ?? existing.parameterCode ?? null]);
  if (param?.data) {
    const min = toNumber(param.data.minimumAmount, 0);
    const max = toNumber(param.data.maximumAmount, 0);
    if (min && totals.netAmount < min) throw badRequest('Validation failed', [{ path: 'netAmount', message: `Net amount is below the minimum settlement amount (${min})` }]);
    if (max && totals.netAmount > max) throw badRequest('Validation failed', [{ path: 'netAmount', message: `Net amount exceeds the maximum settlement amount (${max}); split the settlement` }]);
  }
  return {
    ins, totals, data: {
      ...existing, settlementDate: isoDate(b.settlementDate ?? existing.settlementDate) || (await today()), settlementType: b.settlementType ?? existing.settlementType ?? 'Regular',
      insurerCode: ins.code, insurerName: ins.name, settlementPeriod: [isoDate(period[0]), isoDate(period[1])], ...adj,
      remarks: b.remarks ?? existing.remarks ?? '', paymentMethod: b.paymentMethod ?? existing.paymentMethod ?? null, bankAccount: b.bankAccount ?? existing.bankAccount ?? null,
      paymentReference: b.referenceNo ?? existing.paymentReference ?? '', paymentDate: isoDate(b.paymentDate ?? existing.paymentDate), parameterCode: param?.data?.code || null,
      lineIds, remittanceIds: [...new Set(lines.map((l) => l.remittance_id))], policies: lines.map((l) => ({ id: Number(l.id), policyNo: l.policy_number, insuredName: l.insured_name, product: l.product, premium: l.premium, commission: l.commission, tax: l.tax, netAmount: l.net })),
      ...totals,
    },
  };
}

export async function createSettlement(b, user) {
  const { ins, totals, data } = await settlementData(b);
  const ref = await nextDocumentNumber('settlement');
  const id = await insertItemNoTx({ kind: 'settlement', referenceNo: ref, insurerId: ins.id, amount: totals.netAmount, status: 'Draft', data: { ...data, settlementNo: ref }, userId: user.id });
  const x = await getItem('settlement', id);
  if (b.submit) return submitSettlement(x.id, {}, user);
  return itemOut(x);
}

export async function updateSettlement(id, b, user) {
  const x = await getItem('settlement', id);
  if (!['Draft', 'Rejected'].includes(x.status)) throw conflict(`A ${x.status.toLowerCase()} settlement cannot be edited`);
  const { ins, totals, data } = await settlementData(b, x.data);
  await query('UPDATE remittance_items SET data = $2, amount = $3, insurance_company_id = $4, status = \'Draft\', updated_by = $5, updated_at = now() WHERE id = $1', [x.id, JSON.stringify(data), totals.netAmount, ins.id, user.id]);
  return { before: itemOut(x), after: itemOut(await getItem('settlement', x.id)) };
}

export async function submitSettlement(id, b, user) {
  const x = await getItem('settlement', id);
  if (!['Draft', 'Rejected'].includes(x.status)) throw conflict(`Settlement is already ${x.status.toLowerCase()}`);
  const d = { ...x.data, ...(b.paymentMethod ? { paymentMethod: b.paymentMethod } : {}), ...(b.bankAccount ? { bankAccount: b.bankAccount } : {}) };
  const errors = [];
  if (!d.paymentMethod) errors.push({ path: 'paymentMethod', message: 'Payment method is required' });
  if (d.paymentMethod && !/check|cheque/i.test(d.paymentMethod) && !d.bankAccount) errors.push({ path: 'bankAccount', message: 'Bank account is required' });
  if (errors.length) throw badRequest('Validation failed', errors);
  await withTransaction(async (c) => {
    await c.query('UPDATE remittance_items SET status = \'Pending Approval\', data = $2, updated_by = $3, updated_at = now() WHERE id = $1', [x.id, JSON.stringify(d), user.id]);
    await c.query('DELETE FROM remittance_approvals WHERE entity = \'item\' AND entity_id = $1 AND status = \'Pending\'', [x.id]);
    await openApproval(c, { entity: 'item', entityId: x.id, referenceNo: x.reference_no, transactionType: 'Settlement', amount: Number(x.amount), description: `Settlement to ${d.insurerName} (${d.policies.length} policies)`, initiatorId: user.id });
  });
  return itemOut(await getItem('settlement', x.id));
}

// ---------------- adjustments ----------------

export async function createAdjustment(b, user) {
  requireFields(b, ['adjustmentType', 'reason', 'effectiveDate']);
  const amount = toNumber(b.adjustmentAmount ?? b.amount, NaN);
  if (!Number.isFinite(amount) || amount === 0) throw badRequest('Validation failed', [{ path: 'adjustmentAmount', message: 'Amount must be a non-zero number' }]);
  const type = await one('SELECT data FROM master_records WHERE type_code = \'remittance-adjustment-type\' AND status = \'active\' AND (lower(name) = lower($1) OR lower(code) = lower($1))', [b.adjustmentType]);
  if (!type) throw badRequest('Validation failed', [{ path: 'adjustmentType', message: `${b.adjustmentType} is not an active adjustment type` }]);
  let rem = null;
  if (b.remittanceId || b.remittanceNo) rem = await getRemittance(b.remittanceId || b.remittanceNo);
  const ref = b.referenceNo ? String(b.referenceNo) : await nextDocumentNumber('adjustment');
  if (await one('SELECT 1 FROM remittance_items WHERE reference_no = $1', [ref])) throw conflict(`Reference ${ref} already exists`);
  const original = toNumber(b.originalAmount ?? rem?.netAmount, 0);
  const needsApproval = type.data.requiresApproval !== false || (type.data.approvalLimit && Math.abs(amount) > toNumber(type.data.approvalLimit));
  const data = {
    referenceNo: ref, adjustmentType: type.data.name, adjustmentCode: type.data.code, policyNo: b.policyNo || null, clientName: b.clientName || rem?.insurerName || rem?.agencyName || null,
    originalAmount: original, adjustmentAmount: amount, newAmount: round2(original + amount), reason: b.reason, description: b.description || '', effectiveDate: isoDate(b.effectiveDate),
    requestedBy: user.username, requestDate: ts(new Date()), approvalLevel: 1, dueDate: isoDate(b.dueDate), remittanceNo: rem?.remittanceNo || null,
  };
  const id = await withTransaction(async (c) => {
    const itemId = await insertItem(c, { kind: 'adjustment', referenceNo: ref, remittanceId: rem?.id, amount, status: needsApproval ? 'Pending Approval' : 'Approved', data, userId: user.id });
    if (needsApproval) await openApproval(c, { entity: 'item', entityId: itemId, referenceNo: ref, transactionType: 'Adjustment', amount, description: `${type.data.name}: ${b.reason}`, initiatorId: user.id });
    else {
      if (rem) await c.query('UPDATE remittances SET adjustments = adjustments + $2, net_due = net_due + $2, updated_at = now() WHERE id = $1', [rem.id, amount]);
      await postItemJournal(c, (await c.query('SELECT * FROM remittance_items WHERE id = $1', [itemId])).rows[0], user);
    }
    return itemId;
  });
  return itemOut(await getItem('adjustment', id));
}

export async function completeItem(kind, id, fromStatuses, toStatus, extra, user) {
  const x = await getItem(kind, id);
  if (!fromStatuses.includes(x.status)) throw conflict(`${kind} is ${x.status}; expected ${fromStatuses.join(' or ')}`);
  await query('UPDATE remittance_items SET status = $2, data = data || $3, updated_by = $4, updated_at = now() WHERE id = $1', [x.id, toStatus, JSON.stringify(extra || {}), user.id]);
  return { before: itemOut(x), after: itemOut(await getItem(kind, x.id)) };
}

export const adjustmentHistoryOut = (x) => ({ id: x.id, referenceNo: x.reference_no, adjustmentType: x.data.adjustmentType, amount: x.amount, status: x.status,
  processedDate: ts(x.approved_at || x.updated_at), processedBy: x.approved_by_name || x.updated_by_name || 'System' });

// ---------------- electronic transfers ----------------

export async function transferMethods() {
  return (await getSetting('remittance.transfer_methods', [])) || [];
}

export const transferOut = (x) => ({ ...itemOut(x), reference: x.reference_no, date: x.data.scheduledDate || x.created_at.toISOString().slice(0, 10) });

export async function createTransfer(b, user) {
  requireFields(b, ['beneficiary', 'method']);
  const amount = toNumber(b.amount, NaN);
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Validation failed', [{ path: 'amount', message: 'Amount must be greater than zero' }]);
  const method = (await transferMethods()).find((m) => m.value === b.method || m.label === b.method);
  if (!method) throw badRequest('Validation failed', [{ path: 'method', message: 'Unknown transfer method' }]);
  if (method.limit && amount > method.limit) throw badRequest('Validation failed', [{ path: 'amount', message: `Amount exceeds the ${method.label} limit of ${method.limit}` }]);
  let rem = null;
  if (b.remittanceId || b.remittanceNo) {
    rem = await getRemittance(b.remittanceId || b.remittanceNo);
    if (!['approved', 'settled'].includes(rem.statusCode)) throw conflict('Only approved remittances can be paid by transfer');
  }
  const ins = await findInsurer(b.insurerCode ?? rem?.insurerId, { required: false });
  const ref = await nextDocumentNumber('transfer');
  const data = { beneficiary: b.beneficiary, method: method.value, accountNumber: b.accountNumber || null, bankName: b.bankName || null, bankAccount: b.bankAccount || null,
    purpose: b.purpose || b.description || '', scheduledDate: isoDate(b.scheduledDate) || (await today()), remittanceNo: rem?.remittanceNo || null };
  const id = await withTransaction(async (c) => {
    const itemId = await insertItem(c, { kind: 'transfer', referenceNo: ref, remittanceId: rem?.id, insurerId: ins?.id, amount, status: 'Pending', data, userId: user.id });
    await openApproval(c, { entity: 'item', entityId: itemId, referenceNo: ref, transactionType: 'Electronic Transfer', amount, description: `${method.label} to ${b.beneficiary}`, initiatorId: user.id });
    return itemId;
  });
  return transferOut(await getItem('transfer', id));
}

// ---------------- statements ----------------

const STATEMENT_COLUMNS = [
  { key: 'transactionDate', label: 'Transaction Date' }, { key: 'remittanceNo', label: 'Remittance No' }, { key: 'policyNumber', label: 'Policy Number' },
  { key: 'insuredName', label: 'Insured Name' }, { key: 'insurerName', label: 'Insurer' }, { key: 'premium', label: 'Premium' }, { key: 'commission', label: 'Commission' },
  { key: 'tax', label: 'Taxes' }, { key: 'netAmount', label: 'Net Amount' }, { key: 'status', label: 'Status' },
];

async function statementRows({ period, insurers, from, to }) {
  const p = params();
  const conds = ['r.status <> \'rejected\''];
  if (period) conds.push(`to_char(r.remittance_date, 'YYYY-MM') = ${p.add(period)}`);
  if (from) conds.push(`r.remittance_date >= ${p.add(from)}::date`);
  if (to) conds.push(`r.remittance_date <= ${p.add(to)}::date`);
  if (insurers?.length) conds.push(`(i.code = ANY(${p.add(insurers)}) OR i.id::text = ANY($${p.values.length}))`);
  const labels = await statusLabels();
  const rows = await many(`SELECT r.remittance_date, r.remittance_number, r.status, i.name AS insurer_name, l.policy_number, l.insured_name, l.premium, l.commission, l.tax, l.net
    FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id
    WHERE ${conds.join(' AND ')} ORDER BY i.name, r.remittance_date, l.id`, p.values);
  return rows.map((r) => ({ transactionDate: r.remittance_date, remittanceNo: r.remittance_number, policyNumber: r.policy_number, insuredName: r.insured_name, insurerName: r.insurer_name,
    premium: r.premium, commission: r.commission, tax: r.tax, netAmount: r.net, status: labels[r.status] || r.status }));
}

const periodOf = (v) => (v ? (isoDate(v) || '').slice(0, 7) || String(v).slice(0, 7) : null);

export async function statementPreview(qs) {
  const insurers = qs.insurers ? String(qs.insurers).split(',').filter(Boolean) : [];
  const rows = await statementRows({ period: periodOf(qs.period), insurers });
  return { rows: rows.slice(0, 50), totalRows: rows.length, totals: { premium: round2(rows.reduce((s, r) => s + r.premium, 0)), netAmount: round2(rows.reduce((s, r) => s + r.netAmount, 0)) } };
}

export async function generateStatement(b, user) {
  const period = periodOf(b.period);
  if (!period || !/^\d{4}-\d{2}$/.test(period)) throw badRequest('Validation failed', [{ path: 'period', message: 'Statement period is required' }]);
  const insurers = b.selectionType === 'all' ? [] : (b.insurers || b.selectedInsurers || []).map((i) => (typeof i === 'object' ? i.code || i.value : i));
  const tplCode = b.templateCode || null;
  const tpl = tplCode ? await one('SELECT data FROM master_records WHERE type_code = \'remittance-statement-template\' AND code = $1 AND status = \'active\'', [tplCode]) : null;
  if (tplCode && !tpl) throw badRequest('Validation failed', [{ path: 'templateCode', message: 'Unknown statement template' }]);
  const rows = await statementRows({ period, insurers });
  const ref = await nextDocumentNumber('statement');
  const fileName = `Statement_${period.replace('-', '_')}_${ref}.csv`;
  const saved = await saveFile({ category: 'remittance-statements', fileName, content: toCsv(rows, STATEMENT_COLUMNS), contentType: 'text/csv', entity: 'remittance_statement', entityId: ref, userId: user.id });
  const totals = { premium: round2(rows.reduce((s, r) => s + r.premium, 0)), commission: round2(rows.reduce((s, r) => s + r.commission, 0)), netAmount: round2(rows.reduce((s, r) => s + r.netAmount, 0)) };
  const data = { statementId: ref, statementType: b.statementType || tpl?.data?.type || 'Account Statement', period, insurers, templateCode: tplCode, format: 'CSV', requestedFormat: b.format || tpl?.data?.format || 'CSV',
    fileName, fileSize: fileSize(saved.size), generatedAt: new Date().toISOString(), downloadUrl: saved.url, previewUrl: saved.url, rowCount: rows.length, totals };
  await insertItemNoTx({ kind: 'statement', referenceNo: ref, amount: totals.netAmount, status: 'Generated', data, userId: user.id });
  if (Array.isArray(b.emailTo) && b.emailTo.length) {
    const vars = { period, fileName, downloadUrl: saved.url, companyName: await companyName() };
    const subject = renderTemplate(await getSetting('remittance.statement_email_subject'), vars);
    const html = renderTemplate(await getSetting('remittance.statement_email_body'), vars);
    for (const to of b.emailTo) await queueEmail({ to, subject, html, template: 'remittance-statement', entity: 'remittance_statement', entityId: ref });
  }
  return { success: true, ...data };
}

// ---------------- exceptions ----------------

export const exceptionOut = (x) => ({ ...itemOut(x), exceptionId: x.reference_no, age: Math.floor((Date.now() - new Date(x.created_at).getTime()) / 86400000) });

export async function createException(b, user) {
  requireFields(b, ['type', 'description']);
  const t = await one('SELECT data FROM master_records WHERE type_code = \'remittance-exception\' AND status = \'active\' AND (lower(name) = lower($1) OR lower(code) = lower($1) OR lower(data->>\'category\') = lower($1))', [b.type]);
  const severities = ['Low', 'Medium', 'High', 'Critical'];
  const severity = b.severity || t?.data?.severity || 'Medium';
  if (!severities.includes(severity)) throw badRequest('Validation failed', [{ path: 'severity', message: `severity must be one of ${severities.join(', ')}` }]);
  let rem = null;
  if (b.remittanceNo || b.remittanceId) rem = await getRemittance(b.remittanceNo || b.remittanceId);
  const ref = await nextDocumentNumber('remittance_exception');
  const data = { type: b.type, exceptionCode: t?.data?.code || null, severity, remittanceNo: rem?.remittanceNo || b.remittanceNo || null, description: b.description, assignedTo: b.assignedTo || '',
    detectedOn: (await today()), bankRef: b.bankRef || null, sysRef: b.sysRef || null, difference: b.difference == null ? null : toNumber(b.difference), action: b.action || 'Review', sla: t?.data?.sla || null };
  const id = await insertItemNoTx({ kind: 'exception', referenceNo: ref, remittanceId: rem?.id, amount: toNumber(b.amount ?? b.difference, 0), status: 'Open', priority: severity, data, userId: user.id });
  return exceptionOut(await getItem('exception', id));
}

// ---------------- notifications ----------------

export const sentOut = (x) => ({ ...itemOut(x), recipients: Array.isArray(x.data.recipients) ? x.data.recipients.join(', ') : x.data.recipients, sentDate: ts(x.created_at) });

export async function sendNotification(b, user) {
  requireFields(b, ['subject']);
  const content = b.content ?? b.message ?? b.body;
  if (!content) throw badRequest('Validation failed', [{ path: 'content', message: 'Message content is required' }]);
  const recipients = (Array.isArray(b.recipients) ? b.recipients : String(b.recipients || '').split(/[,;]/)).map((r) => String(r).trim()).filter(Boolean);
  if (!recipients.length) throw badRequest('Validation failed', [{ path: 'recipients', message: 'At least one recipient is required' }]);
  const channel = b.channel || 'Email';
  const emails = recipients.filter((r) => /@/.test(r));
  if (/email/i.test(channel)) for (const to of emails) await queueEmail({ to, subject: b.subject, html: `<p>${String(content).replace(/</g, '&lt;')}</p>`, template: b.templateCode || 'remittance-notification', entity: 'remittance_notification' });
  const ref = await nextDocumentNumber('remittance_notice');
  const data = { type: b.type || 'General', subject: b.subject, content, recipients, recipientType: b.recipientType || 'Client', channel, templateCode: b.templateCode || null, queuedEmails: emails.length, deliveryRate: null, openRate: null };
  const id = await insertItemNoTx({ kind: 'notification', referenceNo: ref, status: 'Sent', priority: b.priority || 'Normal', data, userId: user.id });
  return sentOut(await getItem('notification', id));
}

export async function inbox(user) {
  // same visibility as the bell: own notifications and those addressed to a permission the user holds (D119)
  const rows = await many(`SELECT * FROM notifications WHERE (user_id = $1 OR (user_id IS NULL AND (audience IS NULL OR audience = ANY($2::text[]))))
    AND (entity LIKE 'remittance%' OR entity = 'item' OR link LIKE '/finance/remittance%') ORDER BY created_at DESC LIMIT 200`, [user.id, user.permissions || []]);
  return rows.map((n) => ({ id: n.id, type: n.type === 'approval' ? 'Approval Request' : 'System Alert', subject: n.title, sender: 'Remittance System', recipientType: 'User', sentDate: ts(n.created_at),
    status: n.is_read ? 'Read' : 'Delivered', priority: n.type === 'approval' ? 'High' : 'Normal', channel: 'System', content: n.message, isRead: n.is_read, hasAttachment: false, link: n.link }));
}

// ---------------- schedules ----------------

const STEP_DAYS = { daily: 1, weekly: 7 };
/**
 * Next run of a schedule as 'YYYY-MM-DD HH:mm': the stored next run (with its time, or the schedule's time, once) rolled
 * forward by the frequency when it is already past, so "Upcoming events" never lists a run in the past.
 */
export function nextRunOf(r, now = new Date()) {
  if (!r.nextRun) return null;
  const text = String(r.nextRun).trim();
  const date = text.slice(0, 10);
  const time = (/\d{2}:\d{2}/.exec(text.slice(10)) || [])[0] || (/^\d{2}:\d{2}/.exec(String(r.time || '')) || [])[0] || '00:00';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return text;
  const at = new Date(`${date}T${time}:00`);
  const freq = String(r.frequency || '').toLowerCase();
  for (let i = 0; at < now && i < 1000; i += 1) {
    if (STEP_DAYS[freq]) at.setDate(at.getDate() + STEP_DAYS[freq]);
    else if (freq === 'monthly') at.setMonth(at.getMonth() + 1);
    else if (freq === 'quarterly') at.setMonth(at.getMonth() + 3);
    else break;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export async function schedules() {
  const t = await masters.getType('remittance-schedule');
  const { rows } = await masters.listRecords(t, {}, { limit: 500, offset: 0 });
  const runs = await many('SELECT data->>\'scheduleId\' AS sid, max(created_at) AS last FROM remittance_items WHERE kind = \'execution\' AND data ? \'scheduleId\' GROUP BY 1');
  const jobs = rows.map((r) => ({ ...r, id: r.id, name: r.name, frequency: r.frequency, nextRun: nextRunOf(r),
    lastRun: runs.find((x) => Number(x.sid) === r.id)?.last || r.lastRun || null, status: r.status === 'Active' ? 'Active' : 'Paused' }));
  const upcomingEvents = jobs.filter((j) => j.status === 'Active' && j.nextRun).sort((a, b) => String(a.nextRun).localeCompare(String(b.nextRun)))
    .slice(0, 10).map((j) => ({ status: j.nextRun, date: String(j.nextRun).slice(0, 10), content: j.name, scheduleId: j.id }));
  return { scheduledJobs: jobs, upcomingEvents };
}

export async function runSchedule(id, user) {
  const t = await masters.getType('remittance-schedule');
  const s = await masters.getRecord(t, id);
  if (s.status !== 'Active') throw conflict('Schedule is paused');
  const linked = Array.isArray(s.linkedProcesses) ? s.linkedProcesses : [];
  const configCode = linked.find((x) => /^ARM-/.test(String(x))) || null;
  const result = await executeAutomated({ configCode }, user, `schedule:${s.code}`);
  await query('UPDATE remittance_items SET data = data || $2 WHERE reference_no = $1', [result.executionId, JSON.stringify({ scheduleId: String(s.id), scheduleCode: s.code })]);
  await query(`UPDATE master_records SET data = data || jsonb_build_object('lastRun', $2::text), updated_by = $3, updated_at = now() WHERE id = $1`, [s.id, (await today()), user.id]);
  return { schedule: await masters.getRecord(t, id), execution: result };
}

// ---------------- bulk processing ----------------

function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') inQ = false; else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delimiter) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur); rows.push(row); row = []; cur = '';
      assertRowLimit(rows.length - 1);
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const DEFAULT_MAPPINGS = [{ sourceField: 'PolicyNo', targetField: 'policy_number', required: true }, { sourceField: 'Premium', targetField: 'premium_amount', required: true },
  { sourceField: 'Commission', targetField: 'commission_amount', required: false }, { sourceField: 'Tax', targetField: 'tax_amount', required: false }];

export async function uploadBulk(file, b, user) {
  if (!file) throw badRequest('file is required (multipart field "file")');
  const cfgRow = await one('SELECT data FROM master_records WHERE type_code = \'remittance-bulk-processing\' AND status = \'active\' AND ($1::text IS NULL OR code = $1) ORDER BY id LIMIT 1', [b.configCode || null]);
  if (b.configCode && !cfgRow) throw badRequest('Validation failed', [{ path: 'configCode', message: 'Unknown bulk processing configuration' }]);
  const cfg = cfgRow?.data || {};
  const maxBytes = Math.min(toNumber(cfg.maxFileSize, 0) * 1048576 || Infinity, Number(await getSetting('uploads.bulk_max_bytes', 10485760)));
  if (file.size > maxBytes) throw badRequest(`File exceeds the maximum size of ${fileSize(maxBytes)}`);
  const rows = parseCsv(file.buffer.toString('utf8'), cfg.delimiter || ',');
  if (!rows.length) throw badRequest('The file is empty');
  const header = cfg.hasHeader === false ? null : rows.shift().map((h) => String(h).trim());
  if (cfg.maxRecords && rows.length > cfg.maxRecords) throw badRequest(`The file has ${rows.length} records; the maximum is ${cfg.maxRecords}`);
  const maps = Array.isArray(cfg.fieldMappings) && cfg.fieldMappings.length ? cfg.fieldMappings : DEFAULT_MAPPINGS;
  const idx = (m, i) => (header ? header.findIndex((h) => h.toLowerCase() === String(m.sourceField).toLowerCase()) : i);
  const missing = header ? maps.filter((m) => m.required && idx(m) < 0).map((m) => m.sourceField) : [];
  if (missing.length) throw badRequest(`Missing required columns: ${missing.join(', ')}`);
  const errors = [];
  const valid = [];
  const seen = new Set();
  for (let r = 0; r < rows.length; r += 1) {
    const rec = Object.fromEntries(maps.map((m, i) => [m.targetField, idx(m, i) >= 0 ? String(rows[r][idx(m, i)] ?? '').trim() : '']));
    const rowErr = [];
    if (!rec.policy_number) rowErr.push({ field: 'policy_number', message: 'Not Empty' });
    const premium = toNumber(rec.premium_amount, NaN);
    if (!(premium > 0)) rowErr.push({ field: 'premium_amount', message: 'Positive Number' });
    const commission = toNumber(rec.commission_amount, 0);
    if (commission < 0 || commission > premium) rowErr.push({ field: 'commission_amount', message: 'Between 0 and Premium' });
    const pol = rec.policy_number ? await one('SELECT id, insurance_company_id FROM policies WHERE policy_number = $1', [rec.policy_number]) : null;
    if (rec.policy_number && !pol) rowErr.push({ field: 'policy_number', message: 'Policy not found' });
    if (rec.policy_number && seen.has(rec.policy_number)) rowErr.push({ field: 'policy_number', message: `Duplicate (${cfg.duplicateHandling || 'Skip'})` });
    seen.add(rec.policy_number);
    if (rowErr.length) errors.push(...rowErr.map((e) => ({ row: r + (header ? 2 : 1), ...e }))); else valid.push({ policyId: pol.id, insurerId: pol.insurance_company_id, premium, commission, tax: toNumber(rec.tax_amount, 0) });
  }
  const rules = Array.isArray(cfg.validationRules) && cfg.validationRules.length ? cfg.validationRules : [{ field: 'policy_number', rule: 'Not Empty' }, { field: 'premium_amount', rule: 'Positive Number' }];
  const validationResults = rules.map((ru) => { const bad = errors.filter((e) => e.field === ru.field).length; return { field: ru.field, rule: ru.rule, valid: rows.length - bad, invalid: bad, total: rows.length }; });
  const saved = await saveFile({ category: 'remittance-bulk', fileName: file.originalname, content: file.buffer, contentType: file.mimetype, entity: 'remittance_bulk', userId: user.id });
  const ref = await nextDocumentNumber('remittance_batch');
  const data = { fileName: file.originalname, fileSize: fileSize(file.size), fileUrl: saved.url, configCode: cfg.code || null, uploadedAt: new Date().toISOString(), uploadedBy: user.username,
    totalRecords: rows.length, successCount: valid.length, errorCount: rows.length - valid.length, errors: errors.slice(0, 500), validationResults, validRows: valid };
  const id = await insertItemNoTx({ kind: 'upload', referenceNo: ref, amount: round2(valid.reduce((s, v) => s + v.premium - v.commission - v.tax, 0)), status: valid.length ? 'Validated' : 'Failed', data, userId: user.id });
  return bulkOut(await getItem('upload', id));
}

export const bulkOut = (x) => {
  const { validRows, ...rest } = x.data;
  return { ...itemOut({ ...x, data: rest }), uploadDate: ts(x.created_at), processedBy: x.data.uploadedBy, validRowCount: (validRows || []).length };
};

export async function processBulk(id, user) {
  const x = await getItem('upload', id);
  if (x.status !== 'Validated') throw conflict(`Upload is ${x.status}; only validated uploads can be processed`);
  const byInsurer = new Map();
  for (const v of x.data.validRows || []) byInsurer.set(v.insurerId, [...(byInsurer.get(v.insurerId) || []), v]);
  const created = [];
  for (const [insurerId, lines] of byInsurer) {
    const avail = new Set((await eligiblePolicies({ insurerId, policyIds: lines.map((l) => l.policyId) })).map((p) => p.id));
    const use = lines.filter((l) => avail.has(l.policyId));
    if (!use.length) continue;
    created.push(await createRemittance({ kind: 'direct-bill', insurerId, lines: use.map((l) => ({ policyId: l.policyId, premium: l.premium, commission: l.commission, tax: l.tax })), remarks: `Bulk upload ${x.reference_no}` }, user));
  }
  await query('UPDATE remittance_items SET status = $2, data = data || $3, updated_by = $4, updated_at = now() WHERE id = $1',
    [x.id, created.length ? 'Processed' : 'Failed', JSON.stringify({ remittanceIds: created.map((r) => r.id), processedAt: new Date().toISOString() }), user.id]);
  return { upload: bulkOut(await getItem('upload', x.id)), remittances: created };
}

// ---------------- bank reconciliation ----------------
// Bank lines live in the one bank statement line table (bank_statement_lines, Accounts > Bank Reconciliation): lines
// imported here (source 'remittance', no bank account) plus the credit lines of the bank account named in
// remittance.reconciliation_bank_account. The remittance match is kept on the line (rem_* columns).

export const bankOut = (x) => ({ id: x.id, reference: x.txn_number || x.reference, bankReference: x.reference, transDate: isoDate(x.txn_date), amount: Number(x.amount),
  description: x.description || '', status: x.rem_status, matchedTo: x.rem_remittance_id || null, difference: x.rem_difference === null || x.rem_difference === undefined ? null : Number(x.rem_difference) });

async function bankLines(c = { query }, where = 'TRUE', values = []) {
  const account = String((await getSetting('remittance.reconciliation_bank_account', '')) || '').trim();
  return (await c.query(`SELECT l.* FROM bank_statement_lines l WHERE l.status = 'active' AND (l.source = 'remittance'
      OR (l.amount > 0 AND $1 <> '' AND l.bank_account_id IN (SELECT id FROM master_records WHERE type_code = 'bank-account' AND lower(code) = lower($1))))
      AND ${where} ORDER BY l.txn_date, l.created_at`, [account, ...values])).rows;
}
async function bankLine(id) {
  const x = (await bankLines({ query }, '(l.id = $2 OR l.txn_number = $2)', [String(id)]))[0];
  if (!x) throw notFound('bank-txn not found');
  return x;
}

export async function reconciliation() {
  const bank = (await bankLines()).map(bankOut);
  const sys = await many(`SELECT r.id, r.remittance_number, r.remittance_date, r.net_due, r.data, i.name AS insurer_name,
      (SELECT string_agg(l.policy_number, ', ') FROM remittance_lines l WHERE l.remittance_id = r.id) AS policies
    FROM remittances r LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id WHERE r.status IN ('approved', 'settled') ORDER BY r.remittance_date`);
  const systemTransactions = sys.map((r) => ({ id: r.id, policyNo: r.policies, premium: r.net_due, transDate: r.remittance_date, reference: r.remittance_number, insurerName: r.insurer_name,
    status: r.data?.reconciliation?.status || 'unmatched', matchedTo: r.data?.reconciliation?.bankId || null }));
  const exceptions = (await many(`${ITEM_SELECT} WHERE x.kind = 'exception' AND x.data->>'bankRef' IS NOT NULL AND x.status <> 'Resolved' ORDER BY x.created_at DESC`))
    .map((x) => ({ id: x.id, type: x.data.type, bankRef: x.data.bankRef, sysRef: x.data.sysRef || '-', difference: x.data.difference, action: x.data.action, status: x.status }));
  const matched = bank.filter((b) => b.status === 'matched').length;
  const partial = bank.filter((b) => b.status === 'partial').length;
  const unmatched = bank.length - matched - partial;
  return { bankTransactions: bank, systemTransactions, exceptions,
    summary: { total: bank.length, matched, partial, unmatched, successRate: bank.length ? round2((matched / bank.length) * 100) : 0,
      bankTotal: round2(bank.reduce((s, b) => s + b.amount, 0)), systemTotal: round2(systemTransactions.reduce((s, t) => s + t.premium, 0)) } };
}

export async function importBankTransactions(list, user) {
  if (!Array.isArray(list) || !list.length) throw badRequest('transactions must be a non-empty array');
  const out = [];
  for (const t of list) {
    const amount = toNumber(t.amount, NaN);
    const d = isoDate(t.transDate);
    if (!Number.isFinite(amount) || !d || !t.reference) throw badRequest('Validation failed', [{ path: 'transactions', message: 'Each transaction needs transDate, reference and amount' }]);
    if (await one('SELECT 1 FROM bank_statement_lines WHERE source = \'remittance\' AND status = \'active\' AND reference = $1', [String(t.reference)])) continue;
    const ref = await nextDocumentNumber('bank_txn');
    const x = await one(`INSERT INTO bank_statement_lines(txn_number, txn_date, description, reference, debit, credit, amount, source, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'remittance',$8,$8) RETURNING *`, [ref, d, t.description || '', String(t.reference), round2(Math.max(-amount, 0)), round2(Math.max(amount, 0)), round2(amount), user.id]);
    out.push(bankOut(x));
  }
  return out;
}

async function tolerance(v) {
  return v === undefined || v === null || v === '' ? Number(await getSetting('remittance.reconciliation_tolerance', 0.5)) : toNumber(v, 0);
}

async function markMatch(c, bank, rem, status, diff, userId) {
  await c.query('UPDATE bank_statement_lines SET rem_status = $2, rem_remittance_id = $3, rem_reference = $4, rem_difference = $5, updated_by = $6, updated_at = now() WHERE id = $1',
    [bank.id, status, rem.id, rem.remittance_number, diff, userId]);
  await c.query('UPDATE remittances SET data = data || $2 WHERE id = $1', [rem.id, JSON.stringify({ reconciliation: { status, bankId: bank.id, difference: diff } })]);
}

export async function autoMatch(b, user) {
  const tol = await tolerance(b.tolerance);
  const bank = await bankLines({ query }, 'l.rem_status = \'unmatched\'');
  let matched = 0;
  await withTransaction(async (c) => {
    for (const t of bank) {
      const rem = (await c.query(`SELECT * FROM remittances WHERE status IN ('approved', 'settled') AND COALESCE(data->'reconciliation'->>'status', 'unmatched') = 'unmatched'
          AND abs(net_due - $1) <= $2 ORDER BY (remittance_number = $3 OR bill_number = $3) DESC, abs(remittance_date - $4::date), created_at LIMIT 1`, [t.amount, tol, t.reference, isoDate(t.txn_date)])).rows[0];
      if (!rem) continue;
      await markMatch(c, t, rem, 'matched', round2(Number(t.amount) - Number(rem.net_due)), user.id);
      matched += 1;
    }
  });
  return { matched, tolerance: tol, ...(await reconciliation()).summary };
}

export async function manualMatch(b, user) {
  requireFields(b, ['bankId', 'remittanceId']);
  const t = await bankLine(b.bankId);
  if (t.rem_status !== 'unmatched') throw conflict('Bank transaction is already matched');
  const rem = await one('SELECT * FROM remittances WHERE (id = $1 OR remittance_number = $1) AND status IN (\'approved\', \'settled\')', [String(b.remittanceId)]);
  if (!rem) throw badRequest('Validation failed', [{ path: 'remittanceId', message: 'Approved remittance not found' }]);
  const diff = round2(Number(t.amount) - Number(rem.net_due));
  const tol = await tolerance(b.tolerance);
  const status = Math.abs(diff) <= tol ? 'matched' : 'partial';
  await withTransaction((c) => markMatch(c, t, rem, status, diff, user.id));
  const bankRef = t.reference || t.txn_number;
  if (status === 'partial') await createException({ type: 'Amount Mismatch', description: `Bank ${bankRef} differs from ${rem.remittance_number} by ${diff}`, bankRef, sysRef: rem.remittance_number, difference: diff, remittanceId: rem.id, severity: 'High' }, user);
  return { status, difference: diff, ...(await reconciliation()).summary };
}

export async function unmatch(bankId, user) {
  const t = await bankLine(bankId);
  if (t.rem_status === 'unmatched') throw conflict('Bank transaction is not matched');
  await withTransaction(async (c) => {
    await c.query('UPDATE bank_statement_lines SET rem_status = \'unmatched\', rem_remittance_id = NULL, rem_reference = NULL, rem_difference = NULL, updated_by = $2, updated_at = now() WHERE id = $1', [t.id, user.id]);
    if (t.rem_remittance_id) await c.query('UPDATE remittances SET data = data - \'reconciliation\' WHERE id = $1', [t.rem_remittance_id]);
  });
  return (await reconciliation()).summary;
}

// ---------------- analytics ----------------

async function kpis(from, to) {
  const r = await one(`SELECT count(*) FILTER (WHERE status = 'settled')::int AS settled, count(*) FILTER (WHERE status IN ('approved', 'settled'))::int AS approved,
      count(*)::int AS total, avg(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) FILTER (WHERE approved_at IS NOT NULL AND submitted_at IS NOT NULL) AS avg_hours
    FROM remittances WHERE remittance_date BETWEEN $1::date AND $2::date`, [from, to]);
  const t = await one(`SELECT count(*) FILTER (WHERE status = 'Completed')::int AS ok, count(*) FILTER (WHERE status = 'Failed')::int AS failed
    FROM remittance_items WHERE kind = 'transfer' AND created_at::date BETWEEN $1::date AND $2::date`, [from, to]);
  const e = await one('SELECT count(*)::int AS n FROM remittance_items WHERE kind = \'exception\' AND created_at::date BETWEEN $1::date AND $2::date', [from, to]);
  return {
    settlementEfficiency: r.approved ? round2((r.settled / r.approved) * 100) : 0,
    paymentSuccessRate: t.ok + t.failed ? round2((t.ok / (t.ok + t.failed)) * 100) : 0,
    averageProcessingHours: r.avg_hours == null ? 0 : round2(r.avg_hours),
    exceptionRate: r.total ? round2((e.n / r.total) * 100) : 0,
  };
}

export async function analytics(qs) {
  const to = isoDate(qs.to) || (await today());
  const from = isoDate(qs.from) || new Date(Date.parse(to) - 180 * 86400000).toISOString().slice(0, 10);
  const span = Date.parse(to) - Date.parse(from);
  const prevTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(prevTo) - span).toISOString().slice(0, 10);
  const [cur, prev] = [await kpis(from, to), await kpis(prevFrom, prevTo)];
  const targets = (await getSetting('remittance.kpi_targets', {})) || {};
  const defs = [['settlementEfficiency', 'Settlement Efficiency', '%', 'Settled share of approved remittances', true], ['paymentSuccessRate', 'Payment Success Rate', '%', 'Successful electronic transfers', true],
    ['averageProcessingHours', 'Average Processing Time', 'hours', 'Time from submission to approval', false], ['exceptionRate', 'Exception Rate', '%', 'Exceptions per remittance', false]];
  const kpiData = defs.map(([k, name, unit, description, higherBetter], i) => {
    const value = cur[k];
    const target = toNumber(targets[k], 0);
    const good = higherBetter ? value >= target : value <= target;
    return { id: i + 1, name, value, target, trend: prev[k] ? round2(((value - prev[k]) / prev[k]) * 100) : 0, status: good ? 'success' : 'warning', unit, description };
  });
  const topClients = (await many(`SELECT i.name, count(r.id)::int AS n, COALESCE(sum(r.net_due), 0) AS v,
      avg(EXTRACT(EPOCH FROM (r.approved_at - r.submitted_at)) / 3600) FILTER (WHERE r.approved_at IS NOT NULL) AS h,
      count(*) FILTER (WHERE r.status IN ('approved', 'settled'))::int AS ok, count(*) FILTER (WHERE r.status = 'rejected')::int AS bad
    FROM remittances r JOIN insurance_companies i ON i.id = r.insurance_company_id WHERE r.remittance_date BETWEEN $1::date AND $2::date
    GROUP BY i.name ORDER BY v DESC LIMIT 10`, [from, to])).map((c) => ({ clientName: c.name, transactionCount: c.n, totalValue: round2(c.v), avgProcessingTime: c.h == null ? 0 : round2(c.h),
    successRate: c.ok + c.bad ? round2((c.ok / (c.ok + c.bad)) * 100) : 0 }));
  const months = lastMonths(6, new Date(`${to}T00:00:00Z`));
  const m = await many(`SELECT to_char(remittance_date, 'YYYY-MM') AS k, count(*)::int AS n, COALESCE(sum(net_due), 0) AS v, count(*) FILTER (WHERE status = 'settled')::int AS s
    FROM remittances WHERE remittance_date >= $1::date GROUP BY 1`, [`${months[0].key}-01`]);
  const monthlyTrend = months.map(({ key, label }) => { const x = m.find((y) => y.k === key) || { n: 0, v: 0, s: 0 }; return { month: label, period: key, count: x.n, value: round2(x.v), settled: x.s }; });
  const labels = await statusLabels();
  const dist = await many('SELECT status, count(*)::int AS n FROM remittances WHERE remittance_date BETWEEN $1::date AND $2::date GROUP BY status', [from, to]);
  return { from, to, kpiData, topClients, monthlyTrend, statusDistribution: Object.fromEntries(dist.map((d) => [labels[d.status] || d.status, d.n])) };
}

// ---------------- reports ----------------

export async function generateReport(b, user) {
  requireFields(b, ['templateCode']);
  const tpl = await one('SELECT data FROM master_records WHERE type_code = \'remittance-report-template\' AND code = $1 AND status = \'active\'', [b.templateCode]);
  if (!tpl) throw badRequest('Validation failed', [{ path: 'templateCode', message: 'Unknown report template' }]);
  const from = isoDate(b.from) || `${new Date().toISOString().slice(0, 7)}-01`;
  const to = isoDate(b.to) || (await today());
  const rows = await statementRows({ from, to, insurers: b.insurers || [] });
  const ref = await nextDocumentNumber('remittance_report');
  const fileName = `${tpl.data.name.replace(/[^A-Za-z0-9]+/g, '_')}_${from}_${to}.csv`;
  const saved = await saveFile({ category: 'remittance-reports', fileName, content: toCsv(rows, STATEMENT_COLUMNS), contentType: 'text/csv', entity: 'remittance_report', entityId: ref, userId: user.id });
  await query(`INSERT INTO generated_reports(code, name, params, format, storage_key, row_count, generated_by, status) VALUES ($1,$2,$3,'csv',$4,$5,$6,'done')`,
    [`remittance:${b.templateCode}`, tpl.data.name, JSON.stringify({ from, to, insurers: b.insurers || [] }), saved.key, rows.length, user.id]);
  const data = { templateCode: b.templateCode, name: tpl.data.name, period: `${from} to ${to}`, generatedOn: new Date().toISOString(), fileName, fileSize: fileSize(saved.size), fileUrl: saved.url, rowCount: rows.length, downloads: 0, format: 'CSV' };
  const id = await insertItemNoTx({ kind: 'report', referenceNo: ref, amount: round2(rows.reduce((s, r) => s + r.netAmount, 0)), status: 'Completed', data, userId: user.id });
  return itemOut(await getItem('report', id));
}

// ---------------- history ----------------

export async function history(qs, pg) {
  const p = params();
  let cond = 'TRUE';
  if (qs.search) cond = `(h.reference_no ILIKE ${p.add(`%${qs.search}%`)} OR h.client_name ILIKE $${p.values.length})`;
  if (qs.type) cond += ` AND h.type = ${p.add(qs.type)}`;
  const labels = await statusLabels();
  const base = `
    SELECT r.id, r.remittance_number AS reference_no, CASE r.kind WHEN 'agency-bill' THEN 'Agency Bill' ELSE 'Insurer Remittance' END AS type,
      (SELECT min(l.policy_number) FROM remittance_lines l WHERE l.remittance_id = r.id) AS policy_no, COALESCE(i.name, r.agency_name) AS client_name, r.net_due AS amount, r.status,
      r.created_by, r.created_at, r.updated_at, r.updated_by, 'remittance' AS entity
    FROM remittances r LEFT JOIN insurance_companies i ON i.id = r.insurance_company_id
    UNION ALL
    SELECT x.id, x.reference_no, CASE x.kind WHEN 'settlement' THEN 'Settlement' WHEN 'adjustment' THEN 'Adjustment' ELSE 'Electronic Transfer' END,
      x.data->>'policyNo', COALESCE(x.data->>'insurerName', x.data->>'clientName', x.data->>'beneficiary'), x.amount, x.status, x.created_by, x.created_at, x.updated_at, x.updated_by, 'remittance_item'
    FROM remittance_items x WHERE x.kind IN ('settlement', 'adjustment', 'transfer')`;
  const total = (await one(`SELECT count(*)::int AS n FROM (${base}) h WHERE ${cond}`, p.values)).n;
  const rows = await many(`SELECT h.*, (SELECT display_name FROM users u WHERE u.id = h.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = h.updated_by) AS updated_by_name,
      (SELECT count(*)::int FROM audit_log a WHERE a.entity = h.entity AND a.entity_id = h.id) AS versions
    FROM (${base}) h WHERE ${cond} ORDER BY h.updated_at DESC LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  return { total, rows: rows.map((h) => ({ id: h.id, referenceNo: h.reference_no, type: h.type, policyNo: h.policy_no, clientName: h.client_name, amount: h.amount, status: labels[h.status] || h.status,
    createdBy: h.created_by_name || h.created_by, createdDate: ts(h.created_at), lastModified: ts(h.updated_at), modifiedBy: h.updated_by_name || h.updated_by, version: Math.max(1, h.versions), hasAuditTrail: h.versions > 0 })) };
}

export async function auditTrail(qs) {
  const p = params();
  let cond = 'a.entity IN (\'remittance\', \'remittance_item\', \'remittance_approval\')';
  if (qs.referenceNo) cond += ` AND (a.entity_id IN (SELECT id FROM remittances WHERE remittance_number = ${p.add(qs.referenceNo)} UNION SELECT id FROM remittance_items WHERE reference_no = $${p.values.length}) OR a.after_data->>'referenceNo' = $${p.values.length})`;
  const rows = await many(`SELECT a.*, COALESCE((SELECT remittance_number FROM remittances WHERE id = a.entity_id), (SELECT reference_no FROM remittance_items WHERE id = a.entity_id), a.after_data->>'referenceNo') AS ref
    FROM audit_log a WHERE ${cond} ORDER BY a.id DESC LIMIT 500`, p.values);
  return rows.map((a) => ({ id: Number(a.id), referenceNo: a.ref, actionType: a.action, previousValue: a.before_data?.status ?? null, newValue: a.after_data?.status ?? null,
    changedBy: a.username, changeDate: ts(a.at), ipAddress: a.ip, reason: a.after_data?.remarks || a.after_data?.comments || null }));
}

export async function systemLogs() {
  const rows = await many(`${ITEM_SELECT} WHERE x.kind IN ('execution', 'batch', 'upload', 'statement', 'report') ORDER BY x.created_at DESC LIMIT 200`);
  const module = { execution: 'Automated Remittance', batch: 'Remittance Processing', upload: 'Bulk Processing', statement: 'Statement Generation', report: 'Reports' };
  return rows.map((x) => ({ id: x.id, timestamp: new Date(x.created_at).toISOString().replace('T', ' ').slice(0, 19), level: ['Failed'].includes(x.status) ? 'ERROR' : 'INFO', module: module[x.kind],
    message: `${module[x.kind]} ${x.reference_no}: ${x.status}`, recordsProcessed: x.data.recordsProcessed ?? x.data.itemCount ?? x.data.totalRecords ?? x.data.rowCount ?? 0,
    executionTime: x.data.durationMs ? `${(x.data.durationMs / 1000).toFixed(1)}s` : null, user: x.created_by_name || 'System' }));
}

// ---------------- master overview ----------------

const MASTER_TYPE_LABEL = {
  'remittance-automated': 'Automated', 'remittance-statement-template': 'Statement', 'remittance-settlement-parameter': 'Settlement', 'remittance-reconciliation-rule': 'Reconciliation',
  'remittance-bulk-processing': 'BulkProcessing', 'remittance-schedule': 'Schedule', 'remittance-electronic-transfer': 'Electronic', 'remittance-approval-workflow': 'ApprovalWorkflow',
  'remittance-exception': 'Exception', 'remittance-report-template': 'ReportTemplate', 'remittance-agency-bill': 'AgencyBill', 'remittance-direct-bill': 'DirectBill',
  'remittance-adjustment-type': 'Adjustment', 'remittance-notification-template': 'Notification', 'remittance-history-config': 'History', 'remittance-analytics-config': 'Analytics',
};

export async function masterOverview(qs) {
  const p = params();
  let cond = 'm.type_code LIKE \'remittance-%\' AND m.status <> \'deleted\'';
  const typeCode = Object.entries(MASTER_TYPE_LABEL).find(([, l]) => l === qs.type)?.[0];
  if (typeCode) cond += ` AND m.type_code = ${p.add(typeCode)}`;
  if (qs.search) cond += ` AND (m.code ILIKE ${p.add(`%${qs.search}%`)} OR m.name ILIKE $${p.values.length})`;
  const rows = await many(`SELECT m.* FROM master_records m WHERE ${cond} ORDER BY m.type_code, m.code`, p.values);
  return rows.map((m) => ({ ...m.data, id: m.id, code: m.code, name: m.name, type: MASTER_TYPE_LABEL[m.type_code], typeCode: m.type_code, status: m.status === 'active', lastUpdated: m.updated_at.toISOString().slice(0, 10) }));
}
