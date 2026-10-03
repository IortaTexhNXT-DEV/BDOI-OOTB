---
title: Product Functionality
subtitle: iNXT BrokerVerse OOTB
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; NPC=National Privacy Commission; DPA=Data Privacy Act of 2012 (RA 10173); CTPL=Compulsory Third Party Liability; APPA=Auto Passenger Personal Accident; LTO=Land Transportation Office; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; IAR=Industrial All Risks; KYC=Know your customer; RFQ=Request for quotation; OR=Official receipt; PV=Payment voucher; JV=Journal voucher; GL=General ledger; DSR=Data subject request; SoD=Segregation of duties; TOTP=Time-based one-time password; UAT=User acceptance test; SIT=System integration test; API=Application programming interface; RPO=Recovery point objective; RTO=Recovery time objective
---

# Introduction

## Purpose

This document describes what iNXT BrokerVerse OOTB does, module by module, for a Philippine non-life insurance broker. It is written for the broker's management, process owners, finance, compliance and IT teams after the product presentation, as a reference for the evaluation and for the comparison with other vendors.

For each module it gives what the module does, its key features, the Philippine specifics, the personas who use it, the key reports, the approvals and controls, and the integrations. Later chapters describe the end-to-end process, the scope of the OOTB edition against optional extras, the non-functional capabilities, the deployment and support model, and a feature checklist the broker can use to compare vendors.

## Conventions

- Menu paths are written as on screen, for example Accounts > Bank Reconciliation > Reconciliation Workspace.
- Settings are named by their key in Master > Configuration, for example `claims.sla_days`. The value given is the delivered value; the broker can change it.
- Money is in Philippine pesos (PHP). The business time zone is Asia/Manila.
- **Recommended** marks advice from iorta TechNXT that is not built into the product.
- The figures in this document come from the product (code, configuration and screens) and from the release test of 03 and 04 October 2026. The data privacy registers, the e-mailing of receipts and invoices with PDF attachments, and approval notifications for every maker-checker flow were added after that test cycle.

## The product at a glance

| Item | BrokerVerse OOTB |
|---|---|
| Scope | Full broking cycle and broker accounting: prospects to renewals, billing to month-end close, BIR working papers |
| Personas | 7 roles: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager |
| Screens | 173 menu screens checked per role in the release test |
| Reports | 39 catalogue reports in Excel, CSV and PDF, plus dashboards and document outputs |
| APIs | 854 registered API routes, documented in OpenAPI, a Postman collection and an Excel touchpoint list |
| Scheduled jobs | 16 jobs in Asia/Manila time in the tested release, plus the overdue data subject request reminder of the data privacy module |
| Number series | 52 document number series, counters only move forward |
| Release test | 497 test cases (480 passed, 8 failed, 3 blocked, 6 not run); 634 automated business rule tests; a full UAT cycle of 371 business steps |
| Technology | React 18 web application, Node.js 22 API, PostgreSQL 16 database |
| User documentation | User manual of 199 pages for the seven roles, seven role decks |

# The end-to-end process

## The broking cycle

Every piece of business passes through the same steps. Each step is done on its own screen, usually by a different team, and each leaves a numbered document behind.

![End-to-end process: sales and placement, policy and money, servicing and finance close](/home/user/BDOI-OOTB/docs/package/source/manual-images/process-flow.png)

| # | Step | What happens | Who |
|---|---|---|---|
| 1 | Prospect | The prospect is recorded with contact details and address (LD-) | Sales & Marketing, Operations |
| 2 | Quick Quote or Request for Quotation | Packaged products are quoted from insurer rate tables; other risks go to several insurers on a broker slip (BS-, OFR-) | Sales & Marketing, Processing Team |
| 3 | Quotation | The chosen terms are priced for the client with taxes and commission; the client accepts online (QT-) | Sales & Marketing, Processing Team |
| 4 | Placement Slip | The firm order goes to the lead insurer and co-insurers; each confirms its share (PS-) | Processing Team |
| 5 | Policy issue | The policy is issued with its participants, the client is created and the premium is billed (POL-, CL-, INV-) | Processing Team |
| 6 | Payment capture | The client's payment is recorded for Accounting to verify | Operations, Sales & Marketing, Processing Team |
| 7 | Official receipt | Accounting posts the official receipt against the open bill (OR-) | Accounting |
| 8 | Commission | Referrer commission becomes payable when the premium is collected and is paid less withholding tax (PV-) | Accounting, maker and checker |
| 9 | Remittance | Collected premium, net of commission, is remitted to each insurer by its share (REM-, SET-, PV-) | Accounting, maker and checker |
| 10 | Endorsement | A change to the policy is recorded and additional or return premium is billed (END-) | Operations, Processing Team |
| 11 | Claim | A loss is registered, followed with the insurer and settled (CLM-) | Claims |
| 12 | Renewal | Policies enter the pipeline 90 days before expiry; notices at 60, 30 and 15 days | Operations, Sales & Marketing, Processing Team |
| 13 | Month-end | Bank and insurer reconciliation, month-end close, BIR reports (BRC-, MEC-, CWT-) | Accounting, Accounting Manager |

## Placement journey by line of business

Not every line uses every step. The journey of each line is set in `placement.journey` (Master > Configuration, Placement). The screens show the journey of each record as a progress bar and refuse a step the journey does not allow.

| Line of business | Request for Quotation | Quotation Slip | Placement Slip | Record Issued Policy |
|---|---|---|---|---|
| Motor | Optional | Required | Optional | Optional |
| Fire, IAR, Marine, Casualty, Engineering | Optional | Optional | Required | Optional |
| Other lines (default) | Optional | Optional | Optional | Optional |

## The money trail

Every business event posts a balanced journal through its posting rule. On a co-insured policy each payable and commission line carries its insurer, so remittance, reports and claim recoveries split by share.

| Event | Journal (summary) |
|---|---|
| Policy issued, broker billed | Dr Premiums Receivable; Cr Premiums Payable to Insurers (per insurer), premium VAT, DST and LGT due to insurers, Brokerage Commission Income (per insurer) |
| Official receipt | Dr Cash in Bank; Cr Premiums Receivable |
| Remittance to insurer | Dr Premiums Payable to Insurers; Cr Cash in Bank |
| Policy issued, direct bill | Dr Commission Receivable - Insurers (Direct Bill); Cr Brokerage Commission Income, Output VAT Payable |
| Direct bill commission collected | Dr Cash in Bank, Creditable Withholding Tax (BIR 2307); Cr Commission Receivable - Insurers |

# Functional modules

## Dashboards

**What it does.** Shows live figures from policies, bills, claims and commission lines, updated as soon as a transaction is saved.

- Executive Dashboard: Total Revenue, Active Policies, New Business, Claims Rate, Retention Rate, Premium Receivable (Clients) and Commission Receivable (Insurers, Direct Bill), against targets in `dashboard.targets`; trends by product line, region, product and agent; export of the Production Register.
- Sales Dashboard: prospects, quotations, conversion, policies issued, premium and open pipeline of the sales team or one account executive.
- Processing Dashboard (Processing Workbench): submissions received this week and older, average cycle time, data-quality alerts, workload by assignment group; high priority from PHP 5,000,000 sum insured.
- Claims Dashboard: open, overdue (past `claims.sla_days`, 20 days) and today's claims, highest line and location, recent claims, export.
- Commission Dashboard: brokerage income, comsub, net margin, outstanding payable and withholding tax, in Accounting and Management views.

![Executive Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-exec-dashboard.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | PHP figures; calendar periods in Philippine time |
| Personas | Every role sees the Executive Dashboard except Claims; Sales, Processing and Claims have their own |
| Key reports | Production Register export; claims data export |
| Controls | Figures limited by role; scoped roles see only their own records (`security.scoped_roles`) |

## Prospects and clients

**What it does.** Records prospects (leads), turns them into clients when the first policy is issued, and shows each client's policies, claims, renewals and endorsements in one view.

- Prospects for Motor, Fire and Allied Perils, Industrial All Risks and Employee Benefit, retail or corporate; corporate prospects require company name and TIN.
- Bulk upload of prospects from a template (up to 1,000 rows per file) with row-level error report.
- Lead statuses New, Contacted, Qualified, QuoteGenerated, Converted, Lost.
- Client code CL- created at first policy issue; client view with Policy, Claim, Renewal and Endorsement tabs.
- Consent per purpose recorded on the prospect and client screens (see Data privacy).

| Aspect | Detail |
|---|---|
| Philippine specifics | Philippine mobile number formats, 4-digit ZIP code, province, city and barangay address, TIN |
| Personas | Sales & Marketing, Operations; Processing Team views |
| Key reports | Lead Conversion Funnel; lead list by category |
| Controls | Changes to client details on an issued policy go through a Personal Details Change endorsement; audit trail on every change |
| Integrations | Bulk upload (XLSX or CSV) |

## Quick Quote and Compare Insurers

**What it does.** Quotes packaged products on the spot from each insurer's rate table, and compares the premiums of several insurers side by side. Non-package risks go to the insurers through a Request for Quotation.

- Packaged products delivered with the sample set-up include Burglary and Robbery, CTPL, Group Personal Accident, Householder, Micro-insurance, Motor Vehicle, Personal Accident and Travel.
- Package Bundles and Insurer Rate Tables (rate basis, minimum premium, deductible, commission) in Master > Finance.
- Premium taxes and LGU rates applied per product (Master > Finance > Premium Taxes & LGU Rates).
- Payment links for a package quotation; a paid link creates the official receipt and can issue the package policy.

![Quick Quote of packaged products](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quick-quote.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | DST counted per PHP 4.00 unit with the fraction rounded up where package pricing is set that way; LGT per city or municipality |
| Personas | Sales & Marketing, Operations |
| Key reports | Production Register, Premium by Product / Month / Insurer |
| Controls | Commission is never printed on the package quotation or insurer comparison sent to the client |
| Integrations | PayMongo and Dragonpay payment links (sandbox provider for training and UAT) |

## Motor quotation and customer approval

**What it does.** Prices a motor risk in five steps, sends the quotation to the client for online approval and turns the accepted quotation into a policy.

- Steps: policy and vehicle details, plan recommendations (CTPL, Basic, Comprehensive), coverage with Calculate, accessories and policy limits, order summary with discount, referrer and signatory.
- Own damage, acts of nature, roadside assistance, personal accident, excess bodily injury and property damage, Auto Passenger PA per seat, accessories.
- Co-insurance on the quotation, with shares totalling 100% and one lead.
- Brokerage rate from the Commission Rate Matrix, then the insurer default, then `commission.default_rate` (15%); comsub for the referrer chain; discount up to 30% taken from the broker's commission.
- Send for Customer Approval e-mails a signed link valid for 168 hours; the client approves without signing in. Share by download, e-mail, WhatsApp, Send to Insurer or copied link.
- Quotation validity 30 days (`limits.quote_validity_days`); the Quotation expiry job runs daily.
- Audit Trail tab with every field change.

![Quotation list](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quotations.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Vehicle class per Insurance Commission tariff; CTPL 1-year and 3-year amounts, inclusive of taxes and never discounted; VAT 12%, DST 12.5%, LGT 0.75% on the net premium |
| Personas | Sales & Marketing, Operations prepare; Processing Team is notified (`quotations.approval_notify_roles`) |
| Key reports | Production Register, New Business vs Renewals, Lead Conversion Funnel |
| Controls | The server prices every quotation again from the configured rates; a premium changed in the browser is refused. A quotation cannot be approved by its creator (`workflow.quote_maker_checker`) |
| Integrations | E-mail (approval link, share); public approval page |

## Request for Quotation and placement

**What it does.** Presents a risk to several insurers, records their offers and declines, compares them, and binds the cover with a firm order to the lead insurer and co-insurers.

- Request for Quotation (broker slip): customer and risk, risk details as items and values, requested covers with sums insured and deductibles, insurers approached, response due date, remarks. Submitting creates one offer record per insurer and e-mails each insurer's placement address.
- Offers recorded as Offered, Declined or Pending, with net premium, rate, line offered, taxes, validity, deductibles, special terms and the insurer's reference and offer letter.
- Compare offers ranks by gross premium, marks the best offer, shows the market capacity, and lets the user select offers, the lead insurer and the shares.
- Placement Slip from a broker slip, from an accepted quotation, as a direct placement, or with Record Issued Policy for a policy the insurer already issued.
- Send to insurer(s) e-mails each participant a slip showing its own share; Confirm records the insurer's policy or certificate number; a decline prompts a change of participants.
- Slip PDFs for the whole market or for one insurer.

![Request for Quotation: Compare offers](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-rfq-compare.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Co-insurance common in the Philippine market; taxes split per participant |
| Personas | Processing Team; Sales & Marketing and Operations follow their accounts |
| Key reports | Placement Pipeline, Market Response (hit ratio per insurer), Co-insurance Register |
| Controls | Shares must total exactly 100% with one lead; a line that requires a Placement Slip cannot be issued until every participant has confirmed |
| Integrations | E-mail to insurers (broker slip, placement slip); PDF, no insurer API |

## Policy issuance and servicing

**What it does.** Issues the policy with its participants, creates the client, bills the premium or books the direct-bill commission, and holds the policy record for servicing.

- Issue from a bound Placement Slip, convert an accepted motor quotation, or Record Issued Policy.
- Motor issue captures government ID type, number and image, chassis, motor and plate or MV file number, mortgagee, CTPL certificate number and authentication code, and five vehicle photos.
- Billing mode per policy: broker billed or direct bill; default from the insurer, else `direct_bill.default_billing_mode`.
- Policy details with coverage, premium breakdown, participants, endorsements, payment status, documents, policy invoice and Premium Accounting Entries.
- Policy statuses Active, Expired, Renewed, Lapsed, Cancelled; payment statuses Pending, Reviewing, Partial, Completed, Refunded.
- Bulk upload for new business, or for the in-force book at go-live without bills or journals.
- Policy issued e-mail to the client with the policy schedule attached.

![Policy details](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-policy-detail.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | KYC IDs accepted: PhilSys ID, UMID, passport, driver's licence, PRC, SSS, GSIS, TIN, postal, voter's and senior citizen ID (`policy.kyc_id_types`); LTO MV file number |
| Personas | Processing Team issues; Operations and Sales & Marketing service |
| Key reports | Production Register, Co-insurance Register, Premium by Product / Month / Insurer |
| Controls | Motor issue refused without the fields in `policy.kyc_required_fields`; client credit limit checked at issue with an exception notice |
| Integrations | Bulk upload template; insurer policy document upload (PDF or image, 10 MB) |

## Endorsements and cancellations

**What it does.** Records changes to an issued policy, sends them to the insurer, and bills additional premium or credits return premium.

- Motor: Personal Details Change, Motor Details Change, Coverage Change, Policy Extend, Policy Cancel.
- Fire and Allied Perils: Regular / Premium Change; Policy Cancellation full, partial, pro-rata or pro-rata partial.
- Coverage changes priced again with the configured rates; CTPL stays as issued.
- Completion with the insurer's endorsement document; the change is applied to the policy and the client.
- Return premium on premium already remitted is booked as a refund due from each insurer and netted on its next remittance; commission clawed back on the returned part.

| Aspect | Detail |
|---|---|
| Philippine specifics | Taxes follow the premium: return premium gives negative VAT, DST and LGT |
| Personas | Operations raises; Processing Team completes |
| Key reports | Production Register; client view Endorsement tab |
| Controls | Endorsement not offered for expired, lapsed, cancelled or renewed policies, or while payment is pending; numbered END- |
| Integrations | E-mail to the client on completion or cancellation |

## Claims

**What it does.** Registers a loss under a policy, notifies the insurer, follows the adjuster and settles the claim with a second approver.

- Registration with incident, driver and third-party details and documents; the Preliminary Loss Advice is e-mailed to the insurer's claims address.
- Adjuster details and the insurer's claim number; statuses Pending, Processing, Pending Approval, Approved, Settled, Closed, Rejected.
- Settlement by cash, card or cheque with documents; approval by a second Claims user; claim settled on approval (`claims.auto_settle_on_approval`).
- Co-insured policies show each insurer's share of the claim and the settlement.
- Claims paid through the broker: funds received from each insurer and payment to the claimant, each posted with its journal.
- Claim letters on the letterhead: Acknowledgment letter, Claims Discharge Voucher, Claims Data sheet and FIR.
- Claim Audit Trail and field change history.

![Claims Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claims-dashboard.png)

| Aspect | Detail |
|---|---|
| Personas | Claims; Accounting records the cash of claims paid through the broker |
| Key reports | Claims Position, Claims Ageing; Claims Dashboard export |
| Controls | Claim refused outside the policy period, for a future loss date, and while premium is unpaid (`claims.block_unpaid_premium`); settlement maker-checker (`claims.settlement_maker_checker`); handling time 20 days (`claims.sla_days`) |
| Integrations | E-mail to insurer; reinsurance recovery (see Reinsurance) |

## Renewals

**What it does.** Puts every policy into a renewal pipeline before expiry, sends notices, supports negotiation and turns the accepted renewal quotation into the next term.

- Pipeline 90 days before expiry (`renewals.pipeline_days`); notices at 60, 30 and 15 days (`limits.renewal_notice_days`); lapse 30 days after expiry (`renewals.grace_period_days`).
- Renewal Policy, Renewal Batch (up to 500 policies), Renewal Queue, Retention Analytics, At-Risk Policies, Negotiations, Lapse Management with win-back campaigns, Performance.
- At-risk score from claims in the term, unpaid premium, expiry within 30 days, premium increase, no contact and first renewal (`renewals.risk_weights`), with recommended actions.
- Renewal issues the new term, marks the old policy Renewed, bills the premium and accrues commission to the original referrer.

![Renewal Queue](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-renewal-queue.png)

| Aspect | Detail |
|---|---|
| Personas | Operations and Sales & Marketing work renewals; Processing Team approves renewal terms |
| Key reports | Renewal Retention (retained, lost, pending, retention rate); Retention Analytics; Performance |
| Controls | Renewal terms maker-checker (`renewals.maker_checker`); optional placement journey for renewals (`placement.journey_applies_to_renewals`) |
| Integrations | Renewal notices and reminders by e-mail through the renewal notice queue |

## Billing, payments and official receipts

**What it does.** Bills the premium, records how the client paid, and posts the official receipt.

- Premium bill (INV-) on policy issue, endorsement and renewal; policy invoice printable and e-mailed to the client with the PDF attached (E-mail invoice on the collection detail).
- Payment capture by Operations, Sales & Marketing or the Processing Team: pay later, bank transfer, cheque, online payment or cash, with reference and proof; Accounting is notified to verify.
- Official receipts from the Official Receipt series, posted only by Accounting, against open bills; partial payments; returned cheques cancel the receipt and reopen the bill.
- E-mail receipt on the receipt view sends the official receipt PDF to the client (`receipts.email_on_record` switches automatic sending on).
- Bulk Print on the letterhead; bulk upload of receipts (up to 1,000 rows).
- Payment links (PL-) for a quotation, a package quotation or a policy's open premium.

![Accounts > Receipts](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-receipts.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | OR numbering can continue the old system's numbering to match the BIR registration; letterhead with TIN |
| Personas | Accounting posts; Operations, Sales & Marketing and Processing Team capture payments |
| Key reports | Receipts Register, SOA / Premium Receivable, Collection Report |
| Controls | Receipt amount cannot exceed the bill balance; receipts cancelled with a reason, never deleted |
| Integrations | PayMongo (Checkout Session), Dragonpay (Payment Switch), sandbox provider; signed and idempotent webhooks; e-mail with PDF attachment |

## Collections and credit control

**What it does.** Follows up unpaid premium by age and manages credit risk on broker-billed business.

- Collections list with ageing buckets (current, 1-30, 31-60, 61-90, over 90 days), due date from the insurer's Premium Payment Warranty days, else `collections.default_credit_days` (30).
- Collection reminders e-mailed 7 days before the due date and every 7 days after (daily job); Send Payment Reminders Now.
- Collection items with assignments, commitments, escalation and a log of calls, e-mails and visits.
- Credit Control: Instalment Plans (split a bill into instalments without changing the ledger), Premium Warranty Monitor (reminders, extension requests approved by the Accounting Manager, cancellation requests that create a draft cancellation endorsement), Client Credit Limits, Remittance Ageing.
- Import open items at go-live from the old system's ageing.

![Premium Warranty Monitor](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-cc-warranty.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Premium payment warranty per insurer, reflecting the broker's credit terms with each insurer |
| Personas | Accounting, Accounting Manager |
| Key reports | Receivables Ageing, SOA / Premium Receivable, Collection Report, Remittance Ageing |
| Controls | Warranty extensions need approve:credit-control; nothing is cancelled automatically; credit limit exceptions reported to collections users |
| Integrations | E-mail reminders |

## Disbursement and petty cash

**What it does.** Pays insurers, referrers, clients and suppliers by payment voucher and cheque, and runs petty cash funds.

- Payment vouchers (PV-) by payee type (Customer, Insurer, Agent/Referrer, Supplier) against selected payables; bank account and cheque book; statuses Draft, For approval, Approved, Paid, Cancelled.
- Bulk Disburse for referrer payouts; bulk upload and bulk print on the letterhead.
- Petty cash: Initiate a fund, Request, Disbursement, Receipts, Replenish; custodian notified when a fund drops below its minimum.

| Aspect | Detail |
|---|---|
| Philippine specifics | Withholding tax posted on payments to agents, referrers and suppliers, feeding BIR Form 2307 and the QAP |
| Personas | Accounting, Accounting Manager |
| Key reports | Payables / Disbursement Register |
| Controls | Voucher and cheque approval by a different user (`finance.maker_checker_enabled`); petty cash requests maker-checker; approval limits by Authority Matrix |
| Integrations | Cheque printing; no bank payment file |

## Remittance to insurers and direct bill

**What it does.** Remits collected premium, net of commission, to each insurer by its share; for direct-bill policies, bills the broker's commission to the insurer.

- Automated Processing creates draft remittances per insurer from collected, unremitted premium; due date from the insurer's Remittance Terms, else `remittance.default_due_days` (30).
- Approval Workflow with levels by amount (level 1 up to PHP 100,000, level 2 up to PHP 1,000,000, level 3 above).
- Settlement: premium less commission less tax plus or minus adjustments gives the net settlement; the insurer payment voucher is raised in Disbursement.
- Tracking, Statements, Reconciliation of bank transactions (tolerance PHP 0.50), Bulk Processing, Scheduling, Electronic Transfer records (InstaPay, PESONet, RTGS, wire), Exception Management, Adjustments, Notifications, History, Analytics.
- Direct Bill Processing: commission debit notes (DN-) with 12% output VAT, 10% EWT and net cash expected; due 30 days later; collection with tax withheld; change of billing mode with a reason.
- Commission debit note e-mailed to the insurer with the PDF attached.

![Automated processing of remittances](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-rem-automated.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Premium held for insurers kept apart from commission income; VAT and EWT on direct-bill commission; Form 2307 received from insurers |
| Personas | Accounting, Accounting Manager |
| Key reports | Remittance Summary, Due to Insurers by Co-insurer, Aged Payables to Insurers, Commission Receivable - Direct Bill |
| Controls | Initiator cannot approve; approval levels by amount; debit notes maker-checker; billing mode change refused once premium was collected or remitted |
| Integrations | Remittance statements and debit notes as PDF, CSV or XLSX; e-mail; transfers executed in the bank's own portal |

## Commission and referrers

**What it does.** Calculates the brokerage earned from insurers and the share paid to agents and referrers, and pays it when the premium is collected.

- Commission Rate Matrix by insurer, product, line and policy type with effective dates; insurer default rate; `commission.default_rate` (15%).
- Commission line statuses Accrued, Eligible, Approved, Paid, Reversed; clawback on return premium.
- Agents/Referrer Accounts with type (Agent, Sub-agent, External), level, net payable, withholding tax type and bank account; Generate payout creates the payout voucher.
- Commission Dashboard with accounting and management views.

![Commission Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-commission-dashboard.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Withholding on comsub by payee type (`commission.wht_rate_by_type`: Agent 5%, Sub-agent 5%, External 10%); ATC per payee type |
| Personas | Accounting pays; Sales & Marketing views its commission |
| Key reports | Broker Commission Statement, Commission Dashboard |
| Controls | Payable only after full collection (`commission.require_full_payment`) and with a bank account on file; approval of lines and payout by a second user |
| Integrations | Payout through Disbursement |

## Incentives

**What it does.** Rewards account executives who reach targets.

- Incentive Programs (INC-) by target metric: premium volume, policy count, renewal rate or conversion; base target, frequency, dates.
- Calculations per period (CALC-), Approvals (including bulk approve), Statement per person and month.
- Approved amounts accrued and paid through posting rules.

| Aspect | Detail |
|---|---|
| Personas | System Administrator sets up programmes; Accounting calculates and pays; Sales & Marketing take part (`incentive.eligible_roles`) |
| Key reports | Incentive Results |
| Controls | Calculation batches approved by a second Accounting user; Accounting cannot change the programmes it pays |

## General ledger and journals

**What it does.** Keeps a double-entry general ledger fed by every operational event, with manual journals under approval.

- Posting rules turn each business event into journal lines through account roles mapped in Account Determination; Simulate before approval.
- Journal Voucher, Correction JV and Reversal JV with approval; Accounting Query; All Clients Accounting; Open Entry Matching and Un-Matching with write-off reasons and limits.
- Delivered Philippine broker chart of accounts, including Cash in Bank - Premium Trust Account (Clients' Money).
- Premium VAT, DST and LGT booked to their own accounts (`accounting.split_premium_taxes`).

| Aspect | Detail |
|---|---|
| Personas | Accounting, Accounting Manager; System Administrator maintains posting rules |
| Key reports | Journal Register, General Ledger Detail, Trial Balance |
| Controls | Unbalanced journals, inactive accounts and closed periods refused; each journal points to its source document; changes to posting rules and account determination proposed by one user and approved by another (Configuration Approvals) |
| Integrations | Chart of accounts and opening balance upload templates |

## Period end

**What it does.** Runs the fiscal calendar, the month-end and year-end close and the financial statements.

- Period Management: periods Open, Soft-closed, Closed, Locked; adjustment period 13; go-live opening balances import.
- Month-End Close run (MEC-): accruals, recurring journals, commission deferral, FX revaluation and the close checklist with automatic and manual, blocking and warning items.
- Recurring Journals (RJV-) and accruals with auto-reversal on day 1 of the next period.
- Year-End Close (YEC-): pre-checks, adjustment journals in period 13, closing to retained earnings, opening balances of the next year; reversible until the first period of the next year is closed.
- Financial Statements: Income Statement, Balance Sheet and Trial Balance for any dates.

![Month-End Close](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-pe-close.png)

| Aspect | Detail |
|---|---|
| Personas | Accounting prepares; Accounting Manager approves |
| Key reports | Income Statement, Balance Sheet, Trial Balance (Opening / Movement / Closing), Month-End Close Status |
| Controls | Close approval by a different user (`accounting.period_close_requires_approval`); postings in soft-closed periods only by the Accounting Manager; reopening needs remarks and is recorded |
| Integrations | Scheduled jobs for recurring journals, accrual reversal, period soft-close and close reminders (delivered switched off) |

## Bank reconciliation

**What it does.** Matches each bank statement with the cash account in the ledger, posts bank items not yet in the books and produces the monthly reconciliation statement.

- Statement import (CSV or XLSX) with formats BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE and GENERIC, or entry by hand; balanced statement check; duplicate files refused.
- Auto-match with six rules (adjustment journals, reversals, amount and reference, amount and date window, one-to-many, many-to-one) and manual matching with treatment of differences.
- Create adjustment from a bank line using bank transaction types (charges, interest, final tax, returned cheque, direct credits); stale cheques after 180 days.
- Reconciliation (BRC-) prepared, approved and locked; reopen with remarks.

![Bank Reconciliation workspace](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-br-workspace.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Layouts of BDO, BPI and Metrobank exports; returned cheques (DAIF, DAUD) cancel the receipt and reopen the bill |
| Personas | Accounting prepares; Accounting Manager approves |
| Key reports | Bank Reconciliation Statement, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines, Bank Book |
| Controls | Approver differs from preparer; month-end checklist looks for an approved reconciliation of each active account |
| Integrations | Bank statement files; no bank API |

## Insurer reconciliation

**What it does.** Imports insurers' statements of account and matches them with the broker's remittances, debit notes and policies.

- Statement types: premium remittance confirmations (broker-billed premium the insurer received) and commission statements (direct-bill commission the insurer recognises).
- Insurer Statement Formats map each insurer's CSV or XLSX columns.
- Matching per line, resolutions with adjustment journals, approval of the reconciliation.
- Differences report with the insurer's and the broker's premium, commission and amount side by side.

![Insurer Statements](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-ir-statements.png)

| Aspect | Detail |
|---|---|
| Personas | Accounting; Accounting Manager approves |
| Key reports | Insurer statement differences report |
| Controls | Approval of insurer reconciliations by the Accounting Manager; adjustment journals through posting rules |
| Integrations | Insurer statement files; no insurer API |

## BIR tax

**What it does.** Prepares the BIR forms and working papers from the ledger.

- BIR Form 2307: Issued by us (tax withheld on payments to agents, referrers and suppliers) and Received (tax withheld by insurers and clients); certificates per payee and quarter numbered from the CWT series, printed on the BIR layout; cancel with a reason.
- VAT Summary: vatable revenue, output VAT, input VAT and net VAT payable per month or quarter, the working paper for the VAT return.
- SAWT, QAP, SLSP Sales and SLSP Purchases in the BIR column order, as CSV, Excel or PDF.
- Tax codes (Master > Finance > Taxation): VAT output and input 12%, zero-rated, exempt, expanded withholding with ATC (for example WI139, WC139, WI515), final withholding, DST, LGT, premium taxes, each with rate, GL account and effective date.

![BIR Form 2307](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-2307.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | All of the above; BIR settings for the withholding agent's TIN, registered name and address |
| Personas | Accounting, Accounting Manager |
| Key reports | VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases, BIR Form 2307 register |
| Controls | Certificates kept and cancelled with a reason, not deleted |
| Integrations | Files for validation in the BIR tools; the system does not file returns |

## Reinsurance

**What it does.** Records the treaties that protect large risks, the cessions under them, recoveries on claims and the reconciliation of reinsurer statements.

- Treaty master: quota share, surplus, excess of loss, stop loss; reinsurers, shares and period.
- Treaty Dashboard, Cession Tracking with Process Cession and Generate Bordereau, Claims Recovery, Reconciliation (variances above 1% for review), Analytics.

| Aspect | Detail |
|---|---|
| Personas | Processing Team (treaties, cessions), Claims (recoveries), Accounting (reconciliation), System Administrator (master) |
| Key reports | Reinsurance Cession Register |
| Controls | New treaty approved by a second user (`reinsurance.treaty_requires_approval`); minimum reinsurer security rating A- |
| Integrations | Bordereaux and reconciliation files as CSV |

## Product Configurator

**What it does.** Holds the products the broker places and the rules that price them, including the motor tariff.

- Product Templates with versions and statuses (Draft, Active, Inactive, Retired); motor template MOT-003-2025 with the CTPL and Auto Passenger PA tariff per vehicle class.
- Coverage Builder, Rating Engine with Test Calculator, Acceptance Rules, Document Manager, Approval Workflows, Market Mapping, Risk Mapping, Product Analytics.

![Product Templates](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-pc-templates.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Delivered CTPL tariff per vehicle class, for example private cars PHP 610.40 (1 year) and PHP 1,660.40 (3 years), confirmed on 29 September 2026; Philippine lines of business and products |
| Personas | Processing Team maintains; Sales & Marketing and Operations view |
| Controls | Only active templates are used by the quotation screens |

## Reports

**What it does.** Produces every report from one report screen with criteria, filters, preview and download.

- 39 catalogue reports: operational (11), financial (16), tax (5), reconciliation (5), management (2).
- Output on screen, Excel with a parameters sheet, CSV, and PDF on the company letterhead; up to 50,000 rows per file.
- Scheduled delivery by e-mail; the Daily reports job produces the Production Register, Collection Report and Claims Position every morning.
- Every generated file recorded in the audit trail.

![Reports > All Reports](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-report-catalogue.png)

| Group | Reports |
|---|---|
| Operational | Production Register, Claims Position, Renewal Retention, Remittance Summary, Broker Commission Statement, Claims Ageing, Lead Conversion Funnel, Placement Pipeline, Market Response, Reinsurance Cession Register, Co-insurance Register |
| Financial | SOA / Premium Receivable, Collection Report, Receivables Ageing, Commission Receivable - Direct Bill, Receipts Register, Payables / Disbursement Register, Journal Register, Trial Balance, Incentive Results, Due to Insurers by Co-insurer, Income Statement, Balance Sheet, Trial Balance (Opening / Movement / Closing), General Ledger Detail, Aged Payables to Insurers, Month-End Close Status |
| Tax | VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases |
| Reconciliation | Bank Reconciliation Statement, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines, Bank Book |
| Management | Premium by Product / Month / Insurer, New Business vs Renewals |

| Aspect | Detail |
|---|---|
| Personas | Each role runs the reports of its area |
| Controls | `read:reports` and role checks per report; download links valid 72 hours; generated files kept 90 days |
| Integrations | Scheduled e-mail delivery |

## Notifications and e-mail

**What it does.** Tells users what needs their action and sends documents to clients, insurers and staff.

- In-app notifications per user with a bell and a notification page, for quotations, policy issue, billing and collection, servicing, claims, renewals, remittance and commission, reinsurance, finance and period end, and access control.
- Approval notifications for every maker-checker flow: the people who can approve are told of the request, and the maker hears of the approval or rejection with the reason. One switch: `notification.approval_requests`.
- E-mails to clients (quotation approval, share, policy issued, endorsement, renewal notices and reminders, payment reminder, collection follow-up, official receipt, premium invoice), to insurers and agents (quotation, broker slip, placement slip, Preliminary Loss Advice, commission debit note, remittance statements) and to staff (scheduled report, password reset code).
- Attachments generated as PDF when the message is sent: official receipt, premium invoice, commission debit note, policy schedule; size guard `email.max_attachment_mb`.
- E-mail Outbox shows every queued message with status, attempts and attachment names; failed messages can be retried.

![E-mail Outbox](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-outbox.png)

| Aspect | Detail |
|---|---|
| Personas | Every role receives notifications; System Administrator manages templates and the outbox |
| Controls | E-mail sending off until "Send e-mails" is switched on; templates with merge fields in Master > Configuration |
| Integrations | SMTP mailbox (for example Office 365 on port 587 with STARTTLS); queue sent every 5 minutes, up to 5 attempts |

## Data privacy

**What it does.** Supports the broker's obligations under the Data Privacy Act: consent, data subject requests, access and portability, and erasure once records no longer have to be kept.

- Consent per purpose for each client and prospect: processing (privacy notice acknowledged), marketing, and sharing with insurers and reinsurers for placement and claims; granted or refused, channel (Form, E-mail, Phone, Portal, In person), notice version (`privacy.notice_version`) and evidence. A withdrawal is stamped on the record it ends; the history is never deleted.
- Consent Register across clients and prospects with filters by purpose, status, channel and dates.
- Data Subject Requests register (DSR-): access, rectification, erasure or blocking, objection, portability and withdrawal of consent; due date from `privacy.request_due_days` (15 calendar days); statuses open, in progress, completed, rejected; assignee and outcome.
- Personal data export of a client or prospect, as JSON or Excel, noted on the request it answers.
- Anonymisation of a client or prospect with a dry run first: personal fields are overwritten in the party, its prospects, policies, quotations, claims and slips, while amounts, numbers and dates stay for the books.
- Overdue request reminder job (delivered switched off) notifies the data privacy team.

| Aspect | Detail |
|---|---|
| Philippine specifics | Data Privacy Act of 2012 and NPC rules; retention of insurance and tax records |
| Personas | System Administrator and Operations hold the privacy permissions (`read:privacy`, `write:privacy`); the broker's DPO works the registers |
| Controls | Anonymisation refused while policies are in force, bills or claims are open, commission is unpaid, endorsements are open, or within `privacy.retention_years` (10 years) after the last policy expiry; every action in the audit trail |
| Integrations | Excel export |

## Administration, security and configuration

**What it does.** Sets up the broker's organisation, reference data, users and rules, and keeps the record of who did what.

- Masters: Company (letterhead, TIN, IC licence number), Branch, Insurance Company (credit and remittance terms, billing mode, placement and claims e-mails), Line of Business, Product, Cover, Signatories, Vehicle, locations, Commission, employees, finance masters.
- Uploads for masters and go-live data from about 40 templates (10 MB per file, 20,000 rows).
- User Management: User, Role, User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews.
- Master > Configuration: business parameters by tab, applied at once and audited; Document Numbering with 52 series; Schedules with run now and history; System Settings for title, logo and theme.
- Audit Trail of every create, update, approval, report run and sign-in, with before and after values.

![Authority Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-authority.png)

| Aspect | Detail |
|---|---|
| Personas | System Administrator |
| Controls | Only a System Administrator grants that role; nobody changes their own role; new authority limits approved by another administrator; SoD rules checked at role assignment; dormant accounts deactivated after 90 days |
| Integrations | User provisioning from a template |

# OOTB scope and optional extras

## What the OOTB edition includes

The OOTB edition is the product as delivered, fitted to the broker by configuration and master data, not by code changes.

| Included in OOTB | Notes |
|---|---|
| All modules in chapter 5 | Delivered screens, workflows, reports and printed documents |
| Configuration and master data | Company, users, insurers, products and tariff, commission, taxes, chart of accounts, posting rules, number series, approvals, schedules, e-mail texts |
| Standard integrations | SMTP e-mail, bank statement files, insurer statement files, PayMongo and Dragonpay payment links |
| Go-live data | Masters, in-force policies and clients, open receivables, GL opening balances through the delivered templates |
| Implementation | Discovery, configuration, mock loads, SIT, UAT support, training per role, cutover, hypercare to the first month-end close |
| Documentation | User manual, role decks, reports book, architecture and security, compliance matrix, data migration, training and support documents |

## Optional extras and change requests

Customisation is outside the OOTB scope. A requirement that cannot be met by configuration, master data or a change in procedure is recorded as a gap and handled through a change request: the broker describes the need, iorta TechNXT estimates the effort, and the steering committee approves it before any work starts.

| Outside OOTB, available as a change request or optional service | Examples |
|---|---|
| Customisation | Changes to screens, workflows, printed documents or the database; new reports |
| New integrations | Insurer systems, core banking, bank payment files, SMS gateways, accounting packages, BIR eFPS or eBIRForms, LTO or IC systems, other payment gateways |
| Data services | Data cleansing and enrichment, extraction from the old system, migration of closed policies, history and documents, more than one fiscal year |
| Additional environments and hosting | Extra test or training environments; hosting by iorta TechNXT on AWS, Azure or a local partner |
| Additional training | Training beyond the agreed curriculum, users added after go-live |
| Additional lines of business after go-live | Products, rating, documents and test cases for a new line |
| Translation | Filipino screens (no translation file in this release) |

Prices of optional services and day rates for change requests are in the commercial proposal.

## What remains with the broker

- Registrations and filings: BIR returns and alphalists, registration of the computerized accounting system and of invoices and receipts, IC reports, NPC registration and breach notifications, AMLC reports.
- Confirmation of tax rates, ATC and GL accounts by the broker's tax adviser, and of the motor tariff with the insurers.
- Retention schedules, privacy notice and the privacy management programme; policies for credit control and the premium trust account.

# Non-functional capabilities

## Security

| Area | Capability |
|---|---|
| Authentication | Named users only; bcrypt passwords; minimum 8 characters with four character classes, history of 5, expiry 90 days; lockout after 5 failures; sign-in rate limits |
| Two-step verification | TOTP built in, compulsory per role (`security.require_2fa_roles`); secrets encrypted with AES-256-GCM |
| Sessions | Access token 30 minutes, refresh token rotated on use with reuse detection; idle sign-out after 30 minutes; sessions ended on password or role change |
| Authorisation | Seven roles, deny by default; permission checked by the server on every route; record scope for scoped roles |
| Controls | Maker-checker, Authority Matrix, Delegations, Segregation of Duties, Access Reviews |
| Application security | Parameterised SQL, request validation, security headers, upload type check by file content, signed document links valid 30 minutes, CSV formula-injection guard; mapped to the OWASP Top 10 (2021) |
| Production start-up checks | The API refuses to start with weak or missing secrets, `CORS_ORIGINS=*` or localhost addresses |

## Privacy

| Area | Capability |
|---|---|
| Consent and rights | Consent Register, Data Subject Requests, personal data export, anonymisation (chapter 5) |
| Minimisation | KYC fields required for motor only by default (`policy.kyc_required_fields`) |
| Retention | Housekeeping deletes operational logs after their retention days; business records and the audit trail are kept; anonymisation after `privacy.retention_years` |
| Payment cards | Card details are entered on the gateway's page only |

## Availability and recovery

| Area | Capability |
|---|---|
| Design | Stateless API; any instance serves any request; scheduled jobs run once across instances; graceful shutdown |
| Health checks | `/api/health` (database and pending migrations) and `/api/health/live` |
| Recommended topology | Two or more API instances across zones, managed PostgreSQL with standby, shared file store |
| Recommended recovery objectives | API or database instance failure: RPO 0, RTO under 15 minutes; logical corruption: RPO 15 minutes or less, RTO 4 hours or less; regional outage: 24 hours |
| Backups (recommended) | Automated database backups with point-in-time restore for 35 days, monthly copies to a second region, restore tests quarterly |

## Performance and capacity

| Area | Capability |
|---|---|
| Observed in the release test | 2,116 API calls with database writes in 24 seconds, about 11 ms per call, on a single server; every screen loaded within 2.6 seconds |
| Reference sizing | 200 named users, 80 concurrent and 50,000 policies a year on two API instances of 1 vCPU and 2 GB and a database of 2 vCPU and 8 GB |
| Limits | Reports up to 50,000 rows per file; imports up to 20,000 rows per file |
| Recommended | A load test with the broker's concurrent users and month-end volumes on the production-sized server before go-live |

## Audit and traceability

| Area | Capability |
|---|---|
| Audit trail | Every create, update, approval, report run and sign-in with before and after values, user, IP and time; kept by default |
| Document control | 52 number series; financial documents cancelled or reversed, never deleted |
| Period control | Open, soft-closed, closed and locked periods; reopening recorded with remarks |
| History | Claim field changes and status history, bank reconciliation history, remittance approvals, sign-in history |

## Usability and localisation

- Browser application, no installation on user devices; Nunito font bundled.
- English screens; Philippine formats for money, dates, mobile numbers, ZIP codes and IDs; business time zone Asia/Manila.
- Lists with search, filters and paging; add and edit forms as side panels; status tags by colour.

## Maintainability and interfaces

- React 18, Node.js 22, PostgreSQL 16; 13 direct runtime dependencies in the API, all under permissive licences.
- 854 API routes listed in OpenAPI, a Postman collection and an Excel touchpoint workbook from screen to route.
- Database migrations applied on start under a lock; migrations only add to the schema.
- Automated backend tests against a real PostgreSQL database on every pull request.

# Deployment and support

## Deployment options

| Option | Form | Data location |
|---|---|---|
| AWS | S3 and CloudFront, API containers behind a load balancer, RDS for PostgreSQL Multi-AZ, EFS file store | Singapore (ap-southeast-1) |
| Microsoft Azure | Storage static website with Front Door, Container Apps, PostgreSQL Flexible Server, Azure Files | Singapore (Southeast Asia) |
| Local partner | Virtual machines in a Philippine data centre, PostgreSQL primary and standby, NFS file store | Philippines |
| On-premise | Broker's servers with Docker or Node.js under PM2, nginx reverse proxy | Philippines, broker's site |

Hosting in Singapore is a cross-border transfer under the Data Privacy Act, which the broker documents and covers by contract. A broker that wants the system of record in the Philippines chooses a local partner or on-premise.

## Implementation

| Size | Typical profile | Duration to hypercare exit | Go-live |
|---|---|---|---|
| Small | One office, up to 25 users, up to 10 insurers, up to 5,000 in-force policies | 8 weeks | Start of week 7 |
| Medium | Up to 3 offices, 26 to 75 users, up to 25 insurers, up to 25,000 in-force policies | 12 weeks | Start of week 10 |
| Large | More than 3 offices, more than 75 users, more than 25,000 in-force policies | 16 to 20 weeks | Start of week 15 (20-week plan) |

Phases: mobilisation, discovery and fit-gap, environment set-up, configuration, data migration, integrations, training, system integration test, user acceptance test, cutover, go-live and hypercare until the first month-end close is done.

## Support

| Level | Who | Scope |
|---|---|---|
| L1 | Broker key users and System Administrator | How-to questions, users and passwords, settings and master data, logging tickets with evidence |
| L2 | iorta TechNXT application support | Triage, reproduction, analysis, configuration and data corrections under change control, workarounds |
| L3 | iorta TechNXT engineering | Code defects, performance, infrastructure, security incidents, root-cause analysis, releases |

| Severity | First response | Restore or workaround |
|---|---|---|
| P1 Critical | 30 minutes | 4 service hours |
| P2 High | 2 service hours | 2 business days |
| P3 Medium | 1 business day | 5 business days |
| P4 Low | 2 business days | Planned with the broker |

Standard support runs 8:00 to 18:00 Philippine time, Monday to Friday, except regular holidays; 24 x 7 cover for P1 is an option. These targets are the iorta TechNXT standard proposal and are fixed in the support agreement.

# Feature checklist for vendor comparison

The table lists capabilities a Philippine non-life broker typically compares. The BrokerVerse column states what the OOTB edition does: **Yes** (delivered), **Configurable** (delivered, set by configuration), **Partial** (part of the need is met, see the note) or **No** (not in OOTB, available as a change request). The last two columns are left for the broker's evaluation.

| # | Capability | BrokerVerse OOTB | Note | Vendor B | Vendor C |
|---|---|---|---|---|---|
| 1 | Prospects with bulk upload | Yes |  | | |
| 2 | Quick quote of packaged products from insurer rate tables | Yes |  | | |
| 3 | Side-by-side comparison of insurers for a client | Yes |  | | |
| 4 | Motor quotation with CTPL tariff per vehicle class | Yes |  | | |
| 5 | Server-side re-pricing of every quotation | Yes |  | | |
| 6 | Online client approval of quotations without sign-in | Yes |  | | |
| 7 | Broker slip to several insurers with offers and declines | Yes |  | | |
| 8 | Offer comparison with best offer and market capacity | Yes |  | | |
| 9 | Co-insurance with lead and shares totalling 100% | Yes |  | | |
| 10 | Placement slip with confirmation per insurer | Yes |  | | |
| 11 | Placement journey rules per line of business | Configurable |  | | |
| 12 | Record a policy issued by the insurer | Yes |  | | |
| 13 | KYC capture with government ID for motor | Configurable |  | | |
| 14 | Broker billed and direct bill per policy | Yes |  | | |
| 15 | Endorsements with re-pricing and return premium | Yes |  | | |
| 16 | Cancellation full, partial and pro-rata | Yes |  | | |
| 17 | Claims with insurer notice, adjuster and settlement approval | Yes |  | | |
| 18 | Claims paid through the broker with recoveries by share | Yes |  | | |
| 19 | Renewal pipeline with notices at 60, 30 and 15 days | Configurable |  | | |
| 20 | At-risk scoring and win-back campaigns | Yes |  | | |
| 21 | Premium invoices and official receipts on letterhead | Yes |  | | |
| 22 | Receipt and invoice e-mailed with PDF attachment | Yes |  | | |
| 23 | Online payment links with automatic receipt | Yes | PayMongo, Dragonpay | | |
| 24 | Collections ageing and automatic reminders | Yes |  | | |
| 25 | Instalment plans and premium warranty monitor | Yes |  | | |
| 26 | Client credit limits | Yes |  | | |
| 27 | Remittance to insurers net of commission, by co-insurer share | Yes |  | | |
| 28 | Remittance approval levels by amount | Configurable |  | | |
| 29 | Direct bill commission debit notes with VAT and EWT | Yes |  | | |
| 30 | Commission rate matrix by insurer, product and policy type | Yes |  | | |
| 31 | Referrer commission payable on full collection, less WHT | Configurable |  | | |
| 32 | Incentive programmes for account executives | Yes |  | | |
| 33 | Double-entry general ledger fed by posting rules | Yes |  | | |
| 34 | Journal, correction and reversal vouchers with approval | Yes |  | | |
| 35 | Month-end close with checklist and approval | Yes |  | | |
| 36 | Year-end close and financial statements | Yes |  | | |
| 37 | Bank statement import and automatic matching | Yes |  | | |
| 38 | Bank reconciliation statement with approval | Yes |  | | |
| 39 | Insurer statement reconciliation with differences report | Yes |  | | |
| 40 | Premium taxes DST, LGT, VAT and FST per line | Configurable |  | | |
| 41 | BIR Form 2307 issued and received | Yes |  | | |
| 42 | VAT Summary, SAWT, QAP, SLSP | Yes |  | | |
| 43 | Direct filing to BIR eFPS or eBIRForms | No |  | | |
| 44 | Reinsurance treaties, cessions, bordereaux and recoveries | Yes |  | | |
| 45 | Product configurator with tariff and rating rules | Yes |  | | |
| 46 | 39 reports in Excel, CSV and PDF with scheduled e-mail | Yes |  | | |
| 47 | Role dashboards | Yes |  | | |
| 48 | In-app notifications, including every approval request and decision | Yes |  | | |
| 49 | Seven roles with server-side permission checks | Yes |  | | |
| 50 | Two-step verification by role | Configurable |  | | |
| 51 | Authority matrix, delegations, segregation of duties, access reviews | Yes |  | | |
| 52 | Audit trail with before and after values | Yes |  | | |
| 53 | Consent register per purpose | Yes |  | | |
| 54 | Data subject request register with due dates | Yes |  | | |
| 55 | Personal data export and anonymisation with retention rules | Yes |  | | |
| 56 | Field-level encryption of personal identifiers | No | Storage encryption recommended | | |
| 57 | Insurer system integration by API | No | Files and e-mail | | |
| 58 | Bank payment file generation | No | Transfers recorded | | |
| 59 | SMS notifications | No | E-mail and in-app | | |
| 60 | IC-format regulatory reports | Partial | Figures from reports | | |
| 61 | AML transaction monitoring and sanctions screening | No | KYC data held | | |
| 62 | Filipino user interface | No | English | | |
| 63 | Hosting on AWS, Azure, a Philippine partner or on-premise | Yes | | | |
| 64 | Open API documentation | Yes | OpenAPI | | |

# Points to note in this release

These points come from the release test and the user manual. None of them stops the end-to-end cycle.

- The sign-in session is kept in the browser's local storage; a change to an httpOnly cookie is planned. Two-step enrolment shows a setup key and a link, not a QR code.
- Client personal data relies on encryption of the database storage and backups; only two-step secrets are encrypted inside the application.
- A front-end library (react-router) carries a moderate security advisory; the upgrade is planned for the next minor release.
- Several masters have no Upload button yet; their templates are loaded by the System Administrator.
- The Settlement cash panel of a claim paid through the broker is on the claim screens, so the System Administrator records the funds on Accounting's instruction until the Accounting menu is extended.
- The BIR reports give the figures in the BIR column order; the broker validates them with the BIR's tools before filing.
- No load test has been run yet; a load test on the production-sized environment is recommended before go-live.
