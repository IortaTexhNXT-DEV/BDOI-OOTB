---
title: Hypercare Exit Certificate
subtitle: And handover to support
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before first use
acronyms: AMC=Annual Maintenance Contract; BIR=Bureau of Internal Revenue; DPO=Data protection officer; DR=Disaster recovery; L1/L2/L3=Support levels 1, 2 and 3; MSA=Master Services Agreement; OOTB=Out of the box; PHT=Philippine time; SLA=Service level agreement; SOW=Statement of work; UAT=User acceptance testing
---

# About this certificate

> Template for discussion; subject to review by the parties' legal counsel.

This Hypercare Exit and Handover to Support Certificate records the end of hypercare under the Implementation Statement of Work (the **SOW**) and the start of production support under the Annual Maintenance and Support Agreement and Service Level Agreement (the **Support Agreement**) for iNXT BrokerVerse OOTB. It is issued under Order Form no. [number] and the Master Services Agreement (the **MSA**) between iorta TechNXT Corp. (**iorta TechNXT**) and [Client legal name] (the **Client**).

It has four parts: the exit criteria, the list of open items, the known issues, and the handover checklist to the Support Agreement. Capitalised terms have the meaning given in the MSA, the SOW and the Support Agreement. Text in [square brackets] is a placeholder or an option.

## When it is used

- Hypercare runs from Go-Live until the first month-end close is done: by default weeks 7 and 8 (Small), weeks 10 to 12 (Medium), 4 to 6 weeks (Large) or as planned at mobilisation (Enterprise). If the first month-end close falls after that window, hypercare extends to cover it at no extra charge.
- iorta TechNXT submits this certificate when the exit criteria are met. The Acceptance procedure of the SOW applies: the Client signs it, or lists the criteria not met with reasons, within 5 Business Days. If the Client does neither, the hypercare exit is deemed accepted.
- From the handover date, tickets are raised through the service desk of the Support Agreement and the service levels of the Support Agreement apply. During the Warranty Period of a perpetual licence, support is at no charge; for a subscription, support is included in the Monthly Fee.

# Project and dates

| Field | Entry |
|---|---|
| Certificate no. | [HC-year-number] |
| Project | iNXT BrokerVerse OOTB implementation for [Client legal name] |
| MSA and Order Form | MSA dated [date]; Order Form no. [number] |
| Go-live Acceptance Certificate | [GL-year-number], dated [date] |
| Go-Live date | [date] |
| Hypercare period | From [date] to [date] ([extended to cover the first month-end close: yes / no]) |
| First month-end close | Period [month year], Month-End Close run approved on [date] |
| Production release at handover | [release tag], deployed on [date] |
| Handover meeting | Held on [date]; minutes ref. [reference] |
| Handover date (start of support under the Support Agreement) | [date] |
| Licence model | [Perpetual: Warranty Period to [date]; AMC from [date] / Subscription: support included] |
| Extended P1 support (24x7 Severity 1 support) | [Yes, from [date] / No] |

# Exit criteria

These are the hypercare acceptance criteria of the SOW and the handover criteria of the Production Support Approach and Standards.

| # | Criterion | Met | Evidence |
|---|---|---|---|
| 1 | No open P1 or P2 issue (severity 1 or 2) | [Yes / No] | Hypercare log ref. [reference] |
| 2 | First month-end close completed with the Accounting Manager's approval | [Yes / No] | Month-End Close run approved; trial balance reviewed |
| 3 | BIR working papers of the first month produced and reviewed by the Client | [Yes / No] | [reference] |
| 4 | Known issues and workarounds documented | [Yes / No] | Known-error records in the knowledge base |
| 5 | Environment documentation current | [Yes / No] | Environment sheet: addresses, versions, release tag, backups, monitoring, secrets owners |
| 6 | Configuration baseline recorded | [Yes / No] | Configuration workbook as built in production, dated [date] |
| 7 | Contacts and escalation matrix agreed | [Yes / No] | Annex A of the Support Agreement completed |
| 8 | L1 super users trained on raising tickets | [Yes / No] | Attendance and a test ticket no. [number] |
| 9 | Monitoring and alarms live; first backup verification passed | [Yes / No] | Monitoring dashboard; restore test record of [date] |
| 10 | Handover accepted by production support and the System Administrator | [Yes / No] | Signatures below |

# Open items and known issues

## Open items

Open P3 and P4 items move to the production support backlog with their history. They do not prevent hypercare exit. Change requests that were approved during the project and scheduled after go-live stay under the Change Request Procedure.

### Open defects and requests

| # | Ticket or defect no. | Description | Severity | Owner | Target date | Route |
|---|---|---|---|---|---|---|
| 1 | [number] | [description] | [P3 / P4] | [iorta TechNXT / Client] | [date] | [Configuration / data correction / planned release] |
| 2 | [number] | [description] | [P3 / P4] | [owner] | [date] | [route] |
| 3 | [number] | [description] | [P3 / P4] | [owner] | [date] | [route] |

### Change requests in progress

| # | CR number | Title | Status | Planned deployment |
|---|---|---|---|---|
| 1 | [CR-year-number] | [title] | [Approved / In progress / In UAT] | [date] |
| 2 | [CR-year-number] | [title] | [status] | [date] |

### Client actions outstanding

| # | Action | Owner (Client) | Due date |
|---|---|---|---|
| 1 | [for example: switch on two-step verification for the remaining roles] | [name] | [date] |
| 2 | [for example: confirm the retention instruction for year-end backup copies] | [name] | [date] |
| 3 | [for example: keep the old system read-only for the period the Client's record-keeping rules require] | [name] | [date] |

## Known issues

Known issues are items with a documented cause and a workaround, recorded as known-error records in the knowledge base. They are handled under the Support Agreement and fixed in a planned release where a fix is due.

### Known issues found in this implementation

| # | Known-error record | Symptom | Workaround | Fix planned |
|---|---|---|---|---|
| 1 | [KE-number] | [symptom] | [workaround] | [release or none] |
| 2 | [KE-number] | [symptom] | [workaround] | [release or none] |

### Known limitations of the release

The release notes and the user manual (Appendix G, Known limitations) list the limitations of the OOTB release in use. Record here those that the Client has seen and accepted; delete the rest. The examples below are taken from the release documentation of the tested release and must be checked against the release in production.

| # | Limitation | Agreed handling |
|---|---|---|
| 1 | Two-step enrolment shows a setup key and a link, not a QR code | Users type the key in the authenticator app |
| 2 | Several masters have no Upload button; their templates are loaded by the System Administrator | System Administrator procedure |
| 3 | The BIR reports give the figures in the BIR column order | The Client validates them with the BIR's tools before filing |
| 4 | No bank payment file is produced; transfers are approved and their bank result recorded | Change request if a bank file format is needed |
| 5 | [other limitation in the release notes] | [handling] |

# Handover checklist to the Support Agreement

Each item is checked by the iorta TechNXT support manager and the Client IT head at the handover meeting.

## Service set-up

| # | Item | Done | Reference |
|---|---|---|---|
| 1 | Service desk details given to the Client: portal or mailbox, and the P1 telephone line | [Yes / No] | Annex A of the Support Agreement |
| 2 | Named L1 contacts of the Client (up to [5]) registered on the service desk | [Yes / No] | [names] |
| 3 | Escalation matrix with names and telephone numbers on both sides | [Yes / No] | Annex A |
| 4 | Service hours confirmed: 08:00 to 18:00 PHT, Monday to Friday, except Philippine regular holidays; extended P1 option [Yes / No] | [Yes / No] | Order Form |
| 5 | Severity levels, response and restore targets and clock rules explained to the L1 contacts | [Yes / No] | Briefing date [date] |
| 6 | Minimum content of a ticket explained; a test ticket raised and closed | [Yes / No] | Ticket no. [number] |
| 7 | Planned maintenance window agreed (default Saturday 20:00 to Sunday 06:00 PHT) | [Yes / No] | [window] |
| 8 | First monthly service report due date and monthly service review date set | [Yes / No] | [dates] |

## Technical handover

| # | Item | Done | Reference |
|---|---|---|---|
| 9 | Environment sheet current (addresses, versions, release tag, backups, monitoring, owners of the secrets) | [Yes / No] | [reference] |
| 10 | Monitoring and alarms live and routed to the support team | [Yes / No] | [reference] |
| 11 | Backups running; first restore test passed | [Yes / No] | Restore test of [date] |
| 12 | Sealed escrow copy of the encryption key and application secrets in place under dual control | [Yes / No / Client hosted: Client confirms] | [reference] |
| 13 | Scheduled jobs reviewed with Accounting; daily health check started | [Yes / No] | [reference] |
| 14 | Where the Client hosts: deployment guide handed over; release deployment responsibilities agreed | [Yes / No / Not applicable] | [reference] |

## Knowledge handover

| # | Item | Done | Reference |
|---|---|---|---|
| 15 | Configuration baseline as built in production handed to the System Administrator | [Yes / No] | [reference] |
| 16 | Hypercare log, defect log and RAID log closed or transferred | [Yes / No] | [reference] |
| 17 | Knowledge base access given to the L1 contacts; known-error records published | [Yes / No] | [reference] |
| 18 | Change control for configuration and data corrections in production explained (standard, normal and emergency changes) | [Yes / No] | [reference] |
| 19 | Release process explained: release notes, UAT of releases, Client approval, deployment in the maintenance window | [Yes / No] | [reference] |
| 20 | Training of users who join after go-live assigned to the key users | [Yes / No] | [reference] |

## Commercial and contract items

| # | Item | Entry |
|---|---|---|
| 21 | Warranty Period (perpetual) | From [date] to [date] |
| 22 | AMC start and first AMC invoice (perpetual) | [date]; 22% of the Licence Fee, yearly in advance, increasing 5% at each anniversary |
| 23 | Subscription Monthly Fee (subscription) | Billed from Go-Live: [date] |
| 24 | Hosting fee (if iorta TechNXT hosts) | Billed from environment handover: [date] |
| 25 | All implementation milestones invoiced (40% on signing, 40% on UAT sign-off, 20% on go-live) | [Yes / No] |
| 26 | Source code escrow deposit due (perpetual, if selected) | Within 60 days of Go-Live: by [date] |

# Decision and signatures

| Field | Entry |
|---|---|
| Decision | [Hypercare exit accepted / Accepted with the open items above / Not accepted: criteria not met attached] |
| Effect | The project team hands over to production support. From the handover date the service levels of the Support Agreement apply and tickets go through the service desk. |
| Deemed acceptance | If the Client neither signs nor gives a written list of the criteria not met within 5 Business Days of submission, the hypercare exit is deemed accepted under the SOW. |

| Role | Name | Signature | Date |
|---|---|---|---|
| Client System Administrator | [name] | ____________ | [date] |
| Client IT head | [name] | ____________ | [date] |
| Client Accounting Manager | [name] | ____________ | [date] |
| Client sponsor (accepts for the Client) | [name, title] | ____________ | [date] |
| iorta TechNXT project manager | [name] | ____________ | [date] |
| iorta TechNXT support manager | [name] | ____________ | [date] |
| iorta TechNXT head of delivery | [name] | ____________ | [date] |
