# BrokerVerse go-live checklist (DevOps)

For the DevOps team taking the revised build from `IortaTexhNXT-DEV/BDOI-OOTB`, branch `brokerverse-platform`, into
the private repositories and hosting it on the existing BrokerVerse URL.

| Part | Folder in this branch | Where it goes |
|---|---|---|
| Front end (React, BrokerVerse OOTB branding: name and logo from System Settings, iorta TechNXT logo by default) | `brokerverse/` | The existing private front-end repository, deployed by its GitHub Actions workflow (build, S3 sync, CloudFront invalidation) to the existing BrokerVerse URL |
| Backend API (Node.js 22) | `backend/` | New service (a new private repository or a folder in an existing one), container from `backend/Dockerfile` |
| Database | created by the backend | New PostgreSQL 16 database (e.g. Amazon RDS in ap-southeast-1) |
| Documents and uploads | `UPLOAD_DIR` of the backend | Persistent disk mounted into the backend container |

**Important:** the new front end calls the new backend's API (565 endpoints). It does not work against the old
`brokerverse-api` backend. Data held by the old backend is not migrated; the new database starts with reference data
only. Users, insurers, agents and opening balances are set up in the new system (section 6).

## 1. Before you start

- [ ] Decide the API address. Two options:
  - **Same domain (recommended):** add a CloudFront behaviour `/api/*` on the existing distribution that forwards to
    the backend (load balancer origin, all methods, all headers including `Authorization`, no caching). The front end
    then uses `https://<brokerverse-url>/api` and no cross-origin set-up is needed.
  - **Separate domain:** e.g. `https://api.<brokerverse-domain>` with its own TLS certificate; set `CORS_ORIGINS` to
    the front-end URL.
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
  - `ADMIN_PASSWORD`: the first password of the `BrokerVerse` administrator (must meet the password rules: 8+
    characters, upper and lower case, digit, symbol). **Do not reuse any password used during development or shared
    in chats or documents.**
- [ ] SMTP account for e-mail (quote approval links, password reset codes, reminders): `SMTP_URL`, e.g.
  `smtps://user:password@smtp.example.com:465`.

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
- [ ] **Set the API address for the build.** The app reads `REACT_APP_BASE_URL` at build time. Add it to the workflow's
  "Build application" step, from a GitHub repository variable:

  ```yaml
      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production
          CI: false
          REACT_APP_BASE_URL: ${{ vars.REACT_APP_BASE_URL }}   # e.g. https://<brokerverse-url>/api
  ```

  Without it the app is built with no API address and every screen fails.
- [ ] Keep the existing GitHub secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`,
  `CLOUDFRONT_DISTRIBUTION_ID`). The workflow deploys on a push to `dev`.
- [ ] Node version: the workflow uses Node 20 (`NODE_VERSION`); the app builds with Node 20 or 22.
- [ ] CloudFront: the app is a single-page application. Keep (or add) custom error responses so 403 and 404 from S3
  return `/index.html` with status 200; otherwise refreshing a deep link (e.g. `/agent/policy`) shows an S3 error.
- [ ] If you use the same-domain option, add the `/api/*` behaviour before the default behaviour and do not cache it.
- [ ] Push to `dev` (or merge the prepared branch into `dev`) to run the deployment; check the workflow run is green
  and the CloudFront invalidation completed.

## 4. Smoke test after deployment

- [ ] `https://<api>/api/health` returns `{"status":"ok", ...}`.
- [ ] The sign-in page shows "Welcome to BrokerVerse" with the iorta TechNXT logo (or the customer's own name and logo
  once set in System Settings); the password field is masked; "Forgot password?" opens the reset form.
- [ ] Sign in as `BrokerVerse` with `ADMIN_PASSWORD`, then change the password at once (profile menu > Change password)
  and turn on two-step verification for the administrator.
- [ ] Master > System Settings and Master > Configuration load (company name, currency PHP, time zone Asia/Manila,
  date format DD/MM/YYYY, tax rates VAT 12%, DST 12.5%, LGT 0.75%).
- [ ] Master > Schedules lists the jobs; run "Receivable ageing" once and see it in the run history.
- [ ] Reports > All Reports lists the 19 reports; generate one as XLSX and PDF.
- [ ] Upload a test document (e.g. a user photo or an ID card on a test client) and open it; copy its link into a
  private browser window without the `sig` part: it must be refused.
- [ ] Browser developer tools: no calls to `localhost`, all API calls go to the production API; no mixed-content warnings.
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

- [ ] Company details, branches, departments, letterhead (System Settings > General).
- [ ] Users and roles: create the real users (Master > Generals > User Management) with the broker roles: Sales &
  Marketing (Account Executive), Processing Team (Placement & Policy Processing), Operations (Client Servicing), Claims,
  Accounting, Accounting Manager, System Administrator. Each gets a temporary password shown once and must change it
  at first sign-in. Do not create the test personas used in development. Referrers / sub-agents do not sign in: their
  business is entered by Sales & Marketing and they are paid from the referrer master.
- [ ] Insurers (Insurance Company master) with commission rates, contact e-mails for remittance and debit notes.
- [ ] Referrers / sub-agents (referrer master) with WHT rates and bank accounts; commission rules (COMM codes).
- [ ] Banks and the broker's bank accounts (operating, premium trust); signatories (Master > Signatories).
- [ ] Chart of accounts review with Accounting (Master > Main Account / Sub Account); opening balances by journal voucher.
- [ ] Product templates and the motor tariff (Product Configurator > MOT-003-2025 > "CTPL & Auto PA"): CTPL amounts per
  vehicle class (confirmed 29 Sep 2026: 300.40 to 1,500.40 annual, 1,660.40 3-year private car), Auto Passenger PA
  rate and limits; 3-year CTPL for other classes when known.
- [ ] Direct bill settings (confirmed): default broker-billed, VAT 12% on commission added on top, insurer EWT 10%,
  debit note due 30 days.
- [ ] Named administrators: create the System Administrators (Super Admin) from a CSV kept outside the repository
  (columns name, username, password, role[, email]) with
  `CONFIRM_PROVISION=yes node scripts/provision-users.js /secure/users.csv` (without CONFIRM_PROVISION it is a dry
  run). Each user must change the initial password at the first sign-in. Delete the CSV afterwards.
- [ ] Tax codes (Master > Finance > Taxation): the Accounting / tax team confirms every ATC code, rate and GL account
  against the current BIR regulations (the OOTB values are a starting point) before the first BIR 2307, SAWT or QAP.
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

## 8. Rollback

- Front end: re-run the workflow on the previous commit of `dev` (or restore the previous S3 object versions if bucket
  versioning is on) and invalidate CloudFront.
- Backend: redeploy the previous image tag. Migrations only add; restore the pre-go-live database snapshot if data must
  be rolled back.
- Keep the old `brokerverse-api` running until the new system is accepted if anything still depends on it.

## 9. Known limitations (accepted for go-live, planned later)

- Sign-in tokens are kept in the browser's local storage (secure-cookie sessions are a later change).
- Two-step verification set-up shows the key and a link, not a QR code.
- Rate limits are counted per API instance.
- Filipino is configured but has no translation file; the app offers English.

## References

- `docs/DEPLOY.md`: deployment options (Render, Docker Compose) and production checks.
- `docs/manual/BrokerVerse_User_Manual.pdf`: user manual (167 pages).
- `docs/e2e/E2E_REPORT.md`, `docs/e2e/DEFECTS.md`: end-to-end test results and the defect log.
- `backend/docs/api/`: OpenAPI, Postman collection and the API touchpoint list.
