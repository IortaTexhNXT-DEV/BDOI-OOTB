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
  `approve:renewals` (renewal terms) and `approve:claims` (claim decisions), and `approve:remittance` (remittance
  approvals, migration 0400; an approver needs no `write:remittance`). An approval route requires the approval
  permission besides the write permission, and the service keeps its maker-checker rule. Where the screens must
  explain a refused decision before anyone acts, the module answers a decision block with the shared codes
  (`canDecide`, `blockedCode` such as SUBMITTER, ABOVE_LIMIT, NO_AUTHORITY, ALREADY_DECIDED, and the sentence in
  `blockedReason`), refuses with the same code in `errors[0].code`, and takes the record `version` the screen showed
  (409 when it moved on); `src/modules/remittance/decision.js` is the model, and Bank Payment Files answers the same
  block for a batch (`batchDecision` in `src/modules/integrations/bankfiles/batches.js`, read-only beside the rules
  `approveBatch` enforces), as Insurer billing does for a commission debit note (`debitNoteDecision` in
  `src/modules/remittance/directbill.js`). On the screen a blocked decision is the EligibilityNote line, never a
  disabled button; a new batch is made with the shared `components/BankBatchDialog`, never a copy of it. A bank account number is masked in lists and records ("···4821"); the full number is a
  route of its own behind the write permission, and each reveal is audited (`GET /remittance/payments/:id/account`).
  Which role holds which
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
  document, incentive batch rejection: the contexts of seed `88_accounting_reasons.sql`; the remittance, exception,
  insurer reconciliation and insurer billing decisions: the contexts of seed `89_remittance_reasons.sql`; cancellation
  of a sales invoice or a payment acknowledgement: seed `89_tax_invoice_reasons.sql`) takes `{ reasonCode, note }`
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
- Every mutation calls `audit(req, {...})` from `src/lib/audit.js`. Workflow events that someone must act on
  create a notification with `notify()` from `src/modules/notifications/service.js`; customer-facing e-mails go
  through `queueEmail()` in `src/lib/mailer.js`, with the text from `renderTemplate()` (`src/lib/template.js`;
  subjects with `{ html: false }`).
  Give the audit row a `before` with the status the action started from, so the history shows the move. On a
  created record the history lists only its own top-level facts (number, parties, status, dates, amounts); ids of
  other records are dropped unless they resolve to a number or name, so store the name next to the id. A record
  type whose steps are stamped on its own columns (created / approved / posted ... at and by) is listed in
  `LIFECYCLE` of `src/modules/audit/service.js`, so records the trail never saw (sample data, go-live loads) still
  show those steps. A step may read a sub-query on the record (the policy a quotation became), apply only in a state
  (`when`: a rejection kept only in the status) and carry the change it made (`after`: the status reached, the
  number created); steps taken at the same moment keep their order (created before approved).
- Features and releases: every screen, API path, job, connector and setting belongs to a feature of
  `src/modules/features/catalogue.js` (tier Phase 1, Phase 2, future release or platform). Register the menu entry of
  a new screen there (`docs/developer-guide/features.md`); a function of a later release lists its API paths, jobs,
  connectors and settings so that the gate, the scheduler and the integrations keep it out while it is off, and calls
  `assertFeature(key, { write: true })` where a rule cannot be reached by its path. Suites that test it enable it with
  `enableFeatures(app, [...])` (test/helpers.js).
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
  the columns in its messages (`columnMessage`, `issueText`). An upload that creates records another user approves
  validates first and creates later: it keeps the file, its hash and one result per row under an import record, answers
  an error report (the file's columns plus Result and Message), and refuses a file whose hash was already committed
  (`src/modules/remittance/imports.js` is the model). Amounts typed in such a file are compared, never used.
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
