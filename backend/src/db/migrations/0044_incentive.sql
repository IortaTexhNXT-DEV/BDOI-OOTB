-- Incentive programs (extends 0004), calculation batches with maker-checker approval, per-agent results.
ALTER TABLE incentive_programs
  ADD COLUMN IF NOT EXISTS program_code text,
  ADD COLUMN IF NOT EXISTS program_type text,
  ADD COLUMN IF NOT EXISTS applicable_to jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS target_metric text,
  ADD COLUMN IF NOT EXISTS stretch_target numeric(16,2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS calculation_frequency text,
  ADD COLUMN IF NOT EXISTS structure jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS eligibility jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS incentive_programs_code_uq ON incentive_programs(lower(program_code)) WHERE program_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS incentive_calculations (
  batch_id text PRIMARY KEY,                 -- CALC-2026-00001
  period text NOT NULL,                      -- label shown on screen (September 2026)
  period_from date NOT NULL,
  period_to date NOT NULL,
  programs_included jsonb NOT NULL DEFAULT '[]',
  description text,
  total_amount numeric(16,2) NOT NULL DEFAULT 0,
  agent_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Calculated', -- Calculated | Pending Approval | Approved | Rejected | Paid
  created_by text REFERENCES users(id),
  submitted_by text REFERENCES users(id), submitted_date timestamptz,
  approved_by text REFERENCES users(id), approval_date timestamptz,
  rejected_by text REFERENCES users(id), rejection_date timestamptz, rejection_reason text,
  payment_date date, payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incentive_results
  ADD COLUMN IF NOT EXISTS calculation_id text REFERENCES incentive_calculations(batch_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target numeric(16,2),
  ADD COLUMN IF NOT EXISTS achievement_percent numeric(10,2),
  ADD COLUMN IF NOT EXISTS base_incentive numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustments numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS incentive_results_agent_idx ON incentive_results(agent_user_id, period);
