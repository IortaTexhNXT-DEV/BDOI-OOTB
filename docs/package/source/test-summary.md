---
title: Test Summary Report
subtitle: BrokerVerse OOTB release readiness
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
open_item: 8 defects and observations open (Medium 3, Low 5); see the chapter Defects and observations
acronyms: OOTB=Out of the box; UAT=User acceptance test; QA=Quality assurance; API=Application programming interface; OR=Official receipt; JV=Journal voucher; PV=Payment voucher; RFQ=Request for quotation; CTPL=Compulsory third party liability; APPA=Auto passenger personal accident; BIR=Bureau of Internal Revenue; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; TB=Trial balance; GL=General ledger; 2FA=Two-step verification; TOTP=Time-based one-time password; SMTP=Simple Mail Transfer Protocol
---

# Scope and approach

This report records the testing of BrokerVerse OOTB before release: what was tested, how, on which environment and data, what passed, what failed and what is still open. It goes with the workbook **BrokerVerse_Test_Cases.xlsx**, which holds every test case with its steps, test data, expected and actual result, status and evidence.

## Scope

The test covered the whole broking cycle of a Philippine non-life broker, one module at a time and end to end:

- Sign-in and security, user and role administration, masters, configuration and document numbering, product configurator.
- Sales: prospects, quick quote and insurer comparison, quotations and customer response, requests for quotation, placement slips.
- Policy: motor with CTPL, package and non-package issuance, endorsements, cancellations, claims, renewals.
- Money: open items and payment capture, billing and official receipts, collections and credit control, disbursement, remittance to insurers, direct bill, commission, petty cash.
- Accounting: journal vouchers (correction, reversal), period end (month-end and year-end), bank and insurer reconciliation, BIR tax reports.
- Reinsurance, incentives, reports, dashboards, schedules, e-mail outbox, audit trail, role-based access per persona, and the go-live data load.

Out of scope for this cycle: load and stress testing, browsers other than Chromium, mobile layouts, live payment gateway keys and delivery of e-mail to real mailboxes (no SMTP server in the test environment).

## Approach

Each test case is written for manual execution: numbered steps on screen, concrete test data and an observable expected result. The status of each case was set from recorded evidence only:

- **Business-rule regression run** of the backend (634 tests, 03 October 2026). Each rule and negative case is mapped to the test that exercises it; the file and test name are in the Traceability sheet.
- **Front-end unit tests** (11 suites, 43 tests): menu permissions, screen access, quotation input checks, bank account checks, sign-in screen.
- **End-to-end UAT cycle** on a fresh database: 371 business steps run with one user per role through the same services the screens use, from set-up to month-end close and reports.
- **Screen check**: every menu screen opened in Chromium as the administrator and as six role users, recording access, console errors, failed requests and clipped content.

A case without evidence from these runs is marked Not Run, and one that cannot be run in this environment is marked Blocked. A case is marked Fail when the result differs from the expected result; each Fail has a defect or gap in the register.

# Environment and data

| Item | Value |
|---|---|
| Build | Production build of the web application (brokerverse) served with the backend API |
| Database | Fresh PostgreSQL database: reference data seed, then the UAT data set |
| Business date | 04 October 2026 (Asia/Manila); data spread over May to October 2026 |
| Browser | Chromium, 1440 x 900 |
| E-mail | Sending off; customer answers recorded as customer responses |
| Payment gateway | Sandbox only |
| Execution | 03 to 04 October 2026 (the UAT cycle ran across midnight Manila time) |

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

## UAT data set

The data set is fictional and follows Philippine formats: 7 insurers with their credit terms, 25 commission rate rows, 2 bank accounts linked to the ledger, 14 in-force policies migrated at go-live, 61 prospects, 62 new policies and 6 renewal terms issued across motor, CTPL, personal accident, travel, householder, fire, IAR, CAR, EAR, marine, CGL, money, employee benefits and surety bond, 58 receipts, 8 claims, 22 insurer settlements, 6 bank statements and 3 insurer statements.

# Test execution summary by module

497 test cases were prepared. 480 passed, 8 failed, 3 are blocked by the environment and 6 were not run in this cycle. The pass rate over all cases is 97%; over the cases executed it is 98%.

| Module | Total | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|---|
| Sign-in and security | 35 | 28 | 4 | 1 | 2 |
| User and role administration | 16 | 16 | 0 | 0 | 0 |
| Masters | 21 | 20 | 1 | 0 | 0 |
| Configuration and numbering | 17 | 17 | 0 | 0 | 0 |
| Product configurator | 10 | 9 | 1 | 0 | 0 |
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
| Role-based access | 19 | 17 | 2 | 0 | 0 |
| **Total** | **497** | **480** | **8** | **3** | **6** |

## By test type

| Test type | Total | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|---|
| Functional | 172 | 163 | 5 | 3 | 1 |
| Negative | 75 | 73 | 0 | 0 | 2 |
| Validation | 39 | 37 | 0 | 0 | 2 |
| Integration | 38 | 38 | 0 | 0 | 0 |
| Role access | 39 | 36 | 2 | 0 | 1 |
| Report | 69 | 69 | 0 | 0 | 0 |
| Accounting | 65 | 64 | 1 | 0 | 0 |

## Cases not passed

| TC ID | Scenario | Status | Defect |
|---|---|---|---|
| BV-SEC-004 | Login with blank User ID and Password | Not Run | - |
| BV-SEC-013 | Forgot password with a verification code | Blocked | - |
| BV-SEC-020 | Idle session signs out after the configured minutes | Not Run | - |
| BV-SEC-032 | Dependency audit of the release build | Fail | BV-DEF-001 |
| BV-SEC-033 | Personal data encrypted at application level | Fail | BV-DEF-003 |
| BV-SEC-034 | Record client consent under the Data Privacy Act | Fail | BV-DEF-002 |
| BV-SEC-035 | Log and answer a data subject access or erasure request | Fail | BV-DEF-002 |
| BV-MST-019 | Premium taxes and LGU rates maintained by Accounting | Fail | BV-DEF-006 |
| BV-PCF-005 | Rating factors list shows which template each factor belongs to | Fail | BV-DEF-004 |
| BV-QUO-010 | Customer approves through the link | Blocked | - |
| BV-CLM-008 | Settle date before issue date refused on screen | Not Run | - |
| BV-REM-004 | Settlement below minimum amount held | Not Run | - |
| BV-PCH-006 | Request above the max limit | Not Run | - |
| BV-RPT-006 | Own production only for a scoped agent | Not Run | - |
| BV-EML-003 | Retry while sending is on | Blocked | - |
| BV-RBA-016 | Accounting: every permitted screen loads its data without error | Fail | BV-DEF-006, BV-OBS-008 |
| BV-RBA-019 | Accounting Manager: every permitted screen loads its data without error | Fail | BV-DEF-006, BV-OBS-008 |

> Blocked cases need an SMTP server (password reset by e-mail, customer approval link by e-mail, outbox retry while sending is on). Not Run cases are screen-only checks or timed checks planned for the next manual cycle.

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

Not tested in this cycle: an external penetration test, and privacy processes (consent, data subject requests, anonymisation), which the product does not support yet (BV-DEF-002).

# Performance observations

No load or stress test was run. The following timings were observed during the functional runs on a single server and are recorded for information only:

- UAT cycle: 2,116 API calls with database writes in 24 seconds, about 11 ms per call on average, run one after the other.
- Backend regression run: 634 tests in about 4 minutes 43 seconds.
- Screen check: every screen loaded its data within the 2.6-second wait used per screen; no time-out was recorded.

> Recommendation: run a load test with the client's expected number of concurrent users and month-end volumes on the production-sized server before go-live.

# Defects and observations

| ID | Title | Module | Severity | Type | Status |
|---|---|---|---|---|---|
| BV-DEF-001 | Front-end library react-router has a moderate security advisory (open redirect) | Sign-in and security | Medium | Defect | Open |
| BV-DEF-002 | Data privacy features not built: consent capture, data subject request register, anonymisation | Sign-in and security | Medium | Gap | Open |
| BV-DEF-003 | Application-level encryption covers only two-step verification secrets | Sign-in and security | Medium | Gap | Open |
| BV-DEF-004 | Product configurator component list does not show the template; per-template rating factors look duplicated | Product configurator | Low | Defect | Open |
| BV-OBS-005 | Renewal of a policy expired beyond the grace plus lapsed-renewal window is refused | Renewals | Low | Observation | Open |
| BV-DEF-006 | Premium Taxes & LGU Rates: product list of the charges calculator does not load for Accounting | Masters | Low | Defect | Open |
| BV-OBS-007 | Menu group Master > Generals > Organization has an address that opens "Page not found" | Screen checks (all menus) | Low | Observation | Open |
| BV-OBS-008 | Accounts > Incentive > My Programs: Achievement Overview card extends past the right edge at 1440 px | Incentives | Low | Observation | Open |

## BV-DEF-001: Front-end library react-router has a moderate security advisory (open redirect)

npm audit of the front-end runtime dependencies reports 2 moderate findings, both in react-router (open redirect). The fixed version is a new major release. Backend runtime dependencies report 0 vulnerabilities.

- Workaround: The application builds its navigation targets from its own menu and routes and does not redirect to addresses taken from the URL. Keep the web server allowing only the application origin.
- Target: Next minor release: upgrade react-router to the fixed major version and re-test navigation

## BV-DEF-002: Data privacy features not built: consent capture, data subject request register, anonymisation

No screen records client consent (date, purpose, channel), no register tracks data subject access or erasure requests, and there is no function to anonymise an inactive client. Needed for Data Privacy Act compliance processes.

- Workaround: Keep consent forms and the request log outside the system (signed forms filed against the client code; request register kept by the Data Protection Officer).
- Target: Product backlog; to be scheduled with the client

## BV-DEF-003: Application-level encryption covers only two-step verification secrets

Only TOTP secrets are encrypted with DATA_ENCRYPTION_KEY. Client personal data (TIN, ID numbers, contact details) is stored in plain database columns.

- Workaround: Use encrypted storage for the database server and backups, restrict database access to the support team, and keep backups encrypted.
- Target: Product backlog; field-level encryption of personal identifiers

## BV-DEF-004: Product configurator component list does not show the template; per-template rating factors look duplicated

On Product Configurator > Rating Engine (and the other component lists) the rows do not show which template they belong to. Factors with the same name on different templates appear as duplicates.

- Workaround: Open the factor to see its template, or filter by template where the screen offers it.
- Target: Next minor release

## BV-OBS-005: Renewal of a policy expired beyond the grace plus lapsed-renewal window is refused

A renewal requested for a policy that expired more than grace days plus lapsed-renewal days ago is refused (HTTP 422). This is by design: such a risk is quoted as new business. In the UAT cycle 3 migrated policies were refused this way.

- Workaround: Quote the client as new business from the prospect or client record.
- Target: No change planned; confirm the window settings with the client at configuration

## BV-DEF-006: Premium Taxes & LGU Rates: product list of the charges calculator does not load for Accounting

Screen check of 03 October 2026: signed in as liza.quiambao (accounting) or teresa.villaroman (accounting-manager), Master > Finance > Premium Taxes & LGU Rates opens, but its request GET /placements/options is refused with 403 (the role has no placement read permission). The product drop-down of the charges calculator stays empty. Rules and LGU rates can still be maintained.

- Workaround: Run the charges calculation as the System Administrator, or check the charges on a test quotation.
- Target: Next patch: let the screen read the product list through a permission Accounting holds

## BV-OBS-007: Menu group Master > Generals > Organization has an address that opens "Page not found"

The menu group Organization carries its own address (/master/generals/organization) with no screen behind it. Typing the address shows "Page not found" for every user, including the administrator. Company and Branch under it open normally. No data is shown.

- Workaround: Open Company or Branch from the menu.
- Target: Next minor release: remove the address from the group or open the Company screen

## BV-OBS-008: Accounts > Incentive > My Programs: Achievement Overview card extends past the right edge at 1440 px

Screen check at 1440 x 900: the Achievement Overview card on My Programs is wider than the content area and is cut off on the right (administrator and accounting users).

- Workaround: Collapse the side menu or zoom the browser to 90%.
- Target: Next minor release

Open items by severity: Critical 0, High 0, Medium 3, Low 5.

# Entry and exit criteria

## Entry criteria

| Criterion | Met |
|---|---|
| Production build of front end and backend available | Yes |
| Fresh PostgreSQL database seeded with reference data | Yes |
| One test user per role, plus a second user where maker and checker are needed | Yes |
| UAT data set loaded | Yes |
| Test cases reviewed and mapped to evidence | Yes |

## Exit criteria

| Criterion | Status |
|---|---|
| All High priority cases executed | Met |
| No open Critical or High defect | Met |
| End-to-end cycle without failed step | Met (371 of 371) |
| Backend regression run without failure | Met (634 of 634) |
| Every menu screen opens for the administrator | Met |
| Open Medium and Low items have a workaround and a target | Met |

# Release recommendation

To be completed by the release manager.
