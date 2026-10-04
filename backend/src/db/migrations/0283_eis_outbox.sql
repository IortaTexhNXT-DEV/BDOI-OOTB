-- BIR Electronic Invoicing System (EIS) connector: every sales invoice (and its cancellation) is queued as an e-invoice
-- payload in the outbox; the submission adapter sends it to the configured endpoint (live) or to the built-in fake
-- provider (test mode), records the response and retries failures. The connector is switched off by default
-- (eis.enabled): the broker's EIS certification and onboarding with the BIR come first. Credentials are never stored:
-- the settings name the environment variables that hold them. Idempotent.
CREATE TABLE IF NOT EXISTS eis_submissions (
  id text PRIMARY KEY DEFAULT ('eis_' || encode(gen_random_bytes(8), 'hex')),
  invoice_id text NOT NULL REFERENCES sales_invoices(id),
  invoice_number text NOT NULL,
  kind text NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice', 'cancellation')),
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,                            -- SHA-256 of the canonical payload
  signature text,                                        -- signature of the payload (placeholder until the BIR signing certificate is issued)
  signature_alg text,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live', 'manual')),
  provider text NOT NULL DEFAULT 'fake',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'accepted', 'rejected', 'failed', 'manual')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  response jsonb,
  eis_reference text,                                    -- acknowledgement / reference returned by the EIS (or entered after a manual upload)
  submitted_at timestamptz, accepted_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS eis_submissions_uq ON eis_submissions(invoice_id, kind);
CREATE INDEX IF NOT EXISTS eis_submissions_due_idx ON eis_submissions(status, next_attempt_at);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('eis.enabled', 'false', 'eis', 'Send sales invoices to the BIR Electronic Invoicing System (switch on only after the EIS certification of the broker)', 'boolean'),
 ('eis.mode', '"test"', 'eis', 'EIS mode: test (built-in fake provider, nothing leaves the system) or live (the configured endpoint)', 'string'),
 ('eis.endpoint', '""', 'eis', 'EIS invoice submission endpoint (https://...) given by the BIR at onboarding', 'string'),
 ('eis.token_endpoint', '""', 'eis', 'EIS authentication endpoint (https://...) given by the BIR at onboarding', 'string'),
 ('eis.client_id_env', '"BIR_EIS_CLIENT_ID"', 'eis', 'Name of the environment variable holding the EIS client id (the value itself is never stored)', 'string'),
 ('eis.client_secret_env', '"BIR_EIS_CLIENT_SECRET"', 'eis', 'Name of the environment variable holding the EIS client secret', 'string'),
 ('eis.signing_key_env', '"BIR_EIS_SIGNING_KEY"', 'eis', 'Name of the environment variable holding the key that signs the e-invoice payloads', 'string'),
 ('eis.accreditation_id', '""', 'eis', 'EIS / CAS accreditation identifier of the broker''s system, sent with every payload', 'string'),
 ('eis.submit_on_issue', 'true', 'eis', 'Queue an invoice for the EIS when it is issued or cancelled (when the connector is on)', 'boolean'),
 ('eis.max_attempts', '5', 'eis', 'Attempts before a failed submission stops retrying', 'number'),
 ('eis.retry_minutes', '15', 'eis', 'Minutes before a failed submission is retried (doubled after each attempt)', 'number'),
 ('eis.timeout_ms', '20000', 'eis', 'Timeout of one call to the EIS (milliseconds)', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('eis-outbox', 'EIS outbox', 'Send queued e-invoices to the BIR Electronic Invoicing System and retry failed submissions', '*/15 * * * *', 'eisOutbox', '{}', false)
ON CONFLICT (code) DO NOTHING;
