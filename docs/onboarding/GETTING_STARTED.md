# Getting started with BrokerVerse for TISPH

Version 1.2, 11 October 2026, iorta TechNXT. Changes: the TISPH roles replace the generic broker roles; the modules
removed from the TISPH build (reinsurance, compliance and AML, complaints, data privacy registers) are no longer
described; two-step verification set-up by QR code.

This guide is for everyone at Toyota Insurance Services Philippines (TISPH) who uses BrokerVerse day to day. It
explains how to sign in the first time, what you see after signing in, which roles exist and how to ask for help. The
TISPH user manual describes every screen and, in one chapter per role, the exact menus, access, approvals and
segregation of duties of each role. It opens from the Help panel (F1) and is also available as Word and PDF
(`TISPH_User_Manual.docx`, `.pdf`, downloaded from the Help panel once regenerated after the build; source `docs/TISPH/manual/`). The other TISPH
documents are indexed in [`docs/TISPH/README.md`](../TISPH/README.md).

## 1. Signing in the first time

TISPH IT AppSupport creates your user and gives you three things privately: the BrokerVerse web address, your
username and a temporary password. Nobody else should see the temporary password, and nobody from support will ever
ask you for your password.

1. Open the BrokerVerse web address in Chrome, Edge or Firefox.
2. Enter your username and the temporary password, then select **Sign in**.
3. BrokerVerse asks you to choose a new password straight away. You cannot use any screen until you do.
4. If your role must use two-step verification, BrokerVerse then asks you to set it up (see below).

### Password rules

The rules come from the security settings (Master > Configuration > Security). With the settings delivered with the
system, a password must:

- have at least 8 characters;
- contain an upper case letter, a lower case letter, a digit and a symbol (for example `#`, `!`, `@`);
- differ from your last 5 passwords.

A password expires after 90 days. When it has expired, BrokerVerse asks you to choose a new one at sign-in.

After 5 wrong passwords in a row your user is locked. Ask TISPH IT AppSupport to unlock it or to reset your
password. You are signed out after 30 minutes without activity.

### Forgotten password

Select **Forgot password?** on the sign-in page and enter your username. BrokerVerse e-mails a verification code to
the address on your user. Enter the code and choose a new password. The code is valid for 15 minutes.

### Two-step verification

TISPH IT AppSupport decides which roles must use two-step verification (setting `security.require_2fa_roles`;
it is recommended for TIS IT AppSupport / Admin, Finance and CCD-Recon). Anyone can also turn it on for themselves from the
profile menu.

1. Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or similar).
2. When BrokerVerse shows the set-up screen, scan the QR code with the app (or add the account by typing in the key
   shown on the screen).
3. Enter the 6-digit code the app shows to confirm.
4. From then on, BrokerVerse asks for the current code from the app after your password at every sign-in.

If you lose your phone, ask TISPH IT AppSupport to turn two-step verification off for your user. You then set
it up again at the next sign-in.

## 2. The home screen and the menu

After signing in you land on the first screen your role may open. The menu on the left lists only the screens your
role may use, in business order (My Work, Dashboard, Operations, Accounts, Commission, Reports, Master, Product
Configurator). Master lists its screens under headings (for example Organization, Insurance, Location, Employees,
Users and Access, Finance, System). Type part of a screen name in **Search menu...**
(or press **/**) to jump to it. Your initials at the top right open the account menu (Profile, Change password,
Two-step verification, Help, Sign out). The bell shows notifications, for example a payment waiting for verification,
a task reminder or a claim document received.

**My Work** is where you find what is waiting for you: your open items by category (quotations,
renewals, premiums due, claims, approvals, missing documents), your team's items if you manage people, your tasks with
reminders, and a calendar of what falls due. Start your day there.

The roles below are those delivered for TISPH (migration `0348_tisph_roles.sql`, seed `82_tisph_roles.sql`). A user
may hold more than one role and then sees the menus of all of them. The server checks the same permissions on every
action, so a button you cannot use is either hidden or refused with a message. The exact menus of each role are in
its chapter of the user manual.

| Role | What it does |
|---|---|
| TIS Sales Associate | Leads, clients, quotations, placements, policies, endorsements and renewals (maker, no approval); reads claims, billing, receipting and commission |
| TIS Sales Officer | As the Sales Associate, plus lead allocation, campaigns and approving the quotations, placement checks and renewals of another user |
| TIS Sales Unit Head | As the Sales Officer, plus telesales incentives and approving supplier invoices; reads disbursements and payables |
| TIS Operations Associate | Placements, policies, endorsements, renewals and claims (maker, no approval); reads leads, clients and billing |
| TIS Operations Officer | As the Operations Associate, plus reading journal vouchers and fixed assets |
| TIS Operations Unit Head | As the Operations Officer, plus approving the quotations, placement checks, renewals, claim decisions and supplier invoices of another user |
| CCD-PDU (Post-Dated Cheques) | Post-dated cheque encoding, acknowledgement, deposit and cancellation (Cash Control) |
| CCD-PDC / CCD-ADA | Post-dated cheques and auto-debit arrangements; reads billing, receipting and reconciliations (Cash Control) |
| CCD-BP / QRPh (Receipting) | Official and acknowledgement receipts over the counter, bills payment and QRPh, posting of collections; no reversals (Cash Control) |
| CCD-Recon (Reconciliation and Reversals) | Daily payment reconciliation, reversals and adjustments, bank and insurer statement reconciliation (Cash Control) |
| TIS Finance & General Accounting | Disbursements, journal vouchers, payables, fixed assets, commission and remittance, period end, bank reconciliation and posting rule approvals; reads the front office |
| TIS IT AppSupport / Admin | Users, roles, access control, settings, reference masters, product configurator, schedules and interfaces; reads business data, enters no business transactions |
| TIS General Manager | Front office (leads to claims) with every front-office approval and supplier invoices; reads accounting, administration and the audit trail |
| TIS Audit (read only) | Reads the Data Migration & Go-Live workspace and the audit trail; changes nothing |
| SUPERID (UAT only) | User acceptance testing only; includes the System Administrator. Set Inactive before go-live |

**Personal identifiers.** If your role does not hold the permission to view full personal identifiers, TIN, ID numbers,
mobile numbers, e-mail addresses, bank account numbers and birth dates show partly masked on lists, screens and
exports (for example j***@example.ph). This is intended; ask TISPH IT AppSupport if your work needs the full value.

## 3. Everyday tips

- Lists have a search box and filters at the top; select a row or the view icon to open the record.
- Screens with an **Upload** button take a spreadsheet. Use **Download template** in the upload window: it gives the
  exact columns, a sample row to delete and instructions. The templates are also in `docs/package/05_Delivery/Upload_Templates`.
- Dates are shown as DD/MM/YYYY and amounts in Philippine pesos unless the record is in another currency.
- Printed documents (policy schedule, billing statement, official receipt, payment voucher) carry the letterhead of
  the company set as primary in Master > Generals > Organization > Company.

## 4. Getting help

Press **F1** (or **?** outside a text box), or choose **Help** in the account menu: the Help panel opens the section of
the user manual for the screen you are on, the full manual as PDF, the support desk's e-mail, telephone and hours,
**Raise a support ticket**, the keyboard shortcuts and **About BrokerVerse** (version and environment, useful in a
report).

First ask the colleague in your team who was trained as the key user. If the problem remains, report it to support
(see `SUPPORT_AND_ESCALATION.md` for the contact and response targets). Please send:

1. **The screen**: the menu path, for example Accounts > Receipts > Add receipt, and the record number (policy,
   quotation, receipt or voucher number).
2. **The time** it happened, to the minute.
3. **The request ID** when the error message shows one. Error messages from the server end with "quote the request id
   when reporting it" followed by the ID; copy it exactly.
4. **What you did and what you expected**, in one or two sentences, and a screenshot if you can.
5. **How urgent it is**: can you or your team still work?

Do not send passwords, two-step codes or full client ID numbers by e-mail or chat.
