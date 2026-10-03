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
- **Paging**: use the arrows at the bottom right (first, previous, next, last page) and **Rows per page** to see more rows. The text next to the arrows shows the rows on screen and the total, for example 1 - 5 of 82.
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
| Remittance, settlement and adjustment | Accounting | Another Accounting user; level by amount | `remittance.approval_levels` |
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
| Master > Configuration > Audit Trail | Every audited action, searchable by record type, record ID, user and dates. | System Administrator |
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

