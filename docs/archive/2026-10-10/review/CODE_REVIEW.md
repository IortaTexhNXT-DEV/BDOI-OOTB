# BrokerVerse OOTB code reviews

Three reviews of 29 September 2026, newest first: the front-end code review, the backend code quality review and the
security, standards and quality review (second pass). Paths are relative to `backend/` or `brokerverse/` as
indicated. Where later work changed something a review found, the text has been brought up to date, so every
statement here describes the code at the head of `brokerverse-platform`. The items still open are collected in
section 4.

---

## 1. Front-end code review (brokerverse/)

Review of the React front end at commit `cb035c2`, with the clean-up made on top of it. Scope: code smells,
standards, naming and branding, disconnects between screens, menu, translations and the API, and how easy the code
is to support.

### 1.1 What was checked and how

| Check | Method |
| --- | --- |
| Branding and naming | Case-insensitive search of `src`, `public`, `package.json` for names of third-party tools, vendors, other products and companies, and wording that describes generated content |
| API disconnects | New `scripts/check-api-calls.js` (`npm run check:api`): parses every file, resolves the request helpers of the services and compares each call with `backend/docs/api/openapi.json` |
| Routes and menu | Every `path` in `components/SideBar/list.js` against `routes/MainRoute.js`; every route against the menu and all path literals in `src` |
| Translations | New `scripts/check-translations.js` (`npm run check:i18n`): keys used in code against `en.json` and `th.json` |
| Dead code | Import graph from `src/index.js` and the tests; ESLint `no-unused-vars`; commented-out code detected by parsing comment text |
| Smells | ESLint (react-app rules), console calls, defect tags and change-log comments, duplicated helpers, hard-coded data and URLs, folder name typos |
| Behaviour | Build, 30 unit tests, and a browser run that signs in as the administrator and opens all 154 menu entries, before and after the changes |

### 1.2 Results in numbers

| Measure | Before | After |
| --- | --- | --- |
| ESLint warnings (whole `src`) | 1,899 | 293 |
| of which `no-unused-vars` | 1,571 | 0 |
| `console.*` calls | 1,572 | 0 (173 diagnostics go through `utility/logger`) |
| Commented-out code blocks | about 1,260 (3,600 lines) | 0 |
| Source files under `src` | 1,335 | 1,176 |
| Unused files removed (`src` and `public`) | | 168 |
| Lines of code removed / added | | about 27,800 / 1,450 |
| Calls to API routes that do not exist | 0 | 0 |
| Translation keys used but missing from `en.json` | 86 | 0 |
| Unit tests | 30 pass | 30 pass |
| Menu entries with page errors or failed API calls | 0 of 155 | 0 of 154 (the 155th was a commented-out entry) |

The remaining 293 warnings: 163 `react-hooks/exhaustive-deps`, 121 `eqeqeq` (`==` between values of possibly
different types), 5 `anchor-is-valid`, 3 `no-lone-blocks`, 1 `default-case`. They were left because changing them
changes behaviour and needs testing per screen.

### 1.3 Findings and what was fixed

**Branding and wording.** The quote Share dialog described the template-based e-mail text (`POST /email/generate`,
filled by the backend from the `share_quote` template) as machine-generated, with decorative symbols, and
`emailService` used the same wording in its timeout message. It is now "Use suggested content" with new en and th
keys; state and props are renamed (`suggestedContent`, `suggestedSubject`, `suggestedHtml`). Quote comparison and
remittance analytics labelled the backend's rule-based notes the same way, and the product recommendation data used
mock-style names; all renamed. `package.json` was `finance_module`; `index.html` and the manifest carried another
product name with Open Graph tags for another domain; translations, a payment tile and the remittance statement
preview had another broker's name and address; bulk upload templates were downloaded from another company's
storage bucket; a helper named after the Thai baht formatted pesos; a treaty field was labelled THB. All replaced
with BrokerVerse and iorta TechNXT wording, system settings or neutral names.

**Defects fixed.**

1. Share dialog: the editable body was the plain-text version but was sent as HTML, so paragraphs were lost; it now
   edits and sends the HTML. The e-mail is recorded against the quotation (`quotationId` passed to `/email/send`),
   and the recipient name comes from the lead instead of "Valued Client".
2. Sales Dashboard > Existing client: every client opened quote creation for a fixed lead id; the list was empty
   unless the Clients screen had been opened; searching showed the raw result array. It now loads clients, filters
   and opens the chosen client.
3. Add Receipts pickers showed the raw keys `accounts.addReceipts.draftCount` and `billsOpen`.
4. Receipts and Payment Voucher "Download Template" opened files in a third-party bucket; templates are now
   generated in the browser with the columns the API reads, and `.csv` is accepted.
5. Transaction code set-up showed a made-up row until loaded.
6. `th.json` had 48 keys written twice (some whole sections), so earlier values were silently lost; de-duplicated
   keeping the effective value.
7. Duplicate object keys and a duplicate `className` prop (the overridden values removed); holes in two breadcrumb
   arrays; a self-assignment in a reducer.
8. The renewal waiting screen loaded its picture from an external image host; the top bar showed
   "user@example.com" when no e-mail was stored; `index.html` preloaded a font through a path the build does not
   serve.

**Disconnects.**

- API: every front-end call matches a documented route and method. 72 backend routes have no caller
  (informational, `npm run check:api -- --unused`): mostly legacy aliases kept for compatibility (`/lead/*`,
  `/master/*`), record detail endpoints the screens do not need, report schedules, `/search`, `/version`.
- `routes/apiRoutes.js` listed about 60 paths of an older API; only three journal-voucher paths were used. Removed.
- Menu: every menu entry has a route. 38 routes are not reached from the menu or a literal link; most are edit and
  detail steps reached through paths built at run time. Removed only `master/finance/bankaccount` and
  `master/finance/bankcheque` (declared twice, no link, the cheque master showed component-library demo products).
  Left and listed: `master/finance/branch` and `department` (they use the masters API but have no menu entry),
  `master/finance/taxation-legacy`, `/underwriting/dashboard` (redirect), `/agent/policy/paymenterror`,
  `/reports/financialreports/payables`, `/finance/remittance/reports`, `/agent/editprofile`,
  `/agent/claim/claimtable`, `/agent/quotation/quotationtable`.
- The `permissions` field on menu entries (46 entries) is not read by the front end; access is decided by
  `utils/menuPermissions.js` and the API. It serves as documentation.
- The API export (`backend/src/tools/export-api.js`) documented the routes of secondary routers under the wrong
  path (for example `/quotations/email/send` for `/email/send`, the notifications routes under `/accounting`).
  The generator now reads the mounts from the module routers and `backend/docs/api` lists the paths Express serves.

**Code smells cleaned.**

- Console output: 1,033 `console.log` statements (form values, API payloads, marker strings) removed with the
  debug-only effects they needed; 269 `console.error` and `warn` calls removed where the error was already shown to
  the user or returned; 174 moved to `utility/logger` (silent in production, enabled per browser with
  `localStorage.bv.debug = "1"`). ESLint warns on `console`.
- Comments: defect tags, "BUG #n FIX", "Task n", "(FIXED)", decorative markers and commented-out code removed;
  explanatory comments kept.
- Unused code: 944 unused imports, 633 unused variables and handlers, and 143 files nothing imports (old masters,
  mock data, unused components, icons, fonts, images).
- Service pattern: `emailService` had four copies of the same fetch block; now one helper. Services export named
  instances.
- Folder typos fixed: `PoductConfiguratorTab`, `productRecommandation`, `ComapanyMaster`, `coverageDetailedVew`,
  `DropdwonField`, file `contants.js`.

### 1.4 How to keep it clean

Run before every merge: `npm run build` (warnings must not grow), `CI=true npm test -- --watchAll=false`,
`npm run check:api`, `npm run check:i18n`. The GitHub workflows run the tests and the build on every push. The
developer guide (`docs/developer-guide/frontend.md`) explains the structure, how to trace a defect and how to add a
screen, menu entry, translation or report.

---

## 2. Code quality review (backend), 29 Sep 2026

Scope: `backend/` after the follow-up fixes (commit `cb035c2`): 169 source files, 38 modules, 708 routes at the time
(717 now), 224 linted files, 49 test files. The question was whether a developer or a support engineer who has
never seen the code can find their way, and whether the code reads as one consistent code base.

### 2.1 What was checked

| Check | How |
|---|---|
| Names of third-party products or vendors, and phrases such as "generated by" | Case-insensitive search of code, comments, docs, `package.json` and test names |
| Tracker tags and change-log comments ("(D92)", "persona walk", "was X, now Y", "fixed ...") | Search, then each hit read and rewritten by hand |
| Duplicated helpers | Search for local definitions of date, amount, CSV, template, maker-checker, storage-key and permission helpers |
| Unused exports | Every `export` searched for outside its file (source, tests, scripts); job handlers are looked up by name and were excluded |
| Error handling and logging | Direct `res.status(4xx).json`, `new HttpError`, `throw new Error`, `console`, request id in error bodies and logs |
| Route registry | All modules loaded through the API export: summary and screen on every route, duplicates, failed modules, permissions required against permissions that exist and roles that hold them |
| Settings | New `scripts/check-settings.js`: keys read in code against keys that migrations and seeds create |
| Report catalogue, scheduled jobs | Every `report_definitions.query_name` against `QUERIES`; every `scheduled_jobs.handler` against `jobs/handlers.js` |
| Structure | Each module has `router.js`; which have `service.js`; which need a README |

### 2.2 What was found

| Area | Found | Examples |
|---|---|---|
| Third-party product or vendor names | 0 in code, tests or package metadata | Two uses of "generated by" are ordinary English (period-end journals, the report header) and stay. `package.json` had no author. |
| Tracker tags in comments and test names | 61 lines in 32 files | `(D92)` in `db/seed.js`, `describe('passwords (D83)')`, migration headers `-- D40: ...` |
| Change-log comments, long dashes | 2 and 2 | "replaces the former mock payment" |
| Duplicated helpers | 11 groups, 30 copies | `isoDate`/`toDate` 4 copies with 3 behaviours; `addDays` 3; amount parsers 3; CSV cell writers 5 (4 without formula guarding); `renderTemplate` 2; `assertChecker` 2 with different signatures (one ignored the setting); XLSX writers 3; ZIP writers 3; storage-key generators 3 (two with 32-bit keys); permission checks 4; the notification visibility SQL 2 |
| Unused exports | 7 | `displayDate`, `isStarted`, `splitAmounts`, `QUOTE_LABELS`, `nextDay`, `fiscalYearOf`, `userId` |
| Exported but only used in their own file | about 140 | `computeLine`, `entryWhere`, `buildSql` ... harmless; left |
| Error responses written by hand | 4 | `accounting/router.js` (2), `commission/router.js`, `reports/router.js` |
| `console` in API code | 0 (ESLint refuses it); the scheduler defaulted to `console` | `jobs/scheduler.js` |
| Routes without summary or screen | 0 of 708 | |
| Duplicate routes, modules that fail to load | 0, 0 | |
| Permissions required by a route that do not exist or that no role holds | 0 | Every one exists; the System Administrator holds all |
| Settings read in code but not seeded | 0 of 248 keys | |
| Settings seeded but not read | 4 of 351 | `notification.renewal_reminder`, `receipts.print_title` (both on Master > Configuration with no effect), `product.component_kinds` (read-only list), `limits.session_idle_minutes` (read by the front end only) |
| Report catalogue against queries | 39 / 39, consistent | |
| Scheduled jobs against handlers | 15 / 15, consistent | |
| Magic values | 2 | e-mail outbox retry count and batch size; the list of daily reports |
| Comments that no longer matched the code | 4 | `reports/queries.js`, `queueEmail`, `docs/MODULE_GUIDE.md` (retired roles and the old numbering function), `deploy/REFERENCE.md` |
| Modules without `service.js` | 13 of 38 | Most split their logic into named files (period-end, placement, bank-reconciliation); `auth` and `users` keep logic in the router |

### 2.3 Defects fixed

| # | Defect | Fix |
|---|---|---|
| 1 | The switch `notification.renewal_reminder` on Master > Configuration had no effect | The renewal notice job honours it (test added) |
| 2 | `receipts.print_title` was never read | Used as the title of a multi-receipt PDF |
| 3 | CSV downloads of incentive, reinsurance, remittance, claims, renewals, the accounting export and bulk-upload results wrote cells starting with `=`, `+`, `-` or `@` unguarded | All CSV writers use the guarded `csvCell` of `lib/csv.js` (test added) |
| 4 | E-mail subjects were HTML-escaped: "Cruz & Sons" arrived as "Cruz &amp;amp; Sons" (10 subject lines) | Subjects rendered as plain text (test added) |
| 5 | Incentive calculation approval ignored `finance.maker_checker_enabled`, unlike every other finance approval | One `assertChecker` in `lib/makerChecker.js`; treaties and cessions keep the rule always |
| 6 | Claim documents and generated finance files were stored under keys with 32 random bits; every other upload uses 128 | One key generator (`newKey` in `uploads/storage.js`) |
| 7 | A scheduled job that failed was recorded in `job_runs` but never logged, so log-based alerting missed it | Failures logged with job code and run id |
| 8 | `GET /schedules` and its run history needed only sign-in | They require `read:schedules` |

### 2.4 What was changed without changing behaviour

- Tracker tags, persona-walk references and change-log wording removed from 61 comment and test-name lines; the
  reason is kept where it explains the code. `persona-walk.test.js` is now `role-access.test.js`.
- The helpers above have one implementation each in `src/lib` (`dates.js`, `money.js`, `csv.js`, `template.js`,
  `makerChecker.js`, `xlsx.js`, `zip.js`, `logger.js`); module helper files re-export them. A test fails if a second
  copy of `isoDate`, `addDays`, `toNumber`, `csvCell`, `renderTemplate` or `assertChecker` appears.
- `notify()` moved from `notifications/router.js` to `notifications/service.js`.
- The XLSX, ZIP and CSV writers moved from `src/tools` to `src/lib`; `src/tools` holds only the API export.
- Hand-written error responses replaced by `notFound` and `forbidden` (the body now also carries the request id).
- Named constants for the outbox retry count and batch size; the daily report list is a job parameter.
- `package.json`: author iorta TechNXT, description, private, `engines` Node 22.
- New: `scripts/check-settings.js` (`npm run check:settings`), a test that the report catalogue and `QUERIES`
  agree, READMEs for accounting, placement, period-end, bank-reconciliation, remittance, reports and
  document-numbering, `docs/developer-guide/`, `docs/MODULE_GUIDE.md` brought up to date.

`scripts/check-settings.js` on a freshly migrated and seeded database after the changes:

```
351 settings in the database, 248 fixed keys read in code, 5 key patterns.
Read in code but not in the database (0)
In the database, named only by the front end (1): limits.session_idle_minutes
In the database, not named anywhere in code (1): product.component_kinds
```

Checks after the changes: all tests pass (518 in 50 files at the head of the branch), `npx eslint src test scripts`
reports nothing. The ESLint rules the review asked for (`no-console` outside scripts, `no-unused-vars` as error,
`eqeqeq`, `prefer-const`) are in force and the code complies.

---

## 3. Security, standards and quality review (second pass), 29 Sep 2026

Scope at the time: front end `brokerverse/` and backend `backend/` (147 JS files, 565 routes, 32 test files).
Figures were produced with ESLint, `npm audit`, `jscpd`, a script that classifies each route's middleware and a
script that checks which routes some test calls. The backend findings were fixed on 29 Sep 2026; the front-end
code findings of this pass were taken up by the front-end review in section 1, whose figures replace the ones of
this pass.

### 3.1 Findings and status

Defect numbers refer to `docs/e2e/DEFECTS.md`.

| # | Area | Finding at the second pass | Severity | Status now |
|---|------|---------|-------|----|
| 1 | Security / files | Any signed-in user could overwrite or delete any stored document | High | Fixed (D81): uploader, module writer or administrator only |
| 2 | Security / files | Uploads kept the client-supplied content type, had no type allow-list and were served inline from the SPA's origin (stored XSS risk) | High | Fixed (D82, D99): type detected from the content, allow-list, signed links, sandbox CSP, downloads for non-image, non-PDF files |
| 3 | Security / auth | Users created without a password got a fixed password; "must change password" and expiry were not enforced | High | Fixed (D83): random temporary password shown once, restricted token until changed |
| 4 | Security / config | `JWT_SECRET` and `CORS_ORIGINS` fell back to unsafe defaults | High | Fixed (D84): production start-up check |
| 5 | Security / logging | Request logs contained the `Authorization` header and download tokens | Medium | Fixed (D85): redaction, tested |
| 6 | Security / sessions | Access tokens lasted 24 h and were not re-checked; password change did not revoke refresh tokens | Medium | Fixed (D86): 30-minute tokens, token version, rotation and revocation |
| 7 | Security / 2FA | No front-end challenge or enrolment; TOTP secrets and reset codes stored in plain text | Medium | Fixed (D87, D88); the enrolment screen shows the key and a link, not a QR image |
| 8 | Security / DoS | XLSX readers inflated without a cap; large uploads held in memory | Medium | Fixed (D93); rate limits still counted per instance |
| 9 | Input validation | 186 of 297 write routes had no zod schema | Medium | Partly: empty-body validation on the affected forms (D110); schemas not on every write route |
| 10 | Authorization metadata | Registry roles and permissions were documentation only | Medium | Fixed (D94) |
| 11 | Authorization coverage | 39 routes needed only sign-in, including file storage, `GET /settings` and `GET /schedules` | Info | Fixed for file storage and `GET /schedules`; `GET /settings` still needs only sign-in |
| 12 | SQL injection | No string-built SQL with request values; dynamic identifiers white-listed or quoted | - | No finding |
| 13 | Error handling | 500 responses returned the internal error text | Low | Fixed (D95) |
| 14 | Dependencies (backend) | `npm audit`: nodemailer (high), node-cron (moderate) | Medium | Fixed (D96): no backend advisories |
| 15 | Dependencies (front end) | 71 advisories (3 critical, 35 high), almost all build-time dependencies of react-scripts; react-router and craco moderate | High | Open: leave Create React App (Vite) and move to React Router 7 |
| 16 | Front-end roles | Undefined roles got full access | - | Fixed: deny by default, every route guarded, server enforces permissions |
| 17 | Front-end token storage | Access and refresh tokens in `localStorage`; no CSP on the SPA | High (with item 2) | Open: tokens still in `localStorage` (accepted for go-live, `deploy/README.md` section 9); no CSP header for the SPA |
| 18 | Front-end supply chain | CSS loaded from a CDN | - | Fixed: bundled from npm |
| 19 | Front-end logging | Console calls in production code | Low | Fixed (section 1): no direct `console` calls; diagnostics through `utility/logger` |
| 20 | Front-end mock data | Production files importing mock data | Medium | Partly: unused mock files removed (section 1); the product recommendation step, the employee benefit flow and the endorsement city list still use fixed lists |
| 21 | Front-end hard-coded URLs | External hosts in the code | Low | Partly: the third-party storage bucket and image host removed (section 1); remaining links are to public services |
| 22 | Hard-coded business values | Currency, VAT and bank literals in the front end; backend values in code | Medium | Fixed (D130-D146): values in settings; the administrator role is named once (`ADMIN_ROLE`) |
| 23 | Hard-coded colours | Hex literals in SCSS and JSX outside `src/theme` (about 6,300 in 314 SCSS files now) and inline styles | Medium (theming) | Open |
| 24 | ESLint (front end) | Warnings, some real defects (duplicate keys, props, members) | Medium | Fixed defects; 293 warnings left (section 1.2) |
| 25 | ESLint (backend) | 0 errors, 0 warnings with strict rules | - | Good |
| 26 | Dead or duplicate code | Never-imported files; duplicated master screens | Low | Dead files removed (section 1); duplicated screens (City and State masters, account set-up screens) remain |
| 27 | Large files | Over 40 files above 800 lines; `MainRoute.js` without lazy loading | Low | Open: `PolicyDetailView` (2,268 lines), `ProductConfiguratorScreens.js` (1,966), `MainRoute.js` (1,894, 416 routes) |
| 28 | i18n | Keys missing from `en.json`; Thai incomplete | Low / Medium | `en.json` complete (checked by `npm run check:i18n`); `th.json` misses 1,398 keys; Filipino has no translation file |
| 29 | Tests | Backend 259 tests in 32 files; front end 3 test files | Medium | Backend 518 tests in 50 files; front end 30 tests in 8 files; both run in GitHub CI |
| 30 | Consistency | Three list-pagination shapes, legacy verb-style paths | Medium | Backend helpers unified; pagination shapes and legacy paths kept for the screens (section 4) |
| 31 | XSS sinks (front end) | No `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML=`; `window.open` passes `noopener` | - | No finding |

### 3.2 Security controls as they are now

**Authentication** (`src/lib/auth.js`, `src/modules/auth/router.js`). Passwords are bcrypt hashes with a policy,
history and maximum age (`lib/password.js`). A user created without a password gets a random temporary one shown
once; "must change password" and an expired password lead to a restricted token that only reaches the
change-password step. The first administrator password comes from `ADMIN_PASSWORD`; without it a random one is
generated and must be changed at the first sign-in. Sign-in, two-factor, forgot and reset password are rate limited
per IP and per username; accounts lock after `limits.max_login_attempts`; every attempt is in `login_history`.
Access tokens last 30 minutes; a per-user `token_version` ends every session on deactivation, role change, password
change or reset; refresh tokens rotate and reuse revokes the family. JWT verification is pinned to HS256. TOTP has
replay protection, secrets are encrypted at rest and reset codes hashed. The production start-up check refuses
missing or short secrets, `CORS_ORIGINS=*` and a localhost `PUBLIC_BASE_URL`. Open (Low): a locked or inactive
account answers "Account locked" or "Account inactive", which tells a caller that the username exists.

**Authorization.** `define()` puts `requireAuth` first on every route unless the route declares `auth: false`, and
a test calls every non-public route without a token and expects 401. The public routes are sign-in, the two-factor
step, refresh, logout, the password policy, forgot and reset password, the customer quote approval (signed token),
report download (signed token), the public branding settings, `GET /version`, the health endpoints and
`GET /s3/object/*` with a signed, expiring link. Seven broker roles are seeded; the System Administrator passes
every check, and the Accounting Manager inherits Accounting.

**Input validation and SQL.** All values are bound parameters; dynamic SQL uses white-listed sort columns, field
names validated by pattern and quoted identifiers, or column maps. Many write routes validate in the service
rather than with a zod schema (Remittance, Product Configurator and Reinsurance have the most). The JSON body
limit is `JSON_BODY_LIMIT` (2 MB).

**Files.** Writing, replacing and deleting a stored file checks the uploader or the permission of the linked
record. The type is detected from the file signature and checked against `uploads.allowed_types`; the detected type
is stored. Files other than images and PDF are served as attachments with a sandbox CSP and `nosniff`. Links are
signed and expire (`FILE_URL_TTL_SECONDS`); storage keys carry 128 random bits. Upload and import sizes come from the
environment, and workbook decompression is capped.

**Secrets in the repository.** No live secrets in tracked source. `.env` files are git-ignored; `backend/.env.example`
and `deploy/backend.env.example` hold placeholders. The only literal password is the test administrator password in
`vitest.config.js`. When `ADMIN_PASSWORD` is unset, the generated first password is written to the log once; set
`ADMIN_PASSWORD` in production so it never reaches the log store.

**Headers, CORS and rate limits.** helmet on every API response, `x-powered-by` disabled, `trust proxy 1`. CORS is
an explicit allow-list, enforced in production. The SPA has no CSP (none in `public/index.html` or `nginx.conf`,
which sets `nosniff`, `X-Frame-Options` and `Referrer-Policy`). Rate limits are in memory and counted per API
instance.

**Logging.** The backend redacts authorization and cookie headers, credential fields and token query parameters
(`lib/logger.js`, tested); ESLint refuses `console` outside command-line scripts. The front end logs through
`utility/logger`, silent in production.

**Dependencies.** Backend: no advisories (nodemailer 10, node-cron 4). Front end: 71 advisories at the second pass,
most of them in the build tool chain of react-scripts 5.0.1 (all the critical ones) (no fix except leaving Create React App), react-router
6.30 and craco (moderate). Both packages pin with committed `package-lock.json` and `npm ci`.

**HTML output.** E-mail templates escape variables in the body and render subjects as plain text
(`lib/template.js`). Two paths send HTML supplied by the caller: `POST /email/send` (`quotations/email.js`,
permission-gated) and the collections follow-up (`collections/service.js`). Low: this is a phishing channel from the
company's own sender address rather than XSS. `i18n.js` has `escapeValue: false`, which is safe while nothing
renders translation values as HTML.

---

## 4. Open items

| # | Action | From | Effort |
|---|--------|------|--------|
| 1 | Move sign-in and API rate limiting to a shared store (they count per API instance today) | 3.1 item 8 | S |
| 2 | Require a permission on `GET /settings` (sign-in only today); check `write:schedules` on `PUT /schedules/:code` instead of the Accounting role; document `profile` and `notifications` permissions as always-on or remove them | 3.1 item 11, 2.2 | S |
| 3 | Two-step verification enrolment: show a QR image | 3.1 item 7 | S |
| 4 | zod schemas for the write routes that still validate only in the service, finance first | 3.1 item 9 | L |
| 5 | Front end: CSP header for the SPA; plan moving the refresh token to an httpOnly, SameSite cookie (backend change) | 3.1 item 17 | S / L |
| 6 | Front end: leave Create React App for Vite (`REACT_APP_*` becomes `VITE_*`), then React Router 7; remove `js-cookie`, `react-pro-sidebar` and `web-vitals` (no longer imported) and move the four `moment` users to `utility/dateFormat` | 3.1 item 15, 1 | M |
| 7 | Front end: fix the 163 `exhaustive-deps` and 121 `eqeqeq` warnings per screen, with a test | 1.2 | M |
| 8 | Front end: translate the 1,398 missing Thai keys, or offer only English until complete | 3.1 item 28 | M |
| 9 | Product decisions: the product recommendation step of Motor quote creation (illustrative plans with fixed premiums), the employee benefit flow reachable from the Sales Dashboard (mock option lists), the fixed endorsement city list (use `/addresses/*`) | 3.1 item 20 | M |
| 10 | Lazy-load routes in `MainRoute.js`; split `PolicyDetailView`, `ProductConfiguratorScreens` and the lead-creation cards along their tabs when changed; collapse the Location master and account set-up clones | 3.1 items 26, 27 | M-L |
| 11 | Colour tokens instead of hex literals, starting with the most used ones | 3.1 item 23 | M |
| 12 | Backend: merge the two XLSX readers (`accounting/lib/sheet.js`, `documents/xlsx.js`) into `lib/xlsx.js`; move the business logic of `auth/router.js` and `users/router.js` into `service.js` files when those modules next change; drop the `export` keyword from the about 140 functions used only in their own file | 2.2 | S-M |
| 13 | Backend: `receivables.due_days` is read only by the sample seed (bills take their due date from the insurer credit terms); relabel or remove it | 2.2 | S |
| 14 | Backend: log at warn level the two swallowed errors, `renewals/queue.js` (`processQueue().catch(() => {})`, failures are recorded on the job rows) and the receipt PDF printed without lines when they cannot be read (`documents/router.js`) | 2.2 | S |
| 15 | Remittance > Reconciliation matches bank transactions in its own tables, apart from the bank-reconciliation module: retire the screen or feed it from bank reconciliation (product decision) | 2.2 | M |
| 16 | Keep the legacy route names the screens use (7 camel-case segments, about 20 verb-style paths, 3 pagination shapes) until the front end moves; new routes use kebab-case nouns and one list envelope | 3.1 item 30 | - |
| 17 | Add a test coverage tool (`@vitest/coverage-v8`) and front-end tests for the sign-in flows | 3.1 item 29 | M |
