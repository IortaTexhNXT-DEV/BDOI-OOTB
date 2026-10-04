/**
 * Fleet schedules (Operations > Fleet Schedules): one motor policy covering many vehicles of a client.
 *
 * A draft schedule collects vehicles (one by one or from the Fleet Vehicles upload). Each vehicle is priced on its own
 * with the quotation premium routine (quotations/premium.js#premiumBreakdown): own damage and acts of nature on its sum
 * insured, excess bodily injury and property damage, the CTPL tariff of its vehicle class and the premium taxes. Issuing
 * the schedule issues one policy for the totals (issuePolicy: bill, booking journal, commission accrual).
 *
 * After issue a vehicle is added or deleted by an endorsement (endorsements/service.js): the premium of the change is
 * the vehicle's annual premium pro-rata to the days left (fleet.pro_rata_basis); completing the endorsement bills the
 * additional premium or credits the return premium exactly as an endorsement raised on the Endorsement screen.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../documents/common.js';
import { mapColumns } from '../documents/tabular.js';
import { premiumBreakdown } from '../quotations/premium.js';
import { issuePolicy } from '../policies/service.js';
import { createEndorsement, completeEndorsement } from '../endorsements/service.js';
import { baseCurrency } from '../../lib/currency.js';

/** Columns of the Fleet Vehicles upload (Fleet_Vehicles_Upload_Template.xlsx is built from this list). */
export const FLEET_VEHICLE_COLUMNS = [
  { key: 'plateNumber', header: 'Plate Number', aliases: ['plate no'], required: 'Plate Number, Conduction Sticker or Chassis Number', format: 'Text', example: 'NBC 1234' },
  { key: 'conductionSticker', header: 'Conduction Sticker', aliases: ['cs number'], format: 'Text', example: '' },
  { key: 'chassisNumber', header: 'Chassis Number', aliases: ['vin'], format: 'Chassis / VIN', example: 'MPATFS86JMT004321' },
  { key: 'engineNumber', header: 'Engine Number', aliases: ['motor number'], format: 'Engine / motor number', example: '4JJ3-778812' },
  { key: 'make', header: 'Make', aliases: ['brand'], required: true, format: 'Vehicle brand', example: 'Isuzu' },
  { key: 'model', header: 'Model', required: true, format: 'Vehicle model', example: 'D-Max 3.0 LS-A' },
  { key: 'yearModel', header: 'Year Model', aliases: ['year'], format: 'Four digits', example: '2024' },
  { key: 'color', header: 'Color', aliases: ['colour'], format: 'Text', example: 'White' },
  { key: 'vehicleType', header: 'Vehicle Type', aliases: ['vehicle class'], required: 'When CTPL is included', format: 'Insurance Commission vehicle class code or label (CTPL tariff)', example: 'light_medium_trucks' },
  { key: 'usage', header: 'Usage', format: 'Private, commercial or for hire', example: 'Commercial' },
  { key: 'mortgagee', header: 'Mortgagee', aliases: ['financing bank'], format: 'Bank named as mortgagee, if any', example: '' },
  { key: 'sumInsured', header: 'Sum Insured', aliases: ['value'], required: true, format: 'Amount in PHP, greater than zero', example: '1450000' },
  { key: 'ownDamageRate', header: 'Own Damage Rate %', aliases: ['od rate', 'rate'], required: true, format: 'Percent of the sum insured', example: '1.25' },
  { key: 'actsOfNatureRate', header: 'Acts of Nature Rate %', aliases: ['aon rate'], format: 'Percent of the sum insured; 0 when not covered', example: '0.5' },
  { key: 'bodilyInjury', header: 'Excess Bodily Injury', aliases: ['bi limit'], format: 'Limit in PHP; 0 when not covered', example: '200000' },
  { key: 'propertyDamage', header: 'Property Damage', aliases: ['pd limit'], format: 'Limit in PHP; 0 when not covered', example: '200000' },
  { key: 'includeCtpl', header: 'Include CTPL', aliases: ['ctpl'], format: 'Yes or No', allowed: ['Yes', 'No'], example: 'Yes' },
];

export const scheduleOut = (r) => r && ({
  id: r.id, fleetNumber: r.fleet_number, clientId: r.client_id, clientName: r.client_name ?? null, clientCode: r.client_code ?? null,
  insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name ?? null, productId: r.product_id, channelId: r.channel_id,
  inceptionDate: r.inception_date, expiryDate: r.expiry_date, description: r.description, status: r.status, policyId: r.policy_id,
  policyNumber: r.policy_number ?? null, ownerUserId: r.owner_user_id, issuedAt: r.issued_at, createdAt: r.created_at,
  vehicles: r.vehicle_count ?? undefined, activeVehicles: r.active_count ?? undefined, sumInsured: r.total_si == null ? undefined : Number(r.total_si),
  grossPremium: r.total_gross == null ? undefined : Number(r.total_gross),
});
export const vehicleOut = (v) => ({
  id: Number(v.id), itemNo: v.item_no, plateNumber: v.plate_number, conductionSticker: v.conduction_sticker, chassisNumber: v.chassis_number,
  engineNumber: v.engine_number, make: v.make, model: v.model, yearModel: v.year_model, color: v.color, vehicleType: v.vehicle_type, usage: v.usage,
  mortgagee: v.mortgagee, sumInsured: Number(v.sum_insured), ownDamageRate: Number(v.own_damage_rate), actsOfNatureRate: Number(v.acts_of_nature_rate),
  bodilyInjury: Number(v.bodily_injury), propertyDamage: Number(v.property_damage), includeCtpl: v.include_ctpl, netPremium: Number(v.net_premium),
  taxes: Number(v.taxes), ctplPremium: Number(v.ctpl_premium), grossPremium: Number(v.gross_premium), status: v.status, coverFrom: v.cover_from,
  coverTo: v.cover_to, addedEndorsementId: v.added_endorsement_id, addedEndorsementNumber: v.added_endorsement_number ?? null,
  deletedEndorsementId: v.deleted_endorsement_id, deletedEndorsementNumber: v.deleted_endorsement_number ?? null,
  proratedPremium: v.prorated_premium == null ? null : Number(v.prorated_premium),
});

const SELECT = `SELECT f.*, c.display_name AS client_name, c.client_code, ic.name AS insurer_name, p.policy_number,
  (SELECT count(*)::int FROM fleet_vehicles v WHERE v.fleet_id = f.id) AS vehicle_count,
  (SELECT count(*)::int FROM fleet_vehicles v WHERE v.fleet_id = f.id AND v.status = 'active') AS active_count,
  (SELECT COALESCE(sum(v.sum_insured), 0) FROM fleet_vehicles v WHERE v.fleet_id = f.id AND v.status = 'active') AS total_si,
  (SELECT COALESCE(sum(v.gross_premium), 0) FROM fleet_vehicles v WHERE v.fleet_id = f.id AND v.status = 'active') AS total_gross
  FROM fleet_schedules f JOIN clients c ON c.id = f.client_id LEFT JOIN insurance_companies ic ON ic.id = f.insurance_company_id LEFT JOIN policies p ON p.id = f.policy_id`;
const VEHICLE_SELECT = `SELECT v.*, ea.endorsement_number AS added_endorsement_number, ed.endorsement_number AS deleted_endorsement_number FROM fleet_vehicles v
  LEFT JOIN endorsements ea ON ea.id = v.added_endorsement_id LEFT JOIN endorsements ed ON ed.id = v.deleted_endorsement_id`;

export async function listSchedules(q = {}) {
  const rows = await many(`${SELECT} WHERE ($1::text IS NULL OR f.status = $1) AND ($2::text IS NULL OR f.fleet_number ILIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $2 || '%'
    OR p.policy_number ILIKE '%' || $2 || '%') AND ($3::text IS NULL OR f.client_id = $3) ORDER BY f.created_at DESC LIMIT 500`, [q.status || null, q.search || null, q.clientId || null]);
  return rows.map(scheduleOut);
}

export async function getScheduleRow(id, db = { query }) {
  const r = (await db.query(`${SELECT} WHERE f.id = $1 OR f.fleet_number = $1 OR p.policy_number = $1`, [String(id)])).rows[0];
  if (!r) throw notFound('Fleet schedule not found');
  return r;
}

export async function getSchedule(id) {
  const r = await getScheduleRow(id);
  const vehicles = (await many(`${VEHICLE_SELECT} WHERE v.fleet_id = $1 ORDER BY v.item_no`, [r.id])).map(vehicleOut);
  const endorsements = r.policy_id ? await many(`SELECT e.id, e.endorsement_number AS "endorsementNumber", e.endorsement_type AS type, e.status, e.premium_delta AS "premiumDelta",
      e.effective_date AS "effectiveDate", e.remarks, e.created_at AS "createdAt" FROM endorsements e WHERE e.policy_id = $1 ORDER BY e.created_at DESC`, [r.policy_id]) : [];
  return { ...scheduleOut(r), vehicleList: vehicles, endorsements: endorsements.map((e) => ({ ...e, premiumDelta: Number(e.premiumDelta) })) };
}

export async function createSchedule(b, userId) {
  const client = await one('SELECT id FROM clients WHERE id = $1 OR client_code = $1', [String(b.clientId)]);
  if (!client) throw badRequest('Validation failed', [{ path: 'clientId', message: 'Client not found' }]);
  const from = isoDate(b.inceptionDate);
  const to = isoDate(b.expiryDate) || (from ? new Date(Date.UTC(Number(from.slice(0, 4)) + 1, Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)))).toISOString().slice(0, 10) : null);
  if (!from || !to || to <= from) throw badRequest('Validation failed', [{ path: 'expiryDate', message: 'The period must end after it starts' }]);
  const number = await nextDocumentNumber('fleet_schedule', { unique: { table: 'fleet_schedules', column: 'fleet_number' } });
  const r = await one(`INSERT INTO fleet_schedules(fleet_number, client_id, insurance_company_id, product_id, channel_id, inception_date, expiry_date, description, owner_user_id, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$9) RETURNING id`, [number, client.id, b.insuranceCompanyId || null, b.productId || null, b.channelId || null, from, to, b.description || null, userId]);
  return getSchedule(r.id);
}

export async function updateSchedule(id, b, userId) {
  const s = await getScheduleRow(id);
  if (s.status !== 'draft') throw conflict('An issued fleet schedule is changed by endorsement');
  const from = b.inceptionDate ? isoDate(b.inceptionDate) : s.inception_date;
  const to = b.expiryDate ? isoDate(b.expiryDate) : s.expiry_date;
  if (to <= from) throw badRequest('Validation failed', [{ path: 'expiryDate', message: 'The period must end after it starts' }]);
  await query(`UPDATE fleet_schedules SET insurance_company_id = COALESCE($2, insurance_company_id), product_id = COALESCE($3, product_id), channel_id = COALESCE($4, channel_id),
    inception_date = $5, expiry_date = $6, description = COALESCE($7, description), updated_by = $8, updated_at = now() WHERE id = $1`,
  [s.id, b.insuranceCompanyId || null, b.productId || null, b.channelId || null, from, to, b.description ?? null, userId]);
  return { before: scheduleOut(s), after: await getSchedule(s.id) };
}

const yes = (v) => v === true || ['yes', 'y', 'true', '1'].includes(String(v ?? '').trim().toLowerCase());

/** Priced vehicle columns: the annual premium of one vehicle with the quotation premium routine. */
export async function priceVehicle(v, { productId = null, insurerId = null } = {}) {
  const si = num(v.sumInsured);
  if (!(si > 0)) throw badRequest('Validation failed', [{ path: 'sumInsured', message: 'Sum insured must be greater than zero' }]);
  const includeCtpl = v.includeCtpl === undefined || v.includeCtpl === '' ? true : yes(v.includeCtpl);
  const b = await premiumBreakdown({ lob: 'MOTOR', productType: 'Motor', productId: productId || undefined, vehicleType: v.vehicleType || null, includeCTPL: includeCtpl,
    lossAndDamageCoverage: si, lossAndDamageCoverageRate: num(v.ownDamageRate), actsOfNatureRate: num(v.actsOfNatureRate),
    bodilyInjury: num(v.bodilyInjury) || undefined, propertyDamage: num(v.propertyDamage) || undefined, totalSumInsured: si }, { insurerId });
  const taxes = round2(b.valueAddedTax + b.documentaryStampTax + b.localGovernmentTax + b.fireServiceTax + b.accountPremiumOthers);
  return {
    sum_insured: si, own_damage_rate: num(v.ownDamageRate), acts_of_nature_rate: num(v.actsOfNatureRate), bodily_injury: num(v.bodilyInjury), property_damage: num(v.propertyDamage),
    include_ctpl: includeCtpl, vehicle_type: b.vehicleType || v.vehicleType || null, net_premium: b.netPremium, taxes, ctpl_premium: round2(b.ctplCoveragePremium || 0),
    gross_premium: b.grossPremium,
    breakdown: JSON.stringify({ netPremium: b.netPremium, valueAddedTax: b.valueAddedTax, documentaryStampTax: b.documentaryStampTax, localGovernmentTax: b.localGovernmentTax,
      fireServiceTax: b.fireServiceTax, others: b.accountPremiumOthers, ctpl: b.ctplCoveragePremium, commissionRate: b.commissionRate, commissionAmount: b.commissionAmount,
      ownDamagePremium: b.lossAndDamageCoveragePremium, actsOfNaturePremium: b.actsOfNaturePremium, bodilyInjuryPremium: b.bodilyInjuryCoveragePremium,
      propertyDamagePremium: b.propertyDamageCoveragePremium }),
  };
}

const identity = (v) => ({
  plate_number: v.plateNumber || null, conduction_sticker: v.conductionSticker || null, chassis_number: v.chassisNumber || null, engine_number: v.engineNumber || null,
  make: v.make || null, model: v.model || null, year_model: Number(v.yearModel) || null, color: v.color || null, usage: v.usage || null, mortgagee: v.mortgagee || null,
});

function identityErrors(v) {
  const e = [];
  if (!v.plateNumber && !v.conductionSticker && !v.chassisNumber) e.push('Plate Number, Conduction Sticker or Chassis Number is required');
  if (!v.make) e.push('Make is required');
  if (!v.model) e.push('Model is required');
  return e;
}

/** A vehicle already on the fleet (same plate or chassis, still active). */
async function duplicate(db, fleetId, v, exceptId = null) {
  const keys = [v.plateNumber, v.chassisNumber].filter(Boolean).map((x) => String(x).trim().toLowerCase());
  if (!keys.length) return null;
  return (await db.query(`SELECT item_no FROM fleet_vehicles WHERE fleet_id = $1 AND status = 'active' AND ($3::bigint IS NULL OR id <> $3)
    AND (lower(plate_number) = ANY($2) OR lower(chassis_number) = ANY($2)) LIMIT 1`, [fleetId, keys, exceptId])).rows[0] || null;
}

async function insertVehicle(db, s, v, userId, extra = {}) {
  const errors = identityErrors(v);
  if (errors.length) throw badRequest(errors.join('; '));
  const dup = await duplicate(db, s.id, v);
  if (dup) throw badRequest(`The vehicle is already item ${dup.item_no} of this fleet`);
  const priced = await priceVehicle(v, { productId: s.product_id, insurerId: s.insurance_company_id });
  const item = (await db.query('SELECT COALESCE(max(item_no), 0) + 1 AS n FROM fleet_vehicles WHERE fleet_id = $1', [s.id])).rows[0].n;
  const data = { fleet_id: s.id, item_no: item, ...identity(v), ...priced, cover_from: s.inception_date, cover_to: s.expiry_date, created_by: userId, ...extra };
  const keys = Object.keys(data);
  return (await db.query(`INSERT INTO fleet_vehicles(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(data))).rows[0];
}

/** Add a vehicle to a draft schedule. */
export async function addDraftVehicle(id, v, userId) {
  const s = await getScheduleRow(id);
  if (s.status !== 'draft') throw conflict('The schedule is issued: add the vehicle by endorsement');
  return vehicleOut(await withTransaction((db) => insertVehicle(db, s, v, userId)));
}

/** Change a vehicle of a draft schedule (re-priced). */
export async function updateDraftVehicle(id, vehicleId, v, userId) {
  const s = await getScheduleRow(id);
  if (s.status !== 'draft') throw conflict('The schedule is issued: vehicles change by endorsement');
  const cur = await one('SELECT * FROM fleet_vehicles WHERE id = $1 AND fleet_id = $2', [Number(vehicleId) || 0, s.id]);
  if (!cur) throw notFound('Vehicle not found');
  const merged = { ...vehicleOut(cur), ...v };
  const errors = identityErrors(merged);
  if (errors.length) throw badRequest(errors.join('; '));
  const dup = await duplicate({ query }, s.id, merged, cur.id);
  if (dup) throw badRequest(`The vehicle is already item ${dup.item_no} of this fleet`);
  const priced = await priceVehicle(merged, { productId: s.product_id, insurerId: s.insurance_company_id });
  const data = { ...identity(merged), ...priced, updated_at: new Date() };
  const keys = Object.keys(data);
  await query(`UPDATE fleet_vehicles SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [cur.id, ...Object.values(data)]);
  await query('UPDATE fleet_schedules SET updated_by = $2, updated_at = now() WHERE id = $1', [s.id, userId]);
  return vehicleOut(await one('SELECT * FROM fleet_vehicles WHERE id = $1', [cur.id]));
}

export async function removeDraftVehicle(id, vehicleId) {
  const s = await getScheduleRow(id);
  if (s.status !== 'draft') throw conflict('The schedule is issued: delete the vehicle by endorsement');
  const r = await query('DELETE FROM fleet_vehicles WHERE id = $1 AND fleet_id = $2', [Number(vehicleId) || 0, s.id]);
  if (!r.rowCount) throw notFound('Vehicle not found');
  // keep the item numbers continuous on a draft
  await query(`UPDATE fleet_vehicles v SET item_no = x.n FROM (SELECT id, row_number() OVER (ORDER BY item_no) AS n FROM fleet_vehicles WHERE fleet_id = $1) x
    WHERE v.id = x.id AND v.item_no <> x.n`, [s.id]);
  return { removed: true };
}

/** Upload vehicles to a draft schedule (each row on its own; the failed rows are listed). */
export async function uploadVehicles(id, rows, userId) {
  const s = await getScheduleRow(id);
  if (s.status !== 'draft') throw conflict('The schedule is issued: add vehicles by endorsement');
  const max = Number(await getSetting('fleet.max_upload_rows', 1000));
  if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; at most ${max} vehicles can be uploaded at once (fleet.max_upload_rows)`);
  let created = 0;
  const errors = [];
  for (const [i, row] of rows.entries()) {
    const v = mapColumns(row, FLEET_VEHICLE_COLUMNS);
    for (const k of ['sumInsured', 'bodilyInjury', 'propertyDamage']) if (v[k] !== undefined) v[k] = String(v[k]).replace(/,/g, '');
    try {
      await withTransaction((db) => insertVehicle(db, s, v, userId));
      created += 1;
    } catch (e) {
      errors.push({ row: i + 2, message: e.details?.map?.((d) => d.message).join('; ') || e.message });
    }
  }
  return { total: rows.length, created, failed: errors.length, errors };
}

/** Issue the schedule: one policy for the totals of its vehicles. */
export async function issueSchedule(id, user) {
  const s = await getScheduleRow(id);
  if (s.status !== 'draft') throw conflict(`Fleet schedule ${s.fleet_number} is ${s.status}`);
  if (!s.insurance_company_id) throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: 'Choose the insurer before issuing' }]);
  const vehicles = await many("SELECT * FROM fleet_vehicles WHERE fleet_id = $1 AND status = 'active' ORDER BY item_no", [s.id]);
  const min = Number(await getSetting('fleet.minimum_vehicles', 2));
  if (vehicles.length < min) throw badRequest(`A fleet schedule needs at least ${min} vehicles (fleet.minimum_vehicles)`);
  const sum = (k) => round2(vehicles.reduce((t, v) => t + num(v[k]), 0));
  const bsum = (k) => round2(vehicles.reduce((t, v) => t + num(v.breakdown?.[k]), 0));
  const gross = sum('gross_premium');
  const net = sum('net_premium');
  const commission = bsum('commissionAmount');
  const rate = net ? round2((commission / net) * 10000) / 10000 : 0;
  return withTransaction(async (db) => {
    const locked = (await db.query('SELECT status FROM fleet_schedules WHERE id = $1 FOR UPDATE', [s.id])).rows[0];
    if (locked.status !== 'draft') throw conflict('The schedule was issued by another request');
    const productId = s.product_id || (await db.query("SELECT id FROM products WHERE upper(code) = 'MOTOR' LIMIT 1")).rows[0]?.id || null;
    const issued = await issuePolicy(db, {
      clientId: s.client_id, productId, insuranceCompanyId: s.insurance_company_id, ownerUserId: s.owner_user_id || user.id, agentUserId: s.owner_user_id || user.id,
      sumInsured: sum('sum_insured'), netPremium: net, grossPremium: gross, commissionAmount: commission, commissionRate: rate, currency: await baseCurrency(),
      insuredName: s.client_name, productType: 'Motor', lob: 'MOTOR', taxes: sum('taxes'),
      doc: { source: 'fleet', fleetId: s.id, fleetNumber: s.fleet_number, isFleet: true, vehicleCount: vehicles.length, channelId: s.channel_id || undefined,
        valueAddedTax: bsum('valueAddedTax'), documentaryStampTax: bsum('documentaryStampTax'), localGovernmentTax: bsum('localGovernmentTax'), ctplCoveragePremium: sum('ctpl_premium'),
        accountPremiumOthers: bsum('others') },
    }, { inception: s.inception_date, expiry: s.expiry_date }, user.id);
    await db.query("UPDATE fleet_schedules SET status = 'issued', policy_id = $2, issued_at = now(), issued_by = $3, updated_at = now() WHERE id = $1", [s.id, issued.policyId, user.id]);
    return { policyId: issued.policyId, billNumber: issued.receivable?.bill_number || null, grossPremium: gross, vehicles: vehicles.length };
  });
}

/** Days left from a date to the expiry, and the pro-rata factor of fleet.pro_rata_basis. */
export async function proRata(s, date) {
  const d = Date.parse(`${date}T00:00:00Z`);
  const from = Date.parse(`${s.inception_date}T00:00:00Z`);
  const to = Date.parse(`${s.expiry_date}T00:00:00Z`);
  if (d < from || d >= to) throw badRequest(`The effective date must fall within the policy period (${s.inception_date} to ${s.expiry_date})`);
  const left = Math.round((to - d) / 86400000);
  const basis = await getSetting('fleet.pro_rata_basis', 'days_in_period');
  const days = basis === 'days_365' ? 365 : Math.round((to - from) / 86400000);
  return { daysLeft: left, daysBasis: days, factor: Math.min(1, left / days) };
}

/** The premium change of a vehicle pro-rata, with its parts (endorsement premiumChange.delta). */
function proratedDelta(v, factor, sign) {
  const b = typeof v.breakdown === 'string' ? JSON.parse(v.breakdown) : (v.breakdown || {});
  const p = (x) => round2(num(x) * factor) * sign;
  const delta = { netPremium: p(b.netPremium), valueAddedTax: p(b.valueAddedTax), documentaryStampTax: p(b.documentaryStampTax), localGovernmentTax: p(b.localGovernmentTax) };
  const ctpl = p(b.ctpl);
  const others = p(num(b.others) + num(b.fireServiceTax));
  delta.grossPremium = round2(delta.netPremium + delta.valueAddedTax + delta.documentaryStampTax + delta.localGovernmentTax + ctpl + others);
  return delta;
}

/** Raise and complete the endorsement of a vehicle change on the issued policy (bill or return premium). */
async function endorse(s, { delta, remarks, type, effectiveDate, userId, change, afterComplete = null }) {
  const e = await createEndorsement({ policyId: s.policy_id, premiumDelta: delta.grossPremium, effectiveDate, remarks,
    premiumChange: { changed: true, delta }, fleetChange: change }, userId);
  await query('UPDATE endorsements SET endorsement_type = $2 WHERE id = $1', [e.id, type]);
  await completeEndorsement({ endorsementId: e.id, issuedDate: effectiveDate <= (await today()) ? effectiveDate : null, notes: remarks }, userId);
  if (afterComplete) await afterComplete(e);
  // the policy's net premium and sum insured follow the schedule (the endorsement routine moves the gross premium)
  await query(`UPDATE policies p SET net_premium = round(p.net_premium + $2::numeric, 2),
    sum_insured = (SELECT COALESCE(sum(v.sum_insured), 0) FROM fleet_vehicles v WHERE v.fleet_id = $3 AND v.status = 'active'),
    doc = p.doc || jsonb_build_object('vehicleCount', (SELECT count(*) FROM fleet_vehicles v WHERE v.fleet_id = $3 AND v.status = 'active')) WHERE p.id = $1`,
  [s.policy_id, delta.netPremium, s.id]);
  return one('SELECT id, endorsement_number, premium_delta, status, receivable_id FROM endorsements WHERE id = $1', [e.id]);
}

/** Add a vehicle to an issued fleet by endorsement: pro-rata additional premium billed. */
export async function endorseAddVehicle(id, v, { effectiveDate, userId }) {
  const s = await getScheduleRow(id);
  if (s.status !== 'issued') throw conflict('Add vehicles to a draft schedule directly; an issued one by endorsement');
  const date = isoDate(effectiveDate) || (await today());
  const pr = await proRata(s, date);
  // the vehicle row first (inside a transaction), so a vehicle that cannot be priced raises no endorsement
  const row = await withTransaction((db) => insertVehicle(db, s, v, userId, { cover_from: date }));
  try {
    const delta = proratedDelta(row, pr.factor, 1);
    const e = await endorse(s, { delta, effectiveDate: date, userId, type: 'Fleet: add vehicle',
      remarks: `Add item ${row.item_no} ${[row.make, row.model].filter(Boolean).join(' ')} ${row.plate_number || row.chassis_number || ''} from ${date} (${pr.daysLeft}/${pr.daysBasis} days)`.trim(),
      change: { action: 'add', vehicleId: Number(row.id), itemNo: row.item_no, annualPremium: Number(row.gross_premium), factor: pr.factor } });
    await query('UPDATE fleet_vehicles SET added_endorsement_id = $2, prorated_premium = $3 WHERE id = $1', [row.id, e.id, delta.grossPremium]);
    return { vehicle: vehicleOut({ ...row, added_endorsement_id: e.id, prorated_premium: delta.grossPremium }), endorsementId: e.id, endorsementNumber: e.endorsement_number,
      premium: delta.grossPremium, daysLeft: pr.daysLeft, factor: pr.factor };
  } catch (err) {
    await query('DELETE FROM fleet_vehicles WHERE id = $1 AND added_endorsement_id IS NULL', [row.id]);
    throw err;
  }
}

/** Delete a vehicle from an issued fleet by endorsement: pro-rata return premium credited (fleet.return_premium_on_delete). */
export async function endorseDeleteVehicle(id, vehicleId, { effectiveDate, reason, userId }) {
  const s = await getScheduleRow(id);
  if (s.status !== 'issued') throw conflict('Remove vehicles from a draft schedule directly; an issued one by endorsement');
  const v = await one("SELECT * FROM fleet_vehicles WHERE id = $1 AND fleet_id = $2 AND status = 'active'", [Number(vehicleId) || 0, s.id]);
  if (!v) throw notFound('Active vehicle not found on this fleet');
  const active = (await one("SELECT count(*)::int AS n FROM fleet_vehicles WHERE fleet_id = $1 AND status = 'active'", [s.id])).n;
  if (active <= 1) throw conflict('The last vehicle of a fleet cannot be deleted: cancel the policy instead');
  const date = isoDate(effectiveDate) || (await today());
  const pr = await proRata(s, date < v.cover_from ? v.cover_from : date);
  const refund = (await getSetting('fleet.return_premium_on_delete', true)) !== false;
  // a vehicle added mid-term returns the premium of the days it will not be on cover, from its own pro-rata premium
  const factor = refund ? pr.factor : 0;
  const delta = proratedDelta(v, factor, -1);
  const e = await endorse(s, { delta, effectiveDate: date, userId, type: 'Fleet: delete vehicle',
    remarks: `Delete item ${v.item_no} ${[v.make, v.model].filter(Boolean).join(' ')} ${v.plate_number || v.chassis_number || ''} from ${date}${reason ? `: ${reason}` : ''}`.trim(),
    change: { action: 'delete', vehicleId: Number(v.id), itemNo: v.item_no, annualPremium: Number(v.gross_premium), factor },
    afterComplete: (en) => query("UPDATE fleet_vehicles SET status = 'deleted', cover_to = $2, deleted_endorsement_id = $3, prorated_premium = $4, updated_at = now() WHERE id = $1",
      [v.id, date, en.id, delta.grossPremium]) });
  return { endorsementId: e.id, endorsementNumber: e.endorsement_number, premium: delta.grossPremium, daysLeft: pr.daysLeft, factor };
}

/** Rows of the schedule of vehicles (print and Excel). */
export async function scheduleRows(id) {
  const s = await getScheduleRow(id);
  const vehicles = (await many(`${VEHICLE_SELECT} WHERE v.fleet_id = $1 ORDER BY v.item_no`, [s.id])).map(vehicleOut);
  return { schedule: s, vehicles };
}
