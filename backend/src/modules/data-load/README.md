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
| `service.js` | Batches: upload, dry-run validation (one rolled-back transaction, a savepoint per row), the result of each row, duplicates and their resolutions, load (one transaction), errors, review, history; the per-record audit of a load |
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
`migration-amounts.test.js`, `migration-pdc.test.js`, `reset-transactions.test.js`.
