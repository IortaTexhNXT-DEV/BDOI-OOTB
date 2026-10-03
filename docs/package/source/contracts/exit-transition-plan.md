---
title: Exit and Transition Plan
subtitle: iNXT BrokerVerse OOTB
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel and data protection officers before signature
acronyms: AMC=Annual Maintenance Contract; BIR=Bureau of Internal Revenue; CSV=Comma-separated values; DPA=Data Processing Agreement; DPO=Data protection officer; MSA=Master Services Agreement; NPC=National Privacy Commission; OOTB=Out of the box; PDF=Portable Document Format; PHP=Philippine peso; SaaS=Software as a service; VAT=Value-added tax; XLSX=Excel workbook
---

# About this plan

> Template for discussion; subject to review by the parties' legal counsel.

This Exit and Transition Plan (the **Exit Plan**) sets out how iorta TechNXT Corp. (**iorta TechNXT**) returns the Client Data, supports the move to another system or provider, and deletes the Client Data when a subscription or a hosting service of iNXT BrokerVerse OOTB ends. It is an annex to the Order Form under the Master Services Agreement (the **MSA**) between iorta TechNXT and [Client legal name] (the **Client**).

It puts into practice, in one place, the exit terms of these documents, which remain the binding terms:

| Document | Clause |
|---|---|
| MSA | Effect of termination |
| Software Subscription Agreement | Client Data on exit (Data return, Data deletion) |
| Hosting and Infrastructure Services Agreement | Exit and transition; Backup and recovery |
| Data Processing Agreement | Return and deletion |

If this Exit Plan conflicts with one of those clauses, the clause prevails. Capitalised terms have the meaning given in the MSA. Text in [square brackets] is a placeholder or an option.

# Where it applies

| Commercial model | Applies | Notes |
|---|---|---|
| Subscription, hosted by iorta TechNXT (Standard package) | Yes, in full | Subscription and hosting both end |
| Subscription, hosted by the Client (Essentials package) | Yes, for the data return formats, the transition assistance and the end of the right of use | The Client already holds its database; iorta TechNXT deletes the Client Data it holds from support and migration work |
| Perpetual licence, hosted by iorta TechNXT (Ownership and Ownership Plus packages) | Yes, for the hosting service | The licence continues. The Client may move the Platform to its own hosting under the Hosting Agreement |
| Perpetual licence, hosted by the Client | Only the deletion of Client Data that iorta TechNXT holds from support work | The licence and the Client Data stay with the Client; end of AMC only stops updates and support |

## Exit triggers

1. Expiry after a notice of non-renewal given at least 90 days before the end of the current term (subscription, hosting).
2. Termination for cause under the MSA, including for non-payment.
3. Termination for convenience where the Order Form allows it, with the early termination fee stated there.
4. A planned move requested by the Client during the term, for example from hosting by iorta TechNXT to hosting by the Client under a perpetual licence.

# Exit timeline

Day 0 is the date on which the subscription or the hosting service ends (the **End Date**). The timeline below assumes expiry after notice of non-renewal; on termination for cause, the steps before Day 0 are compressed into the notice period.

| When | Step | Owner |
|---|---|---|
| Day minus 90 or earlier | Written notice of non-renewal, or notice of a planned move | Either Party |
| Within 10 Business Days of the notice | Exit kick-off meeting; exit contacts named; this Exit Plan confirmed with dates (Annex A) | Both |
| Day minus 60 | Client confirms the export scope, the formats, the delivery method and any transition assistance it wants | Client |
| Day minus 30 [optional] | Trial export delivered for the Client to test the load into its new system [counted as the included export / charged at day rates] | iorta TechNXT |
| Day 0 | End Date. The right of use ends. Read-only access for the System Administrator may continue under the next row | Both |
| Day 0 to Day 60 | Request window: the Client requests the full export. iorta TechNXT keeps the Client Data and may keep read-only access open for the System Administrator at [no charge / the Monthly Fee prorated] | Client |
| Within 30 days of the request | Full export delivered | iorta TechNXT |
| Up to Day 90 [hosting] | If the Client asks, iorta TechNXT keeps the hosted environment running at the monthly hosting fee prorated, for parallel running and cutover | iorta TechNXT |
| Within 10 Business Days of delivery | Client confirms receipt and readability of the export (Annex C), or lists the defects | Client |
| Within 30 days of the Client's confirmation, or within 30 days after Day 60 if no request is made | Deletion of the Client Data from production and non-production environments | iorta TechNXT |
| Within 10 Business Days of completing deletion | Certificate of deletion signed by the iorta TechNXT DPO (Annex D) | iorta TechNXT |
| Up to 12 months after Day 0 (longer only for year-end copies the Client instructed) | Backups expire under the backup retention; they are not restored except to comply with law | iorta TechNXT |

> If the Client does not confirm or reject the export within 10 Business Days of delivery, the export is treated as confirmed for the purpose of the deletion timeline. This is a proposal of this Exit Plan and should be confirmed by legal counsel.

# Data return

## What is returned

| Item | Format | Notes |
|---|---|---|
| Database | PostgreSQL 16 dump of the Client's database in custom format, restorable with the standard PostgreSQL tools | Complete Client Data, including the audit trail, users and configuration |
| Uploaded documents | Archive of the uploaded files (documents, ID images, reports produced by the system) in their original formats, with the folder structure of the file store | Personal data of the Client's clients included |
| Register extracts | CSV extracts of the main registers listed in the Documentation, with the data dictionary | For loading into another system without PostgreSQL |
| Configuration | Configuration export of the Platform (hosting): settings, masters, number series, posting rules | Hosting Agreement, Exit and transition clause |
| Self-service reports | XLSX, CSV and PDF reports and exports run by the Client's users before the End Date | Available at any time during the term |

## What is not returned

1. The Platform, its source code, the Documentation, the upload templates and other materials of iorta TechNXT. These remain iorta TechNXT's property under the MSA.
2. Application secrets and encryption keys of the iorta TechNXT environments. Two-step verification secrets in the dump are encrypted; a new system cannot use them, and users enrol again in the new system.
3. Monitoring data, logs and tickets of iorta TechNXT, except the audit trail inside the Client's database and the ticket history that the Client asks for.

## Delivery

1. The export is delivered by secure file transfer or on encrypted media, at the Client's choice. The decryption password is sent by a separate channel to the Client's named exit contact. [Recommended practice; confirm with the Client's DPO.]
2. Each file comes with a manifest listing the file names, sizes, row counts of the CSV extracts and a checksum.
3. One full export is included. Further exports and a trial export (unless counted as the included export) are charged at the day rates of the Order Form.
4. Under a planned move of a perpetual licence to the Client's own hosting, iorta TechNXT also supplies the deployment guide and the container images or build artefacts of the current release, and supports the move at day rates. The application secrets are handed over under dual control so that users keep their two-step verification.

# Transition assistance and deletion

## Transition assistance

### Included

| Model | Included at no charge |
|---|---|
| Hosting by iorta TechNXT | Handover meeting with the Client's new provider, and answers to questions, up to [5] man-days in total |
| Subscription | One full export; no other transition assistance |

### At day rates

Further assistance is provided at the day rates of the Order Form (list rates in the Service Catalogue and Rate Annex), after the Client approves an estimate:

| Assistance | Typical role | Unit |
|---|---|---|
| Further exports or extracts in another layout | Developer | Man-day |
| Mapping of the Client Data to the new system's layouts | Business analyst | Man-day |
| Answers to the new provider beyond the included days | Business analyst or developer | Man-day |
| Parallel running support | Business analyst | Man-day |
| Project management of the exit | Project manager | Man-day |
| Hosted environment kept running after Day 0 | Not applicable | Monthly hosting fee, prorated by day, up to Day 90 |

The assistance is limited to the Client Data and the Platform as delivered. iorta TechNXT does not build, configure or test the new system.

## Deletion

1. iorta TechNXT deletes the Client Data from the production and non-production environments it operates, including the UAT and any additional environments, the file store and copies made for support or data migration work.
2. Backups that contain Client Data are not deleted one by one. They expire under the retention of the Hosting Agreement: at most 35 days for daily backups and point-in-time recovery, 12 months for monthly copies and monthly logical dumps, and 10 years for year-end copies only if the Client has instructed that retention. They are not restored in the meantime, except to comply with law.
3. iorta TechNXT may keep Client Data longer only where Philippine law requires, under the Data Processing Agreement, and keeps it confidential and protected.
4. The Client remains responsible for keeping its own records for the periods required by law, including the Insurance Code and the tax laws, after it receives the export.

# Responsibilities and fees during exit

## Responsibilities during exit

| Activity | iorta TechNXT | Client |
|---|---|---|
| Notice of non-renewal or move | Either Party | Either Party |
| Exit contacts and Annex A dates | Proposes | Confirms |
| Export scope, formats and delivery method | Advises | Decides |
| Export and manifest | Produces and delivers | Receives |
| Test of the export in the new system | Answers questions (included days) | Performs |
| Confirmation of the export (Annex C) | Requests | Signs |
| Deletion and certificate (Annex D) | Performs and signs | Receives |
| Records retention after exit | Not applicable | Keeps its records as the law requires |
| Notices to its clients, insurers and the NPC where needed | Not applicable | Gives them |

## Fees during exit

1. Subscription and hosting fees are payable up to the End Date. Fees for read-only access and for running the hosted environment after the End Date are as stated in the Exit timeline.
2. Transition assistance beyond the included items is invoiced monthly in arrears at actual man-days, up to the approved estimate.
3. iorta TechNXT may withhold the export only for undisputed amounts that remain unpaid after the notice under the MSA. It does not withhold the deletion or the certificate of deletion.

# Annexes

## Annex A: exit schedule

| Item | Entry |
|---|---|
| Order Form no. and services ending | [number]; [subscription / hosting / both] |
| Notice given by and on | [Party], [date] |
| End Date (Day 0) | [date] |
| Exit contacts | iorta TechNXT: [name, e-mail]; Client: [name, e-mail]; Client DPO: [name, e-mail] |
| Export scope and formats | [as in the Data return chapter / changes] |
| Delivery method | [secure transfer / encrypted media] |
| Trial export | [Yes, on date / No] |
| Read-only access after Day 0 | [Yes, until date, at no charge or fee / No] |
| Hosted environment after Day 0 | [Yes, until date (at most Day 90) / No] |
| Transition assistance estimate | [man-days by role; amount PHP] |
| Planned deletion date | [date] |

## Annex B: export manifest

| File | Content | Format | Size | Rows | Checksum |
|---|---|---|---|---|---|
| [file name] | Database dump | PostgreSQL custom format | [size] | Not applicable | [checksum] |
| [file name] | Uploaded documents archive | Archive | [size] | [files] | [checksum] |
| [file name] | [register] extract | CSV | [size] | [rows] | [checksum] |
| [file name] | Data dictionary | XLSX | [size] | Not applicable | [checksum] |
| [file name] | Configuration export | [format] | [size] | Not applicable | [checksum] |

## Annex C: confirmation of data return

| Field | Entry |
|---|---|
| Client | [Client legal name] |
| Export delivered on | [date], manifest ref. [reference] |
| Checks made by the Client | [checksums verified; dump restored into PostgreSQL 16; row counts compared; documents opened] |
| Result | [Export received and readable / Defects listed below] |
| Defects, if any | [list] |
| Confirmed by (Client) | [name, title, signature, date] |

## Annex D: certificate of deletion

| Field | Entry |
|---|---|
| Certificate no. | [DEL-year-number] |
| Controller | [Client legal name] |
| Processor | iorta TechNXT Corp. |
| Services ended | [subscription / hosting], Order Form no. [number], End Date [date] |
| Environments deleted | [production, UAT, additional environments], [provider and region] |
| Other copies deleted | [support and migration copies, file store] |
| Date deletion completed | [date] |
| Method | [Deletion of the database instances and storage volumes; deletion of file store and object storage; provider confirmation reference] |
| Backups remaining and their expiry | [daily backups expire by date; monthly copies expire by date; year-end copies expire by date, if instructed] |
| Data kept because the law requires it | [None / description and legal basis] |
| Statement | iorta TechNXT certifies that the Client Data in the environments listed above has been deleted as stated, and that the remaining backups will expire as stated and will not be restored except to comply with law. |
| Signed by the iorta TechNXT data protection officer | [name, signature, date] |
| Received by the Client's data protection officer | [name, signature, date] |
