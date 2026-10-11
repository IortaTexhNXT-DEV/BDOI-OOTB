-- Quotation validity cycle and versions (TIS-BRD-QUOT-04, PROD-03, CR-03; MC-09 to MC-12, PA-05 to PA-08).
--
-- Validity: a quotation is valid until valid_until inclusive (business date, Asia/Manila). The number of days comes
-- from the product (products.quote_validity_days, Product Master) or, when the product has none, from
-- limits.quote_validity_days. issued_on is the business date the quotation was first issued; it anchors the hard stop.
--
-- Extension: POST /quotations/:id/extend moves valid_until by quotations.extension_days, at most
-- quotations.max_extensions times, and never beyond issued_on + quotations.max_validity_days. Extending needs the
-- permission extend:quotations (the quotation approvers). The extension is stamped on the quotation and audited.
--
-- Reminder: job quote-expiry-reminder tells the owner (and the customer of a quotation waiting for the customer) that
-- the quotation expires in quotations.expiry_reminder_days days; expiry_reminder_for keeps the valid_until a reminder
-- was sent for, so a quotation is reminded once per validity date (again after an extension).
--
-- Spoil: job quote-expiry expires every quotation in quotations.expiry_statuses whose valid_until has passed, except one
-- whose placement slip is already with the insurer (the placement decides it). An expired quotation is not reopened.
--
-- Versions: changing a quotation that has been issued to the customer (sent, accepted, approved or submitted)
-- keeps the terms the customer saw as a read-only version (quote_versions) and continues as the next version of the
-- same quotation number, back in Draft. Idempotent.

ALTER TABLE products ADD COLUMN IF NOT EXISTS quote_validity_days int;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_quote_validity_days_chk CHECK (quote_validity_days IS NULL OR quote_validity_days BETWEEN 1 AND 366);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS issued_on date;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS extension_count int NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS extended_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS extended_by text REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS extension_remarks text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expiry_reminder_for date;
CREATE INDEX IF NOT EXISTS quotes_valid_until_idx ON quotes(valid_until) WHERE deleted_at IS NULL;

UPDATE quotes SET issued_on = (created_at AT TIME ZONE 'Asia/Manila')::date WHERE issued_on IS NULL;

CREATE TABLE IF NOT EXISTS quote_versions (
  id bigserial PRIMARY KEY,
  quote_id text NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version int NOT NULL,
  status text NOT NULL,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  sum_insured numeric(14,2) NOT NULL DEFAULT 0,
  premium_base numeric(14,2) NOT NULL DEFAULT 0,
  premium_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_rate numeric(6,4),
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  insurance_company_id int,
  valid_until date,
  approval_sent_to text,
  approval_sent_at timestamptz,
  customer_accepted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  version_started_at timestamptz,
  superseded_by text REFERENCES users(id),
  superseded_at timestamptz NOT NULL DEFAULT now(),
  change_reason text,
  UNIQUE (quote_id, version)
);
CREATE INDEX IF NOT EXISTS quote_versions_quote_idx ON quote_versions(quote_id);

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version_started_at timestamptz;
UPDATE quotes SET version_started_at = created_at WHERE version_started_at IS NULL;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('quotations.extension_days', '30', 'quotations', 'Days one extension adds to the validity of a quotation', 'number'),
 ('quotations.max_extensions', '1', 'quotations', 'Number of times a quotation may be extended', 'number'),
 ('quotations.max_validity_days', '60', 'quotations', 'Longest validity of a quotation counted from the day it was issued, extensions included (days)', 'number'),
 ('quotations.extendable_statuses', '["Draft","PendingCustomer","CustomerAccepted","Approved","SubmittedToInsurer"]', 'quotations', 'Quotation statuses that may be extended', 'json'),
 ('quotations.expiry_reminder_days', '5', 'quotations', 'Days before the end of validity the owner is reminded (0 = no reminder)', 'number'),
 ('quotations.expiry_reminder_customer', 'true', 'quotations', 'The expiry reminder is also e-mailed to the customer of a quotation waiting for the customer', 'boolean'),
 ('quotations.expiry_statuses', '["Draft","PendingCustomer","CustomerAccepted","Approved","SubmittedToInsurer"]', 'quotations', 'Quotation statuses that expire the day after their validity ends (a quotation with a live placement slip is kept)', 'json'),
 ('quotations.versioned_statuses', '["PendingCustomer","CustomerAccepted","Approved","SubmittedToInsurer"]', 'quotations', 'Quotation statuses in which a change creates a new version of the quotation', 'json'),
 ('email.template.quote_expiry_reminder', $j${"subject":"{{companyName}}: quotation {{quotationNumber}} expires on {{validUntil}}","html":"<p>Dear {{customerName}},</p><p>Your {{productType}} quotation <b>{{quotationNumber}}</b> (gross premium {{currency}} {{grossPremium}}) is valid until <b>{{validUntil}}</b>.</p><p>Please let us know your decision before that date.</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: quotation expiry reminder to the customer', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('quote-expiry-reminder', 'Quotation expiry reminder', 'Remind the owner (and the customer) of quotations whose validity ends in the configured number of days', '0 8 * * *', 'quoteExpiryReminders', '{}', true)
ON CONFLICT (code) DO NOTHING;

UPDATE scheduled_jobs SET description = 'Expire quotations the day after their validity ends'
 WHERE code = 'quote-expiry' AND description = 'Expire quotations older than the configured validity';

-- Users of the roles that gain the permission get a new token version (the permissions travel in the access token);
-- only on the first run, while the permission does not exist yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-unit-head', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'extend:quotations');

INSERT INTO permissions(code, module, description) VALUES
 ('extend:quotations', 'quotations', 'Extend the validity of a quotation (once, within the longest validity)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'extend:quotations'
WHERE r.code IN ('system-admin', 'sales', 'processing', 'operations', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-unit-head', 'tis-general-manager')
ON CONFLICT DO NOTHING;
