-- Facultative reinsurance placement where the broker acts as reinsurance broker (Reinsurance > Facultative Placements).
--
-- fac_placements: the facultative slip of a risk offered by a cedant (an insurer of the Insurance Company master): the
-- original policy, insured, risk and location, period, the 100% sum insured and premium, the share offered to the
-- facultative market (fac_share_pct), the reinsurance (ceding) commission allowed to the cedant and the brokerage
-- the broker earns, both as a percentage of the facultative premium. Status: draft -> in-market (slip sent to the
-- reinsurers) -> placed (the signed lines reach the offered share) -> bound (cover note to the cedant; journal) ->
-- closed (premium settled both ways) or cancelled.
--
-- fac_placement_shares: the reinsurers approached and their lines: written line (share_pct of the facultative share),
-- status, and once bound the premium, ceding commission, brokerage and net premium due to each reinsurer.
--
-- fac_settlements: premium received from the cedant and paid to each reinsurer, each with its journal (posting rules
-- ri.facultative.premium_received / ri.facultative.premium_paid). Binding posts ri.facultative.bind: premium due from
-- the cedant net of its commission, net premium due to each reinsurer, brokerage income.

CREATE TABLE IF NOT EXISTS fac_placements (
  id text PRIMARY KEY DEFAULT ('fac_' || encode(gen_random_bytes(8), 'hex')),
  slip_number text NOT NULL UNIQUE,
  cedant_id int NOT NULL REFERENCES insurance_companies(id),
  cedant_policy_number text,
  policy_id text REFERENCES policies(id),
  insured_name text NOT NULL,
  risk_description text NOT NULL,
  risk_location text,
  line_of_business text,
  period_from date NOT NULL,
  period_to date NOT NULL,
  currency text NOT NULL DEFAULT 'PHP',
  sum_insured numeric(16,2) NOT NULL,                -- 100%
  gross_premium numeric(14,2) NOT NULL,              -- 100%
  fac_share_pct numeric(7,4) NOT NULL,               -- share of the risk offered to the facultative market
  fac_sum_insured numeric(16,2) NOT NULL,
  fac_premium numeric(14,2) NOT NULL,
  ceding_commission_pct numeric(6,2) NOT NULL DEFAULT 0,
  brokerage_pct numeric(6,2) NOT NULL DEFAULT 0,
  deductibles text,
  conditions text,
  claims_basis text,
  premium_due_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in-market', 'placed', 'bound', 'closed', 'cancelled')),
  journal_id text REFERENCES journal_vouchers(id),
  sent_at timestamptz,
  bound_at timestamptz,
  bound_by text,
  cancel_reason text,
  owner_user_id text REFERENCES users(id),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_to > period_from),
  CHECK (fac_share_pct > 0 AND fac_share_pct <= 100)
);
CREATE INDEX IF NOT EXISTS fac_placements_cedant_id_fk_idx ON fac_placements(cedant_id);
CREATE INDEX IF NOT EXISTS fac_placements_policy_id_fk_idx ON fac_placements(policy_id);
CREATE INDEX IF NOT EXISTS fac_placements_journal_id_fk_idx ON fac_placements(journal_id);
CREATE INDEX IF NOT EXISTS fac_placements_owner_user_id_fk_idx ON fac_placements(owner_user_id);
CREATE INDEX IF NOT EXISTS fac_placements_status_idx ON fac_placements(status, period_from);

CREATE TABLE IF NOT EXISTS fac_placement_shares (
  id bigserial PRIMARY KEY,
  placement_id text NOT NULL REFERENCES fac_placements(id) ON DELETE CASCADE,
  reinsurer_id text NOT NULL REFERENCES reinsurers(id),
  share_pct numeric(7,4) NOT NULL DEFAULT 0,         -- written line, % of the facultative share
  status text NOT NULL DEFAULT 'approached' CHECK (status IN ('approached', 'quoted', 'accepted', 'declined')),
  reinsurer_reference text,
  premium numeric(14,2) NOT NULL DEFAULT 0,
  ceding_commission numeric(14,2) NOT NULL DEFAULT 0,
  brokerage numeric(14,2) NOT NULL DEFAULT 0,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  responded_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fac_placement_shares_uq ON fac_placement_shares(placement_id, reinsurer_id);
CREATE INDEX IF NOT EXISTS fac_placement_shares_reinsurer_id_fk_idx ON fac_placement_shares(reinsurer_id);

CREATE TABLE IF NOT EXISTS fac_settlements (
  id bigserial PRIMARY KEY,
  placement_id text NOT NULL REFERENCES fac_placements(id),
  share_id bigint REFERENCES fac_placement_shares(id),
  direction text NOT NULL CHECK (direction IN ('received', 'paid')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  settled_on date NOT NULL,
  reference text,
  bank_account text,
  journal_id text REFERENCES journal_vouchers(id),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fac_settlements_placement_id_fk_idx ON fac_settlements(placement_id);
CREATE INDEX IF NOT EXISTS fac_settlements_share_id_fk_idx ON fac_settlements(share_id);
CREATE INDEX IF NOT EXISTS fac_settlements_journal_id_fk_idx ON fac_settlements(journal_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('fac_slip', 'Facultative Slip', 'reinsurance', 'FAC', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Facultative reinsurance slip (Reinsurance > Facultative Placements)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('reinsurance.fac_default_brokerage_pct', '10', 'reinsurance', 'Default brokerage (% of the facultative premium) on a new facultative slip', 'number'),
 ('reinsurance.fac_default_ceding_commission_pct', '25', 'reinsurance', 'Default reinsurance commission allowed to the cedant (% of the facultative premium)', 'number'),
 ('reinsurance.fac_premium_due_days', '60', 'reinsurance', 'Days from binding by which the cedant settles the facultative premium (premium due date)', 'number'),
 ('reinsurance.fac_slip_wording', '"The reinsurers named below agree to reinsure the share of the risk stated, on the terms of the original policy and the conditions of this slip, in consideration of the premium shown."', 'reinsurance', 'Wording printed on the facultative slip', 'string')
ON CONFLICT (key) DO NOTHING;

-- Posting rules of the facultative placement (Master > Finance > Posting Rules)
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'ri.facultative.bind', 1, 'Facultative placement bound', 'Facultative premium due from the cedant net of its reinsurance commission, net premium due to each reinsurer, brokerage earned.', 'reinsurance', 'REINSURANCE', 'reinsurance', 'Facultative {{slipNumber}}: {{insured}}', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'ri.facultative.bind') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'ri_premium_receivable', NULL::text, 'due_from_cedant', false, 'Facultative premium {{slipNumber}} due from {{cedant}}'),
  (2, 'Cr', 'role', 'due_to_reinsurer', NULL::text, 'net_premium', true, 'Facultative {{slipNumber}} due to {{insurer}}'),
  (3, 'Cr', 'role', 'ri_commission_income', NULL::text, 'brokerage', false, 'Brokerage {{slipNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'ri.facultative.premium_received', 1, 'Facultative premium received from cedant', 'Facultative premium collected from the cedant into the bank account.', 'reinsurance', 'REINSURANCE', 'reinsurance', 'Facultative {{slipNumber}} premium received from {{cedant}}', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'ri.facultative.premium_received') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{reference}}'),
  (2, 'Cr', 'role', 'ri_premium_receivable', NULL::text, 'amount', false, 'Facultative {{slipNumber}} received from {{cedant}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'ri.facultative.premium_paid', 1, 'Facultative premium paid to reinsurer', 'Net facultative premium paid to a reinsurer from the bank account.', 'reinsurance', 'REINSURANCE', 'reinsurance', 'Facultative {{slipNumber}} premium paid to {{reinsurer}}', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'ri.facultative.premium_paid') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'due_to_reinsurer', NULL::text, 'amount', false, 'Facultative {{slipNumber}} paid to {{reinsurer}}'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{reference}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
