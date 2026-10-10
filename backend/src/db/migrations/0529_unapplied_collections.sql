-- Unapplied collections: On Account, excess, floating and advance payments (TIS-BRD-COLL-04; PBSM-M15-COL-SLA).
--
-- receipts.excess_handling:
--   on-account  a payment above what a policy owes is held On Account (kind excess) instead of raising an extra bill
--   bill        the excess raises a receipt-sourced bill on the policy (earlier behaviour)
-- A payment with no bill to apply to is recorded as floating (client not yet known or no bill) or advance (paid before
-- the bill). Each held amount (unapplied_collections) is posted Dr cash / Cr Clients' deposits and unapplied collections
-- (receipt.unapplied), allocated later to an open bill (unapplied.allocate: Dr unapplied collections / Cr premium
-- receivable) or refunded (unapplied.refund: Dr unapplied collections / Cr client refund payable) with a reason
-- (context unapplied_refund). It is to be allocated within collections.unapplied_sla_days (2 working days, PBSM-M15).
-- Idempotent.

CREATE TABLE IF NOT EXISTS unapplied_collections (
  id text PRIMARY KEY DEFAULT ('uac_' || encode(gen_random_bytes(8), 'hex')),
  receipt_id text REFERENCES receipts(id),
  receipt_line_id text,
  client_id text REFERENCES clients(id),
  policy_id text REFERENCES policies(id),
  kind text NOT NULL CHECK (kind IN ('excess', 'floating', 'advance')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  balance numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'allocated', 'refunded', 'reversed')),
  received_date date NOT NULL,
  allocate_by date,
  reference_no text,
  payment_mode text,
  payer_name text,
  remarks text,
  journal_id text,
  refund_journal_id text,
  refund_reason text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS unapplied_collections_open ON unapplied_collections(status, allocate_by);
CREATE INDEX IF NOT EXISTS unapplied_collections_receipt ON unapplied_collections(receipt_id);

CREATE TABLE IF NOT EXISTS unapplied_allocations (
  id bigserial PRIMARY KEY,
  unapplied_id text NOT NULL REFERENCES unapplied_collections(id),
  receivable_id text NOT NULL REFERENCES receivables(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  application_id bigint,
  allocated_by text, allocated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'reversed')));

ALTER TABLE receipt_applications ADD COLUMN IF NOT EXISTS unapplied_id text REFERENCES unapplied_collections(id);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('receipts.excess_handling', '"on-account"', 'receipts', 'Payment above what the policy owes: on-account (held as unapplied collection) or bill (an extra bill on the policy)', 'string'),
 ('collections.unapplied_sla_days', '2', 'collections', 'Working days to allocate an unapplied collection (On Account, floating, advance) after it is received', 'number'),
 ('accounting.account.unapplied_collections', '"2202001"', 'accounting', 'GL: Clients'' deposits and unapplied collections', 'string')
ON CONFLICT (key) DO NOTHING;

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'receipt.unapplied', 1, 'Collection held unapplied',
    'A payment above what the policy owes, or with no bill yet (floating or advance): the cash against the clients'' deposits and unapplied collections.',
    'receipts', 'PAYMENT_RECEIPT', 'receipt', 'Unapplied collection {{kind}} – {{payer}}{{receiptSuffix}}', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'receipt.unapplied') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{memoRef}}'),
  (2, 'Cr', 'role', 'unapplied_collections', NULL::text, 'amount', false, 'Held for {{payer}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'unapplied.allocate', 1, 'Unapplied collection allocated to a bill',
    'An amount held On Account (excess, floating or advance) allocated to an open bill: the unapplied collections against the premium receivable.',
    'receipts', 'PAYMENT_RECEIPT', 'receipt', 'Allocated to {{billNumber}} – {{policyNumber}}', 'policy_owner', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'unapplied.allocate') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'unapplied_collections', NULL::text, 'amount', false, 'From {{reference}}'),
  (2, 'Cr', 'role', 'premium_receivable', NULL::text, 'amount', false, 'Settles {{billNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'unapplied.refund', 1, 'Unapplied collection refunded to the client',
    'An overpayment or unapplied amount to be refunded: the unapplied collections against the refund payable to the client.',
    'receipts', 'PAYMENT_RECEIPT', 'receipt', 'Refund of {{reference}} to {{payer}}', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'unapplied.refund') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'unapplied_collections', NULL::text, 'amount', false, 'From {{reference}}'),
  (2, 'Cr', 'role', 'client_refund_payable', NULL::text, 'amount', false, 'Refund due to {{payer}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
