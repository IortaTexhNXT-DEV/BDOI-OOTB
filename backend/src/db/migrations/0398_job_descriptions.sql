-- Master > Schedules shows what each job does, in the list and in the Run now confirmation. Some descriptions named
-- setting keys, permission codes and requirement ids (leads.assignment_sla_hours, read:lead-assignment,
-- TIS-BRD-INTG-04) that mean nothing to the user who runs the job; they now say it in words. Only the wording of the
-- seeded text is replaced: a description changed on the screen is kept. Idempotent.
UPDATE scheduled_jobs SET description = v.new_text
FROM (VALUES
  ('lead-assignment-sla', 'Queue for reassignment the prospects still New after leads.assignment_sla_hours and notify the lead assignment team (read:lead-assignment)',
    'Queue for reassignment the prospects still New after the assignment time limit and notify the lead assignment team'),
  ('bi-extract', 'Write one CSV file per dataset (bi.extract_datasets) to the storage folder bi.extract_folder for the data warehouse or BI tool',
    'Write one CSV file per dataset to the BI extract folder for the data warehouse or BI tool'),
  ('sms-renewal-notices', 'Queue the renewal notice SMS for policies expiring in messaging.renewal_notice_days days (template event renewal_notice)',
    'Queue the renewal notice SMS for policies expiring within the renewal notice period'),
  ('sms-payment-reminders', 'Queue the payment reminder SMS for open bills due in messaging.payment_reminder_days days (template event payment_reminder)',
    'Queue the payment reminder SMS for open bills falling due within the reminder period'),
  ('sap-gl-export', 'Write the SAP GL header and line files of the entries posted since the previous cut-off to the folder sap_gl.folder (TIS-BRD-INTG-04); runs at the sap_gl.cut_off time',
    'Write the SAP GL header and line files of the entries posted since the previous cut-off to the SAP pick-up folder, at the daily cut-off time'),
  ('cover-note-expiry', 'Remind the owners of cover notes about to expire (cover_note.reminder_days_before), expire the cover notes past their end date and link those whose policy was issued',
    'Remind the owners of cover notes about to expire, expire the cover notes past their end date and link those whose policy was issued'),
  ('pdc-deposit-due', 'Tell Accounting (write:receipts) which post-dated cheques are due for deposit within pdc.due_window_days',
    'Tell Accounting which post-dated cheques are due for deposit within the deposit window'),
  ('claim-document-reminders', 'E-mail claimants the documents still missing on their open claims, every claims.document_reminder_days days',
    'E-mail claimants the documents still missing on their open claims, at the reminder interval'),
  ('dormant-users', 'Deactivate active accounts with no sign-in for access.dormant_days days (the built-in administrator excepted)',
    'Deactivate active accounts with no sign-in within the dormancy period (the built-in administrator excepted)')
) AS v(code, old_text, new_text)
WHERE scheduled_jobs.code = v.code AND scheduled_jobs.description = v.old_text;
