---
title: Implementation Approach
subtitle: and Plan for BrokerVerse OOTB
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; SIT=System integration test; UAT=User acceptance test; RACI=Responsible, Accountable, Consulted, Informed; RAID=Risks, Assumptions, Issues, Dependencies; PM=Project manager; SteerCo=Steering committee; CR=Change request; GL=General ledger; CoA=Chart of accounts; SMTP=Simple Mail Transfer Protocol; CTPL=Compulsory Third Party Liability; PHT=Philippine time; TTT=Train the trainer
---

# Introduction

## Purpose

This document describes how iorta TechNXT implements BrokerVerse OOTB for a Philippine non-life insurance broker: the approach, the phases, a week-by-week plan for small, medium and large brokers, who does what, how the project is governed, what each phase delivers and how it is accepted, and what is in and out of scope.

The companion workbook `BrokerVerse_Implementation_Plan.xlsx` holds the three timelines as Gantt charts and the full RACI matrix.

## Audience

The broker's management (sponsor and steering committee), the broker's project manager, the process owners of Sales, Placement and Policy Processing, Client Servicing, Claims and Accounting, the broker's IT or System Administrator, and the iorta TechNXT project team.

## Related documents

| Document | Use |
|---|---|
| BrokerVerse Data Migration and Cutover Plan | Data objects, templates, load sequence, reconciliation, cutover and rollback |
| BrokerVerse Training Plan | Training per role, curriculum, train-the-trainer, assessment |
| BrokerVerse Production Support Approach and Standards | Support after hypercare |
| BrokerVerse Philippine Regulatory Compliance Matrix | How the system supports the broker's obligations |
| BrokerVerse User Manual (`docs/package/05_Delivery`) | Every screen, for every role |
| Go-live data set-up (`docs/onboarding/GO_LIVE_DATA_SETUP.md`) | The order of set-up from company to first month-end |
| User acceptance test scripts (`docs/onboarding/UAT_SCRIPTS.md`) | 5 to 8 scenarios per role |
| Deployment checklist (`deploy/README.md`, `deploy/REFERENCE.md`) | Servers, database, secrets, e-mail, health checks, rollback |

# Implementation approach

## Configure, do not customise

BrokerVerse OOTB is a finished product for Philippine non-life broking. It covers the broking cycle from prospect to renewal (prospects, requests for quotation, quotations, placement slips, policy issue, endorsements, claims, renewals), the accounting of a broker (billing, official receipts, collections, remittance to insurers, direct bill, commission, petty cash, journals, bank reconciliation, month-end and year-end close) and the BIR working papers (Form 2307, VAT Summary, SAWT, QAP, SLSP). The implementation fits the broker to the product through configuration and master data. It does not change the code.

What the broker can set without code:

| Area | Where in BrokerVerse |
|---|---|
| Company, letterhead, branches, departments | Master > Generals > Organization; Master > System Settings |
| Users and the seven delivered roles | Master > Generals > User Management (User, Role, User Access Matrix, Authority Matrix, Delegations, Segregation of Duties, Access Reviews) |
| Insurers, credit and remittance terms, billing mode | Master > Generals > Insurance Management > Insurance Company |
| Lines of business, products, covers, vehicles | Master > Generals > Insurance Management |
| Product templates, motor tariff (CTPL and Auto Passenger PA), rating, acceptance rules | Product Configurator |
| Commission rates and referrer sharing | Master > Finance > Commission Rate Matrix |
| Premium taxes and LGU rates, tax codes with BIR ATC | Master > Finance > Premium Taxes & LGU Rates; Master > Finance > Taxation |
| Chart of accounts, account determination, posting rules | Master > Finance > Main Account, Sub Account, Account Determination, Posting Rules, Configuration Approvals |
| Document numbering (61 series) | Master > Document Numbering |
| Business rules, limits, maker-checker switches, security policy, e-mail texts | Master > Configuration |
| Scheduled jobs | Master > Schedules |
| Banks, bank accounts, statement formats, transaction types | Master > Finance > Bank, Bank Statement Formats, Bank Transaction Types |
| Payment gateways | Master > Finance > Payment Gateways |

A requirement that cannot be met by configuration, master data or a change in the broker's procedure is a gap. Gaps are recorded in the fit-gap register and handled through the change request process (chapter 16). They do not enter the go-live scope unless the steering committee approves them as a change request.

## Principles

- **Product first.** The process walk-throughs use the delivered screens with the broker's own examples. The broker adapts a procedure before anyone asks for a change.
- **Data drives the timeline.** Most of the effort sits with the broker's data: insurer agreements, commission rates, the chart of accounts, in-force policies, open receivables and the trial balance. Requests for data go out in week 1.
- **Key users own the result.** Each team names one key user who takes part in discovery, tests the configuration, runs the UAT scripts and trains the team.
- **Repeatable loads.** Every data load uses the delivered upload templates (`docs/templates`) and is rehearsed at least twice before cutover.
- **Evidence for every acceptance.** Each phase ends with named deliverables and acceptance criteria (chapter 11). Sign-off is written.

## Implementation sizes

The plan has three sizes. The size is agreed at mobilisation from the figures below. These thresholds are planning assumptions; the steering committee confirms the size once the data volumes are known.

| Size | Typical profile (assumption) | Duration to hypercare exit |
|---|---|---|
| Small | One office, up to 25 users, up to 10 insurers, up to 5,000 in-force policies, one or two bank accounts | 8 weeks |
| Medium | Up to 3 offices, 26 to 100 users, up to 25 insurers, up to 25,000 in-force policies, co-insurance in use | 12 weeks |
| Large | More than 3 offices, more than 100 users, many insurers, more than 25,000 in-force policies, several bank accounts and referrer networks | 16 to 20 weeks |

An import file holds at most 20,000 data rows (`IMPORT_MAX_ROWS`). Larger books are loaded in several files, which the large plan allows for.

# Phases

## Overview

| # | Phase | What happens |
|---|---|---|
| 1 | Mobilisation | Kick-off, team and governance, plan confirmed, data requests issued, environments ordered |
| 2 | Discovery and fit-gap | Walk-through of each process on the delivered system; configuration decisions; fit-gap register limited to configuration |
| 3 | Environment set-up | Test (UAT) and production environments, e-mail account, backups, monitoring |
| 4 | Configuration | Masters, products and rates, numbering, chart of accounts, posting rules, approvals, security |
| 5 | Data migration | Extraction by the broker, mapping to the templates, mock loads, reconciliation |
| 6 | Integrations | E-mail, bank statement files, payment gateway |
| 7 | Training | Train-the-trainer for key users, then end-user training per role |
| 8 | System integration test | End-to-end runs across roles with the configured data |
| 9 | User acceptance test | Key users run the UAT scripts with the broker's own data |
| 10 | Cutover | Final extract, final loads, reconciliation, go/no-go |
| 11 | Go-live | First day of transactions in BrokerVerse |
| 12 | Hypercare | Close support by the project team until the first month-end close is done |

## Mobilisation

- Kick-off meeting with the sponsor, the broker's project manager, the key users and the iorta TechNXT team.
- Confirm the implementation size, the plan, the go-live date and the hypercare window.
- Set up the steering committee, the weekly status meeting and the RAID log (chapter 10).
- Issue the data request list: insurer list and agreements, commission and referrer rates, product list, chart of accounts, last trial balance, in-force policy extract, open receivable ageing, amounts due to insurers, bank accounts, official receipt and invoice series with the BIR Authority to Print, user list with roles.
- Order the environments (phase 3).

## Discovery and fit-gap

Discovery is limited to configuration. Each workshop shows the delivered screens with the broker's own examples and records the decisions in the configuration workbook.

| Workshop | Participants | Decisions recorded |
|---|---|---|
| Organisation and access | Sponsor, System Administrator | Companies, branches, departments, users per role, two-step verification roles, security policy |
| Sales and placement | Sales & Marketing, Processing Team | Placement journey per line (`placement.journey`), quotation validity, maker-checker on quotations, product templates in use |
| Policy servicing and renewals | Operations, Processing Team | Endorsement handling, renewal timetable (pipeline 90 days, notices at 60, 30 and 15 days), renewal maker-checker |
| Claims | Claims | Claims controls (`claims.block_unpaid_premium`, settlement maker-checker, SLA days), claim letters |
| Billing, collection and remittance | Accounting, Accounting Manager | Billing mode per insurer, premium payment warranty days, remittance terms, remittance approval levels, direct bill settings |
| Commission and incentives | Accounting, Sales & Marketing | Commission rules, rate matrix, referrer withholding rates, payout conditions |
| Ledger and close | Accounting Manager | Chart of accounts, account determination, posting rules, fiscal year, close checklist, period control, bank reconciliation |
| Tax | Accounting Manager, tax adviser | Tax codes and ATC, premium taxes and LGU rates, BIR settings for the forms |

Output: the configuration workbook and the fit-gap register. Each register line is classed as Fit (delivered), Configure (setting or master data), Procedure (the broker changes how it works) or Gap (needs a change request).

## Environment set-up

- iorta TechNXT provisions a test environment (used for configuration, SIT, mock loads, training and UAT) and the production environment following `deploy/README.md`. Assumption: iorta TechNXT hosts both on AWS in region ap-southeast-1; a broker-hosted installation is a separate option.
- Production starts with reference data only (`SEED_SAMPLE_DATA=false`). The test environment may carry the delivered sample data for training.
- Database time zone Asia/Manila, daily database snapshots with at least 30 days' retention, backup of the upload volume and the encryption key, a restore test before go-live.
- Health checks (`/api/health`, `/api/health/live`) wired to the load balancer and monitoring.
- SMTP mailbox for outgoing e-mail.
- Smoke test of section 4 of the deployment checklist on each environment.

## Configuration

Configuration follows the order of `GO_LIVE_DATA_SETUP.md`, steps 1 to 10, first in the test environment. Once accepted in UAT, the same values are applied to production, by upload where a template exists and on the screen otherwise.

| Item | Screen | Template |
|---|---|---|
| Company and letterhead, system name and logo | Master > Generals > Organization > Company; Master > System Settings | `Company_Upload_Template.xlsx` |
| Branches, departments | Master > Generals > Organization > Branch | `Branch_…`, `Department_Upload_Template.xlsx` |
| Users and roles, security settings | Master > Generals > User Management > User; Master > Configuration > Security & Access | `Users_Provisioning_Template.xlsx` |
| Insurers, credit and remittance terms | Master > Generals > Insurance Management > Insurance Company | `Insurance_Company_Upload_Template.xlsx` |
| Commission | Master > Finance > Commission Rate Matrix | On screen |
| Lines of business, products, policy types, covers, vehicles | Master > Generals > Insurance Management | `Line_of_Business_…`, `Product_…`, `Policy_Type_…`, `Cover_…`, `Vehicle_…` templates |
| Product templates, motor tariff, rating, acceptance rules | Product Configurator (approval limits: Master > Generals > User Management > Authority Matrix) | On screen |
| Tax codes, premium taxes and LGU rates | Master > Finance > Taxation; Premium Taxes & LGU Rates | On screen |
| Chart of accounts | Master > Finance > Main Account, Sub Account | `Chart_of_Accounts_Upload_Template.xlsx` |
| Account determination and posting rules | Master > Finance > Account Determination, Posting Rules (Simulate), Configuration Approvals | On screen |
| Banks, bank accounts, signatories | Master > Finance > Bank; Insurance Management > Signatories | `Bank_…`, `Bank_Account_…`, `Signatories_Upload_Template.xlsx` |
| Document numbering | Master > Document Numbering | On screen |
| Approvals and maker-checker | Master > Configuration (switches and remittance approval levels); User Management > Authority Matrix | On screen |
| E-mail texts, notification recipients | Master > Configuration | On screen |
| Scheduled jobs | Master > Schedules | On screen |

The delivered data already holds Philippine lines of business, products, covers, vehicle makes, the 2025 motor tariff, the tax codes (VAT 12%, DST PHP 0.50 per PHP 4.00 or fraction, LGT 0.75% and expanded withholding codes with ATC) and a Philippine broker chart of accounts. Configuration therefore reviews and adjusts more than it builds. The broker's accountant and tax adviser confirm tax rates, ATC and GL accounts.

## Data migration

The detail is in the Data Migration and Cutover Plan. In outline:

- Masters, in-force policies and clients, open premium receivables, GL opening balances (which carry the amounts due to insurers), and optionally leads and quotations in progress.
- The broker extracts and cleanses the data; iorta TechNXT advises on mapping, runs the loads with the broker and checks the results.
- Three mock loads for medium and large brokers, two for small brokers, each reconciled on counts and totals. The last mock load is the cutover rehearsal.

## Integrations

The OOTB integrations are configured, not built.

| Integration | What is delivered | Implementation work |
|---|---|---|
| E-mail | Outgoing mail through an SMTP mailbox (`SMTP_URL`), queued in the E-mail Outbox and sent every 5 minutes; texts and recipients in Master > Configuration | Mailbox and credentials from the broker, sender name, texts, test of password reset and quotation approval link |
| Bank statement files | Statement import in Accounts > Bank Reconciliation with the delivered formats BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE and GENERIC; remittance bank transactions import (CSV) | One sample statement per bank account; adjust the format columns in Master > Finance > Bank Statement Formats if a bank's export differs |
| Payment gateway | Payment links with the providers PayMongo and Dragonpay, plus a sandbox provider; a confirmed payment posts the official receipt | The broker's merchant account and credentials (kept in the secret store), notification address registered with the provider, sandbox test then a live test payment |

Electronic transfers to insurers (InstaPay, PESONet, RTGS, wire) are recorded and approved in Accounts > Remittance > Electronic Transfer and executed in the bank's own portal. Outgoing payment files for bank portals are not part of the OOTB scope.

## Training

Train-the-trainer for the key users first, then end-user training per role, delivered by the key users with iorta TechNXT present. The Training Plan gives the curriculum and durations. Materials: the user manual and the seven role decks in `docs/decks`.

## System integration test

iorta TechNXT runs the end-to-end flows across all roles in the test environment with the configured masters and the migrated data of the latest mock load. The test follows the end-to-end plan in `docs/e2e/E2E_TEST_PLAN.md` (one motor policy through its whole life, plus a co-insured placement and the month-end close) and the scripted scenario `backend/scripts/uat-scenario.js`, which drives the full broking cycle through the API with one user per role. Defects are logged with the request ID shown in error messages.

## User acceptance test

Key users run `docs/onboarding/UAT_SCRIPTS.md` (System Administrator A1 to A7, Sales & Marketing S1 to S6, Processing Team P1 to P6, Operations O1 to O5, Claims C1 to C5, Accounting F1 to F8, Accounting Manager M1 to M5) with the broker's own products, insurers and data, plus broker-specific scenarios agreed in discovery. Each scenario is marked Pass or Fail with date, name and, for a failure, the record number and request ID.

## Cutover and go-live

Cutover follows the checklist of the Data Migration and Cutover Plan: freeze of the old system at the close of the day before go-live, final extract, final loads, reconciliation of counts and totals, sign-off by Accounting and the Accounting Manager, go/no-go by the steering committee, then go-live. The rollback plan is ready before the go/no-go.

## Hypercare

The project team stays with the broker after go-live: daily check-in in the first week, then weekly. Hypercare covers the first month-end close (bank reconciliation, remittance, Month-End Close run, BIR reports). It ends with the handover to production support described in the Production Support Approach and Standards. Default hypercare length: 2 weeks (small), 3 weeks (medium), 4 to 6 weeks (large). If the first month-end close falls after that window, hypercare extends to cover it.

# Timeline: small broker (8 weeks)

Go-live is at the start of week 7. Hypercare runs in weeks 7 and 8.

| Week | Activities | Milestones |
|---|---|---|
| 1 | Kick-off; governance set up; data requests issued; test environment provisioned; discovery workshops start | Kick-off held; plan and go-live date confirmed |
| 2 | Discovery and fit-gap completed; production environment provisioned; configuration of company, branches, users, insurers, commission | Configuration workbook and fit-gap register signed |
| 3 | Configuration of products, motor tariff, taxes, chart of accounts, account determination, posting rules, numbering, approvals; e-mail set-up; bank statement formats; mock load 1 | Mock load 1 reconciled |
| 4 | Configuration completed; payment gateway sandbox test; SIT; train-the-trainer for key users | SIT exit report; configuration frozen for UAT |
| 5 | UAT with the UAT scripts; end-user training; configuration fixes; mock load 2 (cutover rehearsal) | Mock load 2 reconciled; trained users listed |
| 6 | UAT sign-off; configuration copied to production; production smoke test; go/no-go; cutover at the close of the last day of week 6 | UAT sign-off; go decision |
| 7 | Go-live; daily hypercare check-ins; first official receipts, remittances and bank imports watched | Go-live |
| 8 | Hypercare; weekly review; knowledge transfer to support; handover | Hypercare exit and handover (or extension to the first month-end) |

# Timeline: medium broker (12 weeks)

Go-live is at the start of week 10. Hypercare runs in weeks 10 to 12.

| Week | Activities | Milestones |
|---|---|---|
| 1 | Kick-off; governance; data requests; test environment provisioned | Kick-off held |
| 2 | Discovery workshops (organisation, sales and placement, servicing, claims); production environment provisioned | Environments ready |
| 3 | Discovery workshops (billing, remittance, commission, ledger, tax); fit-gap register; configuration of organisation, users, insurers | Configuration workbook and fit-gap register signed |
| 4 | Configuration of products, product templates, motor tariff, commission, taxes; data mapping to templates | Data mapping agreed |
| 5 | Configuration of chart of accounts, account determination, posting rules, numbering, approvals, schedules; e-mail; mock load 1 | Mock load 1 reconciled |
| 6 | Configuration completed; bank statement formats; payment gateway sandbox; SIT cycle 1 | Configuration complete |
| 7 | SIT cycle 2; mock load 2; train-the-trainer for key users | SIT exit report; mock load 2 reconciled |
| 8 | UAT cycle 1; end-user training starts | UAT cycle 1 results |
| 9 | UAT cycle 2 and sign-off; end-user training completed; mock load 3 (cutover rehearsal); configuration copied to production; go/no-go; cutover at the close of week 9 | UAT sign-off; go decision |
| 10 | Go-live; daily hypercare check-ins | Go-live |
| 11 | Hypercare; first remittance run and bank reconciliations | Weekly hypercare review |
| 12 | Hypercare; first month-end close supported where it falls; knowledge transfer; handover | Hypercare exit and handover |

# Timeline: large broker (16 to 20 weeks)

The plan below is the 20-week version. Go-live is at the start of week 15 for all branches at once, because the general ledger, the receivables and the amounts due to insurers move to BrokerVerse on a single go-live date. Hypercare runs in weeks 15 to 20 and covers the first month-end close and the BIR working papers of the first month.

| Week | Activities | Milestones |
|---|---|---|
| 1 | Kick-off; governance; data requests; test environment ordered | Kick-off held |
| 2 | Mobilisation completed; test environment provisioned; discovery starts (organisation and access) | Plan baselined |
| 3 | Discovery: sales, placement, co-insurance, servicing, claims, renewals; production environment provisioned | Environments ready |
| 4 | Discovery: billing, remittance, direct bill, commission and incentives, ledger, close, tax; configuration of organisation and users starts | |
| 5 | Fit-gap register completed; configuration of insurers, commission, products | Configuration workbook and fit-gap register signed |
| 6 | Configuration of product templates, motor tariff, rating, acceptance rules; data mapping; e-mail set-up | Data mapping agreed |
| 7 | Configuration of chart of accounts, account determination, posting rules, numbering; mock load 1 | Mock load 1 reconciled |
| 8 | Configuration of approvals, authority matrix, schedules, bank accounts and statement formats; payment gateway sandbox | |
| 9 | Configuration completed; SIT cycle 1 | Configuration complete |
| 10 | SIT cycle 2; mock load 2; train-the-trainer starts | Mock load 2 reconciled |
| 11 | SIT exit; train-the-trainer completed; UAT preparation with broker-specific scenarios | SIT exit report |
| 12 | UAT cycle 1; end-user training (head office) | UAT cycle 1 results |
| 13 | UAT cycle 2; mock load 3; end-user training (branches) | UAT sign-off |
| 14 | Mock load 4 (cutover rehearsal); configuration copied to production; production smoke test; go/no-go; cutover at the close of week 14 | Go decision |
| 15 | Go-live; daily hypercare check-ins at head office; floor walkers in the branches | Go-live |
| 16 | Hypercare; first remittance runs and bank reconciliations across all bank accounts | Weekly hypercare review |
| 17 | Hypercare; collection, commission payout and renewal cycles watched | Weekly hypercare review |
| 18 | Hypercare; first month-end close supported (timing depends on the go-live date) | First close completed |
| 19 | Hypercare; BIR working papers of the first month; settings review after the first close | Settings review held |
| 20 | Knowledge transfer; handover to production support | Hypercare exit and handover |

A large broker with one office cluster and a simple product mix can follow a 16-week variant: discovery ends in week 4, configuration in week 8, three mock loads, go-live at the start of week 13 and hypercare in weeks 13 to 16 (extended to the first month-end close if needed).

# Roles and responsibilities

## Project roles

| Role | Party | Responsibilities |
|---|---|---|
| Project sponsor | Broker | Chairs the steering committee; approves scope, change requests, go/no-go |
| Project manager | Broker | Plans the broker's work, obtains data and decisions, runs UAT and training logistics |
| Process owners and key users | Broker | One per team; take part in discovery, decide configuration, test, train their team |
| System Administrator | Broker | Users, roles, masters and settings after go-live; second line of support |
| Accounting Manager | Broker | Chart of accounts, posting rules, tax set-up, opening balances, close; signs off financial reconciliation |
| Project manager | iorta TechNXT | Plan, RAID log, status reports, steering committee papers, coordination of the iorta TechNXT team |
| Functional consultants | iorta TechNXT | Discovery, configuration, data mapping, SIT, training of key users, UAT support |
| Technical and DevOps lead | iorta TechNXT | Environments, e-mail, payment gateway, backups, monitoring, data loads, cutover execution |

## RACI

R = Responsible, A = Accountable, C = Consulted, I = Informed. The full matrix with each activity is in the workbook.

| Activity | iorta TechNXT PM | iorta TechNXT team | Broker sponsor and PM | Broker key users and IT |
|---|---|---|---|---|
| Project plan and governance | R | Consultants C<br>Technical C | Sponsor A<br>PM R | Key users I<br>IT I |
| Data request and extraction | C | Consultants C | PM A | Key users R<br>IT R |
| Discovery workshops | A | Consultants R | PM R | Key users R<br>IT C |
| Configuration decisions | C | Consultants R | PM A | Key users R<br>IT C |
| Configuration in the system | A | Consultants R<br>Technical C | PM I | Key users C<br>IT C |
| Environments, backups, monitoring | A | Technical R | PM I | IT C |
| Data cleansing | I | Consultants C | PM A | Key users R<br>IT R |
| Mock loads and reconciliation | A | Consultants R<br>Technical R | PM C | Key users R<br>IT C |
| E-mail, bank formats, payment gateway | A | Technical R | PM C | Key users C<br>IT R |
| System integration test | A | Consultants R<br>Technical R | PM I | Key users C |
| UAT execution and sign-off | C | Consultants C | Sponsor A<br>PM R | Key users R<br>IT C |
| Train-the-trainer | A | Consultants R | PM C | Key users R<br>IT C |
| End-user training | C | Consultants C | PM A | Key users R<br>IT C |
| Cutover execution | A | Consultants R<br>Technical R | PM R | Key users R<br>IT R |
| Go/no-go decision | C | Consultants C<br>Technical C | Sponsor A<br>PM R | Key users C<br>IT C |
| Hypercare | A | Consultants R<br>Technical R | PM R | Key users C<br>IT C |
| Handover to production support | A | Consultants R<br>Technical R | PM C | IT R |

# Governance

## Steering committee

| Item | Detail |
|---|---|
| Members | Broker sponsor (chair), broker project manager, Accounting Manager, a business head; iorta TechNXT account manager and project manager |
| Frequency | Every two weeks, plus a meeting for each go/no-go |
| Inputs | Status report, milestone tracker, RAID log extract, change requests for decision |
| Decisions | Scope, change requests, plan changes, phase acceptance, go/no-go, hypercare exit |

## Weekly status

A weekly meeting of both project managers and the leads, with a written status report: progress against the plan, milestones due and done, decisions needed, top risks and issues, data received and outstanding, next week's activities. Status uses green, amber and red against the baselined plan.

## RAID log

One shared log of risks, assumptions, issues and dependencies, kept by the iorta TechNXT project manager and reviewed in every weekly status meeting.

| Field | Content |
|---|---|
| ID, type | R, A, I or D with a running number |
| Description | What it is and its effect on scope, time or quality |
| Owner | One named person |
| Rating | High, medium or low (probability and impact for risks) |
| Action and due date | Mitigation or resolution and when |
| Status | Open, in progress, closed; closure date |

Items rated high go to the steering committee.

# Deliverables and acceptance criteria

| Phase | Deliverables | Acceptance criteria |
|---|---|---|
| Mobilisation | Project charter, baselined plan, RAID log, data request list, governance calendar | Charter and plan signed by both project managers and the sponsor |
| Discovery and fit-gap | Configuration workbook, fit-gap register | Every process walked through; every register line classed and owned; signed by the process owners |
| Environment set-up | Test and production environments, environment sheet (addresses, backups, monitoring) | Smoke test of `deploy/README.md` section 4 passed on each; restore test done once |
| Configuration | Configured test environment; configuration workbook updated with the values set | Each workbook item set and checked as in `GO_LIVE_DATA_SETUP.md` steps 1 to 10; test quotation premiums and taxes agree with manual calculations |
| Data migration | Mapping sheets, filled templates, load logs, reconciliation reports for each mock load | Counts and totals agree within the agreed tolerance (default: exact); trial balance as at go-live agrees with the old system |
| Integrations | E-mail, bank statement formats, payment gateway set up | Password reset e-mail and quotation approval link received; one statement per bank account imported with a balancing preview; one sandbox payment receipted |
| Training | Training schedule, attendance lists, assessment results | Every user trained in the role before go-live; key users pass the assessment |
| SIT | SIT plan, test results, defect log, SIT exit report | All end-to-end flows passed; no open severity 1 or 2 defect |
| UAT | UAT results per script, defect log, UAT sign-off | All UAT scripts passed or accepted with a workaround; sign-off by each process owner and the sponsor |
| Cutover | Cutover checklist with times and owners, final reconciliation, go/no-go minutes | Go/no-go criteria met (Data Migration and Cutover Plan) |
| Go-live | Production in use; go-live communication | Users signed in and transacting; first receipts, remittances and bank imports processed |
| Hypercare | Hypercare log, first month-end close support, handover pack | No open severity 1 or 2 issue; first close completed; handover accepted by production support and the System Administrator |

A deliverable is deemed accepted when the broker has not raised a written objection within 5 business days of submission (assumption, to be agreed in the contract).

# Assumptions

- The implementation is OOTB: the broker uses the delivered screens, workflows, reports and printed documents.
- The broker names a project manager and one key user per team, available at least 50% of their time during discovery, UAT and cutover, and an Accounting Manager available for the ledger, tax and opening balance decisions.
- The broker provides complete and cleansed data in the delivered templates by the dates in the plan.
- Decisions in discovery are made within 3 business days of each workshop.
- iorta TechNXT hosts the test and production environments on AWS (region ap-southeast-1). Other hosting is priced separately.
- Workshops and training are delivered on site in Metro Manila or online, in English, during Philippine business hours.
- One legal entity and one fiscal year are migrated; opening balances are taken at a single go-live date.
- The broker uses the delivered roles: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting and Accounting Manager.
- The delivered tax codes, rates and BIR working papers are confirmed by the broker's tax adviser before go-live.
- Testing uses the test environment; production is used only after the go decision.

# Exclusions

The following are outside the OOTB implementation. Any of them can be quoted separately through a change request.

- Customisation of screens, workflows, reports, printed documents or the database, and new reports.
- New integrations, for example with insurer systems, core banking, bank payment file generation, SMS gateways, accounting packages, BIR eFPS or eBIRForms, LTO or IC systems, and payment gateways other than PayMongo and Dragonpay.
- Data cleansing, de-duplication and enrichment of the broker's data, and extraction from the old system.
- Migration of closed or expired policies, settled claims, paid receivables, transaction history and documents, and more than one fiscal year of balances.
- Hardware, end-user devices, networks, browsers and office software.
- Third-party licences and fees: cloud subscriptions beyond the agreed hosting, Microsoft 365 or other mailbox, payment gateway merchant fees, SSL certificates for broker-owned domains.
- Regulatory filings and registrations: BIR returns and alphalists, Computerized Accounting System registration or acknowledgement, Authority to Print, IC reports, NPC registration, AMLC reports. The system provides working papers; filing remains with the broker.
- Tax, legal, actuarial or audit advice.
- Translation of the screens (Filipino has no translation file in this release).
- Training beyond the curriculum of the Training Plan and training of users added after go-live.
- Support after hypercare, which is covered by the production support agreement.

# Dependencies on the broker

| Dependency | Needed by |
|---|---|
| Named project manager, key users and Accounting Manager | Week 1 |
| Insurer list and agreements, commission and referrer rates, product list | End of discovery |
| Chart of accounts and the accountant's mapping decisions | Start of configuration of the ledger |
| BIR Authority to Print or registered series for official receipts and invoices; last numbers used | Configuration of document numbering |
| SMTP mailbox and credentials; payment gateway merchant account and credentials | Integrations phase |
| One recent statement export per bank account | Integrations phase |
| In-force policy, open receivable and trial balance extracts in the templates | Each mock load and cutover |
| User list with roles and e-mail addresses | Two weeks before training |
| Training rooms, devices and attendance | Training phase |
| UAT testers and sign-off authority | UAT phase |
| Freeze of the old system and final extract at cutover | Cutover |
| Decisions on the fit-gap register and change requests within the agreed time | Throughout |

# Risks and mitigations

| Risk | Effect | Mitigation |
|---|---|---|
| Data arrives late or incomplete | Mock loads slip; go-live moves | Data requests in week 1; templates handed out at kick-off; data readiness tracked weekly; steering committee escalation after one week of delay |
| Poor data quality in the old system | Rejected rows; receivables or balances do not reconcile | Two to four mock loads with reconciliation; the broker cleanses at source; rejected-row reports from each upload |
| Requests for customisation | Scope and timeline grow | Configure-first principle; fit-gap classes; change request process with steering committee approval |
| Key users unavailable | Decisions late; weak UAT and training | Named key users with committed time; backups named; workshops scheduled at kick-off |
| Opening balances and open items do not agree | Ledger wrong from day one | Premiums Receivable balance must equal open item total; Due to Insurers reconciled to insurer statements; Accounting Manager signs off |
| Tax rates or ATC not confirmed | Wrong VAT or withholding | Tax adviser review in the configuration phase; VAT Summary checked in UAT (F8) |
| Official receipt numbering out of line with the Authority to Print | Compliance exposure | Numbering set from the last number used; checked in UAT (A6, F1) |
| E-mail or payment gateway credentials late | Quotation approval links, password resets and online payments not working | Requested in mobilisation; the system works without the gateway; sandbox first |
| Users not ready at go-live | Errors and slow work | Role-based training, assessment, floor walkers in the first week |
| First month-end close outside hypercare | Close issues found late | Hypercare extends to the first close |

# Change request process

A change request covers any change to the agreed scope, plan or deliverables, including any gap from the fit-gap register.

1. The requester writes the change request: description, reason, business impact, priority.
2. The iorta TechNXT project manager logs it and, within 5 business days, returns an impact assessment: effort, cost, effect on the timeline and on other deliverables, and whether it can be met by configuration instead.
3. The broker project manager reviews the assessment with the process owner.
4. The steering committee approves, rejects or defers it. Changes that affect cost or the go-live date need the sponsor's written approval.
5. An approved change request is added to the plan and the RAID log and is tracked to closure.
6. A rejected or deferred change request stays in the log with the reason.

Customisation approved through a change request is built, tested and released under the release process of the Production Support Approach and Standards, and may be scheduled after go-live so the OOTB go-live date holds.
