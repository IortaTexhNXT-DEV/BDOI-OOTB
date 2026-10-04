/**
 * Curated datasets of the Report Builder (Reports > Report Builder) and the BI extract. Each dataset is one base query
 * with named columns: users choose among these columns only (never free SQL), so a report cannot read outside them.
 * A dataset names the permission needed to use it and the record-scope entity that limits a scoped user to their own
 * book (lib/scope.js).
 *
 * Column: { key, label, type: text | integer | number | money | date, sql }. Filter operators by type in OPERATORS.
 */
const POLICY_JOINS = `LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN users u ON u.id = p.owner_user_id LEFT JOIN branches b ON b.code = u.branch_code
  LEFT JOIN distribution_channels ch ON ch.id = p.channel_id`;

export const DATASETS = {
  policies: {
    label: 'Policies', permission: 'read:policies', scope: { entity: 'policy', alias: 'p' }, from: `policies p ${POLICY_JOINS}`,
    columns: [
      { key: 'policyNumber', label: 'Policy No.', type: 'text', sql: 'p.policy_number' },
      { key: 'status', label: 'Status', type: 'text', sql: 'p.status' },
      { key: 'businessType', label: 'Business Type', type: 'text', sql: "CASE WHEN p.renewed_from IS NULL THEN 'New Business' ELSE 'Renewal' END" },
      { key: 'lob', label: 'Line of Business', type: 'text', sql: 'p.lob' },
      { key: 'product', label: 'Product', type: 'text', sql: 'COALESCE(pr.name, p.product_type)' },
      { key: 'insurer', label: 'Insurer', type: 'text', sql: 'ic.name' },
      { key: 'clientCode', label: 'Client Code', type: 'text', sql: 'c.client_code' },
      { key: 'client', label: 'Client', type: 'text', sql: 'COALESCE(p.insured_name, c.display_name)' },
      { key: 'clientType', label: 'Client Type', type: 'text', sql: 'c.client_type' },
      { key: 'province', label: 'Province', type: 'text', sql: 'c.state' },
      { key: 'city', label: 'City / Municipality', type: 'text', sql: 'c.city' },
      { key: 'agent', label: 'Account Executive', type: 'text', sql: 'u.display_name' },
      { key: 'branch', label: 'Branch', type: 'text', sql: 'COALESCE(b.name, u.branch_code)' },
      { key: 'channel', label: 'Distribution Channel', type: 'text', sql: 'ch.name' },
      { key: 'issueDate', label: 'Issue Date', type: 'date', sql: 'COALESCE(p.issued_date, p.created_at::date)' },
      { key: 'inceptionDate', label: 'Inception', type: 'date', sql: 'p.inception_date' },
      { key: 'expiryDate', label: 'Expiry', type: 'date', sql: 'p.expiry_date' },
      { key: 'issueMonth', label: 'Issue Month', type: 'text', sql: "to_char(COALESCE(p.issued_date, p.created_at::date), 'YYYY-MM')" },
      { key: 'sumInsured', label: 'Sum Insured', type: 'money', sql: 'p.sum_insured' },
      { key: 'netPremium', label: 'Net Premium', type: 'money', sql: 'p.net_premium' },
      { key: 'grossPremium', label: 'Gross Premium', type: 'money', sql: 'p.premium_total' },
      { key: 'commission', label: 'Commission', type: 'money', sql: 'p.commission_amount' },
      { key: 'billingMode', label: 'Billing Mode', type: 'text', sql: "CASE p.billing_mode WHEN 'direct' THEN 'Direct bill' ELSE 'Broker billed' END" },
      { key: 'paymentStatus', label: 'Payment Status', type: 'text', sql: 'p.payment_status' },
      { key: 'currency', label: 'Currency', type: 'text', sql: 'p.currency' },
      { key: 'policies', label: 'Policies (count)', type: 'integer', sql: '1' },
    ],
  },
  clients: {
    label: 'Clients', permission: 'read:clients', scope: { entity: 'client', alias: 'c' },
    from: 'clients c LEFT JOIN users u ON u.id = c.owner_user_id LEFT JOIN branches b ON b.code = u.branch_code',
    where: 'c.anonymised_at IS NULL',
    columns: [
      { key: 'clientCode', label: 'Client Code', type: 'text', sql: 'c.client_code' },
      { key: 'name', label: 'Name', type: 'text', sql: 'c.display_name' },
      { key: 'clientType', label: 'Client Type', type: 'text', sql: 'c.client_type' },
      { key: 'category', label: 'Category', type: 'text', sql: 'c.lead_category' },
      { key: 'email', label: 'E-mail', type: 'text', sql: 'c.email' },
      { key: 'phone', label: 'Phone', type: 'text', sql: 'c.phone' },
      { key: 'city', label: 'City / Municipality', type: 'text', sql: 'c.city' },
      { key: 'province', label: 'Province', type: 'text', sql: 'c.state' },
      { key: 'region', label: 'Region', type: 'text', sql: 'c.region' },
      { key: 'source', label: 'Source', type: 'text', sql: 'c.source' },
      { key: 'status', label: 'Status', type: 'text', sql: 'c.status' },
      { key: 'owner', label: 'Account Executive', type: 'text', sql: 'u.display_name' },
      { key: 'branch', label: 'Branch', type: 'text', sql: 'COALESCE(b.name, u.branch_code)' },
      { key: 'createdDate', label: 'Client Since', type: 'date', sql: 'c.created_at::date' },
      { key: 'activePolicies', label: 'Active Policies', type: 'integer', sql: "(SELECT count(*) FROM policies x WHERE x.client_id = c.id AND x.status IN ('active', 'issued'))" },
      { key: 'premiumInForce', label: 'Premium in Force', type: 'money', sql: "(SELECT COALESCE(sum(x.premium_total), 0) FROM policies x WHERE x.client_id = c.id AND x.status IN ('active', 'issued'))" },
      { key: 'creditLimit', label: 'Credit Limit', type: 'money', sql: 'c.credit_limit' },
      { key: 'clients', label: 'Clients (count)', type: 'integer', sql: '1' },
    ],
  },
  bills: {
    label: 'Bills (premium receivables)', permission: 'read:receipts', scope: { entity: 'policy', alias: 'p' },
    from: 'receivables r JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = r.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN users u ON u.id = p.owner_user_id',
    columns: [
      { key: 'billNumber', label: 'Bill No.', type: 'text', sql: 'r.bill_number' },
      { key: 'policyNumber', label: 'Policy No.', type: 'text', sql: 'p.policy_number' },
      { key: 'client', label: 'Billed To', type: 'text', sql: 'c.display_name' },
      { key: 'insurer', label: 'Insurer', type: 'text', sql: 'ic.name' },
      { key: 'agent', label: 'Account Executive', type: 'text', sql: 'u.display_name' },
      { key: 'source', label: 'Source', type: 'text', sql: 'r.source' },
      { key: 'billDate', label: 'Bill Date', type: 'date', sql: 'r.created_at::date' },
      { key: 'billMonth', label: 'Bill Month', type: 'text', sql: "to_char(r.created_at, 'YYYY-MM')" },
      { key: 'dueDate', label: 'Due Date', type: 'date', sql: 'r.due_date' },
      { key: 'status', label: 'Status', type: 'text', sql: 'r.status' },
      { key: 'ageingBucket', label: 'Ageing Bucket', type: 'text', sql: 'r.ageing_bucket' },
      { key: 'ageDays', label: 'Age (days)', type: 'integer', sql: 'r.age_days' },
      { key: 'netPremium', label: 'Net Premium', type: 'money', sql: 'r.net_premium' },
      { key: 'vat', label: 'VAT', type: 'money', sql: 'r.vat' },
      { key: 'dst', label: 'DST', type: 'money', sql: 'r.dst' },
      { key: 'lgt', label: 'LGT', type: 'money', sql: 'r.lgt' },
      { key: 'amount', label: 'Amount', type: 'money', sql: 'r.amount' },
      { key: 'balance', label: 'Balance', type: 'money', sql: 'r.balance' },
      { key: 'commission', label: 'Commission', type: 'money', sql: 'r.commission_amount' },
      { key: 'currency', label: 'Currency', type: 'text', sql: 'r.currency' },
      { key: 'bills', label: 'Bills (count)', type: 'integer', sql: '1' },
    ],
  },
  claims: {
    label: 'Claims', permission: 'read:claims', scope: { entity: 'claim', alias: 'cl' },
    from: 'claims cl LEFT JOIN policies p ON p.id = cl.policy_id LEFT JOIN clients c ON c.id = cl.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN users h ON h.id = cl.handler_user_id',
    columns: [
      { key: 'claimNumber', label: 'Claim No.', type: 'text', sql: 'cl.claim_number' },
      { key: 'policyNumber', label: 'Policy No.', type: 'text', sql: 'p.policy_number' },
      { key: 'client', label: 'Client', type: 'text', sql: 'c.display_name' },
      { key: 'insurer', label: 'Insurer', type: 'text', sql: 'ic.name' },
      { key: 'lob', label: 'Line of Business', type: 'text', sql: 'COALESCE(cl.lob, p.lob)' },
      { key: 'claimType', label: 'Claim Type', type: 'text', sql: 'cl.claim_type' },
      { key: 'lossType', label: 'Loss Type', type: 'text', sql: 'cl.loss_type' },
      { key: 'status', label: 'Status', type: 'text', sql: 'cl.status' },
      { key: 'priority', label: 'Priority', type: 'text', sql: 'cl.priority' },
      { key: 'handler', label: 'Handler', type: 'text', sql: 'h.display_name' },
      { key: 'lossDate', label: 'Loss Date', type: 'date', sql: 'cl.loss_date' },
      { key: 'reportedDate', label: 'Reported', type: 'date', sql: 'cl.reported_date' },
      { key: 'reportedMonth', label: 'Reported Month', type: 'text', sql: "to_char(cl.reported_date, 'YYYY-MM')" },
      { key: 'lossProvince', label: 'Loss Province', type: 'text', sql: 'cl.loss_province' },
      { key: 'estimate', label: 'Estimate', type: 'money', sql: 'cl.estimate_amount' },
      { key: 'approved', label: 'Approved', type: 'money', sql: 'cl.approved_amount' },
      { key: 'settled', label: 'Settled', type: 'money', sql: 'cl.settled_amount' },
      { key: 'settledDate', label: 'Settled On', type: 'date', sql: 'cl.settled_at::date' },
      { key: 'claims', label: 'Claims (count)', type: 'integer', sql: '1' },
    ],
  },
  commissions: {
    label: 'Commissions', permission: 'read:commission', scope: { entity: 'commission', alias: 'cm' },
    from: 'commissions cm LEFT JOIN commission_referrers rf ON rf.id = cm.referrer_id LEFT JOIN users u ON u.id = cm.agent_user_id LEFT JOIN policies p ON p.id = cm.policy_id',
    columns: [
      { key: 'policyNumber', label: 'Policy No.', type: 'text', sql: 'COALESCE(cm.policy_number, p.policy_number)' },
      { key: 'payee', label: 'Referrer / Agent', type: 'text', sql: 'COALESCE(rf.name, u.display_name)' },
      { key: 'payeeType', label: 'Payee Type', type: 'text', sql: "CASE WHEN cm.referrer_id IS NOT NULL THEN 'Referrer' ELSE 'Agent' END" },
      { key: 'product', label: 'Product', type: 'text', sql: 'cm.product_label' },
      { key: 'insurer', label: 'Insurer', type: 'text', sql: 'cm.insurer_label' },
      { key: 'period', label: 'Period', type: 'text', sql: 'cm.period' },
      { key: 'status', label: 'Status', type: 'text', sql: 'cm.status' },
      { key: 'grossPremium', label: 'Gross Premium', type: 'money', sql: 'cm.gross_premium' },
      { key: 'basis', label: 'Basis', type: 'money', sql: 'cm.basis_amount' },
      { key: 'rate', label: 'Rate', type: 'number', sql: 'cm.rate' },
      { key: 'amount', label: 'Commission', type: 'money', sql: 'cm.amount' },
      { key: 'withholding', label: 'Withholding Tax', type: 'money', sql: 'cm.withholding' },
      { key: 'net', label: 'Net', type: 'money', sql: 'cm.net_amount' },
      { key: 'accruedDate', label: 'Accrued On', type: 'date', sql: 'COALESCE(cm.accrued_at, cm.created_at)::date' },
      { key: 'paidDate', label: 'Paid On', type: 'date', sql: 'cm.paid_at::date' },
      { key: 'lines', label: 'Lines (count)', type: 'integer', sql: '1' },
    ],
  },
};

export const NUMERIC = new Set(['integer', 'number', 'money']);
/** Filter operators per column type. */
export const OPERATORS = {
  text: ['eq', 'neq', 'contains', 'starts', 'in', 'empty', 'notEmpty'],
  date: ['eq', 'gte', 'lte', 'between', 'empty', 'notEmpty'],
  integer: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  money: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
};

/** Datasets and their columns for the screen (no SQL). */
export const catalogue = () => Object.entries(DATASETS).map(([key, d]) => ({
  key, label: d.label, permission: d.permission, columns: d.columns.map((c) => ({ key: c.key, label: c.label, type: c.type, operators: OPERATORS[c.type] })),
}));
