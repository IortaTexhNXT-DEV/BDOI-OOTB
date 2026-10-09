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
  `approve:renewals` (renewal terms) and `approve:claims` (claim decisions). An approval route requires the approval
  permission besides the write permission, and the service keeps its maker-checker rule. Which role holds which
  permission is `ROLE_PERMS` in the same file (the broker roles and the TISPH roles `tis-*` of the RBAC v4 sheet); a
  role added there for databases in use also needs a migration, as `0348_tisph_roles.sql` does. Roles that include
  the System Administrator role through `roles.inherits` (SUPERID) are protected like it: `adminEquivalentRoles()` in
  `src/lib/auth.js`.
- Coded reasons: a decision that records a reason (claim repudiation, renewal lapse, quotation declined or dropped)
  takes an optional `reasonCode` of the reason-code master besides the free-text reason; resolve it with
  `decisionReason(db, contexts, { reasonCode, reason })` from `src/modules/ops-masters/records.js`, which checks the
  context and the "requires note" flag and returns the code and the text to store. A decision that cannot be taken
  without a reason (period close and reopening, year-end reversal, void of a printed CAS book, change of a CAS
  document, incentive batch rejection: the contexts of seed `88_accounting_reasons.sql`) takes `{ reasonCode, note }`
  and resolves it with `requiredReason(db, context, { reasonCode, note })` from the same file (the code is required;
  returns `{ code, name, note, text }`); store the code beside the reason text (migration 0380 adds the columns).
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
- Every mutation calls `audit(req, {...})` from `src/lib/audit.js`. Workflow events that someone must act on
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
