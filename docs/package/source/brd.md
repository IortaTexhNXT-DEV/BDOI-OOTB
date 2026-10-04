---
title: Business Requirements Document
subtitle: BrokerVerse OOTB for Philippine non-life brokers
version: 1.0
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Initial issue: requirements of the 15 process areas, non-functional requirements and the functional specification by module
acronyms: OOTB=Out of the box; BRD=Business requirements document; BR=Business requirement; NFR=Non-functional requirement; IC=Insurance Commission; BIR=Bureau of Internal Revenue; NPC=National Privacy Commission; AMLC=Anti-Money Laundering Council; AMLA=Anti-Money Laundering Act (RA 9160, as amended); DPA=Data Privacy Act of 2012 (RA 10173); EOPT=Ease of Paying Taxes Act (RA 11976); LTO=Land Transportation Office; PSGC=Philippine Standard Geographic Code; KYC=Know your customer; CDD=Customer due diligence; EDD=Enhanced due diligence; PEP=Politically exposed person; CTR=Covered transaction report; STR=Suspicious transaction report; RFQ=Request for quotation; CTPL=Compulsory third party liability; COC=Certificate of cover; LOA=Letter of authority; PDC=Post-dated cheque; OR=Official receipt; PV=Payment voucher; JV=Journal voucher; DN=Debit note; GL=General ledger; TB=Trial balance; VAT=Value-added tax; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; QAP=Quarterly Alphalist of Payees; SAWT=Summary Alphalist of Withholding Taxes; SLSP=Summary List of Sales and Purchases; CAS=Computerized accounting system; EIS=Electronic Invoicing System; SoD=Segregation of duties; DPO=Data protection officer; UAT=User acceptance test
---

# Introduction

## Purpose

This document states what a Philippine non-life insurance broker needs from its broking system, area by area, and for each requirement the screen or module of BrokerVerse OOTB that meets it and the test that shows it is met. It is the reference for the discovery and fit-gap workshops of an implementation, for the acceptance of the system in UAT, and for the change requests that follow.

The requirements are those of a typical broker (one to many branches, retail and corporate clients, motor and non-motor lines, broker billed and direct bill, co-insurance, agents and referrers). The broker confirms, deletes or adds requirements in discovery; each change is recorded in the Fit-Gap Register.

## Audience

| Reader | Use |
|---|---|
| Broker management and process owners | Confirm the requirements and their priority; sign the BRD at the end of discovery |
| Compliance officer, DPO, tax adviser | Confirm the regulatory requirements and the settings that carry them |
| iorta TechNXT business analysts and consultants | Run the workshops; class each requirement Fit, Configure, Procedure or Gap |
| Testers | Turn the acceptance criteria into UAT scripts |
| Developers and support | Read the chapter Functional specification by module |

## How to read the requirements

| Column | Meaning |
|---|---|
| ID | BR-xx-nnn: xx is the process area (01 to 15, the areas of the PH Fit and ASEAN Rollout Assessment), nnn a running number. NFR-xx-nn for non-functional requirements. IDs are never reused. |
| Requirement and acceptance | What the business needs, then **Accepted when:** the observable result that proves it in UAT. |
| Pri | **M** must have for go-live, **S** should have, **C** could have. The delivered priority is a proposal; the broker sets its own in discovery. |
| Source | **IC** (Insurance Code RA 10607 and IC rules), **BIR** (NIRC, EOPT Act and BIR regulations), **NPC** (DPA and NPC rules), **AMLC** (AMLA, its rules and the IC guidelines for covered persons), **LTO** (motor registration), **Bus.** (business need, no regulator). The source names the authority, not a legal citation; the broker's compliance officer and tax adviser confirm the rules in force. |
| Met by | The menu path, screen or module of BrokerVerse OOTB that meets the requirement. Settings are named by their key in Master > Configuration with the delivered value. |

## Related documents

| Document | Folder | Relationship |
|---|---|---|
| Process Flow Document | 05_Delivery | The flows F01 to F19 that run through these requirements, with swimlane diagrams |
| User Manual | 05_Delivery | The procedure, fields and messages of every screen named in "Met by" |
| Fit-Gap Register | 05_Delivery | Records the class (Fit, Configure, Procedure, Gap) of each requirement of the broker and the product gaps closed in this release |
| Philippine Regulatory Compliance Matrix | 05_Delivery | The regulation behind the requirements with source IC, BIR, NPC and AMLC |
| Product Functionality | 01_Sales | The product module by module |
| Implementation Statement of Work | 03_Contracts | What the implementation delivers; requirements outside OOTB follow the change request procedure |
| Test Cases workbook | 05_Delivery | The test cases of the release test |

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 04 October 2026 | Initial issue. Requirements of the 15 process areas, with the modules of the current release (AML/CFT, IC and NPC compliance, BIR returns, cover notes, computed cancellation, post-dated cheques, instalment invoices, claim documents, motor repairs, accounts payable, fixed assets, distribution channels, dealer programmes, fleets, marine open covers, facultative reinsurance, campaigns, Report Builder, integrations, branding and e-signatures, go-live data workbench, environment comparison and data masking). The chapter Functional specification by module. |

# Business context

## The Philippine non-life broker

An insurance broker licensed by the Insurance Commission acts for the client: it finds the cover the client needs, presents the risk to insurers authorised to do business in the Philippines, places it with one insurer or several in co-insurance, issues or records the policy, collects the premium (broker billed) or lets the client pay the insurer (direct bill), remits the premium net of its commission, services the policy, assists with claims and renews the business. An insurance agent working for one insurer, or a captive agency of a dealer group, runs the same cycle with fewer insurers.

The broker earns brokerage commission from the insurers, shares part of it with agents, sub-agents and referrers (comsub), and may earn overriding, profit or contingent commission. It keeps premium collected for insurers apart from its own funds.

## Regulators and obligations

| Authority | What it expects from the broker | Where the BRD covers it |
|---|---|---|
| Insurance Commission | Licence of the firm and of the persons who solicit; fit and proper directors and officers; placement with authorised insurers; premium held for insurers; records of business; annual statement and reports; complaints handling (RA 11765); CTPL tariff and COC authentication | Areas 05, 09, 10, 14 |
| Bureau of Internal Revenue | Books of accounts and CAS; invoices and receipts under the EOPT Act; VAT or percentage tax on commission; withholding on payments made (0619-E, 1601-EQ, 1604-E, BIR Form 2307); alphalists and DAT files; e-invoicing for those named | Areas 08, 12, 13 |
| National Privacy Commission | Lawful processing and consent; security measures; data subject rights; breach notification within 72 hours; retention and disposal | Areas 01, 14, 15 |
| Anti-Money Laundering Council | Customer due diligence and beneficial ownership; risk rating and EDD; sanctions and PEP screening; covered and suspicious transaction reports; record keeping | Area 01 |
| Land Transportation Office | CTPL cover authenticated for motor registration | Area 05 |

## Business objectives

| No. | Objective | How it is measured in BrokerVerse |
|---|---|---|
| O1 | One system for the whole broking cycle and the broker's own accounting | Every step of flows F01 to F10 done on BrokerVerse screens; no re-keying into a separate accounting package |
| O2 | Faster placement and issue | Processing Dashboard cycle time; quotation to policy conversion on the Sales Dashboard |
| O3 | Premium collected and remitted on time | Receivables Ageing, Remittance Ageing, Premium Warranty Monitor |
| O4 | Retention of the book | Renewal rate, premium retention and cycle time against `dashboard.targets` and the renewal targets (85%, 90%, 15 days) |
| O5 | Regulatory compliance evidenced from the system | Registers, returns and report files of areas 01, 13 and 14; audit trail |
| O6 | Controlled finance | Maker-checker on every payment, journal and approval; month-end close approved by the Accounting Manager |
| O7 | Fast, safe go-live | Configuration and migration loaded with the go-live data workbench and reconciled; configuration proved identical between environments |

## The broking cycle

![The broking cycle in BrokerVerse, with the persona responsible for each step](/home/user/BDOI-OOTB/docs/package/source/manual-images/process-flow.png)

# Stakeholders and personas

## Stakeholders

| Stakeholder | Interest | Role in the project |
|---|---|---|
| Broker owner, president or general manager | Growth, control, compliance, cost | Sponsor; chairs the steering committee; signs the BRD and the acceptance certificates |
| Head of operations or placement | Fast placement and servicing | Process owner of areas 02 to 07 |
| Head of claims | Claims service to clients | Process owner of area 11 |
| Finance head and Accounting Manager | Money trail, close, tax | Process owner of areas 08, 09, 10, 12, 13 |
| Compliance officer | IC rules, AMLA programme, complaints | Process owner of areas 01 (AML) and 14 |
| Data protection officer | DPA and NPC obligations | Process owner of the privacy requirements; approves masking refreshes |
| Tax adviser (external) | Correct tax treatment | Confirms tax codes, ATC, rates and invoice documents |
| IT head and System Administrator | Security, availability, users | Process owner of area 15; owns the configuration |
| Insurers, banks, dealers, reinsurers | Correct placements, remittances and documents | Counterparties of the flows; certify interfaces (bank files, insurer API, CTPL provider) |
| iorta TechNXT | Delivery and support | Project manager, consultants, migration lead, DevOps, support |

## Personas (roles in BrokerVerse)

| Persona | BrokerVerse role | Goals | Key screens |
|---|---|---|---|
| Account executive | Sales & Marketing (Account Executive) | Win and keep clients; quote quickly; see own production and commission | Prospects, Quick Quote, Quotations, Comparison Reports, Campaigns, My Work, Sales Dashboard, Commission Dashboard |
| Sales manager | Sales & Marketing with lead assignment permissions | Give every prospect an owner; watch the team | Lead Assignment (team view, rules, queue), Sales Dashboard, Dealer Production |
| Placement officer | Processing Team (Placement & Policy Processing) | Market risks; bind and issue correctly; approve referrals and renewal terms | Requests for Quotation, Placement Slips, Product Configurator, Reinsurance, Facultative Placements |
| Client service officer | Operations (Client Servicing) | Service clients: onboarding, endorsements, cancellations, renewals, payments, CTPL | Clients (Onboard client), Policy, Policy Cancellation, Cover Notes, CTPL Authentication, Renewals, Fleet Schedules, Marine Open Covers, My Work |
| Claims officer | Claims | Register and follow claims; approve colleagues' settlements | Claims, Claim Documents, Motor Claim Repairs, Claims Dashboard |
| Accountant | Accounting | Receipts, collections, remittance, commission, payables, reconciliations, close, BIR | Accounts menu, Commission, Tax |
| Accounting Manager | Accounting Manager | Approve the close and the reconciliations; control periods, credit and posting rules | Period End, Bank and Insurer Reconciliation, Credit Control, Configuration Approvals |
| Compliance officer (AML/CFT) | Compliance Officer (AML/CFT) | Run the AMLA programme: ratings, screening, EDD, alerts, cases, AMLC reports | Compliance > AML screens; Clients |
| IC compliance and complaints officer | Users with `read:compliance`, `write:compliance`, `approve:complaints` | Keep licences, fit and proper records and insurer authorities; resolve complaints on time; IC reports | Compliance > Insurance Commission |
| Data protection officer | Users with `read:privacy`, `write:privacy` | Consents, data subject requests, breaches | Master > Data Privacy; Compliance > Data Privacy (NPC) > Breach Register |
| System Administrator | System Administrator (Super Admin Access) | Users, access, configuration, masters, go-live data, integrations, branding | Master menu; Go-Live Data Load; Integrations |
| Client, claimant, complainant | No sign-in | Clear quotations and documents; quick claims and answers | Approval link, e-mails, SMS, printed documents |

The roles are deny by default: each menu item and each server action is granted by permission (Master > Users and Access > Role Permissions). Segregation of Duties rules stop conflicting roles being given to one person (SOD-CLM-ACCT, SOD-PROC-ACCT, SOD-PROC-MGR block; SOD-SALES-ACCT, SOD-SALES-CLM warn).

# Scope

## In scope

The OOTB edition, configured for the broker:

| No. | Process area | Main modules |
|---|---|---|
| 01 | Client onboarding, KYC and AML | Clients, Onboard client, Compliance (AML) |
| 02 | Prospecting and sales pipeline | Prospects, Lead Assignment, Distribution Channels, Campaigns, Sales Dashboard, My Work |
| 03 | Quotation and insurer comparison | Quick Quote, Compare Insurers, Quotations, Comparison Reports, Product Configurator |
| 04 | RFQ, placement, co-insurance and reinsurance | Requests for Quotation, Placement Slips, Cover Notes, Reinsurance, Facultative Placements |
| 05 | Policy issuance, documents and motor | Policy, CTPL Authentication, Dealer Programmes, Fleet Schedules, Marine Open Covers, documents and e-signatures |
| 06 | Endorsements and cancellations | Endorsements, Policy Cancellation, Short-Period Rates, Cancellation Reasons |
| 07 | Renewals and retention | Renewals menu |
| 08 | Billing, collection, credit control and receipts | Receipts, Collections, Credit Control, Post-Dated Cheques, Payment Gateways |
| 09 | Remittance, direct bill and insurer reconciliation | Remittance, Direct Bill Processing, Bank Payment Files, Insurer Reconciliation, Insurer Integration |
| 10 | Commission, referrers and incentives | Commission, Insurer Overrides, Incentive, Licence Register |
| 11 | Claims assistance | Claims, Claim Documents, Motor Claim Repairs, Claims Settlements |
| 12 | Accounting, general ledger, period end and audit | Journals, Disbursement, Petty Cash, Payables, Fixed Assets, Bank Reconciliation, Period End, Posting Rules |
| 13 | Taxes and BIR compliance | Tax menu, Taxation, Premium Taxes & LGU Rates |
| 14 | IC and Data Privacy compliance | Compliance > Insurance Commission, Data Privacy (NPC); Master > Data Privacy; masking and encryption |
| 15 | Reporting, administration, security and go-live | Reports, Report Builder, dashboards, Master, Users and Access, Audit Trail, Go-Live Data Load, Integrations, Theme and Branding |

## Out of scope

- Filing with government systems: BIR eFPS and eBIRForms, the AMLC portal, IC submissions and NPC notifications are done by the broker outside BrokerVerse; BrokerVerse prepares the returns, files and registers.
- Customisation of screens, workflows, printed layouts or the database; new reports beyond the Report Builder; translation of the screens into Filipino.
- Interfaces not covered by the delivered adapters (SMS, Viber, CTPL authentication and LTO feed, insurer API, bank payment files, EIS, screening provider, payment gateways), and the certification of each interface with its partner beyond onboarding support.
- Migration of closed policies, history and documents, and more than the opening balances of one fiscal year.
- A client or agent self-service portal (clients act through approval links, e-mails and printed documents).

Items outside the OOTB scope follow the change request procedure (Implementation Statement of Work).

## In progress in the current release

The following are part of the product and are being completed on their development branch; they are named in the requirements with the note **(in development)**: the sales activity log on prospects (calls, meetings and follow-ups), the quote wizard covers and risk fields driven by the Product Configurator, BIR Form 2307 for supplier payments, and the disposal of fixed assets.

# Business requirements

## 01 Client onboarding, KYC and AML

The broker identifies each client before or at its first policy, keeps one record per client across all its business, and runs its AMLA programme as a covered person: risk rating, enhanced due diligence, screening, transaction monitoring and reports to the AMLC. Flows F01 and F11.

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-01-001 | Record individual clients with Philippine address, mobile number and TIN.<br>**Accepted when:** a client is onboarded with PSGC region, province, city or municipality and barangay, a mobile number in 09XXXXXXXXX or +639XXXXXXXXX form and a TIN; a wrong format is refused with a message. | M | Bus. | Operations > Clients > **Onboard client** |
| BR-01-002 | Record juridical clients (company, cooperative, partnership, sole proprietorship) with registration, TIN and authorised signatories.<br>**Accepted when:** a juridical client is saved with SEC, DTI or CDA registration and each signatory with the board resolution or secretary's certificate (number, date). | M | AMLC | Onboard client, **Add signatory** |
| BR-01-003 | Capture the government ID presented, with type, number, expiry and image.<br>**Accepted when:** the ID type comes from the Government ID Type master; a motor policy is refused without the fields of `policy.kyc_required_fields`. | M | AMLC | Onboard client; Proceed to Policy (KYC) |
| BR-01-004 | Record the beneficial owners of juridical clients.<br>**Accepted when:** owners at or above `aml.beneficial_owner_threshold` (25%) or in control are recorded, or the senior managing official; the profile warns when no owner is declared or shares exceed 100%. | M | AMLC | Onboard client, **Add beneficial owner**; Compliance > Client Due Diligence |
| BR-01-005 | Rate every client Low, Normal or High from configurable risk factors.<br>**Accepted when:** the rating is computed at onboarding, at each policy issue, at the KYC refresh and on demand, from client type, nationality, PEP, line, payment mode, premium and geography; a PEP is always High; the history shows each rating and its trigger. | M | AMLC | Compliance > Client Due Diligence; AML Settings > Risk factors |
| BR-01-006 | Require enhanced due diligence for High-risk clients before a policy is issued.<br>**Accepted when:** a High-risk client gets an EDD review (EDD-); issue is refused until a compliance officer other than the submitter approves it (`aml.block_issue_pending_edd`). | M | AMLC | Compliance > EDD Reviews |
| BR-01-007 | Screen clients, owners and signatories against sanctions, PEP and negative lists.<br>**Accepted when:** screening runs at onboarding, at issue, at payouts and after each list version; matches from `aml.match_threshold` (0.85) enter the hits queue; issue and payouts are refused while a hit is open, escalated or confirmed. | M | AMLC | Compliance > Screening Hits, Screening Lists |
| BR-01-008 | Load and version the screening lists the broker is entitled to use.<br>**Accepted when:** a UN consolidated list (XML) or a CSV or XLSX list is uploaded as a version with checksum and entry count, and every client is rescreened. | M | AMLC | Compliance > Screening Lists |
| BR-01-009 | Monitor transactions for covered and suspicious patterns.<br>**Accepted when:** the daily job raises alerts (AMA-) for cash above `aml.covered_threshold` (PHP 500,000) in one banking day, structuring, early cancellation with return premium, third-party payouts, overpayment refunds and payer different from the client. | M | AMLC | Compliance > Transaction Alerts; AML Settings > Monitoring rules |
| BR-01-010 | Manage AML cases and produce the CTR and STR files.<br>**Accepted when:** a case (AMC-) holds the grounds, narrative and due date in working days; the report file (AMR-, BV-AMLC-TXN 1.0) is generated, downloaded and its filing recorded; covered transactions cannot be closed without a report. | M | AMLC | Compliance > AML Cases, AMLC Reports |
| BR-01-011 | Refresh KYC periodically by risk rating.<br>**Accepted when:** the refresh dates follow `aml.kyc_refresh_months` (Low 36, Normal 24, High 12); the weekly job lists the clients due; **Complete KYC refresh** rates the client again. | S | AMLC | Compliance > KYC Refresh |
| BR-01-012 | Keep KYC and transaction records for at least five years.<br>**Accepted when:** AML records are kept `aml.record_retention_years` (5) years after the last policy, transaction or case, and anonymisation is refused before then. | M | AMLC | AML Settings; Master > Data Privacy |
| BR-01-013 | One view of the client across policies, claims, renewals and endorsements.<br>**Accepted when:** the client view shows the tabs Policy, Claim, Renewal, Endorsement and Data privacy. | M | Bus. | Operations > Clients |
| BR-01-014 | Record consent per purpose with the privacy notice at onboarding.<br>**Accepted when:** consent for processing, marketing and sharing with insurers is recorded with channel, evidence and notice version; a withdrawal keeps the history. | M | NPC | Client and prospect **Data privacy**; Master > Data Privacy > Consent Register |

## 02 Prospecting and sales pipeline

Prospects come from account executives, uploads, dealers, banks, affinity partners and campaigns. Each gets an owner, is followed up and converted. Flows F01 and F16.

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-02-001 | Capture prospects by line (motor, fire, IAR, employee benefits, package), retail or corporate.<br>**Accepted when:** a prospect is saved with its number (LD-) and status New; a corporate prospect requires company name and TIN; age 18 to 100. | M | Bus. | Operations > Sales & Marketing > Prospects |
| BR-02-002 | Upload many prospects from a template.<br>**Accepted when:** a .xlsx or .csv file up to 10 MB loads the valid rows and reports the failed rows with the reason. | S | Bus. | Prospects > **Bulk Upload** |
| BR-02-003 | Follow the prospect pipeline and the conversion funnel.<br>**Accepted when:** statuses New, Contacted, Qualified, QuoteGenerated, Converted, Lost are shown and the Lead Conversion Funnel report counts them. | M | Bus. | Prospects; Reports > Lead Conversion Funnel |
| BR-02-004 | Give every new prospect an account executive by rule.<br>**Accepted when:** the first matching rule (line, channel, province, city, branch, source, category) assigns by round robin, fewest open prospects or a fixed person; unmatched prospects follow `leads.assignment_fallback`; the assignment history records each change. | S | Bus. | Operations > Sales & Marketing > Lead Assignment |
| BR-02-005 | Let a manager see the team's prospects and reassign them.<br>**Accepted when:** the team view lists the reporting line with open, converted and lost counts; **Reassign** and **Send to queue** work for one or many prospects with a reason; prospects untouched beyond `leads.assignment_sla_hours` go to the queue. | S | Bus. | Lead Assignment (Team View, Queue) |
| BR-02-006 | Record dealers, financing banks and affinity partners as channels with their referrer and comsub.<br>**Accepted when:** a channel (group, branch, bank, bank branch, affinity) is saved; the channel is carried from prospect to quotation to policy (`channels.inherit_from_lead`); Dealer Production reports per channel. | S | Bus. | Master > Insurance > Distribution Channels; Reports > Dealer Production |
| BR-02-007 | Send marketing campaigns only to people whose marketing consent is in force.<br>**Accepted when:** a segment preview shows who is reached and who is left out and why; every e-mail carries an opt-out link that records a refusal in the consent register. | S | NPC | Operations > Sales & Marketing > Campaigns |
| BR-02-008 | Track sales targets and the pipeline.<br>**Accepted when:** the Sales Dashboard shows prospects, quotations, conversion, policies issued, premium and open pipeline per person and period. | S | Bus. | Dashboard > Sales Dashboard |
| BR-02-009 | Give each user one worklist of what is waiting.<br>**Accepted when:** My Work lists the user's open items by category with overdue and due-today counts, tasks with reminders, the team view for managers and a calendar. | S | Bus. | Operations > My Work |
| BR-02-010 | Log sales activities (calls, meetings, follow-ups) on prospects.<br>**Accepted when:** an activity is recorded on the prospect with a follow-up date that appears in My Work. (in development) | C | Bus. | Prospects (in development); My Work tasks today |

## 03 Quotation and insurer comparison

Quotations are priced on the server from the configured rates, taxes and product rules, approved by the client and compared across insurers. Flows F01 and F02.

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-03-001 | Quote package products on the spot from insurer rate tables.<br>**Accepted when:** Quick Quote prices a package product; Compare Insurers lists each insurer's premium for a product, sum insured, location and date. | M | Bus. | Quick Quote; Compare Insurers; Master > Finance > Insurer Rate Tables |
| BR-03-002 | Price motor risks: own damage, acts of nature, excess BI and PD, personal accident, APPA per seat, accessories, CTPL.<br>**Accepted when:** the five-step wizard prices every cover; CTPL equals the IC tariff of the vehicle class, is not taxed again and never discounted. | M | IC | Create Quote (motor wizard); Product Configurator motor template |
| BR-03-003 | Compute premium taxes on the server.<br>**Accepted when:** VAT 12% (or premium tax by product regime), DST PHP 0.50 per PHP 4.00 or fraction, LGT at the city or municipality rate, FST on fire lines are applied; a premium changed in the browser is ignored. | M | BIR | Master > Finance > Premium Taxes & LGU Rates |
| BR-03-004 | Apply the insurer's underwriting guidelines to each quotation.<br>**Accepted when:** acceptance rules of the governing product template refer, decline or load the quotation; a referred quotation cannot be sent, approved, placed or issued until a user of the rule's authority role approves it within the Underwriting referral limit. | S | Bus. | Product Configurator > Acceptance Rules, Rating Engine; Authority Matrix |
| BR-03-005 | Limit discounts by role and take them from the broker's commission.<br>**Accepted when:** a discount above the role's limit in the Authority Matrix is refused. | M | Bus. | Master > Users and Access > Authority Matrix |
| BR-03-006 | Let the client approve the quotation online or record the answer received.<br>**Accepted when:** **Send for Customer Approval** e-mails a link valid 7 days; approval sets Customer Accepted; **Record customer response** records Accepted, Declined or Revise with channel, date and evidence. | M | Bus. | Quotations |
| BR-03-007 | Control quotation validity and approval.<br>**Accepted when:** a quotation expires after `limits.quote_validity_days` (30); the creator cannot approve it (`workflow.quote_maker_checker`); every change is in its Audit Trail tab. | M | Bus. | Quotations |
| BR-03-008 | Give the client a printed comparison of the insurers' offers with the broker's recommendation.<br>**Accepted when:** the report ranks the options by premium, names the recommended option and the reasons, never shows commission, prints on the letterhead and records the client's choice. | S | IC | Operations > Sales & Marketing > Comparison Reports |
| BR-03-009 | Keep products, covers, rating factors, rules, documents and markets in one configurator.<br>**Accepted when:** product templates have versions and statuses; only active templates price quotations; the governing template of a record is the one named, else the motor pricing template, else the newest active one of the product or line. | S | Bus. | Product Configurator |
| BR-03-010 | Drive the quote wizard covers and risk fields from the Product Configurator.<br>**Accepted when:** the covers and risk fields of the governing template appear in the quotation screens. (in development) | C | Bus. | Product Configurator (in development) |

## 04 RFQ, placement, co-insurance and reinsurance

Risks are presented to several insurers, offers compared, the security chosen and bound with every participant's confirmation. The broker can also act as reinsurance broker. Flows F02 and F19.

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-04-001 | Send a request for quotation to several insurers.<br>**Accepted when:** a broker slip (BS-) with risk details, covers and insurers is submitted; one offer record per insurer is created and each insurer is e-mailed. | M | Bus. | Operations > Sales & Marketing > Requests for Quotation |
| BR-04-002 | Record insurers' offers and declines with their terms.<br>**Accepted when:** net premium, rate, line offered, taxes, validity, deductibles, special terms and the insurer's letter are recorded; declines carry a reason. | M | Bus. | Requests for Quotation > Market responses |
| BR-04-003 | Compare offers and choose the security.<br>**Accepted when:** offers are ranked by gross premium with the best marked and the market capacity shown; the selected shares must total exactly 100% with one lead. | M | Bus. | Requests for Quotation > Compare offers |
| BR-04-004 | Place with the lead and co-insurers and record each confirmation.<br>**Accepted when:** each participant receives a slip of its own share; the slip is Bound only when every participant has confirmed with its policy or certificate number. | M | Bus. | Placement Slips |
| BR-04-005 | Split premium, taxes, commission and payables per co-insurer.<br>**Accepted when:** the bill journal, remittance, claims and the Co-insurance Register show each insurer's share; the rounding goes to the lead. | M | IC | Policy > Premium Accounting Entries; Co-insurance Register |
| BR-04-006 | Set the placement journey per line.<br>**Accepted when:** each step (RFQ, quotation slip, placement slip, record issued policy) is Required, Optional or Not used per line (`placement.journey`); a required step cannot be skipped. | S | Bus. | Master > Configuration (Sales, Quotations & Placement) |
| BR-04-007 | Issue cover notes while the policy is pending.<br>**Accepted when:** a cover note (CVN-) is issued from an accepted quotation or a sent or bound placement slip for `cover_note.validity_days` (30), printed and e-mailed, superseded when the policy is issued and expired after its period. | S | IC | Operations > Cover Notes |
| BR-04-008 | Place only with insurers authorised by the IC.<br>**Accepted when:** the insurer's certificate of authority and validity are checked when an RFQ is sent, a firm order is sent and a policy is issued (`compliance.insurer_authority_check` warn or block); the Insurer Authority report lists valid, expiring and expired certificates. | M | IC | Compliance > Insurance Commission > Insurer Authority; Master > Insurance > Insurance Company |
| BR-04-009 | Restrict the insurers approached to the product's market.<br>**Accepted when:** with `product.market_panel_enforced` on, an insurer outside the market mapping of the product is refused. | C | Bus. | Product Configurator > Market Mapping |
| BR-04-010 | Place facultative reinsurance for a cedant.<br>**Accepted when:** a slip with the 100% terms and share offered is sent to reinsurers meeting the security rating; it is Placed at 100% of the share; binding posts the amounts due from the cedant, to each reinsurer and the brokerage; cover note, debit note, credit notes and bordereau print. | C | Bus. | Reinsurance > Facultative Placements |
| BR-04-011 | Record treaties, cessions, recoveries and reinsurer statement reconciliations.<br>**Accepted when:** a treaty needs a second user's approval; cessions and bordereaux are produced; recoveries are registered; variances above 1% need review. | C | Bus. | Reinsurance menu; Master > Insurance > Reinsurance Treaty |

## 05 Policy issuance, documents and motor

Policies are issued from the placement or quotation, or recorded when the insurer issued them; motor policies carry the CTPL authentication; bulk business comes from dealer programmes, fleets and open covers. Flows F01, F02, F16 to F18.

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-05-001 | Issue the policy from a bound placement or an accepted quotation, creating the client and the bill.<br>**Accepted when:** issue gives POL-, creates CL- from the prospect, copies participants, raises the bill or books the direct-bill commission and posts the journal. | M | Bus. | Placement Slips > **Issue Policy**; Quotations > **Proceed to Policy** |
| BR-05-002 | Record a policy already issued by the insurer.<br>**Accepted when:** **Record Issued Policy** creates the policy, bill and commission in one step where the line's journey allows it. | M | Bus. | Placement Slips > **Record Issued Policy** |
| BR-05-003 | Choose broker billed or direct bill per policy.<br>**Accepted when:** the billing mode defaults from the insurer, else `direct_bill.default_billing_mode`, and can be changed before premium is collected. | M | Bus. | Proceed to Policy; Direct Bill Processing > Billing Mode |
| BR-05-004 | Capture motor identifiers and photos.<br>**Accepted when:** motor, chassis, plate or MV file number, mortgagee and five photos are captured; issue is refused without the KYC fields. | M | LTO | Proceed to Policy |
| BR-05-005 | Authenticate every CTPL certificate of cover with the IC-accredited provider.<br>**Accepted when:** at issue the next COC of the insurer's series is allocated, the request is sent, the authentication code is stored and printed on the schedule; unauthenticated covers are flagged after 24 hours; a code from the provider's portal can be keyed in; the LTO feed is sent when switched on. | M | IC | Operations > CTPL Authentication; Integrations (CTPL_AUTH, LTO_FEED) |
| BR-05-006 | Print the policy schedule and documents on the letterhead and e-mail them.<br>**Accepted when:** documents carry the letterhead of the company, the e-signatures mapped to the document type and, when a product document template exists, its layout with merge fields. | M | IC | Product Configurator > Document Manager; Master > System Settings > Theme and Branding |
| BR-05-007 | Upload the insurer's policy document.<br>**Accepted when:** a PDF or image up to 10 MB is attached to the policy and viewable from Policy Details. | M | Bus. | Policy Details > Documents & Billing |
| BR-05-008 | Run brand-new vehicle programmes with dealers and financing banks.<br>**Accepted when:** a dealer upload creates prospects, quotations or policies with the bank as mortgagee, bills each payer, and prints or e-mails the bank endorsement letters. | S | Bus. | Operations > Sales & Marketing > Dealer Programmes |
| BR-05-009 | Insure a fleet on one policy with a premium per vehicle.<br>**Accepted when:** each vehicle is priced with its CTPL; vehicles added or removed mid-term are endorsements at the pro-rata premium; the schedule prints. | S | Bus. | Operations > Fleet Schedules |
| BR-05-010 | Run marine open covers with certificates and declarations.<br>**Accepted when:** certificates are refused over the conveyance limit or outside the period; declarations are billed on the open policy. | C | Bus. | Operations > Marine Open Covers |
| BR-05-011 | Upload the in-force book at go-live without bills or journals.<br>**Accepted when:** migrated policies keep their old numbers and post nothing (F14). | M | Bus. | Master > Go-Live Data Load (migration workbook) |

## 06 Endorsements and cancellations

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-06-001 | Endorse motor policies: personal details, motor details, coverage change, extension, cancellation.<br>**Accepted when:** each type is raised from the policy, sent to the insurer and completed with its document; a personal details change updates the client. | M | Bus. | Operations > Policy > **More actions** > **Endorsement** |
| BR-06-002 | Endorse non-motor policies: premium change and cancellation.<br>**Accepted when:** a fire endorsement changes risk, cover or premium. | M | Bus. | Endorsement |
| BR-06-003 | Price a coverage change on the server with its taxes.<br>**Accepted when:** net premium, VAT, DST, LGT, gross and premium change are recomputed; CTPL stays as issued. | M | BIR | Endorsement Request |
| BR-06-004 | Compute the return premium of a cancellation from the days left.<br>**Accepted when:** pro-rata when the insurer cancels, short-period scale when the insured cancels, flat from inception; partial cancellation on the part cancelled; the server recomputes at completion (`endorsements.compute_cancellation_return`). | M | IC | Operations > Policy Cancellation; Master > Insurance > Short-Period Rates, Cancellation Reasons |
| BR-06-005 | Return the premium taxes and take back the commission on a cancellation.<br>**Accepted when:** the taxes in `endorsements.cancellation_returned_taxes` are returned (DST not by default) and the journal reverses the premium due, taxes and commission (policy.cancel). | M | BIR | Policy Cancellation |
| BR-06-006 | Handle return premium on premium already paid or remitted.<br>**Accepted when:** the bill is credited, the client's payment becomes a refund payable, the insurer's refund is netted on its next remittance and the comsub is clawed back. | M | Bus. | Endorsement completion; Remittance |
| BR-06-007 | Prevent endorsements on policies that cannot be changed.<br>**Accepted when:** **Endorsement** is greyed out while payment is Pending or Reviewing and not offered for expired, lapsed, cancelled or renewed policies. | M | Bus. | Operations > Policy |
| BR-06-008 | Start a cancellation for non-payment from the warranty monitor.<br>**Accepted when:** a cancellation request creates a draft cancellation endorsement; nothing is cancelled automatically. | S | IC | Accounts > Credit Control > Premium Warranty Monitor |

## 07 Renewals and retention

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-07-001 | Put every policy into a renewal pipeline before expiry and send notices.<br>**Accepted when:** policies enter the queue `renewals.pipeline_days` (90) before expiry; notices are e-mailed 60, 30 and 15 days before (`limits.renewal_notice_days`). | M | Bus. | Operations > Renewals; Renewal pipeline and notices jobs |
| BR-07-002 | Send renewal notices by SMS or Viber to clients who allow it.<br>**Accepted when:** with the job on and the connector live, SMS go out 30 and 7 days before expiry after the consent check; refused messages are logged Not sent. | S | NPC | Master > System Configuration > Message Templates, Integrations |
| BR-07-003 | Re-rate the renewal and negotiate it.<br>**Accepted when:** the renewal quotation applies the current base rates, a claims loading of 10% per claim up to 30% and a loyalty discount of 2% per renewal up to 10%; negotiations record contacts and next actions. | M | Bus. | Renewal Policy > **Renew**; Negotiations |
| BR-07-004 | Approve renewal terms by a second user.<br>**Accepted when:** terms requested for approval go to the Processing Team; the maker cannot approve. | M | Bus. | Negotiations > **Request approval**; `renewals.maker_checker` |
| BR-07-005 | Renew many policies in one batch.<br>**Accepted when:** a batch of up to 500 policies expiring within 30 days sends notices or quotes in the background. | S | Bus. | Renewals > Renewal Batch |
| BR-07-006 | Score retention risk and win back lapsed clients.<br>**Accepted when:** at-risk scores and levels are shown; lapsed and grace-period policies are listed; win-back campaigns are set up. | S | Bus. | At-Risk Policies; Lapse Management |
| BR-07-007 | Measure retention.<br>**Accepted when:** renewal rate, premium retention and cycle time are shown against the targets (85%, 90%, 15 days) by product and sales person. | S | Bus. | Retention Analytics; Performance; Renewal Retention report |
| BR-07-008 | Renew placed and co-insured risks through the placement journey.<br>**Accepted when:** with `placement.journey_applies_to_renewals` on, a renewal of such a line goes through its placement slip. | C | Bus. | Renewals; Placement Slips |

## 08 Billing, collection, credit control and receipts

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-08-001 | Bill premium on issue, endorsement and renewal and send the invoice.<br>**Accepted when:** a bill (INV-) is raised with its due date from the insurer's premium payment warranty (else 30 days) and e-mailed with the PDF when `billing.email_on_issue` is on. | M | Bus. | Policy; Accounts > Collections > **E-mail invoice** |
| BR-08-002 | Let non-accounting roles record how the client paid, for Accounting to verify.<br>**Accepted when:** **Record payment** sets the payment to Reviewing and notifies Accounting, which confirms or rejects it with a reason. | M | Bus. | Policy > **Proceed to Payment**; notifications |
| BR-08-003 | Post official receipts only from Accounting, against open bills.<br>**Accepted when:** the receipt takes the next OR number, cannot exceed the bill balance, posts Dr cash / Cr Premiums Receivable and sets the bill Partial or Paid; receipts are cancelled with a reason, never deleted. | M | BIR | Accounts > Receipts |
| BR-08-004 | Keep receipt numbering in line with the BIR registration.<br>**Accepted when:** the OR series continues the old system's numbering (**Set next number**), only moves forward and prints on the letterhead with TIN; the document title follows `receipts.document_title`. | M | BIR | Master > Document Numbering |
| BR-08-005 | Follow up unpaid premium by age and remind clients.<br>**Accepted when:** collections show ageing buckets; reminders are e-mailed 7 days before due and every 7 days; SMS reminders 3 days before and on the due date when switched on. | M | Bus. | Accounts > Collections; Collection reminders job |
| BR-08-006 | Monitor premium payment warranties per insurer.<br>**Accepted when:** policies past or within 7 days of the warranty are listed; extensions up to 90 days after inception are approved by the Accounting Manager. | M | IC | Credit Control > Premium Warranty Monitor |
| BR-08-007 | Bill by instalments with an invoice per instalment.<br>**Accepted when:** a plan of up to 12 instalments is generated; **Issue instalment invoices** replaces the bill with one bill per instalment, each with its own number, due date, taxes, commission and journal. | S | Bus. | Credit Control > Instalment Plans |
| BR-08-008 | Keep a register of post-dated cheques and deposit them on their date.<br>**Accepted when:** cheques are registered against a bill (not above its balance), listed when due within 3 days, deposited with an OR, cleared or bounced (receipt cancelled, bill reopened, client e-mailed), replaced or returned. | S | Bus. | Accounts > Post-Dated Cheques |
| BR-08-009 | Set and watch client credit limits.<br>**Accepted when:** a policy over the client's limit is issued with a warning that Accounting acknowledges; limits are set by the Accounting Manager. | S | Bus. | Credit Control > Client Credit Limits |
| BR-08-010 | Accept online payments with automatic receipt.<br>**Accepted when:** a payment link (PL-) paid through the gateway creates the official receipt; card details are entered only on the gateway's page. | S | Bus. | Master > Finance > Payment Gateways |
| BR-08-011 | Return a bounced cheque on the bank statement to the client's account.<br>**Accepted when:** a returned cheque cancels the receipt and reopens the bill. | M | Bus. | Bank Reconciliation; Post-Dated Cheques |

## 09 Remittance, direct bill and insurer reconciliation

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-09-001 | Remit collected premium to each insurer net of commission and by co-insurer share.<br>**Accepted when:** draft remittances per insurer are created from collected, unremitted premium; settlement computes premium less commission less tax plus or minus adjustments. | M | IC | Accounts > Remittance (Automated Processing, Settlement) |
| BR-09-002 | Remit within the terms agreed with each insurer.<br>**Accepted when:** due dates follow the insurer's remittance terms (else 30 days); Remittance Ageing lists what is overdue. | M | IC | Insurance Company master; Credit Control > Remittance Ageing |
| BR-09-003 | Approve remittances within authority limits.<br>**Accepted when:** the initiator cannot approve; an Accounting user approves up to PHP 1,000,000.00 and the Accounting Manager without limit (Authority Matrix); delegations cover leave. | M | Bus. | Remittance > Approval Workflow; Authority Matrix; Delegations |
| BR-09-004 | Pay insurers and referrers by bank file.<br>**Accepted when:** vouchers are grouped in a batch for the bank's layout (bulk credit, InstaPay up to PHP 50,000, PESONet), approved by a user who did not prepare it, written, uploaded and closed with the bank's status file, which posts each paid payment. | S | Bus. | Accounts > Bank Payment Files; Master > Finance > Bank File Layouts |
| BR-09-005 | Bill direct-bill commission to insurers with VAT and collect it net of EWT.<br>**Accepted when:** a debit note (DN-) adds 12% VAT, shows the 10% EWT and net cash, is approved by a second user, printed and e-mailed; the collection posts cash and CWT. | M | BIR | Remittance > Direct Bill Processing |
| BR-09-006 | Bill agencies by statement.<br>**Accepted when:** agency bills are loaded, validated and processed. | C | Bus. | Remittance > Agency Bill Processing |
| BR-09-007 | Reconcile insurers' statements of account.<br>**Accepted when:** a statement (ISR-) is imported, matched within the tolerance (PHP 1.00), each difference resolved, and approved by the Accounting Manager. | M | Bus. | Accounts > Insurer Reconciliation > Insurer Statements |
| BR-09-008 | Exchange policy, premium and claim data with insurers' systems.<br>**Accepted when:** an insurer mapping sends the issuance request and reads the answer; premium differences above the tolerance are flagged; claim statuses update claims by API or CSV file. | C | Bus. | Master > System Configuration > Insurer Integration |

## 10 Commission, referrers and incentives

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-10-001 | Keep brokerage rates by insurer, product, line and policy type with dates.<br>**Accepted when:** the most specific active rate applies; **Find rate** shows which rate a placement gets and why; the default is 15% (`commission.default_rate`). | M | Bus. | Master > Finance > Commission Rate Matrix |
| BR-10-002 | Record commission income per insurer on each policy.<br>**Accepted when:** each insurer's commission is a separate journal line. | M | IC | Posting rules; Premium Accounting Entries |
| BR-10-003 | Pay agents and referrers their comsub only when the premium is collected.<br>**Accepted when:** lines move Accrued, Eligible (on full payment), Approved (by another user), Paid; return premium claws back the comsub. | M | Bus. | Commission > Agents/Referrer Accounts |
| BR-10-004 | Withhold tax on commission paid by payee type and ATC.<br>**Accepted when:** WHT at 5% for agents and sub-agents and 10% for external referrers is posted at payout and appears on BIR Form 2307 and the QAP. | M | BIR | `commission.wht_rate_by_type`; Accounts > Tax |
| BR-10-005 | Pay commission only to agents whose IC licence is in force.<br>**Accepted when:** for the referrer types in `compliance.licence_required_referrer_types`, approval and payout are refused (block) or warned (warn) without a licence in force on the day, with the reason on the referrer account. | M | IC | Compliance > Insurance Commission > Licence Register; `compliance.referrer_licence_check` |
| BR-10-006 | Pay commission by voucher, in bulk or by bank file, with a bank account on file.<br>**Accepted when:** **Generate payout** creates the voucher; a referrer without a bank account cannot be paid. | M | Bus. | Agents/Referrer Accounts; Disbursement |
| BR-10-007 | Compute overriding, profit and contingent commission from insurer agreements.<br>**Accepted when:** an agreement with tiers on production, loss ratio or growth is computed per period (OVC-), approved by a second user, invoiced and settled against the insurer's statement. | S | Bus. | Commission > Insurer Overrides |
| BR-10-008 | Run incentive programmes for account executives.<br>**Accepted when:** programmes with targets are calculated per period, approved by another user and shown on the statement. | C | Bus. | Accounts > Incentive; Master > Finance > Incentive Programs |
| BR-10-009 | Show commission to the people who earn and pay it.<br>**Accepted when:** the Commission Dashboard and the Broker Commission Statement show income, comsub, margin, payable and WHT. | S | Bus. | Commission > Commission Dashboard |

## 11 Claims assistance

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-11-001 | Register a claim under the policy with incident, driver, third party and documents.<br>**Accepted when:** the claim (CLM-) is refused for a loss date outside the policy period or in the future and while premium is unpaid. | M | Bus. | Operations > Policy > **Claim** |
| BR-11-002 | Advise the insurer at once.<br>**Accepted when:** the Preliminary Loss Advice is e-mailed to the insurer when the claim is saved. | M | Bus. | `claims.pla_enabled` |
| BR-11-003 | Collect the documents each claim needs and remind the claimant.<br>**Accepted when:** the checklist comes from the master by line and claim type; documents are received or waived; reminders are sent; submission to the insurer is refused while a required document is missing. | S | Bus. | Operations > Claim Documents; Master > Insurance > Claim Document Checklist |
| BR-11-004 | Follow the adjuster, the insurer's claim number and the handling time.<br>**Accepted when:** the adjuster report is recorded; claims past 20 days (`claims.sla_days`) are overdue on the Claims Dashboard; Claims Position and Claims Ageing report them. | M | Bus. | Operations > Claims; Claims Dashboard |
| BR-11-005 | Approve settlements by a second Claims user and print the claim letters.<br>**Accepted when:** the maker cannot approve; the letters print on the letterhead. | M | Bus. | Claims (Settlement, approval) |
| BR-11-006 | Handle motor repairs with estimates and letters of authority.<br>**Accepted when:** estimates of accredited shops are approved by the adjuster; the LOA shows the participation and depreciation; supplementary estimates get supplementary letters; the vehicle release is recorded. | S | Bus. | Operations > Motor Claim Repairs; Master > Insurance > Repair Shops |
| BR-11-007 | Pay claims through the broker.<br>**Accepted when:** settlement books the amount recoverable per insurer and payable to the claimant; Accounting records the funds and pays the claimant with a CPV and the release and quitclaim. | S | Bus. | Accounts > Claims Settlements |
| BR-11-008 | Show each co-insurer's share of claims and settlements.<br>**Accepted when:** a co-insured claim shows each insurer's share. | M | Bus. | Claims |
| BR-11-009 | Keep claimants informed.<br>**Accepted when:** status changes in `messaging.claim_update_statuses` send an SMS when the connector is live. | C | NPC | Message Templates (CLAIM_UPDATE) |

## 12 Accounting, general ledger, period end and audit

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-12-001 | Keep a double-entry ledger fed by every business event.<br>**Accepted when:** each event posts a balanced journal from its posting rule; each journal points to its source document; unbalanced journals, inactive accounts and closed periods are refused. | M | BIR | Master > Finance > Posting Rules, Account Determination, Accounting Flow |
| BR-12-002 | Change posting rules and account determination only with a second user's approval.<br>**Accepted when:** a change waits on Configuration Approvals; the requester cannot approve; **Simulate** shows the journal before approval. | M | Bus. | Master > Finance > Configuration Approvals |
| BR-12-003 | Use a Philippine broker chart of accounts with a premium trust account.<br>**Accepted when:** the delivered chart includes Cash in Bank - Premium Trust Account and separate payables to insurers per premium tax. | M | IC | Master > Finance > Main Account, Sub Account |
| BR-12-004 | Post manual, correction and reversal journals under approval.<br>**Accepted when:** each needs a second user (`journal.require_approval`); a soft-closed period accepts only the Accounting Manager. | M | Bus. | Accounts > Journal Voucher, Correction JV, Reversal JV |
| BR-12-005 | Pay by payment voucher and cheque, and run petty cash, with maker-checker.<br>**Accepted when:** vouchers move Draft, For approval, Approved, Paid; the maker cannot approve; petty cash requests need approval. | M | Bus. | Accounts > Disbursement; Petty Cash |
| BR-12-006 | Record supplier invoices with input VAT and EWT, and pay suppliers.<br>**Accepted when:** an invoice approved by another user posts expense, input VAT, EWT and payable; one invoice number per supplier; AP ageing by due date. | S | BIR | Accounts > Payables |
| BR-12-007 | Keep a fixed asset register with monthly depreciation.<br>**Accepted when:** assets from supplier invoices or registered by hand are depreciated straight-line once per period, also as a step of the month-end close. Disposal is in development. | S | BIR | Accounts > Fixed Assets; Master > Finance > Asset Classes |
| BR-12-008 | Reconcile each bank account monthly.<br>**Accepted when:** statements are imported (balanced, no duplicates), auto-matched, adjusted, and the reconciliation (difference PHP 0.00) is approved by the Accounting Manager. | M | Bus. | Accounts > Bank Reconciliation |
| BR-12-009 | Close each month with a checklist and approval.<br>**Accepted when:** the close run executes accruals, recurring journals, deferral, FX revaluation and depreciation, the checklist passes or is signed off, and the Accounting Manager approves. | M | Bus. | Accounts > Period End > Month-End Close |
| BR-12-010 | Close the year and carry balances forward.<br>**Accepted when:** closing entries post in period 13, opening balances of the next year are written, periods are locked; reversible until the first period of the next year closes. | M | BIR | Accounts > Period End > Year-End Close |
| BR-12-011 | Produce financial statements for any dates.<br>**Accepted when:** income statement, balance sheet and trial balance (opening, movement, closing) export to Excel and PDF. | M | IC | Accounts > Period End > Financial Statements; Reports |
| BR-12-012 | Handle multi-currency transactions.<br>**Accepted when:** foreign currency balances are revalued at month end with the exchange rates of the master. | C | Bus. | Master > Finance > Currency, Exchange Rate; Month-End Close |

## 13 Taxes and BIR compliance

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-13-001 | Keep tax codes with rate, ATC, GL account and effective dates.<br>**Accepted when:** VAT, EWT, final withholding, DST, LGT and premium tax codes are maintained and used by the postings. | M | BIR | Master > Finance > Taxation |
| BR-13-002 | Book output VAT on commission and produce the VAT working paper.<br>**Accepted when:** the VAT Summary gives vatable revenue, output and input VAT and net VAT per month or quarter. | M | BIR | Accounts > Tax > VAT Summary |
| BR-13-003 | Produce the percentage tax working paper for a non-VAT broker or agent.<br>**Accepted when:** 2551Q shows gross sales per month at `bir.percentage_tax_rate` (3%) with print, Excel and filing record. | S | BIR | Accounts > Tax > Percentage Tax 2551Q |
| BR-13-004 | Issue BIR Form 2307 for tax withheld and track forms received.<br>**Accepted when:** certificates per payee and quarter (CWT-) print on the BIR layout; forms received from insurers are listed; SAWT is produced. 2307 for supplier payments is in development. | M | BIR | Accounts > Tax > BIR Form 2307, SAWT |
| BR-13-005 | Prepare 0619-E and 1601-EQ on the BIR layout, reconciled with the ledger.<br>**Accepted when:** the returns show Part I and II by ATC, less earlier remittances, reconcile with the QAP and the withholding accounts, print and export, and keep the filing record. | M | BIR | Accounts > Tax > Withholding Returns |
| BR-13-006 | Prepare the annual information return 1604-E with the alphalist.<br>**Accepted when:** schedules 3 and 4 and the DAT file are produced. | M | BIR | Accounts > Tax > Annual Alphalist 1604-E |
| BR-13-007 | Produce the alphalists and SLSP with their DAT files.<br>**Accepted when:** QAP, SAWT, SLSP sales and purchases and 1604-E DAT files follow the BIR layouts, with warnings for missing TINs. | M | BIR | Accounts > Tax > BIR DAT Files, QAP, SLSP |
| BR-13-008 | Issue sales invoices under the EOPT Act.<br>**Accepted when:** invoices for debit notes, overriding commission, broker-billed commission and fees carry every required field, are numbered within the registered serial range, cancelled with a reason, and payments are acknowledged by a supplementary document. | M | BIR | Accounts > Tax > Sales Invoices |
| BR-13-009 | Support the registration of the computerized accounting system.<br>**Accepted when:** the loose-leaf books print per month with running page numbers and a print register; the system description, backup procedure and audit trail extract are produced. | M | BIR | Accounts > Tax > CAS Books and Documents |
| BR-13-010 | Report invoices to the BIR Electronic Invoicing System when required.<br>**Accepted when:** invoices queue to the EIS with retry, test mode works without network, payloads can be exported for a manual upload. | C | BIR | Accounts > Tax > E-Invoicing (EIS) |
| BR-13-011 | Apply the premium taxes billed to the client and passed to the insurer.<br>**Accepted when:** DST, VAT or premium tax, LGT by city or municipality and FST are booked to their own payables per insurer (`accounting.split_premium_taxes`). | M | BIR | Premium Taxes & LGU Rates; posting rules |

## 14 Insurance Commission and Data Privacy compliance

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-14-001 | Track the licences of the firm, its officers and agents and their renewals.<br>**Accepted when:** licences show Valid, Expiring (90 days), Expired; renewals are recorded as new terms; reminders go out at 90, 60, 30, 15 and 7 days; the expiry calendar covers 12 months. | M | IC | Compliance > Insurance Commission > Licence Register |
| BR-14-002 | Keep fit and proper records of directors and officers.<br>**Accepted when:** declarations are answered, documents attached, the review outcome recorded and the next review due 12 months later is reminded. | M | IC | Compliance > Insurance Commission > Fit and Proper |
| BR-14-003 | Prepare the IC annual statement from the ledger.<br>**Accepted when:** the workbook gives the cover, balance sheet, income statement, premiums and commission by insurer and line, premiums held in trust, the checks and the accountant confirmation sheet, with a configurable account mapping. | M | IC | Compliance > Insurance Commission > IC Annual Statement |
| BR-14-004 | Report premiums placed by insurer and IC line.<br>**Accepted when:** the IC Production Report gives premiums by insurer and line by month, quarter or year, with the detail, in Excel. | M | IC | Compliance > Insurance Commission > IC Production Report |
| BR-14-005 | Handle complaints within set periods (RA 11765).<br>**Accepted when:** complaints (CMP-) get acknowledgement (2 days) and resolution (7 or 45 days) deadlines, reminders, automatic escalation, letters, IC referral and a regulator report. | M | IC | Compliance > Insurance Commission > Complaints |
| BR-14-006 | Keep records of business available for IC examination with the licence number on documents.<br>**Accepted when:** placements, policies, endorsements, claims and renewals are numbered and audited; the licence number prints on documents. | M | IC | Company master; Audit Trail; reports |
| BR-14-007 | Hold premium collected for insurers apart from own funds.<br>**Accepted when:** premiums payable to insurers are separate from commission income; the IC annual statement checks premiums held against the trust account. | M | IC | Chart of accounts; IC Annual Statement |
| BR-14-008 | Answer data subject requests on time.<br>**Accepted when:** requests (DSR-) are due 15 days after receipt; personal data exports in JSON or Excel; anonymisation runs a dry run and is refused while records must be kept. | M | NPC | Master > Data Privacy > Data Subject Requests |
| BR-14-009 | Keep a breach register and meet the 72-hour notification.<br>**Accepted when:** incidents (PDB-) are assessed against the NPC criteria, the clock and reminders run, NPC and data subject notifications are recorded, and the annual report is produced. | M | NPC | Compliance > Data Privacy (NPC) > Breach Register |
| BR-14-010 | Mask personal identifiers by role on screens and exports.<br>**Accepted when:** users without `view:pii` see TIN, ID numbers, mobile, e-mail, bank account and birth date partially masked in lists, views, Excel, CSV and PDF; unmasking on request is audited. | M | NPC | `privacy.masking_enabled`, `privacy.pii_reveal_mode`; Role Permissions |
| BR-14-011 | Encrypt TIN, ID numbers and bank account numbers at rest.<br>**Accepted when:** these fields are stored encrypted with the environment key (`PII_ENCRYPTION_KEY`) while an exact-value search still finds them. | M | NPC | Field encryption; deploy/REFERENCE.md key rotation |
| BR-14-012 | Never use real personal data in test, training or support copies.<br>**Accepted when:** a production copy is masked with the masking command before use, verified, and the evidence approved by the DPO. | M | NPC | `npm run mask:data` (docs/onboarding/DATA_MASKING.md) |
| BR-14-013 | Keep personal data only as long as needed.<br>**Accepted when:** operational logs are deleted after their retention days; business records are kept; anonymisation is allowed after `privacy.retention_years` (10). | M | NPC | Housekeeping job; Data Subject Requests |
| BR-14-014 | Host in the Philippines when the broker requires it.<br>**Accepted when:** the deployment options include a Philippine partner data centre or on-premise. | S | NPC | Deployment options |

## 15 Reporting, administration, security and go-live

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| BR-15-001 | Run every report from one screen in Excel, CSV and PDF.<br>**Accepted when:** the 39 catalogue reports run with criteria, preview and download up to 50,000 rows; PDFs print on the letterhead; the daily reports are produced at 05:00. | M | Bus. | Reports > All Reports |
| BR-15-002 | Give each role its dashboard.<br>**Accepted when:** Executive, Sales, Processing, Claims and Commission dashboards show live figures; migrated policies are not counted as premium written. | M | Bus. | Dashboard menu |
| BR-15-003 | Answer ad hoc questions without new programming, and feed a BI tool.<br>**Accepted when:** the Report Builder builds, saves and shares reports on curated datasets within the user's data scope; the BI extract writes one CSV per dataset daily. | S | Bus. | Reports > Report Builder |
| BR-15-004 | Control access by role, deny by default, checked on every server action.<br>**Accepted when:** a screen outside the role is refused even by its address. | M | NPC | Master > Users and Access |
| BR-15-005 | Apply maker-checker, authority limits, delegations, SoD and access reviews.<br>**Accepted when:** the controls of the user manual's maker-checker table hold; SoD blocks conflicting roles; quarterly access reviews are recorded. | M | Bus. | Authority Matrix, Delegations, Segregation of Duties, Access Reviews |
| BR-15-006 | Enforce password rules, lockout and two-step verification.<br>**Accepted when:** 8 characters with four classes, history 5, expiry 90 days, lockout after 5 failures, idle sign-out after 30 minutes, two-step verification for the roles in `security.require_2fa_roles`. | M | NPC | Sign-in; My Profile; Configuration (Security & Access) |
| BR-15-007 | Keep an audit trail with before and after values that administrators can search.<br>**Accepted when:** Master > Audit Trail finds actions by record type, record ID, user and dates. | M | NPC | Master > System > Audit Trail |
| BR-15-008 | Organise the menu by role and task with help on every screen.<br>**Accepted when:** the side menu groups Master in sections; **F1** opens the Help panel with the manual section of the screen and the support contacts. | S | Bus. | Side menu; Help panel |
| BR-15-009 | Number every document from controlled series.<br>**Accepted when:** each series has prefix, format, digits, reset and next number; the counter only moves forward. | M | BIR | Master > System > Document Numbering |
| BR-15-010 | Brand the system, documents, reports and e-mails for the broker, with e-signatures.<br>**Accepted when:** the theme, logo, sign-in picture, document and e-mail branding are saved after the contrast check; signatures captured with consent print on the mapped documents; brand packs move branding between environments. | S | Bus. | Master > System Settings > Theme and Branding; My Profile > My e-signature |
| BR-15-011 | Use Philippine reference masters.<br>**Accepted when:** regions, provinces, cities and municipalities with ZIP codes and barangays of the PSGC, banks, ID types, salutations, holidays and the IC insurer list are delivered. | M | Bus. | Master > Location; other masters |
| BR-15-012 | Load the go-live configuration and migration with validation and reconciliation.<br>**Accepted when:** the two workbooks validate as a trial run, give an errors workbook, load in one transaction and reconcile the migrated totals; the go-live lock ends the migration. | M | Bus. | Master > Go-Live and Data > Go-Live Data Load |
| BR-15-013 | Prove that two environments hold the same configuration.<br>**Accepted when:** Compare environments returns Mirrored or the differences field by field, with environment-specific fields listed apart; a comparison workbook is kept. | S | Bus. | Go-Live Data Load > Compare environments; `npm run compare:environments` |
| BR-15-014 | Remove test transactions before go-live without touching the configuration.<br>**Accepted when:** the transaction reset empties business records and keeps masters, settings and users, and refuses to run once `golive.locked` is on. | M | Bus. | `npm run reset:transactions` |
| BR-15-015 | Connect to third parties with test mode and monitoring.<br>**Accepted when:** each connector shows its mode, credentials (by environment variable name), outbox, inbox, retries and resend; test mode works with nothing leaving the system. | S | Bus. | Master > System > Integrations |
| BR-15-016 | Send e-mails and in-app notifications for every action and approval.<br>**Accepted when:** approval requests go to the users who may approve; e-mails queue in the outbox with their PDF attachments and are retried. | M | Bus. | Notifications; Master > System > E-mail Outbox |
| BR-15-017 | Release changes through controlled environments.<br>**Accepted when:** the same build moves Dev, SIT, UAT, Pre-Prod, Production with approvals, backup, forward-only migrations, smoke test and rollback. | M | Bus. | deploy/RELEASE_PIPELINE.md |

# Non-functional requirements

| ID | Requirement and acceptance | Pri | Source | Met by |
|---|---|---|---|---|
| NFR-01-01 | Security: named users with hashed passwords, rate-limited sign-in, sessions ended on password or role change.<br>**Accepted when:** the sign-in tests of the release test pass. | M | NPC | Authentication module |
| NFR-01-02 | Security: application controls against the OWASP Top 10 (parameterised SQL, validation, security headers, upload type check by content, signed document links of 30 minutes, CSV formula-injection guard).<br>**Accepted when:** the security tests pass and the API refuses to start with weak secrets. | M | NPC | Architecture, Infrastructure, Security and Privacy |
| NFR-02-01 | Privacy: personal identifiers masked by role and encrypted at rest; consent and data subject rights supported.<br>**Accepted when:** BR-14-008 to BR-14-013 pass. | M | NPC | Privacy and compliance modules |
| NFR-03-01 | Availability: stateless API on two or more instances, jobs run once across instances, health checks.<br>**Accepted when:** `/api/health` reports the database and pending migrations; an instance failure does not stop the service. | S | Bus. | Deployment |
| NFR-03-02 | Recovery: automated backups with point-in-time restore, recovery objectives agreed (recommended RPO 15 minutes or less and RTO 4 hours or less for logical corruption).<br>**Accepted when:** a restore test is done before go-live. | M | Bus. | Business Continuity and Disaster Recovery Plan |
| NFR-04-01 | Performance: screens open within 3 seconds for the reference load (200 named users, 80 concurrent, 50,000 policies a year).<br>**Accepted when:** a load test on the production-sized environment meets it (recommended before go-live). | S | Bus. | Release test; load test |
| NFR-04-02 | Capacity: reports up to 50,000 rows per file; imports up to 20,000 rows; lists paged by the server.<br>**Accepted when:** a report and an import at the limits complete. | S | Bus. | Reports; uploads |
| NFR-05-01 | Audit: every create, update, approval, report run and sign-in recorded with user, time, IP and before and after values, never deleted by housekeeping.<br>**Accepted when:** the audit trail shows the maker and checker of a sample of approvals. | M | BIR | Audit Trail |
| NFR-05-02 | Document control: financial documents cancelled or reversed, never deleted.<br>**Accepted when:** no delete is offered on receipts, vouchers, journals or policies. | M | BIR | All finance screens |
| NFR-06-01 | Usability: browser application, English screens, Philippine formats for money (PHP), dates (DD/MM/YYYY), mobile numbers, ZIP codes and IDs, Asia/Manila time; skeleton loading and Help on every screen.<br>**Accepted when:** UAT users complete their scripts without workarounds. | M | Bus. | Front end |
| NFR-07-01 | Maintainability: forward-only migrations, automated tests on every pull request, OpenAPI documentation of the API.<br>**Accepted when:** CI passes on the release tag. | S | Bus. | Technical Reference |
| NFR-08-01 | Data residency and outsourcing: the hosting location is agreed and documented; a Philippine option is available.<br>**Accepted when:** the Order Form names the hosting option and the data processing agreement is signed. | M | NPC | Hosting Agreement; Data Processing Agreement |
| NFR-09-01 | Configurability: business parameters in Master > Configuration applied at once and audited; posting configuration under second-user approval.<br>**Accepted when:** a setting change shows in the audit trail with old and new value. | M | Bus. | Master > Configuration |

# Functional specification by module

No separate functional specification is issued for BrokerVerse OOTB: this chapter is it. For each module it gives the records and their numbers, the main fields, the rules and validations the server applies, the statuses and the settings (Master > Configuration key and delivered value). The User Manual gives the screen-by-screen procedure and the messages; the Data Dictionary gives every table and column.

## Common rules

| Topic | Rule |
|---|---|
| Permissions | Every menu item and API action needs a permission (read:, write:, approve:, view:pii); roles hold permissions (Master > Users and Access > Role Permissions); deny by default |
| Data scope | Roles in `security.scoped_roles` see only their own records (prospects, quotations, policies, commission) |
| Numbering | `{PREFIX}-{YYYY}-{SEQ}` with five digits, reset every calendar year, from Master > Document Numbering; tokens {PREFIX}, {YYYY}, {YY}, {MM}, {FY}, {BRANCH}, {LOB}, {SEQ}; the counter only moves forward; a prefix used by another active series is refused |
| Money and dates | PHP with two decimals; each tax rounded on its own; dates shown DD/MM/YYYY (`general.date_format`) in Asia/Manila (`general.timezone`) |
| Philippine formats | Mobile 0917 123 4567 or +63 917 123 4567; landline with area code; ZIP code 4 digits; TIN 9 to 12 digits with branch code |
| Lists | Server paging 20, 50 or 100 rows; search and filters apply to the whole list; export where offered |
| Uploads | Images and PDF checked by content (`uploads.allowed_types`); claim documents 2 MB; policy documents 10 MB; bulk files .xlsx or .csv up to 10 MB and 20,000 rows (receipts 1,000, `limits.bulk_upload_max_rows`) |
| Maker-checker | The maker of a record cannot approve it (quotation, renewal terms, settlement, journal, voucher, payout, remittance, debit note, incentive batch, close, reconciliation, posting configuration, treaty, EDD, supplier invoice, override computation, bank file batch) |
| Authority Matrix | Largest amount or percentage per role and transaction type (`access.authority_enforced` true); personal limits; changes approved by a second administrator; delegations by date range |
| Audit | Create, update, approval, report run and sign-in recorded with before and after values; `housekeeping.audit_log_days` 0 keeps them |
| Masking | Users without `view:pii` see TIN, ID numbers, mobile, e-mail, bank account and birth date masked (`privacy.masking_enabled`); `privacy.pii_reveal_mode` on-request records each unmasking |

## Prospects, lead assignment and channels

| Item | Specification |
|---|---|
| Records | Prospect LD-; assignment history; assignment rule; distribution channel |
| Fields | Category (Retail, Corporate), first and last name, preferred name, date of birth, gender, e-mail, mobile, country, province, city, barangay, street, ZIP code; corporate: company name, TIN; line; distribution channel; source |
| Validations | Age between `leads.min_age_years` and `leads.max_age_years` (18 to 100); Philippine mobile; ZIP 4 digits; corporate TIN required |
| Statuses | New, Contacted, Qualified, QuoteGenerated, Converted, Lost |
| Assignment | Rules by priority; methods round robin, fewest open prospects, fixed; conditions line, channel, province, city, branch, source, category; active users only; `leads.assignment_enabled`, `leads.assignment_fallback` (creator or queue), `leads.assignment_sla_hours`, `leads.assignment_notify`; job lead-assignment-sla |
| Channels | Types dealer group, dealer branch, financing bank, bank branch, affinity partner; branch belongs to its group or bank; referrer and comsub %; bank mortgagee clause with {{bankName}}; a used channel is made inactive, not deleted; `channels.inherit_from_lead` |
| Permissions | read:leads, write:leads, read/write:lead-assignment, read/write:channels |

## Quotations, Quick Quote and comparison

| Item | Specification |
|---|---|
| Records | Quotation and Quotation Slip QT-; comparison report; payment link PL- |
| Motor wizard | Policy and vehicle details (co-insurance, insurer, policy type Comprehensive, Own Damage / Theft or Third Party Liability, referrer, payment type, vehicle class, brand, model, variant, model year within 20 years up to next year, colour, seats 1 to 99); plan; covers with Calculate; accessories and limits; order summary with discount, referrer, signatory |
| Pricing | Server re-pricing on save; net premium = sum of covers without CTPL; VAT 12% on the net premium for VAT-regime products; DST PHP 0.50 per PHP 4.00 or fraction; LGT 0.75% or the city rate; CTPL tariff, never taxed again or discounted; gross = net + taxes + CTPL + other - discount; brokerage from the Commission Rate Matrix, insurer default, then `commission.default_rate` 15%; comsub by level (`commission.comsub_rate_by_level` L1 8%, L2 5%) |
| Product rules | Governing template (record's template, `motor.pricing_template_code`, newest active of the product or line); acceptance rules on risk fields (vehicle age, use, class, sum insured, fair market value, driver age, claims in 3 years, NCB years, fleet size, members, modifications, flood-prone, construction) with operators and actions Auto-Accept, Refer, Decline, Apply Loading, per insurer or all; rating factors multiplicative, discount or additive; referral approved within the Underwriting referral limit |
| Statuses | Draft, Pending Customer, Customer Accepted, Approved, Rejected, Dropped, Expired, Converted to Policy; customer response Accepted, Declined, Revise (`quotations.customer_response_status`) |
| Rules | Validity `limits.quote_validity_days` 30 (Quotation expiry job 00:30); approval link `quotations.approval_link_ttl_hours` 168; maker-checker `workflow.quote_maker_checker`; discount within the Authority Matrix; only Draft can be sent |
| Comparison report | Source a request for quotation or two or more quotations of the same party; options ranked by total premium; recommendation and reasons (`comparison.default_reasons`); disclaimer; never commission; client choice closes it as Accepted |

## Requests for quotation, placement and cover notes

| Item | Specification |
|---|---|
| Records | Broker slip BS-, offer OFR-, placement slip PS-, cover note CVN- |
| Broker slip | Customer (client, prospect, new prospect), product, insured, inception, expiry, response due, risk details (item and value), covers (sum insured, deductible), insurers to approach (required), remarks; statuses Draft, Submitted, Responses in, Closed, Cancelled |
| Offers | Pending, Offered, Declined; net premium (100%), rate or derived, line offered, taxes and gross or computed, valid until, deductibles, special terms, insurer reference, offer letter |
| Placement | Participants with share above 0%, each insurer once, exactly one lead, shares total exactly 100%; statuses Draft, Sent to insurer, Bound, Declined, Policy issued, Cancelled; sources From quotation slip, From broker slip, Direct placement, Recorded policy |
| Journey | `placement.journey` per line: each step Required, Optional or Not used; `placement.journey_applies_to_renewals` |
| Checks | Insurer authority at submission, firm order and issue (`compliance.insurer_authority_check` warn, block or off); product market (`product.market_panel_enforced`); acceptance rules per insurer |
| Cover notes | From quotations in `cover_note.quote_statuses` or slips in `cover_note.placement_statuses` without a policy or active cover note; period `cover_note.validity_days` 30, at most `cover_note.max_validity_days`; wording `cover_note.wording`; statuses Active, Superseded, Expired, Cancelled; reminder `cover_note.reminder_days_before` 7 days |

## Policies, CTPL and documents

| Item | Specification |
|---|---|
| Records | Policy POL-, client CL-, bill INV-, journal JV-, COC series, CTPL cover |
| Issue | From a bound slip, an accepted quotation or Record Issued Policy; client created from the prospect; participants copied; billing mode broker billed or direct bill (`direct_bill.default_billing_mode`) |
| KYC | `policy.kyc_required_fields` (motor by default); `policy.kyc_id_types`; vehicle photos left, right, front, rear, interior |
| Statuses | Active, Expired (00:15 job), Renewed, Lapsed (`renewals.grace_period_days` 30), Cancelled; payment Pending, Reviewing, Partial, Completed, Refunded |
| CTPL | COC series per insurer and branch (prefix, range, digits, no overlap, low-stock warning, Used up); allocation at issue (`ctpl.register_on_issue`); authentication (`ctpl.authenticate_on_issue`); vehicle ids required (`ctpl.require_vehicle_ids`); alert after `ctpl.unauthenticated_alert_hours` 24; keyed-in code; LTO feed `ctpl.lto_feed` |
| Documents | PDFs on the letterhead of the letterhead company with the theme's print colours and footer; product document templates (print as policy schedule, CTPL certificate, quotation slip, member enrolment) with a text layout of merge fields ({{PolicyNumber}}, {{InsuredName}} and others) and blocks ({{#Premium}}), unknown names refused; signature slots per document type |
| E-signatures | Signatory signatures captured by an administrator, user signatures only by the user; consent statement (`signatures.consent_text_user`, `signatures.consent_text_signatory`); versions with effective dates; revocation with reason; drafts print UNSIGNED DRAFT (`signatures.draft_watermark`) |

## Dealer programmes, fleets and marine open covers

| Item | Specification |
|---|---|
| Dealer programmes | Dealer, financing bank, insurer, OD and AoN rates, excess BI and PD, default class, CTPL included and years, free first year or subsidy (dealer or bank; percent, fixed or full), upload creates quotation or policy, effective dates; upload rows checked (required fields, class, chassis unique); one bill per payer; bank letter (`motor_programmes.email_bank_letter`, `motor_programmes.bank_letter_subject`, `motor_programmes.bank_letter_body`) |
| Fleet | Client, insurer, period, rates; vehicles with plate or conduction sticker, chassis, engine, make, model, year, colour, class, usage, sum insured, mortgagee; at least `fleet.minimum_vehicles`; upload up to `fleet.max_upload_rows`; changes pro-rata (`fleet.pro_rata_basis`), return premium on delete (`fleet.return_premium_on_delete`) |
| Marine open cover | Goods, voyages, clauses, conveyances (`marine.conveyances`) with rate and limit, mark-up (`marine.default_markup_percent`), minimum premium, declaration frequency; certificate wording `marine.certificate_wording`; declarations due `marine.declaration_due_days`; nil declarations allowed |

## Endorsements and cancellations

| Item | Specification |
|---|---|
| Records | Endorsement END-; cancellation endorsement; short-period rate scale; cancellation reasons (initiated by insured or insurer, method) |
| Types | Motor: Personal Details Change, Motor Details Change, Coverage Change, Policy Extend, Policy Cancel; Fire: regular or premium change, cancellation full, partial, pro-rata, pro-rata partial |
| Statuses | Draft, Pending Customer (Waiting for Update), Completed, Initiate Cancel, Cancelled, Rejected |
| Cancellation | `endorsements.compute_cancellation_return` true; pro-rata = net x days left / days of period; short-period (`endorsements.short_period_for_insured`) from Short-Period Rates scaled to a year; flat; part of cover by percent or amount; taxes returned per `endorsements.cancellation_returned_taxes` (DST not by default); recomputed on the server at completion |
| Postings | endorsement.additional_premium, endorsement.return_premium, policy.cancel, commission.clawback; refund due from insurer netted on its next remittance |

## Renewals

| Item | Specification |
|---|---|
| Rules | Pipeline `renewals.pipeline_days` 90; notices `limits.renewal_notice_days` 60, 30, 15; grace `renewals.grace_period_days` 30; lapsed renewal `renewals.lapsed_renewal_days` 90; batch up to `renewals.batch_max_policies` 500 within `renewals.batch_window_days` 30; re-rating `renewals.rating_rates`, claims loading 10% per claim up to 30%, loyalty 2% per renewal up to 10%; maker-checker `renewals.maker_checker`, approvers `renewals.approver_roles`; billing `renewals.create_receivable` |
| Risk score | Weights `renewals.risk_weights` (claims 25, unpaid premium 20, increase above 10% 20, first renewal 15, expiry within 15 days 10, no contact 10); levels `renewals.risk_thresholds` 30, 55, 75 |
| Statuses | Pending, First Notice Sent, Second Notice Sent, Final Notice Sent, Quote Sent, Approved, Renewed, Lapsed |

## Receipts, collections, credit control and post-dated cheques

| Item | Specification |
|---|---|
| Records | Receipt OR- and RT-, acknowledgement receipt AR-, instalment plan, PDC, payment link PL- |
| Receipt fields | Receipt date and type (Payment, Refund), branch, department, customer, policy, currency, transaction code OR, receipt mode and reference, bill and amount, remarks |
| Rules | Amount not above the bill balance; posting receipt.apply; commission eligible on full payment (`commission.auto_eligible_on_full_payment`); e-mail on record (`receipts.email_on_record`); title `receipts.document_title`; bulk upload up to 1,000 rows |
| Collections | Due date from the insurer's warranty or `collections.default_credit_days` 30; buckets Current, 1-30, 31-60, 61-90, over 90; reminders `collections.reminder_days_before` 7 and `collections.reminder_repeat_days` 7 at 08:00; statuses Pending, Committed, Overdue |
| Instalments | 4 proposed, up to 12; monthly, quarterly, semi-annual; payments applied in order; invoices per instalment (`credit.instalment_invoices_on_save`) before any payment; an invoiced plan cannot be cancelled |
| Warranty and limits | At risk 7 days before the warranty; extension up to `credit.max_warranty_extension_days` 90 after inception, approved by the Accounting Manager; credit limit exceptions acknowledged |
| PDC | Cheques on hand not above the bill balance; due window `pdc.due_window_days` 3; deposit creates the OR on the bank account (`pdc.default_deposit_account`); bounced reverses the receipt, reopens the bill and e-mails the client (`pdc.notify_client_on_bounce`); replace, return, cancel |

## Remittance, direct bill, bank files and insurer reconciliation

| Item | Specification |
|---|---|
| Records | Remittance REM-, settlement SET-, adjustment ADJ-, payment voucher PV- and DT-, debit note DN-, bank payment batch BPB-, insurer statement ISR- |
| Remittance | Due date from the insurer's remittance terms or `remittance.default_due_days` 30; approvals within the Authority Matrix (Remittance approval, Remittance settlement); bank reconciliation tolerance `remittance.reconciliation_tolerance` PHP 0.50; schedules run by remittance-schedules |
| Direct bill | Commission + VAT 12% (`direct_bill.commission_vat_code` VAT12-OUT); EWT 10% (`direct_bill.insurer_ewt_rate`, code WC139); due `direct_bill.debit_note_due_days` 30; statuses Draft, Pending Approval, Open, Partially Collected, Collected; billing mode change refused after collection, remittance or debit note |
| Bank files | Layouts delimited or fixed width with header, payment and trailer records and a status file; starter layouts BDO, BPI, Metrobank, Landbank, UnionBank and generic CSV in test mode until validated; channels bulk credit, InstaPay (`bank_payments.instapay_limit` PHP 50,000), PESONet; payee bank accounts; approver not the maker of the batch or its vouchers and within the payment voucher limit |
| Insurer statements | Statement types premium remittance confirmation and commission statement; formats per insurer; tolerance `insurer_reconciliation.amount_tolerance` PHP 1.00; all differences resolved before submission (`insurer_reconciliation.require_resolved`); approval by the Accounting Manager |

## Commission, insurer overrides and incentives

| Item | Specification |
|---|---|
| Records | Commission line; payout PV-; override agreement and computation OVC-; incentive programme INC-, calculation CALC- |
| Rules | Statuses Accrued, Eligible, Approved, Paid, Reversed; `commission.require_full_payment`; `commission.require_bank_account`; WHT `commission.wht_rate_by_type` (Agent 5%, Sub-agent 5%, External 10%), ATC `bir.atc_by_payee`; licence check `compliance.referrer_licence_check` block for `compliance.licence_required_referrer_types` |
| Overrides | Types Overriding, Profit, Contingent; basis production volume, loss ratio, growth; period monthly to annual; premium net or gross; tiers slab or banded; claims statuses `commission.override_claims_statuses`; approval `commission.override_requires_approval`; settlement tolerance `commission.override_settlement_tolerance`; postings override_commission.accrual and settlement |
| Incentives | Types Target Based, Commission Based, Hybrid, Contest; eligible roles `incentive.eligible_roles`; batches approved by another user; postings incentive.accrual, incentive.payout |

## Claims

| Item | Specification |
|---|---|
| Records | Claim CLM-, LOA-, claim payment voucher CPV- |
| Fields | Date and time of incident, location, city, province, cause (`claims.loss_causes`), estimate, insurer claim number, driver (motor, `claims.lob_fields`), third party; adjuster, dates, place; settlement type (`claims.settlement_types`), amount, issue and settlement dates |
| Validations | Loss date in the policy period and not in the future (`claims.validate_loss_date`); premium paid (`claims.block_unpaid_premium`); reported date not before the loss date; settlement amount above zero; settlement date not before the issue date |
| Statuses | Pending, Processing, Pending Approval, Approved, Settled, Rejected, Closed |
| Rules | PLA e-mail (`claims.pla_enabled`); due date `claims.sla_days` 20; maker-checker `claims.settlement_maker_checker`; auto settle `claims.auto_settle_on_approval`; documents checklist, reminders `claims.document_reminder_days` 3, submission rule `claims.require_documents_before_submission` |
| Motor repairs | Estimates of active accredited shops; one estimate waiting at a time; approved amount at most the estimate; participation `motor_claims.participation` (PHP 2,000 or 0.5% of the sum insured, whichever higher, original letter only); parts depreciation `motor_claims.parts_depreciation_percent`; LOA validity `motor_claims.loa_validity_days` |
| Paid through broker | claim.settlement.paid_through_broker, claim.funds_received (never above the insurer's share), claim.paid_to_claimant |

## Accounting, payables, fixed assets and period end

| Item | Specification |
|---|---|
| Ledger | Posting rules per event with versions, effective dates, simulation and history; account roles mapped in Account Determination; changes approved on Configuration Approvals (`accounting.configuration_maker_checker`); premium taxes on own accounts (`accounting.split_premium_taxes`) |
| Journals | Must balance; approval `journal.require_approval`; correction and reversal of posted vouchers; write-off reasons with limits |
| Disbursement | Payee types Customer, Insurer, Agent/Referrer, Supplier; criteria Specific or Payall; statuses Draft, For approval, Approved, Paid, Cancelled; `finance.maker_checker_enabled` |
| Payables | Supplier TIN, VAT registration, EWT code, terms, default expense account; input VAT at `payables.input_vat_code`; EWT on the amount net of VAT; maker-checker `payables.maker_checker`; postings ap.invoice, ap.payment; asset lines registered on approval |
| Fixed assets | Asset classes with useful life and accounts; straight-line from `fixed_assets.first_month`; last month takes the rounding to salvage; once per asset and period; fa.depreciation; month-end step `fixed_assets.depreciation_in_month_end` |
| Bank reconciliation | Formats per bank; balanced statement (`bank_reconciliation.require_balanced_statement`); duplicates refused; auto-match on import, date window `bank_reconciliation.date_window_days` 5, groups up to `bank_reconciliation.group_max_lines` 6; stale cheques after `bank_reconciliation.stale_cheque_days` 180 |
| Period end | Periods Open, Soft-closed, Closed, Locked; period 13 for year-end; close run steps accruals, recurring journals, commission deferral (`accounting.defer_commission`), FX revaluation, depreciation, checklist (blocking or warning, manual items); approval `accounting.period_close_requires_approval`; year-end reversible until the first period of the next year closes |

## Tax (BIR)

| Item | Specification |
|---|---|
| Settings | `bir.withholding_agent_tin`, `bir.registered_name`, `bir.registered_address`, `bir.zip_code`, `bir.tin_branch_code`, `bir.trade_name`, `bir.withholding_due_day` 10, `bir.withholding_ledger_accounts`, `bir.percentage_tax_rate` 3, `bir.percentage_tax_atc` PT010, `bir.sawt_form` 1702Q, `bir.atc_by_payee` |
| Returns | 0619-E, 1601-EQ (per ATC, less 0619-E), 1604-E (schedules 3 and 4), 2551Q; reconciliation with QAP and ledger; print, Excel; filing record with amended returns |
| DAT files | QAP, SAWT, SLSP sales, SLSP purchases, 1604-E; header, detail and control records; capitals in quotes; two decimals; CR LF |
| Sales invoices | Series SI- never reset, stopped at `invoice.serial_to`; ATP or CAS permit (`invoice.atp_number`, `invoice.cas_permit_number`); buyer details from `invoice.buyer_details_threshold` 1,000; payment acknowledgement PAR- (`invoice.payment_document_title`, `invoice.supplementary_note`); postings sales_invoice.issue and payment for manual invoices |
| EIS | `eis.enabled` off; `eis.mode` test or live; endpoint and credential variable names; retry `eis.retry_minutes` doubled up to `eis.max_attempts`; rejection final |
| CAS | Books General Journal, General Ledger, Cash Receipts, Cash Disbursements, Sales, Purchase; `cas.books_form` loose-leaf; `cas.enforce_print_order`; print once, reprint marked REPRINT, void of the latest print with reason |

## AML/CFT

| Item | Specification |
|---|---|
| Records | EDD review EDD-, alert AMA-, case AMC-, report file AMR-, screening list version, screening hit |
| Settings | `aml.covered_threshold` 500,000; `aml.covered_aggregation` banking-day; `aml.covered_payment_modes` cash; `aml.ctr_due_working_days` 5; `aml.str_due_working_days` 1; `aml.match_threshold` 0.85; `aml.risk_low_max_score` 2; `aml.risk_high_min_score` 8; `aml.pep_always_high`; `aml.kyc_refresh_months` 36, 24, 12; `aml.kyc_refresh_notice_days` 30; `aml.beneficial_owner_threshold` 25; `aml.record_retention_years` 5; `aml.screening_block_events` policy-issue, payout; `aml.block_issue_pending_edd`; `aml.amlc_institution_code`; `aml.amlc_transaction_codes`; `aml.screening_provider` |
| KYC statuses | Incomplete, Complete, EDD required, Refresh due, Blocked |
| Hit decisions | Clear (auto-cleared again later), Escalate (to a case), Confirm (Blocked, High) |
| Report file | BV-AMLC-TXN 1.0, pipe-delimited: H header, D detail per transaction, N narrative for STR, T trailer |
| Jobs | aml-transaction-monitoring (daily), aml-kyc-refresh-due (weekly), aml-provider-retry |

## IC compliance, complaints and data privacy

| Item | Specification |
|---|---|
| Licences | Holder types firm, officer, licensed individual, agent or referrer; types `compliance.licence_types`; states Valid, Expiring (`compliance.licence_expiring_days` 90), Expired, No expiry date; renewal Filed with the IC; superseded on renewal; reminders `compliance.licence_reminder_days` 90, 60, 30, 15, 7 |
| Fit and proper | Categories Director, Officer, Compliance officer, Key person; declarations `compliance.fit_proper_declarations`; outcome Fit and proper, Conditional, Not fit and proper; review every `compliance.fit_proper_review_months` 12; reminder `compliance.fit_proper_reminder_days` 30 |
| Insurer authority | IC Certificate of Authority No. and Valid Until on the insurer; states Valid, Expiring (`compliance.insurer_authority_expiring_days` 60), Expired, No certificate, No validity date |
| IC reports | Annual statement form set `compliance.ic_statement_form`; account mapping by longest prefix; optional `compliance.ic_minimum_net_worth`; production report lines `compliance.ic_lines_of_business` and `compliance.ic_line_map` |
| Complaints | CMP-; channels and categories lists; simple or complex; `complaints.ack_days` 2, `complaints.resolution_days_simple` 7, `complaints.resolution_days_complex` 45; `complaints.auto_escalate`; letters `complaints.ack_letter_text`, `complaints.resolution_letter_text`; outcomes Upheld, Partially upheld, Not upheld, Withdrawn |
| Breaches | PDB-; nature confidentiality, integrity, availability; data categories `privacy.breach_data_categories`; `privacy.breach_notify_hours` 72; `privacy.breach_reminder_hours` 48, 24, 6; notifiable breach closed only after NPC notification |
| Data subject requests | DSR-; types Access, Rectification, Erasure or blocking, Objection, Data portability, Withdraw consent; due `privacy.request_due_days` 15; export JSON or Excel; anonymisation refused while in force, open items or within `privacy.retention_years` 10 |
| Consent | Purposes Processing, Marketing, Sharing with insurers; Given or Refused; channels Form, E-mail, Phone, Portal, In person; notice `privacy.notice_version`; SMS consent `messaging.service_consent` |
| Permissions | read:compliance, write:compliance, read:complaints, write:complaints, approve:complaints, read:privacy, write:privacy, read:aml, write:aml, approve:aml, view:pii |

## Administration, integrations, reports and go-live

| Item | Specification |
|---|---|
| Users | Username, e-mail, display name, branch, designation, reporting to, roles; temporary password shown once; dormant after `access.dormant_days` 90; SoD Block or Warn; access reviews Keep or Revoke |
| Security settings | `security.password_min_length` 8; history `security.password_history_count` 5; expiry `security.password_max_age_days` 90; `limits.max_login_attempts` 5; `security.login_rate_limit` 10 in 5 minutes; `limits.session_idle_minutes` 30; `security.require_2fa_roles`; reset code 15 minutes, 5 attempts |
| My Work | Tabs My Items, My Team, My Tasks, Calendar; `myWork.due_soon_days`; `myWork.auto_tasks`; `myWork.overdue_task_alert` |
| Integrations | Connectors SMS_SEMAPHORE, SMS_GLOBE_LABS, SMS_GENERIC, VIBER_BUSINESS, CTPL_AUTH, LTO_FEED, INSURER_API, BANK_FILES; mode test or live (live refused without endpoint and credential variables); retry with backoff; signed inbound messages; job integration-outbox every 2 minutes; templates RENEWAL_NOTICE, PAYMENT_REMINDER, CLAIM_UPDATE, CTPL_AUTHENTICATED, RENEWAL_NOTICE_VIBER with consent check |
| Reports | 39 catalogue reports; `reports.max_rows` 50,000; links 72 hours; files kept 90 days; Report Builder datasets Policies, Clients, Bills, Claims, Commissions with `report_builder.preview_rows`, `report_builder.max_rows`; BI extract `bi.extract_datasets`, `bi.extract_folder`, `bi.extract_keep_runs` |
| Branding | Theme presets and custom colours; WCAG AA contrast refused below 4.5:1 for the main pairs; safe font list; images uploaded (SVG without scripts); brand packs .zip or .json; client brand packs only with the client's written permission |
| Go-live data | Configuration and migration workbooks with Instructions and Lists sheets; row 2 sample; natural keys; trial run in a rolled-back transaction; load in one transaction; migration refused without `golive.cutover_date` and after `golive.locked`; reconciliation workbook; comparison of environments with environment-specific fields excluded |
| Release and masking | Pipeline ci, deploy, rollback; environments Dev, SIT, UAT, Pre-Prod, Production; transaction reset `npm run reset:transactions` refused after the go-live lock; masking `npm run mask:data` with the safety guards of the masking procedure |

# Assumptions, constraints and dependencies

## Assumptions

- The broker uses the OOTB screens and adapts its procedures where they differ (configure first); a requirement not met by configuration is a gap handled by change request.
- The broker's compliance officer, DPO and tax adviser confirm the delivered settings (thresholds, deadlines, tax codes, ATC, rates, letter texts, IC lines, the IC statement form set) against the rules in force before go-live.
- The insurers confirm the motor tariff, the premium tax treatment and rounding they apply, and their statement and API formats.
- The broker provides the data of the migration workbook in the agreed form and signs the control figures.
- One fiscal year of opening balances is loaded; closed business stays in the old system.

## Constraints

- Filings with the BIR, AMLC, IC and NPC are made outside BrokerVerse.
- Interfaces with partners (bank files, CTPL provider, LTO, insurer APIs, SMS and Viber, EIS, screening provider, payment gateways) need the partner's contract, credentials and certification; until then they run in test mode or by file.
- Secrets (database, e-mail, gateway, encryption key) are set in the environment's secret store, never on screen or in a workbook.
- Screens are in English.

## Dependencies

- SMTP mailbox for e-mail; payment gateway merchant account; SMS gateway; CTPL authentication provider; bank file specifications; screening lists or provider.
- Hosting provisioned with backups before the first mock load; Pre-Prod for the rehearsal.
- Named key users, process owners and approvers available for workshops, UAT and sign-off.

# Requirement summary

| Area | Requirements | Must | Should | Could | IC | BIR | NPC | AMLC |
|---|---|---|---|---|---|---|---|---|
| 01 Client onboarding, KYC and AML | 14 | 13 | 1 | 0 | 0 | 0 | 1 | 11 |
| 02 Prospecting and sales pipeline | 10 | 2 | 7 | 1 | 0 | 0 | 1 | 0 |
| 03 Quotation and insurer comparison | 10 | 6 | 3 | 1 | 2 | 1 | 0 | 0 |
| 04 RFQ, placement, co-insurance and reinsurance | 11 | 6 | 2 | 3 | 3 | 0 | 0 | 0 |
| 05 Policy issuance, documents and motor | 11 | 8 | 2 | 1 | 2 | 0 | 0 | 0 |
| 06 Endorsements and cancellations | 8 | 7 | 1 | 0 | 2 | 2 | 0 | 0 |
| 07 Renewals and retention | 8 | 3 | 4 | 1 | 0 | 0 | 1 | 0 |
| 08 Billing, collection, credit control and receipts | 11 | 7 | 4 | 0 | 1 | 2 | 0 | 0 |
| 09 Remittance, direct bill and insurer reconciliation | 8 | 5 | 1 | 2 | 2 | 1 | 0 | 0 |
| 10 Commission, referrers and incentives | 9 | 6 | 2 | 1 | 2 | 1 | 0 | 0 |
| 11 Claims assistance | 9 | 5 | 3 | 1 | 0 | 0 | 1 | 0 |
| 12 Accounting, general ledger, period end and audit | 12 | 9 | 2 | 1 | 2 | 4 | 0 | 0 |
| 13 Taxes and BIR compliance | 11 | 9 | 1 | 1 | 0 | 11 | 0 | 0 |
| 14 Insurance Commission and Data Privacy compliance | 14 | 13 | 1 | 0 | 7 | 0 | 7 | 0 |
| 15 Reporting, administration, security and go-live | 17 | 12 | 5 | 0 | 0 | 1 | 3 | 0 |
| Total | 163 | 111 | 39 | 13 | 23 | 23 | 14 | 11 |

The table counts the business requirements (BR); the 13 non-functional requirements (NFR) are counted apart. Source counts each requirement once by its main authority; the others are business needs (Bus.) or motor registration (LTO).
