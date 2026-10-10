-- Remittance runs, schedules and insurer payments (Accounts > Remittance > Setup > Schedules, Remittances > Run now and
-- Run history, Insurer payments).
--
--   remittance_runs        one run of a remittance schedule, by the "Remittance schedules" job or by a user (Run now,
--                          with an off-cycle reason): the window it covered (the Monday to Friday before the run date,
--                          or the cut-off date of a cut-off schedule), the counts (policies scanned, ready, held,
--                          exceptions, drafts created), the drafts, the result (running, success, nothing, failed) and
--                          its message. A window has at most one run that did not fail (a second run of the same window
--                          is refused: WINDOW_DONE).
--
-- The schedule master (remittance-schedule) gains the kind of run, the payment window, the grouping, the time of the
-- run and "all active insurers"; codes are issued from the remittance_schedule series (SCH-001, SCH-002 ...). The
-- seeded SCH-002 (a settlement run of a configuration that does not exist) is retired while unchanged. For TISPH (roles
-- of migration 0348) the automated configurations ARM-001 and ARM-002 (insurers that are not on the TISPH panel) are
-- retired and SCH-001 is paused while unchanged; the TISPH weekly schedule TIS-WEEKLY comes from seed
-- 90_tisph_remittance.sql, which repeats these changes on a new database (the masters are seeded after migrations).
--
-- Settings:
--   remittance.transfers_enabled   off: electronic transfers are neither created, executed nor approved (Insurer
--                                  payments pays the vouchers through Bank Payment Files and Disbursement; TISPH off)
--   remittance.payment_bank_code   bank whose payment file layout pays insurer vouchers in a batch (Metrobank)
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS remittance_runs (
  id                     text PRIMARY KEY DEFAULT 'run_' || encode(gen_random_bytes(8), 'hex'),
  schedule_id            bigint,
  schedule_code          text NOT NULL,
  trigger                text NOT NULL CHECK (trigger IN ('job', 'user')),
  user_id                text REFERENCES users(id),
  reason_code            text,
  reason_text            text,
  window_from            date NOT NULL,
  window_to              date NOT NULL,
  catch_up_from          date,
  scanned                int NOT NULL DEFAULT 0,
  ready                  int NOT NULL DEFAULT 0,
  held                   int NOT NULL DEFAULT 0,
  exceptions             int NOT NULL DEFAULT 0,
  created                int NOT NULL DEFAULT 0,
  created_remittance_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  due_to_insurer         numeric(14,2) NOT NULL DEFAULT 0,
  execution_ref          text,
  result                 text NOT NULL DEFAULT 'running' CHECK (result IN ('running', 'success', 'nothing', 'failed')),
  message                text,
  started_at             timestamptz NOT NULL DEFAULT now(),
  finished_at            timestamptz
);
CREATE INDEX IF NOT EXISTS remittance_runs_schedule_idx ON remittance_runs(schedule_code, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS remittance_runs_window_uq ON remittance_runs(schedule_code, window_from, window_to) WHERE result <> 'failed';
CREATE INDEX IF NOT EXISTS remittance_runs_created_idx ON remittance_runs USING gin (created_remittance_ids);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.transfers_enabled', 'true', 'remittance', 'Electronic transfers of Accounts > Remittance can be created, executed and approved (off: insurers are paid from Insurer payments)', 'boolean'),
 ('remittance.payment_bank_code', '"MBT"', 'remittance', 'Bank whose payment file layout pays insurer vouchers in a batch (Insurer payments > Create batch)', 'string')
ON CONFLICT (key) DO NOTHING;

-- schedule codes SCH-001, SCH-002 ... (the seeded codes are skipped), while the series is unchanged
UPDATE document_numbering SET pattern = '{PREFIX}-{SEQ}', seq_width = 3, reset_rule = 'never', updated_at = now()
 WHERE code = 'remittance_schedule' AND updated_by IS NULL AND pattern = '{PREFIX}-{YYYY}-{SEQ}';

-- Merge a patch object into the named field of a master type definition, or append the field when it is missing.
CREATE OR REPLACE FUNCTION pg_temp.put_master_field(type_code text, field_name text, field jsonb) RETURNS void LANGUAGE sql AS $$
  UPDATE master_types t SET fields = CASE
    WHEN t.fields @> jsonb_build_array(jsonb_build_object('name', field_name)) THEN (
      SELECT jsonb_agg(CASE WHEN e->>'name' = field_name THEN e || field ELSE e END ORDER BY i) FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS a(e, i))
    ELSE t.fields || jsonb_build_array(jsonb_build_object('name', field_name) || field) END, updated_at = now()
  WHERE t.code = type_code;
$$;

SELECT pg_temp.put_master_field('remittance-schedule', 'code', '{"numbering":"remittance_schedule"}');
SELECT pg_temp.put_master_field('remittance-schedule', 'kind', '{"label":"Kind","type":"select","required":false,"options":["Remittance run","Billing run","Hold check"]}');
SELECT pg_temp.put_master_field('remittance-schedule', 'allInsurers', '{"label":"All active insurers","type":"boolean","required":false}');
SELECT pg_temp.put_master_field('remittance-schedule', 'paymentWindow', '{"label":"Payment window","type":"select","required":false,"options":["Previous Monday to Friday","Cut-off days"]}');
SELECT pg_temp.put_master_field('remittance-schedule', 'groupBy', '{"label":"Group remittances by","type":"select","required":false,"options":["Insurer","Insurer and product line"]}');
SELECT pg_temp.put_master_field('remittance-schedule', 'runTime', '{"label":"Run time","type":"string","required":false}');

UPDATE master_records SET status = 'inactive', updated_at = now()
 WHERE type_code = 'remittance-schedule' AND code = 'SCH-002' AND status = 'active' AND created_by = 'seed' AND updated_by IS NULL;

-- TISPH
UPDATE master_records SET status = 'inactive', updated_at = now()
 WHERE type_code = 'remittance-automated' AND code IN ('ARM-001', 'ARM-002') AND status = 'active' AND created_by = 'seed' AND updated_by IS NULL
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');
UPDATE master_records SET status = 'inactive', updated_at = now()
 WHERE type_code = 'remittance-schedule' AND code = 'SCH-001' AND status = 'active' AND created_by = 'seed' AND updated_by IS NULL
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');
