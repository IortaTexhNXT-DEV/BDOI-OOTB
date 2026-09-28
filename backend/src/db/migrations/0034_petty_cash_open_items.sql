-- Petty cash: funds (initiate), requests (maker-checker), disbursements, receipts (cash returned), replenishments
CREATE TABLE IF NOT EXISTS petty_cash_funds (
  id text PRIMARY KEY DEFAULT ('pcf_' || encode(gen_random_bytes(8), 'hex')),
  code text NOT NULL UNIQUE, description text,
  transaction_number text, transaction_date date NOT NULL DEFAULT current_date,
  fund_size numeric(14,2) NOT NULL CHECK (fund_size > 0), max_limit numeric(14,2) NOT NULL DEFAULT 0,
  minimum_cashbox numeric(14,2) NOT NULL DEFAULT 0, available_cash numeric(14,2) NOT NULL DEFAULT 0,
  bank_code text, bank_account_code text, main_account text, sub_account text,
  currency text NOT NULL DEFAULT 'PHP', branch_code text, department_code text,
  custodian_user_id text REFERENCES users(id),
  status text NOT NULL DEFAULT 'active', journal_id text REFERENCES journal_vouchers(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS petty_cash_requests (
  id text PRIMARY KEY DEFAULT ('pcr_' || encode(gen_random_bytes(8), 'hex')),
  request_number text UNIQUE, fund_id text NOT NULL REFERENCES petty_cash_funds(id),
  requester_name text NOT NULL, requester_user_id text REFERENCES users(id),
  request_date date NOT NULL DEFAULT current_date, department_code text, branch_code text, purpose text,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',             -- draft | submitted | approved | rejected | disbursed
  approved_by text, approved_at timestamptz, rejected_by text, rejected_at timestamptz, rejection_reason text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS petty_cash_request_lines (
  id bigserial PRIMARY KEY, request_id text NOT NULL REFERENCES petty_cash_requests(id) ON DELETE CASCADE,
  narration text NOT NULL, amount numeric(14,2) NOT NULL CHECK (amount > 0), expense_account text);
CREATE TABLE IF NOT EXISTS petty_cash_disbursements (
  id text PRIMARY KEY DEFAULT ('pcd_' || encode(gen_random_bytes(8), 'hex')),
  transaction_number text UNIQUE, transaction_code text, fund_id text NOT NULL REFERENCES petty_cash_funds(id),
  request_id text REFERENCES petty_cash_requests(id), criteria text,
  expense_account text NOT NULL, amount numeric(14,2) NOT NULL CHECK (amount > 0),
  vat numeric(14,2) NOT NULL DEFAULT 0, wht numeric(14,2) NOT NULL DEFAULT 0, net_amount numeric(14,2) NOT NULL,
  vat_account text, wht_account text, remarks text, disbursement_date date NOT NULL DEFAULT current_date,
  journal_id text REFERENCES journal_vouchers(id), status text NOT NULL DEFAULT 'posted',
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS petty_cash_receipts (
  id text PRIMARY KEY DEFAULT ('pcrc_' || encode(gen_random_bytes(8), 'hex')),
  receipt_number text UNIQUE, transaction_number text, transaction_code text,
  fund_id text NOT NULL REFERENCES petty_cash_funds(id), requester_name text, branch_code text, bank_code text,
  credit_account text NOT NULL, amount numeric(14,2) NOT NULL CHECK (amount > 0), remarks text,
  receipt_date date NOT NULL DEFAULT current_date, journal_id text REFERENCES journal_vouchers(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS petty_cash_replenishments (
  id text PRIMARY KEY DEFAULT ('pcp_' || encode(gen_random_bytes(8), 'hex')),
  transaction_number text UNIQUE, transaction_code text,
  fund_id text NOT NULL REFERENCES petty_cash_funds(id), branch_code text, bank_code text, sub_account text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0), replenish_date date NOT NULL DEFAULT current_date, remarks text,
  journal_id text REFERENCES journal_vouchers(id), created_by text, created_at timestamptz NOT NULL DEFAULT now());

-- Agent calendar events shown on Open Items (upcoming events card)
CREATE TABLE IF NOT EXISTS agent_events (
  id text PRIMARY KEY DEFAULT ('evt_' || encode(gen_random_bytes(8), 'hex')),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_date date NOT NULL, start_time text, end_time text, description text NOT NULL,
  entity text, entity_id text, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now());
