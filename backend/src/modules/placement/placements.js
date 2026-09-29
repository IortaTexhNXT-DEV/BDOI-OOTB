/**
 * Placement Slip (firm order): the risk is placed with the lead insurer and any co-insurers for their shares, each
 * confirms (binds) with its policy / certificate number, and the policy is issued from the bound placement through the
 * standard issuance routine (policies/service.js#issuePolicy), which copies the participants to the policy.
 *
 * Starting points: an accepted quotation (source quote), selected broker slip offers (source broker-slip), a direct
 * placement for a named insurer (source direct) or a policy the insurer already issued (source direct-policy, created
 * bound and issued in one step).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { queueEmail } from '../../lib/mailer.js';
import { today, isoDate } from '../../lib/dates.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { notify } from '../notifications/router.js';
import { num, round2, renderTemplate, emailTemplate, amountText } from '../documents/common.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { quoteStatusOut } from '../documents/statuses.js';
import { clientFromLead, createClientInTx } from '../clients/service.js';
import { issuePolicy, getPolicyRow } from '../policies/service.js';
import { assertKyc } from '../policies/kyc.js';
import { premiumBreakdown } from '../quotations/premium.js';
import { journeyFor, resolveLob, assertStep } from './journey.js';
import { normaliseParticipants, writeParticipants, participantsOf, participantInputs, leadOf, legacyParticipantDetails } from './participants.js';
import { getSlipRow, participantsFromOffers, riskFromSlip, assertParty, partyName } from './brokerSlips.js';

export const PLACEMENT_STATUSES = ['draft', 'sent', 'bound', 'declined', 'cancelled', 'issued'];
const LABELS = { draft: 'Draft', sent: 'SentToInsurer', bound: 'Bound', declined: 'Declined', cancelled: 'Cancelled', issued: 'PolicyIssued' };
const addMonths = (d, m) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

const SELECT = `SELECT p.*, row_to_json(l.*) AS lead_row, c.display_name AS client_name, ic.name AS insurer_name, q.quote_number, q.status AS quote_status,
  b.slip_number, pol.policy_number, (SELECT u.display_name FROM users u WHERE u.id = p.created_by) AS created_by_name,
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
    sentAt: r.sent_at, boundAt: r.bound_at, issuedAt: r.issued_at, policyId: r.policy_id, policyNumber: r.policy_number || null,
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

/** The journey steps of a placement with links: Broker Slip -> Quotation Slip -> Placement Slip -> Policy. */
function timeline(p, journey) {
  const step = (key, label, done, ref, id, at, mode) => ({ key, label, done, reference: ref || null, id: id || null, at: at || null, mode });
  return [
    step('brokerSlip', 'Broker Slip', Boolean(p.broker_slip_id), p.slip_number, p.broker_slip_id, null, journey.brokerSlip),
    step('quotationSlip', 'Quotation Slip', Boolean(p.quote_id), p.quote_number, p.quote_id, null, journey.quotationSlip),
    step('placementSlip', 'Placement Slip', true, p.placement_number, p.id, p.created_at, journey.placementSlip),
    step('sent', 'Sent to insurer(s)', Boolean(p.sent_at) || p.source === 'direct-policy', null, null, p.sent_at, 'required'),
    step('bound', 'Bound / confirmed', Boolean(p.bound_at), null, null, p.bound_at, 'required'),
    step('policy', 'Policy', Boolean(p.policy_id), p.policy_number, p.policy_id, p.issued_at, 'required'),
  ];
}

export async function placementById(id, db = null) {
  const row = await getPlacementRow(id, db);
  const participants = await participantsOf('placement', row.id, db);
  const journey = await journeyFor({ lob: row.lob, productType: row.product_type, productId: row.product_id }, db);
  return { ...toPlacement(row, participants), journey, timeline: timeline(row, journey) };
}

/** Premium breakdown of a direct placement: the net premium agreed with the insurer, taxes from the LOB rates. */
async function directBreakdown(body, lob, leadIc) {
  const netPremium = num(body.netPremium);
  if (!(netPremium > 0)) throw badRequest('netPremium (the premium agreed with the insurer) is required');
  return premiumBreakdown({ lob, productType: body.productType, agreedNetPremium: netPremium, totalSumInsured: num(body.sumInsured), commissionRate: body.commissionRate,
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
  const allowed = await getSetting('placement.quote_statuses', ['CustomerAccepted', 'SubmittedToInsurer', 'Approved']);
  if (!allowed.includes(quoteStatusOut(q.status))) throw badRequest(`A placement slip can be created from a ${allowed.join(' / ')} quotation (current: ${quoteStatusOut(q.status)})`);
  const journey = await journeyFor({ lob: q.lob, productType: q.product_type, productId: q.product_id }, db);
  assertStep(journey, 'placementSlip', ['skip'], `The ${journey.lob} placement journey skips the Placement Slip: convert the quotation to a policy directly`);
  const open = (await db.query("SELECT placement_number FROM placements WHERE quote_id = $1 AND status NOT IN ('cancelled','declined')", [q.id])).rows[0];
  if (open) throw conflict(`Quotation ${q.quote_number} already has placement slip ${open.placement_number}`);
  let parts = body.participants?.length ? await normaliseParticipants(body.participants, { db }) : await participantInputs('quote', q.id, db);
  if (!parts.length && q.insurance_company_id) parts = [{ insuranceCompanyId: q.insurance_company_id, sharePercent: 100, isLead: true, commissionRate: null, insurerReference: null }];
  if (!parts.length) throw badRequest('The quotation names no insurer: add the participating insurer(s)');
  const { inception, expiry } = await period(body, isoDate(q.doc?.inception || q.doc?.inceptionDate || q.doc?.policyStartDate));
  const doc = { ...(q.doc || {}), valueAddedTax: Number(q.vat), documentaryStampTax: Number(q.dst), localGovernmentTax: Number(q.lgt), fireServiceTax: Number(q.fst),
    discount: Number(q.discount), accountPremiumOthers: Number(q.others) };
  return {
    parts, data: {
      source: 'quote', quote_id: q.id, broker_slip_id: q.broker_slip_id || null, lead_id: q.lead_id, client_id: q.client_id, product_id: q.product_id, policy_type_id: q.policy_type_id,
      product_type: q.product_type, lob: await resolveLob({ lob: q.lob, productId: q.product_id, productType: q.product_type }, db),
      insured_name: body.insuredName || q.doc?.insuredName || leadName(q.lead_row) || await partyName(db, { clientId: q.client_id }), doc: JSON.stringify(doc),
      sum_insured: q.sum_insured, premium_base: q.premium_base, vat: q.vat, dst: q.dst, lgt: q.lgt, fst: q.fst, others: q.others, discount: q.discount,
      premium_total: q.premium_total, commission_rate: q.commission_rate, commission_amount: q.commission_amount, currency: q.currency,
      inception_date: inception, expiry_date: expiry, billing_mode: body.billingMode || null, remarks: body.remarks || null, owner_user_id: q.agent_user_id || q.created_by || user.id,
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
  const parts = await normaliseParticipants(body.participants || (body.insuranceCompanyId || body.insuranceCompanyName ? [{ insuranceCompanyId: body.insuranceCompanyId, insuranceCompanyName: body.insuranceCompanyName, sharePercent: 100 }] : []), { db });
  const b = await directBreakdown(body, lob, leadOf(parts).insuranceCompanyId);
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
  return placementById(id);
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
  return { before: toPlacement(before), after: await placementById(before.id) };
}

/** Draft -> Sent: queue the firm order to each participating insurer, showing its own share. */
export async function sendPlacement(id, user, { insurerIds = null } = {}) {
  const p = await placementById(id);
  if (!['draft', 'sent'].includes(p.status)) throw conflict(`A ${p.placementStatus} placement slip cannot be sent`);
  const t = await emailTemplate('placement_order');
  const company = ((await getSetting('general.company_name')) ?? '');
  const sent = [];
  const failed = [];
  for (const x of p.participants.filter((r) => r.status !== 'confirmed' && (!insurerIds || insurerIds.map(Number).includes(Number(r.insuranceCompanyId))))) {
    if (!x.insurerEmail) { failed.push({ insurer: x.insuranceCompanyName, reason: 'No contact e-mail on the insurer record' }); continue; }
    const v = { companyName: company, placementNumber: p.placementNumber, insuredName: p.insuredName || '', productType: p.productType || p.lob, currency: p.currency,
      period: `${p.inceptionDate} to ${p.expiryDate}`, sumInsured: amountText(p.sumInsured), insurerName: x.insuranceCompanyName, sharePercent: x.sharePercent,
      role: x.isLead ? 'lead insurer' : 'co-insurer', shareSumInsured: amountText(x.sumInsured), sharePremium: amountText(x.premium), sharePremiumTotal: amountText(x.premiumTotal) };
    const emailId = await queueEmail({ to: x.insurerEmail, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'placement_order', entity: 'placement', entityId: p.id });
    sent.push({ insurer: x.insuranceCompanyName, email: x.insurerEmail, emailId });
  }
  if (!sent.length && failed.length) throw badRequest(`No insurer could be e-mailed: ${failed.map((f) => `${f.insurer} (${f.reason})`).join('; ')}`);
  await query("UPDATE placements SET status = 'sent', sent_at = COALESCE(sent_at, now()), updated_by = $2, updated_at = now() WHERE id = $1", [p.id, user.id]);
  // the quotation the placement comes from is now with the insurer(s)
  if (p.quoteId) await query("UPDATE quotes SET status = 'submitted', submitted_to_insurer_at = now(), submitted_by = $2, updated_at = now() WHERE id = $1 AND status = 'accepted'", [p.quoteId, user.id]);
  return { sent, failed, placement: await placementById(p.id) };
}

/**
 * Record insurer confirmations (binding): each confirmed participant gets its policy / certificate number. When every
 * participant has confirmed, the placement is Bound and the policy can be issued.
 */
export async function confirmPlacement(id, confirmations, user) {
  const p = await getPlacementRow(id);
  if (!['draft', 'sent', 'declined'].includes(p.status)) throw conflict(`A ${LABELS[p.status] || p.status} placement slip cannot be confirmed`);
  const parts = await participantsOf('placement', p.id);
  await withTransaction(async (db) => {
    for (const c of confirmations) {
      const x = parts.find((r) => (c.participantId && Number(c.participantId) === Number(r.participantId)) || (c.insuranceCompanyId && Number(c.insuranceCompanyId) === Number(r.insuranceCompanyId)));
      if (!x) throw badRequest(`Insurer ${c.insuranceCompanyId || c.participantId} is not a participant of placement ${p.placement_number}`);
      await db.query(`UPDATE risk_participants SET status = 'confirmed', insurer_reference = $2, confirmed_at = COALESCE($3::timestamptz, now()), confirmed_by = $4, remarks = COALESCE($5, remarks),
        updated_at = now() WHERE id = $1`, [x.participantId, c.insurerReference, c.confirmedAt || null, user.id, c.remarks || null]);
    }
    const open = (await db.query("SELECT count(*)::int AS n FROM risk_participants WHERE entity_type = 'placement' AND entity_id = $1 AND status <> 'confirmed'", [p.id])).rows[0].n;
    const declined = (await db.query("SELECT count(*)::int AS n FROM risk_participants WHERE entity_type = 'placement' AND entity_id = $1 AND status = 'declined'", [p.id])).rows[0].n;
    const status = open === 0 ? 'bound' : (declined ? 'declined' : (p.status === 'draft' ? 'draft' : 'sent'));
    await db.query(`UPDATE placements SET status = $2, bound_at = CASE WHEN $2 = 'bound' THEN now() ELSE bound_at END, updated_by = $3, updated_at = now() WHERE id = $1`, [p.id, status, user.id]);
  });
  return placementById(p.id);
}

/** An insurer declines its line: the placement is Declined until the participants are re-arranged (edit) or it is cancelled. */
export async function declineParticipant(id, { insuranceCompanyId, reason }, user) {
  const p = await getPlacementRow(id);
  if (!['draft', 'sent'].includes(p.status)) throw conflict(`A ${LABELS[p.status] || p.status} placement slip cannot be changed`);
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

/** Issue the policy of a bound placement inside the caller's transaction (issuePolicy with the placement as source). */
async function issueInTx(db, placementId, body, user) {
  const p = (await db.query('SELECT * FROM placements WHERE id = $1 FOR UPDATE', [placementId])).rows[0];
  if (p.status === 'issued') throw conflict('The policy was already issued from this placement slip');
  if (p.status !== 'bound') throw conflict(`Every participating insurer must confirm before the policy is issued (placement status: ${LABELS[p.status] || p.status})`);
  const quote = p.quote_id ? (await db.query('SELECT * FROM quotes WHERE id = $1', [p.quote_id])).rows[0] : null;
  const extra = body.additionalPolicyData && typeof body.additionalPolicyData === 'object' ? body.additionalPolicyData : { ...body };
  if (extra.paymentStatus && extra.paymentStatus !== 'Pending') extra.paymentStatus = 'Pending';
  const clientId = p.client_id || (p.lead_id ? await clientFromLead(db, p.lead_id, extra.customerInfo || {}, p.owner_user_id || user.id) : null);
  if (!clientId) throw badRequest('The placement slip has no lead or client to insure');
  const { RESERVED } = await import('../quotations/shape.js');
  const doc = Object.fromEntries(Object.entries(p.doc || {}).filter(([k]) => !RESERVED.includes(k)));
  const issued = await issuePolicy(db, {
    quoteId: p.quote_id, clientId, leadId: p.lead_id, productId: p.product_id, policyTypeId: p.policy_type_id, insuranceCompanyId: p.insurance_company_id,
    ownerUserId: p.owner_user_id || user.id, agentUserId: quote?.agent_user_id || p.owner_user_id || user.id, sumInsured: p.sum_insured, netPremium: p.premium_base,
    grossPremium: p.premium_total, commissionAmount: p.commission_amount, commissionRate: Number(p.commission_rate || 0), currency: p.currency, insuredName: p.insured_name,
    productType: p.product_type, lob: p.lob, doc: { ...doc, placementNumber: p.placement_number }, billingMode: p.billing_mode, placementId: p.id,
    participants: await participantInputs('placement', p.id, db), taxes: taxesOf(p),
  }, { inception: p.inception_date, expiry: p.expiry_date, ...extra }, user.id);
  await db.query("UPDATE placements SET status = 'issued', policy_id = $2, client_id = $3, issued_at = now(), updated_by = $4, updated_at = now() WHERE id = $1", [p.id, issued.policyId, clientId, user.id]);
  if (p.quote_id) await db.query("UPDATE quotes SET status = 'converted', policy_id = $2, client_id = $3, updated_by = $4, updated_at = now() WHERE id = $1", [p.quote_id, issued.policyId, clientId, user.id]);
  return { ...issued, clientId };
}

export async function issueFromPlacement(id, body, user) {
  const p = await getPlacementRow(id);
  if (p.source !== 'direct-policy') {
    const quote = p.quote_id ? await one('SELECT doc FROM quotes WHERE id = $1', [p.quote_id]) : null;
    const extra = body.additionalPolicyData && typeof body.additionalPolicyData === 'object' ? body.additionalPolicyData : body;
    await assertKyc({ lob: p.lob, sources: [quote?.doc?.insuranceVehicleDetails?.[0], quote?.doc, p.doc, extra.customerInfo, extra] });
  }
  const r = await withTransaction((db) => issueInTx(db, p.id, body, user));
  const policy = await getPolicyRow(r.policyId);
  await notify({ userId: p.owner_user_id || user.id, type: 'info', title: 'Policy issued', message: `Policy ${policy.policy_number} was issued from placement slip ${p.placement_number}`,
    link: `/agent/policydetail/${policy.id}`, entity: 'policy', entityId: policy.id });
  return { ...r, placement: await placementById(p.id) };
}

/**
 * Record Issued Policy (direct policy entry): a policy the insurer already issued is recorded with its participants and
 * their policy / certificate numbers; a bound placement slip (source direct-policy) is created and the policy issued in
 * one transaction.
 */
export async function recordIssuedPolicy(body, user) {
  const r = await withTransaction(async (db) => {
    const productId = body.productId ? Number(body.productId) : null;
    const lob = await resolveLob({ lob: body.lob, productId, productType: body.productType }, db);
    const journey = await journeyFor({ lob, productType: body.productType, productId }, db);
    assertStep(journey, 'directPolicy', ['skip'], `Direct policy entry is not allowed for ${journey.lob}: place the risk through the placement journey`);
    const { parts, data } = await direct(db, body, user, { source: 'direct-policy', checkJourney: false });
    data.insurance_company_id = leadOf(parts).insuranceCompanyId;
    data.doc = JSON.stringify({ ...JSON.parse(data.doc), participantDetails: await legacyParticipantDetails(parts, db, data.currency), isCoInsurance: parts.length > 1 });
    const confirmed = parts.map((x) => ({ ...x, insurerReference: x.insurerReference || (x.isLead ? body.policyNumber : null) || null, confirmedAt: new Date(), confirmedBy: user.id }));
    const placementId = await insertPlacement(db, { ...data, status: 'bound', bound_at: new Date(), sent_at: null }, confirmed, user.id, 'confirmed');
    const issued = await issueInTx(db, placementId, { policyNumber: body.policyNumber, issuedDate: body.issuedDate, paymentMethod: body.paymentMethod, ...(body.additionalPolicyData || {}) }, user);
    return { ...issued, placementId };
  });
  return { ...r, placement: await placementById(r.placementId) };
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
