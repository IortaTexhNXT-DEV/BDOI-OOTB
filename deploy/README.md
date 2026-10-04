# Deploying BrokerVerse on the existing URL

For the iorta TechNXT DevOps team connecting the GitHub source (`IortaTexhNXT-DEV/BDOI-OOTB`, branch
`brokerverse-platform`, release tag `v1.0.0`) to the existing BrokerVerse URL. Work through the sections in order and tick
each item. The runtime details (every environment variable, seed data, health checks, start-up rules) are in
[REFERENCE.md](REFERENCE.md).

| File in this folder | Use |
|---|---|
| `README.md` | this checklist |
| `REFERENCE.md` | environment variables, seed data, scheduled jobs, health checks, production start-up rules |
| `backend.env.example` | the backend environment with placeholders; copy the names into the secret store |
| `frontend.env.example` | the front end's runtime settings (`/env-config.js`): one build serves every environment |
| `RAILWAY.md` | the same deployment on Railway (database, API and web services from this repository) |
| `RELEASE_PIPELINE.md` | CI and deployment workflows: environments per broker size, promotion and approvals, GitHub settings, migrations, rollback, hotfix |
| `ec2/` | the EC2 host: `release.sh` (releases installed by the pipeline), `deploy.sh` (older git-checkout route), nginx and PM2 files |

| Part | Folder in this branch | Where it goes |
|---|---|---|
| Front end (React, BrokerVerse OOTB branding: name and logo from System Settings, iorta TechNXT logo by default) | `brokerverse/` | The existing private front-end repository, deployed by its GitHub Actions workflow (build, S3 sync, CloudFront invalidation) to the existing BrokerVerse URL |
| Backend API (Node.js 22) | `backend/` | New service (a new private repository or a folder in an existing one), container from `backend/Dockerfile` |
| Database | created by the backend | New PostgreSQL 16 database (e.g. Amazon RDS in ap-southeast-1) |
| Documents and uploads | `UPLOAD_DIR` of the backend | Persistent disk mounted into the backend container |

**Important:** the new front end calls the new backend's API (about 700 endpoints). It does not work against the old
`brokerverse-api` backend. Data held by the old backend is not migrated; the new database starts with reference data
only. Users, insurers, agents and opening balances are set up in the new system (section 6).

## 1. Before you start

- [ ] Decide the API address. The front end is built once for every environment and finds the API at run time
  (`/env-config.js`, [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md) section 4). Two options:
  - **Same domain (recommended):** add a CloudFront behaviour `/api/*` on the existing distribution that forwards to
    the backend (load balancer origin, all methods, all headers including `Authorization`, no caching), or let the web
    server forward `/api` (nginx on EC2, the Railway or Docker web container). The front end then needs no API
    setting at all and no cross-origin set-up is needed.
  - **Separate domain:** e.g. `https://api.<brokerverse-domain>` with its own TLS certificate; set `CORS_ORIGINS` to
    the front-end URL and `API_BASE_URL=https://api.<brokerverse-domain>/api` for the front end's runtime
    configuration (GitHub Environment variable, or container variable).
- [ ] Create the PostgreSQL database and a login with rights to create tables in it (the backend runs its own
  migrations on start).
- [ ] Set the database time zone to `Asia/Manila` (RDS parameter group `timezone`, or
  `ALTER DATABASE <db> SET timezone TO 'Asia/Manila'`): some queries use the database's current date.
- [ ] Generate the secrets (store them in AWS Secrets Manager / SSM Parameter Store or the GitHub environment, never in
  a repository, ticket or chat):
  - `JWT_SECRET`: random, at least 32 characters (`openssl rand -hex 32`)
  - `DATA_ENCRYPTION_KEY`: random, at least 32 characters, **different** from `JWT_SECRET`. It encrypts two-factor
    secrets: back it up together with the database; without it users with two-factor sign-in cannot sign in until an
    administrator turns their two-factor off.
  - `PII_ENCRYPTION_KEY`: random, at least 32 characters, different from both. It encrypts TIN, government ID and bank
    account numbers at rest: back it up together with the database; without it those identifiers cannot be read.
  - `ADMIN_PASSWORD`: the first password of the `BrokerVerse` administrator (must meet the password rules: 8+
    characters, upper and lower case, digit, symbol). **Do not reuse any password used during development or shared
    in chats or documents.**
- [ ] E-mail (quote approval links, password reset codes, reminders) goes through Office 365:
  `smtp.office365.com`, port 587 with STARTTLS, mailbox `connect@iortatechnxt.com`. Set
  `SMTP_URL=smtp://connect%40iortatechnxt.com:<mailbox-password>@smtp.office365.com:587` in the secret store (URL-encode
  special characters in the password). In the Microsoft 365 admin centre, turn on Authenticated SMTP for that mailbox; if
  the tenant enforces multi-factor sign-in, use an app password. The sender is `BrokerVerse <connect@iortatechnxt.com>`
  (Master > Configuration > Notification > E-mail sender); Office 365 refuses any other sender for this mailbox.
- [ ] After the first start, switch on "Send e-mails" (Master > Configuration > Notification) and send a test: Forgot
  password for an administrator should deliver a reset code within a minute (Master > Schedules > E-mail outbox runs
  every 5 minutes; "Run now" sends at once).

## 2. Backend

- [ ] Copy `backend/` into its repository (keep `package-lock.json`). Do not copy `node_modules`, `uploads` or any `.env`.
- [ ] Build the image from `backend/Dockerfile` (Node 22 Alpine, runs as the `node` user, health check on
  `/api/health`, port 8000).
- [ ] Run it on AWS (ECS Fargate, App Runner or EC2), region ap-southeast-1, behind a load balancer with HTTPS.
- [ ] Mount a persistent volume at `UPLOAD_DIR` (e.g. EFS at `/app/uploads`). Documents, ID cards, vehicle photos and
  generated reports are stored there; a container without a persistent volume loses them on restart.
- [ ] Environment variables:

  | Variable | Value | Required |
  |---|---|---|
  | `NODE_ENV` | `production` | yes |
  | `PORT` | `8000` | yes |
  | `DATABASE_URL` | `postgres://<user>:<password>@<host>:5432/<db>` (with `?sslmode=require` on RDS) | yes |
  | `JWT_SECRET` | secret from section 1 | yes |
  | `DATA_ENCRYPTION_KEY` | secret from section 1 | yes |
  | `PII_ENCRYPTION_KEY` | secret from section 1 | yes |
  | `ADMIN_PASSWORD` | secret from section 1 (used only when the administrator is first created) | yes |
  | `CORS_ORIGINS` | the front-end URL, e.g. `https://<brokerverse-url>` (never `*`) | yes |
  | `PUBLIC_BASE_URL` | the API's public base, e.g. `https://<brokerverse-url>` (same-domain option) or `https://api.<domain>` | yes |
  | `UPLOAD_DIR` | `/app/uploads` (the persistent volume) | yes |
  | `SEED_SAMPLE_DATA` | `false` (default in production: reference data only, no demo leads/policies/claims) | recommended to set explicitly |
  | `SCHEDULER_ENABLED` | `true` on the instance(s) that should run the nightly jobs | optional |
  | `SMTP_URL` | e-mail account | for e-mail |
  | `LOG_LEVEL` | `info` | optional |
  | `JWT_ACCESS_TTL_SECONDS`, `FILE_URL_TTL_SECONDS`, `UPLOAD_MAX_MB`, `UPLOAD_MAX_FILES`, `IMPORT_MAX_MB`, `IMPORT_MAX_INFLATED_MB`, `IMPORT_MAX_ROWS`, `JSON_BODY_LIMIT` | defaults in `backend/.env.example` | optional |

  In production the API refuses to start if `JWT_SECRET` or `DATA_ENCRYPTION_KEY` is missing, default or short, if
  `CORS_ORIGINS` is `*`, or if `PUBLIC_BASE_URL` is localhost. The log line says which one.
- [ ] Start one instance first. On start it applies the database migrations, seeds the reference data (roles and
  permissions, System Settings, chart of accounts, product templates and motor tariff, report catalogue, scheduled jobs,
  masters) and creates the `BrokerVerse` administrator. Check the log for `applied <migration file>` lines (first start), `seed complete` and
  `BrokerVerse API listening on :8000`.
- [ ] Scaling out: scheduled jobs take a database lock per run, so only one instance executes each run; you may also
  set `SCHEDULER_ENABLED=false` on extra instances. Rate limits are counted per instance.
- [ ] Health check for the load balancer: `GET /api/health` (readiness: `status: ok`, `ready`, database latency and
  pending migrations; 503 when not ready). Use `GET /api/health/live` (process only, no database) as the container
  liveness check. `HEALTH_DB_TIMEOUT_MS` (optional) sets how long the readiness check waits for the database.
- [ ] Backups: daily automated database snapshots (RDS) with at least 30 days' retention, plus the upload volume (EFS
  backup) and `DATA_ENCRYPTION_KEY`. Test a restore once before go-live.

## 3. Front end

- [ ] Replace the contents of the private front-end repository with `brokerverse/` from this branch (it already
  contains `.github/workflows/deploy.yml`, `package.json`, `package-lock.json`, `craco.config.js`, `public/`, `src/`,
  `scripts/`). Do not copy `node_modules`, `build/` or `.env`. Review that no environment file with secrets is added.
- [ ] **No API address in the build.** The same build runs in every environment. At publish time the workflow writes
  `/env-config.js` from the variables `API_BASE_URL` (empty for the same-domain option, else
  `https://api.<domain>/api`), `ENVIRONMENT_NAME` (`DEV`, `UAT`... shown as a small label next to the logo; empty in
  production) and `ENVIRONMENT_COLOR`. A build made earlier with `REACT_APP_BASE_URL` still works: the runtime file
  wins when it names an address, the build-time value is used otherwise.
- [ ] Keep the existing GitHub secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`,
  `CLOUDFRONT_DISTRIBUTION_ID`). The workflow deploys on a push to `dev`.
- [ ] The workflow builds with Node 22 and runs the front-end lint and tests before it deploys; a failing test stops
  the deployment. Hashed files under `static/` are cached for a year; `index.html` and `env-config.js` are never cached.
- [ ] CloudFront: the app is a single-page application. Keep (or add) custom error responses so 403 and 404 from S3
  return `/index.html` with status 200; otherwise refreshing a deep link (e.g. `/agent/policy`) shows an S3 error.
- [ ] If you use the same-domain option, add the `/api/*` behaviour before the default behaviour and do not cache it.
- [ ] Push to `dev` (or merge the prepared branch into `dev`) to run the deployment; check the workflow run is green
  and the CloudFront invalidation completed.
- [ ] **If this whole repository is connected instead** (the front end sits in the `brokerverse/` folder), the
  workflow inside `brokerverse/.github/` never runs, because GitHub only reads workflows at the repository root. The
  root workflows are used instead: `.github/workflows/ci.yml` (lint, tests, audit, one build, artefacts) and
  `.github/workflows/deploy.yml` (deploys that build to dev, SIT, UAT, Pre-Prod and Production through GitHub
  Environments with approvals, backups, migrations, smoke test and automatic rollback). Set them up as described in
  [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md) section 7; the secrets move into the GitHub Environments.

### Blank page with `%PUBLIC_URL%` errors

If the login page is blank and the browser console shows `400` for `%PUBLIC_URL%/favicon.ico`, `icon-192.png` or
`manifest.json`, the bucket holds the **unbuilt** `public/index.html` from the source code, not the build. The
unbuilt page has no script tags, so nothing loads. To fix it:

1. Build: in the front-end folder run `npm ci --legacy-peer-deps`, then `npm run build`. Check `build/index.html`:
   it must not contain `%PUBLIC_URL%` and must load `/env-config.js` and `/static/js/main.<hash>.js`. Write the
   environment's `build/env-config.js` with `API_BASE_URL=... ENVIRONMENT_NAME=... sh scripts/env-config.sh build/env-config.js`.
2. Publish the **contents of `build/`** to the bucket root (`aws s3 sync build/ s3://<bucket> --delete`), not the
   repository, the `public/` folder or the `build` folder itself.
3. Invalidate CloudFront (`/*`) and reload the page with the cache cleared.

The CI build, the Dockerfiles and the deploy workflows refuse to publish a page that still holds `%PUBLIC_URL%`.

## 4. Smoke test after deployment

- [ ] `https://<api>/api/health` returns `{"status":"ok", ...}` and `https://<api>/api/version` shows the deployed
  commit. `APP_URL=https://<brokerverse-url> EXPECTED_SHA=<commit> bash deploy/smoke-test.sh` runs the automated part
  of these checks (the deploy workflow runs it after every deployment).
- [ ] Outside production the environment name (e.g. `UAT`) shows as a small coloured label next to the logo and in the
  browser tab; production shows none.
- [ ] The sign-in page shows "Welcome to BrokerVerse" with the iorta TechNXT logo (or the customer's own name and logo
  once set in System Settings); the password field is masked; "Forgot password?" opens the reset form.
- [ ] Sign in as `BrokerVerse` with `ADMIN_PASSWORD`, then change the password at once (profile menu > Change password)
  and turn on two-step verification for the administrator.
- [ ] Master > System Settings and Master > Configuration load (company name, currency PHP, time zone Asia/Manila,
  date format DD/MM/YYYY, tax rates VAT 12%, DST 12.5%, LGT 0.75%).
- [ ] Master > Schedules lists the jobs; run "Receivable ageing" once and see it in the run history.
- [ ] Reports > All Reports lists the report catalogue; generate one report as XLSX and one as PDF and check the
  letterhead on the PDF.
- [ ] Upload a test document (e.g. a user photo or an ID card on a test client) and open it; copy its link into a
  private browser window without the `sig` part: it must be refused.
- [ ] Browser developer tools: no calls to `localhost`, all API calls go to the production API (same origin `/api`, or
  the `API_BASE_URL` of `/env-config.js`); no mixed-content or Content-Security-Policy warnings.
- [ ] Check the API log shows no `Authorization` header values (they are redacted).

## 5. Security settings to review before go-live

- [ ] Master > Configuration > Security: password rules, password age (90 days), history (5), lockout after 5 failed
  sign-ins (`limits.max_login_attempts`), idle sign-out (30 minutes), roles that must use two-step verification
  (`security.require_2fa_roles`, e.g. system-admin, accounting, accounting-manager).
- [ ] `security.api_rate_limit`, upload types (`uploads.allowed_types`) and size limits.
- [ ] Only the few people who administer the system hold the `system-admin` role (System Administrator, Super Admin
  Access: every module, configuration, user and role). Only a System Administrator can grant that role or change an
  administrator account, and nobody can change their own roles or status.
- [ ] Rotate `ADMIN_PASSWORD` after the first sign-in (the environment value is only used to create the account).

## 6. Go-live data (System Administrator, with the business teams)

- [ ] The step-by-step business set-up (company, users, insurers, products, accounts, opening balances) is in
  `docs/onboarding/GO_LIVE_DATA_SETUP.md`; the items below are the ones DevOps and the administrator agree on.
- [ ] Users and roles: create the real users (Master > User Management > User) with the broker roles: Sales &
  Marketing (Account Executive), Processing Team (Placement & Policy Processing), Operations (Client Servicing), Claims,
  Accounting, Accounting Manager, System Administrator. Each gets a temporary password shown once and must change it
  at first sign-in. Do not create the test personas used in development. Referrers / sub-agents do not sign in: their
  business is entered by Sales & Marketing and they are paid from the referrer master.
- [ ] Insurers (Insurance Company master) with commission rates, contact e-mails for remittance and debit notes.
- [ ] Referrers / sub-agents (referrer master) with WHT rates and bank accounts; commission rules (COMM codes).
- [ ] Banks and the broker's bank accounts (operating, premium trust); signatories (Master > Signatories).
- [ ] Chart of accounts review with Accounting (Master > Main Account / Sub Account). Opening balances, open premium
  receivables and in-force policies are loaded with the go-live imports: see `docs/onboarding/GO_LIVE_DATA_SETUP.md`
  (step 11) and the templates in `docs/package/05_Delivery/Upload_Templates`.
- [ ] Product templates and the motor tariff (Product Configurator > MOT-003-2025 > "CTPL & Auto PA"): CTPL amounts per
  vehicle class (confirmed 29 Sep 2026: 300.40 to 1,500.40 annual, 1,660.40 3-year private car), Auto Passenger PA
  rate and limits; 3-year CTPL for other classes when known.
- [ ] Direct bill settings (confirmed): default broker-billed, VAT 12% on commission added on top, insurer EWT 10%,
  debit note due 30 days.
- [ ] Named administrators: create the System Administrators (Super Admin) from a CSV kept outside the repository
  (columns name, username, password, role[, email]) with
  `CONFIRM_PROVISION=yes node scripts/provision-users.js /secure/users.csv` (without CONFIRM_PROVISION it is a dry
  run). Each user must change the initial password at the first sign-in. Delete the CSV afterwards.
- [ ] Tax codes (Master > Finance > Taxation) ship with the rates of current Philippine practice (VAT, expanded
  withholding with ATC codes, DST, LGT). Adjust any rate or GL account there if the company's tax adviser requires it.
- [ ] Bank statement formats (Master > Finance > Bank Statement Formats) ship with standard BDO, BPI, Metrobank and
  generic layouts. Adjust the columns if a bank's export differs.
- [ ] Letterhead (Master > Organization > Company): the primary company prints on every document and report. The OOTB
  record is iorta TechNXT Corp. (TIN 00-010-0234-8393, connect@iortatechnxt.com); replace it with the broker's own
  company details at go-live.
- [ ] Accounting Manager: assign the Accounting Manager role (Accounting plus month-end / year-end approval) to the
  users who approve the close; Accounting users prepare it.
- [ ] Document numbering (Master > Document Numbering): prefixes, format and the starting number of
  each series (e.g. to continue from the legacy system).
- [ ] E-mail texts and notification recipients; schedule times (Master > Schedules).

## 7. If the database was started with sample data by mistake

Stop, then run the purge script from the backend image against the database (it lists what it will delete and
changes nothing unless confirmed):

```
CONFIRM_PURGE=yes npm run purge:sample                  # dry run: counts per table, nothing deleted
CONFIRM_PURGE=yes npm run purge:sample -- --execute     # delete, in one transaction
```

Options: `--keep-users=jdoe,mreyes` keeps those users; `--purge-audit` also clears the audit trail (kept by default).
Without `CONFIRM_PURGE=yes` the script refuses to run.

Set `SEED_SAMPLE_DATA=false` before starting again.

After a smoke test on the client's own configuration, use the transaction reset instead: it removes the test
transactions and keeps every master, configuration setting and user (`CONFIRM_RESET=yes npm run reset:transactions`,
dry run unless `--execute`; refused once `golive.locked` is on). See
[docs/onboarding/SMOKE_TEST_AND_RESET.md](../docs/onboarding/SMOKE_TEST_AND_RESET.md).

## 8. Rollback

- With the release pipeline: a failed smoke test rolls the application back automatically; later problems use
  **Actions > Rollback** (the earlier tag, the environment, a reason). See [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md)
  section 9.
- Front end by hand: republish the previous build (restore the previous S3 object versions if bucket versioning is on)
  and invalidate CloudFront.
- Backend by hand: redeploy the previous image tag, or `release.sh rollback` on the EC2 host. Migrations only add;
  restore the pre-deploy backup (or the pre-go-live snapshot) if data must be rolled back.
- Keep the old `brokerverse-api` running until the new system is accepted if anything still depends on it.

## 9. Known limitations (accepted for go-live, planned later)

- Sign-in tokens are kept in the browser's local storage (secure-cookie sessions are a later change).
- Two-step verification set-up shows the key and a link, not a QR code.
- Rate limits are counted per API instance.
- Filipino is configured but has no translation file; the app offers English.

## References

- [REFERENCE.md](REFERENCE.md): environment variables, seed data, scheduled jobs, health checks.
- `docs/developer-guide/`: developer and production support guide (tracing a defect, logs, configuration).
- `docs/onboarding/`: getting-started guide, go-live data set-up, upload templates, support and acceptance scripts.
- `backend/docs/api/`: OpenAPI, Postman collection and the API touchpoint list.
