-- Billing, receipts, collections, disbursement, journal vouchers, commission, remittance, reinsurance, incentive, reports
CREATE TABLE receivables (
  id text PRIMARY KEY DEFAULT ('rcv_' || encode(gen_random_bytes(8), 'hex')),
  bill_number text UNIQUE, policy_id text REFERENCES policies(id), client_id text REFERENCES clients(id),
  amount numeric(14,2) NOT NULL, balance numeric(14,2) NOT NULL,
  due_date date NOT NULL, status text NOT NULL DEFAULT 'open',   -- open | partial | paid | written-off
  age_days int NOT NULL DEFAULT 0, ageing_bucket text NOT NULL DEFAULT 'current',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE receipts (
  id text PRIMARY KEY DEFAULT ('or_' || encode(gen_random_bytes(8), 'hex')),
  receipt_number text UNIQUE, receivable_id text REFERENCES receivables(id), policy_id text REFERENCES policies(id),
  client_id text REFERENCES clients(id), amount numeric(14,2) NOT NULL,
  payment_mode text NOT NULL DEFAULT 'cash',        -- cash | check | bank-transfer | card | gcash
  reference_no text, bank_id int REFERENCES banks(id), received_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'posted',            -- posted | cancelled
  remarks text, created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE disbursements (
  id text PRIMARY KEY DEFAULT ('pv_' || encode(gen_random_bytes(8), 'hex')),
  voucher_number text UNIQUE, payee_type text NOT NULL,          -- insurer | agent | client | vendor
  payee_id text, payee_name text NOT NULL, amount numeric(14,2) NOT NULL,
  payment_mode text NOT NULL DEFAULT 'check', bank_id int REFERENCES banks(id), reference_no text,
  purpose text, status text NOT NULL DEFAULT 'draft',            -- draft | for-approval | approved | paid | rejected
  approved_by text, approved_at timestamptz, paid_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE journal_vouchers (
  id text PRIMARY KEY DEFAULT ('jv_' || encode(gen_random_bytes(8), 'hex')),
  jv_number text UNIQUE, jv_date date NOT NULL DEFAULT current_date,
  description text, status text NOT NULL DEFAULT 'draft',        -- draft | for-approval | approved | posted | rejected
  total_debit numeric(14,2) NOT NULL DEFAULT 0, total_credit numeric(14,2) NOT NULL DEFAULT 0,
  approved_by text, approved_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE journal_lines (
  id bigserial PRIMARY KEY, jv_id text NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
  account_code text NOT NULL, account_name text, debit numeric(14,2) NOT NULL DEFAULT 0, credit numeric(14,2) NOT NULL DEFAULT 0, memo text);
CREATE TABLE commissions (
  id text PRIMARY KEY DEFAULT ('cm_' || encode(gen_random_bytes(8), 'hex')),
  policy_id text REFERENCES policies(id), agent_user_id text REFERENCES users(id),
  basis_amount numeric(14,2) NOT NULL, rate numeric(6,4) NOT NULL, amount numeric(14,2) NOT NULL,
  withholding numeric(14,2) NOT NULL DEFAULT 0, net_amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'accrued',           -- accrued | payable | paid
  period text, paid_at timestamptz, disbursement_id text REFERENCES disbursements(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE remittances (
  id text PRIMARY KEY DEFAULT ('rm_' || encode(gen_random_bytes(8), 'hex')),
  remittance_number text UNIQUE, insurance_company_id int REFERENCES insurance_companies(id),
  kind text NOT NULL DEFAULT 'direct-bill',         -- direct-bill | agency-bill
  period text, gross_premium numeric(14,2) NOT NULL DEFAULT 0, commission numeric(14,2) NOT NULL DEFAULT 0,
  net_due numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',             -- draft | for-approval | approved | settled | rejected
  approved_by text, approved_at timestamptz, settled_at timestamptz, remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE remittance_lines (
  id bigserial PRIMARY KEY, remittance_id text NOT NULL REFERENCES remittances(id) ON DELETE CASCADE,
  policy_id text REFERENCES policies(id), premium numeric(14,2) NOT NULL DEFAULT 0, commission numeric(14,2) NOT NULL DEFAULT 0, net numeric(14,2) NOT NULL DEFAULT 0);
CREATE TABLE reinsurance_treaties (
  id serial PRIMARY KEY, name text NOT NULL, reinsurer text NOT NULL, security_rating text,
  treaty_type text NOT NULL DEFAULT 'quota-share', capacity numeric(16,2), share numeric(6,4),
  period_from date, period_to date, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE cessions (
  id bigserial PRIMARY KEY, treaty_id int NOT NULL REFERENCES reinsurance_treaties(id),
  policy_id text NOT NULL REFERENCES policies(id), ceded_sum numeric(14,2) NOT NULL, ceded_premium numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE incentive_programs (
  id serial PRIMARY KEY, name text NOT NULL, description text,
  metric text NOT NULL DEFAULT 'premium',           -- premium | policies | conversion
  target numeric(16,2) NOT NULL DEFAULT 0, reward text,
  period_from date, period_to date, status text NOT NULL DEFAULT 'active',
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE incentive_results (
  id bigserial PRIMARY KEY, program_id int NOT NULL REFERENCES incentive_programs(id) ON DELETE CASCADE,
  agent_user_id text NOT NULL REFERENCES users(id), achieved numeric(16,2) NOT NULL DEFAULT 0,
  payout numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'open', period text,
  UNIQUE (program_id, agent_user_id, period));
CREATE TABLE product_templates (
  id serial PRIMARY KEY, name text NOT NULL, product_id int REFERENCES products(id),
  version int NOT NULL DEFAULT 1, config jsonb NOT NULL DEFAULT '{}',   -- rating params, taxes, commission, limits, wording
  status text NOT NULL DEFAULT 'draft',             -- draft | published | retired
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE generated_reports (
  id text PRIMARY KEY DEFAULT ('rpt_' || encode(gen_random_bytes(8), 'hex')),
  code text NOT NULL, name text NOT NULL, params jsonb NOT NULL DEFAULT '{}',
  format text NOT NULL DEFAULT 'csv', storage_key text, row_count int,
  generated_by text, status text NOT NULL DEFAULT 'done', error text,
  created_at timestamptz NOT NULL DEFAULT now());
