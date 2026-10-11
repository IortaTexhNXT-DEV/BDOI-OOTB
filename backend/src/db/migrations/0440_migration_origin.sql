-- Data Migration & Go-Live: origin of every record, load numbers and approval of loads.
--
-- Origin. clients, policies, receivables, claims, journal_vouchers and post_dated_cheques carry where the record comes
-- from: origin 'issued' (entered or issued in BrokerVerse) or 'migrated' (loaded from the legacy system at go-live), with
-- the legacy system, the legacy number, when and by whom it was migrated. load_batch_id (the load that created it) is
-- added where it is missing: journal_vouchers, post_dated_cheques, opening_balances and ctpl_authentications. Records
-- migrated before this migration are back-filled from the flags kept until now (clients.source, policies doc.source or
-- load_batch_id, claims details.source, receivables source 'opening'); the flags stay for the readers that use them.
--
-- Loads. data_load_batches gets a load number (MIG-000012, CFG-000045), the legacy system of the load, the approval
-- and undo columns, timings and counts per result; the columns shared with the master data upload (file_key, job_id,
-- expires_at, channel, submitted_* and decided_*) are added with IF NOT EXISTS and the same types, so either migration
-- may run first. data_load_rows gets the record it created or changed, its values before the load, the changed column
-- keys, duplicates and their resolution. The status checks hold the values of both.
--
-- Access. approve:data-load (approve or reject a load and its undo, sign a reconciliation, Go / No-Go, go-live lock);
-- the read-only role tis-auditor; the default grants of the TISPH roles; the segregation of duties rule between
-- loading (write:data-load) and approving (approve:data-load). Settings of the workspace (group golive). The go-live
-- workbench leaves the paths answered without masking: its downloads are masked for users without view:pii.
-- Idempotent.

-- ------------------------------------------------------------------ origin of the business records

ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
ALTER TABLE post_dated_cheques ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
ALTER TABLE ctpl_authentications ADD COLUMN IF NOT EXISTS load_batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS journal_vouchers_load_batch_idx ON journal_vouchers(load_batch_id) WHERE load_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS post_dated_cheques_load_batch_idx ON post_dated_cheques(load_batch_id) WHERE load_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS opening_balances_load_batch_idx ON opening_balances(load_batch_id) WHERE load_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ctpl_authentications_load_batch_idx ON ctpl_authentications(load_batch_id) WHERE load_batch_id IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'policies', 'receivables', 'claims', 'journal_vouchers', 'post_dated_cheques'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT ''issued''', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS legacy_system text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS legacy_number text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS migrated_at timestamptz', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS migrated_by text REFERENCES users(id)', t);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_origin_check');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (origin IN (''issued'', ''migrated''))', t, t || '_origin_check');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(origin) WHERE origin = ''migrated''', t || '_migrated_idx', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(legacy_number) WHERE legacy_number IS NOT NULL', t || '_legacy_number_idx', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(migrated_by) WHERE migrated_by IS NOT NULL', t || '_migrated_by_idx', t);
    EXECUTE format('COMMENT ON COLUMN %I.origin IS %L', t, 'issued: entered or issued in BrokerVerse; migrated: loaded from the legacy system at go-live (Data Migration & Go-Live)');
    EXECUTE format('COMMENT ON COLUMN %I.legacy_number IS %L', t, 'Number of the record in the legacy system (migrated records)');
  END LOOP;
END $$;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('migration.legacy_system_name', '"Legacy"', 'golive', 'Name of the legacy system shown on migrated records (default of each migration load)', 'string')
ON CONFLICT (key) DO NOTHING;

-- Back-fill of the records migrated before origin existed (only rows still marked issued: a second run changes nothing).
-- Who migrated: the user who uploaded the load, else the user who created the record.
UPDATE clients c SET origin = 'migrated', legacy_number = COALESCE(c.legacy_number, c.client_code), migrated_at = COALESCE(c.migrated_at, c.created_at),
       legacy_system = COALESCE(c.legacy_system, (SELECT value #>> '{}' FROM app_settings WHERE key = 'migration.legacy_system_name'), 'Legacy'),
       migrated_by = COALESCE(c.migrated_by, (SELECT b.created_by FROM data_load_batches b WHERE b.id = c.load_batch_id),
         (SELECT u.id FROM users u WHERE u.id = c.created_by OR u.username = c.created_by ORDER BY (u.id = c.created_by) DESC LIMIT 1))
 WHERE c.origin = 'issued' AND (c.source = 'go-live-migration' OR c.load_batch_id IS NOT NULL);

UPDATE policies p SET origin = 'migrated', legacy_number = COALESCE(p.legacy_number, p.policy_number), migrated_at = COALESCE(p.migrated_at, p.created_at),
       legacy_system = COALESCE(p.legacy_system, (SELECT value #>> '{}' FROM app_settings WHERE key = 'migration.legacy_system_name'), 'Legacy'),
       migrated_by = COALESCE(p.migrated_by, (SELECT b.created_by FROM data_load_batches b WHERE b.id = p.load_batch_id),
         (SELECT u.id FROM users u WHERE u.id = p.created_by OR u.username = p.created_by ORDER BY (u.id = p.created_by) DESC LIMIT 1))
 WHERE p.origin = 'issued' AND (p.doc->>'source' = 'go-live-migration' OR p.load_batch_id IS NOT NULL);

UPDATE claims c SET origin = 'migrated', legacy_number = COALESCE(c.legacy_number, c.claim_number), migrated_at = COALESCE(c.migrated_at, c.created_at),
       legacy_system = COALESCE(c.legacy_system, (SELECT value #>> '{}' FROM app_settings WHERE key = 'migration.legacy_system_name'), 'Legacy'),
       migrated_by = COALESCE(c.migrated_by, (SELECT b.created_by FROM data_load_batches b WHERE b.id = c.load_batch_id),
         (SELECT u.id FROM users u WHERE u.id = c.created_by OR u.username = c.created_by ORDER BY (u.id = c.created_by) DESC LIMIT 1))
 WHERE c.origin = 'issued' AND (c.details->>'source' = 'go-live-migration' OR c.load_batch_id IS NOT NULL);

UPDATE receivables r SET origin = 'migrated', legacy_number = COALESCE(r.legacy_number, r.reference, r.bill_number), migrated_at = COALESCE(r.migrated_at, r.created_at),
       legacy_system = COALESCE(r.legacy_system, (SELECT value #>> '{}' FROM app_settings WHERE key = 'migration.legacy_system_name'), 'Legacy'),
       migrated_by = COALESCE(r.migrated_by, (SELECT b.created_by FROM data_load_batches b WHERE b.id = r.load_batch_id),
         (SELECT u.id FROM users u WHERE u.id = r.created_by OR u.username = r.created_by ORDER BY (u.id = r.created_by) DESC LIMIT 1))
 WHERE r.origin = 'issued' AND (r.source = 'opening' OR r.load_batch_id IS NOT NULL);

UPDATE opening_balances o SET load_batch_id = b.id
  FROM (SELECT DISTINCT ON (cutover_date) id, cutover_date FROM data_load_batches WHERE kit = 'migration' AND status = 'loaded' AND cutover_date IS NOT NULL
         AND EXISTS (SELECT 1 FROM data_load_rows r WHERE r.batch_id = data_load_batches.id AND r.sheet = 'opening-balances' AND r.status = 'loaded')
        ORDER BY cutover_date, loaded_at DESC) b
 WHERE o.load_batch_id IS NULL AND o.source_run = 'go-live:' || b.cutover_date::text;

-- ------------------------------------------------------------------ load batches and rows

ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS load_number text
  GENERATED ALWAYS AS ((CASE kit WHEN 'migration' THEN 'MIG-' WHEN 'configuration' THEN 'CFG-' ELSE 'UPL-' END) || lpad(id::text, 6, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS data_load_batches_load_number_uq ON data_load_batches(load_number);

-- columns shared with the master data upload (same names and types)
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS file_key text;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS job_id bigint;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS submitted_by text REFERENCES users(id);
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS decided_by text REFERENCES users(id);
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS decision text;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS decision_reason_code text;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS decision_remarks text;
-- columns of the migration workspace
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS legacy_system text;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS run_id bigint;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS undo_requested_by text REFERENCES users(id);
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS undo_requested_at timestamptz;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS undo_reason text;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS undone_by text REFERENCES users(id);
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS undone_at timestamptz;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS validate_ms integer;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS load_ms integer;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS undo_ms integer;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS rows_new integer NOT NULL DEFAULT 0;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS rows_changed integer NOT NULL DEFAULT 0;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS rows_unchanged integer NOT NULL DEFAULT 0;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS rows_duplicate integer NOT NULL DEFAULT 0;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS file_sha256 text;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS maps_version timestamptz;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS opening_before jsonb;
ALTER TABLE data_load_batches ADD COLUMN IF NOT EXISTS progress jsonb;
COMMENT ON COLUMN data_load_batches.load_number IS 'Load number shown everywhere: MIG- (migration kit), CFG- (configuration kit), UPL- (master data upload) and the batch id';
COMMENT ON COLUMN data_load_batches.legacy_system IS 'Legacy system the migrated records of this load come from (shown on each record)';
COMMENT ON COLUMN data_load_batches.opening_before IS 'Opening balances set held before this load replaced it (restored by an undo)';
COMMENT ON COLUMN data_load_batches.run_id IS 'Mock or production run the load belongs to';
CREATE INDEX IF NOT EXISTS data_load_batches_submitted_by_idx ON data_load_batches(submitted_by) WHERE submitted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS data_load_batches_decided_by_idx ON data_load_batches(decided_by) WHERE decided_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS data_load_batches_undo_requested_by_idx ON data_load_batches(undo_requested_by) WHERE undo_requested_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS data_load_batches_undone_by_idx ON data_load_batches(undone_by) WHERE undone_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS data_load_batches_run_idx ON data_load_batches(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS data_load_batches_file_sha256_idx ON data_load_batches(file_sha256) WHERE file_sha256 IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE data_load_batches DROP CONSTRAINT IF EXISTS data_load_batches_status_check;
  ALTER TABLE data_load_batches ADD CONSTRAINT data_load_batches_status_check CHECK (status IN ('validated', 'failed', 'loaded', 'pending-approval', 'rejected',
    'withdrawn', 'expired', 'running', 'validating', 'undo-pending', 'undoing', 'undone'));
END $$;

ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS record_table text;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS record_id text;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS record_key text;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS before jsonb;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS changes jsonb;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS warnings jsonb;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS fingerprint text;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS duplicates jsonb;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS resolution_reason text;
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS resolved_by text REFERENCES users(id);
ALTER TABLE data_load_rows ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
COMMENT ON COLUMN data_load_rows.changes IS 'Keys of the columns the row changes on the stored record (old values in before, new in data)';
CREATE INDEX IF NOT EXISTS data_load_rows_resolved_by_idx ON data_load_rows(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS data_load_rows_record_idx ON data_load_rows(record_table, record_id) WHERE record_id IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE data_load_rows DROP CONSTRAINT IF EXISTS data_load_rows_status_check;
  ALTER TABLE data_load_rows ADD CONSTRAINT data_load_rows_status_check CHECK (status IN ('valid', 'error', 'loaded', 'skipped', 'duplicate', 'undone'));
END $$;

-- ------------------------------------------------------------------ access

-- Users of the roles that gain a permission get a new token version (the permissions travel in the access token);
-- only on the first run, before approve:data-load exists.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('system-admin', 'tis-it-admin', 'tis-finance', 'tis-ops-unit-head', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'approve:data-load');

INSERT INTO permissions(code, module, description) VALUES
 ('approve:data-load', 'data-load', 'Approve data loads, undo, reconciliation sign-off, Go / No-Go and the go-live lock; never the maker of the same item')
ON CONFLICT (code) DO NOTHING;
UPDATE permissions SET description = 'Open the Data Migration & Go-Live workspace: templates, loads, reconciliations, runs, cutover and go-live (read only)'
 WHERE code = 'read:data-load' AND description = 'Download the go-live workbooks (blank or with the current data) and read the load history';
UPDATE permissions SET description = 'Upload, validate and submit data loads, request an undo, maintain runs, the cutover checklist and reconciliations'
 WHERE code = 'write:data-load' AND description = 'Upload, validate and load the go-live configuration and migration workbooks';

-- On a new database the roles table is still empty here: the seed creates the role and its grants.
INSERT INTO roles(code, name, description, is_system)
SELECT 'tis-auditor', 'TIS Audit (read only)', 'Internal and external audit: reads the Data Migration & Go-Live workspace and the audit trail, changes nothing', false
 WHERE EXISTS (SELECT 1 FROM roles WHERE code = 'system-admin')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', ARRAY['read:data-load', 'write:data-load', 'approve:data-load']),
  ('tis-it-admin', ARRAY['read:data-load', 'write:data-load']),
  ('tis-finance', ARRAY['read:data-load', 'approve:data-load']),
  ('tis-ops-unit-head', ARRAY['read:data-load', 'approve:data-load']),
  ('tis-general-manager', ARRAY['read:data-load', 'approve:data-load']),
  ('tis-auditor', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:data-load', 'read:audit'])
) AS v(role, perms)
JOIN roles r ON r.code = v.role
JOIN permissions p ON p.code = ANY(v.perms)
ON CONFLICT DO NOTHING;

INSERT INTO sod_rules(code, name, kind, access_a, access_b, action, reason)
VALUES ('SOD-ACC-LOAD-APPROVE', 'Load and approve migration data', 'access', '{write:data-load}', '{approve:data-load}', 'warn',
  'The person who uploads and submits a data load should not also approve it; named cutover administrators are recorded as exceptions until the end of hypercare')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------ settings

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('migration.load_approval_required', 'true', 'golive', 'Each data load is approved by a second person before it is loaded (off only outside production and pre-production)', 'boolean'),
 ('migration.duplicate_rules', '["tin", "name-birth-date", "company-name", "vehicle", "coc", "policy-number", "insurer-variant", "master-name"]', 'golive', 'Duplicate checks run on each data load', 'json'),
 ('migration.kpi_include_migrated', 'false', 'golive', 'Dashboards and KPIs count migrated policies with the business issued in BrokerVerse', 'boolean'),
 ('migration.commission_include_migrated', 'false', 'golive', 'Commission figures and accruals include migrated policies', 'boolean'),
 ('migration.incentive_include_migrated', 'false', 'golive', 'Incentive premium and policy counts include migrated policies', 'boolean'),
 ('migration.sap_gl_include_opening', 'false', 'golive', 'BrokerVerse sends the opening balances to SAP once, as a separate opening file', 'boolean'),
 ('dashboard.default_origin', '"issued"', 'golive', 'Business the dashboards show first: issued (issued since go-live) or all', 'string'),
 ('migration.unlock_window_days', '7', 'golive', 'Days after the go-live lock during which it may be lifted for named imports', 'number'),
 ('migration.unlock_max_hours', '4', 'golive', 'Hours an unlock of the go-live lock lasts at most before it locks again', 'number'),
 ('migration.approval_expiry_hours', '72', 'golive', 'Hours a submitted data load waits for approval before it expires', 'number'),
 ('migration.job_stale_minutes', '15', 'golive', 'Minutes without progress after which a running data load is treated as interrupted', 'number'),
 ('migration.job_statement_timeout_minutes', '60', 'golive', 'Longest database statement of a data load job, in minutes', 'number'),
 ('migration.document_types', '["POLSCH", "COC", "OR", "ID", "ORCR", "LOAN", "ENDT", "CLAIMFORM", "POLICE", "PHOTO", "ESTIMATE", "OTHER"]', 'golive', 'Document types of the migration file naming convention', 'json'),
 ('migration.evidence_retention_years', '10', 'golive', 'Years the production load files, rows and evidence are kept after the go-live lock', 'number')
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings SET value = value || '{"golive": "Go-live"}'::jsonb, updated_at = now()
 WHERE key = 'system.group_labels' AND jsonb_typeof(value) = 'object' AND NOT value ? 'golive';

-- The workspace downloads carry personal data: masked like every other download for users without view:pii. Changed
-- only where the setting still holds the shipped list.
UPDATE app_settings SET value = value - '/api/data-load',
       label = 'API paths answered without masking (sign-in and own profile, files, configuration)', updated_at = now()
 WHERE key = 'privacy.masking_exempt_paths' AND jsonb_typeof(value) = 'array'
   AND value @> '["/api/auth", "/api/s3", "/api/settings", "/api/system-settings", "/api/data-load", "/api/health"]'::jsonb
   AND value <@ '["/api/auth", "/api/s3", "/api/settings", "/api/system-settings", "/api/data-load", "/api/health"]'::jsonb;
