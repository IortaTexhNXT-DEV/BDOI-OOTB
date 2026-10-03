---
title: Service Catalogue
subtitle: And rate annex
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Rates to be confirmed against the price book at each issue; review by the parties' legal counsel before signature
acronyms: AMC=Annual Maintenance Contract; BIR=Bureau of Internal Revenue; CR=Change request; DR=Disaster recovery; IC=Insurance Commission; LOB=Line of business; MSA=Master Services Agreement; OOTB=Out of the box; PHP=Philippine peso; PHT=Philippine time; SLA=Service level agreement; SOW=Statement of work; UAT=User acceptance testing; USD=United States dollar; VAT=Value-added tax
---

# About this annex

> Template for discussion; subject to review by the parties' legal counsel.

This Service Catalogue and Rate Annex (the **Rate Annex**) lists the services of iNXT BrokerVerse OOTB that iorta TechNXT Corp. (**iorta TechNXT**) provides under the Master Services Agreement (the **MSA**), with their units and list rates, the optional services, and the work that is outside the OOTB scope. It is an annex to every Order Form between iorta TechNXT and [Client legal name] (the **Client**).

- The rates are the list rates of the iorta TechNXT price book dated 03 October 2026 (`iNXT_BrokerVerse_Price_Book.xlsx` and the Rate Card). They are the same as the rates in the Perpetual Software Licence Agreement, the Software Subscription Agreement, the Implementation SOW, the Change Request Procedure, the Annual Maintenance and Support Agreement and SLA and the Hosting and Infrastructure Services Agreement.
- The rates of the signed Order Form, including any discount shown there as a separate line, prevail over this Rate Annex.
- All amounts are in PHP and exclude 12% VAT. Withholding tax is handled under the Taxes clause of the MSA and does not reduce the invoice price.
- Day rates are fixed for 12 months from the date of the Order Form and may then be reviewed once a year with 60 days' written notice.
- Recurring fees for the subscription, the AMC and the 24x7 Severity 1 support increase by 5% at each anniversary of their start. Hosting fees do not increase yearly; they change only under the Pass-through and adjustments clause of the Hosting Agreement.

Text in [square brackets] is a placeholder or an option. Capitalised terms have the meaning given in the MSA.

# Service catalogue

## Overview

| Code | Service | Model | Where the terms are |
|---|---|---|---|
| S01 | Perpetual licence of iNXT BrokerVerse OOTB | Perpetual | Perpetual Software Licence Agreement |
| S02 | Subscription to iNXT BrokerVerse OOTB | Subscription | Software Subscription Agreement |
| S03 | Implementation (perpetual) or onboarding (subscription) | Both | Implementation SOW |
| S04 | Maintenance and standard support (AMC) | Perpetual, from Year 2 | Annual Maintenance and Support Agreement and SLA |
| S05 | Standard support included in the subscription | Subscription | Annual Maintenance and Support Agreement and SLA |
| S06 | 24x7 Severity 1 support (extended P1 support) | Both, optional | Annual Maintenance and Support Agreement and SLA |
| S07 | Hosting of production and one UAT environment | Both, optional | Hosting and Infrastructure Services Agreement |
| S08 | Optional services: environments, training, data migration, integrations, lines of business, reports, on-site days | Both | Order Form and this Rate Annex |
| S09 | Change requests | Both | Change Request Procedure |
| S10 | Exit and transition assistance | Subscription and hosting | Exit and Transition Plan |
| S11 | Source code escrow | Perpetual, optional | Source Code Escrow Agreement |

## Size tiers

The size, set by the number of Named Users, decides the implementation effort, the included lines of business and training days, the minimum billable users of a subscription, the hosting size and the price of the 24x7 Severity 1 support.

| Size | Named users | Lines of business included | Training days included | Duration to hypercare exit |
|---|---|---|---|---|
| Small | 1 to 25 | 5 | 4 | 8 weeks |
| Medium | 26 to 100 | 8 | 6 | 12 weeks |
| Large | 101 to 300 | 12 | 10 | 16 to 20 weeks |
| Enterprise | Above 300 | 16 | 15 | 20 weeks or more, planned at mobilisation |

## Packages

The packages are pre-set combinations of the services above, priced with the same rates. Any other combination is quoted with the same rates.

| Package | Licence model | Hosting | Support | Term shown in the Rate Card |
|---|---|---|---|---|
| Essentials | Subscription | Hosted by the Client | Standard support | 3 years |
| Standard | Subscription | iorta TechNXT on AWS (Singapore) | Standard support | 3 years |
| Ownership | Perpetual licence with AMC | iorta TechNXT on AWS (Singapore) | Standard support | 5 years |
| Ownership Plus | Perpetual licence with AMC | Local partner in the Philippines | Standard support and 24x7 Severity 1 support | 5 years |

Ownership Plus also includes 2 extra training days and the migration of 1 legacy data source.

# Rates

## S01: perpetual licence

| Users in slab | Licence per Named User, one-time (PHP) |
|---|---|
| 1 to 25 | 90,000.00 |
| 26 to 100 | 78,000.00 |
| 101 to 300 | 66,000.00 |
| Above 300 | 54,000.00 |

Graduated slabs: the first 25 users at the first rate, users 26 to 100 at the second, users 101 to 300 at the third and the rest at the fourth. Payable 100% on Go-Live. Warranty Period of 12 months from Go-Live.

## S02: subscription

| Users in slab | Per Named User per month, Year 1 (PHP) | Minimum billable users of the size |
|---|---|---|
| 1 to 25 | 3,200.00 | Small: 10 |
| 26 to 100 | 2,800.00 | Medium: 26 |
| 101 to 300 | 2,400.00 | Large: 101 |
| Above 300 | 2,000.00 | Enterprise: 301 |

Graduated slabs as for the licence. Monthly in advance from Go-Live; minimum Initial Term 12 months; plus 5% at each anniversary of Go-Live. Hosting is not included.

## S03: implementation or onboarding

| Size | Base man-days | Lines of business included | Fee (PHP) |
|---|---|---|---|
| Small | 70 | 5 | 1,130,000.00 |
| Medium | 130 | 8 | 2,090,000.00 |
| Large | 230 | 12 | 3,700,000.00 |
| Enterprise | 360 | 16 | 5,800,000.00 |

1. Fee = (base man-days + 6 man-days for each line of business above the included number) x PHP 16,100.00, rounded to PHP 10,000.00. Example: Small with 6 lines of business, 76 man-days, PHP 1,220,000.00.
2. The onboarding fee of a subscription equals the implementation fee, unless the Order Form states a lower percentage.
3. Payable 40% on signing of the Order Form, 40% on UAT sign-off and 20% on Go-Live.

## S04 to S06: maintenance and support

| Item | Rate | Billing |
|---|---|---|
| AMC (perpetual) | 22% of the Licence Fee a year, from the start of Year 2 | Yearly in advance; plus 5% at each anniversary of the AMC start |
| Standard support (subscription) | Included in the Monthly Fee | Not applicable |
| 24x7 Severity 1 support, Small | PHP 240,000.00 a year (Year 1) | Yearly in advance; plus 5% a year |
| 24x7 Severity 1 support, Medium | PHP 480,000.00 a year (Year 1) | As above |
| 24x7 Severity 1 support, Large | PHP 900,000.00 a year (Year 1) | As above |
| 24x7 Severity 1 support, Enterprise | PHP 1,500,000.00 a year (Year 1) | As above |
| Reinstatement of a lapsed AMC | The AMC fees for the lapsed period plus [10%] of those fees, and the upgrade to the current release at day rates | On reinstatement |

Standard support hours: 08:00 to 18:00 PHT, Monday to Friday, except Philippine regular holidays.

| Severity | First response | Restore service or workaround |
|---|---|---|
| P1 Critical | 30 minutes | 4 service hours |
| P2 High | 2 service hours | 2 Business Days |
| P3 Medium | 1 Business Day | 5 Business Days |
| P4 Low | 2 Business Days | Not applicable |

## S07: hosting

Production and one UAT environment, daily backups, monitoring, patching and certificates. Per month, monthly in advance from the date the environment is handed over.

| Size | Hosted by the Client | AWS Singapore (PHP) | Azure Southeast Asia (PHP) | Local partner, Philippines (PHP) |
|---|---|---|---|---|
| Small | No fee | 30,000.00 | 31,000.00 | 28,000.00 |
| Medium | No fee | 62,000.00 | 65,000.00 | 59,000.00 |
| Large | No fee | 112,000.00 | 118,000.00 | 107,000.00 |
| Enterprise | No fee | 244,000.00 | 256,000.00 | 232,000.00 |

Cloud and local partner prices are confirmed with the provider before the Order Form is signed. When the Client hosts, iorta TechNXT supplies the deployment guide and charges set-up support at day rates.

## S08: optional services

| Item | Unit | Rate (PHP) | Billing |
|---|---|---|---|
| Additional environment (training or second UAT), set-up | One-time | 100,000.00 | On delivery |
| Additional environment hosted by iorta TechNXT | Per month | 11,000.00 | Monthly in advance, as for hosting |
| Training beyond the included days | Per trainer day, up to 15 participants | 30,000.00 | On delivery |
| Data migration beyond the standard templates | Per legacy source | 240,000.00 | As quoted |
| Data migration, additional effort | Per man-day | 16,100.00 | Monthly in arrears |
| Additional integration, standard (one documented API or file exchange in one direction) | Per integration | 320,000.00 | As quoted |
| Additional integration, complex (two-way, no API, or batch with reconciliation) | Per integration | 720,000.00 | As quoted |
| Additional line of business at implementation | 6 man-days at the blended rate | 96,600.00 before the rounding of the implementation fee | With the implementation fee |
| Additional line of business after go-live | Per line | 100,000.00 | As quoted |
| New report or document template (typical) | Per item | 60,000.00 | As a change request |
| On-site consultant day in Metro Manila | Per day | 20,000.00 | Monthly in arrears |
| Set-up support where the Client hosts | Per man-day | Day rates of S09 | Monthly in arrears |
| Business configuration on the Client's behalf beyond [8] hours a month (AMC exclusion) | Per man-day | Day rates of S09 | Monthly in arrears |
| Refresher training beyond [one] session a year (AMC exclusion) | Per trainer day | 30,000.00 | On delivery |
| Travel, lodging and meals outside Metro Manila | At cost, with receipts, approved in advance | At cost | Monthly in arrears |

## S09: change requests and day rates

| Role | Day rate (PHP) |
|---|---|
| Business analyst | 18,000.00 |
| Developer | 16,000.00 |
| QA engineer | 12,000.00 |
| Project manager | 22,000.00 |
| Blended rate | 16,100.00 |

A man-day is 8 hours. Estimates follow the Change Request Procedure: business analysis 30% of development, testing 40% of development, project management 10% of the subtotal, contingency 10% of the total, each line rounded up to the half day.

| Band | Total man-days | Example | Example price (PHP) | Payment |
|---|---|---|---|---|
| Small | 0.5 to 5 | 2 developer days, 5 days in total | 81,050.00 | 100% on delivery to production |
| Medium | 5.5 to 20 | 7 developer days, 16 days in total | 250,150.00 | 50% on approval, 50% on UAT sign-off |
| Large | 20.5 to 60 | 20 developer days, 42 days in total | 665,400.00 | 30% on approval, 50% on UAT sign-off, 20% on deployment |
| Project | Above 60 | Separate SOW | Not applicable | As in the SOW |

## S10: exit and transition

| Item | Rate |
|---|---|
| One full export of the Client Data | Included |
| Transition assistance where iorta TechNXT hosts | Up to [5] man-days included, then day rates of S09 |
| Further exports, data mapping, answers to a new provider, parallel running | Day rates of S09 |
| Read-only access for the System Administrator for up to 60 days after the End Date | [No charge / the Monthly Fee prorated] |
| Hosted environment kept running after the End Date, up to 90 days | Monthly hosting fee, prorated by day |

## S11: source code escrow

| Item | Rate |
|---|---|
| Escrow Agent fees (set-up, yearly, updates, verification, release) | As quoted by the Escrow Agent; paid by the Client |
| Preparation and delivery of Deposits by iorta TechNXT | Included |
| iorta TechNXT assistance to a Verification | Up to [1] man-day included per Verification, then day rates of S09 |

# Payment terms

| Item | Terms |
|---|---|
| Implementation or onboarding fee | 40% on signing, 40% on UAT sign-off, 20% on Go-Live |
| Perpetual Licence Fee | 100% on Go-Live |
| AMC | Yearly in advance, from the start of Year 2 |
| Subscription | Monthly in advance, from Go-Live |
| Hosting and additional hosted environments | Monthly in advance, from environment handover |
| 24x7 Severity 1 support | Yearly in advance |
| Change requests | By band, as in S09 |
| Optional services | Monthly in arrears at actual days, or as quoted for fixed-price items |

Invoices are payable within 30 days of the invoice date. Late amounts bear interest as stated in the MSA. Subscription, hosting and support may be suspended after 60 days of non-payment, after 10 Business Days' written notice.

# Out of scope

The following are outside the OOTB scope and outside the AMC and the subscription. Each can be quoted as an optional service or a change request at the rates above.

## Product changes

1. Customisation of screens, workflows, reports, printed documents or the database, and new reports.
2. New integrations, for example with insurer systems, core banking, bank payment file generation, SMS gateways, accounting packages, BIR eFPS or eBIRForms, LTO or IC systems, and payment gateways other than PayMongo and Dragonpay.
3. Changes caused by a third party (insurer, bank, payment gateway, e-mail provider) changing its interface.
4. Translation of the screens.
5. Support of customised code that has not been merged into the product line, after its 30-day warranty.

## Data services

1. Data cleansing, de-duplication and enrichment of the Client's data, and extraction from the old system.
2. Migration of closed or expired policies, settled claims, paid receivables, transaction history and documents, and more than one fiscal year of balances.
3. Data entry and bulk data work for the Client's business.
4. Recovery of data deleted by the Client's users beyond what the backups hold.

## Infrastructure and third parties

1. Hardware, end-user devices, networks, browsers and office software.
2. Infrastructure, operating system and database support where the Client hosts.
3. Third-party licences and fees: cloud subscriptions beyond the agreed hosting, mailboxes, payment gateway merchant fees, SMS charges, certificates for Client-owned domains, escrow agent fees.

## Regulatory and advice

1. Regulatory filings and registrations: BIR returns and alphalists, Computerized Accounting System registration, Authority to Print, IC reports, NPC registration, AMLC reports.
2. Tax, legal, actuarial or audit advice.

## Training and support

1. Training beyond the included days and the agreed refresher sessions, and training of users added after go-live.
2. Support of releases more than two planned releases behind the current one.
3. Issues caused by changes the Client made outside the change process, or by the Client's network, devices or browsers.
