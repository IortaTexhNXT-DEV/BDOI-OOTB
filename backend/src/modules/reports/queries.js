/**
 * Report queries, keyed by report_definitions.query_name.
 *
 * Every base query receives $1 = from date and $2 = to date; `extras` (read from app_settings) follow as $3, $4 ...
 * Columns prefixed with "_" are internal (used for filtering) and never returned. The service wraps the base query:
 *   SELECT * FROM (<sql>) t WHERE <filters> [GROUP BY <dims>]   -- then pages, totals and groups over it.
 * Supported filter keys: agent, insurer, branch, client, product, status (see FILTERS in service.js).
 * criteria: allowed values of the screen's "Report Criteria" drop-down. { where } restricts rows, { groupBy } adds a
 * summary by that column, { dims } chooses the aggregation dimensions of aggregate reports.
 */
/** An extra positional parameter read from app_settings; `type` is its SQL type (every parameter is cast once so
 *  that parameters unused by a variant of the query still have a known type). */
const setting = (key, fallback, type) => ({ key, fallback, type });

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

const STANDARD_CRITERIA = { Overall: {}, Agent: { groupBy: 'agent' }, 'Principle Insurance': { groupBy: 'insurer' }, Branch: { groupBy: 'branch' } };
const POLICY_FILTERS = ['agent', 'insurer', 'branch', 'client', 'product', 'status'];

const production = `SELECT p.id AS _id, p.policy_number AS "policyNumber", p.created_at::date AS "issueDate",
    p.inception_date AS "inceptionDate", p.expiry_date AS "expiryDate", to_char(p.inception_date, 'YYYY-MM') AS month,
    CASE WHEN p.renewed_from IS NULL THEN 'New Business' ELSE 'Renewal' END AS "businessType",
    ${POLICY_DIMS}, p.sum_insured AS "sumInsured", p.premium_total AS premium, p.commission_amount AS commission,
    p.currency, p.status
  FROM policies p ${POLICY_JOINS}
  WHERE p.inception_date BETWEEN $1 AND $2`;

const claims = `SELECT cl.claim_number AS "claimNumber", p.policy_number AS "policyNumber", ${POLICY_DIMS},
    cl.loss_date AS "lossDate", cl.reported_date AS "reportedDate", cl.loss_type AS "lossType", cl.status,
    cl.estimate_amount AS "estimateAmount", cl.approved_amount AS "approvedAmount", cl.settled_amount AS "settledAmount",
    (COALESCE(cl.settled_at::date, current_date) - cl.reported_date) AS "ageDays",
    rpt_age_bucket(COALESCE(cl.settled_at::date, current_date) - cl.reported_date, $3::int[]) AS "ageBucket"
  FROM claims cl JOIN policies p ON p.id = cl.policy_id ${POLICY_JOINS}
  WHERE cl.reported_date BETWEEN $1 AND $2`;
const claimExtras = [setting('reports.claim_ageing_buckets', [30, 60, 90, 180], 'int[]'),
  setting('reports.claim_open_statuses', ['registered', 'in-review', 'approved'], 'text[]'),
  setting('reports.claim_settled_statuses', ['settled', 'closed'], 'text[]'),
  setting('reports.claim_rejected_statuses', ['rejected'], 'text[]')];

const receivables = `SELECT rv.bill_number AS "billNumber", rv.created_at::date AS "billDate", rv.due_date AS "dueDate",
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

export const QUERIES = {
  production: {
    sql: production, filters: POLICY_FILTERS, criteria: STANDARD_CRITERIA,
    orderBy: 'f."inceptionDate", f."policyNumber"',
    summary: { newBusiness: 'count(*) FILTER (WHERE f."businessType" = \'New Business\')', renewals: 'count(*) FILTER (WHERE f."businessType" = \'Renewal\')' },
  },
  premiumByProduct: {
    sql: production, filters: POLICY_FILTERS,
    criteria: { Overall: { dims: ['month', 'product', 'insurer'] }, Product: { dims: ['product'] }, Month: { dims: ['month'] }, 'Principle Insurance': { dims: ['insurer'] } },
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
    criteria: { Overall: { dims: ['ageBucket'] }, 'Principle Insurance': { dims: ['insurer', 'ageBucket'] }, Agent: { dims: ['agent', 'ageBucket'] } },
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
    sql: `SELECT rm.remittance_number AS "remittanceNumber", rm.created_at::date AS "remittanceDate", rm.kind, rm.period,
        ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer, ${CREATOR_DIMS},
        (SELECT count(*) FROM remittance_lines l WHERE l.remittance_id = rm.id) AS policies,
        rm.gross_premium AS "grossPremium", rm.commission, rm.net_due AS "netDue", rm.status, rm.settled_at::date AS "settledDate"
      FROM remittances rm LEFT JOIN insurance_companies ic ON ic.id = rm.insurance_company_id ${creatorJoin('rm.created_by')}
      WHERE rm.created_at::date BETWEEN $1 AND $2`,
    filters: ['agent', 'insurer', 'branch', 'status'], criteria: STANDARD_CRITERIA, orderBy: 'f."remittanceDate", f."remittanceNumber"',
  },
  commissions: {
    sql: `SELECT p.policy_number AS "policyNumber", cm.period, cm.created_at::date AS "accruedDate",
        u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
        ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer,
        u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
        c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client,
        pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product,
        cm.basis_amount AS "basisAmount", cm.rate, cm.amount, cm.withholding, cm.net_amount AS "netAmount", cm.status, cm.paid_at::date AS "paidDate"
      FROM commissions cm LEFT JOIN policies p ON p.id = cm.policy_id
      LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
      LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
      LEFT JOIN users u ON u.id = COALESCE(cm.agent_user_id, p.owner_user_id)
      LEFT JOIN branches b ON b.code = u.branch_code
      WHERE cm.created_at::date BETWEEN $1 AND $2`,
    filters: POLICY_FILTERS, criteria: STANDARD_CRITERIA, orderBy: 'f.agent, f."accruedDate", f."policyNumber"',
  },
  premiumReceivable: {
    sql: `${receivables} WHERE rv.created_at::date BETWEEN $1 AND $2`, extras: [receivableBuckets],
    filters: POLICY_FILTERS, criteria: STANDARD_CRITERIA, orderBy: 'f.client, f."dueDate", f."billNumber"',
  },
  collectionsAgeing: {
    sql: `${receivables} WHERE rv.balance > 0 AND rv.status <> 'written-off' AND rv.created_at::date <= $2`, extras: [receivableBuckets],
    filters: POLICY_FILTERS,
    criteria: { 'Ageing Bucket': { groupBy: 'ageBucket' }, Overall: {}, Agent: { groupBy: 'agent' }, 'Principle Insurance': { groupBy: 'insurer' }, Branch: { groupBy: 'branch' }, Client: { groupBy: 'client' } },
    orderBy: 'f."ageDays" DESC, f."billNumber"',
  },
  collections: {
    sql: `SELECT x.*, round(100.0 * x.collected / NULLIF(x.billed, 0), 2) AS "collectionRate" FROM (
        SELECT rv.bill_number AS "billNumber", rv.created_at::date AS "billDate", rv.due_date AS "dueDate", p.policy_number AS "policyNumber",
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
    sql: `SELECT d.voucher_number AS "voucherNumber", d.created_at::date AS "voucherDate", d.payee_type AS "payeeType", d.payee_name AS "payeeName",
        d.purpose, d.payment_mode AS "paymentMode", bk.name AS bank, d.reference_no AS "referenceNo", d.amount, d.status,
        d.approved_at::date AS "approvedDate", d.paid_at::date AS "paidDate",
        CASE WHEN d.payee_type = 'agent' THEN d.payee_id END AS _agent_id, CASE WHEN d.payee_type = 'agent' THEN d.payee_name END AS agent,
        CASE WHEN d.payee_type = 'agent' THEN au.username END AS _agent_username,
        CASE WHEN d.payee_type = 'insurer' THEN d.payee_id END AS _insurer_id, CASE WHEN d.payee_type = 'insurer' THEN ic.code END AS _insurer_code,
        CASE WHEN d.payee_type = 'insurer' THEN d.payee_name END AS insurer,
        CASE WHEN d.payee_type = 'client' THEN d.payee_id END AS _client_id, CASE WHEN d.payee_type = 'client' THEN cl.client_code END AS _client_code,
        CASE WHEN d.payee_type = 'client' THEN d.payee_name END AS client,
        u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch, u.display_name AS "preparedBy"
      FROM disbursements d LEFT JOIN banks bk ON bk.id = d.bank_id
      LEFT JOIN users au ON d.payee_type = 'agent' AND au.id = d.payee_id
      LEFT JOIN insurance_companies ic ON d.payee_type = 'insurer' AND ic.id::text = d.payee_id
      LEFT JOIN clients cl ON d.payee_type = 'client' AND cl.id = d.payee_id
      ${creatorJoin('d.created_by')}
      WHERE d.created_at::date BETWEEN $1 AND $2`,
    filters: ['agent', 'insurer', 'branch', 'client', 'status'],
    criteria: { ...STANDARD_CRITERIA, 'Payee Type': { groupBy: 'payeeType' } }, orderBy: 'f."voucherDate", f."voucherNumber"',
  },
  journal: {
    sql: `SELECT jv.jv_number AS "jvNumber", jv.jv_date AS "jvDate", jv.description, jv.status, jl.account_code AS "accountCode",
        jl.account_name AS "accountName", jl.debit, jl.credit, jl.memo, ${CREATOR_DIMS}
      FROM journal_lines jl JOIN journal_vouchers jv ON jv.id = jl.jv_id ${creatorJoin('jv.created_by')}
      WHERE jv.jv_date BETWEEN $1 AND $2`,
    filters: ['agent', 'branch', 'status'],
    criteria: { Overall: {}, Agent: { groupBy: 'agent' }, 'Principle Insurance': {}, Branch: { groupBy: 'branch' }, Account: { groupBy: 'accountCode' } },
    orderBy: 'f."jvDate", f."jvNumber", f."accountCode"',
  },
  trialBalance: {
    sql: `SELECT jl.account_code AS "accountCode", COALESCE(jl.account_name, jl.account_code) AS "accountName", jv.jv_date AS _date,
        jl.debit, jl.credit, ${CREATOR_DIMS}
      FROM journal_lines jl JOIN journal_vouchers jv ON jv.id = jl.jv_id ${creatorJoin('jv.created_by')}
      WHERE jv.jv_date <= $2 AND jv.status = ANY($3::text[])`,
    extras: [setting('reports.trial_balance_statuses', ['approved', 'posted'], 'text[]')],
    filters: ['agent', 'branch'],
    criteria: { Overall: { dims: ['accountCode', 'accountName'] }, Agent: { dims: ['accountCode', 'accountName'] }, 'Principle Insurance': { dims: ['accountCode', 'accountName'] }, Branch: { dims: ['branch', 'accountCode', 'accountName'] } },
    aggregate: {
      openingBalance: 'COALESCE(sum(t.debit - t.credit) FILTER (WHERE t._date < $1), 0)',
      periodDebit: 'COALESCE(sum(t.debit) FILTER (WHERE t._date >= $1), 0)',
      periodCredit: 'COALESCE(sum(t.credit) FILTER (WHERE t._date >= $1), 0)',
      closingDebit: 'GREATEST(sum(t.debit - t.credit), 0)',
      closingCredit: 'GREATEST(sum(t.credit - t.debit), 0)',
    },
    summary: { balanced: 'sum(f."closingDebit") = sum(f."closingCredit")' },
  },
  leadFunnel: {
    sql: `SELECT l.status AS stage, l.created_at::date AS "createdDate", u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
        u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
        pr.id::text AS _product_id, pr.code AS _product_code, COALESCE(pr.name, l.product_interest) AS product, l.source
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
  cessions: {
    sql: `SELECT rt.name AS treaty, rt.reinsurer, rt.treaty_type AS "treatyType", p.policy_number AS "policyNumber", ${POLICY_DIMS},
        cs.created_at::date AS "cessionDate", p.sum_insured AS "sumInsured", cs.ceded_sum AS "cededSum", cs.ceded_premium AS "cededPremium",
        round(100.0 * cs.ceded_sum / NULLIF(p.sum_insured, 0), 2) AS "cededPct"
      FROM cessions cs JOIN reinsurance_treaties rt ON rt.id = cs.treaty_id JOIN policies p ON p.id = cs.policy_id ${POLICY_JOINS}
      WHERE cs.created_at::date BETWEEN $1 AND $2`,
    filters: POLICY_FILTERS, criteria: { Overall: {}, Treaty: { groupBy: 'treaty' }, Reinsurer: { groupBy: 'reinsurer' }, 'Principle Insurance': { groupBy: 'insurer' } },
    orderBy: 'f."cessionDate", f."policyNumber"',
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
