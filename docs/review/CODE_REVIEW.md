# BrokerVerse: code standards, security and quality review (second pass)

Repository `/home/user/BDOI-OOTB`, branch `brokerverse-platform`, HEAD `c7eab87` (29 Sep 2026). Read-only review:
nothing in the repository was modified and nothing on ports 8000/5080 was touched. Scope: front end `brokerverse/`
(CRA + craco, 871 JS/JSX and 379 SCSS files) and backend `backend/` (Node 22 ESM, Express, pg, zod; 147 linted
JS files, 565 routes, 32 test files). Baseline: the front-end-only review of 28 Sep (`scratchpad/CODE_REVIEW.md`).
Paths are relative to `brokerverse/` or `backend/` as indicated.

How the numbers were produced (all under `scratchpad/review2/`):
- ESLint: `npx eslint src --ext .js,.jsx -f json` (front end, project `react-app` config) and `npx eslint src test`
  (backend, project flat config) -> `fe-eslint.json`, `be-eslint.json`.
- `npm audit --omit=dev --json` in both packages -> `fe-audit.json`, `be-audit.json` (network worked).
- Route authorization: `routes.mjs` loads every module router, walks the Express stacks and classifies each
  middleware (requireAuth / requirePermission / requireRole / ownRecord / zod validate) -> `routes.txt`.
- Test reach: `cov.mjs` checks, for each registered route path, whether any test file calls it -> `be-cov.txt`.
- Dead files, i18n and commented-code scripts from the baseline were re-run unchanged -> `fe-dead.txt`, `fe-i18n.txt`.
- Duplication: `jscpd@4` (min 10 lines / 80 tokens) -> `jscpd-be/`, `jscpd-fe/`.
- Two runtime probes against an in-process app instance (no database, no network port): `logprobe.mjs`
  (request log content) and `hdrprobe.mjs` (CSP and CORS headers).
- Backend tests were **not executed**: they reset the shared `brokerverse_test` database, which other agents may be
  using at the same time. Test counts below are static.

## Executive summary

Status vs baseline: **Fixed**, **Partly** (improved but not closed), **Open** (unchanged or worse), **New** (backend,
not in baseline scope).

| # | Area | Finding | Count | Severity | Status |
|---|------|---------|-------|----------|--------|
| 1 | Security / files | Any signed-in user can overwrite or delete any stored document (`PUT /s3/put/*`, `DELETE /s3/file/*`); no ownership or permission check | 2 routes | High | New |
| 2 | Security / files | Uploads keep the client-supplied content type, have no type allow-list and are served inline, without sign-in, from the same origin as the SPA; the API CSP (`script-src 'self'`) lets an uploaded HTML page load an uploaded script, which enables stored XSS and theft of the tokens in `localStorage` | 1 serving route, 7 upload handlers | High | New |
| 3 | Security / auth | Users created without a password get the fixed password `Welcome@1`; "must change password" and password expiry are only flags: the API does not enforce them and the front end never reads them | 1 default, 0 FE references | High | New |
| 4 | Security / config | `JWT_SECRET` falls back to `dev-only-secret-change-me` and `CORS_ORIGINS` to `*` (any origin reflected, verified); no production start-up guard | 2 | High (depends on deployment) | New |
| 5 | Security / logging | Every request log line contains the `Authorization: Bearer ...` header (pino-http default serializer, verified); report download tokens are logged in URLs | all requests | Medium | New |
| 6 | Security / sessions | Access tokens last 24 h and carry roles; `requireAuth` does not re-check the user, so deactivation and role changes take up to 24 h to apply. Password change/reset does not revoke refresh tokens | 4 code paths | Medium | New |
| 7 | Security / 2FA | The backend implements TOTP 2FA, but the front end has no challenge or enrolment screen (0 references to `twoFactorRequired`/`challengeToken`). TOTP secrets and reset codes are stored in plain text; older reset codes stay valid | 3 | Medium | New |
| 8 | Security / DoS | XLSX readers inflate without a size cap (zip bomb); uploads are held in memory (up to 20 x 25 MB per request); the only rate limits are in-memory, per process and on sign-in/reset | 2 inflaters, 7 multer configs | Medium | New |
| 9 | Input validation | 186 of 297 write routes have no schema (zod) middleware; they rely on hand-written checks in services | 186 | Medium | New |
| 10 | Authorization metadata | `registry.js` `auth`/`roles`/`permissions` fields are documentation only (not enforced); roles/permissions filled on 14 of 565 routes; 1 `auth` mismatch | 565 / 14 / 1 | Medium | New |
| 11 | Authorization coverage | 513 of 565 routes require a permission or role; 13 are public (all intended); 39 need only sign-in, and are acceptable except the 8 file-storage routes (items 1-2) and `GET /settings` / `GET /schedules` | 13 / 39 | Info (see 1) | New |
| 12 | SQL injection | No string-built SQL with request values found; dynamic identifiers are white-listed or quoted | 0 | - | New |
| 13 | Error handling | 500 responses return the raw internal error text (for example PostgreSQL messages) | 1 handler | Low | New |
| 14 | Dependencies (BE) | `npm audit`: 1 high (nodemailer, direct), 2 moderate (node-cron -> uuid) | 3 | Medium | New |
| 15 | Dependencies (FE) | `npm audit`: 3 critical, 35 high, 18 moderate, 15 low (71); axios and js-cookie now patched; remaining direct: react-scripts (high), react-router(-dom) and @craco/craco (moderate, major upgrades) | 71 (was 75) | High | Partly |
| 16 | FE roles | Undefined roles no longer get full access; routes are guarded by `isPathAllowed`; server enforces permissions | - | - | Fixed |
| 17 | FE token storage | Access and refresh tokens still in `localStorage`; no CSP on the SPA. Refresh-on-401 now exists; the unused login module still writes tokens and non-secure cookies | 2 writers | High (with item 2) | Partly |
| 18 | FE supply chain | `primeflex@latest` CDN link removed; bundled from npm | 0 | - | Fixed |
| 19 | FE logging | `console.*` 1,607 calls in 246 files (was 2,434 / 415); `console.log/info/debug` disabled in production builds; redux-logger development-only; 1 bearer-token log left | 1,607 | Low | Partly |
| 20 | FE mock data | 27 production files still import mock data (was 89) | 27 | Medium | Partly |
| 21 | FE hard-coded URLs | 11 external URLs (was 39); 5 of them in dead files | 11 | Low | Partly |
| 22 | Hard-coded business values | FE: `"PHP"` 11, `₱` 33 (outside mocks), IAR VAT fallback 12, `bankCode: "BDO"`. BE: all 165 setting keys are seeded and read via `getSetting` (good), but 5 keys have conflicting code fallbacks and the admin-role list is repeated 10 times | ~60 | Medium | Partly (FE) / New (BE) |
| 23 | Hard-coded colours | SCSS 6,943 hex literals in 360 files outside `src/theme` (was 7,458 / 366); JS/JSX 1,889 quoted hex literals in 379 files; 2,056 inline `style={{` | 8,832 | Medium (theming) | Open |
| 24 | ESLint (FE) | 0 errors (was 7), 2,016 warnings (was 2,490); `no-unused-vars` 1,683; real bugs left: 6 `no-dupe-keys`, 2 `no-unreachable`, 1 duplicate class member, 1 duplicate JSX prop, 1 self-assign | 2,016 | Medium | Partly |
| 25 | ESLint (BE) | 0 errors, 0 warnings on 147 files (strict rules incl. `no-console`, `eqeqeq`) | 0 | - | New (good) |
| 26 | Dead / duplicate code | FE: 31 never-imported JS/JSX files, 4,141 lines (was 85 / 10,176); 18 dead SCSS (was 27); 1 byte-identical group (was 13); jscpd 10.9 % duplicated lines. BE: 0 dead files, 0.04 % duplication | 31 / 18 | Low | Partly |
| 27 | Large files | FE: 43 files > 800 lines (was 60); `MainRoute.js` 1,935 lines, 305 imports, no lazy loading. BE: largest file 639 lines | 43 | Low | Partly |
| 28 | i18n | 84 keys used but missing from `en.json` (was 357); 82 have inline English defaults, 2 render raw keys. `th.json` lacks 468 `en` keys (was 101) | 84 / 468 | Low / Medium | Partly (th worse) |
| 29 | Tests | BE: 259 test cases in 32 files; 455 of 565 routes (81 %) are called by some test; no tests for file storage, notifications, token refresh, lockout. FE: 3 test files, 124 lines | 259 / 3 | Medium | Partly |
| 30 | Consistency | API: 3 list-pagination shapes, 6 success responses without the `success` envelope, 20 legacy verb-style paths. BE: `round2` defined 4x with two rounding rules; `today()` defined 6x, 4 of them in UTC instead of the configured time zone. FE: date helper used in 13 files vs 85 raw `toLocaleDateString` calls; 2 files import the wrong `formatDate` (from FullCalendar) | see section 4 | Medium | New / Open |
| 31 | XSS sinks (FE) | No `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML=`; all 29 `window.open` calls now pass `noopener` | 0 | - | Fixed |

---

## 1. Security

### 1.1 Authentication (backend `src/lib/auth.js`, `src/modules/auth/router.js`)

What is in place and works as designed: bcrypt password hashes; per-IP and per-username sliding-window rate limit on
sign-in, 2FA code, forgot and reset password (`lib/rateLimit.js`, limits from `security.login_rate_limit`); account
lockout after `limits.max_login_attempts` (`auth/router.js:77-78`); refresh tokens stored by `jti` and rotated on use
(`auth/router.js:133-138`); password policy with history and maximum age (`lib/password.js`); TOTP with replay
protection (`totp_last_step`); forced 2FA enrolment for configured roles using a restricted token (`lib/auth.js:33,44`);
the first administrator password comes from `ADMIN_PASSWORD` (`db/seed.js:58`), otherwise a random one is generated.

Findings:

1. **Default password for new users (High).** `modules/users/router.js:126`
   `bcrypt.hash(b.password || 'Welcome@1', 10)`. `must_change_password` is set (`:130`) but nothing enforces it:
   `requireAuth` (`lib/auth.js:36-49`) issues full access, and the front end has **no** reference to
   `mustChangePassword` or `passwordExpired` (`grep -ri mustchange brokerverse/src` -> 0). Anyone who learns a new
   username can sign in with `Welcome@1` until the user changes it. Password maximum age (`security.password_max_age_days`)
   is likewise only a flag in the login response (`auth/router.js:35-38`). The seeded administrator is not flagged
   to change its password (`db/migrations/0001_core.sql:34` default false).
   Fix: require a password (or generate a random one and e-mail it); when the flag is set, issue a restricted token
   (same mechanism as `enrol2fa`) that only reaches `/auth/change-password`, and add the change-password step to the
   front-end login.
2. **Weak production defaults (High, depends on deployment).** `src/config.js:12`
   `jwtSecret: env('JWT_SECRET', 'dev-only-secret-change-me')`; `config.js:15` `CORS_ORIGINS` defaults to `*`, which
   `app.js:47` turns into `origin: true` (reflects any origin; verified with `hdrprobe.mjs`: `Origin: https://evil.example`
   -> `Access-Control-Allow-Origin: https://evil.example`). `docker-compose.yml:21` requires `JWT_SECRET` and
   `render.yaml:21` generates one, but `npm start` / the Dockerfile alone do not; a forgotten variable means anyone can
   mint an `it-admin` token. The same secret signs access, refresh, 2FA-challenge, quote-approval and report-download
   tokens (`lib/auth.js:7-11`, `auth/router.js:84`, `quotations/service.js:130`, `reports/service.js:80`); they are
   separated only by a claim. Fix: refuse to start when `NODE_ENV=production` and the secret is missing, the default,
   or shorter than 32 bytes, or when CORS is `*`.
3. **Revocation gaps (Medium).**
   - Access token TTL defaults to 24 h (`config.js:13`) and embeds roles and permissions (`lib/auth.js:8`);
     `requireAuth` never reloads the user, so a deactivated, locked or re-roled user keeps access until expiry.
   - Refresh tokens (30 days, `config.js:14`) are revoked on status change (`users/router.js:169`) but not on
     own password change (`auth/router.js:184`), reset (`:237`), administrator reset (`users/router.js:175-183`) or
     `DELETE /users/:id` (`users/router.js:186-193`). A stolen refresh token survives a password reset.
   - Refresh rotation has no reuse detection (a replayed, already-rotated token is simply refused; the attacker's
     newer token stays valid).
   Fix: shorter access TTL (15 min) or a per-user `token_version` checked in `requireAuth`; revoke all refresh tokens
   on any password or status change.
4. **2FA and reset secrets (Medium).** TOTP secrets are stored in plain text (`db/migrations/0060_security.sql:24`);
   reset codes are stored in plain text (`auth/router.js:216`), and the lookup matches any unexpired unused code
   (`auth/router.js:233`), so earlier codes stay valid after a new one is requested. `/auth/2fa/enable` and
   `/auth/2fa/disable` code checks are not rate limited (`auth/router.js:277,293`). The 2FA flow is **not implemented in
   the front end**: `authService.login` calls `setTokens(data)` unconditionally (`brokerverse/src/services/authService.js`
   around line 68), so a 2FA-enabled user cannot complete sign-in and a user in `security.require_2fa_roles` lands in the
   app with a token that is refused everywhere. Fix: hash reset codes and invalidate earlier ones; encrypt TOTP
   secrets with a key from the environment; rate-limit the enable/disable checks; add the challenge and enrolment
   screens before enabling `require_2fa_roles`.
5. **Enumeration (Low).** Locked and inactive accounts get distinct messages before the password is checked
   (`auth/router.js:73-74`), and the unknown-user path skips bcrypt (timing difference). Return one generic message.
6. JWT verification does not pin `algorithms` (`lib/auth.js:12`); jsonwebtoken 9 refuses `none` and asymmetric keys
   with a string secret, so this is informational. Pin `['HS256']`.

### 1.2 Authorization on every route

`routes.mjs` result (565 routes, no router-level middleware anywhere; every route lists its own middleware):

| Class | Routes |
|-------|--------|
| requireAuth + requirePermission or requireRole | 513 |
| requireAuth only | 39 |
| No requireAuth | 13 |
| With record-level `ownRecord` scoping | 65 |

Routes with **no** auth middleware (all intended, but note the comments):
`GET /version` (reveals Node version, environment and database error code: `modules/system/router.js:14-33`, Low),
`POST /auth/login`, `/auth/login/2fa`, `/auth/refresh`, `/auth/logout`, `GET /auth/password-policy`,
`POST /auth/forgot-password`, `/auth/reset-password`, `POST /quotations/approve-by-customer` (signed token),
`GET /reports/generated/:id/download` (signed token or optional bearer, `reports/router.js:12,51-60`),
`GET /settings/public` (branding and general groups only), `GET /system-settings/`, and
`GET /s3/object/*` (see 1.4).

Routes with sign-in only (39): own profile, password, 2FA and login history (8, correct); notifications (8, all
filter on `user_id`, correct); open-items events (3, filter on `user_id`, correct); addresses (5), search (1, scoped),
roles list (2): acceptable. Needing a permission: **8 file-storage routes** (1.4), `GET /settings/` (every setting
to every user, `settings/router.js:12`), `GET /schedules/` and `/schedules/:code/runs` (job list and run output,
`schedules/router.js:15,20`).

Route metadata (`src/lib/registry.js:14-24`): `define()` records `auth` (default true), `roles` and `permissions`
for the generated OpenAPI/Postman/Excel exports but does **not** apply them; protection depends on each route
remembering `requireAuth`. `roles` is filled on 2 routes and `permissions` on 12 of 565, so the generated documentation
shows no permission for 551 routes. One real mismatch: `GET /reports/generated/:id/download` is declared `auth: true`
but uses `optionalAuth`. The 6 regex file routes are pushed to `ROUTES` by hand (`uploads/router.js:94-101`).
Fix: make `define()` insert `requireAuth` unless `auth: false`, derive `permissions` from `canRead`/`canWrite`, and add
one test that calls every non-public route without a token (expects 401) and with a no-role user (expects 403).

### 1.3 Input validation and SQL injection

- 297 write routes (POST/PUT/PATCH/DELETE); 111 have a zod `validate(...)` middleware; **186 do not** and rely on
  hand-written checks in services (for example `remittance/service.js:198-207`, `reinsurance/service.js:168-176`).
  Largest groups without schema: Remittance (46), Product Configurator (42), Reinsurance (22), Incentive (10). List in
  `routes.txt`.
- SQL: all values are bound parameters. Dynamic SQL uses white-listed sort columns (`collections/service.js:73-75`,
  `renewals/batches.js:100-103`), definition-driven field names validated by regex (`masters/service.js:56-70`) and
  quoted identifiers (`q()`), or column maps (`FIELD_MAP`, `EDITABLE`, `HEADER_FIELDS`). No injection found.
- `express.json({ limit: '10mb' })` (`app.js:48`) is generous for a JSON API; 1 MB would do except for bulk endpoints.

### 1.4 File upload handling (`src/modules/uploads/`)

1. **Missing access control (High).** `PUT /s3/put/*` (`uploads/router.js:50-57`) only checks that the key exists, so
   any signed-in user can overwrite any document (policy PDFs, IDs, claim photos). `DELETE /s3/file/*`
   (`:70-79`) deletes any document. Neither checks the uploader, the linked entity or a permission.
2. **Stored XSS via uploads (High).** `storeFile` saves `file.mimetype` from the client (`storage.js:36-38`); there
   is no extension or type allow-list in any of the 7 multer configurations; `GET /s3/object/*` serves the file
   `inline` with that content type and **without sign-in** (`uploads/router.js:81-90`). In the Docker/nginx
   deployment `/api/` is proxied on the same origin as the SPA (`brokerverse/nginx.conf:11-16`). Helmet's CSP on API
   responses is `script-src 'self'` (verified), which blocks inline script but allows
   `<script src="/api/s3/object/...">`, i.e. a second uploaded file. Result: an agent uploads an HTML page and a
   script, sends the link to an administrator, and the script reads the access and refresh tokens from
   `localStorage`.
3. **Public, non-expiring URLs (Medium).** "Presigned" URLs are the plain public URL
   (`uploads/router.js:46,64,67`); keys contain a millisecond timestamp plus 4 random bytes
   (`storage.js:21`), i.e. 32 bits of randomness, and never expire. KYC documents and ID photos are reachable by anyone
   holding a link.
4. Upload limits are hard-coded and memory-resident: 25 MB x 20 files (`uploads/router.js:16`), 25 MB x 5
   (`claims/router.js:17`), 50 MB (`remittance/router.js:18`), 20 MB (`system-settings/router.js:16`), 10 MB
   (`disbursements/router.js:19`, `receipts/router.js:23`, `documents/tabular.js:9`).
5. **Zip bomb (Medium).** The XLSX readers call `zlib.inflateRawSync` without `maxOutputLength`
   (`accounting/lib/sheet.js:19`, `documents/xlsx.js:34`); a 10 MB upload can expand to gigabytes and stop the process.

Fix (in order): permission and ownership checks on PUT/DELETE; content-type allow-list checked against the file
signature; serve `/s3/object` with `Content-Disposition: attachment` for anything that is not an image or PDF, plus
`Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`; require sign-in or a signed, expiring URL;
`maxOutputLength` on inflate.

### 1.5 Secrets and credentials in the repository

- `git grep` for passwords, tokens, keys, AWS/GitHub/Slack key formats and PEM headers: **no live secrets** in
  tracked source. The administrator password comes from `ADMIN_PASSWORD` (`db/seed.js:58`; required by
  `docker-compose.yml:22`, `sync: false` in `render.yaml:24`). The only literal test password is
  `vitest.config.js:7` (`ADMIN_PASSWORD: 'Test-Admin#2026'`, test database only; acceptable).
- `backend/.env` and `brokerverse/.env` are git-ignored; `backend/.env.example` holds placeholders only.
- The front-end demo credential file (`services/mockData/authMockData.js`) is gone from `src`, but three tracked
  archives at the repository root (`brokerverse-dev.zip` 17.8 MB, `brokerverse-main.zip` 17.7 MB,
  `brokerverse-be-main.zip`) contain the old source **including `authMockData.js` (demo usernames and passwords) and
  `.env` files** pointing at `https://brokerverse-api-dev.inxtuniverse...`. No keys, but they should not be in the
  repository. Fix: delete the archives (history rewrite only if the demo passwords were ever real).
- When `ADMIN_PASSWORD` is unset the generated password is written to the application log (`db/seed.js:63`,
  via `server.js:11`). Acceptable as a one-off, but it ends up in the log store; prefer printing to stderr only on an
  interactive TTY.

### 1.6 CORS, helmet, rate limiting

- helmet 8 on every API response with its default CSP (`app.js:46`); `x-powered-by` disabled; `trust proxy 1`.
- CORS: see 1.1 item 2. `credentials` is not enabled, and tokens travel in the `Authorization` header, so the
  practical exposure of the wildcard is limited, but it should still be an explicit allow-list in production.
- The SPA itself has **no CSP**: none in `public/index.html`, none in `nginx.conf` (which does set nosniff,
  X-Frame-Options and Referrer-Policy).
- Rate limiting: in-memory, per process (`lib/rateLimit.js:7`), only on sign-in, 2FA, forgot and reset. Nothing on
  the public quote-approval or report-download endpoints, on e-mail sending, or globally. With more than one API
  instance the limits multiply. Fix: move to a shared store (PostgreSQL table or Redis) and add a coarse global limit.

### 1.7 Logging of sensitive data

- **Backend (Medium):** `pino()` has no `redact` (`app.js:13`) and pino-http's default request serializer logs all
  headers (`app.js:49`). Verified with `logprobe.mjs`: the log line contains `"authorization":"Bearer SECRET-TOKEN-PROBE"`.
  Every signed-in request therefore writes a 24-hour bearer token to the logs, and report download links log their
  `?token=`. Fix: `redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]']` and a
  custom `req` serializer that strips `token` from the query string.
- Backend otherwise clean: `no-console` is an ESLint error outside CLI scripts; the audit log strips the password on
  user create (`users/router.js:136`).
- **Front end:** 1,607 `console.*` calls (1,139 `log`, 433 `error`, 34 `warn`, 1 `debug`) in 246 files.
  `src/utility/productionConsole.js` (imported first in `src/index.js:1`) turns `log/info/debug` into no-ops in
  production builds, and redux-logger is development-only (`src/redux/store.js:22`). Remaining: `services/quotationService.js:20`
  logs `authService.getAuthHeader()` (development only now); form-value dumps such as
  `agentModule/EmployeeFlow/EmployeeCreationCard.js:63` and `claimsModule/claimDetails/claimDetailsCard/index.js:493`
  (development only); the 433 `console.error` calls still run in production and some print whole API responses.

### 1.8 Front-end token storage and authorization (baseline 2.1-2.3)

- **Still open:** access token, refresh token, user, roles and permissions are in `localStorage`
  (`services/authService.js:99-132`, `utility/sessionRefresh.js:28-29`). Combined with item 1.4.2 this is the main
  XSS exposure. Moving the refresh token to an httpOnly, SameSite cookie needs a backend change (L).
- **Improved:** refresh on 401 now exists: `utility/sessionRefresh.js` wraps `window.fetch` and the axios interceptor
  (`utility/interceptor.js:44`) with one shared refresh.
- **Still open:** the unused login `module/AuthModule/Login/index.jsx` (imported by `routes/MainRoute.js:209`, use
  commented out at `:358`) still writes `ACCESS_TOKEN`/`REFRESH_TOKEN` and non-secure cookies (`:65-90`);
  `authService.getAuthHeader` is still declared twice (`services/authService.js:195,271`); three HTTP mechanisms
  remain (30 services use raw `fetch`, `notificationService.js:9` has its own axios instance, `interceptor.js:7`).
- **Fixed:** role gating is now deny-by-default (`utils/menuPermissions.js:1-11,93-97`); `routes/ProtectedRoute/index.js:182-184`
  guards every path with `isPathAllowed`; the backend enforces permissions server-side. Residual: grants are keyed on
  menu display names (renaming a menu label changes access), and paths not listed in any menu are allowed by default
  (`menuPermissions.js:218`), acceptable only because the API enforces permissions.

### 1.9 Dependencies

`npm audit --omit=dev` ran successfully in both packages.

| Package | Critical | High | Moderate | Low | Total | Direct packages flagged |
|---------|---------:|-----:|---------:|----:|------:|-------------------------|
| backend (141 prod deps) | 0 | 1 | 2 | 0 | 3 | nodemailer 6.10.1 (high: 13 advisories incl. SMTP command injection, recipient-domain bypass; fix 10.x, major), node-cron 3.0.3 (moderate via uuid; fix 4.x, major) |
| front end (1,622 prod deps) | 3 | 35 | 18 | 15 | 71 (was 75) | react-scripts 5.0.1 (high, no fix except leaving CRA), react-router / react-router-dom 6.30 (moderate, fix is v7), @craco/craco (moderate) |

Front-end criticals are all build-time transitive (`form-data`, `shell-quote`, `websocket-driver` via react-scripts).
axios (1.20) and js-cookie (3.0.8) are now on patched versions; `flatted` and `caniuse-lite` were removed.

Pinning: both packages use caret ranges with committed `package-lock.json` and `npm ci` in the Dockerfiles, which is
adequate. Minor: the front end lists four `@testing-library/*` packages under `dependencies` (they inflate the
production audit); `backend/package.json` `engines` says `>=20` while the image is Node 22.

### 1.10 XSS sinks

- Front end: 0 `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML =`, `document.write`. All 29
  `window.open` calls pass `noopener,noreferrer`; the one `target="_blank"` anchor has `rel` (fixed since baseline).
  `i18n.js:22` still has `escapeValue: false` (safe while nothing renders HTML).
- Backend HTML: e-mail templates escape variables (`documents/common.js:23`). Two unescaped paths: `POST /email/send`
  accepts arbitrary `html` to any address (`quotations/email.js:46-51`, permission-gated), and collections follow-up
  sends `content` as HTML (`collections/service.js:133`). Low: this is a phishing channel from the company's own
  sender address rather than XSS.

---

## 2. Hard-coding

### 2.1 Backend (new)

Good practice overall: 233 `getSetting()` calls read 165 distinct keys, and every key is seeded (`db/seeds/settings.json`
plus SQL seeds). Deployment values come from the environment (`config.js`). Remaining issues:

- Code fallbacks duplicate the seeded values, and 5 keys have **different** fallbacks in different places:
  `commission.default_rate` (0.15 vs 0), `tax.withholding_rate` (0.05 vs 0), `general.company_name`
  (`'BrokerVerse'` vs `''`), `renewals.notice_subject`, `renewals.notice_template`. If a row is ever missing, the
  behaviour depends on which module reads it. Fix: one default table (the seed) and `getSetting` throwing on a missing key.
- Admin-role list `['it-admin', 'ba']` repeated in 10 places (`lib/auth.js:51`, `reports/service.js:25`,
  `reports/router.js:53`, `search/router.js:14`, `dashboard/router.js:9`, `incentive/router.js:23`,
  `policies/payments.js:20`, `remittance/service.js:360`, `users/router.js:18`, `settings/router.js:26`).
  `payments/service.js:8` hard-codes a list of five roles and `schedules/router.js:11` a list of three.
- Magic numbers: reset-code lifetime 15 min (`auth/router.js:216`), enrolment token 900 s (`auth/router.js:94`),
  bcrypt cost 10 (`lib/password.js:61`, `users/router.js:126`, `db/seed.js:59`), page-size cap 500
  (`lib/respond.js:8`), report file cap 50,000 rows (`reports/engine.js:147`), `86400000` in 14 places, and the 7 upload
  size limits listed in 1.4.
- Literal fallbacks that bypass settings: `policy.currency || 'PHP'` (`receipts/receivables.js:58`);
  `general.frontend_url` default `http://localhost:3000` (`quotations/service.js:145`); `PUBLIC_BASE_URL` default
  `http://localhost:8000` (`config.js:17`), which produces broken file links if unset in production;
  `timezone: 'Asia/Manila'` injected on create (`remittance/router.js:491`).

### 2.2 Front end (baseline 1.1-1.5)

- Currency: `"PHP"` literal 11 times in 10 files (was 119), e.g. `module/SystemSettings/index.js`,
  `module/FinanceMastersModule/ExchangeRateMaster/SaveAndEditExchange/index.jsx`. `₱` 33 times in 10 non-mock files,
  e.g. `agentModule/policyModule/BatchRenewal/BatchTable.jsx:751,769,1005,1020`,
  `agentModule/quoteModule/quoteListing/quoteListingCard/store/quoteReducer.js:15`. Partly fixed.
- VAT: `IAR_VAT_PERCENT = 12` (`agentModule/leadModule/IarLeadCreation/iarConstants.js:5`), now only a fallback
  (`:125`); the other baseline VAT literals are gone. `bankCode: "BDO"` still at
  `agentModule/endorsementModule/paymentConfirmation/index.js:377`.
- Literal ids in `routes/apiRoutes.js` removed (fixed); misspelled keys (`VECHI*`, `ENDROSEMENT*`) remain (21).
- Branding: `/BDO_insure_logo.png.png` in 12 places (mostly the unused `module/AuthModule/*` pages and the
  `utility/systemCurrencies.js:73,79` presets); `public/index.html` (10 lines) and `public/manifest.json:2-3` still say
  "INXT Broker Suite". Needs a product decision.
- External hosts (11, was 39): SalesVerse S3 template bucket (`module/PaymentVoucher/BulkUploadModal/index.jsx:31`,
  `module/Receipts/BulkUploadModal/index.jsx:141`), i.ibb.co (`agentModule/renewalModule/WaitingScreen/PolicyRenewalWaiting.jsx:74`,
  `components/Header/mock.js:3`), tiiny.site x4 in the dead `components/Client/index.jsx:34-55`, plus Gmail, wa.me and
  PrimeFaces links. Templates should come from the API.
- No `brokerverse/.env.example`; README does not mention `REACT_APP_BASE_URL` (still open).

### 2.3 Hard-coded colours (Open)

- SCSS: 6,943 hex literals in 360 files outside `src/theme` (was 7,458 in 366). Top literals unchanged:
  `#111927` (959), `#0072d8` (759), `#ffffff` (497), `#d1d5db` (434), `#b1b1b1` (201). 54 SCSS files import the
  colour/token files.
- JS/JSX: 1,889 quoted hex literals in 379 files; 2,056 inline `style={{` blocks. Top files:
  `module/FinanceMastersModule/PremiumAccountSetup/index.js` (59), `MiscellaneousAccountSetup/index.js` (57),
  `RIClaimsAccountSetup/index.js` (53), `CustomerAccountSetup/index.js` (51),
  `module/PettyCashManagement/Disbursement/AddDisbursementTable/index.js` (31). (The baseline JS figure used a
  different pattern and is not directly comparable; the direction is not improving.)

### 2.4 Mock data in production paths (baseline 1.6)

27 production files still import mock modules (was 89); `services/mockData/` is now empty. Most are dropdown option
lists (`quoteModule/orderSummary/index.js:15`, `coverageDetails/coverageDetailsCard/index.js:14`,
`quoteModule/customerInfo/index.js:20`). Screens still rendering mock rows: `module/PaymentVoucher/PayAll/index.js:10,17`,
`module/Receipts/AddPolicyReceipts/index.jsx:14,226`, `module/FinanceMastersModule/BankMaster/AccountDataView/*` (4 files),
`BankAccountMaster/index.js:14`, `BankChequeMaster/index.js:14`, `CompanyMaster/CompanyMasterTable/index.js:2`,
`AccountCategoryMaster/CategoryMasterInitial/index.js:14`; `agentModule/paymentsModule/index.js:9`. Odd:
`agentModule/leadModule/leadCreation/mock.js:1` imports itself.

---

## 3. Code quality

### 3.1 ESLint

Front end (871 files, 341 with issues): **0 errors** (was 7), **2,016 warnings** (was 2,490).

| Rule | Count | Files | Baseline |
|------|------:|------:|---------:|
| no-unused-vars | 1,683 | 299 | 2,040 |
| react-hooks/exhaustive-deps | 170 | 136 | 202 |
| eqeqeq | 130 | 29 | 168 |
| no-dupe-keys | 6 | 5 | 34 |
| no-lone-blocks | 5 | 4 | 17 |
| jsx-a11y/anchor-is-valid | 5 | 5 | } 11 |
| jsx-a11y/alt-text | 3 | 2 | } |
| import/no-anonymous-default-export | 5 | 5 | 7 |
| no-unreachable | 2 | 2 | 2 |
| no-sparse-arrays | 2 | 2 | - |
| no-dupe-class-members, react/jsx-no-duplicate-props, no-self-assign, no-sequences, default-case | 1 each | | |

Warnings that are real defects: `no-dupe-keys` at `agentModule/dashBoardModule/agentViewProfile/agentProfileCard/index.js:101`,
`agentModule/quoteModule/orderSummary/index.js:114` (`discount`), `module/FinanceMastersModule/TransactionCodeMaster/store/transactionMasterReducer.js:40`,
`module/GeneralMasters/UserManagementMasters/User/EditUser/UserGroupAccessTable/index.js:47-48`,
`User/UserMaster/index.js:103`; `react/jsx-no-duplicate-props` `agentModule/policyModule/policyTable/index.jsx:627`;
`no-self-assign` `module/PaymentVoucher/store/paymentVoucherReducer.js:293`; `no-dupe-class-members`
`services/authService.js:271`; `no-unreachable` `quoteModule/customerInfo/store/infoMiddleWare.js:31`,
`quoteModule/uploadPolicy/store/uploadPolicyMiddleWare.js:33`. Worst files: `GeneralMasters/OrganizationMasters/BranchMaster/AddBranch/index.js`
(53), `ComapanyMaster/AddCompany/index.js` (43), `InsuranceCompany/InsuranceDetailsAction/index.jsx` (37). 56
`eslint-disable` comments (47 for exhaustive-deps).

Backend (147 files): **0 errors, 0 warnings** with `no-console`, `eqeqeq`, `prefer-const`, `no-unused-vars` as errors.
2 justified `no-control-regex` disables (`documents/xlsx.js:70`, `tools/xlsx.js:23`).

### 3.2 Dead and duplicated code

- Front end: 31 never-imported JS/JSX files, 4,141 lines (was 85 / 10,176), e.g. `components/Client/index.jsx`,
  `module/FinanceMastersModule/SubAccountMaster/index.js` (512), `MainAccountMaster/*` (5 files), `utility/receiptHelper.js`,
  `routes/UnProtectedRoutes.js`, `module/ProductConfigurator/RiskMapping/*`; 18 never-imported SCSS (was 27). Full list:
  `fe-dead.txt`. Effectively dead but still imported: `module/AuthModule/Login` (`MainRoute.js:209`) and
  `components/AgentSideBar` (`MainRoute.js:201`, never rendered). The two dead sidebars from the baseline are gone.
- Byte-identical file groups: 1 (was 13): the `BankMaster/AccountDataView/*/mock.js` triple.
- jscpd: 624 clones, 21,008 duplicated lines of 192,806 (10.9 %). Largest: `LocationMasters/CityMaster/index.js:279`
  = `StateMaster/index.js:268` (303 lines), `CountryMaster` = `StateMaster` (288), `MiscellaneousAccountSetup` =
  `PremiumAccountSetup` (175), `Commission/AddCommission` = `EditCommission` (171), `CustomerAccountSetup` =
  `RIClaimsAccountSetup` (164 and 156).
- Still duplicated domains: `services/disbursementService.js` (791 lines) and `disbursementsService.js` (84);
  `authService` and `tokenManager`; `agentModule/claimModule` vs `claimsModule`, `quotationModule` vs `quoteModule`.
- Backend: no unimported modules; jscpd 1 clone (bulk-upload loop, `disbursements/router.js:70` = `receipts/router.js:88`),
  0.04 %. Small helper duplication: `round2` 4 copies with two rounding rules (`accounting/lib/http.js:6` and
  `documents/common.js:39` add `Number.EPSILON`; `claims/util.js:21` and `masters/helpers.js:23` do not), which can
  differ by one centavo on `x.xx5` amounts; `isoDate` 2 copies; two XLSX readers (`accounting/lib/sheet.js`,
  `documents/xlsx.js`).

### 3.3 Large files

Front end: 43 JS/JSX files over 800 lines (was 60): `agentModule/policyModule/PolicyDetailView/index.jsx` 2,273,
`leadModule/leadCreation/mock.js` 2,067, `EmployeeFlow/mockdata.js` 2,066, `module/ProductConfigurator/ProductConfiguratorScreens.js`
1,974 (grew from 1,535), `routes/MainRoute.js` 1,935 (408 `<Route>`, 305 imports, no `React.lazy`), `FireLeadCreationCard.js`
1,873, `IarLeadCreationCard.js` 1,711. Backend: largest `remittance/items.js` 639 lines; all files are a reasonable size.

### 3.4 Error handling

- Backend: one error envelope (`lib/errors.js:15-23`), `wrap()` forwards async errors, request id in every error
  body. But for status 500 the raw `err.message` is returned (`errors.js:17`), exposing PostgreSQL messages
  (constraint, column and table names). Return a generic message for 5xx and keep the detail in the log.
  Multer errors (file too large) have no `status` and surface as 500 on routes that do not wrap them.
- Swallowed errors: `renewals/queue.js:81` `processQueue().catch(() => {})`, `documents/router.js:44`
  `catch { lines = []; }` (a receipt PDF silently prints without lines), `policies/service.js:204` (import failure
  hidden). The other 35 catch blocks rethrow, record the failure or map a known error code. Good.
- Front end: 433 `console.error` catch handlers that only log; no central error reporting.

### 3.5 i18n

- 84 keys used in `src` are missing from `en.json` (was 357). 82 pass an inline English default (`t("key", "Text")`),
  so they display English in every language; 2 render the raw key:
  `module/FinanceMastersModule/AccountCategoryMaster/TableData/index.jsx:145,152` (`financeMasters.categoryCodeHeader`,
  `categoryNameHeader`). By file: `module/Reinsurance/ReinsuranceScreens.js` 21, `ProductConfiguratorScreens.js` 13,
  `endorsementModule/personalDetails/SplitScreens/CoverageChange.jsx` 10, `claimsModule/settlementDetails/index.js` 7.
- `th.json` is missing 468 of 5,210 `en` keys (was 101 of 4,798): new screens are English-only in Thai.
- 15 dynamic `t(\`...${}\`)` keys are not checked.

### 3.6 Tests

- Backend: 32 test files, 259 test cases, 4,779 lines (vitest + supertest against a real PostgreSQL). Tests cover
  sign-in rate limits, password policy, TOTP, forced enrolment, record-level scoping and the user-access admin role.
  Route reach (a test calls the path): 455 of 565 (81 %). Gaps: Files (S3 API) 0/10, Notifications 0/8,
  Product Configurator 26/72, Billing statements 2/4, User Management 10/16, Auth 10/15. No test for token refresh
  rotation, lockout after `limits.max_login_attempts`, refresh revocation, or "every protected route rejects an
  anonymous caller". No coverage tool configured (`@vitest/coverage-v8` absent). Tests were not run in this review.
- Front end: 3 test files, 124 lines (`App.test.js`, `services/__tests__/leadService.test.js`,
  `utils/menuPermissions.test.js`) for 871 source files. The new menu-permission test is a good start.

### 3.7 Structure and naming (baseline 3.6)

Misspelled directories still present (9 of the 11 checked, e.g. `ResetPassward`, `ComapanyMaster`, `coverageDetailedVew`);
`package.json` name is still `finance_module`; root clutter unchanged (`Insurance_Broker_Features (1).xlsx`,
`dev_oct_dec_2025FE.txt`, `features.csv`, `generate-icons.bat`, `jsons/`, `public/clear-pwa-cache.js`, `public/temp-logo/`).

---

## 4. Consistency

### 4.1 API response shapes (backend)

- Helpers: `ok()` 264 uses, `created()` 57, `sendList()` 21, direct `res.json` 85. 6 success responses have no
  `success` field: `POST /auth/login`, `/auth/login/2fa`, `/auth/refresh` (`auth/router.js:96,121,138`),
  `/auth/2fa/enable` in the forced-enrolment case, `GET /version`, and the accounting list helper
  (`accounting/lib/http.js:27`).
- Three pagination shapes: flat `{ data, total, page, perPage, totalPages }` (`sendList`, `pageMeta`); nested
  `pagination: { page, pageSize, total/totalCount/totalRecords, ... }` (`users/router.js:64`, `clients/router.js:31`,
  `accounting/lib/http.js:29`, `renewals/router.js:28`); and `data: { claims, pagination }` (`claims/router.js:138`).
  These mirror legacy front-end contracts; document them, and make new endpoints use `sendList`.
- Some responses repeat the payload at the top level and in `data` (`uploads/router.js:26`,
  `quotations/router.js:114`).
- Paths: 20 legacy verb-style routes (`/lead/get-all-lead`, `/master/vehicle/get-brands`,
  `/endorsements/get-All-Endorsements`, `/claims/updatestatus/:id`, ...) and 7 with camel-case segments
  (`/receipts/printReceipt`, `/disbursements/printDisbursement`, `/biCoverage/...`), kept for front-end compatibility.
  Newer modules use REST nouns consistently.

### 4.2 Dates and numbers

- Backend business dates: `today()` is defined 6 ways. `claims/util.js:33` and `reports/engine.js:79` use the configured
  `general.timezone` (Asia/Manila); `incentive/service.js:11`, `reinsurance/service.js:12`, `accounting/lib/http.js:20`
  and `remittance/service.js:412` use the UTC date. Between 00:00 and 08:00 Manila time these produce yesterday's
  date for postings, due dates and settlements. 55 `toISOString().slice(0, 10)` calls in 24 files, e.g.
  `quotations/service.js:55` (`valid_until`). Fix: one `businessDate()` helper in `lib/` using the setting.
- Front end: `utility/dateFormat.js` (`formatDate`, configured format) is imported by 13 files, while 85
  `toLocaleDateString` calls in 44 files and 56 `toLocaleString` calls in 31 files format dates and amounts directly,
  38 of them with a hard-coded `"en-US"` locale (e.g. `agentModule/policyModule/BatchRenewal/BatchTable.jsx:260`,
  `agentModule/claimModule/claimDetail/index.js:57`, `agentModule/collectionsModule/CollectionDetail/index.jsx:63`,
  `agentModule/paymentsModule/store/paymentMiddleware.js:15`). Two files import `formatDate` from
  `@fullcalendar/core` instead of the app helper (`endorsementModule/personalDetails/endorsementSummary/EndorsementSummary.jsx:19`,
  `collectionsModule/FollowUpModal/index.jsx:10`), which ignores the configured format.
- Amounts: `formatCurrency`/`useFormatCurrency` used in 87 files; 105 `toFixed(2)` in 35 files and the `₱` literals
  bypass the display-currency setting.

---

## 5. Prioritised remediation

| # | Action | Findings | Effort |
|---|--------|----------|--------|
| 1 | File storage: permission + ownership check on `PUT /s3/put/*` and `DELETE /s3/file/*`; content-type allow-list verified against file signature; serve `/s3/object` as attachment (images/PDF excepted) with `CSP: sandbox` and nosniff; require sign-in or signed expiring URLs | 1, 2 | M |
| 2 | Remove the `Welcome@1` default; enforce must-change-password and password expiry with a restricted token; add the change-password step to the front-end sign-in | 3 | M |
| 3 | Production start-up guard: refuse to start without a strong `JWT_SECRET`, with `CORS_ORIGINS=*`, or with a localhost `PUBLIC_BASE_URL`; pin `algorithms: ['HS256']` | 4 | S |
| 4 | Redact `authorization`/`cookie` headers and `token` query parameters in pino | 5 | S |
| 5 | Session revocation: per-user token version (or 15-minute access tokens); revoke refresh tokens on password change, reset, admin reset and deactivation; refresh-token reuse detection | 6 | M |
| 6 | Make `define()` authoritative (auto `requireAuth` unless `auth:false`, record permissions from middleware) and add a test that every non-public route returns 401 anonymously and 403 for a no-role user; add permissions to `GET /settings` and `GET /schedules` | 10, 11 | S-M |
| 7 | Cap XLSX inflate (`maxOutputLength`), lower upload limits, move rate limiting to a shared store and add a global limit; include 2FA enable/disable and public token endpoints | 8 | S |
| 8 | Upgrade nodemailer (10.x) and node-cron (4.x) and re-run the e-mail and scheduler tests; front end: remove the dead login module (token/cookie writer) and duplicate `getAuthHeader`; plan react-router 7 | 14, 15, 17 | S (BE), M (FE) |
| 9 | 2FA end to end: front-end challenge and enrolment screens; hash reset codes and invalidate older ones; encrypt TOTP secrets | 7 | M |
| 10 | Generic message for 5xx responses; one `businessDate()` and one `round2` in `lib/`, replacing the 6 `today()` and 4 `round2` copies | 13, 30 | S |
| 11 | zod schemas for the 186 unvalidated write routes, finance first (Remittance 46, Product Configurator 42, Reinsurance 22) | 9 | L |
| 12 | Front end: CSP header in `nginx.conf`; plan moving the refresh token to an httpOnly SameSite cookie (backend change) | 17 | S / L |
| 13 | Delete the three tracked `*.zip` archives (old source with demo credentials and `.env`) and the 31 dead JS files / 18 dead SCSS files | 26, 1.5 | S |
| 14 | Fix the 11 defect-class ESLint warnings (duplicate keys/props/members, unreachable, self-assign), then `--fix` `no-unused-vars` and `eqeqeq` | 24 | S |
| 15 | i18n: add the 2 raw keys and the 82 defaulted keys to `en.json`; send 468 keys for Thai translation | 28 | S (en) / M (th) |
| 16 | Replace remaining mock-backed screens (PayAll, AddPolicyReceipts, BankMaster account views, bank/cheque masters) with API data or hide them | 20 | M |
| 17 | Route all date/amount formatting through `formatDate`/`formatCurrency`; fix the two FullCalendar `formatDate` imports; remove `₱`/`"en-US"` literals | 22, 30 | M |
| 18 | Tests: file storage, notifications, token refresh/revocation, lockout; add `@vitest/coverage-v8`; front-end tests for auth flows | 29 | M |
| 19 | Lazy-load routes in `MainRoute.js`; split `PolicyDetailView`, `ProductConfiguratorScreens` and the lead-creation cards; collapse the Location master and account-setup clones | 26, 27 | M-L |
| 20 | Colour tokens via the existing codemod for the top literals; move admin-role list, upload limits and token lifetimes to config/settings; one default per setting key | 22, 23 | M |

Items needing a product decision: branding strings (INXT vs BDOI) in `public/index.html`/`manifest.json`; whether
agents may upload files that other users open in the browser at all; token storage model; CRA -> Vite migration to clear
the react-scripts advisories.
