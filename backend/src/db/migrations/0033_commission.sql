-- Commission referrers (agents, sub-agents, external referrers) and commission lines (commissions from 0004).
CREATE TABLE IF NOT EXISTS commission_referrers (
  id text PRIMARY KEY,                              -- slug id used in URLs, e.g. ref-dcruz
  name text NOT NULL,
  referrer_type text NOT NULL DEFAULT 'Agent',      -- Agent | Sub-agent | External
  level text,                                       -- L1 | L2 | null for external
  parent_referrer_id text REFERENCES commission_referrers(id),
  user_id text REFERENCES users(id),
  tin text, email text, phone text,
  wht_rate numeric(6,4),                            -- null = rate from app_settings for the referrer type
  wht_applicable boolean NOT NULL DEFAULT true,
  bank_name text, bank_account_no text,
  status text NOT NULL DEFAULT 'Active',            -- Active | Inactive
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- commission lines: status Accrued -> Eligible -> Approved -> Paid, or Reversed (clawback when reversed after payment)
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS referrer_id text REFERENCES commission_referrers(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS product_label text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS insurer_label text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS cycle_date date;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS gross_premium numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS discount_pct numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS net_premium numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS brokerage_pct numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS brokerage_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS comsub_fixed numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS comsub_pct numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS wht_pct numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS receipt_no text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS voucher_no text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS accrued_at timestamptz;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS eligible_at timestamptz;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS eligible_by text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS paid_by text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS reversed_by text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS clawback boolean NOT NULL DEFAULT false;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS accrual_jv_id text REFERENCES journal_vouchers(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS payment_jv_id text REFERENCES journal_vouchers(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS chain_position int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS commissions_referrer_idx ON commissions(referrer_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS commissions_policy_referrer_uq ON commissions(policy_id, referrer_id, chain_position) WHERE policy_id IS NOT NULL AND referrer_id IS NOT NULL;
