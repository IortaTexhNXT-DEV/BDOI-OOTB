# Data Migration & Go-Live

For the System Administrator and the migration lead. The workspace (**Master > System Configuration > Data Migration &
Go-Live**) loads a broker's go-live data with two Excel workbooks instead of one upload per object:

| Kit | Workbook | Content |
|---|---|---|
| `configuration` | `GoLive_Configuration_Workbook.xlsx` | Everything needed to run new business: company, system settings, location masters, branches, departments, hierarchy, designations, users, currencies, exchange rates, chart of accounts, banks, bank accounts, signatories, transaction codes, write-off reasons, insurers, lines of business, products, policy types, covers, vehicle brands / models / variants / vehicles, commission rate matrix, premium taxes and charges, LGU tax rates, authority limits, document numbering |
| `migration` | `GoLive_Migration_Workbook.xlsx` | The open business of the old system at cutover: clients, in-force policies on one sheet per kind of product (legacy numbers kept), open premium receivables, post-dated cheques on hand, open claims, GL opening balances, and the control totals of the legacy system |

The step-by-step set-up and the controls around the migration are in `GO_LIVE_DATA_SETUP.md` and the TISPH Data
Migration and Cutover Plan (`docs/TISPH/pack/TISPH_Data_Migration_and_Cutover.docx`); the workbench replaces the
one-off uploads they list for these objects (the single uploads stay available).

## The workspace

Eight tabs, each with its own address under `/master/configuration/go-live`, so a link (a notification, My Work) opens
the tab or the record directly:

| Tab | Address | What it holds |
|---|---|---|
| Overview | `/master/configuration/go-live` | The phases (Templates, Mock 1, Mock 2, Dress rehearsal, Cutover, Go-live, Hypercare), loads by status, rows loaded, the reconciliation, open defects of severity 1 and 2, the checklist progress and the Go / No-Go of the current run; the latest loads and what waits for the user (approvals, votes, checklist steps) |
| Templates | `/templates` | Each kit in load order with its keys and dependencies, the policy templates per product, a download per kit and per object (blank or current data), the value maps (add, edit, remove, download, upload) and the document file naming convention with the name checker |
| Loads | `/loads`, `/loads/:id` | The load history with filters (workbook, run, status, dates) and **Upload Workbook** (workbook, run, legacy system, file): the upload validates and opens the load. The load page shows the progress of its job while it validates, loads or undoes (refreshed every 3 seconds, also after the page is opened again), the place in the queue and a warning when the file is the file of another load; its actions follow its status (Validate Again, Download Errors, Submit for Approval, Withdraw Load, Approve / Reject Load, Reconcile Run) and the tabs Summary, Rows (old -> new), Duplicates (resolution with a reason), Approval (activity log) and Undo (dependents check, request, decision) |
| Reconciliation | `/reconciliation`, `/reconciliation/:id` | Lines by object with the legacy figures (entered or uploaded), checks and sub-ledger tie-outs (their GL accounts and tolerance kept by an approver), the difference list (Explain, Accept), the sign-off slots and the report (PDF, Excel, the signed PDF) |
| Runs | `/runs`, `/runs/:id` | Runs with their timings, loads, results, defects, evidence and report; the personal data used (a production extract needs the DPO approval reference); the evidence pack download and the record of its fingerprint and archive reference |
| Cutover | `/cutover` | The checklist of the production run (or of the run chosen) by phase: owner, planned and actual times, status, evidence and notes; Start, Mark Done (evidence or a note; the restore point on CO-3), Block, Skip, Edit Step |
| Go-Live | `/decision` | The cutover date, the Go / No-Go of the production run (criteria, waivers, approvers, votes), the go-live lock and the scoped, time-boxed unlock with the time left before it relocks, the history of the requests, and the SAP opening file when BrokerVerse sends it |
| Hypercare | `/hypercare` | After the lock: business issued since go-live, migrated open items collected and their age, renewals and endorsements and claims of migrated policies, edits to migrated records by day, the daily checks, imports refused while locked and the unlocks, open defects of the production run |

What a user sees follows the permissions: a holder of `read:data-load` only (the TIS Audit role) opens every tab and
download without one action button; the actions of `write:data-load` and `approve:data-load` appear to their holders.
A decision that a user may not take is shown disabled with the reason (the maker of a load, of an undo request, of a
lock request or of the SAP opening file request; a user who loaded the loads of a reconciliation; a user who signed
another slot); the server refuses it in the same way. Every irreversible step asks for a confirmation that names it
(*Load MIG-000012 now: 1,207 records*, *Remove 1,204 records of MIG-000012*). The menu entry is given to the System
Administrator, TIS IT AppSupport / Admin, TIS Finance & General Accounting, TIS Operations Unit Head, TIS General
Manager and TIS Audit.

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

Download from the Templates tab (**Download Blank**, or *Current Data* from its menu; per object the two buttons of its row) or
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
  General Accounting all three (migration `0445_migration_controls.sql`: Finance enters the legacy control totals,
  explains differences and runs the checklist steps it owns; it never approves an item it made); TIS Operations Unit
  Head and TIS General Manager read and approve; **TIS Audit (read only)** (`tis-auditor`) reads the workspace, the
  audit trail and the records it reconciles (clients, policies, claims, receivables, receipts, journals, period-end
  statements and the reports the General Manager sees), personal data masked, and changes nothing. The segregation of duties rule *Load and approve migration
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
  Master > Configuration and the Settings sheet refuse it, like the go-live lock and the settings of the Go-Live tab
  (approval of loads, migrated business in the KPIs, commission and incentives, the SAP opening file, the dashboards'
  default view, duplicate checks, unlock hours and window, evidence retention, document types, numbering mask series).
  Those are shown on the **Settings** card of the Go-Live tab and changed by a request with a reason
  (`PUT /api/data-load/golive/settings`, write or approve:data-load) that another approver approves on the lock card;
  approval of loads, the SAP opening file and the duplicate checks no longer change once go-live is locked.
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
  or `{ kind: 'issued', label: 'Issued in BrokerVerse' }`; claims, collection items, endorsements and renewals
  (`/api/policy-renewals`, `/api/renewals/queue`) also carry `policyOrigin` and `policyLegacyNumber` of their policy,
  and a policy renewed in BrokerVerse carries `renewedFromOrigin` and `renewedFromLegacyNumber` of the term it renews.
  The lists filter on `?origin=issued|migrated` (`all` or empty for both); on the renewals it is the origin of the
  expiring policy.
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
  and on `origin`; `load_batch_id` ties every migrated record to its batch. The production register (and premium by
  product, new business vs renewals) and the dealer production report have the column and Report Criteria **Origin**
  (Issued in BrokerVerse / Migrated, the earlier criteria name *Source* is still accepted) and the filter Origin; the
  Report Builder offers the column Origin on the policy, client, bill and claim datasets.
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
  are in the opening balances and paid with payment vouchers (Accounts > Disbursement). Collecting a migrated open item
  in full accrues no referrer commission (`commission/service.js` `onPolicyPremiumCollected` returns on a migrated
  policy unless `migration.commission_include_migrated` is on): its commission belongs to the legacy period.

## Migrated business in the figures

| Figures | Rule | Setting (default) |
|---|---|---|
| Executive, sales, sales home dashboards (`/api/dashboard/*`, `/api/agent/get-dashboard-details`) | `origin=issued` ("Issued since go-live") counts only the policies issued in BrokerVerse in premium written, new business, policy counts, policies in force, premium by product, trends, regions, products and agents; `origin=all` counts every policy. Renewals due, expiring policies and the retention rate count migrated policies in every view (they are the renewal opportunities). The executive and sales dashboards return `issuedSinceGoLive`: policies issued in BrokerVerse from the cutover date (count, premium) and the receipts, endorsements and claims registered since | `dashboard.default_origin` (`issued`); `migration.kpi_include_migrated` (off: on counts migrated policies in the issued view too) |
| Incentive achievement (`incentive/service.js` `achievement`, recent activities) | Premium and policy count leave migrated policies out. The renewal rate counts every policy expiring in the range, migrated ones included, and their renewals issued in BrokerVerse | `migration.incentive_include_migrated` (off) |
| Commission dashboard and the referrer accrual on full collection | Lines of migrated policies are left out of the commission dashboard; collecting a migrated open item accrues nothing | `migration.commission_include_migrated` (off) |
| Period-end check "policies without accounting" | Migrated policies are not expected to have a bill or journal (`origin`) | none |
| SAP GL daily file | Never carries the opening balance journal (it reads posted journals and their lines) | none; the one-time opening file below |

The four `migration.*` settings and `dashboard.default_origin` are changed on Data Migration & Go-Live > Go-Live >
Settings by a request approved by a second user (`PUT /api/data-load/golive/settings`); `migration.sap_gl_include_opening`
only before the lock. The claims position and ageing, SOA / premium receivable, receivables ageing, collection report,
receipts register, commission statement and renewal retention reports take the Origin column, criteria and filter too.

## Migrated and issued on the screens

What a user sees of the origin outside the workspace (`components/OriginChip`, `components/Dashboard/useDashboardOrigin.js`):

| Screen | Shown |
|---|---|
| Client view, Policy view, claim pages, collection item | Chip **Migrated** with "Legacy no. ..." and "Load MIG-000012"; the load opens the load in Data Migration & Go-Live for holders of read:data-load and is plain text for others; the tooltip gives the legacy system, when and by whom |
| Endorsement view, claim pages, collection item of a record issued in BrokerVerse on a migrated policy | Chip **Migrated policy** with the legacy policy number |
| Policy view of a renewal issued in BrokerVerse | "Renewal of legacy policy PC-..." in place of "Renewal term", with the link to the expiring term |
| Renewal Queue | Origin column and filter; chip **Renewal of legacy policy** on the row and in the side panel |
| Clients, Policies (filter panel), Claims, Collections, Journal Voucher lists | Filter **Origin** (All, Issued in BrokerVerse, Migrated) sent to the API as `origin`; Origin column with the chip on migrated rows only (and *Migrated policy* on claims and bills of a migrated policy) |
| Add Receipt bill list | The chip next to the bill number and the old system's bill number |
| Journal Voucher | The opening balance journal with status chip **Opening balance** and the Migrated chip; view only |
| Executive and Sales dashboards | Switch **Issued since go-live** / **All business** in the toolbar, sent as `origin=issued|all`; KPI tile **Issued since go-live** (premium and number of policies issued in BrokerVerse since the cutover date, from `issuedSinceGoLive`), shown once a cutover date is set; the figures behind a tile open the policy list filtered the same way |
| Reports | Filter Origin on the reports that declare it (production register, premium by product, new business vs renewals, dealer production) |

The dashboards open on the user's last choice, kept per user in the browser (`localStorage`
`bv.dashboard.origin.<user id>`); without one, or when the browser blocks storage, on the configured default
(`GET /api/dashboard/settings`: `defaultOrigin` from `dashboard.default_origin`, and the cutover date). A dashboard reads
its figures once the view is known, so it never shows one view and then the other.

## Opening balance journal

Each opening balances set loaded for go-live (the Opening Balances sheet or Accounts > Period End > Import opening
balances) also writes one **opening balance journal**: number `OBJ-<year>-<n>` (series `opening_journal`), dated the
day before the cutover date, status *opening*, origin migrated (legacy number: the load number), totals of the set and
**no journal lines**. Accounts > Journal Voucher lists it; its view and print show the accounts of the set ("Opening
balances as at <date>, load MIG-000012"). The opening balances themselves stay the single source of the balances: the
trial balance, the financial statements, the general ledger, the year-end close and the GL entry search read them as
before and never count the journal. It is read-only: post, reverse, cancel, approve, reject, reversal and correction
answer 409. A new load of the same cutover date replaces the set and its journal (a new number); the undo of the load
removes both and gives the set it restored its journal again. The journal statuses of the trial balance
(`reports.trial_balance_statuses`) can never include *opening*.

**SAP opening file (optional).** SAP normally takes the opening position by its own cutover load, and the
reconciliation compares the two trial balances. When TISPH wants BrokerVerse to send it, an approver switches
`migration.sap_gl_include_opening` on (Go-Live settings); a holder of write:data-load requests the file with a reason
(`POST /api/data-load/golive/sap-opening-file`) and another user with approve:data-load approves it once go-live is
locked (`/approve`). The opening balances set goes to the SAP pick-up folder as one SAP document dated the day before
the cutover, in the layout of the daily file, with `_OPENING` in the file names (an SAP GL run of trigger *opening*).
It is generated once (`journal_vouchers.sap_exported_at`); afterwards the set can no longer change.

## Reconciliation

Every validation and load of the migration workbook computes, inside the transaction, the control totals of that file
(`batch.reconciliation`; download: `GET /api/data-load/batches/:id/reconciliation`): rows and totals per sheet and in
BrokerVerse, trial balance debits = credits, premiums receivable control account = open items.

The reconciliation of record is made on Data Migration & Go-Live > Reconciliation (`/api/data-load/reconciliations`,
migration 0443). It covers the loaded migration loads of a run (all of them by default, refreshed on recompute, or the
loads chosen) and counts the records **of those loads** (`load_batch_id`), never every migrated record of the database:

- **Lines.** Clients (count, by type); Policies (count, gross and net premium, sum insured, in total, by product and by
  insurer; expiring within 90 days); Open Items (count, original amount, open balance, in total, by insurer and by
  ageing bucket at the day before the cutover, buckets of `limits.receivable_ageing_buckets`); Post-Dated Cheques
  (count, amount, by cheque month); Open Claims (count, outstanding estimate, by product); Opening Balances (debit and
  credit totals, balance per account on its normal side). Each line has the BrokerVerse value, the legacy value, the
  difference, the tolerance and a status (agrees, difference, no legacy figure, legacy figure missing).
- **Legacy figures** come from the Control Totals sheet of the loads, from entry on screen
  (`PUT /reconciliations/:id/lines/:lineId`) or from an upload (`POST /reconciliations/:id/legacy`, all or nothing) of a Control Totals sheet or of the legacy
  trial balance as it is (Account Code, Debit, Credit; a title above the header is fine): each account on its normal
  side against the SAP trial balance tie-out, and its debit total against the total. A figure entered on screen or uploaded is kept by a recompute. A legacy group is matched without
  case (`motor` is the line `MOTOR`).
- **Checks and tie-outs.** Trial balance debits = credits. The sub-ledger tie-outs of `migration.subledger_tieouts`
  (maintained on the Reconciliation tab, `PUT /api/data-load/settings/tieouts`, approve:data-load; the accounts seeded
  from `accounting.account.*`): premiums receivable (GL opening balance against the open items loaded, and per insurer
  the open items loaded against the legacy listing), post-dated cheques (cheques loaded against the legacy register),
  due to insurers, commission receivable and unapplied collections (GL opening balance against the legacy listing of
  the Control Totals object Sub-ledger), cash in bank (in total: the GL opening balance of the tie-out's accounts, else of the bank accounts' GL accounts,
  else of the Cash in Bank accounts; and per bank account of Bank Reconciliation: against the legacy book balance) and
  BrokerVerse against the SAP trial balance at the day before the cutover (in total: the debit total; and per account).
  Only the totals need a legacy figure before the sign-off; a line per insurer, account or bank account is compared
  when its figure is given. Entering the open balance of an insurer updates its tie-out at once. Each line shows both sides, their labels and the accounts used.
- **Tolerance.** Counts are exact; amounts agree to the centavo unless `migration.recon_amount_tolerance` or the
  tie-out's tolerance allows more. A tolerance other than zero on a line is set by a holder of approve:data-load who
  did not upload, submit or approve one of the loads, with a reason (audited and printed on the report).
- **Differences.** A line out of tolerance, a tie-out or check that does not agree, each workbook row of the loads not
  loaded (error, unresolved duplicate) and each migrated record outside the loads (an earlier load, a single-object
  import). Each is explained (write:data-load: explanation, action, owner; or marked fixed; who explained it is kept) and
  accepted with a note (approve:data-load, never by a user who uploaded, submitted or approved one of the loads, nor by
  the user who explained it; the explanation stays). A line whose difference is accepted shows **Difference accepted**.
  A reconciliation counts the records its loads created, changed or found unchanged, so a Mock 2 or a cutover delta
  loaded over an earlier load reconciles all the records it carries; a load of another run that changes them
  supersedes the earlier reconciliation (its signed report stays as signed).
- **Sign-off.** The slots of `migration.recon_signoffs` (Data owner, Finance Head), each signed with a remark by a holder
  of approve:data-load who did not load and signed no other slot (the Finance Head slot by a user of the finance role), once no difference is open and every total has its
  legacy figure. The first signature freezes the reconciliation; the last makes it **Signed** and keeps its PDF in the
  storage folder `go-live-evidence` with its SHA-256 (`GET /reconciliations/:id/report?format=pdf&version=signed`, header
  `X-Content-SHA256`); the stored file never changes afterwards. The go-live lock needs the signed reconciliation of the
  production run.
- **Superseded.** A load or an undo of the run after a signature makes the reconciliation *Superseded* and a new one is
  computed with the legacy figures entered on screen or uploaded and the tolerances set; an open reconciliation is
  computed again.
- **Report.** `GET /reconciliations/:id/report?format=pdf|xlsx`, built when downloaded: scope (loads, legacy system,
  cutover date, opening balances as at), lines, checks and tie-outs, tolerances, differences with their explanations
  and acceptances, sign-offs. It carries counts, amounts, codes and numbers only, no personal identifier.

## Mock runs and the cutover checklist

Data Migration & Go-Live > Runs (`/api/data-load/runs`, migration 0444). Each attempt is a **run**: Mock 1, Mock 2,
the dress rehearsal, an extra mock or the production run (one at a time). A run records its cutover date, planned and
actual start and end, the personal data it used (synthetic, masked copy or production extract, the last with the
reference of the DPO approval), its exit criteria, result (passed, passed with issues, failed) and summary, the restore
point noted before the load and, at the end, the SHA-256 and archive reference of its evidence pack. Each load is
uploaded into a run (field `runId`, a planned or running run); the run shows its loads with validate, load and undo
times and rows per second, its reconciliations and decisions, its defects (title, object, severity 1 to 4, status,
owner, load, step) and the run report (`GET /runs/:id/report?format=xlsx|pdf`).

Creating a run copies the **runbook** (Data Migration & Go-Live > Cutover, `GET /runbook`, reference seed
`92_go_live_workspace.sql`, from sections 12 and 13 of the plan) into its checklist:

| Phase | Steps |
|---|---|
| Pre-cutover | PC-1 Production deployed with reference data only; PC-2 Configuration loaded and authority limits approved; PC-3 Environment comparison mirrored; PC-4 Users and sign-in ready; PC-5 Smoke test or dress rehearsal, then reset; PC-6 Bank accounts reconcile-from date; PC-7 Cutover date set and fiscal year open; PC-8 Schedules paused and e-mail off |
| Cutover | CO-1 Legacy freeze; CO-2 Extract and control figures; CO-3 Pre-load checks and restore point; CO-4 Validate; CO-5 Migrate; CO-6 Reconcile; CO-7 Differences explained and accepted; CO-8 Business validation samples; CO-9 Go / No-Go; CO-10 Production: lock on, interfaces on, evidence archived |
| Go-live, hypercare | GL-1 Go-live floor support; HC-1 Hypercare daily checks; HC-2 Hypercare exit |

Each step has an owner (a user or the role of the plan), planned and actual start and end, a status (not started, in
progress, done, blocked, skipped) and notes. A step starts once the run is started and every step it waits for is
done or skipped (a mock skips the pre-cutover steps with a note). A step whose runbook names evidence is done with an
evidence file (`POST /api/data-load/evidence`) or a note saying why there is none; CO-3 records the restore point.
Block and skip need a note. Every move is audited. Evidence files are kept in the evidence store with their SHA-256,
downloaded only from the workspace (each download audited) and removed only by their uploader while the run is open.

## Go / No-Go

Data Migration & Go-Live > Go-Live (`/api/data-load/decisions`). The decision of a run names its approvers (at least
`migration.go_live_min_approvers`, default 2; one votes as Finance Head; each holds approve:data-load; not the user who
creates the decision) and copies the criteria of section 16 of the plan:

| Criterion | Checked |
|---|---|
| G1 UAT signed off, no open severity 1 or 2 defect | On screen, with its evidence |
| G2 Migration load of the production run loaded with no row in error, no unresolved duplicate, not with valid rows only | From the loads of the run |
| G3 Trial balance, receivables control and sub-ledger tie-outs agree, or their differences are accepted | From the latest reconciliation of the run |
| G4 Every legacy control figure reconciled; reconciliation signed | From the latest reconciliation of the run |
| G5 Business validation samples passed | On screen, with its evidence |
| G6 Configuration mirrored with UAT | From the latest environment comparison |
| G7 Demo accounts and SUPERID inactive, password sign-in off except break-glass | From the users and `security.password_sign_in_enabled` |
| G8 Numbering continues above every legacy number in every period, branch and line, and every COC series | From the numbering series and COC series |
| G9 Restore point noted | CO-3 done with an evidence file and the restore point on the run |
| G10 Hypercare team and support contacts in place | On screen, with its evidence |
| G11 Evidence pack archived | SHA-256 of a downloaded evidence pack of the run and the archive reference recorded on the run |

G2 to G5 are never waived; another criterion that is not met may be waived by a holder of approve:data-load other
than the creator, with a reason. Voting opens when every criterion is met or waived; each named approver votes once,
Go or No-Go. All Go makes the decision **Go**; a No-Go makes it **No-Go** at once, with the reason, the actions and the
new date. The go-live lock needs the Go decision of the production run.

## Evidence pack and retention

`GET /api/data-load/runs/:id/evidence-pack` (read:data-load) returns a ZIP built when downloaded: the run report, the
evidence files, per load its summary, rows and errors workbooks (and the uploaded workbook for a user with
write:data-load and view:pii), each reconciliation with its signed PDF, the Go / No-Go decisions, the lock requests and
an audit extract, with `manifest.csv` listing the SHA-256 of every file. Personal identifiers are masked for a user
without view:pii. The SHA-256 of the ZIP is returned in `X-Content-SHA256` and recorded in the audit trail; recording it
on the run with the archive reference meets G11.

Housekeeping keeps the rows and the uploaded workbook of the production run's loads for
`migration.evidence_retention_years` (default 10) after the go-live lock, and for ever before it; the rows and workbooks
of every other finished load go after `housekeeping.data_load_rows_days` and `housekeeping.data_load_files_days`
(default 365; 0 keeps them). The load record and its file SHA-256 always stay; each deletion is audited. Runs,
checklists, decisions, reconciliations and evidence files are kept.

## Hypercare

Data Migration & Go-Live > Hypercare (`GET /api/data-load/hypercare`), from the go-live lock for
`migration.hypercare_days` (default 28): business issued in BrokerVerse since the cutover date (policies and premium,
endorsements, receipts, claims), migrated open items collected (count, amount, share of the opening balance, ageing
now), migrated policies due for renewal in 60 days and renewed, endorsements, claims and cancellations on migrated
policies, edits to migrated records since the lock, the daily checks (trial balance, sub-ledgers against their control
accounts, yesterday's SAP GL file, numbering above the legacy numbers, lock on), imports refused while locked, unlocks
and relocks, and the open defects of the production run. The Overview tab (`GET /api/data-load/overview`) shows the
phases, the current run and what waits for the user.

## Load history and the transaction reset

The transaction reset keeps the load history (`data_load_batches`, `data_load_rows`, `data_load_comparisons`) as the
evidence of the mock runs: the loaded migration batches, whose records the reset removes, and their rows are marked
`undone` with the reason "transaction reset" (`scripts/lib/table-classification.js`, action `mark-reset`). Batch
statuses also include the approval and undo states of the Data Migration & Go-Live workspace (`pending-approval`,
`rejected`, `withdrawn`, `expired`, `running`, `validating`, `undo-pending`, `undoing`, `undone`). The reconciliations
with their lines, differences and sign-offs, the runs with their checklists, defects, decisions and evidence files are
kept too; the requests of the SAP opening file go with the journals the reset removes.

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
