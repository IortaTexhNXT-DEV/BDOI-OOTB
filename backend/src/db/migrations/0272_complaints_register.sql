-- Complaints register (RA 11765, Financial Products and Services Consumer Protection Act, its implementing rules and the
-- Insurance Commission's rules on complaints handling by regulated entities): Compliance > Insurance Commission >
-- Complaints.
--
-- Each complaint is numbered from the CMP series. Deadlines are settings: acknowledgement complaints.ack_days after
-- receipt, resolution complaints.resolution_days_simple or complaints.resolution_days_complex after receipt (calendar
-- days). The daily job complaints-deadlines reminds the person assigned of deadlines falling due and, when
-- complaints.auto_escalate is on, escalates complaints whose resolution is overdue to the complaints officers
-- (approve:complaints). Acknowledgement and resolution letters are printed on the letterhead from the texts in
-- complaints.ack_letter_text and complaints.resolution_letter_text. Every step is kept in `actions` (the complaint's
-- history) and in the audit trail. The regulator report (Excel) lists the complaints of a period with their ageing.

CREATE TABLE IF NOT EXISTS complaints (
  id text PRIMARY KEY DEFAULT ('cmp_' || encode(gen_random_bytes(8), 'hex')),
  complaint_number text NOT NULL UNIQUE,
  received_at timestamptz NOT NULL,
  channel text NOT NULL,
  complainant_name text NOT NULL,
  complainant_contact text,
  complainant_type text NOT NULL DEFAULT 'client' CHECK (complainant_type IN ('client', 'claimant', 'prospect', 'third-party', 'other')),
  client_id text REFERENCES clients(id),
  policy_id text REFERENCES policies(id),
  claim_id text REFERENCES claims(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  category text NOT NULL,
  complexity text NOT NULL DEFAULT 'simple' CHECK (complexity IN ('simple', 'complex')),
  subject text NOT NULL,
  description text,
  amount_disputed numeric(14,2),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'acknowledged', 'in-progress', 'escalated', 'resolved', 'closed')),
  assigned_to text REFERENCES users(id),
  ack_due_on date NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolution_due_on date NOT NULL,
  resolved_at timestamptz,
  resolved_by text,
  outcome text CHECK (outcome IN ('upheld', 'partially-upheld', 'not-upheld', 'withdrawn')),
  resolution text,
  redress_amount numeric(14,2),
  escalation_level int NOT NULL DEFAULT 0,
  escalated_at timestamptz,
  escalation_reason text,
  referred_to_regulator boolean NOT NULL DEFAULT false,
  regulator_reference text,
  referred_on date,
  closed_at timestamptz,
  closed_by text,
  documents jsonb NOT NULL DEFAULT '[]',
  actions jsonb NOT NULL DEFAULT '[]',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints(status, resolution_due_on);
CREATE INDEX IF NOT EXISTS complaints_received_idx ON complaints(received_at DESC);
CREATE INDEX IF NOT EXISTS complaints_client_id_fk_idx ON complaints(client_id);
CREATE INDEX IF NOT EXISTS complaints_policy_id_fk_idx ON complaints(policy_id);
CREATE INDEX IF NOT EXISTS complaints_claim_id_fk_idx ON complaints(claim_id);
CREATE INDEX IF NOT EXISTS complaints_insurance_company_id_fk_idx ON complaints(insurance_company_id);
CREATE INDEX IF NOT EXISTS complaints_assigned_to_fk_idx ON complaints(assigned_to);

CREATE TABLE IF NOT EXISTS complaint_reminders (
  complaint_id text NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sent_on date NOT NULL,
  PRIMARY KEY (complaint_id, kind, sent_on)
);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('complaint', 'Complaint', 'compliance', 'CPT', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'Complaint of a client or claimant under RA 11765 (Compliance > Insurance Commission > Complaints)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('read:complaints', 'complaints', 'View the complaints register and the regulator report'),
 ('write:complaints', 'complaints', 'Log, acknowledge, assign, resolve and close complaints and print the response letters'),
 ('approve:complaints', 'complaints', 'Complaints officer: receive escalated complaints and refer complaints to the regulator')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code = 'system-admin' AND p.code IN ('read:complaints', 'write:complaints', 'approve:complaints'))
    OR (r.code IN ('operations', 'claims') AND p.code IN ('read:complaints', 'write:complaints'))
    OR (r.code = 'sales' AND p.code = 'read:complaints')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('complaints.channels', '["Walk-in", "Phone", "E-mail", "Letter", "Website or portal", "Social media", "Referred by insurer", "Referred by the Insurance Commission"]',
  'complaints', 'Channels a complaint can be received through', 'json'),
 ('complaints.categories', '["Claims handling", "Claim denied or reduced", "Premium, billing and payment", "Policy documents and coverage", "Cancellation and refund", "Renewal", "Service and conduct of staff", "Misrepresentation or mis-selling", "Data privacy", "Other"]',
  'complaints', 'Categories of complaints (used on the register and the regulator report)', 'json'),
 ('complaints.ack_days', '2', 'complaints', 'Calendar days from receipt to acknowledge a complaint (confirm against the rules of the Insurance Commission in force)', 'number'),
 ('complaints.resolution_days_simple', '7', 'complaints', 'Calendar days from receipt to resolve a simple complaint', 'number'),
 ('complaints.resolution_days_complex', '45', 'complaints', 'Calendar days from receipt to resolve a complex complaint', 'number'),
 ('complaints.auto_escalate', 'true', 'complaints', 'Escalate a complaint to the complaints officers (approve:complaints) automatically when its resolution is overdue', 'boolean'),
 ('complaints.ack_letter_text', '"We acknowledge receipt on {{receivedOn}} of your complaint concerning {{subject}}, recorded under reference {{complaintNumber}}. {{assignedTo}} will handle it and we will give you our response by {{resolutionDueOn}}. If you have further information, please quote the reference above."',
  'complaints', 'Text of the acknowledgement letter ({{complainantName}}, {{complaintNumber}}, {{receivedOn}}, {{subject}}, {{assignedTo}}, {{resolutionDueOn}})', 'string'),
 ('complaints.resolution_letter_text', '"We have completed our review of your complaint {{complaintNumber}} received on {{receivedOn}} concerning {{subject}}. Our findings and decision: {{resolution}}. If you are not satisfied with this response, you may elevate your complaint to the Insurance Commission, Public Assistance and Mediation, 1071 United Nations Avenue, Manila."',
  'complaints', 'Text of the resolution letter ({{complainantName}}, {{complaintNumber}}, {{receivedOn}}, {{subject}}, {{resolution}}, {{outcome}})', 'string')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('complaints-deadlines', 'Complaint deadlines', 'Remind the person assigned of complaints whose acknowledgement or resolution is due, and escalate overdue complaints (complaints.auto_escalate)', '0 8 * * *', 'complaintsDeadlines', '{}', true)
ON CONFLICT (code) DO NOTHING;
