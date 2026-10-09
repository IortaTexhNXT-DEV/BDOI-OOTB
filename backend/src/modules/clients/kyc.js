/**
 * Client due diligence records of the onboarding screen (Operations > Clients > Onboard client): authorised signatories
 * and beneficial owners of juridical clients, KYC documents, the identification still missing and the KYC status.
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { num } from '../../lib/money.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { storeFile } from '../uploads/storage.js';

const isoDay = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/** Ownership percentage from which a natural person is a beneficial owner of a juridical client. */
const ownerThreshold = async () => num(await getSetting('clients.beneficial_owner_threshold', 25));

export async function clientRow(id) {
  const c = (await query('SELECT * FROM clients WHERE id = $1 OR client_code = $1', [id])).rows[0];
  if (!c) throw notFound('Client not found');
  return c;
}

export const signatoryRow = (s) => ({
  id: s.id, clientId: s.client_id, fullName: s.full_name, position: s.position, nationality: s.nationality, birthDate: isoDay(s.birth_date), idType: s.id_type,
  idNumber: s.id_number, authorityDocument: s.authority_document, authorityReference: s.authority_reference, authorityDate: isoDay(s.authority_date),
  authorityValidUntil: isoDay(s.authority_valid_until), signingLimit: s.signing_limit === null ? null : Number(s.signing_limit), status: s.status, updatedAt: s.updated_at,
});

export const ownerRow = (o) => ({
  id: o.id, clientId: o.client_id, fullName: o.full_name, nationality: o.nationality, birthDate: isoDay(o.birth_date),
  ownershipPercent: o.ownership_percent === null ? null : Number(o.ownership_percent), controlType: o.control_type, idType: o.id_type, idNumber: o.id_number,
  address: o.address, isPep: o.is_pep, pepDetails: o.pep_details, status: o.status, updatedAt: o.updated_at,
});

export const documentRow = (d) => ({
  id: Number(d.id), clientId: d.client_id, docType: d.doc_type, relatedType: d.related_type, relatedId: d.related_id, description: d.description,
  storageKey: d.storage_key, fileName: d.file_name, expiryDate: isoDay(d.expiry_date), uploadedBy: d.uploaded_by_name || d.uploaded_by, uploadedAt: d.uploaded_at,
});

const SIG_COLS = { fullName: 'full_name', position: 'position', nationality: 'nationality', birthDate: 'birth_date', idType: 'id_type', idNumber: 'id_number',
  authorityDocument: 'authority_document', authorityReference: 'authority_reference', authorityDate: 'authority_date', authorityValidUntil: 'authority_valid_until',
  signingLimit: 'signing_limit', status: 'status' };
const BO_COLS = { fullName: 'full_name', nationality: 'nationality', birthDate: 'birth_date', ownershipPercent: 'ownership_percent', controlType: 'control_type',
  idType: 'id_type', idNumber: 'id_number', address: 'address', isPep: 'is_pep', pepDetails: 'pep_details', status: 'status' };

const pickCols = (map, b) => Object.fromEntries(Object.entries(map).filter(([k]) => b[k] !== undefined).map(([k, c]) => [c, b[k] === '' ? null : b[k]]));

async function saveChild(table, map, rowFn, clientId, id, b, userId, db = { query }) {
  const c = (await db.query('SELECT * FROM clients WHERE id = $1 OR client_code = $1', [clientId])).rows[0];
  if (!c) throw notFound('Client not found');
  if (c.client_type !== 'corporate') throw badRequest('Authorised signatories and beneficial owners are recorded for juridical clients (client type corporate)');
  const cols = pickCols(map, b);
  if (id) {
    const before = (await db.query(`SELECT * FROM ${table} WHERE id = $1 AND client_id = $2`, [id, c.id])).rows[0];
    if (!before) throw notFound('Record not found');
    const keys = Object.keys(cols);
    const r = keys.length ? (await db.query(`UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_by = $${keys.length + 3}, updated_at = now()
      WHERE id = $1 AND client_id = $2 RETURNING *`, [id, c.id, ...Object.values(cols), userId])).rows[0] : before;
    return { before: rowFn(before), after: rowFn(r), clientId: c.id };
  }
  if (!cols.full_name) throw badRequest('fullName is required');
  const data = { ...cols, client_id: c.id, created_by: userId };
  const keys = Object.keys(data);
  const r = (await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(data))).rows[0];
  return { before: null, after: rowFn(r), clientId: c.id };
}

export const saveSignatory = (clientId, id, b, userId, db) => saveChild('client_signatories', SIG_COLS, signatoryRow, clientId, id, b, userId, db);
export const saveOwner = (clientId, id, b, userId, db) => saveChild('client_beneficial_owners', BO_COLS, ownerRow, clientId, id, b, userId, db);

export async function signatories(clientId) {
  return (await query('SELECT * FROM client_signatories WHERE client_id = $1 ORDER BY status, created_at', [clientId])).rows.map(signatoryRow);
}
export async function owners(clientId) {
  return (await query('SELECT * FROM client_beneficial_owners WHERE client_id = $1 ORDER BY status, ownership_percent DESC NULLS LAST, created_at', [clientId])).rows.map(ownerRow);
}
export async function documents(clientId) {
  return (await query(`SELECT d.*, u.display_name AS uploaded_by_name FROM client_kyc_documents d LEFT JOIN users u ON u.id = d.uploaded_by
    WHERE d.client_id = $1 ORDER BY d.uploaded_at DESC, d.id DESC`, [clientId])).rows.map(documentRow);
}

/** Store an uploaded KYC document (folder kyc) and link it to the client and, optionally, a signatory or beneficial owner. */
export async function addDocument(clientId, file, b, user) {
  const c = await clientRow(clientId);
  if (!file?.buffer?.length) throw badRequest('Attach the document in the "file" field');
  const relatedType = b.relatedType || 'client';
  if (relatedType !== 'client') {
    const table = { signatory: 'client_signatories', 'beneficial-owner': 'client_beneficial_owners' }[relatedType];
    if (!table) throw badRequest('relatedType must be client, signatory or beneficial-owner');
    const ok = (await query(`SELECT 1 FROM ${table} WHERE id = $1 AND client_id = $2`, [b.relatedId || '', c.id])).rows[0];
    if (!ok) throw badRequest(`relatedId is not a ${relatedType} of this client`);
  }
  const stored = await storeFile(file, { folder: 'kyc', userId: user.id, entity: 'client', entityId: c.id });
  const r = (await query(`INSERT INTO client_kyc_documents(client_id, doc_type, related_type, related_id, description, storage_key, file_name, expiry_date, uploaded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
  [c.id, b.docType || 'other', relatedType, relatedType === 'client' ? null : b.relatedId, b.description || null, stored.key, file.originalname, isoDay(b.expiryDate), user.id])).rows[0];
  return { ...documentRow(r), url: stored.url };
}

/** Identification still missing on the client record (labels shown on the onboarding screen). */
export async function missingKyc(db, c) {
  const missing = [];
  const need = (v, label) => { if (v === null || v === undefined || String(v).trim() === '') missing.push(label); };
  if (c.client_type === 'corporate') {
    need(c.company_name, 'Registered name');
    need(c.registration_number, 'SEC, DTI or CDA registration number');
    need(c.tin, 'TIN');
    need(c.city || c.state, 'Registered address');
    const sig = Number((await db.query("SELECT count(*) AS n FROM client_signatories WHERE client_id = $1 AND status = 'active'", [c.id])).rows[0].n);
    if (!sig) missing.push('Authorised signatory with board resolution or secretary\'s certificate');
    const bo = Number((await db.query("SELECT count(*) AS n FROM client_beneficial_owners WHERE client_id = $1 AND status = 'active'", [c.id])).rows[0].n);
    if (!bo) missing.push('Beneficial owner declaration');
  } else {
    need(c.first_name, 'First name');
    need(c.last_name, 'Last name');
    need(c.birth_date, 'Date of birth');
    need(c.nationality, 'Nationality');
    need(c.id_type, 'ID type');
    need(c.id_number, 'ID number');
    need(c.city || c.state, 'Address');
  }
  return missing;
}

/** Recompute and store the KYC status of a client (complete when nothing is missing, pending otherwise); returns it. */
export async function refreshKycStatus(clientId, db = { query }) {
  const c = (await db.query('SELECT * FROM clients WHERE id = $1', [clientId])).rows[0];
  if (!c) return null;
  const status = (await missingKyc(db, c)).length ? 'pending' : 'complete';
  if (status !== c.kyc_status) await db.query('UPDATE clients SET kyc_status = $2 WHERE id = $1', [clientId, status]);
  return status;
}

/** Beneficial owner checks of a juridical client: owners at or above the threshold, total declared, missing controller. */
export function ownerWarnings(c, list, threshold) {
  if (c.client_type !== 'corporate') return [];
  const active = list.filter((o) => o.status === 'active');
  const warnings = [];
  if (!active.length) warnings.push('No beneficial owner declared: record the natural persons who own or control the client, or its senior managing official');
  const total = active.reduce((s, o) => s + num(o.ownershipPercent), 0);
  if (total > 100.0001) warnings.push(`Ownership declared adds up to ${total}% (more than 100%)`);
  const below = active.filter((o) => o.controlType === 'ownership' && o.ownershipPercent !== null && o.ownershipPercent < threshold);
  if (below.length) warnings.push(`${below.map((o) => o.fullName).join(', ')} own(s) less than ${threshold}%: record them as beneficial owners only when they control the client by other means`);
  return warnings;
}

/** KYC profile of a client: identification gaps, signatories, beneficial owners and documents. */
export async function profile(id) {
  const c = await clientRow(id);
  await refreshKycStatus(c.id);
  const fresh = await clientRow(c.id);
  const ownerList = await owners(c.id);
  const threshold = await ownerThreshold();
  return {
    client: {
      id: fresh.id, clientCode: fresh.client_code, displayName: fresh.display_name, clientType: fresh.client_type, customerType: fresh.customer_type,
      kycStatus: fresh.kyc_status, isPep: fresh.is_pep, onboardedVia: fresh.onboarded_via, onboardedAt: fresh.onboarded_at,
    },
    missing: await missingKyc({ query }, fresh),
    signatories: await signatories(c.id),
    beneficialOwners: ownerList,
    ownerWarnings: ownerWarnings(fresh, ownerList, threshold),
    beneficialOwnerThreshold: threshold,
    documents: await documents(c.id),
  };
}
