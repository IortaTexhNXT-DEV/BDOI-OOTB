# Introduction

## Purpose and scope

This document is the inventory of the BrokerVerse database: every table with its domain, purpose, key columns, row count and size, number of indexes, retention class and owning backend module, followed by the indexes, sequences, extensions, functions, triggers and the application settings by group. It supports capacity planning (document 06), backup and archival (documents 09 and 10) and data-protection reviews. The design rationale is in document 02.

## Source and currency of the figures

The inventory is generated from the catalogue of the local PostgreSQL 16 database `brokerverse` by `docs/architecture/tools/collect_db_inventory.py` (read-only catalogue queries and one `count(*)` per table) and the hand-maintained descriptions in `tools/table_catalog.py`.

> **Note:** Row counts and sizes are those of the local **test database** after the end-to-end test run and the sample seed (`SEED_SAMPLE_DATA` on). They show relative weight, not production volumes. A production database starts with reference data only. Re-run the collector against UAT or production and rebuild the documents to refresh them (see `docs/architecture/README.md`).

Size is the total relation size in KB (table, TOAST and indexes; PostgreSQL allocates at least one 8 KB page per relation and index, so small tables show 16 to 64 KB). "Idx" is the number of indexes including the primary key.

## Retention classes

{widths: 22,78}
| Class | Meaning and default handling (periods in document 10) |
|---|---|
| Financial | Financial records: ledger, bills, receipts, payments, vouchers, commissions, remittances, debit notes, reinsurance settlements. Kept for the statutory record-keeping period; never deleted from the online system while the period runs; cancelled or reversed, not deleted. |
| Transaction | Business transaction records: leads, clients, quotations, policies, endorsements, claims, renewals, treaties, cessions, documents. Kept for the policy / claim life plus the regulatory period. |
| Reference | Reference data and configuration: masters, settings, product templates, roles, permissions, report catalogue, scheduled jobs. Kept while in use; changes audited. |
| Log / audit | Audit log, sign-in history, histories and field-level trails, job run history, notice logs. Kept for the audit period, then archived. |
| Temporary | Temporary and operational data: tokens, reset codes, e-mail outbox, notifications, work queues, generated report files. Purged by housekeeping after a short period. |

# Summary

## Tables by domain

{generate: domain_summary}

## Tables with the most rows (test data)

{generate: largest_tables}

# Table inventory

Key columns: PK primary key, UK unique constraint, FK foreign-key columns (first four), JSONB document columns. Rows and KB are test data.

{generate: inventory}

# Other database objects

## Database facts

{generate: db_facts}

## Indexes

226 indexes: 102 primary keys, 59 further unique indexes, 15 partial indexes and 1 GIN index (`master_records_data_idx` on `master_records.data`). Partial indexes: `policies_billing_mode_idx` (direct-billed policies), `direct_bill_items_open_idx` (unbilled items), `refresh_tokens_user_idx` (live tokens), `clients_lead_uidx`, `renewals_open_policy_uq`, `entry_matches_debit_idx`, `entry_matches_credit_idx`, `commissions_policy_referrer_uq`, `master_records_code_uq`, `product_templates_code_uq`, `product_components_code_uq`, `remittance_approvals_open_uq`, `reinsurance_treaties_number_uq`, `cessions_number_uq`, `incentive_programs_code_uq`.

### Foreign keys without a supporting index

> **Gap:** 128 of the 174 foreign keys have no index whose first column is the foreign-key column. The table below lists them; the ones on growing transactional and log tables should be indexed (document 02, section on constraints and indexes, and document 06).

{generate: unindexed_fks}

### Log tables and their indexes

{widths: 22,40,38}
| Table | Existing indexes | Observation |
|---|---|---|
| audit_log | PK; `(entity, entity_id)` | The audit trail endpoint (`GET /api/settings/audit`) filters by entity, entity id or username and returns at most 1,000 rows, newest first; it has no date filter. A filter by username and any time-based review or purge scan the whole table. Recommended: index `(at)` and `(username, at)`, and a date-range filter for audit reviews. |
| login_history | PK; `(user_id, at DESC)`; `(at DESC)` | Adequate. |
| notifications | PK; `(user_id, is_read, created_at DESC)` | Adequate for the per-user bell; notifications are never purged (document 10). |
| email_outbox | PK only | The outbox job selects `status = 'queued' AND attempts < 5 ORDER BY id LIMIT 50` every 5 minutes; without an index on `status` this scans the whole table as it grows. Recommended: partial index `WHERE status = 'queued'`. |
| job_runs | PK only | About 1,735 rows a day (renewal-queue every minute, e-mail outbox every 5 minutes, 7 daily jobs); queried by `job_id` and `started_at` on every scheduled run and by the history screen. Recommended: index `(job_id, started_at DESC)` and a retention job. |
| refresh_tokens | PK; live tokens per user (partial); family | Expired and revoked rows are never deleted. |
| generated_reports | PK; `(created_at)`; `(code)` | Purged after `reports.retention_days` by the daily-reports job. |

## Sequences

46 identity sequences (`<table>_id_seq`) back the serial primary keys of the reference and log tables. Document numbers do not use PostgreSQL sequences but the counter table `sequences` (document 02).

## Extensions, functions and triggers

{widths: 22,78}
| Object | Detail |
|---|---|
| Extensions | `plpgsql` 1.0 (built in), `pgcrypto` 1.3 (`gen_random_bytes()` for primary-key defaults) |
| next_number(name, prefix, width) | Allocates the next document number of the year from `sequences` |
| numbering_prefix(entity, default) | Reads `numbering.<entity>.prefix` from `app_settings` |
| rpt_age_bucket(age, buckets) | Ageing bucket label for reports |
| jv_check_posting() / trigger jv_check_posting_trg on journal_vouchers | Refuses posting an unbalanced journal or one in a closed period |
| gl_accounts_defaults() / trigger gl_accounts_defaults_trg on gl_accounts | Derives the normal balance of an account from its type |
| set_updated_at() / triggers users_updated, roles_updated | Maintain `updated_at` on users and roles |

## Application settings by group

`app_settings` holds 273 configuration keys in 31 groups (reference data, seeded from `backend/src/db/seeds/settings.json` and SQL seed files, editable in Master > Configuration and System Settings).

{generate: settings_groups}

Settings relevant to operations: `security.*` (password policy, rate limits, 2FA roles, scoped roles), `limits.*` (lockout, idle time-out, quote validity, ageing buckets, renewal notice days), `notification.*` (e-mail on / off, sender), `reports.retention_days` (90), `reports.download_link_ttl_hours` (72), `reports.max_rows` (50,000), `uploads.*` (allowed types and sizes), `general.timezone` (Asia/Manila), `numbering.*` (43 document prefixes).

## Scheduled jobs

9 rows in `scheduled_jobs` (document 01, section on scheduled jobs). Report schedules add rows with the code `report-<id>`.
