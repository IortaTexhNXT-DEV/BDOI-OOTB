-- Import policy list (Accounts > Remittance > Remittances > Import policy list). A file selects policies; BrokerVerse
-- computes every amount, and the amounts in the file are only compared with them. Validating a file keeps the file,
-- its hash and one result per row under an import record IMP-yyyy-nnnn (status validated); committing it creates
-- off-cycle draft remittances from the ready rows, at the system amounts. A file whose hash was already committed is
-- not committed again.
--
--   remittance_imports              one uploaded file: purpose (a remittance_off_cycle reason), file, hash, counts,
--                                   status validated -> committed, or discarded (by the user, or 7 days after
--                                   validation), the drafts it created, a version for the commit
--   remittance_import_rows          one row of the file: the policy it names, the values read, the result
--                                   (ready, ready-variance, already-on-rem, not-found, not-issued, insurer-differs,
--                                   product-line-differs, direct-bill, duplicate, skipped), the message, the system
--                                   amount due to the insurer and the variance against the expected amount of the file
--   remittance_lines.expected_due   the amount the file expected for the line (compared only, never used)
--   remittance_lines.variance       system amount minus expected amount
--   remittance_lines.insurer_reference, remark   stored from the file
--
-- Numbering series remittance_import (IMP-yyyy-nnnn).
-- Settings: remittance.import_max_rows (5000 data rows per file), remittance.bulk_upload_enabled (on: the Bulk
-- Processing upload of earlier releases stays open; TISPH turns it off, seed 90_tisph_remittance.sql).
-- The seeded bulk-processing configuration BFM-002 (a template whose columns the upload never read) is deactivated
-- while nobody has changed it.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS remittance_imports (
  id                     text PRIMARY KEY DEFAULT 'imp_' || encode(gen_random_bytes(8), 'hex'),
  import_no              text NOT NULL UNIQUE,
  purpose_code           text NOT NULL,
  purpose_name           text,
  purpose_note           text,
  purpose_text           text,
  file_key               text,
  file_name              text NOT NULL,
  file_size              bigint NOT NULL DEFAULT 0,
  file_hash              text NOT NULL,
  header                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                 text NOT NULL DEFAULT 'validated' CHECK (status IN ('validated', 'committed', 'discarded')),
  counts                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_remittance_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  version                int NOT NULL DEFAULT 1,
  uploaded_by            text REFERENCES users(id),
  uploaded_at            timestamptz NOT NULL DEFAULT now(),
  committed_by           text REFERENCES users(id),
  committed_at           timestamptz,
  discarded_by           text REFERENCES users(id),
  discarded_at           timestamptz
);
CREATE INDEX IF NOT EXISTS remittance_imports_hash_idx ON remittance_imports(file_hash, status);
CREATE INDEX IF NOT EXISTS remittance_imports_uploaded_idx ON remittance_imports(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS remittance_import_rows (
  id                bigserial PRIMARY KEY,
  import_id         text NOT NULL REFERENCES remittance_imports(id) ON DELETE CASCADE,
  row_no            int NOT NULL,
  policy_no         text,
  policy_id         text REFERENCES policies(id),
  insurer_code      text,
  insurance_company_id int REFERENCES insurance_companies(id),
  product_line      text,
  expected_due      numeric(14,2),
  insurer_reference text,
  remark            text,
  result            text NOT NULL,
  message           text,
  system_due        numeric(14,2),
  variance          numeric(14,2),
  cells             jsonb NOT NULL DEFAULT '[]'::jsonb,
  remittance_id     text REFERENCES remittances(id) ON DELETE SET NULL,
  UNIQUE (import_id, row_no)
);
CREATE INDEX IF NOT EXISTS remittance_import_rows_result_idx ON remittance_import_rows(import_id, result);

ALTER TABLE remittance_lines
  ADD COLUMN IF NOT EXISTS expected_due numeric(14,2),
  ADD COLUMN IF NOT EXISTS variance numeric(14,2),
  ADD COLUMN IF NOT EXISTS insurer_reference text,
  ADD COLUMN IF NOT EXISTS remark text;

INSERT INTO document_numbering(code, name, module, prefix, seq_width, description, created_by) VALUES
 ('remittance_import', 'Remittance Import', 'remittance', 'IMP', 4, 'Imported policy list (Import policy list)', 'migration:0402')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.import_max_rows', '5000', 'remittance', 'Most data rows in one imported policy list', 'number'),
 ('remittance.bulk_upload_enabled', 'true', 'remittance', 'The bulk upload of remittance files of earlier releases is open (off: Import policy list only)', 'boolean')
ON CONFLICT (key) DO NOTHING;

UPDATE master_records SET status = 'inactive', updated_at = now()
 WHERE type_code = 'remittance-bulk-processing' AND code = 'BFM-002' AND status = 'active' AND created_by = 'seed' AND updated_by IS NULL;
