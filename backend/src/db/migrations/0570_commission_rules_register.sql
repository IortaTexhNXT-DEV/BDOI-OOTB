-- Commission rules register and sharing schemes (TIS-BRD-PROD-16, COMM-05, COMM-06; FRS FR-CMR-001 to FR-CMR-031).
--
-- The Commission Rate Matrix (commission_rates, migration 0122) becomes the commission rules register. A rule keeps its
-- keys (insurer, product, line of business, policy type) and gains a channel type, a motor type and a sum insured band,
-- a rate basis ("% of net premium" as before, or "issuing vs remitting" per peril for Motor) and the peril rates: the
-- issuing rate the client pays, the TIS remitting rate at which external business is remitted to TISPH and the insurer
-- net rate TISPH remits to the insurer, or a commission % of the peril premium. A rule is no longer saved in force: it
-- is submitted and approved on Master > Finance > Configuration Approvals (accounting_config_changes, kind
-- commission-rule) by a holder of approve:commission-rules other than its maker; an amendment is a new version that
-- end-dates the one it replaces on approval; an approved rule is ended, never deleted.
--
-- Sharing schemes (sharing_schemes) say who is paid what of the commission: split lines with a share basis (variance
-- to the TIS remitting rate, % of commission, % of net premium, fixed amount), a default, a minimum and a maximum.
-- Schemes are approved the same way (kind sharing-scheme) and assigned to referrers and distribution channels with an
-- override inside the limits (kind scheme-assignment).
--
-- The policy keeps the commission basis it was booked with (policies.details.commissionBasis): the rule version, the
-- rates of each peril, the amounts and the shares; commission lines of referrers carry the scheme and split line they
-- came from. Idempotent.

-- ---------------------------------------------------------------- permissions
INSERT INTO permissions(code, module, description) VALUES
 ('read:commission-rules', 'commission-rates', 'Open the Commission Rate Matrix and Test rate; see the commission of a policy and what TISPH keeps'),
 ('write:commission-rules', 'commission-rates', 'Add, amend, end and upload commission rules (sent to Configuration Approvals)'),
 ('approve:commission-rules', 'commission-rates', 'Approve or return commission rule changes on Configuration Approvals (never one you made)'),
 ('read:sharing-schemes', 'commission', 'Open Commission > Sharing Schemes; see the share of a policy'),
 ('write:sharing-schemes', 'commission', 'Add, amend and assign sharing schemes; set overrides on referrers and channels'),
 ('approve:sharing-schemes', 'commission', 'Approve or return sharing schemes and assignments; suspend, resume and end schemes'),
 ('write:commission-share', 'commission', 'Change the share of a commission line inside the minimum and maximum of its scheme, with a reason')
ON CONFLICT (code) DO NOTHING;

-- sessions of the roles that gain a permission are refreshed once
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE r.code IN ('system-admin', 'accounting', 'accounting-manager', 'processing', 'sales', 'operations', 'compliance-officer',
                               'tis-finance', 'tis-general-manager', 'tis-it-admin', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head',
                               'tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'read:commission-rules');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = ANY(CASE r.code
  WHEN 'system-admin' THEN ARRAY['read:commission-rules', 'write:commission-rules', 'approve:commission-rules', 'read:sharing-schemes', 'write:sharing-schemes', 'approve:sharing-schemes', 'write:commission-share']
  WHEN 'accounting' THEN ARRAY['read:commission-rules', 'write:commission-rules', 'read:sharing-schemes', 'write:sharing-schemes', 'write:commission-share']
  WHEN 'accounting-manager' THEN ARRAY['approve:commission-rules', 'approve:sharing-schemes']
  WHEN 'processing' THEN ARRAY['read:commission-rules', 'read:sharing-schemes']
  WHEN 'sales' THEN ARRAY['read:sharing-schemes']
  WHEN 'operations' THEN ARRAY['read:sharing-schemes']
  WHEN 'compliance-officer' THEN ARRAY['read:commission-rules', 'read:sharing-schemes']
  -- TISPH (RBAC v4): Finance keeps the rules and schemes, the General Manager approves them, the front office reads
  WHEN 'tis-finance' THEN ARRAY['read:commission-rules', 'write:commission-rules', 'read:sharing-schemes', 'write:sharing-schemes', 'write:commission-share']
  WHEN 'tis-general-manager' THEN ARRAY['read:commission-rules', 'approve:commission-rules', 'read:sharing-schemes', 'approve:sharing-schemes']
  WHEN 'tis-it-admin' THEN ARRAY['read:commission-rules', 'read:sharing-schemes']
  WHEN 'tis-ops-associate' THEN ARRAY['read:sharing-schemes']
  WHEN 'tis-ops-officer' THEN ARRAY['read:commission-rules', 'read:sharing-schemes']
  WHEN 'tis-ops-unit-head' THEN ARRAY['read:commission-rules', 'read:sharing-schemes']
  WHEN 'tis-sales-associate' THEN ARRAY['read:sharing-schemes']
  WHEN 'tis-sales-officer' THEN ARRAY['read:sharing-schemes']
  WHEN 'tis-sales-unit-head' THEN ARRAY['read:sharing-schemes']
  ELSE ARRAY[]::text[] END)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- commission rules
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS channel_type text;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS motor_type text;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS si_from numeric(14,2);
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS si_to numeric(14,2);
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS rate_basis text NOT NULL DEFAULT 'net-premium';
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS peril_rates jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS replaces_id int REFERENCES commission_rates(id);
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS change_action text;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS change_note text;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE commission_rates ADD COLUMN IF NOT EXISTS upload_id text;
ALTER TABLE commission_rates DROP CONSTRAINT IF EXISTS commission_rates_rate_basis_chk;
ALTER TABLE commission_rates ADD CONSTRAINT commission_rates_rate_basis_chk CHECK (rate_basis IN ('net-premium', 'issuing-remitting'));
ALTER TABLE commission_rates DROP CONSTRAINT IF EXISTS commission_rates_approval_status_chk;
ALTER TABLE commission_rates ADD CONSTRAINT commission_rates_approval_status_chk CHECK (approval_status IN ('draft', 'pending', 'approved', 'returned', 'withdrawn'));
ALTER TABLE commission_rates DROP CONSTRAINT IF EXISTS commission_rates_band_chk;
ALTER TABLE commission_rates ADD CONSTRAINT commission_rates_band_chk CHECK (si_from IS NULL OR si_to IS NULL OR si_to > si_from);
CREATE INDEX IF NOT EXISTS commission_rates_lookup_idx ON commission_rates(approval_status, active, effective_from);
COMMENT ON COLUMN commission_rates.peril_rates IS 'Issuing vs remitting rules: [{ peril, basis (issuing-remitting | premium-pct | none), issuing, tisRemitting, insurerNet, commissionPct }], rates in % of the sum insured or of the peril premium';
COMMENT ON COLUMN commission_rates.approval_status IS 'draft (never submitted), pending (on Configuration Approvals), approved (in force between its dates while active), returned, withdrawn';

-- configuration changes of rules, schemes and scheme assignments go through Configuration Approvals
ALTER TABLE accounting_config_changes DROP CONSTRAINT IF EXISTS accounting_config_changes_kind_check;
ALTER TABLE accounting_config_changes ADD CONSTRAINT accounting_config_changes_kind_check
  CHECK (kind IN ('posting-rule-version', 'posting-rule-status', 'account-role', 'account-map', 'commission-taxes', 'role-access', 'delegation', 'sod-rule',
    'sod-exception', 'access-review', 'authority-limits', 'access-controls', 'commission-rule', 'sharing-scheme', 'scheme-assignment'));

-- ---------------------------------------------------------------- sharing schemes
CREATE TABLE IF NOT EXISTS sharing_schemes (
  id serial PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  party_types text[] NOT NULL DEFAULT '{}',
  product_ids int[] NOT NULL DEFAULT '{}',
  insurer_ids int[] NOT NULL DEFAULT '{}',
  policy_type text NOT NULL DEFAULT 'any' CHECK (policy_type IN ('new', 'renewal', 'any')),
  effective_from date NOT NULL,
  effective_to date,
  pay_when_fully_paid boolean NOT NULL DEFAULT true,
  combine_with_referrer boolean NOT NULL DEFAULT false,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'scheduled', 'active', 'suspended', 'superseded', 'ended', 'returned', 'withdrawn')),
  version int NOT NULL DEFAULT 1,
  replaces_id int REFERENCES sharing_schemes(id),
  change_note text,
  remarks text,
  created_by text, updated_by text, submitted_by text, submitted_at timestamptz, approved_by text, approved_at timestamptz,
  suspended_by text, suspended_at timestamptz, suspension_note text, ended_by text, ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sharing_schemes_dates_chk CHECK (effective_to IS NULL OR effective_to >= effective_from));
CREATE UNIQUE INDEX IF NOT EXISTS sharing_schemes_code_live_uq ON sharing_schemes(upper(code)) WHERE status NOT IN ('superseded', 'ended', 'withdrawn');
CREATE INDEX IF NOT EXISTS sharing_schemes_status_idx ON sharing_schemes(status, effective_from);
COMMENT ON COLUMN sharing_schemes.lines IS 'Split lines: [{ paidTo (referrer | parent | channel), basis (variance | commission-pct | net-premium-pct | fixed), perils, defaultValue, min, max, addToReferrer }]';

-- the scheme of a referrer and of a channel (its override inside the limits of the split line), applied on approval
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS scheme_code text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS scheme_override numeric(12,4);
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS pending_scheme jsonb;
ALTER TABLE distribution_channels ADD COLUMN IF NOT EXISTS scheme_code text;
ALTER TABLE distribution_channels ADD COLUMN IF NOT EXISTS scheme_override numeric(12,4);
ALTER TABLE distribution_channels ADD COLUMN IF NOT EXISTS pending_scheme jsonb;

-- commission lines keep the scheme and split line they came from, and the basis of a variance share
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS scheme_code text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS share_basis text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS share_value numeric(12,4);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS share_min numeric(12,4);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS share_max numeric(12,4);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS share_note text;

-- ---------------------------------------------------------------- settings
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('commission.dual_rate_lines', '["motor"]', 'commission', 'Commission rules: lines of business whose rules hold issuing and remitting rates per peril', 'json'),
 ('commission.default_tis_remitting_rates', '{"OD": 1.7, "AON": 0.4}', 'commission', 'Commission rules: default TIS remitting rate (% of sum insured) of Own Damage / Theft and Acts of Nature', 'json'),
 ('commission.peril_defaults', '{"OD": "issuing-remitting", "AON": "issuing-remitting", "BI": "premium-pct", "PD": "premium-pct", "APPA": "premium-pct", "RSA": "none"}', 'commission', 'Commission rules: default basis per Motor peril (issuing-remitting, premium-pct or none)', 'json'),
 ('commission.default_peril_commission_pct', '25', 'commission', 'Commission rules: default commission % of the premium of Bodily Injury, Property Damage and Auto Passenger Personal Accident', 'number'),
 ('commission.rules_max_rows', '2000', 'commission', 'Commission rules upload: rows accepted in one file', 'number'),
 ('commission.peril_based_motor', 'false', 'commission', 'Book Motor policies on the per-peril rates of the commission rules register (issuing, TIS remitting and insurer net rate); off: net premium x matrix rate', 'boolean'),
 ('commission.variance_channels', '["Agent", "Sub-agent", "TFS team member", "Referral", "External"]', 'commission', 'Referrer types that earn the variance between the issuing rate and the TIS remitting rate', 'json'),
 ('commission.variance_perils', '["OD", "AON"]', 'commission', 'Perils that carry a variance share (Own Damage / Theft and Acts of Nature)', 'json'),
 ('commission.promo_variance_basis', '"same_points"', 'commission', 'Variance share on a promotion policy: same_points keeps the standard variance in points (never below the promo net rate); register_rate keeps the TIS remitting rate of the rule', 'string'),
 ('commission.max_chain_levels', '2', 'commission', 'Sharing schemes: levels of the agent hierarchy a scheme can share along', 'number'),
 ('commission.share_change_reason_required', 'true', 'commission', 'A change of a commission share needs a reason from the Reason Codes master', 'boolean'),
 ('commission.motor_types', '[{"code":"PC-SEDAN","name":"PC-Sedan Regular"},{"code":"PC-EV","name":"PC-Electric Vehicles"},{"code":"PC-OTHER","name":"PC-Other than Sedan (SUV / AUV / MPV / Pick-up / Van)"},{"code":"CV-LIGHT","name":"CV-Light"},{"code":"LTO","name":"LTO (Aircon Bus, UV Express, TNVS)"},{"code":"MC-REG","name":"MC-Regular (below 400 cc)"},{"code":"MC-HE","name":"MC-High-End (400 cc and above)"}]', 'commission', 'Commission rules: motor types a rule can be keyed on', 'json'),
 ('commission.motor_type_by_vehicle_type', '{"private_car":"PC-SEDAN","private_cars":"PC-SEDAN","suv":"PC-OTHER","auv":"PC-OTHER","mpv":"PC-OTHER","pick_up":"PC-OTHER","pickup":"PC-OTHER","van":"PC-OTHER","electric":"PC-EV","light_medium_trucks":"CV-LIGHT","light_truck":"CV-LIGHT","commercial":"CV-LIGHT","heavy_trucks":"CV-LIGHT","bus":"LTO","tnvs":"LTO","uv_express":"LTO","motorcycle":"MC-REG","motorcycles":"MC-REG","motorcycle_high_end":"MC-HE"}', 'commission', 'Commission rules: the motor type of a policy from the vehicle type of its quotation when the vehicle model names none', 'json')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- scheduled job
INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('commission-rules-schemes', 'Commission rules and schemes', 'End the commission rules and sharing schemes whose effective-to date has passed, activate scheduled schemes and supersede replaced versions',
  '10 0 * * *', 'commissionRulesSchemes', '{}', true)
ON CONFLICT (code) DO NOTHING;
