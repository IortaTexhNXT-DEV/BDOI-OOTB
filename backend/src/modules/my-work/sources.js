/**
 * The open items of My Work, read where they live (no copies): one SQL source per category, all with the same columns,
 * put together with UNION ALL so the list can be filtered, sorted and paged by the database.
 *
 * Columns of every source (COLS): category, kind (sub-type shown on the row), id, ref (document number), title,
 * client_name, due_date, priority (low / normal / high / urgent), status (of the record), next_action, owner_id (the
 * user the item waits on; null for a queue item), queue (true: waits on whoever holds the permission, e.g. an
 * approval), link (front-end path of the record), amount, created_at, reassign (null, or the kind of reassignment the
 * owning module supports: claim, privacy).
 *
 * A category is built only when the user holds the permission to read its records, and every source applies the
 * record scope of lib/scope.js (a user limited to their own book never sees another book's item, whatever the tab).
 * Approvals follow the maker-checker rules of their module: never the user's own submission, only within the user's
 * authority limit where the module checks one (Authority Matrix), only for the roles the module asks.
 */
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { scopeSql } from '../../lib/scope.js';
import { KYC_ITEMS, KYC_DEFAULT_REQUIRED } from '../policies/kyc.js';
import { effectiveAuthority } from '../access-control/service.js';

/** Categories in screen order: code, label, icon, permission needed to see it. */
export const CATEGORIES = [
  { code: 'quotes', label: 'Quotations', icon: 'pi pi-file-edit', permission: 'read:quotations' },
  { code: 'rfq', label: 'Requests for quotation', icon: 'pi pi-send', permission: 'read:quotations' },
  { code: 'placements', label: 'Placement slips', icon: 'pi pi-briefcase', permission: 'read:quotations' },
  { code: 'renewals', label: 'Renewals', icon: 'pi pi-refresh', permission: 'read:renewals' },
  { code: 'receivables', label: 'Premiums due', icon: 'pi pi-wallet', permission: 'read:policies' },
  { code: 'collections', label: 'Collection follow-ups', icon: 'pi pi-phone', permission: 'read:collections' },
  { code: 'endorsements', label: 'Endorsements', icon: 'pi pi-pencil', permission: 'read:endorsements' },
  { code: 'claims', label: 'Claims', icon: 'pi pi-shield', permission: 'read:claims' },
  { code: 'approvals', label: 'Approvals', icon: 'pi pi-check-square', permission: null },
  { code: 'documents', label: 'Missing documents', icon: 'pi pi-id-card', permission: 'read:policies' },
  { code: 'tasks', label: 'Tasks', icon: 'pi pi-calendar', permission: null },
];
export const CATEGORY_CODES = CATEGORIES.map((c) => c.code);

export const COLS = ['category', 'kind', 'id', 'ref', 'title', 'client_name', 'due_date', 'priority', 'status', 'next_action', 'owner_id', 'queue', 'link', 'amount', 'created_at', 'reassign'];
const TYPES = { due_date: 'date', queue: 'boolean', amount: 'numeric', created_at: 'timestamptz' };
const DEFAULTS = { priority: "'normal'", queue: 'false' };

/** SELECT list of a source from its column expressions (missing columns are NULL of the right type). */
const select = (e) => COLS.map((c) => `(${e[c] ?? DEFAULTS[c] ?? 'NULL'})::${TYPES[c] || 'text'} AS ${c}`).join(', ');

/** A priority word of a module (Low / Medium / High / Critical / Urgent...) on the scale of My Work. */
const prio = (x) => `(CASE lower(COALESCE(${x}, '')) WHEN 'critical' THEN 'urgent' WHEN 'urgent' THEN 'urgent' WHEN 'high' THEN 'high'
  WHEN 'low' THEN 'low' ELSE 'normal' END)`;
/** The user id of a column that holds a user id or (older rows) a username. */
const userOf = (col) => `(SELECT uu.id FROM users uu WHERE uu.id = ${col} OR uu.username = ${col} ORDER BY (uu.id = ${col}) DESC LIMIT 1)`;
const CLIENT = (c, l, fallback = 'NULL') => `COALESCE(${c}.display_name, ${l ? `${l}.display_name, ` : ''}${fallback})`;

/**
 * Context of one request: the user, the business date, the parameters list and the settings the sources read.
 * `P(v)` adds a parameter and returns its placeholder.
 */
export async function buildContext(user, { scope = null, today, db }) {
  const params = [];
  const P = (v) => { params.push(v); return `$${params.length}`; };
  const ids = [user.id, user.username].filter(Boolean);
  const soonDays = Math.max(1, Number(await getSetting('myWork.due_soon_days', 7)) || 7);
  const slaDays = Math.max(0, Number(await getSetting('myWork.approval_sla_days', 2)) || 0);
  const tz = String(await getSetting('general.timezone', 'Asia/Manila'));
  const ctx = { user, scope, today, db, params, P, ids, soonDays, slaDays, tz, can: (p) => hasPermission(user, p), roles: user.roles || [] };
  ctx.T = P(today);
  // the user's id and username (text[]), added only when a source compares with them (an unused parameter has no type)
  let me = null;
  Object.defineProperty(ctx, 'ME', { get: () => { me = me || P(ids); return me; } });
  return ctx;
}

const notMine = (ctx, col) => `(${col} IS NULL OR NOT (${col} = ANY(${ctx.ME}::text[])))`;
const rec = (ctx, entity, alias) => scopeSql(ctx.scope, entity, alias, ctx.params);
const localDate = (ctx, ts) => `((${ts}) AT TIME ZONE ${ctx.P(ctx.tz)}::text)::date`;

/** Approval limit of the user for an Authority Matrix transaction type: SQL condition on `amountExpr`. */
async function withinAuthority(ctx, type, amountExpr) {
  if (!(await getSetting('access.authority_enforced', true))) return 'TRUE';
  const exists = (await ctx.db.query("SELECT to_regclass('authority_limits') IS NOT NULL AS ok")).rows[0].ok;
  if (!exists) return 'TRUE';
  const a = await effectiveAuthority(ctx.db, ctx.user.id, type, ctx.today);
  if (!a.found) return String(await getSetting('access.authority_without_limit', 'allow')) === 'refuse' ? 'FALSE' : 'TRUE';
  if (a.unlimited) return 'TRUE';
  return `(COALESCE(${amountExpr}, 0) <= ${ctx.P(a.limit)})`;
}

// ---------------------------------------------------------------------------------------------------- sources

function quotes(ctx) {
  return `SELECT ${select({
    category: "'quotes'",
    kind: "CASE q.status WHEN 'draft' THEN 'Draft quotation' WHEN 'sent' THEN 'Awaiting customer response' WHEN 'accepted' THEN 'Customer accepted' ELSE 'Insurer approved' END",
    id: 'q.id', ref: 'q.quote_number', title: "COALESCE(pr.name, q.lob, q.product_type, 'Quotation')", client_name: CLIENT('c', 'l'),
    due_date: 'q.valid_until', status: 'q.status',
    next_action: `CASE q.status WHEN 'draft' THEN 'Complete and send to the customer' WHEN 'sent' THEN 'Follow up the customer''s response'
      WHEN 'accepted' THEN 'Submit to the insurer' ELSE 'Issue the policy' END`,
    owner_id: 'COALESCE(q.agent_user_id, q.created_by)', link: "'/agent/quotedetailview/' || q.id", amount: 'q.premium_total', created_at: 'q.created_at',
  })} FROM quotes q LEFT JOIN clients c ON c.id = q.client_id LEFT JOIN leads l ON l.id = q.lead_id LEFT JOIN products pr ON pr.id = q.product_id
  WHERE q.deleted_at IS NULL AND q.status IN ('draft', 'sent', 'accepted', 'approved') AND ${rec(ctx, 'quote', 'q')}`;
}

function rfq(ctx) {
  return `SELECT ${select({
    category: "'rfq'",
    kind: "CASE b.status WHEN 'draft' THEN 'Draft request' WHEN 'submitted' THEN 'Awaiting insurer offers' ELSE 'Offers received' END",
    id: 'b.id', ref: 'b.slip_number', title: "COALESCE(b.lob, b.product_type, 'Request for quotation')", client_name: CLIENT('c', 'l', 'b.insured_name'),
    due_date: 'COALESCE(b.response_due_date, b.inception_date)', status: 'b.status',
    next_action: `CASE b.status WHEN 'draft' THEN 'Submit to the insurers'
      WHEN 'submitted' THEN 'Chase the insurers (' || o.answered || ' of ' || o.total || ' answered)' ELSE 'Compare the offers and select one' END`,
    owner_id: 'COALESCE(b.owner_user_id, b.created_by)', link: "'/placement/broker-slips/' || b.id", amount: 'b.sum_insured', created_at: 'b.created_at',
  })} FROM broker_slips b LEFT JOIN clients c ON c.id = b.client_id LEFT JOIN leads l ON l.id = b.lead_id
  LEFT JOIN LATERAL (SELECT count(*)::int AS total, count(*) FILTER (WHERE x.status <> 'pending')::int AS answered FROM insurer_offers x WHERE x.broker_slip_id = b.id) o ON true
  WHERE b.status IN ('draft', 'submitted', 'responses-in') AND ${rec(ctx, 'broker_slip', 'b')}`;
}

function placements(ctx) {
  return `SELECT ${select({
    category: "'placements'",
    kind: "CASE pl.status WHEN 'draft' THEN 'Draft placement' WHEN 'sent' THEN 'Awaiting insurer confirmation' WHEN 'bound' THEN 'Bound, policy to issue' ELSE 'Declined by the insurer' END",
    id: 'pl.id', ref: 'pl.placement_number', title: "COALESCE(ic.name, pl.lob, 'Placement slip')", client_name: CLIENT('c', 'l', 'pl.insured_name'),
    due_date: 'pl.inception_date', status: 'pl.status',
    next_action: `CASE pl.status WHEN 'draft' THEN 'Send to the insurers' WHEN 'sent' THEN 'Obtain the insurer''s confirmation'
      WHEN 'bound' THEN 'Issue the policy' ELSE 'Place with another insurer' END`,
    priority: "CASE WHEN pl.status = 'bound' THEN 'high' ELSE 'normal' END",
    owner_id: 'COALESCE(pl.owner_user_id, pl.created_by)', link: "'/placement/placement-slips/' || pl.id", amount: 'pl.premium_total', created_at: 'pl.created_at',
  })} FROM placements pl LEFT JOIN clients c ON c.id = pl.client_id LEFT JOIN leads l ON l.id = pl.lead_id LEFT JOIN insurance_companies ic ON ic.id = pl.insurance_company_id
  WHERE pl.status IN ('draft', 'sent', 'bound', 'declined') AND ${rec(ctx, 'placement', 'pl')}`;
}

const RENEWAL_OPEN = ['pipeline', 'notice-1', 'notice-2', 'final-notice', 'quoted', 'pending-approval', 'approved'];

async function renewals(ctx) {
  const days = (await getSetting('limits.renewal_notice_days', [60, 30, 15])) || [60];
  const window = Math.max(...(Array.isArray(days) ? days : [60]).map(Number).filter((n) => n > 0), 30);
  const open = ctx.P(RENEWAL_OPEN);
  const due = `SELECT ${select({
    category: "'renewals'",
    kind: "CASE WHEN r.status = 'pipeline' THEN 'Renewal due' WHEN r.status LIKE 'notice-%' OR r.status = 'final-notice' THEN 'Renewal notice sent' WHEN r.status = 'quoted' THEN 'Renewal quoted' WHEN r.status = 'pending-approval' THEN 'Renewal awaiting approval' ELSE 'Renewal approved' END",
    id: 'r.id', ref: 'r.renewal_number', title: 'p.policy_number', client_name: CLIENT('c'),
    due_date: 'COALESCE(r.due_date, p.expiry_date)', status: 'r.status', priority: prio('r.priority'),
    next_action: `CASE WHEN r.status = 'pipeline' THEN 'Prepare the renewal terms' WHEN r.status = 'quoted' THEN 'Submit the renewal for approval'
      WHEN r.status = 'pending-approval' THEN 'Awaiting approval' WHEN r.status = 'approved' THEN 'Complete the renewal' ELSE 'Follow up the client' END`,
    owner_id: 'COALESCE(r.owner_user_id, p.owner_user_id)',
    link: "CASE WHEN r.status IN ('quoted', 'pending-approval', 'approved') THEN '/renewal/negotiations' ELSE '/renewal/queue' END",
    amount: 'COALESCE(r.premium_new, r.premium_old)', created_at: 'r.created_at',
  })} FROM renewals r JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = COALESCE(r.client_id, p.client_id)
  WHERE r.status = ANY(${open}::text[]) AND ${rec(ctx, 'renewal', 'r')}`;
  // policies about to expire that are not in the renewal pipeline yet
  const expiring = `SELECT ${select({
    category: "'renewals'", kind: "'Expiring policy'", id: 'p.id', ref: 'p.policy_number', title: "COALESCE(ic.name, p.lob, 'Policy')", client_name: CLIENT('c'),
    due_date: 'p.expiry_date', status: 'p.status', next_action: "'Start the renewal'", owner_id: 'COALESCE(p.owner_user_id, c.owner_user_id)',
    link: "'/agent/policydetail/' || p.id", amount: 'p.premium_total', created_at: 'p.created_at',
  })} FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  WHERE p.status IN ('active', 'issued') AND p.renewed_to IS NULL AND p.expiry_date BETWEEN ${ctx.T}::date AND ${ctx.T}::date + ${ctx.P(window)}::int
    AND NOT EXISTS (SELECT 1 FROM renewals x WHERE x.policy_id = p.id AND x.status = ANY(${open}::text[])) AND ${rec(ctx, 'policy', 'p')}`;
  return `${due} UNION ALL ${expiring}`;
}

function receivables(ctx) {
  return `SELECT ${select({
    category: "'receivables'", kind: `CASE WHEN rv.due_date < ${ctx.T}::date THEN 'Overdue premium' WHEN rv.status = 'partial' THEN 'Part-paid premium' ELSE 'Premium due' END`,
    id: 'rv.id', ref: 'rv.bill_number', title: 'p.policy_number', client_name: CLIENT('c'), due_date: 'rv.due_date', status: 'rv.status',
    next_action: `CASE WHEN rv.due_date < ${ctx.T}::date THEN 'Collect the overdue premium (' || (${ctx.T}::date - rv.due_date) || ' days)' ELSE 'Remind the client before the due date' END`,
    owner_id: 'COALESCE(p.owner_user_id, c.owner_user_id)', link: "'/agent/payments/detail/' || rv.id", amount: 'rv.balance', created_at: 'rv.created_at',
  })} FROM receivables rv JOIN policies p ON p.id = rv.policy_id LEFT JOIN clients c ON c.id = COALESCE(rv.client_id, p.client_id)
  WHERE rv.status IN ('open', 'partial') AND rv.balance > 0 AND ${rec(ctx, 'policy', 'p')}`;
}

function collections(ctx) {
  const queue = ctx.can('write:collections') ? 'ci.assigned_to IS NULL' : 'false';
  return `SELECT ${select({
    category: "'collections'",
    kind: `CASE WHEN ci.escalated_at IS NOT NULL THEN 'Escalated' WHEN ci.commitment_date IS NOT NULL THEN 'Promise to pay' ELSE 'Overdue premium' END`,
    id: 'ci.id', ref: 'rv.bill_number', title: 'p.policy_number', client_name: CLIENT('c'), due_date: 'COALESCE(ci.commitment_date, rv.due_date)', status: 'rv.status',
    priority: `CASE WHEN ci.escalated_at IS NOT NULL THEN 'urgent' WHEN ${ctx.T}::date - rv.due_date > 60 THEN 'high' ELSE 'normal' END`,
    next_action: `CASE WHEN ci.commitment_date IS NOT NULL THEN 'Confirm the payment promised for ' || to_char(ci.commitment_date, 'DD Mon YYYY')
      ELSE 'Follow up the overdue premium (' || GREATEST(${ctx.T}::date - rv.due_date, 0) || ' days)' END`,
    owner_id: userOf('ci.assigned_to'), queue, link: "'/agent/collections/' || ci.id", amount: 'rv.balance', created_at: 'ci.created_at',
  })} FROM collection_items ci JOIN receivables rv ON rv.id = ci.receivable_id LEFT JOIN policies p ON p.id = rv.policy_id
  LEFT JOIN clients c ON c.id = COALESCE(rv.client_id, ci.client_id)
  WHERE ci.closed_at IS NULL AND rv.status IN ('open', 'partial') AND rv.balance > 0
    AND (ci.assigned_to IS NOT NULL OR ci.commitment_date IS NOT NULL OR rv.due_date < ${ctx.T}::date)
    -- a promise to pay already followed up by a task of the collector who recorded it is listed through that task
    AND NOT EXISTS (SELECT 1 FROM work_tasks wt WHERE wt.source = 'collection' AND wt.entity_id = ci.id AND wt.status = 'open')
    AND (p.id IS NULL OR ${rec(ctx, 'policy', 'p')})`;
}

function endorsements(ctx) {
  return `SELECT ${select({
    category: "'endorsements'",
    kind: "CASE e.status WHEN 'draft' THEN 'Draft endorsement' WHEN 'submitted' THEN 'Sent, awaiting confirmation' WHEN 'cancel-initiated' THEN 'Cancellation in progress' ELSE 'Approved, to complete' END",
    id: 'e.id', ref: 'e.endorsement_number', title: "p.policy_number || COALESCE(' - ' || e.endorsement_type, '')", client_name: CLIENT('c'),
    due_date: 'e.effective_date', status: 'e.status',
    next_action: `CASE e.status WHEN 'draft' THEN 'Complete and send the endorsement' WHEN 'submitted' THEN 'Obtain the customer''s and insurer''s confirmation'
      WHEN 'cancel-initiated' THEN 'Complete the cancellation' ELSE 'Complete the endorsement' END`,
    owner_id: `COALESCE(${userOf('e.created_by')}, p.owner_user_id)`, link: "'/agent/endorsementdetailedview/' || e.id", amount: 'e.premium_delta', created_at: 'e.created_at',
  })} FROM endorsements e JOIN policies p ON p.id = e.policy_id LEFT JOIN clients c ON c.id = COALESCE(e.client_id, p.client_id)
  WHERE e.status IN ('draft', 'submitted', 'cancel-initiated', 'approved') AND ${rec(ctx, 'endorsement', 'e')}`;
}

function claims(ctx) {
  const queue = ctx.can('write:claims') ? 'cl.handler_user_id IS NULL' : 'false';
  return `SELECT ${select({
    category: "'claims'",
    kind: "CASE cl.status WHEN 'registered' THEN 'New claim' WHEN 'in-review' THEN 'In review' WHEN 'approved' THEN 'Approved, to settle' ELSE 'Settlement awaiting approval' END",
    id: 'cl.id', ref: 'cl.claim_number', title: "COALESCE(p.policy_number, '') || COALESCE(' - ' || cl.loss_type, '')", client_name: CLIENT('c'),
    due_date: 'cl.due_date', status: 'cl.status', priority: prio('cl.priority'),
    next_action: `CASE cl.status WHEN 'registered' THEN 'Review the claim and notify the insurer' WHEN 'in-review' THEN 'Follow up the insurer and adjuster'
      WHEN 'approved' THEN 'Record the settlement' ELSE 'Awaiting settlement approval' END`,
    owner_id: 'cl.handler_user_id', queue, link: "'/agent/claimdetail/' || cl.id", amount: 'COALESCE(cl.approved_amount, cl.estimate_amount)', created_at: 'cl.created_at',
    reassign: "CASE WHEN cl.status IN ('registered', 'in-review') THEN 'claim' END",
  })} FROM claims cl LEFT JOIN policies p ON p.id = cl.policy_id LEFT JOIN clients c ON c.id = COALESCE(cl.client_id, p.client_id)
  WHERE cl.status IN ('registered', 'in-review', 'approved', 'pending-approval') AND ${rec(ctx, 'claim', 'cl')}`;
}

/** Approval queues (maker-checker) the user can decide, plus the data subject requests assigned to them. */
async function approvals(ctx) {
  const out = [];
  const due = (ts) => `${localDate(ctx, ts)} + ${ctx.P(ctx.slaDays)}::int`;
  const base = { category: "'approvals'", queue: 'true', next_action: "'Approve or reject'" };
  const has = async (table) => (await ctx.db.query('SELECT to_regclass($1) IS NOT NULL AS ok', [table])).rows[0].ok;
  if (ctx.can('write:journal-vouchers') && await has('journal_vouchers')) {
    out.push(`SELECT ${select({ ...base, kind: "'Journal voucher'", id: 'j.id', ref: 'j.jv_number', title: "COALESCE(j.description, 'Journal voucher')", due_date: due('j.created_at'),
      status: 'j.status', link: "'/accounts/journalvoucher/detailsjournalvocture/' || j.id", amount: 'j.total_debit', created_at: 'j.created_at' })}
      FROM journal_vouchers j WHERE j.status = 'for-approval' AND ${notMine(ctx, 'j.created_by')} AND ${await withinAuthority(ctx, 'journal_voucher', 'j.total_debit')}`);
  }
  if (ctx.can('write:disbursements')) {
    const limit = await withinAuthority(ctx, 'payment_voucher', 'd.amount');
    out.push(`SELECT ${select({ ...base, kind: "'Payment voucher'", id: 'd.id', ref: 'd.voucher_number', title: "COALESCE(d.payee_name, d.purpose, 'Payment voucher')", due_date: due('d.created_at'),
      status: 'd.status', link: "'/accounts/paymentvoucher/detailview/' || d.id", amount: 'd.amount', created_at: 'd.created_at' })}
      FROM disbursements d WHERE d.status = 'for-approval' AND ${notMine(ctx, 'd.created_by')} AND ${limit}`);
    out.push(`SELECT ${select({ ...base, kind: "'Cheque release'", id: 'k.id', ref: "COALESCE(k.instrument_no, d.voucher_number)", title: "COALESCE(k.customer_name, 'Cheque')", due_date: due('k.created_at'),
      status: 'k.status', link: "CASE WHEN k.disbursement_id IS NULL THEN '/accounts/paymentvoucher' ELSE '/accounts/paymentvoucher/detailview/' || k.disbursement_id END",
      amount: 'k.totale_amount', created_at: 'k.created_at' })}
      FROM checkbooks k LEFT JOIN disbursements d ON d.id = k.disbursement_id WHERE k.status = 'Pending' AND ${notMine(ctx, 'k.created_by')}
        AND ${await withinAuthority(ctx, 'payment_voucher', 'k.totale_amount')}`);
    if (await has('petty_cash_requests')) {
      out.push(`SELECT ${select({ ...base, kind: "'Petty cash request'", id: 'pc.id', ref: 'pc.request_number', title: "COALESCE(pc.purpose, pc.requester_name, 'Petty cash')", due_date: due('pc.created_at'),
        status: 'pc.status', link: "'/accounts/pettycash/editrequestform/view/' || pc.id", amount: 'pc.total_amount', created_at: 'pc.created_at' })}
        FROM petty_cash_requests pc WHERE pc.status = 'submitted' AND ${notMine(ctx, 'pc.created_by')}`);
    }
  }
  if (ctx.can('write:remittance')) {
    const remit = await withinAuthority(ctx, 'remittance', 'a.amount');
    const settle = await withinAuthority(ctx, 'remittance_settlement', 'a.amount');
    out.push(`SELECT ${select({ ...base, kind: "COALESCE(a.transaction_type, 'Remittance')", id: 'a.id', ref: 'a.reference_no', title: "COALESCE(a.description, a.transaction_type, 'Remittance')",
      due_date: `${localDate(ctx, "a.created_at + make_interval(hours => COALESCE(a.sla_hours, 48))")}`, status: 'a.status', priority: prio('a.priority'),
      owner_id: 'a.delegated_to', queue: 'a.delegated_to IS NULL', link: "'/finance/remittance/approval'", amount: 'a.amount', created_at: 'a.created_at' })}
      FROM remittance_approvals a WHERE a.status = 'Pending' AND ${notMine(ctx, 'a.initiator_id')}
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(a.history, '[]'::jsonb)) h WHERE h->>'action' = 'Approved' AND h->>'by' = ANY(${ctx.ME}::text[]))
        AND (CASE WHEN a.entity = 'remittance' THEN ${remit} ELSE ${settle} END)`);
    if (await has('commission_debit_notes')) {
      out.push(`SELECT ${select({ ...base, kind: "'Commission debit note'", id: 'dn.id', ref: 'dn.dn_number', title: "COALESCE(ic.name, 'Commission debit note')", due_date: due('COALESCE(dn.submitted_at, dn.created_at)'),
        status: 'dn.status', link: "'/finance/remittance/directbill'", amount: 'dn.amount', created_at: 'dn.created_at' })}
        FROM commission_debit_notes dn LEFT JOIN insurance_companies ic ON ic.id = dn.insurance_company_id
        WHERE dn.status = 'for-approval' AND ${notMine(ctx, 'COALESCE(dn.submitted_by, dn.created_by)')}`);
    }
  }
  if (ctx.can('approve:access-control') && await has('authority_limits')) {
    out.push(`SELECT ${select({ ...base, kind: "'Authority limit'", id: 'al.id', ref: "'AL-' || al.id", title: "COALESCE(t.name, al.transaction_type) || ' - ' || COALESCE(al.role_code, u.display_name, '')",
      due_date: due('al.requested_at'), status: 'al.status', link: "'/master/generals/usermanagement/authority-matrix'", amount: 'al.max_amount', created_at: 'al.requested_at' })}
      FROM authority_limits al LEFT JOIN authority_transaction_types t ON t.code = al.transaction_type LEFT JOIN users u ON u.id = al.user_id
      WHERE al.status = 'pending' AND ${notMine(ctx, 'al.requested_by')}`);
  }
  if (ctx.can('approve:posting-rules') && await has('accounting_config_changes')) {
    out.push(`SELECT ${select({ ...base, kind: "'Configuration change'", id: 'cc.id', ref: "'CFG-' || cc.id", title: "initcap(replace(cc.kind, '_', ' ')) || COALESCE(' - ' || cc.target, '')",
      due_date: due('cc.requested_at'), status: 'cc.status', link: "'/master/finance/configuration-approvals'", created_at: 'cc.requested_at' })}
      FROM accounting_config_changes cc WHERE cc.status = 'pending' AND ${notMine(ctx, 'cc.requested_by')}`);
  }
  if (ctx.can('approve:period-end') && await has('period_close_runs')) {
    out.push(`SELECT ${select({ ...base, kind: "'Month-end close'", id: 'pr.id', ref: 'pr.run_number', title: "'Close of period ' || pr.period", due_date: due('COALESCE(pr.submitted_at, pr.created_at)'),
      status: 'pr.status', link: "'/accounts/period-end/close/' || pr.id", created_at: 'pr.created_at' })}
      FROM period_close_runs pr WHERE pr.status = 'pending-approval' AND ${notMine(ctx, 'pr.submitted_by')}`);
  }
  if (ctx.can('approve:bank-reconciliation') && await has('bank_reconciliations')) {
    out.push(`SELECT ${select({ ...base, kind: "'Bank reconciliation'", id: 'br.id', ref: 'br.rec_number', title: "br.bank_account_code || ' - ' || br.period", due_date: due('COALESCE(br.prepared_at, br.created_at)'),
      status: 'br.status', link: "'/accounts/bank-reconciliation/reconciliations/' || br.id", amount: 'br.bank_balance', created_at: 'br.created_at' })}
      FROM bank_reconciliations br WHERE br.status = 'prepared' AND ${notMine(ctx, 'br.prepared_by')}`);
  }
  if (ctx.can('approve:insurer-reconciliation') && await has('insurer_statements')) {
    out.push(`SELECT ${select({ ...base, kind: "'Insurer statement'", id: 'st.id', ref: 'st.statement_number', title: "COALESCE(ic.name, 'Insurer statement')", due_date: due('COALESCE(st.submitted_at, st.created_at)'),
      status: 'st.status', link: "'/accounts/insurer-reconciliation/statements/' || st.id", amount: 'st.total_paid', created_at: 'st.created_at' })}
      FROM insurer_statements st LEFT JOIN insurance_companies ic ON ic.id = st.insurance_company_id WHERE st.status = 'submitted' AND ${notMine(ctx, 'st.submitted_by')}`);
  }
  if (ctx.can('approve:credit-control') && await has('premium_warranty_extensions')) {
    out.push(`SELECT ${select({ ...base, kind: "'Warranty extension'", id: 'wx.id', ref: 'p.policy_number', title: "'Extend to ' || to_char(wx.requested_deadline, 'DD Mon YYYY')", client_name: CLIENT('c'),
      due_date: 'LEAST(wx.current_deadline, ' + due('wx.requested_at') + ')', status: 'wx.status', link: "'/accounts/credit-control/warranty'", created_at: 'wx.requested_at' })}
      FROM premium_warranty_extensions wx JOIN policies p ON p.id = wx.policy_id LEFT JOIN clients c ON c.id = p.client_id
      WHERE wx.status = 'pending' AND ${notMine(ctx, 'wx.requested_by')}`);
  }
  if (ctx.can('write:incentive') && await has('incentive_calculations')) {
    out.push(`SELECT ${select({ ...base, kind: "'Incentive calculation'", id: 'ic.batch_id', ref: 'ic.batch_id', title: "'Incentives of ' || ic.period", due_date: due('COALESCE(ic.submitted_date, ic.created_at)'),
      status: 'ic.status', link: "'/incentive/approvals'", amount: 'ic.total_amount', created_at: 'ic.created_at' })}
      FROM incentive_calculations ic WHERE ic.status = 'Pending Approval' AND ${notMine(ctx, 'ic.submitted_by')}`);
  }
  if (ctx.can('write:reinsurance') && await has('reinsurance_treaties')) {
    out.push(`SELECT ${select({ ...base, kind: "'Reinsurance treaty'", id: 'rt.id::text', ref: 'COALESCE(rt.treaty_number, rt.name)', title: 'rt.name', due_date: due('COALESCE(rt.updated_at, rt.created_at)'),
      status: 'rt.status', link: "'/reinsurance/treaty/' || rt.id", created_at: 'rt.created_at' })}
      FROM reinsurance_treaties rt WHERE rt.status = 'Pending Approval' AND ${notMine(ctx, 'rt.submitted_by')}`);
  }
  // claim settlements: decided by the Claims role (claims/service.js), never by the officer who requested them
  if (ctx.can('write:claims') && (ctx.roles.includes('claims') || isAdmin(ctx.user))) {
    out.push(`SELECT ${select({ ...base, kind: "'Claim settlement'", id: 'cs.id', ref: 'cs.claim_number', title: "COALESCE(p.policy_number, 'Claim')", client_name: CLIENT('c'),
      due_date: due('cs.updated_at'), status: 'cs.status', priority: prio('cs.priority'), link: "'/agent/claimrequest/settlementapproval/' || cs.id",
      amount: "COALESCE(NULLIF(cs.settlement->>'settlementAmount', '')::numeric, cs.approved_amount, cs.estimate_amount)", created_at: 'cs.created_at' })}
      FROM claims cs LEFT JOIN policies p ON p.id = cs.policy_id LEFT JOIN clients c ON c.id = COALESCE(cs.client_id, p.client_id)
      WHERE cs.status = 'pending-approval' AND ${notMine(ctx, 'cs.settlement_requested_by')} AND ${rec(ctx, 'claim', 'cs')}`);
  }
  // renewal premiums: decided by the roles of renewals.approver_roles (renewals/service.js)
  const renewalApprovers = (await getSetting('renewals.approver_roles', ['processing'])) || [];
  if (ctx.can('write:renewals') && (isAdmin(ctx.user) || ctx.roles.some((r) => renewalApprovers.includes(r)))) {
    out.push(`SELECT ${select({ ...base, kind: "'Renewal premium'", id: 'ra.id', ref: 'ra.renewal_number', title: 'p.policy_number', client_name: CLIENT('c'),
      due_date: `LEAST(COALESCE(ra.due_date, p.expiry_date), ${due('COALESCE(ra.submitted_at, ra.updated_at)')})`, status: 'ra.status', priority: prio('ra.priority'),
      link: "'/renewal/negotiations'", amount: 'ra.premium_new', created_at: 'ra.created_at' })}
      FROM renewals ra JOIN policies p ON p.id = ra.policy_id LEFT JOIN clients c ON c.id = COALESCE(ra.client_id, p.client_id)
      WHERE ra.status = 'pending-approval' AND ${notMine(ctx, 'ra.submitted_by')} AND ${rec(ctx, 'renewal', 'ra')}`);
  }
  // premium payments captured on a policy wait for Accounting's verification (policies/router.js)
  if (ctx.can('write:receipts') && (ctx.roles.includes('accounting') || isAdmin(ctx.user)) && await has('policy_payments')) {
    out.push(`SELECT ${select({ ...base, kind: "'Premium payment to verify'", id: 'pp.id', ref: "COALESCE(pp.reference_no, p.policy_number)", title: 'p.policy_number', client_name: CLIENT('c'),
      due_date: due('pp.created_at'), status: 'pp.status', next_action: "'Verify the payment and issue the receipt'", link: "'/agent/policy/paymentoptions/' || pp.policy_id",
      amount: 'pp.amount', created_at: 'pp.created_at' })}
      FROM policy_payments pp JOIN policies p ON p.id = pp.policy_id LEFT JOIN clients c ON c.id = p.client_id
      WHERE pp.status = 'submitted' AND ${notMine(ctx, 'pp.submitted_by')}`);
  }
  // data subject requests (Data Privacy Act): the assignee's, or the privacy team's queue while unassigned
  if ((ctx.can('read:privacy') || ctx.can('write:privacy')) && await has('data_subject_requests')) {
    out.push(`SELECT ${select({ ...base, kind: "'Data subject request'", id: 'ds.id', ref: 'ds.request_number', title: "initcap(ds.request_type) || ' request'", client_name: 'ds.requester_name',
      due_date: 'ds.due_on', status: 'ds.status', next_action: "CASE WHEN ds.assigned_to IS NULL THEN 'Assign and verify the identity' ELSE 'Respond to the data subject' END",
      owner_id: 'ds.assigned_to', queue: ctx.can('write:privacy') ? 'ds.assigned_to IS NULL' : 'false', link: "'/master/data-privacy/requests'", created_at: 'ds.created_at',
      reassign: "'privacy'" })}
      FROM data_subject_requests ds WHERE ds.status IN ('open', 'in-progress')`);
  }
  return out.length ? out.join(' UNION ALL ') : null;
}

/** Active policies whose customer ID (KYC) required for their line of business is not on file. */
async function documents(ctx) {
  const cfg = (await getSetting('policy.kyc_required_fields', KYC_DEFAULT_REQUIRED)) || KYC_DEFAULT_REQUIRED;
  const ID = ['idType', 'idNumber', 'idImage'];
  const lobs = Object.entries(cfg).filter(([k, v]) => k !== '*' && Array.isArray(v) && v.some((i) => ID.includes(i)));
  if (!lobs.length) return null;
  const value = (item) => {
    const keys = KYC_ITEMS[item].keys;
    const parts = ['p.details', 'p.doc', 'q.doc', 'q.vehicle'].flatMap((src) => keys.map((k) => `NULLIF(NULLIF(trim(${src}->>'${k}'), ''), 'N/A')`));
    return `COALESCE(${parts.join(', ')})`;
  };
  const cases = lobs.map(([lob, items]) => {
    const missing = ID.filter((i) => items.includes(i)).map((i) => `CASE WHEN ${value(i)} IS NULL THEN '${KYC_ITEMS[i].label}' END`);
    return `WHEN ${ctx.P(lob.toUpperCase())} THEN concat_ws(', ', ${missing.join(', ')})`;
  });
  return `SELECT ${select({
    category: "'documents'", kind: "'Customer ID (KYC)'", id: 'x.id', ref: 'x.policy_number', title: "COALESCE(x.product, x.lob, 'Policy')", client_name: 'x.client_name',
    status: 'x.status', next_action: "'Obtain the customer''s ID: ' || x.missing", owner_id: 'x.owner_id', link: "'/agent/policydetail/' || x.id", amount: 'x.premium_total', created_at: 'x.created_at',
  })} FROM (SELECT p.id, p.policy_number, p.lob, p.status, p.premium_total, p.created_at, pr.name AS product, COALESCE(c.display_name, p.insured_name) AS client_name,
      COALESCE(p.owner_user_id, c.owner_user_id) AS owner_id, CASE upper(COALESCE(p.lob, '')) ${cases.join(' ')} ELSE '' END AS missing
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN quotes q ON q.id = p.quote_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE p.status IN ('active', 'issued') AND ${rec(ctx, 'policy', 'p')}) x WHERE x.missing <> ''`;
}

/** Client and number of the record a task is about (tasks/RELATED), for the Client column of the list. */
const TASK_RECORD = {
  client: ['(SELECT x.display_name FROM clients x WHERE x.id = t.entity_id)', '(SELECT x.client_code FROM clients x WHERE x.id = t.entity_id)'],
  lead: ['(SELECT x.display_name FROM leads x WHERE x.id = t.entity_id)', '(SELECT x.lead_number FROM leads x WHERE x.id = t.entity_id)'],
  policy: ['(SELECT COALESCE(c.display_name, x.insured_name) FROM policies x LEFT JOIN clients c ON c.id = x.client_id WHERE x.id = t.entity_id)',
    '(SELECT x.policy_number FROM policies x WHERE x.id = t.entity_id)'],
  quote: ['(SELECT COALESCE(c.display_name, l.display_name) FROM quotes x LEFT JOIN clients c ON c.id = x.client_id LEFT JOIN leads l ON l.id = x.lead_id WHERE x.id = t.entity_id)',
    '(SELECT x.quote_number FROM quotes x WHERE x.id = t.entity_id)'],
  claim: ['(SELECT c.display_name FROM claims x LEFT JOIN clients c ON c.id = x.client_id WHERE x.id = t.entity_id)', '(SELECT x.claim_number FROM claims x WHERE x.id = t.entity_id)'],
  renewal: ['(SELECT c.display_name FROM renewals x JOIN policies p ON p.id = x.policy_id LEFT JOIN clients c ON c.id = COALESCE(x.client_id, p.client_id) WHERE x.id = t.entity_id)',
    '(SELECT x.renewal_number FROM renewals x WHERE x.id = t.entity_id)'],
  collection: ['(SELECT c.display_name FROM collection_items x LEFT JOIN clients c ON c.id = x.client_id WHERE x.id = t.entity_id)',
    '(SELECT r.bill_number FROM collection_items x JOIN receivables r ON r.id = x.receivable_id WHERE x.id = t.entity_id)'],
};
const taskRecord = (i) => `CASE t.entity ${Object.entries(TASK_RECORD).map(([k, v]) => `WHEN '${k}' THEN ${v[i]}`).join(' ')} END`;

function tasks() {
  return `SELECT ${select({
    category: "'tasks'", kind: "CASE t.source WHEN 'manual' THEN 'Own task' WHEN 'manager' THEN 'Assigned task' ELSE 'Follow-up' END",
    id: 't.id', ref: 'NULL', title: taskRecord(1), client_name: taskRecord(0), due_date: 't.due_date', status: 't.status', priority: 't.priority', next_action: 't.title',
    owner_id: 't.assigned_to', link: "'/operations/my-work?tab=tasks&task=' || t.id", created_at: 't.created_at', reassign: "'task'",
  })} FROM work_tasks t WHERE t.status = 'open'`;
}

const BUILDERS = { quotes, rfq, placements, renewals, receivables, collections, endorsements, claims, approvals, documents, tasks };

/** The categories the user may see (approvals and tasks: everyone; the rest by permission). */
export const visibleCategories = (user) => CATEGORIES.filter((c) => !c.permission || hasPermission(user, c.permission));

/** UNION ALL of the sources of the given categories (null when none applies). */
export async function unionSql(ctx, categories) {
  const parts = [];
  for (const code of categories) {
    const sql = await BUILDERS[code](ctx);
    if (sql) parts.push(sql);
  }
  return parts.length ? parts.map((p) => `(${p})`).join(' UNION ALL ') : null;
}
