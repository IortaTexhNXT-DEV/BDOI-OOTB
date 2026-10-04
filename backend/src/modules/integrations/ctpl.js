/**
 * CTPL certificate of cover (COC) authentication.
 *
 *   COC series             numbers received from each insurer (per branch or for every branch); the next number is
 *                          allocated under a row lock, an exhausted series closes itself
 *   registerForPolicy()    a CTPL cover issued (policy issue hook, or added by hand): COC number allocated, vehicle
 *                          identifiers copied from the policy, and (ctpl.authenticate_on_issue) the request queued
 *   requestAuthentication  ctpl.authenticate through the CTPL_AUTH connector (IC-accredited provider); the answer's
 *                          authentication code is stored on the record and on the policy (printed on the schedule)
 *   manualEntry()          fallback when the provider's portal was used: the code is keyed in (method manual)
 *   LTO feed               ctpl.lto_feed through the LTO_FEED connector when ctpl.lto_feed is on
 *   report                 covers not yet authenticated, with the hours waited and the overdue flag
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { registerMessageType } from './framework/registry.js';
import { enqueue, processOutbox } from './framework/outbox.js';

const run = (db) => db || { query };
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
export const STATUSES = ['pending', 'requested', 'authenticated', 'failed', 'cancelled'];
export const VEHICLE_FIELDS = ['plateNumber', 'mvFileNumber', 'chassisNumber', 'engineNumber', 'vehicleType'];

// ------------------------------------------------------------------ COC series

export const toSeries = (s) => ({
  id: s.id, insuranceCompanyId: s.insurance_company_id, insurerName: s.insurer_name || null, branchCode: s.branch_code, prefix: s.prefix, seriesFrom: Number(s.series_from),
  seriesTo: Number(s.series_to), nextNumber: Number(s.next_number), numberWidth: s.number_width, remaining: Math.max(0, Number(s.series_to) - Number(s.next_number) + 1),
  used: Number(s.next_number) - Number(s.series_from), status: s.status, receivedDate: s.received_date, lowStockThreshold: s.low_stock_threshold,
  lowStock: s.status === 'active' && Number(s.series_to) - Number(s.next_number) + 1 <= Number(s.low_stock_threshold), remarks: s.remarks, updatedAt: s.updated_at,
});
const SERIES_SELECT = 'SELECT s.*, ic.name AS insurer_name FROM coc_series s JOIN insurance_companies ic ON ic.id = s.insurance_company_id';

export async function listSeries(q = {}) {
  return (await many(`${SERIES_SELECT} WHERE ($1::int IS NULL OR s.insurance_company_id = $1) AND ($2::text IS NULL OR s.status = $2) ORDER BY ic.name, s.branch_code NULLS FIRST, s.series_from`,
    [q.insuranceCompanyId ? Number(q.insuranceCompanyId) : null, q.status || null])).map(toSeries);
}
export async function seriesRow(id, db = null) {
  const s = (await run(db).query(`${SERIES_SELECT} WHERE s.id = $1`, [Number(id) || 0])).rows[0];
  if (!s) throw notFound('COC series not found');
  return s;
}

export async function createSeries(b, user) {
  const from = Number(b.seriesFrom); const to = Number(b.seriesTo);
  if (to < from) throw badRequest('Validation failed', [{ path: 'seriesTo', message: 'The last number cannot be lower than the first' }]);
  const insurer = await one('SELECT id FROM insurance_companies WHERE id = $1', [Number(b.insuranceCompanyId)]);
  if (!insurer) throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: 'Unknown insurer' }]);
  const overlap = await one(`SELECT id, series_from, series_to FROM coc_series WHERE insurance_company_id = $1 AND prefix = $2 AND series_from <= $4 AND series_to >= $3 LIMIT 1`,
    [insurer.id, b.prefix || '', from, to]);
  if (overlap) throw conflict(`The numbers overlap series ${overlap.series_from} to ${overlap.series_to} of the same insurer and prefix`);
  const r = await one(`INSERT INTO coc_series(insurance_company_id, branch_code, prefix, series_from, series_to, next_number, number_width, received_date, low_stock_threshold, remarks, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$4,$6,$7,$8,$9,$10,$10) RETURNING id`, [insurer.id, str(b.branchCode), b.prefix || '', from, to, b.numberWidth || 8, b.receivedDate || null,
    b.lowStockThreshold ?? 20, str(b.remarks), user?.id ?? null]);
  return toSeries(await seriesRow(r.id));
}

export async function updateSeries(id, b, user) {
  const s = await seriesRow(id);
  if (b.status === 'active' && Number(s.next_number) > Number(s.series_to)) throw conflict('Every number of this series has been used');
  await query(`UPDATE coc_series SET status = COALESCE($2, status), branch_code = CASE WHEN $3::boolean THEN $4 ELSE branch_code END, low_stock_threshold = COALESCE($5, low_stock_threshold),
      remarks = CASE WHEN $6::boolean THEN $7 ELSE remarks END, updated_by = $8, updated_at = now() WHERE id = $1`,
  [s.id, b.status || null, b.branchCode !== undefined, str(b.branchCode), b.lowStockThreshold ?? null, b.remarks !== undefined, str(b.remarks), user?.id ?? null]);
  return { before: toSeries(s), after: toSeries(await seriesRow(s.id)) };
}

/** Allocate the next COC number of an insurer (branch series first, then the series for every branch). */
export async function allocateCoc(db, insurerId, branchCode) {
  const s = (await db.query(`SELECT * FROM coc_series WHERE insurance_company_id = $1 AND status = 'active' AND next_number <= series_to AND (branch_code IS NULL OR branch_code = $2)
    ORDER BY (branch_code IS NULL), series_from, id LIMIT 1 FOR UPDATE`, [insurerId, branchCode || null])).rows[0];
  if (!s) return null;
  const n = Number(s.next_number);
  const number = `${s.prefix || ''}${String(n).padStart(s.number_width, '0')}`;
  await db.query(`UPDATE coc_series SET next_number = next_number + 1, status = CASE WHEN next_number + 1 > series_to THEN 'exhausted' ELSE status END, updated_at = now() WHERE id = $1`, [s.id]);
  return { seriesId: s.id, number };
}

// ------------------------------------------------------------------ authentications

export const toAuth = (a, now = new Date(), alertHours = 24) => {
  const waited = a.status === 'authenticated' || a.status === 'cancelled' ? null : Math.floor((now - new Date(a.created_at)) / 3600000);
  return {
    id: a.id, policyId: a.policy_id, policyNumber: a.policy_number, insuranceCompanyId: a.insurance_company_id, insurerName: a.insurer_name || null, branchCode: a.branch_code,
    cocSeriesId: a.coc_series_id, cocNumber: a.coc_number, plateNumber: a.plate_number, mvFileNumber: a.mv_file_number, chassisNumber: a.chassis_number, engineNumber: a.engine_number,
    vehicleType: a.vehicle_type, ctplPremium: Number(a.ctpl_premium), periodFrom: a.period_from, periodTo: a.period_to, insuredName: a.insured_name || null,
    status: a.status, method: a.method, authCode: a.auth_code, providerReference: a.provider_reference, outboxId: a.outbox_id ? Number(a.outbox_id) : null,
    ltoStatus: a.lto_status, ltoReference: a.lto_reference, lastError: a.last_error, requestedAt: a.requested_at, authenticatedAt: a.authenticated_at,
    authenticatedBy: a.authenticated_by_name || a.authenticated_by, cancelReason: a.cancel_reason, createdAt: a.created_at, hoursWaiting: waited,
    overdue: waited !== null && waited >= alertHours,
  };
};
const AUTH_SELECT = `SELECT a.*, ic.name AS insurer_name, p.insured_name, (SELECT display_name FROM users u WHERE u.id = a.authenticated_by) AS authenticated_by_name
  FROM ctpl_authentications a LEFT JOIN insurance_companies ic ON ic.id = a.insurance_company_id LEFT JOIN policies p ON p.id = a.policy_id`;

export async function authRow(id, db = null) {
  const a = (await run(db).query(`${AUTH_SELECT} WHERE a.id = $1 OR (a.coc_number = $1 AND a.status <> 'cancelled')`, [String(id)])).rows[0];
  if (!a) throw notFound('CTPL authentication not found');
  return a;
}
export const authView = async (id, db = null) => toAuth(await authRow(id, db), new Date(), Number(await getSetting('ctpl.unauthenticated_alert_hours', 24)) || 24);

export async function listAuthentications(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('a.status = ANY(?)', String(q.status).split(',').map((s) => s.trim()));
  if (q.unauthenticated === 'true' || q.unauthenticated === true) where.push("a.status IN ('pending', 'requested', 'failed')");
  if (q.insuranceCompanyId) add('a.insurance_company_id = ?', Number(q.insuranceCompanyId));
  if (q.from) add('a.created_at >= ?::date', q.from);
  if (q.to) add('a.created_at < ?::date + 1', q.to);
  if (q.search) add("(a.policy_number ILIKE '%' || ? || '%' OR a.coc_number ILIKE '%' || ? || '%' OR a.plate_number ILIKE '%' || ? || '%' OR a.auth_code ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%')", String(q.search).trim());
  const w = where.join(' AND ');
  const from = 'FROM ctpl_authentications a LEFT JOIN policies p ON p.id = a.policy_id';
  const total = (await one(`SELECT count(*)::int AS n ${from} WHERE ${w}`, params)).n;
  const rows = await many(`${AUTH_SELECT} WHERE ${w} ORDER BY a.created_at DESC, a.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  const alert = Number(await getSetting('ctpl.unauthenticated_alert_hours', 24)) || 24;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const c of await many('SELECT status, count(*)::int AS n FROM ctpl_authentications GROUP BY status')) counts[c.status] = c.n;
  const now = new Date();
  return { total, rows: rows.map((a) => toAuth(a, now, alert)), counts };
}

/** Whether a policy row carries a CTPL cover. */
export function isCtpl(p) {
  const doc = p.doc || {};
  const veh = (Array.isArray(doc.insuranceVehicleDetails) && doc.insuranceVehicleDetails[0]) || {};
  return num(doc.ctplCoveragePremium) > 0 || num(veh.ctplCoveragePremium) > 0 || num(p.details?.ctplCoveragePremium) > 0 || /\bCTPL\b/i.test(`${p.lob || ''} ${p.product_type || ''}`);
}

function vehicleOf(p) {
  const doc = p.doc || {};
  const veh = (Array.isArray(doc.insuranceVehicleDetails) && doc.insuranceVehicleDetails[0]) || {};
  const pick = (...keys) => {
    for (const src of [doc, veh, p.details || {}]) for (const k of keys) if (str(src[k])) return str(src[k]);
    return null;
  };
  return {
    plateNumber: pick('plateNumber', 'plateNo', 'PlateNumber'), mvFileNumber: pick('mvFileNumber', 'MVFileNumber', 'MvFileNumber'), chassisNumber: pick('chassisNumber', 'chassisNo', 'ChassisNumber'),
    engineNumber: pick('engineNumber', 'engineNo'), vehicleType: pick('vehicleType'), ctplPremium: num(doc.ctplCoveragePremium || veh.ctplCoveragePremium || p.details?.ctplCoveragePremium),
  };
}

/** Identifiers still missing before a COC can be authenticated (ctpl.require_vehicle_ids). */
export async function missingIds(a) {
  const need = (await getSetting('ctpl.require_vehicle_ids', ['plateOrMvFile', 'chassisNumber'])) || [];
  const v = { plateNumber: a.plate_number, mvFileNumber: a.mv_file_number, chassisNumber: a.chassis_number, engineNumber: a.engine_number };
  const out = [];
  for (const k of need) {
    if (k === 'plateOrMvFile') {
      if (!v.plateNumber && !v.mvFileNumber) out.push('plate number or MV file number');
    } else if (k in v && !v[k]) out.push(k.replace(/([A-Z])/g, ' $1').toLowerCase());
  }
  return out;
}

/**
 * Register a policy's CTPL cover: COC number from the insurer's series, vehicle identifiers from the policy; the
 * request is queued at once when ctpl.authenticate_on_issue is on and nothing is missing. Returns the record id, or
 * null when the policy has no CTPL cover (unless force).
 */
export async function registerForPolicy(db, policyRef, userId, { force = false, cocNumber = null } = {}) {
  const p = (await db.query(`SELECT p.*, (SELECT branch_code FROM users u WHERE u.id = COALESCE(p.owner_user_id, p.created_by)) AS branch_code FROM policies p
    WHERE p.id = $1 OR p.policy_number = $1`, [String(policyRef)])).rows[0];
  if (!p) throw notFound('Policy not found');
  if (!force && !isCtpl(p)) return null;
  const existing = (await db.query("SELECT id FROM ctpl_authentications WHERE policy_id = $1 AND status <> 'cancelled'", [p.id])).rows[0];
  if (existing) {
    if (force) throw conflict(`Policy ${p.policy_number} is registered for CTPL authentication already`);
    return existing.id;
  }
  const v = vehicleOf(p);
  let coc = null;
  if (cocNumber) coc = { seriesId: null, number: String(cocNumber).trim() };
  else if (p.insurance_company_id) coc = await allocateCoc(db, p.insurance_company_id, p.branch_code);
  const error = !p.insurance_company_id ? 'The policy has no insurer' : !coc ? 'No active COC series with numbers left for this insurer: add one on the COC Series tab, or enter the COC number' : null;
  const r = (await db.query(`INSERT INTO ctpl_authentications(policy_id, policy_number, insurance_company_id, branch_code, coc_series_id, coc_number, plate_number, mv_file_number, chassis_number,
      engine_number, vehicle_type, ctpl_premium, period_from, period_to, last_error, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING *`,
  [p.id, p.policy_number, p.insurance_company_id, p.branch_code || null, coc?.seriesId || null, coc?.number || null, v.plateNumber, v.mvFileNumber, v.chassisNumber, v.engineNumber,
    v.vehicleType, v.ctplPremium, p.inception_date, p.expiry_date, error, userId || null])).rows[0];
  if (coc) await db.query("UPDATE policies SET doc = doc || jsonb_build_object('cocNumber', $2::text) WHERE id = $1", [p.id, coc.number]);
  if (coc && (await getSetting('ctpl.authenticate_on_issue', true)) && !(await missingIds(r)).length) await queueAuthentication(db, r, userId);
  return r.id;
}

async function queueAuthentication(db, a, userId) {
  const ins = (await db.query('SELECT code, name FROM insurance_companies WHERE id = $1', [a.insurance_company_id])).rows[0] || {};
  const p = (await db.query('SELECT insured_name FROM policies WHERE id = $1', [a.policy_id])).rows[0] || {};
  const count = Number((await db.query("SELECT count(*)::int AS n FROM integration_outbox WHERE entity = 'ctpl_authentication' AND entity_id = $1 AND message_type = 'ctpl.authenticate'", [a.id])).rows[0].n);
  const m = await enqueue(db, {
    connectorCode: String(await getSetting('ctpl.connector', 'CTPL_AUTH')), messageType: 'ctpl.authenticate', entity: 'ctpl_authentication', entityId: a.id, reference: a.coc_number,
    idempotencyKey: `ctpl:auth:${a.id}:${count + 1}`,
    payload: { cocNumber: a.coc_number, insurerCode: ins.code, insurerName: ins.name, policyNumber: a.policy_number, plateNumber: a.plate_number, mvFileNumber: a.mv_file_number,
      chassisNumber: a.chassis_number, engineNumber: a.engine_number, vehicleType: a.vehicle_type, periodFrom: a.period_from || null, periodTo: a.period_to || null,
      insuredName: p.insured_name, premium: Number(a.ctpl_premium) },
  }, userId ? { id: userId } : null);
  await db.query("UPDATE ctpl_authentications SET status = 'requested', outbox_id = $2, requested_at = now(), last_error = NULL, updated_at = now() WHERE id = $1", [a.id, m.id]);
  return m;
}

/** Send (or send again) the authentication request of a record now. */
export async function requestAuthentication(id, user, opts = {}) {
  const queued = await withTransaction(async (db) => {
    const a = (await db.query('SELECT * FROM ctpl_authentications WHERE id = $1 FOR UPDATE', [String(id)])).rows[0];
    if (!a) throw notFound('CTPL authentication not found');
    if (a.status === 'authenticated') throw conflict(`COC ${a.coc_number} is authenticated already`);
    if (a.status === 'cancelled') throw conflict('This record is cancelled');
    if (!a.coc_number) throw badRequest('Enter the COC number first (no COC series had numbers left)');
    const missing = await missingIds(a);
    if (missing.length) throw badRequest(`Vehicle details missing: ${missing.join(', ')}`);
    if (a.status === 'requested' && a.outbox_id) {
      const m = (await db.query('SELECT status FROM integration_outbox WHERE id = $1', [a.outbox_id])).rows[0];
      if (m && ['queued', 'retry', 'processing'].includes(m.status)) return { id: Number(a.outbox_id) };
    }
    return queueAuthentication(db, a, user?.id);
  });
  await processOutbox({ ids: [queued.id], fetchImpl: opts.fetchImpl });
  return authView(id);
}

async function markAuthenticated(db, a, { authCode, providerReference, method, userId, at = null }) {
  await db.query(`UPDATE ctpl_authentications SET status = 'authenticated', method = $2, auth_code = $3, provider_reference = COALESCE($4, provider_reference), authenticated_at = COALESCE($5::timestamptz, now()),
      authenticated_by = $6, last_error = NULL, updated_at = now() WHERE id = $1`, [a.id, method, authCode, providerReference || null, at, userId || null]);
  await db.query(`UPDATE policies SET doc = doc || jsonb_build_object('cocNumber', $2::text, 'ctplAuthenticationCode', $3::text, 'ctplAuthenticatedAt', now()::text) WHERE id = $1`,
    [a.policy_id, a.coc_number, authCode]);
  if (await getSetting('ctpl.lto_feed', false)) {
    const m = await enqueue(db, { connectorCode: String(await getSetting('ctpl.lto_connector', 'LTO_FEED')), messageType: 'ctpl.lto_feed', entity: 'ctpl_authentication', entityId: a.id,
      reference: a.coc_number, idempotencyKey: `ctpl:lto:${a.id}`, payload: { cocNumber: a.coc_number, authCode, plateNumber: a.plate_number, mvFileNumber: a.mv_file_number,
        chassisNumber: a.chassis_number, engineNumber: a.engine_number, policyNumber: a.policy_number } });
    await db.query("UPDATE ctpl_authentications SET lto_status = 'queued' WHERE id = $1 AND $2::bigint IS NOT NULL", [a.id, m.id]);
  } else {
    await db.query("UPDATE ctpl_authentications SET lto_status = 'not-required' WHERE id = $1 AND lto_status = 'not-sent'", [a.id]);
  }
  const p = (await db.query('SELECT client_id FROM policies WHERE id = $1', [a.policy_id])).rows[0];
  if (p?.client_id && (await db.query("SELECT 1 FROM message_templates WHERE event = 'ctpl_authenticated' AND active")).rows.length) {
    const { queueClientMessage } = await import('./messaging.js');
    await queueClientMessage(db, { event: 'ctpl_authenticated', clientId: p.client_id, entity: 'policy', entityId: a.policy_id, idempotencyKey: `sms:ctpl:${a.id}`,
      vars: { policyNumber: a.policy_number, cocNumber: a.coc_number, authCode } });
  }
}

/** Manual fallback: the authentication code obtained on the provider's portal. */
export async function manualEntry(id, b, user) {
  return withTransaction(async (db) => {
    const a = (await db.query('SELECT * FROM ctpl_authentications WHERE id = $1 FOR UPDATE', [String(id)])).rows[0];
    if (!a) throw notFound('CTPL authentication not found');
    if (a.status === 'authenticated') throw conflict(`COC ${a.coc_number} is authenticated already (code ${a.auth_code})`);
    if (a.status === 'cancelled') throw conflict('This record is cancelled');
    const before = await authView(a.id, db);
    if (b.cocNumber && b.cocNumber !== a.coc_number) {
      await db.query('UPDATE ctpl_authentications SET coc_number = $2 WHERE id = $1', [a.id, b.cocNumber]);
      a.coc_number = b.cocNumber;
    }
    if (!a.coc_number) throw badRequest('Enter the COC number');
    if (a.outbox_id) await db.query("UPDATE integration_outbox SET status = 'cancelled', last_error = 'Authenticated by hand on the provider portal', updated_at = now() WHERE id = $1 AND status IN ('queued', 'retry', 'failed')", [a.outbox_id]);
    await markAuthenticated(db, a, { authCode: b.authCode.trim(), providerReference: b.providerReference, method: 'manual', userId: user?.id, at: b.authenticatedAt || null });
    return { before, after: await authView(a.id, db) };
  });
}

/** Correct the vehicle identifiers or the COC number of a record not yet authenticated. */
export async function updateAuthentication(id, b, user) {
  const a = await authRow(id);
  if (['authenticated', 'cancelled'].includes(a.status)) throw conflict(`A ${a.status} record cannot be changed`);
  const before = toAuth(a);
  await query(`UPDATE ctpl_authentications SET plate_number = COALESCE($2, plate_number), mv_file_number = COALESCE($3, mv_file_number), chassis_number = COALESCE($4, chassis_number),
      engine_number = COALESCE($5, engine_number), vehicle_type = COALESCE($6, vehicle_type), coc_number = COALESCE($7, coc_number), updated_by = $8, updated_at = now(),
      last_error = CASE WHEN $7::text IS NOT NULL AND coc_number IS NULL THEN NULL ELSE last_error END WHERE id = $1`,
  [a.id, str(b.plateNumber), str(b.mvFileNumber), str(b.chassisNumber), str(b.engineNumber), str(b.vehicleType), str(b.cocNumber), user?.id ?? null]);
  return { before, after: await authView(a.id) };
}

export async function cancelAuthentication(id, reason, user) {
  const a = await authRow(id);
  if (a.status === 'cancelled') throw conflict('This record is cancelled already');
  await query("UPDATE ctpl_authentications SET status = 'cancelled', cancel_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1", [a.id, reason, user?.id ?? null]);
  if (a.outbox_id) await query("UPDATE integration_outbox SET status = 'cancelled', last_error = 'CTPL record cancelled', updated_at = now() WHERE id = $1 AND status IN ('queued', 'retry')", [a.outbox_id]);
  return { before: toAuth(a), after: await authView(a.id) };
}

// ------------------------------------------------------------------ message types

registerMessageType({
  type: 'ctpl.authenticate', kind: 'ctpl_auth', label: 'CTPL COC authentication request',
  onSent: async (db, message, result) => {
    const a = (await db.query('SELECT * FROM ctpl_authentications WHERE id = $1 FOR UPDATE', [message.entityId])).rows[0];
    if (!a || a.status === 'authenticated' || a.status === 'cancelled') return;
    const code = result.data?.authCode;
    if (!code) throw new Error('The answer has no authentication code');
    await markAuthenticated(db, a, { authCode: code, providerReference: result.data?.providerReference || result.externalRef, method: 'api', userId: null });
  },
  onFailed: async (db, message, error) => {
    await db.query("UPDATE ctpl_authentications SET status = 'failed', last_error = $2, updated_at = now() WHERE id = $1 AND status = 'requested'", [message.entityId, String(error.message).slice(0, 1000)]);
  },
  onRequeued: async (db, message) => {
    await db.query("UPDATE ctpl_authentications SET status = 'requested', last_error = NULL, updated_at = now() WHERE id = $1 AND status = 'failed'", [message.entityId]);
  },
});

registerMessageType({
  type: 'ctpl.authentication_result', kind: 'ctpl_auth', label: 'CTPL authentication result pushed by the provider',
  onInbound: async (db, inbox) => {
    const p = inbox.payload || {};
    const a = (await db.query("SELECT * FROM ctpl_authentications WHERE coc_number = $1 AND status <> 'cancelled' FOR UPDATE", [String(p.cocNumber || '')])).rows[0];
    if (!a) throw new Error(`No CTPL record with COC ${p.cocNumber}`);
    if (a.status === 'authenticated') return { entity: 'ctpl_authentication', entityId: a.id, result: { already: true } };
    if (p.status && String(p.status).toLowerCase() !== 'authenticated') {
      await db.query("UPDATE ctpl_authentications SET status = 'failed', last_error = $2, updated_at = now() WHERE id = $1", [a.id, String(p.reason || p.status).slice(0, 1000)]);
      return { entity: 'ctpl_authentication', entityId: a.id, result: { status: 'failed' } };
    }
    if (!p.authCode) throw new Error('The message has no authCode');
    await markAuthenticated(db, a, { authCode: String(p.authCode), providerReference: p.reference || null, method: 'api', userId: null });
    return { entity: 'ctpl_authentication', entityId: a.id, result: { status: 'authenticated' } };
  },
});

registerMessageType({
  type: 'ctpl.lto_feed', kind: 'lto_feed', label: 'Authenticated COC sent to the LTO',
  onSent: async (db, message, result) => {
    await db.query("UPDATE ctpl_authentications SET lto_status = 'sent', lto_reference = $2, updated_at = now() WHERE id = $1", [message.entityId, result.data?.reference || result.externalRef || null]);
  },
  onFailed: async (db, message, error) => {
    await db.query("UPDATE ctpl_authentications SET lto_status = 'failed', last_error = $2, updated_at = now() WHERE id = $1", [message.entityId, `LTO feed: ${String(error.message).slice(0, 900)}`]);
  },
  onRequeued: async (db, message) => {
    await db.query("UPDATE ctpl_authentications SET lto_status = 'queued', updated_at = now() WHERE id = $1", [message.entityId]);
  },
});

/** Columns of the unauthenticated CTPL report export. */
export const REPORT_COLUMNS = [
  { key: 'policyNumber', label: 'Policy No.' }, { key: 'insuredName', label: 'Insured' }, { key: 'insurerName', label: 'Insurer' }, { key: 'branchCode', label: 'Branch' },
  { key: 'cocNumber', label: 'COC No.' }, { key: 'plateNumber', label: 'Plate No.' }, { key: 'mvFileNumber', label: 'MV File No.' }, { key: 'chassisNumber', label: 'Chassis No.' },
  { key: 'status', label: 'Status' }, { key: 'authCode', label: 'Authentication Code' }, { key: 'method', label: 'Method' }, { key: 'hoursWaiting', label: 'Hours Waiting' },
  { key: 'overdue', label: 'Overdue' }, { key: 'lastError', label: 'Last Error' }, { key: 'createdAt', label: 'Registered' },
];
