/**
 * Fit and proper records of directors and officers (Compliance > Insurance Commission > Fit and Proper): the
 * declarations each one answered (items from compliance.fit_proper_declarations), the supporting documents (clearances,
 * curriculum vitae, board resolution), the review outcome and the next review date, compliance.fit_proper_review_months
 * after the last review. Reviews falling due are reminded by the daily job compliance-reminders.
 */
import { many, one, query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { addCalendarMonths, addDays, today } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { notify } from '../notifications/service.js';
import { daysBetween, documentsIn, iso, listSetting } from './common.js';

export const ROLE_CATEGORIES = ['director', 'officer', 'compliance-officer', 'key-person'];
export const OUTCOMES = ['pending', 'fit', 'conditional', 'not-fit'];
const DEFAULT_DECLARATIONS = ['Has not been convicted by final judgment of an offence involving moral turpitude, fraud or dishonesty'];

export const declarationItems = () => listSetting('compliance.fit_proper_declarations', DEFAULT_DECLARATIONS);
async function reviewMonths() {
  const n = Number(await getSetting('compliance.fit_proper_review_months', 12));
  return Number.isInteger(n) && n > 0 ? n : 12;
}
async function reminderDays() {
  const n = Number(await getSetting('compliance.fit_proper_reminder_days', 30));
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

const SELECT = 'SELECT f.*, u.display_name AS user_name FROM compliance_fit_proper f LEFT JOIN users u ON u.id = f.user_id';

/** Review state: overdue, due (within the reminder days), current, not-reviewed, ceased. */
export function reviewState(r, now, soon) {
  if (r.status !== 'active') return 'ceased';
  const next = iso(r.next_review_on);
  if (!next) return 'not-reviewed';
  if (next < now) return 'overdue';
  return daysBetween(now, next) <= soon ? 'due' : 'current';
}

export function fitProperApi(r, now, soon) {
  const declarations = Array.isArray(r.declarations) ? r.declarations : [];
  return {
    id: r.id, personName: r.person_name, userId: r.user_id, roleCategory: r.role_category, position: r.position,
    appointedOn: iso(r.appointed_on), ceasedOn: iso(r.ceased_on), declarations, declarationSignedOn: iso(r.declaration_signed_on),
    adverseAnswers: declarations.filter((d) => d.answer === 'no').length, unanswered: declarations.filter((d) => !d.answer).length,
    lastReviewOn: iso(r.last_review_on), nextReviewOn: iso(r.next_review_on), reviewOutcome: r.review_outcome, reviewedBy: r.reviewed_by,
    reviewNotes: r.review_notes, reviewState: reviewState(r, now, soon), documents: r.documents || [], status: r.status, remarks: r.remarks,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function listFitProper(q = {}) {
  const now = await today();
  const soon = await reminderDays();
  const where = ['true'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.roleCategory) add('f.role_category = ?', String(q.roleCategory));
  if (q.outcome) add('f.review_outcome = ?', String(q.outcome));
  if (String(q.includeCeased) !== 'true') where.push("f.status = 'active'");
  if (q.search) add("(f.person_name ILIKE '%' || ? || '%' OR f.position ILIKE '%' || ? || '%')", String(q.search));
  const rows = (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY f.next_review_on NULLS FIRST, f.person_name`, params)).map((r) => fitProperApi(r, now, soon));
  const items = q.reviewState ? rows.filter((r) => String(q.reviewState).split(',').includes(r.reviewState)) : rows;
  const summary = { active: 0, overdue: 0, due: 0, notReviewed: 0, notFit: 0 };
  for (const r of rows.filter((x) => x.status === 'active')) {
    summary.active += 1;
    if (r.reviewState === 'overdue') summary.overdue += 1;
    if (r.reviewState === 'due') summary.due += 1;
    if (r.reviewState === 'not-reviewed') summary.notReviewed += 1;
    if (r.reviewOutcome === 'not-fit') summary.notFit += 1;
  }
  return { items, summary, today: now, declarationItems: await declarationItems(), reviewMonths: await reviewMonths() };
}

export async function getFitProper(id) {
  const r = await one(`${SELECT} WHERE f.id = $1`, [id]);
  if (!r) throw notFound('Fit and proper record not found');
  return r;
}
export const fitProperView = async (id) => fitProperApi(await getFitProper(id), await today(), await reminderDays());

/** Declarations as answered: each item of the setting, the answer (yes / no) and remarks; an adverse answer needs remarks. */
function declarationsIn(list) {
  if (!Array.isArray(list)) return [];
  const out = list.map((d) => ({ item: String(d.item || '').slice(0, 500), answer: ['yes', 'no'].includes(d.answer) ? d.answer : null, remarks: d.remarks ? String(d.remarks).slice(0, 1000) : null }))
    .filter((d) => d.item);
  const missing = out.findIndex((d) => d.answer === 'no' && !d.remarks);
  if (missing >= 0) throw badRequest('Validation failed', [{ path: `declarations.${missing}.remarks`, message: 'Explain every declaration answered "no"' }]);
  return out;
}

const COLS = { personName: 'person_name', userId: 'user_id', roleCategory: 'role_category', position: 'position', appointedOn: 'appointed_on', ceasedOn: 'ceased_on',
  declarationSignedOn: 'declaration_signed_on', nextReviewOn: 'next_review_on', status: 'status', remarks: 'remarks' };

function columns(body, user) {
  const cols = {};
  for (const [k, c] of Object.entries(COLS)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (body.declarations !== undefined) cols.declarations = JSON.stringify(declarationsIn(body.declarations));
  if (body.documents !== undefined) cols.documents = JSON.stringify(documentsIn(body.documents, user));
  if (cols.ceased_on && body.status === undefined) cols.status = 'ceased';
  return cols;
}

export async function createFitProper(body, user) {
  const cols = columns(body, user);
  if (!cols.declarations) cols.declarations = JSON.stringify((await declarationItems()).map((item) => ({ item, answer: null, remarks: null })));
  const keys = [...Object.keys(cols), 'created_by', 'updated_by'];
  const r = await one(`INSERT INTO compliance_fit_proper(${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, [...Object.values(cols), user.id, user.id]);
  return fitProperView(r.id);
}

export async function updateFitProper(id, body, user) {
  const before = await getFitProper(id);
  const cols = { ...columns(body, user), updated_by: user.id, updated_at: new Date() };
  const keys = Object.keys(cols);
  await query(`UPDATE compliance_fit_proper SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...Object.values(cols)]);
  return { before: fitProperApi(before, await today(), await reminderDays()), after: await fitProperView(id) };
}

/** Record a review: outcome, date (default today) and notes; the next review is due compliance.fit_proper_review_months later. */
export async function reviewFitProper(id, body, user) {
  const before = await getFitProper(id);
  const on = body.reviewedOn || await today();
  const next = body.nextReviewOn || addCalendarMonths(on, await reviewMonths());
  const declarations = Array.isArray(before.declarations) ? before.declarations : [];
  if (body.outcome === 'fit' && declarations.some((d) => !d.answer)) {
    throw badRequest('Every declaration must be answered before the person is found fit and proper');
  }
  await query(`UPDATE compliance_fit_proper SET review_outcome = $2, last_review_on = $3, next_review_on = $4, reviewed_by = $5, review_notes = $6, updated_by = $7, updated_at = now()
    WHERE id = $1`, [id, body.outcome, on, next, user.username || user.id, body.notes || null, user.id]);
  return { before: fitProperApi(before, await today(), await reminderDays()), after: await fitProperView(id) };
}

/** Reviews falling due (daily job): one reminder per record and due date, when the review is within the reminder days. */
export async function fitProperReminders(now) {
  const soon = await reminderDays();
  const rows = await many(`${SELECT} WHERE f.status = 'active' AND f.next_review_on IS NOT NULL AND f.next_review_on <= $1::date`, [addDays(now, soon)]);
  let reminded = 0;
  for (const r of rows) {
    const recent = await one(`SELECT 1 FROM notifications WHERE entity = 'compliance_fit_proper' AND entity_id = $1 AND created_at > now() - interval '6 days'`, [r.id]);
    if (recent) continue;
    const next = iso(r.next_review_on);
    await notify({ type: 'reminder', priority: next < now ? 'high' : 'normal', title: `Fit and proper review ${next < now ? 'overdue' : 'due'}: ${r.person_name}`,
      message: `${r.position}: the fit and proper review is due on ${next}.`, link: '/compliance/fit-and-proper', entity: 'compliance_fit_proper', entityId: r.id, audience: 'read:compliance' });
    reminded += 1;
  }
  return { reminded };
}
