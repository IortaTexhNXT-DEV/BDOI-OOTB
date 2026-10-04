---
title: Statement of Work
subtitle: OOTB implementation
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Scope, Deliverables, Client responsibilities and timeline aligned with the current product; template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: AMLC=Anti-Money Laundering Council; ATP=Authority to Print; BIR=Bureau of Internal Revenue; CAS=Computerized Accounting System; COC=Certificate of cover; CR=Change request; CTPL=Compulsory Third Party Liability; DPO=Data protection officer; EIS=Electronic Invoicing System; LTO=Land Transportation Office; NPC=National Privacy Commission; Dev=Development environment; IC=Insurance Commission; LOB=Line of business; MSA=Master Services Agreement; OOTB=Out of the box; PHP=Philippine peso; Pre-Prod=Pre-production environment; RAID=Risks, assumptions, issues and dependencies; SIT=System integration test; SOW=Statement of work; UAT=User acceptance testing; VAT=Value-added tax
---

# About this template

> Template for discussion; subject to review by the parties' legal counsel.

This Implementation Statement of Work (the **SOW**) describes the one-time implementation of iNXT BrokerVerse OOTB for the Client: the scope, phases, Deliverables, acceptance, responsibilities, assumptions, exclusions, timeline, fees and change control. It forms part of the Order Form no. [number] under the Master Services Agreement (the **MSA**) dated [date] between iorta TechNXT Corp. (**iorta TechNXT**) and [Client legal name] (the **Client**). Under the subscription model, this SOW describes the onboarding. Capitalised terms have the meaning given in the MSA. Text in [square brackets] is a placeholder or an option.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 03 October 2026 | Template for discussion |
| 1.1 | 04 October 2026 | Scope aligned with the current product: go-live configuration and migration kits; compliance set-up (AML/CFT, Insurance Commission and National Privacy Commission registers, masking of personal data); branding and brand packs, with the permission required for client marks; integrations with partners through the delivered connectors; environments, release pipeline and encryption key custody; regulatory registrations as Client dependencies; enterprise size and the 20 and 26-week timelines; Deliverables, acceptance criteria and Client responsibilities updated accordingly |

# Scope

## Objective

Bring iNXT BrokerVerse OOTB into production use for the Client's non-life broking and accounting operations by configuration and master data, without changes to the code, and hand it over to production support after the first month-end close.

## In scope

1. **Configuration** of the delivered system for the Client through the go-live configuration workbook (the **Configuration Kit**) and the screens of the system: company, letterhead, branches, departments and reporting lines; Philippine addresses from the PSGC masters; users and the delivered roles, including the Compliance Officer (AML/CFT) role; authority limits, maker-checker and approvals; insurers with credit and remittance terms and Insurance Commission certificates of authority; lines of business, products, covers, vehicles and distribution channels; product templates, rating factors, acceptance rules, document templates, market and risk mapping in the Product Configurator; commission rules, referrer sharing and insurer overriding commission; premium taxes and LGU rates; tax codes with BIR ATC; chart of accounts, account determination and posting rules; document numbering, including the registered serial range of the sales invoices; business rules, security policy, scheduled jobs and message texts.
2. Configuration of [number] lines of business: [list, for example motor, fire, marine cargo, engineering, casualty, bonds]. The price includes the number of lines of business of the Client's size (Small 5, Medium 8, Large 12, Enterprise 16); additional lines are priced at 6 man-days each.
3. **Compliance set-up** in the delivered Compliance menu, from the Client's decisions: the AML/CFT settings, risk factors and monitoring rules, and the loading of the screening lists the Client is entitled to use; the licence register, fit and proper records and insurer authority check; the complaints register settings; the personal data breach register settings; the masking of personal identifiers by role.
4. **Branding** of the Client's environments: theme, logo, sign-in page, branded documents, reports and e-mails, e-signatures of the Client's signatories mapped to documents, and a brand pack to promote the branding between environments. A brand pack that carries the name or marks of a third party is applied only as stated in the chapter Special conditions.
5. **Data migration** of open items with the go-live migration workbook (the **Migration Kit**): clients, in-force policies, open receivables, open claims and the opening trial balance (which carries the amounts due to insurers), as at the cutover date, for one legal entity and one fiscal year, with mock loads and a reconciliation of each load.
6. **Set-up of the delivered integrations**: outgoing e-mail through the Client's SMTP mailbox; bank statement formats for the Client's bank accounts; bank payment file layouts for the Client's banks; the delivered connectors for SMS or Viber messages, CTPL authentication and the LTO feed, insurer systems and the BIR Electronic Invoicing System; the delivered payment gateways (PayMongo and Dragonpay); and the AMLC report files. Each connector is configured and tested in test mode and switched to live when the Client's partner has certified it, as stated in the chapter Special conditions.
7. **Environments and release pipeline**: the environment set of the broker size stated in the Order Form (Dev, UAT and Production for a small or medium broker; Dev, SIT, UAT and Production with high availability for a large or enterprise broker) and a temporary Pre-Prod created from a production backup for the cutover rehearsal and removed after hypercare, hosted as stated in the Order Form; the release pipeline with an approval gate per environment; the application secrets and encryption keys of each environment, held as stated in the chapter Special conditions.
8. **Training**: train-the-trainer for key users for the training days of the Client's size (Small 4, Medium 6, Large 10, Enterprise 15), training of the Client's compliance officer, data protection officer and System Administrator on the compliance and privacy screens within those days, and support of end-user training run by the key users.
9. System integration test, UAT support, cutover rehearsal, cutover, go-live support and hypercare until the first month-end close.

## Implementation size

| Item | Value |
|---|---|
| Size | [Small / Medium / Large / Enterprise] |
| Named users | [number] |
| Lines of business configured | [number] |
| Offices and branches | [number] |
| Insurers | [number] |
| In-force policies to migrate (estimate) | [number] |
| Bank accounts | [number] |
| Banks for payment files | [names] |
| Partners to be certified | [SMS provider, CTPL authentication provider, insurers for API connection, payment gateway] |
| Registrations held by the Client at signature | [BIR ATP or CAS; AMLC registration; NPC registration; IC licence] |

The size is confirmed at mobilisation once data volumes are known. A change of size is handled through the Change Request Procedure.

# Approach and phases

The implementation follows the iorta TechNXT Implementation Approach and Plan: configure, do not customise; data drives the timeline; key users own the result; every data load uses the delivered templates and is rehearsed at least twice; every acceptance is written.

| # | Phase | What happens |
|---|---|---|
| 1 | Mobilisation | Kick-off, team and governance, plan confirmed, data request and kits issued, hosting and environment set decided |
| 2 | Environments and pipeline | Environment set of the size; release pipeline and its approval gates; application secrets and encryption keys; first deployment |
| 3 | Discovery and fit-gap | Process, compliance, integration and branding workshops on the delivered system; configuration decisions; fit-gap register |
| 4 | Client inputs | The Client fills the Configuration Kit, provides the partner contracts and prepares the migration extracts |
| 5 | Regulatory registrations | The Client confirms or obtains its BIR, AMLC, NPC and Insurance Commission registrations and the confirmation of its tax adviser |
| 6 | Configuration | Configuration Kit validated and loaded; on-screen configuration |
| 7 | Compliance set-up | AML/CFT, Insurance Commission and data privacy registers and settings |
| 8 | Branding and brand pack | Theme, documents, e-mails, e-signatures, brand pack |
| 9 | Integrations with partners | E-mail, bank files, SMS or Viber, CTPL authentication and LTO, insurer systems, payment gateway, BIR EIS, AMLC report files |
| 10 | Data migration | Mapping to the Migration Kit, mock loads, reconciliation |
| 11 | Training | Train-the-trainer, compliance officer and DPO training, end-user training per role |
| 12 | SIT and UAT | System integration test; UAT with the Client's own data; sign-off |
| 13 | Rehearsal and cutover | Release to Production; Pre-Prod from a production backup; rehearsal; go/no-go; cutover; go-live lock |
| 14 | Hypercare | Close support by the project team until the first month-end close is done; handover |

# Deliverables and acceptance

## Deliverables and acceptance criteria

| Phase | Deliverables | Acceptance criteria |
|---|---|---|
| Mobilisation | Project charter, baselined plan, RAID log, data request list, blank Configuration and Migration Kits, governance calendar | Charter and plan signed by both project managers and the sponsor |
| Environments and pipeline | Environment set of the size, environment sheet, release pipeline with approval gates, key custody record | Smoke test passed on each environment; one restore test done; key custody record signed by both Parties |
| Discovery and fit-gap | Configuration workbook, fit-gap register | Every process walked through; every register line classed and owned; signed by the process owners |
| Configuration | Configuration Kit loaded and promoted to UAT; configuration workbook updated | Batches loaded without errors; each item set and checked; test quotation premiums and taxes agree with manual calculations; comparison report shows UAT mirrors the source |
| Compliance set-up | AML/CFT settings and risk factors, screening lists loaded, Insurance Commission and data privacy registers and settings | Settings confirmed in writing by the Client's compliance officer and DPO; every client screened; one AMLC report test file generated |
| Branding | Branded theme, documents, reports and e-mails; e-signatures mapped; brand pack | Sample documents and e-mails approved by the Client's sponsor |
| Data migration | Mapping sheets, filled Migration Kits, load history and reconciliation of each mock load | Counts and totals agree within the agreed tolerance (default: exact); trial balance as at the cutover date agrees with the old system |
| Integrations | E-mail, bank statement formats and each integration listed in the Implementation size table | Password reset e-mail received; one statement per bank account imported; for each partner integration, the partner's certification passed or the fallback recorded at the go/no-go |
| Training | Training schedule, attendance lists, assessment results | Every user trained in the role before go-live; key users pass the assessment |
| SIT | SIT plan, results, defect log, SIT exit report | All end-to-end flows passed; no open severity 1 or 2 defect |
| UAT | UAT results per script, defect log, UAT sign-off | All UAT scripts passed or accepted with a workaround; sign-off by each process owner and the sponsor |
| Rehearsal and cutover | Rehearsal log, cutover checklist, final reconciliation, go/no-go minutes | Go/no-go criteria of the Data Migration and Cutover Plan met; the registrations listed in Client responsibilities in place |
| Go-live | Production in use; go-live communication | Users signed in and transacting; first receipts, remittances and bank imports processed |
| Hypercare | Hypercare log, first month-end close support, configuration baseline, handover pack | No open severity 1 or 2 issue; first close completed; handover accepted by production support and the System Administrator |

## Acceptance procedure

1. iorta TechNXT submits each Deliverable with a sign-off request that lists the acceptance criteria and the evidence.
2. The Client reviews the Deliverable within 5 Business Days of submission and either signs the acceptance certificate (Annex A; for UAT, go-live and hypercare exit, the forms of the UAT Sign-off and Go-live Acceptance Certificates and of the Hypercare Exit and Handover to Support Certificate) or gives a written list of the criteria not met, with reasons.
3. iorta TechNXT corrects the items listed and resubmits. The Client then reviews only the corrected items, within 3 Business Days.
4. A Deliverable is deemed accepted if the Client does not give a written objection within the review period, or if the Client uses it in production for its business.
5. A Deliverable is not rejected for defects of severity 3 or 4 alone. Those are logged and corrected under an agreed plan.
6. UAT sign-off is the written acceptance of the UAT phase by the Client's sponsor. Go-live is the first day of transactions in production after a go decision.

## Defect severity during the project

| Severity | Meaning |
|---|---|
| 1 | A core process cannot be completed, or financial postings are wrong, with no workaround |
| 2 | A core process is seriously degraded, with no acceptable workaround |
| 3 | A function fails and a workaround exists |
| 4 | Cosmetic issue, wording or documentation |

# Client responsibilities

The Customer Responsibilities and RACI Annex gives the full list of Client responsibilities, the RACI by activity and the effect of a late dependency. The Client shall provide:

| Dependency | Needed by |
|---|---|
| Named project manager, key users (one per team), Accounting Manager, System Administrator, compliance officer and data protection officer, available at least 50% during discovery, UAT and cutover | Week 1 |
| Sponsor with authority to approve scope, changes and sign-offs | Week 1 |
| Hosting option, environment set and decision on any transfer of personal data outside the Philippines | Week 1 |
| Insurer list and agreements, commission and referrer rates, product list, chart of accounts and the accountant's mapping decisions, in the Configuration Kit | As stated in the plan for the size (on the critical path) |
| User list with roles, branches and reporting lines | Configuration Kit |
| BIR Authority to Print or CAS registration and the registered serial range of the sales invoices; last numbers used | Before the release to Production |
| BIR EIS enrolment and credentials, where the Client is covered | Before the EIS connector is switched to live |
| AMLC registration, portal access and institution code | Before the go/no-go |
| NPC registration of the data protection officer and the data processing systems | Before the go/no-go |
| Licences of the firm, its officers and agents, and the certificates of authority of the insurers | Compliance set-up |
| Screening lists the Client is entitled to use, and any licence of a PEP list | Compliance set-up |
| Written confirmation by the Client's tax adviser of tax codes, rates, ATC and the wording of invoices and receipts | Before UAT sign-off |
| SMTP mailbox and credentials; contracts and credentials of the partners (banks for payment files, SMS provider, CTPL authentication provider, insurers, payment gateway); COC number series | Integrations phase |
| One recent statement export per bank account | Integrations phase |
| Logo, sign-in picture, signatories and their consent to e-signatures; written permission for any third-party marks | Branding phase |
| Joint custody of the encryption keys with iorta TechNXT, as stated in the chapter Special conditions | Before Production is provisioned |
| In-force policy, open receivable, open claim and trial balance extracts in the Migration Kit | Each mock load and cutover |
| User list for training, training rooms, devices and attendance | Training phase |
| UAT testers and sign-off authority | UAT phase |
| Freeze of the old system and final extract at cutover | Cutover |
| Decisions on the fit-gap register and change requests within 3 Business Days | Throughout |

The week by which each dependency is needed, for each size, and the effect of a late dependency on the go-live date are stated in the iorta TechNXT Dependency Map and Critical Path, baselined at mobilisation.

# Assumptions

1. The implementation is OOTB: the Client uses the delivered screens, workflows, reports and printed documents.
2. The Client provides complete and cleansed data in the delivered templates by the dates in the plan.
3. Decisions in discovery are made within 3 Business Days of each workshop.
4. Workshops and training are delivered on site in Metro Manila or online, in English, during Philippine business hours. On-site work outside Metro Manila is billed with travel at cost.
5. One legal entity and one fiscal year are migrated; opening balances are taken at a single go-live date.
6. The Client uses the delivered roles: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager and Compliance Officer (AML/CFT).
7. Testing uses Dev, SIT (large broker), UAT and the temporary Pre-Prod; production receives the release and the frozen configuration before the cutover rehearsal and is used for business only after the go decision.
8. An import file holds at most 20,000 data rows; larger books are loaded in several files.
9. The man-days in the fee are estimates for the OOTB scope of this SOW. Effort caused by a change of scope or by late Client dependencies is a Change Request.
10. The lead times of regulators and partners stated in the Dependency Map and Critical Path are planning assumptions. Neither Party is responsible for the time a regulator or a partner of the Client takes, but each Party shall act promptly on its own part.
11. The delivered values of the tax codes, the BIR forms and the AML/CFT settings reflect the rules as known at delivery and are confirmed by the Client's tax adviser and compliance officer before go-live.

# Exclusions

The following are outside this SOW and can be quoted through a Change Request:

1. Customisation of screens, workflows, reports, printed documents or the database, and new reports.
2. Integrations other than the delivered connectors, for example with core banking, accounting packages, BIR eFPS or eBIRForms, an IC system, or payment gateways other than PayMongo and Dragonpay; and the partners' own work, certification and fees.
3. Data cleansing, de-duplication and enrichment of the Client's data, and extraction from the old system (data migration beyond the standard templates is an optional service).
4. Migration of closed or expired policies, settled claims, paid receivables, transaction history and documents, and more than one fiscal year of balances.
5. Hardware, end-user devices, networks, browsers and office software.
6. Third-party licences and fees: cloud subscriptions beyond the agreed hosting, mailboxes, payment gateway merchant fees, certificates for Client-owned domains.
7. Regulatory filings and registrations: BIR returns, alphalists and data files, Computerized Accounting System registration, Authority to Print, EIS enrolment, IC reports and licences, NPC registration and breach notifications, AMLC registration and reports. The system prepares them; filing remains with the Client.
12. The content of screening lists and any licence of a list of politically exposed persons; no list content is delivered with iNXT BrokerVerse.
8. Tax, legal, actuarial or audit advice.
9. Translation of the screens.
10. Training beyond the included days and training of users added after go-live.
11. Support after hypercare, which is covered by the Annual Maintenance and Support Agreement or the Subscription.

# Timeline by size

## Durations

| Size | Duration to hypercare exit | Go-live | Hypercare |
|---|---|---|---|
| Small | 8 weeks | Start of week 7 | Weeks 7 and 8 |
| Medium | 12 weeks | Start of week 10 | Weeks 10 to 12 |
| Large | 20 weeks (16-week variant where agreed at mobilisation) | Start of week 15 (week 13 in the 16-week variant) | Weeks 15 to 20 (13 to 16) |
| Enterprise | 26 weeks, or as planned at mobilisation | Start of week 21 | Weeks 21 to 26 |

If the first month-end close falls after the hypercare window, hypercare extends to cover it at no extra charge.

## Key milestones

| Milestone | Small | Medium | Large (20 weeks) | Enterprise (26 weeks) |
|---|---|---|---|---|
| Kick-off held | Week 1 | Week 1 | Week 1 | Week 1 |
| Configuration workbook and fit-gap register signed | Week 2 | Week 3 | Week 4 | Week 6 |
| Configuration complete | Week 4 | Week 6 | Week 10 | Week 13 |
| SIT exit report | Week 4 | Week 7 | Week 12 | Week 16 |
| UAT sign-off and go decision | Week 6 | Week 9 | Week 14 | Week 20 |
| Go-live | Week 7 | Week 10 | Week 15 | Week 21 |
| Hypercare exit and handover | Week 8 | Week 12 | Week 20 | Week 26 |

The detailed plan is the task-level plan of the Implementation Approach and Plan and its workbook for the size, baselined at mobilisation. Planned start date: [date]. Target go-live date: [date].

# Governance

1. **Steering committee:** the Client's sponsor (chair), the Client's project manager, the Accounting Manager and a business head; the iorta TechNXT account manager and project manager, with the head of delivery when a decision on cost or the go-live date is due. Meets every two weeks and at each go/no-go, as in the Implementation Approach and Plan. Approves changes that affect cost or the go-live date.
2. **Weekly status meeting:** both project managers and the key users concerned. Reviews progress, the RAID log and the next week's plan.
3. **RAID log:** kept by the iorta TechNXT project manager and shared with the Client.
4. **Escalation:** project managers, then the steering committee, then the dispute steps of the MSA.

# Fees and milestone payments

## Fee

| Item | Value |
|---|---|
| Base man-days of the size | [Small 70 / Medium 130 / Large 230 / Enterprise 360] |
| Additional lines of business above the included number | [number] x 6 man-days |
| Total man-days | [number] |
| Blended day rate | PHP 16,100.00 |
| Implementation fee (rounded to PHP 10,000.00), excluding VAT | PHP [amount] |
| Discount, if any ([lever]) | PHP [amount] |
| Fee payable, excluding VAT | PHP [amount] |

The fee is fixed for the scope, size and assumptions of this SOW. Under the subscription model, the onboarding fee equals the implementation fee times the onboarding percentage in the Order Form.

## Milestone payments

| Milestone | Share | Amount (PHP, excluding VAT) |
|---|---|---|
| Signing of the Order Form | 40% | [amount] |
| UAT sign-off | 40% | [amount] |
| Go-live | 20% | [amount] |

1. iorta TechNXT invoices on each milestone. Invoices are payable within 30 days, with VAT added and withholding tax handled under the MSA.
2. If a milestone is delayed by more than 30 days for reasons attributable to the Client, iorta TechNXT may invoice the milestone payment on the planned date of the milestone.
3. Optional services in the Order Form (extra training days, legacy data sources, integrations, environments, on-site days) are invoiced on delivery or as quoted.
4. Travel, lodging and meals outside Metro Manila are billed at cost with receipts, if approved in advance by the Client.

# Change control

1. Any change to the scope, plan, size or Deliverables of this SOW, including any gap in the fit-gap register that the Client wants closed by a change rather than by configuration, is handled under the Change Request Procedure.
2. Customisation approved through a Change Request may be scheduled after go-live so that the OOTB go-live date holds.
3. Changes that affect cost or the go-live date need the written approval of the Client's sponsor.
4. Delays caused by late Client dependencies are recorded in the RAID log. If they move the go-live date, the steering committee agrees a revised plan; additional effort is a Change Request.

# Special conditions

1. **Third-party marks.** iorta TechNXT applies a brand pack that carries the name, logo or other marks of a third party (for example the Toyota Insurance Services brand pack) only in the Client's own environments, and only after the Client has given iorta TechNXT a copy of the written permission of the owner of those marks. The Client warrants that the permission covers the use made in iNXT BrokerVerse and indemnifies iorta TechNXT against any claim arising from the use of marks supplied by the Client.
2. **Encryption keys.** Each environment has its own application secrets and encryption keys, including the key that encrypts tax identification, government identification and bank account numbers at rest. Before Production is provisioned, the Parties sign a key custody record that states who holds the escrow copy of each production key under dual control, where it is kept with the backups, and how a key is rotated. A key is never sent by e-mail, ticket or chat. Where the Client hosts, the Client holds the keys and is responsible for keeping them with its backups.
3. **Partner certification.** Each delivered connector is configured and tested in test mode. Its certification with the Client's partner depends on that partner. If a partner has not certified its interface by the go/no-go, go-live proceeds with the fallback recorded in the go/no-go minutes, and the connector is switched to live during hypercare or under the Support Agreement, without a Change Request where the effort stays within the configuration of the delivered connector.
4. **Regulatory registrations.** The registrations listed in Client responsibilities are obligations of the Client towards the regulators. A registration that is not in place by the date of the plan is a late Client dependency under the chapter Change control.
5. **Non-production copies.** A copy of production data is used in a non-production environment only after masking with the delivered masking tool, approved by the Client's data protection officer, except in the temporary Pre-Prod when only persons with production access use it.

# Signatures

| For iorta TechNXT Corp. | For [Client legal name] |
|---|---|
| Signature: ____________________ | Signature: ____________________ |
| Name: [name] | Name: [name] |
| Title: [title] | Title: [title] |
| Date: [date] | Date: [date] |

# Annex A: acceptance certificate

| Field | Entry |
|---|---|
| Project | iNXT BrokerVerse OOTB implementation for [Client legal name] |
| Order Form and SOW | [number] |
| Deliverable or phase | [name] |
| Submitted on | [date] |
| Acceptance criteria | [list from the SOW] |
| Evidence reviewed | [documents, test results, reconciliation reports] |
| Open items (severity 3 or 4) and agreed dates | [items] |
| Decision | [Accepted / Accepted with open items / Not accepted: reasons attached] |
| Accepted by (Client) | [name, title, signature, date] |
| Received by (iorta TechNXT) | [name, title, signature, date] |

# Annex B: lines of business in scope

| # | Line of business | Products and covers | Insurers | Notes |
|---|---|---|---|---|
| 1 | [Motor] | [comprehensive, CTPL, Auto Passenger PA] | [insurers] | [notes] |
| 2 | [Fire] | [products] | [insurers] | [notes] |
| 3 | [line] | [products] | [insurers] | [notes] |
