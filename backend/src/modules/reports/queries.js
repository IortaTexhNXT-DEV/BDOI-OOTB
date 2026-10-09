/**
 * Report queries, keyed by report_definitions.query_name.
 *
 * Every base query receives $1 = from date and $2 = to date; `extras` (read from app_settings) follow as $3, $4 ...
 * Columns prefixed with "_" are internal (used for filtering) and never returned. The service wraps the base query:
 *   SELECT * FROM (<sql>) t WHERE <filters> [GROUP BY <dims>]   -- then pages, totals and groups over it.
 * Supported filter keys: agent, insurer, branch, client, product, status, account, bankAccount (FILTERS in engine.js).
 * criteria: allowed values of the screen's "Report Criteria" drop-down. { where } restricts rows, { groupBy } adds a
 * summary by that column, { dims } chooses the aggregation dimensions of aggregate reports.
 */
import { PERIOD_END_QUERIES } from './periodEndQueries.js';
import { BANK_REC_QUERIES } from './bankRecQueries.js';
import { CHANNEL_QUERIES } from './channelQueries.js';

/** An extra positional parameter read from app_settings; `type` is its SQL type (every parameter is cast once so
 *  that parameters unused by a variant of the query still have a known type). */
const setting = (key, fallback, type) => ({ key, fallback, type });
/** An extra positional parameter holding today's business date (general.timezone), used instead of the database current_date. */
const businessToday = { today: true, type: 'date' };

// Standard dimension columns: agent (policy owner), insurer, branch (agent's branch), client, product
const POLICY_JOINS = `LEFT JOIN clients c ON c.id = p.client_id
  LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN users u ON u.id = p.owner_user_id
  LEFT JOIN branches b ON b.code = u.branch_code`;
const POLICY_DIMS = `u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
  ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer,
  u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
  c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client,
  pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product`;
// "Prepared by" dimensions for finance documents that are not tied to a policy owner
const creatorJoin = (col) => `LEFT JOIN LATERAL (SELECT id, username, display_name, branch_code FROM users WHERE id = ${col} OR username = ${col} ORDER BY (id = ${col}) DESC LIMIT 1) u ON true
  LEFT JOIN branches b ON b.code = u.branch_code`;
const CREATOR_DIMS = `u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
  u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch`;

/** Billing mode label: broker billed (client pays the broker) or direct bill (client pays the insurer; commission billed by debit note). */
const BILLING_MODE = "CASE p.billing_mode WHEN 'direct' THEN 'Direct bill' ELSE 'Broker billed' END";

const STANDARD_CRITERIA = { Overall: {}, Agent: { groupBy: 'agent' }, 'Principal Insurer': { groupBy: 'insurer' }, Branch: { groupBy: 'branch' } };
const POLICY_FILTERS = ['agent', 'insurer', 'branch', 'client', 'product', 'status'];

const production = `SELECT p.id AS _id, p.policy_number AS "policyNumber", COALESCE(p.issued_date, p.created_at::date) AS "issueDate",
    p.inception_date AS "inceptionDate", p.expiry_date AS "expiryDate", to_char(p.inception_date, 'YYYY-MM') AS month,
    CASE WHEN p.renewed_from IS NULL THEN 'New Business' ELSE 'Renewal' END AS "businessType",
    ${POLICY_DIMS}, p.sum_insured AS "sumInsured", p.premium_total AS premium, p.commission_amount AS commission,
    ${BILLING_MODE} AS "billingMode", p.currency, p.status,
    -- policies of the old system loaded by the go-live migration, kept apart from business written in BrokerVerse
    CASE WHEN p.doc->>'source' = 'go-live-migration' OR p.load_batch_id IS NOT NULL THEN 'Migrated' ELSE 'BrokerVerse' END AS "source"
  FROM policies p ${POLICY_JOINS}
  WHERE p.inception_date BETWEEN $1 AND $2`;

const claims = `SELECT cl.claim_number AS "claimNumber", p.policy_number AS "policyNumber", ${POLICY_DIMS},
    cl.loss_date AS "lossDate", cl.reported_date AS "reportedDate", cl.loss_type AS "lossType", cl.status,
    cl.estimate_amount AS "estimateAmount", cl.approved_amount AS "approvedAmount", cl.settled_amount AS "settledAmount",
    (COALESCE(cl.settled_at::date, $7::date) - cl.reported_date) AS "ageDays",
    rpt_age_bucket(COALESCE(cl.settled_at::date, $7::date) - cl.reported_date, $3::int[]) AS "ageBucket"
  FROM claims cl JOIN policies p ON p.id = cl.policy_id ${POLICY_JOINS}
  WHERE cl.reported_date BETWEEN $1 AND $2`;
const claimExtras = [setting('reports.claim_ageing_buckets', [30, 60, 90, 180], 'int[]'),
  setting('reports.claim_open_statuses', ['registered', 'in-review', 'approved'], 'text[]'),
  setting('reports.claim_settled_statuses', ['settled', 'closed'], 'text[]'),
  setting('reports.claim_rejected_statuses', ['rejected'], 'text[]'), businessToday];

// the date of a bill is the date of its booking journal (the issue / endorsement date), else the day it was entered
const BILL_DATE = '(SELECT bj.jv_date FROM journal_vouchers bj WHERE bj.id = rv.booking_jv_id)';
const receivables = `SELECT rv.bill_number AS "billNumber", COALESCE(${BILL_DATE}, rv.created_at::date) AS "billDate", rv.due_date AS "dueDate",
    p.policy_number AS "policyNumber", ${POLICY_DIMS},
    rv.amount, (rv.amount - rv.balance) AS paid, rv.balance, rv.status,
    ($2::date - rv.due_date) AS "ageDays", rpt_age_bucket($2::date - rv.due_date, $3::int[]) AS "ageBucket"
  FROM receivables rv LEFT JOIN policies p ON p.id = rv.policy_id
  LEFT JOIN clients c ON c.id = COALESCE(rv.client_id, p.client_id)
  LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN users u ON u.id = p.owner_user_id
  LEFT JOIN branches b ON b.code = u.branch_code`;
const receivableBuckets = setting('limits.receivable_ageing_buckets', [30, 60, 90, 120], 'int[]');

// trial balance dimensions: statement order (type, then account code) with the statement group
const TB_DIMS = ['accountType', 'fsGroup', 'accountCode', 'accountName'];
const ACCOUNT_TYPES = "'asset', 'liability', 'equity', 'income', 'expense'";

// Direct bill: commission receivable from insurers per item (policy / endorsement), billed on a debit note or not yet;
// the item's share of the note balance is outstanding. Aged from the note due date (unbilled: from the booking date).
const directBill = `SELECT p.policy_number AS "policyNumber", CASE WHEN it.source = 'endorsement' THEN COALESCE(e.endorsement_number, it.reference) ELSE 'New business' END AS reference, ${POLICY_DIMS}, it.booked_on AS "bookedOn",
    it.booked_on >= $1::date AS "_inPeriod", d.dn_number AS "debitNoteNo", d.dn_date AS "debitNoteDate", d.due_date AS "dueDate",
    it.gross_premium AS "grossPremium", it.commission, it.vat, it.amount AS "totalDue",
    CASE WHEN d.id IS NULL OR d.status IN ('draft', 'for-approval') THEN it.amount WHEN d.amount = 0 THEN 0
      ELSE round(it.amount * d.balance / d.amount, 2)
        -- the last line of a note takes the rounding difference so the lines add up to the note balance
        + CASE WHEN row_number() OVER (PARTITION BY d.id ORDER BY it.id DESC) = 1
            THEN d.balance - sum(round(it.amount * d.balance / NULLIF(d.amount, 0), 2)) OVER (PARTITION BY d.id) ELSE 0 END END AS balance,
    CASE WHEN d.id IS NULL THEN 'Unbilled' WHEN d.status IN ('draft', 'for-approval') THEN 'Debit note pending approval' WHEN d.status = 'open' THEN 'Billed'
      WHEN d.status = 'partial' THEN 'Partially collected' ELSE 'Collected' END AS status,
    -- days past the debit note's due date (unbilled: since booking); not yet due is 0
    GREATEST($2::date - COALESCE(d.due_date, it.booked_on), 0) AS "ageDays",
    rpt_age_bucket(GREATEST($2::date - COALESCE(d.due_date, it.booked_on), 0), $3::int[]) AS "ageBucket"
  FROM direct_bill_items it JOIN policies p ON p.id = it.policy_id ${POLICY_JOINS}
  LEFT JOIN commission_debit_notes d ON d.id = it.debit_note_id LEFT JOIN endorsements e ON e.id = it.endorsement_id
  WHERE it.status <> 'cancelled' AND it.booked_on <= $2`;

// voucher payee types are stored as picked on screen (Insurer, Agent/Referrer, Customer / Client)
const AGENT = "lower(d.payee_type) IN ('agent', 'agent/referrer', 'referrer')";
// Placement pipeline: broker slips and placement slips created in the period with status and age (days since created,
// frozen when closed / issued). Agent = the slip owner; insurer = the lead insurer of a placement slip.
const SLIP_OWNER_DIMS = `u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
  u.branch_code AS _branch_code, COALESCE(br.name, u.branch_code) AS branch,
  c.id AS _client_id, c.client_code AS _client_code, COALESCE(c.display_name, x.insured_name) AS client,
  pr.id::text AS _product_id, pr.code AS _product_code, COALESCE(pr.name, x.product_type) AS product`;
const placementPipeline = `SELECT 'Broker Slip' AS "slipType", x.slip_number AS "slipNumber", x.created_at::date AS "createdDate", x.status, x.lob,
    ${SLIP_OWNER_DIMS}, NULL::text AS _insurer_id, NULL::text AS _insurer_code, NULL::text AS insurer,
    x.sum_insured AS "sumInsured", (SELECT min(o.premium_total) FROM insurer_offers o WHERE o.broker_slip_id = x.id AND o.status = 'offered') AS premium,
    (SELECT count(*)::int FROM insurer_offers o WHERE o.broker_slip_id = x.id) AS insurers,
    (CASE WHEN x.status IN ('closed', 'cancelled') THEN x.updated_at::date ELSE $2::date END - x.created_at::date) AS "ageDays",
    rpt_age_bucket(CASE WHEN x.status IN ('closed', 'cancelled') THEN x.updated_at::date ELSE $2::date END - x.created_at::date, $3::int[]) AS "ageBucket"
  FROM broker_slips x LEFT JOIN clients c ON c.id = x.client_id LEFT JOIN products pr ON pr.id = x.product_id
  LEFT JOIN users u ON u.id = x.owner_user_id LEFT JOIN branches br ON br.code = u.branch_code
  WHERE x.created_at::date BETWEEN $1 AND $2
  UNION ALL
  SELECT 'Placement Slip', x.placement_number, x.created_at::date, x.status, x.lob, ${SLIP_OWNER_DIMS},
    ic.id::text, ic.code, ic.name, x.sum_insured, x.premium_total,
    (SELECT count(*)::int FROM risk_participants rp WHERE rp.entity_type = 'placement' AND rp.entity_id = x.id),
    (CASE WHEN x.status IN ('issued', 'cancelled') THEN COALESCE(x.issued_at, x.updated_at)::date ELSE $2::date END - x.created_at::date),
    rpt_age_bucket(CASE WHEN x.status IN ('issued', 'cancelled') THEN COALESCE(x.issued_at, x.updated_at)::date ELSE $2::date END - x.created_at::date, $3::int[])
  FROM placements x LEFT JOIN clients c ON c.id = x.client_id LEFT JOIN products pr ON pr.id = x.product_id
  LEFT JOIN insurance_companies ic ON ic.id = x.insurance_company_id
  LEFT JOIN users u ON u.id = x.owner_user_id LEFT JOIN branches br ON br.code = u.branch_code
  WHERE x.created_at::date BETWEEN $1 AND $2`;

// Market response: every insurer approached on a broker slip created in the period, with its answer and whether its
// offer was taken (selected for the Quotation / Placement Slip).
const marketResponse = `SELECT ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer, b.slip_number AS "slipNumber", b.created_at::date AS "slipDate",
    b.lob, o.status, o.selected, o.premium_total AS "premiumTotal", o.offered_share AS "offeredShare",
    CASE WHEN o.responded_at IS NOT NULL THEN (o.responded_at::date - COALESCE(o.requested_at, b.created_at)::date) END AS "responseDays",
    u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent, u.branch_code AS _branch_code, COALESCE(br.name, u.branch_code) AS branch,
    pr.id::text AS _product_id, pr.code AS _product_code, COALESCE(pr.name, b.product_type) AS product
  FROM insurer_offers o JOIN broker_slips b ON b.id = o.broker_slip_id JOIN insurance_companies ic ON ic.id = o.insurance_company_id
  LEFT JOIN products pr ON pr.id = b.product_id LEFT JOIN users u ON u.id = b.owner_user_id LEFT JOIN branches br ON br.code = u.branch_code
  WHERE b.created_at::date BETWEEN $1 AND $2 AND b.status <> 'cancelled'`;

const INSURER = "lower(d.payee_type) = 'insurer'";
const CLIENT = "lower(d.payee_type) IN ('client', 'customer')";
// Co-insurance: every active participant of a co-insured policy (more than one insurer), with its share of the premium,
// commission and taxes as booked on the policy's bills (else as recorded on the participant row)
const coInsurance = `SELECT p.id AS _id, p.policy_number AS "policyNumber", p.inception_date AS "inceptionDate", p.expiry_date AS "expiryDate",
    u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent, u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
    c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client, pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product,
    ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer, lead.name AS "leadInsurer",
    CASE WHEN rp.is_lead THEN 'Lead' ELSE 'Co-insurer' END AS role, rp.share_percent AS "sharePercent", rp.sum_insured AS "sumInsured",
    COALESCE(bk.gross, rp.premium_total) AS premium, COALESCE(bk.commission, rp.commission_amount) AS commission, COALESCE(bk.taxes, rp.taxes) AS taxes,
    COALESCE(bk.due, rp.premium_total - rp.commission_amount - rp.taxes) AS "dueToInsurer", rp.insurer_reference AS "insurerReference", p.status
  FROM risk_participants rp JOIN policies p ON rp.entity_type = 'policy' AND p.id = rp.entity_id
  JOIN insurance_companies ic ON ic.id = rp.insurance_company_id
  LEFT JOIN LATERAL (SELECT i2.name FROM risk_participants r2 JOIN insurance_companies i2 ON i2.id = r2.insurance_company_id
    WHERE r2.entity_type = 'policy' AND r2.entity_id = p.id AND r2.is_lead AND r2.status = 'active' LIMIT 1) lead ON true
  LEFT JOIN LATERAL (SELECT sum(x.gross) AS gross, sum(x.commission) AS commission, sum(x.taxes) AS taxes, sum(x.due_to_insurer) AS due FROM receivable_participants x
    JOIN receivables r ON r.id = x.receivable_id WHERE r.policy_id = p.id AND x.insurance_company_id = rp.insurance_company_id AND r.status <> 'cancelled') bk ON true
  LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN users u ON u.id = p.owner_user_id LEFT JOIN branches b ON b.code = u.branch_code
  WHERE rp.status = 'active' AND p.inception_date BETWEEN $1 AND $2
    AND (SELECT count(*) FROM risk_participants z WHERE z.entity_type = 'policy' AND z.entity_id = p.id AND z.status = 'active') > 1`;

// Premium due to each insurer per bill (a co-insured bill: each participant's share as booked), how much of it the broker has
// collected (pro rata to the bill's payments), remitted (insurer payment vouchers) and still holds
const dueToInsurers = `SELECT x.*, round(x."collectedDue" - x.remitted, 2) AS outstanding, round(x."dueToInsurer" - x."collectedDue", 2) AS uncollected FROM (
    SELECT r.bill_number AS "billNumber", COALESCE((SELECT bj.jv_date FROM journal_vouchers bj WHERE bj.id = r.booking_jv_id), r.created_at::date) AS "billDate", p.policy_number AS "policyNumber",
      ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer, CASE WHEN pt.co THEN 'Co-insured' ELSE 'Single insurer' END AS placement,
      u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent, u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
      c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client, pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product, r.status,
      pt.gross AS premium, pt.commission, round(pt.gross - pt.commission, 2) AS "dueToInsurer",
      round((pt.gross - pt.commission) * (r.amount - r.balance) / NULLIF(r.amount, 0), 2) AS "collectedDue",
      CASE WHEN pt.co THEN COALESCE((SELECT sum(al.net) FROM remittance_allocations al JOIN receipt_applications a ON a.id = al.receipt_application_id
          WHERE a.receivable_id = r.id AND al.insurance_company_id = pt.iid AND a.status = 'applied'), 0)
        ELSE COALESCE((SELECT round(sum(a.amount * (1 - r.commission_amount / NULLIF(r.amount, 0))), 2) FROM receipt_applications a
          WHERE a.receivable_id = r.id AND a.remitted_invoice_id IS NOT NULL AND a.status = 'applied'), 0) END AS remitted
    FROM receivables r JOIN policies p ON p.id = r.policy_id
    JOIN LATERAL (SELECT x.insurance_company_id AS iid, x.gross, x.commission, true AS co FROM receivable_participants x WHERE x.receivable_id = r.id
      UNION ALL SELECT p.insurance_company_id, r.amount, r.commission_amount, false WHERE NOT EXISTS (SELECT 1 FROM receivable_participants x WHERE x.receivable_id = r.id)) pt ON true
    JOIN insurance_companies ic ON ic.id = pt.iid
    LEFT JOIN clients c ON c.id = COALESCE(r.client_id, p.client_id) LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN users u ON u.id = p.owner_user_id LEFT JOIN branches b ON b.code = u.branch_code
    WHERE r.status <> 'cancelled' AND COALESCE((SELECT bj.jv_date FROM journal_vouchers bj WHERE bj.id = r.booking_jv_id), r.created_at::date) BETWEEN $1 AND $2) x`;

export const QUERIES = {
  ...PERIOD_END_QUERIES,
  placementPipeline: {
    sql: placementPipeline, extras: [setting('reports.placement_age_buckets', [7, 14, 30, 60], 'int[]'),
      setting('reports.placement_open_statuses', ['draft', 'submitted', 'responses-in', 'sent', 'acknowledged', 'epolicy_received', 'checked', 'declined'], 'text[]')],
    filters: ['agent', 'insurer', 'branch', 'client', 'product', 'status'],
    criteria: { Overall: {}, 'Slip Type': { groupBy: 'slipType' }, Status: { groupBy: 'status' }, 'Open by Age': { where: 't.status = ANY($4::text[])', groupBy: 'ageBucket' },
      Agent: { groupBy: 'agent' } },
    orderBy: 'f."createdDate", f."slipNumber"',
    summary: { brokerSlips: 'count(*) FILTER (WHERE f."slipType" = \'Broker Slip\')', placementSlips: 'count(*) FILTER (WHERE f."slipType" = \'Placement Slip\')',
      open: 'count(*) FILTER (WHERE f.status = ANY($4::text[]))', averageAgeDays: 'round(avg(f."ageDays"), 1)' },
  },
  marketResponse: {
    sql: marketResponse, filters: ['agent', 'insurer', 'branch', 'product'],
    criteria: { Overall: { dims: ['insurer'] }, 'Line of Business': { dims: ['insurer', 'lob'] }, Agent: { dims: ['agent', 'insurer'] } },
    aggregate: {
      approached: 'count(*)', offered: 'count(*) FILTER (WHERE t.status = \'offered\')', declined: 'count(*) FILTER (WHERE t.status = \'declined\')',
      pending: 'count(*) FILTER (WHERE t.status = \'pending\')', selected: 'count(*) FILTER (WHERE t.selected)',
      responseRate: 'round(100.0 * count(*) FILTER (WHERE t.status <> \'pending\') / NULLIF(count(*), 0), 2)',
      hitRatio: 'round(100.0 * count(*) FILTER (WHERE t.selected) / NULLIF(count(*) FILTER (WHERE t.status = \'offered\'), 0), 2)',
      averageResponseDays: 'round(avg(t."responseDays"), 1)', offeredPremium: 'COALESCE(sum(t."premiumTotal") FILTER (WHERE t.status = \'offered\'), 0)',
    },
    orderBy: (dims) => ['f.selected DESC', ...dims.map((d) => `f."${d}"`)].join(', '),
  },
  coInsuranceRegister: {
    sql: coInsurance, filters: POLICY_FILTERS,
    criteria: { Overall: {}, 'Co-insurer': { groupBy: 'insurer' }, Policy: { groupBy: 'policyNumber' }, Agent: { groupBy: 'agent' } },
    orderBy: 'f."inceptionDate", f."policyNumber", f.role DESC, f.insurer',
  },
  dueToInsurers: {
    sql: dueToInsurers, filters: POLICY_FILTERS,
    criteria: { 'Co-insurer': { dims: ['insurer'] }, 'Co-insurer and Policy': { dims: ['insurer', 'policyNumber'] }, Placement: { dims: ['placement', 'insurer'] } },
    aggregate: { bills: 'count(*)', premium: 'sum(t.premium)', commission: 'sum(t.commission)', dueToInsurer: 'sum(t."dueToInsurer")', collectedDue: 'sum(t."collectedDue")',
      remitted: 'sum(t.remitted)', outstanding: 'sum(t.outstanding)', uncollected: 'sum(t.uncollected)' },
  },
  ...BANK_REC_QUERIES,
  ...CHANNEL_QUERIES,
  production: {
    sql: production, filters: POLICY_FILTERS, criteria: { ...STANDARD_CRITERIA, 'Billing Mode': { groupBy: 'billingMode' }, Source: { groupBy: 'source' } },
    orderBy: 'f."inceptionDate", f."policyNumber"',
    summary: { newBusiness: 'count(*) FILTER (WHERE f."businessType" = \'New Business\')', renewals: 'count(*) FILTER (WHERE f."businessType" = \'Renewal\')',
      directBill: 'count(*) FILTER (WHERE f."billingMode" = \'Direct bill\')', migrated: 'count(*) FILTER (WHERE f.source = \'Migrated\')' },
  },
  premiumByProduct: {
    sql: production, filters: POLICY_FILTERS,
    criteria: { Overall: { dims: ['month', 'product', 'insurer'] }, Product: { dims: ['product'] }, Month: { dims: ['month'] }, 'Principal Insurer': { dims: ['insurer'] } },
    aggregate: { policies: 'count(*)', sumInsured: 'sum(t."sumInsured")', premium: 'sum(t.premium)', commission: 'sum(t.commission)' },
  },
  newVsRenewal: {
    sql: production, filters: POLICY_FILTERS,
    criteria: { Overall: { dims: ['month', 'businessType'] }, 'Business Type': { dims: ['businessType'] }, Agent: { dims: ['agent', 'businessType'] } },
    aggregate: { policies: 'count(*)', premium: 'sum(t.premium)', commission: 'sum(t.commission)' },
  },
  claims: {
    sql: claims, extras: claimExtras, filters: POLICY_FILTERS,
    criteria: {
      All: {}, Open: { where: 't.status = ANY($4::text[])' }, Settled: { where: 't.status = ANY($5::text[])' },
      Rejected: { where: 't.status = ANY($6::text[])' }, Aging: { where: 't.status = ANY($4::text[])', groupBy: 'ageBucket' },
    },
    orderBy: 'f."reportedDate", f."claimNumber"',
  },
  claimsAgeing: {
    sql: `${claims} AND cl.status = ANY($4::text[])`, extras: claimExtras, filters: POLICY_FILTERS,
    criteria: { Overall: { dims: ['ageBucket'] }, 'Principal Insurer': { dims: ['insurer', 'ageBucket'] }, Agent: { dims: ['agent', 'ageBucket'] } },
    aggregate: { claims: 'count(*)', estimateAmount: 'sum(t."estimateAmount")', approvedAmount: 'sum(COALESCE(t."approvedAmount", 0))', averageAgeDays: 'round(avg(t."ageDays"), 1)', _minAge: 'min(t."ageDays")' },
    orderBy: (dims) => dims.map((d) => (d === 'ageBucket' ? 'f."_minAge"' : `f."${d}"`)).join(', '),
  },
  renewals: {
    sql: `SELECT p.policy_number AS "policyNumber", ${POLICY_DIMS}, r.due_date AS "dueDate", r.status,
        CASE WHEN r.status = ANY($3::text[]) THEN 'Retained' WHEN r.status = ANY($4::text[]) THEN 'Lost' ELSE 'Pending' END AS outcome,
        r.premium_old AS "premiumOld", r.premium_new AS "premiumNew", np.policy_number AS "renewedPolicyNumber"
      FROM renewals r JOIN policies p ON p.id = r.policy_id ${POLICY_JOINS}
      LEFT JOIN policies np ON np.id = r.new_policy_id
      WHERE r.due_date BETWEEN $1 AND $2`,
    extras: [setting('reports.renewal_retained_statuses', ['renewed'], 'text[]'), setting('reports.renewal_lost_statuses', ['lapsed'], 'text[]')],
    filters: POLICY_FILTERS, criteria: STANDARD_CRITERIA, orderBy: 'f."dueDate", f."policyNumber"',
    summary: {
      retained: 'count(*) FILTER (WHERE f.outcome = \'Retained\')',
      lost: 'count(*) FILTER (WHERE f.outcome = \'Lost\')',
      pending: 'count(*) FILTER (WHERE f.outcome = \'Pending\')',
      retentionRate: 'round(100.0 * count(*) FILTER (WHERE f.outcome = \'Retained\') / NULLIF(count(*) FILTER (WHERE f.outcome IN (\'Retained\', \'Lost\')), 0), 2)',
    },
  },
  remittances: {
    sql: `SELECT rm.remittance_number AS "remittanceNumber", COALESCE(rm.remittance_date, rm.created_at::date) AS "remittanceDate", rm.kind, rm.period,
        ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer, ${CREATOR_DIMS},
        (SELECT count(*) FROM remittance_lines l WHERE l.remittance_id = rm.id) AS policies,
        rm.gross_premium AS "grossPremium", rm.commission, rm.net_due AS "netDue", rm.status, rm.settled_at::date AS "settledDate"
      FROM remittances rm LEFT JOIN insurance_companies ic ON ic.id = rm.insurance_company_id ${creatorJoin('rm.created_by')}
      WHERE COALESCE(rm.remittance_date, rm.created_at::date) BETWEEN $1 AND $2`,
    filters: ['agent', 'insurer', 'branch', 'status'], criteria: STANDARD_CRITERIA, orderBy: 'f."remittanceDate", f."remittanceNumber"',
  },
  commissions: {
    sql: `SELECT p.policy_number AS "policyNumber", cm.period, COALESCE(p.issued_date, cm.created_at::date) AS "accruedDate",
        u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
        ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer,
        u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
        c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client,
        pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product,
        cm.basis_amount AS "basisAmount", cm.rate, cm.amount, cm.withholding, cm.net_amount AS "netAmount", cm.status, cm.paid_at::date AS "paidDate",
        ${BILLING_MODE} AS "billingMode"
      FROM commissions cm LEFT JOIN policies p ON p.id = cm.policy_id
      LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
      LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
      LEFT JOIN users u ON u.id = COALESCE(cm.agent_user_id, p.owner_user_id)
      LEFT JOIN branches b ON b.code = u.branch_code
      WHERE COALESCE(p.issued_date, cm.created_at::date) BETWEEN $1 AND $2`,
    filters: POLICY_FILTERS, criteria: STANDARD_CRITERIA, orderBy: 'f.agent, f."accruedDate", f."policyNumber"',
  },
  premiumReceivable: {
    sql: `${receivables} WHERE COALESCE(${BILL_DATE}, rv.created_at::date) BETWEEN $1 AND $2`, extras: [receivableBuckets],
    filters: POLICY_FILTERS, criteria: STANDARD_CRITERIA, orderBy: 'f.client, f."dueDate", f."billNumber"',
  },
  collectionsAgeing: {
    sql: `${receivables} WHERE rv.balance > 0 AND rv.status <> 'written-off' AND COALESCE(${BILL_DATE}, rv.created_at::date) <= $2`, extras: [receivableBuckets],
    filters: POLICY_FILTERS,
    criteria: { 'Ageing Bucket': { groupBy: 'ageBucket' }, Overall: {}, Agent: { groupBy: 'agent' }, 'Principal Insurer': { groupBy: 'insurer' }, Branch: { groupBy: 'branch' }, Client: { groupBy: 'client' } },
    orderBy: 'f."ageDays" DESC, f."billNumber"',
  },
  collections: {
    sql: `SELECT x.*, round(100.0 * x.collected / NULLIF(x.billed, 0), 2) AS "collectionRate" FROM (
        SELECT rv.bill_number AS "billNumber", COALESCE(${BILL_DATE}, rv.created_at::date) AS "billDate", rv.due_date AS "dueDate", p.policy_number AS "policyNumber",
          ${POLICY_DIMS}, rv.amount AS billed,
          COALESCE((SELECT sum(r.amount) FROM receipts r WHERE r.receivable_id = rv.id AND r.status = 'posted' AND r.received_date <= $2), 0) AS collected,
          rv.balance, rv.status
        FROM receivables rv LEFT JOIN policies p ON p.id = rv.policy_id
        LEFT JOIN clients c ON c.id = COALESCE(rv.client_id, p.client_id)
        LEFT JOIN products pr ON pr.id = p.product_id
        LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
        LEFT JOIN users u ON u.id = p.owner_user_id
        LEFT JOIN branches b ON b.code = u.branch_code
        WHERE rv.due_date BETWEEN $1 AND $2) x`,
    filters: POLICY_FILTERS, criteria: STANDARD_CRITERIA, orderBy: 'f."dueDate", f."billNumber"',
    summary: { collectionEfficiency: 'round(100.0 * sum(f.collected) / NULLIF(sum(f.billed), 0), 2)' },
  },
  receipts: {
    sql: `SELECT r.receipt_number AS "receiptNumber", r.received_date AS "receivedDate", rv.bill_number AS "billNumber",
        p.policy_number AS "policyNumber", ${POLICY_DIMS}, r.payment_mode AS "paymentMode", bk.name AS bank,
        r.reference_no AS "referenceNo", r.amount, r.status
      FROM receipts r LEFT JOIN receivables rv ON rv.id = r.receivable_id
      LEFT JOIN policies p ON p.id = COALESCE(r.policy_id, rv.policy_id)
      LEFT JOIN clients c ON c.id = COALESCE(r.client_id, p.client_id)
      LEFT JOIN products pr ON pr.id = p.product_id
      LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
      LEFT JOIN users u ON u.id = p.owner_user_id
      LEFT JOIN branches b ON b.code = u.branch_code
      LEFT JOIN banks bk ON bk.id = r.bank_id
      WHERE r.received_date BETWEEN $1 AND $2`,
    filters: POLICY_FILTERS, criteria: { ...STANDARD_CRITERIA, 'Payment Mode': { groupBy: 'paymentMode' } },
    orderBy: 'f."receivedDate", f."receiptNumber"',
  },
  disbursements: {
    sql: `SELECT d.voucher_number AS "voucherNumber", COALESCE(d.voucher_date, d.created_at::date) AS "voucherDate", d.payee_type AS "payeeType", d.payee_name AS "payeeName",
        d.purpose, d.payment_mode AS "paymentMode", bk.name AS bank, d.reference_no AS "referenceNo", d.amount, d.status,
        d.approved_at::date AS "approvedDate", d.paid_at::date AS "paidDate",
        CASE WHEN ${AGENT} THEN COALESCE(d.referrer_id, d.payee_id) END AS _agent_id, CASE WHEN ${AGENT} THEN COALESCE(d.referrer_name, d.payee_name) END AS agent,
        CASE WHEN ${AGENT} THEN au.username END AS _agent_username,
        CASE WHEN ${INSURER} THEN COALESCE(d.insurance_company_id::text, d.payee_id) END AS _insurer_id, CASE WHEN ${INSURER} THEN ic.code END AS _insurer_code,
        CASE WHEN ${INSURER} THEN COALESCE(d.insurer_name, ic.name, d.payee_name) END AS insurer,
        CASE WHEN ${CLIENT} THEN COALESCE(d.client_id, d.payee_id) END AS _client_id, CASE WHEN ${CLIENT} THEN cl.client_code END AS _client_code,
        CASE WHEN ${CLIENT} THEN d.payee_name END AS client,
        u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch, u.display_name AS "preparedBy"
      FROM disbursements d LEFT JOIN banks bk ON bk.id = d.bank_id
      LEFT JOIN users au ON ${AGENT} AND au.id = d.payee_id
      LEFT JOIN insurance_companies ic ON ${INSURER} AND ic.id::text = COALESCE(d.insurance_company_id::text, d.payee_id)
      LEFT JOIN clients cl ON ${CLIENT} AND cl.id = COALESCE(d.client_id, d.payee_id)
      ${creatorJoin('d.created_by')}
      WHERE COALESCE(d.voucher_date, d.created_at::date) BETWEEN $1 AND $2`,
    filters: ['agent', 'insurer', 'branch', 'client', 'status'],
    criteria: { ...STANDARD_CRITERIA, 'Payee Type': { groupBy: 'payeeType' } }, orderBy: 'f."voucherDate", f."voucherNumber"',
  },
  journal: {
    sql: `SELECT jv.jv_number AS "jvNumber", jv.jv_date AS "jvDate", jv.description, jv.status, jl.account_code AS "accountCode",
        jl.account_name AS "accountName", jl.debit, jl.credit, jl.memo, ${CREATOR_DIMS}
      FROM journal_lines jl JOIN journal_vouchers jv ON jv.id = jl.jv_id ${creatorJoin('jv.created_by')}
      WHERE jv.jv_date BETWEEN $1 AND $2`,
    filters: ['agent', 'branch', 'status'],
    criteria: { Overall: {}, Agent: { groupBy: 'agent' }, 'Principal Insurer': {}, Branch: { groupBy: 'branch' }, Account: { groupBy: 'accountCode' } },
    orderBy: 'f."jvDate", f."jvNumber", f."accountCode"',
  },
  trialBalance: {
    sql: `SELECT jl.account_code AS "accountCode", COALESCE(ga.name, jl.account_name, jl.account_code) AS "accountName", ga.account_type AS "accountType",
        ga.fs_group AS "fsGroup", jv.jv_date AS _date, jl.debit, jl.credit, ${CREATOR_DIMS}
      FROM journal_lines jl JOIN journal_vouchers jv ON jv.id = jl.jv_id LEFT JOIN gl_accounts ga ON ga.code = jl.account_code ${creatorJoin('jv.created_by')}
      WHERE jv.jv_date <= $2 AND jv.status = ANY($3::text[])
      UNION ALL
      -- go-live opening balances (Period Management > Import opening balances) are not journals: they count as at the day
      -- before the go-live date; balances written by a year-end close are left out, the journals behind them are already here
      SELECT o.account_code, COALESCE(ga.name, o.account_code), ga.account_type, ga.fs_group, substr(o.source_run, 9)::date - 1,
        GREATEST(o.balance, 0), GREATEST(-o.balance, 0), NULL, NULL, NULL, NULL, NULL
      FROM opening_balances o LEFT JOIN gl_accounts ga ON ga.code = o.account_code
      WHERE o.source_run LIKE 'go-live:%' AND substr(o.source_run, 9)::date - 1 <= $2`,
    extras: [setting('reports.trial_balance_statuses', ['approved', 'posted'], 'text[]')],
    filters: ['agent', 'branch'],
    criteria: { Overall: { dims: TB_DIMS }, Agent: { dims: TB_DIMS }, 'Principal Insurer': { dims: TB_DIMS }, Branch: { dims: ['branch', ...TB_DIMS] } },
    orderBy: (dims) => dims.map((d) => (d === 'accountType' ? `COALESCE(array_position(ARRAY[${ACCOUNT_TYPES}], f."accountType"), 99)` : `f."${d}"`)).join(', '),
    aggregate: {
      openingBalance: 'COALESCE(sum(t.debit - t.credit) FILTER (WHERE t._date < $1), 0)',
      periodDebit: 'COALESCE(sum(t.debit) FILTER (WHERE t._date >= $1), 0)',
      periodCredit: 'COALESCE(sum(t.credit) FILTER (WHERE t._date >= $1), 0)',
      closingDebit: 'GREATEST(sum(t.debit - t.credit), 0)',
      closingCredit: 'GREATEST(sum(t.credit - t.debit), 0)',
    },
    summary: { balanced: 'sum(f."closingDebit") = sum(f."closingCredit")' },
  },
  directBillCommission: {
    sql: directBill, extras: [receivableBuckets], filters: POLICY_FILTERS,
    criteria: {
      'Ageing Bucket': { where: 't.balance > 0', groupBy: 'ageBucket' }, 'Principal Insurer': { where: 't.balance > 0', groupBy: 'insurer' },
      Outstanding: { where: 't.balance > 0' }, Overall: { where: 't."_inPeriod"' },
    },
    orderBy: 'f.insurer, f."ageDays" DESC, f."policyNumber"',
  },
  leadFunnel: {
    sql: `SELECT l.status AS stage, l.created_at::date AS "createdDate", u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
        u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
        pr.id::text AS _product_id, pr.code AS _product_code, COALESCE(pr.name, l.product_interest, CASE WHEN l.lob IS NULL THEN 'Product not yet tagged' END) AS product, l.source
      FROM leads l LEFT JOIN users u ON u.id = l.owner_user_id LEFT JOIN branches b ON b.code = u.branch_code
      LEFT JOIN products pr ON pr.id = l.product_id
      WHERE l.created_at::date BETWEEN $1 AND $2`,
    extras: [setting('reports.lead_funnel_stages', ['new', 'contacted', 'qualified', 'quoted', 'converted', 'lost'], 'text[]')],
    filters: ['agent', 'branch', 'product'],
    criteria: { Overall: { dims: ['stage'] }, Agent: { dims: ['agent', 'stage'] }, Branch: { dims: ['branch', 'stage'] }, Source: { dims: ['source', 'stage'] } },
    aggregate: { leads: 'count(*)', share: 'round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 2)' },
    orderBy: (dims) => dims.map((d) => (d === 'stage' ? 'COALESCE(array_position($3::text[], f.stage), 999)' : `f."${d}"`)).join(', '),
    summary: { conversionRate: 'round(100.0 * sum(f.leads) FILTER (WHERE f.stage = \'converted\') / NULLIF(sum(f.leads), 0), 2)' },
  },
  incentives: {
    sql: `SELECT ip.name AS program, ip.metric, ir.period, u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
        u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch, ip.target, ir.achieved,
        round(100.0 * ir.achieved / NULLIF(ip.target, 0), 2) AS "achievementPct", ir.payout, ir.status
      FROM incentive_results ir JOIN incentive_programs ip ON ip.id = ir.program_id JOIN users u ON u.id = ir.agent_user_id
      LEFT JOIN branches b ON b.code = u.branch_code
      WHERE COALESCE(ip.period_from, $1) <= $2 AND COALESCE(ip.period_to, $2) >= $1`,
    filters: ['agent', 'branch', 'status'], criteria: { Overall: {}, Program: { groupBy: 'program' }, Agent: { groupBy: 'agent' }, Branch: { groupBy: 'branch' } },
    orderBy: 'f.program, f."achievementPct" DESC NULLS LAST',
  },
};
