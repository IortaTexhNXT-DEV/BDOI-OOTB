/**
 * Risk-based customer due diligence: the customer risk rating (Low, Normal, High) from the configurable risk factors,
 * the KYC status of a client, the KYC refresh schedule per rating, and the enhanced due diligence (EDD) reviews that a
 * High rating requires.
 *
 * Score: for each factor the highest score among the values of the client that it matches (a value with no row of its
 * own takes the factor's '*' row), added up. Low up to aml.risk_low_max_score, High from aml.risk_high_min_score.
 * A PEP (client or beneficial owner) is High when aml.pep_always_high is on; a confirmed sanctions or negative list
 * match is always High. A compliance officer's override holds until the next KYC refresh.
 */
import { query } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { notify } from '../notifications/service.js';
import { addMonths, amlSetting, clientName, isoDay, lc, num, RATINGS } from './common.js';

export const FACTORS = ['client-type', 'nationality', 'pep', 'line', 'payment-mode', 'premium-size', 'geography'];
const pool = { query };

export const factorRow = (r) => ({
  id: r.id, factor: r.factor, matchValue: r.match_value, minAmount: r.min_amount === null ? null : Number(r.min_amount),
  maxAmount: r.max_amount === null ? null : Number(r.max_amount), score: r.score, description: r.description, active: r.active, updatedAt: r.updated_at,
});

export async function listFactors(db = pool) {
  return (await db.query('SELECT * FROM aml_risk_factors ORDER BY array_position($1::text[], factor), score, match_value', [FACTORS])).rows.map(factorRow);
}

export async function saveFactor(id, b, userId) {
  if (!FACTORS.includes(b.factor)) throw badRequest(`factor must be one of ${FACTORS.join(', ')}`);
  if (b.factor === 'premium-size' && (b.minAmount === null || b.minAmount === undefined)) throw badRequest('A premium-size factor needs the lower bound of its band (minAmount)');
  const vals = [b.factor, b.factor === 'premium-size' ? '*' : String(b.matchValue || '*').trim(), b.minAmount ?? null, b.maxAmount ?? null, Number(b.score), b.description || null, b.active !== false, userId];
  try {
    if (id) {
      const before = (await query('SELECT * FROM aml_risk_factors WHERE id = $1', [id])).rows[0];
      if (!before) throw notFound('Risk factor not found');
      const r = await query(`UPDATE aml_risk_factors SET factor = $2, match_value = $3, min_amount = $4, max_amount = $5, score = $6, description = $7, active = $8,
        updated_by = $9, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
      return { before: factorRow(before), after: factorRow(r.rows[0]) };
    }
    const r = await query(`INSERT INTO aml_risk_factors(factor, match_value, min_amount, max_amount, score, description, active, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, vals);
    return { before: null, after: factorRow(r.rows[0]) };
  } catch (e) {
    if (e.code === '23505') throw conflict(`A ${b.factor} factor for "${vals[1]}" already exists`);
    throw e;
  }
}

export async function deleteFactor(id) {
  const r = await query('DELETE FROM aml_risk_factors WHERE id = $1 RETURNING *', [id]);
  if (!r.rowCount) throw notFound('Risk factor not found');
  return factorRow(r.rows[0]);
}

/** Rating of a score. */
export async function ratingOf(score) {
  const low = num(await amlSetting('aml.risk_low_max_score'));
  const high = num(await amlSetting('aml.risk_high_min_score'));
  if (score >= high) return 'high';
  if (score <= low) return 'low';
  return 'normal';
}

/** The values of a client for each factor (what is scored). `extra`: { lob, premium, paymentMode } of a policy being issued. */
export async function clientFactorValues(db, client, extra = {}) {
  const owners = (await db.query("SELECT is_pep FROM client_beneficial_owners WHERE client_id = $1 AND status = 'active'", [client.id])).rows;
  const policies = (await db.query(`SELECT p.lob, pr.code AS product_code, p.premium_total, p.payment_method FROM policies p LEFT JOIN products pr ON pr.id = p.product_id
    WHERE p.client_id = $1 AND lower(COALESCE(p.status, '')) NOT IN ('cancelled', 'expired', 'lapsed', 'void')`, [client.id])).rows;
  const modes = (await db.query(`SELECT DISTINCT lower(payment_mode) AS m FROM receipts WHERE client_id = $1 AND received_date >= CURRENT_DATE - 365
    AND lower(COALESCE(receipt_status, '')) <> 'cancelled'`, [client.id])).rows.map((r) => r.m);
  // line of business and product code of each policy (a factor may name either: MARINE, or BOND for surety bonds)
  const lines = [...new Set([...(client.expected_lines || []), ...policies.flatMap((p) => [p.lob, p.product_code]), extra.lob, extra.productCode]
    .filter(Boolean).map((x) => String(x).toUpperCase()))];
  const premium = Math.max(num(client.expected_annual_premium), policies.reduce((s, p) => s + num(p.premium_total), 0) + num(extra.premium));
  const pay = [...new Set([...modes, client.expected_payment_mode, extra.paymentMode, ...policies.map((p) => p.payment_method)].filter(Boolean).map(lc))];
  const pep = !!client.is_pep || owners.some((o) => o.is_pep);
  return {
    'client-type': [client.customer_type, client.client_type].filter(Boolean),
    nationality: [client.client_type === 'corporate' ? client.incorporation_country || client.nationality : client.nationality].filter(Boolean),
    pep: [pep ? 'yes' : 'no'],
    line: lines,
    'payment-mode': pay,
    'premium-size': premium > 0 ? [premium] : [],
    geography: [client.country, client.region, client.state, client.city].filter(Boolean),
  };
}

/** Score the values against the factor table: { score, factors: [{ factor, value, score, description }] }. */
export function scoreValues(rows, values) {
  const out = [];
  for (const factor of FACTORS) {
    const list = rows.filter((r) => r.factor === factor && r.active);
    const vals = values[factor] || [];
    if (!list.length || !vals.length) continue;
    let top = null;
    for (const v of vals) {
      let hit;
      if (factor === 'premium-size') {
        hit = list.find((r) => num(v) >= num(r.minAmount) && (r.maxAmount === null || num(v) < r.maxAmount));
      } else {
        hit = list.find((r) => lc(r.matchValue) === lc(v)) || list.find((r) => r.matchValue === '*');
      }
      if (hit && (!top || hit.score > top.score)) top = { factor, value: factor === 'premium-size' ? Number(v) : String(v), score: hit.score, description: hit.description };
    }
    if (top) out.push(top);
  }
  return { score: out.reduce((s, f) => s + f.score, 0), factors: out };
}

async function approvedEdd(db, clientId) {
  const months = (await amlSetting('aml.kyc_refresh_months'))?.high || 12;
  const r = await db.query(`SELECT id FROM aml_edd_reviews WHERE client_id = $1 AND status = 'approved'
    AND decided_at >= now() - make_interval(months => $2::int) ORDER BY decided_at DESC LIMIT 1`, [clientId, Number(months)]);
  return r.rows[0] || null;
}

/** Items of the identification still missing for the client (empty when the record is complete). */
export async function missingKyc(db, c) {
  const missing = [];
  const need = (v, label) => { if (v === null || v === undefined || String(v).trim() === '') missing.push(label); };
  if (c.client_type === 'corporate') {
    need(c.company_name, 'Registered name');
    need(c.registration_number, 'SEC, DTI or CDA registration number');
    need(c.tin, 'TIN');
    need(c.city || c.state, 'Registered address');
    const sig = Number((await db.query("SELECT count(*) AS n FROM client_signatories WHERE client_id = $1 AND status = 'active'", [c.id])).rows[0].n);
    if (!sig) missing.push('Authorised signatory with board resolution or secretary\'s certificate');
    const bo = Number((await db.query("SELECT count(*) AS n FROM client_beneficial_owners WHERE client_id = $1 AND status = 'active'", [c.id])).rows[0].n);
    if (!bo) missing.push('Beneficial owner declaration');
  } else {
    need(c.first_name, 'First name');
    need(c.last_name, 'Last name');
    need(c.birth_date, 'Date of birth');
    need(c.nationality, 'Nationality');
    need(c.id_type, 'ID type');
    need(c.id_number, 'ID number');
    need(c.city || c.state, 'Address');
  }
  return missing;
}

/** KYC status of the client from its record, rating, screening and EDD. */
export async function kycStatusOf(db, c) {
  const confirmed = Number((await db.query("SELECT count(*) AS n FROM aml_screening_hits WHERE client_id = $1 AND status = 'confirmed'", [c.id])).rows[0].n);
  if (confirmed) return 'blocked';
  if (c.risk_rating === 'high' && !(await approvedEdd(db, c.id))) return 'edd-required';
  const now = await today();
  if (c.kyc_next_review_on && isoDay(c.kyc_next_review_on) <= now) return 'refresh-due';
  return (await missingKyc(db, c)).length ? 'pending' : 'complete';
}

/** Recompute and store the KYC status of a client; returns it. */
export async function refreshKycStatus(db, clientId) {
  const c = (await db.query('SELECT * FROM clients WHERE id = $1', [clientId])).rows[0];
  if (!c) return null;
  const status = await kycStatusOf(db, c);
  if (status !== c.kyc_status) await db.query('UPDATE clients SET kyc_status = $2 WHERE id = $1', [clientId, status]);
  return status;
}

/**
 * Rate a client and store the assessment. trigger: onboarding | policy-issue | refresh | manual | screening | override.
 * extra: { lob, premium, paymentMode } of a policy being issued; override: { rating, reason } (compliance officer).
 * Opens an EDD review when the client becomes High and has neither an open nor a recently approved one.
 */
export async function assessClient(db, clientId, { trigger = 'manual', extra = {}, override = null, userId = null, reference = null } = {}) {
  const c = (await db.query('SELECT * FROM clients WHERE id = $1', [clientId])).rows[0];
  if (!c) throw notFound('Client not found');
  const rows = await listFactors(db);
  const values = await clientFactorValues(db, c, extra);
  const { score, factors } = scoreValues(rows, values);
  let computed = await ratingOf(score);
  const reasons = [];
  if (values.pep[0] === 'yes' && (await amlSetting('aml.pep_always_high'))) { computed = 'high'; reasons.push('Politically exposed person'); }
  const confirmed = Number((await db.query("SELECT count(*) AS n FROM aml_screening_hits WHERE client_id = $1 AND status = 'confirmed'", [clientId])).rows[0].n);
  if (confirmed) { computed = 'high'; reasons.push('Confirmed screening match'); }
  let rating = computed;
  let overrideReason = null;
  if (override) {
    if (!RATINGS.includes(override.rating)) throw badRequest(`rating must be one of ${RATINGS.join(', ')}`);
    if (!override.reason || String(override.reason).trim().length < 5) throw badRequest('Give the reason for the override (at least 5 characters)');
    rating = override.rating;
    overrideReason = String(override.reason).trim();
  } else if (trigger !== 'refresh') {
    // an override holds until the next KYC refresh; a confirmed match always rates High
    const last = (await db.query("SELECT trigger, rating FROM aml_risk_assessments WHERE client_id = $1 AND trigger IN ('override', 'refresh') ORDER BY assessed_at DESC, id DESC LIMIT 1", [clientId])).rows[0];
    if (last?.trigger === 'override' && !confirmed) { rating = last.rating; reasons.push('Rating set by the compliance officer'); }
  }
  const now = await today();
  const months = (await amlSetting('aml.kyc_refresh_months')) || {};
  const fresh = addMonths(now, Number(months[rating] || 24));
  const existing = isoDay(c.kyc_next_review_on);
  const reset = ['onboarding', 'refresh', 'override'].includes(trigger) || !existing || c.risk_rating !== rating;
  const next = reset ? fresh : (existing < fresh ? existing : fresh);
  const a = (await db.query(`INSERT INTO aml_risk_assessments(client_id, trigger, score, computed_rating, rating, factors, override_reason, next_review_on, reference, assessed_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
  [clientId, override ? 'override' : trigger, score, computed, rating, JSON.stringify({ factors, reasons }), overrideReason, next, reference, userId])).rows[0];
  await db.query(`UPDATE clients SET risk_rating = $2, risk_score = $3, risk_assessed_at = now(), kyc_next_review_on = $4,
    kyc_reviewed_on = CASE WHEN $5 THEN $6::date ELSE kyc_reviewed_on END WHERE id = $1`,
  [clientId, rating, score, next, ['onboarding', 'refresh'].includes(trigger), now]);
  let edd = null;
  if (rating === 'high') edd = await ensureEdd(db, clientId, a, userId);
  const status = await refreshKycStatus(db, clientId);
  return { ...assessmentRow(a), kycStatus: status, eddReview: edd };
}

export const assessmentRow = (a) => ({
  id: Number(a.id), clientId: a.client_id, trigger: a.trigger, score: a.score, computedRating: a.computed_rating, rating: a.rating,
  factors: a.factors?.factors || [], reasons: a.factors?.reasons || [], overrideReason: a.override_reason, nextReviewOn: isoDay(a.next_review_on),
  reference: a.reference, assessedBy: a.assessed_by_name || a.assessed_by, assessedAt: a.assessed_at,
});

export async function assessments(clientId, limit = 20) {
  return (await query(`SELECT a.*, u.display_name AS assessed_by_name FROM aml_risk_assessments a LEFT JOIN users u ON u.id = a.assessed_by
    WHERE a.client_id = $1 ORDER BY a.assessed_at DESC, a.id DESC LIMIT $2`, [clientId, limit])).rows.map(assessmentRow);
}

// ---------------------------------------------------------------- EDD reviews

export const eddRow = (e) => ({
  id: e.id, reviewNumber: e.review_number, clientId: e.client_id, clientCode: e.client_code, clientName: e.client_name, riskScore: e.risk_score ?? null,
  status: e.status, reason: e.reason, sourceOfWealth: e.source_of_wealth, sourceOfFunds: e.source_of_funds, purpose: e.purpose, findings: e.findings,
  seniorManagementApproval: e.senior_management_approval, submittedBy: e.submitted_by_name || e.submitted_by, submittedById: e.submitted_by, submittedAt: e.submitted_at,
  decidedBy: e.decided_by_name || e.decided_by, decidedAt: e.decided_at, decisionNotes: e.decision_notes, createdAt: e.created_at, documents: e.documents || [],
});

const EDD_SELECT = `SELECT e.*, c.client_code, c.display_name AS client_name, c.risk_score, su.display_name AS submitted_by_name, du.display_name AS decided_by_name
  FROM aml_edd_reviews e JOIN clients c ON c.id = e.client_id LEFT JOIN users su ON su.id = e.submitted_by LEFT JOIN users du ON du.id = e.decided_by`;

async function ensureEdd(db, clientId, assessment, userId) {
  const open = (await db.query("SELECT * FROM aml_edd_reviews WHERE client_id = $1 AND status IN ('open', 'submitted') LIMIT 1", [clientId])).rows[0];
  if (open) return { id: open.id, reviewNumber: open.review_number, status: open.status };
  if (await approvedEdd(db, clientId)) return null;
  return openEdd(db, clientId, `Rated High (score ${assessment.score})`, userId, assessment.id);
}

export async function openEdd(db, clientId, reason, userId, assessmentId = null) {
  const c = (await db.query('SELECT client_code, display_name FROM clients WHERE id = $1', [clientId])).rows[0];
  if (!c) throw notFound('Client not found');
  const number = await nextDocumentNumber('aml_edd', { db, unique: { table: 'aml_edd_reviews', column: 'review_number' } });
  const e = (await db.query(`INSERT INTO aml_edd_reviews(review_number, client_id, assessment_id, reason, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [number, clientId, assessmentId, reason, userId])).rows[0];
  await notify({ type: 'reminder', priority: 'high', title: `EDD review ${number} opened`, message: `${c.display_name} (${c.client_code}): ${reason}`,
    link: '/compliance/aml/edd', entity: 'aml_edd_review', entityId: e.id, audience: 'read:aml' });
  return { id: e.id, reviewNumber: number, status: e.status };
}

export async function listEdd(q = {}) {
  const where = [];
  const params = [];
  if (q.status) { params.push(String(q.status).split(',')); where.push(`e.status = ANY($${params.length})`); }
  if (q.clientId) { params.push(q.clientId); where.push(`e.client_id = $${params.length}`); }
  if (q.search) { params.push(q.search); where.push(`(c.display_name ILIKE '%' || $${params.length} || '%' OR c.client_code ILIKE '%' || $${params.length} || '%' OR e.review_number ILIKE '%' || $${params.length} || '%')`); }
  const rows = (await query(`${EDD_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.created_at DESC LIMIT 500`, params)).rows;
  return rows.map(eddRow);
}

export async function getEdd(id, db = pool) {
  const e = (await db.query(`${EDD_SELECT} WHERE e.id = $1 OR e.review_number = $1`, [id])).rows[0];
  if (!e) throw notFound('EDD review not found');
  const docs = (await db.query("SELECT id, doc_type, description, file_name, storage_key, uploaded_at FROM client_kyc_documents WHERE related_type = 'edd' AND related_id = $1 ORDER BY id", [e.id])).rows;
  return eddRow({ ...e, documents: docs.map((d) => ({ id: Number(d.id), docType: d.doc_type, description: d.description, fileName: d.file_name, storageKey: d.storage_key, uploadedAt: d.uploaded_at })) });
}

export async function updateEdd(id, b, userId) {
  const before = await getEdd(id);
  if (!['open', 'rejected'].includes(before.status)) throw conflict(`EDD review ${before.reviewNumber} is ${before.status}; it can be changed while open or rejected`);
  await query(`UPDATE aml_edd_reviews SET source_of_wealth = COALESCE($2, source_of_wealth), source_of_funds = COALESCE($3, source_of_funds), purpose = COALESCE($4, purpose),
    findings = COALESCE($5, findings), senior_management_approval = COALESCE($6, senior_management_approval), status = 'open', updated_by = $7, updated_at = now() WHERE id = $1`,
  [before.id, b.sourceOfWealth ?? null, b.sourceOfFunds ?? null, b.purpose ?? null, b.findings ?? null, b.seniorManagementApproval ?? null, userId]);
  return { before, after: await getEdd(before.id) };
}

export async function submitEdd(id, userId) {
  const e = await getEdd(id);
  if (!['open', 'rejected'].includes(e.status)) throw conflict(`EDD review ${e.reviewNumber} is ${e.status}`);
  const missing = [['sourceOfWealth', 'source of wealth'], ['sourceOfFunds', 'source of funds'], ['purpose', 'purpose of the relationship'], ['findings', 'findings']]
    .filter(([k]) => !e[k] || String(e[k]).trim().length < 3).map(([, l]) => l);
  if (missing.length) throw badRequest(`Complete the EDD review before submitting it: ${missing.join(', ')}`);
  await query("UPDATE aml_edd_reviews SET status = 'submitted', submitted_by = $2, submitted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1", [e.id, userId]);
  await notify({ type: 'approval', priority: 'high', title: `EDD review ${e.reviewNumber} to approve`, message: `${e.clientName} (${e.clientCode})`,
    link: '/compliance/aml/edd', entity: 'aml_edd_review', entityId: e.id, audience: 'approve:aml' });
  return getEdd(e.id);
}

/** Compliance officer's decision (approve:aml); the preparer who submitted it cannot decide it. */
export async function decideEdd(id, { decision, notes }, user) {
  const e = await getEdd(id);
  if (e.status !== 'submitted') throw conflict(`EDD review ${e.reviewNumber} is ${e.status}; only a submitted review can be decided`);
  await assertChecker(user, e.submittedById, 'EDD review', { configurable: false });
  if (!['approve', 'reject'].includes(decision)) throw badRequest('decision must be approve or reject');
  if (decision === 'reject' && (!notes || String(notes).trim().length < 5)) throw badRequest('Give the reason for the rejection (at least 5 characters)');
  await query(`UPDATE aml_edd_reviews SET status = $2, decided_by = $3, decided_at = now(), decision_notes = $4, updated_by = $3, updated_at = now() WHERE id = $1`,
    [e.id, decision === 'approve' ? 'approved' : 'rejected', user.id, notes || null]);
  await refreshKycStatus(pool, e.clientId);
  return getEdd(e.id);
}

/** Refuse to issue a policy to a High-risk client without an approved EDD review (aml.block_issue_pending_edd). */
export async function assertEddForIssue(db, clientId) {
  if (!(await amlSetting('aml.block_issue_pending_edd'))) return;
  const c = (await db.query('SELECT risk_rating, display_name, client_code FROM clients WHERE id = $1', [clientId])).rows[0];
  if (c?.risk_rating !== 'high' || (await approvedEdd(db, clientId))) return;
  throw conflict(`${c.display_name} (${c.client_code}) is rated High risk: the enhanced due diligence review must be approved by the compliance officer before a policy is issued (Compliance > EDD Reviews)`);
}

// ---------------------------------------------------------------- KYC refresh

/** Clients whose KYC refresh is due within aml.kyc_refresh_notice_days (or overdue). */
export async function refreshDue(q = {}) {
  const days = Number(await amlSetting('aml.kyc_refresh_notice_days'));
  const now = await today();
  const params = [now, days];
  const where = ["c.status <> 'deleted'", 'c.anonymised_at IS NULL', 'c.kyc_next_review_on IS NOT NULL', 'c.kyc_next_review_on <= $1::date + $2::int'];
  if (q.rating) { params.push(q.rating); where.push(`c.risk_rating = $${params.length}`); }
  if (q.overdue === 'true' || q.overdue === true) where.push('c.kyc_next_review_on <= $1::date');
  const rows = (await query(`SELECT c.id, c.client_code, c.display_name, c.client_type, c.risk_rating, c.risk_score, c.kyc_status, c.kyc_reviewed_on, c.kyc_next_review_on
    FROM clients c WHERE ${where.join(' AND ')} ORDER BY c.kyc_next_review_on, c.client_code LIMIT 1000`, params)).rows;
  return rows.map((r) => ({ clientId: r.id, clientCode: r.client_code, clientName: r.display_name, clientType: r.client_type, riskRating: r.risk_rating,
    riskScore: r.risk_score, kycStatus: r.kyc_status, lastReviewedOn: isoDay(r.kyc_reviewed_on), nextReviewOn: isoDay(r.kyc_next_review_on), overdue: isoDay(r.kyc_next_review_on) <= now }));
}

/** Complete the KYC refresh of a client: reassessed (trigger refresh), next review date set from the new rating. */
export async function completeRefresh(clientId, notes, userId) {
  const c = (await query('SELECT id FROM clients WHERE id = $1 OR client_code = $1', [clientId])).rows[0];
  if (!c) throw notFound('Client not found');
  return assessClient(pool, c.id, { trigger: 'refresh', userId, reference: notes || null });
}

export const clientLabel = (c) => `${clientName(c)} (${c.client_code})`;
