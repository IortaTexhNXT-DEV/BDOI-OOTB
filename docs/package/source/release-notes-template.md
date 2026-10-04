---
title: Release Notes
subtitle: BrokerVerse OOTB release or patch [x.y.z], template
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Template; one copy per release or patch. 1.1: sections for scheduled jobs, integration connectors, environment variables and keys, and regulatory settings to confirm
open_item: Replace every [placeholder] and delete the sections that do not apply before issue
open_item_owner: iorta TechNXT release manager
acronyms: OOTB=Out of the box; CAB=Change advisory board; CR=Change request; UAT=User acceptance test; API=Application programming interface; PHT=Philippine time (UTC+8); P1, P2=Incident priorities 1 and 2
---

# How to use this template

iorta TechNXT issues release notes with every patch, minor and major release, as required by the upgrade and versioning policy of the Release Notes and Product Roadmap and by the release management chapter of the Production Support Approach and Standards. The notes go to the broker's System Administrator and IT head with the request for change, at least 5 business days before deployment, and are attached to the CAB record.

- Copy the template, set the version number in the title, and replace every text in [square brackets].
- Use the system's own names for menus, screens, settings and statuses, exactly as on screen, for example Master > Configuration > Billing, Collections & Credit.
- Describe the effect on the user, not the code. Each item says what changes, for whom, and whether anyone must act.
- Delete the sections that have no content and this chapter before issue.

| Release type | Content | Notice |
|---|---|---|
| Patch (1.0.z) | Defect fixes and security fixes; no change to how users work | 5 business days; emergency release for a P1 or a security issue |
| Minor (1.y.0) | New functions, new reports, regulatory form updates, component upgrades; data and settings kept | 5 business days |
| Major (x.0.0) | Changes that need a migration project, retraining or a change of hosting components | Announced at least 6 months ahead |

# Release identification

| Item | Value |
|---|---|
| Product | iNXT BrokerVerse OOTB |
| Release | [x.y.z], [Patch / Minor / Major] |
| Repository tag and commit | [vx.y.z], commit [short hash]; `GET /api/version` shows it after deployment |
| Previous release in production | [x.y.z] |
| Planned deployment | [date], [time] PHT, in the maintenance window |
| Expected downtime | [none / minutes] |
| Change request (CAB) | [RFC number], approved on [date] |
| Prepared by | [name], iorta TechNXT |

# Summary

[Two to four sentences for managers: why this release, what users will notice, and whether any action is needed before or after deployment.]

# New and changed functions

| Area | Change | Who is affected | Action needed |
|---|---|---|---|
| [for example Accounting] | [what the user can now do, with the menu path] | [roles] | [none / train / switch on setting ...] |

# Fixed defects

| Ticket or defect | Problem | Fix | Severity |
|---|---|---|---|
| [BV-DEF-nnn / ticket no.] | [what users saw] | [what now happens] | [P1 to P4] |

# Security fixes

| Item | Component | Severity | Note |
|---|---|---|---|
| [advisory reference] | [package or component] | [critical / high / moderate] | [effect; no user action / action] |

Security patches follow the agreed timelines: critical within 14 days and high within 30 days of a fix being available.

# Regulatory and configuration changes

| Item | Change | Setting or master | Delivered value | Broker to confirm |
|---|---|---|---|---|
| [for example premium tax rule, BIR form layout, DAT file layout version, AMLC transaction codes, IC complaint deadlines, number series] | [ ] | [key or screen] | [value] | [yes / no: the tax adviser, compliance officer or DPO confirms] |

Settings and master data changed by the broker are kept: a release adds what is missing and never overwrites a value the broker has changed, unless this section says so.

# Scheduled jobs

| Job (code) | Change | Delivered | Action for the broker |
|---|---|---|---|
| [for example `eis-outbox`] | [new job / new timing / new parameter] | [On / Off, timing Asia/Manila] | [switch on in Master > Schedules when ... / none] |

A new job is registered without changing the jobs the broker already edited. The Schedules and Batch Jobs document lists every job; update its support runbook for each new job.

# Integrations and connectors

| Connector or interface | Change | Mode delivered | Partner action |
|---|---|---|---|
| [for example SMS_SEMAPHORE, CTPL_AUTH, INSURER_API, BANK_FILES, BIR EIS, screening provider] | [new connector / new message type / new adapter option] | [Test mode / Live / Switched off] | [none / partner to certify / credentials to issue] |

A connector delivered in test mode sends nothing outside the system. The partner's certification and the credentials stay with the partner and the broker.

# Environment variables and keys

| Variable | Change | Required | Who sets it |
|---|---|---|---|
| [for example `PII_ENCRYPTION_KEY`] | [new / renamed / new rule] | [yes: the API refuses to start without it / optional] | [DevOps of the hosting party, in the secret store; never in the release notes] |

Never write a key value in the release notes. A new key is backed up with the database and added to the sealed escrow copy.

# Database changes

| Migration | What it does | Effect on existing data | Reversible by redeploying the previous release |
|---|---|---|---|
| [NNNN_name.sql] | [adds table / column / setting] | [none / records updated: ...] | [yes / no, explain] |

Migrations are applied automatically when the API starts, under a lock. A database snapshot is taken before deployment.

# Actions for the broker

## Before deployment

- [for example: confirm the new setting value with the Accounting Manager]
- [UAT scripts to re-run in the test environment: ...]

## After deployment

- [for example: switch on the job ... in Master > Schedules; check the E-mail Outbox and the Integrations outbox]
- [for example: import the brand pack exported from UAT; check a sample document]
- Check the smoke test result sent by iorta TechNXT.

# Known issues in this release

| Item | Effect | Workaround | Planned fix |
|---|---|---|---|
| [ ] | [ ] | [ ] | [release or backlog] |

# Testing performed

| Test | Result |
|---|---|
| Automated business-rule tests | [n passed of n] |
| Regression set in the test environment | [n passed, n failed, n not run] |
| Broker UAT of the changed areas | [signed by ... on ...] |
| Security checks (dependency audit, image scan) | [result] |

# Rollback plan

Front end: redeploy the previous build. Back end: redeploy the previous image tag; migrations only add to the schema, so the previous release runs on the newer schema. The database snapshot is restored only if data must be rolled back, with the broker's approval. [Add any release-specific step.]

# Approval

| Role | Name | Decision | Date |
|---|---|---|---|
| iorta TechNXT release manager | [ ] | [Ready for deployment] | [ ] |
| Broker IT head or System Administrator | [ ] | [Approved / Approved with conditions / Not approved] | [ ] |
| CAB | [ ] | [Approved] | [ ] |
