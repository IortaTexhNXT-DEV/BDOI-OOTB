# iNXT BrokerVerse OOTB documentation pack

## How to use this index

The BrokerVerse OOTB documentation pack holds every document iorta TechNXT uses to sell, contract, implement, run and support iNXT BrokerVerse OOTB for a Philippine non-life broker. This index lists each document for each department that uses it, with what it is for, then each file by folder and by stage of the customer lifecycle.

- **Client-facing** files may be given to the broker, normally from the stage shown.
- **INTERNAL** files are for iorta TechNXT staff only. They hold pricing logic, discount limits, competitor positioning, internal strategy or a third party's marks and are never sent to a broker or attached to a proposal. Their file names end in `_INTERNAL` where the document is a sales tool.
- Departments: Users (the broker's users and key users, and the System Administrator, using the application day to day); Developers (product engineering and the developers who review, extend or deploy the code); Business analysts (business analysts and solution consultants who run discovery, fit-gap and configuration); QA (quality analysts and test leads who plan, run and report the tests); Delivery and PM (the delivery head, project managers and implementation consultants); Sales (account managers and presales); Support (l2 application support, L3 engineering on call and DevOps); Management (iorta TechNXT management, and the broker's management for client-facing files).
- Lifecycle stages: Pre-sales, Contracting, Implementation, Go-live, Support.

The files are kept in `docs/package`, one folder per purpose in the order of the customer lifecycle, and each file is kept once, in its latest version: a superseded document is removed with its source. `source/` holds the text sources and `tools/` the builders.

| Folder | What it holds | Count |
|---|---|---|
| `01_Sales/` | Material for prospects and the sales team: brochures, presentation, functionality, demo, FAQ, e-mails, ROI calculator and the competitive battlecard. | 10 |
| `02_Commercials/` | Prices and the commercial proposal: the rate card given to the broker, and the internal pricing model, price book, proposal note and negotiation playbook. | 5 |
| `03_Contracts/` | The contract pack, from the NDA to the hypercare exit certificate, including the SOW and the UAT and go-live acceptance certificates. | 18 |
| `04_Onboarding_and_Go_Live/` | What the broker completes or reviews to onboard and go live: security due diligence, discovery and configuration, privacy impact assessment, data migration and cutover, environments and rollout. Brand packs are kept in the sub-folder `Brand_Packs/`. | 6 |
| `05_Delivery/` | The implementation project: BRD, process flows, approach and plan, dependency map, project control templates, training, user manual, reports, communications, schedules, test strategy, plan, cases, traceability and results, and the regulatory compliance matrix. The standard upload templates are kept in the sub-folder `Upload_Templates/`. | 21 |
| `06_Support/` | Production support and its operational procedures, business continuity and disaster recovery, and releases. | 4 |
| `07_Technical/` | Architecture, infrastructure, security and privacy, technical reference, API catalogue and data dictionary. | 4 |
| `08_Management/` | Release recommendation and management register, OOTB strategy, Philippine fit and ASEAN rollout assessment, and this index. | 4 |

## Index by department

Each department starts with the documents below. A document used by several departments is listed under each of them. The guides kept with the code are listed where a department uses them.

### Users

The broker's users and key users, and the System Administrator, using the application day to day.

| Document | Folder | What it is for |
|---|---|---|
| Process Flow Document | `05_Delivery` | End-to-end process flows of the broker with the screens, roles and postings of each step (PFD) |
| Training Plan | `05_Delivery` | Training and change management by role |
| User Manual | `05_Delivery` | User manual by role, also opened per screen from the Help panel (F1) |
| Reports Book | `05_Delivery` | Every report, dashboard and export with its columns and rules |
| Communication Templates and Touchpoints | `05_Delivery` | Every e-mail, SMS, notification and printed document the system sends |
| Schedules and Batch Jobs | `05_Delivery` | Every scheduled job and batch process, the operational run book and the support runbook per job |
| OOTB Documentation Pack Index | `08_Management` | This index |
| Upload Templates | `05_Delivery` | Standard upload templates for the go-live data, one per master or opening balance, and the go-live configuration and migration workbooks |
| `docs/onboarding/GETTING_STARTED.md` | Code repository | First sign-in, menus per role, My Work, the Help panel |
| `docs/onboarding/SUPPORT_AND_ESCALATION.md` | Code repository | How to report an issue, severities, support procedures by area |
| `docs/onboarding/UAT_SCRIPTS.md` | Code repository | UAT scenarios per role for the first week |
| `docs/onboarding/GO_LIVE_DATA_SETUP.md` | Code repository | Order of set-up from company to opening balances |
| `docs/onboarding/BRANDING_AND_SIGNATURES.md` | Code repository | Theme, brand packs, e-signatures and their support procedures |

### Developers

Product engineering and the developers who review, extend or deploy the code.

| Document | Folder | What it is for |
|---|---|---|
| Environment Strategy and Production Rollout | `04_Onboarding_and_Go_Live` | Environments, promotion of code, scripts and configuration, release pipeline, cutover runbook and RACI |
| Business Requirements Document | `05_Delivery` | Business requirements of the OOTB product by module, with business rules and regulatory references (BRD) |
| Test Strategy | `05_Delivery` | How the product and each implementation are tested: levels, types, environments, test data and masking, entry and exit criteria, defects, CI gates |
| Test Cases | `05_Delivery` | Release test cases with regulatory references, the requirements traceability matrix (sheet Requirements Traceability: the 150 processes to test cases and automated tests), defects |
| Test Summary Report | `05_Delivery` | Results of the release test |
| Release Notes Template | `06_Support` | Release notes for each patch, minor or major release, with jobs, connectors and keys |
| Architecture Infrastructure Security and Privacy | `07_Technical` | Architecture, hosting options, security controls and data privacy |
| Technical Reference | `07_Technical` | Code base, modules, security implementation and how to extend |
| API and Dependency Catalogue | `07_Technical` | Every API route with its permission and the screens that call it |
| Data Dictionary | `07_Technical` | Tables, columns, relationships, personal data and retention |
| Go No Go and Management Register (INTERNAL) | `08_Management` | Release recommendation, go-live conditions, risks, plans and decisions needed |
| OOTB Strategy and Playbook INTERNAL (INTERNAL) | `08_Management` | How iorta TechNXT sells, delivers, supports and evolves the OOTB product |
| PH Fit and ASEAN Rollout Assessment (INTERNAL) | `08_Management` | Philippine process fit by area with evidence, gaps ranked, and the change needed for each ASEAN country |
| OOTB Documentation Pack Index | `08_Management` | This index |
| `docs/developer-guide/README.md` | Code repository | Developer and production support guide: back end, front end, tracing a defect |
| `deploy/README.md, deploy/REFERENCE.md` | Code repository | Installation, environment variables and keys, release pipeline, rollback |
| `backend/docs/api` | Code repository | OpenAPI file, Postman collection and API touchpoint workbook |

### Business analysts

Business analysts and solution consultants who run discovery, fit-gap and configuration.

| Document | Folder | What it is for |
|---|---|---|
| Product Functionality | `01_Sales` | What the product does, module by module, with the vendor comparison checklist |
| Implementation Statement of Work | `03_Contracts` | Implementation scope, milestones, acceptance and governance (SOW) |
| Change Request Procedure and Form | `03_Contracts` | Change request procedure and form |
| Discovery Workbook Guide | `04_Onboarding_and_Go_Live` | How to run the discovery and configuration workshops |
| Discovery and Configuration Workbook | `04_Onboarding_and_Go_Live` | Configuration decisions captured in discovery |
| Data Migration and Cutover Plan | `04_Onboarding_and_Go_Live` | Go-live data, workbench, mock loads, reconciliation and cutover |
| Privacy Impact Assessment and Records of Processing Templates | `04_Onboarding_and_Go_Live` | PIA and records of processing pre-filled for the broker DPO |
| Business Requirements Document | `05_Delivery` | Business requirements of the OOTB product by module, with business rules and regulatory references (BRD) |
| Process Flow Document | `05_Delivery` | End-to-end process flows of the broker with the screens, roles and postings of each step (PFD) |
| Fit Gap Register | `05_Delivery` | Register of requirements classed Fit, Configure, Procedure or Gap, with the product gaps closed in this release |
| User Manual | `05_Delivery` | User manual by role, also opened per screen from the Help panel (F1) |
| Reports Book | `05_Delivery` | Every report, dashboard and export with its columns and rules |
| Communication Templates and Touchpoints | `05_Delivery` | Every e-mail, SMS, notification and printed document the system sends |
| Communication Touchpoints | `05_Delivery` | Companion workbook of the communication templates |
| Philippine Regulatory Compliance Matrix | `05_Delivery` | How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations |
| Data Dictionary | `07_Technical` | Tables, columns, relationships, personal data and retention |
| OOTB Documentation Pack Index | `08_Management` | This index |
| Upload Templates | `05_Delivery` | Standard upload templates for the go-live data, one per master or opening balance, and the go-live configuration and migration workbooks |
| `docs/onboarding/GO_LIVE_DATA_SETUP.md` | Code repository | Order of set-up from company to opening balances |
| `docs/onboarding/GO_LIVE_DATA_WORKBENCH.md` | Code repository | Configuration and migration workbooks, validation, load, reconciliation, environment comparison |

### QA

Quality analysts and test leads who plan, run and report the tests.

| Document | Folder | What it is for |
|---|---|---|
| UAT and Go Live Acceptance Certificates | `03_Contracts` | UAT and go-live acceptance certificates |
| Data Migration and Cutover Plan | `04_Onboarding_and_Go_Live` | Go-live data, workbench, mock loads, reconciliation and cutover |
| Business Requirements Document | `05_Delivery` | Business requirements of the OOTB product by module, with business rules and regulatory references (BRD) |
| Process Flow Document | `05_Delivery` | End-to-end process flows of the broker with the screens, roles and postings of each step (PFD) |
| User Manual | `05_Delivery` | User manual by role, also opened per screen from the Help panel (F1) |
| Test Strategy | `05_Delivery` | How the product and each implementation are tested: levels, types, environments, test data and masking, entry and exit criteria, defects, CI gates |
| Test Plan | `05_Delivery` | Test plan of a broker implementation: scope per module, schedule by size, cycles from SIT to hypercare, resourcing, sign-off |
| Test Cases | `05_Delivery` | Release test cases with regulatory references, the requirements traceability matrix (sheet Requirements Traceability: the 150 processes to test cases and automated tests), defects |
| Test Summary Report | `05_Delivery` | Results of the release test |
| Philippine Regulatory Compliance Matrix | `05_Delivery` | How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations |
| API and Dependency Catalogue | `07_Technical` | Every API route with its permission and the screens that call it |
| OOTB Documentation Pack Index | `08_Management` | This index |
| `docs/onboarding/UAT_SCRIPTS.md` | Code repository | UAT scenarios per role for the first week |
| `docs/onboarding/SMOKE_TEST_AND_RESET.md` | Code repository | Smoke test, transaction reset and the go-live lock |
| `docs/onboarding/DATA_MASKING.md` | Code repository | Masking of production copies for test and training |
| `backend/docs/api` | Code repository | OpenAPI file, Postman collection and API touchpoint workbook |

### Delivery and PM

The delivery head, project managers and implementation consultants.

| Document | Folder | What it is for |
|---|---|---|
| Implementation Statement of Work | `03_Contracts` | Implementation scope, milestones, acceptance and governance (SOW) |
| Customer Responsibilities and RACI Annex | `03_Contracts` | What the broker provides and who does what |
| Change Request Procedure and Form | `03_Contracts` | Change request procedure and form |
| UAT and Go Live Acceptance Certificates | `03_Contracts` | UAT and go-live acceptance certificates |
| Hypercare Exit and Handover Certificate | `03_Contracts` | Hypercare exit and handover to support |
| Security Due Diligence Questionnaire | `04_Onboarding_and_Go_Live` | Pre-answered security and outsourcing due diligence questionnaire |
| Discovery Workbook Guide | `04_Onboarding_and_Go_Live` | How to run the discovery and configuration workshops |
| Discovery and Configuration Workbook | `04_Onboarding_and_Go_Live` | Configuration decisions captured in discovery |
| Data Migration and Cutover Plan | `04_Onboarding_and_Go_Live` | Go-live data, workbench, mock loads, reconciliation and cutover |
| Environment Strategy and Production Rollout | `04_Onboarding_and_Go_Live` | Environments, promotion of code, scripts and configuration, release pipeline, cutover runbook and RACI |
| Privacy Impact Assessment and Records of Processing Templates | `04_Onboarding_and_Go_Live` | PIA and records of processing pre-filled for the broker DPO |
| Business Requirements Document | `05_Delivery` | Business requirements of the OOTB product by module, with business rules and regulatory references (BRD) |
| Process Flow Document | `05_Delivery` | End-to-end process flows of the broker with the screens, roles and postings of each step (PFD) |
| Implementation Approach and Plan | `05_Delivery` | Method, phases, plans by size, roles, governance and risks |
| Implementation Plan | `05_Delivery` | Task-level plans for the four sizes with owners, predecessors, float and critical path; milestones; RACI |
| Dependency Map and Critical Path | `05_Delivery` | Dependencies between work streams, partners and decisions, and the critical path to go-live |
| Fit Gap Register | `05_Delivery` | Register of requirements classed Fit, Configure, Procedure or Gap, with the product gaps closed in this release |
| RAID Log Template | `05_Delivery` | Risks, assumptions, issues and dependencies, pre-filled for an implementation, with scoring and summary |
| Project Status Report Template | `05_Delivery` | Weekly or fortnightly status and steering committee report |
| Training Plan | `05_Delivery` | Training and change management by role |
| Schedules and Batch Jobs | `05_Delivery` | Every scheduled job and batch process, the operational run book and the support runbook per job |
| Test Strategy | `05_Delivery` | How the product and each implementation are tested: levels, types, environments, test data and masking, entry and exit criteria, defects, CI gates |
| Test Plan | `05_Delivery` | Test plan of a broker implementation: scope per module, schedule by size, cycles from SIT to hypercare, resourcing, sign-off |
| Test Summary Report | `05_Delivery` | Results of the release test |
| Business Requirements Document | `05_Delivery` | Business requirements by process area with acceptance criteria and the screen that meets each, non-functional requirements and the functional specification by module |
| Process Flow Document | `05_Delivery` | End-to-end process flows with swimlane diagrams, numbered steps, postings, documents and controls |
| Release Notes and Roadmap | `06_Support` | What the release delivers, known limitations, versioning policy and indicative roadmap |
| Architecture Infrastructure Security and Privacy | `07_Technical` | Architecture, hosting options, security controls and data privacy |
| Go No Go and Management Register (INTERNAL) | `08_Management` | Release recommendation, go-live conditions, risks, plans and decisions needed |
| OOTB Strategy and Playbook INTERNAL (INTERNAL) | `08_Management` | How iorta TechNXT sells, delivers, supports and evolves the OOTB product |
| OOTB Documentation Pack Index | `08_Management` | This index |
| Brand Packs (INTERNAL) | `04_Onboarding_and_Go_Live` | Brand packs to import in Theme and Branding; a client pack carrying a third party's marks is used only in that client's environments, with its written permission |
| Upload Templates | `05_Delivery` | Standard upload templates for the go-live data, one per master or opening balance, and the go-live configuration and migration workbooks |
| `docs/onboarding/GO_LIVE_DATA_SETUP.md` | Code repository | Order of set-up from company to opening balances |
| `docs/onboarding/GO_LIVE_DATA_WORKBENCH.md` | Code repository | Configuration and migration workbooks, validation, load, reconciliation, environment comparison |
| `docs/onboarding/SMOKE_TEST_AND_RESET.md` | Code repository | Smoke test, transaction reset and the go-live lock |

### Sales

Account managers and presales.

| Document | Folder | What it is for |
|---|---|---|
| Brochure | `01_Sales` | Product brochure (8 pages): platform, compliance, connections, roles, deployment, delivery and support |
| One Page Brochure | `01_Sales` | One-page summary for a first e-mail, a trade event or a social post |
| Client Presentation | `01_Sales` | Client presentation deck for the first meeting, with speaker notes |
| Product Functionality | `01_Sales` | What the product does, module by module, with the vendor comparison checklist |
| Demo Script | `01_Sales` | Scripted 60 and 30-minute demonstrations with optional segments (AML/CFT, IC registers, BIR and EOPT, integrations, dealer programmes, branding, My Work, Report Builder) |
| FAQ and Objection Handling | `01_Sales` | Answers to common questions and objections; known limits to disclose |
| Prospect Email Templates | `01_Sales` | E-mails from first contact to the welcome after signing, including the compliance-led introduction |
| Prospect Email Templates | `01_Sales` | Plain-text copy of the prospect e-mails for pasting into a mail client (generated from the same source) |
| ROI Calculator | `01_Sales` | Return on investment calculator filled in with the broker |
| Competitive Battlecard INTERNAL (INTERNAL) | `01_Sales` | Competitor positioning, proof points and limits to disclose |
| Commercial Proposal Rate Card | `02_Commercials` | Rate card and commercial proposal given to the broker |
| Commercials and Pricing (INTERNAL) | `02_Commercials` | Formula-driven pricing model behind the rate card |
| Price Book (INTERNAL) | `02_Commercials` | Price book with quick quote, packages and negotiation limits |
| Commercial Proposal Note (INTERNAL) | `02_Commercials` | Pricing rationale, market positioning, review of the new modules against the price list |
| Negotiation Playbook INTERNAL (INTERNAL) | `02_Commercials` | Discount limits, trade-offs and approval rules in negotiation |
| Contract Pack Index and Cover Letter | `03_Contracts` | Index of the contract pack and cover letter to the broker |
| Mutual Non Disclosure Agreement | `03_Contracts` | Mutual NDA before detailed discussions |
| Letter of Award and Proposal Acceptance | `03_Contracts` | Broker letter of award and acceptance of the proposal |
| Order Form | `03_Contracts` | Order Form: size, model, prices, hosting and dates |
| Service Catalogue and Rate Annex | `03_Contracts` | Optional services and day rates |
| Security Due Diligence Questionnaire | `04_Onboarding_and_Go_Live` | Pre-answered security and outsourcing due diligence questionnaire |
| Philippine Regulatory Compliance Matrix | `05_Delivery` | How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations |
| Business Requirements Document | `05_Delivery` | Business requirements by process area with acceptance criteria and the screen that meets each, non-functional requirements and the functional specification by module |
| Release Notes and Roadmap | `06_Support` | What the release delivers, known limitations, versioning policy and indicative roadmap |
| Go No Go and Management Register (INTERNAL) | `08_Management` | Release recommendation, go-live conditions, risks, plans and decisions needed |
| OOTB Strategy and Playbook INTERNAL (INTERNAL) | `08_Management` | How iorta TechNXT sells, delivers, supports and evolves the OOTB product |
| PH Fit and ASEAN Rollout Assessment (INTERNAL) | `08_Management` | Philippine process fit by area with evidence, gaps ranked, and the change needed for each ASEAN country |
| OOTB Documentation Pack Index | `08_Management` | This index |

### Support

L2 application support, L3 engineering on call and DevOps.

| Document | Folder | What it is for |
|---|---|---|
| Annual Maintenance Support and SLA | `03_Contracts` | Annual maintenance, support and service levels |
| Hosting and Infrastructure Services Agreement | `03_Contracts` | Hosting services, data location, backups and recovery objectives |
| Data Processing Agreement | `03_Contracts` | Data processing agreement under the Data Privacy Act |
| Exit and Transition Plan | `03_Contracts` | Data return and transition at the end of the contract |
| Hypercare Exit and Handover Certificate | `03_Contracts` | Hypercare exit and handover to support |
| Environment Strategy and Production Rollout | `04_Onboarding_and_Go_Live` | Environments, promotion of code, scripts and configuration, release pipeline, cutover runbook and RACI |
| User Manual | `05_Delivery` | User manual by role, also opened per screen from the Help panel (F1) |
| Reports Book | `05_Delivery` | Every report, dashboard and export with its columns and rules |
| Communication Templates and Touchpoints | `05_Delivery` | Every e-mail, SMS, notification and printed document the system sends |
| Communication Touchpoints | `05_Delivery` | Companion workbook of the communication templates |
| Schedules and Batch Jobs | `05_Delivery` | Every scheduled job and batch process, the operational run book and the support runbook per job |
| Process Flow Document | `05_Delivery` | End-to-end process flows with swimlane diagrams, numbered steps, postings, documents and controls |
| Production Support Approach and Standards | `06_Support` | Support model, severities, change and release management, monitoring, and the procedures for integrations, compliance deadlines, keys, brand packs and e-signatures |
| Business Continuity and Disaster Recovery Plan | `06_Support` | Backups, keys, recovery objectives, scenarios, partner outages and DR tests |
| Release Notes and Roadmap | `06_Support` | What the release delivers, known limitations, versioning policy and indicative roadmap |
| Release Notes Template | `06_Support` | Release notes for each patch, minor or major release, with jobs, connectors and keys |
| Architecture Infrastructure Security and Privacy | `07_Technical` | Architecture, hosting options, security controls and data privacy |
| Technical Reference | `07_Technical` | Code base, modules, security implementation and how to extend |
| API and Dependency Catalogue | `07_Technical` | Every API route with its permission and the screens that call it |
| Data Dictionary | `07_Technical` | Tables, columns, relationships, personal data and retention |
| Go No Go and Management Register (INTERNAL) | `08_Management` | Release recommendation, go-live conditions, risks, plans and decisions needed |
| OOTB Strategy and Playbook INTERNAL (INTERNAL) | `08_Management` | How iorta TechNXT sells, delivers, supports and evolves the OOTB product |
| OOTB Documentation Pack Index | `08_Management` | This index |
| Brand Packs (INTERNAL) | `04_Onboarding_and_Go_Live` | Brand packs to import in Theme and Branding; a client pack carrying a third party's marks is used only in that client's environments, with its written permission |
| `docs/onboarding/SUPPORT_AND_ESCALATION.md` | Code repository | How to report an issue, severities, support procedures by area |
| `docs/onboarding/GO_LIVE_DATA_WORKBENCH.md` | Code repository | Configuration and migration workbooks, validation, load, reconciliation, environment comparison |
| `docs/onboarding/BRANDING_AND_SIGNATURES.md` | Code repository | Theme, brand packs, e-signatures and their support procedures |
| `docs/onboarding/SMOKE_TEST_AND_RESET.md` | Code repository | Smoke test, transaction reset and the go-live lock |
| `docs/onboarding/DATA_MASKING.md` | Code repository | Masking of production copies for test and training |
| `docs/developer-guide/README.md` | Code repository | Developer and production support guide: back end, front end, tracing a defect |
| `deploy/README.md, deploy/REFERENCE.md` | Code repository | Installation, environment variables and keys, release pipeline, rollback |

### Management

iorta TechNXT management, and the broker's management for client-facing files.

| Document | Folder | What it is for |
|---|---|---|
| Product Functionality | `01_Sales` | What the product does, module by module, with the vendor comparison checklist |
| Commercial Proposal Rate Card | `02_Commercials` | Rate card and commercial proposal given to the broker |
| Commercials and Pricing (INTERNAL) | `02_Commercials` | Formula-driven pricing model behind the rate card |
| Price Book (INTERNAL) | `02_Commercials` | Price book with quick quote, packages and negotiation limits |
| Commercial Proposal Note (INTERNAL) | `02_Commercials` | Pricing rationale, market positioning, review of the new modules against the price list |
| Negotiation Playbook INTERNAL (INTERNAL) | `02_Commercials` | Discount limits, trade-offs and approval rules in negotiation |
| Contract Pack Index and Cover Letter | `03_Contracts` | Index of the contract pack and cover letter to the broker |
| Mutual Non Disclosure Agreement | `03_Contracts` | Mutual NDA before detailed discussions |
| Letter of Award and Proposal Acceptance | `03_Contracts` | Broker letter of award and acceptance of the proposal |
| Master Services Agreement | `03_Contracts` | Master Services Agreement |
| Order Form | `03_Contracts` | Order Form: size, model, prices, hosting and dates |
| Perpetual Software Licence Agreement | `03_Contracts` | Licence schedule for the perpetual model |
| Software Subscription Agreement | `03_Contracts` | Subscription schedule for the SaaS model |
| Implementation Statement of Work | `03_Contracts` | Implementation scope, milestones, acceptance and governance (SOW) |
| Annual Maintenance Support and SLA | `03_Contracts` | Annual maintenance, support and service levels |
| Hosting and Infrastructure Services Agreement | `03_Contracts` | Hosting services, data location, backups and recovery objectives |
| Data Processing Agreement | `03_Contracts` | Data processing agreement under the Data Privacy Act |
| Service Catalogue and Rate Annex | `03_Contracts` | Optional services and day rates |
| Customer Responsibilities and RACI Annex | `03_Contracts` | What the broker provides and who does what |
| Change Request Procedure and Form | `03_Contracts` | Change request procedure and form |
| Source Code Escrow Agreement | `03_Contracts` | Optional source code escrow with the perpetual licence |
| Exit and Transition Plan | `03_Contracts` | Data return and transition at the end of the contract |
| UAT and Go Live Acceptance Certificates | `03_Contracts` | UAT and go-live acceptance certificates |
| Hypercare Exit and Handover Certificate | `03_Contracts` | Hypercare exit and handover to support |
| Security Due Diligence Questionnaire | `04_Onboarding_and_Go_Live` | Pre-answered security and outsourcing due diligence questionnaire |
| Environment Strategy and Production Rollout | `04_Onboarding_and_Go_Live` | Environments, promotion of code, scripts and configuration, release pipeline, cutover runbook and RACI |
| Privacy Impact Assessment and Records of Processing Templates | `04_Onboarding_and_Go_Live` | PIA and records of processing pre-filled for the broker DPO |
| Implementation Approach and Plan | `05_Delivery` | Method, phases, plans by size, roles, governance and risks |
| Dependency Map and Critical Path | `05_Delivery` | Dependencies between work streams, partners and decisions, and the critical path to go-live |
| Fit Gap Register | `05_Delivery` | Register of requirements classed Fit, Configure, Procedure or Gap, with the product gaps closed in this release |
| RAID Log Template | `05_Delivery` | Risks, assumptions, issues and dependencies, pre-filled for an implementation, with scoring and summary |
| Project Status Report Template | `05_Delivery` | Weekly or fortnightly status and steering committee report |
| Test Strategy | `05_Delivery` | How the product and each implementation are tested: levels, types, environments, test data and masking, entry and exit criteria, defects, CI gates |
| Test Plan | `05_Delivery` | Test plan of a broker implementation: scope per module, schedule by size, cycles from SIT to hypercare, resourcing, sign-off |
| Test Summary Report | `05_Delivery` | Results of the release test |
| Philippine Regulatory Compliance Matrix | `05_Delivery` | How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations |
| Business Requirements Document | `05_Delivery` | Business requirements by process area with acceptance criteria and the screen that meets each, non-functional requirements and the functional specification by module |
| Production Support Approach and Standards | `06_Support` | Support model, severities, change and release management, monitoring, and the procedures for integrations, compliance deadlines, keys, brand packs and e-signatures |
| Business Continuity and Disaster Recovery Plan | `06_Support` | Backups, keys, recovery objectives, scenarios, partner outages and DR tests |
| Release Notes and Roadmap | `06_Support` | What the release delivers, known limitations, versioning policy and indicative roadmap |
| Architecture Infrastructure Security and Privacy | `07_Technical` | Architecture, hosting options, security controls and data privacy |
| Go No Go and Management Register (INTERNAL) | `08_Management` | Release recommendation, go-live conditions, risks, plans and decisions needed |
| OOTB Strategy and Playbook INTERNAL (INTERNAL) | `08_Management` | How iorta TechNXT sells, delivers, supports and evolves the OOTB product |
| PH Fit and ASEAN Rollout Assessment (INTERNAL) | `08_Management` | Philippine process fit by area with evidence, gaps ranked, and the change needed for each ASEAN country |
| OOTB Documentation Pack Index | `08_Management` | This index |

## Index by lifecycle stage

| Stage | Documents used |
|---|---|
| Pre-sales | Brochure; One Page Brochure; Client Presentation; Product Functionality; Demo Script; FAQ and Objection Handling; Prospect Email Templates; Prospect Email Templates; ROI Calculator; Competitive Battlecard INTERNAL (INTERNAL); Commercial Proposal Rate Card; Commercials and Pricing (INTERNAL); Price Book (INTERNAL); Commercial Proposal Note (INTERNAL); Mutual Non Disclosure Agreement; Security Due Diligence Questionnaire; Business Requirements Document; Implementation Approach and Plan; Test Summary Report; Philippine Regulatory Compliance Matrix; Business Requirements Document; Release Notes and Roadmap; Architecture Infrastructure Security and Privacy; OOTB Strategy and Playbook INTERNAL (INTERNAL); PH Fit and ASEAN Rollout Assessment (INTERNAL); OOTB Documentation Pack Index |
| Contracting | Prospect Email Templates; Prospect Email Templates; Commercial Proposal Rate Card; Commercials and Pricing (INTERNAL); Price Book (INTERNAL); Commercial Proposal Note (INTERNAL); Negotiation Playbook INTERNAL (INTERNAL); Contract Pack Index and Cover Letter; Letter of Award and Proposal Acceptance; Master Services Agreement; Order Form; Perpetual Software Licence Agreement; Software Subscription Agreement; Implementation Statement of Work; Annual Maintenance Support and SLA; Hosting and Infrastructure Services Agreement; Data Processing Agreement; Service Catalogue and Rate Annex; Customer Responsibilities and RACI Annex; Change Request Procedure and Form; Source Code Escrow Agreement; Exit and Transition Plan; Security Due Diligence Questionnaire; Production Support Approach and Standards; Business Continuity and Disaster Recovery Plan; Architecture Infrastructure Security and Privacy; OOTB Strategy and Playbook INTERNAL (INTERNAL); OOTB Documentation Pack Index |
| Implementation | Implementation Statement of Work; Customer Responsibilities and RACI Annex; Change Request Procedure and Form; Discovery Workbook Guide; Discovery and Configuration Workbook; Data Migration and Cutover Plan; Environment Strategy and Production Rollout; Privacy Impact Assessment and Records of Processing Templates; Business Requirements Document; Process Flow Document; Implementation Approach and Plan; Implementation Plan; Dependency Map and Critical Path; Fit Gap Register; RAID Log Template; Project Status Report Template; Training Plan; User Manual; Reports Book; Communication Templates and Touchpoints; Communication Touchpoints; Schedules and Batch Jobs; Test Strategy; Test Plan; Test Cases; Philippine Regulatory Compliance Matrix; Business Requirements Document; Process Flow Document; Architecture Infrastructure Security and Privacy; Technical Reference; API and Dependency Catalogue; Data Dictionary; OOTB Strategy and Playbook INTERNAL (INTERNAL); OOTB Documentation Pack Index; Brand Packs (INTERNAL); Upload Templates |
| Go-live | UAT and Go Live Acceptance Certificates; Hypercare Exit and Handover Certificate; Data Migration and Cutover Plan; Environment Strategy and Production Rollout; Privacy Impact Assessment and Records of Processing Templates; Dependency Map and Critical Path; RAID Log Template; Project Status Report Template; User Manual; Schedules and Batch Jobs; Test Strategy; Test Plan; Test Cases; Test Summary Report; Process Flow Document; Production Support Approach and Standards; Release Notes and Roadmap; Go No Go and Management Register (INTERNAL); OOTB Strategy and Playbook INTERNAL (INTERNAL); OOTB Documentation Pack Index; Brand Packs (INTERNAL); Upload Templates |
| Support | Annual Maintenance Support and SLA; Hosting and Infrastructure Services Agreement; Service Catalogue and Rate Annex; Change Request Procedure and Form; Exit and Transition Plan; Hypercare Exit and Handover Certificate; User Manual; Reports Book; Communication Templates and Touchpoints; Communication Touchpoints; Schedules and Batch Jobs; Process Flow Document; Production Support Approach and Standards; Business Continuity and Disaster Recovery Plan; Release Notes and Roadmap; Release Notes Template; Technical Reference; API and Dependency Catalogue; Data Dictionary; OOTB Strategy and Playbook INTERNAL (INTERNAL); PH Fit and ASEAN Rollout Assessment (INTERNAL); OOTB Documentation Pack Index |

## File list by folder

### Sales (01_Sales)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `iNXT_BrokerVerse_Brochure`<br>docx, pdf | Product brochure (8 pages): platform, compliance, connections, roles, deployment, delivery and support | Sales<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_One_Page_Brochure`<br>docx, pdf, png | One-page summary for a first e-mail, a trade event or a social post | Sales<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Client_Presentation`<br>pptx, pdf | Client presentation deck for the first meeting, with speaker notes | Sales<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Product_Functionality`<br>docx, pdf | What the product does, module by module, with the vendor comparison checklist | Sales, Business analysts, Management<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Demo_Script`<br>docx, pdf | Scripted 60 and 30-minute demonstrations with optional segments (AML/CFT, IC registers, BIR and EOPT, integrations, dealer programmes, branding, My Work, Report Builder) | Sales<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_FAQ_and_Objection_Handling`<br>docx, pdf | Answers to common questions and objections; known limits to disclose | Sales<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Prospect_Email_Templates`<br>docx, pdf | E-mails from first contact to the welcome after signing, including the compliance-led introduction | Sales<br>Client-facing | Pre-sales, Contracting |
| `Prospect_Email_Templates`<br>txt | Plain-text copy of the prospect e-mails for pasting into a mail client (generated from the same source) | Sales<br>Client-facing | Pre-sales, Contracting |
| `iNXT_BrokerVerse_ROI_Calculator`<br>xlsx | Return on investment calculator filled in with the broker | Sales<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Competitive_Battlecard_INTERNAL`<br>docx, pdf | Competitor positioning, proof points and limits to disclose | Sales<br>**INTERNAL** | Pre-sales |

### Commercials (02_Commercials)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `iNXT_BrokerVerse_Commercial_Proposal_Rate_Card`<br>docx, pdf | Rate card and commercial proposal given to the broker | Sales, Management<br>Client-facing | Pre-sales, Contracting |
| `BrokerVerse_Commercials_and_Pricing`<br>xlsx | Formula-driven pricing model behind the rate card | Management, Sales<br>**INTERNAL** | Pre-sales, Contracting |
| `iNXT_BrokerVerse_Price_Book`<br>xlsx | Price book with quick quote, packages and negotiation limits | Sales, Management<br>**INTERNAL** | Pre-sales, Contracting |
| `BrokerVerse_Commercial_Proposal_Note`<br>docx, pdf | Pricing rationale, market positioning, review of the new modules against the price list | Management, Sales<br>**INTERNAL** | Pre-sales, Contracting |
| `iNXT_BrokerVerse_Negotiation_Playbook_INTERNAL`<br>docx, pdf | Discount limits, trade-offs and approval rules in negotiation | Sales, Management<br>**INTERNAL** | Contracting |

### Contracts (03_Contracts)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `iNXT_BrokerVerse_Contract_Pack_Index_and_Cover_Letter`<br>docx, pdf | Index of the contract pack and cover letter to the broker | Sales, Management<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Mutual_Non_Disclosure_Agreement`<br>docx, pdf | Mutual NDA before detailed discussions | Sales, Management<br>Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Letter_of_Award_and_Proposal_Acceptance`<br>docx, pdf | Broker letter of award and acceptance of the proposal | Sales, Management<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Master_Services_Agreement`<br>docx, pdf | Master Services Agreement | Management<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Order_Form`<br>docx, pdf | Order Form: size, model, prices, hosting and dates | Sales, Management<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Perpetual_Software_Licence_Agreement`<br>docx, pdf | Licence schedule for the perpetual model | Management<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Software_Subscription_Agreement`<br>docx, pdf | Subscription schedule for the SaaS model | Management<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Implementation_Statement_of_Work`<br>docx, pdf | Implementation scope, milestones, acceptance and governance (SOW) | Delivery and PM, Business analysts, Management<br>Client-facing | Contracting, Implementation |
| `iNXT_BrokerVerse_Annual_Maintenance_Support_and_SLA`<br>docx, pdf | Annual maintenance, support and service levels | Support, Management<br>Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_Hosting_and_Infrastructure_Services_Agreement`<br>docx, pdf | Hosting services, data location, backups and recovery objectives | Support, Management<br>Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_Data_Processing_Agreement`<br>docx, pdf | Data processing agreement under the Data Privacy Act | Management, Support<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Service_Catalogue_and_Rate_Annex`<br>docx, pdf | Optional services and day rates | Sales, Management<br>Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_Customer_Responsibilities_and_RACI_Annex`<br>docx, pdf | What the broker provides and who does what | Delivery and PM, Management<br>Client-facing | Contracting, Implementation |
| `iNXT_BrokerVerse_Change_Request_Procedure_and_Form`<br>docx, pdf | Change request procedure and form | Delivery and PM, Business analysts, Management<br>Client-facing | Contracting, Implementation, Support |
| `iNXT_BrokerVerse_Source_Code_Escrow_Agreement`<br>docx, pdf | Optional source code escrow with the perpetual licence | Management<br>Client-facing | Contracting |
| `iNXT_BrokerVerse_Exit_and_Transition_Plan`<br>docx, pdf | Data return and transition at the end of the contract | Management, Support<br>Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_UAT_and_Go_Live_Acceptance_Certificates`<br>docx, pdf | UAT and go-live acceptance certificates | Delivery and PM, QA, Management<br>Client-facing | Go-live |
| `iNXT_BrokerVerse_Hypercare_Exit_and_Handover_Certificate`<br>docx, pdf | Hypercare exit and handover to support | Delivery and PM, Support, Management<br>Client-facing | Go-live, Support |

### Onboarding and go-live (04_Onboarding_and_Go_Live)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `BrokerVerse_Security_Due_Diligence_Questionnaire`<br>docx, pdf, xlsx | Pre-answered security and outsourcing due diligence questionnaire | Sales, Delivery and PM, Management<br>Client-facing | Pre-sales, Contracting |
| `BrokerVerse_Discovery_Workbook_Guide`<br>docx, pdf | How to run the discovery and configuration workshops | Business analysts, Delivery and PM<br>Client-facing | Implementation |
| `BrokerVerse_Discovery_and_Configuration_Workbook`<br>xlsx | Configuration decisions captured in discovery | Business analysts, Delivery and PM<br>Client-facing | Implementation |
| `BrokerVerse_Data_Migration_and_Cutover_Plan`<br>docx, pdf | Go-live data, workbench, mock loads, reconciliation and cutover | Delivery and PM, Business analysts, QA<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Environment_Strategy_and_Production_Rollout`<br>docx, pdf | Environments, promotion of code, scripts and configuration, release pipeline, cutover runbook and RACI | Delivery and PM, Developers, Support, Management<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Privacy_Impact_Assessment_and_Records_of_Processing_Templates`<br>docx, pdf | PIA and records of processing pre-filled for the broker DPO | Business analysts, Delivery and PM, Management<br>Client-facing | Implementation, Go-live |
| `Brand_Packs/`<br>folder | Brand packs to import in Theme and Branding; a client pack carrying a third party's marks is used only in that client's environments, with its written permission | Delivery and PM, Support<br>**INTERNAL** | Implementation, Go-live |

### Delivery (05_Delivery)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `BrokerVerse_Business_Requirements_Document`<br>docx, pdf | Business requirements of the OOTB product by module, with business rules and regulatory references (BRD) | Business analysts, QA, Delivery and PM, Developers<br>Client-facing | Pre-sales, Implementation |
| `BrokerVerse_Process_Flow_Document`<br>docx, pdf | End-to-end process flows of the broker with the screens, roles and postings of each step (PFD) | Business analysts, Users, QA, Delivery and PM<br>Client-facing | Implementation |
| `BrokerVerse_Implementation_Approach_and_Plan`<br>docx, pdf | Method, phases, plans by size, roles, governance and risks | Delivery and PM, Management<br>Client-facing | Pre-sales, Implementation |
| `BrokerVerse_Implementation_Plan`<br>xlsx | Task-level plans for the four sizes with owners, predecessors, float and critical path; milestones; RACI | Delivery and PM<br>Client-facing | Implementation |
| `BrokerVerse_Dependency_Map_and_Critical_Path`<br>docx, pdf | Dependencies between work streams, partners and decisions, and the critical path to go-live | Delivery and PM, Management<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Fit_Gap_Register`<br>xlsx | Register of requirements classed Fit, Configure, Procedure or Gap, with the product gaps closed in this release | Business analysts, Delivery and PM, Management<br>Client-facing | Implementation |
| `BrokerVerse_RAID_Log_Template`<br>xlsx | Risks, assumptions, issues and dependencies, pre-filled for an implementation, with scoring and summary | Delivery and PM, Management<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Project_Status_Report_Template`<br>docx, pdf | Weekly or fortnightly status and steering committee report | Delivery and PM, Management<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Training_Plan`<br>docx, pdf | Training and change management by role | Delivery and PM, Users<br>Client-facing | Implementation |
| `BrokerVerse_User_Manual`<br>docx, pdf | User manual by role, also opened per screen from the Help panel (F1) | Users, Business analysts, QA, Support<br>Client-facing | Implementation, Go-live, Support |
| `BrokerVerse_Reports_Book`<br>docx, pdf, xlsx | Every report, dashboard and export with its columns and rules | Users, Business analysts, Support<br>Client-facing | Implementation, Support |
| `BrokerVerse_Communication_Templates_and_Touchpoints`<br>docx, pdf | Every e-mail, SMS, notification and printed document the system sends | Business analysts, Users, Support<br>Client-facing | Implementation, Support |
| `BrokerVerse_Communication_Touchpoints`<br>xlsx | Companion workbook of the communication templates | Business analysts, Support<br>Client-facing | Implementation, Support |
| `BrokerVerse_Schedules_and_Batch_Jobs`<br>docx, pdf | Every scheduled job and batch process, the operational run book and the support runbook per job | Support, Users, Delivery and PM<br>Client-facing | Implementation, Go-live, Support |
| `BrokerVerse_Test_Strategy`<br>docx, pdf | How the product and each implementation are tested: levels, types, environments, test data and masking, entry and exit criteria, defects, CI gates | QA, Delivery and PM, Developers, Management<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Test_Plan`<br>docx, pdf | Test plan of a broker implementation: scope per module, schedule by size, cycles from SIT to hypercare, resourcing, sign-off | QA, Delivery and PM, Management<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Test_Cases`<br>xlsx | Release test cases with regulatory references, the requirements traceability matrix (sheet Requirements Traceability: the 150 processes to test cases and automated tests), defects | QA, Developers<br>Client-facing | Implementation, Go-live |
| `BrokerVerse_Test_Summary_Report`<br>docx, pdf | Results of the release test | QA, Delivery and PM, Developers, Management<br>Client-facing | Pre-sales, Go-live |
| `BrokerVerse_Philippine_Regulatory_Compliance_Matrix`<br>docx, pdf | How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations | Sales, Business analysts, QA, Management<br>Client-facing | Pre-sales, Implementation |
| `BrokerVerse_Business_Requirements_Document`<br>docx, pdf | Business requirements by process area with acceptance criteria and the screen that meets each, non-functional requirements and the functional specification by module | Delivery and PM, Sales, Management<br>Client-facing | Pre-sales, Implementation |
| `BrokerVerse_Process_Flow_Document`<br>docx, pdf | End-to-end process flows with swimlane diagrams, numbered steps, postings, documents and controls | Delivery and PM, Support<br>Client-facing | Implementation, Go-live, Support |
| `Upload_Templates/`<br>folder | Standard upload templates for the go-live data, one per master or opening balance, and the go-live configuration and migration workbooks | Delivery and PM, Business analysts, Users<br>Client-facing | Implementation, Go-live |

### Support (06_Support)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `BrokerVerse_Production_Support_Approach_and_Standards`<br>docx, pdf | Support model, severities, change and release management, monitoring, and the procedures for integrations, compliance deadlines, keys, brand packs and e-signatures | Support, Management<br>Client-facing | Contracting, Go-live, Support |
| `BrokerVerse_Business_Continuity_and_Disaster_Recovery_Plan`<br>docx, pdf | Backups, keys, recovery objectives, scenarios, partner outages and DR tests | Support, Management<br>Client-facing | Contracting, Support |
| `BrokerVerse_Release_Notes_and_Roadmap`<br>docx, pdf | What the release delivers, known limitations, versioning policy and indicative roadmap | Sales, Delivery and PM, Support, Management<br>Client-facing | Pre-sales, Go-live, Support |
| `BrokerVerse_Release_Notes_Template`<br>docx, pdf | Release notes for each patch, minor or major release, with jobs, connectors and keys | Developers, Support<br>Client-facing | Support |

### Technical (07_Technical)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `BrokerVerse_Architecture_Infrastructure_Security_and_Privacy`<br>docx, pdf | Architecture, hosting options, security controls and data privacy | Developers, Delivery and PM, Support, Management<br>Client-facing | Pre-sales, Contracting, Implementation |
| `BrokerVerse_Technical_Reference`<br>docx, pdf | Code base, modules, security implementation and how to extend | Developers, Support<br>Client-facing | Implementation, Support |
| `BrokerVerse_API_and_Dependency_Catalogue`<br>xlsx | Every API route with its permission and the screens that call it | Developers, Support, QA<br>Client-facing | Implementation, Support |
| `BrokerVerse_Data_Dictionary`<br>docx, pdf, xlsx | Tables, columns, relationships, personal data and retention | Developers, Business analysts, Support<br>Client-facing | Implementation, Support |

### Management (08_Management)

| File and formats | Purpose | Departments and distribution | Used in |
|---|---|---|---|
| `BrokerVerse_Go_No_Go_and_Management_Register`<br>docx, pdf | Release recommendation, go-live conditions, risks, plans and decisions needed | Management, Delivery and PM, Developers, Support, Sales<br>**INTERNAL** | Go-live |
| `iNXT_BrokerVerse_OOTB_Strategy_and_Playbook_INTERNAL`<br>docx, pdf | How iorta TechNXT sells, delivers, supports and evolves the OOTB product | Management, Sales, Delivery and PM, Developers, Support<br>**INTERNAL** | Pre-sales, Contracting, Implementation, Go-live, Support |
| `BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment`<br>docx, pdf, xlsx | Philippine process fit by area with evidence, gaps ranked, and the change needed for each ASEAN country | Management, Sales, Developers<br>**INTERNAL** | Pre-sales, Support |
| `BrokerVerse_OOTB_Documentation_Pack_Index`<br>docx, pdf | This index | Users, Developers, Business analysts, QA, Delivery and PM, Sales, Support, Management<br>Client-facing | Pre-sales, Contracting, Implementation, Go-live, Support |

## INTERNAL documents

These files never leave iorta TechNXT:

- `01_Sales/iNXT_BrokerVerse_Competitive_Battlecard_INTERNAL` (docx, pdf): Competitor positioning, proof points and limits to disclose.
- `02_Commercials/BrokerVerse_Commercials_and_Pricing` (xlsx): Formula-driven pricing model behind the rate card.
- `02_Commercials/iNXT_BrokerVerse_Price_Book` (xlsx): Price book with quick quote, packages and negotiation limits.
- `02_Commercials/BrokerVerse_Commercial_Proposal_Note` (docx, pdf): Pricing rationale, market positioning, review of the new modules against the price list.
- `02_Commercials/iNXT_BrokerVerse_Negotiation_Playbook_INTERNAL` (docx, pdf): Discount limits, trade-offs and approval rules in negotiation.
- `08_Management/BrokerVerse_Go_No_Go_and_Management_Register` (docx, pdf): Release recommendation, go-live conditions, risks, plans and decisions needed.
- `08_Management/iNXT_BrokerVerse_OOTB_Strategy_and_Playbook_INTERNAL` (docx, pdf): How iorta TechNXT sells, delivers, supports and evolves the OOTB product.
- `08_Management/BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment` (docx, pdf, xlsx): Philippine process fit by area with evidence, gaps ranked, and the change needed for each ASEAN country.
- `04_Onboarding_and_Go_Live/Brand_Packs/` (folder): Brand packs to import in Theme and Branding; a client pack carrying a third party's marks is used only in that client's environments, with its written permission.

## Building the documents

Each Word and PDF document is built from its text source in `source/` into the iorta TechNXT template. The table of sources, folders and file names is kept in one place, `tools/build_all.py`:

```
cd docs/package/tools
python3 build_all.py --list                (which source becomes which file)
python3 build_all.py                       (every document: .docx, contents page and .pdf)
python3 build_all.py user-manual           (one document)
python3 build_all.py --sales --workbooks   (also brochures, presentation, plain-text e-mails and workbooks)
```

`build_all.py` runs `build_doc.py` (text to .docx), the post-processing step where one is needed (`brochure/widths.py` for the Product Functionality document) and `refresh.py` (contents page and PDF with LibreOffice, on a private profile and port). The workbooks have their own builders: `build_pricing.py`, `build_price_book.py`, `build_roi.py`, `build_questionnaire_xlsx.py`, `build_discovery_workbook.py`, `build_plan_xlsx.py`, `build_project_templates_xlsx.py` (Fit-Gap Register and RAID Log), `build_touchpoints_xlsx.py`, `build_api_catalogue.py`, `build_fit_assessment_xlsx.py` (Philippine fit and ASEAN rollout assessment) and `data-dictionary/`. The plain-text prospect e-mails come from `build_prospect_emails_txt.py`. The Test Cases and Reports Book workbooks are maintained directly. Writing rules: `tools/WRITING_RULES.md`. This index is generated by `build_pack_index.py`.
