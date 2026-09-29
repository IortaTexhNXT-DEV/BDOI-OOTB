# Introduction

## Purpose and scope

This document describes the capacity and performance characteristics of BrokerVerse: the built-in limits and performance mechanisms of the code, the results of an indicative load test on the development container, the expected data growth, a sizing recommendation for the AWS target, and the performance test plan for UAT.

> **Recommended / to be confirmed by the business and DevOps:** The business volumes used for sizing in this document (users, policies per year, documents per policy) are assumptions. Replace them with the business forecast before the infrastructure is ordered, and confirm the sizing with the UAT performance test in chapter 6.

# Built-in capacity controls

## Request and upload limits

{widths: 30,20,50}
| Control | Value (default) | Where |
|---|---|---|
| JSON request body | 2 MB | `JSON_BODY_LIMIT`, `express.json` |
| Uploaded document or photo | 10 MB per file, 10 files per request | `UPLOAD_MAX_MB`, `UPLOAD_MAX_FILES`; held in memory while checked (`lib/uploadLimits.js`) |
| Spreadsheet / CSV import, statement file | 10 MB, one file | `IMPORT_MAX_MB` |
| Workbook decompression | 50 MB per workbook part | `IMPORT_MAX_INFLATED_MB` (protection against compressed "zip bombs") |
| Import rows | 20,000 rows per file; bulk upload screens `limits.bulk_upload_max_rows` = 1,000 | `IMPORT_MAX_ROWS`, settings |
| Upload settings | images 2 MB (`uploads.image_max_bytes`), bulk files 10 MB (`uploads.bulk_max_bytes`) | settings group `uploads` |
| Web container request body | 25 MB | `nginx.conf` `client_max_body_size` |
| List page size | default 10 (20 for notifications), maximum 500 per page | `lib/respond.js` `paging()` |
| Report rows | 50,000 per generated file; default on-screen page 50; default date range 365 days | `reports.max_rows`, `reports.default_page_size`, `reports.default_range_days` |
| Global API rate limit | 600 requests per 60 s per signed-in user (or per IP) per API process | `security.api_rate_limit` |
| Sign-in rate limit | 10 attempts per 300 s per IP and per username per API process | `security.login_rate_limit` |
| Database connections | 10 per API process | `db/pool.js` (`max: 10`, not configurable by environment) |
| E-mail throughput | 50 messages per outbox run, every 5 minutes (600 per hour) | `lib/mailer.js`, job `email-outbox` |

## Performance mechanisms

- **Server-side paging** on lists (`LIMIT / OFFSET` with a total count) and on report runs; screens request one page at a time.
- **Indexes** on business numbers, status and date columns of the main tables, partial indexes for hot subsets (open direct-bill items, live refresh tokens, active entry matches, direct-billed policies) and a GIN index on generic master data (document 03).
- **Settings cache** in memory per process (`lib/settings.js`), so configuration is read from the database once per key.
- **Asynchronous work** outside the request: e-mail through the outbox, renewal notices through `job_queue`, scheduled reports and ageing through the scheduler.
- **Static assets** served by CloudFront / nginx with one-year caching of hashed files (`/static/`), `index.html` not cached.
- **Stateless API**: capacity scales horizontally by adding API instances behind the load balancer (document 07).

## Known performance risks in the code

{widths: 30,70}
| Risk | Detail and recommendation |
|---|---|
| CPU-bound document generation | PDF, XLSX and CSV files (up to 50,000 report rows) and spreadsheet imports are generated synchronously in the Node.js event loop of the API process. While a large report is written, other requests on the same instance wait. Recommended: keep `reports.max_rows` as is, run large scheduled reports on an instance with `SCHEDULER_ENABLED=true` that is not in the web target group, or move report generation to a worker (later change). |
| Uploads in memory | Up to 10 files of 10 MB per request are held in memory. Size the container memory for concurrent uploads (at least 1 GB of head-room per instance; 2 GB recommended). |
| Foreign keys without indexes | 128 foreign keys have no supporting index (document 03). Joins and parent deletes on growing tables will degrade with volume. |
| Unbounded operational tables | `job_runs` (about 1,735 rows a day), `audit_log`, `login_history`, `notifications`, `email_outbox`, `refresh_tokens` have no purge (document 10); `job_runs` and `email_outbox` are scanned by the scheduler without a suitable index. |
| OFFSET paging | Deep pages of very large lists cost more with `OFFSET`; acceptable for the page sizes used, review if lists exceed about 100,000 rows. |
| Per-process pool | With N instances the database sees up to 10 x N connections (plus scheduler lock connections); keep within the RDS `max_connections` of the chosen class. |

# Indicative load test

## Method

The harness `docs/architecture/tools/loadtest.mjs` starts an in-process instance of the API (the same `createApp()` as production) on an ephemeral port of the development container, so the running system on ports 8000 and 5080 was not affected; it signs an access token for the administrator the way the backend tests do and drives read-only requests at a fixed concurrency for 15 seconds per endpoint, once with 10 and once with 50 concurrent clients. The per-process rate limiter was reset every 100 ms by the test hook `resetRateLimits()` so it did not cap the measurement.

{widths: 30,70}
| Condition | Value |
|---|---|
| Date | 29 September 2026 |
| Host | Development container: 4 vCPU, 16 GB RAM, Linux; PostgreSQL 16.13 on the same host |
| API | Node.js v22.22.2, one process (one event loop), pool of 10 connections, `LOG_LEVEL=warn` |
| Data | Local test database at the time of the test (31 policies, 18 leads, 17 claims, 568 audit rows): **test data**, far smaller than production |
| Client | Same host (no network latency, no TLS, no load balancer) |

> **Note:** The results are **indicative only**: single small container, client and database on the same host, small test data set, no TLS and no network. They show the relative cost of the endpoints and that a single API process is CPU-bound on the event loop, not the capacity of the production environment.

## Results

Clients: concurrent clients; Req/s: completed requests per second; latencies in milliseconds measured at the client; Non-2xx: responses other than 2xx.

{generate: loadtest}

## Interpretation

- At 10 concurrent clients a single API process served about 390 to 790 requests per second on list, dashboard, search and report-preview endpoints with 95th-percentile latencies between 21 and 45 ms, and about 1,160 per second on the notification unread count polled by every signed-in browser.
- At 50 concurrent clients throughput stayed about the same while latency grew about five times (95th percentile 91 to 218 ms): one Node.js process is saturated at a few hundred requests per second of this mix, so capacity grows by adding processes (instances), not by concurrency.
- The executive dashboard, policy list and report preview are the most expensive of the measured reads (about 2.5 ms of CPU per request each on this host); the unread-count poll is cheap but frequent (one request per signed-in user every 30 seconds).
- 9 of about 62,700 readiness checks (`GET /api/health`) answered 503 during the runs (none on the liveness check); the cause was not isolated in this test. A load balancer marks a target unhealthy only after several consecutive failures, so isolated 503s do not remove an instance, but this should be re-checked in the UAT test with production-like health check settings.
- With production data volumes (hundreds of thousands of rows) the database share of each request will grow; the UAT test must use a volume-loaded database.

# Data growth and storage

## Current relative weight (test data)

{generate: largest_tables}

## Growth estimate

The estimate multiplies the measured average row sizes of the test database by assumed business volumes. Index and page overhead roughly doubles the heap size.

{widths: 46,18,36}
| Assumption (Recommended / to be confirmed by the business) | Value | Basis |
|---|---|---|
| Named users / concurrent users at peak | 200 / 80 | to be confirmed |
| Policies issued per year (new + renewal) | 50,000 | to be confirmed |
| Endorsements, claims per year | 10,000 / 3,000 | to be confirmed |
| Uploaded documents and photos per policy | 4 files, 0.5 MB average | to be confirmed |
| Generated files (reports, statements, schedules) | 2 GB per year, 90-day retention for reports | settings `reports.retention_days` |

{widths: 46,18,36}
| Item | Estimate per year | Calculation |
|---|---|---|
| Transaction rows per policy (quotation 1.4 KB, policy 0.8 KB, bill, booking and receipt journals with lines, commission, receipt and application, collection item, remittance line) | about 5 KB heap | measured average row sizes |
| Audit, notification, e-mail and document rows per policy (about 10 audit rows at 0.4 KB, 2 notifications, 2 e-mails, 4 document rows) | about 6 KB heap | measured average row sizes |
| Database growth from policies, incl. index overhead | about 1.1 GB | 50,000 x 11 KB x 2 |
| Endorsements, claims, renewals, reinsurance, accounting of other flows | about 0.4 GB | estimate |
| Scheduler history (`job_runs`, 1,735 rows a day at 145 bytes, x 2) | about 0.2 GB | from the job schedule |
| Sign-in history, refresh tokens (200 users, 4 sessions a day) | under 0.1 GB | measured row sizes |
| **Database total** | **about 2 GB per year** (plus WAL and backups) | |
| **File store (uploads)** | **about 100 GB per year** | 50,000 x 4 x 0.5 MB, rounded up |

The database stays small; the file store dominates storage growth and backup volume.

# Sizing recommendation

> **Recommended / to be confirmed by the business and DevOps:** Starting sizes for production in AWS ap-southeast-1, based on the assumptions above; confirm with the UAT performance test and adjust after the first months of operation.

{widths: 24,40,36}
| Component | Recommended start | Scaling rule |
|---|---|---|
| API (ECS Fargate tasks) | 2 tasks of 1 vCPU and 2 GB, in two AZs; one task with `SCHEDULER_ENABLED=true` is enough, both may run it (advisory lock) | Target tracking on average CPU 60 %; maximum 6 tasks; add a task per ~250 requests per second of peak load |
| Load balancer | ALB, idle timeout 120 s (large report downloads and imports), health check `/api/health` every 15 s, 3 failures to mark unhealthy | Managed |
| Database | Amazon RDS for PostgreSQL 16, `db.m7g.large` (2 vCPU, 8 GB) Multi-AZ; a `db.t4g.medium` Multi-AZ is sufficient for UAT | Scale the class vertically on sustained CPU above 60 % or when connections exceed 70 % of `max_connections` |
| Database storage | gp3, 100 GB with storage autoscaling to 500 GB | Alarm at 80 % used |
| File store | Amazon EFS, General Purpose, Elastic throughput, lifecycle to Infrequent Access after 90 days | Grows automatically; alarm on monthly growth |
| Static front end | S3 + CloudFront | Managed |
| Connections | 10 per API task (+1 per running job) | 6 tasks = about 70 connections, well within the RDS limit |

# Performance test plan for UAT

## Objectives

1. Confirm that the production sizing meets the response-time targets below at the expected peak load plus 50 % head-room.
2. Find the saturation point of one API task and the scaling behaviour with two and four tasks.
3. Confirm that scheduled jobs, report generation and bulk imports do not degrade interactive response times beyond the targets.
4. Establish a performance baseline for regression tests of later releases.

## Response-time targets

{widths: 44,28,28}
| Transaction class (Recommended / to be confirmed by the business) | 95th percentile | Maximum error rate |
|---|---|---|
| Navigation, lists, details, search, notification count | 1.0 s | 0.1 % |
| Save / submit (lead, quotation, receipt, voucher, claim) | 2.0 s | 0.1 % |
| Quotation pricing, policy issue (incl. billing and journals) | 3.0 s | 0.1 % |
| Dashboards, on-screen reports (one page) | 3.0 s | 0.5 % |
| Report file generation up to 50,000 rows, bulk import 1,000 rows | 60 s | 1 % |

## Approach

{widths: 26,74}
| Step | Content |
|---|---|
| Environment | UAT on the production sizing (chapter 5), with RDS, EFS, ALB and CloudFront as in production; `LOG_LEVEL=info` |
| Data | Volume-loaded copy: at least one year of forecast volume (for example 50,000 policies with bills, receipts, journals, commissions; 3,000 claims; 200 users); generated with a data script on UAT (never production data without masking) |
| Tool | k6, JMeter or Artillery scripts per persona, using the API (tokens obtained through `POST /api/auth/login` for test users; one user per virtual user to avoid the per-user rate limit, or `security.api_rate_limit` raised for the test) |
| Workload mix | Agent (search, quotation, policy view), finance (receipts, journal vouchers, remittance), claims, dashboards and reports, the 30-second notification poll per user |
| Test types | Baseline (1 user), load (expected peak 80 concurrent users for 1 hour), stress (increase to failure), soak (peak load for 8 hours with the scheduler running), spike (5 x peak for 5 minutes) |
| Measurements | Client latencies and errors; ALB target response time and 5xx; ECS CPU and memory; RDS CPU, connections, IOPS, top SQL (Performance Insights); `job_runs` durations; event-loop delay |
| Exit criteria | Targets met at peak + 50 %; no memory growth in the soak test; no errors other than intended 429s; database CPU below 60 % at peak |
| Deliverable | Test report with the measured capacity per task, the confirmed sizing and a list of slow SQL statements with index or query fixes |
