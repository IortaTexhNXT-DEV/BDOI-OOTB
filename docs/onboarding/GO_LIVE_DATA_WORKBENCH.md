# Go-Live Data Workbench

For the System Administrator and the migration lead. The workbench (**Master > Go-Live Data Load**) loads a broker's
go-live data with two Excel workbooks instead of one upload per object:

| Kit | Workbook | Content |
|---|---|---|
| `configuration` | `GoLive_Configuration_Workbook.xlsx` | Everything needed to run new business: company, system settings, location masters, branches, departments, hierarchy, designations, users, currencies, exchange rates, chart of accounts, banks, bank accounts, signatories, transaction codes, write-off reasons, insurers, lines of business, products, policy types, covers, vehicle brands / models / variants / vehicles, commission rate matrix, premium taxes and charges, LGU tax rates, authority limits, document numbering |
| `migration` | `GoLive_Migration_Workbook.xlsx` | The open business of the old system at cutover: clients, in-force policies (legacy numbers kept), open premium receivables, open claims, GL opening balances |

The step-by-step set-up and the controls around the migration are in `GO_LIVE_DATA_SETUP.md` and
`docs/package/source/data-migration-and-cutover.md`; the workbench replaces the one-off uploads they list for these
objects (the single uploads stay available).

## Workbook layout

Each workbook has the sheets **Instructions** (load order, rules, cutover date rule, new versus migrated data, what is
entered on screen, every column), **Lists** (allowed values; the object sheets have drop-downs that point here) and
one sheet per object in load order.

- Row 1: headers, navy fill with white bold text. Required columns end with ` *`. Column order does not matter.
- Row 2: a sample row (amber, italic). A row whose first cell starts with `SAMPLE` is never loaded.
- Data from row 3. Cells are formatted as text so Excel keeps codes and dates as typed. Dates `YYYY-MM-DD`.

Download from the screen (**Download Template**: *Blank template* or *Current data*) or
`GET /api/data-load/kits/:kit/template[?prefill=true]`. The blank workbooks are also generated offline into
`docs/package/05_Delivery/Upload_Templates` by `backend/scripts/build-upload-templates.js`.

## Upload, validate, fix, load

1. **Upload and validate** (`POST /api/data-load/batches`, multipart `file` and `kit`). The workbook becomes a load
   batch (`data_load_batches`, its rows in `data_load_rows`). Validation is a dry run: every sheet runs through its
   importer in load order inside **one database transaction that is rolled back**. Cross-sheet references therefore
   validate as they will load: a policy may refer to a client and an insurer added by the same workbook.
2. **Result per sheet**: rows read, valid, with errors, held, and new / changed / unchanged / for approval / ignored.
   Each error has its sheet, row number, column and message (`GET /api/data-load/batches/:id`). A sheet that loads all
   or nothing (Opening Balances) and fails as a whole lists the real errors on their rows plus **one message for the
   sheet** (row empty, "Sheet" on the screen); its other rows are counted as *held* (not loaded, no error of their
   own). Informational notes (e.g. zero-balance rows ignored) are in the batch message shown above the counts.
3. **Download errors** (`GET /api/data-load/batches/:id/errors`): a workbook in the same layout with only the rows in
   error and an **Errors** column. Correct those rows and upload the file again (or the whole corrected workbook). For a
   sheet that failed as a whole the workbook has all its rows (it is uploaded again as a whole): the real errors on
   their rows, the sheet message on the first row (`Whole sheet: ...`), an empty Errors cell on the held rows.
4. **Load** (`POST /api/data-load/batches/:id/load`): allowed when the latest validation has no error, or with
   *Load valid rows only* (`validRowsOnly: true`; the screen ticks it by default for the configuration workbook and
   not for the migration workbook). The load runs in one transaction; if a row fails now because the data changed
   since the validation, nothing is saved and the errors are recorded. The load is written to the audit trail and the
   administrator is notified. After a load of the valid rows only, the rows left out keep their errors: the batch still
   lists them and **Download errors** still gives them, to fix and upload again.
5. **History** (`GET /api/data-load/batches`): status `validated`, `failed` or `loaded`, who uploaded and loaded, when,
   counts; open a batch to see its result again.

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
| Policies | legacy policy number |
| Open Items | policy number + bill reference |
| Open Claims | legacy claim number |
| Opening Balances | account code (the sheet loads all or nothing and replaces the earlier load of the same cutover date) |

### Promotion between environments

Configuration moves Dev -> SIT -> UAT -> Pre-Prod -> Production with the same workbook: download **Current data** in
the source environment and upload it into the target. Rows equal to the target are skipped, differences update it,
missing records are created. Exported settings are those of Master > Configuration (editable, not owned by another
screen, not under the second-user approval of Account Determination); `golive.locked` is never exported or loaded.

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
| `golive.cutover_date` | each environment (rehearsal, go-live) has its own cutover date |
| Settings holding a URL or host (a key part `url`, `uri`, `host`, `hostname`, `domain`, `endpoint`, `callback`, `webhook`, `origin`: `general.frontend_url`, `policy.payment_gateway_url`) | every environment has its own addresses |
| E-mail sender settings (`notification.from_address`, keys ending `from_address`, `from_name`, `from_email`, `reply_to`, `mail_from`, `sender…`, `smtp…`) | test environments send from their own address |
| Payment gateway modes (`payments.gateway…`, keys with `sandbox`, `live_mode`, `test_mode`, `gateway…mode`) | gateways run in sandbox outside Production; the gateways and their credentials are on Master > Finance > Payment Gateways, not in the workbook |
| Settings naming the environment (a key part `environment` or `env`) | they name the environment itself |
| Settings: Description column | reference text, never loaded |
| Numbering: Next Number | counters move with each environment's business. Switch on **Include numbering counters** (`includeNumbering=true`) to compare them as ordinary fields |
| Any column whose key ends in `url`, `uri`, `host`, `hostname`, `endpoint`, `webhook`, `callback` | addresses |

`golive.locked` and secrets are never exported, so never compared.

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

- **Permission.** `read:data-load` (download, history, compare environments) and `write:data-load` (upload, validate, load), granted to the
  System Administrator only (migration `0243_go_live_data_workbench.sql` and the seed).
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
- **Cutover date.** `golive.cutover_date` (Settings sheet of the configuration workbook, or Master > Configuration) is
  the first day of live transactions. The migration workbook is refused until it is set.
- **Go-live lock.** Once `golive.locked` is on (Master > Configuration), the migration workbook is refused (upload,
  validation and load). The configuration workbook stays available for new masters.

### Migration rules

- Rows dated on or after the cutover date are refused: policy issue date, claim loss and reported dates, client birth
  date. Policies must be in force at cutover (expiry on or after the cutover date). Open claims are `registered` or
  `in-review`.
- Opening balances are the trial balance of the old system at the close of the day before the cutover date. Debits must
  equal credits. The fiscal year of the cutover date must have no journal posted before it. A row with neither a debit
  nor a credit (or zero), an account whose movements net to zero, is accepted and ignored (counted as *ignored*, with
  a note in the batch message and `zeroBalanceRows` in the reconciliation totals); its account must still be in the
  chart of accounts. The sheet loads all or nothing: see *Result per sheet* above for how a failure is reported.
- Migrated records are flagged and post nothing:

| Record | Flag | Not created |
|---|---|---|
| Client | `source = 'go-live-migration'`, `load_batch_id` | |
| Policy | `doc.source = 'go-live-migration'`, `doc.loadBatchId`, `load_batch_id`; insurer at 100% | bill, booking journal, commission accrual (policy migration mode of `issuePolicy`) |
| Open item | receivable `source = 'opening'`, `go_live_date` = cutover, `load_batch_id`; the old bill number as `bill_number` and `reference`; a collection item | booking journal (the GL carries it in the opening balance) |
| Open claim | `details.source = 'go-live-migration'`, `load_batch_id`, a claim history line | acknowledgement e-mail, notifications, settlement journal |
| Opening balance | `opening_balances.source_run = 'go-live:<cutover>'` | journal |

## New and migrated data side by side

- **Numbers.** Migrated records keep the numbers of the old system (client code, policy number, claim number, the bill
  number of an open item). New
  business takes the next number of its Document Numbering series, which the Numbering sheet sets. Both workbooks refuse
  a collision: the configuration workbook when a series' next number would issue a number that a migrated record of
  the same format already has, the migration workbook when a legacy number has the format of a series in the current
  period at or above its next number (e.g. `CL-2026-00500` while the client series is at 1). Raise the next number
  above the legacy range first.
- **Dates.** Opening balances are dated the day before cutover; every new transaction is dated on or after it.
- **Renewals.** Migrated in-force policies are ordinary active policies: the renewal queue picks them up as they near
  expiry. Policies expiring soon need no separate sheet; the reconciliation counts those expiring within 90 days. The
  renewal term is new business: it does not carry the `go-live-migration` source or the load batch of the expiring term.
- **Reports.** The policy API and lists show `source` and filter on it (`GET /api/policies?source=go-live-migration`);
  `load_batch_id` ties every migrated record to its batch.
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

- per sheet: rows in the workbook and their totals (gross and net premium, sum insured, open balance, claim estimate,
  debits and credits) and the records and totals in BrokerVerse after the load (all migrated records);
- checks: trial balance debits = credits; premiums receivable control account (`accounting.account.premium_receivable`)
  opening balance = total open balance of the open items of the cutover date.

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
package bundles; payment gateway credentials; System Settings (name, logo, colours); company logo files; schedules;
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
failing row is undone alone and the next rows carry on. A transaction-level advisory lock serialises loads.
`getSetting` reads through the transaction and bypasses the settings cache inside it; the settings and letterhead
caches are cleared after every dry run and load. Sequence counters advanced during a dry run are rolled back with it.

Code: `backend/src/modules/data-load` (`configuration.js`, `migration.js`: the sheets; `workbook.js`: templates,
reading, errors and reconciliation workbooks; `service.js`: batches, dry run, load; `numbering.js`: the collision
check). Tests: `backend/test/go-live-workbench.test.js`.
