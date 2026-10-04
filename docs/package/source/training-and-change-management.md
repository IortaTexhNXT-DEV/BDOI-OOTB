---
title: Training Plan
subtitle: BrokerVerse OOTB, role by role
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Compliance officer and DPO curricula; new modules in every role (My Work, Help panel, go-live kits, integrations, branding, distribution, onboarding and screening, BIR forms, payables and fixed assets); schedule for four sizes
acronyms: OOTB=Out of the box; TTT=Train the trainer; UAT=User acceptance test; OR=Official receipt; JV=Journal voucher; PV=Payment voucher; KYC=Know your customer; EDD=Enhanced due diligence; AML/CFT=Anti-money laundering and countering the financing of terrorism; AMLC=Anti-Money Laundering Council; CTR=Covered transaction report; STR=Suspicious transaction report; PEP=Politically exposed person; DPO=Data protection officer; NPC=National Privacy Commission; IC=Insurance Commission; BIR=Bureau of Internal Revenue; EOPT=Ease of Paying Taxes; EIS=Electronic Invoicing System; CAS=Computerized Accounting System; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; COC=Certificate of cover; CTPL=Compulsory Third Party Liability; LOA=Letter of authority; PM=Project manager
---

# Introduction

## Purpose

This plan sets out how the broker's people learn to use BrokerVerse OOTB and how the change in their daily work is managed: the training per role, the curriculum and durations, the train-the-trainer approach, the materials, the assessment, and the change management activities around go-live.

## Approach in brief

- **Role-based.** Training follows the eight delivered roles, plus a module for the broker's data protection officer. Each user is trained in the screens of the role the user will hold, as the menus differ by role.
- **Train the trainer.** iorta TechNXT trains the broker's key users. The key users then train their teams, with iorta TechNXT present at the first sessions. The System Administrator, the Accounting Manager, the compliance officer and the DPO are trained by iorta TechNXT directly.
- **Hands on.** At least two thirds of each session is practice on the training environment, following the steps of the user manual.
- **Assessed.** Every user completes a practical assessment before receiving production access.
- **Just in time.** End-user training takes place in the weeks before go-live, so the learning is fresh on day one.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 03 October 2026 | Initial issue: seven roles, curriculum, train-the-trainer, assessment, change management |
| 1.1 | 04 October 2026 | Compliance Officer (AML/CFT) curriculum and assessment; DPO module; new modules for My Work, the Help panel, masking of personal identifiers, the go-live configuration and migration kits, integrations and message templates, theme and branding and e-signatures, distribution (lead assignment, channels, dealer programmes, fleets, open covers, facultative, campaigns, Report Builder), client onboarding and screening, cover notes, computed cancellations, CTPL authentication, claim document checklist and motor repairs, post-dated cheques and instalments, bank payment files, BIR forms and files, EOPT invoices, EIS and CAS books, payables and fixed assets, insurer overrides, IC registers and complaints; schedule for small, medium, large and enterprise brokers; the note on screens missing from the manual removed (the manual now covers them) |

## Roles trained

| Role in BrokerVerse | Who in the broker | Role material |
|---|---|---|
| System Administrator (Super Admin Access) | IT or system owner; at most a few people | `BrokerVerse_System_Administrator_Guide.pptx`; manual chapters System Administrator and Go-Live Data Load |
| Sales & Marketing (Account Executive) | Account executives, marketing staff | `BrokerVerse_Sales_and_Marketing_Guide.pptx`; manual chapters Sales & Marketing and Distribution, programmes and products |
| Processing Team (Placement & Policy Processing) | Placement, underwriting support and policy processing staff | `BrokerVerse_Processing_Team_Guide.pptx`; manual chapter Processing Team |
| Operations (Client Servicing) | Client servicing and customer care staff | `BrokerVerse_Operations_Guide.pptx`; manual chapter Operations |
| Claims | Claims officers and approvers | `BrokerVerse_Claims_Guide.pptx`; manual chapter Claims |
| Accounting | Billing, collection, disbursement, remittance, tax and general ledger staff | `BrokerVerse_Accounting_Guide.pptx`; manual chapter Accounting |
| Accounting Manager | Finance manager, controller; inherits Accounting | `BrokerVerse_Accounting_Manager_Guide.pptx`; manual chapter Accounting Manager |
| Compliance Officer (AML/CFT) | The broker's compliance officer and deputy | No role deck in this release: manual chapters Compliance Officer (AML/CFT) and Compliance |
| Data protection officer (no own role) | The DPO, working through the privacy permissions of the System Administrator or Operations role | Manual sections Data privacy, Personal data breach register and masking of personal identifiers |

# Training materials

| Material | Use |
|---|---|
| BrokerVerse User Manual (`docs/package/05_Delivery/BrokerVerse_User_Manual.pdf`) | Reference for every screen, with one chapter per role; the end-to-end business process; module reference; reports, dashboards, schedules and notifications; troubleshooting, FAQ and glossary |
| Help panel in the application | **F1**, or **?** outside a text box, opens the manual section of the screen in use, the user manual download, the support contacts and **Raise a support ticket** |
| Role decks (`docs/decks`) | One PowerPoint per role for the seven original roles |
| Getting started guide (`docs/onboarding/GETTING_STARTED.md`) | First sign-in, password rules, two-step verification, menus per role, how to ask for help; handed to every user |
| UAT scripts (`docs/onboarding/UAT_SCRIPTS.md`) and the broker's UAT scenarios | Basis for the practical exercises and the assessment |
| Go-live kits and upload templates | Exercises for users who load data (System Administrator, Accounting, Sales & Marketing, Processing Team) |
| Training environment | UAT, or a training copy, with training users (one per trainee). Training uses the configuration accepted in UAT and either the delivered sample data or data masked with the masking tool; never unmasked production data |
| Exercise book (prepared by the key users with iorta TechNXT) | The broker's own examples: products, insurers, a typical motor and fire risk, a typical month-end, a juridical client with owners, a screening hit |

Training users and their passwords are handed to trainees privately, as for production users. Trainees never use production for practice.

# Curriculum by role

Durations are in hours of classroom time; a day is 7 hours. The chapters named are those of the BrokerVerse User Manual.

## All roles: common module (1.5 hours)

| Topic | Content | Manual |
|---|---|---|
| Signing in | First sign-in, password change, password rules (8 characters, upper and lower case, digit, symbol, history 5, expiry 90 days), lockout after 5 wrong passwords, idle sign-out after 30 minutes, forgotten password; two-step verification | Getting started |
| Finding your way | The side menu by role and its sections, dashboards, notifications, lists, search and filters; the Help panel (F1) | Getting started |
| My Work | My Items, My Team (by reporting line), My Tasks, Calendar: the daily worklist of every user | Operations, My Work |
| The broking cycle | The steps from lead to month-end and who does each; maker-checker points | The business process end to end |
| Personal data | Masked identifiers for roles without `view:pii`; what is recorded when a value is revealed; consent before a message | Data privacy |
| Getting help | Key user first, then the System Administrator; what to put in a report: screen, record number, time, request ID; Raise a support ticket | Getting started; Troubleshooting |

## System Administrator (24.5 hours, 3.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| User management | 3 | Users, roles, role permissions (including `view:pii`), temporary passwords, locking, two-step verification resets; User Access Matrix, Authority Matrix, Delegations, Segregation of Duties, Access Reviews; reporting lines | System Administrator |
| Organisation, letterhead and branding | 2 | Company, branches, departments; Theme and Branding (theme, sign-in page, documents, e-mail, name and images); signatories and e-signatures, document signature mapping; brand packs | System Administrator |
| Masters | 2 | Insurance, location (PSGC), employee and finance masters; operational masters | System Administrator |
| Go-Live Data Load | 3.5 | Configuration and migration kits: download, upload and validate, errors workbook, load, history, reconciliation, promotion of configuration with Current data, go-live lock | Go-Live Data Load |
| Configuration and numbering | 3 | Master > Configuration groups and the effect of a change; Document Numbering and the invoice serial range | System Administrator |
| Schedules, E-mail Outbox, integrations | 3 | The scheduled jobs, Run now, history; the outbox; connectors, test mode and live, outbox and inbox; message templates and consent; insurer integration | System Administrator |
| Data privacy | 1 | Consent register, data subject requests, export and anonymisation; masking settings | System Administrator |
| Posting rules and account determination (overview) | 1 | Account roles, posting rules, Simulate, Configuration Approvals | Accounting Manager |
| Audit Trail and first-line support | 2.5 | Audit Trail filters; access reviews; triage of user reports; raising tickets to iorta TechNXT | System Administrator |
| Practice | 2 | The exercise book | |

## Sales & Marketing (14 hours, 2 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Dashboards and My Work | 0.5 | Executive Dashboard, Sales Dashboard; quotations with the customer | Sales & Marketing |
| Prospects and lead assignment | 2 | Create, edit, bulk upload; lead assignment rules, team view, reassignment | Sales & Marketing; Distribution |
| Quotations | 3 | Motor quotation: vehicle class, CTPL, covers, taxes; acceptance rules (refer, decline, loading); sending for customer approval; Quick Quote and Compare Insurers for package products | Sales & Marketing |
| Requests for quotation | 0.5 | Passing a commercial risk to the Processing Team for a broker slip | Processing Team |
| Clients and payment capture | 1.5 | Onboard client before the first policy (identification, PEP, expected business); Proceed to Payment; Accounting verifies | Operations; Sales & Marketing |
| Distribution | 2 | Distribution channels, dealer programmes and their sales uploads, comparison reports, campaigns and segments | Distribution, programmes and products |
| Renewals and reports | 2 | Renewal Queue, At-Risk Policies, Negotiations; Commission Dashboard; production reports; Report Builder | Sales & Marketing; Distribution |
| Practice | 1 | The exercise book | |

## Processing Team (24.5 hours, 3.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Dashboards and placement journey | 1.5 | Processing Dashboard; journey per line of business | Processing Team |
| Requests for quotation (broker slips) | 3 | New broker slip, submit to market, record offers and declines, compare offers; insurer authority warnings | Processing Team; Compliance |
| Quotation and placement slips, co-insurance | 4 | Quotation slip from the chosen offer; firm order to the lead and co-insurers, shares totalling 100%, confirmations | Processing Team |
| Policy issue | 3 | Issue from the placement slip or the motor quotation; KYC, screening and EDD checks; vehicle identifiers; Record Issued Policy; insurer issuance requests | Processing Team; System Administrator (Insurer integration) |
| Endorsements and renewals | 2.5 | Endorsement types and premium recalculation; approving renewal terms | Processing Team |
| Product Configurator | 3.5 | Product templates and the governing template, coverage builder, rating factors, acceptance rules with refer, decline and loading and the authority to override, document templates with merge fields, market and risk mapping | Processing Team (Product Configurator) |
| Fleets, open covers, facultative | 2 | Fleet schedules, marine open covers (certificates, declarations), facultative placements | Distribution, programmes and products |
| Reinsurance and reports | 2 | Treaties, cession tracking, claims recovery; placement and production reports | Processing Team |
| Practice | 1.5 | The exercise book | |

## Operations (17.5 hours, 2.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| My Work | 1 | My Items, My Team, My Tasks, Calendar; expiring policies, pending payments and quotations | Operations |
| Clients and onboarding | 2.5 | Onboard client (individual and juridical), signatories and beneficial owners, KYC documents; preparing EDD reviews | Operations; Compliance Officer |
| Policies, endorsement requests, cover notes | 2.5 | Policy details and documents; endorsement requests; cover notes (binders) | Operations |
| Cancellations | 1 | Computed return premium: pro-rata and short-period | Operations |
| Payments | 1.5 | Capturing the client's payment with proof | Operations |
| CTPL authentication | 1.5 | COC series, authentication at issue, Authenticate now, vehicle details, enter code from the provider portal, unauthenticated report | Operations |
| Renewals | 1.5 | Renewal Policy, renewal notices, lapse management | Operations |
| Complaints, licences and privacy | 2.5 | Complaints register and letters; licence register and fit and proper; consent, data subject requests, breach register | Compliance; System Administrator (Data privacy) |
| Practice | 2 | The exercise book | |

## Claims (10.5 hours, 1.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Registering a claim | 1.5 | New claim on an active policy; checks on loss date and unpaid premium | Claims |
| Documents, checklist and letters | 1.5 | Claim document checklist, uploads, acknowledgement and other claim letters | Claims |
| Motor repairs | 1.5 | Repair shops, estimates, letters of authority | Claims |
| Insurer follow-up | 1 | Insurer reference, adjuster report, claim status from the insurer, SMS claim updates | Claims |
| Settlement | 1.5 | Assessment and settlement, maker-checker approval; screening of the payee; settlement paid through the broker | Claims |
| Complaints, dashboard and reports | 1 | Logging and resolving complaints about claims; Claims Dashboard, recovery, reports | Compliance; Claims |
| Practice | 1 | The exercise book | |

## Accounting (35 hours, 5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Receipts and payment verification | 3 | Official receipts against open bills, verifying captured payments, bulk receipts, returned cheques | Accounting |
| Collections, credit control, instalments, post-dated cheques | 3 | Collections and ageing; instalment plans and separate instalment invoices, premium warranty, credit limits; post-dated cheques | Accounting |
| Disbursement, payables, petty cash | 3 | Payment vouchers and cheques; supplier invoices and accounts payable; petty cash | Accounting |
| Bank payment files | 1.5 | Batches, approval, write and download, status file, record result; payee bank accounts | Accounting |
| Remittance and direct bill | 4 | Remittance processing and approval levels, electronic transfer records, reconciliation; direct bill debit notes | Accounting |
| Commission, overrides, incentives | 3 | Referrer accounts, payout after full collection, withholding, licence check; overriding and contingent commission from insurers; incentives | Accounting |
| Journals, matching, fixed assets | 3.5 | Journal, correction and reversal JV, open entry matching, Accounting Query; fixed assets and depreciation | Accounting |
| Bank and insurer reconciliation | 3 | Statement import, matching, bank items, reconciliation; insurer statements | Accounting |
| Tax and BIR | 4.5 | Tax codes; Form 2307; VAT Summary, SAWT, QAP, SLSP; withholding returns 0619-E and 1601-EQ with filing records; 1604-E; 2551Q; DAT files; sales invoices (EOPT) and payment acknowledgements; E-Invoicing (EIS); CAS books and documents | Accounting |
| Period end | 2 | Period Management, Month-End Close run and checklist, recurring journals, financial statements | Accounting |
| Reports and practice | 3 | Financial reports, Report Builder; the exercise book | Accounting; Distribution |

## Accounting Manager (10.5 hours, 1.5 days, after the Accounting curriculum)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Approvals | 1.5 | What only the Accounting Manager approves; maker-checker; delegations; bank payment batches within the authority limit | Accounting Manager |
| Month-end and year-end close | 2 | Reviewing and approving the close run; year-end close and carry forward | Accounting Manager |
| Period control | 1 | Reopening a period with remarks; soft-closed periods | Accounting Manager |
| Bank and insurer reconciliation approval; credit control decisions | 1 | Approving and locking reconciliations; credit control items | Accounting Manager |
| Configuration approvals | 1 | Account determination and posting rule changes; tax codes and GL accounts | Accounting Manager |
| Supplier invoices and fixed assets | 1 | Approving supplier invoices; asset register review | Accounting Manager; Accounting |
| BIR returns and CAS books review | 1.5 | Reviewing the returns and their reconciliation before filing; filing records; printed books | Accounting |
| IC annual statement and production report | 1.5 | Checks and confirmations, account mapping, workbook; production report by insurer and line | Compliance |

## Compliance Officer (17.5 hours, 2.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| The programme in BrokerVerse | 1 | Role, menus, daily and periodic tasks; AML Dashboard | Compliance Officer |
| Client due diligence and risk rating | 2 | Onboarding of individual and juridical clients, signatories and beneficial owners; risk factors and score; KYC status; override with reason | Compliance Officer; Operations |
| EDD reviews and KYC refresh | 1.5 | Preparing, submitting, approving or rejecting an EDD review; refresh periods and Complete KYC refresh | Compliance Officer |
| Screening | 2 | Screening events; hits: clear, escalate, confirm; Screen a name; screening lists, versions and rescreen; the screening provider | Compliance Officer |
| Transaction alerts and AML cases | 2 | Monitoring rules and alerts; closing with reason; CTR and STR cases; due dates in working days | Compliance Officer |
| AMLC reports | 1.5 | Generate CTR file, report files, download, record filing | Compliance Officer |
| AML settings | 2 | General settings, risk factors, monitoring rules; confirming the delivered values | Compliance Officer |
| Insurance Commission registers | 1.5 | Licence register and reminders, commission check; fit and proper records; insurer authority | Compliance |
| Complaints and IC reports | 1.5 | Complaints register, deadlines, letters, escalation, regulator report; IC annual statement and production report (with the Accountant) | Compliance |
| Breach register (with the DPO) | 1 | Logging, assessment, NPC notification, data subjects, annual report | Compliance |

## Data protection officer (3.5 hours, half a day)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Consent and data subject requests | 1.5 | Consent register; logging a request, due dates, export, anonymisation dry run and its limits (retention, AML records) | System Administrator (Data privacy) |
| Personal data breach register | 1 | 72-hour clock, assessment criteria, NPC notification and data subjects, reminders, annual report | Compliance |
| Masking and copies | 1 | Masking by role (`view:pii`), reveal modes and their audit; approval of masked copies for training, testing and the rehearsal | Getting started; Data masking procedure |

## Summary of durations

| Role | Key users (TTT) or direct training | End users |
|---|---|---|
| System Administrator | 3.5 days | Not applicable (trained by iorta TechNXT) |
| Sales & Marketing | 2 days plus 0.5 day trainer skills | 2 days |
| Processing Team | 3.5 days plus 0.5 day trainer skills | 3.5 days |
| Operations | 2.5 days plus 0.5 day trainer skills | 2.5 days |
| Claims | 1.5 days plus 0.5 day trainer skills | 1.5 days |
| Accounting | 5 days plus 0.5 day trainer skills | 5 days |
| Accounting Manager | 1.5 days after Accounting | Not applicable (trained by iorta TechNXT) |
| Compliance Officer | 2.5 days | Not applicable (trained by iorta TechNXT) |
| Data protection officer | 0.5 day | Not applicable (trained by iorta TechNXT) |

The training days included in the implementation fee are those of the size (Small 4, Medium 6, Large 10, Enterprise 15 days of iorta TechNXT trainers). Where the roles the broker uses need more trainer days than included, the additional days are agreed at mobilisation as an optional service.

# Train the trainer

## Who

One key user per team (two for teams of more than 15 users), named at mobilisation. Key users take part in discovery and UAT, so they reach training already knowing the configuration.

## Programme

1. **Role curriculum** delivered by an iorta TechNXT consultant, on the training environment with the broker's configuration.
2. **Trainer skills** (half a day): structuring a session, demonstrating then letting trainees practise, handling questions, using the exercise book and the Help panel, running the assessment.
3. **Exercise book** prepared by each key user with the consultant: the broker's own examples for each module.
4. **Teach-back**: each key user delivers one module to the consultant and peers and gets feedback.
5. **Co-delivery**: the key user leads the first end-user session with the consultant in the room.
6. **Solo delivery**: the key user runs the remaining sessions; the consultant is on call.

## Exit criteria for a key user

- Passed the role assessment with at least 90%.
- Delivered a teach-back to the consultant's satisfaction.
- Knows how to raise a support ticket and what to include.

# Delivery

## Schedule

The weeks follow the task-level plan of the Implementation Approach and Plan.

| Plan | Train the trainer | Compliance officer and DPO | End-user training |
|---|---|---|---|
| Small (8 weeks) | Weeks 4 and 5 | Week 4 | Weeks 5 and 6 |
| Medium (12 weeks) | Week 7 | Week 6 | Weeks 8 and 9 |
| Large (20 weeks) | Weeks 10 and 11 | Week 8 | Weeks 12 to 14 (head office, then branches) |
| Enterprise (26 weeks) | Weeks 13 to 15 | Week 10 | Weeks 16 to 19 |

End-user training is on the critical path of a medium broker and within one day of it for small and large brokers: a late train-the-trainer moves the go-live.

## Sessions

- At most 10 trainees per session, each with a computer and a training user for the role.
- Sessions run on site or online in Philippine business hours, in English; key users may explain in Filipino. The screens are in English in this release.
- Users holding two roles attend both curricula.
- Attendance is recorded per session; a missed module is taken in a catch-up session before go-live.
- Users who join after go-live are trained by their key user with the same curriculum and assessment.

## Training environment readiness

Before each training wave: training users created per trainee, configuration equal to the UAT-accepted configuration (promoted with the configuration kit), branding applied, training data present (prospects, quotations, policies, open bills, a bank statement to reconcile, a juridical client, a screening list with a test entry), connectors in test mode, e-mail and SMS going to internal addresses only, data masked or synthetic, and the exercise book printed.

# Assessment

## Method

Each user completes a practical assessment at the end of the role curriculum, on the training environment, without help. It uses the scenarios of `UAT_SCRIPTS.md` for the role and the broker's UAT scenarios, with the broker's data, plus a short written check.

| Role | Practical tasks | Written check |
|---|---|---|
| System Administrator | A1 to A7; validate and load a configuration kit with one error corrected | 10 questions |
| Sales & Marketing | S1, S3, S4, S5, S6; onboard a client | 10 questions |
| Processing Team | P1 to P6; a quotation referred by an acceptance rule | 10 questions |
| Operations | O1 to O5; onboard a juridical client with an owner; authenticate a COC | 10 questions |
| Claims | C1 to C5; complete a document checklist | 10 questions |
| Accounting | F1 to F8; a bank payment batch; a sales invoice | 15 questions |
| Accounting Manager | M1 to M5; review a withholding return | 10 questions |
| Compliance Officer | Decide a screening hit; approve an EDD review; close an alert or open an STR case; generate a CTR file; record a licence | 10 questions |
| Data protection officer | Log and assess a breach; complete a data subject request | 5 questions |

## Pass criteria

- End users: at least 80% overall, and every task marked critical for the role done correctly. Critical tasks: issuing an official receipt (Accounting), approving as checker (Accounting Manager), issuing a policy with KYC (Processing Team), registering a claim (Claims), capturing a payment (Operations, Sales & Marketing), creating a user with the right role (System Administrator), deciding a screening hit (Compliance Officer).
- Key users, the System Administrator, the Accounting Manager and the compliance officer: at least 90%.
- A user who does not pass attends a refresher and takes the assessment again before receiving production access.

## Evaluation of the training

Each trainee fills in a short evaluation (content, pace, trainer, materials, confidence to do the job). Key users and the iorta TechNXT consultant review the results after each wave and adjust the next sessions.

# Change management

## What changes for users

The main changes users meet are rules the system now enforces. Each is explained in training and in the go-live communication.

| Change | Who is affected | What it means in daily work |
|---|---|---|
| Only Accounting posts official receipts | Sales & Marketing, Operations, Processing Team, Accounting | Other roles record how the client paid; Accounting verifies and issues the receipt |
| Maker-checker | Accounting, Accounting Manager, Claims, Processing Team, Compliance Officer | The person who enters a quotation, voucher, remittance, settlement, journal, payment batch, EDD review or close cannot approve it |
| Client onboarding and screening before the first policy | Sales & Marketing, Operations, Processing Team | Identification, PEP and expected business are recorded; a High-risk client needs an approved EDD review and a client with an open screening hit gets no policy, refund or claim payment |
| KYC and vehicle identifiers before a motor policy | Sales & Marketing, Processing Team, Operations | Government ID, chassis, motor and plate or MV file number are needed before issue |
| CTPL authentication | Operations, Processing Team | Every CTPL cover is authenticated before release; the COC number and code print on the schedule |
| Acceptance rules from the Product Configurator | Sales & Marketing, Processing Team | A risk can be referred, declined or loaded; an override needs the authority |
| Placement journey per line | Processing Team, Sales & Marketing | Fire, IAR, marine, casualty and engineering need a placement slip confirmed by every insurer before issue |
| Insurer authority check | Processing Team | A warning (or a block, once switched) when an insurer's IC certificate of authority is expired or missing |
| Commission paid after full collection and to licensed agents | Accounting, Sales & Marketing | Commission becomes payable only when the premium is fully collected, a bank account is on file and the agent's licence is in force |
| Sales invoices under the EOPT Act | Accounting | Commission and fees are invoiced on the sales invoice series; receipts are supplementary documents |
| Complaints deadlines | Operations, Claims, Sales & Marketing | Every complaint is logged, acknowledged and resolved within the configured days |
| Masked personal identifiers | Every role without `view:pii` | TIN, ID numbers, mobile, e-mail, bank account and birth date show partially masked; a reveal is recorded |
| My Work | Everyone | One worklist per user and per team replaces the former Open Items screen |
| Period control | Accounting, Accounting Manager | Closed periods take no postings; soft-closed periods take postings only from the Accounting Manager |
| Security | Everyone | Personal user IDs, password rules, two-step verification for the roles set, automatic sign-out after 30 minutes idle; every action is in the Audit Trail |

## Stakeholders and communication

| Audience | Message | Channel | When |
|---|---|---|---|
| Management | Why the change, what it delivers, what is asked of the teams | Steering committee, management meeting | Mobilisation, monthly |
| Team leaders | Timeline, their key user, release of staff for training and UAT | Briefing by the broker PM | Mobilisation, before training |
| All users | What changes, training dates, go-live date, where to get help (Help panel, key user) | E-mail from the sponsor, team meetings, getting started guide | Four weeks and one week before go-live, go-live day |
| Insurers | Go-live date, changes in documents (remittance advice, debit notes, sales invoices), API or file contacts | Letter or e-mail from Accounting | Two weeks before go-live |
| Banks and providers | Go-live date of payment files, SMS, CTPL authentication; contacts during hypercare | E-mail from the IT head | Two weeks before go-live |
| Clients (where affected) | New receipt, invoice or billing statement layout, payment links, SMS notices | Account executives | At go-live |

## Readiness

The broker PM checks readiness two weeks before go-live and again at the go/no-go: users trained and assessed per team, key users in place, user IDs issued, the compliance officer and DPO trained, procedures updated for the changes above, and team leaders' confirmation that their teams are ready. Gaps are actions in the RAID log.

## Support at go-live and reinforcement

- Key users act as floor walkers in their teams during the first week; iorta TechNXT consultants are on site or on call during hypercare.
- A daily 15-minute check-in in the first week collects questions; answers go into the knowledge base and a short tips note to users.
- Refresher sessions are offered at the end of the first month, before the first month-end close for Accounting, before the first BIR and AMLC filings, and on topics the support tickets show users find hard.
- Key users keep the exercise book and train newcomers with the same curriculum and assessment.
