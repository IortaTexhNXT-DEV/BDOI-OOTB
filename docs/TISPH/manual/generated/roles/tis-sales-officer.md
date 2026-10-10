## Menus available {#tis-sales-officer-menus}

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

## What you can view, change and approve {#tis-sales-officer-access}

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

## Approvals {#tis-sales-officer-approvals}

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

## Segregation of duties {#tis-sales-officer-sod}

| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.
