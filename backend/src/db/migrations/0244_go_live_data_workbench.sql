-- Go-Live Data Workbench (Master > Go-Live Data Load): one workbook per kit.
--   configuration: company, settings, organisation, users, finance and insurance masters, commission rates, premium
--                  taxes, LGU rates, authority limits and document numbering, everything needed for new business;
--   migration:     the open business of the old system at cutover: clients, in-force policies (legacy numbers kept),
--                  open premium receivables, open claims and the GL opening balances.
--
-- data_load_batches: one uploaded workbook. Every upload is validated as a dry run (all sheets in load order in one
-- transaction that is rolled back); status validated (no error), failed (errors) or loaded. data_load_rows: the rows
-- read from the workbook (values by column key), their result of the latest validation or load and their errors
-- ([{ column, message }]); a load re-runs the importers from these rows, so the file itself is not kept.
--
-- load_batch_id on clients, policies, receivables and claims: the batch that migrated the record (with source
-- 'go-live-migration' on clients and policies, doc.source on policies, source 'opening' on receivables).
--
-- Settings: golive.cutover_date (first day of live transactions; migrated rows must be dated before it) and
-- golive.locked (true after go-live: the migration kit is refused, the configuration kit stays available).

CREATE TABLE IF NOT EXISTS data_load_batches (
  id bigserial PRIMARY KEY,
  kit text NOT NULL CHECK (kit IN ('configuration', 'migration')),
  file_name text,
  status text NOT NULL DEFAULT 'failed' CHECK (status IN ('validated', 'failed', 'loaded')),
  cutover_date date,
  rows_read integer NOT NULL DEFAULT 0,
  rows_valid integer NOT NULL DEFAULT 0,
  rows_error integer NOT NULL DEFAULT 0,
  sheets jsonb NOT NULL DEFAULT '[]',              -- result per sheet of the latest validation or load
  loaded_counts jsonb,                            -- per sheet: created, updated, unchanged
  reconciliation jsonb,                           -- control totals (migration kit)
  valid_rows_only boolean NOT NULL DEFAULT false, -- the load skipped the rows with errors
  message text,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  loaded_by text REFERENCES users(id),
  loaded_at timestamptz
);
CREATE INDEX IF NOT EXISTS data_load_batches_kit_idx ON data_load_batches(kit, created_at DESC);
CREATE INDEX IF NOT EXISTS data_load_batches_created_by_idx ON data_load_batches(created_by);
CREATE INDEX IF NOT EXISTS data_load_batches_loaded_by_idx ON data_load_batches(loaded_by);

CREATE TABLE IF NOT EXISTS data_load_rows (
  id bigserial PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES data_load_batches(id) ON DELETE CASCADE,
  sheet text NOT NULL,
  row_number integer NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'error', 'loaded', 'skipped')),
  action text,                                    -- created | updated | unchanged | proposed
  errors jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS data_load_rows_batch_idx ON data_load_rows(batch_id, sheet, row_number);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clients_load_batch_idx ON clients(load_batch_id) WHERE load_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS policies_load_batch_idx ON policies(load_batch_id) WHERE load_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS receivables_load_batch_idx ON receivables(load_batch_id) WHERE load_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS claims_load_batch_idx ON claims(load_batch_id) WHERE load_batch_id IS NOT NULL;

INSERT INTO permissions(code, module, description) VALUES
 ('read:data-load', 'data-load', 'Download the go-live workbooks (blank or with the current data) and read the load history'),
 ('write:data-load', 'data-load', 'Upload, validate and load the go-live configuration and migration workbooks')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code = 'system-admin' AND p.code IN ('read:data-load', 'write:data-load')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('golive.cutover_date', '""', 'golive', 'Cutover (go-live) date YYYY-MM-DD: first day of live transactions. Migrated records are dated before it; opening balances are the trial balance of the day before', 'string'),
 ('golive.locked', 'false', 'golive', 'Go-live locked: the migration workbook can no longer be loaded (the configuration workbook still can)', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- golive.locked is shared with the transaction reset (0243): one label for both effects.
UPDATE app_settings SET label = 'Go-live lock: when on, the migration workbook can no longer be loaded and the transaction reset (npm run reset:transactions) refuses to run; the configuration workbook stays available. Switch on once the go-live data is loaded'
 WHERE key = 'golive.locked';
