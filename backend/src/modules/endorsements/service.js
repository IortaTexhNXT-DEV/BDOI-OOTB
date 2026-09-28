import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { queueEmail } from '../../lib/mailer.js';
import { notify } from '../notifications/router.js';
import { nextNumber, toDate, num, round2, renderTemplate, emailTemplate } from '../documents/common.js';
import { endorsementStatusOut, endorsementStatusIn } from '../documents/statuses.js';
import { getPolicyRow, createReceivable } from '../policies/service.js';
import { publicUrl } from '../uploads/storage.js';

export function toEndorsement(r) {
  if (!r) return null;
  const changes = r.changes || {};
  const status = endorsementStatusOut(r.status);
  return {
    ...changes,
    id: r.id, endorsementId: r.id, endorsementNumber: r.endorsement_number, policyId: r.policy_id, policyNumber: r.policy_number,
    clientId: r.client_id, clientName: r.client_name, insuredName: r.insured_name, status, endorsementStatus: status, endorsementType: r.endorsement_type,
    endorsementTypeIds: r.endorsement_type_ids || [], isCancelPolicy: r.is_cancel, cancellationType: r.cancellation_type,
    premiumDelta: Number(r.premium_delta), effectiveDate: r.effective_date, remarks: r.remarks, documentKey: r.document_key,
    documentUrl: r.document_key ? (/^https?:/.test(r.document_key) ? r.document_key : publicUrl(r.document_key)) : null, completionDetails: r.completion || {},
    policyExpiry: r.policy_expiry, lob: r.lob, receivableId: r.receivable_id, sentAt: r.sent_at, completedAt: r.completed_at,
    summary: { status, endorsementTypeIds: r.endorsement_type_ids || [], coverageChanges: changes.coverageChanges || null, premiumDelta: Number(r.premium_delta) },
    createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const SELECT = `SELECT e.*, p.policy_number, p.expiry_date AS policy_expiry, p.lob, p.insured_name, c.display_name AS client_name,
  (SELECT u.display_name FROM users u WHERE u.id = e.created_by) AS created_by_name
  FROM endorsements e JOIN policies p ON p.id = e.policy_id LEFT JOIN clients c ON c.id = e.client_id`;

export async function getEndorsementRow(id, db = null) {
  const r = (await (db || { query }).query(`${SELECT} WHERE e.id = $1 OR e.endorsement_number = $1`, [id])).rows[0];
  if (!r) throw notFound('Endorsement not found');
  return r;
}

/** Request fields that drive the endorsement itself; everything else is the change set. */
const CONTROL_FIELDS = ['policyId', 'endorsementTypeIds', 'isCancelPolicy', 'cancellationType', 'premiumDelta', 'effectiveDate', 'remarks'];

/** Endorsement type label from the selected type ids (endorsements.types in app_settings). */
async function typeOf(ids, isCancel) {
  const types = await getSetting('endorsements.types', {});
  if (isCancel) return 'cancellation';
  const names = ids.map((i) => types[String(i)] || String(i));
  return names.length ? [...new Set(names)].join(',') : 'other';
}

export async function createEndorsement(body, userId) {
  const policy = await getPolicyRow(body.policyId);
  if (['cancelled', 'expired'].includes(policy.status)) throw badRequest(`Policy ${policy.policy_number} is ${policy.status} and cannot be endorsed`);
  const ids = Array.isArray(body.endorsementTypeIds) ? body.endorsementTypeIds : (body.endorsementTypeIds ? [body.endorsementTypeIds] : []);
  const isCancel = body.isCancelPolicy === true;
  const { cancellationType, premiumDelta, effectiveDate, remarks } = body;
  const changes = Object.fromEntries(Object.entries(body).filter(([k]) => !CONTROL_FIELDS.includes(k)));
  let delta = premiumDelta !== undefined && premiumDelta !== null && premiumDelta !== '' ? num(premiumDelta) : 0;
  const newGross = num(changes.coverageChanges?.Grosspremium ?? changes.coverageChanges?.grossPremium);
  if (!delta && !isCancel && newGross) delta = round2(newGross - Number(policy.premium_total));
  const number = await nextNumber(null, 'endorsement', 'endorsement');
  const r = await one(`INSERT INTO endorsements(endorsement_number, policy_id, client_id, endorsement_type, status, changes, premium_delta, effective_date, remarks,
      endorsement_type_ids, is_cancel, cancellation_type, created_by) VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
  [number, policy.id, policy.client_id, await typeOf(ids, isCancel), JSON.stringify(changes), round2(delta), toDate(effectiveDate) || toDate(new Date()), remarks || null,
    JSON.stringify(ids), isCancel, cancellationType || (isCancel ? 'FULL' : null), userId]);
  return getEndorsementRow(r.id);
}

export async function listEndorsements(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.clientId) add('e.client_id = ?', q.clientId);
  if (q.policyId) add('(e.policy_id = ? OR p.policy_number = ?)', q.policyId);
  if (q.status) add('e.status = ?', endorsementStatusIn(q.status) || q.status);
  const search = q.search || q.query;
  if (search) add("(e.endorsement_number ILIKE '%' || ? || '%' OR p.policy_number ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%')", search);
  const w = where.join(' AND ');
  const total = (await one(`SELECT count(*)::int AS n FROM endorsements e JOIN policies p ON p.id = e.policy_id LEFT JOIN clients c ON c.id = e.client_id WHERE ${w}`, params)).n;
  const rows = await many(`${SELECT} WHERE ${w} ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  return { total, rows };
}

export const endorsementsOfPolicy = async (policyId) => many(`${SELECT} WHERE e.policy_id = $1 ORDER BY e.created_at DESC`, [policyId]);

/** Draft -> PendingCustomer (or InitiateCancel for cancellations): e-mail the client the endorsement summary. */
export async function sendToCustomer(id, userId, cancel) {
  const e = await getEndorsementRow(id);
  if (!['draft', 'submitted', 'cancel-initiated'].includes(e.status)) throw badRequest(`A ${endorsementStatusOut(e.status)} endorsement cannot be sent`);
  const target = cancel ? 'cancel-initiated' : 'submitted';
  const client = e.client_id ? await one('SELECT display_name, email FROM clients WHERE id = $1', [e.client_id]) : null;
  if (client?.email) {
    const t = await emailTemplate('endorsement_customer');
    const v = { customerName: client.display_name, endorsementNumber: e.endorsement_number, policyNumber: e.policy_number,
      premiumDelta: Number(e.premium_delta).toFixed(2), currency: await getSetting('currency.default', 'PHP'), companyName: await getSetting('general.company_name', ''),
      action: cancel ? 'cancellation' : 'endorsement' };
    await queueEmail({ to: client.email, subject: renderTemplate(t.subject, v), html: renderTemplate(t.html, v), template: 'endorsement_customer', entity: 'endorsement', entityId: e.id });
  }
  await query('UPDATE endorsements SET status = $2, sent_at = now(), sent_by = $3, updated_by = $3, updated_at = now() WHERE id = $1', [e.id, target, userId]);
  return { before: e, after: await getEndorsementRow(e.id), emailedTo: client?.email || null };
}

/** PascalCase form keys (PlateNumber) -> policy document keys (plateNumber). */
const camel = (k) => (k === 'TNVS' ? 'TNVS' : k === 'MVFileNumber' ? 'MvFileNumber' : k.charAt(0).toLowerCase() + k.slice(1));
const camelize = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [camel(k), v]));

/** Apply the endorsement to the policy and client inside a transaction. */
async function applyToPolicy(db, e, completion, userId) {
  const p = (await db.query('SELECT * FROM policies WHERE id = $1 FOR UPDATE', [e.policy_id])).rows[0];
  const ch = e.changes || {};
  const doc = { ...(p.doc || {}), ...camelize(ch.motorDetails) };
  const cols = { premium_total: round2(Number(p.premium_total) + Number(e.premium_delta)) };
  const pd = ch.personalDetails;
  if (pd) {
    const name = [pd.FirstName, pd.LastName].filter(Boolean).join(' ') || pd.CompanyName;
    if (name) cols.insured_name = name;
    if (p.client_id) {
      await db.query(`UPDATE clients SET email = COALESCE(NULLIF($2,''), email), phone = COALESCE(NULLIF($3,''), phone), house_no = COALESCE(NULLIF($4,''), house_no),
        barangay = COALESCE(NULLIF($5,''), barangay), city = COALESCE(NULLIF($6,''), city), state = COALESCE(NULLIF($7,''), state), country = COALESCE(NULLIF($8,''), country),
        postal_code = COALESCE(NULLIF($9,''), postal_code), updated_by = $10, updated_at = now() WHERE id = $1`,
      [p.client_id, pd.EmailID, pd.ContactNumber, pd.HouseNo, pd.Barangay, pd.City, pd.Province, pd.Country, pd.ZIPCode, userId]);
    }
  }
  if (ch.coverageChanges) doc.endorsedCoverage = ch.coverageChanges;
  if (ch.policyExtension && completion.expiryDate) cols.expiry_date = completion.expiryDate;
  if (e.is_cancel) cols.status = 'cancelled';
  doc.endorsements = [...(doc.endorsements || []), { endorsementId: e.id, endorsementNumber: e.endorsement_number, completedAt: new Date().toISOString() }];
  const data = { ...cols, doc: JSON.stringify(doc), updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await db.query(`UPDATE policies SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [p.id, ...Object.values(data)]);
  return p;
}

export async function completeEndorsement(body, userId) {
  const e0 = await getEndorsementRow(body.endorsementId);
  if (['completed', 'cancelled', 'rejected'].includes(e0.status)) throw badRequest(`Endorsement is already ${endorsementStatusOut(e0.status)}`);
  const completion = {
    policyNumber: body.policyNumber || e0.policy_number, insurerEndorsementNumber: body.endorsementNumber || null,
    productionDate: toDate(body.productionDate), inceptionDate: toDate(body.inceptionDate), issuedDate: toDate(body.issuedDate), expiryDate: toDate(body.expiryDate), notes: body.notes || '',
  };
  const policy = await withTransaction(async (db) => {
    const e = (await db.query('SELECT * FROM endorsements WHERE id = $1 FOR UPDATE', [e0.id])).rows[0];
    const p = await applyToPolicy(db, e, completion, userId);
    let receivableId = null;
    if (Number(e.premium_delta) > 0) {
      receivableId = (await createReceivable(db, { policyId: p.id, clientId: p.client_id, amount: Number(e.premium_delta), fromDate: completion.issuedDate || toDate(new Date()) })).id;
    }
    await db.query(`UPDATE endorsements SET status = $2, completion = $3, document_key = COALESCE($4, document_key), completed_at = now(), completed_by = $5,
      receivable_id = $6, updated_by = $5, updated_at = now() WHERE id = $1`, [e.id, e.is_cancel ? 'cancelled' : 'completed', JSON.stringify(completion), body.documentKey || null, userId, receivableId]);
    return p;
  });
  const after = await getEndorsementRow(e0.id);
  const owner = policy.owner_user_id || e0.created_by;
  if (owner) {
    await notify({ userId: owner, type: 'info', title: after.is_cancel ? 'Policy cancelled by endorsement' : 'Endorsement completed',
      message: `Endorsement ${after.endorsement_number} on policy ${after.policy_number} was completed (premium change ${Number(after.premium_delta).toFixed(2)})`,
      link: `/agent/endorsementdetailedview/${after.id}`, entity: 'endorsement', entityId: after.id });
  }
  return { before: e0, after };
}

export async function attachDocument(id, key, userId) {
  const e = await getEndorsementRow(id);
  await query('UPDATE endorsements SET document_key = $2, updated_by = $3, updated_at = now() WHERE id = $1', [e.id, key, userId]);
  return getEndorsementRow(e.id);
}
