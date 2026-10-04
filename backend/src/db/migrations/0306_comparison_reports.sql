-- Client comparison and recommendation reports (Operations > Sales & Marketing > Comparison Reports).
--
-- comparison_reports: the printable report given to a client to choose between insurers: the options compared (from
-- the offers of a request for quotation, or from quotations prepared for the same prospect or client), the option the
-- broker recommends and the reasons, the introduction and the disclaimer. Options are kept as they were when the
-- report was prepared (options jsonb), so a later change to an offer does not change a report already given to the
-- client. Commission is never printed. Status: draft -> issued (printed or sent) -> accepted (the client chose an
-- option, recorded with the option chosen).

CREATE TABLE IF NOT EXISTS comparison_reports (
  id text PRIMARY KEY DEFAULT ('cmp_' || encode(gen_random_bytes(8), 'hex')),
  report_number text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('broker_slip', 'quotations')),
  broker_slip_id text REFERENCES broker_slips(id),
  quote_ids text[] NOT NULL DEFAULT '{}',
  lead_id text REFERENCES leads(id),
  client_id text REFERENCES clients(id),
  prepared_for text NOT NULL,
  title text NOT NULL,
  introduction text,
  options jsonb NOT NULL DEFAULT '[]',               -- [{ key, insurer, premium, grossPremium, sumInsured, deductible, terms, highlights, rank }]
  criteria jsonb NOT NULL DEFAULT '[]',              -- weights / notes of what was compared
  recommended_key text,
  reasons text[] NOT NULL DEFAULT '{}',
  disclaimer text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'accepted')),
  chosen_key text,
  issued_at timestamptz,
  sent_to text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comparison_reports_broker_slip_id_fk_idx ON comparison_reports(broker_slip_id);
CREATE INDEX IF NOT EXISTS comparison_reports_lead_id_fk_idx ON comparison_reports(lead_id);
CREATE INDEX IF NOT EXISTS comparison_reports_client_id_fk_idx ON comparison_reports(client_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('comparison_report', 'Comparison Report', 'quotations', 'CMP', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'Client comparison and recommendation report (Operations > Sales & Marketing > Comparison Reports)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('comparison.report_title', '"Insurance Proposal and Recommendation"', 'quotations', 'Title of the client comparison and recommendation report', 'string'),
 ('comparison.introduction', '"Thank you for the opportunity to arrange your insurance. We approached the insurers below on your behalf and compare their terms here, with our recommendation."', 'quotations', 'Default introduction of a comparison report', 'string'),
 ('comparison.disclaimer', '"This comparison summarises the terms offered by the insurers and does not replace the policy wording. Premiums are subject to the insurer''s final acceptance and include the applicable taxes. Please read the policy conditions, exclusions and deductibles."', 'quotations', 'Disclaimer printed at the end of every comparison report', 'string'),
 ('comparison.default_reasons', '["Lowest total premium for the cover requested","Insurer with strong financial standing and claims service","Broadest cover and lowest deductible among the offers"]', 'quotations', 'Reasons offered for the recommendation (the user picks or writes their own)', 'json'),
 ('comparison.email_subject', '"Insurance proposal {{reportNumber}}"', 'quotations', 'Subject of the e-mail sending a comparison report to the client', 'string'),
 ('comparison.email_body', '"<p>Dear {{clientName}},</p><p>Please find attached our comparison of the insurers'' offers and our recommendation. We will be glad to go through it with you.</p><p>{{companyName}}</p>"', 'quotations', 'Body of the e-mail sending a comparison report ({{clientName}}, {{reportNumber}}, {{companyName}})', 'string')
ON CONFLICT (key) DO NOTHING;
