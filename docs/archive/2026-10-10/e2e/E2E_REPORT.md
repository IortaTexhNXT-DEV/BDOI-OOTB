# BrokerVerse OOTB test summary

Where BrokerVerse OOTB stands on testing, as of 29 September 2026 (branch `brokerverse-platform`). This page points
to the latest runs; the detail is in the linked files.

## Latest results

| Check | Result | Detail |
|---|---|---|
| Role walk | 7 roles, 429 screens opened, no screen problems, 2,823 API calls all successful | [ROLE_WALK.md](../../../e2e/ROLE_WALK.md) |
| Document and report sweep | 291 of 291 passed | [DOCUMENT_REPORT_SWEEP.md](../../../e2e/DOCUMENT_REPORT_SWEEP.md) |
| Backend tests | 518 tests pass (vitest against PostgreSQL 16, `backend/test`, 50 files) | `cd backend && npx vitest run` |
| Front-end tests | 30 tests pass | `cd brokerverse && npx craco test --watchAll=false` |
| GitHub CI | Backend lint and tests, front-end tests and production build, backend image build on every push and pull request | `.github/workflows/ci.yml` |
| Defects | 149 logged during the functional run and the persona walks, all fixed and re-tested | [DEFECTS.md](DEFECTS.md) |

## Role walk

One user per role signs in through the sign-in page and opens every screen its menu offers, on the local system
with sample data. A screen fails when it shows the error-boundary message or "Not authorised" on a screen its own
menu offered; an API call fails when the backend log shows an answer of 400 or more while the role walked.

| Role | Screens | Problems |
|---|---|---|
| System Administrator (Super Admin Access) | 158 | 0 |
| Sales & Marketing (Account Executive) | 29 | 0 |
| Processing Team (Placement & Policy Processing) | 41 | 0 |
| Operations (Client Servicing) | 27 | 0 |
| Claims | 12 | 0 |
| Accounting | 81 | 0 |
| Accounting Manager | 81 | 0 |

Script: [role_walk.py](../../../e2e/role_walk.py).

## Document and report sweep

Every document and report file the system produces is generated through the API and checked: HTTP 200, the PDF or
XLSX signature, a CSV header, and the row count of each report file against its on-screen preview. The 291 items
are 22 documents (quotations, policy schedules, broker and placement slips, billing statements, receipts, vouchers,
debit notes, claim letters, the bank reconciliation statement), 246 report files (91 operational, 155 financial,
in CSV, XLSX and PDF), 20 module exports and 3 report schedules run on demand. Every PDF carries the letterhead
of the Company master.

## Automated tests

The backend tests are integration tests: each file recreates the schema of a test database, calls the API through
supertest and checks the database. They cover sign-in, lockout, password policy, two-factor, session revocation,
every protected route answering 401 without a token, role access per broker role, role inheritance, the placement
journey and co-insurance, posting rules (every event balances on its sample), period end, bank reconciliation,
document numbering, the report catalogue, printing, upload templates, go-live imports and configuration
consistency. The front-end tests cover the menu permissions, `canOpen`, date and number formatting, configured
options, the placement screens' shared helpers and the lead service. CI runs both on every push to `brokerverse-platform` and `main`, and the front-end
deployment workflow runs the front-end tests before it publishes.

## Earlier functional run

Before the broker roles and the placement journey were added, the full broking cycle was run screen by screen:
lead, quotation, client approval, policy, receipts, commission payout, remittance to the insurer, endorsements,
claim settlement, journal voucher, scheduled jobs, renewal, direct bill and the chart of accounts. Screenshots
are in [evidence/](../../../e2e/evidence/). The money trail of that run shows how one policy moves through the ledger:

| Event | Document | Debit | Credit | Amount |
|---|---|---|---|---|
| Policy issued | INV-2026-00001 / JV-2026-00100 | Premium receivable | Payable to insurer 30,875.52; commission income 4,200.75 | 35,076.27 |
| Premium received | OR-2026-00019 / JV-2026-00101 | Cash | Premium receivable | 35,076.27 |
| Commission paid to the referrer | PV-2026-00022 / JV-2026-00103 | Commission accrued 4,200.75 | Cash 3,990.71; WHT payable 210.04 | 4,200.75 |
| Premium remitted to the insurer | PV-2026-00023 / JV-2026-00104 | Premium payable | Cash | 30,875.52 |
| Cover increased by endorsement | INV-2026-00002 / JV-2026-00105 | Premium receivable | Payable to insurer 4,410.00; commission income 600.00 | 5,010.00 |
| Endorsement premium received | OR-2026-00020, OR-2026-00021 | Cash | Premium receivable | 2,000.00 + 3,010.00 |

Since that run, every system journal is built from the posting rules (Master > Finance > Posting Rules).

## Business settings confirmed on 29 September 2026

| Setting | Value |
|---|---|
| Billing mode | Broker-billed by default; direct bill chosen at issue or later |
| Direct bill | VAT 12% added on top of the commission; insurer withholds EWT 10% (BIR Form 2307); debit note due 30 days after its date |
| CTPL | Insurance Commission tariff per vehicle class, annual 300.40 to 1,500.40; 3-year cover for brand-new private cars 1,660.40; added outside the taxed net premium and never discounted |
| Auto Passenger PA | Limit per person x seats x 0.1%; limits 25,000 to 200,000 |

Both tariffs are maintained in the Product Configurator (template MOT-003-2025, tab "CTPL & Auto PA").
