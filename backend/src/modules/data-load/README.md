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
| `reconciliation.js` | Reconciliation tab: lines counted on the records of the loads, legacy figures (Control Totals sheet, screen, upload), checks and sub-ledger tie-outs, differences, tolerances, acceptance, sign-off, the signed PDF kept with its SHA-256, superseded reconciliations, the PDF and XLSX report |
| `reconciliationRoutes.js` | Routes of the reconciliation and of the SAP opening file (declared on the router of `router.js`) |
| `sapOpening.js` | The one-time SAP opening file of the opening balance journal: request, approval by another user (after the lock), generation once |
| `workbook.js` | Workbook builder and reader (per-object download, Lists, Instructions, the hidden Control sheet), errors and reconciliation workbooks |
| `numbering.js` | Legacy numbers against the numbering series and the COC series |
| `runs.js` | Mock Runs tab: runs (Mock 1, Mock 2, dress rehearsal, extra mock, production), their checklist copied from the runbook, start, complete, cancel, timings, defects list, the run report (XLSX, PDF) |
| `cutover.js` | Cutover tab: checklist steps (start after the steps they depend on, done with evidence, block, skip, edit), the runbook template, defects |
| `decisions.js` | Go / No-Go: decisions with their approvers, criteria copied from the template, automatic checks (`AUTO_CHECKS`), waivers, voting and outcome |
| `evidence.js` | Evidence files of runs, steps, reconciliations, decisions and defects (storage folder `go-live-evidence`) |
| `evidence-pack.js` | The evidence pack of a run (ZIP with `manifest.csv`), built on download and masked for the user |
| `overview.js`, `hypercare.js` | Overview and Hypercare tabs |
| `runRoutes.js` | Routes of the overview, runs, checklist, defects, evidence, Go / No-Go and hypercare (declared on the router of `router.js`) |
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
- `migration_reconciliations` (0443; `recon_number` REC- and the id, `batch_ids`, `all_batches`, status `open`,
  `signed`, `superseded`, `report_file_key` / `report_sha256` of the signed PDF), `migration_recon_lines` (object,
  measure, group, legacy and BrokerVerse value, legacy source, tolerance and its reason, kind `measure` / `check` /
  `tieout`, accounts), `migration_recon_differences` (kind `measure` / `check` / `not-loaded` / `extra`, explanation,
  action, owner, status, acceptance), `migration_recon_signoffs` (slot, label, signer, remarks). Kept by the
  transaction reset.
- `sap_opening_file_requests` (0443): the request of the SAP opening file, its decision and the SAP GL run generated;
  one pending at a time; removed by the transaction reset with the journal it is about.
- `migration_runs` (0444; `run_number` RUN- and the id; kind, environment, cutover date, planned and actual times,
  status, result, exit criteria, personal data used and the DPO approval, restore point, evidence pack SHA-256 and
  archive reference; one production run that is not cancelled), `migration_run_steps` (the checklist: the runbook step
  copied with its owner, planned and actual times, status, notes, dependencies), `migration_run_defects` (`defect_number`
  DEF- and the id), `go_live_decisions`, `go_live_decision_criteria` (status, automatic result, evidence, waiver),
  `go_live_decision_votes` (the named approvers and their votes), `migration_evidence` (files of a run, step,
  reconciliation, decision or defect with their SHA-256). Kept by the transaction reset. `data_load_batches.run_id`,
  `migration_reconciliations.run_id` and `go_live_lock_requests.decision_id` are foreign keys from 0444.
- `go_live_runbook_steps` and `go_live_criteria` (0444, filled by `seeds/92_go_live_workspace.sql`): the templates
  copied into each run and decision; configuration kept by the reset.

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

## Reconciliation

`reconciliation.js` (Data Migration & Go-Live > Reconciliation). A reconciliation covers the loaded migration batches
of a run (`all_batches`: every one of them, refreshed on recompute; or the batches chosen) and counts the records of
those batches only (`load_batch_id = ANY(batch_ids)`): clients (by type), policies (by product and insurer, gross and
net premium, sum insured, expiring within 90 days), open items (by insurer and ageing bucket at the day before the
cutover), post-dated cheques (by cheque month), open claims (by product), opening balances (debit, credit, balance per
account on its normal side). Legacy figures: the Control Totals rows of the batches (summed), entry on screen
(`legacy_source` screen) or an upload of a Control Totals sheet (upload); screen and upload figures survive a
recompute. Check: trial balance debits = credits. Tie-outs (`migration.subledger_tieouts`, `saveTieouts`): source
`open-items` (GL opening balance of the accounts against the open items loaded; per insurer the open items loaded
against the Open Items open balance of the insurer), `pdc` (cheques loaded against the Post-Dated Cheques amount),
`listing` (GL opening balance against the Sub-ledger measure of the definition), `bank` (per bank account of
`bank_account_links`, against Sub-ledger cash in bank of the account) and `sap` (per account, against Sub-ledger sap
trial balance). The tie-out lines of `open-items` per insurer and of `pdc` take the legacy figure of their measure line
(`mirror`). Differences (`syncDifferences`): found again they keep their explanation and status, no longer found they
are fixed (an open one is dropped). Tolerance other than zero, acceptance and sign-off: approve:data-load and never a
user who uploaded, submitted or approved a batch of the reconciliation (`assertNotLoader`); one slot per user; signing
needs no open difference and every total with its legacy figure (status `missing`). The first signature freezes the
reconciliation; the last builds the PDF (`reportPdf`) once, stores it in `go-live-evidence` (`EVIDENCE_FOLDER`, refused
by `/api/s3/object` and the file delete) with its SHA-256. `afterBatchChange(batch, user)`, called by the load and undo
jobs and the direct load, supersedes the signed (or partly signed) reconciliations of the run with a new one (the screen
and upload figures and the tolerances carried over) and computes the open ones again; it never fails the load.

## Mock runs and the cutover checklist

`runs.js`, `cutover.js`. `POST /runs` creates a run and copies the active runbook steps (PC-1 to PC-8, CO-1 to CO-10,
GL-1, HC-1, HC-2) into its checklist; a production extract needs `dpoApprovalRef`; a second production run is refused
(unique index). A load names its run (`POST /batches` field `runId`, a planned or running run). Start sets the actual
start; complete needs the result, whether the exit criteria were met and a summary (refused while a load of the run is
in progress); cancel needs a reason (never the production run once go-live is locked). A completed run only takes its
evidence pack hash and archive reference; that hash must be the hash of a pack of the run downloaded from the workspace
(audit `migration_run` `evidence-pack`). Steps: start in a running run once every step of `depends_on` is done or
skipped; done needs an evidence file when the runbook names evidence (`evidence_hint`), or a note; CO-3 records or
needs the run's restore point; block and skip need a note; each move is a compare-and-set, audited
`migration_run_step`. Late: ended after its planned end, or still open past it. Defects: severity 1 to 4, the load and
step of the run. Report: `GET /runs/:id/report?format=xlsx|pdf`.

Evidence (`evidence.js`): `POST /evidence` (multipart `file`, `ownerType`, `ownerId`, `note`; the file type checked by
its signature) stores the file in `go-live-evidence` with its SHA-256; `GET /evidence/:id` is the only way out
(`read:data-load`, audited `download`); the uploader removes a file while the run is planned or running.

Evidence pack (`evidence-pack.js`, `GET /runs/:id/evidence-pack`): run report, every evidence file, per load its
summary, rows and errors workbooks (and the uploaded workbook for `write:data-load` with `view:pii`), the signed PDF and
the workbook of each reconciliation, the decisions, the lock requests and an audit extract (per-record entries of the
run's loads, go-live and migration settings changes, imports refused while locked), with `manifest.csv` (path, bytes,
SHA-256). Built while serving the download, so every workbook in it is masked for a user without `view:pii`; the ZIP's
SHA-256 is in `X-Content-SHA256` and in the audit trail.

## Go / No-Go

`decisions.js`. A decision of a run names at least `migration.go_live_min_approvers` approvers (active, holding
`approve:data-load`, one with the role Finance Head, not the creator) and copies the active criteria. Automatic
criteria (`auto_check`): G2 `production-load` (a loaded migration load of the run; none of them with a row in error, an
unresolved duplicate or valid rows only), G3 `reconciliation-checks` (the latest reconciliation of the run that is not
superseded: every check and tie-out line matched, or each of its differences accepted), G4 `reconciliation-signed`, G6
`environment-mirrored` (latest comparison), G7 `users-ready` (no active seeded account but the first administrator, no
active user with role `tis-superid`, `security.password_sign_in_enabled` off), G8 `numbering` (`collidingNumbers` of
the client, policy, invoice and claim series over every form, and `cocCollisions`), G9 `restore-point` (CO-3 done with
an evidence file, the run's restore point), G11 `evidence-archived` (the pack hash, matching a download, and the
archive reference). They are computed when the decision is created, on refresh (draft) and when voting opens; a waived
criterion found met becomes met. Manual criteria are set met or not met with their evidence (`write:data-load`). A
waiver needs `approve:data-load`, a reason, a waivable criterion (G2 to G5 are not) and another user than the creator.
Voting opens when every criterion is met or waived; each named approver votes once; all Go: `go`; one No-Go: `no-go`
at once, with the reason, actions and new date given in that vote. One decision in draft or voting per run. The lock
reads the latest Go decision of the production run (`golive.js` `lockConditions`).

## Overview and hypercare

`GET /overview` (`overview.js`): phases (Templates, Mock 1, Mock 2, Dress rehearsal, Cutover, Go-live, Hypercare), the
current run (production, else the latest open run) with checklist progress, reconciliation and decision, loads by status
and rows by result, open defects of severity 1 and 2, and what waits for the user (loads, undos and lock requests to
approve that are not their own, votes, steps they own). `GET /hypercare` (`hypercare.js`), once go-live is locked, for
`migration.hypercare_days`: business issued since the cutover date, migrated open items collected, renewals of migrated
policies due in 60 days, endorsements, claims and cancellations on migrated policies, edits to migrated records after
the lock (audit entries other than `migrate-*`), daily checks (trial balance, sub-ledger tie-out of the month-end check,
yesterday's SAP GL file, numbering, lock), imports refused while locked, unlocks, open defects of the production run.

## Retention

`jobs/housekeeping.js` `dataLoadRetention`: the batch record always stays. Rows and the uploaded workbook of a loaded or
undone migration load of the production run are kept `migration.evidence_retention_years` after `golive.locked_at`
(for ever while go-live is not locked or the setting is 0); those of every other finished load (failed, rejected,
withdrawn, expired, loaded, undone) go after `housekeeping.data_load_rows_days` and `housekeeping.data_load_files_days`.
A load validated, waiting or in progress is never touched. Each purge is audited (`purge-rows`, `purge-file` with the
file's SHA-256). Runs, checklists, decisions, reconciliations and evidence files are not purged.

## Opening balance journal and the SAP opening file

`period-end/opening.js` writes, with every opening balances set (the Opening Balances sheet and the single-object
import), its opening balance journal: series `opening_journal` (`OBJ-<year>-<n>`), status `opening`, source
`go-live-opening`, origin migrated, legacy number = the load number, totals of the set, **no journal lines**. The
migration load writes its `migrate-create` audit entry (entity `journal_voucher`); an undo removes it and writes the
journal of the set it restores. It is read-only (`accounting/lib/ledger.js` `assertNotOpeningJournal`: post, reverse,
cancel; `journal-vouchers` approve, reject, reversal, correction), shown with the lines of its set
(`openingJournalLines`), ignored by `ensureCalendar` and refused in `reports.trial_balance_statuses`
(`system-settings/service.js` `localizationErrors`). Nothing that sums journal lines can count it; the SAP GL daily file
selects posted journals and never carries it.

`sapOpening.js`: when `migration.sap_gl_include_opening` is on, a holder of write:data-load requests the SAP opening
file with a reason, another user with approve:data-load approves it after the go-live lock; the approval marks the
journal sent (`sap_exported_at`, compare-and-set) and writes the file (`sap-gl/service.js` `exportOpening`, a run of
trigger `opening`, `_OPENING` in the file names) in one transaction. A second file is refused, and so is a change of the
set behind it (`writeOpeningJournal`).

## Migrated business in the figures

Dashboards (`dashboard/service.js`: `dashboardOrigin`, `issuedSinceGoLive`), incentives (`incentive/service.js`
`achievement`), commission (`commission/service.js` `onPolicyPremiumCollected`, `dashboard`), the production register,
premium by product, new business vs renewals and dealer production reports (Origin column, criteria and filter) and the
Report Builder (Origin column) read `origin` (`lib/origin.js` `kpiOriginWhere`). Rules and settings:
`docs/onboarding/GO_LIVE_DATA_WORKBENCH.md`, *Migrated business in the figures*.

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
`migration-undo.test.js`, `migration-lock.test.js`, `migration-reconciliation.test.js`, `migration-opening-journal.test.js`,
`migration-kpis.test.js`, `migration-runs.test.js`, `migration-decision.test.js`, `migration-retention.test.js`,
`migration-pii.test.js` (every GET route of the workspace masked or listed with the reason), `migration-hypercare.test.js`
(fixtures `migration.fixtures.js`), `reset-transactions.test.js`. The
suites that load at once set the cutover date and switch the approval of loads off with `goLiveSetup` and wait for the
validation job with `validatedBatch` (`test/helpers.js`).
