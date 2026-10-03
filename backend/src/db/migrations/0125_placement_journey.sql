-- Placement journey: Broker Slip (market submission / RFQ) -> Quotation Slip (the quotation) -> Placement Slip (firm
-- order) -> Policy. Any step can be the starting point (direct quote, direct placement, direct policy entry); which
-- steps a product / line of business requires is configured in placement.journey.

-- ---------- Broker slips (market submission) ----------
CREATE TABLE broker_slips (
  id text PRIMARY KEY DEFAULT ('bs_' || encode(gen_random_bytes(8), 'hex')),
  slip_number text UNIQUE,
  lead_id text REFERENCES leads(id), client_id text REFERENCES clients(id),
  product_id int REFERENCES products(id), product_type text, lob text,
  insured_name text,
  risk_details jsonb NOT NULL DEFAULT '{}',          -- generic risk description (location, occupancy, cargo, project ...)
  doc jsonb NOT NULL DEFAULT '{}',                   -- quote-shaped risk data (motor: insuranceVehicleDetails, covers)
  requested_covers jsonb NOT NULL DEFAULT '[]',      -- [{cover, sumInsured, limit, deductible, remarks}]
  sum_insured numeric(16,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  inception_date date, expiry_date date,
  submission_date date, response_due_date date,
  status text NOT NULL DEFAULT 'draft',              -- draft | submitted | responses-in | closed | cancelled
  quote_id text REFERENCES quotes(id),               -- Quotation Slip prepared from the selected offer(s)
  remarks text, cancel_reason text,
  owner_user_id text REFERENCES users(id),
  created_by text, updated_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX broker_slips_status ON broker_slips(status);
CREATE INDEX broker_slips_lead ON broker_slips(lead_id);
CREATE INDEX broker_slips_client ON broker_slips(client_id);

-- ---------- Market responses (one per insurer approached) ----------
CREATE TABLE insurer_offers (
  id text PRIMARY KEY DEFAULT ('ofr_' || encode(gen_random_bytes(8), 'hex')),
  offer_number text UNIQUE,
  broker_slip_id text NOT NULL REFERENCES broker_slips(id) ON DELETE CASCADE,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  status text NOT NULL DEFAULT 'pending',            -- pending | offered | declined
  premium numeric(14,2),                             -- net premium quoted for 100% of the risk
  rate numeric(10,6),                                -- premium rate (% of sum insured)
  taxes numeric(14,2),
  premium_total numeric(14,2),
  sum_insured numeric(16,2),
  deductibles text,
  terms text,                                        -- special terms, conditions, warranties, exclusions
  validity_date date,
  offered_share numeric(7,4) NOT NULL DEFAULT 100 CHECK (offered_share > 0 AND offered_share <= 100),  -- line the insurer writes
  insurer_reference text,
  attachment_key text, attachment_name text,
  decline_reason text, remarks text,
  requested_at timestamptz, responded_at timestamptz,
  selected boolean NOT NULL DEFAULT false,           -- used for the Quotation / Placement Slip
  created_by text, updated_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_slip_id, insurance_company_id));
CREATE INDEX insurer_offers_insurer ON insurer_offers(insurance_company_id);

-- ---------- Placement slips (firm order to the insurer(s)) ----------
CREATE TABLE placements (
  id text PRIMARY KEY DEFAULT ('plc_' || encode(gen_random_bytes(8), 'hex')),
  placement_number text UNIQUE,
  source text NOT NULL DEFAULT 'quote',              -- quote | broker-slip | direct | direct-policy
  quote_id text REFERENCES quotes(id), broker_slip_id text REFERENCES broker_slips(id),
  lead_id text REFERENCES leads(id), client_id text REFERENCES clients(id),
  product_id int REFERENCES products(id), policy_type_id int REFERENCES policy_types(id), product_type text, lob text,
  insurance_company_id int REFERENCES insurance_companies(id),   -- lead insurer
  insured_name text,
  doc jsonb NOT NULL DEFAULT '{}',                   -- risk details (quote document shape) and premium breakdown
  sum_insured numeric(16,2) NOT NULL DEFAULT 0,
  premium_base numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0, dst numeric(14,2) NOT NULL DEFAULT 0, lgt numeric(14,2) NOT NULL DEFAULT 0, fst numeric(14,2) NOT NULL DEFAULT 0,
  others numeric(14,2) NOT NULL DEFAULT 0, discount numeric(14,2) NOT NULL DEFAULT 0,
  premium_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_rate numeric(6,4), commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  inception_date date, expiry_date date,
  billing_mode text,                                 -- broker | direct (null: direct_bill.default_billing_mode)
  status text NOT NULL DEFAULT 'draft',              -- draft | sent | bound | declined | cancelled | issued
  sent_at timestamptz, bound_at timestamptz, issued_at timestamptz,
  policy_id text REFERENCES policies(id),
  remarks text, cancel_reason text,
  owner_user_id text REFERENCES users(id),
  created_by text, updated_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX placements_status ON placements(status);
CREATE INDEX placements_quote ON placements(quote_id);
CREATE INDEX placements_slip ON placements(broker_slip_id);

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS broker_slip_id text REFERENCES broker_slips(id);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS placement_id text REFERENCES placements(id);

-- A participant's binding confirmation (placement) and its insurer's policy / certificate number (insurer_reference).
ALTER TABLE risk_participants ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE risk_participants ADD COLUMN IF NOT EXISTS confirmed_by text;
ALTER TABLE risk_participants ADD COLUMN IF NOT EXISTS remarks text;

-- ---------- Configuration ----------
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('numbering.broker_slip.prefix', '"BS"', 'numbering', 'Broker slip number prefix', 'string'),
 ('numbering.insurer_offer.prefix', '"OFR"', 'numbering', 'Insurer offer (market response) number prefix', 'string'),
 ('numbering.placement.prefix', '"PS"', 'numbering', 'Placement slip number prefix', 'string'),
 ('placement.journey', '{
   "default": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "optional", "directPolicy": "optional"},
   "MOTOR": {"brokerSlip": "optional", "quotationSlip": "required", "placementSlip": "optional", "directPolicy": "optional"},
   "FIRE": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "optional"},
   "IAR": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "optional"},
   "MARINE": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "optional"},
   "CASUALTY": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "optional"},
   "ENGINEERING": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "optional"}
 }', 'placement', 'Placement journey per line of business or product type (key: product type, LOB code or "default"). Steps brokerSlip, quotationSlip, placementSlip, directPolicy: required | optional | skip', 'json'),
 ('placement.journey_applies_to_renewals', 'false', 'placement', 'Apply the placement journey to renewal quotations (false: a renewal quotation converts directly)', 'boolean'),
 ('placement.lob_keywords', '{"MARINE":["MARINE","CARGO","HULL"],"ENGINEERING":["ENGINEERING","CONTRACTOR","ERECTION","MACHINERY BREAKDOWN"],"ACCIDENT":["PERSONAL ACCIDENT"],"CASUALTY":["LIABILITY","CASUALTY","BOND","SURETY","CGL"]}', 'placement', 'Keywords in a product name that identify its line of business for the placement journey (motor, fire, IAR and EB are recognised already)', 'json'),
 ('broker_slips.response_days', '7', 'placement', 'Default days from submission to the market response due date', 'number'),
 ('broker_slips.default_insurers', '[]', 'placement', 'Insurer codes approached by default on a new broker slip (empty: chosen per slip)', 'json'),
 ('placement.offer_validity_days', '30', 'placement', 'Default validity (days) of an insurer offer when the insurer gives none', 'number'),
 ('placement.quote_statuses', '["CustomerAccepted","SubmittedToInsurer","Approved"]', 'placement', 'Quotation statuses from which a placement slip can be created', 'json'),
 ('placement.editable_statuses', '["draft","declined"]', 'placement', 'Placement slip statuses in which the participants and premium can still be edited', 'json'),
 ('email.template.broker_slip_request', $j${"subject":"Request for quotation {{slipNumber}} - {{productType}} - {{insuredName}}","html":"<p>Dear {{insurerName}} underwriting team,</p><p>We invite your quotation for the risk below.</p><p>Broker slip <b>{{slipNumber}}</b><br/>Insured: {{insuredName}}<br/>Class: {{productType}}<br/>Sum insured: {{currency}} {{sumInsured}}<br/>Period: {{period}}<br/>Requested covers: {{covers}}</p><p>Please send your terms (premium, rate, deductibles, conditions, the line you can write and the validity of the offer) by <b>{{responseDueDate}}</b>.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: broker slip (request for quotation) to an insurer', 'json'),
 ('email.template.placement_order', $j${"subject":"Placement slip {{placementNumber}} - firm order - {{insuredName}}","html":"<p>Dear {{insurerName}} underwriting team,</p><p>On behalf of our client we place the risk below with you and request your confirmation of cover and your policy / certificate number.</p><p>Placement slip <b>{{placementNumber}}</b><br/>Insured: {{insuredName}}<br/>Class: {{productType}}<br/>Period: {{period}}<br/>Sum insured (100%): {{currency}} {{sumInsured}}<br/>Your share: <b>{{sharePercent}}%</b> ({{role}})<br/>Your share of sum insured: {{currency}} {{shareSumInsured}}<br/>Your share of premium: {{currency}} {{sharePremium}} (gross {{currency}} {{sharePremiumTotal}})</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: placement slip (firm order) to a participating insurer', 'json')
ON CONFLICT (key) DO NOTHING;
