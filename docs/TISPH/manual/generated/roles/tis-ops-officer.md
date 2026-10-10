## Menus available {#tis-operations-officer-menus}

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

## What you can view, change and approve {#tis-operations-officer-access}

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

## Approvals {#tis-operations-officer-approvals}

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

## Segregation of duties {#tis-operations-officer-sod}

| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Policies (create and edit), Quotations and placement (create and edit), Claims (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Claims and payment | Claims (create and edit) with Disbursements and petty cash (create and edit) held by the same person | Warning | The claims handler should not also prepare the claim payments |
| Placing and paying insurers | Quotations and placement (create and edit), Policies (create and edit) with Remittance and insurer reconciliation (create and edit), Disbursements and petty cash (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Quotations and placement (create and edit), Policies (create and edit) with Receipts (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.
