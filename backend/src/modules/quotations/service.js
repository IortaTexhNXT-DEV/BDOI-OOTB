import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { hasPermission } from '../../lib/auth.js';
import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest, forbidden, conflict } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney } from '../../lib/money.js';
import { queueEmail, emailSendingStatus } from '../../lib/mailer.js';
import { notify } from '../notifications/service.js';
import { notifyDecision } from '../notifications/approvals.js';
import { lobOf, renderTemplate, emailTemplate, usersWithRoles, num, round2 } from '../documents/common.js';
import { quoteStatusIn, quoteStatusOut } from '../documents/statuses.js';
import { mapColumns } from '../documents/tabular.js';
import { clientFromLead } from '../clients/service.js';
import { issuePolicy, insurerId, getPolicyRow, updatePolicy } from '../policies/service.js';
import { assertKyc } from '../policies/kyc.js';
import { publicWebUrl } from '../../lib/publicWeb.js';
import { createLead } from '../leads/service.js';
import { premiumBreakdown } from './premium.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { toQuote, stripReserved, QUOTE_SELECT } from './shape.js';
import { addDays, today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { participantsFromDoc, writeParticipants, legacyParticipantDetails, leadOf, participantsOf, participantInputs } from '../placement/participants.js';
import { journeyFor, assertStep, resolveLob } from '../placement/journey.js';
import { companyName } from '../../lib/letterhead.js';
import { assertNotDeclined, assertFactsCaptured, referralFor, assertReferralCleared, assertMayDecide } from '../product-configurator/underwriting.js';
import { assertAuthority } from '../access-control/service.js';

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

/**
 * Co-insurance participants of a quotation document: body.participants (new API) or doc.participantDetails (screens),
 * validated server-side; a single insurer is 100% of the insurer named on the quote. Returns { parts, icId, doc } where
 * icId is the lead insurer and doc carries the normalised participantDetails the existing screens read.
 */
async function quoteParticipants(c, doc, explicit, fallbackIc) {
  const named = await insurerId(c, insurerRef(doc));
  const parts = await participantsFromDoc(doc, named || fallbackIc || null, { db: c, explicit: Array.isArray(explicit) && explicit.length ? explicit : null });
  const lead = leadOf(parts);
  const next = { ...doc };
  if (parts.length) {
    next.participantDetails = await legacyParticipantDetails(parts, c, doc.currency || null);
    next.isCoInsurance = parts.length > 1;
  }
  delete next.participants;
  return { parts, icId: lead?.insuranceCompanyId || named || fallbackIc || null, doc: next };
}

const quoteTotals = (b) => ({ sumInsured: b.totalSumInsured, premium: b.netPremium, taxes: round2(num(b.valueAddedTax) + num(b.documentaryStampTax) + num(b.localGovernmentTax) + num(b.fireServiceTax)),
  premiumTotal: b.grossPremium, commissionAmount: b.commissionAmount });

/** Premium columns from a breakdown. */
const premiumCols = (b) => ({
  sum_insured: b.totalSumInsured, premium_base: b.netPremium, vat: b.valueAddedTax, dst: b.documentaryStampTax, lgt: b.localGovernmentTax,
  fst: b.fireServiceTax, others: b.accountPremiumOthers, discount: b.discount, ncd: b.NCD, premium_total: b.grossPremium,
  commission_rate: b.commissionRate, commission_amount: b.commissionAmount, currency: b.currency,
});

export async function createQuote(body, userId, db = null) {
  const raw = stripReserved(body);
  delete raw.brokerSlipId;
  const leadId = body.leadRefId || body.leadId || null;
  const run = async (c) => {
    if (leadId && !(await c.query('SELECT 1 FROM leads WHERE id = $1 AND deleted_at IS NULL', [leadId])).rows[0]) throw badRequest(`Lead ${leadId} not found`);
    if (!leadId && !body.clientId) throw badRequest('leadRefId (or clientId) is required');
    // placement journey: a line that requires a broker slip only takes quotations prepared from one (renewals excepted)
    if (!body.brokerSlipId && !raw.renewal?.policyId) {
      const journey = await journeyFor({ lob: body.lob, productType: body.productType, productId: body.productId }, c);
      assertStep(journey, 'brokerSlip', ['required'], `The ${journey.lob} placement journey starts with a Broker Slip: prepare the Quotation Slip from the broker slip's offers`);
    }
    // the product the quotation is for (Quick Quote, broker slip): its line of business prices the quotation when none is
    // given (a Personal Accident quotation is not priced as motor); without a product the database links one by type or line
    const productId = body.productId ? (await c.query('SELECT id FROM products WHERE id::text = $1::text', [String(body.productId)])).rows[0]?.id ?? null : null;
    if (productId && !raw.lob) raw.lob = await resolveLob({ productId, productType: body.productType }, c);
    const { parts, icId, doc } = await quoteParticipants(c, raw, body.participants, null);
    const b = await premiumBreakdown(doc, { insurerId: icId });
    await assertFactsCaptured(b.underwriting);
    assertNotDeclined(b.underwriting, 'The quotation');
    const referral = referralFor(b.underwriting);
    if (referral) doc.underwritingReferral = referral;
    const number = await nextDocumentNumber('quote', { db: c, unique: { table: 'quotes', column: 'quote_number' } });
    const validity = Number(await getSetting('limits.quote_validity_days', 30));
    const status = 'draft';
    const data = { quote_number: number, lead_id: leadId, client_id: body.clientId || null, insurance_company_id: icId, status,
      product_type: body.productType || (b.lob === 'MOTOR' ? 'Motor' : body.productType), lob: b.lob, agent_user_id: userId, created_by: userId,
      valid_until: addDays(await today(), validity), remarks: body.remarks || null,
      doc: JSON.stringify({ ...withServerCovers(doc, b), premiumBreakdown: b }), ...premiumCols(b), broker_slip_id: body.brokerSlipId || null, product_id: productId };
    const keys = Object.keys(data);
    const r = await c.query(`INSERT INTO quotes(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data));
    if (parts.length) await writeParticipants(c, 'quote', r.rows[0].id, parts, quoteTotals(b), { userId, commissionRate: b.commissionRate });
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
  const merged = { ...(before.doc || {}), ...stripReserved(body) };
  delete merged.premiumBreakdown;
  delete merged.brokerSlipId;
  await withTransaction(async (c) => {
    const { parts, icId, doc } = await quoteParticipants(c, merged, body.participants, before.insurance_company_id);
    const b = await premiumBreakdown(doc, { insurerId: icId });
    await assertFactsCaptured(b.underwriting);
    assertNotDeclined(b.underwriting, 'The quotation');
    const referral = referralFor(b.underwriting, before.doc?.underwritingReferral || null);
    if (referral) doc.underwritingReferral = referral; else delete doc.underwritingReferral;
    const data = { ...premiumCols(b), insurance_company_id: icId, lob: b.lob, product_type: body.productType || before.product_type,
      doc: JSON.stringify({ ...withServerCovers(doc, b), premiumBreakdown: b }), updated_by: userId, updated_at: new Date() };
    if (body.leadRefId && body.leadRefId !== before.lead_id) data.lead_id = body.leadRefId;
    const keys = Object.keys(data);
    await c.query(`UPDATE quotes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
    if (parts.length) await writeParticipants(c, 'quote', before.id, parts, quoteTotals(b), { userId, commissionRate: b.commissionRate });
    else await c.query("DELETE FROM risk_participants WHERE entity_type = 'quote' AND entity_id = $1", [before.id]);
  });
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

/** Status change following quotations.transitions (API labels). Approval needs approve:quotations and is maker-checker when enabled. */
export async function changeStatus(id, label, user) {
  const q = await getQuoteRow(id);
  const target = quoteStatusIn(label);
  if (!target) throw badRequest(`Unknown quotation status ${label}`);
  const from = quoteStatusOut(q.status);
  const to = quoteStatusOut(target);
  const transitions = await getSetting('quotations.transitions', {});
  if (!(transitions[from] || []).includes(to)) throw badRequest(`Cannot change a ${from} quotation to ${to}`);
  if (to === 'Approved') assertReferralCleared(q, 'approval');
  if (to === 'Approved' && !hasPermission(user, 'approve:quotations')) throw forbidden('Requires permission: approve:quotations');
  if (to === 'Approved' && await getSetting('workflow.quote_maker_checker', true) && q.created_by === user.id) {
    throw forbidden('Maker-checker: the approver must be different from the user who created the quotation');
  }
  const stamps = { approved: ', approved_by = $3, approved_at = now()', accepted: ', customer_accepted_at = now()', submitted: ', submitted_to_insurer_at = now(), submitted_by = $3' };
  await query(`UPDATE quotes SET status = $2, updated_by = $3, updated_at = now()${stamps[target] || ''} WHERE id = $1`, [q.id, target, user.id]);
  const placement = await raisePlacement(q.id, user);
  if (to === 'Approved') {
    const owner = q.created_by;
    await notifyDecision({ userId: owner, decidedBy: user.id, document: 'Quotation', number: q.quote_number, approved: true, by: user.username,
      message: `Quotation ${q.quote_number} was approved by ${user.username} and can be converted to a policy`, link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
  }
  return { before: q, after: await getQuoteRow(q.id), placement };
}

/** The placement slip raised automatically when the client accepts (placement/placements.js#autoRaisePlacement). */
async function raisePlacement(quoteId, user) {
  const { autoRaisePlacement } = await import('../placement/placements.js');
  return autoRaisePlacement(quoteId, user);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const vars = async (q, extra = {}) => ({
  companyName: await companyName(), quotationNumber: q.quote_number,
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

/** Public approval page address for a token (public web address + /approve-quote). */
const approvalUrlFor = async (token) => `${await publicWebUrl()}/approve-quote?token=${encodeURIComponent(token)}`;

/** The quotation's approval token while it verifies and is the latest one issued, else null. */
function currentToken(q) {
  if (!q.approval_token || q.approval_token_hash !== sha(q.approval_token)) return null;
  try {
    const payload = jwt.verify(q.approval_token, config.jwtSecret, { algorithms: ['HS256'] });
    return { token: q.approval_token, expiresAt: new Date(payload.exp * 1000).toISOString() };
  } catch { return null; }
}

/** Issue a new approval token for the quotation; the previous link stops working. */
async function issueApprovalToken(q) {
  const hours = Number(await getSetting('quotations.approval_link_ttl_hours', 168));
  const token = approvalToken(q.id, hours);
  await query('UPDATE quotes SET approval_token = $2, approval_token_hash = $3 WHERE id = $1', [q.id, token, sha(token)]);
  return { token, hours, expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString() };
}

/**
 * Draft -> PendingCustomer: e-mail the customer a signed approval link and notify the Processing Team.
 * When e-mail sending is not configured the quotation still moves to PendingCustomer (an e-mail, when there is an
 * address, waits in the outbox), so staff can share the link another way or record the customer's answer.
 */
export async function sendForApproval(id, user) {
  const q = await getQuoteRow(id);
  if (!['draft', 'sent'].includes(q.status)) throw badRequest(`Only Draft quotations can be sent for approval (current: ${quoteStatusOut(q.status)})`);
  // a quotation without premium could be accepted but never issued (the policy bill would be nil)
  if (!(Number(q.premium_total) > 0)) throw badRequest(`Quotation ${q.quote_number} has no premium: price the cover before sending it to the customer`);
  assertReferralCleared(q, 'sending it to the customer');
  const email = await emailSendingStatus();
  // Quotations without a lead (e.g. renewals of imported policies) go to the client's address.
  const client = q.client_id ? await one('SELECT display_name, email FROM clients WHERE id = $1', [q.client_id]) : null;
  const to = q.lead_row?.email || client?.email || null;
  if (!to && email.active) throw badRequest(q.lead_row ? 'The lead has no e-mail address; add one before sending the quotation' : 'The client has no e-mail address; add one before sending the quotation');
  const { token, hours } = await issueApprovalToken(q);
  const url = await approvalUrlFor(token);
  const v = await vars(q, { approvalUrl: url, validHours: hours, ...(!q.lead_row?.id && client?.display_name ? { customerName: client.display_name } : {}) });
  let emailId = null;
  if (to) {
    const t = await emailTemplate('quote_approval');
    emailId = await queueEmail({ to, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'quote_approval', entity: 'quotation', entityId: q.id });
  }
  await query("UPDATE quotes SET status = 'sent', approval_sent_to = $2, approval_sent_at = now(), updated_by = $3, updated_at = now() WHERE id = $1",
    [q.id, to, user.id]);
  if (await getSetting('notification.approval_requests', true)) {
    for (const u of await usersWithRoles(await getSetting('quotations.approval_notify_roles', ['processing']))) {
      await notify({ userId: u.id, type: 'approval', title: 'Quotation sent for approval', message: `Quotation ${q.quote_number} (${v.customerName}, ${await formatMoney(q.premium_total, v.currency)}) was sent to the customer for approval`,
        link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
    }
  }
  return { sentTo: to, approvalUrl: url, emailId, emailSending: email.active, before: q, after: await getQuoteRow(q.id) };
}

/**
 * Approval link of a PendingCustomer quotation, to share by Viber / WhatsApp. The current link is returned while it
 * is valid, so copying it does not break the one already e-mailed; an expired link is replaced by a new one.
 */
export async function approvalLink(id) {
  const q = await getQuoteRow(id);
  if (q.status !== 'sent') throw badRequest(`Only a PendingCustomer quotation has an approval link (current: ${quoteStatusOut(q.status)})`);
  const current = currentToken(q);
  const issued = current || await issueApprovalToken(q);
  return { quote: q, approvalUrl: await approvalUrlFor(issued.token), expiresAt: issued.expiresAt, reissued: !current };
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
  // accepted through the public link: the placement is raised in the name of the quotation's owner
  const placement = await raisePlacement(q.id, { id: q.created_by });
  return { quote: await getQuoteRow(q.id), before: q, changed: true, placement };
}

/** CustomerAccepted -> SubmittedToInsurer, e-mailing the insurer's underwriting contact. */
export async function submitToInsurer(id, user) {
  const q = await getQuoteRow(id);
  if (!['accepted', 'approved'].includes(q.status)) throw badRequest(`Only CustomerAccepted quotations can be submitted to the insurer (current: ${quoteStatusOut(q.status)})`);
  const ic = q.insurance_company_id ? await one('SELECT name, contact_email FROM insurance_companies WHERE id = $1', [q.insurance_company_id]) : null;
  if (ic?.contact_email) {
    const t = await emailTemplate('insurer_submission');
    const v = await vars(q, { insurerName: ic.name });
    await queueEmail({ to: ic.contact_email, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'insurer_submission', entity: 'quotation', entityId: q.id });
  }
  await query("UPDATE quotes SET status = 'submitted', submitted_to_insurer_at = now(), submitted_by = $2, updated_by = $2, updated_at = now() WHERE id = $1", [q.id, user.id]);
  return { insurer: ic, before: q, after: await getQuoteRow(q.id) };
}

/**
 * Renewal quotation (renewals/service.js#createRenewalQuote): the expiring policy it renews, locked, and the first day of
 * the new term (the day after the expiry). { renewalOf: null } for a new-business quotation.
 */
export async function renewalTerm(db, q) {
  const renewalOf = q.doc?.renewal?.policyId ? q.doc.renewal : null;
  if (!renewalOf) return { renewalOf: null, expiring: null, inception: null };
  const expiring = (await db.query('SELECT id, policy_number, status, renewed_to, expiry_date, billing_mode FROM policies WHERE id = $1 FOR UPDATE', [renewalOf.policyId])).rows[0];
  if (!expiring) throw badRequest(`Policy ${renewalOf.policyNumber || renewalOf.policyId} being renewed was not found`);
  if (expiring.renewed_to || expiring.status === 'renewed') throw conflict(`Policy ${expiring.policy_number} has already been renewed`);
  if (expiring.status === 'cancelled') throw conflict(`Policy ${expiring.policy_number} is cancelled`);
  return { renewalOf, expiring, inception: addDays(expiring.expiry_date, 1) };
}

/** The policy issued for a renewal quotation becomes the next term: the expiring policy is Renewed and the renewal closed. */
export async function linkRenewal(db, { q, renewalOf, expiring, policyId, user }) {
  const link = { businessType: 'Renewal', renewal: { renewalId: renewalOf.renewalId, renewalNumber: renewalOf.renewalNumber, previousPolicyId: expiring.id, previousPolicyNumber: expiring.policy_number, quoteId: q.id } };
  await db.query('UPDATE policies SET renewed_from = $2, details = details || $3::jsonb WHERE id = $1', [policyId, expiring.id, JSON.stringify(link)]);
  await db.query("UPDATE policies SET status = 'renewed', renewed_to = $2, updated_by = $3, updated_at = now() WHERE id = $1", [expiring.id, policyId, user.id]);
  const rn = (await db.query(`UPDATE renewals SET status = 'renewed', new_policy_id = $2, premium_new = $3, renewed_at = now(), updated_at = now()
    WHERE policy_id = $1 AND status <> ALL($4) RETURNING id`, [expiring.id, policyId, q.premium_total, ['renewed', 'lapsed']])).rows[0];
  if (rn) {
    const number = (await db.query('SELECT policy_number FROM policies WHERE id = $1', [policyId])).rows[0].policy_number;
    await db.query(`INSERT INTO renewal_activities(renewal_id, by_user, activity_type, description, details) VALUES ($1,$2,'Renewed',$3,$4)`,
      [rn.id, user.username ?? null, `Renewed as policy ${number} from quotation ${q.quote_number}`, JSON.stringify({ quoteId: q.id, newPolicyId: policyId })]);
  }
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
  assertReferralCleared(existing, 'policy issuance');
  const allowed = await getSetting('quotations.convertible_statuses', ['CustomerAccepted', 'Approved']);
  if (!allowed.includes(quoteStatusOut(existing.status))) throw badRequest(`Cannot convert quotation with status "${quoteStatusOut(existing.status)}". Quote must be CustomerAccepted or Approved`);
  // placement journey: a line that requires a Placement Slip issues its policy from the placement slip
  await assertDirectConversion(existing);
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
    const { renewalOf, expiring, inception } = await renewalTerm(db, q);
    if (renewalOf && !extra.inception && !extra.inceptionDate) extra.inception = inception;
    const issued = await issuePolicy(db, {
      quoteId: q.id, clientId, leadId: q.lead_id, productId: q.product_id, policyTypeId: q.policy_type_id, insuranceCompanyId: q.insurance_company_id,
      ownerUserId: q.created_by, agentUserId: q.agent_user_id || q.created_by, sumInsured: q.sum_insured, netPremium: q.premium_base,
      grossPremium: q.premium_total, commissionAmount: q.commission_amount, commissionRate: Number(q.commission_rate || 0), currency: q.currency,
      insuredName: extra.insuredName, productType: q.product_type, lob: q.lob, doc: stripReserved(doc),
      receivableSource: renewalOf ? 'renewal' : 'policy', receivableReference: renewalOf?.renewalNumber || null,
      billingMode: expiring?.billing_mode || null, participants: await participantInputs('quote', q.id, db),
      taxes: round2(num(q.vat) + num(q.dst) + num(q.lgt) + num(q.fst)),
    }, extra, user.id);
    if (renewalOf) await linkRenewal(db, { q, renewalOf, expiring, policyId: issued.policyId, user });
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

/** Columns of the quotation bulk upload (Quotations > Bulk Upload); the upload template is built from this list. */
export const QUOTE_UPLOAD_COLUMNS = [
  { key: 'leadRefId', header: 'Lead Id', aliases: ['leadRefId', 'lead number'], required: 'Lead Id, or First Name / Company Name for a new lead', format: 'Lead number (LD-...) of an existing lead; leave empty to create the lead from the name columns', example: '' },
  { key: 'firstName', header: 'First Name', format: 'Text; used when Lead Id is empty', example: 'Jose' },
  { key: 'lastName', header: 'Last Name', format: 'Text', example: 'Reyes' },
  { key: 'companyName', header: 'Company Name', aliases: ['company'], format: 'Text; for a corporate lead', example: '' },
  { key: 'emailId', header: 'Email', aliases: ['email'], format: 'E-mail address', example: 'jose.reyes@example.ph' },
  { key: 'contactNumber', header: 'Contact Number', aliases: ['mobile'], format: 'Mobile or landline number', example: '09189876543' },
  { key: 'productType', header: 'Product Type', aliases: ['product', 'lob'], format: 'Motor when empty', allowed: ['Motor', 'Fire', 'IAR'], example: 'Motor' },
  { key: 'insurancePolicyType', header: 'Policy Type', aliases: ['insurancePolicyType'], format: 'Policy type code (e.g. PC private car, CV commercial vehicle)', example: 'PC' },
  { key: 'insuranceCompanyName', header: 'Insurance Company', aliases: ['insuranceCompanyName', 'insurer'], format: 'Insurer name or code as in the Insurance Company master', example: 'Malayan Insurance Co., Inc.' },
  { key: 'totalSumInsured', header: 'Sum Insured', aliases: ['totalSumInsured', 'sumInsured'], format: 'Amount in PHP', example: '980000' },
  { key: 'lossAndDamageCoverage', header: 'Own Damage', aliases: ['lossAndDamageCoverage', 'fmv'], format: 'Motor own damage / fair market value in PHP', example: '980000' },
  { key: 'lossAndDamageCoverageRate', header: 'OD Rate', aliases: ['lossAndDamageCoverageRate', 'rate'], format: 'Percent, e.g. 1.5 for 1.5%', example: '1.5' },
  { key: 'netPremium', header: 'Net Premium', aliases: ['premium'], format: 'Amount in PHP; calculated from the rate when empty', example: '' },
  { key: 'discount', header: 'Discount', format: 'Amount in PHP', example: '0' },
  { key: 'remarks', header: 'Remarks', aliases: ['notes'], format: 'Text', example: 'Moving from another broker' },
];

/** Uploaded row -> quotation body (creates the lead when only the customer's details are given). */
export async function quoteFromRow(db, row, userId) {
  const v = mapColumns(row, QUOTE_UPLOAD_COLUMNS);
  let { leadRefId } = v;
  if (leadRefId) {
    const l = (await db.query('SELECT id FROM leads WHERE id = $1 OR lead_number = $1', [leadRefId])).rows[0];
    if (!l) throw badRequest(`Lead ${leadRefId} not found`);
    leadRefId = l.id;
  } else {
    const lead = await createLead({ firstName: v.firstName, lastName: v.lastName, companyName: v.companyName, emailId: v.emailId, contactNumber: v.contactNumber,
      lob: v.productType, source: 'bulk-upload' }, userId, db);
    leadRefId = lead.id;
  }
  return {
    leadRefId, productType: v.productType || 'Motor', insurancePolicyType: v.insurancePolicyType, insuranceCompanyName: v.insuranceCompanyName,
    totalSumInsured: v.totalSumInsured, lossAndDamageCoverage: v.lossAndDamageCoverage, lossAndDamageCoverageRate: v.lossAndDamageCoverageRate,
    netPremium: v.netPremium, discount: v.discount, remarks: v.remarks,
  };
}

/** Journey rule for a direct quotation -> policy conversion (renewals follow placement.journey_applies_to_renewals). */
export async function assertDirectConversion(q) {
  const renewal = Boolean(q.doc?.renewal?.policyId);
  if (renewal && !(await getSetting('placement.journey_applies_to_renewals', true))) return;
  const journey = await journeyFor({ lob: q.lob, productType: q.product_type, productId: q.product_id });
  assertStep(journey, 'placementSlip', ['required'],
    `The ${journey.lob} placement journey requires a Placement Slip: create the placement slip from this quotation and issue the policy from it once the insurer(s) confirm`);
}

/** The quotation with its co-insurance participants, the journey step links (broker slip, placement slip, policy) and the journey config. */
export async function quoteById(id) {
  const row = await getQuoteRow(id);
  const quote = toQuote(row);
  const participants = await participantsOf('quote', row.id);
  const slip = row.broker_slip_id ? await one('SELECT id, slip_number FROM broker_slips WHERE id = $1', [row.broker_slip_id]) : null;
  const placement = await one(`SELECT id, placement_number, status FROM placements WHERE quote_id = $1 AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1`, [row.id]);
  const offers = slip ? await many(`SELECT o.*, ic.name AS insurer_name FROM insurer_offers o JOIN insurance_companies ic ON ic.id = o.insurance_company_id
    WHERE o.broker_slip_id = $1 ORDER BY o.premium_total NULLS LAST, ic.name`, [slip.id]) : [];
  const journey = await journeyFor({ lob: row.lob, productType: row.product_type, productId: row.product_id });
  return {
    ...quote, participants, isCoInsurance: participants.length > 1 || Boolean(quote.isCoInsurance),
    brokerSlipId: slip?.id || null, brokerSlipNumber: slip?.slip_number || null, placementId: placement?.id || null, placementNumber: placement?.placement_number || null,
    placementStatus: placement?.status || null, journey,
    offers: offers.map((o) => ({ offerId: o.id, insuranceCompanyId: o.insurance_company_id, insuranceCompanyName: o.insurer_name, status: o.status, premium: o.premium === null ? null : Number(o.premium),
      rate: o.rate === null ? null : Number(o.rate), premiumTotal: o.premium_total === null ? null : Number(o.premium_total), offeredShare: Number(o.offered_share), deductibles: o.deductibles,
      validityDate: o.validity_date, selected: o.selected })),
  };
}

/**
 * Decide the underwriting referral of a quotation (acceptance rule with action Refer, or an Auto-Accept rule not met):
 * a user with one of the rules' authority roles and enough Underwriting referral authority for the sum insured
 * (authority matrix) approves it, or declines it (the quotation is then rejected). The insurer's underwriter
 * reference can be recorded with the decision.
 */
export async function decideReferral(id, { decision, remarks = null, insurerReference = null }, user) {
  const q = await getQuoteRow(id);
  const ref = q.doc?.underwritingReferral;
  if (!ref || ref.status !== 'pending') throw badRequest(`Quotation ${q.quote_number} has no pending underwriting referral`);
  if (!['approve', 'decline'].includes(decision)) throw badRequest('decision must be approve or decline');
  if (decision === 'decline' && !String(remarks || '').trim()) throw badRequest('Give the reason for declining the referral');
  assertMayDecide(user, ref);
  if (decision === 'approve') await withTransaction((db) => assertAuthority(db, user, 'underwriting_referral', Number(q.sum_insured) || 0));
  const next = { ...ref, status: decision === 'approve' ? 'approved' : 'declined', decidedBy: user.username, decidedById: user.id, decidedAt: new Date().toISOString(),
    remarks: remarks || null, insurerReference: insurerReference || null };
  await query(`UPDATE quotes SET doc = jsonb_set(doc, '{underwritingReferral}', $2::jsonb), updated_by = $3, updated_at = now()${decision === 'decline' ? ", status = 'rejected'" : ''} WHERE id = $1`,
    [q.id, JSON.stringify(next), user.id]);
  if (q.created_by && q.created_by !== user.id) {
    await notifyDecision({ userId: q.created_by, decidedBy: user.id, document: 'Quotation referral', number: q.quote_number, approved: decision === 'approve', by: user.username,
      message: `The underwriting referral of quotation ${q.quote_number} was ${decision === 'approve' ? 'approved' : 'declined'} by ${user.username}${remarks ? `: ${remarks}` : ''}`,
      link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
  }
  return { before: q, after: await getQuoteRow(q.id), referral: next };
}
