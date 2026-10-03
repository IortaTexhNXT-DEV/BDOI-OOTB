---
title: Release Notes and Product Roadmap
subtitle: BrokerVerse OOTB Release 1.0
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
open_item: Release tag of the final 1.0 build to be confirmed; re-test of the data privacy cases after the release test; roadmap dates indicative
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; NPC=National Privacy Commission; DPA=Data Privacy Act of 2012 (RA 10173); EOPT=Ease of Paying Taxes Act (RA 11976); CTPL=Compulsory Third Party Liability; LTO=Land Transportation Office; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; LGU=Local government unit; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; KYC=Know your customer; RFQ=Request for quotation; OR=Official receipt; PV=Payment voucher; JV=Journal voucher; GL=General ledger; SoD=Segregation of duties; TOTP=Time-based one-time password; API=Application programming interface; AMC=Annual Maintenance Contract; CR=Change request; UAT=User acceptance test
---

# About this release

## Release identification

| Item | Value |
|---|---|
| Product | iNXT BrokerVerse OOTB, insurance broking platform for Philippine non-life brokers |
| Release | 1.0 |
| Build | Branch `brokerverse-platform` of 03 October 2026; backend package version 1.0.0. The repository carries tag `v1.0.0` (29 September 2026); the tag of the final 1.0 build is [to confirm] |
| Technology | React 18 web application, Node.js 22 API, PostgreSQL 16 database |
| Release test | 03 to 04 October 2026; see the Test Summary Report |
| Audience | Broker management, key users, System Administrator, auditors, and the iorta TechNXT support team |

## Release in figures

| Item | Count |
|---|---|
| Delivered roles | 7 (System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager) |
| Menu screens checked per role in the release test | 173 |
| Catalogue reports in Excel, CSV and PDF | 39, plus dashboards and printed documents |
| Registered API routes | 854, documented in OpenAPI, Postman and an Excel touchpoint list |
| Scheduled jobs (Asia/Manila time) | 16, plus the overdue data subject request reminder (delivered switched off) |
| Document number series | 52 in the release test, counters that only move forward |
| Upload templates for go-live data | About 40, each verified against its importer |
| Test cases | 497 prepared: 480 passed, 8 failed, 3 blocked, 6 not run |
| Automated business-rule tests | 634, all passed |
| End-to-end UAT cycle | 371 business steps, 0 failed |

# What is delivered

## Sales and placement

| Capability | Main screens |
|---|---|
| Prospects with contact details, address and status, bulk upload | Operations > Sales & Marketing > Prospects |
| Quick Quote of packaged products from insurer rate tables; Compare Insurers | Quick Quote; Compare Insurers |
| Request for Quotation to several insurers on a broker slip; insurer offers and declines | Request for Quotation |
| Quotations with premium taxes and commission; customer response recorded on screen or through an approval link; maker-checker on quotations | Quotations |
| Placement Slips with lead insurer and co-insurers, shares totalling 100% | Placement Slips |
| Placement journey per line of business (`placement.journey`), shown as a progress bar | Master > Configuration |

## Policy, servicing, claims and renewals

| Capability | Main screens |
|---|---|
| Policy issue for package and non-package business, motor with CTPL and Auto Passenger PA, KYC checks before motor issue, co-insurance | Operations > Policy |
| Endorsements (additional premium, return premium, changes of details, extension) and cancellations, with taxes following the premium | Operations > Policy |
| Claims from notification to settlement and closure, preliminary loss advice, claim letters, settlement maker-checker, SLA ageing | Operations > Claims |
| Renewals: pipeline 90 days before expiry, notices at 60, 30 and 15 days, renewal batch and queue, at-risk policies, retention analytics, lapse management, win-back campaigns | Operations > Renewals |
| Clients with their policies and accounting position | Operations > Clients |

## Money and accounting

| Capability | Main screens |
|---|---|
| Open items, payment capture by sales and operations, acknowledgement receipts | Operations > Open Items; Payments |
| Billing, official receipts, receipt and invoice e-mails with PDF | Accounts > Receipts |
| Collections, reminders, credit control: instalment plans, premium warranty monitor, client credit limits, remittance ageing | Accounts > Collections; Credit Control |
| Disbursement and payment vouchers, petty cash from request to replenishment | Accounts > Disbursement; Petty Cash |
| Remittance to insurers by share, with tracking, statements, settlement, approval workflow, exceptions, electronic transfer records, agency bill and direct bill processing | Accounts > Remittance |
| Commission: referrer and sub-agent accounts, commission rate matrix, payout after collection with withholding | Commission |
| Incentive programmes, calculations, approvals and statements | Accounts > Incentive |
| General ledger from posting rules; Journal Voucher, Correction JV, Reversal JV; open entry matching | Accounts |
| Period End: period management, month-end close with checklist and sub-ledger tie-out, year-end close, recurring journals, financial statements | Accounts > Period End |
| Bank reconciliation with statement import (BDO, BPI, Metrobank and generic formats) and matching rules | Accounts > Bank Reconciliation |
| Insurer statement reconciliation with column mapping per insurer | Accounts > Insurer Reconciliation |
| Reinsurance: treaties, cessions, recoveries, bordereaux, reconciliation | Reinsurance |

## Configuration, controls and reporting

| Capability | Main screens |
|---|---|
| Product Configurator: product templates, coverage builder, rating engine, acceptance rules, document manager, approval workflows, market and risk mapping | Product Configurator |
| Masters for organisation, insurers, lines of business, products, covers, vehicles, locations, employees, finance | Master > Generals; Master > Finance |
| System Settings, Configuration by business area, Document Numbering, Schedules, E-mail Outbox, Audit Trail | Master |
| User management: users, roles, User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews | Master > Generals > User Management |
| Security: password policy, lockout, TOTP two-step verification by role, session rotation and idle sign-out, permission check on every API route | Master > Configuration |
| Data privacy: Consent Register, Data Subject Requests, personal data export, anonymisation with dry run | Master > Data Privacy |
| Reports: operational and financial reports, co-insurance register, due to insurers by co-insurer; dashboards for executives, claims, processing, sales and commission | Reports; Dashboard |
| Payment links through PayMongo and Dragonpay (sandbox provider for testing); a confirmed payment posts the official receipt | Master > Finance > Payment Gateways |

## Philippine rules built in

| Area | Rule as delivered |
|---|---|
| Premium taxes | DST 12.5% of net premium (or per PHP 4.00 unit, rounded up), VAT 12% for products under the VAT regime, LGT by the client's city or municipality (0.75% delivered default), FST 2% on fire lines; set in Master > Finance > Premium Taxes & LGU Rates |
| CTPL | 1-year and 3-year CTPL per vehicle class from the motor template MOT-003-2025; inclusive of taxes and fees, never discounted; certificate number and authentication code on the policy |
| KYC | Government ID type, number and image, chassis, motor and plate or MV file number required before motor issue; accepted IDs include PhilSys ID, UMID, passport and driver's licence |
| Commission tax | Output VAT on commission (VAT12-OUT); EWT on referrer commission by payee type (WI515 5% for agents and sub-agents, WC515 10% for external referrers, delivered); insurer EWT on direct-bill commission (WC139 10%) to Creditable Withholding Tax |
| BIR working papers | BIR Form 2307 issued and received, VAT Summary, SAWT, QAP, SLSP Sales and SLSP Purchases, in the BIR column order |
| Invoices and receipts | Number series for invoices, official receipts, debit notes and Form 2307; next numbers can continue the old system's numbering; cancelled documents kept with a reason |
| Local formats | Asia/Manila time zone, PHP base currency, +63 mobile numbers, Philippine provinces and cities with all NCR LGUs, Philippine banks |
| Data privacy | Consent per purpose with notice version; data subject requests due in 15 calendar days; anonymisation refused within 10 years of the last policy expiry |

# Known limitations and open items

## Open defects and observations from the release test

| ID | Item | Severity | Workaround | Target |
|---|---|---|---|---|
| BV-DEF-001 | react-router carries a moderate security advisory (open redirect) | Medium | Navigation targets come from the application's own routes; web server allows only the application origin | Next minor release |
| BV-DEF-002 | Data privacy features were not built at the release test | Medium | Consent Register, Data Subject Requests, export and anonymisation were delivered after the test (Master > Data Privacy); cases BV-SEC-034 and BV-SEC-035 to be re-run | Re-test [to confirm date] |
| BV-DEF-003 | Application-level encryption covers only two-step verification secrets | Medium | Encrypted database storage and backups; restricted database access | Product backlog |
| BV-DEF-004 | Product configurator component lists do not show the template; factors look duplicated | Low | Open the factor or filter by template | Next minor release |
| BV-OBS-005 | Renewal refused for a policy expired beyond grace plus lapsed-renewal days | Low | Quote as new business (by design) | No change |
| BV-DEF-006 | Premium Taxes & LGU Rates: charges calculator product list empty for Accounting roles | Low | Run the calculator as System Administrator, or check on a test quotation | Next patch |
| BV-OBS-007 | Address of the menu group Master > Generals > Organization opens "Page not found" | Low | Open Company or Branch from the menu | Next minor release |
| BV-OBS-008 | Incentive > My Programs: Achievement Overview card cut off at 1440 px | Low | Collapse the side menu or zoom to 90% | Next minor release |

Cases not run or blocked in the release test (SMTP-dependent checks, idle sign-out timing, some screen-only negative checks) are listed in the Test Summary Report and are planned for the next manual cycle.

## Limits of the OOTB scope

| Topic | Release 1.0 behaviour | Route |
|---|---|---|
| Insurer systems | No insurer API; slips, statements and debit notes by file and e-mail | Change request per insurer |
| IC report formats | Figures from financial statements and production reports; no IC-format report | Change request |
| Percentage tax | No working paper for a non-VAT broker | Ledger by insurer; change request |
| Anti-money laundering | No transaction monitoring, sanctions or PEP screening | Outside OOTB |
| Report schedules | Scheduled e-mail of reports exists in the API; no screen to set it up | System Administrator through the API |
| Bank payments | Transfers approved and recorded; no bank payment file | Change request per bank format |
| Two-step enrolment | Shows the key and a link, not a QR code | Users type the key into the authenticator app |
| Session tokens | Kept in browser local storage | Move to httpOnly cookie on the roadmap |
| Masters without Upload button | Templates loaded by the System Administrator through the API route | Upload buttons on the roadmap |
| Claim settlement cash | Settlement cash panel is on the claim screens; the System Administrator records funds on Accounting's instruction | Accounting menu extension on the roadmap |
| Mobile | Web application for desktop and laptop browsers (current Chrome, Edge or Firefox) | See roadmap |
| Language | English screens; no Filipino translation file | Change request |
| Load test | Not run; single-server timings only | Run on the production-sized environment before go-live |
| External penetration test | Not run | Commission before go-live |

## Before go-live at a broker

- Set `security.require_2fa_roles` to at least System Administrator, Accounting and Accounting Manager.
- Replace the default authority limits with the board-approved signing authority.
- Fill the BIR settings (registered name, address, TIN of the withholding agent).
- Confirm premium tax rules, LGU rates, ATC and GL accounts with the broker's tax adviser.
- Switch off the Sandbox payment gateway in production; enter live gateway keys in the secret store.
- Switch on "Send e-mails" only after the SMTP mailbox is tested.

# Upgrade and versioning policy

## Version numbers

Releases are numbered MAJOR.MINOR.PATCH and tagged in the repository (for example `v1.0.0`); `GET /api/version` shows the commit that is running.

| Type | Example | Content | Frequency (standard) |
|---|---|---|---|
| Patch | 1.0.1 | Defect fixes and security fixes; no change to how users work | As needed; emergency release for P1 or security |
| Minor | 1.1.0 | New functions, new reports, regulatory form updates, upgrades of components; existing data and settings kept | Planned releases, monthly when there are fixes or changes |
| Major | 2.0.0 | Changes that need a migration project, retraining or a change of hosting components | Announced at least 6 months ahead [to confirm] |

## Rules for every release

- Database changes only add to the schema; they are applied automatically when the API starts, under a lock, and recorded. The previous release runs on the newer schema, so a release can be rolled back by redeploying the previous image.
- Settings and master data changed by the broker are kept: the seed inserts only what is missing.
- Every release has release notes: fixes, changes, migrations and anything the System Administrator must do by hand.
- Each release is installed in the test environment first; the broker runs the UAT scripts for the changed areas; iorta TechNXT runs the regression; the CAB approves.
- A database snapshot is taken before deployment; deployment happens in the agreed maintenance window, announced at least 5 business days ahead.

## Entitlement and support of versions

- Updates of the OOTB version and regulatory form updates released for all customers are included while the subscription or the AMC is in force.
- Support covers the current release and the two planned releases before it (assumption in the Production Support Approach). A broker that stays further behind is asked to upgrade before a defect is fixed.
- Broker-specific changes made under a change request are carried forward into later releases only where the change request says so [to confirm the standard clause].

# Product roadmap

> **Indicative and not contractual.** The roadmap shows iorta TechNXT's current intentions. Content, order and timing may change. It is not a commitment to deliver any function, it is not part of any licence, subscription or support agreement, and a purchase decision should be based on the functions in the release delivered. Items a broker needs by a date are agreed as change requests.

## Near term: next patch and minor release (indicative: within 3 months)

| Item | Why |
|---|---|
| Upgrade react-router to the fixed major version (BV-DEF-001) | Close the moderate advisory |
| Product list of the charges calculator readable by Accounting (BV-DEF-006) | Accounting maintains premium taxes without the administrator |
| Template shown on Product Configurator component lists (BV-DEF-004) | Clearer rating factors |
| Menu group address and incentive card layout (BV-OBS-007, BV-OBS-008) | Screen fixes |
| Re-run of the data privacy test cases and of the blocked SMTP cases | Close the release test |
| QR code for two-step enrolment | Easier enrolment |
| Upload buttons on the masters that only have an API route | Self-service go-live loads |
| Automated dependency and image scanning in the pipeline; tests restored in the deployment workflow; branch protection | Secure development lifecycle gaps of the architecture review |

## Mid term (indicative: 3 to 9 months)

| Item | Why |
|---|---|
| Session refresh in an httpOnly cookie | Remove tokens from browser local storage |
| Field-level encryption of personal identifiers (TIN, ID numbers) (BV-DEF-003) | Defence in depth for sensitive personal information |
| Move of the front-end build from Create React App to Vite | Maintained build tooling; clears build-time advisories |
| Screen to set up scheduled report e-mails | Today only through the API |
| Claim settlement cash on the Accounting menu | Accounting records claim funds directly |
| Rate limits shared across API instances | Consistent limits with several instances |
| Load test results and sizing confirmation on a production-sized environment | Evidence for larger brokers |

## Later (indicative: beyond 9 months)

| Item | Why |
|---|---|
| IC report formats | Reduce manual preparation of IC reports |
| Percentage tax working paper for non-VAT brokers | Complete the BIR working papers |
| Bank payment files for the main Philippine banks | Remittance and payouts without re-keying in bank portals |
| Insurer API connectors, starting with insurers that publish an API | Fewer files and e-mails with insurers |
| Mobile-friendly screens for sales and claims | Field use |
| Filipino screen translation | Users who prefer Filipino |
| Screening support for anti-money laundering checks | Brokers covered by the AMLA |

Brokers can propose roadmap items through their account manager. iorta TechNXT reviews the roadmap with customers at least once a year [to confirm the forum, for example a customer advisory meeting].
