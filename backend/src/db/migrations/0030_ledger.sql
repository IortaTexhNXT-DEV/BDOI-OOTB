-- Double-entry general ledger: chart of accounts, accounting periods, journals (journal_vouchers + journal_lines
-- from 0004 are the single journal store for manual JVs and system postings), open-item matching.
CREATE TABLE IF NOT EXISTS gl_accounts (
  code text PRIMARY KEY,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','income','expense')),
  parent_code text REFERENCES gl_accounts(code),
  category text,                                   -- e.g. Premiums Receivable, Commission Accrued
  is_open_item boolean NOT NULL DEFAULT false,     -- lines on this account take part in open-entry matching
  allow_manual boolean NOT NULL DEFAULT true,      -- may be used on manual journal vouchers
  status text NOT NULL DEFAULT 'active',           -- active | inactive
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS accounting_periods (
  period text PRIMARY KEY CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),   -- YYYY-MM
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by text, closed_at timestamptz, reopened_by text, reopened_at timestamptz, remarks text,
  updated_at timestamptz NOT NULL DEFAULT now());

-- Journal header: status draft | for-approval | pending | posted | reversed | cancelled | rejected
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';   -- manual | booking | receipt | payment | disbursement | commission | petty-cash | reversal | correction
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard';   -- standard | reversal | correction
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS transaction_code text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS entry_type text;          -- NEW_BUSINESS | PAYMENT_RECEIPT | REMITTANCE | ...
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS entry_sub_type text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS reference_type text;      -- Policy | Receipt | Disbursement | Commission | PettyCash | JournalVoucher
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id);
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS policy_id text REFERENCES policies(id);
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PHP';
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS period text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS posted_by text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS reversal_of text REFERENCES journal_vouchers(id);
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS reversed_by_jv text REFERENCES journal_vouchers(id);
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS correction_of text REFERENCES journal_vouchers(id);
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS rejected_by text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS line_no int NOT NULL DEFAULT 1;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS main_account text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS sub_account text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS main_account_description text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS sub_account_description text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS branch_code text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS branch_description text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS department_code text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS department_description text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS foreign_amount numeric(14,2);
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS exchange_rate numeric(18,6) NOT NULL DEFAULT 1;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id);
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS policy_id text REFERENCES policies(id);
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_one_side CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS journal_lines_jv_idx ON journal_lines(jv_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines(account_code);
CREATE INDEX IF NOT EXISTS journal_lines_client_idx ON journal_lines(client_id);
CREATE INDEX IF NOT EXISTS journal_vouchers_ref_idx ON journal_vouchers(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS journal_vouchers_policy_idx ON journal_vouchers(policy_id);
CREATE INDEX IF NOT EXISTS journal_vouchers_status_idx ON journal_vouchers(status, jv_date);

-- A journal can only become 'posted' when it is balanced, non-empty and its period is open.
CREATE OR REPLACE FUNCTION jv_check_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d numeric; c numeric; n int; st text;
BEGIN
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0), count(*) INTO d, c, n FROM journal_lines WHERE jv_id = NEW.id;
    IF n < 2 OR d <> c OR d = 0 THEN
      RAISE EXCEPTION 'journal % is not balanced (debit %, credit %, lines %)', NEW.id, d, c, n USING ERRCODE = 'check_violation';
    END IF;
    SELECT status INTO st FROM accounting_periods WHERE period = to_char(NEW.jv_date, 'YYYY-MM');
    IF st = 'closed' THEN
      RAISE EXCEPTION 'accounting period % is closed', to_char(NEW.jv_date, 'YYYY-MM') USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS jv_check_posting_trg ON journal_vouchers;
CREATE TRIGGER jv_check_posting_trg BEFORE UPDATE OF status ON journal_vouchers FOR EACH ROW EXECUTE FUNCTION jv_check_posting();

-- Open-entry matching (debit line against credit line on the same open-item account)
CREATE TABLE IF NOT EXISTS entry_matches (
  id text PRIMARY KEY DEFAULT ('mt_' || encode(gen_random_bytes(8), 'hex')),
  debit_line_id bigint NOT NULL REFERENCES journal_lines(id),
  credit_line_id bigint NOT NULL REFERENCES journal_lines(id),
  matched_amount numeric(14,2) NOT NULL CHECK (matched_amount > 0),
  adjustment_amount numeric(14,2),
  document_ref text, narration text, write_off_code text,
  status text NOT NULL DEFAULT 'active',           -- active | unmatched
  matched_by text, matched_at timestamptz NOT NULL DEFAULT now(),
  unmatched_by text, unmatched_at timestamptz);
CREATE INDEX IF NOT EXISTS entry_matches_debit_idx ON entry_matches(debit_line_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS entry_matches_credit_idx ON entry_matches(credit_line_id) WHERE status = 'active';
