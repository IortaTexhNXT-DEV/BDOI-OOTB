---
title: Data Migration
subtitle: and Cutover Plan for BrokerVerse
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; GL=General ledger; TB=Trial balance; CoA=Chart of accounts; OR=Official receipt; ATP=Authority to Print; BIR=Bureau of Internal Revenue; Pre-Prod=Pre-production environment; SIT=System integration test; UAT=User acceptance test; API=Application programming interface; XLSX=Excel workbook; CSV=Comma-separated values; PM=Project manager
---

# Introduction

## Purpose

This plan describes how a broker's data moves from the old system into BrokerVerse OOTB and how the switch to BrokerVerse is made: which data objects are loaded, with which upload templates, in what order, how each load is validated and reconciled, how the mock loads rehearse it, the cutover checklist, the go/no-go criteria and the rollback.

It applies the step-by-step set-up of `docs/onboarding/GO_LIVE_DATA_SETUP.md` to the project and adds the controls around it.

## Principles

- **Templates only.** Every load uses the delivered upload templates in `docs/package/05_Delivery/Upload_Templates`. Each workbook has a Data sheet (exact headers, sample rows to delete), a Columns sheet (required, format, allowed values, accepted alternative headers) and an Instructions sheet (screen, API route, file types, row limit, what happens to a wrong row).
- **The broker owns the data.** The broker extracts, cleanses and signs off its data. iorta TechNXT advises on mapping, runs the loads with the broker and reports the results.
- **Open positions, not history.** BrokerVerse receives what is open at the go-live date: in-force policies, unpaid premium, the trial balance. Closed history stays in the old system, which is kept read-only.
- **One go-live date.** The go-live date is the first day of transactions in BrokerVerse. Balances and open items are taken from the old system at the close of the day before.
- **Reconcile everything.** Every load is checked on counts and totals against control figures produced from the old system before the load.
- **Rehearse.** The full sequence runs at least twice before cutover (mock loads in UAT, or SIT and UAT for a large broker), and the last run is the cutover rehearsal in a temporary Pre-Prod created from a production backup.

## Roles

| Role | Party | Responsibility |
|---|---|---|
| Data owner per object | Broker process owner | Extract, cleanse, approve the file, sign off the reconciliation |
| Accounting Manager | Broker | Chart of accounts mapping, trial balance, open receivables, amounts due to insurers; signs off the financial reconciliation |
| Broker PM | Broker | Data readiness tracking, cutover coordination |
| System Administrator | Broker | Masters and users in production; loads that have no Upload button with iorta TechNXT |
| Migration lead | iorta TechNXT | Mapping, load runs, load logs, reconciliation reports, cutover runbook |
| DevOps lead | iorta TechNXT | Environments, snapshots, the provisioning script, rollback |

# Data objects

## In scope

| Group | Data object | Source in the old system | Loaded into |
|---|---|---|---|
| Organisation | Company, branches, departments | Company records | Master > Generals > Organization |
| Organisation | Employee hierarchy and designations; staff branch, designation and reporting line | HR list | Master > Generals > Employee Management; Master > Generals > User Management > User |
| Access | Users with one role each | User list | Master > Generals > User Management > User, or the provisioning script |
| Reference | Countries, regions, provinces, cities / municipalities, barangays | Address tables: the Philippine Standard Geographic Code (PSGC 2Q 2026) is delivered (18 regions, 82 provinces, 1,642 cities and municipalities with ZIP codes, Metro Manila barangays; the other barangays with `backend/scripts/load-barangays.js`); load only what is missing | Master > Generals > Location |
| Reference | Currencies, exchange rates | Finance | Master > Finance > Currency, Exchange Rate |
| Insurance | Insurers with commission rate, premium payment warranty, remittance terms, billing mode | Insurer master and agreements | Master > Generals > Insurance Management > Insurance Company |
| Insurance | Lines of business, products, policy types, covers | Product list (delivered data covers Philippine non-life; load only what is missing) | Master > Generals > Insurance Management |
| Insurance | Vehicle brands, models, variants, vehicles | Motor tables (delivered data holds vehicle makes) | Master > Generals > Insurance Management > Vehicle |
| Insurance | Signatories | Authorised signatories | Master > Generals > Insurance Management > Signatories |
| Commission | Commission rates per insurer, product and line of business | Commission tables | Master > Finance > Commission Rate Matrix |
| Finance | Chart of accounts | GL account list | Master > Finance > Main Account, Sub Account |
| Finance | Transaction codes, write-off reasons; petty cash funds | Finance set-up | Master > Finance; Accounts > Petty Cash > Initiate |
| Finance | Banks and the broker's bank accounts | Bank list | Master > Finance > Bank |
| Open business | In-force policies and their clients | Policy register at go-live | Operations > Policy > Bulk Upload, go-live mode |
| Open business | Open premium receivables | Receivable ageing at the day before go-live | Accounts > Collections > Import open items |
| Open business | GL opening balances | Trial balance at the day before go-live | Accounts > Period End > Period Management > Import opening balances |
| Open business (optional) | Leads and quotations in progress | Pipeline | Operations > Sales & Marketing > Prospects and Quotations, Bulk Upload |

## Open payables and other open positions

| Position | How it moves to BrokerVerse |
|---|---|
| Premium due to insurers on bills of the old system | Part of the Due to Insurers opening balance. Paid with payment vouchers in Accounts > Disbursement (`Disbursements_Upload_Template.xlsx` for many at once), not through the remittance run, which only sees bills booked in BrokerVerse |
| Commission due to referrers and agents earned before go-live | Part of the opening balance of the commission payable account; paid with payment vouchers (payee type Agent/Referrer) |
| Commission receivable from insurers on direct-bill business billed in the old system | Part of the opening balance of Commission Receivable - Insurers. There is no open-item import for debit notes; recommended procedure: clear the balance with a journal voucher when the insurer pays, agreed with the Accounting Manager in discovery |
| Unreconciled bank items | Kept on the old bank reconciliation; BrokerVerse reconciles from the reconcile-from date of each bank account (normally the go-live date) |
| Open claims | No claim upload. Claims open at go-live on policies loaded as in-force are registered on Operations > Claims after go-live; claims on policies that are no longer in force stay in the old system until closed |
| Co-insured in-force policies | The go-live upload loads each policy with its insurer at 100%. Co-insured policies are entered on the screen with their participants |

## Out of scope

Expired, cancelled and lapsed policies; settled and closed claims; paid bills; transaction history and journals before go-live; prior fiscal years; documents and images of the old system; quotations and leads the broker decides not to carry over. Migrating any of these is a change request.

# Upload templates

## Templates in docs/package/05_Delivery/Upload_Templates

All templates were verified against the importers: each was loaded unchanged through the API on a fresh database (`docs/package/05_Delivery/Upload_Templates/README.md`). Required columns are listed in bold on the template's Columns sheet. An import file holds at most 20,000 data rows and 10 MB (`IMPORT_MAX_ROWS`, `IMPORT_MAX_MB`); the receipt upload takes at most 1,000 rows.

| Template | Loads | Screen |
|---|---|---|
| `Company_Upload_Template.xlsx` | Companies (letterhead, TIN, IC licence) | Master > Generals > Organization > Company (API route) |
| `Branch_Upload_Template.xlsx` | Branches | Master > Generals > Organization > Branch (API route) |
| `Department_Upload_Template.xlsx` | Departments | Master > Generals > Organization > Branch, departments of the branch (API route) |
| `Users_Provisioning_Template.xlsx` / `.csv` | Users with role and initial password | Server script `backend/scripts/provision-users.js` |
| `Hierarchy_Upload_Template.xlsx` | Ranks of the employee hierarchy | Employee Management > Hierarchy (API route) |
| `Designation_Upload_Template.xlsx` | Designations | Employee Management > Designation (API route) |
| `Country_Upload_Template.xlsx` | Countries | Master > Generals > Location > Country |
| `Region_Upload_Template.xlsx` | Regions (only for another country: the 18 Philippine regions are delivered) | Location > Province (API route) |
| `Province_Upload_Template.xlsx` | Provinces (formerly State; the Philippine provinces are delivered) | Location > Province |
| `City_Municipality_Upload_Template.xlsx` | Cities and municipalities with ZIP code, class and PSGC code | Location > City / Municipality |
| `Barangay_Upload_Template.xlsx` | Barangays missing from the PSGC list | Location > City / Municipality (API route) |
| `Currency_Upload_Template.xlsx` | Currencies | Master > Finance > Currency |
| `Exchange_Rate_Upload_Template.xlsx` | Exchange rates with effective dates | Master > Finance > Exchange Rate (API route) |
| `Insurance_Company_Upload_Template.xlsx` | Insurers, default commission rate, premium payment warranty days, remittance terms, billing mode | Insurance Management > Insurance Company |
| `Line_of_Business_Upload_Template.xlsx` | Lines of business | Insurance Management > Line of Business (API route) |
| `Product_Upload_Template.xlsx` | Products per line | Insurance Management > Product (API route) |
| `Policy_Type_Upload_Template.xlsx` | Policy types per product | Insurance Management > Product (API route) |
| `Cover_Upload_Template.xlsx` | Covers | Insurance Management > Cover (API route) |
| `Vehicle_Brand_Upload_Template.xlsx` | Vehicle brands | Insurance Management > Vehicle |
| `Vehicle_Model_Upload_Template.xlsx` | Vehicle models per brand | Insurance Management > Vehicle |
| `Vehicle_Variant_Upload_Template.xlsx` | Variants with body type and seating | Insurance Management > Vehicle |
| `Vehicle_Upload_Template.xlsx` | Vehicles | Insurance Management > Vehicle |
| `Signatories_Upload_Template.xlsx` | Signatories | Insurance Management > Signatories (API route) |
| `Chart_of_Accounts_Upload_Template.xlsx` | Main and sub accounts with statement group and normal balance | Master > Finance > Main Account > Upload |
| `Transaction_Code_Upload_Template.xlsx` | Transaction codes with GL accounts and user limits | Master > Finance > Transaction Code |
| `Write_off_Reason_Upload_Template.xlsx` | Write-off reasons with GL account and maximum | Master > Finance > Account Determination (API route) |
| `Bank_Upload_Template.xlsx` | Banks | Master > Finance > Bank |
| `Bank_Account_Upload_Template.xlsx` | The broker's bank accounts with GL cash account, statement format and reconcile-from date | Master > Finance > Bank (Bank accounts) |
| `Policies_Upload_Template.xlsx` | In-force policies and their clients (go-live mode), or new policies | Operations > Policy > Bulk Upload |
| `Open_Items_Upload_Template.xlsx` | Unpaid premium bills at go-live | Accounts > Collections > Import open items |
| `Opening_Balances_Upload_Template.xlsx` | Trial balance at the day before go-live | Accounts > Period End > Period Management > Import opening balances |
| `Leads_Upload_Template.xlsx` | Prospects | Operations > Sales & Marketing > Prospects > Bulk Upload |
| `Quotations_Upload_Template.xlsx` | Quotations in progress | Operations > Sales & Marketing > Quotations > Bulk Upload |
| `Receipts_Upload_Template.xlsx` | Official receipts against open bills (day-to-day use) | Accounts > Receipts > Bulk upload |
| `Disbursements_Upload_Template.xlsx` | Payment vouchers, for example to pay amounts due to insurers at go-live | Accounts > Disbursement > Bulk upload |
| `Bank_Statement_Generic_Upload_Template.xlsx` | Bank statements of banks without a delivered format | Accounts > Bank Reconciliation > Reconciliation Workspace > Import statement |
| `Remittance_Bank_Transactions_Template.xlsx` / `.csv` | Bank transactions for remittance reconciliation | Accounts > Remittance > Reconciliation > Import |
| `Remittance_Bulk_Upload_Template.xlsx` | Policies for bulk remittance processing | Accounts > Remittance > Bulk Processing |

"API route" means the screen has no Upload button in this release; a System Administrator loads the file through the route written on the template's Instructions sheet, or enters the records on the screen.

## Data that has no template

Tax codes (Master > Finance > Taxation: delivered with the Philippine codes and edited on the screen), the Commission Rate Matrix, account determination, posting rules, document numbering, product templates and the motor tariff, settings and schedules. These are configured on the screens and are part of the configuration, not of the data migration.

## Format rules

- Dates as `YYYY-MM-DD`; amounts as plain numbers without currency sign or thousands separator; rates as fractions where the Columns sheet says so (0.20 for 20%).
- One row per record; no merged cells, formulas or hidden rows; delete the sample rows.
- Codes that link files (insurer names, product types, policy numbers, account codes) must match exactly what is already loaded.

# Load sequence

The order follows the dependencies between objects. A step starts only when the previous one is reconciled.

| # | Load | Depends on | Who |
|---|---|---|---|
| 1 | Company and letterhead; System Settings | Nothing | System Administrator |
| 2 | Location masters (only what is missing) | 1 | System Administrator |
| 3 | Branches, departments | 1, 2 | System Administrator |
| 4 | Users and roles; security settings | 3 | System Administrator |
| 5 | Employee hierarchy and designations (if used) | 3 | System Administrator |
| 6 | Currencies and exchange rates (if foreign currency business) | 1 | Accounting |
| 7 | Chart of accounts review and load; account determination | 1 | Accounting Manager with iorta TechNXT |
| 8 | Banks, bank accounts, signatories; transaction codes, write-off reasons, petty cash | 7 | Accounting |
| 9 | Insurers | 2 | Processing Team, Accounting |
| 10 | Lines of business, products, policy types, covers, vehicles (only what is missing); product templates and motor tariff | 9 | Processing Team |
| 11 | Commission rules; Commission Rate Matrix; referrers | 9, 10 | Accounting |
| 12 | Tax codes, premium taxes and LGU rates (review) | 7 | Accounting Manager |
| 13 | Document numbering: next numbers of each series | Last numbers of the old system | System Administrator, Accounting |
| 14 | In-force policies and clients (go-live mode) | 9, 10 | Processing Team |
| 15 | Open premium receivables | 14 | Accounting |
| 16 | GL opening balances | 7, 15 | Accounting Manager |
| 17 | Leads and quotations in progress (optional) | 9, 10 | Sales & Marketing |
| 18 | Payment vouchers for amounts due to insurers at go-live, when paid | 16 | Accounting, after go-live |

Points to know (from `GO_LIVE_DATA_SETUP.md`, step 11):

- In go-live mode each policy row creates the client and the policy with its insurer at 100%, with no bill, journal or commission. Each row creates a new client, so a client with several policies appears once per policy and is merged afterwards on the Clients screen if needed.
- Open items are loaded against policies already in BrokerVerse; a direct-billed policy is refused. Each open item becomes a bill that ages, is chased by the collection reminders and is paid with a normal official receipt. No journal is posted. Rows already loaded for the same go-live date are skipped, so a corrected file can be loaded again.
- While an open item is unpaid, a claim on that policy is refused when `claims.block_unpaid_premium` is on (the delivered setting).
- Opening balances go into the fiscal year that contains the go-live date. Debits must equal credits or nothing is loaded. Loading again with the same go-live date replaces the earlier load; another date is refused. A go-live date after journals already posted in the same fiscal year is refused: load the balances before anyone posts.
- Close the accounting periods of the fiscal year before the go-live date in Period Management so nothing is posted into them.

# Validation and reconciliation

## Validation by the system

Each upload checks every row and reports the failing rows with the reason; the rest are loaded (opening balances are all or nothing). The load log keeps, for each file: file name, date and time, user, rows read, created, skipped, failed, and the list of failures.

## Control figures

Before each load the data owner produces control figures from the old system, signed by the Accounting Manager for financial objects. After the load the same figures are produced from BrokerVerse and compared.

| Object | Control figures from the old system | Where to read them in BrokerVerse | Tolerance |
|---|---|---|---|
| Masters (insurers, products, accounts, banks, users) | Count of records per type | Each master list; Upload result "created, failed" | Exact |
| In-force policies | Count; count per insurer and per line; total sum insured; total gross premium; total net premium | Operations > Policy; Reports > Operational Reports > Production; Production Register | Exact |
| Clients | Count of distinct insureds | Operations > Clients (before and after merging duplicates) | Explained differences only |
| Open premium receivables | Count of open bills; total open balance; totals per ageing bucket (30, 60, 90, 120 days) | Accounts > Collections; Reports > Financial Reports > SOA/Premium Receivable | Exact |
| GL opening balances | Total debits, total credits, balance per account | Accounts > Period End > Financial Statements: trial balance as at the go-live date; Trial Balance report | Exact |
| Premiums Receivable | GL balance = total of open items | Trial balance against Collections total | Exact |
| Due to Insurers | GL balance per insurer = insurer statements less items in dispute | Trial balance; Aged Payables to Insurers; Due to Insurers by Co-insurer | Exact, or reconciled list of differences |
| Bank accounts | GL cash balance = bank balance less outstanding items of the old reconciliation | Trial balance; bank statements | Exact |
| Leads and quotations | Count | Prospects and Quotations lists | Exact |

## Checks of meaning

Counts and totals agree even when data is wrong in the detail, so the key users also check samples:

- 20 policies per line of business opened on the screen: insured, insurer, dates, sum insured, premium, plate number for motor.
- 20 open items: policy, bill reference, due date, balance, ageing bucket.
- One receipt posted in UAT on a migrated open item (UAT script F1) and a claim registered on a migrated policy without open premium (UAT script C1).
- Trial balance reviewed line by line by the Accounting Manager (UAT script F7); the ageing compared bucket by bucket (UAT script F6).
- Document numbers: one test document of each series shows the next number set from the old system, including the official receipt series registered with the BIR.

## Reconciliation report

Each load produces a reconciliation report: control figures, figures from BrokerVerse, differences with the explanation and the action, and the sign-off of the data owner and, for financial objects, the Accounting Manager.

# Mock loads

| Mock load | Purpose | Data | Exit criteria |
|---|---|---|---|
| Mock 1 | Prove mapping and templates; find data quality issues | Full extract from the old system at a recent date | All files load; failures listed and assigned for cleansing |
| Mock 2 | Prove cleansing; measure load times; reconcile | Fresh extract after cleansing | Failures below 1% of rows and explained; all control figures reconcile |
| Mock 3 (large) | Full rehearsal on fresh data | Fresh extract at a month-end | All control figures reconcile; UAT on migrated data passes |
| Cutover rehearsal (small: third load; medium: mock 3; large: mock 4) | Cutover rehearsal with the cutover timetable, in Pre-Prod | Fresh extract | Done inside the cutover window; reconciliation signed |

Each mock load runs in UAT (small and medium broker) or in SIT and UAT (large broker) on a database reset to reference data plus the agreed configuration. The cutover rehearsal runs in a temporary Pre-Prod restored from a backup of the configured Production environment (Environment Strategy and Production Rollout Plan). The time of each step is recorded and used for the cutover timetable. Small brokers run two mock loads and then the rehearsal.

# Cutover

## Cutover timetable (example for a go-live on a Monday)

| When | Activity | Owner |
|---|---|---|
| Go-live minus 10 business days | Go/no-go checkpoint 1: UAT signed, mock rehearsal reconciled, training done, configuration copied to production | Steering committee |
| Go-live minus 5 business days | Communication to users, insurers and banks; production smoke test; users created in production and first sign-in tested | Broker PM, System Administrator |
| Go-live minus 3 business days | Masters loaded and reconciled in production (steps 1 to 13); document numbering checked | System Administrator, migration lead |
| Friday, end of day | Old system frozen for new transactions; last receipts and vouchers of the day posted there | Broker PM |
| Friday evening | Day-end in the old system; extracts: in-force policies, open receivables, trial balance, amounts due to insurers; control figures produced and signed | Data owners, Accounting Manager |
| Saturday | Database snapshot of production; load in-force policies, open items, opening balances; reconciliation | Migration lead, Accounting |
| Sunday morning | Key user checks of samples; reconciliation reports signed | Key users, Accounting Manager |
| Sunday afternoon | Go/no-go checkpoint 2 (final) | Steering committee |
| Sunday evening | Old system set to read-only; scheduled jobs and e-mail sending on in BrokerVerse | DevOps lead, System Administrator |
| Monday | Go-live; floor support; first receipts, payments and bank imports watched | All |

## Cutover checklist

| # | Item | Done |
|---|---|---|
| 1 | Production deployed and smoke-tested (`deploy/README.md` section 4); sample data off; backups running and a restore tested | |
| 2 | Security settings reviewed; administrator password changed; two-step verification on for the required roles | |
| 3 | Company, letterhead and System Settings set; a PDF checked | |
| 4 | Users created with the right roles; each user signed in once | |
| 5 | Configuration promoted from the accepted UAT environment and compared item by item with the configuration workbook | |
| 6 | Tax codes, premium taxes and LGU rates confirmed by the broker's tax adviser | |
| 7 | Document numbering set to the last number used plus one; official receipt series matches the BIR registration | |
| 8 | E-mail sending on; password reset e-mail received | |
| 9 | Payment gateway credentials in the secret store; live test payment done (if used) | |
| 10 | Bank accounts with GL cash account, statement format and reconcile-from date set to the go-live date | |
| 11 | Schedules reviewed; jobs Accounting wants switched on | |
| 12 | Fiscal year and periods set; periods before the go-live date closed | |
| 13 | Old system frozen; final extracts and control figures signed | |
| 14 | Snapshot of production before the loads | |
| 15 | In-force policies loaded and reconciled | |
| 16 | Open items loaded and reconciled with the ageing | |
| 17 | Opening balances loaded; trial balance agrees; Premiums Receivable equals open items; Due to Insurers reconciled | |
| 18 | Key user sample checks passed | |
| 19 | Rollback plan confirmed; old system kept available read-only | |
| 20 | Go decision recorded in the minutes | |

## Go/no-go criteria

Go-live goes ahead only when all of these are met:

- UAT signed off by each process owner; no open severity 1 or 2 defect.
- Final load reconciled: policy, open item and trial balance control figures agree exactly, or each difference is explained and accepted in writing by the Accounting Manager.
- All users trained in their role and able to sign in; System Administrator and key users ready for first-line support.
- Production checks of the cutover checklist done.
- Hypercare team and support contacts in place for the first week.
- Rollback plan confirmed and the old system available.

The steering committee decides. A no-go names the reason, the actions and the new date.

# Rollback

## When

Rollback is considered when, before or during the first business days, a severity 1 issue makes BrokerVerse unusable for a core process (official receipts, policy issue, remittance) and no workaround is possible within the agreed time, or the final reconciliation cannot be agreed. The steering committee decides. The last point at which rollback is planned is the end of the first business week; after that the issue is handled by fix forward, because transactions entered in BrokerVerse would have to be re-entered in the old system.

## How

| Situation | Action |
|---|---|
| Before go-live (failed final load or reconciliation) | Restore the production snapshot taken before the loads, fix the data, reload; or declare a no-go and keep working in the old system, which was only frozen |
| After go-live, within the rollback window | Unfreeze the old system; re-enter there the transactions made in BrokerVerse since go-live (receipts, vouchers, policies), using BrokerVerse reports (Receipts Register, Production Register, Journal) as the list; restore the BrokerVerse snapshot for the next attempt |
| Application release problem | Redeploy the previous back-end image and front-end build (`deploy/README.md` section 8); migrations only add, so the previous version runs on the database |

Data entered in BrokerVerse during the rollback window is listed daily so that a rollback can be carried out. The old system stays available read-only until the broker accepts BrokerVerse at hypercare exit, and stays readable for reference and audit afterwards for the period the broker's record-keeping rules require.
