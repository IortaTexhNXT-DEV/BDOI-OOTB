# Introduction

## Purpose and scope

This document describes the application architecture of BrokerVerse, the out-of-the-box insurance broking platform of iorta TechNXT: its logical components, how it is deployed, how a request is processed and secured, how the functional modules map to the front end and the backend, which external systems it integrates with, and how the main business flows run through the components. It is the entry point to the Solution Architecture set; the database, technology, shared services and operational documents (02 to 11) go into detail.

The description is derived from the code and configuration of the baseline named in the document control section: the React front end in `brokerverse/`, the Node.js API in `backend/`, `docker-compose.yml`, `render.yaml`, `docs/DEPLOY.md` and `docs/GO_LIVE_CHECKLIST.md`.

## Architecture at a glance

| Aspect | BrokerVerse |
|---|---|
| Style | Three-tier web application: single-page application (SPA), stateless REST API, relational database; modular monolith on the server |
| Presentation tier | React 18 SPA built with Create React App / craco, PrimeReact components, Redux Toolkit, served as static files (S3 + CloudFront in the target, nginx in the container option) |
| Application tier | Node.js 22 (ESM) with Express 4; 32 module routers mounted under `/api`, 568 registered routes plus two health endpoints; built-in cron scheduler |
| Data tier | PostgreSQL 16: 102 tables, 32 migration files applied on start; files on a persistent volume (`UPLOAD_DIR`) |
| Integration | SMTP (outbound e-mail through an outbox table); public quote-approval link for clients; OpenAPI / Postman / Excel API documentation generated from the route registry |
| Security | JWT access tokens (30 minutes) with rotating refresh tokens (30 days), token version revocation, role and permission checks on every route, record scope for agents, maker-checker approvals, audit log, TOTP two-factor, HMAC-signed file links |
| Deployment target | AWS ap-southeast-1: existing front-end pipeline (GitHub Actions, S3, CloudFront) and a new backend container with PostgreSQL (e.g. Amazon RDS) and a persistent upload volume (e.g. Amazon EFS). Alternatives: Docker Compose and a Render blueprint |

# Solution component diagram

## Logical components

![Logical component view of BrokerVerse](d01_logical_components)

{widths: 22,78}
| Component | Responsibility |
|---|---|
| Browser SPA | All user screens: operations (leads to renewals), accounts and finance, commission, product configurator, reinsurance, reports, dashboards, master data and administration. Holds the session tokens, renews them automatically and hides menus and routes the user's roles may not open. |
| Static hosting | Serves the compiled SPA (HTML, JavaScript, CSS, images). No server-side rendering; every data call goes to `/api`. |
| HTTP pipeline | Cross-cutting request handling in `backend/src/app.js`: correlation id, security headers (helmet), CORS, structured access log with redaction, global rate limit, JSON size limit, signing of file URLs in responses, uniform error envelope. |
| Business modules | 32 folders in `backend/src/modules`, each with a `router.js` (endpoints declared through the route registry) and services holding the business rules and SQL. Loaded automatically at start (`loadModules()`). |
| Shared services | `backend/src/lib`: authentication, permissions, record scope, settings cache, audit, e-mail outbox, secrets and signed links, dates in the business time zone, money rounding, validation, rate limits, health (document 05). |
| Scheduler | `backend/src/jobs/scheduler.js`: node-cron schedules the enabled rows of `scheduled_jobs`; each run takes a PostgreSQL advisory lock so it runs once across instances and is recorded in `job_runs`. |
| Document engines | Dependency-free writers in `backend/src/tools` and `backend/src/modules/documents`: PDF (quotations, policy schedules, receipts, letters, report files), XLSX (reports, exports) and CSV. |
| PostgreSQL | System of record for all business, financial, configuration, security and log data (document 02 and 03). |
| File store | `UPLOAD_DIR` (default `./uploads`, `/app/uploads` in the container): uploaded documents and photos, generated reports and statements; registered in the `documents` table. |
| SMTP server | Delivers e-mail queued in `email_outbox` (quotation approval links, password reset codes, renewal and collection reminders, report schedules, remittance statements). |

## Front-end application structure

The SPA (`brokerverse/src`, about 880 JavaScript / JSX files) is organised by functional area rather than by technical layer:

{widths: 26,74}
| Folder | Content |
|---|---|
| `agentModule/` | Operations screens: leads, quotation wizard, policy, endorsements, claims, renewals, collections, open items, payments, agent dashboard, customer quote approval page |
| `module/` | Back-office areas: Administration, ClaimsModule, Commission, CorrectionJV, ExecutiveDashboard, FinanceMastersModule, GeneralMasters, Incentive, JournalVoucher, PaymentVoucher, PettyCashManagement, ProductConfigurator, Receipts, Reinsurance, Remittance, Renewal, Reports, Reversals, SystemSettings, UnderwritingModule, accounts |
| `services/` | 36 API client services (one per backend area, e.g. `policyService.js`, `remittanceService.js`) |
| `routes/` | `MainRoute.js` (about 400 routes), `ProtectedRoute` (route guard), `apiRoutes.js` |
| `redux/`, `context/`, `hooks/` | Redux Toolkit store (main and agent reducers, reset on sign-out), notification context, currency formatting hook |
| `utility/`, `utils/` | Shared helpers: HTTP interceptor and session refresh, menu permissions, dialogs and toasts, date / currency / phone formatting, idle time-out, system settings application |
| `components/` | Reusable UI: layout, header, side bar, file upload, dialogs, toasts, status badges, stepper, notification drop-down |
| `locales/`, `i18n.js` | i18next resources: English (`en.json`) and Thai (`th.json`); Filipino is configured in settings but has no translation file |

# Deployment view

## Target deployment on AWS

The go-live checklist (`docs/GO_LIVE_CHECKLIST.md`) keeps the existing front-end pipeline and adds a backend service. Figure 2 shows the recommended target; items that are not yet provisioned (WAF, ECR image pipeline, CloudWatch alarms) are recommendations.

![Target deployment on AWS ap-southeast-1 (recommended; to be confirmed by DevOps)](d01_deployment_aws)

{widths: 24,40,36}
| Layer | Fact from the baseline | Recommended / to be confirmed by the business and DevOps |
|---|---|---|
| Front-end build and hosting | `brokerverse/.github/workflows/deploy.yml`: on push to `dev`, Node 20, `npm install`, `npm run build`, `aws s3 sync build/ s3://$S3_BUCKET --delete`, CloudFront invalidation `/*`, region ap-southeast-1 | Add `REACT_APP_BASE_URL` to the build step (required, see checklist section 3); use GitHub OIDC role instead of long-lived access keys; enable S3 versioning; re-enable the commented-out test job |
| API address | Same-domain option recommended: CloudFront behaviour `/api/*` to the backend load balancer, all methods and headers, no caching | Custom error responses 403/404 to `/index.html` (SPA deep links) |
| API runtime | `backend/Dockerfile`: `node:22-alpine`, `npm ci --omit=dev`, runs as user `node`, port 8000, `HEALTHCHECK` on `/api/health` | ECS Fargate service (or App Runner / EC2) in private subnets of two AZs, minimum two tasks behind an ALB |
| Database | PostgreSQL 16, created empty; the API migrates and seeds it on start | Amazon RDS for PostgreSQL 16, Multi-AZ, encryption at rest, `sslmode=require`, automated backups with PITR |
| Files | Persistent volume at `UPLOAD_DIR` required (a container without it loses documents on restart) | Amazon EFS mounted at `/app/uploads` in every task, backed up by AWS Backup |
| Secrets | `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `ADMIN_PASSWORD`, `DATABASE_URL`, `SMTP_URL` from the environment; production start refuses unsafe values | AWS Secrets Manager / SSM Parameter Store injected into the task definition |

## Alternative deployments

**Docker Compose** (`docker-compose.yml`, own server or VM): three services. `db` runs `postgres:16-alpine` with a `pg_isready` health check and the volume `db-data`; `api` is built from `backend/`, runs with `NODE_ENV=production` by default, refuses to start without `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `ADMIN_PASSWORD`, `CORS_ORIGINS` and `PUBLIC_BASE_URL`, and keeps files in the volume `uploads`; `web` is built from `brokerverse/` (nginx 1.27) and publishes port 8080, serving the SPA and forwarding `/api/` to `http://api:8000/api/`. A TLS proxy must be placed in front of port 8080.

**Render blueprint** (`render.yaml`): a managed PostgreSQL (`basic-256mb` plan), the API as a Docker web service with `healthCheckPath: /api/health`, generated `JWT_SECRET` and `DATA_ENCRYPTION_KEY` and a 1 GB disk at `/app/uploads`, and the SPA as a static site with a rewrite of `/*` to `/index.html`. Suitable for demonstrations and UAT, not sized for production.

![Docker Compose deployment (docker-compose.yml)](d01_deployment_compose)

# Request processing

## API request pipeline

Every request passes the same middleware chain before it reaches a handler. The route registry (`backend/src/lib/registry.js`) places `requireAuth` first on every route not declared `auth: false`, so an endpoint cannot be left open by omission; 14 routes are public by design (sign-in, refresh, logout, password reset and policy, public system settings, version, customer quote approval, file download with a signed link, generated report download with a signed token).

![Request pipeline of the BrokerVerse API](d01_request_pipeline)

## Authentication and session flow

![Sign-in, refresh-token rotation and signed file links](seq_auth)

{widths: 30,70}
| Mechanism | Implementation |
|---|---|
| Access token | JWT, HS256 only, lifetime `JWT_ACCESS_TTL_SECONDS` (default 1,800 s = 30 minutes); claims: user id, username, roles, permissions, `type=access`, `tv` (token version) and an optional `restrict` (`enrol2fa`, `pwchange`) |
| Per-request check | `authenticate()` verifies the signature and type, then reads `users.status` and `users.token_version`; an inactive user or a changed token version ends the session at once (HTTP 401) |
| Refresh token | JWT with a `jti` recorded in `refresh_tokens` (lifetime `JWT_REFRESH_TTL_SECONDS`, default 30 days); rotated on every use; reuse of a rotated token after the grace window revokes the whole token family and is audited |
| Revocation | Password change or reset, administrator reset, deactivation and role / permission changes raise `token_version` and revoke refresh tokens (`revokeSessions()`) |
| Sign-in protection | In-memory limit of 10 attempts per 5 minutes per IP and per username (`security.login_rate_limit`); account locked after `limits.max_login_attempts` (5) wrong passwords; every attempt recorded in `login_history` |
| Password policy | Minimum length 8, upper / lower case, digit and symbol, history of 5, maximum age 90 days (`security.password_*`); must-change and expired passwords get a restricted token |
| Two-factor | TOTP (RFC 6238) in `lib/totp.js`; secrets encrypted at rest with AES-256-GCM under `DATA_ENCRYPTION_KEY`; roles that must use it are configured in `security.require_2fa_roles` (empty by default) |
| Front end | Tokens kept in `localStorage`; `utility/sessionRefresh.js` wraps `fetch` and `utility/interceptor.js` wraps axios with one shared refresh; idle sign-out after `limits.session_idle_minutes` (30) with a one-minute warning |
| File links | Stored documents are served by `GET /api/s3/object/<key>` only with a bearer token or an HMAC-signed link (`?exp=&sig=`) valid for `FILE_URL_TTL_SECONDS` (1,800 s); the API signs every object URL in JSON responses on the way out |

> **Limitation:** Tokens are stored in the browser's local storage (accepted for go-live in the checklist, section 9). A later change to an httpOnly, SameSite refresh cookie needs a backend change. The global and sign-in rate limits are counted per API process, so with several instances the effective limit is multiplied by the number of instances.

# Module map

## Backend modules

The API is a modular monolith: each module owns its routes, services and tables, and shares the database and the `lib/` services. Module routers are loaded in file-name order (the `system` module first) and mounted under `/api`; some modules mount extra prefixes (for example `clients` also serves `/customers`, `leads` serves `/lead` and `/leads`).

{widths: 22,12,66}
| Module (backend/src/modules) | Routes | Responsibility |
|---|---|---|
| auth | 15 | Sign-in, two-factor challenge and enrolment, refresh, logout, change / forgot / reset password, profile |
| users | 16 | Users and roles (User Management), role permissions, sessions, sign-in history |
| leads | 11 | Leads / prospects, statistics, lead report |
| clients | 6 | Clients and customer codes (`/clients`, `/customers`) |
| addresses | 5 | Provinces, cities, districts and postal codes |
| quotations | 38 | Quotation wizard, motor tariff, premium calculation, customer approval link, submission to insurer, conversion to policy, quotation masters, e-mail |
| policies | 12 | Policy list and detail, KYC, payment capture for finance confirmation, policy documents |
| endorsements | 8 | Endorsements and cancellations with re-pricing and billing |
| documents | 5 | Server-rendered PDFs: quotation, policy schedule, receipt |
| claims | 13 | Claim registration with acceptance check, lifecycle, settlement with maker-checker, documents and letters, claims reports |
| renewals | 42 | Renewal pipeline, renewal quotes, notices, batches and queue, workspace, analytics, win-back campaigns |
| receipts | 14 | Official receipts, application to bills, billing statements, receivables |
| collections | 9 | Collection items, follow-up actions, due-date reminders, KPIs |
| accounting | 24 | Accounting entries, ledgers per client / policy, open-item matching, trial balance, period close |
| journal-vouchers | 8 | Journal vouchers with maker-checker, correction and reversal |
| disbursements | 15 | Payment vouchers, invoice lists, cheques, commission and insurer payouts |
| payments | 26 | Open items, payments and petty cash (funds, requests, disbursements, receipts, replenishment) |
| commission | 19 | Commission accrual, eligibility, approval, payout; referrer accounts and dashboard |
| remittance | 85 | Remittances to insurers, bills, settlements, multi-level approvals and delegations, statements, direct bill (debit notes, collections) |
| reinsurance | 38 | Reinsurers, treaties, cessions, recoveries, bordereaux, reconciliation, analytics |
| incentive | 22 | Incentive programmes, calculation batches with maker-checker, results, reports |
| product-configurator | 72 | Product templates, components, rating, rules, risk mapping, versions |
| masters | 11 | Generic master data screens driven by `master_types` |
| reports | 13 | Report catalogue, on-screen run, file generation (CSV / XLSX / PDF), schedules |
| dashboard, search | 6 | Executive, sales, underwriting, claims and agent dashboards; global search |
| notifications | 8 | In-app notifications, unread count |
| uploads | 11 | File upload, signed download, existence check, delete (`/s3`, `/upload`) |
| settings, system-settings | 11 | Configuration keys by group; branding and system settings (public read for the sign-in page) |
| schedules | 4 | Scheduled jobs: list, run history, edit, run now |
| system | 1 | `GET /api/version`: build and runtime information |

Route counts are those of the route registry and `backend/docs/api/openapi.json` (568 operations: 271 GET, 210 POST, 57 PUT, 23 DELETE, 7 PATCH); renewals combines the `policy-renewals` and `renewals` prefixes, payments combines open items, payments and petty cash.

## Front-end areas and backend modules

![Front-end areas (menus) and the backend modules they use](d01_module_map)

# Integration points

{widths: 20,16,64}
| Integration | Direction | Description |
|---|---|---|
| SMTP e-mail | Outbound | `lib/mailer.js` queues messages in `email_outbox`; the `email-outbox` job (every 5 minutes) sends up to 50 queued messages per run through nodemailer and `SMTP_URL` when `notification.email_enabled` is true; up to 5 attempts, then `failed`. Sender: `notification.from_address`. |
| Client quote approval | Inbound (public) | The approval e-mail carries a signed token (`quotations.approval_link_ttl_hours`, 168 h); `POST /api/quotations/approve-by-customer` previews or accepts; only the latest token of a quotation is valid. |
| Insurers | Outbound (e-mail, files) | Quotation submission to the insurer's underwriting contact, remittance statements and bills, commission debit notes; CSV / XLSX / PDF files. No insurer API integration in the baseline. |
| Reinsurers | Outbound (files) | Bordereaux and reconciliation files generated as CSV. |
| Spreadsheet imports | Inbound (files) | Bulk uploads (for example disbursements, remittance items, policies) through `importUpload()`: one file of at most `IMPORT_MAX_MB` (10 MB), decompressed size capped at `IMPORT_MAX_INFLATED_MB` (50 MB) and `IMPORT_MAX_ROWS` (20,000) rows. |
| Payment gateway | Not integrated | Policy payments are captured by staff with proof of payment (`policy_payments`) and confirmed by finance; the payment screen shows a gateway only if configured. |
| API documentation | Developer | `npm run export:api` generates `backend/docs/api/openapi.json`, a Postman collection and environment, and `BrokerVerse_API_Touchpoints.xlsx` / `.csv` from the route registry. |
| Monitoring | Operations | `GET /api/health` (readiness), `GET /api/health/live` (liveness), `GET /api/version` (build, commit from `GIT_COMMIT`, database reachability, pending migrations); JSON logs on stdout (document 11). |

# Security architecture summary

## Roles and permissions

Permissions are codes `read:<module>` and `write:<module>` for 25 modules (50 permission rows). Nine roles are seeded (`backend/src/db/seed.js`); administrators can create further roles and change grants in User Management.

{widths: 22,78}
| Role | Access (seeded grants) |
|---|---|
| it-admin, ba | Administrator roles: every permission (checked in code as administrator) |
| user-access-admin | Users, roles, audit trail (read), notifications, settings (read); cannot grant administrator roles or change its own access |
| sales | Leads, clients, quotations, policies, endorsements, renewals, reports, notifications; read products, masters, claims |
| underwriting | Clients, quotations, policies, endorsements, renewals, reinsurance, products, reports; read leads, masters, claims |
| customer-services | Leads, clients, quotations, policies, endorsements, renewals, reports; read claims, masters, products |
| claims | Claims, reports; read clients, policies, masters |
| finance | Receipts, collections, disbursements, commission, remittance, incentive, journal vouchers, reports; read clients, policies, claims, masters, schedules |
| agent | Own leads, quotations, policies, endorsements and claims (first notice of loss); read clients; record-scoped |

The server enforces permissions on every route (`requirePermission`, `requireRole`); the front end additionally hides menus and blocks routes by role (`utils/menuPermissions.js`, deny by default, and `routes/ProtectedRoute`). Receipts are finance-only (segregation of duties).

## Controls

{widths: 24,76}
| Control | Implementation |
|---|---|
| Record scope | Users whose roles are all listed in `security.scoped_roles` (default `agent`) see and act only on records they own or that belong to their clients (`lib/scope.js`); someone else's record answers 404 so its existence is not disclosed. |
| Maker-checker | A different user must approve: journal vouchers, payment vouchers and cheques, commission payouts, remittances and settlements (multi-level with delegation), commission debit notes, claim settlements, incentive calculations, reinsurance treaties, petty cash requests, quotation and renewal approvals. |
| Audit | `lib/audit.js` writes `audit_log` (user, entity, id, action, before / after JSON, IP) from every mutating handler; claims keep a field-level trail (`claim_field_changes`), quotations expose an audit trail; sign-ins in `login_history`. |
| Input validation | zod schemas on request bodies and parameters where declared; parameterised SQL only (no request values concatenated into SQL; dynamic identifiers white-listed). |
| Uploads | Type checked against `uploads.allowed_types` by file signature, detected type stored; per-file size `UPLOAD_MAX_MB` (10 MB) and `UPLOAD_MAX_FILES` (10); files served with `nosniff` and a sandbox CSP, non-image / non-PDF files as downloads. |
| Transport and headers | TLS at the load balancer / CloudFront; helmet headers on the API; nginx adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`; CORS limited to `CORS_ORIGINS` (`*` refused in production). |
| Secrets | Production start refuses a missing, placeholder or short (< 32 characters) `JWT_SECRET` / `DATA_ENCRYPTION_KEY`, equal keys, `CORS_ORIGINS=*` or a localhost `PUBLIC_BASE_URL`. Reset codes are stored only as HMAC hashes. |
| Logging | pino JSON logs with redaction of authorization headers, cookies, passwords, refresh tokens and token / signature query parameters; 5xx responses return a generic message with the request id. |

# Key business flows

## Lead, quotation, policy and billing

![Lead to quotation to policy to billing](seq_quote_policy)

## Receipt, commission and remittance

![Receipt, commission payout and remittance to the insurer](seq_receipt_commission)

## Direct bill

![Direct bill: commission debit note to the insurer](seq_directbill)

## Claims

![Claim registration to settlement](seq_claims)

## Renewal

![Renewal pipeline to renewed policy](seq_renewal)

## Scheduled jobs

{widths: 22,16,62}
| Job (scheduled_jobs.code) | Cron | Work |
|---|---|---|
| policy-expiry | `15 0 * * *` | Mark active / issued policies past their expiry date as expired |
| quote-expiry | `30 0 * * *` | Expire quotations older than `limits.quote_validity_days` (30) |
| daily-reports | `0 5 * * *` | Generate production register, collections summary and claims position; purge generated reports older than `reports.retention_days` (90) |
| renewal-pipeline | `30 5 * * *` | Enrol policies expiring within the pipeline window; lapse renewals past the grace period |
| renewal-notices | `0 6 * * *` | Renewal reminders at 60, 30 and 15 days (`limits.renewal_notice_days`) |
| receivable-ageing | `0 7 * * *` | Recompute age and ageing bucket of open bills |
| collection-reminders | `0 8 * * *` | E-mail and notify clients with premiums falling due |
| email-outbox | `*/5 * * * *` | Deliver queued e-mails |
| renewal-queue | `* * * * *` | Send queued renewal batch notices, retry stale queue items |

Report schedules created under Reports > Schedules add further jobs (`report-<id>`, handler `scheduledReport`).

> **Gap:** node-cron is started without a time zone, so cron expressions are evaluated in the container's time zone. The Docker image and the local system run in UTC (the last runs of `renewal-notices` were at 06:00 UTC, 14:00 Manila time). The daily jobs therefore run 8 hours later than their cron suggests for Asia/Manila users. Set `TZ=Asia/Manila` on the API containers or pass `general.timezone` to `cron.schedule` (recommended fix).

# Architecture decisions and constraints

{widths: 30,70}
| Decision | Rationale and consequence |
|---|---|
| Modular monolith | One deployable API with module folders keeps transactions (policy, bill, journal, commission) in one database transaction; modules can be split later along the folder boundaries. |
| Stateless API | Sessions are tokens; state is in PostgreSQL and the file store, so instances can be added behind a load balancer (document 07). In-process caches (settings) and counters (rate limits) are per instance. |
| Migrations and seed on start | Every instance applies pending migrations in a transaction and the idempotent seed before it reports ready; simple to operate, but a failed migration blocks start-up (document 07, 09). |
| Configuration over code | 273 settings in `app_settings` (tax rates, numbering prefixes, limits, templates, security policy), editable in Master > Configuration and System Settings. |
| No third-party document libraries | PDF, XLSX, CSV and ZIP writers are implemented in the code base, reducing dependencies and licence exposure; layout features are deliberately simple. |
| Local file store behind an S3-style API | `uploads/storage.js` keeps an S3-like key space on disk ("swap for S3 by replacing these functions"); production uses a shared volume (EFS) so all instances see the same files. |
