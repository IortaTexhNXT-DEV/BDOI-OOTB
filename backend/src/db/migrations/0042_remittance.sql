-- Remittance to insurers: remittances / bills (extends 0004), work items for the 16 remittance screens and the approval queue.
ALTER TABLE remittances
  ADD COLUMN IF NOT EXISTS remittance_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS policy_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustments numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS bill_number text,
  ADD COLUMN IF NOT EXISTS agent_user_id text REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS agency_code text,
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS previous_balance numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS config_code text,
  ADD COLUMN IF NOT EXISTS batch_ref text,
  ADD COLUMN IF NOT EXISTS delivery_method jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS submitted_by text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_by text;
CREATE INDEX IF NOT EXISTS remittances_status_idx ON remittances(kind, status, remittance_date);

ALTER TABLE remittance_lines
  ADD COLUMN IF NOT EXISTS policy_number text,
  ADD COLUMN IF NOT EXISTS insured_name text,
  ADD COLUMN IF NOT EXISTS product text,
  ADD COLUMN IF NOT EXISTS tax numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';

-- Work items of the remittance screens: settlement, adjustment, transfer, statement, exception, notification,
-- schedule execution, bulk upload batch, bank transaction, processing batch, report. Fields keep the screens' names.
CREATE TABLE IF NOT EXISTS remittance_items (
  id text PRIMARY KEY DEFAULT ('rmi_' || encode(gen_random_bytes(8), 'hex')),
  kind text NOT NULL,
  reference_no text UNIQUE,
  remittance_id text REFERENCES remittances(id) ON DELETE SET NULL,
  insurance_company_id int REFERENCES insurance_companies(id),
  amount numeric(16,2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  priority text,
  data jsonb NOT NULL DEFAULT '{}',
  remarks text,
  created_by text REFERENCES users(id), updated_by text,
  approved_by text, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS remittance_items_kind_idx ON remittance_items(kind, status, created_at DESC);

-- Approval queue for every remittance transaction (maker-checker: the approver differs from the initiator).
CREATE TABLE IF NOT EXISTS remittance_approvals (
  id bigserial PRIMARY KEY,
  entity text NOT NULL,                      -- remittance | item
  entity_id text NOT NULL,
  reference_no text NOT NULL,
  transaction_type text NOT NULL,            -- Direct Bill | Agency Bill | Settlement | Adjustment | Electronic Transfer | Bulk Processing
  amount numeric(16,2) NOT NULL DEFAULT 0,
  description text,
  priority text NOT NULL DEFAULT 'Normal',
  sla_hours int NOT NULL DEFAULT 24,
  current_level int NOT NULL DEFAULT 1,
  required_levels int NOT NULL DEFAULT 1,
  initiator_id text REFERENCES users(id),
  status text NOT NULL DEFAULT 'Pending',    -- Pending | Approved | Rejected | Delegated
  delegated_to text REFERENCES users(id),
  action_by text REFERENCES users(id),
  action_at timestamptz,
  remarks text,
  history jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS remittance_approvals_status_idx ON remittance_approvals(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS remittance_approvals_open_uq ON remittance_approvals(entity, entity_id) WHERE status = 'Pending';

CREATE TABLE IF NOT EXISTS remittance_delegations (
  id bigserial PRIMARY KEY,
  delegator_id text NOT NULL REFERENCES users(id),
  delegate_id text NOT NULL REFERENCES users(id),
  from_date date NOT NULL, to_date date NOT NULL,
  trans_types jsonb NOT NULL DEFAULT '["All"]',
  amount_limit numeric(16,2),
  reason text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
