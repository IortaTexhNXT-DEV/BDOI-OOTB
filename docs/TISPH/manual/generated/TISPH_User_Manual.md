# Toyota Insurance Services Philippines – User Manual

## Document Control

| Item | Value |
|---|---|
| Document | Toyota Insurance Services Philippines – User Manual |
| Version | 1.0 |
| Date | 10 October 2026 |
| Status | Draft |
| Classification | Internal |
| Author | iorta TechNXT |
| Owner | Toyota Insurance Services Philippines |

**Change log**

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 10 October 2026 | iorta TechNXT | First TISPH edition: TISPH roles, process and screens (Draft for TISPH review) |

**Approval**

| Role | Name | Date | Signature |
|---|---|---|---|
| TISPH Project Manager |  |  | |
| TISPH Head of IT |  |  | |

## About this manual
### Purpose
This manual tells the staff of Toyota Insurance Services Philippines how to do their work in the system: Sales,
Operations, Cash Control, Finance and General Accounting, IT AppSupport and the General Manager. It covers the work
from the first contact with a client (a TFS referral, a dealer lead, a walk-in client or a renewal) to the quotation,
the placement with the panel insurers, the policy, the collection, the remittance to the insurer, the commission, the
claims, the renewals and the month-end close.

### How the manual is organised
| Chapter | Content |
|---|---|
| Getting started | Signing in with your Microsoft 365 account, the screen layout, My Work, lists, forms, approvals and maker-checker, the audit trail and the Help panel. |
| The TISPH process end to end | Each step of the work, from the lead to the month-end close, with the roles that do it and the screen where it is done. |
| One chapter per role | The thirteen roles of TISPH by department: Sales, Operations, Cash Control, Finance and Accounting, IT and Management. Each chapter lists the menus of the role, what it can view, change and approve, who approves its work, its segregation-of-duties rules, its tasks and its procedures. |
| Screen reference | Every screen of the TISPH menus, in menu order, with the roles that open it. |
| Reports | The report menus and the Report Builder. |
| Glossary | The insurance, accounting and system terms used on the screens. |

Read Getting started and The TISPH process end to end first, then the chapter of your role. In the system, open
Help (F1) on any screen: **Open this section** opens the section of that screen, and **Open my role chapter** opens the
chapter of your role.

The menus, access levels, approvals and segregation-of-duties rules in the role chapters are produced from the
delivered configuration of the system. They describe the roles as delivered. The access in force for a person is on
Master > Users and Access > User Access Matrix.

### Conventions
| Convention | Meaning |
|---|---|
| Operations > Sales & Marketing > Prospects | A menu path: open each item in the side bar in turn. |
| **Create Prospect** | A button, tab, field or status, written exactly as it appears on the screen. |
| PHP 1,250,000.00 | Amounts in Philippine pesos. The screens show the peso sign, for example ₱1,250,000.00. |
| 03/10/2026 | The screens show dates as DD/MM/YYYY, in Manila time. |
| Maker and checker | The maker enters a record; a different user, the checker, approves it. |

> The screenshots show fictional sample data of a test system: clients, vehicles, policies and amounts are not real.
> Your screens show your own data, and your menu shows only the screens of your role.

## Getting started
### Signing in
Every person has his or her own account. Never share an account: every action is recorded against the user in the
audit trail.

1. Open the address of the system given by IT AppSupport in Chrome or Edge.
2. Choose **Sign in with Microsoft**.
3. Sign in with your Microsoft 365 account of Toyota Insurance Services Philippines, and complete the verification
   that Microsoft asks for.
4. The system opens My Work.

**Sign in with a user ID and password** is for the accounts that IT AppSupport creates without a Microsoft 365
account.

> In preparation. Password rules, two-step verification, forgotten password and locked accounts, as configured for TISPH.
### The screen layout
> In preparation. The header (logo, menu search, notifications, profile menu), the side bar with the menus of your role, the page title and actions, and how to return to My Work.
### My Work
**Menu:** My Work

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| CCD-PDU (Post-Dated Cheques) | View |
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The first screen after sign-in: the figures in the header, the work items of your role, follow-up tasks and how to open a record from them.
### My Profile
> In preparation. Your name, roles, e-mail and the account security settings of My Profile (profile menu > My Profile).
### Notifications
> In preparation. The bell in the header, the notifications list and what each kind of notification asks you to do.
### Working with lists
> In preparation. Search, filters, status cards and tabs, sorting, paging, row actions and export.
### Working with forms
> In preparation. Required fields, look-up lists, error messages, saving and cancelling, the record number given on save, uploads and templates.
### Approvals and maker-checker
The user who enters a record never approves it: a different user, holding the approval of that record, approves it.
The system refuses the approval of your own record and tells the users who may approve. Your role chapter lists
what your role approves and who approves your work.

| Record | Approved by |
|---|---|
| Quotation | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head and TIS General Manager |
| Check of a placement against the slip | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head and TIS General Manager |
| Renewal terms | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head and TIS General Manager |
| Claim decisions and settlement | TIS Operations Unit Head and TIS General Manager |
| Supplier invoice | TIS Sales Unit Head, TIS Operations Unit Head, TIS Finance & General Accounting and TIS General Manager |
| Bank reconciliation | TIS Finance & General Accounting |
| Insurer statement reconciliation | CCD-Recon (Reconciliation and Reversals) |
| Month-end and year-end close | TIS Finance & General Accounting |
| Posting rules and account determination | TIS Finance & General Accounting |
| Role access changes and authority limits | TIS IT AppSupport / Admin |

On top of maker-checker, the Authority Matrix (Master > Users and Access) sets the largest amount each role may
approve per transaction, and the Segregation of Duties rules warn or block when one person is given roles that should
stay apart.

> In preparation. The statuses of a record and where the approval is made on each screen (approval buttons, My Work items).
### Where the audit trail is
The system records every creation, change, approval and sign-in with the user, the time and the values before and
after.

| Where | Who |
|---|---|
| Master > System > Audit Trail | The roles listed in Audit Trail of the screen reference |
| The **Audit Trail** or **History** tab of a record | Users who may open the record |

> In preparation. How to search the audit trail and read an entry.
### The Help panel
Press F1, or **?** outside a text field, or choose Help in the profile menu. The panel shows the section of this manual
for the screen you are on (**Open this section**), the chapter of your role (**Open my role chapter**), the manual as
PDF and Word, the support contacts and the keyboard shortcuts.

## The TISPH process end to end
The work of Toyota Insurance Services Philippines follows one chain: a lead becomes a quotation, the quotation is
placed with a panel insurer, the insurer's policy is booked and billed, Cash Control collects the premium, the premium
is remitted to the insurer, the commission is earned and paid, claims are followed up with the insurer, the policy is
renewed, and Finance closes the month and files the BIR returns. Each section below names the roles that do the
step, as delivered, and the screens where it is done.

### Leads from TFS, dealers and walk-in clients
Prospects are entered by TIS Sales Associate, TIS Sales Officer, TIS Sales Unit Head and TIS General Manager, on Prospects. Leads are assigned to the sales team on
Lead Assignment by TIS Sales Officer, TIS Sales Unit Head and TIS General Manager.

> In preparation. The sources of TISPH leads (Toyota Financial Services referrals, dealers, walk-in clients, renewals), the lead source and product tagging, and the follow-up of a lead.
### Quotation and request for quotation
Quotations and requests for quotation to the panel insurers are prepared by TIS Sales Associate, TIS Sales Officer, TIS Sales Unit Head, TIS Operations Associate, TIS Operations Officer, TIS Operations Unit Head and TIS General Manager. A quotation is
approved by another user: TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head and TIS General Manager.

> In preparation. Quick Quote for package products, the request for quotation to the insurers for the other risks, the comparison of offers, the client's acceptance.
### Placement with the insurer
The placement slip goes to the insurer, which returns the e-policy. The check of the e-policy against the slip is
decided by TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head and TIS General Manager, never by the user who recorded the e-policy. See
Placement Slips.

> In preparation. Sending the placement slip, the insurer's acknowledgement, recording the e-policy, differences and returns.
### Policy, billing and endorsements
Policies, cover notes and CTPL certificates are recorded by TIS Sales Associate, TIS Sales Officer, TIS Sales Unit Head, TIS Operations Associate, TIS Operations Officer, TIS Operations Unit Head and TIS General Manager; endorsements and cancellations by
TIS Sales Associate, TIS Sales Officer, TIS Sales Unit Head, TIS Operations Associate, TIS Operations Officer, TIS Operations Unit Head and TIS General Manager. See Policies.

> In preparation. Booking the policy, the billing statement to the client, endorsements and cancellations with return premium.
### Collection by Cash Control
Receipts are issued and collections posted by CCD-PDU (Post-Dated Cheques), CCD-PDC / CCD-ADA, CCD-BP / QRPh (Receipting) and CCD-Recon (Reconciliation and Reversals). Post-dated cheques are handled on
Post-Dated Cheques. See Receipts.

> In preparation. Over-the-counter payments, bills payment and QRPh, post-dated cheques and auto-debit arrangements, the daily payment reconciliation, reversals.
### Remittance to the insurers
Remittances to the insurers are prepared by CCD-Recon (Reconciliation and Reversals) and TIS Finance & General Accounting. See
Remittance to insurers.

> In preparation. Remittance runs, approval within the Authority Matrix limits, payment to the insurer, insurer statements and their reconciliation.
### Commission and incentives
Commission is processed by TIS Finance & General Accounting; incentive calculations by TIS Sales Unit Head and approved by
TIS Sales Unit Head. See Commission to agents and referrers and
Incentives.

> In preparation. Commission earned from the insurers, commission to referrers, the telesales incentive.
### Claims
Claims are registered and followed up by TIS Operations Associate, TIS Operations Officer, TIS Operations Unit Head and TIS General Manager. Claim decisions and settlement approvals are made by
TIS Operations Unit Head and TIS General Manager. See Claims.

> In preparation. Registering a claim, claim documents, motor claim repairs and letters of authority, settlement through the insurer.
### Renewals
Renewals are prepared by TIS Sales Associate, TIS Sales Officer, TIS Sales Unit Head, TIS Operations Associate, TIS Operations Officer, TIS Operations Unit Head and TIS General Manager; renewal terms are approved by TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head and TIS General Manager. See
Renewal Queue.

> In preparation. The renewal queue, renewal terms, negotiations, lapsed policies.
### Month-end and tax
The month-end and year-end steps and the BIR returns are run by TIS Finance & General Accounting; the close is approved by
TIS Finance & General Accounting. See Period end and Tax: BIR forms and returns.

> In preparation. The month-end checklist, bank reconciliation, the SAP GL export, the close and its approval, the BIR returns.
## TIS Sales Associate
### Role summary
**Department:** Sales. Leads, clients, quotations, placements, policies, endorsements and renewals; no approvals.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Dashboard | Sales Dashboard | View |
| Operations > Sales & Marketing | Prospects | Create and edit |
| Operations > Sales & Marketing | Quick Quote | Create and edit |
| Operations > Sales & Marketing | Requests for Quotation | Create and edit |
| Operations > Sales & Marketing | Quotations | Create and edit |
| Operations > Sales & Marketing | Placement Slips | Create and edit |
| Operations > Sales & Marketing | Lead Assignment | Create and edit |
| Operations > Sales & Marketing | Dealer Programmes | View |
| Operations > Sales & Marketing | Comparison Reports | Create and edit |
| Operations > Sales & Marketing | Campaigns | View |
| Operations > Sales & Marketing | Sales Activities | Create and edit |
| Operations | Clients | Create and edit |
| Operations | Policy | Create and edit |
| Operations | Fleet Schedules | Create and edit |
| Operations | Marine Open Covers | Create and edit |
| Operations | Claims | View |
| Operations > Renewals | Renewal Policy | Create and edit |
| Operations > Renewals | Renewal Batch | Create and edit |
| Operations > Renewals | Renewal Queue | Create and edit |
| Operations > Renewals | Retention Analytics | Create and edit |
| Operations > Renewals | At-Risk Policies | Create and edit |
| Operations > Renewals | Negotiations | Create and edit |
| Operations > Renewals | Lapse Management | Create and edit |
| Operations > Renewals | Performance | Create and edit |
| Operations | Payments | Create and edit |
| Operations | CTPL Authentication | Create and edit |
| Operations | Cover Notes | Create and edit |
| Operations | Policy Cancellation | Create and edit |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Accounts > Incentive | My Programs | View |
| Accounts > Incentive | Statement | View |
| Commission | Commission Dashboard | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | View |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports | Report Builder | View |
| Master > Insurance | Distribution Channels | View |
| Product Configurator | Dashboard | View |
| Product Configurator | Product Templates | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Prospects and leads | Create and edit | Create and edit prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Quotations and placement | Create and edit | Create quotations (Quick Quote too), send requests for quotation, prepare placement slips |
| Sales & Marketing | Lead assignment | View | See assignment rules, the reassignment queue and every team's prospects |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Marketing campaigns | View | See campaigns, segments, templates and results |
| Sales & Marketing | Sales activities | View | See activity timelines and the activity report |
| Sales & Marketing | Sales activities | Create and edit | Log, change and cancel calls, meetings, e-mails and visits |
| Operations | Clients | View | See clients |
| Operations | Clients | Create and edit | Create and edit clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Policies | Create and edit | Record and issue policies, cover notes and CTPL certificates |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Endorsements and cancellations | Create and edit | Request and process endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Renewals | Create and edit | Prepare renewals and renewal terms |
| Operations | Claims | View | See claims |
| Operations | Fleet schedules | View | See fleet schedules and print the schedule of vehicles |
| Operations | Fleet schedules | Create and edit | Prepare and issue fleet schedules; add or delete vehicles by endorsement |
| Operations | Marine open covers | View | See open covers, certificates and declarations; print certificates |
| Operations | Marine open covers | Create and edit | Set up open covers, issue certificates, submit and bill declarations |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves nothing.

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Policies | Decide the check of a placement against the slip (not the user who recorded the policy) | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotations and placement | Approve a quotation created by another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Renewals | Approve or return renewal terms of another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotation > Underwriting referral (the authority role of the acceptance rule) | Underwriting referral approval within the approver's limit | TIS Operations Unit Head |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS Sales Officer
### Role summary
**Department:** Sales. As the Sales Associate, plus lead allocation, campaigns and approving the work of others.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Dashboard | Sales Dashboard | View |
| Operations > Sales & Marketing | Prospects | Create and edit |
| Operations > Sales & Marketing | Quick Quote | Approve |
| Operations > Sales & Marketing | Requests for Quotation | Approve |
| Operations > Sales & Marketing | Quotations | Approve |
| Operations > Sales & Marketing | Placement Slips | Approve |
| Operations > Sales & Marketing | Lead Assignment | Create and edit |
| Operations > Sales & Marketing | Dealer Programmes | View |
| Operations > Sales & Marketing | Comparison Reports | Approve |
| Operations > Sales & Marketing | Campaigns | Create and edit |
| Operations > Sales & Marketing | Sales Activities | Create and edit |
| Operations | Clients | Create and edit |
| Operations | Policy | Approve |
| Operations | Fleet Schedules | Create and edit |
| Operations | Marine Open Covers | Create and edit |
| Operations | Claims | View |
| Operations > Renewals | Renewal Policy | Approve |
| Operations > Renewals | Renewal Batch | Approve |
| Operations > Renewals | Renewal Queue | Approve |
| Operations > Renewals | Retention Analytics | Approve |
| Operations > Renewals | At-Risk Policies | Approve |
| Operations > Renewals | Negotiations | Approve |
| Operations > Renewals | Lapse Management | Approve |
| Operations > Renewals | Performance | Approve |
| Operations | Payments | Approve |
| Operations | CTPL Authentication | Approve |
| Operations | Cover Notes | Approve |
| Operations | Policy Cancellation | Create and edit |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Accounts > Incentive | My Programs | View |
| Accounts > Incentive | Statement | View |
| Commission | Commission Dashboard | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | View |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports | Report Builder | View |
| Master > Insurance | Distribution Channels | View |
| Product Configurator | Dashboard | View |
| Product Configurator | Product Templates | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Prospects and leads | Create and edit | Create and edit prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Quotations and placement | Create and edit | Create quotations (Quick Quote too), send requests for quotation, prepare placement slips |
| Sales & Marketing | Quotations and placement | Approve | Approve a quotation created by another user |
| Sales & Marketing | Lead assignment | View | See assignment rules, the reassignment queue and every team's prospects |
| Sales & Marketing | Lead assignment | Create and edit | Maintain assignment rules and reassign prospects |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Marketing campaigns | View | See campaigns, segments, templates and results |
| Sales & Marketing | Marketing campaigns | Create and edit | Prepare and send campaigns; maintain segments and templates |
| Sales & Marketing | Sales activities | View | See activity timelines and the activity report |
| Sales & Marketing | Sales activities | Create and edit | Log, change and cancel calls, meetings, e-mails and visits |
| Operations | Clients | View | See clients |
| Operations | Clients | Create and edit | Create and edit clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Policies | Create and edit | Record and issue policies, cover notes and CTPL certificates |
| Operations | Policies | Approve | Decide the check of a placement against the slip (not the user who recorded the policy) |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Endorsements and cancellations | Create and edit | Request and process endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Renewals | Create and edit | Prepare renewals and renewal terms |
| Operations | Renewals | Approve | Approve or return renewal terms of another user |
| Operations | Claims | View | See claims |
| Operations | Fleet schedules | View | See fleet schedules and print the schedule of vehicles |
| Operations | Fleet schedules | Create and edit | Prepare and issue fleet schedules; add or delete vehicles by endorsement |
| Operations | Marine open covers | View | See open covers, certificates and declarations; print certificates |
| Operations | Marine open covers | Create and edit | Set up open covers, issue certificates, submit and bill declarations |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves the work of other users:

- Decide the check of a placement against the slip (not the user who recorded the policy)
- Approve a quotation created by another user
- Approve or return renewal terms of another user

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Policies | Decide the check of a placement against the slip (not the user who recorded the policy) | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotations and placement | Approve a quotation created by another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Renewals | Approve or return renewal terms of another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotation > Underwriting referral (the authority role of the acceptance rule) | Underwriting referral approval within the approver's limit | TIS Operations Unit Head |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS Sales Unit Head
### Role summary
**Department:** Sales. As the Sales Officer, plus telesales incentives and supplier invoice approval.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Dashboard | Sales Dashboard | View |
| Operations > Sales & Marketing | Prospects | Create and edit |
| Operations > Sales & Marketing | Quick Quote | Approve |
| Operations > Sales & Marketing | Requests for Quotation | Approve |
| Operations > Sales & Marketing | Quotations | Approve |
| Operations > Sales & Marketing | Placement Slips | Approve |
| Operations > Sales & Marketing | Lead Assignment | Create and edit |
| Operations > Sales & Marketing | Dealer Programmes | View |
| Operations > Sales & Marketing | Comparison Reports | Approve |
| Operations > Sales & Marketing | Campaigns | Create and edit |
| Operations > Sales & Marketing | Sales Activities | Create and edit |
| Operations | Clients | Create and edit |
| Operations | Policy | Approve |
| Operations | Fleet Schedules | Create and edit |
| Operations | Marine Open Covers | Create and edit |
| Operations | Claims | View |
| Operations > Renewals | Renewal Policy | Approve |
| Operations > Renewals | Renewal Batch | Approve |
| Operations > Renewals | Renewal Queue | Approve |
| Operations > Renewals | Retention Analytics | Approve |
| Operations > Renewals | At-Risk Policies | Approve |
| Operations > Renewals | Negotiations | Approve |
| Operations > Renewals | Lapse Management | Approve |
| Operations > Renewals | Performance | Approve |
| Operations | Payments | Approve |
| Operations | CTPL Authentication | Approve |
| Operations | Cover Notes | Approve |
| Operations | Policy Cancellation | Create and edit |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Accounts > Payables | Supplier Invoices | Approve |
| Accounts > Payables | Supplier Payments | Approve |
| Accounts > Payables | AP Ageing | Approve |
| Accounts > Payables | Suppliers | Approve |
| Accounts > Payables | Supplier 2307 | Approve |
| Accounts | Disbursement | View |
| Accounts > Incentive | My Programs | Approve |
| Accounts > Incentive | Calculations | Approve |
| Accounts > Incentive | Approvals | Approve |
| Accounts > Incentive | Statement | Approve |
| Accounts > Incentive | Reports | Approve |
| Commission | Commission Dashboard | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | View |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports | Report Builder | View |
| Master > Insurance | Distribution Channels | View |
| Product Configurator | Dashboard | View |
| Product Configurator | Product Templates | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Prospects and leads | Create and edit | Create and edit prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Quotations and placement | Create and edit | Create quotations (Quick Quote too), send requests for quotation, prepare placement slips |
| Sales & Marketing | Quotations and placement | Approve | Approve a quotation created by another user |
| Sales & Marketing | Lead assignment | View | See assignment rules, the reassignment queue and every team's prospects |
| Sales & Marketing | Lead assignment | Create and edit | Maintain assignment rules and reassign prospects |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Marketing campaigns | View | See campaigns, segments, templates and results |
| Sales & Marketing | Marketing campaigns | Create and edit | Prepare and send campaigns; maintain segments and templates |
| Sales & Marketing | Sales activities | View | See activity timelines and the activity report |
| Sales & Marketing | Sales activities | Create and edit | Log, change and cancel calls, meetings, e-mails and visits |
| Operations | Clients | View | See clients |
| Operations | Clients | Create and edit | Create and edit clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Policies | Create and edit | Record and issue policies, cover notes and CTPL certificates |
| Operations | Policies | Approve | Decide the check of a placement against the slip (not the user who recorded the policy) |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Endorsements and cancellations | Create and edit | Request and process endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Renewals | Create and edit | Prepare renewals and renewal terms |
| Operations | Renewals | Approve | Approve or return renewal terms of another user |
| Operations | Claims | View | See claims |
| Operations | Fleet schedules | View | See fleet schedules and print the schedule of vehicles |
| Operations | Fleet schedules | Create and edit | Prepare and issue fleet schedules; add or delete vehicles by endorsement |
| Operations | Marine open covers | View | See open covers, certificates and declarations; print certificates |
| Operations | Marine open covers | Create and edit | Set up open covers, issue certificates, submit and bill declarations |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Disbursements and petty cash | View | See payment vouchers, petty cash and bank payment files |
| Accounts | Payables | View | See suppliers, supplier invoices and payments, AP ageing |
| Accounts | Payables | Approve | Approve supplier invoices (not the preparer) |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Accounts | Incentives | Create and edit | Calculate, submit and pay incentives |
| Accounts | Incentives | Approve | Approve or reject an incentive calculation batch submitted by another user |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves the work of other users:

- Approve or reject an incentive calculation batch submitted by another user
- Approve supplier invoices (not the preparer)
- Decide the check of a placement against the slip (not the user who recorded the policy)
- Approve a quotation created by another user
- Approve or return renewal terms of another user

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Incentives | Approve or reject an incentive calculation batch submitted by another user | TIS Sales Unit Head |
| Policies | Decide the check of a placement against the slip (not the user who recorded the policy) | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotations and placement | Approve a quotation created by another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Renewals | Approve or return renewal terms of another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotation > Underwriting referral (the authority role of the acceptance rule) | Underwriting referral approval within the approver's limit | TIS Operations Unit Head |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS Operations Associate
### Role summary
**Department:** Operations. Placements, policies, endorsements, renewals and claims; no approvals.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Dashboard | Claims Dashboard | View |
| Dashboard | Processing Dashboard | View |
| Operations > Sales & Marketing | Prospects | View |
| Operations > Sales & Marketing | Quick Quote | Create and edit |
| Operations > Sales & Marketing | Requests for Quotation | Create and edit |
| Operations > Sales & Marketing | Quotations | Create and edit |
| Operations > Sales & Marketing | Placement Slips | Create and edit |
| Operations > Sales & Marketing | Lead Assignment | View |
| Operations > Sales & Marketing | Dealer Programmes | View |
| Operations > Sales & Marketing | Comparison Reports | Create and edit |
| Operations > Sales & Marketing | Sales Activities | View |
| Operations | Clients | View |
| Operations | Policy | Create and edit |
| Operations | Fleet Schedules | Create and edit |
| Operations | Marine Open Covers | Create and edit |
| Operations | Claims | Create and edit |
| Operations > Renewals | Renewal Policy | Create and edit |
| Operations > Renewals | Renewal Batch | Create and edit |
| Operations > Renewals | Renewal Queue | Create and edit |
| Operations > Renewals | Retention Analytics | Create and edit |
| Operations > Renewals | At-Risk Policies | Create and edit |
| Operations > Renewals | Negotiations | Create and edit |
| Operations > Renewals | Lapse Management | Create and edit |
| Operations > Renewals | Performance | Create and edit |
| Operations | Payments | Create and edit |
| Operations | CTPL Authentication | Create and edit |
| Operations | Cover Notes | Create and edit |
| Operations | Policy Cancellation | Create and edit |
| Operations | Claims Awaiting Documents | Create and edit |
| Operations | Motor Claim Repairs | Create and edit |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | Create and edit |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports | Report Builder | View |
| Master > Insurance | Claim Document Checklist | View |
| Master > Insurance | Repair Shops | View |
| Master > Insurance | Distribution Channels | View |
| Product Configurator | Dashboard | View |
| Product Configurator | Product Templates | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Quotations and placement | Create and edit | Create quotations (Quick Quote too), send requests for quotation, prepare placement slips |
| Sales & Marketing | Lead assignment | View | See assignment rules, the reassignment queue and every team's prospects |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Sales activities | View | See activity timelines and the activity report |
| Operations | Clients | View | See clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Policies | Create and edit | Record and issue policies, cover notes and CTPL certificates |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Endorsements and cancellations | Create and edit | Request and process endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Renewals | Create and edit | Prepare renewals and renewal terms |
| Operations | Claims | View | See claims |
| Operations | Claims | Create and edit | Register and follow up claims, claim documents and repairs |
| Operations | Fleet schedules | View | See fleet schedules and print the schedule of vehicles |
| Operations | Fleet schedules | Create and edit | Prepare and issue fleet schedules; add or delete vehicles by endorsement |
| Operations | Marine open covers | View | See open covers, certificates and declarations; print certificates |
| Operations | Marine open covers | Create and edit | Set up open covers, issue certificates, submit and bill declarations |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves nothing.

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Claims | Claim decisions: review, reject, settle, approve a settlement, close | TIS Operations Unit Head or TIS General Manager |
| Policies | Decide the check of a placement against the slip (not the user who recorded the policy) | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotations and placement | Approve a quotation created by another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Renewals | Approve or return renewal terms of another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Operations > Claims > Settlement approval | Claim settlement approval within the approver's limit | TIS Operations Unit Head or TIS General Manager |
| Quotation > Underwriting referral (the authority role of the acceptance rule) | Underwriting referral approval within the approver's limit | TIS Operations Unit Head |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit), Claims (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Claims and payment | Claims (create and edit) with Disbursements and petty cash (create and edit) held by the same person | Warning | The claims handler should not also prepare the claim payments |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS Operations Officer
### Role summary
**Department:** Operations. As the Operations Associate, plus reading journal vouchers and fixed assets.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Dashboard | Claims Dashboard | View |
| Dashboard | Processing Dashboard | View |
| Operations > Sales & Marketing | Prospects | View |
| Operations > Sales & Marketing | Quick Quote | Create and edit |
| Operations > Sales & Marketing | Requests for Quotation | Create and edit |
| Operations > Sales & Marketing | Quotations | Create and edit |
| Operations > Sales & Marketing | Placement Slips | Create and edit |
| Operations > Sales & Marketing | Lead Assignment | View |
| Operations > Sales & Marketing | Dealer Programmes | View |
| Operations > Sales & Marketing | Comparison Reports | Create and edit |
| Operations > Sales & Marketing | Sales Activities | View |
| Operations | Clients | View |
| Operations | Policy | Create and edit |
| Operations | Fleet Schedules | Create and edit |
| Operations | Marine Open Covers | Create and edit |
| Operations | Claims | Create and edit |
| Operations > Renewals | Renewal Policy | Create and edit |
| Operations > Renewals | Renewal Batch | Create and edit |
| Operations > Renewals | Renewal Queue | Create and edit |
| Operations > Renewals | Retention Analytics | Create and edit |
| Operations > Renewals | At-Risk Policies | Create and edit |
| Operations > Renewals | Negotiations | Create and edit |
| Operations > Renewals | Lapse Management | Create and edit |
| Operations > Renewals | Performance | Create and edit |
| Operations | Payments | Create and edit |
| Operations | CTPL Authentication | Create and edit |
| Operations | Cover Notes | Create and edit |
| Operations | Policy Cancellation | Create and edit |
| Operations | Claims Awaiting Documents | Create and edit |
| Operations | Motor Claim Repairs | Create and edit |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Accounts > Fixed Assets | Asset Register | View |
| Accounts > Fixed Assets | Depreciation Run | View |
| Accounts > Fixed Assets | Disposals | View |
| Accounts | Journal Voucher | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | Create and edit |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports | Report Builder | View |
| Master > Insurance | Claim Document Checklist | View |
| Master > Insurance | Repair Shops | View |
| Master > Insurance | Distribution Channels | View |
| Product Configurator | Dashboard | View |
| Product Configurator | Product Templates | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Quotations and placement | Create and edit | Create quotations (Quick Quote too), send requests for quotation, prepare placement slips |
| Sales & Marketing | Lead assignment | View | See assignment rules, the reassignment queue and every team's prospects |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Sales activities | View | See activity timelines and the activity report |
| Operations | Clients | View | See clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Policies | Create and edit | Record and issue policies, cover notes and CTPL certificates |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Endorsements and cancellations | Create and edit | Request and process endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Renewals | Create and edit | Prepare renewals and renewal terms |
| Operations | Claims | View | See claims |
| Operations | Claims | Create and edit | Register and follow up claims, claim documents and repairs |
| Operations | Fleet schedules | View | See fleet schedules and print the schedule of vehicles |
| Operations | Fleet schedules | Create and edit | Prepare and issue fleet schedules; add or delete vehicles by endorsement |
| Operations | Marine open covers | View | See open covers, certificates and declarations; print certificates |
| Operations | Marine open covers | Create and edit | Set up open covers, issue certificates, submit and bill declarations |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Fixed assets | View | See the fixed asset register and depreciation |
| Accounts | Journal vouchers | View | See journal vouchers and the SAP GL export |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves nothing.

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Claims | Claim decisions: review, reject, settle, approve a settlement, close | TIS Operations Unit Head or TIS General Manager |
| Policies | Decide the check of a placement against the slip (not the user who recorded the policy) | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotations and placement | Approve a quotation created by another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Renewals | Approve or return renewal terms of another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Operations > Claims > Settlement approval | Claim settlement approval within the approver's limit | TIS Operations Unit Head or TIS General Manager |
| Quotation > Underwriting referral (the authority role of the acceptance rule) | Underwriting referral approval within the approver's limit | TIS Operations Unit Head |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit), Claims (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Claims and payment | Claims (create and edit) with Disbursements and petty cash (create and edit) held by the same person | Warning | The claims handler should not also prepare the claim payments |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS Operations Unit Head
### Role summary
**Department:** Operations. As the Operations Officer, plus approving quotations, placements, renewals and claims.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Dashboard | Claims Dashboard | View |
| Dashboard | Processing Dashboard | View |
| Operations > Sales & Marketing | Prospects | View |
| Operations > Sales & Marketing | Quick Quote | Approve |
| Operations > Sales & Marketing | Requests for Quotation | Approve |
| Operations > Sales & Marketing | Quotations | Approve |
| Operations > Sales & Marketing | Placement Slips | Approve |
| Operations > Sales & Marketing | Lead Assignment | View |
| Operations > Sales & Marketing | Dealer Programmes | View |
| Operations > Sales & Marketing | Comparison Reports | Approve |
| Operations > Sales & Marketing | Sales Activities | View |
| Operations | Clients | View |
| Operations | Policy | Approve |
| Operations | Fleet Schedules | Create and edit |
| Operations | Marine Open Covers | Create and edit |
| Operations | Claims | Approve |
| Operations > Renewals | Renewal Policy | Approve |
| Operations > Renewals | Renewal Batch | Approve |
| Operations > Renewals | Renewal Queue | Approve |
| Operations > Renewals | Retention Analytics | Approve |
| Operations > Renewals | At-Risk Policies | Approve |
| Operations > Renewals | Negotiations | Approve |
| Operations > Renewals | Lapse Management | Approve |
| Operations > Renewals | Performance | Approve |
| Operations | Payments | Approve |
| Operations | CTPL Authentication | Approve |
| Operations | Cover Notes | Approve |
| Operations | Policy Cancellation | Create and edit |
| Operations | Claims Awaiting Documents | Approve |
| Operations | Motor Claim Repairs | Approve |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Accounts > Payables | Supplier Invoices | Approve |
| Accounts > Payables | Supplier Payments | Approve |
| Accounts > Payables | AP Ageing | Approve |
| Accounts > Payables | Suppliers | Approve |
| Accounts > Payables | Supplier 2307 | Approve |
| Accounts > Fixed Assets | Asset Register | View |
| Accounts > Fixed Assets | Depreciation Run | View |
| Accounts > Fixed Assets | Disposals | View |
| Accounts | Disbursement | View |
| Accounts | Journal Voucher | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | Approve |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports | Report Builder | View |
| Master > Insurance | Claim Document Checklist | View |
| Master > Insurance | Repair Shops | View |
| Master > Insurance | Distribution Channels | View |
| Product Configurator | Dashboard | View |
| Product Configurator | Product Templates | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Quotations and placement | Create and edit | Create quotations (Quick Quote too), send requests for quotation, prepare placement slips |
| Sales & Marketing | Quotations and placement | Approve | Approve a quotation created by another user |
| Sales & Marketing | Lead assignment | View | See assignment rules, the reassignment queue and every team's prospects |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Sales activities | View | See activity timelines and the activity report |
| Operations | Clients | View | See clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Policies | Create and edit | Record and issue policies, cover notes and CTPL certificates |
| Operations | Policies | Approve | Decide the check of a placement against the slip (not the user who recorded the policy) |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Endorsements and cancellations | Create and edit | Request and process endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Renewals | Create and edit | Prepare renewals and renewal terms |
| Operations | Renewals | Approve | Approve or return renewal terms of another user |
| Operations | Claims | View | See claims |
| Operations | Claims | Create and edit | Register and follow up claims, claim documents and repairs |
| Operations | Claims | Approve | Claim decisions: review, reject, settle, approve a settlement, close |
| Operations | Fleet schedules | View | See fleet schedules and print the schedule of vehicles |
| Operations | Fleet schedules | Create and edit | Prepare and issue fleet schedules; add or delete vehicles by endorsement |
| Operations | Marine open covers | View | See open covers, certificates and declarations; print certificates |
| Operations | Marine open covers | Create and edit | Set up open covers, issue certificates, submit and bill declarations |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Disbursements and petty cash | View | See payment vouchers, petty cash and bank payment files |
| Accounts | Payables | View | See suppliers, supplier invoices and payments, AP ageing |
| Accounts | Payables | Approve | Approve supplier invoices (not the preparer) |
| Accounts | Fixed assets | View | See the fixed asset register and depreciation |
| Accounts | Journal vouchers | View | See journal vouchers and the SAP GL export |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves the work of other users:

- Claim decisions: review, reject, settle, approve a settlement, close
- Approve supplier invoices (not the preparer)
- Decide the check of a placement against the slip (not the user who recorded the policy)
- Approve a quotation created by another user
- Approve or return renewal terms of another user

Approval limits of this role on the Authority Matrix:

| Transaction | Approval step | Limit of the role |
|---|---|---|
| Claim settlement approval | Operations > Claims > Settlement approval | Not set: no amount limit applies |
| Underwriting referral approval | Quotation > Underwriting referral (the authority role of the acceptance rule) | Not set: no amount limit applies |

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Claims | Claim decisions: review, reject, settle, approve a settlement, close | TIS Operations Unit Head or TIS General Manager |
| Policies | Decide the check of a placement against the slip (not the user who recorded the policy) | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotations and placement | Approve a quotation created by another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Renewals | Approve or return renewal terms of another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Operations > Claims > Settlement approval | Claim settlement approval within the approver's limit | TIS Operations Unit Head or TIS General Manager |
| Quotation > Underwriting referral (the authority role of the acceptance rule) | Underwriting referral approval within the approver's limit | TIS Operations Unit Head |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit), Claims (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Claims and payment | Claims (create and edit) with Disbursements and petty cash (create and edit) held by the same person | Warning | The claims handler should not also prepare the claim payments |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## CCD-PDU (Post-Dated Cheques)
### Role summary
**Department:** Cash Control. Post-dated cheques: encoding, acknowledgement, deposit and cancellation.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Operations | Payments | View |
| Accounts | Receipts | Create and edit |
| Accounts | Post-Dated Cheques | Create and edit |
| Reports | All Reports | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Receipts | Create and edit | Issue official receipts, post cash, verify payments, handle post-dated cheques |
| Reports | Reports | View | Run and download reports |
| Master data and configuration | Reference masters | View | See reference masters |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |

### Approvals
This role approves nothing.

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Receipts (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Receipting and selling | Receipts (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## CCD-PDC / CCD-ADA
### Role summary
**Department:** Cash Control. Post-dated cheques and auto-debit arrangements.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Operations | Payments | View |
| Accounts | Receipts | Create and edit |
| Accounts | Collections | View |
| Accounts | Post-Dated Cheques | Create and edit |
| Accounts > Bank Reconciliation | Reconciliation Workspace | View |
| Accounts > Bank Reconciliation | Reconciliations | View |
| Accounts > Bank Reconciliation | Reconciliation Statement Report | View |
| Accounts > Bank Reconciliation | Outstanding Cheques | View |
| Accounts > Bank Reconciliation | Deposits in Transit | View |
| Accounts > Bank Reconciliation | Unmatched Bank Lines | View |
| Accounts > Bank Reconciliation | Bank Book | View |
| Accounts > Insurer Reconciliation | Insurer Statements | View |
| Reports | All Reports | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Receipts | Create and edit | Issue official receipts, post cash, verify payments, handle post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Bank reconciliation | View | See bank reconciliations |
| Reports | Reports | View | Run and download reports |
| Master data and configuration | Reference masters | View | See reference masters |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |

### Approvals
This role approves nothing.

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Receipts (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Receipting and selling | Receipts (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## CCD-BP / QRPh (Receipting)
### Role summary
**Department:** Cash Control. Official and acknowledgement receipts, bills payment and QRPh; no reversals.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Operations | Payments | View |
| Accounts | Receipts | Create and edit |
| Accounts | Collections | Create and edit |
| Accounts | Post-Dated Cheques | Create and edit |
| Accounts | Claims Settlements | Create and edit |
| Accounts > Bank Reconciliation | Reconciliation Workspace | View |
| Accounts > Bank Reconciliation | Reconciliations | View |
| Accounts > Bank Reconciliation | Reconciliation Statement Report | View |
| Accounts > Bank Reconciliation | Outstanding Cheques | View |
| Accounts > Bank Reconciliation | Deposits in Transit | View |
| Accounts > Bank Reconciliation | Unmatched Bank Lines | View |
| Accounts > Bank Reconciliation | Bank Book | View |
| Accounts > Insurer Reconciliation | Insurer Statements | View |
| Reports | All Reports | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Receipts | Create and edit | Issue official receipts, post cash, verify payments, handle post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Collections and credit control | Create and edit | Record collections and adjustments |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Bank reconciliation | View | See bank reconciliations |
| Reports | Reports | View | Run and download reports |
| Master data and configuration | Reference masters | View | See reference masters |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |

### Approvals
This role approves nothing.

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Collections and credit control | Approve premium warranty extensions and client credit limits (not the requester) | TIS Finance & General Accounting |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Receipts (create and edit), Collections and credit control (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Receipting and selling | Receipts (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |
| Receipting and reversals | CCD-BP / QRPh (Receipting) and CCD-Recon (Reconciliation and Reversals) held by the same person | Warning | RBAC v4: CCD-BP issues the receipts and has no reversal rights; reversals and adjustments sit with CCD-Recon |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## CCD-Recon (Reconciliation and Reversals)
### Role summary
**Department:** Cash Control. Payment reconciliation, reversals and adjustments, bank and insurer statements.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Operations | Payments | View |
| Accounts | Receipts | Create and edit |
| Accounts | Collections | Create and edit |
| Accounts | Post-Dated Cheques | Create and edit |
| Accounts | Claims Settlements | Create and edit |
| Accounts | Disbursement | View |
| Accounts | Open Entry Matching | View |
| Accounts | Open Entry Unmatching | View |
| Accounts > Bank Reconciliation | Reconciliation Workspace | Create and edit |
| Accounts > Bank Reconciliation | Reconciliations | Create and edit |
| Accounts > Bank Reconciliation | Reconciliation Statement Report | Create and edit |
| Accounts > Bank Reconciliation | Outstanding Cheques | Create and edit |
| Accounts > Bank Reconciliation | Deposits in Transit | Create and edit |
| Accounts > Bank Reconciliation | Unmatched Bank Lines | Create and edit |
| Accounts > Bank Reconciliation | Bank Book | Create and edit |
| Accounts > Insurer Reconciliation | Insurer Statements | Approve |
| Reports | All Reports | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Receipts | Create and edit | Issue official receipts, post cash, verify payments, handle post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Collections and credit control | Create and edit | Record collections and adjustments |
| Accounts | Disbursements and petty cash | View | See payment vouchers, petty cash and bank payment files |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Remittance and insurer reconciliation | Create and edit | Prepare remittances and insurer statement reconciliations |
| Accounts | Remittance and insurer reconciliation | Approve | Approve insurer statement reconciliations and post their adjustments (not the preparer) |
| Accounts | Bank reconciliation | View | See bank reconciliations |
| Accounts | Bank reconciliation | Create and edit | Prepare bank reconciliations |
| Reports | Reports | View | Run and download reports |
| Master data and configuration | Reference masters | View | See reference masters |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |

### Approvals
This role approves the work of other users:

- Approve insurer statement reconciliations and post their adjustments (not the preparer)

Approval limits of this role on the Authority Matrix:

| Transaction | Approval step | Limit of the role |
|---|---|---|
| Remittance approval | Accounts > Remittance > Approval | Not set: no amount limit applies |
| Remittance settlement, adjustment and transfer | Accounts > Remittance > Approval (settlement, adjustment, transfer) | Not set: no amount limit applies |

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Bank reconciliation | Approve and reopen bank reconciliations (not the preparer) | TIS Finance & General Accounting |
| Collections and credit control | Approve premium warranty extensions and client credit limits (not the requester) | TIS Finance & General Accounting |
| Remittance and insurer reconciliation | Approve insurer statement reconciliations and post their adjustments (not the preparer) | CCD-Recon (Reconciliation and Reversals) |
| Accounts > Remittance > Approval | Remittance approval within the approver's limit | CCD-Recon (Reconciliation and Reversals) or TIS Finance & General Accounting |
| Accounts > Remittance > Approval (settlement, adjustment, transfer) | Remittance settlement, adjustment and transfer within the approver's limit | CCD-Recon (Reconciliation and Reversals) or TIS Finance & General Accounting |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Receipts (create and edit), Collections and credit control (create and edit), Remittance and insurer reconciliation (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Placing and paying insurers | Remittance and insurer reconciliation (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Receipts (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |
| Receipting and reversals | CCD-Recon (Reconciliation and Reversals) and CCD-BP / QRPh (Receipting) held by the same person | Warning | RBAC v4: CCD-BP issues the receipts and has no reversal rights; reversals and adjustments sit with CCD-Recon |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS Finance & General Accounting
### Role summary
**Department:** Finance and Accounting. Disbursements, journal vouchers, payables, fixed assets, commission, remittance and period end.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Operations | Payments | View |
| Accounts | Receipts | View |
| Accounts | Collections | Approve |
| Accounts > Credit Control | Instalment Plans | Approve |
| Accounts > Credit Control | Premium Warranty Monitor | Approve |
| Accounts > Credit Control | Client Credit Limits | Approve |
| Accounts > Credit Control | Remittance Ageing | Approve |
| Accounts | Post-Dated Cheques | View |
| Accounts | Claims Settlements | View |
| Accounts > Payables | Supplier Invoices | Approve |
| Accounts > Payables | Supplier Payments | Approve |
| Accounts > Payables | AP Ageing | Approve |
| Accounts > Payables | Suppliers | Approve |
| Accounts > Payables | Supplier 2307 | Approve |
| Accounts > Fixed Assets | Asset Register | Create and edit |
| Accounts > Fixed Assets | Depreciation Run | Create and edit |
| Accounts > Fixed Assets | Disposals | Create and edit |
| Accounts | Disbursement | Create and edit |
| Accounts | Bank Payment Files | Create and edit |
| Accounts > Remittance | Automated Processing | Create and edit |
| Accounts > Remittance | Tracking | Create and edit |
| Accounts > Remittance | Statements | Create and edit |
| Accounts > Remittance | Settlement | Create and edit |
| Accounts > Remittance | Reconciliation | Create and edit |
| Accounts > Remittance | Bulk Processing | Create and edit |
| Accounts > Remittance | Scheduling | Create and edit |
| Accounts > Remittance | Electronic Transfer | Create and edit |
| Accounts > Remittance | Approval Workflow | Create and edit |
| Accounts > Remittance | Exception Management | Create and edit |
| Accounts > Remittance | Agency Bill Processing | Create and edit |
| Accounts > Remittance | Direct Bill Processing | Create and edit |
| Accounts > Remittance | Adjustments | Create and edit |
| Accounts > Remittance | Notifications | Create and edit |
| Accounts > Remittance | History | Create and edit |
| Accounts > Remittance | Analytics | Create and edit |
| Accounts | Journal Voucher | Create and edit |
| Accounts | SAP GL Export | Create and edit |
| Accounts | Correction JV | Create and edit |
| Accounts | Reversal JV | Create and edit |
| Accounts | Open Entry Matching | View |
| Accounts | Open Entry Unmatching | View |
| Accounts | Accounting Query | View |
| Accounts | All Clients Accounting | View |
| Accounts > Petty Cash | Initiate | Create and edit |
| Accounts > Petty Cash | Request | Create and edit |
| Accounts > Petty Cash | Disbursement | Create and edit |
| Accounts > Petty Cash | Receipts | View |
| Accounts > Petty Cash | Replenish | Create and edit |
| Accounts > Bank Reconciliation | Reconciliation Workspace | Approve |
| Accounts > Bank Reconciliation | Reconciliations | Approve |
| Accounts > Bank Reconciliation | Reconciliation Statement Report | Approve |
| Accounts > Bank Reconciliation | Outstanding Cheques | Approve |
| Accounts > Bank Reconciliation | Deposits in Transit | Approve |
| Accounts > Bank Reconciliation | Unmatched Bank Lines | Approve |
| Accounts > Bank Reconciliation | Bank Book | Approve |
| Accounts > Insurer Reconciliation | Insurer Statements | Create and edit |
| Accounts > Tax | BIR Form 2307 | Approve |
| Accounts > Tax | VAT Summary | Approve |
| Accounts > Tax | SAWT | Approve |
| Accounts > Tax | QAP | Approve |
| Accounts > Tax | SLSP Sales | Approve |
| Accounts > Tax | SLSP Purchases | Approve |
| Accounts > Tax | Withholding Returns | Approve |
| Accounts > Tax | Annual Alphalist 1604-E | Approve |
| Accounts > Tax | Percentage Tax 2551Q | Approve |
| Accounts > Tax | BIR DAT Files | Approve |
| Accounts > Tax | Sales Invoices | Approve |
| Accounts > Tax | E-Invoicing (EIS) | Approve |
| Accounts > Tax | CAS Books and Documents | Approve |
| Accounts > Period End | Period Management | Approve |
| Accounts > Period End | Month-End Close | Approve |
| Accounts > Period End | Year-End Close | Approve |
| Accounts > Period End | Recurring Journals | Approve |
| Accounts > Period End | Financial Statements | Approve |
| Accounts > Incentive | My Programs | View |
| Accounts > Incentive | Calculations | View |
| Accounts > Incentive | Approvals | View |
| Accounts > Incentive | Statement | View |
| Accounts > Incentive | Reports | View |
| Commission | Commission Dashboard | Create and edit |
| Commission | Agents/Referrer Accounts | Create and edit |
| Commission > Insurer Overrides | Agreements | Create and edit |
| Commission > Insurer Overrides | Computations | Create and edit |
| Reports | All Reports | View |
| Reports > Operational Reports | Remittance | Create and edit |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |
| Reports > Financial Reports | Payables | Approve |
| Reports > Financial Reports | Journal | View |
| Reports > Financial Reports | Trial Balance | View |
| Reports > Financial Reports | Income Statement | View |
| Reports > Financial Reports | Balance Sheet | View |
| Reports > Financial Reports | Trial Balance Movement | View |
| Reports > Financial Reports | General Ledger Detail | View |
| Reports > Financial Reports | Aged Payables to Insurers | View |
| Reports > Financial Reports | Month-End Close Status | View |
| Reports > Financial Reports | Co-insurance Register | View |
| Reports > Financial Reports | Due to Insurers | View |
| Reports | Report Builder | View |
| Master > Finance | Account Determination | Approve |
| Master > Finance | Posting Rules | Approve |
| Master > Finance | Configuration Approvals | Approve |
| Master > Finance | Accounting Flow | View |
| Master > Finance | Premium Taxes & LGU Rates | View |
| Master > Finance | Payment Gateways | View |
| Master > Finance | Taxation | View |
| Master > Finance | Close Checklist | View |
| Master > Finance | Asset Classes | View |
| Master > Finance | Cost Centres | View |
| Master > Finance | Bank Statement Formats | View |
| Master > Finance | Bank Transaction Types | View |
| Master > Finance | Insurer Statement Formats | View |
| Master > Finance | Bank File Layouts | View |
| Master > System | Schedules | View |
| Master > System | Audit Trail | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Operations | Clients | View | See clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Claims | View | See claims |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Collections and credit control | Approve | Approve premium warranty extensions and client credit limits (not the requester) |
| Accounts | Disbursements and petty cash | View | See payment vouchers, petty cash and bank payment files |
| Accounts | Disbursements and petty cash | Create and edit | Prepare payment vouchers, petty cash and bank payment files |
| Accounts | Payables | View | See suppliers, supplier invoices and payments, AP ageing |
| Accounts | Payables | Create and edit | Enter supplier invoices and payments; maintain suppliers |
| Accounts | Payables | Approve | Approve supplier invoices (not the preparer) |
| Accounts | Fixed assets | View | See the fixed asset register and depreciation |
| Accounts | Fixed assets | Create and edit | Register assets and run the monthly depreciation |
| Accounts | Journal vouchers | View | See journal vouchers and the SAP GL export |
| Accounts | Journal vouchers | Create and edit | Enter, correct and reverse journal vouchers; run the SAP GL export |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Remittance and insurer reconciliation | Create and edit | Prepare remittances and insurer statement reconciliations |
| Accounts | Bank reconciliation | View | See bank reconciliations |
| Accounts | Bank reconciliation | Create and edit | Prepare bank reconciliations |
| Accounts | Bank reconciliation | Approve | Approve and reopen bank reconciliations (not the preparer) |
| Accounts | Period end and tax | View | See period status, the close checklist and BIR tax |
| Accounts | Period end and tax | Create and edit | Run the month-end and year-end steps and BIR tax returns |
| Accounts | Period end and tax | Approve | Approve the close, post into soft-closed periods, reopen periods, reverse a year-end close |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Commission | Commission | Create and edit | Process commission and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Posting rules and account determination | Create and edit | Propose changes to posting rules and account determination |
| Master data and configuration | Posting rules and account determination | Approve | Approve changes to posting rules and account determination (not the requester) |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Master data and configuration | Audit trail | View | See the audit trail |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves the work of other users:

- Approve and reopen bank reconciliations (not the preparer)
- Approve premium warranty extensions and client credit limits (not the requester)
- Approve supplier invoices (not the preparer)
- Approve the close, post into soft-closed periods, reopen periods, reverse a year-end close
- Approve changes to posting rules and account determination (not the requester)

Approval limits of this role on the Authority Matrix:

| Transaction | Approval step | Limit of the role |
|---|---|---|
| Payment voucher and cheque release | Accounts > Disbursements > Cheque approval, and bank payment batch approval | Not set: no amount limit applies |
| Journal voucher approval | Accounts > Journal Vouchers > Approve | Not set: no amount limit applies |
| Remittance approval | Accounts > Remittance > Approval | Not set: no amount limit applies |
| Remittance settlement, adjustment and transfer | Accounts > Remittance > Approval (settlement, adjustment, transfer) | Not set: no amount limit applies |

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Bank reconciliation | Approve and reopen bank reconciliations (not the preparer) | TIS Finance & General Accounting |
| Payables | Approve supplier invoices (not the preparer) | TIS Sales Unit Head, TIS Operations Unit Head, TIS Finance & General Accounting or TIS General Manager |
| Period end and tax | Approve the close, post into soft-closed periods, reopen periods, reverse a year-end close | TIS Finance & General Accounting |
| Posting rules and account determination | Approve changes to posting rules and account determination (not the requester) | TIS Finance & General Accounting |
| Remittance and insurer reconciliation | Approve insurer statement reconciliations and post their adjustments (not the preparer) | CCD-Recon (Reconciliation and Reversals) |
| Accounts > Disbursements > Cheque approval, and bank payment batch approval | Payment voucher and cheque release within the approver's limit | TIS Finance & General Accounting |
| Accounts > Journal Vouchers > Approve | Journal voucher approval within the approver's limit | TIS Finance & General Accounting |
| Accounts > Remittance > Approval | Remittance approval within the approver's limit | CCD-Recon (Reconciliation and Reversals) or TIS Finance & General Accounting |
| Accounts > Remittance > Approval (settlement, adjustment, transfer) | Remittance settlement, adjustment and transfer within the approver's limit | CCD-Recon (Reconciliation and Reversals) or TIS Finance & General Accounting |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Disbursements and petty cash (create and edit), Journal vouchers (create and edit), Remittance and insurer reconciliation (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Claims and payment | Disbursements and petty cash (create and edit) with Claims (create and edit) held by the same person | Warning | The claims handler should not also prepare the claim payments |
| Placing and paying insurers | Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS IT AppSupport / Admin
### Role summary
**Department:** IT. Users, roles, settings, reference masters and interfaces; no business transactions.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Operations > Sales & Marketing | Prospects | View |
| Operations > Sales & Marketing | Requests for Quotation | View |
| Operations > Sales & Marketing | Quotations | View |
| Operations > Sales & Marketing | Placement Slips | View |
| Operations > Sales & Marketing | Lead Assignment | View |
| Operations > Sales & Marketing | Dealer Programmes | Create and edit |
| Operations > Sales & Marketing | Comparison Reports | View |
| Operations | Clients | View |
| Operations | Policy | View |
| Operations | Claims | View |
| Operations > Renewals | Renewal Policy | View |
| Operations > Renewals | Renewal Batch | View |
| Operations > Renewals | Renewal Queue | View |
| Operations > Renewals | Retention Analytics | View |
| Operations > Renewals | At-Risk Policies | View |
| Operations > Renewals | Negotiations | View |
| Operations > Renewals | Lapse Management | View |
| Operations > Renewals | Performance | View |
| Operations | Payments | View |
| Operations | CTPL Authentication | View |
| Operations | Cover Notes | View |
| Operations | Policy Cancellation | View |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Accounts | Post-Dated Cheques | View |
| Accounts > Payables | Supplier Invoices | View |
| Accounts > Payables | Supplier Payments | View |
| Accounts > Payables | AP Ageing | View |
| Accounts > Payables | Suppliers | View |
| Accounts > Payables | Supplier 2307 | View |
| Accounts > Fixed Assets | Asset Register | View |
| Accounts > Fixed Assets | Depreciation Run | View |
| Accounts > Fixed Assets | Disposals | View |
| Accounts | Disbursement | View |
| Accounts > Remittance | Automated Processing | View |
| Accounts > Remittance | Tracking | View |
| Accounts > Remittance | Statements | View |
| Accounts > Remittance | Settlement | View |
| Accounts > Remittance | Reconciliation | View |
| Accounts > Remittance | Bulk Processing | View |
| Accounts > Remittance | Scheduling | View |
| Accounts > Remittance | Electronic Transfer | View |
| Accounts > Remittance | Approval Workflow | View |
| Accounts > Remittance | Exception Management | View |
| Accounts > Remittance | Agency Bill Processing | View |
| Accounts > Remittance | Direct Bill Processing | View |
| Accounts > Remittance | Adjustments | View |
| Accounts > Remittance | Notifications | Create and edit |
| Accounts > Remittance | History | View |
| Accounts > Remittance | Analytics | View |
| Accounts | Journal Voucher | View |
| Commission | Commission Dashboard | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | View |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |
| Reports > Financial Reports | Payables | View |
| Reports > Financial Reports | Journal | View |
| Reports > Financial Reports | Trial Balance | View |
| Reports > Financial Reports | Income Statement | View |
| Reports > Financial Reports | Balance Sheet | View |
| Reports > Financial Reports | Trial Balance Movement | View |
| Reports > Financial Reports | General Ledger Detail | View |
| Reports > Financial Reports | Aged Payables to Insurers | View |
| Reports > Financial Reports | Month-End Close Status | View |
| Reports > Financial Reports | Co-insurance Register | View |
| Reports > Financial Reports | Due to Insurers | View |
| Master > Organization | Company | Create and edit |
| Master > Organization | Branch | Create and edit |
| Master > Organization | Sales Activity Types | Create and edit |
| Master > Organization | Sales Activity Outcomes | Create and edit |
| Master > Insurance | Insurance Company | Create and edit |
| Master > Insurance | Line of Business | Create and edit |
| Master > Insurance | Product | Create and edit |
| Master > Insurance | Cover | Create and edit |
| Master > Insurance | Signatories | Create and edit |
| Master > Insurance | Vehicle | Create and edit |
| Master > Insurance | Short-Period Rates | Create and edit |
| Master > Insurance | Cancellation Reasons | Create and edit |
| Master > Insurance | Claim Document Checklist | Create and edit |
| Master > Insurance | Repair Shops | Create and edit |
| Master > Insurance | Lead Sources | Create and edit |
| Master > Insurance | Reason Codes | Create and edit |
| Master > Insurance | Distribution Channels | Create and edit |
| Master > Location | Country | Create and edit |
| Master > Location | Province | Create and edit |
| Master > Location | City / Municipality | Create and edit |
| Master > Employees | Hierarchy | Create and edit |
| Master > Employees | Designation | Create and edit |
| Master > Users and Access | User | Create and edit |
| Master > Users and Access | Role | Create and edit |
| Master > Users and Access | User Access Matrix | Create and edit |
| Master > Users and Access | Role Permissions | Create and edit |
| Master > Users and Access | Authority Matrix | Approve |
| Master > Users and Access | Delegations | Approve |
| Master > Users and Access | Segregation of Duties | Approve |
| Master > Users and Access | Access Reviews | Approve |
| Master > Finance | Package Bundles | Create and edit |
| Master > Finance | Insurer Rate Tables | Create and edit |
| Master > Finance | Premium Taxes & LGU Rates | Create and edit |
| Master > Finance | Commission Rate Matrix | Create and edit |
| Master > Finance | Transaction Code | Create and edit |
| Master > Finance | Currency | Create and edit |
| Master > Finance | Exchange Rate | Create and edit |
| Master > Finance | Bank | Create and edit |
| Master > System | E-mail Layout | Create and edit |
| Master > System | Documents and Reports Layout | Create and edit |
| Master > System | Document Signatures | Create and edit |
| Master > System | Configuration | Create and edit |
| Master > System | Document Numbering | Create and edit |
| Master > System | Schedules | Create and edit |
| Master > System | Audit Trail | View |
| Master > System | E-mail Outbox | Create and edit |
| Master > System | Integrations | Create and edit |
| Master > System | Message Templates | Create and edit |
| Master > System | Insurer Integration | Create and edit |
| Product Configurator | Dashboard | Create and edit |
| Product Configurator | Product Templates | Create and edit |
| Product Configurator | Coverage Builder | Create and edit |
| Product Configurator | Rating Engine | Create and edit |
| Product Configurator | Acceptance Rules | Create and edit |
| Product Configurator | Document Manager | Create and edit |
| Product Configurator | Market Mapping | Create and edit |
| Product Configurator | Risk Mapping | Create and edit |
| Product Configurator | Product Analytics | Create and edit |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Dealer programmes | Create and edit | Maintain programmes and upload dealer vehicle sales |
| Operations | Clients | View | See clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Claims | View | See claims |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Disbursements and petty cash | View | See payment vouchers, petty cash and bank payment files |
| Accounts | Payables | View | See suppliers, supplier invoices and payments, AP ageing |
| Accounts | Fixed assets | View | See the fixed asset register and depreciation |
| Accounts | Journal vouchers | View | See journal vouchers and the SAP GL export |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Product Configurator | Products | Create and edit | Configure products, covers, rating and rules |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Reference masters | Create and edit | Maintain reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Distribution channels | Create and edit | Maintain distribution channels |
| Master data and configuration | Premium taxes and LGU rates | Create and edit | Maintain premium taxes and charges and the LGU tax rates |
| Master data and configuration | System settings | View | See system settings |
| Master data and configuration | System settings | Create and edit | Change system settings |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Schedules | Create and edit | Run, switch on or off and reschedule jobs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Master data and configuration | Integrations | Create and edit | Configure connectors and message templates; resend or cancel messages |
| Master data and configuration | Audit trail | View | See the audit trail |
| Users and access | Users | View | See users and their sign-in history |
| Users and access | Users | Create and edit | Create users, change their roles, reset passwords, lock and unlock |
| Users and access | Roles | Create and edit | Create roles and request changes to their access |
| Users and access | Access control | View | See access matrices, role permissions, authority limits, delegations, segregation of duties and access reviews |
| Users and access | Access control | Create and edit | Propose authority limits, record delegations, maintain segregation of duties, run access reviews |
| Users and access | Access control | Approve | Approve role access changes and authority limits of another administrator |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |

### Approvals
This role approves the work of other users:

- Approve role access changes and authority limits of another administrator

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Access control | Approve role access changes and authority limits of another administrator | TIS IT AppSupport / Admin |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Users (create and edit), Roles (create and edit), Access control (create and edit) with Receipts (create and edit), Collections and credit control (create and edit), Disbursements and petty cash (create and edit), Journal vouchers (create and edit), Remittance and insurer reconciliation (create and edit), Policies (create and edit), Quotations and placement (create and edit), Claims (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## TIS General Manager
### Role summary
**Department:** Management. Front office with every approval; reads accounting and the audit trail.

> In preparation. What this role is responsible for at Toyota Insurance Services Philippines, and how it works with the other roles of its department.
### Menus available
The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Dashboard | Executive Dashboard | View |
| Dashboard | Claims Dashboard | View |
| Dashboard | Processing Dashboard | View |
| Dashboard | Sales Dashboard | View |
| Operations > Sales & Marketing | Prospects | Create and edit |
| Operations > Sales & Marketing | Quick Quote | Approve |
| Operations > Sales & Marketing | Requests for Quotation | Approve |
| Operations > Sales & Marketing | Quotations | Approve |
| Operations > Sales & Marketing | Placement Slips | Approve |
| Operations > Sales & Marketing | Lead Assignment | Create and edit |
| Operations > Sales & Marketing | Dealer Programmes | View |
| Operations > Sales & Marketing | Comparison Reports | Approve |
| Operations > Sales & Marketing | Campaigns | Create and edit |
| Operations > Sales & Marketing | Sales Activities | Create and edit |
| Operations | Clients | Create and edit |
| Operations | Policy | Approve |
| Operations | Fleet Schedules | Create and edit |
| Operations | Marine Open Covers | Create and edit |
| Operations | Claims | Approve |
| Operations > Renewals | Renewal Policy | Approve |
| Operations > Renewals | Renewal Batch | Approve |
| Operations > Renewals | Renewal Queue | Approve |
| Operations > Renewals | Retention Analytics | Approve |
| Operations > Renewals | At-Risk Policies | Approve |
| Operations > Renewals | Negotiations | Approve |
| Operations > Renewals | Lapse Management | Approve |
| Operations > Renewals | Performance | Approve |
| Operations | Payments | Approve |
| Operations | CTPL Authentication | Approve |
| Operations | Cover Notes | Approve |
| Operations | Policy Cancellation | Create and edit |
| Operations | Claims Awaiting Documents | Approve |
| Operations | Motor Claim Repairs | Approve |
| Accounts | Receipts | View |
| Accounts | Collections | View |
| Accounts > Credit Control | Instalment Plans | View |
| Accounts > Credit Control | Premium Warranty Monitor | View |
| Accounts > Credit Control | Client Credit Limits | View |
| Accounts > Credit Control | Remittance Ageing | View |
| Accounts | Post-Dated Cheques | View |
| Accounts | Claims Settlements | View |
| Accounts > Payables | Supplier Invoices | Approve |
| Accounts > Payables | Supplier Payments | Approve |
| Accounts > Payables | AP Ageing | Approve |
| Accounts > Payables | Suppliers | Approve |
| Accounts > Payables | Supplier 2307 | Approve |
| Accounts > Fixed Assets | Asset Register | View |
| Accounts > Fixed Assets | Depreciation Run | View |
| Accounts > Fixed Assets | Disposals | View |
| Accounts | Disbursement | View |
| Accounts | Bank Payment Files | View |
| Accounts > Remittance | Automated Processing | View |
| Accounts > Remittance | Tracking | View |
| Accounts > Remittance | Statements | View |
| Accounts > Remittance | Settlement | View |
| Accounts > Remittance | Reconciliation | View |
| Accounts > Remittance | Bulk Processing | View |
| Accounts > Remittance | Scheduling | View |
| Accounts > Remittance | Electronic Transfer | View |
| Accounts > Remittance | Approval Workflow | View |
| Accounts > Remittance | Exception Management | View |
| Accounts > Remittance | Agency Bill Processing | View |
| Accounts > Remittance | Direct Bill Processing | View |
| Accounts > Remittance | Adjustments | View |
| Accounts > Remittance | Notifications | Create and edit |
| Accounts > Remittance | History | View |
| Accounts > Remittance | Analytics | View |
| Accounts | Journal Voucher | View |
| Accounts | SAP GL Export | View |
| Accounts | Correction JV | View |
| Accounts | Reversal JV | View |
| Accounts | Open Entry Matching | View |
| Accounts | Open Entry Unmatching | View |
| Accounts | Accounting Query | View |
| Accounts | All Clients Accounting | View |
| Accounts > Petty Cash | Initiate | View |
| Accounts > Petty Cash | Request | View |
| Accounts > Petty Cash | Disbursement | View |
| Accounts > Petty Cash | Receipts | View |
| Accounts > Petty Cash | Replenish | View |
| Accounts > Bank Reconciliation | Reconciliation Workspace | View |
| Accounts > Bank Reconciliation | Reconciliations | View |
| Accounts > Bank Reconciliation | Reconciliation Statement Report | View |
| Accounts > Bank Reconciliation | Outstanding Cheques | View |
| Accounts > Bank Reconciliation | Deposits in Transit | View |
| Accounts > Bank Reconciliation | Unmatched Bank Lines | View |
| Accounts > Bank Reconciliation | Bank Book | View |
| Accounts > Insurer Reconciliation | Insurer Statements | View |
| Accounts > Tax | BIR Form 2307 | View |
| Accounts > Tax | VAT Summary | View |
| Accounts > Tax | SAWT | View |
| Accounts > Tax | QAP | View |
| Accounts > Tax | SLSP Sales | View |
| Accounts > Tax | SLSP Purchases | View |
| Accounts > Tax | Withholding Returns | View |
| Accounts > Tax | Annual Alphalist 1604-E | View |
| Accounts > Tax | Percentage Tax 2551Q | View |
| Accounts > Tax | BIR DAT Files | View |
| Accounts > Tax | Sales Invoices | View |
| Accounts > Tax | E-Invoicing (EIS) | View |
| Accounts > Tax | CAS Books and Documents | View |
| Accounts > Period End | Period Management | View |
| Accounts > Period End | Month-End Close | View |
| Accounts > Period End | Year-End Close | View |
| Accounts > Period End | Recurring Journals | View |
| Accounts > Period End | Financial Statements | View |
| Accounts > Incentive | My Programs | View |
| Accounts > Incentive | Calculations | View |
| Accounts > Incentive | Approvals | View |
| Accounts > Incentive | Statement | View |
| Accounts > Incentive | Reports | View |
| Commission | Commission Dashboard | View |
| Commission | Agents/Referrer Accounts | View |
| Commission > Insurer Overrides | Agreements | View |
| Commission > Insurer Overrides | Computations | View |
| Reports | All Reports | View |
| Reports > Operational Reports | Production | View |
| Reports > Operational Reports | Claims | Approve |
| Reports > Operational Reports | Renewal | View |
| Reports > Operational Reports | Remittance | View |
| Reports > Operational Reports | Broker Commission | View |
| Reports > Operational Reports | Dealer Production | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |
| Reports > Financial Reports | Payables | Approve |
| Reports > Financial Reports | Journal | View |
| Reports > Financial Reports | Trial Balance | View |
| Reports > Financial Reports | Income Statement | View |
| Reports > Financial Reports | Balance Sheet | View |
| Reports > Financial Reports | Trial Balance Movement | View |
| Reports > Financial Reports | General Ledger Detail | View |
| Reports > Financial Reports | Aged Payables to Insurers | View |
| Reports > Financial Reports | Month-End Close Status | View |
| Reports > Financial Reports | Co-insurance Register | View |
| Reports > Financial Reports | Due to Insurers | View |
| Master > Insurance | Distribution Channels | View |
| Master > Users and Access | User | View |
| Master > Users and Access | Role | View |
| Master > Users and Access | User Access Matrix | View |
| Master > Users and Access | Role Permissions | View |
| Master > Users and Access | Authority Matrix | View |
| Master > Users and Access | Segregation of Duties | View |
| Master > System | Audit Trail | View |
| Product Configurator | Dashboard | View |
| Product Configurator | Product Templates | View |

### What you can view, change and approve
| Area | Module | Access | What it allows |
|---|---|---|---|
| Sales & Marketing | Prospects and leads | View | See prospects and leads |
| Sales & Marketing | Prospects and leads | Create and edit | Create and edit prospects and leads |
| Sales & Marketing | Quotations and placement | View | See quotations, requests for quotation, placement slips and comparison reports |
| Sales & Marketing | Quotations and placement | Create and edit | Create quotations (Quick Quote too), send requests for quotation, prepare placement slips |
| Sales & Marketing | Quotations and placement | Approve | Approve a quotation created by another user |
| Sales & Marketing | Lead assignment | View | See assignment rules, the reassignment queue and every team's prospects |
| Sales & Marketing | Lead assignment | Create and edit | Maintain assignment rules and reassign prospects |
| Sales & Marketing | Dealer programmes | View | See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters |
| Sales & Marketing | Marketing campaigns | View | See campaigns, segments, templates and results |
| Sales & Marketing | Marketing campaigns | Create and edit | Prepare and send campaigns; maintain segments and templates |
| Sales & Marketing | Sales activities | View | See activity timelines and the activity report |
| Sales & Marketing | Sales activities | Create and edit | Log, change and cancel calls, meetings, e-mails and visits |
| Operations | Clients | View | See clients |
| Operations | Clients | Create and edit | Create and edit clients |
| Operations | Policies | View | See policies, cover notes, payments and CTPL authentication |
| Operations | Policies | Create and edit | Record and issue policies, cover notes and CTPL certificates |
| Operations | Policies | Approve | Decide the check of a placement against the slip (not the user who recorded the policy) |
| Operations | Endorsements and cancellations | View | See endorsements and cancellations |
| Operations | Endorsements and cancellations | Create and edit | Request and process endorsements and cancellations |
| Operations | Renewals | View | See renewals |
| Operations | Renewals | Create and edit | Prepare renewals and renewal terms |
| Operations | Renewals | Approve | Approve or return renewal terms of another user |
| Operations | Claims | View | See claims |
| Operations | Claims | Create and edit | Register and follow up claims, claim documents and repairs |
| Operations | Claims | Approve | Claim decisions: review, reject, settle, approve a settlement, close |
| Operations | Fleet schedules | View | See fleet schedules and print the schedule of vehicles |
| Operations | Fleet schedules | Create and edit | Prepare and issue fleet schedules; add or delete vehicles by endorsement |
| Operations | Marine open covers | View | See open covers, certificates and declarations; print certificates |
| Operations | Marine open covers | Create and edit | Set up open covers, issue certificates, submit and bill declarations |
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Disbursements and petty cash | View | See payment vouchers, petty cash and bank payment files |
| Accounts | Payables | View | See suppliers, supplier invoices and payments, AP ageing |
| Accounts | Payables | Approve | Approve supplier invoices (not the preparer) |
| Accounts | Fixed assets | View | See the fixed asset register and depreciation |
| Accounts | Journal vouchers | View | See journal vouchers and the SAP GL export |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Bank reconciliation | View | See bank reconciliations |
| Accounts | Period end and tax | View | See period status, the close checklist and BIR tax |
| Accounts | Incentives | View | See incentive programmes, calculations and statements |
| Commission | Commission | View | See commission, referrer accounts and insurer overrides |
| Reports | Reports | View | Run and download reports |
| Product Configurator | Products | View | See products and product templates |
| Master data and configuration | Reference masters | View | See reference masters |
| Master data and configuration | Distribution channels | View | See dealers, financing banks, affinity partners and their production |
| Master data and configuration | Schedules | View | See scheduled jobs and their runs |
| Master data and configuration | Integrations | View | See connectors and the integration outbox and inbox |
| Master data and configuration | Audit trail | View | See the audit trail |
| Users and access | Users | View | See users and their sign-in history |
| Users and access | Access control | View | See access matrices, role permissions, authority limits, delegations, segregation of duties and access reviews |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |
| Basic and special access | Full personal data | Special | See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports |

### Approvals
This role approves the work of other users:

- Claim decisions: review, reject, settle, approve a settlement, close
- Approve supplier invoices (not the preparer)
- Decide the check of a placement against the slip (not the user who recorded the policy)
- Approve a quotation created by another user
- Approve or return renewal terms of another user

Approval limits of this role on the Authority Matrix:

| Transaction | Approval step | Limit of the role |
|---|---|---|
| Claim settlement approval | Operations > Claims > Settlement approval | Not set: no amount limit applies |

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Claims | Claim decisions: review, reject, settle, approve a settlement, close | TIS Operations Unit Head or TIS General Manager |
| Policies | Decide the check of a placement against the slip (not the user who recorded the policy) | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Quotations and placement | Approve a quotation created by another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Renewals | Approve or return renewal terms of another user | TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager |
| Operations > Claims > Settlement approval | Claim settlement approval within the approver's limit | TIS Operations Unit Head or TIS General Manager |
| Quotation > Underwriting referral (the authority role of the acceptance rule) | Underwriting referral approval within the approver's limit | TIS Operations Unit Head |

The user who enters a record never approves it: the approval is always another user's.

### Segregation of duties
| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit), Claims (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Claims and payment | Claims (create and edit) with Disbursements and petty cash (create and edit) held by the same person | Warning | The claims handler should not also prepare the claim payments |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.

### Daily and periodic tasks
> In preparation. The daily, weekly and month-end tasks of this role, each with the screen where it is done, follow in the next draft of this manual.
### Procedures
> In preparation. The step-by-step procedures of this role follow in the next draft of this manual. Each one points to the screen sections of the screen reference.
## Screen reference: Operations
The screens of the Operations menu, in menu order: prospects, quotations and placement, clients, policies, claims, renewals and the policy services.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role.

### Prospects
**Menu:** Operations > Sales & Marketing > Prospects

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Create a prospect
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### View, edit or delete a prospect
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Quick Quote
**Menu:** Operations > Sales & Marketing > Quick Quote

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Requests for quotation (broker slips)
Choose Operations > Sales & Marketing > Request for Quotation (Broker Slip). The cards count the requests by status (**Submitted**, **Responses in**, **Draft**, **Closed**); select a card to filter. Each row shows **Slip No.**, **Insured**, **Product**, **Sum insured**, **Offers / approached** (with the number declined), **Best offer (gross)**, **Response due**, **Age**, **Status** and the **Quotation Slip** made from it. Select a row to open it.

**Menu:** Operations > Sales & Marketing > Requests for Quotation

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Quotations
**Menu:** Operations > Sales & Marketing > Quotations

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Create a motor quotation
A motor quotation has five steps. Nothing is saved until **Completed Quote** on the last step, so you can move with **Back** and **Next**.

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Placement Slips
The broker never issues cover. A placement slip goes to the insurer, the insurer acknowledges it and returns the e-policy, the e-policy is checked against the slip and only then is the policy booked. No screen lets a user complete cover without the insurer.

**Menu:** Operations > Sales & Marketing > Placement Slips

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Record e-Policy
Use **Record e-Policy** to key the e-policies the insurers send back without searching for each placement slip. Choose Placement Slips and select **Record e-Policy**: the list shows the placement slips sent to the insurer or acknowledged. Select a row, then fill in the e-policy as described in Upload the e-policy. The placement slip opens afterwards for the check against the slip by another user.

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Lead Assignment
**Menu:** Operations > Sales & Marketing > Lead Assignment

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Dealer Programmes
Choose Operations > Sales & Marketing > Dealer Programmes. A programme holds the terms agreed with a dealer, and optionally its financing bank, for brand-new vehicles.

**Menu:** Operations > Sales & Marketing > Dealer Programmes

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Comparison Reports
Choose Operations > Sales & Marketing > Comparison Reports. The comparison report is the printed, branded document given to the client comparing the insurers' offers, with the option the broker recommends and why. It never shows commission.

**Menu:** Operations > Sales & Marketing > Comparison Reports

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Campaigns
Choose Operations > Sales & Marketing > Campaigns. Campaigns e-mail offers only to clients and prospects whose marketing consent is in force and who have an e-mail address. Everyone else is left out and recorded with the reason.

**Menu:** Operations > Sales & Marketing > Campaigns

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS General Manager | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Sales activities
Account executives log every call, meeting, e-mail and visit with a prospect, a client or on a quotation. Each prospect, client and quotation shows its activities as a timeline, newest first: a prospect and a client also show the activities logged on their quotations (with the quotation number), and a client those of the prospect it came from. The open next step is shown above the timeline.

**Menu:** Operations > Sales & Marketing > Sales Activities

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS General Manager | Create and edit |

**Menu:** Master > Organization > Sales Activity Types

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Organization > Sales Activity Outcomes

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Clients
**Menu:** Operations > Clients

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Onboard a client before the first policy
A client can be created, identified and checked before any quotation or policy, as customer due diligence requires. A client created by the first policy (a prospect converted, a direct placement) is completed the same way, from **Identification and due diligence** on the client view.

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Policies
Choose Operations > Policy. The list shows **Policy Number**, **Client Id**, **Client Name**, **Gross Premium**, **Policy Issued**, **Policy Expiry**, **Product Description** and **Payment** status. The search box finds a policy by number or client. **Show Filters** offers **Payment Status**, **Product Type**, **Insurance Company**, **Client Name**, issue and expiry date ranges and minimum and maximum premium.

**Menu:** Operations > Policy

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Raise an endorsement request
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Fleet Schedules
Choose Operations > Fleet Schedules. A fleet schedule is one motor policy covering many vehicles of a client.

**Menu:** Operations > Fleet Schedules

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Create and edit |
| TIS General Manager | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Marine Open Covers
Choose Operations > Marine Open Covers. An open cover insures a client's cargo shipments for a period: each shipment is certified or declared and the premium is billed per declaration period.

**Menu:** Operations > Marine Open Covers

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Create and edit |
| TIS General Manager | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### The claims list
**Menu:** Operations > Claims

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Register a claim
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Adjuster report
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Assessment and settlement (maker)
On **Assessment**, check the key facts of the claim and the **Assessment basis** (date reported, adjuster and adjuster status) and choose **Proceed to settlement**, or **Reject claim** with the **Reason for rejection**.

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Approve a settlement (checker)
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Claim details, documents and audit trail
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Renewal Policy
**Menu:** Operations > Renewals > Renewal Policy

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
#### Renew a policy
> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Renewal Batch, Lapse Management and the analytics
**Menu:** Operations > Renewals > Renewal Batch

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

**Menu:** Operations > Renewals > Retention Analytics

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

**Menu:** Operations > Renewals > Lapse Management

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

**Menu:** Operations > Renewals > Performance

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Renewal Queue and At-Risk Policies
**Menu:** Operations > Renewals > Renewal Queue

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

**Menu:** Operations > Renewals > At-Risk Policies

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Negotiations
**Menu:** Operations > Renewals > Negotiations

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Payments
Operations > Payments shows **Gross Premium**, **Collected Premium**, **Receivables** and **Earned Commission**, and the bills in the tabs **Paid**, **Pending** and **Reviewing**. The **Type** column says whether the bill is for a **Policy**, a **Renewal Policy** or an **Endorsement**. Receipts are posted by Accounting; this screen shows the result.

**Menu:** Operations > Payments

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| CCD-PDU (Post-Dated Cheques) | View |
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### CTPL authentication
Every CTPL certificate of cover (COC) must be authenticated with the IC-accredited authentication provider before it is released. Operations > CTPL Authentication does it for every CTPL cover issued.

**Menu:** Operations > CTPL Authentication

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Cover notes (binders)
**Menu:** Operations > Cover Notes

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Approve |
| TIS Sales Unit Head | Approve |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Cancel a policy: computed return premium
**Menu:** Operations > Policy Cancellation

| Role | Access |
|---|---|
| TIS Sales Associate | Create and edit |
| TIS Sales Officer | Create and edit |
| TIS Sales Unit Head | Create and edit |
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Create and edit |

**Menu:** Master > Insurance > Short-Period Rates

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Insurance > Cancellation Reasons

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Claims awaiting documents
**Menu:** Operations > Claims Awaiting Documents

| Role | Access |
|---|---|
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Motor claim repairs and letters of authority
Operations > Motor Claim Repairs lists the motor claims with the stage of their repair: no estimate yet, awaiting approval, approved, in repair, released. Select a claim to open its repair file.

**Menu:** Operations > Motor Claim Repairs

| Role | Access |
|---|---|
| TIS Operations Associate | Create and edit |
| TIS Operations Officer | Create and edit |
| TIS Operations Unit Head | Approve |
| TIS General Manager | Approve |

**Menu:** Master > Insurance > Repair Shops

| Role | Access |
|---|---|
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
## Screen reference: Accounts
The screens of the Accounts menu, in menu order: receipts and collections, Cash Control, disbursements and payables, remittance to insurers, journal vouchers, reconciliations, tax, period end and incentives.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role.

### Verify payments and post official receipts
When Operations or Sales record a client payment, the policy payment status becomes Reviewing and Accounting receives the notification to verify it. Open the notification, check the payment against the bank statement and confirm it (the official receipt is posted) or reject it with a reason. Accounting users can also record a payment and issue the receipt directly from the policy.

**Menu:** Accounts > Receipts

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| CCD-PDU (Post-Dated Cheques) | Create and edit |
| CCD-PDC / CCD-ADA | Create and edit |
| CCD-BP / QRPh (Receipting) | Create and edit |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Collections
Accounts > Collections lists every open premium with **Client Name**, **Policy No.**, **Outstanding** spread over the ageing buckets (**Current**, **1-30 Days**, **31-60 Days**, **61-90 Days**, **Over 90 Days**), **Due Date**, **Status** (Pending, Committed, Overdue), **Days Overdue** and **View**. Filter by status and overdue level.

**Menu:** Accounts > Collections

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | Create and edit |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Credit control
**Menu:** Accounts > Credit Control > Instalment Plans

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Credit Control > Premium Warranty Monitor

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Credit Control > Client Credit Limits

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Credit Control > Remittance Ageing

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Post-dated cheques
Accounts > Post-Dated Cheques is the register of cheques received from clients before their date.

**Menu:** Accounts > Post-Dated Cheques

| Role | Access |
|---|---|
| CCD-PDU (Post-Dated Cheques) | Create and edit |
| CCD-PDC / CCD-ADA | Create and edit |
| CCD-BP / QRPh (Receipting) | Create and edit |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Claims settlements paid through the broker
**Menu:** Accounts > Claims Settlements

| Role | Access |
|---|---|
| CCD-BP / QRPh (Receipting) | Create and edit |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Accounts payable
Suppliers are kept on Accounts > Payables > Suppliers: TIN, address, VAT registration, the EWT tax code withheld (Master > Finance > Taxation, for example WC158 goods, WC160 services, WC100 rentals), payment terms and the default expense account.

**Menu:** Accounts > Payables > Supplier Invoices

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Operations Unit Head | Approve |
| TIS Finance & General Accounting | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

**Menu:** Accounts > Payables > Supplier Payments

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Operations Unit Head | Approve |
| TIS Finance & General Accounting | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

**Menu:** Accounts > Payables > AP Ageing

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Operations Unit Head | Approve |
| TIS Finance & General Accounting | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

**Menu:** Accounts > Payables > Suppliers

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Operations Unit Head | Approve |
| TIS Finance & General Accounting | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### BIR Form 2307 for suppliers
The expanded withholding tax withheld from a supplier on an approved supplier invoice (the supplier's EWT tax code, on the amount net of VAT) is creditable tax of the supplier: the broker issues BIR Form 2307 for it each quarter.

**Menu:** Accounts > Payables > Supplier 2307

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Operations Unit Head | Approve |
| TIS Finance & General Accounting | Approve |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Fixed assets and depreciation
**Menu:** Accounts > Fixed Assets > Asset Register

| Role | Access |
|---|---|
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Fixed Assets > Depreciation Run

| Role | Access |
|---|---|
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Asset disposal
An asset sold or written off (lost, stolen, damaged beyond repair, obsolete) leaves the register through a disposal.

**Menu:** Accounts > Fixed Assets > Disposals

| Role | Access |
|---|---|
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Disbursement: payment vouchers and cheques
A payment voucher (PV-YYYY-NNNNN, with the disbursement transaction DT-YYYY-NNNNN) pays an insurer, an agent or referrer, a client or a supplier.

**Menu:** Accounts > Disbursement

| Role | Access |
|---|---|
| TIS Sales Unit Head | View |
| TIS Operations Unit Head | View |
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Bank payment files
**Menu:** Accounts > Bank Payment Files

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Remittance to insurers
For broker-billed policies Accounting remits the collected premium, net of the broker's commission, to each insurer by its share.

**Menu:** Accounts > Remittance > Automated Processing

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Tracking

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Statements

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Settlement

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Reconciliation

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Bulk Processing

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Scheduling

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Electronic Transfer

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Approval Workflow

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Exception Management

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Agency Bill Processing

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Adjustments

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Notifications

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | Create and edit |

**Menu:** Accounts > Remittance > History

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Remittance > Analytics

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Direct bill: commission debit notes
**Menu:** Accounts > Remittance > Direct Bill Processing

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Journal vouchers
**Menu:** Accounts > Journal Voucher

| Role | Access |
|---|---|
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Accounts > Correction JV

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

**Menu:** Accounts > Reversal JV

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### SAP GL export
**Menu:** Accounts > SAP GL Export

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Open entry matching and write-offs
Open entry matching settles open debit and credit entries of the same account against each other, for example a receipt against a bill posted without a reference.

**Menu:** Accounts > Open Entry Matching

| Role | Access |
|---|---|
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

**Menu:** Accounts > Open Entry Unmatching

| Role | Access |
|---|---|
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Accounting Query and All Clients Accounting
**Accounting Query** searches the accounting entries by **Policy ID / Number**, **Client ID**, **Client Name**, **Entry Type**, **Reference Type**, **Status**, **Start Date**, **End Date** and **GL Code**; **Export** downloads the result. **All Clients Accounting** shows, for every client, the number of transactions, total debits, total credits and balance; **Export CSV** downloads it.

**Menu:** Accounts > Accounting Query

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

**Menu:** Accounts > All Clients Accounting

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Petty cash
A fund is opened on Initiate, which issues its code (PCF-) when left empty and holds the fund size, the available cash, the maximum limit and the minimum cash box. Requests are maker-checker. After a save the screen returns to its list.

**Menu:** Accounts > Petty Cash > Initiate

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

**Menu:** Accounts > Petty Cash > Request

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

**Menu:** Accounts > Petty Cash > Disbursement

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

**Menu:** Accounts > Petty Cash > Receipts

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

**Menu:** Accounts > Petty Cash > Replenish

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Bank reconciliation
**Menu:** Accounts > Bank Reconciliation > Reconciliation Workspace

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Bank Reconciliation > Reconciliations

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Bank Reconciliation > Reconciliation Statement Report

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Bank Reconciliation > Outstanding Cheques

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Bank Reconciliation > Deposits in Transit

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Bank Reconciliation > Unmatched Bank Lines

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Bank Reconciliation > Bank Book

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Create and edit |
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Insurer statement reconciliation
**Menu:** Accounts > Insurer Reconciliation > Insurer Statements

| Role | Access |
|---|---|
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | Approve |
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Tax: BIR forms and returns
**Menu:** Accounts > Tax > BIR Form 2307

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Tax > VAT Summary

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Tax > SAWT

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Tax > QAP

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Tax > SLSP Sales

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Tax > SLSP Purchases

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Withholding returns: 0619-E, 1601-EQ and their filing records
**Menu:** Accounts > Tax > Withholding Returns

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Annual information return 1604-E and alphalist of payees
**Menu:** Accounts > Tax > Annual Alphalist 1604-E

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Percentage tax 2551Q (non-VAT broker or agent)
**Menu:** Accounts > Tax > Percentage Tax 2551Q

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### BIR DAT files
**Menu:** Accounts > Tax > BIR DAT Files

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Sales invoices (EOPT Act)
**Menu:** Accounts > Tax > Sales Invoices

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### E-invoicing (EIS)
**Menu:** Accounts > Tax > E-Invoicing (EIS)

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### CAS books and documents
Choose Accounts > Tax > CAS Books and Documents.

**Menu:** Accounts > Tax > CAS Books and Documents

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Period end
A fiscal year (FY2026) has twelve monthly periods and an adjustment period 13 used by the year-end close. The cards count the periods Open, Soft-closed, Closed and Locked.

**Menu:** Accounts > Period End > Period Management

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Period End > Month-End Close

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

**Menu:** Accounts > Period End > Financial Statements

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Year-end close (preparer)
Accounts > Period End > Year-End Close leads through five steps, one card per step; the stepper above the card shows the status of each step. Choose the fiscal year and select **Start year-end close**: the prerequisites are checked at once.

**Menu:** Accounts > Period End > Year-End Close

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Recurring journals
**Menu:** Accounts > Period End > Recurring Journals

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Incentives
**Menu:** Accounts > Incentive > My Programs

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | Approve |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

**Menu:** Accounts > Incentive > Calculations

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

**Menu:** Accounts > Incentive > Approvals

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

**Menu:** Accounts > Incentive > Statement

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | Approve |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

**Menu:** Accounts > Incentive > Reports

| Role | Access |
|---|---|
| TIS Sales Unit Head | Approve |
| TIS Finance & General Accounting | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
## Screen reference: Dashboards and Commission
The dashboards and the Commission menu.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role.

### Dashboard
**Menu:** Dashboard > Executive Dashboard

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Claims Dashboard
**Menu:** Dashboard > Claims Dashboard

| Role | Access |
|---|---|
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Processing Dashboard
**Menu:** Dashboard > Processing Dashboard

| Role | Access |
|---|---|
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Sales Dashboard
**Menu:** Dashboard > Sales Dashboard

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Commission to agents and referrers
The list shows every referrer with **TYPE** (Agent, Sub-agent, External), **LEVEL**, **POLICIES**, **NET PAYABLE (OPEN)**, **WHT TYPE** (Individual 5% or Company 10%), **BANK ACCOUNT** and **STATUS**. The header shows **Due this cycle** and **Ready to pay**.

**Menu:** Commission > Commission Dashboard

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Finance & General Accounting | Create and edit |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Commission > Agents/Referrer Accounts

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Overriding, profit and contingent commission from insurers
**Menu:** Commission > Insurer Overrides > Agreements

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

**Menu:** Commission > Insurer Overrides > Computations

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
## Screen reference: Master
The reference masters, users and access, and the system configuration of the Master menu.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role.

### Distribution Channels
Choose Master > Insurance > Distribution Channels. A channel is a dealer group or dealer branch, a financing bank or bank branch, or an affinity partner (a company whose members or homeowners are referred to the broker).

**Menu:** Reports > Operational Reports > Dealer Production

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Master > Insurance > Distribution Channels

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Company, branches and the letterhead
Every printed document and report PDF (quotation, request for quotation, placement slip, policy schedule, billing statement, official receipt, payment voucher, debit note, claim letters, BIR forms) carries the letterhead of the company marked as letterhead company.

**Menu:** Master > Organization > Company

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Organization > Branch

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Insurance companies
Requests for quotation, placement slips, Preliminary Loss Advices and remittance advices go to the insurer's e-mail. Keep it current.

**Menu:** Master > Insurance > Insurance Company

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Masters that work the same way
All masters work alike: a list with search, **Add** (the form opens on its own page or as a panel on the right), **Upload** where offered, the eye to view, the pencil to edit and a status switch to deactivate. Records are not deleted; a deactivated record no longer appears in the lists of the other screens.

**Menu:** Master > Insurance > Line of Business

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Insurance > Product

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Insurance > Cover

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Insurance > Signatories

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Insurance > Vehicle

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Location > Country

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Location > Province

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Location > City / Municipality

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Employees > Hierarchy

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Employees > Designation

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Finance > Bank

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Claim documents
**Menu:** Master > Insurance > Claim Document Checklist

| Role | Access |
|---|---|
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Lead sources and reason codes
**Menu:** Master > Insurance > Lead Sources

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Insurance > Reason Codes

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Users
A duplicate username is refused. At the first sign-in the user must choose a new password (Getting started).

**Menu:** Master > Users and Access > User

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Roles and role permissions
**Menu:** Master > Users and Access > Role

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

**Menu:** Master > Users and Access > Role Permissions

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### User Access Matrix
**Menu:** Master > Users and Access > User Access Matrix

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Authority Matrix
**Menu:** Master > Users and Access > Authority Matrix

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Delegations
A delegation lets another user approve with the limit of an approver who is away, for chosen transactions and dates. It applies once another administrator who may approve access changes approves it; neither the requester nor the person covering approves it.

**Menu:** Master > Users and Access > Delegations

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Segregation of Duties
**Menu:** Master > Users and Access > Segregation of Duties

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Approve |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Access Reviews
Confirm at least every quarter that each active user still needs his or her access.

**Menu:** Master > Users and Access > Access Reviews

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Approve |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Posting configuration: Configuration Approvals, Posting Rules, Account Determination
**Menu:** Master > Finance > Account Determination

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |

**Menu:** Master > Finance > Posting Rules

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |

**Menu:** Master > Finance > Configuration Approvals

| Role | Access |
|---|---|
| TIS Finance & General Accounting | Approve |

**Menu:** Master > Finance > Accounting Flow

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Other finance masters
**Menu:** Master > Finance > Package Bundles

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Finance > Insurer Rate Tables

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Finance > Premium Taxes & LGU Rates

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Finance > Payment Gateways

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

**Menu:** Master > Finance > Transaction Code

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Finance > Currency

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

**Menu:** Master > Finance > Exchange Rate

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Commission Rate Matrix
**Menu:** Master > Finance > Commission Rate Matrix

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Accounting masters
**Menu:** Master > Finance > Taxation

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

**Menu:** Master > Finance > Close Checklist

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

**Menu:** Master > Finance > Bank Statement Formats

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

**Menu:** Master > Finance > Bank Transaction Types

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

**Menu:** Master > Finance > Insurer Statement Formats

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Operational masters
**Menu:** Master > Finance > Asset Classes

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

**Menu:** Master > Finance > Cost Centres

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Bank file layouts and payee bank accounts
Master > Finance > Bank File Layouts says how each bank's upload file is written and how its status file is read. The system is delivered with starter layouts for BDO, BPI, Metrobank, Landbank and UnionBank and a generic CSV. **The starter layouts are examples: each must be validated against the bank's current file specification, and a test file accepted by the bank, during onboarding.** They are marked **Test mode** until changed.

**Menu:** Master > Finance > Bank File Layouts

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### E-mail Layout
**Menu:** Master > System > E-mail Layout

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Documents and Reports Layout
Master > System > **Documents and Reports Layout** sets how every printed document (quotation, policy schedule, slips, endorsement, receipts, billing statements, vouchers, debit notes, claim letters) and every report PDF or Excel file is printed, together with the logo, legal name, TIN, licence and address of the primary company (Master > Organization > Company).

**Menu:** Master > System > Documents and Reports Layout

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Document Signatures
**Menu:** Master > System > Document Signatures

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Configuration
**Menu:** Master > System > Configuration

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Document Numbering
Every number the system issues comes from a series on Master > Document Numbering: prospect, request for quotation, quotation, placement slip, policy, client, bill, official receipt, payment voucher, journal voucher, claim, endorsement, debit note, close run, reconciliation, BIR Form 2307 and the others. The list shows each series with module, prefix, format, counter reset, last number and next number.

**Menu:** Master > System > Document Numbering

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Schedules
**Menu:** Master > System > Schedules

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Audit Trail
The history of a single record (claim history, policy and client **History** tab, quotation **Audit Trail** tab, master records) uses the same layout as a timeline grouped by day, newest first, with a search box, a user filter, a filter by kind of event (created, status changes and approvals, other changes, cancelled or removed) and **Export**.

**Menu:** Master > System > Audit Trail

| Role | Access |
|---|---|
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### E-mail Outbox
**Menu:** Master > System > E-mail Outbox

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Integrations
**Menu:** Master > System > Integrations

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### SMS and message templates
Master > System > Message Templates holds the texts sent to clients by SMS (or Viber).

**Menu:** Master > System > Message Templates

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Insurer integration
**Menu:** Master > System > Insurer Integration

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
## Screen reference: Product Configurator
The screens of the Product Configurator: products, covers, rating, acceptance rules, documents and the mapping to insurers.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role.

### Product Configurator dashboard
**Menu:** Product Configurator > Dashboard

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Product Templates
**Menu:** Product Configurator > Product Templates

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | Create and edit |
| TIS General Manager | View |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Coverage Builder
**Menu:** Product Configurator > Coverage Builder

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Rating Engine
**Menu:** Product Configurator > Rating Engine

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Acceptance Rules
**Menu:** Product Configurator > Acceptance Rules

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Document Manager
**Menu:** Product Configurator > Document Manager

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Market Mapping
**Menu:** Product Configurator > Market Mapping

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Risk Mapping
**Menu:** Product Configurator > Risk Mapping

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
### Product Analytics
**Menu:** Product Configurator > Product Analytics

| Role | Access |
|---|---|
| TIS IT AppSupport / Admin | Create and edit |

> In preparation. The steps, fields and results of this screen follow in the next draft of this manual.
## Reports
Reports open from the Reports menu. Each role sees the reports of its department, and a report shows only the records
the role may read.

### All Reports and the report menus
**Menu:** Reports > All Reports

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| CCD-PDU (Post-Dated Cheques) | View |
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Reports > Operational Reports > Production

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Reports > Financial Reports > SOA/Premium Receivable

| Role | Access |
|---|---|
| CCD-PDU (Post-Dated Cheques) | View |
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

**Menu:** Reports > Financial Reports > Collection Report

| Role | Access |
|---|---|
| CCD-PDU (Post-Dated Cheques) | View |
| CCD-PDC / CCD-ADA | View |
| CCD-BP / QRPh (Receipting) | View |
| CCD-Recon (Reconciliation and Reversals) | View |
| TIS Finance & General Accounting | View |
| TIS IT AppSupport / Admin | View |
| TIS General Manager | View |

> In preparation. How to find, run, filter and download a report; the reports of each department (Sales, Operations, Cash Control, Finance and Accounting, Management); scheduled reports.
### Report Builder
**Menu:** Reports > Report Builder

| Role | Access |
|---|---|
| TIS Sales Associate | View |
| TIS Sales Officer | View |
| TIS Sales Unit Head | View |
| TIS Operations Associate | View |
| TIS Operations Officer | View |
| TIS Operations Unit Head | View |
| TIS Finance & General Accounting | View |

> In preparation. Building, saving and sharing a report of your own.
## Glossary
| Term | Meaning |
|---|---|
| ADA | Auto-debit arrangement: the client's bank pays the premium by debit to the client's account. |
| BIR | Bureau of Internal Revenue. |
| BP | Bills payment: premium paid through a bank or payment centre. |
| CCD | Cash Control Department of TISPH. |
| Client | A person or company with at least one policy. |
| CTPL | Compulsory third party liability insurance of a motor vehicle. |
| COC | Certificate of cover of a CTPL policy. |
| Endorsement | A change to a policy during its period. |
| Insurer | An insurance company of the TISPH panel. |
| LTO | Land Transportation Office. |
| Maker and checker | The maker enters a record; a different user, the checker, approves it. |
| PDC | Post-dated cheque. |
| Placement slip | The request to an insurer to issue cover on agreed terms. |
| Prospect | A person or company that may become a client. |
| QRPh | The national QR code standard for payments. |
| Quotation | The terms offered to a prospect or client. |
| Receipt | The official or acknowledgement receipt of a payment. |
| Remittance | The payment of premium, net of commission, to the insurer. |
| Request for quotation | The request to the insurers for their offers on a risk. |
| SOA | Statement of account. |
| TFS | Toyota Financial Services. |
| TISPH | Toyota Insurance Services Philippines. |
