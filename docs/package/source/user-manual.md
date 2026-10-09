---
title: User Manual
subtitle: BrokerVerse OOTB, by persona
version: 1.2.4
date: 09 October 2026
prepared: iorta TechNXT
change: Version 1.2.4 (09 October 2026): Reinsurance and the Compliance menu withdrawn (AML/CFT programme, Insurance Commission registers, complaints and breach registers, the Compliance Officer role); client onboarding keeps the identification, signatories, beneficial owners and KYC documents. Version 1.2.3 (04 October 2026): Home is the role-aware landing page built on My Work (presets per role, role figures, the new My Work categories of the compliance officer, accounting manager and system administrator); the Home dashboard and Open Items sections withdrawn. Version 1.2.2: Client brand packs: basis is the client's contract with iorta TechNXT (management decision of 04 October 2026). Version 1.2.1: release figures aligned (eight roles on the Role screen). Version 1.2 (release 1.1): Theme and Branding, the menus of every persona as delivered, My Work, the Compliance Officer with the Insurance Commission registers, the complaints register and the breach register, the operational masters, Help panel sections for every screen, screenshots recaptured
reviewed:
approved:
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; LTO=Land Transportation Office; RFQ=Request for quotation; CTPL=Compulsory third party liability; DST=Documentary stamp tax; LGT=Local government tax; LGU=Local government unit; FST=Fire service tax; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; OR=Official receipt; SOA=Statement of account; PV=Payment voucher; JV=Journal voucher; GL=General ledger; DN=Debit note; KYC=Know your customer; TIN=Taxpayer identification number; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; IAR=Industrial all risks; PA=Personal accident; APPA=Auto passenger personal accident; SoD=Segregation of duties; PEP=Politically exposed person; NPC=National Privacy Commission; COC=Certificate of cover; PDC=Post-dated cheque; LOA=Letter of authority; EIS=Electronic Invoicing System; CAS=Computerized accounting system; WCAG=Web Content Accessibility Guidelines
---

# About this manual

## Purpose

BrokerVerse OOTB is the insurance broking system of iorta TechNXT for non-life brokers in the Philippines. One system covers the whole broking cycle: prospects, requests for quotation to insurers, quotations, placement, policy issue, billing and collection, remittance to insurers, commission, endorsements, claims, renewals, the general ledger, bank and insurer reconciliation, the month-end and year-end close and the BIR returns.

This manual tells each user how to do his or her work in BrokerVerse. It is organised by persona: each persona chapter lists the menus of the role, the daily and periodic tasks, and the step-by-step procedure for every screen the role uses, with the fields, the rules the system applies, the buttons, the status that results and what the system does next (the bill, the receipt, the journal, the notification) and where to find the record afterwards.

## How the manual is organised

| Chapter | Content |
|---|---|
| Getting started | Signing in, passwords, two-step verification, the screen layout, notifications, My Profile and account security, lists, forms, statuses and approvals, the audit trail. |
| The business process end to end | The broking cycle from prospect to reports, with who does each step and on which screen. |
| One chapter per persona | System Administrator; Sales & Marketing (Account Executive); Processing Team; Operations (client servicing); Claims; Accounting; Accounting Manager. |
| Go-Live Data Load | The configuration and migration workbooks the System Administrator loads before go-live. |
| Distribution, programmes and products | Lead assignment, distribution channels, dealer programmes, fleet schedules, marine open covers, comparison reports, campaigns and the Report Builder: screens shared by Sales, Processing and Operations. |
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

> The screenshots were taken on 03 and 04 October 2026 from a BrokerVerse OOTB test system loaded with realistic data: 61 prospects, 72 quotations, 48 requests for quotation, 23 placement slips, 82 policies, 8 claims and six months of accounting. The users in the screenshots are named staff of that test system, one or two per role. Your screens show your own data, and your menu shows only the items of your role.

# Getting started

## Signing in

Every person has his or her own user ID. Never share a user ID or a password: every action is recorded against the user in the audit trail.

![The sign-in page](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-login.png)

1. Open the BrokerVerse address given by your System Administrator in Chrome, Edge or Firefox. The sign-in page shows an illustration on the left and the sign-in panel on the right, with the logo and name set on Master > System Settings.
2. In **User ID**, type your user name, for example maria.rivera.
3. In **Password**, type your password. Select the eye icon to show the password while you type; select it again to hide it.
4. Select **Sign in**.

A language box appears at the top of the panel only when more than one screen language is offered. The delivered system offers English, so there is no language box.

BrokerVerse opens your landing page: the first dashboard your role may open, or the first screen of your menu. One more step can follow the password, in the same panel:

| Screen after the password | When it appears |
|---|---|
| **Change password** | You signed in with a temporary password, an administrator has reset your password, or your password is older than 90 days (`security.password_max_age_days`). |
| **Two-step verification** | Two-step verification is on for your user. |
| **Set up two-step verification** | Your role must use two-step verification (`security.require_2fa_roles`) and you have not set it up yet. |

If your session ended while you were away (your password was changed, your account was updated or you signed in elsewhere), the sign-in page says so above **User ID**: sign in again.

### Password rules

The rules come from the security settings. With the delivered settings a password must:

- have at least 8 characters (`security.password_min_length`);
- contain an upper-case letter (A-Z), a lower-case letter (a-z), a digit (0-9) and a symbol, for example ! @ # $;
- differ from your last 5 passwords (`security.password_history_count`).

Every screen where you choose a password lists these rules under **New password** and ticks each rule as soon as the new password meets it. The last rule is checked by the server when you save.

### Change your password at sign-in

When BrokerVerse asks for a new password after the password step, the panel shows **Change password** with the reason under the title: **You must choose a new password before you continue.** or, for an expired password, **Your password has expired. Choose a new one to continue.**

![Change password at sign-in, with the rules ticked as the new password meets them](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-change.png)

1. In **Current password**, type the password you signed in with.
2. In **New password**, type the new password and check that every rule is ticked.
3. In **Confirm new password**, type it again.
4. Select **Change password and continue**. **Back to sign in** returns to the sign-in panel without a change.

To change your password at any other time, see My Profile and account security below.

### Forgotten password

1. On the sign-in page, select **Forgot password?** on the line of the **Password** label.
2. On **Reset your password**, type your **User ID or e-mail address** and select **Send code**. If the account exists and has an e-mail address, BrokerVerse e-mails a 6-digit code to it. The message on screen is the same whether or not the account exists.
3. On **Enter the verification code**, type the code in **Verification code (from the e-mail)**, then the **New password** and **Confirm new password**, and select **Reset password**. **Send a new code** sends another code if the first one did not arrive.
4. BrokerVerse returns to the sign-in panel with the message **Password reset. Sign in with your new password.** Sign in with the new password.

![Forgot password: Reset your password](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-forgot.png)

![Forgot password: Enter the verification code](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-forgot-code.png)

**Back to sign in** leaves the reset at any step. The code is valid for 15 minutes (`security.reset_code_minutes`) and is withdrawn after 5 wrong entries (`security.reset_code_max_attempts`). If your user has no e-mail address, or e-mail sending is not switched on, ask the System Administrator to reset your password.

### Failed sign-ins and locked accounts

A wrong user ID or password shows a message in red above the **Sign in** button. After 5 failed attempts in a row the user is locked (`limits.max_login_attempts`). The system also allows only 10 sign-in attempts in 5 minutes per computer and per user name (`security.login_rate_limit`). A locked user asks the System Administrator to unlock the account (System Administrator chapter, Users).

### Two-step verification at sign-in

Two-step verification adds a 6-digit code from an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator. When it is on for your user, the panel shows **Two-step verification** after the password.

![Sign-in: Two-step verification](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-2fa.png)

1. Open the authenticator app and find the BrokerVerse entry.
2. Type the current 6-digit code in **Authentication code**.
3. Select **Verify**. A wrong or expired code shows **The code is not valid. Try the current code.**; type the code the app shows now.

The page waits 5 minutes for the code (`security.two_factor_challenge_minutes`); after that, select **Back to sign in** and sign in again. If your role requires two-step verification and you have not set it up, the panel shows **Set up two-step verification** with the subtitle **Your role requires two-step verification. Set it up to continue.** and the same set-up steps as in Set up two-step verification below; after **Turn on** you are signed in. **Cancel** returns to the sign-in panel.

![Sign-in: Set up two-step verification, required by the role](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-2fa-setup-signin.png)

### Automatic sign-out

After 30 minutes without activity BrokerVerse signs you out (`limits.session_idle_minutes`). Anything not saved on the screen is lost, so save before you leave your desk. Your session also ends when your password is changed or reset, when your user is deactivated and when your role changes. To sign out yourself, select your initials at the top right, then **Sign out**.

## The screen layout

![Screen layout: sidebar on the left with the search menu; the notification bell and your initials at the top right; the work area](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-layout.png)

| Area | What it does |
|---|---|
| Logo and name | The logo and application name set on Master > System Settings. |
| **Search menu...** | Type part of a screen name, for example quot. The list shows each matching screen of your menu with its path; select one to open it. |
| Sidebar menu | The menus of your role, in business order: Home, Dashboard, Operations, Accounts, Commission, Reports, Master, Product Configurator. Select a menu to open its items; the menu you used last stays open. Master lists its screens under headings (Organization, Insurance, Location, Employees, Users and Access, Finance, System, Data Privacy, Go-Live and Data). A shortened name shows in full when you point at it. Press **/** to jump to **Search menu...**. |
| Notification bell | The red badge shows the number of unread notifications, up to 99; above that it shows 99+. Select the bell to see the latest. |
| Your initials | The initials of your display name in a circle. Select them for the account menu. |
| Work area | The screen you opened, with its title and the breadcrumb (for example Operations • Prospects). |

The top bar shows a language box only when more than one screen language is offered.

![Menu search: typing "quot" lists the quotation screens of the role](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-menu-search.png)

### The account menu

Select your initials at the top right. The menu shows your initials, your display name and your role, then:

| Item | What it does |
|---|---|
| **Profile** | Opens My Profile (see My Profile and account security). |
| **Change password** | Opens the **Change password** dialog. |
| **Two-step verification** | Opens the **Two-step verification** dialog: see whether it is on, turn it on or off. |
| **Help** | Opens the Help panel on the right: **Help for this screen** (the section of this manual for the screen you are on), **Download user manual (PDF)**, the support desk's e-mail, telephone and hours, **Raise a support ticket**, the keyboard shortcuts and **About BrokerVerse** (version, environment, build date). **F1**, or **?** outside a text box, opens it from any screen. |
| **Sign out** | Ends your session and returns to the sign-in page. |

![The account menu under your initials](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-profile.png)

![The Help panel: Help for this screen, the manual, the support desk and About BrokerVerse](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-help.png)

### Notifications

BrokerVerse notifies you when something needs your action or concerns your work: a quotation sent for approval, a premium payment to verify, a new claim, a settlement waiting for approval, a renewal notice sent, a close run to approve. Approval requests go only to users who may approve them.

Select the bell. The **Notifications** panel shows the number unread and your six latest notifications, newest first, each with its title, message, date and time. A blue dot marks an unread notification.

- Select a notification to mark it as read.
- Select the X on a notification to remove it.
- Select **Mark all as read** to clear the badge.
- Select **View all notifications** for the full **Notification** page, which lists every notification with its title, message, type (Info, Task, Approval, Reminder and others), priority and time.

![The Notifications panel under the bell](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-bell.png)

![The Notification page](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-notif-page.png)

## My Profile and account security

### My Profile

Select your initials, then **Profile**. **My Profile** (breadcrumb Home • My Account • My Profile) has two parts.

![My Profile: the account summary](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-my-profile.png)

The account summary at the top shows your initials, display name, status (**Active**), **User ID**, and **Role**, **Branch**, **Designation**, **Reporting to**, **E-mail address** and **Last sign-in**. The System Administrator maintains these on Master > Users and Access > User; you cannot change them here. The buttons **Change password** and **Two-step verification** open the same dialogs as the account menu.

**Personal and contact details** shows your details in three groups:

| Group | Fields |
|---|---|
| Personal information | **First name** (required), **Last name**, **Display name** (required; shown in the top bar, on approvals and in the audit trail), **Employee No.** (maintained by the System Administrator), **Date of birth**, **Gender** (Male, Female, Other, Prefer not to say) |
| Contact | **E-mail address** (maintained by the System Administrator), **Contact number** |
| Address | **House No. / Unit No. / Street**, **Barangay / Subdivision**, **City / Municipality**, **Province**, **ZIP code**, **Country** |

To change them:

1. Select **Edit Profile**. The fields you may change open for editing; fields marked * are required.
2. Correct the fields. The address lists work from the top down: choose **Country** (Philippines by default), then **Province**, then **City / Municipality**, then **Barangay / Subdivision**. Each list offers the names of the address masters and also accepts a name you type. Choosing a barangay fills an empty **ZIP code** with its postal code.
3. Select **Save changes**. BrokerVerse shows **Your profile has been updated.** and the new display name appears at once in the top bar. **Cancel** closes the form without saving.

![My Profile in edit mode](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-my-profile-edit.png)

| Message | Meaning |
|---|---|
| Enter your first name. / Enter the name to display. | **First name** or **Display name** is empty. |
| Enter a Philippine number, for example 0917 123 4567 or (02) 8123 4567. | The contact number is not a Philippine mobile (0917 123 4567 or +63 917 123 4567) or landline with area code. |
| Enter a valid date of birth in the past. | The date of birth is in the future or not a date. |
| A Philippine ZIP code has 4 digits. | The ZIP code of a Philippine address does not have 4 digits. |

### Change password

Select your initials, then **Change password** (or **Change password** on My Profile).

![Change password](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-change-pw.png)

1. In **Current password**, type your present password.
2. In **New password**, type the new password and check that every rule is ticked.
3. In **Confirm new password**, type it again.
4. Select **Change password**. BrokerVerse shows **Password changed. Your other sessions have been signed out.** Other computers and browsers where you are signed in are signed out; your current session continues. **Cancel** closes the dialog without a change.

### Set up two-step verification

Any user can turn on two-step verification. The System Administrator can make it compulsory for roles with `security.require_2fa_roles`; no role requires it in the delivered set-up. iorta TechNXT recommends it for the System Administrator, Accounting and Accounting Manager roles.

1. Select your initials, then **Two-step verification** (or **Two-step verification** on My Profile). The dialog says **Two-step verification is off.**
2. Select **Turn on**.
3. Install an authenticator app on your phone if you do not have one.
4. In the app, add an account and scan the QR code. If you cannot scan it, type the setup key shown under **Can't scan? Enter this key instead:** (the copy icon copies it). On the phone itself you can open the key in the authenticator app with the link under the key.
5. Type the 6-digit code the app now shows in **Authentication code** and select **Turn on**. BrokerVerse shows **Two-step verification is on.** **Cancel** returns to the status without turning it on.

![Two-step verification is off](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-2fa-status.png)

![Set up two-step verification: QR code and setup key](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-2fa-enrol.png)

From then on the sign-in page asks for the code after the password. To turn it off, open **Two-step verification** again, select **Turn off**, type a current code from the app and confirm with **Turn off**. A role that requires it cannot turn it off: the dialog says **Your role requires two-step verification, so it cannot be turned off.** If you lose your phone, the System Administrator turns it off for your user (Master > Users and Access > User, account actions) and you set it up again.

## Roles and menus

Your role decides which menus you see and which screens you may open. The server checks the same permissions on every request, so a screen missing from your menu is refused even if its address is typed in.

| Persona (role) | Users in the screenshots | Top-level menus |
|---|---|---|
| System Administrator (Super Admin Access) | BrokerVerse, beatriz.lacson | Every menu |
| Sales & Marketing (Account Executive) | maria.rivera, paolo.dizon | Dashboard, Operations, Commission, Reports, Master (Distribution Channels), Product Configurator |
| Processing Team (Placement & Policy Processing) | jose.bernardo, rica.fernandez | Dashboard, Operations, Reports, Master (Distribution Channels), Product Configurator |
| Operations (Client Servicing) | ana.buenaventura | Dashboard, Operations, Reports, Master (Distribution Channels, Data Privacy), Product Configurator |
| Claims | carlo.estrada, joy.macaraeg | Dashboard, Operations, Reports, Master (Claim Document Checklist, Repair Shops) |
| Accounting | liza.quiambao, nestor.pangilinan | Dashboard, Operations, Accounts, Commission, Reports, Master |
| Accounting Manager | teresa.villaroman, ramon.almario | The menus of Accounting |

Each persona chapter lists the exact items of each menu. The Accounting Manager holds the Accounting role as well, so the menus are the same; the difference is in the approvals.

### TISPH roles

The TISPH roles follow the RBAC v4 sheet of the Pre-BSM workbook: thirteen TIS personas and SUPERID for user acceptance testing. Each starts from the menus of the broker role closest to it; the permissions decide what the role may change. Sales and Operations both raise quotations, placement slips, policies, endorsements and renewals; the approval is always another user's who holds the approval permission (**approve:quotations** approves a quotation, **approve:policies** decides the check of a placement against the slip, **approve:renewals** approves renewal terms, **approve:claims** takes the claim decisions: review, reject, settle, approve a settlement, close).

| Role | Code | May change | Approves (never own work) | Menus |
|---|---|---|---|---|
| TIS Sales Associate | `tis-sales-associate` | Prospects, clients, quotations, placement slips, policies, endorsements, renewals, sales activities, data privacy requests | Nothing | Those of Sales & Marketing, plus Accounts (Receipts, Collections) to read |
| TIS Sales Officer | `tis-sales-officer` | As the Sales Associate, plus lead assignment and campaigns | Quotations, placement checks, renewal terms | As the Sales Associate |
| TIS Sales Unit Head | `tis-sales-unit-head` | As the Sales Officer, plus telesales incentives | As the Sales Officer, plus supplier invoices | As the Sales Associate, plus Disbursement, Payables and Incentive |
| TIS Operations Associate | `tis-ops-associate` | Quotations, placement slips, policies, endorsements, renewals, claims (register, follow up, documents), fleet schedules, open covers | Nothing | Operations, claim screens and masters, Accounts (Receipts, Collections) to read |
| TIS Operations Officer | `tis-ops-officer` | As the Operations Associate | Nothing | As the Operations Associate, plus Journal Voucher and Fixed Assets to read |
| TIS Operations Unit Head | `tis-ops-unit-head` | As the Operations Associate | Quotations, placement checks, renewal terms, claim decisions, supplier invoices | As the Operations Officer, plus Disbursement and Payables |
| CCD-PDU (Post-Dated Cheques) | `tis-ccd-pdu` | Post-dated cheques and receipts | Nothing | Post-Dated Cheques, Receipts, cash reports |
| CCD-PDC / CCD-ADA | `tis-ccd-pdc` | Post-dated cheques and receipts | Nothing | As CCD-PDU, plus Collections, Bank Reconciliation and Insurer Reconciliation to read |
| CCD-BP / QRPh (Receipting) | `tis-ccd-bp` | Receipts and collections | Nothing | As CCD-PDC |
| CCD-Recon (Reconciliation and Reversals) | `tis-ccd-recon` | Receipts (reversals), collections (adjustments), bank and insurer statement reconciliation | Insurer statement reconciliations | As CCD-BP, plus Open Entry Matching and Unmatching, Disbursement |
| TIS Finance & General Accounting | `tis-finance` | Commission, remittance, disbursements, journal vouchers, payables, fixed assets, period end, bank reconciliation | Supplier invoices, period close, bank reconciliations, posting rule changes, credit control | Those of Accounting, plus Audit Trail and Schedules |
| TIS IT AppSupport / Admin | `tis-it-admin` | Users, roles, access control, settings, reference masters, product configurator, schedules and interfaces; no business transaction | Authority limits | Master (without Go-Live Data Load and Data Privacy), Product Configurator; business screens to read |
| TIS General Manager | `tis-general-manager` | Prospects to claims, as the Sales Unit Head and the Operations Unit Head together | Quotations, placement checks, renewal terms, claim decisions, supplier invoices | Every front-office and accounting screen; User Management and Audit Trail to read |
| SUPERID (UAT only) | `tis-superid` | Everything: the role includes the System Administrator | Everything | Every menu |

The persona the RBAC v4 screen matrix calls CCD-PDC is called CCD-ADA in its department table; the one role carries both names until TISPH confirms one. The Corporate Sales Officers of the user list take the Sales Officer role. SUPERID is for user acceptance testing: set the role **Inactive** on Master > Users and Access > Role before go-live, and its users lose every access at once. Only a System Administrator may give SUPERID to a user or change the role, as for the System Administrator role itself.

If you open the address of a screen your role may not use, BrokerVerse shows that you are not authorised. Choose a screen from your menu instead.

![A Claims user opening Accounts > Receipts by its address](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-not-auth.png)

## Working with lists

Most screens open on a list. The lists work the same way everywhere:

- **Search**: type in the search box above the list. Some lists have a field selector next to the box (for example **Policy Number**) that sets which column is searched.
- **Filters**: select **Show Filters** where offered, choose the values (status, product, insurer, dates, amounts) and select **Apply Filters**. **Clear Filters** removes them; **Hide Filters** closes the panel.
- **Tabs and cards**: many lists have status cards or tabs at the top (for example **Motor**, **Personal Accident** and **Product not yet tagged** on Prospects). Select a card or tab to narrow the list.
- **Sorting**: select a column heading to sort by it; select it again to reverse the order.
- **Paging**: lists are paged by the server, 20, 50 or 100 rows per page (**Rows per page**). Use the arrows at the bottom right (first, previous, next, last page). The text next to the arrows shows the rows on screen and the total, for example 1 - 20 of 82. Search and filters apply to the whole list, not only to the page on screen.
- **Row actions**: at the end of the row. The arrow or eye opens the record, the pencil edits it, the three dots (**More actions**) open the other actions. An action that does not apply to the row is greyed out.
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

Every record carries a status that tells where it is in its life: a quotation goes from Draft to Pending Customer to Customer Accepted to Converted to Policy; a placement slip from Placement raised to Sent to insurer, Acknowledged, e-Policy received, Checked against slip and Insurer issued (Booked). The persona chapters give the statuses of each record and the module reference lists them all.

Maker-checker means that the user who enters a transaction cannot approve it. BrokerVerse refuses the approval with a message when the maker tries, and notifies the users who may approve. The maker-checker points are:

| Transaction | Maker | Checker | Setting |
|---|---|---|---|
| Quotation approval | The creator of the quotation | Another user holding approve:quotations; the roles of `quotations.approval_notify_roles` are notified | `workflow.quote_maker_checker` |
| Check of a placement against the slip | The user who recorded the e-policy | Another user holding approve:policies | `placement.check_maker_checker` |
| Renewal terms | Operations or Sales & Marketing | Another user holding approve:renewals; the roles of `renewals.approver_roles` are notified | `renewals.maker_checker` |
| Claim settlement | The user who submits it | Another user holding approve:claims (Claims; TIS Operations Unit Head) | `claims.settlement_maker_checker` |
| Journal voucher, correction and reversal | Accounting | Another Accounting user or the Accounting Manager | `journal.require_approval`, `finance.maker_checker_enabled` |
| Payment voucher, cheque, commission payout, petty cash | Accounting | Another Accounting user | `finance.maker_checker_enabled` |
| Remittance, settlement and adjustment | Accounting | Another user within the Remittance approval or Remittance settlement limit (Accounting up to PHP 1,000,000.00, Accounting Manager without limit) | Authority Matrix |
| Commission debit note (direct bill) | Accounting | Another Accounting user | built in |
| Incentive calculation batch | Accounting | Another Accounting user | built in |
| Month-end and year-end close | Accounting | Accounting Manager | `accounting.period_close_requires_approval` |
| Bank reconciliation, insurer statement reconciliation, credit control decisions | Accounting | Accounting Manager | built in |
| Posting rule and account determination changes | Accounting Manager or System Administrator | Another of them, on Configuration Approvals | built in |

On top of maker-checker, the **Authority Matrix** (Master > Users and Access) can set the largest amount each role may approve per transaction type, and **Segregation of Duties** rules stop conflicting roles being given to the same person. `access.authority_enforced` and `access.sod_enforced` are on in the delivered set-up.

## Where the audit trail is

BrokerVerse records every create, change, approval, report run and sign-in with the user, the time and the values before and after.

| Where | What you see | Who |
|---|---|---|
| Master > Audit Trail | Every audited action, searchable by record type, record ID, user and dates. | System Administrator |
| **Audit Trail** tab of a quotation | Every change of the quotation with date, field, old and new value and user. | Users who open the quotation |
| Claim audit trail (icon on the claims list) | Every status change of the claim with user and time. | Claims |
| History of a period, reconciliation, close run or posting rule | Each status change with user, time and remarks. | Accounting, Accounting Manager |
| **Prepared by**, **Submitted by**, **Approved by** on approval screens | The maker and the checker of the record. | Users of the screen |
| Master > Users and Access > User, **Sign-in history** | Every sign-in attempt of a user with result, method, IP address and browser. | System Administrator |

# The business process end to end

## The broking cycle

Every piece of business passes through the same cycle. Each step is done on its own screen, usually by a different team, and each step leaves a numbered record behind. The diagram shows the cycle; the numbered list and the table below give the detail.

![The broking cycle in BrokerVerse, with the persona responsible for each step](/home/user/BDOI-OOTB/docs/package/source/manual-images/process-flow.png)

1. **Prospect.** The person or company that may buy insurance is recorded with contact details and address. Number LD-YYYY-NNNNN.
2. **Quick quote or request for quotation.** A package product with a tariff (motor, CTPL) is priced on the spot with Quick Quote. A non-package risk (fire, IAR, marine, engineering, casualty, employee benefits) is presented to several insurers with a Request for Quotation (broker slip). Number BS-YYYY-NNNNN.
3. **Insurer offers and comparison.** Each insurer's offer or decline is recorded against the request (OFR-YYYY-NNNNN). The offers are ranked by gross premium and compared, and the security is chosen: one insurer at 100%, or a lead insurer and co-insurers with shares that total 100%.
4. **Quotation.** The chosen terms are priced for the client in a Quotation Slip: net premium, VAT, documentary stamp tax, local government tax, fire service tax where it applies, CTPL for motor, gross premium and commission. Number QT-YYYY-NNNNN.
5. **Customer response.** The quotation is sent to the client for approval. The client accepts through the approval link, or the account executive records the answer received by e-mail, phone, Viber or WhatsApp, meeting or signed form: Accepted, Declined or Revise.
6. **Placement slip.** When the client accepts a quotation the placement slip is raised automatically and its PDF is kept with it. It is e-mailed to the lead insurer and the co-insurers with the slip attached, the insurer acknowledges it and later returns the e-policy, which is checked against the slip by a second user. Number PS-YYYY-NNNNN.
7. **Policy issuance.** The broker never issues cover: the policy comes into force only when a checked placement slip is booked as **Insurer issued**. The bill, journal and commission are booked then, the cover notes end and the policy schedule is e-mailed to the client. The client record is created from the prospect. Numbers POL-YYYY-NNNNN and CL-YYYY-NNNNN.
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
| 2 | Quick quote | Sales & Marketing, Operations | Operations > Sales & Marketing > Quick Quote |
| 2 | Request for quotation | Processing Team (Sales and Operations can start one) | Operations > Sales & Marketing > Request for Quotation (Broker Slip) |
| 3 | Insurer offers and comparison | Processing Team | Request for Quotation: tabs Market responses, Compare offers |
| 4 | Quotation | Sales & Marketing, Operations; Processing Team for quotation slips from a request | Operations > Sales & Marketing > Quotations |
| 5 | Customer response | Client (approval link); Sales & Marketing records other answers | Quotation: **Send for Customer Approval**, **Record customer response** |
| 6 | Placement slip | Processing Team | Operations > Sales & Marketing > Placement Slips |
| 7 | Policy issuance | Processing Team | Placement Slip: **Book (Insurer issued)** |
| 8 | Billing | System, at issue; Accounting for direct-bill debit notes | Policy: Premium Accounting Entries; Accounts > Remittance > Direct Bill Processing |
| 9 | Receipt and collection | Operations or Sales record the payment; Accounting posts the receipt | Policy: **Proceed to Payment**; Accounts > Receipts; Accounts > Collections |
| 10 | Remittance to insurer | Accounting, maker and checker | Accounts > Remittance; Accounts > Disbursement |
| 11 | Commission | Accounting, maker and checker | Commission > Agents/Referrer Accounts; Accounts > Disbursement |
| 12 | Endorsements | Operations raise; Processing Team complete | Operations > Policy: **More actions** > **Endorsement** |
| 13 | Claims | Claims, maker and checker | Operations > Policy: **More actions** > **Claim**; Operations > Claims |
| 14 | Renewals | Operations, Sales & Marketing; Processing Team approve terms | Operations > Renewals |
| 15 | Bank and insurer reconciliation | Accounting; Accounting Manager approves | Accounts > Bank Reconciliation; Accounts > Insurer Reconciliation |
| 16 | Month-end close | Accounting; Accounting Manager approves | Accounts > Period End > Month-End Close |
| 17 | Reports | Every role, per its menu | Reports; Accounts > Tax; Dashboard |

## The placement journey by line

Not every line uses every step. The steps a line must, may or does not use are set in `placement.journey` and `placement.journey_by_business_type` (Master > Configuration, area Sales, Quotations & Placement). In the delivered configuration every line, renewals included, is placed through a placement slip: no quotation converts to a policy directly and no policy is entered after the fact. Motor comprehensive needs a quotation; CTPL may be placed directly with its LTO document or official receipt. A step set to Not used is refused with a message that names the line.

Each quotation, request for quotation and placement slip shows its journey as a progress bar: **Request for Quotation**, **Quotation Slip**, **Placement raised**, **Sent to insurer**, **Acknowledged**, **e-Policy received**, **Checked against slip**, **Insurer issued (Booked)**. Each step shows the number of its record or its date, or Optional, Required or Not used.

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

Every menu: Dashboard, Operations, Accounts, Commission, Reports, Master and Product Configurator. The menus used for administration are:

| Menu | Items |
|---|---|
| Master > System | System Settings (with Theme and Branding), Configuration, Document Numbering, Schedules, Audit Trail, E-mail Outbox, Integrations, Message Templates, Insurer Integration |
| Master > Data Privacy, Go-Live and Data | Data Subject Requests, Consent Register; Go-Live Data Load |
| Master | Organization (Company, Branch, Sales Activity Types, Sales Activity Outcomes); Insurance (Insurance Company, Line of Business, Product, Cover, Signatories, Vehicle, Short-Period Rates, Cancellation Reasons, Claim Document Checklist, Repair Shops, Distribution Channels); Location (Country, Province, City / Municipality); Employees (Hierarchy, Designation); Users and Access (User, Role, User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews) |
| Master > Finance | Account Determination, Posting Rules, Configuration Approvals, Accounting Flow, Package Bundles, Insurer Rate Tables, Premium Taxes & LGU Rates, Payment Gateways, Commission Rate Matrix, Transaction Code, Currency, Exchange Rate, Bank, Account Category, Main Account, Sub Account, Taxation, Close Checklist, Asset Classes, Bank Statement Formats, Bank Transaction Types, Insurer Statement Formats, Bank File Layouts, Remittance Master, Incentive Programs |

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Unlock users and reset passwords on request | Master > Users and Access > User |
| Daily | Check the e-mail outbox for failed messages | Master > E-mail Outbox |
| Daily | Check that the schedules ran (Last status) | Master > Schedules |
| On request | Add a user, change a role, deactivate a leaver | Users and Access > User |
| On request | Add or change insurers, products, covers, banks and other masters | Master > Insurance, Master > Finance |
| On request | Change a business setting agreed with the process owner | Master > Configuration |
| On request | Change the theme, the sign-in page, the document and e-mail branding, the signature mapping; import a brand pack; enable a bundled brand pack (with the trademark acknowledgement) or go back to the default | Master > System Settings > Theme and Branding |
| On request | Set up or switch on a connector (SMS, CTPL authentication, insurer API, bank files) with the server administrator | Master > Integrations |
| Monthly | Review users without two-step verification, dormant users and segregation-of-duties conflicts | Users and Access > User Access Matrix |
| Quarterly | Run an access review | Users and Access > Access Reviews |
| Before go-live | Company and letterhead, official receipt numbering to match the Authority to Print, security settings, e-mail settings | Company, Document Numbering, Configuration |
| Before go-live | Load the configuration and migration workbooks, reconcile, set the go-live lock | Master > Go-Live Data Load (chapter Go-Live Data Load) |

## Users

### Add a user

![Master > Users and Access > User > Add](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-user-add.png)

1. Choose Master > Users and Access > User and select **Add**.
2. Enter **Username** (the user ID used to sign in), **E-mail** and **Display Name**. All three are required. The e-mail is where Forgot password? sends its code.
3. Leave **Password** empty: the system then generates a temporary password ("Leave empty for a temporary password").
4. Choose the **Branch**, the **Designation** and **Reporting to** (the user's manager), if your organisation uses them.
5. Under **Roles**, tick the role or roles. A person normally holds one role. The Accounting Manager role includes Accounting. When `access.sod_enforced` is on, a combination listed on Segregation of Duties with the action Block is refused.
6. Select **Save**. The temporary password is shown once. Hand it to the user privately.

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

**Role** lists the seven broker roles and the TISPH roles (see TISPH roles under Roles and menus). **Role Permissions** shows, for each permission (for example read:receipts, write:bank-reconciliation, approve:period-end, approve:quotations), which roles hold it. A role that builds on another (the Accounting Manager on Accounting, SUPERID on the System Administrator) also has that role's permissions. **Edit roles** changes the permissions of a role; do this only with the process owner, because the menus and the server checks follow the permissions.

![Master > Users and Access > Role Permissions](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-role-permissions.png)

### User Access Matrix

The matrix lists every user with roles, branch, status, last sign-in, two-step verification, password age and segregation-of-duties conflicts. The cards at the top count **Active users**, **Dormant (90+ days)**, **Segregation-of-duties conflicts** and **Active without two-step verification**; select a card to filter the list. **Export to Excel** downloads the matrix for an access review; **Sign out everywhere** ends every session of a user.

![Master > Users and Access > User Access Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-access-matrix.png)

### Authority Matrix

The Authority Matrix holds the approval limits per role and transaction type: amounts in PHP, discounts in percent of premium (for example a quotation discount of 10% for Sales & Marketing, policy issuance up to PHP 1,000,000.00). A role with **Not set** is not restricted by the matrix for that transaction type. **Limit for one person** sets a personal limit for one user. A change applies once a second administrator approves it.

![Master > Users and Access > Authority Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-authority.png)

### Delegations

A delegation lets another user approve for an approver who is away.

1. Choose Users and Access > Delegations and select **New delegation**.
2. Choose **Approver away** and **Covered by**, the **Transactions** covered (**All transactions** or a type), **From** and **To** dates and the **Reason**.
3. Select **Save**.

![New delegation](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-delegation-new.png)

### Segregation of Duties

Each rule names two roles that one person should not hold together, what happens when they are assigned (**When assigned**: **Block** refuses the combination, **Warn** allows it with a warning), the reason and the status. The delivered rules are SOD-CLM-ACCT (Claims and Accounting: the claims handler should not also release claim payments), SOD-PROC-ACCT (Processing Team and Accounting: the person who places and issues business should not also release premium to insurers) and SOD-PROC-MGR (Processing Team and Accounting Manager: the person who places business should not approve its payments), all three Block; and SOD-SALES-ACCT (Sales & Marketing and Accounting), SOD-SALES-CLM (Sales & Marketing and Claims) and SOD-TIS-BP-RECON (CCD-BP and CCD-Recon: the user who issues receipts should not also reverse them), all three Warn. **New rule** adds a rule; **Switch off** disables one.

![Master > Users and Access > Segregation of Duties](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-sod.png)

### Access Reviews

Confirm at least every quarter that each active user still needs his or her access. **Start a review** creates the review with every active user; for each user choose **Keep** or **Revoke** (the decision starts as **To review**). The closed review is kept as the audit record.

## Company, branches and the letterhead

![Master > Organization > Company > Add](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-company-add.png)

Every printed document and report PDF (quotation, request for quotation, placement slip, policy schedule, billing statement, official receipt, payment voucher, debit note, claim letters, BIR forms) carries the letterhead of the company marked as letterhead company.

1. Choose Master > Organization > Company. Select **Add**, or the pencil on the delivered company to edit it into your own.
2. Enter **Company Code**, **Company Name**, **License Number** (Insurance Commission licence), **Email ID**, **TIN (BIR forms)**, **RDO Code**, **Logo (printed on documents)** (a link, or **Upload**), **Website link**, **Description**, the registered address (letterhead and BIR forms: **Address Line 1** to **3**, **ZIP Code**, **City / Municipality**, **Province**, **Country**), **Phone Number** and **Fax** (+63 numbers).
3. Tick **Letterhead company - used on documents and reports** for the company whose letterhead the documents use. Only one company holds it.
4. Select **Save**, then print any statement or report as PDF to check the letterhead.

The application name and logo of the sign-in page and the sidebar come from Master > System Settings, not from the Company master. Branches are kept on Master > Organization > Branch in the same way.

## Insurers and the other masters

### Insurance companies

![Master > Insurance > Insurance Company > Add](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-insurer-add.png)

1. Choose Master > Insurance > Insurance Company and select **Add**.
2. Enter **Insurance Company Code**, **Insurance Company Name**, **Insurance Company Description**, the address (**Address Line 1** to **3**, **City / Municipality**, **Province**, **Country**), **Phone Number**, **Email ID** and **TIN**.
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
| Country, Province, City / Municipality | The Philippine address lists of the PSGC: 18 regions (shown with their provinces), 82 provinces plus Metro Manila, 1,642 cities and municipalities with class and ZIP code; barangays are picked on the address forms. The City / Municipality list is filtered by province. |
| Hierarchy, Designation | The staff structure. A staff member's branch, designation and reporting line are kept on the user (Master > Users and Access > User). |
| Transaction Code, Currency, Exchange Rate | Accounting transaction codes, currencies and rates. |
| Bank | Banks and the broker's bank accounts, each linked to its GL cash account and statement format. |
| Account Category, Main Account, Sub Account | The chart of accounts. |
| Remittance Master | Automated remittance, statement templates, settlement parameters, bulk processing formats, exceptions, agency bill, adjustment and notification templates. |

### Operational masters

| Master | Menu | Maintained by |
|---|---|---|
| Short-Period Rates | Master > Insurance | System Administrator |
| Cancellation Reasons | Master > Insurance | System Administrator |
| Claim Document Checklist | Master > Insurance | Claims, System Administrator |
| Repair Shops | Master > Insurance | Claims, System Administrator |
| Lead Sources | Master > Insurance | System Administrator, TIS IT AppSupport |
| Reason Codes | Master > Insurance | System Administrator, TIS IT AppSupport |
| Asset Classes | Master > Finance | Accounting, System Administrator |
| Cost Centres | Master > Finance | Accounting, System Administrator |
| Suppliers | Accounts > Payables > Suppliers | Accounting, System Administrator |

Each screen lists the records with **Add**, the edit icon and activate / deactivate. The nine masters are also in the go-live configuration workbook and have upload templates. **Sales Activity Types** and **Sales Activity Outcomes** (Master > Organization) work the same way and are described under Sales activities in the Sales & Marketing chapter; **Distribution Channels** (Master > Insurance) in the chapter Distribution, programmes and products.

![Master > Insurance > Short-Period Rates, one of the operational masters](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-ops-masters.png)

### Lead sources and reason codes

**Lead Sources** lists where prospects come from (for TISPH: Call, Walk-In, Referral, Corporate, Used-Cars SCR and UCFP, Company Car, Redemption, Renewal, Promo, Agent, Credit Life, Social Media / Website, Bundling) with a channel type and the linked office. The **Source** list of the prospect form offers the active lead sources; the lead upload accepts a lead source by its code or its name and stores its name. A source the list does not know is kept as typed, unless `leads.source_list_only` is on, in which case the prospect is refused with a message on the Source. An upload row without a source is stored as bulk-upload.

**Reason Codes** holds the coded reasons of decisions that have no master of their own. **Used For** says where a code is offered: decline (a quotation rejected or dropped), repudiation (a claim rejected), lapse (a renewal lapsed), refund, adjustment and non-materialise. **Requires Note** makes the user write the detail as well. Cancellation reasons and write-off reasons keep their own masters.

- Claims: **Reject Claim** offers the repudiation codes and a note. The claim keeps the code and shows the reason with the note.
- Renewals > Lapse Management: **Lapse** offers the lapse codes and the detail. The **Lapse Reason** filter of the list works on the code.
- A quotation set to Rejected or Dropped through the API may carry a decline or non-materialise code, which is kept in the audit trail.

A reason typed without a code is still accepted everywhere.

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

Master > Configuration holds every business parameter, grouped in areas: Company & Branding; Sales, Quotations & Placement; Policies, Endorsements & Renewals; Claims; Billing, Collections & Credit; Remittance & Reconciliation; Commission & Incentives; Accounting & Tax; Notifications & E-mail; Security & Access; Reports & Dashboards; Data Retention, Privacy & Uploads; and Other settings for settings not yet placed in an area. The search box finds a setting by its words, for example VAT or renewal notice.

1. Select the area. The list on the left switches between areas; **Related screens** link to the screens the settings affect.
2. Change the value. Numbers and text are typed, switches switched, lists edited as values or small tables, e-mail templates in a text box where you keep the {{placeholders}}. **Show advanced settings** shows the rarely changed ones.
3. Save. The change applies at once and is recorded in the audit trail with the old and new value.

![Configuration: the Security & Access area](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-config-area.png)

The group **Go-live** (area Company & Branding) holds the cutover date `golive.cutover_date`, the first day of live transactions, and the go-live lock `golive.locked`. Set them as described in the chapter Go-Live Data Load; switch the lock on only when the migration is loaded and reconciled.

> Change tax rates, GL accounts and maker-checker switches only with the agreement of the Accounting Manager. Settings that control postings are protected: the system refuses a change that must go through Configuration Approvals.

**System Settings** (Master > System > System Settings) holds the quick branding and localisation: **Application name** (shown on the sign-in page, the sidebar and the browser tab), **Application logo (screen)** with **Upload Logo** or **Add Company Logo**, **Favicon** with **Upload Favicon**, **Display Currency**, **Default Language**, **Primary Color** and **Secondary Color**. **Save** applies them to every user, including the sign-in page. The **Theme** group links to **Theme and Branding (full theme, sign-in page, documents, e-mail, signatures, brand packs)**, described in the next section. Printed documents use the logo of the letterhead company in Master > Organization > Company.

![Master > System Settings](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-system-settings.png)

## Theme and Branding

Master > System > System Settings > **Theme and Branding** sets the look of the screens, the sign-in page, the printed documents, the report files and the e-mails of the broker, as data: no new release is needed. Opening the page needs the settings permission of the System Administrator; a saved theme reaches every signed-in user on their next page and the documents, reports and e-mails at once.

![Master > System Settings > Theme and Branding: the Theme tab, the live preview and the contrast list](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-theme.png)

The editor on the left has seven tabs: **Theme**, **Sign-in page**, **Documents and reports**, **E-mail**, **Name and images**, **Document signatures** and **Brand packs**. The right-hand side shows the **Live preview** (the header, side bar, a table, buttons and the sign-in panel in the colours being edited) and the **Contrast (WCAG AA 4.5:1)** list. At the top, **Sample document** opens a PDF printed with the theme as it is on the screen, saved or not; **Discard changes** returns to the saved theme; **Save** stores the theme. Save is disabled while a blocking contrast check fails, and the red message **Cannot save** names the check.

### Theme: presets, layout and colours

1. On **Theme**, select a preset under **Presets**: **iorta TechNXT (default)**, **Classic Blue**, **Corporate Grey** or **Teal**. The preset fills every colour, the layout and the font; the sign-in picture already uploaded is kept. As soon as a value is changed the preset reads **Custom**. Enter a **Theme name**.
2. Under **Layout**, choose the **Header style** (**White** or **Coloured (secondary colour)**), the **Side bar style** (**White** or **Dark**), the **Density** (**Comfortable** or **Compact**), the **Table header style** (**Solid (secondary colour)** or **Light**) and the **Font**: Nunito (bundled, the default), Arial / Helvetica and System UI from the user's computer, or Roboto, Open Sans, Lato, Source Sans 3, Inter, Montserrat, Poppins and Noto Sans from Google Fonts, only through this list. The sliders set the corner radius of fields, cards, panels and buttons in pixels.
3. Under **Colours**, set each colour of the groups **Brand** (primary, primary hover, text on primary, light tint, secondary, accent), **Header**, **Side bar**, **Tables**, **Buttons, links and fields** and **Page**, with the colour picker or by typing the hex value (#rrggbb). The badge next to a text colour shows its contrast against its background: green from 4.5:1, red below. **Reset to default** on a group returns the values of the preset.
4. Select **Save**. The message confirms that every signed-in user gets the theme on the next page and that documents, reports and e-mails use it from now on.

### Contrast check

The server checks the theme while it is edited, with the rules it applies on Save. Text on the buttons (normal and hover), on the primary colour, in the header, in the table headers and in the document table headers must reach WCAG AA, 4.5:1; below that the theme cannot be saved and the message reads, for example, Button text on button colour: contrast 2.1:1 is below WCAG AA 4.5:1. The other pairs (side bar text and active item, links on white cards, page headings, the e-mail header and the document section headings) only warn: the theme is saved and the warning is shown after Save. The list on the right shows every pair with its ratio and a tick, a warning triangle or a cross.

### Sign-in page

![Theme and Branding: the Sign-in page tab](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-theme-login.png)

1. On **Sign-in page**, choose the **Picture**: **Picture library** (the pictures delivered with the product: Philippine insurance (default), Motor: road and city, Property: homes and buildings, Travel and accident: islands, Neutral pattern), **Own picture (upload)** or **Colour only**.
2. For an own picture select **Upload picture**: JPG, PNG, WebP or SVG (a plain drawing), up to 5 MB, at least 1600 x 1200 px for sharp desktops. Set the **Focal point** sliders (left to right, top to bottom) so that the important part of the picture stays visible on a narrow screen. **Remove picture** goes back to the library.
3. Set **Gradient from** and **Gradient to** (the colours behind the picture), **Darken the picture** (0 to 80%) and **Show the picture on phones (as a banner)**. The frame below shows the panel as a desktop or, with **Phone**, as a phone.
4. Under **Texts**, enter the **Headline** (empty: the delivered title, Welcome to followed by the application name), the **Tagline** (empty: Sign in with your user ID and password.), whether to **Show "Powered by iorta TechNXT"** and the **Logo height on the sign-in page (px)** (24 to 140).
5. Select **Save**.

### Documents and reports

Every printed document (quotation, policy schedule, slips, endorsement, receipts, billing statements, vouchers, debit notes, claim letters) and every report PDF or Excel file is printed with these values together with the logo, legal name, TIN, licence and address of the primary company (Master > Organization > Company).

1. Under **Print colours**, set the **Accent (rules, marker)**, the **Titles and section headings**, the **Section heading band**, the **Table header** and the **Table header text** (an empty colour follows the accent), the **Logo height on documents (pt)** (24 to 80) and whether to **Print the logo on documents**.
2. Under **Footer lines**, write the **Footer on every document and report**, with the placeholders {{licence}}, {{tin}} and {{companyName}} (delivered: Authorized by the Insurance Commission to act as an Insurance Broker, Licence No. {{licence}}), and an optional **Extra line on report files**.
3. Under **Excel report files**, set the colour and text of the **Header row** and whether the **Logo and company banner above the table** are printed (the header row then moves down).
4. Select **Sample document** to check the result as a PDF, then **Save**.

### E-mail

On **E-mail**, switch **Send e-mails in the branded layout (header with the logo, footer line)** on or off, set the **Header background**, the **Header text** and the **Line under the header**, whether the **Logo in the header** is shown, and the **Footer** with the placeholders {{companyName}}, {{address}}, {{licence}} and {{tin}}. **Show a sample e-mail** renders a sample message in the layout. Every e-mail the system sends (quotation links, notices, receipts, reminders, debit notes) uses it.

### Name and images

On **Name and images**, enter the **Application name (sign-in page, side bar, browser tab)** and keep the images: the **Application logo (side bar, sign-in page)** (PNG, JPG, WebP or SVG, up to 2 MB) and the **Favicon (browser tab)** (PNG, ICO or SVG, up to 512 KB), each with **Upload** and **Use default**, and the **Logo height in the side bar (px)** (20 to 80). An uploaded image applies at once; an SVG must be a plain drawing, so a file with scripts or links is refused. The logo on printed documents is the logo of the primary company in Master > Organization > Company; a brand pack import can set it.

### Document signatures

Signatures are captured in Master > Insurance > Signatories (the company's signatories: the **E-signature** icon on the row opens the capture: **Draw** the signature or **Upload image**, PNG with a transparent background or JPEG up to 512 KB, set **Effective from**, tick the consent statement and select **Save signature**; every version is kept under **Versions** and **Revoke** ends one with a reason) and on My Profile (**My e-signature**: a user's own signature, printed where a document is signed by the user who issued or approved it).

![Theme and Branding: the Document signatures tab](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-theme-signatures.png)

The tab **Document signatures** says which signature prints on which document:

1. Choose the **Document**: Quotation slip, Policy schedule, Endorsement, Official receipt, Acknowledgement receipt, Payment voucher, Commission debit note, Billing statement / invoice, Statement of account, Journal voucher or Claim settlement letter.
2. For each slot set the **Slot** code (lower-case letters, digits and hyphens; fixed once saved), the **Label** printed under the signature (for example Prepared by, Approved by), **Signed by** (Signatory chosen on the document (else the default signatory); A named signatory, with the signatory chosen next to it; The default signatory (documents.default_signatory); The user who approved the document; The user who issued / prepared the document) and **Prints** (Once the document is issued; Once the document is approved; Always (also on drafts)). **Active** switches a slot off without deleting it; the bin removes it.
3. **Add slot** adds one more; **Save** stores the mapping of the document chosen.

A draft prints its slots unsigned with an UNSIGNED DRAFT watermark; a cancelled document prints a CANCELLED watermark and no signature. In an uploaded document template (Product Configurator > Document Manager) a signature is placed with {{signature:slot}}, slot being the slot code.

### Brand packs

A brand pack is the whole branding of an environment in one file: the theme (colours, layout, sign-in page, documents, e-mail), the application name, the logo, the favicon, the sign-in picture and the print logo.

![Theme and Branding: the Brand packs tab](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-theme-packs.png)

- **Export .zip** or **Export .json** downloads the pack of this environment. Import it in another environment to promote the branding, for example from UAT to Production.
- **Choose brand pack** checks the file first without changing anything: the message says that the pack is valid, what it contains (theme, logo, favicon, sign-in picture, document logo) and any contrast warnings, with swatches of its main colours. Tick **Also use the logo on printed documents (print logo of the primary company)** and **Also set the application name of the pack** as needed, then select **Apply brand pack**. The message lists what was applied, and the theme, images and name are in force at once.

A pack that the application would refuse (a colour that is not a hex value, a font outside the list, text on buttons, header or table headers below WCAG AA) is refused at the check. A client brand pack carries the marks of a client of iorta TechNXT and is applied only in that client's environments, under the client's contract with iorta TechNXT, which covers the use of its marks there. Every save, upload, import, enablement and return to the default of this screen is in the audit trail.

**Bundled packs.** The top of the tab lists the brand packs delivered with the product, so a client pack is enabled from the screen and not by uploading a file. Each card shows the pack's name, **Marks owned by** (the owner of the trademarks it carries), **Version**, a description, swatches of its main colours and the status **Enabled** or **Available**. Nothing is enabled by default: a new environment runs the iorta TechNXT default branding, and the line above the cards says **The iorta TechNXT default branding is in force.** The Toyota Insurance Services pack is delivered this way: it stays optional and is used only in that client's environments.

- **Sample document** and **Sample e-mail** on a card open the sample PDF and the sample e-mail printed with the pack's theme, without saving anything.
- **Enable** opens a confirmation. It states that the name, emblem and logo in the pack are trademarks of their owner, a client of iorta TechNXT, and that their use is covered by the client's contract with iorta TechNXT for the environments of that engagement; it shows **Basis:** followed by the contract reference from the pack manifest; it checks the pack first (valid, what it contains, any contrast warnings); and it asks the administrator to tick **This environment belongs to the client engagement whose contract with iorta TechNXT covers these marks**. The **Enable** button of the dialog stays disabled until the box is ticked. The options **Also use the logo on printed documents** and **Also set the application name of the pack** work as for an import. Enabling applies the theme, the application name and the images at once, like an import, and records the enablement: the card then shows **Enabled on <date> by <user>**, and the same line, with the pack's name, appears above the cards. The enablement is in the audit trail with the acknowledgement.
- **Back to default** (on the enabled card and in the status line) asks for a confirmation, then restores the iorta TechNXT default theme, logo and favicon, returns the application name and the print logo of the primary company to what they were before the pack was enabled, and closes the enablement. **History** below the cards lists every enablement with its outcome (Enabled, Back to default, Replaced), who and when.

A bundled pack needs the settings permission to be seen and enabled, like the rest of the screen. Enabling it without the acknowledgement is refused by the server as well, so the acknowledgement cannot be skipped by calling the API directly.

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

## Integrations

Master > System > Integrations is where every connection to a third party is set up and watched: the SMS gateways and the optional Viber business messages, the CTPL authentication provider accredited by the Insurance Commission and the LTO feed, the insurers' systems and the bank payment files. The screen needs `read:integrations` (changes: `write:integrations`); both are held by the System Administrator only.

![Master > System > Integrations: the Connectors tab](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-integrations.png)

### Connectors

The **Connectors** tab lists each connector with its **Type**, **Mode** (**Test mode** or **Live**, and **Cancelled** when it is switched off), the **Credentials** it needs (a green tick when the environment variable is set on the server), the messages **Waiting**, **Failed** and **Sent today**, what is missing **Before going live**, and the last success and failure.

The system is delivered with these connectors, all in test mode except the bank files:

| Connector | Used for | Delivered |
|---|---|---|
| SMS_SEMAPHORE | SMS (Semaphore-style API: form post with an API key) | Enabled, test mode; the default SMS connector (`messaging.sms_connector`) |
| SMS_GLOBE_LABS | SMS (Globe Labs-style API: access token and short code) | Switched off |
| SMS_GENERIC | SMS through any HTTP API (path, body, headers and the answer's message id are options) | Switched off |
| VIBER_BUSINESS | Viber business messages through an aggregator (optional) | Switched off |
| CTPL_AUTH | Authentication of CTPL certificates of cover | Enabled, test mode |
| LTO_FEED | Authenticated COCs sent to the LTO, when the provider does not do it | Switched off |
| INSURER_API | Insurer systems (one mapping per insurer on Insurer Integration) | Enabled, test mode |
| BANK_FILES | Bank payment files (download and upload on the bank portal) | Enabled |

In **test mode** a connector answers from a built-in test provider: SMS are recorded as sent, a COC gets a test authentication code, an insurer returns a test policy number. Nothing leaves the system, so the whole process can be tried before the contract with the provider is signed.

To change a connector, select the pencil (**Edit**):

1. **Endpoint**: the address of the provider's service, from the provider.
2. **Credentials**: one line per credential with the NAME of the environment variable that holds it, for example `SEMAPHORE_API_KEY`. The value itself is never entered on the screen or stored in the database: the server administrator sets it in the secret store of the environment. The tag shows whether the variable is set.
3. **Adapter options**: the provider's details in JSON (sender name, short code, number format, paths, field names). The defaults match the provider style named in the connector.
4. **Attempts**, **First retry after** and **Longest wait**: a message that fails is tried again after the first wait, then twice as long each time, up to the longest wait, until the number of attempts is reached. A request the provider refuses (for example an invalid number) is not retried.
5. **Mode** **Live** and **Enabled**. Live is refused while the endpoint or a credential variable is missing; the message says what is missing.

**Test connection** checks the connector without sending a business message: in test mode it confirms the test provider, in live mode it calls the provider's health-check path when one is set in the options. Every change and test is in the audit trail.

### Outbox and inbox

The **Outbox** tab lists every message sent or waiting: SMS and Viber messages, CTPL authentication requests, LTO feeds, insurer requests and bank files, with **Status** (Queued, Retry scheduled, Sending, Sent, Failed, Cancelled, Not sent), **Attempts**, **Last error** and **Next attempt**. Filter by status or connector, or search a mobile number, COC, policy or error text.

- The eye (**View**) shows what was sent, the provider's answer and every attempt with its duration and error.
- **Resend** queues a failed, cancelled or not sent message again with a fresh attempt count and sends it at once; a message waiting for its next attempt is sent now.
- **Cancel message** stops a message that has not been sent.
- **Send due messages** (top right) sends what is due now. The job `integration-outbox` (Master > Schedules) does the same every 2 minutes.

A message **Not sent** was deliberately not sent: the client has no valid mobile number, or the consent check refused it (see SMS and message templates). A switched-off connector keeps its messages queued until it is enabled again.

The **Inbox** tab lists what third parties sent to the system: claim statuses pushed by an insurer, CTPL authentication results pushed by the provider, and the files imported by users (bank status files, claim status files). A message pushed by a third party must be signed with the connector's webhook secret; an unsigned or wrongly signed message is kept as **Ignored** and never applied. **Process again** retries a failed message once its cause is fixed.

### Go live with a provider

1. Sign the contract with the provider and obtain the endpoint, the credentials and the sender name or short code.
2. Ask the server administrator to set the credentials as environment variables (secret store) and restart the service.
3. On the connector, enter the endpoint and the variable names; **Test connection** in live mode.
4. Switch the mode to **Live**. Send a test SMS from Message Templates, or authenticate one COC, and check the outbox.

What is certified with each partner (the provider's acceptance of the requests, the LTO interface, an insurer's API and each bank's file) is done during onboarding with the partner; the system cannot certify it alone.

## SMS and message templates

Master > System > Message Templates holds the texts sent to clients by SMS (or Viber).

![Master > System > Message Templates](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-message-templates.png)

| Template | Event | Sent |
|---|---|---|
| RENEWAL_NOTICE | Renewal notice | By the job `sms-renewal-notices` on the days `messaging.renewal_notice_days` (30 and 7) before expiry |
| PAYMENT_REMINDER | Payment reminder | By the job `sms-payment-reminders` on the days `messaging.payment_reminder_days` (3 and 0) before an open bill is due |
| CLAIM_UPDATE | Claim update | When a claim moves to a status of `messaging.claim_update_statuses` (in review, approved, settled, rejected, closed) |
| CTPL_AUTHENTICATED | CTPL authenticated | When the authentication code of a COC is received (delivered inactive) |
| RENEWAL_NOTICE_VIBER | Renewal notice by Viber | Delivered inactive; activate it and deactivate the SMS one to send renewal notices by Viber |

To change a template, select the pencil:

1. Change the **Text**. The placeholders in double braces are filled when the message is sent, for example `{{clientName}}`, `{{policyNumber}}`, `{{expiryDate}}`, `{{amountDue}}`, `{{dueDate}}`, `{{claimNumber}}`, `{{claimStatus}}`, `{{cocNumber}}`, `{{authCode}}` and `{{companyName}}`. The **Preview** shows the text with example values, its length and the number of SMS parts (160 characters each).
2. Choose the **Consent needed**: **Processing (service message)** for renewal notices, reminders and claim updates; **Marketing** for promotions; **None** only for messages that need no consent.
3. Leave **Connector** empty to use the default connector of the channel, or choose another one.
4. Save. **Send a test** sends the template with example values to a mobile number you enter.

**Consent check.** Before a message is queued the system reads the client's consents (Master > Data Privacy). A marketing message needs a granted marketing consent. A service message is sent unless the client refused or withdrew consent for processing; with `messaging.service_consent` set to `opt-in` it needs a granted consent. A message that fails the check, or a client without a valid mobile number, is recorded in the outbox as **Not sent** with the reason.

The jobs `sms-renewal-notices` and `sms-payment-reminders` are delivered switched off: switch them on in Master > Schedules when the SMS connector is live. Each notice is sent once per policy and day; running a job again sends nothing twice. The **Messages sent** tab lists every SMS and Viber message.

## Insurer integration

Master > System > Insurer Integration connects BrokerVerse to the insurers' systems.

![Master > System > Insurer Integration](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-insurer-integration.png)

**Mappings.** Select **New mapping** (or the pencil of an insurer):

1. Choose the **Insurer** and the **Connector** (INSURER_API, or a copy of it for an insurer or aggregator with its own endpoint and keys).
2. Enter the **Broker code at the insurer** and the **Product codes** (for example `{"MOTOR": "PC", "FIRE": "FI"}`).
3. **Issuance request map**: the fields the insurer expects and where each comes from in the policy (for example `"insuredName": "insuredName"`, `"plate": "vehicle.plateNumber"`, `"agent": "{{brokerCode}}"`). Empty: the default map shown under the fields.
4. **Answer map**: where the insurer's answer holds the policy number, status and premium (for example `"policyNumber": "data.policyNo"`).
5. **Claim statuses**: how the insurer's statuses read in BrokerVerse (for example `"UNDER EVALUATION": "In review"`).
6. **Send the issuance request when a policy is issued** sends the request automatically at issue.
7. Enter a policy number and select **Preview** to see the request exactly as the insurer will receive it. Save.

**Requests.** **New request** sends a **Policy issuance** (the insurer's policy number is stored on the policy and printed on the schedule), **Policy and premium data** (the insurer's premium and status are stored on the policy; a difference above `insurer_integration.premium_tolerance` is flagged) or a **Claim status** (stored on the claim with a line in its history). The list shows each request with the insurer's answer.

**Claim status file.** When an insurer has no API, import its claim status list as CSV with the columns Claim Number, Status, Remarks and Status Date: each row updates the claim through the inbox, and the result per row is shown. Premium and policy data by file go through the insurer statement import (Accounts > Insurer Reconciliation).

## Audit Trail

![Master > Audit Trail](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-audit.png)

1. Enter a **Record type** (for example session for sign-ins, policy, receipt, placement), a **Record ID** or a **User**.
2. Enter **From date** and **To date**.
3. Select **Search**. The list shows **When**, **User**, **Record type**, **Record ID**, **Action** and **Change** (before and after values).

Use it for investigations, access reviews and to show that maker and checker were different people.

## Data privacy

The Data Privacy menu supports the broker's Data Protection Officer under the Data Privacy Act. The System Administrator and Operations roles hold the privacy permissions (`read:privacy`, `write:privacy`).

**Consent.** Consent is recorded on the client (tab **Data privacy**) and on the prospect view, per purpose: **Processing** (privacy notice acknowledged), **Marketing** and **Sharing with insurers**. Select **Record consent**, choose the purpose, **Given** or **Refused**, the channel (Form, E-mail, Phone, Portal, In person), the evidence and the notice version (the version in force, `privacy.notice_version`, by default). **Withdraw** ends a consent with a reason; the record stays in the history. Master > Data Privacy > Consent Register lists every consent of every client and prospect, with **Current status only** to see the latest per purpose.

![Master > Data Privacy > Data Subject Requests](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-privacy-requests.png)

**Requests.** Master > Data Privacy > Data Subject Requests is the register of requests:

1. Select **Log request**. Enter the requester name and contact, the request type (Access, Rectification, Erasure or blocking, Objection, Data portability, Withdraw consent), the request details and the date received. Search the client or prospect, or leave it empty while the requester is not yet identified.
2. Save. The request takes a number from the DSR series and a due date `privacy.request_due_days` (15) calendar days after the date received. The cards count **Open**, **Overdue**, **Completed** and **Rejected**.
3. Use the download icon (**Export personal data**) to give the data subject a copy, as JSON or Excel; the export is noted on the request.
4. For an erasure, use **Anonymise**. The dry run shows what would be cleared per record type, or why the data must be kept for now (for example policies in force, open bills or claims, or less than `privacy.retention_years` (10) years since the last policy expiry). Names are replaced by an anonymised label and contact details, addresses, ID numbers, birth date and personal notes are cleared; policy, receipt and claim numbers, amounts and dates are kept for the books.
5. Select **Close**, record the outcome told to the data subject, and close the request as Completed or Rejected.

The job `privacy-requests-due` (Master > Schedules, delivered switched off) notifies the privacy team every morning of open requests past their due date.

**Masking of personal identifiers.** A user whose role does not hold **View full personal identifiers** (`view:pii`) sees TIN, government ID numbers, mobile numbers, e-mail addresses, bank account numbers and birth dates partially masked on every list and view, for example ***-***-**9-000, j***@example.ph or 1984-**-**, and in every Excel, CSV and PDF listing. Delivered to the System Administrator, Sales, Operations, Accounting and the Accounting Manager; Processing and Claims see masked values unless the role is given the permission (Master > Users and Access > Roles). A form opened with masked values keeps the stored values when it is saved. Which fields are personal comes from the personal data catalogue of the masking tool. Settings: `privacy.masking_enabled`, `privacy.masking_exempt_paths` and `privacy.pii_reveal_mode`. With **on-request**, holders of the permission also see masked values until they choose **Show full identifiers** in the user menu (top right; **Hide full identifiers** turns it off); each screen opened with full identifiers is recorded in the audit trail (record type personal_data, action unmask).

**Encryption at rest.** TIN, government ID numbers and bank account numbers of clients, prospects and referrers, the ID numbers captured when a policy is issued and the payee TIN of BIR Form 2307 are stored encrypted with the key of the environment (`PII_ENCRYPTION_KEY`). Search by an exact TIN still works (global search and the client list, in any format, with or without dashes). The key rotation is described in deploy/REFERENCE.md.

## Finance set-up shared with the Accounting Manager

The System Administrator can open every Master > Finance screen. The Accounting chapters describe them: Commission Rate Matrix, Posting Rules, Account Determination, Configuration Approvals and Accounting Flow (Accounting Manager chapter), Taxation, Close Checklist, Bank Statement Formats, Bank Transaction Types and Insurer Statement Formats (Accounting chapter), and Package Bundles, Insurer Rate Tables, Premium Taxes & LGU Rates and Payment Gateways (Module reference). Changes to posting rules and account determination wait for a second user on Configuration Approvals.

## Incentive programmes

- **Master > Finance > Incentive Programs**: **Add Program** with the code, name, type (Target Based, Commission Based, Hybrid, Contest), target metric, base target, frequency and dates. Accounting calculates and pays the programmes but cannot change them.

## Approvals

The System Administrator approves posting rule and account determination changes of another user (Configuration Approvals), Authority Matrix changes of another administrator. Business approvals belong to the business roles.

# Go-Live Data Load

This chapter is for the System Administrator and the migration lead. Master > Go-Live Data Load loads the broker's go-live data with two Excel workbooks instead of one upload per master. Only the System Administrator holds the permissions of the screen (`read:data-load` to download and see the history, `write:data-load` to upload, validate and load).

## The two workbooks

| Workbook | What it holds |
|---|---|
| **Configuration** | Everything needed to run new business: company, settings, countries, states, cities, branches, departments, hierarchy, designations, users, currencies, exchange rates, chart of accounts, banks, bank accounts, signatories, transaction codes, write-off reasons, insurers, lines of business, products, policy types, covers, vehicle brands, models, variants and vehicles, commission rates, premium taxes, LGU rates, authority limits and document numbering. |
| **Migration** | The open business of the old system at cutover: clients, in-force policies (with their old numbers), open premium receivables, open claims and the GL opening balances. |

The blank workbooks are also delivered with the upload templates as GoLive_Configuration_Workbook.xlsx and GoLive_Migration_Workbook.xlsx.

Choose the workbook with **Configuration** or **Migration** at the top right of the screen. Next to it the screen shows the cutover date (**Cutover** and the date, or **No cutover date**) and, once go-live is locked, **Go-live locked**.

Each workbook has an **Instructions** sheet (load order, rules, every column), a **Lists** sheet with the allowed values, and one sheet per object in load order. Row 1 holds the headers; a required column ends with *. Row 2 is a sample row: a row whose first cell starts with SAMPLE is never loaded. Enter data from row 3. Dates are written YYYY-MM-DD.

Some set-up is not in the workbooks and is entered on its own screen: roles and permissions, segregation of duties, delegations, access reviews, the approval of authority limits, tax codes, account determination and posting rules, statement formats, the close checklist, product templates and the motor tariff, package bundles, payment gateways, System Settings, schedules, fiscal years and periods, remittance masters, incentive programmes, referrer accounts and petty cash funds. The Instructions sheet lists them.

## Download the template

![Master > Go-Live Data Load, tab Download Template (configuration workbook)](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-golive-template.png)

1. Choose Master > Go-Live Data Load and the workbook (**Configuration** or **Migration**).
2. On the tab **Download Template**, the table lists each sheet with **Sheet**, **Screen** (the screen that holds the same data), **Key** (the columns that identify a record), **Columns** and **Required columns**.
3. Select **Blank template** for an empty workbook, or **Current data** for a workbook filled with the data already in BrokerVerse.

![The migration workbook: clients, policies, open items, open claims and opening balances](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-golive-migration.png)

**Current data** is also how configuration moves from one environment to the next (test, UAT, production): download it in the source environment and upload it in the target. Rows equal to the target are reported as unchanged, differences update the target and missing records are created. The go-live lock setting is never exported or loaded.

## Upload and validate

1. Fill in the workbook and save it as .xlsx.
2. On the tab **Upload and Validate**, select **Upload and validate** and choose the file.
3. BrokerVerse reads the workbook as a new batch (**Batch 1**, **Batch 2** and so on) and validates every sheet in load order as a trial run. Nothing is saved yet. A policy may refer to a client or an insurer added by the same workbook: the trial run checks the sheets together, as they will load.

![Upload and Validate: the result of a batch](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-golive-validate.png)

The result shows the batch number, the file name and the status, the cards **Rows read**, **Valid rows** and **Rows with errors**, and a line per sheet:

| Column | Meaning |
|---|---|
| **Read**, **Valid**, **Errors** | Rows read from the sheet, rows that pass every check, rows with at least one error. |
| **New** | Records that the load will create. |
| **Changed** | Existing records that the load will update. |
| **Unchanged** | Rows equal to the record in BrokerVerse; they are not written. |
| **For approval** | Authority limits, which another System Administrator approves on Master > Users and Access > Authority Matrix. |
| **Skipped** | Rows in error left out by a load with **Load valid rows only**. |

Under the sheets, **Errors** lists each error with **Sheet**, **Row** (the row number in Excel), **Column** and **Message**.

![Errors of a batch](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-golive-errors.png)

## Correct the errors

1. Select the Excel icon next to the batch (**Download errors**). The file has the same layout with only the rows in error and an **Errors** column that gives the reason.
2. Correct those rows in the errors file or in the full workbook.
3. Upload the corrected file again with **Upload and validate**. A record is identified by its key (for example the branch code, the insurer code, the legacy policy number), so loading the same or a corrected workbook again updates the record and never creates a duplicate.

**Validate again** (the circular arrow) runs the checks on the same batch once more, for example after a master was added on its own screen.

## Load

1. Open the batch on **Upload and Validate** (or with the eye on **History**).
2. If some rows still have errors, decide whether to load the valid rows now: **Load valid rows only** is ticked by default for the configuration workbook and not for the migration workbook. Without it, a batch with errors cannot be loaded.
3. Select **Load**. The dialog **Load the workbook** asks you to confirm the number of valid rows of the batch. Select **Load** again, or **Cancel**.

The load runs in one transaction. If a row now fails because the data changed since the validation, nothing is saved and the errors are shown. The load is written to the audit trail and the batch status becomes **Loaded**. After a load of the valid rows only, the rows left out keep their errors: the batch still lists them and **Download errors** still gives them, to correct and upload again.

When the configuration workbook creates users, the dialog **Temporary passwords of the new users** shows each new user's temporary password once. The passwords are not stored: select **Copy**, hand each password to its user privately, then select **Done**. Each user chooses a new password at the first sign-in. A load cannot change your own account, and only a System Administrator can give the System Administrator role.

## History

![History of the go-live batches](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-golive-history.png)

The tab **History** lists the batches of the workbook chosen with **Batch**, **File**, **Status** (**Validated**, **Errors** or **Loaded**), **Read**, **Valid**, **Errors**, **Uploaded** (user and time) and **Loaded** (user and time). The eye (**View result**) opens the result of a batch, the Excel icon downloads its errors and, for the migration workbook, the chart icon downloads its reconciliation.

## Migration rules and reconciliation

The migration workbook is refused until the cutover date is set: the tab **Upload and Validate** then says **Set the cutover date (golive.cutover_date) first**. The cutover date is the first day of live transactions and is set on Master > Configuration, area Company & Branding, group **Go-live**, or on the Settings sheet of the configuration workbook.

![Master > Configuration: the Go-live settings](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-config-golive.png)

- A line of business on the Commission Rates sheet of the configuration workbook, or on the Commission Rate Matrix screen, must be a code of the Line of Business master; a rate on an unknown line is refused.
- Rows dated on or after the cutover date are refused: policy issue date, claim loss and reported dates, client birth date. Policies must still be in force at cutover. Open claims are registered or in review.
- Opening balances are the trial balance of the old system at the close of the day before the cutover date. Debits must equal credits, and the fiscal year of the cutover date must have no journal posted before it. A row with no debit and no credit (an account whose movements net to zero) is accepted and ignored, with a note above the counts. The sheet loads all or nothing: when it fails, the rows in error show their own error, the other rows are counted as **Held**, and one message with the row **Sheet** says why nothing was loaded.
- Migrated records keep the numbers of the old system. New business takes the next number of its Document Numbering series, set on the Numbering sheet. Both workbooks refuse a number that the other side would also issue: raise the next number of the series above the old range first. A reset of test transactions restarts each series at the next number the Numbering sheet set, so the sheet need not be loaded again after a reset.
- An open item keeps the bill number of the old system as its bill number. Only when another bill already has that number (one debit note over several policies) does it get the next BrokerVerse invoice number; the old number is then shown with it, for example INV-2026-00011 (old system DN-OLD-77), on Add Receipt and the billing statements, and the open receivables can be searched by it.
- A migrated policy is renewed like any other policy; its renewal is new business in BrokerVerse.
- Migrated records post nothing: no bill, booking journal or commission accrual for a policy, no booking journal for an open item (the GL carries it in the opening balance), no e-mail, notification or journal for an open claim. Migrated policies count as policies in force but not as premium written or new business on the Executive Dashboard.

Every validation and load of the migration workbook shows a **Reconciliation**: per sheet the **Workbook rows** and **Workbook totals** (premium, sum insured, open balance, claim estimate, debits and credits) against the records and totals **In BrokerVerse**, and the checks that the trial balance balances and that the premiums receivable control account equals the open items of the cutover date, each with **Agrees** or **Difference**. Compare these totals with the old system before go-live; **Download reconciliation** gives them as a workbook.

## Go-live lock

When the data is loaded and reconciled, switch on the go-live lock on Master > Configuration, group **Go-live** (`golive.locked`). From then on the migration workbook can no longer be uploaded, validated or loaded, and the reset of test transactions refuses to run. The configuration workbook stays available for new masters. Agree the moment with the project lead: the lock is the formal end of the migration.

# Sales & Marketing (Account Executive)

## Role summary

The account executive (role Sales & Marketing (Account Executive)) finds and records prospects, quotes package products on the spot, asks the Processing Team to market non-package risks, sends quotations to clients and records their answers, records the client's payment for Accounting to verify, follows renewals and watches his or her own production and commission. Commission and incentives are earned on the policies the account executive produces (`commission.eligible_roles`, `incentive.eligible_roles`).

![Sales Dashboard of an account executive](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-sales-dashboard.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Executive Dashboard, Sales Dashboard |
| Operations | Home; Sales & Marketing (Prospects, Quick Quote, Request for Quotation (Broker Slip), Quotations, Placement Slips, Lead Assignment, Dealer Programmes, Comparison Reports, Campaigns, Sales Activities); Clients; Policy; Fleet Schedules; Marine Open Covers; Claims; Renewals (Renewal Policy, Renewal Batch, Renewal Queue, Retention Analytics, At-Risk Policies, Negotiations, Lapse Management, Performance); My Work; Payments; CTPL Authentication; Cover Notes; Policy Cancellation |
| Commission | Commission Dashboard |
| Reports | All Reports; Operational Reports (Production, Claims, Renewal, Remittance, Broker Commission, Dealer Production); Report Builder |
| Master | Insurance > Distribution Channels |
| Product Configurator | Dashboard, Product Templates |

Lead Assignment, Dealer Programmes, Comparison Reports, Campaigns, Fleet Schedules and Marine Open Covers are described in the chapter Distribution, programmes and products; Cover Notes, Policy Cancellation and CTPL Authentication in the Operations chapter.

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Record new prospects and follow them up; log every call, meeting, e-mail and visit | Prospects, Sales Activities |
| Daily | Quote motor and other package products | Quick Quote, Quotations |
| Daily | Send quotations for customer approval; record the answers received | Quotations |
| Daily | Record the client's payment | Policy > **Proceed to Payment** |
| Daily | Work the quotations still with the customer and the pending payments | My Work |
| Weekly | Follow up the renewals of your clients | Renewals > Renewal Queue, At-Risk Policies, Negotiations |
| Weekly | Give the client the comparison of the insurers' offers; follow up the campaigns | Comparison Reports, Campaigns |
| Monthly | Check your production, commission and incentives | Sales Dashboard, Commission Dashboard, Reports > Operational Reports > Production |

## Sales Dashboard

Choose Dashboard > Sales Dashboard. The dashboard shows the prospects, quotations and new business of the sales team for the period chosen at the top (**All sales persons** or one person, **This month** or another period, or a **Custom range**): **Prospects**, **Quotations**, **Conversion** (quote to policy), **Policies issued**, **Premium** and **Open pipeline**, with the monthly trend, premium by product, the prospect pipeline and the quotation pipeline. **View prospects** opens the prospect list.

The Executive Dashboard is described in the chapter Reports, dashboards, schedules and notifications.

## Prospects

![Operations > Sales & Marketing > Prospects](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospects.png)

Choose Operations > Sales & Marketing > Prospects. The cards count **Total Prospects**, **Last 7 Days**, **Last 30 Days**, **Converted Prospects** (with the conversion rate), **With Quotations** and **Active Prospects**. One tab per line of business of the active products (**Motor** first, then for example **Credit Life**, **Marine** and **Personal Accident**) lists the prospects of that line, and the last tab, **Product not yet tagged**, the prospects created without a product. The table has the columns **Prospect ID**, **Name**, **Category**, **Product line** (the product, or **Product not yet tagged**), **Mobile**, **E-mail**, **Quotations**, **Created on**, **Status** and **Actions** (**View**, **Tag product** or **Change product**, **Edit** and **Delete**). Use the search box (name or prospect ID), the **Category** filter and **Show Filters** (country, province, city) to narrow the list. The search, filters, tab and page are kept when you open a prospect and come back.

### Create a prospect

1. Select **Create Prospect**. The **Create prospect** panel asks whether the customer is new or already a client.
2. Choose **New customer** (enter the customer's details on the prospect form) or **Existing client** (find the client by name, mobile number or e-mail; the prospect is linked to that client), then select **Continue**.
3. Choose the product the prospect is for: first the **Line of Business** (only the lines that have active products are listed), then the **Product** (the active products of that line; a line with a single product selects it). Select **Continue**. A motor product opens the prospect form; Fire and Allied Perils, Industrial All Risks and Employee Benefits open their own forms while those products are active; any other product opens a Request for Quotation for the new prospect.
4. If the customer has not chosen a product yet, select **Skip - tag product later** instead: the prospect form opens without a product.

Every way of starting a new prospect goes through this panel: **Create Prospect** on Prospects, **Create Lead** on Clients, **New Quote** on the Executive Dashboard, the Underwriting Dashboard buttons and a prospect form opened from a link or the side bar. Editing a prospect or adding a quotation to an existing prospect opens its form at once.
5. Fill in the prospect form and select **Save & Continue**.

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
| **Country**, **Region**, **Province**, **City / Municipality**, **Barangay** | Yes (Region optional) | From the PSGC address masters; choose the country first (Philippines by default), then the region or the province, then the city or municipality, then the barangay. |
| **ZIP Code** | Yes | 4 digits; filled in from the barangay or city when known. |
| **House / Unit No.**, **Street / Subdivision** | House / Unit No. yes | The street address. |

The system gives the prospect its number (LD-YYYY-NNNNN) with status New and, for a motor prospect, opens **Create Quote** for it. Fire and Allied Perils and Industrial All Risks prospects also ask for the risk location and the sums insured. A prospect created with **Skip - tag product later** opens on its **Prospect Details**, with the note that its product is not yet tagged, and is listed on the tab **Product not yet tagged**.

> **Note:** When the setting `leads.product_required` is on (System Settings, group leads), **Skip - tag product later** is not offered and every new prospect must name its line of business and product.

### Tag the product later

Select **Tag product** (the tag icon) on a prospect row, or **Tag product** on **Prospect Details**. Choose the **Line of Business**, then the **Product**, and select **Tag product**. The prospect moves to the tab of its line. The same action, shown as **Change product** once a product is tagged, changes the line and product; each change is kept in the audit trail (action tag-product, with the line and product before and after).

When you select **Create Quote** (or **Add quote** on the prospect's quotations) for a prospect whose product is not yet tagged, the system first asks for the line of business and the product of the quotation, tags the prospect with them and then opens the screen of that product.

Lead assignment: a rule with a line of business does not match a prospect without a product, so such a prospect follows the rules without a line, else `leads.assignment_fallback`. A prospect that waits in the reassignment queue because no rule matched it is offered to the rules again when its product is tagged.

### View, edit or delete a prospect

![Prospect Details](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospect-detail.png)

Select the eye (**View**) on a prospect row. **Prospect Details** shows **Personal Information** (with the **Line of business and product**, or **Product not yet tagged**), **Contact Information**, **Address Information** and **System Information** (created, last updated, number of quotes). Select **Create Quote** to start a quotation, **Tag product** or **Change product** to set the line of business and product, **Edit** to correct the prospect (the form shows the same fields; select **Update** to save), **Delete** to remove a prospect entered by mistake, or **Back**. Keep prospects that have quotations.

| Prospect status | Set when |
|---|---|
| New | The prospect is created. |
| Contacted, Qualified | The prospect is followed up. |
| QuoteGenerated | A quotation is saved for the prospect. |
| Converted | A policy is issued from one of its quotations; the prospect becomes a client. |
| Lost | The prospect does not buy. |

### Upload many prospects

1. Select **Bulk Upload**.
2. Select **Download Template** and fill in one prospect per row. **LOB** (line of business) and **Product** (code or name of an active product of that line) are optional: a row without them creates a prospect whose product is tagged later; a product that is not a product of the row's LOB is refused with the reason.
3. Select **Choose File**, choose the file (.xlsx or .csv, at most 10 MB) and select **Upload**.

The system checks every row and reports the rows it could not load with the reason. **Generate Report** downloads the prospect list as a spreadsheet.

![Bulk upload prospects](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-prospect-bulk.png)

## Quick Quote

![Operations > Sales & Marketing > Quick Quote](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quick-quote.png)

Quick Quote offers the package products: standard tariff and wording, quoted on the spot. Choose the **Line of Business**, then the **Product** (a line with a single product selects it). The card of the product shows whether it is for retail or corporate clients, and one of two buttons:

- **Start quote**: the product has a quote wizard (Motor Vehicle Insurance, Compulsory Third Party Liability). Enter the customer and the vehicle; the premium is priced from the tariff. The wizard starts with the prospect form when the customer is not yet a prospect.
- **Request quotation**: the product has no quote wizard yet. The button opens a Request for Quotation so the Processing Team gets the terms from the insurers.

**Request for Quotation (non-package)** at the top opens a new request for a risk that is not a package product.

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

On the coverage step, own damage is priced from the sum insured (the market value) and the rate of the motor tariff; CTPL is the Insurance Commission tariff of the vehicle class, inclusive of taxes and fees; the optional covers are those of the product template (Acts of Nature, excess Bodily Injury and Property Damage, Roadside Assistance, Personal Accident and Auto Passenger PA, limit per person x seats covered, with the delivered template; see Covers and risk details of the product below). Select **Calculate** after every change. The order summary shows:

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

### Covers and risk details of the product

The quotation follows the product template that governs it (the motor pricing template, `motor.pricing_template_code`; Product Configurator > Product Templates).

**Risk details for the product rules** (step 1, below the vehicle): the wizard asks for the details the template's acceptance rules and rating factors test, so that every rule is checked when the quotation is priced. With the delivered motor template these are the **Driver's date of birth** (the driver age is computed from it), **Claims in the last 3 years**, **Fair market value of the vehicle**, **The vehicle has modifications**, and the **Claim-free years (NCB)** and **Vehicles in the fleet** the rating factors use. A field marked * is tested by an acceptance rule and must be filled in before **Next**; a group or personal accident risk asks for the **Number of members**. The vehicle use, model year and sum insured are taken from the vehicle and cover fields. When a rule or factor is added on the Product Configurator, its field is asked for on the next quotation.

| Detail | Rule that uses it (delivered template) |
|---|---|
| Driver's date of birth | Driver under 21: 15% loading; driver age rating factor |
| Claims in the last 3 years | Two or more claims: 20% loading |
| Fair market value | Sum insured above the fair market value by more than 10%: referred |
| The vehicle has modifications | Modified vehicle: referred |
| Vehicle use (step 1) | Public utility vehicle: declined |

**Covers of the product** (coverage step, at the top): the covers of the template's Coverage Builder. A **Mandatory** cover is always included and cannot be unticked; an **Optional** cover is ticked to quote it and unticked to leave it out (its fields are then hidden and its premium is zero). Each cover is priced on the quotation premium of its **Priced on quotation as** setting (own damage and theft, acts of nature, roadside assistance, personal accident, excess bodily injury, property damage, auto passenger PA, CTPL). A cover that the template does not list is not offered. A cover without a quotation premium is quoted for its terms only. Select **Calculate** after a change.

When the quotation is saved the server prices it on the same covers (a mandatory cover is added if missing; a cover that is not on the template is refused) and evaluates the acceptance rules on the risk details: none is left "not evaluated". With `underwriting.require_rule_fields` on, the server also refuses a quotation that lacks a detail an acceptance rule tests (for example a quotation created by upload).

## Quotations

![Operations > Sales & Marketing > Quotations](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quotations.png)

Choose Operations > Sales & Marketing > Quotations. The cards count **Total Quotations**, **Active Quotations**, **Pending Review**, **Approved Quotations** (with the approval rate) and **Converted to Policy**, with the **Average Premium**. The list shows **Quote ID**, **Prospect Name**, **Policy Type**, **Gross premium**, **Date** and **Status**; **View Details** opens a quotation. **Create Quote** asks for the **Line of Business**, then the **Product**, and opens the screen the product is quoted on (motor and fire quotations start from a prospect; any product without a quote screen opens a Request for Quotation); **Bulk Upload** loads quotations from a template.

| Status | Meaning | Next step |
|---|---|---|
| Draft | Saved, not sent; can still be edited. | **Send for Customer Approval** |
| Pending Customer | Sent to the client; waiting for the answer. | The client accepts, or **Record customer response** |
| Customer Accepted | The client accepted; the placement slip is raised automatically. | **Open Placement Slip** |
| Approved | Approved by a user other than the creator. | Placement slip |
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
| Accepted | Customer Accepted: the placement slip is raised. |
| Declined | Rejected. |
| Revise | Draft: change the quotation and send it again. |

**Share** offers **Download**, **Email**, **WhatsApp**, **Send to Insurer** and **Copy link**.

![Share Quote](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-quote-share.png)

### From the accepted quotation to the policy

When the client accepts, the placement slip is raised automatically (setting `placement.auto_raise`) and the quotation shows it in its journey; the Processing Team continues as described in its chapter. If it could not be raised (for example no insurer is named on the quotation), the owner is notified with the reason and selects **Create Placement Slip** once it is fixed. The quotation itself never becomes a policy: the policy is booked from the placement slip once the insurer has issued it.

For motor lines, select **Proceed to Policy** on the accepted quotation to capture what the policy needs, so that it is not keyed again later:

1. **Customer information**: the government ID (**ID Type**, ID card number and a scan of the ID card), **Motor Number**, **Chassis Number** and **Plate Number** or **MV File Number**, and the optional mortgagee, CTPL certificate number and authentication code. The plate or MV file number may still be TBA on the quotation; it is required when the e-policy is recorded. The accepted ID types are PhilSys ID, UMID, Passport, Driver's License, PRC ID, SSS ID, GSIS ID, TIN ID, Postal ID, Voter's ID and Senior Citizen ID (`policy.kyc_id_types`); the policy is not booked without the fields in `policy.kyc_required_fields`.
2. **Vehicle photos**: left side, right side, front, rear and interior.
3. **Review**: the policy, assured, vehicle, coverage, premium and the participating insurers with their shares, and the billing mode (broker billed or direct bill). **Send to Insurance Company** opens the placement slip of the quotation.

## Sales activities

Account executives log every call, meeting, e-mail and visit with a prospect, a client or on a quotation. Each prospect, client and quotation shows its activities as a timeline, newest first: a prospect and a client also show the activities logged on their quotations (with the quotation number), and a client those of the prospect it came from. The open next step is shown above the timeline.

To log an activity:

1. Open the prospect (Prospects > **View**), the client (Clients > **View**) or the quotation (Quotations > **View Details** > **Activities** tab).
2. In **Activities**, select **Log activity**.
3. Choose the **Activity type** (phone call, meeting, client or site visit, e-mail, video call, SMS or chat message, proposal presentation) and the **Date and time** it took place. The subject takes the type's name unless you enter one.
4. Enter the **Duration**, **Contact person**, **Location** and **Notes** as needed, and the **Outcome** (interested, documents requested, quotation presented, accepted, call back, no answer, not interested, placed elsewhere).
5. Enter the **Next step** and its **Next step date** (the date proposed is the type's default days to the next step). Select **Save**.

| Rule | Detail |
|---|---|
| Date | An activity is logged once it has taken place, up to `sales_activities.backdate_days` (30) days back. |
| Next step | A next step with a date becomes a follow-up task in the account executive's My Work (source Sales activity next step), due on that date, with the usual reminder. A next step date needs the next step text; `sales_activities.next_step_required` makes both compulsory. |
| Later activity | An activity logged on the same record completes the open follow-up of the earlier activity (`sales_activities.close_previous_follow_up`). |
| Change or cancel | The pencil changes an activity (a new next step date moves its task); the cross cancels an activity logged in error with a reason, and cancels its open task. Only the account executive, who logged it or their manager can do this. |
| Prospect status | A New prospect becomes Contacted with its first activity. |
| Access | Sales & Marketing and Operations log activities (write:sales-activities); the Processing Team reads them; a scoped role sees only its own book. |

The follow-up task priority is `sales_activities.follow_up_priority` (normal). The activity types (channel and default days to the next step) and outcomes (positive, neutral or negative, used by the report) are kept by the System Administrator on Master > Organization > **Sales Activity Types** and **Sales Activity Outcomes**.

![Operations > Sales & Marketing > Sales Activities](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-activities.png)

Operations > Sales & Marketing > **Sales Activities** lists the activities of a period (**From**, **To**) with filters for the account executive, type and outcome and a search; select a row to open the prospect, client or quotation. The **Activity Report** tab sums, per account executive, the activities by channel (calls, meetings, e-mails, visits), the prospects, clients and quotations worked, the positive outcomes, the next steps set and their follow-ups done, open and overdue, with the totals by activity type and by outcome. **Export to Excel** downloads the list or the report.

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

Choose Operations > Policy. The list shows **Policy Number**, **Client Id**, **Client Name**, **Gross Premium**, **Policy Issued**, **Policy Expiry**, **Product Description** and **Payment** status. The search box finds a policy by number or client. **Show Filters** offers **Payment Status**, **Product Type**, **Insurance Company**, **Client Name**, issue and expiry date ranges and minimum and maximum premium.

The eye on a row (**View policy**) opens the policy; the three dots (**More actions**) open **Claim** and **Endorsement**. Both are greyed out while the premium payment is Pending or Reviewing, and **Endorsement** is not offered for expired, lapsed, cancelled or renewed policies.

![More actions on a policy row](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-policy-rowmenu.png)

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

The account executive uses the same renewal screens as Operations (Operations chapter) for his or her own clients: the **Renewal Queue** filtered by **Sales person**, **At-Risk Policies**, and **Negotiations** to record contacts and request approval of renewal terms. **My Work** shows your daily worklist (quotations, renewals, premiums due, collection follow-ups, claims, approvals and your tasks); **Payments** shows the premium of your policies by **Paid**, **Pending** and **Reviewing**; **Clients** opens the client record with its policies, claims, renewals and endorsements.

## Commission and reports

![Commission > Commission Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-commission-dashboard.png)

Commission > Commission Dashboard shows live figures from the commission ledger: brokerage income, comsub (gross), net margin and margin %, outstanding payable and the withholding tax withheld, with comsub by referrer, lines by status (Accrued, Eligible, Approved, Paid) and the monthly trend. **Accounting** and **Management** switch the view.

Reports > Operational Reports > Production opens the Production Register; Reports > Report Builder answers ad hoc questions over the policies, clients, bills, claims and commissions of your own book (chapter Distribution, programmes and products); All Reports lists every report the role may run (Production Register, Claims Position, Renewal Retention, Remittance Summary, Broker Commission Statement, Premium by Product / Month / Insurer, New Business vs Renewals, Claims Ageing, Lead Conversion Funnel, Placement Pipeline, Market Response, Co-insurance Register, SOA / Premium Receivable, Receivables Ageing, Incentive Results). The chapter Reports, dashboards, schedules and notifications explains how to run them.

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

The Processing Team (role Processing Team (Placement & Policy Processing)) works the market side of the business. It sends requests for quotation to insurers, records their offers and declines, compares them and chooses the security, prepares Quotation Slips, sends placement slips (firm orders) and records the insurers' confirmations, issues and checks policies, records policies the insurer issued, completes endorsements with the insurer's document, approves renewal terms, and maintains the product templates and the motor tariff.

![Processing Dashboard (Processing Workbench)](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-processing-dashboard.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Processing Dashboard, Executive Dashboard |
| Operations | Home; Sales & Marketing (Prospects, Request for Quotation (Broker Slip), Quotations, Placement Slips, Dealer Programmes, Comparison Reports, Sales Activities); Clients; Policy; Fleet Schedules; Marine Open Covers; Claims; Renewals (all items); My Work; Payments; CTPL Authentication; Cover Notes; Policy Cancellation |
| Reports | All Reports; Operational Reports; Report Builder |
| Master | Insurance > Distribution Channels |
| Product Configurator | Dashboard, Product Templates, Coverage Builder, Rating Engine, Acceptance Rules, Document Manager, Market Mapping, Risk Mapping, Product Analytics |

The Processing Team reads prospects and their sales activities but does not create them, and has no Quick Quote: Quick Quote creates prospects and quotations, which is Sales and Operations work. Dealer Programmes, Comparison Reports, Fleet Schedules, Marine Open Covers are described in the chapter Distribution, programmes and products.

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Work the submissions and open tasks | Processing Dashboard |
| Daily | Send requests for quotation; record offers and declines | Requests for Quotation (Broker Slips) |
| Daily | Compare offers and prepare Quotation Slips or Placement Slips | Request for Quotation > Compare offers |
| Daily | Send placement slips, record acknowledgements and e-policies, check them against the slip, book the policies the insurers issued | Placement Slips |
| Daily | Complete endorsements with the insurer's document | Policy > endorsement |
| Daily | Approve renewal terms | Notification; Renewals > Negotiations |
| On receipt | Record the e-policy an insurer sent | Placement Slips > **Record e-Policy** |
| On request | Issue a cover note while the insurer issues the policy; issue a fleet schedule or a marine open cover | Operations > Cover Notes, Fleet Schedules, Marine Open Covers |
| When rates change | Maintain the motor tariff and product templates | Product Configurator |

## Processing Dashboard

Choose Dashboard > Processing Dashboard. The **PROCESSING WORKBENCH** shows, for the period chosen at the top (for example **This Week**): **NEWLY RECEIVED SUBMISSIONS** and **OLDER SUBMISSIONS** (quotations waiting for action), **AVG. CYCLE TIME**, **OPEN ALERTS** (Duplicate Submission Detected, Missing TIV and Proposed Dates, Missing LOB, Type or Broker), **WORKLOAD METRICS**, the **SUBMISSIONS LIST** (case ID, proposed insured, account executive, face amount, product type, risk score, next requirement due, priority and status) and **Open Tasks**. **New Submission** starts a quotation.

## Requests for quotation (broker slips)

![Operations > Sales & Marketing > Request for Quotation (Broker Slip)](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-rfq-list.png)

Choose Operations > Sales & Marketing > Request for Quotation (Broker Slip). The cards count the requests by status (**Submitted**, **Responses in**, **Draft**, **Closed**); select a card to filter. Each row shows **Slip No.**, **Insured**, **Product**, **Sum insured**, **Offers / approached** (with the number declined), **Best offer (gross)**, **Response due**, **Age**, **Status** and the **Quotation Slip** made from it. Select a row to open it.

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
2. Under **Customer and risk**, choose **Customer**: **Client** (an existing client), **Prospect** or **New prospect**, and search for the record. Choose the **Line of Business**, then the **Product** of that line (every active product is offered, package or not). A new prospect saved with the request is tagged with the product. **Insured** fills in; change it if the slip is for another named insured.
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

A Quotation Slip prepared from a request is a quotation (QT-YYYY-NNNNN) with the chosen insurer or insurers and their shares. It opens on Quotations like any other quotation, shows its placement journey and follows the statuses and the customer response described in the Sales & Marketing chapter. The account executive sends it to the client; when the client accepts, its placement slip is raised automatically.

![A Quotation Slip converted to a policy, with its placement journey](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-quotation-slip.png)

## Placement Slips

![Operations > Sales & Marketing > Placement Slips](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ps-list.png)

The broker never issues cover. A placement slip goes to the insurer, the insurer acknowledges it and returns the e-policy, the e-policy is checked against the slip and only then is the policy booked. No screen lets a user complete cover without the insurer.

Choose Operations > Sales & Marketing > Placement Slips. The cards count each step: **Placement raised**, **Sent to insurer**, **Acknowledged**, **e-Policy received**, **Checked against slip** and **Insurer issued (Booked)**; a card filters the list. The filters choose a status and a source. Each row shows **Placement No.**, **Insured**, **Product**, **Lead insurer**, **Gross premium**, **Period**, **Source** (From quotation slip, From broker slip, Direct placement, or Recorded policy for older records), **Status** and the **Policy** booked.

| Status | Meaning |
|---|---|
| Placement raised | Prepared and its slip PDF stored; participants can still be changed. |
| Sent to insurer | The firm order was e-mailed to each participant with its placement slip attached. |
| Acknowledged | The insurer confirmed receipt of the order. |
| e-Policy received | The e-policy the insurer issued was uploaded and its figures keyed; it waits for the check. |
| Checked against slip | A second user confirmed that the e-policy matches the slip, or an approver accepted the differences. |
| Insurer issued (Booked) | The policy is in force: bill, journal and commission booked, schedule e-mailed to the client. |
| Declined | A participant declined its line: edit the participants or cancel the slip. |
| Cancelled | Withdrawn with a reason. |

A placement slip is raised automatically when the client accepts a quotation, from **Prepare Placement Slip** on a request, or from **New direct placement** when the client instructs placement with named insurers and no quotation is needed (CTPL).

### Create a direct placement

![Direct Placement](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ps-direct.png)

1. Select **New direct placement**.
2. Fill in **Customer and risk** (**Customer**: Client, Prospect or New insured; **Line of Business** and **Product**; **Insured**; **Risk details**). For CTPL attach the **LTO document / official receipt**; it is required (setting `placement.direct_document_products`) and goes to the insurer with the slip.
3. Under **Period and premium**, enter **Inception** (required), **Expiry**, **Sum insured**, **Net premium** (required), **Commission rate** (empty: the insurer's default) and **Billing mode** (empty: System default), and **Remarks**.
4. Under **Security (participating insurers)**, choose each insurer with **Add insurer**, enter its **Share** and tick **Lead** for one of them. The line under the table says whether the shares total 100% and whether the placement is a co-insurance or a single insurer.
5. Select **Create Placement Slip**.

The rules: at least one insurer; an insurer can take part only once; every share above 0%; exactly one lead; shares total exactly 100%. Motor comprehensive cannot be placed without a quotation.

### Send to the insurer and record the acknowledgement

![Placement Slip PS-2026-00023 with its security, premium and summary](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-ps-detail.png)

1. Open the placement slip. **Security (participating insurers)** lists each insurer with role (Lead or Co-insurer), **Share**, **Sum insured**, **Premium**, **Taxes**, **Gross**, **Commission**, **Policy / certificate no.** and **Status**. Below are the **Premium** breakdown, the **Summary** (with the stored **Placement file**) and the **Risk**.
2. Select **Send to insurer(s)**. Each participant receives an e-mail with its own placement slip PDF attached (and the LTO document of a direct CTPL); the status becomes **Sent to insurer**. **Resend to insurers** sends it again, for example after the e-policy was returned.
3. When the insurer confirms receipt, select **Record acknowledgement**, enter its reference and a remark, and save. The status becomes **Acknowledged**.
4. When an insurer declines its line, select **Declined** on its row and record the reason. Then use **Edit participants** to replace the insurer or change the shares so that they total 100% again, and send again.

**Slip PDF** prints the placement slip; the PDF icon on a participant's row prints the slip for that insurer's share.

### Upload the e-policy

When the insurer sends the issued policy, select **Upload e-policy** (or use **Record e-Policy**, below). Attach the e-policy file and key what it says:

- **Insurer policy number** (required) and **BrokerVerse policy number** (blank: numbered by the system at booking);
- **Participant name** (the insured named on the policy), **Sum insured**, **Net premium**, **Gross premium** and **Commission**;
- **Issue date** and **Effective date** (required), **Issuance date**, **Expiry date** and **Production date**;
- the **Deductible**, and for motor the **Chassis**, **Engine / motor**, **Plate** and **MV file** numbers. They are carried from the quotation; the plate number or the MV file number is required here even where the quotation said TBA;
- the **References of the co-insurers**, an optional **Vehicle photo** and **Remarks**.

The system compares the e-policy with the slip at once; the status becomes **e-Policy received** and the e-policy card shows **Matches the slip** or **Differs from the slip**.

### Check against the slip

The check is made by a user other than the one who uploaded the e-policy (maker-checker, setting `placement.check_maker_checker`).

1. Select **Check against slip**. The slip and the e-policy are shown side by side: net premium, gross premium, sum insured, commission, effective and expiry dates, insured, vehicle identifiers and deductible (setting `placement.check_fields`). An amount within the tolerance matches: the larger of `placement.check_tolerance_amount` (1.00) and `placement.check_tolerance_pct` of the slip amount. Differences are highlighted; a value the quotation did not have (a plate number given as TBA) shows as **Captured**.
2. When everything matches, select **Confirm check**. The status becomes **Checked against slip**.
3. When there are differences, enter a reason and either select **Return to insurer**, which e-mails the differences to the lead insurer and sets the slip back to **Acknowledged** until a corrected e-policy is uploaded, or, for an approver with policy issuance rights, **Accept differences**, which records the reason and sets the slip to **Checked against slip**.

### Book the policy (Insurer issued)

On a checked placement slip, a user with policy issuance rights selects **Book (Insurer issued)**, checks the ID details proposed for a motor risk and confirms. The system:

- creates the policy with the e-policy's numbers, insured name and dates, copies the participants, shares and insurer references to it, and makes it active;
- creates the client from the prospect if the insured is not yet a client;
- raises the premium bill to the client (broker billed) or books the commission due from the insurers (direct bill), posts the journal and accrues the commission;
- ends the active cover notes of the quotation or placement;
- e-mails the policy schedule, with the insurer's e-policy, to the client's registered e-mail address (setting `placement.schedule_email_on_booking`);
- sets the slip to **Insurer issued (Booked)** and links the policy. The message reads Policy (number) booked.

Nothing is booked before this step: there is no policy, bill or commission for a placement that is not yet checked. A quotation of a line that requires a placement slip is refused at **Proceed to Policy** with the message This line requires a Placement Slip before the policy is issued.

## Record e-Policy

Use **Record e-Policy** to key the e-policies the insurers send back without searching for each placement slip. Choose Placement Slips and select **Record e-Policy**: the list shows the placement slips sent to the insurer or acknowledged. Select a row, then fill in the e-policy as described in Upload the e-policy. The placement slip opens afterwards for the check against the slip by another user.

## Co-insured policies and premium accounting entries

![Policy POL-2026-00052: a co-insured fire policy](/home/user/BDOI-OOTB/docs/package/source/manual-images/p-policy-fire.png)

**Policy Details** of a co-insured policy shows **CO-INSURANCE DETAILS**: each insurer with **Insurer share (%)**, **Premium allocation (LC)** and **Status**, and the total. The placement slip of the policy shows each participant with role, share, sum insured, premium, taxes, gross premium, commission and policy or certificate number. Amounts are split by share; the rounding remainder goes to the lead. The same split is used for the bill journal, the remittance to each insurer, claim recoveries and the reports. **Premium Accounting Entries** (Documents & Billing on the policy) lists every journal line of the policy with **Code**, **Entry Type**, **Description**, **Document Date**, **Due Date**, **Main Account**, **Dr/Cr** and **Amount**; **Filter by Entry Type** narrows the list.

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

The lists of Coverage Builder, Rating Engine, Acceptance Rules and Document Manager have a **Template** column: the code of the product template a cover, factor, rule or document belongs to, or **All products** for one that applies to every product. Select the column heading to sort by template.

To maintain the motor tariff, open the motor template with the pencil on Product Templates and its CTPL and Auto PA tab: for each vehicle class check the name, code, default seats and the CTPL amounts for 1 and 3 years; set the Auto Passenger PA rate and the limits per person offered; save the template. The quotation screens use the new values at once. The tax rates come from Master > Configuration and are shown read-only in the template.

## Approvals

| Approval | Given or needed |
|---|---|
| Renewal terms of Operations and Sales | Given by the Processing Team. |
| Quotations sent for approval | The Processing Team is notified and may approve quotations it did not create. |
| Insurer confirmations | Recorded by the Processing Team; the policy is issued only when all participants have confirmed. |

# Operations (client servicing)

## Role summary

Operations (role Operations (Client Servicing)) looks after the clients once they are on the books: client onboarding and due diligence, client records, endorsement requests, cover notes, cancellations, CTPL authentication, recording the client's payment, the daily worklist, renewals and the documents sent to clients. Operations can also record prospects and quote package products in the same way as Sales & Marketing, and supports the Data Protection Officer.

![Operations > My Work, the daily worklist of the role](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-my-work.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Executive Dashboard |
| Operations | Home; Sales & Marketing (Prospects, Quick Quote, Request for Quotation (Broker Slip), Quotations, Placement Slips, Lead Assignment, Dealer Programmes, Comparison Reports, Campaigns, Sales Activities); Clients; Policy; Fleet Schedules; Marine Open Covers; Claims; Renewals (Renewal Policy, Renewal Batch, Renewal Queue, Retention Analytics, At-Risk Policies, Negotiations, Lapse Management, Performance); My Work; Payments; CTPL Authentication; Cover Notes; Policy Cancellation |
| Reports | All Reports; Operational Reports; Report Builder |
| Master | Insurance > Distribution Channels; Data Privacy (Data Subject Requests, Consent Register) |
| Product Configurator | Dashboard, Product Templates |

Data Privacy is described in the System Administrator chapter, and Lead Assignment, Dealer Programmes, Comparison Reports, Campaigns, Fleet Schedules and Marine Open Covers in the chapter Distribution, programmes and products.

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Work expiring policies, pending payments, pending quotations and renewal requests | My Work |
| Daily | Answer client requests: policy details, documents, changes | Clients, Policy |
| Daily | Onboard new clients and complete their identification | Clients > **Onboard client** |
| Daily | Raise endorsement requests; compute cancellations | Policy > **More actions** > **Endorsement**; Policy Cancellation |
| Daily | Issue cover notes while the insurer issues the policy | Cover Notes |
| Daily | Check that every CTPL certificate of cover is authenticated | CTPL Authentication |
| Daily | Record client payments | Policy > **Proceed to Payment** |
| Daily | Work the renewal queue and record contacts | Renewals > Renewal Queue, Negotiations |
| Weekly | Batch renewal notices; at-risk and lapsed policies | Renewal Batch, At-Risk Policies, Lapse Management |
| Monthly | Retention and renewal performance | Retention Analytics, Performance |

## Home

**Home** (the first item of the menu, and the page every role lands on after sign-in) is **My Work** with a preset for the user's role, so that each user starts the day on what they have to do. The page is the same screen as Operations > My Work (next section): the title **My Work**, a subtitle with the role, today's date and the user's branch (or the company when no branch is set), the five My Work figures followed by two or three plain figures of the role, and the tabs My Items, My Team (managers), My Tasks and Calendar. The address `/agent/home` and the former Open Items and Upcoming Events addresses open Home.

The role preset decides which categories are listed first on My Items (the others follow, tasks last), whose items are shown by default (**Mine**; **Everyone** for an oversight role; a manager also has **My team**), which categories the Calendar shows, the one primary button of the page and the role figures. A user with several roles gets the most specific preset (System Administrator, then Accounting Manager, Accounting, Claims, Processing Team, Operations, Sales); a custom role gets the plain My Work.

| Role | Categories first | Default scope | Calendar shows | Primary button | Role figures |
|---|---|---|---|---|---|
| Sales & Marketing | Quotations, Renewals, Premiums due, Missing documents, Endorsements | Mine | Quotations, renewals, premiums due, endorsements, approvals | **New quote** (Quick Quote) | Quotes this month, Conversion (90 days), Renewals due in 30 days, over the user's own book |
| Processing Team | Requests for quotation, Placement slips, Quotations, Endorsements, Renewals, Approvals, Missing documents | Mine | Requests for quotation, placement slips, renewals, approvals | **Cover note** | Policies issued this month, Pending issuance (bound placements and approved quotations), RFQs with the insurers |
| Operations | Endorsements, Renewals, Missing documents, Quotations, Premiums due, Approvals | Mine | Renewals, endorsements, approvals | **Cover note** | Endorsements in progress, Renewals due in 30 days |
| Claims | Claims, Approvals | Mine | Claims, approvals | **Register claim** | Open claims, Average days open, Registered this month |
| Accounting | Premiums due, Collection follow-ups, Approvals, Bank reconciliations, Period close | Mine | Premiums due, collections, approvals, bank reconciliations, period close | **Record receipt** | Overdue receivables, Collections this month |
| Accounting Manager | Approvals, Period close, Bank reconciliations, Premiums due, Collection follow-ups | Everyone | Approvals, period close, bank reconciliations, premiums due | **Approvals** (shows the approvals waiting) | Overdue receivables, Collections this month, Vouchers awaiting approval |
| System Administrator | Users and access, System health, Approvals | Mine | Users and access, system health, approvals | **New user** | Active users, Failed jobs (24 h), Awaiting first sign-in |

The categories added for these presets are listed below with the other categories of My Items; every category is shown only to a role that may read its records, and the items follow the user's record scope.

## My Work

**My Work** (Operations > My Work, and Home with the role preset) is the one place where each user finds what is waiting for them. It replaces the former Open Items screen; its old addresses open My Work.

The header shows five figures: **Overdue**, **Due today**, **Next 7 days** (the number of days is the setting `myWork.due_soon_days`), **Open items** (with the number of high-priority items) and **Open tasks**. Select a figure to filter the list.

The screen has four tabs:

| Tab | What it shows |
|---|---|
| My Items | Every open item you own or may act on, by category: quotations, Requests for Quotation, placement slips, renewals and expiring policies, premiums due, collection follow-ups, endorsements, claims, approvals waiting for you, missing documents, bank reconciliations in progress, period close (checklist items to sign off and failed checks of the open close runs), users and access (open access reviews, users who have not signed in since their account was created), system health (scheduled jobs whose last run failed, failed integration messages) and your tasks. Only the categories your role may read appear; the role preset of Home puts the categories of the role first. |
| My Team | For managers only: one row per person reporting to you (directly or below), with open, overdue and due-today counts, and the team's items. **Reassign** moves a claim, a data subject request or a task to yourself or to someone in your team. |
| My Tasks | Your work diary: tasks you created, tasks given to you and, for managers, tasks given to others. |
| Calendar | The tasks and items falling due by day, for one day or the next 7 days, with an **Overdue** strip above. |

To work your items:

1. Choose Home or Operations > My Work. **My Items** opens with the scope of your role preset (**Mine**, or **Everyone** for the Accounting Manager); a manager can switch to **My team**, and anyone to **Everyone** within their permissions.
2. Pick a category on the left (the red badge is the number overdue), or use **Search**, **Due**, **Priority** and **Sort**.
3. Select a row to open the record (quotation, bill, claim, approval) and act on it there. When the record is done it leaves the list.

![My Work: New task](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-my-work-task.png)

To add a task:

1. Select **New task**.
2. Enter **Title**, **Due date** and optional **Time**, **Priority**, **Reminder** (minutes before) and **Notes**. A manager can choose **Assigned to** from the team.
3. Optionally link a **Related record** (search by number or client name).
4. Select **Save**. The reminder arrives as a notification at the time chosen; the notification opens the task.

Mark a task **Done** when finished (**Reopen** if needed). Follow-up tasks are also created by the system from collection promises to pay, renewal next steps and claim follow-up dates, and close by themselves when the record closes (setting `myWork.auto_tasks`). An overdue task sends one alert to its owner (setting `myWork.overdue_task_alert`).

## Clients

![Operations > Clients](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-clients.png)

A client is a person or company that holds or has held a policy, or that was onboarded before its first policy. BrokerVerse creates the client, with its client code CL-YYYY-NNNNN, on **Onboard client** (below) or, for a new insured, when the first policy is issued.

1. Choose Operations > Clients.
2. Use the tabs (**All**, **Individual**, **Corporate**) or the search box to find the client. The list shows **Client ID**, **Assured Name**, **Category**, **E-mail**, **Mobile**, **Client Since**, **Policies** and the latest policy status.
3. Select the eye (**View**) at the end of the row to open the client; the pencil (**Edit**) edits it.

![The client view](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-client-view.png)

| Tab | What you see and do |
|---|---|
| **Policy** | The client's policies with gross premium, dates, product and payment status; open a policy from **Actions**. |
| **Claim** | The client's claims with status. |
| **Renewal** | Renewals due and quoted. |
| **Endorsement** | The client's endorsements with number, type, policy, status and payment. |
| **Data privacy** | Consent per purpose (Processing, Marketing, Sharing with insurers) with channel, evidence and notice version; **Record consent**, **Withdraw**, **Show history**. |

To correct the name, address or contact details of a client with an issued policy, raise a Personal Details Change endorsement, so the change is recorded against the policy and sent to the insurer.

### Onboard a client before the first policy

A client can be created, identified and checked before any quotation or policy, as customer due diligence requires. A client created by the first policy (a prospect converted, a direct placement) is completed the same way, from **Identification and due diligence** on the client view.

![Operations > Clients > Onboard client](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-onboard-client.png)

1. Choose Operations > Clients and select **Onboard client** (or, on a client view, **Identification and due diligence**).
2. Choose the **Client type**: **Individual**, or **Juridical** for a company, cooperative, partnership or sole proprietorship.
3. Individual: enter **First name**, **Middle name**, **Last name**, **Date of birth**, **Place of birth**, **Civil status**, **Nationality**, **Occupation or nature of work**, **Employer or business name**, **Source of funds** and **TIN**, then the **Government ID presented** (ID type from the Government ID Type master, **ID number**, **ID expiry date**). Juridical: enter the **Registered name**, **Trade name**, **Customer type**, **Registered with** (SEC, DTI or CDA), **Registration number**, **Date of registration**, **Nature of business**, **Country of incorporation** and **TIN**.
4. Enter the **Mobile number** (09XXXXXXXXX or +639XXXXXXXXX), the e-mail and the Philippine address: ZIP code, region, province, city or municipality and barangay come from the PSGC masters.
5. Under **Expected business and PEP** enter the lines of business expected, the usual payment mode and the expected annual premium, and switch on **Politically exposed person** with the details when the client, a family member or a close associate holds a prominent public position.
6. Juridical client: **Add signatory** for each authorised signatory with the board resolution or secretary's certificate that authorises him or her (number and date), and **Add beneficial owner** for each natural person who owns at least the beneficial owner threshold (25% by default, `clients.beneficial_owner_threshold`) or controls the client by other means; when no one does, record the senior managing official.
7. Select **Onboard client**. The client gets its client code; its KYC status shows at the top: **Complete**, or **Incomplete** with the identification still missing listed under it.
8. Upload the ID, the registration certificate, the General Information Sheet and the board resolution or secretary's certificate under **KYC documents**: choose the document type, what it relates to (client, signatory or owner), an expiry date when there is one, the file, and **Upload**.

The mobile number, TIN and the identification required for the client type are checked when you save. For a juridical client, the beneficial owners are checked as well: owners declared above 100% in total, or an owner below the threshold recorded as owning the client, are shown as warnings.

## Raise an endorsement request

An endorsement changes an issued policy: the client's details, the vehicle, the cover, the period, or cancels the policy. BrokerVerse records it with its number END-YYYY-NNNNN, sends it to the insurer and bills additional premium or credits return premium. A change of cover is priced again with the configured rates.

1. Choose Operations > Policy (or open the client and the **Policy** tab) and find the policy.
2. On the row, select **More actions**, then **Endorsement**. The action is greyed out while the premium is Pending or Reviewing, and is not offered for expired, lapsed, cancelled or renewed policies.
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

## Cover notes (binders)

![Operations > Cover Notes](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-cover-notes.png)

A cover note is temporary evidence of cover that the broker gives the client while the insurer issues the policy. It is issued from a quotation the customer accepted or from a placement slip that is with the insurer and not yet booked, and it stays in force for the cover period (30 days by default, setting `cover_note.validity_days`).

1. Choose Operations > Cover Notes and select **Issue cover note**.
2. Search the quotation, placement slip or client and select the row. Only quotations whose status is in `cover_note.quote_statuses` (accepted, approved, submitted) and placement slips in `cover_note.placement_statuses` (sent, acknowledged, e-policy received, checked) without a policy or an active cover note are listed.
3. Check **Cover from** (the inception of the placement, else today), the **Cover period (days)** (empty: the default; at most `cover_note.max_validity_days`), the **Insurer binder reference** and any **Special conditions**.
4. Select **Issue cover note**. The number is CVN-YYYY-NNNNN (Master > Document Numbering, series cover_note).

On the list, **Print** opens the cover note with the company letterhead, the cover, the risk, the wording of `cover_note.wording` and the signature block; **E-mail to the client** sends the PDF (e-mail template `cover_note`); **Cancel** asks for a reason.

| Cover note status | Meaning |
|---|---|
| Active | In force until the end of the cover period. |
| Superseded | The policy of the quotation or placement slip was issued; the policy number is shown and the cover note ends. |
| Expired | The cover period ended before the policy was issued. The policy is still linked when it is issued later. |
| Cancelled | Cancelled by a user (reason kept in the audit trail). |

The daily job **Cover note expiry** (Master > Schedules) reminds the owner of the quotation or placement `cover_note.reminder_days_before` days (7) before the end date, expires cover notes past their end date and links issued policies.

## Cancel a policy: computed return premium

The return premium of a cancellation is computed from the days left, never typed in (setting `endorsements.compute_cancellation_return`).

![Operations > Policy Cancellation](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-policy-cancellation.png)

| Method | When | Return net premium |
|---|---|---|
| Pro-rata | The insurer cancels (reason initiated by the insurer, for example non-payment) | Net premium x days left / days of the policy period. |
| Short-period | The insured cancels (`endorsements.short_period_for_insured`) | Net premium less the percentage the insurer keeps for the days in force, from Master > Insurance > Short-Period Rates (a shorter term is scaled to a year). |
| Flat | Cancelled from inception, or a reason whose method is flat (not taken up, duplicate) | The whole net premium. |

1. Choose Operations > Policy Cancellation and enter the policy number.
2. Enter the **Cancellation date** and choose the **Reason** (Master > Insurance > Cancellation Reasons says who initiates it and the method). **Return premium method** = From the reason, unless you choose another one.
3. For a cancellation of part of the cover choose **Part of the cover** and enter the percentage or the net premium of the part cancelled; the policy stays in force.
4. Select **Compute return premium**. The page shows the days in force and left, the premium kept by the insurer, the return net premium, the premium taxes returned (from Master > Finance > Premium Taxes & LGU Rates on the return premium; the taxes returned are set in `endorsements.cancellation_returned_taxes`, documentary stamp tax is not refundable by default), the return premium and the commission taken back.
5. Select **Create cancellation endorsement**. The endorsement summary opens; send it to the customer and complete it as any cancellation (Processing Team chapter). The server computes the same figures again, so a figure changed on the screen is not used.

When the endorsement is completed the open bills are credited with the return premium (what the client already paid becomes a refund), and the journal (posting rule policy.cancel, or endorsement.return_premium for a partial cancellation) reverses the premium due to the insurer, the premium taxes and the commission at the computed amounts. A cancellation raised from the endorsement screens is computed the same way.

## Record the client's payment

Operations records payments exactly as described in the Sales & Marketing chapter (Policy > **Proceed to Payment** > **How does the client pay?** > **Record payment**). Accounting verifies the payment and posts the official receipt.

## Payments

![Operations > Payments](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-payments.png)

Operations > Payments shows **Gross Premium**, **Collected Premium**, **Receivables** and **Earned Commission**, and the bills in the tabs **Paid**, **Pending** and **Reviewing**. The **Type** column says whether the bill is for a **Policy**, a **Renewal Policy** or an **Endorsement**. Receipts are posted by Accounting; this screen shows the result.

## CTPL authentication

Every CTPL certificate of cover (COC) must be authenticated with the IC-accredited authentication provider before it is released. Operations > CTPL Authentication does it for every CTPL cover issued.

![Operations > CTPL Authentication](/home/user/BDOI-OOTB/docs/package/source/manual-images/o-ctpl.png)

**COC series.** On the **COC series** tab, record each series of COC numbers received from an insurer: **New COC series**, the **Insurer**, the **Branch** (empty for every branch), the **Prefix**, the first and last number and the number of digits. Numbers may not overlap another series of the insurer. The list shows the numbers **Used** and **Left**, in orange below the low-stock threshold; a series whose numbers are all used becomes **Used up**. **Make inactive** stops a series (for example numbers returned to the insurer).

**At issue.** When a motor policy with CTPL is issued (`ctpl.register_on_issue`):

1. The next COC number of the insurer's series is allocated (the branch of the issuing user first) and written on the policy.
2. The plate number or MV file number, chassis and engine numbers are copied from the policy.
3. The authentication request is sent to the provider (`ctpl.authenticate_on_issue`). The answer's authentication code is stored, and the COC number and the code are printed on the policy schedule.

**The list.** The cards count the covers **Pending**, **Requested**, **Authenticated** and **Failed**; **Not yet authenticated only** shows the covers still waiting, flagged when they wait longer than `ctpl.unauthenticated_alert_hours` (24). On a cover not yet authenticated:

- **Authenticate now** sends the request (again).
- **Vehicle details** corrects the plate, MV file, chassis or engine number, or enters the COC number when no series had numbers left. A request is not sent while the plate (or MV file) and chassis numbers are missing (`ctpl.require_vehicle_ids`).
- **Enter code from the provider portal** is the fallback when the COC was authenticated on the provider's own portal: enter the authentication code, the provider's reference and the date. The code is stored and printed like one received by the system (method **Keyed in**).

**Register a policy** adds a CTPL cover issued before the automatic registration (for example a policy uploaded at go-live). **Unauthenticated CTPL report** downloads the covers still waiting as Excel. When the provider does not transmit to the LTO itself, switch on `ctpl.lto_feed` and the LTO_FEED connector: each authenticated COC is sent to the LTO and the **LTO** column shows the result.

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

The Claims team registers losses under the policies, sends the Preliminary Loss Advice to the insurer, follows the insurer and the adjuster, records the assessment and the settlement and, as a second user, approves the settlements entered by colleagues.

![Claims Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claims-dashboard.png)

## Menus available

| Menu | Items |
|---|---|
| Dashboard | Claims Dashboard |
| Operations | Home, Clients, Policy, Fleet Schedules, Marine Open Covers, Claims, My Work, Claim Documents, Motor Claim Repairs |
| Reports | All Reports; Operational Reports; Report Builder |
| Master | Insurance > Claim Document Checklist, Repair Shops |

The Claims role lands on the Claims Dashboard. Fleet Schedules and Marine Open Covers are read only, to see the vehicles and shipments on cover when a loss is reported.

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Register new losses | Policy > **More actions** > **Claim** |
| Daily | Follow open claims with the insurer and adjuster | Operations > Claims |
| Daily | Approve settlements entered by another Claims user | Notification; claim in Pending Approval |
| Daily | Watch overdue claims and your own worklist | Claims Dashboard; My Work |
| Daily | Chase missing claim documents; submit complete files to the insurer | Claim Documents |
| Daily | Record repair estimates, adjuster decisions and letters of authority | Motor Claim Repairs |
| Weekly | Review the claims position and ageing | Reports > Operational Reports > Claims; Reports > All Reports > Claims Ageing |
| As needed | Keep the claim document checklist and the accredited repair shops | Master > Insurance > Claim Document Checklist, Repair Shops |

## Claims Dashboard

The dashboard shows **Total Open Claims**, **Claims Overdue** (past the handling time of 20 days, `claims.sla_days`), **Today's Claims**, the line with the most claims and the claims by province, and the recent claims. Choose a date range and select **Export Report** to download the claims data.

## The claims list

![Operations > Claims](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claims-list.png)

Choose Operations > Claims. Each row shows **Claim Number**, **Client Name**, **Policy Number**, **Reported**, **Product** and **Status**; search by claim number, policy number or client and filter by status. The icons under **Actions** open the claim details, the next step for the claim's status and the claim audit trail.

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

1. Choose Operations > Policy, find the policy and select **More actions**, then **Claim**. You can also select **Claim** on the policy details page. The action is greyed out while the premium payment is Pending or Reviewing.
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

## Claim document checklist

Each claim has the list of documents it needs, taken from Master > Insurance > Claim Document Checklist by line of business and claim type (* for all), each one required or optional.

![Operations > Claim Documents](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-claim-documents.png)

1. Choose Operations > Claim Documents and select the claim on the left.
2. For each document: **Received** (or upload a copy with the upload icon; an uploaded claim document with the same name is marked received by itself), **Waive** with a reason when it does not apply, or **Reopen**. **Add document** adds one the checklist does not list.
3. **Remind the claimant** e-mails the documents still missing (e-mail template `claim_missing_documents`). The daily job **Missing claim documents** sends the same reminder every `claims.document_reminder_days` days (3; 0 switches it off) to claimants of open claims with a required document missing.
4. **Submit to insurer** records that the claim file went to the insurer (the reference is written to the claim history). While a required document is missing the button is disabled and the server refuses it (`claims.require_documents_before_submission`).

## Motor claim repairs and letters of authority

Operations > Motor Claim Repairs lists the motor claims with the stage of their repair: no estimate yet, awaiting approval, approved, in repair, released. Select a claim to open its repair file.

![Operations > Motor Claim Repairs](/home/user/BDOI-OOTB/docs/package/source/manual-images/c-motor-repairs.png)

1. **Record estimate**: the repair shop (Master > Insurance > Repair Shops; only active, accredited shops), its estimate number and date, and the parts, labour, paint, other and VAT amounts. The first estimate is the initial one; an estimate recorded after one is approved is supplementary. One estimate at a time waits for the adjuster.
2. **Record adjuster decision**: approve with the approved amount (at most the estimate) or reject with the reason, the adjuster and adjusting company, and the insurer's approval reference.
3. **Issue letter of authority**: covers the approved estimates not yet on a letter. The participation of the insured comes from `motor_claims.participation` (PHP 2,000 or 0.5% of the sum insured, whichever is higher) on the original letter only, and the depreciation on parts from `motor_claims.parts_depreciation_percent`; both can be changed. The letter (LOA-YYYY-NNNNN, valid `motor_claims.loa_validity_days`) shows the approved repair cost, the amount payable by the insurer and the amount the insured settles with the shop. **Print** opens it with the letterhead; a supplementary estimate gets a supplementary letter.
4. **Release vehicle**: who took the vehicle back, the dates, the participation paid to the shop and the odometer. **Print** gives the release acknowledgement the insured signs.

Every step is written to the claim history.

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
| Operations | My Work, Payments |
| Accounts | Receipts; Collections; Credit Control (Instalment Plans, Premium Warranty Monitor, Client Credit Limits, Remittance Ageing); Post-Dated Cheques; Claims Settlements; Payables (Supplier Invoices, Supplier Payments, AP Ageing, Suppliers, Supplier 2307); Fixed Assets (Asset Register, Depreciation Run, Disposals); Disbursement; Bank Payment Files; Remittance (Automated Processing, Tracking, Statements, Settlement, Reconciliation, Bulk Processing, Scheduling, Electronic Transfer, Approval Workflow, Exception Management, Agency Bill Processing, Direct Bill Processing, Adjustments, Notifications, History, Analytics); Journal Voucher; Correction JV; Reversal JV; Open Entry Matching; Open Entry Unmatching; Accounting Query; All Clients Accounting; Petty Cash (Initiate, Request, Disbursement, Receipts, Replenish); Bank Reconciliation (Reconciliation Workspace, Reconciliations, Reconciliation Statement Report, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines, Bank Book); Insurer Reconciliation (Insurer Statements); Tax (BIR Form 2307, VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases, Withholding Returns, Annual Alphalist 1604-E, Percentage Tax 2551Q, BIR DAT Files, Sales Invoices, E-Invoicing (EIS), CAS Books and Documents); Period End (Period Management, Month-End Close, Year-End Close, Recurring Journals, Financial Statements); Incentive (My Programs, Calculations, Approvals, Statement) |
| Commission | Commission Dashboard, Agents/Referrer Accounts, Insurer Overrides (Agreements, Computations) |
| Reports | All Reports; Operational Reports (Remittance, Broker Commission); Financial Reports (SOA/Premium Receivable, Collection Report, Payables, Journal, Trial Balance, Income Statement, Balance Sheet, Trial Balance Movement, General Ledger Detail, Aged Payables to Insurers, Month-End Close Status, Co-insurance Register, Due to Insurers by Co-insurer); Report Builder |
| Master > Finance | Account Determination, Posting Rules, Configuration Approvals, Accounting Flow, Premium Taxes & LGU Rates, Payment Gateways, Taxation, Close Checklist, Asset Classes, Bank Statement Formats, Bank Transaction Types, Insurer Statement Formats, Bank File Layouts |

## Daily and periodic tasks

| When | Task | Screen |
|---|---|---|
| Daily | Verify recorded payments and post official receipts | Notification; Accounts > Receipts |
| Daily | Follow overdue premium; send reminders | Accounts > Collections; Credit Control |
| Daily | Approve vouchers, journals and remittances of colleagues | The approval screens of each module |
| Daily | Deposit the post-dated cheques due; record cleared and bounced cheques | Accounts > Post-Dated Cheques |
| Daily | Record supplier invoices; pay approved invoices | Accounts > Payables |
| Daily | Record insurer funds and claimant payments of settlements paid through the broker | Accounts > Claims Settlements |
| Weekly | Remit collected premium to insurers | Accounts > Remittance |
| Weekly | Pay commission to referrers; pay by bank file where the bank accepts one | Commission > Agents/Referrer Accounts; Accounts > Bank Payment Files |
| Monthly | Raise commission debit notes for direct-bill policies; issue the sales invoices | Remittance > Direct Bill Processing; Tax > Sales Invoices |
| Monthly | Post depreciation; register and dispose of assets | Accounts > Fixed Assets |
| Monthly / quarterly | 0619-E and 1601-EQ with their filing records; 2551Q for a non-VAT broker; the BIR DAT files; BIR Form 2307 to suppliers | Accounts > Tax > Withholding Returns, Percentage Tax 2551Q, BIR DAT Files; Payables > Supplier 2307 |
| Per agreement period | Compute, approve and settle overriding and contingent commission | Commission > Insurer Overrides |
| Monthly | Import bank statements, match, prepare the reconciliation | Accounts > Bank Reconciliation |
| Monthly | Import insurer statements and reconcile | Accounts > Insurer Reconciliation |
| Monthly | Recurring journals, accruals, month-end close run | Accounts > Period End |
| Monthly / quarterly | VAT summary, QAP, SAWT, SLSP, BIR Form 2307 | Accounts > Tax |
| Per programme period | Incentive calculations | Accounts > Incentive |
| Yearly | Year-end close (prepare); the annual information return 1604-E; the CAS books of the year | Accounts > Period End > Year-End Close; Tax > Annual Alphalist 1604-E, CAS Books and Documents |

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

### Separate instalment invoices

By default an instalment plan splits the follow-up of one bill. To bill each instalment on its own, select **Issue instalment invoices** on the plan (before any payment is applied to the bill; `credit.instalment_invoices_on_save` does it when the plan is saved). The bill is cancelled with the reversal of its booking journal and each instalment becomes a bill with its own invoice number, due date, share of the net premium, taxes and commission, booking journal and collection item. Receipts, collections, the receivable ageing, the instalment ageing and the Premium Warranty Monitor then work on each instalment bill (an instalment counts as premium due only from its due date). An invoiced plan cannot be cancelled.

## Post-dated cheques

Accounts > Post-Dated Cheques is the register of cheques received from clients before their date.

![Accounts > Post-Dated Cheques](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-pdc.png)

1. **Register cheque**: the bill (or policy) it pays, the drawee bank (Bank master, or typed), cheque number, date and amount, and where it is kept (**Kept in**). The cheques on hand of a bill cannot exceed its balance. Nothing is posted yet.
2. The **Deposit due** tab lists the cheques dated within `pdc.due_window_days` days (3); the daily job **Post-dated cheques due** tells Accounting.
3. **Deposit** on or after the cheque date: choose the bank account. The official receipt is created and posted on that bank account (posting rule receipt.apply) and its number is shown.
4. **Cleared** when the bank confirms. **Bounced** with the bank's reason (and charge): the receipt is cancelled, its journal reversed and the bill is open again; Accounting is notified and the client is e-mailed (template `pdc_bounced`, `pdc.notify_client_on_bounce`).
5. **Replace** registers the client's new cheque for the same bill, linked to the bounced one. **Return** gives an unused cheque back to the client; **Cancel** voids a registration made in error.

**Export to Excel** downloads the register.

## Claims settlements paid through the broker

![Accounts > Claims Settlements](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-claims-settlements.png)

Accounts > Claims Settlements lists the claims whose settlement through the broker is booked, with what is still to receive from the insurers and what is payable to the claimant. Select a claim:

- **Funds received**: the insurer, amount, bank account and the insurer's remittance advice. Posting rule claim.funds_received: Dr bank / Cr Claim Settlements Receivable (clearing). Never more than the insurer's share.
- **Pay claimant**: payee, mode, bank account, cheque or transfer reference. Posting rule claim.paid_to_claimant: Dr Claim Settlements Payable (fiduciary) / Cr bank. The payment gets a claim payment voucher number (CPV-YYYY-NNNNN); the print icon opens the voucher.
- **Release form**: the release and quitclaim the claimant signs, with the payments made.

Recording funds needs the receipts permission and paying the claimant the disbursements permission (Accounting). The same cash panel stays on the claim screen.

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

## Bank payment files

Insurer remittances, referrer commission payouts, refunds and supplier payments can be paid by a bank upload file instead of cheques: bulk credit, InstaPay (up to `bank_payments.instapay_limit`, PHP 50,000 per payment) or PESONet.

![Accounts > Bank Payment Files](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-bank-payment-files.png)

1. Prepare the payment vouchers as usual (Accounts > Disbursement, insurer remittance, bulk referrer payout) and submit them for approval. Every payee needs a bank account: Master > Finance > Bank File Layouts, **Payee bank accounts** (a referrer's account on the referrer record is used too).
2. Choose Accounts > Bank Payment Files and select **New batch**. Choose the **Layout** of the bank, the bank account to **Pay from**, the **Channel** and the **Value date**, tick the vouchers (a voucher without a bank account cannot be ticked) and select **Create batch**. The batch takes a number from the BPB series.
3. Open the batch and select **Submit for approval**. A second user opens it and selects **Approve**, or **Return to draft** with the reason. The approver may not be the maker of the batch or of one of its vouchers, and the total must be within the approver's Authority Matrix limit for payment vouchers.
4. Select **Write file**, then **Download file** and upload it on the bank's portal. Select **Mark uploaded to the bank**.
5. When the bank returns its payment status file, select **Import status file**. Each paid payment posts the voucher's payment journal (Dr payable of the payee / Cr cash in bank of the bank account paid from, or for a referrer payout Dr commission payable / Cr cash and withholding tax) dated the value date, and the voucher becomes Paid. A rejected payment keeps its reason; its voucher is free for another batch or a cheque. Rows the system could not apply are listed with the reason.
6. Without a status file, use **Record result** on a payment to enter what the bank portal shows: paid with the bank reference, or rejected with the reason.

The batch is **Completed** when every payment has a result. A batch with no paid payment can be cancelled; its vouchers become free again. Every step is in the audit trail, and the file and status file are in Master > System > Integrations (outbox and inbox).


## SAP GL export

Every day at the 11:59 PM cut-off the GL entries posted since the previous cut-off are written as two text files for the SAP GL upload: the header file ARHDTISPH followed by the date (one SAP document per posting date) and the line file ARLITISPH followed by the date (one line per journal line with the posting key 40 debit or 50 credit, the GL account, the amount, the text, the cost centre, the value date, the client or insurer code and the journal and document numbers). The job **SAP GL text files** of Master > Schedules writes them to the folder SAP collects from.

1. Choose Accounts > SAP GL Export. The list shows each run: the day, the run number, the window of posting times, the status (Written, Nothing posted, Failed), the journals and lines, the totals, who started it and the warnings (accounts outside the SAP chart, lines without a cost centre).
2. To write the files of a day again, or before the cut-off, choose the day and select **Run now / re-generate**. The run takes the entries posted between the previous day's cut-off and the day's cut-off and writes the files again under the same names.
3. Select a file name to download the file as it was written.

An entry approved after the cut-off goes into the next day's file. The folder, the cut-off and the record layout (field list, delimiter or fixed widths, file names) are settings of Master > Configuration, group integrations (`sap_gl.folder`, `sap_gl.cut_off`, `sap_gl.layout`), so the layout can be corrected without a new release.
## Bank file layouts and payee bank accounts

![Master > Finance > Bank File Layouts](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-bank-file-layouts.png)

Master > Finance > Bank File Layouts says how each bank's upload file is written and how its status file is read. The system is delivered with starter layouts for BDO, BPI, Metrobank, Landbank and UnionBank and a generic CSV. **The starter layouts are examples: each must be validated against the bank's current file specification, and a test file accepted by the bank, during onboarding.** They are marked **Test mode** until changed.

To change or add a layout, select the pencil or **New layout**:

1. **File format** **Delimited** (with its delimiter) or **Fixed width**, the **Channels** the layout writes, the **Line ending** and the **File name** pattern (for example `{bankCode}_{batchNumber}_{valueDate:YYYYMMDD}.csv`).
2. On **Header record**, **Payment records** and **Trailer record**, list the fields in order: the **Source** (a fixed value, a payment value such as account number or amount, or a batch value such as value date, total or count), the **Format** (text, upper case, digits, amount with two decimals, amount in centavos, date patterns), the **Width** and, for fixed width, the **Alignment** and **Pad** character.
3. On **Status file**, describe the bank's return file: the columns of the reference, status, bank reference, reason and amount, and which status values mean paid or rejected.
4. **Preview** writes the file for two example payments. Save.

**Payee bank accounts** lists the bank accounts credited by the files, per insurer, referrer, client or supplier: bank, account number and name, account type and the e-mail for the bank's credit advice. One account per payee is the default.

## Remittance to insurers

For broker-billed policies Accounting remits the collected premium, net of the broker's commission, to each insurer by its share.

1. **Automated Processing**: the **Scheduled Remittances** list shows each insurer's remittance schedule, policies and estimated amount (Below minimum when there is nothing to remit). Tick the insurers that are ready, select **Validate**, then **Process Selected**. Draft remittances (REM-YYYY-NNNNN) are created. The due date follows the insurer's remittance terms, else `remittance.default_due_days` (30 days).
2. **Tracking**: find the remittance (filters **Remittance No**, **Insurer**, **Date Range**, **Status**) and process it; it goes for approval.
3. **Approval Workflow**: another user approves it within his or her limit for Remittance approval in Master > Users and Access > Authority Matrix. The delivered limits let an Accounting user approve up to PHP 1,000,000.00 and an Accounting Manager without limit; a larger remittance waits for the Accounting Manager. Cover during leave is given in Users and Access > Delegations. The initiator cannot approve.
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

### Gross remittance: commission billing statements

For an insurer and product whose remittance basis is gross (setting `remittance.basis_rules`; the default basis, net, keeps the commission out of the premium remitted), the client pays the premium to the broker, the whole premium is remitted to the insurer and the commission is billed to the insurer separately. The premium bill then credits the whole premium to Accounts Payable - Insurance Company and the insurer's payment voucher pays the whole premium collected. Each bill's commission waits on the tab **1. Raise Debit Note** with **Commission of** set to **Gross remittance (billing statement)**: raise and submit it as for a debit note. The document is a **Billing Statement** (CBS-YYYY-NNNNN). Its approval by a second user posts Dr Receivable from Insurance Company / Cr Commission Income / Cr Output VAT; cancelling an approved statement without collections reverses that entry. The insurer's payment is recorded as for a debit note, with the creditable withholding tax. A return premium credits its commission on the next statement.

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

### Overriding, profit and contingent commission from insurers

Commission > Insurer Overrides has two screens: **Agreements** and **Computations**. Accounting maintains and computes them (read:commission, write:commission).

![Commission > Insurer Overrides > Agreements](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-insurer-overrides.png)

Set up an agreement:

1. Choose Commission > Insurer Overrides > Agreements and select **New agreement**.
2. Enter the **Agreement code**, **Name**, **Insurer**, **Type** (Overriding, Profit or Contingent) and **Status**.
3. Choose the **Basis**: **Production volume** (premium of the period), **Loss ratio** (claims incurred divided by the production) or **Growth** (production against the same period one year earlier).
4. Choose the **Period** (monthly, quarterly, semi-annual or annual), the **Premium measure** (net or gross premium), the **Tier method** (slab: the tier reached applies to the whole production; banded: each band of production at its own rate, production basis only), the **Lines of business** (empty for all), the **Minimum production**, the **Expected withholding** (the insurer's creditable withholding, 10% by default) and whether **Output VAT on the commission** applies.
5. Enter the tiers: **From**, **To** (empty for the last, open-ended tier) and the **Rate on production**. Production tiers are amounts; loss ratio and growth tiers are percentages. Each tier starts where the previous one ends.
6. Select **Save**.

Compute, approve and settle:

1. Choose Commission > Insurer Overrides > Computations, the agreement and the year. The periods of the year are listed with their computation.
2. Select **Compute** on a period. The dialog shows the production, the number of policies, the claims incurred, the loss ratio, the growth, the tier and rate, the commission, the VAT and the receivable. When the insurer's loss figure differs from the claims recorded in the system, enter **Insurer's claims figure** and a **Claims note**. Select **Compute**: the computation gets its number (OVC-YYYY-NNNNN) as a draft. A draft can be recomputed.
3. Open the computation and select **Submit for approval**. Another Accounting user selects **Approve** (`commission.override_requires_approval`): the receivable is posted (posting rule `override_commission.accrual`: Dr Overriding and Contingent Commission Receivable 1203006, Cr Contingent and Profit Commission Income 3201002, Cr Output VAT).
4. Select **Issue invoice** to make out the sales invoice of the commission to the insurer (Accounts > Tax > Sales Invoices).
5. When the insurer pays, select **Settle**: enter the **Insurer statement** reference, the **Statement date**, the **Amount on the statement**, the **Amount received**, the **Tax withheld (2307)**, the **BIR Form 2307 no.** and how to treat a **Difference**: **Leave the balance open** (a part payment) or **Take the difference to commission income** (accept the insurer's figure). The settlement posts `override_commission.settlement` (Dr cash, Dr Creditable Withholding Tax, Cr the receivable, any difference to the income). The message says when the statement differs from the computation by more than `commission.override_settlement_tolerance`.
6. A draft, submitted or approved computation without settlements can be cancelled with a reason (an approved one has its journal reversed); a submitted one can be rejected. **Excel** exports the computations of the year.

Production is the premium of the insurer's policies issued in the period (issued date, else inception), cancelled policies excluded. Claims incurred are the claims with a loss date in the period on those policies, at the settled amount, else the approved amount, else the estimate, for the statuses in `commission.override_claims_statuses`.

## Journal vouchers

![Accounts > Journal Voucher](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-jv.png)

1. Choose Accounts > Journal Voucher and select **Voucher**.
2. Choose the **Transaction Code**, type the **Transaction Description** and check the **Date**.
3. Select **Add Data**. Choose the **Main A/c**, the **Sub A/c** if any, the entry (Debit or Credit), remarks, currency and amount, and save the line.
4. Repeat until total debit equals total credit.
5. Submit the voucher for approval.

![Add Journal Voucher](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-jv-add.png)

An unbalanced voucher is refused with the difference. A voucher dated in a soft-closed period can be posted only by the Accounting Manager, and one dated in a closed period is refused. The approvers are notified; the checker approves (the journal is posted and appears in the Journal register and the trial balance) or rejects it with a reason. The list (**Journal Voucher history**) shows **Transaction Code**, **Transaction Number**, **Date**, **Description**, **Status** and **View**. Tick **System journals parked for approval** to list the journals of the system that wait for approval (see Accounting Flow).

Each line has a **Cost Centre** (Master > Finance > Cost Centres). Leave it empty for the default cost centre, 900901 Toyota Insurance Services for TISPH; every journal of the system takes the default. The cost centre shows on the voucher, in Accounting Query and its export, in the General Ledger Detail report and in the SAP GL file.

### Upload journal vouchers

Accruals, prepayments, bank reconciliation adjustments, income tax accruals and the entries of the non-insurance processes can be uploaded from a spreadsheet.

1. Choose Accounts > Journal Voucher and select **Upload**.
2. Select **Download template**. The workbook has a **Data** sheet (one row per journal line: **Voucher Ref**, **Voucher Date**, **Transaction Code**, **Description**, **Account Code**, **Debit** or **Credit**, **Line Text**, **Cost Center**, **Branch Code**, **Department Code**, **Currency**), a **Columns** sheet with the format of each column and an **Instructions** sheet. The rows with the same Voucher Ref make one voucher.
3. Fill in the Data sheet (delete the sample rows), select **Choose file** and **Upload**.

The whole file is checked first: one date and transaction code per voucher, Debit or Credit on each row, debits equal to credits, accounts that exist and accept manual entries, valid cost centres and an open period. When a row is wrong nothing is saved and every row to fix is listed with its row number and voucher reference; correct the file and upload it again. The vouchers created are listed with their numbers; each waits for the approval of another user, like a voucher entered on the screen.

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
| Withholding Returns | The filing calendar of a year: BIR Form 0619-E (first and second month of each quarter), 1601-EQ (each quarter), 2551Q (non-VAT broker) and 1604-E, each laid out as the BIR form, reconciled, printed (PDF) and exported (Excel), with its filing record. |
| Annual Alphalist 1604-E | The annual information return with the remittances per month and the alphalist of payees (schedules 3 and 4); Excel, print and DAT file. |
| Percentage Tax 2551Q | The percentage tax working paper of a non-VAT registered broker or agent. |
| BIR DAT Files | The validation data files of the QAP, the SAWT, the SLSP sales and purchases and the 1604-E alphalist. |
| Sales Invoices | The broker's sales invoices under the EOPT Act, with payment acknowledgements. |
| E-Invoicing (EIS) | The outbox of e-invoices for the BIR Electronic Invoicing System. |
| CAS Books and Documents | The loose-leaf books of accounts, the system description, the backup procedure and the audit trail extract for the CAS registration. |

For BIR Form 2307, choose **Issued by us** or **Received**, the year and the quarter. The list shows each payee with **Taxpayer Identification Number (TIN)**, **ATC**, **Transactions**, **Income payments subject to expanded withholding tax**, **Tax withheld for the quarter** and **Certificate no.**. Select **View** to see the certificate and issue it: it takes a number from the BIR Form 2307 series (CWT-) and prints on the BIR layout with the broker's details. The ATC per payee type comes from `bir.atc_by_payee` (for example WI515 for agents and sub-agents, WC515 for external referrers). Before the first filing, fill in `bir.withholding_agent_tin`, `bir.registered_name`, `bir.registered_address` and `bir.zip_code` (Master > Configuration, area Accounting & Tax).

The other tax reports work like every report: choose the criteria and dates, **Preview**, then the file format and **Generate**.

### Withholding returns: 0619-E, 1601-EQ and their filing records

![Accounts > Tax > Withholding Returns](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-withholding.png)

1. Choose Accounts > Tax > Withholding Returns and the year. The list shows each return with its **Period**, **Due date** (0619-E: day `bir.withholding_due_day` of the next month, default 10; quarterly returns: the last day of the month after the quarter), **Status** (Filed or Not filed), **Date filed**, **Filing reference** and **Amount paid**.
2. Select **Open** on a return. It shows Part I (TIN with branch code, RDO, name, address, category of withholding agent from Master > Company and the `bir.*` settings) and Part II with the BIR item numbers: for 1601-EQ one line per ATC (tax base, rate, tax withheld), the total for the quarter, less the 0619-E remittances of the first and second month (from their filing records), the tax still due and the penalties. The schedules show the tax per ATC and, for 1601-EQ, the QAP attached.
3. Read **Reconciliation**. The return total is compared with the QAP report and with the tax withheld credited in the ledger to the withholding accounts (`bir.withholding_ledger_accounts`, else Expanded Withholding Tax Payable 2204001). A difference means a withholding booked outside a payment voucher (for example a journal voucher or petty cash) or a voucher without a journal: explain it before filing.
4. Select **Print** (PDF in the BIR item order) or **Excel** (the form, each schedule on a sheet, the reconciliation) and transfer the figures to eBIRForms or eFPS.
5. After filing and paying, select **Record filing** and enter the **Date filed**, the **Filing reference** (eFPS / eBIRForms confirmation), the **Amount paid**, the **Penalties**, the **Payment date**, the **Payment reference** and the **Payment channel**. The figures as computed are kept with the record. **Edit filing** corrects the references; **Amended return** records a new filing that supersedes the earlier one; a record entered in error is cancelled with a reason.

### Annual information return 1604-E and alphalist of payees

![Accounts > Tax > Annual Alphalist 1604-E](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-1604e.png)

Choose Accounts > Tax > Annual Alphalist 1604-E and the year. The return shows the remittances per month (from the 0619-E and 1601-EQ filing records), schedule 3 (each payee subject to expanded withholding per ATC: TIN, branch, registered name or last, first and middle name, nature of income payment, rate, income payments and tax withheld for the year) and schedule 4 (payees whose income payments are exempt). **Excel**, **Print** and **DAT file** produce the outputs; **Record filing** works as for the other returns. The reconciliation compares the tax in schedule 3 with the tax remitted on the filing records.

### Percentage tax 2551Q (non-VAT broker or agent)

A broker or agent that is not VAT registered (`direct_bill.broker_vat_registered` off) pays percentage tax on its gross sales. Choose Accounts > Tax > Percentage Tax 2551Q, the year and the quarter. The working paper shows the gross sales of each month from the revenue accounts of the ledger, per account, the rate (`bir.percentage_tax_rate`, default 3%), the ATC (`bir.percentage_tax_atc`, default PT010), the tax due and the penalties. Print, Excel and the filing record work as for the other returns. For a VAT-registered broker the screen says so: confirm with the tax adviser before filing a 2551Q.

### BIR DAT files

![Accounts > Tax > BIR DAT Files](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-dat.png)

Choose Accounts > Tax > BIR DAT Files, the file (**QAP (1601-EQ)**, **SAWT**, **SLSP sales**, **SLSP purchases** or **1604-E alphalist**), the year and the quarter (for the SAWT also the return it is attached to, `bir.sawt_form`, default 1702Q). The screen shows the layout version, the file name, the number of records, the totals, the record layout, the content and the warnings (for example a payee without TIN). Select **Download** and validate the file with the current BIR validation module before submitting it.

The files follow the record layouts of the BIR Alphalist Data Entry and Validation Module version 7.x (QAP, SAWT, 1604-E) and the RELIEF data file layout (SLSP): a header record, one detail record per payee, customer or supplier, and a control record with the totals; text in capitals between double quotes, amounts with two decimals, CR LF line ends. The broker's TIN must be filled in on Master > Company first.

### Sales invoices (EOPT Act)

Under the Ease of Paying Taxes Act (RA 11976) and RR 7-2024 the sales invoice is the primary document of the broker's sale of services. Before the first invoice, fill in the **Sales invoices (EOPT)** group in Master > Configuration (area Accounting & Tax): `invoice.atp_number` or `invoice.cas_permit_number` and their dates, the registered serial range `invoice.serial_from` / `invoice.serial_to`, `invoice.printer_details` and `invoice.buyer_details_threshold`; and the TIN branch code `bir.tin_branch_code` and trade name `bir.trade_name` in the BIR forms group.

![Accounts > Tax > Sales Invoices](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-sales-invoices.png)

1. Choose Accounts > Tax > Sales Invoices and select **New invoice**.
2. Choose **Invoice for**: **Commission debit note** or **Overriding commission** (pick the approved document from the list), **Broker-billed policy commission** (type the policy number) or **Fees and other services (manual)**.
3. For a manual invoice enter the **Buyer type**, **Buyer**, **Buyer TIN (with branch code)**, **Buyer business style** and **Buyer address**, then the lines: **Description**, **Qty**, **Unit price** and **VAT class** (VATable, VAT-exempt or zero-rated), and the **Expected withholding** rate.
4. Select **Issue invoice**. The invoice takes the next number of the sales invoice series (SI-, sequential, never reset; the issue stops when the number would pass `invoice.serial_to`). It carries the seller's registered name, trade name, TIN with branch code, address and VAT status, the ATP or CAS acknowledgement and the serial range, the buyer's name, TIN and address (required for an insurer or a business buyer and from the threshold amount), the VATable, VAT-exempt and zero-rated sales and the VAT shown separately. A non-VAT broker's invoice shows the total sales and NON-VAT REGISTERED.
5. Select the invoice number to open it; **Print** produces the PDF. An invoice made out for a debit note, a computation or a policy does not post again (its revenue is already booked); a manual invoice posts `sales_invoice.issue` (Dr Service Fees Receivable 1205003, Cr service fee income, Cr Output VAT).
6. For a manual invoice select **Record payment**: the **Payment date**, **Payment mode**, **Amount received**, **Tax withheld (2307)**, **BIR Form 2307 no.** and **Reference**. The payment acknowledgement (PAR-YYYY-NNNNN, title `invoice.payment_document_title`) is a supplementary document printed with `invoice.supplementary_note` ("not valid for claim of input tax"); it posts `sales_invoice.payment`.
7. **Cancel invoice** asks for a reason; the invoice keeps its number and prints CANCELLED; a manual invoice's journal is reversed. Cancel its payments first.

Premium collection receipts (Accounts > Receipts) print the title in `receipts.document_title` (Official Receipt by default; for example Collection Receipt once the tax adviser confirms), with the supplementary statement once the title is changed.

> What the system does and what the tax adviser confirms: the system issues the sales invoice for commission and fees and treats receipts as supplementary documents. The tax adviser confirms which documents are registered as the broker's invoices, the wording of the supplementary documents, the VAT treatment of each commission stream, the buyer details threshold, and whether the invoices are registered as system-generated (CAS) or printed under an ATP.

### E-invoicing (EIS)

The connector to the BIR Electronic Invoicing System is switched off by default (`eis.enabled`). When the broker is enrolled with the EIS, set the **E-invoicing (EIS)** group in Master > Configuration: `eis.mode` (test: the built-in fake provider, nothing leaves the system; live: the configured endpoint), `eis.endpoint`, `eis.token_endpoint`, `eis.accreditation_id`, and the names of the environment variables that hold the client id, the client secret and the signing key (`eis.client_id_env`, `eis.client_secret_env`, `eis.signing_key_env`; the values are set on the server by IT, never in the system).

![Accounts > Tax > E-Invoicing (EIS)](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-eis.png)

1. Choose Accounts > Tax > E-Invoicing (EIS). The banner shows whether the connector is on, the mode, the endpoint and whether the credentials are set; the counters show the queued, accepted, failed, rejected and manually uploaded submissions.
2. Each invoice issued (and each cancellation of an invoice already sent) is queued with its payload, a SHA-256 hash and the signature. The eis-outbox job (Master > Schedules, every 15 minutes, switched off by default) or **Send now** sends what is due. A failure is retried after `eis.retry_minutes`, doubled at each attempt, up to `eis.max_attempts`; a rejection is final (cancel and reissue the invoice). A submission left in **Sending** longer than `eis.sending_stale_minutes` (15; the server stopped during the call) counts as a failed attempt and is sent again at the next run.
3. **Retry** puts a failed or rejected submission back in the queue. **Queue earlier invoices** queues the invoices of a date range issued before the connector was switched on.
4. Fallback: **Export payloads** downloads the queued and failed payloads as one JSON file for a manual upload; then **Uploaded manually** records the reference the BIR gave.

The EIS enrolment and certification of the broker, the final field list and signing certificate, the production endpoint and credentials stay with the BIR.

### CAS books and documents

Choose Accounts > Tax > CAS Books and Documents.

![Accounts > Tax > CAS Books and Documents](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-tax-cas.png)

1. **Readiness** lists what the registration pack needs: the taxpayer details and RDO (Master > Company), the CAS permit number (`cas.permit_number`), the invoice ATP or acknowledgement, the backup custodian (`cas.backup_custodian`), the system contact (`cas.system_contact`) and at least one book printed.
2. Choose the **Book** (General Journal, General Ledger, Cash Receipts Book, Cash Disbursements Book, Sales Book or Purchase Book) and the month. The entries show on screen; **Excel** exports them.
3. Select **Print book**. The PDF carries the taxpayer, TIN, period and CAS permit, and page numbers that run on through the year ("General Journal 2026 page 13"). With `cas.enforce_print_order` on, a month is printed only after the previous month of the same book. A month is printed once; the **Print register** lists every print with its pages, entries and date.
4. **Reprint** produces the same pages again, marked REPRINT. **Void print** (the latest print of a book only, with a reason) frees its pages for the next print.
5. **System description** and **Backup procedure** produce the documents of the registration file from the system and the `cas.*` settings. **Audit trail extract** downloads the audit trail of a date range in Excel or PDF.

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
2. The run (MEC-YYYY-NNNNN) executes its steps in order: (a) Accruals, (b) Recurring journals, (c) Commission deferral (Skipped when off), (d) FX revaluation, (e) Depreciation of the fixed asset register (posted once per asset and period; Skipped when `fixed_assets.depreciation_in_month_end` is off), (f) Checklist.
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

## Accounts payable

![Accounts > Payables > Supplier Invoices](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-payables.png)

Suppliers are kept on Accounts > Payables > Suppliers: TIN, address, VAT registration, the EWT tax code withheld (Master > Finance > Taxation, for example WC158 goods, WC160 services, WC100 rentals), payment terms and the default expense account.

1. Accounts > Payables > Supplier Invoices > **New supplier invoice**: supplier, the supplier's invoice number and date, description, and one line per expense account (or an **Asset class** for an asset bought). Input VAT is computed on the vatable lines of a VAT-registered supplier at the rate of `payables.input_vat_code`; the EWT at the rate of the supplier's EWT tax code on the amount net of VAT. The due date follows the payment terms. The same supplier invoice number cannot be recorded twice.
2. **Save and submit** sends it for approval; the Accounting Manager (another user) approves it, which posts the journal (posting rule ap.invoice: Dr expense or asset, Dr input VAT / Cr EWT payable, Cr Accounts Payable - Suppliers), or rejects it with a reason. Without `payables.maker_checker` the invoice posts when it is submitted. An asset line is registered in the fixed asset register on approval.
3. **Print** gives the AP voucher with the journal. **Cancel** an invoice without payments; an approved one is reversed.
4. Accounts > Payables > Supplier Payments > **New supplier payment**: the supplier, the invoices to pay (all open invoices are ticked), mode, bank account, cheque number. Posting rule ap.payment: Dr Accounts Payable - Suppliers / Cr bank. **Print** gives the payment voucher; **Cancel** reverses the payment and opens the invoices again.
5. Accounts > Payables > AP Ageing shows the open balances by supplier and by invoice, aged on the due dates (buckets of `limits.receivable_ageing_buckets`); **Export to Excel**.

### BIR Form 2307 for suppliers

The expanded withholding tax withheld from a supplier on an approved supplier invoice (the supplier's EWT tax code, on the amount net of VAT) is creditable tax of the supplier: the broker issues BIR Form 2307 for it each quarter.

![Accounts > Payables > Supplier 2307](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-supplier-2307.png)

1. Choose Accounts > Payables > **Supplier 2307**, the **Year** and the **Quarter**. The screen lists every supplier with EWT in the quarter: TIN, ATC (the ATC of the invoice's EWT tax code, for example WC160 services, WC158 goods, WI010 professional fees), the number of invoices, the income payments and the tax withheld, and the certificate number once issued. Cancelled invoices do not count; an invoice counts in the quarter of its journal date.
2. **View** shows the certificate on the BIR layout: the payee (the supplier's registered name, TIN and address from the Supplier master), the payor (the broker, from the primary company of Master > Company), and per ATC the income of each month of the quarter, the total and the tax withheld. **Issue** numbers it from the CWT series; **Print** prints it.
3. **Issue all certificates** numbers the certificates of every supplier of the quarter that has none yet.

The same generator issues the certificates of the commission payees on Accounts > Tax > BIR Form 2307, where the suppliers are listed with the other payees. The supplier EWT is also included in the QAP (Accounts > Tax > QAP), in the 0619-E and the 1601-EQ per ATC (reconciled with the QAP and with the EWT payable account of the ledger), in the 1604-E alphalist of payees (schedule 3; a supplier with an EWT code for individuals is listed by last, first and middle name) and in the QAP and 1604-E DAT files.

## Fixed assets and depreciation

![Accounts > Fixed Assets > Asset Register](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-fixed-assets.png)

Accounts > Fixed Assets > Asset Register lists the assets with their cost, accumulated depreciation and book value. **Register asset** for an asset not bought through a supplier invoice: name, asset class (Master > Finance > Asset Classes gives the useful life and the asset, accumulated depreciation and depreciation expense accounts), dates, cost, salvage value, location, custodian and serial number. For an asset carried at go-live enter the accumulated depreciation at go-live and the first period to depreciate here. Select an asset to see its straight-line schedule: each month's depreciation, accumulated depreciation and book value, and whether the month is posted.

Depreciation is straight-line from the in-service month (`fixed_assets.first_month`); the last month takes the rounding so the asset ends at its salvage value. Accounts > Fixed Assets > Depreciation Run shows what a period's depreciation is and **Post depreciation** posts one journal per asset class dated the end of the period (posting rule fa.depreciation: Dr depreciation expense / Cr accumulated depreciation). An asset is never depreciated twice for a period. The month-end close runs the same step (**(e) Depreciation**, `fixed_assets.depreciation_in_month_end`).

### Asset disposal

An asset sold or written off (lost, stolen, damaged beyond repair, obsolete) leaves the register through a disposal.

1. Post the depreciation up to the month before the disposal first (Depreciation Run): the disposal is refused while a month before it is not depreciated (`fixed_assets.disposal_requires_depreciation_to_date`). The month of the disposal is not depreciated.
2. Accounts > Fixed Assets > Asset Register: select the asset, then **Dispose**.
3. Choose **Sale** or **Write-off** and the **Disposal date** (up to `fixed_assets.disposal_backdate_days`, 60, days back).
4. For a sale enter the **Selling price (net of VAT)**, the **Buyer** with **Buyer TIN** and **Buyer address**, and **Received into** (the bank account the money went to; leave it empty for a sale on credit). For a write-off enter the **Reason**.
5. The screen shows the cost, the accumulated depreciation, the book value, the output VAT of a sale (tax code `fixed_assets.disposal_vat_code`, VAT12-OUT, when the broker is VAT registered), the total proceeds and the gain or loss. Select **Post disposal**.

The disposal (FAD-YYYY-NNNNN) posts one journal (posting rule fa.disposal, Master > Finance > Posting Rules):

| Line | Account | Amount |
|---|---|---|
| Dr | Accumulated depreciation of the asset class | Accumulated depreciation |
| Dr | Bank account received into, else the sales invoice receivable | Selling price + output VAT |
| Dr | Loss on disposal (`accounting.account.loss_on_disposal`, 4501004) | Book value above the selling price |
| Cr | Asset account of the asset class | Cost |
| Cr | Output VAT | Output VAT |
| Cr | Gain on disposal (`accounting.account.gain_on_disposal`, 3301004) | Selling price above the book value |

A sale also issues the BIR sales invoice to the buyer (Accounts > Tax > Sales Invoices, source Asset disposal; `fixed_assets.disposal_sales_invoice`). A sale received into a bank account is issued paid; a sale on credit is collected by recording the payment on the sales invoice. The asset becomes **Disposed** and is no longer depreciated.

![Accounts > Fixed Assets > Disposals](/home/user/BDOI-OOTB/docs/package/source/manual-images/a-fa-disposals.png)

Accounts > Fixed Assets > **Disposals** is the disposal register of a period: number, date, sale or write-off, asset, buyer, book value, selling price, output VAT, gain or loss, sales invoice, journal and status, with the totals; **Export to Excel**. The printer button prints the disposal voucher with its journal. **Cancel disposal** (with a reason) reverses the journal, cancels the sales invoice and restores the asset; a disposal whose sales invoice has a payment recorded cannot be cancelled.

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

**Accounting Flow** shows, for each operational event, what it posts, read from the posting rules in force: the screen or action that triggers it, the approval before it posts, whether its journal is **Parked for approval** or **Posted at once**, and the accounts it debits and credits. **Open the rule** opens the posting rule.

The events whose journals are parked are listed in the setting `accounting.parked_events` (Master > Configuration, group accounting). A parked journal waits on Accounts > Journal Voucher (tick **System journals parked for approval**) and in My Work > Approvals until a user other than the one whose action created it approves it, which posts it. It cannot be rejected on its own: cancel its source document (the collection, the invoice, the payment), which cancels the journal. TISPH parks the collection of commission from an insurer, the service invoice and its payment, and the payment of supplier invoices. Premium bookings, collections applied to bills, direct-bill commission, refunds due from insurers and write-offs always post at once, because the bill, the remittance or the matching that comes next reads them; the setting refuses them.

> Change posting rules only after a simulation. A wrong rule posts wrong journals from its effective date.

## Commission Rate Matrix

![Master > Finance > Commission Rate Matrix](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-crm.png)

The matrix holds the brokerage rates the broker earns by insurer, product, line of business and policy type (New business, Renewal or Any), with effective dates. The most specific active rate on the policy date applies: insurer and product, insurer and line of business, insurer, product, line of business; an exact policy type before Any; then the insurer's default rate and the system default (15%). **Add rate**: choose the insurer, product and line of business (at least one), the policy type, the rate, effective from and to, and remarks; save. **Find rate** shows which rate a placement would get and where it comes from. The screen is in the System Administrator's menu; the Accounting Manager agrees the rates.

## Approve supplier invoices

Supplier invoices sent for approval are announced in the notifications (approve:payables). Open Accounts > Payables > Supplier Invoices, filter **For approval**, open the invoice, check the lines, VAT and EWT and select **Approve** (the journal is posted) or **Reject** with a reason. You cannot approve an invoice you prepared or submitted.

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

# Distribution, programmes and products

This chapter covers the screens that bring business in and the specialist products placed in bulk: who works each prospect, the dealers, banks and affinity partners that refer business, the brand-new vehicle programmes, fleet schedules, marine open covers, the comparison report given to clients, marketing campaigns and the Report Builder.

| Screen | Menu | Who uses it |
|---|---|---|
| Lead Assignment | Operations > Sales & Marketing > Lead Assignment | Sales managers and the lead assignment team (read / write:lead-assignment); every account executive sees the team view of their own reporting line |
| Distribution Channels | Master > Insurance > Distribution Channels | Sales, Processing and Operations (read:channels to view, write:channels to change) |
| Dealer Programmes | Operations > Sales & Marketing > Dealer Programmes | Sales and Processing (read / write:motor-programmes) |
| Comparison Reports | Operations > Sales & Marketing > Comparison Reports | Sales and Processing (quotation permissions) |
| Campaigns | Operations > Sales & Marketing > Campaigns | Sales and marketing (read / write:campaigns) |
| Fleet Schedules | Operations > Fleet Schedules | Operations and Processing (read / write:fleet) |
| Marine Open Covers | Operations > Marine Open Covers | Operations and Processing (read / write:marine) |
| Dealer Production | Reports > Operational Reports > Dealer Production | Everyone with the reports permission |
| Report Builder | Reports > Report Builder | Everyone with the reports permission; saving needs write:reports; the BI extract tab is for the administrator |

The Sales Activities screen, also under Operations > Sales & Marketing, is described in the Sales & Marketing chapter.

## Lead Assignment

![Operations > Sales & Marketing > Lead Assignment](/home/user/BDOI-OOTB/docs/package/source/manual-images/d-lead-assignment.png)

Choose Operations > Sales & Marketing > Lead Assignment. The screen has three tabs: **Team View**, **Queue** and **Assignment Rules**. Users without the lead assignment permissions see only the team view.

### Team view

The team view lists each account executive of the reporting line (the users who report to the signed-in manager, and their own reports) with the prospects they hold: **Open**, **Converted**, **Lost**, **Last 30 days** and **In queue**. Choose a manager to see that manager's line (the default is your own team) or a **Team member** to see one person. Below the team, the open prospects of the selection are listed, with their **Assignment** status.

### Assignment rules

Every new prospect, whether entered on the prospect screen, uploaded or created from a dealer sale, is given an account executive by the first active rule that matches it.

1. Open **Assignment Rules** and select **Add rule**.
2. Enter the **Name** and the **Priority** (lower numbers are tried first).
3. Choose the **Method**: **Round robin** (each matching prospect goes to the next account executive in turn), **Fewest open prospects** (to whoever holds the fewest open prospects) or **Fixed account executive** (always the first one listed).
4. Choose the **Account executives** who share the work. Only active users can receive prospects.
5. Set the conditions the prospect must meet: **Line of business**, **Distribution channel**, **Province**, **City / municipality**, **Branch**, **Source** and **Category**. An empty condition matches anything.
6. Select **Save**.

When rules exist but none matches, the setting **leads.assignment_fallback** decides: **creator** (the person who entered the prospect keeps it) or **queue** (the prospect waits in the reassignment queue). Assignment can be switched off with **leads.assignment_enabled**. Every assignment is written to the prospect's **Assignment history** (rule, from, to, reason, who and when).

### Reassignment queue and bulk reassignment

The **Queue** tab lists prospects waiting for an account executive: those no rule matched (with fallback queue), those sent to the queue by a manager, and those left untouched longer than **leads.assignment_sla_hours** (the **lead-assignment-sla** job moves them each morning once it is switched on in Master > Schedules).

1. Tick one or more prospects (on the queue or on the team view).
2. Select **Reassign**, choose **To account executive** and enter the **Reason**.
3. Select **Save**. Each prospect changes owner, the history records a manual or bulk reassignment and the new owner is notified when **leads.assignment_notify** is on.

**Send to queue** returns prospects to the queue with a reason, for example when an account executive leaves.

## Distribution Channels

![Master > Insurance > Distribution Channels](/home/user/BDOI-OOTB/docs/package/source/manual-images/d-channels.png)

Choose Master > Insurance > Distribution Channels. A channel is a dealer group or dealer branch, a financing bank or bank branch, or an affinity partner (a company whose members or homeowners are referred to the broker).

1. Select **Add channel**.
2. Choose the **Channel type**. A dealer branch **Belongs to** a dealer group and a bank branch to a financing bank; a group, bank or affinity partner stands alone.
3. Enter the **Code**, **Name**, **Servicing branch code**, **Province**, **City / Municipality**, **Address**, **Contact person**, **Contact e-mail**, **Contact phone** and **TIN**.
4. For dealers and affinity partners choose the **Referrer** (the referrer of the commission master) and the **Comsub %** paid to it. Policies of the channel without their own referrer pay the referrer's share at this rate.
5. For a financing bank choose the **Bank (Bank master)**, the **Mortgagee clause** printed on its borrowers' policies ({{bankName}} is replaced by the bank's name) and the **Letter addressee** of the bank endorsement letter. A bank branch without its own clause uses the bank's.
6. Select **Save**.

The list shows each channel with its group and the **Prospects**, **Policies** and **Premium** it brought in. **Delete** removes a channel that was never used; a channel with business, branches, programmes or a billing account is made **Inactive** instead, so its history stays.

The channel is recorded on prospects (field **Distribution channel**), carried to the quotation made from the prospect and to the policy issued from the quotation (setting **channels.inherit_from_lead**). The report **Dealer Production** (Reports > Operational Reports > Dealer Production) shows per dealer group and channel the prospects, quotations, policies, sum insured, premium and commission for a period, filtered by channel, dealer group or channel type, and exports to Excel and PDF like every report.

## Dealer Programmes

![Operations > Sales & Marketing > Dealer Programmes](/home/user/BDOI-OOTB/docs/package/source/manual-images/d-dealer-programmes.png)

Choose Operations > Sales & Marketing > Dealer Programmes. A programme holds the terms agreed with a dealer, and optionally its financing bank, for brand-new vehicles.

### Set up a programme

1. Select **Add programme** and enter the **Code** and **Name**.
2. Choose the **Dealer** (group or branch), the **Financing bank** if the buyers' loans are with one bank, and the **Insurer**.
3. Under **Rates**, enter the **Own damage rate %**, **Acts of nature rate %**, **Excess bodily injury** and **Property damage** limits, the **Default vehicle class** and whether **CTPL** is included and for how many years (three years for a new car registered with the LTO).
4. Under **Who pays**, tick **Free first year** when the first-year premium is paid by the dealer or the bank, or set the **Subsidy paid by** (dealer or bank), the **Subsidy** kind (percent of premium, fixed amount, full premium) and the **Subsidy value**. The buyer pays the rest.
5. Choose what **Upload creates**: **Quotation to follow up** (draft quotations the account executive completes with the buyer) or **Policy issued** (the policy is issued and billed straight away).
6. Enter **Effective from** and **Effective to** and select **Save**. **Premium preview** shows the premium of a sample vehicle with the programme's rates.

### Upload the dealer's sales

1. Select **Template** to download the Dealer Sales upload template (Excel). One row per vehicle sold: dealer branch code, date sold, sales invoice, buyer, contact details, make, model, variant, year, colour, vehicle class, plate or conduction sticker, chassis and engine numbers, invoice price, the financing bank branch code and the loan amount.
2. On the programme, select **Upload sales** and choose the file. The system checks every row (required fields, the vehicle class, a chassis number not already uploaded) and creates, for each valid row, the prospect (channel: the dealer branch), the quotation priced with the motor tariff and, in issue mode Policy issued, the client and the policy with the financing bank as mortgagee.
3. The result lists the rows **Created** and **Failed** with the reason of each failure. Correct the failed rows and upload them again.

The premium is billed to who pays: the dealer or the bank for its subsidy, the buyer for the rest, each through its own bill with its booking journal. The commission of the policy is split in proportion.

### Bank endorsement letter

For every financed sale, **Bank endorsement letter** prints the letter to the bank confirming the policy, the vehicle, the loan and the mortgagee clause. **Bank letters of the batch** prints the letters of a whole upload in one PDF. **E-mail the letter to the bank** queues the letter as a PDF attachment to the bank branch's contact e-mail (or the bank's). With the setting **motor_programmes.email_bank_letter** on, the letters are queued automatically when an upload issues financed policies. The letter's subject and wording are in the settings **motor_programmes.bank_letter_subject** and **motor_programmes.bank_letter_body**.

## Fleet Schedules

Choose Operations > Fleet Schedules. A fleet schedule is one motor policy covering many vehicles of a client.

![Operations > Fleet Schedules](/home/user/BDOI-OOTB/docs/package/source/manual-images/d-fleet.png)

1. Select **New fleet schedule**. Choose the **Client** and **Insurer**, the **Period from** and **Period to**, and the rates: **Own damage rate %**, **Acts of nature rate %**, **Excess bodily injury**, **Property damage**.
2. Add the vehicles: **Add vehicle** for one, or **Template** and **Upload vehicles** for many (Fleet Vehicles upload template). For each vehicle enter the plate number or conduction sticker, chassis and engine numbers, make, model, year model, colour, **Vehicle class (CTPL tariff)**, usage, sum insured and mortgagee if any.
3. Each vehicle is priced on its own: own damage and acts of nature on its sum insured, the excess liability premium, the CTPL of its class and the premium taxes. The totals show under **Vehicles on cover**.
4. Select **Issue policy**. The policy is issued for the totals of the schedule and billed with its booking journal and commission, like any policy. At least **fleet.minimum_vehicles** vehicles are needed.

After issue, **Add vehicle by endorsement** adds a vehicle and **Delete** (on a vehicle row) removes one. Each change is an endorsement whose premium is the vehicle's annual premium pro-rata to the days left (setting **fleet.pro_rata_basis**); completing it bills the additional premium or credits the return premium (setting **fleet.return_premium_on_delete**). **Schedule PDF** prints the schedule of vehicles on cover with each vehicle's premium and CTPL; **Excel** exports it.

## Marine Open Covers

![Operations > Marine Open Covers](/home/user/BDOI-OOTB/docs/package/source/manual-images/d-marine.png)

Choose Operations > Marine Open Covers. An open cover insures a client's cargo shipments for a period: each shipment is certified or declared and the premium is billed per declaration period.

### Set up the open cover

1. Select **New open cover**. Choose the **Client** and **Insurer**, enter the **Period from** and **Period to**, the **Goods insured**, **Voyages** and **Clauses**.
2. For each conveyance (Sea, Air, Land) covered, enter the **Rate %** and the **Limit any one conveyance**.
3. Enter the **Mark-up on invoice %** (insured value = invoice value plus the mark-up; default in **marine.default_markup_percent**), the **Minimum premium per certificate** and the declaration frequency (monthly or quarterly).
4. Select **Save**, then **Activate**. Activating issues the open policy without a bill; the premium is billed through the declarations.

### Certificates and shipments

1. On an active cover select **Issue certificate**. Enter the shipment date, the **Conveyance**, **Vessel / flight**, voyage **From** and **To**, **Bill of lading / airway bill**, consignee, packing, goods and the **Invoice value**.
2. The system computes the **Insured value** and the premium (at least the minimum premium) and refuses a shipment over the limit of its conveyance or outside the period.
3. **Print** produces the certificate of insurance (wording in **marine.certificate_wording**). **Cancel certificate** cancels a certificate issued in error.

**Shipment without certificate** records a shipment the client declares without a certificate having been issued.

### Declarations, billing and remittance

1. Open **Declarations** and select **New declaration** for the period. The certificates and declared shipments of the period are gathered with their premium and the premium taxes of the marine line. A period with no shipment is a nil declaration.
2. **Submit** the declaration, then **Bill** it. Billing raises the bill on the open policy (premium receivable, booking journal, collection item and commission). Collection, the official receipt and the remittance to the insurer follow as for any bill.

Declarations are due **marine.declaration_due_days** days after the period ends.

## Comparison Reports

![Operations > Sales & Marketing > Comparison Reports](/home/user/BDOI-OOTB/docs/package/source/manual-images/d-comparison.png)

Choose Operations > Sales & Marketing > Comparison Reports. The comparison report is the printed, branded document given to the client comparing the insurers' offers, with the option the broker recommends and why. It never shows commission.

1. Select **New report**. Choose what is **Compared**: a **Request for quotation** (its insurers' offers become the options) or two or more **Quotations** of the same client or prospect (enter their numbers). From a request for quotation the report can also be opened with the address /sales/comparison-reports?brokerSlipId= followed by the slip.
2. Select **Prepare**. The options are ranked by total premium.
3. Edit **Prepared for**, **Title** and **Introduction** (defaults in the **comparison.*** settings). For each option enter **What stands out**.
4. Choose the option to **Recommend** and write **Why we recommend it**, one reason per line; the suggested reasons of **comparison.default_reasons** can be added with one click. Adjust the **Disclaimer**.
5. Select **Save**, then **Client report (PDF)** to print it on the letterhead.

**E-mail to the client** queues the report as a PDF attachment to the client's e-mail on file or to the address entered. When the client decides, **Client chose** on the chosen option records the decision and closes the report as **Accepted**.

## Campaigns

![Operations > Sales & Marketing > Campaigns](/home/user/BDOI-OOTB/docs/package/source/manual-images/d-campaigns.png)

Choose Operations > Sales & Marketing > Campaigns. Campaigns e-mail offers only to clients and prospects whose marketing consent is in force in the consent register (Master > Data Privacy) and who have an e-mail address. Everyone else is left out and recorded with the reason.

### Segments

1. Open **Segments** and select **New segment**.
2. Choose **Who** (clients, prospects or both) and narrow the audience by **Line of business**, **Province**, **City / municipality**, **Distribution channel**, **Client type**, **Prospect status** and **Policy expiring within (days)**.
3. Select **Who is reached**. The preview shows how many match, how many are reachable and how many are **Left out because** of a missing or withdrawn consent or a missing e-mail.
4. Select **Save**.

### Templates

1. Open **Templates** and select **New template**. Enter the **Code**, **Name**, **Subject** and the **Message (HTML)**.
2. Use the placeholders {{firstName}}, {{fullName}}, {{companyName}} and {{optOutLink}}. A template without an opt-out link gets the unsubscribe paragraph of **campaigns.opt_out_text** added at the end.
3. **Preview** shows the template filled in for a sample recipient.

### Send a campaign and read the results

1. On **Campaigns**, select **New campaign**, enter the **Name** and choose the **Segment** and **Template**.
2. Select **Send now** to queue the e-mails to the E-mail Outbox, or **Schedule** to choose the date and time; the **campaign-dispatch** job sends scheduled campaigns. **Cancel campaign** stops a draft or scheduled campaign.
3. **Results** shows the recipients, the e-mails sent, waiting and failed (from the outbox), those excluded by reason, opt-outs, and the recipients who were quoted or insured within **campaigns.conversion_window_days** days.

Each e-mail carries its own opt-out link. Opening it shows an unsubscribe page; confirming records a refusal of the marketing purpose in the consent register (channel E-mail), so later campaigns leave the person out. A campaign reaches at most **campaigns.max_recipients** people.

## Report Builder

![Reports > Report Builder](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-report-builder.png)

Choose Reports > Report Builder. The Report Builder answers ad hoc questions over curated datasets (Policies, Clients, Bills (premium receivables), Claims and Commissions); each dataset needs the read permission of its module without a new report being programmed. A user who sees only their own book (data scope) sees only their own rows here too.

1. On **Build**, choose the **Dataset**.
2. Choose the **Columns**. Without grouping each row is a record; with **Group by** (up to five text or date columns) each row is a group and the numeric columns chosen are summed (a count column counts the records).
3. **Add filter** for each condition: the column, the operator (equals, contains, between and so on, depending on the type) and the value.
4. Choose **Sort by** and the direction.
5. Select **Run** to see the result with the totals of the numeric columns. The screen shows up to **report_builder.preview_rows** rows; **Export to Excel** exports all of them, up to **report_builder.max_rows**.
6. Select **Save report**, enter the **Name** and **Description** and choose the roles to **Share with**. A report shared with no role is private.

**Saved reports** lists your own reports and those shared with your roles: **Open** loads one into Build, **Export to Excel** exports it directly, and the owner or the administrator can delete it.

### BI extract

The administrator's **BI extract** tab lists the runs of the **bi-extract** job, which writes one CSV file per dataset listed in **bi.extract_datasets** to the storage folder **bi.extract_folder**, dated, for the BI tool to pick up. **Run now** runs it immediately. The job keeps the last **bi.extract_keep_runs** runs.
# Module reference

This chapter lists every menu screen in menu order with its purpose, its main fields and the rules that apply. The persona chapters give the step-by-step procedures; the reference points to them.

## Dashboard

| Screen | Purpose | Main content and rules | Roles |
|---|---|---|---|
| Executive Dashboard | Business performance against target. | Period (This Month, This Quarter, This Year); Total Revenue, Active Policies, New Business, Claims Rate, Retention Rate, Premium Receivable (Clients), Commission Receivable (Insurers, Direct Bill), each change against the same number of days of the previous period; migrated policies are not premium written; trends, revenue by product line, regional performance, top products, top sales performance; **Export Report** (Production Register); **Settings** (roles that may open System Settings) opens Master > System Settings. Targets from `dashboard.targets`. | All but Claims |
| Claims Dashboard | Claims workload. | Total Open Claims, Claims Overdue (`claims.sla_days`), Today's Claims, recent claims; **Export Report**. | Claims, System Administrator |
| Processing Dashboard | Processing Workbench. | Submissions, cycle time, open alerts, workload, submissions list, open tasks; **New Submission**. | Processing Team, System Administrator |
| Sales Dashboard | Sales team performance. | Sales person, period; prospects, quotations, conversion, policies issued, premium, open pipeline; trend and pipelines. | Sales & Marketing, System Administrator |

![Dashboard > Executive Dashboard](/home/user/BDOI-OOTB/docs/package/source/manual-images/s-exec-dashboard.png)

## Operations

### Home

The landing page of every role after sign-in: My Work with the role preset (categories first, default scope, Calendar categories, the one primary button and two or three role figures; chapter Home). The same screen as Operations > My Work; `/agent/home` and the former Open Items addresses open it.

### Sales & Marketing

| Screen | Purpose | Fields and rules | Procedure |
|---|---|---|---|
| Prospects | Record and follow prospects (LD-). | Category, names, date of birth (age 18 to 100), gender, e-mail, Philippine mobile number, address with 4-digit ZIP code; statuses New, Contacted, Qualified, QuoteGenerated, Converted, Lost; **Bulk Upload** (.xlsx or .csv, up to 10 MB). | Sales & Marketing |
| Quick Quote | Quote package products on the spot. | **Start quote** for products with a wizard; **Request quotation** for the others. | Sales & Marketing |
| Requests for Quotation (Broker Slips) | Present a risk to several insurers (BS-) and record offers (OFR-). | Customer, product, insured, period, response due, risk details, covers, insurers to approach (required); statuses Draft, Submitted, Responses in, Closed, Cancelled. | Processing Team |
| Quotations | Price cover for the client (QT-). | Server re-pricing; validity 30 days; statuses Draft, Pending Customer, Customer Accepted, Approved, Rejected, Dropped, Expired, Converted to Policy; customer response Accepted, Declined, Revise. | Sales & Marketing |
| Placement Slips | Firm order to the insurers (PS-). | Participants with shares totalling exactly 100% and one lead; statuses Placement raised, Sent to insurer, Acknowledged, e-Policy received, Checked against slip, Insurer issued (Booked), Declined, Cancelled; **New direct placement**, **Record e-Policy**. | Processing Team |
| Lead Assignment | Give each prospect an account executive. | Tabs Team View, Queue, Assignment Rules; methods round robin, fewest open prospects, fixed; `leads.assignment_fallback`, `leads.assignment_sla_hours`. | Distribution, programmes and products |
| Dealer Programmes | Brand-new vehicle programmes with dealers and financing banks. | Rates, who pays (free first year, subsidy), what the upload creates; Dealer Sales upload (DSB-); bank endorsement letters. | Distribution, programmes and products |
| Comparison Reports | The branded comparison of insurers' offers given to the client (CMP-). | From a request for quotation or several quotations; recommended option and reasons; never shows commission; **Client report (PDF)**, **E-mail to the client**, **Client chose**. | Distribution, programmes and products |
| Campaigns | E-mail campaigns to clients and prospects with marketing consent. | Segments, templates with {{optOutLink}}, **Send now** or **Schedule** (`campaign-dispatch` job), results and opt-outs; `campaigns.max_recipients`. | Distribution, programmes and products |
| Sales Activities | Calls, meetings, e-mails and visits logged on prospects, clients and quotations. | Period, account executive, type and outcome filters; **Activity Report** per account executive; next steps become My Work tasks; types and outcomes in Master > Organization. | Sales & Marketing |

### Clients, Policy and Claims

| Screen | Purpose | Fields and rules | Procedure |
|---|---|---|---|
| Clients | The client record (CL-) with tabs Policy, Claim, Renewal, Endorsement, Data privacy. | Created at the first policy; details changed by Personal Details Change endorsement. | Operations |
| Policy | Policies (POL-) with payment status; **More actions**: Claim, Endorsement; **Bulk Upload**. | Policy statuses Active, Expired, Renewed, Lapsed, Cancelled; payment statuses Pending, Reviewing, Partial, Completed, Refunded; motor issue needs the KYC fields. | Sales & Marketing, Operations |
| Claims | Claims (CLM-) and their journey. | Date of loss inside the policy period and not in the future; blocked while premium unpaid; settlement maker-checker; statuses Pending, Processing, Pending Approval, Approved, Settled, Rejected, Closed. | Claims |
| Fleet Schedules | One motor policy covering many vehicles (FLT-). | Vehicles priced one by one (own damage, acts of nature, excess liability, CTPL by class, taxes); **Issue policy**; add or delete a vehicle by endorsement pro-rata; `fleet.minimum_vehicles`. | Distribution, programmes and products |
| Marine Open Covers | A client's cargo shipments for a period (MOC-, MIC-, MDC-). | Rate and limit per conveyance, mark-up on invoice, minimum premium per certificate; certificates and declared shipments; monthly or quarterly declarations billed on the open policy. | Distribution, programmes and products |
| Claim Documents | The checklist of documents of each claim. | Required and optional documents by line and claim type; **Received**, **Waive**, **Add document**, **Remind the claimant**, **Submit to insurer** (refused while a required document is missing). | Claims |
| Motor Claim Repairs | Repair estimates, adjuster decisions, letters of authority (LOA-) and vehicle release. | Accredited repair shops; participation and parts depreciation from `motor_claims.*`; supplementary estimates and letters. | Claims |

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

### My Work, Payments, CTPL Authentication, Cover Notes and Policy Cancellation

| Screen | Purpose | Fields and rules | Procedure |
|---|---|---|---|
| My Work | The daily worklist of the user and the team. | Tabs My Items, My Team, My Tasks, Calendar; counts Overdue, Due today, Next 7 days (`myWork.due_soon_days`), Open items, Open tasks; **New task**, **Reassign**; automatic follow-up tasks (`myWork.auto_tasks`). The old Open Items addresses open My Work. | Operations |
| Payments | Premium of the user's policies. | Gross premium, collected premium, receivables and earned commission; tabs Paid, Pending, Reviewing; type Policy, Renewal Policy or Endorsement. | Operations |
| CTPL Authentication | Authentication of CTPL certificates of cover with the IC-accredited provider. | COC series per insurer and branch; automatic request at issue (`ctpl.authenticate_on_issue`); **Authenticate now**, **Vehicle details**, **Enter code from the provider portal**, **Register a policy**; LTO feed. | Operations |
| Cover Notes | Temporary evidence of cover (CVN-) from an accepted quotation or a placement slip. | Cover period `cover_note.validity_days` (30) up to `cover_note.max_validity_days`; statuses Active, Superseded, Expired, Cancelled; **Print**, **E-mail to the client**; job `cover-note-expiry`. | Operations |
| Policy Cancellation | Cancellation with a computed return premium. | Methods pro-rata, short-period (Short-Period Rates), flat; reasons from Cancellation Reasons; returned taxes `endorsements.cancellation_returned_taxes`; posting rules policy.cancel and endorsement.return_premium. | Operations |

## Accounts

| Screen | Purpose | Main fields and rules |
|---|---|---|
| Receipts | Official receipts (OR-, RT-) against open bills. | Receipt date and type, branch, department, customer code, policy, currency, transaction code, receipt mode, remarks; amount not above the bill balance; **Bulk Print**, **Bulk Upload** (1,000 rows). |
| Collections | Open premium by ageing bucket; reminders; **Import open items**. | Due date from the insurer's premium payment warranty or 30 days; reminders 7 days before due, then every 7 days. |
| Credit Control > Instalment Plans | Instalment schedules of broker-billed bills. | 4 instalments proposed, up to 12; monthly, quarterly, semi-annual. |
| Credit Control > Premium Warranty Monitor | Unpaid premium past or near the insurer's warranty. | At risk from 7 days before the deadline; extensions up to 90 days, approved by the Accounting Manager. |
| Credit Control > Client Credit Limits | Credit limit per client against open premium. | Over-limit policies issued with a warning; limits set by the Accounting Manager. |
| Credit Control > Remittance Ageing | Collected premium not yet remitted, per insurer. | Aged on the insurer's remittance terms from the collection date; **Excel**. |
| Post-Dated Cheques | Register of cheques received before their date (PDC-). | **Register cheque**, **Deposit** (posts the official receipt), **Cleared**, **Bounced** (receipt cancelled, client e-mailed), **Replace**, **Return**, **Cancel**; tab Deposit due (`pdc.due_window_days`); job `pdc-deposit-due`. |
| Claims Settlements | Settlements paid through the broker. | **Funds received** (posting rule claim.funds_received), **Pay claimant** (claim.paid_to_claimant, voucher CPV-), **Release form**; receipts and disbursements permissions. |
| Payables (Supplier Invoices, Supplier Payments, AP Ageing, Suppliers, Supplier 2307) | Accounts payable sub-ledger (APV-, SPV-) and the suppliers' BIR Form 2307. | Input VAT and EWT computed from the supplier's tax codes; approval by the Accounting Manager (`payables.maker_checker`); posting rules ap.invoice and ap.payment; an asset line goes to the fixed asset register. |
| Fixed Assets (Asset Register, Depreciation Run, Disposals) | Fixed asset register (FA-), straight-line depreciation and disposals (FAD-). | Asset classes with useful life and accounts; one journal per class and period (fa.depreciation); sale with output VAT and sales invoice, or write-off (fa.disposal); gain or loss accounts. |
| Disbursement | Payment vouchers and cheques (PV-, DT-). | Payee type, criteria, payee, policy, transaction type, currency; maker-checker; statuses Draft, For approval, Approved, Paid, Cancelled. |
| Bank Payment Files | Payment of approved vouchers by bank upload file (BPB-). | Layout per bank (Master > Finance > Bank File Layouts), channel bulk credit, InstaPay (`bank_payments.instapay_limit`) or PESONet, value date; approval within the Authority Matrix; **Write file**, **Mark uploaded to the bank**, **Import status file**, **Record result**. |
| Journal Voucher, Correction JV, Reversal JV | Manual journals (JV-), corrections and reversals. | Must balance; approval required (`journal.require_approval`); period status rules. |
| Open Entry Matching, Open Entry Unmatching | Match open debit and credit entries of an account; write-offs. | Sub account code, pull, match; write-off reason limits. |
| Accounting Query | Search accounting entries. | Policy, client, entry type, reference type, status, dates, GL code; **Export**. |
| All Clients Accounting | Balance per client. | Transactions, debits, credits, balance; **Export CSV**. |
| Petty Cash (Initiate, Request, Disbursement, Receipts, Replenish) | Petty cash funds and their movements (PC-, PCR-, PCRC-). | Fund size, maximum per transaction, minimum cash box; maker-checker. |
| Bank Reconciliation (Workspace, Reconciliations, reports) | Statements (BST-), matching, adjustments, reconciliations (BRC-). | Balanced statement; duplicate file refused; auto-match rules; stale cheques after 180 days; approval by the Accounting Manager. |
| Insurer Reconciliation > Insurer Statements | Insurer statements of account (ISR-) matched to remittances and debit notes. | Tolerance PHP 1.00; every difference resolved before submission; approval by the Accounting Manager. |
| Tax (BIR Form 2307, VAT Summary, SAWT, QAP, SLSP Sales, SLSP Purchases) | BIR certificates, working papers and alphalists. | Quarter and payee; ATC per payee type; broker details in `bir.*`. |
| Tax > Withholding Returns, Annual Alphalist 1604-E, Percentage Tax 2551Q | The BIR forms 0619-E, 1601-EQ, 1604-E and 2551Q laid out as the forms, with their filing records. | Reconciled with the QAP and the ledger; **Print**, **Excel**, **Record filing**, **Amended return**; due dates from `bir.withholding_due_day`; percentage tax rate `bir.percentage_tax_rate`. |
| Tax > BIR DAT Files | The validation data files of the QAP, SAWT, SLSP and 1604-E alphalist. | BIR Alphalist Data Entry and Validation Module 7.x and RELIEF layouts; warnings for payees without TIN; validate with the BIR module before submitting. |
| Tax > Sales Invoices | The broker's sales invoices under the EOPT Act (SI-) and payment acknowledgements (PAR-). | For debit notes, overriding commission, policy commission or manual fees; serial range `invoice.serial_from` to `invoice.serial_to`; posting rules sales_invoice.issue and sales_invoice.payment; **Cancel invoice**. |
| Tax > E-Invoicing (EIS) | Outbox of e-invoices for the BIR Electronic Invoicing System. | `eis.enabled`, `eis.mode` (test or live), credentials by environment variable names; job `eis-outbox`; **Send now**, **Retry**, **Queue earlier invoices**, **Export payloads**, **Uploaded manually**. |
| Tax > CAS Books and Documents | Loose-leaf books of accounts and the CAS registration documents. | Readiness checks; books printed month by month with running page numbers (`cas.enforce_print_order`); print register, **Reprint**, **Void print**; system description, backup procedure and audit trail extract. |
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
| Insurer Overrides (Agreements, Computations) | Overriding, profit and contingent commission agreements with insurers (basis production, loss ratio or growth; slab or banded tiers) and their computations per period (OVC-): **Compute**, **Submit for approval**, **Approve** (posting rule override_commission.accrual), **Issue invoice**, **Settle** (override_commission.settlement). |

## Reports

| Screen | Content |
|---|---|
| All Reports | Every report the role may run, grouped, with a description and a search box. |
| Operational Reports | Production, Claims, Renewal, Remittance, Broker Commission, Dealer Production. |
| Financial Reports | SOA/Premium Receivable, Collection Report, Payables, Journal, Trial Balance, Income Statement, Balance Sheet, Trial Balance Movement, General Ledger Detail, Aged Payables to Insurers, Month-End Close Status, Co-insurance Register, Due to Insurers by Co-insurer. |
| Report Builder | Ad hoc reports over the datasets Policies, Clients, Bills, Claims and Commissions: columns, grouping, filters, sort, Excel export, saved reports shared by role; BI extract runs for the administrator. |

See the chapter Reports, dashboards, schedules and notifications.

## Master

### Configuration screens

| Screen | Purpose |
|---|---|
| System Settings | Branding (app title, logo, favicon), display currency, default language, theme colours; link to Theme and Branding. |
| System Settings > Theme and Branding | Theme presets, layout, font and colours with the WCAG AA contrast check; sign-in page picture and texts; document, report and Excel branding; e-mail layout; application name and images; document signature mapping; brand pack export and import (System Administrator chapter). |
| Configuration | Every business setting by area; changes audited. |
| Document Numbering | Number series: prefix, format tokens, digits, counter reset, next number. |
| Schedules | Scheduled jobs: timetable, status, next and last run; **Run now**, **Run history**, **Edit schedule**. |
| Audit Trail | Every audited action by record type, record ID, user and dates. |
| E-mail Outbox | Queued, sent and failed e-mails with their attachments; **Retry**. |
| Integrations | Connectors (SMS, Viber, CTPL authentication, LTO feed, insurer API, bank files) with mode, credentials by environment variable name, retries and **Test connection**; the outbox and inbox of every message; job `integration-outbox`. |
| Message Templates | SMS and Viber texts with placeholders, consent needed and connector; **Send a test**; the messages sent. |
| Insurer Integration | Mapping per insurer (broker code, product codes, request and answer maps, claim statuses); requests for policy issuance, premium data and claim status; claim status file import. |
| Go-Live Data Load | Configuration and migration workbooks: **Blank template**, **Current data**, **Upload and validate**, errors download, **Load**, reconciliation, history (chapter Go-Live Data Load). |
| Data Privacy > Data Subject Requests | Requests of data subjects (DSR-) with due dates; **Log request**, **Export personal data**, **Anonymise**, **Close**. |
| Data Privacy > Consent Register | Consents given, refused and withdrawn by clients and prospects. |

### Organization, Insurance, Location, Employees, Users and Access

| Screen | Purpose and main fields |
|---|---|
| Organization > Company | The broker company: code, name, licence number, e-mail, TIN, logo, website, address, phone, fax; letterhead company. |
| Organization > Branch | Branches and departments. |
| Organization > Sales Activity Types, Sales Activity Outcomes | The activity types (channel, default days to the next step) and the outcomes (positive, neutral or negative) of the sales activity log. |
| Insurance > Insurance Company | Insurers: code, name, address, phone, e-mail, TIN, IC Certificate of Authority No. and its validity; credit terms (premium payment warranty, remittance terms, default billing mode); **Upload**. |
| Insurance > Line of Business, Product, Cover | Lines, products (with their line) and covers. |
| Insurance > Signatories | Authorised signatories of quotations and documents. |
| Insurance > Vehicle | Vehicle brands, models, variants, seating; **Upload**. |
| Insurance > Short-Period Rates, Cancellation Reasons, Claim Document Checklist, Repair Shops | The operational masters: the percentage the insurer keeps per period in force; who initiates each cancellation reason and its method; the documents each claim needs by line and type; the accredited repair shops. |
| Insurance > Distribution Channels | Dealer groups and branches, financing banks and branches, affinity partners, with referrer and comsub, mortgagee clause and letter addressee; prospects, policies and premium per channel. |
| Location > Country, Province, City / Municipality | The PSGC address lists (regions, provinces, cities and municipalities with ZIP codes; barangays on the address forms); **Upload**. |
| Employees > Hierarchy, Designation | Staff structure; branch, designation and reporting line are set on the user. |
| Users and Access > User, Role, User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of Duties, Access Reviews | Users and access controls (System Administrator chapter). |

### Finance

| Screen | Purpose and main fields |
|---|---|
| Account Determination | GL account per account role, payable per payee type, cash account per payment mode, commission taxes, write-off reasons. |
| Posting Rules | The journal rule of each business event; simulate, version, history. |
| Configuration Approvals | Pending posting configuration changes for a second user. |
| Accounting Flow | What each event posts, from the rules in force. |
| Package Bundles | Packages sold under one master policy (sections with their own insurer): code, bundle, customer segment, sections, bundle discount, default sum insured; **Add bundle**. |
| Insurer Rate Tables | Each insurer's rates for package products: product, insurer, rate basis, rate, minimum premium, deductible, key benefits, commission, effective dates; used by Package Bundles; **Add rate**. |
| Premium Taxes & LGU Rates | VAT or premium tax, DST, FST and the local government tax per city or municipality (code, city, province, rate, effective dates); tabs Local government tax, Tax and charge rules, Calculator; **Add city / municipality**. |
| Payment Gateways | Online payment of premium (GCash, Maya, GrabPay, cards, online banking) through a payment link: gateway, mode (sandbox or live), methods, fee, link validity (72 hours), issue the policy when paid, bank account credited; payment log. Merchant keys are set on the server, never on the screen. |
| Commission Rate Matrix | Brokerage rates by insurer, product, line and policy type; **Add rate**, **Find rate**. |
| Transaction Code, Currency, Exchange Rate | Accounting transaction codes, currencies and exchange rates. |
| Bank | Banks and bank accounts with GL cash account, statement format and reconcile-from date; **Upload**. |
| Account Category, Main Account, Sub Account | The chart of accounts: code, name, statement group, category, normal balance, open-item flag, manual JV allowed, system use, status; **Upload**. |
| Taxation | Tax codes with rate, BIR ATC, GL account and effective date. |
| Close Checklist | Month-end checklist items, automatic or manual, blocking or warning. |
| Asset Classes | Classes of the fixed asset register with useful life and the asset, accumulated depreciation and depreciation expense accounts. |
| Bank Statement Formats, Bank Transaction Types, Insurer Statement Formats | How statement files are read; bank items and matching rules. |
| Bank File Layouts | How each bank's payment upload file is written (delimited or fixed width, header, payment and trailer records, file name) and its status file read; the payee bank accounts; starter layouts in test mode until validated with the bank. |
| Remittance Master | Automated remittance, statement templates, settlement parameters, bulk processing formats, exceptions, agency bill, adjustment and notification templates. |

![Master > Finance > Premium Taxes & LGU Rates](/home/user/BDOI-OOTB/docs/package/source/manual-images/ad-premium-taxes.png)

### Incentive masters

| Screen | Purpose |
|---|---|
| Incentive Programs | Incentive programmes (INC-): type, target metric, base target, frequency, dates. |

## Product Configurator

| Screen | Purpose |
|---|---|
| Dashboard | Products with category, line, version, status, base rate and commission; active products, total premium, average loss ratio and commission. |
| Product Templates | Product templates (TPL-) with versions and status (Draft, Active, Retired); the motor tariff. |
| Coverage Builder | Covers: code, template, name, mandatory or optional, deductible, premium impact. |
| Rating Engine | Rating factors with their template and rules; Test Calculator. |
| Acceptance Rules | Acceptance, validation and loading rules, each with its template. |
| Document Manager | Document templates per stage and product template. |
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
| CVN, LOA, CPV | Cover note, letter of authority, claim payment voucher |
| PDC, BPB | Post-dated cheque, bank payment batch |
| APV, SPV, FA, FAD | Supplier invoice voucher, supplier payment, fixed asset, asset disposal |
| OVC, SI, PAR | Overriding commission computation, sales invoice, payment acknowledgement |
| CMP | Comparison report |
| DSB, FLT, MOC, MIC, MDC | Dealer sales batch, fleet schedule, marine open cover, marine certificate, marine declaration |

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
| Product dashboards | Product Configurator > Dashboard, Product Analytics | Processing Team (Dashboard also Sales and Operations) |

Dashboards show live figures; they change as soon as a transaction is saved. The Executive Dashboard compares the period chosen (This Month, This Quarter, This Year, calendar periods in Manila time) with the same number of days of the previous period (on 04 October, This Month compares 1 to 4 October with 1 to 4 September), so a period that has just started is not compared with a whole one. A change above 999% shows as > +999%; no change is shown when the previous period had nothing to compare with. Policies loaded by the go-live migration count in **Active Policies** but not in premium written or **New Business**. Measures the system does not capture are not shown. The dashboard shows the targets of `dashboard.targets`. **Export Report** downloads the Production Register for the dates chosen.

## Schedules

BrokerVerse runs its daily work through scheduled jobs, in Manila time: policy expiry (00:15), quotation expiry (00:30), dormant accounts (01:45), housekeeping (02:45), daily reports (05:00), renewal pipeline (05:30), renewal notices (06:00), cover note expiry (06:20), post-dated cheques due (06:25), missing claim document reminders (06:35), receivable ageing (07:00), collection reminders (08:00), My Work reminders (every 15 minutes), the e-mail outbox (every 5 minutes), the integration outbox (every 2 minutes) and the renewal notice queue (every minute). Jobs delivered switched off, to be switched on by the process owner: accrual auto-reversal, recurring journals, period auto soft-close, bank reconciliation auto-match, the month-end close reminder, remittance schedules, overdue data subject requests, SMS renewal notices and payment reminders, campaign dispatch, lead assignment SLA, the EIS outbox and the BI extract. The System Administrator sees and runs the jobs on Master > Schedules. The BrokerVerse Schedules and Batch Jobs document describes each job, what it reads and writes, and what to do when it fails.

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
| Finance | Journal voucher and petty cash approvals; month-end reminders; close run to approve; supplier invoices to approve; post-dated cheques due; bounced cheques. |
| Data privacy | Data subject requests overdue. |
| My Work | Task reminders at the time chosen; one alert for an overdue task. |

**E-mails** are queued in the E-mail Outbox and sent by the E-mail outbox job when sending is switched on, in the branded layout of Theme and Branding. The main e-mails are the quotation approval request and shared quotation to clients, the request for quotation and the placement slip to insurers, the policy issued and endorsement notices to clients, the renewal notices (First, Second and Final Notice), the premium payment reminders, the Preliminary Loss Advice and the missing document reminders of claims, the commission debit note and the remittance statements to insurers, the cover note, the comparison report and the bank endorsement letter, campaign e-mails, scheduled reports to staff and the password reset code. Official receipts, premium invoices, cover notes, debit notes, comparison reports and bank letters travel as PDF attachments (up to `email.max_attachment_mb`); other documents as download links. **SMS and Viber** messages (renewal notices, payment reminders, claim updates, CTPL authentication) are sent through the connectors of Master > System > Integrations with the texts of Message Templates, once a connector is live and the jobs are switched on; until then, and for WhatsApp, phone and letter, the action is only recorded. The wording of each e-mail is a template in Master > Configuration; the BrokerVerse Communication Templates and Touchpoints document lists every e-mail and notification with its trigger, recipient and text.

![Notifications under the bell](/home/user/BDOI-OOTB/docs/package/source/manual-images/gs-bell.png)

# Troubleshooting, FAQ and glossary

## Common messages and what to do

| Message or problem | What it means and what to do |
|---|---|
| Not authorised: Your role does not give access to this screen | The screen is not part of your role. Use your menu, or ask the System Administrator whether your role is right. |
| Account locked after failed sign-ins | 5 wrong passwords in a row. Ask the System Administrator to unlock the user or reset the password. |
| Too many sign-in attempts | More than 10 attempts in 5 minutes from one computer or for one user. Wait 5 minutes, then sign in again. |
| The code is not valid. Try the current code. | Two-step verification refused the code. Type the code the app shows now; check that the phone's clock is set automatically. |
| Your session has ended (password changed, account updated or signed in elsewhere). Please sign in again. | Your password or role changed, your account was updated, or you signed in on another computer. Sign in again. |
| You were signed out | 30 minutes without activity. Sign in again. |
| The new password does not meet all the rules below. | Choose a password that ticks every rule under **New password**. |
| The two new passwords do not match. | Type the same password in **New password** and **Confirm new password**. |
| Set the cutover date (golive.cutover_date) first | Go-Live Data Load refuses the migration workbook until the cutover date is set on Master > Configuration, group Go-live. |
| Go-live is locked: the migration workbook can no longer be loaded | The go-live lock is on. Only the configuration workbook can still be loaded. |
| Invalid mobile number | Use a Philippine mobile number: 0917 123 4567, +63 917 123 4567 or 9171234567. |
| A required field is empty | Fill in every field marked with an asterisk. |
| Shares must total exactly 100% (now ...%) | Correct the participants' shares so that they total 100%, with exactly one lead. |
| Exactly one participant must be the lead insurer | Tick Lead for one participant only. |
| This line requires a Placement Slip before the policy is issued | Open the placement slip raised when the client accepted, send it, record the e-policy, have it checked and book it. |
| The policy is booked only once the insurer has issued it | The e-policy has not been recorded or checked against the slip yet, or your role cannot book policies. |
| Maker-checker: the check against the slip must be confirmed by a user other than the one who recorded the e-policy | Ask another user to make the check. |
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
| Cannot save: ... contrast ... is below WCAG AA 4.5:1 | Theme and Branding refuses a theme whose button, header or table header text does not reach 4.5:1. Change the text or background colour until the badge is green. |
| Submit to insurer is disabled on a claim | A required document of the checklist is still missing (`claims.require_documents_before_submission`). Mark it received, upload it or waive it with a reason. |
| The disposal is refused: a month before it is not depreciated | Run the Depreciation Run up to the month before the disposal first (`fixed_assets.disposal_requires_depreciation_to_date`). |
| Something went wrong on this screen | Reload the screen. If it persists, report the screen, the record number, the time and the request ID to support. |

## Frequently asked questions

**Why do I not see a menu my colleague has?** The menu shows only the items of your role. Ask the System Administrator if you need another role.

**Can I delete a policy, a receipt or a journal?** No. Records that reached the ledger are corrected by an endorsement, a reversal, a correction journal or a cancellation, so the audit trail stays complete.

**Who posts the official receipt?** Only Accounting. Other roles record how the client paid; Accounting verifies the payment and posts the receipt.

**When does the referrer get paid?** When the premium is fully collected, the commission line becomes eligible; another Accounting user approves it and Accounting pays it by voucher less withholding tax. The referrer must have a bank account on file.

**What is the difference between broker billed and direct bill?** Broker billed: the client pays the broker, who remits the premium to the insurer net of commission. Direct bill: the client pays the insurer, and the broker bills its commission plus VAT to the insurer with a debit note.

**How are co-insurance amounts split?** By each insurer's share; the rounding remainder goes to the lead. The same split applies to the bill, the remittance, claims and the reports.

**Can I work on a period that is closed?** No. A soft-closed period accepts postings from the Accounting Manager only; a closed period accepts none until the Accounting Manager reopens it.

**How do I correct my name or contact number?** Select your initials, then **Profile**, and **Edit Profile**. Your user ID, role, branch, designation, reporting line and e-mail address are kept by the System Administrator: ask for those changes.

**How do I report a problem?** Give the menu path, the record number (for example PS-2026-00023), the time to the minute, your user ID, the message and the request ID shown in the error. Never send a password or a two-step code.

## Glossary

| Term | Meaning |
|---|---|
| Account role | A name for the purpose of an account (for example commission income) that a posting rule uses; Account Determination maps it to a GL account. |
| APPA | Auto Passenger Personal Accident: personal accident cover for the driver and passengers of a vehicle, priced per seat. |
| ATC | Alphanumeric Tax Code of the BIR, for example WI515 or WC139. |
| BIR Form 2307 | Certificate of Creditable Tax Withheld at Source, issued by the withholding agent to the payee each quarter. |
| Billing mode | How the premium is paid: broker billed or direct bill. |
| Checked against slip | The e-policy returned by the insurer was compared with the placement slip and confirmed by a second user. |
| e-Policy | The issued policy the insurer sends back to the broker, recorded against the placement slip. |
| Brand pack | The branding of one environment in one file (theme, application name, logo, favicon, sign-in picture, print logo), exported and imported on Theme and Branding. A bundled pack is delivered with the product and enabled on the same screen after the administrator confirms that the environment belongs to the client engagement whose contract with iorta TechNXT covers its marks; nothing is enabled by default. |
| Broker billed | The client pays the premium to the broker, who remits it to the insurer net of commission. |
| Broker slip | The request for quotation that presents a risk to several insurers. |
| Brokerage | The commission the insurer pays the broker. |
| Co-insurance | Several insurers share one risk, each for a percentage, under one lead insurer. |
| Comsub | The share of the brokerage paid by the broker to an agent or referrer. |
| COC | Certificate of cover: the CTPL certificate authenticated with the IC-accredited provider before it is released. |
| Cover note | Temporary evidence of cover given by the broker while the insurer issues the policy. |
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
| LOA | Letter of authority: the broker's letter to the repair shop with the approved repair cost, the insurer's share and the insured's participation. |
| Maker-checker | The maker enters a transaction; a different user approves it. |
| Net premium | The premium before taxes. |
| OR | Official receipt: the BIR-registered receipt issued for money received. |
| PDC | Post-dated cheque: a client's cheque received before its date, deposited and receipted on that date. |
| PEP | Politically exposed person: a client, owner or signatory who holds a prominent public position. |
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
