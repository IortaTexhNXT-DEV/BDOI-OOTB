# Introduction

## Purpose and scope

This document describes the capacity and performance characteristics of BrokerVerse OOTB: the limits and performance mechanisms built into the code, the results of an indicative load test on the build host, the expected data growth, a sizing recommendation for AWS and the performance test plan for UAT.

> **Recommended / to be confirmed by the business and DevOps:** The business volumes used for sizing (users, policies per year, documents per policy) are assumptions. Replace them with the business forecast before the infrastructure is ordered, and confirm the sizing with the UAT performance test in chapter 6.

# Built-in capacity controls

## Request and upload limits

{widths: 30,20,50}
| Control | Value (default) | Where |
|---|---|---|
| JSON request body | 2 MB | `JSON_BODY_LIMIT`, `express.json` |
| Uploaded document or photo | 10 MB per file, 10 files per request | `UPLOAD_MAX_MB`, `UPLOAD_MAX_FILES`; held in memory while checked (`lib/uploadLimits.js`) |
| Spreadsheet or CSV import, statement file | 10 MB, one file | `IMPORT_MAX_MB` |
| Workbook decompression | 50 MB per workbook part | `IMPORT_MAX_INFLATED_MB` (protection against compressed "zip bombs") |
| Import rows | 20,000 rows per file; bulk upload screens 1,000 | `IMPORT_MAX_ROWS`, `limits.bulk_upload_max_rows` |
| Upload settings | images 2 MB, bulk files 10 MB | `uploads.image_max_bytes`, `uploads.bulk_max_bytes` |
| Web container request body | 25 MB | `nginx.conf` `client_max_body_size` (Docker Compose option) |
| List page size | default 10, maximum 500 per page | `lib/respond.js` `paging()` |
| Report rows | 50,000 per generated file; on-screen page 50; default date range 365 days | `reports.max_rows`, `reports.default_page_size`, `reports.default_range_days` |
| Global API rate limit | 600 requests per 60 s per signed-in user (or per IP) per API process | `security.api_rate_limit` |
| Sign-in rate limit | 10 attempts per 300 s per IP and per username per API process | `security.login_rate_limit` |
| Database connections | 10 per API process, plus one dedicated connection per running job | `db/pool.js` (`max: 10`) |
| E-mail throughput | 50 messages per outbox run, every 5 minutes (600 per hour) | `lib/mailer.js`, job `email-outbox` |
| Bank matching | Date window 5 days; one-to-many and many-to-one groups of up to 6 lines | `bank_reconciliation.date_window_days`, `bank_reconciliation.group_max_lines` |

## Performance mechanisms

- **Server-side paging** on lists (`LIMIT` and `OFFSET` with a total count) and on report runs; screens request one page at a time.
- **Indexes** on business numbers, status and date columns, on the foreign keys of every growing table (migration 0146), partial indexes for hot subsets (open direct-bill items, live refresh tokens, active entry matches, due recurring journals) and a GIN index on generic master data (document 03).
- **Settings cache** in memory per process (`lib/settings.js`): a key is read from the database once and the cache checks the table version at most every 5 seconds.
- **Work outside the request**: e-mail through the outbox, renewal notices through `job_queue`, scheduled reports, ageing and the period-end jobs through the scheduler.
- **Housekeeping**: the daily `housekeeping` job keeps the operational tables (job runs, outbox, sign-in history, tokens, notifications, queue) at a bounded size (document 10).
- **Static assets** served by CloudFront with long caching of hashed files and `index.html` not cached.
- **Stateless API**: capacity grows by adding API instances behind the load balancer (document 07).

## Known performance risks in the code

{widths: 30,70}
| Risk | Detail and recommendation |
|---|---|
| CPU-bound file generation | PDF, XLSX and CSV files (up to 50,000 report rows), bulk PDF prints and spreadsheet imports run in the Node.js event loop of the API process. While a large file is written, other requests on the same instance wait. Recommended: keep `reports.max_rows` as is, run large scheduled reports on an instance that is not in the web target group, or move file generation to a worker later. |
| Uploads in memory | Up to 10 files of 10 MB per request are held in memory. Size the container memory for concurrent uploads (at least 1 GB of head-room per instance; 2 GB recommended). |
| Bank matching on large statements | Automatic matching compares each bank line with the open book lines of the account within the date window; the one-to-many rules search combinations of up to `group_max_lines` lines. Very large statements (thousands of lines) are best imported per week. |
| OFFSET paging | Deep pages of very large lists cost more with `OFFSET`; acceptable for the page sizes used, to be reviewed if a list passes about 100,000 rows. |
| Per-process pool | With N instances the database sees up to 10 x N connections plus the job lock connections; keep within the `max_connections` of the database class. |

# Indicative load test

## Method

The harness `docs/architecture/tools/loadtest.mjs` starts an in-process instance of the API (the same `createApp()` as production) on a free local port, so no running system is affected. It signs an access token for the administrator the way the backend tests do and drives read-only requests at a fixed concurrency for 15 seconds per endpoint, once with 10 and once with 50 concurrent clients. The per-process rate limiter is reset every 100 ms by the test hook `resetRateLimits()` so it does not cap the measurement.

{widths: 30,70}
| Condition | Value |
|---|---|
| Date | 29 September 2026, on the code of this issue |
| Host | Build host: 4 vCPU, 16 GB RAM, Linux; PostgreSQL 16.13 on the same host |
| API | Node.js 22, one process (one event loop), pool of 10 connections, `LOG_LEVEL=warn` |
| Data | The database of documents 02 and 03 (28 policies, 16 leads, 15 claims): **test data**, far smaller than production |
| Client | Same host (no network latency, no TLS, no load balancer) |

> **Note:** The results are **indicative only**: one small host, client and database on the same machine, a small data set, no TLS and no network. They show the relative cost of the endpoints and that a single API process is bound by its event loop. They are not the capacity of the production environment.

## Results

Clients: concurrent clients; Req/s: completed requests per second; latencies in milliseconds measured at the client; Non-2xx: responses other than 2xx.

{generate: loadtest}

## Interpretation

- At 10 concurrent clients one API process served about 400 to 1,000 requests per second on the list, dashboard, search and report-preview endpoints, with 95th-percentile latencies between 12 and 35 ms, and about 1,200 per second on the notification unread count that every signed-in browser polls.
- At 50 concurrent clients the throughput stayed about the same while latency grew about four to six times (95th percentile 54 to 174 ms). One Node.js process is saturated at a few hundred requests per second of this mix, so capacity grows by adding instances, not by concurrency.
- The executive dashboard, the policy and claim lists and the report preview are the most expensive of the measured reads; the unread-count poll is cheap but frequent (one request per signed-in user every 30 seconds).
- 3 of about 31,500 readiness checks at 10 clients and 3 of about 43,950 at 50 clients answered 503; the cause was not isolated in this test and the liveness check had none. A load balancer marks a target unhealthy only after several failures in a row, so single 503s do not remove an instance. Re-check in UAT with the production health-check settings.
- With production volumes (hundreds of thousands of rows) the database share of each request grows; the UAT test must use a volume-loaded database.

# Data growth and storage

## Current relative weight (test data)

{generate: largest_tables}

## Growth estimate

The estimate multiplies the average row sizes measured in the test database by assumed business volumes. Index and page overhead roughly doubles the heap size.

{widths: 46,18,36}
| Assumption (Recommended / to be confirmed by the business) | Value | Basis |
|---|---|---|
| Named users / concurrent users at peak | 200 / 80 | to be confirmed |
| Policies issued per year (new and renewal) | 50,000 | to be confirmed |
| Endorsements, claims per year | 10,000 / 3,000 | to be confirmed |
| Uploaded documents and photos per policy | 4 files, 0.5 MB average | to be confirmed |
| Generated files (reports, statements, schedules) | 2 GB per year, 90-day retention for reports | setting `reports.retention_days` |

{widths: 46,18,36}
| Item | Estimate per year | Calculation |
|---|---|---|
| Transaction rows per policy (quotation 0.8 KB, policy 0.5 KB, bill, booking and receipt journals with lines, co-insurance participants, commission, receipt and application, collection item, remittance line) | about 5 KB heap | measured average row sizes |
| Audit, notification, e-mail and document rows per policy (about 10 audit rows, 2 notifications, 2 e-mails, 4 document rows) | about 6 KB heap | estimate |
| Database growth from policies, including index overhead | about 1.1 GB | 50,000 x 11 KB x 2 |
| Endorsements, claims, renewals, placement, reinsurance, bank statements and period-end journals | about 0.5 GB | estimate |
| Scheduler history (`job_runs`: 1,736 rows a day, kept 90 days by housekeeping) | under 0.1 GB, steady | from the job schedule |
| Sign-in history, refresh tokens (200 users, 4 sessions a day; kept 365 and 30 days) | under 0.1 GB, steady | housekeeping periods |
| **Database total** | **about 2 GB per year** (plus WAL and backups) | |
| **File store (uploads)** | **about 100 GB per year** | 50,000 x 4 x 0.5 MB, rounded up |

The database stays small; the file store drives storage growth and backup volume.

# Sizing recommendation

> **Recommended / to be confirmed by the business and DevOps:** Starting sizes for production in AWS ap-southeast-1, based on the assumptions above. Confirm them with the UAT performance test and adjust after the first months of operation.

{widths: 24,40,36}
| Component | Recommended start | Scaling rule |
|---|---|---|
| API containers | 2 instances of 1 vCPU and 2 GB; the scheduler may run on both (advisory lock) or on one (`SCHEDULER_ENABLED`) | Scale on average CPU 60%; maximum 6 instances; about one instance per 250 requests per second of peak load |
| Load balancer | HTTPS, idle timeout 120 s (large report downloads and imports), health check `/api/health` every 15 s, 3 failures to mark unhealthy | Managed |
| Database | Amazon RDS for PostgreSQL 16, `db.m7g.large` (2 vCPU, 8 GB) Multi-AZ; `db.t4g.medium` for UAT | Scale the class up on sustained CPU above 60% or connections above 70% of `max_connections` |
| Database storage | gp3, 100 GB with storage autoscaling to 500 GB | Alarm at 80% used |
| File store | Amazon EFS, General Purpose, elastic throughput, lifecycle to Infrequent Access after 90 days | Grows automatically; alarm on monthly growth |
| Static front end | S3 and CloudFront | Managed |
| Connections | 10 per API instance, plus one per running job | 6 instances = about 70 connections, well within the RDS limit |

# Performance test plan for UAT

## Objectives

1. Confirm that the production sizing meets the response-time targets below at the expected peak load plus 50% head-room.
2. Find the saturation point of one API instance and the scaling with two and four instances.
3. Confirm that scheduled jobs, report generation, bulk prints, imports and bank matching do not push interactive response times past the targets.
4. Record a baseline for regression tests of later releases.

## Response-time targets

{widths: 44,28,28}
| Transaction class (Recommended / to be confirmed by the business) | 95th percentile | Maximum error rate |
|---|---|---|
| Navigation, lists, details, search, notification count | 1.0 s | 0.1% |
| Save or submit (lead, quotation, broker slip, receipt, voucher, claim) | 2.0 s | 0.1% |
| Quotation pricing, policy issue (with billing, co-insurance and journals) | 3.0 s | 0.1% |
| Dashboards, on-screen reports (one page) | 3.0 s | 0.5% |
| Report file up to 50,000 rows, import of 1,000 rows, month-end close run | 60 s | 1% |

## Approach

{widths: 26,74}
| Step | Content |
|---|---|
| Environment | UAT on the production sizing (chapter 5), with the same database, file store, load balancer and CloudFront set-up as production; `LOG_LEVEL=info` |
| Data | A volume-loaded copy: at least one year of forecast volume (for example 50,000 policies with bills, receipts, journals and commissions; 3,000 claims; 200 users), generated with a data script on UAT; never production data without masking |
| Tool | k6, JMeter or Artillery scripts per role, using the API (tokens from `POST /api/auth/login` for test users; one user per virtual user to stay under the per-user rate limit, or `security.api_rate_limit` raised for the test) |
| Workload mix | Sales & Marketing (search, leads, quotations), Processing Team (broker slips, placement, policy issue), Operations (policy views, endorsements), Accounting (receipts, journal vouchers, remittance, bank matching), Claims, dashboards and reports, the 30-second notification poll per user |
| Test types | Baseline (1 user), load (expected peak of 80 concurrent users for 1 hour), stress (increase to failure), soak (peak load for 8 hours with the scheduler running), spike (5 x peak for 5 minutes) |
| Measurements | Client latencies and errors; load balancer target response time and 5xx; container CPU and memory; database CPU, connections, IOPS, top SQL (Performance Insights); `job_runs` durations; event-loop delay |
| Exit criteria | Targets met at peak plus 50%; no memory growth in the soak test; no errors other than intended 429s; database CPU below 60% at peak |
| Deliverable | Test report with the measured capacity per instance, the confirmed sizing and the slow SQL statements with their index or query fixes |
