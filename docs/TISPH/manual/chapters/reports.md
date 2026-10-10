<!--
Owner: see WRITER_GUIDE.md. The report menus of TISPH, the reports each department uses, and the Report Builder.
-->
# Reports {#reports}

Reports open from the Reports menu. Each role sees the reports of its department, and a report shows only the records
the role may read.

## All Reports and the report menus {#reports-catalogue}

{{screen:/reports/catalogue}}

{{screen:/reports/operationalreports/production}}

{{screen:/reports/financialreports/soapremiumreceivable}}

{{screen:/reports/financialreports/collectionreport}}

{{screen:/reports/operationalreports/claims}}

{{screen:/reports/operationalreports/renewal}}

{{screen:/reports/operationalreports/remittance}}

{{screen:/reports/operationalreports/brokercommision}}

{{screen:/reports/financialreports/Payables}}

{{screen:/reports/financialreports/journal}}

{{screen:/reports/financialreports/trailbalance}}

{{screen:/reports/financialreports/pe/income-statement}}

{{screen:/reports/financialreports/pe/balance-sheet}}

{{screen:/reports/financialreports/pe/trial-balance-ocm}}

{{screen:/reports/financialreports/pe/gl-detail}}

{{screen:/reports/financialreports/pe/aged-payables-insurers}}

{{screen:/reports/financialreports/pe/month-end-close-status}}

{{screen:/reports/financialreports/coinsuranceregister}}

{{screen:/reports/financialreports/duetoinsurers}}

Reports > All Reports shows the reports your role may run, as cards grouped under **Operational Reports** and **Financial Reports**, each with its description. The search box finds a report by name. The same reports open from the menus **Reports > Operational Reports** and **Reports > Financial Reports**; the bank reconciliation and BIR reports also open from their Accounts menus.

![Reports > All Reports, as TIS Operations Officer sees it](images/reports/all-reports.png)

### Run a report {#reports-run}

1. Choose {{menu:/reports/catalogue}} and select the report (or choose it from the report menu).
2. In **Report Criteria**, choose how the report is grouped or which part it shows, for example **Overall**, by **Agent**, **Branch** or **Principal Insurer**; **Summary** or **Detailed**; **Open**, **Partial**, **Settled**, **Rejected**, **Cancelled**, **Aging** or by **Claim Type** for the claims reports.
3. Enter **From Date** and **To Date** (required). Most reports take the records of the period; the ageing and balance reports are computed as of the **To Date**.
4. Narrow the report with the other filters if needed: **Agent**, **Branch**, **Client**, **Status**, **Company (principal insurer)**, **Product**, **Bank Account**, **GL Account**. A filter marked "Used with criteria" applies only with the criteria of that name.
5. Choose the **File format**: **CSV**, **Excel (XLSX)** or **PDF**.
6. Select **Preview** to see the rows on screen, or **Generate** to download the file.

The PDF and Excel files are printed in the layout of [Documents and Reports Layout](#documents-and-reports-layout), with the letterhead of Toyota Insurance Services Philippines. Amounts are in pesos.

![Reports > Operational Reports > Production Register: the criteria of a report](images/reports/production-register.png)

### Export and keep a report {#reports-export}

- **Excel (XLSX)** keeps the columns as numbers and dates, for further analysis.
- **CSV** is the format to load into another system, and the format of the BIR alphalists from which the [BIR DAT files](#bir-dat-files) are prepared.
- **PDF** is the format to file or send.

Every list screen of the system also has its own export (**Export**, **Export to Excel**, **Generate Report**) for the rows it shows with the filters chosen.

There is no scheduled or e-mailed report in the TISPH menus: run the reports when you need them, for example at the month-end close.

### The reports of each department {#reports-by-department}

**Sales** (TIS Sales Associate, TIS Sales Officer, TIS Sales Unit Head):

| Report | Contents |
|---|---|
| **Production Register** | Policies incepted in the period with premium, commission and the new business or renewal flag; grouped by agent, insurer or branch |
| **Lead Conversion Funnel** | Prospects created in the period by stage, with the share and the overall conversion rate |
| **Placement Pipeline** | Requests for quotation and placement slips created in the period with status, lead insurer, sum insured, premium and age |
| **Market Response** | Insurers approached on requests for quotation: offers, declines, pending, response rate, average response days and hit ratio |
| **Dealer Production** | Prospects, quotations and policies brought by each dealer, financing bank and affinity partner, with premium and commission, rolled up to the dealer group |
| **Renewal Retention** | Renewals due in the period with their outcome (retained, lost, pending), old and new premium and the retention rate |
| **New Business vs Renewals** | Policies and premium split into new business and renewals per month (or per agent) |
| **Premium by Product / Month / Insurer** | Policy count, sum insured, premium and commission by month, product or insurer |
| **SOA / Premium Receivable**, **Receivables Ageing** | The premium bills with their balance and ageing |
| **Incentive Results** | The incentive programme results: target, achieved, achievement and payout per agent |

**Operations** (TIS Operations Associate, TIS Operations Officer, TIS Operations Unit Head): the operational reports above, and

| Report | Contents |
|---|---|
| **Claims Position** | Claims reported in the period with claim type, line, estimate, approved and settled amounts, settlement date, age and ageing bucket; filter by insurer, product, agent, branch or client |
| **Claims Ageing** | Open claims by ageing bucket (optionally per insurer or agent) with estimate and approved amounts |
| **Co-insurance Register** | Co-insured policies incepted in the period: each participating insurer with its role, share, premium, commission, premium taxes and premium due |
| **Remittance Summary**, **Broker Commission Statement** | The remittances and the commission of the period, for information |

**Cash Control** (CCD-PDU (Post-Dated Cheques), CCD-PDC / CCD-ADA, CCD-BP / QRPh (Receipting), CCD-Recon (Reconciliation and Reversals)):

| Report | Contents |
|---|---|
| **SOA / Premium Receivable** | The statement of account: premium bills issued in the period with amount, paid, balance, age and ageing bucket as of the To Date |
| **Collection Report** | Bills due in the period with the amount billed, collected (receipts posted up to the To Date), balance and collection rate |
| **Receivables Ageing** | Outstanding premium receivables as of the To Date by ageing bucket |
| **Receipts Register** | Official receipts of the period with bill, policy, payment mode, bank and reference |
| **Bank Reconciliation Statement**, **Outstanding Cheques**, **Deposits in Transit**, **Unmatched Bank Lines**, **Bank Book** | The bank reconciliation reports; see [Bank reconciliation](#bank-reconciliation) |
| **Remittance Summary** | Premium remittances to insurers in the period: gross premium, commission retained and net due, by status |

**Finance and Accounting** (TIS Finance & General Accounting):

| Report | Contents |
|---|---|
| **Remittance Summary**, **Due to Insurers by Co-insurer**, **Aged Payables to Insurers** | The premium due to each insurer: collected, remitted and still held; the open payables aged |
| **Broker Commission Statement**, **Commission Receivable – Direct Bill** | The commission payable to agents and referrers; the commission due from insurers on direct-bill policies |
| **Payables / Disbursement Register** | Payment vouchers raised in the period with approval and payment dates |
| **Journal Register**, **General Ledger Detail** | Journal lines of the period; every movement of an account with its running balance |
| **Trial Balance**, **Trial Balance (Opening / Movement / Closing)** | Per account: opening balance, period debits and credits, closing balance |
| **Income Statement**, **Balance Sheet** | The financial statements for the period and the fiscal year to date, with the prior year |
| **Month-End Close Status** | The periods of the range with their status, the latest close run, failed checks, journals generated and who prepared and approved the close |
| **VAT Summary**, **SAWT**, **QAP**, **SLSP Sales**, **SLSP Purchases** | The BIR working papers; see [Tax: BIR forms and returns](#tax-bir-forms-and-returns) |
| Bank reconciliation reports | As for Cash Control |

**Management** (TIS General Manager): every report of the departments above.

The roles that open each report menu, with their access, are listed at the top of this section and in each role chapter.

## Report Builder {#report-builder}

{{screen:/reports/builder}}

The Report Builder makes a report of your own from a dataset: pick the columns, filters and grouping, run it on screen, export it to Excel, and save it for yourself or share it with roles.

1. Choose {{menu:/reports/builder}}. On the **Build** tab, choose a **Dataset**. A dataset shows only the records your role may read.
2. In **Columns**, choose the columns to show.
3. In **Group by**, choose a column to group on: the numeric columns chosen are summed per group. In **Sort by**, choose the sort column and **Ascending** or descending.
4. Select **Add filter** for each condition.
5. Select **Run** to see the result on screen, or **Export to Excel**.
6. Save the report: give it a name and a description, and keep it private or share it with one or more roles.

The tab **Saved reports** lists the reports you may open: your own and those shared with one of your roles, with **Name**, **Dataset**, **Description**, **Owner**, **Shared with** and **Last run**. Open one to run it again or change it.

![Reports > Report Builder](images/reports/report-builder.png)
