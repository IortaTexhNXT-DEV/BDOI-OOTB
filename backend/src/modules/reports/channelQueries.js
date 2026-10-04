/**
 * Distribution channel reports (merged into QUERIES): Dealer Production (Reports > Operational Reports > Dealer
 * Production). One row per prospect, quotation and policy brought by a channel (kind), dated by its creation (prospect,
 * quotation) or inception (policy); the report counts them and totals the policies' sum insured, premium and
 * commission per channel, per dealer group (the top of the channel's hierarchy) or per channel type.
 */
const TYPE_LABEL = `CASE ch.channel_type WHEN 'dealer_group' THEN 'Dealer group' WHEN 'dealer_branch' THEN 'Dealer branch'
  WHEN 'financing_bank' THEN 'Financing bank' WHEN 'bank_branch' THEN 'Bank branch' ELSE 'Affinity partner' END`;
const CHANNEL_JOINS = `JOIN distribution_channels ch ON ch.id = x.channel_id
  LEFT JOIN distribution_channels pc ON pc.id = ch.parent_id
  LEFT JOIN distribution_channels gc ON gc.id = pc.parent_id`;

const dealerProduction = `SELECT COALESCE(gc.name, pc.name, ch.name) AS "dealerGroup", ch.name AS channel, ${TYPE_LABEL} AS "channelType",
    x.kind, x.sum_insured AS "sumInsured", x.premium, x.commission,
    pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product,
    ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer,
    COALESCE(ch.branch_code, u.branch_code) AS _branch_code, COALESCE(b.name, ch.branch_code, u.branch_code) AS branch
  FROM (
    SELECT 'lead' AS kind, l.channel_id, l.product_id, NULL::int AS insurance_company_id, l.owner_user_id, 0::numeric AS sum_insured, 0::numeric AS premium, 0::numeric AS commission
      FROM leads l WHERE l.channel_id IS NOT NULL AND l.deleted_at IS NULL AND l.created_at::date BETWEEN $1 AND $2
    UNION ALL
    SELECT 'quote', q.channel_id, q.product_id, q.insurance_company_id, q.agent_user_id, 0, 0, 0
      FROM quotes q WHERE q.channel_id IS NOT NULL AND q.deleted_at IS NULL AND q.created_at::date BETWEEN $1 AND $2
    UNION ALL
    SELECT 'policy', p.channel_id, p.product_id, p.insurance_company_id, p.owner_user_id, p.sum_insured, p.premium_total, p.commission_amount
      FROM policies p WHERE p.channel_id IS NOT NULL AND p.status <> 'cancelled' AND p.inception_date BETWEEN $1 AND $2
  ) x ${CHANNEL_JOINS}
  LEFT JOIN products pr ON pr.id = x.product_id
  LEFT JOIN insurance_companies ic ON ic.id = x.insurance_company_id
  LEFT JOIN users u ON u.id = x.owner_user_id
  LEFT JOIN branches b ON b.code = COALESCE(ch.branch_code, u.branch_code)`;

export const CHANNEL_QUERIES = {
  dealerProduction: {
    sql: dealerProduction,
    filters: ['product', 'insurer', 'branch'],
    criteria: { Channel: { dims: ['dealerGroup', 'channel', 'channelType'] }, 'Dealer Group': { dims: ['dealerGroup'] }, 'Channel Type': { dims: ['channelType'] } },
    aggregate: {
      leads: "count(*) FILTER (WHERE t.kind = 'lead')", quotations: "count(*) FILTER (WHERE t.kind = 'quote')", policies: "count(*) FILTER (WHERE t.kind = 'policy')",
      sumInsured: 'sum(t."sumInsured")', premium: 'sum(t.premium)', commission: 'sum(t.commission)',
    },
    summary: { conversionRate: 'round(100.0 * sum(f.policies) / NULLIF(sum(f.leads), 0), 2)' },
  },
};
