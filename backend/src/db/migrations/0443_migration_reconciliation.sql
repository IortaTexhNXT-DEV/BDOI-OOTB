-- Data Migration & Go-Live: the reconciliation of the migration loads, the opening balance journal and the one-time
-- SAP opening file.
--
-- Reconciliation. One reconciliation covers loaded migration batches of a run (all of them by default, all_batches):
-- lines (kind measure: counts and totals per object and group, BrokerVerse value against the legacy value of the
-- Control Totals sheet, the screen or an upload; kind check: trial balance; kind tieout: GL opening balance against the
-- sub-ledger or the legacy listing, with the accounts used), the difference list (a line out of tolerance, a failed
-- check, a workbook row not loaded, a migrated record outside the batches) and the sign-off slots of
-- migration.recon_signoffs. Signed when every slot is signed; superseded when a load or an undo of the run follows.
-- The PDF built when the last slot signs is kept masked in the storage folder go-live-evidence with its SHA-256.
-- Kept by the transaction reset (evidence of the mock runs and of the cutover). run_id: foreign key added with the runs.
--
-- Opening balance journal. Each opening balances set loaded for go-live is documented by one journal header (source
-- go-live-opening, status opening, origin migrated, series opening_journal) without journal lines: its lines are read
-- from opening_balances, so nothing that sums journal lines counts it and the SAP GL daily file never selects it.
-- journal_vouchers.sap_exported_at: when the one-time SAP opening file was generated from it (refused afterwards).
-- sap_opening_file_requests: the request of that file and its approval by a second user; the files are an SAP GL run of
-- trigger opening.
--
-- Settings: migration.recon_amount_tolerance, migration.recon_signoffs, migration.subledger_tieouts (accounts filled from
-- the accounting.account.* settings where they exist; seeds/91_migration_tieouts.sql fills them on a new database).
-- Idempotent.

CREATE TABLE IF NOT EXISTS migration_reconciliations (
  id bigserial PRIMARY KEY,
  run_id bigint,
  batch_ids bigint[] NOT NULL DEFAULT '{}',
  all_batches boolean NOT NULL DEFAULT true,
  cutover_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'signed', 'superseded')),
  computed_at timestamptz,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  superseded_at timestamptz,
  superseded_by bigint REFERENCES migration_reconciliations(id),
  report_file_key text,
  report_sha256 text
);
ALTER TABLE migration_reconciliations ADD COLUMN IF NOT EXISTS recon_number text GENERATED ALWAYS AS ('REC-' || lpad(id::text, 6, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS migration_reconciliations_number_uq ON migration_reconciliations(recon_number);
CREATE INDEX IF NOT EXISTS migration_reconciliations_run_idx ON migration_reconciliations(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS migration_reconciliations_batches_idx ON migration_reconciliations USING gin(batch_ids);
CREATE INDEX IF NOT EXISTS migration_reconciliations_created_by_idx ON migration_reconciliations(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_reconciliations_superseded_by_idx ON migration_reconciliations(superseded_by) WHERE superseded_by IS NOT NULL;
COMMENT ON TABLE migration_reconciliations IS 'Reconciliation of migration loads against the legacy figures: lines, differences, sign-off; signed reports kept as evidence';
COMMENT ON COLUMN migration_reconciliations.all_batches IS 'True: every loaded migration batch of the run (refreshed on recompute); false: the batches chosen';
COMMENT ON COLUMN migration_reconciliations.report_file_key IS 'PDF frozen when the last slot signed, masked for everyone (storage folder go-live-evidence)';

CREATE TABLE IF NOT EXISTS migration_recon_lines (
  id bigserial PRIMARY KEY,
  recon_id bigint NOT NULL REFERENCES migration_reconciliations(id) ON DELETE CASCADE,
  object text NOT NULL,
  measure text NOT NULL,
  grp text NOT NULL DEFAULT '',
  legacy_value numeric(18,2),
  legacy_source text CHECK (legacy_source IN ('workbook', 'screen', 'upload')),
  system_value numeric(18,2) NOT NULL DEFAULT 0,
  tolerance numeric(18,2) NOT NULL DEFAULT 0,
  tolerance_reason text,
  kind text NOT NULL DEFAULT 'measure' CHECK (kind IN ('measure', 'check', 'tieout')),
  accounts text[] NOT NULL DEFAULT '{}',
  sort int NOT NULL DEFAULT 0,
  updated_by text REFERENCES users(id),
  updated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS migration_recon_lines_uq ON migration_recon_lines(recon_id, object, measure, grp);
CREATE INDEX IF NOT EXISTS migration_recon_lines_updated_by_idx ON migration_recon_lines(updated_by) WHERE updated_by IS NOT NULL;
COMMENT ON COLUMN migration_recon_lines.legacy_value IS 'Measure: the legacy figure. Check and tie-out: the other side (legacy listing, or the BrokerVerse sub-ledger when legacy_source is empty)';

CREATE TABLE IF NOT EXISTS migration_recon_differences (
  id bigserial PRIMARY KEY,
  recon_id bigint NOT NULL REFERENCES migration_reconciliations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('measure', 'check', 'not-loaded', 'extra')),
  line_id bigint REFERENCES migration_recon_lines(id) ON DELETE CASCADE,
  batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL,
  sheet text,
  row_number int,
  record_key text,
  description text NOT NULL,
  amount numeric(18,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'explained', 'accepted', 'fixed')),
  explanation text,
  action text,
  owner text,
  accepted_by text REFERENCES users(id),
  accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS migration_recon_differences_recon_idx ON migration_recon_differences(recon_id, kind);
CREATE INDEX IF NOT EXISTS migration_recon_differences_line_idx ON migration_recon_differences(line_id) WHERE line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_recon_differences_batch_idx ON migration_recon_differences(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_recon_differences_accepted_by_idx ON migration_recon_differences(accepted_by) WHERE accepted_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS migration_recon_signoffs (
  id bigserial PRIMARY KEY,
  recon_id bigint NOT NULL REFERENCES migration_reconciliations(id) ON DELETE CASCADE,
  slot text NOT NULL,
  label text NOT NULL,
  signed_by text REFERENCES users(id),
  signed_at timestamptz,
  remarks text,
  UNIQUE (recon_id, slot)
);
CREATE INDEX IF NOT EXISTS migration_recon_signoffs_signed_by_idx ON migration_recon_signoffs(signed_by) WHERE signed_by IS NOT NULL;

-- ------------------------------------------------------------------ opening balance journal and the SAP opening file

ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS sap_exported_at timestamptz;
COMMENT ON COLUMN journal_vouchers.sap_exported_at IS 'Opening balance journal: when the one-time SAP opening file was generated from it';
CREATE INDEX IF NOT EXISTS journal_vouchers_opening_idx ON journal_vouchers(jv_date) WHERE source = 'go-live-opening';

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('opening_journal', 'Opening Balance Journal', 'data-load', 'OBJ', '{PREFIX}-{YYYY}-{SEQ}', 4, 'yearly',
  'Journal that documents the go-live opening balances (Data Migration & Go-Live); it has no journal lines and is never posted', 'migration')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS sap_opening_file_requests (
  id bigserial PRIMARY KEY,
  journal_id text NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reason text NOT NULL,
  requested_by text NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  decision_remarks text,
  export_id bigint REFERENCES sap_gl_exports(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sap_opening_file_requests_one_pending ON sap_opening_file_requests((true)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS sap_opening_file_requests_journal_idx ON sap_opening_file_requests(journal_id);
CREATE INDEX IF NOT EXISTS sap_opening_file_requests_requested_by_idx ON sap_opening_file_requests(requested_by);
CREATE INDEX IF NOT EXISTS sap_opening_file_requests_decided_by_idx ON sap_opening_file_requests(decided_by) WHERE decided_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS sap_opening_file_requests_export_idx ON sap_opening_file_requests(export_id) WHERE export_id IS NOT NULL;
COMMENT ON TABLE sap_opening_file_requests IS 'One-time SAP opening file of the opening balance journal: requested by one user, generated on the approval of another';

-- the opening file is an SAP GL run of its own trigger, never part of a daily run
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sap_gl_exports_trigger_check' AND pg_get_constraintdef(oid) NOT LIKE '%opening%') THEN
    ALTER TABLE sap_gl_exports DROP CONSTRAINT sap_gl_exports_trigger_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sap_gl_exports_trigger_check') THEN
    ALTER TABLE sap_gl_exports ADD CONSTRAINT sap_gl_exports_trigger_check CHECK (trigger IN ('schedule', 'manual', 'opening'));
  END IF;
END $$;

-- ------------------------------------------------------------------ settings

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('migration.recon_amount_tolerance', '0', 'golive', 'Reconciliation of migration loads: difference accepted on an amount without a tolerance of its own (PHP); counts are always exact', 'number'),
 ('migration.recon_signoffs', '[{"slot":"data-owner","label":"Data owner"},{"slot":"finance-head","label":"Finance Head"}]', 'golive',
  'Reconciliation of migration loads: the sign-offs needed (slot and label), each by a user who neither uploaded nor approved its loads', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type)
SELECT 'migration.subledger_tieouts', jsonb_build_array(
    jsonb_build_object('key', 'premiums-receivable', 'label', 'Premiums receivable', 'source', 'open-items', 'accounts', a.premium, 'tolerance', 0),
    jsonb_build_object('key', 'post-dated-cheques', 'label', 'Post-dated cheques on hand', 'source', 'pdc', 'accounts', '[]'::jsonb, 'tolerance', 0),
    jsonb_build_object('key', 'due-to-insurers', 'label', 'Due to insurers', 'source', 'listing', 'measure', 'due to insurers', 'accounts', a.due, 'tolerance', 0),
    jsonb_build_object('key', 'commission-receivable', 'label', 'Commission receivable (direct bill)', 'source', 'listing', 'measure', 'commission receivable', 'accounts', a.commission, 'tolerance', 0),
    jsonb_build_object('key', 'unapplied-collections', 'label', 'Unapplied collections and client deposits', 'source', 'listing', 'measure', 'unapplied collections', 'accounts', '[]'::jsonb, 'tolerance', 0),
    jsonb_build_object('key', 'cash-in-bank', 'label', 'Cash in bank', 'source', 'bank', 'accounts', '[]'::jsonb, 'tolerance', 0),
    jsonb_build_object('key', 'sap-trial-balance', 'label', 'BrokerVerse and SAP trial balance', 'source', 'sap', 'accounts', '[]'::jsonb, 'tolerance', 0)),
  'golive', 'Sub-ledger tie-outs of the reconciliation of migration loads (maintained on Data Migration & Go-Live > Reconciliation)', 'json'
FROM (SELECT
    COALESCE((SELECT jsonb_build_array(value #>> '{}') FROM app_settings WHERE key = 'accounting.account.premium_receivable'), '[]'::jsonb) AS premium,
    COALESCE((SELECT jsonb_build_array(value #>> '{}') FROM app_settings WHERE key = 'accounting.account.due_to_insurer'), '[]'::jsonb) AS due,
    COALESCE((SELECT jsonb_build_array(value #>> '{}') FROM app_settings WHERE key = 'accounting.account.commission_receivable'), '[]'::jsonb) AS commission) a
ON CONFLICT (key) DO NOTHING;
