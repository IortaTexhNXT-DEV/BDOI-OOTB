# Introduction

## Purpose and scope

This document describes how BrokerVerse OOTB data grows, the housekeeping the system performs, the recommended retention periods, the approach to archiving old records out of the online database, how archived data is restored on request, and how the sample-data purge script is used before go-live.

> **Recommended / to be confirmed by the business and DevOps:** Retention periods in this document are proposals. The compliance officer must confirm them against the rules that apply to the broker, in particular the record-keeping rules of the Bureau of Internal Revenue (BIR) and the Insurance Commission (IC), and the Data Privacy Act of 2012 (personal data kept no longer than needed for the declared purposes). This document gives the regulatory context in general terms only; it is not legal advice.

# What grows

{widths: 22,22,56}
| Data | Growth driver | Handling in the baseline |
|---|---|---|
| Business and financial records (about 190 tables: leads to journals, placement, period end, bank reconciliation, payables, fixed assets, BIR filings and invoices, AML records, compliance registers) | Every quotation, policy, receipt, voucher, claim, statement line | Kept indefinitely; financial documents are cancelled or reversed, not deleted; draft quotations can be deleted; leads, quotations and bank statements have `deleted_at` |
| `audit_log` | Every change, sign-in related event, job run started by a user, report generation | Kept; purged only if `housekeeping.audit_log_days` is set, never below seven years |
| `login_history` | Every password, two-factor and refresh attempt | Purged by housekeeping after 365 days |
| `job_runs` | About 2,550 rows a day with the jobs enabled by default: `renewal-queue` every minute (1,440), `integration-outbox` every 2 minutes (720), `email-outbox` every 5 minutes (288), `my-work-reminders` every 15 minutes (96) and the daily jobs | Purged by housekeeping after 90 days |
| `notifications` | Reminders, approvals, renewal and collection notices | Read notifications purged after 180 days; users can delete them in the bell menu |
| `email_outbox` | Every e-mail (full HTML body kept) | Sent messages purged after 180 days, failed ones after 730 days |
| `refresh_tokens` | Every sign-in and every refresh (rotation) | Expired or revoked rows purged 30 days after expiry or revocation |
| `password_resets` | Forgot-password requests | Used or expired codes purged after 7 days |
| `password_history` | Password changes | Trimmed to the last `security.password_history_count` (5) per user by `lib/password.js` |
| `job_queue` | Renewal batch notices | Completed items purged after 30 days |
| `generated_reports` and report files | Scheduled daily reports and user-generated reports | Rows and files older than `reports.retention_days` (90) deleted by the `daily-reports` job |
| Uploaded files (`UPLOAD_DIR`) | Documents, photos, statements, bordereaux, exports | No lifecycle; deleted only through the delete endpoint (uploader, module writer or administrator) |
| `integration_outbox`, `integration_attempts`, `integration_inbox` | Every SMS, Viber, CTPL, insurer and bank file message and each attempt | Not purged (Gap) |
| `eis_submissions`, `aml_provider_requests` | Every sales invoice sent to the BIR EIS; screening provider requests | Not purged (Gap); AML records kept for `aml.record_retention_years` |
| `data_load_rows` | Every row of every uploaded go-live workbook | Not purged (Gap); needed only until the load is reconciled |
| Status housekeeping | Policies past expiry, quotations past validity, renewals past grace | Jobs `policy-expiry`, `quote-expiry`, `renewal-pipeline` change the status (no deletion) |

> **Note:** In production, files without a database record (orphans) can arise from failed uploads (a key is reserved before the file is written) and from restores done at different times for the database and the files. A periodic reconciliation report is recommended (chapter 4).

# Retention policy

## Regulatory context

- **BIR:** books of accounts and their supporting documents (official receipts, invoices, vouchers, journals, withholding tax certificates such as BIR Form 2307) must be kept for the period set by the revenue regulations, currently up to ten years from the date of the last entry (Revenue Regulations No. 17-2013 as amended), and be available for examination.
- **Insurance Commission:** insurance brokers must keep complete records of the business transacted (policies placed, premiums received and remitted, commissions) available for examination, for the period required by the Insurance Code and IC circulars.
- **Data Privacy Act of 2012 (Republic Act 10173):** personal data of leads, clients and claimants may be kept only as long as needed for the purpose or as required by law, then disposed of securely; access and retention must be documented.

## Recommended retention periods

{widths: 24,30,24,22}
| Class / data (Recommended / to be confirmed by compliance) | Tables | Online (PostgreSQL) | Total, incl. archive |
|---|---|---|---|
| Financial records | receivables and credits, receipts and applications, journal vouchers and lines, entry matches, disbursements, invoice lists, cheques, petty cash, commissions and adjustments, remittances, allocations and refunds, debit notes and collections, direct-bill items, claim settlement cash, bank statements, matches and reconciliations, close runs, year-end runs, opening balances, BIR 2307 certificates, reinsurance recoveries and reconciliations, incentive calculations and results, policy payments | Current year + 2 closed years | 10 years after the end of the financial year |
| Policy and claim records | clients, quotations (converted), broker slips, offers, placements, co-insurance participants, policies, endorsements, claims with history, renewals, cessions, treaties, bordereaux, documents | Life of the policy or claim + 2 years | 10 years after policy expiry or claim closure |
| Leads and quotations not converted | leads, quotes (not converted), broker slips without placement, renewal quotes, win-back campaigns | 2 years | 3 years, then anonymise or delete (privacy) |
| Audit trail | audit_log, claim_field_changes, claim_history, collection_actions, renewal_activities, renewal_notices, remittance_approvals, period_status_history, bank_reconciliation_history | 2 years | 10 years (supports the financial records) |
| Security logs | login_history, password_resets | 1 year | 2 years |
| Operational logs | job_runs | 90 days | 1 year (aggregated) |
| Temporary data | refresh_tokens (expired or revoked), email_outbox (sent), notifications (read), job_queue (done), generated_reports | 30 to 180 days | Same (no archive) |
| Reference and configuration | settings, masters, posting rules, number series, tax codes, product templates, roles, report catalogue | While in use | Versions kept through the audit log |
| Uploaded files | `UPLOAD_DIR` | As the owning record | As the owning record |

# Housekeeping

## Housekeeping job

The scheduled job `housekeeping` (daily at 02:45 Manila time, `jobs/housekeeping.js`) deletes operational rows past their retention period. Each period is a setting in System Settings > Housekeeping (days; 0 keeps the rows forever). Deletes run in batches of 5,000 rows so a large backlog never holds long locks, and the job output lists the rows deleted per table and the tables kept.

{widths: 30,34,12,24}
| Setting | Rule | Default days | Supporting index |
|---|---|---|---|
| `housekeeping.job_runs_days` | `job_runs` started before the cut-off | 90 | `job_runs (job_id, started_at)` |
| `housekeeping.email_outbox_sent_days` | `email_outbox` with status `sent` | 180 | `email_outbox (status, created_at)` |
| `housekeeping.email_outbox_failed_days` | `email_outbox` with status `failed` | 730 | `email_outbox (status, created_at)` |
| `housekeeping.login_history_days` | `login_history` | 365 | `login_history (at DESC)` |
| `housekeeping.refresh_tokens_days` | `refresh_tokens` expired or revoked before the cut-off | 30 | primary key and user index |
| `housekeeping.password_resets_days` | `password_resets` used or expired before the cut-off | 7 | primary key |
| `housekeeping.notifications_read_days` | read `notifications` | 180 | `notifications (user_id, is_read, created_at)` |
| `housekeeping.job_queue_done_days` | `job_queue` items with status `completed` | 30 | primary key |
| `housekeeping.audit_log_days` | `audit_log` older than the cut-off, never less than 2,557 days (seven years) | 0 (kept) | `audit_log (at)` |

## Other housekeeping

{widths: 24,20,56}
| Job or rule | Schedule (Manila time) | Effect |
|---|---|---|
| `daily-reports` | 05:00 | Generates the daily reports and deletes generated reports and their files older than `reports.retention_days` |
| `policy-expiry` | 00:15 | Status `expired` for policies past expiry |
| `quote-expiry` | 00:30 | Status `expired` for quotations older than `limits.quote_validity_days` |
| `renewal-pipeline` | 05:30 | Lapses renewals past `renewals.grace_period_days` |
| `cover-note-expiry` | 06:20 | Status `expired` for cover notes past their validity |
| Data subject request, anonymisation | on request | Personal data of a client or prospect anonymised once `privacy.retention_years` has passed (Master > Data Privacy) |
| Transaction reset | before go-live | `npm run reset:transactions` removes the smoke-test records; refused once `golive.locked` is on |
| Password change | on change | Keeps only the last N password hashes |

## Recommended additions

> **Gap:** Housekeeping has no retention rule yet for the integration outbox, attempts and inbox, the EIS outbox, the screening provider requests and the go-live workbook rows. **Recommended:** 180 days for sent messages and attempts, 730 days for failed ones, 90 days for workbook rows after the load is reconciled.

> **Recommended / to be confirmed by the business and DevOps:** Archive `login_history` and, once the compliance period is agreed, `audit_log` before housekeeping deletes them (chapter 5). Add a weekly report of files in `UPLOAD_DIR` without a `documents` or `generated_reports` row, and of rows whose file is missing; do not delete automatically.

# Archival

## Approach

![Data lifecycle: online, archive, purge (recommended)](d10_data_lifecycle)

{widths: 24,76}
| Stage | Approach (Recommended / to be confirmed by the business and DevOps) |
|---|---|
| Online | Operational data stays in the main tables for the online period above; reports and screens work unchanged. |
| Archive in the database | For the high-volume tables (`audit_log`, `login_history`, later `journal_lines` and `bank_statement_lines`), convert to tables partitioned by year (declarative partitioning on `at` or `jv_date`) when the volume justifies it (for example above 10 million rows); old partitions can then be detached, exported and dropped in seconds without long deletes. Until then, move rows older than the online period into `archive.<table>` tables with the same structure in a separate schema, in batches. |
| Cold archive | Once a year, after the financial year is closed (year-end run) and audited: export the closed year (per table, filtered by date or by policy or financial year) with `COPY ... TO` as CSV or Parquet, or as a `pg_dump -Fc` of the archive schema, to an S3 bucket with Object Lock (compliance mode) and a lifecycle to S3 Glacier Deep Archive. Record a manifest (tables, row counts, checksums, date range, migration level from `schema_migrations`). Copy the files of the archived records from the file store to the same bucket under their storage keys. |
| Purge | Only after the export is verified (row counts and checksums) and approved by the data owner: delete the archived rows from the online database and record the purge in `audit_log`. Financial records are purged only after the statutory period. |
| Referential integrity | Archive whole business units together (a policy with its quotation, placement, bills, receipts, journals, commissions, claims and documents) or keep the referenced parent rows online; foreign keys (`NO ACTION`) prevent deleting a parent that is still referenced. Opening balances of later years keep the ledger totals correct after old journals are archived. |

The document-number counters (`sequences`) stay online; old periods are small.

## Restoration from archive

1. The data owner requests the records (for example a policy file of a given year for an audit or a claim dispute); the request is approved and logged.
2. DevOps restores the archive object from Glacier (standard retrieval up to 12 hours, bulk up to 48 hours for Deep Archive).
3. The data is loaded into a separate restore database, never into production: `pg_restore` of the archive dump, or `CREATE TABLE` and `COPY ... FROM` of the CSV or Parquet files, at the migration level recorded in the manifest.
4. The requester gets read access through a read-only database login or a report extract; the files come from the restored S3 objects.
5. The restore database is deleted once the purpose is fulfilled; the access is recorded.

If records must come back into production (for example a reopened claim), load them with the same ids after a review of the dependent rows. Ids are random text or serial values and do not collide with new records, and the document-number counters are not affected.

# Sample-data purge before go-live

`backend/scripts/purge-sample-data.js` (`npm run purge:sample`) removes demo data from a database that was started with `SEED_SAMPLE_DATA` on (for example a UAT database promoted to production). It is a one-off go-live tool, not a housekeeping job.

{widths: 24,76}
| Aspect | Behaviour |
|---|---|
| Safety | Refuses to run without `CONFIRM_PURGE=yes`; dry run by default (row counts per table); `--execute` deletes, in one transaction (any error rolls everything back). Stop the API instances first. |
| Removes | All rows of the transaction tables (leads to journals, broker slips, offers, placements and co-insurance participants, claims, renewals, fiscal years, opening balances, close runs, recurring journals, bank statements and reconciliations, BIR 2307 certificates, notifications, documents and generated-report records, job history, e-mail outbox, document-number counters), the sample master rows by natural key (fictional insurers, demo branches, signatories, referrers, reinsurers, incentive programmes, demo master records such as bank accounts and commission rates) and the six sample users. With `--keep-users=a,b`, every user except `BrokerVerse` and those listed. |
| Keeps | Reference data (settings, roles, permissions, scheduled jobs, masters, chart of accounts, posting rules, number series, tax codes, product templates, report catalogue) and the audit trail (the purge is recorded in it); `--purge-audit` also empties `audit_log` and `login_history`. |
| Files | Uploaded files of removed records stay in `UPLOAD_DIR`; clear the directory if nothing real was uploaded. |
| Afterwards | Set `SEED_SAMPLE_DATA=false` (or remove it) before starting the API, otherwise the sample data is seeded again. Then load the go-live data: masters, users, opening balances and open items (`docs/onboarding/GO_LIVE_DATA_SETUP.md` and the templates in `docs/package/05_Delivery/Upload_Templates`). |

Procedure (`deploy/README.md`, section 7): take a snapshot; stop the API; `CONFIRM_PURGE=yes npm run purge:sample` and review the counts; `CONFIRM_PURGE=yes npm run purge:sample -- --execute [--keep-users=...]`; set `SEED_SAMPLE_DATA=false`; start the API; check that Leads, Clients and Policies are empty.
