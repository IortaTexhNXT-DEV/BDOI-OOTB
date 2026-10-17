/**
 * Endorsements of the open policy (FR-PCL-005): an active open cover is changed only by an endorsement, never in place
 * (marine.endorse_active_covers), and a certificate is never endorsed (it is cancelled or reversed and issued again).
 *
 * The maker (write:marine) changes the terms (terms.js#TERM_FIELDS: not the client, insurer, type or period start) with
 * an Effective from date and a reason; one endorsement may be pending per cover. The effective date falls within the
 * period, after the last day of the last submitted monthly declaration and not before an earlier approved endorsement.
 * A second user holding approve:marine approves it (number MOE-YYYY-NNNNN; the cover takes the new terms, the
 * certificates dated from the effective date follow them, terms.js#termsOn) or returns it with a remark; the maker may
 * recall it while pending.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { addDays, isoDate } from '../../lib/dates.js';
import { TERM_FIELDS, applyChanges, checkTerms, termsOf } from './terms.js';
import { getCoverRow, writeTerms } from './service.js';

export const endorsementOut = (e) => ({
  id: e.id, endorsementNumber: e.endorsement_number, openCoverId: e.open_cover_id, coverNumber: e.cover_number ?? null, effectiveFrom: String(e.effective_from).slice(0, 10),
  reason: e.reason, changes: e.changes || {}, changedFields: Object.keys(e.changes || {}), beforeTerms: e.before_terms, afterTerms: e.after_terms, status: e.status,
  requestedBy: e.requested_by, requestedByName: e.requested_by_name ?? null, requestedAt: e.requested_at, decidedBy: e.decided_by, decidedByName: e.decided_by_name ?? null,
  decidedAt: e.decided_at, remark: e.remark,
});
const SELECT = `SELECT e.*, o.cover_number, ru.display_name AS requested_by_name, du.display_name AS decided_by_name FROM open_cover_endorsements e
  JOIN open_covers o ON o.id = e.open_cover_id LEFT JOIN users ru ON ru.id = e.requested_by LEFT JOIN users du ON du.id = e.decided_by`;

export async function listEndorsements(coverId) {
  return (await many(`${SELECT} WHERE e.open_cover_id = $1 ORDER BY e.requested_at DESC`, [coverId])).map(endorsementOut);
}

async function endorsementRow(id) {
  const e = await one(`${SELECT} WHERE e.id = $1 OR e.endorsement_number = $1`, [String(id)]);
  if (!e) throw notFound('Endorsement not found');
  return e;
}
export const getEndorsement = async (id) => endorsementOut(await endorsementRow(id));

/** Earliest effective date of a new endorsement: the day after the last submitted month, the last approved endorsement, the period start. */
async function earliestEffective(cover) {
  const last = await one("SELECT max(period_to) AS d FROM open_cover_declarations WHERE open_cover_id = $1 AND status <> 'draft'", [cover.id]);
  const prior = await one("SELECT max(effective_from) AS d FROM open_cover_endorsements WHERE open_cover_id = $1 AND status = 'approved'", [cover.id]);
  return [String(cover.period_from).slice(0, 10), last?.d ? addDays(String(last.d).slice(0, 10), 1) : null, prior?.d ? String(prior.d).slice(0, 10) : null].filter(Boolean).sort().pop();
}

/** The changed terms of a request: only endorsable fields that differ from the cover's current terms. */
function changesOf(current, body) {
  const out = {};
  for (const k of Object.keys(TERM_FIELDS)) {
    if (body[k] === undefined) continue;
    const v = k === 'periodTo' ? isoDate(body[k]) : body[k];
    if (JSON.stringify(v) !== JSON.stringify(current[k])) out[k] = v;
  }
  return out;
}

/** Submit an endorsement of an active open cover for approval. */
export async function submitEndorsement(coverId, body, user) {
  const cover = await getCoverRow(coverId);
  if (cover.status !== 'active') throw conflict(`Open cover ${cover.cover_number} is ${cover.status}: only an active open cover is endorsed`);
  if (['clientId', 'insuranceCompanyId', 'coverType', 'periodFrom', 'currency'].some((k) => body[k] !== undefined)) {
    throw badRequest('Validation failed', [{ path: 'changes', message: 'The client, insurer, open cover type and period start cannot be endorsed' }]);
  }
  if (!String(body.reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'Enter the reason for the endorsement', code: 'MSG-PCL-015' }]);
  const pending = await one("SELECT endorsement_number, id FROM open_cover_endorsements WHERE open_cover_id = $1 AND status = 'pending'", [cover.id]);
  if (pending) throw conflict('An endorsement of this open cover is still pending approval');
  const effective = isoDate(body.effectiveFrom);
  const earliest = await earliestEffective(cover);
  if (!effective || effective > String(cover.period_to).slice(0, 10)) throw badRequest('Validation failed', [{ path: 'effectiveFrom', message: 'The effective date must fall within the period of the open cover' }]);
  if (effective < earliest) {
    throw badRequest('Validation failed', [{ path: 'effectiveFrom', code: 'MSG-PCL-016', message: `The endorsement can apply from ${earliest} at the earliest: the month before is already declared` }]);
  }
  const current = termsOf(cover);
  const changes = changesOf(current, body.changes || body);
  if (!Object.keys(changes).length) throw badRequest('Validation failed', [{ path: 'changes', message: 'The endorsement changes nothing' }]);
  const after = await checkTerms(cover.cover_type, applyChanges(current, changes));
  if (after.periodTo <= String(cover.period_from).slice(0, 10)) throw badRequest('Validation failed', [{ path: 'periodTo', message: 'The period must end after it starts' }]);
  const r = await one(`INSERT INTO open_cover_endorsements(open_cover_id, effective_from, reason, changes, before_terms, requested_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [cover.id, effective, String(body.reason).trim(), JSON.stringify(changes), JSON.stringify(current), user.id]);
  return getEndorsement(r.id);
}

/** Approve or return a pending endorsement (approve:marine, never the maker). */
export async function decideEndorsement(id, { decision, remark = null }, user) {
  const e = await endorsementRow(id);
  if (e.status !== 'pending') throw conflict(`The endorsement is ${e.status}`);
  if (e.requested_by === user.id) throw forbidden('The approver must be different from the user who submitted the endorsement');
  if (decision === 'return') {
    if (!String(remark || '').trim()) throw badRequest('Validation failed', [{ path: 'remark', message: 'Enter the remark for returning the endorsement' }]);
    await one("UPDATE open_cover_endorsements SET status = 'returned', decided_by = $2, decided_at = now(), remark = $3 WHERE id = $1 RETURNING id", [e.id, user.id, remark]);
    return { endorsement: await getEndorsement(e.id), message: 'Endorsement returned to the maker' };
  }
  return withTransaction(async (db) => {
    const cover = await getCoverRow(e.open_cover_id, db);
    const before = termsOf(cover);
    const after = await checkTerms(cover.cover_type, applyChanges(before, e.changes));
    const number = await nextDocumentNumber('open_cover_endorsement', { db, unique: { table: 'open_cover_endorsements', column: 'endorsement_number' } });
    await writeTerms(db, cover.id, after, user.id);
    if (after.periodTo !== before.periodTo && cover.policy_id) await db.query('UPDATE policies SET expiry_date = $2, updated_at = now() WHERE id = $1', [cover.policy_id, after.periodTo]);
    await db.query(`UPDATE open_cover_endorsements SET status = 'approved', endorsement_number = $2, before_terms = $3, after_terms = $4, decided_by = $5, decided_at = now(), remark = $6
      WHERE id = $1`, [e.id, number, JSON.stringify(before), JSON.stringify(after), user.id, remark || null]);
    const out = endorsementOut({ ...e, status: 'approved', endorsement_number: number, before_terms: before, after_terms: after, decided_by: user.id });
    return { endorsement: out, message: `Endorsement ${number} approved, effective ${String(e.effective_from).slice(0, 10)}` };
  });
}

/** The maker withdraws a pending endorsement. */
export async function recallEndorsement(id, user) {
  const e = await endorsementRow(id);
  if (e.status !== 'pending') throw conflict(`The endorsement is ${e.status}`);
  if (e.requested_by !== user.id) throw forbidden('Only the user who submitted the endorsement can recall it');
  await one("UPDATE open_cover_endorsements SET status = 'recalled', decided_at = now() WHERE id = $1 RETURNING id", [e.id]);
  return getEndorsement(e.id);
}
