-- Data Migration & Go-Live: the two-person go-live lock, its scoped and time-boxed unlock, and the jobs of the loads.
--
-- Lock and unlock. A lock or an unlock of the go-live lock is requested by one user (write:data-load, with a reason)
-- and approved by another (approve:data-load). The lock needs the Go decision and the signed reconciliation of the
-- production run (data-load/golive.js). An unlock names the imports it reopens (scope: migration, policies-go-live,
-- opening-items, opening-balances) and its duration in hours: it ends by itself at expires_at (job golive-relock, every
-- 5 minutes, which sets relocked_at). golive.locked stays on during an unlock, so the transaction reset stays refused.
-- One request waits at a time. golive.locked_at and golive.locked_by (the lock request) are written by the approval and
-- edited nowhere. decision_id: the Go decision the lock rests on (foreign key added with the decisions).
--
-- Jobs. Validation, load and undo of a batch run as jobs of the job queue (data-load/jobs.js). The job data-load-sweep
-- (every 5 minutes) marks a batch whose job stopped as failed (an undo back to loaded) with "Interrupted: nothing was
-- saved", and expires a batch waiting for approval longer than migration.approval_expiry_hours.
--
-- The reasons of a rejected load (context data_load_reject) are seeded by seeds/91_data_load_reasons.sql.
-- Idempotent.

CREATE TABLE IF NOT EXISTS go_live_lock_requests (
  id bigserial PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('lock', 'unlock')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reason text NOT NULL,
  decision_ref text,
  scope text[] NOT NULL DEFAULT '{}',
  hours int,
  expires_at timestamptz,
  relocked_at timestamptz,
  decision_id bigint,
  requested_by text NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  decision_reason_code text,
  decision_remarks text
);
CREATE UNIQUE INDEX IF NOT EXISTS go_live_lock_requests_one_pending ON go_live_lock_requests((true)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS go_live_lock_requests_requested_by_idx ON go_live_lock_requests(requested_by);
CREATE INDEX IF NOT EXISTS go_live_lock_requests_decided_by_idx ON go_live_lock_requests(decided_by) WHERE decided_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS go_live_lock_requests_open_unlock_idx ON go_live_lock_requests(expires_at) WHERE action = 'unlock' AND status = 'approved' AND relocked_at IS NULL;
COMMENT ON TABLE go_live_lock_requests IS 'Requests to switch the go-live lock on (lock) or to lift it for named imports and hours (unlock), each approved by a second user';
COMMENT ON COLUMN go_live_lock_requests.scope IS 'Unlock: the imports reopened (migration, policies-go-live, opening-items, opening-balances)';
COMMENT ON COLUMN go_live_lock_requests.decision_ref IS 'Steering committee decision reference: required for an unlock after migration.unlock_window_days';
COMMENT ON COLUMN go_live_lock_requests.relocked_at IS 'Unlock: when it ended (its hours ran out)';

-- jobs of the batches: the sweep reads the batches in a job state
CREATE INDEX IF NOT EXISTS data_load_batches_job_state_idx ON data_load_batches(status) WHERE status IN ('validating', 'running', 'undoing', 'pending-approval', 'undo-pending');
CREATE INDEX IF NOT EXISTS data_load_batches_job_idx ON data_load_batches(job_id) WHERE job_id IS NOT NULL;
COMMENT ON COLUMN data_load_batches.progress IS 'Progress of the running job: stage, sheet, rows done and total, time of the last update';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('golive.locked_at', '""', 'golive', 'When the go-live lock was switched on (set by the approval of the lock request)', 'string', false),
 ('golive.locked_by', '""', 'golive', 'Lock request that switched the go-live lock on', 'string', false)
ON CONFLICT (key) DO NOTHING;
UPDATE app_settings SET label = 'Go-live locked: the migration imports and the transaction reset are refused (switched on and off by two users on Data Migration & Go-Live > Go-Live)'
 WHERE key = 'golive.locked' AND label LIKE 'Go-live locked:%';

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
  ('data-load-sweep', 'Data load sweep',
   'Mark the data loads whose job stopped (deployment, restart) as failed, nothing saved (an undo goes back to loaded), and expire the loads waiting for approval longer than migration.approval_expiry_hours',
   '*/5 * * * *', 'dataLoadSweep', '{}', true),
  ('golive-relock', 'Go-live relock',
   'End the unlocks of the go-live lock whose hours have run out: the imports they reopened are closed again',
   '*/5 * * * *', 'goLiveRelock', '{}', true)
ON CONFLICT (code) DO NOTHING;
