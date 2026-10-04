-- Distribution channels (Master > Insurance Management > Distribution Channels): the dealer groups and their dealer
-- branches, the financing banks (and their branches) and the affinity partners that refer business, in one hierarchy
-- (parent_id). A channel can be linked to a referrer of Commission > Agents/Referrer Accounts (commission_referrers):
-- the business it brings then accrues the referrer's comsub at comsub_pct (else the rate of the referrer's level).
-- A financing bank carries the mortgagee clause printed on the policies it finances and the addressee of the bank
-- endorsement letter.
--
-- leads, quotes and policies carry the channel the business came through (channel_id); a quotation and a policy take
-- the channel of their prospect when none is given. Report "Dealer Production" (Reports > Operational Reports) totals
-- the business per channel and rolls it up to the dealer group.
--
-- channel_billing_accounts: the client account a channel is billed through when it pays a premium (a dealer paying the
-- free first-year cover of a brand-new vehicle programme), created on first use. A transaction table, so the reset of
-- the transactions removes it with the clients.

CREATE TABLE IF NOT EXISTS distribution_channels (
  id text PRIMARY KEY DEFAULT ('ch_' || encode(gen_random_bytes(8), 'hex')),
  code text NOT NULL,
  name text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('dealer_group', 'dealer_branch', 'financing_bank', 'bank_branch', 'affinity_partner')),
  parent_id text REFERENCES distribution_channels(id),
  referrer_id text REFERENCES commission_referrers(id),
  comsub_pct numeric(6,2),
  bank_id int REFERENCES banks(id),
  branch_code text,                                  -- the broker's servicing branch
  province text,
  city text,
  address text,
  contact_person text,
  contact_email text,
  contact_phone text,
  tin text,
  mortgagee_clause text,                             -- financing bank: clause on the policy (template, {{bankName}} ...)
  letter_addressee text,                             -- financing bank: addressee of the endorsement letter
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS distribution_channels_code_uq ON distribution_channels(lower(code));
CREATE INDEX IF NOT EXISTS distribution_channels_parent_id_fk_idx ON distribution_channels(parent_id);
CREATE INDEX IF NOT EXISTS distribution_channels_referrer_id_fk_idx ON distribution_channels(referrer_id);
CREATE INDEX IF NOT EXISTS distribution_channels_bank_id_fk_idx ON distribution_channels(bank_id);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS channel_id text REFERENCES distribution_channels(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS channel_id text REFERENCES distribution_channels(id);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS channel_id text REFERENCES distribution_channels(id);
CREATE INDEX IF NOT EXISTS leads_channel_id_fk_idx ON leads(channel_id);
CREATE INDEX IF NOT EXISTS quotes_channel_id_fk_idx ON quotes(channel_id);
CREATE INDEX IF NOT EXISTS policies_channel_id_fk_idx ON policies(channel_id);

-- A quotation takes the channel named in its document (channelId) or, with channels.inherit_from_lead, its prospect's;
-- a policy the channel of its quotation, else of its prospect.
CREATE OR REPLACE FUNCTION quotes_channel_inherit() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- the quotation screens save the channel in the document: a changed channel follows
    IF NULLIF(NEW.doc->>'channelId', '') IS NOT NULL AND NEW.doc->>'channelId' IS DISTINCT FROM OLD.doc->>'channelId' THEN
      NEW.channel_id := COALESCE((SELECT id FROM distribution_channels WHERE id = NEW.doc->>'channelId'), NEW.channel_id);
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.channel_id IS NULL AND NULLIF(NEW.doc->>'channelId', '') IS NOT NULL THEN
    NEW.channel_id := (SELECT id FROM distribution_channels WHERE id = NEW.doc->>'channelId');
  END IF;
  IF NEW.channel_id IS NULL AND NEW.lead_id IS NOT NULL
     AND COALESCE((SELECT value::text FROM app_settings WHERE key = 'channels.inherit_from_lead'), 'true') <> 'false' THEN
    NEW.channel_id := (SELECT channel_id FROM leads WHERE id = NEW.lead_id);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS quotes_channel_inherit ON quotes;
CREATE TRIGGER quotes_channel_inherit BEFORE INSERT OR UPDATE OF doc ON quotes FOR EACH ROW EXECUTE FUNCTION quotes_channel_inherit();

CREATE OR REPLACE FUNCTION policies_channel_inherit() RETURNS trigger AS $$
BEGIN
  IF NEW.channel_id IS NULL AND NULLIF(NEW.doc->>'channelId', '') IS NOT NULL THEN
    NEW.channel_id := (SELECT id FROM distribution_channels WHERE id = NEW.doc->>'channelId');
  END IF;
  IF NEW.channel_id IS NULL AND COALESCE((SELECT value::text FROM app_settings WHERE key = 'channels.inherit_from_lead'), 'true') <> 'false' THEN
    IF NEW.quote_id IS NOT NULL THEN NEW.channel_id := (SELECT channel_id FROM quotes WHERE id = NEW.quote_id); END IF;
    IF NEW.channel_id IS NULL AND NEW.lead_id IS NOT NULL THEN NEW.channel_id := (SELECT channel_id FROM leads WHERE id = NEW.lead_id); END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS policies_channel_inherit ON policies;
CREATE TRIGGER policies_channel_inherit BEFORE INSERT ON policies FOR EACH ROW EXECUTE FUNCTION policies_channel_inherit();

CREATE TABLE IF NOT EXISTS channel_billing_accounts (
  channel_id text PRIMARY KEY REFERENCES distribution_channels(id),
  client_id text NOT NULL REFERENCES clients(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channel_billing_accounts_client_id_fk_idx ON channel_billing_accounts(client_id);

INSERT INTO permissions(code, module, description) VALUES
 ('read:channels', 'channels', 'View the distribution channels (dealers, financing banks, affinity partners) and their production'),
 ('write:channels', 'channels', 'Maintain the distribution channels')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code = 'system-admin' AND p.code IN ('read:channels', 'write:channels'))
    OR (r.code IN ('sales', 'processing', 'operations', 'accounting') AND p.code = 'read:channels')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('channels.default_mortgagee_clause', '"Loss, if any, under this policy shall be payable to {{bankName}} as mortgagee, as its interest may appear, subject to all the terms and conditions of the policy."', 'channels', 'Mortgagee clause printed on a policy financed by a bank that has no clause of its own ({{bankName}}, {{bankBranch}})', 'string'),
 ('channels.inherit_from_lead', 'true', 'channels', 'A quotation or policy without a channel takes the channel of its prospect', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- Dealer production (Reports > Operational Reports > Dealer Production): policies per channel, rolled up to the group
INSERT INTO report_definitions(code, name, category, description, screen, parameters, query_name, default_columns, roles, permission, sort_order) VALUES
 ('dealer-production', 'Dealer Production', 'operational',
  'Prospects, quotations and policies brought by each dealer, financing bank and affinity partner, with premium and commission, rolled up to the dealer group.',
  'Reports > Operational Reports > Dealer Production',
  '{"type":"object","required":["ReportCriteria"],"properties":{"FromDate":{"type":"string","title":"From Date","format":"date"},"ToDate":{"type":"string","title":"To Date","format":"date"},"ReportCriteria":{"enum":["Channel","Dealer Group","Channel Type"],"type":"string","title":"Report Criteria","default":"Channel"},"Product":{"type":"string","title":"Product","x-options":"products","description":"id, code or name"},"Company":{"type":"string","title":"Company (principal insurer)","x-options":"insurance_companies","description":"id, code or name"},"Branch":{"type":"string","title":"Branch","x-options":"branches","description":"id, code or name"},"format":{"enum":["csv","xlsx","pdf"],"type":"string","title":"File format (generate only)","default":"xlsx"},"period":{"enum":["today","yesterday","last-7-days","last-30-days","month-to-date","previous-month","year-to-date"],"type":"string","title":"Relative period (schedules; used when no dates are given)"}}}',
  'dealerProduction',
  '[{"key":"dealerGroup","type":"text","label":"Dealer Group"},{"key":"channel","type":"text","label":"Channel"},{"key":"channelType","type":"text","label":"Channel Type"},{"key":"leads","type":"integer","label":"Prospects"},{"key":"quotations","type":"integer","label":"Quotations"},{"key":"policies","type":"integer","label":"Policies"},{"key":"sumInsured","type":"money","label":"Sum Insured"},{"key":"premium","type":"money","label":"Gross Premium"},{"key":"commission","type":"money","label":"Commission"}]',
  '{sales,processing,operations,accounting}', 'read:reports', 260)
ON CONFLICT (code) DO NOTHING;
