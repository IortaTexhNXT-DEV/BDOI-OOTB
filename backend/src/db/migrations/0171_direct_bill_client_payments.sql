-- Direct bill: the client's payment to the insurer. The premium of a direct-bill policy is paid to the insurer, so the
-- broker's books never see it; finance records it here (date, amount, the insurer's official receipt or reference and a
-- proof) to follow up unpaid policies and, when direct_bill.client_payment_required says so, before a commission debit
-- note is approved. No journal is posted.
CREATE TABLE IF NOT EXISTS direct_bill_client_payments (
  id bigserial PRIMARY KEY,
  policy_id text NOT NULL REFERENCES policies(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  payment_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  insurer_reference text NOT NULL,                     -- insurer's official receipt / acknowledgement number
  payment_mode text,
  proof_key text,                                      -- uploaded proof (OR copy, deposit slip, screenshot)
  proof_file_name text,
  remarks text,
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'voided')),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  voided_by text, voided_at timestamptz, void_reason text);
CREATE INDEX IF NOT EXISTS direct_bill_client_payments_policy ON direct_bill_client_payments(policy_id);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('direct_bill.client_payment_required', '"none"', 'direct_bill', 'Before a commission debit note is approved, the client''s payment to the insurer must be recorded on each of its policies: none (not checked), any (a payment recorded) or full (paid in full)', 'string')
ON CONFLICT (key) DO NOTHING;
