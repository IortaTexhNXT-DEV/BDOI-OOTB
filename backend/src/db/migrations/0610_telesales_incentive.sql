-- Telesales incentive (TIS-BRD-COMM-08, CR-08, MOM-S5-TSI-MOTOR; FRS COMM-08 FR-TSI-001 to FR-TSI-043; gap register
-- GAP-REMIT-09). A Telesales program of the incentive engine pays the callers of the accredited insurance partners a
-- monthly incentive on Motor policies from official call-out leads: a minimum number of policies, an ANC tier table
-- with new-business and renewal amounts, a production-excess table, withholding tax, exclusions, disqualification and
-- recovery of policies cancelled after payout.
--
--   incentive_program_versions  the program values by month (minimum, withholding tax %, products, tiers, bands),
--                               approved on Configuration Approvals (accounting_config_changes kind incentive-program,
--                               approve:incentive, never the maker)
--   incentive_callers           the callers of a program: insurance partner, Team Leader, dates, disqualification
--   callout_endorsements        prospects endorsed as call-out leads for a caller by the Team Leader (Lead Assignment)
--   telesales_policies          a policy attributed to a caller (FR-TSI-011) with its kind, payment, commission
--                               settlement, eligible date, net commission, counting, exclusion and recovery
--   incentive_batch_policies    the policies considered by a calculation batch and their status (Policies tab)
--
-- Settings (Master > System > Configuration, group incentive): incentive.telesales.*; the Telesales program type and
-- the Average Net Commission metric are added to incentive.program_types and incentive.metric_map. The posting rule
-- incentive.accrual gets version 2 with the withholding tax line (Dr expense gross / Cr incentives payable / Cr WHT payable).
-- Permission write:callout-endorsement (Team Leaders). Job telesales-incentive-calc. Idempotent.

ALTER TABLE incentive_programs ADD COLUMN IF NOT EXISTS inactive_from date;
COMMENT ON COLUMN incentive_programs.inactive_from IS 'Telesales: first month the program no longer runs (deactivated from the next month without a batch)';

CREATE TABLE IF NOT EXISTS incentive_program_versions (
  id serial PRIMARY KEY,
  program_id int NOT NULL REFERENCES incentive_programs(id) ON DELETE CASCADE,
  version int NOT NULL,
  effective_from date NOT NULL,
  min_policies int NOT NULL DEFAULT 15,
  wht_pct numeric(5,2) NOT NULL DEFAULT 5,
  products int[] NOT NULL DEFAULT '{}',
  tiers jsonb NOT NULL DEFAULT '[]',
  bands jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending approval', 'Approved')),
  change_reason text,
  return_remark text,
  change_id bigint,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text, submitted_at timestamptz,
  approved_by text, approved_at timestamptz,
  returned_by text, returned_at timestamptz,
  UNIQUE (program_id, version)
);
COMMENT ON TABLE incentive_program_versions IS 'Telesales program values by month (FR-TSI-005): tiers [{ ancFrom, nbAmount, renewalAmount }], bands [{ over, every, amount }]';
CREATE INDEX IF NOT EXISTS incentive_program_versions_program_idx ON incentive_program_versions(program_id, status);

CREATE TABLE IF NOT EXISTS incentive_callers (
  id serial PRIMARY KEY,
  program_id int NOT NULL REFERENCES incentive_programs(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  team_leader_id text REFERENCES users(id),
  date_from date NOT NULL,
  date_to date,
  disqualified_from date,
  disqualify_reason_code text,
  disqualify_reason text,
  disqualified_by text REFERENCES users(id),
  disqualified_at timestamptz,
  reinstated_on date,
  reinstate_remark text,
  reinstated_by text REFERENCES users(id),
  reinstated_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE incentive_callers IS 'Callers of a Telesales program (FR-TSI-004): insurance partner, Team Leader, dates, disqualification and reinstatement';
CREATE INDEX IF NOT EXISTS incentive_callers_program_idx ON incentive_callers(program_id);
CREATE INDEX IF NOT EXISTS incentive_callers_user_idx ON incentive_callers(user_id);
CREATE INDEX IF NOT EXISTS incentive_callers_leader_idx ON incentive_callers(team_leader_id);

CREATE TABLE IF NOT EXISTS callout_endorsements (
  id bigserial PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  caller_user_id text NOT NULL REFERENCES users(id),
  endorsed_by text REFERENCES users(id),
  endorsed_at timestamptz NOT NULL DEFAULT now(),
  rule_id int,
  status text NOT NULL DEFAULT 'endorsed' CHECK (status IN ('endorsed', 'withdrawn', 'moved', 'ended')),
  ended_at timestamptz,
  ended_by text,
  end_reason text
);
COMMENT ON TABLE callout_endorsements IS 'Prospects endorsed as call-out leads for a caller by the Team Leader (FR-TSI-010)';
CREATE INDEX IF NOT EXISTS callout_endorsements_lead_idx ON callout_endorsements(lead_id);
CREATE INDEX IF NOT EXISTS callout_endorsements_caller_idx ON callout_endorsements(caller_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS callout_endorsements_open_uq ON callout_endorsements(lead_id) WHERE status = 'endorsed';
ALTER TABLE lead_assignment_rules ADD COLUMN IF NOT EXISTS callout boolean NOT NULL DEFAULT false;
-- the endorsement, its withdrawal, its move to another caller of the team and its end are entries of the prospect's
-- Assignment history
ALTER TABLE lead_assignment_history DROP CONSTRAINT IF EXISTS lead_assignment_history_action_check;
ALTER TABLE lead_assignment_history ADD CONSTRAINT lead_assignment_history_action_check
  CHECK (action IN ('auto', 'manual', 'bulk', 'queue', 'queued', 'taken', 'callout-endorse', 'callout-withdraw', 'callout-move', 'callout-end'));
COMMENT ON COLUMN lead_assignment_rules.callout IS 'Call-out rule: every prospect the rule assigns to a caller is endorsed as a call-out lead';

CREATE TABLE IF NOT EXISTS telesales_policies (
  policy_id text PRIMARY KEY REFERENCES policies(id),
  program_id int NOT NULL REFERENCES incentive_programs(id),
  caller_user_id text NOT NULL REFERENCES users(id),
  caller_row_id int REFERENCES incentive_callers(id),
  endorsement_id bigint REFERENCES callout_endorsements(id),
  quote_id text,
  quoted_on date,
  endorsed_on date,
  kind text NOT NULL CHECK (kind IN ('NB', 'Renewal')),
  fully_paid_on date,
  commission_settled_on date,
  eligible_on date,
  net_commission numeric(14,2),
  cancelled_on date,
  counted_batch_id text,
  counted_period text,
  paid_level int,
  paid_amount numeric(14,2),
  excluded_reason_code text,
  excluded_reason text,
  excluded_by text,
  excluded_at timestamptz,
  excluded_batch_id text,
  recovery_batch_id text,
  recovery_amount numeric(14,2),
  linked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE telesales_policies IS 'Telesales policies of the callers (FR-TSI-011 to 022, 035, 036): kind, eligible date, net commission, counting, exclusion, recovery';
CREATE INDEX IF NOT EXISTS telesales_policies_caller_idx ON telesales_policies(caller_user_id, eligible_on);
CREATE INDEX IF NOT EXISTS telesales_policies_batch_idx ON telesales_policies(counted_batch_id);

ALTER TABLE incentive_calculations
  ADD COLUMN IF NOT EXISTS program_kind text,
  ADD COLUMN IF NOT EXISTS version_id int,
  ADD COLUMN IF NOT EXISTS gross_total numeric(16,2),
  ADD COLUMN IF NOT EXISTS tax_total numeric(16,2),
  ADD COLUMN IF NOT EXISTS execution_log jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS triggered_by text;
COMMENT ON COLUMN incentive_calculations.program_kind IS 'telesales for a batch of a Telesales program (one program and month per batch)';

ALTER TABLE incentive_results
  ADD COLUMN IF NOT EXISTS nb_count int,
  ADD COLUMN IF NOT EXISTS renewal_count int,
  ADD COLUMN IF NOT EXISTS anc numeric(14,2),
  ADD COLUMN IF NOT EXISTS level int,
  ADD COLUMN IF NOT EXISTS base_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS additional_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS recovery_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS wht_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS carried_forward numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carry_taken_by text;
COMMENT ON COLUMN incentive_results.result IS 'Telesales caller line result: Qualified, Not qualified, Below level 1, Disqualified, Recovery outstanding';

CREATE TABLE IF NOT EXISTS incentive_batch_policies (
  id bigserial PRIMARY KEY,
  calculation_id text NOT NULL REFERENCES incentive_calculations(batch_id) ON DELETE CASCADE,
  program_id int REFERENCES incentive_programs(id),
  policy_id text NOT NULL REFERENCES policies(id),
  caller_user_id text REFERENCES users(id),
  kind text,
  fully_paid_on date,
  commission_settled_on date,
  eligible_on date,
  net_commission numeric(14,2),
  status text NOT NULL,
  detail text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  level int,
  UNIQUE (calculation_id, policy_id)
);
COMMENT ON TABLE incentive_batch_policies IS 'Telesales policies considered by a calculation batch (Policies tab): Counted, Excluded, Waiting for commission, Not fully paid, Cancelled, Recovery, Disqualified, Not a call-out lead';
CREATE INDEX IF NOT EXISTS incentive_batch_policies_policy_idx ON incentive_batch_policies(policy_id);

-- Configuration Approvals: program versions are a change kind of their own (decided with approve:incentive)
DO $$
DECLARE kinds text[];
BEGIN
  SELECT array_agg(DISTINCT m[1]) INTO kinds FROM pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') AS m
   WHERE c.conname = 'accounting_config_changes_kind_check';
  IF kinds IS NOT NULL AND NOT ('incentive-program' = ANY(kinds)) THEN
    ALTER TABLE accounting_config_changes DROP CONSTRAINT accounting_config_changes_kind_check;
    EXECUTE format('ALTER TABLE accounting_config_changes ADD CONSTRAINT accounting_config_changes_kind_check CHECK (kind IN (%s))',
      (SELECT string_agg(quote_literal(k), ', ') FROM unnest(array_append(kinds, 'incentive-program')) AS k));
  END IF;
END $$;

-- Permission of the Team Leaders (FRS 3.2); the grants of a fresh database are in the seed (seed.js)
INSERT INTO permissions(code, module, description) VALUES
 ('write:callout-endorsement', 'lead-assignment', 'Endorse prospects as call-out leads of the telesales callers and withdraw the endorsement; save call-out assignment rules')
ON CONFLICT (code) DO NOTHING;
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('system-admin', 'tis-sales-officer', 'tis-sales-unit-head'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'write:callout-endorsement');
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code IN ('system-admin', 'tis-sales-officer', 'tis-sales-unit-head') AND p.code = 'write:callout-endorsement'
ON CONFLICT DO NOTHING;

-- Settings (FRS 6.1)
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('incentive.telesales.excess_method', '"banded"', 'incentive', 'Telesales: how the production-excess table is applied: banded (each band pays its full blocks) or highest_band (only the highest band reached)', 'string', true),
 ('incentive.telesales.run_day', '5', 'incentive', 'Telesales: day of the month on which the job calculates the previous month', 'number', true),
 ('incentive.telesales.callout_validity_days', '90', 'incentive', 'Telesales: days a call-out endorsement stays valid for a new quotation', 'number', true),
 ('incentive.telesales.same_insurer_only', 'true', 'incentive', 'Telesales: count only policies placed with the caller''s insurance partner', 'boolean', true),
 ('incentive.telesales.default_min_policies', '15', 'incentive', 'Telesales: minimum policies to qualify proposed on a new program', 'number', true),
 ('incentive.telesales.default_wht_pct', '5', 'incentive', 'Telesales: withholding tax % proposed on a new program', 'number', true),
 ('incentive.telesales.eligible_lines', '["motor"]', 'incentive', 'Telesales: product lines whose products a Telesales program may count (Motor only)', 'json', true),
 ('incentive.telesales.default_tiers', '[{"ancFrom":2500,"nbAmount":300,"renewalAmount":150},{"ancFrom":4000,"nbAmount":500,"renewalAmount":250},{"ancFrom":6000,"nbAmount":700,"renewalAmount":350},{"ancFrom":8000,"nbAmount":900,"renewalAmount":450},{"ancFrom":10000,"nbAmount":1100,"renewalAmount":550}]', 'incentive', 'Telesales: ANC tier table proposed on a new program (ANC from, new-business and renewal amount per policy; renewal amounts illustrative until TISPH confirms them)', 'json', true),
 ('incentive.telesales.default_bands', '[{"over":30,"every":5,"amount":2000},{"over":50,"every":5,"amount":3000},{"over":75,"every":2,"amount":4000},{"over":100,"every":2,"amount":5000}]', 'incentive', 'Telesales: production-excess table proposed on a new program (in excess of, every, additional incentive)', 'json', true)
ON CONFLICT (key) DO NOTHING;
UPDATE app_settings SET value = value || '["Telesales"]'::jsonb WHERE key = 'incentive.program_types' AND jsonb_typeof(value) = 'array' AND NOT value ? 'Telesales';
UPDATE app_settings SET value = value || '{"Average Net Commission (ANC)": "anc"}'::jsonb WHERE key = 'incentive.metric_map' AND jsonb_typeof(value) = 'object' AND NOT value ? 'Average Net Commission (ANC)';

-- Reasons of a disqualification and of an excluded policy (Reason Codes master; also seeded by 97_telesales_incentive.sql)
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' THEN jsonb_set(f, '{options}', (f->'options') || '["incentive_disqualify", "incentive_exclude"]'::jsonb) ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'incentive_disqualify'));
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('TDQ-MISREP', 'Misrepresentation', 'incentive_disqualify', true, 1300),
             ('TDQ-GRAB', 'Account grabbing', 'incentive_disqualify', true, 1310),
             ('TDQ-REASSIGN', 'Unauthorized reassignment', 'incentive_disqualify', true, 1320),
             ('TDQ-OTHER', 'Other', 'incentive_disqualify', true, 1390),
             ('TEX-MISREP', 'Misrepresentation', 'incentive_exclude', true, 1400),
             ('TEX-GRAB', 'Account grabbing', 'incentive_exclude', true, 1410),
             ('TEX-REASSIGN', 'Unauthorized reassignment', 'incentive_exclude', true, 1420),
             ('TEX-DUPLICATE', 'Duplicate', 'incentive_exclude', true, 1430),
             ('TEX-OTHER', 'Other', 'incentive_exclude', true, 1490)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));

-- Accrual of a telesales batch with its withholding tax (FR-TSI-041): version 2 of incentive.accrual, in force from the
-- date of version 1 (a batch of another program type supplies tax 0 and gross = amount: the same journal as before)
INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by, effective_from)
SELECT 'incentive.accrual', 2, 'Incentives approved', 'Producer incentives of an approved calculation batch accrued: expense on the gross, withholding tax payable and incentives payable on the total (telesales).',
  'incentive', 'INCENTIVE_ACCRUAL', 'incentive', 'Incentives {{batchId}} ({{period}}) approved', 'user', 'Withholding tax line (TIS-BRD-COMM-08, FR-TSI-041)', 'system', 'system', r.effective_from
FROM posting_rules r WHERE r.event_code = 'incentive.accrual' AND r.version = 1
  AND NOT EXISTS (SELECT 1 FROM posting_rules x WHERE x.event_code = 'incentive.accrual' AND x.version = 2);
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration
FROM posting_rules r, (VALUES
  (1, 'Dr', 'role', 'incentive_expense', NULL::text, 'gross', false, 'Incentives {{batchId}}'),
  (2, 'Cr', 'role', 'incentive_payable', NULL::text, 'amount', false, 'Incentives payable {{batchId}}'),
  (3, 'Cr', 'role', 'wht_payable', NULL::text, 'tax', false, 'Withholding tax on incentives {{batchId}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
WHERE r.event_code = 'incentive.accrual' AND r.version = 2 AND NOT EXISTS (SELECT 1 FROM posting_rule_lines x WHERE x.rule_id = r.id);

-- Monthly job (FRS 6.2): on incentive.telesales.run_day at 06:00 the previous month of the Telesales program in force
INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('telesales-incentive-calc', 'Telesales incentive calculation',
  'Daily at 06:00: attributes and dates the telesales policies; on the run day (incentive.telesales.run_day, default 5) creates the Calculated batch of the previous month for the Telesales program in force and notifies the users who calculate incentives; does nothing when the month has a batch',
  '0 6 * * *', 'telesalesIncentiveCalc', '{}', true)
ON CONFLICT (code) DO NOTHING;
