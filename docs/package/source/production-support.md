---
title: Production Support
subtitle: Approach and Standards
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; L1, L2, L3=Support levels 1, 2 and 3; PHT=Philippine time (UTC+8); SLA=Service level agreement; KPI=Key performance indicator; RCA=Root-cause analysis; CAB=Change advisory board; DR=Disaster recovery; RTO=Recovery time objective; RPO=Recovery point objective; NPC=National Privacy Commission; DPO=Data protection officer; PITR=Point-in-time restore; UAT=User acceptance test; ITIL=IT Infrastructure Library; PR=Pull request
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

# Support model

## Levels

| Level | Who | Scope |
|---|---|---|
| L1 | Broker super users: one trained key user per team, and the broker's System Administrator | How-to questions; checks that a role, setting or master record is not the cause; users, roles, password and two-step verification resets, settings and master data; logging the ticket with the evidence |
| L2 | iorta TechNXT application support | Ticket triage and classification; reproduction in the test environment; analysis with request IDs, logs, Audit Trail and job runs; configuration and data corrections under change control; workarounds; known-error records; release coordination |
| L3 | iorta TechNXT engineering (development and DevOps) | Code defects, database corrections that need a script, performance, infrastructure, security incidents, root-cause analysis, fixes and releases |

This model maps to the levels users see in the user manual (Appendix H) and in `SUPPORT_AND_ESCALATION.md`: the key user is the first line, the broker's System Administrator the second line inside the broker, and iorta TechNXT the third line. Inside iorta TechNXT, application support (L2) and engineering (L3) split the work.

## Responsibilities of L1

- Answer how-to questions from the user manual and the role decks.
- Check the user's role and menus (`GETTING_STARTED.md`, section 2), the setting concerned (Master > Configuration) and Master > Audit Trail for a recent change.
- For uploads, compare the rejected file with the template in `docs/templates`.
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
7. Reproduce in the test environment where possible.
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
| Standard | Adding a user, resetting a password, adding a master record, changing an e-mail text | Pre-approved; done by the broker's System Administrator; recorded in the Audit Trail |
| Normal | A release; a change of tax rate, account determination or posting rule; a new document number series; a new scheduled job time; a data correction script | Change request with impact, test evidence and rollback; approved by the broker's change owner and iorta TechNXT support manager (CAB) |
| Emergency | Fix for a P1; security patch | Approved by the support manager and the broker's IT head by telephone or e-mail; recorded afterwards and reviewed at the next CAB |

## Configuration changes in production

- Settings in Master > Configuration apply at once on every server and are recorded in the Audit Trail with the old and new value.
- Changes to account determination and posting rules go through Master > Finance > Configuration Approvals: proposed by one user and approved by another. The Posting Rules screen has a Simulate button; use it before approval.
- GL accounts, tax rates and maker-checker switches are changed only with the agreement of the Accounting Manager (user manual, Master data chapter).
- iorta TechNXT does not change the broker's business configuration in production without a ticket and the broker's written approval.

## Data corrections

A correction of business data through the database is a normal change. It needs: the ticket, the script, a dry run on a copy of production in the test environment with the before and after counts, the broker's approval, a database snapshot just before it runs, and the result attached to the ticket. Financial data is corrected through the screens (correction or reversal journals) whenever the screens allow it, so the ledger keeps its trail.

# Release management and patching

## Releases

| Item | Standard |
|---|---|
| Release types | Planned release (monthly, when there are fixes or changes); emergency release (P1 or security) |
| Content | Release notes list the fixes, changes, migrations and anything an administrator must do by hand |
| Test | Each release is installed in the test environment first; the broker runs the UAT scripts that cover the change; iorta TechNXT runs the regression of chapter 19 |
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
| Failed sign-ins, locked accounts, refresh-token reuse | Daily, and alarm | L2, security |
| Backup status and latest restorable time | Daily | DevOps |

The daily health check is recorded (date, checker, result, tickets raised). Monitoring alarms raise tickets with the severity of document 11 (P1 immediate, P2 same business day, P3 next business day).

# Backup verification and DR drills

## Backup verification

| Item | Standard (from architecture document 09) |
|---|---|
| Database | Daily automated snapshots and point-in-time restore; retention at least 30 days (35 recommended) |
| Upload volume (documents, ID images, generated reports) | Daily backup |
| Secrets | `DATA_ENCRYPTION_KEY` and `JWT_SECRET` held in the secret store, with a sealed escrow copy; without the same `DATA_ENCRYPTION_KEY` users with two-step verification cannot sign in after a restore |
| Daily | Backup jobs succeeded; latest restorable time within 15 minutes |
| Quarterly | Point-in-time restore to a new instance, API started against it in an isolated environment, smoke test; document restore and sample check |
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
| Environment documentation current | Environment sheet: addresses, versions, release tag, backups, monitoring, secrets owners |
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

Before any release reaches production, iorta TechNXT runs the regression below in the test environment and attaches the results to the change.

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

1. Contain: disable affected users, rotate exposed secrets (`JWT_SECRET` signs every user out; `DATA_ENCRYPTION_KEY` rotation is planned with the restore impact in mind), block addresses at the load balancer, isolate affected components.
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

iorta TechNXT supports the broker with the facts (what, when, which records, which users, containment) but does not notify the NPC or data subjects on the broker's behalf unless the agreement says so. The broker's DPO confirms the current NPC rules on breach notification.

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
