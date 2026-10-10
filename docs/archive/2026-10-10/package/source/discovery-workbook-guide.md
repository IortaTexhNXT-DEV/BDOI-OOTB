---
title: Discovery Workbook Guide
subtitle: Running the discovery and configuration workshops for BrokerVerse OOTB
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; CR=Change request; PM=Project manager; UAT=User acceptance test; SIT=System integration test; LGU=Local government unit; ATC=Alphanumeric tax code; GL=General ledger; BIR=Bureau of Internal Revenue; ATP=Authority to Print; SoD=Segregation of duties; DPO=Data Protection Officer
---

# Introduction

## Purpose

This guide explains how iorta TechNXT and the broker use the **BrokerVerse_Discovery_and_Configuration_Workbook.xlsx** at mobilisation and in the discovery workshops. The workbook is the configuration workbook named in the Implementation Approach and Plan: it holds every decision that turns the delivered system into the broker's system, and it is signed off at the end of discovery.

Discovery in an OOTB implementation is limited to configuration. Each workshop shows the delivered screens with the broker's own examples and records decisions. It does not collect requirements for new development. A need that configuration cannot meet is recorded as a gap and goes to the change request process.

## What is in the workbook

| Sheet | Content | Items |
|---|---|---|
| Instructions | How to fill the workbook, columns and status values | |
| Summary | Count of items per sheet and status, percent configured | |
| Company and Branches | Legal identity, branding, branches, people, calendar, dashboards, hosting | 22 |
| Users and Roles | Users, role mapping, two-step verification, password policy, SoD, access reviews | 18 |
| Insurers | Insurer master, credit and remittance terms, billing mode, statements, co-insurance | 15 |
| Products and LOB | Lines, products, covers, placement journey, motor tariff, KYC, renewals, claims | 22 |
| Commission Rates | Rate matrix, referrers, sharing, withholding, payout rules, incentives | 9 |
| Chart of Accounts | Chart, account determination, posting rules, close, opening balances, collections | 35 |
| Banks and Gateways | Bank accounts, statement formats, payment modes, payment gateways, transfers | 12 |
| Numbering Series | Every document series with its prefix, pattern and reset rule | 62 |
| Approvals and Limits | Authority matrix, maker-checker switches, remittance approval, credit limits | 23 |
| E-mail and Templates | Sender, client and insurer e-mails, claim letters, receipt footer, privacy notice | 18 |
| Taxes and LGU | Premium taxes, LGU rates, tax codes and ATC, VAT status, BIR documents | 15 |
| Data Migration Sources | Source, count and owner of each object to load, scope, mock load dates | 22 |
| Integrations | SMTP, bank files, payment gateway, insurer files, ledger export, network | 12 |
| Reports | Schedules, retention, report gaps and every catalogue report | 43 |

Each row gives the question, the screen where the answer is configured (menu names as on screen), the value delivered out of the box, the broker's answer, the owner, the phase it is needed by, a due date, a status and the setting key or template.

# Before the workshops

## At mobilisation (week 1)

1. The iorta TechNXT PM sends the workbook with the data request list at kick-off.
2. The broker's PM names an owner for each role in the Owner column (for example the Accounting Manager by name) and sets due dates from the plan of the implementation size.
3. Owners answer the items marked **Mobilisation** in the first week: legal identity, go-live date, hosting option, user counts, volumes and the data migration sources. These fix the size and the plan.
4. iorta TechNXT loads the broker's legal name, logo and a few of its own products and insurers into the test environment, so the workshops show the broker's names on screen.

## Preparing each workshop

- Send the relevant sheets two working days ahead and ask owners to fill what they already know.
- Ask for samples: an insurer statement, a bank statement per account, the current policy register, a commission statement, last month's trial balance, current official receipt and invoice formats with the ATP.
- Prepare a scenario from the broker's own business for each workshop (for example a co-insured fire risk, a motor renewal, a direct-bill insurer).

# Workshop plan

The workshops follow the Implementation Approach and Plan. Durations are recommended for a medium broker; a small broker can combine workshops, a large broker may need a second session for ledger and tax.

| # | Workshop | Participants (broker) | Sheets | Duration (recommended) |
|---|---|---|---|---|
| 1 | Organisation and access | Sponsor, System Administrator, IT head | Company and Branches; Users and Roles | Half day |
| 2 | Sales and placement | Sales & Marketing, Processing Team | Products and LOB; Insurers (placement and co-insurance); E-mail and Templates (client texts) | Half day |
| 3 | Policy servicing and renewals | Operations, Processing Team | Products and LOB (renewals, KYC, endorsements) | Half day |
| 4 | Claims | Claims | Products and LOB (claims rows); Insurers (loss advice); E-mail and Templates (claim letters) | Two hours |
| 5 | Billing, collection and remittance | Accounting, Accounting Manager | Insurers (terms, billing mode); Banks and Gateways; Approvals and Limits | Half day |
| 6 | Commission and incentives | Accounting, Sales & Marketing | Commission Rates | Two hours |
| 7 | Ledger and close | Accounting Manager | Chart of Accounts; Numbering Series | Half day |
| 8 | Tax | Accounting Manager, tax adviser | Taxes and LGU; Numbering Series (BIR documents) | Two hours |
| 9 | Data, integrations and reports | IT head, data owners, report users | Data Migration Sources; Integrations; Reports | Half day |

> **Recommended:** Hold workshop 1 first, because roles and approvers are needed in every later workshop, and workshop 8 after workshop 7, because tax codes point to GL accounts.

# Running a workshop

## Agenda

1. Purpose, scope and the rule "configure, do not customise" (5 minutes).
2. Walk through the delivered process on screen with the broker's scenario, role by role.
3. Go through the workbook rows of the workshop in order. For each row: show the screen, read the OOTB default, agree the answer.
4. Record open questions with an owner and a due date.
5. Read back the decisions and the gaps at the end.

## Recording decisions

- Write the decision in **Client answer** in the broker's words and figures (PHP amounts, days, account codes). Where the default is kept, write "Keep default" and set the status to **Confirmed**.
- Set **Status**: Open, Answered, Confirmed, Configured, Not applicable or Gap (CR).
- Use **Notes** for the reason behind a decision, especially where it differs from the default (for example a stricter approval limit set by the board).
- Add a row at the end of a sheet, with the next ID, for an item the workbook does not have. Do not change existing IDs: they are referred to in the fit-gap register and in UAT.
- Do not paste personal data into the workbook. Staff lists and client extracts go into the upload templates.

## Classifying differences

Every difference between the broker's way of working and the delivered system is classed in the fit-gap register.

| Class | Meaning | Action |
|---|---|---|
| Fit | Delivered as it is | Confirm |
| Configure | Met by a setting or master data | Answer in the workbook |
| Procedure | The broker changes how it works | Record the new procedure for training |
| Gap | Needs a change to the product | Status Gap (CR); raise a change request; not in the go-live scope unless the steering committee approves it |

Before classing an item as a gap, check the setting key in the Notes column and Master > Configuration for the area concerned. Many apparent gaps are settings.

## Questions that need care

| Area | Why | Who decides |
|---|---|---|
| Authority matrix limits | The delivered limits are examples; the board-approved signing authority replaces them | Sponsor with the board resolution |
| Tax rates, ATC and GL accounts | Errors flow into BIR working papers | Accounting Manager with the tax adviser |
| Invoices and official receipts | Which documents are registered and how numbers continue from the old system | Accounting Manager with the tax adviser |
| Two-step verification roles | Delivered empty; recommended for administrators and accounting | IT head |
| Hosting location | Cross-border transfer under the Data Privacy Act if outside the Philippines | Sponsor with the DPO |
| SoD rules | Small teams may not be able to separate every pair of roles | Sponsor; document compensating controls |

# After the workshops

## Sign-off

1. The iorta TechNXT PM checks the Summary sheet: every item is Confirmed, Not applicable or Gap (CR); no item is Open.
2. The broker's owners review their sheets; the sponsor signs off the workbook and the fit-gap register together.
3. The signed workbook is version-controlled; any later change goes through the change process of the project and is recorded in Notes with the date.

## From workbook to configuration

- iorta TechNXT configures the test environment from the workbook in the order of `GO_LIVE_DATA_SETUP.md`, by upload where a template exists and on the screen otherwise, and sets each row to **Configured** after checking it on screen.
- The key user of each team checks the configured values in the test environment before SIT.
- After UAT acceptance the same values are applied to production. The workbook is the checklist for that step.
- The workbook is handed to production support at hypercare exit as the record of the broker's configuration.

## Common pitfalls

| Pitfall | Prevention |
|---|---|
| Late answers on insurers, commission and the chart of accounts | Ask for them at mobilisation; they drive mock load 1 |
| Decisions made by people who do not own them | Owner column filled by name at kick-off |
| Requirements written instead of decisions | Keep to the row's question; record a gap only after checking the settings |
| Defaults kept by silence | A default is kept only when the owner confirms it |
| Placeholder values left in production (sender address, loss advice recipient, sandbox gateway) | Rows marked "replace" are checked at cutover |
