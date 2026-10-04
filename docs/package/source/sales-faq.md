---
title: FAQ and Objection Handling
subtitle: iNXT BrokerVerse OOTB
version: 1.1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed: To be completed
approved: To be completed
change: Version 1.1.1: release figures aligned with the release verification of 04 October 2026 (test cases, automated tests, UAT cycle, go-live rehearsal). Version 1.1: answers updated for AML/CFT, the IC and NPC compliance registers, BIR forms and EOPT invoices, integrations, dealer programmes, branding, My Work and the Report Builder; known limits revised
acronyms: AMC=Annual Maintenance Contract; AMLA=Anti-Money Laundering Act; AMLC=Anti-Money Laundering Council; CTR=Covered transaction report; STR=Suspicious transaction report; EDD=Enhanced due diligence; PEP=Politically exposed person; EIS=Electronic Invoicing System; CTPL=Compulsory third party liability; COC=Certificate of cover; LTO=Land Transportation Office; SMS=Short message service; API=Application programming interface; BIR=Bureau of Internal Revenue; CAS=Computerized Accounting System; CR=Change request; DPA=Data Privacy Act of 2012; DPO=Data protection officer; EOPT=Ease of Paying Taxes Act; EWT=Expanded withholding tax; IC=Insurance Commission; NPC=National Privacy Commission; OOTB=Out of the box; SoD=Segregation of duties; Dev=Development environment; Pre-Prod=Pre-production environment; SIT=System integration test; UAT=User acceptance test; VAT=Value-added tax
---

# How to use this document

## Purpose

This document gives the iorta TechNXT sales team the answers to the questions Philippine non-life brokers ask about iNXT BrokerVerse OOTB, and a tested way to handle the objections that come up between the first meeting and the contract. Every answer is based on the product as delivered, its documentation package and the pricing workbook.

## Rules for the sales team

- Answer the question that was asked, then give one proof: a screen, a report, a setting or a document.
- Never promise a feature, an integration or a date that is not in this document. Say "we will confirm in writing" and log the question.
- Say plainly what the OOTB version does not do. The known limits are in chapter 11. A prospect who finds a limit after signing is a lost reference.
- Quote prices only from the pricing workbook or the commercial models slide. Prices exclude 12% VAT and are valid 90 days.
- Items marked [to confirm] need an approved answer from iorta TechNXT management before they are used with a prospect.

# Product and scope

## What is iNXT BrokerVerse OOTB?

The out-of-the-box version of the iNXT BrokerVerse insurance broking platform, configured for Philippine non-life brokers. It covers prospects, quotations, placement with insurers, policy issue, cover notes, endorsements, cancellations, claims, renewals, billing, official receipts and sales invoices, collections and credit control, remittance to insurers, direct bill, commission and incentives, reinsurance, the general ledger, bank and insurer reconciliation, accounts payable and fixed assets, the month-end and year-end close, BIR forms and returns, anti-money laundering, the Insurance Commission and privacy registers, integrations with SMS gateways, the CTPL authentication provider, insurers and banks, dealer programmes, fleets and open covers, My Work, the Report Builder, reports and dashboards, and the broker's own branding. "OOTB" means it is delivered as it is and fitted to the broker by configuration; changes to the product are change requests.

## Which lines of business does it support?

The product is built for non-life broking. The test data set covers motor, CTPL, personal accident, travel, householder, fire, industrial all risks, contractor's all risks, erection all risks, marine, commercial general liability (CGL), money, employee benefits and surety bond. Each line is set up in the Product Configurator and the masters (products, covers, rating, taxes, document templates, insurer commission rates). The placement journey of each line is configurable: for example, motor goes from quotation straight to policy, while fire, IAR, marine, casualty and engineering need a Placement Slip confirmed by every insurer.

## Does it handle co-insurance?

Yes. A Placement Slip or a policy can have several insurers with one lead. Shares must total exactly 100%. Premium, taxes, commission, the remittance to each insurer, claim recoveries and the reports (Co-insurance Register, Due to Insurers by Co-insurer) follow the shares, and the rounding remainder goes to the lead.

## Does it handle direct bill as well as broker billed?

Yes. The billing mode is chosen at issue and defaults from the insurer. For direct bill, no premium bill is raised; the broker bills its commission plus 12% VAT to the insurer on a commission debit note, records the insurer's payment net of 10% EWT, and the Form 2307 received goes to the SAWT.

## Do referrers and sub-agents need a login?

No. Referrers do not sign in. Sales & Marketing enter their business, and they are paid from the referrer master by payment voucher, net of EWT, once the premium is fully collected. This keeps the user count, and the licence cost, to the broker's own staff.

## Which roles are delivered?

Eight: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager and Compliance Officer (AML/CFT). Each has its own menus, landing page and server-side permissions. Roles can be adjusted in Master > Generals > User Management. Every user also has Operations > My Work: the items waiting for them by category, their team's items for a manager, their tasks with reminders and a calendar.

## Can clients approve quotations or pay online?

Yes. A quotation can be sent for customer approval: the client receives a signed link valid for 168 hours and approves without signing in. Payment links work through PayMongo or Dragonpay (a sandbox provider is used for training and UAT); a paid link creates the official receipt. The broker needs its own merchant account with the gateway before going live.

## Does the client receive documents by e-mail?

Yes, new in this release. E-mail receipt (on the receipt) and E-mail invoice (on the collection) send the official receipt or the premium invoice as a PDF attachment, with To, Cc and a note. The broker can also switch on automatic sending when a receipt is recorded or a bill is issued (off in the delivered set-up). The commission debit note e-mail to insurers carries the debit note PDF, and the policy issued e-mail carries the policy schedule. E-mails need the broker's SMTP mailbox (for example Office 365) and the "Send e-mails" switch.

## What reports come with the product?

The catalogue reports in Reports > All Reports, grouped as production and placement, claims and renewals, insurers and commission, receivables and cash, ledger and period end, BIR tax and bank, plus Dealer Production. Each runs on screen with totals and downloads as Excel, CSV or PDF on the broker's letterhead. The Report Builder answers ad hoc questions over curated datasets (policies, clients, bills, claims, commissions) without programming, with saved and shared reports and export to Excel; a nightly BI extract writes the same datasets as CSV files for a BI tool. There are also Executive, Sales, Processing, Claims and Commission dashboards. The Reports Book describes every report.

## Can it carry our brand?

Yes. The System Administrator sets the theme (colours, header and side bar style, font, density), the logo, the sign-in page picture and texts, the branding of printed documents, report files and e-mails on Master > System Settings > Theme and Branding, with a contrast check before saving. Signatories and approvers capture an e-signature once; it is mapped to the documents it signs (policy schedule, official receipt, payment voucher and others) and prints only once the document is issued or approved. A brand pack file moves the whole branding from UAT to Production. A brand pack carrying another company's marks is used only with that company's written permission.

## Does it handle dealer programmes for brand-new vehicles?

Yes. Operations > Sales & Marketing > Dealer Programmes holds the terms agreed with a dealer and its financing bank: rates, CTPL years, who pays (free first year or a dealer or bank subsidy) and whether an upload creates quotations or issued policies. The dealer's sales file is uploaded with the Dealer Sales template; each vehicle becomes a prospect, a quotation and, if chosen, an issued policy with the bank as mortgagee, billed to who pays. The bank endorsement letter prints or goes by e-mail. Distribution channels, lead assignment rules, fleet schedules, marine open covers and facultative placements are in the same release.

## Is there a mobile app?

No. iNXT BrokerVerse is a web application used in a browser on a desktop or laptop. Mobile layouts were not part of the test cycle of this release.

# Regulation and compliance

## Does it support Insurance Commission requirements?

It keeps the records a licensed broker must keep and produce on examination: broker slips and offers, quotations, Placement Slips with each insurer's confirmation, policies with participants, endorsements, claims and renewals, each numbered and in the audit trail. Premium due to each insurer is held in the ledger apart from commission income. The IC compliance registers add, under Compliance > Insurance Commission: a licence register of the firm, officers and agents, with commission to an agent without a licence in force held (or warned, by setting); fit and proper records of directors and officers; a check of each insurer's IC certificate of authority when a request for quotation, a firm order or a policy is issued; the complaints register under RA 11765 with deadlines and letters; the IC annual statement schedules built from the ledger as a working paper; and the IC production report by insurer and line. The accountant confirms the figures and transcribes them onto the IC form set in force; the broker files with the IC. The deadlines, lists and declarations delivered are settings the compliance officer confirms against the IC rules in force.

## Which BIR outputs are included?

BIR Form 2307 (issued to payees and received from insurers and clients); the withholding returns 0619-E and 1601-EQ laid out as the BIR forms, reconciled to the QAP and the ledger, with their filing records; the annual 1604-E with the alphalist of payees; the percentage tax 2551Q for a non-VAT broker; VAT Summary as the working paper for 2550M and 2550Q; SAWT, QAP and SLSP; and the DAT files of the QAP, SAWT, SLSP and 1604-E alphalist in the BIR validation module layouts. Overriding, profit and contingent commission from insurers is computed, billed and invoiced. The system does not file returns: the broker validates the DAT files with the current BIR module, transfers the figures to eBIRForms or eFPS and files. The tax adviser confirms the ATCs, rates and form versions.

## Is the system registered with the BIR as a Computerized Accounting System?

Registration of a computerised accounting system, or the acknowledgement the current rules provide for, is filed by the taxpayer, that is the broker. Accounts > Tax > CAS Books and Documents prepares the pack: a readiness list, the loose-leaf books (general journal, general ledger, cash receipts, cash disbursements, sales and purchase books) printed month by month with continuous page numbers and a print register, the system description, the backup procedure and the audit trail extract. The current status of any registration or acknowledgement held for iNXT BrokerVerse: [to confirm].

## How does it handle invoices and receipts under the EOPT Act?

Accounts > Tax > Sales Invoices issues the broker's sales invoices for commission and fees under RA 11976 and RR 7-2024: sequential SI numbers within the registered serial range, the seller's and buyer's registered details, VATable, exempt and zero-rated sales with VAT shown separately, and a payment acknowledgement as a supplementary document. The title of premium collection receipts is a setting. An EIS connector queues each invoice for the BIR Electronic Invoicing System; it is delivered switched off and in test mode, and the EIS enrolment, certification and credentials stay with the BIR and the broker. Which documents are registered as invoices, the wording of the supplementary documents and the VAT treatment of each commission stream are confirmed by the broker's tax adviser.

## How are premium taxes calculated?

On every quotation, policy, endorsement and renewal: VAT 12% on the lines that carry it, documentary stamp tax of PHP 0.50 on each PHP 4.00 of net premium or fraction (NIRC section 184), local government tax (0.75% default, and a rate per city or municipality in Premium Taxes & LGU Rates), and fire service tax 2% on fire and IAR. Rates and the lines they apply to are settings. CTPL comes from the tariff and is not taxed again.

## What does it do for the Data Privacy Act?

New in this release, Master > Data Privacy:

- consent per purpose (processing, marketing, sharing with insurers and reinsurers), with the channel, privacy notice version and evidence; a withdrawal is recorded and the history kept;
- a Consent Register across clients and prospects;
- Data Subject Requests: access, rectification, erasure or blocking, objection, portability and withdrawal of consent, numbered, with a due date (15 calendar days in the delivered set-up) and an assignee who is notified; a daily job reminds the privacy team of overdue requests;
- export of the personal data held about a client or prospect, as JSON or Excel;
- anonymisation once the retention period is over (10 years after the last policy expiry in the delivered set-up); it is refused while there is open business or the records must still be kept, and amounts, numbers and dates stay for the books;
- with the compliance registers: masking of TIN, ID numbers, mobile numbers, e-mail addresses, bank accounts and birth dates for roles without the permission to view them, on screens and exports; encryption at rest of TIN, ID and bank account numbers with a key held outside the database; and a breach register that runs the 72-hour NPC notification clock with reminders and gives the annual report;
- a masking tool for copies of production used in test and training environments.

The broker remains the personal information controller. Its DPO sets the due days, retention years and notice version, and handles NPC registration and the breach notification itself. iorta TechNXT acts as personal information processor when it hosts or supports the system.

## Does it cover anti-money laundering?

Yes. The AML/CFT toolkit (Compliance menu, Compliance Officer role) covers onboarding before the first policy (individual and juridical clients, signatories and beneficial owners, KYC documents), a risk rating from configurable factors with enhanced due diligence for high-risk clients (no policy is issued until the EDD review is approved, by setting), screening against the lists the broker uploads (UN consolidated list, AMLC and ATC designations, PEP and internal lists) and optionally a commercial screening provider, daily covered and suspicious transaction monitoring, cases with due dates, and the CTR and STR report files. No list content is delivered: the broker loads the lists it is entitled to use. The report file layout, institution code and transaction codes are confirmed by the compliance officer against the AMLC's current reporting guidelines and tested in the AMLC portal before the first filing. The broker files with the AMLC.

# Integration and data

## Does it connect to insurers' systems?

Yes, through the integration framework. The INSURER_API connector sends policy issuance, policy and premium data and claim status requests, with a mapping per insurer (product codes, request and answer fields, claim statuses) set on Master > System Configuration > Insurer Integration; an insurer without an API sends a claim status file instead. Every message goes through a monitored outbox with retries. The connector is delivered in test mode: going live with an insurer needs the insurer's endpoint, credentials and acceptance of the requests, which is done with each insurer during onboarding (priced per connector, see the Rate Card). Slips, placement orders, remittance statements and debit notes still go by PDF and e-mail where the insurer prefers, and insurer statements of account are matched in Insurer Reconciliation.

## Which banks are supported for reconciliation?

Bank statement formats for BDO, BPI and Metrobank and a generic layout are delivered for reconciliation; a new format is added in Master > Finance > Bank Statement Formats without code. Payments go out by bank upload file (bulk credit, InstaPay or PESONet) from approved payment vouchers, with maker-checker on the batch and the bank's status file imported back. Starter file layouts for BDO, BPI, Metrobank, Landbank and UnionBank and a generic CSV are delivered as examples: each is validated against the bank's current specification and a test file accepted by the bank during onboarding. There is no direct bank API.

## Does it connect to our accounting package?

The general ledger is inside iNXT BrokerVerse, with the trial balance, general ledger detail, income statement and balance sheet. A broker that keeps a corporate ledger elsewhere can take the trial balance or journal register as Excel or CSV for upload. A direct interface to another package is a change request.

## How is our existing data loaded?

With the Go-Live Data Load workbench: a configuration workbook (settings and masters, including the Philippine regions, provinces, cities and barangays, banks and ID types delivered) and a migration workbook (clients, in-force policies, open items, opening balances), each validated before loading with an errors workbook to correct, then loaded and reconciled. The upload templates of each master and opening balance are also delivered. An environment comparison report proves that configuration was promoted unchanged from UAT to Production. Each load is rehearsed and reconciled before cutover. One import file holds up to 20,000 rows; larger books are loaded in several files. Migration from a legacy source beyond the templates is PHP 240,000.00 per source.

## Does it send SMS or connect to the CTPL authentication provider?

Yes. SMS (and optionally Viber business messages) through Semaphore-style, Globe Labs-style or any HTTP gateway: renewal notices, payment reminders and claim updates from templates, after a consent check. CTPL certificates of cover are authenticated through the connector of the IC-accredited provider, with the COC series and the LTO feed where the provider does not send it. Connectors are delivered in test mode; the broker contracts the provider, and the provider's acceptance of the interface is completed during onboarding.

## Is there an API?

Yes. The application is built on a REST API with an OpenAPI description and a Postman collection. Every call is checked against the user's permissions. Third parties can push messages (for example claim statuses or CTPL results) to a signed inbound address per connector.

# Technology, hosting and security

## What is it built on?

A React web application, a Node.js 22 API and a PostgreSQL 16 database, with a file store for documents. It runs in containers (Docker) or under a process manager. There is no proprietary middleware and no per-CPU database licence.

## Where can it be hosted?

Four options: AWS (Singapore region), Microsoft Azure (Southeast Asia, Singapore), a Philippine hosting partner, or the broker's own data centre. Hosting by iorta TechNXT is optional and priced separately, per environment set: Dev, UAT and Production for a small or medium broker; Dev, SIT, UAT and Production for a large broker. A temporary Pre-Prod, restored from a production backup for the go-live rehearsal and each major release, is billed only for the months it exists. On AWS the standing set costs PHP 43,000.00 a month for a small broker and PHP 143,000.00 for a large one (Rate Card). A broker that hosts itself pays no hosting fee and receives the deployment guide, with set-up support at day rates.

## Our data must stay in the Philippines. Can it?

Yes, with the local partner option or the broker's own data centre. The Data Privacy Act does not require personal data to be stored in the Philippines; it makes the broker accountable for data transferred abroad. Hosting in Singapore is therefore a documented cross-border transfer covered by contract. AWS has a Manila Local Zone with a limited set of services; the managed database and file services run in Singapore.

## How is the system secured?

Named users only; password rules (8 characters or more, mixed case, digit and symbol, history of 5, 90-day age); lockout after 5 wrong passwords; two-factor sign-in with an authenticator app, compulsory for the roles the broker chooses; 30-minute access tokens with idle sign-out; permissions checked by the server on every request; personal identifiers masked by role and TIN, ID and bank numbers encrypted at rest (compliance registers); connector credentials held in the server's secret store, never in the database; TLS in transit; audit trail of every change with before and after values, with an Audit Trail screen. Application controls are mapped to the OWASP Top 10. Storage encryption of the database, files and backups is recommended on every hosting option.

## What about backups and disaster recovery?

Every hosting option includes daily backups with point-in-time restore, and production runs with two API instances and a standby database. A disaster recovery site is set up in a second region or a second Philippine site, depending on the option. Backup restores and DR drills are part of the support service.

## Has it been tested?

Yes. For this release, 629 test cases were prepared and, in the release verification of 04 October 2026, 617 passed; the remaining 12 are 1 open Medium item, 3 cases that need a mail server and 8 not yet run, each tracked in the test workbook. The backend regression has 1,113 automated tests and the front end 175, all passed on the merged release. An end-to-end UAT cycle of 433 business steps ran on a fresh database of the final code with one user per role, from set-up and customer due diligence to month-end close, and a go-live rehearsal of 52 checks passed between two environments. An external penetration test was not part of this cycle and is recommended before go-live.

# Implementation

## How long does it take?

Small broker 8 weeks, medium 12 weeks, large 16 to 20 weeks, each to the end of hypercare. The size is agreed at mobilisation from users, offices, insurers and in-force policies. Hypercare always covers the first month-end close.

## What do you need from us?

A project owner, one key user per team, the data in the upload templates (insurer agreements, commission rates, chart of accounts, in-force policies, open receivables, trial balance), the SMTP mailbox, the user list two weeks before training, and timely sign-offs. Data requests go out in week 1; late data is the most common reason for a delay.

## Can you customise it to our process?

The OOTB approach is to configure, not customise. Most broker differences are met by masters and settings: products, rates, taxes, commission rules, approval limits, maker-checker switches, document numbering, e-mail texts, schedules and the placement journey per line. A requirement that configuration cannot meet is recorded in the fit-gap register and priced as a change request at the published day rates. It enters the go-live scope only if the steering committee approves it.

## How are users trained?

Train-the-trainer for key users, then end-user training per role, using the user manual and the role guides. The Help panel (F1) opens the manual section of the screen the user is on. Training days are included per tier; extra trainer days are PHP 30,000.00.

# Support and maintenance

## How does support work?

Three levels: the broker's key users and System Administrator (L1), iorta TechNXT application support (L2) and iorta TechNXT engineering (L3). Standard hours are 8:00 to 18:00 Manila time, Monday to Friday, except Philippine regular holidays; 24x7 for Severity 1 is an option. Standard targets: P1 first response in 30 minutes and service restored or a workaround in 4 service hours; P2 2 service hours and 2 business days. The support agreement fixes the final values.

## What does the AMC cover?

Corrections, updates of the OOTB version, regulatory form updates released for all customers, and standard support in business hours. It does not cover change requests, extra environments, extra training or work caused by changes the broker made outside the agreed process.

## Will we get updates for new BIR forms?

Regulatory form updates released for all customers are covered by the AMC or the subscription, for the BIR forms, DAT file layouts and AMLC report file the product produces. A broker-specific report or form is a change request.

# Commercials

## How is iNXT BrokerVerse priced?

Per named user, on graduated slabs, in two models. Perpetual: a one-time licence (PHP 90,000.00 per user for the first 25 users, PHP 78,000.00 for users 26 to 100, PHP 66,000.00 for 101 to 300, PHP 54,000.00 above 300), with AMC at 22% of the licence fee a year from Year 2, increasing 5% a year. Subscription: PHP 3,200.00, PHP 2,800.00, PHP 2,400.00 and PHP 2,000.00 per user per month for the same slabs, with a minimum of billable users per tier, increasing 5% at each anniversary. Implementation (or onboarding for subscription) is calculated from base man-days per tier plus 6 man-days per extra line of business at PHP 16,100.00 a day. All prices exclude 12% VAT.

## Which model should we choose?

Subscription costs less in cash for the first three years and needs no capital approval. Perpetual costs less over five years: for the reference user counts, 13% to 18% less, with break-even in Year 4. iorta TechNXT recommends subscription for small and medium brokers and perpetual for large and enterprise brokers, or for any broker planning four years or more ahead.

## Who counts as a user?

A named person with a sign-in. Inactive users are not counted. Referrers do not sign in and are not users.

## What are the payment terms?

Implementation: 40% on signing, 40% on UAT sign-off, 20% on go-live. Perpetual licence: 100% on go-live. AMC: yearly in advance. Subscription and hosting: monthly in advance. Invoices are payable in 30 days. The recommended minimum subscription term is 12 months.

## Can we withhold tax on your invoices?

Yes, where the broker is a withholding agent; withholding does not reduce the invoice price and the broker issues BIR Form 2307. The treatment of the perpetual licence (sale of software or royalty) is confirmed by both parties' tax advisers before contract.

## Is there a discount?

The onboarding fee percentage for subscription is an input that can be reduced as a commercial concession, with approval. Any other concession needs approval from iorta TechNXT management: [to confirm the discount authority of the sales team].

# Objection handling

## How to handle an objection

1. Acknowledge it and ask one question to find what is behind it.
2. Answer with a fact about the product or the offer, not an opinion.
3. Give one proof the prospect can check: a screen in the demo, a document, a figure from the pricing workbook.
4. Confirm the objection is answered before moving on. If it is not, log it and promise a written answer with a date.

## "Our spreadsheets and current system work well enough."

**Behind it:** fear of disruption; the cost of today's way of working is not visible.

**Response:** "Most brokers we speak with run well on people who know where everything is. The cost shows at month-end, in remittances and when someone leaves. iNXT BrokerVerse keeps the policy, the money and the books in one record, so the remittance to each insurer is built from what was collected, the bank reconciliation is matched by the system, and the BIR working papers come from the same ledger."

**Proof:** in the demo, follow one policy from the Placement Slip to the remittance and the month-end checklist. Ask how long the same takes today.

## "It is too expensive."

**Behind it:** comparing with a CRM or a spreadsheet; budget not set; Year 1 cash.

**Response:** "The subscription starts at PHP 3,200.00 per user per month for the first 25 users, about USD 51, and falls per user as you grow. For a small broker of 15 users, Year 1 subscription is about 2.3% of estimated commission income. That includes placement, remittance, accounting, reconciliation and BIR outputs, which a CRM does not."

**Proof:** the indicative investment slide and the pricing workbook run with the prospect's own user count. Offer the subscription model to lower Year 1 cash.

## "A global broker system has more features."

**Behind it:** a parent company preference, or a demo of a larger product.

**Response:** "Global broker systems are priced at about USD 125 to 300 per user per month in published estimates, and they are not localised for Philippine premium taxes, BIR forms and DAT files, EOPT invoicing, AMLC reporting, IC registers, CTPL authentication, local bank files or the Data Privacy Act. iNXT BrokerVerse is built for that work, at USD 32 to 51 per user per month."

**Proof:** the 1601-EQ with its reconciliation, a sales invoice, the AML dashboard and the premium taxes on a quotation. Ask which feature of the other system the team would use every day.

## "We are too small for a system like this."

**Behind it:** fear of a long project and of a price set for large brokers.

**Response:** "Most Philippine brokers earn under PHP 100 million in commission, and the price list is built for them: graduated slabs, a minimum of 10 billable users on subscription, and an 8-week implementation for a small broker with one office."

**Proof:** the 8-week plan on the implementation slide.

## "We need it to work exactly like our current process."

**Behind it:** a key person's way of working; earlier projects that customised everything.

**Response:** "We fit the system to you through configuration first: products, rates, taxes, approval limits, the placement journey per line, document numbering and e-mail texts are settings. Where your process differs and configuration cannot cover it, we record it in a fit-gap register and price the change openly. Many brokers find the delivered process is close to theirs once they see it with their own example."

**Proof:** Master > Configuration and the Authority Matrix in the demo; the change request day rates.

## "Implementation projects always run late."

**Behind it:** a previous failed project.

**Response:** "Most delay comes from data. We send the data requests in week 1, use delivered templates for every load, rehearse the loads at least twice, and ask for written sign-off at the end of each phase. Hypercare stays until your first month-end close is done."

**Proof:** the phase plan, the upload templates and the Implementation Approach and Plan document.

## "We do not want our data in the cloud abroad."

**Behind it:** Data Privacy Act concerns, a parent bank's policy.

**Response:** "You choose where it runs: AWS or Azure in Singapore, a Philippine hosting partner, or your own data centre. With the local options the data stays in the Philippines. If you choose Singapore, the DPA allows it with the transfer documented and covered by contract, and we sign a data processing agreement."

**Proof:** the deployment options slide and the Architecture, Infrastructure, Security and Privacy document.

## "We need direct integration with our insurers."

**Behind it:** the volume of documents exchanged with insurers.

**Response:** "The insurer connector is in the product: issuance, premium data and claim status requests with a mapping per insurer, sent through a monitored outbox. Philippine insurers do not share one API, so each insurer is switched to live during onboarding with its endpoint, credentials and acceptance; insurers without an API keep exchanging files and e-mails, and their statements are matched in Insurer Reconciliation."

**Proof:** Insurer Integration with a mapping and the request preview; the Integrations outbox; the connector go-live price in the Rate Card.

## "Our finance team will not change the accounting system."

**Behind it:** the finance team owns the books and the auditors know the current package.

**Response:** "The ledger in iNXT BrokerVerse is a full double-entry ledger with posting rules your finance team can read and must approve when they change. If you keep a corporate ledger elsewhere, the trial balance and journal register export to Excel or CSV for upload. Many brokers keep the broking ledger here because remittance, commission and reconciliation depend on it."

**Proof:** Posting Rules, Configuration Approvals and the Month-End Close checklist, shown to the finance head.

## "Twenty-two percent AMC is high."

**Behind it:** comparison with other software contracts.

**Response:** "The AMC starts in Year 2, after a 12-month warranty, and covers corrections, product updates, regulatory form updates and standard support. If the AMC is the concern, the subscription model has no AMC: updates and support are in the monthly fee."

**Proof:** the commercial models slide.

## "The 5% yearly increase is a concern."

**Response:** "The increase is fixed in the contract, so you can budget it. It covers our cost of keeping the product current with BIR, IC and privacy changes. Day rates are fixed for 12 months from signing."

## "Who are your other clients?"

**Response:** [to confirm: the client references iorta TechNXT may name, and the reference call arrangement]. Until confirmed, offer the test evidence (629 test cases for this release), the documentation package and a proof-of-concept on the prospect's own examples during the workshop.

## "What happens if iorta TechNXT is no longer there?"

**Response:** "The system runs on mainstream technology (React, Node.js, PostgreSQL) that many teams in the Philippines can support. If you host it yourself, the database and documents are in your environment. A perpetual licence keeps your right to use the version you have." Source code escrow: [to confirm whether iorta TechNXT offers it and on what terms].

## "Our users will not adopt a new system."

**Response:** "Each role sees only its own menus and lands on its own dashboard, and My Work shows each person what is waiting for them. Training is per role, from key users who were part of the configuration. The user manual opens on the screen in use with F1, and role guides are delivered."

**Proof:** the role guides; sign in as two different roles in the demo.

## "The timing is not right. Maybe next year."

**Response:** "Understood. A workshop now costs nothing and gives you a sized plan and a price valid for 90 days, so the decision is ready when the budget is. If there is a date that matters, such as the end of a system contract or an audit, we can plan back from it."

# Known limits of the OOTB version

Disclose these when the topic comes up. Each has a workaround or a change request route.

| Topic | What the OOTB version does | Workaround or route |
|---|---|---|
| Partner interfaces | Connectors for SMS, CTPL authentication, the LTO feed, insurer APIs, bank files and the BIR EIS are delivered in test mode | Each partner's endpoint, credentials and acceptance of the interface are completed with the partner during onboarding; the partner certifies, not iorta TechNXT |
| IC reports | IC annual statement schedules and production report as working papers; the accountant confirms and transcribes onto the IC form set in force | The broker files with the IC |
| BIR filing | Returns, alphalists and DAT files prepared; no direct e-filing | The broker validates the DAT files with the BIR module and files through eBIRForms or eFPS; the tax adviser confirms ATCs and rates |
| AMLC reporting | Report files in the layout BV-AMLC-TXN 1.0; no list content delivered | The compliance officer confirms the layout and codes against the AMLC guidelines, tests a file in the AMLC portal and loads the lists |
| Report schedules | Scheduled e-mail delivery of reports exists in the API; no screen to set it up | System Administrator sets schedules through the API; the Report Builder and BI extract cover ad hoc needs |
| Two-factor enrolment | Shows the key and a link, not a QR code | Users type the key in the authenticator app |
| Mobile | Web application for desktop and laptop browsers | Mobile-friendly screens for sales and claims are on the later part of the indicative roadmap (Release Notes and Product Roadmap) |
| E-mail | Needs the broker's SMTP mailbox and the "Send e-mails" switch | Set up during implementation |
| In progress | Sales activity log, quote wizard covers and risk fields from the Product Configurator, supplier BIR Form 2307 and fixed asset disposal are being completed for the next release | Confirm the delivery date before promising them |
