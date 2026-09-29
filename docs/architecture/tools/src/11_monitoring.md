# Introduction

## Purpose and scope

This document describes how BrokerVerse OOTB is monitored: the telemetry the application produces (logs, health and version endpoints, operational tables), the metrics to collect, the recommended CloudWatch dashboards and alarms with thresholds, the review of the audit trail, synthetic checks, and the on-call runbook entries for the most likely alerts.

> **Recommended / to be confirmed by the business and DevOps:** The code produces the telemetry described in chapter 2. The deployment package (`deploy/`) contains no monitoring configuration (no dashboards, alarms, log shipping or metrics exporter). Metrics, thresholds, dashboards and runbooks in chapters 3 to 7 are recommendations.

![Monitoring and alerting (recommended)](d11_monitoring)

# Telemetry produced by the application

## Logs

{widths: 24,76}
| Aspect | Implementation |
|---|---|
| Format | pino JSON lines on standard output (one object per line: `level`, `time`, `pid`, `hostname`, `msg`, plus context). On AWS the container log driver (awslogs) ships them to CloudWatch Logs (recommended log group `/brokerverse/api`). |
| Access log | pino-http logs one line per request with `req` (id, method, url, query, headers), `res` (status code, headers) and `responseTime` in milliseconds. Health checks (`/api/health`, `/api/health/live`) are not logged. |
| Correlation | Every request gets `x-request-id` (the caller's value when well formed, otherwise a new UUID); it is the log `req.id`, returned as a response header and included in every error body, so a user can quote it and support can find the log lines. |
| Redaction | `authorization`, `cookie`, `x-api-key`, `set-cookie` headers and `password`, `newPassword`, `currentPassword`, `refreshToken`, `code` body fields are replaced by `[redacted]`; `token`, `sig`, `code`, `access_token`, `refresh_token`, `password` query parameters are masked in logged URLs. |
| Errors | 5xx: full error (message, stack, database error) logged at `error` level with the request id; the client receives a generic message. 4xx: the message is returned to the client. |
| Levels | `LOG_LEVEL` (default `info`); start-up (`applied <migration>`, `seed complete`, `BrokerVerse API listening on :8000`, `scheduler: N job(s) scheduled (time zone Asia/Manila)`), shutdown and fatal configuration errors are logged. A failed job run is logged at `error` with `job` and `runId` (`scheduled job <code> failed`); job skips are logged at `debug`. |
| Front end | Diagnostics go through `utility/logger.js`, which is silent in production builds; browser errors are not collected centrally. |

## Health and version endpoints

`GET /api/health` (readiness with database check and pending migrations), `GET /api/health/live` (liveness) and `GET /api/version` (version, commit from `GIT_COMMIT`, start time, uptime, Node version, database latency, pending migrations); details in document 07. Set `GIT_COMMIT` in the image build so the running release can be identified.

## Operational data in the database

{widths: 24,76}
| Table | Monitoring use |
|---|---|
| `job_runs`, `scheduled_jobs` | Every scheduled or manual job run with status (`success` / `failed`), start and end time, output or error; `scheduled_jobs.last_status` per job. Visible in Master > Schedules > History. The `housekeeping` output lists the rows deleted per table. |
| `email_outbox` | Queued, sent and failed e-mails with attempts and last error. |
| `login_history` | Every sign-in attempt with success flag and reason (`bad-password`, `locked`, `unknown-user`, `inactive`, `2fa-required`, `refresh-token-reuse` ...), IP and user agent. |
| `users` | `status = 'locked'`, `failed_logins`, `last_login_at`, `password_changed_at`, `totp_enabled`. |
| `audit_log` | All business and administrative changes (chapter 5). |
| `period_close_runs`, `accounting_periods`, `bank_reconciliations` | Month-end close status per period and the last reconciled month per bank account (business monitoring by the Accounting Manager). |
| `generated_reports` | Report generation status and errors. |
| `documents` | Stored files and sizes (disk usage by category). |

# Metrics to collect

{widths: 22,34,44}
| Area | Metric | Source |
|---|---|---|
| Availability | Healthy host count; synthetic check success | ALB `HealthyHostCount`; CloudWatch Synthetics |
| Traffic and errors | Requests per minute; HTTP 5xx and 4xx rate; 429 rate (rate limiting) | ALB `RequestCount`, `HTTPCode_Target_5XX_Count`, `HTTPCode_Target_4XX_Count`; log metric filter on `res.statusCode = 429` |
| Latency | p50 / p95 / p99 target response time; slow requests (> 3 s) | ALB `TargetResponseTime`; log metric filter on `responseTime > 3000` |
| API compute | CPU and memory utilisation per container; running container count; restarts | Container service metrics (for example ECS Container Insights) |
| Database | CPU, freeable memory, `DatabaseConnections`, read / write IOPS and latency, free storage, replica lag, deadlocks, top SQL | RDS metrics, Performance Insights |
| Files | EFS `StorageBytes`, `PercentIOLimit`, throughput; growth per month | EFS metrics |
| Scheduled jobs | Failed runs per job in the last 24 hours; hours since last successful run per job; run duration | Log metric filter on `scheduled job * failed`; SQL on `job_runs` (exporter below) |
| E-mail | Queued messages older than 15 minutes; failed messages per day | SQL on `email_outbox` |
| Security | Failed sign-ins per 5 minutes; locked accounts; refresh-token reuse events; 401 / 403 rate; administrator changes to users and roles | SQL on `login_history`, `users`, `audit_log`; ALB 4xx |
| Front end | CloudFront 4xx / 5xx error rate; cache hit rate | CloudFront metrics |
| Certificates and backups | ACM certificate days to expiry; AWS Backup job failures; latest restorable time of RDS | ACM, AWS Backup, RDS |

## Application metrics exporter

> **Recommended / to be confirmed by the business and DevOps:** Publish the database-derived metrics with a small scheduled task (for example an EventBridge-scheduled Lambda or container task every 5 minutes with read-only database access, or a new scheduled job in the API using `PutMetricData` / CloudWatch embedded metric format in the log) running queries such as:

{widths: 30,70}
| Metric (namespace BrokerVerse) | Query |
|---|---|
| JobFailures24h (per job) | `SELECT j.code, count(*) FROM job_runs r JOIN scheduled_jobs j ON j.id = r.job_id WHERE r.status = 'failed' AND r.started_at > now() - interval '24 hours' GROUP BY j.code` |
| HoursSinceSuccess (per job) | `SELECT code, extract(epoch FROM now() - max(r.finished_at)) / 3600 FROM scheduled_jobs j LEFT JOIN job_runs r ON r.job_id = j.id AND r.status = 'success' WHERE j.enabled GROUP BY code` |
| EmailQueuedOld / EmailFailed24h | `SELECT count(*) FROM email_outbox WHERE status = 'queued' AND created_at < now() - interval '15 minutes'`; `... WHERE status = 'failed' AND created_at > now() - interval '24 hours'` |
| LoginFailures5m / LockedUsers | `SELECT count(*) FROM login_history WHERE NOT success AND reason NOT IN ('2fa-required', '2fa-setup-required') AND at > now() - interval '5 minutes'`; `SELECT count(*) FROM users WHERE status = 'locked'` |
| RefreshTokenReuse | `SELECT count(*) FROM login_history WHERE reason = 'refresh-token-reuse' AND at > now() - interval '1 hour'` |
| UploadsBytes | `SELECT sum(size_bytes) FROM documents` (compare with EFS `StorageBytes`) |

# Dashboards and alarms

## Dashboard "BrokerVerse production"

1. Availability: synthetic check status, ALB healthy hosts, 5xx rate, requests per minute.
2. Latency: ALB target response time p50 / p95 / p99; slow requests.
3. API containers: CPU, memory, container count, deployments.
4. Database: CPU, connections, free storage, IOPS, latency, replica lag; Performance Insights top SQL link.
5. Business operations: job failures and hours since success per job, e-mail queue and failures, generated reports.
6. Security: failed sign-ins, locked users, refresh-token reuse, 401 / 403 / 429 rates.
7. Storage: EFS size and monthly growth, RDS storage growth.

## Alarms

{widths: 30,34,12,24}
| Alarm (Recommended / to be confirmed by the business and DevOps) | Threshold | Severity | Notify |
|---|---|---|---|
| Synthetic health check failing | 2 consecutive failures (checks every 5 min) | P1 | On-call (SNS: phone / chat), DevOps |
| ALB healthy hosts below 1 | 1 minute | P1 | On-call |
| HTTP 5xx rate | > 2 % of requests for 5 min, or > 20 5xx in 5 min | P1 | On-call |
| p95 target response time | > 2 s for 10 min | P2 | DevOps |
| API container CPU | > 80 % for 15 min (auto scaling should act first) | P2 | DevOps |
| API container memory | > 85 % for 10 min | P2 | DevOps |
| RDS CPU | > 80 % for 15 min | P2 | DevOps |
| RDS free storage | < 20 % | P2 | DevOps |
| RDS connections | > 80 % of `max_connections` | P2 | DevOps |
| RDS failover / reboot event | any | P2 | DevOps (information) |
| Scheduled job failed | any failure of `policy-expiry`, `receivable-ageing`, `renewal-pipeline`, `renewal-notices`, `collection-reminders`, `daily-reports`, `housekeeping` and, once enabled, the period-end and bank-matching jobs; 3 consecutive failures of `email-outbox` or `renewal-queue` | P2 | DevOps, business application support |
| Job not run | Hours since success > 26 for daily jobs; > 0.5 for `email-outbox` | P2 | DevOps |
| E-mail backlog | Queued messages older than 15 min > 0 for 30 min (when e-mail is enabled); failed > 10 per day | P3 | Application support |
| Failed sign-ins | > 50 in 5 min (possible credential attack) | P2 | Security |
| Refresh-token reuse | any | P3 | Security (review the user's sessions) |
| Locked accounts | > 5 new locks per hour | P3 | Security, service desk |
| EFS growth | > 20 GB in a day or > 80 % of the budgeted size | P3 | DevOps |
| Backup job failed / RDS latest restorable time older than 15 min | any | P2 | DevOps |
| ACM certificate expiry | < 30 days | P3 | DevOps |
| CloudFront 5xx rate | > 1 % for 10 min | P2 | DevOps |

Severity: P1 immediate response (24 x 7), P2 same business day, P3 next business day (to be aligned with the support contract).

# Audit trail review

{widths: 30,70}
| Review | Recommendation |
|---|---|
| Access reviews | Monthly: users with the System Administrator role (`system-admin`) and the Accounting Manager role, new users, role and permission changes (`audit_log` entities for users and roles), dormant accounts (`last_login_at` older than 90 days). |
| Sensitive changes | Weekly: changes to settings (`app_settings`: tax rates, account determination, security policy), posting rules, document number series, tax codes, scheduled jobs, chart of accounts, the commission rate matrix, the Company master (letterhead), direct-bill mode changes, journal reversals and corrections, cancelled receipts, period reopenings. |
| Maker-checker exceptions | Monthly: approvals by delegation (`remittance_delegations`), returned or rejected settlements, reversed commission lines, rejected or reopened close runs and bank reconciliations, postings into soft-closed periods. |
| Security events | Weekly: failed sign-ins by IP, locked accounts, refresh-token reuse, two-factor disabled by administrators. |
| Tooling | Master > Audit Trail filters by entity, entity id, username and a from / to date range (newest 200, at most 1,000 rows), backed by indexes on `(entity, entity_id)`, `(at)` and `(username)`. For periodic reviews use SQL on `audit_log` by date, or export the audit log to CloudWatch Logs or a SIEM. |
| Retention | Document 10. |

# Synthetic checks

{widths: 30,70}
| Check | Definition (Recommended) |
|---|---|
| API readiness | Every 5 minutes from outside AWS or CloudWatch Synthetics: `GET https://<brokerverse-url>/api/health` returns 200 and `"ready":true` within 2 s |
| Version | Every 15 minutes: `GET /api/version`; alert when `pendingMigrations` is not 0 or the commit differs from the expected release after a deployment |
| Front end | Every 5 minutes: the sign-in page loads (HTTP 200, the SPA bundle referenced by `index.html` loads) |
| Sign-in journey | Every 15 minutes with a dedicated monitoring user without business permissions (only `profile`): `POST /api/auth/login`, `GET /api/auth/profile`, `POST /api/auth/logout`; exclude the monitoring user from lockout investigations |
| Signed file link | Daily: open a known test document through a signed link returned by the API; confirm that the same URL without `sig` is refused (security regression) |

# On-call runbook

{widths: 22,78}
| Alert | First actions |
|---|---|
| Health check failing / no healthy hosts | Check the container service events and the reasons containers stopped; read the last log lines of a container (start-up errors such as `Refusing to start in production: ...` or `migration ... failed`). If the database is unreachable (`database.reachable: false` in `/api/health`), check RDS status and events (failover in progress?) and security groups. If a migration failed, roll back to the previous image (document 09, release rollback) and investigate on UAT. |
| 5xx spike | Find the request ids of failing requests in CloudWatch Logs Insights (`filter res.statusCode >= 500 \| stats count() by req.url`), read the error lines with the same `req.id`; check recent deployments and configuration changes (`audit_log` entity settings); roll back if caused by the release. |
| High latency / CPU | Check whether large report generations or imports are running (log lines for `/reports/*/generate`, import endpoints); check RDS Performance Insights for slow SQL and missing indexes; add API instances. |
| Database storage / connections | Increase storage (autoscaling); check that the `housekeeping` job succeeds and look for growth in `audit_log` and the transaction tables (document 10); check the connection count against instances x 10. |
| Scheduled job failed | Master > Schedules > History shows the error; fix the cause (data, configuration, SMTP) and use Run now. Daily jobs are safe to re-run (they are idempotent by design: expiry and ageing recompute, notices check for duplicates). |
| E-mail backlog / failures | Check `notification.email_enabled`, `SMTP_URL` secret, the Office 365 service status (Authenticated SMTP on for the mailbox) and the `error` column of `email_outbox`; messages with 5 failed attempts stay `failed` and must be re-queued (`UPDATE email_outbox SET status = 'queued', attempts = 0 WHERE ...`) after the cause is fixed. |
| Failed sign-in spike / token reuse | Identify source IPs in `login_history`; block at WAF if it is an attack; for token reuse, contact the user, revoke sessions (User Management) and check the device. |
| Locked administrator account | Another System Administrator sets the account back to active in User Management; if no administrator can sign in, follow the break-glass procedure (database update of `users.status` and `failed_logins` under change control, audited). |
| Backup failure | Re-run the backup job; confirm RDS latest restorable time; escalate if PITR is not available. |

Runbook entries should be kept in the operations wiki with links to the dashboard, log group, container service, database instance and this document set; each alarm description should link to its runbook entry.
