/**
 * Motor claim repairs (Operations > Motor Claim Repairs).
 *
 * The repair shop (master repair-shop, accredited shops) sends an estimate; the claims officer records it and then the
 * decision of the insurer's adjuster (approved amount, adjuster, date, the insurer's reference). Work found during the
 * repair comes as a supplementary estimate, decided the same way. Approved estimates are covered by a letter of
 * authority (LOA) to the shop: approved repair cost, the insured's participation (deductible, motor_claims.participation:
 * fixed amount and / or percent of the sum insured), depreciation on parts (motor_claims.parts_depreciation_percent),
 * what the insurer pays and what the insured settles with the shop. The release of the repaired vehicle closes the
 * repair. Each step is written to the claim history.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { activeRecord, activeRecords } from '../ops-masters/records.js';

const CLOSED = ['rejected', 'closed'];

async function loadClaim(db, ref, lock = false) {
  const c = (await db.query(`SELECT c.*, p.policy_number, p.sum_insured, p.lob AS policy_lob, p.doc AS policy_doc, p.insured_name, pr.line AS product_line,
      cl.display_name AS client_name, ic.name AS insurer_name
    FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE c.id = $1 OR c.claim_number = $1 ${lock ? 'FOR UPDATE OF c' : ''}`, [String(ref)])).rows[0];
  if (!c) throw notFound('Claim not found');
  return c;
}
const isMotor = (c) => [c.lob, c.policy_lob, c.product_line].some((v) => String(v || '').toUpperCase().includes('MOTOR'));
const history = (db, claimId, user, status, note) => db.query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1,$2,$3,$4)', [claimId, user?.username ?? null, status, note]);

const vehicleOf = (c) => {
  const v = c.policy_doc?.insuranceVehicleDetails || c.policy_doc?.vehicle || {};
  return [v.brand || v.make || c.policy_doc?.vehicleBrand, v.model || c.policy_doc?.vehicleModel, v.year || v.yearModel || c.policy_doc?.yearModel,
    v.plateNo || v.plateNumber || c.policy_doc?.plateNumber ? `plate ${v.plateNo || v.plateNumber || c.policy_doc?.plateNumber}` : null].filter(Boolean).join(' ');
};

const estimateOut = (e) => ({ id: e.id, kind: e.kind, seq: e.seq, repairShopCode: e.repair_shop_code, repairShopName: e.repair_shop_name, shopReference: e.shop_reference,
  estimateDate: isoDate(e.estimate_date), parts: Number(e.parts), labour: Number(e.labour), paint: Number(e.paint), other: Number(e.other), vat: Number(e.vat), total: Number(e.total),
  status: e.status, adjusterName: e.adjuster_name, adjusterCompany: e.adjuster_company, approvedAmount: e.approved_amount === null ? null : Number(e.approved_amount),
  decidedOn: isoDate(e.decided_on), approvalReference: e.approval_reference, decisionRemarks: e.decision_remarks, createdAt: e.created_at });
const loaOut = (l) => ({ id: l.id, loaNumber: l.loa_number, kind: l.kind, repairShopCode: l.repair_shop_code, repairShopName: l.repair_shop_name, estimateIds: l.estimate_ids,
  approvedRepairCost: Number(l.approved_repair_cost), participation: Number(l.participation), depreciation: Number(l.depreciation), payableByInsurer: Number(l.payable_by_insurer),
  payableByInsured: Number(l.payable_by_insured), issuedOn: isoDate(l.issued_on), validUntil: isoDate(l.valid_until), status: l.status, remarks: l.remarks, createdAt: l.created_at,
  cancelReason: l.cancel_reason });
const releaseOut = (r) => ({ id: Number(r.id), loaId: r.loa_id, repairCompletedOn: isoDate(r.repair_completed_on), releasedOn: isoDate(r.released_on), releasedTo: r.released_to,
  participationCollected: Number(r.participation_collected), odometer: r.odometer, remarks: r.remarks, createdAt: r.created_at });

/** Participation (deductible) of the insured from motor_claims.participation and the sum insured. */
export async function participationFor(sumInsured) {
  const p = (await getSetting('motor_claims.participation', { fixed: 2000, percentOfSumInsured: 0.5, rule: 'higher' })) || {};
  const fixed = num(p.fixed);
  const pct = round2((num(sumInsured) * num(p.percentOfSumInsured)) / 100);
  if (p.rule === 'fixed') return fixed;
  if (p.rule === 'percent') return pct;
  if (p.rule === 'lower') return round2(Math.min(fixed || pct, pct || fixed));
  return round2(Math.max(fixed, pct));
}

/** Everything about the repair of a motor claim. */
export async function repairFile(db, ref) {
  const c = await loadClaim(db, ref);
  const estimates = (await db.query('SELECT * FROM claim_repair_estimates WHERE claim_id = $1 ORDER BY seq', [c.id])).rows.map(estimateOut);
  const loas = (await db.query('SELECT * FROM claim_loas WHERE claim_id = $1 ORDER BY created_at', [c.id])).rows.map(loaOut);
  const releases = (await db.query('SELECT * FROM claim_vehicle_releases WHERE claim_id = $1 ORDER BY released_on', [c.id])).rows.map(releaseOut);
  const covered = new Set(loas.filter((l) => l.status === 'issued').flatMap((l) => l.estimateIds));
  return {
    claimId: c.id, claimNumber: c.claim_number, policyNumber: c.policy_number, status: c.status, claimType: c.claim_type, insuredName: c.insured_name || c.client_name,
    insurerName: c.insurer_name, vehicle: vehicleOf(c), sumInsured: Number(c.sum_insured), motor: isMotor(c),
    defaultParticipation: await participationFor(c.sum_insured), partsDepreciationPercent: num(await getSetting('motor_claims.parts_depreciation_percent', 0)),
    estimates, loas, releases,
    readyForLoa: estimates.filter((e) => e.status === 'approved' && !covered.has(e.id)).map((e) => e.id),
    summary: { estimated: round2(estimates.filter((e) => e.status !== 'rejected').reduce((s, e) => s + e.total, 0)),
      approved: round2(estimates.filter((e) => e.status === 'approved').reduce((s, e) => s + (e.approvedAmount || 0), 0)),
      payableByInsurer: round2(loas.filter((l) => l.status === 'issued').reduce((s, l) => s + l.payableByInsurer, 0)), released: releases.length > 0 },
  };
}

/** Motor claims with a repair in progress or to start (search, stage). */
export async function listRepairs(db, q = {}) {
  const params = [];
  let filter = '';
  if (q.search) { params.push(`%${q.search}%`); filter = ' AND (c.claim_number ILIKE $1 OR p.policy_number ILIKE $1 OR cl.display_name ILIKE $1)'; }
  const rows = (await db.query(`SELECT c.id, c.claim_number, c.status, c.claim_type, p.policy_number, COALESCE(p.insured_name, cl.display_name) AS insured,
      (SELECT count(*)::int FROM claim_repair_estimates e WHERE e.claim_id = c.id) AS estimates,
      (SELECT count(*)::int FROM claim_repair_estimates e WHERE e.claim_id = c.id AND e.status = 'submitted') AS pending,
      (SELECT COALESCE(sum(e.approved_amount), 0) FROM claim_repair_estimates e WHERE e.claim_id = c.id AND e.status = 'approved') AS approved,
      (SELECT string_agg(l.loa_number, ', ') FROM claim_loas l WHERE l.claim_id = c.id AND l.status = 'issued') AS loas,
      EXISTS (SELECT 1 FROM claim_vehicle_releases r WHERE r.claim_id = c.id) AS released
    FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    WHERE (upper(COALESCE(c.lob, '')) LIKE '%MOTOR%' OR upper(COALESCE(p.lob, '')) LIKE '%MOTOR%' OR upper(COALESCE(pr.line, '')) LIKE '%MOTOR%') AND c.status <> 'rejected'${filter}
    ORDER BY c.created_at DESC LIMIT 500`, params)).rows;
  const stageOf = (r) => (r.released ? 'released' : r.loas ? 'in-repair' : r.pending ? 'awaiting-approval' : r.estimates ? 'approved' : 'no-estimate');
  const out = rows.map((r) => ({ claimId: r.id, claimNumber: r.claim_number, status: r.status, claimType: r.claim_type, policyNumber: r.policy_number, insured: r.insured,
    estimates: r.estimates, pendingEstimates: r.pending, approvedAmount: Number(r.approved), loaNumbers: r.loas || null, released: r.released, stage: stageOf(r) }));
  return q.stage && q.stage !== 'all' ? out.filter((r) => r.stage === q.stage) : out;
}

export const repairShops = async (db) => (await activeRecords(db, 'repair-shop')).map((s) => ({ code: s.code, name: s.name, city: s.city || null, accredited: s.accredited !== false,
  contactPerson: s.contactPerson || null, phone: s.phone || null, email: s.email || null, accreditedInsurers: s.accreditedInsurers || null }));

/** Record a repair estimate from a shop: initial, or supplementary once an estimate of the claim is approved. */
export async function addEstimate(db, ref, b, user) {
  const c = await loadClaim(db, ref, true);
  if (!isMotor(c)) throw conflict(`Claim ${c.claim_number} is not a motor claim`);
  if (CLOSED.includes(c.status)) throw conflict(`Claim ${c.claim_number} is ${c.status}`);
  const shop = await activeRecord(db, 'repair-shop', b.repairShopCode);
  if (!shop) throw badRequest('Validation failed', [{ path: 'repairShopCode', message: 'Choose an active repair shop of the Repair Shop master' }]);
  if (shop.accredited === false) throw conflict(`${shop.name} is not an accredited repair shop`);
  const parts = { parts: round2(b.parts || 0), labour: round2(b.labour || 0), paint: round2(b.paint || 0), other: round2(b.other || 0), vat: round2(b.vat || 0) };
  const total = round2(parts.parts + parts.labour + parts.paint + parts.other + parts.vat);
  if (!(total > 0)) throw badRequest('Validation failed', [{ path: 'parts', message: 'The estimate has no amount' }]);
  const prior = (await db.query('SELECT status FROM claim_repair_estimates WHERE claim_id = $1', [c.id])).rows;
  if (prior.some((e) => e.status === 'submitted')) throw conflict('An estimate of this claim is still waiting for the adjuster\'s decision');
  const kind = prior.some((e) => e.status === 'approved') ? 'supplementary' : 'initial';
  const seq = prior.length + 1;
  const r = (await db.query(`INSERT INTO claim_repair_estimates(claim_id, kind, seq, repair_shop_code, repair_shop_name, shop_reference, estimate_date, parts, labour, paint, other, vat, total, recorded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [c.id, kind, seq, shop.code, shop.name, b.shopReference || null, isoDate(b.estimateDate) || (await today()),
    parts.parts, parts.labour, parts.paint, parts.other, parts.vat, total, user?.id ?? null])).rows[0];
  await history(db, c.id, user, c.status, `${kind === 'initial' ? 'Repair' : 'Supplementary'} estimate ${seq} of ${shop.name}: ${total.toFixed(2)}`);
  return estimateOut(r);
}

/** Record the adjuster's decision on an estimate: approve (approvedAmount, at most the estimate) or reject. */
export async function decideEstimate(db, ref, estimateId, b, user) {
  const c = await loadClaim(db, ref, true);
  const e = (await db.query('SELECT * FROM claim_repair_estimates WHERE id = $1 AND claim_id = $2 FOR UPDATE', [estimateId, c.id])).rows[0];
  if (!e) throw notFound('Estimate not found');
  if (e.status !== 'submitted') throw conflict(`Estimate ${e.seq} is already ${e.status}`);
  if (!String(b.adjusterName || '').trim()) throw badRequest('Validation failed', [{ path: 'adjusterName', message: 'Record the adjuster who decided' }]);
  const approve = b.decision === 'approve';
  const amount = approve ? round2(b.approvedAmount ?? e.total) : null;
  if (approve && (!(amount > 0) || amount > Number(e.total) + 0.005)) throw badRequest('Validation failed', [{ path: 'approvedAmount', message: `The approved amount must be more than zero and at most the estimate (${Number(e.total).toFixed(2)})` }]);
  if (!approve && !String(b.remarks || '').trim()) throw badRequest('Validation failed', [{ path: 'remarks', message: 'Give the adjuster\'s reason for rejecting the estimate' }]);
  const r = (await db.query(`UPDATE claim_repair_estimates SET status = $3, approved_amount = $4, adjuster_name = $5, adjuster_company = $6, decided_on = $7, approval_reference = $8,
      decision_remarks = $9, decision_recorded_by = $10, updated_at = now() WHERE id = $1 AND claim_id = $2 RETURNING *`,
  [e.id, c.id, approve ? 'approved' : 'rejected', amount, b.adjusterName.trim(), b.adjusterCompany || null, isoDate(b.decidedOn) || (await today()), b.approvalReference || null,
    b.remarks || null, user?.id ?? null])).rows[0];
  await history(db, c.id, user, c.status, `Estimate ${e.seq} ${approve ? `approved at ${amount.toFixed(2)}` : 'rejected'} by adjuster ${b.adjusterName.trim()}${b.approvalReference ? ` (${b.approvalReference})` : ''}`);
  return estimateOut(r);
}

/** Issue the letter of authority to the shop for the approved estimates not yet covered by one. */
export async function issueLoa(db, ref, b, user) {
  const c = await loadClaim(db, ref, true);
  if (CLOSED.includes(c.status)) throw conflict(`Claim ${c.claim_number} is ${c.status}`);
  const file = await repairFile(db, c.id);
  const ids = Array.isArray(b.estimateIds) && b.estimateIds.length ? b.estimateIds : file.readyForLoa;
  const chosen = file.estimates.filter((e) => ids.includes(e.id));
  if (!chosen.length) throw conflict('No approved estimate is waiting for a letter of authority');
  if (chosen.some((e) => !file.readyForLoa.includes(e.id))) throw conflict('Only approved estimates not yet on a letter of authority can be covered');
  if (new Set(chosen.map((e) => e.repairShopCode)).size > 1) throw conflict('A letter of authority covers the estimates of one repair shop');
  const original = !file.loas.some((l) => l.status === 'issued');
  const cost = round2(chosen.reduce((s, e) => s + e.approvedAmount, 0));
  const participation = round2(b.participation ?? (original ? file.defaultParticipation : 0));
  const partsShare = chosen.reduce((s, e) => s + (e.total > 0 ? (e.approvedAmount * e.parts) / e.total : 0), 0);
  const depreciation = round2(b.depreciation ?? (partsShare * file.partsDepreciationPercent) / 100);
  if (participation < 0 || depreciation < 0 || participation + depreciation > cost + 0.005) throw badRequest('Validation failed', [{ path: 'participation', message: 'Participation and depreciation cannot exceed the approved repair cost' }]);
  const insured = round2(participation + depreciation);
  const number = await nextDocumentNumber('claim_loa', { db, unique: { table: 'claim_loas', column: 'loa_number' } });
  const issuedOn = await today();
  const validUntil = isoDate(b.validUntil) || addDays(issuedOn, Number(await getSetting('motor_claims.loa_validity_days', 30)) || 30);
  const r = (await db.query(`INSERT INTO claim_loas(loa_number, claim_id, kind, repair_shop_code, repair_shop_name, estimate_ids, approved_repair_cost, participation, depreciation,
      payable_by_insurer, payable_by_insured, issued_on, valid_until, remarks, issued_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
  [number, c.id, original ? 'original' : 'supplementary', chosen[0].repairShopCode, chosen[0].repairShopName, chosen.map((e) => e.id), cost, participation, depreciation,
    round2(cost - insured), insured, issuedOn, validUntil, b.remarks || null, user?.id ?? null])).rows[0];
  await history(db, c.id, user, c.status, `Letter of authority ${number} to ${chosen[0].repairShopName}: repair ${cost.toFixed(2)}, insurer pays ${round2(cost - insured).toFixed(2)}, insured ${insured.toFixed(2)}`);
  return loaOut(r);
}

export async function cancelLoa(db, ref, loaId, reason, user) {
  const c = await loadClaim(db, ref, true);
  const l = (await db.query('SELECT * FROM claim_loas WHERE id = $1 AND claim_id = $2 FOR UPDATE', [loaId, c.id])).rows[0];
  if (!l) throw notFound('Letter of authority not found');
  if (l.status !== 'issued') throw conflict(`Letter of authority ${l.loa_number} is ${l.status}`);
  if ((await db.query('SELECT 1 FROM claim_vehicle_releases WHERE loa_id = $1', [l.id])).rowCount) throw conflict('The vehicle was already released under this letter of authority');
  const r = (await db.query('UPDATE claim_loas SET status = \'cancelled\', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3 WHERE id = $1 RETURNING *', [l.id, user?.id ?? null, reason])).rows[0];
  await history(db, c.id, user, c.status, `Letter of authority ${l.loa_number} cancelled: ${reason}`);
  return loaOut(r);
}

/** Release of the repaired vehicle to the insured. */
export async function releaseVehicle(db, ref, b, user) {
  const c = await loadClaim(db, ref, true);
  const loas = (await db.query('SELECT * FROM claim_loas WHERE claim_id = $1 AND status = \'issued\' ORDER BY created_at', [c.id])).rows;
  if (!loas.length) throw conflict('Issue the letter of authority before releasing the vehicle');
  const loa = b.loaId ? loas.find((l) => l.id === b.loaId) : loas.at(-1);
  if (!loa) throw notFound('Letter of authority not found');
  if (!String(b.releasedTo || '').trim()) throw badRequest('Validation failed', [{ path: 'releasedTo', message: 'Who took the vehicle back?' }]);
  if ((await db.query('SELECT 1 FROM claim_vehicle_releases WHERE claim_id = $1 AND loa_id = $2', [c.id, loa.id])).rowCount) throw conflict(`The vehicle was already released under ${loa.loa_number}`);
  const r = (await db.query(`INSERT INTO claim_vehicle_releases(claim_id, loa_id, repair_completed_on, released_on, released_to, participation_collected, odometer, remarks, recorded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [c.id, loa.id, isoDate(b.repairCompletedOn) || null, isoDate(b.releasedOn) || (await today()), b.releasedTo.trim(),
    round2(b.participationCollected ?? loa.payable_by_insured), b.odometer || null, b.remarks || null, user?.id ?? null])).rows[0];
  await history(db, c.id, user, c.status, `Vehicle released to ${b.releasedTo.trim()} (${loa.loa_number})`);
  return releaseOut(r);
}
