-- Dashboards opened before the first policy is issued in BrokerVerse showed only zeros: the delivered default view
-- "Issued since go-live" counted nothing until then. dashboard.default_origin gets the value auto, now the delivered
-- default: Issued since go-live once a policy was issued after the cutover date, All business until then. An
-- environment still on the delivered value (never changed by an administrator) moves to auto; a value chosen on the
-- Go-Live tab stays. Idempotent.

UPDATE app_settings
   SET value = '"auto"'
 WHERE key = 'dashboard.default_origin' AND value = '"issued"' AND updated_by IS NULL;

UPDATE app_settings
   SET label = 'Business the dashboards show first: auto (issued since go-live once a policy was issued after go-live, else all), issued (issued since go-live) or all'
 WHERE key = 'dashboard.default_origin';
