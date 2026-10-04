/**
 * Premium tax and charge calculator (no database access, so every formula is unit tested).
 *
 * calculateCharges(rules, { premium, line, regime, property, lguRate, includeFlat, date }) returns the charges of one
 * premium (a policy, a quotation or one section of a package):
 *   VAT          rate % of the premium, products under the VAT regime
 *   Premium Tax  rate % of the premium, products under the premium tax regime (instead of VAT)
 *   DST          per_unit: unit_amount for every unit_size of premium; a fractional unit counts as a whole unit
 *                (round_up, the NIRC "or fractional part thereof") or proportionally (prorate)
 *   FST          rate % of the premium of fire / property lines (rule lines) or of a section flagged as property
 *   LGT          the city / municipality rate (lguRate, percent), else the rule rate
 *   other        percent, per unit or flat (a flat charge once per document: includeFlat false leaves it out)
 * Every amount is rounded to 2 decimals (half away from zero) on its own; the totals add the rounded amounts, so the
 * printed lines always add up. A negative premium (return premium) gives negative charges.
 */
import { round2 } from '../../lib/money.js';

export const RULE_KINDS = ['vat', 'premium_tax', 'dst', 'fst', 'lgt', 'other'];
export const RULE_METHODS = ['percent', 'per_unit', 'flat'];
export const TAX_REGIMES = ['vat', 'premium_tax', 'exempt'];

/** Product line of a line of business code (MOTOR, FIRE, IAR ...) or a product line (motor, fire ...). */
export function lineOf(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'iar' || v.includes('industrial') || v.includes('fire') || v === 'property' || v.includes('householder')) return 'fire';
  if (v.includes('motor') || v === 'ctpl') return 'motor';
  if (v === 'pa' || v.includes('accident') || v === 'travel' || v === 'micro') return 'accident';
  if (v === 'eb' || v.includes('employee')) return 'eb';
  return v;
}

/** Is a rule in force on a date (YYYY-MM-DD; no date: in force when active)? */
export function inForce(rule, date = null) {
  if (rule.active === false) return false;
  if (!date) return true;
  const from = rule.effectiveFrom || rule.effective_from || null;
  const to = rule.effectiveTo || rule.effective_to || null;
  return (!from || String(from) <= date) && (!to || String(to) >= date);
}

const listOf = (v) => (Array.isArray(v) && v.length ? v.map((x) => String(x).toLowerCase()) : null);

/** Does the rule apply to a premium of this line and tax regime? property: true / false forces the fire service tax. */
export function ruleApplies(rule, { line = null, regime = 'vat', property = null } = {}) {
  const lines = listOf(rule.lines);
  const regimes = listOf(rule.regimes);
  if (regimes && !regimes.includes(String(regime || 'vat').toLowerCase())) return false;
  if (rule.kind === 'fst' && property !== null && property !== undefined) return Boolean(property);
  if (lines && !lines.includes(lineOf(line) || '')) return false;
  return true;
}

/**
 * Amount of one rule on a base premium. rate is a percent (12 = 12%); lguRate (percent) replaces the rate of the LGT
 * rule. Returns { rate, amount } with the rate that was used.
 */
export function chargeAmount(rule, base, { lguRate = null } = {}) {
  const b = Number(base) || 0;
  if (!b) return { rate: Number(rule.rate) || 0, amount: 0 };
  const sign = b < 0 ? -1 : 1;
  const abs = Math.abs(b);
  const method = rule.method || 'percent';
  let rate = Number(rule.rate) || 0;
  let amount = 0;
  if (rule.kind === 'lgt' && lguRate !== null && lguRate !== undefined && lguRate !== '') rate = Number(lguRate) || 0;
  if (method === 'percent') {
    amount = round2((abs * rate) / 100);
  } else if (method === 'per_unit') {
    const size = Number(rule.unitSize ?? rule.unit_size) || 0;
    const each = Number(rule.unitAmount ?? rule.unit_amount) || 0;
    if (size > 0) {
      const units = abs / size;
      // 1e-9 keeps an exact multiple (1000 / 4 = 250) from counting one unit more through binary rounding
      amount = (rule.fractionRule ?? rule.fraction_rule) === 'prorate' ? round2(units * each) : round2(Math.ceil(units - 1e-9) * each);
      rate = round2((each / size) * 100 * 10000) / 10000;
    }
  } else if (method === 'flat') {
    amount = round2(Number(rule.unitAmount ?? rule.unit_amount) || 0);
    rate = 0;
  }
  const min = Number(rule.minimumAmount ?? rule.minimum_amount) || 0;
  if (min > 0 && amount < min) amount = round2(min);
  return { rate, amount: sign < 0 ? -amount : amount };
}

const KEY_BY_KIND = { vat: 'vat', premium_tax: 'premiumTax', dst: 'dst', fst: 'fst', lgt: 'lgt', other: 'other' };

/** Empty result for a premium (no rule applies). */
const empty = (premium) => ({ premium: round2(premium), lines: [], vat: 0, premiumTax: 0, dst: 0, fst: 0, lgt: 0, other: 0, taxes: 0, totalCharges: 0, total: round2(premium) });

/**
 * Charges of one premium. rules: the rule rows (API or database shape); options as described at the top of the file.
 * Result: { premium, lines: [{ code, name, kind, method, rate, base, amount }], vat, premiumTax, dst, fst, lgt, other,
 * taxes (vat + premium tax + dst + fst + lgt), totalCharges (taxes + other), total (premium + totalCharges) }.
 */
export function calculateCharges(rules, { premium, line = null, regime = 'vat', property = null, lguRate = null, includeFlat = true, date = null } = {}) {
  const base = round2(premium);
  const out = empty(base);
  const sorted = [...(rules || [])].sort((a, b) => (Number(a.sortOrder ?? a.sort_order) || 0) - (Number(b.sortOrder ?? b.sort_order) || 0) || String(a.code).localeCompare(String(b.code)));
  for (const rule of sorted) {
    if (!inForce(rule, date)) continue;
    if (!RULE_KINDS.includes(rule.kind)) continue;
    // an exempt product carries no VAT or premium tax; the other taxes still apply
    if (regime === 'exempt' && (rule.kind === 'vat' || rule.kind === 'premium_tax')) continue;
    if (!ruleApplies(rule, { line, regime, property })) continue;
    if ((rule.method || 'percent') === 'flat' && !includeFlat) continue;
    if (!base && rule.method !== 'flat') continue;
    const { rate, amount } = chargeAmount(rule, base, { lguRate: rule.kind === 'lgt' ? lguRate : null });
    if (!amount) continue;
    out.lines.push({ code: rule.code, name: rule.name, kind: rule.kind, method: rule.method || 'percent', rate, base: rule.method === 'flat' ? 0 : base, amount });
    const key = KEY_BY_KIND[rule.kind];
    out[key] = round2(out[key] + amount);
  }
  out.taxes = round2(out.vat + out.premiumTax + out.dst + out.fst + out.lgt);
  out.totalCharges = round2(out.taxes + out.other);
  out.total = round2(base + out.totalCharges);
  return out;
}

/** Add charge results (sections of a package): every amount and the lines by code. */
export function sumCharges(results) {
  const out = empty(0);
  const byCode = new Map();
  for (const r of results || []) {
    out.premium = round2(out.premium + (Number(r.premium) || 0));
    for (const k of ['vat', 'premiumTax', 'dst', 'fst', 'lgt', 'other', 'taxes', 'totalCharges', 'total']) out[k] = round2(out[k] + (Number(r[k]) || 0));
    for (const l of r.lines || []) {
      const cur = byCode.get(l.code);
      if (cur) { cur.amount = round2(cur.amount + l.amount); cur.base = round2(cur.base + l.base); } else byCode.set(l.code, { ...l });
    }
  }
  out.lines = [...byCode.values()];
  return out;
}
