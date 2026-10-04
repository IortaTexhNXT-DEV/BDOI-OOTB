-- Motor claims repair workflow (Operations > Motor Claim Repairs): repair estimates of an accredited repair shop
-- (Repair Shop master, generic type repair-shop), their approval by the insurer's adjuster as recorded by the claims
-- officer, supplementary estimates, the letter of authority (LOA) to the shop with the participation (deductible) of
-- the insured, and the release of the repaired vehicle.
CREATE TABLE IF NOT EXISTS claim_repair_estimates (
  id text PRIMARY KEY DEFAULT ('cre_' || encode(gen_random_bytes(8), 'hex')),
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'initial' CHECK (kind IN ('initial', 'supplementary')),
  seq int NOT NULL,
  repair_shop_code text NOT NULL,                      -- code of the repair-shop master record
  repair_shop_name text NOT NULL,
  shop_reference text,                                 -- the shop's estimate number
  estimate_date date NOT NULL,
  parts numeric(14,2) NOT NULL DEFAULT 0 CHECK (parts >= 0),
  labour numeric(14,2) NOT NULL DEFAULT 0 CHECK (labour >= 0),
  paint numeric(14,2) NOT NULL DEFAULT 0 CHECK (paint >= 0),
  other numeric(14,2) NOT NULL DEFAULT 0 CHECK (other >= 0),
  vat numeric(14,2) NOT NULL DEFAULT 0 CHECK (vat >= 0),
  total numeric(14,2) NOT NULL CHECK (total > 0),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  adjuster_name text,                                  -- the insurer's adjuster who decided
  adjuster_company text,
  approved_amount numeric(14,2),
  decided_on date,
  approval_reference text,                             -- the insurer's approval letter or e-mail reference
  decision_remarks text,
  recorded_by text, decision_recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, seq));
CREATE INDEX IF NOT EXISTS claim_repair_estimates_claim ON claim_repair_estimates(claim_id);

CREATE TABLE IF NOT EXISTS claim_loas (
  id text PRIMARY KEY DEFAULT ('loa_' || encode(gen_random_bytes(8), 'hex')),
  loa_number text NOT NULL UNIQUE,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'original' CHECK (kind IN ('original', 'supplementary')),
  repair_shop_code text NOT NULL,
  repair_shop_name text NOT NULL,
  estimate_ids text[] NOT NULL DEFAULT '{}',
  approved_repair_cost numeric(14,2) NOT NULL CHECK (approved_repair_cost > 0),
  participation numeric(14,2) NOT NULL DEFAULT 0 CHECK (participation >= 0),     -- deductible borne by the insured
  depreciation numeric(14,2) NOT NULL DEFAULT 0 CHECK (depreciation >= 0),       -- depreciation on replaced parts
  payable_by_insurer numeric(14,2) NOT NULL CHECK (payable_by_insurer >= 0),
  payable_by_insured numeric(14,2) NOT NULL DEFAULT 0 CHECK (payable_by_insured >= 0),
  issued_on date NOT NULL,
  valid_until date,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  remarks text,
  issued_by text, created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_by text, cancelled_at timestamptz, cancel_reason text);
CREATE INDEX IF NOT EXISTS claim_loas_claim ON claim_loas(claim_id);

CREATE TABLE IF NOT EXISTS claim_vehicle_releases (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  loa_id text REFERENCES claim_loas(id),
  repair_completed_on date,
  released_on date NOT NULL,
  released_to text NOT NULL,                           -- the person who took the vehicle back
  participation_collected numeric(14,2) NOT NULL DEFAULT 0,
  odometer text,
  remarks text,
  recorded_by text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, loa_id));
