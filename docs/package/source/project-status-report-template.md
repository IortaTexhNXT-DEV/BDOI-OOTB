---
title: Project Status Report
subtitle: BrokerVerse OOTB implementation, template
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Template; copy for each reporting period
open_item: Replace every [placeholder] before the report is sent
open_item_owner: iorta TechNXT project manager
acronyms: OOTB=Out of the box; PM=Project manager; RAG=Red, amber, green; RAID=Risks, assumptions, issues and dependencies; CR=Change request; SIT=System integration test; UAT=User acceptance test; DPO=Data protection officer
---

# How to use this template

The iorta TechNXT project manager writes this report every week for the weekly status meeting, and every two weeks for the steering committee, as set out in the governance chapter of the Implementation Approach and Plan. Copy the template for each period, keep the chapter order, and replace every text in [square brackets]. Delete this chapter in the copy that is sent.

- Write facts: what was done, what was not, and why. Name the person who owns each action.
- The overall status and each workstream use the RAG scale below against the baselined plan. A status is never improved without a reason.
- RAID items, fit-gap counts and change requests are copied from BrokerVerse_RAID_Log_Template.xlsx, BrokerVerse_Fit_Gap_Register.xlsx and the change request log. The report does not keep its own list.
- Send the report one business day before the meeting, as PDF, to the distribution list of the project charter.

| Status | Meaning |
|---|---|
| Green | On plan. Milestones of the period met; no issue needs the steering committee. |
| Amber | At risk. A milestone may slip by up to one week, or an issue needs a decision within the next period; recovery is in the team's hands. |
| Red | Off plan. A milestone has slipped, or will slip by more than one week, or go-live, budget or compliance is at risk; a steering committee decision is needed. |

# Report identification

| Field | Entry |
|---|---|
| Project | iNXT BrokerVerse OOTB implementation for [Client legal name] |
| Size and plan | [Small 8 weeks / Medium 12 weeks / Large 16 to 20 weeks], baselined on [date] |
| Report no. and type | [SR-nn]; [Weekly status / Steering committee] |
| Period | [date] to [date] (week [n] of [N]) |
| Prepared by | [name], iorta TechNXT project manager |
| Broker project manager | [name] |
| Distribution | [sponsor, steering committee members, project leads] |

# Overall status

| Item | Status | Previous | Comment |
|---|---|---|---|
| Overall | [Green / Amber / Red] | [G/A/R] | [one or two sentences: where the project stands and why] |
| Schedule | [G/A/R] | [G/A/R] | [milestones met or slipped] |
| Scope | [G/A/R] | [G/A/R] | [fit-gap position; change requests] |
| Budget and effort | [G/A/R] | [G/A/R] | [days used against plan; change requests priced] |
| Data readiness | [G/A/R] | [G/A/R] | [extracts received, mock load results] |
| Quality | [G/A/R] | [G/A/R] | [SIT or UAT defects by severity] |
| People and readiness | [G/A/R] | [G/A/R] | [key user availability, training] |

## Summary for the sponsor

[Three to five lines: the main progress of the period, the main concern, and the decision asked of the steering committee, if any.]

# Progress by workstream

| Workstream | Done this period | Planned and not done | Status |
|---|---|---|---|
| Mobilisation and governance | [ ] | [ ] | [G/A/R] |
| Discovery and fit-gap | [ ] | [ ] | [G/A/R] |
| Environments and hosting | [ ] | [ ] | [G/A/R] |
| Configuration | [ ] | [ ] | [G/A/R] |
| Data migration | [ ] | [ ] | [G/A/R] |
| Integrations (e-mail, bank formats, payment gateway) | [ ] | [ ] | [G/A/R] |
| Training | [ ] | [ ] | [G/A/R] |
| SIT and UAT | [ ] | [ ] | [G/A/R] |
| Cutover and go-live | [ ] | [ ] | [G/A/R] |
| Hypercare | [ ] | [ ] | [G/A/R] |

# Milestones

The milestones are those of the Implementation Statement of Work for the agreed size. Keep the baseline date; record a new forecast with its reason.

| Milestone | Baseline | Forecast | Actual | Status | Comment |
|---|---|---|---|---|---|
| Kick-off held | [week / date] | [ ] | [ ] | [G/A/R] | [ ] |
| Configuration workbook and fit-gap register signed | [ ] | [ ] | [ ] | [G/A/R] | [ ] |
| Mock load 1 reconciled | [ ] | [ ] | [ ] | [G/A/R] | [ ] |
| SIT exit report | [ ] | [ ] | [ ] | [G/A/R] | [ ] |
| UAT sign-off and go decision | [ ] | [ ] | [ ] | [G/A/R] | [ ] |
| Go-live | [ ] | [ ] | [ ] | [G/A/R] | [ ] |
| First month-end close in BrokerVerse | [ ] | [ ] | [ ] | [G/A/R] | [ ] |
| Hypercare exit and handover | [ ] | [ ] | [ ] | [G/A/R] | [ ] |

# Scope: fit-gap and change requests

| Fit | Configure | Procedure | Gap | Lines open |
|---|---|---|---|---|
| [n] | [n] | [n] | [n] | [n] |

| CR no. | Title | Effort (days) | Effect on go-live | Status |
|---|---|---|---|---|
| [CR-nnn] | [ ] | [ ] | [none / date moves to ...] | [Raised / Estimated / Approved / Rejected / Deferred / Delivered] |

# Data migration and testing

| Item | Planned | Actual | Comment |
|---|---|---|---|
| Extracts received (masters, in-force policies, open items, trial balance) | [n of N] | [ ] | [ ] |
| Last mock load: rows loaded, rejected | [ ] | [ ] | [reconciliation of counts and totals] |
| Test cases run, passed, failed, blocked | [ ] | [ ] | [cycle and environment] |
| Open defects by severity (critical, high, medium, low) | | [n, n, n, n] | [ ] |

# RAID: top items

Copy the open items rated High and any item that needs the steering committee from the RAID log. The full log is attached or shared.

| ID | Type | Description | Rating | Owner | Action and due date | Status |
|---|---|---|---|---|---|---|
| [R-nnn] | Risk | [ ] | [High] | [ ] | [ ] | [Open] |
| [I-nnn] | Issue | [ ] | [High] | [ ] | [ ] | [In progress] |
| [D-nnn] | Dependency | [ ] | [Late / At risk] | [ ] | [ ] | [ ] |

| Open risks (H / M / L) | Open issues (H / M / L) | Assumptions to validate | Dependencies late or at risk |
|---|---|---|---|
| [n / n / n] | [n / n / n] | [n] | [n] |

# Decisions needed

| No. | Decision needed | Options and recommendation | Needed by | Decision maker | Outcome |
|---|---|---|---|---|---|
| 1 | [for example: approve CR-nnn, accept the go-live date, confirm the DST rounding with the insurers] | [options; recommended option and why] | [date] | [Sponsor / steering committee / process owner] | [to be recorded after the meeting] |

# Next period

| Activity | Owner | Due |
|---|---|---|
| [ ] | [ ] | [date] |

## Broker inputs due in the next period

| Input | From | Due |
|---|---|---|
| [for example: last official receipt number used, user list with roles] | [ ] | [date] |

# Decisions and actions of the last meeting

| No. | Decision or action | Owner | Due | Status |
|---|---|---|---|---|
| [ ] | [ ] | [ ] | [ ] | [Done / Open] |
