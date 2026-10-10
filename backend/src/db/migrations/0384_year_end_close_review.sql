-- Year-End Close as a guided process (Accounts > Period End > Year-End Close):
--   accounting.year_end_accepts_soft_closed   the pre-check accepts soft-closed months (default: all twelve closed)
--   year_end_runs.checked_by / checked_at      who ran the pre-checks last
--   year_end_runs.reverse_requested_*          a reversal is requested (reason in reverse_reason_code / reverse_reason)
--                                              and waits for the approval of another Accounting Manager
--   year_end_run_history                       every action on a run: who (and the roles held then), when, from / to
--                                              status, reason code and remarks
-- The history of the runs that exist already is rebuilt from the runs themselves. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('accounting.year_end_accepts_soft_closed', 'false', 'accounting', 'Year-end close: the twelve months may be soft-closed instead of closed (the close locks them all)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE year_end_runs ADD COLUMN IF NOT EXISTS checked_by text;
ALTER TABLE year_end_runs ADD COLUMN IF NOT EXISTS checked_at timestamptz;
ALTER TABLE year_end_runs ADD COLUMN IF NOT EXISTS reverse_requested_by text;
ALTER TABLE year_end_runs ADD COLUMN IF NOT EXISTS reverse_requested_at timestamptz;
COMMENT ON COLUMN year_end_runs.reverse_requested_by IS 'User who requested the reversal of the close; it is approved by another user with approve:period-end';

CREATE TABLE IF NOT EXISTS year_end_run_history (
  id bigserial PRIMARY KEY,
  run_id text NOT NULL REFERENCES year_end_runs(id),
  fiscal_year text NOT NULL,
  action text NOT NULL CHECK (action IN ('start', 'check', 'close', 'reverse-request', 'reverse-withdraw', 'reverse', 'cancel')),
  from_status text, to_status text,
  reason_code text,
  remarks text,
  changed_by text, changed_by_roles text[] NOT NULL DEFAULT '{}',
  changed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS year_end_run_history_run_idx ON year_end_run_history(run_id, changed_at);
CREATE INDEX IF NOT EXISTS year_end_run_history_year_idx ON year_end_run_history(fiscal_year, changed_at);

INSERT INTO year_end_run_history(run_id, fiscal_year, action, from_status, to_status, changed_by, changed_at)
SELECT r.id, r.fiscal_year, 'start', NULL, 'draft', COALESCE(r.prepared_by, r.created_by), COALESCE(r.prepared_at, r.created_at)
  FROM year_end_runs r
 WHERE NOT EXISTS (SELECT 1 FROM year_end_run_history h WHERE h.run_id = r.id);

INSERT INTO year_end_run_history(run_id, fiscal_year, action, from_status, to_status, remarks, changed_by, changed_at)
SELECT r.id, r.fiscal_year, 'close', 'checked', 'closed', r.remarks, r.closed_by, r.closed_at
  FROM year_end_runs r
 WHERE r.closed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM year_end_run_history h WHERE h.run_id = r.id AND h.action = 'close');

INSERT INTO year_end_run_history(run_id, fiscal_year, action, from_status, to_status, reason_code, remarks, changed_by, changed_at)
SELECT r.id, r.fiscal_year, 'reverse', 'closed', 'reversed', r.reverse_reason_code, r.reverse_reason, r.reversed_by, r.reversed_at
  FROM year_end_runs r
 WHERE r.status = 'reversed' AND r.reversed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM year_end_run_history h WHERE h.run_id = r.id AND h.action = 'reverse');

INSERT INTO year_end_run_history(run_id, fiscal_year, action, from_status, to_status, changed_by, changed_at)
SELECT r.id, r.fiscal_year, 'cancel', 'draft', 'cancelled', NULL, r.updated_at
  FROM year_end_runs r
 WHERE r.status = 'cancelled' AND NOT EXISTS (SELECT 1 FROM year_end_run_history h WHERE h.run_id = r.id AND h.action = 'cancel');
