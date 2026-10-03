---
title: FAQ and Objection Handling
subtitle: iNXT BrokerVerse OOTB
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed: To be completed
approved: To be completed
acronyms: AMC=Annual Maintenance Contract; AMLA=Anti-Money Laundering Act; API=Application programming interface; BIR=Bureau of Internal Revenue; CAS=Computerized Accounting System; CR=Change request; DPA=Data Privacy Act of 2012; DPO=Data protection officer; EOPT=Ease of Paying Taxes Act; EWT=Expanded withholding tax; IC=Insurance Commission; NPC=National Privacy Commission; OOTB=Out of the box; SoD=Segregation of duties; UAT=User acceptance test; VAT=Value-added tax
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

The out-of-the-box version of the iNXT BrokerVerse insurance broking platform, configured for Philippine non-life brokers. It covers prospects, quotations, placement with insurers, policy issue, endorsements, claims, renewals, billing, official receipts, collections and credit control, remittance to insurers, direct bill, commission and incentives, reinsurance, the general ledger, bank and insurer reconciliation, the month-end and year-end close, BIR working papers, reports and dashboards. "OOTB" means it is delivered as it is and fitted to the broker by configuration; changes to the product are change requests.

## Which lines of business does it support?

The product is built for non-life broking. The test data set covers motor, CTPL, personal accident, travel, householder, fire, industrial all risks, contractor's all risks, erection all risks, marine, commercial general liability (CGL), money, employee benefits and surety bond. Each line is set up in the Product Configurator and the masters (products, covers, rating, taxes, document templates, insurer commission rates). The placement journey of each line is configurable: for example, motor goes from quotation straight to policy, while fire, IAR, marine, casualty and engineering need a Placement Slip confirmed by every insurer.

## Does it handle co-insurance?

Yes. A Placement Slip or a policy can have several insurers with one lead. Shares must total exactly 100%. Premium, taxes, commission, the remittance to each insurer, claim recoveries and the reports (Co-insurance Register, Due to Insurers by Co-insurer) follow the shares, and the rounding remainder goes to the lead.

## Does it handle direct bill as well as broker billed?

Yes. The billing mode is chosen at issue and defaults from the insurer. For direct bill, no premium bill is raised; the broker bills its commission plus 12% VAT to the insurer on a commission debit note, records the insurer's payment net of 10% EWT, and the Form 2307 received goes to the SAWT.

## Do referrers and sub-agents need a login?

No. Referrers do not sign in. Sales & Marketing enter their business, and they are paid from the referrer master by payment voucher, net of EWT, once the premium is fully collected. This keeps the user count, and the licence cost, to the broker's own staff.

## Which roles are delivered?

Seven: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting and Accounting Manager. Each has its own menus, landing dashboard and server-side permissions. Roles can be adjusted in Master > Generals > User Management.

## Can clients approve quotations or pay online?

Yes. A quotation can be sent for customer approval: the client receives a signed link valid for 168 hours and approves without signing in. Payment links work through PayMongo or Dragonpay (a sandbox provider is used for training and UAT); a paid link creates the official receipt. The broker needs its own merchant account with the gateway before going live.

## Does the client receive documents by e-mail?

Yes, new in this release. E-mail receipt (on the receipt) and E-mail invoice (on the collection) send the official receipt or the premium invoice as a PDF attachment, with To, Cc and a note. The broker can also switch on automatic sending when a receipt is recorded or a bill is issued (off in the delivered set-up). The commission debit note e-mail to insurers carries the debit note PDF, and the policy issued e-mail carries the policy schedule. E-mails need the broker's SMTP mailbox (for example Office 365) and the "Send e-mails" switch.

## What reports come with the product?

39 catalogue reports in Reports > All Reports, grouped as production and placement, claims and renewals, insurers and commission, receivables and cash, ledger and period end, BIR tax and bank. Each runs on screen with totals and downloads as Excel, CSV or PDF on the letterhead. There are also Executive, Sales, Processing, Claims and Commission dashboards. The Reports Book in the documentation package describes every report.

## Is there a mobile app?

No. iNXT BrokerVerse is a web application used in a browser on a desktop or laptop. Mobile layouts were not part of the test cycle of this release.

# Regulation and compliance

## Does it support Insurance Commission requirements?

It keeps the records a licensed broker must keep and produce on examination: broker slips and offers, quotations, Placement Slips with each insurer's confirmation, policies with participants, endorsements, claims and renewals, each numbered and in the audit trail. Premium due to each insurer is held in the ledger apart from commission income, and remittance terms per insurer drive the due dates. The financial statements and production reports give the figures for IC reports. There is no report in the IC's own format; the broker prepares and files IC reports from these figures.

## Which BIR outputs are included?

BIR Form 2307 (issued to payees and received from insurers and clients), VAT Summary as the working paper for 2550M and 2550Q, SAWT, QAP for 1601-EQ, and SLSP Sales and Purchases, all in the BIR column order as CSV, Excel or PDF. The system does not file returns; the broker validates the files with the BIR's tools and files them.

## Is the system registered with the BIR as a Computerized Accounting System?

Registration of a computerised accounting system, or the acknowledgement the current rules provide for, is filed by the taxpayer, that is the broker. iNXT BrokerVerse provides what such a file typically needs: the system description, sample journals, ledgers, trial balance and receipts, the number series, the audit trail, user access controls and period locks. The current status of any registration or acknowledgement held for iNXT BrokerVerse: [to confirm].

## How does it handle invoices and receipts under the EOPT Act?

The broker issues invoices (bills) and official receipts from their own number series, printed on the letterhead with the TIN, and the next number can continue the old system's numbering. Which documents the broker issues as primary and supplementary documents is decided with its tax adviser, and the series are registered with the BIR as required.

## How are premium taxes calculated?

On every quotation, policy, endorsement and renewal: VAT 12% on the lines that carry it, documentary stamp tax 12.5% of net premium, local government tax (0.75% default, and a rate per city or municipality in Premium Taxes & LGU Rates), and fire service tax 2% on fire and IAR. Rates and the lines they apply to are settings. CTPL comes from the tariff and is not taxed again.

## What does it do for the Data Privacy Act?

New in this release, Master > Data Privacy:

- consent per purpose (processing, marketing, sharing with insurers and reinsurers), with the channel, privacy notice version and evidence; a withdrawal is recorded and the history kept;
- a Consent Register across clients and prospects;
- Data Subject Requests: access, rectification, erasure or blocking, objection, portability and withdrawal of consent, numbered, with a due date (15 calendar days in the delivered set-up) and an assignee who is notified; a daily job reminds the privacy team of overdue requests;
- export of the personal data held about a client or prospect, as JSON or Excel;
- anonymisation once the retention period is over (10 years after the last policy expiry in the delivered set-up); it is refused while there is open business or the records must still be kept, and amounts, numbers and dates stay for the books.

The broker remains the personal information controller. Its DPO sets the due days, retention years and notice version, and handles NPC registration and breach notification. iorta TechNXT acts as personal information processor when it hosts or supports the system.

## Does it cover anti-money laundering?

Partly. KYC data for motor (government ID type, number and image) is required before issue, and the receipts, collections and client accounting history give transaction data for review. There is no transaction monitoring, sanctions or PEP screening, or AMLC reporting function. Whether and how the AMLA applies is for the broker's compliance officer.

# Integration and data

## Does it connect to insurers' systems?

No insurer API is used. Broker slips, placement orders, remittance statements and commission debit notes go to insurers as PDF, CSV or Excel files and by e-mail. Insurer statements of account come back as CSV or Excel files and are matched in Insurer Reconciliation, with a column mapping per insurer. An insurer API integration is a change request (standard integration PHP 320,000.00, complex PHP 720,000.00).

## Which banks are supported for reconciliation?

Bank statement formats for BDO, BPI and Metrobank and a generic layout are delivered. A new bank format is added in Master > Finance > Bank Statement Formats without code. Transfers to insurers are approved in the system and their bank result recorded; no bank payment file or bank API is generated.

## Does it connect to our accounting package?

The general ledger is inside iNXT BrokerVerse, with the trial balance, general ledger detail, income statement and balance sheet. A broker that keeps a corporate ledger elsewhere can take the trial balance or journal register as Excel or CSV for upload. A direct interface to another package is a change request.

## How is our existing data loaded?

With the delivered upload templates (about 40), filled by the broker from its old system: masters, clients, in-force policies, open receivables (Import open items) and the opening trial balance (Import opening balances). Each load is rehearsed in mock loads and reconciled before cutover. One import file holds up to 20,000 rows; larger books are loaded in several files. Migration from a legacy source beyond the templates is PHP 240,000.00 per source.

## Is there an API?

Yes. The application is built on a REST API with an OpenAPI description and a Postman collection. Every call is checked against the user's permissions.

# Technology, hosting and security

## What is it built on?

A React web application, a Node.js 22 API and a PostgreSQL 16 database, with a file store for documents. It runs in containers (Docker) or under a process manager. There is no proprietary middleware and no per-CPU database licence.

## Where can it be hosted?

Four options: AWS (Singapore region), Microsoft Azure (Southeast Asia, Singapore), a Philippine hosting partner, or the broker's own data centre. Hosting by iorta TechNXT is optional and priced separately; a broker that hosts itself pays no hosting fee and receives the deployment guide, with set-up support at day rates.

## Our data must stay in the Philippines. Can it?

Yes, with the local partner option or the broker's own data centre. The Data Privacy Act does not require personal data to be stored in the Philippines; it makes the broker accountable for data transferred abroad. Hosting in Singapore is therefore a documented cross-border transfer covered by contract. AWS has a Manila Local Zone with a limited set of services; the managed database and file services run in Singapore.

## How is the system secured?

Named users only; password rules (8 characters or more, mixed case, digit and symbol, history of 5, 90-day age); lockout after 5 wrong passwords; two-factor sign-in with an authenticator app, compulsory for the roles the broker chooses; 30-minute access tokens with idle sign-out; permissions checked by the server on every request; TLS in transit; audit trail of every change with before and after values. Application controls are mapped to the OWASP Top 10. Storage encryption of the database, files and backups is recommended on every hosting option.

## What about backups and disaster recovery?

Every hosting option includes daily backups with point-in-time restore, and production runs with two API instances and a standby database. A disaster recovery site is set up in a second region or a second Philippine site, depending on the option. Backup restores and DR drills are part of the support service.

## Has it been tested?

Yes. For this release, 497 test cases were prepared and 480 passed; the remaining cases are failed, blocked or not run, each tracked in the defect register. The backend business-rule regression has 634 tests. An end-to-end UAT cycle of 371 business steps ran on a fresh database with one user per role, from set-up to month-end close. An external penetration test was not part of this cycle and is recommended before go-live.

# Implementation

## How long does it take?

Small broker 8 weeks, medium 12 weeks, large 16 to 20 weeks, each to the end of hypercare. The size is agreed at mobilisation from users, offices, insurers and in-force policies. Hypercare always covers the first month-end close.

## What do you need from us?

A project owner, one key user per team, the data in the upload templates (insurer agreements, commission rates, chart of accounts, in-force policies, open receivables, trial balance), the SMTP mailbox, the user list two weeks before training, and timely sign-offs. Data requests go out in week 1; late data is the most common reason for a delay.

## Can you customise it to our process?

The OOTB approach is to configure, not customise. Most broker differences are met by masters and settings: products, rates, taxes, commission rules, approval limits, maker-checker switches, document numbering, e-mail texts, schedules and the placement journey per line. A requirement that configuration cannot meet is recorded in the fit-gap register and priced as a change request at the published day rates. It enters the go-live scope only if the steering committee approves it.

## How are users trained?

Train-the-trainer for key users, then end-user training per role, using the user manual (199 pages) and the role guides for the seven roles. Training days are included per tier; extra trainer days are PHP 30,000.00.

# Support and maintenance

## How does support work?

Three levels: the broker's key users and System Administrator (L1), iorta TechNXT application support (L2) and iorta TechNXT engineering (L3). Standard hours are 8:00 to 18:00 Manila time, Monday to Friday, except Philippine regular holidays; 24x7 for Severity 1 is an option. Standard targets: P1 first response in 30 minutes and service restored or a workaround in 4 service hours; P2 2 service hours and 2 business days. The support agreement fixes the final values.

## What does the AMC cover?

Corrections, updates of the OOTB version, regulatory form updates released for all customers, and standard support in business hours. It does not cover change requests, extra environments, extra training or work caused by changes the broker made outside the agreed process.

## Will we get updates for new BIR forms?

Regulatory form updates released for all customers are covered by the AMC or the subscription. A broker-specific report or form is a change request.

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

**Response:** "Global broker systems are priced at about USD 125 to 300 per user per month in published estimates, and they are not localised for Philippine premium taxes, BIR working papers, local bank formats or the Data Privacy Act. iNXT BrokerVerse is built for that work, at USD 32 to 51 per user per month."

**Proof:** BIR Form 2307, VAT Summary and the premium taxes on a quotation. Ask which feature of the other system the team would use every day.

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

**Response:** "Philippine insurers do not share one API, so the product exchanges files and e-mails with insurers: slips, placement orders, remittance statements and debit notes out; statements of account in, matched in Insurer Reconciliation. Where an insurer offers an API you want to use, we price it as a standard or complex integration."

**Proof:** Insurer Reconciliation with an imported statement; the integration prices in the commercial note.

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

**Response:** [to confirm: the client references iorta TechNXT may name, and the reference call arrangement]. Until confirmed, offer the test evidence (497 test cases for this release), the documentation package and a proof-of-concept on the prospect's own examples during the workshop.

## "What happens if iorta TechNXT is no longer there?"

**Response:** "The system runs on mainstream technology (React, Node.js, PostgreSQL) that many teams in the Philippines can support. If you host it yourself, the database and documents are in your environment. A perpetual licence keeps your right to use the version you have." Source code escrow: [to confirm whether iorta TechNXT offers it and on what terms].

## "Our users will not adopt a new system."

**Response:** "Each role sees only its own menus and lands on its own dashboard. Training is per role, from key users who were part of the configuration. The user manual and a guide for each of the seven roles are delivered."

**Proof:** the role guides; sign in as two different roles in the demo.

## "The timing is not right. Maybe next year."

**Response:** "Understood. A workshop now costs nothing and gives you a sized plan and a price valid for 90 days, so the decision is ready when the budget is. If there is a date that matters, such as the end of a system contract or an audit, we can plan back from it."

# Known limits of the OOTB version

Disclose these when the topic comes up. Each has a workaround or a change request route.

| Topic | What the OOTB version does | Workaround or route |
|---|---|---|
| Insurer systems | No insurer API; files and e-mail | Change request for a named insurer API |
| IC reports | Figures from financial statements and production reports; no IC-format report | Broker prepares the IC report from the figures; CR for a format |
| Percentage tax | No working paper for a non-VAT broker's percentage tax | Ledger by insurer; CR if needed |
| Anti-money laundering | No transaction monitoring, sanctions or PEP screening | Receipts and client accounting history for review |
| Report schedules | Scheduled e-mail delivery of reports exists in the API; no screen to set it up | System Administrator sets schedules through the API |
| Bank payments | Transfers approved and their result recorded; no bank payment file | CR for a bank file format |
| Two-factor enrolment | Shows the key and a link, not a QR code | Users type the key in the authenticator app |
| Mobile | Web application for desktop and laptop browsers | Not planned in OOTB [to confirm roadmap] |
| E-mail | Needs the broker's SMTP mailbox and the "Send e-mails" switch | Set up during implementation |
