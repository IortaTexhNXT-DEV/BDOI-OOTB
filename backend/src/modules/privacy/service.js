/**
 * Data privacy (RA 10173): consents per purpose, the data subject request register, the personal data export
 * (access / portability) and the anonymisation of a party once its records no longer have to be kept.
 * Tables: privacy_consents, data_subject_requests (migration 0221). Routes: router.js.
 */
import { many, one, query } from '../../db/pool.js';
import { HttpError, badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { companyName } from '../../lib/letterhead.js';
import { revealInPlace } from '../../lib/pii.js';

export const PARTY_TYPES = ['client', 'lead'];
export const PURPOSES = ['processing', 'marketing', 'sharing'];
export const CHANNELS = ['Form', 'E-mail', 'Phone', 'Portal', 'In person'];
export const REQUEST_TYPES = ['access', 'rectification', 'erasure', 'objection', 'portability', 'withdraw-consent'];
export const REQUEST_STATUSES = ['open', 'in-progress', 'completed', 'rejected'];
export const OPEN_STATUSES = ['open', 'in-progress'];

const iso = (v) => (v ? isoDate(v) : null);

// ---------- parties ----------

/** The client or lead (by id or code / number); 404 when missing. */
export async function getParty(type, ref, db = { query }) {
  if (!PARTY_TYPES.includes(type)) throw badRequest('partyType must be client or lead');
  const row = type === 'client'
    ? (await db.query('SELECT * FROM clients WHERE id = $1 OR client_code = $1', [String(ref)])).rows[0]
    : (await db.query('SELECT * FROM leads WHERE (id = $1 OR lead_number = $1) AND deleted_at IS NULL', [String(ref)])).rows[0];
  if (!row) throw notFound(type === 'client' ? 'Client not found' : 'Prospect not found');
  return { type, id: row.id, code: type === 'client' ? row.client_code : row.lead_number, name: row.display_name, row };
}

const PARTY_NAME_SQL = (alias) => `CASE ${alias}.party_type
  WHEN 'client' THEN (SELECT c.display_name FROM clients c WHERE c.id = ${alias}.party_id)
  ELSE (SELECT l.display_name FROM leads l WHERE l.id = ${alias}.party_id) END`;
const PARTY_CODE_SQL = (alias) => `CASE ${alias}.party_type
  WHEN 'client' THEN (SELECT c.client_code FROM clients c WHERE c.id = ${alias}.party_id)
  ELSE (SELECT l.lead_number FROM leads l WHERE l.id = ${alias}.party_id) END`;

/** Clients and prospects matching a name, code, e-mail or phone (for the request register). */
export function searchParties(text) {
  const q = String(text || '').trim();
  if (q.length < 2) return [];
  return many(`SELECT * FROM (
      SELECT 'client' AS "partyType", id AS "partyId", client_code AS code, display_name AS name, email, phone FROM clients
       WHERE status <> 'deleted' AND (display_name ILIKE '%' || $1 || '%' OR client_code ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR phone ILIKE '%' || $1 || '%')
      UNION ALL
      SELECT 'lead', id, lead_number, display_name, email, phone FROM leads
       WHERE deleted_at IS NULL AND (display_name ILIKE '%' || $1 || '%' OR lead_number ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR phone ILIKE '%' || $1 || '%')
    ) x ORDER BY name LIMIT 20`, [q]);
}

/** Active users who may work the register (read:privacy, or the administrator role), for the assignee list. */
export function assignees() {
  return many(`SELECT DISTINCT u.id, u.display_name AS name, u.username FROM users u
    JOIN user_effective_roles(u.id) er ON TRUE
    WHERE u.status = 'active' AND (er.code = 'system-admin' OR EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = er.role_id AND p.code = 'read:privacy'))
    ORDER BY name`);
}

// ---------- consents ----------

export const consentApi = (r) => ({
  id: Number(r.id), partyType: r.party_type, partyId: r.party_id, partyCode: r.party_code ?? undefined, partyName: r.party_name ?? undefined,
  purpose: r.purpose, granted: r.granted, status: consentStatus(r), channel: r.channel, noticeVersion: r.notice_version, evidence: r.evidence,
  recordedBy: r.recorded_by_name || r.recorded_by, recordedAt: r.recorded_at, withdrawnAt: r.withdrawn_at,
  withdrawnBy: r.withdrawn_by_name || r.withdrawn_by, withdrawalReason: r.withdrawal_reason, current: r.is_current ?? undefined,
});
function consentStatus(r) {
  if (!r.granted) return 'refused';
  return r.withdrawn_at ? 'withdrawn' : 'granted';
}

const CONSENT_SELECT = `SELECT pc.*, (SELECT display_name FROM users u WHERE u.id = pc.recorded_by) AS recorded_by_name,
  (SELECT display_name FROM users u WHERE u.id = pc.withdrawn_by) AS withdrawn_by_name FROM privacy_consents pc`;

/** Current status per purpose (latest record) and the full history of a party. */
export async function consentsOf(party) {
  const history = await many(`${CONSENT_SELECT} WHERE pc.party_type = $1 AND pc.party_id = $2 ORDER BY pc.recorded_at DESC, pc.id DESC`, [party.type, party.id]);
  const purposes = PURPOSES.map((purpose) => {
    const latest = history.find((h) => h.purpose === purpose);
    return latest ? { purpose, ...consentApi(latest) } : { purpose, status: 'not-recorded', granted: null };
  });
  return {
    partyType: party.type, partyId: party.id, partyCode: party.code, partyName: party.name,
    noticeVersion: await getSetting('privacy.notice_version', '1.0'), anonymisedAt: party.row.anonymised_at || null,
    purposes, history: history.map(consentApi),
  };
}

export async function recordConsent(party, body, userId) {
  if (party.row.anonymised_at) throw conflict('The personal data of this party were anonymised');
  const version = body.noticeVersion || await getSetting('privacy.notice_version', '1.0');
  const r = await one(`INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel, notice_version, evidence, recorded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [party.type, party.id, body.purpose, body.granted, body.channel, String(version), body.evidence || null, userId]);
  // a newer record of the purpose ends an earlier consent still in force (one consent in force per purpose)
  await query(`UPDATE privacy_consents SET withdrawn_at = now(), withdrawn_by = $4, withdrawal_reason = 'Superseded by a later record'
    WHERE party_type = $1 AND party_id = $2 AND purpose = $3 AND granted AND withdrawn_at IS NULL AND id <> $5`,
  [party.type, party.id, body.purpose, userId, r.id]);
  return getConsent(r.id);
}

export async function getConsent(id) {
  const r = await one(`${CONSENT_SELECT} WHERE pc.id = $1`, [Number(id) || 0]);
  if (!r) throw notFound('Consent record not found');
  return r;
}

export async function withdrawConsent(id, reason, userId) {
  const r = await getConsent(id);
  if (!r.granted) throw badRequest('Only a consent that was given can be withdrawn');
  if (r.withdrawn_at) throw conflict('This consent was already withdrawn');
  await query('UPDATE privacy_consents SET withdrawn_at = now(), withdrawn_by = $2, withdrawal_reason = $3 WHERE id = $1', [r.id, userId, reason]);
  return getConsent(r.id);
}

/** Consent register across parties: every record (or only the current one per party and purpose), with filters. */
export async function consentRegister(q = {}) {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.partyType) add('x.party_type = ?', q.partyType);
  if (q.purpose) add('x.purpose = ?', q.purpose);
  if (q.channel) add('x.channel = ?', q.channel);
  if (q.status === 'granted') where.push('x.granted AND x.withdrawn_at IS NULL');
  if (q.status === 'withdrawn') where.push('x.granted AND x.withdrawn_at IS NOT NULL');
  if (q.status === 'refused') where.push('NOT x.granted');
  if (String(q.current) === 'true') where.push('x.is_current');
  if (q.from) add('x.recorded_at >= ?::date', q.from);
  if (q.to) add('x.recorded_at < ?::date + 1', q.to);
  if (q.search) add("(x.party_name ILIKE '%' || ? || '%' OR x.party_code ILIKE '%' || ? || '%')", q.search);
  const rows = await many(`SELECT * FROM (
      SELECT pc.*, ${PARTY_NAME_SQL('pc')} AS party_name, ${PARTY_CODE_SQL('pc')} AS party_code,
        (SELECT display_name FROM users u WHERE u.id = pc.recorded_by) AS recorded_by_name,
        (SELECT display_name FROM users u WHERE u.id = pc.withdrawn_by) AS withdrawn_by_name,
        row_number() OVER (PARTITION BY pc.party_type, pc.party_id, pc.purpose ORDER BY pc.recorded_at DESC, pc.id DESC) = 1 AS is_current
      FROM privacy_consents pc) x
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY x.recorded_at DESC, x.id DESC LIMIT 1000`, params);
  return rows.map(consentApi);
}

// ---------- data subject requests ----------

export const requestApi = (r, now = null) => ({
  id: r.id, requestNumber: r.request_number, partyType: r.party_type, partyId: r.party_id, partyCode: r.party_code || null, partyName: r.party_name || null,
  requesterName: r.requester_name, requesterContact: r.requester_contact, requestType: r.request_type, description: r.description,
  receivedOn: iso(r.received_on), dueOn: iso(r.due_on), status: r.status,
  overdue: OPEN_STATUSES.includes(r.status) && !!now && iso(r.due_on) < now,
  assignedTo: r.assigned_to, assignedToName: r.assigned_to_name || null, outcome: r.outcome, responseNotes: r.response_notes,
  actions: r.actions || [], closedOn: iso(r.closed_on), closedBy: r.closed_by_name || r.closed_by,
  createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

const REQUEST_SELECT = `SELECT r.*, ${PARTY_NAME_SQL('r')} AS party_name, ${PARTY_CODE_SQL('r')} AS party_code,
  (SELECT display_name FROM users u WHERE u.id = r.assigned_to) AS assigned_to_name,
  (SELECT display_name FROM users u WHERE u.id = r.closed_by) AS closed_by_name,
  (SELECT display_name FROM users u WHERE u.id = r.created_by) AS created_by_name FROM data_subject_requests r`;

export async function listRequests(q = {}) {
  const now = await today();
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('r.status = ANY(?::text[])', String(q.status).split(','));
  if (q.requestType || q.type) add('r.request_type = ?', q.requestType || q.type);
  if (String(q.overdue) === 'true') { add('r.due_on < ?::date', now); where.push("r.status IN ('open', 'in-progress')"); }
  if (q.partyType) add('r.party_type = ?', q.partyType);
  if (q.partyId) add('r.party_id = ?', q.partyId);
  if (q.assignedTo) add('r.assigned_to = ?', q.assignedTo);
  if (q.search) add(`(r.request_number ILIKE '%' || ? || '%' OR r.requester_name ILIKE '%' || ? || '%' OR ${PARTY_NAME_SQL('r')} ILIKE '%' || ? || '%')`, q.search);
  const rows = await many(`${REQUEST_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.received_on DESC, r.request_number DESC LIMIT 1000`, params);
  const items = rows.map((r) => requestApi(r, now));
  const all = (await one(`SELECT count(*) FILTER (WHERE status IN ('open', 'in-progress'))::int AS open,
      count(*) FILTER (WHERE status IN ('open', 'in-progress') AND due_on < $1::date)::int AS overdue,
      count(*) FILTER (WHERE status = 'completed')::int AS completed, count(*) FILTER (WHERE status = 'rejected')::int AS rejected
    FROM data_subject_requests`, [now]));
  return { items, summary: all, today: now };
}

export async function getRequest(id, db = { query }) {
  const r = (await db.query(`${REQUEST_SELECT} WHERE r.id = $1 OR r.request_number = $1`, [String(id)])).rows[0];
  if (!r) throw notFound('Data subject request not found');
  return r;
}
export const requestView = async (id) => requestApi(await getRequest(id), await today());

async function assertAssignee(userId) {
  if (!userId) return;
  if (!(await one("SELECT 1 FROM users WHERE id = $1 AND status = 'active'", [userId]))) throw badRequest('The assignee is not an active user');
}

export async function createRequest(db, body, userId) {
  let party = null;
  if (body.partyType || body.partyId) {
    if (!body.partyType || !body.partyId) throw badRequest('partyType and partyId go together');
    party = await getParty(body.partyType, body.partyId, db);
  }
  await assertAssignee(body.assignedTo);
  const received = body.receivedOn || await today();
  if (received > await today()) throw badRequest('The date received cannot be in the future');
  const days = Number(await getSetting('privacy.request_due_days', 15));
  const number = await nextDocumentNumber('data_subject_request', { db, date: received, unique: { table: 'data_subject_requests', column: 'request_number' } });
  const r = (await db.query(`INSERT INTO data_subject_requests(request_number, party_type, party_id, requester_name, requester_contact, request_type, description,
      received_on, due_on, status, assigned_to, response_notes, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING id`,
  [number, party?.type || null, party?.id || null, body.requesterName, body.requesterContact || null, body.requestType, body.description || null,
    received, addDays(received, days), body.assignedTo ? 'in-progress' : 'open', body.assignedTo || null, body.responseNotes || null, userId])).rows[0];
  return getRequest(r.id, db);
}

export async function updateRequest(db, id, body, userId) {
  const before = await getRequest(id, db);
  if (!OPEN_STATUSES.includes(before.status)) throw conflict('A closed request cannot be changed');
  const cols = {};
  if (body.partyType !== undefined || body.partyId !== undefined) {
    if (body.partyType && body.partyId) {
      const party = await getParty(body.partyType, body.partyId, db);
      cols.party_type = party.type;
      cols.party_id = party.id;
    } else {
      cols.party_type = null;
      cols.party_id = null;
    }
  }
  if (body.assignedTo !== undefined) { await assertAssignee(body.assignedTo); cols.assigned_to = body.assignedTo || null; }
  const map = { requesterName: 'requester_name', requesterContact: 'requester_contact', requestType: 'request_type', description: 'description',
    status: 'status', outcome: 'outcome', responseNotes: 'response_notes' };
  for (const [k, c] of Object.entries(map)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (body.receivedOn !== undefined && body.receivedOn !== iso(before.received_on)) {
    if (body.receivedOn > await today()) throw badRequest('The date received cannot be in the future');
    cols.received_on = body.receivedOn;
    cols.due_on = addDays(body.receivedOn, Number(await getSetting('privacy.request_due_days', 15)));
  }
  if (!Object.keys(cols).length) return { before, after: before };
  const data = { ...cols, updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await db.query(`UPDATE data_subject_requests SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before, after: await getRequest(before.id, db) };
}

export async function closeRequest(db, id, body, userId) {
  const before = await getRequest(id, db);
  if (!OPEN_STATUSES.includes(before.status)) throw conflict('The request is already closed');
  const closedOn = body.closedOn || await today();
  if (closedOn < iso(before.received_on)) throw badRequest('The request cannot be closed before it was received');
  await db.query(`UPDATE data_subject_requests SET status = $2, outcome = $3, response_notes = COALESCE($4, response_notes), closed_on = $5, closed_by = $6,
      updated_by = $6, updated_at = now() WHERE id = $1`, [before.id, body.status, body.outcome, body.responseNotes || null, closedOn, userId]);
  return { before, after: await getRequest(before.id, db) };
}

/** Note an export or an anonymisation on the request it answers (the request must concern the same party). */
export async function noteRequestAction(db, requestId, party, action, userId) {
  if (!requestId) return null;
  const r = await getRequest(requestId, db);
  if (!OPEN_STATUSES.includes(r.status)) throw conflict('The data subject request is already closed');
  if (r.party_id && (r.party_type !== party.type || r.party_id !== party.id)) throw badRequest('The data subject request concerns another party');
  await db.query(`UPDATE data_subject_requests SET actions = actions || $2::jsonb, party_type = COALESCE(party_type, $3), party_id = COALESCE(party_id, $4),
      status = CASE WHEN status = 'open' THEN 'in-progress' ELSE status END, updated_by = $5, updated_at = now() WHERE id = $1`,
  [r.id, JSON.stringify([{ action, at: new Date().toISOString(), by: userId }]), party.type, party.id, userId]);
  return r.request_number;
}

/** Open requests past their due date (the daily job and the register's overdue filter). */
export async function overdueRequests(now) {
  return many(`${REQUEST_SELECT} WHERE r.status IN ('open', 'in-progress') AND r.due_on < $1::date ORDER BY r.due_on`, [now]);
}

// ---------- personal data export ----------

const PERSONAL_COLUMNS = {
  client: ['client_code', 'client_type', 'first_name', 'last_name', 'preferred_name', 'company_name', 'display_name', 'email', 'phone', 'tin', 'birth_date',
    'gender', 'house_no', 'road', 'barangay', 'address', 'city', 'state', 'postal_code', 'country', 'lead_category', 'source', 'status', 'created_at', 'anonymised_at'],
  lead: ['lead_number', 'lead_type', 'first_name', 'last_name', 'preferred_name', 'company_name', 'display_name', 'email', 'phone', 'tax_number', 'birth_date',
    'gender', 'house_no', 'road', 'barangay', 'address', 'city', 'state', 'postal_code', 'country', 'lead_category', 'product_interest', 'source', 'notes',
    'status', 'created_at', 'anonymised_at'],
};
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const plain = (v) => (v instanceof Date ? v.toISOString() : v);
const pickColumns = (row, cols) => Object.fromEntries(cols.map((c) => [camel(c), c.endsWith('_date') ? iso(row[c]) : plain(row[c] ?? null)]));
/** Contact persons and other personal details captured on the client form (kept in `extra`). */
const extraDetails = (extra) => Object.fromEntries(Object.entries(extra || {}).filter(([, v]) => v !== null && v !== '' && v !== undefined));

/** Everything held about a party that the data subject may ask for (access / portability). */
export async function exportParty(party) {
  const isClient = party.type === 'client';
  const leadIds = isClient
    ? (await many('SELECT id FROM leads WHERE client_id = $1 OR id = $2', [party.id, party.row.lead_id || ''])).map((r) => r.id)
    : [party.id];
  const personal = { ...pickColumns(party.row, PERSONAL_COLUMNS[party.type]), additionalDetails: extraDetails(party.row.extra) };
  const leads = isClient
    ? (await many('SELECT * FROM leads WHERE id = ANY($1::text[])', [leadIds])).map((l) => pickColumns(l, PERSONAL_COLUMNS.lead))
    : [];
  const policies = isClient ? await many(`SELECT p.policy_number AS "policyNumber", COALESCE(pr.name, p.product_type) AS product, ic.name AS insurer,
      p.insured_name AS "insuredName", to_char(p.inception_date, 'YYYY-MM-DD') AS "inceptionDate", to_char(p.expiry_date, 'YYYY-MM-DD') AS "expiryDate",
      p.sum_insured::float8 AS "sumInsured", p.premium_total::float8 AS "grossPremium", p.currency, p.status
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE p.client_id = $1 ORDER BY p.inception_date DESC NULLS LAST, p.policy_number`, [party.id]) : [];
  const claims = isClient ? await many(`SELECT c.claim_number AS "claimNumber", p.policy_number AS "policyNumber", to_char(c.loss_date, 'YYYY-MM-DD') AS "lossDate",
      to_char(c.reported_date, 'YYYY-MM-DD') AS "reportedDate", c.loss_type AS "lossType", c.status, c.estimate_amount::float8 AS "estimateAmount",
      c.settled_amount::float8 AS "settledAmount"
    FROM claims c LEFT JOIN policies p ON p.id = c.policy_id
    WHERE c.client_id = $1 OR c.policy_id IN (SELECT id FROM policies WHERE client_id = $1) ORDER BY c.reported_date DESC NULLS LAST`, [party.id]) : [];
  const receipts = isClient ? await many(`SELECT r.receipt_number AS "receiptNumber", to_char(r.received_date, 'YYYY-MM-DD') AS "receivedDate",
      r.amount::float8 AS amount, r.payment_mode AS "paymentMode", COALESCE(r.policy_number, p.policy_number) AS "policyNumber", COALESCE(r.receipt_status, r.status) AS status
    FROM receipts r LEFT JOIN policies p ON p.id = r.policy_id
    WHERE r.client_id = $1 OR r.policy_id IN (SELECT id FROM policies WHERE client_id = $1) ORDER BY r.received_date DESC NULLS LAST`, [party.id]) : [];
  const quotations = await many(`SELECT q.quote_number AS "quoteNumber", COALESCE(pr.name, q.product_type) AS product, q.status,
      q.premium_total::float8 AS "grossPremium", to_char(q.created_at, 'YYYY-MM-DD') AS "createdOn"
    FROM quotes q LEFT JOIN products pr ON pr.id = q.product_id
    WHERE q.deleted_at IS NULL AND (q.lead_id = ANY($1::text[]) OR ($2::text IS NOT NULL AND q.client_id = $2)) ORDER BY q.created_at DESC`,
  [leadIds, isClient ? party.id : null]);
  const consents = (await consentsOf(party)).history;
  const requests = (await many(`${REQUEST_SELECT} WHERE r.party_type = $1 AND r.party_id = $2 ORDER BY r.received_on DESC`, [party.type, party.id]))
    .map((r) => ({ requestNumber: r.request_number, requestType: r.request_type, receivedOn: iso(r.received_on), status: r.status, closedOn: iso(r.closed_on) }));
  // identifiers encrypted at rest are given to the data subject in clear
  return revealInPlace({
    generatedAt: new Date().toISOString(), controller: await companyName(),
    party: { type: party.type, id: party.id, code: party.code, name: party.name },
    personalData: personal, leads, consents, policies, claims, receipts, quotations, dataSubjectRequests: requests,
  });
}

/** The export as workbook sheets for lib/xlsx.js. */
export function exportSheets(doc) {
  const table = (name, rows) => {
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => typeof rows.find((r) => r[k] !== null && r[k] !== undefined)?.[k] !== 'object');
    return { name, columns: keys.map((k) => ({ key: k, header: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), width: 20, type: 'auto' })), rows };
  };
  const personal = Object.entries(doc.personalData).flatMap(([k, v]) => (v && typeof v === 'object'
    ? Object.entries(v).map(([k2, v2]) => ({ field: `${k}.${k2}`, value: typeof v2 === 'object' ? JSON.stringify(v2) : v2 }))
    : [{ field: k, value: v }]));
  return [
    { name: 'Personal data', columns: [{ key: 'field', header: 'Field', width: 28 }, { key: 'value', header: 'Value', width: 50, type: 'wrap' }], rows: personal },
    table('Consents', doc.consents), table('Policies', doc.policies), table('Claims', doc.claims), table('Receipts', doc.receipts),
    table('Quotations', doc.quotations), table('Requests', doc.dataSubjectRequests),
  ];
}

// ---------- anonymisation ----------

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
/** JSON keys holding a person's name: replaced by the anonymised label. */
const NAME_KEYS = new Set(['firstname', 'fullname', 'insuredname', 'customername', 'clientname', 'assuredname', 'policyholder', 'policyholdername',
  'holdername', 'ownername', 'registeredowner', 'payername', 'accountname', 'contactperson', 'contactname', 'displayname', 'preferredname', 'companyname', 'insured']);
/** JSON keys holding other personal data: cleared. */
const PERSONAL_KEYS = new Set(['lastname', 'middlename', 'middleinitial', 'suffix', 'email', 'emailid', 'emailaddress', 'phone', 'phonenumber', 'mobile', 'mobileno',
  'mobilenumber', 'contactnumber', 'contactno', 'telephone', 'telephonenumber', 'landline', 'fax', 'address', 'address1', 'address2', 'addressline1', 'addressline2',
  'fulladdress', 'mailingaddress', 'homeaddress', 'residentialaddress', 'street', 'houseno', 'housenumber', 'barangay', 'road', 'roadthanon', 'soi', 'soialley',
  'moo', 'moovillage', 'zipcode', 'postalcode', 'dob', 'birthdate', 'dateofbirth', 'birthday', 'placeofbirth', 'age', 'gender', 'sex', 'civilstatus',
  'tin', 'tinno', 'tinnumber', 'taxnumber', 'taxid', 'taxinformationnumber', 'idnumber', 'idno', 'governmentid', 'validid', 'sss', 'sssno', 'sssnumber',
  'gsis', 'gsisno', 'philhealth', 'pagibig', 'umid', 'passport', 'passportno', 'passportnumber', 'licenseno', 'licensenumber', 'driverslicense',
  'driverlicense', 'driverlicenseno', 'mothersmaidenname', 'occupation', 'employer', 'nationality', 'notes', 'personalnotes']);

/** Objects describing one person: inside them a plain "name" is that person's name. */
const PERSON_OBJECTS = new Set(['customerinfo', 'customer', 'customerdetails', 'client', 'clientdetails', 'clientinfo', 'lead', 'leaddetails', 'leadinfo',
  'insured', 'insureddetails', 'insuredinfo', 'policyholder', 'driver', 'driverdetails', 'contactperson', 'owner', 'ownerdetails', 'payer']);

/**
 * Copy of a JSON value with personal keys replaced; `cleared` collects the key names touched (never the values).
 * `person`: the value describes one person (a "name" key is then their name).
 */
export function scrubJson(value, label, cleared = new Set(), person = false) {
  if (Array.isArray(value)) return value.map((v) => scrubJson(v, label, cleared, person));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const n = normKey(k);
    const empty = v === null || v === undefined || v === '';
    if ((NAME_KEYS.has(n) || (person && n === 'name')) && (typeof v !== 'object' || v === null)) {
      if (!empty && v !== label) cleared.add(k);
      out[k] = empty ? v : label;
    } else if (PERSONAL_KEYS.has(n)) {
      if (!empty) cleared.add(k);
      out[k] = null;
    } else out[k] = scrubJson(v, label, cleared, PERSON_OBJECTS.has(n));
  }
  return out;
}

const CLOSED_POLICY = ['expired', 'cancelled', 'canceled', 'lapsed', 'renewed', 'void', 'rejected', 'terminated', 'declined', 'not taken up'];
const CLOSED_CLAIM = ['settled', 'closed', 'rejected', 'withdrawn', 'cancelled', 'denied'];
const CLOSED_COMMISSION = ['paid', 'reversed', 'cancelled', 'void'];
const CLOSED_RECEIVABLE = ['paid', 'cancelled', 'written-off', 'written_off', 'void'];
const CLOSED_ENDORSEMENT = ['completed', 'cancelled', 'rejected', 'void', 'declined', 'withdrawn'];

const addYears = (isoDay, years) => {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + Number(years));
  return d.toISOString().slice(0, 10);
};

/** Reasons the party's personal data must be kept now (empty when anonymisation is allowed), with the retention dates. */
export async function blockers(db, party) {
  const now = await today();
  const reasons = [];
  if (party.row.anonymised_at) reasons.push({ code: 'already-anonymised', message: 'The personal data were already anonymised' });
  if (party.type === 'lead') {
    if (party.row.client_id) {
      const c = (await db.query('SELECT client_code FROM clients WHERE id = $1', [party.row.client_id])).rows[0];
      reasons.push({ code: 'converted', message: `The prospect was converted to client ${c?.client_code || party.row.client_id}; anonymise the client instead` });
    }
    return { now, reasons, retention: null };
  }
  const id = party.id;
  const count = async (sql, params) => Number((await db.query(sql, params)).rows[0].n);
  const POLICIES = 'SELECT id FROM policies WHERE client_id = $1';
  const inForce = await count(`SELECT count(*) AS n FROM policies WHERE client_id = $1 AND lower(coalesce(status, '')) <> ALL($2::text[])
    AND (expiry_date IS NULL OR expiry_date >= $3::date)`, [id, CLOSED_POLICY, now]);
  if (inForce) reasons.push({ code: 'in-force-policies', count: inForce, message: `${inForce} policy(ies) in force or not yet expired` });
  const receivables = await count(`SELECT count(*) AS n FROM receivables WHERE (client_id = $1 OR policy_id IN (${POLICIES}))
    AND balance > 0 AND lower(coalesce(status, '')) <> ALL($2::text[])`, [id, CLOSED_RECEIVABLE]);
  if (receivables) reasons.push({ code: 'open-receivables', count: receivables, message: `${receivables} premium bill(s) with a balance due` });
  const claims = await count(`SELECT count(*) AS n FROM claims WHERE (client_id = $1 OR policy_id IN (${POLICIES})) AND lower(coalesce(status, '')) <> ALL($2::text[])`, [id, CLOSED_CLAIM]);
  if (claims) reasons.push({ code: 'open-claims', count: claims, message: `${claims} claim(s) still open` });
  const commissions = await count(`SELECT count(*) AS n FROM commissions WHERE policy_id IN (${POLICIES}) AND lower(coalesce(status, '')) <> ALL($2::text[])`, [id, CLOSED_COMMISSION]);
  if (commissions) reasons.push({ code: 'unpaid-commissions', count: commissions, message: `${commissions} commission line(s) not yet paid` });
  const endorsements = await count(`SELECT count(*) AS n FROM endorsements WHERE (client_id = $1 OR policy_id IN (${POLICIES})) AND lower(coalesce(status, '')) <> ALL($2::text[])`, [id, CLOSED_ENDORSEMENT]);
  if (endorsements) reasons.push({ code: 'open-endorsements', count: endorsements, message: `${endorsements} endorsement(s) still open` });
  // AMLA record keeping: open AML cases, and aml.record_retention_years after the last transaction or case
  const { amlRetentionBlocker } = await import('../aml/retention.js');
  const aml = await amlRetentionBlocker(db, id, now);
  if (aml) reasons.push(aml);
  const years = Number(await getSetting('privacy.retention_years', 10));
  const last = (await db.query('SELECT max(expiry_date) AS d FROM policies WHERE client_id = $1', [id])).rows[0].d;
  const lastExpiry = iso(last);
  const retainedUntil = lastExpiry ? addYears(lastExpiry, years) : null;
  if (retainedUntil && retainedUntil > now) {
    reasons.push({ code: 'retention-period', message: `Insurance and tax records are kept until ${retainedUntil} (${years} years after the last policy expiry on ${lastExpiry})` });
  }
  return { now, reasons, retention: { years, lastPolicyExpiry: lastExpiry, retainedUntil } };
}

/**
 * The updates that anonymise a party: [{ table, id, set: { column: value }, fields: [names cleared] }].
 * Amounts, document numbers, dates and statuses are never touched.
 */
async function anonymisationPlan(db, party) {
  const label = party.type === 'client' ? `Anonymised client ${party.code}` : `Anonymised prospect ${party.code}`;
  const plan = [];
  const nonEmpty = (row, cols) => cols.filter((c) => row[c] !== null && row[c] !== undefined && row[c] !== '');
  /** One row: `set` holds the plain columns (null = cleared, text = the label), `json` the scrubbed JSON columns. */
  const push = (table, row, set, json = { set: {}, fields: [] }) => {
    const fields = [...Object.keys(set).filter((c) => (set[c] === null ? nonEmpty(row, [c]).length > 0 : row[c] !== set[c])), ...json.fields];
    if (fields.length) plan.push({ table, id: row.id, set: { ...set, ...json.set }, fields: [...new Set(fields)] });
  };
  const scrubColumns = (row, cols) => {
    const set = {};
    const fields = [];
    for (const c of cols) {
      if (!row[c] || typeof row[c] !== 'object') continue;
      const cleared = new Set();
      const v = scrubJson(row[c], label, cleared, PERSON_OBJECTS.has(c));
      if (cleared.size) { set[c] = JSON.stringify(v); fields.push(...[...cleared].map((k) => `${c}.${k}`)); }
    }
    return { set, fields };
  };
  const PERSON = { email: null, phone: null, birth_date: null, gender: null, house_no: null, road: null, soi: null, moo: null, barangay: null, address: null,
    city: null, state: null, postal_code: null, preferred_name: null, last_name: null, company_name: null };

  const leadIds = party.type === 'client'
    ? (await db.query('SELECT id FROM leads WHERE client_id = $1 OR id = $2', [party.id, party.row.lead_id || ''])).rows.map((r) => r.id)
    : [party.id];
  if (party.type === 'client') {
    const c = party.row;
    push('clients', c, { ...PERSON, tin: null, first_name: label, display_name: label }, scrubColumns(c, ['extra']));
  }
  for (const l of (await db.query('SELECT * FROM leads WHERE id = ANY($1::text[])', [leadIds])).rows) {
    push('leads', l, { ...PERSON, tax_number: null, notes: null, first_name: label, display_name: label }, scrubColumns(l, ['extra']));
  }
  const clientId = party.type === 'client' ? party.id : null;
  const byParty = (alias = '') => `(${alias}client_id = $1 OR ${alias}lead_id = ANY($2::text[]))`;
  const params = [clientId, leadIds];
  const policyIds = (await db.query(`SELECT id FROM policies WHERE ${byParty()}`, params)).rows.map((r) => r.id);

  for (const p of (await db.query(`SELECT id, insured_name, details, doc FROM policies WHERE id = ANY($1::text[])`, [policyIds])).rows) {
    const j = scrubColumns(p, ['details', 'doc']);
    push('policies', p, p.insured_name ? { insured_name: label } : {}, j);
  }
  for (const q of (await db.query(`SELECT id, doc, vehicle, approval_sent_to FROM quotes WHERE ${byParty()}`, params)).rows) {
    const j = scrubColumns(q, ['doc', 'vehicle']);
    push('quotes', q, { approval_sent_to: null }, j);
  }
  for (const c of (await db.query(`SELECT id, details, policy_info, driver, is_holder_driver FROM claims WHERE ${byParty()} OR policy_id = ANY($3::text[])`, [...params, policyIds])).rows) {
    const j = scrubColumns(c, c.is_holder_driver ? ['details', 'policy_info', 'driver'] : ['details', 'policy_info']);
    push('claims', c, {}, j);
  }
  for (const e of (await db.query('SELECT id, changes FROM endorsements WHERE client_id = $1 OR policy_id = ANY($2::text[])', [clientId, policyIds])).rows) {
    const j = scrubColumns(e, ['changes']);
    push('endorsements', e, {}, j);
  }
  for (const [table, cols] of [['placements', ['doc']], ['broker_slips', ['doc', 'risk_details']]]) {
    for (const r of (await db.query(`SELECT id, insured_name, ${cols.join(', ')} FROM ${table} WHERE ${byParty()}`, params)).rows) {
      const j = scrubColumns(r, cols);
      push(table, r, r.insured_name ? { insured_name: label } : {}, j);
    }
  }
  for (const r of (await db.query(`SELECT id, insured_name, doc FROM package_quotes WHERE ${byParty()}`, params)).rows) {
    const j = scrubColumns(r, ['doc']);
    push('package_quotes', r, r.insured_name ? { insured_name: label } : {}, j);
  }
  for (const r of (await db.query('SELECT id, customer_name FROM receipts WHERE (client_id = $1 OR policy_id = ANY($2::text[])) AND customer_name IS NOT NULL', [clientId, policyIds])).rows) {
    push('receipts', r, { customer_name: label });
  }
  for (const r of (await db.query('SELECT id, payer_name, payer_email, payer_mobile FROM payment_links WHERE client_id = $1 OR policy_id = ANY($2::text[])', [clientId, policyIds])).rows) {
    push('payment_links', r, { ...(r.payer_name ? { payer_name: label } : {}), payer_email: null, payer_mobile: null });
  }
  // insured name copied onto the lines of remittances, debit notes and insurer statements (amounts are kept)
  for (const table of ['remittance_lines', 'commission_debit_note_lines', 'insurer_statement_lines']) {
    for (const r of (await db.query(`SELECT id, insured_name FROM ${table} WHERE policy_id = ANY($1::text[]) AND insured_name IS NOT NULL`, [policyIds])).rows) {
      push(table, r, { insured_name: label });
    }
  }
  return { label, plan };
}

/** Summary of a plan for the dry run and the audit trail: per table the number of rows and the fields cleared (no values). */
const summarise = (plan) => {
  const out = {};
  for (const p of plan) {
    const t = (out[p.table] ||= { rows: 0, fields: [] });
    t.rows += 1;
    for (const f of p.fields) if (!t.fields.includes(f)) t.fields.push(f);
  }
  return out;
};

/** What anonymising the party would do: { allowed, blockers, retention, cleared }. */
export async function anonymiseDryRun(db, party) {
  const b = await blockers(db, party);
  const { label, plan } = await anonymisationPlan(db, party);
  return { partyType: party.type, partyId: party.id, partyCode: party.code, partyName: party.name, allowed: b.reasons.length === 0,
    blockers: b.reasons, retention: b.retention, label, cleared: summarise(plan) };
}

/** Anonymise the party (in the caller's transaction); refuses with the list of reasons when the data must be kept. */
export async function anonymise(db, party, userId) {
  await db.query(`SELECT 1 FROM ${party.type === 'client' ? 'clients' : 'leads'} WHERE id = $1 FOR UPDATE`, [party.id]);
  const fresh = await getParty(party.type, party.id, db);
  const b = await blockers(db, fresh);
  if (b.reasons.length) throw new HttpError(409, `The personal data cannot be anonymised: ${b.reasons.map((r) => r.message).join('; ')}`, b.reasons);
  const { label, plan } = await anonymisationPlan(db, fresh);
  for (const step of plan) {
    const keys = Object.keys(step.set);
    await db.query(`UPDATE ${step.table} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [step.id, ...keys.map((k) => step.set[k])]);
  }
  if (fresh.type === 'client') {
    await db.query('UPDATE clients SET anonymised_at = now(), anonymised_by = $2, updated_by = $2, updated_at = now() WHERE id = $1', [fresh.id, userId]);
    await db.query('UPDATE leads SET anonymised_at = now(), anonymised_by = $2 WHERE client_id = $1 OR id = $3', [fresh.id, userId, fresh.row.lead_id || '']);
  } else {
    await db.query('UPDATE leads SET anonymised_at = now(), anonymised_by = $2, updated_by = $2, updated_at = now() WHERE id = $1', [fresh.id, userId]);
  }
  return { partyType: fresh.type, partyId: fresh.id, partyCode: fresh.code, label, cleared: summarise(plan) };
}
