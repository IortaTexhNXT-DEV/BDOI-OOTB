-- Premium payments captured on the policy payment screen (Operations > Policy > Payment).
-- A capture is a claim that the client paid (mode, reference, amount, date, proof); it does not touch the ledger.
-- Finance (write:receipts) confirms it, which raises the official receipt against the bill (Dr Cash / Cr Premium Receivable),
-- or rejects it. A capture by a user who already holds write:receipts is confirmed immediately.
CREATE TABLE IF NOT EXISTS policy_payments (
  id text PRIMARY KEY DEFAULT ('pp_' || encode(gen_random_bytes(8), 'hex')),
  policy_id text NOT NULL REFERENCES policies(id),
  receivable_id text REFERENCES receivables(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_mode text NOT NULL,
  reference_no text,
  paid_on date NOT NULL,
  proof_key text, proof_file_name text,
  remarks text,
  status text NOT NULL DEFAULT 'submitted',          -- submitted | confirmed | rejected
  receipt_id text REFERENCES receipts(id),
  submitted_by text REFERENCES users(id),
  confirmed_by text REFERENCES users(id), confirmed_at timestamptz,
  rejected_by text REFERENCES users(id), rejected_at timestamptz, reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS policy_payments_policy_idx ON policy_payments(policy_id);
CREATE INDEX IF NOT EXISTS policy_payments_status_idx ON policy_payments(status);
