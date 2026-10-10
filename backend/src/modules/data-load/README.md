# Data load (go-live workbooks)

Loads a broker's go-live data from two Excel workbooks and keeps the history of every load: the **configuration** kit
(everything needed to run new business, promoted from one environment to the next) and the **migration** kit (the open
business of the legacy system at cutover). It also compares the configuration of two environments. API under
`/api/data-load` (`read:data-load`, `write:data-load`; `approve:data-load` for the second-person approvals of the Data
Migration & Go-Live workspace). The administrator guide is `docs/onboarding/GO_LIVE_DATA_WORKBENCH.md`.

## Files

| File | Content |
|---|---|
| `registry.js` | The objects of both kits (REG-1 contract of the master data upload design plus the migration attributes: `kit`, `channels`, `promotable`, `origin`, `duplicateRules`, `productLines`, `present`, `legacyLayout`), their `dependsOn` and the load order (topological sort, declared order among independent objects). `kitObjects(kit)` gives the sheets of a kit in load order |
| `configuration.js` | Sheets of the configuration kit: the generic masters (`masterSheet`, with the `nameColumn` of the duplicate rule `master-name`) and `CONFIGURATION_SHEETS` (settings, users, chart of accounts, commission rates, premium taxes, LGU rates, authority limits, numbering, payee bank accounts, COC series) |
| `migration.js` | Sheets of the migration kit (`MIGRATION_SHEETS`: clients, the policy sheets per product and the single Policies sheet of the earlier layout, open items, post-dated cheques, open claims, opening balances, control totals) and the reconciliation of a migration load |
| `products.js` | The policy sheets per kind of product (`POLICY_KINDS`), their columns (common and product columns, stored in `policies.doc`), samples, product checks and the original currency references |
| `duplicates.js` | Duplicate rules (`tin`, `name-birth-date`, `company-name`, `vehicle`, `coc`, `policy-number`, `insurer-variant`, `master-name`), their normalisation and the detector of a validation |
| `maps.js` | Value maps of the legacy code tables: list, add, change, remove, workbook, upload; `resolveValue(ctx, object, value)` |
| `naming.js` | Document file naming convention and its checker |
| `service.js` | Batches: upload (the file kept with its SHA-256), dry-run validation (one rolled-back transaction, a savepoint per row), the result of each row, duplicates and their resolutions, load (one transaction), errors, review, history; the per-record audit of a load; the status moves (compare-and-set), the load lock and the job limits |
| `jobs.js` | Job types `data-load.validate`, `data-load.load`, `data-load.undo` on the job queue (`renewals/queue.js`), their progress and place in the queue; the sweep (interrupted jobs, expired approvals) |
| `approval.js` | Submit, withdraw, approve (starts the load job), reject with a reason; request, approve, reject and withdraw an undo |
| `undo.js` | What depends on the records of a load (`dependents`) and the undo itself (reverse load order, before-images, opening balances set) |
| `golive.js` | Go-Live tab: cutover date, lock and unlock requests, lock conditions, relock, the owned settings |
| `workbook.js` | Workbook builder and reader (per-object download, Lists, Instructions, the hidden Control sheet), errors and reconciliation workbooks |
| `numbering.js` | Legacy numbers against the numbering series and the COC series |
| `compare.js`, `comparisons.js` | Environment comparison |
| `common.js` | Cell values, row errors, the sheet contract |

## Tables

- `data_load_batches`: one uploaded workbook. `load_number` (computed: `MIG-`, `CFG-` or `UPL-` and the id, never
  reused), `kit`, `status`, `legacy_system`, counts, result per sheet, reconciliation, who and when; the approval, undo,
  timing and job columns of migration 0440 for the workspace.
- `data_load_rows`: the rows read (`data`), their status and action (the result), errors, warnings, the record each
  row created or changed (`record_table`, `record_id`, `record_key`), the stored values it changes (`before`) and the
  changed column keys (`changes`), its duplicates and their resolution (`resolution`, `resolution_reason`,
  `resolved_by`, `resolved_at`). The identifier keys of `data` and `before` (TIN) are encrypted at rest by the trigger
  `data_load_rows_pii` (migration 0441); both columns are in `PII_STORAGE`, so the key rotation covers them.
- `migration_value_maps` (0441): legacy value -> BrokerVerse code per object, unique on the normalised value; kept by
  the transaction reset (configuration).
- `data_load_comparisons`: environment comparisons.
- `go_live_lock_requests` (0442): lock and unlock requests (action, reason, scope, hours, `expires_at`, `relocked_at`,
  steering committee reference, the Go decision), requested by one user and decided by another; one pending at a time.
  Kept by the transaction reset.

The load history is kept by the transaction reset: loaded migration batches are marked `undone`
(`scripts/lib/table-classification.js`, `mark-reset`).

## Origin of migrated records

A migration load writes each record with `origin = 'migrated'`, the legacy system of the batch, the legacy number (the
natural key of the row), `migrated_at`, `migrated_by` (the uploader) and `load_batch_id`; opening balances carry
`load_batch_id`. The older flags (`source = 'go-live-migration'`, `doc.source`, `details.source`, receivable source
`opening`) are still written. Policies keep their legacy number as their policy number (the insurer's number, on the
schedule, the COC and the loan file); business issued after go-live, including the renewal of a migrated policy, is
`issued` and numbered as any issue. Readers use `src/lib/origin.js`.

## Product-wise policy sheets

One sheet per kind of TISPH product: Motor (MOTOR), CTPL, Personal Accident (PA, GPA), Credit Life (CL-COMP, CL-VOL),
Travel, Fire (only while an active product of line fire exists; TISPH has none) and Other Lines (any other product:
Parcel). A product goes on the first kind that accepts it (`policyKindOf`), on Other Lines when its kind has no sheet in
the workbook. Common columns add Branch, Distribution Channel, Business Type, Previous Legacy Policy Number, Legacy
System and the original currency references to the earlier columns; the product columns are stored in `policies.doc`
under the keys the renewal carry-over reads (`renewals/service.js` `CARRY_KEYS` and `LINE_CARRY_KEYS`: conduction
sticker, TFS loan reference and dealer on motor, plan, beneficiary, occupation class and destination on accident lines,
loan reference, amount and term on credit life, risk address, occupancy and construction on fire; the dates of the
expiring term are never carried). A migrated CTPL policy writes its `ctpl_authentications` row (authenticated, manual,
`lto_status = 'not-required'`, the COC series whose range holds the number, never queued to the outbox), so the unique
index `ctpl_authentications_coc_uq` refuses the COC issued again. The single Policies sheet of the earlier layout is still
read (any product, a warning on the batch) and never offered in a template.

Post-Dated Cheques: cheques on hand at cutover, against a migrated open item (`pdc/service.js` `registerPdc` with the
`migration` option: origin migrated, legacy number = the cheque number); dated on or after the cutover, at most the open
balance left. Deposited after go-live like any cheque. Control Totals: the legacy figures of the reconciliation
(object, measure, group, value), validated, never loaded.

Amounts are pesos with at most two decimals (`pesoValue`; more is an error, never rounded); workbook totals are sums of
per-cell centavos (`pesoSum`). Open items are in PHP only; a foreign-currency policy keeps its original currency, sum
insured and rate in `doc` as reference.

## Result of each row, duplicates, value maps

A validation gives each row New (`action` created / proposed), Changed (updated: `before` and `changes`), Unchanged,
Duplicate (status `duplicate`) or Error. Changed is loadable for clients, configuration objects, opening balances
(the set is replaced), open items while nothing touched them in BrokerVerse (receipts, post-dated cheques, credits,
collection actions) and migrated policies and claims created by a load while nothing hangs on them (endorsements, claims
or bills issued in BrokerVerse, receipts, renewals, deposited cheques, a CTPL authentication sent to the LTO; claim
history, settlement movements, letters of authority, documents); otherwise the row is an error that names the load to
undo. A masked cell (`**`) keeps the stored value ("not changed (masked)"); in a key or a duplicate-rule column it is an
error.

The detector (`duplicateDetector(ctx)`) reads the stored side once per validation into memory (TIN through
`clients.tin_bidx`, names and birth dates, vehicle identifiers of in-force policies per sheet, COC numbers, policy
numbers with their insurer, insurer names) and keeps the rows of the file as they are read. A duplicate row is not
loadable until resolved (`POST /batches/:id/resolutions`): `load-as-new` (reason kept), `use-existing` (the row creates
nothing; for a client rule the legacy client code, for an insurer variant the spelling, is mapped in
`migration_value_maps`) or `insurer-suffix` (policy number of another insurer: loaded as `<number>/<insurer code>`,
`legacy_number` the number as printed; `receipts/receivables.js` `findPolicy` finds it by the printed number when no
other policy has it). A resolution holds while the next validation still finds the duplicate. The importers translate
legacy values through the maps (`resolveValue`) before the master lookups; the batch keeps the version of the maps it
read (`maps_version`) and the load refuses a batch whose maps changed since (`assertLoadable`, also the guard of a later
submit). The batch keeps the SHA-256 of its file; a batch of the same kit loaded or waiting for approval with the same
file is shown (`sameFileAs`) and warned.

## Jobs, approval and undo

States of a batch: `validating` -> `validated` | `failed`; `validated` -> submit -> `pending-approval` -> approve ->
`running` -> `loaded` (or `failed`, nothing saved); `pending-approval` -> `rejected` | `withdrawn` | `expired`; `loaded`
-> undo request -> `undo-pending` -> approve -> `undoing` -> `undone` (or back to `loaded`). Every move is a
compare-and-set (`moveBatch`): two approvals of one batch start one load; the second gets 409 "Load MIG-000012 is already
running". A batch that is rejected, withdrawn, expired or failed is validated again (`beginValidation`) before a new
submit.

Validation, load and undo run as jobs (`jobs.js`): the request moves the batch, records the job (`job_id`) and answers
202; `GET /batches/:id` gives `progress` (sheet, rows done and total, written every 500 rows outside the job's
transaction) and `queue` (jobs ahead, the load it waits behind). A job takes the load lock (`takeLoadLock`, polled so
that it can show what it waits for) and sets `statement_timeout` and `idle_in_transaction_session_timeout` from
`migration.job_statement_timeout_minutes` in its transaction. A job is one transaction: a job that stops saves
nothing; a session ended by the server is never taken for an error of a row. The sweep (scheduled job
`data-load-sweep` every 5 minutes, and once at start-up) marks a batch whose job ended without moving it, or wrote no
progress for `migration.job_stale_minutes`, as `failed` (an undo: `loaded`) with "Interrupted: nothing was saved"; a
data load job is never requeued (`registerJobType(..., { requeue: false })`) nor run twice. It also expires the loads
waiting for approval past `expires_at` (`migration.approval_expiry_hours`).

Approval (`approval.js`): `approve:data-load`, never the uploader, the submitter or a user who resolved one of the
batch's duplicates (`assertChecker(..., { configurable: false })`, 403). What is approved is the batch as validated:
`assertLoadable` refuses a changed cutover date, value maps changed since the validation and a stored file whose SHA-256
is not the batch's. The load job runs as the approver (`loaded_by`, the audit entries). Reject: a reason of the Reason
Codes master, context `data_load_reject` (seed `91_data_load_reasons.sql`). The direct `POST /batches/:id/load` runs in
the request and is refused while `migration.load_approval_required` is on, and always in production and pre-production
(`approvalRequired`). Notifications: approvers on submit and on an undo request; the maker on the decision and at the end
of the job; My Work, category Approvals (`my-work/sources.js`).

Undo (`undo.js`, migration loads, before the go-live lock): requested with a reason, approved by another user, run as a
job. `dependents(batch)` lists what stops it: on the records the batch created or changed, business entered since or
records of a load loaded after it (policies on its clients, open items, claims and cheques on its policies, receipts,
credits and collection actions on its open items, deposited cheques, endorsements, renewals, documents, a CTPL
authentication sent to the LTO, claim movements), a later load that changed the same records, a later load that
replaced its opening balances. It is checked at the request, at the approval and in the undo transaction with the
records locked `FOR UPDATE`. The undo goes through the sheets in reverse load order: a created record is removed with
the rows its creation wrote (claim history, collection items, CTPL authentication, risk participants); a changed
record is written back by the importer of its sheet from the row's `before`; the opening balances set is restored from
`data_load_batches.opening_before` (kept by the load). One `migrate-undo` audit entry per record; rows `undone`.
Number counters are not wound back.

The uploaded workbook is kept in the storage folder `go-live-loads` (`file_key`, `file_sha256`), refused by
`/api/s3/object` and the file delete; `GET /batches/:id/file` releases it to `write:data-load` with `view:pii`, each
download audited (`download-file`).

## Go-live lock

`lib/goLiveLock.js` `assertMigrationOpen(kind)` (409 "Go-live is locked: migration imports are closed (locked on
dd/mm/yyyy)", audited `go_live_lock` `refused-locked`) guards the migration kit (upload, validation, resolutions,
submit, approval, load), the undo (`undo`), `POST /policies/bulk-upload` with `mode=go-live` and the files of the
ordinary upload with rows issued before the cutover date (`policies-go-live`), `POST /receipts/opening-items/import`
(`opening-items`) and `POST /period-end/opening-balances/validate` and `/import` (`opening-balances`); the three
single-object imports also need `write:data-load`. The transaction reset refuses while `golive.locked` is on.
`test/migration-lock.test.js` lists every route that loads legacy data as guarded or exempt with the reason.

The lock (`golive.js`) is requested by a holder of `write:data-load` and approved by another user with
`approve:data-load`; it needs the Go decision of the production run, its reconciliation signed, its restore point and no
load in progress (checked at the request and at the approval). The approval writes `golive.locked`, `golive.locked_at`
and `golive.locked_by`. An unlock names the imports it reopens and its hours (up to `migration.unlock_max_hours`); after
`migration.unlock_window_days` from the lock it needs a steering committee reference. The lock stays on during an
unlock; the job `golive-relock` (every 5 minutes) ends it at `expires_at`. The settings `golive.*`,
`migration.load_approval_required`, `migration.*_include_migrated`, `migration.sap_gl_include_opening` and
`migration.subledger_tieouts` belong to the Go-Live tab (`lib/settingOwners.js`): `PUT /settings`, the system
configuration and the Settings sheet refuse them; the cutover date is set by `PUT /golive/cutover-date` (refused once
locked and while a migration load is loaded or in progress), the others by `PUT /golive/settings` (`approve:data-load`).

## Templates

`GET /kits/:kit/template?objects=&prefill=`: the whole kit or some objects, blank or with the current data (masked for a
user without `view:pii`), with Instructions (load order with dependencies, results, duplicate checks, the products of
each policy sheet, the document naming convention), Lists (products per policy sheet, branches, channels, vehicle
types, plans, currencies, banks, document types) and the hidden, protected Control sheet (kit, objects, layout version =
hash of the column keys, environment, content, generated at and by). A file with a Control sheet of another kit or
another layout is refused; a file without one is read by its headers.

## Document file naming

`<RecordType>_<RecordNumber>_<DocumentType>_<YYYYMMDD>[_<n>].<ext>` (`naming.js`; record types CLT, POL, END, CLM, BIL;
document types of `migration.document_types`). `POST /document-names/check` checks a list of names (never the files) and
whether each record is in BrokerVerse by legacy number; the result is kept in `generated_reports` (code
`migration-document-names`) for its workbook.

## Per-record audit

An importer calls `ctx.record({ entity, table, id, key, action: 'created' | 'updated', before, after })` for each
record it creates or changes. The row keeps the record; the load writes one audit entry per record (`migrate-create`
/ `migrate-update`, after carrying `batchId`, `loadNumber`, `legacySystem`) with `auditMany` before it commits. A
validation and a failed load write none.

## Numbering collision check

`seriesShapes(code)` gives every form a series issues from the cutover date (or today) to the end of the year after:
one per period and, with `{BRANCH}` / `{LOB}` in the pattern, per active branch and line of business. A legacy number
of a form at or above that form's next number is refused (`seriesClash`); `collidingNumbers(code)` lists the stored
numbers a series would issue again, and the Numbering sheet refuses a next number that would. `cocClash` and
`cocCollisions` do the same for migrated COC numbers against the COC series of their insurer.

## Adding an object

Write its sheet (contract in `common.js`) in `configuration.js` or `migration.js`, add it to the sheet map there and
declare it in `registry.js` with its module, `dependsOn` and duplicate rules. A sheet may add `pickStored(list, v)` (the
stored row of the same record when a key is shared), `duplicateSubject(ctx, v)` (what the duplicate rules need, such as
the resolved insurer), `existingRecord(ctx, code)` ("Use existing") and `keyGroup` (a key unique across several
sheets). `test/migration-registry.test.js` checks the kits.

## Tests

`go-live-workbench.test.js`, `go-live-roundtrip.test.js`, `migration-registry.test.js`, `migration-origin.test.js`,
`migration-audit.test.js`, `migration-numbers.test.js`, `migration-review.test.js`, `migration-duplicates.test.js`,
`migration-amounts.test.js`, `migration-pdc.test.js`, `migration-jobs.test.js`, `migration-approval.test.js`,
`migration-undo.test.js`, `migration-lock.test.js` (fixtures `migration.fixtures.js`), `reset-transactions.test.js`. The
suites that load at once set the cutover date and switch the approval of loads off with `goLiveSetup` and wait for the
validation job with `validatedBatch` (`test/helpers.js`).
