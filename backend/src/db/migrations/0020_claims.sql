-- Claims: registration details, adjuster report, settlement (maker-checker) and field-level audit trail.
ALTER TABLE claims ADD COLUMN IF NOT EXISTS lob text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_type text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS loss_time text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS loss_address text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS loss_city text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS loss_province text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurer_claim_number text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS is_holder_driver boolean NOT NULL DEFAULT false;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS driver jsonb NOT NULL DEFAULT '{}';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS third_party jsonb NOT NULL DEFAULT '{}';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_info jsonb NOT NULL DEFAULT '{}';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS adjuster jsonb NOT NULL DEFAULT '{}';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement jsonb NOT NULL DEFAULT '{}';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS lead_id text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS quote_id text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS rejected_reason text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement_requested_by text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement_approved_by text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement_approved_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS closed_at timestamptz;
CREATE INDEX IF NOT EXISTS claims_policy_idx ON claims(policy_id);
CREATE INDEX IF NOT EXISTS claims_client_idx ON claims(client_id);
CREATE INDEX IF NOT EXISTS claims_reported_idx ON claims(reported_date);
CREATE INDEX IF NOT EXISTS claim_history_claim_idx ON claim_history(claim_id, at);

-- Field-level trail shown on Claims > Audit trail (one row per changed field)
CREATE TABLE IF NOT EXISTS claim_field_changes (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  user_id text, username text,
  action text NOT NULL,                 -- Created | Updated | Status Changed | Settlement Submitted | ...
  field_name text, old_value text, new_value text);
CREATE INDEX IF NOT EXISTS claim_field_changes_claim_idx ON claim_field_changes(claim_id, at);
