-- Security configuration (Master > System Settings > Configuration, group "security"). Idempotent.
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('security.scoped_roles', '[]', 'security', 'Roles that only see their own book (records they own or of clients they own)', 'json', true),
 ('security.login_rate_limit', '{"max":10,"windowSeconds":300}', 'security', 'Sign-in / forgot-password rate limit per IP and per username (max attempts in windowSeconds)', 'json', true),
 ('security.password_min_length', '8', 'security', 'Minimum password length', 'number', true),
 ('security.password_require_upper', 'true', 'security', 'Password must contain an upper-case letter', 'boolean', true),
 ('security.password_require_lower', 'true', 'security', 'Password must contain a lower-case letter', 'boolean', true),
 ('security.password_require_digit', 'true', 'security', 'Password must contain a digit', 'boolean', true),
 ('security.password_require_symbol', 'true', 'security', 'Password must contain a symbol', 'boolean', true),
 ('security.password_history_count', '5', 'security', 'Refuse the last N passwords (0 = off)', 'number', true),
 ('security.password_max_age_days', '90', 'security', 'Password maximum age in days before a change is required (0 = never)', 'number', true),
 ('security.require_2fa_roles', '[]', 'security', 'Roles that must enrol in two-factor authentication', 'json', true),
 ('security.two_factor_issuer', '"BrokerVerse"', 'security', 'Issuer name shown in the authenticator app', 'string', true),
 ('security.two_factor_challenge_minutes', '5', 'security', 'Minutes allowed to enter the two-factor code after the password', 'number', true)
ON CONFLICT (key) DO NOTHING;

-- Group label on the Configuration screen
UPDATE app_settings SET value = value || '{"security":"Security"}'::jsonb
 WHERE key = 'system.group_labels' AND jsonb_typeof(value) = 'object' AND NOT value ? 'security';

-- The older limits.password_min_length key is superseded by security.password_min_length
UPDATE app_settings SET label = 'Minimum password length (superseded by security.password_min_length)'
 WHERE key = 'limits.password_min_length' AND label = 'Minimum password length';
