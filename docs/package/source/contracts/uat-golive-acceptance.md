---
title: Acceptance Certificates
subtitle: UAT sign-off and go-live
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before first use
acronyms: AMC=Annual Maintenance Contract; BIR=Bureau of Internal Revenue; MSA=Master Services Agreement; OOTB=Out of the box; PHP=Philippine peso; SIT=System integration test; SOW=Statement of work; UAT=User acceptance testing; VAT=Value-added tax
---

# About these certificates

> Template for discussion; subject to review by the parties' legal counsel.

This document holds two forms used under the Implementation Statement of Work (the **SOW**) for iNXT BrokerVerse OOTB:

- **Form 1: UAT Sign-off Certificate.** The Client's written acceptance of the user acceptance test phase. It is the milestone for the second implementation or onboarding payment (40%) and the condition for the go decision.
- **Form 2: Go-live Acceptance Certificate.** The record of the go decision and of the first day of transactions in production. It fixes the Go-Live date, which starts the final implementation payment (20%), the perpetual Licence Fee, the Monthly Fee of a subscription, the Warranty Period and hypercare.

Both forms are issued under the SOW of Order Form no. [number] and the Master Services Agreement (the **MSA**) between iorta TechNXT Corp. (**iorta TechNXT**) and [Client legal name] (the **Client**). Capitalised terms have the meaning given in the MSA and the SOW. A signed certificate records a fact and an acceptance. It does not amend the MSA, the Order Form or the SOW. Text in [square brackets] is a placeholder or an option.

# Rules that apply to both forms

## Acceptance criteria

The acceptance criteria are those of the Deliverables and acceptance criteria table of the SOW:

| Phase | Acceptance criteria in the SOW |
|---|---|
| UAT | All UAT scripts passed or accepted with a workaround; sign-off by each process owner and the sponsor |
| Cutover | Go/no-go criteria of the Data Migration and Cutover Plan met |
| Go-live | Users signed in and transacting; first receipts, remittances and bank imports processed |

## Review period and deemed acceptance

The Acceptance procedure of the SOW applies:

1. iorta TechNXT submits the certificate with the evidence listed in it.
2. The Client signs it, or gives a written list of the criteria not met with reasons, within 5 Business Days of submission.
3. iorta TechNXT corrects the items listed and resubmits. The Client reviews only the corrected items, within 3 Business Days.
4. The phase is **deemed accepted** if the Client gives no written objection within the review period, or if the Client uses the Platform in production for its business.
5. A phase is not rejected for defects of severity 3 or 4 alone. Those are listed in the certificate and corrected under an agreed plan.

> Deemed acceptance has the same effect as a signed certificate, including for the payment milestone. The iorta TechNXT project manager records the date and the basis of a deemed acceptance in the RAID log and informs the Client's sponsor in writing.

## Defect severity

| Severity | Meaning (SOW) |
|---|---|
| 1 | A core process cannot be completed, or financial postings are wrong, with no workaround |
| 2 | A core process is seriously degraded, with no acceptable workaround |
| 3 | A function fails and a workaround exists |
| 4 | Cosmetic issue, wording or documentation |

## What each signature means

| Signatory | Confirms |
|---|---|
| Process owner of each team | The team's UAT scripts were run with the Client's own data and the results are as recorded |
| Accounting Manager | Financial results, taxes and reconciliations in UAT and at cutover are as recorded |
| Client sponsor | The Client accepts the phase on behalf of the Client, as the SOW requires |
| iorta TechNXT project manager | The evidence is complete and the open items are recorded with their plan |

# Form 1: UAT Sign-off Certificate

## Project

| Field | Entry |
|---|---|
| Certificate no. | [UAT-year-number] |
| Project | iNXT BrokerVerse OOTB implementation for [Client legal name] |
| MSA and Order Form | MSA dated [date]; Order Form no. [number] |
| Implementation size | [Small / Medium / Large / Enterprise] |
| Environment tested | Test (UAT) environment, release [release tag] |
| UAT period | From [date] to [date]; [number] cycles |
| Data used | Configuration of the accepted configuration workbook; migrated data of mock load [number] dated [date] |
| Submitted by iorta TechNXT on | [date] |

## Evidence submitted

| # | Evidence | Reference |
|---|---|---|
| 1 | SIT exit report (all end-to-end flows passed; no open severity 1 or 2 defect) | [reference, date] |
| 2 | UAT results per script, with date, tester name and, for a failure, the record number and request ID | [reference] |
| 3 | Defect log at the date of this certificate | [reference] |
| 4 | Reconciliation report of the mock load used in UAT | [reference] |
| 5 | Client-specific scenarios agreed in discovery and their results | [reference] |
| 6 | Training attendance and key user assessment results to date | [reference] |

## UAT results by role

The delivered UAT scripts are run for each role, plus the Client-specific scenarios agreed in discovery.

| Role | Scripts | Passed | Passed with workaround | Failed | Not run |
|---|---|---|---|---|---|
| System Administrator | A1 to A7 | [n] | [n] | [n] | [n] |
| Sales & Marketing | S1 to S6 | [n] | [n] | [n] | [n] |
| Processing Team | P1 to P6 | [n] | [n] | [n] | [n] |
| Operations | O1 to O5 | [n] | [n] | [n] | [n] |
| Claims | C1 to C5 | [n] | [n] | [n] | [n] |
| Accounting | F1 to F8 | [n] | [n] | [n] | [n] |
| Accounting Manager | M1 to M5 | [n] | [n] | [n] | [n] |
| Client-specific scenarios | [list] | [n] | [n] | [n] | [n] |
| Total | 42 delivered scripts plus [n] | [n] | [n] | [n] | [n] |

A script marked Failed or Not run must be closed before this certificate is signed, or be re-classed as passed with a workaround that the process owner accepts below.

## Acceptance criteria check

| # | Criterion | Met | Evidence or comment |
|---|---|---|---|
| 1 | All UAT scripts passed or accepted with a workaround | [Yes / No] | [comment] |
| 2 | No open defect of severity 1 or 2 | [Yes / No] | [defect log reference] |
| 3 | Test quotation premiums and taxes agree with manual calculations | [Yes / No] | [scripts or calculation sheet] |
| 4 | VAT Summary and BIR working papers checked by the Accounting Manager (script F8) | [Yes / No] | [comment] |
| 5 | Document numbering and official receipt series checked (scripts A6, F1) | [Yes / No] | [comment] |
| 6 | Migrated data used in UAT reconciled | [Yes / No] | [mock load report] |
| 7 | Each process owner has signed below | [Yes / No] | |

## Workarounds accepted

| # | Script or defect | Workaround | Accepted by (process owner) |
|---|---|---|---|
| 1 | [reference] | [workaround] | [name] |
| 2 | [reference] | [workaround] | [name] |

## Open items (severity 3 and 4 only)

| # | Defect or item | Severity | Owner | Target date | Fix route |
|---|---|---|---|---|---|
| 1 | [description, defect no.] | [3 / 4] | [iorta TechNXT / Client] | [date] | [Configuration / data / release] |
| 2 | [description] | [3 / 4] | [owner] | [date] | [route] |

## Decision

| Field | Entry |
|---|---|
| Decision | [UAT accepted / UAT accepted with the open items above / Not accepted: list of criteria not met attached] |
| Effect | UAT sign-off milestone reached; the 40% implementation or onboarding payment is invoiced under the SOW |
| Next step | Go/no-go checkpoint 1 on [date]; planned go-live on [date] |

## Signatures

| Role | Name | Signature | Date |
|---|---|---|---|
| Process owner, Sales & Marketing | [name] | ____________ | [date] |
| Process owner, Processing Team | [name] | ____________ | [date] |
| Process owner, Operations | [name] | ____________ | [date] |
| Process owner, Claims | [name] | ____________ | [date] |
| Accounting Manager | [name] | ____________ | [date] |
| System Administrator | [name] | ____________ | [date] |
| Client sponsor (accepts for the Client) | [name, title] | ____________ | [date] |
| iorta TechNXT project manager | [name] | ____________ | [date] |

# Form 2: Go-live Acceptance Certificate

## Project

| Field | Entry |
|---|---|
| Certificate no. | [GL-year-number] |
| Project | iNXT BrokerVerse OOTB implementation for [Client legal name] |
| MSA and Order Form | MSA dated [date]; Order Form no. [number] |
| UAT Sign-off Certificate | [UAT-year-number], signed or deemed accepted on [date] |
| Production environment | [AWS Singapore / Azure Southeast Asia / local partner / Client hosted], release [release tag] |
| Go decision | Steering committee meeting of [date], minutes ref. [reference] |
| Go-Live date (first day of transactions) | [date] |
| Submitted by iorta TechNXT on | [date] |

## Go/no-go criteria

These are the criteria of the Data Migration and Cutover Plan, confirmed at the final go/no-go checkpoint.

| # | Criterion | Met | Evidence |
|---|---|---|---|
| 1 | UAT signed off by each process owner; no open severity 1 or 2 defect | [Yes / No] | UAT Sign-off Certificate |
| 2 | Final load reconciled: policy, open item and trial balance control figures agree exactly, or each difference explained and accepted in writing by the Accounting Manager | [Yes / No] | Final reconciliation report |
| 3 | Premiums Receivable equals the open items loaded; Due to Insurers reconciled | [Yes / No] | Reconciliation report |
| 4 | All users trained in their role and able to sign in | [Yes / No] | Attendance and assessment lists |
| 5 | Cutover checklist items 1 to 20 done | [Yes / No] | Signed cutover checklist |
| 6 | Hypercare team and support contacts in place for the first week | [Yes / No] | Hypercare roster |
| 7 | Rollback plan confirmed; old system available read-only | [Yes / No] | Rollback plan |

## Go-live criteria

These are the acceptance criteria of the Go-live phase in the SOW, checked in the first business days after the Go-Live date.

| # | Criterion | Met | Evidence |
|---|---|---|---|
| 1 | Users signed in and transacting in production | [Yes / No] | Sign-in history; Production Register |
| 2 | First official receipts issued | [Yes / No] | Receipts Register, first number [number] |
| 3 | First remittance to insurers processed | [Yes / No] | Remittance reference [reference] |
| 4 | First bank statement imported for each bank account in use | [Yes / No] | Bank reconciliation reference |
| 5 | Scheduled jobs and e-mail sending on and checked | [Yes / No] | Schedules screen; E-mail Outbox |
| 6 | Go-live communication sent to users, insurers and banks | [Yes / No] | [reference] |

## Dates set by this certificate

| Item | Date or effect |
|---|---|
| Go-Live | [date] |
| Implementation or onboarding payment, 20% | Invoiced on the Go-Live date |
| Perpetual Licence Fee, 100% (perpetual model) | Invoiced on the Go-Live date |
| Subscription Monthly Fee (subscription model) | Billed monthly in advance from the Go-Live date, first month prorated |
| Warranty Period (perpetual model) | 12 months, from [date] to [date] |
| AMC start (perpetual model) | First day of Year 2: [date] |
| Hypercare | From the Go-Live date until the Hypercare Exit and Handover to Support Certificate; planned exit [date], extended to cover the first month-end close |
| Rollback window | Until the end of the first business week: [date]; after that, fix forward |

## Open items at go-live (severity 3 and 4 only)

| # | Defect or item | Severity | Owner | Target date |
|---|---|---|---|---|
| 1 | [description] | [3 / 4] | [owner] | [date] |
| 2 | [description] | [3 / 4] | [owner] | [date] |

## Decision

| Field | Entry |
|---|---|
| Decision | [Go-live accepted / Go-live accepted with the open items above / Not accepted: reasons attached] |
| Deemed acceptance | If not signed or objected to within 5 Business Days of submission, go-live is deemed accepted under the SOW. Use of the Platform in production for the Client's business is also deemed acceptance. |

## Signatures

| Role | Name | Signature | Date |
|---|---|---|---|
| Accounting Manager (financial reconciliation) | [name] | ____________ | [date] |
| Client project manager | [name] | ____________ | [date] |
| Client sponsor (accepts for the Client) | [name, title] | ____________ | [date] |
| iorta TechNXT project manager | [name] | ____________ | [date] |
| iorta TechNXT head of delivery | [name] | ____________ | [date] |
