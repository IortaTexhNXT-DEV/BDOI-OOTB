-- Integration framework (Master > System Configuration > Integrations): one place for every connection to a third
-- party (SMS gateways, CTPL authentication provider and LTO feed, insurer APIs, bank payment files, later the BIR EIS).
--
--   integration_connectors   a configured connection: kind, adapter (provider), enabled, mode (test / live), endpoint,
--                            the NAMES of the environment variables that hold its credentials (never the values),
--                            adapter options and the retry policy
--   integration_outbox       every message to send through a connector: status, attempts, next attempt, last error,
--                            response; the job integration-outbox sends what is due and retries with backoff
--   integration_attempts     one row per attempt (duration, result, error) for the monitor
--   integration_inbox        every message received from a third party (webhook) or read from a file the user imported
--                            (bank status file, insurer claim status file): status, attempts, last error
--
-- Code: backend/src/modules/integrations (registry of adapters and message types, dispatcher, monitor routes).
-- Connectors and their test-mode defaults are seeded by seeds/75_integrations.sql. Idempotent.

CREATE TABLE IF NOT EXISTS integration_connectors (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  name text NOT NULL,
  kind text NOT NULL,                                   -- sms | messaging | ctpl_auth | lto_feed | insurer_api | bank_file | eis ...
  adapter text NOT NULL,                                -- provider adapter in the registry (http_sms, viber_business, ctpl_http ...)
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  endpoint text,                                        -- base URL of the provider (live mode)
  credential_env jsonb NOT NULL DEFAULT '{}',           -- { apiKey: "SEMAPHORE_API_KEY", ... }: environment variable NAMES only
  options jsonb NOT NULL DEFAULT '{}',                  -- adapter options (field names, paths, sender name, number format ...)
  timeout_ms int NOT NULL DEFAULT 15000 CHECK (timeout_ms BETWEEN 1000 AND 120000),
  max_attempts int NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  retry_base_seconds int NOT NULL DEFAULT 60 CHECK (retry_base_seconds BETWEEN 1 AND 86400),
  retry_max_seconds int NOT NULL DEFAULT 3600 CHECK (retry_max_seconds BETWEEN 1 AND 604800),
  description text,
  sort_order int NOT NULL DEFAULT 100,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS integration_outbox (
  id bigserial PRIMARY KEY,
  connector_code text NOT NULL REFERENCES integration_connectors(code),
  message_type text NOT NULL,                           -- sms.send, ctpl.authenticate, insurer.policy_issue, bank.payment_file ...
  entity text, entity_id text,                          -- the record the message is about (policy, claim, ctpl_authentication ...)
  reference text,                                       -- what the user recognises: mobile number, COC number, policy number, batch number
  idempotency_key text UNIQUE,                          -- the same business event is queued once
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'retry', 'sent', 'failed', 'cancelled', 'skipped')),
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),   -- mode of the connector when last attempted
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  external_ref text,                                    -- the provider's id of the message / transaction
  response jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz);
CREATE INDEX IF NOT EXISTS integration_outbox_due_idx ON integration_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS integration_outbox_connector_idx ON integration_outbox(connector_code, created_at DESC);
CREATE INDEX IF NOT EXISTS integration_outbox_entity_idx ON integration_outbox(entity, entity_id);
CREATE INDEX IF NOT EXISTS integration_outbox_type_idx ON integration_outbox(message_type, created_at DESC);

CREATE TABLE IF NOT EXISTS integration_attempts (
  id bigserial PRIMARY KEY,
  outbox_id bigint NOT NULL REFERENCES integration_outbox(id) ON DELETE CASCADE,
  attempt int NOT NULL,
  mode text NOT NULL,
  ok boolean NOT NULL,
  http_status int,
  duration_ms int,
  error text,
  at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS integration_attempts_outbox_idx ON integration_attempts(outbox_id, attempt);

CREATE TABLE IF NOT EXISTS integration_inbox (
  id bigserial PRIMARY KEY,
  connector_code text REFERENCES integration_connectors(code),
  message_type text NOT NULL,                           -- insurer.claim_status, ctpl.authentication_result, bank.status_file ...
  source text NOT NULL DEFAULT 'webhook' CHECK (source IN ('webhook', 'file', 'manual')),
  external_ref text,
  entity text, entity_id text,
  signature_valid boolean,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  result jsonb,
  received_by text,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz);
CREATE INDEX IF NOT EXISTS integration_inbox_received_idx ON integration_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS integration_inbox_status_idx ON integration_inbox(status, connector_code);

INSERT INTO permissions(code, module, description) VALUES
 ('read:integrations', 'integrations', 'View connectors, the integration outbox and inbox (Master > System Configuration > Integrations)'),
 ('write:integrations', 'integrations', 'Configure connectors and message templates, resend or cancel integration messages')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code = 'system-admin' AND p.code IN ('read:integrations', 'write:integrations')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('integrations.dispatch_batch_size', '50', 'integrations', 'Integration outbox: most messages sent per run of the integration-outbox job', 'number'),
 ('integrations.stuck_minutes', '10', 'integrations', 'Integration outbox: a message left "processing" longer than this (server stopped while sending) is queued again', 'number'),
 ('integrations.inbound_enabled', 'true', 'integrations', 'Accept messages pushed by third parties on /api/public/integrations/inbound/<connector> (signed with the connector''s webhook secret)', 'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('integration-outbox', 'Integration outbox', 'Send the integration messages that are due (SMS, CTPL authentication, LTO feed, insurer requests) and retry failed attempts with backoff', '*/2 * * * *', 'integrationOutbox', '{}', true)
ON CONFLICT (code) DO NOTHING;
