-- Marketing campaigns to consenting clients and prospects (Operations > Sales & Marketing > Campaigns).
--
-- campaign_segments: who a campaign is for: clients, prospects or both, narrowed by line of business, province, city,
-- distribution channel, client type, prospect status and policies expiring within a number of days.
-- campaign_templates: the e-mail of a campaign (subject and body with {{firstName}}, {{fullName}}, {{companyName}}
-- and {{optOutLink}}). A body without {{optOutLink}} gets the opt-out paragraph added at the end.
--
-- campaigns / campaign_recipients: a campaign sends the template to the segment. Only a party whose current marketing
-- consent (Master > Data Privacy > Consent Register, purpose 'marketing') is granted and not withdrawn, with an
-- e-mail address and not anonymised, receives it; the others are kept as excluded with the reason. Each message goes
-- through the e-mail outbox (campaign_recipients.outbox_id), so its delivery status is the outbox status. The opt-out
-- link records a refusal of the marketing purpose in the consent register (channel E-mail). Results: sent, failed,
-- excluded, opted out and the recipients who were quoted or insured within campaigns.conversion_window_days.

CREATE TABLE IF NOT EXISTS campaign_segments (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  criteria jsonb NOT NULL DEFAULT '{}',              -- { partyType: client|lead|both, lob, province, city, channelId, clientType, leadStatus, expiringWithinDays }
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_templates (
  id serial PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_templates_code_uq ON campaign_templates(lower(code));

CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY DEFAULT ('cpg_' || encode(gen_random_bytes(8), 'hex')),
  campaign_number text NOT NULL UNIQUE,
  name text NOT NULL,
  segment_id int NOT NULL REFERENCES campaign_segments(id),
  template_id int NOT NULL REFERENCES campaign_templates(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_by text,
  recipients int NOT NULL DEFAULT 0,
  excluded int NOT NULL DEFAULT 0,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_segment_id_fk_idx ON campaigns(segment_id);
CREATE INDEX IF NOT EXISTS campaigns_template_id_fk_idx ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS campaigns_scheduled_idx ON campaigns(status, scheduled_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id bigserial PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  party_type text NOT NULL CHECK (party_type IN ('client', 'lead')),
  party_id text NOT NULL,
  party_name text,
  email text,
  status text NOT NULL CHECK (status IN ('queued', 'excluded', 'opted-out')),
  excluded_reason text,
  outbox_id bigint,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_party_uq ON campaign_recipients(campaign_id, party_type, party_id);
CREATE INDEX IF NOT EXISTS campaign_recipients_outbox_idx ON campaign_recipients(outbox_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('campaign', 'Marketing Campaign', 'campaigns', 'CPG', '{PREFIX}-{YYYY}-{SEQ}', 4, 'yearly', 'Marketing campaign (Operations > Sales & Marketing > Campaigns)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('read:campaigns', 'campaigns', 'View marketing campaigns, segments, templates and campaign results'),
 ('write:campaigns', 'campaigns', 'Prepare and send marketing campaigns and maintain segments and templates')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code IN ('system-admin', 'sales', 'operations') AND p.code IN ('read:campaigns', 'write:campaigns'))
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('campaigns.max_recipients', '5000', 'campaigns', 'Maximum recipients of one campaign', 'number'),
 ('campaigns.conversion_window_days', '30', 'campaigns', 'Days after sending in which a quotation or policy of a recipient counts as a campaign result', 'number'),
 ('campaigns.opt_out_text', '"You receive this e-mail because you agreed to hear from us about insurance offers. To stop receiving them, open this link: {{optOutLink}}"', 'campaigns', 'Opt-out paragraph added to a campaign e-mail whose template has no {{optOutLink}}', 'string'),
 ('campaigns.opt_out_link_days', '365', 'campaigns', 'Days an opt-out link stays valid', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('campaign-dispatch', 'Scheduled campaigns', 'Send the marketing campaigns whose scheduled time has come (to consenting recipients only, through the e-mail outbox)', '*/15 * * * *', 'campaignDispatch', '{}', false)
ON CONFLICT (code) DO NOTHING;
