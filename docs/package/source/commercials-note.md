---
title: BrokerVerse OOTB Commercial Proposal Note
subtitle: Pricing rationale, market positioning and commercial terms
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed: To be completed
approved: To be completed
acronyms: AMC=Annual Maintenance Contract; BIR=Bureau of Internal Revenue; BSP=Bangko Sentral ng Pilipinas; CR=Change request; Dev=Development environment; EWT=Expanded withholding tax; IC=Insurance Commission; LOB=Line of business; OOTB=Out of the box; PHP=Philippine peso; Pre-Prod=Pre-production environment; SaaS=Software as a service; SIT=System integration test; TCO=Total cost of ownership; UAT=User acceptance testing; USD=United States dollar; VAT=Value-added tax
---

# Purpose and scope

This note explains how iorta TechNXT prices BrokerVerse OOTB, the as-is version of the BrokerVerse insurance broking platform, for Philippine non-life insurance brokers. It covers the two commercial models, the optional services, the payment terms and the assumptions behind the price points.

The figures come from the companion workbook `BrokerVerse_Commercials_and_Pricing.xlsx`. The workbook is formula driven: change a driver on its Inputs sheet and every model, calculator and sample quote updates. Where this note and the workbook differ, the workbook governs.

> All prices are in PHP and exclude 12% VAT. USD figures are for reference only, at PHP 62.75 per USD (BSP reference rate, 25 September 2026). Figures marked as estimates or assumptions must be confirmed before a binding quotation.

BrokerVerse OOTB covers sales and quotation, placement with insurers, policy issuance and servicing, endorsements, claims, renewals, billing, official receipts, remittance to insurers, commission, general ledger, bank and insurer reconciliation, BIR tax reports, reinsurance and incentives. The price list prices the product as delivered. Changes to it are change requests, priced at the day rates in this note.

# Market context

## The Philippine broker market

The market is small and concentrated. The IC key data for 2024 (preliminary) shows about 67 licensed insurance brokers. A broker needs a minimum paid-up capital of PHP 20,000,000.00, or PHP 50,000,000.00 for an insurance and reinsurance broker.

The IC ranking of brokers by commission earned for 2024 shows the spread of size:

| Position | Broker | Commission earned 2024 |
|---|---|---|
| 1 | BDO Insurance and Reinsurance Brokers | PHP 2,434 million |
| 2 | Marsh Philippines | PHP 2,075 million |
| 3 | Aon Insurance and Reinsurance Brokers Philippines | PHP 2,047 million |
| 4 | Lockton Philippines | PHP 712 million |
| 5 | PhilPacific Insurance Brokers and Managers | PHP 598 million |
| 20 | East West Insurance Brokerage | PHP 98 million |
| 30 | Moneyhero Insurance Brokerage | PHP 55 million |

Three brokers earn more than PHP 2 billion each, a handful earn between PHP 250 million and PHP 800 million, and most earn under PHP 100 million. The price list therefore has to work for a 15-user owner-managed broker as well as for a 400-user bank-affiliated broker.

## What the insurer ranking suggests

Non-life gross premiums written reached PHP 149.11 billion in 2025 (excluding reinsurers). Pioneer Insurance led with PHP 20.70 billion (14%), followed by Prudential Guarantee (PHP 13.86 billion, 9%) and Malayan (PHP 13.35 billion, 9%). Pioneer was also first by net premiums written at PHP 6.90 billion.

The top three insurers hold about a third of the market and the rest is spread across many mid-size insurers. A Philippine broker therefore places with many insurers, and insurer set-up, remittance and reconciliation by insurer are core needs at every size. This supports pricing BrokerVerse as a full broking and accounting platform rather than as a sales tool.

## Affordability

Published benchmarks put insurance IT spending at about 3% of revenue (Gartner, 2010) and 4% to 7% in later third-party benchmarks. The workbook uses 3% to 7% of commission income as the affordability band. With the recommended prices, the Year 1 subscription for the reference user counts is about 2.3% of estimated commission income for a Small broker, 1.8% for Medium, 1.2% for Large and 0.8% for Enterprise. The income figures per tier are estimates mapped to the IC ranking.

# Size tiers and user slabs

| Tier | Users | Typical profile (estimate) | IC 2024 position |
|---|---|---|---|
| Small | 1 to 25 | 10 to 40 staff, one office or a few branches | Rank 30 and below |
| Medium | 26 to 100 | 40 to 150 staff, several branches | Rank 10 to 30 |
| Large | 101 to 300 | 150 to 400 staff, national or multinational | Rank 4 to 10 |
| Enterprise | Above 300 | Over 400 staff, bank-affiliated or global | Top 3 |

User prices are graduated. The first 25 users are charged at the Small rate, users 26 to 100 at the Medium rate, users 101 to 300 at the Large rate and the rest at the Enterprise rate. A broker that grows past a boundary never pays less in total than before, and the effective price per user falls as it grows.

A user is a named person with a BrokerVerse sign-in. The tier, set by the total user count, decides the implementation effort, the minimum billable users for subscription, the training days included and the infrastructure size.

# Model A: perpetual licence with AMC

## Price points

| Tier | Licence per user (slab) | USD reference | Implementation, reference scope |
|---|---|---|---|
| Small | PHP 90,000.00 | USD 1,434 | PHP 1,130,000.00 (5 lines of business) |
| Medium | PHP 78,000.00 | USD 1,243 | PHP 2,090,000.00 (8 lines of business) |
| Large | PHP 66,000.00 | USD 1,052 | PHP 3,700,000.00 (12 lines of business) |
| Enterprise | PHP 54,000.00 | USD 861 | PHP 5,800,000.00 (16 lines of business) |

- The perpetual licence is a one-time fee for the named users, payable on go-live.
- AMC is 22% of the licence fee a year and increases 5% each year. It starts in Year 2, after a 12-month warranty from go-live. The start year is an input and can be set to Year 1.
- AMC covers corrections, updates of the OOTB version, regulatory form updates released for all customers and standard support in business hours.

## Implementation fee

The implementation fee is calculated, not quoted as a flat figure:

- base man-days for the tier: Small 70, Medium 130, Large 230, Enterprise 360;
- plus 6 man-days for each line of business above the number included for the tier (5, 8, 12 and 16);
- times the blended day rate of PHP 16,100.00, rounded to PHP 10,000.00.

Lines of business drive effort because each one needs products and covers in the product configurator, rating and tax lines (documentary stamp tax, VAT or premium tax, local government tax and fire service tax where they apply), policy and endorsement document templates, insurer commission rates and its own UAT test cases. A motor-only broker and a broker writing motor, fire, marine, casualty, engineering and bonds do not need the same effort.

The implementation includes configuration, data load by the broker with the standard upload templates (about 40 templates are delivered with the product), the training days included for the tier, UAT support, go-live support and hypercare of 2 weeks (Small), 3 weeks (Medium) or 4 to 6 weeks (Large and Enterprise), extended to cover the first month-end close. The man-day counts are estimates for the OOTB version.

# Model B: subscription

## Price points

| Tier | Price per user per month (slab) | USD reference | Minimum billable users |
|---|---|---|---|
| Small | PHP 3,200.00 | USD 51 | 10 |
| Medium | PHP 2,800.00 | USD 45 | 26 |
| Large | PHP 2,400.00 | USD 38 | 101 |
| Enterprise | PHP 2,000.00 | USD 32 | 301 |

- Billed month on month, in advance. Prices increase 5% at each contract anniversary.
- The subscription includes the right to use the as-is version for the term, updates and standard support. Hosting is not included.
- An onboarding fee equal to the implementation fee applies, because the set-up work is the same in both models. The percentage is an input and can be reduced as a commercial concession.
- A 40-user broker pays 25 users at PHP 3,200.00 and 15 at PHP 2,800.00: PHP 122,000.00 a month, an effective PHP 3,050.00 per user.

## Break-even against the perpetual model

For the reference user counts, the cumulative cost of subscription passes the cumulative cost of perpetual in Year 4 in every tier. Subscription costs less in cash for the first three years; perpetual costs less over five years.

| Tier (reference users) | Perpetual, 5 years | Subscription, 5 years | Break-even |
|---|---|---|---|
| Small (15) | PHP 3,760,107.00 | PHP 4,312,764.00 | Year 4 |
| Medium (60) | PHP 11,792,173.00 | PHP 13,892,748.00 | Year 4 |
| Large (180) | PHP 29,767,284.00 | PHP 35,660,251.00 | Year 4 |
| Enterprise (400) | PHP 57,817,674.00 | PHP 70,118,348.00 | Year 4 |

Totals include implementation or onboarding and exclude VAT and optional items. This gives the broker a clear choice: subscription for lower Year 1 cash and flexibility, perpetual for lower cost over a planning horizon of four years or more.

# Positioning against the market

Few vendors publish prices for broker management systems. The workbook lists what could be found, and labels third-party estimates as such.

| Product | Price found (USD per user per month) | Type of evidence |
|---|---|---|
| Applied Epic | 125 to 250, plus set-up USD 10,000 to 25,000 | Third-party estimate |
| Vertafore AMS360 | 150 to 300 | Third-party estimate |
| Insly | 89 to 199 | Third-party listing |
| Open GI | From 70 | Third-party listing |
| Acturis | USD 2,000 to 25,000 per firm per month | Third-party estimate |
| Salesforce Financial Services Cloud | 325 to 350 | Published price |
| Zoho CRM (Professional to Enterprise) | 23 to 50 | Published price |
| Agiliux, Mzapp, Sibro, BrokerEdge, Xceedance | No public price | Quote only |

BrokerVerse OOTB at USD 32 to 51 per user per month sits:

- at about 29% of the median of the global broker systems listed (USD 175), which are not localised for Philippine taxes, BIR reports or IC reporting;
- at about the per-user price of a generic CRM at its top edition (Zoho CRM Enterprise, USD 50 billed monthly), while including placement, remittance, accounting, reconciliation and BIR reports that a CRM does not have;
- in line with regional vendors that sell on quotation, where the evidence suggests modular or per-transaction pricing rather than a lower per-user list price.

The position is deliberate: a localised full broking platform priced for a market where most brokers earn under PHP 100 million in commission.

# Infrastructure

Infrastructure is optional and quoted separately. The broker may host BrokerVerse itself at no fee; iorta TechNXT then supplies the deployment guide and charges set-up support at day rates. A self-hosting broker provides the same environment set.

## Environment set by broker size

| Tier | Standing environments |
|---|---|
| Small and Medium | Dev, UAT, Production. Integration and system testing in Dev, promoted to UAT for testing, then to Production |
| Large and Enterprise | Dev, SIT, UAT, Production with high availability. SIT and UAT are separate |

Every tier also has a temporary Pre-Prod. It is created from a production backup for the go-live rehearsal and for each major release, then removed. A copy used by people without production access is masked.

## Prices

| Tier | AWS, per month | Azure, per month | Local partner, per month | Pre-Prod on AWS, per month of use |
|---|---|---|---|---|
| Small | PHP 43,000.00 | PHP 46,000.00 | PHP 42,000.00 | PHP 21,000.00 |
| Medium | PHP 69,000.00 | PHP 73,000.00 | PHP 67,000.00 | PHP 47,000.00 |
| Large | PHP 143,000.00 | PHP 150,000.00 | PHP 135,000.00 | PHP 86,000.00 |
| Enterprise | PHP 256,000.00 | PHP 269,000.00 | PHP 242,000.00 | PHP 169,000.00 |

Each monthly price is the sum of the environments of the set. On AWS, Dev is PHP 11,000.00 for every tier; UAT is PHP 11,000.00 (Small, Medium) or PHP 23,000.00 (Large, Enterprise); SIT is PHP 23,000.00 (Large, Enterprise); Production is PHP 21,000.00, 47,000.00, 86,000.00 and 199,000.00 by tier. The Infrastructure sheet of the workbook gives every environment for every provider.

- The prices cover each environment of the set, daily backups, monitoring, patching and certificates, and include a 20% margin over estimated cloud cost for FX movement and operations effort.
- Pre-Prod runs at production size and is billed per month of use. The workbook budgets 2 months around go-live and 1 month a year for a major release: on AWS, hosting is PHP 558,000.00 in Year 1 and PHP 537,000.00 a year after for a Small broker, and PHP 1,888,000.00 and PHP 1,802,000.00 for a Large broker.
- Hosting fees do not increase each year. Provider price changes are passed through at cost under the Hosting and Infrastructure Services Agreement.
- AWS and Azure are priced on their Singapore regions. AWS also has a Local Zone in Manila. The local partner option keeps data in the Philippines.
- The cloud costs are estimates from public on-demand list prices. The Large tier production is close to the sizing in the BrokerVerse capacity document (200 named users, 80 concurrent, two API containers and a Multi-AZ PostgreSQL 16 database). Confirm with the provider before quoting.

# Change requests

## Day rates

| Role | Day rate | USD reference |
|---|---|---|
| Business analyst | PHP 18,000.00 | USD 287 |
| Developer | PHP 16,000.00 | USD 255 |
| QA engineer | PHP 12,000.00 | USD 191 |
| Project manager | PHP 22,000.00 | USD 351 |
| Blended (25%, 40%, 25%, 10%) | PHP 16,100.00 | USD 257 |

A man-day is 8 hours. The rates sit within the Philippine market for outsourced development (USD 30 to 50 an hour mid-level, USD 50 to 75 senior) and above employee salary cost (for example a senior business analyst at about PHP 70,500.00 a month), to cover benefits, overhead, bench time and margin.

## Estimation method

1. The broker raises the change with the business need and examples.
2. iorta TechNXT estimates developer man-days from the screens, APIs, reports, database changes and jobs affected.
3. Business analysis is 30% of development, testing 40% of development, project management 10% of the subtotal, and contingency 10% of the total. Days round up to the half day.
4. The price is days by role times the role rate.

| Band | Total man-days | Worked example | Price |
|---|---|---|---|
| Small | Up to 5 | 2 developer days, 5 days in total | PHP 81,050.00 |
| Medium | 5.5 to 20 | 7 developer days, 16 days in total | PHP 250,150.00 |
| Large | 20.5 to 60 | 20 developer days, 42 days in total | PHP 665,400.00 |

Work above 60 man-days is a separate project with its own statement of work.

# Optional services

| Item | Price |
|---|---|
| Additional environment, set-up | PHP 100,000.00 one-time |
| Additional environment hosted by iorta TechNXT | PHP 11,000.00 a month |
| Training beyond the included days | PHP 30,000.00 per trainer day |
| Data migration beyond the standard templates | PHP 240,000.00 per legacy source |
| Additional integration, standard or complex | PHP 320,000.00 or PHP 720,000.00 |
| Additional line of business after go-live | PHP 100,000.00 per line |
| On-site day in Metro Manila | PHP 20,000.00 per consultant day |
| 24x7 Severity 1 support, per year | Small PHP 240,000.00; Medium PHP 480,000.00; Large PHP 900,000.00; Enterprise PHP 1,500,000.00 |

Standard support is business hours, Monday to Friday, excluding Philippine holidays, under the severity levels in the support and escalation guide. The 24x7 option adds round-the-clock response for Severity 1 incidents and increases 5% a year. Hosted environments do not increase. Travel outside Metro Manila is billed at cost.

# Sample quotes

The workbook works out three brokers over five years, including the optional items chosen for each.

| Example | Perpetual, 5 years | Subscription, 5 years | Year 1 cash, perpetual / subscription |
|---|---|---|---|
| Small: 15 users, 5 lines, AWS hosting | PHP 6,466,107.00 | PHP 7,018,764.00 | PHP 3,038,000.00 / PHP 2,264,000.00 |
| Medium: 60 users, 8 lines, Azure, 24x7 support, extras | PHP 19,738,476.00 | PHP 21,839,051.00 | PHP 9,144,000.00 / PHP 6,300,000.00 |
| Large: 180 users, 12 lines, local partner, 24x7 support, extras | PHP 44,572,352.00 | PHP 50,465,319.00 | PHP 21,004,000.00 / PHP 13,408,000.00 |

Figures exclude VAT. Hosting covers the environment set of the tier and the temporary Pre-Prod months. The extras are training days, legacy data sources and integrations set in the workbook.

# Payment terms

| Item | Terms |
|---|---|
| Implementation or onboarding fee | 40% on signing, 40% on UAT sign-off, 20% on go-live |
| Perpetual licence fee | 100% on go-live |
| AMC | Yearly in advance, from the AMC start year |
| Subscription | Monthly in advance, from go-live |
| Infrastructure | Monthly in advance, from the date each environment is handed over; Pre-Prod for each month of use |
| Change requests | Small: on delivery. Medium: 50% on approval, 50% on UAT sign-off. Large: 30% on approval, 50% on UAT sign-off, 20% on deployment |
| Optional services | Monthly in arrears at actual days, or as quoted for fixed-price items |

Invoices are payable within 30 days. Subscription and hosting may be suspended after 60 days of non-payment, with written notice. The recommended minimum subscription term is 12 months.

# Taxes

- All prices exclude VAT. VAT at 12% is added on each invoice.
- A broker that is a withholding agent deducts creditable withholding tax as its status and the payment type require, commonly 2% for services and 1% to 2% on software or subscription fees under RR 2-98 as amended, and issues BIR Form 2307. Withholding does not reduce the invoice price.
- The withholding treatment of the perpetual licence (sale of software or royalty) must be confirmed by both parties' tax advisers before contract.

# Validity and assumptions

- Prices are valid for 90 days from the quotation date. Day rates are fixed for 12 months from signing.
- The contract currency is PHP. USD figures use PHP 62.75 per USD and are for reference only.
- Implementation man-days, lines of business included, cloud costs, the relative cost of Azure and the local partner, and the income of each broker tier are estimates. They are marked in the workbook.
- Competitor prices are mostly third-party estimates. Some IC and BusinessWorld figures were read from search extracts of the published documents and should be checked against the originals before external use.
- The broker supplies clean data in the standard templates, a project owner, key users for UAT and timely sign-offs. Delay on the broker side may move milestones and payments.
- The OOTB version is delivered as-is. Changes are change requests. Changes not merged into the product line are supported at day rates.

# Recommendation

- Lead with subscription for Small and Medium brokers: lower Year 1 cash, no capital approval, and a price point near 2% of commission income.
- Offer perpetual to Large and Enterprise brokers and to any broker with a horizon of four years or more: it costs 13% to 18% less over five years for the reference user counts.
- Quote infrastructure separately, and always show the self-hosting option, so the software price stays comparable with competitors.
- Review the Inputs once a year: exchange rate, cloud prices, day rates and the IC ranking.
