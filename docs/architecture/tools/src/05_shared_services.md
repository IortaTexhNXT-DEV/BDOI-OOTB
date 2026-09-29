# Introduction

## Purpose and scope

This document describes the shared service components of BrokerVerse: the backend services in `backend/src/lib`, `backend/src/jobs` and `backend/src/tools` that every business module uses, and the shared front-end components and utilities in `brokerverse/src`. For each component it gives the responsibility, the main interface, the configuration it reads and the points to observe when extending or operating it. New modules should use these components rather than re-implementing them.

![Shared service components of the front end and the backend](d05_shared_services)

# Backend shared services

## Overview

{widths: 24,26,50}
| Component | Location | Responsibility |
|---|---|---|
| Configuration | `src/config.js` | Environment configuration and the production start-up check |
| Route registry | `lib/registry.js` | Declares every endpoint, enforces sign-in, records roles / permissions for documentation |
| Authentication and authorisation | `lib/auth.js`, `lib/password.js`, `lib/totp.js`, `lib/loginHistory.js` | Tokens, session revocation, roles and permissions, password policy, two-factor, sign-in log |
| Record scope | `lib/scope.js` | Agents see only their own book |
| Settings | `lib/settings.js` | Configuration-driven behaviour from `app_settings` with an in-process cache |
| Numbering | SQL `next_number()` and helpers | Yearly document numbers with configurable prefixes |
| Audit | `lib/audit.js` | Audit log of every change |
| Notifications | `modules/notifications/router.js` `notify()` | In-app notifications to a user or to a permission audience |
| E-mail outbox | `lib/mailer.js` | Queue and deliver e-mail |
| Documents | `modules/documents`, `tools/pdf.js`, `tools/xlsx.js`, `tools/csv.js`, `tools/zip.js` | PDF, XLSX and CSV generation |
| Reports engine | `modules/reports/engine.js`, `queries.js`, `service.js` | Parameterised report SQL, on-screen runs, files, schedules |
| File storage and signed links | `modules/uploads/storage.js`, `fileTypes.js`, `lib/fileLinks.js`, `lib/secrets.js` | S3-style key space on disk, type checking, signed expiring URLs |
| Scheduler | `jobs/scheduler.js`, `jobs/handlers.js` | Cron jobs with PostgreSQL advisory locks and run history |
| Rate limiting and upload limits | `lib/rateLimit.js`, `lib/uploadLimits.js` | Sign-in and global API limits; multipart and import limits |
| Dates and money | `lib/dates.js`, `lib/money.js`, `lib/birthDate.js` | Business dates in the configured time zone; rounding and formatting |
| Validation, errors and responses | `lib/validate.js`, `lib/errors.js`, `lib/respond.js` | zod validation, error envelope, success envelope and paging |
| Health | `lib/health.js`, `modules/system` | Readiness, liveness, version |
| Database access | `db/pool.js` | Pool, `query`, `one`, `many`, `withTransaction` |

## Configuration (src/config.js)

`buildConfig()` reads the environment once (with `.env` through dotenv in development): `PORT` (8000), `DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_TTL_SECONDS` (1,800), `JWT_REFRESH_TTL_SECONDS` (2,592,000), `DATA_ENCRYPTION_KEY`, `CORS_ORIGINS`, `UPLOAD_DIR`, `PUBLIC_BASE_URL`, `SMTP_URL`, `LOG_LEVEL`, `FILE_URL_TTL_SECONDS` (1,800), `JSON_BODY_LIMIT` (2 MB), `UPLOAD_MAX_MB` (10), `UPLOAD_MAX_FILES` (10), `IMPORT_MAX_MB` (10), `IMPORT_MAX_INFLATED_MB` (50), `IMPORT_MAX_ROWS` (20,000). Other variables read directly: `SEED_SAMPLE_DATA`, `SCHEDULER_ENABLED`, `ADMIN_PASSWORD`, `HEALTH_DB_TIMEOUT_MS` (2,000), `SHUTDOWN_TIMEOUT_MS` (25,000), `GIT_COMMIT`. With `NODE_ENV=production`, `assertProductionConfig()` stops the process when a secret is missing, a placeholder, shorter than 32 characters or reused, when `CORS_ORIGINS` is `*`, or when `PUBLIC_BASE_URL` is missing or local.

## Route registry (lib/registry.js)

Every module creates its router with `moduleRouter(module, prefix)` and declares each endpoint with `define({ method, path, summary, auth, roles, permissions, screen, request, query, response, middleware, handler })`. `define()`:

- places `requireAuth` first unless the route is declared `auth: false`, so no route can be left unauthenticated by omission;
- wraps the async handler so errors reach the error middleware;
- records the route, the roles and permissions required by its middleware, the front-end screen and example payloads in `ROUTES`, from which `npm run export:api` generates the OpenAPI document, the Postman collection and the Excel / CSV touchpoint list.

## Authentication and authorisation (lib/auth.js and related)

{widths: 28,72}
| Function | Behaviour |
|---|---|
| `signAccess(user, { restrict })` | HS256 access token with roles, permissions and token version; restricted tokens for two-factor enrolment or a forced password change |
| `signRefresh(user, jti)`, `signToken()` | Refresh token (recorded in `refresh_tokens`); other short-lived tokens (two-factor challenge, quotation approval, report download) with a distinct `type` claim |
| `verify()` | Accepts HS256 only |
| `authenticate()`, `requireAuth` | Token type, user active and unchanged token version; restricted tokens only on their allowed paths |
| `revokeSessions(userId, { refresh })` | Raises `token_version`; optionally revokes all refresh tokens |
| `requirePermission(...codes)`, `requireRole(...roles)`, `isAdmin()`, `hasPermission()` | Authorisation middleware; `it-admin` and `ba` pass every check |
| `lib/password.js` | Policy from `security.password_*`; history of the last N hashes; expiry after `security.password_max_age_days` |
| `lib/totp.js`, `lib/secrets.js` | RFC 6238 TOTP (any authenticator app); AES-256-GCM encryption of the TOTP secret; HMAC-hashed reset codes |
| `lib/loginHistory.js` | Records every password, two-factor and refresh attempt with IP, user agent and reason |

> **Note:** The list of administrator roles (`it-admin`, `ba`) is repeated in several places in the code (code review item 22). Changing which roles are administrators requires a code change.

## Record scope (lib/scope.js)

A user is scoped when every role they hold is listed in `security.scoped_roles` (default `["agent"]`). `scopeOf(req)` returns the scope; list services add `scopeSql(scope, entity, alias, params)` to their WHERE clause; detail and action routes use the `ownRecord(entity)` middleware, which answers 404 for a record the user may not see. Scoped entities: lead, client, quotation, policy, endorsement, claim, renewal, receipt, commission and referrer, matched on the owner, agent or creator columns and on ownership of the client.

## Settings (lib/settings.js)

`getSetting(key, fallback)` reads `app_settings.value` (JSONB) and caches it in a process-level map; `getSettings(group)` lists a group; `setSetting()` updates the row, stamps `updated_by` / `updated_at` and removes the key from the local cache. All business parameters (tax rates, prefixes, limits, templates, e-mail texts, security policy, report options) are read this way; the code review found all setting keys seeded and read through `getSetting`.

> **Gap:** The settings cache has no expiry and is cleared only in the process that saved the change. With two or more API instances, a change made in Master > Configuration reaches the other instances only when they restart; until then they apply the old value (for example a tax rate, a numbering prefix or a rate limit). Recommended: a short time-to-live (for example 30 to 60 seconds) or a PostgreSQL `LISTEN / NOTIFY` invalidation; until then restart all instances after configuration changes.

## Numbering

`next_number(name, prefix)` in SQL returns `<prefix>-<year>-<5 digits>` from the counter table `sequences`; the prefix is `numbering.<entity>.prefix` (43 keys). Helpers: `nextNumber()` in `modules/documents/common.js` (quotations, policies, endorsements), `modules/claims/util.js` (claims, renewals, campaigns; re-checks uniqueness), `modules/masters/helpers.js` (incentive, reinsurance, remittance items) and `nextNo()` in disbursements. Details and the year / time-zone gap: document 02.

## Audit (lib/audit.js)

`audit(req, { entity, entityId, action, before, after })` inserts into `audit_log` the user id and name, entity, id, action, before / after JSON and the client IP. It is called by mutating handlers after the change (it runs as a separate statement, not inside the business transaction). Reviews: Master > Audit trail (`GET /api/settings/audit`, permission `read:audit`, filters entity, entity id, username; newest 200, at most 1,000).

## Notifications and audience

`notify({ userId, type, priority, title, message, link, entity, entityId, audience })` inserts a row in `notifications`. A notification is addressed to one user or, without a user, to everyone who holds the permission in `audience` (for example `write:journal-vouchers` for journal vouchers awaiting approval); administrators see all audiences. The front end polls the unread count every 30 seconds while signed in (`context/NotificationContext.js`). Notification switches: `notification.approval_requests`, `notification.claim_status`, `notification.renewal_reminder`.

## E-mail outbox (lib/mailer.js)

`queueEmail({ to, cc, subject, html, template, entity, entityId })` inserts into `email_outbox`; nothing is sent in the request. The `email-outbox` job calls `sendQueuedEmails()` every 5 minutes: when `notification.email_enabled` is true and `SMTP_URL` is set, it sends up to 50 queued messages (oldest first) from `notification.from_address`, marks them `sent`, or increments `attempts` and stores the error; after 5 failed attempts the message is `failed`. Templates are settings (`email.template.*`, `security.reset_email_*`, `reports.email_*`, `remittance.*_email_*`) with `{{placeholder}}` substitution and HTML escaping (`renderTemplate()`).

> **Note:** With e-mail disabled (the seeded default `notification.email_enabled = false`) or without `SMTP_URL`, messages accumulate in the outbox with status `queued`; they are sent once e-mail is enabled. Throughput is at most 50 messages per 5 minutes (600 per hour) per run; bulk renewal notices use their own queue job (`renewal-queue`, every minute).

## Documents (PDF, XLSX, CSV)

{widths: 28,72}
| Writer | Use |
|---|---|
| `modules/documents/pdf.js` | A4 documents (title, key-value blocks, tables, paragraphs, automatic page breaks) for quotations, policy schedules, receipts, billing statements, claim letters and slips; Helvetica with WinAnsi text (the peso sign is written as PHP) |
| `tools/pdf.js` | Landscape tabular report PDFs (repeated header row, zebra rows, totals, page numbers) |
| `tools/xlsx.js` + `tools/zip.js` | Multi-sheet XLSX with styled frozen header, auto-filter, typed cells (money, date, integer) |
| `tools/csv.js` | RFC 4180 CSV with UTF-8 BOM and formula-injection guarding |

## Reports engine (modules/reports)

The catalogue (`report_definitions`, 19 reports) defines parameters, base query name, default columns, roles and permission. `engine.js` normalises the screen parameters (dates in the business time zone, agent, insurer, branch, client filters), wraps the base query from `queries.js` with parameterised filters, sorting, paging and totals, and validates column identifiers. `service.js` runs reports on screen (`POST /reports/{code}/run`), generates files (CSV, XLSX, PDF; at most `reports.max_rows` = 50,000 rows) into `UPLOAD_DIR/reports` recorded in `generated_reports`, returns download links signed for `reports.download_link_ttl_hours` (72 h), and runs report schedules as scheduled jobs that e-mail a download link. Generated files older than `reports.retention_days` (90) are deleted by the daily-reports job.

## File storage and signed links

{widths: 28,72}
| Function | Behaviour |
|---|---|
| `storeFile(file, { folder, userId, entity, entityId })` | Checks the file content against `uploads.allowed_types` (signature detection; the detected type is stored), reserves a key `folder/<timestamp>-<128-bit random>-<name>`, writes the file under `UPLOAD_DIR` and records it in `documents` |
| `reserveKey()`, `writeObject()` | Two-step upload used by the presigned-URL endpoints (`/s3/presigned-upload-url`, `PUT /s3/put/*`) |
| `resolveKey()` | Normalises the key and refuses paths outside `UPLOAD_DIR` |
| `publicUrl(key)` / `signedUrl(key)` | Canonical URL stored in records / signed URL with `exp` and HMAC `sig` |
| `lib/fileLinks.js` | Middleware that signs every object URL in JSON responses (one expiry per response), so records keep unsigned URLs and links copied out of the application expire |
| `GET /s3/object/*` | Serves a file to a bearer-token caller or a valid signature; `nosniff`, sandbox CSP (PDF excepted), attachment disposition for non-image / non-PDF |
| Delete / overwrite | Only the uploader, a writer of the owning module or an administrator |

The storage functions keep an S3-like key space so the implementation can be replaced by Amazon S3 (`storage.js`: "swap for S3 by replacing these functions"). Some modules write generated files directly under `UPLOAD_DIR` and register them in `documents` (`claims/util.js`, `accounting/lib/files.js`, `masters/helpers.js saveFile`) or in `generated_reports` (reports).

## Scheduler (jobs/scheduler.js)

{widths: 28,72}
| Aspect | Behaviour |
|---|---|
| Start | `startScheduler()` at API start (unless `SCHEDULER_ENABLED=false`) schedules every enabled row of `scheduled_jobs` with node-cron; invalid cron expressions are skipped with a warning; editing a job or a report schedule reloads the schedule on the instance that handled the change |
| Single execution | `runJob()` takes `pg_try_advisory_lock(hashtext('brokerverse.scheduled_job'), hashtext(code))` on a dedicated connection; if another instance holds it the run is skipped. A scheduled run is also skipped when a scheduled run of the same job already started in the same minute (clock skew between instances) |
| Recording | Each executed run inserts `job_runs` (triggered by `schedule` or the user name) and updates `scheduled_jobs.last_run_at` / `last_status`; the handler output (JSON) or error message is stored |
| Manual run | Master > Schedules > Run now (`POST /api/schedules/{code}/run`, administrators) |
| Handlers | `renewalNotices`, `policyExpiry`, `quoteExpiry`, `receivableAgeing`, `dailyReports`, `emailOutbox`, `processRenewalQueue`, `renewalPipeline`, `collectionReminders`, `scheduledReport` |

> **Gap:** A schedule change reloads the cron tasks only on the instance that served the request; other instances keep the old schedule until restart (the advisory lock still prevents double runs). The scheduler time zone is the container's (UTC), see document 01. There is no alert when a job fails: failures are visible only in Master > Schedules and `job_runs` (document 11).

## Rate limiting and upload limits

`lib/rateLimit.js` keeps two in-memory limiters per process: a sliding window for sign-in and forgot-password (`security.login_rate_limit`, 10 per 300 s, keyed by IP and by username) and a fixed-window global API limit (`security.api_rate_limit`, 600 requests per 60 s per signed-in user or per IP; health checks and CORS pre-flights are not counted; 429 with `Retry-After`). `lib/uploadLimits.js` provides `memoryUpload()` (documents and photos, per-file size and file count) and `importUpload()` (one spreadsheet or statement file), `inflateEntry()` (caps decompression of workbook parts) and `assertRowLimit()`.

## Dates, money and validation

{widths: 28,72}
| Component | Interface |
|---|---|
| `lib/dates.js` | `businessTimeZone()` (`general.timezone`), `today()`, `businessDate()`, `nowInTz()`, `calendarPeriod(period)`, `addDays()` |
| `lib/money.js` | `round2()` (half away from zero with floating-point correction), `formatMoney(amount, currency)` using `currency.default`, its locale and `currency.decimals` |
| `lib/birthDate.js` | Age plausibility of dates of birth (`leads.min_age_years`, `leads.max_age_years`) |
| `lib/validate.js` | `validate(schema, part)` middleware with zod; the parsed value replaces the input |
| `lib/errors.js` | `HttpError` and helpers (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`); `errorHandler` returns `{ success: false, message, requestId }`, with a generic message for 5xx |
| `lib/respond.js` | `ok()`, `created()` envelopes; `paging()` (page / perPage and aliases, perPage capped at 500, default 10); `pageMeta()` |
| `db/pool.js` | `query()`, `one()`, `many()`, `withTransaction(fn)` (BEGIN / COMMIT / ROLLBACK on one client) |

# Front-end shared components

{widths: 26,74}
| Component | Responsibility |
|---|---|
| API access: `utility/interceptor.js`, `utility/sessionRefresh.js`, `services/*Service.js` | Axios instance with the bearer token; a wrapper around `window.fetch` for services that call fetch directly. On a 401 from a non-auth endpoint, one shared refresh per tab exchanges the refresh token (or picks up a token already rotated by another tab), retries the request, and ends the session with a redirect to `/login?session=ended` if the refresh fails. `REACT_APP_BASE_URL` (compiled in) is the API base. |
| Session: `utility/tokenManager.js`, `logout.js`, `idleTimeout.js`, `redux/store.js` | Token storage in `localStorage`; sign-out clears the session keys and resets the Redux store; idle sign-out after `limits.session_idle_minutes` with a one-minute warning. |
| Route guard and menus: `routes/ProtectedRoute`, `utils/menuPermissions.js`, `utils/canOpen.js` | Deny-by-default role-to-menu map; `filterMenuForRoles()`, `isPathAllowed()` guard every route; `canOpen(path)` hides buttons that lead to screens the role cannot open. The server remains the authority (permissions on every API route). |
| Dialogs and toasts: `components/AppDialogs`, `utility/dialogs.js`, `components/Toast`, `utility/toastUtils.js` | One shared PrimeReact toast and confirmation dialog mounted in `App.js`, replacing the browser's alert / confirm (`notify*`, `confirmAction`). |
| System settings and branding: `module/SystemSettings/store/systemSettingsSlice.js`, `utility/applySystemSettings.js` | Loads the public system settings (`GET /api/system-settings`, no sign-in, also used by the sign-in page) and applies theme colours (CSS variables), favicon, logo, language, display currency, date format, phone format and quotation options. |
| Formatting: `utility/dateFormat.js`, `hooks/useFormatCurrency.js`, `utility/currencyConverter.js`, `utility/phoneFormat.js` | Dates in `general.date_format`; amounts in the configured currency and locale; Philippine mobile number format from settings. |
| Configuration-driven options: `utility/currencyOptions.js`, `utility/quoteOptions.js`, `utility/systemCurrencies.js`, master-option hooks | Drop-downs filled from settings and master data (currencies, vehicle colours, model-year span, covers) instead of constants. |
| Notifications: `context/NotificationContext.js`, `components/NotificationDropdown`, `NotificationBadge` | Unread count polled every 30 seconds while signed in; list, mark read, delete. |
| File upload: `components/S3FileUpload` | Upload with progress and preview through the `/s3` endpoints; displays signed URLs returned by the API. |
| Internationalisation: `i18n.js`, `locales/en.json`, `th.json` | i18next with browser language detection; English complete; Thai partial; Filipino configured without a translation file. |
| Production console guard: `utility/productionConsole.js` | Disables `console.log / info / debug` in production builds. |

> **Note:** The code review (`docs/review/CODE_REVIEW.md`) records three HTTP mechanisms in the front end (raw `fetch` in about 30 services, axios interceptor, a separate axios instance for notifications), all covered by the shared refresh. Consolidating them on one API client is a maintainability improvement.
