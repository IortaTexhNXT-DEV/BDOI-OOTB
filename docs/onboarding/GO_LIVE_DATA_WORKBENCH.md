# Go-Live Data Workbench

For the System Administrator and the migration lead. The workbench (**Master > Go-Live Data Load**) loads a broker's
go-live data with two Excel workbooks instead of one upload per object:

| Kit | Workbook | Content |
|---|---|---|
| `configuration` | `GoLive_Configuration_Workbook.xlsx` | Everything needed to run new business: company, system settings, location masters, branches, departments, hierarchy, designations, users, currencies, exchange rates, chart of accounts, banks, bank accounts, signatories, transaction codes, write-off reasons, insurers, lines of business, products, policy types, covers, vehicle brands / models / variants / vehicles, commission rate matrix, premium taxes and charges, LGU tax rates, authority limits, document numbering |
| `migration` | `GoLive_Migration_Workbook.xlsx` | The open business of the old system at cutover: clients, in-force policies on one sheet per kind of product (legacy numbers kept), open premium receivables, post-dated cheques on hand, open claims, GL opening balances, and the control totals of the legacy system |

The step-by-step set-up and the controls around the migration are in `GO_LIVE_DATA_SETUP.md` and the TISPH Data
Migration and Cutover Plan (`docs/TISPH/pack/TISPH_Data_Migration_and_Cutover.docx`); the workbench replaces the
one-off uploads they list for these objects (the single uploads stay available).

## Workbook layout

Each workbook has the sheets **Instructions** (load order with what each sheet comes after, rules, cutover date rule,
the result words of a validation, the duplicate checks, the products of each policy sheet, new versus migrated data, the
document file naming convention, what is entered on screen, every column), **Lists** (allowed values; the object sheets
have drop-downs that point here: insurers, the products of each policy sheet, branches, distribution channels, vehicle
brands and types, plans, travel plans, currencies, banks, document types ...), one sheet per object in load order and a
hidden, protected **Control** sheet: kit, objects, layout version (a hash of the column keys), environment, content
(blank or current data), generated at and by. A file whose Control sheet names the other kit, or a layout that is no
longer the current one, is refused ("download the template again"); a file without a Control sheet (made by hand,
downloaded before it existed) is read by its headers. The Control sheet only identifies the file: what a user may load
comes from the user's permissions.

- Row 1: headers, navy fill with white bold text. Required columns end with ` *`. Column order does not matter.
- Row 2: a sample row (amber, italic). A row whose first cell starts with `SAMPLE` is never loaded.
- Data from row 3. Cells are formatted as text so Excel keeps codes and dates as typed. Dates `YYYY-MM-DD`.

Download from the screen (**Download Template**: *Blank template* or *Current data*) or
`GET /api/data-load/kits/:kit/template[?prefill=true][&objects=policies-motor,open-items]`: the whole kit or only the
objects named (with the Instructions, Lists and Control sheets). The current data is masked for a user without
`view:pii`. The blank workbooks are also generated offline into `docs/package/05_Delivery/Upload_Templates` by
`backend/scripts/build-upload-templates.js`.

## Upload, validate, fix, load

1. **Upload and validate** (`POST /api/data-load/batches`, multipart `file` and `kit`). The workbook becomes a load
   batch (`data_load_batches`, its rows in `data_load_rows`); the file is kept as uploaded, with its SHA-256. Validation
   is a dry run: every sheet runs through its importer in load order inside **one database transaction that is rolled
   back**. Cross-sheet references therefore validate as they will load: a policy may refer to a client and an insurer
   added by the same workbook. Validation, load and undo run as **background jobs**: the request answers 202 with the
   batch (status `validating`) and its job, and the screen follows `GET /api/data-load/batches/:id` (progress: the sheet,
   rows done and total; the place in the queue, "Queued behind MIG-000012").
2. **Result of each row**: **New** (the key is not stored: the row creates a record), **Changed** (the key is stored
   with other values: the changed columns, old -> new), **Unchanged** (equal to the stored record), **Duplicate** (the
   row would create a record that matches another one by a duplicate check, below: loadable only once resolved) or
   **Error**. The batch counts each (`rowsNew`, `rowsChanged`, `rowsUnchanged`, `rowsDuplicate`, `rowsError`); the
   review lists the rows with their result, changes, duplicates, errors and warnings
   (`GET /api/data-load/batches/:id/rows?sheet=&result=&search=`, masked for a user without `view:pii`). Per sheet:
   rows read, valid, with errors, held, duplicates, and new / changed / unchanged / for approval / ignored.
   Each error has its sheet, row number, column and message (`GET /api/data-load/batches/:id`). A sheet that loads all
   or nothing (Opening Balances) and fails as a whole lists the real errors on their rows plus **one message for the
   sheet** (row empty, "Sheet" on the screen); its other rows are counted as *held* (not loaded, no error of their
   own). Informational notes (e.g. zero-balance rows ignored) are in the batch message shown above the counts.
3. **Download errors** (`GET /api/data-load/batches/:id/errors`): a workbook in the same layout with only the rows in
   error and the unresolved duplicates ("Duplicate: Same TIN as C-000881 (Maria Santos), BrokerVerse") and an
   **Errors** column. Correct those rows and upload the file again (or the whole corrected workbook). For a
   sheet that failed as a whole the workbook has all its rows (it is uploaded again as a whole): the real errors on
   their rows, the sheet message on the first row (`Whole sheet: ...`), an empty Errors cell on the held rows.
4. **Submit** (`POST /api/data-load/batches/:id/submit`): allowed when the latest validation has no error and no
   unresolved duplicate, the cutover date and the value maps have not changed since (otherwise "validate again"), or with
   *Load valid rows only* (`validRowsOnly: true`). The approvers (`approve:data-load`) are notified and see the load in
   My Work. The submitter may **withdraw** it.
5. **Approve or reject** (`POST /api/data-load/batches/:id/approve`, `/reject`): by a holder of `approve:data-load` who
   is neither the uploader, the submitter nor a user who resolved one of its duplicates (403 otherwise; this rule does
   not depend on `finance.maker_checker_enabled`). What is approved is the batch as validated: the approval is refused
   when the stored file is not the file validated (SHA-256), or the value maps or the cutover date changed since
   ("validate again"). Approve starts the load as a job with the approver as the user who loads (202). A load waiting
   longer than `migration.approval_expiry_hours` (72) expires. Reject takes a reason of the Reason Codes master (context
   *data_load_reject*: Wrong file, Control totals differ, Duplicates not resolved, Not authorised, Other) and remarks.
   A rejected, withdrawn, expired or failed load is validated again before it is submitted again.
6. **Load**: one transaction; if a row fails now because the data changed since the validation, nothing is saved and
   the errors are recorded. A load that stops (deployment, restart) saves nothing either: the batch shows *Interrupted:
   nothing was saved* (status failed; validate, submit and approve again). The load is written to the audit trail and the
   submitter is notified. Two approvals of the same load start it once (the second gets 409 "Load MIG-000012 is already
   running"). After a load of the valid rows only, the rows left out keep their errors: the batch still lists them and
   **Download errors** still gives them, to fix and upload again. The direct load in the request
   (`POST /api/data-load/batches/:id/load`, new users' temporary passwords returned once) is refused while
   `migration.load_approval_required` is on, and always in production and pre-production: it is the path of the
   rehearsal (`npm run rehearsal:golive`) on a test environment.
7. **History** (`GET /api/data-load/batches?kit=&status=&runId=&from=&to=`): load number, status (`validating`,
   `validated`, `failed`, `pending-approval`, `rejected`, `withdrawn`, `expired`, `running`, `loaded`, `undo-pending`,
   `undoing`, `undone`), who uploaded, submitted, approved, loaded and undid it, when, counts and timings; open a batch
   to see its result again. Every batch has a **load number** that never changes and
   is never reused: `MIG-000012` for the migration workbook, `CFG-000045` for the configuration workbook
   (`data_load_batches.load_number`, migration `0440_migration_origin.sql`). A migration upload may name its **legacy
   system** (field `legacySystem`, e.g. "TISPH Excel"); without it the setting `migration.legacy_system_name` applies.

### Natural keys

Every sheet upserts on a natural key, so loading the same or a corrected workbook again updates and never duplicates;
rows equal to the stored data are reported as unchanged and not written. A workbook downloaded with **Current data**
and uploaded unchanged into the same environment reports every row unchanged (0 new, 0 changed), also after it was
opened and saved in a spreadsheet program: cell text is compared trimmed, with line breaks as `\n` and Unicode in
composed form, and the reader decodes numeric character references (`&#8211;`, written by e.g. openpyxl for every
character outside ASCII) and Excel's `_x000D_` escapes. A master reference shared by several records (two states
named Cebu in two countries) is written as the referenced record's code, so the row's key names one record.

| Sheet | Key |
|---|---|
| Masters | the first unique key of the master type (company code, branch code, insurer code, ...; brand + model for vehicle models) |
| Settings | setting key |
| Users | username |
| Chart of Accounts | account code |
| Commission Rates | insurer + product + line of business + policy type + effective from |
| Premium Taxes, LGU Rates | code |
| Authority Limits | transaction type + role |
| Numbering | series code (series are fixed by the system; the sheet updates them) |
| Clients | legacy client code |
| Policies - Motor, CTPL, Personal Accident, Credit Life, Travel, Fire, Other Lines (and the single Policies sheet of the earlier layout) | legacy policy number, unique across the policy sheets ("Same policy number as Policies - Motor row 14") |
| Open Items | policy number + bill reference |
| Post-Dated Cheques | drawee bank + cheque number |
| Control Totals | object + measure + group (never loaded) |
| Open Claims | legacy claim number |
| Opening Balances | account code (the sheet loads all or nothing and replaces the earlier load of the same cutover date) |

A stored record changed by the workbook is **Changed** for clients, configuration objects, opening balances (the
sheet replaces the set) and open items (due date, original amount, open balance) while nothing has touched the item in
BrokerVerse (a receipt, a post-dated cheque, a credit, a collection action); a migrated policy or claim is changed by a
load only when a migration load created it, nothing hangs on it yet (endorsements, claims or bills issued in
BrokerVerse, receipts, renewals, deposited cheques, a CTPL authentication sent to the LTO; for a claim its history,
settlement movements, letters of authority or documents) and go-live is not locked. Otherwise the row is an error:
"Policy PC-MLY-2026-000101 was changed after it was loaded (endorsements): undo load MIG-000012 or correct it on the
policy screen". The change of a policy re-derives its premium taxes and is audited before / after.

A cell sent back **masked** (with `**`, as a user without `view:pii` downloads it) keeps the value stored in BrokerVerse
and the row warns "Email: not changed (masked)"; a masked value in a key or in a column a duplicate check reads (TIN,
birth date, names, plate, COC ...) is an error: enter the full value.

The batch keeps the **SHA-256** of its file: an upload of the same file as a batch of the same kit that is loaded or
waiting for approval is reported on the batch ("Same file as MIG-000012 (Loaded)", `sameFileAs`); its rows come out
Unchanged.

### Promotion between environments

Configuration moves Dev -> SIT -> UAT -> Pre-Prod -> Production with the same workbook: download **Current data** in
the source environment and upload it into the target. Rows equal to the target are skipped, differences update it,
missing records are created. Exported settings are those of Master > Configuration (editable, not owned by another
screen, not under the second-user approval of Account Determination); the cutover date, the go-live lock and the
settings of the Go-Live tab are never exported or loaded.

## Compare environments

Proves that configuration and masters are mirrored between environments (Dev -> SIT -> UAT -> Pre-Prod -> Production)
and shows exactly what differs. **Master > Go-Live Data Load > Compare environments** (permission `read:data-load`).
Comparing never loads anything and writes no business data; only the result is kept (`data_load_comparisons`,
migration `0247`) and the comparison is recorded in the audit trail (`data_load_comparison`, action `compare`).

| Compare | What is compared |
|---|---|
| **File vs this environment** | the configuration workbook exported (**Current data**) from another environment, against this environment's current data (the same export, read only) |
| **File A vs file B** | two exports against each other, e.g. UAT and Production exports compared offline by an auditor; this environment is not read |

Rows are matched on the natural keys of the workbench (table above) and every column of the configuration workbook is
compared in its comparable form (dates, numbers, Yes / No, lists of roles or lines without order, codes without case).
Each row is one of:

| Result | Meaning |
|---|---|
| Identical | the same row on both sides |
| Different | the key is on both sides with field-level differences: column, value in the file, value here |
| Only in the file (A) | the row would be new here (missing from this environment / file B) |
| Only here (B) | the row is here but not in the file (missing from the other environment) |

A sheet missing from a file counts as an empty sheet (its rows are *only here*); a column missing from a file is not
compared (noted on the sheet). The verdict is **Mirrored** when no row differs and no row is on one side only, else
**Differences found**.

**Environment-specific fields** legitimately differ between environments. They are listed in a separate
*environment-specific* section with both values and never count as a difference
(`ENVIRONMENT_SPECIFIC` in `backend/src/modules/data-load/compare.js`):

| Field | Why it may differ |
|---|---|
| Settings holding a URL or host (a key part `url`, `uri`, `host`, `hostname`, `domain`, `endpoint`, `callback`, `webhook`, `origin`: `general.frontend_url`, `policy.payment_gateway_url`) | every environment has its own addresses |
| E-mail sender settings (`notification.from_address`, keys ending `from_address`, `from_name`, `from_email`, `reply_to`, `mail_from`, `sender…`, `smtp…`) | test environments send from their own address |
| Payment gateway modes (`payments.gateway…`, keys with `sandbox`, `live_mode`, `test_mode`, `gateway…mode`) | gateways run in sandbox outside Production; the gateways and their credentials are on Master > Finance > Payment Gateways, not in the workbook |
| Settings naming the environment (a key part `environment` or `env`) | they name the environment itself |
| Settings: Description column | reference text, never loaded |
| Numbering: Next Number | counters move with each environment's business. Switch on **Include numbering counters** (`includeNumbering=true`) to compare them as ordinary fields |
| Any column whose key ends in `url`, `uri`, `host`, `hostname`, `endpoint`, `webhook`, `callback` | addresses |

The go-live settings (cutover date, lock) and secrets are never exported, so never compared: each environment sets its
own cutover date on the Go-Live tab.

**On screen.** Choose *File vs this environment* or *File A vs file B*, the file(s) and *Include numbering counters*,
then **Compare only**. The result shows the verdict, counts (identical, different, only in the file, only here,
environment-specific), a summary per sheet, the rows with their field-level differences (filters: sheet, result,
search; expand a row for column / value in the file / value here), the environment-specific values and the earlier
comparisons. **Download comparison** gives the comparison workbook:

- **Summary**: per sheet the rows on each side, identical, different, only in the file, only here, environment-specific
  and the result; the line *All sheets* and the overall verdict (*Mirrored* or *Differences found*); the files and the
  environment compared;
- one sheet per object: its rows (differences first) and a **Difference** column (*Identical*, *Only in File*, *Only in
  This environment*, or *Different: Column: File "x" / This environment "y"*); rows only in the file green, rows only
  here amber, changed cells highlighted;
- **Environment-specific** (sheet, key, column, both values, why) and **Rules** (the rules and whether they applied).

Headers navy (`0B2A4A`) with white bold text, frozen.

**API.**

| Call | |
|---|---|
| `POST /api/data-load/compare` | multipart `file` [, `fileB`], `includeNumbering` (`true` or `false`): compares and returns the comparison (201, message *Mirrored* or *Differences found*) |
| `GET /api/data-load/compare` | comparisons made, newest first (paging) |
| `GET /api/data-load/compare/:id` | verdict, totals, counts per sheet, environment-specific values, rules |
| `GET /api/data-load/compare/:id/rows` | rows with their differences; `sheet`, `status` (`different`, `only-in-file`, `only-here`, `identical`, comma list; default all but identical), `search`, paging |
| `GET /api/data-load/compare/:id/workbook` | the comparison workbook (XLSX) |

**Release pipelines.** `npm run compare:environments` (`backend/scripts/compare-environments.js`) downloads the
configuration export from two running APIs, compares them with the same engine and writes the comparison workbook;
nothing is uploaded to either environment.

```
SOURCE_API=https://uat.example/api TARGET_API=https://prod.example/api \
SOURCE_ADMIN_PASSWORD=... TARGET_ADMIN_PASSWORD=... \
COMPARE_OUTPUT=comparison.xlsx npm run compare:environments
```

`SOURCE_ADMIN_USER` / `TARGET_ADMIN_USER` (default `ADMIN_USER` or `BrokerVerse`, a user with `read:data-load`),
`SOURCE_FILE` / `TARGET_FILE` (a saved export instead of an API; one side must be an API), `INCLUDE_NUMBERING=yes`.
Exit code **0** mirrored (environment-specific differences only), **1** differences found, **2** the comparison could
not run (sign-in, network). The differing rows are printed; passwords never are.

## Rules

- **Permission.** `read:data-load` (download, history, compare environments), `write:data-load` (upload, validate,
  load) and `approve:data-load` (second-person approval of loads, undo, reconciliation sign-off, Go / No-Go and the
  go-live lock; never the maker of the same item). Default grants (migration `0440_migration_origin.sql` and the seed,
  to be confirmed by TISPH): System Administrator all three; TIS IT AppSupport / Admin read and write; TIS Finance &
  General Accounting, TIS Operations Unit Head and TIS General Manager read and approve; **TIS Audit (read only)**
  (`tis-auditor`, new) read only, with the audit trail. The segregation of duties rule *Load and approve migration
  data* (`SOD-ACC-LOAD-APPROVE`) flags anyone holding both `write:data-load` and `approve:data-load`; the named cutover
  administrators are recorded as exceptions until the end of hypercare.
- **Personal data.** `/api/data-load` is no longer answered unmasked (removed from `privacy.masking_exempt_paths` where
  the setting held the shipped list): the workbooks with current data, the errors workbook and the review of a batch
  (values and changes, old and new) mask TIN, birth date, e-mail and mobile numbers for a user without `view:pii`, as
  every other download. The rows of a batch keep the identifiers (TIN) of the workbook and of the stored values they
  change encrypted at rest (migration `0441_migration_value_maps.sql`), covered by the key rotation.
- **Users.** Passwords are never in a workbook. A new user gets a temporary password that the load returns once to the
  administrator (shown in a dialog, `Cache-Control: no-store`, never stored in the batch); the user changes it at the
  first sign-in. A load cannot change the administrator's own account; only a System Administrator can grant the System
  Administrator role. Segregation-of-duties rules apply as on the User screen.
- **Authority limits** are proposals: another administrator approves them on Master > Generals > User Management >
  Authority Matrix (maker-checker), as on the screen.
- **Numbering.** *Next Number* is the next sequence number of the current period (last number used in the old system
  plus one). It cannot go below a number already issued in the period. It is also kept on the series as the start of
  that period's counter (`document_numbering.period_start_key` / `period_start_number`, migration
  `0246_numbering_period_start.sql`; the same for **Set next number** on Master > Document Numbering): when the
  transaction reset (`SMOKE_TEST_AND_RESET.md`) deletes the counters, each series restarts at that number, not at 1.
  The Numbering sheet therefore need not be loaded again after the reset; loading it again reports it unchanged. With no
  number issued yet in the period (right after the reset) the next number may be corrected downwards. Other periods
  (next year of a yearly series) start at the series' start number.
- **Commission rates.** A Line of Business on the Commission Rates sheet must be a code of the Line of Business master
  (Lines of Business sheet or Master > Line of Business); a rate on an unknown line would never apply. The Commission
  Rate Matrix API (`POST` / `PUT /api/commission-rates`, the screen) applies the same rule: 400 with the field
  `lineOfBusiness` when the code is not in the master (checked on add and when the code changes).
- **Cutover date.** The first day of live transactions, set on *Data Migration & Go-Live > Go-Live*
  (`PUT /api/data-load/golive/cutover-date`, audited). The migration workbook is refused until it is set. It cannot
  change once go-live is locked, nor while a migration load is loaded or in progress (undo it first). `PUT /settings`,
  Master > Configuration and the Settings sheet refuse it, like the go-live lock and the settings
  `migration.load_approval_required`, `migration.*_include_migrated` and `migration.sap_gl_include_opening`, which an
  approver changes on the Go-Live tab (`PUT /api/data-load/golive/settings`).
- **Undo of a load.** A loaded migration load is undone before the go-live lock: requested with a reason
  (`POST /api/data-load/batches/:id/undo-request`, `write:data-load`), approved by another user (`/undo-approve`,
  `approve:data-load`; also `/undo-reject`, `/undo-withdraw`). It runs as a job in one transaction, the objects in
  reverse load order: what the load created is removed, the records it changed get their earlier values back, the
  opening balances it replaced are restored. It is refused while business entered since or a later load depends on
  its records: receipts, credits or collection actions on its open items, deposited cheques, endorsements, claims,
  renewals, documents, a CTPL authentication sent to the LTO, the policies, open items or cheques of a later load on its
  records, a later load that changed the same records or replaced its opening balances
  (`GET /api/data-load/batches/:id/dependents`, and `/dependents/workbook`). Undo the later load first. The check runs
  again inside the undo with the records locked. Number counters are not wound back. A configuration load is corrected
  by a new load.
- **Go-live lock.** Requested on the Go-Live tab by a holder of `write:data-load` and approved by another user with
  `approve:data-load` (`POST /api/data-load/golive/lock-requests`, `.../:id/approve`, `/reject`, `/withdraw`). It needs
  the Go decision of the production run, its reconciliation signed, its restore point recorded and no load waiting for
  approval, running or being undone. Once locked, every migration import answers 409 "Go-live is locked: migration
  imports are closed (locked on dd/mm/yyyy)", recorded in the audit trail: the migration workbook (upload, validation,
  duplicates, submit, approval, load), the undo of a load, the policies go-live upload
  (`POST /api/policies/bulk-upload`, `mode=go-live`), a file of the ordinary policy upload with rows issued before the
  cutover date (legacy business is loaded by the migration workbook), the open items import
  (`POST /api/receipts/opening-items/import`) and the opening balances import and validation
  (`POST /api/period-end/opening-balances/import`, `/validate`). Before the lock these three single-object imports also
  need `write:data-load`. The configuration workbook stays available for new masters; the transaction reset refuses
  to run.
- **Unlock.** The same two steps with the imports it reopens (migration workbook, policies go-live upload, open items
  import, opening balances import) and its hours (at most `migration.unlock_max_hours`, 4). Only the named imports
  reopen; the undo of a load and the reset stay refused. It relocks by itself when its hours run out (scheduled job
  *Go-live relock*, every 5 minutes). After `migration.unlock_window_days` (7) from the lock an unlock needs the
  reference of a steering committee decision.

### Migration rules

- Rows dated on or after the cutover date are refused: policy issue date, claim loss and reported dates, client birth
  date, cheque received date. Policies must be in force at cutover (expiry on or after the cutover date). Open claims
  are `registered` or `in-review`.
- **Amounts** are pesos as booked in the legacy ledger, with at most two decimals on every sheet ("Gross Premium has
  more than two decimals"): never rounded on loading, so the workbook totals (sums of the cells, centavo by centavo) and
  the BrokerVerse totals agree to the centavo. A foreign-currency policy (travel in USD) is loaded at its peso amounts
  and keeps *Original Currency*, *Original Sum Insured* and *Exchange Rate* in the policy document as reference; its
  currency stays PHP and nothing is revalued. An open item in another currency (*Currency* other than PHP) is an error.
- Opening balances are the trial balance of the old system at the close of the day before the cutover date. Debits must
  equal credits. The fiscal year of the cutover date must have no journal posted before it. A row with neither a debit
  nor a credit (or zero), an account whose movements net to zero, is accepted and ignored (counted as *ignored*, with
  a note in the batch message and `zeroBalanceRows` in the reconciliation totals); its account must still be in the
  chart of accounts. The sheet loads all or nothing: see *Result per sheet* above for how a failure is reported.
- Migrated records carry their **origin** and post nothing:

| Record | Origin and flags | Legacy number | Not created |
|---|---|---|---|
| Client | `origin = 'migrated'`, `legacy_system`, `migrated_at`, `migrated_by`, `load_batch_id`; `source = 'go-live-migration'` | client code | |
| Policy | as client; `doc.source = 'go-live-migration'`, `doc.loadBatchId`; insurer at 100% | policy number | bill, booking journal, commission accrual (policy migration mode of `issuePolicy`) |
| Open item | as client; receivable `source = 'opening'`, `go_live_date` = cutover; the old bill number as `bill_number` and `reference`; a collection item | bill reference | booking journal (the GL carries it in the opening balance) |
| Open claim | as client; `details.source = 'go-live-migration'`, a claim history line | claim number | acknowledgement e-mail, notifications, settlement journal |
| Post-dated cheque | as client; status `on-hand`, linked to its migrated open item | cheque number | receipt (created when the cheque is deposited after go-live) |
| Opening balance | `opening_balances.source_run = 'go-live:<cutover>'`, `load_batch_id` | | journal |

  A migrated CTPL policy also writes its CTPL authentication: status `authenticated`, method `manual`, LTO status
  `not-required`, the COC number and authentication code, the COC series whose range holds the number; it is never sent
  to the LTO. The COC can then never be issued again (unique index of the CTPL authentications), and a COC number in the
  range a COC series of the insurer has still to issue is refused.

  `migrated_by` is the user who uploaded the load. The single-object go-live imports tag their records the same way
  (without a load): the go-live policy upload (`POST /api/policies/bulk-upload`, `mode=go-live`: the policy and the
  client it creates) and the open items import (`POST /api/receipts/opening-items/import`), with the legacy system of
  the setting.

### Origin of the records

Every client, policy, receivable, claim, journal voucher and post-dated cheque has `origin` (`issued`: entered or
issued in BrokerVerse, the default; `migrated`: loaded from the legacy system), `legacy_system`, `legacy_number`,
`migrated_at` and `migrated_by` (migration `0440_migration_origin.sql`, which also back-filled the records migrated
before it from the flags above). `load_batch_id` exists on these tables and on `opening_balances` and
`ctpl_authentications`. Readers use `origin` through `backend/src/lib/origin.js`; the older flags are still written for
the reports and scripts that read them.

- **API.** Clients, policies, claims, collections, the open bills of a receipt (`/receipts/open-receivables`) and
  journal vouchers return an `origin` block on every row and detail:
  `{ kind: 'migrated', label: 'Migrated', legacySystem, legacyNumber, loadId, loadNumber, migratedAt, migratedByName }`
  or `{ kind: 'issued', label: 'Issued in BrokerVerse' }`; claims and collection items also carry `policyOrigin` and
  `policyLegacyNumber` of their policy. The lists filter on `?origin=issued|migrated` (`all` or empty for both).
- **Read-only.** The origin, legacy system and number, migration date and user and load cannot be changed after the
  load: an update that changes them is refused (400); a body that sends back the values it read is accepted.
- **Per-record audit.** A migration load writes one audit entry per record it creates (`migrate-create`, "migrated")
  or changes (`migrate-update`, "updated by migration load"), with the values before and after, the batch and its load
  number, in the load transaction (`auditMany`, `lib/audit.js`); the opening balances one entry per account. The record
  history shows it as its first event, from the channel *Data load* with the load number. A validation and a load that
  fails write none. Each row of the batch keeps the record it created or changed (`data_load_rows.record_table`,
  `record_id`, `record_key`).

## Policy sheets per product

| Sheet | TISPH products | Product columns (stored in the policy document) | Product checks |
|---|---|---|---|
| Policies - Motor | MOTOR | Plate Number, Conduction Sticker, Chassis Number, Engine Number, MV File Number, Brand, Model, Variant, Model Year, Body Type, Colour, Seating Capacity, Mortgagee / Financier, TFS Loan Reference, Dealer | plate, conduction sticker or chassis; model year of four digits, not after the year after the cutover; seating 1 to 60 |
| Policies - CTPL | CTPL | Plate Number, Conduction Sticker, Chassis Number, Engine Number, MV File Number, COC Number (required), Authentication Code, Vehicle Type, Brand, Model | plate, sticker or chassis; term at most 13 months; COC unique per insurer |
| Policies - Personal Accident | PA, GPA | Plan, Insured Persons, Beneficiary / Nominee, Occupation Class | Group PA at least 2 insured persons, PA one |
| Policies - Credit Life | CL-COMP, CL-VOL | Borrower Name, TFS Loan Account Number, Loan Amount (required), Loan Term in Months, Loan Release Date, Financier (TFSPH when empty) | loan amount > 0; term 1 to 120; expiry 31 days or more from release date + term is a warning; sum insured empty = loan amount |
| Policies - Travel | TRAVEL | Plan / Policy Type (TRV-ST, TRV-ANN, TRV-REN), Destination, Travel Start, Travel End, Travellers | travel dates inside the policy period; a single trip ended before the cutover is not in force |
| Policies - Fire | line fire | Risk Address, Occupancy, Construction Class | the sheet is in the workbook only while an active fire product exists (none in TISPH) |
| Policies - Other Lines | any other product (Parcel) | none | |

Every policy sheet has the common columns (policy number, client, insurer, product, dates, amounts, commission rate,
billing mode, payment status, Account Executive) and Branch, Distribution Channel, Business Type (New / Renewal in the
legacy term), Previous Legacy Policy Number, Legacy System and the original currency columns. A product on another
kind's sheet is an error ("Product CTPL goes on the sheet Policies - CTPL"). The product columns use the keys the
renewal reads, so the renewal of a migrated policy carries them (conduction sticker, TFS loan reference and dealer on
motor; plan, beneficiary, occupation class and destination on personal accident and travel; loan reference, amount and
term on credit life; risk address, occupancy and construction on fire); the dates of the expiring term (travel dates,
loan release date) are never carried. The single **Policies** sheet of the earlier layout is still read, for any
product, with a warning on the batch; it is no longer in the templates.

**Post-Dated Cheques**: Drawee Bank (Bank master code, or the bank name), Cheque Number, Cheque Date (on or after the
cutover date: a cheque dated earlier was deposited in the legacy system and stays on its bank reconciliation), Amount
(not more than the open balance left on the open item after the cheques already on hand), Policy Number and Bill
Reference of a migrated open item, Received Date (before the cutover; the day before when empty), Storage Location,
Drawee Branch. Loaded on hand, nothing posted; deposited after go-live on Accounts > Post-Dated Cheques, which creates
the official receipt. Deposited-but-uncleared legacy cheques are not loaded.

**Control Totals**: the figures of the legacy system at the close of the day before the cutover (Object, Measure, Group,
Legacy Value), validated (counts whole numbers, amounts two decimals), never loaded: the reconciliation compares them.

## Duplicate checks

Each check runs within the file (an earlier row) and against the records stored in BrokerVerse, whatever their origin
(setting `migration.duplicate_rules`, all on by default). The stored side is read once per validation, never one
query per row.

| Check | Objects | Match |
|---|---|---|
| Same TIN | Clients | the same TIN (letters and digits); compared with the stored, encrypted TINs through their blind index |
| Same name and birth date | individual clients | first and last name (case, spaces and Jr / Sr / II / III set aside, accents kept) and birth date |
| Same company name | corporate clients | the name without punctuation and Inc, Incorporated, Corp, Corporation, Co, Company, Ltd, OPC, Phils, Philippines, when one of the two has no TIN |
| Same vehicle in force | Policies - Motor, Policies - CTPL | plate, conduction sticker or chassis number on another policy of the same sheet in force over an overlapping period |
| Same COC number | Policies - CTPL | COC number of the same insurer, in the file, the CTPL authentications or a migrated CTPL policy |
| Policy number of another insurer | every policy sheet | the number of a stored policy of another insurer (the same insurer: an error) |
| Insurer name variant | every Insurer column | a value that is no code, name or short name of an insurer but equals one once punctuation and insurance, ins, assurance, co, corp, inc, phils ... are set aside |
| Same name | configuration masters | a new record whose name equals another record of the same master |

Resolve on the review (`POST /api/data-load/batches/:id/resolutions` with the row ids or a rule, the resolution and a
reason; `GET /api/data-load/batches/:id/duplicates?rule=` lists them with their matches); the batch is validated again:

- **Load as new**: the row loads as New; the reason stays on the row.
- **Use existing**: the row creates nothing. For a client check the legacy client code is mapped to the existing client
  (value map `client`), so the policies of this and every later batch attach to it; for an insurer variant the
  spelling is mapped to the insurer (value map `insurer`), so the row and every later row with that spelling load with
  it.
- **Load with insurer suffix** (policy number of another insurer): the policy is numbered `<number>/<insurer code>`
  (`SHARED-001/MALAYAN`); its legacy number keeps the number as printed, and the open items and claims of the workbook
  find it by the printed number when no other policy has it (by the full number otherwise).

A resolution holds while the next validation still finds the duplicate; an unresolved duplicate stops the load as an
error does.

## Value maps

The legacy code tables: per object (insurer, product, branch, user, channel, client, payment status, claim status,
vehicle type) a legacy value and the BrokerVerse code it stands for (`migration_value_maps`, migration
`0441_migration_value_maps.sql`). The importers translate a cell through the maps before the master lookup; spellings
that normalise alike ("Malayan Ins. Co., Inc.", "MALAYAN INS CO INC") share one map. Maintained with
`GET` / `POST /api/data-load/value-maps`, `PUT` / `DELETE /api/data-load/value-maps/:id`, downloaded and uploaded as one
sheet (`GET /api/data-load/value-maps/workbook`, `POST /api/data-load/value-maps/upload`, all or nothing); the code is
checked against its master; every change is audited. The maps are configuration: the transaction reset keeps them. A
batch remembers the version of the maps it was validated with and is validated again when a map changed since.

## Document file naming convention

Legacy documents are not migrated in bulk; they are named so that each file names its record, then attached on the
record screen when needed:

```
<RecordType>_<RecordNumber>_<DocumentType>_<YYYYMMDD>[_<n>].<ext>
RecordType    CLT client, POL policy, END endorsement, CLM claim, BIL bill
RecordNumber  the legacy number as loaded, / and spaces written as -
DocumentType  POLSCH, COC, OR, ID, ORCR, LOAN, ENDT, CLAIMFORM, POLICE, PHOTO, ESTIMATE, OTHER (setting migration.document_types)
YYYYMMDD      the document date; _<n> when several files share the rest of the name
ext           pdf, jpg, jpeg, png, tif, tiff
Example       POL_PC-MLY-2026-000101_POLSCH_20260225.pdf
```

`POST /api/data-load/document-names/check` (a list of names in an .xlsx or .csv, first column or a "File Name" column,
or a .txt one per line; never the files) gives each name valid or invalid with the reason, and whether its record is in
BrokerVerse by legacy number; `GET /api/data-load/document-names/check/:token/workbook` downloads the result (only for
the user who ran the check).

## New and migrated data side by side

- **Numbers.** Migrated records keep the numbers of the old system (client code, policy number, claim number, the bill
  number of an open item). New
  business takes the next number of its Document Numbering series, which the Numbering sheet sets. Both workbooks refuse
  a collision: the configuration workbook when a series' next number would issue a number that a migrated record of
  the same format already has, the migration workbook when a legacy number has the format of a series at or above the
  next number of its period (e.g. `CL-2026-00500` while the client series is at 1). Every form a series issues over the
  go-live window is checked: each period from the cutover date (or today, when earlier) to the end of the year after
  it, so `POL-2027-00001` is refused while the cutover is in 2026, because renewals issued from January 2027 draw from
  that period; and, when the pattern holds `{BRANCH}` or `{LOB}`, each active branch code and each line of business in
  use (`numbering.js` `seriesShapes`). Raise the next number above the legacy range first. `collidingNumbers` lists
  every stored number a series would issue again; `cocCollisions` lists migrated COC numbers (certificate of a migrated
  CTPL policy, CTPL authentication of a load) inside the range of a COC series of the same insurer at or above its next
  number.
- **Dates.** Opening balances are dated the day before cutover; every new transaction is dated on or after it.
- **Renewals.** Migrated in-force policies are ordinary active policies: the renewal queue picks them up as they near
  expiry. Policies expiring soon need no separate sheet; the reconciliation counts those expiring within 90 days. The
  renewal term is new business issued in BrokerVerse (`origin = 'issued'`, its own number, `renewed_from` = the
  migrated term): it does not carry the origin, legacy number, `go-live-migration` source or load batch of the
  expiring term.
- **Reports.** The policy API and lists show `source` and filter on it (`GET /api/policies?source=go-live-migration`)
  and on `origin`; `load_batch_id` ties every migrated record to its batch.
- **Open items** keep the bill number of the old system (*Bill Reference*) as their bill number, under the same
  rule as the other legacy numbers: a bill number with the format of the invoice series at or above its next number
  (e.g. `INV-2026-00004` while the series is at 1) is refused until the invoice series' Next Number is raised above it
  (Numbering sheet). Only when another bill already carries that number (one debit note over several policies) does the
  open item get the next number of the invoice series; the old number is then kept as the bill's `reference` and shown
  with the bill number (`oldBillNumber` in `GET /api/receipts/open-receivables`, `GET /api/collections` and the policy
  payment screen; "INV-2026-00011 (old system DN-OLD-77)" on the Add Receipt bill list and the billing statements),
  and the receipt allocation search (`GET /api/receipts/open-receivables?search=`) and the bill statement
  (`/api/billing-statement/bills/:id/generate`) find the bill by it. The policy billing statement lists migrated open
  items.
- **Money.** Open items are collected with normal official receipts. Amounts due to insurers and commission payable
  are in the opening balances and paid with payment vouchers (Accounts > Disbursement).

## Reconciliation

Every validation and load of the migration workbook computes, inside the transaction, the control totals the broker
compares with the old system (`batch.reconciliation`; download: `GET /api/data-load/batches/:id/reconciliation`):

- per sheet: rows in the workbook and their totals (gross and net premium, sum insured, open balance, cheques on hand,
  claim estimate, debits and credits; the policy sheets add up to one Policies line) and the records and totals in
  BrokerVerse after the load (all migrated records);
- checks: trial balance debits = credits; premiums receivable control account (`accounting.account.premium_receivable`)
  opening balance = total open balance of the open items of the cutover date.

## Load history and the transaction reset

The transaction reset keeps the load history (`data_load_batches`, `data_load_rows`, `data_load_comparisons`) as the
evidence of the mock runs: the loaded migration batches, whose records the reset removes, and their rows are marked
`undone` with the reason "transaction reset" (`scripts/lib/table-classification.js`, action `mark-reset`). Batch
statuses also include the approval and undo states of the Data Migration & Go-Live workspace (`pending-approval`,
`rejected`, `withdrawn`, `expired`, `running`, `validating`, `undo-pending`, `undoing`, `undone`).

## Go-live rehearsal

`npm run rehearsal:golive` (`backend/scripts/golive-rehearsal.js`) rehearses the whole sequence between two running
environments, SOURCE (configuration and business data, e.g. UAT) and TARGET (the environment going live, e.g. Pre-Prod):
configuration promoted with three deliberate errors, smoke test and transaction reset, migration workbook filled from
SOURCE's open book at cutover - 1 with injected errors and the reconciliation against SOURCE, new and migrated business
side by side, the go-live lock, and the promotion check. After the configuration load, step 2 runs **Compare
environments** on TARGET with the SOURCE export: it must be *Mirrored*, the only differences being environment-specific
(the cutover date set on TARGET); the comparison workbook is saved with the other workbooks of the run. Its run log is `docs/e2e/GOLIVE_REHEARSAL_RUN.md`; the
environment variables are in the header of the script. It changes TARGET (reset included, `CONFIRM_RESET=yes`), so
never point it at a live database.

## Not in the workbooks

Entered on screen (also listed on the Instructions sheet): roles and permissions; segregation of duties, delegations,
access reviews; approval of authority limits; tax codes; account determination and posting rules; bank statement,
bank transaction type and insurer statement formats; close checklist; product templates, rating and the motor tariff;
package bundles; payment gateway credentials; the brand pack (name, logo, colours: `BRAND_PACK`); company logo files; schedules;
fiscal years and periods; remittance masters, reinsurance, incentive programs; referrer accounts; petty cash funds.

Not migrated: premium due to insurers and commission due to referrers (opening balances, then payment vouchers);
direct-bill commission receivable (opening balance, cleared by journal voucher); co-insurance participants (added on the
policy screen); expired and closed business; leads and quotations (their own bulk uploads); unreconciled bank items;
documents of the old system.

## How the dry run works (technical)

`backend/src/db/pool.js` keeps an ambient transaction in an `AsyncLocalStorage`: inside `runInTransaction(fn,
{ rollback })` the helpers `query`, `one`, `many` and `pool.query` run on the transaction's client, and
`withTransaction` opens a `SAVEPOINT` on it instead of a new connection (sibling savepoints are serialised so they nest
correctly). Outside an ambient transaction nothing changes. Each row of a workbook runs in its own savepoint, so a
failing row is undone alone and the next rows carry on. A transaction-level advisory lock serialises validations,
loads and undos; a job waiting for it shows the load it waits behind. The job's transaction has the statement and idle
limits of `migration.job_statement_timeout_minutes` (60), so a stuck statement cannot hold the lock. The scheduled job
*Data load sweep* (every 5 minutes, and at start-up) marks a load whose job stopped, or wrote no progress for
`migration.job_stale_minutes` (15), as interrupted; a data load job is never run twice.
`getSetting` reads through the transaction and bypasses the settings cache inside it; the settings and letterhead
caches are cleared after every dry run and load. Sequence counters advanced during a dry run are rolled back with it.

Code: `backend/src/modules/data-load` (`registry.js`: the objects of both kits, their dependencies and load order;
`configuration.js`, `migration.js`, `products.js`: the sheets; `workbook.js`: templates, reading, errors and
reconciliation workbooks; `service.js`: batches, dry run, result of each row, duplicates and resolutions, load,
per-record audit, review; `jobs.js`: the jobs and the sweep; `approval.js`: approval of loads and undo; `undo.js`: undo
and its dependents; `golive.js`: cutover date, lock and unlock; `duplicates.js`: the duplicate checks; `maps.js`: value maps; `naming.js`: the document file
naming check; `numbering.js`: the collision check), `backend/src/lib/origin.js` (origin filter, block and read-only
rule). Module description: `backend/src/modules/data-load/README.md`. Tests: `backend/test/go-live-workbench.test.js`,
`go-live-roundtrip.test.js`, `migration-registry.test.js`, `migration-origin.test.js`, `migration-audit.test.js`,
`migration-numbers.test.js`, `migration-review.test.js`, `migration-duplicates.test.js`, `migration-amounts.test.js`,
`migration-pdc.test.js`, `migration-jobs.test.js`, `migration-approval.test.js`, `migration-undo.test.js`,
`migration-lock.test.js`.
