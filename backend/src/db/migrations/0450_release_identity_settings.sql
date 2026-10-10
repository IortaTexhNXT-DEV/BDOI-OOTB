-- Release identity shown in Help > About and in the support details copied from Help (GET /api/version, release).
-- Edited by the administrator on Master > Configuration (Company & Branding > Release), recorded in the audit trail.
--
-- Settings:
--   release.web_version             release of the web application; empty: the version of the web build
--   release.api_version             release of the API; empty: the version of the API package
--   release.environment_label       name of this environment (Development, SIT, UAT, Production); the deployment's
--                                   APP_ENVIRONMENT, when set, takes precedence
--   release.requirements_approver   who approved the requirements of the release; empty: not shown
--   release.version_approver        who approved the release of the version; empty: not shown
--
-- The values of a client are seeded by its configuration seed (TISPH: seeds/92_tisph_release.sql). Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('release.web_version', '""', 'release', 'Web application release shown in Help (empty: the version of the build)', 'string'),
 ('release.api_version', '""', 'release', 'API release shown in Help (empty: the version of the build)', 'string'),
 ('release.environment_label', '""', 'release', 'Name of this environment shown in Help (a name set for the deployment takes precedence)', 'string'),
 ('release.requirements_approver', '""', 'release', 'Requirements approved by (shown in Help when set)', 'string'),
 ('release.version_approver', '""', 'release', 'Version release approved by (shown in Help when set)', 'string')
ON CONFLICT (key) DO NOTHING;
