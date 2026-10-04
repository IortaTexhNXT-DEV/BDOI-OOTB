-- Reinsurance: reinsurers, treaties (extends 0004), cessions (extends 0004), recoveries, bordereaux, reconciliation.
CREATE TABLE IF NOT EXISTS reinsurers (
  id text PRIMARY KEY,                        -- RE001 ...
  name text NOT NULL,
  short_name text,
  type text NOT NULL DEFAULT 'International', -- Local | Regional | International
  country text,
  rating text,                                -- security rating (security-rating master)
  rating_agency text,
  capacity text,
  contact jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Active',
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reinsurers_name_uq ON reinsurers(lower(name));

ALTER TABLE reinsurance_treaties
  ADD COLUMN IF NOT EXISTS treaty_number text,
  ADD COLUMN IF NOT EXISTS line_of_business text,
  ADD COLUMN IF NOT EXISTS reinsurer_ids jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS retention numeric(16,2),
  ADD COLUMN IF NOT EXISTS commission_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS submitted_by text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS reinsurance_treaties_number_uq ON reinsurance_treaties(lower(treaty_number)) WHERE treaty_number IS NOT NULL;

-- Facultative cessions and policies booked outside the system reference a policy number instead of a policy row.
ALTER TABLE cessions ALTER COLUMN policy_id DROP NOT NULL;
ALTER TABLE cessions ALTER COLUMN treaty_id DROP NOT NULL;
ALTER TABLE cessions
  ADD COLUMN IF NOT EXISTS cession_number text,
  ADD COLUMN IF NOT EXISTS policy_number text,
  ADD COLUMN IF NOT EXISTS insured text,
  ADD COLUMN IF NOT EXISTS line_of_business text,
  ADD COLUMN IF NOT EXISTS cession_type text NOT NULL DEFAULT 'Treaty',   -- Treaty | Facultative
  ADD COLUMN IF NOT EXISTS facultative_reinsurer_id text REFERENCES reinsurers(id),
  ADD COLUMN IF NOT EXISTS gross_premium numeric(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_insured numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cession_percentage numeric(8,4),
  ADD COLUMN IF NOT EXISTS commission numeric(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_premium numeric(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cession_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pending',         -- Pending | Confirmed | Rejected | Cancelled
  ADD COLUMN IF NOT EXISTS bordereau_ref text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS confirmed_by text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS cessions_number_uq ON cessions(cession_number) WHERE cession_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS reinsurance_recoveries (
  id text PRIMARY KEY DEFAULT ('rcl_' || encode(gen_random_bytes(6), 'hex')),
  recovery_number text UNIQUE,
  claim_id text REFERENCES claims(id),
  claim_number text,
  policy_number text,
  insured text,
  treaty_id int REFERENCES reinsurance_treaties(id),
  cession_id bigint REFERENCES cessions(id),
  date_of_loss date,
  cause_of_loss text,
  gross_claim numeric(16,2) NOT NULL DEFAULT 0,
  cession_percentage numeric(8,4),
  recoverable_amount numeric(16,2) NOT NULL DEFAULT 0,
  settlement_amount numeric(16,2),
  status text NOT NULL DEFAULT 'Pending',     -- Pending | Processing | Recovered | Disputed | Rejected
  submission_date date, recovery_date date, expected_settlement date,
  cash_call jsonb,
  documents jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reinsurance_bordereaux (
  id text PRIMARY KEY DEFAULT ('bdx_' || encode(gen_random_bytes(6), 'hex')),
  reference text UNIQUE NOT NULL,
  type text NOT NULL,                         -- Premium | Claims
  period text NOT NULL,                       -- YYYY-MM
  treaty_id int REFERENCES reinsurance_treaties(id),
  reinsurer_id text REFERENCES reinsurers(id),
  entries int NOT NULL DEFAULT 0,
  totals jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Draft',       -- Draft | Submitted | Confirmed
  file_key text, file_url text,
  submission_date date, confirmation_date date, due_date date,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reinsurance_reconciliations (
  id text PRIMARY KEY DEFAULT ('rrc_' || encode(gen_random_bytes(6), 'hex')),
  reference text UNIQUE,
  type text NOT NULL,                         -- Premium | Claims
  reinsurer_id text REFERENCES reinsurers(id),
  period text NOT NULL,
  our_amount numeric(16,2) NOT NULL DEFAULT 0,
  their_amount numeric(16,2) NOT NULL DEFAULT 0,
  items int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending Review',  -- Pending Review | Matched | Resolved
  resolution text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reinsurance_exceptions (
  id text PRIMARY KEY DEFAULT ('rex_' || encode(gen_random_bytes(6), 'hex')),
  date date NOT NULL DEFAULT current_date,
  type text NOT NULL,
  description text NOT NULL,
  amount numeric(16,2) NOT NULL DEFAULT 0,
  reconciliation_id text REFERENCES reinsurance_reconciliations(id),
  status text NOT NULL DEFAULT 'Under Investigation',
  resolution text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
