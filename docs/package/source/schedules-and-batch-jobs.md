---
title: BrokerVerse Schedules and Batch Jobs
subtitle: Scheduled jobs, batch processes and the operational run book
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed: 
approved: 
change: Every job of jobs.json, the migrations and the seeds listed (My Work, AML/CFT, IC compliance, complaints, breach deadlines, EIS, integrations, SMS, operations, distribution); support runbook per job; run book and gaps updated
acronyms: OOTB=Out of the box; AML=Anti-money laundering; AMLC=Anti-Money Laundering Council; EDD=Enhanced due diligence; KYC=Know your customer; EIS=Electronic Invoicing System; IC=Insurance Commission; NPC=National Privacy Commission; PDC=Post-dated cheque; CTPL=Compulsory third party liability; BI=Business intelligence; CSV=Comma-separated values; BIR=Bureau of Internal Revenue; GL=General ledger; JV=Journal voucher; OR=Official receipt; PV=Payment voucher; SMTP=Simple Mail Transfer Protocol; CSV=Comma-separated values; XLSX=Excel workbook; PDF=Portable document format; API=Application programming interface; EWT=Expanded withholding tax; FX=Foreign exchange
---

# About this document

This document describes everything BrokerVerse OOTB runs on a timetable and every batch process an operator starts by hand: what each one reads and writes, the setting that controls it, the e-mails and notifications it produces, how to run it on demand, how to watch it and what happens when it fails or runs twice. It closes with the daily and month-end run book.

It is written for the operations and finance supervisors who own the processes and for the support team that runs the platform. All facts come from the application code (`backend/src/jobs`, `backend/src/modules/*/jobs.js`, the module services), the jobs registered in `backend/src/db/seeds/jobs.json`, in the migrations (`INSERT INTO scheduled_jobs`) and in the seed `73_ops_accounting.sql`, and the upload templates in `docs/package/05_Delivery/Upload_Templates`. The three jobs of the IC and NPC compliance registers (`compliance-reminders`, `complaints-deadlines`, `privacy-breach-deadlines`) arrive with the IC and NPC compliance package (migrations 0270, 0272 and 0273); they appear on Master > Schedules once that package is deployed.

## Terms used

| Term | Meaning |
|---|---|
| Scheduled job | A row of `scheduled_jobs`: code, name, cron expression, handler, parameters, enabled flag. Shown on Master > Schedules. |
| Job run | One execution of a scheduled job, recorded in `job_runs` (started, finished, status, output or error, triggered by). |
| Background queue | The table `job_queue`, used for long batches started from a screen (renewal batch notices and quotes). |
| Batch process | A process an operator starts on a screen that handles many records at once (uploads, bulk print, renewal batch, month-end close). |
| Business date | Today's date in the time zone of the setting `general.timezone` (Asia/Manila). Every job uses it, never the server date. |

# How the scheduler works

## Engine

The scheduler starts with the API server (`backend/src/server.js`). It loads every enabled row of `scheduled_jobs` and schedules it with node-cron in the business time zone, so `0 6 * * *` runs at 06:00 Manila time whatever the server clock (containers run on UTC).

| Item | Behaviour | Controlled by |
|---|---|---|
| Time zone | All cron expressions are read in `general.timezone` (Asia/Manila in the seed). Changing the setting reschedules every job. | Master > Configuration > Company & Branding > General |
| Scheduler on or off per server | Each API instance runs the scheduler unless the environment variable `SCHEDULER_ENABLED` is `false`, `0`, `no` or `off`. Use it to keep a web-only instance from running jobs. Run now still works on such an instance. | Environment variable |
| Picking up changes | Every instance checks every `SCHEDULER_RELOAD_SECONDS` (default 30) whether any job's cron, enabled flag, handler or parameters, or the time zone, changed, and reloads its timetable. | Environment variable |
| One run at a time | Each run takes a PostgreSQL advisory lock on the job code. A second instance that fires the same job at the same time skips it. A scheduled run also skips when another instance already started a scheduled run of the same job in the same minute. A skipped run records nothing. | Automatic |
| Missed runs | A run that falls while no instance is running is not caught up. The next scheduled time runs normally. Jobs that work on "everything due up to today" (policy expiry, recurring journals, accrual reversal, ageing) recover on their next run; jobs that look at one exact day (renewal notices) do not. | Design |
| Run history | Each run writes a `job_runs` row and updates Last run and Last status on the job. Run history is kept for `housekeeping.job_runs_days` (90 days). | Master > Configuration > Data Retention, Privacy & Uploads |

## Master > Schedules

The screen lists every job with: Job, What it does, Schedule (in words, with the time zone in the column header), Status (Scheduled or Switched off), Next run, Last run, Last status, and three actions.

| Action | What it does | Who may use it |
|---|---|---|
| Run now (play icon) | Runs the job at once on the server you are connected to, records a run with Triggered by = your user name, and shows the result as a message. | Permission `write:schedules` (Accounting, System Administrator) |
| Run history (clock icon) | Shows the last 100 runs: Started, Finished, Status, Triggered by, Result (the output in words, or the error). | Permission `read:schedules` (Accounting, System Administrator) |
| Edit schedule (pencil icon) | Changes Schedule (cron) and Enabled. The dialog explains the cron format: minute hour day month weekday, for example `0 6 * * *` runs daily at 06:00 Asia/Manila time. Save reloads the timetable at once. | Permission `write:schedules` (Accounting, System Administrator) |

> Job parameters (for example the days before period end of the month-end reminder, or the list of reports of the daily-reports job) are not on the Edit dialog. A System Administrator changes them through the API: `PUT /api/schedules/<code>` with `{"params": {...}}`.

> Save refuses an invalid cron expression with the message "... is not a valid schedule (five fields: minute hour day month weekday, e.g. 0 6 * * *)". After every edit, check that Next run shows the expected date.

To run a job on demand:

1. Open Master > Schedules.
2. Find the job and click Run now.
3. Read the message: success with the job's output (for example "notifications: 3"), or the error.
4. Open Run history to see the run recorded with your user name.

A job switched off can still be run with Run now. This is the way to use the period-end and bank jobs that ship switched off without scheduling them.

# Scheduled jobs

## Summary

Thirty-five jobs are registered (thirty-two in the current build and three with the IC and NPC compliance package), plus one job per report schedule. "Where registered" names the file that creates the job; a job is never registered twice (`ON CONFLICT (code) DO NOTHING`), so a value the broker changed on Master > Schedules is kept at every upgrade.

| Job (code) | Default timing (Asia/Manila) | OOTB | Handler | Setting that controls it | Where registered |
|---|---|---|---|---|---|
| Renewal notice queue (`renewal-queue`) | Every minute | On | `processRenewalQueue` | none | jobs.json |
| Integration outbox (`integration-outbox`) | Every 2 minutes | On | `integrationOutbox` | the connectors of Master > System Configuration > Integrations (retry policy per connector), `integrations.dispatch_batch_size` (50), `integrations.stuck_minutes` (10) | 0310 |
| E-mail outbox (`email-outbox`) | Every 5 minutes | On | `emailOutbox` | `notification.email_enabled`, `notification.from_address`, `SMTP_URL` | jobs.json |
| My Work reminders (`my-work-reminders`) | Every 15 minutes | On | `myWorkReminders` | `myWork.auto_tasks`, `myWork.overdue_task_alert` | jobs.json, 0253 |
| Screening provider retry (`aml-provider-retry`) | Every 15 minutes | Off | `amlProviderRetry` | `aml.screening_provider` (provider, maxAttempts 5) | 0263 |
| EIS outbox (`eis-outbox`) | Every 15 minutes | Off | `eisOutbox` | `eis.enabled` (off), `eis.mode`, `eis.max_attempts` (5), `eis.retry_minutes` (15), `eis.sending_stale_minutes` (15) | 0283, 0330 |
| Scheduled campaigns (`campaign-dispatch`) | Every 15 minutes | Off | `campaignDispatch` | the campaigns scheduled on Operations > Sales & Marketing > Campaigns; `campaigns.max_recipients` (5,000) | 0307 |
| Breach notification deadlines (`privacy-breach-deadlines`) | Hourly at :15 | On | `privacyBreachDeadlines` | `privacy.breach_reminder_hours` (48, 24, 6), `privacy.breach_notify_hours` (72) | 0273 (compliance package) |
| Policy expiry (`policy-expiry`) | Daily 00:15 | On | `policyExpiry` | none | jobs.json |
| Quotation expiry (`quote-expiry`) | Daily 00:30 | On | `quoteExpiry` | `limits.quote_validity_days` (30) | jobs.json |
| Accrual auto-reversal (`accrual-reversal`) | 00:30 on day 1 of each month | Off | `accrualReversal` | none | 0135 |
| Recurring journals (`recurring-journals`) | Daily 01:15 | Off | `recurringJournals` | the recurring journal templates | 0135 |
| Dormant accounts (`dormant-users`) | Daily 01:45 | On | `dormantUsers` | `access.dormant_days` (90) | jobs.json |
| Period auto soft-close (`period-auto-soft-close`) | Daily 02:00 | Off | `periodAutoSoftClose` | job parameter `graceDays` (5) | 0135 |
| BI extract (`bi-extract`) | Daily 02:00 | Off | `biExtract` | `bi.extract_datasets`, `bi.extract_folder`, `bi.extract_keep_runs` (30) | 0308 |
| Housekeeping (`housekeeping`) | Daily 02:45 | On | `housekeeping` | `housekeeping.*` (job runs, e-mails, sign-ins, sessions, reset codes, notifications, queue, integration outbox, attempts and inbox, EIS submissions, AML provider requests, go-live workbook rows, audit trail) | jobs.json |
| Daily reports (`daily-reports`) | Daily 05:00 | On | `dailyReports` | job parameter `reports` | jobs.json |
| Renewal pipeline (`renewal-pipeline`) | Daily 05:30 | On | `renewalPipeline` | `renewals.pipeline_days` (90), `renewals.grace_period_days` (30) | jobs.json |
| Bank reconciliation auto-match (`bank-auto-match`) | Daily 05:45 | Off | `bankAutoMatch` | `bank_reconciliation.date_window_days`, `bank_reconciliation.group_max_lines`, match rules | 0116 |
| Renewal notices (`renewal-notices`) | Daily 06:00 | On | `renewalNotices` | `notification.renewal_reminder`, `limits.renewal_notice_days` (60, 30, 15) | jobs.json |
| Remittance schedules (`remittance-schedules`) | Daily 06:15 | Off | `remittanceSchedules` | the schedules of Accounts > Remittance > Scheduling | jobs.json |
| Cover note expiry (`cover-note-expiry`) | Daily 06:20 | On | `coverNoteExpiry` | `cover_note.reminder_days_before` (7) | seed 73 |
| Post-dated cheques due (`pdc-deposit-due`) | Daily 06:25 | On | `pdcDepositDue` | `pdc.due_window_days` (3) | seed 73 |
| AML transaction monitoring (`aml-transaction-monitoring`) | Daily 06:30 | On | `amlTransactionMonitoring` | job parameter `days` (3); the monitoring rules of Compliance > AML Settings | 0263 |
| Missing claim documents (`claim-document-reminders`) | Daily 06:35 | On | `claimDocumentReminders` | `claims.document_reminder_days` (3; 0 = off), e-mail template `claim_missing_documents` | seed 73 |
| Compliance reminders (`compliance-reminders`) | Daily 06:45 | On | `complianceReminders` | `compliance.licence_reminder_days` (90, 60, 30, 15, 7), `compliance.fit_proper_reminder_days` (30), `compliance.insurer_authority_expiring_days` (60) | 0270 (compliance package) |
| Receivable ageing (`receivable-ageing`) | Daily 07:00 | On | `receivableAgeing` | `limits.receivable_ageing_buckets` (30, 60, 90, 120) | jobs.json |
| Overdue data subject requests (`privacy-requests-due`) | Daily 07:00 | Off | `privacyRequestsDue` | `privacy.request_due_days` (15) | 0221 |
| KYC refresh due (`aml-kyc-refresh-due`) | Mondays 07:00 | On | `amlKycRefreshDue` | KYC refresh months per rating (Compliance > AML Settings) | 0263 |
| Prospects not worked in time (`lead-assignment-sla`) | Daily 07:30 | Off | `leadAssignmentSla` | `leads.assignment_sla_hours` (48) | 0300 |
| Collection reminders (`collection-reminders`) | Daily 08:00 | On | `collectionReminders` | `collections.reminder_days_before` (7), `collections.reminder_repeat_days` (7), `collections.email_subject`, `collections.email_template` | jobs.json |
| Month-end close reminder (`month-end-reminder`) | Daily 08:00 | Off | `monthEndReminder` | job parameter `daysBefore` (3) | 0135 |
| Complaint deadlines (`complaints-deadlines`) | Daily 08:00 | On | `complaintsDeadlines` | `complaints.ack_days` (2), `complaints.resolution_days_simple` (7), `complaints.resolution_days_complex` (45), `complaints.auto_escalate` | 0272 (compliance package) |
| SMS renewal notices (`sms-renewal-notices`) | Daily 08:10 | Off | `smsRenewalNotices` | `messaging.renewal_notice_days` (30, 7), template event renewal_notice, `messaging.service_consent` | 0311 |
| SMS payment reminders (`sms-payment-reminders`) | Daily 08:20 | Off | `smsPaymentReminders` | `messaging.payment_reminder_days` (3, 0), template event payment_reminder | 0311 |
| Scheduled report (`report-<id>`) | As set on the report schedule | Created per schedule | `scheduledReport` | the report schedule; `reports.email_subject`, `reports.email_body` | per schedule |

The five finance jobs (accrual reversal, recurring journals, period auto soft-close, bank auto-match, month-end reminder) ship switched off; the finance team decides at go-live whether to switch them on or to run them from the screens. The jobs that send to a third party (SMS, EIS, screening provider) and the distribution jobs (lead assignment, campaigns, BI extract) also ship switched off: switch each one on when its connector or set-up is live (see Switching jobs on at go-live in the operational run book).

## E-mail outbox

| Item | Detail |
|---|---|
| Purpose | Delivers the e-mails that the rest of the system has queued in `email_outbox`. |
| Reads | `email_outbox` rows with status queued and fewer than 5 attempts, oldest first, at most 50 per run. |
| Writes | Status sent with sent date, or the error and the attempt count; after the fifth failed attempt the status becomes failed. |
| Sends | Every queued e-mail, from the address in `notification.from_address` (OOTB `BrokerVerse <connect@iortatechnxt.com>`), over the SMTP server in `SMTP_URL`. |
| Switch | Nothing leaves the system unless `notification.email_enabled` is on and `SMTP_URL` is set. Otherwise the run reports how many are queued and why ("notification.email_enabled is false" or "SMTP_URL not set") and the e-mails wait. |
| On demand | Run now, or Retry on a message in Master > E-mail Outbox (resets its attempts and sends it at once when sending is enabled). |
| Restart safety | Each message is marked sent right after the SMTP server accepts it. A crash between the two steps can send that one message twice. |

## Renewal notice queue

| Item | Detail |
|---|---|
| Purpose | Works through the background queue `job_queue`: renewal notices and renewal quotes started from Operations > Renewals > Renewal Batch. |
| Reads | Waiting jobs (up to 500 per run); jobs stuck in processing for more than 15 minutes are put back to waiting first. |
| Writes | Per batch policy: notice status Sent or Failed (with the error), quote status Quoted or Failed; the renewal, its notice and activity records; the batch status (Completed, or back to Draft). |
| Sends | One renewal notice e-mail per policy (see the Communication Templates document) and an in-app notification to the policy owner. |
| Restart safety | A policy is only processed while its status is Queued, so a requeued job skips what was already sent. A policy being sent at the moment of a crash may receive its notice twice. |

New queue jobs are also started at once when they are created; the every-minute job is the safety net after a restart.

## Policy expiry

Sets the status of every active or issued policy whose expiry date is before the business date to expired. Output: number expired. Writes `policies.status`. Sends nothing. Safe to run any number of times.

## Quotation expiry

Sets to expired every quotation in draft, quoted or sent status created more than `limits.quote_validity_days` (30) days ago. Output: number expired. Writes `quotes.status`. Sends nothing. Safe to rerun.

> The job counts from the creation date of the quotation, not from its Valid Until date. A quotation whose validity was extended on screen still expires 30 days after it was created.

## Renewal pipeline

| Item | Detail |
|---|---|
| Purpose | Feeds the renewal queue and lapses renewals that were not completed in time. |
| Reads | Active and issued policies, not yet renewed, expiring between `renewals.grace_period_days` (30) days ago and `renewals.pipeline_days` (90) days ahead, with no renewal record; open renewals whose policy expired more than the grace period ago. |
| Writes | New renewal records (`renewals`), lapsed renewals with the reason "Not renewed within the 30-day grace period". |
| Notifications | For each lapse, an alert to the policy owner: "Policy lapsed: <policy number>". |
| Output | created, lapsed. |
| Restart safety | A policy with a renewal record is never enrolled again; a lapsed renewal is no longer open. Safe to rerun. |

## Renewal notices

Creates in-app reminders "Renewal due in N days" for the policy owner of every active or issued policy that expires exactly N days after the business date, for each N in `limits.renewal_notice_days` (60, 30, 15). The message reads "Policy <number> expires on <date>" and links to the policy. Output: notifications created.

- Switched off by the setting `notification.renewal_reminder` (the run then reports that reminders are switched off).
- It sends no e-mail to the client. Client renewal notices go out from the Renewal Queue or a Renewal Batch.
- Safe to rerun: a reminder already created for the same policy and window is not repeated. Because it looks at one exact day, a day on which the job did not run is not caught up.

## Receivable ageing

Recomputes, for every open or partly paid bill, the days past the due date and the ageing bucket from `limits.receivable_ageing_buckets` (labels current, 1-30, 1-60, 1-90, 1-120 and >120: each label starts at 1, so "1-60" means 31 to 60 days), and stores them on the bill (`receivables.age_days`, `ageing_bucket`). Output: updated. Safe to rerun.

> The job description on the screen says "and notify collections", but the job sends no notification. Collection notifications come from the Collection reminders job.

## Collection reminders

| Item | Detail |
|---|---|
| Purpose | Reminds clients of premiums falling due or overdue and tells the account officer. |
| Reads | Collection items not Paid or Committed, due within `collections.reminder_days_before` (7) days or already overdue, not reminded in the last `collections.reminder_repeat_days` (7) days. |
| Writes | `collection_items.last_reminder_at`; a Reminder action on the collection item. |
| Sends | An e-mail to the client (template `collections.email_subject` / `collections.email_template`) when the client has an e-mail address; an in-app reminder to the policy owner and to holders of `write:collections`: "Premium due <date> - <policy>" or "Premium overdue N day(s) - <policy>". |
| Output | candidates, emails, notifications, skipped (clients without e-mail). |
| On demand | Run now, or the Send Payment Reminders Now button on Accounts > Collections. |
| Restart safety | The repeat window stops a second reminder within 7 days. |

## Daily reports

Generates the Production Register, Collection Report and Claims Position (or the reports named in the job parameter `reports`) with the default range (365 days back to today) and the default format (xlsx), and records them in the generated-file history. It also deletes generated files older than `reports.retention_days`. It does not e-mail the files. A rerun produces another set of files. See the Reports Book.

## Scheduled reports

One job per report schedule, code `report-<schedule id>`, created when a report schedule is saved through the API. Each run generates the report and queues an e-mail with the download link to the schedule's recipients, then records last run and status on the schedule. A rerun e-mails again.

## Housekeeping

Deletes, in batches of 5,000 rows, data past its retention period. Every period is a setting on Master > Configuration > Data Retention, Privacy & Uploads (days; 0 keeps forever).

| Data | Setting | OOTB days | Rows deleted |
|---|---|---|---|
| Job run history | `housekeeping.job_runs_days` | 90 | runs started before the cut-off |
| Sent e-mails | `housekeeping.email_outbox_sent_days` | 180 | sent messages |
| Failed e-mails | `housekeeping.email_outbox_failed_days` | 730 | failed messages |
| Sign-in history | `housekeeping.login_history_days` | 365 | sign-in records |
| Sign-in sessions | `housekeeping.refresh_tokens_days` | 30 | revoked or expired refresh tokens |
| Password reset codes | `housekeeping.password_resets_days` | 7 | used or expired codes |
| Read notifications | `housekeeping.notifications_read_days` | 180 | read notifications only |
| Background queue | `housekeeping.job_queue_done_days` | 30 | completed queue jobs |
| Integration outbox | `housekeeping.integration_outbox_days` | 180 | `integration_outbox` messages that are sent, failed, cancelled or skipped (SMS, CTPL, insurer requests, bank files); queued, processing and retrying messages are never deleted |
| Integration attempts | `housekeeping.integration_attempts_days` | 180 | `integration_attempts` of finished messages (an attempt also goes with its message) |
| Integration inbox | `housekeeping.integration_inbox_days` | 180 | `integration_inbox` messages processed, ignored or failed; received messages not yet processed are kept |
| EIS submissions | `housekeeping.eis_submissions_days` | 3,653 (10 years) | `eis_submissions` accepted, rejected, failed or uploaded manually; queued and sending submissions are kept. The acknowledgement is tax evidence: do not go below the BIR record-keeping period |
| AML provider requests | `housekeeping.aml_provider_requests_days` | 1,827 (5 years) | `aml_provider_requests` succeeded, failed or abandoned; the screenings themselves (`aml_screenings`) are not purged. AMLA record keeping |
| Go-live workbook rows | `housekeeping.data_load_rows_days` | 365 | `data_load_rows` of batches loaded or failed; the batch history stays and the rows of a validated workbook not yet loaded are kept |
| Audit trail | `housekeeping.audit_log_days` | 0 (keep) | never below 2,557 days (7 years, BIR and Insurance Commission record keeping) |

Output: rows deleted per table and the tables kept forever. Safe to rerun. A row that is still pending (a queued or retrying message, a received inbound message, a queued e-invoice, a pending screening request, a validated workbook) is never deleted, whatever the period.

## Dormant accounts

Deactivates every active user (except the built-in administrator `BrokerVerse`) who has not signed in, or since creation, for `access.dormant_days` (90) days, and ends their sessions. Output: number and user names. A deactivated user is reactivated on Master > Users and Access > User. Setting the days to 0 disables the job's effect. Safe to rerun.

## Month-end close reminder (off)

Notifies holders of `write:period-end` (high priority, link to Month-End Close) when the current accounting period ends within `daysBefore` (3) days: "Month-end close: 2026-10 ends in 2 day(s)", message "Accounting period 2026-10 ends on ... Post pending journals and prepare the month-end close run."; and for every ended period still open: "Month-end close: 2026-09 is still open". A notification is not repeated for the same period and title.

## Recurring journals (off)

Posts every active recurring journal template (Accounts > Period End > Recurring Journals) whose next run date has arrived, one journal per occurrence, catching up missed occurrences. Templates with auto-post create posted journals, the others pending journals that need approval. Templates with auto-reverse are scheduled for reversal the next day. Output: journals posted and errors. Idempotent: one journal per template and occurrence date; a failed occurrence keeps the next run date there and is retried. The same action is on the screen: Accounts > Period End > Recurring Journals > Run due.

## Accrual auto-reversal (off)

On day 1 of the month, posts the reversal of every accrual, commission deferral and FX revaluation journal whose reversal date has arrived (journals created by the month-end close run or by auto-reverse templates). Each reversal is done on its own; a failure (for example a closed period) is reported and retried on the next run. Idempotent: an entry already reversed is not reversed again.

## Period auto soft-close (off)

Soft-closes every open regular period that ended more than `graceDays` (5) days ago, when none of the automatic blocking month-end checks fails (no unposted or pending journals, trial balance balances, suspense account cleared). Manual sign-offs are not considered. Periods with failing checks are skipped and listed with the reasons. In a soft-closed period only users with `approve:period-end` may post.

## Remittance schedules (off)

Runs the active remittance schedules of Accounts > Remittance > Scheduling whose next run date has come: draft remittances per insurer for the policies up to the cut-off date, then the next run date moves on by the frequency (Daily, Weekly, Monthly, Quarterly). The schedules have no timer of their own; this job is their only timer and runs them in the business time zone. Run Now on the Scheduling screen runs one schedule at once. The drafts still go through Accounts > Remittance > Approval Workflow.

## Overdue data subject requests (off)

Notifies the holders of `read:privacy` (high priority, link to Master > Data Privacy > Data Subject Requests) of every open data subject request past its due date: "Data subject request DSR-2026-00001 is overdue". A request is reminded at most once in 20 hours, so a rerun on the same day sends nothing new. Output: overdue, notified.

## Bank reconciliation auto-match (off)

Runs the automatic matching rules (adjustment, contra, reference, amount and date, one-to-many, many-to-one) on every active bank account linked to a GL cash account that has unmatched statement lines. Each account is processed on its own; an error on one account does not stop the others. It never matches into a period whose reconciliation is approved. Output: accounts, matches per account. Safe to rerun: it only looks at unmatched lines. Matching also runs right after each statement import when `bank_reconciliation.auto_match_on_import` is on (default), which is why the job ships switched off.

## Prospects not worked in time (off)

| Item | Detail |
|---|---|
| Purpose | Returns to the reassignment queue the prospects still New more than `leads.assignment_sla_hours` hours after they were assigned, so that a manager gives them to someone else. |
| Reads | `leads` with status New and assignment status assigned, assigned (or created) more than the limit ago. |
| Writes | The prospect's assignment status becomes queued with the reason; a row in `lead_assignment_history`; a notification to the users with `write:lead-assignment`. |
| Switch | Off in the seed. Switch it on once the assignment rules are set up. Setting `leads.assignment_sla_hours` to 0 stops it. |
| Restart safety | A queued prospect is not queued again; a rerun only picks up prospects that crossed the limit since. |

## Scheduled campaigns (off)

| Item | Detail |
|---|---|
| Purpose | Sends the marketing campaigns whose scheduled time has come. |
| Reads | `campaigns` with status scheduled and a scheduled time up to now; the segment's clients and prospects and their marketing consent in `privacy_consents`. |
| Writes | One `campaign_recipients` row per person (queued, or excluded with the reason); one e-mail per consenting recipient in `email_outbox`; the campaign becomes sent with its counts. |
| Switch | Off in the seed. Campaigns sent with Send now do not need it. Nothing leaves the system until the e-mail outbox job sends it. |
| Restart safety | A recipient is recorded once per campaign; a campaign already sent is skipped. |

## BI extract (off)

| Item | Detail |
|---|---|
| Purpose | Writes one CSV file per Report Builder dataset listed in `bi.extract_datasets` to the storage folder `bi.extract_folder`, in a sub-folder of the business date, for the data warehouse or BI tool to collect. |
| Reads | The curated datasets of the Report Builder (all rows; no user scope). |
| Writes | The CSV files in file storage and a `bi_extract_runs` row (folder, files with their row counts, status). Only the last `bi.extract_keep_runs` runs are kept in the list. |
| Switch | Off in the seed. The administrator can also run it from Reports > Report Builder > BI extract > Run now. |
| Restart safety | A rerun on the same day overwrites the files of that day. |

## Integration outbox

| Item | Detail |
|---|---|
| Purpose | Sends the messages queued for third parties: SMS and Viber messages, CTPL authentication requests, LTO feeds, insurer requests and bank payment files. |
| Reads | `integration_outbox` rows in status queued or retry whose next attempt time has come, oldest first, at most `integrations.dispatch_batch_size` (50) per run. Rows left in processing longer than `integrations.stuck_minutes` (10) (the server stopped while sending) are put back to retry first. Rows are picked with a row lock that other servers skip, so two instances never send the same message. |
| Writes | One `integration_attempts` row per attempt (mode, result, HTTP status, duration, error). The message becomes sent (with the provider's reference and answer), retry with the next attempt time (first wait of the connector, doubled at each attempt, up to the longest wait), or failed after the last attempt or when the provider refuses the request. Last success and last failure on the connector. |
| Sends | Through the connector's adapter. A connector in test mode answers from the built-in test provider and nothing leaves the system. A switched-off connector keeps its messages queued without counting an attempt. A live connector with a missing endpoint or credential variable fails the attempt with the reason "not ready for live use". |
| On demand | Master > System Configuration > Integrations > Outbox: Send due messages; Resend on a failed, cancelled or not sent message (fresh attempt count, sent at once); Cancel message. |
| Output | sent, retry, failed, held. |
| Restart safety | A message is marked sent in the same transaction as the provider's answer; a message whose answer could not be applied stays failed with "Sent, but the answer could not be applied" in Last error. The idempotency key of each business event stops the same event from being queued twice. A crash during the provider call can send that one message twice. |

## SMS renewal notices and SMS payment reminders (off)

`sms-renewal-notices` queues the renewal notice SMS (template event renewal_notice) for policies expiring in each of `messaging.renewal_notice_days` (30 and 7) days; `sms-payment-reminders` queues the payment reminder SMS (event payment_reminder) for open bills due in each of `messaging.payment_reminder_days` (3 and 0) days. Before queueing, each message passes the consent check (`messaging.service_consent`) and needs a valid mobile number; a message that fails is recorded as Not sent with the reason. The integration outbox then sends the messages. Each notice is queued once per policy or bill and day, so a rerun sends nothing twice. Both jobs ship switched off: switch them on when the SMS connector is live.

## My Work reminders

| Item | Detail |
|---|---|
| Purpose | Keeps the follow-up tasks of Operations > My Work in line with the records and reminds their owners. |
| Reads | Collection promises to pay, renewal next steps and claim follow-up dates (when `myWork.auto_tasks` is on); open tasks whose reminder time has come; open tasks past their due date and time. |
| Writes | Creates the follow-up tasks of new promises, next steps and follow-up dates and closes those whose record is closed; marks reminded and overdue-notified tasks. |
| Sends | An in-app reminder "Task due: <title>" at the reminder time, and one alert "Task overdue: <title>" per task when `myWork.overdue_task_alert` is on. No e-mail. |
| Restart safety | A task is reminded once and alerted once. Safe to rerun. |

## Cover note expiry

Links each active cover note to the policy issued for it, expires the cover notes past their end date, and reminds the owner (the placement owner, the account executive of the quotation or the creator; else the holders of `write:policies`) of each active cover note ending within `cover_note.reminder_days_before` (7) days with no policy issued yet: "Cover note <number> expires on <date>". A cover note is reminded once. Safe to rerun.

## Post-dated cheques due

Tells Accounting (holders of `write:receipts`) in one notification how many post-dated cheques are due for deposit today or earlier and within `pdc.due_window_days` (3) days, with the total amount, linked to Accounts > Post-Dated Cheques. It writes nothing else. A rerun sends the notification again.

## Missing claim documents

E-mails the claimant of every open claim (statuses in `claims.open_statuses`) that has a client e-mail address and at least one required document still pending, when the last reminder (or the registration of the claim) is more than `claims.document_reminder_days` (3) days old, with the template `claim_missing_documents`. It records the reminder on the claim and tells the holders of `write:claims` how many reminders were sent. Setting the days to 0 switches the reminders off. Safe to rerun: a claim reminded within the period is skipped.

## AML transaction monitoring

| Item | Detail |
|---|---|
| Purpose | Runs the active covered and suspicious transaction rules of Compliance > AML Settings over the last `days` (3) days up to the business date. |
| Reads | Receipts, payment links, cancellations with return premium, refund vouchers, claim payments and overpayments of the period, per rule. |
| Writes | One alert (AMA number) per rule and transaction; an alert already raised for the same rule and transaction is not raised again. |
| Sends | When alerts were added, one high-priority notification to the compliance officer (`read:aml`): "<n> new AML transaction alert(s)", linked to Compliance > Transaction Alerts. |
| On demand | Compliance > Transaction Alerts > Run monitoring, for any period. After an outage longer than 3 days, run it for the missed dates. |
| Restart safety | Safe to rerun: the window overlaps on purpose and duplicates are not created. |

## KYC refresh due

Every Monday at 07:00, marks Refresh due the clients whose KYC refresh date has come (deleted and anonymised clients excepted), then notifies the compliance officer (`read:aml`) of the number of KYC refreshes due and overdue and of the EDD reviews open or awaiting approval, linked to Compliance > KYC Refresh; high priority when a refresh is overdue. A rerun sends the summary again but marks nothing twice.

## Screening provider retry (off)

Sends again the requests to the commercial screening provider (`aml.screening_provider`) that failed, until the provider's maximum attempts (5). A successful answer applies the provider's matches to the screening hits. When a request is abandoned after its last attempt, the compliance officer is notified ("Screening provider request abandoned ... screen the party manually"). Ships switched off: switch it on when the provider is set to Provider API. The uploaded lists are always screened as well, so screening continues while the provider is down. Safe to rerun.

## EIS outbox (off)

| Item | Detail |
|---|---|
| Purpose | Sends the e-invoices queued for the BIR Electronic Invoicing System: each sales invoice issued, and each cancellation of an invoice already sent. |
| Switch | Does nothing while `eis.enabled` is off (the run reports "the EIS connector is switched off"). `eis.mode` test uses the built-in test provider; live uses `eis.endpoint` with the credentials held in the environment variables named in `eis.client_id_env`, `eis.client_secret_env` and `eis.signing_key_env`. |
| Reads | Submissions queued or failed with fewer than `eis.max_attempts` (5) attempts whose next attempt time has come, at most 50 per run. |
| Writes | Accepted (with the EIS reference), rejected (final: cancel and reissue the invoice) or failed with the error and the next attempt after `eis.retry_minutes` (15), doubled at each attempt. |
| On demand | Accounts > Tax > E-Invoicing (EIS): Send now, Retry, Queue earlier invoices, Export payloads and Uploaded manually (fallback). |
| Restart safety | A submission is set to sending before the call. A crash during the call leaves it in sending; a submission in sending longer than `eis.sending_stale_minutes` (15) counts as a failed attempt and the next run sends it again (within `eis.max_attempts`; the EIS rejects a duplicate of an invoice it already holds). A submission that used up its attempts stays failed for Retry or Uploaded manually. |

## Compliance reminders (compliance package)

Daily at 06:45, reminds the compliance team (`read:compliance`) of: each licence of the Licence Register at each threshold of `compliance.licence_reminder_days` (90, 60, 30, 15 and 7 days before expiry, and once expired), once per threshold, together with the user who holds the licence; fit and proper reviews overdue or due within `compliance.fit_proper_reminder_days` (30); insurers whose IC certificate of authority expires within `compliance.insurer_authority_expiring_days` (60) or has expired (at most once a week per insurer and state). It does nothing until the compliance registers are migrated. Safe to rerun.

## Complaint deadlines (compliance package)

Daily at 08:00, reminds the person assigned to each complaint of the acknowledgement and resolution deadlines that have come (`complaints.ack_days`, `complaints.resolution_days_simple`, `complaints.resolution_days_complex`, counted in calendar days from the date received) and, when `complaints.auto_escalate` is on, escalates the complaints whose resolution is overdue to the complaints officers (`approve:complaints`). Every reminder and escalation is kept in the complaint history. Safe to rerun.

## Breach notification deadlines (compliance package)

Hourly at :15, reminds the data privacy team (`read:privacy`) of every personal data breach of the Breach Register not yet notified to the NPC, at each mark of `privacy.breach_reminder_hours` (48, 24 and 6 hours before the deadline of `privacy.breach_notify_hours`, 72 hours from discovery) and once the deadline has passed. Each mark is reminded once. Because the clock runs in hours, this job must stay on and the scheduler must run on at least one server at all times.

# Monitoring and failure handling

## What to watch

| Where | What it shows |
|---|---|
| Master > Schedules | Last status per job (success or failed) and Next run. A blank Next run on an enabled job means the scheduler is off on that server or the cron is invalid. |
| Master > Schedules > Run history | Each run with its output or error message. |
| Master > E-mail Outbox | Queued, sent and failed e-mails, with the last error and Retry. A banner tells whether sending is enabled. |
| Operations > Renewals > Renewal Batch | Per batch: queued, sent, failed counts; Retry Failed. |
| Master > System Configuration > Integrations | Connectors tab: Waiting, Failed and Sent today per connector, last success and last failure, what is missing before going live. Outbox tab: status counts, Last error, Next attempt. Inbox tab: failed and ignored inbound messages. |
| Accounts > Tax > E-Invoicing (EIS) | Banner (connector on, mode, credentials set) and the counters queued, accepted, failed, rejected, uploaded manually. |
| Compliance > AML Dashboard | Failed requests to the screening provider, hits and alerts open, cases overdue, reports to file; a warning when an active screening list has no version loaded. |
| Compliance > Insurance Commission and Data Privacy (NPC) screens (compliance package) | Licences expiring, reviews due, complaints past a deadline, breaches with the 72-hour Clock. |
| Server log | "scheduled job <code> failed" with the run id and error; "scheduler: N job(s) scheduled (time zone Asia/Manila)" at start and after each reload. |
| Database | `job_runs` (status, error), `job_queue` (status, error, attempts), `email_outbox` (status, attempts, error), `integration_outbox` and `integration_attempts`, `eis_submissions`. |

## When a job fails

A failed run is recorded with status failed and the error text, and the job's Last status turns to failed. Nothing is retried automatically: the job runs again at its next scheduled time.

1. Open Run history and read the error.
2. Fix the cause (for example a closed period for a recurring journal, a missing GL account, SMTP unreachable).
3. Click Run now. Every job in this document can be rerun; the restart-safety notes above say what a rerun repeats.

> No e-mail or notification is sent when a scheduled job fails. Someone has to look at Master > Schedules each morning (see the run book), or the support team adds an alert on the server log line "scheduled job ... failed".

## Restart safety at a glance

| Job | Safe to rerun | What a rerun repeats |
|---|---|---|
| Policy expiry, quotation expiry, receivable ageing, housekeeping, dormant accounts, period auto soft-close | Yes | Nothing |
| Renewal pipeline, month-end reminder, renewal notices | Yes | Nothing (existing records and notifications are detected) |
| Recurring journals, accrual reversal, bank auto-match | Yes | Nothing (one journal per occurrence; reversed entries skipped; matched lines skipped) |
| Collection reminders | Yes | Nothing within the repeat window |
| E-mail outbox, renewal notice queue, integration outbox | Yes | At most the one message being sent at the moment of a crash |
| EIS outbox | Yes | Nothing; a submission left in sending after a crash is sent again after `eis.sending_stale_minutes` |
| Daily reports, scheduled reports, BI extract | Yes | Another file; a scheduled report e-mails its recipients again; the BI extract overwrites the files of the day |
| My Work reminders, cover note expiry, missing claim documents, SMS renewal notices, SMS payment reminders, campaigns, prospects not worked in time | Yes | Nothing (reminded, queued or sent records are detected) |
| AML transaction monitoring, KYC refresh due, screening provider retry | Yes | Nothing, except the KYC summary notification |
| Compliance reminders, complaint deadlines, breach notification deadlines | Yes | Nothing (each threshold or mark is reminded once) |
| Post-dated cheques due | Yes | The summary notification |

## Support runbook by job

Use this table when a job shows Last status failed, when its Next run is blank, or when users report that its effect is missing. The first checks for every job are the same: Run history (the error), the server log line with the run id, and whether the scheduler runs on at least one server (`SCHEDULER_ENABLED`). The table gives what is specific to each job. "Owner" is who decides on the business side; support (L2) does the technical checks.

| Job | Symptom | Check | Fix or workaround | Owner |
|---|---|---|---|---|
| `renewal-queue` | Renewal Batch stays Processing | `job_queue` rows in processing or failed with their error; the client e-mail address | Retry Failed on the batch; correct the client e-mail | Operations |
| `integration-outbox` | Messages stay Queued or Retry scheduled; Failed count grows | Connectors tab: Enabled, Mode, credential ticks, Before going live; Outbox Last error and attempt log; provider status | Fix the endpoint or credential variable (server restart after a secret change), then Resend; Cancel messages that must not go; see Integrations outbox monitoring in the Production Support document | System Administrator |
| `email-outbox` | E-mails stay Queued | `notification.email_enabled`, `SMTP_URL`, Last error | Fix SMTP, then Retry; see the E-mail outbox section | System Administrator |
| `my-work-reminders` | No task reminders; follow-up tasks missing | `myWork.auto_tasks`, `myWork.overdue_task_alert`; the task's reminder time | Run now; correct the setting | Operations |
| `aml-provider-retry` | Failed provider requests on the AML Dashboard | `aml.screening_provider` (provider, endpoint, API key variable set on the server); Provider tab call log | Fix the provider settings, then Retry on the request; screen manually the parties of abandoned requests | Compliance officer |
| `eis-outbox` | Failed or rejected count grows; submissions in sending | `eis.enabled`, `eis.mode`, credential variables; Last error | Failed: fix and Retry. Rejected: cancel and reissue the invoice. In sending longer than `eis.sending_stale_minutes`: the next run retries it by itself; once the attempts are used up, Retry or Uploaded manually. EIS down: Export payloads and upload manually | Accounting Manager |
| `campaign-dispatch` | Scheduled campaign still Scheduled after its time | Job enabled; campaign status; segment consent results | Run now, or Send now on the campaign | Marketing |
| `privacy-breach-deadlines` | No reminders on an open breach | Job enabled; breach status (already notified?); `privacy.breach_*` settings | Run now. Never leave this job off: the NPC 72-hour deadline runs in hours | DPO |
| `policy-expiry`, `quote-expiry` | Expired policies or quotations still active | Business date, `general.timezone` | Run now (both catch up) | Operations |
| `accrual-reversal`, `recurring-journals`, `period-auto-soft-close` | Journals or soft-close missing | Error text: closed period, missing GL account, failing checks | Open the period or correct the account, Run now; or run from Accounts > Period End | Accounting Manager |
| `dormant-users` | Active user deactivated unexpectedly | `access.dormant_days`, the user's last sign-in | Reactivate on User Management; adjust the days | System Administrator |
| `bi-extract` | No files for the BI tool | `bi.extract_folder`, storage space and permissions; BI extract tab | Run now on Reports > Report Builder > BI extract | BI owner |
| `housekeeping` | Tables grow; job slow | Run output per table; retention settings | Run now; it works in batches of 5,000 rows | Support |
| `daily-reports`, `report-<id>` | Report files or e-mails missing | Generated-file history; e-mail outbox | Run now; correct recipients | Report owner |
| `renewal-pipeline`, `renewal-notices` | Renewals not enrolled; reminders missing | `renewals.*`, `notification.renewal_reminder`; Renewal notices only looks at exact days | Run now; for a missed day of renewal notices, send from the Renewal Queue | Operations |
| `bank-auto-match` | Statement lines not matched | Statements imported; match rules; approved periods | Run now or Auto-match on the workspace | Accounting |
| `remittance-schedules` | Draft remittances not created | Job enabled; schedule active and its next run date | Run Now on the schedule | Accounting |
| `cover-note-expiry` | Cover note still active after its end date | Business date; issued policy linked | Run now | Processing |
| `pdc-deposit-due` | No deposit reminder | `pdc.due_window_days`; holders of `write:receipts` | Run now; open Accounts > Post-Dated Cheques | Accounting |
| `aml-transaction-monitoring` | No alerts after a known cash payment | Rule enabled and its parameters; the receipt's payment mode in the cash list | Run monitoring for the dates concerned | Compliance officer |
| `claim-document-reminders` | Claimants not reminded | `claims.document_reminder_days` (0 = off); client e-mail; e-mail outbox | Run now; Remind on the claim | Claims |
| `compliance-reminders` | Licence or authority reminders missing | Licence and insurer dates entered; compliance package deployed | Run now; complete the register | Compliance team |
| `receivable-ageing` | Ageing buckets out of date | Business date | Run now | Accounting |
| `privacy-requests-due` | No overdue alerts | Job enabled; holders of `read:privacy` | Switch the job on; Run now | DPO |
| `aml-kyc-refresh-due` | Refresh dates passed but status unchanged | Client's next KYC refresh date | Run now; Complete KYC refresh on the profile | Compliance officer |
| `lead-assignment-sla` | Untouched prospects not queued | Job enabled; `leads.assignment_sla_hours` | Run now; reassign from the Queue tab | Sales manager |
| `collection-reminders`, `month-end-reminder` | Reminders missing | Repeat window; client e-mail; job enabled (month-end) | Run now, or Send Payment Reminders Now | Accounting |
| `complaints-deadlines` | Deadlines passed without reminder | Complaint assigned to someone; `complaints.auto_escalate` | Run now; assign the complaint | Complaints officer |
| `sms-renewal-notices`, `sms-payment-reminders` | No SMS sent | Job enabled; SMS connector Live; template active; Not sent reasons (consent, mobile number) | Correct the connector or the client data; Run now (nothing is sent twice) | Operations |

# Batch processes

## Upload templates and the import rules

Every bulk upload has a template in `docs/package/05_Delivery/Upload_Templates` (also downloadable on the screens that have an Upload or Import button). Each workbook has three sheets: Data (header row and one or two Philippine sample rows, required columns in dark red), Columns (required or not, format, allowed values, example, other accepted header names) and Instructions (screen, API route, file types, row limit, what happens on errors).

Rules common to all uploads:

- XLSX (first sheet) or CSV saved as UTF-8; the first row holds the column headers. Column order does not matter; headers are matched without regard to case, spaces or punctuation.
- Dates as YYYY-MM-DD, amounts as plain numbers (no peso sign, no thousands separator). Delete the sample rows before uploading.
- File size up to 10 MB. Rows: up to 20,000 for the data-migration uploads (`IMPORT_MAX_ROWS`), up to 1,000 for receipts, payment vouchers, open items and masters (`limits.bulk_upload_max_rows`).
- Row by row (most uploads): each row is checked and saved on its own; the result lists the failed rows with their spreadsheet row number and the reason. Upload only the corrected rows again, otherwise the saved rows are created a second time.
- All or nothing (opening balances, bank statements): the whole file is checked first and nothing is saved when any row is wrong.

| Upload | Screen | Rule | Notes |
|---|---|---|---|
| Leads | Operations > Sales & Marketing > Prospects > Bulk Upload | Row by row | First Name or Company Name required. |
| Quotations | Operations > Sales & Marketing > Quotations > Bulk Upload | Row by row | With a Lead Id the quotation joins that lead, else a new lead is created; premiums are recalculated from the rate and tariff. |
| Policies | Operations > Policy > Bulk Upload | Row by row | New business: client, policy (insurer at 100%), premium bill, booking journal and commission. Go-live mode ("Existing policies (go-live)"): client and policy only. Co-insured policies cannot be uploaded. |
| Official receipts | Accounts > Receipts > Bulk upload | Row by row | Each row issues an OR, applies it to the oldest open bills of the policy and posts the journal; the receipt date must be in an open period. |
| Payment vouchers | Accounts > Disbursement > Bulk upload | Row by row | Each row creates a draft voucher, then approved and paid on screen (maker-checker). |
| Opening balances | Accounts > Period End > Period Management > Import opening balances | All or nothing | Debits must equal credits; loading again with the same go-live date replaces the earlier load; no journal is posted. |
| Open items | Accounts > Collections > Import open items | Row by row, rows already loaded skipped | Each row becomes an open bill of a go-live policy; no journal (the GL carries them in the opening balance). |
| Masters (29 templates) | The master screen > Upload, or the API route where the screen has no Upload button yet | Row by row | A row whose code exists is refused; edit existing records on screen. |
| Bank statement | Accounts > Bank Reconciliation > Reconciliation Workspace > Import statement | All or nothing | See bank statement import below. |
| Remittance bulk | Accounts > Remittance > Bulk Processing | Validate, then process valid rows | See remittance bulk processing below. |
| Remittance bank transactions | Accounts > Remittance > Reconciliation > Import | Read in the browser | TransDate, Reference, Amount, Description. |
| Users | Server script `backend/scripts/provision-users.js` | Dry run, then `CONFIRM_PROVISION=yes` | Not a screen upload; users must change the initial password. |

The full column lists are in the templates and in `docs/package/05_Delivery/Upload_Templates/README.md`.

## Renewal batch

**Menu:** Operations > Renewals > Renewal Batch. **Permission:** renewals write.

| Step | What happens | Validation |
|---|---|---|
| Create batch | Pick policies by criteria (expiry range, insurer, product, premium range, client, payment status) or by list. A batch number is assigned and the batch is Draft. | At most `renewals.batch_max_policies` (500) policies; policies already renewed or cancelled, no longer renewable, or with a renewal in progress are refused or left out. Policies expiring up to `renewals.batch_window_days` (30) ahead are proposed. |
| Select | Tick the policies to act on. | |
| Send Renewal Notices | Queues the next notice (first, second, final) for the selected policies; the batch becomes Processing and the renewal notice queue sends them. | Only policies whose notice status is NotSent; notices must go in order when `renewals.enforce_notice_order` is on; the client needs an e-mail address. |
| Prepare quotes | Queues re-rated renewal quotes for the selected policies. | Only policies not yet quoted (or failed). |
| Retry Failed | Puts failed notices back in the queue. | Only Failed notices. |
| Generate Report | Downloads the batch with notice and quote status (Excel or CSV). | |
| Completion | When nothing is queued the batch becomes Completed if every selected policy had its notice, else back to Draft. | A batch with sent notices cannot be deleted, only cancelled. |

## Bulk disbursement and bulk print

- **Bulk Disburse** (Accounts > Disbursement > Bulk Disburse): creates one payout voucher, for approval, per selected agent or referrer with Approved commission lines. The vouchers then follow the normal approval and payment, and feed the QAP and Form 2307 (issued).
- **Bulk upload of vouchers**: see the upload table above.
- **Bulk print of payment vouchers** (Accounts > Disbursement > Bulk print): one PDF, one voucher per page, for one voucher or a customer code and date range.
- **Bulk print of official receipts** (Accounts > Receipts > Bulk print): one PDF, one receipt per page, for one receipt or a customer code and date range. The title comes from `receipts.print_title` ("Official Receipts").

## Remittance processing

| Process | Menu | Input | Output |
|---|---|---|---|
| Automated Processing | Accounts > Remittance > Automated Processing | Active automated remittance configurations (Remittance Master, for example ARM-001 Monthly Auto Remittance): insurers, frequency. Candidates are the unremitted policies per insurer. | Execute creates draft remittances; Process submits the selected drafts for approval as one batch and notifies holders of `write:remittance` ("Remittances awaiting approval"). |
| Bulk Processing | Accounts > Remittance > Bulk Processing | A remittance file with the configuration BFM-001 (CSV) or BFM-002 (XLSX): PolicyNo, Premium, Commission, InsuredName. | Upload / Validate lists every row error (policy not found, premium not positive, commission above premium, duplicate policy); Process creates draft remittances from the valid rows. |
| Scheduling | Accounts > Remittance > Scheduling | Remittance schedules: insurers to remit, cut-off days, frequency and next run date. | No timer of its own: the job `remittance-schedules` (Master > Schedules, daily, disabled until switched on) runs the due schedules. Run Now runs one at once. Pause and resume. |
| Approval | Accounts > Remittance > Approval Workflow | Submitted remittances | Approve or reject (the approver must not be the submitter); the initiator is notified. |
| Statements | Accounts > Remittance > Statements | Period and insurers | CSV statement, optionally e-mailed as a link. |

> The remittance schedules on Accounts > Remittance > Scheduling run only through the job `remittance-schedules` on Master > Schedules, delivered switched off. Until it is switched on, run them with Run Now or execute Automated Processing on the agreed day.

## Month-end close run

**Menu:** Accounts > Period End > Month-End Close. **Permissions:** `write:period-end` to prepare; `approve:period-end` (Accounting Manager) to approve.

1. **Start** the close of a period. One open run per period; the checklist is copied into the run (MEC number).
2. **Execute** the steps: accruals, recurring journals, unearned commission deferral, FX revaluation, checks. Executing again first reverses the run's own earlier accrual, deferral and FX journals, so a rerun gives the same ledger as one run.
3. **Review the checklist.** Automatic checks: no unposted or pending journals (blocking), trial balance balances (blocking), suspense account cleared (blocking), no unapplied receipts, bank transactions reconciled, sub-ledgers tie out to the GL, issued policies are billed, remittances to insurers paid, direct-bill commission billed (warnings). Manual sign-offs: bank reconciliations reviewed and signed off (blocking), prepayments and depreciation reviewed, payroll and statutory contributions booked (warnings). Checklist items are maintained on Master > Finance > Close Checklist.
4. **Sign** the manual items.
5. **Submit** with the target soft-closed or closed. When `accounting.period_close_requires_approval` is on (default) the run waits for approval; otherwise the period closes at once.
6. **Approve** (a different user with `approve:period-end`) or **Reject** with a reason. Approval closes the period.
7. **Cancel** an unfinished run if needed; its accrual, deferral and FX journals are reversed.

The Month-End Close Status report shows every period with its run, failed checks, warnings, journals and who prepared and approved it.

The year-end close (Accounts > Period End > Year-End Close) needs all twelve periods closed and period 13 open. It posts the closing entries in period 13, writes the opening balances of the next year, locks the year and creates the next fiscal year.

## Recurring journals

Templates are kept on Accounts > Period End > Recurring Journals (RJV number): name, kind (recurring or accrual), frequency (monthly, quarterly, yearly), start, next run and end dates, auto-post, auto-reverse, lines. They are posted by the Recurring journals job, by Run due on the same screen, or by the accruals and recurring steps of the month-end close run. See the job description above for idempotency.

## Bank statement import and auto-match

**Menu:** Accounts > Bank Reconciliation > Reconciliation Workspace > Import statement. **Permission:** `write:bank-reconciliation`.

| Item | Detail |
|---|---|
| Input | The bank's statement file (CSV or XLSX) with its format: BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE for those banks' exports, GENERIC (template `Bank_Statement_Generic_Upload_Template.xlsx`) for others. Formats are kept on Master > Finance > Bank Statement Formats. Also: bank account, statement reference, opening and closing balance. |
| Preview | Shows the lines, the totals, the balance check and possible duplicates before saving. |
| Validation | Refused as a whole when a row cannot be read, when the statement does not balance (opening + credits - debits = closing) while `bank_reconciliation.require_balanced_statement` is on, or when the same file was already imported for the account. Duplicate lines can be skipped. Lines whose text starts with total, balance forward, beginning or ending balance are ignored. |
| Output | A bank statement (BST number) with its lines; then automatic matching when `bank_reconciliation.auto_match_on_import` is on. The message says how many lines were imported and auto-matched. |
| After | Match the rest by hand, book bank charges, interest and direct credits as adjustments, prepare the reconciliation (BRC number) and have it approved. |

A statement can also be entered by hand (Manual statement), with the same checks.

## Insurer statement import

**Menu:** Accounts > Insurer Reconciliation > Insurer Statements. **Permissions:** `write:remittance` to import and resolve; `approve:insurer-reconciliation` to approve.

| Item | Detail |
|---|---|
| Input | The insurer's statement (CSV or XLSX): premium remittance confirmation or commission statement, with the insurer's format (Master > Finance > Insurer Statement Formats) or the generic one; insurer, type, period, the insurer's reference and the amount tolerance (`insurer_reconciliation.amount_tolerance`). |
| Preview | Lines, totals and rows that cannot be read; nothing is saved. |
| Validation | A row that cannot be read stops the import; the same file cannot be imported twice for an insurer. |
| Auto-match | By policy number (ignoring case, spaces and dashes) to a remittance line or commission debit note line; otherwise on gross premium within the tolerance and insured name when exactly one record fits. Premium, commission, taxes and amount paid are compared within the tolerance. |
| Output | An insurer statement (ISR number) with matches and differences: lines not found at the broker, broker records missing on the statement, amount differences. |
| Resolution | Each difference is resolved with a note or an adjustment; submit (all resolved when `insurer_reconciliation.require_resolved`); a second user approves and the adjustments post through the posting rule `insurer_statement.adjustment`. The differences report downloads as Excel, CSV or PDF. |

# Operational run book

The run book lists what happens on its own and what the team checks or starts. Times are Asia/Manila.

## Overnight and early morning (automatic)

| Time | Job | Depends on |
|---|---|---|
| Every minute | Renewal notice queue | |
| Every 2 minutes | Integration outbox | Connectors enabled and live |
| Every 5 minutes | E-mail outbox | `notification.email_enabled`, SMTP |
| Every 15 minutes | My Work reminders; EIS outbox, screening provider retry and scheduled campaigns (if switched on) | `eis.enabled`; screening provider; campaigns scheduled |
| Hourly at :15 | Breach notification deadlines (compliance package) | Breaches logged |
| 00:15 | Policy expiry | |
| 00:30 | Quotation expiry | |
| 00:30, day 1 | Accrual auto-reversal (if switched on) | Month-end close run of the previous month |
| 01:15 | Recurring journals (if switched on) | Open period for the journal date |
| 01:45 | Dormant accounts | |
| 02:00 | Period auto soft-close and BI extract (if switched on) | Blocking checks pass; storage folder |
| 02:45 | Housekeeping | |
| 05:00 | Daily reports | |
| 05:30 | Renewal pipeline | Policy expiry has run |
| 05:45 | Bank auto-match (if switched on) | Statements imported |
| 06:00 | Renewal notices (in-app) | Renewal pipeline |
| 06:15 | Remittance schedules (if switched on) | Collected premium up to the cut-off date |
| 06:20 | Cover note expiry | |
| 06:25 | Post-dated cheques due | |
| 06:30 | AML transaction monitoring | Receipts and payments of the last 3 days posted |
| 06:35 | Missing claim documents | E-mail outbox for delivery |
| 06:45 | Compliance reminders (compliance package) | Licence register and insurer certificates entered |
| 07:00 | Receivable ageing; overdue data subject requests (if switched on); KYC refresh due (Mondays) | |
| 07:30 | Prospects not worked in time (if switched on) | Assignment rules |
| 08:00 | Collection reminders; month-end reminder (if switched on); complaint deadlines (compliance package) | E-mail outbox for delivery |
| 08:10, 08:20 | SMS renewal notices, SMS payment reminders (if switched on) | SMS connector live; integration outbox |

## Daily checklist

1. **Master > Schedules:** every enabled job shows Last status success and a Next run. Open Run history for any failure and rerun after fixing (Support runbook by job).
2. **Master > E-mail Outbox:** no growing queue; resolve failed e-mails (wrong address, SMTP) and Retry.
3. **Master > System Configuration > Integrations:** Failed and Waiting per connector; nothing in Retry scheduled for more than an hour; failed inbound messages.
4. **Operations > Renewals > Renewal Batch:** batches in Processing have moved on; Retry Failed where needed. Send the day's notices from the Renewal Queue.
5. **Accounts > Receipts and Collections:** post receipts; review overdue items after the 08:00 reminders; deposit the post-dated cheques due.
6. **Accounts > Bank Reconciliation:** import yesterday's statements; review the auto-matches and match the rest.
7. **Accounts > Remittance:** run Automated Processing or Bulk Processing on the agreed days; approve submitted remittances.
8. **Accounts > Tax > E-Invoicing (EIS)** (when switched on): no failed or rejected submission left without action.
9. **Compliance:** the compliance officer works the new transaction alerts and screening hits; the compliance team reads the licence, complaint and breach reminders (compliance package).

## Switching jobs on at go-live

| Job | Switch on when | Who decides |
|---|---|---|
| `sms-renewal-notices`, `sms-payment-reminders` | The SMS connector is Live and the templates are approved | Operations head |
| `eis-outbox` | The broker is enrolled with the EIS and `eis.enabled` is on | Accounting Manager with the tax adviser |
| `aml-provider-retry` | A commercial screening provider is contracted and set to Provider API | Compliance officer |
| `lead-assignment-sla` | Assignment rules are set up | Sales head |
| `campaign-dispatch` | Campaigns will be scheduled rather than sent with Send now | Marketing |
| `bi-extract` | The BI tool reads the storage folder | BI owner |
| `privacy-requests-due` | The privacy team uses Data Subject Requests | DPO |
| `remittance-schedules`, finance jobs | The finance team chooses the job over the screens | Accounting Manager |

The jobs delivered switched on (including AML transaction monitoring, KYC refresh due, My Work reminders and the three compliance package jobs) stay on. Switching off `privacy-breach-deadlines`, `compliance-reminders` or `aml-transaction-monitoring` needs the written agreement of the DPO or the compliance officer, recorded in the change.

## Month-end sequence

| Day | Step | Where |
|---|---|---|
| Last 3 days of the month | Month-end reminder (if on) prompts finance; post pending journals, receipts and vouchers dated in the month. | Notifications; Accounts |
| Last day | Import the bank statements up to the month end; match; book bank charges and interest. | Accounts > Bank Reconciliation |
| Day 1 to 3 | Prepare and approve the bank reconciliation of each account for the month (the close needs the sign-off). | Accounts > Bank Reconciliation > Reconciliations |
| Day 1 to 3 | Import and reconcile the insurer statements; approve adjustments. | Accounts > Insurer Reconciliation |
| Day 1 to 3 | Run due recurring journals (if the job is off). | Accounts > Period End > Recurring Journals |
| Day 1 to 5 | Raise commission debit notes for unbilled direct-bill commission; generate remittances due to insurers. | Accounts > Remittance |
| Day 3 to 5 | Start the month-end close run, execute, review checks, sign, submit; manager approves. | Accounts > Period End > Month-End Close |
| After approval | Run Trial Balance (Opening / Movement / Closing), Income Statement, Balance Sheet, Month-End Close Status. | Reports > Financial Reports |
| Day 1 of next month | Accrual auto-reversal (job if on, otherwise it runs when a run is executed and the reversals are due). | Master > Schedules |
| Monthly / quarterly | VAT Summary, SLSP, QAP, SAWT and BIR Form 2307 for the BIR returns; 0619-E by day `bir.withholding_due_day` (10) of the next month, 1601-EQ and 2551Q after the quarter, with Record filing after payment; BIR DAT files validated with the BIR module before submission. | Accounts > Tax > Withholding Returns, BIR DAT Files |
| Monthly | Print the CAS books of the month (General Journal, General Ledger, Cash Receipts, Cash Disbursements, Sales, Purchase), in month order. | Accounts > Tax > CAS Books and Documents |
| Within 5 working days of a covered transaction | Generate, file and record the CTR file (`aml.ctr_due_working_days`). | Compliance > AMLC Reports |
| Yearly (January to March) | 1604-E with the alphalist and DAT file; IC annual statement workbook and IC production report for the accountant (compliance package). | Accounts > Tax > Annual Alphalist 1604-E; Compliance > Insurance Commission |
| Month end + grace (5 days) | Period auto soft-close (if on) soft-closes periods whose checks pass. | Master > Schedules |

# Gaps and observations

| No. | Observation | Suggested action |
|---|---|---|
| 1 | No alert when a scheduled job fails; failures are visible only on Master > Schedules and in the server log. | Add an alert on the log line or a notification on failure; meanwhile check the screen daily. |
| 2 | Job parameters (`daysBefore`, `graceDays`, `reports`) can only be changed through the API, though the period-end notes refer to Master > Schedules. | Add a parameters field to the Edit dialog. |
| 3 | The Renewal notices job only reaches policies expiring exactly 60, 30 or 15 days ahead; a missed day is not caught up. The job creates in-app reminders only. | Run the Renewal Queue daily; consider a window instead of an exact day. |
| 4 | The Receivable ageing job description says it notifies collections; it does not. | Correct the description or add the notification. |
| 5 | Quotation expiry counts from the creation date, not from Valid Until. | Decide which rule the broker wants. |
| 6 | Report schedules have no screen (API only). | See the Reports Book. |
| 7 | Missed runs during downtime are not caught up by the scheduler. | After an outage, use Run now for the daily jobs of the missed day; for AML transaction monitoring use Run monitoring with the missed dates. |

Closed since the first issue of this document: housekeeping now purges the integration outbox, attempts and inbox, the EIS submissions, the AML provider requests and the go-live workbook rows (settings `housekeeping.*`); an EIS submission left in sending is retried after `eis.sending_stale_minutes`; the user manual names the Schedules screen as Master > Schedules.
