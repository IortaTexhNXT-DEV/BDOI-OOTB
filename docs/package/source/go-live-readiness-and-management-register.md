---
title: Go/No-Go Recommendation and Management Register
subtitle: iNXT BrokerVerse OOTB Release 1.0
version: 1.1.2
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Version 1.1.2: Client brand packs: basis is the client's contract with iorta TechNXT (management decision of 04 October 2026). Version 1.1.1: release figures aligned with the release verification of 04 October 2026 (Test Summary Report 1.3); C9 and P2 record the merge of the IC and NPC compliance package. Version 1.1: conditions, notes, plans, risks and decisions for the modules merged since the release test (AML/CFT, BIR, IC and NPC registers, integrations, branding, distribution, operations and accounting, go-live tools and release pipeline)
open_item: Conditions C1 to C14 of the chapter Recommendation; decisions D1 to D20
open_item_status: Open
acronyms: OOTB=Out of the box; Dev=Development environment; Pre-Prod=Pre-production environment; SIT=System integration test; UAT=User acceptance test; AMC=Annual maintenance contract; SOW=Statement of work; MSA=Master services agreement; DPA=Data processing agreement; DPO=Data protection officer; NPC=National Privacy Commission; IC=Insurance Commission; SMTP=Simple Mail Transfer Protocol; CI=Continuous integration; RAID=Risks, assumptions, issues and dependencies; RTO=Recovery time objective; RPO=Recovery point objective; AML/CFT=Anti-money laundering and countering the financing of terrorism; AMLC=Anti-Money Laundering Council; BIR=Bureau of Internal Revenue; CAS=Computerized Accounting System; CTPL=Compulsory Third Party Liability; EIS=Electronic Invoicing System; EOPT=Ease of Paying Taxes; PEP=Politically exposed person
---

# Purpose and audience

This document gives management one place to decide whether iNXT BrokerVerse OOTB Release 1.0 is ready, and what has to happen before, during and after the first client go-live. It is written for the leadership of iorta TechNXT and is shared with the sales, delivery, development and support leads.

It brings together the evidence from the Test Summary Report, the documentation package and the commercial and contract packs, and records:

- the recommendation and its conditions;
- what has to be addressed before the first client goes live;
- what has to be planned for the next releases;
- the risks we foresee, with owner and mitigation;
- the decisions that only management or legal counsel can take.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 03 October 2026 | Recommendation for Release 1.0 after the release test |
| 1.1 | 04 October 2026 | Conditions C9 to C14, notes N12 to N20, actions A6 to A11, plans P13 to P20, risks R13 to R20 and decisions D15 to D20 for the modules merged since the release test; C1 restated for the release pipeline; P2 and P9 to P12 moved to the chapter Delivered since the release test |
| 1.1.1 | 04 October 2026 | Release figures aligned with the release verification on the merged release (Test Summary Report 1.3): Evidence chapter, condition C9 and item P2 record the merge of the IC and NPC compliance package and the green regression run |
| 1.1.2 | 04 October 2026 | Client brand packs: basis is the client's contract with iorta TechNXT (management decision of 04 October 2026) |

# Recommendation

| Decision | Recommendation |
|---|---|
| Release 1.0 to market: demonstrations, proposals, pilots and contracts | **GO** |
| Production go-live at the first client | **GO, subject to conditions C1 to C14** |

The product is functionally complete for the broking cycle of a Philippine non-life broker and has passed its tests (chapter Evidence). No Critical or High defect is open. The conditions below are not product defects; they are operational, legal, regulatory and environment items that must be closed before a client runs its business on the system. Conditions C9 to C14 cover the modules merged since the release test.

| ID | Condition before the first production go-live | Owner |
|---|---|---|
| C1 | Set up the GitHub Environments of the release pipeline (reviewers, tag rules, variables, environment secrets) and make each server reachable from the pipeline (the dev deployment to the EC2 host timed out over SSH); or confirm the chosen production hosting with its own tested deployment | DevOps lead |
| C2 | Configure the client's mail server (SMTP) and run the three e-mail test cases that are blocked in the test environment (password reset code, customer approval link, outbox retry) | Delivery lead |
| C3 | Replace the OOTB company identity: the default company is iorta TechNXT Corp., which prints on documents and appears as data controller in the privacy export. The broker's legal name, TIN, licence number and address must be entered at configuration | Delivery lead |
| C4 | Commission an external penetration test and a load test at the expected volume of the first client, and close any High finding | CTO |
| C5 | Legal review and sign-off of the contract pack (decisions D1 to D7) | CEO with legal counsel |
| C6 | Complete the company facts marked [to confirm] in the security questionnaire and the continuity plan (registration, TIN, DPO, NPC registration, hosting partner, support team location) | Management |
| C7 | Run the restore test and the disaster recovery drill described in the Business Continuity and Disaster Recovery Plan on the production hosting | DevOps lead |
| C8 | Client UAT sign-off on the client's own configuration and migrated data, using the UAT and Go-Live Acceptance Certificates | Client and delivery lead |
| C9 | The release taken to the first client includes the IC and NPC compliance package (licence register, fit and proper, insurer authority, complaints, breach register, masking by role, field encryption), merged on 04 October 2026 with a green regression run (1,113 of 1,113 backend tests); `PII_ENCRYPTION_KEY` is set in every environment and its custody record signed with the client before Production is provisioned | CTO; DevOps lead |
| C10 | The client's compliance officer confirms the delivered AML/CFT values against the AMLC's current issuances, loads the screening lists (no list content is delivered) and validates a CTR test file in the AMLC portal; the BV-AMLC-TXN 1.0 layout is checked against the AMLC's current reporting format; complaints deadlines and fit and proper declarations are confirmed against the IC rules in force | Client compliance officer; delivery lead |
| C11 | The client's tax adviser confirms the tax codes, ATC, EOPT invoice and receipt wording and the ATP or CAS details; the DAT files of the first filing are validated with the current BIR validation module; the EIS connector stays off until the client's enrolment | Client Accounting Manager and tax adviser |
| C12 | Each connector used live at go-live is certified by its partner (bank payment file layouts, which are delivered as examples; CTPL authentication provider; insurer APIs; SMS provider), or its fallback is recorded in the go/no-go minutes | Delivery lead; client IT head |
| C13 | A client brand pack (the Toyota Insurance Services pack) carries the marks of a client of iorta TechNXT and is applied only in that client's environments, under the client's contract with iorta TechNXT, which covers the use of its marks there; it is not used in demonstrations to other prospects | Delivery lead; Sales head |
| C14 | `npm run mask:data -- --register-production` is run once in the client's Production at go-live; every copy of production data used outside production is masked first and approved by the client's DPO | DevOps lead; client DPO |

# Evidence

The figures below are those of the release verification of 04 October 2026 on the merged release (Test Summary Report 1.3, chapter Release verification on the merged release); the screen stability, access, security, API consistency and documentation checks are those of the release test of 03 October 2026.

| Area | Result |
|---|---|
| Backend regression suite | 1,113 of 1,113 tests passed (104 test files, 04 October 2026, merged release); lint clean |
| Front-end tests | 175 of 175 passed (33 suites); lint without errors; production build compiles |
| End-to-end business cycle | 433 of 433 steps passed (12 phases, 2,168 API calls) on a fresh database of the final code: set-up, go-live migration, customer due diligence, retail and corporate business, billing and collection, servicing, remittance, reconciliation, month-end close, reports and dashboards |
| Go-live rehearsal, masking and comparison | 52 of 52 rehearsal checks passed between two environments; data masking of a copy verified clean; environment comparison identical apart from environment-specific values |
| Release test cases | 629 cases (617 passed, 1 failed, 3 blocked, 8 not run); the defects found in the release verification (BV-DEF-009 to BV-DEF-014) are fixed and closed; see the Test Summary Report version 1.3 |
| Screen stability, 173 screens (03 October 2026) | No screen with a layout shift above 0.05; no visible loading indicator; no console or API error; no horizontal scroll at 1440 and 1280 pixels |
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

Merged on 04 October 2026, after the release test:

- Philippine masters from the PSGC (regions, provinces, cities and municipalities, barangays), ZIP codes, banks, ID types, salutations, holidays and the IC insurer list.
- Side menu in sections, skeleton loading, Help panel (F1); My Work (My Items, My Team, My Tasks, Calendar).
- Product Configurator connected to the quotation flow: acceptance rules with refer, decline and loading and the authority to override, rating factors, document templates with merge fields, market mapping, governing template.
- Audit Trail screen; go-live data workbench (configuration and migration kits, errors workbook, reconciliation); environment comparison report; transaction reset; data masking tool; release pipeline (ci, deploy, rollback) for Dev, SIT, UAT, Pre-Prod and Production.
- AML/CFT: client onboarding before the first policy, juridical clients, signatories and beneficial owners, risk rating and EDD, screening lists and hits, covered and suspicious transaction alerts, cases and AMLC report files; Compliance Officer role.
- BIR: 0619-E, 1601-EQ, 1604-E, 2551Q, DAT files, EOPT sales invoices, CAS books pack, EIS connector; insurer overriding and contingent commission.
- Operations and accounting: cover notes, computed cancellations, post-dated cheques, instalment invoices, claim document checklist, claims settlements in Accounting, motor repairs and letters of authority, accounts payable, fixed assets and depreciation.
- Distribution: lead assignment, distribution channels, dealer programmes, fleet schedules, marine open covers, facultative reinsurance, comparison reports, campaigns, Report Builder and BI extract.
- Integration framework: bank payment files, SMS and Viber, CTPL authentication and COC series, insurer API connectors.
- Branding: Theme and Branding, brand packs, branded documents, reports and e-mails, e-signatures mapped to documents.
- Being merged: IC and NPC compliance (licence register and payout block, fit and proper, insurer authority, IC annual statement and production report, complaints register, breach register, masking by role, field encryption). In progress: sales activity log, quotation covers and risk fields from the Product Configurator, supplier Form 2307, fixed asset disposal.

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
| N10 | Environment model decided by the product owner (04 October 2026): small and medium brokers have Dev, UAT and Production, with integration in Dev; large brokers have Dev, SIT, UAT and Production, with SIT and UAT separate; Pre-Prod is temporary for every size, created from a production backup for the go-live rehearsal and each major release, then removed | Sales, Delivery, DevOps, Support |
| N11 | Hosting is priced per environment set, with Pre-Prod per month of use (Rate Card, pricing workbook, Hosting Agreement Annex A). On AWS the standing set is PHP 43,000.00 (Small), 69,000.00 (Medium), 143,000.00 (Large) and 256,000.00 (Enterprise) a month; hosting fees do not increase yearly | Sales, Finance |
| N12 | Every connector is delivered in test mode (SMS, CTPL authentication, insurer API) or off (Viber, LTO feed, EIS); the bank file layouts are starter layouts to validate with each bank. Nothing leaves the system until a connector is switched to live with its credentials in the secret store | Delivery, Support, Sales (demos) |
| N13 | Compliance checks are delivered as: referrer licence check **block**, insurer authority check **warn**, AML screening blocks issue, refunds and claim payments on an open hit, EDD required before issue to a High-risk client. Switch the insurer authority check to block only once the certificates are entered | Delivery, Support |
| N14 | No screening list content is delivered; the client loads the lists it is entitled to use (UN and AMLC public lists; a PEP list under licence) | Delivery, Sales |
| N15 | Implementation plans now cover four sizes: Small 8 weeks, Medium 12, Large 20 (16-week variant), Enterprise 26; the critical path runs through the client data for the configuration kit, configuration, SIT, UAT and the rehearsal (Dependency Map and Critical Path) | Sales, Delivery |
| N16 | The Toyota Insurance Services brand pack is a client pack: not the default, not in the generic seed, applied only in that client's environments under its contract with iorta TechNXT (C13) | Sales, Delivery |
| N17 | The masking tool refuses to run on the registered production database and on a database with the go-live lock unless `--remark-copy` re-marks a copy after its own checks; run `--register-production` once at each go-live (C14) | DevOps, Support |
| N18 | `PII_ENCRYPTION_KEY` is a third application secret, different from `JWT_SECRET` and `DATA_ENCRYPTION_KEY`; a backup cannot be read without the key it was written with. Rotation keeps the previous key until the dry run reports nothing left (`deploy/REFERENCE.md`) | DevOps, Support |
| N19 | There is no role deck for the Compliance Officer yet; training uses the user manual chapters (Training Plan 1.1) | Delivery |
| N20 | The AMLC report file layout BV-AMLC-TXN 1.0 is a BrokerVerse layout; it is checked against the AMLC's current format with each client (C10) | Delivery, Product manager |

# To address before the first go-live

Besides conditions C1 to C14:

| ID | Item | Owner | Target |
|---|---|---|---|
| A1 | Fill the [to confirm] facts: 33 in the continuity plan, 28 in the security questionnaire, 4 in the release notes, 5 in the sales FAQ, 3 in the battlecard | Management, CTO | Before the first proposal that includes these documents |
| A2 | Verify the market figures used in the commercials (competitor price ranges, broker rankings) before quoting them to a prospect | Sales head | Before the first proposal |
| A3 | Add the sales contact e-mail and telephone to the one-page brochure and the brochure back cover | Marketing | Before distribution |
| A4 | Decide on the October incentive recalculation in the demonstration data (N5) | Sales head | Before the next demonstration |
| A5 | Re-test the three e-mail cases once SMTP is available (C2) and record the result in the test workbook | QA | During the first client's UAT |
| A6 | Agree with the first client which registrations it holds (ATP or CAS, AMLC, NPC, IC licences) and record the others as dependencies with dates | Delivery lead | Mobilisation |
| A7 | Obtain bank file specifications from the first client's banks and validate the starter layouts | Delivery lead | Integrations phase |
| A8 | Add UAT scripts for the merged modules (onboarding and screening, AML alerts and CTR file, licence and authority checks, complaints, breach register, BIR returns and sales invoices, bank payment files, CTPL authentication, branded documents) to `UAT_SCRIPTS.md` | QA; delivery lead | Before the first client's UAT |
| A9 | Prepare the key custody record template and the procedure for the escrow copy of production keys | DevOps lead | Before the first Production |
| A10 | Prepare the go/no-go checklist items for registrations, partner certifications and their fallbacks (Dependency Map and Critical Path) | Delivery lead | Before the first go/no-go |
| A11 | Rebuild the training environment with masked or sample data only, with the connectors in test mode | DevOps lead | Before the first training wave |

# To plan

| ID | Item | Release |
|---|---|---|
| P1 | Upgrade react-router to the major version that removes the moderate open-redirect advisory (BV-DEF-001), with a navigation regression test | Next minor release |
| P3 | Server-side totals for the Payments summary cards and server paging for Expired and Expiring Policies | Next minor release |
| P4 | Breadcrumbs and older custom-styled action buttons on the remaining master screens | Next minor release |
| P5 | ISO 27001 readiness and an information security policy set for iorta TechNXT, needed for broker and auditor questionnaires | Within 12 months |
| P6 | Product manager role and product council, versioning scheme and release calendar (OOTB Strategy and Playbook) | Next quarter |
| P7 | Responsive layout for tablets; no mobile application commitment | Roadmap, indicative |
| P8 | Reference client programme: first pilot, case study and reference call script | After the first go-live |
| P13 | Complete the in-progress package: sales activity log, quotation covers and risk fields from the Product Configurator, supplier Form 2307, fixed asset disposal | Next minor release |
| P14 | Role deck for the Compliance Officer (AML/CFT) | With P13 |
| P15 | Certified bank file layouts kept as a library once validated with banks at client sites | Ongoing |
| P16 | AMLC report file in the AMLC's current electronic format, once confirmed with the first clients (N20) | After the first client's AMLC validation |
| P17 | IC annual statement form set confirmed for the reporting year (`compliance.ic_statement_form`) | Before the first annual statement |
| P18 | EIS connector certification with the BIR when the first client enrols | When enrolled |
| P19 | PEP list provider options to offer to clients (commercial screening provider through the provider API) | Next quarter |
| P20 | Rehearsal of a key rotation and a masked refresh in a non-production environment, recorded as evidence for questionnaires | Before the first go-live |

## Delivered since the release test

| Former ID | Item | Status on 04 October 2026 |
|---|---|---|
| P2 | Field-level encryption of personal identifiers (TIN, ID numbers, bank account numbers) (BV-DEF-003) | Delivered with the IC and NPC compliance package, merged on 04 October 2026 (`PII_ENCRYPTION_KEY`, condition C9) |
| P9 | Data masking tool for production copies | Delivered: `npm run mask:data`, with `--remark-copy` and `--register-production` |
| P10 | Release pipeline with tests before any deployment and an approval gate per environment | Delivered: `ci.yml`, `deploy.yml`, `rollback.yml`; GitHub settings to complete (C1) |
| P11 | Comparison report between two environments | Delivered: `compare-environments.js` and Compare environments on the go-live data workbench |
| P12 | One front-end build promoted through all environments, with runtime configuration | Delivered: `/env-config.js` per environment |

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
| R13 | A partner (bank, CTPL authentication provider, insurer) certifies its interface after go-live | High | Medium | Connectors in test mode from configuration; fallbacks recorded at go/no-go (C12) | Delivery lead |
| R14 | A regulatory registration of the client (ATP or CAS, AMLC, NPC) is late and moves the go-live | Medium | High | Confirmed or started on the kick-off day; tracked as dependencies with their float | Delivery lead |
| R15 | Screening incomplete at go-live because list licences are missing | Medium | High | UN and AMLC lists first; PEP licence started after the compliance workshop (C10) | Client compliance officer |
| R16 | Loss of an encryption key makes backups unreadable | Low | High | Custody record, escrow copy under dual control, rotation procedure (C9) | DevOps lead |
| R17 | Personal data exposed in a non-production copy | Low | High | Masking before use, DPO approval, Pre-Prod removed after hypercare (C14) | DevOps lead |
| R18 | Client marks used outside the client's engagement | Low | High | Client brand pack applied only in that client's environments under its contract with iorta TechNXT (C13) | Sales head |
| R19 | BIR or AMLC formats change or differ from the delivered layouts | Medium | Medium | Validation with the current BIR module and the AMLC portal at each client; formats are configuration or a minor release (C10, C11) | Product manager |
| R20 | Small-broker plans have little float: an input late by a week moves the go-live | High | Medium | Kits at kick-off; weekly dependency review; escalation after 3 days (Dependency Map) | Delivery lead |

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
| D15 | Custody model of the production encryption keys (escrow copy under dual control with the client, or held by the hosting partner) | Dual control with the client, stated in the SOW | CTO with legal counsel |
| D16 | Whether connector switch-on after go-live (partner certified late) is included without a change request | Included when the effort stays within the delivered connector (SOW, Special conditions) | Head of delivery |
| D17 | Whether to resell or recommend a PEP list provider | Recommend, do not resell, until P19 | CEO |
| D18 | Default of the insurer authority check at go-live (warn or block) | Warn, block once every certificate is entered | Head of delivery |
| D19 | Enterprise plan length: 26 weeks as the reference in proposals | Confirm | Head of delivery |
| D20 | Basis for client brand packs carrying a client's marks | The client's contract with iorta TechNXT covers the use of its marks in the environments of the engagement; the contract reference is in the pack manifest and on the engagement file (C13) | Legal counsel |

# Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Chief Executive Officer | | | |
| Chief Technology Officer | | | |
| Head of Sales | | | |
| Delivery Lead | | | |
| Support Lead | | | |
