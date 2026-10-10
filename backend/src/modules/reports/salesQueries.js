/**
 * Sales reports of TISPH (merged into QUERIES; TIS-BRD-RPT-SLS-01..04, RPT-02, CR-13):
 *
 *   aprOperation        Operation Report APR: the policies written Month to Date or Year to Date (to the To date) per
 *                       business category: Existing UIO, New Car, ROPA, OEM, Cancelled, and Unclassified for a policy
 *                       with neither a category nor a vehicle brand, so that no policy is dropped.
 *   productionByLine    Production per product line: policy count, sum insured, premium and commission, per month.
 *   agentConversion     Agent policy conversion per month: prospects, quotations, policies, accounts, premium,
 *                       commission and the incentive results (tier, payout) of the month.
 *   renewalNotice       Renewal Notice Listing: the policies expiring within 90 days of the To date (the as-of date),
 *                       in 30/60/90 day buckets, with the fields of the renewal calling template.
 *
 * Business category of a policy (aprOperation): Cancelled when the policy is cancelled; the category written on the
 * policy or its quotation (aprCategory, e.g. ROPA for a repossessed unit) when there is one; OEM when the vehicle brand
 * is not one of reports.apr_home_brands; Existing UIO for a renewal or a vehicle that is not brand new; New Car for a
 * brand-new vehicle; Unclassified otherwise.
 */
const setting = (key, fallback, type) => ({ key, fallback, type });

const POLICY_JOINS = `LEFT JOIN quotes q ON q.id = p.quote_id
  LEFT JOIN clients c ON c.id = p.client_id
  LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN users u ON u.id = p.owner_user_id
  LEFT JOIN branches b ON b.code = u.branch_code`;
const POLICY_DIMS = `u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
  ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer,
  u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch,
  c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client,
  pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product`;
/** Product line of a policy: the line of business, else the product type. */
const PRODUCT_LINE = "COALESCE(NULLIF(p.lob, ''), NULLIF(p.product_type, ''), 'Not tagged')";
/** A vehicle detail kept on the policy, its quotation, or the first vehicle of the quotation. */
const vehicle = (key) => `NULLIF(trim(COALESCE(p.details->>'${key}', q.doc->>'${key}', q.doc->'insuranceVehicleDetails'->0->>'${key}')), '')`;
const BRAND = vehicle('vehicleBrand');
const APR_CATEGORY = `CASE
    WHEN p.status = 'cancelled' THEN 'Cancelled'
    WHEN NULLIF(COALESCE(p.details->>'aprCategory', q.doc->>'aprCategory'), '') IS NOT NULL THEN COALESCE(p.details->>'aprCategory', q.doc->>'aprCategory')
    WHEN ${BRAND} IS NULL THEN 'Unclassified'
    WHEN NOT (upper(${BRAND}) = ANY(SELECT upper(x) FROM unnest($3::text[]) x)) THEN 'OEM'
    WHEN p.renewed_from IS NOT NULL OR lower(COALESCE(p.details->>'businessType', '')) = 'renewal' OR lower(COALESCE(q.doc->>'brandNew', '')) = 'false' THEN 'Existing UIO'
    ELSE 'New Car' END`;

// The APR categories in the order of the report; a category written on a policy that is not listed comes after them
const APR_ORDER = "COALESCE(array_position(ARRAY['Existing UIO', 'New Car', 'ROPA', 'OEM', 'Cancelled', 'Unclassified'], f.category), 99)";

const aprOperation = `SELECT p.policy_number AS "policyNumber", p.inception_date AS "inceptionDate", to_char(p.inception_date, 'YYYY-MM') AS month,
    ${APR_CATEGORY} AS category, ${PRODUCT_LINE} AS "productLine", ${BRAND} AS "vehicleBrand", ${POLICY_DIMS},
    p.sum_insured AS "sumInsured", p.premium_total AS premium, p.commission_amount AS commission, p.status
  FROM policies p ${POLICY_JOINS}
  WHERE p.inception_date BETWEEN LEAST($1::date, date_trunc('year', $2::date)::date) AND $2`;

const productionByLine = `SELECT p.policy_number AS "policyNumber", p.inception_date AS "inceptionDate", to_char(p.inception_date, 'YYYY-MM') AS month,
    ${PRODUCT_LINE} AS "productLine", CASE WHEN p.renewed_from IS NULL THEN 'New Business' ELSE 'Renewal' END AS "businessType", ${POLICY_DIMS},
    p.sum_insured AS "sumInsured", p.premium_total AS premium, p.commission_amount AS commission, p.status
  FROM policies p ${POLICY_JOINS}
  WHERE p.inception_date BETWEEN $1 AND $2 AND p.status <> 'cancelled'`;

const AGENT_DIMS = `u.id AS _agent_id, u.username AS _agent_username, u.display_name AS agent,
  u.branch_code AS _branch_code, COALESCE(b.name, u.branch_code) AS branch`;
const agentConversion = `SELECT x.kind, x.month, x.client_id AS "clientId", x.premium, x.commission, x.tier, x.payout, x.converted, ${AGENT_DIMS}
  FROM (
    SELECT 'lead' AS kind, l.owner_user_id AS user_id, to_char(l.created_at, 'YYYY-MM') AS month, NULL::text AS client_id, 0::numeric AS premium, 0::numeric AS commission,
           NULL::text AS tier, 0::numeric AS payout, (l.status = 'converted') AS converted
      FROM leads l WHERE l.deleted_at IS NULL AND l.owner_user_id IS NOT NULL AND l.created_at::date BETWEEN $1 AND $2
    UNION ALL
    SELECT 'quote', q.agent_user_id, to_char(q.created_at, 'YYYY-MM'), NULL, 0, 0, NULL, 0, false
      FROM quotes q WHERE q.deleted_at IS NULL AND q.agent_user_id IS NOT NULL AND q.created_at::date BETWEEN $1 AND $2
    UNION ALL
    SELECT 'policy', p.owner_user_id, to_char(p.inception_date, 'YYYY-MM'), p.client_id, p.premium_total, p.commission_amount, NULL, 0, false
      FROM policies p WHERE p.status <> 'cancelled' AND p.owner_user_id IS NOT NULL AND p.inception_date BETWEEN $1 AND $2
    UNION ALL
    SELECT 'incentive', ir.agent_user_id, ir.period, NULL, 0, 0, ir.tier, ir.payout, false
      FROM incentive_results ir
     WHERE ir.period ~ '^\\d{4}-\\d{2}$' AND ir.period BETWEEN to_char($1::date, 'YYYY-MM') AND to_char($2::date, 'YYYY-MM') AND ir.status <> 'cancelled'
  ) x JOIN users u ON u.id = x.user_id
  LEFT JOIN branches b ON b.code = u.branch_code`;

/**
 * Notice treatment of a policy as the renewal notice gate decides it (renewals/noticeGate.js, FR-LCK-010): held when the
 * TFS loan status blocks notices ($3, lockin.blocking_loan_statuses); suppressed for an active lock-in running past the
 * expiry, or a Scheme 2 Motor account whose loan is still open ($4, lockin.suppress_scheme2_motor); a lock-in flag on the
 * policy itself counts as a lock-in; send otherwise.
 */
const NOTICE_TREATMENT = `CASE
    WHEN lk.id IS NOT NULL AND COALESCE(lk.loan_status, 'current') = ANY($3::text[]) THEN 'Held: loan status'
    WHEN lk.status = 'active' AND lk.source <> 'scheme2' AND lk.end_date >= p.expiry_date + 1 THEN 'Suppressed: lock-in'
    WHEN lk.status = 'active' AND lk.source = 'scheme2' AND $4::boolean AND COALESCE(lk.loan_status, 'current') <> 'closed'
      AND upper(${PRODUCT_LINE}) = 'MOTOR' THEN 'Suppressed: Scheme 2'
    WHEN lower(COALESCE(p.details->>'lockIn', '')) IN ('true', 'yes', '1') THEN 'Suppressed: lock-in'
    WHEN lower(COALESCE(p.details->>'scheme2', '')) IN ('true', 'yes', '1') THEN 'Suppressed: Scheme 2'
    ELSE 'Send' END`;

const renewalNotice = `SELECT x.*, CASE WHEN x."daysToExpiry" <= 30 THEN '30 days' WHEN x."daysToExpiry" <= 60 THEN '60 days' ELSE '90 days' END AS bucket FROM (
  SELECT p.policy_number AS "policyNumber", p.expiry_date AS "expiryDate", (p.expiry_date - $2::date) AS "daysToExpiry",
    u.display_name AS coordinator, ${POLICY_DIMS}, c.phone AS mobile, c.email,
    NULLIF(concat_ws(' ', ${vehicle('modelYear')}, upper(${BRAND}), ${vehicle('vehicleModel')}, ${vehicle('modelVariant')}), '') AS vehicle,
    ${vehicle('plateNumber')} AS "plateNumber", ${vehicle('chassisNumber')} AS "chassisNumber", COALESCE(${vehicle('motorNumber')}, ${vehicle('engineNumber')}) AS "engineNumber",
    ${PRODUCT_LINE} AS "productLine", p.sum_insured AS "sumInsured", p.premium_total AS premium,
    ${NOTICE_TREATMENT} AS "noticeTreatment",
    tb.outcome AS "talkbotOutcome"
  FROM policies p ${POLICY_JOINS}
  LEFT JOIN policy_lock_ins lk ON lk.policy_id = p.id
  LEFT JOIN LATERAL (SELECT CASE l.outcome WHEN 'not-called' THEN 'Not called' WHEN 'willing' THEN 'Willing to renew' WHEN 'not-willing' THEN 'Not willing to renew'
      WHEN 'already-renewed' THEN 'Already renewed' WHEN 'call-back' THEN 'Call back' WHEN 'wrong-contact' THEN 'Wrong contact' WHEN 'uncontacted' THEN 'Uncontacted'
      WHEN 'missed-call' THEN 'Missed call' ELSE l.outcome END AS outcome
      FROM talkbot_call_lines l JOIN talkbot_call_lists tl ON tl.id = l.list_id
     WHERE l.policy_id = p.id AND l.line_status = 'active' AND tl.status <> 'cancelled' ORDER BY tl.created_at DESC LIMIT 1) tb ON true
  WHERE p.status NOT IN ('cancelled', 'expired', 'lapsed') AND p.renewed_to IS NULL
    AND p.expiry_date BETWEEN $2::date AND $2::date + 90
) x`;

export const SALES_QUERIES = {
  aprOperation: {
    sql: aprOperation, extras: [setting('reports.apr_home_brands', ['Toyota', 'Lexus'], 'text[]')],
    filters: ['agent', 'insurer', 'branch', 'product'],
    criteria: {
      'Month to Date': { where: 't."inceptionDate" >= date_trunc(\'month\', $2::date)::date', dims: ['category'] },
      'Year to Date': { where: 't."inceptionDate" >= date_trunc(\'year\', $2::date)::date', dims: ['category'] },
      'Month to Date by Product Line': { where: 't."inceptionDate" >= date_trunc(\'month\', $2::date)::date', dims: ['category', 'productLine'] },
      'Year to Date by Product Line': { where: 't."inceptionDate" >= date_trunc(\'year\', $2::date)::date', dims: ['category', 'productLine'] },
      'Period by Month': { where: 't."inceptionDate" >= $1::date', dims: ['month', 'category'] },
    },
    aggregate: { policies: 'count(*)', sumInsured: 'sum(t."sumInsured")', premium: 'sum(t.premium)', commission: 'sum(t.commission)' },
    orderBy: (dims) => dims.map((d) => (d === 'category' ? APR_ORDER : `f."${d}"`)).join(', '),
  },
  productionByLine: {
    sql: productionByLine, filters: ['agent', 'insurer', 'branch', 'product'],
    criteria: {
      'Product Line': { dims: ['productLine'] }, 'Product Line by Month': { dims: ['month', 'productLine'] },
      Product: { dims: ['productLine', 'product'] }, 'Business Type': { dims: ['productLine', 'businessType'] },
    },
    aggregate: { policies: 'count(*)', sumInsured: 'sum(t."sumInsured")', premium: 'sum(t.premium)', commission: 'sum(t.commission)' },
  },
  agentConversion: {
    sql: agentConversion, filters: ['agent', 'branch'],
    criteria: { 'Agent by Month': { dims: ['agent', 'month'] }, Agent: { dims: ['agent'] }, 'Branch by Month': { dims: ['branch', 'month'] } },
    aggregate: {
      prospects: "count(*) FILTER (WHERE t.kind = 'lead')", converted: "count(*) FILTER (WHERE t.kind = 'lead' AND t.converted)",
      quotations: "count(*) FILTER (WHERE t.kind = 'quote')", policies: "count(*) FILTER (WHERE t.kind = 'policy')",
      accounts: "count(DISTINCT t.\"clientId\") FILTER (WHERE t.kind = 'policy')",
      conversionRate: "round(100.0 * count(*) FILTER (WHERE t.kind = 'policy') / NULLIF(count(*) FILTER (WHERE t.kind = 'quote'), 0), 2)",
      premium: 'sum(t.premium)', commission: 'sum(t.commission)',
      tier: "string_agg(DISTINCT t.tier, ', ') FILTER (WHERE t.tier IS NOT NULL)", incentive: 'sum(t.payout)',
    },
    summary: { conversionRate: 'round(100.0 * sum(f.policies) / NULLIF(sum(f.quotations), 0), 2)' },
  },
  renewalNotice: {
    sql: renewalNotice, filters: ['agent', 'insurer', 'branch', 'client', 'product'],
    extras: [setting('lockin.blocking_loan_statuses', ['past-due', 'fraud', 'terminated', 'legal-dispute'], 'text[]'), setting('lockin.suppress_scheme2_motor', true, 'boolean')],
    criteria: {
      All: { groupBy: 'bucket' }, '30 Days': { where: 't.bucket = \'30 days\'' }, '60 Days': { where: 't.bucket = \'60 days\'' }, '90 Days': { where: 't.bucket = \'90 days\'' },
      'Suppressed or Held': { where: 't."noticeTreatment" <> \'Send\'' },
    },
    orderBy: 'f."expiryDate", f."policyNumber"',
    summary: { suppressed: 'count(*) FILTER (WHERE f."noticeTreatment" <> \'Send\')' },
  },
};
