/**
 * Talkbot call lists (Operations > Renewals > Talkbot Calls, FRS LEAD-09): the accounts Talkbot calls before their Motor
 * policy expires, the Contact Import file, the call results, one Talkbot outcome per account, and the renewal batch of
 * the confirmed accounts.
 *
 * A call list (TCL-yyyy-nnnnn) is created in Draft from the renewable Motor policies of the criteria (the same list as
 * Renewal Policy). Each policy must pass the eligibility rules: due for renewal (or in the grace period / lapsed and
 * renewable when asked), no renewal already quoted, not under lock-in, marketing calls not refused, not on another open
 * list or already confirmed, not called talkbot.max_lists_per_policy times without being reached, and a mobile number.
 * The rules run again at download: a policy that is no longer eligible is taken off the list (Removed).
 * Download call list writes the Contact Import file; Mark as sent records the Talkbot task name; the Call Records file
 * of the campaign is then uploaded (results.js). A list is cancelled (Draft, Sent to Talkbot) with a reason, and closed
 * when its results are worked (by hand, or talkbot.auto_close_days after the last upload).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { isWorkingDay, nextWorkingDay } from '../../lib/workingCalendar.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { requiredReason } from '../ops-masters/records.js';
import { rate, renewablePolicies } from '../renewals/service.js';
import { createBatch } from '../renewals/batches.js';
import { CONFIRMED, NOT_REACHED, OUTCOME_LABELS, OUTCOMES } from './outcomes.js';

export const LIST_STATUS = { draft: 'Draft', sent: 'Sent to Talkbot', 'results-loaded': 'Results loaded', closed: 'Closed', cancelled: 'Cancelled' };
/** Renewal states a call list takes: due, and with expired policies the grace period and lapsed renewable ones. */
const DUE = ['due'];
const EXPIRED_RENEWABLE = ['grace', 'lapsed'];
/** Renewal statuses that mean the renewal is already being quoted (FR-TBT-002 R2). */
const BEING_QUOTED = ['quoted', 'pending-approval', 'approved'];
/** Outcomes of a line that was not reached (counted for talkbot.max_lists_per_policy). */
const UNREACHED = ['missed-call', 'uncontacted', 'wrong-contact', 'not-called'];
const MOTOR = 'MOTOR';
/** Column limit of the Talkbot platform. */
const CELL_MAX = 200;

/** A refusal on one field: the message is shown under the field and as the toast. */
const fieldError = (path, message) => badRequest(message, [{ path, message }]);

const REASON = {
  quoted: 'Renewal already being quoted', lockIn: 'Lock-in or Scheme 2', doNotCall: 'Do not call', noMobile: 'No mobile number',
  onList: (n) => `Already on call list ${n}`, called: (n) => `Called ${n} times`, notRenewable: 'No longer renewable',
};

export async function talkbotSettings() {
  return {
    daysBefore: Number(await getSetting('talkbot.days_before_expiry', 3)) || 0,
    maxAccounts: Number(await getSetting('talkbot.max_accounts', 2000)) || 2000,
    maxLists: Number(await getSetting('talkbot.max_lists_per_policy', 3)) || 0,
    validDays: Number(await getSetting('talkbot.confirmation_valid_days', 30)) || 0,
    taskPattern: String(await getSetting('talkbot.task_name_pattern', 'TIS_MV - MMM DD, YYYY')),
    depreciation: Number(await getSetting('talkbot.sum_insured_depreciation_pct', 10)) || 0,
    maxBatch: Number(await getSetting('renewals.batch_max_policies', 500)) || 500,
  };
}

/** Mobile number of the Contact Import file: 11 digits starting 09 (+639 / 639 converted); null when not a mobile number. */
export function mobileOf(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('63')) d = `0${d.slice(2)}`;
  else if (d.length === 10 && d.startsWith('9')) d = `0${d}`;
  return /^09\d{9}$/.test(d) ? d : null;
}
/** A mobile number as the screens show it (0917 *** 7105). */
export const maskMobile = (m) => (m ? `${m.slice(0, 4)} *** ${m.slice(-4)}` : null);

/** First and last character of the e-mail name and the domain ("-" in each without an e-mail): the hints Talkbot reads. */
export function emailHints(email) {
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(String(email ?? '').trim());
  if (!m) return { first: '-', last: '-', domain: '-' };
  return { first: m[1][0], last: m[1][m[1].length - 1], domain: `@${m[2]}` };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** The proposed Talkbot task name: talkbot.task_name_pattern with MMM, DD and YYYY of the date ("TIS_MV - OCT 07, 2026"). */
export const taskNameOf = (pattern, iso) => String(pattern).replace('YYYY', iso.slice(0, 4)).replace('MMM', MONTHS[Number(iso.slice(5, 7)) - 1]).replace('DD', iso.slice(8, 10));

/**
 * Expiry dates of the call list of a day (FR-TBT-001 R2): from day + talkbot.days_before_expiry; on the last working day
 * before days off, to the expiry dates the next working day's list would start with, so no account is missed
 * (Wednesday 07/10: 10/10 to 10/10; Friday 09/10: 12/10 to 14/10).
 */
export async function defaultWindow(day = null) {
  const d = day || await today();
  const { daysBefore } = await talkbotSettings();
  const from = addDays(d, daysBefore);
  const to = addDays(await nextWorkingDay(addDays(d, 1)), daysBefore - 1);
  return { expiryFrom: from, expiryTo: to < from ? from : to };
}

const truthy = (v) => v === true || ['true', 'yes', '1'].includes(String(v ?? '').toLowerCase());
/** Lock-in and Scheme 2 accounts (TIS-BRD-SCHM-03): renewal handled under the lock-in, left out of call lists. */
const lockedIn = (details) => truthy(details?.lockIn) || truthy(details?.scheme2);

/** The vehicle as Talkbot reads it: "<Model Year> <MAKE> <Vehicle Model> <Model Variant>" from the policy or its quotation. */
export function carModelOf(details = {}, doc = {}) {
  const v = (k) => String(details?.[k] ?? doc?.[k] ?? '').trim();
  return [v('modelYear'), v('vehicleBrand').toUpperCase(), v('vehicleModel'), v('modelVariant')].filter(Boolean).join(' ');
}

const LOYALTY = `(WITH RECURSIVE ch(pid, d) AS (SELECT p.renewed_from, 1 WHERE p.renewed_from IS NOT NULL
     UNION ALL SELECT pp.renewed_from, ch.d + 1 FROM policies pp JOIN ch ON pp.id = ch.pid WHERE pp.renewed_from IS NOT NULL AND ch.d < 50)
   SELECT count(*) FROM ch)::int`;

/** What the eligibility rules and the file need of each policy. */
async function policyFacts(ids) {
  if (!ids.length) return [];
  return many(`SELECT p.id, p.policy_number, p.client_id, p.owner_user_id, p.expiry_date, p.sum_insured, p.premium_total, p.product_id, p.details, p.status,
      p.renewed_to, p.channel_id, pr.line AS product_line, pr.name AS product_name, q.doc AS quote_doc, cl.display_name AS client_name, cl.phone, cl.email,
      (SELECT r.status FROM renewals r WHERE r.policy_id = p.id AND r.status <> ALL('{renewed,lapsed}') ORDER BY r.created_at DESC LIMIT 1) AS renewal_status,
      (SELECT pc.granted AND pc.withdrawn_at IS NULL FROM privacy_consents pc WHERE pc.party_type = 'client' AND pc.party_id = p.client_id AND pc.purpose = 'marketing'
        ORDER BY pc.recorded_at DESC, pc.id DESC LIMIT 1) AS marketing_consent,
      (SELECT count(*) FROM claims c WHERE c.policy_id = p.id)::int AS claims_count, ${LOYALTY} AS loyalty_years
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN clients cl ON cl.id = p.client_id LEFT JOIN quotes q ON q.id = p.quote_id
    WHERE p.id = ANY($1)`, [ids]);
}

/** The other call lists of the policies (not cancelled, line not removed), except one list. */
async function otherLists(ids, exceptListId = null) {
  if (!ids.length) return new Map();
  const rows = await many(`SELECT l.policy_id, cl.id AS list_id, cl.list_number, cl.status, l.outcome, l.outcome_at
    FROM talkbot_call_lines l JOIN talkbot_call_lists cl ON cl.id = l.list_id
    WHERE l.policy_id = ANY($1) AND l.line_status = 'active' AND cl.status <> 'cancelled' AND ($2::text IS NULL OR cl.id <> $2)`, [ids, exceptListId]);
  const by = new Map();
  for (const r of rows) by.set(r.policy_id, [...(by.get(r.policy_id) || []), r]);
  return by;
}

/**
 * The reason a policy cannot be on a call list (FR-TBT-002), or null. full: also the rules about other lists (at
 * creation); at download only the policy's own state is checked.
 */
function exclusionOf(p, lists, s, { full = true, since }) {
  if (BEING_QUOTED.includes(p.renewal_status)) return REASON.quoted;
  if (lockedIn(p.details)) return REASON.lockIn;
  if (p.marketing_consent === false) return REASON.doNotCall;
  if (full) {
    const open = lists.find((l) => ['draft', 'sent'].includes(l.status));
    if (open) return REASON.onList(open.list_number);
    const confirmed = lists.find((l) => l.outcome === CONFIRMED && l.outcome_at && isoDate(l.outcome_at) >= since);
    if (confirmed) return REASON.onList(confirmed.list_number);
    const unreached = lists.filter((l) => ['results-loaded', 'closed'].includes(l.status) && UNREACHED.includes(l.outcome)).length;
    if (s.maxLists > 0 && unreached >= s.maxLists) return REASON.called(unreached);
  }
  if (!mobileOf(p.phone)) return REASON.noMobile;
  return null;
}

/**
 * Policies of the criteria that can be called: the renewable Motor policies with an expiry date in the range (the
 * Renewal Policy list), plus the accounts not reached on recallOf, each checked against the eligibility rules.
 * Returns { eligible: [facts], excluded: { reason: count }, total }.
 */
async function candidates(c, scope = null) {
  const s = await talkbotSettings();
  const states = [...DUE, ...(truthy(c.includeExpired) ? EXPIRED_RENEWABLE : [])];
  const q = { expiryFrom: c.expiryFrom, expiryTo: c.expiryTo, renewableOnly: 'true', ...(c.insurerId ? { insurerId: c.insurerId } : {}), ...(scope ? { [SCOPE]: scope } : {}) };
  const { all } = await renewablePolicies(q, { limit: 100000, offset: 0 });
  // a renewal in progress keeps the state of its term (due, grace, lapsed); being quoted is a rule of its own
  const stateOf = (p) => (p.renewalState === 'in-progress' ? { regular: 'due', grace: 'grace', lapsed: 'lapsed' }[p.renewalType] : p.renewalState);
  let ids = all.filter((p) => p.lob === MOTOR && states.includes(stateOf(p))).map((p) => p.policyId);
  if (c.recallOf) {
    const recall = await many(`SELECT l.policy_id FROM talkbot_call_lines l JOIN talkbot_call_lists cl ON cl.id = l.list_id
      WHERE (cl.id = $1 OR cl.list_number = $1) AND l.line_status = 'active' AND l.outcome = ANY($2)`,
    [String(c.recallOf), [...NOT_REACHED, ...(truthy(c.includeCallBack) ? ['call-back'] : [])]]);
    const renewable = new Set((await renewablePolicies({ expiryFrom: '1900-01-01', expiryTo: '2999-12-31', renewableOnly: 'true', ...(scope ? { [SCOPE]: scope } : {}) },
      { limit: 100000, offset: 0 })).all.filter((p) => [...DUE, ...EXPIRED_RENEWABLE].includes(stateOf(p))).map((p) => p.policyId));
    ids = [...new Set([...ids, ...recall.map((r) => r.policy_id).filter((id) => renewable.has(id))])];
  }
  let facts = await policyFacts(ids);
  if (c.salesPersonId) facts = facts.filter((p) => p.owner_user_id === c.salesPersonId);
  if (c.channelId) facts = facts.filter((p) => String(p.channel_id ?? '') === String(c.channelId));
  const lists = await otherLists(facts.map((p) => p.id), c.recallOf ? (await one('SELECT id FROM talkbot_call_lists WHERE id = $1 OR list_number = $1', [String(c.recallOf)]))?.id : null);
  const since = addDays(await today(), -s.validDays);
  const excluded = {};
  const eligible = [];
  for (const p of facts) {
    const why = exclusionOf(p, lists.get(p.id) || [], s, { full: true, since });
    if (why) excluded[why] = (excluded[why] || 0) + 1;
    else eligible.push(p);
  }
  eligible.sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)) || a.policy_number.localeCompare(b.policy_number));
  return { eligible, excluded, total: facts.length };
}

/** "6 accounts left out: 4 No mobile number, 2 Lock-in or Scheme 2" (MSG-TBT-006), or null. */
export function leftOutText(excluded) {
  const parts = Object.entries(excluded || {}).sort((a, b) => b[1] - a[1]);
  const n = parts.reduce((t, [, c]) => t + c, 0);
  return n ? `${n} accounts left out: ${parts.map(([r, c]) => `${c} ${r}`).join(', ')}` : null;
}

async function checkCriteria(c) {
  const from = isoDate(c.expiryFrom);
  const to = isoDate(c.expiryTo);
  if (!from || !to) throw fieldError(from ? 'expiryTo' : 'expiryFrom', 'Enter the expiry dates');
  if (to < from) throw fieldError('expiryTo', 'Expiry Date To cannot be before Expiry Date From');
  return { ...c, expiryFrom: from, expiryTo: to };
}

/** New call list dialog: what the criteria give (accounts that can be called, accounts left out by reason). */
export async function preview(criteria, scope = null) {
  const c = await checkCriteria(criteria);
  const s = await talkbotSettings();
  const { eligible, excluded } = await candidates(c, scope);
  return { eligible: eligible.length, maxAccounts: s.maxAccounts, excluded, leftOut: leftOutText(excluded) };
}

/** Indicative renewal values of the file: sum insured less the depreciation, and the re-rated gross premium, in whole pesos. */
async function renewalValues(p, s) {
  const sumInsured = Math.round(Number(p.sum_insured || 0) * (1 - s.depreciation / 100));
  const r = await rate({ product_line: p.product_line, product_id: p.product_id, premium_total: p.premium_total, premium_old: null, sum_insured: sumInsured,
    claims_count: p.claims_count, loyalty_years: p.loyalty_years });
  return { sumInsured, premium: Math.round(r.total) };
}

/** The contact data of a line, read from the policy and its client at creation and again at download. */
async function contactOf(p, s) {
  const v = await renewalValues(p, s);
  return { contactName: String(p.client_name || '').toUpperCase(), phone: mobileOf(p.phone), email: p.email || null, expiryDate: p.expiry_date,
    sumInsured: v.sumInsured, premium: v.premium, carModel: carModelOf(p.details, p.quote_doc) };
}

/**
 * Create a call list in Draft (FR-TBT-001). criteria: expiryFrom, expiryTo, insurerId, includeExpired, recallOf,
 * includeCallBack, salesPersonId, channelId. Refused when no account can be called (MSG-TBT-002) or more than
 * talkbot.max_accounts (MSG-TBT-003). userId null: the daily job.
 */
export async function createList(criteria, userId, { scope = null, system = false } = {}) {
  const c = await checkCriteria(criteria);
  const s = await talkbotSettings();
  const { eligible, excluded } = await candidates(c, scope);
  if (!eligible.length) {
    throw badRequest('No Motor policy due for renewal matches these criteria. Widen the expiry dates or clear a filter.', [{ path: 'criteria', code: 'NO_ACCOUNT', message: leftOutText(excluded) || 'No account' }]);
  }
  if (eligible.length > s.maxAccounts) {
    throw badRequest(`The call list would hold ${eligible.length.toLocaleString('en-US')} accounts; a call list can hold at most ${s.maxAccounts.toLocaleString('en-US')}. Narrow the dates or choose an insurer.`);
  }
  const lines = [];
  for (const p of eligible) lines.push({ p, ...(await contactOf(p, s)) });
  const recall = c.recallOf ? await one('SELECT id FROM talkbot_call_lists WHERE id = $1 OR list_number = $1', [String(c.recallOf)]) : null;
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('talkbot_call_list', { db, unique: { table: 'talkbot_call_lists', column: 'list_number' } });
    const stored = { expiryFrom: c.expiryFrom, expiryTo: c.expiryTo, insurerId: c.insurerId || null, includeExpired: truthy(c.includeExpired), recallOf: c.recallOf || null,
      includeCallBack: truthy(c.includeCallBack), salesPersonId: c.salesPersonId || null, channelId: c.channelId || null };
    const l = (await db.query(`INSERT INTO talkbot_call_lists(list_number, criteria, excluded, expiry_from, expiry_to, recall_of, created_by, created_by_system)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [number, JSON.stringify(stored), JSON.stringify(excluded), c.expiryFrom, c.expiryTo, recall?.id || null, userId, system])).rows[0];
    for (const x of lines) {
      await db.query(`INSERT INTO talkbot_call_lines(list_id, policy_id, client_id, owner_user_id, contact_name, phone, email, expiry_date, sum_insured, premium, car_model)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [l.id, x.p.id, x.p.client_id, x.p.owner_user_id, x.contactName, x.phone, x.email, x.expiryDate, x.sumInsured, x.premium, x.carModel]);
    }
    return l.id;
  });
  return getList(id);
}

const LIST_SELECT = `SELECT cl.*, cu.display_name AS created_by_name, su.display_name AS sent_by_name,
    (SELECT count(*) FROM talkbot_call_lines l WHERE l.list_id = cl.id AND l.line_status = 'active')::int AS accounts,
    (SELECT count(*) FROM talkbot_call_lines l WHERE l.list_id = cl.id AND l.line_status = 'removed')::int AS removed,
    (SELECT count(*) FROM talkbot_call_lines l WHERE l.list_id = cl.id AND l.line_status = 'active' AND l.outcome = 'willing')::int AS willing,
    (SELECT count(*) FROM talkbot_call_lines l WHERE l.list_id = cl.id AND l.line_status = 'active' AND l.outcome = 'not-called')::int AS not_called,
    (SELECT COALESCE(jsonb_object_agg(x.outcome, x.n), '{}'::jsonb) FROM (SELECT l.outcome, count(*)::int AS n FROM talkbot_call_lines l
       WHERE l.list_id = cl.id AND l.line_status = 'active' GROUP BY l.outcome) x) AS outcome_counts,
    (SELECT count(*) FROM talkbot_call_attempts a JOIN talkbot_call_lines l ON l.id = a.line_id WHERE l.list_id = cl.id)::int AS call_records,
    (SELECT COALESCE(jsonb_agg(b.batch_number ORDER BY b.created_at), '[]'::jsonb) FROM renewal_batches b WHERE cl.batch_ids ? b.id) AS batch_numbers
  FROM talkbot_call_lists cl LEFT JOIN users cu ON cu.id = cl.created_by LEFT JOIN users su ON su.id = cl.sent_by`;

export const listApi = (r) => ({
  id: r.id, listNumber: r.list_number, status: r.status, statusLabel: LIST_STATUS[r.status] || r.status, taskName: r.task_name,
  expiryFrom: r.expiry_from, expiryTo: r.expiry_to, criteria: r.criteria || {}, excluded: r.excluded || {}, leftOut: leftOutText(r.excluded),
  accounts: r.accounts ?? 0, removed: r.removed ?? 0, willing: r.willing ?? 0, notCalled: r.not_called ?? 0, outcomeCounts: r.outcome_counts || {}, callRecords: r.call_records ?? 0,
  batchIds: r.batch_ids || [], batchNumbers: r.batch_numbers || [], downloads: r.downloads, lastDownloadAt: r.last_download_at, lastDownloadRows: r.last_download_rows,
  lastDownloadDropped: r.last_download_dropped || [], sentAt: r.sent_at, sentBy: r.sent_by_name || null, lastUploadAt: r.last_upload_at,
  closedAt: r.closed_at, cancelledAt: r.cancelled_at, cancelReason: r.cancel_reason, createdBy: r.created_by_system ? 'System' : r.created_by_name || null, createdAt: r.created_at,
});

async function loadList(id, db = null) {
  const sql = `${LIST_SELECT} WHERE cl.id = $1 OR cl.list_number = $1`;
  const r = db ? (await db.query(sql, [String(id)])).rows[0] : await one(sql, [String(id)]);
  if (!r) throw notFound('Call list not found');
  return r;
}

/** Call lists, newest first (status, search by number or task name). */
export async function listLists(q, pg) {
  const where = [];
  const params = [];
  if (q.status) { params.push(String(q.status).split(',')); where.push(`cl.status = ANY($${params.length})`); }
  if (q.search) { params.push(`%${q.search}%`); where.push(`(cl.list_number ILIKE $${params.length} OR cl.task_name ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await one(`SELECT count(*)::int AS n FROM talkbot_call_lists cl ${w}`, params)).n;
  const rows = await many(`${LIST_SELECT} ${w} ORDER BY cl.created_at DESC, cl.list_number DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  return { total, items: rows.map(listApi) };
}

export const lineApi = (r) => ({
  id: r.id, policyId: r.policy_id, policyNumber: r.policy_number, clientId: r.client_id, clientName: r.contact_name, mobile: maskMobile(r.phone),
  vehicle: r.car_model || null, expiryDate: r.expiry_date, sumInsured: r.sum_insured === null ? null : Number(r.sum_insured), premium: r.premium === null ? null : Number(r.premium),
  salesPerson: r.owner_name || null, lineStatus: r.line_status, removedReason: r.removed_reason, removedAt: r.removed_at,
  outcome: r.outcome, outcomeLabel: OUTCOME_LABELS[r.outcome] || r.outcome, outcomeDetail: r.outcome_detail, outcomeAt: r.outcome_at, manual: r.outcome_source === 'manual',
  manualRemark: r.manual_remark, callbackDate: r.callback_date, calls: r.attempts, lastCallAt: r.last_call_at,
  batchId: r.batch_id, batchNumber: r.batch_number || null, quoteStatus: r.quote_status, quoteNumber: r.quote_number, skipReason: r.skip_reason, renewalId: r.renewal_id,
});

const LINE_SELECT = `SELECT l.*, p.policy_number, u.display_name AS owner_name, b.batch_number FROM talkbot_call_lines l JOIN policies p ON p.id = l.policy_id
  LEFT JOIN users u ON u.id = l.owner_user_id LEFT JOIN renewal_batches b ON b.id = l.batch_id`;

/** One call list with its lines (record scope: a scoped user sees the lines of their book only); filters outcome, lineStatus, search. */
export async function getList(id, { scope = null, outcome = null, lineStatus = null, search = null } = {}) {
  const l = await loadList(id);
  const params = [l.id];
  const where = ['l.list_id = $1'];
  if (outcome) { params.push(String(outcome).split(',')); where.push(`l.outcome = ANY($${params.length})`); }
  if (lineStatus) { params.push(lineStatus); where.push(`l.line_status = $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`(p.policy_number ILIKE $${params.length} OR l.contact_name ILIKE $${params.length})`); }
  if (scope) where.push(scopeSql(scope, 'policy', 'p', params));
  const lines = await many(`${LINE_SELECT} WHERE ${where.join(' AND ')} ORDER BY l.expiry_date, p.policy_number`, params);
  return { ...listApi(l), lines: lines.map(lineApi) };
}

async function lineOfList(listId, lineId, db = { query }) {
  const r = (await db.query(`${LINE_SELECT} WHERE l.list_id = $1 AND (l.id::text = $2 OR p.policy_number = $2)`, [listId, String(lineId)])).rows[0];
  if (!r) throw notFound('The account is not on this call list');
  return r;
}

/** Take an account off a Draft list with a reason of the Reason Codes master (FR-TBT-001), or put it back. */
export async function removeLine(listId, lineId, input, userId) {
  const l = await loadList(listId);
  if (l.status !== 'draft') throw conflict(`Call list ${l.list_number} is ${LIST_STATUS[l.status]}; accounts can be removed only while it is Draft`);
  const line = await lineOfList(l.id, lineId);
  if (!String(input.reasonCode ?? '').trim()) throw fieldError('reasonCode', 'Enter the reason for removing this account from the call list');
  const why = await requiredReason({ query }, 'talkbot_line_remove', input);
  await query(`UPDATE talkbot_call_lines SET line_status = 'removed', removed_reason = $2, removed_reason_code = $3, removed_by = $4, removed_at = now() WHERE id = $1`,
    [line.id, why.text, why.code, userId]);
  return { before: lineApi(line), after: lineApi(await lineOfList(l.id, line.id)), listNumber: l.list_number };
}

export async function restoreLine(listId, lineId) {
  const l = await loadList(listId);
  if (l.status !== 'draft') throw conflict(`Call list ${l.list_number} is ${LIST_STATUS[l.status]}; accounts can be put back only while it is Draft`);
  const line = await lineOfList(l.id, lineId);
  if (line.line_status !== 'removed') throw conflict('The account is on the list');
  await query(`UPDATE talkbot_call_lines SET line_status = 'active', removed_reason = NULL, removed_reason_code = NULL, removed_by = NULL, removed_at = NULL WHERE id = $1`, [line.id]);
  return { before: lineApi(line), after: lineApi(await lineOfList(l.id, line.id)), listNumber: l.list_number };
}

export const CONTACT_IMPORT_COLUMNS = [
  { key: 'contactId', header: 'Contact ID', width: 20 },
  { key: 'phone', header: 'Phone', required: true, width: 14 },
  { key: 'name', header: 'Customer_PERSON_NAME', required: true, width: 32 },
  { key: 'expiration', header: 'Expiration_DATE', required: true, width: 16 },
  { key: 'sumInsured', header: 'Sum_Insured_AMOUNT', required: true, width: 20, type: 'integer' },
  { key: 'premium', header: 'Premium_AMOUNT', required: true, width: 18, type: 'integer' },
  { key: 'first', header: 'First_letter', required: true, width: 12 },
  { key: 'last', header: 'Last_letter', required: true, width: 12 },
  { key: 'domain', header: 'Domain_EMAIL', required: true, width: 20 },
  { key: 'carModel', header: 'CAR_MODEL', required: true, width: 36 },
  { key: 'displayName', header: 'Name', width: 32 },
  { key: 'insuranceStatus', header: 'Insurance Status', width: 22 },
];
const CONTACT_IMPORT_NOTES = 'Required headers are in red. The file is not password protected. A cell holds at most 200 characters.';
const cut = (v) => (typeof v === 'string' ? v.slice(0, CELL_MAX) : v);

/**
 * Download call list (FR-TBT-003): the eligibility rules run again and an account no longer eligible is taken off the
 * list (Removed, "No longer eligible: <reason>"); the contact data are read again from the client; the Contact Import
 * file is built from the remaining lines. Returns { fileName, buffer, rows, dropped: [policy numbers] }.
 */
export async function downloadList(listId, userId) {
  const l = await loadList(listId);
  if (!['draft', 'sent'].includes(l.status)) throw conflict(`Call list ${l.list_number} is ${LIST_STATUS[l.status]}; it can no longer be downloaded`);
  const s = await talkbotSettings();
  // The Contact Import file is written as xlsx; another file type set in talkbot.export_format is refused, not ignored
  const format = String((await getSetting('talkbot.export_format')) ?? 'xlsx').toLowerCase();
  if (format !== 'xlsx') throw badRequest('The call list is written as an Excel workbook (xlsx) only. Ask the administrator to set the file type of the Contact Import file to xlsx.');
  const lines = await many(`${LINE_SELECT} WHERE l.list_id = $1 AND l.line_status = 'active' ORDER BY l.expiry_date, p.policy_number`, [l.id]);
  const facts = new Map((await policyFacts(lines.map((x) => x.policy_id))).map((p) => [p.id, p]));
  const { all } = await renewablePolicies({ expiryFrom: '1900-01-01', expiryTo: '2999-12-31', renewableOnly: 'true' }, { limit: 100000, offset: 0 });
  const renewable = new Set(all.map((p) => p.policyId));
  const dropped = [];
  const keep = [];
  for (const line of lines) {
    const p = facts.get(line.policy_id);
    const why = !p || !renewable.has(p.id) ? REASON.notRenewable : exclusionOf(p, [], s, { full: false });
    if (why) dropped.push({ line, why });
    else keep.push({ line, p, ...(await contactOf(p, s)) });
  }
  if (!keep.length && !dropped.length) throw badRequest('There is no account left to call on this list');
  const day = await today();
  await withTransaction(async (db) => {
    for (const d of dropped) {
      await db.query(`UPDATE talkbot_call_lines SET line_status = 'removed', removed_reason = $2, removed_at = now(), removed_by = $3 WHERE id = $1`,
        [d.line.id, `No longer eligible: ${d.why}`, userId]);
    }
    for (const k of keep) {
      await db.query('UPDATE talkbot_call_lines SET contact_name = $2, phone = $3, email = $4, sum_insured = $5, premium = $6, car_model = $7 WHERE id = $1',
        [k.line.id, k.contactName, k.phone, k.email, k.sumInsured, k.premium, k.carModel]);
    }
    await db.query(`UPDATE talkbot_call_lists SET downloads = downloads + $2, last_download_at = CASE WHEN $2 = 1 THEN now() ELSE last_download_at END,
        last_download_by = CASE WHEN $2 = 1 THEN $3 ELSE last_download_by END, last_download_rows = CASE WHEN $2 = 1 THEN $4 ELSE last_download_rows END,
        last_download_dropped = $5, updated_at = now() WHERE id = $1`, [l.id, keep.length ? 1 : 0, userId, keep.length, JSON.stringify(dropped.map((d) => d.line.policy_number))]);
  });
  if (!keep.length) throw badRequest('There is no account left to call on this list');
  const rows = keep.map((k) => {
    const hints = emailHints(k.email);
    return {
      contactId: k.line.policy_number, phone: k.phone, name: cut(k.contactName), expiration: k.expiryDate, sumInsured: k.sumInsured, premium: k.premium,
      first: hints.first, last: hints.last, domain: cut(hints.domain), carModel: cut(k.carModel), displayName: cut(k.contactName),
      insuranceStatus: k.expiryDate >= day ? 'EXPIRING INSURANCE' : 'EXPIRED INSURANCE',
    };
  });
  const buffer = writeXlsx({ title: `${l.list_number} Contact Import`, sheets: [{ name: 'Contact Import', columns: CONTACT_IMPORT_COLUMNS, rows, banner: [CONTACT_IMPORT_NOTES], bannerGap: false, autoFilter: false }] });
  return { fileName: `${l.list_number}_Contact_Import.xlsx`, buffer, rows: rows.length, dropped: dropped.map((d) => d.line.policy_number), listNumber: l.list_number, listId: l.id };
}

/** The proposed Talkbot task name of today (talkbot.task_name_pattern). */
export async function proposedTaskName() {
  return taskNameOf((await talkbotSettings()).taskPattern, await today());
}

/** Mark as sent (FR-TBT-004): the list was downloaded and loaded on the Talkbot platform under the task name. */
export async function markSent(listId, taskName, userId) {
  const l = await loadList(listId);
  if (l.status !== 'draft') throw conflict(`Call list ${l.list_number} is ${LIST_STATUS[l.status]}`);
  if (!l.downloads) throw badRequest('Download the call list before you mark it as sent');
  const name = String(taskName ?? '').trim();
  if (!name) throw fieldError('taskName', 'Enter the Talkbot task name');
  if (name.length > 100) throw fieldError('taskName', 'The Talkbot task name has at most 100 characters');
  await query("UPDATE talkbot_call_lists SET status = 'sent', task_name = $2, sent_at = now(), sent_by = $3, updated_at = now() WHERE id = $1", [l.id, name, userId]);
  return { before: listApi(l), after: listApi(await loadList(l.id)) };
}

/** Cancel a Draft or Sent list with a reason (FR-TBT-006): its policies can go on a new list. */
export async function cancelList(listId, input, userId) {
  const l = await loadList(listId);
  if (!['draft', 'sent'].includes(l.status)) throw conflict(`Call list ${l.list_number} is ${LIST_STATUS[l.status]}; only a Draft or Sent list can be cancelled`);
  if (!String(input.reasonCode ?? '').trim()) throw fieldError('reasonCode', 'Enter the reason for cancelling the call list');
  const why = await requiredReason({ query }, 'talkbot_list_cancel', input);
  await query("UPDATE talkbot_call_lists SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3, updated_at = now() WHERE id = $1", [l.id, userId, why.text]);
  return { before: listApi(l), after: listApi(await loadList(l.id)), reason: why };
}

/** Close a list whose results were loaded (FR-TBT-006); its outcomes stay on the policies and the renewal timelines. */
export async function closeList(listId, userId) {
  const l = await loadList(listId);
  if (l.status !== 'results-loaded') throw conflict(`Call list ${l.list_number} is ${LIST_STATUS[l.status]}; only a list with results loaded can be closed`);
  await query("UPDATE talkbot_call_lists SET status = 'closed', closed_at = now(), closed_by = $2, updated_at = now() WHERE id = $1", [l.id, userId]);
  return { before: listApi(l), after: listApi(await loadList(l.id)) };
}

/**
 * Create renewal batch (FR-TBT-020): the Willing to renew lines confirmed within talkbot.confirmation_valid_days, not
 * yet in a batch and still renewable without a renewal already quoted, go into Draft renewal batches of at most
 * renewals.batch_max_policies policies, all selected. Returns { batches: [{ id, batchNumber, policies }] }.
 */
export async function createRenewalBatches(listId, user) {
  const l = await loadList(listId);
  if (l.status === 'cancelled') throw conflict(`Call list ${l.list_number} is cancelled`);
  const s = await talkbotSettings();
  const since = addDays(await today(), -s.validDays);
  const lines = await many(`${LINE_SELECT} WHERE l.list_id = $1 AND l.line_status = 'active' AND l.outcome = $2 AND l.batch_id IS NULL ORDER BY l.expiry_date, p.policy_number`,
    [l.id, CONFIRMED]);
  const { all } = await renewablePolicies({ expiryFrom: '1900-01-01', expiryTo: '2999-12-31', renewableOnly: 'true' }, { limit: 100000, offset: 0 });
  const renewable = new Set(all.map((p) => p.policyId));
  const facts = new Map((await policyFacts(lines.map((x) => x.policy_id))).map((p) => [p.id, p]));
  const ready = lines.filter((x) => x.outcome_at && isoDate(x.outcome_at) >= since && renewable.has(x.policy_id) && !BEING_QUOTED.includes(facts.get(x.policy_id)?.renewal_status));
  if (!ready.length) throw badRequest('No Talkbot-confirmed account on this list is waiting for a renewal batch');
  const out = [];
  for (let i = 0; i < ready.length; i += s.maxBatch) {
    const chunk = ready.slice(i, i + s.maxBatch);
    const b = await createBatch({ policies: chunk.map((x) => ({ policyId: x.policy_id, isSelected: true })),
      criteriaOption: { productType: 'Motor', talkbotOutcome: CONFIRMED, talkbotCallList: l.list_number } }, user);
    await query("UPDATE talkbot_call_lines SET batch_id = $2, quote_status = 'in-batch', skip_reason = NULL WHERE id = ANY($1)", [chunk.map((x) => x.id), b.id]);
    await query('UPDATE talkbot_call_lists SET batch_ids = batch_ids || $2::jsonb, updated_at = now() WHERE id = $1', [l.id, JSON.stringify([b.id])]);
    out.push({ id: b.id, batchNumber: b.batchId, policies: chunk.length });
  }
  return { listNumber: l.list_number, batches: out };
}

/** Daily job "Talkbot call list" (FR-TBT-005): the Draft list of the day with the default criteria, on working days only. */
export async function dailyCallList() {
  const day = await today();
  if (!(await isWorkingDay(day))) return { skipped: `${day} is not a working day` };
  const window = await defaultWindow(day);
  try {
    const l = await createList(window, null, { system: true });
    return { listNumber: l.listNumber, accounts: l.accounts };
  } catch (e) {
    if (e.status === 400 && e.details?.[0]?.code === 'NO_ACCOUNT') return { accounts: 0 };
    throw e;
  }
}

/** Daily job "Talkbot call list close" (FR-TBT-006, FR-TBT-010 R4): close lists talkbot.auto_close_days after the last upload; remove old files. */
export async function closeOldLists() {
  const days = Number(await getSetting('talkbot.auto_close_days', 30)) || 0;
  const keep = Number(await getSetting('talkbot.file_retention_days', 365)) || 0;
  const closed = days > 0 ? await many(`UPDATE talkbot_call_lists SET status = 'closed', closed_at = now(), updated_at = now()
    WHERE status = 'results-loaded' AND last_upload_at < now() - make_interval(days => $1) RETURNING list_number`, [days]) : [];
  let purged = 0;
  if (keep > 0) {
    const { deleteObject } = await import('../uploads/storage.js');
    const old = await many('SELECT id, file_key FROM talkbot_call_uploads WHERE file_key IS NOT NULL AND file_purged_at IS NULL AND uploaded_at < now() - make_interval(days => $1)', [keep]);
    for (const u of old) {
      await deleteObject(u.file_key).catch(() => null);
      await query('UPDATE talkbot_call_uploads SET file_purged_at = now() WHERE id = $1', [u.id]);
      purged += 1;
    }
  }
  return { closed: closed.map((r) => r.list_number), filesRemoved: purged };
}

/** Choices of the New call list dialog: default expiry dates, insurers, sales persons, the lists whose accounts can be called again. */
export async function listOptions() {
  const window = await defaultWindow();
  return {
    ...window, today: await today(), taskName: await proposedTaskName(),
    insurers: await many("SELECT id, name FROM insurance_companies WHERE status = 'active' ORDER BY name"),
    salesPersons: await many(`SELECT DISTINCT u.id, u.display_name AS name FROM users u JOIN policies p ON p.owner_user_id = u.id WHERE u.status = 'active' ORDER BY u.display_name`),
    recallLists: await many("SELECT id, list_number AS \"listNumber\", task_name AS \"taskName\" FROM talkbot_call_lists WHERE status IN ('results-loaded', 'closed') ORDER BY created_at DESC LIMIT 50"),
    outcomes: OUTCOMES.map((code) => ({ code, label: OUTCOME_LABELS[code] })),
  };
}

