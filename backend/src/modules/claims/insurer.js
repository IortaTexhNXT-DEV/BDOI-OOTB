/**
 * The claim with the insurer and the claimant (TIS-BRD-CLAIM-04, CLAIM-06, CLAIM-08, FGA CM-03 to CM-10, Pre-BSM M15):
 *   recordAdvice        the insurer's advice: claim number, claim handler, advice status (under evaluation, incomplete
 *                       requirements, LOA issued, cheque available, approved, denied), authorisation code, offered amount
 *   verifyDeath         death verified on a death benefit claim; its follow-up date counts from the verification
 *   communications      exchanges with the insurer, client, adjuster or repair shop, with follow-up dates (overdue flag)
 *   followUpInsurer     follow-up e-mail to the insurer (template claim_insurer_followup), logged as a communication
 *   serviceLevels       job claim-service-levels at the end of the working day: FNOL not submitted to the insurer,
 *                       authorisation code overdue (claims.authorisation_days working days), follow-ups past their date
 */
import { many, one, pool, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { addDays, businessDate, today } from '../../lib/dates.js';
import { queueEmail } from '../../lib/mailer.js';
import { companyName } from '../../lib/letterhead.js';
import { workingCalendar } from '../../lib/workingCalendar.js';
import { notify } from '../notifications/service.js';
import { emailTemplate, renderTemplate } from '../documents/common.js';
import { followUpDays } from './intake.js';
import { COMM_METHODS, COMM_PARTIES, round2, shownDate, toNum } from './util.js';
import { docVars, getClaim, history, isDeathClaim, loadRow, notifyParties, openStatuses, trail } from './service.js';

const CLOSED = ['settled', 'closed', 'rejected', 'cancelled'];
const PARTIES = COMM_PARTIES;
const METHODS = COMM_METHODS;

/**
 * Record the insurer's advice on a claim (write:claims). Each field given is changed and kept in the field-level trail;
 * the advice status is one of claims.insurer_advice_statuses. A denial is recorded; the rejection itself is the
 * claims decision of an approve:claims holder.
 */
export async function recordAdvice(id, b, user) {
  const row = await loadRow(id);
  if (CLOSED.includes(row.status)) throw conflict(`Claim ${row.claim_number} is closed to changes (${row.status})`);
  const statuses = (await getSetting('claims.insurer_advice_statuses', {})) || {};
  if (b.adviceStatus && !statuses[b.adviceStatus]) throw badRequest('Validation failed', [{ path: 'adviceStatus', message: `Choose one of ${Object.values(statuses).join(', ')}` }]);
  const offer = b.offerAmount === undefined || b.offerAmount === null || b.offerAmount === '' ? undefined : toNum(b.offerAmount);
  if (offer !== undefined && (offer === null || offer < 0)) throw badRequest('Validation failed', [{ path: 'offerAmount', message: 'The offered amount must be an amount of zero or more' }]);
  const fields = [
    ['insurerClaimNumber', 'insurer_claim_number', b.insurerClaimNumber], ['insurerHandler', 'insurer_handler', b.insurerHandler],
    ['insurerHandlerContact', 'insurer_handler_contact', b.insurerHandlerContact], ['adviceStatus', 'insurer_advice', b.adviceStatus],
    ['authorisationCode', 'authorisation_code', b.authorisationCode], ['offerAmount', 'insurer_offer_amount', offer === undefined ? undefined : round2(offer)],
  ].filter(([, , v]) => v !== undefined && v !== '');
  const changes = fields.filter(([, col, v]) => String(row[col] ?? '') !== String(v ?? ''));
  if (!changes.length && !b.note) throw badRequest('Nothing to update');
  await withTransaction(async (db) => {
    const sets = changes.map(([, col], i) => `${col} = $${i + 2}`);
    if (changes.some(([f]) => f === 'adviceStatus')) sets.push('insurer_advice_at = now()');
    if (changes.some(([f]) => f === 'authorisationCode')) sets.push('authorisation_at = now()');
    if (sets.length) await db.query(`UPDATE claims SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, [row.id, ...changes.map(([, , v]) => v)]);
    await trail(db, row.id, user, 'Insurer Advice Recorded', changes.length ? changes.map(([f, col, v]) => [f, row[col], v]) : [['note', null, b.note]]);
    const advice = b.adviceStatus ? statuses[b.adviceStatus] : null;
    await history(db, row.id, user, row.status, [advice ? `Insurer advice: ${advice}` : 'Insurer advice recorded', b.authorisationCode ? `authorisation code ${b.authorisationCode}` : null, b.note].filter(Boolean).join('; '));
  });
  if (b.adviceStatus === 'denied') {
    await notifyParties(row, { type: 'alert', title: `Claim ${row.claim_number}: denied by the insurer`, message: b.note || 'Record the rejection with its reason to tell the client' });
  }
  return { before: Object.fromEntries(changes.map(([f, col]) => [f, row[col] ?? null])), claim: await getClaim(row.id) };
}

/** Death verified on a death benefit claim (Pre-BSM M15 CLM-CL-DEATH); the follow-up date counts from it. */
export async function verifyDeath(id, { verifiedOn, note }, user) {
  const row = await loadRow(id);
  if (!isDeathClaim(row)) throw conflict(`Claim ${row.claim_number} is not a death claim`);
  if (CLOSED.includes(row.status)) throw conflict(`Claim ${row.claim_number} is closed to changes (${row.status})`);
  const on = (await businessDate(verifiedOn)) || await today();
  if (on > await today()) throw badRequest('Validation failed', [{ path: 'verifiedOn', message: 'The death cannot be verified on a future date' }]);
  const days = await followUpDays({ productCode: row.product_code, lob: row.lob || row.product_line, extent: null });
  const due = addDays(on, days);
  await withTransaction(async (db) => {
    await db.query('UPDATE claims SET death_verified_on = $2, death_verified_by = $3, due_date = $4, updated_at = now() WHERE id = $1', [row.id, on, user?.username ?? null, due]);
    await trail(db, row.id, user, 'Death Verified', [['deathVerifiedOn', row.death_verified_on, on], ['claimDueDate', row.due_date, due]]);
    await history(db, row.id, user, row.status, `Death verified on ${await shownDate(on)}${note ? `: ${note}` : ''}`);
  });
  return { before: { deathVerifiedOn: row.death_verified_on, dueDate: row.due_date }, claim: await getClaim(row.id) };
}

const commApi = (c, todayStr) => ({
  id: Number(c.id), party: c.party, partyLabel: PARTIES[c.party] || c.party, direction: c.direction, method: c.method, subject: c.subject, message: c.message,
  followUpDate: c.follow_up_date, followUpDone: !!c.follow_up_done_at, followUpDoneAt: c.follow_up_done_at, followUpDoneBy: c.done_by_name || c.follow_up_done_by,
  overdue: !!c.follow_up_date && !c.follow_up_done_at && c.follow_up_date < todayStr, emailed: !!c.email_id, by: c.by_name || c.created_by, at: c.created_at,
});
const COMM_SQL = `SELECT c.*, u.display_name AS by_name, du.display_name AS done_by_name FROM claim_communications c
  LEFT JOIN users u ON u.username = c.created_by LEFT JOIN users du ON du.username = c.follow_up_done_by`;

export async function communications(id) {
  const row = await loadRow(id);
  const todayStr = await today();
  return (await many(`${COMM_SQL} WHERE c.claim_id = $1 ORDER BY c.created_at DESC, c.id DESC`, [row.id])).map((c) => commApi(c, todayStr));
}

/** Log an exchange on the claim (negotiation, follow-up, insurer update) with an optional follow-up date. */
export async function addCommunication(id, b, user, { emailId = null } = {}) {
  const row = await loadRow(id);
  if (!PARTIES[b.party]) throw badRequest('Validation failed', [{ path: 'party', message: `Choose one of ${Object.values(PARTIES).join(', ')}` }]);
  if (!METHODS.includes(b.method)) throw badRequest('Validation failed', [{ path: 'method', message: `Choose one of ${METHODS.join(', ')}` }]);
  const follow = await businessDate(b.followUpDate);
  if (follow && follow < await today()) throw badRequest('Validation failed', [{ path: 'followUpDate', message: 'The follow-up date cannot be in the past' }]);
  const c = await one(`INSERT INTO claim_communications(claim_id, party, direction, method, subject, message, follow_up_date, email_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [row.id, b.party, b.direction === 'in' ? 'in' : 'out', b.method, b.subject || null, b.message, follow, emailId, user?.username ?? null]);
  await history(pool, row.id, user, row.status, `${PARTIES[b.party]} ${b.direction === 'in' ? 'update received' : 'contacted'} (${b.method})${follow ? `; follow up on ${await shownDate(follow)}` : ''}`);
  const todayStr = await today();
  return commApi(await one(`${COMM_SQL} WHERE c.id = $1`, [c.id]), todayStr);
}

/** Mark the follow-up of a communication done. */
export async function completeFollowUp(id, commId, user) {
  const row = await loadRow(id);
  const c = await one('SELECT * FROM claim_communications WHERE id = $1 AND claim_id = $2', [Number(commId), row.id]);
  if (!c) throw notFound('Communication not found');
  if (!c.follow_up_date) throw conflict('This communication has no follow-up');
  if (c.follow_up_done_at) throw conflict('The follow-up is already done');
  await query('UPDATE claim_communications SET follow_up_done_at = now(), follow_up_done_by = $2 WHERE id = $1', [c.id, user?.username ?? null]);
  return commApi(await one(`${COMM_SQL} WHERE c.id = $1`, [c.id]), await today());
}

/** Follow-up e-mail to the insurer's claims address (FGA CM-10), logged as a communication with its follow-up date. */
export async function followUpInsurer(id, b, user) {
  const row = await loadRow(id);
  if (CLOSED.includes(row.status)) throw conflict(`Claim ${row.claim_number} is closed (${row.status})`);
  const to = b.to || row.insurer_email || await getSetting('claims.pla_default_recipient', null);
  if (!to) throw badRequest('Validation failed', [{ path: 'to', message: 'The insurer has no e-mail address; enter one' }]);
  const t = await emailTemplate('claim_insurer_followup');
  const v = { ...(await docVars(row)), insurerClaimNumber: row.insurer_claim_number || row.claim_number, message: b.message, companyName: await companyName() };
  const emailId = await queueEmail({ to, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'claim_insurer_followup', entity: 'claim', entityId: row.id });
  const comm = await addCommunication(row.id, { party: 'insurer', direction: 'out', method: 'Email', subject: renderTemplate(t.subject, v, { html: false }), message: b.message, followUpDate: b.followUpDate },
    user, { emailId: String(emailId) });
  return { to, emailId, communication: comm };
}

const alert = (userId, title, message, claimId) => notify({ userId, type: 'alert', priority: 'high', title, message, link: `/agent/claimdetail/${claimId}`, entity: 'claim', entityId: claimId });

/**
 * Job claim-service-levels (end of the working day): alert the handler (and the manager of the handler) once of
 *   - a claim registered and not submitted to the insurer by the end of its day (FNOL service level, CLAIM-08)
 *   - an authorisation code not received claims.authorisation_days working days after the submission (M15 CLM-AUTH)
 *   - a communication whose follow-up date has passed
 */
export async function serviceLevels() {
  const now = await today();
  const cal = await workingCalendar(addDays(now, -30), now);
  if (!cal.isWorking(now)) return { skipped: `${now} is not a working day` };
  const open = await openStatuses();
  const out = { fnol: 0, authorisation: 0, followUps: 0 };
  const recipients = async (handler) => {
    if (!handler) return [];
    const m = await one("SELECT m.id FROM users u JOIN users m ON m.id = u.reporting_to WHERE u.id = $1 AND m.status = 'active'", [handler]);
    return [handler, m?.id].filter(Boolean);
  };
  const fnol = await many(`SELECT id, claim_number, handler_user_id, reported_date FROM claims WHERE status = ANY($1) AND submitted_to_insurer_at IS NULL
    AND fnol_alerted_at IS NULL AND reported_date <= $2::date`, [open, now]);
  for (const c of fnol) {
    for (const u of await recipients(c.handler_user_id)) await alert(u, `FNOL not submitted: claim ${c.claim_number}`, `Claim ${c.claim_number} reported on ${await shownDate(c.reported_date)} has not been submitted to the insurer`, c.id);
    await query('UPDATE claims SET fnol_alerted_at = now() WHERE id = $1', [c.id]);
    out.fnol += 1;
  }
  const days = Number(await getSetting('claims.authorisation_days', 2)) || 0;
  if (days > 0) {
    const waiting = await many(`SELECT id, claim_number, handler_user_id, submitted_to_insurer_at FROM claims WHERE status = ANY($1) AND submitted_to_insurer_at IS NOT NULL
      AND COALESCE(authorisation_code, '') = '' AND authorisation_alerted_at IS NULL`, [open]);
    for (const c of waiting) {
      const submitted = await businessDate(c.submitted_to_insurer_at);
      if (cal.between(submitted, now) < days) continue;
      for (const u of await recipients(c.handler_user_id)) await alert(u, `Authorisation code overdue: claim ${c.claim_number}`, `No authorisation code from the insurer ${days} working days after the submission on ${await shownDate(submitted)}; follow up the insurer`, c.id);
      await query('UPDATE claims SET authorisation_alerted_at = now() WHERE id = $1', [c.id]);
      out.authorisation += 1;
    }
  }
  const late = await many(`SELECT k.id, k.follow_up_date, k.party, c.id AS claim_id, c.claim_number, c.handler_user_id, u.id AS author FROM claim_communications k
    JOIN claims c ON c.id = k.claim_id LEFT JOIN users u ON u.username = k.created_by
    WHERE k.follow_up_date < $1::date AND k.follow_up_done_at IS NULL AND k.follow_up_alerted_at IS NULL AND c.status = ANY($2)`, [now, open]);
  for (const k of late) {
    const to = [...new Set([k.handler_user_id, k.author].filter(Boolean))];
    for (const u of to) await alert(u, `Claim follow-up overdue: ${k.claim_number}`, `The follow-up with the ${String(PARTIES[k.party] || k.party).toLowerCase()} was due on ${await shownDate(k.follow_up_date)}`, k.claim_id);
    await query('UPDATE claim_communications SET follow_up_alerted_at = now() WHERE id = $1', [k.id]);
    out.followUps += 1;
  }
  return out;
}
