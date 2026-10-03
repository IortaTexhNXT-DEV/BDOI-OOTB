-- Co-insurance participants of a risk, shared by the slips, quotations and policies. One row per insurer with its
-- share; the lead insurer is the one the client deals with. A single-insurer risk has one row at 100%.
-- entity_type: broker_slip | quote | placement | policy | endorsement
CREATE TABLE risk_participants (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  is_lead boolean NOT NULL DEFAULT false,
  share_percent numeric(7,4) NOT NULL CHECK (share_percent > 0 AND share_percent <= 100),
  sum_insured numeric(16,2) NOT NULL DEFAULT 0,
  premium numeric(14,2) NOT NULL DEFAULT 0,          -- net premium of this share
  taxes numeric(14,2) NOT NULL DEFAULT 0,            -- VAT, DST, LGT, FST of this share
  premium_total numeric(14,2) NOT NULL DEFAULT 0,    -- gross of this share
  commission_rate numeric(6,4),                      -- this insurer's rate (fraction); null = resolved from the masters
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  insurer_reference text,                            -- the insurer's policy or certificate number for its share
  status text NOT NULL DEFAULT 'active',             -- active | declined | withdrawn
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, insurance_company_id));
CREATE INDEX risk_participants_entity ON risk_participants(entity_type, entity_id);
CREATE INDEX risk_participants_insurer ON risk_participants(insurance_company_id);
-- at most one lead per risk
CREATE UNIQUE INDEX risk_participants_one_lead ON risk_participants(entity_type, entity_id) WHERE is_lead;
