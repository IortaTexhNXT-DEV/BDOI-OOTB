-- Insurer acknowledgement service level of a claim (TIS-BRD-CLAIM-08, CR-06; Pre-BSM M15 CLM-INS-ACK "awaiting insurer
-- acknowledgement: end of day"). The end-of-day job claim-service-levels (claims/insurer.js) alerts the handler and the
-- handler's manager once when a claim submitted to the insurer has no insurer advice and no insurer claim number at the
-- end of the claims.insurer_ack_days-th working day after the submission (0: the end of the submission day itself),
-- on the working calendar (weekdays less the Holiday master).
--
-- Settings:
--   claims.insurer_ack_alert   the end-of-day alert when the insurer has not responded is on
--   claims.insurer_ack_days    working days after the submission the insurer has to respond (0: same day, end of day)
-- Idempotent.

ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurer_ack_alerted_at timestamptz;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('claims.insurer_ack_alert', 'true', 'claims', 'Alert the claim handler at the end of the day when the insurer has not acknowledged or advised on a submitted claim', 'boolean', true),
 ('claims.insurer_ack_days', '0', 'claims', 'Working days after the submission to the insurer by the end of which its acknowledgement is expected (0: end of the submission day)', 'number', true)
ON CONFLICT (key) DO NOTHING;
