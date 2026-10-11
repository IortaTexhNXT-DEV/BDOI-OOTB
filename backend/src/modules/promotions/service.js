/**
 * Promotions (TIS-BRD-PROD-15, FR-PRM-001 to 007): a time-bound promotional rate or gross premium discount on
 * brand-new vehicles of selected variants, products, insurers and channel types. A version is set up in Draft, checked
 * against the discount caps (caps.js) and approved by a second user holding approve:promotions; the daily job
 * promotionStatus activates and expires it. An approved version is never changed: Amend creates the next version.
 * Migration 0485.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { addCalendarMonths, isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { requiredReason } from '../ops-masters/records.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { capFor, CHANNEL_TYPE_LABELS } from './caps.js';
import { rateDiscount, standardRates } from './rates.js';

export { rateDiscount, standardRates };

export const STATUS_LABELS = { draft: 'Draft', 'pending-approval': 'Pending approval', scheduled: 'Scheduled', active: 'Active', suspended: 'Suspended',
  expired: 'Expired', withdrawn: 'Withdrawn', superseded: 'Superseded' };
export const BENEFIT_LABELS = { rate: 'Promo rate', discount: 'Gross premium discount %' };
const CODE = /^[A-Z0-9-]{3,20}$/;
const IN_FORCE = ['scheduled', 'active', 'suspended'];
const LINK = '/sales/promotions';

const rateOut = (v) => (v === null || v === undefined ? null : Number(v));
const toLine = (l) => ({
  id: Number(l.id), lineNo: l.line_no, variantId: l.variant_id, brand: l.brand_name, model: l.model_name, variant: l.variant_name, variantActive: l.variant_status === 'active',
  yearFrom: l.year_from, yearTo: l.year_to, fmvFrom: rateOut(l.fmv_from), fmvTo: rateOut(l.fmv_to), insurerId: l.insurer_id, insurerName: l.insurer_name || null,
  promoOd: rateOut(l.promo_od), minOd: rateOut(l.min_od), promoAon: rateOut(l.promo_aon), remitOd: rateOut(l.remit_od), remitAon: rateOut(l.remit_aon), discountPct: rateOut(l.discount_pct),
});
const LINE_SELECT = `SELECT l.*, v.name AS variant_name, v.status AS variant_status, m.name AS model_name, b.name AS brand_name, ic.name AS insurer_name
  FROM promotion_lines l JOIN vehicle_variants v ON v.id = l.variant_id JOIN vehicle_models m ON m.id = v.model_id JOIN vehicle_brands b ON b.id = m.brand_id
  LEFT JOIN insurance_companies ic ON ic.id = l.insurer_id`;

const PROMO_SELECT = `SELECT p.*, cu.display_name AS created_by_name, uu.display_name AS updated_by_name, su.display_name AS submitted_by_name, du.display_name AS decided_by_name,
  xu.display_name AS status_changed_by_name,
  (SELECT count(*)::int FROM promotion_lines l WHERE l.promotion_id = p.id) AS line_count,
  (SELECT count(*)::int FROM promotion_units u WHERE upper(u.promotion_code) = upper(p.code) AND u.returned_at IS NULL) AS units_used
  FROM promotions p LEFT JOIN users cu ON cu.id = p.created_by LEFT JOIN users uu ON uu.id = p.updated_by LEFT JOIN users su ON su.id = p.submitted_by
  LEFT JOIN users du ON du.id = p.decided_by LEFT JOIN users xu ON xu.id = p.status_changed_by`;

async function names(table, ids) {
  if (!ids?.length) return [];
  return (await many(`SELECT id, name FROM ${table} WHERE id = ANY($1::int[]) ORDER BY name`, [ids.map(Number)])).map((r) => ({ id: r.id, name: r.name }));
}

async function toPromotion(r, { lines = false } = {}) {
  const out = {
    id: r.id, code: r.code, version: r.version, name: r.name, periodFrom: isoDate(r.period_from), periodTo: isoDate(r.period_to), benefit: r.benefit,
    benefitLabel: BENEFIT_LABELS[r.benefit], excess: r.excess || {}, unitQuota: r.unit_quota, unitsUsed: r.units_used ?? 0, lockInYears: r.lockin_years,
    productIds: r.product_ids || [], insurerIds: r.insurer_ids || [], channelTypes: r.channel_types || [],
    products: await names('products', r.product_ids), insurers: await names('insurance_companies', r.insurer_ids),
    channelTypeLabels: (r.channel_types || []).map((c) => CHANNEL_TYPE_LABELS[c] || c),
    combineDealer: r.combine_dealer, combineDiscount: r.combine_discount, status: r.status, statusLabel: STATUS_LABELS[r.status], notes: r.notes, lineCount: r.line_count ?? 0,
    createdBy: r.created_by_name || r.created_by, createdById: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by_name || r.updated_by, updatedById: r.updated_by, updatedAt: r.updated_at,
    submittedBy: r.submitted_by_name || r.submitted_by, submittedById: r.submitted_by, submittedAt: r.submitted_at,
    decidedBy: r.decided_by_name || r.decided_by, decidedAt: r.decided_at, decisionReasonCode: r.decision_reason_code, decisionNote: r.decision_note,
    statusReasonCode: r.status_reason_code, statusNote: r.status_note, statusChangedBy: r.status_changed_by_name || r.status_changed_by, statusChangedAt: r.status_changed_at,
  };
  if (lines) out.lines = (await many(`${LINE_SELECT} WHERE l.promotion_id = $1 ORDER BY l.line_no`, [r.id])).map(toLine);
  return out;
}

async function promotionRow(id, db = null) {
  const r = db ? (await db.query(`${PROMO_SELECT} WHERE p.id = $1`, [id])).rows[0] : await one(`${PROMO_SELECT} WHERE p.id = $1`, [id]);
  if (!r) throw notFound('Promotion not found');
  return r;
}

/** The lines of a promotion with the rate discount and the cap check of each product and channel type (FR-PRM-011). */
export async function capCheck(p, lines, db = null) {
  const std = await standardRates();
  const out = [];
  for (const l of lines) {
    const discount = rateDiscount(l, std, p.benefit);
    const checks = [];
    for (const productId of p.productIds) {
      for (const type of p.channelTypes) {
        const cap = await capFor(productId, type, p.periodFrom, db);
        const product = p.products.find((x) => Number(x.id) === Number(productId))?.name || String(productId);
        const where = `${product} through ${CHANNEL_TYPE_LABELS[type] || type}`;
        if (!cap) { checks.push({ productId, channelType: type, result: 'no-cap', message: `No approved discount cap for ${where}` }); continue; }
        let result = 'within';
        let message = null;
        if (p.benefit === 'rate' && num(l.minOd ?? l.promoOd) < num(cap.lowestOd)) {
          result = 'below-lowest-od';
          message = `Line ${l.lineNo}: Min OD % of ${num(l.minOd ?? l.promoOd)}% is below the lowest OD rate of ${num(cap.lowestOd)}% for ${where}`;
        } else if (discount > num(cap.maxPct)) {
          result = 'above-max';
          message = `Line ${l.lineNo}: the rate discount of ${discount.toFixed(2)}% is above the maximum discount of ${num(cap.maxPct).toFixed(2)}% for ${where}`;
        } else if (discount < num(cap.minPct)) {
          result = 'below-min';
          message = `Line ${l.lineNo}: the rate discount of ${discount.toFixed(2)}% is below the minimum discount of ${num(cap.minPct).toFixed(2)}% for ${where}`;
        }
        checks.push({ productId, channelType: type, result, message, maxPct: num(cap.maxPct), minPct: num(cap.minPct), lowestOd: num(cap.lowestOd) });
      }
    }
    out.push({ lineNo: l.lineNo, rateDiscount: discount, below: p.benefit === 'rate' && num(l.promoOd) >= std.ownDamage && num(l.promoAon) >= std.actsOfNature, checks });
  }
  return { standardRates: std, lines: out };
}

export async function getPromotion(id) {
  const p = await toPromotion(await promotionRow(id), { lines: true });
  const versions = (await many(`${PROMO_SELECT} WHERE upper(p.code) = upper($1) ORDER BY p.version DESC`, [p.code]));
  return { ...p, capCheck: await capCheck(p, p.lines), versions: await Promise.all(versions.map((v) => toPromotion(v))) };
}

export async function listPromotions({ status = null, search = null, activeOn = null } = {}) {
  const where = ["p.status <> 'superseded'"];
  const params = [];
  if (status) {
    const list = String(status).split(',');
    params.push(list);
    where.push(`p.status = ANY($${params.length})`);
  }
  if (search) { params.push(`%${String(search).trim()}%`); where.push(`(p.code ILIKE $${params.length} OR p.name ILIKE $${params.length})`); }
  if (activeOn) { params.push(isoDate(activeOn)); where.push(`p.status IN ('active', 'scheduled') AND $${params.length}::date BETWEEN p.period_from AND p.period_to`); }
  const rows = await many(`${PROMO_SELECT} WHERE ${where.join(' AND ')}
    ORDER BY (p.status = 'active') DESC, p.period_from DESC, p.code, p.version DESC`, params);
  return Promise.all(rows.map((r) => toPromotion(r)));
}

const fail = (path, message) => badRequest('Validation failed', [{ path, message }]);

/** General and applicability fields of a promotion body, checked (FR-PRM-001, 002). */
async function general(db, b, { existing = null } = {}) {
  const code = String(existing ? existing.code : b.code || '').trim().toUpperCase();
  if (!code) throw fail('code', 'Code is required');
  if (!CODE.test(code)) throw fail('code', 'Code may contain only capital letters, digits and hyphens (3 to 20 characters)');
  const name = String(b.name ?? existing?.name ?? '').trim();
  if (!name) throw fail('name', 'Name is required');
  const from = isoDate(b.periodFrom ?? existing?.period_from);
  const to = isoDate(b.periodTo ?? existing?.period_to);
  if (!from || !to) throw fail('periodFrom', 'Enter the period of the promotion');
  if (to < from) throw fail('periodTo', 'effectiveTo is before effectiveFrom');
  const months = Number(await getSetting('promotions.max_period_months', 12));
  if (to > isoDate(addCalendarMonths(from, months))) throw fail('periodTo', `A promotion period cannot be longer than ${months} months`);
  const benefit = existing && existing.version > 1 ? existing.benefit : (b.benefit ?? existing?.benefit ?? 'rate');
  if (!BENEFIT_LABELS[benefit]) throw fail('benefit', 'Promo benefit must be a promo rate or a gross premium discount %');
  const quota = b.unitQuota === undefined ? existing?.unit_quota ?? null : b.unitQuota === null || b.unitQuota === '' ? null : Number(b.unitQuota);
  if (quota !== null && (!Number.isInteger(quota) || quota < 1)) throw fail('unitQuota', 'Unit quota must be a whole number of 1 or more');
  const maxLock = Number(await getSetting('promotions.max_lockin_years', 3));
  const lock = b.lockInYears === undefined ? existing?.lockin_years ?? null : b.lockInYears === null || b.lockInYears === '' ? null : Number(b.lockInYears);
  if (lock !== null && (!Number.isInteger(lock) || lock < 1 || lock > maxLock)) throw fail('lockInYears', `Lock-in period must be between 1 and ${maxLock} years`);
  const productIds = (b.productIds ?? existing?.product_ids ?? []).map(Number);
  if (productIds.length) {
    const lines = (await db.query('SELECT id, name, line FROM products WHERE id = ANY($1::int[])', [productIds])).rows;
    if (lines.length !== productIds.length || lines.some((p) => p.line !== 'motor')) throw fail('productIds', 'Promotions apply to Motor products only');
  }
  const insurerIds = (b.insurerIds ?? existing?.insurer_ids ?? []).map(Number);
  const channelTypes = b.channelTypes ?? existing?.channel_types ?? [];
  const unknown = channelTypes.filter((c) => !CHANNEL_TYPE_LABELS[c]);
  if (unknown.length) throw fail('channelTypes', `Unknown channel type: ${unknown.join(', ')}`);
  const excess = {};
  for (const [k, v] of Object.entries(b.excess ?? existing?.excess ?? {})) {
    if (v === null || v === '') continue;
    if (!(num(v) >= 0)) throw fail('excess', 'The promo excess is an amount of 0 or more');
    excess[k] = round2(num(v));
  }
  return { code, name, period_from: from, period_to: to, benefit, unit_quota: quota, lockin_years: lock, product_ids: JSON.stringify(productIds),
    insurer_ids: JSON.stringify(insurerIds), channel_types: JSON.stringify(channelTypes), excess: JSON.stringify(excess),
    combine_dealer: b.combineDealer ?? existing?.combine_dealer ?? false, combine_discount: b.combineDiscount ?? existing?.combine_discount ?? false,
    notes: b.notes === undefined ? existing?.notes ?? null : String(b.notes || '').trim() || null };
}

const rate = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const decimals = (v) => (String(v).split('.')[1] || '').length;

/** The vehicle lines of a body, checked (FR-PRM-003). */
async function linesOf(db, rawLines, benefit) {
  const out = [];
  for (const [i, l] of (rawLines || []).entries()) {
    const n = i + 1;
    const variantId = Number(l.variantId);
    const v = (await db.query('SELECT v.id, v.name, v.status FROM vehicle_variants v WHERE v.id = $1', [variantId])).rows[0];
    if (!v) throw fail(`lines.${i}.variantId`, `Line ${n}: choose the vehicle variant`);
    const yearFrom = Number(l.yearFrom);
    const yearTo = Number(l.yearTo ?? l.yearFrom);
    if (!Number.isInteger(yearFrom) || !Number.isInteger(yearTo)) throw fail(`lines.${i}.yearFrom`, `Line ${n}: enter the year models`);
    if (yearTo < yearFrom) throw fail(`lines.${i}.yearTo`, `Line ${n}: year model to is before year model from`);
    const fmvFrom = rate(l.fmvFrom);
    const fmvTo = rate(l.fmvTo);
    if (fmvFrom !== null && fmvTo !== null && fmvTo <= fmvFrom) throw fail(`lines.${i}.fmvTo`, `Line ${n}: FMV to must be higher than FMV from`);
    const line = { lineNo: n, variantId, variantName: v.name, yearFrom, yearTo, fmvFrom, fmvTo, insurerId: l.insurerId ? Number(l.insurerId) : null,
      promoOd: rate(l.promoOd), minOd: rate(l.minOd ?? l.promoOd), promoAon: rate(l.promoAon), remitOd: rate(l.remitOd), remitAon: rate(l.remitAon), discountPct: rate(l.discountPct) };
    const rates = benefit === 'rate' ? ['promoOd', 'minOd', 'promoAon', 'remitOd', 'remitAon'] : ['remitOd', 'remitAon'].filter((k) => line[k] !== null);
    if (benefit === 'rate' && ['promoOd', 'promoAon', 'remitOd', 'remitAon'].some((k) => line[k] === null)) {
      throw fail(`lines.${i}.promoOd`, `Line ${n}: Promo OD %, Promo AON %, Remit OD % and Remit AON % are required`);
    }
    if (benefit === 'discount' && line.discountPct === null) throw fail(`lines.${i}.discountPct`, `Line ${n}: discount % is required`);
    for (const k of [...rates, ...(benefit === 'discount' ? ['discountPct'] : [])]) {
      if (!(line[k] > 0 && line[k] <= 100) || decimals(line[k]) > 4) throw fail(`lines.${i}.${k}`, `Line ${n}: rates must be more than 0 and at most 100, with up to 4 decimals`);
    }
    if (benefit === 'rate') {
      if (line.remitOd > line.promoOd || line.remitAon > line.promoAon) throw fail(`lines.${i}.remitOd`, `Line ${n}: a remitting rate cannot be higher than the promo rate of the same peril`);
      if (line.minOd > line.promoOd) throw fail(`lines.${i}.minOd`, `Line ${n}: Min OD % cannot be higher than Promo OD %`);
      if (line.minOd < line.remitOd) throw fail(`lines.${i}.minOd`, `Line ${n}: Min OD % cannot be lower than Remit OD %`);
    }
    const overlap = out.find((o) => o.variantId === variantId && o.yearFrom <= yearTo && yearFrom <= o.yearTo && (!o.insurerId || !line.insurerId || o.insurerId === line.insurerId));
    if (overlap) throw fail(`lines.${i}.variantId`, `Variant ${v.name} is listed twice for overlapping year models and insurers`);
    out.push(line);
  }
  return out;
}

async function writeLines(db, promotionId, lines) {
  await db.query('DELETE FROM promotion_lines WHERE promotion_id = $1', [promotionId]);
  for (const l of lines) {
    await db.query(`INSERT INTO promotion_lines(promotion_id, line_no, variant_id, year_from, year_to, fmv_from, fmv_to, insurer_id, promo_od, min_od, promo_aon, remit_od, remit_aon, discount_pct)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [promotionId, l.lineNo, l.variantId, l.yearFrom, l.yearTo, l.fmvFrom, l.fmvTo, l.insurerId, l.promoOd, l.minOd, l.promoAon, l.remitOd, l.remitAon, l.discountPct]);
  }
}

const currentLines = async (db, id) => (await db.query(`${LINE_SELECT} WHERE l.promotion_id = $1 ORDER BY l.line_no`, [id])).rows.map(toLine);

/** Save a new promotion as Draft, version 1 (FR-PRM-001). */
export async function createPromotion(b, user) {
  const id = await withTransaction(async (db) => {
    const g = await general(db, b);
    const used = (await db.query('SELECT 1 FROM promotions WHERE upper(code) = $1', [g.code])).rows[0];
    if (used) throw conflict(`Promotion code ${g.code} is already used`);
    const lines = await linesOf(db, b.lines, g.benefit);
    const keys = Object.keys(g);
    const r = (await db.query(`INSERT INTO promotions(${keys.join(', ')}, created_by, updated_by) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}, $${keys.length + 1}, $${keys.length + 1}) RETURNING id`,
      [...Object.values(g), user.id])).rows[0];
    await writeLines(db, r.id, lines);
    return r.id;
  });
  return getPromotion(id);
}

/** Change a Draft version (FR-PRM-001 to 003); an approved version is amended instead (FR-PRM-006). */
export async function updatePromotion(id, b, user) {
  const before = await getPromotion(id);
  await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM promotions WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (row.status !== 'draft') throw conflict(`Promotion ${row.code} is ${STATUS_LABELS[row.status]} and cannot be changed. Use Amend to create a new version`);
    if (b.code && String(b.code).trim().toUpperCase() !== row.code) throw fail('code', 'The code cannot be changed after the first save');
    if (row.version > 1 && b.benefit && b.benefit !== row.benefit) throw fail('benefit', 'The promo benefit cannot be amended');
    const g = await general(db, b, { existing: row });
    if (row.version > 1) {
      const inForce = (await db.query(`SELECT status, period_from FROM promotions WHERE upper(code) = upper($1) AND status = ANY($2) ORDER BY version DESC LIMIT 1`, [row.code, IN_FORCE])).rows[0];
      if (inForce && inForce.status !== 'scheduled' && isoDate(inForce.period_from) !== g.period_from) throw fail('periodFrom', 'The start date can only be changed while the promotion is Scheduled');
    }
    const lines = b.lines === undefined ? null : await linesOf(db, b.lines, g.benefit);
    const keys = Object.keys(g).filter((k) => k !== 'code');
    await db.query(`UPDATE promotions SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
      [id, ...keys.map((k) => g[k]), user.id]);
    if (lines) await writeLines(db, id, lines);
  });
  return { before, after: await getPromotion(id) };
}

/** Delete a Draft version 1 never submitted, by its maker. */
export async function deletePromotion(id, user) {
  const p = await getPromotion(id);
  if (p.status !== 'draft' || p.version !== 1 || p.submittedAt) throw conflict('Only a draft that was never submitted can be deleted; withdraw an approved promotion instead');
  if (p.createdById !== user.id) throw forbidden('Only the user who created the draft can delete it');
  await withTransaction((db) => db.query('DELETE FROM promotions WHERE id = $1', [id]));
  return p;
}

/** Every check of a version before it is submitted or approved: fields, lines and caps (FR-PRM-004, 011). */
async function assertComplete(db, p) {
  if (!p.productIds.length) throw fail('productIds', 'Select at least one product');
  if (!p.insurerIds.length) throw fail('insurerIds', 'Select at least one insurer');
  if (!p.channelTypes.length) throw fail('channelTypes', 'Select at least one channel type');
  const lines = await currentLines(db, p.id);
  if (!lines.length) throw fail('lines', 'Add at least one vehicle variant');
  const inactive = lines.find((l) => !l.variantActive);
  if (inactive) throw fail('lines', `Variant ${inactive.variant} is inactive on Master > Insurance > Vehicle`);
  const check = await capCheck(p, lines, db);
  const failed = check.lines.flatMap((l) => l.checks).filter((c) => c.result !== 'within');
  if (failed.length) throw badRequest(failed[0].message, failed.map((c) => ({ path: 'lines', message: c.message })));
}

/** Submit a Draft for approval (FR-PRM-004). */
export async function submitPromotion(id, user) {
  const p = await toPromotion(await promotionRow(id));
  if (p.status !== 'draft') throw conflict(`Promotion ${p.code} is ${p.statusLabel}: only a draft is submitted`);
  if (p.periodFrom < await today() && p.version === 1) throw fail('periodFrom', 'The period cannot start before today');
  await withTransaction(async (db) => {
    await assertComplete(db, p);
    await db.query("UPDATE promotions SET status = 'pending-approval', submitted_by = $2, submitted_at = now(), decided_by = NULL, decided_at = NULL, decision_note = NULL, decision_reason_code = NULL WHERE id = $1", [id, user.id]);
  });
  await notifyApprovers({ audience: 'approve:promotions', document: 'Promotion', number: `${p.code} version ${p.version}`, by: user.username, detail: p.name,
    link: LINK, entity: 'promotion', entityId: id });
  return getPromotion(id);
}

/** Recall a submitted version to Draft before it is decided, by the user who submitted it. */
export async function recallPromotion(id, user) {
  const p = await getPromotion(id);
  if (p.status !== 'pending-approval') throw conflict(`Promotion ${p.code} is ${p.statusLabel}: only a submitted promotion is recalled`);
  if (p.submittedById !== user.id) throw forbidden('Only the user who submitted the promotion can recall it');
  await withTransaction((db) => db.query("UPDATE promotions SET status = 'draft', updated_by = $2, updated_at = now() WHERE id = $1", [id, user.id]));
  return getPromotion(id);
}

/**
 * Approve (Scheduled, or Active from today; the version in force becomes Superseded) or return to Draft with a reason
 * code of the context promotion_return (FR-PRM-004, 006): approve:promotions, never the maker of the version.
 */
export async function decidePromotion(id, { decision, reasonCode = null, note = null }, user) {
  if (!['approve', 'return'].includes(decision)) throw badRequest('decision must be approve or return');
  if (!hasPermission(user, 'approve:promotions')) throw forbidden('Requires permission: approve:promotions');
  const r = await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM promotions WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) throw notFound('Promotion not found');
    if (row.status !== 'pending-approval') throw conflict(`Promotion ${row.code} is ${STATUS_LABELS[row.status]}: nothing to decide`);
    if ([row.created_by, row.updated_by, row.submitted_by].includes(user.id)) {
      throw forbidden('Maker-checker: the approver must be different from the user who created or changed the promotion');
    }
    if (decision === 'return') {
      const why = await requiredReason(db, 'promotion_return', { reasonCode, note });
      await db.query("UPDATE promotions SET status = 'draft', decided_by = $2, decided_at = now(), decision_reason_code = $3, decision_note = $4 WHERE id = $1", [id, user.id, why.code, why.text]);
      return { row, reason: why.text };
    }
    const now = await today();
    const p = await toPromotion(row);
    if (row.version === 1 && p.periodFrom < now) throw conflict(`The period start ${p.periodFrom.split('-').reverse().join('/')} has passed. Return the promotion so the maker can correct the period`);
    await assertComplete(db, p);
    const prior = (await db.query(`SELECT id, status FROM promotions WHERE upper(code) = upper($1) AND id <> $2 AND status = ANY($3)`, [row.code, id, IN_FORCE])).rows[0];
    const status = p.periodFrom > now ? (prior && prior.status !== 'scheduled' ? prior.status : 'scheduled') : prior?.status === 'suspended' ? 'suspended' : 'active';
    if (prior) await db.query("UPDATE promotions SET status = 'superseded' WHERE id = $1", [prior.id]);
    await db.query('UPDATE promotions SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4, decision_reason_code = NULL WHERE id = $1',
      [id, p.periodTo < now ? 'expired' : status, user.id, String(note || '').trim() || null]);
    return { row, reason: null };
  });
  await notifyDecision({ userId: r.row.submitted_by || r.row.created_by, decidedBy: user.id, document: 'Promotion', number: `${r.row.code} version ${r.row.version}`,
    approved: decision === 'approve', status: decision === 'approve' ? 'approved' : 'returned', by: user.username, reason: r.reason, link: LINK, entity: 'promotion', entityId: id });
  return getPromotion(id);
}

/** Suspend, resume or withdraw a promotion in force (FR-PRM-005), with a reason of the context promotion_status. */
export async function changePromotionStatus(id, action, { reasonCode = null, note = null }, user) {
  const moves = { suspend: [['active', 'scheduled'], 'suspended'], resume: [['suspended'], null], withdraw: [['active', 'scheduled', 'suspended'], 'withdrawn'] };
  if (!moves[action]) throw badRequest('Unknown action');
  if (!hasPermission(user, 'approve:promotions')) throw forbidden('Requires permission: approve:promotions');
  const r = await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM promotions WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) throw notFound('Promotion not found');
    if (!moves[action][0].includes(row.status)) throw conflict(`Promotion ${row.code} is ${STATUS_LABELS[row.status]}: it cannot be ${action === 'resume' ? 'resumed' : `${action}ed`}`);
    const why = await requiredReason(db, 'promotion_status', { reasonCode, note });
    const now = await today();
    const to = action === 'resume' ? (isoDate(row.period_from) > now ? 'scheduled' : 'active') : moves[action][1];
    await db.query(`UPDATE promotions SET status = $2, status_reason_code = $3, status_note = $4, status_changed_by = $5, status_changed_at = now()
      ${action === 'withdraw' ? ', period_to = LEAST(period_to, $6::date)' : ''} WHERE id = $1`,
    [id, to, why.code, why.text, user.id, ...(action === 'withdraw' ? [now] : [])]);
    const open = (await db.query(`SELECT count(*)::int AS n FROM quotes WHERE deleted_at IS NULL AND upper(doc->'promotion'->>'code') = upper($1)
      AND status IN ('draft', 'sent', 'accepted', 'approved', 'submitted')`, [row.code])).rows[0].n;
    return { row, openQuotes: open };
  });
  return { promotion: await getPromotion(id), openQuotes: r.openQuotes, before: r.row };
}

/** Amend a promotion in force as the next version in Draft, copied from it (FR-PRM-006). */
export async function amendPromotion(id, user) {
  const newId = await withTransaction(async (db) => {
    const row = (await db.query('SELECT * FROM promotions WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) throw notFound('Promotion not found');
    if (!IN_FORCE.includes(row.status)) throw conflict(`Promotion ${row.code} is ${STATUS_LABELS[row.status]}: only a scheduled, active or suspended promotion is amended`);
    const open = (await db.query("SELECT version FROM promotions WHERE upper(code) = upper($1) AND status IN ('draft', 'pending-approval')", [row.code])).rows[0];
    if (open) throw conflict(`Promotion ${row.code} already has version ${open.version} in Draft or Pending approval`);
    const top = (await db.query('SELECT max(version)::int AS v FROM promotions WHERE upper(code) = upper($1)', [row.code])).rows[0].v;
    const r = (await db.query(`INSERT INTO promotions(code, version, name, period_from, period_to, benefit, excess, unit_quota, lockin_years, product_ids, insurer_ids, channel_types,
        combine_dealer, combine_discount, notes, created_by, updated_by)
      SELECT code, $2, name, period_from, period_to, benefit, excess, unit_quota, lockin_years, product_ids, insurer_ids, channel_types, combine_dealer, combine_discount, notes, $3, $3
      FROM promotions WHERE id = $1 RETURNING id`, [id, top + 1, user.id])).rows[0];
    await db.query(`INSERT INTO promotion_lines(promotion_id, line_no, variant_id, year_from, year_to, fmv_from, fmv_to, insurer_id, promo_od, min_od, promo_aon, remit_od, remit_aon, discount_pct)
      SELECT $2, line_no, variant_id, year_from, year_to, fmv_from, fmv_to, insurer_id, promo_od, min_od, promo_aon, remit_od, remit_aon, discount_pct FROM promotion_lines WHERE promotion_id = $1`, [id, r.id]);
    return r.id;
  });
  return getPromotion(newId);
}

/** Copy a promotion into a new Draft with a new code (period left for the user to enter). */
export async function copyPromotion(id, b, user) {
  const src = await getPromotion(id);
  return createPromotion({ ...src, code: b.code, periodFrom: b.periodFrom, periodTo: b.periodTo, lines: src.lines, excess: src.excess, unitQuota: src.unitQuota, lockInYears: src.lockInYears }, user);
}

/**
 * Daily job (FR-PRM-005): Scheduled promotions whose period starts become Active; Active, Scheduled and Suspended
 * promotions whose period has ended become Expired.
 */
export async function promotionStatus() {
  const now = await today();
  const started = await many("UPDATE promotions SET status = 'active' WHERE status = 'scheduled' AND period_from <= $1::date AND period_to >= $1::date RETURNING code", [now]);
  const ended = await many("UPDATE promotions SET status = 'expired' WHERE status IN ('scheduled', 'active', 'suspended') AND period_to < $1::date RETURNING code", [now]);
  return { activated: started.length, expired: ended.length };
}

/** Choices of the promotion form: Motor products, active vehicle variants (brand, model, variant), channel types, standard rates and the rate change reasons. */
export async function promotionChoices() {
  const products = await many("SELECT id, code, name FROM products WHERE line = 'motor' AND status = 'active' ORDER BY name");
  const variants = await many(`SELECT v.id, b.name AS brand, m.name AS model, v.name AS variant FROM vehicle_variants v JOIN vehicle_models m ON m.id = v.model_id
    JOIN vehicle_brands b ON b.id = m.brand_id WHERE v.status = 'active' AND m.status = 'active' AND b.status = 'active' ORDER BY b.name, m.name, v.name`);
  return {
    products: products.map((p) => ({ value: p.id, label: p.name, code: p.code })),
    variants: variants.map((v) => ({ value: v.id, label: `${v.brand} ${v.model} ${v.variant}` })),
    channelTypes: Object.entries(CHANNEL_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    standardRates: await standardRates(),
    rateChangeReasons: (await getSetting('promotions.rate_change_reasons', [])) || [],
    maxLockInYears: Number(await getSetting('promotions.max_lockin_years', 3)),
  };
}
