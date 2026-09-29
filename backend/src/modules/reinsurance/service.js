/**
 * Reinsurance: reinsurers with a security-rating gate (minimum rating from configuration, scale from the
 * security-rating master), treaties with maker-checker approval, cessions with capacity checks, recoveries,
 * bordereaux, reconciliation, analytics and reports.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { notify } from '../notifications/router.js';
import { postEvent } from '../accounting/lib/posting.js';
import { assertChecker, isoDate, lastMonths, nextNumber, params, round2, saveFile, toCsv, toNumber } from '../masters/helpers.js';

const need = (b, fields) => {
  const errors = fields.filter((f) => b[f] === undefined || b[f] === null || (typeof b[f] === 'string' && !b[f].trim()) || (Array.isArray(b[f]) && !b[f].length))
    .map((f) => ({ path: f, message: `${f} is required` }));
  if (errors.length) throw badRequest('Validation failed', errors);
};

// ---------------- security rating gate ----------------

async function ratingScale() {
  const rows = await many('SELECT data FROM master_records WHERE type_code = \'security-rating\' AND status = \'active\'');
  return new Map(rows.map((r) => [String(r.data.rating).toUpperCase(), Number(r.data.rank)]));
}

export async function securityPolicy() {
  const scale = await ratingScale();
  const min = String(await getSetting('reinsurance.min_security_rating', 'A-'));
  return { scale, min, minRank: scale.get(min.toUpperCase()) ?? 0 };
}

const meets = (pol, rating) => (pol.scale.get(String(rating || '').toUpperCase()) ?? -1) >= pol.minRank;

/** Every reinsurer must exist, be active and meet the minimum security rating. */
export async function assertSecurity(ids, path = 'reinsurers') {
  const list = Array.isArray(ids) ? ids : [ids];
  const pol = await securityPolicy();
  const rows = await many('SELECT * FROM reinsurers WHERE id = ANY($1)', [list.map(String)]);
  const errors = [];
  for (const id of list) {
    const r = rows.find((x) => x.id === String(id));
    if (!r) errors.push({ path, message: `Reinsurer ${id} was not found` });
    else if (r.status !== 'Active') errors.push({ path, message: `${r.name} is not active` });
    else if (!meets(pol, r.rating)) errors.push({ path, message: `${r.name} is rated ${r.rating || 'NR'}; the minimum security rating is ${pol.min}` });
  }
  if (errors.length) throw badRequest('Security rating check failed', errors);
  return rows;
}

// ---------------- reinsurers ----------------

const reinsurerOut = (r, pol) => ({
  id: r.id, name: r.name, shortName: r.short_name, type: r.type, country: r.country, rating: r.rating, ratingAgency: r.rating_agency, capacity: r.capacity,
  contact: r.contact || {}, status: r.status, meetsMinimumRating: pol ? meets(pol, r.rating) : undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function listReinsurers(qs = {}) {
  const pol = await securityPolicy();
  const rows = await many(`SELECT * FROM reinsurers WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR name ILIKE $2 OR short_name ILIKE $2 OR id ILIKE $2) ORDER BY id`,
    [qs.status || null, qs.search ? `%${qs.search}%` : null]);
  return { rows: rows.map((r) => reinsurerOut(r, pol)), minimumRating: pol.min };
}

export async function getReinsurer(id) {
  const r = await one('SELECT * FROM reinsurers WHERE id = $1', [String(id)]);
  if (!r) throw notFound('Reinsurer not found');
  return reinsurerOut(r, await securityPolicy());
}

async function validRating(rating) {
  if (!rating) return;
  const pol = await securityPolicy();
  if (!pol.scale.has(String(rating).toUpperCase())) throw badRequest('Validation failed', [{ path: 'rating', message: `Rating ${rating} is not in the security-rating master` }]);
}

export async function createReinsurer(b, user) {
  need(b, ['name', 'type', 'rating']);
  await validRating(b.rating);
  if (await one('SELECT 1 FROM reinsurers WHERE lower(name) = lower($1)', [b.name])) throw conflict(`Reinsurer ${b.name} already exists`);
  const id = b.id && /^[A-Za-z0-9-]{2,20}$/.test(b.id) ? b.id : await nextNumber('reinsurer');
  await query(`INSERT INTO reinsurers(id, name, short_name, type, country, rating, rating_agency, capacity, contact, status, created_by, updated_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
  [id, b.name, b.shortName || null, b.type, b.country || null, String(b.rating).toUpperCase(), b.ratingAgency || null, b.capacity || null, JSON.stringify(b.contact || {}), b.status || 'Active', user.username]);
  return getReinsurer(id);
}

export async function updateReinsurer(id, b, user) {
  const before = await getReinsurer(id);
  await validRating(b.rating);
  if (b.status && !['Active', 'Inactive', 'Suspended'].includes(b.status)) throw badRequest('Validation failed', [{ path: 'status', message: 'status must be Active, Inactive or Suspended' }]);
  await query(`UPDATE reinsurers SET name = COALESCE($2, name), short_name = COALESCE($3, short_name), type = COALESCE($4, type), country = COALESCE($5, country),
               rating = COALESCE($6, rating), rating_agency = COALESCE($7, rating_agency), capacity = COALESCE($8, capacity), contact = COALESCE($9, contact),
               status = COALESCE($10, status), updated_by = $11, updated_at = now() WHERE id = $1`,
  [before.id, b.name || null, b.shortName || null, b.type || null, b.country || null, b.rating ? String(b.rating).toUpperCase() : null, b.ratingAgency || null, b.capacity || null,
    b.contact ? JSON.stringify(b.contact) : null, b.status || null, user.username]);
  return { before, after: await getReinsurer(id) };
}

// ---------------- treaties ----------------

const TREATY_SELECT = `SELECT t.*,
  (SELECT COALESCE(sum(c.ceded_premium), 0) FROM cessions c WHERE c.treaty_id = t.id AND c.status IN ('Pending', 'Confirmed')) AS premium_ceded,
  (SELECT COALESCE(sum(c.ceded_sum), 0) FROM cessions c WHERE c.treaty_id = t.id AND c.status IN ('Pending', 'Confirmed')) AS ceded_sum_total,
  (SELECT COALESCE(sum(r.settlement_amount), 0) FROM reinsurance_recoveries r WHERE r.treaty_id = t.id AND r.status = 'Recovered') AS claims_recovered,
  (SELECT count(*)::int FROM cessions c WHERE c.treaty_id = t.id AND c.status IN ('Pending', 'Confirmed')) AS cession_count
  FROM reinsurance_treaties t`;

/** Capacity used by the utilization figure: capacity column, else the quota-share maximum limit. */
const capacityOf = (t) => toNumber(t.capacity, 0) || toNumber(t.terms?.cession?.maxLimit, 0) || toNumber(t.terms?.capacity, 0);

async function reinsurerDetails(ids) {
  if (!ids?.length) return [];
  const rows = await many('SELECT id, name, short_name, rating FROM reinsurers WHERE id = ANY($1)', [ids.map(String)]);
  return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean).map((r) => ({ id: r.id, name: r.name, shortName: r.short_name, rating: r.rating }));
}

export async function treatyOut(t) {
  const cap = capacityOf(t);
  const util = cap ? round2((Number(t.ceded_sum_total) / cap) * 100) : 0;
  return {
    ...t.terms, id: t.id, treatyNumber: t.treaty_number, name: t.name, type: t.treaty_type, lineOfBusiness: t.line_of_business, reinsurers: t.reinsurer_ids,
    reinsurerDetails: await reinsurerDetails(t.reinsurer_ids), effectiveDate: t.period_from, expiryDate: t.period_to, retention: t.retention ?? t.terms?.retention ?? null,
    capacity: t.capacity ?? t.terms?.capacity ?? null, share: t.share, securityRating: t.security_rating, currency: t.currency, status: t.status,
    utilization: util, premiumCeded: round2(t.premium_ceded), claimsRecovered: round2(t.claims_recovered), cededSumInsured: round2(t.ceded_sum_total), cessionCount: t.cession_count,
    availableCapacity: cap ? round2(cap - Number(t.ceded_sum_total)) : null, createdBy: t.created_by, approvedBy: t.approved_by, approvedAt: t.approved_at, rejectionReason: t.rejection_reason,
    createdAt: t.created_at, updatedAt: t.updated_at,
  };
}

async function treatyRow(id) {
  const t = await one(`${TREATY_SELECT} WHERE t.id::text = $1 OR lower(t.treaty_number) = lower($1)`, [String(id)]);
  if (!t) throw notFound('Treaty not found');
  return t;
}
export const getTreaty = async (id) => treatyOut(await treatyRow(id));

export async function listTreaties(qs = {}) {
  const p = params();
  const conds = ['TRUE'];
  if (qs.status) conds.push(`t.status = ${p.add(qs.status)}`);
  if (qs.type) conds.push(`t.treaty_type = ${p.add(qs.type)}`);
  if (qs.lineOfBusiness) conds.push(`t.line_of_business = ${p.add(qs.lineOfBusiness)}`);
  if (qs.reinsurer) conds.push(`t.reinsurer_ids ? ${p.add(qs.reinsurer)}`);
  if (qs.search) conds.push(`(t.name ILIKE ${p.add(`%${qs.search}%`)} OR t.treaty_number ILIKE $${p.values.length})`);
  const rows = await many(`${TREATY_SELECT} WHERE ${conds.join(' AND ')} ORDER BY t.period_from DESC, t.id`, p.values);
  const out = [];
  for (const r of rows) out.push(await treatyOut(r));
  return out;
}

const TERM_KEYS = ['cession', 'commission', 'layers', 'lines', 'trigger', 'events', 'premium', 'retention', 'capacity', 'notes', 'reinstatements', 'territory', 'exclusions'];

function treatyColumns(b) {
  const terms = Object.fromEntries(TERM_KEYS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));
  const pct = toNumber(b.cession?.percentage, NaN);
  const comm = toNumber(b.commission?.rate, NaN);
  const retention = toNumber(b.retention ?? b.cession?.retention, NaN);
  const capacity = toNumber(b.capacity, NaN);
  return { terms, share: Number.isFinite(pct) ? pct / 100 : null, commission: Number.isFinite(comm) ? comm : null,
    retention: Number.isFinite(retention) ? retention : null, capacity: Number.isFinite(capacity) ? capacity : null };
}

function validateTreatyDates(from, to) {
  if (!from || !to) throw badRequest('Validation failed', [{ path: 'effectiveDate', message: 'Effective and expiry dates are required' }]);
  if (to <= from) throw badRequest('Validation failed', [{ path: 'expiryDate', message: 'Expiry date must be after the effective date' }]);
}

export async function createTreaty(b, user) {
  need(b, ['name', 'type', 'lineOfBusiness', 'reinsurers', 'effectiveDate', 'expiryDate']);
  const from = isoDate(b.effectiveDate);
  const to = isoDate(b.expiryDate);
  validateTreatyDates(from, to);
  const rs = await assertSecurity(b.reinsurers);
  const number = b.treatyNumber ? String(b.treatyNumber).trim() : await nextNumber('treaty');
  if (await one('SELECT 1 FROM reinsurance_treaties WHERE lower(treaty_number) = lower($1)', [number])) throw conflict(`Treaty ${number} already exists`);
  const c = treatyColumns(b);
  const pol = await securityPolicy();
  const lowest = [...rs].sort((x, y) => (pol.scale.get(x.rating) ?? 0) - (pol.scale.get(y.rating) ?? 0))[0]?.rating || null;
  const approval = await getSetting('reinsurance.treaty_requires_approval', true);
  const status = approval ? 'Pending Approval' : 'Active';
  const r = await one(`INSERT INTO reinsurance_treaties(name, reinsurer, security_rating, treaty_type, capacity, share, period_from, period_to, status, treaty_number, line_of_business,
      reinsurer_ids, terms, currency, retention, commission_rate, created_by, updated_by, submitted_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$17) RETURNING id`,
  [b.name, rs.map((x) => x.name).join(', '), lowest, b.type, c.capacity, c.share, from, to, status, number, b.lineOfBusiness, JSON.stringify(b.reinsurers.map(String)), JSON.stringify(c.terms),
    b.currency || (await getSetting('currency.default', 'PHP')), c.retention, c.commission, user.id]);
  if (approval) await notify({ audience: 'write:reinsurance', type: 'approval', title: 'Treaty awaiting approval', message: `${number} ${b.name} needs approval`, link: '/master/reinsurance/treaty', entity: 'treaty', entityId: r.id });
  return getTreaty(r.id);
}

export async function updateTreaty(id, b, user) {
  const before = await treatyRow(id);
  if (['Expired', 'Cancelled'].includes(before.status)) throw conflict(`A ${before.status.toLowerCase()} treaty cannot be changed`);
  const from = isoDate(b.effectiveDate) || before.period_from;
  const to = isoDate(b.expiryDate) || before.period_to;
  validateTreatyDates(from, to);
  const reinsurers = b.reinsurers ? b.reinsurers.map(String) : before.reinsurer_ids;
  const rs = await assertSecurity(reinsurers);
  const c = treatyColumns({ ...before.terms, ...b });
  if (b.treatyNumber && b.treatyNumber !== before.treaty_number && await one('SELECT 1 FROM reinsurance_treaties WHERE lower(treaty_number) = lower($1) AND id <> $2', [b.treatyNumber, before.id])) {
    throw conflict(`Treaty ${b.treatyNumber} already exists`);
  }
  const approval = await getSetting('reinsurance.treaty_requires_approval', true);
  const status = approval && ['Active', 'Rejected'].includes(before.status) ? 'Pending Approval' : before.status;
  await query(`UPDATE reinsurance_treaties SET name = $2, reinsurer = $3, treaty_type = $4, capacity = $5, share = $6, period_from = $7, period_to = $8, status = $9, treaty_number = $10,
      line_of_business = $11, reinsurer_ids = $12, terms = $13, retention = $14, commission_rate = $15, updated_by = $16, submitted_by = CASE WHEN $9 = 'Pending Approval' THEN $16 ELSE submitted_by END,
      rejection_reason = NULL, updated_at = now() WHERE id = $1`,
  [before.id, b.name || before.name, rs.map((x) => x.name).join(', '), b.type || before.treaty_type, c.capacity ?? before.capacity, c.share ?? before.share, from, to, status,
    b.treatyNumber || before.treaty_number, b.lineOfBusiness || before.line_of_business, JSON.stringify(reinsurers), JSON.stringify(c.terms), c.retention ?? before.retention, c.commission ?? before.commission_rate, user.id]);
  return { before: await treatyOut(before), after: await getTreaty(before.id) };
}

export async function decideTreaty(id, action, b, user) {
  const t = await treatyRow(id);
  if (t.status !== 'Pending Approval') throw conflict(`Treaty is ${t.status}; only treaties pending approval can be ${action}d`);
  assertChecker({ user }, t.submitted_by || t.created_by, 'treaty');
  if (action === 'approve') {
    await assertSecurity(t.reinsurer_ids);
    await query('UPDATE reinsurance_treaties SET status = \'Active\', approved_by = $2, approved_at = now(), updated_by = $2, updated_at = now() WHERE id = $1', [t.id, user.id]);
  } else {
    if (!b.reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required to reject' }]);
    await query('UPDATE reinsurance_treaties SET status = \'Rejected\', rejection_reason = $3, updated_by = $2, updated_at = now() WHERE id = $1', [t.id, user.id, b.reason]);
  }
  await notify({ userId: t.submitted_by || t.created_by, type: 'info', title: `Treaty ${action === 'approve' ? 'approved' : 'rejected'}`, message: `${t.treaty_number} ${t.name}`, link: '/reinsurance/treaties', entity: 'treaty', entityId: t.id });
  return { before: await treatyOut(t), after: await getTreaty(t.id) };
}

export async function treatyCapacity(id) {
  const t = await treatyRow(id);
  const cap = capacityOf(t);
  return { treatyId: t.id, treatyNumber: t.treaty_number, capacity: cap || null, used: round2(t.ceded_sum_total), available: cap ? round2(cap - Number(t.ceded_sum_total)) : null,
    utilization: cap ? round2((Number(t.ceded_sum_total) / cap) * 100) : 0, retention: t.retention, cessionPercentage: t.share == null ? null : round2(t.share * 100) };
}

// ---------------- cessions ----------------

const CESSION_SELECT = `SELECT c.*, t.treaty_number, t.name AS treaty_name, r.name AS fac_name FROM cessions c
  LEFT JOIN reinsurance_treaties t ON t.id = c.treaty_id LEFT JOIN reinsurers r ON r.id = c.facultative_reinsurer_id`;

const cessionOut = (c) => ({
  id: Number(c.id), cessionNumber: c.cession_number, policyNumber: c.policy_number, policyId: c.policy_id, insured: c.insured, lineOfBusiness: c.line_of_business,
  treatyId: c.treaty_id, treatyNumber: c.treaty_number, treatyName: c.treaty_name, type: c.cession_type, facultativeReinsurer: c.facultative_reinsurer_id, facultativeReinsurerName: c.fac_name,
  grossPremium: c.gross_premium, sumInsured: c.sum_insured, cessionPercentage: c.cession_percentage, cededPremium: c.ceded_premium, cededSumInsured: c.ceded_sum,
  commission: c.commission, netPremium: c.net_premium, cessionDate: c.cession_date, status: c.status, bordereau: c.bordereau_ref, notes: c.notes,
  createdBy: c.created_by, confirmedBy: c.confirmed_by, confirmedAt: c.confirmed_at,
});

export async function listCessions(qs = {}) {
  const p = params();
  const conds = ['TRUE'];
  if (qs.treatyId) conds.push(`c.treaty_id::text = ${p.add(String(qs.treatyId))}`);
  if (qs.status) conds.push(`c.status = ${p.add(qs.status)}`);
  if (qs.type) conds.push(`c.cession_type = ${p.add(qs.type)}`);
  if (qs.search) conds.push(`(c.policy_number ILIKE ${p.add(`%${qs.search}%`)} OR c.insured ILIKE $${p.values.length} OR c.cession_number ILIKE $${p.values.length})`);
  return (await many(`${CESSION_SELECT} WHERE ${conds.join(' AND ')} ORDER BY c.cession_date DESC, c.id DESC`, p.values)).map(cessionOut);
}

export async function getCession(id) {
  const c = await one(`${CESSION_SELECT} WHERE c.id::text = $1 OR c.cession_number = $1`, [String(id)]);
  if (!c) throw notFound('Cession not found');
  return cessionOut(c);
}

async function policyInfo(b) {
  if (!b.policyId && !b.policyNumber) return null;
  return one(`SELECT p.id, p.policy_number, p.premium_total, p.sum_insured, c.display_name, pr.line FROM policies p LEFT JOIN clients c ON c.id = p.client_id
              LEFT JOIN products pr ON pr.id = p.product_id WHERE p.id = $1 OR p.policy_number = $1`, [String(b.policyId || b.policyNumber)]);
}

/** Share of the risk ceded: quota share uses the treaty percentage; surplus cedes the sum above retention up to retention x lines. */
function cededShare(t, sumInsured, requested) {
  if (Number.isFinite(requested)) return requested;
  const terms = t.terms || {};
  if (t.treaty_type === 'Surplus') {
    const ret = toNumber(t.retention ?? terms.retention, 0);
    const lines = toNumber(terms.lines, 0);
    if (!ret || !lines || !sumInsured) return 0;
    const ceded = Math.min(Math.max(sumInsured - ret, 0), ret * lines);
    return (ceded / sumInsured) * 100;
  }
  return t.share == null ? toNumber(terms.cession?.percentage, 0) : Number(t.share) * 100;
}

export async function createCession(b, user) {
  const pol = await policyInfo(b);
  const sumInsured = toNumber(b.sumInsured ?? pol?.sum_insured, NaN);
  const gross = toNumber(b.grossPremium ?? pol?.premium_total, NaN);
  const errors = [];
  if (!pol && !b.policyNumber) errors.push({ path: 'policyNumber', message: 'policyId or policyNumber is required' });
  if (!(sumInsured > 0)) errors.push({ path: 'sumInsured', message: 'sumInsured must be greater than zero' });
  if (!(gross > 0)) errors.push({ path: 'grossPremium', message: 'grossPremium must be greater than zero' });
  if (errors.length) throw badRequest('Validation failed', errors);
  const facultative = b.type === 'Facultative' || (!b.treatyId && !b.treatyNumber && b.facultativeReinsurer);
  let t = null;
  let pct;
  let commRate;
  if (facultative) {
    need(b, ['facultativeReinsurer']);
    await assertSecurity([b.facultativeReinsurer], 'facultativeReinsurer');
    pct = toNumber(b.cessionPercentage, NaN);
    if (!(pct > 0 && pct <= 100)) throw badRequest('Validation failed', [{ path: 'cessionPercentage', message: 'cessionPercentage (1-100) is required for facultative cessions' }]);
    commRate = toNumber(b.commissionRate, 0);
  } else {
    t = await treatyRow(b.treatyId ?? b.treatyNumber);
    if (t.status !== 'Active') throw conflict(`Treaty ${t.treaty_number} is ${t.status}; cessions need an active treaty`);
    const date = isoDate(b.cessionDate) || (await today());
    if (date < t.period_from || date > t.period_to) throw badRequest('Validation failed', [{ path: 'cessionDate', message: `Cession date is outside the treaty period ${t.period_from} to ${t.period_to}` }]);
    await assertSecurity(t.reinsurer_ids);
    pct = cededShare(t, sumInsured, toNumber(b.cessionPercentage, NaN));
    if (!(pct > 0 && pct <= 100)) throw badRequest('Validation failed', [{ path: 'cessionPercentage', message: 'Nothing to cede under this treaty (check retention / percentage)' }]);
    commRate = toNumber(b.commissionRate ?? t.commission_rate ?? t.terms?.commission?.rate, 0);
  }
  const cededSum = round2(sumInsured * pct / 100);
  if (t) {
    const cap = capacityOf(t);
    if (cap && Number(t.ceded_sum_total) + cededSum > cap) throw badRequest('Validation failed', [{ path: 'sumInsured', message: `Ceded sum insured ${cededSum} exceeds the treaty's available capacity ${round2(cap - Number(t.ceded_sum_total))}` }]);
  }
  const cededPremium = round2(gross * pct / 100);
  const commission = round2(cededPremium * commRate / 100);
  const number = await nextNumber('cession');
  const r = await one(`INSERT INTO cessions(treaty_id, policy_id, ceded_sum, ceded_premium, cession_number, policy_number, insured, line_of_business, cession_type, facultative_reinsurer_id,
      gross_premium, sum_insured, cession_percentage, commission, net_premium, cession_date, status, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'Pending',$17,$18) RETURNING id`,
  [t?.id || null, pol?.id || null, cededSum, cededPremium, number, pol?.policy_number || b.policyNumber, b.insured || pol?.display_name || null,
    b.lineOfBusiness || t?.line_of_business || (pol?.line ? pol.line.charAt(0).toUpperCase() + pol.line.slice(1) : null), facultative ? 'Facultative' : 'Treaty', facultative ? String(b.facultativeReinsurer) : null,
    gross, sumInsured, round2(pct), commission, round2(cededPremium - commission), isoDate(b.cessionDate) || (await today()), b.notes || null, user.id]);
  return getCession(r.id);
}

export async function decideCession(id, action, b, user) {
  const c = await one('SELECT * FROM cessions WHERE id::text = $1 OR cession_number = $1', [String(id)]);
  if (!c) throw notFound('Cession not found');
  if (c.status !== 'Pending') throw conflict(`Cession is ${c.status}`);
  assertChecker({ user }, c.created_by, 'cession');
  if (action === 'confirm') {
    if (c.treaty_id) await assertSecurity((await treatyRow(c.treaty_id)).reinsurer_ids);
    if (c.facultative_reinsurer_id) await assertSecurity([c.facultative_reinsurer_id]);
    await withTransaction(async (db) => {
      await db.query('UPDATE cessions SET status = \'Confirmed\', confirmed_by = $2, confirmed_at = now(), updated_at = now() WHERE id = $1', [c.id, user.id]);
      // ceded premium due from the cedant, net premium due to the reinsurer(s), reinsurance commission (posting rule ri.cession)
      const reinsurer = c.facultative_reinsurer_id ? (await db.query('SELECT name FROM reinsurers WHERE id::text = $1', [String(c.facultative_reinsurer_id)])).rows[0]?.name : null;
      const treaty = c.treaty_id ? (await db.query('SELECT treaty_number, name FROM reinsurance_treaties WHERE id = $1', [c.treaty_id])).rows[0] : null;
      const jv = await postEvent('ri.cession', { source: 'reinsurance', entryType: 'REINSURANCE', transactionCode: c.cession_number, referenceType: 'Cession', referenceId: c.id,
        policyId: c.policy_id, policyNumber: c.policy_number, description: `Cession ${c.cession_number} – ${c.policy_number || ''}`.trim(),
        amounts: { ceded_premium: Number(c.ceded_premium), net_premium: Number(c.net_premium), commission: Number(c.commission) },
        vars: { cessionNumber: c.cession_number, policyNumber: c.policy_number || '', reinsurer: reinsurer || (treaty ? `treaty ${treaty.treaty_number}` : 'reinsurer') } }, { db, user });
      await db.query('UPDATE cessions SET journal_id = $2 WHERE id = $1', [c.id, jv.id]);
    });
  } else {
    if (!b.reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required to reject' }]);
    await query('UPDATE cessions SET status = \'Rejected\', notes = COALESCE(notes || \' | \', \'\') || $2, updated_at = now() WHERE id = $1', [c.id, b.reason]);
  }
  return { before: cessionOut(c), after: await getCession(c.id) };
}

// ---------------- recoveries ----------------

const RECOVERY_SELECT = 'SELECT r.*, t.treaty_number FROM reinsurance_recoveries r LEFT JOIN reinsurance_treaties t ON t.id = r.treaty_id';
const recoveryOut = (r) => ({
  id: r.id, recoveryNumber: r.recovery_number, claimId: r.claim_id, claimNumber: r.claim_number, policyNumber: r.policy_number, insured: r.insured, dateOfLoss: r.date_of_loss,
  causeOfLoss: r.cause_of_loss, grossClaim: r.gross_claim, treatyId: r.treaty_id, treatyNumber: r.treaty_number, cessionId: r.cession_id == null ? null : Number(r.cession_id),
  cessionPercentage: r.cession_percentage, recoverableAmount: r.recoverable_amount, settlementAmount: r.settlement_amount, status: r.status, submissionDate: r.submission_date,
  recoveryDate: r.recovery_date, expectedSettlement: r.expected_settlement, cashCall: r.cash_call, documents: r.documents, notes: r.notes, createdAt: r.created_at,
});

export async function listRecoveries(qs = {}) {
  const rows = await many(`${RECOVERY_SELECT} WHERE ($1::text IS NULL OR r.status = $1) AND ($2::text IS NULL OR r.treaty_id::text = $2) ORDER BY r.created_at DESC`, [qs.status || null, qs.treatyId ? String(qs.treatyId) : null]);
  return rows.map(recoveryOut);
}
export async function getRecovery(id) {
  const r = await one(`${RECOVERY_SELECT} WHERE r.id = $1 OR r.recovery_number = $1`, [String(id)]);
  if (!r) throw notFound('Recovery not found');
  return recoveryOut(r);
}

/** Recoverable amount: proportional share for quota share / surplus / facultative; layer excess for excess of loss. */
function recoverable(t, gross, pct) {
  if (t && ['Excess of Loss', 'Stop Loss'].includes(t.treaty_type) && Array.isArray(t.terms?.layers)) {
    return round2(t.terms.layers.reduce((s, l) => s + Math.min(Math.max(gross - toNumber(l.excess), 0), toNumber(l.limit)), 0));
  }
  return round2(gross * (toNumber(pct) / 100));
}

export async function createRecovery(b, user) {
  let claim = null;
  if (b.claimId || b.claimNumber) {
    claim = await one(`SELECT cl.*, p.policy_number, c.display_name FROM claims cl JOIN policies p ON p.id = cl.policy_id LEFT JOIN clients c ON c.id = cl.client_id
                       WHERE cl.id = $1 OR cl.claim_number = $1`, [String(b.claimId || b.claimNumber)]);
  }
  const gross = toNumber(b.grossClaim ?? claim?.approved_amount ?? claim?.estimate_amount, NaN);
  if (!(gross > 0)) throw badRequest('Validation failed', [{ path: 'grossClaim', message: 'grossClaim must be greater than zero' }]);
  if (!claim && !b.claimNumber) throw badRequest('Validation failed', [{ path: 'claimNumber', message: 'claimId or claimNumber is required' }]);
  let ces = null;
  if (b.cessionId) ces = await one('SELECT * FROM cessions WHERE id::text = $1 OR cession_number = $1', [String(b.cessionId)]);
  else if (claim?.policy_id) ces = await one('SELECT * FROM cessions WHERE policy_id = $1 AND status = \'Confirmed\' ORDER BY id DESC LIMIT 1', [claim.policy_id]);
  const t = b.treatyId || ces?.treaty_id ? await treatyRow(b.treatyId ?? ces.treaty_id) : null;
  if (!t && !ces) throw badRequest('Validation failed', [{ path: 'treatyId', message: 'No confirmed cession or treaty covers this claim' }]);
  const pct = toNumber(b.cessionPercentage ?? ces?.cession_percentage ?? (t?.share == null ? null : t.share * 100), 0);
  const number = await nextNumber('ri_recovery');
  const r = await one(`INSERT INTO reinsurance_recoveries(recovery_number, claim_id, claim_number, policy_number, insured, treaty_id, cession_id, date_of_loss, cause_of_loss, gross_claim,
      cession_percentage, recoverable_amount, status, expected_settlement, documents, notes, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending',$13,$14,$15,$16,$16) RETURNING id`,
  [number, claim?.id || null, claim?.claim_number || b.claimNumber, claim?.policy_number || ces?.policy_number || b.policyNumber || null, claim?.display_name || ces?.insured || b.insured || null,
    t?.id || null, ces?.id || null, isoDate(b.dateOfLoss) || claim?.loss_date || null, b.causeOfLoss || claim?.loss_type || null, gross, pct, recoverable(t, gross, pct),
    isoDate(b.expectedSettlement), JSON.stringify(b.documents || []), b.notes || null, user.id]);
  return getRecovery(r.id);
}

export async function recoveryAction(id, action, b, user) {
  const before = await getRecovery(id);
  const allowed = { submit: ['Pending', 'Disputed'], settle: ['Processing'], dispute: ['Processing', 'Pending'], 'cash-call': ['Pending', 'Processing'] };
  if (!allowed[action].includes(before.status)) throw conflict(`Recovery is ${before.status}; cannot ${action}`);
  if (action === 'submit') await query('UPDATE reinsurance_recoveries SET status = \'Processing\', submission_date = current_date, documents = COALESCE($2, documents), updated_by = $3, updated_at = now() WHERE id = $1', [before.id, b.documents ? JSON.stringify(b.documents) : null, user.id]);
  if (action === 'settle') {
    const amt = toNumber(b.settlementAmount, NaN);
    if (!(amt > 0)) throw badRequest('Validation failed', [{ path: 'settlementAmount', message: 'settlementAmount must be greater than zero' }]);
    await withTransaction(async (db) => {
      await db.query('UPDATE reinsurance_recoveries SET status = \'Recovered\', settlement_amount = $2, recovery_date = COALESCE($3::date, current_date), updated_by = $4, updated_at = now() WHERE id = $1', [before.id, amt, isoDate(b.recoveryDate), user.id]);
      // recovery due from the reinsurer, payable to the cedant (posting rule ri.recovery)
      const jv = await postEvent('ri.recovery', { source: 'reinsurance', entryType: 'REINSURANCE', transactionCode: before.recoveryNumber, referenceType: 'ReinsuranceRecovery', referenceId: before.id,
        policyNumber: before.policyNumber, description: `Recovery ${before.recoveryNumber} – claim ${before.claimNumber || ''}`.trim(), amounts: { amount: round2(amt) },
        vars: { recoveryNumber: before.recoveryNumber, claimNumber: before.claimNumber || '' } }, { db, user });
      await db.query('UPDATE reinsurance_recoveries SET journal_id = $2 WHERE id = $1', [before.id, jv.id]);
    });
  }
  if (action === 'dispute') {
    if (!b.reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'reason is required' }]);
    await query('UPDATE reinsurance_recoveries SET status = \'Disputed\', notes = COALESCE(notes || \' | \', \'\') || $2, updated_by = $3, updated_at = now() WHERE id = $1', [before.id, b.reason, user.id]);
  }
  if (action === 'cash-call') {
    const amt = toNumber(b.amount, NaN);
    if (!(amt > 0)) throw badRequest('Validation failed', [{ path: 'amount', message: 'amount must be greater than zero' }]);
    await query('UPDATE reinsurance_recoveries SET cash_call = $2, updated_by = $3, updated_at = now() WHERE id = $1', [before.id, JSON.stringify({ requested: true, amount: amt, date: (await today()), status: 'Requested' }), user.id]);
  }
  return { before, after: await getRecovery(before.id) };
}

// ---------------- bordereaux ----------------

const monthLabel = (p) => new Date(`${p}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const bordereauOut = (x) => ({ id: x.id, reference: x.reference, type: x.type, period: x.period, periodLabel: /^\d{4}-\d{2}$/.test(x.period) ? monthLabel(x.period) : x.period, treatyId: x.treaty_id,
  treatyNumber: x.treaty_number, reinsurer: x.reinsurer_id, entries: x.entries, ...x.totals, status: x.status, submissionDate: x.submission_date, confirmationDate: x.confirmation_date,
  dueDate: x.due_date, fileUrl: x.file_url, createdAt: x.created_at });

export async function listBordereaux(qs = {}) {
  const rows = await many(`SELECT b.*, t.treaty_number FROM reinsurance_bordereaux b LEFT JOIN reinsurance_treaties t ON t.id = b.treaty_id
                           WHERE ($1::text IS NULL OR b.type = $1) AND ($2::text IS NULL OR b.status = $2) ORDER BY b.period DESC, b.created_at DESC`, [qs.type || null, qs.status || null]);
  return rows.map(bordereauOut);
}
async function getBordereau(id) {
  const r = await one('SELECT b.*, t.treaty_number FROM reinsurance_bordereaux b LEFT JOIN reinsurance_treaties t ON t.id = b.treaty_id WHERE b.id = $1 OR b.reference = $1', [String(id)]);
  if (!r) throw notFound('Bordereau not found');
  return bordereauOut(r);
}

export async function generateBordereau(b, user) {
  need(b, ['type', 'period']);
  if (!['Premium', 'Claims'].includes(b.type)) throw badRequest('Validation failed', [{ path: 'type', message: 'type must be Premium or Claims' }]);
  const period = String(b.period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) throw badRequest('Validation failed', [{ path: 'period', message: 'period must be YYYY-MM' }]);
  const t = b.treatyId || b.treatyNumber ? await treatyRow(b.treatyId ?? b.treatyNumber) : null;
  let rows;
  let totals;
  let columns;
  if (b.type === 'Premium') {
    rows = await many(`SELECT * FROM cessions WHERE status = 'Confirmed' AND bordereau_ref IS NULL AND to_char(cession_date, 'YYYY-MM') = $1 AND ($2::int IS NULL OR treaty_id = $2) ORDER BY cession_date`, [period, t?.id || null]);
    totals = { grossPremium: round2(rows.reduce((s, r) => s + Number(r.gross_premium), 0)), cededPremium: round2(rows.reduce((s, r) => s + Number(r.ceded_premium), 0)),
      commission: round2(rows.reduce((s, r) => s + Number(r.commission), 0)) };
    totals.netAmount = round2(totals.cededPremium - totals.commission);
    columns = [{ key: 'cession_number', label: 'Cession' }, { key: 'policy_number', label: 'Policy Number' }, { key: 'insured', label: 'Insured' }, { key: 'cession_date', label: 'Cession Date' },
      { key: 'sum_insured', label: 'Sum Insured' }, { key: 'gross_premium', label: 'Gross Premium' }, { key: 'cession_percentage', label: 'Cession %' }, { key: 'ceded_premium', label: 'Ceded Premium' }, { key: 'commission', label: 'Commission' }, { key: 'net_premium', label: 'Net Premium' }];
  } else {
    rows = await many(`SELECT * FROM reinsurance_recoveries WHERE to_char(COALESCE(submission_date, created_at::date), 'YYYY-MM') = $1 AND ($2::int IS NULL OR treaty_id = $2) AND status <> 'Rejected' ORDER BY created_at`, [period, t?.id || null]);
    totals = { grossClaims: round2(rows.reduce((s, r) => s + Number(r.gross_claim), 0)), recoverableAmount: round2(rows.reduce((s, r) => s + Number(r.recoverable_amount), 0)),
      recovered: round2(rows.reduce((s, r) => s + Number(r.settlement_amount || 0), 0)) };
    totals.outstanding = round2(totals.recoverableAmount - totals.recovered);
    columns = [{ key: 'recovery_number', label: 'Recovery' }, { key: 'claim_number', label: 'Claim Number' }, { key: 'policy_number', label: 'Policy Number' }, { key: 'date_of_loss', label: 'Date of Loss' },
      { key: 'gross_claim', label: 'Gross Claim' }, { key: 'recoverable_amount', label: 'Recoverable' }, { key: 'settlement_amount', label: 'Recovered' }, { key: 'status', label: 'Status' }];
  }
  if (!rows.length) throw badRequest(`No ${b.type.toLowerCase()} entries for ${period}${t ? ` under ${t.treaty_number}` : ''}`);
  const ref = await nextNumber('bordereau');
  const saved = await saveFile({ category: 'bordereaux', fileName: `${ref}_${b.type}_${period}.csv`, content: toCsv(rows, columns), contentType: 'text/csv', entity: 'bordereau', entityId: ref, userId: user.id });
  const dueDays = Number(await getSetting('reinsurance.bordereau_due_days', 30));
  const end = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0));
  end.setUTCDate(end.getUTCDate() + dueDays);
  const id = await withTransaction(async (c) => {
    const r = await c.query(`INSERT INTO reinsurance_bordereaux(reference, type, period, treaty_id, reinsurer_id, entries, totals, status, file_key, file_url, due_date, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Draft',$8,$9,$10,$11,$11) RETURNING id`,
    [ref, b.type, period, t?.id || null, b.reinsurer || t?.reinsurer_ids?.[0] || null, rows.length, JSON.stringify(totals), saved.key, saved.url, end.toISOString().slice(0, 10), user.id]);
    if (b.type === 'Premium') await c.query('UPDATE cessions SET bordereau_ref = $1, updated_at = now() WHERE id = ANY($2)', [ref, rows.map((x) => x.id)]);
    return r.rows[0].id;
  });
  return getBordereau(id);
}

export async function bordereauAction(id, action, user) {
  const before = await getBordereau(id);
  const next = { submit: ['Draft', 'Submitted', 'submission_date'], confirm: ['Submitted', 'Confirmed', 'confirmation_date'] }[action];
  if (before.status !== next[0]) throw conflict(`Bordereau is ${before.status}; cannot ${action}`);
  await query(`UPDATE reinsurance_bordereaux SET status = $2, ${next[2]} = current_date, updated_by = $3, updated_at = now() WHERE id = $1`, [before.id, next[1], user.id]);
  return { before, after: await getBordereau(before.id) };
}

// ---------------- reconciliation ----------------

const reconOut = (r) => ({ id: r.id, reference: r.reference, type: r.type, reinsurer: r.reinsurer_id, reinsurerName: r.reinsurer_name, period: r.period, ourAmount: r.our_amount, theirAmount: r.their_amount,
  variance: round2(Number(r.our_amount) - Number(r.their_amount)), variancePercent: Number(r.our_amount) ? round2((Math.abs(Number(r.our_amount) - Number(r.their_amount)) / Number(r.our_amount)) * 100) : 0,
  status: r.status, items: r.items, resolution: r.resolution, createdAt: r.created_at });
const exceptionOut = (e) => ({ id: e.id, date: e.date, type: e.type, description: e.description, amount: e.amount, status: e.status, resolution: e.resolution, reconciliationId: e.reconciliation_id });

export async function reconciliation() {
  const pending = (await many('SELECT r.*, ri.name AS reinsurer_name FROM reinsurance_reconciliations r LEFT JOIN reinsurers ri ON ri.id = r.reinsurer_id ORDER BY r.created_at DESC')).map(reconOut);
  const exceptions = (await many('SELECT * FROM reinsurance_exceptions ORDER BY date DESC, created_at DESC')).map(exceptionOut);
  return { pending, exceptions };
}

export async function createReconciliation(b, user) {
  need(b, ['type', 'reinsurerId', 'period', 'theirAmount']);
  const period = String(b.period).slice(0, 7);
  const ri = await getReinsurer(b.reinsurerId);
  const their = toNumber(b.theirAmount, NaN);
  if (!Number.isFinite(their)) throw badRequest('Validation failed', [{ path: 'theirAmount', message: 'theirAmount must be a number' }]);
  const ours = b.type === 'Claims'
    ? await one(`SELECT COALESCE(sum(r.recoverable_amount), 0) AS amt, count(*)::int AS n FROM reinsurance_recoveries r JOIN reinsurance_treaties t ON t.id = r.treaty_id
                 WHERE t.reinsurer_ids ? $1 AND to_char(COALESCE(r.submission_date, r.created_at::date), 'YYYY-MM') = $2 AND r.status <> 'Rejected'`, [ri.id, period])
    : await one(`SELECT COALESCE(sum(c.ceded_premium - c.commission), 0) AS amt, count(*)::int AS n FROM cessions c LEFT JOIN reinsurance_treaties t ON t.id = c.treaty_id
                 WHERE (t.reinsurer_ids ? $1 OR c.facultative_reinsurer_id = $1) AND to_char(c.cession_date, 'YYYY-MM') = $2 AND c.status = 'Confirmed'`, [ri.id, period]);
  const tol = Number(await getSetting('reinsurance.reconciliation_tolerance_percent', 1));
  const variancePct = Number(ours.amt) ? (Math.abs(Number(ours.amt) - their) / Number(ours.amt)) * 100 : (their ? 100 : 0);
  const status = variancePct <= tol ? 'Matched' : 'Pending Review';
  const ref = await nextNumber('ri_reconciliation');
  const id = await withTransaction(async (c) => {
    const r = await c.query(`INSERT INTO reinsurance_reconciliations(reference, type, reinsurer_id, period, our_amount, their_amount, items, status, created_by, updated_by)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`, [ref, b.type, ri.id, period, round2(ours.amt), their, ours.n, status, user.id]);
    if (status !== 'Matched') {
      await c.query('INSERT INTO reinsurance_exceptions(type, description, amount, reconciliation_id, created_by) VALUES ($1,$2,$3,$4,$5)',
        ['Variance', `${b.type} statement from ${ri.name} for ${period} differs by ${round2(Number(ours.amt) - their)}`, round2(Number(ours.amt) - their), r.rows[0].id, user.id]);
    }
    return r.rows[0].id;
  });
  return reconOut(await one('SELECT r.*, ri.name AS reinsurer_name FROM reinsurance_reconciliations r LEFT JOIN reinsurers ri ON ri.id = r.reinsurer_id WHERE r.id = $1', [id]));
}

export async function resolveReconciliation(id, b, user) {
  if (!b.resolution) throw badRequest('Validation failed', [{ path: 'resolution', message: 'resolution is required' }]);
  const r = await one('SELECT * FROM reinsurance_reconciliations WHERE id = $1 OR reference = $1', [String(id)]);
  if (!r) throw notFound('Reconciliation not found');
  if (r.status !== 'Pending Review') throw conflict(`Reconciliation is ${r.status}`);
  await query('UPDATE reinsurance_reconciliations SET status = \'Resolved\', resolution = $2, updated_by = $3, updated_at = now() WHERE id = $1', [r.id, b.resolution, user.id]);
  await query('UPDATE reinsurance_exceptions SET status = \'Resolved\', resolution = $2, updated_at = now() WHERE reconciliation_id = $1 AND status <> \'Resolved\'', [r.id, b.resolution]);
  return { before: reconOut(r), after: reconOut(await one('SELECT r.*, ri.name AS reinsurer_name FROM reinsurance_reconciliations r LEFT JOIN reinsurers ri ON ri.id = r.reinsurer_id WHERE r.id = $1', [r.id])) };
}

export async function createException(b, user) {
  need(b, ['type', 'description']);
  const r = await one('INSERT INTO reinsurance_exceptions(date, type, description, amount, created_by) VALUES (COALESCE($1::date, current_date), $2, $3, $4, $5) RETURNING *',
    [isoDate(b.date), b.type, b.description, toNumber(b.amount, 0), user.id]);
  return exceptionOut(r);
}

export async function resolveException(id, b) {
  if (!b.resolution) throw badRequest('Validation failed', [{ path: 'resolution', message: 'resolution is required' }]);
  const r = await one('UPDATE reinsurance_exceptions SET status = \'Resolved\', resolution = $2, updated_at = now() WHERE id = $1 AND status <> \'Resolved\' RETURNING *', [id, b.resolution]);
  if (!r) throw notFound('Open exception not found');
  return exceptionOut(r);
}

// ---------------- analytics ----------------

export async function analytics() {
  const treaties = await listTreaties({ status: 'Active' });
  const treatyUtilization = treaties.map((t) => ({ treaty: t.treatyNumber, treatyId: t.id, utilization: t.utilization }));
  const months = lastMonths(9);
  const start = `${months[0].key}-01`;
  const prem = await many('SELECT to_char(inception_date, \'YYYY-MM\') AS k, COALESCE(sum(premium_total), 0) AS v FROM policies WHERE inception_date >= $1::date AND status <> \'cancelled\' GROUP BY 1', [start]);
  const clm = await many('SELECT to_char(loss_date, \'YYYY-MM\') AS k, COALESCE(sum(COALESCE(settled_amount, approved_amount, estimate_amount)), 0) AS v FROM claims WHERE loss_date >= $1::date AND status <> \'rejected\' GROUP BY 1', [start]);
  const ced = await many('SELECT to_char(cession_date, \'YYYY-MM\') AS k, COALESCE(sum(ceded_premium), 0) AS v FROM cessions WHERE cession_date >= $1::date AND status = \'Confirmed\' GROUP BY 1', [start]);
  const rec = await many('SELECT to_char(date_of_loss, \'YYYY-MM\') AS k, COALESCE(sum(recoverable_amount), 0) AS v FROM reinsurance_recoveries WHERE date_of_loss >= $1::date AND status <> \'Rejected\' GROUP BY 1', [start]);
  const v = (list, k) => Number(list.find((x) => x.k === k)?.v || 0);
  const lossRatioTrend = months.map(({ key, label }) => {
    const gp = v(prem, key); const gc = v(clm, key); const cp = v(ced, key); const rc = v(rec, key);
    return { month: label, period: key, gross: gp ? round2((gc / gp) * 100) : 0, net: gp - cp > 0 ? round2(((gc - rc) / (gp - cp)) * 100) : 0 };
  });
  const tot = await one(`SELECT (SELECT COALESCE(sum(premium_total), 0) FROM policies WHERE status <> 'cancelled') AS gp,
      (SELECT COALESCE(sum(ceded_premium), 0) FROM cessions WHERE status = 'Confirmed') AS cp,
      (SELECT COALESCE(sum(COALESCE(settled_amount, approved_amount, estimate_amount)), 0) FROM claims WHERE status <> 'rejected') AS gc,
      (SELECT COALESCE(sum(settlement_amount), 0) FROM reinsurance_recoveries WHERE status = 'Recovered') AS rc`);
  const cession = Number(tot.gp) ? round2((Number(tot.cp) / Number(tot.gp)) * 100) : 0;
  const netPrem = Number(tot.gp) - Number(tot.cp);
  const profitability = netPrem > 0 ? round2(((netPrem - (Number(tot.gc) - Number(tot.rc))) / netPrem) * 100) : 0;
  const target = toNumber(await getSetting('reinsurance.target_retention_percent', null), NaN);
  const recovery = await one(`SELECT COALESCE(sum(recoverable_amount), 0) AS claimed, COALESCE(sum(settlement_amount) FILTER (WHERE status = 'Recovered'), 0) AS recovered,
      avg(recovery_date - submission_date) FILTER (WHERE status = 'Recovered' AND submission_date IS NOT NULL) AS days, count(*) FILTER (WHERE status = 'Disputed')::int AS disputed
    FROM reinsurance_recoveries WHERE status <> 'Rejected'`);
  const zones = await many(`SELECT COALESCE(NULLIF(c.state, ''), NULLIF(c.city, ''), 'Unassigned') AS zone, COALESCE(sum(p.sum_insured), 0) AS exposure, count(*)::int AS policies
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE p.status IN ('active', 'issued') AND pr.line IN ('fire', 'engineering', 'marine', 'motor') GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
  const totalExposure = zones.reduce((s, z) => s + Number(z.exposure), 0);
  const perils = ((await getSetting('reinsurance.cat_perils', [])) || []).map((x) => ({ peril: x.peril, pmlPercent: x.pmlPercent, pml: round2(totalExposure * toNumber(x.pmlPercent) / 100) }));
  return {
    treatyUtilization, lossRatioTrend,
    retentionOptimization: { current: { retention: round2(100 - cession), cession, profitability },
      recommended: Number.isFinite(target) ? { retention: target, cession: round2(100 - target), profitability: null } : null },
    recoveryPerformance: { totalClaimed: round2(recovery.claimed), totalRecovered: round2(recovery.recovered), recoveryRate: Number(recovery.claimed) ? round2((recovery.recovered / recovery.claimed) * 100) : 0,
      averageTime: recovery.days == null ? 0 : round2(recovery.days), disputed: recovery.disputed },
    catastropheExposure: { zones: zones.map((z) => ({ zone: z.zone, exposure: round2(z.exposure), policies: z.policies })), perils, totalExposure: round2(totalExposure) },
  };
}

// ---------------- reports ----------------

export async function reportTemplates() {
  const rows = await many('SELECT id, data, status FROM master_records WHERE type_code = \'reinsurance-report-template\' AND status = \'active\' ORDER BY code');
  return rows.map((r) => ({ id: r.data.code, masterId: r.id, ...r.data }));
}

export async function generateReport(b, user) {
  need(b, ['templateId']);
  const tpl = await one('SELECT id, data FROM master_records WHERE type_code = \'reinsurance-report-template\' AND code = $1 AND status = \'active\'', [String(b.templateId)]);
  if (!tpl) throw notFound('Report template not found');
  const type = tpl.data.type;
  let rows;
  let columns;
  if (type === 'Claims') {
    rows = await listRecoveries({});
    columns = ['recoveryNumber', 'claimNumber', 'policyNumber', 'treatyNumber', 'grossClaim', 'recoverableAmount', 'settlementAmount', 'status'].map((k) => ({ key: k, label: k }));
  } else if (type === 'Premium') {
    rows = await listCessions({ status: 'Confirmed' });
    columns = ['cessionNumber', 'policyNumber', 'insured', 'treatyNumber', 'grossPremium', 'cessionPercentage', 'cededPremium', 'commission', 'netPremium', 'cessionDate'].map((k) => ({ key: k, label: k }));
  } else {
    rows = await listTreaties({});
    columns = ['treatyNumber', 'name', 'type', 'lineOfBusiness', 'status', 'effectiveDate', 'expiryDate', 'premiumCeded', 'claimsRecovered', 'utilization', 'securityRating'].map((k) => ({ key: k, label: k }));
  }
  const saved = await saveFile({ category: 'reinsurance-reports', fileName: `${tpl.data.code}_${(await today())}.csv`, content: toCsv(rows, columns), contentType: 'text/csv', entity: 'reinsurance_report', entityId: tpl.data.code, userId: user.id });
  await query(`INSERT INTO generated_reports(code, name, params, format, storage_key, row_count, generated_by, status) VALUES ($1,$2,$3,'csv',$4,$5,$6,'done')`,
    [`reinsurance:${tpl.data.code}`, tpl.data.name, JSON.stringify(b), saved.key, rows.length, user.id]);
  await query('UPDATE master_records SET data = data || jsonb_build_object(\'lastGenerated\', $2::text), updated_at = now() WHERE id = $1', [tpl.id, (await today())]);
  return { id: tpl.data.code, ...tpl.data, lastGenerated: (await today()), generatedDate: new Date().toISOString(), fileUrl: saved.url, rowCount: rows.length, format: 'CSV' };
}
