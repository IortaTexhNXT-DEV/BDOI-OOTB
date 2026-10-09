/**
 * Cover notes (binders): temporary evidence of cover while the insurer's policy is pending.
 *
 * Issued from a quotation the customer accepted (cover_note.quote_statuses) or from a placement slip with the insurer
 * and not yet booked (cover_note.placement_statuses), for cover_note.validity_days from the cover start date (at most
 * cover_note.max_validity_days). One active cover note per quotation or placement slip.
 *
 * Status: active -> superseded when the policy of the quotation / placement is issued (the policy is linked), expired
 * after its end date, or cancelled by a user. syncStatuses() applies the policy link and the expiry; it runs before
 * every read and in the daily cover-note-expiry job, which also reminds the owner cover_note.reminder_days_before the
 * end date.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { notify } from '../notifications/service.js';

const SELECT = `SELECT cn.*, c.display_name AS client_name, c.client_code, c.email AS client_email, ic.name AS insurer_name, pr.name AS product_name,
  q.quote_number, pl.placement_number, p.policy_number, (SELECT u.display_name FROM users u WHERE u.id = cn.created_by) AS created_by_name
  FROM cover_notes cn LEFT JOIN clients c ON c.id = cn.client_id LEFT JOIN insurance_companies ic ON ic.id = cn.insurance_company_id
  LEFT JOIN products pr ON pr.id = cn.product_id LEFT JOIN quotes q ON q.id = cn.quote_id LEFT JOIN placements pl ON pl.id = cn.placement_id
  LEFT JOIN policies p ON p.id = cn.policy_id`;

export const coverNoteOut = (r, asOf = null) => r && ({
  id: r.id, coverNoteNumber: r.cover_note_number, source: r.source, quoteId: r.quote_id, quoteNumber: r.quote_number || null,
  placementId: r.placement_id, placementNumber: r.placement_number || null, clientId: r.client_id, clientCode: r.client_code || null, clientName: r.client_name || null,
  insurerId: r.insurance_company_id, insurerName: r.insurer_name || null, productId: r.product_id, productName: r.product_name || null, lob: r.lob,
  insuredName: r.insured_name, riskDescription: r.risk_description, sumInsured: Number(r.sum_insured), premiumTotal: Number(r.premium_total), currency: r.currency,
  coverFrom: isoDate(r.cover_from), coverTo: isoDate(r.cover_to), validityDays: r.validity_days, conditions: r.conditions, insurerReference: r.insurer_reference,
  status: r.status, policyId: r.policy_id, policyNumber: r.policy_number || null, supersededAt: r.superseded_at, expiredAt: r.expired_at,
  daysLeft: asOf && r.status === 'active' ? Math.round((Date.parse(isoDate(r.cover_to)) - Date.parse(asOf)) / 86400000) : null,
  cancelledAt: r.cancelled_at, cancelReason: r.cancel_reason, createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

/** Link cover notes to the policy issued from their quotation / placement (active ones become superseded) and expire the rest. */
export async function syncStatuses(db) {
  const now = await today();
  const superseded = await db.query(`UPDATE cover_notes cn SET policy_id = p.id, status = CASE WHEN cn.status = 'active' THEN 'superseded' ELSE cn.status END,
      superseded_at = CASE WHEN cn.status = 'active' THEN now() ELSE cn.superseded_at END, updated_at = now()
    FROM policies p WHERE cn.policy_id IS NULL AND cn.status IN ('active', 'expired') AND p.status <> 'cancelled'
      AND ((cn.quote_id IS NOT NULL AND p.quote_id = cn.quote_id) OR (cn.placement_id IS NOT NULL AND p.placement_id = cn.placement_id))
    RETURNING cn.id`);
  const expired = await db.query(`UPDATE cover_notes SET status = 'expired', expired_at = now(), updated_at = now()
    WHERE status = 'active' AND cover_to < $1::date RETURNING id`, [now]);
  return { superseded: superseded.rowCount, expired: expired.rowCount };
}

export async function getCoverNote(db, ref, { sync = true } = {}) {
  if (sync) await syncStatuses(db);
  const r = (await db.query(`${SELECT} WHERE cn.id = $1 OR cn.cover_note_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Cover note not found');
  return coverNoteOut(r, await today());
}

/** Cover notes: status (active | superseded | expired | cancelled | all), search, clientId, expiringWithin (days). */
export async function listCoverNotes(db, q = {}) {
  await syncStatuses(db);
  const asOf = await today();
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status && q.status !== 'all') add('cn.status = ?', q.status);
  if (q.clientId) add('(cn.client_id = ? OR c.client_code = ?)', q.clientId);
  if (q.quoteId) add('cn.quote_id = ?', q.quoteId);
  if (q.placementId) add('cn.placement_id = ?', q.placementId);
  if (q.expiringWithin !== undefined && q.expiringWithin !== '') {
    params.push(asOf, Number(q.expiringWithin) || 0);
    where.push(`cn.status = 'active' AND cn.cover_to <= ($${params.length - 1}::date + $${params.length}::int)`);
  }
  if (q.search) add(`(cn.cover_note_number ILIKE '%' || ? || '%' OR cn.insured_name ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%'
    OR q.quote_number ILIKE '%' || ? || '%' OR pl.placement_number ILIKE '%' || ? || '%' OR p.policy_number ILIKE '%' || ? || '%')`, q.search);
  const rows = (await db.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY cn.created_at DESC LIMIT 1000`, params)).rows;
  const all = rows.map((r) => coverNoteOut(r, asOf));
  return { asOf, summary: { active: all.filter((x) => x.status === 'active').length, expiringSoon: all.filter((x) => x.status === 'active' && x.daysLeft !== null && x.daysLeft <= 7).length }, rows: all };
}

const vehicleText = (v = {}) => [v.brand || v.make, v.model, v.variant, v.year || v.yearModel, v.plateNo || v.plateNumber ? `plate ${v.plateNo || v.plateNumber}` : null,
  v.chassisNo || v.chassisNumber ? `chassis ${v.chassisNo || v.chassisNumber}` : null].filter(Boolean).join(' ');
const riskOf = (doc = {}, vehicle = {}) => vehicleText(vehicle) || vehicleText(doc.insuranceVehicleDetails || doc.vehicle || {})
  || [doc.riskLocation, doc.propertyAddress, doc.locationOfRisk, doc.description].find((x) => typeof x === 'string' && x.trim()) || null;

/** Quotation or placement slip a cover note may be issued from, as the fields of the cover note. */
async function sourceOf(db, { quoteId, placementId }) {
  if (placementId) {
    const p = (await db.query(`SELECT pl.*, c.display_name AS client_name, l.first_name AS lead_first, l.last_name AS lead_last
      FROM placements pl LEFT JOIN clients c ON c.id = pl.client_id LEFT JOIN leads l ON l.id = pl.lead_id WHERE pl.id = $1 OR pl.placement_number = $1`, [String(placementId)])).rows[0];
    if (!p) throw notFound(`Placement slip ${placementId} not found`);
    const allowed = (await getSetting('cover_note.placement_statuses', ['sent', 'acknowledged', 'epolicy_received', 'checked'])) || [];
    if (!allowed.includes(p.status)) throw conflict(`A cover note is issued from a placement slip that is ${allowed.join(' or ')} (placement ${p.placement_number} is ${p.status})`);
    if (p.policy_id) throw conflict(`The policy of placement ${p.placement_number} is already issued; no cover note is needed`);
    return { source: 'placement', quote_id: p.quote_id || null, placement_id: p.id, ref: p.placement_number, client_id: p.client_id, insurance_company_id: p.insurance_company_id,
      product_id: p.product_id, lob: p.lob, insured_name: p.insured_name || p.client_name || [p.lead_first, p.lead_last].filter(Boolean).join(' ') || null,
      risk_description: riskOf(p.doc || {}), sum_insured: Number(p.sum_insured), premium_total: Number(p.premium_total), currency: p.currency, inception: isoDate(p.inception_date), owner: p.owner_user_id };
  }
  const q = (await db.query(`SELECT q.*, c.display_name AS client_name, l.first_name AS lead_first, l.last_name AS lead_last, pr.line AS product_line
    FROM quotes q LEFT JOIN clients c ON c.id = q.client_id LEFT JOIN leads l ON l.id = q.lead_id LEFT JOIN products pr ON pr.id = q.product_id
    WHERE q.id = $1 OR q.quote_number = $1`, [String(quoteId)])).rows[0];
  if (!q) throw notFound(`Quotation ${quoteId} not found`);
  const allowed = (await getSetting('cover_note.quote_statuses', ['accepted', 'approved', 'submitted'])) || [];
  if (!allowed.includes(q.status)) throw conflict(`A cover note is issued from a quotation the customer accepted (quotation ${q.quote_number} is ${q.status})`);
  const issued = (await db.query('SELECT policy_number FROM policies WHERE quote_id = $1 AND status <> \'cancelled\' LIMIT 1', [q.id])).rows[0];
  if (issued) throw conflict(`Policy ${issued.policy_number} is already issued from quotation ${q.quote_number}; no cover note is needed`);
  return { source: 'quote', quote_id: q.id, placement_id: null, ref: q.quote_number, client_id: q.client_id, insurance_company_id: q.insurance_company_id, product_id: q.product_id,
    lob: q.lob || q.product_line || null, insured_name: q.client_name || [q.lead_first, q.lead_last].filter(Boolean).join(' ') || null,
    risk_description: riskOf(q.doc || {}, q.vehicle || {}), sum_insured: Number(q.sum_insured), premium_total: Number(q.premium_total), currency: q.currency,
    inception: isoDate(q.doc?.inceptionDate || q.doc?.policyStartDate) || null, owner: q.agent_user_id || null };
}

/** Issue a cover note: { quoteId | placementId, coverFrom, validityDays, conditions, insurerReference, riskDescription }. */
export async function issueCoverNote(db, b, user) {
  if (!b.quoteId === !b.placementId) throw badRequest('Validation failed', [{ path: 'quoteId', message: 'Give either quoteId or placementId' }]);
  const s = await sourceOf(db, b);
  if (!s.insurance_company_id) throw conflict(`Quotation / placement ${s.ref} has no insurer; choose the insurer before issuing a cover note`);
  const open = (await db.query('SELECT cover_note_number FROM cover_notes WHERE status = \'active\' AND (quote_id = $1 OR placement_id = $2)', [s.quote_id, s.placement_id])).rows[0];
  if (open) throw conflict(`Cover note ${open.cover_note_number} is already active for ${s.ref}`);
  const days = Number(b.validityDays ?? (await getSetting('cover_note.validity_days', 30))) || 30;
  const max = Number(await getSetting('cover_note.max_validity_days', 90)) || 90;
  if (!Number.isInteger(days) || days < 1 || days > max) throw badRequest('Validation failed', [{ path: 'validityDays', message: `Cover period must be 1 to ${max} days (cover_note.max_validity_days)` }]);
  const from = isoDate(b.coverFrom) || s.inception || (await today());
  const to = addDays(from, days);
  const number = await nextDocumentNumber('cover_note', { db, unique: { table: 'cover_notes', column: 'cover_note_number' } });
  const r = (await db.query(`INSERT INTO cover_notes(cover_note_number, source, quote_id, placement_id, client_id, insurance_company_id, product_id, lob, insured_name, risk_description,
      sum_insured, premium_total, currency, cover_from, cover_to, validity_days, conditions, insurer_reference, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19) RETURNING id`,
  [number, s.source, s.quote_id, s.placement_id, s.client_id, s.insurance_company_id, s.product_id, s.lob, s.insured_name, b.riskDescription || s.risk_description,
    round2(s.sum_insured), round2(s.premium_total), s.currency || 'PHP', from, to, days, b.conditions || null, b.insurerReference || null, user?.id ?? null])).rows[0];
  return getCoverNote(db, r.id, { sync: false });
}

export async function cancelCoverNote(db, id, reason, user) {
  const before = await getCoverNote(db, id);
  if (before.status !== 'active') throw conflict(`Cover note ${before.coverNoteNumber} is ${before.status}; only an active cover note can be cancelled`);
  if (!reason || !String(reason).trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required' }]);
  await db.query(`UPDATE cover_notes SET status = 'cancelled', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3, updated_by = $2, updated_at = now() WHERE id = $1`,
    [before.id, user?.id ?? null, String(reason).trim()]);
  return { before, after: await getCoverNote(db, before.id, { sync: false }) };
}

/** Quotations and placement slips a cover note can be issued from (no active cover note, no policy yet). */
export async function eligibleSources(db, { search = '' } = {}) {
  const qs = (await getSetting('cover_note.quote_statuses', ['accepted', 'approved', 'submitted'])) || [];
  const ps = (await getSetting('cover_note.placement_statuses', ['sent', 'acknowledged', 'epolicy_received', 'checked'])) || [];
  const like = `%${search}%`;
  const quotes = (await db.query(`SELECT q.id, q.quote_number AS ref, q.status, c.display_name AS client_name, ic.name AS insurer_name, q.premium_total FROM quotes q
    LEFT JOIN clients c ON c.id = q.client_id LEFT JOIN insurance_companies ic ON ic.id = q.insurance_company_id
    WHERE q.status = ANY($1) AND NOT EXISTS (SELECT 1 FROM policies p WHERE p.quote_id = q.id AND p.status <> 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM cover_notes cn WHERE cn.quote_id = q.id AND cn.status = 'active')
      AND ($2 = '%%' OR q.quote_number ILIKE $2 OR c.display_name ILIKE $2) ORDER BY q.updated_at DESC LIMIT 100`, [qs, like])).rows;
  const placements = (await db.query(`SELECT pl.id, pl.placement_number AS ref, pl.status, COALESCE(pl.insured_name, c.display_name) AS client_name, ic.name AS insurer_name, pl.premium_total
    FROM placements pl LEFT JOIN clients c ON c.id = pl.client_id LEFT JOIN insurance_companies ic ON ic.id = pl.insurance_company_id
    WHERE pl.status = ANY($1) AND pl.policy_id IS NULL AND NOT EXISTS (SELECT 1 FROM cover_notes cn WHERE cn.placement_id = pl.id AND cn.status = 'active')
      AND ($2 = '%%' OR pl.placement_number ILIKE $2 OR pl.insured_name ILIKE $2 OR c.display_name ILIKE $2) ORDER BY pl.updated_at DESC LIMIT 100`, [ps, like])).rows;
  const out = (kind) => (r) => ({ kind, id: r.id, reference: r.ref, status: r.status, clientName: r.client_name, insurerName: r.insurer_name, premiumTotal: Number(r.premium_total) });
  return [...quotes.map(out('quote')), ...placements.map(out('placement'))];
}

/** Daily job: link issued policies, expire, and remind owners of cover notes ending within cover_note.reminder_days_before. */
export async function expiryJob(db) {
  const sync = await syncStatuses(db);
  const days = Number(await getSetting('cover_note.reminder_days_before', 7)) || 0;
  let reminders = 0;
  if (days > 0) {
    const due = (await db.query(`SELECT cn.*, COALESCE(pl.owner_user_id, q.agent_user_id, cn.created_by) AS owner FROM cover_notes cn
      LEFT JOIN placements pl ON pl.id = cn.placement_id LEFT JOIN quotes q ON q.id = cn.quote_id
      WHERE cn.status = 'active' AND cn.reminder_sent_at IS NULL AND cn.cover_to <= ($1::date + $2::int)`, [await today(), days])).rows;
    for (const c of due) {
      await notify({ userId: c.owner || null, type: 'reminder', priority: 'high', title: `Cover note ${c.cover_note_number} expires on ${isoDate(c.cover_to)}`,
        message: `Cover note ${c.cover_note_number} for ${c.insured_name || 'the insured'} ends on ${isoDate(c.cover_to)} and the policy is not issued yet. Follow up the insurer or extend the cover.`,
        link: `/operations/cover-notes?open=${c.id}`, entity: 'cover_note', entityId: c.id, audience: c.owner ? null : 'write:policies' });
      await db.query('UPDATE cover_notes SET reminder_sent_at = now() WHERE id = $1', [c.id]);
      reminders += 1;
    }
  }
  return { ...sync, reminders };
}
