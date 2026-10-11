/**
 * Discount caps (TIS-BRD-PROD-15, FR-PRM-010): per product and channel type, the minimum and maximum discount % of the
 * discountable premium (promotion and order summary discount together) and the lowest Own Damage rate. A cap is live
 * once a second user holding approve:discount-caps approves it; an approved cap is not edited: a change is a new cap
 * replacing it, and the replaced cap ends the day before the new one starts. Migration 0485.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { num } from '../../lib/money.js';
import { requiredReason } from '../ops-masters/records.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { rateDiscount, standardRates } from './rates.js';

export const CHANNEL_TYPE_LABELS = { financing_bank: 'Financing bank', dealer: 'Dealer', affinity: 'Affinity partner', agent: 'Agent / referrer', direct: 'Direct' };
const STATUS_LABELS = { pending: 'Pending approval', approved: 'Approved', returned: 'Returned', withdrawn: 'Withdrawn' };
const LINK = '/master/finance/discount-caps';

/** The channel type of a distribution channel type (FR-PRM-002 R3). */
export const channelTypeOf = (distributionType) => ({ financing_bank: 'financing_bank', bank_branch: 'financing_bank', dealer_group: 'dealer', dealer_branch: 'dealer',
  affinity_partner: 'affinity' }[distributionType] || null);

const SELECT = `SELECT c.*, p.name AS product_name, cu.display_name AS created_by_name, du.display_name AS decided_by_name, r.effective_from AS replaces_from
  FROM discount_caps c JOIN products p ON p.id = c.product_id LEFT JOIN users cu ON cu.id = c.created_by LEFT JOIN users du ON du.id = c.decided_by
  LEFT JOIN discount_caps r ON r.id = c.replaces_id`;

const toCap = (r) => ({
  id: Number(r.id), productId: r.product_id, productName: r.product_name, channelType: r.channel_type, channelTypeLabel: CHANNEL_TYPE_LABELS[r.channel_type],
  minPct: num(r.min_pct), maxPct: num(r.max_pct), lowestOd: num(r.lowest_od), effectiveFrom: isoDate(r.effective_from), effectiveTo: isoDate(r.effective_to),
  status: r.status, statusLabel: STATUS_LABELS[r.status], replacesId: r.replaces_id ? Number(r.replaces_id) : null, remarks: r.remarks,
  createdBy: r.created_by_name || r.created_by, createdById: r.created_by, createdAt: r.created_at, decidedBy: r.decided_by_name || r.decided_by, decidedAt: r.decided_at,
  decisionReasonCode: r.decision_reason_code, decisionNote: r.decision_note,
});

/** The approved cap of a product and channel type in force on a date, or null. */
export async function capFor(productId, channelType, onDate, db = null) {
  const sql = `SELECT * FROM discount_caps WHERE product_id = $1 AND channel_type = $2 AND status = 'approved' AND effective_from <= $3::date
    AND (effective_to IS NULL OR effective_to >= $3::date) ORDER BY effective_from DESC LIMIT 1`;
  const r = db ? (await db.query(sql, [Number(productId), channelType, onDate])).rows[0] : await one(sql, [Number(productId), channelType, onDate]);
  return r ? toCap({ ...r, product_name: null }) : null;
}

export async function listCaps({ status = null, productId = null, channelType = null } = {}) {
  const where = ['true'];
  const params = [];
  if (status) { params.push(String(status).split(',')); where.push(`c.status = ANY($${params.length})`); }
  if (productId) { params.push(Number(productId)); where.push(`c.product_id = $${params.length}`); }
  if (channelType) { params.push(channelType); where.push(`c.channel_type = $${params.length}`); }
  return (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY p.name, c.channel_type, c.effective_from DESC`, params)).map(toCap);
}

export async function getCap(id, db = null) {
  const r = db ? (await db.query(`${SELECT} WHERE c.id = $1`, [id])).rows[0] : await one(`${SELECT} WHERE c.id = $1`, [id]);
  if (!r) throw notFound('Discount cap not found');
  return toCap(r);
}

const fail = (path, message) => badRequest('Validation failed', [{ path, message }]);

/** An approved cap of the same product and channel type that covers a day of [from, to], other than `except`. */
async function overlapping(db, productId, channelType, from, to, except = null) {
  return (await db.query(`SELECT * FROM discount_caps WHERE product_id = $1 AND channel_type = $2 AND status = 'approved' AND id IS DISTINCT FROM $5
    AND effective_from <= COALESCE($4::date, 'infinity'::date) AND COALESCE(effective_to, 'infinity'::date) >= $3::date LIMIT 1`, [productId, channelType, from, to, except])).rows[0];
}

/**
 * Lines of promotions in force that a cap would leave outside it (FR-PRM-010 MSG-PRM-053), for the screen to warn.
 */
async function promotionImpact(db, cap) {
  const { rows } = await db.query(`SELECT p.code, l.line_no, l.min_od, l.promo_od, l.promo_aon, l.discount_pct, p.benefit FROM promotions p JOIN promotion_lines l ON l.promotion_id = p.id
    WHERE p.status IN ('scheduled', 'active', 'suspended') AND p.product_ids @> to_jsonb($1::int) AND p.channel_types ? $2 AND p.period_to >= $3::date`, [cap.productId, cap.channelType, cap.effectiveFrom]);
  const std = await standardRates();
  return rows.filter((l) => {
    const d = rateDiscount({ minOd: l.min_od, promoOd: l.promo_od, promoAon: l.promo_aon, discountPct: l.discount_pct }, std, l.benefit);
    return d > cap.maxPct || d < cap.minPct || (l.benefit === 'rate' && num(l.min_od ?? l.promo_od) < cap.lowestOd);
  }).map((l) => `${l.code} line ${l.line_no}`);
}

/** Propose a cap, or a change replacing an approved cap (replacesId): pending until approved (FR-PRM-010). */
export async function proposeCap(b, user) {
  const r = await withTransaction(async (db) => {
    const productId = Number(b.productId);
    const product = (await db.query('SELECT id, name FROM products WHERE id = $1', [productId])).rows[0];
    if (!product || !b.channelType || b.minPct === undefined || b.maxPct === undefined || b.lowestOd === undefined || !b.effectiveFrom) {
      throw fail('productId', 'Product, channel type, min discount %, max discount %, lowest OD rate % and effective from are required');
    }
    if (!CHANNEL_TYPE_LABELS[b.channelType]) throw fail('channelType', `Unknown channel type: ${b.channelType}`);
    const min = num(b.minPct);
    const max = num(b.maxPct);
    const lowest = num(b.lowestOd);
    if ([min, max, lowest].some((v) => v < 0 || v > 100)) throw fail('maxPct', 'Discount % must be between 0 and 100');
    if (min > max) throw fail('minPct', 'Min discount % cannot be higher than max discount %');
    const from = isoDate(b.effectiveFrom);
    const to = b.effectiveTo ? isoDate(b.effectiveTo) : null;
    if (from < await today()) throw fail('effectiveFrom', 'effectiveFrom cannot be before today');
    if (to && to < from) throw fail('effectiveTo', 'effectiveTo is before effectiveFrom');
    let replaces = null;
    if (b.replacesId) {
      replaces = (await db.query("SELECT * FROM discount_caps WHERE id = $1 AND status = 'approved'", [Number(b.replacesId)])).rows[0];
      if (!replaces || replaces.product_id !== productId || replaces.channel_type !== b.channelType) throw fail('replacesId', 'The replaced cap must be an approved cap of the same product and channel type');
      if (from <= isoDate(replaces.effective_from)) throw fail('effectiveFrom', 'The new cap must start after the cap it replaces');
    }
    const clash = await overlapping(db, productId, b.channelType, from, to, replaces?.id ?? null);
    if (clash) throw conflict(`An approved cap for ${product.name} through ${CHANNEL_TYPE_LABELS[b.channelType]} already covers ${from.split('-').reverse().join('/')}`);
    const pending = (await db.query("SELECT 1 FROM discount_caps WHERE product_id = $1 AND channel_type = $2 AND status = 'pending'", [productId, b.channelType])).rows[0];
    if (pending) throw conflict(`A cap for ${product.name} through ${CHANNEL_TYPE_LABELS[b.channelType]} is already waiting for approval`);
    const row = (await db.query(`INSERT INTO discount_caps(product_id, channel_type, min_pct, max_pct, lowest_od, effective_from, effective_to, replaces_id, remarks, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [productId, b.channelType, min, max, lowest, from, to, replaces?.id ?? null, String(b.remarks || '').trim() || null, user.id])).rows[0];
    const cap = await getCap(row.id, db);
    return { cap, impact: await promotionImpact(db, cap) };
  });
  await notifyApprovers({ audience: 'approve:discount-caps', document: 'Discount cap', number: `${r.cap.productName} - ${r.cap.channelTypeLabel}`, by: user.username,
    detail: `${r.cap.minPct}% to ${r.cap.maxPct}%, lowest OD ${r.cap.lowestOd}%`, link: LINK, entity: 'discount_cap', entityId: String(r.cap.id) });
  return r;
}

/** Approve (the replaced cap ends the day before) or return a pending cap: approve:discount-caps, never its maker. */
export async function decideCap(id, { decision, reasonCode = null, note = null }, user) {
  if (!['approve', 'return'].includes(decision)) throw badRequest('decision must be approve or return');
  if (!hasPermission(user, 'approve:discount-caps')) throw forbidden('Requires permission: approve:discount-caps');
  const r = await withTransaction(async (db) => {
    const c = (await db.query('SELECT * FROM discount_caps WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!c) throw notFound('Discount cap not found');
    if (c.status !== 'pending') throw conflict(`The cap is ${STATUS_LABELS[c.status].toLowerCase()}: nothing to decide`);
    if (c.created_by === user.id) throw forbidden('Maker-checker: the approver must be different from the user who created the change');
    if (decision === 'return') {
      const why = await requiredReason(db, 'discount_cap_return', { reasonCode, note });
      await db.query("UPDATE discount_caps SET status = 'returned', decided_by = $2, decided_at = now(), decision_reason_code = $3, decision_note = $4 WHERE id = $1", [id, user.id, why.code, why.text]);
      return { c, reason: why.text };
    }
    if (c.replaces_id) await db.query('UPDATE discount_caps SET effective_to = $2 WHERE id = $1', [c.replaces_id, addDays(isoDate(c.effective_from), -1)]);
    const clash = await overlapping(db, c.product_id, c.channel_type, isoDate(c.effective_from), isoDate(c.effective_to), c.replaces_id);
    if (clash) throw conflict('Another approved cap of this product and channel type covers the same dates: return this cap');
    await db.query("UPDATE discount_caps SET status = 'approved', decided_by = $2, decided_at = now(), decision_note = $3 WHERE id = $1", [id, user.id, String(note || '').trim() || null]);
    return { c, reason: null };
  });
  const cap = await getCap(id);
  await notifyDecision({ userId: r.c.created_by, decidedBy: user.id, document: 'Discount cap', number: `${cap.productName} - ${cap.channelTypeLabel}`, approved: decision === 'approve',
    status: decision === 'approve' ? 'approved' : 'returned', by: user.username, reason: r.reason, link: LINK, entity: 'discount_cap', entityId: String(id) });
  return cap;
}

/** Withdraw an own pending cap. */
export async function withdrawCap(id, user) {
  const r = await withTransaction((db) => db.query("UPDATE discount_caps SET status = 'withdrawn', decided_by = $2, decided_at = now() WHERE id = $1 AND status = 'pending' AND created_by = $2 RETURNING id", [id, user.id]));
  if (!r.rowCount) throw badRequest('Only your own pending cap can be withdrawn');
  return getCap(id);
}
