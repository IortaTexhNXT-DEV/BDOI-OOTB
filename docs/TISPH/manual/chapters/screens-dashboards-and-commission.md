<!--
Owner: see WRITER_GUIDE.md. Screen reference: the Dashboard menu and the Commission menu, in menu order.
-->
# Screen reference: Dashboards and Commission {#screens-dashboards-and-commission}

The dashboards and the Commission menu.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role.

All dashboards work the same way:

- The selector at the top left switches to another dashboard of your role; the period selector (**This month**, **This year**, a custom range) and the comparison (**Previous period**) set the figures. **Data as of** shows when the figures were read (Asia/Manila time); the refresh button reads them again.
- Each card shows a value, the change against the comparison period and, where a target is set, the target and the status (**On target**, **Off target**). The arrow on a card opens the list behind it.
- Each chart has **Chart** and **Table** views and a download button. **Export Report** downloads the whole dashboard.
- A dashboard shows only the records your role may read.

## Dashboard {#dashboard}

Dashboard > Executive Dashboard is the management view of the business of Toyota Insurance Services Philippines.

{{screen:/executive/dashboard}}

The cards show **Total Revenue** and **New Business** against their targets, **Active Policies**, **Claims Rate**, **Retention Rate**, **Premium receivable** (with the overdue amount) and **Commission receivable** (unbilled and overdue). The charts are **Premium written by month** (last 12 months), **Revenue by Product Line**, **Claims Status Distribution**, **Regional Performance** (premium, policies, growth and market share by region) and **Top Performing Products** (premium, policies and claim ratio).

![Dashboard > Executive Dashboard](images/screens-dashboards-and-commission/executive-dashboard.png)

## Claims Dashboard {#claims-dashboard}

Dashboard > Claims Dashboard follows the claims handled by Operations.

{{screen:/claims/dashboard}}

The cards show **Claims reported** (and those reported today), **Total Open Claims**, **Claims Overdue** (past their due date), **Estimated amount** and **Settled amount**. The charts are **Claims Trend Analysis** (claims submitted, approved and rejected by month reported), **Claims by line of business**, **Ageing of open claims** (days since reported), **Claims by stage** and **Claims by Province**. **Recent Claims** lists the latest claims; select one to open it on [The claims list](#the-claims-list).

![Dashboard > Claims Dashboard](images/screens-dashboards-and-commission/claims-dashboard.png)

## Processing Dashboard {#processing-dashboard}

Dashboard > Processing Dashboard (the **Processing Workbench**) shows the quotations and placements in flight with Operations.

{{screen:/processing/dashboard}}

The cards show **Newly Received Submissions** (updated in the last 7 days), **Older Submissions** (not updated for more than 7 days: follow them up), **Avg. Cycle Time** (from entry to approval or acceptance), **Unassigned** and **Open Alerts** (duplicates, missing dates, missing line of business). The charts are **Workload Metrics** (submissions per account executive, by stage), **In Progress vs Overdue Tasks** and **Volume by LOB In-flight**. The **Submissions List** shows each quotation with the proposed insured, account executive, sum insured, product, next requirement due, priority and status. **New Submission** starts a quotation.

## Sales Dashboard {#sales-dashboard}

Dashboard > Sales Dashboard shows the sales results of the period, for all sales persons or one.

{{screen:/sales/dashboard}}

The cards show **New prospects**, **Quotations** (and the amount quoted), **Conversion** (quotation to policy), **Policies issued**, **Premium** and **Open pipeline** (open quotations). The charts are **Premium by month**, **Prospects and quotations by month** and **Premium by product**. The tables **Prospect pipeline** and **Quotation pipeline** count the prospects and quotations by status, and **By sales person** shows each account executive's prospects, quotations, policies issued, premium and conversion. **View prospects** opens [Prospects](#prospects).

![Dashboard > Sales Dashboard](images/screens-dashboards-and-commission/sales-dashboard.png)

## Commission to agents and referrers {#commission-to-agents-and-referrers}

The list shows every referrer with **TYPE** (Agent, Sub-agent, External), **LEVEL**, **POLICIES**, **NET PAYABLE (OPEN)**, **WHT TYPE** (Individual 5% or Company 10%), **BANK ACCOUNT** and **STATUS**. The header shows **Due this cycle** and **Ready to pay**.

{{screen:/commission/dashboard}}

{{screen:/commission/referrer-accounts}}

The commission paid by TISPH to an agent, sub-agent or external referrer (for example a dealer) on a policy it brought in is computed when the policy is booked, from the commission details of the quotation. Each commission line goes through four statuses:

| Status | Meaning | What the system does |
|---|---|---|
| **Accrued** | The policy is booked | Nothing is posted yet |
| **Eligible** | The client's premium is fully collected | |
| **Approved** | Approved by a user other than the one who prepared it | Posts the accrual: commission expense against commission payable |
| **Paid** | Paid on a payment voucher | Posts the payment: commission payable against cash and withholding tax payable |

A commission line reversed after payment (for example on a cancellation that returns premium) is clawed back from the referrer.

**Commission > Commission Dashboard** has the views **Accounting** and **Management**. The cards show **Brokerage income**, **Comsub (gross)** (the commission due to referrers), **Net margin**, **Outstanding payable** (eligible and approved, net of withholding tax), **WHT withheld (paid)** and **Clawed back**. The charts show the monthly trend of income, payable and margin, the commission by referrer and by product, the payable by status (**Accrued**, **Eligible**, **Approved**, **Paid**) and the brokerage income by insurer.

![Commission > Commission Dashboard](images/screens-dashboards-and-commission/commission-dashboard.png)

**Commission > Agents/Referrer Accounts** lists the referrers. To pay a referrer:

1. Choose {{menu:/commission/referrer-accounts}} and select the referrer. The account shows the lines of the current cycle, the future cycles and the past lines.
2. Mark as eligible the accrued lines whose premium is fully collected.
3. Approve the eligible lines. The approval is made by {{roles:write:commission}} other than the user who prepared the lines.
4. Select the approved lines and generate the payout. The payment voucher is prepared on [Disbursement](#disbursement-payment-vouchers-and-cheques) with the withholding tax of the referrer (5% for an individual, 10% for a company, or the referrer's own tax code), and is approved and paid there.

A new referrer is added with its type, level, tax details and bank account; the withholding tax can be switched off for a referrer, which recomputes its unpaid lines.

![Commission > Agents/Referrer Accounts](images/screens-dashboards-and-commission/referrer-accounts.png)

## Overriding, profit and contingent commission from insurers {#overriding-profit-and-contingent-commission-from-insurers}

{{screen:/commission/insurer-overrides/agreements}}

{{screen:/commission/insurer-overrides/computations}}

Some insurers pay TISPH a commission on top of the policy commission: an overriding commission on the production volume, a profit commission on the loss ratio, or a contingent commission on growth.

**Commission > Insurer Overrides > Agreements** holds the agreement with each insurer: **Agreement code**, **Name**, **Insurer**, **Type** (**Overriding**, **Profit**, contingent), **Basis** (**Production volume**, **Loss ratio**, growth), **Period** (**Quarterly**, **Annual**), the lines of business, the **Tiers** (for example 0 to 40% loss ratio: 5%) and **Effective from**. **New agreement** adds one; the pencil changes it.

![Commission > Insurer Overrides > Agreements](images/screens-dashboards-and-commission/override-agreements.png)

**Commission > Insurer Overrides > Computations** computes the commission of an agreement for a period:

1. Choose the agreement and the year.
2. In the row of the period, select **Compute**. The system takes the production and the claims of the period and applies the tier reached.
3. The computation is approved by another user: the receivable from the insurer is then booked.
4. Invoice the insurer and settle the receivable when the insurer pays or offsets it.

The cards show the **Computations**, **Commission**, **Receivable** and **Balance**; **Excel** downloads the list.
