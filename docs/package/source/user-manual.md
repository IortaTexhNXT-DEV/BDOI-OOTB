---
title: User Manual
subtitle: BrokerVerse OOTB, by persona
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; LTO=Land Transportation Office; RFQ=Request for quotation; CTPL=Compulsory third party liability; DST=Documentary stamp tax; LGT=Local government tax; LGU=Local government unit; FST=Fire service tax; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; OR=Official receipt; SOA=Statement of account; PV=Payment voucher; JV=Journal voucher; GL=General ledger; DN=Debit note; KYC=Know your customer; TIN=Taxpayer identification number; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; IAR=Industrial all risks; PA=Personal accident; APPA=Auto passenger personal accident; SoD=Segregation of duties
---

# About this manual

## Purpose

BrokerVerse OOTB is the insurance broking system of iorta TechNXT for non-life brokers in the Philippines. One system covers the whole broking cycle: prospects, requests for quotation to insurers, quotations, placement, policy issue, billing and collection, remittance to insurers, commission, endorsements, claims, renewals, the general ledger, bank and insurer reconciliation, the month-end and year-end close and the BIR returns.

This manual tells each user how to do his or her work in BrokerVerse. It is organised by persona: each persona chapter lists the menus of the role, the daily and periodic tasks, and the step-by-step procedure for every screen the role uses, with the fields, the rules the system applies, the buttons, the status that results and what the system does next (the bill, the receipt, the journal, the notification) and where to find the record afterwards.

## How the manual is organised

| Chapter | Content |
|---|---|
| Getting started | Signing in, passwords, two-step verification, the screen layout, lists, forms, statuses and approvals, the audit trail. |
| The business process end to end | The broking cycle from prospect to reports, with who does each step and on which screen. |
| One chapter per persona | System Administrator; Sales & Marketing (Account Executive); Processing Team; Operations (client servicing); Claims; Accounting; Accounting Manager. |
| Module reference | Every menu screen in menu order: purpose, main fields and rules. |
| Reports, dashboards, schedules and notifications | A short guide; the Reports Book and the Schedules and Batch Jobs document hold the detail. |
| Troubleshooting, FAQ and glossary | Common messages and what to do, and the Philippine insurance and accounting terms used on the screens. |

Read Getting started and The business process end to end first, then the chapter of your persona. A task that two personas share is described in full once, in the chapter of the persona that owns it, and the other chapter points to it.

## Conventions

| Convention | Meaning |
|---|---|
| Operations > Sales & Marketing > Prospects | A menu path: open each item in the sidebar in turn. |
| **Create Prospect** | A button, tab, field or status, written exactly as it appears on the screen. |
| `limits.quote_validity_days` | A setting on Master > Configuration. The System Administrator maintains settings. |
| PS-2026-00023 | A record number from the test system shown in the screenshots. |
| PHP 1,250,000.00 | Amounts in Philippine pesos. The screens show the peso sign, for example ₱1,250,000.00. |
| 03/10/2026 | The screens show dates as DD/MM/YYYY (`general.date_format`) in Manila time (`general.timezone`). |
| Maker and checker | The maker enters a transaction; a different user, the checker, approves it. |

> The screenshots were taken on 03 October 2026 from a BrokerVerse OOTB test system loaded with realistic data: 61 prospects, 72 quotations, 48 requests for quotation, 23 placement slips, 82 policies, 8 claims and six months of accounting. The users in the screenshots are named staff of that test system, one or two per role. Your screens show your own data, and your menu shows only the items of your role.

# Getting started

## Signing in

Every person has his or her own user ID. Never share a user ID or a password: every action is recorded against the user in the audit trail.

![The sign-in page](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-login.png)

1. Open the BrokerVerse address given by your System Administrator in Chrome, Edge or Firefox.
2. In **User ID**, type your user name, for example maria.rivera.
3. In **Password**, type your password. Select the eye icon to show the password while you type; select it again to hide it.
4. Select **Login**.

BrokerVerse opens your landing page: the first dashboard your role may open, or the first screen of your menu. One more step can follow the password:

| Screen after the password | When it appears |
|---|---|
| **Change password** | You signed in with a temporary password, an administrator has reset your password, or your password is older than 90 days (`security.password_max_age_days`). |
| **Two-step verification** | Two-step verification is on for your user. |
| Set up two-step verification | Your role must use two-step verification (`security.require_2fa_roles`) and you have not set it up yet. |

### Password rules

The rules come from the security settings. With the delivered settings a password must:

- have at least 8 characters (`security.password_min_length`);
- contain an upper-case letter (A-Z), a lower-case letter (a-z), a digit (0-9) and a symbol, for example ! @ # $;
- differ from your last 5 passwords (`security.password_history_count`).

Every screen where you choose a password lists these rules under **New password** and ticks each rule as soon as the new password meets it.

![Change password at the first sign-in, with the rules ticked as the new password meets them](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-change.png)

1. In **Current password**, type the password you signed in with.
2. In **New password**, type the new password and check that every rule is ticked.
3. In **Confirm new password**, type it again.
4. Select **Change password and continue**. **Cancel** returns to the sign-in page.

To change your password at any other time, select your initials at the top right, then **Change password**. Fill in **Current password**, **New password** and **Confirm new password** and select **Change password**. Other computers and browsers where you are signed in are signed out; your current session continues.

![Profile menu > Change password](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-change-pw.png)

### Forgotten password

1. On the sign-in page, select **Forgot password?**.
2. On **Reset your password**, type your **User ID or e-mail address** and select **Send code**. If the account exists and has an e-mail address, BrokerVerse e-mails a 6-digit code to it. The message on screen is the same whether or not the account exists.
3. Type the code, the new password and the confirmation, then reset the password.
4. Select **Back to sign in** and sign in with the new password.

![Forgot password: Reset your password](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-forgot.png)

The code is valid for 15 minutes (`security.reset_code_minutes`) and is withdrawn after 5 wrong entries (`security.reset_code_max_attempts`). If your user has no e-mail address, or e-mail sending is not switched on, ask the System Administrator to reset your password.

### Failed sign-ins and locked accounts

A wrong user ID or password shows a message under the **Login** button. After 5 failed attempts in a row the user is locked (`limits.max_login_attempts`). The system also allows only 10 sign-in attempts in 5 minutes per computer and per user name (`security.login_rate_limit`). A locked user asks the System Administrator to unlock the account (System Administrator chapter, Users).

### Two-step verification

Two-step verification adds a 6-digit code from an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator. Any user can turn it on. The System Administrator can make it compulsory for roles with `security.require_2fa_roles`; no role requires it in the delivered set-up. iorta TechNXT recommends it for the System Administrator, Accounting and Accounting Manager roles.

![Profile menu > Two-factor authentication](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-2fa-status.png)

1. Select your initials at the top right, then **Two-factor authentication**. The dialog says whether two-step verification is on or off.
2. Select **Turn on**.
3. In the authenticator app, add an account and type the setup key shown on the screen. On a phone you can open the link to the authenticator app instead.
4. Type the 6-digit code the app shows and confirm.

From then on the sign-in page asks for the **Authentication code** after the password. Open the app, type the current code and select **Verify**. The page waits 5 minutes for the code (`security.two_factor_challenge_minutes`).

![Sign-in: Two-step verification](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-2fa.png)

To turn it off, open **Two-factor authentication** again and turn it off with a current code. A role that requires it cannot turn it off. If you lose your phone, the System Administrator turns it off for your user and you set it up again.

### Automatic sign-out

After 30 minutes without activity BrokerVerse signs you out (`limits.session_idle_minutes`). Anything not saved on the screen is lost, so save before you leave your desk. Your session also ends when your password is changed or reset, when your user is deactivated and when your role changes. To sign out yourself, select your initials, then **Logout**.

## The screen layout

![Screen layout: sidebar on the left with the search menu; language, notification bell and profile at the top right; the work area](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-layout.png)

| Area | What it does |
|---|---|
| Logo and name | The logo and application name set on Master > System Settings. |
| **Search menu...** | Type part of a screen name, for example quot. The list shows each matching screen of your menu with its path; select one to open it. |
| Sidebar menu | The menus of your role, in business order: Dashboard, Operations, Accounts, Commission, Reinsurance, Reports, Master, Product Configurator. Select a menu to open its items. |
| Language | The screen language. The delivered system offers English. |
| Notification bell | The number of unread notifications. Select the bell to see the latest. |
| Profile (your initials) | Your name and e-mail, then **Profile**, **Change password**, **Two-factor authentication**, **Help** and **Logout**. |
| Work area | The screen you opened, with its title and the breadcrumb (for example Home • Prospects). |

![Menu search: typing "quot" lists the quotation screens of the role](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-menu-search.png)

![The profile menu](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-profile.png)

### Notifications

BrokerVerse notifies you when something needs your action or concerns your work: a quotation sent for approval, a premium payment to verify, a new claim, a settlement waiting for approval, a renewal notice sent, a treaty waiting for approval, a close run to approve. Approval requests go only to users who may approve them.

Select the bell to see the latest notifications. Select a notification to open the record it concerns. Select **See More** for the full **Notification** page, which lists every notification with its title, message, type (Info, Task, Approval, Reminder and others) and time.

![The Notification page](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-notif-page.png)

### Your profile

Select your initials, then **Profile**, to see your name, e-mail address and contact details. Select **Edit Profile** to correct them.

## Roles and menus

Your role decides which menus you see and which screens you may open. The server checks the same permissions on every request, so a screen missing from your menu is refused even if its address is typed in.

| Persona (role) | Users in the screenshots | Top-level menus |
|---|---|---|
| System Administrator (Super Admin Access) | BrokerVerse, beatriz.lacson | Every menu |
| Sales & Marketing (Account Executive) | maria.rivera, paolo.dizon | Dashboard, Operations, Commission, Reports, Product Configurator |
| Processing Team (Placement & Policy Processing) | jose.bernardo, rica.fernandez | Dashboard, Operations, Reinsurance, Reports, Product Configurator |
| Operations (Client Servicing) | ana.buenaventura | Dashboard, Operations, Reports, Product Configurator |
| Claims | carlo.estrada, joy.macaraeg | Dashboard, Operations, Reinsurance, Reports |
| Accounting | liza.quiambao, nestor.pangilinan | Dashboard, Operations, Accounts, Commission, Reinsurance, Reports, Master |
| Accounting Manager | teresa.villaroman, ramon.almario | The menus of Accounting |

Each persona chapter lists the exact items of each menu. The Accounting Manager holds the Accounting role as well, so the menus are the same; the difference is in the approvals.

If you open the address of a screen your role may not use, BrokerVerse shows that you are not authorised. Choose a screen from your menu instead.

![A Claims user opening Accounts > Receipts by its address](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-not-auth.png)

## Working with lists

Most screens open on a list. The lists work the same way everywhere:

- **Search**: type in the search box above the list. Some lists have a field selector next to the box (for example **Policy Number**) that sets which column is searched.
- **Filters**: select **Show Filters** where offered, choose the values (status, product, insurer, dates, amounts) and select **Apply Filters**. **Clear Filters** removes them; **Hide Filters** closes the panel.
- **Tabs and cards**: many lists have status cards or tabs at the top (for example **Motor**, **Fire and Allied Perils**, **Industrial All Risks** on Prospects). Select a card or tab to narrow the list.
- **Sorting**: select a column heading to sort by it; select it again to reverse the order.
- **Paging**: lists are paged by the server, 20, 50 or 100 rows per page (**Rows per page**). Use the arrows at the bottom right (first, previous, next, last page). The text next to the arrows shows the rows on screen and the total, for example 1 - 20 of 82. Search and filters apply to the whole list, not only to the page on screen.
- **Row actions**: at the end of the row. The arrow or eye opens the record, the pencil edits it, the three dots (**More Actions**) open the other actions. An action that does not apply to the row is greyed out.
- **Export**: lists that can be exported have **Export**, **Export CSV**, **Excel** or **Generate Report**. The file downloads to your computer.

![Operations > Policy with the filters opened](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-filters.png)

Status tags are coloured: green for completed, active or paid; amber for pending or waiting; red for rejected, overdue or declined.

## Working with forms

- Required fields are marked with a red asterisk (*). A form cannot be saved until every required field is filled in.
- Lists in a form (insurer, product, province, city) offer only active master records. Where one list depends on another, choose the first one first: country, then province, then city; vehicle brand, then model, then variant.
- When a value breaks a rule, the message appears in red under the field or in a message box at the top, for example a mobile number that is not a Philippine number, a date of loss outside the policy period, or co-insurance shares that do not total 100%. Correct the field and save again.
- Add and edit forms of the masters and of several accounting screens open as a panel on the right-hand side of the screen. Longer forms (a request for quotation, a placement slip, a receipt) open as a page of their own.
- **Save** (or the action named on the button, for example **Save and submit to market**, **Record payment**, **Create Placement Slip**) stores the record. **Cancel**, **Back** or the X closes the form without saving. Nothing is stored until you save.
- After a save the system shows a confirmation at the top right and, for most records, the number it issued (for example PS-2026-00023). Many lists highlight the new row.
- Uploads accept the formats named under the field, for example PNG, JPEG or PDF up to 2 MB for claim documents, .xlsx or .csv up to 10 MB for bulk uploads. Bulk uploads offer **Download Template**: use it, because the template has the exact columns.

## Statuses, approvals and maker-checker

Every record carries a status that tells where it is in its life: a quotation goes from Draft to Pending Customer to Customer Accepted to Converted to Policy; a placement slip from Draft to Sent to insurer to Bound to Policy issued. The persona chapters give the statuses of each record and the module reference lists them all.

Maker-checker means that the user who enters a transaction cannot approve it. BrokerVerse refuses the approval with a message when the maker tries, and notifies the users who may approve. The maker-checker points are:

| Transaction | Maker | Checker | Setting |
|---|---|---|---|
| Quotation approval | The creator of the quotation | Another user; the Processing Team is notified | `workflow.quote_maker_checker` |
| Renewal terms | Operations or Sales & Marketing | Processing Team | `renewals.maker_checker` |
| Claim settlement | The Claims user who submits it | Another Claims user | `claims.settlement_maker_checker` |
| Journal voucher, correction and reversal | Accounting | Another Accounting user or the Accounting Manager | `journal.require_approval`, `finance.maker_checker_enabled` |
| Payment voucher, cheque, commission payout, petty cash | Accounting | Another Accounting user | `finance.maker_checker_enabled` |
| Remittance, settlement and adjustment | Accounting | Another user within the Remittance approval or Remittance settlement limit (Accounting up to PHP 1,000,000.00, Accounting Manager without limit) | Authority Matrix |
| Commission debit note (direct bill) | Accounting | Another Accounting user | built in |
| Incentive calculation batch | Accounting | Another Accounting user | built in |
| Month-end and year-end close | Accounting | Accounting Manager | `accounting.period_close_requires_approval` |
| Bank reconciliation, insurer statement reconciliation, credit control decisions | Accounting | Accounting Manager | built in |
| Posting rule and account determination changes | Accounting Manager or System Administrator | Another of them, on Configuration Approvals | built in |
| Reinsurance treaty | Creator | Another user | `reinsurance.treaty_requires_approval` |

On top of maker-checker, the **Authority Matrix** (Master > Generals > User Management) can set the largest amount each role may approve per transaction type, and **Segregation of Duties** rules stop conflicting roles being given to the same person. `access.authority_enforced` and `access.sod_enforced` are on in the delivered set-up.

## Where the audit trail is

BrokerVerse records every create, change, approval, report run and sign-in with the user, the time and the values before and after.

| Where | What you see | Who |
|---|---|---|
| Master > Audit Trail | Every audited action, searchable by record type, record ID, user and dates. | System Administrator |
| **Audit Trail** tab of a quotation | Every change of the quotation with date, field, old and new value and user. | Users who open the quotation |
| Claim audit trail (icon on the claims list) | Every status change of the claim with user and time. | Claims |
| History of a period, reconciliation, close run or posting rule | Each status change with user, time and remarks. | Accounting, Accounting Manager |
| **Prepared by**, **Submitted by**, **Approved by** on approval screens | The maker and the checker of the record. | Users of the screen |
| Master > Generals > User Management > User, **Sign-in history** | Every sign-in attempt of a user with result, method, IP address and browser. | System Administrator |

# The business process end to end

## The broking cycle

Every piece of business passes through the same cycle. Each step is done on its own screen, usually by a different team, and each step leaves a numbered record behind. The diagram shows the cycle; the numbered list and the table below give the detail.

![The broking cycle in BrokerVerse, with the persona responsible for each step](/home/user/BDOI-OOTB/docs/package/source/manual-images/process-flow.png)

1. **Prospect.** The person or company that may buy insurance is recorded with contact details and address. Number LD-YYYY-NNNNN.
2. **Quick quote or request for quotation.** A package product with a tariff (motor, CTPL) is priced on the spot with Quick Quote. A non-package risk (fire, IAR, marine, engineering, casualty, employee benefits) is presented to several insurers with a Request for Quotation (broker slip). Number BS-YYYY-NNNNN.
3. **Insurer offers and comparison.** Each insurer's offer or decline is recorded against the request (OFR-YYYY-NNNNN). The offers are ranked by gross premium and compared, and the security is chosen: one insurer at 100%, or a lead insurer and co-insurers with shares that total 100%.
4. **Quotation.** The chosen terms are priced for the client in a Quotation Slip: net premium, VAT, documentary stamp tax, local government tax, fire service tax where it applies, CTPL for motor, gross premium and commission. Number QT-YYYY-NNNNN.
5. **Customer response.** The quotation is sent to the client for approval. The client accepts through the approval link, or the account executive records the answer received by e-mail, phone, Viber or WhatsApp, meeting or signed form: Accepted, Declined or Revise.
6. **Placement slip.** For a risk that needs a firm order, the placement slip goes to the lead insurer and the co-insurers. Each insurer confirms its share with its policy or certificate number; when all have confirmed the slip is Bound. Number PS-YYYY-NNNNN.
7. **Policy issuance.** The policy is issued from the bound placement slip, from the accepted quotation (motor and package lines) or recorded after the insurer issued it. The client record is created from the prospect. Numbers POL-YYYY-NNNNN and CL-YYYY-NNNNN.
8. **Billing.** At issue the system raises the premium bill to the client (broker billed) or books the commission due from the insurer (direct bill), and posts the journal with each insurer's payable and commission on its own line. Numbers INV-YYYY-NNNNN and JV-YYYY-NNNNN.
9. **Receipt and collection.** Operations or the account executive records how the client paid; Accounting verifies the payment and posts the official receipt against the bill. Collections follows unpaid premium by ageing bucket and sends reminders. Numbers OR-YYYY-NNNNN and RT-YYYY-NNNNN.
10. **Remittance to the insurer.** Collected premium, net of the broker's commission and its taxes, is remitted to each insurer by its share, through a remittance, an insurer settlement and a payment voucher, each approved by a second user. Numbers REM-, SET- and PV-.
11. **Commission.** The commission share of the agent or referrer (comsub) becomes eligible when the premium is fully collected, is approved by a second Accounting user and is paid by payment voucher less withholding tax. For direct-bill policies the broker bills its commission to the insurer with a debit note (DN-).
12. **Endorsements.** A change to an issued policy (client details, vehicle, cover, period, cancellation) is requested, sent to the insurer and completed with the insurer's endorsement. Additional premium is billed and return premium credited. Number END-.
13. **Claims.** A loss is registered against the policy, the Preliminary Loss Advice goes to the insurer, the adjuster report and the assessment are recorded, and the settlement is approved by a second Claims user. Number CLM-.
14. **Renewals.** Policies enter the renewal pipeline 90 days before expiry, renewal notices go out 60, 30 and 15 days before, renewal terms are negotiated and approved, and the renewed term becomes a new policy.
15. **Bank and insurer reconciliation.** Each bank statement is imported and matched with the books; each insurer's statement of account is imported and matched with the remittances and debit notes. Accounting prepares; the Accounting Manager approves. Numbers BST-, BRC- and ISR-.
16. **Month-end close.** Accounting runs the close steps and the checklist for the period and submits the close; the Accounting Manager approves and the period closes. Number MEC-. The year-end close (YEC-) follows the twelfth month.
17. **Reports.** Production, claims, renewal, remittance and commission registers, the statement of account, the trial balance and financial statements, and the BIR forms and alphalists (VAT summary, SAWT, QAP, SLSP, BIR Form 2307).

## Who does each step and where

| # | Step | Persona | Screen |
|---|---|---|---|
| 1 | Prospect | Sales & Marketing, Operations | Operations > Sales & Marketing > Prospects |
| 2 | Quick quote | Sales & Marketing, Operations | Operations > Sales & Marketing > Quick Quote, Compare Insurers |
| 2 | Request for quotation | Processing Team (Sales and Operations can start one) | Operations > Sales & Marketing > Request for Quotation (Broker Slip) |
| 3 | Insurer offers and comparison | Processing Team | Request for Quotation: tabs Market responses, Compare offers |
| 4 | Quotation | Sales & Marketing, Operations; Processing Team for quotation slips from a request | Operations > Sales & Marketing > Quotations |
| 5 | Customer response | Client (approval link); Sales & Marketing records other answers | Quotation: **Send for Customer Approval**, **Record customer response** |
| 6 | Placement slip | Processing Team | Operations > Sales & Marketing > Placement Slips |
| 7 | Policy issuance | Processing Team; Sales & Marketing and Operations for motor and package quotations | Placement Slip: **Issue Policy**; Quotation: **Proceed to Policy**; Placement Slips: **Record Issued Policy** |
| 8 | Billing | System, at issue; Accounting for direct-bill debit notes | Policy: Premium Accounting Entries; Accounts > Remittance > Direct Bill Processing |
| 9 | Receipt and collection | Operations or Sales record the payment; Accounting posts the receipt | Policy: **Proceed to Payment**; Accounts > Receipts; Accounts > Collections |
| 10 | Remittance to insurer | Accounting, maker and checker | Accounts > Remittance; Accounts > Disbursement |
| 11 | Commission | Accounting, maker and checker | Commission > Agents/Referrer Accounts; Accounts > Disbursement |
| 12 | Endorsements | Operations raise; Processing Team complete | Operations > Policy: **More Actions** > **Endorsement** |
| 13 | Claims | Claims, maker and checker | Operations > Policy: **More Actions** > **Claim**; Operations > Claims |
| 14 | Renewals | Operations, Sales & Marketing; Processing Team approve terms | Operations > Renewals |
| 15 | Bank and insurer reconciliation | Accounting; Accounting Manager approves | Accounts > Bank Reconciliation; Accounts > Insurer Reconciliation |
| 16 | Month-end close | Accounting; Accounting Manager approves | Accounts > Period End > Month-End Close |
| 17 | Reports | Every role, per its menu | Reports; Accounts > Tax; Dashboard |

## The placement journey by line

Not every line uses every step. The steps a line must, may or does not use are set in `placement.journey` (Master > Configuration, area Sales, Quotations & Placement). In the delivered configuration every step is optional for every line: a risk can be quoted and issued from a quotation, marketed with a request for quotation, bound with a placement slip, or recorded after the insurer issued the policy. When the System Administrator makes a step Required for a line, the policy of that line cannot be issued without it, and a step set to Not used is refused with a message that names the line.

Each quotation, request for quotation and placement slip shows its journey as a progress bar: **Request for Quotation**, **Quotation Slip**, **Placement Slip**, **Sent to insurer(s)**, **Bound / confirmed**, **Policy**. Each step shows the number of its record, or Optional, Required or Not used.

## What the system posts

Every journal is built from the posting rule of its business event (Master > Finance > Posting Rules); **Accounting Flow** shows, for each event, the screen that triggers it, the approval before it posts and the accounts it debits and credits. The main events of the cycle:

| Event | Journal (summary) |
|---|---|
| Policy issued, broker billed | Dr Premiums Receivable at the gross premium; Cr Premiums Payable to Insurers (each insurer by its share), the premium VAT, DST and LGT due to insurers, and Brokerage Commission Income. |
| Policy issued, direct bill | Dr Commission Receivable from the insurer; Cr Brokerage Commission Income and Output VAT. No premium bill. |
| Official receipt | Dr Cash in Bank (or the account of the receipt mode); Cr Premiums Receivable. |
| Remittance settlement paid | Dr Premiums Payable to Insurers; Cr Cash in Bank. |
| Commission approved and paid | Dr Commission Expense; Cr Commission Payable; at payout Dr Commission Payable; Cr Cash in Bank and Withholding Tax Payable. |
| Endorsement | Additional premium: as a new bill. Return premium: the reverse, and the refund due from each insurer when the premium was already remitted. |
| Debit note collected | Dr Cash in Bank and Creditable Withholding Tax (BIR Form 2307); Cr Commission Receivable. |

Each payable and commission line carries the insurer, so the remittance, the Co-insurance Register and the Due to Insurers by Co-insurer report show each insurer's part. A rounding difference of a share split goes to the lead insurer.

# System Administrator

## Role summary

The System Administrator (role System Administrator (Super Admin Access)) sets up and looks after BrokerVerse: users and roles, access controls, the company and its letterhead, the masters (insurers, products, covers, locations, banks, chart of accounts, tax codes), document numbering, the configuration settings, the schedules, the e-mail outbox and the audit trail. The role sees every menu and can open every screen of the other personas. Keep it for administration and give each person a business role for daily work; give the System Administrator role to as few people as possible.

![Landing page of the System Administrator](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-landing.png)

## Menus available

Every menu: Dashboard, Operations, Accounts, Commission, Reinsurance, Reports, Master and Product Configurator. The menus used for administration are:

| Menu | Items |
|---|---|
| Master | System Settings, Configuration, Document Numbering, Schedules, Audit Trail, E-mail Outbox, Data Privacy (Data Subject Requests, Consent Register) |
| Master > Generals | Organization (Company, Branch); Insurance Management (Insurance Company, Line of Business, Product, Cover, Signatories, Vehicle); Location (Country, State, City); Employee Management (Hierarchy, Designation); User Management (User, Role, User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews) |
| Master > Finance | Account Determination, Posting Rules, Configuration Approvals, Accounting Flow, Package Bundles, Insurer Rate Tables, Premium Taxes & LGU Rates, Payment Gateways, Commission Rate Matrix, Transaction Code, Currency, Exchange Rate, Bank, Account Category, Main Account, Sub Account, Taxation, Close Checklist, Bank Statement Formats, Bank Transaction Types, Insurer Statement Formats, Remittance Master, Incentive Programs, Reinsurance Treaty |

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Unlock users and reset passwords on request | Master > Generals > User Management > User |
| Daily | Check the e-mail outbox for failed messages | Master > E-mail Outbox |
| Daily | Check that the schedules ran (Last status) | Master > Schedules |
| On request | Add a user, change a role, deactivate a leaver | User Management > User |
| On request | Add or change insurers, products, covers, banks and other masters | Master > Generals, Master > Finance |
| On request | Change a business setting agreed with the process owner | Master > Configuration |
| Monthly | Review users without two-step verification, dormant users and segregation-of-duties conflicts | User Management > User Access Matrix |
| Quarterly | Run an access review | User Management > Access Reviews |
| Before go-live | Company and letterhead, official receipt numbering to match the Authority to Print, security settings, e-mail settings | Company, Document Numbering, Configuration |

## Users

### Add a user

![Master > Generals > User Management > User > Add](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-user-add.png)

1. Choose Master > Generals > User Management > User and select **Add**.
2. Enter **Username** (the user ID used to sign in), **E-mail** and **Display Name**. All three are required. The e-mail is where Forgot password? sends its code.
3. Leave **Password** empty: the system then generates a temporary password ("Leave empty for a temporary password").
4. Under **Roles**, tick the role or roles. A person normally holds one role. The Accounting Manager role includes Accounting. When `access.sod_enforced` is on, a combination listed on Segregation of Duties with the action Block is refused.
5. Select **Save**. The temporary password is shown once. Hand it to the user privately.

A duplicate username is refused. At the first sign-in the user must choose a new password (Getting started).

### Account actions

![User list with the account actions of a user](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-user-actions.png)

The user list shows **User Name**, **Assigned Role**, **E-mail**, **Display Name**, **Status** and **Action**. The three dots at the end of a row (**Account actions**) offer the actions that apply to the user:

| Action | Use it when |
|---|---|
| Unlock | The user is locked after 5 failed sign-ins. |
| **Reset password** | The user forgot the password and cannot use Forgot password?. A temporary password is shown once and every session of the user ends. |
| Turn off two-step verification | The user lost the phone with the authenticator app. |
| **Sign-in history** | Every sign-in attempt of the user with date, result, method, IP address and browser. |

The eye opens the user, the pencil edits the display name, e-mail and roles (a role change ends the user's open sessions), and the **Status** switch deactivates a leaver. Records of a deactivated user are kept. The daily Dormant accounts job deactivates users who have not signed in for 90 days (`access.dormant_days`).

### Roles and role permissions

**Role** lists the seven roles. **Role Permissions** shows, for each permission (for example read:receipts, write:bank-reconciliation, approve:period-end), which roles hold it. A role that builds on another (the Accounting Manager on Accounting) also has that role's permissions. **Edit roles** changes the permissions of a role; do this only with the process owner, because the menus and the server checks follow the permissions.

![Master > Generals > User Management > Role Permissions](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-role-permissions.png)

### User Access Matrix

The matrix lists every user with roles, branch, status, last sign-in, two-step verification, password age and segregation-of-duties conflicts. The cards at the top count **Active users**, **Dormant (90+ days)**, **Segregation-of-duties conflicts** and **Active without two-factor**; select a card to filter the list. **Export to Excel** downloads the matrix for an access review; **Sign out everywhere** ends every session of a user.

![Master > Generals > User Management > User Access Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-access-matrix.png)

### Authority Matrix

The Authority Matrix holds the approval limits per role and transaction type: amounts in PHP, discounts in percent of premium (for example a quotation discount of 10% for Sales & Marketing, policy issuance up to PHP 1,000,000.00). A role with **Not set** is not restricted by the matrix for that transaction type. **Limit for one person** sets a personal limit for one user. A change applies once a second administrator approves it.

![Master > Generals > User Management > Authority Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-authority.png)

### Delegations

A delegation lets another user approve for an approver who is away.

1. Choose User Management > Delegations and select **New delegation**.
2. Choose **Approver away** and **Covered by**, the **Transactions** covered (**All transactions** or a type), **From** and **To** dates and the **Reason**.
3. Select **Save**.

![New delegation](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-delegation-new.png)

### Segregation of Duties

Each rule names two roles that one person should not hold together, what happens when they are assigned (**Block**), the reason and the status. The delivered rules are SOD-CLM-ACCT (Claims and Accounting: the claims handler should not also release claim payments), SOD-PROC-ACCT (Processing Team and Accounting: the person who places and issues business should not also release premium to insurers) and SOD-PROC-MGR (Processing Team and Accounting Manager). **New rule** adds a rule; **Switch off** disables one.

![Master > Generals > User Management > Segregation of Duties](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-sod.png)

### Access Reviews

Confirm at least every quarter that each active user still needs his or her access. **Start a review** creates the review with every active user; for each user choose **Keep** or **Revoke** (the decision starts as **To review**). The closed review is kept as the audit record.

## Company, branches and the letterhead

![Master > Generals > Organization > Company > Add](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-company-add.png)

Every printed document and report PDF (quotation, request for quotation, placement slip, policy schedule, billing statement, official receipt, payment voucher, debit note, claim letters, BIR forms) carries the letterhead of the company marked as letterhead company.

1. Choose Master > Generals > Organization > Company. Select **Add**, or the pencil on the delivered company to edit it into your own.
2. Enter **Company Code**, **Company Name**, **License Number** (Insurance Commission licence), **Email ID**, **TIN**, **Logo (printed on documents)** (a link, or **Upload**), **Website link**, **Description**, **Address Line 1** to **3**, **ZIP Code**, **City**, **State**, **Country**, **Phone Number** and **Fax** (+63 numbers).
3. Tick **Letterhead company - used on documents and reports** for the company whose letterhead the documents use. Only one company holds it.
4. Select **Save**, then print any statement or report as PDF to check the letterhead.

The application name and logo of the sign-in page and the sidebar come from Master > System Settings, not from the Company master. Branches are kept on Master > Generals > Organization > Branch in the same way.

## Insurers and the other masters

### Insurance companies

![Master > Generals > Insurance Management > Insurance Company > Add](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-insurer-add.png)

1. Choose Master > Generals > Insurance Management > Insurance Company and select **Add**.
2. Enter **Insurance Company Code**, **Insurance Company Name**, **Insurance Company Description**, the address (**Address Line 1** to **3**, **City**, **State**, **Country**), **Phone Number**, **Email ID** and **TIN**.
3. Under **Credit terms**, enter **Premium payment warranty (days)** (days the client has to pay: the due date of the premium bill), **Remittance terms (days)** (days after collection within which the broker remits to the insurer) and **Default billing mode** (broker billed or direct bill). Leave them empty to use the system defaults (`collections.default_credit_days`, `remittance.default_due_days`, `direct_bill.default_billing_mode`).
4. Select **Save**.

Requests for quotation, placement slips, Preliminary Loss Advices and remittance advices go to the insurer's e-mail. Keep it current.

### Masters that work the same way

All masters work alike: a list with search, **Add** (the form opens on its own page or as a panel on the right), **Upload** where offered, the eye to view, the pencil to edit and a status switch to deactivate. Records are not deleted; a deactivated record no longer appears in the lists of the other screens.

| Master | Holds |
|---|---|
| Line of Business, Product, Cover | The lines, products and covers offered in the quotation and placement screens. |
| Signatories | Authorised signatories of quotations and documents. |
| Vehicle | Vehicle brands, models, variants and seating; **Upload** loads them from a template. |
| Country, State, City | The address lists (a province is a State). |
| Hierarchy, Designation | The staff structure. A staff member's branch, designation and reporting line are kept on the user (Master > Generals > User Management > User). |
| Transaction Code, Currency, Exchange Rate | Accounting transaction codes, currencies and rates. |
| Bank | Banks and the broker's bank accounts, each linked to its GL cash account and statement format. |
| Account Category, Main Account, Sub Account | The chart of accounts. |
| Remittance Master | Automated remittance, statement templates, settlement parameters, bulk processing formats, exceptions, agency bill, adjustment and notification templates. |

### Uploads

![Upload dialog of a master with Download template](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-upload.png)

1. Select **Upload**. Where a screen holds more than one record type, choose it in the dialog.
2. Select **Download template**. The workbook has a Data sheet with the header row and sample rows, a Columns sheet with the rules of each column, and an Instructions sheet.
3. Delete the sample rows, enter your data, save the file.
4. Choose the file and upload it. The result shows how many rows were created or updated and lists each failed row with its problem. Correct those rows and upload them again; an existing code updates the record.

## Document Numbering

![Master > Document Numbering, editing a series](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-docnum-edit.png)

Every number the system issues comes from a series on Master > Document Numbering: prospect, request for quotation, quotation, placement slip, policy, client, bill, official receipt, payment voucher, journal voucher, claim, endorsement, debit note, close run, reconciliation, BIR Form 2307 and the others. The list shows each series with module, prefix, format, counter reset, last number and next number.

1. Select **Edit** on the series.
2. Change **Name**, **Prefix** or **Format**. Click a token to add it: {PREFIX}, {YYYY}, {YY}, {MM}, {FY}, {BRANCH}, {LOB}, {SEQ}. {BRANCH} and {LOB} are filled by the transaction; when empty they are left out with their separator.
3. Set **Sequence digits** (5 gives 00001), **Counter reset** (for example **Every calendar year**) and **Start number (new period)**.
4. Check **Next number preview** and select **Save**.

**Set next number** continues the numbering of the old system; the counter only moves forward. The official receipt series must match the BIR Authority to Print. A prefix used by another active series is refused. Every change is in the audit trail.

## Configuration

![Master > Configuration: the business areas](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-config.png)

Master > Configuration holds every business parameter, grouped in areas: Company & Branding; Sales, Quotations & Placement; Policies, Endorsements & Renewals; Claims; Billing, Collections & Credit; Remittance & Reconciliation; Commission & Incentives; Accounting & Tax; Notifications & E-mail; Security & Access; Reports & Dashboards; Data Retention & Uploads. The search box finds a setting by its words, for example VAT or renewal notice.

1. Select the area. The list on the left switches between areas; **Related screens** link to the screens the settings affect.
2. Change the value. Numbers and text are typed, switches switched, lists edited as values or small tables, e-mail templates in a text box where you keep the {{placeholders}}. **Show advanced settings** shows the rarely changed ones.
3. Save. The change applies at once and is recorded in the audit trail with the old and new value.

![Configuration: the Security & Access area](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-config-area.png)

> Change tax rates, GL accounts and maker-checker switches only with the agreement of the Accounting Manager. Settings that control postings are protected: the system refuses a change that must go through Configuration Approvals.

**System Settings** (Master > System Settings) holds the branding and localisation: **App Title**, **Logo Preset**, **Upload Logo**, **Favicon**, **Display Currency**, **Default Language**, **Primary Color** and **Secondary Color**. **Save** applies them to every user, including the sign-in page.

![Master > System Settings](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-system-settings.png)

## Schedules

![Master > Schedules](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-schedules.png)

Master > Schedules lists the jobs the system runs by itself, with **Job**, **What it does**, **Schedule (Asia/Manila)**, **Status** (Scheduled or **Switched off**), **Next run**, **Last run** and **Last status**. Each row has three actions:

- **Run now** runs the job at once and shows the result.
- **Run history** lists the last runs with **Started**, **Finished**, **Status**, **Triggered by** and **Result**.
- **Edit schedule** changes the timetable (cron format, for example 0 6 * * * for 06:00 daily) and switches the job on or off. Check that **Next run** shows a date after every edit.

![Run history of a job](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-schedule-history.png)

The jobs, their times and what they do are listed in the BrokerVerse Schedules and Batch Jobs document.

## E-mail Outbox

![Master > E-mail Outbox](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-outbox.png)

Every e-mail the system queues (quotation approval links, requests for quotation, placement slips, loss advices, renewal notices, reminders, official receipts, premium invoices, debit notes) is listed with **Status**, **To**, **Subject**, **Record**, **Attachments**, **Attempts**, **Last error**, **Created** and **Sent**. **Attachments** names the PDF files sent with the message (official receipt, premium invoice, policy schedule, commission debit note); the PDF is produced when the message is sent. A message whose attachments exceed `email.max_attachment_mb` (10 MB) fails with the reason in **Last error**. The E-mail outbox job sends queued messages every 5 minutes; **Retry** sends a failed message again. Nothing leaves the system until **Send e-mails** (`notification.email_enabled`) is on and the mail server is set on the server; until then the screen says so and messages stay queued. Review the outbox before switching sending on.

## Audit Trail

![Master > Audit Trail](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-audit.png)

1. Enter a **Record type** (for example session for sign-ins, policy, receipt, placement), a **Record ID** or a **User**.
2. Enter **From date** and **To date**.
3. Select **Search**. The list shows **When**, **User**, **Record type**, **Record ID**, **Action** and **Change** (before and after values).

Use it for investigations, access reviews and to show that maker and checker were different people.

## Data privacy

The Data Privacy menu supports the broker's Data Protection Officer under the Data Privacy Act. The System Administrator and Operations roles hold the privacy permissions (`read:privacy`, `write:privacy`).

**Consent.** Consent is recorded on the client (tab **Data privacy**) and on the prospect view, per purpose: **Processing** (privacy notice acknowledged), **Marketing** and **Sharing with insurers**. Select **Record consent**, choose the purpose, **Given** or **Refused**, the channel (Form, E-mail, Phone, Portal, In person), the evidence and the notice version (the version in force, `privacy.notice_version`, by default). **Withdraw** ends a consent with a reason; the record stays in the history. Master > Data Privacy > Consent Register lists every consent of every client and prospect, with **Current status only** to see the latest per purpose.

**Requests.** Master > Data Privacy > Data Subject Requests is the register of requests:

1. Select **Log request**. Enter the requester name and contact, the request type (Access, Rectification, Erasure or blocking, Objection, Data portability, Withdraw consent), the request details and the date received. Search the client or prospect, or leave it empty while the requester is not yet identified.
2. Save. The request takes a number from the DSR series and a due date `privacy.request_due_days` (15) calendar days after the date received. The cards count **Open**, **Overdue**, **Completed** and **Rejected**.
3. Use the download icon (**Export personal data**) to give the data subject a copy, as JSON or Excel; the export is noted on the request.
4. For an erasure, use **Anonymise**. The dry run shows what would be cleared per record type, or why the data must be kept for now (for example policies in force, open bills or claims, or less than `privacy.retention_years` (10) years since the last policy expiry). Names are replaced by an anonymised label and contact details, addresses, ID numbers, birth date and personal notes are cleared; policy, receipt and claim numbers, amounts and dates are kept for the books.
5. Select **Close**, record the outcome told to the data subject, and close the request as Completed or Rejected.

The job `privacy-requests-due` (Master > Schedules, delivered switched off) notifies the privacy team every morning of open requests past their due date.

## Finance set-up shared with the Accounting Manager

The System Administrator can open every Master > Finance screen. The Accounting chapters describe them: Commission Rate Matrix, Posting Rules, Account Determination, Configuration Approvals and Accounting Flow (Accounting Manager chapter), Taxation, Close Checklist, Bank Statement Formats, Bank Transaction Types and Insurer Statement Formats (Accounting chapter), and Package Bundles, Insurer Rate Tables, Premium Taxes & LGU Rates and Payment Gateways (Module reference). Changes to posting rules and account determination wait for a second user on Configuration Approvals.

## Reinsurance treaties and incentive programmes

- **Master > Finance > Reinsurance Treaty**: **Add Treaty** with **Treaty Number**, **Treaty Name**, **Treaty Type** (quota share, surplus, excess of loss, stop loss), **Line of Business**, **Reinsurers**, **Effective Date** and **Expiry Date**, then the tabs Coverage & Limits and Commission. A new treaty needs a second user's approval (`reinsurance.treaty_requires_approval`); reinsurers must meet the minimum security rating A- (`reinsurance.min_security_rating`).
- **Master > Finance > Incentive Programs**: **Add Program** with the code, name, type (Target Based, Commission Based, Hybrid, Contest), target metric, base target, frequency and dates. Accounting calculates and pays the programmes but cannot change them.

## Approvals

The System Administrator approves posting rule and account determination changes of another user (Configuration Approvals), Authority Matrix changes of another administrator, and treaties created by another user. Business approvals belong to the business roles.

# Sales & Marketing (Account Executive)

## Role summary

The account executive (role Sales & Marketing (Account Executive)) finds and records prospects, quotes package products on the spot, asks the Processing Team to market non-package risks, sends quotations to clients and records their answers, records the client's payment for Accounting to verify, follows renewals and watches his or her own production and commission. Commission and incentives are earned on the policies the account executive produces (`commission.eligible_roles`, `incentive.eligible_roles`).

![Sales Dashboard of an account executive](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-sales-dashboard.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Executive Dashboard, Sales Dashboard |
| Operations | Home; Sales & Marketing (Prospects, Quick Quote, Compare Insurers, Request for Quotation (Broker Slip), Quotations, Placement Slips); Clients; Policy; Claims; Renewals (Renewal Policy, Renewal Batch, Renewal Queue, Retention Analytics, At-Risk Policies, Negotiations, Lapse Management, Performance); Open Items; Payments |
| Commission | Commission Dashboard |
| Reports | All Reports; Operational Reports (Production, Claims, Renewal, Remittance, Broker Commission) |
| Product Configurator | Dashboard, Product Templates |

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Record new prospects and follow them up | Prospects |
| Daily | Quote motor and other package products | Quick Quote, Quotations |
| Daily | Send quotations for customer approval; record the answers received | Quotations |
| Daily | Record the client's payment | Policy > **Proceed to Payment** |
| Daily | Work the quotations still with the customer and the pending payments | Open Items |
| Weekly | Follow up the renewals of your clients | Renewals > Renewal Queue, At-Risk Policies, Negotiations |
| Monthly | Check your production, commission and incentives | Sales Dashboard, Commission Dashboard, Reports > Operational Reports > Production |

## Sales Dashboard

Choose Dashboard > Sales Dashboard. The dashboard shows the prospects, quotations and new business of the sales team for the period chosen at the top (**All sales persons** or one person, **This month** or another period, or a **Custom range**): **Prospects**, **Quotations**, **Conversion** (quote to policy), **Policies issued**, **Premium** and **Open pipeline**, with the monthly trend, premium by product, the prospect pipeline and the quotation pipeline. **View prospects** opens the prospect list.

The Executive Dashboard is described in the chapter Reports, dashboards, schedules and notifications.

## Prospects

![Operations > Sales & Marketing > Prospects](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospects.png)

Choose Operations > Sales & Marketing > Prospects. The cards count **Total Prospects**, **Last 7 Days**, **Last 30 Days**, **Converted Prospects** (with the conversion rate), **With Quotations** and **Active Prospects**. The tabs **Motor**, **Fire and Allied Perils** and **Industrial All Risks** list the prospects of each line in a table with the columns **Prospect ID**, **Name**, **Category**, **Product line**, **Mobile**, **E-mail**, **Quotations**, **Created on**, **Status** and **Actions** (**View**, **Edit** and **Delete**). Use the search box (name or prospect ID), the **Category** filter and **Show Filters** (country, province, city) to narrow the list. The search, filters, tab and page are kept when you open a prospect and come back.

### Create a prospect

1. Select **Create Prospect**. The **Create prospect** panel asks whether the customer is new or already a client.
2. Choose **New customer** (enter the customer's details on the prospect form) or **Existing client** (find the client by name, mobile number or e-mail; the prospect is linked to that client), then select **Continue**.
3. Choose the product the prospect is for: **Motor**, **Fire and Allied Perils**, **Industrial All Risks**, **Employee Benefit**, or **Package products (Quick Quote)**.
4. Fill in the prospect form and select **Save & Continue**.

![Create prospect: new customer or existing client](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospect-create.png)

![Create prospect: the product the prospect is for](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospect-form.png)

![Create Prospect form for a motor prospect](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospect-motor.png)

| Field | Required | Rules |
|---|---|---|
| **Select Category** | Yes | **Retail** (a person) or **Corporate** (a company). Corporate asks for the company name and TIN. |
| **First Name**, **Last Name** | Yes | The prospect or the contact person. |
| **Preferred Name** | Yes | The name used in letters and e-mails. |
| **Date of Birth** | Yes | Not in the future; age 18 to 100 (`leads.min_age_years`, `leads.max_age_years`). |
| **Select Gender** | Yes | **Male** or **Female**. |
| **Email ID** | Yes | A valid e-mail address. Quotations and approval links are sent there. |
| **Contact Number** | Yes | A Philippine mobile number: 0917 123 4567 or +63 917 123 4567. |
| **Country**, **Province**, **City** | Yes | From the location masters; choose the country first, then the province, then the city. |
| **ZIP Code** | Yes | 4 digits. |
| **Barangay / Subd**, **House No / Unit No / Street** | Yes | The street address. |

The system gives the prospect its number (LD-YYYY-NNNNN) with status New and, for a motor prospect, opens **Create Quote** for it. Fire and Allied Perils and Industrial All Risks prospects also ask for the risk location and the sums insured.

### View, edit or delete a prospect

![Prospect Details](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospect-detail.png)

Select **View** on a prospect card. **Prospect Details** shows **Personal Information**, **Contact Information**, **Address Information** and **System Information** (created, last updated, number of quotes). Select **Create Quote** to start a quotation, **Edit** to correct the prospect (the form shows the same fields; select **Update** to save), **Delete** to remove a prospect entered by mistake, or **Back**. Keep prospects that have quotations.

| Prospect status | Set when |
|---|---|
| New | The prospect is created. |
| Contacted, Qualified | The prospect is followed up. |
| QuoteGenerated | A quotation is saved for the prospect. |
| Converted | A policy is issued from one of its quotations; the prospect becomes a client. |
| Lost | The prospect does not buy. |

### Upload many prospects

1. Select **Bulk Upload**.
2. Select **Download Template** and fill in one prospect per row.
3. Select **Choose File**, choose the file (.xlsx or .csv, at most 10 MB) and select **Upload**.

The system checks every row and reports the rows it could not load with the reason. **Generate Report** downloads the prospect list as a spreadsheet.

![Bulk upload prospects](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospect-bulk.png)

## Quick Quote and Compare Insurers

![Operations > Sales & Marketing > Quick Quote](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quick-quote.png)

Quick Quote lists the package products: standard tariff and wording, quoted on the spot. Each card shows the product, whether it is for retail or corporate clients, and one of two buttons:

- **Start quote**: the product has a quote wizard (Motor Vehicle Insurance, Compulsory Third Party Liability). Enter the customer and the vehicle; the premium is priced from the tariff. The wizard starts with the prospect form when the customer is not yet a prospect.
- **Request quotation**: the product has no quote wizard yet. The button opens a Request for Quotation so the Processing Team gets the terms from the insurers.

**Request for Quotation (non-package)** at the top opens a new request for a risk that is not a package product.

**Compare Insurers** shows the premiums of several insurers side by side for a package product, from their rate tables (Master > Finance > Insurer Rate Tables). Choose the **Product**, the **Sum insured**, the **Location of the risk** (the city or municipality decides the local government tax) and the **Inception date**, then select **Compare**. An insurer without a rate for the product is not listed.

![Operations > Sales & Marketing > Compare Insurers](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-compare-insurers.png)

## Create a motor quotation

A motor quotation has five steps. Nothing is saved until **Completed Quote** on the last step, so you can move with **Back** and **Next**.

1. Open the prospect (Prospects > **View**) and select **Create Quote**, or select **Start quote** on Quick Quote.
2. **Policy Details** and **Insurance Vehicle Details**: fill in the fields below and select **Next**.
3. Plan recommendations: keep the recommended plan or choose another, then **Next**.
4. Coverage details: fill in the covers, select **Calculate**, check the premium, then **Next**.
5. Accessories and policy limits, then **Next**.
6. Order summary: set the discount, the referrer and the signatory, then select **Completed Quote**.

![Create Quote, step 1: Policy Details and Insurance Vehicle Details](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quote-step1.png)

| Field (step 1) | Required | Meaning and rules |
|---|---|---|
| **Co-Insurance** | No | Tick when more than one insurer shares the risk; a table appears for the co-insurers and their shares (total 100%, one lead). |
| **Insurance Company Name** | Yes | The insurer that will issue the policy. |
| **Insurance Policy Type** | Yes | Comprehensive, Own Damage / Theft or Third Party Liability. |
| **Referrer (agent / account code)** | No | The agent or referrer credited with the business; active referrers only. |
| **Payment Type** | Yes | Cash or Credit. |
| **Vehicle Type** | Yes | The Insurance Commission vehicle class; it sets the CTPL tariff, the default seats and the own damage rate. |
| **Vehicle Brand**, **Vehicle Model**, **Model Variant** | Yes | From the vehicle master; each list follows the one before. |
| **Model Year**, **Vehicle Color** | Yes | Model year within the last 20 years up to next year. |
| **Seating Capacity** | Yes | Seats including the driver, 1 to 99; used for Auto Passenger PA. |

On the coverage step, own damage is priced from the sum insured (the market value) and the rate of the motor tariff; CTPL is the Insurance Commission tariff of the vehicle class, inclusive of taxes and fees; the optional covers are Acts of Nature, excess Bodily Injury and Property Damage, Personal Accident and Auto Passenger PA (limit per person x seats covered). Select **Calculate** after every change. The order summary shows:

| Line | How it is calculated |
|---|---|
| NET Premium | Sum of the cover premiums, without CTPL. |
| VAT | 12% of the net premium (VAT rule of Master > Finance > Premium Taxes & LGU Rates), for products under the VAT regime. |
| DST | PHP 0.50 on each PHP 4.00 of net premium, a fraction counting as a whole PHP 4.00 (DST rule). |
| LGT | 0.75% of the net premium (LGT rule), or the rate of the client's city or municipality in Premium Taxes & LGU Rates. |
| CTPL | The tariff amount, not taxed again and never discounted. |
| Discount | The discount given to the client, limited by the Authority Matrix of your role. |
| Gross premium | Net premium + taxes + CTPL + other premium - discount. |

Under commission and referral choose the referrer or keep the broker's own lead; the comsub rate fills in from the commission rule (level L1 8%, L2 5%, `commission.comsub_rate_by_level`). The brokerage rate comes from the Commission Rate Matrix, then the insurer's default rate, then `commission.default_rate` (15%).

When you select **Completed Quote**, the system prices the quotation again on the server from the configured rates and taxes, saves it as **Draft** with its number QT-YYYY-NNNNN, sets the prospect to QuoteGenerated and opens the quotation. A premium changed in the browser is refused. The quotation is valid for 30 days (`limits.quote_validity_days`).

## Quotations

![Operations > Sales & Marketing > Quotations](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quotations.png)

Choose Operations > Sales & Marketing > Quotations. The cards count **Total Quotations**, **Converted to Policy**, **Rejected**, **Pending Customer**, **Approved Quotations**, **Active Quotations** and **Pending Review**, with the **Average Premium**. The list shows **Quote ID**, **Prospect Name**, **Policy Type**, **Gross premium**, **Date** and **Status**; **View Details** opens a quotation. **Create Quote** starts a quotation and **Bulk Upload** loads quotations from a template.

| Status | Meaning | Next step |
|---|---|---|
| Draft | Saved, not sent; can still be edited. | **Send for Customer Approval** |
| Pending Customer | Sent to the client; waiting for the answer. | The client accepts, or **Record customer response** |
| Customer Accepted | The client accepted. | **Proceed to Policy** or **Create Placement Slip** |
| Approved | Approved by a user other than the creator. | **Proceed to Policy** |
| Rejected, Dropped | Not taken up; can be reopened as Draft. | |
| Expired | Not converted within its validity (Quotation expiry job, daily 00:30). | Reopen as Draft |
| Converted to Policy | The policy is issued; the quotation can no longer be edited. | |

### Send the quotation and record the customer's response

![Quotation Slip details of a quotation waiting for the customer](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quote-detail-pending.png)

1. Open the quotation with **View Details**. The page shows the **Placement journey**, **Policy Details**, **Assured Details**, **Insurance Vehicle Details**, **Coverage details** and **Payment Details** (net premium, DST, VAT, LGT, others, discount, gross premium). The **Audit Trail** tab lists every change.
2. Check the details and select **Send for Customer Approval**. The client must have an e-mail address. The system e-mails a signed approval link valid for 7 days (`quotations.approval_link_ttl_hours`), sets the status to **Pending Customer** and notifies the Processing Team.
3. The client opens the link, checks the quotation and approves it; no sign-in is needed. The status becomes **Customer Accepted** and you are notified. **Copy approval link** copies the link so you can send it by another channel.
4. When the client answers in another way, select **Record customer response**. Choose the **Customer's answer** (**Accepted**, **Declined** or **Revise**), **Received by** (E-mail, Phone, Viber/WhatsApp, Meeting or Signed form), the **Response date**, a **Reference** (for example the Viber message time or the signed form number), **Remarks** and, if you have it, an attachment (screenshot, signed form or e-mail). Select **Record response**.

![Record customer response](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quote-response.png)

| Answer | Resulting status (`quotations.customer_response_status`) |
|---|---|
| Accepted | Customer Accepted: the quotation can go on to placement or policy. |
| Declined | Rejected. |
| Revise | Draft: change the quotation and send it again. |

**Share** offers **Download**, **Email**, **WhatsApp**, **Send to Insurer** and **Copy link**.

![Share Quote](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quote-share.png)

### From the accepted quotation to the policy

For motor and package lines, select **Proceed to Policy** on the accepted quotation:

1. **Customer information**: the government ID (**ID Type**, ID card number and a scan of the ID card), **Motor Number**, **Chassis Number** and **Plate Number** or **MV File Number**, and the optional mortgagee, CTPL certificate number and authentication code. The server refuses to issue a motor policy without the fields in `policy.kyc_required_fields`. The accepted ID types are PhilSys ID, UMID, Passport, Driver's License, PRC ID, SSS ID, GSIS ID, TIN ID, Postal ID, Voter's ID and Senior Citizen ID (`policy.kyc_id_types`).
2. **Vehicle photos**: left side, right side, front, rear and interior.
3. **Review**: the policy, assured, vehicle, coverage, premium and the participating insurers with their shares. Choose the billing mode next to **Send to Insurance Company**: broker billed (the client pays the broker) or direct bill (the client pays the insurer). The default is the insurer's default billing mode, else `direct_bill.default_billing_mode` (broker). Select **Send to Insurance Company**: the policy is issued.
4. **Upload policy**: check the policy number, insurer and dates, upload the insurer's policy document (PDF, PNG, JPG or JPEG, at most 10 MB) and choose **Pay Later** or **Proceed to Payment**.

At issue the system gives the policy number, creates the client from the prospect (CL-YYYY-NNNNN), copies the participants, raises the premium bill (broker billed) or books the commission due from the insurer (direct bill), posts the journal and accrues the referrer's commission. The quotation becomes **Converted to Policy**.

For a line that needs a firm order, select **Create Placement Slip** instead; the Processing Team continues as described in its chapter. When the placement slip is optional, **Send to insurance company** asks which way to go: place with the insurer(s) through a placement slip, or **Issue the policy directly**.

## Request a quotation from the market

For a non-package risk, select **Request quotation** on Quick Quote, or **Request for Quotation (non-package)**, or **New Request for Quotation** on Operations > Sales & Marketing > Request for Quotation (Broker Slip). Describe the customer, the risk, the covers and the insurers to approach, as described in the Processing Team chapter, and agree with the Processing Team who sends it to the market. The Processing Team records the offers, compares them and prepares the Quotation Slip that you send to the client.

## Record the client's payment

Only Accounting posts official receipts. The account executive records how the client paid; Accounting verifies the payment and posts the receipt.

![Payment Confirmation: How does the client pay?](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-payment-capture.png)

1. Open the policy (Operations > Policy, arrow on the row) and select **Proceed to Payment**.
2. The page shows the **Payment Details** of the policy and the **Outstanding** amount.
3. Under **How does the client pay?**, choose **Pay later** (the bill stays open; record the payment when the client pays), **Bank transfer**, **Cheque**, **Online payment** (paid online by the client; enter the transaction reference) or **Cash**.
4. Fill in the reference, the amount paid, the payment date, remarks and, if you have it, the proof of payment.
5. Select **Record payment**.

The payment waits for verification, the policy payment status becomes Reviewing and Accounting receives the notification to verify it. Accounting confirms it (the official receipt is posted) or rejects it with a reason.

## Policies

![Operations > Policy](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-policy-list.png)

Choose Operations > Policy. The list shows **Policy Number**, **Client Id**, **Client Name**, **Gross Premium**, **Policy Issued**, **Policy Expiry**, **Product Description** and **Payment** status. The field selector next to the search box chooses what you search by. **Show Filters** offers **Payment Status**, **Product Type**, **Insurance Company**, **Client Name**, issue and expiry date ranges and minimum and maximum premium.

The arrow on a row (**View Policy**) opens the policy; **More Actions** opens **Claim**, **Endorsement** and **Reminder**. These are greyed out while the premium payment is Pending or Reviewing, and **Endorsement** is not offered for expired, lapsed, cancelled or renewed policies.

![More Actions on a policy row](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-policy-rowmenu.png)

![Policy Details](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-policy-detail.png)

**Policy Details** shows the header (policy number, client, expiry, payment status) with **Claim**, **View Policy** and **Endorsement**; the **Gross Premium**, **Expiry Date** and **Client ID** cards; **Policy Details**, **Insured Details**, vehicle details and photos for motor, coverage and premium; **Documents & Billing** (**Generate Policy Invoice**, **Premium Accounting Entries**, the policy document with **Preview** and **Open**); and **Related Records** (quotation reference, insurance company, account code).

| Policy status | Meaning |
|---|---|
| Active | In force. |
| Expired | Past its expiry date (Policy expiry job, daily 00:15). |
| Renewed | Replaced by a new term. |
| Lapsed | Not renewed within the 30-day grace period (`renewals.grace_period_days`). |
| Cancelled | Cancelled by endorsement. |

| Payment status | Meaning |
|---|---|
| Pending | Premium due, nothing received. |
| Reviewing | A payment was recorded and waits for Accounting. |
| Partial | Part of the premium was receipted. |
| Completed | Fully paid. |
| Refunded | Premium returned to the client. |

## Renewals, open items, payments and clients

The account executive uses the same renewal screens as Operations (Operations chapter) for his or her own clients: the **Renewal Queue** filtered by **Sales person**, **At-Risk Policies**, and **Negotiations** to record contacts and request approval of renewal terms. **Open Items** shows the daily worklist (expiring policies, pending payments, quotations pending, renewal requests); **Payments** shows the premium of your policies by **Paid**, **Pending** and **Reviewing**; **Clients** opens the client record with its policies, claims, renewals and endorsements.

## Commission and reports

![Commission > Commission Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-commission-dashboard.png)

Commission > Commission Dashboard shows live figures from the commission ledger: brokerage income, comsub (gross), net margin and margin %, outstanding payable and the withholding tax withheld, with comsub by referrer, lines by status (Accrued, Eligible, Approved, Paid) and the monthly trend. **Accounting** and **Management** switch the view.

Reports > Operational Reports > Production opens the Production Register; All Reports lists every report the role may run (Production Register, Claims Position, Renewal Retention, Remittance Summary, Broker Commission Statement, Premium by Product / Month / Insurer, New Business vs Renewals, Claims Ageing, Lead Conversion Funnel, Placement Pipeline, Market Response, Co-insurance Register, SOA / Premium Receivable, Receivables Ageing, Incentive Results). The chapter Reports, dashboards, schedules and notifications explains how to run them.

## Approvals

| Approval | Who gives it |
|---|---|
| Quotation approval | A user other than the creator (`workflow.quote_maker_checker`); the Processing Team is notified. |
| Discount above the role's limit | Refused by the Authority Matrix; ask a role with a higher limit. |
| Renewal terms | The Processing Team (`renewals.maker_checker`). |
| Payment recorded | Verified by Accounting, which posts the official receipt. |

The account executive gives no approvals.

# Processing Team

## Role summary

The Processing Team (role Processing Team (Placement & Policy Processing)) works the market side of the business. It sends requests for quotation to insurers, records their offers and declines, compares them and chooses the security, prepares Quotation Slips, sends placement slips (firm orders) and records the insurers' confirmations, issues and checks policies, records policies the insurer issued, completes endorsements with the insurer's document, approves renewal terms, maintains the product templates and the motor tariff, and works the reinsurance screens.

![Processing Dashboard (Processing Workbench)](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-processing-dashboard.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Processing Dashboard, Executive Dashboard |
| Operations | Home; Sales & Marketing (Prospects, Request for Quotation (Broker Slip), Quotations, Placement Slips); Clients; Policy; Claims; Renewals (all items); Open Items; Payments |
| Reinsurance | Treaty Dashboard, Cession Tracking, Claims Recovery, Reconciliation, Analytics |
| Reports | All Reports; Operational Reports |
| Product Configurator | Dashboard, Product Templates, Coverage Builder, Rating Engine, Acceptance Rules, Document Manager, Market Mapping, Risk Mapping, Product Analytics |

The Processing Team reads prospects but does not create them, and has no Quick Quote: Quick Quote creates prospects and quotations, which is Sales and Operations work.

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Work the submissions and open tasks | Processing Dashboard |
| Daily | Send requests for quotation; record offers and declines | Request for Quotation (Broker Slip) |
| Daily | Compare offers and prepare Quotation Slips or Placement Slips | Request for Quotation > Compare offers |
| Daily | Send placement slips, record confirmations, issue policies | Placement Slips |
| Daily | Complete endorsements with the insurer's document | Policy > endorsement |
| Daily | Approve renewal terms | Notification; Renewals > Negotiations |
| On request | Record a policy the insurer issued | Placement Slips > **Record Issued Policy** |
| Monthly | Cessions and bordereaux | Reinsurance > Cession Tracking |
| When rates change | Maintain the motor tariff and product templates | Product Configurator |

## Processing Dashboard

Choose Dashboard > Processing Dashboard. The **PROCESSING WORKBENCH** shows, for the period chosen at the top (for example **This Week**): **NEWLY RECEIVED SUBMISSIONS** and **OLDER SUBMISSIONS** (quotations waiting for action), **AVG. CYCLE TIME**, **OPEN ALERTS** (Duplicate Submission Detected, Missing TIV and Proposed Dates, Missing LOB, Type or Broker), **WORKLOAD METRICS**, the **SUBMISSIONS LIST** (case ID, proposed insured, account executive, face amount, product type, risk score, next requirement due, priority and status) and **Open Tasks**. **New Submission** starts a quotation.

## Requests for quotation (broker slips)

![Operations > Sales & Marketing > Request for Quotation (Broker Slip)](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-rfq-list.png)

Choose Operations > Sales & Marketing > Request for Quotation (Broker Slip). The cards count the requests by status (**SUBMITTED**, **RESPONSES IN**, **DRAFT**, **CLOSED**); select a card to filter. Each row shows **Slip No.**, **Insured**, **Product**, **Sum insured**, **Offers / approached** (with the number declined), **Best offer (gross)**, **Response due**, **Age**, **Status** and the **Quotation Slip** made from it. Select a row to open it.

| Status | Meaning |
|---|---|
| Draft | Saved, not yet sent to the market. |
| Submitted | Sent to the insurers; waiting for their answers. |
| Responses in | At least one insurer has answered. |
| Closed | Turned into a Quotation Slip or Placement Slip, or closed as not taken up. |
| Cancelled | Withdrawn with a reason. |

### Create a request for quotation

![New Request for Quotation (Broker Slip)](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-rfq-new.png)

1. Select **New Request for Quotation**.
2. Under **Customer and risk**, choose **Customer**: **Client** (an existing client), **Prospect** or **New prospect**, and search for the record. Choose the **Product** (tick **Include package products** to list package products as well). **Insured** fills in; change it if the slip is for another named insured.
3. Enter **Inception** and **Expiry**. Leave **Response due** empty to use the default of the settings, or set the date by which insurers must answer.
4. Under **Risk details**, add each detail of the risk as an item and a value (location, occupancy, construction, protection; for marine the cargo, voyage and conveyance) with the plus sign.
5. Under **Requested covers**, select **Add cover** for each cover with its **Sum insured** and **Deductible**. The covers offered are those of the product.
6. Under **Market**, choose the **Insurers to approach** (required).
7. Add **Remarks** for the insurers, for example the claims history or the incumbent's renewal terms.
8. Select **Save draft** to keep working, or **Save and submit to market**. **Cancel** leaves without saving.

When you submit, the system numbers the slip (BS-YYYY-NNNNN), creates one offer record per insurer with status Pending and queues a request-for-quotation e-mail to each insurer. **Slip PDF** prints the slip for the whole market; the PDF icon on an insurer's row prints the slip addressed to that insurer.

### Record the insurers' answers

![Request for Quotation BS-2026-00047, tab Market responses](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-rfq-detail.png)

The request shows its placement journey, the customer, product, sum insured, period, submission and response dates, the best offer and the creator, and three tabs: **Market responses**, **Compare offers**, **Risk and covers**.

1. Open the tab **Market responses**. Each insurer is listed with **Status** (Pending, Offered, Declined), **Net premium**, **Rate**, **Taxes**, **Gross premium**, **Line** offered and deductibles.
2. On the insurer's row, select **Record response** (or **Edit** to change an answer already recorded).
3. For an offer, enter the **Net premium (100%)**, the **Rate** if the insurer quoted one (otherwise **Derived**), the **Line offered** (the share the insurer will write), **Taxes** and **Gross premium** if the insurer stated them (otherwise **Computed**), **Valid until**, **Deductibles**, **Special terms and conditions** and the **Insurer reference**. Attach the insurer's letter with **Attach the offer**.
4. For a decline, select **Record decline** and enter the **Reason for declining**.
5. Select **Save**. The message reads Response of (insurer) recorded.

The request becomes **Responses in** with the first answer. **Add insurer** approaches another insurer on an open request; that insurer receives its own request.

### Compare the offers and choose the security

![Compare offers](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-rfq-compare.png)

The tab **Compare offers** ranks the offers by gross premium and marks the cheapest **Best**. For each offer it shows the difference to the best (**vs best**), the rate and deductibles. The summary line counts the offers, declines and pending insurers and the **Market capacity (lines offered)**.

1. Tick **Select** on each offer to place. One offer at 100% is a single-insurer placement; several offers make a co-insurance led by the insurer you choose, and the premium follows the lead's terms.
2. Choose the **Lead** with the radio button.
3. Enter the **Share taken** of each selected offer. **Selected shares total** must be exactly 100%.
4. Select **Prepare Quotation Slip** when the client must see and accept the terms first, or **Prepare Placement Slip** to send the firm order straight away. The buttons offered follow the placement journey of the line.

The request is then Closed and its progress bar links to the next records. **Risk and covers** repeats the risk details and covers. To stop a request, select **Cancel / close** and choose **Cancel slip** (withdrawn) or **Close (not taken up)** with the reason.

![Risk and covers](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-rfq-risk.png)

## Quotation Slips

A Quotation Slip prepared from a request is a quotation (QT-YYYY-NNNNN) with the chosen insurer or insurers and their shares. It opens on Quotations like any other quotation, shows its placement journey and follows the statuses and the customer response described in the Sales & Marketing chapter. The account executive sends it to the client; when the client accepts, select **Create Placement Slip** on it.

![A Quotation Slip converted to a policy, with its placement journey](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-quotation-slip.png)

## Placement Slips

![Operations > Sales & Marketing > Placement Slips](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ps-list.png)

Choose Operations > Sales & Marketing > Placement Slips. The cards count **DRAFT**, **SENT TO INSURER**, **BOUND** and **POLICY ISSUED**; the filters choose a status and a source. Each row shows **Placement No.**, **Insured**, **Product**, **Lead insurer**, **Gross premium**, **Period**, **Confirmed** (insurers confirmed / participants), **Source** (From quotation slip, From broker slip, Direct placement or Recorded policy), **Status** and the **Policy** issued.

| Status | Meaning |
|---|---|
| Draft | Prepared, not yet sent; participants can still be changed. |
| Sent to insurer | The firm order was e-mailed to each participant. |
| Bound | Every participant has confirmed; the policy can be issued. |
| Declined | A participant declined its line: edit the participants or cancel the slip. |
| Policy issued | The policy has been issued from the slip. |
| Cancelled | Withdrawn with a reason. |

A placement slip comes from **Prepare Placement Slip** on a request, from **Create Placement Slip** on an accepted quotation, or from **New direct placement** when the client instructs placement with named insurers and no quotation slip is needed.

### Create a direct placement

![Direct Placement](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ps-direct.png)

1. Select **New direct placement**.
2. Fill in **Customer and risk** (**Customer**: Client, Prospect or New insured; **Product**; **Insured**; **Risk details**).
3. Under **Period and premium**, enter **Inception** (required), **Expiry**, **Sum insured**, **Net premium** (required), **Commission rate** (empty: the insurer's default) and **Billing mode** (empty: System default), and **Remarks**.
4. Under **Security (participating insurers)**, choose each insurer with **Add insurer**, enter its **Share** and tick **Lead** for one of them. The line under the table says whether the shares total 100% and whether the placement is a co-insurance or a single insurer.
5. Select **Create Placement Slip**.

The rules: at least one insurer; an insurer can take part only once; every share above 0%; exactly one lead; shares total exactly 100%.

### Send the firm order and record confirmations

![Placement Slip PS-2026-00023 with its security, premium and summary](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ps-detail.png)

1. Open the placement slip. **Security (participating insurers)** lists each insurer with role (Lead or Co-insurer), **Share**, **Sum insured**, **Premium**, **Taxes**, **Gross**, **Commission**, **Policy / certificate no.** and **Status**. Below are the **Premium** breakdown (sum insured, net premium, VAT, documentary stamp tax, local government tax, gross premium, commission), the **Summary** and the **Risk**.
2. Select **Send to insurer(s)**. Each participant receives a placing slip showing its own share; the status becomes **Sent to insurer**. **Resend to insurers** sends it again.
3. When an insurer confirms, select **Confirm** on its row, enter the **Insurer policy / certificate number** and save. The row becomes **Confirmed**.
4. When an insurer declines its line, select **Declined** on its row and record the reason. Then use **Edit participants** to replace the insurer or change the shares so that they total 100% again.

When every participant has confirmed, the slip becomes **Bound** and the progress bar ticks **Bound / confirmed**. **Slip PDF** prints the placing slip; the PDF icon on a participant's row prints the placement slip for that insurer's share.

### Issue the policy

On a bound placement slip, select **Issue Policy**. Check the identifiers the system fills in from the client, the quotation and earlier policies, enter the **Policy number** (blank: numbered by the system) and confirm. The system:

- issues the policy and copies the participants, shares and insurer references to it;
- creates the client from the prospect if the insured is not yet a client;
- raises the premium bill to the client (broker billed) or books the commission due from the insurers (direct bill);
- posts the journal with each insurer's payable and commission on its own line;
- sets the slip to **Policy issued** and links the policy. The message reads Policy (number) issued.

A user without policy issuing rights sees that all insurers confirmed and that a user with policy issuance rights can now issue the policy. A line that requires a placement slip refuses issue from the quotation with the message This line requires a Placement Slip before the policy is issued.

## Record Issued Policy

Use **Record Issued Policy** when the insurer has already issued the policy, for example a renewal the insurer processed itself or a policy placed before the account came to BrokerVerse. The policy, the bill and the commission are created in one step.

![Record Issued Policy](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-record-issued.png)

1. Choose Placement Slips and select **Record Issued Policy**.
2. Fill in **Customer and risk**.
3. Under **Policy, period and premium**, enter the **Insurer policy number** (blank: numbered by the system), **Issued date**, **Inception**, **Expiry**, **Sum insured**, **Net premium**, **Commission rate**, **Billing mode** and **Remarks**.
4. Under **Security (participating insurers)**, add each participant with its share and its own **Policy / certificate no.**.
5. Select **Record policy**.

A line whose journey does not allow a direct policy entry refuses it; place those risks through a placement slip.

## Co-insured policies and premium accounting entries

![Policy POL-2026-00052: a co-insured fire policy](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-policy-fire.png)

A co-insured policy lists its participants with role, share, sum insured, premium, taxes, gross premium, commission and policy or certificate number. Amounts are split by share; the rounding remainder goes to the lead. The same split is used for the bill journal, the remittance to each insurer, claim recoveries and the reports. **Premium Accounting Entries** (Documents & Billing on the policy) lists every journal line of the policy with **Code**, **Entry Type**, **Description**, **Document Date**, **Due Date**, **Main Account**, **Dr/Cr** and **Amount**; **Filter by Entry Type** narrows the list.

![Premium Accounting Entries of a co-insured policy](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-accounting-entries.png)

## Complete an endorsement

Operations raises the endorsement request and sends it to the insurer (Operations chapter). When the insurer has issued its endorsement:

1. Open the endorsement (from the notification, the policy's endorsements, or the client's **Endorsement** tab). It shows **Waiting for Update**.
2. Select **Proceed**, upload the insurer's endorsement document with the endorsement number and dates, and complete it.
3. The system applies the change to the policy and the client, bills additional premium or credits return premium, and notifies the policy owner.

## Approve renewal terms

Renewal terms submitted from Renewals > Negotiations with **Request approval** come to the Processing Team (`renewals.approver_roles`, `renewals.maker_checker`). Open the notification or the negotiation, check the renewal premium, the change against the expiring premium and the loadings or discounts, and approve or return the terms. The maker cannot approve his or her own terms.

## Product Configurator

![Product Configurator > Product Templates](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-pc-templates.png)

| Screen | Use it to |
|---|---|
| Dashboard | See active products, total premium, average loss ratio and commission; **Create New Product**. |
| Product Templates | Create (**Create Template**), version and edit product templates. Template statuses are Draft, Active, Retired; only active templates are used by the quotation screens. |
| Coverage Builder | Keep the covers: code, name, mandatory or optional, deductible and premium impact (**Add Coverage**). |
| Rating Engine | Keep the rating factors (vehicle age, driver age, no claim bonus, vehicle use, region and others) with their rules, and test them with the **Test Calculator**. |
| Acceptance Rules | Keep the insurers' underwriting guidelines as acceptance, validation and loading rules (**Add Rule**). |
| Document Manager | Keep the document templates per stage, for example the motor policy schedule and the CTPL certificate (**Upload Template**). |
| Market Mapping | Map products to insurers with the insurer's code, commission, override and target (**Map Product**). |
| Risk Mapping | Product definitions per line; Industrial All Risks is defined by risk sections. |
| Product Analytics | Policies, premium, loss ratio and margin by product. |

To maintain the motor tariff, open the motor template with the pencil on Product Templates and its CTPL and Auto PA tab: for each vehicle class check the name, code, default seats and the CTPL amounts for 1 and 3 years; set the Auto Passenger PA rate and the limits per person offered; save the template. The quotation screens use the new values at once. The tax rates come from Master > Configuration and are shown read-only in the template.

## Reinsurance

| Screen | Use it to |
|---|---|
| Treaty Dashboard | See the active treaties with type, line, utilisation, premium ceded and claims recovered, total and available capacity and the renewal timeline. |
| Cession Tracking | See the policies ceded per treaty with cession %, ceded premium, commission and status; **Process Cession** and **Generate Bordereau**. |
| Claims Recovery | Register the amount recoverable from reinsurers on a claim (**Register Recovery**). |
| Reconciliation | Compare our figures with a reinsurer's statement (**Reconcile Statement**); variances above 1% (`reinsurance.reconciliation_tolerance_percent`) need review; **Log Exception**. |
| Analytics | Treaty utilisation, loss ratio trend, retention against the target retention (65%), recovery performance and catastrophe exposure. |

![Reinsurance > Cession Tracking](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ri-cessions.png)

A confirmed cession and a settled recovery are posted through their posting rules. The Reinsurance Cession Register report lists the cessions of a period.

## Approvals

| Approval | Given or needed |
|---|---|
| Renewal terms of Operations and Sales | Given by the Processing Team. |
| Quotations sent for approval | The Processing Team is notified and may approve quotations it did not create. |
| Insurer confirmations | Recorded by the Processing Team; the policy is issued only when all participants have confirmed. |
| Reinsurance treaty | Needs a second user. |

# Operations (client servicing)

## Role summary

Operations (role Operations (Client Servicing)) looks after the clients once they are on the books: client records, endorsement requests, recording the client's payment, the daily open items, renewals and the documents sent to clients. Operations can also record prospects and quote package products in the same way as Sales & Marketing.

![Operations > Open Items](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-open-items.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Executive Dashboard |
| Operations | Home; Sales & Marketing (Prospects, Quick Quote, Compare Insurers, Request for Quotation (Broker Slip), Quotations, Placement Slips); Clients; Policy; Claims; Renewals (Renewal Policy, Renewal Batch, Renewal Queue, Retention Analytics, At-Risk Policies, Negotiations, Lapse Management, Performance); Open Items; Payments |
| Reports | All Reports; Operational Reports |
| Product Configurator | Dashboard, Product Templates |

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Work expiring policies, pending payments, pending quotations and renewal requests | Open Items |
| Daily | Answer client requests: policy details, documents, changes | Clients, Policy |
| Daily | Raise endorsement requests | Policy > **More Actions** > **Endorsement** |
| Daily | Record client payments | Policy > **Proceed to Payment** |
| Daily | Work the renewal queue and record contacts | Renewals > Renewal Queue, Negotiations |
| Weekly | Batch renewal notices; at-risk and lapsed policies | Renewal Batch, At-Risk Policies, Lapse Management |
| Monthly | Retention and renewal performance | Retention Analytics, Performance |

## Home and Open Items

**Home** (Operations > Home), titled Dashboard, shows **Create Quote**, the counts of prospects, clients and policies sold with **See More**, the commission chart, upcoming events from the activity monitor, and earned commission, collected premium, receivables and gross premium of the user's own book.

**Open Items** (Operations > Open Items) is the daily worklist. Four boxes show a count and the first records: **Expiring Policy**, **Quote Pending**, **Pending Payments** and **Renewal Request**. Select **See More** to open the full list of a box, and a record to open it.

## Clients

![Operations > Clients](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-clients.png)

A client is a person or company that holds or has held a policy. BrokerVerse creates the client, with its client code CL-YYYY-NNNNN, when the first policy is issued.

1. Choose Operations > Clients.
2. Use the tabs or the search box to find the client. The list shows the name and client code, type, number of policies and latest policy status.
3. Select the arrow at the end of the row to open the client.

![The client view](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-client-view.png)

| Tab | What you see and do |
|---|---|
| **Policy** | The client's policies with gross premium, dates, product and payment status; open a policy from **Actions**. |
| **Claim** | The client's claims with status. |
| **Renewal** | Renewals due and quoted. |
| **Endorsement** | The client's endorsements with number, type, policy, status and payment. |
| **Data privacy** | Consent per purpose (Processing, Marketing, Sharing with insurers) with channel, evidence and notice version; **Record consent**, **Withdraw**, **Show history**. |

To correct the name, address or contact details of a client with an issued policy, raise a Personal Details Change endorsement, so the change is recorded against the policy and sent to the insurer.

## Raise an endorsement request

An endorsement changes an issued policy: the client's details, the vehicle, the cover, the period, or cancels the policy. BrokerVerse records it with its number END-YYYY-NNNNN, sends it to the insurer and bills additional premium or credits return premium. A change of cover is priced again with the configured rates.

1. Choose Operations > Policy (or open the client and the **Policy** tab) and find the policy.
2. On the row, select **More Actions**, then **Endorsement**. The action is greyed out while the premium is Pending or Reviewing, and is not offered for expired, lapsed, cancelled or renewed policies.
3. Tick one or more endorsement types and select **Proceed**.
4. Enter the changes on the **Endorsement Request** page.
5. Select **Save & Next**, check the summary and send it to the insurance company.

![Choose the endorsement type](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-endorsement-type.png)

| Line | Endorsement type | What you can change |
|---|---|---|
| Motor | **Personal Details Change** | First name, last name, preferred name, contact number and address. |
| Motor | **Motor Details Change** | Vehicle details and identifiers. |
| Motor | **Coverage Change** | Own damage sum insured and rate, acts of nature, bodily injury, property damage, Auto Passenger PA. The premium is recalculated. |
| Motor | **Policy Extend**, **Policy Cancel** | The period; cancellation. |
| Fire and Allied Perils | Regular / premium change; policy cancellation | Risk, cover or premium; full, partial, pro-rata or pro-rata partial cancellation. |

![Endorsement Request: Personal Details Change](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-endorsement-personal.png)

For a personal details change the form opens with the client's current details. The contact number must be a valid Philippine mobile number and the ZIP code must have 4 digits. The client record is updated when the endorsement is completed.

![Endorsement Request: Coverage change, priced again](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-endorsement-coverage.png)

For a coverage change, change the covers; the premium boxes recalculate the net premium, VAT, documentary stamp tax, local government tax, gross premium and **Premium change**. CTPL stays as issued (**CTPL premium (as issued)**).

After sending, the endorsement waits for the insurer (**Waiting for Update**). The Processing Team completes it with the insurer's endorsement document (Processing Team chapter). Then the change is applied to the policy and the client, and:

- additional premium is billed to the client (for a co-insured policy, split by share on the journal); the endorsement shows that additional premium is due, and the payment is recorded with **Proceed to Payment**;
- return premium is credited to the client; if the premium was already remitted, the refund due from each insurer is booked and netted on its next remittance.

| Endorsement status | Meaning |
|---|---|
| Draft | Saved, not sent. |
| Pending Customer | Sent; waiting for the insurer's endorsement. |
| Completed | Applied to the policy. |
| Initiate Cancel, Cancelled | A cancellation in progress or done. |
| Rejected | Refused by the insurer. |

## Record the client's payment

Operations records payments exactly as described in the Sales & Marketing chapter (Policy > **Proceed to Payment** > **How does the client pay?** > **Record payment**). Accounting verifies the payment and posts the official receipt.

## Payments

![Operations > Payments](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-payments.png)

Operations > Payments shows **Gross Premium**, **Collected Premium**, **Receivables** and **Earned Commission**, and the bills in the tabs **Paid**, **Pending** and **Reviewing**. The **Type** column says whether the bill is for a POLICY, a RENEWAL POLICY or an ENDORSEMENT. Receipts are posted by Accounting; this screen shows the result.

## Renewals

BrokerVerse puts every policy into the renewal pipeline 90 days before expiry (`renewals.pipeline_days`), sends renewal notices 60, 30 and 15 days before (`limits.renewal_notice_days`), and turns the accepted renewal into the next policy term. A policy not renewed within 30 days after expiry lapses (`renewals.grace_period_days`); an expired policy can still be renewed as a lapsed renewal for 90 more days (`renewals.lapsed_renewal_days`).

| Screen (Operations > Renewals) | Use it to |
|---|---|
| Renewal Policy | See expired and expiring policies with their renewal state, and start a renewal (**Renew**). |
| Renewal Batch | Group many policies and send their notices and renewal quotes together (up to 500 policies, `renewals.batch_max_policies`). |
| Renewal Queue | Work the policies due for renewal: days to expiry, premium, status, risk, sales person and contact attempts. |
| Retention Analytics | Renewal rate, premium retention, cycle time and recommended actions. |
| At-Risk Policies | Policies with a retention risk score and their risk level. |
| Negotiations | Record contacts with the client, request approval of renewal terms and send communications. |
| Lapse Management | Lapsed policies, policies in the grace period and win-back campaigns. |
| Performance | Renewal rate, premium retention and cycle time against the targets. |

### Renew a policy

![Operations > Renewals > Renewal Policy](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-renewal-policy.png)

1. Choose Operations > Renewals > Renewal Policy. Filter by **Expiry from**, **Expiry to** and **Renewal state**, or search. Each row shows the policy number, client, product, insurer, sales person, expiry, days since or to expiry, premium, payment and **Renewal state** (for example Renewed or Lapsed, renewable).
2. Select **Renew** on the policy (or **Continue renewal** on a renewal already started). A renewed policy shows **Open** with the number of the new term.
3. The renewal quotation opens with the covers of the expiring term, re-rated with the current base rates (`renewals.rating_rates`), a claims loading of 10% per claim in the expiring term up to 30%, and a loyalty discount of 2% per completed renewal up to 10%. Check the terms and continue.
4. Send it for customer approval as for any quotation. Renewal terms that need approval go to the Processing Team.
5. When the client accepts, issue the renewal. The system issues the new term, marks the old policy **Renewed**, bills the premium (`renewals.create_receivable`) and accrues the commission to the original referrer.

### Renewal Queue and At-Risk Policies

![Operations > Renewals > Renewal Queue](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-renewal-queue.png)

The queue filters by **Policy/Insured Name**, **Status**, **Risk Level**, **Sales person** and **Expiry Date Range**; the cards count **Total Policies**, **Due Soon (30 days)**, **At Risk** and **In Grace Period**. The renewal statuses include Pending, First Notice Sent, Second Notice Sent, Final Notice Sent, Quote Sent, Approved, Renewed and Lapsed. **Attempts** counts the notices sent out of three.

The risk score on **At-Risk Policies** adds weights for claims in the term (25), unpaid premium (20), a premium increase above 10% (20), a first renewal (15), expiry within 15 days (10) and no contact within 30 days of expiry (10) (`renewals.risk_weights`, `renewals.risk_thresholds`). The levels start at 30 (Medium), 55 (High) and 75 (Critical).

### Negotiations

![Operations > Renewals > Negotiations](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-renewal-negotiations.png)

Select a policy under **Active Negotiations** to see its **Timeline**, **Details** and **Communications**. Then:

- **Add note**: record a call, meeting or message. Choose **Update Type**, **Communication Method** (for example Phone), enter the **Description**, **Outcome**, **Next Action** and **Follow-up Date**, and select **Save Update**.
- **Request approval**: send the renewal terms to the Processing Team for approval.
- **Send Communication**: write to the client. SMS, phone and letter are recorded only; e-mails are queued in the outbox.

![Add Negotiation Update](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-renewal-note.png)

### Renewal Batch, Lapse Management and the analytics

**Renewal Batch** groups policies expiring in the next 30 days (`renewals.batch_window_days`). Select **Create Batch**, choose the policies and send the notices or renewal quotes; the Renewal notice queue job works the batch in the background and **Refresh** shows the progress.

**Lapse Management** lists lapsed policies and policies in the grace period with days lapsed, premium lost, reason and win-back status. **Create Campaign** sets up a win-back campaign: **Campaign Name**, **Target Segment**, **Start Date**, **End Date**, **Discount (%)**, **Budget** and the **Campaign Benefits** offered.

**Retention Analytics** and **Performance** show the renewal rate, premium retention and cycle time for the period, product line and sales person chosen, against the targets (renewal rate 85%, premium retention 90%, cycle time 15 days), with recommended actions. **Export Report** downloads the figures.

![Operations > Renewals > Retention Analytics](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-renewal-analytics.png)

## Approvals

| Approval | Who gives it |
|---|---|
| Endorsement completion | The Processing Team, with the insurer's endorsement. |
| Renewal terms | The Processing Team (`renewals.maker_checker`). |
| Payments recorded | Accounting verifies them and posts the official receipt. |

Operations gives no approvals.

# Claims

## Role summary

The Claims team registers losses under the policies, sends the Preliminary Loss Advice to the insurer, follows the insurer and the adjuster, records the assessment and the settlement and, as a second user, approves the settlements entered by colleagues. Claims also registers reinsurance recoveries on claims.

![Claims Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claims-dashboard.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Claims Dashboard |
| Operations | Home, Clients, Policy, Claims |
| Reinsurance | Claims Recovery |
| Reports | All Reports; Operational Reports |

The Claims role lands on the Claims Dashboard.

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Register new losses | Policy > **More Actions** > **Claim** |
| Daily | Follow open claims with the insurer and adjuster | Operations > Claims |
| Daily | Approve settlements entered by another Claims user | Notification; claim in Pending Approval |
| Daily | Watch overdue claims | Claims Dashboard |
| Weekly | Review the claims position and ageing | Reports > Operational Reports > Claims; Reports > All Reports > Claims Ageing |
| As needed | Register reinsurance recoveries | Reinsurance > Claims Recovery |

## Claims Dashboard

The dashboard shows **Total Open Claims**, **Claims Overdue** (past the handling time of 20 days, `claims.sla_days`), **Today's Claims**, the line with the most claims and the claims by province, and the recent claims. Choose a date range and select **Export Report** to download the claims data.

## The claims list

![Operations > Claims](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claims-list.png)

Choose Operations > Claims. Each row shows **Claim Number**, **Client Name**, **Policy Number**, **Policy Issued**, **Product Description** and **Status**. The icons under **Actions** open the claim details, the next step for the claim's status and the claim audit trail.

| Status | Meaning |
|---|---|
| Pending | Registered; the Preliminary Loss Advice went to the insurer. |
| Processing | Under review: adjuster report and assessment. |
| Pending Approval | Settlement submitted; waiting for a second Claims user. |
| Approved | Settlement approved; settled at once when `claims.auto_settle_on_approval` is on. |
| Settled | Settlement released. |
| Rejected | Refused, with the reason. |
| Closed | File closed. |

Every claim screen shows the claim journey at the top: **Notification**, **Insurer advice**, **Review**, **Adjuster**, **Assessment**, **Settlement**, **Approval**, **Payment**.

## Register a claim

1. Choose Operations > Policy, find the policy and select **More Actions**, then **Claim**. You can also select **Claim** on the policy details page. The action is greyed out while the premium payment is Pending or Reviewing.
2. Check **Insurance Company Name**, **Policy Number**, **Policy Holder Name** and the address, which fill in from the policy.
3. Under **Incident Details**, enter the fields below.
4. Enter the driver (motor) and **Third Party Details (If Applicable)**.
5. Select **Next**, attach the documents and send the claim.

![Claim Request](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claim-request.png)

| Field | Required | Rules |
|---|---|---|
| **Date of Incident** | Yes | Not in the future; inside the policy period (`claims.validate_loss_date`). |
| **Time of Incident** | No | |
| **Address of Incident / Loss Location**, **City**, **Province** | Address yes | Where the loss happened. |
| **Type of Incident / Cause of Loss** | Yes | The causes of the line (`claims.loss_causes`), for example Collision, Theft / carnapping, Flood / typhoon for motor. |
| **Estimated Claim Amount** | No | First estimate, in pesos. |
| **Insurance Company Claim Number** | No | The insurer's reference, when known. |
| **Driver's name** (motor) | Yes | **Same as Policy Holder** copies the policy holder. The driver and vehicle sections apply to motor (`claims.lob_fields`). |
| Third party: **Name**, **Contact Number**, **Plate Number**, **Unit**, **Shop**, **Insurance Company Name** | No | |
| Documents | No | Police report, photos, estimates: PNG, JPEG or PDF, at most 2 MB each. |

The claim is refused when the date of loss is outside the policy period and while the policy premium is unpaid (`claims.block_unpaid_premium`). When it is saved, the system issues the claim number (CLM-YYYY-NNNNN), sets the status to Pending, e-mails the Preliminary Loss Advice to the insurer's e-mail (`claims.pla_enabled`) and notifies the Claims users and the policy owner. The due date is 20 days after reporting (`claims.sla_days`). For a co-insured policy the claim shows each insurer's share.

## Adjuster report

![Adjuster report](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claim-adjuster.png)

When the insurer has assigned an adjuster, open the claim and continue to **Adjuster**:

1. Under **Adjuster and loss details**, enter **Adjuster name**, **Insurer claim number**, **Date of loss**, **Date reported** and **Place of accident** (required fields are marked).
2. For motor, enter the **Driver at the time of loss** (**Driver name** and address).
3. Enter the **Third party** if applicable: **Name**, **Contact number**, **Plate number**, **Vehicle unit**, **Repair shop**, **Third party's insurer**.
4. Attach the **Proof of loss documents** (optional; PNG, JPEG or PDF up to 2 MB). Documents already on file are listed.
5. Select **Save and continue**. The claim is Processing.

The date of loss cannot be in the future, and the reported date cannot be in the future or before the date of loss. The adjuster report can be changed only while the claim is Pending or Processing.

## Assessment and settlement (maker)

On **Assessment**, check the **Claim summary** (claim and policy numbers, insurer and its claim number, date of loss and reported, cause, adjuster, estimated amount) and choose **Proceed to settlement**, or **Reject claim** with the **Reason for rejection**.

![Settlement](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claim-settlement.png)

1. Under **Settlement details**, choose the **Settlement type** (`claims.settlement_types`, for example a cheque or bank transfer to the claimant by the insurer, or payment through the broker).
2. Enter the **Settlement amount** (the estimated claim amount is shown for reference), the **Issue date** and the **Settlement date**.
3. Attach the **Settlement documents** (optional; PNG, JPEG or PDF up to 2 MB).
4. Select **Submit settlement**.

The amount must be greater than zero and the settlement date cannot be before the issue date. The message reads Settlement submitted for approval; the claim goes to **Pending Approval** and the other Claims users are notified. For a co-insured policy each insurer's share of the amount is shown.

## Approve a settlement (checker)

1. Open the notification, or the claim in Pending Approval from Operations > Claims. **Settlement approval** says that the settlement was entered by another claims user.
2. Check the claim summary and the settlement.
3. Select **Approve settlement** to settle the claim, or **Return for correction** to send it back to the maker.

The maker cannot approve his or her own settlement (`claims.settlement_maker_checker`). After approval the claim is **Settled**, the maker is notified and the dashboard and reports are updated.

When the settlement is paid through the broker, the insurer pays the broker and the broker pays the claimant. The system then books, at settlement, the amount recoverable from each insurer by its share against the amount payable to the claimant; the receipt of the insurer's funds and the payment to the claimant are recorded on the settled claim and posted through their posting rules (Claim funds received from insurer, Claim paid to claimant). Recording the funds needs the receipts permission and paying the claimant the disbursements permission, both held by Accounting; agree with Accounting who records them.

## Claim details, documents and audit trail

![Claim Details](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claim-detail.png)

**Claim Details** shows **Claim Information** (numbers, line, type, priority, status, estimate), **Incident Information**, **Driver Information**, **Policy Information** (with the client code, prospect and quotation numbers), **Third Party Information** and **System Information** (created and updated by and when, the claim due date). The claim settlement page lists the documents the system produces on the company letterhead: **Acknowledgment letter**, **Claims Discharge Voucher**, **Claims Data sheet** and **FIR**; select **View** to open each one. The claim audit trail lists every status change with user and time.

![Claim audit trail](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claim-audit.png)

## Reinsurance recoveries

Reinsurance > Claims Recovery lists the claims with an amount recoverable from reinsurers under the treaties: **Total Claimed**, **Total Recovered**, **Recovery Rate** and **Avg Recovery Time**, and the tabs **Pending Recoveries** and **Recovered Claims**. **Register Recovery** records a recovery against a claim.

![Reinsurance > Claims Recovery](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-ri-recovery.png)

## Approvals

| Approval | Given or needed |
|---|---|
| Claim settlement | Entered by one Claims user, approved by another. |
| Payment of a settlement through the broker | Recorded by Accounting. |

The Segregation of Duties rule SOD-CLM-ACCT stops one person holding Claims and Accounting together.

# Accounting

## Role summary

Accounting (role Accounting) runs the money side of the business: it verifies client payments and posts official receipts, follows collections and credit control, remits premium to insurers, bills direct-bill commission to insurers, pays commission and incentives, keeps petty cash, posts journal vouchers, matches open entries, reconciles the bank accounts and the insurer statements, prepares the month-end and year-end close and produces the BIR forms and returns. Most payments and journals need a second Accounting user (maker-checker); the close, the bank and insurer reconciliations and credit control decisions need the Accounting Manager.

![Accounts > Receipts](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-receipts.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Executive Dashboard |
| Operations | Open Items, Payments |
| Accounts | Receipts; Collections; Credit Control (Instalment Plans, Premium Warranty Monitor, Client Credit Limits, Remittance Ageing); Disbursement; Remittance (Automated Processing, Tracking, Statements, Settlement, Reconciliation, Bulk Processing, Scheduling, Electronic Transfer, Approval Workflow, Exception Management, Agency Bill Processing, Direct Bill Processing, Adjustments, Notifications, History, Analytics); Journal Voucher; Correction JV; Reversal JV; Open Entry Matching; Open Entry Unmatching; Accounting Query; All Clients Accounting; Petty Cash (Initiate, Request, Disbursement, Receipts, Replenish); Bank Reconciliation (Reconciliation Workspace, Reconciliations, Reconciliation Statement Report, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines, Bank Book); Insurer Reconciliation (Insurer Statements); Tax (BIR Form 2307, VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases); Period End (Period Management, Month-End Close, Year-End Close, Recurring Journals, Financial Statements); Incentive (My Programs, Calculations, Approvals, Statement) |
| Commission | Commission Dashboard, Agents/Referrer Accounts |
| Reinsurance | Reconciliation |
| Reports | All Reports; Operational Reports (Remittance, Broker Commission); Financial Reports (SOA/Premium Receivable, Collection Report, Payables, Journal, Trial Balance, Income Statement, Balance Sheet, Trial Balance Movement, General Ledger Detail, Aged Payables to Insurers, Month-End Close Status, Co-insurance Register, Due to Insurers by Co-insurer) |
| Master > Finance | Account Determination, Posting Rules, Configuration Approvals, Accounting Flow, Premium Taxes & LGU Rates, Payment Gateways, Taxation, Close Checklist, Bank Statement Formats, Bank Transaction Types, Insurer Statement Formats |

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Verify recorded payments and post official receipts | Notification; Accounts > Receipts |
| Daily | Follow overdue premium; send reminders | Accounts > Collections; Credit Control |
| Daily | Approve vouchers, journals and remittances of colleagues | The approval screens of each module |
| Weekly | Remit collected premium to insurers | Accounts > Remittance |
| Weekly | Pay commission to referrers | Commission > Agents/Referrer Accounts |
| Monthly | Raise commission debit notes for direct-bill policies | Remittance > Direct Bill Processing |
| Monthly | Import bank statements, match, prepare the reconciliation | Accounts > Bank Reconciliation |
| Monthly | Import insurer statements and reconcile | Accounts > Insurer Reconciliation |
| Monthly | Recurring journals, accruals, month-end close run | Accounts > Period End |
| Monthly / quarterly | VAT summary, QAP, SAWT, SLSP, BIR Form 2307 | Accounts > Tax |
| Per programme period | Incentive calculations | Accounts > Incentive |
| Yearly | Year-end close (prepare) | Accounts > Period End > Year-End Close |

## Verify payments and post official receipts

When Operations or Sales record a client payment, the policy payment status becomes Reviewing and Accounting receives the notification to verify it. Open the notification, check the payment against the bank statement and confirm it (the official receipt is posted) or reject it with a reason. Accounting users can also record a payment and issue the receipt directly from the policy.

### Post a receipt

![Add Receipts](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-receipt-add.png)

1. Choose Accounts > Receipts and select **Receipt**.
2. Check the **Receipt Date** and keep **Receipt Type** Payment (Refund for money returned). **Receipt Number** is issued on save.
3. Choose the **Branch Code** and, if used, the **Department Code**.
4. In **Customer Code**, choose the client; **Customer Name** fills in. The list shows only clients with open bills.
5. In **Policy Number**, choose the policy. **Currency Code** is PHP; **Transaction Code** is OR - Official Receipt.
6. Choose the **Receipt Mode** (cash, cheque, transfer and the others) and enter its reference.
7. Select the open bill to pay and enter the amount received, or pay the full balance.
8. Add **Remarks (Optional)** and select **Record payment**.

The receipt gets the next number of the official receipt series (OR-YYYY-NNNNN, with the receipt transaction RT-YYYY-NNNNN). The system posts Dr Cash in Bank (or the cash account of the receipt mode) / Cr Premiums Receivable, sets the bill to Partial or Paid, closes the collection item when fully paid, and makes the referrer's commission eligible once the premium is fully collected (`commission.auto_eligible_on_full_payment`). The amount cannot exceed the bill balance. You return to the receipts list with the new receipt highlighted.

The list shows **Receipt Number**, **Transaction Code**, **Transaction Number**, **Policy Number**, **Name**, **Customer Code**, **Date**, **Amount**, **Paid**, **UnPaid**, **Status** and **Payments**. **Bulk Print** prints receipts for a customer and date range on the company letterhead; **Bulk Upload** posts many receipts from a template (at most 1,000 rows, `limits.bulk_upload_max_rows`).

**E-mail receipt** on the receipt view sends the official receipt to the client with its PDF attached. The side panel offers **To** (the client's e-mail address by default), **Cc** and a note; the message is queued in Master > E-mail Outbox. With `receipts.email_on_record` switched on, every recorded receipt is e-mailed automatically.

## Collections

![Accounts > Collections](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-collections.png)

Accounts > Collections lists every open premium with **Client Name**, **Policy No.**, **Outstanding** spread over the ageing buckets (**Current**, **1-30 Days**, **31-60 Days**, **61-90 Days**, **Over 90 Days**), **Due Date**, **Status** (Pending, Committed, Overdue), **Days Overdue** and **View**. Filter by status and overdue level.

- The due date follows the insurer's premium payment warranty, else `collections.default_credit_days` (30 days).
- Reminders are e-mailed to clients 7 days before the due date and then at most every 7 days by the Collection reminders job at 08:00 (`collections.reminder_days_before`, `collections.reminder_repeat_days`). **Send Payment Reminders Now** sends them at once.
- The aging report (Collections > Aging Report) shows the total outstanding per bucket, a chart and the detail by client.
- **E-mail invoice** on a collection item sends the premium invoice / statement of account of the bill to the client with its PDF attached (To, Cc and a note). With `billing.email_on_issue` switched on, a bill is e-mailed automatically when it is issued from a policy, endorsement or renewal.

![Collections aging report](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-ageing.png)

### Import open items at go-live

**Import open items** loads the unpaid premium bills of the old system against policies already in BrokerVerse. Select **Download template**, fill in the Data sheet and delete the sample rows, enter the **Go-live date (first day of live transactions)**, choose the file (.xlsx or .csv) and select **Upload**. No journal is posted: the GL opening balance carries these amounts. Rows already loaded for the same go-live date are skipped.

![Import open items (go-live)](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-import-open-items.png)

## Credit control

| Screen (Accounts > Credit Control) | What it does |
|---|---|
| Instalment Plans | The payment schedule of a broker-billed bill: generate it from the terms (4 instalments proposed, up to 12; monthly, quarterly or semi-annual), then adjust dates and amounts. Payments are applied to the instalments in order and the bill is due on its first unpaid instalment. The list shows outstanding instalments by ageing; **Overdue only** narrows it. |
| Premium Warranty Monitor | Broker-billed policies whose premium is unpaid past, or within 7 days of, the insurer's premium payment warranty: **Warranty breached**, **At risk** and **Extensions to approve**. Remind the client, request an extension (up to 90 days after inception, approved by the Accounting Manager) or ask Operations to cancel the policy for non-payment. Nothing is cancelled automatically. |
| Client Credit Limits | The credit limit of each client against its open broker-billed premium, with the available amount. A policy that takes a client over its limit is still issued; Accounting is warned and acknowledges it here (**Issued over the limit**). Limits are set by the Accounting Manager. |
| Remittance Ageing | Premium collected and not yet remitted, per insurer, aged on the insurer's remittance terms from the collection date. The amount due is net of the commission and its VAT, plus the EWT on the commission. **Excel** downloads it. |

![Accounts > Credit Control > Premium Warranty Monitor](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-cc-warranty.png)

## Disbursement: payment vouchers and cheques

![Accounts > Disbursement](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-disbursement.png)

A payment voucher (PV-YYYY-NNNNN, with the disbursement transaction DT-YYYY-NNNNN) pays an insurer, an agent or referrer, a client or a supplier.

1. Choose Accounts > Disbursement and select **Create**.
2. Fill in the header: **Disbursement Date**, **Department Code**, **Branch Code**, **Payee Type** (Customer, Insurer, Agent/Referrer or Supplier), **Criteria** (Specific or Payall), **Customer Code** and **Customer Name** of the payee, **Policy Number (Optional)**, **Transaction Type**, **Payment Description**, **Payment Currency** and **Payment Notes (Optional)**. Select **Next**.
3. On the invoice list, tick the payables to pay and select **Next**.
4. Choose the bank account and the cheque book, and save. The voucher goes for approval.

![Create Disbursement](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-disbursement-create.png)

A second Accounting user opens the voucher, reviews the cheque details and approves it. The system posts the payment journal (for example Dr Premiums Payable to Insurers / Cr Cash in Bank). The approved cheque is printed and the voucher becomes Paid. The maker cannot approve his or her own voucher (`finance.maker_checker_enabled`).

| Voucher status | Meaning |
|---|---|
| Draft | Prepared; amounts may still change. |
| For approval | Waiting for a second user. |
| Approved | Approved; the cheque can be printed. |
| Paid | Paid; the payment journal is posted. |
| Cancelled | Cancelled before payment. |

## Remittance to insurers

For broker-billed policies Accounting remits the collected premium, net of the broker's commission, to each insurer by its share.

1. **Automated Processing**: the **Scheduled Remittances** list shows each insurer's remittance schedule, policies and estimated amount (Below minimum when there is nothing to remit). Tick the insurers that are ready, select **Validate**, then **Process Selected**. Draft remittances (REM-YYYY-NNNNN) are created. The due date follows the insurer's remittance terms, else `remittance.default_due_days` (30 days).
2. **Tracking**: find the remittance (filters **Remittance No**, **Insurer**, **Date Range**, **Status**) and process it; it goes for approval.
3. **Approval Workflow**: another user approves it within his or her limit for Remittance approval in Master > Generals > User Management > Authority Matrix. The delivered limits let an Accounting user approve up to PHP 1,000,000.00 and an Accounting Manager without limit; a larger remittance waits for the Accounting Manager. Cover during leave is given in User Management > Delegations. The initiator cannot approve.
4. **Settlement**: choose the **Insurer code**, select **Add policies** (or **Import**), then **Calculate**: premium - commission - tax ± adjustments = **NET SETTLEMENT**. Select **Submit for approval** (or **Save draft**).
5. The checker approves the settlement (SET-). The system raises the insurer payment voucher in Disbursement for the net amount.
6. Approve and pay the voucher in Disbursement. The voucher becomes Paid and the remittance **Completed**.

![Accounts > Remittance > Tracking](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-rem-tracking.png)

![Accounts > Remittance > Settlement](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-rem-settlement.png)

For a co-insured policy each insurer is remitted its own share. A refund due from an insurer (return premium on premium already remitted) is netted against its next remittance. The other remittance screens (Statements, Reconciliation, Bulk Processing, Scheduling, Electronic Transfer, Exception Management, Agency Bill Processing, Adjustments, Notifications, History, Analytics) are described in the Module reference.

## Direct bill: commission debit notes

In direct bill the client pays the premium to the insurer. The broker bills its commission plus 12% VAT to the insurer with a commission debit note and collects it net of the insurer's 10% expanded withholding tax (`direct_bill.insurer_ewt_rate`), certified on BIR Form 2307.

![Accounts > Remittance > Direct Bill Processing](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-rem-directbill.png)

The cards show **Unbilled commission**, **Billed, outstanding**, **Overdue** and **Receivable from insurers**. To raise a debit note (maker):

1. Open the tab **1. Raise Debit Note**.
2. Choose the **Insurer**, **Issued from** and **Issued to** and, if needed, the **Line of business**. Select **Load policies**.
3. Tick the policies to bill and check the totals: **Commission**, **VAT** (12%), **Total Due**, **EWT** (10% of the commission) and the net cash expected. **Client paid insurer** shows whether the client's payment to the insurer is recorded.
4. Check the debit note date; the due date is 30 days later (`direct_bill.debit_note_due_days`).
5. Raise the debit note and submit it for approval, or save it as a draft.

A second Accounting user approves it on the tab **2. Debit Notes**, which lists each debit note (DN-YYYY-NNNNN) with date, insurer, policies, commission, VAT, total due, collected, balance, due date and status (Draft, Pending Approval, Open, Partially Collected, Collected). The approved debit note is printed on the company letterhead and e-mailed to the insurer. When the insurer pays, open the debit note, enter the cash received, the tax withheld (EWT), the payment mode and the reference, and post the collection. Partial payments are allowed. The collection posts Dr Cash in Bank and Creditable Withholding Tax (BIR Form 2307) / Cr Commission Receivable.

![Direct Bill Processing: Debit Notes](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-rem-directbill-dn.png)

The tab **3. Billing Mode** changes an issued policy between **Direct bill** and **Broker billed**: enter the **Policy number**, choose the **Billing mode**, give the **Reason** and select **Change billing mode**. Direct bill cancels the premium bill and books the commission due from the insurer. The change is refused once premium was collected or remitted, or once the commission is on a debit note.

## Commission to agents and referrers

![Commission > Agents/Referrer Accounts](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-referrers.png)

The list shows every referrer with **TYPE** (Agent, Sub-agent, External), **LEVEL**, **POLICIES**, **NET PAYABLE (OPEN)**, **WHT TYPE** (Individual 5% or Company 10%), **BANK ACCOUNT** and **STATUS**. The header shows **Due this cycle** and **Ready to pay**.

1. Select the referrer. The account shows the policies split by payment cycle: **CURRENT CYCLE**, **FUTURE CYCLES (ACCRUED, NOT YET PAYABLE)** and **PAST (PAID HISTORY)**, each line with product, insurer, cycle, comsub, WHT, net and status.
2. Check **Apply WHT** (deducted when withholding tax applies to the referrer; `commission.wht_rate_by_type`: Agent and Sub-agent 5%, External 10%).
3. Mark the accrued lines eligible if the premium was collected (**Mark eligible**). Lines become eligible on their own when the premium is fully collected.
4. Select **Approve** on the eligible lines. Another Accounting user must approve the lines you prepared.
5. Select **Generate payout**. The system creates a draft payout voucher in Disbursement.
6. Complete and submit the voucher. A second Accounting user approves it and the lines become Paid.

![A referrer account](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-referrer-account.png)

A referrer without a bank account on file cannot be approved or paid (`commission.require_bank_account`).

| Commission status | Set when |
|---|---|
| Accrued | The policy is issued, or an endorsement adds premium. |
| Eligible | The premium is fully collected, or Accounting marks it. |
| Approved | An Accounting user other than the maker approves the line; the comsub accrual is posted. |
| Paid | The payout voucher is approved; commission payable, cash and withholding tax are posted. |
| Reversed | The line is reversed; return premium claws back the comsub on the returned part. |

## Journal vouchers

![Accounts > Journal Voucher](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-jv.png)

1. Choose Accounts > Journal Voucher and select **Voucher**.
2. Choose the **Transaction Code**, type the **Transaction Description** and check the **Date**.
3. Select **Add Data**. Choose the **Main A/c**, the **Sub A/c** if any, the entry (Debit or Credit), remarks, currency and amount, and save the line.
4. Repeat until total debit equals total credit.
5. Submit the voucher for approval.

![Add Journal Voucher](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-jv-add.png)

An unbalanced voucher is refused with the difference. A voucher dated in a soft-closed period can be posted only by the Accounting Manager, and one dated in a closed period is refused. The approvers are notified; the checker approves (the journal is posted and appears in the Journal register and the trial balance) or rejects it with a reason. The list (**Journal Voucher history**) shows **Transaction Code**, **Transaction Number**, **Date**, **Description**, **Status** and **View**.

**Correction JV** reverses a posted voucher and posts the corrected lines after approval: choose the **Transaction Code** and **Transaction Number** of the voucher, the **Corrections JV Transaction Code** and the **Correction Description**, select **Next** and enter the corrected lines. **Reversal JV** posts the opposite entries of a posted voucher after approval.

## Open entry matching and write-offs

![Accounts > Open Entry Matching](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-open-entry-matching.png)

Open entry matching settles open debit and credit entries of the same account against each other, for example a receipt against a bill posted without a reference.

1. Choose the **Sub Account Code** and, if needed, **Division**, **Department**, analysis codes and **Currency Code**.
2. Select **Pull**, or **Pull By Criteria** with **Debit** or **Credit**.
3. Tick the debit and credit entries to match and check the totals.
4. If a small difference remains, enter it as the **Adjustment Amt** and choose the **Write off reason**.
5. Select **Match**.

The write-off reasons and their GL accounts are kept on Master > Finance > Account Determination, tab **Write-off reasons**; a reason with a limit refuses a larger write-off. **Open Entry Unmatching** undoes a match.

## Accounting Query and All Clients Accounting

**Accounting Query** searches the accounting entries by **Policy ID / Number**, **Client ID**, **Client Name**, **Entry Type**, **Reference Type**, **Status**, **Start Date**, **End Date** and **GL Code**; **Export** downloads the result. **All Clients Accounting** shows, for every client, the number of transactions, total debits, total credits and balance; **Export CSV** downloads it.

## Petty cash

| Screen (Accounts > Petty Cash) | Use it to |
|---|---|
| Initiate | Open a petty cash fund: petty cash code, description, size, bank and accounts, currency, branch, department, available cash, maximum limit and minimum cash box. |
| Request | Record a request for petty cash (PCR-YYYY-NNNNN). |
| Disbursement | Pay out an approved request from the fund. |
| Receipts | Record money returned to the fund. |
| Replenish | Top the fund back up from the bank. |

A fund is opened on Initiate, which issues its code (PCF-) when left empty and holds the fund size, the available cash, the maximum limit and the minimum cash box. Requests are maker-checker. After a save the screen returns to its list.

![Accounts > Petty Cash > Initiate: Add Petty Cash](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-pc-initiate-add.png)

## Bank reconciliation

Bank reconciliation matches the lines of each bank statement with the cash-account lines of the ledger, posts the bank items not yet in the books and produces the monthly bank reconciliation statement. Accounting prepares each reconciliation; the Accounting Manager approves it.

![Accounts > Bank Reconciliation > Reconciliation Workspace](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-br-workspace.png)

Choose the **Bank account** and the **Period**. The cards show **Balance per bank** (from the latest statement), **Balance per books** (the GL cash account at the period end), **Unmatched bank lines**, **Unmatched book entries** and the **Difference**, and the status of the period's reconciliation. Below are **Bank statement lines** and **Book entries**, each filtered to **Unmatched** or **All**.

### Import a bank statement

1. Select **Import statement**.
2. Choose the **Statement format** (BDO, BPI, Metrobank samples, GENERIC or one of your own) and the **Statement file (CSV / XLSX)** downloaded from online banking.
3. Enter the **Bank statement no.** (for example SOA Sep 2026), and the **Opening balance** and **Closing balance** if the file does not carry them. **Leave out lines already on file** skips duplicates.
4. Select **Preview**: the opening and closing balance, the lines read and the rows that could not be read.
5. Select **Import**. The statement gets its number (BST-YYYY-NNNNN).

![Import statement](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-br-import.png)

The statement must balance (opening + credits - debits = closing) when `bank_reconciliation.require_balanced_statement` is on. A file already imported for the account is refused. Automatic matching runs right after the import (`bank_reconciliation.auto_match_on_import`).

### Match and post bank items

**Auto-match** runs the matching rules on exact amounts: adjustment journals and reversed entries; amount and reference or cheque number; amount within a 5-day date window (`bank_reconciliation.date_window_days`); one bank line against up to 6 book entries and the reverse (`bank_reconciliation.group_max_lines`). Match the rest by hand: tick bank lines and book entries with the same total and match them; when the amounts differ, choose how the difference is treated (adjustment journal, bank error or book error).

Bank charges, interest, final tax on interest and direct credits appear on the statement before they are in the books. Select the bank line and create an adjustment: the bank transaction type proposes the account from the line's description (for example SERVICE CHARGE suggests bank charges). Types marked as needing approval, such as a direct credit booked to suspense, wait for a second user. A returned cheque cancels the official receipt and reopens the client's receivable. **Stale cheques** lists cheques issued more than 180 days ago that have not cleared (`bank_reconciliation.stale_cheque_days`); cancelling one reverses the payment and reopens the payable.

### Prepare the reconciliation

1. Select **New reconciliation** on Reconciliations (or start it from the workspace), choose the **Bank account** and **Period** and select **Start**. The reconciliation (BRC-YYYY-NNNNN) opens as Draft with live figures.
2. Check the **Bank Reconciliation Statement**: balance per bank statement, deposits in transit, outstanding cheques and bank errors give the adjusted bank balance; balance per books, bank credits and charges not yet booked and book errors give the adjusted book balance. The **Difference** must be PHP 0.00.
3. Prepare it. The figures are frozen and the reconciliation waits for the Accounting Manager's approval.

![Bank Reconciliation Statement BRC-2026-00005](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-br-rec.png)

**Print PDF** prints the statement on the company letterhead. The reports **Reconciliation Statement Report**, **Outstanding Cheques**, **Deposits in Transit**, **Unmatched Bank Lines** and **Bank Book** run for any bank account and date.

## Insurer statement reconciliation

![Accounts > Insurer Reconciliation > Insurer Statements](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-ir-statements.png)

Insurers send statements of account: premium remittance confirmations (broker-billed premium the insurer received) and commission statements (direct-bill commission the insurer recognises). BrokerVerse matches them to the remittances, debit notes and policies.

1. Select **Import statement**. Choose the **Insurer**, the **Statement type**, **Period from** and **Period to**, the **Insurer reference**, the **Tolerance (PHP)** (default PHP 1.00, `insurer_reconciliation.amount_tolerance`), the **Statement format** (the insurer's own, else generic) and the **File (CSV or XLSX)**.
2. Select **Preview**, then **Import and match**. The statement gets its number (ISR-YYYY-NNNNN).
3. Open the statement. The counts show **Lines**, **Matched**, **Amount differences**, **Not found at the broker**, **Missing on the statement** and **Unresolved**. Resolve each difference (for example accept the insurer's commission and post the adjustment).
4. Submit it for approval. Every difference must be resolved first (`insurer_reconciliation.require_resolved`). The Accounting Manager approves it.

![An insurer statement with its differences](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-ir-detail.png)

## Tax: BIR forms and returns

![Accounts > Tax > BIR Form 2307](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-2307.png)

| Screen (Accounts > Tax) | What it produces |
|---|---|
| BIR Form 2307 | Certificates of Creditable Tax Withheld at Source per payee and quarter: **Issued by us** (tax the broker withheld on payment vouchers) or **Received** (tax insurers and clients withheld from the broker). |
| VAT Summary | Vatable revenue (commission and fees), output VAT, input VAT and net VAT payable per month or quarter: the working paper for BIR 2550M / 2550Q. |
| SAWT | Summary Alphalist of Withholding Taxes: tax withheld from the broker, for the income tax return. |
| QAP | Quarterly Alphalist of Payees: tax the broker withheld from its payees, for BIR 1601EQ. |
| SLSP Sales, SLSP Purchases | Summary List of Sales and of Purchases. |

For BIR Form 2307, choose **Issued by us** or **Received**, the year and the quarter. The list shows each payee with **Taxpayer Identification Number (TIN)**, **ATC**, **Transactions**, **Income payments subject to expanded withholding tax**, **Tax withheld for the quarter** and **Certificate no.**. Select **View** to see the certificate and issue it: it takes a number from the BIR Form 2307 series (CWT-) and prints on the BIR layout with the broker's details. The ATC per payee type comes from `bir.atc_by_payee` (for example WI515 for agents and sub-agents, WC515 for external referrers). Before the first filing, fill in `bir.withholding_agent_tin`, `bir.registered_name`, `bir.registered_address` and `bir.zip_code` (Master > Configuration, area Accounting & Tax).

The other tax reports work like every report: choose the criteria and dates, **Preview**, then the file format and **Generate**.

> The reports give the figures and the alphalists in the BIR column order. Check them against the current BIR format and the eFPS or eBIRForms validation before filing, and confirm the ATCs and rates with your tax adviser.

## Period end

| Screen (Accounts > Period End) | Use it to |
|---|---|
| Period Management | See the fiscal year and its periods, soft-close or close a period, and import the go-live opening balances. |
| Month-End Close | Run the month-end steps and checklist of a period and submit the close for approval. |
| Year-End Close | Close income and expense to retained earnings and carry the balances into the next year. |
| Recurring Journals | Keep templates for journals that repeat and accruals that reverse on day 1 of the next period. |
| Financial Statements | Income statement, balance sheet and trial balance for any dates; **Export**. |

![Accounts > Period End > Period Management](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-pe-periods.png)

A fiscal year (FY2026) has twelve monthly periods and an adjustment period 13 used by the year-end close. The cards count the periods Open, Soft-closed, Closed and Locked.

| Period status | Who may post into it |
|---|---|
| Open | Everyone with posting rights. |
| Soft-closed | Only the Accounting Manager. |
| Closed | Nobody; the Accounting Manager reopens it first. |
| Locked | Nobody; the periods of a closed fiscal year are locked. |

**Import opening balances** loads the old system's trial balance at the day before go-live (one row per account, debit or credit; debits must equal credits). The balances go into the fiscal year of the go-live date and are read by the trial balance and financial statements; no opening journal is posted.

### Run the month-end close (preparer)

1. Choose Accounts > Period End > Month-End Close and select **New close run**. Choose the **Period**, add **Remarks** and select **Start**.
2. The run (MEC-YYYY-NNNNN) executes its steps in order: (a) Accruals, (b) Recurring journals, (c) Commission deferral (Skipped when off), (d) FX revaluation, (e) Checklist.
3. Read the checklist. Automatic items show Passed, Warning or Failed with the reason. Fix what failed and re-run the checks.
4. Sign off each manual item when it is done, for example the bank reconciliations reviewed and signed off.
5. Submit the close.

![New close run](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-pe-close-new.png)

![Month-End Close 2026-08: steps and checklist](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-pe-run.png)

A blocking item that failed or is not signed off stops the submit; a warning does not. With `accounting.period_close_requires_approval` on, the Accounting Manager approves the submitted run and the period closes. Rerunning the steps first reverses the run's own earlier journals. The checklist items are kept on Master > Finance > Close Checklist: no unposted or pending journals, trial balance balances, suspense cleared (blocking); no unapplied receipts, bank transactions reconciled, sub-ledgers tie out to the GL, issued policies billed, remittances paid, direct-bill commission billed (warning); and the manual items.

### Recurring journals

Select **New template** and enter **Name**, **Kind** (Recurring or accrual), **Frequency**, **Start date**, **End date**, **Status** and **Description**; tick **Post automatically (otherwise pending approval)** and, for accruals, **Reverse on day 1 of the next period (accruals)**; enter the lines with account, memo, debit and credit until the template balances; select **Save**. Templates post on their next run date through the Recurring journals job (switched off in the delivered set-up) or through the month-end close; **Post due journals now** posts every template that is due.

![New recurring journal template](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-pe-recurring-new.png)

### Year-end close (preparer)

The year-end close needs all twelve periods closed. Choose the fiscal year and select **Start year-end close**; run the pre-checks; post audit adjustments with **Adjustment journal** (dated the year end, posted in period 13, approved by a second user). The Accounting Manager closes the year.

## Incentives

| Screen (Accounts > Incentive) | Use it to |
|---|---|
| My Programs | See the programmes with target, achieved, achievement %, potential earning and days left. |
| Calculations | **New Calculation**: choose the period, the programmes, review and submit. The batch (CALC-YYYY-NNNNN) holds the amount per sales person and goes for approval. |
| Approvals | Approve, reject or **Bulk Approve** calculation batches of other users. |
| Statement | The statement per sales person and month: earnings, year to date, pending and last payment. |

![New Incentive Calculation](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-inc-calc-new.png)

Only Sales & Marketing users take part (`incentive.eligible_roles`). Accounting cannot change the programmes it pays; the System Administrator keeps them on Master > Finance > Incentive Programs.

## Finance masters kept by Accounting

| Screen (Master > Finance) | What Accounting does there |
|---|---|
| Taxation | Keep the tax codes: VAT (output, input, zero-rated, exempt), expanded withholding tax codes with their BIR ATC, final withholding, DST, LGT and premium taxes, each with rate, GL account, what it applies to, effective date and status (**Add tax code**). |
| Close Checklist | Keep the checklist items of the month-end close; **Add item** for a manual item; make an item blocking or warning. |
| Bank Statement Formats | Tell the system how to read each bank's export (columns, date format, title rows, debit and credit columns or one signed column); **Add format**, **Test with a file**. |
| Bank Transaction Types | Bank items not yet in the books with the account their adjustment posts to, whether it needs approval and the description pattern that suggests the type; the screen also lists the automatic matching rules. |
| Insurer Statement Formats | How to read each insurer's statement file. |
| Account Determination, Posting Rules, Accounting Flow | Read the accounts behind each account role and the journal each event posts. Changes go through Configuration Approvals (Accounting Manager chapter). |
| Premium Taxes & LGU Rates, Payment Gateways | See the Module reference. |

## Approvals

| Approval | Given or needed |
|---|---|
| Payment voucher, cheque, commission payout, petty cash, journal vouchers, debit notes, remittances, settlements, adjustments, incentive batches | Given by an Accounting user who is not the maker. |
| Month-end and year-end close, bank reconciliation, insurer statement reconciliation, warranty extensions, credit limits | Needed from the Accounting Manager. |
| Posting into a soft-closed period, reopening a period | Accounting Manager only. |

# Accounting Manager

## Role summary

The Accounting Manager (role Accounting Manager) holds the Accounting role as well, so the menus and the daily work are the same as Accounting. On top of that the Accounting Manager is the checker of the finance controls: the month-end and year-end close, period control (soft-close, close, reopen, posting into a soft-closed period), bank reconciliations, insurer statement reconciliations, premium warranty extensions and client credit limits, and, with the System Administrator, changes to posting rules and account determination. The Accounting Manager can never approve what he or she prepared.

![Landing page of the Accounting Manager](/home/user/BDOI-OOTB/docs/package/source/manual-images/m-landing.png)

## Menus available

The menus of Accounting (Accounting chapter). The approval buttons described below appear for the Accounting Manager only.

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Approve vouchers, journals, remittances and debit notes of other users when needed | The approval screens of each module |
| Daily | Approve warranty extensions; set client credit limits | Credit Control |
| Monthly | Approve the bank reconciliation of each account | Bank Reconciliation > Reconciliations |
| Monthly | Approve insurer statement reconciliations | Insurer Reconciliation > Insurer Statements |
| Monthly | Review the close run and approve the month-end close | Period End > Month-End Close |
| As needed | Soft-close, close or reopen periods | Period End > Period Management |
| As needed | Approve posting configuration changes | Master > Finance > Configuration Approvals |
| Yearly | Close the year | Period End > Year-End Close |

## Approve the month-end close

![Month-End Close run as seen by the Accounting Manager](/home/user/BDOI-OOTB/docs/package/source/manual-images/m-pe-run.png)

1. Open the notification, or Accounts > Period End > Month-End Close, and open the submitted run.
2. Check the header (**Run status**, **Period status**, **Prepared by**, **Submitted by**), the **Steps** and the **Checklist**: every blocking item passed or signed off, the warnings explained. Read the Month-End Close Status report and the reconciliation statements of the period.
3. Select **Approve close**: the period is closed (message Close approved; the period is closed). Or select **Reject** with a reason: the run returns to the preparer.

The approver must be a different user from the preparer.

## Period control

![Period Management seen by the Accounting Manager, with Reopen on closed periods](/home/user/BDOI-OOTB/docs/package/source/manual-images/m-pe-periods.png)

On Accounts > Period End > Period Management the **Actions** column offers **Soft-close** and **Close** on open periods and **Reopen** on closed ones. Every change asks for remarks and is kept in the period history with user and time. Reopening a period and posting into a soft-closed period need the Accounting Manager (permission approve:period-end). Other users who post into a soft-closed period are refused with a message that the period is soft-closed.

## Approve a bank reconciliation

![A prepared bank reconciliation opened by the Accounting Manager](/home/user/BDOI-OOTB/docs/package/source/manual-images/m-br-rec.png)

1. Open Accounts > Bank Reconciliation > Reconciliations and the prepared reconciliation.
2. Check that the **Difference** is PHP 0.00, the reconciling items (deposits in transit, outstanding cheques, bank and book errors) and **Prepared by**.
3. Approve the reconciliation. Approving locks every match cleared up to the period end. You cannot approve a reconciliation you prepared.

An approved reconciliation can be reopened with remarks (**Reopen the reconciliation**): it returns to draft and its matches are unlocked. The month-end checklist looks for an approved reconciliation of each bank account with activity in the period.

## Approve an insurer statement reconciliation

Open Accounts > Insurer Reconciliation > Insurer Statements and the submitted statement. Check the matched lines, the amount differences and their resolutions, the lines not found at the broker and the broker records missing on the statement, then approve it. The statement shows **Approved by** with your name and the date.

## Credit control decisions

- **Premium Warranty Monitor**: approve or refuse the extensions requested by Accounting (**Extensions to approve**), up to 90 days after the policy inception (`credit.max_warranty_extension_days`).
- **Client Credit Limits**: set the credit limit of each client. A change shows who made it and when (**Last changed**).

## Year-end close

![Accounts > Period End > Year-End Close](/home/user/BDOI-OOTB/docs/package/source/manual-images/m-pe-year-end.png)

When Accounting has started the year-end close, run the pre-checks and posted the audit adjustments:

1. Open Accounts > Period End > Year-End Close and choose the fiscal year.
2. Check the pre-checks and the net income.
3. Select **Close the year**. The system posts the closing entries in period 13 (income and expense to current year profit or loss, then to retained earnings), writes the balance-sheet balances at year end as the opening balances of the next year (no opening journal is posted), locks the periods and creates the next year.

**Reverse the close** (with a reason) reverses the closing entries, removes the opening balances and unlocks the periods. It is possible until the first period of the next year is closed.

## Posting configuration: Configuration Approvals, Posting Rules, Account Determination

![Master > Finance > Configuration Approvals](/home/user/BDOI-OOTB/docs/package/source/manual-images/m-config-approvals.png)

Posting rule versions, their activation and account determination changes wait on **Configuration Approvals** for a second user with approval rights (Accounting Manager or System Administrator). The requester cannot approve his or her own change, and nothing reaches the ledger before approval. The list shows each change with what it changes, the value before, who requested it and when, and its status.

**Posting Rules** lists every business event (for example Policy issued - broker billed, Endorsement - additional premium, Renewal - broker billed, Endorsement - return premium, Policy cancellation, Premium collection applied, Direct bill - commission booked) with the version in force. Select an event to see each line of the rule (side, account, amount, narration, split per co-insurer), **Simulate** the journal it would build with sample amounts (including a co-insured sample), save a **New version** effective from a date with a change note, or read the **History**.

![Master > Finance > Posting Rules](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-posting-rules.png)

**Account Determination** shows the GL account behind every account role, in the tabs **Premium**, **Customer**, **Miscellaneous**, **RI-Claims**, **Other**, **Payee & payment mode**, **Commission taxes** and **Write-off reasons**, with the events that use each role (for example Brokerage commission income posts to 3201001 Brokerage Commission Income). To change the account of a role, choose the new GL account; the change waits on Configuration Approvals.

![Master > Finance > Account Determination](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-acct-det.png)

**Accounting Flow** shows, for each operational event, what it posts, read from the posting rules in force: the screen or action that triggers it, the approval before it posts, and the accounts it debits and credits. **Open the rule** opens the posting rule.

> Change posting rules only after a simulation. A wrong rule posts wrong journals from its effective date.

## Commission Rate Matrix

![Master > Finance > Commission Rate Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-crm.png)

The matrix holds the brokerage rates the broker earns by insurer, product, line of business and policy type (New business, Renewal or Any), with effective dates. The most specific active rate on the policy date applies: insurer and product, insurer and line of business, insurer, product, line of business; an exact policy type before Any; then the insurer's default rate and the system default (15%). **Add rate**: choose the insurer, product and line of business (at least one), the policy type, the rate, effective from and to, and remarks; save. **Find rate** shows which rate a placement would get and where it comes from. The screen is in the System Administrator's menu; the Accounting Manager agrees the rates.

## Approvals summary

| Approval | Where |
|---|---|
| Approve or reject a month-end close | Month-End Close > run > **Approve close** / **Reject** |
| Close the year; reverse a year-end close | Year-End Close |
| Soft-close, close, reopen periods; post into a soft-closed period | Period Management; any posting screen |
| Approve or reopen a bank reconciliation | Bank Reconciliation > Reconciliations |
| Approve an insurer statement reconciliation | Insurer Reconciliation > Insurer Statements |
| Approve warranty extensions; set credit limits | Credit Control |
| Approve posting configuration changes | Configuration Approvals |
| Approve vouchers, journals, remittances, debit notes and incentive batches of other users | The approval screens of each module |

# Module reference

This chapter lists every menu screen in menu order with its purpose, its main fields and the rules that apply. The persona chapters give the step-by-step procedures; the reference points to them.

## Dashboard

| Screen | Purpose | Main content and rules | Roles |
|---|---|---|---|
| Executive Dashboard | Business performance against target. | Period (This Month, This Quarter, This Year); Total Revenue, Active Policies, New Business, Claims Rate, Retention Rate, Customer Satisfaction, Premium Receivable (Clients), Commission Receivable (Insurers, Direct Bill); trends, revenue by product line, regional performance, top products, top sales performance; **Export Report** (Production Register). Targets from `dashboard.targets`. | All but Claims |
| Claims Dashboard | Claims workload. | Total Open Claims, Claims Overdue (`claims.sla_days`), Today's Claims, recent claims; **Export Report**. | Claims, System Administrator |
| Processing Dashboard | Processing Workbench. | Submissions, cycle time, open alerts, workload, submissions list, open tasks; **New Submission**. | Processing Team, System Administrator |
| Sales Dashboard | Sales team performance. | Sales person, period; prospects, quotations, conversion, policies issued, premium, open pipeline; trend and pipelines. | Sales & Marketing, System Administrator |

![Dashboard > Executive Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-exec-dashboard.png)

## Operations

### Home

The user's own book: prospects, clients, policies sold, commission chart, upcoming events, earned commission, collected premium, receivables and gross premium; **Create Quote**.

### Sales & Marketing

| Screen | Purpose | Fields and rules | Procedure |
|---|---|---|---|
| Prospects | Record and follow prospects (LD-). | Category, names, date of birth (age 18 to 100), gender, e-mail, Philippine mobile number, address with 4-digit ZIP code; statuses New, Contacted, Qualified, QuoteGenerated, Converted, Lost; **Bulk Upload** (.xlsx or .csv, up to 10 MB). | Sales & Marketing |
| Quick Quote | Quote package products on the spot. | **Start quote** for products with a wizard; **Request quotation** for the others. | Sales & Marketing |
| Compare Insurers | Compare insurers' premiums for a package product. | Product, sum insured, location of the risk, inception date; rates from Insurer Rate Tables. | Sales & Marketing |
| Request for Quotation (Broker Slip) | Present a risk to several insurers (BS-) and record offers (OFR-). | Customer, product, insured, period, response due, risk details, covers, insurers to approach (required); statuses Draft, Submitted, Responses in, Closed, Cancelled. | Processing Team |
| Quotations | Price cover for the client (QT-). | Server re-pricing; validity 30 days; statuses Draft, Pending Customer, Customer Accepted, Approved, Rejected, Dropped, Expired, Converted to Policy; customer response Accepted, Declined, Revise. | Sales & Marketing |
| Placement Slips | Firm order to the insurers (PS-). | Participants with shares totalling exactly 100% and one lead; statuses Draft, Sent to insurer, Bound, Declined, Policy issued, Cancelled; **New direct placement**, **Record Issued Policy**. | Processing Team |

### Clients, Policy and Claims

| Screen | Purpose | Fields and rules | Procedure |
|---|---|---|---|
| Clients | The client record (CL-) with tabs Policy, Claim, Renewal, Endorsement, Data privacy. | Created at the first policy; details changed by Personal Details Change endorsement. | Operations |
| Policy | Policies (POL-) with payment status; **More Actions**: Claim, Endorsement, Reminder; **Bulk Upload**. | Policy statuses Active, Expired, Renewed, Lapsed, Cancelled; payment statuses Pending, Reviewing, Partial, Completed, Refunded; motor issue needs the KYC fields. | Sales & Marketing, Operations |
| Claims | Claims (CLM-) and their journey. | Date of loss inside the policy period and not in the future; blocked while premium unpaid; settlement maker-checker; statuses Pending, Processing, Pending Approval, Approved, Settled, Rejected, Closed. | Claims |

### Renewals

| Screen | Purpose and main content |
|---|---|
| Renewal Policy | Expired and expiring policies with their renewal state; **Renew**, **Continue renewal**, **Open** (the renewed term). |
| Renewal Batch | Batches of up to 500 policies expiring within 30 days; **Create Batch**, **Refresh**. |
| Renewal Queue | Policies due: days to expiry, premium, status, risk, sales person, attempts; cards Total Policies, Due Soon (30 days), At Risk, In Grace Period. |
| Retention Analytics | Renewal rate, premium retention, cycle time, satisfaction; trends by product and sales person; recommended actions; **Export Report**. |
| At-Risk Policies | Risk score and level per policy (weights in `renewals.risk_weights`). |
| Negotiations | Timeline, details and communications per renewal; **Add note**, **Request approval**, **Send Communication**. |
| Lapse Management | Lapsed and grace-period policies, revenue at risk, win-back campaigns; **Create Campaign**. |
| Performance | Renewal rate, premium retention and cycle time against targets (85%, 90%, 15 days); KPI scorecard. |

### Open Items and Payments

**Open Items**: Expiring Policy, Quote Pending, Pending Payments and Renewal Request, each with **See More**. **Payments**: gross premium, collected premium, receivables and earned commission; tabs Paid, Pending, Reviewing; type POLICY, RENEWAL POLICY or ENDORSEMENT.

## Accounts

| Screen | Purpose | Main fields and rules |
|---|---|---|
| Receipts | Official receipts (OR-, RT-) against open bills. | Receipt date and type, branch, department, customer code, policy, currency, transaction code, receipt mode, remarks; amount not above the bill balance; **Bulk Print**, **Bulk Upload** (1,000 rows). |
| Collections | Open premium by ageing bucket; reminders; **Import open items**. | Due date from the insurer's premium payment warranty or 30 days; reminders 7 days before due, then every 7 days. |
| Credit Control > Instalment Plans | Instalment schedules of broker-billed bills. | 4 instalments proposed, up to 12; monthly, quarterly, semi-annual. |
| Credit Control > Premium Warranty Monitor | Unpaid premium past or near the insurer's warranty. | At risk from 7 days before the deadline; extensions up to 90 days, approved by the Accounting Manager. |
| Credit Control > Client Credit Limits | Credit limit per client against open premium. | Over-limit policies issued with a warning; limits set by the Accounting Manager. |
| Credit Control > Remittance Ageing | Collected premium not yet remitted, per insurer. | Aged on the insurer's remittance terms from the collection date; **Excel**. |
| Disbursement | Payment vouchers and cheques (PV-, DT-). | Payee type, criteria, payee, policy, transaction type, currency; maker-checker; statuses Draft, For approval, Approved, Paid, Cancelled. |
| Journal Voucher, Correction JV, Reversal JV | Manual journals (JV-), corrections and reversals. | Must balance; approval required (`journal.require_approval`); period status rules. |
| Open Entry Matching, Open Entry Unmatching | Match open debit and credit entries of an account; write-offs. | Sub account code, pull, match; write-off reason limits. |
| Accounting Query | Search accounting entries. | Policy, client, entry type, reference type, status, dates, GL code; **Export**. |
| All Clients Accounting | Balance per client. | Transactions, debits, credits, balance; **Export CSV**. |
| Petty Cash (Initiate, Request, Disbursement, Receipts, Replenish) | Petty cash funds and their movements (PC-, PCR-, PCRC-). | Fund size, maximum per transaction, minimum cash box; maker-checker. |
| Bank Reconciliation (Workspace, Reconciliations, reports) | Statements (BST-), matching, adjustments, reconciliations (BRC-). | Balanced statement; duplicate file refused; auto-match rules; stale cheques after 180 days; approval by the Accounting Manager. |
| Insurer Reconciliation > Insurer Statements | Insurer statements of account (ISR-) matched to remittances and debit notes. | Tolerance PHP 1.00; every difference resolved before submission; approval by the Accounting Manager. |
| Tax (BIR Form 2307, VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases) | BIR certificates, working papers and alphalists. | Quarter and payee; ATC per payee type; broker details in `bir.*`. |
| Period End (Period Management, Month-End Close, Year-End Close, Recurring Journals, Financial Statements) | Fiscal calendar and closing (MEC-, YEC-, RJV-). | Period statuses Open, Soft-closed, Closed, Locked; checklist; approval by the Accounting Manager. |
| Incentive (My Programs, Calculations, Approvals, Statement) | Incentive results and payment (CALC-). | Calculation batches approved by another user. |

### Remittance

| Screen | Purpose and main content |
|---|---|
| Automated Processing | Scheduled remittances per insurer; **Validate**, **Process Selected**, **Schedule for Later**, **View History**. |
| Tracking | Remittances (REM-) with insurer, policies, gross amount, commission, net amount and status. |
| Statements | Remittance statements for insurers, prepared in steps (**Previous**, **Next**) and e-mailed as a download link. |
| Settlement | Insurer settlements (SET-): insurer, policies, calculation, adjustments, payment, workflow; **Save draft**, **Submit for approval**, **Print**. |
| Reconciliation | Match imported bank transactions with remittances within PHP 0.50 (`remittance.reconciliation_tolerance`); **Import**, **Auto Match**, **Match Selected**, **Force Match**. |
| Bulk Processing | Upload remittance data in bulk. |
| Scheduling | Remittance schedules per insurer (insurers, cut-off days, frequency, next run date); **New schedule**, **Run now**. The `remittance-schedules` job in Master > Schedules runs the due schedules daily once it is switched on. |
| Electronic Transfer | Transfers by InstaPay, PESONet or RTGS (PhilPaSS) within their limits; **New transfer**, **Batch process**, **Export**. |
| Approval Workflow | Approvals of remittances, settlements, transfers and adjustments within the approver's Authority Matrix limit; pending, overdue and history. |
| Exception Management | Remittance exceptions; assignment and reports. |
| Agency Bill Processing | Statements of account (bills) to agencies; **Load agencies**, **Validate**, **Process bills**. |
| Direct Bill Processing | Commission debit notes (DN-) to insurers; tabs Raise Debit Note, Debit Notes, Billing Mode. |
| Adjustments | Remittance adjustments (ADJ-); **New Adjustment** (Create New Adjustment), approval by another user. |
| Notifications | Remittance notifications to insurers; **Compose**. SMS and letter are logged only. |
| History | Every remittance event; **Export History**. |
| Analytics | Remittance KPIs against the targets in `remittance.kpi_targets`. |

![Accounts > Remittance > Automated Processing](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-rem-automated.png)

## Commission

| Screen | Purpose and main content |
|---|---|
| Commission Dashboard | Brokerage income, comsub, net margin, margin %, outstanding payable, WHT withheld; by referrer, status, month, product and insurer; Accounting and Management views. |
| Agents/Referrer Accounts | Referrers with type, level, policies, net payable, WHT type, bank account; account per referrer with current, future and past cycles; **Mark eligible**, **Approve**, **Generate payout**. |

## Reinsurance

| Screen | Purpose and main content |
|---|---|
| Treaty Dashboard | Active treaties, capacity, utilisation, premium ceded, claims recovered, renewal timeline. |
| Cession Tracking | Cessions (CES-) per policy and treaty; **Process Cession**, **Generate Bordereau** (BDX-). |
| Claims Recovery | Recoverable amounts on claims (RCL-); **Register Recovery**. |
| Reconciliation | Reinsurer statements (REC-) against our figures; tolerance 1%; **Reconcile Statement**, **Log Exception**. |
| Analytics | Utilisation, loss ratio trend, retention against 65%, recovery performance, catastrophe exposure. |

![Reinsurance > Treaty Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ri-treaties.png)

## Reports

| Screen | Content |
|---|---|
| All Reports | Every report the role may run, grouped, with a description and a search box. |
| Operational Reports | Production, Claims, Renewal, Remittance, Broker Commission. |
| Financial Reports | SOA/Premium Receivable, Collection Report, Payables, Journal, Trial Balance, Income Statement, Balance Sheet, Trial Balance Movement, General Ledger Detail, Aged Payables to Insurers, Month-End Close Status, Co-insurance Register, Due to Insurers by Co-insurer. |

See the chapter Reports, dashboards, schedules and notifications.

## Master

### Configuration screens

| Screen | Purpose |
|---|---|
| System Settings | Branding (app title, logo, favicon), display currency, default language, theme colours. |
| Configuration | Every business setting by area; changes audited. |
| Document Numbering | Number series: prefix, format tokens, digits, counter reset, next number. |
| Schedules | Scheduled jobs: timetable, status, next and last run; **Run now**, **Run history**, **Edit schedule**. |
| Audit Trail | Every audited action by record type, record ID, user and dates. |
| E-mail Outbox | Queued, sent and failed e-mails with their attachments; **Retry**. |
| Data Privacy > Data Subject Requests | Requests of data subjects (DSR-) with due dates; **Log request**, **Export personal data**, **Anonymise**, **Close**. |
| Data Privacy > Consent Register | Consents given, refused and withdrawn by clients and prospects. |

### Generals

| Screen | Purpose and main fields |
|---|---|
| Organization > Company | The broker company: code, name, licence number, e-mail, TIN, logo, website, address, phone, fax; letterhead company. |
| Organization > Branch | Branches and departments. |
| Insurance Management > Insurance Company | Insurers: code, name, address, phone, e-mail, TIN; credit terms (premium payment warranty, remittance terms, default billing mode); **Upload**. |
| Insurance Management > Line of Business, Product, Cover | Lines, products (with their line) and covers. |
| Insurance Management > Signatories | Authorised signatories of quotations and documents. |
| Insurance Management > Vehicle | Vehicle brands, models, variants, seating; **Upload**. |
| Location > Country, State, City | Address lists; **Upload**. |
| Employee Management > Hierarchy, Designation | Staff structure; branch, designation and reporting line are set on the user. |
| User Management > User, Role, User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews | Users and access controls (System Administrator chapter). |

### Finance

| Screen | Purpose and main fields |
|---|---|
| Account Determination | GL account per account role, payable per payee type, cash account per payment mode, commission taxes, write-off reasons. |
| Posting Rules | The journal rule of each business event; simulate, version, history. |
| Configuration Approvals | Pending posting configuration changes for a second user. |
| Accounting Flow | What each event posts, from the rules in force. |
| Package Bundles | Packages sold under one master policy (sections with their own insurer): code, bundle, customer segment, sections, bundle discount, default sum insured; **Add bundle**. |
| Insurer Rate Tables | Each insurer's rates for package products: product, insurer, rate basis, rate, minimum premium, deductible, key benefits, commission, effective dates; used by Compare Insurers and Quick Quote; **Add rate**. |
| Premium Taxes & LGU Rates | VAT or premium tax, DST, FST and the local government tax per city or municipality (code, city, province, rate, effective dates); tabs Local government tax, Tax and charge rules, Calculator; **Add city / municipality**. |
| Payment Gateways | Online payment of premium (GCash, Maya, GrabPay, cards, online banking) through a payment link: gateway, mode (sandbox or live), methods, fee, link validity (72 hours), issue the policy when paid, bank account credited; payment log. Merchant keys are set on the server, never on the screen. |
| Commission Rate Matrix | Brokerage rates by insurer, product, line and policy type; **Add rate**, **Find rate**. |
| Transaction Code, Currency, Exchange Rate | Accounting transaction codes, currencies and exchange rates. |
| Bank | Banks and bank accounts with GL cash account, statement format and reconcile-from date; **Upload**. |
| Account Category, Main Account, Sub Account | The chart of accounts: code, name, statement group, category, normal balance, open-item flag, manual JV allowed, system use, status; **Upload**. |
| Taxation | Tax codes with rate, BIR ATC, GL account and effective date. |
| Close Checklist | Month-end checklist items, automatic or manual, blocking or warning. |
| Bank Statement Formats, Bank Transaction Types, Insurer Statement Formats | How statement files are read; bank items and matching rules. |
| Remittance Master | Automated remittance, statement templates, settlement parameters, bulk processing formats, exceptions, agency bill, adjustment and notification templates. |

![Master > Finance > Premium Taxes & LGU Rates](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-premium-taxes.png)

### Incentive and reinsurance masters

| Screen | Purpose |
|---|---|
| Incentive Programs | Incentive programmes (INC-): type, target metric, base target, frequency, dates. |
| Reinsurance Treaty | Treaties (TRT-): type, line, reinsurers, period, limits and commission; approval by a second user. |

## Product Configurator

| Screen | Purpose |
|---|---|
| Dashboard | Products with category, line, version, status, base rate and commission; active products, total premium, average loss ratio and commission. |
| Product Templates | Product templates (TPL-) with versions and status (Draft, Active, Retired); the motor tariff. |
| Coverage Builder | Covers: code, name, mandatory or optional, deductible, premium impact. |
| Rating Engine | Rating factors with rules; Test Calculator. |
| Acceptance Rules | Acceptance, validation and loading rules. |
| Document Manager | Document templates per stage. |
| Market Mapping | Products mapped to insurers with commission, override and target. |
| Risk Mapping | Product definitions per line; IAR risk sections. |
| Product Analytics | Policies, premium, loss ratio and margin by product. |

![Product Configurator > Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-pc-dashboard.png)

## Number series

Numbers follow their series on Master > Document Numbering. The delivered format is {PREFIX}-{YYYY}-{SEQ} with five digits, for example POL-2026-00001, restarting every calendar year.

| Prefix | Record |
|---|---|
| LD | Prospect |
| BS, OFR | Request for quotation (broker slip), insurer offer |
| QT | Quotation, Quotation Slip |
| PS | Placement slip |
| POL, CL | Policy, client code |
| INV | Bill |
| OR, RT, AR | Official receipt, receipt transaction, acknowledgement receipt |
| PV, DT | Payment voucher, disbursement transaction |
| JV | Journal voucher (manual and system) |
| END, CLM | Endorsement, claim |
| REM, SET, ADJ | Remittance, settlement, adjustment |
| DN | Commission debit note |
| MEC, YEC, RJV | Month-end close, year-end close, recurring journal |
| BST, BRC, ISR | Bank statement, bank reconciliation, insurer statement |
| CWT | BIR Form 2307 |
| PC, PCR, PCRC | Petty cash transaction, request, receipt |
| CALC, INC | Incentive calculation, incentive programme |
| DSR | Data subject request |
| CES, RCL, REC, BDX, TRT | Cession, recovery, reinsurance reconciliation, bordereau, treaty |

# Reports, dashboards, schedules and notifications

## Reports

BrokerVerse has 39 catalogue reports: 11 operational, 16 financial, 5 tax (BIR) and 5 reconciliation reports, and 2 management reports. Every report opens on the same report screen with the filters it uses. The BrokerVerse Reports Book describes each report: who may run it, its filters, columns, totals, outputs and the transactions that feed it.

- **Reports > All Reports** lists every report your role may run, grouped into Operational Reports and Financial Reports, with a short description and a search box.
- **Reports > Operational Reports** and **Reports > Financial Reports** are shortcuts to the most used reports. The tax reports are also under Accounts > Tax, the bank reports under Accounts > Bank Reconciliation and the financial statements under Accounts > Period End > Financial Statements.

![Reports > All Reports](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-report-catalogue.png)

To run a report:

1. Open the report.
2. Choose the **Report Criteria** (required), for example Overall, Agent, Principal Insurer or Branch. The filters that the criteria use become available.
3. Enter **From Date** and **To Date**.
4. Choose the other filters you need: agent, company (principal insurer), branch, client, product, status, account or bank account.
5. Select **Preview** to see the rows on screen with the totals and the summary figures.
6. Choose the **File format**, **CSV**, **Excel (XLSX)** or **PDF**, and select **Generate**. The file downloads.

![Report screen: Production Register](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-report-production.png)

A file holds up to 50,000 rows (`reports.max_rows`). PDF reports print on the company letterhead. Download links are valid for 72 hours and report files are kept for 90 days. Every report file produced is recorded. The Daily reports job produces the Production Register, the Collection Report and the Claims Position every morning at 05:00.

| Persona | Reports in the menu |
|---|---|
| Sales & Marketing, Processing Team, Operations, Claims | All Reports; Operational Reports. The catalogue shows the reports of the role. |
| Accounting, Accounting Manager | All Reports; Operational Reports > Remittance and Broker Commission; every Financial Report; the tax and bank reports. |
| System Administrator | Every report. |

## Dashboards

| Dashboard | Where | Persona |
|---|---|---|
| Executive Dashboard | Dashboard > Executive Dashboard | Every role except Claims |
| Sales Dashboard | Dashboard > Sales Dashboard | Sales & Marketing |
| Processing Dashboard | Dashboard > Processing Dashboard | Processing Team |
| Claims Dashboard | Dashboard > Claims Dashboard | Claims |
| Commission Dashboard | Commission > Commission Dashboard | Sales & Marketing, Accounting |
| Renewal dashboards | Renewals > Retention Analytics, Performance | Sales & Marketing, Operations, Processing Team |
| Reinsurance dashboards | Reinsurance > Treaty Dashboard, Analytics | Processing Team |
| Product dashboards | Product Configurator > Dashboard, Product Analytics | Processing Team (Dashboard also Sales and Operations) |

Dashboards show live figures; they change as soon as a transaction is saved. The Executive Dashboard compares the period chosen (This Month, This Quarter, This Year, calendar periods in Manila time) with the whole previous period and shows the targets of `dashboard.targets`. **Export Report** downloads the Production Register for the dates chosen.

## Schedules

BrokerVerse runs its daily work through scheduled jobs, in Manila time: policy expiry (00:15), quotation expiry (00:30), dormant accounts (01:45), housekeeping (02:45), daily reports (05:00), renewal pipeline (05:30), renewal notices (06:00), receivable ageing (07:00), collection reminders (08:00), the e-mail outbox (every 5 minutes) and the renewal notice queue (every minute). Five finance jobs are delivered switched off: accrual auto-reversal, recurring journals, period auto soft-close, bank reconciliation auto-match and the month-end close reminder; Accounting decides whether to switch them on or run them from the screens. The remittance schedules job (06:15) and the overdue data subject requests job (07:00) are also delivered switched off. The System Administrator sees and runs the jobs on Master > Schedules. The BrokerVerse Schedules and Batch Jobs document describes each job, what it reads and writes, and what to do when it fails.

## Notifications and e-mails

**In-app notifications** appear under the bell. A notification goes to one user, or to every user who holds a permission (for example the approvers of journal vouchers). The main notifications:

| Area | Notifications |
|---|---|
| Quotation | Quotation sent for approval (to the Processing Team), customer accepted, quotation approved. |
| Policy | Policy issued; endorsement completed. |
| Billing and collection | Premium payment to verify (Accounting); online payment received or not applied; client over its credit limit; warranty breached. |
| Claims | New claim; claim status changes; settlement to approve; settlement approved. |
| Renewal | Renewal notices sent; renewal terms to approve; renewed; lapsed. |
| Remittance and commission | Remittance, settlement and debit note approvals; incentive batch approvals. |
| Finance | Journal voucher and petty cash approvals; month-end reminders; close run to approve. |
| Reinsurance | Treaty awaiting approval; treaty approved. |

**E-mails** are queued in the E-mail Outbox and sent by the E-mail outbox job when sending is switched on. The main e-mails are the quotation approval request and shared quotation to clients, the request for quotation and the placement slip to insurers, the policy issued and endorsement notices to clients, the renewal notices (First, Second and Final Notice), the premium payment reminders, the Preliminary Loss Advice to insurers, the commission debit note and the remittance statements to insurers, scheduled reports to staff and the password reset code. E-mails carry no attachments; documents travel as download links or are printed. SMS, Viber and WhatsApp are not sent by the system: where a screen offers SMS, phone or letter, the action is only recorded. The wording of each e-mail is a template in Master > Configuration; the BrokerVerse Communication Templates and Touchpoints document lists every e-mail and notification with its trigger, recipient and text.

![Notifications under the bell](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-bell.png)

# Troubleshooting, FAQ and glossary

## Common messages and what to do

| Message or problem | What it means and what to do |
|---|---|
| Not authorised: Your role does not give access to this screen | The screen is not part of your role. Use your menu, or ask the System Administrator whether your role is right. |
| Account locked after failed sign-ins | 5 wrong passwords in a row. Ask the System Administrator to unlock the user or reset the password. |
| Too many sign-in attempts | More than 10 attempts in 5 minutes from one computer or for one user. Wait 5 minutes, then sign in again. |
| The authentication code is refused | Use the current code of the app; check that the phone's clock is set automatically. |
| You were signed out | 30 minutes without activity, or your password or role changed. Sign in again. |
| Invalid mobile number | Use a Philippine mobile number: 0917 123 4567, +63 917 123 4567 or 9171234567. |
| A required field is empty | Fill in every field marked with an asterisk. |
| Shares must total exactly 100% (now ...%) | Correct the participants' shares so that they total 100%, with exactly one lead. |
| Exactly one participant must be the lead insurer | Tick Lead for one participant only. |
| This line requires a Placement Slip before the policy is issued | Create the placement slip, send it and record the confirmations, then issue from the slip. |
| The policy cannot be issued from the placement slip | An insurer has not confirmed, or your role cannot issue policies. |
| Issue refused for missing KYC or vehicle identifiers | Complete the ID type, ID number and image, chassis number, motor number and plate or MV file number. |
| Only Draft quotations can be sent for approval | The quotation was already sent. Wait for the client, or record the response Revise to return it to Draft. |
| A quotation converted to a policy cannot be edited | Raise an endorsement on the policy instead. |
| The saved premium differs from what you typed | The server prices every quotation from the configured rates and taxes. Check the rates with the Processing Team. |
| The date of loss is outside the policy period | Check the date of loss and the policy period. |
| The claim is refused while premium is unpaid | Ask Accounting to post the receipt first (`claims.block_unpaid_premium`). |
| The settlement date cannot be before the issue date; Enter an amount greater than zero | Correct the settlement dates or amount. |
| Claim, Endorsement greyed out on the policy row | The premium payment is Pending or Reviewing, or the policy is expired, lapsed, cancelled or renewed. |
| Approval refused for the maker | Maker-checker: ask another user who may approve. |
| Accounting period ... is soft-closed | Date the entry in an open period, or ask the Accounting Manager. |
| Accounting period ... is closed | Ask the Accounting Manager to reopen the period, with remarks. |
| Journal voucher refused: debit and credit differ | Correct the lines until they balance. |
| This file was already imported (BST-...) | The bank statement is already on file for the account. Do not import it again. |
| The statement does not balance | Opening balance + credits - debits must equal the closing balance. Check the file and the balances entered. |
| Commission payout blocked: no bank account | Add the referrer's bank account first. |
| A discount above the role's limit is refused | The Authority Matrix limits the discount of your role. Ask a role with a higher limit. |
| E-mails are not received | Sending is switched off or the mail server is not set; the E-mail Outbox says which. Ask the System Administrator. |
| Something went wrong on this screen | Reload the screen. If it persists, report the screen, the record number, the time and the request ID to support. |

## Frequently asked questions

**Why do I not see a menu my colleague has?** The menu shows only the items of your role. Ask the System Administrator if you need another role.

**Can I delete a policy, a receipt or a journal?** No. Records that reached the ledger are corrected by an endorsement, a reversal, a correction journal or a cancellation, so the audit trail stays complete.

**Who posts the official receipt?** Only Accounting. Other roles record how the client paid; Accounting verifies the payment and posts the receipt.

**When does the referrer get paid?** When the premium is fully collected, the commission line becomes eligible; another Accounting user approves it and Accounting pays it by voucher less withholding tax. The referrer must have a bank account on file.

**What is the difference between broker billed and direct bill?** Broker billed: the client pays the broker, who remits the premium to the insurer net of commission. Direct bill: the client pays the insurer, and the broker bills its commission plus VAT to the insurer with a debit note.

**How are co-insurance amounts split?** By each insurer's share; the rounding remainder goes to the lead. The same split applies to the bill, the remittance, claims and the reports.

**Can I work on a period that is closed?** No. A soft-closed period accepts postings from the Accounting Manager only; a closed period accepts none until the Accounting Manager reopens it.

**How do I report a problem?** Give the menu path, the record number (for example PS-2026-00023), the time to the minute, your user ID, the message and the request ID shown in the error. Never send a password or a two-step code.

## Glossary

| Term | Meaning |
|---|---|
| Account role | A name for the purpose of an account (for example commission income) that a posting rule uses; Account Determination maps it to a GL account. |
| APPA | Auto Passenger Personal Accident: personal accident cover for the driver and passengers of a vehicle, priced per seat. |
| ATC | Alphanumeric Tax Code of the BIR, for example WI515 or WC139. |
| BIR Form 2307 | Certificate of Creditable Tax Withheld at Source, issued by the withholding agent to the payee each quarter. |
| Billing mode | How the premium is paid: broker billed or direct bill. |
| Bordereau | The list of policies ceded to a reinsurer in a period. |
| Bound | All insurers of a placement slip have confirmed their shares. |
| Broker billed | The client pays the premium to the broker, who remits it to the insurer net of commission. |
| Broker slip | The request for quotation that presents a risk to several insurers. |
| Brokerage | The commission the insurer pays the broker. |
| Co-insurance | Several insurers share one risk, each for a percentage, under one lead insurer. |
| Comsub | The share of the brokerage paid by the broker to an agent or referrer. |
| CTPL | Compulsory Third Party Liability: the motor cover required for LTO registration, priced at the Insurance Commission tariff per vehicle class. |
| Debit note | The broker's bill to an insurer for commission on direct-bill policies. |
| Direct bill | The client pays the premium directly to the insurer; the broker bills its commission to the insurer. |
| DST | Documentary stamp tax on the premium (PHP 0.50 on each PHP 4.00 of premium or fraction, NIRC section 184). |
| Endorsement | A change to an issued policy: details, cover, period or cancellation, with additional or return premium. |
| EWT | Expanded withholding tax: income tax withheld at source on commission and other income payments, creditable against the payee's income tax. |
| FST | Fire service tax on fire premium (2% in the delivered set-up). |
| Gross premium | Net premium plus taxes (and CTPL for motor) less discount: what the client pays. |
| IAR | Industrial All Risks. |
| KYC | Know your customer: verification of the client's identity with a government ID. |
| Lapse | A policy not renewed within the grace period after expiry. |
| Lead insurer | The insurer that leads a co-insurance and whose terms apply. |
| LGT | Local government tax on the premium (0.75% in the delivered set-up, or the rate of the city or municipality). |
| LGU | Local government unit: the city or municipality whose tax rate applies. |
| Maker-checker | The maker enters a transaction; a different user approves it. |
| Net premium | The premium before taxes. |
| OR | Official receipt: the BIR-registered receipt issued for money received. |
| Placement slip | The firm order to the lead insurer and the co-insurers. |
| Posting rule | The recipe that turns a business event into journal lines. |
| Premium payment warranty | The number of days the insurer allows the client to pay the premium. |
| QAP | Quarterly Alphalist of Payees, filed with BIR 1601EQ. |
| Quotation Slip | The terms offered to the client, priced with taxes and commission. |
| Remittance | Payment of collected premium, net of commission, to the insurer. |
| SAWT | Summary Alphalist of Withholding Taxes: the tax withheld from the broker by its payors. |
| SLSP | Summary List of Sales and Purchases. |
| SOA | Statement of account: the list of bills of a client with amount, paid and balance; also the insurer's statement to the broker. |
| Soft-closed | A period that accepts postings only from the Accounting Manager. |
| Stale cheque | A cheque not cleared within 180 days of issue. |
| TIN | Taxpayer identification number. |
| VAT | Value-added tax: 12% on the premium of non-life insurance and on the broker's commission. |
| Win-back campaign | An offer to bring back clients whose policies lapsed. |
