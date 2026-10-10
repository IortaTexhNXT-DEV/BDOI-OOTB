import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { assertBirthDate } from '../../lib/birthDate.js';
import { lobOf } from '../documents/common.js';
import { mapColumns } from '../documents/tabular.js';
import { quoteStatusIn } from '../documents/statuses.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { isoDate } from '../../lib/dates.js';
import { fillRegion } from '../../lib/address.js';
import { productOfLine } from '../placement/productLines.js';
import { assignNewLead, assignTaggedLead } from './assignment.js';

/** Fields the lead screens send, mapped to columns. Anything else is kept in `extra`. */
const FIELD_MAP = {
  firstName: 'first_name', lastName: 'last_name', preferredName: 'preferred_name', companyName: 'company_name',
  gender: 'gender', emailId: 'email', contactNumber: 'phone', houseNo: 'house_no', barangay: 'barangay',
  city: 'city', province: 'state', region: 'region', country: 'country', zipCode: 'postal_code', roadThanon: 'road', soiAlley: 'soi',
  mooVillage: 'moo', street: 'road', leadCategory: 'lead_category', taxInformationNumber: 'tax_number', source: 'source', notes: 'notes',
  productType: 'product_interest', status: 'status', channelId: 'channel_id', branchCode: 'branch_code',
  customerType: 'customer_type', loanId: 'loan_id', tfsReference: 'tfs_reference', productGroup: 'product_group', disposition: 'disposition',
  insuranceProviderId: 'insurance_provider_id', srp: 'srp',
};
/** Dates of a TFS account, as given (YYYY-MM-DD or a date). */
const DATE_FIELDS = { policyExpiryDate: 'policy_expiry_date', loanStartDate: 'loan_start_date', loanBookingDate: 'loan_booking_date', loanMaturityDate: 'loan_maturity_date' };
/** The vehicle of a TFS account (leads.vehicle). */
export const VEHICLE_KEYS = ['make', 'model', 'variant', 'modelYear', 'plateNumber', 'chassisNumber', 'engineNumber'];
const KNOWN = new Set([...Object.keys(FIELD_MAP), 'DOB', 'lob', 'productId', 'product', 'productName', 'email', 'mobileNumber', 'createdBy', 'updatedBy', 'leadId', 'id',
  'generatedLeadId', 'leadNumber', 'createdAt', 'updatedAt', 'quotationsCount', 'clientId', 'ownerUserId', 'ownerName', 'channelName', 'assignmentStatus', 'queueReason',
  ...Object.keys(DATE_FIELDS), 'vehicle', 'insuranceProviderName', 'importBatchId', 'importBatchNumber']);

/** Row -> the lead object the screens read (leadId, generatedLeadId, emailId, contactNumber, DOB ...). */
export function toLead(r) {
  if (!r) return null;
  return {
    ...(r.extra || {}),
    id: r.id, leadId: r.id, generatedLeadId: r.lead_number, leadNumber: r.lead_number,
    firstName: r.first_name, lastName: r.last_name, preferredName: r.preferred_name, fullName: r.display_name,
    DOB: r.birth_date, gender: r.gender, emailId: r.email, email: r.email, contactNumber: r.phone, mobileNumber: r.phone,
    houseNo: r.house_no, barangay: r.barangay, city: r.city, province: r.state, region: r.region, country: r.country, zipCode: r.postal_code,
    street: r.road, roadThanon: r.road, soiAlley: r.soi, mooVillage: r.moo, leadCategory: r.lead_category, companyName: r.company_name,
    taxInformationNumber: r.tax_number, lob: r.lob, productType: r.product_interest, productId: r.product_id ?? null, productName: r.product_name ?? null,
    productTagged: Boolean(r.lob), source: r.source, notes: r.notes,
    status: r.status, clientId: r.client_id, ownerUserId: r.owner_user_id, quotationsCount: r.quotations_count ?? 0,
    channelId: r.channel_id ?? null, channelName: r.channel_name ?? null, branchCode: r.branch_code ?? null, ownerName: r.owner_name ?? null,
    assignmentStatus: r.assignment_status ?? null, queueReason: r.queue_reason ?? null,
    customerType: r.customer_type ?? null, loanId: r.loan_id ?? null, tfsReference: r.tfs_reference ?? null, insuranceProviderId: r.insurance_provider_id ?? null,
    insuranceProviderName: r.insurance_provider_name ?? null, policyExpiryDate: r.policy_expiry_date ?? null, loanStartDate: r.loan_start_date ?? null,
    loanBookingDate: r.loan_booking_date ?? null, loanMaturityDate: r.loan_maturity_date ?? null, srp: r.srp ?? null, productGroup: r.product_group ?? null,
    vehicle: r.vehicle && Object.keys(r.vehicle).length ? r.vehicle : null, disposition: r.disposition ?? null, importBatchId: r.import_batch_id ?? null,
    importBatchNumber: r.import_batch_number ?? null,
    createdBy: r.created_by_name || r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** lob filter of the prospects whose product is not yet tagged (the Prospects tab Product not yet tagged). */
export const UNTAGGED = 'none';
/** How a prospect without a product reads on the report, the stats and the lead funnel. */
export const UNTAGGED_LABEL = 'Product not yet tagged';

const displayName = (b) => [b.firstName, b.lastName].filter(Boolean).join(' ').trim() || b.companyName || b.preferredName || 'Unnamed lead';

function columnsFrom(body) {
  const cols = {};
  for (const [k, c] of Object.entries(FIELD_MAP)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (body.emailId === undefined && body.email !== undefined) cols.email = body.email || null;
  if (body.contactNumber === undefined && body.mobileNumber !== undefined) cols.phone = body.mobileNumber || null;
  if (body.DOB !== undefined) cols.birth_date = isoDate(body.DOB);
  if (body.lob !== undefined) cols.lob = body.lob ? lobOf(body.lob) : null;
  for (const [k, c] of Object.entries(DATE_FIELDS)) if (body[k] !== undefined) cols[c] = isoDate(body[k]);
  if (body.vehicle !== undefined) cols.vehicle = JSON.stringify(Object.fromEntries(VEHICLE_KEYS.filter((k) => body.vehicle?.[k] !== undefined && body.vehicle?.[k] !== '').map((k) => [k, body.vehicle[k]])));
  if (cols.srp !== undefined) cols.srp = cols.srp === null || cols.srp === '' ? null : Number(String(cols.srp).replace(/,/g, ''));
  if (cols.insurance_provider_id !== undefined) cols.insurance_provider_id = cols.insurance_provider_id ? Number(cols.insurance_provider_id) : null;
  const extra = Object.fromEntries(Object.entries(body).filter(([k]) => !KNOWN.has(k)));
  return { cols, extra };
}

const SELECT = `SELECT l.*, (SELECT count(*)::int FROM quotes q WHERE q.lead_id = l.id AND q.deleted_at IS NULL) AS quotations_count,
  (SELECT u.display_name FROM users u WHERE u.id = l.created_by) AS created_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = l.owner_user_id) AS owner_name,
  (SELECT ch.name FROM distribution_channels ch WHERE ch.id = l.channel_id) AS channel_name,
  (SELECT p.name FROM products p WHERE p.id = l.product_id) AS product_name,
  (SELECT ic.name FROM insurance_companies ic WHERE ic.id = l.insurance_provider_id) AS insurance_provider_name,
  (SELECT b.batch_number FROM lead_import_batches b WHERE b.id = l.import_batch_id) AS import_batch_number FROM leads l`;

/**
 * Line of business and product columns from a body naming a product (productId, else `product` by code or name): the
 * product must be an active product of the line given, and the line follows the product. {} when no product is named.
 */
async function productColumns(db, body) {
  const ref = body.productId ?? body.product;
  if (ref === undefined || ref === null || String(ref).trim() === '') return {};
  const p = await productOfLine(db, { lob: body.lob, product: ref }, body.productId !== undefined ? 'productId' : 'product');
  return { lob: p.lob, product_id: p.id, product_interest: p.name };
}

/** The line and product of a prospect as the audit trail records them. */
export const productTagOf = (r) => ({ lob: r.lob, productId: r.product_id, productName: r.product_name || r.product_interest || null });

export async function getLead(id, db = null) {
  const r = (await (db || { query }).query(`${SELECT} WHERE (l.id = $1 OR l.lead_number = $1) AND l.deleted_at IS NULL`, [id])).rows[0];
  if (!r) throw notFound('Lead not found');
  return r;
}

/** Source of the leads of a bulk upload that name none. */
export const UPLOAD_SOURCE = 'bulk-upload';
/** Sources the system sets itself (uploads, dealer programme sales): not checked against the Lead Source master. */
const SYSTEM_SOURCES = new Set([UPLOAD_SOURCE, 'dealer-programme']);

/**
 * The Source of a prospect from the Lead Source master (Master > Insurance Management > Lead Sources), matched by code
 * or name and stored as the master's name. A value the master does not know is kept as typed, or refused when
 * leads.source_list_only is on. Empty: null.
 */
export async function leadSource(db, value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (SYSTEM_SOURCES.has(v)) return v;
  const known = (await db.query(`SELECT name FROM master_records WHERE type_code = 'lead-source' AND status = 'active' AND (lower(code) = lower($1) OR lower(name) = lower($1))
    ORDER BY (lower(code) = lower($1)) DESC LIMIT 1`, [v])).rows[0];
  if (known) return known.name;
  if (await getSetting('leads.source_list_only', false)) {
    throw badRequest('Validation failed', [{ path: 'source', message: `Source ${v} is not a lead source of Master > Insurance Management > Lead Sources` }]);
  }
  return v;
}

/** Prospect statuses that end the prospect: a converted prospect is never reopened (its client account exists). */
const FINAL_STATUSES = ['Converted', 'converted'];

/**
 * The values of a prospect that come from lists (TIS-BRD-LEAD-05, LEAD-07, MAS-10): Lead Category (leads.categories),
 * Customer Type (leads.customer_types), status (leads.statuses), disposition (leads.dispositions) and the insurance
 * provider (an insurer of the Insurance Company master). before: the prospect being changed.
 */
export async function assertLeadValues(cols, before = null, db = { query }) {
  const errors = [];
  const oneOf = async (col, key, fallback, path, label) => {
    if (cols[col] === undefined || cols[col] === null || cols[col] === '') return;
    const list = (await getSetting(key, fallback)) || fallback;
    const hit = list.find((x) => String(x).toLowerCase() === String(cols[col]).trim().toLowerCase());
    if (hit) cols[col] = hit;
    else errors.push({ path, message: `${label} must be one of ${list.join(', ')}` });
  };
  await oneOf('lead_category', 'leads.categories', ['Retail', 'Corporate'], 'leadCategory', 'Lead Category');
  await oneOf('customer_type', 'leads.customer_types', ['TFS', 'Non-TFS', 'Direct Customer'], 'customerType', 'Customer Type');
  await oneOf('status', 'leads.statuses', ['New', 'Contacted', 'Qualified', 'QuoteGenerated', 'Converted', 'Lost'], 'status', 'Status');
  await oneOf('disposition', 'leads.dispositions', [], 'disposition', 'Disposition');
  if (before && FINAL_STATUSES.includes(before.status) && cols.status !== undefined && !FINAL_STATUSES.includes(cols.status)) {
    errors.push({ path: 'status', message: `Prospect ${before.lead_number} is converted; its status cannot change` });
  }
  if (cols.insurance_provider_id) {
    const ic = (await db.query("SELECT id FROM insurance_companies WHERE id = $1 AND status = 'active'", [cols.insurance_provider_id])).rows[0];
    if (!ic) errors.push({ path: 'insuranceProviderId', message: 'The insurance provider is not an active insurer of Master > Insurance Company' });
  }
  if (cols.srp !== undefined && cols.srp !== null && !(Number.isFinite(cols.srp) && cols.srp >= 0)) errors.push({ path: 'srp', message: 'SRP must be an amount in pesos' });
  if (errors.length) throw badRequest(errors[0].message, errors);
}

/** A Loan ID already on another prospect: the TFS loan is the de-duplication key (TIS-BRD-LEAD-02). */
async function assertLoanFree(db, loanId, leadId = null) {
  if (!loanId) return;
  const other = (await db.query('SELECT lead_number FROM leads WHERE lower(loan_id) = lower($1) AND deleted_at IS NULL AND ($2::text IS NULL OR id <> $2)', [loanId, leadId])).rows[0];
  if (other) throw badRequest(`Loan ID ${loanId} is already on prospect ${other.lead_number}`, [{ path: 'loanId', message: `Loan ID ${loanId} is already on prospect ${other.lead_number}` }]);
}

export async function createLead(body, userId, db = null) {
  const { cols, extra } = columnsFrom(body);
  await assertLeadValues(cols, null, db || { query });
  await assertLoanFree(db || { query }, cols.loan_id);
  if (!cols.first_name && !cols.company_name) throw badRequest('firstName or companyName is required');
  if (cols.source !== undefined) cols.source = await leadSource(db || { query }, cols.source);
  // the product may be tagged later (Create Prospect > Skip - tag product later) unless leads.product_required is on
  Object.assign(cols, await productColumns(db || { query }, body));
  if (!cols.lob && await getSetting('leads.product_required', false)) {
    throw badRequest('Validation failed', [{ path: 'lob', message: 'Choose the line of business and the product of the prospect' }]);
  }
  await assertBirthDate(cols.birth_date);
  await fillRegion(cols, undefined, db);
  const run = async (c) => {
    // a prospect raised for an existing customer is linked to that client (no second client when it converts)
    if (body.clientId) {
      const client = (await c.query('SELECT id FROM clients WHERE id = $1 OR client_code = $1', [String(body.clientId)])).rows[0];
      if (!client) throw badRequest('Validation failed', [{ path: 'clientId', message: 'The selected client does not exist' }]);
      cols.client_id = client.id;
    }
    if (cols.channel_id) await assertChannel(c, cols.channel_id);
    // the prospect's branch (assignment rules by branch): as given, else the creator's branch
    if (!cols.branch_code && userId) cols.branch_code = (await c.query('SELECT branch_code FROM users WHERE id = $1', [userId])).rows[0]?.branch_code || null;
    const number = await nextDocumentNumber('lead', { db: c, unique: { table: 'leads', column: 'lead_number' } });
    const status = cols.status || await getSetting('leads.default_status', 'New');
    const data = { ...cols, status, lead_number: number, display_name: displayName(body), extra: JSON.stringify(extra),
      lob: cols.lob || null, lead_category: cols.lead_category || 'Retail', created_by: userId, owner_user_id: userId, assigned_at: new Date() };
    const keys = Object.keys(data);
    const r = await c.query(`INSERT INTO leads(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data));
    // lead assignment rules (Operations > Sales & Marketing > Lead Assignment) choose the account executive
    await assignNewLead(c, r.rows[0].id, userId);
    return r.rows[0].id;
  };
  const id = db ? await run(db) : await withTransaction(run);
  return getLead(id, db);
}

export async function updateLead(id, body, userId) {
  const before = await getLead(id);
  const { cols, extra } = columnsFrom(body);
  await assertLeadValues(cols, before);
  if (cols.loan_id !== undefined) await assertLoanFree({ query }, cols.loan_id, before.id);
  if (cols.source !== undefined && cols.source !== before.source) cols.source = await leadSource({ query }, cols.source);
  Object.assign(cols, await productColumns({ query }, body));
  // a new line without a product drops the product of the old line
  if (cols.lob !== undefined && cols.lob !== before.lob && cols.product_id === undefined) cols.product_id = null;
  if (cols.channel_id) await assertChannel({ query }, cols.channel_id);
  await assertBirthDate(cols.birth_date);
  await fillRegion(cols);
  const merged = { first_name: before.first_name, last_name: before.last_name, company_name: before.company_name, preferred_name: before.preferred_name };
  const next = { ...merged, ...cols };
  const data = { ...cols, display_name: displayName({ firstName: next.first_name, lastName: next.last_name, companyName: next.company_name, preferredName: next.preferred_name }),
    extra: JSON.stringify({ ...(before.extra || {}), ...extra }), updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await query(`UPDATE leads SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before, after: await getLead(before.id) };
}

/**
 * Tag or change the line of business and product of a prospect (Prospects > Tag product, or the product asked for
 * before its first quotation). A prospect waiting in the reassignment queue because no rule matched is offered to the
 * assignment rules again with its line.
 */
export async function tagProduct(id, { lob, productId }, userId) {
  const before = await getLead(id);
  return withTransaction(async (c) => {
    const p = await productOfLine(c, { lob, product: productId });
    await c.query('UPDATE leads SET lob = $2, product_id = $3, product_interest = $4, updated_by = $5, updated_at = now() WHERE id = $1',
      [before.id, p.lob, p.id, p.name, userId]);
    await assignTaggedLead(c, before.id, userId);
    return { before, after: await getLead(before.id, c) };
  });
}

/** A distribution channel given on a prospect must exist and be active (Master > Insurance Management > Distribution Channels). */
async function assertChannel(db, id) {
  const ch = (await db.query('SELECT status FROM distribution_channels WHERE id = $1', [id])).rows[0];
  if (!ch) throw badRequest('Validation failed', [{ path: 'channelId', message: 'The selected distribution channel does not exist' }]);
  if (ch.status !== 'active') throw badRequest('Validation failed', [{ path: 'channelId', message: 'The selected distribution channel is inactive' }]);
}

/** Prospect statuses that are no longer worked. */
const CLOSED_STATUSES = ['Converted', 'Lost', 'converted', 'lost'];
const lastDigits = (v) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : null;
};

/**
 * Possible duplicates of a new prospect (Create Prospect): clients and open prospects with the same e-mail, the same
 * mobile number (its last ten digits), or the same name (the person's first and last name, or the company name) with
 * the same date of birth when both have one. With clientId (a prospect for an existing client) only that client's open
 * prospects are returned. Off with leads.duplicate_check. Each match: { kind: client | lead, id, number, name, ownerName,
 * lob, productName, matchedOn: [email, mobile, name, birthDate] }; contact details are not returned.
 */
export async function possibleDuplicates(q = {}) {
  if ((await getSetting('leads.duplicate_check', true)) === false) return [];
  if (q.clientId) {
    const rows = await many(`${SELECT} WHERE l.client_id = $1 AND l.deleted_at IS NULL AND NOT (l.status = ANY($2)) ORDER BY l.created_at DESC LIMIT 20`,
      [String(q.clientId), CLOSED_STATUSES]);
    return rows.map((r) => ({ kind: 'lead', id: r.id, number: r.lead_number, name: r.display_name, ownerName: r.owner_name, lob: r.lob, productName: r.product_name, matchedOn: ['client'] }));
  }
  const email = String(q.emailId ?? q.email ?? '').trim().toLowerCase() || null;
  const mobile = lastDigits(q.contactNumber ?? q.mobileNumber);
  const name = (String(q.companyName ?? '').trim() || [q.firstName, q.lastName].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')).toLowerCase() || null;
  const dob = isoDate(q.DOB) || null;
  const loanId = String(q.loanId ?? '').trim() || null;
  const fourKey = (await getSetting('leads.duplicate_rule', 'any')) === 'four-key';
  if (!email && !mobile && !name && !loanId) return [];
  if (fourKey && !loanId && !(name && mobile)) return [];
  // placeholders: the values each rule compares, numbered in the order given
  const values = fourKey ? { mobile, name, dob, loanId } : { email, mobile, name, dob, loanId };
  const keys = Object.keys(values);
  const $ = (k) => `$${keys.indexOf(k) + 1}`;
  const nameIs = (t) => `(lower(${t}.display_name) = ${$('name')} OR lower(${t}.company_name) = ${$('name')})`;
  const dobFits = (t) => `(${$('dob')}::date IS NULL OR ${t}.birth_date IS NULL OR ${t}.birth_date = ${$('dob')})`;
  const mobileIs = (t) => `right(regexp_replace(COALESCE(${t}.phone, ''), '\\D', '', 'g'), 10) = ${$('mobile')}`;
  const loanIs = (t) => `(${$('loanId')}::text IS NOT NULL AND lower(${t}.loan_id) = lower(${$('loanId')}))`;
  // four-key (TIS-BRD-LEAD-03): first name, last name, mobile and date of birth together; a TFS loan of its own
  // (another Loan ID) is never a duplicate of the same customer's other loan (fleet accounts, LEAD-02). Clients have no loan.
  const cond = (t, withLoan) => {
    const loan = withLoan ? loanIs(t) : `(${$('loanId')}::text IS NULL AND false)`;
    if (fourKey) {
      const otherLoan = withLoan ? ` AND (${$('loanId')}::text IS NULL OR ${t}.loan_id IS NULL OR lower(${t}.loan_id) = lower(${$('loanId')}))` : '';
      return `(${loan} OR (${$('name')}::text IS NOT NULL AND ${$('mobile')}::text IS NOT NULL AND ${nameIs(t)} AND ${mobileIs(t)} AND ${dobFits(t)}${otherLoan}))`;
    }
    return `((${$('email')}::text IS NOT NULL AND lower(${t}.email) = ${$('email')}) OR (${$('mobile')}::text IS NOT NULL AND ${mobileIs(t)})
      OR (${$('name')}::text IS NOT NULL AND ${nameIs(t)} AND ${dobFits(t)}) OR ${loan})`;
  };
  const params = Object.values(values);
  const clients = await many(`SELECT c.id, c.client_code, c.display_name, c.company_name, c.email, c.phone, c.birth_date, u.display_name AS owner_name
    FROM clients c LEFT JOIN users u ON u.id = c.owner_user_id WHERE c.status <> 'deleted' AND ${cond('c', false)} ORDER BY c.created_at DESC LIMIT 10`, params);
  const leads = await many(`${SELECT} WHERE l.deleted_at IS NULL AND l.client_id IS NULL AND NOT (l.status = ANY($${params.length + 1})) AND ${cond('l', true)}
    ORDER BY l.created_at DESC LIMIT 10`, [...params, CLOSED_STATUSES]);
  const matchedOn = (r) => [
    email && String(r.email || '').toLowerCase() === email && 'email',
    mobile && lastDigits(r.phone) === mobile && 'mobile',
    name && [r.display_name, r.company_name].some((x) => String(x || '').toLowerCase() === name) && 'name',
    dob && r.birth_date && isoDate(r.birth_date) === dob && 'birthDate',
    loanId && r.loan_id && r.loan_id.toLowerCase() === loanId.toLowerCase() && 'loanId',
  ].filter(Boolean);
  return [
    ...clients.map((r) => ({ kind: 'client', id: r.id, number: r.client_code, name: r.display_name, ownerName: r.owner_name, matchedOn: matchedOn(r) })),
    ...leads.map((r) => ({ kind: 'lead', id: r.id, number: r.lead_number, name: r.display_name, ownerName: r.owner_name, lob: r.lob, productName: r.product_name, matchedOn: matchedOn(r) })),
  ];
}

/** Soft delete; a lead with a converted policy cannot be removed. */
export async function deleteLead(id, userId) {
  const lead = await getLead(id);
  const hasPolicy = await one('SELECT 1 FROM policies WHERE lead_id = $1 LIMIT 1', [lead.id]);
  if (hasPolicy) throw badRequest('Lead has an issued policy and cannot be deleted');
  await query('UPDATE leads SET deleted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1', [lead.id, userId]);
  return lead;
}

/** WHERE clause for list / stats / report filters. */
function filters(q) {
  const where = ['l.deleted_at IS NULL'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (q.leadCategory) add('l.lead_category = ?', q.leadCategory);
  if (q.country) add('l.country ILIKE ?', q.country);
  if (q.province) add('l.state ILIKE ?', q.province);
  if (q.city) add('l.city ILIKE ?', q.city);
  if (q.status) add('l.status = ?', q.status);
  if (q.lob === UNTAGGED) where.push('l.lob IS NULL');
  else if (q.lob) add('l.lob = ?', lobOf(q.lob));
  if (q.channelId) add('l.channel_id = ?', q.channelId);
  if (q.ownerUserId) add('l.owner_user_id = ?', q.ownerUserId);
  if (q.assignmentStatus) add('l.assignment_status = ?', q.assignmentStatus);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'lead', 'l', params));
  const search = q.query || q.search || q.q || q.name;
  if (search) {
    params.push(search);
    const p = `'%' || $${params.length} || '%'`;
    where.push(`(l.display_name ILIKE ${p} OR l.email ILIKE ${p} OR l.phone ILIKE ${p} OR l.lead_number ILIKE ${p} OR l.company_name ILIKE ${p})`);
  }
  return { where: where.join(' AND '), params };
}

export async function listLeads(q, pg) {
  const { where, params } = filters(q);
  const total = (await one(`SELECT count(*)::int AS n FROM leads l WHERE ${where}`, params)).n;
  const rows = await many(`${SELECT} WHERE ${where} ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pg.limit, pg.offset]);
  return { total, rows };
}

export async function leadStats(q) {
  const { where, params } = filters(q);
  const recentDays = Number(await getSetting('leads.recent_days', 7));
  const s = await one(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE l.created_at >= now() - make_interval(days => $${params.length + 1}))::int AS recent,
      count(*) FILTER (WHERE l.created_at >= now() - interval '30 days')::int AS last30,
      count(*) FILTER (WHERE l.created_at >= now() - interval '60 days' AND l.created_at < now() - interval '30 days')::int AS prev30,
      count(*) FILTER (WHERE l.status = 'Converted')::int AS converted,
      count(*) FILTER (WHERE l.lob IS NULL)::int AS untagged,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.lead_id = l.id AND q.deleted_at IS NULL))::int AS with_quotes
    FROM leads l WHERE ${where}`, [...params, recentDays]);
  const group = (col, alias, none = 'Unknown') => many(`SELECT COALESCE(${col}, $${params.length + 1}) AS "${alias}", count(*)::int AS count FROM leads l WHERE ${where}
    GROUP BY 1 ORDER BY 2 DESC`, [...params, none]);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    totalLeads: s.total, recentLeads: s.recent, last30DaysLeads: s.last30, convertedLeads: s.converted,
    leadsWithQuotations: s.with_quotes, untaggedLeads: s.untagged, conversionRate: pct(s.converted, s.total), quotationRate: pct(s.with_quotes, s.total),
    growthRate: s.prev30 ? pct(s.last30 - s.prev30, s.prev30) : (s.last30 ? 100 : 0),
    leadsByCategory: await group('l.lead_category', 'category'), leadsByCountry: await group('l.country', 'country'),
    leadsByStatus: await group('l.status', 'status'), leadsByLob: await group('l.lob', 'lob', UNTAGGED_LABEL),
  };
}

/** Report rows: category is a lead status, a quotation status (leads having such a quote) or All. */
export async function leadReport(category, scope = null) {
  const leadStatuses = await getSetting('leads.statuses', ['New', 'Contacted', 'Qualified', 'QuoteGenerated', 'Converted', 'Lost']);
  const params = [];
  let cond = 'l.deleted_at IS NULL';
  if (category && category !== 'All') {
    const isLead = leadStatuses.includes(category);
    params.push(isLead ? category : (quoteStatusIn(category) || category));
    cond += isLead ? ' AND l.status = $1'
      : ' AND EXISTS (SELECT 1 FROM quotes q WHERE q.lead_id = l.id AND q.status = $1 AND q.deleted_at IS NULL)';
  }
  if (scope) cond += ` AND ${scopeSql(scope, 'lead', 'l', params)}`;
  const rows = await many(`${SELECT} WHERE ${cond} ORDER BY l.created_at DESC LIMIT 50000`, params);
  const header = ['Lead Number', 'First Name', 'Last Name', 'Company', 'Category', 'LOB', 'Status', 'Email', 'Contact Number',
    'City', 'Province', 'Country', 'Quotations', 'Created At', 'Product'];
  return { header, rows: rows.map((r) => [r.lead_number, r.first_name, r.last_name, r.company_name, r.lead_category, r.lob || UNTAGGED_LABEL, r.status,
    r.email, r.phone, r.city, r.state, r.country, r.quotations_count, r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
    r.product_name || r.product_interest || '']) };
}

/** Map one uploaded spreadsheet row (any common header spelling) to the create-lead body. */
/** Columns of the lead bulk upload (Leads > Bulk Upload); the upload template is built from this list. */
export const LEAD_UPLOAD_COLUMNS = [
  { key: 'firstName', header: 'First Name', aliases: ['fname', 'given name'], required: 'First Name or Company Name', format: 'Text (up to 100 characters)', example: 'Maria' },
  { key: 'lastName', header: 'Last Name', aliases: ['surname', 'lname'], format: 'Text (up to 100 characters)', example: 'Santos' },
  { key: 'preferredName', header: 'Preferred Name', aliases: ['nickname'], format: 'Text', example: 'Maria' },
  { key: 'companyName', header: 'Company Name', aliases: ['company'], required: 'First Name or Company Name', format: 'Text (up to 200 characters); for a corporate lead', example: '' },
  { key: 'DOB', header: 'Date of Birth', aliases: ['dateofbirth', 'birthdate'], format: 'Date YYYY-MM-DD', example: '1988-04-12' },
  { key: 'gender', header: 'Gender', aliases: ['sex'], format: 'Text', allowed: ['Male', 'Female'], example: 'Female' },
  { key: 'emailId', header: 'Email', aliases: ['email id', 'emailaddress'], format: 'E-mail address', example: 'maria.santos@example.ph' },
  { key: 'contactNumber', header: 'Contact Number', aliases: ['mobile', 'mobilenumber', 'phone'], format: 'Mobile or landline number', example: '09171234567' },
  { key: 'houseNo', header: 'House / Unit No.', aliases: ['house no', 'address'], format: 'House, unit, floor and building', example: 'Unit 1203, Tower 2' },
  { key: 'street', header: 'Street', aliases: ['road', 'street name'], format: 'Street, subdivision or village', example: 'Mabini St.' },
  { key: 'barangay', header: 'Barangay', aliases: ['district', 'subdivision'], format: 'Text', example: 'San Antonio' },
  { key: 'city', header: 'City / Municipality', aliases: ['city', 'municipality'], format: 'City or municipality of the City / Municipality master', example: 'Pasig City' },
  { key: 'province', header: 'Province', aliases: ['state'], format: 'Province of the Province master (Metro Manila for NCR)', example: 'Metro Manila' },
  { key: 'region', header: 'Region', format: 'Region of the Region master (filled from the province when empty)', example: 'National Capital Region (NCR)' },
  { key: 'country', header: 'Country', format: 'Text', example: 'Philippines' },
  { key: 'zipCode', header: 'ZIP Code', aliases: ['zip', 'postal code', 'postalcode'], format: 'Four digits', example: '1600' },
  { key: 'leadCategory', header: 'Lead Category', aliases: ['category'], format: 'Text', allowed: ['Retail', 'Corporate'], example: 'Retail' },
  { key: 'taxInformationNumber', header: 'TIN', aliases: ['taxInformationNumber', 'tax number'], format: 'Tax identification number', example: '123-456-789-000' },
  { key: 'lob', header: 'LOB', aliases: ['line of business'], format: 'Line of business (Line of Business master code or name); empty: the product is tagged later', example: 'MOTOR' },
  { key: 'product', header: 'Product', aliases: ['product code', 'product name'], format: 'Active product of Master > Product (code or name) of the LOB; empty: the product is tagged later', example: 'CTPL' },
  { key: 'source', header: 'Source', aliases: ['lead source'], format: 'Lead source of Master > Insurance Management > Lead Sources (code or name); bulk-upload when empty', example: 'Referral' },
  { key: 'customerType', header: 'Customer Type', aliases: ['customer type'], format: 'TFS, Non-TFS or Direct Customer', allowed: ['TFS', 'Non-TFS', 'Direct Customer'], example: 'Direct Customer' },
  { key: 'loanId', header: 'Loan ID', aliases: ['loan number'], format: 'TFS loan of the prospect; a Loan ID already loaded updates that prospect', example: '' },
  { key: 'leadNumber', header: 'Lead Number', aliases: ['prospect number', 'lead no'], format: 'LD number of a prospect already loaded: the row updates its status and disposition', example: '' },
  { key: 'status', header: 'Status', aliases: ['call status', 'lead status'], format: 'Prospect status: New, Contacted, Qualified, QuoteGenerated, Converted, Lost', example: '' },
  { key: 'disposition', header: 'Disposition', aliases: ['call disposition'], format: 'Interested, Not Interested, Uncontacted, Call back or Renewed', example: '' },
];

/** Uploaded row -> lead body. */
export const leadFromRow = (row) => {
  const v = mapColumns(row, LEAD_UPLOAD_COLUMNS);
  return { ...v, source: v.source || UPLOAD_SOURCE };
};

/**
 * The prospect an uploaded row names (Lead Number, else Loan ID), already loaded: the row updates its status and
 * disposition instead of creating a second prospect (bulk status update by re-upload, TIS-BRD-LEAD-07). null when none.
 */
export async function leadOfRow(body) {
  const ref = String(body.leadNumber ?? '').trim();
  const loan = String(body.loanId ?? '').trim();
  if (!ref && !loan) return null;
  const r = await one(`SELECT * FROM leads WHERE deleted_at IS NULL AND (($1 <> '' AND lead_number = $1) OR ($1 = '' AND $2 <> '' AND lower(loan_id) = lower($2))) LIMIT 1`, [ref, loan]);
  if (!r && ref) throw notFound(`Prospect ${ref} not found`);
  return r;
}

/** Status and disposition of an uploaded row written on the prospect it names. */
export async function updateStatusFromRow(lead, body, userId, batchId) {
  const cols = { ...(body.status ? { status: body.status } : {}), ...(body.disposition ? { disposition: body.disposition } : {}) };
  if (!Object.keys(cols).length) throw badRequest('Status or Disposition is required to update a prospect already loaded');
  await assertLeadValues(cols, lead);
  const keys = Object.keys(cols);
  await query(`UPDATE leads SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, import_batch_id = $${keys.length + 2}, updated_by = $${keys.length + 3}, updated_at = now() WHERE id = $1`,
    [lead.id, ...Object.values(cols), batchId, userId]);
  return getLead(lead.id);
}

/** The lists of the prospect form (GET /leads/options). */
export async function leadOptions() {
  return {
    categories: await getSetting('leads.categories', ['Retail', 'Corporate']), customerTypes: await getSetting('leads.customer_types', ['TFS', 'Non-TFS', 'Direct Customer']),
    statuses: await getSetting('leads.statuses', ['New', 'Contacted', 'Qualified', 'QuoteGenerated', 'Converted', 'Lost']), dispositions: await getSetting('leads.dispositions', []),
    insurers: await many("SELECT id, name FROM insurance_companies WHERE status = 'active' ORDER BY name"),
  };
}
