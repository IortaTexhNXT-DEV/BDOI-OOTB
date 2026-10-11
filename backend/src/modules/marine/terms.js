/**
 * Terms of an open cover (FR-PCL-001 to 005): the contract fields that an endorsement can change, their checks, the
 * terms in force on a date (after the approved endorsements of the open policy) and the taxes inside a flat premium.
 *
 * Parcel / Courier: covers on each certificate (name, line Marine or Personal Accident, insurer policy number, sum
 * insured, premium inclusive of taxes, commission %, cover days), the charge per certificate billed to the client (at
 * least the premium per certificate; the difference is the broker's service fee) and the delivery types (reference).
 * Every cover: remittance basis (net / gross), daily declaration, declaration file frequency, layout and e-mail.
 */
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { num, round2 } from '../documents/common.js';
import { chargesFor } from '../premium-charges/service.js';

export const COVER_TYPES = ['cargo', 'parcel'];
export const BASES = ['net', 'gross'];
export const FILE_FREQUENCIES = ['monthly', 'daily'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validEmail = (v) => EMAIL_RE.test(String(v || '').trim());

/** Fields of the contract an endorsement may change (camelCase) and their columns. Client, insurer, type and period start never change. */
export const TERM_FIELDS = {
  periodTo: 'period_to', goodsDescription: 'goods_description', voyageScope: 'voyage_scope', clauses: 'clauses', insurerReference: 'insurer_reference',
  rates: 'rates', markupPercent: 'markup_percent', minimumPremium: 'minimum_premium', commissionRate: 'commission_rate', declarationFrequency: 'declaration_frequency',
  covers: 'covers', chargePerCertificate: 'charge_per_certificate', deliveryTypes: 'delivery_types', remittanceBasis: 'remittance_basis',
  dailyDeclaration: 'daily_declaration', fileFrequency: 'file_frequency', fileLayout: 'file_layout', declarationEmail: 'declaration_email',
};
export const JSON_TERMS = new Set(['rates', 'covers', 'deliveryTypes']);

const coverOf = (c) => ({
  name: String(c.name ?? '').trim(), line: String(c.line ?? '').trim().toUpperCase(), insurerPolicyNo: String(c.insurerPolicyNo ?? '').trim(),
  sumInsured: round2(num(c.sumInsured)), premium: round2(num(c.premium)), commissionPercent: round2(num(c.commissionPercent)),
  coverDays: c.coverDays === null || c.coverDays === undefined || c.coverDays === '' ? null : Number(c.coverDays),
});

/** The terms of an open cover row, in API shape. */
export const termsOf = (r) => ({
  periodTo: String(r.period_to).slice(0, 10), goodsDescription: r.goods_description, voyageScope: r.voyage_scope, clauses: r.clauses, insurerReference: r.insurer_reference,
  rates: (r.rates || []).map((x) => ({ conveyance: x.conveyance, ratePercent: Number(x.ratePercent), limit: Number(x.limit) })),
  markupPercent: Number(r.markup_percent), minimumPremium: Number(r.minimum_premium), commissionRate: r.commission_rate == null ? null : Number(r.commission_rate),
  declarationFrequency: r.declaration_frequency, covers: (r.covers || []).map(coverOf), chargePerCertificate: r.charge_per_certificate == null ? null : Number(r.charge_per_certificate),
  deliveryTypes: r.delivery_types || [], remittanceBasis: r.remittance_basis, dailyDeclaration: r.daily_declaration, fileFrequency: r.file_frequency || null,
  fileLayout: r.file_layout || null, declarationEmail: r.declaration_email || null,
});

/** Premium per certificate of a set of parcel covers (sum of the cover premiums). */
export const premiumPerCertificate = (covers) => round2((covers || []).reduce((s, c) => s + num(c.premium), 0));

/** The declaration file layouts (marine.declaration_file_layouts): { code: { label, kind, fileName, columns } }. */
export async function fileLayouts() {
  const v = await getSetting('marine.declaration_file_layouts', {});
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

/** Covers on each parcel certificate: at least one, at most parcel.max_covers, unique names, Marine or PA, amounts above zero. */
export async function validCovers(list) {
  const errors = [];
  const covers = (Array.isArray(list) ? list : []).map(coverOf);
  if (!covers.length) errors.push({ path: 'covers', message: 'Add at least one cover to the open cover', code: 'MSG-PCL-006' });
  const max = Number(await getSetting('parcel.max_covers', 5)) || 5;
  if (covers.length > max) errors.push({ path: 'covers', message: `At most ${max} covers can be on one certificate` });
  const lines = ((await getSetting('parcel.cover_lines', ['MARINE', 'PA'])) || []).map((x) => String(x).toUpperCase());
  const seen = new Set();
  for (const [i, c] of covers.entries()) {
    if (!c.name) errors.push({ path: `covers.${i}.name`, message: 'Cover name is required' });
    const key = c.name.toLowerCase();
    if (c.name && seen.has(key)) errors.push({ path: `covers.${i}.name`, message: `Cover ${c.name} is listed twice`, code: 'MSG-PCL-007' });
    seen.add(key);
    if (!(c.sumInsured > 0) || !(c.premium > 0)) errors.push({ path: `covers.${i}.premium`, message: 'Enter a sum insured and a premium greater than zero', code: 'MSG-PCL-008' });
    if (c.commissionPercent < 0 || c.commissionPercent > 100) errors.push({ path: `covers.${i}.commissionPercent`, message: 'The commission must be between 0% and 100%', code: 'MSG-PCL-009' });
    if (!lines.includes(c.line)) errors.push({ path: `covers.${i}.line`, message: 'A parcel cover must be on the Marine or Personal Accident line', code: 'MSG-PCL-010' });
    if (c.coverDays !== null && !(Number.isInteger(c.coverDays) && c.coverDays > 0)) errors.push({ path: `covers.${i}.coverDays`, message: 'Cover days must be a whole number of days, or empty for transit' });
  }
  return { covers, errors };
}

/** Rates and limits per conveyance of a cargo cover. */
export async function validRates(rates) {
  const allowed = (await getSetting('marine.conveyances', ['Sea', 'Air', 'Land'])) || [];
  const errors = [];
  if (!Array.isArray(rates) || !rates.length) errors.push({ path: 'rates', message: 'At least one conveyance with its rate and limit is required' });
  const seen = new Set();
  for (const [i, r] of (rates || []).entries()) {
    if (!allowed.includes(r.conveyance)) errors.push({ path: `rates.${i}.conveyance`, message: `Conveyance must be one of ${allowed.join(', ')}` });
    if (seen.has(r.conveyance)) errors.push({ path: `rates.${i}.conveyance`, message: `${r.conveyance} is listed twice` });
    seen.add(r.conveyance);
    if (!(num(r.ratePercent) > 0)) errors.push({ path: `rates.${i}.ratePercent`, message: 'The rate must be greater than zero' });
    if (!(num(r.limit) > 0)) errors.push({ path: `rates.${i}.limit`, message: 'The limit per conveyance must be greater than zero' });
  }
  return { rates: (rates || []).map((r) => ({ conveyance: r.conveyance, ratePercent: num(r.ratePercent), limit: num(r.limit) })), errors };
}

/**
 * Check a complete set of terms of a cover type; returns the normalised terms or throws 400 with every problem.
 * Parcel: insurer's reference, covers, a charge not below the premium per certificate. Every type: a valid
 * declaration e-mail when a file frequency is set, a known layout.
 */
export async function checkTerms(type, t) {
  const errors = [];
  const out = { ...t };
  if (type === 'parcel') {
    if (!String(t.insurerReference || '').trim()) errors.push({ path: 'insurerReference', message: "Enter the insurer's open policy number", code: 'MSG-PCL-003' });
    const c = await validCovers(t.covers);
    errors.push(...c.errors);
    out.covers = c.covers;
    const premium = premiumPerCertificate(c.covers);
    const charge = t.chargePerCertificate === null || t.chargePerCertificate === undefined || t.chargePerCertificate === '' ? null : round2(num(t.chargePerCertificate));
    if (charge === null || !(charge > 0)) errors.push({ path: 'chargePerCertificate', message: 'Enter the charge per certificate billed to the client' });
    else if (charge < premium) errors.push({ path: 'chargePerCertificate', message: `The charge per certificate cannot be lower than the premium per certificate (${premium.toFixed(2)})`, code: 'MSG-PCL-011' });
    out.chargePerCertificate = charge;
    out.deliveryTypes = (Array.isArray(t.deliveryTypes) ? t.deliveryTypes : []).filter((d) => d && (d.code || d.label))
      .map((d) => ({ code: String(d.code || d.label).trim().toUpperCase(), label: String(d.label || d.code).trim(), charge: round2(num(d.charge)) }));
    out.rates = [];
    out.declarationFrequency = 'monthly';
  } else {
    const r = await validRates(t.rates);
    errors.push(...r.errors);
    out.rates = r.rates;
    out.covers = [];
    out.chargePerCertificate = null;
  }
  if (!BASES.includes(out.remittanceBasis)) errors.push({ path: 'remittanceBasis', message: 'The remittance basis is Net or Gross' });
  if (out.fileFrequency && !FILE_FREQUENCIES.includes(out.fileFrequency)) errors.push({ path: 'fileFrequency', message: 'The declaration file frequency is Monthly or Daily' });
  if (out.fileFrequency) {
    if (!validEmail(out.declarationEmail)) errors.push({ path: 'declarationEmail', message: 'Enter the e-mail address the declaration file is sent to', code: 'MSG-PCL-012' });
    const layouts = await fileLayouts();
    if (!out.fileLayout || !layouts[out.fileLayout]) errors.push({ path: 'fileLayout', message: 'Choose a declaration file layout', code: 'MSG-PCL-013' });
  } else if (out.declarationEmail && !validEmail(out.declarationEmail)) {
    errors.push({ path: 'declarationEmail', message: 'Enter the e-mail address the declaration file is sent to', code: 'MSG-PCL-012' });
  }
  if (errors.length) throw badRequest(errors[0].message, errors);
  return out;
}

/** Terms of an endorsement applied on terms (only the fields of TERM_FIELDS). */
export const applyChanges = (terms, changes) => ({ ...terms, ...Object.fromEntries(Object.entries(changes || {}).filter(([k, v]) => TERM_FIELDS[k] && v !== undefined)) });

/**
 * Terms in force on a date: the after-terms of the last approved endorsement effective on or before it; before the first
 * endorsement, the terms it replaced; without endorsements, the cover's own.
 */
export async function termsOn(db, cover, date) {
  const list = (await db.query("SELECT effective_from, before_terms, after_terms FROM open_cover_endorsements WHERE open_cover_id = $1 AND status = 'approved' ORDER BY effective_from, decided_at",
    [cover.id])).rows;
  if (!list.length) return termsOf(cover);
  const d = String(date).slice(0, 10);
  const inForce = list.filter((e) => String(e.effective_from).slice(0, 10) <= d).pop();
  return inForce ? inForce.after_terms : list[0].before_terms;
}

/** VAT, DST and LGT rates of a line (premium taxes engine, Premium Taxes & LGU Rates), as fractions of the net premium. */
export async function lineTaxRates(line, db = null) {
  const base = 1000000;
  const c = await chargesFor({ premium: base, lob: line, includeFlat: false }, db);
  return { vat: num(c.vat) / base, dst: num(c.dst) / base, lgt: num(c.lgt) / base };
}

/**
 * Taxes inside a premium inclusive of taxes (FRS PJRN-09 A.3): net = premium / (1 + VAT + DST + LGT), VAT and DST on
 * the net premium, each rounded to 2 decimals, the LGT takes the rounding difference.
 */
export function taxesInside(premium, rates) {
  const p = round2(premium);
  const net = round2(p / (1 + rates.vat + rates.dst + rates.lgt));
  const vat = round2(net * rates.vat);
  const dst = round2(net * rates.dst);
  return { premium: p, net, vat, dst, lgt: round2(p - net - vat - dst) };
}
