# Data load (go-live workbooks)

Loads a broker's go-live data from two Excel workbooks and keeps the history of every load: the **configuration** kit
(everything needed to run new business, promoted from one environment to the next) and the **migration** kit (the open
business of the legacy system at cutover). It also compares the configuration of two environments. API under
`/api/data-load` (`read:data-load`, `write:data-load`; `approve:data-load` for the second-person approvals of the Data
Migration & Go-Live workspace). The administrator guide is `docs/onboarding/GO_LIVE_DATA_WORKBENCH.md`.

## Files

| File | Content |
|---|---|
| `registry.js` | The objects of both kits (REG-1 contract of the master data upload design plus the migration attributes: `kit`, `channels`, `promotable`, `origin`, `duplicateRules`), their `dependsOn` and the load order (topological sort, declared order among independent objects). `kitObjects(kit)` gives the sheets of a kit in load order |
| `configuration.js` | Sheets of the configuration kit: the generic masters (`masterSheet`) and `CONFIGURATION_SHEETS` (settings, users, chart of accounts, commission rates, premium taxes, LGU rates, authority limits, numbering, payee bank accounts, COC series) |
| `migration.js` | Sheets of the migration kit (`MIGRATION_SHEETS`: clients, policies, open items, open claims, opening balances) and the reconciliation of a migration load |
| `service.js` | Batches: upload, dry-run validation (one rolled-back transaction, a savepoint per row), load (one transaction), errors, history; the per-record audit of a load |
| `workbook.js` | Workbook builder and reader, errors and reconciliation workbooks |
| `numbering.js` | Legacy numbers against the numbering series and the COC series |
| `compare.js`, `comparisons.js` | Environment comparison |
| `common.js` | Cell values, row errors, the sheet contract |

## Tables

- `data_load_batches`: one uploaded workbook. `load_number` (computed: `MIG-`, `CFG-` or `UPL-` and the id, never
  reused), `kit`, `status`, `legacy_system`, counts, result per sheet, reconciliation, who and when; the approval, undo,
  timing and job columns of migration 0440 for the workspace.
- `data_load_rows`: the rows read, their result and errors, and the record each row created or changed
  (`record_table`, `record_id`, `record_key`).
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
declare it in `registry.js` with its module and `dependsOn`. `test/migration-registry.test.js` checks the kits.

## Tests

`go-live-workbench.test.js`, `go-live-roundtrip.test.js`, `migration-registry.test.js`, `migration-origin.test.js`,
`migration-audit.test.js`, `migration-numbers.test.js`, `reset-transactions.test.js`.
