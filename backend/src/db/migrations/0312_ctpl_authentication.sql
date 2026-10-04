-- CTPL certificate of cover (COC) authentication (Operations > CTPL Authentication).
--
--   coc_series             COC number series received from an insurer (per branch, or for every branch when branch_code
--                          is empty): prefix, first and last number, next number to allocate, status
--   ctpl_authentications   one row per CTPL cover issued: COC number allocated from the series, vehicle identifiers
--                          (plate, MV file, chassis, engine), the authentication request sent through the CTPL_AUTH
--                          connector (IC-accredited authentication provider), the authentication code received and the
--                          LTO feed status. A code keyed in from the provider's portal (manual fallback) has method
--                          manual. The code and the COC number are printed on the policy schedule.
--
-- A CTPL cover is detected when a motor policy is issued with a CTPL premium (doc.ctplCoveragePremium) or its line /
-- product type is CTPL; ctpl.register_on_issue switches the automatic registration off. Idempotent.

CREATE TABLE IF NOT EXISTS coc_series (
  id serial PRIMARY KEY,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  branch_code text,                                      -- empty: any branch
  prefix text NOT NULL DEFAULT '',
  series_from bigint NOT NULL CHECK (series_from >= 0),
  series_to bigint NOT NULL,
  next_number bigint NOT NULL,
  number_width int NOT NULL DEFAULT 8 CHECK (number_width BETWEEN 1 AND 20),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'closed')),
  received_date date,
  low_stock_threshold int NOT NULL DEFAULT 20,
  remarks text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (series_to >= series_from),
  CHECK (next_number BETWEEN series_from AND series_to + 1));
CREATE INDEX IF NOT EXISTS coc_series_insurer_idx ON coc_series(insurance_company_id, status);

CREATE TABLE IF NOT EXISTS ctpl_authentications (
  id text PRIMARY KEY DEFAULT ('cta_' || encode(gen_random_bytes(8), 'hex')),
  policy_id text NOT NULL REFERENCES policies(id),
  policy_number text,
  insurance_company_id int REFERENCES insurance_companies(id),
  branch_code text,
  coc_series_id int REFERENCES coc_series(id),
  coc_number text,
  plate_number text, mv_file_number text, chassis_number text, engine_number text,
  vehicle_type text,
  ctpl_premium numeric(14,2) NOT NULL DEFAULT 0,
  period_from date, period_to date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requested', 'authenticated', 'failed', 'cancelled')),
  method text CHECK (method IN ('api', 'manual')),
  auth_code text,
  provider_reference text,
  outbox_id bigint REFERENCES integration_outbox(id),
  lto_status text NOT NULL DEFAULT 'not-sent' CHECK (lto_status IN ('not-sent', 'queued', 'sent', 'failed', 'not-required')),
  lto_reference text,
  last_error text,
  requested_at timestamptz, authenticated_at timestamptz, authenticated_by text,
  cancel_reason text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS ctpl_authentications_policy_uq ON ctpl_authentications(policy_id) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS ctpl_authentications_coc_uq ON ctpl_authentications(insurance_company_id, coc_number) WHERE coc_number IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS ctpl_authentications_status_idx ON ctpl_authentications(status, created_at DESC);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('ctpl.register_on_issue', 'true', 'ctpl', 'Register every CTPL cover issued for authentication and allocate its COC number from the insurer''s series', 'boolean'),
 ('ctpl.authenticate_on_issue', 'true', 'ctpl', 'Send the authentication request to the CTPL authentication provider as soon as the COC number is allocated (else from Operations > CTPL Authentication)', 'boolean'),
 ('ctpl.connector', '"CTPL_AUTH"', 'ctpl', 'Connector of the IC-accredited CTPL authentication provider (Master > System Configuration > Integrations)', 'string'),
 ('ctpl.lto_feed', 'false', 'ctpl', 'Also send each authenticated COC to the LTO feed connector (when the provider does not transmit to the LTO itself)', 'boolean'),
 ('ctpl.lto_connector', '"LTO_FEED"', 'ctpl', 'Connector of the LTO feed', 'string'),
 ('ctpl.require_vehicle_ids', '["plateOrMvFile", "chassisNumber"]', 'ctpl', 'Vehicle identifiers required before a COC is authenticated (plateOrMvFile, plateNumber, mvFileNumber, chassisNumber, engineNumber)', 'json'),
 ('ctpl.unauthenticated_alert_hours', '24', 'ctpl', 'Unauthenticated CTPL report: covers waiting longer than this many hours are flagged overdue', 'number')
ON CONFLICT (key) DO NOTHING;
