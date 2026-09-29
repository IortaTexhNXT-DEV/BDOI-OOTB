import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest, forbidden, conflict } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney } from '../../lib/money.js';
import { queueEmail } from '../../lib/mailer.js';
import { notify } from '../notifications/router.js';
import { lobOf, renderTemplate, emailTemplate, usersWithRoles, num, round2 } from '../documents/common.js';
import { quoteStatusIn, quoteStatusOut } from '../documents/statuses.js';
import { pick } from '../documents/tabular.js';
import { clientFromLead } from '../clients/service.js';
import { issuePolicy, insurerId, getPolicyRow, updatePolicy } from '../policies/service.js';
import { assertKyc } from '../policies/kyc.js';
import { createLead } from '../leads/service.js';
import { premiumBreakdown } from './premium.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { toQuote, stripReserved, QUOTE_SELECT } from './shape.js';
import { addDays, today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';

export async function getQuoteRow(id, db = null) {
  const r = await (db || { query }).query(`${QUOTE_SELECT} WHERE (q.id = $1 OR q.quote_number = $1) AND q.deleted_at IS NULL`, [id]);
  if (!r.rows[0]) throw notFound('Quotation not found');
  return r.rows[0];
}

/** Insurer named in the quote document (id, participant / company name). */
const insurerRef = (doc) => doc.insuranceCompanyId || doc.insuranceCompanyName || doc.participantDetails?.[0]?.insuranceCompanyName || doc.InsuranceCompanyName;

/** The quote document with the motor covers the server priced (CTPL tariff, Auto Passenger PA per seat). */
const withServerCovers = (doc, b) => (b.lob !== 'MOTOR' ? doc : {
  ...doc, vehicleType: b.vehicleType, ctplCoverageRate: b.ctplCoverageRate, ctplCoveragePremium: b.ctplCoveragePremium, ctplTermYears: b.ctplTermYears,
  appaSeats: b.appaSeats, APPAtotalCoverage: b.APPAtotalCoverage, APPAcoveragePremium: b.APPAcoveragePremium,
});

/** Premium columns from a breakdown. */
const premiumCols = (b) => ({
  sum_insured: b.totalSumInsured, premium_base: b.netPremium, vat: b.valueAddedTax, dst: b.documentaryStampTax, lgt: b.localGovernmentTax,
  fst: b.fireServiceTax, others: b.accountPremiumOthers, discount: b.discount, ncd: b.NCD, premium_total: b.grossPremium,
  commission_rate: b.commissionRate, commission_amount: b.commissionAmount, currency: b.currency,
});

export async function createQuote(body, userId, db = null) {
  const doc = stripReserved(body);
  const leadId = body.leadRefId || body.leadId || null;
  const run = async (c) => {
    if (leadId && !(await c.query('SELECT 1 FROM leads WHERE id = $1 AND deleted_at IS NULL', [leadId])).rows[0]) throw badRequest(`Lead ${leadId} not found`);
    if (!leadId && !body.clientId) throw badRequest('leadRefId (or clientId) is required');
    const icId = await insurerId(c, insurerRef(doc));
    const b = await premiumBreakdown(doc, { insurerId: icId });
    const number = await nextDocumentNumber('quote', { db: c, unique: { table: 'quotes', column: 'quote_number' } });
    const validity = Number(await getSetting('limits.quote_validity_days', 30));
    const status = 'draft';
    const data = { quote_number: number, lead_id: leadId, client_id: body.clientId || null, insurance_company_id: icId, status,
      product_type: body.productType || (b.lob === 'MOTOR' ? 'Motor' : body.productType), lob: b.lob, agent_user_id: userId, created_by: userId,
      valid_until: addDays(await today(), validity), remarks: body.remarks || null,
      doc: JSON.stringify({ ...withServerCovers(doc, b), premiumBreakdown: b }), ...premiumCols(b) };
    const keys = Object.keys(data);
    const r = await c.query(`INSERT INTO quotes(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data));
    if (leadId) await c.query("UPDATE leads SET status = 'QuoteGenerated', updated_at = now() WHERE id = $1 AND status IN ('New','Contacted','Qualified')", [leadId]);
    return r.rows[0].id;
  };
  const id = db ? await run(db) : await withTransaction(run);
  return getQuoteRow(id, db);
}

export async function updateQuote(id, body, userId) {
  const before = await getQuoteRow(id);
  const locked = await getSetting('quotations.locked_statuses', ['ConvertedToPolicy']);
  if (locked.includes(quoteStatusOut(before.status))) throw badRequest(`A ${quoteStatusOut(before.status)} quotation cannot be edited`);
  const doc = { ...(before.doc || {}), ...stripReserved(body) };
  delete doc.premiumBreakdown;
  const icId = await insurerId(null, insurerRef(doc)) || before.insurance_company_id;
  const b = await premiumBreakdown(doc, { insurerId: icId });
  const data = { ...premiumCols(b), insurance_company_id: icId, lob: b.lob, product_type: body.productType || before.product_type,
    doc: JSON.stringify({ ...withServerCovers(doc, b), premiumBreakdown: b }), updated_by: userId, updated_at: new Date() };
  if (body.leadRefId && body.leadRefId !== before.lead_id) data.lead_id = body.leadRefId;
  const keys = Object.keys(data);
  await query(`UPDATE quotes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before, after: await getQuoteRow(before.id) };
}

/** Drafts are removed; rejected / dropped quotations are soft-deleted. */
export async function deleteQuote(id, userId) {
  const q = await getQuoteRow(id);
  const deletable = await getSetting('quotations.deletable_statuses', ['Draft', 'Rejected', 'Dropped']);
  if (!deletable.includes(quoteStatusOut(q.status))) throw badRequest(`A ${quoteStatusOut(q.status)} quotation cannot be deleted`);
  if (q.status === 'draft') await query('DELETE FROM quotes WHERE id = $1', [q.id]);
  else await query('UPDATE quotes SET deleted_at = now(), updated_by = $2 WHERE id = $1', [q.id, userId]);
  return q;
}

/** Status change following quotations.transitions (API labels). Approval is maker-checker when enabled. */
export async function changeStatus(id, label, user) {
  const q = await getQuoteRow(id);
  const target = quoteStatusIn(label);
  if (!target) throw badRequest(`Unknown quotation status ${label}`);
  const from = quoteStatusOut(q.status);
  const to = quoteStatusOut(target);
  const transitions = await getSetting('quotations.transitions', {});
  if (!(transitions[from] || []).includes(to)) throw badRequest(`Cannot change a ${from} quotation to ${to}`);
  if (to === 'Approved' && await getSetting('workflow.quote_maker_checker', true) && q.created_by === user.id) {
    throw forbidden('Maker-checker: the approver must be different from the user who created the quotation');
  }
  const stamps = { approved: ', approved_by = $3, approved_at = now()', accepted: ', customer_accepted_at = now()', submitted: ', submitted_to_insurer_at = now(), submitted_by = $3' };
  await query(`UPDATE quotes SET status = $2, updated_by = $3, updated_at = now()${stamps[target] || ''} WHERE id = $1`, [q.id, target, user.id]);
  if (to === 'Approved') {
    const owner = q.created_by;
    if (owner) await notify({ userId: owner, type: 'info', title: 'Quotation approved', message: `Quotation ${q.quote_number} was approved and can be converted to a policy`, link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
  }
  return { before: q, after: await getQuoteRow(q.id) };
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const vars = async (q, extra = {}) => ({
  companyName: ((await getSetting('general.company_name')) ?? ''), quotationNumber: q.quote_number,
  customerName: [q.lead_row?.first_name, q.lead_row?.last_name].filter(Boolean).join(' ') || q.lead_row?.company_name || 'Customer',
  productType: q.product_type || q.lob, grossPremium: Number(q.premium_total).toLocaleString('en-US', { minimumFractionDigits: 2 }),
  currency: q.currency, validUntil: q.valid_until, insurerName: q.insurer_name || '', ...extra,
});

/**
 * Signed approval token. The public page decodes the payload with atob(), which rejects the base64url characters
 * "-" and "_", so a nonce is chosen that keeps the encoded payload within the plain base64 alphabet.
 */
function approvalToken(quoteId, hours) {
  const iat = Math.floor(Date.now() / 1000);
  const base = crypto.randomInt(1e9);
  for (let n = base; n < base + 100000; n += 1) {
    const payload = { sub: quoteId, typ: 'quote-approval', n, iat, exp: iat + hours * 3600 };
    if (!/[-_]/.test(Buffer.from(JSON.stringify(payload)).toString('base64url'))) return jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' });
  }
  throw new Error('Could not generate an approval token');
}

/** Draft -> PendingCustomer: e-mail the customer a signed approval link and notify underwriting. */
export async function sendForApproval(id, user) {
  const q = await getQuoteRow(id);
  if (!['draft', 'sent'].includes(q.status)) throw badRequest(`Only Draft quotations can be sent for approval (current: ${quoteStatusOut(q.status)})`);
  // Quotations without a lead (e.g. renewals of imported policies) go to the client's address.
  const client = q.client_id ? await one('SELECT display_name, email FROM clients WHERE id = $1', [q.client_id]) : null;
  const to = q.lead_row?.email || client?.email;
  if (!to) throw badRequest(q.lead_row ? 'The lead has no e-mail address; add one before sending the quotation' : 'The client has no e-mail address; add one before sending the quotation');
  const hours = Number(await getSetting('quotations.approval_link_ttl_hours', 168));
  const token = approvalToken(q.id, hours);
  const url = `${String((await getSetting('general.frontend_url')) || '').replace(/\/$/, '')}/approve-quote?token=${encodeURIComponent(token)}`;
  const t = await emailTemplate('quote_approval');
  const v = await vars(q, { approvalUrl: url, validHours: hours, ...(!q.lead_row?.id && client?.display_name ? { customerName: client.display_name } : {}) });
  await queueEmail({ to, subject: renderTemplate(t.subject, v), html: renderTemplate(t.html, v), template: 'quote_approval', entity: 'quotation', entityId: q.id });
  await query("UPDATE quotes SET status = 'sent', approval_token_hash = $2, approval_sent_to = $3, approval_sent_at = now(), updated_by = $4, updated_at = now() WHERE id = $1",
    [q.id, sha(token), to, user.id]);
  if (await getSetting('notification.approval_requests', true)) {
    for (const u of await usersWithRoles(await getSetting('quotations.approval_notify_roles', ['underwriting']))) {
      await notify({ userId: u.id, type: 'approval', title: 'Quotation sent for approval', message: `Quotation ${q.quote_number} (${v.customerName}, ${await formatMoney(q.premium_total, v.currency)}) was sent to the customer for approval`,
        link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
    }
  }
  return { sentTo: to, approvalUrl: url, before: q, after: await getQuoteRow(q.id) };
}

/** Public link: preview or accept. The token must be the latest one issued for the quotation. */
export async function approveByCustomer(token, preview) {
  let payload;
  try { payload = jwt.verify(String(token || ''), config.jwtSecret, { algorithms: ['HS256'] }); } catch { throw badRequest('This approval link is invalid or has expired'); }
  if (payload.typ !== 'quote-approval') throw badRequest('This approval link is invalid');
  const q = await getQuoteRow(payload.sub);
  if (q.approval_token_hash !== sha(String(token))) throw badRequest('This approval link has been replaced by a newer one');
  if (preview || q.status === 'accepted') return { quote: q, changed: false };
  if (q.status !== 'sent') throw badRequest(`This quotation can no longer be approved (status ${quoteStatusOut(q.status)})`);
  await query("UPDATE quotes SET status = 'accepted', customer_accepted_at = now(), updated_at = now() WHERE id = $1", [q.id]);
  if (q.created_by) {
    await notify({ userId: q.created_by, type: 'task', title: 'Customer accepted quotation', message: `The customer accepted quotation ${q.quote_number}; you can proceed to policy`,
      link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
  }
  return { quote: await getQuoteRow(q.id), before: q, changed: true };
}

/** CustomerAccepted -> SubmittedToInsurer, e-mailing the insurer's underwriting contact. */
export async function submitToInsurer(id, user) {
  const q = await getQuoteRow(id);
  if (!['accepted', 'approved'].includes(q.status)) throw badRequest(`Only CustomerAccepted quotations can be submitted to the insurer (current: ${quoteStatusOut(q.status)})`);
  const ic = q.insurance_company_id ? await one('SELECT name, contact_email FROM insurance_companies WHERE id = $1', [q.insurance_company_id]) : null;
  if (ic?.contact_email) {
    const t = await emailTemplate('insurer_submission');
    const v = await vars(q, { insurerName: ic.name });
    await queueEmail({ to: ic.contact_email, subject: renderTemplate(t.subject, v), html: renderTemplate(t.html, v), template: 'insurer_submission', entity: 'quotation', entityId: q.id });
  }
  await query("UPDATE quotes SET status = 'submitted', submitted_to_insurer_at = now(), submitted_by = $2, updated_by = $2, updated_at = now() WHERE id = $1", [q.id, user.id]);
  return { insurer: ic, before: q, after: await getQuoteRow(q.id) };
}

/**
 * Convert an accepted / approved quotation into a policy: client from the lead, policy, receivable (bill number) and
 * commission accrual. Calling it again for a converted quotation updates and returns the existing policy.
 */
export async function convertToPolicy(id, body, user) {
  const extra = body.additionalPolicyData && typeof body.additionalPolicyData === 'object' ? body.additionalPolicyData : Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'createdBy'));
  const existing = await getQuoteRow(id);
  if (existing.status === 'converted' && existing.policy_id) {
    await updatePolicy(existing.policy_id, extra, user.id);
    return { policyId: existing.policy_id, clientId: existing.client_id, created: false };
  }
  const allowed = await getSetting('quotations.convertible_statuses', ['CustomerAccepted', 'Approved']);
  if (!allowed.includes(quoteStatusOut(existing.status))) throw badRequest(`Cannot convert quotation with status "${quoteStatusOut(existing.status)}". Quote must be CustomerAccepted or Approved`);
  // KYC and vehicle identifiers (policy.kyc_required_fields): saved on the quotation by the convert steps or sent with the request
  const qdoc = existing.doc || {};
  // Issuance never marks the premium paid: the bill stays open until a payment is captured and confirmed (receipts).
  if (extra.paymentStatus && extra.paymentStatus !== 'Pending') extra.paymentStatus = 'Pending';
  // A renewal is the same client and vehicle: the expiring policy's saved ID and vehicle identifiers count,
  // and anything entered on the convert steps (later sources) overrides them.
  const renewedFrom = qdoc.renewedFromPolicyId
    ? (await query('SELECT doc, details FROM policies WHERE id = $1', [qdoc.renewedFromPolicyId])).rows[0]
    : null;
  await assertKyc({
    lob: existing.lob || lobOf(existing.product_type),
    sources: [renewedFrom?.details, renewedFrom?.doc, qdoc.insuranceVehicleDetails?.[0], qdoc, extra.customerInfo, extra],
  });
  const result = await withTransaction(async (db) => {
    const q = (await db.query('SELECT * FROM quotes WHERE id = $1 FOR UPDATE', [existing.id])).rows[0];
    if (q.status === 'converted') throw badRequest('Quotation was converted by another request');
    const clientId = q.client_id || (q.lead_id ? await clientFromLead(db, q.lead_id, extra.customerInfo || {}, q.created_by || user.id) : null);
    if (!clientId) throw badRequest('Quotation has no lead or client to insure');
    const doc = q.doc || {};
    // Renewal quotation (renewals/service.js#createRenewalQuote): the policy becomes the next term of the expiring one.
    const renewalOf = doc.renewal?.policyId ? doc.renewal : null;
    let expiring = null;
    if (renewalOf) {
      expiring = (await db.query('SELECT id, policy_number, status, renewed_to, expiry_date, billing_mode FROM policies WHERE id = $1 FOR UPDATE', [renewalOf.policyId])).rows[0];
      if (!expiring) throw badRequest(`Policy ${renewalOf.policyNumber || renewalOf.policyId} being renewed was not found`);
      if (expiring.renewed_to || expiring.status === 'renewed') throw conflict(`Policy ${expiring.policy_number} has already been renewed`);
      if (expiring.status === 'cancelled') throw conflict(`Policy ${expiring.policy_number} is cancelled`);
      if (!extra.inception && !extra.inceptionDate) {
        const next = new Date(`${expiring.expiry_date}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        extra.inception = next.toISOString().slice(0, 10);
      }
    }
    const issued = await issuePolicy(db, {
      quoteId: q.id, clientId, leadId: q.lead_id, productId: q.product_id, policyTypeId: q.policy_type_id, insuranceCompanyId: q.insurance_company_id,
      ownerUserId: q.created_by, agentUserId: q.agent_user_id || q.created_by, sumInsured: q.sum_insured, netPremium: q.premium_base,
      grossPremium: q.premium_total, commissionAmount: q.commission_amount, commissionRate: Number(q.commission_rate || 0), currency: q.currency,
      insuredName: extra.insuredName, productType: q.product_type, lob: q.lob, doc: stripReserved(doc),
      receivableSource: renewalOf ? 'renewal' : 'policy', receivableReference: renewalOf?.renewalNumber || null,
      billingMode: expiring?.billing_mode || null,
    }, extra, user.id);
    if (renewalOf) {
      const link = { businessType: 'Renewal', renewal: { renewalId: renewalOf.renewalId, renewalNumber: renewalOf.renewalNumber, previousPolicyId: expiring.id, previousPolicyNumber: expiring.policy_number, quoteId: q.id } };
      await db.query('UPDATE policies SET renewed_from = $2, details = details || $3::jsonb WHERE id = $1', [issued.policyId, expiring.id, JSON.stringify(link)]);
      await db.query("UPDATE policies SET status = 'renewed', renewed_to = $2, updated_by = $3, updated_at = now() WHERE id = $1", [expiring.id, issued.policyId, user.id]);
      const rn = (await db.query(`UPDATE renewals SET status = 'renewed', new_policy_id = $2, premium_new = $3, renewed_at = now(), updated_at = now()
        WHERE policy_id = $1 AND status <> ALL($4) RETURNING id`, [expiring.id, issued.policyId, q.premium_total, ['renewed', 'lapsed']])).rows[0];
      if (rn) {
        const number = (await db.query('SELECT policy_number FROM policies WHERE id = $1', [issued.policyId])).rows[0].policy_number;
        await db.query(`INSERT INTO renewal_activities(renewal_id, by_user, activity_type, description, details) VALUES ($1,$2,'Renewed',$3,$4)`,
          [rn.id, user.username ?? null, `Renewed as policy ${number} from quotation ${q.quote_number}`, JSON.stringify({ quoteId: q.id, newPolicyId: issued.policyId })]);
      }
    }
    await db.query("UPDATE quotes SET status = 'converted', policy_id = $2, client_id = $3, updated_by = $4, updated_at = now() WHERE id = $1", [q.id, issued.policyId, clientId, user.id]);
    return { ...issued, clientId };
  });
  const policy = await getPolicyRow(result.policyId);
  const owner = existing.created_by || user.id;
  await notify({ userId: owner, type: 'info', title: 'Policy issued', message: `Policy ${policy.policy_number} was issued from quotation ${existing.quote_number} (${policy.billing_mode === 'direct' ? 'direct bill: the client pays the insurer' : `bill ${policy.bill_number}`})`,
    link: `/agent/policydetail/${policy.id}`, entity: 'policy', entityId: policy.id });
  return { ...result, created: true };
}

export async function updateVehicleInfo(id, body, userId) {
  const q = await getQuoteRow(id);
  const doc = { ...(q.doc || {}), ...stripReserved(body), vehicleInfoUpdatedAt: new Date().toISOString() };
  await query('UPDATE quotes SET doc = $2, updated_by = $3, updated_at = now() WHERE id = $1', [q.id, JSON.stringify(doc), userId]);
  return { before: q, after: await getQuoteRow(q.id) };
}

function listWhere(q) {
  const where = ['q.deleted_at IS NULL'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.leadRefId) add('q.lead_id = ?', q.leadRefId);
  if (q.clientId) add('q.client_id = ?', q.clientId);
  if (q.status || q.quotationStatus) add('q.status = ?', quoteStatusIn(q.status || q.quotationStatus) || '-');
  if (q.lob) add('q.lob = ?', lobOf(q.lob));
  if (q.productType) add("(q.product_type ILIKE '%' || ? || '%' OR q.lob = upper(?))", q.productType);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'quote', 'q', params));
  const search = q.search || q.query;
  if (search) add("(q.quote_number ILIKE '%' || ? || '%' OR l.display_name ILIKE '%' || ? || '%' OR q.product_type ILIKE '%' || ? || '%')", search);
  return { where: where.join(' AND '), params };
}

export async function listQuotes(q, pg) {
  const { where, params } = listWhere(q);
  const total = (await one(`SELECT count(*)::int AS n FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id WHERE ${where}`, params)).n;
  const rows = await many(`${QUOTE_SELECT} WHERE ${where} ORDER BY q.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  return { total, rows };
}

export async function quoteStats(q) {
  const { where, params } = listWhere(q);
  const recentDays = Number(await getSetting('leads.recent_days', 7));
  const base = `FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id WHERE ${where}`;
  const s = await one(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE q.created_at >= now() - make_interval(days => $${params.length + 1}))::int AS recent,
      count(*) FILTER (WHERE q.created_at >= now() - interval '30 days')::int AS last30,
      count(*) FILTER (WHERE q.created_at >= now() - interval '60 days' AND q.created_at < now() - interval '30 days')::int AS prev30,
      count(*) FILTER (WHERE q.status = 'converted')::int AS converted, count(*) FILTER (WHERE q.status = 'approved')::int AS approved,
      count(*) FILTER (WHERE q.status IN ('draft','sent','submitted'))::int AS pending,
      count(*) FILTER (WHERE q.status NOT IN ('converted','rejected','expired','dropped'))::int AS active,
      COALESCE(avg(q.premium_total), 0) AS avg_premium, COALESCE(sum(q.premium_total), 0) AS total_premium,
      COALESCE(avg(q.premium_total) FILTER (WHERE q.status IN ('approved','accepted','converted')), 0) AS avg_approved
    ${base}`, [...params, recentDays]);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const byStatus = await many(`SELECT q.status, count(*)::int AS count, COALESCE(sum(q.premium_total),0) AS premium ${base} GROUP BY q.status ORDER BY 2 DESC`, params);
  const byProduct = await many(`SELECT COALESCE(q.product_type, q.lob) AS "productType", count(*)::int AS count, COALESCE(sum(q.premium_total),0) AS premium ${base} GROUP BY 1 ORDER BY 2 DESC`, params);
  return {
    totalQuotations: s.total, recentQuotations: s.recent, last30DaysQuotations: s.last30, convertedToPolicyCount: s.converted,
    approvedQuotations: s.approved, pendingQuotations: s.pending, activeQuotationsCount: s.active,
    conversionRate: pct(s.converted, s.total), approvalRate: pct(s.approved + s.converted, s.total),
    growthRate: s.prev30 ? pct(s.last30 - s.prev30, s.prev30) : (s.last30 ? 100 : 0),
    averagePremium: round2(s.avg_premium), totalPremiumValue: round2(s.total_premium), averageApprovedPremium: round2(s.avg_approved),
    quotationsByStatus: byStatus.map((r) => ({ status: quoteStatusOut(r.status), count: r.count, premium: round2(r.premium) })),
    quotationsByProductType: byProduct.map((r) => ({ ...r, premium: round2(r.premium) })),
  };
}

/** Audit trail rows: one per changed field (or one per action without a diff). */
export async function auditTrail(id, sort = 'desc') {
  const q = await getQuoteRow(id);
  const rows = await many(`SELECT a.*, u.display_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.entity = 'quotation' AND a.entity_id = $1 ORDER BY a.at ${sort === 'asc' ? 'ASC' : 'DESC'}, a.id ${sort === 'asc' ? 'ASC' : 'DESC'}`, [q.id]);
  const skip = new Set(['updatedAt', 'updatedBy', 'premiumBreakdown', 'lead', 'createdAt']);
  const out = [];
  for (const a of rows) {
    const base = { id: a.id, action: a.action, operation: a.action, createdAt: a.at, timestamp: a.at, user: { id: a.user_id, username: a.username, displayName: a.display_name || a.username || 'Customer' }, createdBy: a.display_name || a.username };
    const before = a.before_data || {};
    const after = a.after_data || {};
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => !skip.has(f) && JSON.stringify(before[f]) !== JSON.stringify(after[f]));
    if (!a.before_data || !fields.length) out.push({ ...base, field: null, fieldName: null, oldValue: null, newValue: null });
    else for (const f of fields) out.push({ ...base, id: `${a.id}-${f}`, field: f, fieldName: f, oldValue: before[f] ?? null, newValue: after[f] ?? null });
  }
  return out;
}

/** Rule-based comparison insights (no external AI service). */
export function compareInsights(a, b) {
  const g1 = num(a.grossPremium);
  const g2 = num(b.grossPremium);
  const diff = round2(g2 - g1);
  const pctDiff = g1 ? (diff / g1) * 100 : 0;
  const cheaper = g1 <= g2 ? 1 : 2;
  const keyDifferences = [];
  const cmp = (category, f, label) => {
    if (num(a[f]) !== num(b[f])) keyDifferences.push({ category, description: `${label}: ${num(a[f]).toLocaleString('en-US')} vs ${num(b[f]).toLocaleString('en-US')}`, impact: Math.abs(num(a[f]) - num(b[f])) > 0.1 * Math.max(num(a[f]), num(b[f]), 1) ? 'high' : 'medium' });
  };
  cmp('Premium', 'grossPremium', 'Gross premium'); cmp('Coverage', 'totalSumInsured', 'Total sum insured');
  cmp('Coverage', 'bodilyInjury', 'Bodily injury'); cmp('Coverage', 'propertyDamage', 'Property damage'); cmp('Deductible', 'deductible', 'Deductible');
  if ((a.insuranceCompanyName || '') !== (b.insuranceCompanyName || '')) keyDifferences.push({ category: 'Insurer', description: `${a.insuranceCompanyName || 'N/A'} vs ${b.insuranceCompanyName || 'N/A'}`, impact: 'medium' });
  const si1 = num(a.totalSumInsured);
  const si2 = num(b.totalSumInsured);
  const better = si1 === si2 ? cheaper : (si1 > si2 ? 1 : 2);
  const preferred = g1 === g2 ? better : cheaper;
  return {
    summary: `Quote ${preferred} (${preferred === 1 ? a.quotationNumber : b.quotationNumber}) offers the better value: ${keyDifferences.length} difference(s) found.`,
    keyDifferences,
    pricingAnalysis: { quote1Total: g1, quote2Total: g2, difference: diff, percentageDifference: pctDiff, analysis: diff === 0 ? 'Both quotations have the same gross premium.' : `Quote ${cheaper} is cheaper by ${Math.abs(diff).toLocaleString('en-US', { minimumFractionDigits: 2 })}.` },
    recommendation: { preferredQuote: preferred, reasoning: si1 === si2 ? 'Same sum insured; the lower premium is preferred.' : `Quote ${better} has the higher sum insured${better === cheaper ? ' and the lower premium' : ''}.`, considerations: ['Check deductibles and exclusions', 'Confirm the insurer\'s claims service level', 'Verify the validity date of each quotation'] },
    quote1Pros: [g1 <= g2 ? 'Lower or equal premium' : null, si1 >= si2 ? 'Higher or equal sum insured' : null].filter(Boolean),
    quote2Pros: [g2 <= g1 ? 'Lower or equal premium' : null, si2 >= si1 ? 'Higher or equal sum insured' : null].filter(Boolean),
  };
}

/** Uploaded row -> quotation body (creates the lead when only the customer's details are given). */
export async function quoteFromRow(db, row, userId) {
  let leadRefId = pick(row, 'leadRefId', 'lead id', 'leadId', 'lead number');
  if (leadRefId) {
    const l = (await db.query('SELECT id FROM leads WHERE id = $1 OR lead_number = $1', [leadRefId])).rows[0];
    if (!l) throw badRequest(`Lead ${leadRefId} not found`);
    leadRefId = l.id;
  } else {
    const lead = await createLead({ firstName: pick(row, 'firstName', 'first name'), lastName: pick(row, 'lastName', 'last name'), companyName: pick(row, 'companyName', 'company'),
      emailId: pick(row, 'email', 'emailId'), contactNumber: pick(row, 'contactNumber', 'contact number', 'mobile'), lob: pick(row, 'productType', 'product', 'lob'), source: 'bulk-upload' }, userId, db);
    leadRefId = lead.id;
  }
  return {
    leadRefId, productType: pick(row, 'productType', 'product type', 'product') || 'Motor', insurancePolicyType: pick(row, 'insurancePolicyType', 'policy type'),
    insuranceCompanyName: pick(row, 'insuranceCompanyName', 'insurance company', 'insurer'),
    totalSumInsured: pick(row, 'totalSumInsured', 'sum insured', 'sumInsured'), lossAndDamageCoverage: pick(row, 'lossAndDamageCoverage', 'own damage', 'fmv'),
    lossAndDamageCoverageRate: pick(row, 'lossAndDamageCoverageRate', 'rate', 'od rate'), netPremium: pick(row, 'netPremium', 'net premium', 'premium'),
    discount: pick(row, 'discount'), remarks: pick(row, 'remarks', 'notes'),
  };
}

export const quoteById = async (id) => toQuote(await getQuoteRow(id));
