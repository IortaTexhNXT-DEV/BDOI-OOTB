---
title: Philippine Fit and ASEAN Rollout Assessment
subtitle: iNXT BrokerVerse OOTB (INTERNAL)
version: 1.0
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Initial issue for the product owner
open_item: Country facts marked "to verify" are to be confirmed with local counsel or a partner
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; NPC=National Privacy Commission; AMLC=Anti-Money Laundering Council; AMLA=Anti-Money Laundering Act; KYC=Know your customer; CDD=Customer due diligence; EDD=Enhanced due diligence; PEP=Politically exposed person; CTPL=Compulsory Third Party Liability; LTO=Land Transportation Office; PSGC=Philippine Standard Geographic Code; EOPT=Ease of Paying Taxes Act (RA 11976); RR=Revenue Regulations; CAS=Computerized Accounting System; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; VAT=Value-added tax; GST=Goods and services tax; SST=Sales and service tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; EIS=Electronic Invoicing System; RFQ=Request for quotation; L1=Level 1 process area; L2=Level 2 process; UI=User interface; MAS=Monetary Authority of Singapore; BNM=Bank Negara Malaysia; OIC=Office of Insurance Commission (Thailand); OJK=Otoritas Jasa Keuangan (Indonesia); BDCB=Brunei Darussalam Central Bank; IRC=Insurance Regulator of Cambodia; PDPA=Personal Data Protection Act
---

# Summary for the product owner

This assessment answers three questions about BrokerVerse OOTB as it is on 04 October 2026: how well it fits the practice of a Philippine non-life broker, where it is strongest and where it should improve, and how much it would have to change for the other ASEAN countries. The figures come from a catalogue of 150 business processes scored against the code, the tests and the UAT run. Every score, with its evidence, is in the companion workbook **BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment.xlsx**.

> Work in development is not counted. The menu redesign, the reworked audit trail screen, the Philippine masters (Province in place of State, PSGC geography, Philippine banks, IDs and salutations, the IC list of non-life insurers), My Work, the Product Configurator connections, branding and e-signature, masking and the comparison report are scored as they are today.

## The answers

| Question | Answer today |
|---|---|
| Overall Philippine process fit | **80%** (weighted, 150 L2 processes in 15 areas) |
| Operational process fit | **85%** (101 processes) |
| Regulatory compliance fit (IC, BIR, NPC, AMLC) | **71%** (49 processes) |
| Broker practice / captive agency practice | 81% / 80% |
| Fit once the work in development lands | 84% (12 processes move up) |
| Strongest areas | Accounting and period end 96%, renewals 92%, quotation 90%, billing and receipts 89%, commission 88% |
| Weakest areas | Client onboarding, KYC and AML 52%, IC and data privacy compliance 59%, prospecting 65%, BIR compliance 74% |
| ASEAN, low change | Singapore and Brunei about 24% change, Malaysia about 33% |
| ASEAN, high change | Thailand about 38%, Cambodia and Lao PDR about 43 to 44%, Indonesia about 46%, Vietnam about 50%; Myanmar not recommended now |

## What this means

BrokerVerse covers the money side of a Philippine broker almost completely: billing, receipts, collections, remittance to insurers, direct bill, commission, the general ledger, bank and insurer reconciliation and the month-end close all run end to end and are tested. The sales and placement chain (quotation, RFQ, placement slips, co-insurance, policy issue, endorsements, renewals, claims) is also strong.

The fit drops in the compliance programmes that sit around the transactions: anti-money laundering (no risk rating, beneficial owners, sanctions screening or AMLC reporting), IC licensing and complaints, the BIR forms beyond the working papers (0619-E, 1601-EQ, 1604-E, DAT files) and the EOPT invoice. These gaps are mostly small or medium pieces of work; none needs a change to the core design.

For ASEAN, the configurable parts of the product (tax engine, currencies, posting rules, settings, number series, address structure, i18n framework) carry over. What does not carry over is the Philippine regulatory layer: the BIR forms, CTPL, the premium taxes and the IC conventions. Each country needs that layer rebuilt for its own tax, e-invoicing and regulator, plus a language pack outside the English-speaking markets.

# Scope, baseline and method

## Baseline

- Code on branch `brokerverse-platform` as of 04 October 2026: 46 backend modules, the database migrations, 79 backend test files, the menu (`brokerverse/src/components/SideBar/list.js`), the UAT scenario (`backend/scripts/uat-scenario.js`, 371 steps passed) and the go-live rehearsal (51 checks passed).
- Documents used as evidence: the Philippine Regulatory Compliance Matrix, the Product Functionality document, the Test Summary Report and the User Manual.
- Only what runs end to end counts. A screen that exists but does not complete the process, or a feature in development, gets no credit.

## Process catalogue

The catalogue describes the work of a Philippine non-life broker, and of a captive agency (for example the insurance agency of a motor distributor), in 15 L1 areas and 150 L2 processes. Each L2 is marked with whom it applies to (broker, agent or both) and its type: operational, or a regulatory item of the IC, BIR, NPC or AMLC.

| Field | Meaning |
|---|---|
| Weight | 3 core to daily operation or a legal obligation; 2 important; 1 useful or occasional |
| Score | 2 supported out of the box end to end; 1 partly supported, workaround or configuration not yet present; 0 not supported |
| Evidence | Screen path from the menu, setting, API route, test file or UAT phase |
| Gap note | What is missing, and whether work in development covers it |

## Calculation

- Fit % of an L1 area = sum of (weight x score) / sum of (weight x 2).
- Overall fit uses all 150 processes; regulatory fit the 49 processes typed IC, BIR, NPC or AMLC; operational fit the other 101.
- Gap impact = weight x (2 - score), times 1.5 for a regulatory item. Ties go to the smaller effort first.
- Effort sizes: S up to 2 weeks, M 2 to 6 weeks, L more than 6 weeks for one team, from design to test.

# Philippine process fit

## Fit by process area

| # | L1 process area | Fit | L2 (2 / 1 / 0) |
|---|---|---|---|
| 1 | Client onboarding, KYC and AML | 52% | 10 (4 / 2 / 4) |
| 2 | Prospecting and sales pipeline | 65% | 7 (3 / 3 / 1) |
| 3 | Quotation and insurer comparison | 90% | 11 (8 / 3 / 0) |
| 4 | RFQ, placement, co-insurance and reinsurance | 85% | 10 (7 / 2 / 1) |
| 5 | Policy issuance, documents and motor (CTPL, LTO) | 83% | 11 (7 / 3 / 1) |
| 6 | Endorsements and cancellations | 82% | 8 (6 / 1 / 1) |
| 7 | Renewals and retention | 92% | 6 (5 / 0 / 1) |
| 8 | Billing, collection, credit control and receipts | 89% | 12 (10 / 1 / 1) |
| 9 | Remittance, direct bill and insurer reconciliation | 83% | 8 (6 / 0 / 2) |
| 10 | Commission, referrers and incentives | 88% | 9 (7 / 1 / 1) |
| 11 | Claims assistance | 84% | 8 (5 / 3 / 0) |
| 12 | Accounting, general ledger, period end and audit | 96% | 10 (9 / 1 / 0) |
| 13 | Taxes and BIR compliance | 74% | 13 (6 / 6 / 1) |
| 14 | Insurance Commission and Data Privacy compliance | 59% | 13 (5 / 4 / 4) |
| 15 | Reporting, administration, security and go-live | 84% | 14 (8 / 6 / 0) |
| | **Overall** | **80%** | **150 (96 / 36 / 18)** |

## Regulatory fit by authority

| Authority | Fit | Strong | Weak |
|---|---|---|---|
| BIR | 81% | Premium taxes, VAT Summary, Form 2307 issued and received, SAWT, QAP, SLSP, withholding on commission | 0619-E, 1601-EQ and 1604-E layouts, DAT files, EOPT invoice, CAS pack, EIS |
| NPC (Data Privacy Act) | 78% | Consent register, data subject requests, export, anonymisation, retention, access control, two-step verification | Masking (in development), audit trail screen (in development), breach register, field encryption |
| IC | 68% | Premium payment warranty, remittance terms, premium held for insurers, CTPL tariff, records of business | Licence tracking, complaints, IC-format reports, CTPL authentication, insurer authority check |
| AMLC (AMLA) | 36% | Government ID capture, record retention | Risk rating and EDD, beneficial owners, sanctions and PEP screening, covered and suspicious transaction reporting |

## Strongest areas

- **Accounting and period end (96%).** Every business event posts a balanced journal through posting rules; journal, correction and reversal vouchers with approval; bank statement import with six matching rules; month-end and year-end close with checklist and approval; financial statements. Tested in `accounting-flow.test.js`, `period-end.test.js`, `bank-reconciliation.test.js` and the UAT month-end phase.
- **Renewals (92%).** Pipeline 90 days before expiry, notices at 60, 30 and 15 days, renewal batch, negotiation, at-risk scoring and lapse management (`renewals.test.js`). Only SMS reminders are missing.
- **Quotation (90%).** Motor quotation with CTPL tariff, server-side pricing with VAT, DST, LGT and FST from one tax engine, online client approval, discount from commission, comparison of insurers (`quotations.test.js`, `premium-charges.test.js`, `money-single-source.test.js`).
- **Billing, collection and receipts (89%).** Bills, payment capture with verification, official receipts by Accounting only, returned cheques, payment links, ageing and reminders, premium warranty monitor (`receipts.test.js`, `collections.test.js`, `credit-control.test.js`).
- **Commission (88%) and remittance (83%).** Commission rate matrix, referrer chain payable on full collection with withholding by payee type, remittance per insurer net of commission and by co-insurer share, direct bill debit notes with VAT and EWT, insurer statement reconciliation.

## Where the fit is lower

- **Client onboarding, KYC and AML (52%).** Identification is captured, but the AMLA programme has no system support: no customer risk rating, no beneficial owners, no sanctions or PEP screening, no transaction monitoring or AMLC report.
- **IC and data privacy compliance (59%).** Privacy rights and consent are well covered. The IC side lacks licence tracking for the firm, its officers and its referrers, a complaints register under the Financial Consumer Protection Act, and reports in the IC's format. Masking is in development.
- **Prospecting (65%).** Leads, statuses and the funnel work; account executives cannot log calls, meetings or follow-up tasks (My Work is in development), and there is no dealer or bank channel structure for a captive agency.
- **BIR compliance (74%).** The working papers are there; the forms around them (0619-E, 1601-EQ, 1604-E), the BIR validation files and the EOPT invoice definition are not.

## Broker and captive agency

The fit for a captive agency (80%) is close to the broker fit (81%). An agency does not need the market placement processes, where BrokerVerse is strong, and needs dealer and financing-bank programmes for brand-new vehicles, where it is partial (no dealer master, no bank endorsement letters, no bulk dealer upload). Agency bill processing and the commission and remittance flows work for an agency as they are.

# Room to improve today

## Top 10 gaps

| Rank | ID | Gap | Type | Effort | Note |
|---|---|---|---|---|---|
| 1 | 1.05 | Beneficial ownership of juridical clients | AMLC | S | No beneficial owner capture |
| 2 | 10.09 | Licence check of agents and sub-agents before paying commission | IC | S | No licence number or expiry on referrer accounts |
| 3 | 14.02 | Licence renewal tracking of the firm and licensed individuals | IC | S | No licence calendar |
| 4 | 14.08 | Complaints handling (RA 11765) | IC | S | No complaints register or response time tracking |
| 5 | 1.04 | Risk-based CDD rating and EDD | AMLC | M | No risk rating, EDD or KYC refresh |
| 6 | 1.06 | Sanctions, PEP and negative list screening | AMLC | M | Needs a list provider or upload of lists |
| 7 | 1.07 | Covered and suspicious transaction monitoring, AMLC report | AMLC | M | Only transaction data today |
| 8 | 14.12 | Masking of personal data by role | NPC | M | In development |
| 9 | 13.07 | 0619-E and 1601-EQ return figures with QAP | BIR | S | QAP delivered; return layout missing |
| 10 | 15.07 | Audit trail screen with search by users | NPC | S | Audit log delivered; screen in development |

The next five are the EOPT invoice under RR 7-2024 (M), the CAS registration pack (M), the IC annual statement in the IC's format (M), CTPL authentication with the IC-accredited provider and the LTO (L, integration) and a cover note or binder (S). The full ranked list of 54 gaps is in the workbook, sheet Gaps Ranked.

## Improvement packages

The gaps group into six packages. The fit gain is the rise in overall fit when the package is complete.

| Package | Gaps | Effort | Fit gain |
|---|---|---|---|
| AML/CFT toolkit: risk rating and EDD, beneficial owners, authorised signatories, screening, covered and suspicious transaction report | 1.02, 1.04 to 1.07 | L (8 to 12 weeks; screening list source to decide) | 2.7 points; AMLC fit from 36% to 100% |
| IC compliance pack: licence register for firm, officers and referrers with payout block, complaints register, fit and proper record, IC-format annual statement and production report | 10.09, 14.02 to 14.05, 14.08 | M (6 to 8 weeks) | 2.8 points |
| BIR forms pack: 0619-E and 1601-EQ, 1604-E, DAT files, percentage tax, EOPT invoice definition, CAS output pack | 13.04, 13.07, 13.08, 13.10, 13.11, 13.13 | M (6 to 8 weeks with tax adviser review) | 2.1 points |
| Operations quick wins: cover note, short-period and pro-rata cancellation, post-dated cheques, instalment invoices, claim document checklist, claims cash in the Accounting menu | 4.07, 6.04, 6.05, 8.09, 8.12, 11.03, 11.06 | M (5 to 7 weeks in total, each item S) | 3.1 points |
| Work in development (deliver and count) | 12 items | In progress | 4.0 points (to 84%) |
| Integrations: bank payment files, SMS, CTPL authentication and LTO, BIR EIS, insurer APIs | 5.07, 7.07, 9.05, 9.09, 13.12 | L each, partner dependent | 1.9 points |

With the first four packages and the work in development, the overall fit reaches 95% and the regulatory fit 97%. Most of the remaining points are integrations that depend on third parties (97% with the integrations package).

> Effort sizes are indicative and assume one team that knows the code. They are for planning, not quotation.

# ASEAN rollout

## What carries over and what does not

| Accelerators in the code | Inhibitors in the code |
|---|---|
| i18n framework and language picker (`i18n.js`, `utility/languages.js`); Thai file `th.json` with 4,675 of 7,917 keys in Thai, withdrawn from the pickers | BIR reports and the Form 2307 layout are Philippine-specific |
| Base currency and dated exchange rates, FX revaluation (migration 0235) | Motor quotation built around CTPL and the IC vehicle classes |
| Premium tax engine: rule kinds vat, premium_tax, dst, fst, lgt and other, by percent, per unit or flat, by line, regime and date | Premium tax kinds named after Philippine taxes; LGU tax master |
| Posting rules and account determination: the chart of accounts can be replaced | Business time zone Asia/Manila in 9 backend files |
| Master > Configuration settings, 61 number series, approvals and authority matrix | PHP as default currency in document templates |
| Address API country, province, city, district with postal code lookup | KYC ID list and Philippine formats (mobile, TIN, ZIP) |
| Payment gateway providers, bank and insurer statement formats | Payment gateways PayMongo and Dragonpay only |
| Hosting already in AWS Singapore (ap-southeast-1) | No e-invoicing connector of any kind yet |

## Change needed by country

The change % is the share of the Philippine product that must change for the country, weighted by the Philippine process catalogue. It is split into configuration only, localisation of masters, tax rules and forms, code (regulatory reports, e-invoicing and other integrations, screens) and language. Effort uses 3 person-weeks per point of change, delivered by a team of five; it covers the country version of the product, not a first client implementation.

| Rank | Country | Config | Localisation | Code | Language | Change % (range) | Effort (calendar weeks) |
|---|---|---|---|---|---|---|---|
| 1 | Singapore | 3 | 6 | 15 | 0 | 20 to 28% | 12 to 17 |
| 2 | Brunei Darussalam | 3 | 12 | 7 | 2 | 19 to 29% | 11 to 17 |
| 3 | Malaysia | 3 | 9 | 18 | 3 | 28 to 38% | 17 to 23 |
| 4 | Thailand | 4 | 7 | 21 | 7 | 33 to 43% | 20 to 26 |
| 5 | Cambodia | 3 | 10 | 21 | 10 | 36 to 50% | 22 to 30 |
| 6 | Lao PDR | 3 | 10 | 21 | 10 | 36 to 52% | 22 to 31 |
| 7 | Indonesia | 3 | 8 | 26 | 9 | 40 to 52% | 24 to 31 |
| 8 | Vietnam | 3 | 8 | 29 | 10 | 44 to 56% | 26 to 34 |
| 9 | Myanmar | 3 | 9 | 25 | 12 | 41 to 57% | 25 to 34 (not recommended now) |

Layer columns are points of change on the whole product (midpoint). The heat map of change by L1 area and country is in the workbook, sheet ASEAN Heat Map.

## Country notes

### Singapore

- Regulator and regime: MAS; insurance brokers registered under the Insurance Act, with insurance broking premium accounts for client money.
- Tax: GST 9% on general premium and on brokerage (marine and international zero-rating to verify); no stamp duty on policies; no withholding on resident commission. E-invoicing: InvoiceNow (Peppol) being phased in (timing for brokers to verify).
- Language English; currency SGD; PDPA 2012 with the Do Not Call registry; no data localisation, and the current hosting region is Singapore.
- Motor: compulsory third-party cover priced freely by insurers, filed by the insurer with LTA; no CTPL tariff.
- Main changes: replace the BIR layer with GST and a GST F5 working paper; remove DST, LGT, FST and CTPL; MAS broker returns; InvoiceNow connector; NRIC, FIN and UEN; postal codes.

### Brunei Darussalam

- Regulator BDCB; Insurance Order 2006 and Takaful Order 2008; few brokers.
- No VAT or GST and no personal income tax: most of the change is removing the Philippine tax layer. Stamp duty on policies to verify.
- Malay and English; BND pegged to SGD; Personal Data Protection Order 2025 in transition (dates to verify).
- Main changes: takaful variant, BDCB returns, PDPO alignment. Low change but a very small market.

### Malaysia

- Regulator BNM; insurance and takaful brokers approved under the Financial Services Act 2013 and the Islamic Financial Services Act 2013.
- Tax: service tax on general premium and brokerage (rate after March 2024 to verify for insurance); stamp duty RM10 per policy; withholding under s.107D on agent commission and CP58 statements.
- E-invoicing: LHDN MyInvois, mandatory in phases since August 2024, needs an API connector.
- Bahasa Malaysia optional (English common); MYR; PDPA 2010 as amended in 2024 (DPO, breach notification).
- Motor: compulsory third-party under the Road Transport Act 1987, liberalised tariffs, e-cover notes to JPJ through insurers, NCD.
- Main changes: SST and stamp duty rules, MyInvois connector, takaful variant, s.107D and CP58, BNM returns, motor NCD and JPJ fields.

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
- Main changes: dual currency billing, Khmer documents and UI, tax rules, e-invoicing connector, IRC reports.

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
- Main changes: e-invoice connector, statutory chart of accounts and books, Vietnamese language, Ministry of Finance motor tariff and reports.

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
- Make the tax forms a pluggable layer (one module per country) instead of the BIR reports in the general report queries.
- Generalise the motor tariff from CTPL to "compulsory motor tariff per vehicle class".
- Add an e-invoicing connector interface, then one adapter per country.
- Complete the language workflow: translation files for every screen and the printed documents, with fonts for Thai, Khmer, Lao, Burmese and Vietnamese.

These items are included in the country percentages above. Done once as a platform step, they would take about a third of the code layer off each later country (estimate).

# Assumptions and limits

- The Philippine scores are evidence-based and can be checked line by line in the workbook. The weights reflect the judgement of a Philippine broker practitioner and can be changed in the workbook builder; the totals follow.
- Country facts are general knowledge of each regime as of the assessment date. Items marked "to verify" must be confirmed with local counsel or a partner before any commitment. Percentages are ranges for that reason.
- Effort is indicative: 3 person-weeks per point of change, a team of five, excluding the first client implementation, sales and partner set-up.
- This document is not legal or tax advice.

## Rebuilding the figures

The catalogue, the scores and the country estimates are kept in one script, which writes the workbook and prints the headline figures:

```
cd docs/package/tools
python3 build_fit_assessment_xlsx.py
```

When a score changes, run the script and update this document from its output.
