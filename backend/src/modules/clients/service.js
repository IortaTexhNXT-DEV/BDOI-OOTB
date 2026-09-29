import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { assertBirthDate } from '../../lib/birthDate.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { isoDate } from '../../lib/dates.js';

const FIELD_MAP = {
  firstName: 'first_name', lastName: 'last_name', preferredName: 'preferred_name', companyName: 'company_name',
  taxNumber: 'tin', emailId: 'email', contactNumber: 'phone', gender: 'gender', houseNo: 'house_no', barangay: 'barangay',
  city: 'city', province: 'state', country: 'country', zipCode: 'postal_code', roadThanon: 'road', soiAlley: 'soi',
  mooVillage: 'moo', leadCategory: 'lead_category', clientType: 'client_type', status: 'status', source: 'source',
};
const KNOWN = new Set([...Object.keys(FIELD_MAP), 'DOB', 'email', 'phone', 'clientId', 'id', 'generatedClientId', 'policies', 'createdAt', 'updatedAt', 'leadId']);

export function toClient(r, policies = null) {
  if (!r) return null;
  return {
    ...(r.extra || {}),
    id: r.id, clientId: r.id, generatedClientId: r.client_code, clientCode: r.client_code, clientType: r.client_type,
    firstName: r.first_name, lastName: r.last_name, preferredName: r.preferred_name, companyName: r.company_name,
    displayName: r.display_name, fullName: r.display_name, taxNumber: r.tin, emailId: r.email, email: r.email,
    contactNumber: r.phone, phone: r.phone, DOB: r.birth_date, gender: r.gender, houseNo: r.house_no, barangay: r.barangay,
    city: r.city, province: r.state, country: r.country, zipCode: r.postal_code, roadThanon: r.road, soiAlley: r.soi,
    mooVillage: r.moo, leadCategory: r.lead_category, leadId: r.lead_id, status: r.status, source: r.source,
    policies: policies ?? r.policies ?? [], createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const POLICIES_JSON = `COALESCE((SELECT json_agg(json_build_object('policyId', p.id, 'policyNumber', p.policy_number, 'status', p.status,
  'paymentStatus', p.payment_status, 'productType', p.product_type, 'expiry', p.expiry_date) ORDER BY p.created_at DESC)
  FROM policies p WHERE p.client_id = c.id), '[]') AS policies`;

export async function getClient(id) {
  const r = await one(`SELECT c.*, ${POLICIES_JSON} FROM clients c WHERE c.id = $1 OR c.client_code = $1`, [id]);
  if (!r) throw notFound('Client not found');
  return r;
}

export async function listClients(q, pg) {
  const where = ["c.status <> 'deleted'"];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  const search = q.search || q.query || q.q;
  if (search) add("(c.display_name ILIKE '%' || ? || '%' OR c.client_code ILIKE '%' || ? || '%' OR c.email ILIKE '%' || ? || '%' OR c.phone ILIKE '%' || ? || '%')", search);
  if (q.leadCategory || q.category) add('c.lead_category = ?', q.leadCategory || q.category);
  if (q.status) add('c.status = ?', q.status);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'client', 'c', params));
  const w = where.join(' AND ');
  const total = (await one(`SELECT count(*)::int AS n FROM clients c WHERE ${w}`, params)).n;
  const rows = await many(`SELECT c.*, ${POLICIES_JSON} FROM clients c WHERE ${w} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pg.limit, pg.offset]);
  return { total, rows };
}

function columnsFrom(body) {
  const cols = {};
  for (const [k, c] of Object.entries(FIELD_MAP)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (body.emailId === undefined && body.email !== undefined) cols.email = body.email || null;
  if (body.contactNumber === undefined && body.phone !== undefined) cols.phone = body.phone || null;
  if (body.DOB !== undefined) cols.birth_date = isoDate(body.DOB);
  const extra = Object.fromEntries(Object.entries(body).filter(([k]) => !KNOWN.has(k)));
  return { cols, extra };
}
const nameOf = (c) => [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company_name || c.preferred_name || 'Unnamed client';

async function insertClient(db, cols, extra, userId) {
  const code = await nextDocumentNumber('client', { db, unique: { table: 'clients', column: 'client_code' } });
  const data = { ...cols, client_code: code, display_name: nameOf(cols), extra: JSON.stringify(extra), created_by: userId, owner_user_id: userId,
    client_type: cols.client_type || (cols.lead_category === 'Corporate' ? 'corporate' : 'individual') };
  const keys = Object.keys(data);
  const r = await db.query(`INSERT INTO clients(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data));
  return r.rows[0].id;
}

export async function createClient(body, userId) {
  const { cols, extra } = columnsFrom(body);
  if (!cols.first_name && !cols.company_name) throw badRequest('firstName or companyName is required');
  await assertBirthDate(cols.birth_date);
  const id = await withTransaction((c) => insertClient(c, cols, extra, userId));
  return getClient(id);
}

/** Create a client inside the caller's transaction (direct placement / recorded policy for a new insured); returns its id. */
export async function createClientInTx(db, body, userId) {
  const { cols, extra } = columnsFrom(body);
  if (!cols.first_name && !cols.company_name) throw badRequest('firstName or companyName is required');
  await assertBirthDate(cols.birth_date);
  return insertClient(db, cols, extra, userId);
}

export async function updateClient(id, body, userId) {
  const before = await getClient(id);
  const { cols, extra } = columnsFrom(body);
  await assertBirthDate(cols.birth_date);
  const next = { ...before, ...cols };
  const data = { ...cols, display_name: nameOf(next), extra: JSON.stringify({ ...(before.extra || {}), ...extra }), updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await query(`UPDATE clients SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before, after: await getClient(before.id) };
}

/**
 * Lead -> client conversion used by quote-to-policy: returns the existing client of the lead, or creates one from the
 * lead's details (overrides from the conversion screen win). Marks the lead Converted. Runs inside the caller's transaction.
 */
export async function clientFromLead(db, leadId, overrides = {}, userId = null) {
  const existing = (await db.query('SELECT id FROM clients WHERE lead_id = $1', [leadId])).rows[0];
  const lead = (await db.query('SELECT * FROM leads WHERE id = $1', [leadId])).rows[0];
  if (!lead) throw notFound('Lead not found');
  let clientId = existing?.id;
  if (!clientId) {
    await assertBirthDate(columnsFrom(overrides).cols.birth_date);
    const cols = {
      first_name: lead.first_name, last_name: lead.last_name, preferred_name: lead.preferred_name, company_name: lead.company_name,
      tin: lead.tax_number, email: lead.email, phone: lead.phone, birth_date: lead.birth_date, gender: lead.gender, house_no: lead.house_no,
      barangay: lead.barangay, city: lead.city, state: lead.state, country: lead.country, postal_code: lead.postal_code, road: lead.road,
      soi: lead.soi, moo: lead.moo, lead_category: lead.lead_category, lead_id: lead.id, source: lead.source || 'lead',
      ...columnsFrom(overrides).cols,
    };
    clientId = await insertClient(db, cols, {}, userId || lead.owner_user_id);
  }
  await db.query("UPDATE leads SET client_id = $2, status = 'Converted', updated_at = now() WHERE id = $1", [leadId, clientId]);
  return clientId;
}

export async function convertLead(leadId, overrides, userId) {
  const id = await withTransaction((c) => clientFromLead(c, leadId, overrides, userId));
  return getClient(id);
}

export function customerCodes(scope = null) {
  const params = [];
  const own = scopeSql(scope, 'client', 'c', params);
  return many(`SELECT id AS "clientId", client_code AS "customerCode", client_code AS code, display_name AS name
    FROM clients c WHERE status <> 'deleted' AND ${own} ORDER BY client_code`, params);
}
