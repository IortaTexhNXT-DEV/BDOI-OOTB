<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-general-manager.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.general-manager.
Screens to refresh (redesign in another stream, described as on this build): tis-general-manager-front-office
(Check against slip dialog), tis-general-manager-supplier-invoice (invoice pop-up).
-->
# TIS General Manager {#tis-general-manager}

## Role summary {#tis-general-manager-summary}

{{role-summary:tis-general-manager}}

The TIS General Manager oversees the business of Toyota Insurance Services Philippines. You hold every approval of
the front office: the check of the insurers' e-policies against the placement slips, the renewal terms, the return
premiums and cancellations, and the claim decisions and settlement approvals. You approve supplier invoices and the
remittances to the insurers above the limit of TIS Finance & General Accounting, follow the business on the dashboards
and reports, and review who has access to what.

Apart from the remittance approvals, you read the accounting (receipts, remittances, journals, period end, tax)
without changing it, and you read users,
roles, access, the Authority Matrix, segregation of duties and the audit trail without changing them: those are kept
by TIS Finance & General Accounting and TIS IT AppSupport / Admin. You never decide a record you entered yourself.

{{include:generated/roles/tis-general-manager.md}}

## Daily and periodic tasks {#tis-general-manager-tasks}

| Task | When | Screen |
|---|---|---|
| Decide the approvals waiting for you (claim settlements and the other queues) | Every morning and through the day | [My Work](#my-work) |
| Approve or return claim settlements | Daily | [Approve a settlement (checker)](#approve-a-settlement-checker) |
| Decide claims: review, reject, settle, close | As needed | [Claims](#the-claims-list) |
| Check the e-policies received against their placement slips, when the sales and operations approvers are not available | As needed | [Placement Slips](#placement-slips) |
| Approve or return renewal terms and complete return premiums | As needed | [Negotiations](#negotiations), [Policy](#policies) |
| Approve or reject supplier invoices | As notified | [Payables](#accounts-payable) |
| Approve or reject the remittances to the insurers, without amount limit | As notified | [Approvals](#remittance-approvals) |
| Review premium, new business, claims rate, retention and receivables | Weekly | [Dashboard](#dashboard), [Claims Dashboard](#claims-dashboard), [Processing Dashboard](#processing-dashboard), [Sales Dashboard](#sales-dashboard) |
| Review the month's financial reports after the month-end close | Monthly | [All Reports](#reports-catalogue) |
| Review who has access to what and the open segregation-of-duties conflicts | Quarterly, and before an audit | [User Access Matrix](#user-access-matrix), [Segregation of Duties](#segregation-of-duties) |
| Review the approval limits of the roles | Quarterly | [Authority Matrix](#authority-matrix) |
| Look up who changed a record and when | As needed | [Audit Trail](#audit-trail) |

## Procedures {#tis-general-manager-procedures}

### Decide the approvals in My Work {#tis-general-manager-my-work}

1. Choose **My Work**. The **Approvals** category lists the records waiting for your decision, with the due date, the
   client, the amount and the next action **Approve or reject**.
2. Select the arrow at the end of a row. The record opens on its approval screen.
3. Decide it there (see the procedures below). The item leaves My Work once decided.

![My Work of the TIS General Manager with a claim settlement to approve](images/role-tis-general-manager/my-work-approvals.png)

### Approve a claim settlement {#tis-general-manager-claim-settlement}

A claim settlement submitted by the TIS Operations roles is **Pending Approval**. The approver must be another user
than the one who submitted it, and the amount must be within the approver's limit on the Authority Matrix. The TIS
General Manager has no amount limit set as delivered (see [Approvals](#tis-general-manager-approvals)).

1. Open the settlement from My Work, or choose {{menu:/agent/claim}} and select the count **Settlement to approve**.
2. Check the policy, the insurer and the insurer claim number, the date and cause of loss, the estimate, the adjuster,
   the settlement type and the settlement amount.
3. Select **Approve settlement**, or **Return for correction** when the settlement must be revised.

An approved settlement settles the claim at once (**Settled**) and the user who submitted it is notified. A returned
settlement goes back to **Processing** for correction. See [Approve a settlement (checker)](#approve-a-settlement-checker).

![Claim settlement to approve: the claim's steps, the settlement amount and the decision](images/role-tis-general-manager/claim-settlement-approval.png)

### Approve the decisions of the front office {#tis-general-manager-front-office}

<!-- Screens to refresh: the Check against slip dialog is being redesigned in another stream. -->

The TIS General Manager holds the same front-office approvals as the TIS Sales Officer, the TIS Sales Unit Head and the
TIS Operations Unit Head, and decides them the same way:

- **Check of an e-policy against the placement slip**: see
  [Check an e-policy against the placement slip](#tis-sales-officer-epolicy-check).
- **Renewal terms**: see [Approve renewal terms](#tis-sales-officer-renewal-approval). The terms waiting for approval
  are on {{menu:/renewal/negotiations}} (count **Pending approval**).
- **Return premiums and cancellations**: see [Complete a return of premium](#tis-sales-officer-returns).

An underwriting referral of a quotation is decided by the TIS Operations Unit Head, not by the TIS General Manager.

### Approve a supplier invoice {#tis-general-manager-supplier-invoice}

<!-- Screens to refresh: the supplier invoice pop-up is being redesigned in another stream. -->

1. Choose {{menu:/accounts/payables/invoices}} and select the status **For approval**.
2. Open the invoice and check the supplier, the invoice number and date, the lines, the input VAT, the expanded
   withholding tax and the amount payable.
3. Select **Approve and post**, or **Reject invoice** with the reason.

On approval the AP journal is posted and the invoice becomes payable. You cannot approve an invoice you prepared. See
[Accounts payable](#accounts-payable).

### Review the business on the dashboards {#tis-general-manager-dashboards}

1. Choose {{menu:/executive/dashboard}}.
2. Choose the period (for example **This month**) and the comparison (**Previous period**). **Data as of** shows when
   the figures were computed; the refresh icon computes them again.
3. Read the cards: total revenue and new business against their targets, active policies, the claims rate, the
   retention rate, the premium receivable with its overdue part, and the commission receivable. Select a card's arrow
   to open the records behind it.
4. Scroll down for premium written by month, revenue by product line, claims by stage, the regional performance and
   the top products and sales performance.
5. Select **Export Report** to save the dashboard.

Choose another dashboard in the first list, or on the side bar: Claims Dashboard, Processing Dashboard, Sales
Dashboard. See [Dashboard](#dashboard).

![Dashboard > Executive Dashboard for the current month, compared with the previous period](images/role-tis-general-manager/executive-dashboard.png)

### Review access and segregation of duties {#tis-general-manager-access-review}

You review access; changes are made and approved by TIS IT AppSupport / Admin.

1. Choose {{menu:/master/generals/usermanagement/access-matrix}}. The cards count the active and dormant users, the
   duty conflicts without an accepted exception, the users without two-step sign-in and the changes pending.
2. Filter by department or role. Each user shows the roles held, the branch, the status, the last sign-in, two-step
   sign-in, the password age and the segregation-of-duties rules the user breaks.
3. Select **Export to Excel** to keep the review with its date.
4. Choose {{menu:/master/generals/usermanagement/segregation-of-duties}} to see each conflict with the roles behind
   it, its rule and whether an exception was accepted.
5. Choose {{menu:/master/generals/usermanagement/authority-matrix}} to see the largest amount each role may approve
   per transaction. A limit shown as **Not set** means the role may approve any amount.
6. Ask TIS IT AppSupport / Admin to correct what you find: remove a role, end a user, set a limit.

See [User Access Matrix](#user-access-matrix), [Segregation of Duties](#segregation-of-duties) and
[Authority Matrix](#authority-matrix).

### Look up a change in the audit trail {#tis-general-manager-audit-trail}

1. Choose {{menu:/master/configuration/audit-trail}}.
2. Filter by user, record type or action. Each line shows the date and time, the user and role, the record, the event,
   the fields changed and the source (for example **Sign-in**).
3. Select **Export** to keep the result.

See [Audit Trail](#audit-trail).
