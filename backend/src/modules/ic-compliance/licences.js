/**
 * Licence register (Compliance > Insurance Commission > Licence Register): licences of the firm, its officers and
 * licensed individuals, and of the agents, sub-agents and referrers paid commission. Status of a licence on a date:
 *   valid       in force and expiring after compliance.licence_expiring_days
 *   expiring    in force, expiring within compliance.licence_expiring_days
 *   expired     expiry date passed
 *   no-expiry   in force without an expiry date (the IC licence of a firm is renewable; a missing date is reported)
 *   superseded / revoked / surrendered   no longer the licence in force
 * referrerLicenceIssue() is the check behind the commission payout block (commission/service.js#payoutBlockReason).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { today, addDays } from '../../lib/dates.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { notify } from '../notifications/service.js';
import { daysBetween, documentsIn, iso } from './common.js';

export const HOLDER_TYPES = ['firm', 'officer', 'individual', 'referrer'];
export const RENEWAL_STATUSES = ['not-due', 'due', 'in-progress', 'filed', 'renewed', 'lapsed'];
export const RECORD_STATUSES = ['active', 'superseded', 'revoked', 'surrendered'];

const SELECT = `SELECT l.*, r.name AS referrer_name, r.referrer_type, r.status AS referrer_status, u.display_name AS user_name
  FROM compliance_licences l LEFT JOIN commission_referrers r ON r.id = l.referrer_id LEFT JOIN users u ON u.id = l.user_id`;

export async function expiringDays() {
  const n = Number(await getSetting('compliance.licence_expiring_days', 90));
  return Number.isFinite(n) && n >= 0 ? n : 90;
}

/** Status of a licence row on a date (see the header). */
export function licenceState(row, now, window) {
  if (row.status !== 'active') return row.status;
  const exp = iso(row.expiry_date);
  if (!exp) return 'no-expiry';
  if (exp < now) return 'expired';
  return daysBetween(now, exp) <= window ? 'expiring' : 'valid';
}

export function licenceApi(r, now, window) {
  const exp = iso(r.expiry_date);
  return {
    id: r.id, holderType: r.holder_type, referrerId: r.referrer_id, referrerType: r.referrer_type || null, userId: r.user_id,
    holderName: r.holder_name, position: r.position, licenceType: r.licence_type, licenceNumber: r.licence_number, issuingAuthority: r.issuing_authority,
    linesAuthorised: r.lines_authorised, issueDate: iso(r.issue_date), expiryDate: exp, renewalStatus: r.renewal_status, renewalFiledOn: iso(r.renewal_filed_on),
    renewalReference: r.renewal_reference, supersededBy: r.superseded_by, status: r.status, state: licenceState(r, now, window),
    daysToExpiry: exp && r.status === 'active' ? daysBetween(now, exp) : null, documents: r.documents || [], remarks: r.remarks,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Register with filters (holderType, state, renewalStatus, referrerId, search) and the counts per state. */
export async function listLicences(q = {}) {
  const now = await today();
  const window = await expiringDays();
  const where = ['true'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.holderType) add('l.holder_type = ?', String(q.holderType));
  if (q.renewalStatus) add('l.renewal_status = ?', String(q.renewalStatus));
  if (q.referrerId) add('l.referrer_id = ?', String(q.referrerId));
  if (String(q.includeInactive) !== 'true' && !q.state) where.push("l.status = 'active'");
  if (q.search) add("(l.holder_name ILIKE '%' || ? || '%' OR l.licence_number ILIKE '%' || ? || '%' OR l.licence_type ILIKE '%' || ? || '%')", String(q.search));
  const rows = (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY l.expiry_date NULLS LAST, l.holder_name`, params)).map((r) => licenceApi(r, now, window));
  const states = q.state ? String(q.state).split(',') : null;
  const items = states ? rows.filter((r) => states.includes(r.state)) : rows;
  const summary = { total: 0, valid: 0, expiring: 0, expired: 0, noExpiry: 0 };
  for (const r of rows.filter((x) => x.status === 'active')) {
    summary.total += 1;
    if (r.state === 'valid') summary.valid += 1;
    else if (r.state === 'expiring') summary.expiring += 1;
    else if (r.state === 'expired') summary.expired += 1;
    else if (r.state === 'no-expiry') summary.noExpiry += 1;
  }
  return { items, summary, today: now, expiringDays: window };
}

export async function getLicence(id) {
  const r = await one(`${SELECT} WHERE l.id = $1`, [id]);
  if (!r) throw notFound('Licence not found');
  return r;
}
export async function licenceView(id) {
  return licenceApi(await getLicence(id), await today(), await expiringDays());
}

const COLS = { holderType: 'holder_type', referrerId: 'referrer_id', userId: 'user_id', holderName: 'holder_name', position: 'position', licenceType: 'licence_type',
  licenceNumber: 'licence_number', issuingAuthority: 'issuing_authority', linesAuthorised: 'lines_authorised', issueDate: 'issue_date', expiryDate: 'expiry_date',
  renewalStatus: 'renewal_status', renewalFiledOn: 'renewal_filed_on', renewalReference: 'renewal_reference', status: 'status', remarks: 'remarks' };

async function normalise(body, user, before = null) {
  const cols = {};
  for (const [k, c] of Object.entries(COLS)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (body.documents !== undefined) cols.documents = JSON.stringify(documentsIn(body.documents, user));
  const holderType = cols.holder_type ?? before?.holder_type;
  if (holderType === 'referrer') {
    const refId = cols.referrer_id ?? before?.referrer_id;
    if (!refId) throw badRequest('Validation failed', [{ path: 'referrerId', message: 'Choose the agent, sub-agent or referrer who holds the licence' }]);
    const ref = await one('SELECT id, name FROM commission_referrers WHERE id = $1', [refId]);
    if (!ref) throw badRequest('Validation failed', [{ path: 'referrerId', message: 'Referrer not found' }]);
    if (!cols.holder_name && !before?.holder_name) cols.holder_name = ref.name;
  } else if (cols.holder_type) cols.referrer_id = null;
  if (cols.user_id) {
    const u = await one('SELECT id, display_name FROM users WHERE id = $1', [cols.user_id]);
    if (!u) throw badRequest('Validation failed', [{ path: 'userId', message: 'User not found' }]);
    if (!cols.holder_name && !before?.holder_name) cols.holder_name = u.display_name;
  }
  if (holderType === 'firm' && !cols.holder_name && !before?.holder_name) {
    cols.holder_name = (await one("SELECT COALESCE(data->>'CompanyName', name) AS n FROM master_records WHERE type_code = 'company' ORDER BY id LIMIT 1"))?.n
      || (await getSetting('general.company_name', null)) || 'The broker';
  }
  const issue = cols.issue_date ?? iso(before?.issue_date);
  const expiry = cols.expiry_date ?? iso(before?.expiry_date);
  if (issue && expiry && expiry < issue) throw badRequest('Validation failed', [{ path: 'expiryDate', message: 'The expiry date cannot be before the issue date' }]);
  return cols;
}

export async function createLicence(body, user) {
  const cols = await normalise(body, user);
  if (!cols.holder_name) throw badRequest('Validation failed', [{ path: 'holderName', message: 'holderName is required' }]);
  const keys = [...Object.keys(cols), 'created_by', 'updated_by'];
  const vals = [...Object.values(cols), user.id, user.id];
  const r = await one(`INSERT INTO compliance_licences(${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, vals);
  return licenceView(r.id);
}

export async function updateLicence(id, body, user) {
  const before = await getLicence(id);
  const cols = await normalise(body, user, before);
  cols.updated_by = user.id;
  cols.updated_at = new Date();
  const keys = Object.keys(cols);
  await query(`UPDATE compliance_licences SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...Object.values(cols)]);
  return { before: licenceApi(before, await today(), await expiringDays()), after: await licenceView(id) };
}

/** Renewal: a new licence term for the same holder; the current one is marked renewed and superseded by it. */
export async function renewLicence(id, body, user) {
  const old = await getLicence(id);
  if (old.status !== 'active') throw conflict(`Only the licence in force can be renewed (this one is ${old.status})`);
  if (!body.expiryDate) throw badRequest('Validation failed', [{ path: 'expiryDate', message: 'The expiry date of the renewed licence is required' }]);
  if (iso(old.expiry_date) && body.expiryDate <= iso(old.expiry_date)) throw badRequest('Validation failed', [{ path: 'expiryDate', message: 'The renewed licence must expire after the current one' }]);
  return withTransaction(async (db) => {
    const row = (await db.query(`INSERT INTO compliance_licences(holder_type, referrer_id, user_id, holder_name, position, licence_type, licence_number, issuing_authority,
        lines_authorised, issue_date, expiry_date, renewal_status, documents, remarks, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'not-due',$12,$13,$14,$14) RETURNING id`,
    [old.holder_type, old.referrer_id, old.user_id, old.holder_name, old.position, old.licence_type, body.licenceNumber || old.licence_number, old.issuing_authority,
      old.lines_authorised, body.issueDate || null, body.expiryDate, JSON.stringify(documentsIn(body.documents || [], user)), body.remarks || null, user.id])).rows[0];
    await db.query(`UPDATE compliance_licences SET status = 'superseded', renewal_status = 'renewed', superseded_by = $2, updated_by = $3, updated_at = now() WHERE id = $1`,
      [old.id, row.id, user.id]);
    return { before: licenceApi(old, await today(), await expiringDays()), id: row.id };
  }).then(async (r) => ({ ...r, after: await licenceView(r.id) }));
}

/**
 * Expiry calendar and dashboard: counts by state, licences by month of expiry (next 12 months), the firm's licence,
 * and the referrers whose type requires a licence but who have none in force (their commission is blocked or warned).
 */
export async function licenceDashboard() {
  const { items, summary, today: now, expiringDays: window } = await listLicences({});
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.parse(`${now.slice(0, 7)}-01T00:00:00Z`));
    d.setUTCMonth(d.getUTCMonth() + i);
    const key = d.toISOString().slice(0, 7);
    months.push({ month: key, licences: items.filter((l) => l.expiryDate && l.expiryDate.slice(0, 7) === key) });
  }
  const firm = items.filter((l) => l.holderType === 'firm');
  const required = await requiredReferrerTypes();
  const refs = await many(`SELECT r.id, r.name, r.referrer_type FROM commission_referrers r WHERE r.status = 'Active' AND r.referrer_type = ANY($1::text[])
      AND NOT EXISTS (SELECT 1 FROM compliance_licences l WHERE l.referrer_id = r.id AND l.status = 'active' AND (l.expiry_date IS NULL OR l.expiry_date >= $2::date)
        AND (l.issue_date IS NULL OR l.issue_date <= $2::date)) ORDER BY r.name`, [required, now]);
  return {
    today: now, expiringDays: window, summary,
    expired: items.filter((l) => l.state === 'expired'), expiring: items.filter((l) => l.state === 'expiring'),
    calendar: months, firmLicences: firm, firmLicenceInForce: firm.some((l) => ['valid', 'expiring', 'no-expiry'].includes(l.state)),
    referrersWithoutLicence: refs.map((r) => ({ id: r.id, name: r.name, type: r.referrer_type })),
    checkMode: await referrerCheckMode(),
  };
}

export async function requiredReferrerTypes() {
  const v = await getSetting('compliance.licence_required_referrer_types', ['Agent', 'Sub-agent']);
  return Array.isArray(v) ? v.map(String) : ['Agent', 'Sub-agent'];
}
export async function referrerCheckMode() {
  const v = String(await getSetting('compliance.referrer_licence_check', 'block'));
  return ['block', 'warn', 'off'].includes(v) ? v : 'block';
}

/**
 * Why a referrer may not be paid commission for want of a licence: null when its type needs none or a licence is in
 * force on the date, else { mode: 'block' | 'warn', message }.
 */
export async function referrerLicenceIssue(ref, on = null) {
  const mode = await referrerCheckMode();
  if (mode === 'off' || !ref) return null;
  if (!(await requiredReferrerTypes()).includes(ref.referrer_type)) return null;
  const date = on || await today();
  const rows = await many(`SELECT licence_number, licence_type, issue_date, expiry_date, status FROM compliance_licences
     WHERE referrer_id = $1 AND status IN ('active', 'superseded') ORDER BY expiry_date DESC NULLS FIRST`, [ref.id]);
  const inForce = rows.find((l) => l.status === 'active' && (!l.expiry_date || iso(l.expiry_date) >= date) && (!l.issue_date || iso(l.issue_date) <= date));
  if (inForce) return null;
  const last = rows.find((l) => l.expiry_date);
  const message = last
    ? `${ref.name} (${ref.referrer_type}) has no licence in force: licence ${last.licence_number || last.licence_type} expired on ${iso(last.expiry_date)}. Record the renewed licence in Compliance > Licence Register before approving or paying commission.`
    : `${ref.name} (${ref.referrer_type}) has no licence on the licence register. Record the licence in Compliance > Licence Register before approving or paying commission.`;
  return { mode, message };
}

/** Licence reminders of the daily job: one notification per licence term and threshold in compliance.licence_reminder_days. */
export async function licenceReminders(now) {
  const days = (await getSetting('compliance.licence_reminder_days', [90, 60, 30, 15, 7])) || [];
  const thresholds = [...new Set((Array.isArray(days) ? days : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0))].sort((a, b) => a - b);
  if (!thresholds.length) return { reminded: 0 };
  const max = Math.max(...thresholds);
  const rows = await many(`${SELECT} WHERE l.status = 'active' AND l.expiry_date IS NOT NULL AND l.expiry_date <= $1::date`, [addDays(now, max)]);
  let reminded = 0;
  for (const r of rows) {
    const left = daysBetween(now, iso(r.expiry_date));
    // the smallest threshold reached (an expired licence: threshold 0)
    const threshold = left < 0 ? 0 : thresholds.find((t) => left <= t);
    if (threshold === undefined) continue;
    const ins = await one(`INSERT INTO compliance_licence_reminders(licence_id, expiry_date, days_before) VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING RETURNING licence_id`, [r.id, iso(r.expiry_date), left < 0 ? -1 : threshold]);
    if (!ins) continue;
    const what = `${r.licence_type}${r.licence_number ? ` ${r.licence_number}` : ''} of ${r.holder_name}`;
    await notify({ type: 'reminder', priority: left <= 15 ? 'high' : 'normal',
      title: left < 0 ? `Licence expired: ${r.holder_name}` : `Licence expires in ${left} day(s): ${r.holder_name}`,
      message: left < 0 ? `${what} expired on ${iso(r.expiry_date)}.` : `${what} expires on ${iso(r.expiry_date)}. Renewal status: ${r.renewal_status}.`,
      link: '/compliance/licences', entity: 'compliance_licence', entityId: r.id, audience: 'read:compliance' });
    if (r.user_id) {
      await notify({ userId: r.user_id, type: 'reminder', title: `Your licence ${left < 0 ? 'has expired' : `expires in ${left} day(s)`}`,
        message: `${what}: expiry ${iso(r.expiry_date)}.`, link: '/compliance/licences', entity: 'compliance_licence', entityId: r.id });
    }
    if (left <= 30 && r.renewal_status === 'not-due') await query("UPDATE compliance_licences SET renewal_status = 'due', updated_at = now() WHERE id = $1", [r.id]);
    reminded += 1;
  }
  return { reminded };
}
