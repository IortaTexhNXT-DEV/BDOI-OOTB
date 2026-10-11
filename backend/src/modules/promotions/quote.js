/**
 * A promotion on a motor quotation (TIS-BRD-PROD-15, FR-PRM-020 to 024, 030, 033): which promotions are open to the
 * vehicle, the promotion rates applied, the promotion discount measured against the standard rates, the discount cap
 * of the product and channel type, the maker's Quotation discount authority (a discount above it is referred), the
 * unit counted when the quotation becomes a policy and given back when the policy is cancelled from inception.
 *
 * The quotation document carries the request `promotion` ({ code, odRate, rateReason }); the server replaces it with
 * the terms priced: code, version, line and rates, promotion discount, caps, order summary discount.
 */
import { badRequest, conflict, forbidden } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';
import { effectiveAuthority } from '../access-control/service.js';
import { capFor, channelTypeOf, CHANNEL_TYPE_LABELS } from './caps.js';
import { standardRates } from './rates.js';

export const DISCOUNT_RULE = 'PROMO_DISCOUNT';
const fail = (message, path = 'promotion.code') => badRequest(message, [{ path, message }]);
const shown = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');

/** The channel type of a quotation (FR-PRM-002 R3): its distribution channel, else agent / referrer, else direct. */
export async function quoteChannelType(c, doc, leadId) {
  let channelId = doc.channelId || null;
  if (!channelId && leadId) channelId = (await c.query('SELECT channel_id FROM leads WHERE id = $1', [leadId])).rows[0]?.channel_id || null;
  if (channelId) {
    const ch = (await c.query('SELECT channel_type FROM distribution_channels WHERE id = $1', [channelId])).rows[0];
    const type = channelTypeOf(ch?.channel_type);
    if (type) return type;
  }
  return String(doc.accountCode || doc.referrerCode || doc.agentCode || '').trim() ? 'agent' : 'direct';
}

/** The motor product of a quotation: its product, else the product named by its type, else the Motor product. */
async function motorProduct(c, productId, productType) {
  const r = (await c.query(`SELECT id, name, line FROM products WHERE ($1::int IS NOT NULL AND id = $1::int)
      OR ($1::int IS NULL AND (lower(code) = lower($2) OR lower(name) = lower($2) OR (line = 'motor' AND code = 'MOTOR' AND lower($2) IN ('motor', 'comprehensive'))))
    ORDER BY ($1::int IS NOT NULL AND id = $1::int) DESC, (lower(code) = lower($2)) DESC LIMIT 1`, [productId ? Number(productId) : null, productType || ''])).rows[0];
  return r || null;
}

/** The vehicle of the quotation: brand, model, variant names, the variant of the Vehicle master, model year and FMV. */
async function vehicleOf(c, doc) {
  const v = doc.insuranceVehicleDetails?.[0] || {};
  const brand = v.vehicleBrand || doc.vehicleBrand || null;
  const model = v.vehicleModel || doc.vehicleModel || null;
  const variant = v.modelVariant || doc.modelVariant || null;
  const row = brand && model && variant ? (await c.query(`SELECT vv.id FROM vehicle_variants vv JOIN vehicle_models m ON m.id = vv.model_id JOIN vehicle_brands b ON b.id = m.brand_id
    WHERE lower(b.name) = lower($1) AND lower(m.name) = lower($2) AND lower(vv.name) = lower($3) LIMIT 1`, [brand, model, variant])).rows[0] : null;
  return { brand, model, variant, variantId: row?.id ?? null, modelYear: Number(v.modelYear || doc.modelYear) || null, fmv: num(doc.lossAndDamageCoverage),
    condition: doc.vehicleCondition || (doc.brandNew === true ? 'Brand New' : null) };
}

const comprehensive = (doc) => ['COMP', 'COMPREHENSIVE'].includes(String(doc.insurancePolicyType || 'COMP').toUpperCase());

/** The units of a promotion code still counted. */
const unitsUsed = async (c, code) => (await c.query('SELECT count(*)::int AS n FROM promotion_units WHERE upper(promotion_code) = upper($1) AND returned_at IS NULL', [code])).rows[0].n;

/**
 * The reason a promotion version is not open to a quotation, or null; with the matching line when it is open.
 * ctx: { product, icId, channelType, vehicle, onDate, doc }.
 */
async function eligibility(c, p, ctx) {
  const where = `${ctx.product.name} through ${CHANNEL_TYPE_LABELS[ctx.channelType]}`;
  if (!(p.product_ids || []).map(Number).includes(Number(ctx.product.id))) return { reason: `Promotion ${p.code} is not open to this vehicle, product, insurer or channel` };
  if (ctx.icId && !(p.insurer_ids || []).map(Number).includes(Number(ctx.icId))) return { reason: `Promotion ${p.code} is not open to this vehicle, product, insurer or channel` };
  if (!(p.channel_types || []).includes(ctx.channelType)) return { reason: `Promotion ${p.code} is not open to ${where}` };
  if (!p.combine_dealer && ctx.doc.source === 'dealer-programme') return { reason: `Promotion ${p.code} cannot be combined with a Dealer Programme` };
  if (p.unit_quota && (await unitsUsed(c, p.code)) >= p.unit_quota) return { reason: `Promotion ${p.code} has used its quota of ${p.unit_quota} units` };
  const lines = (await c.query(`SELECT * FROM promotion_lines WHERE promotion_id = $1 AND variant_id = $2 AND $3::int BETWEEN year_from AND year_to
    AND (insurer_id IS NULL OR insurer_id = $4) ORDER BY line_no`, [p.id, ctx.vehicle.variantId, ctx.vehicle.modelYear, ctx.icId || null])).rows;
  if (!lines.length) return { reason: `Promotion ${p.code} is not open to this vehicle, product, insurer or channel` };
  const fmv = ctx.vehicle.fmv;
  const line = lines.find((l) => (l.fmv_from === null || fmv >= num(l.fmv_from)) && (l.fmv_to === null || fmv <= num(l.fmv_to)));
  if (!line) return { reason: `The fair market value of ${fmv.toLocaleString('en-PH', { minimumFractionDigits: 2 })} is outside the range of promotion ${p.code} for this variant` };
  return { line };
}

/** Common checks of a quotation before any promotion is looked at (FR-PRM-020): Motor, Comprehensive, brand new. */
async function vehicleContext(c, { doc, productId, productType, icId, leadId, onDate }) {
  const product = await motorProduct(c, productId, productType || doc.productType);
  if (!product || product.line !== 'motor') return { reason: 'Promotions apply to Motor products only' };
  if (!comprehensive(doc)) return { reason: 'Promotions apply to Comprehensive policies only' };
  const vehicle = await vehicleOf(c, doc);
  const tolerance = Number(await getSetting('promotions.new_vehicle_year_tolerance', 1));
  const policyYear = Number(String(isoDate(doc.inception || doc.inceptionDate) || onDate).slice(0, 4));
  if (vehicle.condition !== 'Brand New' || !vehicle.modelYear || vehicle.modelYear < policyYear - tolerance) return { reason: 'Promotions apply to brand-new vehicles only' };
  if (!vehicle.variantId) return { reason: 'No promotion is open to this vehicle' };
  return { ctx: { product, icId, channelType: await quoteChannelType(c, doc, leadId), vehicle, onDate, doc } };
}

/** Promotions open to a quotation document (FR-PRM-020), sorted by the lowest promo Own Damage rate. */
export async function openPromotions(c, input) {
  const onDate = input.onDate || (await today());
  const v = await vehicleContext(c, { ...input, onDate });
  if (v.reason) return { reason: v.reason, promotions: [] };
  const { rows } = await c.query("SELECT * FROM promotions WHERE status = 'active' AND $1::date BETWEEN period_from AND period_to ORDER BY code", [onDate]);
  const out = [];
  for (const p of rows) {
    const e = await eligibility(c, p, v.ctx);
    if (e.line) {
      out.push({ code: p.code, version: p.version, name: p.name, benefit: p.benefit, periodTo: isoDate(p.period_to), excess: num((p.excess || {})[String(v.ctx.product.id)]) || null,
        lineNo: e.line.line_no, promoOd: e.line.promo_od === null ? null : num(e.line.promo_od), minOd: e.line.min_od === null ? null : num(e.line.min_od),
        promoAon: e.line.promo_aon === null ? null : num(e.line.promo_aon), discountPct: e.line.discount_pct === null ? null : num(e.line.discount_pct) });
    }
  }
  out.sort((a, b) => (a.promoOd ?? 100) - (b.promoOd ?? 100));
  return { reason: out.length ? null : 'No promotion is open to this vehicle', channelType: v.ctx.channelType, promotions: out };
}

async function userHolds(c, userId, perm) {
  if (!userId) return false;
  return (await c.query(`SELECT EXISTS (SELECT 1 FROM user_effective_roles($1) r JOIN role_permissions rp ON rp.role_id = r.role_id
    JOIN permissions p ON p.id = rp.permission_id WHERE p.code = $2) AS ok`, [userId, perm])).rows[0].ok;
}

/** The roles whose Quotation discount limit covers a discount % (no limit counts). */
async function rolesCovering(c, pct, onDate) {
  const { rows } = await c.query(`SELECT DISTINCT l.role_code, COALESCE(r.name, l.role_code) AS name FROM authority_limits l LEFT JOIN roles r ON r.code = l.role_code
    WHERE l.transaction_type = 'quotation_discount' AND l.role_code IS NOT NULL AND l.status = 'active' AND (l.max_amount IS NULL OR l.max_amount >= $1)
      AND l.effective_from <= $2::date AND (l.effective_to IS NULL OR l.effective_to >= $2::date) ORDER BY 1`, [pct, onDate]);
  return rows;
}

/**
 * Apply the promotion of a quotation (create or change). `request` is what the user chose ({ code, odRate, rateReason },
 * null to remove), `previous` the terms the quotation was priced with. `price(doc)` prices a document. The document's
 * rates, discount and `promotion` are set; returns { b (the breakdown), authority (the discount referral or null) },
 * or null when the quotation carries no promotion.
 */
export async function applyPromotion(c, { request, requested = true, previous = null, doc, productId, productType, icId, leadId, userId, orderDiscount, onDate = null }, price) {
  const std = await standardRates();
  const code = String(request?.code || '').trim().toUpperCase();
  const restore = () => {
    delete doc.promotion;
    if (previous) {
      doc.lossAndDamageCoverageRate = std.ownDamage;
      doc.actsOfNatureRate = std.actsOfNature;
      doc.discount = num(orderDiscount);
    }
  };
  if (!code) { restore(); return null; }
  const date = onDate || (await today());
  const kept = previous && String(previous.code).toUpperCase() === code ? previous : null;
  const removeOrFail = (message) => {
    if (!kept) throw fail(message);
    restore();
    doc.promotionNotice = `Promotion ${code} was removed and the vehicle was priced at the standard rates: ${message}`;
    return null;
  };
  const v = await vehicleContext(c, { doc, productId, productType, icId, leadId, onDate: date });
  if (v.reason) return removeOrFail(v.reason);
  const versions = (await c.query('SELECT * FROM promotions WHERE upper(code) = $1 ORDER BY version DESC', [code])).rows;
  const active = versions.find((p) => p.status === 'active' && isoDate(p.period_from) <= date && isoDate(p.period_to) >= date);
  const keepOpen = (await getSetting('promotions.keep_on_open_quotes', true)) !== false;
  let p = active;
  if (!p && kept && keepOpen) p = versions.find((x) => x.id === kept.promotionId);
  if (!p) {
    const last = versions.find((x) => !['draft', 'pending-approval'].includes(x.status));
    if (!last) return removeOrFail(`Promotion ${code} was not found`);
    if (last.status === 'suspended') return removeOrFail(`Promotion ${code} is suspended`);
    if (['expired', 'withdrawn'].includes(last.status) || isoDate(last.period_to) < date) return removeOrFail(`Promotion ${code} ended on ${shown(isoDate(last.period_to))}`);
    return removeOrFail(`Promotion ${code} is not open to this vehicle, product, insurer or channel`);
  }
  const keptTerms = kept && p.id === kept.promotionId && !active;
  const e = keptTerms ? { line: (await c.query('SELECT * FROM promotion_lines WHERE promotion_id = $1 AND line_no = $2', [p.id, kept.lineNo])).rows[0] } : await eligibility(c, p, v.ctx);
  if (!e.line) return removeOrFail(e.reason);
  const line = e.line;
  if (num(orderDiscount) > 0 && !p.combine_discount) throw fail(`Promotion ${p.code} cannot be combined with an Order Summary discount`, 'discount');
  // the flexible issuing rate: lowered down to the line minimum by a holder of write:promotion-rates, with a reason
  let odRate = line.promo_od === null ? null : num(line.promo_od);
  let rateChange = null;
  if (p.benefit === 'rate') {
    // a quotation priced again without a new choice keeps its rate change only on the same promotion version
    const stored = !requested && (!kept?.rateChange || kept.version !== p.version);
    const asked = stored || request.odRate === undefined || request.odRate === null || request.odRate === '' ? null : num(request.odRate);
    if (asked !== null && asked !== odRate) {
      const same = kept?.rateChange && num(kept.odRate) === asked && kept.version === p.version;
      if (same) rateChange = kept.rateChange;
      else {
        if (!(await userHolds(c, userId, 'write:promotion-rates'))) throw forbidden('Only users with the right to change promotion rates can change this rate');
        if (asked < num(line.min_od ?? line.promo_od)) throw fail(`Own Damage coverage Rate cannot be lower than ${num(line.min_od)}% for this promotion`, 'promotion.odRate');
        if (asked > odRate) throw fail(`Own Damage coverage Rate cannot be higher than the promotion rate of ${odRate}%. Remove the promotion to use the standard rate`, 'promotion.odRate');
        const reasons = (await getSetting('promotions.rate_change_reasons', [])) || [];
        const reason = String(request.rateReason || '').trim();
        if (!reason) throw fail('Reason for the rate change is required', 'promotion.rateReason');
        if (reasons.length && !reasons.includes(reason)) throw fail(`Choose the reason for the rate change: ${reasons.join(', ')}`, 'promotion.rateReason');
        rateChange = { from: odRate, to: asked, reason, byId: userId, at: new Date().toISOString() };
      }
      odRate = asked;
    }
  }
  // the same quotation at the standard rates, then with the promotion
  const standard = await price({ ...doc, lossAndDamageCoverageRate: std.ownDamage, actsOfNatureRate: std.actsOfNature, discount: 0 });
  const ctpl = num(standard.ctplCoveragePremium);
  const discountable = round2(num(standard.grossPremium) - ctpl);
  let promoDiscount;
  let b;
  if (p.benefit === 'rate') {
    Object.assign(doc, { lossAndDamageCoverageRate: odRate, actsOfNatureRate: num(line.promo_aon), discount: num(orderDiscount) });
    b = await price(doc);
    promoDiscount = round2(num(standard.grossPremium) - (num(b.grossPremium) + num(b.discount)));
  } else {
    promoDiscount = round2((discountable * num(line.discount_pct)) / 100);
    Object.assign(doc, { lossAndDamageCoverageRate: std.ownDamage, actsOfNatureRate: std.actsOfNature, discount: round2(promoDiscount + num(orderDiscount)) });
    b = await price(doc);
  }
  const pct = (x) => (discountable > 0 ? round2((x / discountable) * 100) : 0);
  const totalPct = pct(promoDiscount + num(orderDiscount));
  const where = `${v.ctx.product.name} through ${CHANNEL_TYPE_LABELS[v.ctx.channelType]}`;
  const cap = await capFor(v.ctx.product.id, v.ctx.channelType, date, c);
  if (!cap) throw fail(`No approved discount cap for ${where}`);
  if (totalPct > cap.maxPct) throw fail(`The discount of ${totalPct.toFixed(2)}% is above the maximum of ${cap.maxPct.toFixed(2)}% for ${where}`, 'discount');
  if (totalPct < cap.minPct) throw fail(`The discount of ${totalPct.toFixed(2)}% is below the minimum of ${cap.minPct.toFixed(2)}% for ${where}`, 'discount');
  if (p.benefit === 'rate' && odRate < cap.lowestOd) throw fail(`Own Damage coverage Rate cannot be lower than ${cap.lowestOd}% for ${where}`, 'promotion.odRate');
  // the maker's Quotation discount authority: above it the quotation is approved by a role whose limit covers it
  const own = userId ? await effectiveAuthority(c, userId, 'quotation_discount', date) : { found: false };
  let authority = null;
  if (own.found && !own.unlimited && totalPct > num(own.limit)) {
    const roles = await rolesCovering(c, totalPct, date);
    authority = { ruleCode: DISCOUNT_RULE, pct: totalPct, limit: num(own.limit), authorityRoles: roles.map((r) => r.role_code), roleNames: Object.fromEntries(roles.map((r) => [r.role_code, r.name])),
      message: `The discount of ${totalPct.toFixed(2)}% is above the maker's quotation discount limit of ${num(own.limit).toFixed(2)}%: approval needed` };
  }
  const notice = kept && kept.version !== p.version ? `Promotion ${p.code} changed since this quotation was priced (version ${kept.version} to version ${p.version}). The new rates are used` : null;
  if (notice) doc.promotionNotice = notice; else delete doc.promotionNotice;
  doc.promotion = {
    code: p.code, version: p.version, promotionId: p.id, name: p.name, benefit: p.benefit, lineNo: line.line_no, validUntil: isoDate(p.period_to),
    promoOd: line.promo_od === null ? null : num(line.promo_od), minOd: line.min_od === null ? null : num(line.min_od), promoAon: line.promo_aon === null ? null : num(line.promo_aon),
    remitOd: line.remit_od === null ? null : num(line.remit_od), remitAon: line.remit_aon === null ? null : num(line.remit_aon), discountPct: line.discount_pct === null ? null : num(line.discount_pct),
    odRate: p.benefit === 'rate' ? odRate : null, rateChange, excess: num((p.excess || {})[String(v.ctx.product.id)]) || null, lockInYears: p.lockin_years,
    channelType: v.ctx.channelType, standardGrossPremium: num(standard.grossPremium), promoDiscount, promoDiscountPct: pct(promoDiscount), orderDiscount: num(orderDiscount),
    totalDiscountPct: totalPct, cap: { minPct: cap.minPct, maxPct: cap.maxPct, lowestOd: cap.lowestOd, remainingPct: round2(Math.max(0, cap.maxPct - pct(promoDiscount))) },
    pricedOn: date,
  };
  return { b, authority };
}

/**
 * The underwriting referral of a quotation with the discount authority merged in: approved again only for the same
 * discount %; otherwise pending for the roles whose limit covers it.
 */
export function withDiscountReferral(referral, authority, previous) {
  if (!authority) return referral;
  if (!referral && previous?.status === 'approved' && (previous.ruleCodes || []).includes(DISCOUNT_RULE) && num(previous.discountPct) === num(authority.pct)) return previous;
  const base = referral && referral.status === 'pending' ? referral : { status: 'pending', ruleCodes: [], authorityRoles: [], authorityRoleNames: [], reasons: [], requestedAt: new Date().toISOString() };
  const roles = [...new Set([...(base.authorityRoles || []), ...authority.authorityRoles])];
  const names = Object.fromEntries((base.authorityRoles || []).map((r, i) => [r, (base.authorityRoleNames || [])[i] || r]));
  return { ...base, ruleCodes: [...new Set([...(base.ruleCodes || []), DISCOUNT_RULE])], authorityRoles: roles,
    authorityRoleNames: roles.map((r) => names[r] || authority.roleNames[r] || r), reasons: [...(base.reasons || []), `${DISCOUNT_RULE}: ${authority.message}`], discountPct: authority.pct };
}

/** The chassis number of a quotation being converted. */
const chassisOf = (doc, extra) => String(extra.chassisNumber || extra.customerInfo?.chassisNumber || doc.chassisNumber || doc.insuranceVehicleDetails?.[0]?.chassisNumber || '').trim();

/**
 * At conversion (FR-PRM-024, 030): the chassis is on no earlier policy and the quota has a unit left; one unit is
 * counted and a promotion whose quota is used up expires.
 */
export async function countPromotionUnit(c, q, extra = {}, policyId = null) {
  const promo = q.doc?.promotion;
  if (!promo?.code) return null;
  const chassis = chassisOf(q.doc, extra);
  if (chassis) {
    const earlier = (await c.query(`SELECT policy_number FROM policies WHERE (upper(doc->>'chassisNumber') = upper($1) OR upper(details->>'chassisNumber') = upper($1))
      AND quote_id IS DISTINCT FROM $2 LIMIT 1`, [chassis, q.id])).rows[0];
    if (earlier) throw conflict(`Chassis number ${chassis} is already on policy ${earlier.policy_number}: the vehicle is not brand new. Remove promotion ${promo.code} from the quotation`);
  }
  const versions = (await c.query('SELECT id, unit_quota, status FROM promotions WHERE upper(code) = upper($1) ORDER BY version DESC FOR UPDATE', [promo.code])).rows;
  const quota = versions.find((v) => ['active', 'scheduled', 'suspended', 'expired', 'withdrawn'].includes(v.status))?.unit_quota ?? null;
  const used = await unitsUsed(c, promo.code);
  if (quota && used >= quota) throw conflict(`Promotion ${promo.code} has used its quota of ${quota} units: remove it from the quotation`);
  await c.query('INSERT INTO promotion_units(promotion_code, promotion_id, quote_id, policy_id) VALUES ($1,$2,$3,$4) ON CONFLICT (quote_id) DO NOTHING', [promo.code, promo.promotionId, q.id, policyId]);
  if (quota && used + 1 >= quota) await c.query("UPDATE promotions SET status = 'expired' WHERE upper(code) = upper($1) AND status IN ('active', 'scheduled', 'suspended')", [promo.code]);
  return { code: promo.code, used: used + 1, quota };
}

/** The unit of a policy's promotion is given back when the policy is cancelled from inception (FR-PRM-033). */
export async function returnPromotionUnit(c, policyId) {
  await c.query('UPDATE promotion_units SET returned_at = now() WHERE returned_at IS NULL AND policy_id = $1', [policyId]);
}
