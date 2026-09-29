# Back end: developer and production support guide

The BrokerVerse API is a Node.js 22 application (Express, PostgreSQL through `pg`, `zod` for validation, `pino` for
logs, `vitest` for tests) in `backend/`. It serves the React front end in `brokerverse/` and runs the scheduled jobs.
This guide is for developers who change the code and for the support team who look into defects in production.

## 1. Where things are

```
backend/
  src/
    server.js            start-up: production checks, migrate, seed, listen, scheduler, shutdown
    app.js               Express app: request id, security headers, CORS, request log, rate limit, module loading
    config.js            environment variables (the only place that reads process.env for the API)
    lib/                 shared code (see the table below)
    modules/<name>/      one folder per business area: router.js (routes), service.js (logic and SQL), README.md
    jobs/                scheduled job handlers (handlers.js), the scheduler, housekeeping
    db/migrations/       NNNN_name.sql, applied once each, in file-name order
    db/seeds/            reference data (always) and seeds/sample/ (demo data, only when SEED_SAMPLE_DATA is on)
    tools/export-api.js  generates docs/api (OpenAPI, Postman, the API touchpoint workbook)
  scripts/               command-line tools (check-settings, provision-users, purge-sample-data, fk-index-report)
  test/                  integration tests against a real database
  docs/MODULE_GUIDE.md   conventions for writing a module
  docs/api/              generated API documentation (do not edit by hand)
```

Shared code in `src/lib`:

| File | Use it for |
|---|---|
| `registry.js` | `moduleRouter()` and `define()`: every route is declared here, with its summary, screen, permissions and examples. |
| `auth.js` | `requireAuth`, `requirePermission`, `requireRole`, `hasPermission`, `isAdmin`, token signing. |
| `errors.js` | `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, and the error handler. |
| `settings.js` | `getSetting(key, fallback)`, `setSetting`. Values are cached per instance and refreshed within seconds. |
| `dates.js` | `today()` (business date in `general.timezone`), `isoDate`, `addDays`, `businessDate`, `calendarPeriod`. |
| `money.js` | `round2`, `toNumber`, `num`, `formatMoney`. |
| `numbering.js` | `nextDocumentNumber(code, { db })` for every document number. |
| `makerChecker.js` | `assertChecker(user, makerId, what)`: the approver must not be the maker. |
| `template.js` | `renderTemplate(text, vars, { html })` for e-mail and letter templates kept in settings. |
| `csv.js`, `xlsx.js`, `zip.js`, `pdf/` | File output. CSV cells are guarded against spreadsheet formulas. |
| `mailer.js` | `queueEmail()` writes to the e-mail outbox; the `email-outbox` job sends. |
| `logger.js` | The pino logger and log redaction. |
| `scope.js` | Own-book record scoping for roles listed in `security.scoped_roles`. |
| `audit.js` | `audit(req, { entity, entityId, action, before, after })` writes `audit_log`. |

Seven modules have their own README because they are larger: `accounting`, `placement`, `period-end`,
`bank-reconciliation`, `remittance`, `reports`, `document-numbering`. Read the README before changing one of them.

## 2. Running locally

You need Node.js 22 and PostgreSQL 16.

```bash
cd backend
npm ci
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, DATA_ENCRYPTION_KEY, ADMIN_PASSWORD
npm run db:reset            # drop the schema, migrate, seed (reference and sample data)
npm run dev                 # http://localhost:8000/api, restarts on file changes
```

Sign in as `BrokerVerse` with `ADMIN_PASSWORD`. The front end (`brokerverse/`, `npm start`) runs on port 3000 and
calls the API on port 8000. `docker compose up --build` at the repository root starts the database, the API and the
web server together (see `deploy/REFERENCE.md`).

## 3. Tests and checks

```bash
TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/brokerverse_test npx vitest run   # whole suite, about 4 minutes
TEST_DATABASE_URL=... npx vitest run test/receipts.test.js                             # one file
npx eslint src test scripts                                                             # must be clean
DATABASE_URL=... npm run check:settings                                                  # settings read vs seeded
npm run export:api                                                                      # after changing routes
```

Every test file drops and recreates the schema of the test database, so never point `TEST_DATABASE_URL` at a database
you need. Tests are integration tests: they call the API through supertest and check the database.

ESLint refuses `console` outside `scripts/`, `src/db/*.js` and `src/tools/`, unused variables, `==` (except against
null) and `let` that is never reassigned.

## 4. Configuration

Two kinds of configuration, kept apart on purpose.

**Environment variables** describe the deployment. They are read only in `src/config.js` (and a few operational
ones where they are used). The important ones:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection. |
| `JWT_SECRET`, `DATA_ENCRYPTION_KEY` | Token signing and encryption at rest (two-factor secrets). Required in production. |
| `CORS_ORIGINS`, `PUBLIC_BASE_URL` | The web address. Required in production; file links are built from `PUBLIC_BASE_URL`. |
| `ADMIN_PASSWORD` | Password of the first administrator, used only when the seed creates it. |
| `SEED_SAMPLE_DATA` | Demo data on or off (off by default in production). |
| `SCHEDULER_ENABLED` | Run scheduled jobs on this instance (default true; runs are locked across instances). |
| `SMTP_URL` | Mail server. Mail is also switched by the setting `notification.email_enabled`. |
| `UPLOAD_DIR`, `UPLOAD_MAX_MB`, `IMPORT_MAX_MB`, `IMPORT_MAX_ROWS` | File storage and limits. |
| `LOG_LEVEL` | pino level (`info` by default). |
| `GIT_COMMIT` | Shown by `GET /api/version`. |

The full list with comments is `backend/.env.example`.

**Settings** (`app_settings` table) hold every business parameter: tax rates, account codes, limits, e-mail text,
switches. Administrators edit them on Master > Configuration (and System Settings for branding). Code reads them with
`getSetting('group.key', fallback)`; the fallback must equal the seeded value (a test checks it). A change saved on
one instance reaches the others within about five seconds.

## 5. Tracing a defect from a screen to the database

1. **Screen to API.** Every route declares the screen that uses it (`screen` in `define()`). The generated workbook
   `backend/docs/api/BrokerVerse_API_Touchpoints.xlsx` has a "By Screen" sheet: find the screen name from the menu
   path (for example `Accounts > Receipts > Create`) and it lists the method and path. In the code,
   `grep -rn "screen: 'Accounts > Receipts" backend/src/modules` gives the same answer. The browser's network tab shows
   the call and its `x-request-id` response header.
2. **API to service.** The route is in `src/modules/<module>/router.js`; the handler calls a function in the module's
   `service.js` (or a named file such as `placements.js`). Permission failures answer 403 with the permission that
   was missing.
3. **Service to tables.** SQL is written in the service. Most tables carry `created_by`, `created_at`, `updated_by`,
   `updated_at`; changes are in `audit_log` (`entity`, `entity_id`, `before_data`, `after_data`, `username`, `at`).
   Journals point back to their source document through `journal_vouchers.reference_type` and `reference_id`.

## 6. Logs and request ids

Every request gets an id: the caller's `x-request-id` header when it is well formed, otherwise a new UUID. It is
returned in the `x-request-id` response header, written on every log line of the request (`req.id`), and returned in
every error body as `requestId`. A 500 answers "Internal server error; quote the request id when reporting it"; the
message, stack and database error are only in the log, on the line with that request id.

Logs are JSON lines on standard output (pino). Tokens, cookies, passwords and signed-link parameters are redacted.
Useful fields: `req.url`, `res.statusCode`, `responseTime`, `requestId`, `err.message`, `err.stack`, and for jobs
`job` and `runId`.

## 7. Common production issues and where to look

**Sign-in.** `login_history` records every attempt with `success` and `reason` (`bad-password`, `unknown-user`,
`locked`, `inactive`, `rate-limited`, `2fa-required`, `bad-2fa-code` ...). After `limits.max_login_attempts` wrong
passwords the user's `status` becomes `locked`; an administrator unlocks the user or resets the password on Master >
User Management. Too many attempts for one username or from one address answer 429 with `Retry-After`
(`security.login_rate_limit`, counted per API instance). A user whose password is older than
`security.password_max_age_days` signs in with `mustChangePassword` and must change it first.

**Document numbers.** "Document numbering series X is not configured / inactive": see
`src/modules/document-numbering/README.md`. Counters are in `sequences`.

**Postings.** A journal is refused when it does not balance, uses an inactive account, or falls in a closed period.
The message names the account role or the period. Account roles are on Account Determination, posting rules on
Master > Finance > Posting Rules (with a Simulate button). See `src/modules/accounting/README.md`.

**Period close.** "Accounting period ... is soft-closed / closed / locked": see `src/modules/period-end/README.md`.

**Scheduled jobs.** Master > Schedules lists every job with its last status. Each run is a row of `job_runs`
(`status`, `output`, `error`, `triggered_by`). A failed run is also logged with the job code. Jobs run in the business
time zone. When several API instances run, a run takes a PostgreSQL advisory lock, so a job never runs twice for the
same slot; `SCHEDULER_ENABLED=false` keeps an instance out of scheduling. Period-end and bank-matching jobs are
disabled by default.

**PDFs.** Documents are built by `src/lib/pdf` from the templates in `src/modules/documents/templates.js`, with the
letterhead from the primary company of the Company master and formats from `general.date_format` and
`currency.decimals`. A wrong logo or company name is master data, not code. Characters outside the PDF font are
replaced (see `lib/pdf/fonts.js`).

**E-mail outbox.** E-mails are written to `email_outbox` first; the `email-outbox` job sends them every 5 minutes.
Nothing is sent unless `notification.email_enabled` is true and `SMTP_URL` is set; the job's output says which one is
missing. A message is tried five times, then its `status` becomes `failed` with the last `error`. To resend, set its
`status` back to `queued` and `attempts` to 0.

**Files.** Uploaded and generated files are in `UPLOAD_DIR`, registered in `documents` (`storage_key`). Links are
signed and expire after `FILE_URL_TTL_SECONDS`; the API signs them again in every response, so a screen that saved an
old link still gets a working one.

**Health.** `GET /api/health` (database and migrations; 503 when not ready), `GET /api/health/live` (process only),
`GET /api/version` (version, commit, pending migrations).

## 8. How to add things

**A route.** In the module's `router.js`: `define({ method, path, summary, screen, middleware, request, query,
response, handler })`. Give `screen` the front-end menu path, protect it with `requirePermission`, validate the body
with `validate(zodSchema)`, keep SQL in the service, throw the errors from `lib/errors.js`, call `audit()` on every
change. Run `npm run export:api`.

**A setting.** Insert it in a seed or migration with `ON CONFLICT (key) DO NOTHING`, with a group and a label (the
label is what administrators read on Master > Configuration). Read it with `getSetting('group.key', <the seeded
value>)`. `npm run check:settings` and `test/configuration.test.js` fail on a key that is read but never seeded.

**A migration.** A new file `src/db/migrations/NNNN_short_name.sql` with the next number. Never edit an applied
migration's SQL: fix forward in a new file. Make it safe to run on a database that already has data (`IF NOT EXISTS`,
`ON CONFLICT DO NOTHING`, updates with a `WHERE`). Migrations run at start-up inside a transaction each, one instance
at a time (advisory lock).

**A master type.** Most masters are metadata: a row of `master_types` (code, label, category, screen, storage
`generic` or `table`, fields as JSON, unique keys) and records in `master_records`. Add the type in a seed file (see
`src/db/seeds/51_masters.sql`); the generic `/masters/:type` routes serve it with no new code. Use `storage = 'table'`
only for the reference tables listed in `TABLES` in `src/modules/masters/service.js`.

**A posting rule.** Add the business event to `EVENTS` in `src/modules/accounting/lib/posting.js` (label, module,
the amount keys the operation supplies, template variables and a sample context), then seed its first rule version
in a migration (`posting_rules` and `posting_rule_lines`; see `0148_accounting_followups.sql`). The operation calls
`postEvent('<event>', context, { db, user })`. `test/posting-rules.test.js` checks that every event balances on its
sample.

**A document number series.** See `src/modules/document-numbering/README.md`: a row of `document_numbering` in a
migration, then `nextDocumentNumber('<code>', { db })`.

**A report.** See `src/modules/reports/README.md`: a base query in `queries.js`, a `report_definitions` row, a test.

**A scheduled job.** Export an async handler from `src/jobs/handlers.js` (it receives the job's `params` and returns
a JSON summary), then add the job to `src/db/seeds/jobs.json` (code, name, description, cron, handler, params,
enabled). The seed adds it; administrators change the schedule and parameters on Master > Schedules.

**A module.** Follow `backend/docs/MODULE_GUIDE.md`. A folder with `router.js` under `src/modules` is mounted
automatically.
