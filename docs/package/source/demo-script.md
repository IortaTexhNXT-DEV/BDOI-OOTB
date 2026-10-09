---
title: Demo Script
subtitle: iNXT BrokerVerse OOTB
version: 1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed: To be completed
approved: To be completed
change: Optional demonstration segments for My Work, AML/CFT, the IC compliance registers, BIR forms and EOPT, integrations, dealer programmes, branding and the Report Builder; day-before checks updated
acronyms: AE=Account executive; AML=Anti-money laundering; AMLC=Anti-Money Laundering Council; CFT=Countering the financing of terrorism; EDD=Enhanced due diligence; EIS=Electronic Invoicing System; EOPT=Ease of Paying Taxes Act; COC=Certificate of cover; LTO=Land Transportation Office; BIR=Bureau of Internal Revenue; BS=Broker Slip; CTPL=Compulsory third party liability; DPA=Data Privacy Act of 2012; DSR=Data subject request; EWT=Expanded withholding tax; IAR=Industrial all risks; KYC=Know your customer; OOTB=Out of the box; OR=Official receipt; PS=Placement Slip; SOA=Statement of account; UAT=User acceptance test
---

# About this script

## Purpose

This script tells the presenter what to show in a demonstration of iNXT BrokerVerse OOTB to a Philippine non-life insurance broker, in which order, as which user, with which records, and what to say. It has two storylines:

- the full demonstration of 60 minutes, for the management team and the process owners together;
- the short demonstration of 30 minutes, for an owner, a president or a CFO who wants the essentials.

Both follow one piece of business through the broker, from the prospect to the month-end close, so the audience sees one connected system and not a tour of menus. Chapter Optional segments adds 4 to 6-minute segments for the topics a prospect asks about most since this release: My Work, anti-money laundering, the Insurance Commission registers, BIR forms and EOPT invoicing, integrations, dealer programmes, branding and the Report Builder. Swap one or two of them in for a part of the main storyline that matters less to the audience.

## Who presents

| Role in the demo | Who | Task |
|---|---|---|
| Presenter | iorta TechNXT account manager | Opens, links each step to the prospect's own pain, closes with the next step |
| Driver | iorta TechNXT solution consultant | Signs in, clicks, keeps to the timings |
| Note taker | Second iorta TechNXT attendee, where available | Records the answers to the discovery questions and the follow-ups |

One person can present and drive in a 30-minute demo. In a 60-minute demo, split the roles: the presenter watches the audience while the driver works the screens.

## The demo environment

Run the demo on a test environment loaded with the UAT data set (`backend/scripts/uat-scenario.js`). The data is fictional and follows Philippine formats: 7 insurers, 2 bank accounts, 61 prospects, 62 new policies across motor, CTPL, personal accident, travel, householder, fire, IAR, CAR, EAR, marine, CGL, money, employee benefits and surety bond, 58 receipts, 8 claims, 22 insurer settlements, bank statements and insurer statements, spread over May to October 2026.

> The record numbers and names in this script are those of the UAT data set loaded with the default seed, as seen in the user manual screenshots. A different seed or a second run changes them. The day before the demo, open each record named below and write the actual number in the last column of the run sheet (chapter 6).

Never demonstrate on a production system or with the prospect's real client data.

# Demo logins

## Persona users

The UAT data set creates one or two users per role. All of them sign in with the persona password set when the data was loaded (`PERSONA_PASSWORD`). The password is given to the presenter by the environment owner; it is never written in a slide, an e-mail or this document.

| Login | Name on screen | Role | Used in the demo for |
|---|---|---|---|
| beatriz.lacson | Beatriz Lacson | System Administrator | Authority Matrix, Audit Trail, Data Privacy, settings; the optional segments on compliance, integrations, branding (the System Administrator sees every menu, including Compliance) |
| maria.rivera | Maria Consuelo Rivera | Sales & Marketing | Sales Dashboard, prospect, quotation, payment capture |
| jose.bernardo | Jose Antonio Bernardo | Processing Team | Broker Slip, compare offers, Placement Slip, policy issue, reinsurance |
| rica.fernandez | Rica Mae Fernandez | Processing Team | Second user: approves quotations and renewal terms |
| ana.buenaventura | Ana Lorraine Buenaventura | Operations | Client view, endorsement, renewals, consent on the client |
| carlo.estrada | Carlo Miguel Estrada | Claims | Claims Dashboard, claim detail |
| joy.macaraeg | Joy Anne Macaraeg | Claims | Second user: approves a claim settlement |
| liza.quiambao | Liza Marie Quiambao | Accounting | Receipts, e-mail receipt, remittance, bank reconciliation, month-end, BIR |
| nestor.pangilinan | Nestor Pangilinan | Accounting | Second user: approves remittances and vouchers |
| teresa.villaroman | Teresa Villaroman | Accounting Manager | Approves the month-end close and the bank reconciliation |

## Browser set-up

- Use Chrome or Edge at 1440 x 900 or larger, zoom 100%, with the bookmarks bar hidden.
- Open one browser profile (or one private window per browser) for each user you will show. A second user in the same window ends the first user's session.
- Sign in every user 15 minutes before the start. Sign-in is rate limited (10 attempts in 5 minutes per user and per address), so do not try passwords in front of the audience.
- Sessions sign out after 30 minutes without activity. Click once in each window during long talk sections.
- Have the slide deck open on a second screen for the opening and the close.

## Checks the day before

1. Sign in as each user in the table and confirm the landing page opens.
2. Open each record of the run sheet and note its number.
3. In Master > Configuration, confirm whether "Send e-mails" is on. In most demo environments it is off: e-mails then stay Queued in the E-mail Outbox, which is what the script shows. Never switch sending on with sample data that holds real-looking addresses.
4. Leave one remittance, one journal or one quotation waiting for approval, so the approval notification can be shown live.
5. Check that the Data Privacy menu (Master > Data Privacy) is in the build of the demo environment. If it is not, show the privacy slide instead and offer a follow-up demo.
6. For each optional segment you plan to show, open its screen and prepare the record named in the segment. The UAT data set does not create AML, complaint or licence records: create one the day before as described in the segment, with fictional data only.
7. Master > System Configuration > Integrations: every connector shows Test mode. Never switch a connector to Live in a demo environment.
8. Master > System Settings > Theme and Branding: the iorta TechNXT default theme, or a theme made for the prospect from its public logo with its agreement. Never show a client brand pack (for example the Toyota Insurance Services pack) to another prospect.

# Full demonstration: 60 minutes

## Running order

| Time | Part | Login | What the audience sees |
|---|---|---|---|
| 0:00 | Opening and agenda | (slides) | Purpose, agenda, two or three discovery questions |
| 0:05 | The broker at a glance | maria.rivera | Executive Dashboard and Sales Dashboard |
| 0:09 | Prospect and quotation | maria.rivera | Prospect, motor quotation, client approval link, Quotation list |
| 0:15 | Placement | jose.bernardo | Broker Slip with offers, Compare offers, Placement Slip, policy |
| 0:23 | Servicing and claims | ana.buenaventura, carlo.estrada | Client view, policy detail, endorsement types, claim detail |
| 0:29 | Renewals | ana.buenaventura | Renewal Queue, Negotiations |
| 0:33 | Money in | liza.quiambao | Payment to verify, official receipt, E-mail receipt, Premium Warranty Monitor |
| 0:39 | Money out | liza.quiambao, nestor.pangilinan | Remittance, approval notification, direct bill debit note, commission |
| 0:45 | Close and tax | liza.quiambao, teresa.villaroman | Bank reconciliation, Month-End Close, BIR Form 2307 |
| 0:51 | Controls and privacy | beatriz.lacson | Authority Matrix, Audit Trail, Data Subject Requests, consent |
| 0:55 | Close | (slides) | Summary, questions, next step agreed |

## 0:00 Opening (5 minutes)

**Show:** slides 1 to 6 of the client presentation (title, agenda, about us, the broker's work, platform at a glance, end-to-end journey). Slide 17 (compliance, connections and your brand) introduces the optional segments.

**Say:**

- "Thank you for the time. In the next hour we will follow one piece of business through your broker: a prospect, a quotation, placement with insurers, the policy, the payment, the remittance and the month-end close. Each part is done by the team that does it in your office."
- "Stop us at any point. If something works differently in your office, tell us, because that is what the workshop after this will settle."

**Ask (pick two or three):**

- How many people work in sales, placement, client servicing, claims and accounting?
- Which lines of business make up most of your premium, and how many insurers do you place with in a month?
- What system or spreadsheets do you use today for policies, and for accounting?
- What takes your team the longest at month-end?

## 0:05 The broker at a glance (4 minutes)

**Login:** maria.rivera (lands on the Executive Dashboard).

**Click:**

1. Dashboard > Executive Dashboard. Choose This Month, then This Year.
2. Point to Total Revenue, Active Policies, New Business, Claims Rate, Retention Rate, Premium Receivable (Clients) and Commission Receivable (Insurers, Direct Bill), each against its target.
3. Scroll to Performance Trends, Revenue by Product Line and Top Agents Performance.
4. Dashboard > Sales Dashboard: prospects, quotations, conversion, policies issued and premium for the period.

**Say:**

- "These figures are live. They change as soon as a policy, a receipt or a claim is saved. There is no overnight load."
- "The targets come from your configuration, so management sets them once and every user sees the same."

## 0:09 Prospect and quotation (6 minutes)

**Login:** maria.rivera.

**Data:** prospect Gregorio Evangelista (LD-2026-00061, retail, Cebu City); quotation list with QT-2026-00072 (Bernard Bautista, motor, converted to policy).

**Click:**

1. Operations > Sales & Marketing > Prospects. Point to the cards (total, last 7 days, converted, with quotations) and the tabs per line.
2. Open Gregorio Evangelista with the eye icon. Show Personal Information, Contact Information and Address. Mention Bulk Upload for a list of prospects from Excel.
3. Select Create Quote. Fill step 1 (vehicle) quickly, select Next through Plan Recommendations, and on Coverage Details select Calculate. Do not save unless the run sheet allows it.
4. Show the Order Summary: net premium, VAT 12%, documentary stamp tax (PHP 0.50 on each PHP 4.00 of premium or fraction), local government tax 0.75%, CTPL, discount, brokerage, comsub and margin.
5. Select Back and open Operations > Sales & Marketing > Quotations. Show the cards (Converted to Policy, Pending Customer, Rejected) and open a quotation in Pending Customer.
6. Point to Share (Download, Email, WhatsApp, Send to Insurer, Copy Link) and Send for Customer Approval.

**Say:**

- "The server prices every quotation again from your rate tables and the configured taxes. If someone types over a premium in the browser, the save is refused. Discounts are limited by the Authority Matrix."
- "The client gets a signed link valid for seven days, approves without signing in, and the Processing Team is told."
- "A payment link through PayMongo or Dragonpay can collect the premium; a paid link creates the official receipt."

**Ask:** How many quotations do you issue in a month, and how does the client accept them today?

## 0:15 Placement (8 minutes)

**Login:** jose.bernardo.

**Data:** Broker Slip BS-2026-00047 (Visayan Coconut Oil Mills Inc., Marine Cargo, sum insured PHP 99,000,000.00, offers from Pacific Crest Insurance Corp. and Tala Guaranty and Surety Insurance Corp.); Placement Slip list.

**Click:**

1. Operations > Sales & Marketing > Request for Quotation. Point to the cards (Submitted, Responses in, Draft, Closed) and the columns: offers against insurers approached, best gross offer, response due, age.
2. Open BS-2026-00047. Show the progress bar (Request for Quotation, Quotation Slip, Placement Slip, Policy) and the tab Market responses: one row per insurer with status, net premium, rate, line offered.
3. Tab Compare offers: offers ranked by gross premium, the best marked Best, the difference to the best, deductibles. Explain Select, the Lead radio button and Share taken (must total 100%).
4. Point to Prepare Quotation Slip and Prepare Placement Slip, and to Slip PDF.
5. Operations > Sales & Marketing > Placement Slips. Show the cards (Draft, Sent to insurer, Bound, Policy issued) and the Confirmed column (for example 1 / 1).
6. Open a slip with status Policy issued (for example PS-2026-00023). Show Security (participating insurers): share, premium, taxes, gross, commission, policy or certificate number. Show the link to the policy in the progress bar.

**Say:**

- "One risk, several insurers, one comparison. The shares of a co-insurance must total exactly 100% with one lead, and every insurer must confirm before the policy can be issued on fire, IAR, marine, casualty and engineering."
- "From here on, the money follows the shares: one bill to the client, a payable and a commission line per insurer, a remittance per insurer, and claim recoveries by share."

**Ask:** What share of your premium is co-insured? How do you track insurer confirmations today?

## 0:23 Servicing and claims (6 minutes)

**Login:** ana.buenaventura, then carlo.estrada.

**Data:** client Visayan Coconut Oil Mills Inc.; policy POL-2026-00019 (Rowena Lim, motor, gross premium PHP 64,461.24); claim CLM-2026-00007 (Renato Tan, motor, flood damage, estimate PHP 150,000.00, Processing).

**Click:**

1. As ana.buenaventura: Operations > Clients. Open Visayan Coconut Oil Mills Inc. Show the tabs Policy, Claim, Renewal, Endorsement, and the Data privacy tab (shown in the Controls part).
2. Operations > Policy. Open POL-2026-00019. Show gross premium, expiry, client, Documents & Billing (Generate Policy Invoice, Premium Accounting Entries) and Related Records (quotation, insurer).
3. Select Endorsement. Show the types: Personal Details Change, Motor Details Change, Coverage Change, Policy Extend, Policy Cancel. Close without saving.
4. Switch to carlo.estrada (lands on the Claims Dashboard): total open claims, claims overdue, highest claims line, claims by state.
5. Operations > Claims. Open CLM-2026-00007. Show Claim Information, Incident Information, Driver Information and Policy Information.

**Say:**

- "A motor policy cannot be issued without the government ID, chassis, motor and plate or MV file number. That is checked by the server, not by a reminder."
- "A claim is refused when the date of loss is outside the policy period, or while the premium is unpaid if you keep that rule on. The settlement needs a second Claims user. The Preliminary Loss Advice goes to the insurer by e-mail at registration."

**Ask:** How many claims a month? Do any claim payments pass through your own bank account?

## 0:29 Renewals (4 minutes)

**Login:** ana.buenaventura.

**Data:** Renewal Queue with OLD-MC-2025-39204 (Joy Garcia, motor, 7 days to expiry, first notice sent).

**Click:**

1. Operations > Renewals > Renewal Queue. Show days to expiry, status, risk, sales person, and the cards (total, due soon, at risk, in grace period).
2. Operations > Renewals > Negotiations. Open a negotiation and show the Timeline (reminder, first notice, renewal opened), Add note, Request approval and Send Communication.
3. Operations > Renewals > Retention Analytics: renewal rate and premium retention.

**Say:**

- "Every policy enters the pipeline 90 days before expiry. Notices go at 60, 30 and 15 days, in order. A policy not renewed 30 days after expiry lapses, and Lapse Management runs the win-back. All of these day counts are settings."
- "Renewal terms go to the Processing Team for approval, and the renewed policy keeps paying commission to the original referrer."

## 0:33 Money in (6 minutes)

**Login:** liza.quiambao.

**Data:** receipt OR-2026-00035 (Hilaga Logistics and Warehousing Corp., policy POL-2026-00043); Premium Warranty Monitor with 4 policies in breach (PHP 445,301.58).

**Click:**

1. Show the notification bell: "Premium payment to verify" from a payment captured by the front office (if one is waiting).
2. Accounts > Receipts. Point to Receipt, Bulk Upload and Bulk Print. Open OR-2026-00035.
3. Select E-mail receipt. Show the side panel: To (the client's e-mail), Cc and a note. Send it.
4. Master > E-mail Outbox (as beatriz.lacson, or skip if not signed in): the message with the official receipt PDF named under attachments, status Queued while sending is off.
5. Accounts > Collections. Open a collection and point to E-mail invoice (premium invoice with the PDF attached).
6. Accounts > Credit Control > Premium Warranty Monitor. Show warranty breached, at risk and extensions to approve.

**Say:**

- "The front office records how the client paid; only Accounting issues the official receipt. That is your segregation of duties without a manual log."
- "New in this release: the official receipt and the premium invoice go to the client by e-mail with the PDF attached, from the screen or automatically when you switch it on. The commission debit note goes to insurers with its PDF, and the policy issued e-mail carries the policy schedule."
- "The warranty monitor shows broker-billed policies whose premium is unpaid near or past the insurer's payment warranty, so you act before the cover is at risk."

**Ask:** How many official receipts do you issue a month? How do clients receive them today?

## 0:39 Money out (6 minutes)

**Login:** liza.quiambao, then nestor.pangilinan.

**Data:** remittance REM-2026-00018 (Pacific Crest Insurance Corp.); debit note DN-2026-00004 (Harbor Point Non-Life Insurance Inc.); a remittance or voucher left waiting for approval (step 4 of the day-before checks).

**Click:**

1. Accounts > Remittance > Automated Processing: insurers Ready, Validate, Process Selected creates draft remittances. Do not run it unless the run sheet allows it.
2. Accounts > Remittance > Tracking. Show REM-2026-00018: gross amount, commission, net amount, status.
3. Switch to nestor.pangilinan. Show the bell: the approval request from liza.quiambao. Open Accounts > Remittance > Approval Workflow, open the pending item and Approve (or show Reject with a reason).
4. Switch back to liza.quiambao. Show the bell: the decision has arrived.
5. Accounts > Remittance > Direct Bill Processing > Debit Notes. Show DN-2026-00004: commission, VAT, total due, collected, balance.
6. Commission > Commission Dashboard: brokerage income, comsub (gross), net margin, outstanding payable, WHT.

**Say:**

- "The remittance is built from what was collected, per insurer and per share. The person who prepares it cannot approve it, and the approval level depends on the amount."
- "New in this release: every maker-checker flow tells the approvers there is something waiting, and tells the maker the decision with the reason. One setting switches it on or off."
- "Referrer commission becomes payable only when the premium is fully collected, and only to a referrer with a bank account on file."

## 0:45 Close and tax (6 minutes)

**Login:** liza.quiambao, then teresa.villaroman.

**Data:** bank account BDO-OPS (Operating Account), September 2026, reconciliation BRC-2026-00005; month-end close run MEC-2026-00005 for 2026-09; BIR Form 2307 for the fourth quarter of 2026.

**Click:**

1. Accounts > Bank Reconciliation > Reconciliation Workspace. Choose BDO-OPS and the period. Show Balance per bank, Balance per books, unmatched lines and Difference. Point to Import statement, Auto-match and Stale cheques.
2. Accounts > Bank Reconciliation > Reconciliations: the list with preparer and approver.
3. Accounts > Period End > Month-End Close. Open MEC-2026-00005. Show the steps (accruals, recurring journals, commission deferral, FX revaluation) and the checklist with Passed, Warning and Failed items.
4. Switch to teresa.villaroman. Show that the approval of a close run and of a reconciliation is hers, not the preparer's.
5. As liza.quiambao: Accounts > Tax > BIR Form 2307. Show Issued by us and Received, the quarter, payees, TIN, ATC and tax withheld. Point to VAT Summary, SAWT, QAP and SLSP in the same menu.

**Say:**

- "The ledger is inside the system. Every event posts by a posting rule you can read, and a change to a rule needs a second approver."
- "The close checklist will not let you submit while a blocking item has failed, for example a bank account with activity and no approved reconciliation."
- "The BIR working papers come from the same ledger lines, so they agree with the books."

**Ask:** How many days does your month-end take today? Who prepares your BIR returns?

## 0:51 Controls and data privacy (4 minutes)

**Login:** beatriz.lacson, then ana.buenaventura.

**Click:**

1. Master > Generals > User Management > Authority Matrix: approval limits per transaction type and role, in PHP. Point to Limit for one person.
2. Master > Generals > User Management > Segregation of Duties: block and warn rules on pairs of roles.
3. Master > Audit Trail: filter by a user or a record; show a change with its before and after values.
4. Master > Data Privacy > Data Subject Requests. Select Log request: requester, request type (Access, Rectification, Erasure or blocking, Objection, Data portability, Withdraw consent), date received; the due date follows. Point to Export personal data (JSON or Excel) and Anonymise. Cancel without saving unless the run sheet allows it.
5. Master > Data Privacy > Consent Register: consents given, refused and withdrawn.
6. As ana.buenaventura: open a client, tab Data privacy. Show the consent per purpose (Processing, Marketing, Sharing with insurers) and Record consent.

**Say:**

- "The Data Privacy Act functions are new in this release: consent per purpose with the evidence, a register of data subject requests with due dates, export of everything held about a person, and anonymisation once the retention period is over. Anonymisation is refused while there is open business or the records must still be kept, and amounts, numbers and dates stay for the books."
- "Your DPO decides the retention years, the due days and the privacy notice version. They are settings."

## 0:55 Close (5 minutes)

**Show:** slides 26 to 29 (commercial models, indicative investment, why iorta TechNXT, next steps).

**Say:**

- Summarise in three points, using the prospect's own answers from the discovery questions.
- "The next step we suggest is a half-day workshop with your process owners. It confirms users, lines, insurers, volumes and hosting, and it lets us size the implementation and the proposal."

**Agree before leaving:** the workshop date, the attendees, and who sends the sample documents (two or three policies, one claim, one remittance).

# Short demonstration: 30 minutes

## Running order

| Time | Part | Login | What the audience sees |
|---|---|---|---|
| 0:00 | Opening | (slides) | Purpose and one or two questions |
| 0:03 | Dashboard | maria.rivera | Executive Dashboard |
| 0:06 | Quotation | maria.rivera | Quotation list, Order Summary with taxes, Send for Customer Approval |
| 0:10 | Placement | jose.bernardo | BS-2026-00047 Compare offers; a Placement Slip with Policy issued |
| 0:15 | Money | liza.quiambao, nestor.pangilinan | Official receipt and E-mail receipt; remittance approval with the notification |
| 0:21 | Close and tax | liza.quiambao | Bank reconciliation workspace, Month-End Close checklist, BIR Form 2307 |
| 0:25 | Controls | beatriz.lacson | Authority Matrix, Audit Trail, Data Subject Requests |
| 0:27 | Close | (slides) | Commercial models and next steps |

## What to leave out

- Prospect creation, endorsements, claims and renewals: mention them in one sentence each and offer the full demo.
- Automated Processing of remittances and direct bill: show the approval only.
- Reinsurance: mention only if the prospect is an insurance and reinsurance broker.

## What to keep

- The live dashboard, because owners look at it first.
- The comparison of insurer offers, because it shows that the system understands broking and not only sales.
- The approval notification between two users, because it shows control without extra work.
- The month-end checklist and BIR Form 2307, because the CFO decides on these.

## Talking points for an owner or a CFO

- One system for the front office, the money and the books: no second accounting package to reconcile.
- Controls an auditor expects are in the product: maker-checker, signing authority, segregation of duties, audit trail.
- Built for the Philippines: premium taxes by line and LGU, BIR working papers, local bank statement formats, local payment gateways, Data Privacy Act functions.
- A predictable project: configure, do not customise; 8, 12 or 16 to 20 weeks by size; hypercare through the first month-end close.
- Two price models: subscription for lower Year 1 cash, perpetual for lower five-year cost.

# Optional segments

Each segment stands on its own and takes 4 to 6 minutes. Show it in place of a part of the main storyline, or in a follow-up demo for the process owner concerned. Keep the honest line at the end of each segment: it states what the partner, the tax adviser or the compliance officer confirms.

## My Work (4 minutes)

**Login:** ana.buenaventura (or any user with open items).

**Click:**

1. Operations > My Work. Point to the five figures: Overdue, Due today, Next 7 days, Open items, Open tasks.
2. My Items: the categories on the left (quotations, renewals, premiums due, claims, approvals, missing documents) with the overdue badge; open one row to land on the record.
3. New task: title, due date, reminder, related record. Save.
4. Calendar: the next 7 days with the Overdue strip.
5. As a manager (for example teresa.villaroman): My Team, one row per person with open, overdue and due-today counts; Reassign.

**Say:** "Every person starts the day here. Follow-ups are created from promises to pay, renewal next steps and claim follow-up dates, and close by themselves when the record closes."

## Anti-money laundering (6 minutes)

**Login:** beatriz.lacson (sees the Compliance menu; at the broker this is the Compliance Officer role).

**Prepare the day before:** onboard one fictional juridical client with a beneficial owner flagged as PEP, so it rates High and has an EDD review open.

**Click:**

1. Compliance > AML Dashboard: clients by risk rating, reviews to decide, covered transactions, alerts, cases and report files.
2. Compliance > Client Due Diligence: open the prepared client. Show the factors that scored, the PEP reason and the KYC status EDD required.
3. Compliance > EDD Reviews: the review waiting for approval. Explain that no policy is issued for this client until it is approved (setting).
4. Compliance > Screening Lists: the lists and their versions; Upload version. Say that the broker loads the lists it is entitled to use.
5. Compliance > Transaction Alerts and AML Cases: the rules (cash above PHP 500,000, several payments below it, early cancellation with refund, payment to a third party) and how an alert becomes a case and an AMLC report file.

**Say:** "Onboarding, risk rating, EDD, screening, monitoring and the report files are one programme in the same system as the policy and the receipts. Your compliance officer confirms the thresholds and the AMLC file codes against the AMLC's current guidelines and tests the file in the AMLC portal before the first filing."

## Insurance Commission registers (5 minutes)

**Login:** beatriz.lacson. Shown once the IC and NPC compliance package is deployed in the demo environment.

**Prepare the day before:** one licence of the firm, one agent licence expiring within 60 days, one complaint logged yesterday.

**Click:**

1. Compliance > Insurance Commission > Licence Register: states Valid, Expiring, Expired; the expiry calendar; the warning on agents whose commission is held because they have no licence in force.
2. Insurer Authority: each insurer's IC certificate of authority with its state; the check when a request for quotation or a policy is issued.
3. Complaints: the deadlines to acknowledge and to resolve, Acknowledge and the acknowledgement letter, the regulator report.
4. IC Annual Statement: the schedules from the ledger and the tab Checks and confirmations.
5. Compliance > Data Privacy (NPC) > Breach Register: the 72-hour Clock column.

**Say:** "The registers remind your compliance team before a licence or a certificate lapses and before a complaint deadline passes. The annual statement is a working paper: your accountant confirms the figures and transcribes them onto the IC form set in force."

## BIR forms and EOPT invoicing (6 minutes)

**Login:** liza.quiambao.

**Click:**

1. Accounts > Tax > Withholding Returns: the filing calendar of the year with due dates and status. Open a 1601-EQ: Part II by ATC, less the 0619-E remittances, and the Reconciliation with the QAP and the ledger. Point to Print, Excel and Record filing.
2. BIR DAT Files: choose QAP; show the record count, totals and warnings before Download.
3. Sales Invoices: New invoice for a commission debit note; the SI number in the registered range, VATable sales and VAT shown separately. Do not issue it unless the run sheet allows.
4. E-Invoicing (EIS): the banner shows test mode and the counters.
5. CAS Books and Documents: Readiness, a book of the month, the print register.

**Say:** "The returns, alphalists and DAT files come from the same ledger as the commission, and the reconciliation shows any difference before you file. Your tax adviser confirms the ATCs, rates, invoice wording and the VAT treatment; the EIS enrolment stays with the BIR."

## Integrations (5 minutes)

**Login:** beatriz.lacson.

**Click:**

1. Master > System Configuration > Integrations > Connectors: SMS, Viber, CTPL authentication, LTO feed, insurer API and bank files, each with its mode, credentials tick, waiting, failed and sent today, and what is missing before going live.
2. Outbox: a test SMS and a CTPL authentication with their attempts; Resend and Cancel message.
3. Insurer Integration: the sample mapping and Preview of the request exactly as the insurer will receive it.
4. Accounts > Bank Payment Files (as liza.quiambao): a batch, the approval by a second user, Write file and Import status file.

**Say:** "Every connection goes through one monitored outbox with retries, and the credentials stay in the server's secret store. The connectors are delivered in test mode: going live with each provider, insurer or bank is done during onboarding with the partner, who certifies its side."

## Dealer programmes (5 minutes)

**Login:** maria.rivera or jose.bernardo.

**Data:** programme TMK-TFS-2026 (Toyota Makati x TFS financed cars 2026: first year free paid by the dealer, CTPL 3 years, upload issues policies), TAL-CASH-2026 (Toyota Alabang, half subsidy, upload creates quotations, with an uploaded batch) and TCB-TFS-2026 (Toyota Cebu commercial pick-ups), from the sample data.

**Click:**

1. Operations > Sales & Marketing > Dealer Programmes. Open TMK-TFS-2026: rates, Who pays, Upload creates. Premium preview.
2. Template: the Dealer Sales upload template, one row per vehicle sold.
3. Bank endorsement letter: the letter to the bank with the mortgagee clause.
4. Reports > Operational Reports > Dealer Production: prospects, quotations, policies and premium per dealer.

**Say:** "A dealer's month of sales becomes prospects, quotations or issued policies in one upload, each billed to whoever pays, with the bank letter ready."

## Branding (3 minutes)

**Login:** beatriz.lacson.

**Click:**

1. Master > System Settings > Theme and Branding. Change the primary colour; the live preview and the contrast panel react. Do not save in a shared demo environment.
2. Sample document: a policy schedule printed with the theme, the logo and the footer line.
3. Document signatures: the slots per document and when they print.

**Say:** "Your brand is data, not code: screens, the sign-in page, documents, reports and e-mails follow it without a rebuild. A brand pack moves it from UAT to Production."

## Report Builder (3 minutes)

**Login:** maria.rivera.

**Click:**

1. Reports > Report Builder > Saved reports: open Premium by panel insurer (sample data).
2. Build: add a filter (line of business), group by insurer, Run; totals of the numeric columns.
3. Export to Excel. Point to Share with roles.

**Say:** "Ad hoc questions no longer wait for a new report. Each user sees only the rows their role may see."

# Discovery questions

Ask these during the demo, not as a list at the start. The note taker records the answers; they feed the workshop and the proposal.

## Business and volumes

- How many named users would sign in, per team (sales, placement, servicing, claims, accounting, management)?
- Which lines of business do you write, and which three carry most of the premium?
- How many insurers do you place with, and which are on direct bill?
- How many policies are in force, and how many new policies and renewals a month?
- Do you use referrers or sub-agents, and how many are paid each month?

## Process and pain

- Where does a policy's information live today, and how many times is it typed again?
- How do you know which premium has been collected but not yet remitted, per insurer?
- How long does the month-end close take, and what holds it up?
- How are BIR Form 2307 and the quarterly alphalists prepared today?
- How do you handle a client's request to see or delete their personal data?
- Who is your AML compliance officer, and how are covered and suspicious transactions reported today?
- How do you track licences, insurer certificates of authority and complaints?
- Do you work with motor dealers or banks, and how do their sales reach you?
- Which SMS gateway, CTPL authentication provider and insurers would you connect first?

## Decision

- Who decides, who signs, and who else must agree (IT, compliance, the board, a parent company)?
- Is there a date that drives the project: a system contract ending, an audit, a new branch?
- Do you prefer to host in the cloud, with a Philippine partner, or in your own data centre?
- Is the budget for a one-time licence, a monthly subscription, or not yet set?

# Run sheet

## Records to confirm the day before

| Part | Record in this script | What it shows | Actual number in the demo environment |
|---|---|---|---|
| Prospect | LD-2026-00061 Gregorio Evangelista | Prospect detail, Create Quote | |
| Quotation | QT-2026-00072 Bernard Bautista | Converted to Policy | |
| Quotation | One quotation in Pending Customer | Share, approval link | |
| Broker Slip | BS-2026-00047 Visayan Coconut Oil Mills Inc. | Market responses, Compare offers | |
| Placement Slip | PS-2026-00023 Longsod Builders and Developers Corp. | Security, Policy issued | |
| Policy | POL-2026-00019 Rowena Lim | Policy detail, endorsement types | |
| Claim | CLM-2026-00007 Renato Tan | Claim detail | |
| Renewal | OLD-MC-2025-39204 Joy Garcia | Renewal Queue | |
| Receipt | OR-2026-00035 Hilaga Logistics and Warehousing Corp. | E-mail receipt | |
| Remittance | REM-2026-00018 Pacific Crest Insurance Corp. | Tracking | |
| Approval | One remittance, voucher or journal waiting | Approval notification | |
| Debit note | DN-2026-00004 Harbor Point Non-Life Insurance Inc. | Direct bill | |
| Bank reconciliation | BRC-2026-00005, BDO-OPS, September 2026 | Workspace, Reconciliations | |
| Month-end close | MEC-2026-00005, 2026-09 | Steps and checklist | |
| BIR Form 2307 | Fourth quarter 2026, Issued by us | Payees and tax withheld | |

## If something goes wrong

| What happens | What to do |
|---|---|
| A screen is slow to load | Keep talking about the screen from the slide; reload once. Never sign in again in front of the audience. |
| A user is signed out | Switch to the next part and sign in again while the presenter talks. |
| A record is missing | Use the next record of the same kind in the list; the point is the screen, not the number. |
| A question about a feature that is not in OOTB | Say so plainly, note it for the fit-gap register, and explain that a change request is priced at the published day rates. |
| A question on price during the demo | Answer with the per-user price range from the slide and promise the full figures in the proposal. |

# After the demonstration

## Within one working day

- Send the thank-you e-mail with the brochure and the functionality document (see the Prospect E-mail Templates).
- Write up the answers to the discovery questions and share them inside iorta TechNXT.
- Book the workshop, or the follow-up demo for the parts the prospect asked to see in more depth.

## Before the proposal

- Run the pricing workbook with the user count and lines of business from the workshop.
- Pick the hosting option and add it as a separate line.
- Note every gap found in the demo or the workshop, with whether configuration covers it or a change request is needed.
