-- Posting rules: every system journal is built from the active rule of its business event (event code) instead of
-- hard-coded debit / credit lines. A rule is versioned: editing creates a new version effective from a date, earlier
-- versions stay for audit and for postings dated before the change. Rule lines reference GL accounts by account role
-- (accounting.account.<role> settings = the Account Determination screen), by fixed GL code, by a resolver (bank account
-- of the receipt, payable account of the payee type, write-off reason ...) or by an account the operation supplies.
CREATE TABLE posting_rules (
  id serial PRIMARY KEY,
  event_code text NOT NULL,
  version int NOT NULL DEFAULT 1,
  name text NOT NULL,
  description text,
  module text,
  entry_type text,                                  -- default journal entry type (the operation may override it)
  source text,                                      -- default journal source
  narration text,                                   -- journal description template ({{var}}) when the operation gives none
  branch_source text NOT NULL DEFAULT 'policy_owner' CHECK (branch_source IN ('none', 'context', 'policy_owner', 'user')),
  effective_from date NOT NULL DEFAULT DATE '2000-01-01',
  active boolean NOT NULL DEFAULT true,
  change_note text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_code, version));
CREATE INDEX posting_rules_event ON posting_rules(event_code, effective_from DESC, version DESC);

CREATE TABLE posting_rule_lines (
  id serial PRIMARY KEY,
  rule_id int NOT NULL REFERENCES posting_rules(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  side text NOT NULL CHECK (side IN ('Dr', 'Cr')),
  account_type text NOT NULL CHECK (account_type IN ('role', 'gl', 'resolver', 'context')),
  account text NOT NULL,                            -- role name, GL code, resolver name or context account key
  fallback_role text,                               -- context / resolver lines: role used when nothing is supplied
  amount_key text NOT NULL,                         -- one of the amount keys the event supplies
  per_participant boolean NOT NULL DEFAULT false,   -- one line per co-insurer with its share of the amount
  narration text,                                   -- line memo template ({{var}})
  UNIQUE (rule_id, line_no));

-- Write-off reasons: the GL account a write-off of an open-item balance is charged to (Open Entry Matching)
CREATE TABLE write_off_reasons (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  gl_account text NOT NULL,
  max_amount numeric(14,2),                         -- null = no limit
  description text,
  attrs jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE entry_matches ADD COLUMN IF NOT EXISTS write_off_jv_id text REFERENCES journal_vouchers(id);

-- Return premium / cancellation credits applied to a receivable (reduce its balance without cash)
CREATE TABLE receivable_credits (
  id bigserial PRIMARY KEY,
  receivable_id text REFERENCES receivables(id),
  policy_id text REFERENCES policies(id),
  endorsement_id text,
  kind text NOT NULL DEFAULT 'return-premium',     -- return-premium | cancellation
  amount numeric(14,2) NOT NULL,                     -- credited to the receivable
  refund_amount numeric(14,2) NOT NULL DEFAULT 0,    -- part payable to the client (already paid)
  journal_id text REFERENCES journal_vouchers(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX receivable_credits_policy ON receivable_credits(policy_id);

-- Co-insurance: premium collected on a co-insured policy is remitted to each participating insurer separately
CREATE TABLE remittance_allocations (
  id bigserial PRIMARY KEY,
  receipt_application_id bigint NOT NULL REFERENCES receipt_applications(id),
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  invoice_list_id text REFERENCES invoice_lists(id),
  share_percent numeric(7,4) NOT NULL,
  gross numeric(14,2) NOT NULL DEFAULT 0,
  commission numeric(14,2) NOT NULL DEFAULT 0,
  net numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (receipt_application_id, insurance_company_id));
-- Per-insurer commission booked on a co-insured bill (sub-ledger of the booking journal)
CREATE TABLE receivable_participants (
  receivable_id text NOT NULL REFERENCES receivables(id),
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  is_lead boolean NOT NULL DEFAULT false,
  share_percent numeric(7,4) NOT NULL,
  gross numeric(14,2) NOT NULL DEFAULT 0,
  commission numeric(14,2) NOT NULL DEFAULT 0,
  taxes numeric(14,2) NOT NULL DEFAULT 0,
  due_to_insurer numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (receivable_id, insurance_company_id));
-- Remittance lines of a co-insured policy carry the participant they are for
ALTER TABLE remittance_lines ADD COLUMN IF NOT EXISTS insurance_company_id int REFERENCES insurance_companies(id);
ALTER TABLE remittance_lines ADD COLUMN IF NOT EXISTS share_percent numeric(7,4);
-- Journal lines: the insurer a line is for (sub-ledger party on co-insured bookings)
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS insurance_company_id int;
-- The posting rule (version) a system journal was built from
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS posting_rule_id int REFERENCES posting_rules(id);
-- Receipts may name the bank account the money went to (its GL account is debited)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS bank_account_code text;
-- Petty cash postings can be reversed
ALTER TABLE petty_cash_disbursements ADD COLUMN IF NOT EXISTS reversal_jv_id text;
ALTER TABLE petty_cash_receipts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';
ALTER TABLE petty_cash_receipts ADD COLUMN IF NOT EXISTS reversal_jv_id text;
ALTER TABLE petty_cash_replenishments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';
ALTER TABLE petty_cash_replenishments ADD COLUMN IF NOT EXISTS reversal_jv_id text;
-- Journals of remittance items, reinsurance, incentives and claims
ALTER TABLE remittance_items ADD COLUMN IF NOT EXISTS journal_id text;
ALTER TABLE cessions ADD COLUMN IF NOT EXISTS journal_id text;
ALTER TABLE reinsurance_recoveries ADD COLUMN IF NOT EXISTS journal_id text;
ALTER TABLE incentive_calculations ADD COLUMN IF NOT EXISTS accrual_jv_id text;
ALTER TABLE incentive_calculations ADD COLUMN IF NOT EXISTS payment_jv_id text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement_jv_id text;
