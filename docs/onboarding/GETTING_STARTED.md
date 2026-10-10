# Getting started with BrokerVerse

Version 1.1, 04 October 2026, iorta TechNXT. Changes: the Compliance Officer role, My Work, the Help panel, the
enterprise side menu and the masking of personal identifiers.

This guide is for everyone who uses BrokerVerse day to day. It explains how to sign in the first time, what you see
after signing in, which menus your role opens and how to ask for help. The user manual
(`docs/package/05_Delivery/BrokerVerse_User_Manual.pdf`) describes every screen in detail.

For TISPH: the menus per role below are those of the generic roles (including the Compliance Officer). The TISPH
personas are listed in `docs/TISPH/pack/TISPH_Delivery_Governance.docx` (index: [`docs/TISPH/README.md`](../TISPH/README.md));
the TISPH edition of this guide and of the manual follows with work packages MAN-A and MAN-B.

## 1. Signing in the first time

Your System Administrator creates your user and gives you three things privately: the BrokerVerse web address, your
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

After 5 wrong passwords in a row your user is locked. Ask your System Administrator to unlock it or to reset your
password. You are signed out after 30 minutes without activity.

### Forgotten password

Select **Forgot password?** on the sign-in page and enter your username. BrokerVerse e-mails a verification code to
the address on your user. Enter the code and choose a new password. The code is valid for 15 minutes.

### Two-step verification

Your System Administrator decides which roles must use two-step verification (setting `security.require_2fa_roles`;
it is recommended for System Administrators and Accounting). Anyone can also turn it on for themselves from the
profile menu.

1. Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or similar).
2. When BrokerVerse shows the set-up screen, add a new account in the app and type in the key shown on the screen, or
   open the link on your phone.
3. Enter the 6-digit code the app shows to confirm.
4. From then on, BrokerVerse asks for the current code from the app after your password at every sign-in.

If you lose your phone, ask your System Administrator to turn two-step verification off for your user. You then set
it up again at the next sign-in.

## 2. The home screen and the menu

After signing in you land on the first dashboard your role may open. The menu on the left lists only the screens your
role may use, in business order (Home, Dashboard, Operations, Accounts, Commission, Reinsurance, Compliance, Reports,
Master, Product Configurator). Master lists its screens under headings (Organization, Insurance, Location, Employees,
Users and Access, Finance, System, Data Privacy, Go-Live and Data). Type part of a screen name in **Search menu...**
(or press **/**) to jump to it. Your initials at the top right open the account menu (Profile, Change password,
Two-step verification, Help, Sign out). The bell shows notifications, for example a payment waiting for verification,
a task reminder or a claim document received.

**My Work** (Operations > My Work) is where you find what is waiting for you: your open items by category (quotations,
renewals, premiums due, claims, approvals, missing documents), your team's items if you manage people, your tasks with
reminders, and a calendar of what falls due. Start your day there.

The menus below are those granted to each role in BrokerVerse. A user may hold more than one role and then sees the
menus of all of them. The server checks the same permissions on every action, so a button you cannot use is either
hidden or refused with a message.

| Role | Menus |
|---|---|
| System Administrator (Super Admin) | Every menu, including Master (Configuration, E-mail Layout, Documents and Reports Layout, Document Numbering, Schedules, Audit Trail, all masters, User Management) |
| Sales & Marketing (Account Executive) | Dashboard: Executive Dashboard, Sales Dashboard. Product Configurator: Dashboard, Product Templates. Operations: Home, Leads/Prospects, Clients, Quotation, Broker Slips, Placement Slips, Policy, Claims, Renewals, Open Items, Payments. Commission: Commission Dashboard. Reports: All Reports, Operational Reports |
| Processing Team (Placement & Policy Processing) | Dashboard: Processing Dashboard, Executive Dashboard. Product Configurator: all items (Dashboard, Product Templates, Coverage Builder, Rating Engine, Acceptance Rules, Document Manager, Market Mapping, Risk Mapping, Product Analytics). Operations: all items as for Sales & Marketing. Reinsurance: Treaty Dashboard, Cession Tracking, Claims Recovery, Reconciliation, Analytics. Reports: All Reports, Operational Reports |
| Operations (Client Servicing) | Dashboard: Executive Dashboard. Product Configurator: Dashboard, Product Templates. Operations: all items as for Sales & Marketing. Reports: All Reports, Operational Reports |
| Claims | Dashboard: Claims Dashboard. Operations: Home, Clients, Policy, Claims. Reinsurance: Claims Recovery. Reports: All Reports, Operational Reports |
| Accounting | Dashboard: Executive Dashboard. Operations: Open Items, Payments. Accounts: Receipts, Collections, Accounting Query, All Clients Accounting, Open Entry Matching, Open Entry Un-Matching, Disbursement, Petty Cash, Journal Voucher, Correction JV, Reversal JV, Remittance, Incentive, Period End, Tax, Bank Reconciliation. Master: Finance > Taxation, Close Checklist, Bank Statement Formats, Bank Transaction Types. Commission: Commission Dashboard, Agents/Referrer Accounts. Reinsurance: Reconciliation. Reports: All Reports, Financial Reports, Operational Reports > Remittance and Broker Commission |
| Accounting Manager | Everything Accounting has, plus the approvals: month-end and year-end close, reopening a period, posting into a soft-closed period, bank reconciliation approval |
| Compliance Officer (AML/CFT) | Home. Operations: Clients (with Onboard client), Policy, Claims (read). Compliance: AML Dashboard, Client Due Diligence, EDD Reviews, KYC Refresh, Screening Hits, Screening Lists, Transaction Alerts, AML Cases, AMLC Reports, AML Settings. Reports: All Reports, Operational Reports |

What each role mainly does:

- **Sales & Marketing** records prospects and leads, requests quotations, follows up renewals and sees its own
  production.
- **Processing Team** prepares broker slips and placement slips, compares insurer offers, issues and checks policies,
  processes endorsements and maintains product templates.
- **Operations** services clients: endorsement requests, renewals, open items, documents.
- **Claims** registers claims, collects documents, follows up insurers and records settlements.
- **Accounting** bills and collects premium, issues official receipts, remits to insurers, pays commission and
  incentives, reconciles banks and prepares the month-end and year-end close and BIR reports.
- **Accounting Manager** approves what Accounting prepares.
- **Compliance Officer** runs the anti-money laundering programme: client risk ratings and enhanced due diligence,
  screening hits, transaction alerts, cases and the report files filed with the AMLC.

The registers of the Insurance Commission and the National Privacy Commission (licences, fit and proper, insurer
authority, complaints, breach register) are under Compliance for the roles that hold the compliance, complaints or
privacy permissions. Your System Administrator can tell you which you hold.

**Personal identifiers.** If your role does not hold the permission to view full personal identifiers, TIN, ID numbers,
mobile numbers, e-mail addresses, bank account numbers and birth dates show partly masked on lists, screens and
exports (for example j***@example.ph). This is intended; ask your System Administrator if your work needs the full value.

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
