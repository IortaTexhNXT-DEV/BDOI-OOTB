---
title: Training Plan
subtitle: BrokerVerse OOTB, role by role
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; TTT=Train the trainer; UAT=User acceptance test; OR=Official receipt; JV=Journal voucher; PV=Payment voucher; KYC=Know your customer; BIR=Bureau of Internal Revenue; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; CTPL=Compulsory Third Party Liability; PM=Project manager
---

# Introduction

## Purpose

This plan sets out how the broker's people learn to use BrokerVerse OOTB and how the change in their daily work is managed: the training per role, the curriculum and durations, the train-the-trainer approach, the materials, the assessment, and the change management activities around go-live.

## Approach in brief

- **Role-based.** Training follows the seven delivered roles. Each user is trained in the screens of the role the user will hold, as the menus differ by role.
- **Train the trainer.** iorta TechNXT trains the broker's key users. The key users then train their teams, with iorta TechNXT present at the first sessions.
- **Hands on.** At least two thirds of each session is practice on the test environment with training data, following the steps of the user manual.
- **Assessed.** Every user completes a practical assessment before receiving production access.
- **Just in time.** End-user training takes place in the two weeks before go-live, so the learning is fresh on day one.

## Roles trained

| Role in BrokerVerse | Who in the broker | Role decks in `docs/decks` |
|---|---|---|
| System Administrator (Super Admin Access) | IT or system owner; at most a few people | `BrokerVerse_System_Administrator_Guide.pptx` (22 slides) |
| Sales & Marketing (Account Executive) | Account executives, marketing staff | `BrokerVerse_Sales_and_Marketing_Guide.pptx` (18 slides) |
| Processing Team (Placement & Policy Processing) | Placement, underwriting support and policy processing staff | `BrokerVerse_Processing_Team_Guide.pptx` (22 slides) |
| Operations (Client Servicing) | Client servicing and customer care staff | `BrokerVerse_Operations_Guide.pptx` (19 slides) |
| Claims | Claims officers and approvers | `BrokerVerse_Claims_Guide.pptx` (18 slides) |
| Accounting | Billing, collection, disbursement, remittance and general ledger staff | `BrokerVerse_Accounting_Guide.pptx` (22 slides) |
| Accounting Manager | Finance manager, controller; inherits Accounting | `BrokerVerse_Accounting_Manager_Guide.pptx` (19 slides) |

# Training materials

| Material | Use |
|---|---|
| BrokerVerse User Manual (`docs/package/05_Delivery/BrokerVerse_User_Manual.pdf`) | Reference for every screen, with one chapter per role; the end-to-end business process; a module reference; reports, dashboards, schedules and notifications; troubleshooting, FAQ and glossary |
| Role decks (`docs/decks`) | One PowerPoint per role: the role, its menu map, key functions with screens, its part of the end-to-end flow, reports, schedules, notifications, known limitations and tips |
| Getting started guide (`docs/onboarding/GETTING_STARTED.md`) | First sign-in, password rules, two-step verification, menus per role, how to ask for help; handed to every user |
| UAT scripts (`docs/onboarding/UAT_SCRIPTS.md`) | Basis for the practical exercises and the assessment |
| Upload templates (`docs/templates`) | Exercises for users who load data (System Administrator, Accounting, Sales & Marketing, Processing Team) |
| Training environment | The test environment with training users (one per trainee) and training data; the delivered sample data (`SEED_SAMPLE_DATA=true`) may be used there, never in production |
| Exercise book (prepared by the key users with iorta TechNXT) | The broker's own examples: products, insurers, a typical motor and fire risk, a typical month-end |

Training users and their passwords are handed to trainees privately, as for production users. Trainees never use production for practice.

# Curriculum by role

Durations are in hours of classroom time; a day is 7 hours. The manual chapters are those of the BrokerVerse User Manual.

> Note: version 1.0 of the user manual and the role decks do not describe Operations > Sales & Marketing > Quick Quote and Compare Insurers, Accounts > Credit Control and Accounts > Insurer Reconciliation. Until they do, the consultant teaches these screens by walkthrough and the key users add the steps to their exercise book.

## All roles: common module (1.5 hours)

| Topic | Content | Manual |
|---|---|---|
| Signing in | First sign-in, password change, password rules (8 characters, upper and lower case, digit, symbol, history 5, expiry 90 days), lockout after 5 wrong passwords, idle sign-out after 30 minutes, forgotten password | Chapter 2 |
| Two-step verification | Set-up with an authenticator app; what to do when the phone is lost | Chapter 2 |
| Finding your way | Menu by role, dashboards, notifications (bell), lists, search and filters, view and edit | Chapters 2, 4 |
| The broking cycle | The thirteen steps from lead to month-end and who does each; maker-checker points | Chapter 3 |
| Formats | Dates DD/MM/YYYY, amounts in PHP, mobile number and TIN formats, government IDs accepted for KYC | Chapter 2 |
| Getting help | Key user first, then the System Administrator; what to put in a report: screen, record number, time, request ID | Chapter 2, Appendix H |

## System Administrator (17.5 hours, 2.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| User management | 3 | Users, roles, temporary passwords, locking and unlocking, two-step verification resets; User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews | Chapter 23 |
| Organisation and letterhead | 1 | Company (primary company prints on every document), branches, departments, System Settings | Chapter 23 |
| Masters and uploads | 3 | Insurance Management masters, Location, Employee Management, Finance masters; upload templates, row errors, loading masters without an Upload button | Chapter 23 |
| Configuration | 3 | Master > Configuration groups: security, notification and e-mail texts, placement journey, limits, tax, claims, renewals, remittance; effect of a change; audit | Chapter 23, Appendix C |
| Document numbering | 1 | Series, prefix, format, next number; continuing the old numbering; official receipt series and the Authority to Print | Chapter 23, Appendix B |
| Schedules and E-mail Outbox | 1.5 | The 15 jobs, switching on, Run now, run history; the outbox and resending | Chapter 23, Appendix D |
| Posting rules and account determination (overview) | 1 | Account roles, posting rules, Simulate, Configuration Approvals | Chapter 23 |
| Audit Trail and first-line support | 2.5 | Audit Trail filters; access reviews; triage of user reports; raising tickets to iorta TechNXT | Chapter 23, Appendix F |

## Sales & Marketing (10.5 hours, 1.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Dashboards | 0.5 | Executive Dashboard, Sales Dashboard | Chapter 4 |
| Prospects | 1.5 | Create a prospect per line, edit, bulk upload with the template | Chapter 5 |
| Quotations | 3 | Motor quotation: vehicle class, CTPL, covers, taxes; sending for customer approval; quotation validity and maker-checker; Quick Quote and Compare Insurers for package products | Chapter 8; Quick Quote by walkthrough (see note) |
| Requests for quotation | 0.5 | Passing a commercial risk to the Processing Team for a broker slip | Chapter 7 |
| Payment capture | 1 | Proceed to Payment: pay later, bank transfer, cheque, online payment, cash; Accounting verifies | Chapters 9, 13 |
| Clients and renewals | 1.5 | Clients; Renewal Queue, At-Risk Policies, Negotiations; renewal notices | Chapters 6, 12 |
| Commission and reports | 1 | Commission Dashboard; Production Register, Lead Conversion Funnel, Receivables Ageing | Chapters 15, 24 |

## Processing Team (21 hours, 3 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Dashboards | 0.5 | Processing Dashboard, Executive Dashboard | Chapter 4 |
| Placement journey | 1 | Journey per line of business; required and optional steps | Chapter 3 |
| Requests for quotation (broker slips) | 3 | New broker slip, submit to market, record offers and declines, compare offers | Chapter 7 |
| Quotation slips | 2 | Preparing the quotation slip from the chosen offer; pricing, taxes, commission | Chapters 7, 8 |
| Placement slips and co-insurance | 3 | Firm order to the lead and co-insurers, shares totalling 100%, confirmations, binding | Chapter 7 |
| Policy issue | 2.5 | Issue from the placement slip or the motor quotation; KYC and vehicle identifiers; Record Issued Policy; documents and billing | Chapters 7, 9 |
| Endorsements | 2 | Endorsement types, premium recalculation, additional and return premium, completing with the insurer's document | Chapter 10 |
| Renewals | 1 | Approving renewal terms; renewal batch and queue | Chapter 12 |
| Product Configurator | 2.5 | Product templates, the motor tariff (CTPL and Auto Passenger PA), coverage builder, rating engine, acceptance rules, market and risk mapping | Chapter 22 |
| Reinsurance and reports | 2 | Treaties, cession tracking, claims recovery; Placement Pipeline, Market Response, Co-insurance Register, Production Register | Chapters 20, 24 |

## Operations (10.5 hours, 1.5 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Clients and policies | 2 | Finding a client, policies, open bills; policy details and documents | Chapters 6, 9 |
| Endorsement requests | 1.5 | Raising an endorsement request; what the Processing Team completes | Chapter 10 |
| Open items and payments | 2.5 | Expiring policies, pending quotations, pending payments; capturing the client's payment with proof | Chapter 13 |
| Renewals | 1.5 | Renewal Policy, renewal notices, lapse management | Chapter 12 |
| Quotations for servicing | 1 | Quoting a change or a new cover for an existing client | Chapter 8 |
| Reports | 0.5 | Production Register, Claims Position, Renewal Retention | Chapter 24 |

## Claims (7 hours, 1 day)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Registering a claim | 1.5 | New claim on an active policy; checks on loss date and unpaid premium | Chapter 11 |
| Documents and letters | 1 | Uploading documents, acknowledgement and other claim letters | Chapter 11 |
| Insurer follow-up | 1 | Insurer reference, adjuster, follow-up notes, claim history and audit trail | Chapter 11 |
| Settlement | 1.5 | Settlement amount, discharge voucher, maker-checker approval; settlement paid through the broker | Chapter 11 |
| Dashboard, recovery and reports | 0.5 | Claims Dashboard, Claims Recovery, Claims Position | Chapters 4, 20, 24 |

## Accounting (28 hours, 4 days)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Common module | 1.5 | As above | |
| Receipts and payment verification | 3 | Official receipts against open bills, verifying captured payments, bulk receipts, printing, returned cheques | Chapters 13, 14 |
| Collections and credit control | 2 | Collections, ageing, reminders; Credit Control: instalment plans, premium warranty monitor, client credit limits, remittance ageing | Chapter 14; Credit Control by walkthrough (see note) |
| Disbursement and petty cash | 2 | Payment vouchers, maker-checker, cheque printing, bulk upload; petty cash funds, requests, replenishment | Chapter 14 |
| Remittance and direct bill | 4 | Automated processing, approval levels, settlement, electronic transfer records, remittance reconciliation; direct bill debit notes and collection of commission net of EWT | Chapter 16 |
| Commission and incentives | 2 | Referrer accounts, eligibility after full collection, approval, payout with withholding tax; incentive calculations and approval | Chapters 15, 21 |
| Journals and the ledger | 3 | Journal voucher, correction and reversal JV, open entry matching and unmatching, Accounting Query, All Clients Accounting; what each business event posts | Chapter 14, 23 |
| Bank reconciliation | 3 | Statement import with preview, auto match, manual match, bank items, preparing the reconciliation, reports | Chapter 19 |
| Insurer reconciliation | 1 | Insurer Statements and their matching; approval by the Accounting Manager | Walkthrough (see note) |
| Tax | 2.5 | Tax codes; BIR Form 2307 issued and received; VAT Summary, SAWT, QAP, SLSP; BIR settings before the first filing | Chapter 18 |
| Period end | 2 | Period Management, Month-End Close run and checklist, recurring journals, financial statements; go-live opening data | Chapter 17 |
| Reports | 2 | SOA/Premium Receivable, Collection Report, Payables, Journal, Trial Balance, Aged Payables to Insurers, Due to Insurers by Co-insurer | Chapter 24 |

## Accounting Manager (7 hours, 1 day, after the Accounting curriculum)

| Module | Hours | Content | Manual |
|---|---|---|---|
| Approvals | 1.5 | What only the Accounting Manager approves; maker-checker rules; delegations | Chapters 3, 17 |
| Month-end and year-end close | 2 | Reviewing and approving the close run; year-end close and carry forward | Chapter 17 |
| Period control | 1 | Reopening a period with remarks; soft-closed periods and postings into them | Chapter 17 |
| Bank and insurer reconciliation approval | 1 | Approving and locking bank reconciliations; approving insurer statement reconciliations and credit control items | Chapter 19 |
| Configuration approvals | 1 | Account determination and posting rule changes proposed by another user; tax codes and GL accounts | Chapter 23 |
| Financial statements and BIR review | 0.5 | Trial balance, income statement, balance sheet, GL detail; reviewing the BIR working papers before filing | Chapters 17, 18 |

## Summary of durations

| Role | Key users (TTT) | End users |
|---|---|---|
| System Administrator | 2.5 days | Not applicable (all System Administrators are trained by iorta TechNXT) |
| Sales & Marketing | 1.5 days plus 0.5 day trainer skills | 1.5 days |
| Processing Team | 3 days plus 0.5 day trainer skills | 3 days |
| Operations | 1.5 days plus 0.5 day trainer skills | 1.5 days |
| Claims | 1 day plus 0.5 day trainer skills | 1 day |
| Accounting | 4 days plus 0.5 day trainer skills | 4 days |
| Accounting Manager | 1 day after Accounting | Not applicable (trained by iorta TechNXT) |

# Train the trainer

## Who

One key user per team (two for teams of more than 15 users), named at mobilisation. Key users take part in discovery and UAT, so they reach training already knowing the configuration.

## Programme

1. **Role curriculum** delivered by an iorta TechNXT consultant, on the test environment with the broker's configuration.
2. **Trainer skills** (half a day): structuring a session, demonstrating then letting trainees practise, handling questions, using the exercise book, running the assessment.
3. **Exercise book** prepared by each key user with the consultant: the broker's own examples for each module.
4. **Teach-back**: each key user delivers one module to the consultant and peers and gets feedback.
5. **Co-delivery**: the key user leads the first end-user session with the consultant in the room; the consultant answers system questions and notes follow-ups.
6. **Solo delivery**: the key user runs the remaining sessions; the consultant is on call.

## Exit criteria for a key user

- Passed the role assessment with at least 90%.
- Delivered a teach-back to the consultant's satisfaction.
- Knows how to raise a support ticket and what to include.

# Delivery

## Schedule

| Plan | Train the trainer | End-user training |
|---|---|---|
| Small (8 weeks) | Week 4 | Week 5 |
| Medium (12 weeks) | Week 7 | Weeks 8 and 9 |
| Large (16 to 20 weeks) | Weeks 10 and 11 | Weeks 12 and 13 |

## Sessions

- At most 10 trainees per session, each with a computer and a training user for the role.
- Sessions run on site or online in Philippine business hours, in English; key users may explain in Filipino. The screens are in English in this release.
- Users holding two roles attend both curricula.
- Attendance is recorded per session; a missed module is taken in a catch-up session before go-live.
- Users who join after go-live are trained by their key user with the same curriculum and assessment.

## Training environment readiness

Before each training wave: training users created per trainee, configuration equal to the UAT-accepted configuration, training data present (prospects, quotations, policies, open bills, a bank statement to reconcile), e-mail going to internal addresses only, and the exercise book printed.

# Assessment

## Method

Each user completes a practical assessment at the end of the role curriculum, on the training environment, without help. It uses the scenarios of `UAT_SCRIPTS.md` for the role, with the broker's data, plus a short written check.

| Role | Practical tasks (from the UAT scripts) | Written check |
|---|---|---|
| System Administrator | A1 to A7 | 10 questions |
| Sales & Marketing | S1, S3, S4, S5, S6 | 10 questions |
| Processing Team | P1 to P6 | 10 questions |
| Operations | O1 to O5 | 10 questions |
| Claims | C1 to C5 | 10 questions |
| Accounting | F1 to F8 | 15 questions |
| Accounting Manager | M1 to M5 | 10 questions |

## Pass criteria

- End users: at least 80% overall, and every task marked critical for the role done correctly. Critical tasks: issuing an official receipt (Accounting), approving as checker (Accounting Manager), issuing a policy with KYC (Processing Team), registering a claim (Claims), capturing a payment (Operations, Sales & Marketing), creating a user with the right role (System Administrator).
- Key users: at least 90%.
- A user who does not pass attends a refresher and takes the assessment again before receiving production access.

## Evaluation of the training

Each trainee fills in a short evaluation (content, pace, trainer, materials, confidence to do the job). Key users and the iorta TechNXT consultant review the results after each wave and adjust the next sessions.

# Change management

## What changes for users

The main changes users meet are rules the system now enforces. Each is explained in training and in the go-live communication.

| Change | Who is affected | What it means in daily work |
|---|---|---|
| Only Accounting posts official receipts | Sales & Marketing, Operations, Processing Team, Accounting | Other roles record how the client paid; Accounting verifies and issues the receipt |
| Maker-checker | Accounting, Accounting Manager, Claims, Processing Team | The person who enters a quotation, voucher, remittance, settlement, journal or close cannot approve it |
| KYC and vehicle identifiers before a motor policy is issued | Sales & Marketing, Processing Team, Operations | Government ID type, number and image, chassis, motor and plate or MV file number are needed before issue |
| Placement journey per line | Processing Team, Sales & Marketing | Fire, IAR, marine, casualty and engineering need a placement slip confirmed by every insurer before issue |
| Server pricing | Sales & Marketing, Processing Team | The premium is calculated from the configured rates and taxes; overrides are recorded |
| Claims checks | Claims | A claim is refused when the loss date is outside the policy period or premium is unpaid (delivered settings) |
| Commission paid after full collection | Accounting, Sales & Marketing | Referrer commission becomes payable only when the premium is fully collected and a bank account is on file |
| Period control | Accounting, Accounting Manager | Closed periods take no postings; soft-closed periods take postings only from the Accounting Manager |
| Security | Everyone | Personal user IDs, password rules, two-step verification for the roles set, automatic sign-out after 30 minutes idle; every action is in the Audit Trail |

## Stakeholders and communication

| Audience | Message | Channel | When |
|---|---|---|---|
| Management | Why the change, what it delivers, what is asked of the teams | Steering committee, management meeting | Mobilisation, monthly |
| Team leaders | Timeline, their key user, release of staff for training and UAT | Briefing by the broker PM | Mobilisation, before training |
| All users | What changes, training dates, go-live date, where to get help | E-mail from the sponsor, team meetings, getting started guide | Four weeks and one week before go-live, go-live day |
| Insurers | Go-live date, any change in documents (remittance advice, debit notes), contacts | Letter or e-mail from Accounting | Two weeks before go-live |
| Clients (where affected) | New official receipt or billing statement layout, payment links if used | Account executives | At go-live |

## Readiness

The broker PM checks readiness two weeks before go-live and again at the go/no-go: users trained and assessed per team, key users in place, user IDs issued, procedures updated for the changes above, and team leaders' confirmation that their teams are ready. Gaps are actions in the RAID log.

## Support at go-live and reinforcement

- Key users act as floor walkers in their teams during the first week; iorta TechNXT consultants are on site or on call during hypercare.
- A daily 15-minute check-in in the first week collects questions; answers go into the knowledge base and a short tips note to users.
- Refresher sessions are offered at the end of the first month, before the first month-end close for Accounting, and on topics the support tickets show users find hard.
- Key users keep the exercise book and train newcomers with the same curriculum and assessment.
