/**
 * Co-insurance participants of a risk (risk_participants), shared by broker slips, quotations, placement slips and
 * policies. One row per insurer with its share; exactly one lead; shares total exactly 100%. Sum insured, premium,
 * taxes, gross premium and commission are split by share (2 decimals) with the rounding remainder on the lead, so the
 * rows always add up to the entity's totals.
 *
 * Input accepted from the screens (old and new casings): [{ insuranceCompanyId | insuranceCompanyName | participantName,
 * sharePercentage | Sharepercentage | sharePercent | share, isLead | isPrimary, commissionRate, insurerReference }].
 */
import { z } from '../../lib/validate.js';
import { query } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { num, round2 } from '../documents/common.js';
import { insurerId } from '../policies/service.js';
import { assertFeature } from '../features/service.js';

const TOLERANCE = 0.0001;
const truthy = (v) => v === true || ['true', 'yes', '1'].includes(String(v ?? '').toLowerCase());

const shareOf = (p) => {
  const raw = p.sharePercent ?? p.sharePercentage ?? p.Sharepercentage ?? p.SharePercentage ?? p.share;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const refOf = (p) => p.insuranceCompanyId ?? p.insuranceCompanyName ?? p.InsuranceCompanyName ?? p.participantName ?? p.ParticipantName ?? p.insurerName ?? null;

/** Validated participants list (server-side rule: one lead, distinct insurers, shares > 0 totalling exactly 100). */
export const participantsSchema = z.array(z.object({
  insuranceCompanyId: z.number().int().positive(),
  sharePercent: z.number({ invalid_type_error: 'Each participant needs a share %' }).gt(0, 'A participant share must be more than 0%').max(100, 'A participant share cannot exceed 100%'),
  isLead: z.boolean(),
}).passthrough()).min(1, 'At least one insurer is required')
  .refine((l) => l.filter((p) => p.isLead).length === 1, { message: 'Exactly one participant must be the lead insurer' })
  .refine((l) => new Set(l.map((p) => p.insuranceCompanyId)).size === l.length, { message: 'An insurer can take part only once in the same risk' })
  .superRefine((l, ctx) => {
    const total = l.reduce((s, p) => s + p.sharePercent, 0);
    if (Math.abs(total - 100) > TOLERANCE) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Co-insurance shares must total exactly 100% (they total ${round2(total)}%)` });
  });

/**
 * Resolve and validate participants. `strict` (default) rejects unknown insurers; a list without any lead flag makes
 * the first participant the lead (the order the quote screen sends: primary insurer first).
 */
export async function normaliseParticipants(list, { db = null } = {}) {
  if (!Array.isArray(list) || !list.length) throw badRequest('At least one insurer is required');
  const out = [];
  for (const p of list) {
    const ref = refOf(p || {});
    const ic = await insurerId(db, ref);
    if (!ic) throw badRequest(ref ? `Insurer "${ref}" was not found in the insurer master` : 'Each participant needs an insurer');
    const share = shareOf(p);
    out.push({
      insuranceCompanyId: ic, sharePercent: share === null ? (list.length === 1 ? 100 : NaN) : share, isLead: truthy(p.isLead ?? p.isPrimary),
      commissionRate: p.commissionRate === undefined || p.commissionRate === null || p.commissionRate === '' ? null : (num(p.commissionRate) > 1 ? num(p.commissionRate) / 100 : num(p.commissionRate)),
      insurerReference: p.insurerReference || null,
    });
  }
  // more than one insurer on a risk is co-insurance, a feature this environment may not run (modules/features)
  if (out.length > 1) await assertFeature('coinsurance', { write: true });
  if (!out.some((p) => p.isLead)) out[0].isLead = true;
  const r = participantsSchema.safeParse(out.map((p) => ({ ...p, sharePercent: Number.isNaN(p.sharePercent) ? undefined : p.sharePercent })));
  if (!r.success) {
    const issue = r.error.issues[0];
    throw badRequest(issue.message, { issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  return out;
}

/**
 * Participants of a quote-like document (doc.participantDetails / body.participants) for backward compatibility:
 * co-insurance (doc.isCoInsurance or more than one participant) is validated strictly; a single insurer, or none,
 * becomes 100% of `fallbackInsurerId` (or the one named) when it is known. Returns [] when no insurer is known.
 */
export async function participantsFromDoc(doc, fallbackInsurerId, { db = null, explicit = null } = {}) {
  const list = explicit || (Array.isArray(doc?.participantDetails) ? doc.participantDetails.filter(Boolean) : []);
  const co = explicit ? explicit.length > 1 : (truthy(doc?.isCoInsurance) && list.length > 1);
  if (co) return normaliseParticipants(list, { db });
  if (explicit && explicit.length === 1) return normaliseParticipants(explicit, { db });
  const ic = fallbackInsurerId || (list[0] ? await insurerId(db, refOf(list[0])) : null);
  return ic ? [{ insuranceCompanyId: ic, sharePercent: 100, isLead: true, commissionRate: null, insurerReference: list[0]?.insurerReference || null }] : [];
}

export const leadOf = (parts) => parts.find((p) => p.isLead) || parts[0] || null;

/** Split totals { sumInsured, premium, taxes, premiumTotal, commissionAmount } by share; the lead takes the remainder. */
export function splitParticipants(parts, totals) {
  const keys = ['sumInsured', 'premium', 'taxes', 'premiumTotal', 'commissionAmount'];
  const rows = parts.map((p) => ({ ...p }));
  const others = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const p of rows.filter((x) => !x.isLead)) {
    for (const k of keys) { p[k] = round2(num(totals[k]) * p.sharePercent / 100); others[k] = round2(others[k] + p[k]); }
  }
  const lead = rows.find((x) => x.isLead);
  if (lead) for (const k of keys) lead[k] = round2(num(totals[k]) - others[k]);
  return rows;
}

/**
 * Replace the participants of an entity. Existing binding confirmations (insurer reference, confirmed_at) of insurers
 * that stay on the risk are kept. Returns the rows written.
 */
export async function writeParticipants(db, entityType, entityId, parts, totals, { userId = null, status = 'active', commissionRate = null } = {}) {
  const c = db || { query };
  const prev = (await c.query('SELECT insurance_company_id, insurer_reference, confirmed_at, confirmed_by, status FROM risk_participants WHERE entity_type = $1 AND entity_id = $2',
    [entityType, String(entityId)])).rows;
  const byIc = new Map(prev.map((r) => [r.insurance_company_id, r]));
  await c.query('DELETE FROM risk_participants WHERE entity_type = $1 AND entity_id = $2', [entityType, String(entityId)]);
  const rows = splitParticipants(parts, totals);
  for (const p of rows) {
    const old = byIc.get(p.insuranceCompanyId);
    await c.query(`INSERT INTO risk_participants(entity_type, entity_id, insurance_company_id, is_lead, share_percent, sum_insured, premium, taxes, premium_total,
        commission_rate, commission_amount, insurer_reference, status, confirmed_at, confirmed_by, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [entityType, String(entityId), p.insuranceCompanyId, p.isLead, p.sharePercent, p.sumInsured, p.premium, p.taxes, p.premiumTotal,
      p.commissionRate ?? commissionRate, p.commissionAmount, p.insurerReference || old?.insurer_reference || null,
      p.status || (old && status !== 'active' ? old.status : status), 'confirmedAt' in p ? p.confirmedAt : (old?.confirmed_at || null),
      'confirmedAt' in p ? (p.confirmedBy || null) : (old?.confirmed_by || null), userId]);
  }
  return rows;
}

/** Participants of an entity in API shape (lead first). */
export async function participantsOf(entityType, entityId, db = null) {
  const r = await (db || { query }).query(`SELECT rp.*, ic.name AS insurer_name, ic.code AS insurer_code, ic.contact_email FROM risk_participants rp
    JOIN insurance_companies ic ON ic.id = rp.insurance_company_id WHERE rp.entity_type = $1 AND rp.entity_id = $2
    ORDER BY rp.is_lead DESC, rp.share_percent DESC, rp.id`, [entityType, String(entityId)]);
  return r.rows.map(toParticipant);
}

export function toParticipant(r) {
  return {
    participantId: r.id, insuranceCompanyId: r.insurance_company_id, insuranceCompanyName: r.insurer_name, insurerCode: r.insurer_code,
    insurerEmail: r.contact_email, isLead: r.is_lead, role: r.is_lead ? 'Lead' : 'Co-insurer', sharePercent: Number(r.share_percent), sharePercentage: Number(r.share_percent),
    sumInsured: Number(r.sum_insured), premium: Number(r.premium), taxes: Number(r.taxes), premiumTotal: Number(r.premium_total),
    commissionRate: r.commission_rate == null ? null : Number(r.commission_rate), commissionAmount: Number(r.commission_amount),
    insurerReference: r.insurer_reference, status: r.status, confirmedAt: r.confirmed_at || null,
  };
}

/** The legacy doc.participantDetails the existing screens read (one casing; lead first). */
export async function legacyParticipantDetails(parts, db = null, currency = null) {
  const ids = parts.map((p) => p.insuranceCompanyId);
  const names = new Map((await (db || { query }).query('SELECT id, name FROM insurance_companies WHERE id = ANY($1)', [ids])).rows.map((r) => [r.id, r.name]));
  return [...parts].sort((a, b) => Number(b.isLead) - Number(a.isLead)).map((p) => ({
    insuranceCompanyId: p.insuranceCompanyId, insuranceCompanyName: names.get(p.insuranceCompanyId) || null, participantName: names.get(p.insuranceCompanyId) || null,
    sharePercentage: String(p.sharePercent), isLead: p.isLead, ...(currency ? { sumInsuredCurrency: currency, premiumCurrency: currency } : {}),
  }));
}

/** Participants of an existing entity as normalised input (to copy them to the next step of the journey). */
export async function participantInputs(entityType, entityId, db = null) {
  return (await participantsOf(entityType, entityId, db)).filter((p) => p.status !== 'declined' && p.status !== 'withdrawn').map((p) => ({
    insuranceCompanyId: p.insuranceCompanyId, sharePercent: p.sharePercent, isLead: p.isLead, commissionRate: p.commissionRate, insurerReference: p.insurerReference,
  }));
}

/**
 * Copy the participants of one entity to another (e.g. placement -> policy, expiring policy -> renewal term) with the
 * target's totals; falls back to 100% of `fallbackInsurerId` when the source has none.
 */
export async function copyParticipants(db, from, to, totals, { fallbackInsurerId = null, userId = null, status = 'active', keepReferences = true } = {}) {
  let parts = from ? await participantInputs(from.type, from.id, db) : [];
  if (!keepReferences) parts = parts.map((p) => ({ ...p, insurerReference: null }));
  if (!parts.length && fallbackInsurerId) parts = [{ insuranceCompanyId: fallbackInsurerId, sharePercent: 100, isLead: true, commissionRate: null, insurerReference: null }];
  if (!parts.length) return [];
  return writeParticipants(db, to.type, to.id, parts, totals, { userId, status });
}
