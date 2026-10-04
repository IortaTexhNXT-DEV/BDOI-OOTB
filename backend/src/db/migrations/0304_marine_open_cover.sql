-- Marine cargo open covers (Operations > Marine Open Covers).
--
-- open_covers: the open cover contract of a client with an insurer: period, goods, voyages, the limit per conveyance
-- (any one sending) and the rate per conveyance (sea, air, land: rates jsonb [{ conveyance, ratePercent, limit }]),
-- the minimum premium per certificate, the clauses and the declaration frequency. Activating the contract issues its
-- open policy without a bill (open_covers.policy_id); premium is billed on the declarations.
--
-- open_cover_certificates: the marine insurance certificates issued against the open cover, one per shipment: the
-- insured value (invoice value plus the agreed mark-up), the rate of the conveyance and the premium. A shipment above
-- the limit of its conveyance needs the insurer's prior agreement (refused here). Shipments sent without a certificate
-- are entered on the declaration as declared items (kind 'declared').
--
-- open_cover_declarations: the monthly declaration of the shipments of a period: the certificates and declared items
-- of the month, with premium, the premium taxes (premium tax and charge engine, line MARINE) and the gross premium.
-- Billing a declaration raises the bill on the open policy (premium receivable, booking journal, collection item); the
-- premium is then collected and remitted to the insurer like any bill.

CREATE TABLE IF NOT EXISTS open_covers (
  id text PRIMARY KEY DEFAULT ('ocv_' || encode(gen_random_bytes(8), 'hex')),
  cover_number text NOT NULL UNIQUE,
  client_id text NOT NULL REFERENCES clients(id),
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  product_id int REFERENCES products(id),
  policy_id text REFERENCES policies(id),
  insurer_reference text,
  period_from date NOT NULL,
  period_to date NOT NULL,
  goods_description text NOT NULL,
  voyage_scope text,
  clauses text,
  currency text NOT NULL DEFAULT 'PHP',
  rates jsonb NOT NULL DEFAULT '[]',                 -- [{ conveyance: 'Sea' | 'Air' | 'Land', ratePercent, limit }]
  markup_percent numeric(6,2) NOT NULL DEFAULT 10,
  minimum_premium numeric(14,2) NOT NULL DEFAULT 0,  -- per certificate
  estimated_annual_value numeric(16,2),
  declaration_frequency text NOT NULL DEFAULT 'monthly' CHECK (declaration_frequency IN ('monthly', 'quarterly')),
  commission_rate numeric(6,4),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  owner_user_id text REFERENCES users(id),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_to > period_from)
);
CREATE INDEX IF NOT EXISTS open_covers_client_id_fk_idx ON open_covers(client_id);
CREATE INDEX IF NOT EXISTS open_covers_insurance_company_id_fk_idx ON open_covers(insurance_company_id);
CREATE INDEX IF NOT EXISTS open_covers_product_id_fk_idx ON open_covers(product_id);
CREATE INDEX IF NOT EXISTS open_covers_policy_id_fk_idx ON open_covers(policy_id);
CREATE INDEX IF NOT EXISTS open_covers_owner_user_id_fk_idx ON open_covers(owner_user_id);

CREATE TABLE IF NOT EXISTS open_cover_declarations (
  id text PRIMARY KEY DEFAULT ('ocd_' || encode(gen_random_bytes(8), 'hex')),
  declaration_number text NOT NULL UNIQUE,
  open_cover_id text NOT NULL REFERENCES open_covers(id),
  period text NOT NULL,                              -- YYYY-MM (first month of a quarter for a quarterly cover)
  period_from date NOT NULL,
  period_to date NOT NULL,
  shipments int NOT NULL DEFAULT 0,
  total_insured numeric(16,2) NOT NULL DEFAULT 0,
  premium numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0,
  dst numeric(14,2) NOT NULL DEFAULT 0,
  lgt numeric(14,2) NOT NULL DEFAULT 0,
  other_charges numeric(14,2) NOT NULL DEFAULT 0,
  gross_premium numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'billed', 'nil')),
  receivable_id text REFERENCES receivables(id),
  bill_number text,
  notes text,
  submitted_at timestamptz,
  submitted_by text,
  billed_at timestamptz,
  billed_by text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS open_cover_declarations_period_uq ON open_cover_declarations(open_cover_id, period);
CREATE INDEX IF NOT EXISTS open_cover_declarations_receivable_id_fk_idx ON open_cover_declarations(receivable_id);

CREATE TABLE IF NOT EXISTS open_cover_certificates (
  id text PRIMARY KEY DEFAULT ('occ_' || encode(gen_random_bytes(8), 'hex')),
  certificate_number text NOT NULL UNIQUE,
  open_cover_id text NOT NULL REFERENCES open_covers(id),
  declaration_id text REFERENCES open_cover_declarations(id),
  kind text NOT NULL DEFAULT 'certificate' CHECK (kind IN ('certificate', 'declared')),
  shipment_date date NOT NULL,
  conveyance text NOT NULL,
  vessel_name text,
  voyage_from text NOT NULL,
  voyage_to text NOT NULL,
  bill_of_lading text,
  goods_description text,
  packing text,
  consignee text,
  invoice_value numeric(16,2) NOT NULL,
  markup_percent numeric(6,2) NOT NULL DEFAULT 0,
  insured_value numeric(16,2) NOT NULL,
  rate_percent numeric(8,4) NOT NULL,
  premium numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'declared', 'cancelled')),
  cancel_reason text,
  issued_by text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS open_cover_certificates_cover_idx ON open_cover_certificates(open_cover_id, shipment_date);
CREATE INDEX IF NOT EXISTS open_cover_certificates_declaration_id_fk_idx ON open_cover_certificates(declaration_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('open_cover', 'Marine Open Cover', 'marine', 'MOC', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Marine cargo open cover contract (Operations > Marine Open Covers)', 'migration'),
 ('marine_certificate', 'Marine Certificate', 'marine', 'MIC', '{PREFIX}-{YYYY}-{SEQ}', 6, 'yearly', 'Marine insurance certificate issued against an open cover', 'migration'),
 ('marine_declaration', 'Marine Declaration', 'marine', 'MDC', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Declaration of shipments under an open cover', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('read:marine', 'marine', 'View marine open covers, certificates and declarations and print certificates'),
 ('write:marine', 'marine', 'Set up open covers, issue certificates and submit and bill declarations')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code IN ('system-admin', 'processing', 'operations') AND p.code IN ('read:marine', 'write:marine'))
    OR (r.code IN ('sales', 'claims', 'accounting') AND p.code = 'read:marine')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('marine.conveyances', '["Sea","Air","Land"]', 'marine', 'Conveyances an open cover can rate (one rate and limit each)', 'json'),
 ('marine.default_markup_percent', '10', 'marine', 'Mark-up on the invoice value for the insured value of a shipment (CIF + 10% by custom)', 'number'),
 ('marine.certificate_wording', '"This is to certify that insurance has been effected under the open cover named above on the goods and voyage described, subject to the clauses of the open cover. Claims are payable on presentation of this certificate with the bill of lading and the survey report."', 'marine', 'Wording printed on the marine insurance certificate', 'string'),
 ('marine.declaration_due_days', '15', 'marine', 'Days after the end of a declaration period by which the declaration is due', 'number')
ON CONFLICT (key) DO NOTHING;
