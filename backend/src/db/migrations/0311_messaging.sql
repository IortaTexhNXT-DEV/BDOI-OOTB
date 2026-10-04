-- SMS and messaging (Master > System Configuration > Message Templates): text templates per event, sent through an SMS
-- gateway connector (or the optional Viber business messages connector) via the integration outbox.
--
--   message_templates   one template per code: channel (sms / viber), event (renewal_notice, payment_reminder,
--                       claim_update, general), body with {{placeholders}}, the consent purpose checked before sending
--                       (none, processing, marketing) and the connector (empty = messaging.<channel>_connector)
--
-- Consent: a marketing template needs a granted marketing consent (privacy_consents); a service template (purpose
-- processing) is sent unless the client refused or withdrew it, or, with messaging.service_consent = opt-in, only with a
-- granted consent. Skipped messages stay in the outbox with status skipped and the reason. Idempotent.

CREATE TABLE IF NOT EXISTS message_templates (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'viber')),
  event text NOT NULL DEFAULT 'general' CHECK (event IN ('renewal_notice', 'payment_reminder', 'claim_update', 'ctpl_authenticated', 'general')),
  body text NOT NULL,
  consent_purpose text NOT NULL DEFAULT 'processing' CHECK (consent_purpose IN ('none', 'processing', 'marketing')),
  connector_code text REFERENCES integration_connectors(code),
  active boolean NOT NULL DEFAULT true,
  description text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('messaging.sms_connector', '"SMS_SEMAPHORE"', 'messaging', 'SMS: connector used by templates that name none (Master > System Configuration > Integrations)', 'string'),
 ('messaging.viber_connector', '"VIBER_BUSINESS"', 'messaging', 'Viber business messages: connector used by Viber templates that name none', 'string'),
 ('messaging.service_consent', '"opt-out"', 'messaging', 'Service messages (renewal notices, payment reminders, claim updates): opt-out = sent unless the client refused or withdrew consent for processing; opt-in = only with a granted consent', 'string'),
 ('messaging.renewal_notice_days', '[30, 7]', 'messaging', 'SMS renewal notices: days before policy expiry on which the notice is sent', 'json'),
 ('messaging.payment_reminder_days', '[3, 0]', 'messaging', 'SMS payment reminders: days before the due date of an open bill on which the reminder is sent (0 = on the due date)', 'json'),
 ('messaging.claim_update_statuses', '["in-review", "approved", "settled", "rejected", "closed"]', 'messaging', 'SMS claim updates: claim statuses that send the claim update message to the client', 'json'),
 ('messaging.default_country_code', '"63"', 'messaging', 'Country calling code added to local mobile numbers (09xx...) before sending', 'string'),
 ('messaging.max_length', '480', 'messaging', 'Longest SMS text sent (characters; a longer text is cut, 160 characters per SMS part)', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('sms-renewal-notices', 'SMS renewal notices', 'Queue the renewal notice SMS for policies expiring in messaging.renewal_notice_days days (template event renewal_notice)', '10 8 * * *', 'smsRenewalNotices', '{}', false),
 ('sms-payment-reminders', 'SMS payment reminders', 'Queue the payment reminder SMS for open bills due in messaging.payment_reminder_days days (template event payment_reminder)', '20 8 * * *', 'smsPaymentReminders', '{}', false)
ON CONFLICT (code) DO NOTHING;
