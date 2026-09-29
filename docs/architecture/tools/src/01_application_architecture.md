# Introduction

## Purpose and scope

This document describes the application architecture of BrokerVerse OOTB, the insurance broking platform of iorta TechNXT for brokers in the Philippines. It covers the logical components, the deployment, how a request is processed and secured, how the functional modules map to the front end and the backend, the external integrations and the main business flows. It is the entry point to the Solution Architecture set. Documents 02 to 11 give the detail on the database, the technology, the shared services and operations.

The description is taken from the code and configuration of the baseline named in the document control section: the React front end in `brokerverse/`, the Node.js API in `backend/`, `docker-compose.yml`, the deployment package in `deploy/` (`README.md` and `REFERENCE.md`) and the GitHub workflows `.github/workflows/ci.yml` and `brokerverse/.github/workflows/deploy.yml`.

## Architecture at a glance

| Aspect | BrokerVerse OOTB |
|---|---|
| Style | Three-tier web application: single-page application (SPA), stateless REST API and a relational database. The server is a modular monolith. |
| Presentation tier | React 18 SPA built with Create React App and craco, PrimeReact components and Redux Toolkit. Served as static files from S3 and CloudFront on the existing BrokerVerse URL (nginx in the Docker Compose option). |
| Application tier | Node.js 22 (ES modules) with Express 4. 38 module folders mounted under `/api` with 717 registered routes, plus two health endpoints. A built-in scheduler runs 15 jobs in the business time zone (Asia/Manila). |
| Data tier | PostgreSQL 16 with the database time zone set to Asia/Manila: 138 tables from 58 migration files, applied on start under an advisory lock. Files on a persistent volume (`UPLOAD_DIR`). |
| Integration | Office 365 SMTP for outbound e-mail through an outbox table; public quote approval link for clients; spreadsheet uploads and go-live imports with 39 published templates; OpenAPI, Postman and Excel API documentation generated from the route registry. |
| Security | JWT access tokens (30 minutes) with rotating refresh tokens (30 days), token version revocation, role and permission checks on every route, role inheritance, maker-checker approvals, audit log, TOTP two-factor sign-in, HMAC-signed file links. |
| Deployment | AWS ap-southeast-1 on the existing BrokerVerse URL: the front end through its GitHub workflow to S3 and CloudFront; the backend container from `backend/Dockerfile` behind HTTPS; PostgreSQL 16; a persistent upload volume; secrets in a secret store. Docker Compose serves a single server or a test system. |

# Solution component diagram

## Logical components

![Logical component view of BrokerVerse OOTB](d01_logical_components)

{widths: 22,78}
| Component | Responsibility |
|---|---|
| Browser SPA | All user screens: operations (leads to renewals, including broker slips and placement slips), accounts (billing, receipts, remittance, commission, journals, period end, bank reconciliation, tax), product configurator, reinsurance, reports, dashboards, masters and administration. It holds the session tokens, renews them automatically and hides the menus a role may not open. |
| Static hosting | Serves the compiled SPA (HTML, JavaScript, CSS, images). There is no server-side rendering; every data call goes to `/api`. |
| HTTP pipeline | Request handling in `backend/src/app.js`: request id, security headers (helmet), CORS, structured access log with redaction, global rate limit, JSON size limit, signing of file URLs in responses, one error envelope. |
| Business modules | 38 folders in `backend/src/modules`. Each has a `router.js` that declares its endpoints through the route registry, and services that hold the business rules and SQL. They are loaded automatically at start. The larger modules (accounting, placement, period-end, bank-reconciliation, remittance, reports, document-numbering) have their own README. |
| Shared services | `backend/src/lib`: authentication, permissions, settings cache, audit, document numbering, e-mail outbox, secrets and signed links, business dates, money rounding, validation, rate limits, health, the PDF engine and the letterhead (document 05). |
| Scheduler | `backend/src/jobs/scheduler.js`: node-cron schedules the enabled rows of `scheduled_jobs` in the time zone `general.timezone`. Each run takes a PostgreSQL advisory lock so it runs once across instances, and is recorded in `job_runs`. Schedule changes reach every instance within 30 seconds. |
| File engines | One PDF engine (`lib/pdf`) for every document and report, with the letterhead of the primary company of the Company master; XLSX, CSV and ZIP writers in `lib/`. No third-party document library. |
| PostgreSQL | System of record for business, financial, configuration, security and log data (documents 02 and 03). |
| File store | `UPLOAD_DIR` (`/app/uploads` in the container): uploaded documents and photos, generated reports and statements, registered in the `documents` table. |
| SMTP server | Office 365 (`smtp.office365.com`, port 587, STARTTLS) delivers the e-mail queued in `email_outbox`: quote approval links, broker slip requests and placement orders to insurers, password reset codes, renewal and collection reminders, report schedules and remittance statements. |

## Front-end application structure

The SPA (`brokerverse/src`, 848 JavaScript and JSX files) is organised by functional area:

{widths: 26,74}
| Folder | Content |
|---|---|
| `agentModule/` | Operations screens: leads, quotation wizard, policy, endorsements, claims, renewals, collections, open items, payments, the Sales Dashboard and the customer quote approval page. The folder name is historical; there is no agent sign-in. |
| `module/` | Back-office areas: Administration, BankReconciliation, ClaimsModule, Commission, CorrectionJV, ExecutiveDashboard, FinanceMastersModule, GeneralMasters, Incentive, JournalVoucher, PaymentVoucher, PeriodEnd, PettyCashManagement, Placement, ProductConfigurator, Receipts, Reinsurance, Remittance, Renewal, Reports, Reversals, SystemSettings, UnderwritingModule, accounts |
| `services/` | 43 API client services (one per backend area, for example `placementService.js`, `periodEndService.js`, `bankReconciliationService.js`, `importService.js`) |
| `routes/` | `MainRoute.js` (416 routes) and `ProtectedRoute` (route guard) |
| `redux/`, `context/`, `hooks/` | Redux Toolkit store (reset on sign-out), notification context, currency formatting hook |
| `utility/`, `utils/` | Shared helpers: HTTP interceptor and session refresh, menu permissions, dialogs and toasts, date, number and phone formatting, idle time-out, system settings, a logger that is silent in production |
| `components/` | Reusable UI: layout, header, side bar, file upload, dialogs, toasts, status badges, stepper, notification drop-down |
| `locales/`, `i18n.js` | i18next resources: English (`en.json`, complete) and Thai (`th.json`, partial). Filipino is listed in the settings but has no translation file. |

# Deployment view

## Production deployment on the existing BrokerVerse URL

`deploy/README.md` is the checklist the iorta TechNXT DevOps team follows to connect the source to the existing BrokerVerse URL; `deploy/REFERENCE.md` gives every environment variable, the seed data, the scheduled jobs, the health checks and the production start-up rules. Figure 2 shows the result. The AWS service names in dashed boxes and the "e.g." choices are options the checklist leaves open.

![Production deployment on the existing BrokerVerse URL (AWS ap-southeast-1)](d01_deployment_aws)

{widths: 24,46,30}
| Layer | Fact from the baseline | To be confirmed by DevOps |
|---|---|---|
| Front-end build and hosting | `brokerverse/.github/workflows/deploy.yml`: on a push to `dev`, Node 22, `npm ci`, front-end tests, a check that the repository variable `REACT_APP_BASE_URL` is set, build, `aws s3 sync build/ s3://$S3_BUCKET --delete`, CloudFront invalidation `/*`, region ap-southeast-1. A failing test stops the deployment. | GitHub OIDC role instead of long-lived access keys; S3 versioning for roll-back |
| API address | Same-domain option recommended: CloudFront behaviour `/api/*` to the backend load balancer, all methods and headers, no caching. Separate domain possible with `CORS_ORIGINS`. | Choice of option |
| CloudFront errors | Custom error responses 403 and 404 return `/index.html` with status 200, so deep links work. | |
| API runtime | `backend/Dockerfile`: `node:22-alpine`, `npm ci --omit=dev`, runs as user `node`, port 8000, `HEALTHCHECK` on `/api/health`. Behind a load balancer with HTTPS. | ECS Fargate, App Runner or EC2; number of instances |
| Database | PostgreSQL 16, created empty with a login that may create tables; database time zone `Asia/Manila`. The API migrates and seeds it on start. `?sslmode=require` on RDS. | Amazon RDS class, Multi-AZ, backup retention (at least 30 days in the checklist) |
| Files | A persistent volume at `UPLOAD_DIR` (`/app/uploads`) is required; a container without it loses documents on restart. | EFS or another shared volume when more than one instance runs |
| E-mail | Office 365: `SMTP_URL=smtp://connect%40iortatechnxt.com:<password>@smtp.office365.com:587`, sender `BrokerVerse <connect@iortatechnxt.com>`; Authenticated SMTP turned on for the mailbox. E-mail is off until "Send e-mails" is switched on in Master > Configuration. | App password if the tenant enforces multi-factor sign-in |
| Secrets | `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `ADMIN_PASSWORD`, `DATABASE_URL`, `SMTP_URL` in a secret store (AWS Secrets Manager, SSM Parameter Store or the GitHub environment), never in a repository. The production start refuses unsafe values. | Secrets Manager or SSM |
| Repository CI | `.github/workflows/ci.yml` on every push to `brokerverse-platform` or `main` and on pull requests: backend lint and tests against PostgreSQL 16, front-end tests and production build, backend image build. | Image registry and backend release pipeline |

## Docker Compose

`docker-compose.yml` runs the system on one server, a test system or for a trial. It has three services. `db` runs `postgres:16-alpine` with a `pg_isready` health check and the volume `db-data`. `api` is built from `backend/`, runs with `NODE_ENV=production` by default, refuses to start without `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `ADMIN_PASSWORD`, `CORS_ORIGINS` and `PUBLIC_BASE_URL`, and keeps files in the volume `uploads`. `web` is built from `brokerverse/` (nginx 1.27) and publishes port 8080; it serves the SPA and forwards `/api/` to the API container. A TLS proxy must be placed in front of port 8080.

![Docker Compose deployment (docker-compose.yml)](d01_deployment_compose)

# Request processing

## API request pipeline

Every request passes the same middleware chain before it reaches a handler. The route registry (`backend/src/lib/registry.js`) places `requireAuth` first on every route that is not declared `auth: false`, so an endpoint cannot be left open by mistake. 14 routes are public by design: sign-in, the two-factor step, refresh, logout, forgot and reset password, the password policy, the public system settings (two routes), the version, the customer quote approval, a file download with a signed link (two routes) and a generated report download with a signed token.

![Request pipeline of the BrokerVerse API](d01_request_pipeline)

## Authentication and session flow

![Sign-in, refresh-token rotation and signed file links](seq_auth)

{widths: 30,70}
| Mechanism | Implementation |
|---|---|
| Access token | JWT, HS256 only, lifetime `JWT_ACCESS_TTL_SECONDS` (default 1,800 s). Claims: user id, username, effective roles, permissions, `type=access`, `tv` (token version) and an optional `restrict` (`enrol2fa`, `pwchange`). |
| Per-request check | `authenticate()` verifies the signature and type, then reads `users.status` and `users.token_version`. An inactive user or a changed token version ends the session at once (HTTP 401). |
| Refresh token | JWT with a `jti` recorded in `refresh_tokens` (lifetime `JWT_REFRESH_TTL_SECONDS`, default 30 days), rotated on every use. Reuse of a rotated token after the grace window revokes the whole token family and is audited. |
| Revocation | Password change or reset, administrator reset, deactivation and role or permission changes raise `token_version` and revoke refresh tokens. |
| Sign-in protection | Limit of 10 attempts per 5 minutes per IP and per username (`security.login_rate_limit`); account locked after `limits.max_login_attempts` (5) wrong passwords; every attempt recorded in `login_history`. |
| Password policy | Minimum length 8, upper and lower case, digit and symbol, history of 5, maximum age 90 days (`security.password_*`). A must-change or expired password gets a restricted token. Users created by an administrator or by `scripts/provision-users.js` must change the initial password at the first sign-in. |
| Two-factor | TOTP (RFC 6238) in `lib/totp.js`; secrets encrypted at rest with AES-256-GCM under `DATA_ENCRYPTION_KEY`. Roles that must use it are set in `security.require_2fa_roles` (empty by default; the checklist suggests system-admin, accounting and accounting-manager). |
| Front end | Tokens kept in `localStorage`. `utility/sessionRefresh.js` wraps `fetch` and `utility/interceptor.js` wraps axios with one shared refresh. Idle sign-out after `limits.session_idle_minutes` (30) with a one-minute warning. |
| File links | Stored documents are served by `GET /api/s3/object/<key>` only with a bearer token or an HMAC-signed link (`?exp=&sig=`) valid for `FILE_URL_TTL_SECONDS` (1,800 s). The API signs every object URL in JSON responses on the way out. |

> **Limitation:** Tokens are stored in the browser's local storage; this is accepted for go-live (`deploy/README.md`, section 9). A change to an httpOnly, SameSite refresh cookie needs a backend change. The global and sign-in rate limits are counted per API process, so with several instances the effective limit is multiplied by the number of instances.

# Module map

## Backend modules

The API is a modular monolith. Each module owns its routes, services and tables and shares the database and the `lib/` services. Module routers are loaded in folder order (the `system` module first) and mounted under `/api`. Some modules mount extra prefixes: `placement` serves `/broker-slips` and `/placements`, `posting-rules` also serves `/account-determination`, `payments` serves `/open-items` and `/petty-cash`.

{widths: 22,10,68}
| Module (backend/src/modules) | Routes | Responsibility |
|---|---|---|
| auth | 15 | Sign-in, two-factor challenge and enrolment, refresh, logout, change, forgot and reset password, profile |
| users | 16 | Users and roles (User Management), role permissions and inheritance, sessions, sign-in history |
| leads | 11 | Leads and prospects, statistics, lead report, lead upload |
| clients | 6 | Clients and customer codes (`/clients`, `/customers`) |
| addresses | 5 | Provinces, cities, districts and postal codes |
| quotations | 38 | Quotation wizard, motor tariff, premium calculation, customer approval link, submission to the insurer, conversion to policy, quotation masters, e-mail |
| placement | 26 | Broker slips to several insurers, insurer offers and comparison, placement slips, binding per co-insurer, policy issue and "Record Issued Policy"; the journey per product type (`placement.journey`) |
| policies | 12 | Policy list and detail, KYC, payment capture for accounting confirmation, policy documents, policy upload |
| endorsements | 8 | Endorsements and cancellations with re-pricing, return premium and billing |
| documents | 5 | Server-rendered PDFs (quotation, policy schedule, receipt) and upload template downloads |
| claims | 16 | Claim registration with acceptance check, lifecycle, settlement with maker-checker, settlement cash from insurers to the claimant, documents and letters, claims reports |
| renewals | 42 | Renewal pipeline, renewal quotes, notices, batches and queue, workspace, analytics, win-back campaigns |
| receipts | 16 | Official receipts, application to bills, billing statements, receivables, open items import for go-live |
| collections | 9 | Collection items, follow-up actions, due-date reminders, KPIs |
| accounting | 27 | Journal engine, ledgers per client and policy, open-item matching and write-off, trial balance, chart of accounts and its upload |
| posting-rules | 14 | Posting rules per business event with versions and simulation; Account Determination (the GL account of each account role) |
| journal-vouchers | 8 | Journal vouchers with maker-checker, correction and reversal |
| period-end | 45 | Fiscal years, period status, month-end and year-end close, recurring and accrual journals, financial statements, tax codes, BIR Form 2307, go-live opening balances |
| bank-reconciliation | 38 | Statement formats and import, matching rules and workspace, adjustments, stale cheques, monthly reconciliation with approval |
| disbursements | 15 | Payment vouchers, invoice lists, cheques, commission and insurer payouts |
| payments | 29 | Open items, payments and petty cash (funds, requests, disbursements, receipts, replenishment) |
| commission | 19 | Commission accrual, eligibility, approval, payout and clawback; referrer accounts and dashboard |
| commission-rates | 7 | Commission rate matrix per insurer, product, line and policy type with effective dates |
| remittance | 86 | Remittances to insurers, bills, settlements, multi-level approvals and delegations, statements, refunds due from insurers, direct bill (debit notes, collections) |
| reinsurance | 38 | Reinsurers, treaties, cessions, recoveries, bordereaux, reconciliation, analytics |
| incentive | 22 | Incentive programmes, calculation batches with maker-checker, results, reports |
| product-configurator | 72 | Product templates, components, rating, rules, risk mapping, versions |
| masters | 13 | Generic master data screens driven by `master_types`, master uploads |
| document-numbering | 5 | Document number series: prefix, pattern, width, reset rule and next number |
| reports | 13 | Report catalogue, on-screen run, file generation (CSV, XLSX, PDF), schedules |
| dashboard, search | 6 | Executive, sales, processing and claims dashboards; global search |
| notifications | 8 | In-app notifications and unread count |
| uploads | 11 | File upload, signed download, existence check, delete (`/s3`, `/upload`) |
| settings, system-settings | 11 | Configuration keys by group, audit trail query; branding and system settings (public read for the sign-in page) |
| schedules | 4 | Scheduled jobs: list, run history, edit, run now |
| system | 1 | `GET /api/version`: build and runtime information |

Route counts come from the route registry through `collectRoutes()` in `backend/src/tools/export-api.js`, the same list that `npm run export:api` writes to `backend/docs/api/openapi.json`: 717 operations (331 GET, 277 POST, 74 PUT, 28 DELETE, 7 PATCH).

## Front-end areas and backend modules

![Front-end areas (menus) and the backend modules they use](d01_module_map)

# Integration points

{widths: 20,16,64}
| Integration | Direction | Description |
|---|---|---|
| SMTP e-mail | Outbound | `lib/mailer.js` queues messages in `email_outbox`. The `email-outbox` job (every 5 minutes) sends up to 50 queued messages per run through nodemailer and `SMTP_URL` when `notification.email_enabled` is true; up to 5 attempts, then `failed`. Sender: `notification.from_address` (`BrokerVerse <connect@iortatechnxt.com>`; Office 365 refuses any other sender for that mailbox). |
| Client quote approval | Inbound (public) | The approval e-mail carries a signed token (`quotations.approval_link_ttl_hours`, 168 h). `POST /api/quotations/approve-by-customer` previews or accepts; only the latest token of a quotation is valid. |
| Insurers | Outbound (e-mail, files) | Broker slip requests for quotation, placement orders to the lead insurer and co-insurers, remittance statements and bills, commission debit notes; PDF, CSV and XLSX files. Insurer answers are keyed as offers. There is no insurer API integration. |
| Reinsurers | Outbound (files) | Bordereaux and reconciliation files generated as CSV. |
| Uploads and go-live imports | Inbound (files) | Masters, chart of accounts, leads, quotations, policies, receipts, payment vouchers, opening balances, open items, bank statements and remittance bulk files through `importUpload()`: one file of at most `IMPORT_MAX_MB` (10 MB), decompressed size capped at `IMPORT_MAX_INFLATED_MB` (50 MB) and `IMPORT_MAX_ROWS` (20,000) rows. The 39 templates in `docs/templates` are generated from the importers' own column lists and checked by `backend/test/upload-templates.test.js`. |
| Bank statements | Inbound (files) | CSV or XLSX statements read with a statement format (layouts of three Philippine banks and a generic layout ship as standard) for bank reconciliation. |
| User provisioning | Operations | `scripts/provision-users.js` creates named users from a CSV kept outside the repository (dry run unless `CONFIRM_PROVISION=yes`). |
| Payment gateway | Not integrated | Policy payments are captured by staff with proof of payment (`policy_payments`) and confirmed by Accounting. |
| API documentation | Developer | `npm run export:api` writes `backend/docs/api/openapi.json`, a Postman collection and environment, and `BrokerVerse_API_Touchpoints.xlsx` and `.csv` from the route registry. |
| Monitoring | Operations | `GET /api/health` (readiness), `GET /api/health/live` (liveness), `GET /api/version` (build, commit from `GIT_COMMIT`, database reachability, pending migrations); JSON logs on stdout (document 11). |

# Security architecture summary

## Roles and permissions

Permissions are codes `read:<module>` and `write:<module>` for 27 modules, plus `approve:period-end` and `approve:bank-reconciliation`: 56 permission rows. Seven roles are seeded (`backend/src/db/seed.js` and migration `0140_broker_roles.sql`). A role can inherit another role (`roles.inherits`); the effective roles of a user are resolved by the database function `user_effective_roles()`. Administrators can create further roles and change grants in User Management.

{widths: 26,74}
| Role | Access (seeded grants) |
|---|---|
| System Administrator (Super Admin Access), `system-admin` | Every permission; configuration, users and roles. Only a System Administrator can grant this role or change an administrator account, and nobody can change their own roles or status. |
| Sales & Marketing (Account Executive), `sales` | Leads, clients, quotations, policies, endorsements, renewals, reports, notifications; read products, masters and claims |
| Processing Team (Placement & Policy Processing), `processing` | Broker slips and placement (quotation permissions), policies, endorsements, renewals, reinsurance, product templates, clients, reports; read leads, masters and claims |
| Operations (Client Servicing), `operations` | Leads, clients, quotations, policies, endorsements, renewals, reports; read claims, masters and products |
| Claims, `claims` | Claims, reports; read clients, policies and masters |
| Accounting, `accounting` | Receipts, collections, disbursements, commission, remittance, incentive, journal vouchers, period end, bank reconciliation, reports; read clients, policies, claims, masters and schedules |
| Accounting Manager, `accounting-manager` | Inherits Accounting, plus `approve:period-end` and `approve:bank-reconciliation`: approves month-end and year-end closes and bank reconciliations, posts into soft-closed periods and reopens periods |

There is no agent sign-in. Referrers and sub-agents are a master (`commission_referrers`): Sales & Marketing enter their business and Accounting pays them. The server enforces permissions on every route (`requirePermission`, `requireRole`); the front end also hides menus and blocks routes by role (`utils/menuPermissions.js`, deny by default, and `routes/ProtectedRoute`). Receipts are an Accounting function (segregation of duties).

## Controls

{widths: 24,76}
| Control | Implementation |
|---|---|
| Record scope | Users whose roles are all listed in `security.scoped_roles` see and act only on records they own or that belong to their clients (`lib/scope.js`); another user's record answers 404. The setting is empty in the seed, so no role is scoped. |
| Maker-checker | A different user must approve: journal vouchers, payment vouchers and cheques, commission payouts, remittances and settlements (multi-level with delegation), commission debit notes, claim settlements, incentive calculations, reinsurance treaties, petty cash requests, month-end and year-end closes, bank reconciliations, quotation and renewal approvals (`lib/makerChecker.js`, switch `finance.maker_checker_enabled`). |
| Period control | Every journal passes `assertPostingAllowed`: open periods accept all postings, soft-closed periods only postings by `approve:period-end`, closed and locked periods none. A trigger on `journal_vouchers` checks balance and period again at posting. |
| Audit | `lib/audit.js` writes `audit_log` (user, entity, id, action, before and after JSON, IP) from every mutating handler; claims keep a field-level trail (`claim_field_changes`); period and reconciliation status changes have their own history tables; sign-ins are in `login_history`. |
| Input validation | zod schemas on request bodies and parameters where declared; parameterised SQL only, with dynamic identifiers taken from white lists. |
| Uploads | Type checked against `uploads.allowed_types` by file signature and the detected type stored; per-file size `UPLOAD_MAX_MB` (10 MB) and `UPLOAD_MAX_FILES` (10); files served with `nosniff` and a sandbox CSP, and anything other than images and PDF as a download. |
| Transport and headers | TLS at the load balancer and CloudFront; helmet headers on the API; nginx adds `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` in the Compose option; CORS limited to `CORS_ORIGINS` (`*` refused in production). |
| Secrets | Production start refuses a missing, placeholder or short (under 32 characters) `JWT_SECRET` or `DATA_ENCRYPTION_KEY`, equal keys, `CORS_ORIGINS=*` or a localhost `PUBLIC_BASE_URL`. Reset codes are stored only as HMAC hashes. |
| Logging | pino JSON logs with redaction of authorization headers, cookies, passwords, refresh tokens and token or signature query parameters; 5xx responses return a generic message with the request id. |

# Key business flows

## Lead, placement, policy and billing

![Lead to placement to policy to billing](seq_quote_policy)

## Receipt, commission and remittance

![Receipt, commission payout and remittance to the insurer](seq_receipt_commission)

## Direct bill

![Direct bill: commission debit note to the insurer](seq_directbill)

## Claims

![Claim registration to settlement and cash](seq_claims)

## Renewal

![Renewal pipeline to renewed policy](seq_renewal)

## Period end

Accounting prepares the month-end close for a period (run `MEC-`): accrual and recurring journals, unearned commission deferral, FX revaluation and the checklist. The manual checklist items are signed and the run is submitted. When `accounting.period_close_requires_approval` is on, an Accounting Manager approves and the period becomes closed. Executing a run again first reverses its own earlier journals, so a rerun gives the same ledger. The year-end close (run `YEC-`) needs twelve closed periods; it posts the closing entries in period 13, carries the balance-sheet balances into `opening_balances` of the next year, locks the year and creates the next one. At go-live, the old system's trial balance is loaded into `opening_balances` and the open premium receivables as open items, with the templates in `docs/templates`.

## Scheduled jobs

All cron expressions are read in the business time zone (`general.timezone`, Asia/Manila), whatever the time zone of the server clock. The seed and the migrations create 15 jobs; 10 are enabled by default.

{widths: 24,14,10,52}
| Job (scheduled_jobs.code) | Cron | Enabled | Work |
|---|---|---|---|
| policy-expiry | `15 0 * * *` | yes | Mark policies past their expiry date as expired |
| quote-expiry | `30 0 * * *` | yes | Expire quotations older than `limits.quote_validity_days` |
| housekeeping | `45 2 * * *` | yes | Delete operational rows past their retention period (System Settings > Housekeeping; the audit trail is kept) |
| daily-reports | `0 5 * * *` | yes | Generate the daily reports; purge generated reports older than `reports.retention_days` (90) |
| renewal-pipeline | `30 5 * * *` | yes | Enrol policies expiring within the pipeline window; lapse renewals past the grace period |
| renewal-notices | `0 6 * * *` | yes | Renewal reminders at the configured notice days |
| receivable-ageing | `0 7 * * *` | yes | Recompute the age and ageing bucket of open bills |
| collection-reminders | `0 8 * * *` | yes | E-mail and notify clients with premiums falling due |
| email-outbox | `*/5 * * * *` | yes | Deliver queued e-mails |
| renewal-queue | `* * * * *` | yes | Send queued renewal batch notices, retry stale queue items |
| accrual-reversal | `30 0 1 * *` | no | Reverse last month's accrual journals on day 1 |
| recurring-journals | `15 1 * * *` | no | Create the journals of recurring templates that are due |
| period-auto-soft-close | `0 2 * * *` | no | Soft-close periods after the grace days |
| bank-auto-match | `45 5 * * *` | no | Run the automatic bank matching rules |
| month-end-reminder | `0 8 * * *` | no | Remind Accounting of the coming month-end |

Report schedules created under Reports > Schedules add further jobs (`report-<id>`, handler `scheduledReport`). The period-end and bank-matching jobs are disabled by default; Accounting switches them on in Master > Schedules when the business is ready.

# Architecture decisions and constraints

{widths: 30,70}
| Decision | Rationale and consequence |
|---|---|
| Modular monolith | One deployable API keeps an operation (policy, bill, journal, commission) in one database transaction. Modules can be split later along the folder boundaries. |
| Stateless API | Sessions are tokens; state is in PostgreSQL and the file store, so instances can be added behind a load balancer (document 07). The settings cache is per instance but checks the table version every 5 seconds, so a change reaches every instance within seconds. Rate-limit counters stay per instance. |
| Migrations and seed on start | Every instance takes an advisory lock, applies pending migrations (each in its own transaction) and the idempotent seed before it reports ready. Instances that start together wait for the first one. A failed migration blocks start-up (documents 07 and 09). |
| Posting rules as data | Every system journal is built from the posting rule of its business event and the account roles of Account Determination. Accounting can change the GL treatment without a code change; each rule version has an effective date. |
| Configuration over code | 351 settings in `app_settings` (tax rates, account roles, limits, templates, security policy, retention periods), 52 document number series and the commission rate matrix are edited in the application. |
| One PDF engine, no third-party document libraries | PDF, XLSX, CSV and ZIP writers are part of the code base. Every PDF carries the letterhead of the primary company of the Company master, so the broker's own details print on every document and report once the master is updated. |
| Business time zone | Business dates, document number years, column defaults and job schedules use `general.timezone` (Asia/Manila); the database time zone is also set to Asia/Manila. Instants are stored in `timestamptz`. |
| Local file store behind an S3-style API | `uploads/storage.js` keeps an S3-like key space on disk. With more than one instance the volume must be shared (for example EFS) so every instance sees the same files. |
