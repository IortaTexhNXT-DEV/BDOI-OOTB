-- Scheme Master and scheme rating (TIS-BRD-SCHM-02, CR-05; FRS SCHM-02 FR-SCM-001 to FR-SCM-040).
--
-- schemes: the Toyota bundling schemes, one row per version: Scheme No. and version, scheme type (scheme1: lock-in,
-- Auto Renewal Agreement; scheme2: guaranteed renewal, premiums in the monthly amortisation), description, effective
-- period (loan booking dates), financing bank, dealers (all, or the dealer groups and branches listed), insurers, the
-- Motor product and its vehicle classes, the perils with the rate of each (perils, JSON: cover code, included, rate
-- basis, rate, fixed premium, limit), the Own Damage deductible, Commission % (of the NET Premium) and Dealer
-- commission % (of the commission), the term in years with the sum insured % of each year and who pays year 1, and the
-- maker-checker stamps. An approved version is never changed: Amend copies it to the next version in Draft. One
-- version of a Scheme No. is in Draft or Pending approval at a time.
-- scheme_vehicle_lines: the make and model range of a version (make; one model or all; one variant or all; year model
-- and sum insured ranges; vehicle class; optional line rates for Own Damage and Acts of Nature).
-- policy_schemes: the scheme kept on a policy term (FR-SCM-023): version, vehicle line, policy year of the term, the
-- year-1 and the year's sum insured, the rates, Commission % and Dealer commission %, the commission and the dealer
-- share of the year, and the scheme premium against an adjusted renewal premium.
--
-- Settings (Master > System > Configuration, group schemes): schemes.max_period_months, schemes.max_term_years,
-- schemes.max_rows, schemes.year1_three_year_ctpl, schemes.warn_rate_above_standard, schemes.default_term_years,
-- schemes.default_schedule; the standard rates shown for comparison are promotions.standard_rates. Job scheme-status
-- (daily 00:10). Permissions read:schemes, write:schemes, approve:schemes.
-- Idempotent.

CREATE TABLE IF NOT EXISTS schemes (
  id text PRIMARY KEY DEFAULT 'sch_' || encode(gen_random_bytes(8), 'hex'),
  scheme_no text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  scheme_type text NOT NULL CHECK (scheme_type IN ('scheme1', 'scheme2')),
  description text NOT NULL,
  effective_from date,
  effective_to date,
  bank_channel_id text REFERENCES distribution_channels(id),
  all_dealers boolean NOT NULL DEFAULT true,
  dealer_channel_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  insurer_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_id integer REFERENCES products(id),
  vehicle_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  od_deductible numeric(14,2),
  perils jsonb NOT NULL DEFAULT '[]'::jsonb,
  commission_pct numeric(6,2) CHECK (commission_pct IS NULL OR commission_pct BETWEEN 0 AND 100),
  dealer_commission_pct numeric(6,2) CHECK (dealer_commission_pct IS NULL OR dealer_commission_pct BETWEEN 0 AND 100),
  term_years integer CHECK (term_years IS NULL OR term_years BETWEEN 1 AND 10),
  year1_paid_by text CHECK (year1_paid_by IS NULL OR year1_paid_by IN ('dealer', 'client-ada', 'client-ma')),
  si_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending-approval', 'scheduled', 'active', 'suspended', 'expired', 'withdrawn', 'superseded')),
  notes text,
  copied_from text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text,
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_reason_code text,
  decision_note text,
  status_reason_code text,
  status_note text,
  status_changed_by text,
  status_changed_at timestamptz,
  UNIQUE (scheme_no, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS schemes_one_open_version ON schemes (upper(scheme_no)) WHERE status IN ('draft', 'pending-approval');
CREATE INDEX IF NOT EXISTS schemes_no_idx ON schemes (upper(scheme_no), version DESC);
CREATE INDEX IF NOT EXISTS schemes_status_idx ON schemes (status, scheme_type);
CREATE INDEX IF NOT EXISTS schemes_bank_channel_id_fk_idx ON schemes (bank_channel_id);
CREATE INDEX IF NOT EXISTS schemes_product_id_fk_idx ON schemes (product_id);
COMMENT ON TABLE schemes IS 'Toyota bundling schemes (Scheme Master, SCHM-02), one row per version';

CREATE TABLE IF NOT EXISTS scheme_vehicle_lines (
  id bigserial PRIMARY KEY,
  scheme_id text NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  brand_id integer NOT NULL REFERENCES vehicle_brands(id),
  model_id integer REFERENCES vehicle_models(id),
  variant_id integer REFERENCES vehicle_variants(id),
  year_from integer NOT NULL,
  year_to integer NOT NULL,
  si_from numeric(16,2) NOT NULL,
  si_to numeric(16,2) NOT NULL,
  vehicle_class text NOT NULL,
  od_rate numeric(8,4),
  aon_rate numeric(8,4),
  UNIQUE (scheme_id, line_no),
  CHECK (year_to >= year_from),
  CHECK (si_to > si_from)
);
CREATE INDEX IF NOT EXISTS scheme_vehicle_lines_scheme_idx ON scheme_vehicle_lines (scheme_id);
CREATE INDEX IF NOT EXISTS scheme_vehicle_lines_brand_id_fk_idx ON scheme_vehicle_lines (brand_id);
CREATE INDEX IF NOT EXISTS scheme_vehicle_lines_model_id_fk_idx ON scheme_vehicle_lines (model_id);
CREATE INDEX IF NOT EXISTS scheme_vehicle_lines_variant_id_fk_idx ON scheme_vehicle_lines (variant_id);
COMMENT ON TABLE scheme_vehicle_lines IS 'Vehicle lines (make and model range) of a scheme version';

CREATE TABLE IF NOT EXISTS policy_schemes (
  id bigserial PRIMARY KEY,
  policy_id text NOT NULL UNIQUE REFERENCES policies(id) ON DELETE CASCADE,
  scheme_id text NOT NULL REFERENCES schemes(id),
  scheme_no text NOT NULL,
  version integer NOT NULL,
  scheme_type text NOT NULL,
  line_no integer,
  line_label text,
  policy_year integer NOT NULL DEFAULT 1,
  term_years integer NOT NULL,
  year1_sum_insured numeric(16,2) NOT NULL,
  sum_insured numeric(16,2) NOT NULL,
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  commission_pct numeric(6,2) NOT NULL DEFAULT 0,
  dealer_commission_pct numeric(6,2) NOT NULL DEFAULT 0,
  dealer_channel_id text REFERENCES distribution_channels(id),
  net_premium numeric(14,2),
  commission_amount numeric(14,2),
  dealer_share numeric(14,2),
  tisph_share numeric(14,2),
  scheme_premium numeric(14,2),
  adjusted_premium numeric(14,2),
  adjust_reason text,
  application_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS policy_schemes_scheme_idx ON policy_schemes (scheme_id);
CREATE INDEX IF NOT EXISTS policy_schemes_dealer_channel_id_fk_idx ON policy_schemes (dealer_channel_id);
COMMENT ON TABLE policy_schemes IS 'The scheme, version, vehicle line and policy year kept on a scheme policy term (SCHM-02 FR-SCM-023)';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('schemes.max_period_months', '24', 'schemes', 'Longest effective period of a scheme version, in months', 'number', true),
 ('schemes.max_term_years', '5', 'schemes', 'Longest term of a scheme, in policy years', 'number', true),
 ('schemes.max_rows', '2000', 'schemes', 'Rows per upload of scheme vehicle lines or loan bookings', 'number', true),
 ('schemes.year1_three_year_ctpl', 'true', 'schemes', 'Year 1 of a scheme policy takes the 3-year CTPL of a brand-new vehicle (the years it covers carry no CTPL)', 'boolean', true),
 ('schemes.warn_rate_above_standard', 'true', 'schemes', 'Warn when a scheme rate is above the standard rate (promotions.standard_rates)', 'boolean', true),
 ('schemes.default_term_years', '5', 'schemes', 'Term proposed for a new scheme (Scheme 1: year 1 plus four auto-renewal years; Scheme 2: the usual TFS loan term)', 'number', true),
 ('schemes.default_schedule', '[100, 90, 80, 70, 60]', 'schemes', 'Sum insured % of year 1 proposed for each policy year of a new scheme (illustrative until TISPH confirms)', 'json', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('scheme-status', 'Scheme status', 'Activate scheduled schemes whose Effective from is reached (the version they replace becomes Superseded) and expire schemes whose Effective to has passed', '10 0 * * *', 'schemeStatus', '{}', true)
ON CONFLICT (code) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'accounting', 'accounting-manager', 'compliance-officer', 'tis-sales-associate', 'tis-sales-officer',
                 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-finance', 'tis-general-manager', 'tis-it-admin'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'read:schemes');

INSERT INTO permissions(code, module, description) VALUES
 ('read:schemes', 'schemes', 'View the Scheme Master, its versions and the premium preview; export'),
 ('write:schemes', 'schemes', 'Add, edit, copy, amend and submit schemes; upload vehicle lines'),
 ('approve:schemes', 'schemes', 'Approve, return, suspend, resume and withdraw schemes (never one you made or changed)')
ON CONFLICT (code) DO NOTHING;

-- FRS SCHM-02 3.3 default grants; TISPH personas as for the promotions (proposal until TISPH names the users):
-- Operations Officers and the Operations Unit Head maintain schemes, the Sales Unit Head and the General Manager approve
-- them, every front-office persona, Finance and IT AppSupport read them.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', 'read:schemes'), ('system-admin', 'write:schemes'), ('system-admin', 'approve:schemes'),
  ('processing', 'read:schemes'), ('processing', 'write:schemes'),
  ('sales', 'read:schemes'), ('operations', 'read:schemes'), ('accounting', 'read:schemes'),
  ('accounting-manager', 'read:schemes'), ('accounting-manager', 'approve:schemes'), ('compliance-officer', 'read:schemes'),
  ('tis-sales-associate', 'read:schemes'), ('tis-sales-officer', 'read:schemes'), ('tis-sales-unit-head', 'read:schemes'), ('tis-sales-unit-head', 'approve:schemes'),
  ('tis-ops-associate', 'read:schemes'), ('tis-ops-officer', 'read:schemes'), ('tis-ops-officer', 'write:schemes'),
  ('tis-ops-unit-head', 'read:schemes'), ('tis-ops-unit-head', 'write:schemes'),
  ('tis-finance', 'read:schemes'), ('tis-it-admin', 'read:schemes'),
  ('tis-general-manager', 'read:schemes'), ('tis-general-manager', 'approve:schemes')
) AS g(role, perm)
JOIN roles r ON r.code = g.role JOIN permissions p ON p.code = g.perm
ON CONFLICT DO NOTHING;
