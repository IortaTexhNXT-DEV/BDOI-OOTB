-- Risk-based customer due diligence and name screening (AMLA as amended, 2018 IRR rules on CDD, EDD, PEPs and
-- targeted financial sanctions).
--
-- aml_risk_factors: the scoring table of the customer risk rating, maintained on Compliance > AML Settings. A factor
-- (client type, nationality, PEP, line of business, payment mode, premium size, geography) scores the value it matches;
-- match_value '*' is the score of any other value; premium size matches the band [min_amount, max_amount). The rating is
-- Low up to aml.risk_low_max_score, High from aml.risk_high_min_score, Normal between.
-- aml_risk_assessments: every rating made (onboarding, policy issue, KYC refresh, manual), with the factors that scored,
-- and the compliance officer's override when there is one. clients.risk_rating holds the latest.
-- aml_edd_reviews: enhanced due diligence of a High-risk client: source of wealth and funds, purpose, findings and
-- evidence (client_kyc_documents related_type 'edd'), submitted by the preparer and approved or rejected by a compliance
-- officer (approve:aml) who is not the preparer.
--
-- aml_screening_lists / aml_list_versions / aml_list_entries: the lists screened against (UN Security Council
-- consolidated list, AMLC designations and sanctions resolutions, PEP list, internal negative list, others), each
-- version kept with its file name, format, checksum and entries; only the current version of an active list is screened.
-- aml_screenings / aml_screening_hits: every screening run (party, event, provider) and the potential matches with
-- their score, decided on Compliance > Screening Hits: cleared (false positive), escalated (to an AML case) or
-- confirmed (true match: the client is blocked and rated High).
-- aml_provider_requests: outbox of the requests to a commercial screening provider (status, attempts, next attempt,
-- response), retried by the aml-provider-retry job.

CREATE TABLE IF NOT EXISTS aml_risk_factors (
  id serial PRIMARY KEY,
  factor text NOT NULL CHECK (factor IN ('client-type', 'nationality', 'pep', 'line', 'payment-mode', 'premium-size', 'geography')),
  match_value text NOT NULL DEFAULT '*',
  min_amount numeric(16,2),
  max_amount numeric(16,2),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS aml_risk_factors_value_uidx ON aml_risk_factors(factor, lower(match_value), COALESCE(min_amount, -1)) ;

CREATE TABLE IF NOT EXISTS aml_risk_assessments (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trigger text NOT NULL CHECK (trigger IN ('onboarding', 'policy-issue', 'refresh', 'manual', 'screening', 'override')),
  score integer NOT NULL,
  computed_rating text NOT NULL CHECK (computed_rating IN ('low', 'normal', 'high')),
  rating text NOT NULL CHECK (rating IN ('low', 'normal', 'high')),
  factors jsonb NOT NULL DEFAULT '[]',
  override_reason text,
  next_review_on date,
  reference text,
  assessed_by text,
  assessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aml_risk_assessments_client_idx ON aml_risk_assessments(client_id, assessed_at DESC);

CREATE TABLE IF NOT EXISTS aml_edd_reviews (
  id text PRIMARY KEY DEFAULT ('edd_' || encode(gen_random_bytes(8), 'hex')),
  review_number text NOT NULL UNIQUE,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assessment_id bigint REFERENCES aml_risk_assessments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved', 'rejected')),
  reason text,
  source_of_wealth text,
  source_of_funds text,
  purpose text,
  findings text,
  senior_management_approval boolean NOT NULL DEFAULT false,
  submitted_by text,
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aml_edd_reviews_client_idx ON aml_edd_reviews(client_id, status);
CREATE INDEX IF NOT EXISTS aml_edd_reviews_status_idx ON aml_edd_reviews(status);
CREATE INDEX IF NOT EXISTS aml_edd_reviews_assessment_idx ON aml_edd_reviews(assessment_id);

CREATE TABLE IF NOT EXISTS aml_screening_lists (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{2,30}$'),
  name text NOT NULL,
  list_type text NOT NULL CHECK (list_type IN ('sanctions', 'designation', 'pep', 'negative', 'other')),
  source text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  current_version_id bigint,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aml_list_versions (
  id bigserial PRIMARY KEY,
  list_id integer NOT NULL REFERENCES aml_screening_lists(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  file_name text,
  format text NOT NULL CHECK (format IN ('csv', 'xlsx', 'xml', 'manual')),
  checksum text,
  entries_count integer NOT NULL DEFAULT 0,
  publication_date date,
  notes text,
  loaded_by text,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  rescreened_at timestamptz,
  rescreen_summary jsonb,
  UNIQUE (list_id, version_no)
);
ALTER TABLE aml_screening_lists DROP CONSTRAINT IF EXISTS aml_screening_lists_current_version_fk;
ALTER TABLE aml_screening_lists ADD CONSTRAINT aml_screening_lists_current_version_fk FOREIGN KEY (current_version_id) REFERENCES aml_list_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS aml_screening_lists_current_version_idx ON aml_screening_lists(current_version_id);

CREATE TABLE IF NOT EXISTS aml_list_entries (
  id bigserial PRIMARY KEY,
  list_id integer NOT NULL REFERENCES aml_screening_lists(id) ON DELETE CASCADE,
  version_id bigint NOT NULL REFERENCES aml_list_versions(id) ON DELETE CASCADE,
  entry_ref text,
  entity_type text NOT NULL DEFAULT 'individual' CHECK (entity_type IN ('individual', 'entity')),
  full_name text NOT NULL,
  normalized_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  birth_date text,
  nationality text,
  remarks text,
  removed_at timestamptz,
  removed_by text
);
CREATE INDEX IF NOT EXISTS aml_list_entries_version_idx ON aml_list_entries(version_id);
CREATE INDEX IF NOT EXISTS aml_list_entries_list_idx ON aml_list_entries(list_id);

CREATE TABLE IF NOT EXISTS aml_screenings (
  id bigserial PRIMARY KEY,
  client_id text,
  party_type text NOT NULL CHECK (party_type IN ('client', 'beneficial-owner', 'signatory', 'payee')),
  party_id text,
  party_name text NOT NULL,
  event text NOT NULL CHECK (event IN ('onboarding', 'policy-issue', 'payout', 'rescreen', 'manual')),
  reference_type text,
  reference_id text,
  provider text NOT NULL DEFAULT 'lists',
  status text NOT NULL CHECK (status IN ('clear', 'potential-match', 'provider-pending', 'error')),
  hits integer NOT NULL DEFAULT 0,
  open_hits integer NOT NULL DEFAULT 0,
  message text,
  screened_by text,
  screened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aml_screenings_client_idx ON aml_screenings(client_id, screened_at DESC);
CREATE INDEX IF NOT EXISTS aml_screenings_reference_idx ON aml_screenings(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS aml_screening_hits (
  id bigserial PRIMARY KEY,
  screening_id bigint NOT NULL REFERENCES aml_screenings(id) ON DELETE CASCADE,
  client_id text,
  party_type text NOT NULL,
  party_id text,
  party_name text NOT NULL,
  party_key text NOT NULL,
  list_id integer REFERENCES aml_screening_lists(id) ON DELETE SET NULL,
  list_code text,
  version_id bigint REFERENCES aml_list_versions(id) ON DELETE SET NULL,
  entry_id bigint REFERENCES aml_list_entries(id) ON DELETE SET NULL,
  entry_ref text,
  matched_name text NOT NULL,
  score numeric(5,4) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'escalated', 'confirmed')),
  decision_reason text,
  decided_by text,
  decided_at timestamptz,
  case_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aml_screening_hits_status_idx ON aml_screening_hits(status, created_at DESC);
CREATE INDEX IF NOT EXISTS aml_screening_hits_client_idx ON aml_screening_hits(client_id);
CREATE INDEX IF NOT EXISTS aml_screening_hits_party_idx ON aml_screening_hits(party_key, list_code, entry_ref);
CREATE INDEX IF NOT EXISTS aml_screening_hits_screening_idx ON aml_screening_hits(screening_id);
CREATE INDEX IF NOT EXISTS aml_screening_hits_list_idx ON aml_screening_hits(list_id);
CREATE INDEX IF NOT EXISTS aml_screening_hits_version_idx ON aml_screening_hits(version_id);
CREATE INDEX IF NOT EXISTS aml_screening_hits_entry_idx ON aml_screening_hits(entry_id);

CREATE TABLE IF NOT EXISTS aml_provider_requests (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'live')),
  screening_id bigint REFERENCES aml_screenings(id) ON DELETE SET NULL,
  party_name text NOT NULL,
  request jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'abandoned')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  response jsonb,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aml_provider_requests_status_idx ON aml_provider_requests(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS aml_provider_requests_screening_idx ON aml_provider_requests(screening_id);
