---
title: Production Support
subtitle: Approach and Standards
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Support procedures for the integrations outbox, the EIS outbox, the compliance deadline jobs, encryption key custody and rotation, brand pack import and e-signature revocation; monitoring, backups and references updated
acronyms: OOTB=Out of the box; AML=Anti-money laundering; AMLC=Anti-Money Laundering Council; EIS=Electronic Invoicing System; EDD=Enhanced due diligence; PII=Personal identifiable information; SMS=Short message service; CTPL=Compulsory third party liability; COC=Certificate of cover; L1, L2, L3=Support levels 1, 2 and 3; PHT=Philippine time (UTC+8); SLA=Service level agreement; KPI=Key performance indicator; RCA=Root-cause analysis; CAB=Change advisory board; DR=Disaster recovery; RTO=Recovery time objective; RPO=Recovery point objective; NPC=National Privacy Commission; DPO=Data protection officer; PITR=Point-in-time restore; Dev=Development environment; Pre-Prod=Pre-production environment; SIT=System integration test; UAT=User acceptance test; ITIL=IT Infrastructure Library; PR=Pull request
---

# Introduction

## Purpose

This document sets out how iorta TechNXT supports BrokerVerse OOTB in production for a Philippine non-life insurance broker after hypercare: the support model, service hours, severity levels and targets, the ticket and escalation process, problem, change and release management, monitoring, backups and disaster recovery drills, reporting, and the standards the support and engineering teams work to.

The figures in this document (hours, targets, frequencies) are the iorta TechNXT standard proposal. The final values are fixed in the support agreement with the broker and are then copied into `docs/onboarding/SUPPORT_AND_ESCALATION.md`.

## Audience

The broker's System Administrator, key users and IT management; the iorta TechNXT application support, engineering and DevOps teams; the account manager.

## Reference material

| Material | Use in support |
|---|---|
| `docs/onboarding/SUPPORT_AND_ESCALATION.md` | What a user report must contain and what support checks first |
| `docs/developer-guide/README.md`, `backend.md`, `frontend.md` | Tracing a defect from a screen to the API and the database; logs and request IDs; common production issues |
| `backend/docs/api` | OpenAPI file, Postman collection, API touchpoint workbook (screen to route) |
| `deploy/README.md`, `deploy/REFERENCE.md` | Deployment, health checks, start-up rules, upgrade and rollback |
| Architecture documents 07 to 11 (`docs/architecture`) | High availability, RTO and RPO, backup and recovery, archival and housekeeping, monitoring |
| User manual and role decks | Expected behaviour of each screen; known limitations (manual Appendix G) |
| `docs/onboarding/UAT_SCRIPTS.md`, `backend/scripts/uat-scenario.js` | Business regression scripts |
| Schedules and Batch Jobs (05_Delivery), chapter Support runbook by job | What each scheduled job does, its switch, and the checks and fixes when it fails |
| `docs/onboarding/BRANDING_AND_SIGNATURES.md`, `DATA_MASKING.md`, `SUPPORT_AND_ESCALATION.md` | Brand packs and e-signatures; masking of non-production copies; what users send with a report |

# Support model

## Levels

| Level | Who | Scope |
|---|---|---|
| L1 | Broker super users: one trained key user per team, and the broker's System Administrator | How-to questions; checks that a role, setting or master record is not the cause; users, roles, password and two-step verification resets, settings and master data; logging the ticket with the evidence |
| L2 | iorta TechNXT application support | Ticket triage and classification; reproduction in UAT (or SIT for a large broker); analysis with request IDs, logs, Audit Trail and job runs; configuration and data corrections under change control; workarounds; known-error records; release coordination |
| L3 | iorta TechNXT engineering (development and DevOps) | Code defects, database corrections that need a script, performance, infrastructure, security incidents, root-cause analysis, fixes and releases |

This model maps to the levels users see in the user manual (Appendix H) and in `SUPPORT_AND_ESCALATION.md`: the key user is the first line, the broker's System Administrator the second line inside the broker, and iorta TechNXT the third line. Inside iorta TechNXT, application support (L2) and engineering (L3) split the work.

## Responsibilities of L1

- Answer how-to questions from the user manual and the role decks.
- Check the user's role and menus (`GETTING_STARTED.md`, section 2), the setting concerned (Master > Configuration) and Master > Audit Trail for a recent change.
- For uploads, compare the rejected file with the template in `docs/package/05_Delivery/Upload_Templates`.
- Raise a ticket with the evidence of chapter 7 when the issue remains.
- Communicate with the broker's users during an incident and confirm the fix.

## Service desk

iorta TechNXT runs one service desk for BrokerVerse: a support portal or mailbox for all tickets and a telephone line for P1. Only named L1 contacts of the broker (assumption: up to 5) raise tickets. The contact details are written into the support agreement.

# Service hours

| Service | Hours | Covers |
|---|---|---|
| Standard support | 8:00 to 18:00 PHT, Monday to Friday, except Philippine regular holidays | All severities |
| Extended P1 support (optional) | 24 hours a day, 7 days a week | P1 only, reported by telephone |
| Planned maintenance window | Agreed with the broker; default Saturday 20:00 to Sunday 06:00 PHT | Releases, patching, DR drills |

Targets count service hours only. With the extended P1 option, P1 targets count elapsed time. Monitoring alarms (chapter 12) are watched outside service hours only where the extended option is taken.

# Severity levels and targets

## Definitions

| Severity | Meaning | Examples |
|---|---|---|
| P1 Critical | Production down or a core process stopped for all users; wrong financial postings or data exposed; no workaround | Nobody can sign in; official receipts cannot be issued; journals post wrong amounts; personal data visible to the wrong users |
| P2 High | A core process stopped for one team or one branch, or seriously degraded, with no acceptable workaround | Month-end close run fails; bank statement import refused for a valid file; remittance cannot be approved; scheduled jobs not running |
| P3 Medium | A function fails or gives a wrong result and a workaround exists | One report column wrong; an upload rejects one valid row; a PDF layout problem |
| P4 Low | Question, cosmetic issue, documentation, or request for change | Wording, layout, how-to question, new report request |

The broker proposes the severity when raising the ticket. L2 confirms or changes it at triage, with the reason, and the broker may ask for a review through the escalation matrix.

## Targets

| Severity | First response | Update frequency | Restore service or workaround | Permanent fix |
|---|---|---|---|---|
| P1 | 30 minutes | Every hour | 4 service hours | Root cause in 5 business days; fix in the next emergency or planned release |
| P2 | 2 service hours | Every 4 service hours | 2 business days | Next planned release |
| P3 | 1 business day | Every 3 business days | 5 business days | Planned release as agreed |
| P4 | 2 business days | Weekly | Not applicable | Planned with the broker or handled as a change request |

> These targets are the iorta TechNXT standard proposal. `SUPPORT_AND_ESCALATION.md` shows an earlier proposal used at onboarding (P1 first response 1 business hour, fix in 1 business day). The support agreement fixes one set of values and both documents are then aligned.

Clock rules: the clock starts when the ticket is logged with the minimum evidence, stops while the ticket waits for the broker (status Awaiting customer), and ends when a workaround or fix is provided. A ticket counts as met when both the response and restore targets are met.

# Ticket workflow

## Minimum content of a ticket

As in `SUPPORT_AND_ESCALATION.md`, section 2:

1. The screen (menu path) and the record number (policy, quotation, receipt, voucher, journal).
2. The date and time, to the minute.
3. The request ID shown in the error message, if any.
4. What was done, what happened and what was expected.
5. A screenshot, with client personal data covered.
6. The username (never the password) and the role.
7. How many users are affected and whether work can continue.

Passwords, two-step codes, environment settings and full client ID numbers are never sent in a ticket.

## Statuses

| Status | Meaning | Who moves it |
|---|---|---|
| New | Logged by L1 | L1 |
| Acknowledged | Severity confirmed, owner assigned, first response sent | L2 |
| In progress | Under analysis or being fixed | L2 or L3 |
| Awaiting customer | Waiting for information, a test or a decision from the broker; the clock stops | L2 |
| Workaround provided | Service restored; the permanent fix is tracked on a problem record | L2 |
| Resolved | Fix or answer delivered | L2 |
| Closed | Broker confirmed, or no reply within 5 business days of Resolved | L1 or automatic |
| Reopened | The broker reports within 5 business days that the issue remains | L1 |

## Triage steps at L2

1. Confirm severity and impact.
2. Find the request ID in the logs (JSON lines; the 500 message and stack are only in the log).
3. Check health: `GET /api/health` (ready, database latency, pending migrations) and `GET /api/version`.
4. Find the route from the screen in the API touchpoint workbook and follow it to the module and tables.
5. Check the usual suspects of the area (`docs/developer-guide/backend.md`, section 7): sign-in and lockouts (`login_history`), document numbering, postings and closed periods, scheduled jobs (`job_runs`), PDFs, the e-mail outbox.
6. Check configuration before code: the setting in Master > Configuration and its history in Master > Audit Trail.
7. Reproduce in UAT (or SIT for a large broker) where possible.
8. Classify the cause: user or training, configuration, master or transaction data, code defect, infrastructure, third party.
9. Resolve at L2 or pass to L3 with the evidence.

# Escalation matrix

Functional escalation moves a ticket to the next support level. Hierarchical escalation brings in management when a target is at risk.

| Trigger | Broker side | iorta TechNXT side |
|---|---|---|
| P1 logged | System Administrator informs the broker's IT head | L2 lead and L3 on-call engaged at once; support manager informed |
| P1 without response in 30 minutes, or no workaround in 2 hours | IT head calls the support manager | Support manager engages engineering lead and DevOps lead |
| P1 not restored in 4 hours | Sponsor informed | Account manager and head of delivery informed; hourly calls |
| P2 without response in 2 service hours | System Administrator calls the L2 lead | L2 lead assigns and reports |
| P2 not restored in 2 business days | IT head informed | Support manager informed; plan sent to the broker |
| Disagreement on severity or closure | IT head | Support manager, then account manager |
| Repeated incidents (3 or more of one cause in a month) | Raised in the monthly service review | Problem record opened (chapter 9) |

Names and telephone numbers of each role are listed in the support agreement and kept up to date by both parties.

# Problem management

Aligned with ITIL problem management.

- A problem record is opened for every P1, for every P2 whose cause is not known when service is restored, and for any cause behind three or more incidents in a month.
- L2 owns the record; L3 carries out the root-cause analysis to the standard of chapter 17.
- A known-error record (symptom, cause, workaround) is published in the knowledge base as soon as the workaround is known.
- The problem is closed when the permanent fix is released and no new incident of the same cause occurs for 30 days.
- Open problems are reviewed in the monthly service review.

# Change management

## Types of change

| Type | Examples | Approval |
|---|---|---|
| Standard | Adding a user, resetting a password, adding a master record, changing an e-mail or SMS template text, uploading a new screening list version, capturing or revoking an e-signature on request | Pre-approved; done by the broker's System Administrator or compliance officer; recorded in the Audit Trail |
| Normal | A release; a change of tax rate, account determination or posting rule; a new document number series; a new scheduled job time or switching a job on or off; switching a connector or the EIS to live; a brand pack import in Production; an encryption key rotation; a data correction script | Change request with impact, test evidence and rollback; approved by the broker's change owner and iorta TechNXT support manager (CAB) |
| Emergency | Fix for a P1; security patch | Approved by the support manager and the broker's IT head by telephone or e-mail; recorded afterwards and reviewed at the next CAB |

## Configuration changes in production

- Settings in Master > Configuration apply at once on every server and are recorded in the Audit Trail with the old and new value.
- Changes to account determination and posting rules go through Master > Finance > Configuration Approvals: proposed by one user and approved by another. The Posting Rules screen has a Simulate button; use it before approval.
- GL accounts, tax rates and maker-checker switches are changed only with the agreement of the Accounting Manager (user manual, Master data chapter).
- iorta TechNXT does not change the broker's business configuration in production without a ticket and the broker's written approval.

## Data corrections

A correction of business data through the database is a normal change. It needs: the ticket, the script, a dry run on a restored copy of production, under the Pre-Prod rules of the Environment Strategy (restored from a Production backup, masked if people without production access use it, deleted afterwards), with the before and after counts, the broker's approval, a database snapshot just before it runs, and the result attached to the ticket. Financial data is corrected through the screens (correction or reversal journals) whenever the screens allow it, so the ledger keeps its trail.

# Release management and patching

## Releases

| Item | Standard |
|---|---|
| Release types | Planned release (monthly, when there are fixes or changes); emergency release (P1 or security) |
| Content | Release notes list the fixes, changes, migrations and anything an administrator must do by hand |
| Environments | Small and medium broker: Dev, UAT, Production. Large broker: Dev, SIT, UAT, Production. Pre-Prod is temporary: created from a Production backup for each major release and removed after it (Environment Strategy and Production Rollout Plan) |
| Test | Each release goes through Dev (and SIT for a large broker) to UAT first; the broker runs the UAT scripts that cover the change; iorta TechNXT runs the regression of chapter 19. A major release is also rehearsed in Pre-Prod on a copy of production data |
| Approval | CAB approval with the test evidence |
| Window | The maintenance window, announced at least 5 business days ahead (emergency releases: as agreed) |
| Back end | New image deployed; on start the API applies new migrations (they only add) and the idempotent seed, then reports ready on `/api/health`; with migrations, one instance first, then scale out |
| Front end | Built and published by the GitHub Actions workflow (build, S3 sync, CloudFront invalidation); the workflow runs the front-end tests and refuses to publish an unbuilt page |
| Before deploying | Database snapshot taken |
| After deploying | Smoke test of `deploy/README.md` section 4 and `GET /api/version` showing the expected commit and no pending migration |
| Rollback | Front end: re-run the workflow on the previous commit or restore the previous S3 object versions, then invalidate CloudFront. Back end: redeploy the previous image tag; migrations only add, so the previous version runs on the newer schema; restore the snapshot only if data must be rolled back |

## Patching

| Component | Standard |
|---|---|
| Node.js runtime and npm dependencies | Security advisories reviewed monthly; critical fixes within 14 days as an emergency release, high within 30 days, others in the next planned release |
| Container base image | Rebuilt with each release; at least quarterly |
| PostgreSQL 16 (managed service) | Minor versions applied in the maintenance window; major upgrades planned as a project |
| Operating system and managed services | Managed by the cloud provider; monthly, critical security patches within 14 days and high within 30 days where iorta TechNXT hosts; maintenance windows aligned with the broker's window |
| TLS certificates | Renewal alarm at 30 days before expiry |

# Monitoring and health checks

The monitoring design is in architecture document 11. The standard checks are:

| Check | Frequency | Owner |
|---|---|---|
| Synthetic API readiness (`/api/health` returns 200 and ready within 2 s) | Every 5 minutes | Monitoring, alarm to on-call |
| Front-end sign-in page loads | Every 5 minutes | Monitoring |
| Sign-in journey with a monitoring user without business permissions | Every 15 minutes | Monitoring |
| `GET /api/version`: no pending migration, expected commit | Every 15 minutes | Monitoring |
| HTTP 5xx rate, response time, container CPU and memory, database CPU, storage and connections | Continuous, alarms as in document 11 | DevOps |
| Scheduled jobs: last status of each job in Master > Schedules; failed runs in `job_runs` | Daily, 09:00 PHT | L2 |
| E-mail Outbox: queued older than 15 minutes, failed messages | Daily, and alarm | L2 |
| Integrations outbox: Failed and Waiting per connector, messages in Retry scheduled for more than an hour, failed inbound messages | Daily, and alarm on growth | L2 |
| EIS outbox (when switched on): failed, rejected, submissions in sending | Daily | L2, with the broker's Accounting Manager |
| Compliance deadline jobs: last status of `aml-transaction-monitoring`, `aml-kyc-refresh-due`, `compliance-reminders`, `complaints-deadlines`, `privacy-breach-deadlines` | Daily; `privacy-breach-deadlines` hourly by alarm | L2 |
| Failed sign-ins, locked accounts, refresh-token reuse | Daily, and alarm | L2, security |
| Backup status and latest restorable time | Daily | DevOps |

The daily health check is recorded (date, checker, result, tickets raised). Monitoring alarms raise tickets with the severity of document 11 (P1 immediate, P2 same business day, P3 next business day).

# Operational procedures for the new capabilities

These procedures cover the parts of BrokerVerse that talk to third parties, run against regulatory deadlines or hold keys and signatures. Each scheduled job also has a line in the support runbook of the Schedules and Batch Jobs document.

## Integrations outbox monitoring

Every message to a third party (SMS and Viber, CTPL authentication, LTO feed, insurer requests, bank payment files) goes through the integration outbox on Master > System Configuration > Integrations; the job `integration-outbox` sends what is due every 2 minutes. The screens need `read:integrations` (System Administrator).

| Step | What support does |
|---|---|
| Daily check | Connectors tab: Waiting, Failed and Sent today per connector; last success and last failure. Outbox tab filtered on Failed and Retry scheduled. Inbox tab filtered on Failed and Ignored. |
| A connector shows failures | Open a failed message (eye icon): the attempt log gives the HTTP status, duration and error. Classify: provider down or slow (timeouts, 5xx), credentials (401, 403), request refused by the provider (4xx with a reason, not retried), configuration (endpoint, adapter options). |
| Provider down | Leave the messages in Retry: they are retried with the connector's backoff until the attempt limit. Tell the broker which business is waiting (for example COCs not yet authenticated). When the provider is back, select Send due messages, then Resend the messages that reached Failed. |
| Credentials rejected | The credential values are environment variables on the server, never on the screen. DevOps checks the secret store, sets the value and restarts the API; the Credentials tick on the connector turns green. Then Resend. Treat a leaked credential as a security incident. |
| Request refused | Correct the business data (for example the client's mobile number, the vehicle details of a COC), then Resend. Cancel message for anything that must not be sent. |
| Messages stuck in Sending | The job puts back to retry any message left in processing longer than `integrations.stuck_minutes` (10). If many are stuck, check that the scheduler runs (`SCHEDULER_ENABLED`) and the server log. |
| Inbound message Ignored | An unsigned or wrongly signed push from a third party: confirm the webhook secret with the provider; never reprocess an unsigned message. A Failed inbound message is processed again with Process again once its cause is fixed. |
| Switching a connector to Live | Normal change: endpoint and credential variables set, Test connection in live mode, one real message checked in the outbox, then the related jobs switched on (`sms-renewal-notices`, `sms-payment-reminders`). The partner's certification of the interface stays with the partner and the broker. |

The EIS outbox (Accounts > Tax > E-Invoicing (EIS)) works the same way with its own queue: a failed submission is retried after `eis.retry_minutes`, doubled each time, up to `eis.max_attempts`; a rejected submission is final (the broker cancels and reissues the invoice); a submission left in sending after a crash is confirmed with the EIS and then retried or recorded as Uploaded manually. When the EIS is unavailable for long, Export payloads gives the file for a manual upload. EIS enrolment and certification stay with the BIR and the broker.

## Compliance deadline jobs

These jobs remind people of legal deadlines. A failure is handled as P2 at least, and as P1 when a deadline falls within the next working day.

| Job | Deadline it protects | Who is reminded | Support action when it fails |
|---|---|---|---|
| `aml-transaction-monitoring` (daily 06:30) | Covered transaction report within `aml.ctr_due_working_days` (5) working days; suspicious transaction report within `aml.str_due_working_days` (1) | Compliance officer (`read:aml`) | Fix the cause, then ask the compliance officer to use Run monitoring for the missed dates (the job only looks back 3 days) |
| `aml-kyc-refresh-due` (Mondays 07:00) | KYC refresh by risk rating | Compliance officer | Run now; nothing is lost, the clients are marked at the next run |
| `aml-provider-retry` (when on) | Screening of new parties | Compliance officer (abandoned requests) | Check the provider settings and API key variable; the uploaded lists keep screening meanwhile |
| `compliance-reminders` (daily 06:45, compliance package) | Licence renewals, fit and proper reviews, insurer certificates of authority | Compliance team (`read:compliance`), licence holder | Run now; check the licence and insurer dates entered |
| `complaints-deadlines` (daily 08:00, compliance package) | Acknowledgement and resolution of complaints (RA 11765) | Person assigned; complaints officers when escalated | Run now; confirm every open complaint is assigned |
| `privacy-breach-deadlines` (hourly, compliance package) | NPC notification within 72 hours of discovery | Data privacy team (`read:privacy`) | Restore the scheduler at once; tell the DPO the hours left from the Clock column of the Breach Register |

The deadlines themselves stay with the broker: the compliance officer files with the AMLC, the DPO notifies the NPC, the complaints officer answers the complainant. iorta TechNXT keeps the reminders running and does not file on the broker's behalf.

## Encryption key custody and rotation

| Key | What it protects | Custody | Rotation |
|---|---|---|---|
| `JWT_SECRET` | Session tokens and signed file links | Secret store of each environment; sealed escrow copy | At a suspected leak, or yearly. Changing it signs every user out and voids file links already sent |
| `DATA_ENCRYPTION_KEY` | Two-step verification secrets, reset-code hashes | Secret store; escrow copy kept with the backups | Planned change only: users with two-step verification enrol again after it |
| `PII_ENCRYPTION_KEY` | TIN, government ID and bank account numbers of clients, prospects and referrers, ID numbers captured at issue, payee TIN of BIR Form 2307 (field encryption, compliance package) | Secret store; escrow copy kept with the backups under dual control (broker and iorta TechNXT); a different value in each environment | `npm run pii:rotate` procedure below; yearly or at a suspected leak |
| Connector, EIS and screening provider credentials | Access to SMS gateways, CTPL provider, insurers, BIR EIS, screening provider | Secret store; only the variable name is in the system | When the provider issues new credentials or at a suspected leak; restart the API after the change |

Rules: keys are generated with `openssl rand -hex 32` (at least 32 characters, each key different); they are never written in a ticket, an e-mail, a document or the repository; production refuses to start with a missing, placeholder or reused key; the escrow copy is checked yearly under dual control.

Rotation of `PII_ENCRYPTION_KEY` (normal change, in the maintenance window, after a database snapshot):

1. Generate the new key.
2. Set `PII_ENCRYPTION_KEY` to the new key and `PII_ENCRYPTION_KEY_PREVIOUS` to the old one; restart the API. New and changed identifiers are written with the new key; values written with the old key stay readable.
3. Run `npm run pii:rotate` (dry run: count per column of the values still encrypted with the old key), then `npm run pii:rotate -- --execute`. It works in batches and can be run again.
4. When the dry run reports 0 for every column, remove `PII_ENCRYPTION_KEY_PREVIOUS` and restart.
5. Keep the old key with the backups taken before the rotation: they can only be read with it. Record the rotation in the change with the date, the operator and the dry-run counts (never the keys).

A copy of production restored in another environment is masked with production's key (`npm run mask:data`), then rotated to the key of its own environment with the same steps.

## Brand pack import

A brand pack carries the theme, application name, logo, favicon, sign-in picture and print logo of an environment. Importing one in Production is a normal change; in UAT it is a standard change.

1. Export the current pack first (Master > System Settings > Theme and Branding > Brand packs > Export .zip) and attach it to the change: it is the rollback.
2. Import the new pack. The check runs before anything is saved (theme rules, contrast of text on buttons, header and table headers to WCAG AA, image types, SVG safety) and shows the colours and the contents.
3. Choose the options (also set the print logo of the primary company; also set the application name), then Apply. The import is in the audit trail (entity branding, action import).
4. Check a printed document (Sample document), a sample e-mail and the sign-in page.
5. A client brand pack that carries a third party's marks (for example the Toyota Insurance Services pack) is applied only in that client's environments and only with the client's written permission on file. Support refuses the change without it.

Rollback: import the pack exported in step 1.

## E-signature revocation

A signature version is revoked when a signatory leaves, a signature was captured in error, or misuse is suspected. Revocation is immediate and final for that version: it no longer prints on any document, including reprints of older documents.

1. The request comes from the broker's System Administrator or the signatory, in writing, with the reason.
2. Company signatory: Master > Generals > Insurance Management > Signatories, E-signature, Revoke with the reason (`write:masters`). User signature: the administrator revokes it from the user (a user's own signature can be captured only by that user).
3. Check the audit trail (entity e-signature, action revoke) and the document signature mapping of Theme and Branding: a slot that pointed to the revoked signatory prints the name without an image until a new signatory or version is set.
4. If misuse is suspected, handle it as a security incident: preserve the audit trail and list the documents issued with that version since the suspected date.

# Backup verification and DR drills

## Backup verification

| Item | Standard (from architecture document 09) |
|---|---|
| Database | Daily automated snapshots and point-in-time restore; retention at least 30 days (35 recommended) |
| Upload volume (documents, ID images, generated reports) | Daily backup |
| Secrets | `JWT_SECRET`, `DATA_ENCRYPTION_KEY` and `PII_ENCRYPTION_KEY` held in the secret store, with a sealed escrow copy; without the same `DATA_ENCRYPTION_KEY` users with two-step verification cannot sign in after a restore, and without the same `PII_ENCRYPTION_KEY` the TIN, government ID and bank account numbers cannot be read. Key custody and rotation: chapter Operational procedures for the new capabilities |
| Daily | Backup jobs succeeded; latest restorable time within 15 minutes |
| Quarterly | Point-in-time restore to a new instance, API started against it in an isolated environment, smoke test; document restore and sample check. A Pre-Prod created from a Production backup in the quarter counts as this test |
| Twice a year | Logical dump restore into a clean PostgreSQL 16; row counts compared with the source |
| Yearly | Secret escrow check under dual control |

Each test is recorded (date, operator, backup used, recovery point, duration, issues) and reviewed by the DevOps lead. A failed test is raised as a P2 incident.

## DR drills

| Drill | Frequency | Success criteria |
|---|---|---|
| Tabletop DR exercise with the broker's IT and business contacts | Yearly | Roles, contacts and decision points confirmed; actions logged |
| Full recovery in the recovery region | Every two years | Achieved RTO and RPO recorded against the agreed objectives |

The objectives proposed in architecture document 08 are: RPO at most 15 minutes and RTO at most 4 hours for a restore of the main data; RTO at most 15 minutes for an infrastructure failure inside the region; RPO and RTO at most 24 hours for the loss of a region. They become binding only when the broker accepts them and the environment is provisioned to meet them.

# Service reporting and KPIs

## Monthly service report

Sent by the 10th business day of each month and discussed in a monthly service review with the broker's IT head and System Administrator.

- Tickets opened, resolved and open, by severity, category and module.
- SLA performance per severity, with the tickets that missed a target and why.
- P1 and P2 incidents with their RCA status.
- Problems and known errors opened and closed.
- Changes and releases made; failed or rolled-back changes.
- Availability of production in the month and planned downtime.
- Monitoring and backup verification results; DR drill results when held.
- Security events and access review results.
- Trends, risks and recommendations, including training needs seen in the tickets.

## KPIs

| KPI | Definition | Target (proposed) |
|---|---|---|
| Response SLA | Tickets responded to within target / tickets | 95% |
| Restore SLA | Tickets restored within target / tickets | 90% (P1: 100%) |
| Availability | Minutes production was available in service hours / minutes in service hours, excluding planned maintenance | 99.5% |
| Reopen rate | Tickets reopened / tickets resolved | Below 5% |
| Backlog age | Open P3 tickets older than 30 days | 0 |
| RCA on time | P1 RCA reports delivered within 5 business days | 100% |
| Change success | Changes without rollback or incident / changes | 95% |
| Backup tests | Planned restore tests done and passed | 100% |
| First contact resolution at L1 | Questions closed by the broker's super users without a ticket | Tracked by the broker |

# Knowledge base

- iorta TechNXT keeps a knowledge base shared with the broker's L1 contacts: how-to articles, known errors with workarounds, release notes, and the answers to repeated questions.
- Each article names the screen by its menu path, the role, the BrokerVerse release it applies to and the date reviewed.
- Every resolved ticket is checked for a knowledge article: a new article, an update or none needed.
- The user manual (Appendix F, Troubleshooting; Appendix G, Known limitations) and the role decks are the starting set.
- Articles are reviewed at each release and at least twice a year.

# Handover from hypercare

Production support takes over from the project team when these criteria are met:

| Criterion | Evidence |
|---|---|
| No open P1 or P2 issue | Hypercare log |
| First month-end close completed with the Accounting Manager's approval | Month-End Close run approved; trial balance reviewed |
| Known issues and workarounds documented | Known-error records in the knowledge base |
| Environment documentation current | Environment sheet: addresses, versions, release tag, backups, monitoring, secrets owners; removal of the go-live Pre-Prod recorded |
| Configuration baseline recorded | Export or copy of the configuration workbook as built in production |
| Contacts and escalation matrix agreed | Support agreement annex |
| L1 super users trained on raising tickets | Attendance and a test ticket |
| Monitoring and alarms live; first backup verification passed | Monitoring dashboard; restore test record |
| Handover meeting held | Minutes signed by the broker's IT head, the iorta TechNXT project manager and support manager |

Open P3 and P4 items move to the production support backlog with their history.

# Root-cause analysis standards

An RCA is written for every P1 and for each problem record. The draft goes to the broker within 5 business days of service restore.

| Section | Content |
|---|---|
| Summary | What happened, impact (users, branches, transactions, amounts), duration |
| Timeline | Detection, response, escalation, workaround, restore, with times in PHT |
| Evidence | Request IDs and log lines, `job_runs` rows, Audit Trail entries, monitoring graphs, the release deployed at the time |
| Root cause | The cause found with a structured method (five whys or cause-and-effect), classed as code, configuration, data, infrastructure, third party, process or user |
| Contributing factors | Monitoring gaps, missing tests, unclear procedure |
| Data impact | Records affected and how they were corrected or confirmed correct, including the ledger |
| Corrective actions | What fixed this occurrence |
| Preventive actions | What stops it happening again (test added, alarm added, procedure or training), with owner and date |
| Personal data | Whether personal data was involved; if yes, the incident is also handled under chapter 20 |

RCAs are blameless: they look at systems and processes, not at individuals.

# Code fix standards

## Branching and review

- Fixes start from the release tag running in production (for example `v1.0.0` on branch `brokerverse-platform`) on a branch named `fix/<ticket-number>-<short-description>`.
- Every change goes through a pull request reviewed and approved by an engineer other than the author. The review checks the fix, the test, permissions on any route, audit calls on any change, and that no secret or personal data is in the code or the test data.
- Continuous integration (`.github/workflows/ci.yml`) runs on every push and pull request: backend lint and tests, front-end tests and production build, backend image build. A red pipeline blocks the merge.
- The fix is merged to the release branch and tagged as a new patch release; it is also merged into the main development line so it is not lost in the next release.

## Rules for the change

- Database migrations only add (new tables, columns, indexes). Existing data is changed only by a reviewed migration or a data correction under change control.
- A new or changed setting has its code fallback equal to the seeded value; `npm run check:settings` and the test suite check this.
- A new route declares its screen, its permission (`requirePermission`), body validation and an `audit()` call on every change; `npm run export:api` regenerates the API documentation.
- No business parameter (rate, account code, limit, e-mail text) is hard-coded: it is a setting in Master > Configuration.
- An importer change regenerates the upload templates (`node scripts/build-upload-templates.js`); `upload-templates.test.js` checks the headers against the importers.
- ESLint must be clean (`npx eslint src test scripts`).

## Tests

| Test | Command | Standard |
|---|---|---|
| Unit and integration test for the fix | A test in `backend/test` that fails before the fix and passes after it | Required for every code fix |
| Backend suite (vitest, PostgreSQL 16) | `TEST_DATABASE_URL=postgres://.../brokerverse_test npx vitest run` | All tests pass. Each test file drops and recreates the schema of the test database, so it never points at a database in use |
| Front-end tests | `npx craco test --watchAll=false` in `brokerverse/` | All tests pass |
| Lint | `npx eslint src test scripts` | Clean |

# Regression testing

Before any release reaches production, iorta TechNXT runs the regression below in UAT (and in SIT for a large broker) and attaches the results to the change.

1. The backend vitest suite and the front-end tests (chapter 18).
2. The UAT data scenario on a fresh database, migrated and seeded with reference data only:

```
API_BASE=https://<test-api>/api ADMIN_PASSWORD=... PERSONA_PASSWORD=... node scripts/uat-scenario.js
```

The scenario runs the complete broking cycle of a Philippine non-life broker through the API with one user per role: set-up, go-live migration, retail and corporate business, billing and collection, endorsements, renewals and claims, remittances, commission and petty cash, reinsurance and incentives, reconciliation, month-end and reports. Its run log (`UAT_REPORT`, by default `docs/e2e/UAT_SCENARIO_RUN.md`) must show all steps passed. The run of 30 September 2026 passed 382 of 382 steps. Passwords come from the environment only.

3. The broker's key users run the UAT scripts (`docs/onboarding/UAT_SCRIPTS.md`) that cover the changed area.
4. For changes to printed documents and reports: the document and report sweep (`backend/scripts/doc-report-sweep.js`) and a check of the letterhead on the PDFs.

A failed step blocks the release until it is fixed or the CAB accepts the risk in writing.

# Security incidents and personal data breaches

## Security incidents

A suspected security incident (unauthorised access, credential attack, data exposed, malware, a leaked secret) is handled as a P1.

1. Contain: disable affected users, rotate exposed secrets (`JWT_SECRET` signs every user out; `DATA_ENCRYPTION_KEY` rotation is planned with the restore impact in mind; `PII_ENCRYPTION_KEY` with the rotation procedure of the operational procedures chapter; connector credentials with the provider), revoke e-signature versions that may have been misused, block addresses at the load balancer, isolate affected components.
2. Preserve evidence: logs, `login_history`, `audit_log`, monitoring data, database snapshot.
3. Assess what data and which data subjects are affected.
4. Recover and verify.
5. Report and learn: RCA, preventive actions.

## Personal data breaches

BrokerVerse holds personal data of prospects, clients, claimants and users (names, contact details, addresses, government ID numbers and images, vehicle details, bank details of referrers). The broker is the personal information controller; iorta TechNXT acts as personal information processor under the data sharing or outsourcing agreement.

| Step | Who | Time |
|---|---|---|
| iorta TechNXT informs the broker's DPO and System Administrator of a suspected breach | iorta TechNXT support manager | Without delay, and within 24 hours of discovery (proposed contract term) |
| Assessment: whether the breach involves sensitive personal information or information that may enable identity fraud, and is likely to give rise to a real risk of serious harm | Broker's DPO with iorta TechNXT | Immediately |
| Notification to the National Privacy Commission, where required | Broker's DPO | Within 72 hours of knowledge of the breach |
| Notification to affected data subjects, where required | Broker's DPO | Within 72 hours, unless the NPC allows otherwise |
| Full report and evidence | iorta TechNXT and the broker | As requested by the NPC |
| Breach register entry and annual report of breaches | Broker's DPO | As required by the NPC rules |

With the compliance package, the broker's DPO logs the incident at once in Compliance > Data Privacy (NPC) > Breach Register: the 72-hour clock runs from the time discovered, and the hourly job `privacy-breach-deadlines` reminds the data privacy team at 48, 24 and 6 hours before the deadline. iorta TechNXT supports the broker with the facts (what, when, which records, which users, containment) but does not notify the NPC or data subjects on the broker's behalf unless the agreement says so. The broker's DPO confirms the current NPC rules on breach notification.

## Data subject requests

Requests of data subjects are the broker's: its privacy team logs and answers them in Master > Data Privacy > Data Subject Requests (due date 15 calendar days after receipt, export of personal data, anonymisation with a dry run) and records consents on the client and prospect screens. Support takes part only when a screen cannot do what the request needs:

| Situation | Support action |
|---|---|
| A request arrives at iorta TechNXT directly | Forwarded to the broker's DPO within 2 business days, not answered |
| Anonymise is refused although the DPO has decided the data may go | L2 reviews the reasons shown by the dry run with the DPO; any database procedure is a normal change with the DPO's written instruction |
| Overdue requests are not notified | Check that the job `privacy-requests-due` is switched on in Master > Schedules and that the privacy team holds `read:privacy` |

# Support exclusions

The following are outside production support and are handled as change requests or separate services:

- New features, new reports, new printed documents and customisation.
- New integrations, or changes caused by a third party (insurer, bank, payment gateway, e-mail provider) changing its interface.
- Data entry, data cleansing and bulk data work for the broker's business.
- Business configuration done on the broker's behalf beyond the agreed hours.
- Training of new users beyond the agreed refresher sessions.
- Issues caused by changes the broker made outside the change process, or by the broker's network, devices or browsers.
- Filing of BIR, IC, NPC or AMLC returns and reports; tax, legal and audit advice.
- Recovery of data deleted by the broker's users beyond what the backups hold.
- Support of releases more than two planned releases behind the current one (assumption).

# What the broker provides

- Named L1 super users (one per team) and a System Administrator, trained and available in service hours.
- A broker change owner and an IT head for escalations and CAB decisions; a DPO for privacy matters.
- Tickets with the minimum content of chapter 7.
- Access to the people who can reproduce the issue and test the fix.
- Testers for the UAT scripts before each release, and approval within the agreed time.
- Timely decisions on severity disputes, changes and releases.
- Notice of business events that affect support: month-end and year-end dates, BIR filing dates, peak renewal periods, new branches or large data loads.
- Credentials and contracts of third parties the broker owns (SMTP mailbox, payment gateway merchant account, bank formats), and their support contacts.
- Supported browsers (current Chrome, Edge or Firefox) and a working network.
