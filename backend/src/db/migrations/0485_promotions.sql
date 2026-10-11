-- Promotions and discount caps (TIS-BRD-PROD-15).
--
-- promotions: a time-bound promotional rate (or gross premium discount %) on brand-new vehicles, per version: code and
-- version, period, benefit (rate | discount), the promo excess per product, the unit quota and the lock-in years; where
-- it applies (products, insurers, channel types, combinable with a dealer programme or an order summary discount); the
-- maker-checker stamps. An approved version is never changed: Amend copies it to the next version in Draft.
-- promotion_lines: the vehicle variants of a version with the promo, minimum and remitting rates.
-- promotion_units: one unit per policy issued with a promotion (the quota); returned when the policy is cancelled
-- from inception.
-- discount_caps: minimum and maximum discount % and the lowest Own Damage rate per product and channel type, in force
-- from an effective date once a second user approves them.

CREATE TABLE IF NOT EXISTS promotions (
  id text PRIMARY KEY DEFAULT 'prm_' || encode(gen_random_bytes(8), 'hex'),
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  benefit text NOT NULL DEFAULT 'rate' CHECK (benefit IN ('rate', 'discount')),
  excess jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit_quota integer CHECK (unit_quota IS NULL OR unit_quota >= 1),
  lockin_years integer CHECK (lockin_years IS NULL OR lockin_years BETWEEN 1 AND 10),
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  insurer_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  combine_dealer boolean NOT NULL DEFAULT false,
  combine_discount boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending-approval', 'scheduled', 'active', 'suspended', 'expired', 'withdrawn', 'superseded')),
  notes text,
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
  UNIQUE (code, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS promotions_one_open_version ON promotions (upper(code)) WHERE status IN ('draft', 'pending-approval');
CREATE INDEX IF NOT EXISTS promotions_code_idx ON promotions (upper(code), version DESC);
COMMENT ON TABLE promotions IS 'Promotions on brand-new vehicles (PROD-15), one row per version';

CREATE TABLE IF NOT EXISTS promotion_lines (
  id bigserial PRIMARY KEY,
  promotion_id text NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  variant_id integer NOT NULL REFERENCES vehicle_variants(id),
  year_from integer NOT NULL,
  year_to integer NOT NULL,
  fmv_from numeric(16,2),
  fmv_to numeric(16,2),
  insurer_id integer REFERENCES insurance_companies(id),
  promo_od numeric(8,4),
  min_od numeric(8,4),
  promo_aon numeric(8,4),
  remit_od numeric(8,4),
  remit_aon numeric(8,4),
  discount_pct numeric(6,2),
  UNIQUE (promotion_id, line_no)
);
CREATE INDEX IF NOT EXISTS promotion_lines_promotion_idx ON promotion_lines (promotion_id);

CREATE TABLE IF NOT EXISTS promotion_units (
  id bigserial PRIMARY KEY,
  promotion_code text NOT NULL,
  promotion_id text NOT NULL REFERENCES promotions(id),
  quote_id text NOT NULL UNIQUE,
  policy_id text,
  counted_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz
);
CREATE INDEX IF NOT EXISTS promotion_units_code_idx ON promotion_units (upper(promotion_code)) WHERE returned_at IS NULL;

CREATE TABLE IF NOT EXISTS discount_caps (
  id bigserial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id),
  channel_type text NOT NULL CHECK (channel_type IN ('financing_bank', 'dealer', 'affinity', 'agent', 'direct')),
  min_pct numeric(6,2) NOT NULL CHECK (min_pct BETWEEN 0 AND 100),
  max_pct numeric(6,2) NOT NULL CHECK (max_pct BETWEEN 0 AND 100),
  lowest_od numeric(8,4) NOT NULL CHECK (lowest_od >= 0 AND lowest_od <= 100),
  effective_from date NOT NULL,
  effective_to date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'returned', 'withdrawn')),
  replaces_id bigint REFERENCES discount_caps(id),
  remarks text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by text,
  decided_at timestamptz,
  decision_reason_code text,
  decision_note text,
  CHECK (min_pct <= max_pct),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS discount_caps_lookup_idx ON discount_caps (product_id, channel_type, status);
COMMENT ON TABLE discount_caps IS 'Discount caps per product and channel type (PROD-15), live once approved by a second user';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('promotions.max_period_months', '12', 'quotations', 'Longest period of a promotion, in months', 'number', true),
 ('promotions.max_lockin_years', '3', 'quotations', 'Longest lock-in of a promotion, in years', 'number', true),
 ('promotions.new_vehicle_year_tolerance', '1', 'quotations', 'Brand-new vehicle: model year at most this many years before the policy year', 'number', true),
 ('promotions.keep_on_open_quotes', 'true', 'quotations', 'An open quotation keeps its promotion until its validity ends', 'boolean', true),
 ('promotions.standard_rates', '{"ownDamage": 2, "actsOfNature": 0.5}', 'quotations', 'Standard Own Damage and Acts of Nature rates (%) the promotion discount is measured against', 'json', true),
 ('promotions.rate_change_reasons', '["Dealer negotiation", "Fleet account", "Competitive match", "Management approval", "Other"]', 'quotations', 'Reasons for changing a promotion Own Damage rate', 'json', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('promotion-status', 'Promotion status', 'Activate scheduled promotions whose period starts and expire promotions whose period has ended', '5 0 * * *', 'promotionStatus', '{}', true)
ON CONFLICT (code) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'accounting', 'accounting-manager', 'compliance-officer', 'tis-sales-associate', 'tis-sales-officer',
                 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-finance', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'read:promotions');

INSERT INTO permissions(code, module, description) VALUES
 ('read:promotions', 'promotions', 'View promotions'),
 ('write:promotions', 'promotions', 'Add, amend and submit promotions'),
 ('approve:promotions', 'promotions', 'Approve, return, suspend, resume and withdraw promotions'),
 ('read:discount-caps', 'discount-caps', 'View discount caps'),
 ('write:discount-caps', 'discount-caps', 'Add and end-date discount caps'),
 ('approve:discount-caps', 'discount-caps', 'Approve or return discount caps'),
 ('write:promotion-rates', 'quotations', 'Lower the Own Damage rate of a promotion on a quotation down to its minimum')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', 'read:promotions'), ('system-admin', 'write:promotions'), ('system-admin', 'approve:promotions'),
  ('system-admin', 'read:discount-caps'), ('system-admin', 'write:discount-caps'), ('system-admin', 'approve:discount-caps'), ('system-admin', 'write:promotion-rates'),
  ('processing', 'read:promotions'), ('processing', 'write:promotions'), ('processing', 'read:discount-caps'), ('processing', 'write:discount-caps'),
  ('sales', 'read:promotions'), ('sales', 'read:discount-caps'), ('operations', 'read:promotions'), ('operations', 'read:discount-caps'),
  ('accounting', 'read:promotions'), ('accounting', 'read:discount-caps'),
  ('accounting-manager', 'read:promotions'), ('accounting-manager', 'approve:promotions'), ('accounting-manager', 'read:discount-caps'), ('accounting-manager', 'approve:discount-caps'),
  ('compliance-officer', 'read:promotions'), ('compliance-officer', 'read:discount-caps'),
  -- TISPH personas (proposal, db/seed.js): every front-office persona and Finance read; Operations Officers and the
  -- Operations Unit Head set up; the Sales Unit Head and the General Manager approve; Sales Officers, the Sales Unit
  -- Head and the General Manager may lower a promotion rate to its minimum
  ('tis-sales-associate', 'read:promotions'), ('tis-sales-associate', 'read:discount-caps'),
  ('tis-sales-officer', 'read:promotions'), ('tis-sales-officer', 'read:discount-caps'), ('tis-sales-officer', 'write:promotion-rates'),
  ('tis-sales-unit-head', 'read:promotions'), ('tis-sales-unit-head', 'read:discount-caps'), ('tis-sales-unit-head', 'approve:promotions'),
  ('tis-sales-unit-head', 'approve:discount-caps'), ('tis-sales-unit-head', 'write:promotion-rates'),
  ('tis-ops-associate', 'read:promotions'), ('tis-ops-associate', 'read:discount-caps'),
  ('tis-ops-officer', 'read:promotions'), ('tis-ops-officer', 'write:promotions'), ('tis-ops-officer', 'read:discount-caps'), ('tis-ops-officer', 'write:discount-caps'),
  ('tis-ops-unit-head', 'read:promotions'), ('tis-ops-unit-head', 'write:promotions'), ('tis-ops-unit-head', 'read:discount-caps'), ('tis-ops-unit-head', 'write:discount-caps'),
  ('tis-finance', 'read:promotions'), ('tis-finance', 'read:discount-caps'),
  ('tis-general-manager', 'read:promotions'), ('tis-general-manager', 'read:discount-caps'), ('tis-general-manager', 'approve:promotions'),
  ('tis-general-manager', 'approve:discount-caps'), ('tis-general-manager', 'write:promotion-rates')
) AS g(role, perm)
JOIN roles r ON r.code = g.role JOIN permissions p ON p.code = g.perm
ON CONFLICT DO NOTHING;
