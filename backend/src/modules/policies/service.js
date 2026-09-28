import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest, conflict } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextNumber, toDate, num, round2, lobOf } from '../documents/common.js';
import { policyStatusOut, policyStatusIn } from '../documents/statuses.js';
import { toQuote } from '../quotations/shape.js';
import { toClient } from '../clients/service.js';
import { toLead } from '../leads/service.js';
import { pick } from '../documents/tabular.js';
import { publicUrl } from '../uploads/storage.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';

/** Policy fields stored in columns; everything else the screens send (vehicle ids, photos, mortgagee ...) lives in `doc`. */
const RESERVED = ['policyId', 'id', 'client', 'lead', 'quotation', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'success', 'message', 'data',
  'status', 'paymentStatus', 'paymentMethod', 'policyNumber', 'inception', 'inceptionDate', 'expiry', 'expiryDate', 'issuedDate', 'insuredName',
  'clientId', 'quoteRefId', 'leadId', 'grossPremium', 'netPremium', 'sumInsured', 'totalSumInsured', 'billNumber', 'additionalPolicyData'];
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
    valueAddedTax: quote?.valueAddedTax, documentaryStampTax: quote?.documentaryStampTax, localGovernmentTax: quote?.localGovernmentTax,
    fireServiceTax: quote?.fireServiceTax, discount: quote?.discount, accountPremiumOthers: quote?.accountPremiumOthers,
    renewedFrom: r.renewed_from, renewedTo: r.renewed_to, client, lead: r.lead_row ? toLead(r.lead_row) : null, quotation: quote,
    fireRiskDetails: doc.fireRiskDetails || quote?.fireRiskDetails, firePremiumDetails: doc.firePremiumDetails || quote?.firePremiumDetails,
    createdBy: r.created_by_name || r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export const POLICY_SELECT = `SELECT p.*, ic.name AS insurer_name, pr.name AS product_name, pr.line AS product_line, row_to_json(c.*) AS client_row, row_to_json(l.*) AS lead_row,
  row_to_json(q.*) AS quote_row, (SELECT u.display_name FROM users u WHERE u.id = p.created_by) AS created_by_name
  FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN leads l ON l.id = p.lead_id LEFT JOIN quotes q ON q.id = p.quote_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN products pr ON pr.id = p.product_id`;

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
  if (q.productType) add("(COALESCE(p.product_type, pr.name) ILIKE '%' || ? || '%' OR COALESCE(p.lob, upper(pr.line)) = upper(?))", q.productType);
  if (q.lob) add('COALESCE(p.lob, upper(pr.line)) = ?', lobOf(q.lob));
  if (q.status) add('p.status = ?', policyStatusIn(q.status) || q.status);
  if (q.insuranceCompanyName) add("(ic.name ILIKE '%' || ? || '%' OR p.doc->>'insuranceCompanyName' ILIKE '%' || ? || '%')", q.insuranceCompanyName);
  if (q.clientName) add("(c.display_name ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%')", q.clientName);
  if (q.issuedDateFrom) add('COALESCE(p.issued_date, p.created_at::date) >= ?::date', toDate(q.issuedDateFrom));
  if (q.issuedDateTo) add('COALESCE(p.issued_date, p.created_at::date) <= ?::date', toDate(q.issuedDateTo));
  if (q.expiryDateFrom) add('p.expiry_date >= ?::date', toDate(q.expiryDateFrom));
  if (q.expiryDateTo) add('p.expiry_date <= ?::date', toDate(q.expiryDateTo));
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
  const inception = toDate(body.inception || body.inceptionDate);
  const expiry = toDate(body.expiry || body.expiryDate);
  const issued = toDate(body.issuedDate);
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
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Receivable (bill) for a premium amount; bill number from numbering.invoice.prefix. */
export async function createReceivable(db, { policyId, clientId, amount, fromDate }) {
  const bill = await nextNumber(db, 'invoice', 'invoice');
  const dueDays = Number(await getSetting('receivables.due_days', 30));
  const r = await db.query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date)
    VALUES ($1,$2,$3,$4,$4,$5) RETURNING *`, [bill, policyId, clientId, round2(amount), addDays(fromDate, dueDays)]);
  return r.rows[0];
}

const hasReferrers = (d) => Boolean(d && [d.primary, ...(d.chain || [])].some((e) => e && e.referrerId && e.referrerId !== 'direct'));

/** The commission module's accrual (referrer chain lines), when that module is installed. */
async function referrerAccrual() {
  try { return (await import('../commission/service.js')).accrueForPolicy; } catch { return null; }
}

/**
 * Commission accrual at issuance. With a referrer chain in the quote's commissionDetails the commission module creates
 * the lines; otherwise one brokerage line is accrued for the producing agent (basis = net premium, withholding at
 * tax.withholding_rate).
 */
export async function accrueCommission(db, { policyId, quoteId = null, endorsementId = null, agentUserId, basis, rate, period, details = null, user = null }) {
  const accrue = hasReferrers(details) ? await referrerAccrual() : null;
  if (accrue) {
    const ids = await accrue(db, policyId, details, user);
    return (await db.query('SELECT * FROM commissions WHERE id = ANY($1)', [ids])).rows[0] || null;
  }
  if (!rate || !basis) return null;
  const wht = Number(await getSetting('tax.withholding_rate', 0));
  const amount = round2(basis * rate);
  const withholding = round2(amount * wht);
  const agent = agentUserId ? (await db.query('SELECT id FROM users WHERE id = $1', [agentUserId])).rows[0]?.id : null;
  const status = await getSetting('commission.initial_status', 'Accrued');
  const r = await db.query(`INSERT INTO commissions(policy_id, quote_id, endorsement_id, agent_user_id, basis_amount, rate, amount, withholding, net_amount, period, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [policyId, quoteId, endorsementId, agent, round2(basis), rate, amount, withholding, round2(amount - withholding), period, status]);
  return r.rows[0];
}

/**
 * Issue a policy inside the caller's transaction: policy row (number from settings unless the insurer's number is given),
 * receivable with bill number, commission accrual. `src` carries the premium figures and references.
 */
export async function issuePolicy(db, src, body, userId) {
  const cols = await columnsFrom(db, body);
  const inception = cols.inception_date || toDate(new Date());
  const term = Number(await getSetting('policies.default_term_months', 12));
  const expiry = cols.expiry_date || addMonths(inception, term);
  const number = cols.policy_number || await nextNumber(db, 'policy', 'policy');
  if (cols.policy_number) await assertUniqueNumber(db, number, null);
  const paymentStatus = cols.payment_status || 'Pending';
  const r = await db.query(`INSERT INTO policies(policy_number, quote_id, client_id, lead_id, product_id, policy_type_id, insurance_company_id, owner_user_id,
      status, inception_date, expiry_date, issued_date, sum_insured, net_premium, premium_total, commission_amount, currency, insured_name, product_type, lob,
      payment_status, payment_method, paid_at, doc, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
  [number, src.quoteId, src.clientId, src.leadId, src.productId, src.policyTypeId, cols.insurance_company_id || src.insuranceCompanyId, src.ownerUserId || userId,
    inception, expiry, cols.issued_date || toDate(new Date()), src.sumInsured, src.netPremium, src.grossPremium, src.commissionAmount, src.currency,
    cols.insured_name || src.insuredName, src.productType, src.lob, paymentStatus, cols.payment_method || null, paymentStatus === 'Completed' ? new Date() : null,
    JSON.stringify({ ...(src.doc || {}), ...docOf(body) }), userId]);
  const policyId = r.rows[0].id;
  const receivable = await createReceivable(db, { policyId, clientId: src.clientId, amount: src.grossPremium, fromDate: inception });
  await db.query('UPDATE policies SET bill_number = $2 WHERE id = $1', [policyId, receivable.bill_number]);
  const details = { commissionDetails: src.doc?.commissionDetails || null, netPremium: src.netPremium, grossPremium: src.grossPremium, discount: src.doc?.discount ?? null };
  await db.query('UPDATE policies SET details = details || $2::jsonb WHERE id = $1', [policyId, JSON.stringify(details)]);
  const commission = await accrueCommission(db, { policyId, quoteId: src.quoteId, agentUserId: src.agentUserId, basis: src.netPremium, rate: src.commissionRate,
    period: inception.slice(0, 7), details: details.commissionDetails, user: { id: userId } });
  return { policyId, receivable, commission };
}

/** Map an uploaded policy row to the issuance inputs. */
export function policyFromRow(row) {
  const gross = num(pick(row, 'grossPremium', 'gross premium', 'premium', 'total premium'));
  return {
    policyNumber: pick(row, 'policyNumber', 'policy number', 'policy no'),
    insuredName: pick(row, 'insuredName', 'insured name', 'client name', 'name'),
    firstName: pick(row, 'firstName', 'first name'), lastName: pick(row, 'lastName', 'last name'), companyName: pick(row, 'companyName', 'company'),
    emailId: pick(row, 'email', 'emailId'), contactNumber: pick(row, 'contactNumber', 'contact number', 'mobile', 'phone'),
    productType: pick(row, 'productType', 'product type', 'product', 'lob') || 'Motor',
    insuranceCompanyName: pick(row, 'insuranceCompanyName', 'insurance company', 'insurer'),
    inception: pick(row, 'inception', 'inception date', 'effective date', 'start date'), expiry: pick(row, 'expiry', 'expiry date', 'end date'),
    issuedDate: pick(row, 'issuedDate', 'issued date', 'issue date'), sumInsured: num(pick(row, 'sumInsured', 'sum insured', 'totalSumInsured')),
    netPremium: num(pick(row, 'netPremium', 'net premium')) || gross, grossPremium: gross,
    plateNumber: pick(row, 'plateNumber', 'plate number', 'plate no'), paymentStatus: pick(row, 'paymentStatus', 'payment status') || 'Pending',
  };
}

export async function importPolicy(db, p, userId) {
  if (!p.grossPremium) throw badRequest('grossPremium is required');
  if (!p.firstName && !p.companyName && !p.insuredName) throw badRequest('insuredName (or firstName / companyName) is required');
  const [first, ...rest] = (p.insuredName || '').split(' ');
  const firstName = p.firstName || (p.companyName ? null : first);
  const lastName = p.lastName || (p.companyName ? null : rest.join(' ') || null);
  const code = await nextNumber(db, 'client', 'client');
  const cl = await db.query(`INSERT INTO clients(client_code, first_name, last_name, company_name, display_name, email, phone, source, created_by, owner_user_id,
      client_type, lead_category) VALUES ($1,$2,$3,$4,$5,$6,$7,'bulk-upload',$8,$8,$9,$10) RETURNING id`,
  [code, firstName, lastName, p.companyName || null, p.insuredName || [firstName, lastName].filter(Boolean).join(' ') || p.companyName, p.emailId || null,
    p.contactNumber || null, userId, p.companyName ? 'corporate' : 'individual', p.companyName ? 'Corporate' : 'Retail']);
  const icId = await insurerId(db, p.insuranceCompanyName);
  const rate = icId ? Number((await db.query('SELECT commission_rate FROM insurance_companies WHERE id = $1', [icId])).rows[0]?.commission_rate || 0)
    : Number(await getSetting('commission.default_rate', 0));
  return issuePolicy(db, {
    clientId: cl.rows[0].id, insuranceCompanyId: icId, sumInsured: p.sumInsured, netPremium: p.netPremium, grossPremium: p.grossPremium,
    commissionAmount: round2(p.netPremium * rate), commissionRate: rate, currency: await getSetting('currency.default', 'PHP'),
    insuredName: p.insuredName, productType: p.productType, lob: lobOf(p.productType), agentUserId: userId, ownerUserId: userId,
    doc: { plateNumber: p.plateNumber, source: 'bulk-upload' },
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
  return { files: files.map((f) => ({ ...f, downloadUrl: publicUrl(f.key) })), generated };
}
