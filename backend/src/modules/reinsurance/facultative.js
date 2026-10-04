/**
 * Facultative reinsurance placement where the broker acts as reinsurance broker (Reinsurance > Facultative Placements).
 *
 * A cedant (an insurer of the Insurance Company master) offers a share of a risk to the facultative market. The slip
 * records the risk, the 100% sum insured and premium, the share offered, the reinsurance commission allowed to the
 * cedant and the brokerage. Reinsurers (Reinsurance > reinsurers, security rating gate) are approached and write their
 * lines; once the accepted lines reach 100% of the offered share the slip is placed, and binding it posts the journal
 * (posting rule ri.facultative.bind): premium due from the cedant net of its commission, net premium due to each
 * reinsurer, brokerage income. Premium received from the cedant and paid to each reinsurer are recorded with their own
 * journals; the slip closes when both sides are settled.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { postEvent } from '../accounting/lib/posting.js';
import { round2, saveFile } from '../masters/helpers.js';
import { num } from '../documents/common.js';
import { toCsv } from '../documents/tabular.js';
import { assertSecurity } from './service.js';

export const STATUSES = ['draft', 'in-market', 'placed', 'bound', 'closed', 'cancelled'];
const EDITABLE = ['draft', 'in-market'];

export const shareOut = (s) => ({
  id: Number(s.id), placementId: s.placement_id, reinsurerId: s.reinsurer_id, reinsurerName: s.reinsurer_name ?? null, rating: s.rating ?? null,
  sharePct: Number(s.share_pct), status: s.status, reinsurerReference: s.reinsurer_reference, premium: Number(s.premium), cedingCommission: Number(s.ceding_commission),
  brokerage: Number(s.brokerage), netPremium: Number(s.net_premium), paidAmount: Number(s.paid_amount), outstanding: round2(Number(s.net_premium) - Number(s.paid_amount)),
  respondedAt: s.responded_at, notes: s.notes,
});

export const placementOut = (r) => r && ({
  id: r.id, slipNumber: r.slip_number, cedantId: r.cedant_id, cedantName: r.cedant_name ?? null, cedantPolicyNumber: r.cedant_policy_number, policyId: r.policy_id,
  insuredName: r.insured_name, riskDescription: r.risk_description, riskLocation: r.risk_location, lineOfBusiness: r.line_of_business, periodFrom: r.period_from,
  periodTo: r.period_to, currency: r.currency, sumInsured: Number(r.sum_insured), grossPremium: Number(r.gross_premium), facSharePct: Number(r.fac_share_pct),
  facSumInsured: Number(r.fac_sum_insured), facPremium: Number(r.fac_premium), cedingCommissionPct: Number(r.ceding_commission_pct), brokeragePct: Number(r.brokerage_pct),
  cedingCommission: round2(Number(r.fac_premium) * Number(r.ceding_commission_pct) / 100), brokerage: round2(Number(r.fac_premium) * Number(r.brokerage_pct) / 100),
  dueFromCedant: round2(Number(r.fac_premium) - round2(Number(r.fac_premium) * Number(r.ceding_commission_pct) / 100)),
  deductibles: r.deductibles, conditions: r.conditions, claimsBasis: r.claims_basis, premiumDueDate: r.premium_due_date, status: r.status, journalId: r.journal_id,
  journalNumber: r.journal_number ?? null, placedPct: r.placed_pct == null ? undefined : Number(r.placed_pct), received: r.received == null ? undefined : Number(r.received),
  paid: r.paid == null ? undefined : Number(r.paid), sentAt: r.sent_at, boundAt: r.bound_at, cancelReason: r.cancel_reason, createdAt: r.created_at, updatedAt: r.updated_at,
});

const SELECT = `SELECT f.*, ic.name AS cedant_name, jv.jv_number AS journal_number,
  (SELECT COALESCE(sum(s.share_pct), 0) FROM fac_placement_shares s WHERE s.placement_id = f.id AND s.status = 'accepted') AS placed_pct,
  (SELECT COALESCE(sum(x.amount), 0) FROM fac_settlements x WHERE x.placement_id = f.id AND x.direction = 'received') AS received,
  (SELECT COALESCE(sum(x.amount), 0) FROM fac_settlements x WHERE x.placement_id = f.id AND x.direction = 'paid') AS paid
  FROM fac_placements f JOIN insurance_companies ic ON ic.id = f.cedant_id LEFT JOIN journal_vouchers jv ON jv.id = f.journal_id`;
const SHARE_SELECT = 'SELECT s.*, r.name AS reinsurer_name, r.rating FROM fac_placement_shares s JOIN reinsurers r ON r.id = s.reinsurer_id';

export async function listPlacements(q = {}) {
  return (await many(`${SELECT} WHERE ($1::text IS NULL OR f.status = $1) AND ($2::text IS NULL OR f.cedant_id::text = $2)
    AND ($3::text IS NULL OR f.slip_number ILIKE '%' || $3 || '%' OR f.insured_name ILIKE '%' || $3 || '%' OR f.cedant_policy_number ILIKE '%' || $3 || '%')
    ORDER BY f.created_at DESC LIMIT 500`, [q.status || null, q.cedantId ? String(q.cedantId) : null, q.search || null])).map(placementOut);
}

export async function getPlacementRow(id, db = { query }) {
  const r = (await db.query(`${SELECT} WHERE f.id = $1 OR f.slip_number = $1`, [String(id)])).rows[0];
  if (!r) throw notFound('Facultative placement not found');
  return r;
}

export async function getPlacement(id) {
  const r = await getPlacementRow(id);
  const shares = (await many(`${SHARE_SELECT} WHERE s.placement_id = $1 ORDER BY s.share_pct DESC, r.name`, [r.id])).map(shareOut);
  const settlements = await many(`SELECT x.id, x.share_id AS "shareId", r.name AS "reinsurerName", x.direction, x.amount, x.settled_on AS "settledOn", x.reference, x.bank_account AS "bankAccount",
      jv.jv_number AS "journalNumber", x.created_at AS "createdAt" FROM fac_settlements x LEFT JOIN fac_placement_shares s ON s.id = x.share_id LEFT JOIN reinsurers r ON r.id = s.reinsurer_id
      LEFT JOIN journal_vouchers jv ON jv.id = x.journal_id WHERE x.placement_id = $1 ORDER BY x.settled_on, x.id`, [r.id]);
  return { ...placementOut(r), shares, settlements: settlements.map((s) => ({ ...s, id: Number(s.id), shareId: s.shareId == null ? null : Number(s.shareId), amount: Number(s.amount) })) };
}

const FIELDS = {
  cedantId: 'cedant_id', cedantPolicyNumber: 'cedant_policy_number', policyId: 'policy_id', insuredName: 'insured_name', riskDescription: 'risk_description',
  riskLocation: 'risk_location', lineOfBusiness: 'line_of_business', periodFrom: 'period_from', periodTo: 'period_to', currency: 'currency', sumInsured: 'sum_insured',
  grossPremium: 'gross_premium', facSharePct: 'fac_share_pct', cedingCommissionPct: 'ceding_commission_pct', brokeragePct: 'brokerage_pct', deductibles: 'deductibles',
  conditions: 'conditions', claimsBasis: 'claims_basis',
};

async function columns(b, before = null) {
  const cols = {};
  for (const [k, c] of Object.entries(FIELDS)) if (b[k] !== undefined) cols[c] = b[k] === '' ? null : b[k];
  for (const k of ['period_from', 'period_to']) if (cols[k]) cols[k] = isoDate(cols[k]);
  const v = { ...(before || {}), ...cols };
  const errors = [];
  if (!(num(v.sum_insured) > 0)) errors.push({ path: 'sumInsured', message: 'The sum insured must be greater than zero' });
  if (!(num(v.gross_premium) > 0)) errors.push({ path: 'grossPremium', message: 'The premium must be greater than zero' });
  if (!(num(v.fac_share_pct) > 0 && num(v.fac_share_pct) <= 100)) errors.push({ path: 'facSharePct', message: 'The facultative share must be more than 0 and at most 100%' });
  if (num(v.ceding_commission_pct) + num(v.brokerage_pct) >= 100) errors.push({ path: 'brokeragePct', message: 'Commission and brokerage must leave a net premium for the reinsurers' });
  if (v.period_from && v.period_to && String(v.period_to) <= String(v.period_from)) errors.push({ path: 'periodTo', message: 'The period must end after it starts' });
  if (cols.cedant_id && !(await one('SELECT 1 FROM insurance_companies WHERE id = $1', [cols.cedant_id]))) errors.push({ path: 'cedantId', message: 'Unknown cedant (Insurance Company master)' });
  if (cols.policy_id && !(await one('SELECT 1 FROM policies WHERE id = $1', [cols.policy_id]))) errors.push({ path: 'policyId', message: 'Policy not found' });
  if (errors.length) throw badRequest('Validation failed', errors);
  cols.fac_sum_insured = round2(num(v.sum_insured) * num(v.fac_share_pct) / 100);
  cols.fac_premium = round2(num(v.gross_premium) * num(v.fac_share_pct) / 100);
  return cols;
}

export async function createPlacement(b, userId) {
  const cols = await columns({
    cedingCommissionPct: Number(await getSetting('reinsurance.fac_default_ceding_commission_pct', 25)), brokeragePct: Number(await getSetting('reinsurance.fac_default_brokerage_pct', 10)), ...b,
  });
  return withTransaction(async (db) => {
    const number = await nextDocumentNumber('fac_slip', { db, unique: { table: 'fac_placements', column: 'slip_number' } });
    const data = { ...cols, slip_number: number, owner_user_id: userId, created_by: userId, updated_by: userId };
    const keys = Object.keys(data);
    const r = (await db.query(`INSERT INTO fac_placements(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data))).rows[0];
    for (const s of b.shares || []) await upsertShare(db, r.id, s);
    return r.id;
  }).then(getPlacement);
}

export async function updatePlacement(id, b, userId) {
  const before = await getPlacementRow(id);
  if (!EDITABLE.includes(before.status)) throw conflict(`Slip ${before.slip_number} is ${before.status}: its terms can no longer change`);
  const cols = await columns(b, before);
  const data = { ...cols, updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await query(`UPDATE fac_placements SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before: placementOut(before), after: await getPlacement(before.id) };
}

async function upsertShare(db, placementId, s) {
  await assertSecurity([s.reinsurerId], 'reinsurerId');
  const pct = num(s.sharePct);
  if (pct < 0 || pct > 100) throw badRequest('Validation failed', [{ path: 'sharePct', message: 'A line is between 0 and 100% of the facultative share' }]);
  await db.query(`INSERT INTO fac_placement_shares(placement_id, reinsurer_id, share_pct, status, reinsurer_reference, notes) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (placement_id, reinsurer_id) DO UPDATE SET share_pct = EXCLUDED.share_pct, status = EXCLUDED.status, reinsurer_reference = COALESCE(EXCLUDED.reinsurer_reference, fac_placement_shares.reinsurer_reference),
      notes = COALESCE(EXCLUDED.notes, fac_placement_shares.notes), responded_at = CASE WHEN EXCLUDED.status IN ('accepted', 'declined', 'quoted') THEN now() ELSE fac_placement_shares.responded_at END,
      updated_at = now()`, [placementId, String(s.reinsurerId), pct, s.status || 'approached', s.reinsurerReference || null, s.notes || null]);
}

/** Placed when the accepted lines reach the whole facultative share; back to in-market when they no longer do. */
async function syncPlaced(db, placementId) {
  const r = (await db.query(`SELECT f.status, (SELECT COALESCE(sum(share_pct), 0) FROM fac_placement_shares WHERE placement_id = f.id AND status = 'accepted') AS placed
    FROM fac_placements f WHERE f.id = $1`, [placementId])).rows[0];
  const placed = Number(r.placed);
  if (placed > 100.0001) throw badRequest(`The accepted lines add up to ${placed}% of the facultative share: sign them down to 100%`);
  if (placed >= 99.9999 && ['draft', 'in-market'].includes(r.status)) await db.query("UPDATE fac_placements SET status = 'placed', updated_at = now() WHERE id = $1", [placementId]);
  if (placed < 99.9999 && r.status === 'placed') await db.query("UPDATE fac_placements SET status = 'in-market', updated_at = now() WHERE id = $1", [placementId]);
}

/** Add or change a reinsurer's line (approached, quoted, accepted with its written line, or declined). */
export async function saveShare(placementId, s, userId) {
  const p = await getPlacementRow(placementId);
  if (!['draft', 'in-market', 'placed'].includes(p.status)) throw conflict(`Slip ${p.slip_number} is ${p.status}`);
  await withTransaction(async (db) => {
    await upsertShare(db, p.id, s);
    await syncPlaced(db, p.id);
    await db.query('UPDATE fac_placements SET updated_by = $2, updated_at = now() WHERE id = $1', [p.id, userId]);
  });
  return getPlacement(p.id);
}

export async function removeShare(placementId, shareId) {
  const p = await getPlacementRow(placementId);
  if (!['draft', 'in-market', 'placed'].includes(p.status)) throw conflict(`Slip ${p.slip_number} is ${p.status}`);
  await withTransaction(async (db) => {
    const r = await db.query('DELETE FROM fac_placement_shares WHERE id = $1 AND placement_id = $2', [Number(shareId) || 0, p.id]);
    if (!r.rowCount) throw notFound('Line not found');
    await syncPlaced(db, p.id);
  });
  return getPlacement(p.id);
}

/** Slip sent to the market: in-market (the slip PDF goes to the approached reinsurers from the screen). */
export async function sendToMarket(id, userId) {
  const p = await getPlacementRow(id);
  if (!['draft', 'in-market'].includes(p.status)) throw conflict(`Slip ${p.slip_number} is ${p.status}`);
  const n = (await one('SELECT count(*)::int AS n FROM fac_placement_shares WHERE placement_id = $1', [p.id])).n;
  if (!n) throw badRequest('Add the reinsurers to approach first');
  await query("UPDATE fac_placements SET status = CASE WHEN status = 'draft' THEN 'in-market' ELSE status END, sent_at = now(), updated_by = $2, updated_at = now() WHERE id = $1", [p.id, userId]);
  return getPlacement(p.id);
}

/** Split of the facultative premium over the accepted lines (the last one takes the rounding). */
export function splitShares(p, shares) {
  const premium = Number(p.fac_premium);
  const total = shares.reduce((s, x) => s + Number(x.share_pct), 0);
  const used = { premium: 0, ceding: 0, brokerage: 0 };
  const cedingAll = round2(premium * Number(p.ceding_commission_pct) / 100);
  const brokerageAll = round2(premium * Number(p.brokerage_pct) / 100);
  return shares.map((s, i) => {
    const last = i === shares.length - 1;
    const w = Number(s.share_pct) / total;
    const part = {
      premium: last ? round2(premium - used.premium) : round2(premium * w),
      ceding: last ? round2(cedingAll - used.ceding) : round2(cedingAll * w),
      brokerage: last ? round2(brokerageAll - used.brokerage) : round2(brokerageAll * w),
    };
    for (const k of Object.keys(used)) used[k] = round2(used[k] + part[k]);
    return { ...s, ...part, net: round2(part.premium - part.ceding - part.brokerage) };
  });
}

/** Bind a placed slip: amounts per line and the journal (ri.facultative.bind). */
export async function bindPlacement(id, user) {
  const p0 = await getPlacementRow(id);
  if (p0.status !== 'placed') throw conflict(p0.status === 'in-market' || p0.status === 'draft' ? `Slip ${p0.slip_number} is not fully placed (${Number(p0.placed_pct)}% of the facultative share)` : `Slip ${p0.slip_number} is ${p0.status}`);
  return withTransaction(async (db) => {
    const p = (await db.query('SELECT f.*, ic.name AS cedant_name FROM fac_placements f JOIN insurance_companies ic ON ic.id = f.cedant_id WHERE f.id = $1 FOR UPDATE OF f', [p0.id])).rows[0];
    if (p.status !== 'placed') throw conflict('The slip was bound by another request');
    const shares = (await db.query(`${SHARE_SELECT} WHERE s.placement_id = $1 AND s.status = 'accepted' ORDER BY s.share_pct DESC, s.id`, [p.id])).rows;
    const split = splitShares(p, shares);
    for (const s of split) {
      await db.query('UPDATE fac_placement_shares SET premium = $2, ceding_commission = $3, brokerage = $4, net_premium = $5, updated_at = now() WHERE id = $1',
        [s.id, s.premium, s.ceding, s.brokerage, s.net]);
    }
    const ceding = round2(split.reduce((t, s) => t + s.ceding, 0));
    const brokerage = round2(split.reduce((t, s) => t + s.brokerage, 0));
    const due = round2(Number(p.fac_premium) - ceding);
    const jv = await postEvent('ri.facultative.bind', {
      source: 'reinsurance', entryType: 'REINSURANCE', transactionCode: p.slip_number, referenceType: 'Facultative', referenceId: p.id, policyId: p.policy_id || undefined,
      description: `Facultative ${p.slip_number}: ${p.insured_name}`, currency: p.currency,
      amounts: { due_from_cedant: due, brokerage, net_premium: round2(due - brokerage), ceding_commission: ceding, fac_premium: Number(p.fac_premium) },
      participants: split.map((s) => ({ insurerId: null, insurerName: s.reinsurer_name, share: Number(s.share_pct), amounts: { net_premium: s.net } })),
      vars: { slipNumber: p.slip_number, insured: p.insured_name, cedant: p.cedant_name },
    }, { db, user });
    const dueDays = Number(await getSetting('reinsurance.fac_premium_due_days', 60));
    await db.query(`UPDATE fac_placements SET status = 'bound', bound_at = now(), bound_by = $2, journal_id = $3, premium_due_date = COALESCE(premium_due_date, $4::date), updated_at = now()
      WHERE id = $1`, [p.id, user.id, jv.id, addDays(await today(), dueDays)]);
    return { journalId: jv.id, journalNumber: jv.jv_number, dueFromCedant: due, brokerage, cedingCommission: ceding, lines: split.length };
  });
}

/** Record premium received from the cedant or paid to a reinsurer (with its journal); closes the slip once both sides are settled. */
export async function recordSettlement(id, b, user) {
  const p = await getPlacement(id);
  if (p.status !== 'bound') throw conflict(`Slip ${p.slipNumber} is ${p.status}: settlements are recorded on a bound slip`);
  const amount = round2(num(b.amount));
  if (!(amount > 0)) throw badRequest('Validation failed', [{ path: 'amount', message: 'The amount must be greater than zero' }]);
  const date = isoDate(b.settledOn) || (await today());
  let share = null;
  if (b.direction === 'received') {
    const open = round2(p.dueFromCedant - p.received);
    if (amount > open + 0.001) throw badRequest('Validation failed', [{ path: 'amount', message: `Only ${open.toFixed(2)} is still due from the cedant` }]);
  } else {
    share = p.shares.find((s) => s.id === Number(b.shareId) && s.status === 'accepted');
    if (!share) throw badRequest('Validation failed', [{ path: 'shareId', message: 'Choose the reinsurer line being paid' }]);
    if (amount > share.outstanding + 0.001) throw badRequest('Validation failed', [{ path: 'amount', message: `Only ${share.outstanding.toFixed(2)} is still due to ${share.reinsurerName}` }]);
  }
  return withTransaction(async (db) => {
    const jv = await postEvent(b.direction === 'received' ? 'ri.facultative.premium_received' : 'ri.facultative.premium_paid', {
      source: 'reinsurance', entryType: 'REINSURANCE', transactionCode: p.slipNumber, referenceType: 'Facultative', referenceId: p.id, date, bankAccount: b.bankAccount || null,
      paymentMode: b.paymentMode || 'bank-transfer', description: b.direction === 'received' ? `Facultative ${p.slipNumber} premium received from ${p.cedantName}` : `Facultative ${p.slipNumber} premium paid to ${share.reinsurerName}`,
      amounts: { amount }, vars: { slipNumber: p.slipNumber, cedant: p.cedantName, reinsurer: share?.reinsurerName || '', reference: b.reference || p.slipNumber },
    }, { db, user });
    await db.query(`INSERT INTO fac_settlements(placement_id, share_id, direction, amount, settled_on, reference, bank_account, journal_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [p.id, share?.id || null, b.direction, amount, date, b.reference || null, b.bankAccount || null, jv.id, user.id]);
    if (share) await db.query('UPDATE fac_placement_shares SET paid_amount = paid_amount + $2, updated_at = now() WHERE id = $1', [share.id, amount]);
    const left = (await db.query(`SELECT (SELECT $2::numeric - COALESCE(sum(amount), 0) FROM fac_settlements WHERE placement_id = $1 AND direction = 'received') AS cedant,
      (SELECT COALESCE(sum(net_premium - paid_amount), 0) FROM fac_placement_shares WHERE placement_id = $1 AND status = 'accepted') AS reinsurers`, [p.id, p.dueFromCedant])).rows[0];
    const closed = Number(left.cedant) <= 0.005 && Number(left.reinsurers) <= 0.005;
    if (closed) await db.query("UPDATE fac_placements SET status = 'closed', updated_at = now() WHERE id = $1", [p.id]);
    return { journalId: jv.id, journalNumber: jv.jv_number, closed };
  });
}

export async function cancelPlacement(id, reason, userId) {
  const p = await getPlacementRow(id);
  if (!['draft', 'in-market', 'placed'].includes(p.status)) throw conflict(`Slip ${p.slip_number} is ${p.status}: a bound slip is cancelled by a return journal on Journal Voucher`);
  await query("UPDATE fac_placements SET status = 'cancelled', cancel_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1", [p.id, reason, userId]);
  return { before: placementOut(p), after: await getPlacement(p.id) };
}

/** Rows of the facultative premium bordereau (bound lines of a period, optionally of one reinsurer). */
export async function bordereauRows({ from, to, reinsurerId = null }) {
  return many(`SELECT f.slip_number, ic.name AS cedant, f.cedant_policy_number, f.insured_name, f.line_of_business, f.period_from, f.period_to, f.currency,
      r.name AS reinsurer, s.reinsurer_id, s.share_pct, round(f.fac_sum_insured * s.share_pct / 100, 2) AS sum_insured_share, s.premium, s.ceding_commission, s.brokerage,
      s.net_premium, s.paid_amount, (s.net_premium - s.paid_amount) AS outstanding, f.bound_at::date AS bound_on
    FROM fac_placement_shares s JOIN fac_placements f ON f.id = s.placement_id JOIN reinsurers r ON r.id = s.reinsurer_id JOIN insurance_companies ic ON ic.id = f.cedant_id
    WHERE s.status = 'accepted' AND f.status IN ('bound', 'closed') AND f.bound_at::date BETWEEN $1 AND $2 AND ($3::text IS NULL OR s.reinsurer_id = $3)
    ORDER BY r.name, f.bound_at, f.slip_number`, [from, to, reinsurerId]);
}
export const BORDEREAU_COLUMNS = [
  { key: 'slip_number', label: 'Slip' }, { key: 'cedant', label: 'Cedant' }, { key: 'cedant_policy_number', label: 'Original Policy' }, { key: 'insured_name', label: 'Insured' },
  { key: 'line_of_business', label: 'Line' }, { key: 'period_from', label: 'From' }, { key: 'period_to', label: 'To' }, { key: 'reinsurer', label: 'Reinsurer' },
  { key: 'share_pct', label: 'Line %' }, { key: 'sum_insured_share', label: 'Sum Insured (line)' }, { key: 'premium', label: 'Premium' }, { key: 'ceding_commission', label: 'Reinsurance Commission' },
  { key: 'brokerage', label: 'Brokerage' }, { key: 'net_premium', label: 'Net Premium' }, { key: 'paid_amount', label: 'Paid' }, { key: 'outstanding', label: 'Outstanding' },
  { key: 'currency', label: 'Currency' }, { key: 'bound_on', label: 'Bound On' },
];

/**
 * Generate and keep the facultative premium bordereau of a month for a reinsurer (Reinsurance > Reconciliation >
 * bordereaux list, type Facultative): CSV file in the bordereaux storage folder and a reinsurance_bordereaux row.
 */
export async function generateBordereau({ period, reinsurerId }, user) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) throw badRequest('Validation failed', [{ path: 'period', message: 'period must be YYYY-MM' }]);
  if (!reinsurerId || !(await one('SELECT 1 FROM reinsurers WHERE id = $1', [String(reinsurerId)]))) throw badRequest('Validation failed', [{ path: 'reinsurerId', message: 'Choose the reinsurer' }]);
  const from = `${period}-01`;
  const to = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const rows = await bordereauRows({ from, to, reinsurerId });
  if (!rows.length) throw badRequest(`No facultative line bound with this reinsurer in ${period}`);
  const totals = ['premium', 'ceding_commission', 'brokerage', 'net_premium', 'paid_amount', 'outstanding']
    .reduce((t, k) => ({ ...t, [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]: round2(rows.reduce((s, r) => s + Number(r[k]), 0)) }), {});
  const ref = await nextDocumentNumber('bordereau');
  const header = BORDEREAU_COLUMNS.map((c) => c.label);
  const saved = await saveFile({ category: 'bordereaux', fileName: `${ref}_Facultative_${period}.csv`, content: toCsv(header, rows.map((r) => BORDEREAU_COLUMNS.map((c) => r[c.key]))),
    contentType: 'text/csv', entity: 'bordereau', entityId: ref, userId: user.id });
  const dueDays = Number(await getSetting('reinsurance.bordereau_due_days', 30));
  const r = await one(`INSERT INTO reinsurance_bordereaux(reference, type, period, reinsurer_id, entries, totals, status, file_key, file_url, due_date, created_by, updated_by)
    VALUES ($1,'Facultative',$2,$3,$4,$5,'Draft',$6,$7,$8,$9,$9) RETURNING id`, [ref, period, reinsurerId, rows.length, JSON.stringify(totals), saved.key, saved.url, addDays(to, dueDays), user.id]);
  return { id: r.id, reference: ref, period, reinsurerId, entries: rows.length, totals, fileUrl: saved.url };
}
