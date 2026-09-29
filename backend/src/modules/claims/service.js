/**
 * Claims business logic: registration with acceptance controls, lifecycle transitions with claim_history,
 * field-level audit trail, settlement maker-checker, notifications, Preliminary Loss Advice e-mail,
 * printable documents and the dashboard / criteria reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { many, one, pool, withTransaction } from '../../db/pool.js';
import { allocate, isCoInsured, policyParticipants } from '../accounting/lib/coinsurance.js';
import { postEvent } from '../accounting/lib/posting.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney } from '../../lib/money.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { queueEmail } from '../../lib/mailer.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { notify } from '../notifications/router.js';
import { renderTemplate } from './docs.js';
import { companyName } from '../../lib/letterhead.js';
import { printContext, buildPdf } from '../../lib/pdf/index.js';
import { formatDate } from '../../lib/pdf/format.js';
import { daysBetween, parseJsonField, round2, storeUpload, toBool, toDate, toNum, today, unprocessable, usersWithRole } from './util.js';
import { nextDocumentNumber } from '../../lib/numbering.js';

export const STATUSES = ['registered', 'in-review', 'pending-approval', 'approved', 'settled', 'closed', 'rejected'];
export const PLACEHOLDER_REFS = new Set(['POLICY-001', 'LEAD-001', 'QUOTE-001', '']);

// ---------------------------------------------------------------- status vocabulary
export async function statusLabels() {
  const labels = await getSetting('claims.status_labels', {});
  return Object.fromEntries(STATUSES.map((s) => [s, labels?.[s] || s]));
}
/** Map a code, display label or alias ("Processing", "in-review") to a status code, or null. */
export async function toStatusCode(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (STATUSES.includes(s)) return s;
  const labels = await statusLabels();
  const byLabel = Object.entries(labels).find(([, l]) => String(l).toLowerCase() === s);
  if (byLabel) return byLabel[0];
  const aliases = (await getSetting('claims.status_aliases', {})) || {};
  return STATUSES.includes(aliases[s]) ? aliases[s] : null;
}
export const openStatuses = async () => (await getSetting('claims.open_statuses', ['registered', 'in-review', 'pending-approval', 'approved'])) || [];

// ---------------------------------------------------------------- read model
const BASE = `SELECT c.*, p.policy_number, p.inception_date, p.expiry_date, p.sum_insured AS policy_sum_insured,
  p.premium_total AS policy_premium, p.owner_user_id AS policy_owner, p.status AS policy_status, p.client_id AS policy_client_id,
  p.quote_id AS policy_quote_id, cl.display_name AS client_name, cl.first_name AS client_first_name, cl.last_name AS client_last_name,
  cl.email AS client_email, cl.phone AS client_phone, cl.address AS client_address, cl.house_no AS client_house_no,
  cl.barangay AS client_barangay, cl.city AS client_city, cl.state AS client_state,
  cl.country AS client_country, cl.postal_code AS client_postal, ic.name AS insurer_name, ic.contact_email AS insurer_email,
  pr.name AS product_name, pr.line AS product_line, hu.display_name AS handler_name
  FROM claims c JOIN policies p ON p.id = c.policy_id
  LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN users hu ON hu.id = c.handler_user_id`;

function flattenDriver(d = {}) {
  const keys = ['driverName', 'driverHouseNo', 'driverBarangay', 'driverCountry', 'driverProvince', 'driverCity', 'driverZipCode', 'driverRoadThanon', 'driverSoiAlley', 'driverMooVillage'];
  return Object.fromEntries(keys.map((k) => [k, d[k] ?? '']));
}
function witness(t = {}) {
  return [{
    name: t.thirdPartyName || '', contactNumber: t.thirdPartyContactNumber || '', policyNumber: t.thirdPartyPolicyNumber || '',
    insuranceCompanyName: t.thirdPartyInsuranceCompanyName || '', plateNumber: t.thirdPartyPlateNumber || '', unit: t.thirdPartyUnit || '',
    shop: t.thirdPartyShop || '', witnessName: t.witnessName || '', witnessContact: t.witnessContact || '',
  }];
}

/** API shape read by the claim screens (list, wizard steps, detailed view, dashboard). */
export function toApi(r, labels, todayStr, open) {
  const label = labels[r.status] || r.status;
  const info = r.policy_info || {};
  const address = {
    houseNo: info.houseNo || r.client_house_no || r.client_address || '', barangay: info.barangay || r.client_barangay || '', city: info.cityName || r.client_city || '',
    province: info.province || r.client_state || '', country: info.countryName || r.client_country || '', zipCode: info.zipCode || r.client_postal || '',
    roadThanon: info.roadThanon || '', soiAlley: info.soiAlley || '', mooVillage: info.mooVillage || '',
  };
  const isOpen = open.includes(r.status);
  const daysOverdue = isOpen && r.due_date && r.due_date < todayStr ? daysBetween(r.due_date, todayStr) : 0;
  const lob = r.lob || (r.product_line ? String(r.product_line).toUpperCase() : 'MOTOR');
  const settlement = r.settlement || {};
  return {
    id: r.id, claimId: r.id, claimNumber: r.claim_number, claimRefId: r.claim_number,
    status: label, claimStatus: label, lifecycleStatus: r.status,
    claimType: r.claim_type, claimPriority: r.priority, priority: r.priority, lob, productType: r.product_name || lob,
    policyId: r.policy_id, policyRefId: r.policy_id, policyNumber: r.policy_number,
    clientId: r.client_id || r.policy_client_id, leadRefId: r.lead_id, quoteRefId: r.quote_id || r.policy_quote_id,
    policyHolderName: info.policyHolderName || r.client_name, customerName: r.client_name, clientName: r.client_name,
    insuranceCompanyName: info.insuranceCompanyName || r.insurer_name, insuranceCompanyClaimNumber: r.insurer_claim_number || '',
    reportedDate: r.reported_date, dateOfIncident: r.loss_date, timeOfIncident: r.loss_time || '',
    addressOfIncident: r.loss_address || '', cityOfIncident: r.loss_city || '', provinceOfIncident: r.loss_province || '',
    typeOfIncident: r.loss_type || '', description: r.description || '',
    estimatedClaimAmount: r.estimate_amount, approvedAmount: r.approved_amount, settledAmount: r.settled_amount, settledAt: r.settled_at,
    isPolicyHolderTheDriver: r.is_holder_driver, ...flattenDriver(r.driver), ...address,
    thirdPartyDetails: r.third_party || {}, thirdPartyWitnessDetails: witness(r.third_party || {}),
    adjusterName: r.adjuster?.adjusterName || '', adjusterStatus: r.adjuster?.adjusterStatus || '', adjuster: r.adjuster || {},
    settlement, settlementType: settlement.settlementType || '', settlementAmount: settlement.settlementAmount ?? null,
    settlementIssueDate: settlement.settlementIssueDate || null, settlementDate: settlement.settlementDate || null,
    settlementRequestedBy: r.settlement_requested_by, settlementApprovedBy: r.settlement_approved_by, settlementApprovedAt: r.settlement_approved_at,
    rejectedReason: r.rejected_reason, handlerUserId: r.handler_user_id, handlerName: r.handler_name,
    claimDueDate: r.due_date, daysOverdue, isOpen, closedAt: r.closed_at,
    isCoInsurance: false, isCoInsurancePolicy: false, participatingInsurersCount: 0,
    policy: {
      id: r.policy_id, policyId: r.policy_id, policyNumber: r.policy_number, clientId: r.client_id || r.policy_client_id,
      insuredName: r.client_name, policyHolderName: r.client_name, insuranceCompanyName: r.insurer_name,
      productType: r.product_name, lob, inceptionDate: r.inception_date, expiryDate: r.expiry_date, issuedDate: r.inception_date, expiry: r.expiry_date,
      sumInsured: r.policy_sum_insured, premium: r.policy_premium, status: r.policy_status, isCoInsurance: false, ...address,
    },
    lead: null, quotation: null,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function readContext() {
  return { labels: await statusLabels(), todayStr: await today(), open: await openStatuses() };
}
async function loadRow(id) {
  const r = await one(`${BASE} WHERE c.id = $1 OR c.claim_number = $1`, [id]);
  if (!r) throw notFound('Claim not found');
  return r;
}
export async function getClaim(id) {
  const ctx = await readContext();
  const claim = toApi(await loadRow(id), ctx.labels, ctx.todayStr, ctx.open);
  claim.documents = (await many(`SELECT storage_key AS key, file_name AS "fileName", category AS "documentName", created_at AS "createdAt"
    FROM documents WHERE entity = 'claim' AND entity_id = $1 ORDER BY created_at`, [claim.id]))
    .map((d) => ({ ...d, downloadUrl: `${config.publicBaseUrl}/api/s3/object/${d.key}` }));
  claim.history = await many('SELECT at, by_user AS "byUser", status, note FROM claim_history WHERE claim_id = $1 ORDER BY at, id', [claim.id]);
  return Object.assign(claim, await coInsuranceOf(claim));
}

/**
 * Co-insurance view of a claim: the policy's participating insurers and each one's share of the claim, the settlement and
 * the recovery due from it (the broker recovers each insurer's share when the settlement is paid through the broker).
 */
export async function coInsuranceOf(claim) {
  const parts = claim.policyId ? await policyParticipants(claim.policyId, pool) : [];
  if (!isCoInsured(parts)) return { isCoInsurance: false, isCoInsurancePolicy: false, participatingInsurersCount: parts.length ? 1 : 0, participatingInsurers: [], coInsuranceSettlementRows: [] };
  const w = parts.map((p) => p.share);
  const claimAmount = Number(claim.approvedAmount ?? claim.estimatedClaimAmount) || 0;
  const settled = Number(claim.settledAmount ?? claim.settlementAmount ?? claim.approvedAmount) || 0;
  const cl = allocate(claimAmount, w); const st = allocate(settled, w);
  const rows = parts.map((p, i) => ({ participantId: String(p.insurerId), insurerId: p.insurerId, insurer: p.insurerName, insurerCode: p.insurerCode, role: p.isLead ? 'Lead Insurer' : 'Co-Insurer',
    sharePercentage: p.share, claimAmount: cl[i], settlementAmount: st[i], recoveryAmount: st[i], status: claim.claimStatus || '', isTotal: false }));
  const sum = (k) => round2(rows.reduce((s, r) => s + r[k], 0));
  const total = { participantId: 'total', insurer: 'TOTAL', role: '', sharePercentage: sum('sharePercentage'), claimAmount: sum('claimAmount'), settlementAmount: sum('settlementAmount'),
    recoveryAmount: sum('recoveryAmount'), status: claim.claimStatus || '', isTotal: true };
  return {
    isCoInsurance: true, isCoInsurancePolicy: true, participatingInsurersCount: parts.length,
    participatingInsurers: parts.map((p) => ({ insurerId: p.insurerId, insuranceCompanyName: p.insurerName, insurerCode: p.insurerCode, sharePercentage: p.share, isLead: p.isLead, role: p.isLead ? 'Lead Insurer' : 'Co-Insurer' })),
    coInsuranceSettlementRows: [...rows, total], policy: { ...claim.policy, isCoInsurance: true },
  };
}

/**
 * Settlement paid through the broker (settlement.paidThroughBroker, or a settlement type naming the broker): posting rule
 * claim.settlement.paid_through_broker books the amount recoverable from each insurer (its share) against the amount
 * payable to the claimant. Posted once per claim.
 */
export async function postBrokerSettlement(claimId, user) {
  return withTransaction(async (db) => {
    const c = (await db.query(`SELECT c.*, p.policy_number, p.client_id AS policy_client_id, cl.display_name AS client_name FROM claims c JOIN policies p ON p.id = c.policy_id
      LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id) WHERE c.id = $1 FOR UPDATE OF c`, [claimId])).rows[0];
    if (!c || c.settlement_jv_id || c.status !== 'settled' || !c.settlement?.paidThroughBroker) return null;
    const amount = round2(Number(c.settled_amount ?? c.settlement?.settlementAmount ?? 0));
    if (!(amount > 0)) return null;
    const parts = await policyParticipants(c.policy_id, db);
    const shares = allocate(amount, parts.map((p) => p.share));
    const jv = await postEvent('claim.settlement.paid_through_broker', {
      source: 'claims', entryType: 'CLAIM_SETTLEMENT', entrySubType: isCoInsured(parts) ? 'CO_INSURANCE' : null, transactionCode: c.claim_number, referenceType: 'Claim', referenceId: c.id,
      clientId: c.client_id || c.policy_client_id, policyId: c.policy_id, policyNumber: c.policy_number, amounts: { amount },
      participants: parts.map((p, i) => ({ insurerId: p.insurerId, insurerName: p.insurerName, share: p.share, amounts: { amount: shares[i] } })),
      vars: { claimNumber: c.claim_number, policyNumber: c.policy_number, claimant: c.settlement?.payee || c.client_name || 'claimant', insurer: parts[0]?.insurerName || 'insurer' },
    }, { db, user });
    await db.query('UPDATE claims SET settlement_jv_id = $2 WHERE id = $1', [c.id, jv.id]);
    return jv;
  });
}
const throughBroker = (input, prev) => {
  const v = input.paidThroughBroker ?? input.paidThroughBrokerFlag;
  if (v !== undefined && v !== null && v !== '') return v === true || String(v).toLowerCase() === 'true';
  if (input.settlementType && /broker/i.test(String(input.settlementType))) return true;
  return !!prev?.paidThroughBroker;
};

/** Paged, filtered list: status (code or label), clientId, policyId, lob, handler, search, dateFrom/dateTo. */
export async function listClaims(q, pg) {
  const where = [];
  const params = [];
  const add = (sql, ...vals) => {
    let out = sql;
    for (const v of vals) { params.push(v); out = out.replace('?', `$${params.length}`); }
    where.push(out);
  };
  if (q.status && String(q.status).toLowerCase() !== 'all') {
    const codes = [];
    for (const s of String(q.status).split(',')) { const c = await toStatusCode(s); if (c) codes.push(c); }
    if (String(q.status).toLowerCase() === 'open') codes.push(...(await openStatuses()));
    add('c.status = ANY(?)', codes.length ? codes : ['__none__']);
  }
  if (q.clientId) add('COALESCE(c.client_id, p.client_id) = ?', q.clientId);
  if (q.policyId) add('(c.policy_id = ? OR p.policy_number = ?)', q.policyId, q.policyId);
  if (q.lob) add('upper(c.lob) = upper(?)', q.lob);
  if (q.handlerUserId) add('c.handler_user_id = ?', q.handlerUserId);
  if (q.dateFrom || q.startDate) add('c.reported_date >= ?::date', q.dateFrom || q.startDate);
  if (q.dateTo || q.endDate) add('c.reported_date <= ?::date', q.dateTo || q.endDate);
  const search = q.search || q.q;
  if (search) add('(c.claim_number ILIKE ? OR p.policy_number ILIKE ? OR cl.display_name ILIKE ?)', `%${search}%`, `%${search}%`, `%${search}%`);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'claim', 'c', params));
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await one(`SELECT count(*)::int AS n FROM (${BASE} ${w}) t`, params)).n;
  const rows = await many(`${BASE} ${w} ORDER BY c.created_at DESC, c.claim_number DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  const ctx = await readContext();
  return { total, items: rows.map((r) => toApi(r, ctx.labels, ctx.todayStr, ctx.open)) };
}

// ---------------------------------------------------------------- trail helpers
async function trail(db, claimId, user, action, changes = [[null, null, null]]) {
  for (const [field, oldV, newV] of changes) {
    await db.query(`INSERT INTO claim_field_changes(claim_id, user_id, username, action, field_name, old_value, new_value) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [claimId, user?.id ?? null, user?.username ?? null, action, field, oldV == null ? null : String(oldV), newV == null ? null : String(newV)]);
  }
}
const history = (db, claimId, user, status, note) => db.query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1,$2,$3,$4)', [claimId, user?.username ?? null, status, note ?? null]);

// ---------------------------------------------------------------- acceptance controls
async function resolvePolicy(input) {
  const refs = [input.policyRefId, input.policyId, input.policyNumber].filter((v) => v && !PLACEHOLDER_REFS.has(String(v)));
  for (const ref of refs) {
    const p = await one(`SELECT p.*, pr.line AS product_line FROM policies p LEFT JOIN products pr ON pr.id = p.product_id
      WHERE p.id = $1 OR p.policy_number = $1`, [String(ref)]);
    if (p) return p;
  }
  throw badRequest('A valid policy (policyRefId, policyId or policyNumber) is required to register a claim');
}

/** Claims Acceptance Control: unpaid premium (configurable), loss date inside the policy period, policy not cancelled. */
export async function acceptanceCheck(policy, lossDate) {
  const problems = [];
  if (['cancelled'].includes(policy.status)) problems.push({ code: 'POLICY_CANCELLED', message: `Policy ${policy.policy_number} is cancelled` });
  if (lossDate > await today()) problems.push({ code: 'LOSS_DATE_FUTURE', message: 'Date of loss cannot be in the future' });
  if (await getSetting('claims.validate_loss_date', true)) {
    if (lossDate < policy.inception_date || lossDate > policy.expiry_date) {
      problems.push({ code: 'LOSS_OUTSIDE_PERIOD', message: `Date of loss ${lossDate} is outside the policy period ${policy.inception_date} to ${policy.expiry_date}` });
    }
  }
  if (await getSetting('claims.block_unpaid_premium', true)) {
    const due = (await one(`SELECT COALESCE(sum(balance), 0)::numeric AS due FROM receivables
      WHERE policy_id = $1 AND balance > 0 AND status NOT IN ('paid', 'written-off')`, [policy.id])).due;
    if (due > 0) problems.push({ code: 'UNPAID_PREMIUM', message: `Policy ${policy.policy_number} has unpaid premium of ${due}`, outstanding: due });
  }
  return problems;
}

async function pickHandler(requested) {
  if (requested) {
    const u = await one('SELECT id FROM users WHERE id = $1 AND status = \'active\'', [requested]);
    if (!u) throw badRequest('handlerUserId is not an active user');
    return u.id;
  }
  const r = await one(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'claims' AND u.status = 'active'
    ORDER BY (SELECT count(*) FROM claims c WHERE c.handler_user_id = u.id AND c.status NOT IN ('settled','closed','rejected')), u.created_at LIMIT 1`);
  return r?.id ?? null;
}

// ---------------------------------------------------------------- notifications and e-mail
async function notifyParties(claim, { title, message, type = 'info', extraUsers = [] }) {
  if (!(await getSetting('notification.claim_status', true))) return;
  const targets = new Set([claim.handler_user_id, claim.policy_owner, ...extraUsers].filter(Boolean));
  for (const userId of targets) {
    await notify({ userId, type, title, message, link: `/agent/claimdetail/${claim.id}`, entity: 'claim', entityId: claim.id });
  }
}

async function docVars(r, printFmt = null) {
  const currency = await getSetting('currency.default', 'PHP');
  const df = printFmt || { dateFormat: (await getSetting('general.date_format', 'DD/MM/YYYY')) || 'DD/MM/YYYY' };
  const date = (v) => (v ? formatDate(v, df) : '');
  const fmt = (n) => (n == null ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const labels = await statusLabels();
  return {
    claimNumber: r.claim_number, policyNumber: r.policy_number, insuredName: r.policy_info?.policyHolderName || r.client_name || '',
    insurerName: r.insurer_name || '', lob: r.lob || '', status: labels[r.status] || r.status,
    lossDate: date(r.loss_date), lossTime: r.loss_time || '', reportedDate: date(r.reported_date),
    lossPlace: [r.loss_address, r.loss_city, r.loss_province].filter(Boolean).join(', '), lossType: r.loss_type || '',
    currency, estimate: fmt(r.estimate_amount), approvedAmount: fmt(r.approved_amount), settledAmount: fmt(r.settled_amount ?? r.settlement?.settlementAmount),
    settlementType: r.settlement?.settlementType || '', slaDays: await getSetting('claims.sla_days', 20),
    companyName: await companyName(),
  };
}

/** Preliminary Loss Advice to the insurer (cc the insured), queued through the e-mail outbox. */
async function sendPla(r, emailData = {}) {
  if (!(await getSetting('claims.pla_enabled', true))) return null;
  const vars = { ...(await docVars(r)), message: emailData.write || '' };
  const to = r.insurer_email || await getSetting('claims.pla_default_recipient', null);
  if (!to) return null;
  const subject = emailData.mailSubject && emailData.mailSubject !== 'New Claim Notification'
    ? `${emailData.mailSubject} - ${r.claim_number}`
    : renderTemplate(await getSetting('claims.pla_subject'), vars, { html: false });
  const html = renderTemplate(await getSetting('claims.pla_template'), vars);
  return queueEmail({ to, cc: r.client_email || null, subject, html, template: 'claim-pla', entity: 'claim', entityId: r.id });
}

async function saveFiles(files, claimId, user) {
  const names = (await getSetting('claims.upload_document_names', {})) || {};
  for (const f of files || []) {
    const category = names[f.fieldname] || f.fieldname;
    await storeUpload(f, { category, entity: 'claim', entityId: claimId, userId: user?.id ?? null });
  }
}

// ---------------------------------------------------------------- commands
/** Register a claim (POST /claims). Enforces the acceptance controls; sends PLA and notifications. */
export async function createClaim(input, user, files) {
  const policy = await resolvePolicy(input);
  const lossDate = await toDate(input.dateOfIncident || input.lossDate);
  if (!lossDate) throw badRequest('dateOfIncident (date of loss) is required');
  const problems = await acceptanceCheck(policy, lossDate);
  if (problems.length) throw unprocessable(`Claim not accepted: ${problems.map((p) => p.message).join('; ')}`, problems);

  const reported = (await toDate(input.reportedDate)) || await today();
  assertReportedAfterLoss(lossDate, reported);
  const sla = Number(await getSetting('claims.sla_days', 20));
  const driver = parseJsonField(input.driverDetails, {});
  if (input.driverName) driver.driverName = input.driverName;
  const lob = String(input.lob || policy.product_line || 'MOTOR').toUpperCase();
  const handler = await pickHandler(input.handlerUserId);
  const number = await nextDocumentNumber('claim', { unique: { table: 'claims', column: 'claim_number' } });
  const leadId = PLACEHOLDER_REFS.has(String(input.leadRefId ?? '')) ? null : input.leadRefId;
  const quoteId = PLACEHOLDER_REFS.has(String(input.quoteRefId ?? '')) ? policy.quote_id : input.quoteRefId;

  const id = await withTransaction(async (db) => {
    const r = await db.query(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, reported_date, loss_type, description,
        estimate_amount, handler_user_id, lob, claim_type, priority, loss_time, loss_address, loss_city, loss_province, insurer_claim_number,
        is_holder_driver, driver, third_party, policy_info, lead_id, quote_id, due_date, details, created_by)
      VALUES ($1,$2,$3,'registered',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,($5::date + $24::int),$25,$26) RETURNING id`, [
      number, policy.id, policy.client_id, lossDate, reported, input.typeOfIncident || null, input.description || null,
      toNum(input.estimatedClaimAmount) ?? 0, handler, lob, input.claimType || (lob === 'FIRE' ? 'Fire' : 'Motor'),
      input.claimPriority || await getSetting('claims.default_priority', 'Medium'), input.timeOfIncident || null,
      input.addressOfIncident || null, input.cityOfIncident || null, input.provinceOfIncident || null, input.insuranceCompanyClaimNumber || null,
      toBool(input.isPolicyHolderTheDriver), JSON.stringify(driver), JSON.stringify(parseJsonField(input.thirdPartyDetails, {})),
      JSON.stringify(parseJsonField(input.policyInfo, {})), leadId || null, quoteId || null, sla,
      JSON.stringify({ emailData: parseJsonField(input.emailData, {}), isCoInsurance: toBool(input.isCoInsurance) }), user?.username ?? null,
    ]);
    const claimId = r.rows[0].id;
    await history(db, claimId, user, 'registered', 'Claim registered');
    await trail(db, claimId, user, 'Claim Registered', [['claimStatus', null, 'registered'], ['policyNumber', null, policy.policy_number], ['dateOfIncident', null, lossDate]]);
    return claimId;
  });
  await saveFiles(files, id, user);
  const row = await loadRow(id);
  await notifyParties(row, { type: 'task', title: `New claim ${number}`, message: `Claim ${number} registered on policy ${policy.policy_number}` });
  await sendPla(row, parseJsonField(input.emailData, {}));
  return getClaim(id);
}

/** A claim cannot be reported before the loss happened (D107). Dates are ISO yyyy-mm-dd strings. */
function assertReportedAfterLoss(lossDate, reportedDate) {
  if (lossDate && reportedDate && String(reportedDate) < String(lossDate)) {
    throw badRequest('Validation failed', [{ path: 'reportedDate', message: `Reported date ${reportedDate} cannot be before the date of loss ${lossDate}` }]);
  }
}

const EDITABLE = {
  insuranceCompanyClaimNumber: 'insurer_claim_number', timeOfIncident: 'loss_time', addressOfIncident: 'loss_address',
  cityOfIncident: 'loss_city', provinceOfIncident: 'loss_province', typeOfIncident: 'loss_type', description: 'description',
  claimPriority: 'priority', claimType: 'claim_type', lob: 'lob',
};

/** Update claim details / adjuster report (PUT /claims/:id). Allowed while registered or in review. */
export async function updateClaim(id, input, user, files) {
  const before = await loadRow(id);
  if (!['registered', 'in-review'].includes(before.status)) throw conflict(`Claim is ${before.status}; it can no longer be edited`);
  const sets = [];
  const params = [];
  const changes = [];
  const set = (col, val, field, oldVal) => {
    params.push(val); sets.push(`${col} = $${params.length}`);
    const o = oldVal ?? before[col];
    if (String(o ?? '') !== String(val ?? '')) changes.push([field, typeof o === 'object' && o !== null ? JSON.stringify(o) : o, val]);
  };
  for (const [field, col] of Object.entries(EDITABLE)) if (input[field] !== undefined && input[field] !== '') set(col, input[field], field);
  if (input.estimatedClaimAmount !== undefined && input.estimatedClaimAmount !== '') set('estimate_amount', toNum(input.estimatedClaimAmount), 'estimatedClaimAmount');
  if (input.reportedDate) set('reported_date', await toDate(input.reportedDate), 'reportedDate');
  if (input.dateOfIncident) {
    const lossDate = await toDate(input.dateOfIncident);
    if (lossDate !== before.loss_date && await getSetting('claims.validate_loss_date', true)
      && (lossDate < before.inception_date || lossDate > before.expiry_date)) {
      throw unprocessable(`Date of loss ${lossDate} is outside the policy period ${before.inception_date} to ${before.expiry_date}`);
    }
    set('loss_date', lossDate, 'dateOfIncident');
  }
  if (input.reportedDate || input.dateOfIncident) {
    const loss = input.dateOfIncident ? await toDate(input.dateOfIncident) : before.loss_date;
    const reported = input.reportedDate ? await toDate(input.reportedDate) : before.reported_date;
    assertReportedAfterLoss(loss, reported);
  }
  if (input.handlerUserId) set('handler_user_id', await pickHandler(input.handlerUserId), 'handlerUserId');
  const driver = { ...(before.driver || {}), ...parseJsonField(input.driverDetails, {}) };
  if (input.driverName) driver.driverName = input.driverName;
  if (JSON.stringify(driver) !== JSON.stringify(before.driver || {})) set('driver', JSON.stringify(driver), 'driverDetails', JSON.stringify(before.driver || {}));
  const tp = { ...(before.third_party || {}), ...parseJsonField(input.thirdPartyDetails, {}) };
  if (JSON.stringify(tp) !== JSON.stringify(before.third_party || {})) set('third_party', JSON.stringify(tp), 'thirdPartyDetails', JSON.stringify(before.third_party || {}));
  if (input.adjusterName || input.adjusterStatus) {
    const adj = { ...(before.adjuster || {}), adjusterName: input.adjusterName ?? before.adjuster?.adjusterName, adjusterStatus: input.adjusterStatus ?? before.adjuster?.adjusterStatus, submittedBy: user?.username, submittedAt: new Date().toISOString() };
    set('adjuster', JSON.stringify(adj), 'adjuster', JSON.stringify(before.adjuster || {}));
  }
  if (input.policyInfo) set('policy_info', JSON.stringify({ ...(before.policy_info || {}), ...parseJsonField(input.policyInfo, {}) }), 'policyInfo', JSON.stringify(before.policy_info || {}));
  if (!sets.length && !(files || []).length) throw badRequest('Nothing to update');
  if (sets.length) {
    await withTransaction(async (db) => {
      params.push(before.id);
      await db.query(`UPDATE claims SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
      if (changes.length) await trail(db, before.id, user, input.adjusterName ? 'Adjuster Report Submitted' : 'Claim Updated', changes);
    });
  }
  await saveFiles(files, before.id, user);
  return { before: toApi(before, await statusLabels(), await today(), await openStatuses()), after: await getClaim(before.id) };
}

const TRANSITIONS = {
  registered: ['in-review', 'rejected'],
  'in-review': ['pending-approval', 'approved', 'settled', 'rejected'],
  'pending-approval': ['approved', 'in-review', 'rejected'],
  approved: ['settled'],
  settled: ['closed'],
  rejected: ['closed'],
  closed: [],
};

async function transition(row, to, user, { note, sets = {}, action } = {}) {
  if (row.status === to) return;
  if (!TRANSITIONS[row.status]?.includes(to)) throw conflict(`Cannot move a claim from ${row.status} to ${to}`);
  await withTransaction(async (db) => {
    const cols = Object.keys(sets);
    const params = [row.id, to, ...cols.map((c) => sets[c])];
    await db.query(`UPDATE claims SET status = $2, updated_at = now()${cols.map((c, i) => `, ${c} = $${i + 3}`).join('')} WHERE id = $1`, params);
    await history(db, row.id, user, to, note);
    await trail(db, row.id, user, action || 'Status Changed', [['claimStatus', row.status, to], ...(note ? [['note', null, note]] : [])]);
  });
  row.status = to;
  const labels = await statusLabels();
  await notifyParties(row, { title: `Claim ${row.claim_number}: ${labels[to]}`, message: note || `Claim ${row.claim_number} is now ${labels[to]}` });
}

/** PUT /claims/updatestatus/:id — only statuses without their own workflow step (review, close, reject). */
export async function updateStatus(id, requested, user, note) {
  const to = await toStatusCode(requested);
  if (!to) throw badRequest(`Unknown claim status "${requested}"`);
  if (['pending-approval', 'approved', 'settled'].includes(to)) throw conflict(`Use the settlement endpoints to move a claim to ${to}`);
  const row = await loadRow(id);
  const from = row.status;
  if (to === 'closed') await transition(row, to, user, { note, sets: { closed_at: new Date() } });
  else if (to === 'rejected') await transition(row, to, user, { note, sets: { rejected_reason: note || null }, action: 'Claim Rejected' });
  else await transition(row, to, user, { note });
  return { from, claim: await getClaim(row.id) };
}

export async function rejectClaim(id, user, reason) {
  const row = await loadRow(id);
  const from = row.status;
  await transition(row, 'rejected', user, { note: reason || 'Claim rejected', sets: { rejected_reason: reason || null }, action: 'Claim Rejected' });
  return { from, claim: await getClaim(row.id) };
}

/**
 * PUT /claims/settle/:id. On an in-review claim this records the settlement; with maker-checker on it waits for
 * approval by another user (pending-approval), otherwise it is settled at once. On an approved claim it marks it settled.
 */
export async function settleClaim(id, input, user, files) {
  const row = await loadRow(id);
  const from = row.status;
  const amount = toNum(input.settlementAmount);
  const settlement = {
    ...(row.settlement || {}), settlementType: input.settlementType || row.settlement?.settlementType || null,
    settlementIssueDate: (await toDate(input.settlementIssueDate)) || row.settlement?.settlementIssueDate || null,
    settlementDate: (await toDate(input.settlementDate)) || row.settlement?.settlementDate || null,
  };
  settlement.paidThroughBroker = throughBroker(input, row.settlement);
  if (input.payee) settlement.payee = String(input.payee);
  if (amount !== null) settlement.settlementAmount = amount;
  await saveFiles(files, row.id, user);
  if (from === 'approved') {
    const final = settlement.settlementAmount ?? row.approved_amount;
    if (row.approved_amount != null && final > row.approved_amount) throw unprocessable(`Settlement amount exceeds the approved amount ${row.approved_amount}`);
    await transition(row, 'settled', user, { note: 'Settlement paid', action: 'Claim Settled', sets: { settlement: JSON.stringify(settlement), settled_amount: final, settled_at: new Date() } });
    await postBrokerSettlement(row.id, user);
    return { from, claim: await getClaim(row.id) };
  }
  if (from !== 'in-review') throw conflict(`Claim is ${from}; settlement can be submitted only while it is in review`);
  if (!(amount > 0)) throw badRequest('settlementAmount must be greater than zero');
  if (row.policy_sum_insured > 0 && amount > row.policy_sum_insured) throw unprocessable(`Settlement amount exceeds the policy sum insured ${row.policy_sum_insured}`);
  settlement.requestedBy = user?.username; settlement.requestedAt = new Date().toISOString();
  if (await getSetting('claims.settlement_maker_checker', true)) {
    await transition(row, 'pending-approval', user, { note: `Settlement of ${amount} submitted for approval`, action: 'Settlement Submitted', sets: { settlement: JSON.stringify(settlement), settlement_requested_by: user?.id ?? null } });
    const approvers = (await usersWithRole('claims')).map((u) => u.id).filter((u) => u !== user?.id);
    for (const a of approvers) {
      await notify({ userId: a, type: 'approval', title: `Settlement approval: ${row.claim_number}`, message: `Settlement of ${await formatMoney(amount)} on claim ${row.claim_number} awaits approval`, link: `/agent/claimdetail/${row.id}`, entity: 'claim', entityId: row.id });
    }
    return { from, claim: await getClaim(row.id), pendingApproval: true };
  }
  await transition(row, 'settled', user, { note: 'Settled', action: 'Claim Settled', sets: { settlement: JSON.stringify(settlement), approved_amount: amount, settled_amount: amount, settled_at: new Date() } });
  await postBrokerSettlement(row.id, user);
  return { from, claim: await getClaim(row.id) };
}

/** Checker decision on a pending settlement (approve or return to review). Approver must differ from the requester. */
export async function approveSettlement(id, { decision = 'approve', approvedAmount, note }, user) {
  const row = await loadRow(id);
  const from = row.status;
  if (from !== 'pending-approval') throw conflict('Claim has no settlement awaiting approval');
  if (row.settlement_requested_by && row.settlement_requested_by === user?.id) throw forbidden('Maker-checker: the settlement must be approved by a different user');
  if (decision === 'return' || decision === 'reject') {
    await transition(row, 'in-review', user, { note: note || 'Settlement returned for review', action: 'Settlement Returned' });
    return { from, claim: await getClaim(row.id) };
  }
  const amount = toNum(approvedAmount) ?? row.settlement?.settlementAmount;
  const settlement = { ...(row.settlement || {}), approvedBy: user?.username, approvedAt: new Date().toISOString() };
  await transition(row, 'approved', user, { note: note || `Settlement of ${amount} approved`, action: 'Settlement Approved', sets: { approved_amount: round2(amount), settlement: JSON.stringify(settlement), settlement_approved_by: user?.id ?? null, settlement_approved_at: new Date() } });
  if (await getSetting('claims.auto_settle_on_approval', true)) {
    const settledAmount = Math.min(round2(settlement.settlementAmount ?? amount), round2(amount));
    await transition(row, 'settled', user, { note: 'Settlement released', action: 'Claim Settled', sets: { settled_amount: settledAmount, settled_at: new Date() } });
    await postBrokerSettlement(row.id, user);
  }
  return { from, claim: await getClaim(row.id) };
}

export async function auditTrail(id, sort = 'desc') {
  const row = await loadRow(id);
  const dir = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const rows = await many(`SELECT id, at, username, action, field_name, old_value, new_value FROM claim_field_changes WHERE claim_id = $1 ORDER BY at ${dir}, id ${dir}`, [row.id]);
  return rows.map((r) => ({ id: r.id, timestamp: r.at, createdAt: r.at, action: r.action, fieldName: r.field_name, oldValue: r.old_value, newValue: r.new_value, user: r.username }));
}

/** Uploaded document with that name, else a generated PDF from the claims.documents templates. */
export async function claimDocument(id, documentName) {
  const row = await loadRow(id);
  if (!documentName) throw badRequest('documentName is required');
  const doc = await one(`SELECT * FROM documents WHERE entity = 'claim' AND entity_id = $1 AND lower(category) = lower($2) AND status = 'uploaded'
    ORDER BY created_at DESC LIMIT 1`, [row.id, documentName]);
  if (doc) {
    const p = path.resolve(config.uploadDir, doc.storage_key);
    if (p.startsWith(path.resolve(config.uploadDir)) && fs.existsSync(p)) return { file: p, contentType: doc.content_type || 'application/octet-stream', fileName: doc.file_name };
  }
  const templates = (await getSetting('claims.documents', {})) || {};
  const key = Object.keys(templates).find((k) => k.toLowerCase() === String(documentName).toLowerCase());
  if (!key) throw notFound(`Document "${documentName}" is not available for this claim`);
  const ctx = await printContext();
  const vars = await docVars(row, ctx.format);
  const lines = (Array.isArray(templates[key]) ? templates[key] : String(templates[key]).split('\n')).map((l) => renderTemplate(l, vars, { html: false }));
  const pdf = buildPdf({ ...ctx, ...claimDocSpec(key, lines, vars, ctx) });
  return { buffer: pdf, contentType: 'application/pdf', fileName: `${key}.pdf` };
}

/**
 * A claim document from its template lines: runs of "Label: value" lines become a details grid, other lines
 * paragraphs; a "Signature: ____" line becomes a signature block. Letters, discharge vouchers and data sheets get the
 * signature lines they need.
 */
export function claimDocSpec(title, lines, vars, ctx = {}) {
  const sections = [];
  let rows = [];
  let signatures = [];
  const flush = () => { if (rows.length) sections.push({ rows, columns: rows.length > 4 ? 2 : 1 }); rows = []; };
  for (const raw of lines) {
    const l = String(raw).trim();
    if (!l) { flush(); continue; }
    if (/^signature\b/i.test(l) || /_{4,}/.test(l)) {
      flush();
      signatures = [...signatures, ...l.split(/\s{2,}/).map((x) => x.replace(/[:_\s]+$/g, '').replace(/_+/g, '').trim()).filter(Boolean).map((x) => (/^signature$/i.test(x) ? 'Signature over printed name' : x))];
      continue;
    }
    if (/^[^:.]{2,40}:$/.test(l)) continue; // a label whose placeholder is empty
    const m = /^([^:.]{2,40}):\s+(.+)$/.exec(l);
    const sentence = m && m[2].split(/\s+/).length > 8 && /[.!?]$/.test(m[2]);
    if (m && !sentence) { if (!/^([A-Z]{3}\s*)?-$/.test(m[2].trim())) rows.push([m[1], m[2]]); } else { flush(); sections.push({ text: l }); }
  }
  flush();
  const company = ctx.letterhead?.name || vars.companyName || '';
  if (/acknowledg/i.test(title)) signatures = [{ label: 'Claims Department', name: company }];
  else if (/discharge/i.test(title)) signatures = [{ label: 'Insured / claimant', name: vars.insuredName }, { label: 'Witness' }, { label: `For ${company}`.trim() }];
  else if (!signatures.length && /data sheet/i.test(title)) signatures = [{ label: 'Prepared by' }, { label: 'Reviewed by' }];
  const meta = [['Claim no.', vars.claimNumber], ['Policy no.', vars.policyNumber], ['Insured', vars.insuredName], ['Insurer', vars.insurerName]].filter(([, v]) => v);
  const isLetter = /letter/i.test(title);
  return {
    title, number: vars.claimNumber, dateLine: `Date ${formatDate(new Date(), ctx.format)}`,
    meta: isLetter ? meta : [],
    sections: [...(isLetter && vars.insuredName ? [{ text: `Dear ${vars.insuredName},` }] : []), ...sections,
      ...(isLetter ? [{ text: `Sincerely,` }] : []), ...(signatures.length ? [{ signatures, perRow: Math.min(3, signatures.length) }] : [])],
  };
}

// ---------------------------------------------------------------- reports
async function reportRows(startDate, endDate, scope = null) {
  const params = [startDate, endDate];
  const own = scopeSql(scope, 'claim', 'c', params);
  return many(`${BASE} WHERE c.reported_date BETWEEN $1::date AND $2::date AND ${own} ORDER BY c.reported_date DESC, c.claim_number DESC`, params);
}
const countBy = (items, fn, key) => {
  const m = new Map();
  for (const i of items) { const k = fn(i) || 'Unknown'; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([k, count]) => ({ [key]: k, count })).sort((a, b) => b.count - a.count);
};

/** Claims dashboard (GET /claims/report): summary, breakdowns, ageing and optionally the detailed rows. */
export async function claimsReport({ startDate, endDate, includeData, [SCOPE]: scope = null }) {
  const start = (await toDate(startDate)) || `${new Date().getFullYear()}-01-01`;
  const end = (await toDate(endDate)) || await today();
  const ctx = await readContext();
  const claims = (await reportRows(start, end, scope)).map((r) => ({ ...toApi(r, ctx.labels, ctx.todayStr, ctx.open), state: r.loss_province || r.client_state || 'Unknown', city: r.loss_city || r.client_city || '' }));
  const open = claims.filter((c) => c.isOpen);
  const byState = countBy(claims, (c) => c.state, 'state').map((s) => ({ ...s, percentage: claims.length ? Math.round((s.count / claims.length) * 100) : 0 }));
  const [t1, t2, t3] = (await getSetting('claims.aging_thresholds', [7, 15, 30])) || [7, 15, 30];
  const ages = open.map((c) => daysBetween(c.reportedDate, ctx.todayStr));
  return {
    dateRange: { startDate: start, endDate: end },
    summary: {
      totalOpenClaims: open.length, totalAgingClaims: open.filter((c) => c.daysOverdue > 0).length,
      todaysClaims: claims.filter((c) => c.reportedDate === ctx.todayStr).length, totalClaims: claims.length,
      totalEstimatedAmount: round2(claims.reduce((s, c) => s + (c.estimatedClaimAmount || 0), 0)),
      totalSettledAmount: round2(claims.reduce((s, c) => s + (c.settledAmount || 0), 0)),
      maxClaimsByState: byState[0] || { state: 'N/A', count: 0, percentage: 0 },
    },
    breakdown: {
      byType: countBy(claims, (c) => c.claimType, 'type'), byStatus: countBy(claims, (c) => c.claimStatus, 'status'),
      byLOB: countBy(claims, (c) => c.lob, 'lob'), byState,
      agingBreakdown: { recent: ages.filter((a) => a <= t1).length, moderate: ages.filter((a) => a > t1 && a <= t2).length, high: ages.filter((a) => a > t2 && a <= t3).length, critical: ages.filter((a) => a > t3).length },
    },
    ...(String(includeData) === 'true' ? { detailedClaims: claims.map(detailRow) } : {}),
  };
}
const detailRow = (c) => ({
  claimNumber: c.claimNumber, claimType: c.claimType, claimStatus: c.claimStatus, claimPriority: c.claimPriority, lob: c.lob,
  customerName: c.customerName, policyNumber: c.policyNumber, insuranceCompanyName: c.insuranceCompanyName, province: c.state, city: c.city,
  reportedDate: c.reportedDate, dateOfIncident: c.dateOfIncident, claimDueDate: c.claimDueDate, estimatedClaimAmount: c.estimatedClaimAmount,
  approvedAmount: c.approvedAmount, settledAmount: c.settledAmount, handlerName: c.handlerName, createdAt: c.createdAt, daysOverdue: c.daysOverdue,
});
export const REPORT_COLUMNS = [
  ['claimNumber', 'Claim No.'], ['policyNumber', 'Policy No.'], ['customerName', 'Insured'], ['insuranceCompanyName', 'Insurer'], ['lob', 'LOB'],
  ['claimType', 'Claim type'], ['claimStatus', 'Status'], ['claimPriority', 'Priority'], ['province', 'Province'], ['city', 'City'],
  ['dateOfIncident', 'Date of loss'], ['reportedDate', 'Reported'], ['claimDueDate', 'Due date'], ['daysOverdue', 'Days overdue'],
  ['estimatedClaimAmount', 'Estimate'], ['approvedAmount', 'Approved'], ['settledAmount', 'Settled'], ['handlerName', 'Handler'],
].map(([key, header]) => ({ key, header }));

/** Rows for the Operational Reports > Claims criteria (All | Open | Settled | Rejected | Aging). */
export async function criteriaRows({ startDate, endDate, criteria = 'All', [SCOPE]: scope = null }) {
  const start = (await toDate(startDate)) || '1900-01-01';
  const end = (await toDate(endDate)) || await today();
  const ctx = await readContext();
  const all = (await reportRows(start, end, scope)).map((r) => ({ ...toApi(r, ctx.labels, ctx.todayStr, ctx.open), state: r.loss_province || r.client_state || '', city: r.loss_city || r.client_city || '' }));
  const c = String(criteria).toLowerCase();
  const filtered = all.filter((x) => (c === 'open' ? x.isOpen
    : c === 'settled' ? ['settled', 'closed'].includes(x.lifecycleStatus)
      : c === 'rejected' ? x.lifecycleStatus === 'rejected'
        : c === 'aging' ? x.isOpen && x.daysOverdue > 0 : true));
  return { start, end, rows: filtered.map(detailRow) };
}
