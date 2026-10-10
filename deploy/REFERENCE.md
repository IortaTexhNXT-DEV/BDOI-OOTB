# BrokerVerse runtime reference

Reference for the people who run BrokerVerse: environment variables, seed data, scheduled jobs, health checks and the
production start-up rules. The step-by-step deployment on the existing BrokerVerse URL is in [README.md](README.md).
The front end is in `brokerverse/`, the Node.js + PostgreSQL backend in `backend/`.

## Docker Compose (a single server, a test system or a trial)

```
export JWT_SECRET=$(openssl rand -hex 32)
export DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)
export PII_ENCRYPTION_KEY=$(openssl rand -hex 32)
export ENTITLEMENT_SIGNING_KEY=$(openssl rand -hex 32)
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
- **Sample / demo data**, only when `SEED_SAMPLE_DATA` is on: a fictional TISPH book of business on the panel
  insurers (motor comprehensive and CTPL of Toyota vehicles financed by TFS or referred by Toyota dealers, personal
  accident, group PA, travel, compulsory and voluntary credit life, a parcel open policy): prospects, clients,
  quotations, placement slips, policies, endorsements, receivables, receipts, post-dated cheques, collections,
  disbursements, petty cash, commissions and referrers, remittances, incentive programmes, dealer programmes,
  campaigns, sales activities, claims, renewals, journal vouchers, demo branches / signatories / master records and
  six sample users (`agent.*`, `fin.approver`).

A database seeded with the sample data of an earlier release (fictional insurers, fire / engineering / liability
policies) is converted by migration `0365_tisph_sample_data.sql` on the next start: it removes the earlier sample
business, keeps any record a user worked on (and the sample clients and prospects those records use) and records
the conversion in the audit trail; the seed then adds the TISPH sample business. Non-sample data is never touched.
The earlier sample policies kept that way get the premium breakdown the sample seed reads from migration
`0369_tisph_sample_data_kept_policies.sql` (also recorded in the audit trail).

Demo data never stops the start: a sample file that fails on a database in use is rolled back and left out, and the
log shows `WARNING: sample data file sample/<file> was rolled back and left out: <database error>`; the seed ends
with `seed complete (reference + sample data; N sample file(s) left out, ...)`. A reference file that fails still
stops the start.

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

## Brand pack of the deployment

A deployment made for a client whose brand pack ships with the product (`backend/assets/brand-packs/<id>/`) names it
in `BRAND_PACK`, so the environment opens in the client's branding without a manual step, and keeps it. `BRAND_PACK`
enforces the pack: after the migrations and the seed, at every start, the API checks that the screens show it and
applies it again when the pack is not the enablement in force or when anything differs from it: the theme of the
screens (name, preset, colours, layout, font, radius, sign-in page, logo sizes), the application name, the logo, the
favicon, or the print logo of the primary company (Master > Company) when it is missing. The e-mail and document
sections of the theme (Master > System Configuration > E-mail Layout, Documents and Reports Layout) and the document
signature mapping are kept as the broker set them. An image already stored with the pack's bytes is reused, so a start
with nothing to apply stores and records nothing; it logs `Brand pack <name> in force (BRAND_PACK=<id>)`.

The first application is recorded like the bundled pack enablement of the API (POST
/api/branding/packs/bundled/:id/enable): against the user `system`, with the trademark acknowledgement and the note
"Given by the deployment configuration (BRAND_PACK)", audited as entity `branding`, action `enable-pack`. A later
application is audited as action `reapply-pack`. Both log one line naming what differed, for example
`Brand pack Toyota Insurance Services applied again from BRAND_PACK=toyota-insurance-services: the theme differs
(colors.primary, ...); the application name is "BrokerVerse" (theme, logo, favicon, systemName)`.

While the variable is set the API refuses every change to the look of the screens: a theme save that changes anything
but the e-mail and document sections (PUT /api/branding/theme), the branding images (POST and DELETE
/api/branding/upload/:asset, POST /api/system-settings/upload/:field), a brand pack import (only its dry run is
accepted), enabling a pack, Back to default (POST /api/branding/packs/reset-default) and the branding fields of PUT
/api/system-settings (logo, favicon, colours, application name). To take the pack out of an environment, remove the
variable, restart the API and go back to the default through the API.

| Variable | Default | Meaning |
|---|---|---|
| `BRAND_PACK` | empty | Id of a bundled brand pack, e.g. `toyota-insurance-services` (TISPH environments). Enforced: applied again at every start when the branding of the screens differs from it, and not changeable through the API while set. An unknown id logs a warning; the API starts with the branding it has and nothing is locked. |

Set it only in the client's own environments: the client's contract with iorta TechNXT covers the use of its marks
there, and setting the variable is the acknowledgement the screen otherwise asks for.

## Scheduled jobs and several API instances

| Variable | Default | Meaning |
|---|---|---|
| `SCHEDULER_ENABLED` | `true` | Run the cron scheduler (Master > Schedules jobs) on this instance. `false` on instances that must not run jobs; "Run now" still works there. |
| `SAP_GL_EXPORT_DIR` | empty | Folder the daily SAP GL text files are written to (job `sap-gl-export`, Accounts > SAP GL Export) when it is not the folder `sap_gl.folder` of `UPLOAD_DIR`, e.g. a share SAP collects from (AZURE.md section 11). |

Several instances may run the scheduler: every job run takes a PostgreSQL advisory lock keyed on the job code
(`pg_try_advisory_lock`), so a job never runs twice at the same time, and a scheduled run is skipped when another
instance has already started the same job in the same cron minute. A skipped run records nothing. "Run now" on a
job that is running elsewhere answers `Job skipped`.

## Health and readiness

| Endpoint | Use | Answer |
|---|---|---|
| `GET /api/health` | load balancer / readiness check (Docker `HEALTHCHECK`) | `200` with `{"status":"ok","ready":true,"database":{"reachable":true,"latencyMs":1},"pendingMigrations":0,...}` when start-up (migrations and seed) has finished, PostgreSQL answers and no migration is pending; otherwise `503` with `ready: false` and `status` `starting` or `unavailable` (e.g. `database.reachable: false`). It also answers `503` once the instance starts shutting down, so traffic drains. |
| `GET /api/health/live` | liveness (restart) probe | `200` while the process serves HTTP; no database check |
| `GET /api/version` | monitoring, post-deploy smoke test | version, `commit` and `buildTime` (from `GIT_COMMIT` / `BUILD_TIME`, else the release artefact's `build-info.json`), `ref`, `appEnvironment` (`APP_ENVIRONMENT`), start time, database reachability, pending migrations, `release` (Help > About: web and API release, environment name, and for a signed-in user the approvers of the release; settings `release.*` on Master > Configuration > Release, `APP_ENVIRONMENT` wins over the environment name) |

Health endpoints need no sign-in, are not rate limited and are not logged. The database check times out after
`HEALTH_DB_TIMEOUT_MS` (default 2000 ms).

## Production start-up check

With `NODE_ENV=production` (the Docker image sets it) the API refuses to start, and logs why, when:

| Variable | Rule |
|---|---|
| `JWT_SECRET` | set, at least 32 characters, not a placeholder (signs every session token and signed file link) |
| `DATA_ENCRYPTION_KEY` | set, at least 32 characters, different from `JWT_SECRET` (encrypts two-factor secrets at rest and keys the reset-code hashes) |
| `PII_ENCRYPTION_KEY` | set, at least 32 characters, different from `JWT_SECRET` and `DATA_ENCRYPTION_KEY` (encrypts TIN, government ID and bank account numbers at rest and keys their blind indexes) |
| `ENTITLEMENT_SIGNING_KEY` | set, at least 32 characters, different from the three keys above (signs the feature entitlements of the environment; an entitlement without a valid signature counts as off) |
| `CORS_ORIGINS` | set to the web application origin(s), comma separated; `*` is refused |
| `PUBLIC_BASE_URL` | set to the public address of the API (file links are built from it); `localhost` / `127.0.0.1` are refused |
| `ENTRA_*` | either none or all four of `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI` (an `https://` address) |

The iorta TechNXT platform administrator (Master > Platform > Features & Releases, the only role that enables Phase 2
and future-release features) is created at a start where both `PLATFORM_ADMIN_EMAIL` (also the user name) and
`PLATFORM_ADMIN_PASSWORD` are set; there is no default account or password. Two-factor authentication is set up at the
first sign-in. The second platform administrator, who approves the changes of the first, is added on that screen. Keep
`ENTITLEMENT_SIGNING_KEY` with the environment: with another key every enabled feature counts as off until the platform
administrators enable it again.

Keep `DATA_ENCRYPTION_KEY` with the database backups: without the same key, users with two-factor authentication
cannot sign in (an administrator can turn their two-factor off under User Management and they enrol again).
Changing `JWT_SECRET` signs every user out and invalidates file links already handed out.

Keep `PII_ENCRYPTION_KEY` with the database backups too: TIN, government ID and bank account numbers of clients,
prospects and referrers are stored encrypted with it (migration 0277) and cannot be read without it.

### Rotating the personal data key

1. Generate a new key: `openssl rand -hex 32`.
2. Set `PII_ENCRYPTION_KEY` to the new key and `PII_ENCRYPTION_KEY_PREVIOUS` to the old one, and restart the API. From
   then on every new or changed identifier is written with the new key, and values written with the old key stay readable.
3. Run `npm run pii:rotate` (a dry run that counts the values still encrypted with the old key), then
   `npm run pii:rotate -- --execute`: every such value is decrypted and encrypted again with the new key and its blind
   index (exact-value search) recomputed. The script works in batches and can be run again safely.
4. When the dry run reports 0 for every column, remove `PII_ENCRYPTION_KEY_PREVIOUS` and restart.
5. Keep the old key with the backups taken before the rotation: those backups can only be read with it.

The masking tool (`npm run mask:data`) runs with the key of the database it masks (the restored copy's key, normally
production's); after masking, rotate the copy to the key of its own environment with the steps above.

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
| `TRUST_PROXY` | 1 | Proxies in front of the API whose `X-Forwarded-For` is believed: a hop count, `true` / `false`, or addresses and subnets separated by commas. The client address feeds the sign-in rate limits and the sign-in history. 1 for one reverse proxy (nginx, Railway); 4 on Azure (Front Door, the web app's ingress, nginx, the API's ingress). |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI` | empty | Sign-in with Microsoft Entra ID (OpenID Connect, authorization code with PKCE). All four set: the sign-in page shows "Sign in with Microsoft". The redirect address is the web address followed by `/login`. App registration: [AZURE.md](AZURE.md), section 14. |
| `HTTP_KEEP_ALIVE_SECONDS` | 65 | How long the API keeps an idle keep-alive connection open; longer than the idle timeout of the proxy in front (ALB 60 s), so the proxy never reuses a connection being closed. |
| `ENTRA_AUTHORITY` | https://login.microsoftonline.com | Microsoft sign-in host (another national cloud only). |

Configuration (Master > Configuration, group Security / Uploads): `security.api_rate_limit` (requests per signed-in
user or per address, default 600 a minute), `security.login_rate_limit`, `security.reset_code_max_attempts`,
`security.require_2fa_roles`, the password policy keys, and `uploads.allowed_types` (file types users may upload,
checked against the file content). With Entra ID configured: `security.password_sign_in_enabled` (off: staff sign in
only with Microsoft), `security.password_sign_in_roles` (roles that keep the password form, default System
Administrator) and `security.sso_register_users` (an unknown Microsoft account is registered as an inactive user).

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
| `FRONT_DOOR_ID` | empty | Azure: the Front Door profile ID; requests without that `X-Azure-FDID` header are refused with 403 |

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
