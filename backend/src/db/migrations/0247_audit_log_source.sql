-- Where an audited change came from, for the audit trail screens: { "channel": ..., "name": ... }
--   channel: screen (a signed-in user working on a BrokerVerse screen), api (an integration calling the API directly),
--            job (a scheduled job or system process)
--   name:    the screen of the route (route registry `screen`), or "METHOD /path" for a call from outside the browser
-- Rows written before this migration keep source NULL; the audit trail derives a source for them (lib/auditEvents.js).
-- The stored before / after data are not changed.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS source jsonb;
