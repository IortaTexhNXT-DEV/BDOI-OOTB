-- Data Migration & Go-Live: mock runs, the cutover checklist, the Go / No-Go decision, the evidence of the runs and
-- the hypercare period.
--
-- Runs. A run is the frame of a migration attempt: Mock 1, Mock 2, the dress rehearsal, an extra mock or the production
-- run (one at a time that is not cancelled). Every load (data_load_batches.run_id), reconciliation and decision belongs
-- to a run. A run records its timings, result, exit criteria, the personal data it used with the DPO approval, the
-- restore point noted before the load, and the SHA-256 and archive reference of its evidence pack (criterion G11).
--
-- Checklist. Creating a run copies the runbook template (go_live_runbook_steps, seeds/92_go_live_workspace.sql: PC-1 to
-- PC-8, CO-1 to CO-10, GL-1, HC-1, HC-2) into migration_run_steps. A step starts once the steps it depends on are done
-- or skipped; a step whose template names evidence is done with an evidence file or a note saying why there is none.
--
-- Go / No-Go. A decision copies the criteria template (go_live_criteria: G1 to G11, G2 to G5 never waived) and names its
-- approvers (go_live_decision_votes, at least migration.go_live_min_approvers). Voting opens when every criterion is met
-- or waived; all Go makes the decision Go, one No-Go makes it No-Go with the reason, the actions and the new date.
--
-- Evidence. Files of a run, a step, a reconciliation, a decision or a defect (migration_evidence) are kept in the
-- storage folder go-live-evidence and served only by GET /api/data-load/evidence/:id.
--
-- Also: the foreign keys left open by 0440 to 0443 (data_load_batches.run_id, migration_reconciliations.run_id,
-- go_live_lock_requests.decision_id); settings migration.hypercare_days, migration.go_live_min_approvers and
-- housekeeping.data_load_files_days. Kept by the transaction reset (evidence of the mocks and the cutover).
-- Idempotent.

CREATE TABLE IF NOT EXISTS migration_runs (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('mock-1', 'mock-2', 'dress-rehearsal', 'extra-mock', 'production')),
  title text NOT NULL,
  environment text NOT NULL,
  cutover_date date,
  planned_start timestamptz,
  planned_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'failed', 'cancelled')),
  result text CHECK (result IN ('passed', 'passed-with-issues', 'failed')),
  exit_criteria text,
  exit_criteria_met boolean,
  summary text,
  personal_data text CHECK (personal_data IN ('synthetic', 'masked-copy', 'production-extract')),
  dpo_approval_ref text,
  restore_point timestamptz,
  evidence_pack_sha256 text,
  archive_ref text,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_by text REFERENCES users(id),
  closed_at timestamptz
);
ALTER TABLE migration_runs ADD COLUMN IF NOT EXISTS run_number text GENERATED ALWAYS AS ('RUN-' || lpad(id::text, 6, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS migration_runs_number_uq ON migration_runs(run_number);
CREATE UNIQUE INDEX IF NOT EXISTS migration_runs_one_production ON migration_runs((true)) WHERE kind = 'production' AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS migration_runs_created_by_idx ON migration_runs(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_runs_closed_by_idx ON migration_runs(closed_by) WHERE closed_by IS NOT NULL;
COMMENT ON TABLE migration_runs IS 'Mock migrations, dress rehearsal and the production run: timings, results, defects, checklist and evidence';
COMMENT ON COLUMN migration_runs.personal_data IS 'Personal data the run used: synthetic, masked copy or production extract (needs dpo_approval_ref)';
COMMENT ON COLUMN migration_runs.restore_point IS 'Point-in-time restore time noted before the load (cutover step CO-3)';
COMMENT ON COLUMN migration_runs.evidence_pack_sha256 IS 'SHA-256 of the evidence pack downloaded and archived (criterion G11)';

CREATE TABLE IF NOT EXISTS go_live_runbook_steps (
  code text PRIMARY KEY,
  title text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('pre-cutover', 'cutover', 'go-live', 'hypercare')),
  owner_role text,
  offset_label text,
  duration_minutes int,
  evidence_hint text,
  depends_on text[] NOT NULL DEFAULT '{}',
  sort int NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
COMMENT ON TABLE go_live_runbook_steps IS 'Runbook template copied into the checklist of each new run (reference seed 92_go_live_workspace.sql)';

CREATE TABLE IF NOT EXISTS migration_run_steps (
  id bigserial PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  phase text NOT NULL,
  sort int NOT NULL,
  owner_user_id text REFERENCES users(id),
  owner_role text,
  offset_label text,
  duration_minutes int,
  evidence_hint text,
  planned_start timestamptz,
  planned_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text NOT NULL DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'done', 'blocked', 'skipped', 'failed')),
  notes text,
  depends_on text[] NOT NULL DEFAULT '{}',
  updated_by text REFERENCES users(id),
  updated_at timestamptz,
  UNIQUE (run_id, code)
);
CREATE INDEX IF NOT EXISTS migration_run_steps_owner_idx ON migration_run_steps(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_run_steps_updated_by_idx ON migration_run_steps(updated_by) WHERE updated_by IS NOT NULL;
COMMENT ON COLUMN migration_run_steps.evidence_hint IS 'Evidence the runbook asks for: the step is done with an evidence file or a note saying why there is none';

CREATE TABLE IF NOT EXISTS migration_run_defects (
  id bigserial PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE,
  title text NOT NULL,
  object text,
  severity int NOT NULL CHECK (severity BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'retest', 'closed', 'deferred')),
  owner text,
  batch_id bigint REFERENCES data_load_batches(id) ON DELETE SET NULL,
  step_id bigint REFERENCES migration_run_steps(id) ON DELETE SET NULL,
  description text,
  resolution text,
  found_by text REFERENCES users(id),
  found_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
ALTER TABLE migration_run_defects ADD COLUMN IF NOT EXISTS defect_number text GENERATED ALWAYS AS ('DEF-' || lpad(id::text, 6, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS migration_run_defects_number_uq ON migration_run_defects(defect_number);
CREATE INDEX IF NOT EXISTS migration_run_defects_run_idx ON migration_run_defects(run_id, status);
CREATE INDEX IF NOT EXISTS migration_run_defects_batch_idx ON migration_run_defects(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_run_defects_step_idx ON migration_run_defects(step_id) WHERE step_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_run_defects_found_by_idx ON migration_run_defects(found_by) WHERE found_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS go_live_criteria (
  code text PRIMARY KEY,
  title text NOT NULL,
  evidence_hint text,
  auto_check text,
  waivable boolean NOT NULL DEFAULT true,
  sort int NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
COMMENT ON TABLE go_live_criteria IS 'Go / No-Go criteria template copied into each decision (reference seed 92_go_live_workspace.sql)';
COMMENT ON COLUMN go_live_criteria.auto_check IS 'Automatic check computed by data-load/decisions.js (null: manual criterion)';

CREATE TABLE IF NOT EXISTS go_live_decisions (
  id bigserial PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES migration_runs(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'voting', 'go', 'no-go', 'withdrawn')),
  meeting_at timestamptz,
  reason text,
  actions text,
  new_date date,
  minute_ref text,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS go_live_decisions_run_idx ON go_live_decisions(run_id, status);
CREATE INDEX IF NOT EXISTS go_live_decisions_created_by_idx ON go_live_decisions(created_by) WHERE created_by IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS go_live_decisions_one_open ON go_live_decisions(run_id) WHERE status IN ('draft', 'voting');

CREATE TABLE IF NOT EXISTS go_live_decision_criteria (
  id bigserial PRIMARY KEY,
  decision_id bigint NOT NULL REFERENCES go_live_decisions(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  waivable boolean NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'met', 'not-met', 'waived')),
  auto_result jsonb,
  evidence text,
  waived_by text REFERENCES users(id),
  waiver_reason text,
  updated_by text REFERENCES users(id),
  updated_at timestamptz,
  UNIQUE (decision_id, code)
);
CREATE INDEX IF NOT EXISTS go_live_decision_criteria_waived_by_idx ON go_live_decision_criteria(waived_by) WHERE waived_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS go_live_decision_criteria_updated_by_idx ON go_live_decision_criteria(updated_by) WHERE updated_by IS NOT NULL;
ALTER TABLE go_live_decision_criteria ADD COLUMN IF NOT EXISTS auto_check text;
ALTER TABLE go_live_decision_criteria ADD COLUMN IF NOT EXISTS sort int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS go_live_decision_votes (
  id bigserial PRIMARY KEY,
  decision_id bigint NOT NULL REFERENCES go_live_decisions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  role_label text NOT NULL,
  vote text CHECK (vote IN ('go', 'no-go')),
  remarks text,
  voted_at timestamptz,
  UNIQUE (decision_id, user_id)
);
CREATE INDEX IF NOT EXISTS go_live_decision_votes_user_idx ON go_live_decision_votes(user_id);

CREATE TABLE IF NOT EXISTS migration_evidence (
  id bigserial PRIMARY KEY,
  owner_type text NOT NULL CHECK (owner_type IN ('run', 'step', 'reconciliation', 'decision', 'defect')),
  owner_id bigint NOT NULL,
  file_key text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint,
  sha256 text,
  note text,
  uploaded_by text REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS migration_evidence_owner_idx ON migration_evidence(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS migration_evidence_uploaded_by_idx ON migration_evidence(uploaded_by) WHERE uploaded_by IS NOT NULL;
COMMENT ON TABLE migration_evidence IS 'Evidence files of the runs, checklist steps, reconciliations, decisions and defects (storage folder go-live-evidence)';

-- ------------------------------------------------------------------ foreign keys left open by 0440 to 0443

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_load_batches_run_fkey') THEN
    UPDATE data_load_batches b SET run_id = NULL WHERE run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM migration_runs r WHERE r.id = b.run_id);
    ALTER TABLE data_load_batches ADD CONSTRAINT data_load_batches_run_fkey FOREIGN KEY (run_id) REFERENCES migration_runs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'migration_reconciliations_run_fkey') THEN
    UPDATE migration_reconciliations m SET run_id = NULL WHERE run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM migration_runs r WHERE r.id = m.run_id);
    ALTER TABLE migration_reconciliations ADD CONSTRAINT migration_reconciliations_run_fkey FOREIGN KEY (run_id) REFERENCES migration_runs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'go_live_lock_requests_decision_fkey') THEN
    UPDATE go_live_lock_requests l SET decision_id = NULL WHERE decision_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM go_live_decisions d WHERE d.id = l.decision_id);
    ALTER TABLE go_live_lock_requests ADD CONSTRAINT go_live_lock_requests_decision_fkey FOREIGN KEY (decision_id) REFERENCES go_live_decisions(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS go_live_lock_requests_decision_idx ON go_live_lock_requests(decision_id) WHERE decision_id IS NOT NULL;

-- ------------------------------------------------------------------ settings

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('migration.hypercare_days', '28', 'golive', 'Days of hypercare after the go-live lock', 'number'),
 ('migration.go_live_min_approvers', '2', 'golive', 'Fewest approvers who vote on a Go / No-Go decision', 'number'),
 ('housekeeping.data_load_files_days', '365', 'housekeeping', 'Delete the uploaded workbooks of data loads outside the production run after (days; 0 = keep forever). The load keeps the SHA-256 of its file', 'number')
ON CONFLICT (key) DO NOTHING;
UPDATE app_settings SET label = 'Years the rows and workbooks of the production run''s loads are kept after the go-live lock (0 = keep forever)'
 WHERE key = 'migration.evidence_retention_years' AND label = 'Years the production load files, rows and evidence are kept after the go-live lock';
