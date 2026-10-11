-- TFS accounts as prospects (TIS-BRD-LEAD-01, LEAD-02, LEAD-05, INTG-03 lead import) and the lead rules of TISPH
-- (LEAD-03, LEAD-07, LEAD-08).
--
--   leads.customer_type            TFS, Non-TFS or Direct Customer (leads.customer_types)
--   leads.loan_id                  the TFS loan the prospect is for: the de-duplication key of TFS accounts (a fleet
--                                  customer has one prospect per loan); unique among prospects not deleted
--   leads.tfs_reference            the TFS reference number of the account
--   leads.insurance_provider_id    the insurer of the expiring policy (Insurance Company master): assignment by insurer
--   leads.policy_expiry_date       expiry of the current policy: a TFS account without one gives no prospect
--   leads.loan_start_date / loan_booking_date / loan_maturity_date, srp (suggested retail price, PHP), product_group
--   leads.vehicle                  make, model, variant, model year, plate, chassis and engine numbers
--   leads.import_batch_id          the upload that created or last updated the prospect
--   leads.disposition              the call disposition of the Lead Disposition list (Interested, Not Interested ...)
--   lead_assignment_rules.max_open the bandwidth of a rule: open prospects one account executive may hold under it
--   lead_import_batches            one uploaded file: LIB-yyyy-nnnnn, kind (tfs, prospects), file, counts, failed rows
--
-- Settings: leads.customer_types, leads.categories, leads.dispositions (the values a prospect may take), leads.duplicate_rule (any: one
-- key is enough, as delivered; four-key: first name, last name, mobile and date of birth together, LEAD-03),
-- leads.tfs_expiry_required, leads.retention_days (prospects not converted are closed as Lost after these days of no
-- change, 0 = never), leads.sla_working_time (the assignment SLA counts the hours of working days only).
-- Numbering series lead_import (LIB). Permission delete:leads (soft delete of a prospect, separate from write:leads).
-- Job lead-retention (daily 02:20, delivered off).
--
-- Idempotent.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS customer_type text,
  ADD COLUMN IF NOT EXISTS loan_id text,
  ADD COLUMN IF NOT EXISTS tfs_reference text,
  ADD COLUMN IF NOT EXISTS insurance_provider_id int REFERENCES insurance_companies(id),
  ADD COLUMN IF NOT EXISTS policy_expiry_date date,
  ADD COLUMN IF NOT EXISTS loan_start_date date,
  ADD COLUMN IF NOT EXISTS loan_booking_date date,
  ADD COLUMN IF NOT EXISTS loan_maturity_date date,
  ADD COLUMN IF NOT EXISTS srp numeric(14,2),
  ADD COLUMN IF NOT EXISTS product_group text,
  ADD COLUMN IF NOT EXISTS vehicle jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS import_batch_id text,
  ADD COLUMN IF NOT EXISTS disposition text;
CREATE UNIQUE INDEX IF NOT EXISTS leads_loan_id_uq ON leads(lower(loan_id)) WHERE loan_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_insurance_provider_idx ON leads(insurance_provider_id);

-- Bandwidth of an assignment rule: the open prospects one account executive may hold under it (null: no limit)
ALTER TABLE lead_assignment_rules ADD COLUMN IF NOT EXISTS max_open int;

CREATE TABLE IF NOT EXISTS lead_import_batches (
  id           text PRIMARY KEY DEFAULT 'lib_' || encode(gen_random_bytes(8), 'hex'),
  batch_number text NOT NULL UNIQUE,
  kind         text NOT NULL CHECK (kind IN ('tfs', 'prospects')),
  file_name    text,
  rows_total   int NOT NULL DEFAULT 0,
  created      int NOT NULL DEFAULT 0,
  updated      int NOT NULL DEFAULT 0,
  failed       int NOT NULL DEFAULT 0,
  errors       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by   text REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('lead_import', 'Lead Import Batch', 'sales', 'LIB', 'Upload of prospects or TFS accounts (Prospects > Bulk Upload)', 'migration:0461')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('leads.customer_types', '["TFS", "Non-TFS", "Direct Customer"]', 'leads', 'Customer types of a prospect', 'json'),
 ('leads.categories', '["Retail", "Corporate"]', 'leads', 'Lead categories of a prospect', 'json'),
 ('leads.dispositions', '["Interested", "Not Interested", "Uncontacted", "Call back", "Renewed"]', 'leads', 'Call dispositions of a prospect', 'json'),
 ('leads.duplicate_rule', '"any"', 'leads', 'Duplicate check of a new prospect: any (e-mail, mobile, or name and date of birth) or four-key (first name, last name, mobile and date of birth together)', 'string'),
 ('leads.tfs_expiry_required', 'true', 'leads', 'A TFS account without a policy expiry date gives no prospect', 'boolean'),
 ('leads.retention_days', '0', 'leads', 'Days a prospect not converted is kept open without a change before it is closed as Lost (0 = never)', 'number'),
 ('leads.sla_working_time', 'false', 'leads', 'The assignment SLA counts the hours of working days only (weekends and holidays of the Holiday master left out)', 'boolean'),
 ('leads.reassign_within_insurer', 'false', 'leads', 'A prospect with an insurance provider is reassigned only to an account executive of a rule for that insurer', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- Deleting a prospect becomes a permission of its own (RBAC v4: CRUDA D); the roles that could delete keep it, except
-- the TIS Sales Associate (CRU).
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('sales', 'operations', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'delete:leads');
INSERT INTO permissions(code, module, description) VALUES
 ('delete:leads', 'leads', 'Delete a prospect (soft delete; never once a policy exists)')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'delete:leads'
WHERE r.code IN ('system-admin', 'sales', 'operations', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-general-manager')
ON CONFLICT DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('lead-retention', 'Prospects not converted', 'Close as Lost the prospects not converted and not changed for leads.retention_days', '20 2 * * *', 'leadRetention', '{}', false)
ON CONFLICT (code) DO NOTHING;
