/**
 * Audit trail queries for the screens: the history of one record (timeline on its detail screen) and the filtered,
 * paged log of Master > Audit Trail, both as business events (lib/auditEvents.js). Read only: the stored audit rows
 * are never changed.
 */
import { many, one } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { businessTimeZone } from '../../lib/dates.js';
import { ENTITIES } from '../../lib/scope.js';
import { RECORD_KEYS, groupFieldChanges, toEvents } from '../../lib/auditEvents.js';
import { actionText, entityLabel } from '../../lib/auditLabels.js';

const COLUMNS = 'a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source';

/** Audit entity names used for a record type in audit_log (the scope registry calls a quotation "quote"). */
const AUDIT_ENTITY = { quote: 'quotation' };
/** Scope registry key of an audit entity. */
export const SCOPE_ENTITY = { quotation: 'quote', policy: 'policy', claim: 'claim', client: 'client', lead: 'lead', endorsement: 'endorsement',
  receipt: 'receipt', renewal: 'renewal', placement: 'placement', broker_slip: 'broker_slip' };

/** The stored id of a record given its id or number (policy number, claim number ...); the reference itself when unknown. */
export async function recordId(entity, ref) {
  const scopeKey = SCOPE_ENTITY[entity];
  const e = scopeKey && ENTITIES[scopeKey];
  if (e) {
    const row = await one(`SELECT id::text AS id FROM ${e.table} WHERE ${e.keys.map((k) => `${k}::text = $1`).join(' OR ')} LIMIT 1`, [String(ref)]);
    return row?.id || String(ref);
  }
  const [table, col] = RECORD_KEYS[entity] || [];
  if (!table) return String(ref);
  const row = await one(`SELECT id::text AS id FROM ${table} WHERE id::text = $1 OR ${col}::text = $1 LIMIT 1`, [String(ref)]).catch(() => null);
  return row?.id || String(ref);
}

/**
 * The steps a record keeps in its own columns (when, by whom): [action, time, user, extra]. Records created before
 * their screens wrote the audit trail (sample data, go-live loads, older releases) still show how they got to where
 * they are; a step is only taken from the record when the trail has no entry for it. Time and user are columns of
 * the record (t) or a sub-query on it; extra.when limits a step to records in that state (a rejection only kept in
 * the status), extra.before / extra.after are the values before and after the step (status left and reached, number of the record
 * it created, remarks given).
 */
// the status a rejected quotation was in, from the steps it had reached (customer accepted, approved, sent for approval)
const QUOTE_STATUS_BEFORE_REJECT = `CASE WHEN t.customer_accepted_at IS NOT NULL THEN 'CustomerAccepted' WHEN t.approved_at IS NOT NULL THEN 'Approved'
  WHEN t.approval_sent_at IS NOT NULL THEN 'PendingCustomer' ELSE 'Draft' END`;
const POLICY_OF_QUOTE = (col) => `(SELECT p.${col} FROM policies p WHERE p.id = t.policy_id)`;
const LIFECYCLE = {
  lead: ['leads', [['create', 'created_at', 'created_by'], ['assign', 'assigned_at', null]]],
  quotation: ['quotes', [['create', 'created_at', 'created_by'], ['send-for-approval', 'approval_sent_at', 'COALESCE(t.agent_user_id, t.created_by)'],
    ['approve', 'approved_at', 'approved_by'], ['customer-accept', 'customer_accepted_at', "'customer:' || t.id"], ['submit', 'submitted_to_insurer_at', 'submitted_by'],
    ['reject', 't.updated_at', 't.updated_by', { when: "t.status = 'rejected'", before: { quotationStatus: QUOTE_STATUS_BEFORE_REJECT },
      after: { quotationStatus: "'Rejected'", remarks: 't.remarks' } }],
    ['convert-to-policy', POLICY_OF_QUOTE('created_at'), POLICY_OF_QUOTE('created_by'),
      { when: 't.policy_id IS NOT NULL', after: { quotationStatus: "'ConvertedToPolicy'", policyNumber: POLICY_OF_QUOTE('policy_number') } }]]],
  policy: ['policies', [['create', 'created_at', 'created_by', { after: { policyNumber: 't.policy_number', policyStatus: 't.status' } }],
    ['payment-confirm', 'paid_at', null, { after: { paymentStatus: 't.payment_status' } }]]],
  broker_slip: ['broker_slips', [['create', 'created_at', 'created_by']]],
  placement: ['placements', [['create', 'created_at', 'created_by'], ['send', 'sent_at', null], ['acknowledge', 'acknowledged_at', 'acknowledged_by'],
    ['record-epolicy', 'epolicy_received_at', 'epolicy_received_by'], ['check', 'checked_at', 'checked_by'], ['book', 'issued_at', 'issued_by']]],
  receipt: ['receipts', [['create', 'created_at', 'created_by'], ['cancel', 'cancelled_at', 'cancelled_by']]],
  // each step says the status it reached (and a rejection its reason), as the trail of the screens does
  journal_voucher: ['journal_vouchers', [['create', 'created_at', 'created_by'], ['approve', 'approved_at', 'approved_by', { after: { status: "'Approved'" } }],
    ['post', 'posted_at', 'posted_by', { after: { status: "'Posted'" } }],
    ['reject', 'rejected_at', 'rejected_by', { after: { status: "'Rejected'", reason: 't.rejection_reason' } }], ['cancel', 'cancelled_at', 'cancelled_by', { after: { status: "'Cancelled'" } }]]],
  disbursement: ['disbursements', [['create', 'created_at', 'created_by'], ['approve', 'approved_at', 'approved_by', { after: { status: "'Approved'" } }],
    ['pay', 'paid_at', null, { after: { status: "'Paid'" } }]]],
  petty_cash_request: ['petty_cash_requests', [['create', 'created_at', 'created_by'], ['approve', 'approved_at', 'approved_by', { after: { status: "'Approved'" } }],
    ['reject', 'rejected_at', 'rejected_by', { after: { status: "'Rejected'", reason: 't.rejection_reason' } }],
    ['disburse', '(SELECT min(d.created_at) FROM petty_cash_disbursements d WHERE d.request_id = t.id)',
      '(SELECT d.created_by FROM petty_cash_disbursements d WHERE d.request_id = t.id ORDER BY d.created_at LIMIT 1)', { when: "t.status = 'disbursed'", after: { status: "'Disbursed'" } }]]],
  petty_cash_fund: ['petty_cash_funds', [['create', 'created_at', 'created_by', { after: { fundSize: 't.fund_size', status: 't.status' } }]]],
  petty_cash_disbursement: ['petty_cash_disbursements', [['create', 'created_at', 'created_by', { after: { status: 't.status' } }]]],
  commission_line: ['commissions', [['accrue', 'accrued_at', null], ['mark-eligible', 'eligible_at', 'eligible_by'], ['approve', 'approved_at', 'approved_by'],
    ['pay', 'paid_at', 'paid_by'], ['reverse', 'reversed_at', 'reversed_by']]],
};
/** Trail actions that already tell a step (a record loaded in bulk was created by the load). */
const SAME_STEP = { create: /^(create|create-from-.*|bulk-create|go-live-migration|convert.*)$/, 'convert-to-policy': /^(convert-to-policy|update-converted-policy)$/ };
const sqlOf = (expr) => (/^[a-z_]+$/.test(expr) ? `t.${expr}` : expr);

/** The steps of a record taken from its own columns that its trail does not hold, as audit rows (in step order). */
async function lifecycleRows(entity, id, stored) {
  const [table, steps] = LIFECYCLE[entity] || [];
  if (!table) return [];
  const cols = steps.flatMap(([, at, by, extra = {}], i) => [
    `${sqlOf(at)} AS s${i}_at`, by ? `${sqlOf(by)} AS s${i}_by` : null, extra.when ? `(${extra.when}) AS s${i}_when` : null,
    ...Object.values(extra.before || {}).map((expr, j) => `${expr} AS s${i}_b${j}`),
    ...Object.values(extra.after || {}).map((expr, j) => `${expr} AS s${i}_a${j}`)].filter(Boolean));
  const rec = await one(`SELECT ${cols.join(', ')} FROM ${table} t WHERE t.id::text = $1`, [id]).catch(() => null);
  if (!rec) return [];
  const told = (action) => stored.some((r) => (SAME_STEP[action] || new RegExp(`^${action}(-|$)`)).test(String(r.action || '')));
  // a status the trail already shows reached (a rejection recorded as a status change) is not told again
  const reached = (after) => Object.entries(after || {}).some(([k, v]) => /status$/i.test(k) && stored.some((r) => r.after_data?.[k] === v));
  const values = (extra, i, kind) => (extra[kind === 'b' ? 'before' : 'after']
    ? Object.fromEntries(Object.keys(extra[kind === 'b' ? 'before' : 'after']).map((k, j) => [k, rec[`s${i}_${kind}${j}`]]).filter(([, v]) => v != null)) : null);
  // a user column holds a user id or a username (or customer:<id> for the customer's own answer); anything else (a
  // load script's tag) reads as the system
  const names = steps.map((s, i) => rec[`s${i}_by`]).filter((v) => v && !/^(usr_|customer:)/.test(v));
  const known = names.length ? new Set((await many('SELECT username FROM users WHERE username = ANY($1::text[])', [names])).map((u) => u.username)) : new Set();
  return steps.map(([action, , , extra = {}], i) => ({ action, extra, i })).filter(({ action, extra, i }) => rec[`s${i}_at`]
    && (!extra.when || rec[`s${i}_when`]) && !told(action) && !reached(values(extra, i, 'a'))).map(({ action, extra, i }) => {
    const who = rec[`s${i}_by`] && (/^(usr_|customer:)/.test(rec[`s${i}_by`]) || known.has(rec[`s${i}_by`])) ? rec[`s${i}_by`] : null;
    return { id: `${action}-${id}`, at: rec[`s${i}_at`], user_id: who && /^usr_/.test(who) ? who : null, username: who && !/^usr_/.test(who) ? who : null,
      entity, entity_id: id, action, before_data: values(extra, i, 'b'), after_data: values(extra, i, 'a'), source: { channel: 'record' }, step: i };
  });
}

/** Newest first (or oldest first); steps taken at the same moment keep the order they happen in (created before approved). */
const byTime = (dir) => (a, b) => (dir === 'ASC' ? 1 : -1) * (new Date(a.at) - new Date(b.at) || (a.step ?? -1) - (b.step ?? -1)
  || String(a.id).localeCompare(String(b.id)));

/**
 * Events of one record, newest first (sort=asc for oldest first). A claim's history is its field-level trail
 * (claim_field_changes, grouped per action) plus the audited actions the trail does not hold (funds received,
 * payment to the claimant); the source of a trail action is taken from the audit row written with it.
 */
export async function recordHistory(entityIn, ref, { viewer = null, sort = 'desc', limit = 500 } = {}) {
  const entity = AUDIT_ENTITY[entityIn] || entityIn;
  const id = await recordId(entity, ref);
  const dir = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const cap = Math.min(2000, Math.max(1, Number(limit) || 500));
  let rows = await many(`SELECT ${COLUMNS} FROM audit_log a WHERE a.entity = $1 AND a.entity_id = $2 ORDER BY a.at ${dir}, a.id ${dir} LIMIT $3`, [entity, id, cap]);
  if (entity === 'claim') {
    const trail = await many(`SELECT id, at, user_id, username, claim_id, action, field_name, old_value, new_value FROM claim_field_changes
      WHERE claim_id = $1 ORDER BY at, id`, [id]);
    const grouped = groupFieldChanges(trail);
    // audit rows written by the same requests as the trail (the trail already tells these actions field by field)
    const covered = new Set(['create', 'update', 'close', 'reject', 'settle', 'status', 'Settlement Submitted', 'approve-settlement', 'return-settlement']);
    // source of a trail action: the audit row the same request wrote just after it (same user, within a few seconds)
    for (const g of grouped) {
      const t = new Date(g.at).getTime();
      let best = null;
      for (const r of rows) {
        const d = new Date(r.at).getTime() - t;
        if ((r.username || '') !== (g.username || '') || d < 0 || d > 10000) continue;
        if (!best || d < best.d) best = { r, d };
      }
      if (best) g.source = best.r.source;
    }
    rows = [...grouped, ...rows.filter((r) => !covered.has(r.action))]
      .sort((a, b) => (dir === 'ASC' ? 1 : -1) * (new Date(a.at) - new Date(b.at) || String(a.id).localeCompare(String(b.id))));
  }
  // a policy's history includes what was done on its endorsements (created, sent, completed)
  if (entity === 'policy') {
    const endorsementRows = await many(`SELECT ${COLUMNS} FROM audit_log a WHERE a.entity = 'endorsement'
      AND a.entity_id IN (SELECT id FROM endorsements WHERE policy_id = $1) ORDER BY a.at ${dir}, a.id ${dir} LIMIT $2`, [id, cap]);
    if (endorsementRows.length) {
      rows = [...rows, ...endorsementRows].sort((a, b) => (dir === 'ASC' ? 1 : -1) * (new Date(a.at) - new Date(b.at) || String(a.id).localeCompare(String(b.id))));
    }
  }
  const own = await lifecycleRows(entity, id, rows);
  if (own.length) rows = [...rows, ...own].sort(byTime(dir));
  return toEvents(rows, { viewer });
}

/** WHERE clause of the audit log filters: from / to (business dates), username, entity, entity number, action, text. */
async function logFilter(q) {
  const params = [];
  const where = [];
  const add = (sql, ...vals) => {
    let out = sql;
    for (const v of vals) { params.push(v); out = out.replace('?', `$${params.length}`); }
    where.push(out);
  };
  const isoDay = (v, field) => {
    if (v === undefined || v === null || v === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw badRequest('Validation failed', [{ path: field, message: `${field} must be a date (YYYY-MM-DD)` }]);
    return String(v);
  };
  const from = isoDay(q.from, 'from');
  const to = isoDay(q.to, 'to');
  if (from && to && from > to) throw badRequest('Validation failed', [{ path: 'to', message: 'to must be on or after from' }]);
  const tz = (from || to) ? await businessTimeZone() : null;
  if (from) add('a.at >= (?::date)::timestamp AT TIME ZONE ?', from, tz);
  if (to) add('a.at < (?::date + 1)::timestamp AT TIME ZONE ?', to, tz);
  if (q.username) add('a.username = ?', String(q.username));
  if (q.entity) {
    const list = String(q.entity).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.includes('master')) add('(a.entity = ANY(?::text[]) OR a.entity LIKE \'master:%\')', list);
    else add('a.entity = ANY(?::text[])', list);
  }
  if (q.action) add('a.action ILIKE ?', `%${String(q.action).trim()}%`);
  const ref = String(q.entityRef ?? q.entityId ?? '').trim();
  if (ref) {
    // the id itself, or the id of a record whose number is the reference (policy, claim, quotation ... number)
    const ids = new Set([ref]);
    const types = q.entity ? String(q.entity).split(',').map((s) => s.trim()) : Object.keys(RECORD_KEYS);
    for (const t of types) {
      const [table, col] = RECORD_KEYS[t] || [];
      if (!table) continue;
      const found = await many(`SELECT id::text AS id FROM ${table} WHERE lower(${col}) = lower($1) LIMIT 5`, [ref]).catch(() => []);
      found.forEach((f) => ids.add(f.id));
    }
    add('a.entity_id = ANY(?::text[])', [...ids]);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** A page of the audit log as events, newest first: { events, total }. */
export async function logPage(q, { page = 1, perPage = 20, offset = 0 } = {}, viewer = null) {
  const f = await logFilter(q);
  const total = (await one(`SELECT count(*)::int AS n FROM audit_log a ${f.sql}`, f.params)).n;
  const rows = await many(`SELECT ${COLUMNS} FROM audit_log a ${f.sql} ORDER BY a.at DESC, a.id DESC LIMIT $${f.params.length + 1} OFFSET $${f.params.length + 2}`,
    [...f.params, perPage, offset]);
  return { events: await toEvents(rows, { viewer }), total, page, perPage };
}

/** Every matching event (newest first, at most `max`) for the download. */
export async function logExport(q, viewer = null, max = 10000) {
  const f = await logFilter(q);
  const rows = await many(`SELECT ${COLUMNS} FROM audit_log a ${f.sql} ORDER BY a.at DESC, a.id DESC LIMIT $${f.params.length + 1}`, [...f.params, max]);
  return toEvents(rows, { viewer });
}

/** Filter choices of Master > Audit Trail: record types and actions found in the log (labelled), and the users. */
export async function logOptions() {
  const entities = await many('SELECT entity, count(*)::int AS n FROM audit_log GROUP BY entity ORDER BY entity');
  const types = await many('SELECT code, label FROM master_types').catch(() => []);
  const masterLabels = Object.fromEntries(types.map((t) => [t.code, t.label]));
  const recordTypes = [];
  let masters = 0;
  for (const e of entities) {
    if (e.entity.startsWith('master:')) masters += e.n;
    recordTypes.push({ value: e.entity, label: entityLabel(e.entity, masterLabels), count: e.n });
  }
  recordTypes.sort((a, b) => a.label.localeCompare(b.label));
  const actions = await many('SELECT DISTINCT action FROM audit_log ORDER BY action');
  const actionOptions = actions.map((a) => ({ value: a.action, label: actionText(a.action) })).sort((a, b) => a.label.localeCompare(b.label));
  const users = await many(`SELECT DISTINCT a.username AS value, COALESCE(u.display_name, a.username) AS label FROM audit_log a
    LEFT JOIN users u ON u.username = a.username WHERE a.username IS NOT NULL AND a.username NOT LIKE 'customer:%' ORDER BY label`);
  return { recordTypes, actions: actionOptions, users, masterRecords: masters };
}
