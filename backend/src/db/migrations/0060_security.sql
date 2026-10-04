-- Security: sign-in history, password history / age, optional TOTP two-factor authentication.
CREATE TABLE IF NOT EXISTS login_history (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id text REFERENCES users(id) ON DELETE SET NULL,   -- null when the username does not exist
  username text,                                          -- the username that was tried
  ip text, user_agent text,
  success boolean NOT NULL,
  reason text,                                            -- ok | bad-password | unknown-user | locked | inactive | rate-limited | 2fa-required | bad-2fa-code ...
  method text NOT NULL DEFAULT 'password'                 -- password | 2fa | forgot-password
);
CREATE INDEX IF NOT EXISTS login_history_user_idx ON login_history(user_id, at DESC);
CREATE INDEX IF NOT EXISTS login_history_at_idx ON login_history(at DESC);

CREATE TABLE IF NOT EXISTS password_history (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_history_user_idx ON password_history(user_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text;            -- base32 secret of the enabled second factor
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret text;    -- secret issued by /auth/2fa/setup, until confirmed
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step bigint;       -- last accepted time step (a code cannot be replayed)
