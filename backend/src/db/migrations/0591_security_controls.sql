-- Security and data-protection controls made verifiable (TIS-BRD-NFR-03, NFR-04, NFR-11.1, NFR-11.2, NFR-14.11, SEC-04,
-- Pre-BSM NFR sheet):
--   - account lockout released by itself after limits.lockout_minutes (an administrator's lock stays until unlocked);
--   - the idle timeout enforced by the API (refresh_tokens.last_seen_at per sign-in; limits.session_idle_minutes);
--   - single-session control (security.single_session: a fresh sign-in ends the earlier sessions);
--   - MFA for every user (security.require_2fa_all) with a one-time code by e-mail as the second factor for users who
--     have no authenticator app (security.email_otp_*);
--   - reactivation restarts the dormancy clock (users.reactivated_at);
--   - the audit trail is append-only at the database (trigger; the housekeeping purge sets app.audit_purge);
--   - retention of closed contracts (retention.*) applied by the data-retention job, which flags the policies past
--     their retention period;
--   - a register of control evidence (control_evidence) behind Master > System Configuration > Security Controls.
-- Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reactivated_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_expires_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_attempts int NOT NULL DEFAULT 0;
COMMENT ON COLUMN users.lock_reason IS 'failed-logins (released after limits.lockout_minutes) or administrator (released by an administrator)';

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS refresh_tokens_family_live_idx ON refresh_tokens(family_id) WHERE revoked_at IS NULL;

ALTER TABLE policies ADD COLUMN IF NOT EXISTS retention_due_at timestamptz;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS retention_rule text;
COMMENT ON COLUMN policies.retention_due_at IS 'Set by the data-retention job when the closed contract has passed its retention period (retention.*)';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('limits.lockout_minutes', '15', 'limits', 'Minutes an account locked by failed sign-ins stays locked before it is released by itself (0 = until an administrator unlocks it)', 'number', true),
 ('security.single_session', 'false', 'security', 'Single session per user: a fresh sign-in ends the earlier sessions of the same user', 'boolean', true),
 ('security.require_2fa_all', 'false', 'security', 'Every user must sign in with a second factor (authenticator app, or a one-time code by e-mail when enabled)', 'boolean', true),
 ('security.email_otp_enabled', 'false', 'security', 'Offer a one-time code by e-mail as the second factor to users without an authenticator app', 'boolean', true),
 ('security.email_otp_minutes', '10', 'security', 'Minutes a one-time code sent by e-mail stays valid', 'number', true),
 ('security.email_otp_max_attempts', '5', 'security', 'Wrong one-time codes allowed before the code is withdrawn', 'number', true),
 ('security.email_otp_subject', '"{{companyName}}: your sign-in code"', 'security', 'Subject of the e-mail carrying the one-time sign-in code', 'string', true),
 ('security.email_otp_body', '"<p>Your sign-in code is <strong>{{code}}</strong>. It is valid for {{minutes}} minutes.</p><p>If you did not try to sign in, tell your administrator.</p>"', 'security', 'Body of the e-mail carrying the one-time sign-in code ({{code}}, {{minutes}}, {{companyName}})', 'text', true),
 ('retention.closed_contract_years', '5', 'retention', 'Years a closed contract (expired, cancelled or lapsed policy without a claim) is kept before it is due for retention action', 'number', true),
 ('retention.claim_contract_years', '10', 'retention', 'Years a closed contract with a claim is kept before it is due for retention action', 'number', true),
 ('retention.action', '"flag"', 'retention', 'What the data-retention job does with a contract past its period: flag (list it for review) or anonymise (replace the client''s personal data once every contract of the client is past its period)', 'string', true)
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings SET value = value || '{"retention":"Data retention"}'::jsonb
 WHERE key = 'system.group_labels' AND jsonb_typeof(value) = 'object' AND NOT value ? 'retention';

-- ---------------------------------------------------------------- control evidence
CREATE TABLE IF NOT EXISTS control_evidence (
  id bigserial PRIMARY KEY,
  control_key text NOT NULL,
  evidence_date date NOT NULL,
  result text NOT NULL CHECK (result IN ('met', 'not-met', 'review')),
  reference text,
  remarks text,
  recorded_by text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS control_evidence_key_idx ON control_evidence(control_key, evidence_date DESC);

-- ---------------------------------------------------------------- the audit trail is append-only
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.audit_purge', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF TG_OP = 'TRUNCATE' THEN RETURN NULL; END IF;
  END IF;
  RAISE EXCEPTION 'The audit trail cannot be changed or deleted' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
