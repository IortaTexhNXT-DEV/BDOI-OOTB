-- Data privacy (Data Privacy Act of 2012, RA 10173, and the NPC implementing rules).
--
-- privacy_consents: consent given or refused by a client or a prospect (lead) per purpose: 'processing' (privacy
-- notice acknowledged), 'marketing', and 'sharing' (with insurers and reinsurers for placement and claims). A purpose's
-- current status is its latest record; a withdrawal is stamped on the granted record it ends. Records are never
-- deleted, so the history is the evidence.
--
-- data_subject_requests: the register of requests made by data subjects (access, rectification, erasure or blocking,
-- objection, portability, withdrawal of consent), numbered from the DSR series, due privacy.request_due_days calendar
-- days after receipt. The daily job privacy-requests-due notifies read:privacy holders of overdue open requests.
--
-- clients.anonymised_at / leads.anonymised_at: set when the personal data of the party were overwritten (erasure once
-- the retention period of the insurance and tax records is over); amounts, numbers and dates stay for the books.

CREATE TABLE IF NOT EXISTS privacy_consents (
  id bigserial PRIMARY KEY,
  party_type text NOT NULL CHECK (party_type IN ('client', 'lead')),
  party_id text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('processing', 'marketing', 'sharing')),
  granted boolean NOT NULL,
  channel text NOT NULL CHECK (channel IN ('Form', 'E-mail', 'Phone', 'Portal', 'In person')),
  notice_version text,
  evidence text,
  recorded_by text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  withdrawn_by text,
  withdrawal_reason text
);
CREATE INDEX IF NOT EXISTS privacy_consents_party_idx ON privacy_consents(party_type, party_id, purpose, recorded_at DESC);
CREATE INDEX IF NOT EXISTS privacy_consents_recorded_idx ON privacy_consents(recorded_at DESC);

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id text PRIMARY KEY DEFAULT ('dsr_' || encode(gen_random_bytes(8), 'hex')),
  request_number text NOT NULL UNIQUE,
  party_type text CHECK (party_type IN ('client', 'lead')),
  party_id text,
  requester_name text NOT NULL,
  requester_contact text,
  request_type text NOT NULL CHECK (request_type IN ('access', 'rectification', 'erasure', 'objection', 'portability', 'withdraw-consent')),
  description text,
  received_on date NOT NULL,
  due_on date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'completed', 'rejected')),
  assigned_to text REFERENCES users(id),
  outcome text,
  response_notes text,
  actions jsonb NOT NULL DEFAULT '[]',                -- exports and anonymisation done for the request
  closed_on date,
  closed_by text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((party_type IS NULL) = (party_id IS NULL))
);
CREATE INDEX IF NOT EXISTS data_subject_requests_status_idx ON data_subject_requests(status, due_on);
CREATE INDEX IF NOT EXISTS data_subject_requests_party_idx ON data_subject_requests(party_type, party_id);
CREATE INDEX IF NOT EXISTS data_subject_requests_assigned_to_idx ON data_subject_requests(assigned_to);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS anonymised_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS anonymised_by text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS anonymised_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS anonymised_by text;

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('data_subject_request', 'Data Subject Request', 'privacy', 'DSR', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'Request of a data subject under the Data Privacy Act (Master > Data Privacy > Data Subject Requests)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('read:privacy', 'privacy', 'View the data subject request register, the consent register and export personal data'),
 ('write:privacy', 'privacy', 'Log and close data subject requests and anonymise the personal data of a client or prospect')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code IN ('system-admin', 'operations') AND p.code IN ('read:privacy', 'write:privacy')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('privacy.notice_version', '"1.0"', 'privacy', 'Version of the privacy notice in force (recorded with every consent)', 'string'),
 ('privacy.request_due_days', '15', 'privacy', 'Calendar days to act on a data subject request (due date = date received + days)', 'number'),
 ('privacy.retention_years', '10', 'privacy', 'Years the records of a client are kept after the last policy expiry before its personal data may be anonymised', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('privacy-requests-due', 'Overdue data subject requests', 'Notify the data privacy team (read:privacy) of open data subject requests past their due date', '0 7 * * *', 'privacyRequestsDue', '{}', false)
ON CONFLICT (code) DO NOTHING;
