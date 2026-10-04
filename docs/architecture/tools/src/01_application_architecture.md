# Introduction

## Purpose and scope

This document describes the application architecture of BrokerVerse OOTB, the insurance broking platform of iorta TechNXT for brokers in the Philippines. It covers the logical components, the deployment, how a request is processed and secured, how the functional modules map to the front end and the backend, the external integrations and the main business flows. It is the entry point to the Solution Architecture set. Documents 02 to 11 give the detail on the database, the technology, the shared services and operations.

The description is taken from the code and configuration of the baseline named in the document control section: the React front end in `brokerverse/`, the Node.js API in `backend/`, `docker-compose.yml`, the deployment package in `deploy/` (`README.md` and `REFERENCE.md`) the release pipeline (`deploy/RELEASE_PIPELINE.md`, `.github/workflows/ci.yml`, `deploy.yml`, `rollback.yml`) and the onboarding guides in `docs/onboarding`. Where a fact depends on package B (Insurance Commission and data privacy compliance, with encryption and masking of personal data) or package G (sales activities, quote covers and risk fields, supplier BIR Form 2307, fixed asset disposal), both being merged, it says so.

## Architecture at a glance

| Aspect | BrokerVerse OOTB |
|---|---|
| Style | Three-tier web application: single-page application (SPA), stateless REST API and a relational database. The server is a modular monolith. |
| Presentation tier | React 18 SPA built with Create React App and craco, PrimeReact components and Redux Toolkit. Served as static files from S3 and CloudFront on the existing BrokerVerse URL (nginx in the Docker Compose option). |
| Application tier | Node.js 22 (ES modules) with Express 4. 70 module folders mounted under `/api` with 1,291 registered routes (73 folders and 1,356 routes with packages B and G), plus two health endpoints. A built-in scheduler runs 32 jobs (35 with package B) in the business time zone (Asia/Manila). An integration framework sends and receives third-party messages through an outbox with retries. |
| Data tier | PostgreSQL 16 with the database time zone set to Asia/Manila: 250 tables from 139 migration files (260 tables and 149 files with packages B and G), applied on start under an advisory lock. Files on a persistent volume (`UPLOAD_DIR`). |
| Integration | Office 365 SMTP through an outbox table; payment gateways; SMS and Viber, CTPL authentication and LTO, insurer APIs and bank payment files through the integration framework (delivered in test mode); BIR EIS outbox; public links for quote approval, payment and campaign opt-out; go-live data workbench and upload templates; API documentation generated from the route registry. |
| Security | JWT access tokens (30 minutes) with rotating refresh tokens (30 days), token version revocation, role and permission checks on every route, role inheritance, maker-checker approvals, audit log with source, TOTP two-factor sign-in, HMAC-signed file links; with package B field encryption of TIN, ID and bank account numbers and masking by role. |
| Branding | Runtime theme, logo and sign-in picture applied to screens, documents, report files and e-mails without a rebuild; e-signatures mapped to document slots; brand packs between environments. |
| Deployment | One build per commit promoted through Dev, SIT, UAT, a temporary Pre-Prod and Production with approvals (`deploy/RELEASE_PIPELINE.md`). AWS ap-southeast-1 on the existing BrokerVerse URL: the front end through its GitHub workflow to S3 and CloudFront; the backend container from `backend/Dockerfile` behind HTTPS; PostgreSQL 16; a persistent upload volume; secrets in a secret store. Docker Compose serves a single server or a test system. |

# Solution component diagram

## Logical components

![Logical component view of BrokerVerse OOTB](d01_logical_components)

{widths: 22,78}
| Component | Responsibility |
|---|---|
| Browser SPA | All user screens: Home and My Work, operations (leads to renewals, broker slips and placement slips, cover notes, fleet, marine, claims and repairs, campaigns), accounts (billing, receipts, PDCs, payables, fixed assets, remittance, commission, journals, period end, BIR, bank reconciliation and bank files), compliance, product configurator, reinsurance, reports and report builder, dashboards, masters in sections and administration. The help panel (F1) opens the user manual section of the screen; the theme is applied at run time. It holds the session tokens, renews them automatically and hides the menus a role may not open. |
| Static hosting | Serves the compiled SPA (HTML, JavaScript, CSS, images). There is no server-side rendering; every data call goes to `/api`. |
| HTTP pipeline | Request handling in `backend/src/app.js`: request id, security headers (helmet), CORS, structured access log with redaction, global rate limit, JSON size limit, signing of file URLs in responses, one error envelope. |
| Business modules | 70 folders in `backend/src/modules`. Each has a `router.js` that declares its endpoints through the route registry, and services that hold the business rules and SQL. They are loaded automatically at start. The larger modules (accounting, placement, period-end, bank-reconciliation, remittance, reports, document-numbering) have their own README. |
| Shared services | `backend/src/lib`: authentication, permissions, settings cache, audit and audit events, document numbering, e-mail outbox, secrets and signed links, business dates, money and currency, Philippine addresses, validation, rate limits, health, the PDF engine and the letterhead; with package B personal data encryption and masking (document 05). |
| Integration framework | `backend/src/modules/integrations`: connectors (test or live, credentials named in environment variables), outbox with retries and backoff, inbox with signature check, adapters for SMS, Viber, CTPL, LTO, insurer REST APIs and bank file drop, a fake provider for test mode. |
| Scheduler | `backend/src/jobs/scheduler.js`: node-cron schedules the enabled rows of `scheduled_jobs` in the time zone `general.timezone`. Each run takes a PostgreSQL advisory lock so it runs once across instances, and is recorded in `job_runs`. Schedule changes reach every instance within 30 seconds. |
| File engines | One PDF engine (`lib/pdf`) for every document and report, with the letterhead of the primary company, the document branding and the mapped e-signatures; XLSX (branded header and banner), CSV and ZIP writers in `lib/`. No third-party document library. |
| PostgreSQL | System of record for business, financial, configuration, security and log data (documents 02 and 03). |
| File store | `UPLOAD_DIR` (`/app/uploads` in the container): uploaded documents and photos, generated reports and statements, registered in the `documents` table. |
| SMTP server | Office 365 (`smtp.office365.com`, port 587, STARTTLS) delivers the e-mail queued in `email_outbox`: quote approval links, broker slip requests and placement orders to insurers, password reset codes, renewal and collection reminders, report schedules and remittance statements. |

## Front-end application structure

The SPA (`brokerverse/src`, 961 JavaScript and JSX files) is organised by functional area:

{widths: 26,74}
| Folder | Content |
|---|---|
| `agentModule/` | Operations screens: leads, quotation wizard, policy, endorsements, claims, renewals, collections, open items, payments, the Sales Dashboard and the customer quote approval page. The folder name is historical; there is no agent sign-in. |
| `module/` | Back-office areas: Administration, BankReconciliation, ClaimsModule, Commission, CorrectionJV, ExecutiveDashboard, FinanceMastersModule, GeneralMasters, Incentive, JournalVoucher, PaymentVoucher, PeriodEnd, PettyCashManagement, Placement, ProductConfigurator, Receipts, Reinsurance, Remittance, Renewal, Reports, Reversals, SystemSettings, UnderwritingModule, accounts |
| `services/` | 57 API client services (one per backend area, for example `placementService.js`, `periodEndService.js`, `bankReconciliationService.js`, `importService.js`) |
| `routes/` | `MainRoute.js` (473 routes) and `ProtectedRoute` (route guard) |
| `redux/`, `context/`, `hooks/` | Redux Toolkit store (reset on sign-out), notification context, currency formatting hook |
| `utility/`, `utils/` | Shared helpers: HTTP interceptor and session refresh, menu permissions, dialogs and toasts, date, number and phone formatting, idle time-out, system settings, a logger that is silent in production |
| `components/` | Reusable UI: layout, header, side bar (Master in sections), help panel, data table with skeleton loading, audit timeline, Philippine address fields, file upload, dialogs, toasts, status badges, stepper, notification drop-down |
| `theme/` | PrimeReact theme tokens (`theme/bdoi`) and the runtime theme engine and branding provider (`theme/runtime`) |
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

Every request passes the same middleware chain before it reaches a handler. The route registry (`backend/src/lib/registry.js`) places `requireAuth` first on every route that is not declared `auth: false`, so an endpoint cannot be left open by mistake. 24 routes are public by design: sign-in, the two-factor step, refresh, logout, forgot and reset password, the password policy, the public system settings (two routes), the branding of the sign-in page (two routes), the version, the customer quote approval, file downloads with a signed link (two routes), a generated report download with a signed token, the payment link pages and gateway webhooks (five routes), the signed integration callback and the campaign opt-out link (two routes).

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
| access-control | 24 | Authority matrix, delegations, segregation of duties, access reviews |
| accounting | 27 | Ledger queries, open-item matching, write-off, chart of accounts, periods |
| addresses | 9 | Philippine address look-ups: region, province, city or municipality, barangay, ZIP code |
| aml | 58 | AML/CFT: onboarding of juridical clients, beneficial owners, KYC documents, risk rating and EDD, screening lists and hits, covered and suspicious transaction monitoring, cases, AMLC report files |
| audit | 1 | Audit trail as business events (record timeline, Master > Audit Trail) |
| auth | 15 | Sign-in, two-factor, refresh, password reset and change |
| bank-reconciliation | 38 | Bank accounts, statement import, matching, adjustments, monthly reconciliation |
| bir | 39 | BIR returns 0619-E, 1601-EQ, 1604-E with DAT files, 2551Q, EOPT sales invoices, EIS outbox, CAS books pack |
| branding | 11 | Theme and Branding: themes, logo, sign-in picture, brand packs, branded documents and e-mails |
| campaigns | 17 | Marketing campaigns to consenting clients and prospects, public opt-out link |
| cancellations | 3 | Computed cancellation: pro-rata, short-period, flat; return premium with taxes and commission taken back |
| channels | 6 | Distribution channels: dealer groups and branches, financing banks, affinity partners |
| claim-documents | 6 | Claim document checklist, reminders, submission to the insurer |
| claim-payments | 6 | Claims Settlements in the Accounting menu: funds received and payment to the claimant |
| claims | 17 | Claim registration, lifecycle, field-level trail, settlement, Preliminary Loss Advice |
| clients | 8 | Clients (individual and juridical), conversion from a lead |
| collections | 9 | Collection follow-up of open bills, reminders |
| commission | 19 | Referrer commission (comsub): accrual, eligibility, approval, payout, clawback |
| commission-rates | 7 | Commission Rate Matrix with the overlap rule |
| comparison-reports | 8 | Client comparison and recommendation report |
| cover-notes | 7 | Cover notes (binders) while the policy is pending |
| credit-control | 20 | Instalment plans and invoices, premium warranty monitor, client credit limits |
| dashboard | 6 | Dashboard figures |
| data-load | 14 | Go-Live Data Workbench: configuration and migration kits, validation, errors workbook, load, reconciliation, environment comparison |
| disbursements | 15 | Payment vouchers, invoice lists, cheques |
| document-numbering | 5 | Document number series |
| documents | 8 | Server-rendered PDFs of quotations, schedules and receipts |
| e-signatures | 7 | Signature capture, versions, revocation, mapping of signatures to document slots |
| endorsements | 9 | Endorsements and their approval |
| fixed-assets | 7 | Fixed asset register, straight-line depreciation, disposal (package G) |
| fleet | 14 | Fleet schedules under one motor policy, vehicle additions and deletions by endorsement |
| incentive | 22 | Incentive programmes, calculations, approval, payout, statements |
| insurer-overrides | 15 | Overriding, profit and contingent commission from insurers |
| insurer-reconciliation | 18 | Insurer statement import, matching, resolutions, approval |
| integrations | 57 | Integration framework (connectors, outbox, inbox, monitor); SMS and Viber messaging; CTPL authentication and COC series; insurer API connectors; bank payment files |
| journal-vouchers | 9 | Manual, reversal and correction journals with maker-checker |
| leads | 21 | Prospects and lead assignment: rules, queue, reassignment, SLA |
| marine | 17 | Marine cargo open covers, certificates, monthly declarations |
| masters | 13 | Metadata-driven masters (generic and table-backed) |
| motor-claims | 10 | Repair estimates, letters of authority, vehicle release |
| motor-programmes | 12 | Brand-new vehicle dealer programmes, dealer sales uploads, bank letters |
| my-work | 14 | My Items, My Team by reporting line, My Tasks, Calendar; reassignment |
| notifications | 11 | In-app notifications and the e-mail outbox |
| ops-masters | 4 | Operational masters kept by the teams that use them |
| packages | 27 | Packaged products: bundles, insurer rate tables, quick quote comparison, package policies |
| payables | 14 | Accounts payable: supplier invoices with input VAT and EWT, payments, AP ageing |
| payment-gateway | 13 | Payment gateways, payment links, public payment pages and webhooks |
| payments | 29 | Petty cash funds and movements, open items, payment status |
| pdc | 10 | Post-dated cheque register: deposit due list, deposit into a receipt, bounce, replacement |
| period-end | 45 | Fiscal calendar, month-end and year-end close, recurring journals, financial statements, tax codes, BIR Form 2307 |
| placement | 26 | Broker slips to several insurers, insurer offers, placement slips, binding per participant |
| policies | 12 | Policy issue, KYC on issue, payment capture, commission lines on issue |
| posting-rules | 22 | Posting rules and Account Determination with maker-checker |
| premium-charges | 9 | Premium tax engine: VAT or premium tax, DST, FST, LGT, other charges |
| privacy | 14 | Consents, data subject requests, personal data export, anonymisation |
| product-configurator | 90 | Product templates, components (covers, rating factors, acceptance rules, document templates, market mapping), risk mappings, governing template |
| quotations | 43 | Quotations, customer approval link, customer responses, quotation masters and cover look-ups |
| receipts | 19 | Billing (premium bills), official receipts, application to bills, billing statements |
| reinsurance | 51 | Reinsurers, treaties, cessions, recoveries, bordereaux, reconciliation, facultative placement as reinsurance broker |
| remittance | 86 | Remittances to insurers, approvals, direct bill, debit notes, refunds from insurers |
| renewals | 47 | Renewal pipeline, re-rating, notices, approval, batches, win-back |
| report-builder | 11 | Ad hoc reports over curated datasets, Excel export, BI extract |
| reports | 13 | Report catalogue, runs, files, scheduled delivery |
| schedules | 4 | Scheduled jobs: timing, enable, run now, history |
| search | 1 | Global search across leads, clients, quotations, policies, claims, endorsements |
| settings | 6 | Configuration keys, system settings, audit trail endpoint of the settings screen |
| system | 1 | Build and runtime information |
| system-settings | 7 | Configuration keys, system settings, audit trail endpoint of the settings screen |
| uploads | 11 | File upload and download (`/s3` API), signed links |
| users | 17 | Users, roles and role permissions |
| ic-compliance (package B) | 38 | Licence register and payout block, fit and proper, insurer authority check, IC annual statement and production report, complaints register (RA 11765) |
| data-breaches (package B) | 11 | Personal data breach register with the NPC 72-hour notification tracker |
| sales-activities (package G) | 8 | Sales activity log on prospects, quotations and clients; follow-ups in My Work |

Route counts come from the route registry through `collectRoutes()` in `backend/src/tools/export-api.js`, the same list that `npm run export:api` writes to `backend/docs/api/openapi.json`: 1,291 operations on the branch (598 GET, 516 POST, 122 PUT, 46 DELETE, 9 PATCH). The Technical Reference describes each module with its tables, jobs, posting events and settings.

## Front-end areas and backend modules

![Front-end areas (menus) and the backend modules they use](d01_module_map)

# Integration points

{widths: 20,16,64}
| Integration | Direction | Description |
|---|---|---|
| SMTP e-mail | Outbound | `lib/mailer.js` queues messages in `email_outbox`. The `email-outbox` job (every 5 minutes) sends up to 50 queued messages per run through nodemailer and `SMTP_URL` when `notification.email_enabled` is true; up to 5 attempts, then `failed`. Sender: `notification.from_address` (`BrokerVerse <connect@iortatechnxt.com>`; Office 365 refuses any other sender for that mailbox). |
| Client quote approval | Inbound (public) | The approval e-mail carries a signed token (`quotations.approval_link_ttl_hours`, 168 h). `POST /api/quotations/approve-by-customer` previews or accepts; only the latest token of a quotation is valid. |
| Insurers | Outbound (e-mail, files, API) | Broker slip requests for quotation, placement orders to the lead insurer and co-insurers, remittance statements and bills, commission debit notes; PDF, CSV and XLSX files. Insurer API connectors (`insurer_api_mappings`, adapter `insurer_rest`) send the policy issuance request after a policy is issued and receive claim status updates; delivered in test mode until certified with each insurer. |
| SMS and Viber | Outbound | Templates per event sent through an SMS gateway connector (Semaphore, Globe Labs or generic HTTP) or Viber business messages via the integration outbox; SMS jobs delivered off. |
| CTPL and LTO | Outbound and inbound | COC numbers allocated from the insurer's series, authenticated with the CTPL provider and optionally fed to the LTO; results arrive on the signed inbound endpoint. |
| Banks | Outbound and inbound files | Bank payment files (bulk credit, InstaPay, PESONet layouts) for batches of payment vouchers; status files mark lines paid or rejected. Bank statements for reconciliation. |
| BIR EIS | Outbound | Sales invoices and cancellations queued in `eis_submissions` for the Electronic Invoicing System (`eis-outbox`, delivered off until accreditation). |
| Reinsurers | Outbound (files) | Bordereaux and reconciliation files generated as CSV. |
| Uploads and go-live imports | Inbound (files) | Masters, chart of accounts, leads, quotations, policies, receipts, payment vouchers, opening balances, open items, bank statements and remittance bulk files through `importUpload()`: one file of at most `IMPORT_MAX_MB` (10 MB), decompressed size capped at `IMPORT_MAX_INFLATED_MB` (50 MB) and `IMPORT_MAX_ROWS` (20,000) rows. The 39 templates in `docs/package/05_Delivery/Upload_Templates` are generated from the importers' own column lists and checked by `backend/test/upload-templates.test.js`. |
| Bank statements | Inbound (files) | CSV or XLSX statements read with a statement format (layouts of three Philippine banks and a generic layout ship as standard) for bank reconciliation. |
| User provisioning | Operations | `scripts/provision-users.js` creates named users from a CSV kept outside the repository (dry run unless `CONFIRM_PROVISION=yes`). |
| Payment gateways | Inbound and outbound | Payment links for quotations, package quotations and open premium (SANDBOX, PayMongo, Dragonpay); signed webhooks create the official receipt. Payments captured by staff with proof of payment (`policy_payments`) are confirmed by Accounting. |
| Go-live data | Inbound (workbooks) | Go-Live Data Workbench: configuration and migration kits with validation (dry run), errors workbook, load and reconciliation; environment comparison report between environments. |
| API documentation | Developer | `npm run export:api` writes `backend/docs/api/openapi.json`, a Postman collection and environment, and `BrokerVerse_API_Touchpoints.xlsx` and `.csv` from the route registry. |
| Monitoring | Operations | `GET /api/health` (readiness), `GET /api/health/live` (liveness), `GET /api/version` (build, commit from `GIT_COMMIT`, database reachability, pending migrations); JSON logs on stdout (document 11). |

# Security architecture summary

## Roles and permissions

Permissions are codes `read:<area>`, `write:<area>` and `approve:<area>`: 98 permission rows with packages B and G, including `view:pii` (package B, full personal identifiers). Eight roles are seeded (`backend/src/db/seed.js`, migration `0140_broker_roles.sql` and, for the Compliance Officer, `0263_aml_configuration_and_access.sql`). A role can inherit another role (`roles.inherits`); the effective roles of a user are resolved by the database function `user_effective_roles()`. Administrators can create further roles and change grants in User Management.

{widths: 26,74}
| Role | Access (seeded grants) |
|---|---|
| System Administrator (Super Admin Access), `system-admin` | Every permission; configuration, users and roles. Only a System Administrator can grant this role or change an administrator account, and nobody can change their own roles or status. |
| Sales & Marketing (Account Executive), `sales` | Leads, clients, quotations, policies, endorsements, renewals, campaigns, dealer programmes, sales activities, reports, notifications; read products, masters and claims |
| Processing Team (Placement & Policy Processing), `processing` | Broker slips and placement (quotation permissions), policies, endorsements, renewals, reinsurance, product templates, clients, reports; read leads, masters and claims |
| Operations (Client Servicing), `operations` | Leads and lead assignment, clients, quotations, policies, endorsements, renewals, fleet, marine, campaigns, data privacy, reports; with package B the IC registers and complaints |
| Claims, `claims` | Claims, reports; read clients, policies and masters |
| Accounting, `accounting` | Receipts, collections, disbursements, payables, fixed assets, commission, remittance, incentive, journal vouchers, period end and BIR, bank reconciliation, reports; read clients, policies, claims, masters and schedules |
| Accounting Manager, `accounting-manager` | Inherits Accounting, plus the approvals of period end, bank and insurer reconciliation, credit control, payables and posting rule changes; posts into soft-closed periods and reopens periods |
| Compliance Officer (AML/CFT), `compliance-officer` | Customer risk rating and EDD approval, screening decisions, transaction monitoring, AML cases and AMLC reports; read of clients, policies, claims and payments |

There is no agent sign-in. Referrers and sub-agents are a master (`commission_referrers`): Sales & Marketing enter their business and Accounting pays them. The server enforces permissions on every route (`requirePermission`, `requireRole`); the front end also hides menus and blocks routes by role (`utils/menuPermissions.js`, deny by default, and `routes/ProtectedRoute`). Receipts are an Accounting function (segregation of duties).

## Controls

{widths: 24,76}
| Control | Implementation |
|---|---|
| Record scope | Users whose roles are all listed in `security.scoped_roles` see and act only on records they own or that belong to their clients (`lib/scope.js`); another user's record answers 404. The setting is empty in the seed, so no role is scoped. |
| Maker-checker | A different user must approve: journal vouchers, payment vouchers and cheques, commission payouts, remittances and settlements (multi-level with delegation), commission debit notes, claim settlements, incentive calculations, reinsurance treaties, petty cash requests, month-end and year-end closes, bank reconciliations, quotation and renewal approvals (`lib/makerChecker.js`, switch `finance.maker_checker_enabled`). |
| Period control | Every journal passes `assertPostingAllowed`: open periods accept all postings, soft-closed periods only postings by `approve:period-end`, closed and locked periods none. A trigger on `journal_vouchers` checks balance and period again at posting. |
| Audit | `lib/audit.js` writes `audit_log` (user, entity, id, action, before and after JSON, IP, source) from every mutating handler and the audit trail screen shows it as business events; claims keep a field-level trail (`claim_field_changes`); period and reconciliation status changes have their own history tables; sign-ins are in `login_history`. |
| Input validation | zod schemas on request bodies and parameters where declared; parameterised SQL only, with dynamic identifiers taken from white lists. |
| Uploads | Type checked against `uploads.allowed_types` by file signature and the detected type stored; per-file size `UPLOAD_MAX_MB` (10 MB) and `UPLOAD_MAX_FILES` (10); files served with `nosniff` and a sandbox CSP, and anything other than images and PDF as a download. |
| Transport and headers | TLS at the load balancer and CloudFront; helmet headers on the API; nginx adds `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` in the Compose option; CORS limited to `CORS_ORIGINS` (`*` refused in production). |
| Personal data (package B) | TIN, government ID and bank account numbers encrypted in the database (AES-256-CBC with an HMAC tag, keys from `PII_ENCRYPTION_KEY`, blind indexes for search); masked in answers and exports for users without `view:pii`. |
| Secrets | Production start refuses a missing, placeholder or short (under 32 characters) `JWT_SECRET`, `DATA_ENCRYPTION_KEY` or `PII_ENCRYPTION_KEY`, equal keys, `CORS_ORIGINS=*` or a localhost `PUBLIC_BASE_URL`. Reset codes are stored only as HMAC hashes. |
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

Accounting prepares the month-end close for a period (run `MEC-`): accrual and recurring journals, unearned commission deferral, FX revaluation and the checklist. The manual checklist items are signed and the run is submitted. When `accounting.period_close_requires_approval` is on, an Accounting Manager approves and the period becomes closed. Executing a run again first reverses its own earlier journals, so a rerun gives the same ledger. The year-end close (run `YEC-`) needs twelve closed periods; it posts the closing entries in period 13, carries the balance-sheet balances into `opening_balances` of the next year, locks the year and creates the next one. At go-live, the old system's trial balance is loaded into `opening_balances` and the open premium receivables as open items, with the templates in `docs/package/05_Delivery/Upload_Templates`.

## Scheduled jobs

All cron expressions are read in the business time zone (`general.timezone`, Asia/Manila), whatever the time zone of the server clock. The seed and the migrations create 32 jobs on the branch (35 with package B); 18 are enabled by default (21 with package B). The others are delivered off because they need a decision, a provider or a credential first: period-end jobs, bank auto-matching, remittance schedules, data subject request reminders, lead assignment SLA, SMS notices, the EIS outbox, campaign dispatch, the AML provider retry and the BI extract. The Technical Reference lists every job with its module, timing and default state; Accounting, Compliance and the System Administrator switch jobs on in Master > System Configuration > Schedules when the business is ready.

Report schedules created under Reports > Schedules add further jobs (`report-<id>`, handler `scheduledReport`).

# Architecture decisions and constraints

{widths: 30,70}
| Decision | Rationale and consequence |
|---|---|
| Modular monolith | One deployable API keeps an operation (policy, bill, journal, commission) in one database transaction. Modules can be split later along the folder boundaries. |
| Stateless API | Sessions are tokens; state is in PostgreSQL and the file store, so instances can be added behind a load balancer (document 07). The settings cache is per instance but checks the table version every 5 seconds, so a change reaches every instance within seconds. Rate-limit counters stay per instance. |
| Migrations and seed on start | Every instance takes an advisory lock, applies pending migrations (each in its own transaction) and the idempotent seed before it reports ready. Instances that start together wait for the first one. A failed migration blocks start-up (documents 07 and 09). |
| Posting rules as data | Every system journal is built from the posting rule of its business event and the account roles of Account Determination. Accounting can change the GL treatment without a code change; each rule version has an effective date. |
| Configuration over code | 659 settings in `app_settings` (tax rates, account roles, limits, templates, security policy, retention periods), 85 document number series, the commission rate matrix, the product rules, the theme and the integration connectors are edited in the application. |
| Integrations through one framework | Every third party is an adapter and message types on one outbox with retries, inbox and monitor; connectors start in test mode with a fake provider, so a provider can be certified without code changes elsewhere. |
| One PDF engine, no third-party document libraries | PDF, XLSX, CSV and ZIP writers are part of the code base. Every PDF carries the letterhead of the primary company of the Company master, so the broker's own details print on every document and report once the master is updated. |
| Business time zone | Business dates, document number years, column defaults and job schedules use `general.timezone` (Asia/Manila); the database time zone is also set to Asia/Manila. Instants are stored in `timestamptz`. |
| Local file store behind an S3-style API | `uploads/storage.js` keeps an S3-like key space on disk. With more than one instance the volume must be shared (for example EFS) so every instance sees the same files. |
