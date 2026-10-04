-- Personal data breach and security incident register (Data Privacy Act of 2012; NPC Circular 16-03 on personal data
-- breach management and the NPC rules that followed it): Compliance > Data Privacy > Breach Register.
--
-- An incident is logged when it is discovered (PDB series). The assessment records the criteria of a notifiable breach:
-- sensitive personal information or information that may be used to enable identity fraud, reasonably believed to have
-- been acquired by an unauthorised person, and likely to give rise to a real risk of serious harm to the data subjects.
-- A notifiable breach must be notified to the NPC within privacy.breach_notify_hours (72) of knowledge: the register
-- shows the deadline and the hours left, the hourly job privacy-breach-deadlines reminds the data privacy team
-- (read:privacy) as the deadline approaches and when it has passed. The notification to the NPC (date, reference, the
-- reason for any delay) and to the data subjects (date, number, method) are recorded with their documents. The annual
-- security incident report (Excel) summarises the incidents and breaches of a calendar year.

CREATE TABLE IF NOT EXISTS personal_data_breaches (
  id text PRIMARY KEY DEFAULT ('pdb_' || encode(gen_random_bytes(8), 'hex')),
  breach_number text NOT NULL UNIQUE,
  incident_type text NOT NULL DEFAULT 'personal-data-breach' CHECK (incident_type IN ('personal-data-breach', 'security-incident')),
  title text NOT NULL,
  description text,
  discovered_at timestamptz NOT NULL,
  occurred_at timestamptz,
  reported_by text,
  nature jsonb NOT NULL DEFAULT '[]',
  data_categories jsonb NOT NULL DEFAULT '[]',
  sensitive_data boolean NOT NULL DEFAULT false,
  identity_fraud_risk boolean NOT NULL DEFAULT false,
  unauthorised_acquisition boolean NOT NULL DEFAULT false,
  real_risk_of_harm boolean NOT NULL DEFAULT false,
  subjects_affected int CHECK (subjects_affected IS NULL OR subjects_affected >= 0),
  records_affected int CHECK (records_affected IS NULL OR records_affected >= 0),
  systems_affected text,
  cause text,
  containment text,
  remediation text,
  assessment_notes text,
  assessed_at timestamptz,
  assessed_by text,
  notifiable boolean,
  notifiable_override_reason text,
  npc_due_at timestamptz NOT NULL,
  npc_notified_at timestamptz,
  npc_reference text,
  npc_notification_method text,
  npc_delay_reason text,
  subjects_notified_at timestamptz,
  subjects_notified_count int CHECK (subjects_notified_count IS NULL OR subjects_notified_count >= 0),
  subjects_notification_method text,
  subjects_not_notified_reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assessed', 'notified', 'closed')),
  dpo_user_id text REFERENCES users(id),
  closed_at timestamptz,
  closed_by text,
  closure_notes text,
  documents jsonb NOT NULL DEFAULT '[]',
  actions jsonb NOT NULL DEFAULT '[]',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personal_data_breaches_status_idx ON personal_data_breaches(status, npc_due_at);
CREATE INDEX IF NOT EXISTS personal_data_breaches_discovered_idx ON personal_data_breaches(discovered_at DESC);
CREATE INDEX IF NOT EXISTS personal_data_breaches_dpo_user_id_fk_idx ON personal_data_breaches(dpo_user_id);

CREATE TABLE IF NOT EXISTS personal_data_breach_reminders (
  breach_id text NOT NULL REFERENCES personal_data_breaches(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (breach_id, kind)
);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('data_breach', 'Personal Data Breach / Security Incident', 'privacy', 'PDB', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'Security incident or personal data breach (Compliance > Data Privacy > Breach Register)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('privacy.breach_notify_hours', '72', 'privacy', 'Hours from knowledge of a notifiable personal data breach to notify the National Privacy Commission', 'number'),
 ('privacy.breach_reminder_hours', '[48, 24, 6]', 'privacy', 'Hours before the NPC notification deadline when the data privacy team is reminded of a breach not yet notified', 'json'),
 ('privacy.breach_data_categories', '["Names and contact details", "Government ID numbers and TIN", "Birth dates", "Bank or payment details", "Health or medical information (claims)", "Policy and claim records", "Vehicle and property details", "Login credentials", "Other"]',
  'privacy', 'Categories of personal data offered on the breach register', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('privacy-breach-deadlines', 'Breach notification deadlines', 'Remind the data privacy team (read:privacy) of notifiable personal data breaches not yet notified to the NPC as the 72-hour deadline approaches and when it has passed', '15 * * * *', 'privacyBreachDeadlines', '{}', true)
ON CONFLICT (code) DO NOTHING;
