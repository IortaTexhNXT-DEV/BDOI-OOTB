-- Packaged products (high-velocity retail and SME): multi-line bundles, insurer rate tables for the quick quote
-- comparison, bundle quotations and bundle policies.
--
-- A bundle (e.g. "SME Shield" = Fire + CGL + Burglary) has sections, each tied to a product, with default sums
-- insured, a rate, a minimum premium and the insurers that may carry it (the carrier may differ per section). A
-- bundle quotation prices each section with its insurer (the insurer rate table when there is one, else the section
-- rate), applies the bundle discount proportionally, and adds the taxes of each section (premium-charges module).
-- Issuing it creates ONE policy under a package policy number with one section row per product: each section keeps its
-- insurer, premium, taxes and commission, and the policy's risk_participants carry the exact amounts per insurer, so
-- booking, remittance, commission and insurer reconciliation work per carrier.

CREATE TABLE IF NOT EXISTS insurer_rate_tables (
  id serial PRIMARY KEY,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  product_id int NOT NULL REFERENCES products(id),
  rate_basis text NOT NULL DEFAULT 'percent' CHECK (rate_basis IN ('percent', 'per_mille', 'flat')),
  rate numeric(12,6) NOT NULL DEFAULT 0 CHECK (rate >= 0),       -- percent or per mille of the sum insured; flat: the premium
  minimum_premium numeric(14,2) NOT NULL DEFAULT 0 CHECK (minimum_premium >= 0),
  deductible text,                                                -- as printed, e.g. "PHP 5,000 each and every loss"
  deductible_amount numeric(14,2),
  key_benefits jsonb NOT NULL DEFAULT '[]',                       -- ["Riot and strike", "Typhoon and flood"]
  commission_rate numeric(6,4) CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1)),
  effective_from date NOT NULL,
  effective_to date,
  active boolean NOT NULL DEFAULT true,
  remarks text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from));
CREATE INDEX IF NOT EXISTS insurer_rate_tables_product_idx ON insurer_rate_tables(product_id, insurance_company_id);
DROP TRIGGER IF EXISTS insurer_rate_tables_updated ON insurer_rate_tables;
CREATE TRIGGER insurer_rate_tables_updated BEFORE UPDATE ON insurer_rate_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS package_bundles (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  name text NOT NULL,
  description text,
  customer_segment text NOT NULL DEFAULT 'both' CHECK (customer_segment IN ('retail', 'sme', 'corporate', 'both')),
  discount_percent numeric(7,4) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent < 100),
  term_months int NOT NULL DEFAULT 12 CHECK (term_months BETWEEN 1 AND 60),
  auto_issue boolean NOT NULL DEFAULT true,                       -- may be issued digitally once paid online
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
DROP TRIGGER IF EXISTS package_bundles_updated ON package_bundles;
CREATE TRIGGER package_bundles_updated BEFORE UPDATE ON package_bundles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS package_bundle_sections (
  id serial PRIMARY KEY,
  bundle_id int NOT NULL REFERENCES package_bundles(id) ON DELETE CASCADE,
  section_no int NOT NULL CHECK (section_no > 0),
  name text NOT NULL,
  product_id int NOT NULL REFERENCES products(id),
  default_sum_insured numeric(14,2) NOT NULL DEFAULT 0 CHECK (default_sum_insured >= 0),
  rate_percent numeric(12,6) NOT NULL DEFAULT 0 CHECK (rate_percent >= 0),   -- used when the insurer has no rate table
  minimum_premium numeric(14,2) NOT NULL DEFAULT 0 CHECK (minimum_premium >= 0),
  property boolean,                                               -- fire service tax: true / false, null = by product line
  optional boolean NOT NULL DEFAULT false,
  insurer_ids int[] NOT NULL DEFAULT '{}',                        -- carriers allowed for the section (first = default)
  benefits jsonb NOT NULL DEFAULT '[]',
  UNIQUE (bundle_id, section_no));
CREATE INDEX IF NOT EXISTS package_bundle_sections_product_idx ON package_bundle_sections(product_id);

CREATE TABLE IF NOT EXISTS package_quotes (
  id text PRIMARY KEY DEFAULT ('pq_' || encode(gen_random_bytes(8), 'hex')),
  quote_number text NOT NULL UNIQUE,
  bundle_id int NOT NULL REFERENCES package_bundles(id),
  client_id text REFERENCES clients(id),
  lead_id text REFERENCES leads(id),
  insured_name text,
  location text,
  lgu_code text,
  inception_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'accepted', 'issued', 'cancelled', 'expired')),
  discount_percent numeric(7,4) NOT NULL DEFAULT 0,
  sum_insured numeric(14,2) NOT NULL DEFAULT 0,
  base_premium numeric(14,2) NOT NULL DEFAULT 0,                  -- before the bundle discount
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0, premium_tax numeric(14,2) NOT NULL DEFAULT 0, dst numeric(14,2) NOT NULL DEFAULT 0,
  fst numeric(14,2) NOT NULL DEFAULT 0, lgt numeric(14,2) NOT NULL DEFAULT 0, other_charges numeric(14,2) NOT NULL DEFAULT 0,
  total_charges numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  valid_until date,
  renewal_of text REFERENCES policies(id),
  policy_id text REFERENCES policies(id),
  remarks text,
  doc jsonb NOT NULL DEFAULT '{}',
  owner_user_id text REFERENCES users(id),
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS package_quotes_client_idx ON package_quotes(client_id);
CREATE INDEX IF NOT EXISTS package_quotes_policy_idx ON package_quotes(policy_id);
DROP TRIGGER IF EXISTS package_quotes_updated ON package_quotes;
CREATE TRIGGER package_quotes_updated BEFORE UPDATE ON package_quotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sections of a package quotation (entity_type 'quote') or of a package policy (entity_type 'policy').
CREATE TABLE IF NOT EXISTS package_sections (
  id serial PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('quote', 'policy')),
  entity_id text NOT NULL,
  section_no int NOT NULL,
  name text NOT NULL,
  product_id int NOT NULL REFERENCES products(id),
  line text,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  rate_table_id int REFERENCES insurer_rate_tables(id),
  sum_insured numeric(14,2) NOT NULL DEFAULT 0,
  rate_basis text NOT NULL DEFAULT 'percent',
  rate numeric(12,6) NOT NULL DEFAULT 0,
  base_premium numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0, premium_tax numeric(14,2) NOT NULL DEFAULT 0, dst numeric(14,2) NOT NULL DEFAULT 0,
  fst numeric(14,2) NOT NULL DEFAULT 0, lgt numeric(14,2) NOT NULL DEFAULT 0, other_charges numeric(14,2) NOT NULL DEFAULT 0,
  total_charges numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_rate numeric(6,4) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  charges jsonb NOT NULL DEFAULT '[]',
  deductible text,
  benefits jsonb NOT NULL DEFAULT '[]',
  property boolean,
  insurer_reference text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, section_no));
CREATE INDEX IF NOT EXISTS package_sections_insurer_idx ON package_sections(insurance_company_id);
DROP TRIGGER IF EXISTS package_sections_updated ON package_sections;
CREATE TRIGGER package_sections_updated BEFORE UPDATE ON package_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Endorsements of one section of a package policy (change of sum insured with the additional premium billed to the
-- client and due to that section's insurer only).
CREATE TABLE IF NOT EXISTS package_endorsements (
  id text PRIMARY KEY DEFAULT ('pe_' || encode(gen_random_bytes(8), 'hex')),
  endorsement_number text NOT NULL UNIQUE,
  policy_id text NOT NULL REFERENCES policies(id),
  section_no int NOT NULL,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  effective_date date NOT NULL,
  sum_insured_before numeric(14,2) NOT NULL, sum_insured_after numeric(14,2) NOT NULL,
  prorata_factor numeric(9,6) NOT NULL DEFAULT 1,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  total_charges numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  charges jsonb NOT NULL DEFAULT '[]',
  receivable_id text,
  bill_number text,
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS package_endorsements_policy_idx ON package_endorsements(policy_id);

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('package_quote', 'Package Quotation', 'sales', 'PQ', 'Quotation of a packaged product bundle', 'migration'),
 ('package_policy', 'Package Policy', 'policy', 'PKG', 'Master policy number of a packaged product bundle (one number, sections underneath)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('packages.quote_validity_days', '30', 'packages', 'Days a package quotation stays valid', 'number'),
 ('packages.endorsement_prorata', 'true', 'packages', 'Price a section endorsement pro rata to the days left in the policy term (off: the full annual difference)', 'boolean'),
 ('packages.comparison_disclaimer', '"Premiums are indicative and subject to the insurer''s acceptance of the risk, the policy wording and the final underwriting information."', 'packages', 'Note printed on the insurer comparison given to the client', 'string'),
 ('packages.flat_charges_on_first_section', 'true', 'packages', 'Charge flat charges (notarial fee, stamps) once per package, on its first section', 'boolean')
ON CONFLICT (key) DO NOTHING;
