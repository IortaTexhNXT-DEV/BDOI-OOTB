---
title: Statement of Work
subtitle: OOTB implementation
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: ATP=Authority to Print; BIR=Bureau of Internal Revenue; CR=Change request; IC=Insurance Commission; LOB=Line of business; MSA=Master Services Agreement; OOTB=Out of the box; PHP=Philippine peso; RAID=Risks, assumptions, issues and dependencies; SIT=System integration test; SOW=Statement of work; UAT=User acceptance testing; VAT=Value-added tax
---

# About this template

> Template for discussion; subject to review by the parties' legal counsel.

This Implementation Statement of Work (the **SOW**) describes the one-time implementation of iNXT BrokerVerse OOTB for the Client: the scope, phases, Deliverables, acceptance, responsibilities, assumptions, exclusions, timeline, fees and change control. It forms part of the Order Form no. [number] under the Master Services Agreement (the **MSA**) dated [date] between iorta TechNXT Corp. (**iorta TechNXT**) and [Client legal name] (the **Client**). Under the subscription model, this SOW describes the onboarding. Capitalised terms have the meaning given in the MSA. Text in [square brackets] is a placeholder or an option.

# Scope

## Objective

Bring iNXT BrokerVerse OOTB into production use for the Client's non-life broking and accounting operations by configuration and master data, without changes to the code, and hand it over to production support after the first month-end close.

## In scope

1. Configuration of the delivered system for the Client: company, letterhead, branches and departments; users and the seven delivered roles; insurers with credit and remittance terms; lines of business, products, covers and vehicles; product templates, motor tariff, rating, acceptance rules and approval workflows; commission rules and referrer sharing; premium taxes and LGU rates; tax codes with BIR ATC; chart of accounts, account determination and posting rules; document numbering; business rules, limits, maker-checker switches, security policy and e-mail texts.
2. Configuration of [number] lines of business: [list, for example motor, fire, marine cargo, engineering, casualty, bonds]. The price includes the number of lines of business of the Client's size (Small 5, Medium 8, Large 12, Enterprise 16); additional lines are priced at 6 man-days each.
3. Data migration of open items with the delivered upload templates: in-force policies, open receivables, amounts due to insurers, opening trial balance, masters (clients, insurers, products, referrers, users), as at the go-live date, for one legal entity and one fiscal year.
4. Set-up of the delivered integrations: outgoing e-mail through the Client's SMTP mailbox; bank statement formats for the Client's bank accounts; the delivered payment gateways (PayMongo and Dragonpay) in sandbox and production, where the Client has a merchant account.
5. Environments: a test (UAT) and a production environment, hosted as stated in the Order Form.
6. Training: train-the-trainer for key users for the training days of the Client's size (Small 4, Medium 6, Large 10, Enterprise 15), and support of end-user training run by the key users.
7. System integration test, UAT support, cutover, go-live support and hypercare until the first month-end close.

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

The size is confirmed at mobilisation once data volumes are known. A change of size is handled through the Change Request Procedure.

# Approach and phases

The implementation follows the iorta TechNXT Implementation Approach and Plan: configure, do not customise; data drives the timeline; key users own the result; every data load uses the delivered templates and is rehearsed at least twice; every acceptance is written.

| # | Phase | What happens |
|---|---|---|
| 1 | Mobilisation | Kick-off, team and governance, plan confirmed, data requests issued, environments ordered |
| 2 | Discovery and fit-gap | Walk-through of each process on the delivered system; configuration decisions; fit-gap register limited to configuration |
| 3 | Environment set-up | Test (UAT) and production environments, e-mail account, backups, monitoring |
| 4 | Configuration | Masters, products and rates, numbering, chart of accounts, posting rules, approvals, security |
| 5 | Data migration | Extraction by the Client, mapping to the templates, mock loads, reconciliation |
| 6 | Integrations | E-mail, bank statement files, payment gateway |
| 7 | Training | Train-the-trainer for key users, then end-user training per role |
| 8 | System integration test | End-to-end runs across roles with the configured data |
| 9 | User acceptance test | Key users run the UAT scripts with the Client's own data |
| 10 | Cutover | Final extract, final loads, reconciliation, go/no-go |
| 11 | Go-live | First day of transactions in iNXT BrokerVerse |
| 12 | Hypercare | Close support by the project team until the first month-end close is done |

# Deliverables and acceptance

## Deliverables and acceptance criteria

| Phase | Deliverables | Acceptance criteria |
|---|---|---|
| Mobilisation | Project charter, baselined plan, RAID log, data request list, governance calendar | Charter and plan signed by both project managers and the sponsor |
| Discovery and fit-gap | Configuration workbook, fit-gap register | Every process walked through; every register line classed and owned; signed by the process owners |
| Environment set-up | Test and production environments, environment sheet | Smoke test passed on each; one restore test done |
| Configuration | Configured test environment; configuration workbook updated | Each workbook item set and checked; test quotation premiums and taxes agree with manual calculations |
| Data migration | Mapping sheets, filled templates, load logs, reconciliation reports for each mock load | Counts and totals agree within the agreed tolerance (default: exact); trial balance as at go-live agrees with the old system |
| Integrations | E-mail, bank statement formats, payment gateway set up | Password reset e-mail and quotation approval link received; one statement per bank account imported; one sandbox payment receipted |
| Training | Training schedule, attendance lists, assessment results | Every user trained in the role before go-live; key users pass the assessment |
| SIT | SIT plan, results, defect log, SIT exit report | All end-to-end flows passed; no open severity 1 or 2 defect |
| UAT | UAT results per script, defect log, UAT sign-off | All UAT scripts passed or accepted with a workaround; sign-off by each process owner and the sponsor |
| Cutover | Cutover checklist, final reconciliation, go/no-go minutes | Go/no-go criteria of the Data Migration and Cutover Plan met |
| Go-live | Production in use; go-live communication | Users signed in and transacting; first receipts, remittances and bank imports processed |
| Hypercare | Hypercare log, first month-end close support, handover pack | No open severity 1 or 2 issue; first close completed; handover accepted by production support and the System Administrator |

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
| Named project manager, key users (one per team) and Accounting Manager, available at least 50% during discovery, UAT and cutover | Week 1 |
| Sponsor with authority to approve scope, changes and sign-offs | Week 1 |
| Insurer list and agreements, commission and referrer rates, product list | End of discovery |
| Chart of accounts and the accountant's mapping decisions | Start of ledger configuration |
| BIR Authority to Print or registered series for official receipts and invoices; last numbers used | Configuration of document numbering |
| SMTP mailbox and credentials; payment gateway merchant account and credentials | Integrations phase |
| One recent statement export per bank account | Integrations phase |
| In-force policy, open receivable and trial balance extracts in the templates | Each mock load and cutover |
| User list with roles and e-mail addresses | Two weeks before training |
| Training rooms, devices and attendance | Training phase |
| UAT testers and sign-off authority | UAT phase |
| Freeze of the old system and final extract at cutover | Cutover |
| Decisions on the fit-gap register and change requests within 3 Business Days | Throughout |
| Review of tax codes, rates and BIR working papers by the Client's tax adviser | Configuration phase |

# Assumptions

1. The implementation is OOTB: the Client uses the delivered screens, workflows, reports and printed documents.
2. The Client provides complete and cleansed data in the delivered templates by the dates in the plan.
3. Decisions in discovery are made within 3 Business Days of each workshop.
4. Workshops and training are delivered on site in Metro Manila or online, in English, during Philippine business hours. On-site work outside Metro Manila is billed with travel at cost.
5. One legal entity and one fiscal year are migrated; opening balances are taken at a single go-live date.
6. The Client uses the delivered roles: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting and Accounting Manager.
7. Testing uses the test environment; production is used only after the go decision.
8. An import file holds at most 20,000 data rows; larger books are loaded in several files.
9. The man-days in the fee are estimates for the OOTB scope of this SOW. Effort caused by a change of scope or by late Client dependencies is a Change Request.

# Exclusions

The following are outside this SOW and can be quoted through a Change Request:

1. Customisation of screens, workflows, reports, printed documents or the database, and new reports.
2. New integrations, for example with insurer systems, core banking, bank payment file generation, SMS gateways, accounting packages, BIR eFPS or eBIRForms, LTO or IC systems, and payment gateways other than PayMongo and Dragonpay.
3. Data cleansing, de-duplication and enrichment of the Client's data, and extraction from the old system (data migration beyond the standard templates is an optional service).
4. Migration of closed or expired policies, settled claims, paid receivables, transaction history and documents, and more than one fiscal year of balances.
5. Hardware, end-user devices, networks, browsers and office software.
6. Third-party licences and fees: cloud subscriptions beyond the agreed hosting, mailboxes, payment gateway merchant fees, certificates for Client-owned domains.
7. Regulatory filings and registrations: BIR returns and alphalists, Computerized Accounting System registration, Authority to Print, IC reports, NPC registration, AMLC reports.
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
| Large | 16 to 20 weeks | Start of week 13 (16-week plan) or week 15 (20-week plan) | To week 16 or week 20 |
| Enterprise | 20 weeks or more | Agreed at mobilisation | 4 to 6 weeks, or as planned at mobilisation |

If the first month-end close falls after the hypercare window, hypercare extends to cover it at no extra charge.

## Key milestones

| Milestone | Small | Medium | Large (20 weeks) |
|---|---|---|---|
| Kick-off held | Week 1 | Week 1 | Week 1 |
| Configuration workbook and fit-gap register signed | Week 2 | Week 3 | Week 5 |
| Mock load 1 reconciled | Week 3 | Week 5 | Week 7 |
| SIT exit report | Week 4 | Week 7 | Week 11 |
| UAT sign-off and go decision | Week 6 | Week 9 | Weeks 13 to 14 |
| Go-live | Week 7 | Week 10 | Week 15 |
| Hypercare exit and handover | Week 8 | Week 12 | Week 20 |

The detailed weekly plan is the plan of the Implementation Approach and Plan for the size, baselined at mobilisation. Planned start date: [date]. Target go-live date: [date].

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
