import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextNumber, toDate, lobOf } from '../documents/common.js';
import { pick } from '../documents/tabular.js';
import { quoteStatusIn } from '../documents/statuses.js';

/** Fields the lead screens send, mapped to columns. Anything else is kept in `extra`. */
const FIELD_MAP = {
  firstName: 'first_name', lastName: 'last_name', preferredName: 'preferred_name', companyName: 'company_name',
  gender: 'gender', emailId: 'email', contactNumber: 'phone', houseNo: 'house_no', barangay: 'barangay',
  city: 'city', province: 'state', country: 'country', zipCode: 'postal_code', roadThanon: 'road', soiAlley: 'soi',
  mooVillage: 'moo', leadCategory: 'lead_category', taxInformationNumber: 'tax_number', source: 'source', notes: 'notes',
  productType: 'product_interest', status: 'status',
};
const KNOWN = new Set([...Object.keys(FIELD_MAP), 'DOB', 'lob', 'email', 'mobileNumber', 'createdBy', 'updatedBy', 'leadId', 'id',
  'generatedLeadId', 'createdAt', 'updatedAt', 'quotationsCount', 'clientId']);

/** Row -> the lead object the screens read (leadId, generatedLeadId, emailId, contactNumber, DOB ...). */
export function toLead(r) {
  if (!r) return null;
  return {
    ...(r.extra || {}),
    id: r.id, leadId: r.id, generatedLeadId: r.lead_number, leadNumber: r.lead_number,
    firstName: r.first_name, lastName: r.last_name, preferredName: r.preferred_name, fullName: r.display_name,
    DOB: r.birth_date, gender: r.gender, emailId: r.email, email: r.email, contactNumber: r.phone, mobileNumber: r.phone,
    houseNo: r.house_no, barangay: r.barangay, city: r.city, province: r.state, country: r.country, zipCode: r.postal_code,
    roadThanon: r.road, soiAlley: r.soi, mooVillage: r.moo, leadCategory: r.lead_category, companyName: r.company_name,
    taxInformationNumber: r.tax_number, lob: r.lob, productType: r.product_interest, source: r.source, notes: r.notes,
    status: r.status, clientId: r.client_id, ownerUserId: r.owner_user_id, quotationsCount: r.quotations_count ?? 0,
    createdBy: r.created_by_name || r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const displayName = (b) => [b.firstName, b.lastName].filter(Boolean).join(' ').trim() || b.companyName || b.preferredName || 'Unnamed lead';

function columnsFrom(body) {
  const cols = {};
  for (const [k, c] of Object.entries(FIELD_MAP)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (body.emailId === undefined && body.email !== undefined) cols.email = body.email || null;
  if (body.contactNumber === undefined && body.mobileNumber !== undefined) cols.phone = body.mobileNumber || null;
  if (body.DOB !== undefined) cols.birth_date = toDate(body.DOB);
  if (body.lob !== undefined) cols.lob = lobOf(body.lob);
  const extra = Object.fromEntries(Object.entries(body).filter(([k]) => !KNOWN.has(k)));
  return { cols, extra };
}

const SELECT = `SELECT l.*, (SELECT count(*)::int FROM quotes q WHERE q.lead_id = l.id AND q.deleted_at IS NULL) AS quotations_count,
  (SELECT u.display_name FROM users u WHERE u.id = l.created_by) AS created_by_name FROM leads l`;

export async function getLead(id, db = null) {
  const r = (await (db || { query }).query(`${SELECT} WHERE (l.id = $1 OR l.lead_number = $1) AND l.deleted_at IS NULL`, [id])).rows[0];
  if (!r) throw notFound('Lead not found');
  return r;
}

export async function createLead(body, userId, db = null) {
  const { cols, extra } = columnsFrom(body);
  if (!cols.first_name && !cols.company_name) throw badRequest('firstName or companyName is required');
  const run = async (c) => {
    const number = await nextNumber(c, 'lead', 'lead');
    const status = cols.status || await getSetting('leads.default_status', 'New');
    const data = { ...cols, status, lead_number: number, display_name: displayName(body), extra: JSON.stringify(extra),
      lob: cols.lob || 'MOTOR', lead_category: cols.lead_category || 'Retail', created_by: userId, owner_user_id: userId };
    const keys = Object.keys(data);
    const r = await c.query(`INSERT INTO leads(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data));
    return r.rows[0].id;
  };
  const id = db ? await run(db) : await withTransaction(run);
  return getLead(id, db);
}

export async function updateLead(id, body, userId) {
  const before = await getLead(id);
  const { cols, extra } = columnsFrom(body);
  const merged = { first_name: before.first_name, last_name: before.last_name, company_name: before.company_name, preferred_name: before.preferred_name };
  const next = { ...merged, ...cols };
  const data = { ...cols, display_name: displayName({ firstName: next.first_name, lastName: next.last_name, companyName: next.company_name, preferredName: next.preferred_name }),
    extra: JSON.stringify({ ...(before.extra || {}), ...extra }), updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await query(`UPDATE leads SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before, after: await getLead(before.id) };
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
  if (q.lob) add('l.lob = ?', lobOf(q.lob));
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
      count(*) FILTER (WHERE l.status = 'Converted' OR l.client_id IS NOT NULL)::int AS converted,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.lead_id = l.id AND q.deleted_at IS NULL))::int AS with_quotes
    FROM leads l WHERE ${where}`, [...params, recentDays]);
  const group = (col, alias) => many(`SELECT COALESCE(${col}, 'Unknown') AS "${alias}", count(*)::int AS count FROM leads l WHERE ${where} GROUP BY 1 ORDER BY 2 DESC`, params);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    totalLeads: s.total, recentLeads: s.recent, last30DaysLeads: s.last30, convertedLeads: s.converted,
    leadsWithQuotations: s.with_quotes, conversionRate: pct(s.converted, s.total), quotationRate: pct(s.with_quotes, s.total),
    growthRate: s.prev30 ? pct(s.last30 - s.prev30, s.prev30) : (s.last30 ? 100 : 0),
    leadsByCategory: await group('l.lead_category', 'category'), leadsByCountry: await group('l.country', 'country'),
    leadsByStatus: await group('l.status', 'status'), leadsByLob: await group('l.lob', 'lob'),
  };
}

/** Report rows: category is a lead status, a quotation status (leads having such a quote) or All. */
export async function leadReport(category) {
  const leadStatuses = await getSetting('leads.statuses', ['New', 'Contacted', 'Qualified', 'QuoteGenerated', 'Converted', 'Lost']);
  const params = [];
  let cond = 'l.deleted_at IS NULL';
  if (category && category !== 'All') {
    const isLead = leadStatuses.includes(category);
    params.push(isLead ? category : (quoteStatusIn(category) || category));
    cond += isLead ? ' AND l.status = $1'
      : ' AND EXISTS (SELECT 1 FROM quotes q WHERE q.lead_id = l.id AND q.status = $1 AND q.deleted_at IS NULL)';
  }
  const rows = await many(`${SELECT} WHERE ${cond} ORDER BY l.created_at DESC LIMIT 50000`, params);
  const header = ['Lead Number', 'First Name', 'Last Name', 'Company', 'Category', 'LOB', 'Status', 'Email', 'Contact Number',
    'City', 'Province', 'Country', 'Quotations', 'Created At'];
  return { header, rows: rows.map((r) => [r.lead_number, r.first_name, r.last_name, r.company_name, r.lead_category, r.lob, r.status,
    r.email, r.phone, r.city, r.state, r.country, r.quotations_count, r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '']) };
}

/** Map one uploaded spreadsheet row (any common header spelling) to the create-lead body. */
export const leadFromRow = (row) => ({
  firstName: pick(row, 'firstName', 'first name', 'fname', 'given name'),
  lastName: pick(row, 'lastName', 'last name', 'surname', 'lname'),
  preferredName: pick(row, 'preferredName', 'preferred name', 'nickname'),
  companyName: pick(row, 'companyName', 'company name', 'company'),
  DOB: pick(row, 'DOB', 'date of birth', 'dateofbirth', 'birthdate'),
  gender: pick(row, 'gender', 'sex'),
  emailId: pick(row, 'emailId', 'email', 'email id', 'emailaddress'),
  contactNumber: pick(row, 'contactNumber', 'contact number', 'mobile', 'mobilenumber', 'phone'),
  houseNo: pick(row, 'houseNo', 'house no', 'address', 'street'),
  barangay: pick(row, 'barangay', 'district', 'subdivision'),
  city: pick(row, 'city'), province: pick(row, 'province', 'state'), country: pick(row, 'country'),
  zipCode: pick(row, 'zipCode', 'zip code', 'zip', 'postal code', 'postalcode'),
  leadCategory: pick(row, 'leadCategory', 'category', 'lead category'),
  taxInformationNumber: pick(row, 'taxInformationNumber', 'tin', 'tax number'),
  lob: pick(row, 'lob', 'line of business', 'product'), source: pick(row, 'source') || 'bulk-upload',
});
