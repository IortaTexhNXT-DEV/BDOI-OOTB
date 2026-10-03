-- One application name. System Settings edited general.app_title ("App Title") while the sign-in page and the side
-- bar show general.system_name, so a changed App Title had no effect there. System Settings now edits
-- general.system_name ("Application name"); a title that was changed from its default is carried over.
-- general.app_title is deprecated and unused: no code reads it any more. It stays in app_settings because an earlier
-- migration (0110) names it, but it is read-only and listed with the system settings under "Advanced".
UPDATE app_settings n SET value = t.value, updated_by = t.updated_by, updated_at = now()
FROM app_settings t
WHERE n.key = 'general.system_name' AND t.key = 'general.app_title'
  AND jsonb_typeof(t.value) = 'string' AND btrim(t.value #>> '{}') <> ''
  AND lower(t.value #>> '{}') <> 'brokerverse'
  AND n.value IS DISTINCT FROM t.value;

UPDATE app_settings SET "group" = 'system', editable = false, updated_at = now(),
  label = 'Deprecated, not used: the application name is general.system_name (Master > System Settings)'
WHERE key = 'general.app_title';

UPDATE app_settings SET label = v.label
FROM (VALUES
 ('general.system_name', 'Application name (sign-in page, side bar and browser tab)'),
 ('branding.logo_url', 'Application logo (screen)')
) AS v(key, label)
WHERE app_settings.key = v.key;
