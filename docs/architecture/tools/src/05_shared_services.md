# Introduction

## Purpose and scope

This document describes the shared service components of BrokerVerse OOTB: the backend services in `backend/src/lib` and `backend/src/jobs` that every business module uses, the shared engines inside the larger modules (posting rules, reports), and the shared front-end components and utilities in `brokerverse/src`. For each component it gives the responsibility, the main interface, the configuration it reads and the points to observe when extending or operating it. New modules use these components and do not re-implement them; a backend test fails if a second copy of the date, amount, CSV, template or maker-checker helpers appears.

![Shared service components of the front end and the backend](d05_shared_services)

# Backend shared services

## Overview

{widths: 24,28,48}
| Component | Location | Responsibility |
|---|---|---|
| Configuration | `src/config.js` | Environment configuration and the production start-up check |
| Route registry | `lib/registry.js` | Declares every endpoint, enforces sign-in, records roles, permissions and the screen for the API documentation |
| Authentication and authorisation | `lib/auth.js`, `lib/password.js`, `lib/totp.js`, `lib/loginHistory.js` | Tokens, session revocation, roles with inheritance, permissions, password policy, two-factor, sign-in log |
| Record scope | `lib/scope.js` | Own-book scoping for roles listed in `security.scoped_roles` (none by default) |
| Settings | `lib/settings.js` | Configuration from `app_settings` with a cache that follows changes on every instance |
| Document numbering | `lib/numbering.js`, SQL `next_document_number()` | Numbers of every document series from the Document Numbering master |
| Posting engine | `modules/accounting/lib/posting.js`, `ledger.js`, `coinsurance.js` | Journals from posting rules and account roles; co-insurance split; period checks |
| Maker-checker | `lib/makerChecker.js` | The approver must differ from the maker |
| Audit | `lib/audit.js` | Audit log of every change |
| Notifications | `modules/notifications/service.js` `notify()` | In-app notifications to a user or to a permission audience |
| E-mail outbox | `lib/mailer.js`, `lib/template.js` | Queue, render and deliver e-mail |
| PDF engine and letterhead | `lib/pdf`, `lib/letterhead.js`, `modules/documents/templates.js` | Every document and report PDF, with the Company master letterhead |
| Spreadsheets and files | `lib/xlsx.js`, `lib/csv.js`, `lib/zip.js`, `modules/documents/uploadTemplates.js` | XLSX and CSV output, upload templates |
| Reports engine | `modules/reports/engine.js`, `queries.js`, `service.js` | Parameterised report SQL, on-screen runs, files, schedules |
| File storage and signed links | `modules/uploads/storage.js`, `fileTypes.js`, `lib/fileLinks.js`, `lib/secrets.js` | S3-style key space on disk, type checking, signed expiring URLs |
| Scheduler and housekeeping | `jobs/scheduler.js`, `jobs/handlers.js`, `jobs/housekeeping.js` | Cron jobs in the business time zone with advisory locks and run history; retention purge |
| Rate limiting and upload limits | `lib/rateLimit.js`, `lib/uploadLimits.js` | Sign-in and global API limits; multipart and import limits |
| Dates and money | `lib/dates.js`, `lib/money.js`, `lib/birthDate.js` | Business dates in the configured time zone; rounding and formatting |
| Validation, errors and responses | `lib/validate.js`, `lib/errors.js`, `lib/respond.js` | zod validation, error envelope, success envelope and paging |
| Request context and logging | `lib/requestContext.js`, `lib/logger.js` | The signed-in user deep inside a request; pino logger with redaction |
| Health | `lib/health.js`, `modules/system` | Readiness, liveness, version |
| Database access | `db/pool.js`, `db/migrate.js` | Pool, `query`, `one`, `many`, `withTransaction`; migrations under an advisory lock |

## Configuration (src/config.js)

`buildConfig()` reads the environment once (with `.env` through dotenv in development): `PORT` (8000), `DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_TTL_SECONDS` (1,800), `JWT_REFRESH_TTL_SECONDS` (2,592,000), `DATA_ENCRYPTION_KEY`, `CORS_ORIGINS`, `UPLOAD_DIR`, `PUBLIC_BASE_URL`, `SMTP_URL`, `LOG_LEVEL`, `FILE_URL_TTL_SECONDS` (1,800), `JSON_BODY_LIMIT` (2 MB), `UPLOAD_MAX_MB` (10), `UPLOAD_MAX_FILES` (10), `IMPORT_MAX_MB` (10), `IMPORT_MAX_INFLATED_MB` (50), `IMPORT_MAX_ROWS` (20,000). Operational variables are read where they are used: `SEED_SAMPLE_DATA`, `SCHEDULER_ENABLED`, `SCHEDULER_RELOAD_SECONDS` (30), `SETTINGS_CHECK_MS` (5,000), `SETTINGS_CACHE_TTL_MS` (60,000), `MIGRATION_LOCK_TIMEOUT_MS` (600,000), `ADMIN_PASSWORD`, `HEALTH_DB_TIMEOUT_MS` (2,000), `SHUTDOWN_TIMEOUT_MS` (25,000) and `GIT_COMMIT`. With `NODE_ENV=production`, `assertProductionConfig()` stops the process when a secret is missing, a placeholder, shorter than 32 characters or reused, when `CORS_ORIGINS` is `*`, or when `PUBLIC_BASE_URL` is missing or local. The full list with comments is `backend/.env.example`; the production template is `deploy/backend.env.example`.

## Route registry (lib/registry.js)

Every module creates its router with `moduleRouter(module, prefix)` and declares each endpoint with `define({ method, path, summary, auth, roles, permissions, screen, request, query, response, middleware, handler })`. `define()`:

- places `requireAuth` first unless the route is declared `auth: false`, so no route can be left unauthenticated by mistake;
- wraps the async handler so errors reach the error middleware;
- records the route, the roles and permissions of its middleware, the front-end screen and example payloads in `ROUTES`. `npm run export:api` turns them into the OpenAPI document, the Postman collection and the Excel and CSV touchpoint list, whose "By Screen" sheet leads support from a screen to its API calls.

## Authentication and authorisation (lib/auth.js and related)

{widths: 28,72}
| Function | Behaviour |
|---|---|
| `signAccess(user, { restrict })` | HS256 access token with the effective roles, permissions and token version; restricted tokens for two-factor enrolment or a forced password change |
| `signRefresh(user, jti)`, `signToken()` | Refresh token (recorded in `refresh_tokens`); other short-lived tokens (two-factor challenge, quotation approval, report download) with their own `type` claim |
| `verify()` | Accepts HS256 only |
| `authenticate()`, `requireAuth` | Token type, active user and unchanged token version; restricted tokens only on their allowed paths |
| `loadUser()` | Reads the user with the effective roles of `user_effective_roles()`: assigned roles plus inherited ones (Accounting Manager inherits Accounting) |
| `revokeSessions(userId, { refresh })` | Raises `token_version`; optionally revokes all refresh tokens |
| `requirePermission(...codes)`, `requireRole(...roles)`, `isAdmin()`, `hasPermission()` | Authorisation middleware; the administrator role is named once (`ADMIN_ROLE = 'system-admin'`) and passes every check |
| `lib/password.js` | Policy from `security.password_*`; history of the last N hashes; expiry after `security.password_max_age_days` |
| `lib/totp.js`, `lib/secrets.js` | RFC 6238 TOTP (any authenticator app); AES-256-GCM encryption of the TOTP secret; HMAC-hashed reset codes |
| `lib/loginHistory.js` | Records every password, two-factor and refresh attempt with IP, user agent and reason |

## Record scope (lib/scope.js)

A user is scoped when every role they hold is listed in `security.scoped_roles`. The setting is empty in the seed (the agent sign-in was withdrawn), so today no user is scoped. The mechanism stays for a broker who wants account executives to see only their own book: list services add `scopeSql(scope, entity, alias, params)` to their WHERE clause; detail and action routes use the `ownRecord(entity)` middleware, which answers 404 for a record the user may not see.

## Settings (lib/settings.js)

`getSetting(key, fallback)` reads `app_settings.value` (JSONB) and caches it in the process. `getSettings(group)` lists a group; `setSetting()` updates the row, stamps `updated_by` and `updated_at` and drops the key from the local cache. Every business parameter is read this way; the code fallback must equal the seeded value (tested).

The cache follows changes made through any instance. At most every `SETTINGS_CHECK_MS` (5 seconds) a read compares the table version (row count and latest `updated_at`) with the one it saw last and drops the whole cache when it moved. Each entry also expires after `SETTINGS_CACHE_TTL_MS` (60 seconds), which covers changes made outside the API. No restart is needed after a configuration change.

## Document numbering (lib/numbering.js)

`nextDocumentNumber(code, { db, branch, lob, date, unique })` returns the next number of a series of the Document Numbering master, for example `POL-2026-00001`. Called with the caller's transaction (`db`), the counter row stays locked until the transaction ends and a rollback gives the number back. The date defaults to today in `general.timezone`. With `unique: { table, column }` a number already present in the target column (entered by hand or imported) is skipped. Series, patterns and reset rules are described in document 02; `src/modules/document-numbering/README.md` has the support notes.

## Posting engine (modules/accounting/lib)

`postEvent(eventCode, context, { db, user })` turns a business event into a journal. It loads the posting rule version in force on the posting date, resolves every line to a GL account (a fixed account, the account role in `accounting.account.<role>`, a resolver, or an account the caller passes) and calls `createJournal`, which numbers the journal, checks that debits equal credits, that the accounts are active and that the period accepts the posting (`assertPostingAllowed` of the period-end module), and posts it. Lines marked per participant are split across co-insurers by share (`coinsurance.js`, remainder on the lead). Posting rules are edited on Master > Finance > Posting Rules, which has a Simulate button; the list of events is `EVENTS` in `posting.js`, and `test/posting-rules.test.js` checks that every event balances on its sample.

## Maker-checker and audit

`assertChecker(user, makerId, what)` refuses an approval by the user who created or submitted the record. The switch `finance.maker_checker_enabled` turns it off for a small office with one accounting user; reinsurance treaties and cessions keep the rule always, and the period close and bank reconciliation check the approver themselves.

`audit(req, { entity, entityId, action, before, after })` inserts into `audit_log` the user id and name, entity, id, action, before and after JSON and the client IP. Mutating handlers call it after the change; it runs as its own statement, not inside the business transaction. Reviews: Master > Audit Trail (`GET /api/settings/audit`, permission `read:audit`, filters entity, entity id, username and a from / to business-date range; newest 200, at most 1,000).

## Notifications and audience

`notify({ userId, type, priority, title, message, link, entity, entityId, audience })` inserts a row in `notifications`. A notification goes to one user or, without a user, to everyone who holds the permission in `audience` (for example `write:journal-vouchers` for journal vouchers awaiting approval). The front end polls the unread count every 30 seconds while signed in. Switches: `notification.approval_requests`, `notification.claim_status`, `notification.renewal_reminder`.

## E-mail outbox (lib/mailer.js)

`queueEmail({ to, cc, subject, html, template, entity, entityId })` inserts into `email_outbox`; nothing is sent in the request. The `email-outbox` job calls `sendQueuedEmails()` every 5 minutes. When `notification.email_enabled` is true and `SMTP_URL` is set, it sends up to 50 queued messages (oldest first) from `notification.from_address`, marks them `sent`, or increments `attempts` and stores the error; after 5 failed attempts the message is `failed`. Templates are settings (`email.template.*`, `security.reset_email_*`, `reports.email_*`, `remittance.*_email_*`) rendered by `renderTemplate()` with `{{placeholder}}` substitution; the body is HTML-escaped and the subject is plain text.

> **Note:** E-mail is off in the seed (`notification.email_enabled = false`). Until it is switched on, messages wait in the outbox with status `queued` and are sent afterwards. Throughput is 50 messages per run, 600 per hour; bulk renewal notices use their own queue job (`renewal-queue`, every minute). The sender must be the Office 365 mailbox of `SMTP_URL`, otherwise Office 365 refuses the message.

## PDF engine and letterhead (lib/pdf, lib/letterhead.js)

One PDF engine, with no third-party dependency, produces every document and report: quotations, policy schedules, broker slips, placement slips, billing statements, official receipts, vouchers, debit notes, claim letters, reconciliation statements and report listings. `renderPdf(spec)` fills in the letterhead, formats and user and builds the file; `renderPdfBatch()` puts several documents in one file (bulk receipt and voucher prints); `renderReportPdf()` lays out a report with its parameters, columns and summary figures. Every page carries the letterhead of the primary active company of the Company master (`master_records` of type `company` flagged as the letterhead company) and a footer with the company, "Generated <date time> by <user>" and "Page X of Y". The logo comes from the company record, else from `documents.default_logo_path`. Dates follow `general.date_format`, amounts `currency.decimals`, times `general.timezone`. Text uses the PDF base fonts (Helvetica, WinAnsi); the peso sign prints as "PHP". The letterhead is cached for 30 seconds and cleared when the Company master changes. Document layouts are in `modules/documents/templates.js`.

## Spreadsheets, CSV and upload templates

{widths: 28,72}
| Writer | Use |
|---|---|
| `lib/xlsx.js` with `lib/zip.js` | Multi-sheet XLSX with styled frozen header, auto-filter and typed cells (money, date, integer) |
| `lib/csv.js` | RFC 4180 CSV with UTF-8 BOM; every cell starting with `=`, `+`, `-` or `@` is guarded against spreadsheet formulas |
| `modules/documents/uploadTemplates.js`, `scripts/build-upload-templates.js` | The upload templates (Data, Columns and Instructions sheets) built from each importer's own column list; the same workbooks are downloadable on the screens with an Upload button and published in `docs/templates` |

## Reports engine (modules/reports)

The catalogue (`report_definitions`, 39 reports, including financial statements, BIR reports, placement pipeline, market response, co-insurance and bank reconciliation reports) defines the parameters, the base query name, default columns, roles and permission. `engine.js` normalises the screen parameters (dates in the business time zone, account executive, insurer, branch and client filters), wraps the base query from `queries.js` with parameterised filters, sorting, paging and totals, and validates column identifiers. `service.js` runs reports on screen (`POST /reports/{code}/run`), generates files (CSV, XLSX, PDF; at most `reports.max_rows` = 50,000 rows) into `UPLOAD_DIR/reports` recorded in `generated_reports`, returns download links signed for `reports.download_link_ttl_hours` (72 h), and runs report schedules as scheduled jobs that e-mail a download link. Generated files older than `reports.retention_days` (90) are deleted by the daily-reports job.

## File storage and signed links

{widths: 28,72}
| Function | Behaviour |
|---|---|
| `storeFile(file, { folder, userId, entity, entityId })` | Checks the file content against `uploads.allowed_types` (signature detection; the detected type is stored), reserves a key `folder/<timestamp>-<128-bit random>-<name>`, writes the file under `UPLOAD_DIR` and records it in `documents` |
| `newKey()`, `reserveKey()`, `writeObject()` | One key generator for every upload and generated file; the two-step upload used by the presigned-URL endpoints |
| `resolveKey()` | Normalises the key and refuses paths outside `UPLOAD_DIR` |
| `publicUrl(key)`, `signedUrl(key)` | Canonical URL stored in records; signed URL with `exp` and HMAC `sig` |
| `lib/fileLinks.js` | Middleware that signs every object URL in JSON responses, so records keep unsigned URLs and links copied out of the application expire |
| `GET /s3/object/*` | Serves a file to a bearer-token caller or a valid signature; `nosniff`, sandbox CSP (PDF excepted), attachment disposition for anything other than images and PDF |
| Delete, overwrite | Only the uploader, a writer of the owning module or an administrator |

The storage functions keep an S3-like key space, so they can later be replaced by Amazon S3 without changing the modules.

## Scheduler and housekeeping (jobs/)

{widths: 28,72}
| Aspect | Behaviour |
|---|---|
| Start | `startScheduler()` at API start (unless `SCHEDULER_ENABLED=false`) schedules every enabled row of `scheduled_jobs` with node-cron in the time zone `general.timezone`; invalid cron expressions are skipped with a warning |
| Changes | Every `SCHEDULER_RELOAD_SECONDS` (30) each instance compares a signature of the jobs table and the time zone with the one it loaded and reloads when it differs, so a schedule edited through one instance reaches all of them |
| Single execution | `runJob()` takes `pg_try_advisory_lock(hashtext('brokerverse.scheduled_job'), hashtext(code))` on a dedicated connection; if another instance holds it the run is skipped. A scheduled run is also skipped when a scheduled run of the same job already started in the same minute (clock skew between instances) |
| Recording | Each executed run inserts `job_runs` (triggered by `schedule` or the user name) and updates `scheduled_jobs.last_run_at` and `last_status`; the handler output (JSON) or error is stored; a failure is also logged at error level with the job code and run id |
| Manual run | Master > Schedules > Run now (`POST /api/schedules/{code}/run`); listing needs `read:schedules` |
| Handlers | `renewalNotices`, `policyExpiry`, `quoteExpiry`, `receivableAgeing`, `dailyReports`, `emailOutbox`, `processRenewalQueue`, `renewalPipeline`, `collectionReminders`, `housekeeping`, `monthEndReminder`, `recurringJournals`, `accrualReversal`, `periodAutoSoftClose`, `bankAutoMatch`, `scheduledReport` |
| Housekeeping | `jobs/housekeeping.js` deletes, in batches of 5,000 rows, job runs, sent and failed e-mails, sign-in history, expired or revoked refresh tokens, used or expired reset codes, read notifications and completed queue items older than the days in System Settings > Housekeeping (`housekeeping.*`; 0 keeps forever). The audit trail is kept unless `housekeeping.audit_log_days` is set, and never below seven years (document 10). |

## Rate limiting and upload limits

`lib/rateLimit.js` keeps two in-memory limiters per process: a sliding window for sign-in and forgot-password (`security.login_rate_limit`, 10 per 300 s, keyed by IP and by username) and a fixed-window global API limit (`security.api_rate_limit`, 600 requests per 60 s per signed-in user or per IP; health checks and CORS pre-flights are not counted; 429 with `Retry-After`). `lib/uploadLimits.js` provides `memoryUpload()` (documents and photos, per-file size and file count), `importUpload()` (one spreadsheet or statement file), `inflateEntry()` (caps decompression of workbook parts) and `assertRowLimit()`.

## Dates, money and validation

{widths: 28,72}
| Component | Interface |
|---|---|
| `lib/dates.js` | `businessTimeZone()` (`general.timezone`), `today()`, `businessDate()`, `nowInTz()`, `calendarPeriod(period)`, `isoDate()`, `addDays()` |
| `lib/money.js` | `round2()` (half away from zero with floating-point correction), `toNumber()`, `formatMoney(amount, currency)` using `currency.default`, its locale and `currency.decimals` |
| `lib/birthDate.js` | Age plausibility of dates of birth (`leads.min_age_years`, `leads.max_age_years`) |
| `lib/validate.js` | `validate(schema, part)` middleware with zod; the parsed value replaces the input |
| `lib/errors.js` | `HttpError` and helpers (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`); `errorHandler` returns `{ success: false, message, requestId }`, with a generic message for 5xx |
| `lib/respond.js` | `ok()`, `created()` envelopes (list responses of the finance modules use `sendList()` in `modules/accounting/lib/http.js`); `paging()` (page and perPage with aliases, capped at 500, default 10); `pageMeta()` |
| `db/pool.js` | `query()`, `one()`, `many()`, `withTransaction(fn)` (BEGIN, COMMIT or ROLLBACK on one client) |

# Front-end shared components

{widths: 26,74}
| Component | Responsibility |
|---|---|
| API access: `utility/interceptor.js`, `utility/commonServices.js`, `utility/sessionRefresh.js`, `services/*Service.js` | Axios client with the bearer token and a wrapper around `window.fetch` for the older services. On a 401 from a non-auth endpoint, one shared refresh per tab exchanges the refresh token (or picks up a token already rotated by another tab), retries the request, and ends the session with a redirect to `/login?session=ended` if the refresh fails. `REACT_APP_BASE_URL` (compiled in) is the API base. |
| Session: `utility/tokenManager.js`, `logout.js`, `idleTimeout.js`, `redux/store.js` | Token storage in `localStorage`; sign-out clears the session keys and resets the Redux store; idle sign-out after `limits.session_idle_minutes` with a one-minute warning. |
| Route guard and menus: `routes/ProtectedRoute`, `utils/menuPermissions.js`, `utils/canOpen.js` | Deny-by-default role-to-menu map for the seven broker roles; `filterMenuForRoles()` and `isPathAllowed()` guard every route; `canOpen(path)` hides buttons that lead to screens the role cannot open, and approval actions the user may not take are hidden. The server remains the authority. |
| Dialogs and toasts: `components/AppDialogs`, `utility/dialogs.js`, `components/Toast`, `utility/toastUtils.js` | One shared toast and confirmation dialog, and an in-app prompt for reasons (reject, reverse, resolve), instead of the browser's alert, confirm and prompt. |
| System settings and branding: `module/SystemSettings/store/systemSettingsSlice.js`, `utility/applySystemSettings.js` | Loads the public system settings (`GET /api/system-settings`, also used by the sign-in page) and applies theme colours, favicon, logo, language, display currency, date format, phone format and quotation options. The default name is BrokerVerse with the iorta TechNXT logo. |
| Formatting: `utility/dateFormat.js`, `utility/numberFormat.js`, `hooks/useFormatCurrency.js`, `utility/phoneFormat.js` | Dates in `general.date_format`; amounts in the configured currency and locale (`en-PH` grouping); Philippine mobile number format from settings. |
| Configuration-driven options: `utility/currencyOptions.js`, `utility/quoteOptions.js`, `utility/systemCurrencies.js`, master-option hooks | Drop-downs filled from settings and master data instead of constants. |
| Imports: `services/importService.js`, the Upload buttons of master screens, Chart of Accounts, Period Management and Collections | Upload of a template-based file, preview of the rows and the errors per row, download of the template. |
| Notifications: `context/NotificationContext.js`, `components/NotificationDropdown`, `NotificationBadge` | Unread count polled every 30 seconds while signed in; list, mark read, delete. |
| File upload: `components/S3FileUpload` | Upload with progress and preview through the `/s3` endpoints; shows the signed URLs returned by the API. |
| Internationalisation: `i18n.js`, `locales/en.json`, `th.json` | i18next with browser language detection; English complete (checked by `npm run check:i18n`); Thai partial; Filipino listed without a translation file. |
| Logging: `utility/logger.js` | Diagnostics silent in production builds, enabled per browser for support; ESLint warns on direct `console` calls. |
| Checks: `scripts/check-api-calls.js`, `scripts/check-translations.js` | `npm run check:api` compares every front-end API call with the backend OpenAPI document; `npm run check:i18n` compares the translation keys used with `en.json`. |
