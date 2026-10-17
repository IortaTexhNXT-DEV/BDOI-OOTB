-- Privacy notice and opt-out on the client record (TIS-BRD-NFR-17.1, Phase 1: privacy notices and opt-out mechanisms).
--
-- clients.privacy_notice_ack_at / privacy_notice_version   when the client acknowledged the privacy notice and which
--                                                          version (privacy.notice_version at the time, unless given)
-- clients.marketing_consent / marketing_consent_at          the client's marketing consent (null = not recorded);
--                                                          kept in step with the consent register (privacy_consents,
--                                                          purpose marketing) that the campaigns read
-- clients.email_opt_out / email_opt_out_at                  the client asked for no marketing or other non-transactional
--                                                          e-mail (the campaign unsubscribe link sets it too)
--
-- Outbound e-mail (lib/mailer.js queueEmail): a message whose template is non-transactional (email.non_transactional_
-- templates: campaign e-mails) is not queued for an address of a client who opted out or refused marketing consent.
-- Transactional e-mail (policy documents, renewal notices, billing, claims) is sent as before.
-- Idempotent.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS privacy_notice_ack_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS privacy_notice_version text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marketing_consent boolean;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_opt_out_at timestamptz;
COMMENT ON COLUMN clients.privacy_notice_ack_at IS 'When the client acknowledged the privacy notice (NFR-17.1)';
COMMENT ON COLUMN clients.privacy_notice_version IS 'Version of the privacy notice the client acknowledged';
COMMENT ON COLUMN clients.marketing_consent IS 'Marketing consent of the client (null = not recorded); in step with privacy_consents (purpose marketing)';
COMMENT ON COLUMN clients.email_opt_out IS 'The client opted out of marketing and other non-transactional e-mail; transactional e-mail is unaffected';
CREATE INDEX IF NOT EXISTS clients_email_opt_out_idx ON clients (lower(email)) WHERE email_opt_out OR marketing_consent IS FALSE;

-- the current marketing consent of the register on the client record
UPDATE clients c SET marketing_consent = x.granted, marketing_consent_at = x.recorded_at
  FROM (SELECT DISTINCT ON (party_id) party_id, granted AND withdrawn_at IS NULL AS granted, recorded_at FROM privacy_consents
         WHERE party_type = 'client' AND purpose = 'marketing' ORDER BY party_id, recorded_at DESC, id DESC) x
 WHERE x.party_id = c.id AND c.marketing_consent IS NULL;

-- Setting (seeds/settings.json, group notification): email.non_transactional_templates (["campaign:*"]).
