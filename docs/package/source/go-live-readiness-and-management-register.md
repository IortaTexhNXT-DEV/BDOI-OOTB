---
title: Go/No-Go Recommendation and Management Register
subtitle: iNXT BrokerVerse OOTB Release 1.0
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
open_item: Conditions C1 to C8 of the chapter Recommendation; decisions D1 to D14
open_item_status: Open
acronyms: OOTB=Out of the box; UAT=User acceptance test; AMC=Annual maintenance contract; SOW=Statement of work; MSA=Master services agreement; DPA=Data processing agreement; DPO=Data protection officer; NPC=National Privacy Commission; IC=Insurance Commission; SMTP=Simple Mail Transfer Protocol; CI=Continuous integration; RAID=Risks, assumptions, issues and dependencies; RTO=Recovery time objective; RPO=Recovery point objective
---

# Purpose and audience

This document gives management one place to decide whether iNXT BrokerVerse OOTB Release 1.0 is ready, and what has to happen before, during and after the first client go-live. It is written for the leadership of iorta TechNXT and is shared with the sales, delivery, development and support leads.

It brings together the evidence from the Test Summary Report, the documentation package and the commercial and contract packs, and records:

- the recommendation and its conditions;
- what has to be addressed before the first client goes live;
- what has to be planned for the next releases;
- the risks we foresee, with owner and mitigation;
- the decisions that only management or legal counsel can take.

# Recommendation

| Decision | Recommendation |
|---|---|
| Release 1.0 to market: demonstrations, proposals, pilots and contracts | **GO** |
| Production go-live at the first client | **GO, subject to conditions C1 to C8** |

The product is functionally complete for the broking cycle of a Philippine non-life broker and has passed its tests (chapter Evidence). No Critical or High defect is open. The conditions below are not product defects; they are operational, legal and environment items that must be closed before a client runs its business on the system.

| ID | Condition before the first production go-live | Owner |
|---|---|---|
| C1 | Restore the automated deployment to the EC2 environment (the pipeline cannot reach the server over SSH) or confirm the chosen production hosting with its own tested deployment | DevOps lead |
| C2 | Configure the client's mail server (SMTP) and run the three e-mail test cases that are blocked in the test environment (password reset code, customer approval link, outbox retry) | Delivery lead |
| C3 | Replace the OOTB company identity: the default company is iorta TechNXT Corp., which prints on documents and appears as data controller in the privacy export. The broker's legal name, TIN, licence number and address must be entered at configuration | Delivery lead |
| C4 | Commission an external penetration test and a load test at the expected volume of the first client, and close any High finding | CTO |
| C5 | Legal review and sign-off of the contract pack (decisions D1 to D7) | CEO with legal counsel |
| C6 | Complete the company facts marked [to confirm] in the security questionnaire and the continuity plan (registration, TIN, DPO, NPC registration, hosting partner, support team location) | Management |
| C7 | Run the restore test and the disaster recovery drill described in the Business Continuity and Disaster Recovery Plan on the production hosting | DevOps lead |
| C8 | Client UAT sign-off on the client's own configuration and migrated data, using the UAT and Go-Live Acceptance Certificates | Client and delivery lead |

# Evidence

| Area | Result on 03 October 2026 |
|---|---|
| Backend regression suite | 717 of 717 tests passed (72 test files) |
| Front-end tests | 53 of 53 passed; lint without errors; production build compiles |
| End-to-end business cycle | 371 of 371 steps passed on a fresh database: set-up, go-live migration, retail and corporate business, billing and collection, servicing, remittance, reconciliation, month-end close, reports and dashboards |
| Release test cases | 497 cases; see the Test Summary Report version 1.1 for the status after re-test |
| Screen stability, 173 screens | No screen with a layout shift above 0.05; no visible loading indicator; no console or API error; no horizontal scroll at 1440 and 1280 pixels |
| Role-based access | Every role opens only its permitted screens; refused calls return 401 or 403 |
| Security checks | No SQL built from user input; security headers present; sign-in lockout after 5 failed attempts; two-step verification; backend dependency audit with no vulnerability |
| API consistency | 868 backend routes; no screen calls a route that does not exist |
| Documentation | Full package rebuilt on the iorta template; pack index lists every document by audience |

# Changes since the release test

The release test was run earlier on 03 October 2026. These changes followed it and are covered by the regression results above:

- Data privacy: consent capture, data subject request register with due dates, personal data export and anonymisation (Master > Data Privacy and the client Data privacy tab).
- E-mail attachments: policy schedule, debit note, official receipt and invoice e-mails.
- Approval notifications to the approver and to the requester.
- One place for each setting: currency and exchange rates, premium taxes and commission taxes have a single source; DST follows NIRC section 184 (PHP 0.50 on each PHP 4.00 or fraction).
- Duplicated screens consolidated: remittance approvals follow the Authority Matrix (Accounting up to PHP 1,000,000.00, Accounting Manager without limit); remittance delegation sits only in User Management; remittance schedules run as a scheduled job; unused master screens retired.
- Screen stability: no flicker, server-side paging on the large lists, one icon colour scheme, Prospects as a table, descriptive text removed from working screens.
- Defects from the user manual walk-through fixed: petty cash user lists, premium taxes on migrated policies, policy and voucher detail screens, vehicle photos, money formatting, incentive period.

# To take note of

| ID | Item | Who needs to know |
|---|---|---|
| N1 | The remittance schedule job (Master > Schedules) is delivered switched off. Switch it on only after the client has defined its remittance schedules | Delivery, Support |
| N2 | Remittances above PHP 1,000,000.00 need an Accounting Manager. The limits are in the Authority Matrix and are set per client at configuration | Delivery, Sales (demos) |
| N3 | Retired masters (Commission, Employee, Petty Cash and seven remittance tabs) were made inactive, not deleted. Their records remain readable | Support |
| N4 | Designations for the standard roles are now part of the reference data. A user's designation must exist in the Designation master | Delivery, Support |
| N5 | The October incentive batch in the demonstration data was calculated before the incentive period fix and still shows the earlier figure. Recalculate it before using it in a demonstration | Sales, Support |
| N6 | Older coverage endorsements in demonstration data store the previous VAT, DST and LGT as zero. New endorsements are correct | Support |
| N7 | The Railway test site deploys the brokerverse-platform branch automatically; it is a test site and must not hold client data | All |
| N8 | Pull request 2 (brokerverse-platform) carries all of Release 1.0. Its "Deploy API to EC2" check fails for the reason in C1; the build and test checks pass | Development, DevOps |
| N9 | The two INTERNAL documents with prices and negotiation limits (Negotiation Playbook, Price Book) and the Battlecard must not be sent to prospects | Sales |

# To address before the first go-live

Besides conditions C1 to C8:

| ID | Item | Owner | Target |
|---|---|---|---|
| A1 | Fill the [to confirm] facts: 33 in the continuity plan, 28 in the security questionnaire, 4 in the release notes, 5 in the sales FAQ, 3 in the battlecard | Management, CTO | Before the first proposal that includes these documents |
| A2 | Verify the market figures used in the commercials (competitor price ranges, broker rankings) before quoting them to a prospect | Sales head | Before the first proposal |
| A3 | Add the sales contact e-mail and telephone to the one-page brochure and the brochure back cover | Marketing | Before distribution |
| A4 | Decide on the October incentive recalculation in the demonstration data (N5) | Sales head | Before the next demonstration |
| A5 | Re-test the three e-mail cases once SMTP is available (C2) and record the result in the test workbook | QA | During the first client's UAT |

# To plan

| ID | Item | Release |
|---|---|---|
| P1 | Upgrade react-router to the major version that removes the moderate open-redirect advisory (BV-DEF-001), with a navigation regression test | Next minor release |
| P2 | Field-level encryption of personal identifiers (TIN, ID numbers, contact details) (BV-DEF-003) | Next minor release |
| P3 | Server-side totals for the Payments summary cards and server paging for Expired and Expiring Policies | Next minor release |
| P4 | Breadcrumbs and older custom-styled action buttons on the remaining master screens | Next minor release |
| P5 | ISO 27001 readiness and an information security policy set for iorta TechNXT, needed for broker and auditor questionnaires | Within 12 months |
| P6 | Product manager role and product council, versioning scheme and release calendar (OOTB Strategy and Playbook) | Next quarter |
| P7 | Responsive layout for tablets; no mobile application commitment | Roadmap, indicative |
| P8 | Reference client programme: first pilot, case study and reference call script | After the first go-live |

# Risks foreseen

Likelihood and impact are rated Low, Medium or High.

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | First production deployment slips because the EC2 pipeline is unreachable | High | Medium | Fix the network rule or key used by the pipeline; keep a documented manual deployment as fallback | DevOps lead |
| R2 | A client finds a security issue in its own penetration test before ours | Medium | High | External penetration test before the first go-live (C4); fix High findings first | CTO |
| R3 | Performance at a large broker's volume is not proven | Medium | High | Load test at the client's expected volume (C4); server paging is in place on the large lists | CTO |
| R4 | Documents and the privacy export show iorta TechNXT as the company if configuration is incomplete | Medium | High | Configuration checklist item and UAT test on printed documents (C3) | Delivery lead |
| R5 | Contract terms not reviewed by counsel lead to a dispute on liability, termination fees or escrow | Medium | High | Legal review before signature (C5, D1 to D7) | CEO |
| R6 | Data migration quality at the client delays go-live | Medium | Medium | Mock loads, reconciliation of counts and totals and sign-off by Accounting, as in the Data Migration and Cutover Plan | Delivery lead |
| R7 | Key person dependency in development and support | Medium | High | Production support handbook, technical reference, escrow, named back-ups in the continuity plan | CTO |
| R8 | Regulatory change (IC circulars, BIR forms, tax rates) between releases | Medium | Medium | Rates and forms are configuration; regulatory watch owned by the product manager | Product manager |
| R9 | Unverified market figures in sales material damage credibility | Medium | Medium | Verify before use (A2); battlecard tells sales not to quote them | Sales head |
| R10 | Questionnaire answers with [to confirm] stall a procurement process | High | Medium | Close A1 and C6 before the first formal proposal | Management |
| R11 | Scope growth during implementation through change requests | Medium | Medium | Fit-gap register, change request procedure and steering committee approval | Delivery lead |
| R12 | Hosting cost or partner terms change after signature | Low | Medium | Hosting fees follow the pass-through clause of the Hosting Agreement | Finance |

# Decisions needed

| ID | Decision | Recommendation | Owner |
|---|---|---|---|
| D1 | Which schedule prevails when two schedules of the contract conflict | The schedule that deals specifically with the subject | Legal counsel |
| D2 | Whether the MSA confidentiality clause replaces the Mutual NDA or both apply | MSA replaces the NDA from signature; the NDA covers the pre-contract period | Legal counsel |
| D3 | Escrow agent and its standard terms; the placeholder periods in the escrow draft | Choose the agent before the first perpetual licence | CEO |
| D4 | Early termination fee: all or 50% of the remaining recurring fees | Decide before the first contract | CEO |
| D5 | Late payment interest and who pays the documentary stamp tax on the contract | Decide before the first contract | CFO |
| D6 | Client delay: licence fee due after 60 days of go-live delay, SOW milestones after 30 days | Align both to 60 days | CEO |
| D7 | Restrictions clause: copy it into the Subscription Agreement instead of referring to the perpetual licence | Copy it in | Legal counsel |
| D8 | Discount limits of 5%, 10% and 15% and the price floor | Confirm | CEO |
| D9 | AMC calculated on the net licence fee | Confirm, as the contracts state | CEO |
| D10 | Versioning scheme and release cadence proposed in the OOTB Strategy and Playbook | Approve | CTO |
| D11 | Product manager role and product council | Approve | CEO |
| D12 | Recalculate the October incentive batch in the demonstration data | Recalculate | Sales head |
| D13 | Brochure back cover tagline: the template now reads "Insurance technology for the Philippines" | Confirm | Marketing |
| D14 | Public site and contact details printed on sales material (www.iortatechnxt.com, sales e-mail, telephone) | Confirm and provide | Marketing |

# Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Chief Executive Officer | | | |
| Chief Technology Officer | | | |
| Head of Sales | | | |
| Delivery Lead | | | |
| Support Lead | | | |
