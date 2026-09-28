-- Sales and policy administration: address lookups, and the document fields the lead / client / quotation /
-- policy / endorsement screens send and read. Shared tables are only extended (ADD COLUMN IF NOT EXISTS).

-- Address masters below city level (barangay / district) and a postal-code lookup used to auto-fill addresses
CREATE TABLE IF NOT EXISTS districts (
  id serial PRIMARY KEY,
  city_id int NOT NULL REFERENCES cities(id),
  name text NOT NULL,
  postal_code text,
  status text NOT NULL DEFAULT 'active',
  UNIQUE (city_id, name)
);
CREATE TABLE IF NOT EXISTS postal_codes (
  id serial PRIMARY KEY,
  country_code text NOT NULL,
  code text NOT NULL,
  province text NOT NULL,
  city text NOT NULL,
  district text NOT NULL DEFAULT '',
  UNIQUE (country_code, code, district)
);
CREATE INDEX IF NOT EXISTS postal_codes_lookup_idx ON postal_codes(country_code, code);

-- Leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_category text NOT NULL DEFAULT 'Retail';   -- Retail | Corporate
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lob text NOT NULL DEFAULT 'MOTOR';               -- MOTOR | FIRE | IAR | ...
ALTER TABLE leads ADD COLUMN IF NOT EXISTS house_no text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS barangay text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS road text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS soi text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS moo text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tax_number text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);

-- Clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS house_no text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS barangay text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS road text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS soi text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS moo text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_id text REFERENCES leads(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_category text NOT NULL DEFAULT 'Retail';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by text;
CREATE UNIQUE INDEX IF NOT EXISTS clients_lead_uidx ON clients(lead_id) WHERE lead_id IS NOT NULL;

-- Quotations: key columns for search and workflow; `doc` keeps the full document the quote wizard sends
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS product_type text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lob text;                                    -- null: derived from the product line
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS doc jsonb NOT NULL DEFAULT '{}';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ncd numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS others numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approval_token_hash text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approval_sent_to text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approval_sent_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_accepted_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS submitted_to_insurer_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS policy_id text REFERENCES policies(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS quotes_lead_idx ON quotes(lead_id);
CREATE INDEX IF NOT EXISTS quotes_created_idx ON quotes(created_at DESC);

-- Policies
ALTER TABLE policies ADD COLUMN IF NOT EXISTS lead_id text REFERENCES leads(id);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Pending'; -- Pending | Reviewing | Partial | Completed | Refunded
ALTER TABLE policies ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS insured_name text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS product_type text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS lob text;                                  -- null: derived from the product line
ALTER TABLE policies ADD COLUMN IF NOT EXISTS issued_date date;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS net_premium numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS doc jsonb NOT NULL DEFAULT '{}';
ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_by text;
CREATE INDEX IF NOT EXISTS policies_quote_idx ON policies(quote_id);
CREATE INDEX IF NOT EXISTS policies_client_idx ON policies(client_id);

-- Endorsements
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorsement_type_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS is_cancel boolean NOT NULL DEFAULT false;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS cancellation_type text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS document_key text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS completion jsonb NOT NULL DEFAULT '{}';
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS sent_by text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS completed_by text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS receivable_id text REFERENCES receivables(id);
CREATE INDEX IF NOT EXISTS endorsements_policy_idx ON endorsements(policy_id);

-- Commission accrual rows created at policy issuance keep a link to the quotation they came from
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS quote_id text REFERENCES quotes(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS endorsement_id text REFERENCES endorsements(id);
