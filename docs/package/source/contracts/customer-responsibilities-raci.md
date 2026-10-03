---
title: Responsibilities and RACI
subtitle: Customer responsibilities annex
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: AMC=Annual Maintenance Contract; ATP=Authority to Print; BIR=Bureau of Internal Revenue; CAB=Change advisory board; DPO=Data protection officer; IC=Insurance Commission; L1/L2/L3=Support levels 1, 2 and 3; MSA=Master Services Agreement; NPC=National Privacy Commission; OOTB=Out of the box; RACI=Responsible, Accountable, Consulted, Informed; RAID=Risks, assumptions, issues and dependencies; SIT=System integration test; SLA=Service level agreement; SMTP=Simple Mail Transfer Protocol; SOW=Statement of work; UAT=User acceptance testing
---

# About this annex

> Template for discussion; subject to review by the parties' legal counsel.

This Customer Responsibilities and RACI Annex (the **RACI Annex**) sets out what [Client legal name] (the **Client**) provides and does, and who is responsible, accountable, consulted and informed for each activity, in:

- the implementation of iNXT BrokerVerse OOTB under the Implementation Statement of Work (the **SOW**); and
- production support under the Annual Maintenance and Support Agreement and Service Level Agreement (the **Support Agreement**), for a perpetual licence or a subscription.

It is an annex to the Order Form under the Master Services Agreement (the **MSA**) between iorta TechNXT Corp. (**iorta TechNXT**) and the Client. It brings together the Client responsibilities clause of the MSA, the Client responsibilities and Assumptions chapters of the SOW, and the Client obligations chapter of the Support Agreement. If this annex conflicts with one of them, that clause prevails. The detailed implementation RACI by task is in the iorta TechNXT Implementation Approach and Plan and its workbook. Text in [square brackets] is a placeholder or an option.

## RACI codes

| Code | Meaning |
|---|---|
| R | Responsible: does the work |
| A | Accountable: owns the result and signs it off; one per activity |
| C | Consulted: gives input before the work or the decision |
| I | Informed: told of the result |

# Roles

## Client roles

| Role | Responsibilities | Commitment |
|---|---|---|
| Sponsor | Chairs the steering committee; approves scope, change requests, go/no-go and sign-offs | Steering committee meetings and each go/no-go |
| Project manager | Plans the Client's work, obtains data and decisions, runs UAT and training logistics | At least 50% during discovery, UAT and cutover |
| Process owners and key users | One per team; take part in discovery, decide configuration, test, train their team; become L1 super users after go-live | At least 50% during discovery, UAT and cutover |
| Accounting Manager | Chart of accounts, posting rules, tax set-up, opening balances, close; signs off financial reconciliation | As needed for ledger, tax and opening balance decisions |
| System Administrator | Users, roles, masters and settings after go-live; second line inside the Client | Trained and available in service hours |
| IT head | Escalations, change decisions, network and devices | As needed |
| Change owner | Approves normal changes in production with iorta TechNXT (CAB) | As needed |
| Data protection officer | Privacy matters, breach decisions, privacy impact assessment, transfer decision | As needed |
| Tax adviser and compliance officer | Review of tax codes, rates and BIR working papers | Configuration phase and before go-live |

## iorta TechNXT roles

| Role | Responsibilities |
|---|---|
| Account manager | Commercial owner of the relationship; steering committee member |
| Head of delivery | Delivery quality and resources; escalation point |
| Project manager | Plan, RAID log, status reports, steering committee papers |
| Functional consultants | Discovery, configuration, data mapping, SIT, training of key users, UAT support |
| Migration lead | Mapping, load runs, load logs, reconciliation reports, cutover runbook |
| Technical and DevOps lead | Environments, e-mail, payment gateway, backups, monitoring, data loads, cutover execution |
| Support manager | Service desk, SLA, monthly service report and review, CAB |
| L2 application support | Triage, reproduction, analysis, configuration and data corrections under change control, workarounds |
| L3 engineering | Code defects, database scripts, performance, infrastructure where iorta TechNXT hosts, security incidents, fixes and releases |

# Client responsibilities

## Client responsibilities in the implementation

| # | Responsibility | Needed by |
|---|---|---|
| 1 | Name the project manager, key users (one per team) and Accounting Manager, available at least 50% during discovery, UAT and cutover | Week 1 |
| 2 | Name a sponsor with authority to approve scope, changes and sign-offs | Week 1 |
| 3 | Provide the insurer list and agreements, commission and referrer rates, and the product list | End of discovery |
| 4 | Provide the chart of accounts and the accountant's mapping decisions | Start of ledger configuration |
| 5 | Provide the BIR Authority to Print or registered series for official receipts and invoices, and the last numbers used | Configuration of document numbering |
| 6 | Provide the SMTP mailbox and credentials, and the payment gateway merchant account and credentials | Integrations phase |
| 7 | Provide one recent statement export per bank account | Integrations phase |
| 8 | Extract and cleanse the in-force policy, open receivable and trial balance data, in the delivered templates | Each mock load and cutover |
| 9 | Provide the user list with roles and e-mail addresses | Two weeks before training |
| 10 | Provide training rooms, devices and attendance | Training phase |
| 11 | Provide UAT testers and sign-off authority | UAT phase |
| 12 | Freeze the old system and provide the final extract at cutover; keep the old system read-only for reference | Cutover |
| 13 | Decide on the fit-gap register and change requests within 3 Business Days | Throughout |
| 14 | Have the tax codes, rates and BIR working papers reviewed by the Client's tax adviser | Configuration phase |
| 15 | Choose the hosting option and decide on and document any transfer of personal data outside the Philippines | Before environment set-up |
| 16 | Sign or reject each Deliverable within 5 Business Days of submission | Throughout |

## Client responsibilities in production support

| # | Responsibility |
|---|---|
| 1 | Keep named L1 super users (one per team) and a System Administrator, trained and available in service hours |
| 2 | Keep a change owner and an IT head for escalations and change decisions, and a DPO for privacy matters |
| 3 | Raise tickets only through named L1 contacts (up to [5]), with the minimum content of the Support Agreement |
| 4 | Give access to the people who can reproduce the issue and test the fix |
| 5 | Provide testers for releases in UAT and approve releases within the agreed time |
| 6 | Give notice of business events that affect support: month-end and year-end dates, BIR filing dates, peak renewal periods, new branches or large data loads |
| 7 | Keep the credentials, contracts and support contacts of third parties the Client owns (SMTP mailbox, payment gateway, banks, domain names) |
| 8 | Use supported browsers (current Chrome, Edge or Firefox) and keep a working network |
| 9 | Manage Users through its own joiner, mover and leaver process; keep sign-in credentials confidential |
| 10 | Remain responsible for its regulatory filings, tax returns, IC reports, NPC registrations and notifications, and its business decisions |
| 11 | Where the Client hosts: run the infrastructure, operating system, database, backups and monitoring, and deploy releases under iorta TechNXT's guidance |

# RACI

## RACI: implementation

| Activity | iorta TechNXT PM | iorta TechNXT team | Client sponsor and PM | Client key users and IT |
|---|---|---|---|---|
| Project plan and governance | R | C | Sponsor A<br>PM R | I |
| Data request and extraction | C | C | PM A | R |
| Discovery workshops | A | R | PM R | Key users R<br>IT C |
| Configuration decisions | C | R | PM A | Key users R<br>IT C |
| Configuration in the system | A | R | PM I | C |
| Environments, backups, monitoring (iorta TechNXT hosts) | A | R | PM I | IT C |
| Data cleansing | I | C | PM A | R |
| Mock loads and reconciliation | A | R | PM C | Key users R<br>IT C |
| E-mail, bank formats, payment gateway | A | R | PM C | Key users C<br>IT R |
| System integration test | A | R | PM I | C |
| UAT execution and sign-off | C | C | Sponsor A<br>PM R | R |
| Train-the-trainer | A | R | PM C | R |
| End-user training | C | C | PM A | R |
| Cutover execution | A | R | PM R | R |
| Go/no-go decision | C | C | Sponsor A<br>PM R | C |
| Hypercare | A | R | PM R | C |
| Handover to production support | A | R | PM C | IT R |

## RACI: production support

| Activity | iorta TechNXT support | Client System Administrator and L1 | Client IT head and change owner | Client sponsor |
|---|---|---|---|---|
| How-to questions; user, role and password resets | I | R, A | I | Not applicable |
| Logging a ticket with the minimum content | C | R | A | Not applicable |
| Severity at triage | R, A | C | C | Not applicable |
| Incident diagnosis, workaround and fix | R, A | C | I | Not applicable |
| P1 incident communication to users | C | R | A | I |
| Standard changes (users, master records, e-mail texts) | I | R, A | I | Not applicable |
| Normal changes in production (release, tax rate, posting rule, data correction) | R | C | A | Not applicable |
| Emergency change for a P1 or a security patch | R | I | A | I |
| Release testing in UAT | C | R | A | Not applicable |
| Release deployment (iorta TechNXT hosts) | R, A | I | C | Not applicable |
| Release deployment (Client hosts) | C | R | A | Not applicable |
| Backups, monitoring and restore tests (iorta TechNXT hosts) | R, A | I | I | Not applicable |
| Monthly service report and review | R, A | C | C | I |
| Root-cause analysis of a P1 | R, A | C | I | I |
| Suspected personal data breach: facts and containment | R | C | C | I |
| Suspected personal data breach: notification to the NPC and data subjects | C | I | C | A<br>Client DPO R |
| Regulatory filings and returns (BIR, IC, NPC, AMLC) | Not applicable | R | C | A |

# Effect of a late or missing Client responsibility

| Situation | Effect | Source |
|---|---|---|
| A Client dependency is late or not met | The timeline moves by the time lost; iorta TechNXT may charge the extra effort at the day rates of the Order Form, after written notice | MSA, Client responsibilities |
| A delay moves the go-live date | Recorded in the RAID log; the steering committee agrees a revised plan; additional effort is a Change Request | SOW, Change control |
| A payment milestone is delayed by more than 30 days for reasons attributable to the Client | iorta TechNXT may invoice the milestone on its planned date | SOW, Milestone payments |
| Go-Live is delayed by more than [60] days for reasons attributable to the Client (perpetual) | The Licence Fee becomes payable on the planned Go-Live date | Perpetual Software Licence Agreement, Licence Fee |
| No written objection to a Deliverable within 5 Business Days | The Deliverable is deemed accepted | SOW, Acceptance procedure |
| A ticket waits for the Client | The SLA clock stops (status Awaiting customer); no service credit for the time | Support Agreement, Clock rules and Service credits |
| A ticket lacks the minimum content | No service credit for a missed target on that ticket | Support Agreement, Service credits |
| Release not applied by the Client | Support only for the current and the two previous planned releases | Support Agreement, Maintenance |

# Acceptance of this annex

| For iorta TechNXT Corp. | For [Client legal name] |
|---|---|
| Signature: ____________________ | Signature: ____________________ |
| Name: [name] | Name: [name] |
| Title: [title] | Title: [title] |
| Date: [date] | Date: [date] |
