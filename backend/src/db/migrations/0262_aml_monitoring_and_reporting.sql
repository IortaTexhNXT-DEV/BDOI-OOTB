-- Covered and suspicious transaction monitoring, AML cases and AMLC report files.
--
-- aml_rules: the monitoring rules with their parameters, switched on and tuned on Compliance > AML Settings. kind
-- 'covered' marks a covered transaction (a cash transaction above aml.covered_threshold within one banking day),
-- 'suspicious' a red flag that the compliance officer reviews before deciding on a suspicious transaction report.
-- aml_alerts: what a monitoring run found, one per rule and transaction (rule_code, reference_type, reference_id
-- unique, so a run repeated over the same days adds nothing twice). Closed with a reason, or escalated to a case.
-- aml_cases: the compliance officer's file on a client or a transaction: CTR to file, STR investigation, or review.
-- Due dates follow aml.ctr_due_working_days and aml.str_due_working_days from the transaction or from the
-- establishment of suspicion.
-- aml_reports / aml_report_items: the CTR and STR files generated in the AMLC reporting layout (format version on the
-- report), downloaded and filed by the compliance officer through the AMLC portal, then marked submitted with the
-- AMLC acknowledgement reference.

CREATE TABLE IF NOT EXISTS aml_rules (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_]{2,40}$'),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('covered', 'suspicious')),
  description text,
  params jsonb NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  enabled boolean NOT NULL DEFAULT true,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aml_cases (
  id text PRIMARY KEY DEFAULT ('amc_' || encode(gen_random_bytes(8), 'hex')),
  case_number text NOT NULL UNIQUE,
  case_type text NOT NULL CHECK (case_type IN ('CTR', 'STR', 'review')),
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  narrative text,
  suspicion_reasons text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'for-filing', 'filed', 'closed')),
  suspicion_on date,
  due_on date,
  assigned_to text REFERENCES users(id),
  approved_by text,
  approved_at timestamptz,
  filed_on date,
  amlc_reference text,
  closed_reason text,
  closed_by text,
  closed_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aml_cases_status_idx ON aml_cases(status, due_on);
CREATE INDEX IF NOT EXISTS aml_cases_client_idx ON aml_cases(client_id);
CREATE INDEX IF NOT EXISTS aml_cases_assigned_to_idx ON aml_cases(assigned_to);

CREATE TABLE IF NOT EXISTS aml_alerts (
  id text PRIMARY KEY DEFAULT ('aal_' || encode(gen_random_bytes(8), 'hex')),
  alert_number text NOT NULL UNIQUE,
  rule_code text NOT NULL REFERENCES aml_rules(code),
  kind text NOT NULL CHECK (kind IN ('covered', 'suspicious')),
  severity text NOT NULL DEFAULT 'medium',
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  reference_number text,
  transaction_date date NOT NULL,
  amount numeric(16,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'escalated', 'reported')),
  case_id text REFERENCES aml_cases(id) ON DELETE SET NULL,
  decision_reason text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_code, reference_type, reference_id)
);
CREATE INDEX IF NOT EXISTS aml_alerts_status_idx ON aml_alerts(status, transaction_date);
CREATE INDEX IF NOT EXISTS aml_alerts_client_idx ON aml_alerts(client_id);
CREATE INDEX IF NOT EXISTS aml_alerts_case_idx ON aml_alerts(case_id);

ALTER TABLE aml_screening_hits DROP CONSTRAINT IF EXISTS aml_screening_hits_case_fk;
ALTER TABLE aml_screening_hits ADD CONSTRAINT aml_screening_hits_case_fk FOREIGN KEY (case_id) REFERENCES aml_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS aml_screening_hits_case_idx ON aml_screening_hits(case_id);

CREATE TABLE IF NOT EXISTS aml_reports (
  id text PRIMARY KEY DEFAULT ('amr_' || encode(gen_random_bytes(8), 'hex')),
  report_number text NOT NULL UNIQUE,
  report_type text NOT NULL CHECK (report_type IN ('CTR', 'STR')),
  case_id text REFERENCES aml_cases(id) ON DELETE SET NULL,
  period_from date,
  period_to date,
  format_version text NOT NULL,
  file_name text NOT NULL,
  content text NOT NULL,
  transactions integer NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'submitted', 'acknowledged', 'rejected')),
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  submitted_on date,
  submitted_by text,
  amlc_reference text,
  amlc_notes text
);
CREATE INDEX IF NOT EXISTS aml_reports_case_idx ON aml_reports(case_id);
CREATE INDEX IF NOT EXISTS aml_reports_type_idx ON aml_reports(report_type, generated_at DESC);

CREATE TABLE IF NOT EXISTS aml_report_items (
  report_id text NOT NULL REFERENCES aml_reports(id) ON DELETE CASCADE,
  alert_id text NOT NULL REFERENCES aml_alerts(id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, alert_id)
);
CREATE INDEX IF NOT EXISTS aml_report_items_alert_idx ON aml_report_items(alert_id);
