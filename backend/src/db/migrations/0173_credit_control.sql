-- Credit control on broker-billed business:
--   premium_instalment_plans / premium_instalments   payment schedule of a premium bill (receivable); the bill stays one
--                                                     receivable in the ledger, the instalments split its amount by due date
--   premium_warranty_extensions                       extension of the premium payment warranty of a policy (maker-checker)
--   premium_warranty_actions                          reminders, extensions and cancellation requests from the warranty monitor
--   clients.credit_limit / client_credit_exceptions  exposure limit per client and the policies issued beyond it
-- Remittance due dates now follow the insurer's remittance_terms_days (fallback remittance.default_due_days).
CREATE TABLE IF NOT EXISTS premium_instalment_plans (
  id text PRIMARY KEY DEFAULT ('ipl_' || encode(gen_random_bytes(8), 'hex')),
  policy_id text NOT NULL REFERENCES policies(id),
  receivable_id text NOT NULL REFERENCES receivables(id),
  frequency text NOT NULL DEFAULT 'monthly',            -- a key of credit.instalment_frequencies, or custom (edited dates)
  instalment_count int NOT NULL CHECK (instalment_count BETWEEN 1 AND 60),
  first_due_date date NOT NULL,
  down_payment numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_by text, cancelled_at timestamptz, cancel_reason text);
CREATE UNIQUE INDEX IF NOT EXISTS premium_instalment_plans_active_uq ON premium_instalment_plans(receivable_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS premium_instalment_plans_policy ON premium_instalment_plans(policy_id);

CREATE TABLE IF NOT EXISTS premium_instalments (
  id bigserial PRIMARY KEY,
  plan_id text NOT NULL REFERENCES premium_instalment_plans(id) ON DELETE CASCADE,
  seq int NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  remarks text,
  UNIQUE (plan_id, seq));

CREATE TABLE IF NOT EXISTS premium_warranty_extensions (
  id bigserial PRIMARY KEY,
  policy_id text NOT NULL REFERENCES policies(id),
  current_deadline date NOT NULL,
  requested_deadline date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by text, requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text, decided_at timestamptz, decision_remarks text,
  CHECK (requested_deadline > current_deadline));
CREATE INDEX IF NOT EXISTS premium_warranty_extensions_policy ON premium_warranty_extensions(policy_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS premium_warranty_extensions_pending_uq ON premium_warranty_extensions(policy_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS premium_warranty_actions (
  id bigserial PRIMARY KEY,
  policy_id text NOT NULL REFERENCES policies(id),
  action text NOT NULL CHECK (action IN ('reminder', 'extension-requested', 'extension-approved', 'extension-rejected', 'cancellation-requested')),
  notes text,
  extension_id bigint REFERENCES premium_warranty_extensions(id),
  endorsement_id text,                                  -- the cancellation request raised for Operations
  email_id text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS premium_warranty_actions_policy ON premium_warranty_actions(policy_id, created_at DESC);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limit numeric(16,2) CHECK (credit_limit IS NULL OR credit_limit >= 0);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limit_updated_by text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limit_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS client_credit_exceptions (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  policy_id text REFERENCES policies(id),
  credit_limit numeric(16,2) NOT NULL,
  exposure_before numeric(16,2) NOT NULL,
  new_amount numeric(16,2) NOT NULL,
  exposure_after numeric(16,2) NOT NULL,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by text, acknowledged_at timestamptz, remarks text);
CREATE INDEX IF NOT EXISTS client_credit_exceptions_client ON client_credit_exceptions(client_id, created_at DESC);

INSERT INTO permissions(code, module, description) VALUES
 ('approve:credit-control', 'collections', 'Approve premium warranty extensions and set client credit limits (maker-checker: not the requester)')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code IN ('accounting-manager', 'system-admin') AND p.code = 'approve:credit-control'
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('credit.instalment_frequencies', '{"monthly":1,"quarterly":3,"semi-annual":6}', 'credit', 'Instalment plan frequencies: name -> months between instalments', 'json'),
 ('credit.default_instalment_count', '4', 'credit', 'Number of instalments proposed for a new instalment plan', 'number'),
 ('credit.max_instalment_count', '12', 'credit', 'Largest number of instalments a plan may have', 'number'),
 ('credit.warranty_warning_days', '7', 'credit', 'Premium warranty monitor: days before the warranty deadline from which an unpaid policy is shown as at risk', 'number'),
 ('credit.max_warranty_extension_days', '90', 'credit', 'Largest premium warranty extension (days after the policy inception) an approver may grant', 'number'),
 ('credit.check_credit_limit', 'true', 'credit', 'Warn Accounting when a new broker-billed policy takes a client over its credit limit', 'boolean')
ON CONFLICT (key) DO NOTHING;
