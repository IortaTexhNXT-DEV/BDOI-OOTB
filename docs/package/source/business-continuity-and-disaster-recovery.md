---
title: Business Continuity and Disaster Recovery Plan
subtitle: BrokerVerse OOTB
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: PII_ENCRYPTION_KEY and connector credentials in the keys to recover; integration and EIS outboxes, compliance deadline jobs and brand packs in the restore checks; outages of the SMS, CTPL, insurer, EIS and screening providers
open_item: Recovery objectives become binding only when accepted in the Order Form; DR environment, partner details and contact lists to be completed per broker
acronyms: OOTB=Out of the box; EIS=Electronic Invoicing System; AMLC=Anti-Money Laundering Council; CTPL=Compulsory third party liability; COC=Certificate of cover; LTO=Land Transportation Office; SMS=Short message service; BCP=Business continuity plan; DR=Disaster recovery; RTO=Recovery time objective; RPO=Recovery point objective; PITR=Point-in-time recovery; WAL=Write-ahead log; AZ=Availability zone; DNS=Domain Name System; CDN=Content delivery network; PHT=Philippine time (UTC+8); DPO=Data Protection Officer; NPC=National Privacy Commission; IC=Insurance Commission; BIR=Bureau of Internal Revenue; OR=Official receipt; CAB=Change advisory board; Pre-Prod=Pre-production environment; SIT=System integration test; UAT=User acceptance test; L1, L2, L3=Support levels 1, 2 and 3; P1=Severity 1 (critical)
---

# Introduction

## Purpose

This plan sets out how BrokerVerse OOTB and the broking work that depends on it continue, or are restored, after a disruption: the failure of a server, a database or a whole hosting region, a corrupted database, a ransomware attack, the loss of a key person, or the end of the relationship with iorta TechNXT. It gives the recovery objectives per hosting option, the backup scheme, the restore procedures, the drill plan and the evidence kept, the roles and the communication.

It is written for the broker's management, IT head, Accounting Manager and DPO, and for the iorta TechNXT support and DevOps teams.

## Sources and labels

The recovery objectives and the backup scheme come from the Architecture, Infrastructure, Security and Data Privacy document (chapter on high availability, backup and recovery), the Solution Architecture documents 07 (high availability), 08 (RTO and RPO) and 09 (backup and recovery), the Hosting and Infrastructure Services Agreement and the Production Support Approach and Standards.

- **Recommended** marks a procedure or a value that iorta TechNXT advises and that is not built into the code or the deployment package.
- **[to confirm]** marks a fact that must be completed for each broker (names, telephone numbers, partner details) or decided by iorta TechNXT management.

Nothing in the code sets an RTO or RPO. The objectives in this plan become binding only when the broker accepts them in the Order Form and the environment is provisioned to meet them.

## Scope

| In scope | Out of scope |
|---|---|
| The BrokerVerse production environment: web front end, API instances, PostgreSQL database, file store, secrets, scheduled jobs and outgoing e-mail | The broker's own office network, devices, telephony and premises |
| The DR environment or cross-region backups, where the Order Form includes them | The insurers', banks' and payment gateways' own systems |
| The iorta TechNXT support and engineering service for BrokerVerse | The broker's corporate business continuity plan, which this plan feeds into |
| Manual workarounds for the broker's critical business processes while the system is down | Recovery of data deleted by users beyond what the backups hold |

# What must be recovered

## Critical business processes

The broker ranks its processes at the start of the engagement. The ranking below is the default proposal.

| Rank | Process | Maximum tolerable outage (proposal) | Why |
|---|---|---|---|
| 1 | Official receipts and payment capture | 1 business day | Clients pay daily; receipts must follow the BIR rules on the day of payment |
| 2 | Policy issuance, including motor and CTPL | 1 business day | Clients need cover and the certificate of cover to register vehicles |
| 3 | Claims notification and status | 1 business day | Loss advice to insurers is time-bound |
| 4 | Remittance to insurers | 3 business days | Remittance is due on the insurer's terms; a short delay is usually acceptable if insurers are told |
| 5 | Endorsements, renewals and quotations | 3 business days | Renewal notices run 60, 30 and 15 days before expiry, so a short outage does not cause a lapse |
| 6 | Month-end close, bank and insurer reconciliation, BIR working papers | 5 business days, except around filing deadlines | Close and filing dates are known in advance |
| 7 | Reports, dashboards, incentives, reinsurance | 5 business days | Not needed for the day's transactions |

> **Recommended:** Avoid releases and DR drills in the last three business days of the month and in the week before a BIR filing deadline.

## Service tiers

| Tier | Content | Where it lives | Recovered from |
|---|---|---|---|
| 1 | Core transactions: clients, policies, bills, receipts, journals, remittances, claims, the audit trail | PostgreSQL | Standby, PITR, snapshots, logical dumps |
| 2 | Documents: KYC images, claim photos, uploaded statements, generated PDFs | File store at `UPLOAD_DIR` | File store backups |
| 3 | Derived data: notifications, e-mail outbox, integration outbox and inbox, EIS submissions, generated reports and BI extract files | PostgreSQL and file store | Restored with the database; the jobs resume sending from the restored state (see the checks after a restore) |
| 4 | Code and configuration as code: front-end build, API image, deployment scripts | Git repository, image registry, front-end bucket | Rebuilt from the release tag |
| Keys | `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `PII_ENCRYPTION_KEY` (and `PII_ENCRYPTION_KEY_PREVIOUS` during a rotation), database and SMTP credentials, payment gateway keys, the credentials of the integration connectors, the BIR EIS and the screening provider | Secret store | Versioned secret store and the sealed escrow copy |

Settings, number series, posting rules and master data live in the database (Tier 1), so a database restore brings the configuration back with the data. The branding (theme, logos, sign-in picture) is in the settings and the file store; the latest brand pack export kept with the change records is a second copy. E-signature images are in the file store under `e-signatures/`.

# Recovery objectives

## Objectives by scenario

These are the objectives proposed in architecture document 08 and written into the Hosting and Infrastructure Services Agreement. They assume the recommended production topology: at least two API instances in two availability zones, a managed PostgreSQL database with a standby, and a shared file store.

| Scenario | RPO | RTO |
|---|---|---|
| API instance failure | 0 | Under 5 minutes |
| Availability zone failure | 0 | Under 15 minutes |
| Database instance failure (with standby) | 0 | Under 15 minutes |
| Logical corruption or wrong mass change | 15 minutes or less | 4 hours or less |
| Loss of uploaded files | 24 hours or less | 4 hours or less |
| Regional or site outage | 24 hours or less | 24 hours or less (warm standby: 8 hours) |
| Front end deleted | 0 | Under 1 hour |
| Loss of secrets | Not applicable | Under 1 hour |

## Objectives by hosting option

The same objectives apply on every option only if the option is built to the recommended topology. The table shows what each option delivers as offered.

| Scenario | A: AWS Singapore | B: Azure Singapore | C: Philippine partner | Broker-hosted |
|---|---|---|---|---|
| API instance or AZ failure | RPO 0, RTO under 15 minutes (two ECS tasks in two AZs) | RPO 0, RTO under 15 minutes (two replicas across zones) | RPO 0, RTO under 15 minutes (two API VMs behind the proxy pair) | As the broker builds it |
| Database failure | RPO 0, RTO under 15 minutes (RDS Multi-AZ) | RPO 0, RTO under 15 minutes (zone-redundant Flexible Server) | RPO 0 with synchronous replica; RTO under 15 minutes with Patroni, about 1 hour with a manual runbook [to confirm with the partner] | As the broker builds it |
| Logical corruption | RPO 15 minutes (5 achievable), RTO 4 hours, by PITR | Same, by Flexible Server PITR | RPO 15 minutes with WAL archiving (pgBackRest or WAL-G); RTO 4 hours | Depends on the broker's WAL archiving; daily dump alone gives RPO 24 hours |
| Region or site outage, pilot light | RPO 24 hours, RTO 24 hours from cross-region copies | Same, from geo-redundant backup storage | Same, from the off-site copy in a second Philippine site | Broker's own DR site |
| Region or site outage, warm standby | RPO 24 hours or better, RTO 8 hours | Same | Same | Broker's own DR site |

- **When iorta TechNXT hosts**, the price includes the environment set of the broker size (Dev, UAT and Production; SIT as well for a large broker), the temporary Pre-Prod per month of use, daily backups, monitoring and patching. A DR environment or cross-region backups are included for the Enterprise size and are an Order Form option for the other sizes. Without them, the regional objectives do not apply and a region or site loss means rebuilding production from the last backup held in the same region, if it survives.
- **The demo deployment** on one EC2 host with PM2 has no redundancy and does not meet these objectives. It is for demonstration and UAT only.
- **When the broker hosts**, the broker owns the objectives. iorta TechNXT supplies this plan, the deployment guide and support at day rates.

## Availability target

Hosted production has an availability target of 99.5% a month, measured in service hours (08:00 to 18:00 PHT, Monday to Friday, except Philippine regular holidays) by an external health check every 5 minutes, excluding planned maintenance. A DR invocation counts as unavailability unless the outage is excluded under the Hosting Agreement.

# Backup scheme

## Backups

| Backup | Frequency | Retention | Location |
|---|---|---|---|
| Automated database backups with PITR | Continuous; backup window 02:00 to 03:00 PHT | 35 days | Same region, encrypted |
| Database snapshots | Daily | 35 days | Same region |
| Monthly snapshot copy | Monthly | 12 months; yearly copy of year-end records 10 years if the broker instructs | Second region or second Philippine site |
| Snapshot before each release with database changes, before go-live imports and before each year-end close | On event | At least 30 days | Same region |
| Logical dump (`pg_dump -Fc`) | Monthly | 12 months | Write-once storage |
| File store | Daily; weekly copy to the second region or site | Daily 35 days; monthly 12 months | Same region and second region or site |
| Front-end bucket versions | Each publish | 90 days | Same region |
| API container images | Each release | Last 10 releases | Registry, replicated to the recovery region |
| Secrets | On change | All versions | Secret store with a sealed escrow copy under dual control |

> **Note:** The application contains no backup automation. Backups are configured in the hosting platform (AWS Backup and RDS, Azure Backup and Flexible Server, pgBackRest or WAL-G and the backup server under option C). The `deploy/README.md` checklist requires daily snapshots kept at least 30 days, a backup of the upload volume and of `DATA_ENCRYPTION_KEY`, and one restore test before go-live.

## Why the encryption key matters

`DATA_ENCRYPTION_KEY` encrypts the two-step verification secrets. A database restored without the same key works, but every user with two-step verification must have it reset by an administrator and enrol again. No business data is lost. The key is therefore backed up with the database: versioned in the secret store, with a sealed escrow copy held under dual control by the broker and iorta TechNXT.

`PII_ENCRYPTION_KEY` encrypts the TIN, government ID and bank account numbers of clients, prospects and referrers (field encryption of the compliance package). A database restored without the same key cannot show or search those identifiers, and BIR Form 2307, the alphalists and the AMLC report files cannot be produced with them. This key is business-critical: it is versioned in the secret store, held in the sealed escrow with the other keys, and the key in force at the time of each backup is kept for as long as that backup is kept. After a key rotation, the previous key stays with the backups taken before the rotation.

`JWT_SECRET` signs sessions and file links. Restoring with a new value only signs every user out. Connector credentials are only referred to by name in the database; they are restored from the secret store.

# Restore procedures

Detailed command-level steps are in architecture document 09. The procedures below are the order of work and the checks; L3 engineering carries them out, L2 coordinates and the broker confirms.

## Common steps for every restore

1. Declare the incident as P1 and open the bridge (chapter on communication).
2. Stop writes: set the API to zero instances or block traffic at the load balancer, and set `SCHEDULER_ENABLED=false` on any instance that stays up, so jobs do not run against a half-restored database.
3. Take a snapshot of the current state, even if damaged, for evidence and for the root-cause analysis.
4. Agree the recovery point with the broker's Accounting Manager: the last time before the damage, in PHT.
5. Restore (sections below).
6. Start one API instance. On start it checks the configuration, applies any pending migration under the advisory lock and runs the idempotent seed; `/api/health` answers 200 when ready.
7. Check `GET /api/version`: expected commit, no pending migration.
8. Run the smoke test of `deploy/README.md` section 4 and the business checks below.
9. Review the integration and EIS outboxes (business checks below), then re-enable the scheduler on one instance, scale out, open traffic.
10. Tell users what was restored to which point and what must be re-entered.

## Business checks after a restore

| Check | Who |
|---|---|
| Last official receipt, payment voucher and journal voucher numbers match the broker's paper or bank evidence | Accounting |
| Trial balance is balanced; sub-ledger tie-out of the month-end checklist passes | Accounting Manager |
| Last policies, endorsements and claims entered before the recovery point are present | Processing Team, Claims |
| Document Numbering counters are past the last numbers used; no number is reused | System Administrator |
| A sample of KYC images and claim documents opens | Operations |
| E-mail Outbox has no flood of old messages queued for resend | System Administrator |
| Integrations outbox: messages restored as queued or retry are reviewed before the scheduler restarts; SMS already received by clients, CTPL authentications and insurer requests already answered by the provider after the recovery point are cancelled, not resent | System Administrator with Operations |
| EIS outbox: submissions restored as queued, failed or sending are checked against the EIS before resending, so no invoice is submitted twice | Accounting Manager |
| Compliance deadlines: open breaches (72-hour clock), complaints and AML cases due are reviewed; the hourly breach job runs again | DPO, compliance officer |
| TIN and ID numbers display unmasked for a user with `view:pii` (proves the right `PII_ENCRYPTION_KEY`) | System Administrator |
| Branding, logo and e-signatures print on a sample document | System Administrator |
| Sign-in works for a user with two-step verification | System Administrator |

> **Recommended:** Transactions entered after the recovery point are re-entered from source documents. Official receipt numbers issued in that window are re-entered with the same numbers where the series allows, or recorded with a cross-reference memo approved by the Accounting Manager, so the BIR sequence stays explainable.

## Database: point-in-time recovery

Used for logical corruption, a wrong mass change or a bad release.

1. Restore the managed database to a new instance at the agreed recovery point (RDS or Flexible Server PITR; pgBackRest or WAL-G restore under option C).
2. Point `DATABASE_URL` of one API instance at the new instance; keep the old instance stopped, not deleted, until the root-cause analysis is done.
3. Common steps 6 to 10.

## Database: snapshot or logical dump

Used when PITR is not available (beyond 35 days, or a broker-hosted installation with daily dumps only).

1. Restore the snapshot to a new instance, or create an empty PostgreSQL 16 database with time zone Asia/Manila and run `pg_restore` of the dump.
2. Compare row counts of the main tables with the dump's own record.
3. Common steps 6 to 10.

## File store

1. Restore the file store backup of the agreed day to the same path, or to a new volume mounted at `UPLOAD_DIR` on every API instance.
2. Files uploaded after that backup are listed from the database (records whose stored file is missing) and re-uploaded by users from their originals.

## Region or site loss

1. The Incident Manager and the broker's IT head decide to invoke DR (chapter on roles).
2. In the recovery region or second site: restore the database from the latest cross-region copy, the file store from its latest copy, pull the API image of the running release from the replicated registry and the secrets from the secret store or the escrow copy.
3. Publish the front-end build of the release (or restore the bucket copy) and point DNS or the CDN origin to the recovery site.
4. Common steps 6 to 10. Update `PUBLIC_BASE_URL` and `CORS_ORIGINS` if the address changes, and re-register payment gateway webhook addresses if they change.
5. Fail back to the primary region in a planned window once it is stable, using the same procedure in reverse with a fresh backup.

## Front end and secrets

- Front end: re-run the deployment workflow on the release commit, or restore the previous bucket object versions, then invalidate the CDN.
- Secrets: restore the previous version from the secret store; if the store is lost, open the sealed escrow copy under dual control and record who opened it.

## Release rollback

Migrations only add to the schema, so the previous API image runs on the newer schema. Redeploy the previous image tag and front-end build. Restore the pre-release snapshot only if data written by the new release must be undone.

# Scenarios

## Region or data centre outage

| Item | Response |
|---|---|
| Trigger | Provider status page or partner notice; health checks failing from outside; no AZ in the region usable |
| First hour | P1 declared; provider's estimate of restoration obtained; broker told |
| Decision | Invoke DR if the provider gives no restoration within 4 hours or no estimate at all, or earlier if a critical deadline is at risk [threshold to confirm with the broker] |
| Recovery | Region or site loss procedure; objectives 24 hours (pilot light) or 8 hours (warm standby) |
| Without a DR option | Wait for the provider; continuity relies on the manual workarounds below |
| Data residency | A recovery region outside the Philippines is a transfer the broker must have documented in advance. Under option C both sites are in the Philippines |

## Database corruption or wrong mass change

| Item | Response |
|---|---|
| Trigger | Users report wrong balances or missing records; trial balance out of balance; failed migration; a mass update by script went wrong |
| Containment | Stop writes at once; find the first wrong transaction with Master > Audit Trail, `audit_log` and request ids |
| Recovery | PITR to just before the first wrong change; RPO 15 minutes, RTO 4 hours |
| Alternative | For a small, well-identified error, a reviewed data correction under change control instead of a restore (Production Support Approach, data corrections) |

## Ransomware or destructive attack

| Item | Response |
|---|---|
| Trigger | Encrypted or deleted files, unknown administrator activity, ransom note, alarm on mass deletion |
| Containment | Isolate the environment; revoke cloud and database credentials; rotate `JWT_SECRET` to sign every user out; disable affected accounts; block addresses at the WAF |
| Evidence | Preserve logs, `login_history`, `audit_log`, monitoring data and a snapshot before any clean-up |
| Recovery | Rebuild clean infrastructure from code; restore from a point before the compromise, preferring the write-once monthly dump and the cross-region copies, which an attacker with production credentials cannot alter |
| Before reopening | Root cause found and closed; all secrets rotated; administrator passwords and two-step enrolments reset |
| Privacy | Treated as a possible personal data breach: notice to the broker's DPO within [24] hours of discovery; the DPO decides on notification to the NPC within 72 hours |
| Ransom | iorta TechNXT does not negotiate or pay on the broker's behalf; any decision is the broker's, with legal advice |

> **Recommended:** Keep backup deletion rights in a separate account or role from production administration, and use object lock or write-once storage for the monthly dumps.

## Key person loss

| Risk | Control |
|---|---|
| Loss of the iorta TechNXT engineer who knows a module | Code standards and the Technical Reference; module pattern shared by every module; knowledge base of known errors; at least two engineers trained on each module [to confirm named backups] |
| Loss of the iorta TechNXT DevOps engineer | Deployment as code in the repository and `deploy/`; runbooks in architecture document 09; cloud access through named roles, never a personal account; break-glass access under dual control |
| Loss of the broker's System Administrator | A second System Administrator named at go-live; user manual and role guides; iorta TechNXT L2 covers in the meantime |
| Loss of the broker's Accounting Manager | A second user with the Accounting Manager role, so maker-checker approvals can continue |
| Loss of the person holding the escrow copy | Two named holders on each side, recorded in the secret escrow register |

## Vendor exit or failure

| Item | Response |
|---|---|
| Planned exit (end of contract) | Exit and Transition Plan: data returned in an agreed format, transition assistance, deletion within 30 days after the broker confirms the export, certificate of deletion |
| iorta TechNXT unable to continue | Broker-hosted installation: the broker already holds the database, files and keys. Hosted installation: the broker asks for an immediate export under the Exit and Transition Plan; with a perpetual licence and the optional source code escrow, the release events of the Escrow Agreement apply |
| Technology | React, Node.js 22 and PostgreSQL 16, with no proprietary middleware; any competent team in the Philippines can operate it with the Technical Reference and deployment guide |
| Hosting provider exit | The application runs on any option without code change; moving between AWS, Azure and a local partner is a planned migration from backups |

## Third-party outages

| Dependency | Effect | Workaround |
|---|---|---|
| SMTP mailbox | E-mails wait in the E-mail Outbox; transactions continue | Resend from the outbox when the mailbox is back; send urgent documents from a normal mailbox |
| Payment gateway | Payment links fail; no automatic receipts | Clients pay by bank transfer or cheque; Accounting records the receipt |
| Bank portal | Transfers to insurers cannot be executed | Approved remittances wait; cheques where the insurer accepts them |
| Insurer systems | Insurer requests (issuance, premium data, claim status) stay in Retry; policies and claims continue | Record the insurer's policy number by hand; import the claim status file when the API is back |
| SMS or Viber gateway | Renewal notices, reminders and claim updates wait in the integrations outbox | Resend after recovery; e-mail notices continue |
| CTPL authentication provider or LTO feed | COCs wait for their authentication code | Authenticate through the provider's own portal and record the code; cancel the queued request |
| BIR EIS | E-invoices wait in the EIS outbox; invoicing continues | Export payloads and upload manually; record Uploaded manually |
| Screening provider | Requests fail and are retried; the uploaded lists are still screened | Screen the parties of abandoned requests manually |

# Manual workarounds while the system is down

| Process | Workaround | Catch-up after recovery |
|---|---|---|
| Collecting premium | Issue pre-numbered manual official receipts from the BIR-registered manual series kept for this purpose [to confirm the broker holds one] | Record each receipt in BrokerVerse with the manual receipt reference |
| Motor policy and CTPL | Request the policy or certificate directly from the insurer's own portal or underwriter | Record the issued policy (Record Issued Policy journey) with the insurer's number |
| Claims notification | E-mail the preliminary loss advice to the insurer from a normal mailbox | Register the claim with the actual notification date |
| Remittance | Defer by the insurer's terms; tell insurers of the delay | Run the remittance as normal |
| Client enquiries | Use the last daily exported reports (production register, SOA, renewal list) | Not applicable |

> **Recommended:** The Daily reports job (05:00 PHT) generates the scheduled daily reports (production register, collections, claims position). Keep the last day's copies, with a premium receivable SOA and the renewal list, outside the system (for example on the broker's file server) so staff can answer clients during an outage.

# Roles and responsibilities

| Role | Who | Responsibilities in a disruption |
|---|---|---|
| Incident Manager | iorta TechNXT support manager [name to confirm] | Declares P1, runs the bridge, keeps the timeline, decides with the broker's IT head on DR invocation |
| Recovery lead | iorta TechNXT DevOps lead [name to confirm] | Carries out restores and DR, records times and recovery points |
| Application lead | iorta TechNXT L3 engineer [name to confirm] | Checks migrations, data integrity, jobs and the application after restore |
| Broker IT head | [to confirm] | Approves DR invocation, recovery point and reopening; coordinates the broker's network and devices |
| Broker Accounting Manager | [to confirm] | Agrees the recovery point; runs the financial checks; approves re-entry and receipt series treatment |
| Broker System Administrator | [to confirm] | User communication, two-step resets, numbering checks, outbox |
| Broker DPO | [to confirm] | Decides on NPC and data subject notification when personal data may be affected |
| Broker sponsor | [to confirm] | Decides on communication to insurers, clients and regulators |

# Communication

| When | Who informs | Whom | How |
|---|---|---|---|
| Within 30 minutes of a P1 | iorta TechNXT Incident Manager | Broker System Administrator and IT head | Telephone, then e-mail |
| Every hour during a P1 | Incident Manager | Broker IT head and sponsor | E-mail status update |
| Outage over 1 hour | Broker System Administrator | All users | E-mail or chat; banner on the intranet |
| Outage affecting receipts or issuance over 1 business day | Broker sponsor | Insurers concerned | E-mail from the broker |
| Possible personal data breach | iorta TechNXT | Broker DPO | Within [24] hours of discovery, written |
| Regulator notification, where required | Broker DPO or compliance officer | NPC; IC if the broker's compliance officer decides it is required | As the rules require |
| Recovery complete | Incident Manager | Broker IT head and System Administrator | E-mail with recovery point, data to re-enter and next steps |
| After the incident | iorta TechNXT | Broker | RCA draft within 5 business days |

Contact list (to be completed for each broker and reviewed every six months):

| Role | Name | Mobile | E-mail |
|---|---|---|---|
| iorta TechNXT service desk (P1 line) | [to confirm] | [to confirm] | [to confirm] |
| iorta TechNXT Incident Manager | [to confirm] | [to confirm] | [to confirm] |
| iorta TechNXT DevOps lead | [to confirm] | [to confirm] | [to confirm] |
| Broker IT head | [to confirm] | [to confirm] | [to confirm] |
| Broker System Administrator and deputy | [to confirm] | [to confirm] | [to confirm] |
| Broker Accounting Manager | [to confirm] | [to confirm] | [to confirm] |
| Broker DPO | [to confirm] | [to confirm] | [to confirm] |
| Hosting provider or partner support | [to confirm] | [to confirm] | [to confirm] |

# DR drills and evidence

## Drill calendar

| Test | Frequency | Success criteria |
|---|---|---|
| Backup jobs succeeded; latest restorable time within 15 minutes | Daily | Recorded in the daily health check |
| PITR to a new instance, API started against it in isolation, smoke test | Quarterly and before go-live | Restore completed within 4 hours; smoke test passed |
| Pre-Prod created from a Production backup (cutover rehearsal and each major release) | Each time Pre-Prod is created | Database and file store restored in full; API started; smoke test passed; restore time recorded |
| File restore with a sample of documents | Quarterly | Sample opens |
| Logical dump restore into a clean PostgreSQL 16, row counts compared | Twice a year | Counts equal |
| Secret escrow check under dual control | Yearly | Escrow key matches the live key (compared by hash, not by reading it out) |
| Tabletop exercise of a region loss and of ransomware with the broker | Yearly | Roles, contacts and decision points confirmed; actions logged |
| Full recovery in the recovery region or site | Every two years (where a DR option is in the Order Form) | Achieved RTO and RPO recorded against the objectives |

Pre-Prod is temporary for every broker size (Environment Strategy and Production Rollout Plan). It is always created by restoring a full Production backup, database and file store, at production topology. Each creation is therefore run and recorded as a DR drill: the restore test record notes the backup used, the recovery point, the start and end times and the achieved restore time, and the result counts as the quarterly PITR test of that quarter when the restore used PITR. The Pre-Prod copy is masked before people without production access use it, and it is deleted when the rehearsal or release is over.

> **Recommended:** Hold the first tabletop before go-live, in the cutover rehearsal week, so the contact list and the decision thresholds are agreed before they are needed. The creation of Pre-Prod for the cutover rehearsal is the first full restore drill.

## Evidence kept

| Evidence | Content | Kept by | Retention |
|---|---|---|---|
| Restore test record | Date, operator, backup used, recovery point, start and end times, achieved RTO and RPO, checks run, issues | iorta TechNXT DevOps; copy to the broker | 3 years (recommended) |
| Tabletop minutes | Scenario, participants, decisions, gaps, actions with owners and dates | iorta TechNXT support manager | 3 years |
| DR exercise report | Timeline, achieved objectives, deviations, lessons, plan updates | iorta TechNXT; signed by the broker's IT head | 3 years |
| Escrow register | Holders, envelope or vault reference, dates opened and resealed | Broker and iorta TechNXT jointly | Life of the contract |
| Monthly service report | Backup status and test results of the month | Both | Life of the contract |

A failed test is raised as a P2 incident and fixed before the next scheduled test. Results are available to the broker's auditors and, on request, to regulators.

# Maintaining this plan

- Reviewed yearly, after each DR exercise, after any P1 that needed a restore, and when the hosting option, topology or contacts change.
- Changes are approved by the broker's IT head and the iorta TechNXT support manager and recorded in the document control table.
- The contact list is checked every six months and at each change of key personnel.
