-- Accounting follow-ups: comsub clawback on return premium, claim cash movements, refunds due from insurers.

-- 1. GL account of refunds due from insurers (return premium on premium already remitted); the seed carries it too.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.account.insurer_refund_receivable', '"1203002"', 'accounting', 'GL: Refunds due from insurers (return premium on premium already remitted)', 'string')
ON CONFLICT (key) DO NOTHING;

-- 2. Comsub adjustments caused by a return premium or cancellation: the share of each referrer line reversed (unpaid)
--    or clawed back (paid) in proportion to the returned premium.
CREATE TABLE IF NOT EXISTS commission_adjustments (
  id bigserial PRIMARY KEY,
  commission_id text NOT NULL REFERENCES commissions(id),
  policy_id text REFERENCES policies(id),
  endorsement_id text,
  reference text,                                    -- endorsement number / policy number
  kind text NOT NULL CHECK (kind IN ('reduction', 'reversal', 'clawback')), -- reduction: not yet approved (no journal)
  ratio numeric(9,6) NOT NULL,                       -- returned premium / policy premium (capped at 1)
  line_status text NOT NULL,                         -- status of the line when adjusted
  amount numeric(14,2) NOT NULL,                     -- comsub reversed / clawed back
  withholding numeric(14,2) NOT NULL DEFAULT 0,
  journal_id text REFERENCES journal_vouchers(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS commission_adjustments_commission_idx ON commission_adjustments (commission_id);
CREATE INDEX IF NOT EXISTS commission_adjustments_policy_idx ON commission_adjustments (policy_id);

-- 3. Cash movements of a claim settled through the broker: funds received from each insurer, payments to the claimant.
CREATE TABLE IF NOT EXISTS claim_settlement_movements (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id),
  kind text NOT NULL CHECK (kind IN ('funds-received', 'paid-to-claimant')),
  insurance_company_id int REFERENCES insurance_companies(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  movement_date date NOT NULL DEFAULT numbering_business_date(),
  bank_account text,                                 -- bank-account master code (or cash GL code)
  payment_mode text,                                 -- bank-transfer | check | cash ...
  reference text,                                    -- insurer remittance advice / voucher or cheque number
  payee text,
  remarks text,
  journal_id text REFERENCES journal_vouchers(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS claim_settlement_movements_claim_idx ON claim_settlement_movements (claim_id, kind);

-- 4. Refunds due from insurers: return premium whose premium was already remitted. Netted against the next remittance
--    to that insurer (the payment voucher is reduced and the credit applied).
CREATE TABLE IF NOT EXISTS insurer_refund_credits (
  id bigserial PRIMARY KEY,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  policy_id text REFERENCES policies(id),
  policy_number text,
  endorsement_id text,
  reference text,                                    -- endorsement number / policy number
  kind text NOT NULL DEFAULT 'return-premium',       -- return-premium | cancellation
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  balance numeric(14,2) NOT NULL,
  split jsonb NOT NULL DEFAULT '{}',                 -- { due_to_insurer, vat, dst, lgt } of the amount
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'applied', 'cancelled')),
  journal_id text REFERENCES journal_vouchers(id),
  applications jsonb NOT NULL DEFAULT '[]',          -- [{ disbursementId, voucherNumber, amount, journalId, at }]
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS insurer_refund_credits_open_idx ON insurer_refund_credits (insurance_company_id, status);
CREATE INDEX IF NOT EXISTS insurer_refund_credits_policy_idx ON insurer_refund_credits (policy_id);

-- 5. Posting rules of the new events (editable versions on Master > Posting Rules)
INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
SELECT 'insurer.refund_due', 1, 'Refund due from insurer', 'Return premium on premium already remitted to the insurer: the debit left on the amounts due to the insurer becomes a refund receivable from it, netted against the next remittance.', 'remittance', 'ENDORSEMENT_NEGATIVE', 'booking', 'Refund due from {{insurer}} – {{policyNumber}} ({{reference}})', 'policy_owner', 'Initial rule', 'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'insurer.refund_due');
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration
FROM posting_rules r, (VALUES
  (1, 'Dr', 'role', 'insurer_refund_receivable', NULL::text, 'amount', true, 'Refund due from {{insurer}} – {{policyNumber}}'),
  (2, 'Cr', 'role', 'due_to_insurer', NULL::text, 'due_to_insurer', true, 'Premium already remitted – {{insurer}}'),
  (3, 'Cr', 'role', 'premium_vat_payable', NULL::text, 'vat', true, 'VAT already remitted – {{insurer}}'),
  (4, 'Cr', 'role', 'premium_dst_payable', NULL::text, 'dst', true, 'DST already remitted – {{insurer}}'),
  (5, 'Cr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', true, 'LGT already remitted – {{insurer}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
WHERE r.event_code = 'insurer.refund_due' AND r.version = 1 AND NOT EXISTS (SELECT 1 FROM posting_rule_lines x WHERE x.rule_id = r.id);

INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
SELECT 'insurer.refund_applied', 1, 'Insurer refund netted against a remittance', 'A refund due from the insurer is deducted from the next premium remittance to it: the amounts due to the insurer are reduced and the refund receivable is cleared.', 'remittance', 'REMITTANCE', 'remittance', 'Refund from {{insurer}} netted – {{voucherNumber}}', 'user', 'Initial rule', 'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'insurer.refund_applied');
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration
FROM posting_rules r, (VALUES
  (1, 'Dr', 'role', 'due_to_insurer', NULL::text, 'due_to_insurer', false, 'Refund netted – {{insurer}} – {{voucherNumber}}'),
  (2, 'Dr', 'role', 'premium_vat_payable', NULL::text, 'vat', false, 'VAT refund netted – {{insurer}}'),
  (3, 'Dr', 'role', 'premium_dst_payable', NULL::text, 'dst', false, 'DST refund netted – {{insurer}}'),
  (4, 'Dr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', false, 'LGT refund netted – {{insurer}}'),
  (5, 'Cr', 'role', 'insurer_refund_receivable', NULL::text, 'amount', false, 'Refund from {{insurer}} applied – {{policyNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
WHERE r.event_code = 'insurer.refund_applied' AND r.version = 1 AND NOT EXISTS (SELECT 1 FROM posting_rule_lines x WHERE x.rule_id = r.id);
