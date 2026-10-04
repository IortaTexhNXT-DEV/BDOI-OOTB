# Introduction

## Purpose and scope

This document describes how BrokerVerse OOTB stays available when components fail: the properties of the application that allow redundancy (stateless API, health endpoints, graceful shutdown, single execution of scheduled jobs and migrations, settings that follow changes on every instance), the recommended highly available deployment in AWS, the single points of failure and their mitigations, and the known limitations. Recovery objectives are in document 08, backups and restores in document 09.

> **Recommended / to be confirmed by the business and DevOps:** `deploy/README.md` deploys the backend as a container behind an HTTPS load balancer, with PostgreSQL 16 and a persistent upload volume, and allows several instances. The topology in chapter 3 (two or more API instances across two Availability Zones, Multi-AZ RDS, EFS) is the recommended production form of that deployment; the number of instances, Multi-AZ and the file system choice are to be confirmed by DevOps.

# Application properties that enable high availability

## Stateless API

The API keeps no user session in memory. Every request carries its access token, and all state is in PostgreSQL (records, refresh tokens, token versions, job runs, outbox) or in the file store (`UPLOAD_DIR`). Any instance can serve any request, so instances can be added, removed or replaced behind a load balancer without sticky sessions. Two things are held per process: the settings cache, which checks the table version every 5 seconds and so follows changes made through other instances, and the rate-limit counters (chapter 5).

## Health endpoints

{widths: 24,26,50}
| Endpoint | Use | Behaviour (`backend/src/lib/health.js`) |
|---|---|---|
| `GET /api/health` | Readiness: load balancer target health, Docker `HEALTHCHECK` | 200 `{ status: "ok", ready: true, database: { reachable, latencyMs }, pendingMigrations: 0, uptimeSeconds }` when start-up (migrations and seed) has finished, PostgreSQL answers `SELECT 1` within `HEALTH_DB_TIMEOUT_MS` (2,000 ms) and no migration is pending; otherwise 503 with `status` `starting` or `unavailable`. Also 503 as soon as shutdown begins, so traffic drains. |
| `GET /api/health/live` | Liveness: container restart probe | 200 while the process serves HTTP; no database check, so a database outage does not cause restart loops |
| `GET /api/version` | Monitoring | Name, version, commit (`GIT_COMMIT`), start time, uptime, Node version, environment, database reachability, pending migrations |

The health endpoints need no sign-in, are not rate limited and are not written to the access log.

## Start-up and graceful shutdown

1. The server checks the production configuration and exits with a clear log line if it is unsafe.
2. It marks itself not ready and takes the migration advisory lock. If another instance holds it, it waits (up to `MIGRATION_LOCK_TIMEOUT_MS`, 10 minutes by default) and then finds nothing left to apply. It applies pending migrations and the idempotent seed, starts HTTP and the scheduler, and marks itself ready.
3. On SIGTERM or SIGINT (task stop, rolling deployment, scale-in) it marks itself not ready (readiness 503), stops the scheduler, stops accepting new connections, lets requests in flight finish, closes idle keep-alive connections and the database pool, and exits. A forced exit happens after `SHUTDOWN_TIMEOUT_MS` (25 s by default).

> **Recommended / to be confirmed by the business and DevOps:** Set the container stop timeout to 30 s (above the 25 s shutdown timeout) and the load balancer deregistration delay to 30 s, so requests in flight complete during deployments.

## Scheduled jobs on several instances

Every job run takes a PostgreSQL session advisory lock keyed on the job code (`pg_try_advisory_lock`) on a dedicated connection; an instance that cannot take the lock skips the run. A scheduled run is also skipped if another instance already started a scheduled run of the same job in the same minute. The scheduler can therefore run on all instances (`SCHEDULER_ENABLED=true`) without double execution, and the jobs keep running as long as one instance with the scheduler is up. Advisory locks are released automatically when the holding connection or instance dies. Every instance reads the cron expressions in the business time zone (Asia/Manila) and reloads the schedules within 30 seconds of a change made through any instance.

## Transactions, retries and idempotency

{widths: 28,72}
| Aspect | Behaviour |
|---|---|
| Atomic business operations | Multi-table operations (policy issue with bill, co-insurance split, journals, collection item and commission; receipts and applications; vouchers; debit notes; remittance decisions; close runs) run in one database transaction (`withTransaction`). A failure rolls back everything, including the document number, so a retry does not leave half-created documents. |
| Concurrency guards | Rows are locked `FOR UPDATE` where a double action would do harm (converting a quotation, issuing a policy, taking a document number); unique indexes prevent duplicates (one open renewal per policy, one pending approval per entity, one active close run per period, one lead co-insurer, unique document numbers, one bank statement per file hash). |
| Reruns | A month-end close run executed again first reverses its own earlier journals; the go-live opening balance load for the same date replaces the earlier load. |
| Client retries | The front end retries a request once after refreshing an expired access token. Other failed requests are not retried automatically; the user repeats the action. POST requests carry no idempotency keys, so a save that timed out but succeeded can be repeated by the user; the uniqueness rules above prevent the most harmful duplicates. |
| E-mail | Queued in the database and sent by the outbox job with up to 5 attempts; an SMTP outage delays e-mail but does not fail a business transaction. |
| Integration outbox | Messages to third parties are queued in the business transaction and sent by the `integration-outbox` job with exponential backoff; a provider outage never fails a business operation; rows stuck in `processing` longer than `integrations.stuck_minutes` are queued again; each business event carries an idempotency key. |
| Renewal notice queue | `job_queue` items are retried by the `renewal-queue` job; stale items are picked up again. |
| Database failover | During an RDS Multi-AZ failover (typically 60 to 120 s) open connections fail; requests in that window return 500 or 503 and the pool reconnects afterwards. Readiness answers 503 while the database is unreachable, but the liveness probe keeps the containers running. |

# Recommended highly available deployment

![High-availability topology and failure domains (recommended)](d07_ha_topology)

{widths: 22,40,38}
| Tier | Redundancy | Behaviour on failure |
|---|---|---|
| DNS and edge | DNS of the BrokerVerse URL, CloudFront (global edge), optional WAF | Managed by AWS; no single instance |
| Front end | S3 (regional, stores objects across Availability Zones) with versioning | The SPA stays available during API outages; screens show errors until the API returns |
| Load balancer | Application Load Balancer across two Availability Zones | Managed; routes only to healthy targets (`/api/health`) |
| API | At least two containers spread over two Availability Zones; rolling deployment with minimum healthy 100%, maximum 200% | A failed container is replaced automatically (liveness); if a zone fails, the containers in the other zone keep serving and replacements start there |
| Database | RDS PostgreSQL Multi-AZ (synchronous standby) | Automatic failover to the standby in the other zone, same endpoint name; the application reconnects |
| File store | EFS (regional storage class, mount targets in each zone) | Files remain available from the other zone |
| Secrets | Secrets Manager or SSM (regional) | Read at container start |
| E-mail | Office 365 | Outbox retries; e-mail is delayed, not lost |

# Single points of failure and mitigations

{widths: 26,34,40}
| Single point of failure | In the baseline | Mitigation |
|---|---|---|
| Database | One PostgreSQL instance unless Multi-AZ is chosen | RDS Multi-AZ in production; point-in-time recovery and snapshots (document 09) |
| File store | A persistent volume mounted into the container; a local volume serves one instance only | EFS mounted by all instances; AWS Backup |
| Single API instance | The checklist starts with one instance; Docker Compose runs one | At least two instances in two zones once the first start has applied the migrations |
| Migrations at start | A failed migration stops every starting instance; the release is not rolled back automatically | Run one instance first for releases with migrations; test migrations on a UAT copy of production; keep the previous image and a pre-deployment snapshot for rollback |
| Secrets | Losing `DATA_ENCRYPTION_KEY` makes two-factor secrets unreadable; changing `JWT_SECRET` signs everyone out | Secret store with versioning; sealed copy of the keys kept with the backups (document 09) |
| Region | Single region ap-southeast-1 | Cross-region snapshot and file backup copies; documented regional recovery (document 08) |
| E-mail provider | One Office 365 mailbox in `SMTP_URL` | Outbox retries; another provider can be set by changing `SMTP_URL` and the sender setting |
| Front-end pipeline | Deployment by GitHub Actions to one bucket | S3 versioning allows a rollback to the previous build; the workflow can be re-run on a previous commit |

# Known limitations

{widths: 28,72}
| Limitation | Impact and recommendation |
|---|---|
| Per-instance rate limiting | Sign-in and API rate limits are kept in memory per process. With N instances the effective limit is N times the configured value, and counters reset when an instance restarts. Recommended: move the counters to a shared store (PostgreSQL or ElastiCache Redis) or enforce limits with AWS WAF rate-based rules. |
| Long-running requests | Large report files, bulk prints and imports run inside the web request on the event loop; meanwhile the instance serves other requests slowly (document 06). |
| Local file storage API | Files are on a shared file system, not in S3; EFS gives multi-zone durability. Replacing the storage functions with S3 would remove the file system dependency (later change). |
| No automatic retry of failed jobs | A failed job run is recorded (`job_runs.status = failed`) and logged at error level; it runs again at its next schedule. There is no immediate retry; alerting is set up from the log (document 11). |
