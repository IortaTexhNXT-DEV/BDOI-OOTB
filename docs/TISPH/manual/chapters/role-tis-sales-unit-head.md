<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-sales-unit-head.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.sales-unit-head.
Screens to refresh (redesign in another stream, described as on this build): tis-sales-unit-head-incentive-approval
(batch pop-up), tis-sales-unit-head-supplier-invoices (invoice pop-up).
-->
# TIS Sales Unit Head {#tis-sales-unit-head}

## Role summary {#tis-sales-unit-head-summary}

{{role-summary:tis-sales-unit-head}}

The TIS Sales Unit Head heads the sales unit. You have every right of the TIS Sales Officer (the sales work, lead
assignment, campaigns and the checker's decisions of the sales chain) and, in addition, you run and approve the
telesales incentives of the sales force and approve the supplier invoices of the unit before they are posted.

You work with the TIS Sales Officers and TIS Sales Associates of the unit, with the TIS Operations Unit Head on the
renewals escalated to you, and with TIS Finance & General Accounting, who records the supplier invoices you approve
and pays them. You never decide a record you entered yourself.

{{include:generated/roles/tis-sales-unit-head.md}}

## Daily and periodic tasks {#tis-sales-unit-head-tasks}

| Task | When | Screen |
|---|---|---|
| Work through the approvals and the records waiting for you | Every morning and through the day | [My Work](#my-work) |
| Approve or return the renewal terms submitted by the unit | Daily | [Negotiations](#negotiations) |
| Check the e-policies received against their placement slips | Daily | [Placement Slips](#placement-slips) |
| Follow up the renewals escalated to you | As notified | [At-Risk Policies](#renewal-queue-and-at-risk-policies) |
| Approve or reject the supplier invoices recorded by Finance | As notified | [Payables](#accounts-payable) |
| Review the unit's pipeline, conversion and premium | Weekly | [Sales Dashboard](#sales-dashboard) |
| Review the team assignment and the reassignment queue | Weekly | [Lead Assignment](#lead-assignment) |
| Run the incentive calculation of the month and submit it | Month-end, after the month's policies are booked | [Incentive](#incentives) |
| Approve or reject the incentive calculation submitted by another user | Month-end | [Incentive](#incentives) |
| Mark the approved incentives as paid | When paid | [Incentive](#incentives) |
| Run the incentive and production reports | Month-end | [Incentive](#incentives), [All Reports](#reports-catalogue) |

The sales work, lead assignment, campaigns, the check of the e-policies and the approval of renewal terms follow the
procedures of the [TIS Sales Associate](#tis-sales-associate-procedures) and the
[TIS Sales Officer](#tis-sales-officer-procedures).

## Procedures {#tis-sales-unit-head-procedures}

### Review the unit's performance {#tis-sales-unit-head-dashboard}

1. Choose {{menu:/sales/dashboard}}.
2. Choose the period (for example **This month**) and the comparison (**Previous period**), or a custom range. In
   **All sales persons**, choose one account executive to see their figures.
3. Read the cards: new prospects, quotations and the amount quoted, the conversion from quotation to policy, the
   policies issued, the premium and the open pipeline. Select a card's arrow to open the records behind it.
4. Below the cards, the charts show the premium and the prospects and quotations by month over the last 12 months.
   **Table** shows the figures of a chart; the download icon exports them.

![Dashboard > Sales Dashboard of the TIS Sales Unit Head for the current month](images/role-tis-sales-unit-head/sales-dashboard.png)

### Follow an escalated renewal {#tis-sales-unit-head-escalation}

An account executive escalates an at-risk renewal from At-Risk Policies. The escalation goes to the account
executive's manager (the reporting line of the user); when the account executive reports to no one, it goes to the
TIS Sales Unit Head and the TIS Operations Unit Head. You receive the notification "Renewal ... escalated".

1. Open the notification. At-Risk Policies opens.
2. Check the risk factors of the renewal (premium increase, claims, unpaid premium, no contact, expiry) and the
   suggested actions.
3. Agree the next step with the account executive and record it on the renewal timeline on
   [Negotiations](#negotiations).

### Run the incentive calculation {#tis-sales-unit-head-incentive-run}

<!-- Screens to refresh: the calculation batch pop-up is being redesigned in another stream. -->

The incentive programmes give the sales force (TIS Sales Associates, Sales Officers and Sales Unit Heads) a payout by
the tier their achievement reaches. A program is calculated once per calculation period (month, quarter, half or year);
a quarterly program is run in the last month of its quarter.

1. Choose {{menu:/incentive/calculations}} and select **New Calculation**.
2. Choose the month and the programs to calculate. The system computes each account executive's achievement over the
   program's period and the payout of the tier reached. A run with no agent line is refused.
3. Open the batch (**View Details**) and check the agent lines. Select **Adjust** on a line to change its payout: the
   adjustment takes a reason of the reason list and a note, and the user who adjusted it is kept.
4. Select **Submit for approval**. The batch is **Pending Approval**.

![Accounts > Incentive > Calculations, the monthly batches with their payout, the user who calculated them and their status](images/role-tis-sales-unit-head/incentive-calculations.png)

### Approve an incentive calculation {#tis-sales-unit-head-incentive-approval}

<!-- Screens to refresh: the calculation batch pop-up is being redesigned in another stream. -->

A batch is approved or rejected by a user other than the one who ran it, adjusted its lines or submitted it. The
batches waiting for you are also listed in My Work.

1. Choose {{menu:/incentive/approvals}}. The board shows the batches pending approval, the pending amount and how long
   each has been waiting.
2. Select **View Details** on the batch. Check the period, the programs, the total payout and the agent results
   (achievement, tier, adjustment and payout of each account executive).
3. Select **Approve batch**, or **Reject** and give the reason of the rejection.

The approval posts the incentive accrual. The batch is then **Approved**; when the incentives have been paid, open the
batch on Calculations and select **Mark as paid**, which posts the payment.

> Only the TIS Sales Unit Head runs and approves incentive calculations, and never the same batch: one Sales Unit Head
> runs and submits the batch, another approves it.

Each account executive follows their own progress on {{menu:/incentive/my-programs}} and their earnings and payments
on {{menu:/incentive/statement}}.


### Approve a supplier invoice {#tis-sales-unit-head-supplier-invoice}

<!-- Screens to refresh: the supplier invoice pop-up is being redesigned in another stream. -->

Supplier invoices are recorded by TIS Finance & General Accounting and sent for approval. You receive a notification
for each invoice sent for approval. You cannot approve an invoice you prepared.

1. Choose {{menu:/accounts/payables/invoices}} and select the status **For approval**.
2. Open the invoice. Check the supplier, the supplier's invoice number and date, the lines, the input VAT, the
   expanded withholding tax and the amount payable.
3. Select **Approve and post**, or **Reject invoice** with the reason.

On approval the AP journal is posted and the invoice becomes payable to the supplier; a rejected invoice returns to
the preparer with your reason. See [Accounts payable](#accounts-payable).
