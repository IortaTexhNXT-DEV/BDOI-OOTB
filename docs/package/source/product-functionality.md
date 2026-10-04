---
title: Product Functionality
subtitle: iNXT BrokerVerse OOTB
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT
change: Version 1.1: compliance (IC, NPC, AML), BIR returns, operations and accounting, distribution, integrations, branding and e-signatures, go-live and environment tools, My Work, Philippine masters
reviewed:
approved:
acronyms: OOTB=Out of the box; AMLC=Anti-Money Laundering Council; PSGC=Philippine Standard Geographic Code; EDD=Enhanced due diligence; PEP=Politically exposed person; COC=Certificate of cover; EIS=Electronic Invoicing System; CAS=Computerized accounting system; PDC=Post-dated cheque; IC=Insurance Commission; BIR=Bureau of Internal Revenue; NPC=National Privacy Commission; DPA=Data Privacy Act of 2012 (RA 10173); CTPL=Compulsory Third Party Liability; APPA=Auto Passenger Personal Accident; LTO=Land Transportation Office; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; IAR=Industrial All Risks; KYC=Know your customer; RFQ=Request for quotation; OR=Official receipt; PV=Payment voucher; JV=Journal voucher; GL=General ledger; DSR=Data subject request; SoD=Segregation of duties; TOTP=Time-based one-time password; UAT=User acceptance test; SIT=System integration test; API=Application programming interface; RPO=Recovery point objective; RTO=Recovery time objective
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
- The figures in this document come from the product (code, configuration and screens) and from the release test of 03 and 04 October 2026. Modules added after that test cycle (the compliance registers, the BIR returns, the operations and accounting extensions, distribution, integrations, branding and the go-live tools) are covered by their own automated tests; the counts in The product at a glance are those of the release test.
- **(in development)** marks a capability being completed on its development branch in this release.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 03 October 2026 | Issue for the release test |
| 1.1 | 04 October 2026 | Added: Compliance Officer role; IC compliance (licence register and commission block, fit and proper, insurer authority, complaints, IC annual statement and production report); NPC breach register, masking by role and field encryption; My Work, the enterprise menu and the Help panel; Philippine reference masters (PSGC); Product Configurator rules in the business flow; audit trail screen; go-live data workbench, environment comparison, transaction reset, data masking and the release pipeline; branding and e-signatures; work in development. Updated the integrations, disbursement, data privacy, administration, feature checklist and points to note |

## The product at a glance

| Item | BrokerVerse OOTB |
|---|---|
| Scope | Full broking cycle and broker accounting: prospects to renewals, billing to month-end close, BIR working papers |
| Personas | 8 roles: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager, Compliance Officer (AML/CFT); IC compliance, complaints and privacy permissions given to the roles the broker chooses |
| Screens | 173 menu screens checked per role in the release test |
| Reports | 39 catalogue reports in Excel, CSV and PDF, plus dashboards and document outputs |
| APIs | 868 registered API routes, documented in OpenAPI, a Postman collection and an Excel touchpoint list |
| Scheduled jobs | 18 jobs in Asia/Manila time; the remittance schedules job and the overdue data subject request reminder are delivered switched off |
| Number series | 61 document number series, counters only move forward |
| Release test | 497 test cases (486 passed, 2 failed, 3 blocked, 6 not run, after the re-test of 03 October 2026); 717 automated business rule tests; a full UAT cycle of 371 business steps |
| Technology | React 18 web application, Node.js 22 API, PostgreSQL 16 database |
| User documentation | User manual of 186 pages for the seven roles, seven role decks |

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
- Client onboarding before the first policy (**Onboard client**): individual or juridical, government ID, TIN, PSGC address, signatories and beneficial owners (see AML/CFT compliance); otherwise the client code CL- is created at first policy issue; client view with Policy, Claim, Renewal, Endorsement and Data privacy tabs.
- Sales activity log on prospects (calls, meetings, follow-ups) (in development); follow-up tasks today through My Work.
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
| Philippine specifics | DST of PHP 0.50 per PHP 4.00 of premium, a fraction counting as a whole unit; LGT per city or municipality |
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
| Philippine specifics | Vehicle class per Insurance Commission tariff; CTPL 1-year and 3-year amounts, inclusive of taxes and never discounted; VAT 12%, DST PHP 0.50 per PHP 4.00 or fraction, LGT 0.75% on the net premium |
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
- Cover notes (CVN-) while the policy is pending: issued from an accepted quotation or a sent / bound placement slip for `cover_note.validity_days` (30), printed on the letterhead and e-mailed; superseded and linked when the policy is issued, expired after the cover period, reminder to the owner before expiry (Operations > Cover Notes).

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
- Cancellation return premium computed from the days left (Operations > Policy Cancellation and every cancellation endorsement): pro-rata when the insurer cancels, the short-period scale (Master > Insurance Management > Short-Period Rates) when the insured cancels, flat from inception; partial cancellation on the part cancelled; premium taxes from the charge engine (`endorsements.cancellation_returned_taxes`) and the commission reversed through posting rule policy.cancel.

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
- Claim document checklist by line of business and claim type (Master > Insurance Management > Claim Document Checklist), received / waived status, missing-document reminders to the claimant (manual and daily), submission to the insurer refused while a required document is missing (`claims.require_documents_before_submission`).
- Motor claim repairs: estimates of accredited repair shops, the adjuster's decision, supplementary estimates, letter of authority (LOA-) with the insured's participation (`motor_claims.participation`) and the vehicle release acknowledgement.
- Accounts > Claims Settlements: funds received from insurers and payment to the claimant from the Accounting menu, with the claim payment voucher (CPV-) and the release and quitclaim.

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
- Credit Control: Instalment Plans (split a bill into instalments, or issue a separate invoice per instalment with its own due date and booking journal), Premium Warranty Monitor (reminders, extension requests approved by the Accounting Manager, cancellation requests that create a draft cancellation endorsement), Client Credit Limits, Remittance Ageing.
- Import open items at go-live from the old system's ageing.
- Post-dated cheque register (Accounts > Post-Dated Cheques): cheques on hand with their vault location, deposit due list and daily reminder, deposit on the cheque date creating the official receipt, cleared, bounced (receipt cancelled, client e-mailed), replacement and return.

![Premium Warranty Monitor](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-cc-warranty.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Premium payment warranty per insurer, reflecting the broker's credit terms with each insurer |
| Personas | Accounting, Accounting Manager |
| Key reports | Receivables Ageing, SOA / Premium Receivable, Collection Report, Remittance Ageing |
| Controls | Warranty extensions need approve:credit-control; nothing is cancelled automatically; credit limit exceptions reported to collections users |
| Integrations | E-mail reminders |

## Accounts payable and fixed assets

**What it does.** Keeps the broker's own payables and assets: supplier invoices, supplier payments and the fixed asset register with its monthly depreciation.

- Suppliers (TIN, VAT registration, EWT tax code, terms, default expense account); supplier invoices (APV-) with input VAT and expanded withholding tax, approved by a second user (approve:payables) and posted (posting rule ap.invoice); supplier payments (SPV-, posting rule ap.payment); AP ageing; AP and payment vouchers.
- Fixed asset register (FA-): asset classes with useful life and accounts, assets from supplier invoice lines or registered by hand (with the go-live accumulated depreciation), straight-line schedule, monthly depreciation run per asset class (posting rule fa.depreciation), also a step of the month-end close.

| Aspect | Detail |
|---|---|
| Philippine specifics | Input VAT at the VAT12-IN code; EWT codes of the BIR (WC158, WC160, WC100 ...) withheld from suppliers |
| Personas | Accounting records and pays; Accounting Manager approves |
| Key reports | AP Ageing, Fixed Asset Register (Excel) |
| Controls | Maker-checker on supplier invoices (`payables.maker_checker`); one invoice number per supplier; an asset is depreciated once per period |
| Integrations | Upload templates and go-live sheets for suppliers and asset classes |

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
| Integrations | Cheque printing; bank payment files (bulk credit, InstaPay, PESONet) through Accounts > Bank Payment Files |

## Remittance to insurers and direct bill

**What it does.** Remits collected premium, net of commission, to each insurer by its share; for direct-bill policies, bills the broker's commission to the insurer.

- Automated Processing creates draft remittances per insurer from collected, unremitted premium; due date from the insurer's Remittance Terms, else `remittance.default_due_days` (30).
- Approval Workflow: each approver acts within the Remittance approval and Remittance settlement limits of the Authority Matrix (delivered: Accounting up to PHP 1,000,000, Accounting Manager without limit); cover during absence through Users and Access > Delegations.
- Settlement: premium less commission less tax plus or minus adjustments gives the net settlement; the insurer payment voucher is raised in Disbursement.
- Tracking, Statements, Reconciliation of bank transactions (tolerance PHP 0.50), Bulk Processing, Scheduling (due schedules run by the `remittance-schedules` job once switched on in Master > Schedules), Electronic Transfer records (InstaPay, PESONet, RTGS, wire), Exception Management, Adjustments, Notifications, History, Analytics.
- Direct Bill Processing: commission debit notes (DN-) with 12% output VAT, 10% EWT and net cash expected; due 30 days later; collection with tax withheld; change of billing mode with a reason.
- Commission debit note e-mailed to the insurer with the PDF attached.

![Automated processing of remittances](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-rem-automated.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Premium held for insurers kept apart from commission income; VAT and EWT on direct-bill commission; Form 2307 received from insurers |
| Personas | Accounting, Accounting Manager |
| Key reports | Remittance Summary, Due to Insurers by Co-insurer, Aged Payables to Insurers, Commission Receivable - Direct Bill |
| Controls | Initiator cannot approve; approval limits from the Authority Matrix; debit notes maker-checker; billing mode change refused once premium was collected or remitted |
| Integrations | Remittance statements and debit notes as PDF, CSV or XLSX; e-mail; transfers executed in the bank's own portal |

## Commission and referrers

**What it does.** Calculates the brokerage earned from insurers and the share paid to agents and referrers, and pays it when the premium is collected.

- Commission Rate Matrix by insurer, product, line and policy type with effective dates; insurer default rate; `commission.default_rate` (15%).
- Commission line statuses Accrued, Eligible, Approved, Paid, Reversed; clawback on return premium.
- Agents/Referrer Accounts with type (Agent, Sub-agent, External), level, net payable, withholding tax type and bank account; Generate payout creates the payout voucher.
- Commission Dashboard with accounting and management views.
- Overriding, profit and contingent commission from insurers (Commission > Insurer Overrides): agreements per insurer with basis production volume, loss ratio or growth, period, lines of business and tiers (slab or banded); computation per period from production and claims (or the insurer's claims figure); approval by a second user posts the receivable, commission income and output VAT; sales invoice to the insurer; settlement against the insurer's statement with cash, creditable withholding and any difference.

![Commission Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-commission-dashboard.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Withholding on comsub by payee type (`commission.wht_rate_by_type`: Agent 5%, Sub-agent 5%, External 10%); ATC per payee type |
| Personas | Accounting pays; Sales & Marketing views its commission |
| Key reports | Broker Commission Statement, Commission Dashboard |
| Controls | Payable only after full collection (`commission.require_full_payment`) and with a bank account on file; approval of lines and payout by a second user; no approval or payout to an agent or sub-agent without an IC licence in force (`compliance.referrer_licence_check`, block as delivered) |
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
- Withholding Returns: 0619-E per month and 1601-EQ per quarter per ATC on the BIR layout (PDF and Excel), reconciled with the QAP and the ledger withholding accounts, with filing records (date filed, reference, amount paid, penalties, amended returns); annual 1604-E with the alphalist of payees (schedules 3 and 4).
- Percentage Tax 2551Q working paper for a non-VAT broker or agent (rate `bir.percentage_tax_rate`, default 3%).
- BIR DAT Files for the QAP, SAWT, SLSP sales and purchases and the 1604-E alphalist (BIR Alphalist Data Entry module v7.x and RELIEF layouts, version shown on screen).
- Sales Invoices under the EOPT Act and RR 7-2024 for commission and fees, with every required field, sequential numbering within the registered serial range, cancellation with a reason and payment acknowledgements as supplementary documents.
- E-Invoicing (EIS): e-invoice payloads, signing placeholder, outbox with status and retry, test mode with a fake provider, live adapter configured by settings; switched off until the broker's BIR certification.
- CAS Books and Documents: loose-leaf books per month with running page numbers, system description and controls, backup procedure, audit trail extract.
- Tax codes (Master > Finance > Taxation): VAT output and input 12%, zero-rated, exempt, expanded withholding with ATC (for example WI139, WC139, WI515), final withholding, DST, LGT, premium taxes, each with rate, GL account and effective date.

![BIR Form 2307](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-2307.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | All of the above; BIR settings for the withholding agent's TIN, registered name and address |
| Personas | Accounting, Accounting Manager |
| Key reports | VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases, BIR Form 2307 register, 0619-E, 1601-EQ, 1604-E, 2551Q, DAT files, sales book and the other loose-leaf books |
| Controls | Certificates kept and cancelled with a reason, not deleted |
| Integrations | DAT files for validation in the BIR tools; EIS connector (switched off until certification); the system does not file returns |

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

## Distribution channels and lead assignment

**What it does.** Records the dealers, financing banks and affinity partners that bring business, and gives every new prospect an account executive.

- Distribution Channels master: dealer groups and branches, financing banks and bank branches, affinity partners; hierarchy, referrer and comsub, mortgagee clause and letter addressee per bank. The channel is carried from the prospect to the quotation and the policy.
- Lead Assignment: rules by branch, line, source, category, channel and territory (Province, City / Municipality) with round robin, fewest open prospects or a fixed account executive; reassignment queue, single and bulk reassignment with history, team view by reporting line.
- Dealer Production report by dealer group and channel: prospects, quotations, policies, sum insured, premium and commission.

| Aspect | Detail |
|---|---|
| Personas | Sales & Marketing (team view, prospects), sales managers and the lead assignment team (rules, queue), Processing and Operations (channels) |
| Controls | Permissions read / write:lead-assignment and read / write:channels; every assignment written to the prospect's history and the audit trail |
| Settings | `leads.assignment_enabled`, `leads.assignment_fallback`, `leads.assignment_sla_hours`, `leads.assignment_notify`, `channels.inherit_from_lead`, `channels.default_mortgagee_clause` |

## Motor programmes, fleets and marine open covers

**What it does.** Places motor and cargo business in bulk: brand-new vehicles sold by dealers, company fleets on one policy, and cargo shipments under an open cover.

- Dealer Programmes: terms per dealer and financing bank (insurer, rates, CTPL term, free or subsidised first year and who pays); the Dealer Sales upload creates the prospect, quotation and, if chosen, the policy with the bank as mortgagee; each payer billed its share; bank endorsement letter printed or e-mailed per sale or per batch.
- Fleet Schedules: one motor policy with a premium and CTPL per vehicle, upload of the vehicles, schedule PDF and Excel; vehicles added or deleted by endorsement at the pro-rata premium.
- Marine Open Covers: rate and limit per conveyance, mark-up and minimum premium; certificates printed per shipment; monthly or quarterly declarations billed on the open policy with the premium taxes, then collected and remitted as any bill.

| Aspect | Detail |
|---|---|
| Philippine specifics | CTPL from the tariff of the vehicle class (3-year CTPL for new cars); premium taxes of the motor and marine lines from the tax engine |
| Personas | Sales & Marketing and Processing (programmes), Operations and Processing (fleets, open covers) |
| Ledger | Every bill raised (programme payers, fleet issue and endorsements, declarations) books the premium receivable, the amount due to the insurer and the commission through the posting rules |
| Uploads | Dealer Sales and Fleet Vehicles templates (Excel), validated row by row with the reason of each rejection |

## Facultative reinsurance placement

**What it does.** Supports the broker acting as reinsurance broker for an insurer that cedes part of a risk to the facultative market.

- Slip with the risk, the 100% terms, share offered, reinsurance commission and brokerage; reinsurers approached (security rating gate) and their lines; placed when the lines reach 100%.
- Binding posts the premium due from the cedant, the net premium due to each reinsurer and the brokerage income (posting rule ri.facultative.bind); premium received and paid recorded with their journals.
- Slip, cover note, debit note and credit notes as PDF; bordereau per period, kept as a document.

## Client comparison report and marketing campaigns

**What it does.** Gives the client a branded comparison of the insurers' offers with the broker's recommendation, and e-mails offers to consenting clients and prospects.

- Comparison Reports from a request for quotation or from quotations: options ranked by premium, highlights, the recommended option and the reasons, disclaimer; printed on the letterhead, e-mailed as PDF, the client's choice recorded. Commission is never shown.
- Campaigns: segments (clients, prospects, line, territory, channel, renewals due), HTML templates with placeholders, send now or scheduled, only to people whose marketing consent is in force; opt-out link per e-mail recorded in the consent register; results by delivery, exclusion reason, opt-out and conversion.

## Report Builder and BI extract

**What it does.** Answers ad hoc questions without a new report being programmed.

- Curated datasets (Policies, Clients, Bills, Claims, Commissions) with columns, filters, grouping and sort; totals of the numeric columns; export to Excel.
- Saved reports, private or shared with roles; each user sees only the rows of their data scope.
- Scheduled BI extract: one CSV per dataset written daily to file storage for the BI tool or data warehouse.

## Product Configurator

**What it does.** Holds the products the broker places and the rules that price them, including the motor tariff.

- Product Templates with versions and statuses (Draft, Active, Inactive, Retired); motor template MOT-003-2025 with the CTPL and Auto Passenger PA tariff per vehicle class.
- Coverage Builder, Rating Engine with Test Calculator, Acceptance Rules, Document Manager, Market Mapping, Risk Mapping, Product Analytics.
- Rules applied in the business flow: the governing template of a quotation, broker slip, placement or policy (the template named on the record, else the motor pricing template `motor.pricing_template_code`, else the newest active template of the product or line) supplies its rating factors (multiplicative, discount or additive) and acceptance rules. A rule tests a risk field (vehicle age, use, class, sum insured, driver age, claims, fleet size, members, flood-prone location and others) and accepts, refers, declines or loads; a referred quotation waits for a user of the rule's authority role within the Underwriting referral limit of the Authority Matrix.
- Market Mapping restricts the insurers approached for a product when `product.market_panel_enforced` is on.
- Document templates per product (policy schedule, CTPL certificate, quotation slip, member enrolment) with a text layout of merge fields such as {{PolicyNumber}} and generated blocks such as {{#Premium}}, printed on the letterhead.
- Quote wizard covers and risk fields taken from the Product Configurator (in development).

![Product Templates](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-pc-templates.png)

| Aspect | Detail |
|---|---|
| Philippine specifics | Delivered CTPL tariff per vehicle class, for example private cars PHP 610.40 (1 year) and PHP 1,660.40 (3 years), confirmed on 29 September 2026; Philippine lines of business and products |
| Personas | Processing Team maintains; Sales & Marketing and Operations view |
| Controls | Only active templates are used by the quotation screens; referrals approved within the authority limit; unknown merge fields refused when a layout is saved |

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

## Integrations: SMS, CTPL authentication, insurers and bank files

**What it does.** Connects BrokerVerse to third parties through one integration framework, each connection with a test mode, a file or manual fallback that completes the process today, and a monitor with retry and resend.

- **SMS and Viber.** Renewal notices, payment reminders and claim updates by SMS from templates with placeholders, after a consent check against the client's recorded consents. Provider adapters for a generic HTTP SMS API with Semaphore-style and Globe Labs-style presets; Viber business messages optional behind the same interface.
- **CTPL authentication.** COC series per insurer and branch, the next COC number allocated at issue, the authentication request to the IC-accredited provider, the authentication code stored and printed on the policy schedule, the LTO feed when needed, the code keyed in by hand when the provider's portal was used, and the unauthenticated CTPL report.
- **Insurer systems.** A mapping per insurer (codes, request and answer fields, claim statuses) for the policy issuance request, policy and premium data and claim status; claim status by CSV file and premium data by the insurer statement import when an insurer has no API.
- **Bank payment files.** Insurer remittances and referrer payouts paid by bulk credit, InstaPay or PESONet files written from a layout per bank (fixed width or delimited); maker-checker approval of the batch; the bank's status file marks each payment paid (payment journal posted) or rejected. Starter layouts for BDO, BPI, Metrobank, Landbank and UnionBank, to be validated with each bank during onboarding.
- **Integrations monitor.** Connectors with mode, endpoint and credentials named by environment variable (never stored), the outbox with status, attempts, last error, retry with backoff, resend and cancel, and the inbox of pushed messages and imported files.

| Aspect | Detail |
|---|---|
| Personas | System Administrator (connectors, templates, insurer mappings); Processing and Operations (CTPL); Accounting (bank payment files and layouts) |
| Controls | Test mode until the provider is contracted; live refused while a credential variable or the endpoint is missing; signed inbound messages; maker-checker and Authority Matrix on bank batches; audit trail on every change and resend |
| Integrations | SMS gateway, Viber aggregator, CTPL authentication provider, LTO, insurer APIs, bank upload portals; certification of each interface is done with the partner during onboarding |

## Data privacy

**What it does.** Supports the broker's obligations under the Data Privacy Act: consent, data subject requests, access and portability, and erasure once records no longer have to be kept.

- Consent per purpose for each client and prospect: processing (privacy notice acknowledged), marketing, and sharing with insurers and reinsurers for placement and claims; granted or refused, channel (Form, E-mail, Phone, Portal, In person), notice version (`privacy.notice_version`) and evidence. A withdrawal is stamped on the record it ends; the history is never deleted.
- Consent Register across clients and prospects with filters by purpose, status, channel and dates.
- Data Subject Requests register (DSR-): access, rectification, erasure or blocking, objection, portability and withdrawal of consent; due date from `privacy.request_due_days` (15 calendar days); statuses open, in progress, completed, rejected; assignee and outcome.
- Personal data export of a client or prospect, as JSON or Excel, noted on the request it answers.
- Anonymisation of a client or prospect with a dry run first: personal fields are overwritten in the party, its prospects, policies, quotations, claims and slips, while amounts, numbers and dates stay for the books.
- Overdue request reminder job (delivered switched off) notifies the data privacy team.
- Breach Register (Compliance > Data Privacy (NPC)): incidents (PDB-), assessment against the NPC criteria, the 72-hour clock (`privacy.breach_notify_hours`) with hourly reminders, NPC and data subject notifications, closure and the annual security incident report.
- Masking of personal identifiers by role: users without **View full personal identifiers** (`view:pii`) see TIN, ID numbers, mobile, e-mail, bank account and birth date partially masked on screens and in every Excel, CSV and PDF listing; unmasking on request is audited (`privacy.masking_enabled`, `privacy.pii_reveal_mode`).
- Field encryption at rest of TIN, government ID numbers and bank account numbers with the environment key (`PII_ENCRYPTION_KEY`), exact-value search kept.
- Masking tool for production copies used outside production (`npm run mask:data`): consistent pseudonyms, verification, refusal on production, evidence for the DPO.

| Aspect | Detail |
|---|---|
| Philippine specifics | Data Privacy Act of 2012 and NPC rules; retention of insurance and tax records |
| Personas | System Administrator and Operations hold the privacy permissions (`read:privacy`, `write:privacy`); the broker's DPO works the registers |
| Controls | Anonymisation refused while policies are in force, bills or claims are open, commission is unpaid, endorsements are open, or within `privacy.retention_years` (10 years) after the last policy expiry; every action in the audit trail |
| Integrations | Excel export; masking tool for test and training copies |

## AML/CFT compliance

**What it does.** Supports the broker's programme as a covered person under the AMLA (RA 9160 as amended): customer due diligence before the first policy, risk-based rating with enhanced due diligence, sanctions, PEP and negative list screening, covered and suspicious transaction monitoring, AML cases and the CTR and STR files for the AMLC.

- Client onboarding before the first policy (Operations > Clients > Onboard client): individual or juridical, government ID, Philippine mobile number and TIN checked, PSGC address, authorised signatories with their board resolution or secretary's certificate, beneficial owners, KYC documents.
- Customer risk rating Low, Normal or High from configurable factors (client type, nationality, PEP, line, payment mode, premium size, geography) at onboarding, at every policy issue and at the KYC refresh; compliance officer override; KYC refresh schedule per rating with the due list.
- EDD reviews (EDD-) for High-risk clients, prepared and approved by a compliance officer other than the preparer; no policy to a High-risk client without one (setting).
- Versioned screening lists (UN consolidated list XML, AMLC designations, PEP and internal lists in CSV or XLSX), fuzzy name matching with a score threshold, screening at onboarding, policy issue and payouts, rescreen after every list update, hits queue with clear, escalate and confirm; commercial provider adapter with sandbox mode and request log.
- Transaction monitoring rules (covered cash above PHP 500,000 in one banking day, structuring, early cancellation, third-party payouts, overpayment refunds, payer differs) with alerts (AMA-), cases (AMC-) with due dates in working days, and CTR and STR files (AMR-, layout BV-AMLC-TXN 1.0).
- AML dashboard; Compliance Officer role and Compliance menu.

| Aspect | Detail |
|---|---|
| Philippine specifics | AMLA as amended, 2018 IRR, AMLC registration and reporting; thresholds and filing days are settings the compliance officer confirms |
| Personas | Compliance Officer (`read:aml`, `write:aml`, `approve:aml`); Operations prepares EDD reviews; client roles onboard clients (`write:clients`) |
| Controls | Policy issue and payouts stopped by an undecided or confirmed match; maker-checker on EDD approval; every decision with a reason in the audit trail; AML records kept `aml.record_retention_years` (5) years |
| Integrations | List files (XML, CSV, XLSX); commercial screening provider API by configuration; report files filed by the broker in the AMLC portal |

## Insurance Commission compliance and complaints

**What it does.** Keeps the registers and reports the broker owes the Insurance Commission and handles complaints under RA 11765.

- Licence Register: licences of the firm, officers, licensed individuals, agents, sub-agents and referrers with renewal status, documents, expiry calendar and reminders at 90, 60, 30, 15 and 7 days; commission held for an agent without a licence in force.
- Fit and Proper: declarations, documents, review outcome and next review of directors and officers.
- Insurer Authority: each insurer's IC certificate of authority and validity, checked when a request for quotation or firm order is sent and when a policy is issued (`compliance.insurer_authority_check` warn or block).
- Complaints: intake by channel and category, acknowledgement and resolution deadlines (2, 7 or 45 days), automatic escalation, acknowledgement and resolution letters, referral to the IC, ageing and the regulator report.
- IC Annual Statement: workbook of the annual statement from the ledger and production with checks, a configurable account mapping and the accountant confirmation sheet; IC Production Report by insurer and IC line.

| Aspect | Detail |
|---|---|
| Philippine specifics | Insurance Code, IC rules on licensing, fit and proper and complaints handling; RA 11765 |
| Personas | Users with `read:compliance` and `write:compliance` (System Administrator, Operations; Accounting reads); complaints handlers (`write:complaints`) and complaints officers (`approve:complaints`) |
| Controls | Daily `compliance-reminders` and `complaints-deadlines` jobs; every step in the audit trail |
| Integrations | Excel exports for the regulator |

## My Work, menu and help

**What it does.** Gives each user one worklist and a menu organised by task, with help on every screen.

- My Work (Operations > My Work): My Items by category (quotations, requests for quotation, placements, renewals, premiums due, collection follow-ups, endorsements, claims, approvals, missing documents, tasks), My Team by reporting line with reassignment, My Tasks with reminders, Calendar; overdue and due-today counts.
- Side menu in business order with Master in sections (Organization, Insurance, Location, Employees, Users and Access, Finance, System, Data Privacy, Go-Live and Data), menu search and skeleton loading of lists.
- Help panel (**F1**): the manual section of the screen, the user manual PDF, the support desk's contacts, raise a support ticket, About BrokerVerse.

## Philippine reference masters

**What it does.** Delivers the reference data a Philippine broker needs.

- Geography of the PSGC (2Q 2026): regions, provinces (the field is Province), cities and municipalities with their class and ZIP code, barangays on the address forms.
- Philippine banks, government ID types, salutations, national holidays (used for working-day deadlines) and the list of insurers licensed by the IC.

## Go-live data workbench and environments

**What it does.** Loads the broker's go-live data, proves that environments hold the same configuration, and keeps test and personal data where they belong.

- Go-Live Data Load: configuration workbook and migration workbook (clients, in-force policies, open receivables, open claims, GL opening balances); blank template or current data; upload and validate as a trial run; errors workbook; load in one transaction; reconciliation of the migration; history; go-live lock (`golive.locked`).
- Compare environments: a configuration export against this environment, or two exports against each other; result Mirrored or Differences found, field by field, with environment-specific fields listed apart; comparison workbook; `npm run compare:environments` for the release pipeline.
- Transaction reset (`npm run reset:transactions`): removes test transactions before go-live, keeps masters, settings and users, refused after the go-live lock.
- Data masking of production copies (`npm run mask:data`, with `--remark-copy` and `--register-production`).
- Release pipeline: one build promoted through Dev, SIT, UAT, Pre-Prod and Production with approvals, backup, forward-only migrations, smoke test and automatic rollback.
- Audit Trail screen (Master > System > Audit Trail): every audited action by record type, record ID, user and dates.

## Branding and e-signatures

**What it does.** Presents the broker's brand on screens, documents, reports and e-mails, and signs documents with captured signatures.

- Theme and Branding (Master > System Settings): theme presets or custom colours with a contrast check, sign-in picture, document and report colours and footer, branded e-mail layout, logo and favicon; changes apply without a rebuild.
- Brand packs export and import the whole branding between environments; a client brand pack (for example the Toyota Insurance Services pack) is applied only with the client's written permission.
- E-signatures of company signatories and of users (captured by the user), versioned, with consent recorded and revocation; mapped per document type (quotation slip, policy schedule, endorsement, official receipt, payment voucher, debit note, statement, journal voucher, claim letter); drafts print UNSIGNED DRAFT.

## Work in development

Being completed on its development branch in this release: the sales activity log on prospects, the quote wizard covers and risk fields from the Product Configurator, BIR Form 2307 for supplier payments, and the disposal of fixed assets.

## Administration, security and configuration

**What it does.** Sets up the broker's organisation, reference data, users and rules, and keeps the record of who did what.

- Masters: Company (letterhead, TIN, IC licence number), Branch, Insurance Company (credit and remittance terms, billing mode, placement and claims e-mails, IC certificate of authority), Line of Business, Product, Cover, Signatories, Vehicle, locations, designations and hierarchy, finance masters. Staff details (branch, designation, reporting to) are on the user record.
- Uploads for masters and go-live data from about 40 templates (10 MB per file, 20,000 rows).
- Users and Access: User, Role, User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews.
- Master > Configuration: business parameters by business area, applied at once and audited; Master > Document Numbering with 61 series; Master > Schedules with run now and history; Master > System Settings with Theme and Branding.
- Audit Trail of every create, update, approval, report run and sign-in, with before and after values.

![Authority Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-authority.png)

| Aspect | Detail |
|---|---|
| Personas | System Administrator |
| Controls | Only a System Administrator grants that role; nobody changes their own role; new authority limits approved by another administrator; SoD rules checked at role assignment; dormant accounts deactivated after 90 days |
| Integrations | User provisioning from a template or the configuration workbook |

# OOTB scope and optional extras

## What the OOTB edition includes

The OOTB edition is the product as delivered, fitted to the broker by configuration and master data, not by code changes.

| Included in OOTB | Notes |
|---|---|
| All modules in chapter 5 | Delivered screens, workflows, reports and printed documents |
| Configuration and master data | Company, users, insurers, products and tariff, commission, taxes, chart of accounts, posting rules, number series, approvals, schedules, e-mail texts |
| Standard integrations | SMTP e-mail, bank statement files, insurer statement files, PayMongo and Dragonpay payment links; adapters with test mode for SMS and Viber, CTPL authentication and the LTO feed, insurer APIs, bank payment files, the BIR EIS and a screening provider (certification with each partner during onboarding) |
| Go-live data | Masters, in-force policies and clients, open receivables, GL opening balances through the delivered templates |
| Implementation | Discovery, configuration, mock loads, SIT, UAT support, training per role, cutover, hypercare to the first month-end close |
| Documentation | User manual, role decks, reports book, architecture and security, compliance matrix, data migration, training and support documents |

## Optional extras and change requests

Customisation is outside the OOTB scope. A requirement that cannot be met by configuration, master data or a change in procedure is recorded as a gap and handled through a change request: the broker describes the need, iorta TechNXT estimates the effort, and the steering committee approves it before any work starts.

| Outside OOTB, available as a change request or optional service | Examples |
|---|---|
| Customisation | Changes to screens, workflows, printed documents or the database; new reports |
| New integrations | Core banking, accounting packages, BIR eFPS or eBIRForms, IC systems, other payment gateways; a provider whose protocol the delivered adapters (SMS, CTPL, insurer API, bank file) cannot be configured for |
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
| Authorisation | Eight roles, deny by default; permission checked by the server on every route; record scope for scoped roles; masking of personal identifiers without `view:pii` |
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
| Encryption | TIN, ID numbers and bank account numbers encrypted at rest (`PII_ENCRYPTION_KEY`); two-step secrets encrypted |
| Test data | Production copies masked before use outside production; verification and DPO evidence |
| Breaches | Breach register with the 72-hour NPC deadline |

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
| Document control | 61 number series; financial documents cancelled or reversed, never deleted |
| Period control | Open, soft-closed, closed and locked periods; reopening recorded with remarks |
| History | Claim field changes and status history, bank reconciliation history, remittance approvals, sign-in history |

## Usability and localisation

- Browser application, no installation on user devices; Nunito font bundled.
- English screens; Philippine formats for money, dates, mobile numbers, ZIP codes and IDs; business time zone Asia/Manila.
- Lists paged by the server (20, 50 or 100 rows per page) with search and filters, so long lists open quickly; add and edit forms as side panels; status tags by colour.

## Maintainability and interfaces

- React 18, Node.js 22, PostgreSQL 16; 13 direct runtime dependencies in the API, all under permissive licences.
- 868 API routes listed in OpenAPI, a Postman collection and an Excel touchpoint workbook from screen to route.
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
| Medium | Up to 3 offices, 26 to 100 users, up to 25 insurers, up to 25,000 in-force policies | 12 weeks | Start of week 10 |
| Large | More than 3 offices, more than 100 users, more than 25,000 in-force policies | 16 to 20 weeks | Start of week 15 (20-week plan) |

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
| 28 | Remittance approval limits per role or user in the Authority Matrix | Configurable |  | | |
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
| 56 | Field-level encryption of personal identifiers | Yes | TIN, ID and bank account numbers | | |
| 57 | Insurer system integration by API | Configurable | Mapping per insurer; test mode until the insurer certifies | | |
| 58 | Bank payment file generation | Configurable | Starter layouts validated with each bank | | |
| 59 | SMS notifications | Configurable | SMS gateway contract; optional Viber | | |
| 60 | IC-format regulatory reports | Yes | Annual statement workbook and production report; accountant confirms | | |
| 61 | AML transaction monitoring and sanctions screening | Yes | Lists loaded by the broker; provider optional | | |
| 62 | Filipino user interface | No | English | | |
| 63 | Hosting on AWS, Azure, a Philippine partner or on-premise | Yes | | | |
| 64 | Open API documentation | Yes | OpenAPI | | |
| 65 | Lead assignment rules by territory, line and source, with reassignment queue | Yes |  | | |
| 66 | Dealer, bank and affinity channels with production report | Yes |  | | |
| 67 | Brand-new vehicle programmes with dealer upload and bank endorsement letter | Yes |  | | |
| 68 | Fleet policy with per-vehicle premium and CTPL, pro-rata endorsements | Yes |  | | |
| 69 | Marine open cover with certificates and declarations | Yes |  | | |
| 70 | Facultative reinsurance placement with slip and bordereau | Yes |  | | |
| 71 | Client comparison and recommendation report | Yes |  | | |
| 72 | E-mail marketing campaigns to consenting clients with opt-out | Yes | Sent through the e-mail outbox | | |
| 73 | Ad hoc report builder with saved, shared reports and BI extract | Yes | CSV extract to file storage | | |
| 74 | Licence register with commission block for unlicensed agents | Yes |  | | |
| 75 | Complaints register with deadlines and regulator report (RA 11765) | Yes |  | | |
| 76 | Personal data breach register with the 72-hour clock | Yes |  | | |
| 77 | Masking of personal data on screens and exports by role | Yes |  | | |
| 78 | CTPL COC authentication and LTO feed | Configurable | Provider contract | | |
| 79 | Cover notes, computed cancellation (pro-rata, short-period) | Yes |  | | |
| 80 | Post-dated cheque register and instalment invoices | Yes |  | | |
| 81 | Claim document checklist and motor repair letters of authority | Yes |  | | |
| 82 | Accounts payable and fixed assets with depreciation | Yes | Disposal in development | | |
| 83 | BIR 0619-E, 1601-EQ, 1604-E, 2551Q, DAT files, EOPT invoices, CAS books | Yes | Filing by the broker | | |
| 84 | Go-live data workbench with reconciliation and environment comparison | Yes |  | | |
| 85 | Theme, branded documents and e-signatures | Yes |  | | |
| 86 | Philippine PSGC geography and reference masters | Yes |  | | |
| 87 | One worklist per user (My Work) | Yes |  | | |

# Points to note in this release

These points come from the release test and the user manual. None of them stops the end-to-end cycle.

- The sign-in session is kept in the browser's local storage; a change to an httpOnly cookie is planned.
- Field encryption covers TIN, ID numbers and bank account numbers; other personal data relies on encryption of the database storage and backups.
- The integration adapters (SMS, Viber, CTPL authentication, LTO, insurer API, bank files, EIS, screening provider) are delivered in test mode; each goes live after the partner's contract and certification.
- The work in development listed in chapter Functional modules completes on its own branch.
- A front-end library (react-router) carries a moderate security advisory; the upgrade is planned for the next minor release.
- Several masters have no Upload button yet; their templates are loaded by the System Administrator.
- The BIR reports give the figures in the BIR column order; the broker validates them with the BIR's tools before filing.
- No load test has been run yet; a load test on the production-sized environment is recommended before go-live.
