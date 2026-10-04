---
title: Negotiation Playbook
subtitle: INTERNAL: not for clients
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: To be completed
approved: To be completed
acronyms: AM=Account manager; AMC=Annual Maintenance Contract; CEO=Chief executive officer; CR=Change request; Dev=Development environment; LOB=Line of business; MSA=Master Services Agreement; OOTB=Out of the box; PHP=Philippine peso; Pre-Prod=Pre-production environment; SH=Sales head; SIT=System integration test; SLA=Service level agreement; SOW=Statement of work; UAT=User acceptance test; VAT=Value-added tax
---

# Purpose and handling

This playbook tells the iorta TechNXT Corp. sales team how far it may move on the price of iNXT BrokerVerse OOTB, who approves each step, and what to ask for in return. It goes with the price book workbook `iNXT_BrokerVerse_Price_Book.xlsx` (Negotiation and Pre-set Packages sheets).

> INTERNAL. Do not send, forward, print for or show this document to a client or a partner. The client copy of the prices is the Rate Card. The floor prices in this document are confidential information of iorta TechNXT Corp.

All figures are in PHP and exclude 12% VAT. List prices are the recommended price points of the pricing workbook `BrokerVerse_Commercials_and_Pricing.xlsx`. Discounts are always measured against the list price of each component.

# Principles

- Start at list price. Show the list price in every presentation and in the first quotation.
- Trade, do not give. Every concession is exchanged for something of value to iorta TechNXT: term, cash timing, a reference, scope or a signing date.
- Move scope before price. A smaller scope at full rate keeps the price list intact; a discount weakens it for every later deal.
- Protect the recurring line. Subscription, AMC and hosting fund support for years. One-time fees can move more easily than recurring fees.
- Never go below the floor. The floor is the CEO limit. Nobody can approve a price below it.
- Write it down. Every discount appears as a separate line on the quotation and the Order Form, with the lever named.

# Approval matrix

## Maximum discount off list by approver

| Component | Account manager | Sales head | CEO | Floor (never below) |
|---|---|---|---|---|
| Perpetual licence fee | 5% | 10% | 15% | 85% of list |
| Subscription per user per month | 5% | 10% | 15% | 85% of list |
| Implementation or onboarding fee | 5% | 10% | 15% | 85% of list |
| One-time optional services and 24x7 support | 5% | 10% | 15% | 85% of list |
| Hosting per month | 0% | 5% | 10% | 90% of list |
| Change requests and day rates | 0% | 5% | 10% | 90% of list |
| AMC rate (22%) and yearly escalation (5%) | Not discounted | Not discounted | Not discounted | 22% and 5% |

- The approver is set by the highest discount on any component. A deal with 4% on subscription and 7% on implementation needs the sales head.
- Levers that "count toward the limit" (chapter 5) add to the discretionary discount. The total may not pass the CEO limit.
- AMC follows the quoted (net) licence fee. A discount on the licence therefore also lowers the AMC. This is why the licence discount needs care.
- Hosting carries a 20% margin over the estimated cloud cost of each environment. At 10% off, about 8% remains for exchange rate movement and operations. Never discount hosting to win the software deal, and never drop an environment of the set (Dev, UAT, SIT for large brokers) or the Pre-Prod months to lower the price: the environment set by broker size is a product owner decision, not a lever.

## Recording the approval

1. The account manager enters the discounts in the Quick Quote sheet. The sheet shows the approver needed.
2. The account manager sends the approver the Quick Quote, the reason, the levers offered and what the client gives in return.
3. The approver replies in writing (e-mail is enough). The approval is filed in the deal file before the quotation leaves iorta TechNXT.
4. A CEO approval also records the expected 5-year contract value at list and at the quoted price.

# Floor prices

## Rates at the floor

| Size | Perpetual licence per user, slab rate (list / floor) | Subscription per user per month, slab rate (list / floor) | Implementation, reference scope (list / floor) | AWS hosting per month (list / floor) |
|---|---|---|---|---|
| Small | 90,000 / 76,500 | 3,200 / 2,720 | 1,130,000 / 960,500 | 43,000 / 38,700 |
| Medium | 78,000 / 66,300 | 2,800 / 2,380 | 2,090,000 / 1,776,500 | 69,000 / 62,100 |
| Large | 66,000 / 56,100 | 2,400 / 2,040 | 3,700,000 / 3,145,000 | 143,000 / 128,700 |
| Enterprise | 54,000 / 45,900 | 2,000 / 1,700 | 5,800,000 / 4,930,000 | 256,000 / 230,400 |

The graduated slabs still apply at the floor: each slab rate is reduced by the floor discount. AWS hosting is the standing environment set of the size: Dev, UAT and Production for Small and Medium; Dev, SIT, UAT and Production with high availability for Large and Enterprise. The temporary Pre-Prod (AWS list PHP 21,000, 47,000, 86,000 and 169,000 per month of use by size) follows the same hosting floor.

## Pre-set packages at list and at the floor

Year 1 and 5-year totals, reference users and lines of business, all components at the floor. Hosted packages include 2 months of Pre-Prod in Year 1 and 1 month a year after.

| Size and package | Year 1, list | Year 1, floor | 5-year, list | 5-year, floor |
|---|---|---|---|---|
| Small: Essentials | 1,706,000 | 1,450,100 | 4,312,764 | 3,665,849 |
| Small: Standard | 2,264,000 | 1,952,300 | 7,018,764 | 6,101,249 |
| Small: Ownership | 3,038,000 | 2,610,200 | 6,466,107 | 5,631,491 |
| Small: Ownership Plus | 3,564,000 | 3,056,600 | 8,026,259 | 6,954,320 |
| Medium: Essentials | 4,226,000 | 3,592,100 | 13,892,748 | 11,808,836 |
| Medium: Standard | 5,148,000 | 4,421,900 | 18,314,748 | 15,788,636 |
| Medium: Ownership | 7,992,000 | 6,839,300 | 16,214,173 | 14,003,147 |
| Medium: Ownership Plus | 8,744,000 | 7,477,100 | 19,034,476 | 16,393,805 |
| Large: Essentials | 9,484,000 | 8,061,400 | 35,660,251 | 30,311,213 |
| Large: Standard | 11,372,000 | 9,760,600 | 44,756,251 | 38,497,613 |
| Large: Ownership | 18,968,000 | 16,217,200 | 38,863,284 | 33,488,591 |
| Large: Ownership Plus | 20,064,000 | 17,143,600 | 43,632,352 | 37,517,099 |
| Enterprise: Essentials | 17,440,000 | 14,824,000 | 70,118,348 | 59,600,596 |
| Enterprise: Standard | 20,850,000 | 17,893,000 | 86,492,348 | 74,337,196 |
| Enterprise: Ownership | 35,910,000 | 30,694,000 | 74,191,674 | 63,881,623 |
| Enterprise: Ownership Plus | 37,524,000 | 32,056,600 | 81,886,121 | 70,377,203 |

In the floor figures, the one-time services and the 24x7 Severity 1 support of Ownership Plus are also at 85% of list, and hosting at 90% of list.

# Give and get levers

| Lever | What iorta TechNXT gets | Allowed price effect | Approver | Counts toward the limit |
|---|---|---|---|---|
| Longer term | 3-year or 5-year committed term, no termination for convenience | 3 years: up to 3% off subscription; 5 years: up to 5% | AM (3%), SH (5%) | Yes |
| Upfront payment | Subscription paid yearly in advance, or implementation 100% on signing | Subscription yearly in advance: up to 4% off the prepaid amount; implementation 100% on signing: up to 3% | AM | Yes |
| Reference customer | Named as a client, logo use, two reference calls a year | Up to 2% off licence or subscription | AM | Yes |
| Case study | Joint published case study within 6 months of go-live | Up to 2%, or a PHP 100,000.00 credit against change requests | SH | Yes |
| Multi-year AMC prepayment | AMC for 3 years paid at the start of the AMC term | AMC for the prepaid years held at the first AMC year rate (about 5% of the prepaid AMC) | CEO | No (AMC lever) |
| Reduced scope | Fewer lines of business at go-live, broker loads its own data, remote training only | Implementation falls by the man-days removed at the blended rate (6 man-days per line of business) | AM | No (not a discount) |
| Phased users | Contract for the full user count, delivered in tranches | Billing per tranche; slab prices locked for 24 months | SH | No |
| Signing date | Order Form signed by a stated date | Up to 2% off licence or subscription | SH | Yes |
| Onboarding reduction | 5-year subscription term | Onboarding fee at 90% of the implementation fee | SH | Yes |

## How to use the levers

- Offer one lever at a time and ask for the get first: "If you can sign a 3-year term, I can take 3% off the subscription."
- Do not stack more than three levers on one deal without the sales head.
- A lever lapses if the get is not delivered: a missed prepayment, a withdrawn reference or a late signature returns the price to the level before the lever. Write this into the Order Form.
- Reduced scope must be real. Removed lines of business are added later at PHP 100,000.00 per line; removed data migration is added later at PHP 240,000.00 per legacy source.
- Phasing keeps the minimum billable users of the size for subscription.

# Typical client positions and answers

| Client position | Answer |
|---|---|
| "The subscription is too high." | Show the per-user price against the market (USD 32 to 51 per user per month against USD 125 to 300 for global broker systems), then offer the 3-year term lever. |
| "We cannot pay the implementation up front." | The schedule is already 40/40/20 by milestone. Offer phased users or reduced scope at go-live rather than a discount. |
| "Our IT will host it." | Accept: the Essentials package. Hosting is never bundled into the software price. Offer set-up support at day rates. |
| "Waive the AMC." | AMC is not discounted. Offer the 12-month warranty already included, or the multi-year AMC prepayment lever. |
| "Remove the yearly 5% increase." | The escalation stays. The multi-year AMC prepayment lever holds it for the prepaid years only. |
| "Another vendor is cheaper." | Ask for the scope compared: Philippine taxes, BIR working papers, remittance and reconciliation are included here. Do not match a price without a like-for-like scope. |
| "Add a few customisations for free." | Customisation is a change request at day rates. A free item counts as a 100% discount on that item and needs approval within the limits. |
| "Data must stay in the Philippines." | Offer the local partner hosting option. It costs less than AWS or Azure in the price list. |

# Contract positions

The price is only part of the deal. The following positions protect the value of the contract. Changes to them need the approval shown.

| Position | Standard | Who may change it |
|---|---|---|
| Limitation of liability | Fees paid and payable in the 12 months before the event giving rise to the claim (as in the MSA); no indirect or consequential loss | CEO with legal counsel |
| Platform IP | iorta TechNXT retains all rights in the platform; the client owns its data | Not negotiable |
| Payment term | 30 days from invoice | SH up to 45 days |
| Suspension | Subscription and hosting after 60 days of non-payment, with notice | CEO |
| Subscription minimum term | 12 months | Not negotiable |
| Auto-renewal | Yearly after the initial term, 90 days' notice to stop | SH |
| Source code escrow | Optional, at the client's cost, perpetual licence only | SH |
| Service credits | Capped at 10% of the monthly fee of the affected service | CEO with legal counsel |
| Governing law and venue | Philippine law; dispute steps of the MSA | Legal counsel |

# Process and documents

1. Present with the Quick Quote at list price and the Rate Card.
2. Send the quotation (Quick Quote print area) with the Validity and Terms sheet within 2 business days of the meeting.
3. Negotiate with levers. Record approvals.
4. Issue the Order Form with the agreed prices, discounts as separate lines, and the levers' conditions.
5. Contract set: Master Services Agreement, Order Form, the licence or subscription agreement, the Implementation SOW, the Annual Maintenance and Support Agreement (perpetual) or the SLA schedule (subscription), the Hosting Services Agreement if iorta TechNXT hosts, and the Data Processing Agreement.
6. Hand the signed deal file to delivery and finance.

# Owner decisions open

- Confirm the approval limits and the floor (this playbook uses the limits set by the business owner: 5%, 10% and 15%).
- Confirm that AMC is computed on the quoted (net) licence fee rather than on the list licence fee.
- Confirm the early termination fee for committed terms (all remaining fees, or 50% of them).
- Confirm the lever values (term, upfront payment, reference, case study, signing date).
