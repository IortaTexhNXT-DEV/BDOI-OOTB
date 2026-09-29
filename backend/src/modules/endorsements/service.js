import { many, one, query, withTransaction } from '../../db/pool.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { queueEmail } from '../../lib/mailer.js';
import { notify } from '../notifications/router.js';
import { num, round2, renderTemplate, emailTemplate } from '../documents/common.js';
import { endorsementStatusOut, endorsementStatusIn } from '../documents/statuses.js';
import { getPolicyRow, createReceivable } from '../policies/service.js';
import { publicUrl } from '../uploads/storage.js';
import { premiumBreakdown } from '../quotations/premium.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { companyName } from '../../lib/letterhead.js';
import { isoDate } from '../../lib/dates.js';

export function toEndorsement(r) {
  if (!r) return null;
  const changes = r.changes || {};
  const status = endorsementStatusOut(r.status);
  return {
    ...changes,
    id: r.id, endorsementId: r.id, endorsementNumber: r.endorsement_number, policyId: r.policy_id, policyNumber: r.policy_number,
    clientId: r.client_id, clientCode: r.client_code || null, clientName: r.client_name, insuredName: r.insured_name, status, endorsementStatus: status, endorsementType: r.endorsement_type,
    endorsementTypeIds: r.endorsement_type_ids || [], isCancelPolicy: r.is_cancel, cancellationType: r.cancellation_type,
    premiumDelta: Number(r.premium_delta), effectiveDate: r.effective_date, remarks: r.remarks, documentKey: r.document_key,
    documentUrl: r.document_key ? (/^https?:/.test(r.document_key) ? r.document_key : publicUrl(r.document_key)) : null, completionDetails: r.completion || {},
    policyExpiry: r.policy_expiry, lob: r.lob, receivableId: r.receivable_id, sentAt: r.sent_at, completedAt: r.completed_at,
    // the summary screen reads every change group (personalDetails, motorDetails, policyExtension, coverageChanges ...)
    summary: { ...changes, status, endorsementTypeIds: r.endorsement_type_ids || [], coverageChanges: changes.coverageChanges || null, premiumDelta: Number(r.premium_delta) },
    createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const SELECT = `SELECT e.*, p.policy_number, p.expiry_date AS policy_expiry, p.lob, p.insured_name, c.display_name AS client_name, c.client_code,
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

/**
 * Coverage change form keys (PascalCase, as the endorsement screen sends them) -> policy document keys. COVER_INPUTS are
 * the pricing inputs (sums insured, rates, discount, others); COVER_FIGURES the figures derived from them.
 */
const COVER_INPUTS = {
  LossandDamagecoverage: 'lossAndDamageCoverage', LossandDamagecoverageRate: 'lossAndDamageCoverageRate', ActsofNatureRate: 'actsOfNatureRate',
  CtplCoverageRate: 'ctplCoverageRate', BodilyInjury: 'bodilyInjury', PropertyDamage: 'propertyDamage', APPATotalCoverage: 'APPAtotalCoverage',
  AutopassengerpersonalAccident: 'autoPassengerPersonalAccident', Discount: 'discount', OthersPremium: 'accountPremiumOthers',
};
const COVER_FIGURES = {
  LossandDamagecoveragepremium: 'lossAndDamageCoveragePremium', ActsofNaturepremium: 'actsOfNaturePremium', BodilyInjuryCoveragePremium: 'bodilyInjuryCoveragePremium',
  PropertyDamageCoveragePremium: 'propertyDamageCoveragePremium', APPAcoveragePremium: 'APPAcoveragePremium', TotalSumInsured: 'totalSumInsured',
  NETpremium: 'netPremium', ValueAddedTax: 'valueAddedTax', DocumentaryStampTax: 'documentaryStampTax', LocalGovtTax: 'localGovernmentTax', Grosspremium: 'grossPremium',
};
/** A coverage change is priceable when it carries at least one sum insured. */
const SUM_INSURED_KEYS = ['LossandDamagecoverage', 'BodilyInjury', 'PropertyDamage', 'APPATotalCoverage'];
/** Cover rates kept from the policy (the endorsement screen does not edit them). */
const POLICY_RATES = ['roadsideAssistanceRate', 'personalAccidentCoverRate', 'bodilyInjuryRate', 'propertyDamageRate', 'APPARate'];
/** Flat cover premiums kept from the policy when their basis (sum insured / rate) is absent; premium.js passes them through. */
const FLAT_PREMIUMS = [['bodilyInjuryCoveragePremium', 'bodilyInjury'], ['propertyDamageCoveragePremium', 'propertyDamage'], ['APPAcoveragePremium', 'APPAtotalCoverage'],
  ['roadsideAssistancePremium', 'roadsideAssistanceRate'], ['personalAccidentCoverPremium', 'personalAccidentCoverRate'], ['actsOfNaturePremium', 'actsOfNatureRate']];
const given = (v) => v !== undefined && v !== null && v !== '';
const TOLERANCE = 0.01 + 1e-9;

/**
 * Price a coverage change on the server with the quotation premium routine (premium.default_rates, tax.*_rate and
 * premium.taxes_by_lob): the policy's current cover inputs overlaid with the edited ones. Returns null when the change
 * carries no sum insured (nothing to price). When no pricing input differs from the policy the premium is unchanged.
 */
async function priceCoverageChange(cc, policy) {
  if (!cc || !SUM_INSURED_KEYS.some((k) => given(cc[k]))) return null;
  const doc = policy.doc || {};
  const current = { grossPremium: round2(Number(policy.premium_total)), netPremium: round2(Number(policy.net_premium)),
    valueAddedTax: round2(num(doc.valueAddedTax)), documentaryStampTax: round2(num(doc.documentaryStampTax)), localGovernmentTax: round2(num(doc.localGovernmentTax)) };
  const input = { lob: policy.lob, productType: policy.product_type, ctplCoverageRate: doc.ctplCoverageRate ?? doc.ctplCoveragePremium };
  for (const docKey of Object.values(COVER_INPUTS)) if (given(doc[docKey])) input[docKey] = doc[docKey];
  for (const k of POLICY_RATES) if (given(doc[k])) input[k] = doc[k];
  let changed = false;
  for (const [formKey, docKey] of Object.entries(COVER_INPUTS)) {
    if (!given(cc[formKey])) continue;
    if (num(cc[formKey]) !== num(input[docKey])) changed = true;
    input[docKey] = cc[formKey];
  }
  if (!changed) return { changed, current, next: current };
  for (const [premiumKey, basisKey] of FLAT_PREMIUMS) if (!num(input[basisKey]) && given(doc[premiumKey])) input[premiumKey] = doc[premiumKey];
  // Mid-term the CTPL premium stays as issued; Auto Passenger PA is re-priced only when its limit or seats change.
  input.insuranceVehicleDetails = doc.insuranceVehicleDetails;
  const appaChanged = ['AutopassengerpersonalAccident', 'APPATotalCoverage', 'appaSeats'].some((k) => given(cc[k]) && num(cc[k]) !== num(doc[COVER_INPUTS[k] || k]));
  if (given(cc.appaSeats)) input.appaSeats = cc.appaSeats;
  const keep = { ctplCoveragePremium: num(doc.ctplCoveragePremium ?? doc.ctplCoverageRate), ctplCoverageRate: doc.ctplCoverageRate ?? '',
    ...(appaChanged ? {} : { APPAcoveragePremium: num(doc.APPAcoveragePremium), APPAtotalCoverage: num(doc.APPAtotalCoverage) }) };
  const next = await premiumBreakdown(input, { keep });
  return { changed, current, next: { ...next, grossPremium: round2(next.grossPremium), netPremium: round2(next.netPremium) } };
}

/** The coverage change as stored: the edited inputs with the server-priced figures. */
function pricedCoverage(cc, priced) {
  if (!priced.changed) return cc;
  const out = { ...cc };
  for (const [formKey, docKey] of Object.entries(COVER_FIGURES)) if (given(priced.next[docKey])) out[formKey] = round2(priced.next[docKey]).toFixed(2);
  return out;
}

/** Previous / new / change figures of a priced coverage change (the summary screen's Payment Details). */
function premiumChangeOf(priced) {
  const pick = (f) => ({ grossPremium: round2(f.grossPremium), netPremium: round2(f.netPremium), valueAddedTax: round2(num(f.valueAddedTax)),
    documentaryStampTax: round2(num(f.documentaryStampTax)), localGovernmentTax: round2(num(f.localGovernmentTax)) });
  const previous = pick(priced.current);
  const next = pick(priced.next);
  const delta = Object.fromEntries(Object.keys(next).map((k) => [k, round2(next[k] - previous[k])]));
  return { changed: priced.changed, previous, next, delta, taxRates: priced.next.taxRates || null };
}

export async function createEndorsement(body, userId) {
  const policy = await getPolicyRow(body.policyId);
  if (['cancelled', 'expired'].includes(policy.status)) throw badRequest(`Policy ${policy.policy_number} is ${policy.status} and cannot be endorsed`);
  const ids = Array.isArray(body.endorsementTypeIds) ? body.endorsementTypeIds : (body.endorsementTypeIds ? [body.endorsementTypeIds] : []);
  const isCancel = body.isCancelPolicy === true;
  const { cancellationType, premiumDelta, effectiveDate, remarks } = body;
  const changes = Object.fromEntries(Object.entries(body).filter(([k]) => !CONTROL_FIELDS.includes(k)));
  const clientDelta = given(premiumDelta) ? num(premiumDelta) : null;
  let delta = clientDelta ?? 0;
  const priced = isCancel ? null : await priceCoverageChange(changes.coverageChanges, policy);
  if (priced) {
    // the server price wins; a client figure that disagrees means the screen priced something else
    const serverDelta = round2(priced.next.grossPremium - priced.current.grossPremium);
    if (clientDelta !== null && Math.abs(clientDelta - serverDelta) > TOLERANCE) {
      throw badRequest(`premiumDelta ${clientDelta.toFixed(2)} does not match the recalculated premium change ${serverDelta.toFixed(2)} `
        + `(new gross ${priced.next.grossPremium.toFixed(2)} - current gross ${priced.current.grossPremium.toFixed(2)})`);
    }
    delta = serverDelta;
    changes.coverageChanges = pricedCoverage(changes.coverageChanges, priced);
    changes.premiumChange = premiumChangeOf(priced);
  } else if (clientDelta === null && !isCancel) {
    const newGross = num(changes.coverageChanges?.Grosspremium ?? changes.coverageChanges?.grossPremium);
    if (newGross) delta = round2(newGross - Number(policy.premium_total));
  }
  const type = await typeOf(ids, isCancel);
  // number and row in one transaction: a failed insert does not use up a number
  const r = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('endorsement', { db, unique: { table: 'endorsements', column: 'endorsement_number' } });
    return (await db.query(`INSERT INTO endorsements(endorsement_number, policy_id, client_id, endorsement_type, status, changes, premium_delta, effective_date, remarks,
        endorsement_type_ids, is_cancel, cancellation_type, created_by) VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [number, policy.id, policy.client_id, type, JSON.stringify(changes), round2(delta), isoDate(effectiveDate) || isoDate(new Date()), remarks || null,
      JSON.stringify(ids), isCancel, cancellationType || (isCancel ? 'FULL' : null), userId])).rows[0];
  });
  return getEndorsementRow(r.id);
}

export async function listEndorsements(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.clientId) add('e.client_id = ?', q.clientId);
  if (q.policyId) add('(e.policy_id = ? OR p.policy_number = ?)', q.policyId);
  if (q.status) add('e.status = ?', endorsementStatusIn(q.status) || q.status);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'endorsement', 'e', params));
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
      premiumDelta: Number(e.premium_delta).toFixed(2), currency: await getSetting('currency.default', 'PHP'), companyName: await companyName(),
      action: cancel ? 'cancellation' : 'endorsement' };
    await queueEmail({ to: client.email, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'endorsement_customer', entity: 'endorsement', entityId: e.id });
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
  if (ch.coverageChanges) {
    doc.endorsedCoverage = ch.coverageChanges;
    // a priced coverage change becomes the policy's cover and premium figures
    if (ch.premiumChange?.changed && !e.is_cancel) {
      for (const [formKey, docKey] of Object.entries({ ...COVER_INPUTS, ...COVER_FIGURES })) if (given(ch.coverageChanges[formKey])) doc[docKey] = ch.coverageChanges[formKey];
      doc.grossPremium = cols.premium_total.toFixed(2);
      doc.netPremium = round2(Number(p.net_premium) + num(ch.premiumChange.delta?.netPremium)).toFixed(2);
      cols.net_premium = Number(doc.netPremium);
      if (num(ch.coverageChanges.TotalSumInsured)) cols.sum_insured = round2(num(ch.coverageChanges.TotalSumInsured));
    }
  }
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
    productionDate: isoDate(body.productionDate), inceptionDate: isoDate(body.inceptionDate), issuedDate: isoDate(body.issuedDate), expiryDate: isoDate(body.expiryDate), notes: body.notes || '',
  };
  const policy = await withTransaction(async (db) => {
    const e = (await db.query('SELECT * FROM endorsements WHERE id = $1 FOR UPDATE', [e0.id])).rows[0];
    const p = await applyToPolicy(db, e, completion, userId);
    let receivableId = null;
    const delta = Number(e.premium_delta);
    // Billing mode of the premium change: the one chosen on completion (billingMode), else the endorsement's, else the policy's.
    const { bookDirectBill, normaliseBillingMode } = await import('../remittance/directbill.js');
    const billingMode = normaliseBillingMode(body.billingMode) || e.billing_mode || p.billing_mode || 'broker';
    const dp = e.changes?.premiumChange?.delta;
    const breakdown = dp && num(dp.netPremium) ? { netPremium: Math.abs(num(dp.netPremium)), vat: dp.valueAddedTax, dst: dp.documentaryStampTax, lgt: dp.localGovernmentTax } : {};
    if (billingMode === 'direct' && delta !== 0) {
      // direct bill: the client pays the insurer; the commission on the premium change is due from (or returned to) the insurer
      await bookDirectBill(db, { policy: p, amount: delta, breakdown, source: 'endorsement', reference: e.endorsement_number, endorsementId: e.id, user: { id: userId } });
    } else if (delta > 0) {
      // additional premium is billed like any premium: receivable, booking journal and collection item (finance routine)
      if (p.billing_mode === 'direct') {
        const { createReceivable: financeReceivable, findPolicy } = await import('../receipts/receivables.js');
        receivableId = (await financeReceivable(db, { policy: { ...(await findPolicy(db, p.id)), billing_mode: 'broker' }, amount: delta, source: 'endorsement', reference: e.endorsement_number, breakdown, user: { id: userId } })).id;
      } else {
        receivableId = (await createReceivable(db, { policyId: p.id, amount: delta, source: 'endorsement', reference: e.endorsement_number, breakdown, user: { id: userId } })).id;
      }
    }
    // A return premium (negative delta) or a cancellation on a broker-billed policy is credited to the open bills; what the
    // client already paid becomes a refund payable (posting rules endorsement.return_premium / policy.cancel).
    let credit = null;
    if (billingMode !== 'direct' && (delta < 0 || e.is_cancel)) {
      const { returnPremium, findPolicy } = await import('../receipts/receivables.js');
      const fp = await findPolicy(db, p.id);
      if (fp && fp.billing_mode !== 'direct') {
        credit = await returnPremium(db, { policy: fp, amount: delta < 0 ? -delta : 0, breakdown, kind: e.is_cancel ? 'cancellation' : 'return-premium',
          reference: e.endorsement_number, endorsementId: e.id, user: { id: userId } });
      }
    }
    if (credit) completion.returnPremium = credit;
    // The referrers' comsub follows the returned premium (broker or direct billed): unpaid lines are reduced or their
    // accrual reversed, paid lines clawed back, in proportion to the return (commission/service.js adjustForReturnPremium)
    const returnedGross = credit?.amount || (billingMode === 'direct' && delta < 0 ? -delta : 0);
    if (returnedGross > 0) {
      const { adjustForReturnPremium } = await import('../commission/service.js');
      const comsub = await adjustForReturnPremium(db, { policyId: p.id, returnedGross, baseGross: Number(p.premium_total), endorsementId: e.id, reference: e.endorsement_number, user: { id: userId } });
      if (comsub.adjustments.length || comsub.skipped.length) completion.comsubAdjustments = comsub;
    }
    await db.query(`UPDATE endorsements SET status = $2, completion = $3, document_key = COALESCE($4, document_key), completed_at = now(), completed_by = $5,
      receivable_id = $6, billing_mode = $7, updated_by = $5, updated_at = now() WHERE id = $1`, [e.id, e.is_cancel ? 'cancelled' : 'completed', JSON.stringify(completion), body.documentKey || null, userId, receivableId, billingMode]);
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
