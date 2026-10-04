# BrokerVerse runtime reference

Reference for the people who run BrokerVerse: environment variables, seed data, scheduled jobs, health checks and the
production start-up rules. The step-by-step deployment on the existing BrokerVerse URL is in [README.md](README.md).
The front end is in `brokerverse/`, the Node.js + PostgreSQL backend in `backend/`.

## Docker Compose (a single server, a test system or a trial)

```
export JWT_SECRET=$(openssl rand -hex 32)
export DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)
export ADMIN_PASSWORD='<first administrator password>'
export DB_PASSWORD='<database password>'
export PUBLIC_BASE_URL=https://brokerverse.example.ph      # the public HTTPS address (the web container forwards /api)
export CORS_ORIGINS=https://brokerverse.example.ph
docker compose up --build -d
```

Open the public address (the web container listens on port 8080). The web container serves the front end and
forwards `/api` to the API container; PostgreSQL data and uploads are kept in Docker volumes. Add
`export ENVIRONMENT_NAME=UAT` (or `DEV`, `SIT`, `TRAINING`) before `docker compose up` to show the environment's label
next to the logo; leave it unset in production. Put a TLS proxy (for
example Caddy or an AWS/Azure load balancer) in front of port 8080 for the public HTTPS URL.

For a trial on one machine without a public address, run the API in development mode instead:
`NODE_ENV=development PUBLIC_BASE_URL=http://localhost:8080 CORS_ORIGINS=http://localhost:8080 docker compose up --build`.
Development mode skips the production start-up check below; never use it for real data.

## Seed data: reference and sample

On every start the API applies the migrations and then the seed, which is idempotent (existing rows and
administrator edits are kept). The seed has two parts (classification per file in `backend/src/db/seeds/README.md`):

- **Reference data**, always: roles and permissions, the administrator `BrokerVerse`, configuration settings,
  scheduled jobs, Philippine geography and postal codes, currencies, banks, insurers, products and policy types,
  vehicle master, covers, the head office branch, master screen definitions and reference master records, the chart
  of accounts, product templates with the motor / CTPL tariff, the report catalogue, direct-bill and security
  configuration.
- **Sample / demo data**, only when `SEED_SAMPLE_DATA` is on: fictional leads, clients, quotations, policies,
  endorsements, receivables, receipts, collections, disbursements, petty cash, commissions and referrers,
  remittances, reinsurers / treaties / cessions, incentive programmes and calculations, claims, renewals, journal
  vouchers, demo branches / signatories / master records and six sample users (`agent.*`, `fin.approver`).

| Variable | Default | Meaning |
|---|---|---|
| `SEED_SAMPLE_DATA` | `true` in development and test, `false` with `NODE_ENV=production` | Seed the sample / demo data. An explicit `true` / `false` wins (e.g. `true` on a UAT or demo site). The API logs a warning when it is on in production. |

Removing demo data from a database that was started with it (for example a UAT database promoted to production):
stop the API instances, take a backup, then

```
cd backend
CONFIRM_PURGE=yes npm run purge:sample                        # dry run: row counts per table, nothing changed
CONFIRM_PURGE=yes npm run purge:sample -- --execute           # purge, in one transaction
CONFIRM_PURGE=yes npm run purge:sample -- --execute --keep-users=jdoe,mreyes   # also remove every other user
```

(In the container: `docker compose exec -e CONFIRM_PURGE=yes api node scripts/purge-sample-data.js`.) The script
refuses to run without `CONFIRM_PURGE=yes`, is a dry run unless `--execute` is given, and runs in one transaction.
It empties **all** transaction tables (leads to journals, claims, renewals, notifications, job history, document
numbering counters), not only the seeded rows, so run it before go-live and never on a live book. It deletes the
sample master rows and the sample users (with `--keep-users`, every user except `BrokerVerse` and those listed),
keeps all reference data and the audit trail (`--purge-audit` also empties `audit_log` and `login_history`) and
records the purge in the audit trail. Uploaded files of removed documents stay in `UPLOAD_DIR`; clear that
directory too if nothing real was uploaded. Then set `SEED_SAMPLE_DATA=false` (or remove it) before starting the API
again, or the demo data is seeded back.

## Scheduled jobs and several API instances

| Variable | Default | Meaning |
|---|---|---|
| `SCHEDULER_ENABLED` | `true` | Run the cron scheduler (Master > Schedules jobs) on this instance. `false` on instances that must not run jobs; "Run now" still works there. |

Several instances may run the scheduler: every job run takes a PostgreSQL advisory lock keyed on the job code
(`pg_try_advisory_lock`), so a job never runs twice at the same time, and a scheduled run is skipped when another
instance has already started the same job in the same cron minute. A skipped run records nothing. "Run now" on a
job that is running elsewhere answers `Job skipped`.

## Health and readiness

| Endpoint | Use | Answer |
|---|---|---|
| `GET /api/health` | load balancer / readiness check (Docker `HEALTHCHECK`) | `200` with `{"status":"ok","ready":true,"database":{"reachable":true,"latencyMs":1},"pendingMigrations":0,...}` when start-up (migrations and seed) has finished, PostgreSQL answers and no migration is pending; otherwise `503` with `ready: false` and `status` `starting` or `unavailable` (e.g. `database.reachable: false`). It also answers `503` once the instance starts shutting down, so traffic drains. |
| `GET /api/health/live` | liveness (restart) probe | `200` while the process serves HTTP; no database check |
| `GET /api/version` | monitoring, post-deploy smoke test | version, `commit` and `buildTime` (from `GIT_COMMIT` / `BUILD_TIME`, else the release artefact's `build-info.json`), `ref`, `appEnvironment` (`APP_ENVIRONMENT`), start time, database reachability, pending migrations |

Health endpoints need no sign-in, are not rate limited and are not logged. The database check times out after
`HEALTH_DB_TIMEOUT_MS` (default 2000 ms).

## Production start-up check

With `NODE_ENV=production` (the Docker image sets it) the API refuses to start, and logs why, when:

| Variable | Rule |
|---|---|
| `JWT_SECRET` | set, at least 32 characters, not a placeholder (signs every session token and signed file link) |
| `DATA_ENCRYPTION_KEY` | set, at least 32 characters, different from `JWT_SECRET` (encrypts two-factor secrets at rest and keys the reset-code hashes) |
| `CORS_ORIGINS` | set to the web application origin(s), comma separated; `*` is refused |
| `PUBLIC_BASE_URL` | set to the public address of the API (file links are built from it); `localhost` / `127.0.0.1` are refused |

Keep `DATA_ENCRYPTION_KEY` with the database backups: without the same key, users with two-factor authentication
cannot sign in (an administrator can turn their two-factor off under User Management and they enrol again).
Changing `JWT_SECRET` signs every user out and invalidates file links already handed out.

## Security settings

Deployment variables (all optional; defaults shown):

| Variable | Default | Meaning |
|---|---|---|
| `JWT_ACCESS_TTL_SECONDS` | 1800 | Access-token lifetime. The web application renews it silently with the refresh token. |
| `JWT_REFRESH_TTL_SECONDS` | 2592000 | Refresh-token lifetime (30 days; rotated on every use, reuse ends the sign-in). |
| `FILE_URL_TTL_SECONDS` | 1800 | Lifetime of signed document / photo links returned by the API. |
| `UPLOAD_MAX_MB` / `UPLOAD_MAX_FILES` | 10 / 10 | Size of one uploaded document and files per request. |
| `IMPORT_MAX_MB` | 10 | Size of one spreadsheet / CSV import or statement file. |
| `IMPORT_MAX_INFLATED_MB` / `IMPORT_MAX_ROWS` | 50 / 20000 | Decompressed size of a workbook part and data rows per import. |
| `JSON_BODY_LIMIT` | 2mb | Largest JSON request body. |

Configuration (Master > Configuration, group Security / Uploads): `security.api_rate_limit` (requests per signed-in
user or per address, default 600 a minute), `security.login_rate_limit`, `security.reset_code_max_attempts`,
`security.require_2fa_roles`, the password policy keys, and `uploads.allowed_types` (file types users may upload,
checked against the file content).

Documents are served only to a signed-in caller or through short-lived signed links (`?exp=&sig=`) that the API adds
to every file URL it returns; records keep the unsigned URL. Files are sent with `nosniff` and a sandbox
content-security policy, and anything other than images and PDF is downloaded rather than displayed. The rate
limits are kept in memory per API process; with several API instances each keeps its own counters.

## Front-end runtime configuration

One front-end build serves every environment. The web server publishes `/env-config.js`, written when it starts or
when the pipeline publishes the build (`brokerverse/scripts/env-config.sh`), and index.html loads it before the app.

| Variable | Default | Meaning |
|---|---|---|
| `API_BASE_URL` | empty: same origin `/api` | API address for the browser when it is on another origin, e.g. `https://api.broker.example.ph/api` |
| `API_UPSTREAM` | `http://api:8000` in Docker Compose | where the web container forwards `/api` (same-origin set-up); Railway `http://api.railway.internal:8000` |
| `ENVIRONMENT_NAME` | empty | `DEV`, `SIT`, `UAT`, `PREPROD`, `TRAINING`: a small coloured label next to the logo and the browser tab title. Empty or `PRODUCTION`: none |
| `ENVIRONMENT_COLOR` | per name | label colour, `#rrggbb` |
| `ANALYTICS_ENABLED` | `false` | allow analytics |

The web server sends `Cache-Control: no-store` for `env-config.js`, `no-cache` for `index.html` and one year
`immutable` for the hashed files under `static/`, plus a Content-Security-Policy (`script-src 'self'`, `connect-src`
limited to the site and the API origin). A build from before this change, with `REACT_APP_BASE_URL` compiled in,
keeps using that address when `/env-config.js` names none.

## Upgrading

The release pipeline ([RELEASE_PIPELINE.md](RELEASE_PIPELINE.md)) deploys the artefacts CI built for a commit: it
takes a backup (pre-production and production), runs the migrations (they only add) and the idempotent seed before it
switches the API, then checks `/api/health`, `/api/version` and the sign-in page and rolls back automatically if they
fail. Without the pipeline: deploy the new image; on start the API applies any new migrations and the seed, then
reports ready on `/api/health`. Run one instance first when a release contains migrations, then scale out. Release
notes list anything an administrator must do by hand.

## Checks after deploying

| Check | How |
|---|---|
| API up | `GET <api>/api/health` returns 200 with `"ready":true` and `"database":{"reachable":true,...}` |
| No demo data | Leads, Clients and Policies are empty on a production start (`SEED_SAMPLE_DATA` off) |
| Sign in | BrokerVerse with the ADMIN_PASSWORD |
| Configuration | Master > System Settings and Master > Configuration load |
| Schedules | Master > Schedules lists the jobs; run "Receivable ageing" once |
| API documentation | `backend/docs/api` holds the OpenAPI file, the Postman collection and the Excel touchpoint list |

## Before production use

- Change the administrator password at the first sign-in; never keep example values from `docker-compose.yml` or
  `backend.env.example`.
- Keep `SEED_SAMPLE_DATA` off (the production default); if the database ever ran with it on, purge the demo data
  (`npm run purge:sample`, above) before real business is entered.
- Set up daily database backups and back up the upload volume and `DATA_ENCRYPTION_KEY` with them.
