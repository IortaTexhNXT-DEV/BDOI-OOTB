# Introduction

## Purpose and scope

This document describes how BrokerVerse data grows, which housekeeping the system performs today, the recommended retention periods and housekeeping jobs, the approach to archiving old records out of the online database, how archived data is restored on request, and how the sample-data purge script is used before go-live.

> **Recommended / to be confirmed by the business and DevOps:** Retention periods in this document are proposals. They must be confirmed by the compliance officer against the regulations that apply to the broker, in particular the record-keeping rules of the Bureau of Internal Revenue (BIR) and the Insurance Commission (IC), and the Data Privacy Act of 2012 (personal data kept no longer than necessary for the declared purposes). This document gives the regulatory context in general terms only; it is not legal advice.

# What grows

{widths: 22,22,56}
| Data | Growth driver | Current handling in the baseline |
|---|---|---|
| Business and financial records (leads to journals, 60+ tables) | Every quotation, policy, receipt, voucher, claim | Kept indefinitely; financial documents are cancelled or reversed, not deleted; draft quotations can be deleted; leads and quotations have `deleted_at` |
| `audit_log` | Every change, sign-in related event, job run started by a user, report generation | No purge; no date index |
| `login_history` | Every password, two-factor and refresh attempt | No purge |
| `job_runs` | About 1,735 rows a day: `renewal-queue` every minute (1,440), `email-outbox` every 5 minutes (288), 7 daily jobs | No purge; queried on every scheduled run |
| `notifications` | Reminders, approvals, renewal and collection notices | Deleted only when a user deletes them in the bell menu |
| `email_outbox` | Every e-mail (full HTML body kept) | No purge; sent and failed messages stay |
| `refresh_tokens` | Every sign-in and every refresh (rotation) | No purge of expired or revoked rows |
| `password_resets` | Forgot-password requests | No purge (codes expire after `security.reset_code_minutes`) |
| `password_history` | Password changes | Trimmed to the last `security.password_history_count` (5) per user by `lib/password.js` |
| `generated_reports` and report files | Scheduled daily reports (3 a day) and user-generated reports | Rows and files older than `reports.retention_days` (90) deleted by the `daily-reports` job (only when it runs on its schedule) |
| Uploaded files (`UPLOAD_DIR`) | Documents, photos, statements, bordereaux, exports | No lifecycle; deleted only through the delete endpoint (uploader, module writer or administrator) |
| `job_queue` | Renewal batch notices | Items stay after completion |
| Status housekeeping | Policies past expiry, quotations past validity, renewals past grace | Jobs `policy-expiry`, `quote-expiry`, `renewal-pipeline` change the status (no deletion) |

On the local test database the largest tables are already log and operational tables: `job_runs`, `audit_log`, `login_history` and `refresh_tokens` (row counts in document 03), after only a few days of scheduler operation and test runs.

> **Gap:** Apart from generated reports and password history, the system has no retention or purge job. `job_runs` grows by about 630,000 rows a year and is scanned by the scheduler without a suitable index; `email_outbox` keeps every e-mail body including personal data; `refresh_tokens`, `login_history`, `notifications` and `audit_log` grow without limit. Recommended housekeeping jobs are listed in chapter 4.

> **Note:** The local upload folder of the development system holds 823 files (4.9 MB) while its `documents` table lists 24 (the folder is shared with test runs and resets). In production, files without a database record (orphans) can arise from failed uploads (a key is reserved before the file is written) and from restores; a reconciliation job is recommended (chapter 4).

# Retention policy

## Regulatory context

- **BIR:** books of accounts and their supporting documents (official receipts, invoices, vouchers, journals, withholding tax certificates such as BIR Form 2307) must be preserved for the period set by the revenue regulations, currently up to ten years from the date of the last entry (Revenue Regulations No. 17-2013 as amended), and be available for examination.
- **Insurance Commission:** insurance brokers must keep complete records of the business transacted (policies placed, premiums received and remitted, commissions) available for examination, for the period required by the Insurance Code and IC circulars.
- **Data Privacy Act of 2012 (Republic Act 10173):** personal data of leads, clients and claimants may be kept only as long as necessary for the purpose or as required by law, then disposed of securely; access and retention must be documented.

## Recommended retention periods

{widths: 24,30,24,22}
| Class / data (Recommended / to be confirmed by compliance) | Tables | Online (PostgreSQL) | Total, incl. archive |
|---|---|---|---|
| Financial records | receivables, receipts and lines / applications, journal vouchers and lines, entry matches, disbursements, invoice lists, cheques, petty cash, commissions, remittances and items, debit notes and collections, direct-bill items, reinsurance recoveries and reconciliations, incentive calculations and results, policy payments | Current year + 2 closed years | 10 years after the end of the financial year |
| Policy and claim records | clients, quotations (converted), policies, endorsements, claims with history, renewals, cessions, treaties, bordereaux, documents | Life of the policy / claim + 2 years | 10 years after policy expiry or claim closure |
| Leads and quotations not converted | leads, quotes (not converted), renewal quotes, win-back campaigns | 2 years | 3 years, then anonymise or delete (privacy) |
| Audit trail | audit_log, claim_field_changes, claim_history, collection_actions, renewal_activities, renewal_notices, remittance_approvals | 2 years | 10 years (supports financial records) |
| Security logs | login_history, password_resets | 1 year | 2 years |
| Operational logs | job_runs | 90 days | 1 year (aggregated) |
| Temporary data | refresh_tokens (expired or revoked), email_outbox (sent), notifications (read), job_queue (done), generated_reports | 30 to 90 days | Same (no archive) |
| Reference and configuration | settings, masters, product templates, roles, report catalogue | While in use | Versions kept via audit log |
| Uploaded files | EFS `UPLOAD_DIR` | As the owning record | As the owning record |

# Housekeeping

## Existing jobs

{widths: 24,20,56}
| Job | Schedule | Housekeeping effect |
|---|---|---|
| `daily-reports` | 05:00 (cron, UTC) | Generates the daily reports and deletes generated reports and their files older than `reports.retention_days` |
| `policy-expiry` | 00:15 | Status `expired` for policies past expiry |
| `quote-expiry` | 00:30 | Status `expired` for quotations older than `limits.quote_validity_days` |
| `renewal-pipeline` | 05:30 | Lapses renewals past `renewals.grace_period_days` |
| Password change | on change | Keeps only the last N password hashes |

## Recommended housekeeping jobs

> **Recommended / to be confirmed by the business and DevOps:** Add a `housekeeping` handler to `backend/src/jobs/handlers.js` and a row to `backend/src/db/seeds/jobs.json` (for example daily at 02:30 Manila time), with retention periods as new settings in a `retention` group so the business can change them. Delete in batches (for example 5,000 rows per statement) to keep transactions short; record the counts in the job output.

{widths: 28,40,32}
| Task | Rule | New setting (proposed) |
|---|---|---|
| Job run history | Delete `job_runs` older than 90 days (keep failed runs 1 year) | `retention.job_runs_days` = 90 |
| E-mail outbox | Delete `sent` rows older than 90 days; `failed` older than 1 year | `retention.email_outbox_days` = 90 |
| Refresh tokens | Delete rows expired or revoked more than 30 days ago | `retention.refresh_tokens_days` = 30 |
| Password reset codes | Delete used or expired codes older than 30 days | `retention.password_resets_days` = 30 |
| Notifications | Delete read notifications older than 180 days, unread older than 1 year | `retention.notifications_days` = 180 |
| Job queue | Delete completed items older than 30 days | `retention.job_queue_days` = 30 |
| Sign-in history | Archive then delete `login_history` older than 1 year | `retention.login_history_days` = 365 |
| Audit log | Archive then delete `audit_log` older than 2 years (after the archive is verified) | `retention.audit_log_days` = 730 |
| Orphan files | Report (do not delete automatically) files in `UPLOAD_DIR` without a `documents` / `generated_reports` row, and rows without a file | none; weekly report |

Supporting indexes (document 03): `job_runs (job_id, started_at)`, `email_outbox (status, created_at)`, `audit_log (at)`, `refresh_tokens (expires_at)`.

# Archival

## Approach

![Data lifecycle: online, archive, purge (recommended)](d10_data_lifecycle)

{widths: 24,76}
| Stage | Approach (Recommended / to be confirmed by the business and DevOps) |
|---|---|
| Online | Operational data stays in the main tables for the online period above; reports and screens work unchanged. |
| Archive in the database | For the high-volume log tables (`audit_log`, `login_history`, later `journal_lines`), convert to tables partitioned by year (declarative partitioning on `at` / `jv_date`) when the volume justifies it (for example above 10 million rows); old partitions can then be detached, exported and dropped in seconds without long deletes. Until then, move rows older than the online period into `archive.<table>` tables with the same structure in a separate schema, in batches. |
| Cold archive | Once a year, after the financial year is closed and audited: export the closed year (per table, filtered by date or by the policy / financial year) with `COPY ... TO` as CSV or Parquet, or as a `pg_dump -Fc` of the archive schema, to an S3 bucket with Object Lock (compliance mode) and lifecycle to S3 Glacier Deep Archive; record a manifest (tables, row counts, checksums, date range, migration level `schema_migrations`). Files of the archived records are copied from EFS to the same bucket under their storage keys. |
| Purge | Only after the export is verified (row counts and checksums) and approved by the data owner: delete the archived rows from the online database; record the purge in `audit_log`. Financial records are purged only after the statutory period. |
| Referential integrity | Archive whole business units together (a policy with its quotation, bills, receipts, journals, commissions, claims and documents) or keep the referenced parent rows online; foreign keys (`NO ACTION`) prevent deleting a parent that is still referenced. |

The yearly document-number counters (`sequences(name, period)`) stay online; old periods are small.

## Restoration from archive

1. The data owner requests the records (for example a policy file of a given year for an audit or a claim dispute); the request is approved and logged.
2. DevOps restores the archive object from Glacier (standard retrieval up to 12 hours, bulk up to 48 hours for Deep Archive).
3. The data is loaded into a separate restore database (never into production): `pg_restore` of the archive dump, or `CREATE TABLE ... ; COPY ... FROM` of the CSV / Parquet files, at the migration level recorded in the manifest.
4. Read access is given to the requester through a read-only database login or a report extract; the files are provided from the restored S3 objects.
5. The restore database is deleted after the purpose is fulfilled; the access is recorded.

If records must be brought back into production (for example a reopened claim), load them with the same ids after a review of the dependent rows; ids are random text or serial values and do not collide with new records, and the document-number counters are not affected.

# Sample-data purge before go-live

`backend/scripts/purge-sample-data.js` (`npm run purge:sample`) removes demo data from a database that was started with `SEED_SAMPLE_DATA` on (for example a UAT database promoted to production). It is a one-off go-live tool, not a housekeeping job.

{widths: 24,76}
| Aspect | Behaviour |
|---|---|
| Safety | Refuses to run without `CONFIRM_PURGE=yes`; dry run by default (row counts per table); `--execute` (alias `--no-dry-run`) deletes, in one transaction (any error rolls everything back). Stop the API instances first. |
| Removes | All rows of the transaction tables (leads to journals, claims, renewals, notifications, documents and generated-report records, job history, e-mail outbox, document-number counters), the sample master rows by natural key (fictional insurers, demo branches, signatories, referrers, reinsurers, incentive programmes, demo master records) and the sample users (`agent.*`, `fin.approver`). With `--keep-users=a,b`, every user except `BrokerVerse` and those listed. |
| Keeps | Reference data (settings, roles, permissions, scheduled jobs, masters, chart of accounts, product templates, report catalogue) and the audit trail (the purge is recorded in it); `--purge-audit` also empties `audit_log` and `login_history`. |
| Files | Uploaded files of removed records stay in `UPLOAD_DIR`; clear the directory if nothing real was uploaded. |
| Afterwards | Set `SEED_SAMPLE_DATA=false` (or remove it) before starting the API, otherwise the sample data is seeded again. |

Procedure: take a snapshot; stop the API; `CONFIRM_PURGE=yes npm run purge:sample` (review the counts); `CONFIRM_PURGE=yes npm run purge:sample -- --execute [--keep-users=...]`; set `SEED_SAMPLE_DATA=false`; start the API; check that Leads, Clients and Policies are empty.

> **Gap:** `docs/GO_LIVE_CHECKLIST.md` section 7 shows `CONFIRM_PURGE=yes npm run purge:sample -- --apply` and a dry run without `CONFIRM_PURGE`; the script rejects `--apply` ("unknown option", it accepts `--execute` or `--no-dry-run`) and refuses any run, including the dry run, without `CONFIRM_PURGE=yes`. `docs/DEPLOY.md` shows the correct commands. Correct the checklist.
