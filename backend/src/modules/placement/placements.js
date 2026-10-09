/**
 * Placement Slip (firm order). The broker never issues cover (TIS-BRD-ISSUE-01): the placement is raised (slip PDF
 * stored), sent to the insurer(s) with the slip attached, acknowledged by the insurer, the e-policy the insurer returns
 * is recorded and checked against the slip by a second user, and only then booked ("Insurer issued"): the policy is
 * created through the standard issuance routine (policies/service.js#issuePolicy), which copies the participants to the
 * policy and books the bill, journal and commission, and the policy schedule is e-mailed to the client.
 *
 * Starting points: an accepted quotation (source quote, raised automatically when the client accepts), selected broker
 * slip offers (source broker-slip) or a direct placement for a named insurer (source direct, e.g. CTPL without a quote).
 * Source direct-policy is kept only for placements recorded before the chain existed.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound, HttpError } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { companyName } from '../../lib/letterhead.js';
import { queueEmail, documentAttachment, fileAttachment } from '../../lib/mailer.js';
import { today, isoDate } from '../../lib/dates.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { notify } from '../notifications/service.js';
import { num, round2, renderTemplate, emailTemplate, amountText } from '../documents/common.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { quoteStatusOut } from '../documents/statuses.js';
import { clientFromLead, createClientInTx } from '../clients/service.js';
import { issuePolicy, getPolicyRow } from '../policies/service.js';
import { assertKyc, kycPrefill, kycValue } from '../policies/kyc.js';
import { findDocument, reserveKey, writeObject, safeKey } from '../uploads/storage.js';
import { premiumBreakdown } from '../quotations/premium.js';
import { assertNotDeclined, assertReferralCleared } from '../product-configurator/underwriting.js';
import { journeyFor, resolveLob, assertStep } from './journey.js';
import { normaliseParticipants, writeParticipants, participantsOf, participantInputs, leadOf, legacyParticipantDetails } from './participants.js';
import { getSlipRow, participantsFromOffers, riskFromSlip, assertParty, partyName } from './brokerSlips.js';
import { assertInsurersAuthorised } from '../ic-compliance/insurerAuthority.js';

export const PLACEMENT_STATUSES = ['draft', 'sent', 'acknowledged', 'epolicy_received', 'checked', 'issued', 'declined', 'cancelled'];
const LABELS = { draft: 'PlacementRaised', sent: 'SentToInsurer', acknowledged: 'Acknowledged', epolicy_received: 'EPolicyReceived', checked: 'CheckedAgainstSlip',
  issued: 'InsurerIssued', declined: 'Declined', cancelled: 'Cancelled' };
/** Statuses in which the insurer holds the order (an e-policy may be recorded, an insurer may still decline). */
const WITH_INSURER = ['sent', 'acknowledged'];
const addMonths = (d, m) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

const SELECT = `SELECT p.*, row_to_json(l.*) AS lead_row, c.display_name AS client_name, ic.name AS insurer_name, q.quote_number, q.status AS quote_status,
  b.slip_number, pol.policy_number, (SELECT u.display_name FROM users u WHERE u.id = p.created_by) AS created_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = p.acknowledged_by) AS acknowledged_by_name, (SELECT u.display_name FROM users u WHERE u.id = p.epolicy_received_by) AS epolicy_received_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = p.checked_by) AS checked_by_name, (SELECT u.display_name FROM users u WHERE u.id = p.issued_by) AS issued_by_name,
  (SELECT count(*)::int FROM risk_participants rp WHERE rp.entity_type = 'placement' AND rp.entity_id = p.id) AS participants_count,
  (SELECT count(*)::int FROM risk_participants rp WHERE rp.entity_type = 'placement' AND rp.entity_id = p.id AND rp.status = 'confirmed') AS confirmed_count
  FROM placements p LEFT JOIN leads l ON l.id = p.lead_id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN quotes q ON q.id = p.quote_id LEFT JOIN broker_slips b ON b.id = p.broker_slip_id LEFT JOIN policies pol ON pol.id = p.policy_id`;

const leadName = (l) => (l ? [l.first_name, l.last_name].filter(Boolean).join(' ') || l.company_name : null);
const taxesOf = (r) => round2(num(r.vat) + num(r.dst) + num(r.lgt) + num(r.fst));

export function toPlacement(r, participants = null) {
  if (!r) return null;
  const doc = r.doc || {};
  return {
    id: r.id, placementId: r.id, placementNumber: r.placement_number, source: r.source, quoteId: r.quote_id, quotationNumber: r.quote_number || null,
    quotationStatus: r.quote_status ? quoteStatusOut(r.quote_status) : null, brokerSlipId: r.broker_slip_id, brokerSlipNumber: r.slip_number || null,
    leadId: r.lead_id, leadRefId: r.lead_id, clientId: r.client_id, clientName: r.client_name, customerName: r.client_name || leadName(r.lead_row) || r.insured_name,
    productId: r.product_id, productType: r.product_type, lob: r.lob, insuranceCompanyId: r.insurance_company_id, insuranceCompanyName: r.insurer_name,
    insuredName: r.insured_name, doc, riskDetails: doc.riskDetails || {}, sumInsured: Number(r.sum_insured), netPremium: Number(r.premium_base),
    valueAddedTax: Number(r.vat), documentaryStampTax: Number(r.dst), localGovernmentTax: Number(r.lgt), fireServiceTax: Number(r.fst), taxes: taxesOf(r),
    accountPremiumOthers: Number(r.others), discount: Number(r.discount), grossPremium: Number(r.premium_total),
    commissionRate: r.commission_rate == null ? null : Number(r.commission_rate), commissionAmount: Number(r.commission_amount), currency: r.currency,
    inceptionDate: r.inception_date, expiryDate: r.expiry_date, billingMode: r.billing_mode, status: r.status, placementStatus: LABELS[r.status] || r.status,
    sentAt: r.sent_at, issuedAt: r.issued_at, issuedBy: r.issued_by_name || r.issued_by || null, policyId: r.policy_id, policyNumber: r.policy_number || null,
    slipDocument: r.slip_document_key ? { key: r.slip_document_key, fileName: r.slip_document_name, generatedAt: r.slip_generated_at } : null,
    acknowledgement: r.acknowledged_at ? { at: r.acknowledged_at, by: r.acknowledged_by_name || r.acknowledged_by, byId: r.acknowledged_by, reference: r.acknowledgement_reference, remarks: r.acknowledgement_remarks } : null,
    epolicy: r.epolicy_received_at ? { ...(r.epolicy || {}), documentKey: r.epolicy_document_key, documentName: r.epolicy_document_name, receivedAt: r.epolicy_received_at,
      receivedBy: r.epolicy_received_by_name || r.epolicy_received_by, receivedById: r.epolicy_received_by } : null,
    check: r.check_result ? { status: r.check_status, decision: r.check_decision, reason: r.check_reason, at: r.checked_at, by: r.checked_by_name || r.checked_by, byId: r.checked_by, ...r.check_result } : null,
    participantsCount: r.participants_count ?? null, confirmedCount: r.confirmed_count ?? null, remarks: r.remarks, cancelReason: r.cancel_reason,
    createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
    ...(participants ? { participants, isCoInsurance: participants.length > 1 } : {}),
  };
}

export async function getPlacementRow(id, db = null) {
  const r = await (db || { query }).query(`${SELECT} WHERE p.id = $1 OR p.placement_number = $1`, [String(id)]);
  if (!r.rows[0]) throw notFound('Placement slip not found');
  return r.rows[0];
}

/**
 * The journey steps of a placement with links: Broker Slip -> Quotation Slip -> Placement raised -> Sent to insurer ->
 * Acknowledged -> e-Policy received -> Checked against slip -> Insurer issued (Booked).
 */
function timeline(p, journey) {
  const step = (key, label, done, ref, id, at, mode) => ({ key, label, done, reference: ref || null, id: id || null, at: at || null, mode });
  const checked = Boolean(p.checked_at) && ['checked', 'issued'].includes(p.status);
  return [
    step('brokerSlip', 'Broker Slip', Boolean(p.broker_slip_id), p.slip_number, p.broker_slip_id, null, journey.brokerSlip),
    step('quotationSlip', 'Quotation Slip', Boolean(p.quote_id), p.quote_number, p.quote_id, null, journey.quotationSlip),
    step('placementSlip', 'Placement raised', true, p.placement_number, p.id, p.created_at, journey.placementSlip),
    step('sent', 'Sent to insurer', Boolean(p.sent_at) || p.source === 'direct-policy', null, null, p.sent_at, 'required'),
    step('acknowledged', 'Acknowledged', Boolean(p.acknowledged_at), p.acknowledgement_reference, null, p.acknowledged_at, 'required'),
    step('epolicy', 'e-Policy received', Boolean(p.epolicy_received_at) && p.status !== 'acknowledged', p.epolicy?.insurerPolicyNumber, null, p.epolicy_received_at, 'required'),
    step('checked', 'Checked against slip', checked, null, null, checked ? p.checked_at : null, 'required'),
    step('policy', 'Insurer issued (Booked)', Boolean(p.policy_id), p.policy_number, p.policy_id, p.issued_at, 'required'),
  ];
}

/** Client already created from a lead (clients.lead_id), else null. */
async function clientOfLead(leadId, db) {
  if (!leadId) return null;
  return (await (db || { query }).query('SELECT id FROM clients WHERE lead_id = $1 ORDER BY created_at LIMIT 1', [leadId])).rows[0]?.id || null;
}

export async function placementById(id, db = null) {
  const row = await getPlacementRow(id, db);
  const participants = await participantsOf('placement', row.id, db);
  const journey = await journeyFor({ lob: row.lob, productType: row.product_type, productId: row.product_id }, db);
  // identifiers already captured, to pre-fill the issue-policy dialog
  const kyc = row.policy_id ? null : await kycPrefill({ clientId: row.client_id || await clientOfLead(row.lead_id, db), quoteId: row.quote_id, placementDoc: row.doc }, db || undefined);
  return { ...toPlacement(row, participants), journey, timeline: timeline(row, journey), kycPrefill: kyc };
}

/** Premium breakdown of a direct placement: the net premium agreed with the insurer, taxes from the LOB rates. */
async function directBreakdown(body, lob, leadIc) {
  const netPremium = num(body.netPremium);
  if (!(netPremium > 0)) throw badRequest('netPremium (the premium agreed with the insurer) is required');
  return premiumBreakdown({ ...(body.doc || {}), riskDetails: body.riskDetails || {}, productId: body.productId || null, lob, productType: body.productType, agreedNetPremium: netPremium, totalSumInsured: num(body.sumInsured), commissionRate: body.commissionRate,
    discount: body.discount, accountPremiumOthers: body.accountPremiumOthers, includeCTPL: false, autoPassengerPersonalAccident: '' }, { insurerId: leadIc });
}

const premiumCols = (b) => ({ sum_insured: b.totalSumInsured, premium_base: b.netPremium, vat: b.valueAddedTax, dst: b.documentaryStampTax, lgt: b.localGovernmentTax,
  fst: b.fireServiceTax, others: b.accountPremiumOthers, discount: b.discount, premium_total: b.grossPremium, commission_rate: b.commissionRate,
  commission_amount: b.commissionAmount, currency: b.currency });
const colsTotals = (c) => ({ sumInsured: c.sum_insured, premium: c.premium_base, taxes: taxesOf(c), premiumTotal: c.premium_total, commissionAmount: c.commission_amount });

async function period(body, fallbackInception = null) {
  const inception = isoDate(body.inceptionDate || body.inception) || fallbackInception || await today();
  const expiry = isoDate(body.expiryDate || body.expiry) || addMonths(inception, Number(await getSetting('policies.default_term_months', 12)));
  if (expiry <= inception) throw badRequest('expiryDate must be after inceptionDate');
  return { inception, expiry };
}

/**
 * The placement file: the placement slip PDF (all participants) stored with the placement, generated when it is raised and
 * again when it is edited, so the file in the record is the order the insurer receives.
 */
export async function storeSlipDocument(id, userId) {
  const { buildPdf } = await import('../documents/pdf.js');
  const { placementSlipDoc } = await import('../documents/templates.js');
  const p = await placementById(id);
  const fileName = `placement-slip-${p.placementNumber}.pdf`;
  const key = await reserveKey({ folder: 'placement-slips', fileName, contentType: 'application/pdf', userId, entity: 'placement', entityId: p.id });
  await writeObject(key, buildPdf(await placementSlipDoc(p)), 'application/pdf');
  await query('UPDATE placements SET slip_document_key = $2, slip_document_name = $3, slip_generated_at = now() WHERE id = $1', [p.id, key, fileName]);
  return { key, fileName };
}

async function insertPlacement(db, data, parts, userId, participantStatus) {
  const number = await nextDocumentNumber('placement', { db, unique: { table: 'placements', column: 'placement_number' } });
  const row = { placement_number: number, owner_user_id: userId, created_by: userId, ...data };
  const keys = Object.keys(row);
  const r = await db.query(`INSERT INTO placements(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(row));
  await writeParticipants(db, 'placement', r.rows[0].id, parts, colsTotals(row), { userId, status: participantStatus, commissionRate: row.commission_rate ?? null });
  return r.rows[0].id;
}

/** Placement data for a quotation (Quotation Slip -> Placement Slip). */
async function fromQuote(db, body, user) {
  const { getQuoteRow } = await import('../quotations/service.js');
  const q = await getQuoteRow(body.quoteId, db);
  // one placement per quotation even when the acceptance and a user raise it at the same moment
  await db.query('SELECT id FROM quotes WHERE id = $1 FOR UPDATE', [q.id]);
  const allowed = await getSetting('placement.quote_statuses', ['CustomerAccepted', 'SubmittedToInsurer', 'Approved']);
  if (!allowed.includes(quoteStatusOut(q.status))) throw badRequest(`A placement slip can be created from a ${allowed.join(' / ')} quotation (current: ${quoteStatusOut(q.status)})`);
  const journey = await journeyFor({ lob: q.lob, productType: q.product_type, productId: q.product_id }, db);
  assertStep(journey, 'placementSlip', ['skip'], `The ${journey.lob} placement journey skips the Placement Slip: convert the quotation to a policy directly`);
  assertReferralCleared(q, 'placement');
  const open = (await db.query("SELECT placement_number FROM placements WHERE quote_id = $1 AND status NOT IN ('cancelled','declined')", [q.id])).rows[0];
  if (open) throw conflict(`Quotation ${q.quote_number} already has placement slip ${open.placement_number}`);
  let parts = body.participants?.length ? await normaliseParticipants(body.participants, { db }) : await participantInputs('quote', q.id, db);
  if (!parts.length && q.insurance_company_id) parts = [{ insuranceCompanyId: q.insurance_company_id, sharePercent: 100, isLead: true, commissionRate: null, insurerReference: null }];
  if (!parts.length) throw badRequest('The quotation names no insurer: add the participating insurer(s)');
  const { renewalTerm } = await import('../quotations/service.js');
  const renewal = await renewalTerm(db, q);
  const { inception, expiry } = await period(body, renewal.inception || isoDate(q.doc?.inception || q.doc?.inceptionDate || q.doc?.policyStartDate));
  const doc = { ...(q.doc || {}), valueAddedTax: Number(q.vat), documentaryStampTax: Number(q.dst), localGovernmentTax: Number(q.lgt), fireServiceTax: Number(q.fst),
    discount: Number(q.discount), accountPremiumOthers: Number(q.others) };
  return {
    parts, data: {
      source: 'quote', quote_id: q.id, broker_slip_id: q.broker_slip_id || null, lead_id: q.lead_id, client_id: q.client_id, product_id: q.product_id, policy_type_id: q.policy_type_id,
      product_type: q.product_type, lob: await resolveLob({ lob: q.lob, productId: q.product_id, productType: q.product_type }, db),
      insured_name: body.insuredName || q.doc?.insuredName || leadName(q.lead_row) || await partyName(db, { clientId: q.client_id }), doc: JSON.stringify(doc),
      sum_insured: q.sum_insured, premium_base: q.premium_base, vat: q.vat, dst: q.dst, lgt: q.lgt, fst: q.fst, others: q.others, discount: q.discount,
      premium_total: q.premium_total, commission_rate: q.commission_rate, commission_amount: q.commission_amount, currency: q.currency,
      inception_date: inception, expiry_date: expiry, billing_mode: body.billingMode || renewal.expiring?.billing_mode || null, remarks: body.remarks || null,
      owner_user_id: q.agent_user_id || q.created_by || user.id,
    },
  };
}

/** Placement data from selected broker slip offers (Broker Slip -> Placement Slip, quotation optional or skipped). */
async function fromBrokerSlip(db, body) {
  const slip = await getSlipRow(body.brokerSlipId, db);
  if (!['submitted', 'responses-in'].includes(slip.status)) throw conflict(`A placement slip can be prepared only from a submitted broker slip with offers (current: ${slip.status})`);
  const journey = await journeyFor({ lob: slip.lob, productType: slip.product_type, productId: slip.product_id }, db);
  assertStep(journey, 'quotationSlip', ['required'], `The ${journey.lob} placement journey requires a Quotation Slip: prepare the quotation from the offers first`);
  assertStep(journey, 'placementSlip', ['skip'], `The ${journey.lob} placement journey skips the Placement Slip`);
  const { parts, lead, chosen } = await participantsFromOffers(slip, body);
  const risk = riskFromSlip(slip, lead);
  const b = await premiumBreakdown({ ...risk, includeCTPL: false }, { insurerId: lead.insuranceCompanyId });
  assertNotDeclined(b.underwriting, 'The placement');
  const { inception, expiry } = await period(body, slip.inception_date);
  await db.query('UPDATE insurer_offers SET selected = (id = ANY($2)), updated_at = now() WHERE broker_slip_id = $1', [slip.id, chosen.map((o) => o.id)]);
  await db.query("UPDATE broker_slips SET status = 'closed', updated_at = now() WHERE id = $1", [slip.id]);
  return {
    parts, data: {
      source: 'broker-slip', broker_slip_id: slip.id, lead_id: slip.lead_id, client_id: slip.client_id, product_id: slip.product_id, product_type: slip.product_type, lob: slip.lob,
      insured_name: body.insuredName || slip.insured_name, doc: JSON.stringify({ ...risk, premiumBreakdown: b, valueAddedTax: b.valueAddedTax, documentaryStampTax: b.documentaryStampTax,
        localGovernmentTax: b.localGovernmentTax, fireServiceTax: b.fireServiceTax }), ...premiumCols(b), sum_insured: Number(slip.sum_insured) || b.totalSumInsured,
      inception_date: inception, expiry_date: expiry, billing_mode: body.billingMode || null, remarks: body.remarks || null,
    },
  };
}

/**
 * Products placed without a quotation that need the LTO document / official receipt (placement.direct_document_products,
 * TIS-BRD-QUOT-01: a TPL direct policy): the uploaded file (doc.ltoDocumentKey) goes to the insurer with the slip.
 */
async function assertDirectDocuments(db, productId, body) {
  const codes = ((await getSetting('placement.direct_document_products', [])) || []).map((c) => String(c).toUpperCase());
  if (!codes.length) return;
  const product = (await db.query('SELECT code, name FROM products WHERE ($1::int IS NOT NULL AND id = $1::int) OR ($2::text IS NOT NULL AND (lower(code) = lower($2) OR lower(name) = lower($2))) LIMIT 1',
    [productId, body.productType || null])).rows[0];
  if (!product || !codes.includes(String(product.code).toUpperCase())) return;
  const key = body.doc?.ltoDocumentKey;
  if (!key) throw badRequest(`A ${product.name} placed without a quotation needs the LTO document or official receipt (doc.ltoDocumentKey)`, [{ path: 'doc.ltoDocumentKey', message: 'LTO document is required' }]);
  if (!(await findDocument(key))) throw badRequest('The LTO document was not found; upload it again', [{ path: 'doc.ltoDocumentKey', message: 'Unknown file' }]);
}

/** Direct placement: client + product + insurer(s) + risk + agreed premium, no quotation. */
async function direct(db, body, user, { source = 'direct', checkJourney = true } = {}) {
  let clientId = body.clientId || null;
  if (!clientId && !body.leadRefId) {
    if (!body.firstName && !body.companyName && !body.insuredName) throw badRequest('A client (clientId), a lead (leadRefId) or the new insured (firstName / companyName) is required');
    const [first, ...rest] = String(body.insuredName || '').trim().split(/\s+/);
    clientId = await createClientInTx(db, { firstName: body.firstName || (body.companyName ? undefined : first), lastName: body.lastName || (body.companyName ? undefined : rest.join(' ') || undefined),
      companyName: body.companyName, emailId: body.emailId || body.email, contactNumber: body.contactNumber, source: source === 'direct-policy' ? 'direct-policy' : 'direct-placement',
      leadCategory: body.companyName ? 'Corporate' : 'Retail' }, user.id);
  } else await assertParty(db, { leadRefId: body.leadRefId, clientId });
  const productId = body.productId ? Number(body.productId) : null;
  const lob = await resolveLob({ lob: body.lob, productId, productType: body.productType }, db);
  if (checkJourney) {
    const journey = await journeyFor({ lob, productType: body.productType, productId }, db);
    assertStep(journey, 'quotationSlip', ['required'], `The ${journey.lob} placement journey requires a Quotation Slip: place the risk from an accepted quotation`);
    assertStep(journey, 'placementSlip', ['skip'], `The ${journey.lob} placement journey skips the Placement Slip`);
  }
  await assertDirectDocuments(db, productId, body);
  const parts = await normaliseParticipants(body.participants || (body.insuranceCompanyId || body.insuranceCompanyName ? [{ insuranceCompanyId: body.insuranceCompanyId, insuranceCompanyName: body.insuranceCompanyName, sharePercent: 100 }] : []), { db });
  const b = await directBreakdown(body, lob, leadOf(parts).insuranceCompanyId);
  assertNotDeclined(b.underwriting, 'The placement');
  const { inception, expiry } = await period(body);
  const doc = { ...(body.doc || {}), riskDetails: body.riskDetails || {}, premiumBreakdown: b, valueAddedTax: b.valueAddedTax, documentaryStampTax: b.documentaryStampTax,
    localGovernmentTax: b.localGovernmentTax, fireServiceTax: b.fireServiceTax, discount: b.discount, productType: body.productType };
  return {
    parts, data: {
      source, lead_id: body.leadRefId || null, client_id: clientId, product_id: productId, product_type: body.productType || null, lob,
      insured_name: body.insuredName || await partyName(db, { leadRefId: body.leadRefId, clientId }), doc: JSON.stringify(doc), ...premiumCols(b),
      inception_date: inception, expiry_date: expiry, billing_mode: body.billingMode || null, remarks: body.remarks || null,
    },
  };
}

export async function createPlacement(body, user) {
  const id = await withTransaction(async (db) => {
    const { parts, data } = body.quoteId ? await fromQuote(db, body, user) : body.brokerSlipId ? await fromBrokerSlip(db, body) : await direct(db, body, user);
    data.insurance_company_id = leadOf(parts).insuranceCompanyId;
    data.doc = JSON.stringify({ ...JSON.parse(data.doc), participantDetails: await legacyParticipantDetails(parts, db, data.currency), isCoInsurance: parts.length > 1 });
    return insertPlacement(db, data, parts, user.id, 'pending');
  });
  await storeSlipDocument(id, user.id);
  return placementById(id);
}

/**
 * Raise the placement slip of a quotation the client has just accepted (placement.auto_raise, statuses in
 * placement.auto_raise_statuses; TIS-BRD-ISSUE-01) when its journey requires a Placement Slip. Idempotent: nothing
 * happens when the quotation already has an open placement slip. The acceptance is never undone: when the placement
 * cannot be raised (no insurer named, referral not cleared) the quotation's owner is told why and raises it once that
 * is fixed.
 */
export async function autoRaisePlacement(quoteId, user) {
  if (!(await getSetting('placement.auto_raise', true))) return null;
  const q = await one('SELECT id, quote_number, status, lob, product_type, product_id, doc, created_by FROM quotes WHERE id = $1', [quoteId]);
  const statuses = (await getSetting('placement.auto_raise_statuses', ['CustomerAccepted'])) || [];
  if (!q || !statuses.includes(quoteStatusOut(q.status))) return null;
  if (q.doc?.renewal?.policyId && !(await getSetting('placement.journey_applies_to_renewals', true))) return null;
  const journey = await journeyFor({ lob: q.lob, productType: q.product_type, productId: q.product_id });
  if (journey.placementSlip !== 'required') return null;
  if (await one("SELECT 1 FROM placements WHERE quote_id = $1 AND status NOT IN ('cancelled','declined')", [q.id])) return null;
  try {
    return await createPlacement({ quoteId: q.id }, user);
  } catch (e) {
    if (!(e instanceof HttpError) || e.status >= 500) throw e;
    if (e.status === 409) return null;
    await notify({ userId: q.created_by || user.id, type: 'task', title: 'Placement slip not raised', message: `Quotation ${q.quote_number} was accepted but its placement slip could not be raised: ${e.message}`,
      link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id });
    return null;
  }
}

/** Edit a draft (or declined) placement: period, billing mode, remarks, the agreed premium and the participants. */
export async function updatePlacement(id, body, user) {
  const before = await getPlacementRow(id);
  const editable = await getSetting('placement.editable_statuses', ['draft', 'declined']);
  if (!editable.includes(before.status)) throw conflict(`A ${LABELS[before.status] || before.status} placement slip cannot be edited`);
  await withTransaction(async (db) => {
    const cols = {};
    if (body.inceptionDate || body.expiryDate) {
      const { inception, expiry } = await period({ inceptionDate: body.inceptionDate || before.inception_date, expiryDate: body.expiryDate || (body.inceptionDate ? null : before.expiry_date) });
      Object.assign(cols, { inception_date: inception, expiry_date: expiry });
    }
    if (body.billingMode !== undefined) cols.billing_mode = body.billingMode || null;
    if (body.remarks !== undefined) cols.remarks = body.remarks || null;
    if (body.insuredName) cols.insured_name = body.insuredName;
    // participants validated again (a declined insurer drops out, so the remaining shares must be re-arranged to 100%)
    const parts = await normaliseParticipants(body.participants || await participantInputs('placement', before.id, db), { db });
    let doc = { ...(before.doc || {}) };
    if (body.riskDetails !== undefined) doc.riskDetails = body.riskDetails || {};
    if (body.netPremium !== undefined || body.discount !== undefined || body.commissionRate !== undefined || body.sumInsured !== undefined) {
      const b = await directBreakdown({ productType: before.product_type, netPremium: body.netPremium ?? before.premium_base, sumInsured: body.sumInsured ?? before.sum_insured,
        commissionRate: body.commissionRate ?? before.commission_rate, discount: body.discount ?? before.discount, accountPremiumOthers: body.accountPremiumOthers ?? before.others },
      before.lob, leadOf(parts).insuranceCompanyId);
      Object.assign(cols, premiumCols(b));
      doc = { ...doc, premiumBreakdown: b, valueAddedTax: b.valueAddedTax, documentaryStampTax: b.documentaryStampTax, localGovernmentTax: b.localGovernmentTax, fireServiceTax: b.fireServiceTax, discount: b.discount };
    }
    cols.insurance_company_id = leadOf(parts).insuranceCompanyId;
    cols.doc = JSON.stringify({ ...doc, participantDetails: await legacyParticipantDetails(parts, db, before.currency), isCoInsurance: parts.length > 1 });
    if (before.status === 'declined') cols.status = 'draft';
    const keys = Object.keys(cols);
    await db.query(`UPDATE placements SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`, [before.id, ...Object.values(cols), user.id]);
    const after = (await db.query('SELECT * FROM placements WHERE id = $1', [before.id])).rows[0];
    // a re-edited participant is asked again; confirmations of insurers whose share did not change are kept
    const prev = new Map((await participantInputs('placement', before.id, db)).map((p) => [p.insuranceCompanyId, p.sharePercent]));
    const rows = parts.map((p) => (prev.get(p.insuranceCompanyId) === p.sharePercent ? p : { ...p, status: 'pending', confirmedAt: null }));
    await db.query("UPDATE risk_participants SET status = 'pending', confirmed_at = NULL WHERE entity_type = 'placement' AND entity_id = $1 AND status = 'declined'", [before.id]);
    await writeParticipants(db, 'placement', before.id, rows, colsTotals(after), { userId: user.id, status: 'pending', commissionRate: after.commission_rate });
  });
  await storeSlipDocument(before.id, user.id);
  return { before: toPlacement(before), after: await placementById(before.id) };
}

/**
 * Placement raised -> Sent to insurer: queue the firm order to each participating insurer, showing its own share, with
 * its placement slip PDF and any LTO document attached. A sent or acknowledged placement can be sent again (a corrected
 * e-policy requested); the status does not go back.
 */
export async function sendPlacement(id, user, { insurerIds = null } = {}) {
  const p = await placementById(id);
  if (!['draft', ...WITH_INSURER].includes(p.status)) throw conflict(`A ${p.placementStatus} placement slip cannot be sent`);
  const toSend = p.participants.filter((r) => r.status !== 'declined' && (!insurerIds || insurerIds.map(Number).includes(Number(r.insuranceCompanyId))));
  await assertInsurersAuthorised(toSend.map((r) => r.insuranceCompanyId), 'order', { entity: 'placement', entityId: p.id });
  const t = await emailTemplate('placement_order');
  const company = await companyName();
  const lto = p.doc?.ltoDocumentKey ? [fileAttachment(p.doc.ltoDocumentKey, p.doc.ltoDocumentName || 'lto-document.pdf')] : [];
  const sent = [];
  const failed = [];
  for (const x of toSend) {
    if (!x.insurerEmail) { failed.push({ insurer: x.insuranceCompanyName, reason: 'No contact e-mail on the insurer record' }); continue; }
    const v = { companyName: company, placementNumber: p.placementNumber, insuredName: p.insuredName || '', productType: p.productType || p.lob, currency: p.currency,
      period: `${p.inceptionDate} to ${p.expiryDate}`, sumInsured: amountText(p.sumInsured), insurerName: x.insuranceCompanyName, sharePercent: x.sharePercent,
      role: x.isLead ? 'lead insurer' : 'co-insurer', shareSumInsured: amountText(x.sumInsured), sharePremium: amountText(x.premium), sharePremiumTotal: amountText(x.premiumTotal) };
    const slip = documentAttachment('placement-slip', { placementId: p.id, insurerId: x.insuranceCompanyId }, `placement-slip-${p.placementNumber}-${x.insurerCode || x.insuranceCompanyId}.pdf`);
    const emailId = await queueEmail({ to: x.insurerEmail, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'placement_order', entity: 'placement', entityId: p.id,
      attachments: [slip, ...lto] });
    sent.push({ insurer: x.insuranceCompanyName, email: x.insurerEmail, emailId });
  }
  if (!sent.length && failed.length) throw badRequest(`No insurer could be e-mailed: ${failed.map((f) => `${f.insurer} (${f.reason})`).join('; ')}`);
  await query("UPDATE placements SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, now()), updated_by = $2, updated_at = now() WHERE id = $1", [p.id, user.id]);
  // the quotation the placement comes from is now with the insurer(s)
  if (p.quoteId) await query("UPDATE quotes SET status = 'submitted', submitted_to_insurer_at = now(), submitted_by = $2, updated_at = now() WHERE id = $1 AND status = 'accepted'", [p.quoteId, user.id]);
  return { sent, failed, placement: await placementById(p.id) };
}

/** Sent to insurer -> Acknowledged: the insurer confirmed receipt of the order (its reference and remark). */
export async function acknowledgePlacement(id, { reference = null, acknowledgedAt = null, remarks = null }, user) {
  const p = await getPlacementRow(id);
  if (p.status !== 'sent') throw conflict(`Only a placement slip sent to the insurer can be acknowledged (placement status: ${LABELS[p.status] || p.status})`);
  await query(`UPDATE placements SET status = 'acknowledged', acknowledged_at = COALESCE($2::timestamptz, now()), acknowledged_by = $3, acknowledgement_reference = $4,
    acknowledgement_remarks = $5, updated_by = $3, updated_at = now() WHERE id = $1`, [p.id, acknowledgedAt || null, user.id, reference || null, remarks || null]);
  return placementById(p.id);
}

/** An insurer declines its line: the placement is Declined until the participants are re-arranged (edit) or it is cancelled. */
export async function declineParticipant(id, { insuranceCompanyId, reason }, user) {
  const p = await getPlacementRow(id);
  if (!['draft', ...WITH_INSURER].includes(p.status)) throw conflict(`A ${LABELS[p.status] || p.status} placement slip cannot be changed`);
  const r = await query(`UPDATE risk_participants SET status = 'declined', remarks = $3, confirmed_at = NULL, updated_at = now()
    WHERE entity_type = 'placement' AND entity_id = $1 AND insurance_company_id = $2`, [p.id, Number(insuranceCompanyId), reason || null]);
  if (!r.rowCount) throw badRequest(`Insurer ${insuranceCompanyId} is not a participant of placement ${p.placement_number}`);
  await query("UPDATE placements SET status = 'declined', updated_by = $2, updated_at = now() WHERE id = $1", [p.id, user.id]);
  return placementById(p.id);
}

export async function cancelPlacement(id, reason, user) {
  const p = await getPlacementRow(id);
  if (['issued', 'cancelled'].includes(p.status)) throw conflict(`A ${LABELS[p.status]} placement slip cannot be cancelled`);
  await query("UPDATE placements SET status = 'cancelled', cancel_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1", [p.id, reason || null, user.id]);
  return { before: toPlacement(p), after: await placementById(p.id) };
}

// ---------------------------------------------------------------- e-policy and check against the slip

const VEHICLE_ITEMS = { chassisNumber: 'Chassis number', motorNumber: 'Engine / motor number', plateNumber: 'Plate number', mvFileNumber: 'MV file number' };
/** A vehicle identifier still to be given: empty, N/A or TBA ("to be advised", allowed on a quotation only). */
const unknown = (v) => v === undefined || v === null || ['', 'N/A', 'TBA'].includes(String(v).trim().toUpperCase());
const sameText = (a, b) => String(a).trim().replace(/\s+/g, ' ').toUpperCase() === String(b).trim().replace(/\s+/g, ' ').toUpperCase();
const given = (v) => v !== undefined && v !== null && v !== '';

/**
 * Vehicle identifiers of the risk, carried without re-keying (TIS-BRD-ISSUE-02): the placement's copy of the quotation,
 * then what the quotation has gained since (the identifiers captured after the client accepted). TBA counts as not known.
 */
async function slipVehicle(row) {
  const d = row.doc || {};
  const q = row.quote_id ? await one('SELECT doc, vehicle FROM quotes WHERE id = $1', [row.quote_id]) : null;
  const v = q?.vehicle || {};
  const sources = [d.riskDetails, d, d.insuranceVehicleDetails?.[0], v, { chassisNumber: v.chassisNo, motorNumber: v.engineNo, plateNumber: v.plateNo }, q?.doc, q?.doc?.insuranceVehicleDetails?.[0]]
    .map((x) => (x ? Object.fromEntries(Object.entries(x).filter(([, val]) => !unknown(val))) : x));
  return Object.fromEntries(Object.keys(VEHICLE_ITEMS).map((k) => {
    const v = kycValue(sources, k);
    return [k, unknown(v) ? null : v];
  }));
}
const slipDeductible = (row) => {
  const d = row.doc || {};
  const v = d.deductible ?? d.deductibles ?? d.riskDetails?.deductible ?? d.insuranceVehicleDetails?.[0]?.deductible;
  return given(v) ? String(v) : null;
};

/**
 * Compare the e-policy with the slip (placement.check_fields): amounts within the tolerance (the larger of
 * placement.check_tolerance_amount and placement.check_tolerance_pct of the slip amount), the period, the insured, the
 * vehicle identifiers and the deductible exactly. Items: { key, label, slip, epolicy, difference, status } with status
 * match | mismatch | captured (a value the slip did not have, e.g. a plate number the quote gave as TBA) | carried (taken
 * from the slip) | not-given (an optional amount the e-policy does not state).
 */
export async function compareWithSlip(row) {
  const ep = row.epolicy || {};
  const fields = (await getSetting('placement.check_fields', ['netPremium', 'grossPremium', 'sumInsured', 'commissionAmount', 'period', 'insuredName', 'vehicle', 'deductible'])) || [];
  const amount = Number(await getSetting('placement.check_tolerance_amount', 1)) || 0;
  const pct = Number(await getSetting('placement.check_tolerance_pct', 0)) || 0;
  const items = [];
  const money = (key, label, slip) => {
    if (!fields.includes(key)) return;
    if (!given(ep[key])) { items.push({ key, label, slip: num(slip), epolicy: null, difference: null, status: 'not-given' }); return; }
    const difference = round2(num(ep[key]) - num(slip));
    const allowed = Math.max(amount, Math.abs(num(slip)) * pct / 100);
    items.push({ key, label, slip: num(slip), epolicy: num(ep[key]), difference, status: Math.abs(difference) <= allowed + 0.000001 ? 'match' : 'mismatch' });
  };
  const text = (key, label, slip, value) => {
    if (!given(value)) items.push({ key, label, slip, epolicy: null, difference: null, status: given(slip) ? 'carried' : 'not-given' });
    else if (!given(slip)) items.push({ key, label, slip: null, epolicy: value, difference: null, status: 'captured' });
    else items.push({ key, label, slip, epolicy: value, difference: null, status: sameText(slip, value) ? 'match' : 'mismatch' });
  };
  money('netPremium', 'Net premium', row.premium_base);
  money('grossPremium', 'Gross premium', row.premium_total);
  money('sumInsured', 'Sum insured', row.sum_insured);
  money('commissionAmount', 'Commission', row.commission_amount);
  if (fields.includes('period')) {
    text('effectiveDate', 'Effective date', isoDate(row.inception_date), isoDate(ep.effectiveDate));
    text('expiryDate', 'Expiry date', isoDate(row.expiry_date), isoDate(ep.expiryDate));
  }
  if (fields.includes('insuredName')) text('insuredName', 'Insured', row.insured_name, ep.participantName);
  if (fields.includes('vehicle')) {
    const slip = await slipVehicle(row);
    for (const [k, label] of Object.entries(VEHICLE_ITEMS)) if (slip[k] || !unknown(ep.vehicle?.[k])) text(k, label, slip[k], unknown(ep.vehicle?.[k]) ? null : ep.vehicle[k]);
  }
  if (fields.includes('deductible') && (slipDeductible(row) || given(ep.deductible))) text('deductible', 'Deductible', slipDeductible(row), ep.deductible);
  const differences = items.filter((i) => i.status === 'mismatch');
  return { result: differences.length ? 'mismatch' : 'match', tolerance: { amount, percent: pct }, items, differences: differences.map((i) => i.key) };
}

const differenceText = (cmp) => cmp.items.filter((i) => i.status === 'mismatch')
  .map((i) => `${i.label}: slip ${i.slip ?? '-'}, e-policy ${i.epolicy ?? '-'}${i.difference != null ? ` (difference ${i.difference})` : ''}`).join('; ');

/**
 * e-Policy received: the issued policy the insurer returned is uploaded (documentKey, from POST /s3/upload) and its
 * figures keyed (TIS-BRD-ISSUE-02): insurer and BrokerVerse policy numbers, participant name, sum insured, premium,
 * commission, issue / issuance / effective / production dates, vehicle identifiers (registration mandatory for motor
 * even where the quotation said TBA) and an optional vehicle photo. The system compares it with the slip at once.
 */
export async function recordEpolicy(id, body, user) {
  const p = await getPlacementRow(id);
  if (!WITH_INSURER.includes(p.status)) throw conflict(`An e-policy is recorded against a placement slip sent to the insurer (placement status: ${LABELS[p.status] || p.status})`);
  const document = await findDocument(body.documentKey);
  if (!document) throw badRequest('The e-policy file was not found; upload it again', [{ path: 'documentKey', message: 'Unknown file' }]);
  if (body.vehiclePhotoKey && !(await findDocument(body.vehiclePhotoKey))) throw badRequest('The vehicle photo was not found; upload it again', [{ path: 'vehiclePhotoKey', message: 'Unknown file' }]);
  const slip = await slipVehicle(p);
  const vehicle = Object.fromEntries(Object.keys(VEHICLE_ITEMS).map((k) => [k, unknown(body.vehicle?.[k]) ? slip[k] : String(body.vehicle[k]).trim()]));
  if (p.lob === 'MOTOR' && !vehicle.plateNumber && !vehicle.mvFileNumber) {
    throw badRequest('The plate number or MV file number is required on the policy, even where the quotation gave it as TBA', [{ path: 'vehicle.plateNumber', message: 'Registration details are required' }]);
  }
  if (body.brokerPolicyNumber && await one('SELECT 1 FROM policies WHERE policy_number = $1', [body.brokerPolicyNumber])) throw conflict(`Policy number ${body.brokerPolicyNumber} already exists`);
  const epolicy = {
    insurerPolicyNumber: body.insurerPolicyNumber.trim(), brokerPolicyNumber: body.brokerPolicyNumber || null, participantName: body.participantName.trim(),
    sumInsured: num(body.sumInsured), netPremium: num(body.netPremium), grossPremium: given(body.grossPremium) ? num(body.grossPremium) : null,
    commissionAmount: given(body.commissionAmount) ? num(body.commissionAmount) : null, issueDate: isoDate(body.issueDate), issuanceDate: isoDate(body.issuanceDate) || await today(),
    effectiveDate: isoDate(body.effectiveDate), expiryDate: isoDate(body.expiryDate) || isoDate(p.expiry_date), productionDate: isoDate(body.productionDate) || null,
    deductible: body.deductible || null, vehicle: p.lob === 'MOTOR' || Object.values(vehicle).some(Boolean) ? vehicle : null,
    vehiclePhotoKey: body.vehiclePhotoKey || null, vehiclePhotoName: body.vehiclePhotoName || null, remarks: body.remarks || null,
  };
  if (epolicy.expiryDate <= epolicy.effectiveDate) throw badRequest('expiryDate must be after effectiveDate');
  const cmp = await compareWithSlip({ ...p, epolicy });
  await withTransaction(async (db) => {
    await db.query(`UPDATE placements SET status = 'epolicy_received', epolicy = $2, epolicy_document_key = $3, epolicy_document_name = $4, epolicy_received_at = now(), epolicy_received_by = $5,
      acknowledged_at = COALESCE(acknowledged_at, now()), acknowledged_by = COALESCE(acknowledged_by, $5), check_status = $6, check_result = $7, check_decision = NULL, check_reason = NULL,
      checked_at = NULL, checked_by = NULL, updated_by = $5, updated_at = now() WHERE id = $1`,
    [p.id, JSON.stringify(epolicy), document.storage_key, body.documentName || document.file_name, user.id, cmp.result, JSON.stringify(cmp)]);
    // the insurers' policy / certificate numbers: the lead's is the e-policy number unless given per participant
    const refs = new Map((body.participants || []).filter((x) => x.insurerReference).map((x) => [Number(x.insuranceCompanyId), String(x.insurerReference).trim()]));
    for (const x of await participantsOf('placement', p.id, db)) {
      if (x.status === 'declined') continue;
      const ref = refs.get(Number(x.insuranceCompanyId)) || (x.isLead ? epolicy.insurerPolicyNumber : x.insurerReference);
      await db.query("UPDATE risk_participants SET status = 'confirmed', insurer_reference = $2, confirmed_at = now(), confirmed_by = $3, updated_at = now() WHERE id = $1", [x.participantId, ref || null, user.id]);
    }
    await db.query("UPDATE documents SET entity = 'placement', entity_id = $2 WHERE storage_key = ANY($1) AND entity IS NULL", [[document.storage_key, body.vehiclePhotoKey ? safeKey(body.vehiclePhotoKey) : null].filter(Boolean), p.id]);
  });
  return placementById(p.id);
}

/**
 * Decision on the check against the slip (maker-checker: never the user who recorded the e-policy, when
 * placement.check_maker_checker is on). confirm: the e-policy matches -> Checked. accept: differences accepted with a
 * reason by an approver (write:policies) -> Checked. return: the e-policy goes back to the insurer with the differences
 * (e-mail to the lead insurer) and the placement waits for a corrected e-policy (Acknowledged).
 */
export async function checkPlacement(id, { decision, reason = null }, user) {
  const p = await getPlacementRow(id);
  if (p.status !== 'epolicy_received') throw conflict(`Only a placement slip with its e-policy received can be checked (placement status: ${LABELS[p.status] || p.status})`);
  if (await getSetting('placement.check_maker_checker', true) && p.epolicy_received_by === user.id) {
    throw forbidden('Maker-checker: the check against the slip must be confirmed by a user other than the one who recorded the e-policy');
  }
  const cmp = await compareWithSlip(p);
  if (decision === 'confirm' && cmp.result === 'mismatch') {
    throw conflict(`The e-policy does not match the slip (${differenceText(cmp)}): return it to the insurer or accept the differences with a reason`);
  }
  if (decision === 'accept' && !hasPermission(user, 'write:policies')) throw forbidden('Accepting an e-policy that differs from the slip needs an approver with policy issuance rights (write:policies)');
  if (decision !== 'confirm' && !String(reason || '').trim()) throw badRequest('A reason is required', [{ path: 'reason', message: 'Give the reason' }]);
  const status = decision === 'return' ? 'acknowledged' : 'checked';
  const recorded = { confirm: 'confirmed', accept: 'accepted', return: 'returned' }[decision];
  await query(`UPDATE placements SET status = $2, check_status = $3, check_result = $4, check_decision = $5, check_reason = $6, checked_at = now(), checked_by = $7,
    updated_by = $7, updated_at = now() WHERE id = $1`, [p.id, status, cmp.result, JSON.stringify(cmp), recorded, reason || null, user.id]);
  let mail = null;
  if (decision === 'return') {
    const lead = (await participantsOf('placement', p.id)).find((x) => x.isLead);
    if (lead?.insurerEmail) {
      const t = await emailTemplate('placement_discrepancy');
      const v = { companyName: await companyName(), placementNumber: p.placement_number, insurerPolicyNumber: p.epolicy?.insurerPolicyNumber || '', insurerName: lead.insuranceCompanyName,
        insuredName: p.insured_name || '', productType: p.product_type || p.lob, differences: differenceText(cmp) || 'see the remark below', reason };
      mail = { to: lead.insurerEmail, emailId: await queueEmail({ to: lead.insurerEmail, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v),
        template: 'placement_discrepancy', entity: 'placement', entityId: p.id }) };
    }
  }
  return { placement: await placementById(p.id), comparison: cmp, mail };
}

// ---------------------------------------------------------------- booking (Insurer issued)

/** Book the checked placement inside the caller's transaction: issuePolicy with the placement as source and the e-policy's numbers and dates. */
async function bookInTx(db, placementId, body, user) {
  const p = (await db.query('SELECT * FROM placements WHERE id = $1 FOR UPDATE', [placementId])).rows[0];
  if (p.status === 'issued') throw conflict('The policy was already booked from this placement slip');
  if (p.status !== 'checked') {
    throw conflict(`The policy is booked only once the insurer has issued it and its e-policy has been checked against the slip (placement status: ${LABELS[p.status] || p.status})`);
  }
  const ep = p.epolicy || {};
  const quote = p.quote_id ? (await db.query('SELECT * FROM quotes WHERE id = $1', [p.quote_id])).rows[0] : null;
  const extra = body.additionalPolicyData && typeof body.additionalPolicyData === 'object' ? { ...body.additionalPolicyData } : { ...body };
  delete extra.policyNumber;
  const clientId = p.client_id || (p.lead_id ? await clientFromLead(db, p.lead_id, extra.customerInfo || {}, p.owner_user_id || user.id) : null);
  if (!clientId) throw badRequest('The placement slip has no lead or client to insure');
  const { RESERVED } = await import('../quotations/shape.js');
  const { renewalTerm, linkRenewal } = await import('../quotations/service.js');
  const renewal = quote ? await renewalTerm(db, quote) : { renewalOf: null };
  const doc = Object.fromEntries(Object.entries(p.doc || {}).filter(([k]) => !RESERVED.includes(k)));
  const received = { insurerPolicyNumber: ep.insurerPolicyNumber, issuanceDate: ep.issuanceDate, productionDate: ep.productionDate || await today(), epolicyDocumentKey: p.epolicy_document_key,
    epolicyDocumentName: p.epolicy_document_name, epolicy: ep, ...(ep.vehicle ? Object.fromEntries(Object.entries(ep.vehicle).filter(([, v]) => v)) : {}),
    ...(ep.vehiclePhotoKey ? { vehiclePhotoKey: ep.vehiclePhotoKey } : {}) };
  const issued = await issuePolicy(db, {
    quoteId: p.quote_id, clientId, leadId: p.lead_id, productId: p.product_id, policyTypeId: p.policy_type_id, insuranceCompanyId: p.insurance_company_id,
    ownerUserId: p.owner_user_id || user.id, agentUserId: quote?.agent_user_id || p.owner_user_id || user.id, sumInsured: p.sum_insured, netPremium: p.premium_base,
    grossPremium: p.premium_total, commissionAmount: p.commission_amount, commissionRate: Number(p.commission_rate || 0), currency: p.currency, insuredName: p.insured_name,
    productType: p.product_type, lob: p.lob, doc: { ...doc, placementNumber: p.placement_number }, billingMode: p.billing_mode, placementId: p.id,
    participants: await participantInputs('placement', p.id, db), taxes: taxesOf(p),
    receivableSource: renewal.renewalOf ? 'renewal' : 'policy', receivableReference: renewal.renewalOf?.renewalNumber || null,
  }, { ...extra, ...received, policyNumber: ep.brokerPolicyNumber || undefined, insuredName: ep.participantName || p.insured_name, inception: ep.effectiveDate || p.inception_date,
    expiry: ep.expiryDate || p.expiry_date, issuedDate: ep.issueDate, paymentStatus: 'Pending' }, user.id);
  if (renewal.renewalOf) await linkRenewal(db, { q: quote, renewalOf: renewal.renewalOf, expiring: renewal.expiring, policyId: issued.policyId, user });
  await db.query("UPDATE placements SET status = 'issued', policy_id = $2, client_id = $3, issued_at = now(), issued_by = $4, updated_by = $4, updated_at = now() WHERE id = $1", [p.id, issued.policyId, clientId, user.id]);
  if (p.quote_id) await db.query("UPDATE quotes SET status = 'converted', policy_id = $2, client_id = $3, updated_by = $4, updated_at = now() WHERE id = $1", [p.quote_id, issued.policyId, clientId, user.id]);
  // the cover notes of the quotation / placement end now that the policy is in force
  const { syncStatuses } = await import('../cover-notes/service.js');
  await syncStatuses(db);
  return { ...issued, clientId };
}

/**
 * The policy schedule to the client's registered e-mail on booking (TIS-BRD-ISSUE-03, placement.schedule_email_on_booking),
 * with the insurer's e-policy. { emailId, to } or { emailId: null, reason } when the client has no e-mail.
 */
async function emailSchedule(policyId, placement) {
  if (!(await getSetting('placement.schedule_email_on_booking', true))) return null;
  const pol = await getPolicyRow(policyId);
  const client = pol.client_id ? await one('SELECT display_name, email FROM clients WHERE id = $1', [pol.client_id]) : null;
  if (!client?.email) return { emailId: null, reason: 'The client has no registered e-mail address' };
  const t = await emailTemplate('policy_schedule');
  const v = { companyName: await companyName(), customerName: client.display_name || pol.insured_name || 'Customer', policyNumber: pol.policy_number,
    insurerPolicyNumber: placement.epolicy?.insurerPolicyNumber || '', insurerName: placement.insurer_name || '', productType: pol.product_type || pol.lob || '',
    inception: pol.inception_date, expiry: pol.expiry_date, currency: pol.currency, grossPremium: amountText(pol.premium_total) };
  const attachments = [documentAttachment('policy-schedule', { policyId }, `policy-schedule-${pol.policy_number}.pdf`)];
  if (placement.epolicy_document_key) attachments.push(fileAttachment(placement.epolicy_document_key, placement.epolicy_document_name || `e-policy-${pol.policy_number}.pdf`));
  const emailId = await queueEmail({ to: client.email, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'policy_schedule',
    entity: 'policy', entityId: policyId, attachments });
  return { emailId, to: client.email };
}

/**
 * Book the placement ("Insurer issued"): the only way a policy comes into force. The policy is created with the slip's
 * premium and the e-policy's numbers and dates, the bill, journal and commission are booked, the cover notes end and
 * the policy schedule is e-mailed to the client.
 */
export async function bookPlacement(id, body, user) {
  const p = await getPlacementRow(id);
  const insurers = (await participantsOf('placement', p.id)).map((x) => x.insuranceCompanyId);
  await assertInsurersAuthorised(insurers.length ? insurers : [p.insurance_company_id], 'issue', { entity: 'placement', entityId: p.id });
  const quote = p.quote_id ? await one('SELECT doc FROM quotes WHERE id = $1', [p.quote_id]) : null;
  const extra = body.additionalPolicyData && typeof body.additionalPolicyData === 'object' ? body.additionalPolicyData : body;
  await assertKyc({ lob: p.lob, sources: [quote?.doc?.insuranceVehicleDetails?.[0], quote?.doc, p.doc, p.epolicy?.vehicle, extra.customerInfo, extra] });
  const r = await withTransaction((db) => bookInTx(db, p.id, body, user));
  const policy = await getPolicyRow(r.policyId);
  const schedule = await emailSchedule(policy.id, p);
  await notify({ userId: p.owner_user_id || user.id, type: 'info', title: 'Policy booked', message: `Policy ${policy.policy_number} (insurer policy ${p.epolicy?.insurerPolicyNumber}) was booked from placement slip ${p.placement_number}`,
    link: `/agent/policydetail/${policy.id}`, entity: 'policy', entityId: policy.id });
  return { ...r, schedule, placement: await placementById(p.id) };
}

function listWhere(q) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('p.status = ANY(?::text[])', String(q.status).split(','));
  if (q.source) add('p.source = ?', q.source);
  if (q.lob) add('p.lob = upper(?)', q.lob);
  if (q.quoteId) add('p.quote_id = ?', q.quoteId);
  if (q.brokerSlipId) add('p.broker_slip_id = ?', q.brokerSlipId);
  if (q.clientId) add('p.client_id = ?', q.clientId);
  if (q.insurerId) add("EXISTS (SELECT 1 FROM risk_participants rp WHERE rp.entity_type = 'placement' AND rp.entity_id = p.id AND rp.insurance_company_id = ?::int)", Number(q.insurerId));
  const search = q.search || q.query;
  if (search) add("(p.placement_number ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%' OR p.product_type ILIKE '%' || ? || '%')", search);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'placement', 'p', params));
  return { where: where.join(' AND '), params };
}

export async function listPlacements(q, pg) {
  const { where, params } = listWhere(q);
  const total = (await one(`SELECT count(*)::int AS n FROM placements p LEFT JOIN clients c ON c.id = p.client_id WHERE ${where}`, params)).n;
  const rows = await many(`${SELECT} WHERE ${where} ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  const counts = await many(`SELECT p.status, count(*)::int AS count FROM placements p LEFT JOIN clients c ON c.id = p.client_id WHERE ${where} GROUP BY p.status`, params);
  return { total, rows, counts: Object.fromEntries(counts.map((r) => [r.status, r.count])) };
}
