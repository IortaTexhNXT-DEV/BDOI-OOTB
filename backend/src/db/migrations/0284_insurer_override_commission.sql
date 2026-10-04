-- Overriding, profit and contingent commission from insurers. An agreement per insurer sets the basis (production
-- volume, loss ratio or growth), the period, the lines of business and the tiers (from / to value of the basis and the
-- rate on the production). A computation per agreement and period takes the production (premium of the insurer's
-- policies issued in the period) and the claims incurred (paid and outstanding on losses of the period, or the
-- insurer's own figure), finds the tier and the commission; once approved by a second user it posts the receivable
-- (override_commission.accrual). Settlements against the insurer's statement post the cash, the creditable tax withheld
-- and any difference (override_commission.settlement). Idempotent.
CREATE TABLE IF NOT EXISTS override_agreements (
  id text PRIMARY KEY DEFAULT ('ova_' || encode(gen_random_bytes(8), 'hex')),
  agreement_code text UNIQUE NOT NULL,
  name text NOT NULL,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  commission_type text NOT NULL DEFAULT 'overriding' CHECK (commission_type IN ('overriding', 'profit', 'contingent')),
  basis text NOT NULL DEFAULT 'production' CHECK (basis IN ('production', 'loss_ratio', 'growth')),
  period_type text NOT NULL DEFAULT 'quarterly' CHECK (period_type IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  premium_measure text NOT NULL DEFAULT 'net_premium' CHECK (premium_measure IN ('net_premium', 'gross_premium')),
  tier_method text NOT NULL DEFAULT 'slab' CHECK (tier_method IN ('slab', 'banded')),   -- slab: the tier reached applies to all; banded: each band at its rate (production basis)
  lines_of_business text[] NOT NULL DEFAULT '{}',        -- product lines (policies.lob); empty = all
  min_production numeric(16,2) NOT NULL DEFAULT 0,       -- no commission below this production
  vat_applicable boolean NOT NULL DEFAULT true,          -- output VAT on the commission (VAT-registered broker)
  ewt_rate numeric(7,4) NOT NULL DEFAULT 10,             -- expected creditable withholding by the insurer (%)
  effective_from date NOT NULL, effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS override_agreement_tiers (
  id bigserial PRIMARY KEY,
  agreement_id text NOT NULL REFERENCES override_agreements(id) ON DELETE CASCADE,
  tier_no int NOT NULL,
  from_value numeric(18,4) NOT NULL DEFAULT 0,           -- production (PHP), loss ratio (%) or growth (%)
  to_value numeric(18,4),                                -- open ended when empty
  rate numeric(7,4) NOT NULL DEFAULT 0,                  -- % of the production
  UNIQUE (agreement_id, tier_no));

CREATE TABLE IF NOT EXISTS override_computations (
  id text PRIMARY KEY DEFAULT ('ovc_' || encode(gen_random_bytes(8), 'hex')),
  computation_number text UNIQUE NOT NULL,
  agreement_id text NOT NULL REFERENCES override_agreements(id),
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  period_label text NOT NULL,                            -- 2026-Q3, 2026-07, 2026-H2, 2026
  period_from date NOT NULL, period_to date NOT NULL,
  production numeric(18,2) NOT NULL DEFAULT 0,
  policies int NOT NULL DEFAULT 0,
  prior_production numeric(18,2) NOT NULL DEFAULT 0,     -- same period one year earlier (growth basis)
  growth_pct numeric(12,4),
  claims_incurred numeric(18,2) NOT NULL DEFAULT 0,
  claims_source text NOT NULL DEFAULT 'system' CHECK (claims_source IN ('system', 'insurer')),
  claims_note text,
  loss_ratio_pct numeric(12,4),
  basis_value numeric(18,4),                             -- the value the tiers are read against
  tier_no int, rate numeric(7,4) NOT NULL DEFAULT 0,
  commission numeric(16,2) NOT NULL DEFAULT 0,
  vat numeric(16,2) NOT NULL DEFAULT 0,
  receivable numeric(16,2) NOT NULL DEFAULT 0,           -- commission + VAT
  expected_ewt numeric(16,2) NOT NULL DEFAULT 0,
  settled numeric(16,2) NOT NULL DEFAULT 0,              -- receivable cleared by settlements
  balance numeric(16,2) NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}',                   -- bands, per line of business production
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'partially_settled', 'settled', 'rejected', 'cancelled')),
  journal_id text, reversal_journal_id text,
  submitted_by text, submitted_at timestamptz, approved_by text, approved_at timestamptz,
  rejected_by text, rejected_at timestamptz, rejection_reason text,
  cancelled_by text, cancelled_at timestamptz, cancel_reason text,
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS override_computations_period_uq ON override_computations(agreement_id, period_from) WHERE status NOT IN ('rejected', 'cancelled');

CREATE TABLE IF NOT EXISTS override_settlements (
  id text PRIMARY KEY DEFAULT ('ovs_' || encode(gen_random_bytes(8), 'hex')),
  computation_id text NOT NULL REFERENCES override_computations(id),
  statement_reference text NOT NULL,                     -- the insurer's statement / remittance advice
  statement_date date NOT NULL,
  statement_amount numeric(16,2) NOT NULL DEFAULT 0,     -- commission (with VAT) the insurer's statement acknowledges
  cash_received numeric(16,2) NOT NULL DEFAULT 0,
  ewt_withheld numeric(16,2) NOT NULL DEFAULT 0,
  form_2307_no text,
  applied numeric(16,2) NOT NULL DEFAULT 0,              -- receivable cleared
  difference numeric(16,2) NOT NULL DEFAULT 0,           -- cash + EWT - applied, posted to the commission income
  difference_treatment text NOT NULL DEFAULT 'leave_open' CHECK (difference_treatment IN ('leave_open', 'adjust_income')),
  bank_account text, remarks text,
  journal_id text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS override_settlements_comp_idx ON override_settlements(computation_id);

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('override_computation', 'Overriding Commission Computation', 'commission', 'OVC', 'Overriding, profit or contingent commission computed for an insurer agreement and period', 'migration:0284')
ON CONFLICT (code) DO NOTHING;

INSERT INTO gl_accounts(code, name, account_type, category, is_open_item, allow_manual, fs_group, normal_balance, description) VALUES
 ('1203006', 'Overriding and Contingent Commission Receivable from Insurers', 'asset', 'Receivables', false, false, 'Current Assets', 'debit', 'Overriding, profit and contingent commission computed under insurer agreements, until the insurer settles')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.account.override_commission_receivable', '"1203006"', 'accounting', 'GL: Overriding and contingent commission receivable from insurers', 'string'),
 ('accounting.account.override_commission_income', '"3201002"', 'accounting', 'GL: Contingent and profit commission income (overriding commission agreements)', 'string'),
 ('commission.override_requires_approval', 'true', 'commission', 'Overriding commission computations are approved by a user other than the one who prepared them before they post', 'boolean'),
 ('commission.override_claims_statuses', '["registered","in-review","pending-approval","approved","settled","closed"]', 'commission', 'Claim statuses counted as claims incurred in the loss ratio of overriding commission agreements', 'json'),
 ('commission.override_settlement_tolerance', '1', 'commission', 'Difference (PHP) between the insurer''s statement and the computation still treated as a match', 'number')
ON CONFLICT (key) DO NOTHING;

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'override_commission.accrual', 1, 'Overriding commission receivable booked',
    'An approved overriding, profit or contingent commission computation: the receivable from the insurer (commission and VAT), the commission income and the output VAT.',
    'commission', 'COMMISSION', 'override-commission', 'Overriding commission {{computationNumber}} {{insurer}} {{period}}', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'override_commission.accrual') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, false, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'override_commission_receivable', NULL::text, 'receivable', '{{insurer}} {{period}} {{computationNumber}}'),
  (2, 'Cr', 'role', 'override_commission_income', NULL::text, 'commission', '{{commissionType}} commission {{period}}'),
  (3, 'Cr', 'role', 'output_vat', NULL::text, 'vat', 'Output VAT {{computationNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, narration);

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'override_commission.settlement', 1, 'Overriding commission settled by the insurer',
    'Settlement of an overriding commission receivable against the insurer''s statement: cash received, creditable tax withheld by the insurer (BIR Form 2307), the receivable cleared and any difference to the commission income.',
    'commission', 'COLLECTION', 'override-commission', 'Overriding commission {{computationNumber}} settled ({{insurer}}, {{statementReference}})', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'override_commission.settlement') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, false, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'bank_account', NULL::text, 'cash', '{{insurer}} {{statementReference}}'),
  (2, 'Dr', 'role', 'creditable_wht', NULL::text, 'ewt', 'CWT withheld by {{insurer}} {{form2307}}'),
  (3, 'Cr', 'role', 'override_commission_receivable', NULL::text, 'applied', '{{computationNumber}} settled'),
  (4, 'Cr', 'role', 'override_commission_income', NULL::text, 'difference', 'Difference with statement {{statementReference}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, narration);
