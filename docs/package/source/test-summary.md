---
title: Test Summary Report
subtitle: BrokerVerse OOTB release readiness
version: 1.2
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Version 1.2: test runs of 04 October 2026 (1,035 backend, 36 package B, 162 front-end tests); 132 test cases for the new modules; counts per test file area; coverage by module and by process (Requirements Traceability). Version 1.1: re-test after fixes
open_item: 2 defects open (Medium 2: BV-DEF-001, BV-DEF-003, the latter fixed in package B, being merged); 3 cases blocked until SMTP is available; 12 cases not run (6 from the first cycle, 2 Philippine master screen checks, 4 features in development); see the chapter Defects and observations
open_item_status: Open
acronyms: OOTB=Out of the box; UAT=User acceptance test; QA=Quality assurance; API=Application programming interface; OR=Official receipt; JV=Journal voucher; PV=Payment voucher; RFQ=Request for quotation; CTPL=Compulsory third party liability; COC=Certificate of cover; APPA=Auto passenger personal accident; BIR=Bureau of Internal Revenue; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; EOPT=Ease of Paying Taxes Act; CAS=Computerized accounting system; EIS=Electronic Invoicing System; DAT=BIR validation data file; TB=Trial balance; GL=General ledger; 2FA=Two-step verification; TOTP=Time-based one-time password; SMTP=Simple Mail Transfer Protocol; AML=Anti-money laundering; CFT=Countering the financing of terrorism; AMLC=Anti-Money Laundering Council; EDD=Enhanced due diligence; CTR=Covered transaction report; STR=Suspicious transaction report; IC=Insurance Commission; NPC=National Privacy Commission; PSGC=Philippine Standard Geographic Code; LOA=Letter of authority; PDC=Post-dated cheque; RTM=Requirements traceability matrix
---

# Scope and approach

This report records the testing of BrokerVerse OOTB before release: what was tested, how, on which environment and data, what passed, what failed and what is still open. It goes with the workbook **BrokerVerse_Test_Cases.xlsx**, which holds every test case with its steps, test data, expected and actual result, status, regulatory reference and evidence, the traceability of each case to the automated tests, and the Requirements Traceability sheet from the process catalogue to the test cases. The way the product is tested is set out in the Test Strategy; the testing of one broker implementation in the Test Plan.

## Scope

The test covered the whole broking cycle of a Philippine non-life broker, one module at a time and end to end:

- Sign-in and security, user and role administration, enterprise side menu, menu search, Help panel (F1) and skeleton loading.
- Masters, including the Philippine reference masters (PSGC 2Q 2026 regions, provinces, cities and municipalities, barangays, ZIP codes, banks, government ID types, salutations, holidays, IC insurer list), configuration and document numbering.
- Product Configurator connected to the flow: acceptance rules (refer, decline, loading with authority), rating factors, document templates with merge fields, market mapping, governing template.
- My Work: My Items, My Team by reporting line, My Tasks and Calendar.
- Sales and distribution: prospects, lead assignment, distribution channels, dealer programmes, quick quote and insurer comparison, quotations and customer response, requests for quotation, placement slips, comparison reports, campaigns.
- Policy: motor with CTPL (COC series and authentication), package and non-package issuance, fleet schedules, marine open covers, cover notes, endorsements, computed cancellations (pro-rata, short-period, flat), claims with the document checklist and motor repairs, renewals.
- Money: payments, billing and receipts, post-dated cheques, instalment invoices, collections and credit control, disbursement, bank payment files, remittance to insurers, direct bill, commission with the licence check, insurer overrides, petty cash, claims settlements paid through the broker.
- Accounting: journals, period end, bank and insurer reconciliation, accounts payable, fixed assets and depreciation.
- Tax: BIR 2307, VAT summary, SAWT, QAP, SLSP, 0619-E, 1601-EQ, 1604-E, 2551Q, DAT files, EOPT sales invoices, CAS books, EIS connector.
- Compliance: AML/CFT (onboarding, risk rating, EDD, screening, transaction alerts, cases, AMLC report files); Insurance Commission (licence register, fit and proper, insurer authority, complaints, annual statement, production report); data privacy (consent, data subject requests, breach register, masking by role, field encryption).
- Reinsurance (treaties, cessions, recoveries, facultative placements), incentives, reports, report builder and BI extract, dashboards, schedules, e-mail outbox, integrations (connectors, SMS and Viber, insurer API), branding and e-signatures, audit trail, role-based access per persona.
- Go-live and environments: go-live data workbench, environment comparison, transaction reset, client data masking tool, release pipeline checks, go-live rehearsal.

Out of scope for this cycle: load and stress testing, an external penetration test, browsers other than Chromium, mobile layouts, live keys of third-party providers (payment gateways, SMS, CTPL authentication, insurer APIs, BIR EIS, screening provider) and delivery of e-mail to real mailboxes (no SMTP server in the test environment).

The IC and data privacy compliance package (package B) was tested on its own branch, which is being merged into the release. The features of package G (sales activity log, quote wizard covers and risk fields from the Product Configurator, supplier BIR 2307, fixed asset disposal) are still in development; their test cases are written and marked Not Run.

## Approach

Each test case is written for manual execution: numbered steps on screen, concrete test data and an observable expected result. The status of each case was set from recorded evidence only:

- **Backend regression run** of 04 October 2026: 97 test files, 1,035 tests, all passed (vitest against PostgreSQL, about 9 minutes 21 seconds, one file after another). Each rule and negative case is mapped to the test that exercises it; the file and test name are in the Traceability sheet.
- **Package B compliance tests** of 04 October 2026, run from that branch: 3 files, 36 tests, all passed (IC compliance, breach register, personal data protection).
- **Front-end unit tests** of 04 October 2026: 31 suites, 162 tests, all passed (jest through craco, about 49 seconds).
- **End-to-end UAT cycle** on a fresh database: 371 business steps run with one user per role through the same services the screens use, from set-up to month-end close and reports (run log `docs/e2e/UAT_SCENARIO_RUN.md`).
- **Go-live rehearsal** between two environments: 51 checks, all passed (run log `docs/e2e/GOLIVE_REHEARSAL_RUN.md`).
- **Screen check**: every menu screen opened in Chromium as the administrator and as six role users, recording access, console errors, failed requests and clipped content.

A case without evidence from these runs is marked Not Run, and one that cannot be run in this environment is marked Blocked. A case is marked Fail when the result differs from the expected result; each Fail has a defect or gap in the register.

# Environment and data

| Item | Value |
|---|---|
| Build | Branch brokerverse-platform as of 04 October 2026; production build of the web application served with the backend API for the UAT cycle and screen check |
| Automated tests | Backend: a throwaway PostgreSQL database rebuilt from the migrations and seeds by each test file; front end: jsdom |
| Database for the UAT cycle | Fresh PostgreSQL database: reference data seed, then the UAT data set |
| Business date | 04 October 2026 (Asia/Manila); data spread over May to October 2026 |
| Browser | Chromium, 1440 x 900 |
| E-mail | Sending off; customer answers recorded as customer responses |
| Third-party connectors | Test mode (built-in test providers) |
| Execution | 03 to 04 October 2026 |

## Test users

| User | Role | Used for |
|---|---|---|
| BrokerVerse | system-admin | Set-up, masters, configuration, screen check of every menu |
| beatriz.lacson | system-admin | Masters, commission matrix, incentive programs |
| maria.rivera, paolo.dizon | sales | Prospects, quotations, customer responses, payment capture |
| jose.bernardo, rica.fernandez | processing | RFQ, placement, issuance, renewals, reinsurance (maker and checker) |
| ana.buenaventura | operations | Endorsements, cancellations, client servicing |
| carlo.estrada, joy.macaraeg | claims | Claims registration and settlement (maker and checker) |
| liza.quiambao, nestor.pangilinan | accounting | Receipts, remittance, disbursement, reconciliation (maker and checker) |
| teresa.villaroman, ramon.almario | accounting-manager | Approvals, credit limits, month-end close |
| Compliance officer (test user per test file) | compliance-officer | AML decisions, EDD approval, AMLC files |

## UAT data set

The data set is fictional and follows Philippine formats: 7 insurers with their credit terms, 25 commission rate rows, 2 bank accounts linked to the ledger, 14 in-force policies migrated at go-live, 61 prospects, 62 new policies and 6 renewal terms issued across motor, CTPL, personal accident, travel, householder, fire, IAR, CAR, EAR, marine, CGL, money, employee benefits and surety bond, 58 receipts, 8 claims, 22 insurer settlements, 6 bank statements and 3 insurer statements.

# Automated test results

## Backend by test file area

Run of 04 October 2026: `npx vitest run` in `backend/`, 97 files, 1,035 tests, 0 failed, 0 skipped.

| Area | Files | Tests | Passed | Failed |
|---|---|---|---|---|
| Security, access, users and roles | 13 | 115 | 115 | 0 |
| Masters, Philippine reference data, configuration and numbering | 9 | 114 | 114 | 0 |
| Product Configurator, rules in the flow and pricing | 6 | 75 | 75 | 0 |
| Sales, placement and policy issuance | 10 | 86 | 86 | 0 |
| Endorsements, renewals and claims | 3 | 34 | 34 | 0 |
| Operations and accounting extensions (cover notes, cancellation, PDC, instalment invoices, claim documents, motor repairs, claims settlements, payables, fixed assets) | 1 | 29 | 29 | 0 |
| Billing, collection, disbursement and remittance | 10 | 89 | 89 | 0 |
| Commission, incentives and insurer overrides | 4 | 22 | 22 | 0 |
| Accounting, period end and reconciliation | 9 | 88 | 88 | 0 |
| BIR forms and invoicing | 1 | 13 | 13 | 0 |
| Reinsurance and distribution | 8 | 61 | 61 | 0 |
| AML/CFT, data privacy and audit trail | 3 | 54 | 54 | 0 |
| Reports, dashboards, documents, e-mail and notifications | 8 | 80 | 80 | 0 |
| My Work | 1 | 21 | 21 | 0 |
| Integrations, branding and e-signatures | 2 | 35 | 35 | 0 |
| Go-live, environments, reset, masking and scheduler | 8 | 105 | 105 | 0 |
| Regression of UAT findings | 1 | 14 | 14 | 0 |
| **Total** | **97** | **1,035** | **1,035** | **0** |

## Package B compliance tests

| Test file (package B branch) | Tests | Passed |
|---|---|---|
| ic-compliance.test.js: licence register and payout block, fit and proper, insurer authority, IC production report and annual statement, complaints | 18 | 18 |
| personal-data-protection.test.js: field encryption, exact TIN search, key rotation, masking by role, masked exports, on-request reveal | 12 | 12 |
| data-breaches.test.js: breach register, 72-hour clock, NPC criteria, reminders, annual report | 6 | 6 |
| **Total** | **36** | **36** |

These results are evidence for the IC compliance and personal data protection test cases. They are run again on the release branch once package B is merged.

## Front end by test file area

Run of 04 October 2026: `CI=true npx craco test --watchAll=false` in `brokerverse/`, 31 suites, 162 tests, 0 failed.

| Area | Suites | Tests | Passed | Failed |
|---|---|---|---|---|
| Navigation, menus, route guard and help | 6 | 38 | 38 | 0 |
| Shared components and utilities (tables, skeleton loading, formats, runtime configuration) | 8 | 39 | 39 | 0 |
| Forms, addresses and services | 7 | 26 | 26 | 0 |
| My Work | 2 | 14 | 14 | 0 |
| Product Configurator | 2 | 13 | 13 | 0 |
| Compliance, BIR, distribution and integrations screens | 5 | 24 | 24 | 0 |
| Theme engine, branding and contrast | 1 | 8 | 8 | 0 |
| **Total** | **31** | **162** | **162** | **0** |

Lint and the production build were not part of this run; CI runs them on every push.

# Test execution summary by module

629 test cases are in the workbook: the 497 of the first cycle and 132 added on 04 October 2026 for the new modules. 612 passed, 2 failed, 3 are blocked by the environment and 12 were not run in this cycle. The pass rate over all cases is 97.3%; over the cases executed (passed or failed) it is 99.7%.

| Module | Total | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|---|
| Sign-in and security | 35 | 30 | 2 | 1 | 2 |
| User and role administration | 16 | 16 | 0 | 0 | 0 |
| Masters | 21 | 21 | 0 | 0 | 0 |
| Configuration and numbering | 17 | 17 | 0 | 0 | 0 |
| Product configurator | 10 | 10 | 0 | 0 | 0 |
| Go-live data load | 8 | 8 | 0 | 0 | 0 |
| Prospects and clients | 12 | 12 | 0 | 0 | 0 |
| Quick quote and compare insurers | 9 | 9 | 0 | 0 | 0 |
| Quotations and customer response | 16 | 15 | 0 | 1 | 0 |
| Request for quotation and placement | 13 | 13 | 0 | 0 | 0 |
| Policy issuance | 15 | 15 | 0 | 0 | 0 |
| Endorsements and cancellations | 13 | 13 | 0 | 0 | 0 |
| Claims | 15 | 14 | 0 | 0 | 1 |
| Renewals | 16 | 16 | 0 | 0 | 0 |
| Open items and payments | 10 | 10 | 0 | 0 | 0 |
| Billing and receipts | 13 | 13 | 0 | 0 | 0 |
| Collections and credit control | 10 | 10 | 0 | 0 | 0 |
| Disbursement and payment vouchers | 6 | 6 | 0 | 0 | 0 |
| Remittance to insurers | 15 | 14 | 0 | 0 | 1 |
| Direct bill | 10 | 10 | 0 | 0 | 0 |
| Commission and referrers | 10 | 10 | 0 | 0 | 0 |
| Petty cash | 7 | 6 | 0 | 0 | 1 |
| Journal vouchers and ledger | 16 | 16 | 0 | 0 | 0 |
| Period end | 16 | 16 | 0 | 0 | 0 |
| Bank reconciliation | 15 | 15 | 0 | 0 | 0 |
| Insurer reconciliation | 6 | 6 | 0 | 0 | 0 |
| Tax (BIR) | 9 | 9 | 0 | 0 | 0 |
| Reinsurance | 7 | 7 | 0 | 0 | 0 |
| Incentives | 6 | 6 | 0 | 0 | 0 |
| Reports | 45 | 44 | 0 | 0 | 1 |
| Dashboards | 8 | 8 | 0 | 0 | 0 |
| E-mail outbox and notifications | 6 | 5 | 0 | 1 | 0 |
| Audit trail | 4 | 4 | 0 | 0 | 0 |
| End-to-end life cycle | 23 | 23 | 0 | 0 | 0 |
| Screen checks (all menus) | 20 | 20 | 0 | 0 | 0 |
| Role-based access | 19 | 19 | 0 | 0 | 0 |
| Philippine reference masters | 9 | 7 | 0 | 0 | 2 |
| Navigation and help | 7 | 7 | 0 | 0 | 0 |
| My Work | 8 | 8 | 0 | 0 | 0 |
| Product rules in the flow | 9 | 9 | 0 | 0 | 0 |
| Go-live workbench and environments | 13 | 13 | 0 | 0 | 0 |
| AML/CFT | 12 | 12 | 0 | 0 | 0 |
| IC compliance | 11 | 11 | 0 | 0 | 0 |
| Personal data protection | 11 | 11 | 0 | 0 | 0 |
| BIR forms and invoicing | 11 | 11 | 0 | 0 | 0 |
| Operations extensions | 7 | 7 | 0 | 0 | 0 |
| Accounting extensions | 6 | 6 | 0 | 0 | 0 |
| Distribution | 11 | 11 | 0 | 0 | 0 |
| Integrations | 7 | 7 | 0 | 0 | 0 |
| Branding and e-signatures | 6 | 6 | 0 | 0 | 0 |
| Features in development | 4 | 0 | 0 | 0 | 4 |
| **Total** | **629** | **612** | **2** | **3** | **12** |

## By test type

| Test type | Total | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|---|
| Functional | 233 | 221 | 2 | 3 | 7 |
| Negative | 84 | 82 | 0 | 0 | 2 |
| Validation | 52 | 50 | 0 | 0 | 2 |
| Integration | 50 | 50 | 0 | 0 | 0 |
| Role access | 48 | 47 | 0 | 0 | 1 |
| Report | 80 | 80 | 0 | 0 | 0 |
| Accounting | 82 | 82 | 0 | 0 | 0 |

## Coverage of the process catalogue

The sheet Requirements Traceability maps each of the 150 processes of the fit catalogue (process IDs 1.01 to 15.16 of the PH Fit and ASEAN Rollout Assessment) to its test cases and automated test files.

| Coverage | Processes |
|---|---|
| Test cases and automated tests, every mapped case passed | 128 |
| Test cases and automated tests, some mapped cases blocked or not run (for example module-wide mappings that include a Not Run report case) | 20 |
| Test cases passed on the UAT scenario evidence, no automated test file (13.09 SLSP sales and purchases) | 1 |
| No test case: checked by document review (14.14 data residency, a hosting option) | 1 |
| **Total** | **150** |

By authority, every IC, BIR, NPC and AMLC process of the catalogue has at least one passed test case, with automated evidence for all of them except 13.09 (UAT scenario evidence) and 14.14 (document review). The regulatory reference of each case (for example AMLA covered transaction PHP 500,000, NPC Circular 16-03, RA 11765, EOPT Act and RR 7-2024) is in the column Regulatory reference of the sheet Test Cases.

## Cases not passed

| TC ID | Scenario | Status | Defect or reason |
|---|---|---|---|
| BV-SEC-004 | Login with blank User ID and Password | Not Run | Screen-only check, next manual cycle |
| BV-SEC-013 | Forgot password with a verification code | Blocked | Needs SMTP |
| BV-SEC-020 | Idle session signs out after the configured minutes | Not Run | Timed check, next manual cycle |
| BV-SEC-032 | Dependency audit of the release build | Fail | BV-DEF-001 |
| BV-SEC-033 | Personal data encrypted at application level | Fail | BV-DEF-003 (fixed in package B, being merged) |
| BV-QUO-010 | Customer approves through the link | Blocked | Needs SMTP |
| BV-CLM-008 | Settle date before issue date refused on screen | Not Run | Screen-only check |
| BV-REM-004 | Settlement below minimum amount held | Not Run | Screen-only check |
| BV-PCH-006 | Request above the max limit | Not Run | Screen-only check |
| BV-RPT-006 | Own production only for a scoped agent | Not Run | Screen-only check |
| BV-EML-003 | Retry while sending is on | Blocked | Needs SMTP |
| BV-PHM-007 | Salutations, civil status, ID types, customer types, payment modes and holidays are delivered | Not Run | No automated test reads the practice masters seed; screen check in SIT |
| BV-PHM-008 | Philippine banks and the IC-licensed non-life insurers are delivered | Not Run | As above |
| BV-PKG-001 to BV-PKG-004 | Sales activity log, quote wizard from the Product Configurator, supplier 2307, fixed asset disposal | Not Run | In development (package G); run when merged |

> Blocked cases need an SMTP server (password reset by e-mail, customer approval link by e-mail, outbox retry while sending is on). Not Run cases are screen-only checks or timed checks planned for the next manual cycle, or features not yet merged.

# New modules: what was verified

| Module | Verified (automated evidence) |
|---|---|
| Philippine reference masters | 18 regions, 82 provinces and 1,642 cities and municipalities with PSGC codes; Province label; drill-down to barangays; ZIP code fill; barangay load with dry run; working-day deadlines of AML cases |
| Navigation and help | Master in sections, three levels at most; role menus and route guard; menu search; Help for this screen on every menu screen; support ticket prefilled; skeleton rows while loading |
| My Work | My Items by role, My Team by reporting line, approvals of others only, reassignment within the team, tasks with reminders, automatic follow-up tasks, calendar, data scope |
| Product rules in the flow | Auto-accept, refer to the authority role within its limit, decline, loading, rating factor, insurer-specific rules, market mapping on RFQ, uploaded document layouts with merge fields, CTPL certificate |
| Go-live workbench and environments | Kits, validation with sheet, row and column, errors workbook, reload without duplicates, cutover rules, reconciliation, go-live lock, environment comparison on screen and by command, transaction reset, masking with verification, register-production and remark-copy, migration lock between instances, rehearsal (51 checks) |
| AML/CFT | Onboarding of individual and juridical clients, signatories and beneficial owners, PEP and EDD block, risk factors and override, KYC refresh, list versions and rescreen, hit decisions blocking issue and payouts, covered and structured cash, third-party refunds, CTR file, STR case in working days, role limits, 5-year retention |
| IC compliance | Licence register and reminders, payout block and warn modes, fit and proper, insurer authority block and warn, production report by IC line and co-insurance share, annual statement with checks and mapping, complaints with deadlines, escalation and regulator report |
| Personal data protection | Breach register with the 72-hour clock, NPC criteria, reminders, annual report; masking by role on views and exports; on-request reveal audited; field encryption with blind index, exact TIN search and key rotation; consent and data subject requests; audit trail labels and masking |
| BIR forms and invoicing | 1601-EQ per ATC reconciled, 0619-E rules, PDF and Excel, 1604-E, DAT files equal to fixed expected files, 2551Q, EOPT sales invoices with serial range, EIS queue in test mode, CAS books, overriding commission computed, approved and posted |
| Operations extensions | Cover notes (issue, supersede, expire), short-period and pro-rata cancellation with reversal, partial cancellation, claim document checklist blocking submission, motor estimates and letters of authority, scheduler in Manila time |
| Accounting extensions | Post-dated cheques (register, deposit, bounce, replace), instalment invoices, claims settlements through the broker, supplier invoices with input VAT and EWT and approval, fixed assets with straight-line depreciation posted once |
| Distribution | Lead assignment rules and queue, channels with inheritance and Dealer Production, dealer programme uploads and subsidies, fleet schedules, marine open cover declarations, facultative placement and binding, comparison report without commission, campaigns with consent and opt-out, report builder and BI extract |
| Integrations | Connectors with credential variable names only, retries, consent check on SMS, COC allocation and authentication, keyed-in codes, series control, insurer API mapping, bank payment files with status import |
| Branding and e-signatures | Presets pass WCAG AA, failing contrast refused, branding before sign-in, branded PDFs, Excel and e-mails, signatures with consent on issued documents only, slot mapping, brand packs including the optional client pack |

# End-to-end cycle results

The business cycle ran on a fresh database on 03 to 04 October 2026 with one user per role: 371 steps, 2,116 API calls, 0 failed steps, in 24 seconds.

| Phase | Steps passed | Steps failed |
|---|---|---|
| Set-up | 46 | 0 |
| Go-live migration | 1 | 0 |
| Retail package business | 84 | 0 |
| Corporate non-package business | 45 | 0 |
| Billing and collection | 61 | 0 |
| Servicing: endorsements, renewals, claims | 31 | 0 |
| Money: remittances, commission, petty cash | 27 | 0 |
| Reinsurance and incentives | 2 | 0 |
| Reconciliation: bank and insurer statements | 10 | 0 |
| Month-end close | 6 | 0 |
| Reports and dashboards | 58 | 0 |
| **Total** | **371** | **0** |

## What the cycle produced

| Business result | Count |
|---|---|
| In-force policies migrated at go-live | 14 |
| Prospects (retail and corporate) | 61 |
| Insurer offers / declines recorded | 102 / 16 |
| Customer responses: accepted / declined / revise | 66 / 4 / 2 |
| Policies issued (retail) | 39 |
| Policies issued (corporate, incl. 1 recorded policy) | 23 |
| Renewal terms issued | 6 |
| Placement slips / insurer bindings | 22 / 36 |
| Official receipts by accounting / captures confirmed | 40 / 18 |
| Instalment plans / instalments paid | 4 / 4 |
| Premium warranty reminders / cancellation for non-payment | 5 / 1 |
| Direct bill client payments / debit notes approved / collected | 6 / 4 / 2 |
| Endorsements: additional / return / cancellation | 4 / 2 / 1 |
| Renewals completed / lapsed / refused after the window | 6 / 1 / 3 |
| Claims notified / settled and closed / closed without payment / open | 8 / 4 / 2 / 2 |
| Insurer remittances paid by cheque / approved awaiting cheque | 16 / 6 |
| Sub-agent commission lines approved / payouts | 5 / 2 |
| Petty cash requests paid | 3 |
| Reinsurance treaty / cessions | 1 / 3 |
| Bank statements / lines / matched by rules / by hand / adjustments | 6 / 78 / 56 / 5 / 15 |
| Bank reconciliations approved | 5 |
| Insurer statements / lines matched / reconciliations approved | 3 / 11 of 17 / 3 |
| Months closed / soft-closed | 4 / 1 |
| Reports run with rows / dashboards checked | 39 / 19 |

Every report of the catalogue returned rows for the test period and produced an Excel file. The trial balance was balanced at the end of the cycle and the sub-ledger tie-out of the month-end checklist passed.

## Life-cycle scenario

The 23-step life-cycle scenario of one motor policy (docs/e2e/E2E_TEST_PLAN.md) is in the workbook as module "End-to-end life cycle": 23 of 23 steps passed.

# Role-based access results

Each role user signed in and opened every one of the 173 menu screens, by menu and by typing the address. The table compares what the role opened with the grants of the role.

| User | Role | Screens granted | Screens opened | Opened outside the menu | Typed addresses refused | Screens with errors |
|---|---|---|---|---|---|---|
| maria.rivera | sales | 31 | 31 | 0 | 141 of 141 | 0 |
| jose.bernardo | processing | 41 | 41 | 0 | 131 of 131 | 0 |
| ana.buenaventura | operations | 29 | 29 | 0 | 143 of 143 | 0 |
| carlo.estrada | claims | 12 | 12 | 0 | 160 of 160 | 0 |
| liza.quiambao | accounting | 91 | 91 | 0 | 81 of 81 | 1 |
| teresa.villaroman | accounting-manager | 91 | 91 | 0 | 81 of 81 | 1 |

No role opened a screen outside its grants. The address of the menu group Master > Generals > Organization shows "Page not found" for every user, the administrator included, and is not counted as a screen (BV-OBS-007). Both accounting roles open every granted screen, but on Master > Finance > Premium Taxes & LGU Rates the product list of the charges calculator is refused (BV-DEF-006).

The server applies the same personas on every endpoint. The regression run confirms, among others, that sales and operations cannot post or read receipts, that claims officers do not list prospects, that scoped agents see only their own book, that maker and checker must be different users on every approval, and that approvals above the authority matrix limit are refused.

# Security testing performed

| Area | What was tested | Result |
|---|---|---|
| Authentication on every endpoint | Every non-public API route called without a token; list of public routes compared with the intended list | Every non-public route answered 401; only the intended public routes are open |
| Tokens | Algorithm other than HS256, refresh token reuse, deactivation and role change, 30-minute access token | Refused or revoked as expected |
| Password policy | Length 8, upper, lower, digit, symbol, history of 5, 90-day expiry, temporary passwords | Enforced on change, reset and user creation |
| Lockout and throttling | 5 failed sign-ins lock the account; sign-in rate limit per user and address; 2FA code rate limit; global API rate limit | Locked, 429 with Retry-After, unlock audited |
| Two-step verification | Enrolment, sign-in with code, forced enrolment by role, administrator reset | Works to RFC 6238; secrets encrypted |
| Role permission probes | Each persona against screens and endpoints outside its role; administrator-only actions by a user desk user | Refused |
| Injection probes | SQL and script text in search fields, HTML and script files renamed as documents, spreadsheet formulas in exports | No effect; uploads refused by file signature; CSV cells guarded |
| Documents | Signed links, expiry, attachment disposition, upload size limit | Refused without session or valid signature; 413 above the limit |
| Security headers | Standard security headers and request id on every response; generic 500 message | Present |
| Secrets and logs | Default secrets, CORS * and localhost base URL in production; tokens in the log | API refuses to start; no token in the log |
| Dependency audit | npm audit of runtime dependencies | Backend: 0 vulnerabilities. Front end: 2 moderate in react-router (BV-DEF-001) |

Since this table was recorded, the regression run of 04 October 2026 adds automated security checks for masking of personal identifiers by role, field encryption of TIN, ID and bank numbers (package B), the masking tool's refusal to run on Production and its verification scan, and the refusal of credential values in the integration connectors. Not tested in this cycle: an external penetration test.

# Performance observations

No load or stress test was run. The following timings were observed during the functional runs on a single server and are recorded for information only:

- UAT cycle: 2,116 API calls with database writes in 24 seconds, about 11 ms per call on average, run one after the other.
- Backend regression run: 1,035 tests in about 9 minutes 21 seconds (04 October 2026); front-end tests: 162 tests in about 49 seconds.
- Screen check: every screen loaded its data within the 2.6-second wait used per screen; no time-out was recorded.

> Recommendation: run a load test with the client's expected number of concurrent users and month-end volumes on the production-sized server before go-live.

# Defects and observations

| ID | Title | Module | Severity | Type | Status |
|---|---|---|---|---|---|
| BV-DEF-001 | Front-end library react-router has a moderate security advisory (open redirect) | Sign-in and security | Medium | Defect | Open |
| BV-DEF-002 | Data privacy features not built: consent capture, data subject request register, anonymisation | Sign-in and security | Medium | Gap | Closed |
| BV-DEF-003 | Application-level encryption covers only two-step verification secrets | Sign-in and security | Medium | Gap | Open |
| BV-DEF-004 | Product configurator component list does not show the template; per-template rating factors look duplicated | Product configurator | Low | Defect | Closed |
| BV-OBS-005 | Renewal of a policy expired beyond the grace plus lapsed-renewal window is refused | Renewals | Low | Observation | Closed |
| BV-DEF-006 | Premium Taxes & LGU Rates: product list of the charges calculator does not load for Accounting | Masters | Low | Defect | Closed |
| BV-OBS-007 | Menu group Master > Generals > Organization has an address that opens "Page not found" | Screen checks (all menus) | Low | Observation | Closed |
| BV-OBS-008 | Accounts > Incentive > My Programs: Achievement Overview card extends past the right edge at 1440 px | Incentives | Low | Observation | Closed |

## BV-DEF-001: Front-end library react-router has a moderate security advisory (open redirect)

npm audit of the front-end runtime dependencies reports 2 moderate findings, both in react-router (open redirect). The fixed version is a new major release. Backend runtime dependencies report 0 vulnerabilities.

- Workaround: The application builds its navigation targets from its own menu and routes and does not redirect to addresses taken from the URL. Keep the web server allowing only the application origin.
- Target: Next minor release: upgrade react-router to the fixed major version and re-test navigation

## BV-DEF-002: Data privacy features not built: consent capture, data subject request register, anonymisation

No screen records client consent (date, purpose, channel), no register tracks data subject access or erasure requests, and there is no function to anonymise an inactive client. Needed for Data Privacy Act compliance processes.

- Workaround: Keep consent forms and the request log outside the system (signed forms filed against the client code; request register kept by the Data Protection Officer).
- Target: Product backlog; to be scheduled with the client
- Status: Closed. Delivered on 03 October 2026: Master > Data Privacy (consent register, data subject requests with due dates, personal data export, anonymisation with a dry run) and the client Data privacy tab. Re-tested BV-SEC-034 and BV-SEC-035.

## BV-DEF-003: Application-level encryption covers only two-step verification secrets

Only TOTP secrets are encrypted with DATA_ENCRYPTION_KEY. Client personal data (TIN, ID numbers, contact details) is stored in plain database columns.

- Workaround: Use encrypted storage for the database server and backups, restrict database access to the support team, and keep backups encrypted.
- Target: Package B (IC and data privacy compliance), being merged: TIN, government ID and bank account numbers encrypted with `PII_ENCRYPTION_KEY`, with key rotation. Its tests passed on its branch on 04 October 2026 (BV-NPC-007, BV-NPC-008). Close after the merge and the re-test of BV-SEC-033.

## BV-DEF-004: Product configurator component list does not show the template; per-template rating factors look duplicated

On Product Configurator > Rating Engine (and the other component lists) the rows do not show which template they belong to. Factors with the same name on different templates appear as duplicates.

- Workaround: Open the factor to see its template, or filter by template where the screen offers it.
- Target: Next minor release
- Status: Closed. The component lists show a Template column (global rows read All products). Re-tested BV-PCF-005.

## BV-OBS-005: Renewal of a policy expired beyond the grace plus lapsed-renewal window is refused

A renewal requested for a policy that expired more than grace days plus lapsed-renewal days ago is refused (HTTP 422). This is by design: such a risk is quoted as new business. In the UAT cycle 3 migrated policies were refused this way.

- Workaround: Quote the client as new business from the prospect or client record.
- Target: No change planned; confirm the window settings with the client at configuration
- Status: Closed as by design.

## BV-DEF-006: Premium Taxes & LGU Rates: product list of the charges calculator does not load for Accounting

Screen check of 03 October 2026: signed in as liza.quiambao (accounting) or teresa.villaroman (accounting-manager), Master > Finance > Premium Taxes & LGU Rates opens, but its request GET /placements/options is refused with 403 (the role has no placement read permission). The product drop-down of the charges calculator stays empty. Rules and LGU rates can still be maintained.

- Workaround: Run the charges calculation as the System Administrator, or check the charges on a test quotation.
- Target: Next patch: let the screen read the product list through a permission Accounting holds
- Status: Closed. The screen reads the product list with a permission Accounting holds. Re-tested BV-MST-019, BV-RBA-016 and BV-RBA-019.

## BV-OBS-007: Menu group Master > Generals > Organization has an address that opens "Page not found"

The menu group Organization carries its own address (/master/generals/organization) with no screen behind it. Typing the address shows "Page not found" for every user, including the administrator. Company and Branch under it open normally. No data is shown.

- Workaround: Open Company or Branch from the menu.
- Target: Next minor release: remove the address from the group or open the Company screen
- Status: Closed. Menu groups no longer carry an address of their own.

## BV-OBS-008: Accounts > Incentive > My Programs: Achievement Overview card extends past the right edge at 1440 px

Screen check at 1440 x 900: the Achievement Overview card on My Programs is wider than the content area and is cut off on the right (administrator and accounting users).

- Workaround: Collapse the side menu or zoom the browser to 90%.
- Target: Next minor release
- Status: Closed. The card fits the content area at 1440 px. Re-tested BV-RBA-016 and BV-RBA-019.

Open items by severity: Critical 0, High 0, Medium 2, Low 0. Six items were closed on 03 October 2026.

# Entry and exit criteria

## Entry criteria

| Criterion | Met |
|---|---|
| Release branch built; CI suites runnable on PostgreSQL 16 | Yes |
| Fresh PostgreSQL database seeded with reference data | Yes |
| One test user per role, plus a second user where maker and checker are needed | Yes |
| UAT data set loaded | Yes |
| Test cases reviewed and mapped to evidence and to the process catalogue | Yes |

## Exit criteria

| Criterion | Status |
|---|---|
| All High priority cases executed | Not met for 1 case: BV-SEC-013 (Blocked, needs SMTP); the other 313 High cases executed |
| No open Critical or High defect | Met |
| End-to-end cycle without failed step | Met (371 of 371) |
| Go-live rehearsal without failed check | Met (51 of 51) |
| Backend regression run without failure | Met (1,035 of 1,035 on 04 October 2026) |
| Front-end tests without failure | Met (162 of 162 on 04 October 2026) |
| Package B compliance tests without failure | Met on its branch (36 of 36); to be run again after the merge |
| Every process of the catalogue traced to a test case or a document review | Met (150 of 150) |
| Every menu screen loads without error for the administrator and the Accounting roles | Met in the screen check of 03 October 2026 (173, 96 and 96 screens); the screens added since are covered by the front-end screen tests and are to be included in the next screen sweep |
| Open Medium and Low items have a workaround and a target | Met |

# Re-test and regression after fixes (03 October 2026)

After the first run, the open defects and the gaps found in the user manual walk-through were fixed on 03 October 2026, together with the e-mail attachments, the approval notifications, the single source of currency and tax settings, the consolidation of duplicated screens and the screen stability pass. The fixed cases were then re-tested on a fresh database loaded with the UAT data set:

| Check | Result |
|---|---|
| Backend regression suite | 717 of 717 tests passed (72 test files) |
| Front-end tests | 53 of 53 passed; lint without errors; production build compiles |
| End-to-end UAT scenario on a fresh database | 371 of 371 steps passed; two remittances above PHP 1,000,000.00 were refused for Accounting and approved by an Accounting Manager, as the Authority Matrix requires |
| Screen sweep at 1440 px | Administrator 173 screens, Accounting 96, Accounting Manager 96: no refused request, no console error, no clipped element, no horizontal scroll |
| Data privacy through the API | Consent recorded and read back; request DSR-2026-00001 logged with a due date 15 days after receipt; personal data export produced; anonymisation refused for a client with a policy in force |
| Product configurator | Template column shown on the Rating Engine, Coverage Builder, Acceptance Rules and Document Manager lists |

Six test cases moved from Fail to Pass (BV-SEC-034, BV-SEC-035, BV-MST-019, BV-PCF-005, BV-RBA-016, BV-RBA-019) and six items were closed (BV-DEF-002, BV-DEF-004, BV-OBS-005, BV-DEF-006, BV-OBS-007, BV-OBS-008).

# Release recommendation

From the test point of view the release can go to market: no Critical or High defect is open, the two open Medium items have a workaround and a target release (one of them fixed in package B, being merged), every automated test of the release branch passes, and the end-to-end cycle and the go-live rehearsal pass without a failed step. Before the release tag: merge package B and run the full suites again, and add the new screens to the screen sweep. Package G features join the release only with their automated tests and a passed run of their test cases. The conditions for the first production go-live (mail server, external penetration and load tests, client configuration and acceptance) are set out in the Go/No-Go Recommendation and Management Register.
