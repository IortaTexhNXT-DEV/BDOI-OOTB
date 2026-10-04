---
title: AMC and Service Levels
subtitle: Maintenance, support and SLA
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: AMC=Annual Maintenance Contract; CAB=Change advisory board; DPO=Data protection officer; DR=Disaster recovery; KPI=Key performance indicator; L1/L2/L3=Support levels 1, 2 and 3; MSA=Master Services Agreement; NPC=National Privacy Commission; OOTB=Out of the box; PHP=Philippine peso; PHT=Philippine time; RCA=Root-cause analysis; SLA=Service level agreement; UAT=User acceptance testing; VAT=Value-added tax
---

# About this template

> Template for discussion; subject to review by the parties' legal counsel.

This Annual Maintenance and Support Agreement and Service Level Agreement (the **Support Agreement**) sets the maintenance, support and service levels for iNXT BrokerVerse OOTB. For a perpetual licence, it is the AMC and is paid by the AMC fee. For a subscription, the support and service levels are included in the subscription fee and the AMC fee clause does not apply. It forms part of the Master Services Agreement (the **MSA**) between iorta TechNXT Corp. (**iorta TechNXT**) and [Client legal name] (the **Client**) when an Order Form names it. Text in [square brackets] is a placeholder or an option.

# Agreement and scope

## Parties and documents

This Support Agreement is made on [date] under the MSA dated [date] and Order Form no. [number]. Capitalised terms have the meaning given in the MSA. The service levels are based on the iorta TechNXT Production Support Approach and Standards. Support under this Support Agreement takes over from the implementation team on the date stated in the signed Hypercare Exit and Handover to Support Certificate. The Customer Responsibilities and RACI Annex sets out who does what in support.

## Maintenance

While this Support Agreement is in force and paid, iorta TechNXT provides:

1. correction of defects in the OOTB product, by workaround, configuration or data correction, or code fix and release;
2. updates and releases of the OOTB version made available to all customers, with release notes;
3. regulatory form updates released for all customers (for example changes to BIR working papers delivered in the product);
4. security patches of the application and its dependencies;
5. support of the current release and the two previous planned releases.

## Support

1. A service desk: a support portal or mailbox for all tickets and a telephone line for P1.
2. Level 2 application support: triage, reproduction, analysis, configuration and data corrections under change control, workarounds, known-error records and release coordination.
3. Level 3 engineering: code defects, database corrections by script, performance, infrastructure where iorta TechNXT hosts, security incidents, root-cause analysis, fixes and releases.
4. A monthly service report and a monthly service review.

## Support levels

| Level | Who | Scope |
|---|---|---|
| L1 | Client super users (one trained key user per team) and the Client System Administrator | How-to questions; checks that a role, setting or master record is not the cause; user and password resets; logging tickets with evidence |
| L2 | iorta TechNXT application support | As in the Support clause |
| L3 | iorta TechNXT engineering and DevOps | As in the Support clause |

Only named L1 contacts of the Client raise tickets (up to [5] contacts, named in Annex A).

# Fees

## AMC fee (perpetual licence)

1. The AMC fee is 22% of the Licence Fee a year.
2. The first 12 months from Go-Live are the warranty period, during which maintenance and support are provided at no charge. The AMC starts on the first day of Year 2.
3. The AMC fee is invoiced yearly in advance at the start of each AMC year and is payable within 30 days.
4. The AMC fee increases by 5% at each anniversary of the AMC start.
5. The AMC covers all Licensed Users. Additional users add AMC from the later of their licence date and the AMC start, prorated to the next AMC anniversary.

## Subscription

For a subscription, the services of this Support Agreement are included in the monthly subscription fee.

## Extended P1 support (optional)

24x7 support for P1 incidents (called 24x7 Severity 1 support in the Order Form and the price book) is an option stated in the Order Form, priced yearly by size (Year 1 list prices: Small PHP 240,000.00; Medium PHP 480,000.00; Large PHP 900,000.00; Enterprise PHP 1,500,000.00), invoiced yearly in advance and increasing 5% a year.

## Work outside this Support Agreement

Work in the Exclusions chapter is charged at the day rates of the Order Form, through the Change Request Procedure where it changes the product.

# Service hours

| Service | Hours | Covers |
|---|---|---|
| Standard support | 08:00 to 18:00 PHT, Monday to Friday, except Philippine regular holidays | All severities |
| Extended P1 support (optional) | 24 hours a day, 7 days a week | P1 only, reported by telephone |
| Planned maintenance window | Agreed with the Client; default Saturday 20:00 to Sunday 06:00 PHT | Releases, patching, DR drills |

Targets count service hours only. With the extended P1 option, P1 targets count elapsed time.

# Severity levels and targets

## Definitions

| Severity | Meaning | Examples |
|---|---|---|
| P1 Critical | Production down or a core process stopped for all users; wrong financial postings or data exposed; no workaround | Nobody can sign in; official receipts cannot be issued; journals post wrong amounts; personal data visible to the wrong users |
| P2 High | A core process stopped for one team or one branch, or seriously degraded, with no acceptable workaround | Month-end close run fails; bank statement import refused for a valid file; remittance cannot be approved; scheduled jobs not running |
| P3 Medium | A function fails or gives a wrong result and a workaround exists | One report column wrong; an upload rejects one valid row; a PDF layout problem |
| P4 Low | Question, cosmetic issue, documentation, or request for change | Wording, layout, how-to question, new report request |

The Client proposes the severity when raising the ticket. iorta TechNXT confirms or changes it at triage, with the reason. The Client may ask for a review through the escalation matrix.

## Targets

| Severity | First response | Update frequency | Restore service or workaround | Permanent fix |
|---|---|---|---|---|
| P1 | 30 minutes | Every hour | 4 service hours | Root cause in 5 Business Days; fix in the next emergency or planned release |
| P2 | 2 service hours | Every 4 service hours | 2 Business Days | Next planned release |
| P3 | 1 Business Day | Every 3 Business Days | 5 Business Days | Planned release as agreed |
| P4 | 2 Business Days | Weekly | Not applicable | Planned with the Client or handled as a change request |

## Clock rules

1. The clock starts when the ticket is logged with the minimum content in the Service desk chapter.
2. The clock stops while the ticket waits for the Client (status Awaiting customer).
3. The clock ends when a workaround or a fix is provided.
4. A ticket counts as met when both its response and restore targets are met.

# Service desk and tickets

## Minimum content of a ticket

1. The screen (menu path) and the record number.
2. The date and time, to the minute.
3. The request ID shown in the error message, if any.
4. What was done, what happened and what was expected.
5. A screenshot, with client personal data covered.
6. The username (never the password) and the role.
7. How many users are affected and whether work can continue.

Passwords, two-step codes, environment settings and full client ID numbers are never sent in a ticket.

## Ticket statuses

New, Acknowledged, In progress, Awaiting customer, Workaround provided, Resolved, Closed, Reopened. A resolved ticket closes when the Client confirms, or automatically 5 Business Days after Resolved without a reply. The Client may reopen a ticket within 5 Business Days of Resolved.

# Escalation

| Trigger | Client side | iorta TechNXT side |
|---|---|---|
| P1 logged | System Administrator informs the Client IT head | L2 lead and L3 on-call engaged at once; support manager informed |
| P1 without response in 30 minutes, or no workaround in 2 hours | IT head calls the support manager | Support manager engages the engineering lead and the DevOps lead |
| P1 not restored in 4 hours | Sponsor informed | Account manager and head of delivery informed; hourly calls |
| P2 without response in 2 service hours | System Administrator calls the L2 lead | L2 lead assigns and reports |
| P2 not restored in 2 Business Days | IT head informed | Support manager informed; plan sent to the Client |
| Disagreement on severity or closure | IT head | Support manager, then account manager |
| Repeated incidents (3 or more of one cause in a month) | Raised in the monthly service review | Problem record opened |

Names and telephone numbers of each role are listed in Annex A and kept up to date by both Parties.

# Service credits

## Credits

If iorta TechNXT misses a target in a calendar month for reasons within its control, the Client is entitled to the following service credits, calculated on the monthly fee of the affected service (one twelfth of the yearly AMC fee, or the monthly subscription fee):

| Event in the month | Service credit |
|---|---|
| Each P1 ticket whose restore target is missed | [5%] |
| Each P2 ticket whose restore target is missed | [2%] |
| Response SLA below 95% of tickets | [2%] |
| Restore SLA below 90% of tickets (P1: below 100%) | [3%] |

Availability credits for hosting are in the Hosting and Infrastructure Services Agreement.

## Rules

1. Service credits in a month are capped at [10%] of the monthly fee of the affected service.
2. The Client claims a credit in writing within 30 days of the monthly service report. Approved credits are deducted from the next invoice. Credits are not paid in cash.
3. No credit is due for a miss caused by: the Client or its third parties; a cause in the Exclusions chapter; planned maintenance; force majeure; a ticket that did not have the minimum content; or the Client's delay in giving access, information or approval.
4. Service credits are the Client's sole financial remedy for missed service levels, except that if P1 restore targets are missed in 3 consecutive months, the Client may terminate this Support Agreement (and the Subscription, if any) for cause under the MSA.

# Reporting and reviews

## Monthly service report

Sent by the 10th Business Day of each month:

- tickets opened, resolved and open, by severity, category and module;
- SLA performance per severity, with the tickets that missed a target and why;
- P1 and P2 incidents with their RCA status;
- problems and known errors opened and closed;
- changes and releases made; failed or rolled-back changes;
- availability of production in the month and planned downtime (where iorta TechNXT hosts);
- monitoring and backup verification results; DR drill results when held;
- security events and access review results;
- trends, risks and recommendations, including training needs seen in the tickets.

## KPIs

| KPI | Definition | Target |
|---|---|---|
| Response SLA | Tickets responded to within target / tickets | 95% |
| Restore SLA | Tickets restored within target / tickets | 90% (P1: 100%) |
| Availability (when iorta TechNXT hosts) | Minutes production was available in service hours / minutes in service hours, excluding planned maintenance | 99.5% |
| Reopen rate | Tickets reopened / tickets resolved | Below 5% |
| Backlog age | Open P3 tickets older than 30 days | 0 |
| RCA on time | P1 RCA reports delivered within 5 Business Days | 100% |
| Change success | Changes without rollback or incident / changes | 95% |

## Service review

A monthly service review with the Client IT head and System Administrator discusses the report, open problems, planned releases and the Client's upcoming business events. A yearly review agrees improvements and the release plan for the next year.

# Releases and changes

1. iorta TechNXT publishes planned releases with release notes at least [10] Business Days before deployment to UAT.
2. The Client tests each release in UAT and approves it for production within the agreed time. Releases with database changes are preceded by a snapshot.
3. Emergency fixes for P1 incidents may be deployed with the approval of the Client IT head, confirmed in writing afterwards.
4. Configuration changes in production and data corrections are made under change control with the Client change owner's approval.
5. Where the Client hosts, the Client deploys releases under iorta TechNXT's guidance, and the targets for defects that need a release depend on the Client's deployment.

# Security incidents and personal data breaches

1. A suspected security incident is handled as a P1.
2. iorta TechNXT informs the Client DPO and System Administrator of a suspected personal data breach without undue delay, and within the period in the Data Processing Agreement, so that the Client can notify the National Privacy Commission and the affected data subjects within 72 hours of knowledge where NPC rules require.
3. iorta TechNXT supports the Client with the facts (what, when, which records, which users, containment) and with the evidence for the NPC.

# Exclusions

The following are outside this Support Agreement and are handled as change requests or separate services:

1. New features, new reports, new printed documents and customisation.
2. New integrations, or changes caused by a third party (insurer, bank, payment gateway, e-mail provider) changing its interface.
3. Data entry, data cleansing and bulk data work for the Client's business.
4. Business configuration done on the Client's behalf beyond [8] hours a month.
5. Training of new users beyond [one] refresher session a year.
6. Issues caused by changes the Client made outside the change process, or by the Client's network, devices or browsers.
7. Filing of BIR, IC, NPC or AMLC returns and reports; tax, legal and audit advice.
8. Recovery of data deleted by the Client's users beyond what the backups hold.
9. Support of releases more than two planned releases behind the current one.
10. Support of customised code that has not been merged into the product line.
11. Infrastructure, operating system and database support where the Client hosts.

# Client obligations

1. Named L1 super users (one per team) and a System Administrator, trained and available in service hours.
2. A change owner and an IT head for escalations and change decisions; a DPO for privacy matters.
3. Tickets with the minimum content.
4. Access to the people who can reproduce the issue and test the fix.
5. Testers for releases in UAT, and approval within the agreed time.
6. Notice of business events that affect support: month-end and year-end dates, BIR filing dates, peak renewal periods, new branches or large data loads.
7. Credentials, contracts and support contacts of third parties the Client owns.
8. Supported browsers (current Chrome, Edge or Firefox) and a working network.

# Term and termination

1. For a perpetual licence, this Support Agreement starts at Go-Live (warranty period), the AMC starts on the first day of Year 2, and it renews automatically each year unless either Party gives 90 days' written notice before the AMC anniversary.
2. For a subscription, it lasts for the Subscription Term.
3. Either Party may terminate for cause under the MSA. AMC fees paid in advance are refunded pro rata only if the Client terminates for iorta TechNXT's uncured material breach.
4. Reinstatement of a lapsed AMC is governed by the Perpetual Software Licence Agreement.

# Signatures

| For iorta TechNXT Corp. | For [Client legal name] |
|---|---|
| Signature: ____________________ | Signature: ____________________ |
| Name: [name] | Name: [name] |
| Title: [title] | Title: [title] |
| Date: [date] | Date: [date] |

# Annex A: contacts

| Role | Party | Name | Telephone | E-mail |
|---|---|---|---|---|
| Service desk | iorta TechNXT | [portal or mailbox] | [P1 telephone] | [e-mail] |
| L2 lead | iorta TechNXT | [name] | [number] | [e-mail] |
| Support manager | iorta TechNXT | [name] | [number] | [e-mail] |
| Account manager | iorta TechNXT | [name] | [number] | [e-mail] |
| Head of delivery | iorta TechNXT | [name] | [number] | [e-mail] |
| System Administrator | Client | [name] | [number] | [e-mail] |
| L1 contacts (up to [5]) | Client | [names] | [numbers] | [e-mails] |
| IT head | Client | [name] | [number] | [e-mail] |
| Data protection officer | Client | [name] | [number] | [e-mail] |
| Sponsor | Client | [name] | [number] | [e-mail] |
