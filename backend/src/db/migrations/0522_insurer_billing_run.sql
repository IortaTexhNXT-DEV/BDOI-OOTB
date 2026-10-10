-- Insurer billing run (TIS-BRD-COMM-01, COMM-03; FRS FR-RMT-020 to 023).
--
-- On the 15th and the 26th of the month (insurer_billing.run_days; on a Saturday, Sunday or a day of the Holiday master
-- the working day before, insurer_billing.non_working_day) the job "Insurer billing run" drafts the commission billing
-- statements of the remittance lines approved up to the day before and not yet billed: one statement per insurer,
-- product line and settlement basis. Net basis (the commission was kept out of the remittance): the statement is
-- settled by retention when it is approved, nothing more is posted. Gross basis: the unbilled gross-remittance
-- commission of the remitted policies, approved with commission.billing_statement and collected as before. Gross
-- Amount = commission + VAT on commission, EWT = commission x EWT rate, Net Amount Payable = Gross Amount - EWT, due
-- insurer_billing.due_days after the billing date. A statement is approved by a holder of approve:insurer-billing who
-- did not raise or submit it, and only when the insurer has a TIN.
-- Idempotent.

INSERT INTO permissions(code, module, description) VALUES
 ('approve:insurer-billing', 'remittance', 'Approve or reject an insurer billing statement raised or submitted by another user (maker-checker)')
ON CONFLICT (code) DO NOTHING;

-- Accounting (and through it the Accounting Manager) keeps the decision it took with write:remittance; for TISPH, Finance
-- and the General Manager (RBAC v4 Commission & Remittance: Finance CRUDA, GM RA)
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('system-admin', 'accounting', 'accounting-manager', 'tis-finance', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'approve:insurer-billing');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code IN ('system-admin', 'accounting', 'tis-finance', 'tis-general-manager') AND p.code = 'approve:insurer-billing'
ON CONFLICT DO NOTHING;

ALTER TABLE commission_debit_notes DROP CONSTRAINT IF EXISTS commission_debit_notes_basis_chk;
ALTER TABLE commission_debit_notes ADD CONSTRAINT commission_debit_notes_basis_chk CHECK (basis IN ('direct', 'gross', 'net'));
ALTER TABLE commission_debit_notes DROP CONSTRAINT IF EXISTS commission_debit_notes_status_check;
ALTER TABLE commission_debit_notes ADD CONSTRAINT commission_debit_notes_status_check
  CHECK (status IN ('draft', 'for-approval', 'open', 'partial', 'collected', 'settled', 'rejected', 'cancelled'));
ALTER TABLE commission_debit_notes ADD COLUMN IF NOT EXISTS product_line text;
ALTER TABLE commission_debit_notes ADD COLUMN IF NOT EXISTS billing_run_id bigint;
ALTER TABLE commission_debit_notes ADD COLUMN IF NOT EXISTS settled_at timestamptz;
COMMENT ON COLUMN commission_debit_notes.basis IS 'direct: direct-bill commission (debit note); gross: gross-remittance commission (billing statement, collected); net: commission kept out of the remittance (billing statement, settled by retention)';

ALTER TABLE commission_debit_note_lines ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE commission_debit_note_lines ADD COLUMN IF NOT EXISTS remittance_line_id bigint REFERENCES remittance_lines(id);
ALTER TABLE commission_debit_note_lines ADD COLUMN IF NOT EXISTS remittance_number text;
ALTER TABLE commission_debit_note_lines ADD COLUMN IF NOT EXISTS ewt numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE remittance_lines ADD COLUMN IF NOT EXISTS billing_note_id text REFERENCES commission_debit_notes(id);
CREATE INDEX IF NOT EXISTS remittance_lines_billing_note ON remittance_lines(billing_note_id);

CREATE TABLE IF NOT EXISTS insurer_billing_runs (
  id bigserial PRIMARY KEY,
  billing_date date NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('job', 'user')),
  user_id text,
  insurance_company_id int REFERENCES insurance_companies(id),
  statements int NOT NULL DEFAULT 0,
  note_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  result text NOT NULL DEFAULT 'running' CHECK (result IN ('running', 'success', 'nothing', 'failed')),
  message text,
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
CREATE INDEX IF NOT EXISTS insurer_billing_runs_date ON insurer_billing_runs(billing_date DESC);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('insurer_billing.run_days', '[15, 26]', 'remittance', 'Insurer billing run: days of the month the billing statements are drafted', 'json'),
 ('insurer_billing.non_working_day', '"previous"', 'remittance', 'Insurer billing run on a Saturday, Sunday or holiday: run on the previous or the next working day', 'string'),
 ('insurer_billing.due_days', '15', 'remittance', 'Insurer billing statements: days from the billing date to the due date', 'number'),
 ('insurer_billing.particulars', '{"Motor":"Motor Car Insurance Commission","Accident":"Personal Accident Insurance Commission","Life":"Credit Life Insurance Commission","Marine":"Marine Insurance Commission"}', 'remittance', 'Insurer billing statements: particulars line per product line', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('insurer-billing-run', 'Insurer billing run', 'On the billing days (15th and 26th, the working day before when it falls on a non-working day), draft the commission billing statements of the remittances approved and not yet billed',
  '0 7 * * *', 'insurerBillingRun', '{}', true)
ON CONFLICT (code) DO NOTHING;
