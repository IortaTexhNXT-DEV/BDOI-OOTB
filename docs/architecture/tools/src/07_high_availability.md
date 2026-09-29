# Introduction

## Purpose and scope

This document describes how BrokerVerse stays available when components fail: the properties of the application that allow redundancy (stateless API, health endpoints, graceful shutdown, single execution of scheduled jobs), the recommended highly available deployment in AWS, the single points of failure and their mitigations, and the known limitations. Recovery objectives are in document 08, backups and restores in document 09.

> **Recommended / to be confirmed by the business and DevOps:** The AWS topology in this document (Multi-AZ RDS, EFS, two or more API tasks across two Availability Zones, CloudFront) is the recommended target derived from `docs/GO_LIVE_CHECKLIST.md`; it is not yet provisioned in the baseline.

# Application properties that enable high availability

## Stateless API

The API keeps no user session in memory: every request carries its access token, and all state is in PostgreSQL (records, refresh tokens, token versions, job runs, outbox) or in the file store (`UPLOAD_DIR`). Any instance can serve any request, so instances can be added, removed or replaced behind a load balancer without sticky sessions. Two pieces of state are per process and therefore not shared: the settings cache and the rate-limit counters (see chapter 6).

## Health endpoints

{widths: 24,26,50}
| Endpoint | Use | Behaviour (`backend/src/lib/health.js`) |
|---|---|---|
| `GET /api/health` | Readiness: load balancer target health, Docker `HEALTHCHECK`, Render `healthCheckPath` | 200 `{ status: "ok", ready: true, database: { reachable, latencyMs }, pendingMigrations: 0, uptimeSeconds }` when start-up (migrations and seed) has finished, PostgreSQL answers `SELECT 1` within `HEALTH_DB_TIMEOUT_MS` (2,000 ms) and no migration is pending; otherwise 503 with `status` `starting` or `unavailable`. Also 503 as soon as shutdown begins, so traffic drains. |
| `GET /api/health/live` | Liveness: container restart probe | 200 while the process serves HTTP; no database check, so a database outage does not cause restart loops |
| `GET /api/version` | Monitoring | Name, version, commit (`GIT_COMMIT`), start time, uptime, Node version, environment, database reachability, pending migrations |

The health endpoints need no sign-in, are not rate limited and are not written to the access log.

## Start-up and graceful shutdown

1. The server checks the production configuration and exits with a clear log line if it is unsafe.
2. It marks itself not ready, applies pending migrations and the idempotent seed, starts HTTP, starts the scheduler and then marks itself ready.
3. On SIGTERM or SIGINT (ECS task stop, rolling deployment, scale-in) it marks itself not ready (readiness 503), stops the scheduler, stops accepting new connections, lets in-flight requests finish, closes idle keep-alive connections and the database pool, and exits. A forced exit happens after `SHUTDOWN_TIMEOUT_MS` (25 s by default).

> **Recommended / to be confirmed by the business and DevOps:** Set the ECS `stopTimeout` to 30 s (above the 25 s shutdown timeout) and the ALB deregistration delay to 30 s, so in-flight requests complete during deployments.

## Scheduled jobs on several instances

Every job run takes a PostgreSQL session advisory lock keyed on the job code (`pg_try_advisory_lock`) on a dedicated connection; an instance that cannot take the lock skips the run. A scheduled run is also skipped if another instance already started a scheduled run of the same job in the same minute. Therefore the scheduler can run on all instances (`SCHEDULER_ENABLED=true`) without double execution, and a failed instance does not stop the jobs as long as one instance with the scheduler is running. Advisory locks are released automatically if the holding connection or instance dies.

## Transactions, retries and idempotency

{widths: 28,72}
| Aspect | Behaviour |
|---|---|
| Atomic business operations | Multi-table operations (quotation to policy with bill, journals, collection item and commission; receipts and applications; vouchers; debit notes; remittance decisions) run in one database transaction (`withTransaction`); a failure rolls back everything, so a retry does not leave half-created documents. |
| Concurrency guards | Rows are locked `FOR UPDATE` where a double action would be harmful (for example converting a quotation: a second concurrent request fails with "converted by another request"); unique indexes prevent duplicates (one open renewal per policy, one pending approval per entity, one commission line per policy, referrer and chain position, unique document numbers). |
| Client retries | The front end retries a request once after refreshing an expired access token. Other failed requests are not retried automatically; the user repeats the action. POST requests do not carry idempotency keys, so a timed-out save that actually succeeded can be repeated by the user; the uniqueness rules above prevent the most harmful duplicates. |
| E-mail | Queued in the database and sent by the outbox job with up to 5 attempts; an SMTP outage delays e-mail but does not fail business transactions. |
| Renewal notice queue | `job_queue` items are retried by the `renewal-queue` job; stale items are picked up again. |
| Database failover | During an RDS Multi-AZ failover (typically 60 to 120 s) open connections fail; requests in that window return 500 or 503 and the pool reconnects automatically afterwards. Readiness answers 503 while the database is unreachable, but the liveness probe keeps the tasks running. |

# Recommended highly available deployment

![High-availability topology and failure domains (recommended)](d07_ha_topology)

{widths: 22,40,38}
| Tier | Redundancy | Behaviour on failure |
|---|---|---|
| DNS and edge | Route 53, CloudFront (global edge), optional WAF | Managed by AWS; no single instance |
| Front end | S3 (regional, stores objects across AZs) with versioning | The SPA remains available during API outages (screens show errors until the API returns) |
| Load balancer | ALB across two AZs | Managed; routes only to healthy targets (`/api/health`) |
| API | ECS service with at least two tasks spread over two AZs; rolling deployment with minimum healthy 100 %, maximum 200 % | A failed task is replaced automatically (liveness); a failed AZ leaves the tasks of the other AZ serving, the service scheduler starts replacements there |
| Database | RDS PostgreSQL Multi-AZ (synchronous standby) | Automatic failover to the standby in the other AZ, same endpoint name; applications reconnect |
| File store | EFS (regional storage class, mount targets in each AZ) | Files remain available from the other AZ |
| Secrets | Secrets Manager / SSM (regional) | Read at task start |
| E-mail | SMTP relay (for example SES) | Outbox retries; e-mail delayed, not lost |

# Single points of failure and mitigations

{widths: 26,34,40}
| Single point of failure | Current state (baseline) | Mitigation |
|---|---|---|
| Database | One PostgreSQL instance (Docker volume or Render basic plan) | RDS Multi-AZ in production; PITR and snapshots (document 09) |
| File store | Local directory / Docker volume / Render 1 GB disk on one instance | EFS mounted by all tasks; AWS Backup |
| Single API instance | Compose and Render run one API container | At least two ECS tasks in two AZs |
| Migrations at start | A failed migration stops every starting instance (no rollback of the release) | Deploy migrations with one task first; test migrations on a UAT copy of production; keep the previous image and a pre-deployment snapshot for rollback |
| Secrets | `DATA_ENCRYPTION_KEY` loss makes two-factor secrets unreadable; `JWT_SECRET` change signs everyone out | Secrets Manager with versioning; sealed escrow copy (document 09) |
| Region | Single region ap-southeast-1 | Cross-region snapshot and EFS backup copies; documented regional recovery (document 08) |
| SMTP provider | One `SMTP_URL` | Outbox retries; a second provider can be configured by changing `SMTP_URL` |
| CloudFront / S3 pipeline | Deployment by GitHub Actions to one bucket | S3 versioning enables rollback to the previous build; the workflow can be re-run on a previous commit |

# Known limitations

{widths: 28,72}
| Limitation | Impact and recommendation |
|---|---|
| Per-instance rate limiting | Sign-in and API rate limits are kept in memory per process. With N instances the effective limit is N times the configured value, and counters reset when an instance restarts. Recommended: move the counters to a shared store (PostgreSQL or ElastiCache Redis) or enforce limits in AWS WAF rate-based rules. |
| Per-instance settings cache | A configuration change is seen by other instances only after restart (document 05). Recommended: cache time-to-live or invalidation by `LISTEN / NOTIFY`; until then restart all tasks after configuration changes (a rolling restart has no downtime). |
| Schedule changes | Editing a scheduled job reloads the cron tasks only on the instance that handled the request. Recommended: restart the tasks or reload schedules periodically. |
| Scheduler time zone | Cron expressions are evaluated in UTC (container time zone), see document 01. |
| Concurrent migrations | Two instances starting together with a pending migration may both try to apply it; one fails and restarts. Recommended: advisory lock around `migrate()` or single-task deployments of schema changes. |
| Long-running requests | Large report files and imports run inside the web request on the event loop; during that time the instance serves other requests slowly (document 06). |
| Local file storage API | Files are on a shared file system rather than in S3; EFS gives multi-AZ durability. Replacing the storage functions with S3 would remove the file system dependency (later change). |
| No automatic retry of failed jobs | A failed job run is recorded (`job_runs.status = failed`) and runs again at its next schedule; no immediate retry and no alert (document 11). |
