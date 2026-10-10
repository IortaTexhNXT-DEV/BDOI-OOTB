/**
 * Claims business logic: registration with acceptance controls, lifecycle transitions with claim_history,
 * field-level audit trail, settlement maker-checker, notifications, Preliminary Loss Advice e-mail,
 * printable documents and the dashboard / criteria reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { many, one, pool, query, withTransaction } from '../../db/pool.js';
import { allocate, isCoInsured, policyParticipants } from '../accounting/lib/coinsurance.js';
import { postEvent } from '../accounting/lib/posting.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney } from '../../lib/money.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { queueEmail } from '../../lib/mailer.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { notify } from '../notifications/service.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { renderTemplate } from './docs.js';
import { companyName } from '../../lib/letterhead.js';
import { printContext, buildPdf } from '../../lib/pdf/index.js';
import { SIGNATURE_PLACEHOLDER, documentState, renderSignatureBlock } from '../e-signatures/service.js';
import { formatDate } from '../../lib/pdf/format.js';
import { COMM_METHODS, COMM_PARTIES, assertApprovalLimit, daysBetween, parseJsonField, round2, shownDate, storeUpload, toBool, toNum, today, unprocessable, usersWithPermission } from './util.js';
import { decisionReason as codedReason, requiredReason } from '../ops-masters/records.js';
import { emailTemplate } from '../documents/common.js';
import { assertDeathBenefit, claimsRatio, duplicatesOf, estimateOf, followUpDays, intimation } from './intake.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { businessDate, postingDate } from '../../lib/dates.js';

/** When a settlement is settled: its settlement date (not after today), else now. */
const settledAt = async (settlement) => (settlement?.settlementDate ? postingDate(settlement.settlementDate) : new Date());

export const STATUSES = ['registered', 'in-review', 'pending-approval', 'approved', 'partially-settled', 'settled', 'closed', 'rejected', 'cancelled'];
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
  pr.name AS product_name, pr.line AS product_line, hu.display_name AS handler_name, cl.client_code,
  (SELECT l.lead_number FROM leads l WHERE l.id = COALESCE(c.lead_id, p.lead_id)) AS lead_number,
  (SELECT q.quote_number FROM quotes q WHERE q.id = COALESCE(c.quote_id, p.quote_id)) AS quote_number,
  (SELECT u.display_name FROM users u WHERE u.id = c.created_by OR u.username = c.created_by ORDER BY (u.id = c.created_by) DESC LIMIT 1) AS reported_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = c.settlement_requested_by) AS settlement_requested_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = c.settlement_approved_by) AS settlement_approved_by_name, p.product_id, pr.code AS product_code
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
/** A death benefit claim: the cause of loss or the claim type says Death (Credit Life, Personal Accident death). */
export const isDeathClaim = (r) => /\bdeath\b/i.test(`${r.loss_type || ''} ${r.claim_type || ''}`);

export function toApi(r, labels, todayStr, open, adviceLabels = null) {
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
    // business numbers for display (the *RefId fields are internal ids used for navigation)
    clientCode: r.client_code || null, leadNumber: r.lead_number || null, quoteNumber: r.quote_number || null,
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
    settlementRequestedBy: r.settlement_requested_by_name || null, settlementApprovedBy: r.settlement_approved_by_name || null, settlementApprovedAt: r.settlement_approved_at,
    settlementRequestedById: r.settlement_requested_by, settlementApprovedById: r.settlement_approved_by,
    fnolSource: r.fnol_source || null, lossExtent: r.loss_extent || null, lateIntimation: !!r.late_intimation,
    insurerHandler: r.insurer_handler || '', insurerHandlerContact: r.insurer_handler_contact || '', insurerAdvice: r.insurer_advice || null,
    insurerAdviceLabel: r.insurer_advice ? (adviceLabels?.[r.insurer_advice] || r.insurer_advice) : null, insurerAdviceAt: r.insurer_advice_at || null,
    insurerOfferAmount: r.insurer_offer_amount == null ? null : Number(r.insurer_offer_amount), authorisationCode: r.authorisation_code || '', authorisationAt: r.authorisation_at || null,
    cancelledReason: r.cancelled_reason || null, cancelledReasonCode: r.cancelled_reason_code || null, cancelledAt: r.cancelled_at || null,
    deathVerifiedOn: r.death_verified_on || null, isDeathClaim: isDeathClaim(r),
    rejectedReason: r.rejected_reason, rejectedReasonCode: r.rejected_reason_code ?? null, handlerUserId: r.handler_user_id, handlerName: r.handler_name, reportedByName: r.reported_by_name || null,
    claimDueDate: r.due_date, daysOverdue, isOpen, closedAt: r.closed_at, submittedToInsurerAt: r.submitted_to_insurer_at || null,
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
  return { labels: await statusLabels(), todayStr: await today(), open: await openStatuses(), advice: (await getSetting('claims.insurer_advice_statuses', {})) || {} };
}
export async function loadRow(id) {
  const r = await one(`${BASE} WHERE c.id = $1 OR c.claim_number = $1`, [id]);
  if (!r) throw notFound('Claim not found');
  return r;
}
export async function getClaim(id) {
  const ctx = await readContext();
  const claim = toApi(await loadRow(id), ctx.labels, ctx.todayStr, ctx.open, ctx.advice);
  claim.documents = (await many(`SELECT storage_key AS key, file_name AS "fileName", category AS "documentName", created_at AS "createdAt"
    FROM documents WHERE entity = 'claim' AND entity_id = $1 ORDER BY created_at`, [claim.id]))
    .map((d) => ({ ...d, downloadUrl: `${config.publicBaseUrl}/api/s3/object/${d.key}` }));
  claim.history = await many(`SELECT h.at, COALESCE(u.display_name, h.by_user) AS "byUser", h.status, h.note FROM claim_history h LEFT JOIN users u ON u.username = h.by_user
    WHERE h.claim_id = $1 ORDER BY h.at, h.id`, [claim.id]);
  claim.settlements = await settlementsOf(claim.id);
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
 * Settlements paid through the broker (paidThroughBroker on the settlement, or a settlement type naming the broker):
 * posting rule claim.settlement.paid_through_broker books the amount recoverable from each insurer (its share) against
 * the amount payable to the claimant, once per approved settlement (a partial settlement is booked when it is released,
 * the final one when the claim is settled). The first journal is kept on the claim (settlement_jv_id).
 */
export async function postBrokerSettlement(claimId, user) {
  return withTransaction(async (db) => {
    const c = (await db.query(`SELECT c.*, p.policy_number, p.client_id AS policy_client_id, cl.display_name AS client_name FROM claims c JOIN policies p ON p.id = c.policy_id
      LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id) WHERE c.id = $1 FOR UPDATE OF c`, [claimId])).rows[0];
    if (!c || !['settled', 'partially-settled'].includes(c.status)) return null;
    // a claim settled without settlement rows (loaded or settled before migration 0503) is one final settlement
    const amount0 = round2(Number(c.settled_amount ?? c.settlement?.settlementAmount ?? 0));
    if (c.status === 'settled' && !c.settlement_jv_id && amount0 > 0) {
      await db.query(`INSERT INTO claim_settlements(claim_id, seq, kind, amount, approved_amount, settlement_type, settlement_date, paid_through_broker, payee, status, decided_at)
        SELECT $1, 1, 'final', $2, $2, $3, $4, $5, $6, 'approved', now() WHERE NOT EXISTS (SELECT 1 FROM claim_settlements WHERE claim_id = $1)`,
      [c.id, amount0, c.settlement?.settlementType || null, (await businessDate(c.settlement?.settlementDate)) || null, !!c.settlement?.paidThroughBroker, c.settlement?.payee || null]);
    }
    const due = (await db.query(`SELECT * FROM claim_settlements WHERE claim_id = $1 AND status = 'approved' AND paid_through_broker AND journal_id IS NULL
      AND (kind = 'partial' OR $2 = 'settled') ORDER BY seq`, [c.id, c.status])).rows;
    const parts = due.length ? await policyParticipants(c.policy_id, db) : [];
    let first = null;
    for (const st of due) {
      const amount = round2(Number(st.approved_amount ?? st.amount));
      if (!(amount > 0)) continue;
      const shares = allocate(amount, parts.map((p) => p.share));
      const jv = await postEvent('claim.settlement.paid_through_broker', {
        source: 'claims', entryType: 'CLAIM_SETTLEMENT', entrySubType: isCoInsured(parts) ? 'CO_INSURANCE' : null, transactionCode: c.claim_number, referenceType: 'Claim', referenceId: c.id,
        clientId: c.client_id || c.policy_client_id, policyId: c.policy_id, policyNumber: c.policy_number, amounts: { amount }, date: await postingDate(st.settlement_date),
        participants: parts.map((p, i) => ({ insurerId: p.insurerId, insurerName: p.insurerName, share: p.share, amounts: { amount: shares[i] } })),
        vars: { claimNumber: c.claim_number, policyNumber: c.policy_number, claimant: st.payee || c.client_name || 'claimant', insurer: parts[0]?.insurerName || 'insurer' },
      }, { db, user });
      await db.query('UPDATE claim_settlements SET journal_id = $2 WHERE id = $1', [st.id, jv.id]);
      first = first || jv;
    }
    if (first) await db.query('UPDATE claims SET settlement_jv_id = COALESCE(settlement_jv_id, $2) WHERE id = $1', [c.id, first.id]);
    return first;
  });
}

const settlementApi = (x) => ({
  id: Number(x.id), seq: x.seq, kind: x.kind, amount: Number(x.amount), approvedAmount: x.approved_amount == null ? null : Number(x.approved_amount),
  settlementType: x.settlement_type, settlementIssueDate: x.settlement_issue_date, settlementDate: x.settlement_date, paidThroughBroker: x.paid_through_broker, payee: x.payee,
  status: x.status, requestedBy: x.requested_by_name || null, requestedAt: x.requested_at, decidedBy: x.decided_by_name || null, decidedAt: x.decided_at,
  decisionNote: x.decision_note, journalNumber: x.jv_number || null,
});
/** Settlements of a claim, first to last, with the names of the requester and the decider. */
export async function settlementsOf(claimId, db = pool) {
  return (await db.query(`SELECT s.*, ru.display_name AS requested_by_name, du.display_name AS decided_by_name, j.jv_number FROM claim_settlements s
    LEFT JOIN users ru ON ru.id = s.requested_by LEFT JOIN users du ON du.id = s.decided_by LEFT JOIN journal_vouchers j ON j.id = s.journal_id
    WHERE s.claim_id = $1 ORDER BY s.seq`, [claimId])).rows.map(settlementApi);
}
/** Total approved on the settlements of a claim. */
const approvedTotal = async (claimId) => round2(Number((await one("SELECT COALESCE(sum(approved_amount), 0)::numeric AS t FROM claim_settlements WHERE claim_id = $1 AND status = 'approved'", [claimId])).t));

/** Settlement types master (claims.settlement_types): [{ value, label, paidThroughBroker }]. */
export async function settlementTypes() {
  const list = await getSetting('claims.settlement_types', []);
  return (Array.isArray(list) ? list : []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x)).filter((x) => x?.value);
}
const throughBroker = async (input, prev) => {
  const v = input.paidThroughBroker ?? input.paidThroughBrokerFlag;
  if (v !== undefined && v !== null && v !== '') return v === true || String(v).toLowerCase() === 'true';
  if (input.settlementType) {
    const type = (await settlementTypes()).find((x) => String(x.value).toLowerCase() === String(input.settlementType).toLowerCase());
    if (type) return !!type.paidThroughBroker;
    if (/broker/i.test(String(input.settlementType))) return true;
  }
  return !!prev?.paidThroughBroker;
};

/** Masters the claim screens need: status labels, settlement types, causes of loss and the sections per line of business. */
export async function claimsConfig() {
  return {
    statusLabels: await statusLabels(),
    settlementTypes: await settlementTypes(),
    lossCauses: (await getSetting('claims.loss_causes', {})) || {},
    lobFields: (await getSetting('claims.lob_fields', { MOTOR: ['driver', 'vehicle'], default: [] })) || {},
    makerChecker: !!(await getSetting('claims.settlement_maker_checker', true)),
    fnolSources: (await getSetting('claims.fnol_sources', [])) || [],
    insurerAdviceStatuses: Object.entries((await getSetting('claims.insurer_advice_statuses', {})) || {}).map(([value, label]) => ({ value, label })),
    communicationParties: Object.entries(COMM_PARTIES).map(([value, label]) => ({ value, label })), communicationMethods: COMM_METHODS,
    deathBenefitProducts: (await getSetting('claims.death_benefit_products', [])) || [],
  };
}

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
  return { total, items: rows.map((r) => toApi(r, ctx.labels, ctx.todayStr, ctx.open, ctx.advice)) };
}

// ---------------------------------------------------------------- trail helpers
export async function trail(db, claimId, user, action, changes = [[null, null, null]]) {
  for (const [field, oldV, newV] of changes) {
    await db.query(`INSERT INTO claim_field_changes(claim_id, user_id, username, action, field_name, old_value, new_value) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [claimId, user?.id ?? null, user?.username ?? null, action, field, oldV == null ? null : String(oldV), newV == null ? null : String(newV)]);
  }
}
export const history = (db, claimId, user, status, note) => db.query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1,$2,$3,$4)', [claimId, user?.username ?? null, status, note ?? null]);

// ---------------------------------------------------------------- acceptance controls
async function resolvePolicy(input) {
  const refs = [input.policyRefId, input.policyId, input.policyNumber].filter((v) => v && !PLACEHOLDER_REFS.has(String(v)));
  for (const ref of refs) {
    const p = await one(`SELECT p.*, pr.line AS product_line, pr.code AS product_code FROM policies p LEFT JOIN products pr ON pr.id = p.product_id
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
  if ((await getSetting('claims.block_unpaid_premium')) !== false) {
    const due = (await one(`SELECT COALESCE(sum(balance), 0)::numeric AS due FROM receivables
      WHERE policy_id = $1 AND balance > 0 AND status NOT IN ('paid', 'written-off')`, [policy.id])).due;
    if (due > 0) problems.push({ code: 'UNPAID_PREMIUM', message: `Policy ${policy.policy_number} has unpaid premium of ${await formatMoney(due)}`, outstanding: due });
  }
  return problems;
}

/**
 * The claims handler: the one asked for (an active user), else the active user of the assignment roles
 * (claims.assignment_roles) with the fewest open claims, the longest-serving first on a tie.
 */
async function pickHandler(requested) {
  if (requested) {
    const u = await one('SELECT id FROM users WHERE id = $1 AND status = \'active\'', [requested]);
    if (!u) throw badRequest('handlerUserId is not an active user');
    return u.id;
  }
  const roles = (await getSetting('claims.assignment_roles', ['claims'])) || ['claims'];
  const r = await one(`SELECT u.id FROM users u WHERE u.status = 'active'
      AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = ANY($1))
    ORDER BY (SELECT count(*) FROM claims c WHERE c.handler_user_id = u.id AND c.status = ANY($2)), u.created_at LIMIT 1`, [roles, await openStatuses()]);
  return r?.id ?? null;
}

// ---------------------------------------------------------------- notifications and e-mail
export async function notifyParties(claim, { title, message, type = 'info', extraUsers = [] }) {
  if (!(await getSetting('notification.claim_status', true))) return;
  const targets = new Set([claim.handler_user_id, claim.policy_owner, ...extraUsers].filter(Boolean));
  for (const userId of targets) {
    await notify({ userId, type, title, message, link: `/agent/claimdetail/${claim.id}`, entity: 'claim', entityId: claim.id });
  }
}

export async function docVars(r, printFmt = null) {
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
    settlementType: r.settlement?.settlementType || '',
    slaDays: r.due_date && r.reported_date ? daysBetween(String(r.reported_date).slice(0, 10), String(r.due_date).slice(0, 10)) : await getSetting('claims.sla_days', 20),
    documentChecklist: await documentChecklist(r), companyName: await companyName(),
  };
}

/** The documents the claimant still has to send (the claim's checklist, else the checklist master), for the letters. */
async function documentChecklist(r) {
  const items = await many("SELECT document_name FROM claim_document_items WHERE claim_id = $1 AND required AND status = 'pending' ORDER BY sort_order, id", [r.id]);
  if (items.length) return items.map((i) => i.document_name).join('; ');
  const { requirementsFor } = await import('../claim-documents/service.js');
  const req = (await requirementsFor(pool, r.lob || r.product_line, r.claim_type, r.loss_type)).filter((x) => x.required);
  return req.map((x) => x.documentName).join('; ') || '-';
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
  const lossDate = await businessDate(input.dateOfIncident || input.lossDate);
  if (!lossDate) throw badRequest('dateOfIncident (date of loss) is required');
  const problems = await acceptanceCheck(policy, lossDate);
  if (problems.length) throw unprocessable(`Claim not accepted: ${problems.map((p) => p.message).join('; ')}`, problems);

  const reported = (await businessDate(input.reportedDate)) || await today();
  assertReportedAfterLoss(lossDate, reported);
  const estimate = estimateOf(input.estimatedClaimAmount);
  await assertDeathBenefit(policy.product_code, input.typeOfIncident, input.claimType);
  const sources = (await getSetting('claims.fnol_sources', [])) || [];
  if (input.fnolSource && sources.length && !sources.includes(input.fnolSource)) {
    throw badRequest('Validation failed', [{ path: 'fnolSource', message: `Choose one of ${sources.join(', ')}` }]);
  }
  const extent = ['partial', 'total'].includes(String(input.lossExtent || '').toLowerCase()) ? String(input.lossExtent).toLowerCase() : null;
  const duplicates = await duplicatesOf(policy.id, lossDate);
  if (duplicates.length && !toBool(input.confirmDuplicate)) {
    throw conflict(`Claim ${duplicates.map((d) => d.claim_number).join(', ')} is already registered on policy ${policy.policy_number} for a loss on ${await shownDate(lossDate)}; confirm to register another claim`);
  }
  const late = await intimation(lossDate, reported);
  const driver = parseJsonField(input.driverDetails, {});
  if (input.driverName) driver.driverName = input.driverName;
  const lob = String(input.lob || policy.product_line || 'MOTOR').toUpperCase();
  const sla = await followUpDays({ productCode: policy.product_code, lob, extent });
  const handler = await pickHandler(input.handlerUserId);
  const number = await nextDocumentNumber('claim', { unique: { table: 'claims', column: 'claim_number' } });
  const leadId = PLACEHOLDER_REFS.has(String(input.leadRefId ?? '')) ? null : input.leadRefId;
  const quoteId = PLACEHOLDER_REFS.has(String(input.quoteRefId ?? '')) ? policy.quote_id : input.quoteRefId;

  const id = await withTransaction(async (db) => {
    const r = await db.query(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, reported_date, loss_type, description,
        estimate_amount, handler_user_id, lob, claim_type, priority, loss_time, loss_address, loss_city, loss_province, insurer_claim_number,
        is_holder_driver, driver, third_party, policy_info, lead_id, quote_id, due_date, details, created_by, fnol_source, loss_extent, late_intimation)
      VALUES ($1,$2,$3,'registered',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,($5::date + $24::int),$25,$26,$27,$28,$29) RETURNING id`, [
      number, policy.id, policy.client_id, lossDate, reported, input.typeOfIncident || null, input.description || null,
      estimate, handler, lob, input.claimType || lob.charAt(0) + lob.slice(1).toLowerCase(),
      input.claimPriority || await getSetting('claims.default_priority', 'Medium'), input.timeOfIncident || null,
      input.addressOfIncident || null, input.cityOfIncident || null, input.provinceOfIncident || null, input.insuranceCompanyClaimNumber || null,
      toBool(input.isPolicyHolderTheDriver), JSON.stringify(driver), JSON.stringify(parseJsonField(input.thirdPartyDetails, {})),
      JSON.stringify(parseJsonField(input.policyInfo, {})), leadId || null, quoteId || null, sla,
      JSON.stringify({ emailData: parseJsonField(input.emailData, {}), isCoInsurance: toBool(input.isCoInsurance) }), user?.username ?? null,
      input.fnolSource || null, extent, late.late,
    ]);
    const claimId = r.rows[0].id;
    await history(db, claimId, user, 'registered', 'Claim registered');
    if (late.late) await history(db, claimId, user, 'registered', `Late intimation: reported ${late.days} days after the loss (more than ${late.limit})`);
    if (duplicates.length) await history(db, claimId, user, 'registered', `Registered although claim ${duplicates.map((d) => d.claim_number).join(', ')} has the same date of loss`);
    await trail(db, claimId, user, 'Claim Registered', [['claimStatus', null, 'registered'], ['policyNumber', null, policy.policy_number], ['dateOfIncident', null, lossDate]]);
    return claimId;
  });
  await saveFiles(files, id, user);
  const row = await loadRow(id);
  await notifyParties(row, { type: 'task', title: `New claim ${number}`, message: `Claim ${number} registered on policy ${policy.policy_number}` });
  if (late.late) {
    await notifyParties(row, { type: 'alert', title: `Late intimation: claim ${number}`, message: `Claim ${number} was reported ${late.days} days after the loss (limit ${late.limit} days)` });
  }
  await sendPla(row, parseJsonField(input.emailData, {}));
  return getClaim(id);
}

/**
 * What the handler sees before registering a claim on a policy (TIS-BRD-CLAIM-02): the acceptance problems, the
 * outstanding premium, the claims ratio of the customer, a late intimation and the claims already registered for the
 * same date of loss.
 */
export async function registrationCheck({ policyRef, lossDate, reportedDate }) {
  const policy = await resolvePolicy({ policyRefId: policyRef });
  const loss = await businessDate(lossDate);
  const reported = (await businessDate(reportedDate)) || await today();
  const due = (await one(`SELECT COALESCE(sum(balance), 0)::numeric AS due FROM receivables WHERE policy_id = $1 AND balance > 0 AND status NOT IN ('paid', 'written-off')`, [policy.id])).due;
  return {
    policyId: policy.id, policyNumber: policy.policy_number, outstandingPremium: round2(Number(due)),
    blockUnpaidPremium: (await getSetting('claims.block_unpaid_premium')) !== false,
    problems: loss ? await acceptanceCheck(policy, loss) : [], claimsRatio: await claimsRatio(policy.client_id),
    intimation: loss ? await intimation(loss, reported) : null,
    duplicates: loss ? (await duplicatesOf(policy.id, loss)).map((d) => ({ claimNumber: d.claim_number, status: d.status, lossCause: d.loss_type })) : [],
    deathBenefitOnly: ((await getSetting('claims.death_benefit_products', [])) || []).includes(policy.product_code),
  };
}

/** A claim cannot be reported before the loss happened. Dates are ISO yyyy-mm-dd strings. */
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
  if (input.estimatedClaimAmount !== undefined && input.estimatedClaimAmount !== '') set('estimate_amount', estimateOf(input.estimatedClaimAmount), 'estimatedClaimAmount');
  if (input.fnolSource) set('fnol_source', input.fnolSource, 'fnolSource');
  if (['partial', 'total'].includes(String(input.lossExtent || '').toLowerCase())) set('loss_extent', String(input.lossExtent).toLowerCase(), 'lossExtent');
  if (input.reportedDate) set('reported_date', await businessDate(input.reportedDate), 'reportedDate');
  if (input.dateOfIncident) {
    const lossDate = await businessDate(input.dateOfIncident);
    if (lossDate > await today()) throw unprocessable('Date of loss cannot be in the future', [{ path: 'dateOfIncident', message: 'Date of loss cannot be in the future' }]);
    if (lossDate !== before.loss_date && await getSetting('claims.validate_loss_date', true)
      && (lossDate < before.inception_date || lossDate > before.expiry_date)) {
      throw unprocessable(`Date of loss ${lossDate} is outside the policy period ${before.inception_date} to ${before.expiry_date}`);
    }
    set('loss_date', lossDate, 'dateOfIncident');
  }
  if (input.reportedDate || input.dateOfIncident) {
    const loss = input.dateOfIncident ? await businessDate(input.dateOfIncident) : before.loss_date;
    const reported = input.reportedDate ? await businessDate(input.reportedDate) : before.reported_date;
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
  return { before: toApi(before, await statusLabels(), await today(), await openStatuses(), (await getSetting('claims.insurer_advice_statuses', {})) || {}), after: await getClaim(before.id) };
}

const TRANSITIONS = {
  registered: ['in-review', 'rejected', 'cancelled'],
  'in-review': ['pending-approval', 'approved', 'partially-settled', 'settled', 'rejected', 'cancelled'],
  'pending-approval': ['approved', 'in-review', 'rejected', 'partially-settled'],
  'partially-settled': ['pending-approval', 'settled'],
  approved: ['settled'],
  settled: ['closed'],
  rejected: ['closed'],
  cancelled: [],
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
  // claim update SMS to the client (Master > System Configuration > Message Templates); never blocks the workflow
  await import('../integrations/messaging.js').then((m) => m.claimStatusChanged(row, to, labels[to])).catch(() => null);
}

/**
 * PUT /claims/updatestatus/:id: only statuses without their own workflow step (review, close, reject). A rejection
 * (repudiation) needs its reason: a repudiation code of the Reason Codes master and its note, or the reason as text.
 */
export async function updateStatus(id, requested, user, note, reasonCode = null) {
  const to = await toStatusCode(requested);
  if (!to) throw badRequest(`Unknown claim status "${requested}"`);
  if (['pending-approval', 'approved', 'settled', 'partially-settled'].includes(to)) throw conflict(`Use the settlement endpoints to move a claim to ${to}`);
  if (to === 'cancelled') throw conflict('Use the cancellation of the claim, with its reason, to cancel a claim');
  if (to === 'rejected') return rejectClaim(id, user, note, reasonCode);
  const row = await loadRow(id);
  const from = row.status;
  if (to === 'closed') await transition(row, to, user, { note, sets: { closed_at: new Date() } });
  else await transition(row, to, user, { note });
  return { from, claim: await getClaim(row.id) };
}

/**
 * Reject (repudiate) a claim: a repudiation reason code of the Reason Codes master with its note, or the reason as
 * text; one of them is required. A settlement awaiting approval is returned. The client is told the reason by e-mail
 * (template claim_rejection) and by the claim update message.
 */
export async function rejectClaim(id, user, reason, reasonCode = null) {
  const row = await loadRow(id);
  const from = row.status;
  const why = await codedReason(pool, ['repudiation'], { reasonCode, reason });
  if (!why.text) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason of the rejection' }]);
  await transition(row, 'rejected', user, { note: why.text, sets: { rejected_reason: why.text, rejected_reason_code: why.code }, action: 'Claim Rejected' });
  await query(`UPDATE claim_settlements SET status = 'returned', decided_by = $2, decided_at = now(), decision_note = $3 WHERE claim_id = $1 AND status = 'pending'`,
    [row.id, user?.id ?? null, 'Claim rejected']);
  if (row.client_email) {
    const t = await emailTemplate('claim_rejection');
    const v = { claimantName: row.client_name || '', claimNumber: row.claim_number, policyNumber: row.policy_number, insurerName: row.insurer_name || 'the insurer', reason: why.text, companyName: await companyName() };
    await queueEmail({ to: row.client_email, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'claim_rejection', entity: 'claim', entityId: row.id });
  }
  return { from, claim: await getClaim(row.id) };
}

/**
 * Cancel a claim registered in error (duplicate, wrong policy, withdrawn): a reason of the Reason Codes master (context
 * claim_cancel) and a remark; only before a settlement is submitted. A cancelled claim is not reopened.
 */
export async function cancelClaim(id, user, { reasonCode, note }) {
  const row = await loadRow(id);
  const from = row.status;
  if (!['registered', 'in-review'].includes(from)) throw conflict(`Claim ${row.claim_number} is ${(await statusLabels())[from]}; only a pending or processing claim can be cancelled`);
  const why = await requiredReason(pool, 'claim_cancel', { reasonCode, note });
  await transition(row, 'cancelled', user, { note: why.text, sets: { cancelled_reason: why.text, cancelled_reason_code: why.code, cancelled_at: new Date() }, action: 'Claim Cancelled' });
  return { from, claim: await getClaim(row.id) };
}

const settlementLink = (row) => `/agent/claimrequest/settlementapproval/${row.id}`;

/**
 * PUT /claims/settle/:id. On a claim in review, or partially settled, this submits a settlement, partial
 * (settlementKind partial: the claim stays open, to be revisited and completed later) or final; with maker-checker on
 * it waits for another user's approval (pending-approval), otherwise it is released at once. On an approved claim (a
 * final settlement approved while claims.auto_settle_on_approval is off) another user than the requester releases it.
 */
export async function settleClaim(id, input, user, files) {
  const row = await loadRow(id);
  const from = row.status;
  const amount = toNum(input.settlementAmount);
  if (input.settlementType) {
    const types = await settlementTypes();
    // value or label of the master; older screens and uploads say "Paid through broker"
    const given = String(input.settlementType).toLowerCase();
    const known = types.some((x) => [x.value, x.label].some((v) => String(v || '').toLowerCase() === given)) || /broker/.test(given);
    if (types.length && !known) {
      throw badRequest('Validation failed', [{ path: 'settlementType', message: `Settlement type "${input.settlementType}" is not in the settlement types master` }]);
    }
  }
  const settlement = {
    ...(row.settlement || {}), settlementType: input.settlementType || row.settlement?.settlementType || null,
    settlementIssueDate: (await businessDate(input.settlementIssueDate)) || row.settlement?.settlementIssueDate || null,
    settlementDate: (await businessDate(input.settlementDate)) || row.settlement?.settlementDate || null,
  };
  settlement.paidThroughBroker = await throughBroker(input, row.settlement);
  if (input.payee) settlement.payee = String(input.payee);
  if (amount !== null) settlement.settlementAmount = amount;
  if (from === 'approved') {
    if (row.settlement_requested_by && row.settlement_requested_by === user?.id) throw forbidden('Maker-checker: the settlement is released by another user than the one who submitted it');
    const final = await one("SELECT * FROM claim_settlements WHERE claim_id = $1 AND status = 'approved' ORDER BY seq DESC LIMIT 1", [row.id]);
    const approved = Number(final?.approved_amount ?? row.approved_amount);
    if (amount !== null && amount > approved + 0.005) throw unprocessable(`Settlement amount exceeds the approved amount ${await formatMoney(approved)}`);
    await saveFiles(files, row.id, user);
    await transition(row, 'settled', user, { note: 'Settlement paid', action: 'Claim Settled', sets: { settlement: JSON.stringify(settlement), settled_amount: await approvedTotal(row.id), settled_at: await settledAt(settlement) } });
    await postBrokerSettlement(row.id, user);
    return { from, claim: await getClaim(row.id) };
  }
  if (!['in-review', 'partially-settled'].includes(from)) throw conflict(`Claim is ${from}; settlement can be submitted only while it is in review`);
  if (!(amount > 0)) throw badRequest('settlementAmount must be greater than zero');
  const kind = String(input.settlementKind || '').toLowerCase() === 'partial' ? 'partial' : 'final';
  const prior = await approvedTotal(row.id);
  if (row.policy_sum_insured > 0 && round2(prior + amount) > Number(row.policy_sum_insured)) {
    throw unprocessable(`Settlement amount exceeds the policy sum insured ${await formatMoney(row.policy_sum_insured)}${prior ? ` with the ${await formatMoney(prior)} already settled` : ''}`);
  }
  await saveFiles(files, row.id, user);
  settlement.kind = kind;
  settlement.requestedBy = user?.username; settlement.requestedAt = new Date().toISOString();
  const makerChecker = !!(await getSetting('claims.settlement_maker_checker', true));
  const seq = Number((await one('SELECT COALESCE(max(seq), 0) + 1 AS n FROM claim_settlements WHERE claim_id = $1', [row.id])).n);
  const st = await one(`INSERT INTO claim_settlements(claim_id, seq, kind, amount, approved_amount, settlement_type, settlement_issue_date, settlement_date, paid_through_broker, payee,
      status, requested_by, decided_by, decided_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
  [row.id, seq, kind, round2(amount), makerChecker ? null : round2(amount), settlement.settlementType, settlement.settlementIssueDate, settlement.settlementDate,
    !!settlement.paidThroughBroker, settlement.payee || null, makerChecker ? 'pending' : 'approved', user?.id ?? null, makerChecker ? null : user?.id ?? null, makerChecker ? null : new Date()]);
  const what = kind === 'partial' ? 'Partial settlement' : 'Settlement';
  if (makerChecker) {
    await transition(row, 'pending-approval', user, { note: `${what} of ${await formatMoney(amount)} submitted for approval`, action: 'Settlement Submitted', sets: { settlement: JSON.stringify(settlement), settlement_requested_by: user?.id ?? null } });
    // decided by the holders of approve:claims: each of them but the requester
    const approvers = (await usersWithPermission('approve:claims')).map((u) => u.id).filter((u) => u !== user?.id);
    await notifyApprovers({ users: approvers, document: 'Claim settlement', number: row.claim_number, by: user?.username || 'system',
      detail: `${await formatMoney(amount)}${kind === 'partial' ? ' (partial)' : ''}${settlement.settlementType ? `, ${settlement.settlementType}` : ''}`, link: settlementLink(row), entity: 'claim', entityId: row.id });
    return { from, claim: await getClaim(row.id), pendingApproval: true };
  }
  await release(row, st, settlement, user, { note: kind === 'partial' ? `${what} of ${await formatMoney(amount)} released` : 'Settled' });
  return { from, claim: await getClaim(row.id) };
}

/** Release an approved settlement: a partial one leaves the claim partially settled, a final one settles it. */
async function release(row, st, settlement, user, { note }) {
  const total = await approvedTotal(row.id);
  const sets = { settlement: JSON.stringify(settlement), approved_amount: total, settled_amount: total, settled_at: await settledAt(settlement) };
  const to = st.kind === 'partial' ? 'partially-settled' : 'settled';
  const action = st.kind === 'partial' ? 'Partial Settlement Released' : 'Claim Settled';
  if (row.status === to) {
    // a further partial settlement released at once (maker-checker off): the claim stays partially settled
    await withTransaction(async (db) => {
      await db.query('UPDATE claims SET settlement = $2, approved_amount = $3, settled_amount = $4, settled_at = $5, updated_at = now() WHERE id = $1',
        [row.id, sets.settlement, total, total, sets.settled_at]);
      await history(db, row.id, user, to, note);
      await trail(db, row.id, user, action, [['settledAmount', row.settled_amount, total]]);
    });
  } else {
    await transition(row, to, user, { note, action, sets });
  }
  await postBrokerSettlement(row.id, user);
}

/**
 * Checker decision on the settlement awaiting approval (approve, or return to review). The approver differs from the
 * requester, approves no more than the amount requested, and within the Authority Matrix limit of claim settlements
 * (claims.require_authority_limit). A partial settlement is released on approval; a final one too when
 * claims.auto_settle_on_approval is on.
 */
export async function approveSettlement(id, { decision = 'approve', approvedAmount, note }, user) {
  const row = await loadRow(id);
  const from = row.status;
  if (from !== 'pending-approval') throw conflict('Claim has no settlement awaiting approval');
  if (row.settlement_requested_by && row.settlement_requested_by === user?.id) throw forbidden('Maker-checker: the settlement must be approved by a different user');
  const st = await one("SELECT * FROM claim_settlements WHERE claim_id = $1 AND status = 'pending' ORDER BY seq DESC LIMIT 1", [row.id]);
  if (!st) throw conflict('Claim has no settlement awaiting approval');
  const tell = (approved, status, reason = null) => notifyDecision({ userId: row.settlement_requested_by, decidedBy: user?.id, document: 'Claim settlement', number: row.claim_number,
    approved, status, by: user?.username, reason, link: `/agent/claimdetail/${row.id}`, entity: 'claim', entityId: row.id });
  if (decision === 'return' || decision === 'reject') {
    await query("UPDATE claim_settlements SET status = 'returned', decided_by = $2, decided_at = now(), decision_note = $3 WHERE id = $1", [st.id, user?.id ?? null, note || null]);
    const back = (await approvedTotal(row.id)) > 0 ? 'partially-settled' : 'in-review';
    await transition(row, back, user, { note: note || 'Settlement returned for review', action: 'Settlement Returned' });
    await tell(false, 'returned', note || null);
    return { from, claim: await getClaim(row.id) };
  }
  const amount = round2(toNum(approvedAmount) ?? Number(st.amount));
  if (amount > Number(st.amount) + 0.005) {
    throw unprocessable(`The approved amount cannot exceed the settlement requested (${await formatMoney(st.amount)})`, [{ path: 'approvedAmount', message: 'The approved amount cannot exceed the settlement requested' }]);
  }
  await assertApprovalLimit(user, 'claim_settlement', amount, { requireLimit: !!(await getSetting('claims.require_authority_limit')) });
  await query("UPDATE claim_settlements SET status = 'approved', approved_amount = $2, decided_by = $3, decided_at = now(), decision_note = $4 WHERE id = $1", [st.id, amount, user?.id ?? null, note || null]);
  const settlement = { ...(row.settlement || {}), approvedBy: user?.username, approvedAt: new Date().toISOString() };
  const approvedSets = { settlement_approved_by: user?.id ?? null, settlement_approved_at: new Date() };
  if (st.kind === 'partial') {
    await query('UPDATE claims SET settlement_approved_by = $2, settlement_approved_at = $3 WHERE id = $1', [row.id, approvedSets.settlement_approved_by, approvedSets.settlement_approved_at]);
    await release(row, st, settlement, user, { note: note || `Partial settlement of ${await formatMoney(amount)} approved and released` });
  } else {
    await transition(row, 'approved', user, { note: note || `Settlement of ${await formatMoney(amount)} approved`, action: 'Settlement Approved', sets: { approved_amount: await approvedTotal(row.id), settlement: JSON.stringify(settlement), ...approvedSets } });
    if (await getSetting('claims.auto_settle_on_approval', true)) await release(row, st, settlement, user, { note: 'Settlement released' });
  }
  await tell(true, 'approved');
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
  // a death claim is acknowledged with the empathy letter (TIS-BRD-PJRN-08), addressed to the family of the insured
  const empathy = /acknowledg/i.test(documentName) && isDeathClaim(row) && templates['Claims Empathy Letter'] ? 'Claims Empathy Letter' : null;
  const key = empathy || Object.keys(templates).find((k) => k.toLowerCase() === String(documentName).toLowerCase());
  if (!key) throw notFound(`Document "${documentName}" is not available for this claim`);
  const ctx = await printContext();
  const vars = await docVars(row, ctx.format);
  if (empathy) vars.salutation = `Dear family of ${vars.insuredName},`;
  const lines = (Array.isArray(templates[key]) ? templates[key] : String(templates[key]).split('\n')).map((l) => renderTemplate(l, vars, { html: false }));
  // {{signature:<slot>}} lines print the signature mapped to the claim settlement letter (modules/e-signatures)
  const sigCtx = { status: row.status, date: row.settled_at || row.settlement_approved_at || new Date(), approvedBy: row.settlement_approved_by, format: ctx.format, companyName: ctx.letterhead?.name };
  const docType = /settle/i.test(key) ? 'claim-settlement-letter' : null;
  const signed = {};
  for (const l of lines) {
    for (const m of String(l).matchAll(SIGNATURE_PLACEHOLDER)) {
      const slot = m[1].toLowerCase();
      if (!signed[slot]) signed[slot] = (docType && await renderSignatureBlock(docType, slot, sigCtx)) || { label: 'Authorized signature' };
    }
  }
  const watermarkOf = async () => {
    if (!docType || !Object.keys(signed).length) return undefined;
    const state = documentState(docType, row.status);
    if (state === 'cancelled') return 'CANCELLED';
    return state === 'draft' ? ((await getSetting('signatures.draft_watermark', 'UNSIGNED DRAFT')) || undefined) : undefined;
  };
  const pdf = buildPdf({ ...ctx, ...claimDocSpec(key, lines, vars, ctx, signed), watermark: await watermarkOf() });
  return { buffer: pdf, contentType: 'application/pdf', fileName: `${key}.pdf` };
}

/**
 * A claim document from its template lines: runs of "Label: value" lines become a details grid, other lines
 * paragraphs; a "Signature: ____" line becomes a signature block. Letters, discharge vouchers and data sheets get the
 * signature lines they need.
 */
export function claimDocSpec(title, lines, vars, ctx = {}, signed = {}) {
  const sections = [];
  let rows = [];
  let signatures = [];
  const flush = () => { if (rows.length) sections.push({ rows, columns: rows.length > 4 ? 2 : 1 }); rows = []; };
  for (const raw of lines) {
    const l = String(raw).trim();
    if (!l) { flush(); continue; }
    const placeholders = [...l.matchAll(SIGNATURE_PLACEHOLDER)].map((m) => m[1].toLowerCase());
    if (placeholders.length) {
      flush();
      signatures = [...signatures, ...placeholders.map((slot) => {
        const b = signed[slot] || { label: 'Authorized signature' };
        return { label: b.label, name: b.name || null, title: b.title || null, image: b.image || null, date: b.date || null };
      })];
      continue;
    }
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
  if (Object.keys(signed).length) { /* mapped signatures: as placed in the template */ } else if (/acknowledg/i.test(title)) signatures = [{ label: 'Claims Department', name: company }];
  else if (/discharge/i.test(title)) signatures = [{ label: 'Insured / claimant', name: vars.insuredName }, { label: 'Witness' }, { label: `For ${company}`.trim() }];
  else if (!signatures.length && /data sheet/i.test(title)) signatures = [{ label: 'Prepared by' }, { label: 'Reviewed by' }];
  const meta = [['Claim no.', vars.claimNumber], ['Policy no.', vars.policyNumber], ['Insured', vars.insuredName], ['Insurer', vars.insurerName]].filter(([, v]) => v);
  const isLetter = /letter/i.test(title);
  return {
    title, number: vars.claimNumber, dateLine: `Date ${formatDate(new Date(), ctx.format)}`,
    meta: isLetter ? meta : [],
    sections: [...(isLetter && (vars.salutation || vars.insuredName) ? [{ text: vars.salutation || `Dear ${vars.insuredName},` }] : []), ...sections,
      ...(isLetter ? [{ text: `Sincerely,` }] : []), ...(signatures.length ? [{ signatures, perRow: Math.min(3, signatures.length) }] : [])],
  };
}

// ---------------------------------------------------------------- reports
/**
 * Claims of a period for the reports: by reported date, or (basis settlement) by settlement date (the business date of
 * settled_at); optional claim type, insurer and line of business. Each row carries its document completeness and next
 * open follow-up.
 */
async function reportRows(startDate, endDate, scope = null, { basis = 'reported', claimType = null, insurerId = null, lob = null } = {}) {
  const params = [startDate, endDate];
  if (basis === 'settlement') params.push(await getSetting('general.timezone', 'Asia/Manila'));
  const when = basis === 'settlement' ? '(c.settled_at AT TIME ZONE $3::text)::date' : 'c.reported_date';
  const where = [`${when} BETWEEN $1::date AND $2::date`];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (claimType) add('lower(c.claim_type) = lower(?)', claimType);
  if (insurerId) add('p.insurance_company_id::text = ?', String(insurerId));
  if (lob) add('upper(COALESCE(c.lob, pr.line)) = upper(?)', lob);
  where.push(scopeSql(scope, 'claim', 'c', params));
  return many(`SELECT x.*, (SELECT count(*) FROM claim_document_items i WHERE i.claim_id = x.id AND i.required)::int AS docs_required,
      (SELECT count(*) FROM claim_document_items i WHERE i.claim_id = x.id AND i.required AND i.status <> 'pending')::int AS docs_received,
      (SELECT min(k.follow_up_date) FROM claim_communications k WHERE k.claim_id = x.id AND k.follow_up_date IS NOT NULL AND k.follow_up_done_at IS NULL) AS next_follow_up
    FROM (${BASE} WHERE ${where.join(' AND ')}) x ORDER BY ${basis === 'settlement' ? 'x.settled_at DESC' : 'x.reported_date DESC'}, x.claim_number DESC`, params);
}
const countBy = (items, fn, key) => {
  const m = new Map();
  for (const i of items) { const k = fn(i) || 'Unknown'; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([k, count]) => ({ [key]: k, count })).sort((a, b) => b.count - a.count);
};

/** Claims dashboard (GET /claims/report): summary, breakdowns, ageing and optionally the detailed rows. */
export async function claimsReport({ startDate, endDate, includeData, [SCOPE]: scope = null }) {
  const start = (await businessDate(startDate)) || `${new Date().getFullYear()}-01-01`;
  const end = (await businessDate(endDate)) || await today();
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
  customerName: c.customerName, policyNumber: c.policyNumber, insuranceCompanyName: c.insuranceCompanyName, insurerClaimNumber: c.insuranceCompanyClaimNumber || '',
  province: c.state, city: c.city, fnolSource: c.fnolSource || '', lossCause: c.typeOfIncident || '',
  reportedDate: c.reportedDate, dateOfIncident: c.dateOfIncident, claimDueDate: c.claimDueDate, estimatedClaimAmount: c.estimatedClaimAmount,
  requirements: c.docsRequired ? `${c.docsReceived} of ${c.docsRequired}` : '', requirementsComplete: c.docsRequired ? c.docsReceived >= c.docsRequired : null,
  nextFollowUp: c.nextFollowUp || null, insurerAdvice: c.insurerAdviceLabel || '', offeredAmount: c.insurerOfferAmount, settlementType: c.settlementType || '',
  settlementDate: c.settlementDate || null, settledOn: c.settledAt ? c.settledOn : null,
  approvedAmount: c.approvedAmount, settledAmount: c.settledAmount, handlerName: c.handlerName, reportedByName: c.reportedByName, createdAt: c.createdAt, daysOverdue: c.daysOverdue,
  lateIntimation: c.lateIntimation ? 'Yes' : '', rejectedReason: c.rejectedReason || c.cancelledReason || '',
});
export const REPORT_COLUMNS = [
  ['claimNumber', 'Claim No.'], ['policyNumber', 'Policy No.'], ['customerName', 'Insured / beneficiary'], ['insuranceCompanyName', 'Insurer'], ['insurerClaimNumber', 'Insurer claim No.'],
  ['lob', 'LOB'], ['claimType', 'Claim type'], ['lossCause', 'Cause of loss'], ['fnolSource', 'Reported through'], ['claimStatus', 'Status'], ['claimPriority', 'Priority'],
  ['province', 'Province'], ['city', 'City'], ['dateOfIncident', 'Date of loss'], ['reportedDate', 'Reported'], ['lateIntimation', 'Late intimation'],
  ['requirements', 'Requirements received'], ['nextFollowUp', 'Next follow-up'], ['claimDueDate', 'Due date'], ['daysOverdue', 'Days overdue'], ['insurerAdvice', 'Insurer advice'],
  ['estimatedClaimAmount', 'Estimate'], ['offeredAmount', 'Offered'], ['approvedAmount', 'Approved'], ['settledAmount', 'Settled'], ['settlementType', 'Settlement type'],
  ['settledOn', 'Settled on'], ['rejectedReason', 'Rejection / cancellation reason'], ['handlerName', 'Person in charge'],
].map(([key, header]) => ({ key, header }));

/**
 * Rows of the Insurance Claims Report (Operational Reports > Claims; TIS-BRD-RPT-OPS-02 / 03): criteria All | Open |
 * Partial | Settled (settled or closed with a settlement) | Rejected | Cancelled | Aging (open and past the follow-up
 * date), claim type, insurer and line, over the reported date or (dateBasis settlement) the settlement date.
 */
export async function criteriaRows({ startDate, endDate, criteria = 'All', dateBasis, claimType, insurerId, lob, [SCOPE]: scope = null }) {
  const start = (await businessDate(startDate)) || '1900-01-01';
  const end = (await businessDate(endDate)) || await today();
  const ctx = await readContext();
  const basis = dateBasis === 'settlement' ? 'settlement' : 'reported';
  const all = [];
  for (const r of await reportRows(start, end, scope, { basis, claimType: claimType || null, insurerId: insurerId || null, lob: lob || null })) {
    all.push({ ...toApi(r, ctx.labels, ctx.todayStr, ctx.open, ctx.advice), state: r.loss_province || r.client_state || '', city: r.loss_city || r.client_city || '',
      docsRequired: r.docs_required, docsReceived: r.docs_received, nextFollowUp: r.next_follow_up, settledOn: r.settled_at ? await businessDate(r.settled_at) : null });
  }
  const c = String(criteria).toLowerCase();
  const filtered = all.filter((x) => (c === 'open' ? x.isOpen
    : c === 'partial' ? x.lifecycleStatus === 'partially-settled'
      : c === 'settled' ? ['settled', 'closed'].includes(x.lifecycleStatus) && x.settledAmount != null
        : c === 'rejected' ? x.lifecycleStatus === 'rejected'
          : c === 'cancelled' ? x.lifecycleStatus === 'cancelled'
            : c === 'aging' ? x.isOpen && x.daysOverdue > 0 : true));
  return { start, end, basis, rows: filtered.map(detailRow) };
}
