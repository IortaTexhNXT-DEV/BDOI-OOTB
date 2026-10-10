-- Bank and insurer-direct payment uploads, payment channel, payment reference (TIS-BRD-COLL-01, COLL-03, COLL-07,
-- COLL-09; FGA-PC-01, PC-02, PC-07, FGA-BR-02 to BR-07; RPT-OPS-12, OPS-13).
--
-- policies.payment_reference: the 10-digit reference a client quotes at the bank (9 digits of a sequence and a Luhn
-- check digit), given to every policy; the receipts search and the uploads find a policy by it.
-- receipts.payment_channel: tis-direct (paid to TISPH) or insurer-direct (paid to the insurance company; the receipt is
-- posted Dr premium payable to the insurer / Cr premium receivable, receipt.insurer_direct).
-- receipt_batches.kind: receipts (bulk receipts), bank-payments (a bank's report of payments, matched to the bills by
-- reference within bank_matching.tolerance: overpaid -> the excess held On Account, underpaid -> listed as insufficient,
-- no bill found -> a floating payment), insurer-direct (payments made to the insurance company).
-- Idempotent.

CREATE SEQUENCE IF NOT EXISTS policy_payment_reference_seq START 100000001;

CREATE OR REPLACE FUNCTION luhn_check_digit(digits text) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s int := 0; d int; i int; n int := length(digits);
BEGIN
  FOR i IN 0 .. n - 1 LOOP
    d := substr(digits, n - i, 1)::int;
    IF i % 2 = 0 THEN d := d * 2; IF d > 9 THEN d := d - 9; END IF; END IF;
    s := s + d;
  END LOOP;
  RETURN (10 - s % 10) % 10;
END $$;

CREATE OR REPLACE FUNCTION next_payment_reference() RETURNS text LANGUAGE plpgsql AS $$
DECLARE base text := lpad(nextval('policy_payment_reference_seq')::text, 9, '0');
BEGIN
  RETURN base || luhn_check_digit(base)::text;
END $$;

ALTER TABLE policies ADD COLUMN IF NOT EXISTS payment_reference text;
UPDATE policies SET payment_reference = next_payment_reference() WHERE payment_reference IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS policies_payment_reference ON policies(payment_reference);

CREATE OR REPLACE FUNCTION policies_payment_reference_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_reference IS NULL THEN NEW.payment_reference := next_payment_reference(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS policies_payment_reference_trg ON policies;
CREATE TRIGGER policies_payment_reference_trg BEFORE INSERT ON policies FOR EACH ROW EXECUTE FUNCTION policies_payment_reference_default();

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'tis-direct';
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_payment_channel_chk;
ALTER TABLE receipts ADD CONSTRAINT receipts_payment_channel_chk CHECK (payment_channel IN ('tis-direct', 'insurer-direct'));
UPDATE receipts SET payment_channel = 'insurer-direct' WHERE collected_by_insurer_id IS NOT NULL AND payment_channel <> 'insurer-direct';

ALTER TABLE receipt_batches ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'receipts';
ALTER TABLE receipt_batches DROP CONSTRAINT IF EXISTS receipt_batches_kind_chk;
ALTER TABLE receipt_batches ADD CONSTRAINT receipt_batches_kind_chk CHECK (kind IN ('receipts', 'bank-payments', 'insurer-direct'));

CREATE TABLE IF NOT EXISTS bank_payment_lines (
  id bigserial PRIMARY KEY,
  batch_id text NOT NULL REFERENCES receipt_batches(id),
  row_no int NOT NULL,
  paid_on date,
  reference text,
  amount numeric(14,2),
  bank_account text,
  payer text,
  outcome text NOT NULL CHECK (outcome IN ('matched', 'overpaid', 'underpaid', 'unmatched', 'failed')),
  receivable_id text REFERENCES receivables(id),
  policy_id text REFERENCES policies(id),
  receipt_id text REFERENCES receipts(id),
  unapplied_id text REFERENCES unapplied_collections(id),
  expected numeric(14,2),
  difference numeric(14,2),
  message text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS bank_payment_lines_batch ON bank_payment_lines(batch_id);
CREATE INDEX IF NOT EXISTS bank_payment_lines_outcome ON bank_payment_lines(outcome, paid_on);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('bank_matching.tolerance', '1', 'receipts', 'Bank payment matching: a payment within this amount (PHP) of what the bill owes is matched in full', 'number'),
 ('reports.invoice_tracker_buckets', '[15, 30, 60]', 'reports', 'Invoice tracker: days overdue that close each ageing bucket (1-15, 16-30, 31-60, 61+)', 'json')
ON CONFLICT (key) DO NOTHING;

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'receipt.insurer_direct', 1, 'Premium paid directly to the insurance company',
    'A client paid the premium to the insurance company: the premium payable to the insurer against the premium receivable.',
    'receipts', 'PAYMENT_RECEIPT', 'receipt', 'Premium paid to {{insurer}} – {{policyNumber}}{{receiptSuffix}}', 'policy_owner', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'receipt.insurer_direct') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'due_to_insurer', NULL::text, 'amount', false, 'Paid to {{insurer}} – {{memoRef}}'),
  (2, 'Cr', 'role', 'premium_receivable', NULL::text, 'amount', false, 'Settles {{billNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
