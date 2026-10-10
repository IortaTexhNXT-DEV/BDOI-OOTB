-- Renewal notices at the marks before expiry, sent by the job Renewal notice run, and the notice gate of lock-in and
-- Scheme 2 accounts (TIS-BRD-RENEW-02, TIS-BRD-SCHM-03, FGA IR-01 to IR-07, FRS SCHM-03 FR-LCK-003 and FR-LCK-010 to 014).
--
-- policy_lock_ins: the lock-in of a policy (one row per policy term): source (promotion, Scheme 1 ARA period, Scheme 2),
-- reference, start date of the first locked term, lock-in years and end date, the TFS loan account and its loan status.
-- The renewal of a locked term carries the row to the new term (renewals/service.js completeRenewal).
--
-- The notice gate (renewals/noticeGate.js) gives each renewal its notice treatment:
--   held      the TFS loan status is blocking (lockin.blocking_loan_statuses); queued notices are skipped
--   lock-in   an active lock-in whose end date is on or after the start of the next term
--   scheme2   a Scheme 2 Motor account whose loan is not closed (lockin.suppress_scheme2_motor)
--   send      every other renewal
-- Only a renewal with treatment send gets a notice or an e-mail reminder, from the job, a renewal batch or the
-- Renewal Queue. The owner of a suppressed account gets a Lock-in review task on the review date
-- (lockin.review_days_before days before expiry) instead of the staff reminders.
--
-- Settings:
--   renewals.auto_notices             the job sends the renewal notices at the marks of renewals.notice_schedule
--   renewals.notice_schedule          marks per line of business: { "default": [{ "stage": 1, "daysBefore": 90 }, ...],
--                                     "LIFE": [...] }; a stage is one of renewals.notice_stages
--   renewals.notice_working_days      notices go out on working days only (working calendar: weekdays less the
--                                     national holidays of the Holiday master); a mark on another day goes out on the
--                                     next working day
--   lockin.review_days_before         days before expiry of the lock-in review
--   lockin.suppress_scheme2_motor     Scheme 2 Motor accounts get no renewal notices while the loan is not closed
--   lockin.blocking_loan_statuses     TFS loan statuses that hold the renewal notices
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS policy_lock_ins (
  id bigserial PRIMARY KEY,
  policy_id text NOT NULL UNIQUE REFERENCES policies(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('promotion', 'scheme1-ara', 'scheme2')),
  reference text,
  start_date date NOT NULL,
  years int CHECK (years IS NULL OR years > 0),
  end_date date,
  tfs_loan_account text,
  loan_status text NOT NULL DEFAULT 'current' CHECK (loan_status IN ('current', 'past-due', 'fraud', 'terminated', 'legal-dispute', 'closed')),
  loan_status_at timestamptz,
  loan_status_by text,
  loan_status_note text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'released', 'cancelled')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS policy_lock_ins_loan_idx ON policy_lock_ins(tfs_loan_account);
COMMENT ON TABLE policy_lock_ins IS 'Lock-in of a policy term (promotion, Scheme 1 ARA, Scheme 2) and the TFS loan status that governs its renewal notices';

ALTER TABLE renewals ADD COLUMN IF NOT EXISTS notice_treatment text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS notice_treatment_at timestamptz;
COMMENT ON COLUMN renewals.notice_treatment IS 'Last notice treatment the notice gate gave the renewal: send, lock-in, scheme2 or held';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('renewals.auto_notices', 'true', 'renewals', 'Send the renewal notices automatically at the marks before expiry', 'boolean'),
 ('renewals.notice_schedule', '{"default": [{"stage": 1, "daysBefore": 90}, {"stage": 2, "daysBefore": 60}, {"stage": 3, "daysBefore": 30}], "LIFE": [{"stage": 1, "daysBefore": 30}, {"stage": 2, "daysBefore": 15}]}', 'renewals', 'Renewal notice marks (days before expiry) per line of business', 'json'),
 ('renewals.notice_working_days', 'true', 'renewals', 'Renewal notices go out on working days only; a mark on a weekend or public holiday goes out the next working day', 'boolean'),
 ('lockin.review_days_before', '60', 'lockin', 'Days before expiry of the lock-in review of a lock-in or Scheme 2 account', 'number'),
 ('lockin.suppress_scheme2_motor', 'true', 'lockin', 'Scheme 2 Motor accounts get no renewal notices while the loan is not closed', 'boolean'),
 ('lockin.blocking_loan_statuses', '["past-due", "fraud", "terminated", "legal-dispute"]', 'lockin', 'TFS loan statuses that hold the renewal notices of an account', 'json'),
 ('calendar.working_weekdays', '[1, 2, 3, 4, 5]', 'general', 'Working days of the week (1 Monday to 7 Sunday); the national holidays of the Holiday master are not working days', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('renewal-notice-run', 'Renewal notices', 'Send the renewal notices due at the marks of renewals.notice_schedule to the clients by e-mail (lock-in and Scheme 2 accounts and held loans excluded), and open the lock-in review tasks', '5 6 * * *', 'renewalNoticeRun', '{}', true)
ON CONFLICT (code) DO NOTHING;
