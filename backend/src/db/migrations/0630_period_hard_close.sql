-- Period controls (TIS-BRD-GL-04, Pre-BSM M32 periods; GAP-FIN-02, GAP-FIN-03).
--
-- accounting.reopen_closed_periods: a period reopens only until it is hard-closed (status closed), as the BRD asks;
-- true lets a holder of approve:period-end reopen a closed period with a reason, as before. A soft-closed period still
-- reopens, and a locked period (closed fiscal year) never does. The older routes of Accounts > Journal Voucher > Periods
-- now go through Period Management (reason, approve:period-end, blocking checks, status history). Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('accounting.reopen_closed_periods', 'false', 'accounting', 'Period Management: a closed (hard-closed) period may be reopened by a holder of approve:period-end with a reason (off = only soft-closed periods reopen)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
