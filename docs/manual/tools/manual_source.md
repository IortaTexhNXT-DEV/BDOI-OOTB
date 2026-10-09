# About this manual

> **Note:** The reference user manual given to brokers is the package user manual, docs/package/source/user-manual.md (BrokerVerse_User_Manual in docs/package/05_Delivery). This earlier role-based text is kept because the role decks read it; where the two differ, the package user manual applies.

## Purpose

BrokerVerse OOTB is the insurance broking platform of iorta TechNXT for non-life brokers in the Philippines. One system covers the whole broking cycle: prospects and leads, placement with insurers, quotations, policy issue, billing and collection, commission, remittance to insurers, endorsements, claims, renewals, the general ledger, the month-end and year-end close, BIR reporting and bank reconciliation.

This manual tells you how to use each screen. For each task it gives the menu path, the steps, the fields you fill in and what the system does when you save: the number it issues, the journal it posts, the approval it asks for and the report that picks the transaction up.

## Who this manual is for

BrokerVerse has seven roles. Each user holds one role, and the menu shows only what that role may use.

{widths: 30,70}
| Role | What the role does in BrokerVerse |
|---|---|
| Sales & Marketing (Account Executive) | Records prospects and leads, requests quotations, follows up renewals and watches its own production and commission. |
| Processing Team (Placement & Policy Processing) | Sends Broker Slips to insurers, compares offers, prepares Quotation Slips and Placement Slips, records insurer confirmations, issues and checks policies, processes endorsements, maintains product templates and reinsurance. |
| Operations (Client Servicing) | Services clients: client records, endorsement requests, renewals, open items, payment capture and documents. |
| Claims | Registers claims, collects documents, follows up insurers and adjusters, and records and approves settlements. |
| Accounting | Issues official receipts, collects premium, remits to insurers, pays commission and incentives, reconciles bank accounts, prepares the month-end and year-end close and the BIR reports. |
| Accounting Manager | Does everything Accounting does and approves the month-end and year-end close and bank reconciliations, reopens periods and posts into soft-closed periods. |
| System Administrator (Super Admin Access) | Sees every menu. Maintains users, masters, document numbering, posting rules, system settings, configuration and schedules, and reads the audit trail. |

Start with Chapter 2 (Getting started) and Chapter 3 (The broking cycle). Chapter 25 has a one-page guide for each role that points to the chapters you need.

## Conventions

| Convention | Meaning |
|---|---|
| Operations > Broker Slips | A menu path. Choose the first item in the sidebar, then the next one. |
| Save, Compare offers | Buttons, tabs and fields are written exactly as they appear on the screen. |
| `limits.quote_validity_days` | A configuration key. You find it on Master > Configuration. |
| BS-2026-90001 | An example record from the sample data shown in the screenshots. |
| ₱ 28,569.53 | Amounts are in Philippine pesos with Philippine digit grouping. |
| 29/09/2026 | Dates use the configured format DD/MM/YYYY. |
| Maker and checker | The maker enters a transaction. A different user, the checker, approves it. |

> **Note:** The screenshots come from a BrokerVerse OOTB system loaded with sample data on 29 September 2026. Your screens show your own data and, if your System Administrator has set them, your company name and logo. Your menu shows only the items of your role.

# Getting started

## Signing in

Sign in with your own user ID and password. Never share a user ID: every action is recorded against it in the audit trail.

![The sign-in page: illustration on the left, sign-in panel on the right (example values)](intro-login)

1. Open the BrokerVerse address your System Administrator gave you in Chrome, Edge or Firefox.
2. In User ID, type your user name.
3. In Password, type your password. Select the eye icon to show the password while you type, and select it again to hide it.
4. Select Sign in.

A language box appears at the top of the sign-in panel only when more than one screen language is offered; the delivered system offers English only. The system opens your landing page. Each role lands on the first dashboard of its menu (see *Roles and menus* below).

One more step can follow the password, in the same panel:

| Step | When it appears |
|---|---|
| Two-step verification | Two-step verification is on for your user. |
| Set up two-step verification | Your role must use two-step verification and you have not set it up yet. |
| Change password | You sign in with a temporary password, an administrator has reset your password, or your password is older than 90 days. |

### Password rules

| Rule | Standard value | Setting |
|---|---|---|
| Minimum length | 8 characters | `security.password_min_length` |
| Must contain | an upper-case letter, a lower-case letter, a digit and a symbol | `security.password_require_*` |
| Password history | the last 5 passwords cannot be used again | `security.password_history_count` |
| Maximum age | 90 days; after that you choose a new password when you sign in | `security.password_max_age_days` |

Every screen where you choose a password lists these rules under the new password and ticks each rule as soon as the new password meets it.

### Change your password

A new user receives a temporary password from the System Administrator. At the first sign-in the system asks for a new password before anything else, with the subtitle You must choose a new password before you continue. The same happens after an administrator resets your password; when your password has expired the subtitle reads Your password has expired. Choose a new one to continue.

![Change password at sign-in. The rules are ticked as the new password meets them (example values)](sec-signin-change)

1. In Current password, type the password you signed in with.
2. In New password, type the new password and check that every rule is ticked.
3. In Confirm new password, type it again.
4. Select Change password and continue. Back to sign in returns to the sign-in panel without a change.

To change your password at any other time, select your initials at the top right, then Change password (or Change password on My Profile). Fill in the three fields and select Change password. The message Password changed. Your other sessions have been signed out. confirms it: the system signs you out on every other computer and browser; your current session continues.

![Account menu > Change password (example values)](sec-change-password)

### Forgot your password

1. On the sign-in page, select Forgot password? on the line of the Password label.
2. On Reset your password, type your User ID or e-mail address and select Send code. If the account exists and has an e-mail address, the system e-mails a 6-digit verification code to it. The message on screen is the same whether or not the account exists.
3. On Enter the verification code, type the Verification code (from the e-mail), the New password and Confirm new password, then select Reset password. Send a new code sends another code.
4. The sign-in panel returns with the message Password reset. Sign in with your new password. Sign in with the new password.

![Forgot password: request a code](sec-forgot-request)

![Forgot password: code and new password](sec-forgot-reset)

The code is valid for 15 minutes (`security.reset_code_minutes`). After 5 wrong codes it is withdrawn and you ask for a new one. Resetting the password signs you out everywhere. If your user has no e-mail address, ask the System Administrator to reset the password for you.

### Failed sign-ins and locked accounts

A wrong user ID or password shows a message in red above the Sign in button. After 5 failed attempts in a row the account is locked (`limits.max_login_attempts`) and the message reads Account locked. Contact the administrator. The system also allows only 10 sign-in attempts in 5 minutes from one computer and for one user name (`security.login_rate_limit`). To release a locked user, the System Administrator uses Unlock on the user list (Chapter 23).

### Two-step verification

Two-step verification adds a 6-digit code from an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator. Anyone can turn it on for their own user. The System Administrator can make it compulsory for roles with `security.require_2fa_roles`. No role requires it in the delivered configuration; iorta TechNXT recommends it for the System Administrator, Accounting and Accounting Manager roles.

To turn it on:

1. Select your initials at the top right, then Two-step verification (or Two-step verification on My Profile). The dialog says Two-step verification is off.
2. Select Turn on.
3. In the authenticator app, add an account and scan the QR code. If you cannot scan it, type the setup key shown under Can't scan? Enter this key instead:. On the phone itself you can open the key in the authenticator app with the link under the key.
4. Type the 6-digit code the app shows in Authentication code and select Turn on. Cancel returns to the status without turning it on.

![Account menu > Two-step verification: status](sec-2fa-status)

![Turning on two-step verification: QR code, setup key and code (example key)](sec-2fa-enrol)

From then on the sign-in panel shows Two-step verification after the password. Type the code in Authentication code and select Verify. The code changes every 30 seconds and the page waits 5 minutes for it.

![Sign-in: two-step verification code (example code)](sec-signin-2fa)

If your role requires two-step verification and you have not set it up, the sign-in panel shows Set up two-step verification after the password, with the subtitle Your role requires two-step verification. Set it up to continue. Follow the same steps; when the code is accepted you are signed in.

![Sign-in: required set-up of two-step verification (example key)](sec-signin-enrol)

To turn it off, open Two-step verification from the account menu, select Turn off and enter a current code. A role that requires it cannot turn it off. If you lose your phone, the System Administrator turns it off for your user and you set it up again.

### Automatic sign-out

After 30 minutes without activity the system signs you out (`limits.session_idle_minutes`). A warning appears one minute before. Move the mouse or press a key to stay signed in. Anything not saved on the screen is lost at sign-out, so save before you leave your desk. Your session also ends when your password is changed or reset, when your user is deactivated or when your role changes.

To sign out yourself, select your initials at the top right, then Sign out.

## The screen layout

![Screen layout: sidebar menu on the left, notification bell and your initials at the top right, work area](intro-layout)

| Area | What it does |
|---|---|
| Logo and name | The logo and application name from Master > System Settings. The delivered system shows the iorta TechNXT logo and the name BrokerVerse. |
| Search menu... | Type part of a screen name, for example reconcil. The list shows each matching screen with its menu path. Select one to open it. |
| Sidebar menu | The modules your role may use. Select a module to open its items. |
| Notification bell | The number of unread notifications, up to 99; above that the badge shows 99+. Select the bell to see the latest. |
| Your initials | The account menu: your name and role, Profile, Change password, Two-step verification, Help and Sign out. |
| Work area | The screen you opened, with its title and breadcrumb. |

The top bar shows a language box only when more than one screen language is offered.

![Menu search: typing "reconcil" lists every reconciliation screen](intro-menu-search)

### Notifications

The system notifies you when something needs your action: a payment to verify, a quotation to process, a claim settlement to approve, a close run waiting for approval. Approval requests go only to users who may approve them.

![Notification panel opened from the bell](intro-notifications)

Select the bell. The Notifications panel shows the number unread and your six latest notifications with their title, message and time; a blue dot marks an unread one. Select a notification to mark it as read, the X to remove it, Mark all as read to clear the badge, and View all notifications to open the full Notification page.

![The Notification page](intro-notification-page)

### Your profile

Select your initials, then Profile, to open My Profile. The account summary shows your initials, display name, status, User ID, Role, Branch, Designation, Reporting to, E-mail address and Last sign-in; the System Administrator maintains these. The buttons Change password and Two-step verification open the same dialogs as the account menu.

Personal and contact details holds Personal information (First name, Last name, Display name, Employee No., Date of birth, Gender), Contact (E-mail address, Contact number) and Address (House No. / Unit No. / Street, Barangay / Subdivision, City / Municipality, Province, ZIP code, Country). Select Edit Profile, correct the fields (First name and Display name are required; the contact number must be a Philippine number; a Philippine ZIP code has 4 digits) and select Save changes. The message Your profile has been updated. confirms it and the new display name appears in the top bar. Employee No. and the e-mail address are maintained by the System Administrator.

![The account menu under your initials](intro-profile-menu)

![My Profile](intro-my-profile)

### Working with lists

Most screens open with a list, and the lists work the same way everywhere. Type in the search box to filter. Use Show Filters, where offered, for status, dates, insurer or amount. Page through the list with the arrows at the bottom and change Rows per page to see more. Row actions sit at the end of the row: the eye or arrow opens the record, the pencil edits it, and the three dots open more actions. Status tags are green for completed or active, amber for pending and red for rejected or overdue.

## Roles and menus

Your role decides which menus you see and which screens you may open. The server checks the same permissions on every request, so a screen missing from your menu is also refused if someone types its address.

{widths: 22,48,30}
| Role (user in the screenshots) | Menus | Landing page |
|---|---|---|
| System Administrator (bea.admin) | Every menu. | Executive Dashboard |
| Sales & Marketing (maria.sales) | Dashboard: Executive Dashboard, Sales Dashboard. Product Configurator: Dashboard, Product Templates. Operations: all items. Commission: Commission Dashboard. Reports: All Reports, Operational Reports. | Executive Dashboard |
| Processing Team (jose.uw) | Dashboard: Processing Dashboard, Executive Dashboard. Product Configurator: all items. Operations: all items. Reinsurance: all items. Reports: All Reports, Operational Reports. | Executive Dashboard |
| Operations (ana.cs) | Dashboard: Executive Dashboard. Product Configurator: Dashboard, Product Templates. Operations: all items. Reports: All Reports, Operational Reports. | Executive Dashboard |
| Claims (carlo.claims) | Dashboard: Claims Dashboard. Operations: Home, Clients, Policy, Claims. Reinsurance: Claims Recovery. Reports: All Reports, Operational Reports. | Claims Dashboard |
| Accounting (liza.finance) | Dashboard: Executive Dashboard. Operations: Open Items, Payments. Accounts: all items including Period End, Tax and Bank Reconciliation. Master > Finance: Taxation, Close Checklist, Bank Statement Formats, Bank Transaction Types. Commission: all items. Reinsurance: Reconciliation. Reports: All Reports, Financial Reports, Operational Reports > Remittance and Broker Commission. | Executive Dashboard |
| Accounting Manager (rosa.acctmgr) | The same menus as Accounting. | Executive Dashboard |

"Operations: all items" means Home, Leads/Prospects, Clients, Quotation, Broker Slips, Placement Slips, Policy, Claims, Renewals, Open Items and Payments.

The Accounting Manager holds the Accounting role as well, so the menus are the same. The difference is in the approvals: only the Accounting Manager approves a month-end or year-end close and a bank reconciliation, reopens a period and posts into a soft-closed period.

![Landing page of the Claims role (carlo.claims): the Claims Dashboard and the Claims menu](persona-carlo.claims)

![The Accounting menu with Period End, Tax and Bank Reconciliation opened](persona-menu-accounting)

If you type the address of a screen your role may not open, the system shows Not authorised. Choose a screen from your menu instead. Buttons that lead to a screen outside your role are not shown.

![Not authorised: a Claims user opening Accounts > Receipts](intro-not-authorised)

## Philippine formats

| Item | Format and rule |
|---|---|
| Currency | Philippine peso (PHP, ₱) with two decimals, for example ₱ 1,450,000.00. |
| Dates | DD/MM/YYYY, for example 29/09/2026 (`general.date_format`). Business time zone Asia/Manila (`general.timezone`). |
| Mobile numbers | 0917 123 4567, +63 917 123 4567 or 9171234567. The system stores 09171234567. |
| ZIP code | 4 digits, for example 1226 (Makati). |
| TIN | Required for corporate prospects and on the Company master for the letterhead. |
| Government ID (KYC) | PhilSys ID, UMID, Passport, Driver's License, PRC ID, SSS ID, GSIS ID, TIN ID, Postal ID, Voter's ID or Senior Citizen ID (`policy.kyc_id_types`). |
| Taxes on premium | VAT 12%, documentary stamp tax (DST) 12.5%, local government tax (LGT) 0.75% or the rate of the city, fire service tax (FST) 2% for fire and IAR (Master > Finance > Premium Taxes & LGU Rates). |
| Withholding tax | Expanded withholding tax on commission paid to agents and referrers (5% individual, 10% corporate or external), and the 10% the insurer withholds on direct-bill commission, certified on BIR Form 2307. |

# The broking cycle

## Overview

Every piece of business passes through the same steps. Each step is done on its own screen, usually by a different team, and each leaves a numbered document behind.

{widths: 5,17,40,17,21}
| # | Step | What happens | Who | Screen |
|---|---|---|---|---|
| 1 | Lead | The prospect is recorded with contact details and address. Number LD-. | Sales & Marketing, Operations | Operations > Leads/Prospects |
| 2 | Broker Slip | The risk is presented to several insurers. Each insurer's offer or decline is recorded and the offers are compared. Numbers BS- and OFR-. | Processing Team | Operations > Broker Slips |
| 3 | Quotation Slip | The chosen terms are priced for the client: net premium, taxes, gross premium and commission. The client accepts online. Number QT-. | Sales & Marketing, Processing Team | Operations > Quotation |
| 4 | Placement Slip | The firm order goes to the lead insurer and any co-insurers. Each insurer confirms its share with its policy or certificate number. Number PS-. | Processing Team | Operations > Placement Slips |
| 5 | Policy issue | The policy is issued with its participants, the client record is created and the premium is billed. Numbers POL-, CL- and INV-. | Processing Team | Placement Slips > Issue Policy, or Convert Policy for motor |
| 6 | Payment capture | The client's payment is recorded for Accounting to verify. | Operations, Sales & Marketing, Processing Team | Policy > Proceed to Payment |
| 7 | Official receipt | Accounting posts the official receipt OR- against the open bill. | Accounting | Accounts > Receipts |
| 8 | Commission | Referrer commission becomes payable when the premium is collected and is paid by payment voucher PV- less withholding tax. | Accounting (maker and checker) | Commission > Agents/Referrer Accounts |
| 9 | Remittance | Collected premium, net of the broker's commission, is remitted to each insurer by its share. Numbers REM-, SET-, PV-. | Accounting (maker and checker) | Accounts > Remittance |
| 10 | Endorsement | A change to the policy is recorded and additional or return premium is billed. Number END-. | Operations, Processing Team | Operations > Policy |
| 11 | Claim | A loss is registered, followed with the insurer and settled. Number CLM-. | Claims | Operations > Claims |
| 12 | Renewal | Policies enter the renewal pipeline 90 days before expiry and notices go out at 60, 30 and 15 days. | Operations, Sales & Marketing, Processing Team | Operations > Renewals |
| 13 | Month-end | Bank reconciliation, the month-end close, BIR reports. Numbers BRC-, MEC-, CWT-. | Accounting, Accounting Manager | Accounts > Bank Reconciliation, Period End, Tax |

## The placement journey by line of business

Not every line uses every step. A private car is usually quoted and issued straight from a Quotation Slip. A fire or industrial all risks account is normally marketed with a Broker Slip and must be bound with a Placement Slip before the policy is issued. The journey of each line is set in `placement.journey` (Master > Configuration, group Placement). The delivered set-up is:

{widths: 22,19,19,19,21}
| Line of business | Broker Slip | Quotation Slip | Placement Slip | Record Issued Policy |
|---|---|---|---|---|
| Motor | Optional | Required | Optional | Optional |
| Fire, IAR, Marine, Casualty, Engineering | Optional | Optional | Required | Optional |
| Other lines (default) | Optional | Optional | Optional | Optional |

Required means the policy cannot be issued without that step. The screens show the journey that applies to each record as a progress bar (Broker Slip, Quotation Slip, Placement Slip, Policy), and a step that is not used is labelled Not used. The system refuses a step that the journey does not allow, with a message that names the line.

## Maker-checker points

Maker-checker means the person who enters a transaction cannot approve it. The system refuses the approval with a message when the maker tries.

{widths: 30,22,26,22}
| Transaction | Maker | Checker | Setting |
|---|---|---|---|
| Quotation approval | The quotation's creator | Another user; the Processing Team is notified | `workflow.quote_maker_checker` |
| Claim settlement | Claims user who submits it | Another Claims user | `claims.settlement_maker_checker` |
| Journal voucher | Accounting user who submits it | Another Accounting or Accounting Manager user | `journal.require_approval`, `finance.maker_checker_enabled` |
| Payment voucher, cheque, commission payout | Accounting | Another Accounting user | `finance.maker_checker_enabled` |
| Remittance, settlement, adjustment | Accounting | Another Accounting user within their Authority Matrix limit (`remittance`, `remittance_settlement`) | Authority Matrix; `remittance.approval_levels` only while no limit is set |
| Direct-bill debit note | Accounting | Another Accounting user | built in |
| Month-end close, year-end close | Accounting | Accounting Manager | `accounting.period_close_requires_approval` |
| Bank reconciliation | Accounting | Accounting Manager | built in |
| Renewal terms | Operations or Sales & Marketing | Processing Team | `renewals.maker_checker` |
| Reinsurance treaty | Creator | Another user | `reinsurance.treaty_requires_approval` |
| Incentive calculation batch | Accounting | Another Accounting user | built in |

## The money trail of a co-insured policy

This example follows POL-2026-00001, an industrial all risks policy for Davao Agro Processing Corp. It was marketed on Broker Slip BS-2026-90002 and placed on Placement Slip PS-2026-00001 with Malayan Insurance Co., Inc. as lead (60%) and Standard Insurance Co., Inc. as co-insurer (40%). Sum insured ₱ 125,000,000.00, net premium ₱ 262,500.00, commission 15%.

{widths: 34,22,22,22}
| Item (₱) | Malayan (lead, 60%) | Standard (40%) | Total |
|---|---|---|---|
| Sum insured | 75,000,000.00 | 50,000,000.00 | 125,000,000.00 |
| Net premium | 157,500.00 | 105,000.00 | 262,500.00 |
| Taxes (VAT, DST, LGT, FST) | 42,918.75 | 28,612.50 | 71,531.25 |
| Gross premium | 200,418.75 | 133,612.50 | 334,031.25 |
| Commission (15% of net) | 23,625.00 | 15,750.00 | 39,375.00 |

When the policy was issued, the system raised one bill to the client for ₱ 334,031.25 and posted journal JV-2026-00087:

| Account | Debit (₱) | Credit (₱) |
|---|---|---|
| 1202001 Premiums Receivable - Direct Clients | 334,031.25 | |
| 2201001 Premiums Payable to Insurers (Malayan 137,025.00; Standard 91,350.00) | | 228,375.00 |
| 2201002, 2201003, 2201004 Premium VAT, DST and LGT due to insurers | | 66,281.25 |
| 3201001 Brokerage Commission Income (Malayan 23,625.00; Standard 15,750.00) | | 39,375.00 |

Each payable and commission line carries the insurer, so the remittance, the Due to Insurers by Co-insurer report and the Co-insurance Register show each insurer's part. The rounding difference of a share split, if any, goes to the lead insurer.

Later steps follow the same pattern. The official receipt debits Cash in Bank and credits Premiums Receivable. The remittance to each insurer debits its payable and credits Cash in Bank. A claim settled through the broker books the amount recoverable from each insurer by its share.

## Direct bill

In direct bill the client pays the premium to the insurer. The broker does not bill premium; it bills its commission plus 12% VAT to the insurer with a commission debit note (DN-). The insurer pays the commission net of 10% expanded withholding tax and sends BIR Form 2307. The billing mode is chosen at issue and defaults from the insurer's Default Billing Mode, then from `direct_bill.default_billing_mode` (broker billed).

| Event | Journal |
|---|---|
| Policy issued as direct bill | Dr Commission Receivable - Insurers (Direct Bill) / Cr Brokerage Commission Income and Output VAT Payable |
| Debit note raised and approved | No journal; the commission is now on a debit note |
| Insurer pays | Dr Cash in Bank and Creditable Withholding Tax (BIR 2307) / Cr Commission Receivable - Insurers |

No premium bill, collection reminder or remittance is created for a direct-bill policy.

## Key business rules

- The server prices every quotation again from the configured rates and taxes. A premium changed in the browser is refused.
- Co-insurance shares must total exactly 100% with exactly one lead insurer.
- A policy on a line that requires a Placement Slip cannot be issued until every participating insurer has confirmed.
- A motor policy cannot be issued without the government ID (type, number and image), chassis number, motor number and plate or MV file number.
- A claim is refused when the date of loss is outside the policy period or in the future, and while premium is unpaid (`claims.block_unpaid_premium`).
- Commission becomes payable only when the premium is fully collected (`commission.require_full_payment`), and only to referrers with a bank account on file.
- Only Accounting posts official receipts. Other roles record the client's payment for Accounting to verify.
- Postings into a soft-closed period are accepted only from the Accounting Manager. Closed and locked periods accept none.

# Dashboards

## Purpose

Dashboards show live figures from the policies, bills, claims and commission lines in the system. They change as soon as a transaction is saved.

| Dashboard | Menu | Roles |
|---|---|---|
| Executive Dashboard | Dashboard > Executive Dashboard | Every role except Claims |
| Sales Dashboard | Dashboard > Sales Dashboard (also Operations > Home) | Sales & Marketing, System Administrator |
| Processing Dashboard | Dashboard > Processing Dashboard | Processing Team, System Administrator |
| Claims Dashboard | Dashboard > Claims Dashboard | Claims, System Administrator |
| Commission Dashboard | Commission > Commission Dashboard | Accounting, Sales & Marketing (Chapter 15) |

## Executive Dashboard

![Executive Dashboard: key figures against target](dash-exec)

The top of the dashboard shows the key figures against the targets set in Master > Configuration (`dashboard.targets`).

| Card | What it shows |
|---|---|
| Total Revenue | Gross written premium in the period, with the change against the previous period. |
| Active Policies | Policies in force. |
| New Business | Premium of new, not renewed, policies in the period. |
| Claims Rate | Claims incurred as a percentage of premium. |
| Retention Rate | Renewals retained as a percentage of renewals due. |
| Customer Satisfaction | Shown as "-" until satisfaction scores are recorded. |
| Premium Receivable (Clients) | Premium billed to clients and not yet collected, with the overdue part. |
| Commission Receivable (Insurers, Direct Bill) | Commission billed or to be billed to insurers on direct-bill policies, with the unbilled and overdue parts. |

1. Choose Dashboard > Executive Dashboard.
2. In the period list, choose This Month, This Quarter or This Year. The periods are calendar periods in Philippine time and are compared with the whole previous period.
3. To download the Production Register for a date range, choose the dates and select Export Report. The file downloads as Excel.
4. Scroll down for the charts: Performance Trends, Revenue by Product Line, Regional Performance, Top Performing Products, Top Agents Performance, Claims Status Distribution and Quick Actions.

![Executive Dashboard: trends, product lines, regions and products](dash-exec-2)

The Settings button on the dashboard header opens Master > System Settings and is shown only to the System Administrator.

## Sales Dashboard

![Sales Dashboard of maria.sales](dash-sales)

The Sales Dashboard is the home screen of an account executive. It counts the leads, clients and policies of the signed-in user and shows Create Quote, the commission chart for the year you choose, upcoming follow-ups from the activity monitor, earned commission and the premium billed on your policies (collected, still due and total). Direct-bill policies are left out of the premium figures because their premium is paid to the insurer.

## Processing Dashboard

![Processing Dashboard (Processing Workbench)](dash-processing)

The Processing Workbench lists quotations in progress as submissions.

| Section | What it shows |
|---|---|
| Newly received and older submissions | Quotations waiting for action this week and older ones. |
| Avg. cycle time | Average hours from submission to decision. |
| Open alerts | Data-quality alerts: duplicate submissions, missing sums insured or dates, missing line of business. |
| Workload metrics | Work by assignment group. |
| Submissions list | Case ID (quotation number), proposed insured, account executive, sum insured, product, next requirement due, priority and status. High priority starts at ₱ 5,000,000 sum insured (`dashboard.high_sum_insured`). |
| Open tasks | Quotations assigned for follow-up, with due dates. |

Select New Submission to start a quotation.

## Claims Dashboard

![Claims Dashboard](dash-claims)

1. Choose Dashboard > Claims Dashboard.
2. Read the cards: Total Open Claims, Claims Overdue (past the handling time of 20 days, `claims.sla_days`), Today's Claims, Highest Claims (line with the most claims) and Max Claims by Province.
3. Open a claim from Recent Claims.
4. Choose a date range and select Export Report to download the claims data.

# Leads and prospects

## Purpose

A lead is a prospect who may buy insurance. The quotation, the client record and the policy all start from it. Each lead gets a number LD-YYYY-NNNNN. Sales & Marketing and Operations create and follow leads; the Processing Team can view them.

## The lead list

![Operations > Leads/Prospects](lead-list)

Choose Operations > Leads/Prospects. The screen shows cards for Total Leads, Last 7 Days, Last 30 Days, Converted Leads, With Quotations and Active Leads; tabs by line of business; and one card per lead with its number, category, date, number of quotations and contact details, with the actions View, Edit and Delete.

## Create a lead

1. Choose Operations > Leads/Prospects and select Create Lead.
2. Choose the line of business: Motor, Fire and Allied Perils, Industrial All Risks or Employee Benefit.
3. Under Select Category, choose Retail (a person) or Corporate (a company).
4. Fill in the fields below and select Save & Continue.

![Create Lead: choose the line of business](lead-create-line)

![Create Lead form for a motor prospect (example values)](lead-create-form)

{widths: 24,46,10,20}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| Category | Retail or Corporate | Yes | Corporate adds Company Name and TIN, both required. |
| First Name, Last Name | Prospect or contact person | Yes | |
| Preferred Name | Name used in letters and e-mails | Yes | |
| Date of Birth | Date of birth | Yes | Not in the future; age 18 to 100 (`leads.min_age_years`, `leads.max_age_years`). |
| Gender | Male or Female | Yes | |
| Email ID | Quotations and approval links are sent here | Yes | A valid e-mail address. |
| Contact Number | Mobile number | Yes | Philippine mobile number. |
| Country, Province, City | Address from the location masters | Yes | Choose the country first, then the province, then the city. |
| ZIP Code | Postal code | Yes | 4 digits. |
| Barangay / Subd, House No / Unit No / Street | Street address | Yes | |

The system gives the lead its number and sets its status to New. Fire and IAR leads also ask for the risk location and the sums insured.

> **Tip:** A field with a problem shows the message under it in red, for example Invalid mobile number (e.g. 0917 123 4567 or +63 917 123 4567). Correct it and select Save & Continue again.

## View, edit or delete a lead

![Lead Details with Create Quote, Edit and Delete](lead-detail)

On the lead card, select View. Lead Details shows personal, contact, address and system information and the number of quotations. Select Edit to correct the lead, Create Quote to start a quotation (Chapter 8), or Delete to remove a lead entered by mistake. Keep leads that have quotations.

| Status | Set when |
|---|---|
| New | The lead is created. |
| Contacted, Qualified | The lead is followed up. |
| QuoteGenerated | A quotation is saved for the lead. |
| Converted | A policy is issued from one of its quotations; the lead becomes a client. |
| Lost | The prospect does not buy. |

## Upload many leads

![Bulk Upload of leads with the template download](lead-upload)

1. Select Bulk Upload.
2. Select Download Template. Fill in one lead per row. The template is also delivered as `Leads_Upload_Template.xlsx`.
3. Choose the completed file (.xlsx or .csv, at most 10 MB and 1,000 rows) and upload it.

The system checks every row and reports the rows it could not load, with the reason. Correct those rows and upload them again. Generate Report downloads the lead list by category as a spreadsheet.

# Clients

## Purpose

A client is a person or company that holds or has held a policy. The system creates the client, with a client code CL-YYYY-NNNNN, when the first policy is issued. The client record shows policies, claims, renewals and endorsements in one place.

## Find a client

![Operations > Clients](client-list)

1. Choose Operations > Clients.
2. Use the tabs All, Individual or Corporate, or type a name in the search box.
3. The list shows the name and client code, client type, Client Since or date of birth, number of policies and latest policy status.
4. Select the arrow at the end of the row to open the client.

## The client view

![Client view with the Policy, Claim, Renewal and Endorsement tabs](client-view)

| Tab | What you see and do |
|---|---|
| Policy | The client's policies with premium, dates, product and payment status. Open a policy, or use the row actions for a claim or an endorsement. |
| Claim | The client's claims with status. |
| Renewal | Renewals due and quoted. |
| Endorsement | The client's endorsements with type, status and payment status. |

To correct the name, address or contact details on an issued policy, raise a Personal Details Change endorsement (Chapter 10), so the change is recorded against the policy and sent to the insurer.

# Placement: Broker Slips and Placement Slips

## Purpose

Placement is the broker's core work: presenting a client's risk to the market, getting terms, choosing the security and binding the cover. BrokerVerse records each step with its own document.

| Document | Number | What it is |
|---|---|---|
| Broker Slip | BS-YYYY-NNNNN | The risk presented to several insurers with a request for quotation. |
| Insurer offer | OFR-YYYY-NNNNN | One insurer's answer to a Broker Slip: its terms, or its decline. |
| Quotation Slip | QT-YYYY-NNNNN | The terms offered to the client, priced with taxes and commission (Chapter 8). |
| Placement Slip | PS-YYYY-NNNNN | The firm order to the lead insurer and co-insurers, confirmed by each of them. |
| Policy | POL-YYYY-NNNNN | Issued from a bound Placement Slip, from a Quotation Slip, or recorded after the insurer has issued it. |

The Processing Team does this work. Sales & Marketing and Operations can open the same screens, for example to follow an account they introduced. The screens use the quotation permissions; issuing the policy also needs the policy permission.

## Broker Slips

![Operations > Broker Slips](bs-list)

Choose Operations > Broker Slips. The cards count the slips by status (Submitted, Responses in, Draft, Closed). Each row shows the slip number, insured, product, sum insured, offers received against insurers approached (with the number of declines), best gross offer, response due date, age and status, and the Quotation Slip made from it.

| Status | Meaning |
|---|---|
| Draft | Saved, not yet sent to the market. |
| Submitted | Sent to the insurers; waiting for their answers. |
| Responses in | At least one insurer has answered. |
| Closed | Not taken up, closed with a reason, or turned into a Quotation Slip or Placement Slip. |
| Cancelled | Withdrawn with a reason. |

### Create a Broker Slip

1. Choose Operations > Broker Slips and select New Broker Slip.
2. Under Customer and risk, choose Client for an existing client or Lead for a prospect, then pick the record. Choose the Product. The Insured name fills in; change it if the slip is for another named insured.
3. Enter the Inception and Expiry dates. Leave Response due empty to use the default of the settings, or set the date by which insurers must answer.
4. Under Risk details, describe the risk: location, occupancy, construction, protection or, for marine, the cargo and voyage. Add each detail as an item and a value.
5. Under Requested covers, select Add cover for each cover with its sum insured and deductible, for example Fire and lightning, ₱ 180,000,000.00.
6. Under Market, choose the Insurers to approach.
7. Add Remarks for the insurers, for example the claims history or the renewal terms of the incumbent.
8. Select Save draft to keep working, or Save and submit to market.

![New Broker Slip: customer, risk, covers and market](bs-new)

When you submit, the system numbers the slip, creates one offer record per insurer with status Pending and queues an e-mail request for quotation to each insurer's placement e-mail (Insurance Company master). The Slip PDF button prints the slip for the whole market; the PDF icon on an insurer's row prints the slip addressed to that insurer.

### Record the insurers' answers

![Broker Slip BS-2026-90001, tab Market responses](bs-responses)

1. Open the slip and go to the tab Market responses.
2. On the insurer's row, select Record response (or Edit to change an answer already recorded).
3. Choose Offered, Declined or Pending.
4. For an offer, enter the Net premium (100%), the Rate if the insurer quoted one (otherwise the system derives it), the Line offered (the share the insurer is willing to write, for example 60%), Taxes and Gross premium if the insurer stated them (otherwise they are computed), Valid until, Deductibles, Special terms and conditions and the Insurer reference.
5. For a decline, enter the Reason for declining.
6. Attach the insurer's offer letter with Attach the offer, then select Save.

![Recording an insurer's response](bs-offer)

The slip becomes Responses in with the first answer. Select Add insurer to approach another insurer on an open slip; that insurer receives its own request.

### Compare the offers and choose the security

![Compare offers: two offers selected, the best offer as lead](bs-compare)

The tab Compare offers ranks the offers by gross premium and marks the cheapest as Best. For each offer it shows the difference to the best offer, the rate, deductibles, special terms and the line offered. The summary line shows the number of offers, declines and pending insurers and the market capacity (the total of the lines offered).

1. Tick Select on each offer you want to place. One offer at 100% is a single-insurer placement. Several offers make a co-insurance.
2. Choose the Lead insurer with the radio button. The premium of a co-insurance follows the lead's terms.
3. Enter the Share taken of each selected offer. Selected shares total must be exactly 100%.
4. Select Prepare Quotation Slip when the client must see and accept the terms first (Chapter 8), or Prepare Placement Slip to send the firm order straight away.

Which buttons are offered follows the placement journey of the line (Chapter 3). A line where the Quotation Slip is Not used shows only Prepare Placement Slip.

The tab Risk and covers repeats the risk details and covers of the slip.

![Broker Slip: Risk and covers](bs-risk)

To stop a slip, select Cancel / close. Choose Cancel slip (withdrawn) or Close (not taken up) and give the reason.

When the chosen offers become a Quotation Slip or a Placement Slip, the Broker Slip is closed and its progress bar links to the next documents.

![Broker Slip BS-2026-90002 closed after its Placement Slip and policy were issued](bs-closed)

## Placement Slips

![Operations > Placement Slips](ps-list)

Choose Operations > Placement Slips. Each row shows the placement number, insured, product, lead insurer and number of co-insurers, gross premium, period, how many insurers have confirmed, the source (From quotation slip, From broker slip, Direct placement or Recorded policy), status and the policy issued.

| Status | Meaning |
|---|---|
| Draft | Prepared, not yet sent. Participants can still be changed. |
| Sent to insurer | The firm order was e-mailed to each participant. |
| Bound | Every participant has confirmed. The policy can be issued. |
| Declined | A participant declined its line. Edit the participants or cancel the slip. |
| Policy issued | The policy has been issued from the slip. |
| Cancelled | Withdrawn with a reason. |

### Where a Placement Slip comes from

- From a Broker Slip: Prepare Placement Slip on the Compare offers tab.
- From a Quotation Slip: on an accepted quotation, the Placement journey panel offers Create Placement Slip. On lines where the Placement Slip is required, the quotation cannot go straight to a policy.
- Direct placement: the client instructs placement with named insurers and no quotation is needed. Select New direct placement.

![New direct placement: customer, period and premium, and the security](ps-direct)

For a direct placement, fill in Customer and risk and Period and premium (Inception, Expiry, Sum insured, Net premium, Commission rate or the insurer default, Billing mode). Under Security (participating insurers), add each insurer with its Share and tick Lead for one of them. The line under the table tells you whether the shares total 100% and whether the placement is a co-insurance or a single insurer. Select Create Placement Slip.

### Send the firm order and record confirmations

![Placement Slip PS-2026-90001 sent to two insurers; the lead has confirmed](ps-sent)

1. Open the Placement Slip. The Security table lists each participant with its role (Lead or Co-insurer), share, sum insured, premium, taxes, gross, commission, policy or certificate number and status.
2. Select Send to insurer(s). The system e-mails each participant a placing slip that shows its own share, and the status becomes Sent to insurer. Resend to insurers sends it again.
3. When an insurer confirms, select Confirm on its row, type the Insurer policy / certificate number and save. The row becomes Confirmed.
4. When an insurer declines its line, select Declined on its row and record the reason. Then use Edit participants to replace the insurer or change the shares, so that they total 100% again.

![Recording an insurer's binding confirmation](ps-confirm)

When every participant has confirmed, the slip becomes Bound and the progress bar ticks Bound / confirmed.

The Slip PDF button prints the placing slip. The PDF icon on a participant's row prints the placement slip for that insurer's share only.

### Issue the policy

![Placement Slip PS-2026-00001 bound and issued as POL-2026-00001](ps-issued)

On a bound Placement Slip, select Issue Policy. The system:

- issues the policy number and copies the participants, shares and insurer references to the policy;
- creates the client from the lead if the insured is not yet a client;
- raises the premium bill to the client (broker billed) or books the commission due from the insurers (direct bill);
- posts the journal with each insurer's payable and commission on its own line;
- sets the slip to Policy issued and links the policy.

A user without policy issuing rights sees the message All insurers confirmed. A user with policy issuance rights can now issue the policy.

## Record Issued Policy

Use Record Issued Policy when the insurer has already issued the policy, for example a renewal the insurer processed on its own or a policy placed before the account came to BrokerVerse. The policy, the bill and the commission are created in one step.

![Record Issued Policy](ps-record-policy)

1. Choose Operations > Placement Slips and select Record Issued Policy.
2. Fill in Customer and risk.
3. Under Policy, period and premium, enter the Insurer policy number (leave it blank to let the system number the policy), the Issued date, Inception, Expiry, Sum insured, Net premium, Commission rate and Billing mode.
4. Under Security, add each participant with its share and its own policy or certificate number. The lead insurer's reference defaults to the policy number.
5. Select Record policy.

Lines where the journey does not allow a direct policy entry refuse it with the message Direct policy entry is not allowed for the line; place those risks through the Placement Slip.

## Tips

- Keep the placement e-mail of each insurer current on the Insurance Company master. Requests for quotation and firm orders go there.
- Record declines as well as offers. The Market Response report uses them to show each insurer's hit rate.
- The Placement Pipeline report lists every open Broker Slip and Placement Slip with its age.
- Shares are percentages of 100% of the risk. An insurer's line offered can be larger than the share you give it.

# Quotation

## Purpose

A quotation (the Quotation Slip) prices the cover for the client. It shows the net premium, the taxes, CTPL for motor, the gross premium, the broker's commission and the referrer's share. The client accepts it online, and the accepted quotation becomes the policy, directly for motor or through a Placement Slip for lines that require one. Each quotation gets a number QT-YYYY-NNNNN and stays valid for 30 days (`limits.quote_validity_days`).

Sales & Marketing and Operations prepare quotations. The Processing Team is notified of quotations sent to clients (`quotations.approval_notify_roles`) and prepares Quotation Slips from Broker Slips.

## The quotation list

![Operations > Quotation](quote-list)

Choose Operations > Quotation. The cards count quotations by status and show the average premium. The table lists each quotation with its lead, policy type, gross premium, date and status. Use the pencil to edit a draft and the eye to open a quotation.

| Status | Meaning | Next step |
|---|---|---|
| Draft | Saved, not sent. You can still edit it. | Send for Customer Approval |
| Pending Customer | The approval link was e-mailed to the client. | The client accepts, or you return it to Draft |
| Customer Accepted | The client accepted through the link. | Proceed to Policy, or Create Placement Slip |
| Submitted to Insurer | Sent to the insurer for its terms. | Approved or Rejected |
| Approved | Approved by a user other than the creator. | Proceed to Policy |
| Rejected, Dropped | Not taken up. Can be reopened as Draft. | |
| Expired | Not converted within its validity (the Quotation expiry job runs daily at 00:30). | Reopen as Draft |
| Converted to Policy | The policy has been issued. The quotation can no longer be edited. | |

## Create a motor quotation

A motor quotation has five steps. Nothing is saved until you select Completed Quote on the last step, so you can move with Back and Next.

1. Open the lead (Operations > Leads/Prospects > View) and select Create Quote.
2. Fill in Policy Details and Insurance Vehicle Details, then select Next.
3. Review the Plan Recommendations, then select Next.
4. Fill in Coverage Details, select Calculate, check the premium, then select Next.
5. Fill in Accessories and the policy limits, then select Next.
6. Check the Order Summary, set the discount, the referrer and the signatory, then select Completed Quote.

The system saves the quotation as Draft, gives it its number, sets the lead to QuoteGenerated and opens the quotation.

### Step 1: Policy details and vehicle

![Create Quote, step 1: policy and vehicle details (example values)](quote-1-policy-details)

{widths: 24,46,10,20}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| Co-Insurance | Tick when more than one insurer shares the risk. A table appears for the co-insurers and their shares. | No | Shares total 100% with one lead. |
| Insurance Company Name | The insurer that will issue the policy. | Yes | |
| Insurance Policy Type | Comprehensive, Own Damage / Theft or Third Party Liability. | Yes | |
| Account Code | The agent or referrer credited with the business. | No | Active referrers only. |
| Payment Type | Cash or Credit. | Yes | |
| Vehicle Type | Insurance Commission vehicle class. Decides the CTPL tariff, default seats and own damage rate. | Yes | From the motor tariff in the Product Configurator. |
| Vehicle Brand, Vehicle Model, Model Variant | From the vehicle master. Each list follows the one before. | Yes | |
| Model Year, Vehicle Color | Year of manufacture and colour. | Yes | The last 20 years up to next year. |
| Seating Capacity | Seats including the driver. | Yes | 1 to 99. Used for Auto Passenger PA. |

### Step 2: Plan recommendations

![Create Quote, step 2: plan recommendations](quote-2-recommendation)

The system shows three tiers for the chosen insurer, CTPL, Basic and Comprehensive, and marks one as RECOMMENDED from the vehicle class and policy type. Keep the recommendation or choose another plan. The deductible and monthly amounts on the cards are indicative; the premium is calculated on the next step.

### Step 3: Coverage details

![Create Quote, step 3: coverage details after Calculate](quote-3-coverage)

{widths: 28,48,24}
| Field | Meaning | Rules |
|---|---|---|
| Own Damage coverage, Rate, premium | Sum insured of the vehicle (market value), the rate proposed from the motor tariff, and the premium. | Private cars 2%. |
| Include CTPL | Compulsory Third Party Liability at the tariff of the vehicle class. | Read-only amount, inclusive of taxes and fees. |
| Brand-new vehicle: 3-year CTPL | For a brand-new vehicle registered for 3 years with LTO. | Only for classes with a 3-year tariff. |
| Acts of Nature, Roadside Assistance, Personal Accident | Optional covers with their own rate and premium. | |
| Bodily Injury, Property Damage | Excess third-party liability limits. | ₱ 100,000 to ₱ 500,000. |
| Auto Passenger PA | Limit per person × seats covered × 0.1%. | Example: 50,000 × 5 seats gives 250,000 cover and 250.00 premium. |
| Total Gross Premium | Net premium + VAT + DST + LGT + CTPL. | Calculated. |

Select Calculate after every change. Override lets you type a cover premium the insurer quoted. CTPL and Auto Passenger PA are always priced by the system from the tariff in Product Configurator > Product Templates > MOT-003-2025 (Chapter 22).

### Step 4: Accessories and policy limits

![Create Quote, step 4: accessories and policy limits](quote-4-accessories)

Enter the declared value of accessories to be covered (Aircon, Stereo, Mag wheels, Others) and the policy limits (Deductible, Towing, Repair Limit). Leave a field empty if it does not apply.

### Step 5: Order summary, discount and commission

![Create Quote, step 5: order summary with commission and referral](quote-5-order-summary)

| Line | How it is calculated |
|---|---|
| NET Premium | Sum of the cover premiums, without CTPL. |
| Value Added Tax | 12% of the net premium (`tax.vat_rate`). |
| Documentary Stamp Tax | 12.5% of the net premium (`tax.dst_rate`). |
| Local Gov't Tax | 0.75% of the net premium (`tax.lgt_rate`). |
| CTPL | Tariff amount; not taxed again and never discounted. |
| Discount | The discount you give the client. |
| Total Premium (Gross Premium) | Net + taxes + other premium + CTPL − discount. |

1. Optional: set Discount (Optional) between 0% and 30%. The discount comes out of the broker's commission, not the referrer's share.
2. Under COMMISSION & REFERRAL, choose the referrer or keep Direct (broker's own lead) and the referrer level. The comsub rate fills in from the commission rule (L1 8%, L2 5%) and can be changed. Add referrer (chain) adds a second referrer.
3. Check BROKERAGE (the broker's commission from the insurer), COMSUB (GROSS), DISCOUNT and MARGIN.
4. Choose the Authorized Signature and select Completed Quote.

The brokerage rate comes from the Commission Rate Matrix (Chapter 23): the most specific active rate for the insurer, product, line and policy type on the quotation date, then the insurer's default rate, then `commission.default_rate` (15%).

> **Important:** The server calculates the premium again from the covers, rates and configured taxes when the quotation is saved. The amounts on the saved quotation are the ones that count.

## Send the quotation to the client

![Quotation detail of a draft with Share and Send for Customer Approval](quote-detail-draft)

1. Open the quotation from Operations > Quotation with the eye icon.
2. Check the policy, assured, vehicle, coverage and payment details.
3. Select Send for Customer Approval.

The system e-mails the client a signed approval link, valid for 7 days (`quotations.approval_link_ttl_hours`), sets the status to Pending Customer and notifies the Processing Team. The lead must have an e-mail address.

Share offers other ways to send it: Download, Email, WhatsApp, Send to Insurer (e-mails the quotation to the insurers you choose) and Copy Link.

![Share Quote](quote-share)

The client opens the link, reviews the quotation, customer, vehicle, coverage and premium, and selects Approve Quote. No sign-in is needed. The status becomes Customer Accepted and you are notified.

![The approval page the client sees](quote-approval-page)

## From the accepted quotation to the policy

![An accepted fire Quotation Slip with the Placement journey panel](quote-detail-accepted)

The Placement journey panel on the quotation shows the steps of its line. For motor, select Proceed to Policy and follow Chapter 9. For a line that requires a Placement Slip, select Create Placement Slip; the slip opens with the insurer and premium of the quotation and you continue as in Chapter 7. When the Placement Slip is optional, Send to insurance company asks which way to go: Place with the insurer(s): create a Placement Slip, or Issue the policy directly.

The Audit Trail tab of a quotation lists every change with the date, field, old and new value and user.

![Quotation audit trail](quote-audit)

## Tips and common errors

- The lead has no e-mail address; add one before sending the quotation: edit the lead, add the e-mail, then send again.
- Only Draft quotations can be sent for approval: the quotation was already sent. Wait for the client or reopen it as Draft.
- A quotation converted to a policy cannot be edited: raise an endorsement on the policy instead.
- CTPL shows "-": choose the Vehicle Type on step 1.
- The saved premium differs from what you typed: the server priced it with the configured rates. Check the rates with the Processing Team.

# Policy issuance and servicing

## Purpose

A policy is issued from a bound Placement Slip (Chapter 7), recorded with Record Issued Policy, or converted from an accepted motor quotation as described below. At issue the system gives the policy number POL-YYYY-NNNNN, creates the client (CL-), copies the participating insurers, bills the premium and accrues the referrer's commission.

## Convert a motor quotation into a policy

1. Open the accepted or approved quotation and select Proceed to Policy.
2. Complete Customer Information and select Next.
3. Upload the five vehicle photos and select Next.
4. Review the details, choose the Billing mode and select Send to Insurance Company. The policy is issued.
5. On Upload Policy, check the dates, upload the insurer's policy document and choose Pay Later or Proceed to payment.

### Customer information (KYC)

![Convert Policy: customer information and vehicle identifiers](policy-1-customer-info)

{widths: 26,44,10,20}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| ID Type, ID Card Number, ID Card | Government ID presented by the client, its number and a scan. | Yes | Accepted IDs: `policy.kyc_id_types`. |
| Motor Number, Chassis Number | From the OR/CR. | Yes | |
| Plate Number or MV File Number | Plate number, or the LTO MV file number if there is no plate yet. | Yes | |
| Mortgage | Mortgagee bank, if the vehicle is financed. | No | |
| Cert Number, Authen Code | CTPL certificate number and authentication code. | No | |
| Truck Type, Aluminium, Air Bag, TNVS | Additional vehicle information. | No | TNVS: used for ride-hailing. |

The server refuses to issue a motor policy without the fields in `policy.kyc_required_fields`.

### Vehicle photos

![Convert Policy: vehicle photos](policy-2-vehicle-photos)

Upload a photo of the left side, right side, front, rear and interior. Each file uploads as soon as you choose it. Select Remove to replace a wrong photo.

### Review, participants and billing mode

![Coverage Details Review with the participants and the billing mode](policy-3-review-billing)

The review repeats the policy, assured, vehicle, photos, coverage and premium, and lists the participating insurers with their shares. Next to Send to Insurance Company, choose the Billing mode:

| Billing mode | Meaning | What the system does |
|---|---|---|
| Broker billed | The client pays the broker, who remits to the insurer net of commission. | Premium bill INV- with its journal and a collection item. |
| Direct bill | The client pays the insurer. The broker bills its commission to the insurer. | No premium bill. Commission receivable from the insurer, shown in Direct Bill Processing. |

The default is the insurer's Default Billing Mode, else `direct_bill.default_billing_mode`. Select Send to Insurance Company to issue the policy.

### Upload the insurer's policy

![Upload Policy](policy-4-upload-policy)

Check Policy Number, Insurance Company, Production, Inception, Issued Date and Expiry. Under Upload Policy Document, choose the insurer's policy (PDF, PNG, JPG or JPEG, at most 10 MB). Select Pay Later if the client has not paid, or Proceed to payment.

## Co-insurance on the policy

![Policy POL-2026-00001: the co-insurance participants](policy-coins)

A co-insured policy shows its participants: each insurer with role, share, sum insured, premium, taxes, gross premium, commission and the insurer's policy or certificate number. The shares always total 100% with one lead. Amounts are split by share and the rounding remainder goes to the lead. The same split is used for the bill journal, the remittance to each insurer, claim recoveries and the reports.

## Record the client's payment

Only Accounting posts official receipts. Everyone else records how the client paid, and Accounting verifies it.

![Payment Confirmation: recording a bank transfer (example values)](policy-5-payment-capture)

1. Open the policy and select Proceed to Payment.
2. Under How does the client pay?, choose Pay later, Bank transfer, Cheque, Online payment or Cash.
3. Fill in the reference, Amount paid, Payment date, Remarks and, if you have it, the proof of payment.
4. Select Record payment (or Confirm pay later).

The payment waits for verification, the policy payment status becomes Reviewing and Accounting receives the notification Premium payment to verify. Accounting checks the bank statement and selects Confirm, which posts the official receipt, or Reject with a reason. Accounting users see Record payment and issue receipt and can post the receipt directly.

## The policy list

![Operations > Policy](policy-list)

Choose Operations > Policy. The list shows policy number, client, gross premium, issue and expiry dates, product and payment status. The three dots on a row open Claim, Endorsement and Reminder. They are disabled while the payment is Pending or Reviewing, and Endorsement is not offered for expired, lapsed, cancelled or renewed policies.

![Row actions of a policy](policy-row-menu)

## Policy details

![Policy Details](policy-detail)

| Section | Content |
|---|---|
| Header | Policy number, client, expiry and payment status, with Claim and View Policy. |
| Policy Details, Insured Details | Number, product, dates; client, ID and contact details. |
| Vehicle Details and Photos | Motor only. |
| Coverage Details, Premium Breakdown | Each cover with sum insured and premium; net premium, taxes, discount, gross premium. |
| Participants | The insurers and their shares (co-insurance). |
| Endorsements, Payment | Latest endorsements; Proceed to Payment while premium is due. |
| Documents & Billing | Generate Policy Invoice, Premium Accounting Entries and the policy document. |

![Policy Details: coverage and premium](policy-detail-2)

Premium Accounting Entries lists every journal line of the policy: new business, receipts, commission, remittance and endorsements, with the insurer on each line.

![Premium accounting entries of POL-2026-00001](policy-accounting)

| Policy status | Meaning |
|---|---|
| Active | In force. |
| Expired | Past its expiry date (Policy expiry job, daily 00:15). |
| Renewed | Replaced by a new term. |
| Lapsed | Not renewed within the 30-day grace period. |
| Cancelled | Cancelled by endorsement. |

| Payment status | Meaning |
|---|---|
| Pending | Premium due, nothing received. |
| Reviewing | A payment was recorded and waits for Accounting. |
| Partial | Part of the premium was receipted. |
| Completed | Fully paid. |
| Refunded | Premium returned to the client. |

## Upload policies

![Bulk Upload of policies](policy-upload)

Operations > Policy > Bulk Upload loads policies from `Policies_Upload_Template.xlsx`. Two modes are offered:

- New business: each row issues a policy with its bill and commission, as if issued on the screen.
- Existing policies (go-live): tick this box when you load the in-force book from the old system. Each row creates the client and the policy with its insurer at 100%, but no bill, journal or commission. Load the unpaid premiums afterwards with Import open items (Chapter 14). Enter co-insured policies on the screen.

# Endorsements

## Purpose

An endorsement changes an issued policy: the client's details, the vehicle, the cover, the period, or cancels the policy. The system records it with a number END-YYYY-NNNNN, sends it to the insurer and bills additional premium or credits return premium. A change of cover is priced again with the configured rates. Operations raises endorsement requests; the Processing Team completes them with the insurer's endorsement.

| Line | Type | What you can change |
|---|---|---|
| Motor | Personal Details Change | Name, preferred name, contact number and address. |
| Motor | Motor Details Change | Vehicle details and identifiers. |
| Motor | Coverage Change | Own damage sum insured and rate, acts of nature, bodily injury, property damage, Auto Passenger PA. The premium is recalculated. |
| Motor | Policy Extend, Policy Cancel | The period; cancellation. |
| Fire and Allied Perils | Regular / Premium Change | Risk, cover or premium. |
| Fire and Allied Perils | Policy Cancellation | Full, partial, pro-rata or pro-rata partial. |

## Raise an endorsement

1. Choose Operations > Policy, or open the client and use the Policy tab.
2. On the policy row, select the three dots, then Endorsement.
3. Tick one or more endorsement types and select Proceed.
4. Enter the changes on the Endorsement Request page.
5. Select Save & Next, check the summary and select Send to Insurance Company.

![Choosing the endorsement type](end-dialog)

![Endorsement request: personal details change](end-personal)

For a personal details change the form opens with the client's current details. The contact number must be a valid Philippine mobile number and the ZIP code must have 4 digits. The client record is updated when the endorsement is completed.

![Endorsement request: coverage change priced again](end-coverage)

For a coverage change, change the cover and the premium boxes recalculate: net premium, VAT, DST, LGT, gross premium and Premium change. CTPL stays as issued.

## After sending to the insurer

1. The endorsement waits for the insurer (Waiting for Update).
2. When the insurer has issued its endorsement, select Proceed, upload the insurer's document with the endorsement number and dates, and select Complete.
3. The system applies the change to the policy and the client and notifies the policy owner.
4. Additional premium is billed to the client (or, for a co-insured policy, split by share on the journal). The endorsement view shows Additional premium is due: proceed to payment. Return premium is credited to the client; if the premium was already remitted, the refund due from each insurer is booked and netted on its next remittance.

![A completed endorsement](end-view)

![Client view: Endorsement tab](end-client-tab)

| Status | Meaning |
|---|---|
| Draft | Saved, not sent. |
| Pending Customer | Sent; waiting for the insurer's endorsement. |
| Completed | Applied to the policy. |
| Initiate Cancel, Cancelled | A cancellation in progress or done. |
| Rejected | Refused by the insurer. |

# Claims

## Purpose

The claims module records a loss under a policy, follows it with the insurer and the adjuster, and settles it. A second Claims user approves each settlement. Each claim gets a number CLM-YYYY-NNNNN. Reinsurance recoveries are in Chapter 20.

## The claims list

![Operations > Claims](claim-list)

Choose Operations > Claims. Each row shows the claim number, client, policy, issue date, product and status. The icons at the end of the row open Claim Details, the next step for the claim's status, and the Claim Audit Trail.

| Status | Meaning | Next step |
|---|---|---|
| Pending | Registered; the Preliminary Loss Advice went to the insurer. | Proceed when the insurer assigns an adjuster |
| Processing | Adjuster details and documents are being gathered. | Submit the settlement |
| Pending Approval | Settlement submitted; waiting for a second Claims user. | Approve or reject |
| Approved | Settlement approved. | Settled automatically (`claims.auto_settle_on_approval`) |
| Settled | Settlement released. | Close |
| Rejected | Refused by the insurer. | |
| Closed | File closed. | |

## Register a claim

1. Choose Operations > Policy, select the three dots on the policy row, then Claim. You can also select Claim on the policy details page.
2. Check the insurer, policy and policy holder, which fill in from the policy.
3. Fill in the Incident Details and the driver.
4. Fill in Third Party Details (If Applicable).
5. Select Next, attach the documents and select Send.

![Claim Request](claim-request)

{widths: 26,46,10,18}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| Date of Incident, Time of Incident | Date and time of loss. | Date yes | Not in the future; inside the policy period. |
| Address of Incident, City, Province | Where the loss happened. | Address yes | |
| Type of Incident / Cause of Loss | Collision, theft, fire, flood and so on. | Yes | |
| Estimated Claim Amount | First estimate of the loss. | No | Pesos. |
| Insurance Company Claim Number | The insurer's claim reference, when known. | No | |
| Driver's name and address | Person driving at the time of loss. Same as Policy Holder copies the holder. | Name yes | |
| Third Party Details | Name, contact number, plate number, shop and insurer of the other party. | No | |
| Documents | Police report, photos, estimates. | No | PNG, JPEG or PDF, at most 2 MB each. |

The claim is refused when the date of loss is outside the policy period (Date of loss ... is outside the policy period) and while the policy premium is unpaid (`claims.block_unpaid_premium`). When it is saved, the system issues the claim number, sets the status to Pending, e-mails the Preliminary Loss Advice to the insurer's claims e-mail and notifies the Claims users and the policy owner. For a co-insured policy the claim shows each insurer's share of the claim amount.

## Follow the claim with the insurer

1. Open the claim with the eye icon. The page shows Waiting for Update.
2. Select Edit to correct the claim, or Proceed when the insurer has assigned an adjuster.
3. On the adjuster page, enter the Adjuster Name, the Insurance Company Claim Number, the dates, place of accident, driver and third party details, and upload the proof of documents.
4. Select Next. The status becomes Processing.

![Adjuster details](claim-adjuster)

## Settle the claim

The maker submits the settlement:

1. Open the claim and continue to Claim Settlement.
2. Choose the Settlement Type (Cash, Card or Cheque), enter the Settlement Amount, the Issue Date and the Settle Date, and upload the settlement documents (PNG or JPEG, at most 2 MB).
3. Select Submit.

![Claim Settlement form](claim-settlement)

The settle date cannot be before the issue date and the amount must be more than zero. The claim goes to Pending Approval, and the message says a second Claims user must approve it. The other Claims users are notified.

A second Claims user approves it:

1. Open the notification, or open the claim in Pending Approval from Operations > Claims. The page shows Waiting for Settlement.
2. Check the claim details and the settlement.
3. Select Proceed to approve, or Reject to send it back to the maker.

![Waiting for Settlement: the checker's view](claim-approval)

The maker cannot approve his or her own settlement. After approval the claim is Settled, the maker is notified and the dashboard and reports are updated. For a co-insured policy, the settlement is split by share: the Co-Insurance Details table shows each insurer's share of the claim and of the settlement.

## Settlement cash (claims paid through the broker)

Usually the insurer pays the claimant directly and no money passes through the broker. When the settlement is marked as paid through the broker, the insurer pays the broker and the broker pays the claimant. The system then books, at settlement, the amount recoverable from each insurer by its share against the amount payable to the claimant, and the Settlement cash panel appears on the settled claim.

![Settlement cash of CLM-2026-90007: funds received from the insurer, amount still payable to the claimant](claim-cash)

Two cash movements are recorded on this panel:

1. Record funds received: when the insurer's money arrives, choose the Insurer, enter the Amount, the Bank account it was paid into, the Date and the Remittance advice / reference, and select Save. The system posts the receipt (posting rule Claim funds received from insurer) and shows the amount Received against Recoverable.
2. Pay claimant: when you pay the claimant, enter the Amount, the Bank account, the Payment mode, the Voucher / cheque number and the Payee, and select Save. The system posts the payment (posting rule Claim paid to claimant) and shows Paid to claimant and Still payable.

Each movement is listed with its journal. Recording funds needs the receipts permission and paying the claimant the disbursements permission, both held by Accounting. The claim screens belong to the Claims menu, which Accounting does not have in this release, so the System Administrator opens the claim and records the movements on Accounting's instruction (Appendix G).

## Claim details and audit trail

![Claim Details](claim-detail)

Claim Details shows the claim, incident, driver, policy, third party and system information, the insurer's claim number and the claim due date (20 days after reporting, `claims.sla_days`). For a settled claim the eye icon opens Claim Settlement with the documents the system produces: Acknowledgment letter, Claims Discharge Voucher, Claims Data sheet and FIR. Select View to open each one on the company letterhead.

![Claim Audit Trail: every status change with the user and time](claim-audit)

# Renewals

## Purpose

The system puts every policy into the renewal pipeline 90 days before expiry, sends renewal notices at 60, 30 and 15 days, and turns the accepted renewal quotation into the next policy term. A policy not renewed within 30 days after expiry lapses. Operations and Sales & Marketing work the renewals; the Processing Team approves renewal terms.

| Menu (Operations > Renewals) | Use it to |
|---|---|
| Renewal Policy | See active, expiring and expired policies and start a renewal. |
| Renewal Batch | Group many policies and send their notices together (up to 500, `renewals.batch_max_policies`). |
| Renewal Queue | Work the policies due for renewal: days to expiry, status, risk, owner, attempts. |
| Retention Analytics | Renewed, lapsed and open renewals and the retention rate. |
| At-Risk Policies | Policies with a high retention risk score and the recommended actions. |
| Negotiations | Record contacts with the client and request approval of terms. |
| Lapse Management | Lapsed policies, policies in the grace period and win-back campaigns. |
| Performance | Renewal rate, premium retention and cycle time against target. |

| When | What happens | Setting |
|---|---|---|
| 90 days before expiry | The policy enters the pipeline. | `renewals.pipeline_days` |
| 60, 30, 15 days before expiry | First, second and final notice to the client. | `limits.renewal_notice_days` |
| Expiry date | The policy becomes Expired. | |
| 30 days after expiry | An unrenewed policy lapses. | `renewals.grace_period_days` |

## Renew a policy

![Renewal Policy: expired and expiring policies](renew-policy)

1. Choose Operations > Renewals > Renewal Policy.
2. On the policy row, select the three dots, then Renewal.
3. The renewal quotation opens with the covers of the expiring term. Check the coverage, select Calculate, then Next.
4. Check accessories and the order summary, then select Completed Quote.
5. Send it for customer approval (Chapter 8). When the client accepts, select Proceed to Policy.

The system issues the new term, marks the old policy Renewed, bills the premium and accrues the commission to the original referrer. Renewal terms submitted from the renewal workspace go to the Processing Team for approval (`renewals.maker_checker`). Whether renewals must follow the placement journey of their line is set in `placement.journey_applies_to_renewals` (off in the delivered set-up).

## Follow-up screens

![Renewal Queue](renew-queue)

The queue lists the policies due with days to expiry (red when overdue), premium, renewal status, risk level and number of contact attempts. Filter by status, risk level, owner or expiry dates.

![At-Risk Analysis](renew-atrisk)

The risk score adds weights for claims in the term, unpaid premium, expiry within 30 days, a premium increase, no contact yet and a first renewal (`renewals.risk_weights`). The recommended actions follow `renewals.risk_actions`.

![Negotiation Workspace](renew-negotiations)

Use Add Update to record a call or meeting, Request Approval to send renewal terms to the Processing Team and Send Communication to write to the client.

![Batch Renewal](renew-batch)

![Lapse Management](renew-lapse)

![Performance Tracking](renew-performance)

![Retention Analytics](renew-analytics)

# Open items and payments

## Open Items

![Operations > Open Items](open-items)

Operations > Open Items is the daily worklist of Operations and Accounting. Four boxes show a count and the first records: Expiring Policy, Pending Payments, Quote Pending and Renewal Request. Select See More to open the full list of a box.

## Payments

![Operations > Payments](payments)

Operations > Payments shows gross premium, collected premium, receivables and earned commission, with the bills by tab Paid, Pending and Reviewing. The Type column tells whether the bill is for a policy, a renewal or an endorsement. A premium bill cancelled because the policy is direct bill shows DIRECT BILL. Receipts are posted by Accounting; this screen shows the result.

# Accounts: receipts, collections and the ledger

## Purpose

The Accounts menu is where Accounting collects premium, pays out money and keeps the general ledger. Every screen posts balanced journals through the posting rules (Chapter 23), and most payments need a second user to approve them.

| Menu (Accounts) | Use it to |
|---|---|
| Receipts | Post official receipts against open bills. |
| Collections | Follow outstanding premium by ageing bucket, send reminders and import open items at go-live. |
| Accounting Query, All Clients Accounting | Search the accounting entries; see each client's balance. |
| Open Entry Matching, Open Entry Un-Matching | Match open debit and credit entries of an account, with write-offs, or undo a match. |
| Disbursement | Payment vouchers and cheques. |
| Petty Cash | Initiate, request, disburse, receive and replenish petty cash. |
| Journal Voucher, Correction JV, Reversal JV | Manual journals, corrections and reversals, with approval. |
| Remittance | Remittances to insurers, settlements and direct-bill debit notes (Chapter 16). |
| Incentive | Incentive calculations, approvals and statements (Chapter 21). |
| Period End, Tax, Bank Reconciliation | Chapters 17, 18 and 19. |

## Receipts

![Accounts > Receipts](acc-receipts)

The receipts list shows each official receipt with its transaction code and number (RT-), policy, client, date, amount, paid and unpaid amounts and status. Bulk Print prints receipts for a customer and date range on the company letterhead. Bulk Upload posts many receipts from `Receipts_Upload_Template.xlsx` (at most 1,000 rows).

### Post a receipt

1. Choose Accounts > Receipts and select Receipt.
2. Check the Receipt Date and keep Receipt Type Payment (choose Refund for money returned).
3. Choose the Branch Code and, if used, the Department Code.
4. In Customer Code, choose the client. The list shows only clients with open bills.
5. In Policy Number, choose the policy.
6. Choose the Receipt Mode and type the Reference No.
7. Select the open bill to pay, then enter the Amount received or select Pay full balance.
8. Add Remarks if needed and select Record payment.

![Add Receipts](acc-receipt-add)

The receipt gets the next number of the Official Receipt series (Master > Document Numbering). The system posts Dr Cash in Bank (or the cash account of the receipt mode) / Cr Premiums Receivable, sets the bill to Partial or Paid, closes the collection item when fully paid, and makes the referrer's commission payable once the premium is fully collected. The amount cannot exceed the bill balance.

## Collections and ageing

![Accounts > Collections](acc-collections)

Accounts > Collections lists every open premium with the client, policy, outstanding amount across the ageing buckets (Current, 1-30, 31-60, 61-90, over 90 days), due date, status (Pending, Committed, Overdue) and days overdue.

- The due date follows the insurer's Premium Payment Warranty (days) on the Insurance Company master, else `collections.default_credit_days`.
- Reminders are e-mailed to clients 7 days before the due date and then every 7 days by the Collection reminders job (08:00). Send Payment Reminders Now sends them at once.
- The Aging Report shows the total outstanding per bucket, a chart and the detail by client.

![Collections Aging Report](acc-ageing)

### Import open items at go-live

![Import open items (go-live)](acc-open-items-import)

When you start on BrokerVerse, load the unpaid premium bills of the old system:

1. Select Import open items.
2. Select Download template (`Open_Items_Upload_Template.xlsx`) and fill in one row per unpaid bill: policy number, old bill reference, due date, original amount and open balance.
3. Enter the Go-live date (first day of live transactions).
4. Choose the file and select Upload.

No journal is posted: the receivable is part of the GL opening balances (Chapter 17). Rows already loaded for the same go-live date are skipped, so you can upload a corrected file again. The collection list and the ageing report total should equal the old system's ageing at the day before go-live.

## Accounting query and client accounting

![Accounting Entries Query](acc-query)

Accounting Query searches the accounting entries by policy, client, entry type, reference type, status, dates or GL code. Export downloads the result as CSV. All Clients Accounting shows, for every client, the number of transactions, total debits, total credits and balance.

![All Clients Accounting Details](acc-all-clients)

## Open entry matching and write-offs

![Open Entry Matching](acc-open-entry)

Open entry matching settles open debit and credit entries of the same account against each other, for example a receipt against a bill posted without a reference.

1. Choose the Sub Account Code and, if needed, division, department, analysis codes and currency.
2. Select Pull, or Pull By Criteria with Debit or Credit.
3. Tick the entries to match and check the totals.
4. If a small difference remains, enter it as the Adjustment Amt and choose the Write off reason.
5. Select Match.

The write-off reasons and their GL accounts are maintained on Master > Finance > Account Determination, tab Write-off reasons. The delivered reasons are Uncollectible premium (bad debt), Small balance difference (up to ₱ 100.00), Small credit balance taken to income (up to ₱ 100.00) and Foreign exchange difference. A reason with a limit refuses a larger write-off. The system posts the write-off journal with the posting rule of a debit or credit balance write-off. Open Entry Un-Matching undoes a match.

## Disbursement: payment vouchers and cheques

![Accounts > Disbursement](acc-disb)

A payment voucher PV-YYYY-NNNNN pays an insurer, an agent or referrer, a client or a supplier.

| Status | Meaning |
|---|---|
| Draft | Prepared; amounts may still change. |
| For approval | Waiting for a second user. |
| Approved | Approved; the cheque can be printed. |
| Paid | Paid; the payment journal is posted. |
| Cancelled | Cancelled before payment. |

1. Choose Accounts > Disbursement and select Create.
2. Fill in the header: Disbursement Date, Department Code and Branch Code, Payee Type (Customer, Insurer, Agent/Referrer or Supplier), Criteria (Specific or Payall), the payee and, if needed, the policy. Select Next.
3. On the Invoice List, tick the payables to pay. Select Next.
4. Choose the bank account and cheque book. Save the voucher; it goes for approval.

![Create Disbursement](acc-disb-create)

A second Accounting user opens the voucher, reviews the cheque details and approves the cheque. The system posts the payment journal (for example Dr Premiums Payable to Insurers / Cr Cash in Bank). Print the approved cheque; the voucher becomes Paid. The maker cannot approve his or her own voucher (`finance.maker_checker_enabled`). Bulk Disburse creates one payout voucher per referrer with approved commission. Bulk Upload loads vouchers from `Disbursements_Upload_Template.xlsx`, and Bulk Print prints vouchers on the company letterhead.

## Petty cash

![Petty Cash Request](acc-pettycash)

| Screen (Accounts > Petty Cash) | Use it to |
|---|---|
| Initiate | Open a petty cash fund (code, size, maximum per transaction, branch, department). |
| Request | Record a request for petty cash. |
| Disbursement | Pay out an approved request from the fund. |
| Receipts | Record money returned to the fund. |
| Replenish | Top the fund back up from the bank. |

The funds are established in Accounts > Petty Cash > Initiate (code, fund size, transaction limit and minimum cash box). The custodian is notified when a fund drops below its minimum. Requests are maker-checker.

## Journal vouchers

![Accounts > Journal Voucher](acc-jv)

1. Choose Accounts > Journal Voucher and select Voucher.
2. Choose the Transaction Code, type the Transaction Description and check the Date.
3. Select Add Data. Choose the Main Account, the Sub Account if there is one, the Entry Type (Debit or Credit), branch, department, currency and Amount. Save the line.
4. Repeat for every line until Total Debit equals Total credit.
5. Select Submit for approval.

![Add Journal Voucher](acc-jv-add)

![Add Journal Voucher: entering a line](acc-jv-line)

An unbalanced voucher is refused with the difference. A voucher dated in a soft-closed period can be posted only by the Accounting Manager, and one dated in a closed period is refused (Chapter 17). The approvers are notified. The checker opens the voucher, checks the lines and approves it (the journal is posted and appears in the Journal Register and the trial balance) or rejects it with a reason.

![Correction JV](acc-correction)

Correction JV reverses a posted voucher and posts the corrected lines after approval. Reversal JV posts the opposite entries of a posted voucher after approval. Recurring journals such as monthly rent are set up once as templates (Chapter 17).

# Commission

## Purpose

The broker earns brokerage commission from the insurer on every policy. Part of it, the comsub, is paid to the agent or referrer who brought the business. BrokerVerse accrues the commission at policy issue, makes it payable when the premium is collected and pays it by voucher less withholding tax.

The brokerage rate comes from the Commission Rate Matrix (Chapter 23), then the insurer's default rate, then `commission.default_rate`. Only Sales & Marketing users earn commission on their production (`commission.eligible_roles`).

| Status | Set when | Who |
|---|---|---|
| Accrued | The policy is issued, or an endorsement adds premium. | System |
| Eligible | The premium is fully collected, or Accounting marks it. | System, Accounting |
| Approved | An Accounting user approves the line; the comsub accrual is posted. | Accounting, not the maker |
| Paid | The payout voucher is approved; commission payable, cash and withholding tax are posted. | Accounting checker |
| Reversed | The line is reversed; a clawback journal is posted if it was paid. Return premium claws back the comsub on the returned part. | Accounting |

## Commission Dashboard

![Commission > Commission Dashboard](comm-dashboard)

The dashboard shows brokerage income, comsub, net margin and margin %, the outstanding payable and the withholding tax withheld, with breakdowns by referrer, status, month, product and insurer. Switch between the Accounting and Management views at the top right.

## Pay commission to a referrer

![Commission > Agents/Referrer Accounts](comm-referrers)

The list shows every referrer with type (Agent, Sub-agent, External), level, number of policies, net payable, WHT type and bank account. The header shows the amount due this cycle and the amount ready to pay.

1. Choose Commission > Agents/Referrer Accounts and select the referrer.
2. Check Apply WHT (the referrer's tax code, else the code of its type in `commission.wht_code_by_type`: individual agents WI515 5%, companies WC515 10%).
3. Under Current cycle, check the eligible lines.
4. Select Approve. Another Accounting user must approve lines you prepared.
5. Select Generate payout. The system creates a draft payout voucher and opens it in Disbursement.
6. Complete the bank details and submit the voucher. A second Accounting user approves it and the lines become Paid.

![Referrer account](comm-referrer)

A referrer without a bank account on file cannot be approved or paid. Add the bank details first.

# Remittance and direct bill

## Purpose

The Remittance menu pays the insurers. For broker-billed policies, Accounting remits the collected premium, net of the broker's commission, to each insurer by its share. For direct-bill policies, Accounting bills the commission to the insurer with a debit note and records the insurer's payment.

| Menu (Accounts > Remittance) | Use it to |
|---|---|
| Automated Processing | Create draft remittances per insurer from the collected, unremitted premium. |
| Tracking | Follow each remittance and submit drafts for approval. |
| Statements | Produce remittance statements for insurers. |
| Settlement | Settle approved remittances with an insurer; raises the insurer payment voucher. |
| Reconciliation | Match bank transactions with remittances. |
| Approval Workflow | Approve or reject remittances, settlements, transfers and adjustments. |
| Direct Bill Processing | Commission debit notes to insurers for direct-bill policies. |
| Bulk Processing, Scheduling, Electronic Transfer, Exception Management, Agency Bill Processing, Adjustments, Notifications, History, Analytics | Supporting screens. |

## Remit premium to an insurer

1. Automated Processing: tick the insurers that are Ready, select Validate, then Process Selected. Draft remittances REM- are created. The due date follows the insurer's Remittance Terms (days after collection), else `remittance.default_due_days`.
2. Tracking: find the draft and select Process. It goes for approval.
3. Approval Workflow: a second Accounting user approves it, within their limit in Master > User Management > Authority Matrix (Remittance approval: ₱ 1,000,000 for Accounting, no limit for the Accounting Manager out of the box). The initiator cannot approve. Cover for an absent approver is given in Master > User Management > Delegations.
4. Settlement: choose the Insurer code, select Add policies, select Calculate (premium − commission − tax ± adjustments = net settlement) and Submit for approval.
5. The checker approves the settlement (SET-). The system raises the insurer payment voucher in Disbursement for the net amount.
6. Issue and approve the cheque in Disbursement. The voucher becomes Paid and the remittance Completed.

![Automated processing](rem-automated)

![Remittance Tracking](rem-tracking)

![Approval workflow](rem-approval)

![Insurer settlement](rem-settlement)

For a co-insured policy each insurer is remitted its own share. A refund due from an insurer (return premium on premium already remitted) is netted against its next remittance.

## Direct bill processing

![Direct Bill Processing: raise a debit note](rem-db-raise)

The cards show the unbilled commission, the billed and outstanding amount, the overdue amount and the total receivable from insurers.

To raise a commission debit note (maker):

1. Choose Accounts > Remittance > Direct Bill Processing, tab 1. Raise Debit Note.
2. Choose the Insurer, Issued from and Issued to dates and, if needed, the line. Select Load policies.
3. Tick the policies to bill and check the totals: commission, output VAT (12%), total due, EWT (10% of commission) and net cash expected.
4. Check the debit note date. The due date is 30 days later (`direct_bill.debit_note_due_days`).
5. Select Raise debit note and submit for approval, or Save draft.

A second Accounting user approves it on tab 2. Debit Notes, then prints it on the company letterhead and e-mails it to the insurer. When the insurer pays, open the debit note, choose Collections, enter the cash received, the tax withheld (EWT), the payment mode and reference, and select Post collection. Partial payments are allowed.

Tab 3. Billing Mode changes a policy between Direct bill and Broker billed with a reason. Switching to direct bill cancels the premium bill and books the commission due from the insurer. The change is refused once premium was collected or remitted, or once the commission is on a debit note.

![Direct Bill Processing: billing mode](rem-db-mode)

## Other remittance screens

![Remittance Reconciliation](rem-reconciliation)

Remittance Reconciliation matches imported bank transactions with remittances, exactly or within ₱ 0.50 (`remittance.reconciliation_tolerance`). The monthly bank reconciliation of each bank account is a separate module (Chapter 19).

![Remittance history](rem-history)

# Period end

## Purpose

Accounts > Period End holds the fiscal calendar and the closing work of Accounting: period status, the month-end close, recurring and accrual journals, the year-end close and the financial statements. Accounting prepares; the Accounting Manager approves.

| Menu (Accounts > Period End) | Use it to |
|---|---|
| Period Management | See the fiscal years and their periods, soft-close, close or reopen a period, and import the go-live opening balances. |
| Month-End Close | Run the month-end steps and checklist for a period and send the close for approval. |
| Year-End Close | Close income and expense to retained earnings and carry the balances into the next year. |
| Recurring Journals | Keep templates for journals that repeat every month, and accruals that reverse on day 1 of the next period. |
| Financial Statements | Income statement, balance sheet and trial balance of a fiscal period or any dates, with the general ledger of each account. |

The close checklist items are maintained on Master > Finance > Close Checklist.

## Period Management

![Accounts > Period End > Period Management](pe-periods)

A fiscal year (for example FY2026) has twelve monthly periods (2026-01 to 2026-12) and an adjustment period 13 (2026-13) used by the year-end close. The fiscal year starts in the month set in `accounting.fiscal_year_start_month` (January). Years are created when needed; Next fiscal year opens the following one.

| Period status | Who may post into it |
|---|---|
| Open | Everyone with posting rights. |
| Soft-closed | Only the Accounting Manager. Other users are refused with Accounting period ... is soft-closed. |
| Closed | Nobody. Reopen the period first. |
| Locked | Nobody. The periods of a closed fiscal year are locked. |

The Actions column offers Soft-close and Close for open periods and Reopen for closed ones. Every change asks for remarks and is kept in the period history with the user and time. Reopening a period and posting into a soft-closed period need the Accounting Manager (approve:period-end).

![Period Management seen by the Accounting Manager](pe-periods-mgr)

### Import the go-live opening balances

![Import opening balances (go-live)](pe-opening)

1. Select Import opening balances.
2. Select Download template (`Opening_Balances_Upload_Template.xlsx`) and enter the old system's trial balance at the day before go-live, one row per account with a debit or a credit.
3. Enter the Go-live date.
4. Choose the file and select Upload.

Debits must equal credits, otherwise nothing is loaded. Loading again with the same date replaces the earlier load. The balances go into the fiscal year that contains the go-live date and are read by the trial balance, financial statements, general ledger detail and bank reconciliation; the year-end close carries them forward. No opening journal is posted, so screens that add up journals only, such as Accounting Query, show movements from the go-live date. A go-live date after journals already posted in the same fiscal year is refused. The balance of Premiums Receivable must equal the open items imported on Accounts > Collections (Chapter 14).

## Month-End Close

![Accounts > Period End > Month-End Close](pe-close-list)

There is one close run per period. The list shows each run with its number (MEC-), period, run status, period status, blocking failures, warnings, journals created, preparer and approver.

1. Select New close run and choose the period.
2. Open the run and select Rerun steps (the first time, the steps run when the run is created and executed). The run executes the steps in order:

| Step | What it does |
|---|---|
| (a) Accruals | Posts the accrual templates of the period (Recurring Journals, kind accrual). They reverse on day 1 of the next period. |
| (b) Recurring journals | Posts the recurring templates due in the period that have not run yet. |
| (c) Commission deferral | Defers unearned commission when `accounting.defer_commission` is on; otherwise Skipped. |
| (d) FX revaluation | Revalues foreign-currency balances of the account types in `accounting.fx_revaluation_account_types`. |
| (e) Checklist | Runs the automatic checklist items and lists the manual ones. |

3. Read the checklist. Automatic items show Passed, Warning or Failed with the reason, for example 1 bank account(s) with activity in 2026-08 have no approved bank reconciliation: ACC-BDO-001. Fix what failed, then select Re-run checks.
4. Sign off each manual item with Sign off once it is done, for example Bank reconciliations reviewed and signed off.
5. Select Submit close.

![Month-end close run MEC-2026-00001 for 2026-08 with its steps and checklist](pe-close-run)

A blocking item that has failed or is not signed off stops the submit; a warning does not. When `accounting.period_close_requires_approval` is on (delivered setting), the Accounting Manager opens the submitted run and selects Approve, or Reject with a reason. The approver must be a different user from the preparer. On approval the period becomes closed. With the setting off, the submit closes the period directly.

Rerunning the steps first reverses the run's own earlier journals, so a rerun gives the same ledger as a single run. Cancel run reverses the run's journals and ends the run.

The Month-End Close Status report (Reports > Financial Reports) shows each period's run and checklist result.

### The close checklist

![Master > Finance > Close Checklist](pe-checklist)

Master > Finance > Close Checklist holds the items copied to every close run. Automatic items run a built-in check; manual items are signed off by a user. Each item is Blocking or Warning.

| Delivered item | Type | Severity |
|---|---|---|
| No unposted or pending journals in the period | Automatic | Blocking |
| Trial balance balances | Automatic | Blocking |
| Suspense account is cleared | Automatic | Blocking |
| No unapplied receipts | Automatic | Warning |
| Bank transactions reconciled | Automatic | Warning |
| Issued policies are billed | Automatic | Warning |
| Remittances to insurers paid | Automatic | Warning |
| Direct-bill commission billed | Automatic | Warning |
| Bank reconciliations reviewed and signed off | Manual | Blocking |
| Prepayments and depreciation reviewed | Manual | Warning |
| Payroll and statutory contributions booked | Manual | Warning |

Select Add item to add a manual item of your own, and change the severity of an item to make it blocking. The bank reconciliation check looks at periods from `bank_reconciliation.check_from_period` onwards.

## Recurring Journals

![Accounts > Period End > Recurring Journals](pe-recurring)

A recurring template (RJV-) posts the same journal every month, quarter or year, for example office rent. An accrual template posts at the period end through the month-end close and reverses on day 1 of the next period.

1. Select New template.
2. Enter the Name, Kind (recurring or accrual), Frequency, Start date, Next run and, if needed, End date.
3. Enter the lines with account and debit or credit. The template must balance.
4. Choose Auto-post (post without approval) and, for accruals, Auto-reverse.
5. Save.

Recurring templates post on their next run date through the Recurring journals job (Master > Schedules, off in the delivered set-up) or through the month-end close. Post due journals now posts every template that is due. The Accrual auto-reversal job reverses accruals, commission deferrals and FX revaluations on day 1 of the next period.

## Year-End Close

![Accounts > Period End > Year-End Close](pe-year-end)

The year-end close needs all twelve periods of the year closed and period 13 open.

1. Choose the fiscal year and select Start year-end close. The year becomes closing and the run gets a number YEC-.
2. Select Run checks. The Pre-checks confirm that the periods are closed and the trial balance balances.
3. Post any audit adjustments with Adjustment journal. They are dated the fiscal year end, posted in period 13 and approved by a second user.
4. The Accounting Manager selects Close the year. The system posts the closing entries in period 13 (income and expense to Current Year P/L, `accounting.account.current_year_pl`, then to Retained Earnings, `accounting.account.retained_earnings`), writes the balance-sheet balances at year end as the opening balances of the next year (no opening journal is posted), locks the periods and creates the next year.

Reverse the close (Accounting Manager, with a reason) reverses the closing entries, removes the opening balances and unlocks the periods. It is possible until the first period of the next year is closed.

## Financial Statements

![Accounts > Period End > Financial Statements: income statement](pe-statements)

Financial Statements has three tabs: Income Statement, Balance Sheet and Trial Balance. Choose the **Fiscal year**, the **Period** and the **View**; the screen opens on the period of today.

| View | Covers |
|---|---|
| Month | The period. |
| Quarter | From the first day of the fiscal quarter to the end of the period. |
| Year to date | From the first day of the fiscal year to the end of the period. |
| Custom range | The From and To dates you enter. |
| Period end, Custom date (Balance Sheet) | The balances as of the end of the period, or as of the date you enter. |

The cards above the statement follow the tab: total income, total expenses, net income (or net loss) and the year to date for the income statement; total assets, total liabilities, total equity and the balance check for the balance sheet; total debits, total credits and the difference of the closing balances for the trial balance.

- Income Statement: this period, year to date, same period last year and last year to date, grouped into revenue, cost of services and operating expenses, with net income (loss). An expense credited in the period, such as a commission clawback or the reversal of an earlier month's entry, shows in parentheses.
- Balance Sheet: balances as of the date against the previous year end. Income and expense not yet closed show under equity as current year earnings (and earnings of prior years not yet closed). The opening balances loaded at go-live are included.
- Trial Balance: opening, movement and closing debit and credit per account.

Select an account to open its general ledger for the period: opening balance, each posting with its journal, running balance and closing balance. **Export** saves the statement as an Excel workbook or a PDF document with the company name, the period and who printed it and when; **Print** prints the same PDF. The same statements are reports under Reports > Financial Reports (Income Statement, Balance Sheet, Trial Balance Movement, General Ledger Detail).

# Tax

## Purpose

Accounts > Tax prepares the BIR forms and working papers from the ledger. The tax codes, with their rates, BIR ATC and GL accounts, are kept on Master > Finance > Taxation.

| Menu (Accounts > Tax) | What it produces |
|---|---|
| BIR Form 2307 | Certificates of Creditable Tax Withheld at Source, per payee and quarter: issued by the broker, and received from insurers and clients. |
| VAT Summary | Vatable revenue (commission and fees), output VAT, input VAT and net VAT payable per month or quarter: the working paper for BIR 2550M / 2550Q. |
| SAWT | Summary Alphalist of Withholding Taxes: the tax withheld from the broker by insurers and clients, for the income tax return. |
| QAP | Quarterly Alphalist of Payees: the tax the broker withheld from its payees, for BIR 1601EQ. |
| SLSP Sales, SLSP Purchases | Summary List of Sales and of Purchases for the VAT relief submission. |

Before the first filing, fill in `bir.withholding_agent_tin`, `bir.registered_name`, `bir.registered_address` and `bir.zip_code` on Master > Configuration, group BIR. The ATC used for each payee type comes from `bir.atc_by_payee`, and SAWT uses `bir.sawt_default_atc` where no ATC is recorded.

## BIR Form 2307

![Accounts > Tax > BIR Form 2307](tax-2307)

1. Choose Accounts > Tax > BIR Form 2307.
2. Choose Issued by us (tax the broker withheld on payment vouchers to agents, referrers and suppliers) or Received (tax insurers and clients withheld from the broker).
3. Choose the year and quarter. The list shows each payee with TIN, ATC, number of transactions, income payments and tax withheld.
4. Select View on a payee to see the certificate with the three months of the quarter.
5. Issue the certificate. It gets a number from the BIR Form 2307 series (CWT-) and prints on the BIR layout with the broker's details. An issued certificate is kept; issuing again returns the same one. Cancel withdraws it with a reason.

For direct-bill commission, the tax the insurer withheld is posted to Creditable Withholding Tax (BIR 2307) when the debit note collection is recorded, and appears under Received.

## VAT Summary, SAWT, QAP and SLSP

![Accounts > Tax > VAT Summary](tax-vat)

The four reports work like every report (Chapter 24): choose the Report Criteria (monthly or quarterly), the From Date and To Date, select Preview, then choose CSV, Excel or PDF and Generate.

![Accounts > Tax > SAWT](tax-sawt)

![Accounts > Tax > QAP](tax-qap)

![Accounts > Tax > SLSP Sales](tax-slsp)

> **Caution:** The reports give the figures and the alphalists in the BIR column order. Check them against the current BIR format and the eFPS or eBIRForms validation before you file.

## Tax codes

![Master > Finance > Taxation: tax codes](tax-codes)

The tax codes master lists VAT (output 12%, input 12%, zero-rated, exempt), expanded withholding tax codes with their BIR ATC (for example WI139 and WC139 on broker commission, WI515 on commission of sales representatives and referrers), final withholding, documentary stamp, local government and premium taxes. Each code has its rate, GL account, what it applies to (sales, purchases or both), effective date and status. Select Add tax code for a new code, or edit a code when a rate changes, with the new effective date. Verify the rates and ATCs against the current BIR regulations with your tax adviser.

# Bank reconciliation

## Purpose

Bank reconciliation matches the lines of each bank statement with the cash-account lines of the ledger, posts the bank items not yet in the books and produces the monthly bank reconciliation statement. Accounting prepares each reconciliation; the Accounting Manager approves it.

| Menu (Accounts > Bank Reconciliation) | Use it to |
|---|---|
| Reconciliation Workspace | Import statements, match lines, post bank items and start the reconciliation of an account and period. |
| Reconciliations | The list of reconciliations (BRC-) with their status, and each reconciliation statement. |
| Reconciliation Statement Report, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines, Bank Book | Reports for any bank account and date. |

The set-up is on Master > Finance: Bank (bank accounts, each linked to its GL cash account and statement format, with the reconcile-from date), Bank Statement Formats and Bank Transaction Types.

## The Reconciliation Workspace

![Accounts > Bank Reconciliation > Reconciliation Workspace for ACC-BDO-001, August 2026](br-workspace)

Choose the Bank account and the Period. The cards show the Balance per bank (from the latest statement), the Balance per books (GL cash account at the period end), the unmatched bank lines and book entries with their totals, and the Difference between the adjusted balances. Below are the bank statement lines and the book entries, each filtered to Unmatched or All.

### Import a bank statement

![Import statement](br-import)

1. Select Import statement.
2. Choose the statement Format (BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE, GENERIC or one of your own) and the file (CSV or XLSX as downloaded from the bank's online banking).
3. Enter the statement reference, for example SOA Aug 2026.
4. Select Preview. The preview shows the opening and closing balance, the lines read and any rows that could not be read. The statement must balance (opening + credits − debits = closing) when `bank_reconciliation.require_balanced_statement` is on.
5. Select Import. The statement gets a number (BST-).

A file already imported for the account is refused. Automatic matching runs straight after import when `bank_reconciliation.auto_match_on_import` is on. For a bank without a delivered format, use `Bank_Statement_Generic_Upload_Template.xlsx` with the GENERIC format, or add a format. A statement can also be entered by hand.

### Match

Auto-match runs the matching rules on the account, in this order, on exact amounts only:

| Rule | Confidence |
|---|---|
| Adjustment journals (a bank line and the journal made from it) | 100% |
| Reversed entries (a book entry and its reversal) | 100% |
| Amount and reference or cheque number | 100% |
| Amount and date window (`bank_reconciliation.date_window_days`, 5 days), one candidate on each side | 80% |
| One bank line, several book entries (a deposit of several receipts) | 65% |
| Several bank lines, one book entry | 60% |

Match the rest by hand: tick one or more bank lines and one or more book entries with the same total and select Match selected. When the amounts differ, choose the Treatment of the difference: an adjustment journal, a bank error or a book error. A match can be undone with Unmatch until the reconciliation that cleared it is approved.

### Post bank items not yet in the books

Bank charges, interest, final tax on interest and direct credits appear on the statement before they are in the books. Select the bank line and choose Create adjustment. The Bank transaction type proposes the account from the line's description (for example SERVICE CHARGE suggests BCHG Bank charges). The system posts the adjustment journal and matches it to the line. Types marked Approval required, such as a direct credit from an insurer booked to suspense, wait for a second user (Approve adjustment journal). A line the bank posted in error is marked with Mark as bank error instead.

A returned cheque (DAIF or DAUD) uses the type Returned cheque: the official receipt is cancelled and the client's receivable is opened again.

### Stale cheques

![Stale cheques](br-stale)

Stale cheques lists the cheques issued more than `bank_reconciliation.stale_cheque_days` (180 days) ago that have not cleared the bank. Cancel a stale cheque to reverse the payment and reopen the payable.

## Prepare and approve the reconciliation

1. On the workspace, select Start reconciliation for the account and period. The reconciliation (BRC-) opens as Draft with live figures.
2. Check the Bank Reconciliation Statement: balance per bank statement, deposits in transit, outstanding cheques and bank errors give the adjusted bank balance; balance per books, bank credits not yet booked, bank charges not yet booked and book errors give the adjusted book balance. The Difference must be ₱ 0.00.
3. Select Prepare. The figures are frozen and the reconciliation waits for approval.
4. The Accounting Manager opens it from Reconciliations and selects Approve. The approver must not be the preparer. Approval locks the matches cleared up to the period end.

![Reconciliation BRC-2026-00001 opened by the Accounting Manager](br-rec)

![Accounts > Bank Reconciliation > Reconciliations](br-recs)

Print PDF prints the statement on the company letterhead. An approved reconciliation can be reopened by the Accounting Manager with remarks, for example to correct a match; the history lists every status change. The month-end checklist item Bank transactions reconciled looks for an approved reconciliation of each bank account with activity in the period.

## Reports

![Reconciliation Statement Report](br-statement)

| Report | What it shows |
|---|---|
| Bank Reconciliation Statement | The statement of an account as of a date. |
| Outstanding Cheques | Payments in the books not cleared by the bank as of the To Date, aged; stale cheques marked. |
| Deposits in Transit | Receipts in the books not yet on the bank statement. |
| Unmatched Bank Lines | Statement lines not matched as of the To Date. |
| Bank Book | Every movement of the account with the running balance. |

## Set-up masters

![Master > Finance > Bank Statement Formats](br-formats)

A statement format tells the system how to read a bank's export: the column of each field, the date format, the number of title rows and whether amounts are in debit and credit columns or one signed column. The delivered formats follow the usual exports of BDO, BPI and Metrobank and a generic layout. Check them against an actual file from your bank and adjust the columns if the bank changes its export. Test a format with a sample file before you use it.

![Master > Finance > Bank Transaction Types](br-types)

A bank transaction type is a bank item that is not yet in the books, with the account its adjustment posts to (an account role or a GL account), whether the adjustment needs approval, and the description pattern that suggests the type on imported lines. The delivered types are Bank charges, Interest income, Final tax on interest, Returned cheque, Direct credit from insurer, Direct credit from client and Other bank debit. The same screen lists the automatic matching rules; you can switch a rule off or change its date window.

# Reinsurance

## Purpose

The reinsurance screens record the treaties that protect large risks, the cessions made under them, the recoveries on claims and the reconciliation of reinsurer statements. The Processing Team works the treaties and cessions, Claims registers recoveries, Accounting reconciles reinsurer statements and the System Administrator maintains the treaty master.

| Menu | Use it to |
|---|---|
| Master > Reinsurance Treaty | Add and maintain treaties: quota share, surplus, excess of loss, stop loss; reinsurers, shares, period. A new treaty needs a second user's approval (`reinsurance.treaty_requires_approval`). |
| Reinsurance > Treaty Dashboard | Active treaties, capacity, utilisation, premium ceded and claims recovered. |
| Reinsurance > Cession Tracking | Policies ceded per treaty with cession %, ceded premium and commission; Process Cession and Generate Bordereau. |
| Reinsurance > Claims Recovery | Amounts recoverable on claims under treaties; Register Recovery. |
| Reinsurance > Reconciliation | Compare our figures with the reinsurer's statement; variances above 1% need review. |
| Reinsurance > Analytics | Treaty utilisation, loss ratio trend, retention, recovery performance. |

![Treaty Master](ri-treaty-master)

![Reinsurance Treaty Dashboard](ri-treaties)

![Cession Tracking](ri-cessions)

![Reinsurance Claims Recovery](ri-recovery)

![Reinsurance Reconciliation](ri-reconciliation)

Reinsurers must meet the minimum security rating A- (`reinsurance.min_security_rating`). A confirmed cession and a settled recovery are posted through their posting rules. The Reinsurance Cession Register report lists the cessions of a period.

# Incentives

## Purpose

Incentive programmes reward account executives for reaching targets: premium volume, policy count, renewal rate or conversion. The System Administrator sets up the programmes. Accounting calculates the results, a second Accounting user approves them, and Accounting pays them. Accounting cannot change the programmes it pays.

| Screen | Use it to |
|---|---|
| Master > Incentive Programs | Add a programme: code (INC-), name, type, target metric, base target, frequency, start and end dates. |
| Accounts > Incentive > My Programs | The programmes with target, achievement and potential earning. |
| Accounts > Incentive > Calculations | New Calculation for a period creates a batch (CALC-) with the amount per person, sent for approval. |
| Accounts > Incentive > Approvals | Approve, reject or Bulk Approve calculation batches (not your own). |
| Accounts > Incentive > Statement | Statement per person and month: earnings, year to date, pending and last payment. |

![Incentive Program Master](inc-programs)

![Incentive Calculations](inc-calculations)

![Incentive Approvals (Accounting Manager)](inc-approvals)

![Incentive Statement](inc-statement)

Only Sales & Marketing users take part (`incentive.eligible_roles`). The approved amounts are accrued and then paid through their posting rules, and appear in the Incentive Results report.

# Product Configurator

## Purpose

The Product Configurator holds the products the broker places and the rules that price them. The motor tariff that prices every motor quotation (vehicle classes, CTPL and Auto Passenger PA) is kept here. The Processing Team maintains it; Sales & Marketing and Operations can view the dashboard and templates.

| Screen | Use it to |
|---|---|
| Dashboard | Active products, premium, loss ratio and commission; quick actions. |
| Product Templates | Create, version and edit product templates. The motor tariff is in template MOT-003-2025. |
| Coverage Builder | Coverages: code, name, mandatory or optional, deductible, premium impact. |
| Rating Engine | Rating factors and their rules, with a Test Calculator. |
| Acceptance Rules | Acceptance, validation and loading rules. |
| Document Manager | Document templates per stage. |
| Market Mapping, Risk Mapping | Products mapped to insurers; product definitions by line (IAR by risk section). |
| Product Analytics | Policies, premium, loss ratio and margin by product. |

![Product Configurator Dashboard](pc-dashboard)

![Product Templates](pc-templates)

Template statuses are Draft, Active, Inactive and Retired. Only active templates are used by the quotation screens.

## Maintain the motor tariff

1. Choose Product Configurator > Product Templates.
2. Select the pencil on MOT-003-2025 Motor Insurance Basic Plan and open the tab CTPL & Auto PA.
3. For each Vehicle class, check the name, Code, default Seats, CTPL 1 year (₱) and CTPL 3 years (₱). Leave the 3-year amount blank where it is not offered.
4. Select Add vehicle class to add a class, or the bin icon to remove one.
5. Under Auto Passenger Personal Accident, set the Rate (% of limit per seat) and the Limits per person offered.
6. Select Save Template.

![Template MOT-003-2025, tab CTPL & Auto PA](pc-template-ctpl)

| Vehicle class | CTPL 1 year (₱) | CTPL 3 years (₱) | Default seats |
|---|---|---|---|
| Private cars (including jeeps, AUVs and SUVs) | 610.40 | 1,660.40 | 5 |
| Light and medium trucks (own goods) up to 3,930 kg | 660.40 | | 3 |
| Heavy trucks (own goods) and private buses over 3,930 kg | 1,250.40 | | 3 |
| AC and tourist cars | 790.40 | | 5 |
| Taxi, PUJ and mini bus | 1,150.40 | | 5 |
| PUB and tourist bus | 1,500.40 | | 50 |
| Motorcycles, tricycles and trailers | 300.40 | | 2 |

The server checks the values and the quotation screens use them at once. The tax rates used for pricing come from Master > Configuration, group Taxes; the template's Taxes and fees tab shows them read-only.

![Rating Engine Configuration](pc-rating)

![Acceptance rules](pc-uwrules)

# Master data and administration

## How the master screens work

The masters hold the reference data the other screens offer in their lists. Each master works the same way: a list with search, Add, Upload where offered, the eye to view, the pencil to edit and a status switch to deactivate. Records are not deleted; a deactivated record disappears from the lists.

| Master (Master > Generals) | Holds |
|---|---|
| Organization > Company, Branch | The broker company with its letterhead, and its branches and departments. |
| Insurance Management > Insurance Company | Insurers with placement e-mail, TIN, default commission rate and credit terms. |
| Insurance Management > Line of Business, Product, Cover | Lines, products and covers. |
| Insurance Management > Signatories | Authorised signatories of quotations and documents. |
| Insurance Management > Vehicle | Vehicle brands, models, variants and seating. |
| Location > Country, Province, City / Municipality | Philippine address lists of the PSGC: regions, provinces, cities and municipalities with ZIP codes, barangays. |
| Commission | Commission sharing with referrers by insurer, product and cover. |
| Employee Management > Hierarchy, Designation, Employee | Staff structure. |
| User Management > User, Role | Users and roles. |

![Master > Generals > Organization > Branch](m-branch)

## Company master and the letterhead

![Master > Generals > Organization > Company](m-company)

Every printed document and every report PDF (quotation, broker slip, placement slip, policy schedule, billing statement, official receipt, payment voucher, debit note, claim letters, BIR forms, reports) is produced by one PDF engine and carries the letterhead of the primary company from the Company master: logo, company name, address, TIN, telephone, e-mail and web site.

![Editing the company: name, licence, TIN, logo and Letterhead company](m-company-edit)

1. Choose Master > Generals > Organization > Company. Type part of the company name in the search box to list it, then select the pencil on the delivered company (iorta TechNXT Corp.) to edit it into your own.
2. Enter the Company Name, the License Number (Insurance Commission licence), Email ID, TIN (for example 000-123-456-000), Logo (printed on documents), Website link, the address lines, ZIP Code, City / Municipality, Province, Country, Phone Number and Fax.
3. Tick Letterhead company (used on documents and reports) for the company whose letterhead the documents use. Only one company can hold it.
4. Save, then print any billing statement or report as PDF to check the letterhead.

The application name and logo shown on the sign-in page and in the sidebar come from Master > System Settings, not from the Company master.

## Insurance companies and credit terms

![Master > Generals > Insurance Management > Insurance Company](m-insurer)

![Editing an insurer: placement e-mail, default commission rate and credit terms](m-insurer-edit)

Each insurer has a code, name, description, address, phone number and Email ID. Requests for quotation, firm orders, loss advices and remittance advices go to that e-mail. The Credit terms section sets:

| Field | Effect | When left empty |
|---|---|---|
| Premium payment warranty (days) | Days the client has to pay: the due date of the premium bill. | `collections.default_credit_days` |
| Remittance terms (days) | Days after collection within which the broker remits to the insurer: the due date of the remittance. | `remittance.default_due_days` |
| Default billing mode | Broker billed or direct bill for this insurer's new policies. | `direct_bill.default_billing_mode` |

The insurer's default commission rate and TIN are loaded with the Insurance Company upload (columns Default Commission Rate, as a fraction such as 0.20 for 20%, and TIN). The default rate applies when the Commission Rate Matrix has no rate for the insurer.

## Uploads and templates

![Upload dialog of a master with Download template](m-upload)

Masters with an Upload button take a spreadsheet:

1. Select Upload. Where a screen holds more than one record type (for example Vehicle: brands, models, variants, vehicles; Bank: banks or bank accounts), choose the type in Upload into.
2. Select Download template. The workbook has a Data sheet with the header row and one or two Philippine sample rows, a Columns sheet with the rules of each column and an Instructions sheet. Required columns have dark red headers.
3. Delete the sample rows, enter your data and save the file.
4. Choose the file and select Upload.

The result shows how many rows were created or updated and lists each failed row with its problem. Fix those rows and upload them again; an existing code updates the record. The same templates are delivered in `docs/package/05_Delivery/Upload_Templates`.

| Screen with Upload | Template |
|---|---|
| Insurance Company | `Insurance_Company_Upload_Template.xlsx` |
| Vehicle (brands, models, variants, vehicles) | `Vehicle_Brand_...`, `Vehicle_Model_...`, `Vehicle_Variant_...`, `Vehicle_Upload_Template.xlsx` |
| Country, Province, City / Municipality | `Country_...`, `Region_...`, `Province_...`, `City_Municipality_...`, `Barangay_Upload_Template.xlsx` |
| Bank (banks and bank accounts) | `Bank_Upload_Template.xlsx`, `Bank_Account_Upload_Template.xlsx` |
| Currency, Transaction code | `Currency_...`, `Transaction_Code_Upload_Template.xlsx` (petty cash funds are set up in Accounts > Petty Cash > Initiate) |
| Main Account and Sub Account (chart of accounts) | `Chart_of_Accounts_Upload_Template.xlsx` |
| Leads/Prospects, Quotation, Policy, Receipts, Disbursement | `Leads_...`, `Quotations_...`, `Policies_...`, `Receipts_...`, `Disbursements_Upload_Template.xlsx` |
| Collections (Import open items), Period Management (Import opening balances) | `Open_Items_...`, `Opening_Balances_Upload_Template.xlsx` |
| Bank Reconciliation (Import statement, GENERIC format) | `Bank_Statement_Generic_Upload_Template.xlsx` |
| Insurer Reconciliation (Import statement, GENERIC format) | `Insurer_Statement_Generic_Upload_Template.xlsx` |

Masters without an Upload button (Company, Branch, Department, Line of Business, Product, Policy type, Cover, Signatories, Exchange Rate, Hierarchy, Designation, Write-off reasons, Account Category, Security Rating, Product Category, Risk Section and the Remittance Master records) also have a template in `docs/package/05_Delivery/Upload_Templates`. The System Administrator loads those files through the API route written on the template's Instructions sheet, or the records are entered on the screen.

## Document Numbering

![Master > Document Numbering](m-docnum)

Every number the system issues comes from a series on Master > Document Numbering: policy, quotation, Broker Slip, Placement Slip, official receipt, invoice, payment voucher, journal voucher, claim, endorsement, debit note, month-end close, bank reconciliation, BIR Form 2307 and the others (52 series in 11 modules). The list shows each series with its module, prefix, format, counter reset, last number issued and the next number.

To change a series, select the pencil on its row:

1. Change the Name, Description, Prefix or Format. Insert tokens by clicking them: {PREFIX}, {YYYY} (2026), {YY} (26), {MM} (09), {FY} (fiscal year), {BRANCH}, {LOB} and {SEQ}. {BRANCH} and {LOB} are filled by the transaction; when empty they are left out with their separator.
2. Set the Sequence digits (5 gives 00001) and the Counter reset: Every calendar year, Every fiscal year, Every month or Never. Start number (new period) is where the counter starts after a reset.
3. Check the Next number preview and save.

The change applies to the next number issued and is recorded in the audit trail. A prefix used by another active series is refused.

To continue the numbering of the old system, select Set next number (the double arrow on the row) and enter the last number used plus one. The counter can only move forward. Your BIR-registered official receipt series must match the Authority to Print.

## Commission Rate Matrix

![Master > Finance > Commission Rate Matrix](m-crm)

The Commission Rate Matrix holds the brokerage rates the broker earns, by insurer, product, line of business and policy type (New business, Renewal or Any), with effective dates. The most specific active rate on the policy date applies, in this order: insurer and product, insurer and line of business, insurer, product, line of business; an exact policy type before Any. Without a matching rate, the insurer's Default Commission Rate applies, then the system default (`commission.default_rate`, 15%).

1. Select Add rate.
2. Choose the Insurer, Product and Line of business (at least one), and the Policy type.
3. Enter the Rate (%), Effective from and, if the rate ends, Effective to (or leave it Open-ended). Add Remarks, for example the reference of the insurer's agreement.
4. Save.

Use Test rate to check which rate a placement would get: choose the insurer, product, line, policy type and date, and select Find rate. The result names the source: Commission Rate Matrix, Insurer default rate or System default rate. The Commission master under Master > Generals holds the sharing of commission with referrers, which is a separate matter.

## Posting Rules

![Master > Finance > Posting Rules](m-posting-rules)

Every journal the system posts is built from the posting rule of its business event: policy issued (broker billed), endorsement additional and return premium, renewal, cancellation, premium collection applied, direct-bill commission booked, returned and collected, comsub approved, paid and clawed back, payment voucher paid, petty cash, write-offs, claim settled through the broker, claim funds received, claim paid to claimant, remittance settlement and adjustments, insurer refunds, reinsurance cessions and recoveries, and incentives.

![The posting rule of Policy issued - broker billed, with its simulation](m-posting-rule)

Select an event to see the rule in force: each line with its side (debit or credit), account (an account role, a fixed GL account, a resolver or an account supplied by the operation), amount, narration and whether it is split Per co-insurer. The rule also sets the journal narration and the branch or cost centre.

- Simulate builds the journal the rule would post with sample amounts, including a Co-insured sample, and shows whether debits equal credits. Use it before you save a change.
- New version saves a changed rule effective from a date, with a change note. Journals dated before that date keep using the earlier version.
- History lists every version and change.

> **Caution:** Change posting rules only with the Accounting Manager. A wrong rule posts wrong journals from its effective date. Simulate first.

## Account Determination and write-off reasons

![Master > Finance > Account Determination](m-acct-det)

Account Determination shows the GL account behind every account role the posting rules use, grouped in the tabs Premium, Customer, Miscellaneous, RI-Claims and Other, with the events that use each role. For example Brokerage commission income posts to 3201001 and Premium payable to insurers to 2201001. To change the account of a role, choose the new GL account; the message confirms which account the role now posts to. The change applies to postings from then on.

The tab Payee & payment mode holds the Payable account per payee type (Insurer, Agent/Referrer, Client, Supplier) and the Cash account per payment mode (cash, cheque, transfer, e-wallet). The line at the top says whether VAT, DST and LGT on premium are booked in their own accounts (`accounting.split_premium_taxes`).

![Account Determination, tab Write-off reasons](m-writeoff)

The tab Write-off reasons lists the reasons offered on Open Entry Matching (Chapter 14) with their Code, Reason, GL account, Maximum amount and Status. Select Add reason to add one.

## Chart of accounts

![Master > Finance > Main Account: the chart of accounts](m-mainaccount)

Master > Finance > Main Account is the chart of accounts, a Philippine broker chart grouped by account type and statement group. Sub Account holds sub-ledgers of a main account. For each account you see code, name, statement group, category, normal balance, whether it is an open-item account, whether manual journal vouchers may use it, its system use and status. Accounts that account roles point to cannot be deactivated; change the role on Account Determination first. Upload loads accounts from `Chart_of_Accounts_Upload_Template.xlsx`; put a main account before its sub accounts.

| Code | Account | Posted by |
|---|---|---|
| 1102001 | Cash in Bank - Operating Account | Receipts, vouchers |
| 1202001 | Premiums Receivable - Direct Clients | Bills, receipts |
| 1203001 | Commission Receivable - Insurers (Direct Bill) | Direct-bill commission, debit note collections |
| 1203002 | Due from Insurers | Refunds of return premium already remitted |
| 1302001 | Creditable Withholding Tax (BIR Form 2307) | Tax withheld by insurers |
| 1901001 | Suspense | Unidentified bank credits |
| 2201001 | Premiums Payable to Insurers | Bills, remittances |
| 2203001 | Commission Payable - Agents and Referrers | Commission approval and payout |
| 2204003 | Output VAT Payable | VAT on commission |
| 3201001 | Brokerage Commission Income | Policy issue, endorsements |
| 4401010 | Commission Expense - Agents and Referrers | Commission approval |

![Master > Finance > Bank](m-bank)

## Users and roles

![Master > Generals > User Management > User](m-users)

The System Administrator manages users on Master > Generals > User Management > User.

To add a user:

1. Select Add.
2. Enter the Username (the user ID), E-mail and Display Name. The e-mail is where Forgot password? sends its code.
3. Leave Password empty. The system then generates a temporary password.
4. Choose the role. Give each person one role; give the System Administrator role to as few people as possible.
5. Select Save. The Temporary password dialog shows the password once. Hand it to the user privately, then select Done.

![Add User (example values)](m-user-add)

The user must choose a new password at the first sign-in. A duplicate username is refused. For many users at once, the System Administrator runs the provisioning script on the server with `Users_Provisioning_Template.xlsx`; the file holds initial passwords, so keep it outside any shared folder and delete it after use.

The three-dot button on a user row opens the account actions:

| Action | Use it when |
|---|---|
| Unlock | The user was locked after 5 failed sign-ins. The list shows a Locked tag. |
| Reset password | The user forgot the password and cannot use Forgot password?. A temporary password is shown once and every session of the user ends. |
| Turn off two-step verification | The user lost the phone with the authenticator app. |
| Sign-in history | Access reviews: every sign-in attempt with date, result, method, IP address and browser. |

![Account actions of a user](m-user-actions)

Select the pencil to change the display name, e-mail or role; a role change ends the user's open sessions. Use the Status switch to deactivate a leaver. The history is kept.

![Master > User Management > Role](m-roles)

The seven roles are fixed. Open a role to see its read and write permissions per module (for example read:receipts, write:bank-reconciliation) and the approval permissions of the Accounting Manager (approve:period-end, approve:bank-reconciliation). The Accounting Manager role includes the Accounting role.

## System Settings

![Master > System Settings](m-system-settings)

Master > System Settings controls the look of the system: App Title, logo and favicon (the delivered system shows the iorta TechNXT logo and the name BrokerVerse), display currency, default language and theme colours. Select Save; the settings apply to every user, including the sign-in page.

## Configuration

![Master > Configuration](m-config)

Master > Configuration holds every business parameter in tabs with plain names (Accounting, BIR, Claims, Collections, Commission, Dashboard, Direct bill, General, Placement, Quotations, Renewals, Reports, Security, Taxes and others). Point at a label to see its key.

1. Choose the tab.
2. Change the value. Numbers, text and switches are typed or switched; lists are values separated by commas; lists of records are edited as a small table; e-mail templates are a text box where you keep the {{placeholders}}.
3. Select Save changes. The change applies at once, on every server, and is recorded in the audit trail with the old and new value.

![Configuration: the Placement tab with the placement journey of each line](m-config-placement)

![Configuration: security settings](m-config-security)

The business time zone is `general.timezone` (Asia/Manila). Dates of transactions, the "today" of reports and the schedules follow it.

> **Caution:** Change GL accounts, tax rates and maker-checker switches only with the agreement of the Accounting Manager. See Appendix C for the key settings.

## Schedules

![Master > Schedules](m-schedules)

Master > Schedules lists the jobs the system runs by itself, with the schedule in the business time zone (Asia/Manila, from System Settings > General). For each job you see what it does, the schedule in plain words, whether it is enabled, the next run, the last run and its status.

- Run now runs the job at once, for example after a change of settings. The result is shown, for example Updated: 5.
- The pencil changes the timetable, the job parameters (for example the days before period end of the month-end reminder) and enables or disables the job.
- History lists past runs with their results.

When several application servers run, each scheduled run happens once. The jobs are listed in Appendix D.

## Audit Trail

![Master > Audit Trail](m-audit)

Master > Audit Trail lists every create, update, approval, report run and sign-in, newest first: when, user, record type, record ID, action and the change with before and after values.

1. Enter a Record type (for example session for sign-ins, policy, receipt, placement, period-close-run), a Record ID or a User.
2. Enter a From date and To date to limit the period.
3. Select Search.

Use the audit trail for investigations, access reviews and to show that maker and checker were different people. Audit entries are kept for good (`housekeeping.audit_log_days` is 0).

# Reports

## How to run a report

BrokerVerse has 40 reports. Every report opens on the same report screen with the filters it uses.

- Reports > All Reports lists every report your role may run, grouped into Operational Reports and Financial Reports, with a short description. Type in Search reports to find one.
- Reports > Operational Reports and Reports > Financial Reports hold shortcuts to the most used reports. The Tax reports are also under Accounts > Tax and the bank reports under Accounts > Bank Reconciliation.

![Reports > All Reports (System Administrator: every report)](rep-catalogue)

1. Open the report.
2. Choose the Report Criteria, for example Overall, Agent, Principal Insurer or Branch. The filters the criteria uses become available.
3. Check the From Date and To Date.
4. Choose the other filters you need: agent, insurer, branch, client, product, bank account or status.
5. Select Preview to see the first rows on screen. The title shows how many rows the report has.
6. Choose the File format, CSV, Excel (XLSX) or PDF, and select Generate. The file downloads.

![Report screen: Production Register with its criteria and preview](rep-preview)

Files hold up to 50,000 rows (`reports.max_rows`). PDF reports print on the company letterhead with their summary figures. Download links stay valid for 72 hours and generated files are kept for 90 days. Every generated file is recorded in the audit trail. The Daily reports job produces the Production Register, the Collection Report and the Claims Position every morning at 05:00.

![Accounting: Reports > All Reports shows the reports of the Accounting role](rep-catalogue-acc)

## The report catalogue

{widths: 30,46,24}
| Report | What it shows | Roles besides the System Administrator |
|---|---|---|
| Production Register | Policies incepted in the period: premium, commission, new or renewal, billing mode; by agent, insurer, branch or billing mode. | Sales, Processing, Operations, Claims |
| Premium by Product / Month / Insurer | Policy count, sum insured, premium and commission. | Sales, Processing, Operations, Claims, Accounting |
| New Business vs Renewals | New business and renewals by month or agent. | Sales, Processing, Operations, Claims, Accounting |
| Lead Conversion Funnel | Leads by stage with conversion rate. | Sales, Processing, Operations |
| Placement Pipeline | Broker Slips and Placement Slips created in the period with status, lead insurer, sum insured, premium and age. | Sales, Processing, Operations |
| Market Response | Insurers approached on Broker Slips: offers, declines, pending, response rate, average response days and hit ratio. | Sales, Processing, Operations |
| Co-insurance Register | Co-insured policies with each participant's share, premium and commission. | Sales, Processing, Accounting |
| Claims Position | Claims reported: estimate, approved, settled, age. | Sales, Processing, Operations, Claims |
| Claims Ageing | Open claims by ageing bucket. | Sales, Processing, Operations, Claims |
| Renewal Retention | Renewals due: retained, lost or pending, retention rate. | Sales, Processing, Operations, Claims |
| Remittance Summary | Remittances to insurers: gross premium, commission, net due, status. | Sales, Processing, Operations, Claims, Accounting |
| Broker Commission Statement | Commission per agent and policy: basis, rate, gross, WHT, net, paid status. | Sales, Processing, Operations, Claims, Accounting |
| Reinsurance Cession Register | Cessions per treaty and policy. | Processing, Accounting |
| SOA / Premium Receivable | Bills issued: amount, paid, balance, age. | Accounting, Sales |
| Receivables Ageing | Outstanding receivables by bucket. | Accounting, Sales |
| Collection Report | Bills due: billed, collected, balance, collection rate. | Accounting |
| Receipts Register | Official receipts with bill, policy, mode, bank, reference. | Accounting |
| Payables / Disbursement Register | Payment vouchers with approval and paid dates. | Accounting |
| Commission Receivable - Direct Bill | Commission and VAT due from insurers on direct-bill policies, with ageing. | Accounting |
| Due to Insurers by Co-insurer | Premium due to each insurer on bills of the period, split per participant: due, collected, remitted and still held. | Accounting |
| Aged Payables to Insurers | Premium payable to insurers not yet remitted, aged from the payable date. | Accounting |
| Journal Register | Journal lines with account, debit, credit, memo, status. | Accounting |
| Trial Balance, Trial Balance (Opening / Movement / Closing) | Balances per account. | Accounting |
| General Ledger Detail | Every line of an account with running balance. | Accounting |
| Income Statement, Balance Sheet | Financial statements with year to date and prior year. | Accounting |
| Month-End Close Status | Each period's close run and checklist result. | Accounting |
| VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases | BIR working papers and alphalists (Chapter 18). | Accounting |
| Bank Reconciliation Statement, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines, Bank Book | Bank reports (Chapter 19). | Accounting |
| Incentive Results | Programme target, achieved, payout per person. | Accounting, Sales |

![Reports > Financial Reports > Income Statement](rep-income)

![Reports > Financial Reports > Co-insurance Register](rep-coins)

![Reports > Financial Reports > Due to Insurers by Co-insurer](rep-due-insurers)

## Other exports

| Screen | Export |
|---|---|
| Executive Dashboard | Export Report: Production Register (XLSX) for the chosen dates. |
| Claims Dashboard | Export Report: claims data for the chosen dates. |
| Leads/Prospects | Generate Report: the lead list by category. |
| Accounting Query, All Clients Accounting | Export, Export CSV. |
| Financial Statements | Export. |
| Broker Slip, Placement Slip | Slip PDF, and the slip of one insurer. |
| Reconciliation | Print PDF. |

# Role quick guides

Each section below is a one-page summary for one role: where you land, your daily work and where to find it, the approvals you give or need, and the reports you use. The module chapters give the detail. A separate slide deck for each role is delivered with this manual.

## Sales & Marketing (Account Executive)

![Landing page of Sales & Marketing (maria.sales)](persona-maria.sales)

You land on the Executive Dashboard. Your own figures are on Dashboard > Sales Dashboard.

| Task | Where | Chapter |
|---|---|---|
| Record a prospect | Operations > Leads/Prospects > Create Lead | 5 |
| Load many prospects | Leads/Prospects > Bulk Upload | 5 |
| Quote a motor risk | Lead > Create Quote | 8 |
| Ask the Processing Team to market a commercial risk | Agree the risk details; the Processing Team prepares the Broker Slip | 7 |
| Send a quotation to the client | Quotation > Send for Customer Approval | 8 |
| Record the client's payment | Policy > Proceed to Payment | 9 |
| Follow renewals | Operations > Renewals > Renewal Queue, At-Risk Policies, Negotiations | 12 |
| Check your commission | Commission > Commission Dashboard | 15 |

Approvals: your quotations are approved by another user, and your renewal terms by the Processing Team. You do not post receipts. Reports: Production Register, Premium by Product, New Business vs Renewals, Lead Conversion Funnel, Placement Pipeline, SOA / Premium Receivable, Receivables Ageing, Incentive Results.

## Processing Team (Placement & Policy Processing)

![Landing page of the Processing Team (jose.uw)](persona-jose.uw)

You land on the Executive Dashboard. Your workbench is Dashboard > Processing Dashboard.

| Task | Where | Chapter |
|---|---|---|
| Market a risk | Operations > Broker Slips > New Broker Slip, Submit to market | 7 |
| Record offers and declines | Broker Slip > Market responses > Record response | 7 |
| Compare and choose the security | Broker Slip > Compare offers | 7 |
| Prepare the Quotation Slip | Compare offers > Prepare Quotation Slip | 7, 8 |
| Send the firm order and record confirmations | Placement Slip > Send to insurer(s), Confirm | 7 |
| Issue the policy | Placement Slip > Issue Policy, or Quotation > Proceed to Policy | 7, 9 |
| Record a policy the insurer issued | Placement Slips > Record Issued Policy | 7 |
| Complete endorsements | Endorsement > Proceed > Complete | 10 |
| Approve renewal terms | Notification, Renewals > Negotiations | 12 |
| Keep the motor tariff | Product Configurator > Product Templates | 22 |
| Treaties and cessions | Reinsurance | 20 |

Reports: Placement Pipeline, Market Response, Co-insurance Register, Production Register, Claims Position, Renewal Retention, Reinsurance Cession Register.

## Operations (Client Servicing)

![Landing page of Operations (ana.cs)](persona-ana.cs)

You land on the Executive Dashboard. Your daily worklist is Operations > Open Items.

| Task | Where | Chapter |
|---|---|---|
| Find a client and its policies | Operations > Clients | 6 |
| Raise an endorsement request | Policy > three dots > Endorsement | 10 |
| Record the client's payment | Policy > Proceed to Payment | 9 |
| Work expiring policies and pending payments | Operations > Open Items | 13 |
| Renew a policy | Operations > Renewals > Renewal Policy | 12 |
| Send documents to the client | Policy details > Documents & Billing | 9 |

Approvals: endorsements are completed by the Processing Team with the insurer's document; payments are verified by Accounting. Reports: Production Register, Claims Position, Renewal Retention, Remittance Summary, Broker Commission Statement.

## Claims

![Landing page of Claims (carlo.claims)](persona-carlo.claims)

You land on the Claims Dashboard.

| Task | Where | Chapter |
|---|---|---|
| Register a claim | Policy > three dots > Claim | 11 |
| Follow up the insurer and adjuster | Claims > eye icon > Proceed | 11 |
| Submit a settlement (maker) | Claim Settlement > Submit | 11 |
| Approve a settlement (checker) | Waiting for Settlement > Proceed | 11 |
| Print claim letters | Claim Settlement > documents | 11 |
| Register a reinsurance recovery | Reinsurance > Claims Recovery | 20 |

A second Claims user approves every settlement; you cannot approve your own. For settlements paid through the broker, tell Accounting when the insurer's funds are due, so the funds received and the payment to the claimant are recorded. Reports: Claims Position, Claims Ageing.

## Accounting

![Landing page of Accounting (liza.finance)](persona-liza.finance)

You land on the Executive Dashboard.

| Task | Where | Chapter |
|---|---|---|
| Verify payments and post official receipts | Notification, Accounts > Receipts | 9, 14 |
| Follow collections | Accounts > Collections | 14 |
| Pay commission | Commission > Agents/Referrer Accounts | 15 |
| Remit premium to insurers | Accounts > Remittance | 16 |
| Bill direct-bill commission | Accounts > Remittance > Direct Bill Processing | 16 |
| Journal vouchers and write-offs | Accounts > Journal Voucher, Open Entry Matching | 14 |
| Bank reconciliation | Accounts > Bank Reconciliation | 19 |
| Month-end close (prepare) | Accounts > Period End > Month-End Close | 17 |
| BIR reports and Form 2307 | Accounts > Tax | 18 |
| Incentive calculations | Accounts > Incentive > Calculations | 21 |

Maker-checker: another Accounting user approves your vouchers, journal vouchers, remittances, settlements, debit notes and incentive batches; the Accounting Manager approves your close runs and bank reconciliations. Reports: every financial report, Remittance Summary and Broker Commission Statement.

## Accounting Manager

![Landing page of the Accounting Manager (rosa.acctmgr)](persona-rosa.acctmgr)

The Accounting Manager has the menus of Accounting and does the same work, plus these approvals:

| Approval | Where | Chapter |
|---|---|---|
| Approve or reject a month-end close | Accounts > Period End > Month-End Close > run > Approve | 17 |
| Close the year and reverse a year-end close | Accounts > Period End > Year-End Close | 17 |
| Reopen a closed period, soft-close and close periods | Accounts > Period End > Period Management | 17 |
| Post into a soft-closed period | Any posting screen | 17 |
| Approve or reopen a bank reconciliation | Accounts > Bank Reconciliation > Reconciliations | 19 |
| Approve vouchers, journals, remittances and incentive batches of other users | The approval screens of each module | 14, 16, 21 |

You cannot approve what you prepared yourself. Review the Month-End Close Status report and the reconciliation statements before you approve.

## System Administrator (Super Admin Access)

![Landing page of the System Administrator (bea.admin)](persona-bea.admin)

You see every menu. Keep this role for administration and use a business role for daily work.

| Task | Where | Chapter |
|---|---|---|
| Users, roles, unlock, reset password | Master > Generals > User Management | 23 |
| Company and letterhead | Master > Generals > Organization > Company | 23 |
| Insurers and credit terms | Master > Generals > Insurance Management > Insurance Company | 23 |
| Master uploads | The Upload button of each master; templates in `docs/package/05_Delivery/Upload_Templates` | 23 |
| Document numbering | Master > Document Numbering | 23 |
| Commission rates | Master > Finance > Commission Rate Matrix | 23 |
| Posting rules and account determination | Master > Finance > Posting Rules, Account Determination | 23 |
| Business settings | Master > Configuration | 23 |
| Schedules | Master > Schedules | 23 |
| Audit | Master > Audit Trail | 23 |

Before go-live: set the company and letterhead, the SMTP mailbox (Office 365), the numbering of official receipts to match the Authority to Print, the security settings and the roles that must use two-step verification.

# Appendices

## Appendix A. Status reference

| Record | Statuses in order |
|---|---|
| Lead | New, Contacted, Qualified, QuoteGenerated, Converted; Lost |
| Broker Slip | Draft, Submitted, Responses in, Closed; Cancelled |
| Insurer offer | Pending, Offered, Declined |
| Quotation | Draft, Pending Customer, Customer Accepted, (Submitted to Insurer, Approved), Converted to Policy; Rejected, Dropped, Expired |
| Placement Slip | Draft, Sent to insurer, Bound, Policy issued; Declined, Cancelled |
| Policy | Active, then Expired, Renewed, Lapsed or Cancelled |
| Policy payment | Pending, Reviewing, Partial, Completed; Refunded |
| Endorsement | Draft, Pending Customer, Completed; Initiate Cancel, Cancelled, Rejected |
| Claim | Pending, Processing, Pending Approval, Approved, Settled, Closed; Rejected |
| Commission line | Accrued, Eligible, Approved, Paid; Reversed |
| Payment voucher | Draft, For approval, Approved, Paid; Cancelled |
| Journal voucher | Draft, Awaiting approval, Posted; Rejected |
| Remittance | Draft, Pending Approval, Approved, Completed; Rejected, Cancelled |
| Debit note | Draft, Pending Approval, Open, Partially Collected, Collected; Rejected, Cancelled |
| Accounting period | Open, Soft-closed, Closed, Locked |
| Month-end close run | Draft, In Progress, Submitted, Approved (period closed); Rejected, Cancelled |
| Bank reconciliation | Draft, Prepared, Approved; Reopened |
| User | Active, Inactive, Locked |

## Appendix B. Number series

Numbers follow the format of their series on Master > Document Numbering. The delivered format is {PREFIX}-{YYYY}-{SEQ} with five digits, for example POL-2026-00001, restarting every calendar year.

{widths: 14,40,46}
| Prefix | Document | Issued when |
|---|---|---|
| LD | Lead | A lead is saved |
| BS, OFR | Broker Slip, insurer offer | A Broker Slip is saved; an insurer is added to it |
| QT | Quotation | Completed Quote, or Prepare Quotation Slip |
| PS | Placement Slip | A Placement Slip is prepared or created |
| POL | Policy | The policy is issued or recorded |
| CL | Client code | The first policy of a client is issued |
| INV | Invoice / bill | Policy issue, endorsement or renewal with premium |
| OR, RT | Official receipt, receipt transaction | A receipt is posted or a payment confirmed |
| PV, DT, IL | Payment voucher, disbursement transaction, payable | A voucher, payout or insurer payment is created |
| JV | Journal voucher | Every journal, manual or system |
| END | Endorsement | An endorsement is saved |
| CLM | Claim | A claim is registered |
| REM, BLK, SET | Remittance, remittance batch, settlement | On the remittance screens |
| DN, DNC | Commission debit note, debit note collection | Direct bill processing |
| MEC, YEC, RJV | Month-end close, year-end close, recurring journal | Period end |
| BST, BRC | Bank statement, bank reconciliation | Bank reconciliation |
| CWT | BIR Form 2307 | A certificate is issued |
| RN, RB, RQ, WB | Renewal, renewal batch, renewal quotation, win-back campaign | Renewal screens |
| CES, RCL, REC, BDX, TRT, RE | Reinsurance cession, recovery, reconciliation, bordereau, treaty, reinsurer | Reinsurance screens |
| PC, PCR, PCRC | Petty cash transaction, request, receipt | Petty cash screens |
| INC, CALC | Incentive programme, calculation batch | Incentive screens |
| ADJ, BIL, BNK, EXC, NTF, RPT, SCH, STMT, TRF | Remittance adjustment, bill, bank transaction, exception, notification, report, schedule, statement, transfer | Remittance screens |
| TPL | Product template | Product Configurator |

## Appendix C. Key configuration settings

All settings are on Master > Configuration unless noted. Changes apply at once and are audited.

{widths: 38,22,40}
| Setting | Delivered value | Effect |
|---|---|---|
| `general.timezone`, `general.date_format` | Asia/Manila, DD/MM/YYYY | Business time zone and date format. |
| `placement.journey` | see Chapter 3 | Steps each line must, may or does not use. |
| `placement.offer_validity_days` | 30 | Default validity of an insurer offer. |
| `placement.journey_applies_to_renewals` | off | Whether renewals follow the placement journey. |
| `tax.vat_rate`, `tax.dst_rate`, `tax.lgt_rate`, `tax.fst_rate` | 12%, 12.5%, 0.75%, 2% | Fallback only: used when Premium Taxes & LGU Rates has no rule of that tax. |
| `limits.quote_validity_days` | 30 | Quotation validity. |
| `quotations.approval_link_ttl_hours` | 168 | Validity of the client's approval link. |
| `quotations.approval_notify_roles` | processing | Roles notified of quotations sent to clients. |
| `workflow.quote_maker_checker` | on | A quotation cannot be approved by its creator. |
| `commission.default_rate` | 15% | Brokerage when neither the matrix nor the insurer has a rate. |
| `commission.wht_code_by_type` | Agent WI515, Sub-agent WI515, External WC515 | Withholding tax code on comsub (rate from Master > Finance > Taxation). |
| `commission.eligible_roles`, `incentive.eligible_roles` | sales | Who earns commission and incentives. |
| `commission.require_full_payment`, `commission.require_bank_account` | on | When commission can be paid. |
| `direct_bill.default_billing_mode` | broker | Default billing mode. |
| `collections.default_credit_days`, `remittance.default_due_days` | 30, 30 | Credit terms when the insurer has none. |
| `finance.maker_checker_enabled`, `journal.require_approval` | on | Approver differs from maker; manual journals need approval. |
| `accounting.period_close_requires_approval` | on | The Accounting Manager approves the month-end close. |
| `accounting.fiscal_year_start_month` | 1 | First month of the fiscal year. |
| `accounting.split_premium_taxes` | on | VAT, DST and LGT on premium in their own accounts. |
| `bank_reconciliation.date_window_days` | 5 | Date window of the amount and date matching rule. |
| `bank_reconciliation.stale_cheque_days` | 180 | Age of a stale cheque. |
| `bank_reconciliation.require_balanced_statement`, `bank_reconciliation.auto_match_on_import` | on, on | Statement import checks. |
| `bir.withholding_agent_tin`, `bir.registered_name`, `bir.registered_address`, `bir.zip_code` | empty | Broker details on the BIR forms. Fill in before the first filing. |
| `claims.settlement_maker_checker`, `claims.block_unpaid_premium`, `claims.sla_days` | on, on, 20 | Claims controls. |
| `renewals.pipeline_days`, `limits.renewal_notice_days`, `renewals.grace_period_days` | 90; 60, 30, 15; 30 | Renewal timetable. |
| `remittance.approval_levels` | 100,000; 1,000,000; above | Fallback approval levels, used only while the Authority Matrix has no remittance limit. |
| `limits.receivable_ageing_buckets` | 30, 60, 90, 120 | Ageing buckets. |
| `security.password_min_length`, `security.password_history_count`, `security.password_max_age_days` | 8, 5, 90 | Password rules. |
| `limits.max_login_attempts`, `limits.session_idle_minutes` | 5, 30 | Lockout and idle sign-out. |
| `security.require_2fa_roles` | none | Roles that must use two-step verification. |
| `notification.email_enabled` | as set at go-live | Sends queued e-mails through the Office 365 mailbox. |
| `housekeeping.*` | see Appendix D | Retention of logs and queues. |

## Appendix D. Scheduled jobs

Times are Manila time (`general.timezone`).

{widths: 28,22,50}
| Job | When | What it does |
|---|---|---|
| Policy expiry | Daily 00:15 | Marks policies past their expiry date as Expired. |
| Quotation expiry | Daily 00:30 | Expires quotations older than their validity. |
| Accrual auto-reversal | Day 1 of the month, 00:30 (off) | Reverses accruals, commission deferrals and FX revaluations of the previous period. |
| Recurring journals | Daily 01:15 (off) | Posts recurring journal templates whose next run date has come. |
| Period auto soft-close | Daily 02:00 (off) | Soft-closes ended periods after a grace period when no blocking check fails. |
| Housekeeping | Daily 02:45 | Deletes expired sign-in tokens and reset codes and old job runs, read notifications, sent e-mails and sign-in history after their retention days (`housekeeping.*`). The audit trail is kept. |
| Daily reports | Daily 05:00 | Produces the Production Register, Collection Report and Claims Position. |
| Renewal pipeline | Daily 05:30 | Enrols policies expiring within 90 days; lapses renewals past the grace period. |
| Bank reconciliation auto-match | Daily 05:45 (off) | Runs the matching rules on every bank account with unmatched lines. |
| Renewal notices | Daily 06:00 | Creates the 60, 30 and 15-day renewal notices. |
| Receivable ageing | Daily 07:00 | Recomputes the ageing buckets of open receivables. |
| Collection reminders | Daily 08:00 | Reminds clients of premium falling due. |
| Month-end close reminder | Daily 08:00 (off) | Reminds Accounting before a period ends and about ended periods still open. |
| E-mail outbox | Every 5 minutes | Sends queued e-mails. |
| Renewal notice queue | Every minute | Sends queued renewal notices. |

Jobs marked off are delivered switched off. Switch on those Accounting wants on Master > Schedules.

## Appendix E. Glossary

{widths: 24,76}
| Term | Meaning |
|---|---|
| Account role | A name for the purpose of an account (for example commission income) that a posting rule uses. Account Determination maps each role to a GL account. |
| APPA | Auto Passenger Personal Accident: personal accident cover for the driver and passengers, priced per seat. |
| ATC | Alphanumeric Tax Code of the BIR, for example WI139. |
| BIR Form 2307 | Certificate of Creditable Tax Withheld at Source. |
| Billing mode | Broker billed (the client pays the broker) or direct bill (the client pays the insurer). |
| Bound | All insurers of a Placement Slip have confirmed their shares. |
| Broker Slip | The risk presented to several insurers with a request for quotation. |
| Brokerage | The commission the insurer pays the broker. |
| Co-insurance | Several insurers share one risk, each for a percentage, under one lead insurer. |
| Comsub | Commission share paid by the broker to an agent or referrer. |
| CTPL | Compulsory Third Party Liability, required for LTO registration, at the Insurance Commission tariff. |
| Debit note | The broker's bill to an insurer for commission on direct-bill policies. |
| DST, LGT, FST | Documentary stamp tax, local government tax, fire service tax. |
| EWT | Expanded withholding tax. |
| IAR | Industrial All Risks. |
| KYC | Know Your Customer: verification of the client's identity with a government ID. |
| Lead insurer | The insurer that leads a co-insurance and whose terms apply. |
| Maker-checker | The maker enters, a different user approves. |
| Placement Slip | The firm order to the lead insurer and co-insurers. |
| Posting rule | The recipe that turns a business event into journal lines. |
| QAP, SAWT, SLSP | BIR alphalists: Quarterly Alphalist of Payees, Summary Alphalist of Withholding Taxes, Summary List of Sales and Purchases. |
| Quotation Slip | The terms offered to the client, priced with taxes and commission. |
| Remittance | Payment of collected premium, net of commission, to the insurer. |
| Soft-closed | A period that accepts postings only from the Accounting Manager. |
| Stale cheque | A cheque not cleared within 180 days of issue. |
| TIN | Tax Identification Number. |

## Appendix F. Troubleshooting

{widths: 36,64}
| Message or problem | What to do |
|---|---|
| Not authorised | The screen is not part of your role. Use your menu, or ask the System Administrator whether your role is right. |
| Account locked. Contact the administrator | Ask the System Administrator to unlock your user. |
| Too many sign-in attempts | Wait 5 minutes, then sign in again. |
| The authentication code is refused | Use the current code; check that the phone's clock is set automatically. |
| You were signed out | 30 minutes without activity. Sign in again. |
| The journey of the line does not allow this step | The line requires another step (Chapter 3). For fire and IAR, create the Placement Slip before issuing. |
| Shares must total exactly 100% | Correct the shares of the participants, with exactly one lead. |
| The policy cannot be issued from the Placement Slip | An insurer has not confirmed yet, or your role cannot issue policies. |
| Issuance refused for missing KYC or vehicle identifiers | Complete ID type, number and image, chassis, motor and plate or MV file number. |
| Date of loss ... is outside the policy period | Check the date of loss and the policy. |
| Accounting period ... is soft-closed | Date the entry in an open period, or ask the Accounting Manager. |
| Accounting period ... is closed | Ask the Accounting Manager to reopen the period, with remarks. |
| Journal voucher refused: debit ... vs credit ... | Correct the lines until they balance. |
| Approval refused for the maker | Ask another user to approve. |
| This file was already imported | The bank statement was imported before. Delete the wrong statement first if needed. |
| Opening balances refused: journals already posted | Choose a go-live date before any posting in that fiscal year, or ask support. |
| Commission payout blocked: no bank account | Add the referrer's bank details. |
| E-mails are not received | Check that "Send e-mails" is on (Master > Configuration > Notification) and the E-mail outbox job ran. |
| Something went wrong on this screen | Select Reload screen. If it persists, report the screen, the time and the request ID to support. |

## Appendix G. Known limitations in this release

- The sign-in session is kept in the browser's local storage. Sign out on shared computers and keep the browser up to date.
- Filipino is configured as a language but has no translation of the screens yet, so it is not offered and no language box is shown.
- Sign-in and request limits are counted per application server. With several servers, add a limit at the load balancer.
- Some database queries use the database's own date. The database time zone must be Asia/Manila.
- Several masters have no Upload button yet (Company, Branch, Department, Line of Business, Product, Cover, Signatories, Exchange Rate, Commission, Employee Management, Write-off reasons). Their templates are loaded by the System Administrator through the API route on the template.
- The BIR reports give the figures in the BIR column order; check them against the current BIR format before filing.
- The Settlement cash panel of a claim paid through the broker is on the claim screens, which are not in the Accounting menu. Until the menu is extended, the System Administrator records the funds received and the payment to the claimant.
- The Company master list opens with one empty row. Type in the search box to list the companies; view and edit work from the search result.
- A settlement is marked as paid through the broker by its settlement type or through the API; the settlement form offers Cash, Card and Cheque only.

## Appendix H. Support

| Level | Who | For |
|---|---|---|
| First line | The key user of your team | How-to questions; checking that a role or setting is not the cause. |
| Second line | Your System Administrator | Users, roles, passwords, two-step verification resets, settings and master data. |
| Third line | iorta TechNXT production support | Anything else, raised by the System Administrator through the channel in the support agreement. |

When you report a problem, give the menu path, the record number (for example PS-2026-00001), the time to the minute, your user ID, the message and the request ID shown in the error. Never send a password or a two-step code.

