-- Remittance eligibility and the instalment hold (TIS-BRD-COMM-01, COMM-06; FRS FR-RMT-010 to 012).
--
-- A remittance schedule picks its policies on one of two bases (field Eligibility of the schedule, else the setting
-- remittance.default_eligibility): "Incepted up to the cut-off" (Release 1, unchanged and the default) or "Fully paid in
-- the window" (each policy remitted once, in full, when its premium is fully paid in the run's window, with a catch-up
-- of remittance.catch_up_days for receipts entered late). On the fully paid basis a part-paid policy is held, and a
-- fully paid policy with a receipt that carries no proof of payment is an exception (Proof of payment required).
--
-- remittance_holds keeps every held policy, when it was first and last seen held and when it was released (fully
-- paid) with the receipt that cleared it; the daily job "Instalment hold check" and every run keep it up to date.
-- A receipt carries its own proof of payment (proof_key / proof_file_name), attached on Accounts > Receipts.
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.default_eligibility', '"inception"', 'remittance', 'Remittance runs: policies a schedule without its own eligibility remits (inception: incepted up to the cut-off; fully-paid: fully paid in the payment window)', 'string'),
 ('remittance.proof_of_payment_required', 'true', 'remittance', 'Remittance runs on the fully paid basis: a policy is remitted only when every receipt carries a proof of payment', 'boolean'),
 ('remittance.catch_up_days', '60', 'remittance', 'Remittance runs on the fully paid basis: days before the window a policy fully paid but not yet remitted is still picked', 'number'),
 ('remittance.instalment_hold', 'true', 'remittance', 'Remittance runs on the fully paid basis: hold part-paid and instalment policies until they are fully paid', 'boolean')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS proof_key text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS proof_file_name text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS proof_attached_by text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS proof_attached_at timestamptz;

CREATE TABLE IF NOT EXISTS remittance_holds (
  policy_id text PRIMARY KEY REFERENCES policies(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released')),
  held_since date NOT NULL,
  last_checked date NOT NULL,
  premium numeric(14,2) NOT NULL DEFAULT 0,
  paid_to_date numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  next_due date,
  released_on date,
  release_receipt text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS remittance_holds_status ON remittance_holds(status, insurance_company_id);

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('remittance-hold-check', 'Instalment hold check', 'Record the part-paid policies held from remittance and release those now fully paid, for the next weekly run',
  '5 6 * * *', 'remittanceHoldCheck', '{}', true)
ON CONFLICT (code) DO NOTHING;
