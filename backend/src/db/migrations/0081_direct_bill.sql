-- Direct bill (D36): the client pays the premium directly to the insurer; the broker bills the insurer for its commission
-- with a commission debit note.
--   policies.billing_mode      broker (client pays the broker, who remits to the insurer) | direct (client pays the insurer)
--   endorsements.billing_mode  billing mode used for the endorsement premium change (defaults to the policy's)
--   direct_bill_items          commission due from the insurer per billing event (issue, endorsement, renewal), booked at
--                              issue: Dr Commission Receivable – Insurers / Cr Commission Income / Cr Output VAT
--   commission_debit_notes     numbered debit note to the insurer grouping unbilled items (maker-checker)
--   commission_debit_note_collections  insurer payments against a debit note (cash + creditable withholding tax)
ALTER TABLE policies ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'broker';
DO $$ BEGIN
  ALTER TABLE policies ADD CONSTRAINT policies_billing_mode_chk CHECK (billing_mode IN ('broker', 'direct'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS billing_mode text;
DO $$ BEGIN
  ALTER TABLE endorsements ADD CONSTRAINT endorsements_billing_mode_chk CHECK (billing_mode IS NULL OR billing_mode IN ('broker', 'direct'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS policies_billing_mode_idx ON policies(billing_mode) WHERE billing_mode = 'direct';

CREATE TABLE IF NOT EXISTS commission_debit_notes (
  id text PRIMARY KEY DEFAULT ('dn_' || encode(gen_random_bytes(8), 'hex')),
  dn_number text UNIQUE NOT NULL,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  period_from date, period_to date,
  dn_date date NOT NULL DEFAULT current_date,
  due_date date,
  currency text NOT NULL DEFAULT 'PHP',
  gross_premium numeric(14,2) NOT NULL DEFAULT 0,   -- premium of the policies billed (information)
  commission numeric(14,2) NOT NULL DEFAULT 0,      -- commission net of VAT
  vat numeric(14,2) NOT NULL DEFAULT 0,             -- output VAT on the commission
  amount numeric(14,2) NOT NULL DEFAULT 0,          -- total due from the insurer (commission + VAT)
  ewt_rate numeric(9,6) NOT NULL DEFAULT 0,         -- expanded withholding tax the insurer deducts (on the commission)
  expected_ewt numeric(14,2) NOT NULL DEFAULT 0,
  collected_cash numeric(14,2) NOT NULL DEFAULT 0,
  collected_ewt numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,          -- amount - collected_cash - collected_ewt
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'for-approval', 'open', 'partial', 'collected', 'rejected', 'cancelled')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text, submitted_at timestamptz,
  approved_by text, approved_at timestamptz,
  rejected_by text, rejected_at timestamptz, rejection_reason text,
  cancelled_by text, cancelled_at timestamptz,
  sent_to text, sent_at timestamptz,
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS commission_debit_notes_insurer_idx ON commission_debit_notes(insurance_company_id, status);

CREATE TABLE IF NOT EXISTS direct_bill_items (
  id text PRIMARY KEY DEFAULT ('dbi_' || encode(gen_random_bytes(8), 'hex')),
  policy_id text NOT NULL REFERENCES policies(id),
  endorsement_id text REFERENCES endorsements(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  source text NOT NULL DEFAULT 'policy',            -- policy | endorsement | renewal | billing-mode-change
  reference text,                                   -- policy / endorsement / renewal number
  booked_on date NOT NULL DEFAULT current_date,
  currency text NOT NULL DEFAULT 'PHP',
  gross_premium numeric(14,2) NOT NULL DEFAULT 0,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  commission_rate numeric(9,6),
  commission numeric(14,2) NOT NULL,                -- net of VAT; negative for a return-premium endorsement
  vat numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL,                    -- commission + VAT due from the insurer
  booking_jv_id text REFERENCES journal_vouchers(id),
  reversal_jv_id text REFERENCES journal_vouchers(id),
  debit_note_id text REFERENCES commission_debit_notes(id),
  status text NOT NULL DEFAULT 'unbilled' CHECK (status IN ('unbilled', 'billed', 'collected', 'cancelled')),
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS direct_bill_items_policy_idx ON direct_bill_items(policy_id);
CREATE INDEX IF NOT EXISTS direct_bill_items_open_idx ON direct_bill_items(insurance_company_id, status) WHERE debit_note_id IS NULL;

CREATE TABLE IF NOT EXISTS commission_debit_note_lines (
  id bigserial PRIMARY KEY,
  debit_note_id text NOT NULL REFERENCES commission_debit_notes(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES direct_bill_items(id),
  line_no int NOT NULL DEFAULT 1,
  policy_id text REFERENCES policies(id), policy_number text, reference text, insured_name text, product text, line_of_business text, inception_date date,
  gross_premium numeric(14,2) NOT NULL DEFAULT 0, commission_rate numeric(9,6),
  commission numeric(14,2) NOT NULL, vat numeric(14,2) NOT NULL DEFAULT 0, amount numeric(14,2) NOT NULL);
CREATE INDEX IF NOT EXISTS commission_debit_note_lines_dn_idx ON commission_debit_note_lines(debit_note_id);

CREATE TABLE IF NOT EXISTS commission_debit_note_collections (
  id text PRIMARY KEY DEFAULT ('dnc_' || encode(gen_random_bytes(8), 'hex')),
  collection_number text UNIQUE NOT NULL,
  debit_note_id text NOT NULL REFERENCES commission_debit_notes(id),
  received_date date NOT NULL,
  cash_amount numeric(14,2) NOT NULL CHECK (cash_amount >= 0),
  ewt_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (ewt_amount >= 0),
  applied_amount numeric(14,2) NOT NULL CHECK (applied_amount > 0),
  payment_mode text, cash_account text, reference_no text, form_2307_no text, remarks text,
  journal_id text REFERENCES journal_vouchers(id),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS commission_debit_note_collections_dn_idx ON commission_debit_note_collections(debit_note_id);
