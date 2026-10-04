-- Tax codes master (VAT, expanded / final withholding, DST, LGT, premium tax) with BIR alphanumeric tax codes (ATC),
-- and the register of BIR Form 2307 certificates issued. Rates and ATCs are editable: verify them against the
-- current BIR revenue regulations before filing. Idempotent.
CREATE TABLE IF NOT EXISTS tax_codes (
  code text PRIMARY KEY,
  description text NOT NULL,
  tax_type text NOT NULL CHECK (tax_type IN ('VAT', 'EWT', 'FWT', 'DST', 'LGT', 'PT', 'FST', 'OTHER')),
  rate numeric(7,4) NOT NULL DEFAULT 0,                -- percent, e.g. 12 = 12%
  atc text,                                            -- BIR alphanumeric tax code, e.g. WC158
  nature_of_payment text,                              -- printed on BIR Form 2307 / alphalists
  gl_account text,                                     -- GL account the tax is booked to
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('sales', 'purchases', 'both')),
  payee_kind text NOT NULL DEFAULT 'any' CHECK (payee_kind IN ('individual', 'corporate', 'any')),
  effective_from date, effective_to date,
  editable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  remarks text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS tax_codes_atc_uq ON tax_codes(atc) WHERE atc IS NOT NULL;

INSERT INTO tax_codes(code, description, tax_type, rate, atc, nature_of_payment, gl_account, applies_to, payee_kind, effective_from, sort_order) VALUES
 ('VAT12-OUT', 'Output VAT 12% on brokerage commission and fees', 'VAT', 12, NULL, 'Sale of services (commission)', '2204003', 'sales', 'any', '2026-01-01', 10),
 ('VAT12-IN', 'Input VAT 12% on purchases of goods and services', 'VAT', 12, NULL, 'Purchase of goods and services', '1301001', 'purchases', 'any', '2026-01-01', 20),
 ('VAT0', 'VAT zero-rated sale of services', 'VAT', 0, NULL, 'Zero-rated sale', '2204003', 'sales', 'any', '2026-01-01', 30),
 ('VATEX', 'VAT-exempt transaction', 'VAT', 0, NULL, 'Exempt sale / purchase', NULL, 'both', 'any', '2026-01-01', 40),
 ('WC139', 'EWT on gross commission of insurance and other brokers – corporate (gross income up to the threshold)', 'EWT', 10, 'WC139', 'Commission of insurance brokers', '1302001', 'sales', 'corporate', '2026-01-01', 100),
 ('WC140', 'EWT on gross commission of insurance and other brokers – corporate (above the threshold)', 'EWT', 15, 'WC140', 'Commission of insurance brokers', '1302001', 'sales', 'corporate', '2026-01-01', 110),
 ('WI139', 'EWT on gross commission of brokers and agents – individual (gross income up to ₱3M)', 'EWT', 5, 'WI139', 'Commission of brokers and agents', '1302001', 'sales', 'individual', '2026-01-01', 120),
 ('WI140', 'EWT on gross commission of brokers and agents – individual (above ₱3M)', 'EWT', 10, 'WI140', 'Commission of brokers and agents', '1302001', 'sales', 'individual', '2026-01-01', 130),
 ('WI515', 'EWT on commission of independent sales representatives and marketing agents (sub-agents, referrers) – individual', 'EWT', 5, 'WI515', 'Commission of sales representatives and marketing agents', '2204001', 'purchases', 'individual', '2026-01-01', 140),
 ('WI516', 'EWT on commission of sales representatives and marketing agents – individual (above ₱3M)', 'EWT', 10, 'WI516', 'Commission of sales representatives and marketing agents', '2204001', 'purchases', 'individual', '2026-01-01', 150),
 ('WC515', 'EWT on commission of marketing agents and referrers – corporate', 'EWT', 10, 'WC515', 'Commission of marketing agents', '2204001', 'purchases', 'corporate', '2026-01-01', 160),
 ('WC158', 'EWT 1% – purchases of goods by top withholding agents from corporate suppliers', 'EWT', 1, 'WC158', 'Purchase of goods', '2204001', 'purchases', 'corporate', '2026-01-01', 170),
 ('WI158', 'EWT 1% – purchases of goods by top withholding agents from individual suppliers', 'EWT', 1, 'WI158', 'Purchase of goods', '2204001', 'purchases', 'individual', '2026-01-01', 180),
 ('WC160', 'EWT 2% – purchases of services by top withholding agents from corporate suppliers', 'EWT', 2, 'WC160', 'Purchase of services', '2204001', 'purchases', 'corporate', '2026-01-01', 190),
 ('WI160', 'EWT 2% – purchases of services by top withholding agents from individual suppliers', 'EWT', 2, 'WI160', 'Purchase of services', '2204001', 'purchases', 'individual', '2026-01-01', 200),
 ('WC100', 'EWT 5% on rentals of real and personal property – corporate lessor', 'EWT', 5, 'WC100', 'Rentals', '2204001', 'purchases', 'corporate', '2026-01-01', 210),
 ('WI100', 'EWT 5% on rentals of real and personal property – individual lessor', 'EWT', 5, 'WI100', 'Rentals', '2204001', 'purchases', 'individual', '2026-01-01', 220),
 ('WC120', 'EWT 2% on payments to contractors – corporate', 'EWT', 2, 'WC120', 'Contractors', '2204001', 'purchases', 'corporate', '2026-01-01', 230),
 ('WI010', 'EWT 5% on professional fees – individual (gross income up to ₱3M)', 'EWT', 5, 'WI010', 'Professional fees', '2204001', 'purchases', 'individual', '2026-01-01', 240),
 ('WI011', 'EWT 10% on professional fees – individual (above ₱3M)', 'EWT', 10, 'WI011', 'Professional fees', '2204001', 'purchases', 'individual', '2026-01-01', 250),
 ('WC010', 'EWT 10% on professional fees – corporate (gross income up to ₱720K)', 'EWT', 10, 'WC010', 'Professional fees', '2204001', 'purchases', 'corporate', '2026-01-01', 260),
 ('WC011', 'EWT 15% on professional fees – corporate (above ₱720K)', 'EWT', 15, 'WC011', 'Professional fees', '2204001', 'purchases', 'corporate', '2026-01-01', 270),
 ('FWT-INT', 'Final withholding tax 20% on interest from bank deposits and placements', 'FWT', 20, NULL, 'Interest income', NULL, 'sales', 'any', '2026-01-01', 300),
 ('DST', 'Documentary stamp tax on insurance premium', 'DST', 12.5, NULL, 'Premium', NULL, 'sales', 'any', '2026-01-01', 400),
 ('LGT', 'Local government (premium) tax', 'LGT', 0.75, NULL, 'Premium', NULL, 'sales', 'any', '2026-01-01', 410),
 ('PT', 'Premium tax on gross premium', 'PT', 2, NULL, 'Gross premium', NULL, 'sales', 'any', '2026-01-01', 420)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS bir_2307_certificates (
  id text PRIMARY KEY DEFAULT ('cwt_' || encode(gen_random_bytes(8), 'hex')),
  cert_number text UNIQUE NOT NULL,                    -- CWT number
  direction text NOT NULL DEFAULT 'issued' CHECK (direction IN ('issued', 'received')),
  payee_key text NOT NULL,                             -- payee type + id (issued) / payor type + id (received)
  payee_name text NOT NULL, payee_tin text, payee_address text,
  payor_name text, payor_tin text, payor_address text,
  year int NOT NULL, quarter int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  period_from date NOT NULL, period_to date NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]',                   -- [{atc, nature, month1, month2, month3, total, tax}]
  total_income numeric(16,2) NOT NULL DEFAULT 0,
  total_tax numeric(16,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  cancelled_by text, cancelled_at timestamptz, cancel_reason text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS bir_2307_active_uq ON bir_2307_certificates(direction, payee_key, year, quarter) WHERE status = 'issued';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('numbering.bir_2307.prefix', '"CWT"', 'numbering', 'BIR Form 2307 certificate number prefix', 'string'),
 ('bir.withholding_agent_tin', '""', 'bir', 'TIN of the broker as withholding agent (BIR forms and alphalists)', 'string'),
 ('bir.registered_name', '""', 'bir', 'Registered name for BIR forms (blank = general.company_name)', 'string'),
 ('bir.registered_address', '""', 'bir', 'Registered address for BIR forms', 'string'),
 ('bir.zip_code', '""', 'bir', 'Zip code of the registered address', 'string'),
 ('bir.atc_by_payee', '{"Agent":"WI515","Sub-agent":"WI515","External":"WC515","Agent/Referrer":"WI515","Supplier":"WC160","Insurer":"WC160","Client":"WI160","Customer":"WI160"}', 'bir', 'ATC used on BIR Form 2307 / QAP per referrer type or payment-voucher payee type', 'json'),
 ('bir.sawt_default_atc', '"WC139"', 'bir', 'ATC of creditable tax withheld from the broker by insurers and clients (SAWT)', 'string')
ON CONFLICT (key) DO NOTHING;
