-- Brand-new vehicle programmes of a captive agency (Operations > Sales & Marketing > Dealer Programmes).
--
-- motor_programmes: the terms agreed with a dealer (group or branch) and, optionally, a financing bank for the cars it
-- sells: insurer, own damage rate, CTPL (1 or 3 years), whether the first year is free or subsidised and who pays
-- (the buyer, the dealer or the bank: subsidy_payer, subsidy_type percent / amount / full, subsidy_value), whether an
-- upload creates quotations to follow up or issues the policies at once (issue_mode), and the mortgagee clause when a
-- bank finances the car (the bank's own clause, else channels.default_mortgagee_clause).
--
-- dealer_sales_batches / dealer_sales: the vehicle sales a dealer sends (Dealer Sales Upload template), one row per car:
-- buyer, vehicle, invoice price, financing bank and loan. Each accepted row creates the prospect and the quotation
-- (and the policy in issue_mode 'policy'); a row that fails is kept with its error so the batch can be corrected.
-- The bank endorsement letter (one per sale, or per bank for a batch) is printed from the sale.

CREATE TABLE IF NOT EXISTS motor_programmes (
  id serial PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  dealer_channel_id text NOT NULL REFERENCES distribution_channels(id),
  bank_channel_id text REFERENCES distribution_channels(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  product_id int REFERENCES products(id),
  vehicle_type text,                                  -- default Insurance Commission vehicle class (CTPL tariff)
  own_damage_rate numeric(8,4) NOT NULL DEFAULT 0,    -- percent of the invoice price
  acts_of_nature_rate numeric(8,4) NOT NULL DEFAULT 0,
  bodily_injury numeric(14,2) NOT NULL DEFAULT 0,     -- excess bodily injury limit
  property_damage numeric(14,2) NOT NULL DEFAULT 0,
  include_ctpl boolean NOT NULL DEFAULT true,
  ctpl_term_years int NOT NULL DEFAULT 3 CHECK (ctpl_term_years IN (1, 3)),
  free_first_year boolean NOT NULL DEFAULT false,
  subsidy_payer text NOT NULL DEFAULT 'none' CHECK (subsidy_payer IN ('none', 'dealer', 'bank')),
  subsidy_type text NOT NULL DEFAULT 'percent' CHECK (subsidy_type IN ('percent', 'amount', 'full')),
  subsidy_value numeric(14,2) NOT NULL DEFAULT 0,
  issue_mode text NOT NULL DEFAULT 'quotation' CHECK (issue_mode IN ('quotation', 'policy')),
  mortgagee_clause text,
  effective_from date,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS motor_programmes_code_uq ON motor_programmes(lower(code));
CREATE INDEX IF NOT EXISTS motor_programmes_dealer_channel_id_fk_idx ON motor_programmes(dealer_channel_id);
CREATE INDEX IF NOT EXISTS motor_programmes_bank_channel_id_fk_idx ON motor_programmes(bank_channel_id);
CREATE INDEX IF NOT EXISTS motor_programmes_insurance_company_id_fk_idx ON motor_programmes(insurance_company_id);
CREATE INDEX IF NOT EXISTS motor_programmes_product_id_fk_idx ON motor_programmes(product_id);

CREATE TABLE IF NOT EXISTS dealer_sales_batches (
  id text PRIMARY KEY DEFAULT ('dsb_' || encode(gen_random_bytes(8), 'hex')),
  batch_number text NOT NULL UNIQUE,
  programme_id int NOT NULL REFERENCES motor_programmes(id),
  file_name text,
  rows_total int NOT NULL DEFAULT 0,
  rows_created int NOT NULL DEFAULT 0,
  rows_failed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'partial', 'failed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dealer_sales_batches_programme_id_fk_idx ON dealer_sales_batches(programme_id);

CREATE TABLE IF NOT EXISTS dealer_sales (
  id text PRIMARY KEY DEFAULT ('dsl_' || encode(gen_random_bytes(8), 'hex')),
  batch_id text REFERENCES dealer_sales_batches(id) ON DELETE CASCADE,
  programme_id int NOT NULL REFERENCES motor_programmes(id),
  row_no int,
  dealer_channel_id text REFERENCES distribution_channels(id),
  bank_channel_id text REFERENCES distribution_channels(id),
  sale_date date,
  invoice_number text,
  buyer_first_name text,
  buyer_last_name text,
  buyer_company_name text,
  buyer_email text,
  buyer_phone text,
  buyer_address text,
  buyer_city text,
  buyer_province text,
  make text,
  model text,
  variant text,
  year_model int,
  color text,
  vehicle_type text,
  conduction_sticker text,
  plate_number text,
  chassis_number text,
  engine_number text,
  invoice_price numeric(14,2),
  loan_amount numeric(14,2),
  gross_premium numeric(14,2),
  buyer_share numeric(14,2),
  payer_share numeric(14,2),
  lead_id text REFERENCES leads(id),
  quote_id text REFERENCES quotes(id),
  policy_id text REFERENCES policies(id),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'failed')),
  error text,
  letter_sent_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dealer_sales_batch_idx ON dealer_sales(batch_id, row_no);
CREATE INDEX IF NOT EXISTS dealer_sales_programme_id_fk_idx ON dealer_sales(programme_id);
CREATE INDEX IF NOT EXISTS dealer_sales_dealer_channel_id_fk_idx ON dealer_sales(dealer_channel_id);
CREATE INDEX IF NOT EXISTS dealer_sales_bank_channel_id_fk_idx ON dealer_sales(bank_channel_id);
CREATE INDEX IF NOT EXISTS dealer_sales_lead_id_fk_idx ON dealer_sales(lead_id);
CREATE INDEX IF NOT EXISTS dealer_sales_quote_id_fk_idx ON dealer_sales(quote_id);
CREATE INDEX IF NOT EXISTS dealer_sales_policy_id_fk_idx ON dealer_sales(policy_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('dealer_sales_batch', 'Dealer Sales Batch', 'motor-programmes', 'DSB', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'Upload of vehicle sales from a dealer (Operations > Sales & Marketing > Dealer Programmes)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('read:motor-programmes', 'motor-programmes', 'View the brand-new vehicle programmes, the dealer sales uploads and print the bank endorsement letters'),
 ('write:motor-programmes', 'motor-programmes', 'Maintain the brand-new vehicle programmes and upload the dealer vehicle sales')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code IN ('system-admin', 'sales', 'processing') AND p.code IN ('read:motor-programmes', 'write:motor-programmes'))
    OR (r.code = 'operations' AND p.code = 'read:motor-programmes')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('motor_programmes.bank_letter_subject', '"Confirmation of insurance cover with mortgagee clause"', 'motor_programmes', 'Subject line of the bank endorsement letter', 'string'),
 ('motor_programmes.bank_letter_body', '"We confirm that the vehicle described below, financed by {{bankName}}, is insured under the policy stated, with {{bankName}} named as mortgagee. Any loss under the own damage and theft cover shall be payable to the bank as its interest may appear. The policy will not be cancelled or reduced without prior written notice to the bank."', 'motor_programmes', 'Body of the bank endorsement letter ({{bankName}}, {{buyerName}}, {{policyNumber}})', 'string'),
 ('motor_programmes.max_rows', '2000', 'motor_programmes', 'Maximum vehicle sales in one dealer upload', 'number'),
 ('motor_programmes.email_bank_letter', 'false', 'motor_programmes', 'Queue the bank endorsement letter to the bank''s contact e-mail when a policy is issued from a dealer sale', 'boolean')
ON CONFLICT (key) DO NOTHING;
