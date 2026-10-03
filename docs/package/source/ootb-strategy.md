---
title: OOTB Strategy and Playbook
subtitle: iNXT BrokerVerse
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: To be completed
approved: To be completed
change: Initial issue for management review
open_item: Owner decisions listed in the last chapter
acronyms: AM=Account manager; AMC=Annual Maintenance Contract; AML=Anti-money laundering; API=Application programming interface; ARR=Annual recurring revenue; BIR=Bureau of Internal Revenue; CAB=Change advisory board; CEO=Chief executive officer; CR=Change request; DPA=Data Processing Agreement; DPO=Data protection officer; DSO=Days sales outstanding; eFPS=Electronic Filing and Payment System; IC=Insurance Commission; KPI=Key performance indicator; L1/L2/L3=Support levels 1, 2 and 3; LOB=Line of business; LoA=Letter of Award; MSA=Master Services Agreement; NDA=Non-disclosure agreement; NPC=National Privacy Commission; OOTB=Out of the box; PHP=Philippine peso; PM=Project manager; RACI=Responsible, Accountable, Consulted, Informed; RCA=Root-cause analysis; SaaS=Software as a service; SH=Sales head; SIT=System integration test; SLA=Service level agreement; SMS=Short message service; SOW=Statement of work; UAT=User acceptance testing; USD=United States dollar; VAT=Value-added tax
---

# Purpose and how to use this playbook

## Purpose

This playbook sets out how iorta TechNXT Corp. (**iorta TechNXT**) takes iNXT BrokerVerse OOTB to market in the Philippines and runs it as a product: what OOTB means, who we sell to, what we offer, how we sell, deliver and support it, how the product evolves, who does what, how we measure it and how we launch it in the next 90 days.

It is one document for five functions:

| Function | Read first |
|---|---|
| Management | Chapters on OOTB, market, offer, governance, KPIs, launch plan and decisions |
| Sales and presales | Offer, sales process, approval gates |
| Delivery | Delivery model, team and roles |
| Development and product | Product boundary, product lifecycle |
| Support | Support model, handover from delivery |

## Sources and assumptions

The facts in this playbook come from the iorta TechNXT documentation package of 03 October 2026: the price book and Rate Card, the Commercial Proposal Note, the Negotiation Playbook, the contract pack, the Implementation Approach and Plan, the Data Migration and Cutover Plan, the Training Plan, the Production Support Approach and Standards, the Architecture, Infrastructure, Security and Privacy document, the Product Functionality document, the Test Summary Report and the sales collateral.

> Where this playbook makes a recommendation or an assumption that is not stated in those documents, it is marked **Assumption** or **Proposed**. Targets marked Proposed are starting values for management to confirm.

All amounts are in PHP and exclude 12% VAT. USD figures are for reference only, at PHP 62.75 per USD (25 September 2026).

# What OOTB means

## Definition

iNXT BrokerVerse OOTB is the out-of-the-box version of the iNXT BrokerVerse insurance broking platform: one product line, the same code for every client, fitted to each broker by configuration and master data, not by code changes.

Five rules follow from that definition:

1. **Configure, do not customise.** A requirement is met by configuration, master data or a change in the broker's procedure. What cannot be met that way is a gap, recorded in the fit-gap register and handled as a change request.
2. **One code line.** There is no client-specific branch of the product. A change request is either merged into the product line, and then supported under the AMC or the subscription, or it is supported at day rates.
3. **Go-live first, changes after.** Approved change requests may be scheduled after go-live so that the OOTB go-live date holds.
4. **Data drives the timeline.** Most implementation effort sits with the broker's data. Requests for data go out in week 1.
5. **Priced as delivered.** The price list prices the product as delivered. Changes are priced at published day rates.

## The product at a glance

| Item | iNXT BrokerVerse OOTB (tested release) |
|---|---|
| Scope | Full broking cycle and broker accounting: prospects to renewals, billing to month-end close, BIR working papers |
| Roles | 7: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager |
| Screens | 173 menu screens checked per role in the release test |
| Reports | 39 catalogue reports in Excel, CSV and PDF, plus dashboards and document outputs |
| APIs | 854 registered API routes |
| Scheduled jobs | 16 jobs in Asia/Manila time |
| Number series | 52 document number series |
| Release test | 497 test cases (480 passed, 8 failed, 3 blocked, 6 not run); 634 automated business rule tests; a UAT cycle of 371 business steps |
| Technology | React 18 web application, Node.js 22 API, PostgreSQL 16 database |
| Documentation | User manual of 199 pages, seven role decks, reports book, data dictionary, technical reference |

## The product boundary

| Layer | What it contains | Who pays | Who supports |
|---|---|---|---|
| Product | All delivered modules, screens, workflows, reports, printed documents, upload templates and the standard integrations | Licence fee or subscription | iorta TechNXT, under the AMC or the subscription |
| Configuration | Company, users and roles, insurers, products and tariff, commission, taxes, chart of accounts, posting rules, number series, approvals, schedules, e-mail texts | Implementation fee | The broker's System Administrator, with L2 support |
| Change requests merged into the product line | Changes that iorta TechNXT decides to add to the product for all clients | Day rates, once, by the client who asked | iorta TechNXT, under the AMC or the subscription |
| Change requests not merged | Client-specific changes | Day rates | iorta TechNXT, at day rates after the 30-day warranty |
| Services | Implementation, data migration, training, hosting, integrations, extra environments, exit assistance | Rate Annex | iorta TechNXT |
| Outside the offer | Regulatory filings, tax and legal advice, hardware and networks, data cleansing | Not applicable | The broker |

## Standard integrations in OOTB

- Outgoing e-mail through the broker's SMTP mailbox.
- Bank statement files: formats for BDO, BPI and Metrobank and a generic layout are delivered; a new format is added in Master > Finance > Bank Statement Formats without code.
- Insurer statement files in CSV or Excel, matched in Insurer Reconciliation with a column mapping per insurer.
- PayMongo and Dragonpay payment links.

Everything else (insurer APIs, core banking, bank payment files, SMS gateways, accounting packages, BIR eFPS or eBIRForms, LTO or IC systems, other payment gateways) is a change request or an optional integration.

# Target market and segments

## The Philippine broker market

The market is small and concentrated. The IC key data for 2024 (preliminary) shows about 67 licensed insurance brokers. A broker needs a minimum paid-up capital of PHP 20,000,000.00, or PHP 50,000,000.00 for an insurance and reinsurance broker. Three brokers earn more than PHP 2 billion each in commission, a handful earn between PHP 250 million and PHP 800 million, and most earn under PHP 100 million.

Non-life gross premiums written reached PHP 149.11 billion in 2025, spread across many insurers. A Philippine broker places with many insurers, so insurer set-up, remittance and reconciliation by insurer are core needs at every size.

## Segments

| Segment | Users (tier) | Typical profile (estimate) | IC 2024 position | Lead offer |
|---|---|---|---|---|
| Owner-managed broker | Small: 1 to 25 | 10 to 40 staff, one office or a few branches | Rank 30 and below | Subscription: Essentials or Standard |
| Established mid-size broker | Medium: 26 to 100 | 40 to 150 staff, several branches | Rank 10 to 30 | Subscription: Standard; perpetual for a long horizon |
| National or multinational broker | Large: 101 to 300 | 150 to 400 staff, national or multinational | Rank 4 to 10 | Perpetual: Ownership or Ownership Plus |
| Bank-affiliated or global broker | Enterprise: above 300 | Over 400 staff | Top 3 | Perpetual: Ownership Plus |

**Assumption:** the first wins are most likely in the Small and Medium segments, where most brokers sit, buying cycles are shorter and local tax and BIR features matter most. Large and Enterprise brokers that are part of a global group may already run a group system; with them, lead with the Philippine accounting, BIR working papers and remittance features.

## Buyers and triggers

| Buyer | What matters to them |
|---|---|
| Owner, president or CEO | Cost against commission income, control, audit findings, growth without hiring |
| Finance head or Accounting Manager | Official receipts, remittance to insurers, bank and insurer reconciliation, month-end close, BIR working papers |
| Operations head | Quotation to policy turnaround, renewals, endorsements, claims follow-up |
| IT head | Hosting, data location, security, support, exit |
| Compliance officer and DPO | Data Privacy Act, audit trail, maker-checker, segregation of duties |

Typical triggers (assumption): the end of a contract for the current system, a new BIR requirement, an audit finding, growth that the spreadsheets cannot carry, or a new licence.

## Qualification

A prospect is qualified when the account manager can answer yes to each of these:

1. It holds or is applying for an IC certificate of authority as a non-life broker.
2. It has a named pain in broking, accounting or BIR reporting that the OOTB product addresses.
3. It accepts the OOTB principle: configuration first, changes as change requests.
4. A decision maker and a budget range are known; the budget fits the tier price at list.
5. A target date exists, or one can be set from a business event.

## Positioning

iNXT BrokerVerse OOTB at USD 32 to 51 per user per month sits at about 29% of the median price of the global broker systems found (USD 175), which are not localised for Philippine taxes, BIR reports or IC reporting, and at about the per-user price of a generic CRM at its top edition, while including placement, remittance, accounting, reconciliation and BIR working papers. The message is a localised, full broking and accounting platform priced for a market where most brokers earn under PHP 100 million in commission.

# The offer

## Modules

All delivered modules are included in every package: dashboards; prospects and clients; Quick Quote and Compare Insurers; motor quotation and customer approval; request for quotation and placement; policy issuance and servicing; endorsements and cancellations; claims; renewals; billing, payments and official receipts; collections and credit control; disbursement and petty cash; remittance to insurers and direct bill; commission and referrers; incentives; general ledger and journals; period end; bank reconciliation; insurer reconciliation; BIR tax working papers (Form 2307, VAT Summary, SAWT, QAP, SLSP); reinsurance; Product Configurator; reports; notifications and e-mail; data privacy; administration, security and configuration.

## Commercial models

| Item | Perpetual licence with AMC | Subscription |
|---|---|---|
| Software price | Per named user, one-time, graduated slabs: PHP 90,000.00, 78,000.00, 66,000.00, 54,000.00 | Per named user per month, graduated slabs: PHP 3,200.00, 2,800.00, 2,400.00, 2,000.00 |
| Minimum | None | Minimum billable users: 10, 26, 101, 301; minimum term 12 months |
| Implementation | Implementation fee by size and lines of business | Onboarding fee equal to the implementation fee |
| Support | 12-month warranty, then AMC at 22% of the licence fee a year, plus 5% a year | Included in the Monthly Fee, plus 5% a year |
| Payment | Licence 100% on go-live; implementation 40/40/20 | Monthly in advance from go-live; onboarding 40/40/20 |
| Best for | A horizon of four years or more; capital budget | Lower Year 1 cash; no capital approval |
| Optional escrow | Yes | No |

Subscription costs less in cash for the first three years; for the reference user counts its cumulative cost passes the perpetual model in Year 4. Perpetual costs 13% to 18% less over five years.

## Implementation fee

| Size | Base man-days | Lines of business included | Training days included | Fee (PHP) | Duration to hypercare exit |
|---|---|---|---|---|---|
| Small | 70 | 5 | 4 | 1,130,000.00 | 8 weeks |
| Medium | 130 | 8 | 6 | 2,090,000.00 | 12 weeks |
| Large | 230 | 12 | 10 | 3,700,000.00 | 16 to 20 weeks |
| Enterprise | 360 | 16 | 15 | 5,800,000.00 | 20 weeks or more |

Each line of business above the included number adds 6 man-days at the blended rate of PHP 16,100.00.

## Hosting options

| Option | Data location | Small | Medium | Large | Enterprise |
|---|---|---|---|---|---|
| Hosted by the broker (cloud account or data centre) | Broker's choice | No fee | No fee | No fee | No fee |
| iorta TechNXT on AWS (ap-southeast-1) | Singapore | 30,000.00 | 62,000.00 | 112,000.00 | 244,000.00 |
| iorta TechNXT on Azure (Southeast Asia) | Singapore | 31,000.00 | 65,000.00 | 118,000.00 | 256,000.00 |
| iorta TechNXT with a local partner | Philippines | 28,000.00 | 59,000.00 | 107,000.00 | 232,000.00 |

Per month, production and one UAT environment. Hosting in Singapore is a transfer of personal data outside the Philippines that the broker documents under the Data Privacy Act. Hosting is always quoted separately so the software price stays comparable.

## Packages

| Package | Model | Hosting | Support | Small, Year 1 (PHP) | Medium, Year 1 (PHP) |
|---|---|---|---|---|---|
| Essentials | Subscription | By the broker | Standard | 1,706,000.00 | 4,226,000.00 |
| Standard | Subscription | AWS Singapore | Standard | 2,066,000.00 | 4,970,000.00 |
| Ownership | Perpetual with AMC | AWS Singapore | Standard | 2,840,000.00 | 7,814,000.00 |
| Ownership Plus | Perpetual with AMC | Local partner, Philippines | Standard and 24x7 Severity 1 | 3,356,000.00 | 8,558,000.00 |

Year 1 at list for the reference users (Small 15 users and 5 lines of business; Medium 60 users and 8 lines). The Rate Card gives all four sizes and the 5-year totals.

## Optional services

Additional environments (PHP 100,000.00 set-up, PHP 11,000.00 a month hosted), training beyond the included days (PHP 30,000.00 per trainer day), data migration beyond the standard templates (PHP 240,000.00 per legacy source), integrations (standard PHP 320,000.00, complex PHP 720,000.00), additional line of business after go-live (PHP 100,000.00), new report or document template (typical PHP 60,000.00), on-site days (PHP 20,000.00), 24x7 Severity 1 support (Small PHP 240,000.00 to Enterprise PHP 1,500,000.00 a year), change requests at day rates (business analyst PHP 18,000.00, developer PHP 16,000.00, QA engineer PHP 12,000.00, project manager PHP 22,000.00, blended PHP 16,100.00). The Service Catalogue and Rate Annex holds the full list.

# Sales process

## Stages, collateral and exit criteria

| # | Stage | Collateral to use | Exit criterion | Owner |
|---|---|---|---|---|
| 1 | Target and first contact | Brochure; prospect e-mails (cold introduction small or large broker, follow-ups 1 and 2, LinkedIn note, event invitation) | Meeting agreed | Account manager |
| 2 | First meeting and qualification | Client Presentation; pre-meeting agenda and thank-you e-mails; discovery questions of the Demo Script; FAQ and Objection Handling | Qualified against the five criteria | Account manager |
| 3 | Demonstration | Demo Script (60 or 30 minutes) on the demo environment with the UAT data set; demo invitation and follow-up e-mails; Mutual NDA if own data is shown | Workshop agreed | Account manager and solution consultant |
| 4 | Discovery workshop and sizing | Product Functionality document; Regulatory Compliance Matrix; Implementation Approach and Plan; ROI Calculator when finance asks; Architecture document for IT | Size, users, lines of business, hosting and model agreed | Solution consultant |
| 5 | Proposal | Rate Card; Quick Quote at list with the Validity and Terms sheet; proposal cover e-mail within 5 working days of the workshop; ROI result | Proposal sent | Account manager |
| 6 | Negotiation | Negotiation Playbook (internal only); negotiation follow-up e-mail; FAQ and Objection Handling | Price and terms agreed within the approval limits | Account manager, sales head |
| 7 | Award | Letter of Award or Proposal Acceptance form | Award received | Account manager |
| 8 | Contract | Contract Pack Index and Cover Letter; MSA, Order Form and schedules for the model; contract dispatch e-mail | Contract set signed | Account manager, legal counsel |
| 9 | Hand-off to delivery | Welcome e-mail within 2 working days of signing; signed deal file; kick-off date | Kick-off held | Account manager, head of delivery |
| 10 | Reference and expansion | Referral request e-mail after go-live and a stable first month-end close | Reference agreed; added users or options | Account manager |

The e-mail sequence and timings are in the Prospect E-mail Templates: follow-up 1 on day 4 to 5, follow-up 2 on day 10 to 12 then a 60-day pause, re-engagement 60 to 90 days after a prospect goes quiet.

## Rules for the sales team

- Start at list price. Show the list price in every presentation and the first quotation. Send the quotation within 2 business days of the meeting.
- Trade, do not give. Every concession is exchanged for term, cash timing, a reference, scope or a signing date. Move scope before price.
- Protect the recurring line. The AMC rate (22%) and the yearly escalation (5%) are not discounted.
- Disclose the known limits of the OOTB release when the topic comes up (FAQ, Known limits of the OOTB version).
- Never demonstrate on a production system or with a prospect's real client data.
- The client copy of the prices is the Rate Card. The price book, the floor prices and the Negotiation Playbook are never sent.

## Approval gates

| Gate | When | Approver | Evidence |
|---|---|---|---|
| G1: qualification | Before a demonstration | Account manager; sales head for Large and Enterprise (Proposed) | Qualification criteria met |
| G2: pricing | Before the quotation with any discount leaves iorta TechNXT | By the highest discount on any component (table below) | Quick Quote, reason, levers, written approval in the deal file |
| G3: delivery capacity | Before the proposal states a go-live date (Proposed) | Head of delivery | Size, dates and team confirmed |
| G4: legal review | Before the contract set is sent, when a legal trigger applies | Legal counsel; CEO where the playbook says so | Redline and approval |
| G5: signature | Before signing | Authorised signatory | Completed sales and legal checklists of the Contract Pack Index |

## Discount limits

| Component | Account manager | Sales head | CEO | Floor |
|---|---|---|---|---|
| Perpetual licence fee | 5% | 10% | 15% | 85% of list |
| Subscription per user per month | 5% | 10% | 15% | 85% of list |
| Implementation or onboarding fee | 5% | 10% | 15% | 85% of list |
| One-time optional services and 24x7 support | 5% | 10% | 15% | 85% of list |
| Hosting per month | 0% | 5% | 10% | 90% of list |
| Change requests and day rates | 0% | 5% | 10% | 90% of list |
| AMC rate (22%) and yearly escalation (5%) | Not discounted | Not discounted | Not discounted | 22% and 5% |

Levers (longer term, upfront payment, reference customer, case study, signing date, onboarding reduction) count toward the limit. No more than three levers on one deal without the sales head.

## Legal review triggers

Legal counsel reviews before release when the deal changes: the limitation of liability or the data protection cap; payment term beyond 30 days; suspension terms; auto-renewal; service credits; governing law or venue; adds source code escrow; uses the client's own contract paper; or adds an early termination right. The platform IP position is not negotiable.

# Delivery model

## Phases

| # | Phase | What happens |
|---|---|---|
| 1 | Mobilisation | Kick-off, team and governance, plan confirmed, data requests issued, environments ordered |
| 2 | Discovery and fit-gap | Walk-through of each process on the delivered system; configuration decisions; fit-gap register |
| 3 | Environment set-up | Test (UAT) and production environments, e-mail account, backups, monitoring |
| 4 | Configuration | Masters, products and rates, numbering, chart of accounts, posting rules, approvals, security |
| 5 | Data migration | Extraction by the broker, mapping to the templates, mock loads, reconciliation |
| 6 | Integrations | E-mail, bank statement files, payment gateway |
| 7 | Training | Train-the-trainer for key users, then end-user training per role |
| 8 | System integration test | End-to-end runs across roles with the configured data |
| 9 | User acceptance test | Key users run the UAT scripts with the broker's own data |
| 10 | Cutover | Final extract, final loads, reconciliation, go/no-go |
| 11 | Go-live | First day of transactions in iNXT BrokerVerse |
| 12 | Hypercare | Close support until the first month-end close is done |

## Timelines by size

| Milestone | Small (8 weeks) | Medium (12 weeks) | Large (20-week plan) |
|---|---|---|---|
| Kick-off | Week 1 | Week 1 | Week 1 |
| Configuration workbook and fit-gap register signed | Week 2 | Week 3 | Week 5 |
| Mock load 1 reconciled | Week 3 | Week 5 | Week 7 |
| SIT exit report | Week 4 | Week 7 | Week 11 |
| UAT sign-off and go decision | Week 6 | Week 9 | Weeks 13 to 14 |
| Go-live | Week 7 | Week 10 | Week 15 |
| Hypercare exit and handover | Week 8 | Week 12 | Week 20 |

A Large broker with a simple product mix can follow a 16-week variant with go-live at the start of week 13. Enterprise plans are set at mobilisation (20 weeks or more).

## Team size by implementation

The average team size below is derived from the base man-days and the duration. **Assumption:** the actual mix is set by the head of delivery at mobilisation.

| Size | Base man-days | Weeks | Average full-time equivalents | Typical team (Proposed) |
|---|---|---|---|---|
| Small | 70 | 8 | About 1.8 | Project manager (part time), one functional consultant, technical and DevOps lead (part time) |
| Medium | 130 | 12 | About 2.2 | Project manager (part time), two functional consultants, migration lead, technical and DevOps lead (part time) |
| Large | 230 | 16 to 20 | About 2.3 to 2.9 | Project manager, two or three functional consultants, migration lead, technical and DevOps lead |
| Enterprise | 360 | 20 or more | About 3.6 or less | Project manager, three functional consultants, migration lead, technical and DevOps lead, head of delivery in the steering committee |

## Data migration

- Templates only: every load uses the delivered upload templates. The broker owns, extracts, cleanses and signs off its data; iorta TechNXT advises on mapping, runs the loads with the broker and reports the results.
- Open positions, not history: in-force policies, open receivables, the trial balance and masters at the go-live date. Closed history stays in the old system, kept read-only.
- Mock loads: two for Small (the second is the cutover rehearsal), three for Medium, four for Large. Exit criteria rise from "all files load" to "all control figures reconcile and UAT on migrated data passes".
- Go/no-go: UAT signed with no open severity 1 or 2 defect; final load reconciled exactly or differences accepted in writing by the Accounting Manager; users trained; cutover checklist done; hypercare team ready; rollback plan confirmed. Rollback is planned up to the end of the first business week; after that, fix forward.

## Training

Role-based train-the-trainer: iorta TechNXT trains one key user per team (two for teams of more than 15 users), who then train their teams with iorta TechNXT present at the first sessions. At least two thirds of each session is hands-on. Every user passes a practical assessment before receiving production access; key users need at least 90%. End-user training runs in the two weeks before go-live.

## Acceptance

Every phase ends with named deliverables and written acceptance. The Client reviews within 5 Business Days; a deliverable is deemed accepted if no written objection arrives in that time, or if the Client uses it in production. Severity 3 and 4 defects alone do not block acceptance. Three certificates mark the money and service milestones:

| Certificate | Effect |
|---|---|
| UAT Sign-off Certificate | Second 40% of the implementation or onboarding fee; condition for the go decision |
| Go-live Acceptance Certificate | Final 20%; perpetual licence fee; subscription Monthly Fee starts; Warranty Period starts |
| Hypercare Exit and Handover to Support Certificate | Production support under the Support Agreement takes over |

## Hypercare

The project team stays with the broker after go-live: daily check-ins in the first week, then weekly. Hypercare covers the first month-end close (bank reconciliation, remittance, Month-End Close run, BIR reports). Default length: 2 weeks (Small), 3 weeks (Medium), 4 to 6 weeks (Large). If the first close falls later, hypercare extends at no charge. Exit requires no open P1 or P2, the first close approved, known errors documented, environment and configuration baselines recorded, contacts agreed, L1 trained on tickets, monitoring live and a first restore test passed.

## Delivery governance

A steering committee (broker sponsor as chair, broker project manager, Accounting Manager and a business head; iorta TechNXT account manager and project manager) meets every two weeks and at each go/no-go. A weekly status meeting reviews progress, the RAID log and decisions needed. Escalation runs from the project managers to the steering committee, then to the dispute steps of the MSA.

# Support model

## Levels

| Level | Who | Scope |
|---|---|---|
| L1 | Broker super users (one trained key user per team) and the broker's System Administrator | How-to questions; users, roles and password resets; settings and master data; logging tickets with evidence |
| L2 | iorta TechNXT application support | Triage, reproduction, analysis, configuration and data corrections under change control, workarounds, known-error records, release coordination |
| L3 | iorta TechNXT engineering and DevOps | Code defects, database scripts, performance, infrastructure where iorta TechNXT hosts, security incidents, RCA, fixes and releases |

Only named L1 contacts of the broker (up to 5) raise tickets, through one service desk: a portal or mailbox for all tickets and a telephone line for P1.

## Service levels

Standard support runs 08:00 to 18:00 PHT, Monday to Friday, except Philippine regular holidays. The 24x7 Severity 1 option adds round-the-clock response to P1 incidents reported by telephone.

| Severity | First response | Updates | Restore or workaround | Permanent fix |
|---|---|---|---|---|
| P1 Critical | 30 minutes | Every hour | 4 service hours | RCA in 5 Business Days; next emergency or planned release |
| P2 High | 2 service hours | Every 4 service hours | 2 Business Days | Next planned release |
| P3 Medium | 1 Business Day | Every 3 Business Days | 5 Business Days | Planned release as agreed |
| P4 Low | 2 Business Days | Weekly | Not applicable | Planned, or a change request |

Service credits apply for missed P1 and P2 restore targets and for response and restore SLA below 95% and 90%, capped at 10% of the monthly fee of the affected service. Hosting availability target: 99.5% in service hours.

## Release and patch policy

| Item | Policy |
|---|---|
| Planned release | Monthly, when there are fixes or changes; release notes at least 10 Business Days before deployment to UAT |
| Emergency release | For a P1 or a security issue, approved by the support manager and the broker's IT head |
| Testing | Installed in the test environment first; the broker runs the UAT scripts that cover the change; iorta TechNXT runs the regression set |
| Deployment | In the maintenance window (default Saturday 20:00 to Sunday 06:00 PHT), announced at least 5 business days ahead; database snapshot before; smoke test after |
| Rollback | Previous image and front-end build; migrations only add, so the previous version runs on the newer schema |
| Supported versions | The current release and the two previous planned releases |
| Patching | Runtime and dependency advisories reviewed monthly; critical fixes as an emergency release; container base image at least quarterly; operating system and database patches monthly critical security patches within 14 days and high within 30 days where iorta TechNXT hosts |

## AMC and the subscription

For a perpetual licence, the first 12 months from go-live are the Warranty Period with support at no charge; the AMC starts in Year 2 at 22% of the licence fee a year, invoiced yearly in advance and increasing 5% at each anniversary. A lapsed AMC is reinstated by paying the lapsed fees plus a reinstatement fee. For a subscription, the same support is included in the Monthly Fee. In both, the AMC or subscription covers corrections, updates of the OOTB version, regulatory form updates released for all customers, security patches and standard support.

## Service management

- Monthly service report by the 10th Business Day and a monthly service review with the broker's IT head and System Administrator; a yearly review agrees improvements and the release plan.
- Problem records for every P1, for P2s with unknown cause and for causes behind three or more incidents a month.
- A knowledge base shared with L1 contacts, reviewed at each release and at least twice a year.
- Backup verification daily, restore tests quarterly, a tabletop DR exercise yearly and a full recovery every two years where iorta TechNXT hosts.

# Product lifecycle

## Versioning

The release in production is identified by its release tag and the commit shown by `GET /api/version`. **Proposed:** name releases by year and sequence, with three levels:

| Level | Content | Cadence (Proposed) | Example |
|---|---|---|---|
| Major release | New modules, merged change requests, regulatory changes, migrations | Twice a year | 2027.1 |
| Planned (minor) release | Fixes, small merged changes, regulatory form updates | Monthly, when there is content | 2027.1.3 |
| Emergency release | P1 fix or security patch | As needed | 2027.1.3-e1 |

A major release triggers an updated source code escrow deposit for clients with escrow. Supported versions follow the AMC: the current release and the two previous planned releases.

## From change request to product feature

1. **Request.** The client raises a change request; iorta TechNXT logs it within 2 Business Days.
2. **Impact assessment.** iorta TechNXT states in Part B of the Change Request Form whether the need can be met by configuration, and whether the change will be merged into the product line (Yes, No, To be decided).
3. **Product decision.** The product council (below) decides the merge for every Medium and Large change request and for any Small one that more than one client has asked for. Criteria: number of clients and prospects asking; regulatory driver; fit with the roadmap; effect on configuration rather than code; support cost of not merging.
4. **Build once.** A merged change is built in the product line as configurable behaviour (a setting, a template or a master), not as a client-specific branch, and released in a planned release.
5. **Price.** The requesting client pays the change request price once. The feature then becomes part of the product for all clients under the AMC or the subscription.
6. **Not merged.** A client-specific change is supported at day rates after its 30-day warranty and is not covered by the AMC.

**Proposed:** iorta TechNXT may offer a reduced change request price when a change is merged and judged useful to most clients. This is a commercial decision for the CEO, counted against the discount limits.

## Roadmap themes

The themes below come from the known limits and the "outside OOTB" list of the current release. They are candidates, not commitments; no dates are promised to clients until the product council approves a release plan.

| Theme | Current release | Candidate direction |
|---|---|---|
| Bank payment files | Transfers approved and their bank result recorded; no bank payment file | Payment file formats for the main Philippine banks, starting with the banks of the first clients |
| Insurer APIs | Files and e-mail to insurers; insurer statement files | API connectors for named insurers where the insurer offers an API, as change requests merged into the product |
| SMS | E-mail and in-app notifications | SMS gateway for renewal notices, payment reminders and sign-in codes |
| BIR eFPS and eBIRForms | BIR working papers in BIR column order, validated with BIR tools before filing | Output files in the formats the BIR tools accept |
| IC report formats | Figures from financial statements and production reports; no IC-format report | IC report formats as delivered reports |
| Mobile | Web application for desktop and laptop browsers; mobile layouts not tested | Responsive layouts for key screens first; a mobile application only if demand is shown |
| Percentage tax | No working paper for a non-VAT broker's percentage tax | Working paper |
| Anti-money laundering | No transaction monitoring, sanctions or PEP screening | Screening integration or export |
| Security and usability | Session in local storage; two-step enrolment without QR code; moderate advisory on a front-end library; no screen for report schedules; some masters without an Upload button; Filipino screens not available | httpOnly cookie session; QR code enrolment; library upgrade; schedule screen; Upload buttons; translation file |
| Capacity | No load test run yet | Load test on a production-sized environment before the first Large go-live |

## Development standards

Code changes follow the code fix standards of the Production Support Approach and Standards: branching and review, rules for the change, unit and business-rule tests, and the regression set before each release. Each release is checked against the regression tests (634 business-rule tests in the tested release) and the role-based screen check.

# Team and roles at iorta TechNXT

## Roles by stage

| Role | Sell | Contract | Deliver | Support | Product |
|---|---|---|---|---|---|
| CEO | Approves discounts up to 15%; key accounts | Signs; approves liability and credit changes with legal counsel | Escalation | Escalation | Chairs the product council (Proposed) |
| Sales head | Pipeline; approves up to 10% | Approves payment term up to 45 days, auto-renewal changes, escrow | | | Market input |
| Account manager | Prospecting, meetings, demos, proposals; approves up to 5% | Prepares the contract set; deal file | Steering committee member | Commercial owner; renewals; referrals | Client requests |
| Solution consultant | Demos, discovery workshops, sizing | Scope inputs to the SOW | Can join the project as functional consultant (Proposed) | | Fit-gap patterns |
| Legal counsel | | Reviews the triggers; owns the templates | Change Request and certificate disputes | | |
| Finance | Credit check (Proposed) | Tax treatment, withholding | Milestone invoicing | AMC, subscription and hosting billing; collections | |
| Head of delivery | Capacity gate G3 | Dates in the Order Form | Delivery quality and resources; approves Medium CRs | Escalation | Delivery feedback |
| Project manager | | | Plan, RAID log, status, steering committee papers | Handover | |
| Functional consultants | | | Discovery, configuration, mapping, SIT, train-the-trainer, UAT support | L2 back-up during hypercare | |
| Migration lead | | | Mapping, loads, reconciliation, cutover runbook | | |
| Technical and DevOps lead | Hosting answers in presales | Hosting option and sizing | Environments, e-mail, payment gateway, backups, monitoring, cutover | L3 infrastructure, backups, DR drills | Platform operations |
| Support manager | | | Hypercare exit | Service desk, SLA, CAB, monthly service report | Problem trends |
| L2 application support | | | | Triage, analysis, configuration and data corrections | Known errors |
| L3 engineering | | | Change requests | Code defects, RCA, fixes, releases | Product development |
| Product manager (Proposed) | Roadmap briefings | | | Release planning | Roadmap, merge decisions, release notes |
| Data protection officer | NDA and privacy questions | DPA | Data migration privacy | Breach handling; certificates of deletion | Privacy by design |

## Capacity

**Assumption:** with the man-days of the price book, one delivery pod (project manager, two functional consultants, migration lead and a shared technical and DevOps lead) can carry one Medium project, or two Small projects, at a time. The head of delivery uses gate G3 to keep the sales pipeline within the delivery capacity.

# KPIs by function

Targets marked Proposed are starting values for management to confirm at the first quarterly business review.

## Sales

| KPI | Definition | Target |
|---|---|---|
| Qualified pipeline | Value of qualified opportunities at list, 5-year view | 3 times the yearly booking target (Proposed) |
| Win rate | Won / (won + lost) qualified opportunities | 25% (Proposed) |
| Quotation speed | Quotations sent within 2 business days of the meeting | 100% |
| Proposal speed | Proposals sent within 5 working days of the workshop | 100% |
| Average discount | Weighted discount off list, by component | Below 5% (Proposed) |
| Recurring share | Recurring fees (subscription, AMC, hosting) / 5-year contract value | Tracked |
| Sales cycle | Days from first meeting to signature | Tracked by segment |

## Delivery

| KPI | Definition | Target |
|---|---|---|
| Go-live on plan | Go-lives on the baselined date or within 2 weeks | 80% (Proposed) |
| Effort variance | Actual man-days / planned man-days, by project | Within 10% (Proposed) |
| Reconciliation at cutover | Control figures agree exactly or differences accepted in writing | 100% |
| UAT first pass | UAT scripts passed in the first cycle | 85% (Proposed) |
| Hypercare exit on plan | Exit by the planned week, or by the first month-end close | 90% (Proposed) |
| Milestone billing | Milestones invoiced within 5 Business Days of the certificate | 100% (Proposed) |
| Client satisfaction at hypercare exit | Survey score | 8 out of 10 (Proposed) |

## Support

| KPI | Definition | Target |
|---|---|---|
| Response SLA | Tickets responded to within target / tickets | 95% |
| Restore SLA | Tickets restored within target / tickets | 90% (P1: 100%) |
| Availability (iorta TechNXT hosts) | Available minutes in service hours / minutes in service hours | 99.5% |
| Reopen rate | Tickets reopened / tickets resolved | Below 5% |
| Backlog age | Open P3 tickets older than 30 days | 0 |
| RCA on time | P1 RCA reports within 5 Business Days | 100% |
| Change success | Changes without rollback or incident / changes | 95% |
| Backup tests | Planned restore tests done and passed | 100% |

## Product and development

| KPI | Definition | Target |
|---|---|---|
| Release on schedule | Planned releases delivered in the announced window | 90% (Proposed) |
| Regression pass | Business-rule tests passing at release | 100% |
| Escaped defects | P1 and P2 incidents caused by a release, per release | 0 P1 (Proposed) |
| Merge ratio | Change requests merged into the product / change requests delivered | Tracked; rising (Proposed) |
| Security advisories | Critical advisories fixed in an emergency release; high in the next release | Critical within 14 days, high within 30 days |
| Release test status | Failed, blocked and not-run cases of the release test closed | All closed before the next major release (Proposed) |

## Finance and management

| KPI | Definition | Target |
|---|---|---|
| Bookings | Contract value signed, at list and at the quoted price | Set yearly by the CEO |
| ARR | Subscription, AMC, hosting and 24x7 support, annualised | Set yearly by the CEO |
| AMC and subscription renewal | Renewals / renewals due | 95% (Proposed) |
| DSO | Average days from invoice to payment | 45 days or less (Proposed) |
| Reference customers | Live clients willing to take reference calls | 2 by the end of the first year (Proposed) |

# Governance

## Internal forums

| Forum | Members | Frequency | Decides |
|---|---|---|---|
| Pipeline review | Sales head, account managers, solution consultants | Weekly | Qualification, next steps, forecast |
| Deal desk (Proposed) | Sales head, head of delivery, finance; legal counsel when triggered | As needed, within 2 business days of a request | Pricing gate G2, capacity gate G3, legal gate G4 |
| Delivery portfolio review | Head of delivery, project managers | Weekly | Status, risks, resources across projects |
| CAB | Support manager with each client's change owner | Weekly, and as needed for emergencies | Normal and emergency changes in production |
| Product council (Proposed) | CEO (chair), product manager, head of delivery, support manager, engineering lead, sales head | Monthly | Merge decisions, roadmap, release plan |
| Quarterly business review | CEO and function heads | Quarterly | KPIs, targets, investments, price book changes |
| Price book review | CEO, sales head, finance | Yearly | Exchange rate, cloud prices, day rates, IC ranking inputs |

## Client-facing forums

| Forum | Frequency | Source |
|---|---|---|
| Project steering committee | Every two weeks and at each go/no-go | Implementation SOW |
| Weekly status meeting | Weekly during the project | Implementation SOW |
| Monthly service review | Monthly after handover | Support Agreement |
| Yearly review | Yearly | Support Agreement |
| Tabletop DR exercise | Yearly, where iorta TechNXT hosts | Hosting Agreement |

## Document control

The contract templates, price book, rate card and sales collateral are controlled documents. Prices are changed only by rebuilding the price book from the pricing workbook. Contract templates are changed only with legal counsel. The Contract Pack Index lists the current set.

# 30/60/90-day launch plan

The plan starts on the date management approves this playbook (Day 1). Owners are roles; targets are Proposed.

## Days 1 to 30: ready to sell

| # | Action | Owner |
|---|---|---|
| 1 | Approve this playbook and take the owner decisions in the last chapter | CEO |
| 2 | Legal review of the full contract pack; choose an escrow agent; confirm the open bracketed positions | Legal counsel |
| 3 | Confirm cloud and local partner hosting prices with the providers; select the local hosting partner | Technical and DevOps lead |
| 4 | Confirm the withholding treatment of the licence fee and the subscription with the tax adviser | Finance |
| 5 | Set up the demo environment with the UAT data set; rehearse the 60- and 30-minute demonstrations | Solution consultant |
| 6 | Train account managers on the Demo Script, the FAQ, the price book Quick Quote and the Negotiation Playbook | Sales head |
| 7 | Build the target list from the IC list of licensed brokers, by segment, with named buyers | Account managers |
| 8 | Close or explain the failed, blocked and not-run cases of the release test; plan the load test | Engineering lead |
| 9 | Set up the service desk, the knowledge base starter set and the monthly service report template | Support manager |
| 10 | Name the first delivery pod and the project templates (charter, plan, RAID log, configuration workbook) | Head of delivery |

## Days 31 to 60: first conversations

| # | Action | Owner |
|---|---|---|
| 11 | Run the e-mail sequence to the target list; LinkedIn notes; one webinar or event | Account managers |
| 12 | Hold first meetings and qualification; target 10 meetings and 4 demonstrations (Proposed) | Account managers |
| 13 | Run the first discovery workshops; produce sized quotations at list | Solution consultant |
| 14 | Start the deal desk; record every approval in the deal file | Sales head |
| 15 | Run the load test on a production-sized environment; publish the result | Engineering lead |
| 16 | Hold the first product council: merge criteria, versioning, roadmap candidates | CEO, product manager |
| 17 | Agree the hosting partner contract and the sub-processor details for DPA Annex 3 | Technical and DevOps lead, DPO |

## Days 61 to 90: first commitments

| # | Action | Owner |
|---|---|---|
| 18 | Send first proposals; negotiate within the limits; target 2 proposals and 1 award (Proposed) | Account managers, sales head |
| 19 | Issue the first contract set with the Contract Pack Index checklists | Account manager, legal counsel |
| 20 | Mobilise the first project; first-client terms to secure a reference (reference and case study levers) | Head of delivery, sales head |
| 21 | First quarterly business review: KPIs, pipeline against capacity, price book check | CEO |
| 22 | Publish the first release plan and release notes format | Product manager |

# Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Small market (about 67 brokers) | Few opportunities a year | Segment carefully; protect references; expand by added users and options |
| Requests for customisation | Longer projects, lower margin, product fragmentation | OOTB rules; change requests at day rates; product council merge decisions |
| Discounting to win early deals | Weak price list for later deals | Discount limits, floor, levers in exchange for references |
| Delivery capacity | Late go-lives, unhappy first clients | Capacity gate G3; one pod per Medium project |
| Data quality at the broker | Late cutover | Data requests in week 1; mock loads; steering committee escalation |
| Cross-border data concerns | Lost deals with data residency needs | Local partner hosting option in the Philippines |
| Known limits of the release | Objections in demos | Disclose with the workaround; roadmap themes; change request route |
| No load test yet | Performance risk for Large clients | Load test before the first Large go-live |

# Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| 1 | Confirm the discount limits (5%, 10%, 15%) and the floor | Confirm |
| 2 | Confirm that the AMC is computed on the quoted (net) licence fee | Confirm, as the contracts state |
| 3 | Early termination fee for committed terms: all or 50% of the remaining recurring fees | Decide before the first contract |
| 4 | Hosting fees: no yearly increase (price book) while "recurring optional items" increase 5% (Rate Card wording) | Done: hosting and additional hosted environments have no yearly increase; the Rate Card wording is aligned |
| 5 | Hypercare length: the Commercial Proposal Note says four weeks; the SOW and Implementation Approach set 2, 3 and 4 to 6 weeks by size | Done: the Commercial Proposal Note now follows the SOW |
| 6 | Size thresholds: commercial tiers use 26 to 100 users for Medium; the Implementation Approach uses 26 to 75 users for a Medium project | Done: both documents use 26 to 100 users; data volumes can still move a project to the next delivery size at mobilisation |
| 7 | Versioning scheme and release cadence (Proposed in this playbook) | Approve |
| 8 | Create the product manager role and the product council | Approve |
| 9 | Mobile: the FAQ says "not planned in OOTB, to confirm roadmap" | Keep it as a roadmap theme for responsive layouts; no mobile application commitment |
| 10 | KPI targets marked Proposed | Confirm at the first quarterly business review |
