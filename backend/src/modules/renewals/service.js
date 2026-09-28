/**
 * Renewals business logic: pipeline, coverage capture from the renewal quote wizard, re-rating at current rates,
 * ordered notices (first, second, final), contact log, maker-checker approval, renewal completion (new policy term)
 * and lapse / reinstatement.
 */
import { many, one, pool, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { queueEmail } from '../../lib/mailer.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { notify } from '../notifications/router.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { renderTemplate } from '../claims/docs.js';
import { daysBetween, nextNumber, round2, toDate, today, unprocessable, usersWithRole } from '../claims/util.js';

export const OPEN = ['pipeline', 'notice-1', 'notice-2', 'final-notice', 'quoted', 'pending-approval', 'approved'];
const NOTICE_STATUS = ['notice-1', 'notice-2', 'final-notice'];
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const addYears = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCFullYear(x.getUTCFullYear() + n); return x.toISOString().slice(0, 10); };

// ---------------------------------------------------------------- read model
export const BASE = `SELECT r.*, p.policy_number, p.inception_date, p.expiry_date AS policy_expiry, p.sum_insured, p.premium_total,
  p.commission_amount, p.status AS policy_status, p.client_id AS policy_client_id, p.owner_user_id AS policy_owner, p.currency,
  p.product_id, p.policy_type_id, p.insurance_company_id, p.details AS policy_details, p.renewed_from,
  cl.display_name AS client_name, cl.email AS client_email, cl.phone AS client_phone,
  ic.name AS insurer_name, pr.name AS product_name, pr.line AS product_line, ou.display_name AS agent_name,
  (SELECT count(*) FROM claims c WHERE c.policy_id = p.id)::int AS claims_count,
  (SELECT COALESCE(sum(COALESCE(c.settled_amount, c.estimate_amount)), 0) FROM claims c WHERE c.policy_id = p.id)::numeric AS claims_amount,
  (SELECT COALESCE(sum(rv.balance), 0) FROM receivables rv WHERE rv.policy_id = p.id AND rv.balance > 0 AND rv.status NOT IN ('paid', 'written-off'))::numeric AS unpaid,
  (WITH RECURSIVE ch(pid, d) AS (SELECT p.renewed_from, 1 WHERE p.renewed_from IS NOT NULL
     UNION ALL SELECT pp.renewed_from, ch.d + 1 FROM policies pp JOIN ch ON pp.id = ch.pid WHERE pp.renewed_from IS NOT NULL AND ch.d < 50)
   SELECT count(*) FROM ch)::int AS loyalty_years,
  (SELECT su.display_name FROM users su WHERE su.id = r.submitted_by) AS submitted_by_name,
  (SELECT au.display_name FROM users au WHERE au.id = r.approved_by) AS approved_by_name
  FROM renewals r JOIN policies p ON p.id = r.policy_id
  LEFT JOIN clients cl ON cl.id = COALESCE(r.client_id, p.client_id)
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN users ou ON ou.id = COALESCE(r.owner_user_id, p.owner_user_id)`;

export async function readContext() {
  return {
    todayStr: await today(), labels: (await getSetting('renewals.status_labels', {})) || {},
    grace: Number(await getSetting('renewals.grace_period_days', 30)),
    weights: (await getSetting('renewals.risk_weights', {})) || {}, bands: (await getSetting('renewals.risk_bands', { Low: 0 })) || { Low: 0 },
    stages: (await getSetting('renewals.notice_stages', [])) || [],
  };
}

/** Retention risk score with the contributing factors (weights from renewals.risk_weights). */
export function riskOf(r, ctx, daysToExpiry, variancePct) {
  const w = ctx.weights;
  const factors = [];
  const add = (factor, score, details) => { if (score) factors.push({ factor, score, details }); };
  if (r.claims_count > 0) add('Claims History', w.claims || 0, `${r.claims_count} claim(s) on the expiring term`);
  if (r.unpaid > 0) add('Unpaid Premium', w.unpaid || 0, `Outstanding premium ${r.unpaid}`);
  if (!r.loyalty_years) add('First Renewal', w.firstRenewal || 0, 'Statistically higher lapse rate');
  if (!r.contact_attempts && !r.notice_stage && daysToExpiry <= 30) add('No Contact', w.noContact || 0, 'No notice or contact yet');
  if (variancePct > 10) add('Premium Increase', w.increase || 0, `${variancePct}% increase quoted`);
  if (daysToExpiry <= 15) add('Due Soon', w.dueSoon || 0, `${daysToExpiry} day(s) to expiry`);
  const score = Math.min(100, factors.reduce((s, f) => s + f.score, 0));
  const band = Object.entries(ctx.bands).sort((a, b) => b[1] - a[1]).find(([, min]) => score >= min)?.[0] || 'Low';
  return { score, band, factors };
}

/** API shape: fields read by the client-view renewals tab, the renewal quote wizard and the Renewals workspace. */
export function toApi(r, ctx) {
  const statusLabel = ctx.labels[r.status] || r.status;
  const expiry = r.policy_expiry;
  const daysToExpiry = daysBetween(ctx.todayStr, expiry);
  const isOpen = OPEN.includes(r.status);
  const inGracePeriod = isOpen && daysToExpiry < 0 && -daysToExpiry <= ctx.grace;
  const previous = r.premium_old ?? r.premium_total;
  const renewalPremium = r.premium_new ?? null;
  const variance = renewalPremium == null ? null : round2(renewalPremium - previous);
  const variancePct = renewalPremium == null || !previous ? 0 : round2((variance / previous) * 100);
  const risk = riskOf(r, ctx, daysToExpiry, variancePct);
  const next = isOpen ? ctx.stages.find((s) => s.stage === r.notice_stage + 1) || null : null;
  const paymentStatus = r.unpaid > 0 ? 'Pending' : 'Paid';
  return {
    id: r.id, renewalId: r.id, renewalNumber: r.renewal_number, policyId: r.policy_id, policyRefId: r.policy_id, policyNumber: r.policy_number,
    clientId: r.client_id || r.policy_client_id, clientName: r.client_name, insuredName: r.client_name,
    insuredContact: { mobile: r.client_phone, email: r.client_email, preferredContact: r.client_email ? 'Email' : 'Phone' },
    insurer: r.insurer_name, insuranceCompanyName: r.insurer_name, product: r.product_name, productType: r.product_name, lob: r.product_line,
    status: inGracePeriod ? 'In Grace Period' : statusLabel, renewalStatus: statusLabel, statusCode: r.status, isOpen, inGracePeriod,
    dueDate: r.due_date, expiryDate: expiry, policyExpiry: expiry, policyIssued: r.inception_date, issuedDate: r.inception_date, daysToExpiry,
    currentPremium: previous, renewalPremium, grossPremium: renewalPremium ?? previous, totalPremium: renewalPremium ?? previous,
    premiumVariance: variance, premiumVariancePct: variancePct, sumInsured: r.sum_insured, currency: r.currency,
    noticeStage: r.notice_stage, lastNoticeAt: r.last_notice_at, nextNotice: next,
    renewalAttempts: r.contact_attempts, contactAttempts: r.contact_attempts, lastContactDate: r.last_contact_at,
    assignedAgent: r.agent_name, priority: r.priority || (risk.band === 'Critical' || daysToExpiry <= 7 ? 'High' : 'Normal'),
    retentionRisk: risk.band, riskScore: risk.score,
    claimsHistory: { hasClaimsLastYear: r.claims_count > 0, totalClaims: r.claims_count, claimsAmount: r.claims_amount },
    paymentHistory: r.unpaid > 0 ? 'Outstanding' : 'Good', paymentStatus, payment: paymentStatus, outstandingPremium: r.unpaid,
    loyaltyYears: r.loyalty_years, coverageDetails: r.coverage_details || {}, accessories: r.accessories, orderSummary: r.order_summary,
    policyLimits: r.policy_limits, premiumBreakdown: r.premium_breakdown, effectiveDate: r.effective_date, newExpiryDate: r.expiry_date,
    newPolicyId: r.new_policy_id, submittedBy: r.submitted_by_name, submittedAt: r.submitted_at, approvedBy: r.approved_by_name,
    approvedAt: r.approved_at, approvalNote: r.approval_note, lapseReason: r.lapse_reason, lapsedAt: r.lapsed_at, renewedAt: r.renewed_at,
    remarks: r.remarks, createdAt: r.created_at, updatedAt: r.updated_at,
    policy: {
      id: r.policy_id, policyId: r.policy_id, policyNumber: r.policy_number, clientId: r.client_id || r.policy_client_id,
      insuredName: r.client_name, clientName: r.client_name, insuranceCompanyName: r.insurer_name, productType: r.product_name,
      issuedDate: r.inception_date, inception: r.inception_date, expiry: expiry, grossPremium: r.premium_total, premiumAmount: r.premium_total,
      sumInsured: r.sum_insured, status: r.policy_status, paymentStatus,
    },
  };
}

export async function loadRow(id, db = null) {
  const q = db ? (t, p) => db.query(t, p).then((x) => x.rows[0]) : one;
  const r = await q(`${BASE} WHERE r.id = $1 OR r.renewal_number = $1`, [String(id)]);
  if (!r) throw notFound('Renewal not found');
  return r;
}
export async function getRenewal(id, { withDetail = true } = {}) {
  const ctx = await readContext();
  const r = toApi(await loadRow(id), ctx);
  if (!withDetail) return r;
  r.quotes = (await many('SELECT * FROM renewal_quotes WHERE renewal_id = $1 ORDER BY created_at DESC', [r.id])).map(quoteApi);
  r.notices = await many(`SELECT stage, notice_type AS "noticeType", method, recipient, status, error, sent_by AS "sentBy", sent_at AS "sentAt", batch_id AS "batchId"
    FROM renewal_notices WHERE renewal_id = $1 ORDER BY stage`, [r.id]);
  r.activities = (await many('SELECT * FROM renewal_activities WHERE renewal_id = $1 ORDER BY at, id', [r.id])).map(activityApi);
  return r;
}
export const activityApi = (a) => ({ id: a.id, date: a.at, at: a.at, type: a.activity_type, method: a.method, description: a.description, outcome: a.outcome, nextAction: a.next_action, followUpDate: a.follow_up_date, by: a.by_user, ...(a.details || {}) });

/** List for GET /policy-renewals and the workspace queue: filters clientId, policyId, status, risk, agent, search, from/to, open. */
export async function listRenewals(q, pg) {
  const where = [];
  const params = [];
  const add = (sql, ...vals) => { let s = sql; for (const v of vals) { params.push(v); s = s.replace('?', `$${params.length}`); } where.push(s); };
  if (q.clientId) add('COALESCE(r.client_id, p.client_id) = ?', q.clientId);
  if (q.policyId) add('(r.policy_id = ? OR p.policy_number = ?)', q.policyId, q.policyId);
  if (q.status && q.status !== 'All') {
    const labels = (await getSetting('renewals.status_labels', {})) || {};
    const codes = String(q.status).split(',').map((s) => {
      const t = s.trim();
      return labels[t] ? t : Object.entries(labels).find(([, l]) => String(l).toLowerCase() === t.toLowerCase())?.[0] || t.toLowerCase();
    });
    if (codes.includes('open')) codes.push(...OPEN);
    if (codes.includes('in grace period')) add('r.status = ANY(?) AND p.expiry_date < current_date', OPEN);
    else add('r.status = ANY(?)', codes);
  }
  if (q.openOnly === 'true' || q.open === 'true') add('r.status = ANY(?)', OPEN);
  if (q.agent && q.agent !== 'All') add('(ou.display_name = ? OR ou.id = ?)', q.agent, q.agent);
  if (q.from || q.expiryFrom) add('p.expiry_date >= ?::date', q.from || q.expiryFrom);
  if (q.to || q.expiryTo) add('p.expiry_date <= ?::date', q.to || q.expiryTo);
  if (q.search) add('(p.policy_number ILIKE ? OR cl.display_name ILIKE ? OR r.renewal_number ILIKE ? OR pr.name ILIKE ?)', ...Array(4).fill(`%${q.search}%`));
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'renewal', 'r', params));
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const ctx = await readContext();
  let rows = (await many(`${BASE} ${w} ORDER BY p.expiry_date, r.created_at`, params)).map((r) => toApi(r, ctx));
  if (q.risk && q.risk !== 'All') rows = rows.filter((r) => r.retentionRisk === q.risk);
  return { total: rows.length, items: rows.slice(pg.offset, pg.offset + pg.limit), all: rows };
}

// ---------------------------------------------------------------- creation / capture
export async function resolvePolicy(ref, db = null) {
  const q = db ? (t, p) => db.query(t, p).then((x) => x.rows[0]) : one;
  const p = await q('SELECT * FROM policies WHERE id = $1 OR policy_number = $1', [String(ref)]);
  if (!p) throw notFound(`Policy ${ref} not found`);
  return p;
}

/** Return the open renewal of a policy, creating it (status pipeline) when there is none. */
export async function ensureRenewal(policyRef, user) {
  const policy = await resolvePolicy(policyRef);
  const existing = await one(`SELECT id FROM renewals WHERE policy_id = $1 AND status <> ALL($2) ORDER BY created_at DESC LIMIT 1`, [policy.id, ['renewed', 'lapsed']]);
  if (existing) return { id: existing.id, created: false, policy };
  if (policy.status === 'renewed' || policy.renewed_to) throw conflict(`Policy ${policy.policy_number} has already been renewed`);
  if (policy.status === 'cancelled') throw conflict(`Policy ${policy.policy_number} is cancelled`);
  const number = await nextNumber('renewal', 'numbering.renewal.prefix', 'RN', { table: 'renewals', column: 'renewal_number' });
  try {
    const r = await one(`INSERT INTO renewals(renewal_number, policy_id, client_id, owner_user_id, status, due_date, premium_old, created_by)
      VALUES ($1,$2,$3,$4,'pipeline',$5,$6,$7) RETURNING id`, [number, policy.id, policy.client_id, policy.owner_user_id, policy.expiry_date, policy.premium_total, user?.username ?? null]);
    return { id: r.id, created: true, policy };
  } catch (e) {
    if (e.code === '23505') {
      const again = await one('SELECT id FROM renewals WHERE policy_id = $1 AND status <> ALL($2) LIMIT 1', [policy.id, ['renewed', 'lapsed']]);
      if (again) return { id: again.id, created: false, policy };
    }
    throw e;
  }
}

const CAPTURE = { coverageDetails: 'coverage_details', accessories: 'accessories', orderSummary: 'order_summary', policyLimits: 'policy_limits', premiumBreakdown: 'premium_breakdown' };

/** Save the renewal quote wizard data (coverage, accessories, order summary, dates). */
export async function captureRenewal(id, input) {
  const before = await loadRow(id);
  if (!OPEN.includes(before.status)) throw conflict(`Renewal is ${before.status}; it can no longer be changed`);
  const sets = [];
  const params = [before.id];
  const set = (col, v) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  for (const [k, col] of Object.entries(CAPTURE)) if (input[k] !== undefined) set(col, JSON.stringify(input[k]));
  if (input.effectiveDate) set('effective_date', await toDate(input.effectiveDate));
  if (input.expiryDate) set('expiry_date', await toDate(input.expiryDate));
  if (input.remarks !== undefined) set('remarks', input.remarks);
  if (input.priority) set('priority', input.priority);
  const gross = Number(input.orderSummary?.grossPremium ?? input.premiumBreakdown?.grossPremium ?? input.coverageDetails?.grossPremium);
  if (gross > 0) set('premium_new', round2(gross));
  if (gross > 0 && ['pipeline', ...NOTICE_STATUS, 'approved'].includes(before.status)) set('status', 'quoted');
  if (gross > 0 && before.status === 'approved') { sets.push('approved_by = NULL', 'approved_at = NULL'); }
  if (!sets.length) return { before, after: await getRenewal(before.id) };
  await query(`UPDATE renewals SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
  return { before, after: await getRenewal(before.id) };
}

// ---------------------------------------------------------------- re-rating
export const quoteApi = (q) => ({
  id: q.id, quoteId: q.quote_number, quoteNumber: q.quote_number, renewalId: q.renewal_id, status: q.status, generatedDate: q.created_at, validUntil: q.valid_until,
  basePremium: q.base_premium, previousPremium: q.previous_premium, quotedPremium: q.total_premium, premiumVariance: q.variance, premiumVariancePct: q.variance_pct,
  premiumCalculation: { basePremium: q.base_premium, claimsLoading: q.claims_loading, loyaltyDiscount: -q.loyalty_discount, subtotal: q.net_premium, taxes: q.taxes, totalPremium: q.total_premium },
  rating: q.rating, createdBy: q.created_by,
});

/** Re-rate at current rates: base rate on sum insured, claims loading, loyalty discount, current taxes; returns premium variance. */
export async function rate(r) {
  const line = r.product_line || 'default';
  const rates = (await getSetting('renewals.rating_rates', {})) || {};
  const rateUsed = Number(rates[line] ?? rates.default ?? 0);
  const previous = Number(r.premium_old ?? r.premium_total ?? 0);
  const base = r.sum_insured > 0 && rateUsed > 0 ? round2(r.sum_insured * rateUsed) : previous;
  const loadingPct = Math.min(Number(await getSetting('renewals.claims_loading_cap', 0.3)), r.claims_count * Number(await getSetting('renewals.claims_loading_rate', 0.1)));
  const loyaltyPct = Math.min(Number(await getSetting('renewals.loyalty_discount_cap', 0.1)), r.loyalty_years * Number(await getSetting('renewals.loyalty_discount_rate', 0.02)));
  const claimsLoading = round2(base * loadingPct);
  const loyaltyDiscount = round2(base * loyaltyPct);
  const net = round2(base + claimsLoading - loyaltyDiscount);
  const taxRates = { vat: Number(await getSetting('tax.vat_rate', 0)), dst: Number(await getSetting('tax.dst_rate', 0)), lgt: Number(await getSetting('tax.lgt_rate', 0)), fst: line === 'fire' ? Number(await getSetting('tax.fst_rate', 0)) : 0 };
  const taxes = Object.fromEntries(Object.entries(taxRates).map(([k, v]) => [k, round2(net * v)]));
  const total = round2(net + Object.values(taxes).reduce((s, v) => s + v, 0));
  const variance = round2(total - previous);
  return {
    base, claimsLoading, loyaltyDiscount, net, taxes, total, previous, variance, variancePct: previous ? round2((variance / previous) * 100) : 0,
    rating: { line, rate: rateUsed, sumInsured: r.sum_insured, claims: r.claims_count, loadingPct, loyaltyYears: r.loyalty_years, loyaltyPct, taxRates, ratedAt: new Date().toISOString() },
  };
}

export async function generateQuote(id, user) {
  const r = await loadRow(id);
  if (!['pipeline', ...NOTICE_STATUS, 'quoted', 'approved'].includes(r.status)) throw conflict(`Renewal is ${r.status}; a quote cannot be generated`);
  const q = await rate(r);
  const number = await nextNumber('renewal_quote', 'numbering.renewal_quote.prefix', 'RQ', { table: 'renewal_quotes', column: 'quote_number' });
  const validUntil = addDays(await today(), Number(await getSetting('renewals.quote_validity_days', 30)));
  const row = await withTransaction(async (db) => {
    await db.query('UPDATE renewal_quotes SET status = \'superseded\' WHERE renewal_id = $1 AND status = \'generated\'', [r.id]);
    const ins = await db.query(`INSERT INTO renewal_quotes(quote_number, renewal_id, valid_until, previous_premium, base_premium, claims_loading, loyalty_discount,
      net_premium, taxes, total_premium, variance, variance_pct, rating, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [number, r.id, validUntil, q.previous, q.base, q.claimsLoading, q.loyaltyDiscount, q.net, JSON.stringify(q.taxes), q.total, q.variance, q.variancePct, JSON.stringify(q.rating), user?.username ?? null]);
    await db.query(`UPDATE renewals SET premium_new = $2, premium_old = COALESCE(premium_old, $3), status = 'quoted', approved_by = NULL, approved_at = NULL,
      premium_breakdown = $4, updated_at = now() WHERE id = $1`, [r.id, q.total, q.previous, JSON.stringify({ netPremium: q.net, ...q.taxes, grossPremium: q.total })]);
    await activity(db, r.id, user, { type: 'Quote Generated', description: `Renewal quote ${number}: ${q.total} (${q.variancePct >= 0 ? '+' : ''}${q.variancePct}%)` });
    return ins.rows[0];
  });
  return { before: r, quote: { ...quoteApi(row), policyNumber: r.policy_number, insuredName: r.client_name, product: r.product_name } };
}

// ---------------------------------------------------------------- notices, reminders, activities
export async function activity(db, renewalId, user, { type, method = null, description = null, outcome = null, nextAction = null, followUpDate = null, details = {} }) {
  const exec = db ? db.query.bind(db) : query;
  const r = await exec(`INSERT INTO renewal_activities(renewal_id, by_user, activity_type, method, description, outcome, next_action, follow_up_date, details)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [renewalId, user?.username ?? null, type, method, description, outcome, nextAction, followUpDate, JSON.stringify(details)]);
  return r.rows[0];
}

async function noticeVars(r, noticeLabel) {
  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    noticeLabel, clientName: r.client_name || 'Valued Client', policyNumber: r.policy_number, insurerName: r.insurer_name || '', expiryDate: r.policy_expiry,
    currency: r.currency || await getSetting('currency.default', 'PHP'), premium: fmt(r.premium_new ?? r.premium_old ?? r.premium_total),
    companyName: await getSetting('general.company_name', 'BrokerVerse'),
  };
}

/** Send the next renewal notice (first, second, final in order). Throws 409/422 when out of order or undeliverable. */
export async function sendNotice(id, user, { stage, method = 'Email', batchId = null } = {}) {
  const r = await loadRow(id);
  if (!OPEN.includes(r.status)) throw conflict(`Renewal is ${r.status}; notices can no longer be sent`);
  const stages = (await getSetting('renewals.notice_stages', [])) || [];
  const next = r.notice_stage + 1;
  const target = stages.find((s) => s.stage === (stage ? Number(stage) : next));
  if (!target) throw conflict(r.notice_stage >= stages.length ? 'All renewal notices have already been sent' : `Unknown notice stage ${stage}`);
  if (target.stage < next) throw conflict(`${target.label} has already been sent`);
  if (target.stage > next && await getSetting('renewals.enforce_notice_order', true)) {
    throw conflict(`${stages.find((s) => s.stage === next)?.label || 'The previous notice'} must be sent before the ${target.label}`);
  }
  if (method === 'Email' && !r.client_email) throw unprocessable(`Client ${r.client_name || ''} has no e-mail address`.trim());
  const vars = await noticeVars(r, target.label);
  let emailId = null;
  if (method === 'Email') {
    emailId = await queueEmail({
      to: r.client_email, subject: renderTemplate(await getSetting('renewals.notice_subject', '{{noticeLabel}}: {{policyNumber}}'), vars, { html: false }),
      html: renderTemplate(await getSetting('renewals.notice_template', '<p>{{policyNumber}}</p>'), vars), template: `renewal-notice-${target.code}`, entity: 'renewal', entityId: r.id,
    });
  }
  await withTransaction(async (db) => {
    const statusTo = NOTICE_STATUS.includes(r.status) || r.status === 'pipeline' ? NOTICE_STATUS[Math.min(target.stage, 3) - 1] : r.status;
    const u = await db.query(`UPDATE renewals SET notice_stage = $2, last_notice_at = now(), status = $4, updated_at = now() WHERE id = $1 AND notice_stage = $3`, [r.id, target.stage, r.notice_stage, statusTo]);
    if (!u.rowCount) throw conflict('The renewal was updated by someone else; reload and try again');
    await db.query(`INSERT INTO renewal_notices(renewal_id, stage, notice_type, method, recipient, email_id, batch_id, sent_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [r.id, target.stage, target.code, method, method === 'Email' ? r.client_email : r.client_phone, emailId, batchId, user?.username ?? null]);
    await activity(db, r.id, user, { type: target.label, method, description: `${target.label} sent${method === 'Email' ? ` to ${r.client_email}` : ''}` });
  });
  if (r.policy_owner) await notify({ userId: r.policy_owner, type: 'reminder', title: `${target.label}: ${r.policy_number}`, message: `${target.label} sent for policy ${r.policy_number} expiring ${r.policy_expiry}`, link: '/renewal/queue', entity: 'renewal', entityId: r.id });
  return { before: r, notice: { stage: target.stage, noticeType: target.code, label: target.label, method, emailId }, renewal: await getRenewal(r.id) };
}

/** Log a reminder / contact attempt (Email reminders are queued as e-mails). */
export async function sendReminder(id, user, { method = 'Email', note }) {
  const r = await loadRow(id);
  if (!OPEN.includes(r.status)) throw conflict(`Renewal is ${r.status}`);
  if (method === 'Email') {
    if (!r.client_email) throw unprocessable('Client has no e-mail address');
    const vars = await noticeVars(r, 'Renewal Reminder');
    await queueEmail({ to: r.client_email, subject: renderTemplate(await getSetting('renewals.notice_subject', '{{noticeLabel}}'), vars, { html: false }), html: renderTemplate(await getSetting('renewals.notice_template', ''), vars), template: 'renewal-reminder', entity: 'renewal', entityId: r.id });
  }
  await withTransaction(async (db) => {
    await db.query('UPDATE renewals SET contact_attempts = contact_attempts + 1, last_contact_at = now(), updated_at = now() WHERE id = $1', [r.id]);
    await activity(db, r.id, user, { type: 'Reminder', method, description: note || `Renewal reminder via ${method}` });
  });
  return { before: r, renewal: await getRenewal(r.id) };
}

export async function addActivity(id, user, input) {
  const r = await loadRow(id);
  const a = await withTransaction(async (db) => {
    await db.query('UPDATE renewals SET contact_attempts = contact_attempts + 1, last_contact_at = now(), updated_at = now() WHERE id = $1', [r.id]);
    return activity(db, r.id, user, { type: input.type, method: input.method, description: input.description, outcome: input.outcome, nextAction: input.nextAction, followUpDate: input.followUpDate ? await toDate(input.followUpDate) : null, details: input.details || {} });
  });
  return activityApi(a);
}

// ---------------------------------------------------------------- approval, completion, lapse
export async function submitForApproval(id, user, note) {
  const r = await loadRow(id);
  if (r.status !== 'quoted') throw conflict(`Only a quoted renewal can be submitted for approval (current: ${r.status})`);
  if (r.premium_new == null) throw unprocessable('Generate or capture the renewal premium first');
  await query(`UPDATE renewals SET status = 'pending-approval', submitted_by = $2, submitted_at = now(), approval_note = $3, updated_at = now() WHERE id = $1`, [r.id, user.id, note || null]);
  await activity(null, r.id, user, { type: 'Submitted for Approval', description: note || `Renewal premium ${r.premium_new} submitted for approval` });
  const roles = (await getSetting('renewals.approver_roles', ['underwriting'])) || [];
  const approvers = new Set();
  for (const role of roles) for (const u of await usersWithRole(role)) if (u.id !== user.id) approvers.add(u.id);
  for (const a of approvers) await notify({ userId: a, type: 'approval', title: `Renewal approval: ${r.policy_number}`, message: `Renewal ${r.renewal_number} (${r.premium_new}) awaits approval`, link: '/renewal/negotiations', entity: 'renewal', entityId: r.id });
  return { before: r, renewal: await getRenewal(r.id) };
}

/** Checker decision; the approver must differ from the submitter (maker-checker). */
export async function decide(id, user, { decision, note }) {
  const r = await loadRow(id);
  if (r.status !== 'pending-approval') throw conflict('Renewal is not awaiting approval');
  if (r.submitted_by === user.id) throw forbidden('Maker-checker: the renewal must be approved by a different user');
  const approve = decision === 'approve';
  await query(`UPDATE renewals SET status = $2, approved_by = $3, approved_at = CASE WHEN $4 THEN now() END, approval_note = $5, updated_at = now() WHERE id = $1`,
    [r.id, approve ? 'approved' : 'quoted', approve ? user.id : null, approve, note || null]);
  await activity(null, r.id, user, { type: approve ? 'Approved' : 'Returned', description: note || (approve ? 'Renewal terms approved' : 'Renewal terms returned for revision') });
  const target = r.submitted_by || r.policy_owner;
  if (target) await notify({ userId: target, type: 'info', title: `Renewal ${approve ? 'approved' : 'returned'}: ${r.policy_number}`, message: note || `Renewal ${r.renewal_number} was ${approve ? 'approved' : 'returned'}`, link: '/renewal/queue', entity: 'renewal', entityId: r.id });
  return { before: r, renewal: await getRenewal(r.id) };
}

/** Complete the renewal: new policy term created, old term marked renewed, optional premium receivable. */
export async function completeRenewal(id, user, input = {}) {
  const r = await loadRow(id);
  const makerChecker = await getSetting('renewals.maker_checker', true);
  const allowed = makerChecker ? ['approved'] : ['quoted', 'approved'];
  if (!allowed.includes(r.status)) throw conflict(makerChecker ? `Renewal must be approved before it is completed (current: ${r.status})` : `Renewal must be quoted before it is completed (current: ${r.status})`);
  const premium = round2(input.premium ?? r.premium_new ?? r.premium_old ?? r.premium_total);
  const inception = (await toDate(input.inceptionDate)) || r.effective_date || addDays(r.policy_expiry, 1);
  const expiry = (await toDate(input.expiryDate)) || r.expiry_date || addDays(addYears(inception, 1), -1);
  if (expiry <= inception) throw badRequest('expiryDate must be after inceptionDate');
  const policyNumber = input.policyNumber || await nextNumber('policy', 'numbering.policy.prefix', 'POL', { table: 'policies', column: 'policy_number' });
  const commission = r.premium_total > 0 ? round2((r.commission_amount / r.premium_total) * premium) : 0;
  const result = await withTransaction(async (db) => {
    const lock = await db.query('SELECT status FROM renewals WHERE id = $1 FOR UPDATE', [r.id]);
    if (lock.rows[0].status !== r.status) throw conflict('The renewal was updated by someone else; reload and try again');
    const np = await db.query(`INSERT INTO policies(policy_number, client_id, product_id, policy_type_id, insurance_company_id, owner_user_id, status,
        inception_date, expiry_date, sum_insured, premium_total, commission_amount, currency, details, renewed_from, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id, policy_number`, [
      policyNumber, r.policy_client_id, r.product_id, r.policy_type_id, r.insurance_company_id, r.policy_owner, inception, expiry, r.sum_insured, premium, commission,
      r.currency, JSON.stringify({ ...(r.policy_details || {}), businessType: 'Renewal', renewal: { renewalId: r.id, renewalNumber: r.renewal_number, previousPolicyId: r.policy_id, previousPolicyNumber: r.policy_number }, coverageDetails: r.coverage_details || undefined }),
      r.policy_id, user?.username ?? null]);
    const newPolicy = np.rows[0];
    await db.query('UPDATE policies SET status = \'renewed\', renewed_to = $2, updated_at = now() WHERE id = $1', [r.policy_id, newPolicy.id]);
    await db.query(`UPDATE renewals SET status = 'renewed', new_policy_id = $2, premium_new = $3, renewed_at = now(), updated_at = now() WHERE id = $1`, [r.id, newPolicy.id, premium]);
    await db.query('UPDATE renewal_quotes SET status = \'accepted\' WHERE renewal_id = $1 AND status = \'generated\'', [r.id]);
    await activity(db, r.id, user, { type: 'Renewed', description: `Renewed as policy ${newPolicy.policy_number} (${inception} to ${expiry})` });
    return newPolicy;
  });
  let receivableId = null;
  if (await getSetting('renewals.create_receivable', true) && premium > 0) {
    const { createReceivable } = await import('../policies/service.js');
    const rcv = await createReceivable(pool, { policyId: result.id, amount: premium, source: 'renewal', reference: r.renewal_number || null, user });
    receivableId = rcv.id;
    await query('UPDATE policies SET bill_number = $2 WHERE id = $1', [result.id, rcv.bill_number]);
  }
  if (r.policy_owner) await notify({ userId: r.policy_owner, type: 'info', title: `Policy renewed: ${r.policy_number}`, message: `New term ${result.policy_number} from ${inception} to ${expiry}`, link: `/agent/policydetail/${result.id}`, entity: 'policy', entityId: result.id });
  return { before: r, newPolicy: { id: result.id, policyNumber: result.policy_number, inceptionDate: inception, expiryDate: expiry, premium, receivableId }, renewal: await getRenewal(r.id) };
}

export async function lapseRenewal(id, user, reason) {
  const r = await loadRow(id);
  if (!OPEN.includes(r.status)) throw conflict(`Renewal is ${r.status}; it cannot be lapsed`);
  await query(`UPDATE renewals SET status = 'lapsed', lapse_reason = $2, lapsed_at = now(), updated_at = now() WHERE id = $1`, [r.id, reason]);
  await query('UPDATE policies SET status = \'expired\', updated_at = now() WHERE id = $1 AND expiry_date < current_date AND status IN (\'active\', \'issued\')', [r.policy_id]);
  await activity(null, r.id, user, { type: 'Lapsed', description: reason });
  if (r.policy_owner) await notify({ userId: r.policy_owner, type: 'alert', title: `Policy lapsed: ${r.policy_number}`, message: reason, link: '/renewal/lapse-management', entity: 'renewal', entityId: r.id });
  return { before: r, renewal: await getRenewal(r.id) };
}

export async function reinstateRenewal(id, user, note) {
  const r = await loadRow(id);
  if (r.status !== 'lapsed') throw conflict('Only a lapsed renewal can be reinstated');
  const days = Number(await getSetting('renewals.reinstatement_days', 90));
  if (r.lapsed_at && (Date.now() - new Date(r.lapsed_at).getTime()) / 86400000 > days) throw unprocessable(`Reinstatement window of ${days} days has passed`);
  try {
    await query(`UPDATE renewals SET status = CASE WHEN premium_new IS NULL THEN 'pipeline' ELSE 'quoted' END, lapse_reason = NULL, lapsed_at = NULL, updated_at = now() WHERE id = $1`, [r.id]);
  } catch (e) {
    if (e.code === '23505') throw conflict('The policy already has an open renewal');
    throw e;
  }
  await activity(null, r.id, user, { type: 'Reinstated', description: note || 'Renewal reinstated' });
  return { before: r, renewal: await getRenewal(r.id) };
}

// ---------------------------------------------------------------- scheduled pipeline
/** Put policies expiring within renewals.pipeline_days into the pipeline and lapse open renewals past the grace period. */
export async function refreshPipeline(user = null) {
  const days = Number(await getSetting('renewals.pipeline_days', 90));
  const grace = Number(await getSetting('renewals.grace_period_days', 30));
  const due = await many(`SELECT p.id FROM policies p WHERE p.status IN ('active', 'issued') AND p.renewed_to IS NULL
    AND p.expiry_date BETWEEN current_date - $2::int AND current_date + $1::int
    AND NOT EXISTS (SELECT 1 FROM renewals r WHERE r.policy_id = p.id) ORDER BY p.expiry_date`, [days, grace]);
  let created = 0;
  for (const p of due) { if ((await ensureRenewal(p.id, user)).created) created += 1; }
  const stale = await many(`SELECT r.id FROM renewals r JOIN policies p ON p.id = r.policy_id WHERE r.status = ANY($1) AND p.expiry_date < current_date - $2::int`, [OPEN, grace]);
  for (const s of stale) await lapseRenewal(s.id, user, `Not renewed within the ${grace}-day grace period`);
  return { created, lapsed: stale.length };
}

// ---------------------------------------------------------------- renewal quote wizard (coverage -> accessories -> order summary)
/** Coverage fields of the motor quote wizard (camelCase, as stored in the quotation document). */
export const COVERAGE_KEYS = ['lossAndDamageCoverage', 'lossAndDamageCoverageRate', 'lossAndDamageCoveragePremium', 'actsOfNatureRate', 'actsOfNaturePremium',
  'ctplCoverageRate', 'roadsideAssistanceRate', 'roadsideAssistancePremium', 'personalAccidentCoverRate', 'personalAccidentCoverPremium', 'bodilyInjury',
  'bodilyInjuryCoveragePremium', 'propertyDamage', 'propertyDamageCoveragePremium', 'autoPassengerPersonalAccident', 'APPAtotalCoverage', 'APPAcoveragePremium',
  'totalSumInsured'];
export const ACCESSORY_KEYS = ['aircon', 'stereo', 'magWheels', 'others', 'deductible', 'towing', 'repairLimit'];
/** Risk / vehicle fields carried from the expiring term into the renewal quotation. */
const CARRY_KEYS = ['insuranceVehicleDetails', 'plateNumber', 'chassisNumber', 'motorNumber', 'mvFileNumber', 'certNumber', 'authenCode', 'vehicleType',
  'vehicleBrand', 'modelYear', 'vehicleModel', 'modelVariant', 'vehicleColor', 'seatingCapacity', 'mortgage', 'truckType', 'aluminum', 'airBag', 'TNVS',
  'idCard', 'idCardNumber', 'insurancePolicyType', 'accountCode', 'paymentType', 'installmentType', 'isCoInsurance', 'participantDetails', 'authorizedSignature',
  'fireRiskDetails', 'firePremiumDetails'];
const present = (v) => v !== undefined && v !== null && v !== '';
const pickPresent = (src, keys) => Object.fromEntries(keys.filter((k) => present(src?.[k])).map((k) => [k, src[k]]));
const hasReferrers = (d) => Boolean(d && [d.primary, ...(d.chain || [])].some((e) => e && e.referrerId && e.referrerId !== 'direct'));

async function expiringPolicy(ref) {
  const p = await one(`SELECT p.*, c.client_code, c.display_name AS client_name, c.email AS client_email, ic.name AS insurer_name, pr.name AS product_name,
      pr.line AS product_line, q.doc AS quote_doc
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN quotes q ON q.id = p.quote_id WHERE p.id = $1 OR p.policy_number = $1`, [String(ref)]);
  if (!p) throw notFound(`Policy ${ref} not found`);
  return p;
}

/**
 * Prefill of the renewal wizard for a policy. Values come only from this renewal's saved wizard data, the expiring
 * policy's own quotation / policy document, or the policy row (sum insured, insurer, product, client) when the policy
 * has no quotation (seeded or imported policies). Nothing is defaulted: absent accessories stay blank.
 */
export async function renewalPrefill(policyRef) {
  const p = await expiringPolicy(policyRef);
  const open = await one('SELECT * FROM renewals WHERE policy_id = $1 AND status <> ALL($2) ORDER BY created_at DESC LIMIT 1', [p.id, ['renewed', 'lapsed']]);
  const source = { ...(p.quote_doc || {}), ...(p.doc || {}) };
  const details = p.details || {};
  const coverage = { ...pickPresent(details.coverageDetails, COVERAGE_KEYS), ...pickPresent(source, COVERAGE_KEYS) };
  let from = p.quote_id ? 'quotation' : 'policy';
  if (!present(coverage.lossAndDamageCoverage) && Number(p.sum_insured) > 0) coverage.lossAndDamageCoverage = Number(p.sum_insured);
  if (!present(coverage.totalSumInsured) && Number(p.sum_insured) > 0) coverage.totalSumInsured = Number(p.sum_insured);
  const captured = pickPresent(open?.coverage_details, COVERAGE_KEYS);
  if (Object.keys(captured).length) from = 'renewal';
  // Accessories saved on this renewal (even when cleared) win over the expiring term's own values.
  const capturedObject = open?.accessories && typeof open.accessories === 'object' && !Array.isArray(open.accessories);
  const accessorySource = capturedObject ? open.accessories : source;
  const accessories = Object.fromEntries(ACCESSORY_KEYS.map((k) => [k, present(accessorySource[k]) ? accessorySource[k] : '']));
  return {
    policyId: p.id, policyNumber: p.policy_number, status: p.status, clientId: p.client_id, clientCode: p.client_code, clientName: p.client_name || p.insured_name,
    clientEmail: p.client_email, leadId: p.lead_id, quoteId: p.quote_id, insuranceCompanyId: p.insurance_company_id, insuranceCompanyName: p.insurer_name,
    productId: p.product_id, productType: p.product_type || source.productType || p.product_name, lob: p.lob || (p.product_line ? p.product_line.toUpperCase() : null),
    sumInsured: Number(p.sum_insured), netPremium: Number(p.net_premium), grossPremium: Number(p.premium_total), inceptionDate: p.inception_date, expiryDate: p.expiry_date,
    renewal: open ? { id: open.id, renewalNumber: open.renewal_number, status: open.status } : null,
    coverageDetails: { ...coverage, ...captured }, accessories, vehicle: pickPresent(source, CARRY_KEYS),
    orderSummary: open?.order_summary || null, commissionDetails: details.commissionDetails || source.commissionDetails || null, source: from,
  };
}

/**
 * Renewal wizard "Completed Quote": save the wizard data on the policy's open renewal and create (or update) the renewal
 * quotation linked to it. The quotation carries the client, lead, insurer, product, vehicle and the link to the expiring
 * policy (doc.renewal), follows the normal quotation workflow (customer approval link, convert to policy) and, when
 * converted, becomes the new policy term (quotations/service.js#convertToPolicy).
 */
export async function createRenewalQuote(policyRef, input, user) {
  const { createQuote, updateQuote, getQuoteRow } = await import('../quotations/service.js');
  const policy = await resolvePolicy(policyRef);
  const { id: renewalId } = await ensureRenewal(policy.id, user);
  const capture = {};
  for (const k of ['coverageDetails', 'accessories', 'orderSummary', 'effectiveDate', 'expiryDate', 'remarks']) if (input[k] !== undefined) capture[k] = input[k];
  if (Object.keys(capture).length) await captureRenewal(renewalId, capture);
  const pre = await renewalPrefill(policy.id);
  const r = await loadRow(renewalId);
  const order = input.orderSummary || {};
  const commissionDetails = hasReferrers(order.commissionDetails) ? order.commissionDetails : (pre.commissionDetails || order.commissionDetails || null);
  const vehicle = pre.vehicle;
  const body = {
    ...vehicle,
    ...pre.coverageDetails,
    ...pre.accessories,
    participantDetails: vehicle.participantDetails?.length ? vehicle.participantDetails : (pre.insuranceCompanyName ? [{ insuranceCompanyName: pre.insuranceCompanyName, sharePercentage: 100 }] : []),
    ...pickPresent(order, ['discount', 'accountPremiumOthers', 'NCD', 'authorizedSignature']),
    commissionDetails,
    productType: pre.productType || 'Motor', insuranceCompanyId: pre.insuranceCompanyId, insuranceCompanyName: pre.insuranceCompanyName,
    clientId: pre.clientId, businessType: 'Renewal', isRenewal: true, renewedFromPolicyId: policy.id, renewedFromPolicyNumber: policy.policy_number,
    renewal: { renewalId: r.id, renewalNumber: r.renewal_number, policyId: policy.id, policyNumber: policy.policy_number, previousExpiryDate: policy.expiry_date },
    remarks: input.remarks || `Renewal of policy ${policy.policy_number}`,
  };
  if (pre.leadId) body.leadRefId = pre.leadId;
  const existing = await one(`SELECT id, status FROM quotes WHERE doc->'renewal'->>'renewalId' = $1 AND deleted_at IS NULL AND status IN ('draft', 'sent')
    ORDER BY created_at DESC LIMIT 1`, [r.id]);
  let quoteId;
  if (existing) {
    await updateQuote(existing.id, body, user?.id ?? null);
    // A changed quotation needs a fresh customer approval: the link already sent stops working.
    if (existing.status === 'sent') await query("UPDATE quotes SET status = 'draft', approval_token_hash = NULL WHERE id = $1", [existing.id]);
    quoteId = existing.id;
  } else {
    quoteId = (await createQuote(body, user?.id ?? null)).id;
  }
  const vehicleCol = { ...(vehicle.insuranceVehicleDetails?.[0] || {}), ...pickPresent(vehicle, ['plateNumber', 'chassisNumber', 'motorNumber', 'mvFileNumber']) };
  await query(`UPDATE quotes SET client_id = $2, lead_id = COALESCE(lead_id, $3), product_id = COALESCE($4, product_id), policy_type_id = COALESCE($5, policy_type_id),
      insurance_company_id = COALESCE(insurance_company_id, $6), vehicle = $7, coverage = $8, updated_at = now() WHERE id = $1`,
  [quoteId, policy.client_id, policy.lead_id, policy.product_id, policy.policy_type_id, policy.insurance_company_id, JSON.stringify(vehicleCol), JSON.stringify(pre.coverageDetails)]);
  const q = await getQuoteRow(quoteId);
  await query(`UPDATE renewals SET premium_new = $2, status = CASE WHEN status = ANY($3) THEN 'quoted' ELSE status END, premium_breakdown = $4, updated_at = now() WHERE id = $1`,
    [r.id, Number(q.premium_total), ['pipeline', ...NOTICE_STATUS, 'approved'], JSON.stringify({ netPremium: Number(q.premium_base), vat: Number(q.vat), dst: Number(q.dst),
      lgt: Number(q.lgt), grossPremium: Number(q.premium_total), quoteId: q.id, quoteNumber: q.quote_number })]);
  await activity(null, r.id, user, { type: 'Quote Generated', description: `Renewal quotation ${q.quote_number}: ${q.premium_total}`, details: { quoteId: q.id, quoteNumber: q.quote_number } });
  return { created: !existing, quoteRow: q, renewal: await getRenewal(r.id) };
}
