-- Sign-in with Microsoft Entra ID (BRD TIS-BRD-INTG-02, SEC-05). The connection itself (tenant, application, secret,
-- redirect address) comes from the ENTRA_* variables of the environment; without them nothing changes. These settings
-- decide what the sign-in page offers once it is configured. Idempotent.

-- The Entra account (tenant and object id) a user signed in with the first time; later sign-ins must come from the
-- same account, so a mailbox renamed or reassigned in Microsoft 365 cannot take over another user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_subject text;
CREATE UNIQUE INDEX IF NOT EXISTS users_sso_subject_uidx ON users(sso_subject) WHERE sso_subject IS NOT NULL;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('security.password_sign_in_enabled', 'true', 'security', 'Sign-in with user ID and password. Off: only "Sign in with Microsoft" (when Entra ID is configured), except for the roles in security.password_sign_in_roles', 'boolean', true),
 ('security.password_sign_in_roles', '["system-admin"]', 'security', 'Roles that keep the user ID and password sign-in when it is switched off (break-glass administrator)', 'json', true),
 ('security.sso_register_users', 'false', 'security', 'A Microsoft account that matches no user is registered as an inactive user, for an administrator to activate and give roles (off: the sign-in is refused)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
