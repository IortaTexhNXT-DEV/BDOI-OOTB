---
title: Change Request Procedure
subtitle: With the Change Request Form
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: BA=Business analyst; CR=Change request; MSA=Master Services Agreement; OOTB=Out of the box; PHP=Philippine peso; PM=Project manager; QA=Quality assurance; SOW=Statement of work; UAT=User acceptance testing; VAT=Value-added tax
---

# About this template

> Template for discussion; subject to review by the parties' legal counsel.

This Change Request Procedure forms part of the Master Services Agreement (the **MSA**) between iorta TechNXT Corp. (**iorta TechNXT**) and [Client legal name] (the **Client**) and of each Order Form. It sets how changes are requested, estimated, approved, priced, delivered and accepted. The Change Request Form is in the last chapters. Text in [square brackets] is a placeholder or an option.

# Purpose and scope

## What is a change request

A change request (CR) is any request to change:

1. the scope, plan, size, Deliverables or timeline of an SOW, including a gap in the fit-gap register that the Client wants closed by a change rather than by configuration;
2. the iNXT BrokerVerse OOTB product for the Client: screens, workflows, reports, printed documents, integrations, database or jobs;
3. the Services of an Order Form, such as additional environments, training, data migration or integrations not already ordered.

## What is not a change request

1. Configuration that the Client can make in the delivered screens and settings, or that is in the scope of the SOW.
2. Correction of a defect in the OOTB product, which is handled under the warranty, the AMC or the Subscription.
3. Questions on how to use the product, which go to the service desk.

# Roles

| Role | Party | Responsibility |
|---|---|---|
| Requester | Client | Writes the CR with the business need and examples |
| Client change owner | Client | Reviews the impact assessment with the process owner and submits it for approval |
| iorta TechNXT project or account manager | iorta TechNXT | Logs the CR, coordinates the impact assessment and the estimate, tracks the CR to closure |
| Estimator | iorta TechNXT | Business analyst and lead developer who estimate the effort |
| Approver | Client | Approves by band, as set in the Approval chapter |
| Steering committee | Both | Approves Large CRs and any CR that affects the go-live date |

# Procedure

1. **Request.** The requester completes Part A of the Change Request Form and sends it to the iorta TechNXT project or account manager.
2. **Log.** iorta TechNXT logs the CR with a number and acknowledges it within 2 Business Days.
3. **Impact assessment.** iorta TechNXT returns Parts B and C (impact and estimate) within 5 Business Days for a Small CR and within 10 Business Days for a Medium or Large CR. The assessment states whether the need can be met by configuration instead.
4. **Clarification.** If more information is needed, the clock stops until the Client provides it.
5. **Review.** The Client change owner reviews the assessment with the process owner.
6. **Approval.** The approver of the band signs Part D, or rejects or defers the CR with the reason. Approval of the price is required before work starts.
7. **Plan.** The approved CR is added to the plan and the RAID log, with its delivery date.
8. **Build and test.** iorta TechNXT builds and tests the change in the test environment under its code fix and regression testing standards.
9. **UAT and acceptance.** The Client tests the change in UAT and accepts it in Part E within 5 Business Days of delivery to UAT. Deemed acceptance applies as in the SOW.
10. **Deploy.** The change is deployed to production under the release process of the Annual Maintenance and Support Agreement.
11. **Close.** iorta TechNXT closes the CR in the log. Rejected and deferred CRs stay in the log with the reason.

An impact assessment that takes more than 2 man-days of analysis (for example for a Large CR) may itself be charged as a Small CR, if the Client agrees in advance.

# Estimation

## Day rates

| Role | Day rate (PHP, excluding VAT) |
|---|---|
| Business analyst | 18,000.00 |
| Developer | 16,000.00 |
| QA engineer | 12,000.00 |
| Project manager | 22,000.00 |
| Blended rate | 16,100.00 |

A man-day is 8 hours. Day rates are fixed for 12 months from the date of the Order Form and may then be reviewed once a year with 60 days' written notice. The rates of the signed Order Form prevail over this table. The same rates, with the optional services, are listed in the Service Catalogue and Rate Annex.

## Estimation method

1. The developer man-days are estimated from the screens, APIs, reports, database changes and jobs affected.
2. Business analysis is 30% of development; testing is 40% of development; project management is 10% of analysis, development and testing; contingency is 10% of the total. Each line rounds up to the half day.
3. The price is the man-days of each role times the role's day rate, and the contingency at the blended rate.
4. The estimate is a fixed price for the described change unless Part C states it is on time and materials with a cap.

## Estimation bands

| Band | Total man-days | Indicative price range (PHP, blended) | Example | Example price (PHP) |
|---|---|---|---|---|
| Small | 0.5 to 5 | 8,050.00 to 80,500.00 | 2 developer days, 5 days in total | 81,050.00 |
| Medium | 5.5 to 20 | 88,550.00 to 322,000.00 | 7 developer days, 16 days in total | 250,150.00 |
| Large | 20.5 to 60 | 330,050.00 to 966,000.00 | 20 developer days, 42 days in total | 665,400.00 |
| Project | Above 60 | Separate SOW | Not applicable | Not applicable |

Examples of each band: Small, a new report column or filter, document template wording, a new validation or field; Medium, a new report, letter or statement, a change to a commission or tax computation, a new upload template; Large, a new screen set, a new insurer or bank integration, a new workflow with approvals.

# Approval

| Band | Client approver | iorta TechNXT approver |
|---|---|---|
| Small | Client IT or operations head | Project or account manager |
| Medium | Client sponsor | Head of delivery |
| Large | Steering committee | Head of delivery and sales head |
| Project (above 60 man-days) | Separate SOW signed by authorised signatories | Authorised signatory |

Any CR that moves the go-live date or the total fees of an Order Form by more than [10%] needs the written approval of the Client sponsor and the steering committee, whatever its band.

# Impact on timeline and fees

1. The impact assessment states the effect of the CR on: the plan and the go-live date; other Deliverables; the fees; the recurring fees (for example a new environment or a new integration that needs monitoring); support.
2. An approved CR changes the plan and the fees of the Order Form from its approval date. The Order Form is not otherwise amended.
3. CRs approved during the implementation may be scheduled after go-live so that the OOTB go-live date holds. The steering committee decides.
4. Delay caused by a CR that the Client approves is not a delay attributable to iorta TechNXT.

# Payment

| Band | Payment terms |
|---|---|
| Small | 100% on delivery to production |
| Medium | 50% on approval, 50% on UAT sign-off |
| Large | 30% on approval, 50% on UAT sign-off, 20% on deployment to production |
| Time and materials | Monthly in arrears at actual man-days, up to the approved cap |

Invoices are payable within 30 days; VAT is added and withholding tax is handled under the MSA.

# Delivery, warranty and support of changes

1. iorta TechNXT corrects defects in a delivered CR found within 30 days of its deployment to production at no charge.
2. A CR changes the OOTB version for the Client only. The changed code is covered by the AMC or the Subscription only when iorta TechNXT merges it into the product line, which iorta TechNXT decides and states in Part C. Otherwise, support of the change after the 30-day period is billed at day rates.
3. All Intellectual Property Rights in the work product of a CR belong to iorta TechNXT, as stated in the MSA. Client Data and the Client's own content remain the Client's.

# Emergency changes

A change needed to restore service or meet a legal deadline may be made on the verbal approval of the Client approver of the band, confirmed by e-mail within 1 Business Day, with the Change Request Form completed within 5 Business Days.

# Change Request Form

## Part A: request (Client)

| Field | Entry |
|---|---|
| CR number (assigned by iorta TechNXT) | [CR-year-number] |
| Order Form or contract | [number] |
| Date raised | [date] |
| Requester (name, role, e-mail) | [entry] |
| Title of the change | [short title] |
| Description of the change | [what should change; screens, reports, documents affected] |
| Business reason and benefit | [why the change is needed] |
| Examples and attachments | [sample documents, screenshots with personal data covered] |
| Requested by date and reason | [date; reason, for example a regulatory deadline] |
| Priority proposed | [High / Medium / Low] |
| Regulatory or legal driver | [Yes: reference / No] |

## Part B: impact assessment (iorta TechNXT)

| Field | Entry |
|---|---|
| Need met by configuration instead | [Yes: how / No] |
| Modules, screens, APIs, reports, database and jobs affected | [list] |
| Effect on other Deliverables | [entry] |
| Effect on the plan and the go-live date | [none / number of days] |
| Effect on recurring fees and support | [entry] |
| Risks and assumptions | [entry] |
| Change merged into the product line | [Yes / No / To be decided] |

## Part C: estimate (iorta TechNXT)

| Role | Man-days | Day rate (PHP) | Amount (PHP) |
|---|---|---|---|
| Developer | [days] | 16,000.00 | [amount] |
| Business analyst (30% of development) | [days] | 18,000.00 | [amount] |
| QA engineer (40% of development) | [days] | 12,000.00 | [amount] |
| Project manager (10% of the above) | [days] | 22,000.00 | [amount] |
| Contingency (10% of the total) | [days] | 16,100.00 | [amount] |
| Total, excluding VAT | [days] | | [amount] |

| Field | Entry |
|---|---|
| Band | [Small / Medium / Large] |
| Pricing basis | [Fixed price / Time and materials with a cap of PHP amount] |
| Payment terms | [per the band] |
| Proposed delivery to UAT | [date] |
| Proposed deployment to production | [date] |
| Estimate valid until | [date, 30 days from issue] |
| Prepared by | [name, role, date] |

## Part D: approval (Client)

| Decision | Name and title | Signature | Date |
|---|---|---|---|
| [Approved / Rejected / Deferred to date] | [Client approver of the band] | ____________ | [date] |
| Reason if rejected or deferred | [entry] | | |
| Accepted for iorta TechNXT | [name and title] | ____________ | [date] |

## Part E: acceptance and closure

| Field | Entry |
|---|---|
| Delivered to UAT on | [date] |
| UAT result | [Accepted / Accepted with open items / Not accepted: reasons] |
| Accepted by (Client) | [name, title, signature, date] |
| Deployed to production on | [date, release number] |
| Closed by (iorta TechNXT) | [name, date] |

# Change log

| CR number | Title | Band | Man-days | Price (PHP) | Status | Approved on | Delivered on | Closed on |
|---|---|---|---|---|---|---|---|---|
| [CR-2026-001] | [title] | [band] | [days] | [amount] | [status] | [date] | [date] | [date] |

Status values: Logged, Assessed, Approved, In progress, In UAT, Deployed, Closed, Rejected, Deferred.
