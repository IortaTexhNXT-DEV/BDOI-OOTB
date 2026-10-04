# Smoke test and transaction reset before go-live

A smoke test proves, on the configured system, that a quotation becomes a policy, that the bill, receipt, remittance,
commission and journals come out right, and that a claim and a renewal can be handled. It leaves business records
behind. They must be removed before the go-live migration is loaded, while **every master, configuration setting and
user stays exactly as configured**. This page explains the recommended practice and the reset command
`npm run reset:transactions` (`backend/scripts/reset-transactions.js`).

## 1. Recommended practice

1. **Run the smoke test in Pre-Prod with the production configuration.** Copy the production masters and configuration
   (or configure Pre-Prod the same way), run the smoke test there and keep Production untouched until the migration.
   This is the normal case: Production never holds test records.
2. **If a smoke test must run in Production before go-live** (for example to check the production e-mail, printer or
   payment gateway set-up):
   - agree it in the cut-over plan and take a database snapshot first;
   - use clearly named test data so nothing can be mistaken for live business: a dedicated test branch (e.g. `TST`), a
     test insurer and test clients named `ZZ TEST ...`, test policy numbers entered by hand where the insurer number is
     asked;
   - do not send documents to real clients or insurers (use your own e-mail addresses on the test clients);
   - when the test is finished, run the transaction reset (section 3). Masters created only for the test (the test
     branch, insurer or product) are masters: the reset keeps them, so set them inactive or delete them in their master
     screen afterwards.
3. **After the reset**: document numbering restarts, the accounting is empty (section 2), then load the go-live
   migration (`GO_LIVE_DATA_SETUP.md`: open items, in-force policies, opening balances) and switch on the go-live lock.
4. **Switch on `golive.locked`** (Master > Configuration > Go-live, "Go-live lock") as soon as the migration is loaded.
   From then on the reset refuses to run: the database holds the live book.

## 2. What the reset removes and keeps

Every table of the database is classified in `backend/scripts/lib/table-classification.js`; a test fails when a new
migration adds a table that no list names, and the reset itself refuses to run on a database with an unclassified table.

| Class | Tables (examples) | Reset |
|---|---|---|
| Transactions (95 tables) | leads, clients, quotations, placements, policies, endorsements, receivables, receipts, collections, disbursements, petty cash requests and movements, commissions, debit notes, remittances, cessions, recoveries, bordereaux, incentive results, claims, renewals and win-back campaigns, journals, accounting periods, fiscal years, period-end closes, recurring journals, year-end runs, BIR 2307 certificates, bank and insurer statement reconciliation, instalment plans and warranty extensions, package quotations and policies, payment links, access reviews, calendar events, privacy consents and data subject requests | Emptied |
| System (14 tables) | notifications, e-mail outbox, generated report records, job run history and queue, sign-in history, sign-in sessions, password reset codes | Emptied |
| | document records (`documents`) | Records of transaction storage folders removed; logo, favicon, company logo and product document records kept |
| | number counters (`sequences`) | Transaction series removed (restart), master series kept (below) |
| | go-live opening balances | Removed; kept with `--keep-opening-balances` |
| | audit trail | Kept (and the reset is recorded in it); emptied with `--purge-audit` |
| | password history, schema migration history | Kept |
| Masters and configuration (60 tables) | settings, document numbering series, users, roles, permissions, authority matrix, segregation-of-duties rules, delegations, generic masters and master types, branches, signatories, banks, insurers, reinsurers, referrers, geography, currencies, vehicles, write-off reasons, products, policy types, covers, product configurator templates and components, risk mappings, commission rate matrix, tax codes, LGU rates, premium charge rules, package bundles, insurer rate tables, incentive programmes, reinsurance treaties, payment gateways, chart of accounts, posting rules, accounting change requests, period close checklist, petty cash funds, bank and insurer statement formats, bank match rules, report catalogue, report schedules, scheduled job definitions | Kept as they are |

### Numbering

Document numbers come from the series of Master > Document Numbering; the counters are rows of `sequences`. A series
restarts at its configured **start number** when its counter row is removed (the first number issued takes the start
number). The reset removes the counters of every transaction series (lead, quotation, client code, policy, endorsement,
claim, renewal, receipt, invoice, voucher, journal, remittance, cession, period close, ...): the first live policy after
go-live is `POL-<year>-00001` again (or the start number set on the series).

The counters of series that number **master records** are kept, because those records stay and a restarted counter
would issue a code that already exists:

| Series | Numbers |
|---|---|
| `petty_cash_fund` | Petty cash fund codes (Accounts > Petty Cash > Initiate) |
| `product_template` | Product configurator template codes |
| `reinsurer` | Reinsurer codes |
| `treaty` | Reinsurance treaty numbers |
| `incentive_program` | Incentive programme numbers |
| `commission_master`, `employee` | Codes of the retired commission and employee masters (records kept, inactive) |

The **client code** series restarts: clients are business records of the smoke test and are removed with it; the go-live
migration loads the real clients.

The next numbers set by the **Numbering** sheet of the go-live configuration workbook (the last numbers of the old
system plus one) are counters too, so the reset sets them back to the start number. Load the Numbering sheet (or the
whole configuration workbook: every other row is reported unchanged) again after the reset and before the migration
workbook; otherwise the migration refuses the legacy numbers that fall in the range the series has still to issue.

### Accounting

Journals and journal lines, accounting periods and their status history, fiscal years, month-end and year-end close
runs, recurring journals and opening balances carried forward by a year-end close are removed. The trial balance is
empty and no period is closed: the accounting calendar is regenerated, open, by the first posting or opening balance load
from the go-live date. Load the opening balances (Accounts > Period End > Opening Balances, go-live date) after the reset.

Petty cash funds are masters and stay. Their establishment journal goes with the ledger, so each fund is detached from it
and its available cash is set back to the fund size; the cash on hand at go-live comes in with the opening balances.

Bank accounts, the chart of accounts, posting rules and account determination are configuration and stay.

### Files

Uploaded and generated files live under `UPLOAD_DIR` in one folder per kind. With `--purge-files`, the reset deletes the
files of the transaction folders (`vehicle-photos`, `id-cards`, `policy-documents`, `quotation-responses`,
`insurer-offers`, `endorsement`, `endorsement-documents`, `claim`, `claims`, `payment-proofs`, `direct-bill-payments`,
`print`, `generated`, `reports`, `bordereaux`, `incentive-reports`, `reinsurance-reports`, `remittance-statements`,
`remittance-bulk`) after the database transaction has been committed. Logos, favicons, company logos and product
documents are never touched. Without `--purge-files` the files stay on disk (their records are removed); delete them
later or leave them to the storage lifecycle.

## 3. Running the reset

1. Take a database snapshot (and a copy of `UPLOAD_DIR` if `--purge-files` is used).
2. Stop the API instances (the reset locks the tables).
3. Dry run, on the server or a machine with `DATABASE_URL` of the target database:

   ```bash
   cd backend
   CONFIRM_RESET=yes npm run reset:transactions
   ```

   It prints, per table, the rows it would remove, the series that restart and the series that continue. Nothing is
   changed.
4. Reset:

   ```bash
   CONFIRM_RESET=yes RESET_ACTOR=<your username> npm run reset:transactions -- --execute [--keep-opening-balances] [--purge-files] [--purge-audit]
   ```

   | Option | Effect |
   |---|---|
   | `--execute` | Delete (without it: dry run) |
   | `--keep-opening-balances` | Keep the go-live opening balances already loaded (their fiscal year stays, open) |
   | `--purge-files` | Delete the files of the transaction storage folders |
   | `--keep-audit` / `--purge-audit` | Keep the audit trail (default) / empty it; the reset is recorded in it either way |

   Everything runs in one database transaction: any error rolls the whole reset back. The audit trail receives an entry
   (entity `database`, action `reset`) with the counts per table and the series restarted.
5. Start the API, sign in, and check that Leads, Clients, Policies and the Trial Balance are empty and that the masters,
   users and Configuration are as before.
6. Load the go-live migration, then switch on the go-live lock.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Dry run or reset done |
| 1 | Error: nothing was changed |
| 2 | `CONFIRM_RESET=yes` missing |
| 3 | Refused: `golive.locked` is on, or a table is not classified |

## 4. The go-live lock

The setting `golive.locked` ("Go-live lock", group Go-live of Master > Configuration, area Data Retention, Privacy & Uploads; created off by migration 0243) blocks the reset
when it is on. Switch it on once the go-live data is loaded.

If a database that is locked really has to be reset (for example a Pre-Prod copy of Production restored for a new test
cycle), a System Administrator switches the lock off in Master > Configuration > Go-live. The change is recorded in the
audit trail with the user and time. Never switch it off on the live Production database: the reset removes the live
book. There is no option of the command that bypasses the lock.

## 5. Related

- `npm run purge:sample` (`backend/scripts/purge-sample-data.js`) removes the demo data of a database started with
  `SEED_SAMPLE_DATA` on: all transactions, plus the sample masters and sample users. Use it on a demo database promoted
  to production, not after a smoke test on the client's own configuration.
- [GO_LIVE_DATA_SETUP.md](GO_LIVE_DATA_SETUP.md): order of the go-live set-up and migration.
- Upload templates: [../package/05_Delivery/Upload_Templates](../package/05_Delivery/Upload_Templates/README.md).
