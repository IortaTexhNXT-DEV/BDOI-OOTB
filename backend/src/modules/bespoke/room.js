/**
 * Underwriter room of a bespoke Request for Quotation or placement: the insurers invited, the statement of values
 * (SOV) and loss runs shared with them, the bids per round (requested, quoted, countered, accepted, declined,
 * withdrawn), broker counter-offers, the message thread, one timeline of everything that happened, the signed link an
 * underwriter uses without signing in, and the award that turns the accepted bids into the quotation or placement slip.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { queueEmail } from '../../lib/mailer.js';
import { companyName } from '../../lib/letterhead.js';
import { num, round2 } from '../../lib/money.js';
import { formatAmount } from '../../lib/pdf/format.js';
import { renderTemplate, emailTemplate } from '../documents/common.js';
import { readSheet, camel } from '../accounting/lib/sheet.js';
import { saveFile } from '../masters/helpers.js';
import { signedUrl } from '../uploads/storage.js';
import { latestComposedFor, composedById } from './composer.js';

export const BID_STATUSES = ['requested', 'quoted', 'countered', 'accepted', 'declined', 'withdrawn'];
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const n = (v) => (v === null || v === undefined ? null : Number(v));

const ROOM_SELECT = `SELECT r.*, b.slip_number, b.insured_name AS bs_insured, b.sum_insured AS bs_sum_insured, b.lob AS bs_lob, b.status AS bs_status,
  p.placement_number, p.insured_name AS pl_insured, p.sum_insured AS pl_sum_insured, p.lob AS pl_lob, c.slip_number AS composed_number,
  q.quote_number, ap.placement_number AS award_placement_number,
  (SELECT count(*)::int FROM uw_room_insurers x WHERE x.room_id = r.id AND x.status = 'invited') AS insurer_count,
  (SELECT count(DISTINCT x.insurance_company_id)::int FROM uw_bids x WHERE x.room_id = r.id AND x.status IN ('quoted', 'accepted')) AS quoted_count
  FROM uw_rooms r LEFT JOIN broker_slips b ON b.id = r.broker_slip_id LEFT JOIN placements p ON p.id = r.placement_id
  LEFT JOIN composed_slips c ON c.id = r.composed_slip_id LEFT JOIN quotes q ON q.id = r.quote_id LEFT JOIN placements ap ON ap.id = r.award_placement_id`;

export async function getRoomRow(ref, db = null) {
  const r = (await (db || { query }).query(`${ROOM_SELECT} WHERE r.id = $1 OR r.room_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Underwriter room not found');
  return r;
}

const roomHeader = (r) => ({
  id: r.id, roomNumber: r.room_number, title: r.title, status: r.status, currentRound: r.current_round, currency: r.currency, responseDueDate: r.response_due_date,
  brokerSlipId: r.broker_slip_id, brokerSlipNumber: r.slip_number, placementId: r.placement_id, placementNumber: r.placement_number,
  composedSlipId: r.composed_slip_id, composedSlipNumber: r.composed_number, insuredName: r.pl_insured || r.bs_insured || null,
  sumInsured: Number(r.pl_sum_insured ?? r.bs_sum_insured ?? 0), lob: r.pl_lob || r.bs_lob || null, insurerCount: r.insurer_count ?? null, quotedCount: r.quoted_count ?? null,
  quoteId: r.quote_id, quotationNumber: r.quote_number || null, awardPlacementId: r.award_placement_id, awardPlacementNumber: r.award_placement_number || null,
  closeReason: r.close_reason, createdAt: r.created_at, updatedAt: r.updated_at,
});

/** One line of the room timeline. */
export async function logEvent(db, roomId, { actorType = 'broker', actor = null, event, insurerId = null, detail = {} }) {
  await (db || { query }).query('INSERT INTO uw_events(room_id, actor_type, actor, event, insurance_company_id, detail) VALUES ($1,$2,$3,$4,$5,$6)',
    [roomId, actorType, actor, event, insurerId, JSON.stringify(detail || {})]);
}
const who = (user) => user?.username || user?.displayName || user?.id || null;

export function bidOut(b) {
  return {
    id: b.id, bidNumber: b.bid_number, roomId: b.room_id, insuranceCompanyId: b.insurance_company_id, insuranceCompanyName: b.insurer_name || null, round: b.round, status: b.status,
    premium: n(b.premium), rate: n(b.rate), capacityPercent: n(b.capacity_percent), capacityAmount: n(b.capacity_amount), deductibles: b.deductibles, deviations: b.deviations || [],
    validityDate: b.validity_date, remarks: b.remarks, counterPremium: n(b.counter_premium), counterRate: n(b.counter_rate), counterCapacityPercent: n(b.counter_capacity_percent),
    counterTerms: b.counter_terms, parentBidId: b.parent_bid_id, acceptedShare: n(b.accepted_share), declineReason: b.decline_reason, submittedVia: b.submitted_via,
    requestedAt: b.requested_at, respondedAt: b.responded_at, createdAt: b.created_at, updatedAt: b.updated_at,
  };
}

async function bidsOf(roomId, insurerId = null) {
  const rows = await many(`SELECT x.*, ic.name AS insurer_name FROM uw_bids x JOIN insurance_companies ic ON ic.id = x.insurance_company_id
    WHERE x.room_id = $1 AND ($2::int IS NULL OR x.insurance_company_id = $2) ORDER BY ic.name, x.round, x.created_at`, [roomId, insurerId]);
  return rows.map(bidOut);
}

/**
 * Comparison of the latest bid of every insurer: quoted and accepted bids ranked by premium, the difference from the
 * best, capacity offered and the share accepted so far (the award needs exactly 100%).
 */
export function compareBids(bids, sumInsured = 0) {
  const latest = new Map();
  for (const b of bids) {
    const cur = latest.get(b.insuranceCompanyId);
    if (!cur || b.round > cur.round || (b.round === cur.round && new Date(b.createdAt) >= new Date(cur.createdAt))) latest.set(b.insuranceCompanyId, b);
  }
  const rows = [...latest.values()];
  const live = rows.filter((b) => ['quoted', 'accepted'].includes(b.status) && b.premium !== null);
  const best = live.reduce((m, b) => (m === null || b.premium < m ? b.premium : m), null);
  const ranked = [...live].sort((a, b) => a.premium - b.premium);
  return {
    rows: rows.map((b) => ({ ...b, rank: ranked.includes(b) ? ranked.indexOf(b) + 1 : null, isBest: best !== null && b.premium === best && live.includes(b),
      differenceFromBest: live.includes(b) && best !== null ? round2(b.premium - best) : null,
      rateOnSumInsured: b.premium !== null && sumInsured ? Math.round((b.premium / sumInsured) * 100 * 1e6) / 1e6 : null }))
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    summary: { insurers: rows.length, quoted: live.length, declined: rows.filter((b) => b.status === 'declined').length, pending: rows.filter((b) => ['requested', 'countered'].includes(b.status)).length,
      bestPremium: best, capacityOffered: round2(live.reduce((s, b) => s + (b.capacityPercent ?? 0), 0)),
      acceptedShare: round2(rows.filter((b) => b.status === 'accepted').reduce((s, b) => s + (b.acceptedShare ?? b.capacityPercent ?? 0), 0)) },
  };
}

async function sovOf(roomId, { all = false } = {}) {
  const versions = await many(`SELECT s.*, (SELECT display_name FROM users u WHERE u.id = s.uploaded_by) AS uploaded_by_name FROM uw_sov s
    WHERE s.room_id = $1 ORDER BY s.version DESC`, [roomId]);
  const current = versions.find((v) => v.is_current) || null;
  const locations = current ? await many('SELECT * FROM uw_sov_locations WHERE sov_id = $1 ORDER BY line_no', [current.id]) : [];
  const head = (v) => ({ id: Number(v.id), version: v.version, isCurrent: v.is_current, fileName: v.file_name, fileUrl: v.file_key ? signedUrl(v.file_key) : null, locationCount: v.location_count,
    totals: v.totals, warnings: v.warnings || [], uploadedBy: v.uploaded_by_name || v.uploaded_by, uploadedAt: v.uploaded_at });
  return {
    current: current ? { ...head(current), locations: locations.map((l) => ({ lineNo: l.line_no, locationName: l.location_name, address: l.address, city: l.city, province: l.province,
      occupancy: l.occupancy, construction: l.construction, yearBuilt: l.year_built, building: Number(l.building), contents: Number(l.contents), stocks: Number(l.stocks),
      machinery: Number(l.machinery), businessInterruption: Number(l.business_interruption), other: Number(l.other), totalValue: Number(l.total_value), extra: l.extra })) } : null,
    ...(all ? { versions: versions.map(head) } : {}),
  };
}

const attachmentOut = (a) => ({ id: Number(a.id), kind: a.kind, fileName: a.file_name, fileUrl: signedUrl(a.file_key), description: a.description, shared: a.shared,
  insuranceCompanyId: a.insurance_company_id, uploadedBy: a.uploaded_by_name || a.uploaded_by, uploadedAt: a.uploaded_at });
const messageOut = (m) => ({ id: Number(m.id), insuranceCompanyId: m.insurance_company_id, insuranceCompanyName: m.insurer_name || null, authorType: m.author_type,
  author: m.author_name, body: m.body, attachmentIds: (m.attachment_ids || []).map(Number), internal: m.internal, createdAt: m.created_at });

export async function roomById(ref) {
  const r = await getRoomRow(ref);
  const header = roomHeader(r);
  const insurers = await many(`SELECT x.*, ic.name, ic.code, ic.contact_email AS ic_email FROM uw_room_insurers x JOIN insurance_companies ic ON ic.id = x.insurance_company_id
    WHERE x.room_id = $1 ORDER BY ic.name`, [r.id]);
  const bids = await bidsOf(r.id);
  const comparison = compareBids(bids, header.sumInsured);
  const attachments = await many(`SELECT a.*, (SELECT display_name FROM users u WHERE u.id = a.uploaded_by) AS uploaded_by_name FROM uw_attachments a WHERE a.room_id = $1 ORDER BY a.uploaded_at`, [r.id]);
  const messages = await many(`SELECT m.*, ic.name AS insurer_name FROM uw_messages m LEFT JOIN insurance_companies ic ON ic.id = m.insurance_company_id WHERE m.room_id = $1 ORDER BY m.created_at, m.id`, [r.id]);
  const events = await many(`SELECT e.*, ic.name AS insurer_name FROM uw_events e LEFT JOIN insurance_companies ic ON ic.id = e.insurance_company_id WHERE e.room_id = $1 ORDER BY e.at DESC, e.id DESC`, [r.id]);
  return {
    ...header,
    insurers: insurers.map((i) => {
      const latest = comparison.rows.find((b) => b.insuranceCompanyId === i.insurance_company_id);
      return { insuranceCompanyId: i.insurance_company_id, name: i.name, code: i.code, status: i.status, contactEmail: i.contact_email || i.ic_email, invitedAt: i.invited_at,
        lastViewedAt: i.last_viewed_at, linkExpiresAt: i.token_expires_at, latestBidStatus: latest?.status || null };
    }),
    sov: await sovOf(r.id, { all: true }), attachments: attachments.map(attachmentOut), bids, comparison, messages: messages.map(messageOut),
    timeline: events.map((e) => ({ id: Number(e.id), at: e.at, actorType: e.actor_type, actor: e.actor, event: e.event, insuranceCompanyId: e.insurance_company_id, insurer: e.insurer_name || null, detail: e.detail })),
  };
}

export async function listRooms(q = {}) {
  const params = [];
  const where = ['TRUE'];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('r.status = ANY(?::text[])', String(q.status).split(','));
  if (q.brokerSlipId) add('(r.broker_slip_id = ? OR b.slip_number = ?)', q.brokerSlipId);
  if (q.placementId) add('(r.placement_id = ? OR p.placement_number = ?)', q.placementId);
  if (q.insurerId) add('EXISTS (SELECT 1 FROM uw_room_insurers x WHERE x.room_id = r.id AND x.insurance_company_id = ?::int)', Number(q.insurerId));
  if (q.search) add("(r.room_number ILIKE '%' || ? || '%' OR r.title ILIKE '%' || ? || '%' OR b.insured_name ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%')", q.search);
  return (await many(`${ROOM_SELECT} WHERE ${where.join(' AND ')} ORDER BY r.updated_at DESC LIMIT 200`, params)).map(roomHeader);
}

async function resolveInsurerIds(list) {
  const ids = [];
  for (const ref of list || []) {
    const r = await one("SELECT id FROM insurance_companies WHERE (id::text = $1 OR upper(code) = upper($1) OR lower(name) = lower($1)) AND status = 'active'", [String(ref)]);
    if (!r) throw badRequest(`Insurer ${ref} is not an active insurer in the insurer master`);
    if (!ids.includes(r.id)) ids.push(r.id);
  }
  return ids;
}

async function assertOpen(r) {
  if (r.status !== 'open') throw conflict(`The room is ${r.status}`);
}

/** Invite insurers (the insurer master); an insurer invited earlier and removed is invited again. */
export async function inviteInsurers(ref, insurerRefs, user, db = null) {
  const r = await getRoomRow(ref, db);
  await assertOpen(r);
  const ids = await resolveInsurerIds(insurerRefs);
  if (!ids.length) throw badRequest('Choose at least one insurer');
  const c = db || { query };
  const added = [];
  for (const id of ids) {
    const x = await c.query(`INSERT INTO uw_room_insurers(room_id, insurance_company_id, contact_email, invited_by)
      SELECT $1, ic.id, ic.contact_email, $3 FROM insurance_companies ic WHERE ic.id = $2
      ON CONFLICT (room_id, insurance_company_id) DO UPDATE SET status = 'invited' WHERE uw_room_insurers.status = 'removed' RETURNING id`, [r.id, id, user.id]);
    if (x.rowCount) { added.push(id); await logEvent(c, r.id, { actor: who(user), event: 'insurer-invited', insurerId: id }); }
  }
  await c.query('UPDATE uw_rooms SET updated_at = now(), updated_by = $2 WHERE id = $1', [r.id, user.id]);
  return added;
}

export async function removeInsurer(ref, insurerId, user) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  const x = await query("UPDATE uw_room_insurers SET status = 'removed', token_hash = NULL WHERE room_id = $1 AND insurance_company_id = $2 AND status = 'invited'", [r.id, Number(insurerId)]);
  if (!x.rowCount) throw notFound('The insurer is not invited to this room');
  await logEvent(null, r.id, { actor: who(user), event: 'insurer-removed', insurerId: Number(insurerId) });
}

/** New room for a broker slip (its insurers are invited by default) or a placement. */
export async function createRoom(b, user) {
  if (!b.brokerSlipId && !b.placementId) throw badRequest('A room belongs to a Request for Quotation (brokerSlipId) or a placement slip (placementId)');
  const slip = b.brokerSlipId ? await one('SELECT id, slip_number, insured_name, currency, response_due_date FROM broker_slips WHERE id = $1 OR slip_number = $1', [String(b.brokerSlipId)]) : null;
  if (b.brokerSlipId && !slip) throw badRequest(`Broker slip ${b.brokerSlipId} not found`);
  const plc = b.placementId ? await one('SELECT id, placement_number, insured_name, currency FROM placements WHERE id = $1 OR placement_number = $1', [String(b.placementId)]) : null;
  if (b.placementId && !plc) throw badRequest(`Placement slip ${b.placementId} not found`);
  let composedId = null;
  if (b.composedSlipId) composedId = (await composedById(b.composedSlipId)).id;
  else composedId = (plc ? await latestComposedFor('placement', plc.id) : null)?.id || (slip ? await latestComposedFor('broker_slip', slip.id) : null)?.id || null;
  const insurers = b.insurerIds?.length ? b.insurerIds
    : slip ? (await many('SELECT insurance_company_id FROM insurer_offers WHERE broker_slip_id = $1', [slip.id])).map((o) => o.insurance_company_id) : [];
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('uw_room', { db, unique: { table: 'uw_rooms', column: 'room_number' } });
    const title = b.title || `${slip?.slip_number || plc?.placement_number} ${slip?.insured_name || plc?.insured_name || ''}`.trim();
    const r = await db.query(`INSERT INTO uw_rooms(room_number, title, broker_slip_id, placement_id, composed_slip_id, currency, response_due_date, owner_user_id, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$8) RETURNING id`,
    [number, title, slip?.id || null, plc?.id || null, composedId, slip?.currency || plc?.currency || await getSetting('currency.default', 'PHP'), isoDate(b.responseDueDate) || slip?.response_due_date || null, user.id]);
    await logEvent(db, r.rows[0].id, { actor: who(user), event: 'room-opened', detail: { roomNumber: number, brokerSlip: slip?.slip_number || null, placement: plc?.placement_number || null } });
    if (insurers.length) await inviteInsurers(r.rows[0].id, insurers, user, db);
    return r.rows[0].id;
  });
  return roomById(id);
}

// ---------------------------------------------------------------- statement of values

const FIELDS = ['locationName', 'address', 'city', 'province', 'occupancy', 'construction', 'yearBuilt', 'building', 'contents', 'stocks', 'machinery', 'businessInterruption', 'other', 'totalValue'];
const VALUE_FIELDS = ['building', 'contents', 'stocks', 'machinery', 'businessInterruption', 'other'];
const amountOf = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return 0;
  const text = String(v).replace(/[^0-9.-]/g, '');
  const x = text === '' ? NaN : Number(text);
  return Number.isFinite(x) ? round2(x) : NaN;
};

/**
 * Parse SOV rows ([{ heading: value }] with camel-cased headings) into locations with totals. Headings are matched
 * through bespoke.sov_columns; unknown columns are kept per location (extra). The total of a location is the given
 * total, else the sum of its values; a given total that differs from the sum is reported as a warning.
 */
export async function parseSov(rows) {
  const aliases = (await getSetting('bespoke.sov_columns', {})) || {};
  const keys = Object.keys(rows[0] || {});
  const map = {};
  for (const f of FIELDS) {
    const names = [f, ...(aliases[f] || [])].map((a) => camel(a));
    const k = keys.find((x) => names.includes(x));
    if (k) map[f] = k;
  }
  if (!VALUE_FIELDS.some((f) => map[f]) && !map.totalValue) throw badRequest(`The statement of values needs at least one value column (${[...VALUE_FIELDS, 'totalValue'].join(', ')}); found ${keys.join(', ') || 'no columns'}`);
  const used = new Set(Object.values(map));
  const locations = [];
  const warnings = [];
  rows.forEach((row, i) => {
    const get = (f) => (map[f] ? row[map[f]] : undefined);
    const values = Object.fromEntries(VALUE_FIELDS.map((f) => [f, amountOf(get(f))]));
    const given = amountOf(get('totalValue'));
    const bad = [...VALUE_FIELDS.filter((f) => Number.isNaN(values[f])), ...(Number.isNaN(given) ? ['totalValue'] : [])];
    if (bad.length) throw badRequest(`Row ${i + 2}: ${bad.join(', ')} must be a number`);
    const sum = round2(VALUE_FIELDS.reduce((s, f) => s + values[f], 0));
    const name = String(get('locationName') || get('address') || '').trim();
    if (!name && !sum && !given) return;
    const total = given || sum;
    if (given && sum && Math.abs(given - sum) > 1) warnings.push(`Row ${i + 2} (${name || 'location'}): total ${formatAmount(given)} differs from the sum of its values ${formatAmount(sum)}`);
    const year = Number(get('yearBuilt'));
    locations.push({ lineNo: locations.length + 1, locationName: name || `Location ${locations.length + 1}`, address: get('address') || null, city: get('city') || null,
      province: get('province') || null, occupancy: get('occupancy') || null, construction: get('construction') || null, yearBuilt: Number.isInteger(year) && year > 1800 ? year : null,
      ...values, totalValue: total, extra: Object.fromEntries(Object.entries(row).filter(([k, v]) => !used.has(k) && String(v).trim() !== '')) });
  });
  if (!locations.length) throw badRequest('The statement of values has no locations');
  const totals = Object.fromEntries([...VALUE_FIELDS, 'totalValue'].map((f) => [f, round2(locations.reduce((s, l) => s + l[f], 0))]));
  return { locations, totals, warnings };
}

/** Upload a new SOV version (XLSX or CSV); the earlier version stays in the history. */
export async function uploadSov(ref, file, user) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  if (!file?.buffer?.length) throw badRequest('Attach the statement of values (XLSX or CSV)');
  const parsed = await parseSov(readSheet(file.buffer, file.originalname || ''));
  const saved = await saveFile({ category: 'underwriter-rooms', fileName: file.originalname || 'sov.xlsx', content: file.buffer, contentType: file.mimetype || 'application/octet-stream', entity: 'uw_room', entityId: r.id, userId: user.id });
  const version = await withTransaction(async (db) => {
    const v = ((await db.query('SELECT COALESCE(max(version), 0) + 1 AS v FROM uw_sov WHERE room_id = $1', [r.id])).rows[0].v);
    await db.query('UPDATE uw_sov SET is_current = false WHERE room_id = $1', [r.id]);
    const s = await db.query(`INSERT INTO uw_sov(room_id, version, file_key, file_name, location_count, totals, warnings, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [r.id, v, saved.key, file.originalname || null, parsed.locations.length, JSON.stringify(parsed.totals), JSON.stringify(parsed.warnings), user.id]);
    for (const l of parsed.locations) {
      await db.query(`INSERT INTO uw_sov_locations(sov_id, line_no, location_name, address, city, province, occupancy, construction, year_built, building, contents, stocks, machinery,
          business_interruption, other, total_value, extra) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [s.rows[0].id, l.lineNo, l.locationName, l.address, l.city, l.province, l.occupancy, l.construction, l.yearBuilt, l.building, l.contents, l.stocks, l.machinery,
        l.businessInterruption, l.other, l.totalValue, JSON.stringify(l.extra)]);
    }
    await db.query('INSERT INTO uw_attachments(room_id, kind, file_key, file_name, description, shared, uploaded_by) VALUES ($1,\'sov\',$2,$3,$4,true,$5)',
      [r.id, saved.key, file.originalname || 'sov', `Statement of values version ${v}`, user.id]);
    await logEvent(db, r.id, { actor: who(user), event: 'sov-uploaded', detail: { version: v, locations: parsed.locations.length, total: parsed.totals.totalValue, warnings: parsed.warnings.length } });
    return v;
  });
  return { version, ...parsed, sov: (await sovOf(r.id)).current };
}

export async function addAttachment(ref, file, { kind = 'other', description = null, shared = true } = {}, actor = {}) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  if (!file?.buffer?.length) throw badRequest('Attach a file');
  const saved = await saveFile({ category: 'underwriter-rooms', fileName: file.originalname || 'attachment', content: file.buffer, contentType: file.mimetype || 'application/octet-stream',
    entity: 'uw_room', entityId: r.id, userId: actor.userId || null });
  const a = await one(`INSERT INTO uw_attachments(room_id, kind, file_key, file_name, description, shared, insurance_company_id, uploaded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [r.id, kind, saved.key, file.originalname || 'attachment', description, shared !== false && shared !== 'false', actor.insurerId || null, actor.userId || null]);
  await logEvent(null, r.id, { actorType: actor.insurerId && !actor.userId ? 'underwriter' : 'broker', actor: actor.name || null, event: 'attachment-added', insurerId: actor.insurerId || null,
    detail: { kind, fileName: a.file_name, shared: a.shared } });
  return attachmentOut(a);
}

// ---------------------------------------------------------------- bids

async function invitedInsurer(roomId, insurerId) {
  const x = await one("SELECT x.*, ic.name FROM uw_room_insurers x JOIN insurance_companies ic ON ic.id = x.insurance_company_id WHERE x.room_id = $1 AND x.insurance_company_id = $2 AND x.status = 'invited'",
    [roomId, Number(insurerId)]);
  if (!x) throw badRequest('The insurer is not invited to this room');
  return x;
}
const bidRow = async (roomId, bidId) => {
  const b = await one('SELECT * FROM uw_bids WHERE room_id = $1 AND (id = $2 OR bid_number = $2)', [roomId, String(bidId)]);
  if (!b) throw notFound('Bid not found in this room');
  return b;
};

/** Ask invited insurers (all or insurerIds) for terms: a new round when the current one already has answers. */
export async function requestBids(ref, { insurerIds = null, note = null, responseDueDate = null } = {}, user) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  const invited = (await many("SELECT insurance_company_id FROM uw_room_insurers WHERE room_id = $1 AND status = 'invited'", [r.id])).map((x) => x.insurance_company_id);
  const ids = insurerIds?.length ? (await resolveInsurerIds(insurerIds)).filter((id) => invited.includes(id)) : invited;
  if (!ids.length) throw badRequest('Invite at least one insurer before requesting bids');
  const answered = (await one("SELECT count(*)::int AS n FROM uw_bids WHERE room_id = $1 AND round = $2 AND status <> 'requested'", [r.id, r.current_round])).n;
  const round = answered ? r.current_round + 1 : r.current_round;
  const created = [];
  await withTransaction(async (db) => {
    await db.query('UPDATE uw_rooms SET current_round = $2, response_due_date = COALESCE($3, response_due_date), updated_by = $4, updated_at = now() WHERE id = $1', [r.id, round, isoDate(responseDueDate), user.id]);
    for (const ic of ids) {
      const open = (await db.query("SELECT 1 FROM uw_bids WHERE room_id = $1 AND insurance_company_id = $2 AND round = $3 AND status = 'requested'", [r.id, ic, round])).rows[0];
      if (open) continue;
      const number = await nextDocumentNumber('uw_bid', { db, unique: { table: 'uw_bids', column: 'bid_number' } });
      const x = await db.query("INSERT INTO uw_bids(bid_number, room_id, insurance_company_id, round, status, remarks, requested_at, created_by, updated_by) VALUES ($1,$2,$3,$4,'requested',$5,now(),$6,$6) RETURNING id",
        [number, r.id, ic, round, note, user.id]);
      created.push(x.rows[0].id);
      await logEvent(db, r.id, { actor: who(user), event: 'bid-requested', insurerId: ic, detail: { round, bidNumber: number, note } });
    }
  });
  return { round, created };
}

/**
 * Record an underwriter's answer (entered by the broker, or through the external link): quoted (premium required;
 * rate from the sum insured when not given, validity from bespoke.bid_validity_days) or declined. It answers the
 * insurer's open request of the latest round, else it is a new bid in the current round.
 */
export async function recordBid(ref, body, actor) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  const ri = await invitedInsurer(r.id, body.insuranceCompanyId);
  const status = body.status || 'quoted';
  if (!['quoted', 'declined'].includes(status)) throw badRequest('status must be quoted or declined');
  const cols = { status, remarks: body.remarks ?? null, responded_at: new Date(), submitted_via: actor.via || 'broker', updated_by: actor.userId || null, updated_at: new Date() };
  if (status === 'quoted') {
    const premium = round2(num(body.premium));
    if (!(premium > 0)) throw badRequest('premium (net premium for 100% of the risk) is required for a quote');
    const cap = body.capacityPercent === undefined || body.capacityPercent === null || body.capacityPercent === '' ? 100 : num(body.capacityPercent);
    if (!(cap > 0 && cap <= 100)) throw badRequest('capacityPercent must be more than 0 and at most 100');
    const si = Number(r.pl_sum_insured ?? r.bs_sum_insured ?? 0);
    Object.assign(cols, {
      premium, rate: body.rate !== undefined && body.rate !== null && body.rate !== '' ? num(body.rate) : (si ? Math.round((premium / si) * 100 * 1e6) / 1e6 : null),
      capacity_percent: cap, capacity_amount: si ? round2(si * cap / 100) : null, deductibles: body.deductibles || null,
      deviations: JSON.stringify(Array.isArray(body.deviations) ? body.deviations.filter((d) => d && (d.clause || d.offered || d.requested)) : []),
      validity_date: isoDate(body.validityDate) || addDays(await today(), Number(await getSetting('bespoke.bid_validity_days', 30))), decline_reason: null,
    });
  } else {
    cols.decline_reason = body.declineReason || body.remarks || null;
  }
  const open = await one("SELECT * FROM uw_bids WHERE room_id = $1 AND insurance_company_id = $2 AND status = 'requested' ORDER BY round DESC, created_at DESC LIMIT 1", [r.id, ri.insurance_company_id]);
  const id = await withTransaction(async (db) => {
    let bidId = open?.id;
    if (!bidId) {
      const number = await nextDocumentNumber('uw_bid', { db, unique: { table: 'uw_bids', column: 'bid_number' } });
      bidId = (await db.query('INSERT INTO uw_bids(bid_number, room_id, insurance_company_id, round, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [number, r.id, ri.insurance_company_id, r.current_round, actor.userId || null])).rows[0].id;
    }
    const keys = Object.keys(cols);
    await db.query(`UPDATE uw_bids SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [bidId, ...Object.values(cols)]);
    await logEvent(db, r.id, { actorType: actor.via === 'link' ? 'underwriter' : 'broker', actor: actor.name, event: status === 'quoted' ? 'bid-quoted' : 'bid-declined', insurerId: ri.insurance_company_id,
      detail: { round: open?.round ?? r.current_round, premium: cols.premium ?? null, capacityPercent: cols.capacity_percent ?? null, via: cols.submitted_via } });
    await db.query('UPDATE uw_rooms SET updated_at = now() WHERE id = $1', [r.id]);
    return bidId;
  });
  return bidOut({ ...(await one('SELECT x.*, ic.name AS insurer_name FROM uw_bids x JOIN insurance_companies ic ON ic.id = x.insurance_company_id WHERE x.id = $1', [id])) });
}

/** Broker counter-offer on a quote: the quote becomes countered and the insurer is asked again (next round) on the broker's terms. */
export async function counterBid(ref, bidId, body, user) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  const b = await bidRow(r.id, bidId);
  if (b.status !== 'quoted') throw conflict(`Only a quoted bid can be countered (current: ${b.status})`);
  if (!(num(body.premium) > 0) && !body.terms && !(num(body.capacityPercent) > 0)) throw badRequest('A counter-offer needs a premium, a line (capacityPercent) or terms');
  const round = Math.max(b.round + 1, r.current_round);
  const id = await withTransaction(async (db) => {
    await db.query("UPDATE uw_bids SET status = 'countered', updated_by = $2, updated_at = now() WHERE id = $1", [b.id, user.id]);
    const number = await nextDocumentNumber('uw_bid', { db, unique: { table: 'uw_bids', column: 'bid_number' } });
    const x = await db.query(`INSERT INTO uw_bids(bid_number, room_id, insurance_company_id, round, status, counter_premium, counter_rate, counter_capacity_percent, counter_terms, parent_bid_id,
        remarks, requested_at, created_by, updated_by) VALUES ($1,$2,$3,$4,'requested',$5,$6,$7,$8,$9,$10,now(),$11,$11) RETURNING id`,
    [number, r.id, b.insurance_company_id, round, num(body.premium) > 0 ? round2(num(body.premium)) : null, body.rate === undefined || body.rate === null || body.rate === '' ? null : num(body.rate),
      num(body.capacityPercent) > 0 ? num(body.capacityPercent) : null, body.terms || null, b.id, body.remarks || null, user.id]);
    await db.query('UPDATE uw_rooms SET current_round = GREATEST(current_round, $2), updated_at = now(), updated_by = $3 WHERE id = $1', [r.id, round, user.id]);
    await logEvent(db, r.id, { actor: who(user), event: 'bid-countered', insurerId: b.insurance_company_id,
      detail: { round, quoted: Number(b.premium), counterPremium: num(body.premium) || null, counterCapacityPercent: num(body.capacityPercent) || null, terms: body.terms || null } });
    return x.rows[0].id;
  });
  return bidOut(await one('SELECT x.*, ic.name AS insurer_name FROM uw_bids x JOIN insurance_companies ic ON ic.id = x.insurance_company_id WHERE x.id = $1', [id]));
}

/** accept (broker takes the quote, optionally for a share), decline (broker records a declinature), withdraw (the underwriter withdraws). */
export async function bidAction(ref, bidId, action, body = {}, actor = {}) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  const b = await bidRow(r.id, bidId);
  const allowed = { accept: ['quoted'], decline: ['requested', 'quoted'], withdraw: ['quoted', 'accepted'], reopen: ['accepted'] };
  if (!allowed[action]) throw badRequest(`Unknown bid action ${action}`);
  const done = { accept: 'accepted', decline: 'declined', withdraw: 'withdrawn', reopen: 'reopened' }[action];
  if (!allowed[action].includes(b.status)) throw conflict(`A ${b.status} bid cannot be ${done}`);
  let status;
  const cols = {};
  if (action === 'accept') {
    const share = body.sharePercent === undefined || body.sharePercent === null || body.sharePercent === '' ? Number(b.capacity_percent || 100) : num(body.sharePercent);
    if (!(share > 0 && share <= Number(b.capacity_percent || 100))) throw badRequest(`The share accepted must be more than 0 and at most the line offered (${Number(b.capacity_percent || 100)}%)`);
    status = 'accepted';
    cols.accepted_share = share;
  } else if (action === 'decline') {
    status = 'declined';
    cols.decline_reason = body.reason || null;
  } else if (action === 'withdraw') {
    status = 'withdrawn';
    cols.decline_reason = body.reason || null;
  } else {
    status = 'quoted';
    cols.accepted_share = null;
  }
  const keys = Object.keys(cols);
  await query(`UPDATE uw_bids SET status = $2, ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}${keys.length ? ',' : ''} updated_at = now() WHERE id = $1`, [b.id, status, ...Object.values(cols)]);
  await logEvent(null, r.id, { actorType: actor.via === 'link' ? 'underwriter' : 'broker', actor: actor.name || null, event: `bid-${status}`, insurerId: b.insurance_company_id,
    detail: { round: b.round, bidNumber: b.bid_number, share: cols.accepted_share ?? null, reason: body.reason || null } });
  return bidOut(await one('SELECT x.*, ic.name AS insurer_name FROM uw_bids x JOIN insurance_companies ic ON ic.id = x.insurance_company_id WHERE x.id = $1', [b.id]));
}

// ---------------------------------------------------------------- messages

export async function postMessage(ref, body, actor) {
  const r = await getRoomRow(ref);
  if (r.status === 'closed') throw conflict('The room is closed');
  if (!String(body.body || '').trim()) throw badRequest('Write a message');
  const insurerId = body.insuranceCompanyId ? Number(body.insuranceCompanyId) : null;
  if (insurerId) await invitedInsurer(r.id, insurerId);
  const ids = (body.attachmentIds || []).map(Number).filter(Boolean);
  if (ids.length && (await one('SELECT count(*)::int AS n FROM uw_attachments WHERE room_id = $1 AND id = ANY($2)', [r.id, ids])).n !== ids.length) throw badRequest('An attachment of the message is not in this room');
  const m = await one(`INSERT INTO uw_messages(room_id, insurance_company_id, author_type, author_user_id, author_name, body, attachment_ids, internal)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [r.id, insurerId, actor.via === 'link' ? 'underwriter' : 'broker', actor.userId || null, actor.name || null, String(body.body).trim(), ids,
    actor.via !== 'link' && Boolean(body.internal)]);
  await logEvent(null, r.id, { actorType: actor.via === 'link' ? 'underwriter' : 'broker', actor: actor.name || null, event: body.internal ? 'note-added' : 'message-posted', insurerId,
    detail: { messageId: Number(m.id), excerpt: String(body.body).trim().slice(0, 120) } });
  return messageOut(m);
}

// ---------------------------------------------------------------- external underwriter link

const linkUrl = async (token) => `${String((await getSetting('general.frontend_url')) || '').replace(/\/$/, '')}/underwriter-room?token=${encodeURIComponent(token)}`;

/** Issue the signed link of an invited insurer (earlier links stop working); optionally e-mail it with the invitation. */
export async function issueLink(ref, insurerId, { sendEmail = false } = {}, user) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  const ri = await invitedInsurer(r.id, insurerId);
  const hours = Number(await getSetting('bespoke.underwriter_link_ttl_hours', 336));
  const token = jwt.sign({ typ: 'uw-room', sub: String(ri.id), room: r.id, nonce: crypto.randomBytes(6).toString('hex') }, config.jwtSecret, { algorithm: 'HS256', expiresIn: Math.round(hours * 3600) });
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  await query('UPDATE uw_room_insurers SET token_hash = $2, token_expires_at = $3 WHERE id = $1', [ri.id, sha(token), expiresAt]);
  const url = await linkUrl(token);
  let emailId = null;
  if (sendEmail) {
    if (!ri.contact_email) throw badRequest(`${ri.name} has no contact e-mail; copy the link instead`);
    const t = await emailTemplate('underwriter_room_invite');
    const v = { companyName: await companyName(), roomNumber: r.room_number, insuredName: r.pl_insured || r.bs_insured || '', currency: r.currency,
      sumInsured: formatAmount(Number(r.pl_sum_insured ?? r.bs_sum_insured ?? 0)), responseDueDate: r.response_due_date || '-', insurerName: ri.name, link: url, expiresAt: isoDate(expiresAt) };
    emailId = await queueEmail({ to: ri.contact_email, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'underwriter_room_invite', entity: 'uw_room', entityId: r.id });
  }
  await logEvent(null, r.id, { actor: who(user), event: 'link-issued', insurerId: ri.insurance_company_id, detail: { expiresAt, emailed: Boolean(emailId) } });
  return { url, token, expiresAt: expiresAt.toISOString(), emailId };
}

/** The room and insurer a link token opens; refused when it expired, was replaced, or the insurer was removed. */
export async function linkContext(token) {
  let payload;
  try { payload = jwt.verify(String(token || ''), config.jwtSecret, { algorithms: ['HS256'] }); } catch { throw badRequest('This link is invalid or has expired'); }
  if (payload.typ !== 'uw-room') throw badRequest('This link is invalid');
  const ri = await one('SELECT x.*, ic.name FROM uw_room_insurers x JOIN insurance_companies ic ON ic.id = x.insurance_company_id WHERE x.id = $1', [Number(payload.sub)]);
  if (!ri || ri.room_id !== payload.room) throw badRequest('This link is invalid');
  if (ri.token_hash !== sha(String(token))) throw badRequest('This link has been replaced by a newer one');
  if (ri.status !== 'invited') throw badRequest('This invitation has been withdrawn');
  const r = await getRoomRow(ri.room_id);
  return { room: r, ri, actor: { via: 'link', insurerId: ri.insurance_company_id, name: `${ri.name} (underwriter link)` } };
}

/** What the underwriter sees: the slip, the current SOV, shared attachments, its own bids and its message thread. */
export async function linkView(token) {
  const { room, ri } = await linkContext(token);
  if (!ri.last_viewed_at || Date.now() - new Date(ri.last_viewed_at).getTime() > 3600 * 1000) {
    await logEvent(null, room.id, { actorType: 'underwriter', actor: `${ri.name} (underwriter link)`, event: 'room-viewed', insurerId: ri.insurance_company_id });
  }
  await query('UPDATE uw_room_insurers SET last_viewed_at = now() WHERE id = $1', [ri.id]);
  const slip = room.composed_slip_id ? await composedById(room.composed_slip_id) : null;
  const attachments = await many("SELECT * FROM uw_attachments WHERE room_id = $1 AND (shared OR insurance_company_id = $2) AND kind <> 'message' ORDER BY uploaded_at", [room.id, ri.insurance_company_id]);
  const messages = await many(`SELECT m.*, NULL AS insurer_name FROM uw_messages m WHERE m.room_id = $1 AND NOT m.internal AND (m.insurance_company_id IS NULL OR m.insurance_company_id = $2)
    ORDER BY m.created_at, m.id`, [room.id, ri.insurance_company_id]);
  const h = roomHeader(room);
  return {
    room: { roomNumber: h.roomNumber, title: h.title, status: h.status, insuredName: h.insuredName, currency: h.currency, sumInsured: h.sumInsured, responseDueDate: h.responseDueDate, currentRound: h.currentRound },
    insurer: { insuranceCompanyId: ri.insurance_company_id, name: ri.name, linkExpiresAt: ri.token_expires_at },
    slip: slip ? { slipNumber: slip.slipNumber, title: slip.title, version: slip.version, status: slip.status, sections: slip.sections.map((s) => ({ heading: s.heading, text: s.rendered })),
      clauses: slip.clauses.map((c) => ({ code: c.code, title: c.title, clauseType: c.clauseType, text: c.rendered })) } : null,
    sov: (await sovOf(room.id)).current, attachments: attachments.map(attachmentOut), bids: await bidsOf(room.id, ri.insurance_company_id),
    messages: messages.map(messageOut).map(({ internal: _internal, ...m }) => m),
  };
}

export async function linkBid(token, body) {
  const { room, ri, actor } = await linkContext(token);
  if (body.status === 'withdrawn') {
    const b = await one("SELECT id FROM uw_bids WHERE room_id = $1 AND insurance_company_id = $2 AND status IN ('quoted', 'accepted') ORDER BY round DESC, created_at DESC LIMIT 1", [room.id, ri.insurance_company_id]);
    if (!b) throw conflict('There is no quote to withdraw');
    return bidAction(room.id, b.id, 'withdraw', { reason: body.remarks }, actor);
  }
  return recordBid(room.id, { ...body, insuranceCompanyId: ri.insurance_company_id }, actor);
}

export async function linkMessage(token, text) {
  const { room, ri, actor } = await linkContext(token);
  return postMessage(room.id, { body: text, insuranceCompanyId: ri.insurance_company_id }, actor);
}

// ---------------------------------------------------------------- award and close

/**
 * Award: the accepted bids (shares = their accepted share unless `shares` says otherwise; must total 100%) become the
 * insurer offers of the broker slip and then the Quotation Slip (target quotation) or the Placement Slip (target
 * placement), through the placement journey (brokerSlips.js / placements.js), which applies the journey rules.
 */
export async function awardRoom(ref, b, user) {
  const r = await getRoomRow(ref);
  await assertOpen(r);
  if (!r.broker_slip_id) throw badRequest('Only a room of a Request for Quotation can be awarded; for a placement slip, edit its participants');
  const ids = b.bidIds?.length ? b.bidIds : (await many("SELECT id FROM uw_bids WHERE room_id = $1 AND status = 'accepted'", [r.id])).map((x) => x.id);
  if (!ids.length) throw badRequest('Accept at least one bid before the award');
  const bids = [];
  for (const id of ids) {
    const x = await bidRow(r.id, id);
    if (x.status !== 'accepted') throw badRequest(`Bid ${x.bid_number} is ${x.status}: accept it first`);
    bids.push(x);
  }
  if (new Set(bids.map((x) => x.insurance_company_id)).size !== bids.length) throw badRequest('Only one accepted bid per insurer can be awarded');
  const shareOf = (x) => (b.shares?.[x.id] !== undefined ? num(b.shares[x.id]) : Number(x.accepted_share ?? x.capacity_percent ?? 100));
  const total = round2(bids.reduce((s, x) => s + shareOf(x), 0));
  if (Math.abs(total - 100) > 0.0001) throw badRequest(`The accepted shares total ${total}%: they must total exactly 100% to award the placement`);
  const slips = await import('../placement/brokerSlips.js');
  const slip = await slips.getSlipRow(r.broker_slip_id);
  if (!['draft', 'submitted', 'responses-in'].includes(slip.status)) throw conflict(`The Request for Quotation is ${slip.status}`);
  if (slip.status === 'draft') await query("UPDATE broker_slips SET status = 'submitted', submission_date = COALESCE(submission_date, $2), updated_by = $3, updated_at = now() WHERE id = $1", [slip.id, await today(), user.id]);
  const offerIds = [];
  const shares = {};
  let leadOfferId = null;
  for (const x of bids) {
    let offer = await one('SELECT id FROM insurer_offers WHERE broker_slip_id = $1 AND insurance_company_id = $2', [slip.id, x.insurance_company_id]);
    if (!offer) {
      const number = await nextDocumentNumber('insurer_offer', { unique: { table: 'insurer_offers', column: 'offer_number' } });
      offer = await one('INSERT INTO insurer_offers(offer_number, broker_slip_id, insurance_company_id, requested_at, created_by) VALUES ($1,$2,$3,now(),$4) RETURNING id', [number, slip.id, x.insurance_company_id, user.id]);
    }
    const deviations = (x.deviations || []).map((d) => [d.clause, d.offered].filter(Boolean).join(': ')).filter(Boolean).join('; ');
    await slips.recordOffer(slip.id, offer.id, { status: 'offered', premium: Number(x.premium), rate: x.rate === null ? undefined : Number(x.rate), deductibles: x.deductibles || undefined,
      terms: [deviations, x.remarks].filter(Boolean).join('; ') || undefined, validityDate: x.validity_date || undefined, offeredShare: shareOf(x), remarks: `Awarded from ${r.room_number} bid ${x.bid_number}` }, user);
    offerIds.push(offer.id);
    shares[offer.id] = shareOf(x);
    if (b.leadBidId && (x.id === b.leadBidId || x.bid_number === b.leadBidId)) leadOfferId = offer.id;
  }
  const target = b.target || 'quotation';
  let result;
  if (target === 'quotation') {
    const q = await slips.prepareQuotation(slip.id, { offerIds, shares, leadOfferId }, user);
    await query("UPDATE uw_rooms SET status = 'awarded', quote_id = $2, updated_by = $3, updated_at = now() WHERE id = $1", [r.id, q.quoteId, user.id]);
    result = { target, quoteId: q.quoteId };
  } else if (target === 'placement') {
    const plc = await import('../placement/placements.js');
    const p = await plc.createPlacement({ brokerSlipId: slip.id, offerIds, shares, leadOfferId, inceptionDate: b.inceptionDate, expiryDate: b.expiryDate, billingMode: b.billingMode }, user);
    await query("UPDATE uw_rooms SET status = 'awarded', award_placement_id = $2, updated_by = $3, updated_at = now() WHERE id = $1", [r.id, p.id, user.id]);
    result = { target, placementId: p.id, placementNumber: p.placementNumber };
  } else {
    throw badRequest('target must be quotation or placement');
  }
  await logEvent(null, r.id, { actor: who(user), event: 'room-awarded', detail: { ...result, bids: bids.map((x) => ({ bid: x.bid_number, insurerId: x.insurance_company_id, share: shareOf(x) })) } });
  return { ...result, room: await roomById(r.id) };
}

export async function closeRoom(ref, reason, user) {
  const r = await getRoomRow(ref);
  if (r.status === 'closed') throw conflict('The room is already closed');
  await query("UPDATE uw_rooms SET status = 'closed', close_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1", [r.id, reason || null, user.id]);
  await query('UPDATE uw_room_insurers SET token_hash = NULL WHERE room_id = $1', [r.id]);
  await logEvent(null, r.id, { actor: who(user), event: 'room-closed', detail: { reason: reason || null } });
  return roomById(r.id);
}
