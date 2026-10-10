-- Period cut-off (TIS-BRD-GL-04; MOM-S2-ACC-PROD-CUTOFF, MOM-S4-CLOSE-26-29).
--
-- accounting.operations_cutoff_day: premium bookings (the posting events of accounting.operations_cutoff_events) dated
-- on or after this day of the month book into the next accounting period; 0 keeps the calendar month.
-- accounting.finance_close_day: the day of the month Finance closes the period; the month-end reminder counts down to it.
-- accounting.adjustment_window_working_days: the job "Period auto soft-close" soft-closes a period once this many
-- working days of the next month have passed (the window in which Finance posts its month-end adjustments); 0 keeps the
-- job's grace days after the period end.
-- The journal posting check reads the period the journal carries, so a booking moved past the cut-off is checked
-- against its own period. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.operations_cutoff_day', '26', 'accounting', 'Period cut-off: premium bookings dated on or after this day of the month book into the next period (0 = calendar month)', 'number'),
 ('accounting.operations_cutoff_events', '["policy.issue.broker_billed","policy.renewal.broker_billed","endorsement.additional_premium","endorsement.return_premium","policy.cancel"]', 'accounting', 'Period cut-off: posting events moved to the next period after the operations cut-off day', 'json'),
 ('accounting.finance_close_day', '29', 'accounting', 'Period cut-off: day of the month Finance closes the period (month-end reminder)', 'number'),
 ('accounting.adjustment_window_working_days', '6', 'accounting', 'Period cut-off: working days of the next month Finance may still post into the period before it is soft-closed (0 = grace days of the job)', 'number')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION jv_check_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d numeric; c numeric; n int; st text; eff text;
BEGIN
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0), count(*) INTO d, c, n FROM journal_lines WHERE jv_id = NEW.id;
    IF n < 2 OR d <> c OR d = 0 THEN
      RAISE EXCEPTION 'journal % is not balanced (debit %, credit %, lines %)', NEW.id, d, c, n USING ERRCODE = 'check_violation';
    END IF;
    eff := CASE WHEN NEW.period ~ '^[0-9]{4}-(0[1-9]|1[0-3])$' THEN NEW.period ELSE to_char(NEW.jv_date, 'YYYY-MM') END;
    SELECT status INTO st FROM accounting_periods WHERE period = eff;
    IF st IN ('closed', 'locked') THEN
      RAISE EXCEPTION 'accounting period % is %', eff, st USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

UPDATE scheduled_jobs SET description = 'Soft-close ended periods once the finance adjustment window (working days of the next month) or the grace days have passed, when no blocking month-end check fails'
 WHERE code = 'period-auto-soft-close';
