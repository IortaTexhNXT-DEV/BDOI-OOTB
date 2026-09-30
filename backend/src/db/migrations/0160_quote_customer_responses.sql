-- Customer responses to a quotation recorded by staff: the customer answered by phone, Viber, in a meeting or on a
-- signed form instead of through the e-mailed approval link. Each row is the evidence behind a status change.
CREATE TABLE quote_customer_responses (
  id bigserial PRIMARY KEY,
  quote_id text NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'declined', 'revise')),
  channel text NOT NULL,                             -- one of quotations.customer_response_channels
  response_date date NOT NULL,
  reference text,                                    -- message id, signed form number, meeting notes reference
  remarks text,
  attachment_key text, attachment_name text,         -- uploaded evidence (documents.storage_key)
  from_status text NOT NULL, to_status text NOT NULL,
  recorded_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX quote_customer_responses_quote ON quote_customer_responses(quote_id, created_at DESC);

-- The latest approval link, so staff can copy it again (for Viber / WhatsApp) without invalidating the one e-mailed.
-- The token is also in the e-mail body in email_outbox; approval_token_hash stays the value the public page checks.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approval_token text;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('quotations.customer_response_channels', '["E-mail","Phone","Viber/WhatsApp","Meeting","Signed form"]', 'quotations',
  'Channels offered when recording a customer''s response to a quotation', 'json'),
 ('quotations.customer_response_status', '{"accepted":"CustomerAccepted","declined":"Rejected","revise":"Draft"}', 'quotations',
  'Quotation status set by each recorded customer response (accepted, declined, revise); the change must be allowed by quotations.transitions', 'json')
ON CONFLICT (key) DO NOTHING;
