-- Client onboarding and customer due diligence (AMLA, RA 9160 as amended; 2018 IRR; AMLC rules for covered persons;
-- IC circulars on AML for insurance intermediaries).
--
-- clients: identification of an individual (middle name, place of birth, civil status, nationality, occupation or
-- nature of work, employer, source of funds, presented ID with expiry) and of a juridical client (registered name in
-- company_name, trade name, registration with the SEC, DTI or CDA, date of registration, nature of business, country of
-- incorporation), the PEP declaration, the business the client expects to place (lines, payment mode, annual premium)
-- used by the risk rating before the first policy, and the result of customer due diligence: KYC status, risk rating
-- and the date of the next KYC refresh. onboarded_via says how the record was created: the onboarding screen, a lead
-- converted at policy issue, a direct placement, a go-live load.
-- customer_type is the code of the Customer Type master (Individual, Sole Proprietorship, Stock Corporation, Cooperative ...).
--
-- client_signatories: authorised signatories of a juridical client, each with the board resolution or secretary's
-- certificate that authorises them.
-- client_beneficial_owners: natural persons who own or control a juridical client (ownership at or above
-- aml.beneficial_owner_threshold percent, control by other means, or the senior managing official when no one does).
-- client_kyc_documents: documents of the due diligence (IDs, registration certificates, board resolutions, EDD
-- evidence), each a stored file (documents.storage_key) linked to the client and optionally to a signatory, a beneficial
-- owner or an EDD review.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS suffix text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS place_of_birth text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS civil_status text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS employer_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_of_funds text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_type text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_expiry date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS customer_type text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS trade_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS registration_authority text CHECK (registration_authority IS NULL OR registration_authority IN ('SEC', 'DTI', 'CDA', 'Other'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS registration_date date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_nature text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS incorporation_country text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_pep boolean NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pep_details text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS expected_lines text[] NOT NULL DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS expected_payment_mode text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS expected_annual_premium numeric(16,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'complete', 'edd-required', 'refresh-due', 'blocked'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS risk_rating text CHECK (risk_rating IS NULL OR risk_rating IN ('low', 'normal', 'high'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS risk_score integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS risk_assessed_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_reviewed_on date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_next_review_on date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_via text NOT NULL DEFAULT 'policy-issue';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
CREATE INDEX IF NOT EXISTS clients_risk_rating_idx ON clients(risk_rating, kyc_next_review_on);
CREATE INDEX IF NOT EXISTS clients_kyc_status_idx ON clients(kyc_status);

CREATE TABLE IF NOT EXISTS client_signatories (
  id text PRIMARY KEY DEFAULT ('sig_' || encode(gen_random_bytes(8), 'hex')),
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  position text,
  nationality text,
  birth_date date,
  id_type text,
  id_number text,
  authority_document text NOT NULL DEFAULT 'board-resolution' CHECK (authority_document IN ('board-resolution', 'secretary-certificate', 'partnership-resolution', 'special-power-of-attorney', 'other')),
  authority_reference text,
  authority_date date,
  authority_valid_until date,
  signing_limit numeric(16,2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_signatories_client_idx ON client_signatories(client_id);

CREATE TABLE IF NOT EXISTS client_beneficial_owners (
  id text PRIMARY KEY DEFAULT ('bo_' || encode(gen_random_bytes(8), 'hex')),
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nationality text,
  birth_date date,
  ownership_percent numeric(7,4),
  control_type text NOT NULL DEFAULT 'ownership' CHECK (control_type IN ('ownership', 'control', 'senior-management')),
  id_type text,
  id_number text,
  address text,
  is_pep boolean NOT NULL DEFAULT false,
  pep_details text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ownership_percent IS NULL OR (ownership_percent >= 0 AND ownership_percent <= 100))
);
CREATE INDEX IF NOT EXISTS client_beneficial_owners_client_idx ON client_beneficial_owners(client_id);

CREATE TABLE IF NOT EXISTS client_kyc_documents (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('government-id', 'proof-of-address', 'tin', 'sec-registration', 'dti-registration', 'cda-registration',
    'articles-by-laws', 'gis', 'board-resolution', 'secretary-certificate', 'beneficial-owner-declaration', 'source-of-funds', 'edd-evidence', 'other')),
  related_type text NOT NULL DEFAULT 'client' CHECK (related_type IN ('client', 'signatory', 'beneficial-owner', 'edd')),
  related_id text,
  description text,
  storage_key text NOT NULL,
  file_name text,
  expiry_date date,
  uploaded_by text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_kyc_documents_client_idx ON client_kyc_documents(client_id, related_type, related_id);
