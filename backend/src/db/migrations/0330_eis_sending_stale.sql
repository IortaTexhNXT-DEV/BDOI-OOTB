-- EIS outbox restart safety: a submission is set to "sending" before the call to the EIS. When the server stops during
-- the call the row stayed in sending for ever and the eis-outbox job never picked it up again. The job now treats a
-- submission left in sending longer than eis.sending_stale_minutes as a failed attempt and retries it at once (within
-- eis.max_attempts), like the integration framework does with integrations.stuck_minutes. Idempotent.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('eis.sending_stale_minutes', '15', 'eis', 'Minutes after which a submission left in "sending" (server stopped during the call to the EIS) counts as a failed attempt and is retried', 'number')
ON CONFLICT (key) DO NOTHING;
