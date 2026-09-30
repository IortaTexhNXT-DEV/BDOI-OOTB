-- Non-packaged (bespoke) placements, part 4: layered co-insurance. A placement (or policy) is split into a primary
-- layer and excess layers (limit, attachment point, layer premium); each layer has its own participants with
-- fractional shares that total 100%. Premium, taxes and commission are allocated per participant per layer. The
-- consolidated share of each insurer across the layers (by premium) is written to risk_participants, so booking,
-- remittance and the co-insurance reports keep working unchanged; the layer ledger holds the detail.
-- Claims on a layered risk are split per layer (loss above the attachment point, up to the limit) and per participant
-- (share): reserve, payments and the recoveries collected from each participant.

CREATE TABLE IF NOT EXISTS risk_layers (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('placement', 'policy')),
  entity_id text NOT NULL,
  layer_no int NOT NULL,
  name text NOT NULL,
  layer_type text NOT NULL DEFAULT 'excess' CHECK (layer_type IN ('primary', 'excess')),
  limit_amount numeric(16,2) NOT NULL CHECK (limit_amount > 0),
  attachment_point numeric(16,2) NOT NULL DEFAULT 0 CHECK (attachment_point >= 0),
  premium numeric(14,2) NOT NULL DEFAULT 0,          -- net premium of the layer (100%)
  taxes numeric(14,2) NOT NULL DEFAULT 0,
  premium_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, layer_no));
CREATE INDEX IF NOT EXISTS risk_layers_entity ON risk_layers(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS risk_layer_participants (
  id bigserial PRIMARY KEY,
  layer_id bigint NOT NULL REFERENCES risk_layers(id) ON DELETE CASCADE,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  is_lead boolean NOT NULL DEFAULT false,
  share_percent numeric(7,4) NOT NULL CHECK (share_percent > 0 AND share_percent <= 100),
  premium numeric(14,2) NOT NULL DEFAULT 0,
  taxes numeric(14,2) NOT NULL DEFAULT 0,
  premium_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_rate numeric(6,4),
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_due numeric(14,2) NOT NULL DEFAULT 0,          -- premium_total - commission_amount: due to the insurer
  insurer_reference text,
  UNIQUE (layer_id, insurance_company_id));
CREATE UNIQUE INDEX IF NOT EXISTS risk_layer_participants_one_lead ON risk_layer_participants(layer_id) WHERE is_lead;
CREATE INDEX IF NOT EXISTS risk_layer_participants_insurer ON risk_layer_participants(insurance_company_id);

-- the consolidated participant rows written from the layers
ALTER TABLE risk_participants ADD COLUMN IF NOT EXISTS layered boolean NOT NULL DEFAULT false;

-- Insurer statement reconciliation per participant (and layer) of a layered or co-insured risk
CREATE TABLE IF NOT EXISTS layer_reconciliations (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  layer_no int,                                      -- null: all layers of the insurer
  statement_ref text,
  statement_amount numeric(14,2) NOT NULL,           -- what the insurer's statement shows as received from the broker
  due_amount numeric(14,2) NOT NULL,
  remitted_amount numeric(14,2) NOT NULL,
  difference numeric(14,2) NOT NULL,                 -- statement_amount - remitted_amount
  status text NOT NULL CHECK (status IN ('matched', 'difference')),
  note text,
  reconciled_by text, reconciled_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS layer_reconciliations_entity ON layer_reconciliations(entity_type, entity_id, insurance_company_id);

-- Claim split: reserve (outstanding reserve set to amount), payment (paid to the claimant) and recovery (collected from a participant)
CREATE TABLE IF NOT EXISTS claim_layer_movements (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id),
  kind text NOT NULL CHECK (kind IN ('reserve', 'payment', 'recovery')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  insurance_company_id int REFERENCES insurance_companies(id),   -- recovery: the participant
  layer_no int,                                                  -- recovery: the layer (null: oldest outstanding first)
  movement_date date NOT NULL,
  reference text, remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'recovery' OR insurance_company_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS claim_layer_movements_claim ON claim_layer_movements(claim_id, movement_date, id);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('bespoke.layers_contiguous', 'true', 'bespoke', 'Layering: every excess layer must attach where the layer below ends (attachment point = previous attachment + limit)', 'boolean'),
 ('bespoke.layer_premium_must_match', 'true', 'bespoke', 'Layering: the layer premiums must add up to the net premium of the placement or policy', 'boolean'),
 ('bespoke.claim_payment_within_reserve', 'false', 'bespoke', 'Claim split: refuse a payment larger than the outstanding reserve', 'boolean'),
 ('bespoke.reconciliation_tolerance', '1', 'bespoke', 'Participant reconciliation: largest difference (in the policy currency) between the insurer statement and the amount remitted still treated as matched', 'number')
ON CONFLICT (key) DO NOTHING;
