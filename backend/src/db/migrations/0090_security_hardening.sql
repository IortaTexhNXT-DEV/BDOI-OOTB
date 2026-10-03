-- Security hardening (code review 29 Sep 2026): session revocation, refresh-token reuse detection, hashed reset codes.

-- Token version: raised on password change / reset, deactivation and role changes; access tokens carry it and are
-- refused once it no longer matches.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- Refresh-token families: every refresh keeps the family of the sign-in; a rotated token presented again (reuse)
-- revokes the whole family.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id text;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason text;   -- rotated | logout | revoked | reuse
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by text;
UPDATE refresh_tokens SET family_id = jti WHERE family_id IS NULL;
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens(family_id);

-- Password reset codes are stored as keyed hashes only; codes issued before this migration are withdrawn.
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS code_hash text;
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE password_resets ALTER COLUMN code DROP NOT NULL;
UPDATE password_resets SET used_at = COALESCE(used_at, now()), code = NULL WHERE code IS NOT NULL;
