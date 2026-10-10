-- TISPH release identity (settings of migration 0450, shown in Help > About): the web and API releases, the name of
-- this environment and the approvers of the release. A value is set only while it is still empty and nobody has
-- changed it (updated_by empty), so administrator changes are kept. The environment name is the one of the TISPH
-- development site; SIT, UAT and Production set their own on Master > Configuration or with APP_ENVIRONMENT.
UPDATE app_settings s SET value = to_jsonb(v.value), updated_at = now()
  FROM (VALUES ('release.web_version', 'PH-WEB-2026.1.3'),
               ('release.api_version', 'PH-API-2026.1.3'),
               ('release.environment_label', 'Development'),
               ('release.requirements_approver', 'Andrew'),
               ('release.version_approver', 'Vijay')) AS v(key, value)
 WHERE s.key = v.key AND s.value = '""'::jsonb AND s.updated_by IS NULL;
