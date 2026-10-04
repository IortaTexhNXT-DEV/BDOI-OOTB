-- Insurance Commission compliance: licence register and fit and proper records (Compliance > Insurance Commission).
--
-- compliance_licences: the licences the IC (or another authority) issued to the firm (the broker's licence), to its
-- licensed officers and individuals, and to the agents, sub-agents and referrers it pays commission to. One row per
-- licence term: a renewal is recorded as a new row and the old one is marked superseded (superseded_by). Expiry
-- reminders go out compliance.licence_reminder_days before expiry (daily job compliance-reminders, notify()); the
-- reminders sent are kept in compliance_licence_reminders so each is sent once per licence term and threshold.
-- Commission to a referrer whose type requires a licence (compliance.licence_required_referrer_types) cannot be
-- approved or paid without a licence in force (compliance.referrer_licence_check: block, warn or off).
--
-- compliance_fit_proper: fit and proper record of each director and officer: the declarations signed (items in
-- compliance.fit_proper_declarations), supporting documents, the review outcome and the next review date
-- (compliance.fit_proper_review_months after the last review).

CREATE TABLE IF NOT EXISTS compliance_licences (
  id text PRIMARY KEY DEFAULT ('lic_' || encode(gen_random_bytes(8), 'hex')),
  holder_type text NOT NULL CHECK (holder_type IN ('firm', 'officer', 'individual', 'referrer')),
  referrer_id text REFERENCES commission_referrers(id),
  user_id text REFERENCES users(id),
  holder_name text NOT NULL,
  position text,
  licence_type text NOT NULL,
  licence_number text,
  issuing_authority text NOT NULL DEFAULT 'Insurance Commission',
  lines_authorised text,
  issue_date date,
  expiry_date date,
  renewal_status text NOT NULL DEFAULT 'not-due' CHECK (renewal_status IN ('not-due', 'due', 'in-progress', 'filed', 'renewed', 'lapsed')),
  renewal_filed_on date,
  renewal_reference text,
  superseded_by text REFERENCES compliance_licences(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'revoked', 'surrendered')),
  documents jsonb NOT NULL DEFAULT '[]',
  remarks text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (holder_type <> 'referrer' OR referrer_id IS NOT NULL),
  CHECK (expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date)
);
CREATE INDEX IF NOT EXISTS compliance_licences_referrer_id_fk_idx ON compliance_licences(referrer_id);
CREATE INDEX IF NOT EXISTS compliance_licences_user_id_fk_idx ON compliance_licences(user_id);
CREATE INDEX IF NOT EXISTS compliance_licences_superseded_by_fk_idx ON compliance_licences(superseded_by);
CREATE INDEX IF NOT EXISTS compliance_licences_expiry_idx ON compliance_licences(expiry_date) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS compliance_licence_reminders (
  licence_id text NOT NULL REFERENCES compliance_licences(id) ON DELETE CASCADE,
  expiry_date date NOT NULL,
  days_before int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (licence_id, expiry_date, days_before)
);

CREATE TABLE IF NOT EXISTS compliance_fit_proper (
  id text PRIMARY KEY DEFAULT ('fp_' || encode(gen_random_bytes(8), 'hex')),
  person_name text NOT NULL,
  user_id text REFERENCES users(id),
  role_category text NOT NULL CHECK (role_category IN ('director', 'officer', 'compliance-officer', 'key-person')),
  position text NOT NULL,
  appointed_on date,
  ceased_on date,
  declarations jsonb NOT NULL DEFAULT '[]',
  declaration_signed_on date,
  last_review_on date,
  next_review_on date,
  review_outcome text NOT NULL DEFAULT 'pending' CHECK (review_outcome IN ('pending', 'fit', 'conditional', 'not-fit')),
  reviewed_by text,
  review_notes text,
  documents jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ceased')),
  remarks text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_fit_proper_user_id_fk_idx ON compliance_fit_proper(user_id);
CREATE INDEX IF NOT EXISTS compliance_fit_proper_review_idx ON compliance_fit_proper(next_review_on) WHERE status = 'active';

INSERT INTO permissions(code, module, description) VALUES
 ('read:compliance', 'compliance', 'View the Insurance Commission registers (licences, fit and proper, insurer authority) and the IC reports'),
 ('write:compliance', 'compliance', 'Maintain the licence register, the fit and proper records and the IC statement mapping')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code IN ('system-admin', 'operations') AND p.code IN ('read:compliance', 'write:compliance'))
    OR (r.code IN ('accounting', 'accounting-manager') AND p.code = 'read:compliance')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('compliance.licence_types', '["Insurance Broker (Non-life)", "Insurance Broker (Life)", "Reinsurance Broker", "Non-life Insurance Agent", "Life Insurance Agent", "General Agent", "Sub-agent", "Adjuster", "Other"]',
  'compliance', 'Licence types offered on the licence register', 'json'),
 ('compliance.licence_reminder_days', '[90, 60, 30, 15, 7]', 'compliance', 'Days before a licence expires when its holder''s compliance team is reminded (one reminder per threshold)', 'json'),
 ('compliance.licence_expiring_days', '90', 'compliance', 'Licences expiring within this many days are shown as expiring on the licence dashboard', 'number'),
 ('compliance.referrer_licence_check', '"block"', 'compliance', 'Commission to a referrer whose type requires a licence, when the licence is missing or expired: block (approval and payment refused), warn (allowed and recorded) or off', 'string'),
 ('compliance.licence_required_referrer_types', '["Agent", "Sub-agent"]', 'compliance', 'Referrer types that must hold a licence in force before their commission is approved or paid', 'json'),
 ('compliance.fit_proper_review_months', '12', 'compliance', 'Months between two fit and proper reviews of a director or officer', 'number'),
 ('compliance.fit_proper_reminder_days', '30', 'compliance', 'Days before a fit and proper review is due when the compliance team is reminded', 'number'),
 ('compliance.fit_proper_declarations', '["Has not been convicted by final judgment of an offence involving moral turpitude, fraud or dishonesty", "Has not been found administratively liable by the Insurance Commission, SEC, BSP or another regulator for a violation of the laws they administer", "Is not an undischarged insolvent or bankrupt", "Has not been dismissed for cause from a financial institution or from public office", "Is not a director, officer or employee of a competing insurer, broker or agency without disclosure", "Has disclosed every business interest and related party that may give rise to a conflict of interest", "Meets the qualifications of education, experience and training required for the position"]',
  'compliance', 'Declarations a director or officer answers on the fit and proper record (confirm the list with the compliance officer against the IC rules in force)', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('compliance-reminders', 'Compliance reminders', 'Remind the compliance team (read:compliance) of licences approaching expiry (compliance.licence_reminder_days), fit and proper reviews falling due and insurers whose IC certificate of authority is expiring', '45 6 * * *', 'complianceReminders', '{}', true)
ON CONFLICT (code) DO NOTHING;
