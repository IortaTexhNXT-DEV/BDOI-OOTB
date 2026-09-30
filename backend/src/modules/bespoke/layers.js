/**
 * Layered co-insurance ledger of a placement or policy: primary and excess layers (limit, attachment point, layer
 * premium) with their own participants and shares (total 100% per layer, one lead per layer); premium, taxes and
 * commission allocated per participant per layer to the cent; the consolidated share of each insurer (by premium)
 * written to risk_participants so the existing co-insurance booking and remittance keep working; remittance and
 * insurer statement reconciliation per participant; claim reserve, payments and recoveries split per layer and
 * participant.
 *
 * A risk without layers is read as one layer (limit = sum insured) with its risk_participants shares, so the claim
 * split and the participant views work for every co-insured policy.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { allocate, policyParticipants } from '../accounting/lib/coinsurance.js';
import { insurerId as resolveInsurer } from '../policies/service.js';
import { writeParticipants } from '../placement/participants.js';

export const ENTITY_TYPES = ['placement', 'policy'];
const DAY = 86400000;

/** Totals and state of the placement or policy the layers belong to. */
export async function entityInfo(type, ref, db = null) {
  const c = db || { query };
  if (!ENTITY_TYPES.includes(type)) throw badRequest('Layers belong to a placement or a policy');
  if (type === 'placement') {
    const p = (await c.query(`SELECT p.*, COALESCE(cl.display_name, p.insured_name) AS insured FROM placements p LEFT JOIN clients cl ON cl.id = p.client_id
      WHERE p.id = $1 OR p.placement_number = $1`, [String(ref)])).rows[0];
    if (!p) throw notFound('Placement slip not found');
    const editable = ((await getSetting('placement.editable_statuses', ['draft', 'declined'])) || []).includes(p.status);
    return { type, id: p.id, number: p.placement_number, insured: p.insured, lob: p.lob, currency: p.currency, status: p.status, editable, sumInsured: Number(p.sum_insured),
      premium: Number(p.premium_base), taxes: round2(num(p.vat) + num(p.dst) + num(p.lgt) + num(p.fst)), premiumTotal: Number(p.premium_total),
      commissionRate: p.commission_rate === null ? null : Number(p.commission_rate), commission: Number(p.commission_amount), policyId: p.policy_id || null, placementId: p.id };
  }
  const p = (await c.query(`SELECT p.*, cl.display_name AS insured, pr.line AS lob FROM policies p LEFT JOIN clients cl ON cl.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE p.id = $1 OR p.policy_number = $1`, [String(ref)])).rows[0];
  if (!p) throw notFound('Policy not found');
  const billed = (await c.query("SELECT 1 FROM receivables WHERE policy_id = $1 AND status <> 'cancelled' LIMIT 1", [p.id])).rowCount > 0;
  const premium = Number(p.net_premium) || Number(p.premium_total);
  return { type, id: p.id, number: p.policy_number, insured: p.insured, lob: p.lob ? String(p.lob).toUpperCase() : null, currency: p.currency, status: p.status, editable: !billed, billed,
    sumInsured: Number(p.sum_insured), premium, taxes: round2(Math.max(0, Number(p.premium_total) - premium)), premiumTotal: Number(p.premium_total),
    commissionRate: null, commission: Number(p.commission_amount), policyId: p.id, placementId: p.placement_id || null };
}

const layerOut = (l, parts) => ({
  layerId: Number(l.id), layerNo: l.layer_no, name: l.name, layerType: l.layer_type, limit: Number(l.limit_amount), attachmentPoint: Number(l.attachment_point),
  exhaustionPoint: round2(Number(l.attachment_point) + Number(l.limit_amount)), premium: Number(l.premium), taxes: Number(l.taxes), premiumTotal: Number(l.premium_total),
  commissionAmount: Number(l.commission_amount), remarks: l.remarks,
  participants: parts.map((p) => ({ participantId: Number(p.id), insuranceCompanyId: p.insurance_company_id, insuranceCompanyName: p.insurer_name, isLead: p.is_lead, sharePercent: Number(p.share_percent),
    premium: Number(p.premium), taxes: Number(p.taxes), premiumTotal: Number(p.premium_total), commissionRate: p.commission_rate === null ? null : Number(p.commission_rate),
    commissionAmount: Number(p.commission_amount), netDue: Number(p.net_due), insurerReference: p.insurer_reference })),
  shareTotal: round2(parts.reduce((s, p) => s + Number(p.share_percent), 0)),
});

async function storedLayers(type, id, db = null) {
  const c = db || { query };
  const layers = (await c.query('SELECT * FROM risk_layers WHERE entity_type = $1 AND entity_id = $2 ORDER BY layer_no', [type, String(id)])).rows;
  if (!layers.length) return [];
  const parts = (await c.query(`SELECT p.*, ic.name AS insurer_name FROM risk_layer_participants p JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE p.layer_id = ANY($1) ORDER BY p.is_lead DESC, p.share_percent DESC, p.id`, [layers.map((l) => l.id)])).rows;
  return layers.map((l) => layerOut(l, parts.filter((p) => p.layer_id === l.id)));
}

/**
 * Layers that apply to an entity: its own, else (a policy) those of the placement it was issued from, else one layer
 * built from its co-insurance participants. `source` says which.
 */
export async function layersFor(type, ref, db = null) {
  const info = await entityInfo(type, ref, db);
  let layers = await storedLayers(info.type, info.id, db);
  let source = 'own';
  if (!layers.length && info.type === 'policy' && info.placementId) {
    layers = await storedLayers('placement', info.placementId, db);
    source = 'placement';
  }
  if (!layers.length) {
    source = 'participants';
    let parts = [];
    if (info.type === 'policy') {
      parts = (await policyParticipants(info.id, db || { query })).map((p) => ({ insuranceCompanyId: p.insurerId, insuranceCompanyName: p.insurerName, isLead: p.isLead, sharePercent: p.share,
        premium: p.premium, taxes: p.taxes, premiumTotal: p.premiumTotal, commissionRate: p.commissionRate, commissionAmount: p.commissionAmount, netDue: round2(p.premiumTotal - p.commissionAmount) }));
    } else {
      parts = (await (db || { query }).query(`SELECT rp.*, ic.name FROM risk_participants rp JOIN insurance_companies ic ON ic.id = rp.insurance_company_id
        WHERE rp.entity_type = 'placement' AND rp.entity_id = $1 ORDER BY rp.is_lead DESC, rp.share_percent DESC`, [info.id])).rows
        .map((p) => ({ insuranceCompanyId: p.insurance_company_id, insuranceCompanyName: p.name, isLead: p.is_lead, sharePercent: Number(p.share_percent), premium: Number(p.premium),
          taxes: Number(p.taxes), premiumTotal: Number(p.premium_total), commissionRate: p.commission_rate === null ? null : Number(p.commission_rate), commissionAmount: Number(p.commission_amount),
          netDue: round2(Number(p.premium_total) - Number(p.commission_amount)) }));
    }
    layers = parts.length ? [{ layerId: null, layerNo: 1, name: 'Full value', layerType: 'primary', limit: info.sumInsured, attachmentPoint: 0, exhaustionPoint: info.sumInsured,
      premium: info.premium, taxes: info.taxes, premiumTotal: info.premiumTotal, commissionAmount: info.commission, participants: parts, shareTotal: round2(parts.reduce((s, p) => s + p.sharePercent, 0)) }] : [];
  }
  return { info, layers, source };
}

/** Per insurer across the layers: premium, taxes, gross, commission, net due and its blended share. */
export function consolidate(layers) {
  const by = new Map();
  for (const l of layers) {
    for (const p of l.participants) {
      const x = by.get(p.insuranceCompanyId) || { insuranceCompanyId: p.insuranceCompanyId, insuranceCompanyName: p.insuranceCompanyName, layers: [], premium: 0, taxes: 0, premiumTotal: 0, commissionAmount: 0, netDue: 0 };
      x.layers.push({ layerNo: l.layerNo, sharePercent: p.sharePercent, isLead: p.isLead });
      for (const k of ['premium', 'taxes', 'premiumTotal', 'commissionAmount', 'netDue']) x[k] = round2(x[k] + p[k]);
      by.set(p.insuranceCompanyId, x);
    }
  }
  const rows = [...by.values()];
  const total = rows.reduce((s, r) => s + r.premium, 0);
  const shares = total ? allocate(100 * 100, rows.map((r) => r.premium)).map((v) => Math.round(v * 100) / 10000) : rows.map(() => round2(100 / (rows.length || 1)));
  rows.forEach((r, i) => { r.sharePercent = shares[i]; });
  return rows;
}

const shareOf = (p) => {
  const raw = p.sharePercent ?? p.sharePercentage ?? p.share;
  const v = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
  return raw === undefined || raw === null || raw === '' ? NaN : v;
};
const rateOf = (v) => (v === undefined || v === null || v === '' ? null : (num(v) > 1 ? num(v) / 100 : num(v)));

/**
 * Validate and price the layers sent by the screen. Returns { layers, warnings } with every amount allocated:
 * layer taxes by premium from the entity's taxes, participant amounts by share (largest remainder), commission at the
 * participant's rate (else the entity's, else the insurer master's) or the entity commission split by premium.
 */
export async function priceLayers(info, input) {
  if (!Array.isArray(input) || !input.length) throw badRequest('Add at least one layer');
  const errors = [];
  const warnings = [];
  const contiguous = (await getSetting('bespoke.layers_contiguous', true)) !== false;
  const mustMatch = (await getSetting('bespoke.layer_premium_must_match', true)) !== false;
  const layers = [];
  for (const [i, l] of [...input].sort((a, b) => num(a.attachmentPoint) - num(b.attachmentPoint)).entries()) {
    const path = `layers.${i}`;
    const limit = round2(num(l.limit ?? l.limitAmount));
    const attachment = round2(num(l.attachmentPoint));
    const premium = round2(num(l.premium));
    if (!(limit > 0)) errors.push({ path: `${path}.limit`, message: `Layer ${i + 1}: the limit must be more than 0` });
    if (!(premium > 0)) errors.push({ path: `${path}.premium`, message: `Layer ${i + 1}: the layer premium must be more than 0` });
    if (i === 0 && attachment !== 0) errors.push({ path: `${path}.attachmentPoint`, message: 'The primary layer attaches at 0' });
    if (i > 0 && contiguous) {
      const prev = layers[i - 1];
      if (attachment !== round2(prev.attachmentPoint + prev.limit)) errors.push({ path: `${path}.attachmentPoint`, message: `Layer ${i + 1} must attach at ${round2(prev.attachmentPoint + prev.limit)}, where layer ${i} ends` });
    }
    const parts = [];
    for (const [j, p] of (l.participants || []).entries()) {
      const ic = await resolveInsurer(null, p.insuranceCompanyId ?? p.insuranceCompanyName ?? p.insurer);
      if (!ic) { errors.push({ path: `${path}.participants.${j}`, message: `Layer ${i + 1}: insurer "${p.insuranceCompanyId ?? p.insuranceCompanyName ?? ''}" is not in the insurer master` }); continue; }
      parts.push({ insuranceCompanyId: ic, sharePercent: shareOf(p), isLead: p.isLead === true, commissionRate: rateOf(p.commissionRate), insurerReference: p.insurerReference || null });
    }
    if (!parts.length) errors.push({ path: `${path}.participants`, message: `Layer ${i + 1}: add at least one participant` });
    if (parts.length && !parts.some((p) => p.isLead)) parts[0].isLead = true;
    if (parts.filter((p) => p.isLead).length > 1) errors.push({ path: `${path}.participants`, message: `Layer ${i + 1}: exactly one participant must lead the layer` });
    if (new Set(parts.map((p) => p.insuranceCompanyId)).size !== parts.length) errors.push({ path: `${path}.participants`, message: `Layer ${i + 1}: an insurer can take part only once in a layer` });
    if (parts.some((p) => !(p.sharePercent > 0 && p.sharePercent <= 100))) errors.push({ path: `${path}.participants`, message: `Layer ${i + 1}: every share must be more than 0% and at most 100%` });
    const total = round2(parts.reduce((s, p) => s + (Number.isFinite(p.sharePercent) ? p.sharePercent : 0), 0));
    if (parts.length && Math.abs(parts.reduce((s, p) => s + (p.sharePercent || 0), 0) - 100) > 0.0001) errors.push({ path: `${path}.participants`, message: `Layer ${i + 1}: shares must total exactly 100% (they total ${total}%)` });
    layers.push({ layerNo: i + 1, name: l.name || (i === 0 ? 'Primary layer' : `Excess layer ${i}`), layerType: i === 0 ? 'primary' : 'excess', limit, attachmentPoint: attachment, premium, remarks: l.remarks || null, participants: parts });
  }
  if (errors.length) throw badRequest(errors[0].message, errors);
  const premiumTotal = round2(layers.reduce((s, l) => s + l.premium, 0));
  if (mustMatch && info.premium > 0 && Math.abs(premiumTotal - info.premium) > 0.005) {
    throw badRequest(`The layer premiums total ${premiumTotal}; they must add up to the net premium ${info.premium} of ${info.number}`, [{ path: 'layers', message: 'premium mismatch' }]);
  }
  const top = round2(layers[layers.length - 1].attachmentPoint + layers[layers.length - 1].limit);
  if (info.sumInsured && top < info.sumInsured) warnings.push(`The layers cover ${top} of the sum insured ${info.sumInsured}: the top ${round2(info.sumInsured - top)} is not placed`);
  if (info.sumInsured && top > info.sumInsured) warnings.push(`The layers reach ${top}, above the sum insured ${info.sumInsured}`);
  // amounts
  const layerTaxes = allocate(info.taxes, layers.map((l) => l.premium));
  const masterRates = new Map((await many('SELECT id, commission_rate FROM insurance_companies WHERE id = ANY($1)', [[...new Set(layers.flatMap((l) => l.participants.map((p) => p.insuranceCompanyId)))]]))
    .map((r) => [r.id, r.commission_rate === null ? null : Number(r.commission_rate)]));
  const anyRate = layers.some((l) => l.participants.some((p) => p.commissionRate !== null));
  layers.forEach((l, i) => {
    l.taxes = layerTaxes[i];
    l.premiumTotal = round2(l.premium + l.taxes);
    const shares = l.participants.map((p) => p.sharePercent);
    const prem = allocate(l.premium, shares);
    const tax = allocate(l.taxes, shares);
    l.participants.forEach((p, j) => {
      p.premium = prem[j];
      p.taxes = tax[j];
      p.premiumTotal = round2(prem[j] + tax[j]);
    });
  });
  if (!anyRate && info.commission > 0) {
    const flat = layers.flatMap((l) => l.participants);
    const comm = allocate(info.commission, flat.map((p) => p.premium));
    flat.forEach((p, k) => { p.commissionAmount = comm[k]; p.commissionRate = p.premium ? Math.round((comm[k] / p.premium) * 10000) / 10000 : null; });
  } else {
    for (const p of layers.flatMap((l) => l.participants)) {
      const rate = p.commissionRate ?? info.commissionRate ?? masterRates.get(p.insuranceCompanyId) ?? 0;
      p.commissionRate = rate;
      p.commissionAmount = round2(p.premium * rate);
    }
  }
  for (const l of layers) {
    for (const p of l.participants) p.netDue = round2(p.premiumTotal - p.commissionAmount);
    l.commissionAmount = round2(l.participants.reduce((s, p) => s + p.commissionAmount, 0));
  }
  return { layers, warnings };
}

/**
 * Save the layers of a placement (editable statuses) or an unbilled policy and write the consolidated participants
 * (blended shares, lead = lead of the primary layer) to risk_participants.
 */
export async function saveLayers(type, ref, input, userId) {
  const info = await entityInfo(type, ref);
  if (!info.editable) {
    throw conflict(info.type === 'policy' ? `Policy ${info.number} is already billed: change its co-insurance through an endorsement` : `A ${info.status} placement slip cannot be changed`);
  }
  const { layers, warnings } = await priceLayers(info, input);
  const before = await storedLayers(info.type, info.id);
  await withTransaction(async (db) => {
    await db.query('DELETE FROM risk_layers WHERE entity_type = $1 AND entity_id = $2', [info.type, info.id]);
    for (const l of layers) {
      const r = await db.query(`INSERT INTO risk_layers(entity_type, entity_id, layer_no, name, layer_type, limit_amount, attachment_point, premium, taxes, premium_total, commission_amount, remarks, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [info.type, info.id, l.layerNo, l.name, l.layerType, l.limit, l.attachmentPoint, l.premium, l.taxes, l.premiumTotal, l.commissionAmount, l.remarks, userId]);
      for (const p of l.participants) {
        await db.query(`INSERT INTO risk_layer_participants(layer_id, insurance_company_id, is_lead, share_percent, premium, taxes, premium_total, commission_rate, commission_amount, net_due, insurer_reference)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [r.rows[0].id, p.insuranceCompanyId, p.isLead, p.sharePercent, p.premium, p.taxes, p.premiumTotal, p.commissionRate, p.commissionAmount, p.netDue, p.insurerReference]);
      }
    }
    const cons = consolidate(layers.map((l) => ({ ...l, participants: l.participants.map((p) => ({ ...p, insuranceCompanyName: null })) })));
    const lead = layers[0].participants.find((p) => p.isLead).insuranceCompanyId;
    const parts = cons.map((c) => ({ insuranceCompanyId: c.insuranceCompanyId, sharePercent: c.sharePercent, isLead: c.insuranceCompanyId === lead, commissionRate: null, insurerReference: null }));
    await writeParticipants(db, info.type, info.id, parts, { sumInsured: info.sumInsured, premium: info.premium, taxes: info.taxes, premiumTotal: info.premiumTotal, commissionAmount: info.commission },
      { userId, status: info.type === 'placement' ? 'pending' : 'active' });
    await db.query('UPDATE risk_participants SET layered = true WHERE entity_type = $1 AND entity_id = $2', [info.type, info.id]);
    if (info.type === 'placement') await db.query('UPDATE placements SET insurance_company_id = $2, updated_by = $3, updated_at = now() WHERE id = $1', [info.id, lead, userId]);
    else await db.query('UPDATE policies SET insurance_company_id = $2, updated_at = now() WHERE id = $1', [info.id, lead]);
  });
  const after = await layersFor(info.type, info.id);
  return { before, ...after, warnings, participants: consolidate(after.layers) };
}

/** Layered (or co-insured) risks for the screen's list: entities with layers, newest first. */
export async function listLayered(q = {}) {
  const params = [];
  let where = 'TRUE';
  if (q.search) {
    params.push(q.search);
    where = "(p.placement_number ILIKE '%' || $1 || '%' OR po.policy_number ILIKE '%' || $1 || '%' OR p.insured_name ILIKE '%' || $1 || '%' OR c.display_name ILIKE '%' || $1 || '%')";
  }
  return (await many(`SELECT l.entity_type, l.entity_id, count(*)::int AS layers, max(l.attachment_point + l.limit_amount) AS top, sum(l.premium) AS premium, max(l.created_at) AS updated_at,
      COALESCE(p.placement_number, po.policy_number) AS number, COALESCE(p.insured_name, c.display_name) AS insured, COALESCE(p.status, po.status) AS status,
      (SELECT count(DISTINCT x.insurance_company_id)::int FROM risk_layer_participants x JOIN risk_layers y ON y.id = x.layer_id WHERE y.entity_type = l.entity_type AND y.entity_id = l.entity_id) AS insurers
    FROM risk_layers l LEFT JOIN placements p ON l.entity_type = 'placement' AND p.id = l.entity_id LEFT JOIN policies po ON l.entity_type = 'policy' AND po.id = l.entity_id
    LEFT JOIN clients c ON c.id = po.client_id
    WHERE ${where} GROUP BY l.entity_type, l.entity_id, p.placement_number, po.policy_number, p.insured_name, c.display_name, p.status, po.status ORDER BY max(l.created_at) DESC LIMIT 200`, params))
    .map((r) => ({ entityType: r.entity_type, entityId: r.entity_id, number: r.number, insured: r.insured, status: r.status, layers: r.layers, insurers: r.insurers, topLimit: Number(r.top), premium: Number(r.premium), updatedAt: r.updated_at }));
}

// ---------------------------------------------------------------- remittance and reconciliation

/** Amounts remitted to each insurer on the policy's bills (co-insured: per-insurer allocations; single insurer: remitted applications). */
async function remittedByInsurer(policyId) {
  if (!policyId) return new Map();
  const co = await many(`SELECT al.insurance_company_id AS iid, COALESCE(sum(al.net), 0) AS amt FROM remittance_allocations al JOIN receipt_applications a ON a.id = al.receipt_application_id
    JOIN receivables r ON r.id = a.receivable_id WHERE r.policy_id = $1 AND a.status = 'applied' GROUP BY 1`, [policyId]);
  const single = await one(`SELECT p.insurance_company_id AS iid, COALESCE(sum(round(a.amount * (1 - r.commission_amount / NULLIF(r.amount, 0)), 2)), 0) AS amt
    FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id JOIN policies p ON p.id = r.policy_id
    WHERE r.policy_id = $1 AND a.status = 'applied' AND a.remitted_invoice_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM receivable_participants x WHERE x.receivable_id = r.id) GROUP BY 1`, [policyId]);
  const out = new Map(co.map((r) => [r.iid, Number(r.amt)]));
  if (single && Number(single.amt)) out.set(single.iid, round2((out.get(single.iid) || 0) + Number(single.amt)));
  return out;
}

/** Due, remitted (allocated to the insurer's layers by net due) and outstanding per participant per layer, with the latest reconciliation. */
export async function remittanceView(type, ref) {
  const { info, layers, source } = await layersFor(type, ref);
  const remitted = await remittedByInsurer(info.policyId);
  const recs = await many(`SELECT r.*, (SELECT display_name FROM users u WHERE u.id = r.reconciled_by) AS by_name FROM layer_reconciliations r
    WHERE r.entity_type = $1 AND r.entity_id = $2 ORDER BY r.reconciled_at DESC, r.id DESC`, [info.type, info.id]);
  const rows = [];
  for (const c of consolidate(layers)) {
    const mine = layers.flatMap((l) => l.participants.filter((p) => p.insuranceCompanyId === c.insuranceCompanyId).map((p) => ({ layer: l, p })));
    const paid = remitted.get(c.insuranceCompanyId) || 0;
    const split = allocate(paid, mine.map((m) => m.p.netDue || 0.01));
    mine.forEach((m, i) => rows.push({ insuranceCompanyId: c.insuranceCompanyId, insuranceCompanyName: c.insuranceCompanyName, layerNo: m.layer.layerNo, layerName: m.layer.name,
      sharePercent: m.p.sharePercent, premiumTotal: m.p.premiumTotal, commissionAmount: m.p.commissionAmount, netDue: m.p.netDue, remitted: split[i], outstanding: round2(m.p.netDue - split[i]) }));
  }
  const insurers = consolidate(layers).map((c) => {
    const due = c.netDue;
    const paid = remitted.get(c.insuranceCompanyId) || 0;
    const last = recs.find((r) => r.insurance_company_id === c.insuranceCompanyId);
    return { ...c, remitted: round2(paid), outstanding: round2(due - paid),
      lastReconciliation: last ? { statementRef: last.statement_ref, statementAmount: Number(last.statement_amount), difference: Number(last.difference), status: last.status, note: last.note,
        reconciledBy: last.by_name || last.reconciled_by, reconciledAt: last.reconciled_at } : null };
  });
  return { entity: info, source, issued: Boolean(info.policyId), rows, insurers,
    reconciliations: recs.map((r) => ({ id: Number(r.id), insuranceCompanyId: r.insurance_company_id, layerNo: r.layer_no, statementRef: r.statement_ref, statementAmount: Number(r.statement_amount),
      dueAmount: Number(r.due_amount), remittedAmount: Number(r.remitted_amount), difference: Number(r.difference), status: r.status, note: r.note, reconciledBy: r.by_name || r.reconciled_by, reconciledAt: r.reconciled_at })) };
}

/** Compare an insurer's statement (amount it shows as received) with the amount remitted to it, for all its layers or one. */
export async function reconcileParticipant(type, ref, b, userId) {
  const view = await remittanceView(type, ref);
  const insurerIdNum = Number(b.insuranceCompanyId);
  const rows = view.rows.filter((r) => r.insuranceCompanyId === insurerIdNum && (b.layerNo === undefined || b.layerNo === null || r.layerNo === Number(b.layerNo)));
  if (!rows.length) throw badRequest('The insurer does not take part in this risk (or in that layer)');
  const due = round2(rows.reduce((s, r) => s + r.netDue, 0));
  const remitted = round2(rows.reduce((s, r) => s + r.remitted, 0));
  const statement = round2(num(b.statementAmount));
  const difference = round2(statement - remitted);
  const tolerance = Number(await getSetting('bespoke.reconciliation_tolerance', 1));
  const status = Math.abs(difference) <= tolerance ? 'matched' : 'difference';
  const r = await one(`INSERT INTO layer_reconciliations(entity_type, entity_id, insurance_company_id, layer_no, statement_ref, statement_amount, due_amount, remitted_amount, difference, status, note, reconciled_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
  [view.entity.type, view.entity.id, insurerIdNum, b.layerNo ?? null, b.statementRef || null, statement, due, remitted, difference, status, b.note || null, userId]);
  return { id: Number(r.id), insuranceCompanyId: insurerIdNum, layerNo: r.layer_no, statementAmount: statement, dueAmount: due, remittedAmount: remitted, difference, status, outstanding: round2(due - remitted) };
}

// ---------------------------------------------------------------- claims split

const portion = (x, l) => round2(Math.min(Math.max(x - l.attachmentPoint, 0), l.limit));

async function claimRow(ref) {
  const c = await one(`SELECT c.*, p.policy_number, p.currency, cl.display_name AS client_name FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    WHERE c.id = $1 OR c.claim_number = $1`, [String(ref)]);
  if (!c) throw notFound('Claim not found');
  return c;
}

/**
 * Claim ledger per layer and participant. Outstanding reserve = the last reserve set, less the payments made since;
 * incurred = paid + outstanding. Each layer takes the part of the loss above its attachment point up to its limit
 * (paid from the ground up), each participant its share (to the cent). Recoveries are what each participant paid over
 * for its share of the payments; outstanding recoveries = paid share - recovered.
 */
export async function claimSplit(ref) {
  const c = await claimRow(ref);
  const { layers, source } = await layersFor('policy', c.policy_id);
  const moves = await many(`SELECT m.*, ic.name AS insurer_name, (SELECT display_name FROM users u WHERE u.id = m.created_by) AS by_name FROM claim_layer_movements m
    LEFT JOIN insurance_companies ic ON ic.id = m.insurance_company_id WHERE m.claim_id = $1 ORDER BY m.movement_date, m.id`, [c.id]);
  let reserve = 0;
  let paid = 0;
  let lastPaymentDate = null;
  for (const m of moves) {
    if (m.kind === 'reserve') reserve = Number(m.amount);
    if (m.kind === 'payment') { paid = round2(paid + Number(m.amount)); reserve = round2(Math.max(0, reserve - Number(m.amount))); lastPaymentDate = m.movement_date; }
  }
  const incurred = round2(paid + reserve);
  const recoveries = moves.filter((m) => m.kind === 'recovery');
  const out = layers.map((l) => {
    const inc = portion(incurred, l);
    const pd = portion(paid, l);
    const shares = l.participants.map((p) => p.sharePercent);
    const incS = allocate(inc, shares);
    const pdS = allocate(pd, shares);
    return { layerNo: l.layerNo, name: l.name, attachmentPoint: l.attachmentPoint, limit: l.limit, incurred: inc, paid: pd, reserve: round2(inc - pd),
      participants: l.participants.map((p, i) => ({ insuranceCompanyId: p.insuranceCompanyId, insuranceCompanyName: p.insuranceCompanyName, sharePercent: p.sharePercent, isLead: p.isLead,
        incurred: incS[i], paid: pdS[i], reserve: round2(incS[i] - pdS[i]), recovered: 0, outstandingRecovery: 0 })) };
  });
  // recoveries: a layer-specific recovery goes to that layer; the others fill the insurer's layers from the lowest
  for (const r of recoveries) {
    let left = Number(r.amount);
    const targets = out.flatMap((l) => l.participants.filter((p) => p.insuranceCompanyId === r.insurance_company_id).map((p) => ({ l, p })))
      .filter((x) => r.layer_no === null || x.l.layerNo === r.layer_no);
    for (const [i, x] of targets.entries()) {
      const room = round2(x.p.paid - x.p.recovered);
      const take = i === targets.length - 1 ? left : Math.min(left, Math.max(room, 0));
      x.p.recovered = round2(x.p.recovered + take);
      left = round2(left - take);
      if (left <= 0) break;
    }
  }
  for (const l of out) for (const p of l.participants) p.outstandingRecovery = round2(p.paid - p.recovered);
  const insurers = new Map();
  for (const l of out) {
    for (const p of l.participants) {
      const x = insurers.get(p.insuranceCompanyId) || { insuranceCompanyId: p.insuranceCompanyId, insuranceCompanyName: p.insuranceCompanyName, incurred: 0, paid: 0, reserve: 0, recovered: 0, outstandingRecovery: 0 };
      for (const k of ['incurred', 'paid', 'reserve', 'recovered', 'outstandingRecovery']) x[k] = round2(x[k] + p[k]);
      insurers.set(p.insuranceCompanyId, x);
    }
  }
  const top = layers.length ? Math.max(...layers.map((l) => l.attachmentPoint + l.limit)) : 0;
  return {
    claim: { id: c.id, claimNumber: c.claim_number, policyId: c.policy_id, policyNumber: c.policy_number, insured: c.client_name, lossDate: c.loss_date, status: c.status, currency: c.currency },
    source, totals: { reserve, paid, incurred, recovered: round2(recoveries.reduce((s, r) => s + Number(r.amount), 0)), aboveProgramme: round2(Math.max(0, incurred - top)) },
    lastPaymentDate, layers: out, insurers: [...insurers.values()],
    movements: moves.map((m) => ({ id: Number(m.id), kind: m.kind, amount: Number(m.amount), insuranceCompanyId: m.insurance_company_id, insurer: m.insurer_name || null, layerNo: m.layer_no,
      date: m.movement_date, reference: m.reference, remarks: m.remarks, createdBy: m.by_name || m.created_by, createdAt: m.created_at })),
  };
}

/** Record a reserve (set the outstanding reserve), a payment to the claimant or a recovery from a participant. */
export async function addClaimMovement(ref, b, userId) {
  const c = await claimRow(ref);
  if (c.status === 'rejected') throw conflict('The claim was rejected');
  const kind = b.kind;
  const amount = round2(num(b.amount));
  if (!['reserve', 'payment', 'recovery'].includes(kind)) throw badRequest('kind must be reserve, payment or recovery');
  if (kind === 'reserve' ? amount < 0 : !(amount > 0)) throw badRequest(kind === 'reserve' ? 'The reserve cannot be negative' : 'amount must be more than 0');
  const split = await claimSplit(c.id);
  if (!split.layers.length) throw badRequest('The policy has no participants to split the claim with');
  let insurer = null;
  let layerNo = null;
  if (kind === 'payment' && amount > split.totals.reserve + 0.005 && (await getSetting('bespoke.claim_payment_within_reserve', false))) {
    throw badRequest(`The payment is above the outstanding reserve ${split.totals.reserve}`);
  }
  if (kind === 'recovery') {
    insurer = await resolveInsurer(null, b.insuranceCompanyId);
    const mine = split.layers.flatMap((l) => l.participants.filter((p) => p.insuranceCompanyId === insurer && (b.layerNo === undefined || b.layerNo === null || l.layerNo === Number(b.layerNo))));
    if (!mine.length) throw badRequest('The insurer does not take part in this risk (or in that layer)');
    const open = round2(mine.reduce((s, p) => s + p.outstandingRecovery, 0));
    if (amount > open + 0.005) throw badRequest(`The recovery is more than the insurer's outstanding share of the payments (${open})`);
    layerNo = b.layerNo === undefined || b.layerNo === null ? null : Number(b.layerNo);
  }
  await query(`INSERT INTO claim_layer_movements(claim_id, kind, amount, insurance_company_id, layer_no, movement_date, reference, remarks, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [c.id, kind, amount, insurer, layerNo, isoDate(b.date) || await today(), b.reference || null, b.remarks || null, userId]);
  return claimSplit(c.id);
}

/**
 * Participant claim ledger and outstanding recoveries across claims: one row per claim, layer and participant with
 * incurred, paid, recovered and outstanding (only the outstanding ones unless all=true), with the age of the last payment.
 */
export async function recoveriesReport(q = {}) {
  const claims = await many('SELECT DISTINCT claim_id FROM claim_layer_movements');
  const asOf = isoDate(q.asOf) || await today();
  const insurerFilter = q.insurerId ? Number(q.insurerId) : null;
  const rows = [];
  for (const { claim_id: id } of claims) {
    const s = await claimSplit(id);
    const age = s.lastPaymentDate ? Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(s.lastPaymentDate)) / DAY)) : null;
    for (const l of s.layers) {
      for (const p of l.participants) {
        if (insurerFilter && p.insuranceCompanyId !== insurerFilter) continue;
        if (!q.all && p.outstandingRecovery <= 0.005) continue;
        rows.push({ claimId: s.claim.id, claimNumber: s.claim.claimNumber, policyNumber: s.claim.policyNumber, insured: s.claim.insured, layerNo: l.layerNo, layerName: l.name,
          insuranceCompanyId: p.insuranceCompanyId, insurer: p.insuranceCompanyName, sharePercent: p.sharePercent, incurred: p.incurred, paid: p.paid, reserve: p.reserve,
          recovered: p.recovered, outstanding: p.outstandingRecovery, daysSinceLastPayment: age });
      }
    }
  }
  rows.sort((a, b) => a.insurer.localeCompare(b.insurer) || a.claimNumber.localeCompare(b.claimNumber) || a.layerNo - b.layerNo);
  const byInsurer = new Map();
  for (const r of rows) {
    const x = byInsurer.get(r.insuranceCompanyId) || { insuranceCompanyId: r.insuranceCompanyId, insurer: r.insurer, claims: new Set(), paid: 0, recovered: 0, outstanding: 0 };
    x.claims.add(r.claimId);
    for (const k of ['paid', 'recovered', 'outstanding']) x[k] = round2(x[k] + r[k]);
    byInsurer.set(r.insuranceCompanyId, x);
  }
  return { asOf, rows, totals: [...byInsurer.values()].map((x) => ({ ...x, claims: x.claims.size })), outstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)) };
}
