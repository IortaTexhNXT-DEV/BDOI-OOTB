-- Reminders on working days (TIS-BRD-MAS-08, TIS-BRD-NOTIF-02, Pre-BSM M27; gap register GAP-PLAT-06): the scheduled
-- runs of the jobs listed in calendar.working_days_only_jobs wait for a working day (calendar.working_weekdays less
-- the national holidays of the Holiday master), so clients and staff get no reminders on weekends and public holidays.
-- The reminders look ahead over a window and remember what they sent, so the next working day catches up. The renewal
-- notices (renewals.notice_working_days), the service level clocks (sla_targets.working_time), the prospect SLA
-- (leads.sla_working_time) and the Talkbot call list already follow the calendar. "Run now" still runs any job.
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('calendar.working_days_only_jobs', '["collection-reminders", "sms-payment-reminders", "sms-renewal-notices", "quote-expiry-reminder", "claim-document-reminders", "pdc-deposit-due", "pdc-follow-up", "month-end-reminder"]',
  'calendar', 'Scheduled jobs (codes of Master > Schedules) that run on working days only: a run on a weekend day off or a national holiday waits for the next working day', 'json', true)
ON CONFLICT (key) DO NOTHING;
