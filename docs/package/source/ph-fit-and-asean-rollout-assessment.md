---
title: Philippine Fit and ASEAN Rollout Assessment
subtitle: iNXT BrokerVerse OOTB (INTERNAL)
version: 1.1.2
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Version 1.1.2: the regulator and partner items of "What remains" are available as optional modules and partner services of the Rate Card (management decision of 04 October 2026); scores unchanged. Version 1.1.1: release figures aligned (migrations to 0331, 104 backend test files, UAT scenario of 433 steps, go-live rehearsal of 52 checks); scores unchanged. Version 1.1: re-scored on the merged release (every package A to G); what was closed and what remains; ASEAN estimates recomputed on the new baseline
open_item: Two processes scored 1 pending regulator confirmation (AMLC report file layout, IC annual statement form set); partner certifications of the integrations are onboarding tasks
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; NPC=National Privacy Commission; AMLC=Anti-Money Laundering Council; AMLA=Anti-Money Laundering Act; KYC=Know your customer; CDD=Customer due diligence; EDD=Enhanced due diligence; PEP=Politically exposed person; CTPL=Compulsory Third Party Liability; COC=Certificate of cover; LTO=Land Transportation Office; PSGC=Philippine Standard Geographic Code; EOPT=Ease of Paying Taxes Act (RA 11976); RR=Revenue Regulations; CAS=Computerized Accounting System; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; VAT=Value-added tax; GST=Goods and services tax; SST=Sales and service tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; EIS=Electronic Invoicing System; DAT=BIR validation data file; RFQ=Request for quotation; L1=Level 1 process area; L2=Level 2 process; UI=User interface; MAS=Monetary Authority of Singapore; BNM=Bank Negara Malaysia; OIC=Office of Insurance Commission (Thailand); OJK=Otoritas Jasa Keuangan (Indonesia); BDCB=Brunei Darussalam Central Bank; IRC=Insurance Regulator of Cambodia; PDPA=Personal Data Protection Act
---

# Summary for the product owner

This assessment answers three questions about BrokerVerse OOTB as it is on 04 October 2026, with every package of the release merged on branch `brokerverse-platform`: how well it fits the practice of a Philippine non-life broker, what this release closed and what still remains, and how much it would have to change for the other ASEAN countries. The figures come from a catalogue of 150 business processes, each one re-verified against the code, the database migrations, the tests, the menu and the user manual. Every score, with its screen path, module and test file, is in the companion workbook **BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment.xlsx**.

> Version 1.0 of this document, issued on the same date, scored the pre-release code and counted twelve processes as in development. Version 1.1 scores the merged release. Nothing is counted as in development any more: a process is scored 2 only when a screen, a module and a test show it running end to end today.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 04 October 2026 | Pre-release assessment: overall fit 80.4%, regulatory 70.7%, 54 gaps, 12 processes in development |
| 1.1 | 04 October 2026 | Re-score on the merged release (packages A to G): every one of the 150 processes re-verified against the code and tests; "Room to improve today" replaced by "What was closed in this release and what remains"; ASEAN change percentages recomputed on the new baseline |
| 1.1.1 | 04 October 2026 | Release figures aligned with the release verification (Test Summary Report 1.3): migrations to 0331, 104 backend test files, UAT scenario of 433 steps, go-live rehearsal of 52 checks; scores unchanged (overall 99.3%, operational 100%, regulatory 97.8%) |
| 1.1.2 | 04 October 2026 | The regulator and partner items of "What remains" are available as optional modules and partner services of the Rate Card, confirmed by management on 04 October 2026; scores unchanged |

## The answers

| Question | Answer today |
|---|---|
| Overall Philippine process fit | **99.3%** (weighted, 150 L2 processes in 15 areas; 148 scored 2, 2 scored 1, none scored 0) |
| Operational process fit | **100%** (101 processes) |
| Regulatory compliance fit (IC, BIR, NPC, AMLC) | **97.8%** (49 processes) |
| By authority | BIR 100%, NPC 100%, IC 95.9%, AMLC 92.9% |
| Broker practice / captive agency practice | 99.2% / 99.2% |
| Strongest areas | Thirteen of the fifteen areas score 100%: prospecting, quotation, placement, policy and motor, endorsements, renewals, billing, remittance, commission, claims, accounting, BIR, and reporting and administration |
| Remaining weaker areas | Client onboarding, KYC and AML 95.5% (the AMLC report file layout awaits the AMLC's confirmation) and IC and data privacy compliance 94.4% (the IC annual statement is a working paper the accountant transcribes onto the IC form set) |
| What remains outside the product | Partner certifications of the six integrations (bank files, SMS, CTPL provider and LTO, insurer APIs, BIR EIS, screening provider) and the regulator or adviser confirmations listed in "What remains" |
| ASEAN, low change | Singapore and Brunei about 21% change, Malaysia about 29% |
| ASEAN, high change | Thailand about 35%, Cambodia and Lao PDR about 39 to 40%, Indonesia about 42%, Vietnam about 46%; Myanmar not recommended now |

## What this means

The release closed every gap of the 1.0 assessment that could be closed in the product. The sales and placement chain, the money side, the claims side and the administration were already strong; the compliance programmes that sat around the transactions are now in the product too: the AML/CFT programme (onboarding before the first policy, juridical clients with signatories and beneficial owners, risk rating and EDD, screening lists and hits, transaction alerts, cases and AMLC report files), the IC registers (licences with the commission block, fit and proper, insurer certificates of authority, complaints under RA 11765, the annual statement working paper and the production report), the NPC controls (masking by role, field encryption, breach register with the 72-hour clock) and the BIR forms beyond the working papers (0619-E, 1601-EQ, 1604-E, 2551Q, DAT files, EOPT sales invoices, EIS connector, CAS books).

Two items are still scored 1, both for the same reason: the system produces a file or a working paper whose official layout the regulator or the broker's accountant must confirm before the first filing (the AMLC report file, the IC annual statement). They are not missing features; they are confirmations the product cannot give itself. The integrations score 2 because each has a connector with a configurable provider, a test mode exercised by the tests, an outbox with retry and a manual or file fallback; what remains with each partner (the bank's acceptance of a test file, the SMS contract, the CTPL provider's and the LTO's acceptance, each insurer's API contract, the BIR EIS enrolment) is an onboarding task and is named in the gap note of each item.

For ASEAN, the configurable layer grew with this release: the integration framework (connectors, adapters, outbox), the bank file layouts, the compliance registers with configurable deadlines and declarations, the AML risk factors and lists, the report builder and the branding. Those carry over. The regulatory layer is still Philippine-specific, and it is larger than before: the BIR module, the AMLC file, the IC reports and the CTPL authentication are all replaced in a new country. The net effect is a change estimate 3 to 4 points lower per country than in version 1.0.

# Scope, baseline and method

## Baseline

- Code on branch `brokerverse-platform` as of 04 October 2026 with every release package merged: 73 backend modules, the database migrations to 0331, 104 backend test files, the enterprise menu (`brokerverse/src/components/SideBar/list.js`, `utils/menuPermissions.js`), the UAT scenario (`backend/scripts/uat-scenario.js`, 433 steps passed) and the go-live rehearsal (52 checks passed).
- Documents used as evidence: the User Manual (the screen paths quoted in the workbook are its menu paths), the Philippine Regulatory Compliance Matrix, the Product Functionality document and the Test Summary Report.
- Only what runs end to end counts. A screen that exists but does not complete the process gets no credit; nothing is counted as in development.

## Process catalogue

The catalogue describes the work of a Philippine non-life broker, and of a captive agency (for example the insurance agency of a motor distributor), in 15 L1 areas and 150 L2 processes. Each L2 is marked with whom it applies to (broker, agent or both) and its type: operational, or a regulatory item of the IC, BIR, NPC or AMLC. The catalogue is the same as in version 1.0, so the two versions compare like for like; only the evidence and the scores changed.

| Field | Meaning |
|---|---|
| Weight | 3 core to daily operation or a legal obligation; 2 important; 1 useful or occasional |
| Score | 2 supported out of the box end to end, evidenced by a screen, a module and a test; 1 partly supported (no screen, or a report whose official layout the regulator must confirm); 0 not supported |
| Evidence | Screen path from the menu, module under `backend/src/modules`, migration, setting and test file |
| Gap note | What is partial and why, or the certification or confirmation that remains with a partner, a regulator or an adviser |

## Scoring rules applied in this version

- **Integrations.** A bank file, SMS, CTPL authentication and LTO feed, insurer API, BIR EIS or AML screening provider scores 2 only when the code has a connector with a configurable provider, a test mode that the tests exercise, an outbox with retry and a working manual or file fallback. The gap note states what certification remains with the partner. All six meet the rule.
- **Regulator confirmations.** A report whose official layout the regulator or the broker's adviser must confirm before the first filing is scored 1 when the system does not reproduce the official form itself. This applies to the AMLC report file (the product's own layout BV-AMLC-TXN 1.0, built after the AMLC reporting guidelines) and to the IC annual statement (a working paper the accountant transcribes onto the IC form set). Forms the BIR publishes (0619-E, 1601-EQ, 1604-E, 2551Q, the DAT record layouts) are scored 2, with the validation step named in the gap note.
- **Settings the broker confirms** (ATCs and rates, complaint deadlines, fit and proper declarations, the IC line set, invoice registration, the insurer authority check switched from warn to block) are noted in the gap note and not deducted: they are configuration, not code.

## Calculation

- Fit % of an L1 area = sum of (weight x score) / sum of (weight x 2).
- Overall fit uses all 150 processes; regulatory fit the 49 processes typed IC, BIR, NPC or AMLC; operational fit the other 101.
- Gap impact = weight x (2 - score), times 1.5 for a regulatory item. With two gaps left the ranking is short; the full list is in the workbook, sheet Gaps Ranked.

# Philippine process fit

## Fit by process area

| # | L1 process area | Fit 1.1 | Fit 1.0 | L2 (2 / 1 / 0) |
|---|---|---|---|---|
| 1 | Client onboarding, KYC and AML | 95.5% | 52% | 10 (9 / 1 / 0) |
| 2 | Prospecting and sales pipeline | 100% | 65% | 7 (7 / 0 / 0) |
| 3 | Quotation and insurer comparison | 100% | 90% | 11 (11 / 0 / 0) |
| 4 | RFQ, placement, co-insurance and reinsurance | 100% | 85% | 10 (10 / 0 / 0) |
| 5 | Policy issuance, documents and motor (CTPL, LTO) | 100% | 83% | 11 (11 / 0 / 0) |
| 6 | Endorsements and cancellations | 100% | 82% | 8 (8 / 0 / 0) |
| 7 | Renewals and retention | 100% | 92% | 6 (6 / 0 / 0) |
| 8 | Billing, collection, credit control and receipts | 100% | 89% | 12 (12 / 0 / 0) |
| 9 | Remittance, direct bill and insurer reconciliation | 100% | 83% | 8 (8 / 0 / 0) |
| 10 | Commission, referrers and incentives | 100% | 88% | 9 (9 / 0 / 0) |
| 11 | Claims assistance | 100% | 84% | 8 (8 / 0 / 0) |
| 12 | Accounting, general ledger, period end and audit | 100% | 96% | 10 (10 / 0 / 0) |
| 13 | Taxes and BIR compliance | 100% | 74% | 13 (13 / 0 / 0) |
| 14 | Insurance Commission and Data Privacy compliance | 94.4% | 59% | 13 (12 / 1 / 0) |
| 15 | Reporting, administration, security and go-live | 100% | 84% | 14 (14 / 0 / 0) |
| | **Overall** | **99.3%** | **80.4%** | **150 (148 / 2 / 0)** |

## Regulatory fit by authority

| Authority | Fit 1.1 | Fit 1.0 | Delivered | What remains |
|---|---|---|---|---|
| BIR | 100% | 81% | Premium taxes, VAT Summary, Form 2307 issued (commission payees and suppliers) and received, SAWT, QAP, SLSP, 0619-E and 1601-EQ with filing records, 1604-E, 2551Q, DAT files, EOPT sales invoices, EIS connector, CAS books and documents | Validation of each DAT file with the BIR validation module before the first submission; the tax adviser's confirmation of the registered invoice documents and VAT treatment; EIS enrolment and certification with the BIR; the CAS registration itself |
| NPC (Data Privacy Act) | 100% | 78% | Consent register, data subject requests, export and anonymisation, retention, masking by role (`view:pii`), field encryption of TIN, IDs and bank accounts, breach register with the 72-hour clock, audit trail screen, access control and two-step verification | None in the product; the NPC registration and breach notifications are the broker's |
| IC | 95.9% | 68% | Premium payment warranty, remittance terms, premium held in trust, CTPL tariff and COC authentication, licence register with the commission block, fit and proper, insurer certificate of authority check, complaints register, production report, records of business | The IC annual statement is a working paper (scored 1): the accountant confirms and transcribes it onto the IC form set in force. The CTPL provider and LTO acceptance of the live interface; the certificate numbers of the insurers to enter before switching the authority check to block |
| AMLC (AMLA) | 92.9% | 36% | Onboarding before the first policy, juridical clients with signatories and beneficial owners, government ID capture, risk rating and EDD, KYC refresh, screening lists and hits, transaction alerts, cases, record retention | The AMLC report file layout (scored 1): institution code, transaction codes, ID type codes and field order to confirm against the AMLC's current guidelines and a test file validated in the AMLC portal. The lists themselves (UN, AMLC, PEP) are loaded by the broker |

## Strongest areas

- **Accounting and period end (100%).** Every business event posts a balanced journal through posting rules; journal, correction and reversal vouchers with approval; bank statement import with matching rules; month-end close with checklist, accruals, recurring journals and depreciation; year-end close; financial statements; accounts payable with input VAT and supplier 2307; fixed asset register, depreciation and disposal (`accounting-flow.test.js`, `period-end.test.js`, `bank-reconciliation.test.js`, `ops-accounting.test.js`, `ap-2307-asset-disposal.test.js`).
- **Billing, collection and receipts (100%).** Bills, payment capture with verification, official receipts by Accounting only, returned cheques, payment links, ageing and reminders, premium warranty monitor, separate instalment invoices, post-dated cheque register (`receipts.test.js`, `collections.test.js`, `credit-control.test.js`, `ops-accounting.test.js`).
- **Taxes and BIR (100%).** One premium tax engine (VAT, DST, LGT, FST), the working papers and now the forms around them: withholding returns laid out with the BIR item numbers and reconciled with the QAP and the ledger, the 1604-E alphalist, the 2551Q, the DAT files, the EOPT sales invoices, the EIS outbox and the CAS books pack (`premium-charges.test.js`, `commission-taxes.test.js`, `bir-forms.test.js`).
- **Quotation and placement (100%).** Motor quotation with the CTPL tariff, covers and risk fields from the Product Configurator with acceptance rules and loadings, insurer comparison on screen and the client comparison report, RFQ, placement slips, co-insurance, cover notes, facultative reinsurance (`quotations.test.js`, `quote-covers-risk-fields.test.js`, `product-rules-in-flow.test.js`, `comparison-reports.test.js`, `placement.test.js`, `facultative-reinsurance.test.js`).
- **Distribution and operations (100%).** Lead assignment and team view, sales activities with My Work follow-ups, distribution channels and dealer programmes, fleet schedules, marine open covers, campaigns to consenting clients, computed cancellations with the short-period scale, claim document checklist, motor repairs and letters of authority, claims settlements in the Accounting menu (`lead-assignment.test.js`, `sales-activities.test.js`, `motor-programmes.test.js`, `fleet-schedules.test.js`, `marine-open-cover.test.js`, `campaigns.test.js`, `ops-accounting.test.js`).

## Remaining weaker areas

- **Client onboarding, KYC and AML (95.5%).** The AMLA programme is in the product end to end (`aml.test.js`, 25 tests). The one point lost is 1.07: the CTR and STR files follow the product's own layout BV-AMLC-TXN 1.0, built after the AMLC reporting guidelines, and the AMLC's confirmation of the codes and field order, with a test file validated in the AMLC portal, is outstanding. The codes are settings, so the confirmation needs no new release.
- **IC and data privacy compliance (94.4%).** The NPC side is complete. The IC side is complete except 14.04: the annual statement is delivered as a working paper (schedules 1 to 4 on configurable IC lines, checks, accountant confirmation sheet) that the accountant transcribes onto the IC form set in force; the system does not print the IC form itself.

## Broker and captive agency

The fit for a captive agency (99.2%) equals the broker fit (99.2%). The agency items that were partial in 1.0 are delivered: the distribution channels master with dealers, dealer branches and financing banks, the dealer programmes with the dealer sales upload and the bank endorsement letters, the dealer production report. Agency bill processing and the commission and remittance flows work for an agency as before.

# What was closed in this release and what remains

## The former gaps and the module that closed each

Version 1.0 ranked 54 gaps (36 processes scored 1, 18 scored 0, 12 of them covered by work then in development). The table lists the fifteen that headed the 1.0 ranking, with the module, migration and test that closed each.

| 1.0 rank | ID | Former gap | Closed by | Score now |
|---|---|---|---|---|
| 1 | 1.05 | Beneficial ownership of juridical clients | `modules/aml/kyc.js`, Onboard client > Add beneficial owner, migration 0260; `aml.test.js` | 2 |
| 2 | 10.09 | Licence check before paying commission | `modules/ic-compliance/licences.js`, `compliance.referrer_licence_check` (block), migration 0270; `ic-compliance.test.js` | 2 |
| 3 | 14.02 | Licence renewal tracking | Compliance > Licence Register with expiry calendar and `compliance-reminders` job, migration 0270; `ic-compliance.test.js` | 2 |
| 4 | 14.08 | Complaints handling (RA 11765) | `modules/ic-compliance/complaints.js`, Compliance > Complaints with deadlines, letters and regulator report, migration 0272; `ic-compliance.test.js` | 2 |
| 5 | 1.04 | Risk-based CDD rating and EDD | `modules/aml/risk.js`, Compliance > Client Due Diligence, EDD Reviews, KYC Refresh, migration 0261; `aml.test.js` | 2 |
| 6 | 1.06 | Sanctions, PEP and negative list screening | `modules/aml/screening.js`, `matching.js`, `providers.js`, Compliance > Screening Lists and Hits, migration 0261; `aml.test.js` | 2 |
| 7 | 1.07 | Transaction monitoring and AMLC report | `modules/aml/monitoring.js`, `cases.js`, `reports.js`, Compliance > Transaction Alerts, AML Cases, AMLC Reports, migration 0262; `aml.test.js` | 1 (layout confirmation) |
| 8 | 14.12 | Masking of personal data by role | `lib/piiPolicy.js` and `lib/pii.js` applied in `app.js`, permission `view:pii`, migration 0276; `personal-data-protection.test.js` | 2 |
| 9 | 13.07 | 0619-E and 1601-EQ returns | `modules/bir/returns.js`, Accounts > Tax > Withholding Returns, migration 0280; `bir-forms.test.js` | 2 |
| 10 | 15.07 | Audit trail screen searchable by user | `modules/audit`, Master > System Configuration > Audit Trail, migration 0247; `audit-events.test.js` | 2 |
| 11 | 13.10 | EOPT invoice (RR 7-2024) | `modules/bir/invoices.js`, Accounts > Tax > Sales Invoices, migration 0281; `bir-forms.test.js` | 2 |
| 12 | 13.11 | CAS registration pack | `modules/bir/cas.js`, Accounts > Tax > CAS Books and Documents, migration 0282; `bir-forms.test.js` | 2 |
| 13 | 14.04 | IC annual statement in the IC format | `modules/ic-compliance/icReports.js`, Compliance > IC Annual Statement, migration 0274; `ic-compliance.test.js` | 1 (working paper) |
| 14 | 5.07 | CTPL authentication with the provider and LTO | `modules/integrations/ctpl.js`, Operations > CTPL Authentication, connectors CTPL_AUTH and LTO_FEED, migration 0312; `integrations.test.js` | 2 |
| 15 | 4.07 | Cover note or binder | `modules/cover-notes`, Operations > Cover Notes, migration 0290; `ops-accounting.test.js` | 2 |

The other 39 gaps of 1.0, by the package that closed them:

| 1.0 package | IDs | Closed by |
|---|---|---|
| Philippine masters, menu, My Work, Product Configurator in the flow, branding (the 12 items then in development) | 1.01, 2.04, 3.03, 3.10, 3.11, 4.08, 15.08, 15.09, 15.11, 15.12 (with 14.12 and 15.07 above) | `modules/addresses` and PSGC seeds (migration 0250, seeds 12_ and 69_); enterprise menu and Help panel; `modules/my-work` (0253); `modules/sales-activities` (0320); `modules/comparison-reports` (0306); `modules/e-signatures` and `modules/branding` (0254); `modules/quotations` with the Product Configurator (0252, 0322); `modules/ic-compliance/insurerAuthority.js` (0271) |
| AML/CFT toolkit | 1.02 (with 1.04 to 1.07 above) | `modules/aml/kyc.js`: juridical clients with signatories and board resolution (0260) |
| IC compliance pack | 14.03, 14.05 (with 10.09, 14.02, 14.04, 14.08 above) | `modules/ic-compliance/fitProper.js`, `icReports.js` production report (0270, 0274) |
| BIR forms pack | 13.04, 13.08, 13.13 (with 13.07, 13.10, 13.11 above) | `modules/bir/returns.js` (2551Q, 1604-E), `dat.js` (0280) |
| Operations quick wins | 6.04, 6.05, 8.09, 8.12, 11.03, 11.06 (with 4.07 above) | `modules/cancellations` and Short-Period Rates (0291), instalment invoices (0293), `modules/pdc` (0292), `modules/claim-documents` and `claim-payments` (0294) |
| Integrations | 7.07, 9.05, 9.09, 13.12 (with 5.07 above) | `modules/integrations/messaging.js` (0311), `bankfiles` (0314), `insurer.js` (0313); `modules/bir/eis.js` (0283) |
| Other partial items of 1.0 | 2.05, 2.07, 2.08, 4.10, 5.08, 5.09, 5.12, 10.10, 11.08, 12.10, 14.11, 14.13, 15.03 | `modules/leads` lead assignment (0300), `modules/channels` (0301), `modules/campaigns` (0307), `modules/reinsurance` facultative (0305), `modules/motor-programmes` (0302), `modules/fleet` (0303), `modules/marine` (0304), `modules/insurer-overrides` (0284), `modules/motor-claims` (0295), `modules/payables` and `modules/fixed-assets` (0296, 0297, 0321), `modules/data-breaches` (0273), field encryption (0277), `modules/report-builder` (0308) |

## What remains

The residual list is short and is of three kinds. None of it is a feature missing from the product; each item is a confirmation or a certification that only a regulator, a partner or the broker's adviser can give. Since 04 October 2026 iorta TechNXT offers the support for each of them as an optional module or partner service of the Rate Card (AMLC reporting file validation and portal test, IC annual statement form alignment, EOPT invoicing review with the broker's tax adviser, BIR CAS registration support, BIR EIS enrolment and certification, CTPL authentication and LTO interface certification, insurer API onboarding per insurer, bank payment file certification per bank, SMS or Viber gateway activation, screening list provider onboarding), priced at man-days times the blended rate with the regulator's or partner's own fees excluded; the availability of these services does not change any score in this assessment.

**Scored 1 (in the fit figures).**

| ID | Item | Why it is 1 | Who closes it |
|---|---|---|---|
| 1.07 | AMLC report file | The CTR and STR files are in the product's own layout BV-AMLC-TXN 1.0, built after the AMLC reporting guidelines. The institution code, transaction codes, ID type codes and field order must be confirmed against the AMLC's current guidelines and a test file validated in the AMLC portal before the first filing. The codes are settings. | The broker's compliance officer with the AMLC; no release needed unless the field order changes |
| 14.04 | IC annual statement | Delivered as a working paper: schedules 1 to 4 from the ledger and production on configurable IC lines, system checks and the accountant confirmation sheet. The accountant transcribes the figures onto the IC form set in force; the official form is not printed by the system. | The broker's accountant; a printed IC form set would be a small enhancement once the form set is confirmed |

**Partner certifications (scored 2; onboarding tasks named in the gap notes).**

| ID | Integration | Delivered | Remains with the partner |
|---|---|---|---|
| 9.05 | Bank payment files | Layouts per bank (starter layouts BDO, BPI, Metrobank, Landbank, UnionBank, generic CSV), batch approval, status file import, Record result fallback | Each bank validates the layout against its current specification and accepts a test file; the starter layouts are marked Test mode until then |
| 7.07 | SMS and Viber | Connectors SMS_SEMAPHORE (test mode), SMS_GLOBE_LABS, SMS_GENERIC, VIBER_BUSINESS; templates with consent check; jobs delivered switched off | Gateway contract, sender name or short code, live credentials |
| 5.07 | CTPL authentication and LTO | Connectors CTPL_AUTH (test mode) and LTO_FEED, COC series, keyed-in code fallback | The accredited provider's acceptance of the live requests; the LTO interface where the provider does not transmit |
| 9.09 | Insurer APIs | Connector INSURER_API (test mode), mapping per insurer, claim status file fallback | Each insurer's API contract, endpoint, credentials and field mapping |
| 13.12 | BIR EIS | Connector with test mode, signed payloads, outbox with retry, export for manual upload | EIS enrolment, final field list and signing certificate, production endpoint and credentials |
| 1.06 | Screening provider | Uploaded lists always screened; test provider; provider API adapter with retry | The commercial provider's contract and API key; the broker loads the UN, AMLC and PEP lists it is entitled to use |

**Regulator and adviser confirmations (scored 2; settings or validation steps).**

- 13.13 DAT files: validate each file with the current BIR validation module before the first submission.
- 13.07 and 13.08: the figures are transferred to eBIRForms or eFPS by the broker; the system does not file.
- 13.10 EOPT invoices: the tax adviser confirms which documents are registered as the broker's invoices, the wording of the supplementary documents and the VAT treatment of each commission stream (settings).
- 13.11 CAS: the registration or acknowledgement with the BIR is filed by the broker with the pack.
- 14.03, 14.05, 14.08: the fit and proper declarations, the IC line set and the complaint deadlines are settings to confirm against the IC rules in force.
- 4.08: the insurer authority check is delivered as warn; the broker enters the certificate numbers of its insurers, then switches it to block.
- 15.12: barangays are loaded per region from the shipped PSGC file by the administrator at go-live.
- 8.06: live payment gateway keys; 15.16: a disaster recovery test has not yet been run.

# ASEAN rollout

## What carries over and what does not

| Accelerators in the code | Inhibitors in the code |
|---|---|
| Integration framework: connectors with provider adapters, credentials by environment variable, test mode, outbox with retry, signed inbox (SMS, Viber, CTPL, LTO, insurer API, bank files) | The BIR layer, larger than in 1.0 and all Philippine-specific: `modules/bir` (0619-E, 1601-EQ, 1604-E, 2551Q, DAT files, EOPT invoices, EIS payload, CAS books) and the BIR reports in `periodEndQueries.js` |
| Bank file layouts configured per bank (delimited or fixed width, status file mapping) | The AMLC report file (`modules/aml/reports.js`) and the IC annual statement and production report (`modules/ic-compliance/icReports.js`) |
| Compliance registers with configurable deadlines, declarations and line sets (licences, fit and proper, complaints, breaches, IC statement mapping) | CTPL authentication and COC series (`modules/integrations/ctpl.js`); motor quotation built around CTPL and the IC vehicle classes |
| AML programme with configurable risk factors, thresholds, uploaded lists and a screening provider adapter | KYC ID defaults, Philippine formats (mobile, TIN, ZIP) and the PSGC address structure |
| Report builder and BI extract; Theme and Branding with brand packs | Business time zone Asia/Manila in 8 backend files; PHP as default currency in document templates |
| i18n framework and language picker (`i18n.js`, `utility/languages.js`); Thai file `th.json` partly translated, withdrawn from the pickers | Premium tax kinds named after Philippine taxes; LGU tax master |
| Base currency and dated exchange rates, FX revaluation (migration 0235); premium tax engine by percent, per unit or flat, by line, regime and date | Payment gateways PayMongo and Dragonpay only |
| Posting rules and account determination; Master > Configuration settings; document numbering; address API country, region, province, city, barangay with postal code lookup; hosting in AWS Singapore (ap-southeast-1) | The EIS outbox is a BIR adapter, not yet a general e-invoicing interface |

## Change needed by country

The change % is the share of the Philippine product that must change for the country, weighted by the Philippine process catalogue. It is split into configuration only, localisation of masters, tax rules and forms, code (regulatory reports, e-invoicing and other integrations, screens) and language. Effort uses 3 person-weeks per point of change, delivered by a team of five; it covers the country version of the product, not a first client implementation. The method is the one of version 1.0; the per-area estimates were recomputed on the 1.1 baseline.

| Rank | Country | Config | Localisation | Code | Language | Change % (range) | Midpoint 1.0 | Effort (calendar weeks) |
|---|---|---|---|---|---|---|---|---|
| 1 | Singapore | 2 | 6 | 13 | 0 | 17 to 25% | 24% | 10 to 15 |
| 2 | Brunei Darussalam | 2 | 12 | 5 | 2 | 16 to 26% | 24% | 10 to 16 |
| 3 | Malaysia | 3 | 9 | 15 | 3 | 24 to 34% | 33% | 14 to 20 |
| 4 | Thailand | 3 | 7 | 18 | 7 | 30 to 40% | 38% | 18 to 24 |
| 5 | Cambodia | 3 | 8 | 18 | 10 | 32 to 46% | 43% | 19 to 28 |
| 6 | Lao PDR | 3 | 9 | 19 | 10 | 32 to 48% | 44% | 19 to 29 |
| 7 | Indonesia | 3 | 7 | 23 | 9 | 36 to 48% | 46% | 22 to 29 |
| 8 | Vietnam | 3 | 7 | 26 | 10 | 40 to 52% | 50% | 24 to 31 |
| 9 | Myanmar | 3 | 8 | 23 | 12 | 38 to 54% | 49% | 23 to 32 (not recommended now) |

Layer columns are points of change on the whole product (midpoint). The heat map of change by L1 area and country is in the workbook, sheet ASEAN Heat Map.

## What changed in the estimate since version 1.0

The per-area shares were revised where the release moved work from code into configuration; the regulatory areas were left high because their Philippine content is replaced in full in a new country.

| L1 area | Revision | Reason |
|---|---|---|
| 5 Policy and motor | Down 5 points per country | CTPL authentication is a connector adapter; a country's compulsory motor scheme replaces the adapter and the tariff, not the screen |
| 8 Billing and receipts | Down 5 to 10 points | Bank payment files are layouts configured per bank, no longer code; payment gateways remain code |
| 9 Remittance | Down 5 points | Insurer API is a connector with a mapping per insurer |
| 13 Taxes | Down 5 points where e-invoicing exists | The EIS outbox pattern (signed payloads, retry, manual fallback) is reusable; the BIR forms, DAT files and CAS books themselves are replaced in full |
| 14 Regulator and privacy | Down 15 points | Licence, fit and proper, complaints and breach registers with configurable deadlines and declarations and the IC statement line mapping carry over; the regulator reports are still rewritten |
| 15 Reporting and administration | Down 5 to 10 points | Report builder, branding and brand packs, integration framework, menu and Help panel are configuration |
| 1 to 4, 6, 7, 10 to 12 | Unchanged | The AML programme is configuration except its report file; the other areas were already configurable or already Philippine-specific in the same measure |

The ranking is unchanged. Singapore and Brunei remain the lowest change, Vietnam the highest of the recommended markets.

## Country notes

### Singapore

- Regulator and regime: MAS; insurance brokers registered under the Insurance Act, with insurance broking premium accounts for client money.
- Tax: GST 9% on general premium and on brokerage (marine and international zero-rating to verify); no stamp duty on policies; no withholding on resident commission. E-invoicing: InvoiceNow (Peppol) being phased in (timing for brokers to verify).
- Language English; currency SGD; PDPA 2012 with the Do Not Call registry; no data localisation, and the current hosting region is Singapore.
- Motor: compulsory third-party cover priced freely by insurers, filed by the insurer with LTA; no CTPL tariff.
- Main changes: replace the BIR layer with GST and a GST F5 working paper; remove DST, LGT, FST and CTPL; MAS broker returns; InvoiceNow adapter on the e-invoicing outbox; NRIC, FIN and UEN; postal codes.

### Brunei Darussalam

- Regulator BDCB; Insurance Order 2006 and Takaful Order 2008; few brokers.
- No VAT or GST and no personal income tax: most of the change is removing the Philippine tax layer. Stamp duty on policies to verify.
- Malay and English; BND pegged to SGD; Personal Data Protection Order 2025 in transition (dates to verify).
- Main changes: takaful variant, BDCB returns, PDPO alignment. Low change but a very small market.

### Malaysia

- Regulator BNM; insurance and takaful brokers approved under the Financial Services Act 2013 and the Islamic Financial Services Act 2013.
- Tax: service tax on general premium and brokerage (rate after March 2024 to verify for insurance); stamp duty RM10 per policy; withholding under s.107D on agent commission and CP58 statements.
- E-invoicing: LHDN MyInvois, mandatory in phases since August 2024, needs an adapter on the e-invoicing outbox.
- Bahasa Malaysia optional (English common); MYR; PDPA 2010 as amended in 2024 (DPO, breach notification).
- Motor: compulsory third-party under the Road Transport Act 1987, liberalised tariffs, e-cover notes to JPJ through insurers, NCD.
- Main changes: SST and stamp duty rules, MyInvois adapter, takaful variant, s.107D and CP58, BNM returns, motor NCD and JPJ fields.

### Thailand

- Regulator OIC; non-life broker licences under the Non-Life Insurance Act B.E. 2535.
- Tax: VAT 7% on non-life premium and brokerage; stamp duty about 0.4% of premium; withholding 3% on service fees (PND 3, PND 53) with 50 Tawi certificates; tax invoices in Thai.
- Thai script UI and documents; Buddhist Era dates; THB; PDPA B.E. 2562 in force since 2022.
- Motor: compulsory motor insurance (Por Ror Bor) at an OIC tariff per vehicle type, which maps closely to the CTPL tariff model, plus voluntary classes 1, 2, 3, 2+ and 3+.
- Main changes: complete and re-enable the Thai translation and Thai PDF fonts; Por Ror Bor tariff from the CTPL model; VAT and stamp duty; 50 Tawi and PND forms; OIC reports.

### Cambodia

- Regulator IRC; brokers licensed under the Law on Insurance 2014.
- Tax on gross premium and the VAT treatment of non-life premium to verify; withholding on services; CamInvoice e-invoicing phased from 2025 (to verify).
- Khmer script for documents and invoices; USD and KHR used side by side; no comprehensive data protection law in force yet (to verify).
- Main changes: dual currency billing, Khmer documents and UI, tax rules, e-invoicing adapter, IRC reports.

### Lao PDR

- Ministry of Finance supervision; very few brokers (to verify).
- VAT 10%; Lao script; LAK with USD and THB in use; Law on Electronic Data Protection 2017.
- Main changes: as Cambodia, with a smaller market. Proceed only with a partner and a signed client.

### Indonesia

- Regulator OJK; insurance, reinsurance and sharia brokers licensed by OJK.
- Tax: premium outside the VAT scope; VAT on brokerage (effective rate to verify); stamp duty Rp10,000; withholding PPh 23 and PPh 21. E-Faktur through Coretax (since January 2025) and e-Bupot are mandatory.
- Bahasa Indonesia required for policies, invoices and UI; IDR without decimals in practice; PDP Law 27/2022; data centre in Indonesia may be required (to verify).
- Motor and property: OJK reference rate bands; Jasa Raharja is collected with vehicle registration, outside brokers.
- Main changes: Coretax and e-Bupot integration, OJK reports, Bahasa UI and documents, OJK rate bands in rating, sharia variant, hosting in Indonesia.

### Vietnam

- Regulator Ministry of Finance (Insurance Supervisory Authority); Law on Insurance Business 2022 and Decree 46/2023.
- Tax: VAT 10% on non-life premium and brokerage (some lines exempt); e-invoices with tax authority codes mandatory since July 2022.
- Vietnamese for UI, documents and books; VND without decimals; Personal Data Protection Law effective 1 January 2026.
- Accounting: Vietnamese Accounting Standards with a prescribed chart of accounts and statutory books.
- Main changes: e-invoice adapter with tax authority code, statutory chart of accounts and books, Vietnamese language, Ministry of Finance motor tariff and reports.

### Myanmar

Insurance Law 2019 provides for intermediaries, but broker licensing practice, the tax treatment of insurance and the political and sanctions situation since 2021 make a rollout inadvisable now. Burmese (Unicode) script, MMK and sanctions screening would be needed.

### Timor-Leste

Timor-Leste joined ASEAN in October 2025. It is not scored: the insurance market supervised by the Banco Central de Timor-Leste is very small, the currency is USD and the languages are Tetum and Portuguese. Treat it as Lao PDR or higher if a prospect appears (to verify with a local partner).

## Recommended sequence

Ranking by change alone puts Singapore and Brunei first. Taking market size into account as well:

1. **Singapore** first: lowest change, English, current hosting region, a regional broker hub. The GST and InvoiceNow work is reusable for other GST and Peppol markets.
2. **Malaysia** second: moderate change, a sizeable broker market, English widely used; MyInvois is the main build item. The takaful variant also serves Brunei and Indonesia.
3. **Thailand** third: the CTPL tariff model maps to Por Ror Bor and a Thai translation already exists in part; the Thai tax forms and OIC reports are the main build.
4. **Indonesia and Vietnam** as larger programmes, each with a local partner, after the e-invoicing pattern is proven in Malaysia.
5. **Brunei**, **Cambodia** and **Lao PDR** on demand, with a signed client. **Myanmar** not now.

## Common work for every country

Some work is needed once, before the first country, and lowers the cost of each one after it:

- Move the business time zone, default currency and Philippine formats from code into settings.
- Make the tax forms a pluggable layer (one module per country, on the pattern of `modules/bir`) instead of the BIR reports in the general report queries.
- Generalise the motor tariff from CTPL to "compulsory motor tariff per vehicle class", and the COC authentication connector to "compulsory cover registration".
- Generalise the EIS outbox into an e-invoicing connector interface on the integration framework, then one adapter per country.
- Make the regulator reports (AMLC file, IC statement and production report) one module per country, on the pattern of the configurable IC line mapping.
- Complete the language workflow: translation files for every screen and the printed documents, with fonts for Thai, Khmer, Lao, Burmese and Vietnamese.

These items are included in the country percentages above. Done once as a platform step, they would take about a third of the code layer off each later country (estimate).

# Assumptions and limits

- The Philippine scores are evidence-based and can be checked line by line in the workbook: each process names its screen path, module, migration and test file. The weights reflect the judgement of a Philippine broker practitioner and can be changed in the workbook builder; the totals follow.
- Country facts are general knowledge of each regime as of the assessment date. Items marked "to verify" must be confirmed with local counsel or a partner before any commitment. Percentages are ranges for that reason.
- Effort is indicative: 3 person-weeks per point of change, a team of five, excluding the first client implementation, sales and partner set-up.
- This document is not legal or tax advice.

# Method and sources

- The figures in this document are printed by the workbook builder from its catalogue of 150 processes. Each process was scored against the code on branch `brokerverse-platform` as of 04 October 2026: the module under `backend/src/modules`, the migration under `backend/src/db/migrations`, the test under `backend/test`, the menu entry in `brokerverse/src/components/SideBar/list.js` and the screen description in the User Manual. A process scores 2 only when all of these show it delivered end to end.
- The ASEAN estimates are judgements per L1 area and country, weighted by the L1 weights of the same catalogue, as in version 1.0; the revisions since 1.0 are listed above with their reasons.
- Sources in the repository: `backend/src/modules` (73 modules), `backend/src/db/migrations` (to 0331), `backend/test` (104 test files), `backend/scripts/uat-scenario.js` with `docs/e2e/UAT_SCENARIO_RUN.md` (433 steps passed), `docs/e2e/GOLIVE_REHEARSAL_RUN.md` (52 checks passed), `brokerverse/src/components/SideBar/list.js` and `utils/menuPermissions.js`, `brokerverse/src/locales`, and the User Manual, Regulatory Compliance Matrix, Product Functionality and Test Summary documents of this pack.

## Rebuilding the figures

The catalogue, the scores and the country estimates are kept in one script, which writes the workbook and prints the headline figures:

```
cd docs/package/tools
python3 build_fit_assessment_xlsx.py
```

When a score changes, run the script and update this document from its output.
