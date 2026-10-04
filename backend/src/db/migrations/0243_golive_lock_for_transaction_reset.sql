-- Go-live lock read by the transaction reset (npm run reset:transactions, scripts/reset-transactions.js).
-- While golive.locked is false the reset may empty the business transactions of a smoke test (masters, configuration
-- and users stay). Switch it on once the go-live migration is loaded: the reset then refuses to run. An administrator
-- switches it off again in Master > Configuration (group Go-live); the change is recorded in the audit trail.
-- Another go-live migration may create the same key: ON CONFLICT DO NOTHING keeps whichever was created first.
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('golive.locked', 'false', 'golive', 'Go-live lock: when on, the transaction reset (npm run reset:transactions) refuses to run. Switch on once the go-live data is loaded', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings SET value = value || '{"golive": "Go-live"}'::jsonb, updated_at = now()
WHERE key = 'system.group_labels' AND jsonb_typeof(value) = 'object' AND NOT value ? 'golive';
