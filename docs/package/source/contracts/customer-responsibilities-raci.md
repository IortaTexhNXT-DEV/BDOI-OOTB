---
title: Responsibilities and RACI
subtitle: Customer responsibilities annex
version: 1.1.1
date: 04 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Version 1.1.1: Client brand packs: basis is the client's contract with iorta TechNXT (management decision of 04 October 2026). Version 1.1: Client roles, responsibilities and RACI aligned with the current product; template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: AMC=Annual Maintenance Contract; AML/CFT=Anti-money laundering and countering the financing of terrorism; AMLC=Anti-Money Laundering Council; ATP=Authority to Print; BIR=Bureau of Internal Revenue; CAS=Computerized Accounting System; COC=Certificate of cover; CTPL=Compulsory Third Party Liability; EIS=Electronic Invoicing System; PEP=Politically exposed person; CAB=Change advisory board; DPO=Data protection officer; IC=Insurance Commission; L1/L2/L3=Support levels 1, 2 and 3; MSA=Master Services Agreement; NPC=National Privacy Commission; OOTB=Out of the box; RACI=Responsible, Accountable, Consulted, Informed; RAID=Risks, assumptions, issues and dependencies; SIT=System integration test; SLA=Service level agreement; SMTP=Simple Mail Transfer Protocol; SOW=Statement of work; UAT=User acceptance testing
---

# About this annex

> Template for discussion; subject to review by the parties' legal counsel.

This Customer Responsibilities and RACI Annex (the **RACI Annex**) sets out what [Client legal name] (the **Client**) provides and does, and who is responsible, accountable, consulted and informed for each activity, in:

- the implementation of iNXT BrokerVerse OOTB under the Implementation Statement of Work (the **SOW**); and
- production support under the Annual Maintenance and Support Agreement and Service Level Agreement (the **Support Agreement**), for a perpetual licence or a subscription.

It is an annex to the Order Form under the Master Services Agreement (the **MSA**) between iorta TechNXT Corp. (**iorta TechNXT**) and the Client. It brings together the Client responsibilities clause of the MSA, the Client responsibilities and Assumptions chapters of the SOW, and the Client obligations chapter of the Support Agreement. If this annex conflicts with one of them, that clause prevails. The detailed implementation RACI by task is in the iorta TechNXT Implementation Approach and Plan and its workbook. Text in [square brackets] is a placeholder or an option.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 03 October 2026 | Template for discussion |
| 1.1 | 04 October 2026 | Compliance officer, data protection officer, tax adviser and the Client's partners as roles; Client responsibilities for regulatory registrations, screening lists, partner contracts and certification, permission for third-party marks and custody of the encryption keys; implementation RACI extended to compliance set-up, branding, integrations, environments and keys; production support RACI extended to compliance operations, key rotation and masked copies |
| 1.1.1 | 04 October 2026 | Client brand packs: basis is the client's contract with iorta TechNXT (management decision of 04 October 2026) |

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
| Compliance officer | AML/CFT programme: settings, risk factors and rules, screening lists and their licences, screening hits, EDD reviews, AMLC registration and filings; licence register, fit and proper records, insurer authority; complaints | Compliance workshop, compliance set-up, UAT and go/no-go; daily after go-live |
| Data protection officer | NPC registration, privacy notice, masking by role and approval of masked copies, breach register and notifications, data subject requests, privacy impact assessment, transfer decision | As needed; within the deadlines of the breach register after go-live |
| Tax adviser | Written confirmation of tax codes, rates, ATC, BIR forms, invoice and receipt wording; ATP or CAS and EIS questions | Configuration phase and before UAT sign-off |
| Partners of the Client | Banks (payment files), SMS or Viber provider, CTPL authentication provider, insurers (API connection), payment gateway: certification of their interface | Integrations phase |

## iorta TechNXT roles

| Role | Responsibilities |
|---|---|
| Account manager | Commercial owner of the relationship; steering committee member |
| Head of delivery | Delivery quality and resources; escalation point |
| Project manager | Plan, RAID log, status reports, steering committee papers |
| Functional consultants | Discovery, Configuration Kit, Product Configurator, compliance set-up, branding, data mapping, SIT, training of key users, UAT support |
| Migration lead | Mapping, load runs, load logs, reconciliation reports, cutover runbook |
| Technical and DevOps lead | Environments, release pipeline and its approval gates, application secrets and encryption keys, connectors, backups, monitoring, Pre-Prod and masking, cutover execution |
| Support manager | Service desk, SLA, monthly service report and review, CAB |
| L2 application support | Triage, reproduction, analysis, configuration and data corrections under change control, workarounds |
| L3 engineering | Code defects, database scripts, performance, infrastructure where iorta TechNXT hosts, security incidents, fixes and releases |

# Client responsibilities

## Client responsibilities in the implementation

| # | Responsibility | Needed by |
|---|---|---|
| 1 | Name the project manager, key users (one per team), Accounting Manager, System Administrator, compliance officer and data protection officer, available at least 50% during discovery, UAT and cutover | Week 1 |
| 2 | Name a sponsor with authority to approve scope, changes and sign-offs | Week 1 |
| 3 | Choose the hosting option and decide on and document any transfer of personal data outside the Philippines | Week 1 |
| 4 | Provide the insurer list and agreements, commission and referrer rates, product list, chart of accounts and the accountant's mapping decisions, in the Configuration Kit | As stated in the plan for the size |
| 5 | Provide the user list with roles, branches and reporting lines | Configuration Kit |
| 6 | Confirm or obtain the BIR Authority to Print or CAS registration and the registered serial range of the sales invoices, and provide the last numbers used | Before the release to Production |
| 7 | Where covered, enrol with the BIR Electronic Invoicing System and provide the credentials to the secret store | Before the EIS connector is switched to live |
| 8 | Confirm or obtain the AMLC registration, portal access and institution code | Before the go/no-go |
| 9 | Confirm the NPC registration of the data protection officer and the data processing systems, and the privacy notice in force | Before the go/no-go |
| 10 | Provide the licences of the firm, its officers and agents, and the certificates of authority of the insurers | Compliance set-up |
| 11 | Obtain the screening lists it is entitled to use and any licence of a PEP list; decide the screening provider | Compliance set-up |
| 12 | Have the tax codes, rates, ATC, BIR forms and the wording of invoices and receipts confirmed in writing by its tax adviser; have the delivered AML/CFT values confirmed by its compliance officer | Before UAT sign-off |
| 13 | Provide the SMTP mailbox; contract its partners (banks for payment files, SMS provider, CTPL authentication provider, insurers, payment gateway) and have their credentials placed in the secret store; provide the COC number series | Integrations phase |
| 14 | Arrange the certification of each partner interface with the partner, and decide the fallback at the go/no-go for any interface not certified | Integrations phase; go/no-go |
| 15 | Provide one recent statement export per bank account | Integrations phase |
| 16 | Provide the logo, the sign-in picture, its signatories and their consent to e-signatures; for a client brand pack, confirm the contract reference covering the use of the Client's marks on the engagement file before the pack is applied | Branding phase |
| 17 | Hold the escrow copy of the production encryption keys jointly with iorta TechNXT, as stated in the key custody record; where the Client hosts, hold the keys with its backups | Before Production is provisioned |
| 18 | Extract and cleanse the in-force policy, open receivable, open claim and trial balance data, in the Migration Kit | Each mock load and cutover |
| 19 | Approve, through its data protection officer, every copy of production data used outside production, after masking | Each refresh or rehearsal copy |
| 20 | Provide the user list for training, training rooms, devices and attendance | Two weeks before training |
| 21 | Provide UAT testers and sign-off authority | UAT phase |
| 22 | Freeze the old system and provide the final extract at cutover; keep the old system read-only for reference | Cutover |
| 23 | Decide on the fit-gap register and change requests within 3 Business Days | Throughout |
| 24 | Sign or reject each Deliverable within 5 Business Days of submission | Throughout |

## Client responsibilities in production support

| # | Responsibility |
|---|---|
| 1 | Keep named L1 super users (one per team) and a System Administrator, trained and available in service hours |
| 2 | Keep a change owner and an IT head for escalations and change decisions, and a DPO for privacy matters |
| 3 | Raise tickets only through named L1 contacts (up to [5]), with the minimum content of the Support Agreement |
| 4 | Give access to the people who can reproduce the issue and test the fix |
| 5 | Provide testers for releases in UAT and approve releases within the agreed time |
| 6 | Give notice of business events that affect support: month-end and year-end dates, BIR filing dates, peak renewal periods, new branches or large data loads |
| 7 | Keep the credentials, contracts and support contacts of third parties the Client owns (SMTP mailbox, payment gateway, banks and their file specifications, SMS provider, CTPL authentication provider, insurers' API access, domain names) and tell iorta TechNXT of any change by a partner before it takes effect |
| 8 | Use supported browsers (current Chrome, Edge or Firefox) and keep a working network |
| 9 | Manage Users through its own joiner, mover and leaver process; keep sign-in credentials confidential |
| 10 | Remain responsible for its regulatory filings, tax returns, BIR data files and EIS submissions, IC reports and licences, AMLC reports, NPC registrations and breach notifications, and its business decisions |
| 11 | Where the Client hosts: run the infrastructure, operating system, database, backups and monitoring, and deploy releases under iorta TechNXT's guidance |
| 12 | Keep the screening lists current (load each new version) and decide screening hits, EDD reviews and AML cases through its compliance officer |
| 13 | Keep the custody of the encryption keys as stated in the key custody record and take part in each key rotation |
| 14 | Keep the contract with iorta TechNXT that covers the use of the Client's marks in force while a client brand pack is used |

# RACI

## RACI: implementation

| Activity | iorta TechNXT PM | iorta TechNXT team | Client sponsor and PM | Client key users, IT and compliance |
|---|---|---|---|---|
| Project plan and governance | R | C | Sponsor A<br>PM R | I |
| Data request, kits and extraction | C | C | PM A | R |
| Discovery workshops | A | R | PM R | Key users R<br>Compliance C |
| Configuration decisions | C | R | PM A | Key users R<br>IT C |
| Configuration Kit and on-screen configuration | A | R | PM C | Key users R<br>IT R |
| Environments, pipeline, backups, monitoring (iorta TechNXT hosts) | A | R | PM I | IT C |
| Encryption keys and their custody | I | R | PM I | IT A |
| Regulatory registrations (BIR, AMLC, NPC, IC) | I | C | Sponsor A<br>PM R | Accounting Manager R<br>Compliance R |
| Compliance set-up and screening lists | I | R | PM C | Compliance A |
| Branding, e-signatures, brand pack | A | R | Sponsor C<br>PM C | IT R |
| Contract reference covering the Client's marks (client brand pack) | C | I | Sponsor A<br>PM R | I |
| Data cleansing | I | C | PM A | R |
| Mock loads and reconciliation | A | R | PM C | Key users R<br>IT C |
| E-mail and bank statement formats | A | R | PM C | Key users C<br>IT R |
| Partner integrations and their certification | C | R | PM A | IT R<br>Partners R |
| System integration test | A | R | PM I | C |
| UAT execution and sign-off | C | C | Sponsor A<br>PM R | R |
| Train-the-trainer | A | R | PM C | R |
| End-user training | C | C | PM A | R |
| Masked copies for the rehearsal | C | R | PM I | DPO A |
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
| Screening list updates, screening hits, EDD reviews, AML cases | Not applicable | Compliance officer R | C | A |
| Complaints and personal data breach registers kept to their deadlines | C | Compliance officer and DPO R | C | A |
| Partner change (bank file specification, provider endpoint or credentials) | R (configuration of the connector) | C | A | I |
| Rotation of an encryption key | R | I | A | I |
| Masked copy of production for a lower environment | R | I | C | A<br>Client DPO R |

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
| A regulatory registration is not in place by the date of the plan | Treated as a late Client dependency; the go-live date may move | SOW, Special conditions |
| A partner has not certified its interface by the go/no-go | Go-live proceeds with the recorded fallback; the connector is switched to live later | SOW, Special conditions |
| Contract reference covering the Client's marks not on the engagement file | The client brand pack is not applied | SOW, Special conditions |
| Encryption key custody record not signed | Production is not provisioned; the timeline moves | SOW, Special conditions |

# Acceptance of this annex

| For iorta TechNXT Corp. | For [Client legal name] |
|---|---|
| Signature: ____________________ | Signature: ____________________ |
| Name: [name] | Name: [name] |
| Title: [title] | Title: [title] |
| Date: [date] | Date: [date] |
