-- Leads, clients, quotations, policies, endorsements, claims, renewals
CREATE TABLE clients (
  id text PRIMARY KEY DEFAULT ('cl_' || encode(gen_random_bytes(8), 'hex')),
  client_code text UNIQUE,
  client_type text NOT NULL DEFAULT 'individual',   -- individual | corporate
  first_name text, last_name text, company_name text,
  display_name text NOT NULL,
  email text, phone text, tin text, birth_date date, gender text,
  address text, city text, state text, country text, postal_code text,
  source text, status text NOT NULL DEFAULT 'active',
  owner_user_id text REFERENCES users(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE leads (
  id text PRIMARY KEY DEFAULT ('ld_' || encode(gen_random_bytes(8), 'hex')),
  lead_number text UNIQUE,
  lead_type text NOT NULL DEFAULT 'individual',
  first_name text, last_name text, company_name text,
  display_name text NOT NULL,
  email text, phone text, birth_date date, gender text,
  address text, city text, state text, country text, postal_code text,
  product_id int REFERENCES products(id), product_interest text,
  source text, notes text,
  status text NOT NULL DEFAULT 'new',               -- new | contacted | qualified | quoted | converted | lost
  client_id text REFERENCES clients(id),
  owner_user_id text REFERENCES users(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE quotes (
  id text PRIMARY KEY DEFAULT ('qt_' || encode(gen_random_bytes(8), 'hex')),
  quote_number text UNIQUE,
  lead_id text REFERENCES leads(id), client_id text REFERENCES clients(id),
  product_id int REFERENCES products(id), policy_type_id int REFERENCES policy_types(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  agent_user_id text REFERENCES users(id), signatory_id int REFERENCES signatories(id),
  status text NOT NULL DEFAULT 'draft',             -- draft | quoted | sent | accepted | converted | expired | rejected
  -- vehicle details (motor)
  vehicle jsonb NOT NULL DEFAULT '{}',              -- brand, model, variant, year, plateNo, chassisNo, engineNo, seating, fmv
  coverage jsonb NOT NULL DEFAULT '{}',             -- biCoverageId, pdCoverageId, paCoverageId, addOns
  sum_insured numeric(14,2) NOT NULL DEFAULT 0,
  premium_base numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0, dst numeric(14,2) NOT NULL DEFAULT 0,
  lgt numeric(14,2) NOT NULL DEFAULT 0, fst numeric(14,2) NOT NULL DEFAULT 0,
  premium_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_rate numeric(6,4), commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  valid_until date, remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE policies (
  id text PRIMARY KEY DEFAULT ('pol_' || encode(gen_random_bytes(8), 'hex')),
  policy_number text UNIQUE,
  quote_id text REFERENCES quotes(id), client_id text REFERENCES clients(id),
  product_id int REFERENCES products(id), policy_type_id int REFERENCES policy_types(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  owner_user_id text REFERENCES users(id),
  status text NOT NULL DEFAULT 'issued',            -- issued | active | expired | cancelled | renewed
  inception_date date NOT NULL DEFAULT current_date, expiry_date date NOT NULL,
  sum_insured numeric(14,2) NOT NULL DEFAULT 0, premium_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'PHP',
  bill_number text, details jsonb NOT NULL DEFAULT '{}',
  renewed_from text REFERENCES policies(id), renewed_to text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE endorsements (
  id text PRIMARY KEY DEFAULT ('end_' || encode(gen_random_bytes(8), 'hex')),
  endorsement_number text UNIQUE,
  policy_id text NOT NULL REFERENCES policies(id), client_id text REFERENCES clients(id),
  endorsement_type text NOT NULL,                   -- address | vehicle | coverage | cancellation | other
  status text NOT NULL DEFAULT 'draft',             -- draft | submitted | approved | completed | rejected
  changes jsonb NOT NULL DEFAULT '{}', premium_delta numeric(14,2) NOT NULL DEFAULT 0,
  effective_date date, remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE claims (
  id text PRIMARY KEY DEFAULT ('clm_' || encode(gen_random_bytes(8), 'hex')),
  claim_number text UNIQUE,
  policy_id text NOT NULL REFERENCES policies(id), client_id text REFERENCES clients(id),
  status text NOT NULL DEFAULT 'registered',        -- registered | in-review | approved | settled | closed | rejected
  loss_date date NOT NULL, reported_date date NOT NULL DEFAULT current_date,
  loss_type text, description text, estimate_amount numeric(14,2) NOT NULL DEFAULT 0,
  approved_amount numeric(14,2), settled_amount numeric(14,2), settled_at timestamptz,
  handler_user_id text REFERENCES users(id), details jsonb NOT NULL DEFAULT '{}',
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE claim_history (
  id bigserial PRIMARY KEY, claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(), by_user text, status text NOT NULL, note text);
CREATE TABLE renewals (
  id text PRIMARY KEY DEFAULT ('rnw_' || encode(gen_random_bytes(8), 'hex')),
  policy_id text NOT NULL REFERENCES policies(id),
  status text NOT NULL DEFAULT 'pipeline',          -- pipeline | notice-1 | notice-2 | final-notice | quoted | renewed | lapsed
  due_date date NOT NULL, new_policy_id text REFERENCES policies(id),
  premium_old numeric(14,2), premium_new numeric(14,2), remarks text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX leads_status_idx ON leads(status); CREATE INDEX quotes_status_idx ON quotes(status);
CREATE INDEX policies_expiry_idx ON policies(expiry_date); CREATE INDEX claims_status_idx ON claims(status);
