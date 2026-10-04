import { many, one, query, withTransaction } from '../../db/pool.js';
import { baseCurrency } from '../../lib/currency.js';
import { notFound, badRequest, conflict } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { num, round2, lobOf } from '../documents/common.js';
import { policyStatusOut, policyStatusIn } from '../documents/statuses.js';
import { toQuote } from '../quotations/shape.js';
import { toClient } from '../clients/service.js';
import { toLead } from '../leads/service.js';
import { mapColumns } from '../documents/tabular.js';
import { publicUrl } from '../uploads/storage.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { writeParticipants, legacyParticipantDetails, leadOf, participantsOf } from '../placement/participants.js';
import { isoDate, postingDate, today } from '../../lib/dates.js';

/** Policy fields stored in columns; everything else the screens send (vehicle ids, photos, mortgagee ...) lives in `doc`. */
const RESERVED = ['policyId', 'id', 'client', 'lead', 'quotation', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'success', 'message', 'data',
  'status', 'paymentStatus', 'paymentMethod', 'policyNumber', 'inception', 'inceptionDate', 'expiry', 'expiryDate', 'issuedDate', 'insuredName',
  'clientId', 'quoteRefId', 'leadId', 'grossPremium', 'netPremium', 'sumInsured', 'totalSumInsured', 'billNumber', 'additionalPolicyData', 'billingMode', 'isDirectBilled'];
const docOf = (body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => !RESERVED.includes(k)));

/** LOB for rows created without one (e.g. seeded or imported policies): from the product master line. */
const lobOfLine = (line, name) => (line ? (line === 'fire' && /industrial/i.test(name || '') ? 'IAR' : line.toUpperCase()) : lobOf(name));

export function toPolicy(r) {
  if (!r) return null;
  const doc = r.doc || {};
  const client = r.client_row ? toClient(r.client_row) : null;
  const quote = r.quote_row ? toQuote(r.quote_row) : null;
  return {
    ...(quote ? { productType: quote.productType, insurancePolicyType: quote.insurancePolicyType } : {}),
    ...doc,
    id: r.id, policyId: r.id, policyNumber: r.policy_number, quoteRefId: r.quote_id, quotationId: r.quote_id, leadId: r.lead_id,
    clientId: r.client_id, status: policyStatusOut(r.status), paymentStatus: r.payment_status, paymentMethod: r.payment_method, paidAt: r.paid_at,
    insuredName: r.insured_name || client?.displayName, productType: r.product_type || quote?.productType || doc.productType || r.product_name,
    product: r.product_type || doc.product || r.product_name, lob: r.lob || lobOfLine(r.product_line, r.product_name), insuranceCompanyId: r.insurance_company_id,
    insuranceCompanyName: r.insurer_name || doc.insuranceCompanyName, inception: r.inception_date, inceptionDate: r.inception_date,
    expiry: r.expiry_date, expiryDate: r.expiry_date, issuedDate: r.issued_date, production: doc.production || r.issued_date,
    sumInsured: Number(r.sum_insured), totalSumInsured: Number(r.sum_insured), netPremium: Number(r.net_premium), grossPremium: Number(r.premium_total),
    premiumTotal: Number(r.premium_total), commissionAmount: Number(r.commission_amount), currency: r.currency, billNumber: r.bill_number,
    billingMode: r.billing_mode || 'broker', isDirectBilled: r.billing_mode === 'direct', channelId: r.channel_id ?? doc.channelId ?? null,
    // premium taxes as priced on the quotation, else as stored on the policy itself (placement slip, package, upload)
    valueAddedTax: quote?.valueAddedTax ?? doc.valueAddedTax, documentaryStampTax: quote?.documentaryStampTax ?? doc.documentaryStampTax,
    localGovernmentTax: quote?.localGovernmentTax ?? doc.localGovernmentTax, fireServiceTax: quote?.fireServiceTax ?? doc.fireServiceTax,
    discount: quote?.discount ?? doc.discount, accountPremiumOthers: quote?.accountPremiumOthers ?? doc.accountPremiumOthers,
    renewedFrom: r.renewed_from, renewedTo: r.renewed_to, client, lead: r.lead_row ? toLead(r.lead_row) : null, quotation: quote,
    fireRiskDetails: doc.fireRiskDetails || quote?.fireRiskDetails, firePremiumDetails: doc.firePremiumDetails || quote?.firePremiumDetails,
    createdBy: r.created_by_name || r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export const POLICY_SELECT = `SELECT p.*, ic.name AS insurer_name, pr.name AS product_name, pr.line AS product_line, row_to_json(c.*) AS client_row, row_to_json(l.*) AS lead_row,
  row_to_json(q.*) AS quote_row, (SELECT u.display_name FROM users u WHERE u.id = p.created_by) AS created_by_name
  FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN leads l ON l.id = p.lead_id LEFT JOIN quotes q ON q.id = p.quote_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN products pr ON pr.id = p.product_id`;

const TAX_KEYS = ['valueAddedTax', 'documentaryStampTax', 'localGovernmentTax', 'fireServiceTax'];
const hasTaxes = (p) => TAX_KEYS.some((k) => p[k] !== undefined && p[k] !== null);

/**
 * Premium taxes of a policy that only has its net and gross premium (bulk upload, go-live migration): the premium tax
 * engine (Master > Premium Taxes & LGU Rates) priced on the net premium of its line. Returned only when net + taxes +
 * charges agree with the recorded gross premium (to the peso), so a policy priced on other terms never shows invented
 * figures; otherwise null.
 */
export async function derivedPremiumTaxes({ lob, productId = null, netPremium, grossPremium }, db = null) {
  const net = round2(num(netPremium));
  const gross = round2(num(grossPremium));
  if (!(net > 0) || !(gross > net)) return null;
  const { quotationCharges } = await import('../premium-charges/service.js');
  const c = await quotationCharges({ productId }, net, lobOf(lob), db);
  const others = round2(c.others);
  const total = round2(net + TAX_KEYS.reduce((s, k) => s + num(c.tax[k]), 0) + others);
  if (Math.abs(total - gross) > 1) return null;
  return { ...Object.fromEntries(TAX_KEYS.map((k) => [k, round2(num(c.tax[k]))])), accountPremiumOthers: others, discount: 0 };
}

/** Policy API shape with its co-insurance participants (risk_participants) and the placement it was issued from. */
export async function policyWithParticipants(row, db = null) {
  let p = toPolicy(row);
  if (!hasTaxes(p)) {
    const derived = await derivedPremiumTaxes({ lob: p.lob, productId: row.product_id, netPremium: p.netPremium, grossPremium: p.grossPremium }, db);
    if (derived) p = { ...p, ...derived, premiumTaxesDerived: true };
  }
  const participants = await participantsOf('policy', row.id, db);
  return { ...p, participants, isCoInsurance: participants.length > 1 || Boolean(p.isCoInsurance), placementId: row.placement_id || null };
}

export async function getPolicyRow(id, db = null) {
  const r = await (db || { query }).query(`${POLICY_SELECT} WHERE p.id = $1 OR p.policy_number = $1`, [id]);
  if (!r.rows[0]) throw notFound('Policy not found');
  return r.rows[0];
}

/** Resolve an insurer by id, code, short name or name. */
export async function insurerId(db, value) {
  if (!value) return null;
  const r = await (db || { query }).query(`SELECT id FROM insurance_companies WHERE id::text = $1 OR lower(code) = lower($1) OR lower(short_name) = lower($1)
    OR lower(name) = lower($1) ORDER BY id LIMIT 1`, [String(value)]);
  return r.rows[0]?.id ?? null;
}

function listWhere(q) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'policy', 'p', params));
  else if (['true', '1', 'yes'].includes(String(q.mine ?? q.own ?? '').toLowerCase()) && q.currentUserId) {
    where.push(scopeSql({ ids: [q.currentUserId] }, 'policy', 'p', params));
  }
  if (q.paymentStatus) add('lower(p.payment_status) = lower(?)', q.paymentStatus);
  if (q.quoteRefId) add('p.quote_id = ?', q.quoteRefId);
  if (q.clientId) add('p.client_id = ?', q.clientId);
  if (q.leadId) add('p.lead_id = ?', q.leadId);
  // source: go-live-migration (in-force policies of the old system, go-live data workbench), bulk-upload ...
  if (q.source) add("COALESCE(p.doc->>'source', '') = ?", String(q.source));
  if (q.productType) add("(COALESCE(p.product_type, pr.name) ILIKE '%' || ? || '%' OR COALESCE(p.lob, upper(pr.line)) = upper(?))", q.productType);
  if (q.lob) add('COALESCE(p.lob, upper(pr.line)) = ?', lobOf(q.lob));
  if (q.status) add('p.status = ?', policyStatusIn(q.status) || q.status);
  if (q.insuranceCompanyName) add("(ic.name ILIKE '%' || ? || '%' OR p.doc->>'insuranceCompanyName' ILIKE '%' || ? || '%')", q.insuranceCompanyName);
  if (q.clientName) add("(c.display_name ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%')", q.clientName);
  if (q.issuedDateFrom) add('COALESCE(p.issued_date, p.created_at::date) >= ?::date', isoDate(q.issuedDateFrom));
  if (q.issuedDateTo) add('COALESCE(p.issued_date, p.created_at::date) <= ?::date', isoDate(q.issuedDateTo));
  if (q.expiryDateFrom) add('p.expiry_date >= ?::date', isoDate(q.expiryDateFrom));
  if (q.expiryDateTo) add('p.expiry_date <= ?::date', isoDate(q.expiryDateTo));
  if (q.premiumMin !== undefined && q.premiumMin !== '') add('p.premium_total >= ?::numeric', num(q.premiumMin));
  if (q.premiumMax !== undefined && q.premiumMax !== '') add('p.premium_total <= ?::numeric', num(q.premiumMax));
  const search = q.query || q.policyNumber || q.search;
  if (search) {
    add(`(p.policy_number ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%'
      OR p.doc->>'plateNumber' ILIKE '%' || ? || '%' OR p.doc->>'chassisNumber' ILIKE '%' || ? || '%' OR p.doc->>'motorNumber' ILIKE '%' || ? || '%')`, search);
  }
  return { where: where.join(' AND '), params };
}

export async function listPolicies(q, pg) {
  const { where, params } = listWhere(q);
  const joins = `FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    LEFT JOIN products pr ON pr.id = p.product_id`;
  const total = (await one(`SELECT count(*)::int AS n ${joins} WHERE ${where}`, params)).n;
  const rows = await many(`${POLICY_SELECT} WHERE ${where} ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  return { total, rows };
}

/** Column updates derived from a policy body (PUT /policies/:id, upload policy, convert). */
async function columnsFrom(db, body) {
  const cols = {};
  if (body.policyNumber) cols.policy_number = String(body.policyNumber);
  if (body.insuredName !== undefined) cols.insured_name = body.insuredName || null;
  const inception = isoDate(body.inception || body.inceptionDate);
  const expiry = isoDate(body.expiry || body.expiryDate);
  const issued = isoDate(body.issuedDate);
  if (inception) cols.inception_date = inception;
  if (expiry) cols.expiry_date = expiry;
  if (issued) cols.issued_date = issued;
  if (body.paymentStatus) cols.payment_status = await validPaymentStatus(body.paymentStatus);
  if (body.paymentMethod) cols.payment_method = body.paymentMethod;
  if (body.status) {
    const s = policyStatusIn(body.status);
    if (!s) throw badRequest(`Unknown policy status ${body.status}`);
    cols.status = s;
  }
  if (body.insuranceCompanyName || body.insuranceCompanyId) {
    const ic = await insurerId(db, body.insuranceCompanyId || body.insuranceCompanyName);
    if (ic) cols.insurance_company_id = ic;
  }
  return cols;
}

export async function validPaymentStatus(s) {
  const allowed = await getSetting('policies.payment_statuses', ['Pending', 'Reviewing', 'Partial', 'Completed', 'Refunded']);
  const match = allowed.find((x) => x.toLowerCase() === String(s).toLowerCase());
  if (!match) throw badRequest(`paymentStatus must be one of ${allowed.join(', ')}`);
  return match;
}

async function assertUniqueNumber(db, number, id) {
  const r = await db.query('SELECT id FROM policies WHERE policy_number = $1 AND id <> $2', [number, id || '']);
  if (r.rows[0]) throw conflict(`Policy number ${number} already exists`);
}

export async function updatePolicy(id, body, userId) {
  return withTransaction(async (db) => {
    const before = await getPolicyRow(id, db);
    const cols = await columnsFrom(db, body);
    if (cols.policy_number) await assertUniqueNumber(db, cols.policy_number, before.id);
    if (cols.payment_status === 'Completed' && before.payment_status !== 'Completed') cols.paid_at = new Date();
    const data = { ...cols, doc: JSON.stringify({ ...(before.doc || {}), ...docOf(body) }), updated_by: userId, updated_at: new Date() };
    const keys = Object.keys(data);
    await db.query(`UPDATE policies SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
    return { before, after: await getPolicyRow(before.id, db) };
  });
}

export async function updatePaymentStatus(id, { paymentStatus, paymentMethod }, userId) {
  const status = await validPaymentStatus(paymentStatus);
  const before = await getPolicyRow(id);
  await query(`UPDATE policies SET payment_status = $2, payment_method = COALESCE($3, payment_method), updated_by = $4, updated_at = now(),
    paid_at = CASE WHEN $2 = 'Completed' THEN COALESCE(paid_at, now()) ELSE paid_at END WHERE id = $1`, [before.id, status, paymentMethod || null, userId]);
  return { before, after: await getPolicyRow(before.id) };
}

const addMonths = (d, m) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

/**
 * Receivable (bill) for a premium amount. Delegates to the finance module so every bill is booked in the
 * ledger at issuance (Dr premium receivable / Cr due to insurer / Cr commission income) and opens a
 * collection item; the bill number comes from the invoice series (Master > Document Numbering).
 * A direct-bill policy (the client pays the insurer) has no premium bill: the commission due from the insurer is booked
 * instead (Dr commission receivable / Cr commission income / Cr output VAT) and { id: null, bill_number: null, directBill }
 * is returned.
 */
export async function createReceivable(db, { policyId, amount, source = 'policy', breakdown = {}, reference = null, user = null, endorsementId = null, date = null, split = null, payerClientId = null }) {
  const policy = (await db.query(`SELECT p.*, ic.name AS insurer_name FROM policies p
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE p.id = $1`, [policyId])).rows[0];
  if (policy?.billing_mode === 'direct') {
    const { bookDirectBill } = await import('../remittance/directbill.js');
    const item = await bookDirectBill(db, { policy, amount: round2(amount), breakdown, source, reference, endorsementId, date: date ? await postingDate(date) : null, user });
    return { id: null, bill_number: null, directBill: item };
  }
  const { createReceivable: financeReceivable } = await import('../receipts/receivables.js');
  // payerClientId: the bill is addressed to another party than the insured (a dealer paying the premium)
  return financeReceivable(db, { policy: payerClientId ? { ...policy, client_id: payerClientId } : policy, amount: round2(amount), breakdown, source, reference, date, user, split });
}

/**
 * One bill per payer of a premium split between parties ([{ clientId, amount }], amounts adding up to gross): the
 * premium breakdown and the commission go to each bill in proportion (the last one takes the rounding). Returns the bills.
 */
async function billPayers(db, { policyId, payers, gross, breakdown, commission, source, reference, userId, date }) {
  const total = round2(payers.reduce((s, p) => s + num(p.amount), 0));
  if (Math.abs(total - round2(gross)) > 0.01) throw badRequest(`The payers' shares (${total.toFixed(2)}) do not add up to the gross premium (${round2(gross).toFixed(2)})`);
  const keys = ['netPremium', 'vat', 'dst', 'lgt', 'discount'];
  const used = Object.fromEntries([...keys, 'commissionAmount'].map((k) => [k, 0]));
  const bills = [];
  for (const [i, p] of payers.entries()) {
    const last = i === payers.length - 1;
    const share = num(p.amount) / total;
    const part = {};
    for (const k of keys) part[k] = last ? round2(num(breakdown[k]) - used[k]) : round2(num(breakdown[k]) * share);
    part.commissionAmount = last ? round2(commission - used.commissionAmount) : round2(commission * share);
    for (const k of Object.keys(used)) used[k] = round2(used[k] + part[k]);
    bills.push(await createReceivable(db, { policyId, amount: num(p.amount), source, reference: p.reference || reference, user: { id: userId }, date, breakdown: part, payerClientId: p.clientId || null }));
  }
  return bills;
}

/** Roles that earn commission on the policies they produce (commission.eligible_roles, falling back to incentive.eligible_roles). */
export async function commissionEligibleRoles() {
  const roles = (await getSetting('commission.eligible_roles', null)) || (await getSetting('incentive.eligible_roles', [])) || [];
  return (Array.isArray(roles) ? roles : [roles]).map((r) => String(r).toLowerCase());
}

/** The user id when the user is active and holds a commission-earning role, else null. */
export async function eligibleCommissionUser(db, userId) {
  const roles = await commissionEligibleRoles();
  const r = await db.query(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles ro ON ro.id = ur.role_id
    WHERE u.id = $1 AND lower(ro.code) = ANY($2) LIMIT 1`, [userId, roles]);
  return r.rows[0]?.id || null;
}

const hasReferrers = (d) => Boolean(d && [d.primary, ...(d.chain || [])].some((e) => e && e.referrerId && e.referrerId !== 'direct'));

/** The commission module's accrual (referrer chain lines), when that module is installed. */
async function referrerAccrual() {
  try { return (await import('../commission/service.js')).accrueForPolicy; } catch { return null; }
}

/**
 * Commission accrual at issuance. With a referrer chain in the quote's commissionDetails the commission module creates
 * the lines; otherwise one brokerage line is accrued for the producing agent (basis = net premium, withholding at
 * the rate of the tax code commission.default_wht_code, Master > Finance > Taxation).
 */
export async function accrueCommission(db, { policyId, quoteId = null, endorsementId = null, agentUserId, basis, rate, period, details = null, user = null }) {
  const accrue = hasReferrers(details) ? await referrerAccrual() : null;
  if (accrue) {
    const ids = await accrue(db, policyId, details, user);
    return (await db.query('SELECT * FROM commissions WHERE id = ANY($1)', [ids])).rows[0] || null;
  }
  if (!rate || !basis) return null;
  // Only a producing user holding a commission-earning role (commission.eligible_roles, e.g. agent) earns the line;
  // administrators and back-office users who key in a policy do not.
  const agent = agentUserId ? await eligibleCommissionUser(db, agentUserId) : null;
  if (!agent) return null;
  const { taxCodeRate } = await import('../accounting/lib/commissionTax.js');
  const wht = (await taxCodeRate(db, await getSetting('commission.default_wht_code', 'WI515'))).rate;
  const amount = round2(basis * rate);
  const withholding = round2(amount * wht);
  const status = await getSetting('commission.initial_status', 'Accrued');
  const r = await db.query(`INSERT INTO commissions(policy_id, quote_id, endorsement_id, agent_user_id, basis_amount, rate, amount, withholding, net_amount, period, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [policyId, quoteId, endorsementId, agent, round2(basis), rate, amount, withholding, round2(amount - withholding), period, status]);
  return r.rows[0];
}

/**
 * Issue a policy inside the caller's transaction: policy row (number from settings unless the insurer's number is given),
 * receivable with bill number (or, for a direct-bill policy, the commission due from the insurer), commission accrual.
 * `src` carries the premium figures and references; the billing mode comes from body.billingMode, src.billingMode or
 * direct_bill.default_billing_mode. `src.split` (optional) is the premium split per insurer of the booking, for a
 * package whose insurers carry different sections (packages module); by default it is split by participant share.
 */
export async function issuePolicy(db, src, body, userId) {
  const cols = await columnsFrom(db, body);
  // Co-insurance: the lead participant is the policy's insurer (src.participants from the quotation or placement slip)
  const parts = Array.isArray(src.participants) && src.participants.length ? src.participants : null;
  const lead = parts ? leadOf(parts) : null;
  if (lead) cols.insurance_company_id = lead.insuranceCompanyId;
  const policyDoc = { ...(src.doc || {}), ...docOf(body) };
  if (parts) {
    policyDoc.participantDetails = await legacyParticipantDetails(parts, db, src.currency);
    policyDoc.isCoInsurance = parts.length > 1;
  }
  const { billingModeFor } = await import('../remittance/directbill.js');
  const billingMode = await billingModeFor(body.billingMode ?? (body.isDirectBilled === true ? 'direct' : null) ?? src.billingMode, cols.insurance_company_id || src.insuranceCompanyId);
  // product from the quotation, else the product whose code is the line of business (MOTOR, FIRE ...) or the product type
  const productId = src.productId || (await db.query('SELECT id FROM products WHERE upper(code) = ANY($1::text[]) ORDER BY id LIMIT 1',
    [[src.lob, src.productType].filter(Boolean).map((x) => String(x).toUpperCase())])).rows[0]?.id || null;
  const inception = cols.inception_date || await today();
  const term = Number(await getSetting('policies.default_term_months', 12));
  const expiry = cols.expiry_date || addMonths(inception, term);
  const issuedOn = cols.issued_date || await today();
  const number = cols.policy_number || await nextDocumentNumber('policy', { db, unique: { table: 'policies', column: 'policy_number' } });
  if (cols.policy_number) await assertUniqueNumber(db, number, null);
  const paymentStatus = cols.payment_status || 'Pending';
  const r = await db.query(`INSERT INTO policies(policy_number, quote_id, client_id, lead_id, product_id, policy_type_id, insurance_company_id, owner_user_id,
      status, inception_date, expiry_date, issued_date, sum_insured, net_premium, premium_total, commission_amount, currency, insured_name, product_type, lob,
      payment_status, payment_method, paid_at, doc, created_by, billing_mode)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
  [number, src.quoteId, src.clientId, src.leadId, productId, src.policyTypeId, cols.insurance_company_id || src.insuranceCompanyId, src.ownerUserId || userId,
    inception, expiry, issuedOn, src.sumInsured, src.netPremium, src.grossPremium, src.commissionAmount, src.currency,
    cols.insured_name || src.insuredName, src.productType, src.lob, paymentStatus, cols.payment_method || null, paymentStatus === 'Completed' ? new Date() : null,
    JSON.stringify(policyDoc), userId, billingMode]);
  const policyId = r.rows[0].id;
  if (src.placementId) await db.query('UPDATE policies SET placement_id = $2 WHERE id = $1', [policyId, src.placementId]);
  // risk_participants (entity policy) are always written: the co-insurance lines, else 100% of the insurer
  const d = src.doc || {};
  const taxes = src.taxes ?? round2(num(d.valueAddedTax) + num(d.documentaryStampTax) + num(d.localGovernmentTax) + num(d.fireServiceTax));
  const insurer = cols.insurance_company_id || src.insuranceCompanyId;
  const policyParts = parts || (insurer ? [{ insuranceCompanyId: insurer, sharePercent: 100, isLead: true, commissionRate: null, insurerReference: cols.policy_number || null }] : []);
  if (policyParts.length) {
    await writeParticipants(db, 'policy', policyId, policyParts, { sumInsured: src.sumInsured, premium: src.netPremium, taxes, premiumTotal: src.grossPremium, commissionAmount: src.commissionAmount },
      { userId, commissionRate: src.commissionRate ?? null });
  }
  // a policy brought by a distribution channel linked to a referrer earns the referrer's comsub (channels module)
  const { channelReferral } = await import('../channels/service.js');
  const details = { commissionDetails: src.doc?.commissionDetails || (await channelReferral(db, policyId)) || null, netPremium: src.netPremium, grossPremium: src.grossPremium, discount: src.doc?.discount ?? null };
  // Go-live migration of an in-force policy: no bill, booking journal or commission accrual (the old system billed it;
  // its open premium is loaded as an open item and the GL balances as opening balances). An open cover's policy
  // (src.billLater, marine module) is billed on its declarations instead.
  if (src.migration || src.billLater) {
    await db.query('UPDATE policies SET details = details || $2::jsonb WHERE id = $1', [policyId, JSON.stringify(details)]);
    return { policyId, receivable: null, commission: null };
  }
  // AML/CFT (migration 0260 to 0263): the client is rated with this policy and screened; the issue is refused on an
  // undecided or confirmed sanctions / PEP / negative list match, or for a High-risk client without an approved EDD review
  const { atPolicyIssue } = await import('../aml/hooks.js');
  await atPolicyIssue(db, { clientId: src.clientId, policyId, policyNumber: number, lob: src.lob || src.productType, paymentMode: cols.payment_method || null, userId });
  // A renewal term is billed as a renewal (RENEWAL booking entry) with the commission priced on the renewal quotation.
  const renewal = src.receivableSource === 'renewal';
  // booked on the issue date, so a policy keyed in after its issue lands in the month it was issued
  const breakdown = { netPremium: src.netPremium, vat: src.doc?.valueAddedTax, dst: src.doc?.documentaryStampTax, lgt: src.doc?.localGovernmentTax, discount: src.doc?.discount,
    ...(renewal ? { commissionAmount: src.commissionAmount } : {}) };
  // src.payers: the premium split between bill-to parties (a dealer or bank paying a subsidy and the insured the rest,
  // motor-programmes module); one bill each, the breakdown and commission in proportion. Otherwise one bill to the insured.
  const payers = billingMode !== 'direct' && Array.isArray(src.payers) && src.payers.filter((p) => num(p.amount) > 0).length > 1 ? src.payers.filter((p) => num(p.amount) > 0) : null;
  const receivable = payers
    ? (await billPayers(db, { policyId, payers, gross: num(src.grossPremium), breakdown, commission: num(src.commissionAmount), source: renewal ? 'renewal' : 'policy', reference: src.receivableReference || null, userId, date: issuedOn }))[0]
    : await createReceivable(db, { policyId, amount: src.grossPremium, source: renewal ? 'renewal' : 'policy', reference: src.receivableReference || null, user: { id: userId }, date: issuedOn,
      breakdown, split: src.split || null, payerClientId: src.payers?.find((p) => num(p.amount) > 0)?.clientId || null });
  await db.query('UPDATE policies SET bill_number = $2 WHERE id = $1', [policyId, receivable.bill_number]);
  await db.query('UPDATE policies SET details = details || $2::jsonb WHERE id = $1', [policyId, JSON.stringify(details)]);
  const commission = await accrueCommission(db, { policyId, quoteId: src.quoteId, agentUserId: src.agentUserId, basis: src.netPremium, rate: src.commissionRate,
    period: inception.slice(0, 7), details: details.commissionDetails, user: { id: userId } });
  // the policy is issued whatever the client's credit limit; going over it only warns Accounting
  const { warnIfOverLimit } = await import('../credit-control/limits.js');
  const creditWarning = await warnIfOverLimit(db, { clientId: src.clientId, policyId, amount: Number(receivable.amount), user: { id: userId } });
  // integrations: CTPL COC registration and authentication request, insurer issuance request (never blocks the issue)
  await (await import('../integrations/hooks.js')).afterPolicyIssued(db, policyId, userId);
  return { policyId, receivable, commission, creditWarning };
}

/** Columns of the policy bulk upload (Policies > Bulk Upload); the upload template is built from this list. */
export const POLICY_UPLOAD_COLUMNS = [
  { key: 'policyNumber', header: 'Policy Number', aliases: ['policy no'], format: 'Insurer policy number; a new BrokerVerse number is given when empty', example: 'PC-MLY-2026-000101' },
  { key: 'insuredName', header: 'Insured Name', aliases: ['client name', 'name'], required: 'Insured Name, First Name or Company Name', format: 'Full name of the insured', example: 'Maria Santos' },
  { key: 'firstName', header: 'First Name', format: 'Text', example: 'Maria' },
  { key: 'lastName', header: 'Last Name', format: 'Text', example: 'Santos' },
  { key: 'companyName', header: 'Company Name', aliases: ['company'], format: 'Text; for a corporate insured', example: '' },
  { key: 'emailId', header: 'Email', aliases: ['email'], format: 'E-mail address', example: 'maria.santos@example.ph' },
  { key: 'contactNumber', header: 'Contact Number', aliases: ['mobile', 'phone'], format: 'Mobile or landline number', example: '09171234567' },
  { key: 'productType', header: 'Product Type', aliases: ['product', 'lob'], format: 'Product or line of business; Motor when empty', allowed: ['Motor', 'Fire', 'IAR'], example: 'Motor' },
  { key: 'insuranceCompanyName', header: 'Insurance Company', aliases: ['insuranceCompanyName', 'insurer'], format: 'Insurer name or code as in the Insurance Company master', example: 'Malayan Insurance Co., Inc.' },
  { key: 'inception', header: 'Inception Date', aliases: ['effective date', 'start date'], format: 'Date YYYY-MM-DD; today when empty', example: '2026-10-01' },
  { key: 'expiry', header: 'Expiry Date', aliases: ['end date'], format: 'Date YYYY-MM-DD; inception plus the default term when empty', example: '2027-10-01' },
  { key: 'issuedDate', header: 'Issue Date', aliases: ['issued date'], format: 'Date YYYY-MM-DD; today when empty', example: '2026-09-28' },
  { key: 'sumInsured', header: 'Sum Insured', aliases: ['totalSumInsured'], format: 'Amount in PHP, no currency sign', example: '1250000' },
  { key: 'netPremium', header: 'Net Premium', format: 'Amount in PHP; the gross premium when empty', example: '28750' },
  { key: 'grossPremium', header: 'Gross Premium', aliases: ['premium', 'total premium'], required: true, format: 'Amount in PHP, greater than zero', example: '35946.88' },
  { key: 'plateNumber', header: 'Plate Number', aliases: ['plate no'], format: 'Motor only', example: 'NCA 4521' },
  { key: 'paymentStatus', header: 'Payment Status', format: 'Pending when empty', allowed: ['Pending', 'Reviewing', 'Partial', 'Completed', 'Refunded'], example: 'Pending' },
];

/** Map an uploaded policy row to the issuance inputs. */
export function policyFromRow(row) {
  const v = mapColumns(row, POLICY_UPLOAD_COLUMNS);
  const gross = num(v.grossPremium);
  return { ...v, productType: v.productType || 'Motor', sumInsured: num(v.sumInsured), netPremium: num(v.netPremium) || gross, grossPremium: gross, paymentStatus: v.paymentStatus || 'Pending' };
}

/**
 * Create the client and issue an uploaded policy. migration: an in-force policy of the old system loaded at go-live
 * (no bill, booking journal or commission accrual; source go-live-migration).
 */
export async function importPolicy(db, p, userId, { migration = false } = {}) {
  if (!p.grossPremium) throw badRequest('grossPremium is required');
  if (!p.firstName && !p.companyName && !p.insuredName) throw badRequest('insuredName (or firstName / companyName) is required');
  const [first, ...rest] = (p.insuredName || '').split(' ');
  const firstName = p.firstName || (p.companyName ? null : first);
  const lastName = p.lastName || (p.companyName ? null : rest.join(' ') || null);
  const code = await nextDocumentNumber('client', { db, unique: { table: 'clients', column: 'client_code' } });
  const cl = await db.query(`INSERT INTO clients(client_code, first_name, last_name, company_name, display_name, email, phone, source, created_by, owner_user_id,
      client_type, lead_category) VALUES ($1,$2,$3,$4,$5,$6,$7,'bulk-upload',$8,$8,$9,$10) RETURNING id`,
  [code, firstName, lastName, p.companyName || null, p.insuredName || [firstName, lastName].filter(Boolean).join(' ') || p.companyName, p.emailId || null,
    p.contactNumber || null, userId, p.companyName ? 'corporate' : 'individual', p.companyName ? 'Corporate' : 'Retail']);
  const icId = await insurerId(db, p.insuranceCompanyName);
  const rate = icId ? Number((await db.query('SELECT commission_rate FROM insurance_companies WHERE id = $1', [icId])).rows[0]?.commission_rate || 0)
    : Number(await getSetting('commission.default_rate', 0.15));
  return issuePolicy(db, {
    clientId: cl.rows[0].id, insuranceCompanyId: icId, sumInsured: p.sumInsured, netPremium: p.netPremium, grossPremium: p.grossPremium,
    commissionAmount: round2(p.netPremium * rate), commissionRate: rate, currency: await baseCurrency(),
    insuredName: p.insuredName, productType: p.productType, lob: lobOf(p.productType), agentUserId: userId, ownerUserId: userId,
    doc: { plateNumber: p.plateNumber, source: migration ? 'go-live-migration' : 'bulk-upload',
      // the premium breakdown the uploaded net and gross agree with (VAT, DST, LGT, FST of the line)
      ...((await derivedPremiumTaxes({ lob: lobOf(p.productType), netPremium: p.netPremium, grossPremium: p.grossPremium }, db)) || {}) }, migration,
  }, { policyNumber: p.policyNumber, inception: p.inception, expiry: p.expiry, issuedDate: p.issuedDate, paymentStatus: p.paymentStatus, insuranceCompanyName: p.insuranceCompanyName }, userId);
}

/** Uploaded and generated documents of a policy (files linked to the policy, its quotation or its endorsements). */
export async function policyDocuments(policyRow, baseUrl) {
  const ids = [policyRow.id, policyRow.quote_id, ...(await many('SELECT id FROM endorsements WHERE policy_id = $1', [policyRow.id])).map((e) => e.id)].filter(Boolean);
  const files = await many(`SELECT storage_key AS key, file_name AS "fileName", content_type AS "contentType", size_bytes AS "sizeBytes", category,
    entity_id AS "entityId", status, created_at AS "createdAt" FROM documents WHERE entity_id = ANY($1) ORDER BY created_at DESC`, [ids]);
  const lob = policyRow.lob;
  const generated = [
    { type: 'policy-schedule', fileName: `policy-schedule-${policyRow.policy_number}.pdf`, url: `${baseUrl}/api/document-templates/${lob === 'MOTOR' ? 'policy-schedule' : 'policy-schedule-fire'}/${policyRow.id}` },
    { type: 'billing-statement', fileName: `billing-statement-${policyRow.policy_number}.pdf`, url: `${baseUrl}/api/billing-statement/policy/${policyRow.id}/generate` },
    ...(lob !== 'MOTOR' ? [{ type: 'insurance-placing-slip', fileName: `placing-slip-${policyRow.policy_number}.pdf`, url: `${baseUrl}/api/policies/${policyRow.id}/documents/insurance-placing-slip-fire` }] : []),
  ];
  // the other policy documents of the product template (Product Configurator > Document Manager), e.g. the CTPL certificate
  const { productDocuments } = await import('../documents/productDocuments.js');
  const { documents } = await productDocuments({ productId: policyRow.product_id, lob });
  for (const d of documents.filter((x) => x.printAs && !['policy-schedule', 'quotation-slip'].includes(x.printAs) && /issu/i.test(x.stage || 'Policy Issuance'))) {
    generated.push({ type: d.printAs, documentCode: d.documentCode, title: d.documentName, fileName: `${d.documentCode}-${policyRow.policy_number}.pdf`,
      url: `${baseUrl}/api/document-templates/product-document/${d.id}/policy/${policyRow.id}` });
  }
  return { files: files.map((f) => ({ ...f, downloadUrl: publicUrl(f.key) })), generated };
}
