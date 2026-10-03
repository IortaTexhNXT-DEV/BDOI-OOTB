# Introduction

## Purpose and scope

This document is the inventory of the BrokerVerse OOTB database: every table with its domain, purpose, key columns, row count and size, number of indexes, retention class and owning backend module, followed by the indexes, views, sequences, extensions, functions, triggers, the application settings by group and the scheduled jobs. It supports capacity planning (document 06), backup and archival (documents 09 and 10) and data-protection reviews. The design rationale is in document 02.

## Source and currency of the figures

The inventory is generated from the catalogue of a PostgreSQL 16 database created for this issue (`brokerverse_arch`, migrated to `0152_email_sender.sql` and seeded with `SEED_SAMPLE_DATA=true`) by `docs/architecture/tools/collect_db_inventory.py`, which runs read-only catalogue queries and one `count(*)` per table. The descriptions, owning modules and retention classes come from `tools/table_catalog.py`.

> **Note:** Row counts and sizes are those of a fresh database with reference data and the sample data set. They show relative weight, not production volumes. A production database starts with reference data only. Re-run the collector against UAT or production and rebuild the documents to refresh them (see `docs/architecture/README.md`).

Size is the total relation size in KB (table, TOAST and indexes). PostgreSQL allocates at least one 8 KB page per relation and index, so small tables show 16 to 64 KB. "Idx" is the number of indexes including the primary key.

## Retention classes

{widths: 22,78}
| Class | Meaning and default handling (periods in document 10) |
|---|---|
| Financial | Ledger, bills, receipts, payments, vouchers, commissions, remittances, debit notes, bank statements and reconciliations, close runs, BIR certificates, reinsurance settlements. Kept for the statutory record-keeping period; cancelled or reversed, never deleted from the online system while the period runs. |
| Transaction | Leads, clients, quotations, broker slips, offers, placements, policies, endorsements, claims, renewals, treaties, cessions, documents. Kept for the policy or claim life plus the regulatory period. |
| Reference | Masters, settings, posting rules, number series, tax codes, product templates, roles, permissions, report catalogue, scheduled jobs. Kept while in use; changes audited. |
| Log / audit | Audit log, sign-in history, histories and field-level trails, job run history, notice logs. Kept for the audit period, then archived. |
| Temporary | Tokens, reset codes, e-mail outbox, notifications, work queues, generated report files. Purged by the housekeeping job after the periods set in System Settings. |

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

448 indexes: 138 primary keys, 91 further unique indexes, 33 partial indexes and 1 GIN index (`master_records_data_idx` on `master_records.data`). The partial indexes serve hot subsets and conditional uniqueness: open direct-bill items, live refresh tokens, active entry matches, direct-billed policies, due recurring journals and close entries, active bank reconciliations and close runs, one lead co-insurer per record, one open renewal per policy, one pending approval per entity, one active document-number prefix, and codes that are unique among records not deleted.

### Foreign keys without a supporting index

Migration `0146_foreign_key_indexes.sql` indexed the foreign keys of every table that grows. The 36 foreign keys below have no index whose first column is the foreign-key column. They are on small master and set-up tables or are maker-checker stamp columns, and are left without an index on purpose. `node backend/scripts/fk-index-report.js` lists them again after new migrations.

{generate: unindexed_fks}

### Log tables and their indexes

{widths: 22,40,38}
| Table | Indexes | Use |
|---|---|---|
| audit_log | PK; `(entity, entity_id)`; `(at)`; `(username)` | The audit trail endpoint (`GET /api/settings/audit`) filters by entity, entity id, username and a from / to business-date range, newest first, at most 1,000 rows. |
| login_history | PK; `(user_id, at DESC)`; `(at DESC)` | Sign-in reviews and the housekeeping purge by date. |
| notifications | PK; `(user_id, is_read, created_at DESC)` | The per-user bell and unread count. Read notifications are purged by housekeeping. |
| email_outbox | PK; `(status, created_at)` | The outbox job selects `status = 'queued'` every 5 minutes; housekeeping purges sent and failed messages by date. |
| job_runs | PK; `(job_id, started_at)` | The duplicate-slot check of every scheduled run, the run history screen and the housekeeping purge. |
| refresh_tokens | PK; live tokens per user (partial); family | Expired and revoked rows are purged by housekeeping after 30 days. |
| generated_reports | PK; `(created_at)`; `(code)` | Purged after `reports.retention_days` by the daily-reports job. |

## Views

Two views support bank reconciliation: `bank_account_links` (bank account masters with their GL cash account) and `bank_book_lines` (posted journal lines on bank cash accounts, the book side of matching). There are no materialised views.

## Sequences

63 identity sequences (`<table>_id_seq`) back the serial primary keys. Document numbers do not use PostgreSQL sequences but the counter table `sequences`, one row per series and reset period (document 02).

## Extensions, functions and triggers

{widths: 30,70}
| Object | Detail |
|---|---|
| Extensions | `plpgsql` 1.0 (built in), `pgcrypto` 1.3 (`gen_random_bytes()` for primary-key defaults) |
| next_document_number(code, branch, lob, date), format_document_number(), numbering_* helpers | Allocate and format the next number of a document series; `numbering_business_date()` gives today's date in `general.timezone` and is the default of date columns |
| next_number(), numbering_prefix() | Older numbering helpers kept for seed scripts |
| document_numbering_mirror_prefix() / trigger document_numbering_mirror | Copies a series prefix into the read-only setting `numbering.<code>.prefix` |
| jv_check_posting() / trigger jv_check_posting_trg on journal_vouchers | Refuses to post an unbalanced journal or one in a period that does not accept postings |
| accounting_period_lock_guard() / trigger on accounting_periods | Refuses to reopen a period locked by the year-end close |
| pe_balance_before() | Account balance before a date, including the opening balances of the fiscal year |
| user_effective_roles() | A user's roles plus the roles they inherit (`roles.inherits`) |
| rp_* functions, backfill_risk_participants() | Co-insurance share and split helpers used by migrations and reports |
| quotes_link_product() / trigger quotes_link_product | Links a quotation to its product |
| rpt_age_bucket(age, buckets) | Ageing bucket label for reports |
| gl_accounts_defaults() / trigger gl_accounts_defaults_trg | Derives the normal balance of an account from its type |
| set_updated_at() / triggers on users, roles, commission_rates, document_numbering | Maintain `updated_at` |

## Application settings by group

`app_settings` holds 351 configuration keys in 36 groups, seeded from `backend/src/db/seeds/settings.json`, SQL seed files and migrations, and edited in Master > Configuration and System Settings. Every key the code reads is seeded (`npm run check:settings`, `test/configuration.test.js`).

{generate: settings_groups}

Settings relevant to operations: `security.*` (password policy, rate limits, two-factor roles, scoped roles), `limits.*` (lockout, idle time-out, quote validity, renewal notice days), `notification.*` (e-mail on or off, sender), `housekeeping.*` (retention days per table), `reports.retention_days` (90), `reports.download_link_ttl_hours` (72), `reports.max_rows` (50,000), `uploads.*` (allowed types and sizes), `general.timezone` (Asia/Manila), `accounting.account.*` (Account Determination), `bank_reconciliation.*`, `bir.*`, `placement.*` and `numbering.*` (prefix mirrors of the 52 document series).

## Scheduled jobs

15 rows in `scheduled_jobs`, 10 of them enabled (document 01, section on scheduled jobs). Report schedules add rows with the code `report-<id>`.
