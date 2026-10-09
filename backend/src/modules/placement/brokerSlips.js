/**
 * Broker Slip (market submission / request for quotation): the risk is presented to several insurers, each answers with
 * an offer (premium, rate, taxes, deductibles, terms, validity, the line it writes) or declines; the offers are compared
 * and the selected one(s) become the Quotation Slip (a quotation) or, when the journey allows, the Placement Slip.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { baseCurrency } from '../../lib/currency.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { companyName } from '../../lib/letterhead.js';
import { queueEmail } from '../../lib/mailer.js';
import { addDays, today, isoDate } from '../../lib/dates.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { num, round2, renderTemplate, emailTemplate, amountText } from '../documents/common.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { insurerId } from '../policies/service.js';
import { quotationCharges } from '../premium-charges/service.js';
import { journeyFor, resolveLob, assertStep } from './journey.js';
import { productOfLine } from './productLines.js';
import { createLead } from '../leads/service.js';
import { assertOnMarket, evaluate, assertNotDeclined } from '../product-configurator/underwriting.js';

export const SLIP_STATUSES = ['draft', 'submitted', 'responses-in', 'closed', 'cancelled'];
const OPEN = ['draft', 'submitted', 'responses-in'];
const n = (v) => (v === null || v === undefined ? null : Number(v));

const SLIP_SELECT = `SELECT b.*, row_to_json(l.*) AS lead_row, c.display_name AS client_name, pr.name AS product_name, q.quote_number, q.status AS quote_status,
  (SELECT u.display_name FROM users u WHERE u.id = b.created_by) AS created_by_name,
  (SELECT count(*)::int FROM insurer_offers o WHERE o.broker_slip_id = b.id) AS offers_total,
  (SELECT count(*)::int FROM insurer_offers o WHERE o.broker_slip_id = b.id AND o.status = 'offered') AS offers_offered,
  (SELECT count(*)::int FROM insurer_offers o WHERE o.broker_slip_id = b.id AND o.status = 'declined') AS offers_declined,
  (SELECT min(o.premium_total) FROM insurer_offers o WHERE o.broker_slip_id = b.id AND o.status = 'offered') AS best_premium
  FROM broker_slips b LEFT JOIN leads l ON l.id = b.lead_id LEFT JOIN clients c ON c.id = b.client_id
  LEFT JOIN products pr ON pr.id = b.product_id LEFT JOIN quotes q ON q.id = b.quote_id`;

const leadName = (l) => (l ? [l.first_name, l.last_name].filter(Boolean).join(' ') || l.company_name || l.display_name : null);

export function toOffer(r) {
  return {
    id: r.id, offerId: r.id, offerNumber: r.offer_number, brokerSlipId: r.broker_slip_id, insuranceCompanyId: r.insurance_company_id,
    insuranceCompanyName: r.insurer_name, insurerEmail: r.contact_email || null, status: r.status, premium: n(r.premium), rate: n(r.rate), taxes: n(r.taxes),
    premiumTotal: n(r.premium_total), sumInsured: n(r.sum_insured), deductibles: r.deductibles, terms: r.terms, validityDate: r.validity_date,
    offeredShare: Number(r.offered_share), insurerReference: r.insurer_reference, attachmentKey: r.attachment_key, attachmentName: r.attachment_name,
    declineReason: r.decline_reason, remarks: r.remarks, requestedAt: r.requested_at, respondedAt: r.responded_at, selected: r.selected,
  };
}

export function toSlip(r, offers = null) {
  if (!r) return null;
  const age = r.created_at ? Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)) : 0;
  return {
    id: r.id, brokerSlipId: r.id, slipNumber: r.slip_number, leadId: r.lead_id, leadRefId: r.lead_id, clientId: r.client_id, clientName: r.client_name,
    customerName: r.client_name || leadName(r.lead_row) || r.insured_name, productId: r.product_id, productType: r.product_type || r.product_name, lob: r.lob,
    insuredName: r.insured_name, riskDetails: r.risk_details || {}, doc: r.doc || {}, requestedCovers: r.requested_covers || [], sumInsured: Number(r.sum_insured),
    currency: r.currency, inceptionDate: r.inception_date, expiryDate: r.expiry_date, submissionDate: r.submission_date, responseDueDate: r.response_due_date,
    status: r.status, quoteId: r.quote_id, quotationNumber: r.quote_number || null, remarks: r.remarks, cancelReason: r.cancel_reason,
    offersTotal: r.offers_total ?? null, offersReceived: r.offers_offered ?? null, offersDeclined: r.offers_declined ?? null, bestPremium: n(r.best_premium),
    ageDays: age, createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
    ...(offers ? { offers } : {}),
  };
}

export async function getSlipRow(id, db = null) {
  const r = await (db || { query }).query(`${SLIP_SELECT} WHERE b.id = $1 OR b.slip_number = $1`, [String(id)]);
  if (!r.rows[0]) throw notFound('Broker slip not found');
  return r.rows[0];
}

export async function offersOf(slipId, db = null) {
  const r = await (db || { query }).query(`SELECT o.*, ic.name AS insurer_name, ic.contact_email FROM insurer_offers o JOIN insurance_companies ic ON ic.id = o.insurance_company_id
    WHERE o.broker_slip_id = $1 ORDER BY (o.status = 'offered') DESC, o.premium_total NULLS LAST, ic.name`, [slipId]);
  return r.rows.map(toOffer);
}

/**
 * Comparison of the market responses: offered terms ranked by gross premium, with the capacity (sum of the lines
 * offered) that tells whether the risk can be fully placed.
 */
export function compareOffers(offers) {
  const offered = offers.filter((o) => o.status === 'offered');
  const best = offered.reduce((m, o) => (o.premiumTotal !== null && (m === null || o.premiumTotal < m) ? o.premiumTotal : m), null);
  const ranked = [...offered].sort((a, b) => (a.premiumTotal ?? Infinity) - (b.premiumTotal ?? Infinity));
  return {
    rows: offers.map((o) => {
      const rank = ranked.indexOf(o);
      return { ...o, rank: rank >= 0 ? rank + 1 : null, isBest: o.status === 'offered' && best !== null && o.premiumTotal === best,
        differenceFromBest: o.status === 'offered' && best !== null && o.premiumTotal !== null ? round2(o.premiumTotal - best) : null };
    }),
    summary: { approached: offers.length, offered: offered.length, declined: offers.filter((o) => o.status === 'declined').length,
      pending: offers.filter((o) => o.status === 'pending').length, bestPremium: best, capacityPercent: round2(offered.reduce((s, o) => s + o.offeredShare, 0)) },
  };
}

export async function slipById(id) {
  const row = await getSlipRow(id);
  const offers = await offersOf(row.id);
  const placement = await one("SELECT id, placement_number, status, policy_id FROM placements WHERE broker_slip_id = $1 AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1", [row.id]);
  const policyId = placement?.policy_id || (row.quote_id ? (await one('SELECT policy_id FROM quotes WHERE id = $1', [row.quote_id]))?.policy_id : null);
  const policy = policyId ? await one('SELECT id, policy_number FROM policies WHERE id = $1', [policyId]) : null;
  const journey = await journeyFor({ lob: row.lob, productType: row.product_type, productId: row.product_id });
  return { ...toSlip(row, offers), comparison: compareOffers(offers), journey,
    placementId: placement?.id || null, placementNumber: placement?.placement_number || null, policyId: policy?.id || null, policyNumber: policy?.policy_number || null };
}

async function resolveInsurers(db, list) {
  const ids = [];
  for (const ref of list || []) {
    const ic = await insurerId(db, typeof ref === 'object' && ref !== null ? (ref.insuranceCompanyId ?? ref.id ?? ref.name) : ref);
    if (!ic) throw badRequest(`Insurer "${typeof ref === 'object' ? JSON.stringify(ref) : ref}" was not found in the insurer master`);
    if (!ids.includes(ic)) ids.push(ic);
  }
  return ids;
}

/**
 * Approach insurers with the slip. An insurer must be on the product's insurer market (Product Configurator > Market
 * Mapping) and its acceptance rules must not decline the risk (rules for every insurer and the insurer's own).
 */
async function addOffers(db, slipId, insurerIds, userId) {
  const slip = (await db.query('SELECT product_id, lob, product_type, risk_details, doc, sum_insured FROM broker_slips WHERE id = $1', [slipId])).rows[0];
  const fresh = [];
  for (const ic of insurerIds) {
    if (!(await db.query('SELECT 1 FROM insurer_offers WHERE broker_slip_id = $1 AND insurance_company_id = $2', [slipId, ic])).rows[0]) fresh.push(ic);
  }
  await assertOnMarket({ productId: slip.product_id, lob: slip.lob }, fresh, db);
  const risk = { ...(slip.doc || {}), riskDetails: slip.risk_details || {}, totalSumInsured: Number(slip.sum_insured) || undefined, productId: slip.product_id };
  for (const ic of fresh) {
    const uw = await evaluate(risk, { insurerId: ic, productId: slip.product_id, lob: slip.lob }, db);
    if (uw?.decision === 'declined') {
      const name = (await db.query('SELECT name FROM insurance_companies WHERE id = $1', [ic])).rows[0]?.name || `Insurer ${ic}`;
      assertNotDeclined(uw, `The risk (for ${name})`);
    }
  }
  for (const ic of fresh) {
    const number = await nextDocumentNumber('insurer_offer', { db, unique: { table: 'insurer_offers', column: 'offer_number' } });
    await db.query('INSERT INTO insurer_offers(offer_number, broker_slip_id, insurance_company_id, created_by) VALUES ($1,$2,$3,$4)', [number, slipId, ic, userId]);
  }
}

/** Customer of a slip / placement: an existing lead or client (both checked). */
export async function assertParty(db, { leadRefId, clientId }) {
  if (!leadRefId && !clientId) throw badRequest('A lead (leadRefId) or a client (clientId) is required');
  if (leadRefId && !(await db.query('SELECT 1 FROM leads WHERE id = $1 AND deleted_at IS NULL', [leadRefId])).rows[0]) throw badRequest(`Lead ${leadRefId} not found`);
  if (clientId && !(await db.query('SELECT 1 FROM clients WHERE id = $1', [clientId])).rows[0]) throw badRequest(`Client ${clientId} not found`);
}

/** Insured name default: the client's or the lead's name. */
export async function partyName(db, { leadRefId, clientId }) {
  if (clientId) return (await db.query('SELECT display_name FROM clients WHERE id = $1', [clientId])).rows[0]?.display_name || null;
  if (leadRefId) {
    const l = (await db.query('SELECT first_name, last_name, company_name FROM leads WHERE id = $1', [leadRefId])).rows[0];
    return leadName(l);
  }
  return null;
}

const coversTotal = (covers) => round2((covers || []).reduce((s, c) => s + num(c.sumInsured), 0));

/**
 * Create a broker slip (Request for Quotation). A new prospect (body.prospect) is saved as a lead in the same
 * transaction when no lead or client is given; its id is returned as newProspectId.
 */
export async function createSlip(input, userId) {
  let newProspectId = null;
  const id = await withTransaction(async (db) => {
    const body = { ...input };
    const productId = body.productId ? Number(body.productId) : null;
    if (productId && body.lob) await productOfLine(db, { lob: body.lob, product: productId, active: false });
    const lob = await resolveLob({ lob: body.lob, productId, productType: body.productType }, db);
    if (!body.leadRefId && !body.clientId && body.prospect) {
      const p = body.prospect;
      // the new prospect is tagged with the product of the request
      const lead = await createLead({ ...p, leadCategory: p.companyName ? 'Corporate' : 'Retail', lob, ...(productId ? { productId } : {}) }, userId, db);
      newProspectId = lead.id;
      body.leadRefId = lead.id;
    }
    await assertParty(db, body);
    const journey = await journeyFor({ lob, productType: body.productType, productId }, db);
    assertStep(journey, 'brokerSlip', ['skip'], `Broker slips are not used for ${journey.lob}: start with the Quotation Slip`);
    const defaults = (await getSetting('broker_slips.default_insurers', [])) || [];
    const insurers = await resolveInsurers(db, body.insurers?.length ? body.insurers : defaults);
    const number = await nextDocumentNumber('broker_slip', { db, unique: { table: 'broker_slips', column: 'slip_number' } });
    const covers = Array.isArray(body.requestedCovers) ? body.requestedCovers : [];
    const r = await db.query(`INSERT INTO broker_slips(slip_number, lead_id, client_id, product_id, product_type, lob, insured_name, risk_details, doc, requested_covers,
        sum_insured, currency, inception_date, expiry_date, response_due_date, remarks, owner_user_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) RETURNING id`,
    [number, body.leadRefId || null, body.clientId || null, productId, body.productType || null, lob, body.insuredName || await partyName(db, body),
      JSON.stringify(body.riskDetails || {}), JSON.stringify(body.doc || {}), JSON.stringify(covers), round2(num(body.sumInsured) || coversTotal(covers)),
      body.currency || await baseCurrency(), isoDate(body.inceptionDate), isoDate(body.expiryDate), isoDate(body.responseDueDate), body.remarks || null, userId]);
    await addOffers(db, r.rows[0].id, insurers, userId);
    return r.rows[0].id;
  });
  const slip = await slipById(id);
  return newProspectId ? { ...slip, newProspectId } : slip;
}

export async function updateSlip(id, body, userId) {
  const before = await getSlipRow(id);
  if (!OPEN.includes(before.status)) throw conflict(`A ${before.status} broker slip cannot be edited`);
  await withTransaction(async (db) => {
    const cols = {};
    const set = (k, v) => { if (v !== undefined) cols[k] = v; };
    set('insured_name', body.insuredName);
    set('product_type', body.productType);
    if (body.productId !== undefined) cols.product_id = body.productId ? Number(body.productId) : null;
    if (body.productType !== undefined || body.productId !== undefined || body.lob !== undefined) {
      cols.lob = await resolveLob({ lob: body.lob, productId: cols.product_id ?? before.product_id, productType: body.productType ?? before.product_type }, db);
    }
    if (body.riskDetails !== undefined) cols.risk_details = JSON.stringify(body.riskDetails || {});
    if (body.doc !== undefined) cols.doc = JSON.stringify(body.doc || {});
    if (body.requestedCovers !== undefined) cols.requested_covers = JSON.stringify(body.requestedCovers || []);
    if (body.sumInsured !== undefined || body.requestedCovers !== undefined) cols.sum_insured = round2(num(body.sumInsured) || coversTotal(body.requestedCovers ?? before.requested_covers));
    for (const [k, c] of [['inceptionDate', 'inception_date'], ['expiryDate', 'expiry_date'], ['responseDueDate', 'response_due_date']]) if (body[k] !== undefined) cols[c] = isoDate(body[k]);
    set('currency', body.currency);
    set('remarks', body.remarks);
    if (Object.keys(cols).length) {
      const keys = Object.keys(cols);
      await db.query(`UPDATE broker_slips SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
        [before.id, ...Object.values(cols), userId]);
    }
    if (Array.isArray(body.insurers)) {
      const ids = await resolveInsurers(db, body.insurers);
      await addOffers(db, before.id, ids, userId);
      // an insurer taken off the list is removed only while it has not answered
      await db.query("DELETE FROM insurer_offers WHERE broker_slip_id = $1 AND status = 'pending' AND NOT (insurance_company_id = ANY($2::int[]))", [before.id, ids]);
    }
  });
  return { before: toSlip(before), after: await slipById(before.id) };
}

async function slipVars(slip, offer) {
  const covers = (slip.requested_covers || []).map((c) => c.cover || c.name).filter(Boolean).join(', ');
  return {
    companyName: await companyName(), slipNumber: slip.slip_number, productType: slip.product_type || slip.product_name || slip.lob,
    insuredName: slip.insured_name || '', currency: slip.currency, sumInsured: amountText(slip.sum_insured), covers: covers || 'as per the broker slip',
    period: slip.inception_date ? `${slip.inception_date} to ${slip.expiry_date || '-'}` : 'to be agreed', responseDueDate: slip.response_due_date || '-',
    insurerName: offer.insuranceCompanyName, offerNumber: offer.offerNumber,
  };
}

/** Queue the request-for-quotation e-mail to insurers of the slip (all pending ones, or `only` insurer ids). */
async function requestQuotes(slip, only = null) {
  const t = await emailTemplate('broker_slip_request');
  const offers = (await offersOf(slip.id)).filter((o) => o.status === 'pending' && (!only || only.includes(o.insuranceCompanyId)));
  const sent = [];
  const failed = [];
  for (const o of offers) {
    if (!o.insurerEmail) { failed.push({ insurer: o.insuranceCompanyName, reason: 'No contact e-mail on the insurer record' }); continue; }
    const v = await slipVars(slip, o);
    const emailId = await queueEmail({ to: o.insurerEmail, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'broker_slip_request', entity: 'broker_slip', entityId: slip.id });
    await query('UPDATE insurer_offers SET requested_at = now(), updated_at = now() WHERE id = $1', [o.id]);
    sent.push({ insurer: o.insuranceCompanyName, email: o.insurerEmail, emailId });
  }
  return { sent, failed };
}

/** Draft -> Submitted: the slip goes to every insurer approached (queued e-mails) with the response due date. */
export async function submitSlip(id, user) {
  const before = await getSlipRow(id);
  if (before.status !== 'draft') throw conflict(`Only a draft broker slip can be submitted (current: ${before.status})`);
  if (!Number(before.offers_total)) throw badRequest('Add at least one insurer to approach before submitting the broker slip');
  const date = await today();
  const due = before.response_due_date || addDays(date, Number(await getSetting('broker_slips.response_days', 7)));
  await query("UPDATE broker_slips SET status = 'submitted', submission_date = $2, response_due_date = $3, updated_by = $4, updated_at = now() WHERE id = $1", [before.id, date, due, user.id]);
  const r = await requestQuotes(await getSlipRow(before.id));
  return { ...r, before: toSlip(before), after: await slipById(before.id) };
}

/** Add an insurer to the market; on a submitted slip it is sent the request at once. */
export async function addInsurer(id, ref, user) {
  const slip = await getSlipRow(id);
  if (!OPEN.includes(slip.status)) throw conflict(`Insurers cannot be added to a ${slip.status} broker slip`);
  const [ic] = await resolveInsurers(null, [ref]);
  await withTransaction((db) => addOffers(db, slip.id, [ic], user.id));
  let mail = null;
  if (slip.status !== 'draft') {
    mail = await requestQuotes(slip, [ic]);
    await query("UPDATE broker_slips SET status = 'submitted', updated_at = now() WHERE id = $1 AND status = 'responses-in'", [slip.id]);
  }
  return { mail, slip: await slipById(slip.id) };
}

/**
 * Record an insurer's response: offered (premium required; taxes from the premium tax and charge engine, gross and rate derived when not
 * given, validity defaulted from placement.offer_validity_days) or declined. When no insurer is pending any more the slip
 * is Responses-in.
 */
export async function recordOffer(id, offerId, body, user) {
  const slip = await getSlipRow(id);
  if (!['submitted', 'responses-in'].includes(slip.status)) throw conflict(`Responses can be recorded only on a submitted broker slip (current: ${slip.status})`);
  const offer = await one('SELECT * FROM insurer_offers WHERE (id = $1 OR offer_number = $1) AND broker_slip_id = $2', [String(offerId), slip.id]);
  if (!offer) throw notFound('Insurer offer not found on this broker slip');
  const status = body.status || 'offered';
  const cols = { status, responded_at: status === 'pending' ? null : new Date(), updated_by: user.id, updated_at: new Date(), remarks: body.remarks ?? offer.remarks,
    insurer_reference: body.insurerReference ?? offer.insurer_reference, attachment_key: body.attachmentKey ?? offer.attachment_key, attachment_name: body.attachmentName ?? offer.attachment_name };
  if (status === 'offered') {
    const premium = round2(num(body.premium));
    if (!(premium > 0)) throw badRequest('premium (net premium for 100% of the risk) is required for an offer');
    const si = num(body.sumInsured) || num(slip.sum_insured);
    let taxes = body.taxes === undefined || body.taxes === null || body.taxes === '' ? null : round2(num(body.taxes));
    if (taxes === null) {
      // the same engine the quotation is priced with (Premium Taxes & LGU Rates)
      const c = await quotationCharges({ productId: slip.product_id || null }, premium, slip.lob);
      taxes = round2(c.tax.valueAddedTax + c.tax.documentaryStampTax + c.tax.localGovernmentTax + c.tax.fireServiceTax + c.others);
    }
    const validity = isoDate(body.validityDate) || addDays(await today(), Number(await getSetting('placement.offer_validity_days', 30)));
    Object.assign(cols, {
      premium, taxes, premium_total: num(body.premiumTotal) > 0 ? round2(num(body.premiumTotal)) : round2(premium + taxes), sum_insured: si || null,
      rate: body.rate !== undefined && body.rate !== null && body.rate !== '' ? num(body.rate) : (si ? Math.round((premium / si) * 100 * 1e6) / 1e6 : null),
      deductibles: body.deductibles ?? offer.deductibles, terms: body.terms ?? offer.terms, validity_date: validity,
      offered_share: body.offeredShare === undefined || body.offeredShare === null || body.offeredShare === '' ? Number(offer.offered_share) : num(body.offeredShare), decline_reason: null,
    });
  } else if (status === 'declined') {
    Object.assign(cols, { decline_reason: body.declineReason || body.remarks || null, selected: false });
  }
  const keys = Object.keys(cols);
  await query(`UPDATE insurer_offers SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [offer.id, ...Object.values(cols)]);
  const pending = (await one("SELECT count(*)::int AS n FROM insurer_offers WHERE broker_slip_id = $1 AND status = 'pending'", [slip.id])).n;
  await query('UPDATE broker_slips SET status = $2, updated_at = now() WHERE id = $1', [slip.id, pending ? 'submitted' : 'responses-in']);
  return { offer: (await offersOf(slip.id)).find((o) => o.id === offer.id), slip: await slipById(slip.id) };
}

/**
 * Participants from selected offers: shares from `shares` ({offerId: %}) or each offer's line; the lead is `leadOfferId`
 * (else the first selected). The lines must total exactly 100%.
 */
export async function participantsFromOffers(slip, { offerIds, shares = {}, leadOfferId = null }) {
  const offers = await offersOf(slip.id);
  if (!Array.isArray(offerIds) || !offerIds.length) throw badRequest('Select at least one insurer offer');
  const chosen = offerIds.map((oid) => {
    const o = offers.find((x) => x.id === oid || x.offerNumber === oid);
    if (!o) throw badRequest(`Offer ${oid} is not on broker slip ${slip.slip_number}`);
    if (o.status !== 'offered') throw badRequest(`${o.insuranceCompanyName} has not made an offer (status ${o.status})`);
    return o;
  });
  const lead = (leadOfferId && chosen.find((o) => o.id === leadOfferId || o.offerNumber === leadOfferId)) || chosen[0];
  const parts = chosen.map((o) => ({ insuranceCompanyId: o.insuranceCompanyId, sharePercent: shares[o.id] !== undefined ? num(shares[o.id]) : (chosen.length === 1 && !shares[o.id] ? Math.min(100, o.offeredShare) : o.offeredShare),
    isLead: o === lead, commissionRate: null, insurerReference: o.insurerReference || null }));
  const total = round2(parts.reduce((s, p) => s + p.sharePercent, 0));
  if (Math.abs(total - 100) > 0.0001) {
    throw badRequest(`The selected offers' lines total ${total}%: select offers (or adjust the shares) so that they total exactly 100%`);
  }
  return { parts, lead, chosen };
}

/** Quote / placement body fields from the slip and the lead offer (premium agreed with the market). */
export function riskFromSlip(slip, lead) {
  const rd = slip.risk_details || {};
  // Fire / IAR screens read fireRiskDetails: the generic risk details map onto it when the slip has none
  const fire = ['FIRE', 'IAR'].includes(slip.lob) && !slip.doc?.fireRiskDetails ? {
    fireRiskDetails: { locationAddress: rd.location || rd.locationAddress, constructionType: rd.construction || rd.constructionType, occupancyType: rd.occupancy || rd.occupancyType,
      buildingType: rd.buildingType, natureOfBusiness: rd.natureOfBusiness || rd.business, earthquakeZone: rd.earthquakeZone, totalSumInsured: Number(slip.sum_insured) },
  } : {};
  return {
    ...fire,
    ...(slip.doc || {}), productType: slip.product_type || slip.product_name, lob: slip.lob, productId: slip.product_id, totalSumInsured: Number(slip.sum_insured),
    riskDetails: slip.risk_details || {}, requestedCovers: slip.requested_covers || [], insuredName: slip.insured_name, agreedNetPremium: lead.premium,
    offerTerms: { offerNumber: lead.offerNumber, insurer: lead.insuranceCompanyName, deductibles: lead.deductibles, terms: lead.terms, validityDate: lead.validityDate, rate: lead.rate },
    remarks: slip.remarks || undefined,
  };
}

/** Prepare the Quotation Slip (a quotation) from the selected offer(s); several offers make it co-insurance. */
export async function prepareQuotation(id, body, user) {
  const slip = await getSlipRow(id);
  if (!['submitted', 'responses-in'].includes(slip.status)) throw conflict(`A quotation slip can be prepared only from a submitted broker slip with offers (current: ${slip.status})`);
  const journey = await journeyFor({ lob: slip.lob, productType: slip.product_type, productId: slip.product_id });
  assertStep(journey, 'quotationSlip', ['skip'], `The ${journey.lob} placement journey skips the Quotation Slip: prepare the Placement Slip from the offers`);
  const { parts, lead, chosen } = await participantsFromOffers(slip, body);
  const { createQuote } = await import('../quotations/service.js');
  const quoteId = await withTransaction(async (db) => {
    const q = await createQuote({ ...riskFromSlip(slip, lead), leadRefId: slip.lead_id || undefined, clientId: slip.client_id || undefined, brokerSlipId: slip.id, participants: parts }, user.id, db);
    await db.query('UPDATE quotes SET product_id = COALESCE(product_id, $2) WHERE id = $1', [q.id, slip.product_id]);
    await db.query('UPDATE insurer_offers SET selected = (id = ANY($2)), updated_at = now() WHERE broker_slip_id = $1', [slip.id, chosen.map((o) => o.id)]);
    await db.query("UPDATE broker_slips SET status = 'closed', quote_id = $2, updated_by = $3, updated_at = now() WHERE id = $1", [slip.id, q.id, user.id]);
    return q.id;
  });
  return { quoteId, slip: await slipById(slip.id) };
}

export async function closeSlip(id, { status, reason }, user) {
  const slip = await getSlipRow(id);
  if (!OPEN.includes(slip.status)) throw conflict(`The broker slip is already ${slip.status}`);
  await query('UPDATE broker_slips SET status = $2, cancel_reason = $3, updated_by = $4, updated_at = now() WHERE id = $1', [slip.id, status, reason || null, user.id]);
  return { before: toSlip(slip), after: await slipById(slip.id) };
}

function listWhere(q) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('b.status = ANY(?::text[])', String(q.status).split(','));
  if (q.lob) add('b.lob = upper(?)', q.lob);
  if (q.leadRefId || q.leadId) add('b.lead_id = ?', q.leadRefId || q.leadId);
  if (q.clientId) add('b.client_id = ?', q.clientId);
  if (q.insurerId) add('EXISTS (SELECT 1 FROM insurer_offers o WHERE o.broker_slip_id = b.id AND o.insurance_company_id = ?::int)', Number(q.insurerId));
  const search = q.search || q.query;
  if (search) add("(b.slip_number ILIKE '%' || ? || '%' OR b.insured_name ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%' OR b.product_type ILIKE '%' || ? || '%')", search);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'broker_slip', 'b', params));
  return { where: where.join(' AND '), params };
}

export async function listSlips(q, pg) {
  const { where, params } = listWhere(q);
  const total = (await one(`SELECT count(*)::int AS n FROM broker_slips b LEFT JOIN clients c ON c.id = b.client_id WHERE ${where}`, params)).n;
  const rows = await many(`${SLIP_SELECT} WHERE ${where} ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  const counts = await many(`SELECT b.status, count(*)::int AS count FROM broker_slips b LEFT JOIN clients c ON c.id = b.client_id WHERE ${where} GROUP BY b.status`, params);
  return { total, rows, counts: Object.fromEntries(counts.map((r) => [r.status, r.count])) };
}
