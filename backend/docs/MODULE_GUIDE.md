# Writing a backend module

The API serves the BrokerVerse React front end in `../brokerverse`. The contract is whatever the front end calls:
paths, query parameters, request bodies and the response fields its reducers and components read. When the front
end and this guide disagree, the front end wins, because the goal is that every screen works unchanged or with a
minimal, clearly-correct front-end fix.

## Layout

- `src/modules/<name>/router.js`: one folder per module. Export `default` (an Express router), optional
  `mount` (path prefix, default `''`), optional `extraMounts` (`[[prefix, router], ...]`) and optional `order`.
  `src/app.js` mounts every module under `/api` automatically. Do not edit `src/app.js`.
- `src/modules/<name>/service.js`: business logic and SQL, so routers stay thin and logic is testable.
- `src/db/migrations/NNNN_<name>.sql`: tables for the module. Use your own number range. Never edit another
  module's migration. To extend a shared table use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in your migration.
- `src/db/seeds/NN_<name>.sql`: idempotent seed data (reference data and a small, realistic sample so every list
  screen shows rows). Sample people and companies must be fictional.
- `test/<name>.test.js`: Vitest + supertest integration tests against a real database.

## Conventions

- Declare every endpoint with `define()` from `src/lib/registry.js`
  (`const { router, define } = moduleRouter('<Module name>', '<mount>')`). Fill `summary`, `screen` (the
  front-end menu path that uses it), and example `query` / `request` / `response`. The API list, Postman
  collection and Excel are generated from these declarations, so they must be accurate.
- Auth: `define()` puts `requireAuth` first on every route unless the route says `auth: false` (sign-in type
  endpoints only). Gate writes with `requirePermission('write:<module>')` and reads with
  `requirePermission('read:<module>')`; the System Administrator (`system-admin`, `ADMIN_ROLE` in `src/lib/auth.js`)
  always passes. Permission codes are `read:` / `write:` + one of the modules in `MODULES` in `src/db/seed.js`, plus
  `approve:period-end`, `approve:bank-reconciliation`, `approve:insurer-reconciliation`, `approve:credit-control`,
  `write:posting-rules`, `approve:posting-rules` and `view:pii` (full personal identifiers), and the approvals of the front office
  (migration 0348): `approve:quotations` (quotation approval), `approve:policies` (check of a placement against the slip),
  `approve:renewals` (renewal terms) and `approve:claims` (claim decisions), and `approve:data-load` (second-person
  approval of data loads and of the go-live steps, migration 0440). An approval route requires the approval
  permission besides the write permission, and the service keeps its maker-checker rule. Which role holds which
  permission is `ROLE_PERMS` in the same file (the broker roles and the TISPH roles `tis-*` of the RBAC v4 sheet); a
  role added there for databases in use also needs a migration, as `0348_tisph_roles.sql` does. Roles that include
  the System Administrator role through `roles.inherits` (SUPERID) are protected like it: `adminEquivalentRoles()` in
  `src/lib/auth.js`. A new permission code also needs its entry in `src/modules/access-control/catalogue.js` (area,
  module, level and what it allows in business words): Role Permissions shows it from there, and
  `test/role-permissions.test.js` fails while a code of the database has none. On a database in use, the access of a
  role is changed on Role Permissions as a change another administrator approves (`access.change_approval`); a
  migration that grants a permission for a release grants it directly, as `0348_tisph_roles.sql` does.
- Approval limits: an approval step that checks the Authority Matrix calls `assertAuthority(db, user, type, amount)`
  from `src/modules/access-control/service.js` and registers its type in `AUTHORITY_STEPS`
  (`src/modules/access-control/authority.js`) with the screen and the permissions of the step; the matrix shows which
  roles can approve it from there, and `test/authority-matrix.test.js` fails while a checked type is missing. Limits are
  changed on the Authority Matrix (one change approved by another administrator, also for an uploaded workbook).
- Changes of access: a screen of Master > Users and Access that changes access (role access, limits, delegations,
  segregation-of-duties rules and exceptions, access review removals) requests it with `requestAccessChange` of
  `src/modules/access-control/changes.js` and registers its kind with `registerAccessKind` (label, link, summary in
  business words, extra checks on the approver, what approving applies, what a rejection undoes). The table is the
  configuration approval (`accounting_config_changes`); a new kind is added to its kind CHECK by a migration. Changes
  that only reduce access (ending a delegation or an exception early) apply at once. Only the requester withdraws a
  change; the approver holds none of the roles it changes (`rolesHeldBy`). A setting that decides how access is
  enforced is changed through `controls.js` (kind `access-controls`) and listed in `src/lib/settingOwners.js`, so the
  generic configuration endpoints refuse it.
- Coded reasons: a decision that records a reason (claim repudiation, renewal lapse, quotation declined or dropped)
  takes an optional `reasonCode` of the reason-code master besides the free-text reason; resolve it with
  `decisionReason(db, contexts, { reasonCode, reason })` from `src/modules/ops-masters/records.js`, which checks the
  context and the "requires note" flag and returns the code and the text to store. A decision that cannot be taken
  without a reason (period close and reopening, year-end reversal, void of a printed CAS book, change of a CAS
  document, incentive batch rejection: the contexts of seed `88_accounting_reasons.sql`; cancellation of a sales
  invoice or a payment acknowledgement: seed `89_tax_invoice_reasons.sql`) takes `{ reasonCode, note }`
  and resolves it with `requiredReason(db, context, { reasonCode, note })` from the same file (the code is required;
  returns `{ code, name, note, text }`); store the code beside the reason text (migration 0380 adds the columns). A
  change of access takes its reason from the context `access_change` (seed `91_role_access.sql`).
- Record scoping: users whose roles are all in `security.scoped_roles` only see their own book. Use
  `src/lib/scope.js`: pass `await withScope(req)` to list / stats services and add `scopeSql(q[SCOPE], '<entity>', alias, params)`
  to the WHERE clause; guard detail, update and workflow routes with `ownRecord('<entity>')` (answers 404, not 403).
- Validation: zod via `validate(schema)` from `src/lib/validate.js`. Be permissive where the front end sends
  extra fields (`.passthrough()`), strict on the fields you store.
- Responses: match what the front end reads. Where it has no expectation, use
  `{ success, message, data }` and for lists add `total, page, perPage, totalPages` (see `src/lib/respond.js`).
  Many screens read `response.data.data` or `response.data.items`; check the caller.
- IDs: text primary keys with a prefix (`ld_…`, `qt_…`) or serial for masters, as in the existing migrations.
- Document numbers: `nextDocumentNumber('<series code>', { db })` from `src/lib/numbering.js`; the series (prefix,
  pattern, reset rule) is a row of `document_numbering` (see `src/modules/document-numbering/README.md`). Never
  hard-code prefixes, tax rates, currencies, limits, e-mail text or colours: read them from `app_settings` via
  `src/lib/settings.js`. New keys go into a seed or migration (`INSERT ... ON CONFLICT DO NOTHING`) with a group and
  a label; `npm run check:settings` lists keys read in code that nothing seeds.
- Origin of a record: clients, policies, receivables, claims, journal vouchers and post-dated cheques carry `origin`
  (`issued` or `migrated`), `legacy_system`, `legacy_number`, `migrated_at`, `migrated_by` and `load_batch_id`
  (migration 0440). A list of these records filters on `?origin=` with `originWhere(alias, q.origin, params)` and
  returns `origin: originOf(row)` on every row (select `originColumns(alias)` for the name of the user who migrated
  it); an update passes the body through `withoutOriginFields(body, row)`, which refuses a change of the origin
  fields. Figures that leave migrated business out (production, commission, incentive) add `kpiOriginWhere(alias,
  kind)`. All in `src/lib/origin.js`; never test the older flags (`source = 'go-live-migration'`, `doc.source`) in new
  code. A record created by an import of legacy business is written with `origin = 'migrated'`. Dashboards take
  `origin=issued|all` (`dashboard/service.js` `dashboardOrigin`); a renewal-rate denominator counts migrated policies.
- The opening balance journal of go-live (`journal_vouchers.source = 'go-live-opening'`, status `opening`) has no
  journal lines (its lines are the opening balances set, `period-end/opening.js` `openingJournalLines`). A query that
  reads journal headers without a status filter shows it as read-only or leaves status `opening` out; a change to a
  journal goes through `accounting/lib/ledger.js`, whose `assertNotOpeningJournal` refuses it (409).
- Go-live workbooks (`src/modules/data-load`): an object of a kit is a sheet declared in `registry.js`; its importer
  translates legacy codes through the value maps (`resolveValue(ctx, object, value)`, `maps.js`), checks peso amounts
  with `pesoValue` (at most two decimals, never rounded) and reports each record it creates or changes with
  `ctx.record(...)`. The engine gives every row its result (New, Changed, Unchanged, Duplicate, Error) and runs the
  duplicate rules of the object (`duplicates.js`); see the module README. A table that keeps uploaded rows with personal
  identifiers in JSON gets the `pii_protect_columns('json:<column>')` trigger and its `PII_STORAGE` entry, as
  `data_load_rows` does (migration 0441).
- Long imports run as jobs, never in the request (the proxy cuts a request at 60 seconds): register the job type on the
  job queue (`renewals/queue.js` `registerJobType`, `requeue: false` when a second run must never happen), move the
  record with a compare-and-set of its status before the job starts (`data-load/service.js` `moveBatch`), answer 202
  with the job and write the progress outside the job's transaction (`outsideTransaction` of `db/pool.js`). A job that
  stops leaves its record in a state a sweep can see (`data-load/jobs.js` `sweep`).
- Any route that loads legacy business (go-live, opening, migrated data) calls `assertMigrationOpen(kind)` or uses the
  `migrationImportOpen(kind)` middleware (`src/lib/goLiveLock.js`); `test/migration-lock.test.js` lists every such route
  as guarded or exempt with the reason, so a new import route must be classified there.
- Every mutation calls `audit(req, {...})` from `src/lib/audit.js`; several entries of one request (one per record of a
  data load) go in one insert with `auditMany(req, entries)`. Workflow events that someone must act on
  create a notification with `notify()` from `src/modules/notifications/service.js`; customer-facing e-mails go
  through `queueEmail()` in `src/lib/mailer.js`, with the text from `renderTemplate()` (`src/lib/template.js`;
  subjects with `{ html: false }`).
- Errors: throw `badRequest`, `notFound`, `conflict`, `forbidden` from `src/lib/errors.js`; the error handler turns
  them into the JSON error body with the request id.
- Shared helpers: dates in `src/lib/dates.js` (`today`, `isoDate`, `addDays`, `businessDate`), amounts in
  `src/lib/money.js` (`round2`, `toNumber`, `formatMoney`), CSV in `src/lib/csv.js`, XLSX in `src/lib/xlsx.js`,
  maker-checker in `src/lib/makerChecker.js`. Do not write local copies.
- Spreadsheet downloads: `sendTable` (`src/modules/documents/tabular.js`) or `writeXlsx` with `dateFormat` from
  `general.date_format`; date cells are real dates shown in that format, never yyyy-mm-dd text. Printed documents show
  dates through `formatDate` / `formatDatesIn` (`src/lib/pdf/format.js`).
- Uploads: the template comes from the importer's own column list (`src/modules/documents/uploadTemplates.js`,
  `sendTemplate` / `sendWorkbook`: Data, Columns and Instructions sheets) on a `GET .../template` route next to the upload;
  a row-by-row upload answers `uploadResult()` ("Processed n rows: c created, f failed" and the failed rows) and names
  the columns in its messages (`columnMessage`, `issueText`).
- Money is `numeric(14,2)`; the pool returns numbers. Dates are `date`, returned as `YYYY-MM-DD`.
- Deletes are soft (status) unless the record is a draft.
- No `console.log` (eslint refuses it outside scripts); use `req.log` in handlers and `logger` from
  `src/lib/logger.js` elsewhere.

## Running

```bash
npm install
cp .env.example .env               # set DATABASE_URL
npm run db:reset                   # drop, migrate, seed
npm start                          # http://localhost:8000/api
npm test                           # uses TEST_DATABASE_URL (a disposable database)
```
