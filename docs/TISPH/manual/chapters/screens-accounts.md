<!--
Owner: see WRITER_GUIDE.md. Screen reference: one section per screen of the Accounts menu, in menu order.
Screens to refresh (redesign in another stream, described as on this build): remittance-to-insurers and
direct-bill-commission-debit-notes (remittance screens), verify-payments-and-post-official-receipts and
post-dated-cheques (pop-ups), disbursement-payment-vouchers-and-cheques and bank-payment-files (payment pop-ups).
-->
# Screen reference: Accounts {#screens-accounts}

The screens of the Accounts menu, in menu order: receipts and collections, Cash Control, disbursements and payables, remittance to insurers, journal vouchers, reconciliations, tax, period end and incentives.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role. Every amount is in pesos; every posting goes to the general ledger through the posting rules of [Posting configuration](#posting-configuration-configuration-approvals-posting-rules-account-determination), and each document can be traced to its journal on [Accounting Query](#accounting-query-and-all-clients-accounting).

## Verify payments and post official receipts {#verify-payments-and-post-official-receipts}

When Operations or Sales record a client payment, the policy payment status becomes Reviewing and Accounting receives the notification to verify it. Open the notification, check the payment against the bank statement and confirm it (the official receipt is posted) or reject it with a reason. Accounting users can also record a payment and issue the receipt directly from the policy.

{{screen:/accounts/receipts}}

The list (**Receipts history**) shows **Receipt Number** (OR-YYYY-NNNNN), **Transaction Code**, **Transaction Number** (RT-YYYY-NNNNN), **Policy Number**, **Name**, **Customer Code**, **Date**, **Amount**, **Paid**, **UnPaid**, **Status**, **Payments** and **Action**. **Search by** chooses the column searched. The buttons are **Bulk Print** (receipts of a period as one PDF), **Bulk Upload** (bills payment and QRPh settlement files: each row pays a policy; the file is validated before anything is posted) and **Receipt**.

![Accounts > Receipts](images/screens-accounts/receipts-list.png)

To issue an official receipt, select **Receipt**:

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Receipt Date** | Yes | Today's date is proposed | Must fall in an open period |
| **Receipt Number** | | Issued by the system on save | From the official receipt series |
| **Receipt Type** | Yes | **Payment** | |
| **Branch Code**, **Department Code** | No | The branch and department of the receipt | |
| **Customer Code** | Yes | The client | **Customer Name** is filled in |
| **Policy Number** | Yes | The policy paid | Only the client's policies with an open bill |
| **Currency Code** | Yes | **PHP** | |
| **Transaction Code** | Yes | **OR – Official Receipt** | |
| **Receipt Mode** | Yes | **Dollar/Peso** (cash), **Cheque**, **Managers Check/Demand Draft**, **Direct Credit/Transfer to Account**, **Telegraphic Transfer**, **Authority to Debit**, **Online Banking** or **Credit Ticket-Inter Office** | A cheque asks for the cheque details; the mode gives the bank account debited |
| **Remarks** | No | | |

Select **Record payment**. The system issues the receipt number, posts the payment (cash in the bank account of the receipt mode against the premium receivable) and reduces the bill. When the bill is fully paid the policy's payment becomes **Completed**. Print the receipt or e-mail it to the client. A receipt issued in error is cancelled with a reason by CCD-Recon (Reconciliation and Reversals): the journal is reversed and the bill is open again. See [Collection by Cash Control](#process-collection).

![Accounts > Receipts > Add Receipts](images/screens-accounts/add-receipts.png)

## Collections {#collections}

Accounts > Collections lists every open premium with **Client Name**, **Policy No.**, **Outstanding** spread over the ageing buckets (**Current**, **1-30 Days**, **31-60 Days**, **61-90 Days**, **Over 90 Days**), **Due Date**, **Status** (Pending, Committed, Overdue), **Days Overdue** and **View**. Filter by status and overdue level.

{{screen:/agent/collections}}

The cards show the **Outstanding** and **Overdue** amounts, the items **Committed** (the client gave a payment date) and **Escalated**, and the amount **Collected this month**. **Send Payment Reminders Now** e-mails the reminders of the overdue items at once; **Import open items** loads open premiums from a file.

Select **View** to open an item. **Collection Details** shows the client and policy, the overdue level, the financial breakdown of the bill (gross premium, net premium, VAT, DST, LGT, paid, outstanding), the ageing, the **Follow-Up History** and the **Payment History**. The **Collection Actions** are **Send Email**, **E-mail invoice**, **Add Note** and **Set Commitment Date**; **Record receipt** opens the receipt for this bill.

![Accounts > Collections, the open premiums by ageing bucket](images/screens-accounts/collections.png)

## Credit control {#credit-control}

{{screen:/accounts/credit-control/instalments}}

{{screen:/accounts/credit-control/warranty}}

{{screen:/accounts/credit-control/limits}}

{{screen:/accounts/credit-control/remittance-ageing}}

Changes on the Credit Control screens that need approval (a credit limit, a warranty extension) are approved by {{roles:approve:credit-control}}, a user other than the one who requested them.

- **Instalment Plans** lists the open instalments of policies paid by instalment, with **Policy no.**, **Client**, the instalment number, **Due date**, **Outstanding**, **Days past due** and **Ageing**, and the totals per ageing bucket. **Overdue only** narrows the list.
- **Premium Warranty Monitor** follows the premium payment warranty: the premium must be paid by the warranty deadline after inception, or the cover is at risk. The cards count the policies **Warranty breached** and **At risk** and the **Extensions to approve**. Each row shows the policy, client, insurer, **Inception**, **Warranty deadline**, **Days past deadline**, **Premium due** and **Status**. Request an extension from the row; the extension is approved by another user.
- **Client Credit Limits** shows each client's **Credit limit** (or **No limit**), **Open premium**, **Available** and **Last changed**. Set or change a client's limit from the row. **Issued over the limit** lists the policies booked over a client's limit.
- **Remittance Ageing** ages the premium collected and not yet remitted to each insurer, by the insurer's remittance terms (**Not yet due**, **1-30**, **31-60**, **61-90**, **Over 90**), with the detail by policy and receipt. **Excel** downloads it.

![Accounts > Credit Control > Premium Warranty Monitor](images/screens-accounts/premium-warranty-monitor.png)

## Post-dated cheques {#post-dated-cheques}

Accounts > Post-Dated Cheques is the register of cheques received from clients before their date.

{{screen:/accounts/post-dated-cheques}}

The cards show the cheques **On hand**, **Due for deposit** and **Bounced**. The tabs **Register cheque** and **Deposit due** (cheques due within three days) list **PDC no.** (PDC-YYYY-NNNNN), **Client**, **Bill / policy**, **Drawee bank**, **Cheque no.**, **Cheque date**, **Amount**, **Kept in**, **Status** and **Receipt**. **Export to Excel** downloads the list.

To register a cheque, select **Register cheque**:

| Field | Required | What to enter |
|---|---|---|
| **Against** | Yes | **Bill number** (or the policy) |
| **Reference** | Yes | The bill or policy number |
| **Drawee bank** | No | From the bank list, or **Drawee bank (if not in the list)** |
| **Cheque no.** | Yes | |
| **Cheque date** | Yes | The date on the cheque |
| **Amount** | Yes | |
| **Kept in** | No | Where the cheque is kept, for example "Finance vault, drawer 2" |
| **Remarks** | No | |

The cheque is **On Hand**. Nothing is posted until it is deposited. The actions of a cheque are:

- **Deposit**: choose the **Bank account** and the **Deposit date** and select **Deposit cheque**. An official receipt is created and posted to that bank account.
- **Replace**: register the new cheque that replaces this one (for example after a bounce).
- **Return**: give the cheque back to the client.
- **Cancel**: remove a cheque registered in error.

A cheque that bounces is recorded as bounced with the reason: its receipt is cancelled, the journal reversed and the bill is open again.

![Register cheque](images/screens-accounts/register-cheque.png)

![Deposit a post-dated cheque: the official receipt is posted to the bank account chosen](images/screens-accounts/deposit-cheque.png)

## Claims settlements paid through the broker {#claims-settlements-paid-through-the-broker}

{{screen:/accounts/claims-settlements}}

When an insurer pays a claim settlement to TIS for the claimant, the money is received and paid out here. The cards show the amounts **To receive from insurers**, **Held for claimants** and **Payable to claimants**. Each row shows **Claim**, **Policy**, **Claimant**, **Insurer**, **Settlement**, **Received**, **Paid**, **Payable to claimants** and **Status**; the filter shows the **Outstanding** settlements or all.

1. When the claim settlement is approved (see [Approve a settlement (checker)](#approve-a-settlement-checker)), it appears here as to be received.
2. When the insurer pays, open the claim and record the funds received and the bank account they were paid into. The money is held for the claimant.
3. Print the release and quitclaim for the claimant to sign.
4. Pay the settlement to the claimant. A claim payment voucher number is assigned and the voucher can be printed. The claim's **Payment** step is completed.

Each movement is posted to the ledger. Open a claim to see its cash position: the amounts from each insurer, to the claimant and the bank accounts used.

## Accounts payable {#accounts-payable}

Suppliers are kept on Accounts > Payables > Suppliers: TIN, address, VAT registration, the EWT tax code withheld (Master > Finance > Taxation, for example WC158 goods, WC160 services, WC100 rentals), payment terms and the default expense account.

{{screen:/accounts/payables/invoices}}

{{screen:/accounts/payables/payments}}

{{screen:/accounts/payables/ageing}}

{{screen:/accounts/payables/suppliers}}

**Suppliers**: **Add** opens the supplier form: **Code** and **Supplier** (required), **TIN**, **Registered Address**, **VAT Registered**, **EWT Tax Code**, **Payment Terms (days)**, **Default Expense Account**, **Contact Person**, **E-mail**, **Phone**, **Bank** and **Bank Account No.**

**Supplier Invoices** lists **AP voucher**, **Supplier**, **Supplier invoice no.**, **Invoice date**, **Due date**, **Gross**, **EWT**, **Balance** and **Status**. To record an invoice:

1. Select **New supplier invoice**.
2. Enter **Supplier**, **Supplier invoice no.** and **Invoice date** (required), the **Description** and the **EWT tax code** (the supplier's is proposed).
3. Add a line per expense: **Description**, **Account**, **Asset class** (for a fixed asset), **Vatable** and **Amount**. The total net of VAT is shown.
4. Select **Save draft**, or **Save and submit**.

The invoice is approved by {{roles:approve:payables}}, a user other than the one who submitted it, and is posted on approval: expense (or asset), input VAT, EWT payable and the payable to the supplier. A line with an asset class creates the asset on the [Asset Register](#fixed-assets-and-depreciation).

![New supplier invoice](images/screens-accounts/supplier-invoice-new.png)

**Supplier Payments** pays approved invoices: select **New supplier payment**, choose the **Supplier**, the **Date**, the **Payment mode** (for example **Cheque**), the **Bank account** (required), the **Cheque no.** and **Reference**, tick the invoices to pay and select **Pay**. The payment is posted and the invoices' balance reduced.

**AP Ageing** ages the open supplier invoices on their due dates (**Not due**, **1-30**, **31-60**, **61-90**, **Over 90**), by supplier and by invoice. **Export to Excel** downloads it.

## BIR Form 2307 for suppliers {#bir-form-2307-for-suppliers}

The expanded withholding tax withheld from a supplier on an approved supplier invoice (the supplier's EWT tax code, on the amount net of VAT) is creditable tax of the supplier: the broker issues BIR Form 2307 for it each quarter.

{{screen:/accounts/payables/2307}}

Choose the year and the quarter. The cards show the number of **Payees**, the **Income payments subject to expanded withholding tax** and the **Tax withheld for the quarter**. Each row is one supplier: **Payee's name**, **Taxpayer Identification Number (TIN)**, **ATC**, **Transactions**, the income payments, the tax withheld and the **Certificate no.** Print the certificate of a supplier from its row. The same figures are in the QAP of [Tax: BIR forms and returns](#tax-bir-forms-and-returns).

## Fixed assets and depreciation {#fixed-assets-and-depreciation}

{{screen:/accounts/fixed-assets/register}}

{{screen:/accounts/fixed-assets/depreciation}}

**Asset Register** lists the fixed assets with **Asset no.**, **Asset**, **Class**, **Location**, **In service**, **Cost**, **Accumulated depreciation**, **Book value** and **Status**, and the totals in the cards. Assets come from supplier invoice lines with an asset class, or are registered here with **Register asset**:

| Field | Required | What to enter |
|---|---|---|
| **Asset** | Yes | The description |
| **Class** | Yes | The asset class (for example **Computer equipment**), which gives the accounts and the default useful life |
| **Acquired** | Yes | The acquisition date |
| **In service** | No | The date depreciation starts |
| **Cost** | Yes | |
| **Salvage value**, **Useful life (months)** | No | Defaults from the class |
| **Serial no.**, **Location**, **Custodian** | No | |
| Accumulated depreciation brought forward, **First period depreciated here** | No | For an asset already partly depreciated before it was registered |

**Depreciation Run** computes the straight-line depreciation of the period and posts one journal per asset class. Check the assets due and the **Journal date**, then select **Post depreciation**. The run is also a step of the month-end close.

![Accounts > Fixed Assets > Depreciation Run](images/screens-accounts/depreciation-run.png)

## Asset disposal {#asset-disposal}

An asset sold or written off (lost, stolen, damaged beyond repair, obsolete) leaves the register through a disposal.

{{screen:/accounts/fixed-assets/disposals}}

The cards show the number of **Disposals**, the **Cost**, the **Book value**, the **Selling price (net of VAT)** with the output VAT, and the **Gain on disposal** and **Loss on disposal**. Each row shows **Disposal no.**, **Disposal date**, the kind of disposal, **Asset**, **Buyer**, **Book value**, **Selling price (net of VAT)**, **Output VAT**, **Gain / (loss)**, **Sales invoice**, **Journal** and **Status**.

A disposal is started from the asset on the Asset Register: choose sale or write-off and the reason, the date, and for a sale the buyer and the selling price. On posting, the cost and accumulated depreciation are removed, the proceeds and output VAT are recorded (a sale issues a sales invoice) and the gain or loss is booked.

## Disbursement: payment vouchers and cheques {#disbursement-payment-vouchers-and-cheques}

A payment voucher (PV-YYYY-NNNNN, with the disbursement transaction DT-YYYY-NNNNN) pays an insurer, an agent or referrer, a client or a supplier.

{{screen:/accounts/paymentvoucher}}

The list (**Disbursement history**) shows **Disbursement Number**, **Transaction Number**, **Customer Code**, **Disbursement Date**, **Amount**, **Status** (**Draft**, **Approved**, **Paid**) and **Action**. The buttons are **Bulk Print**, **Bulk Upload**, **Bulk Disburse** (one voucher per referrer with approved commission) and **Create**.

![Accounts > Disbursement](images/screens-accounts/disbursement-list.png)

To create a payment voucher, select **Create**:

1. Enter the **Disbursement Date**, **Department Code** and **Branch Code**.
2. Choose the **Payee Type** (insurer, agent or referrer, client, supplier) and the **Criteria**, then the payee (**Customer Code**, **Customer Name**) and, if the payment is for one policy, the **Policy Number**.
3. Choose the **Transaction Type**, enter the **Payment Description**, the **Payment Currency** and any **Payment Notes**. Select **Next**.
4. Enter the amounts and the accounts debited, and the withholding tax where it applies.
5. Choose the bank account and the payment method (cheque, bank transfer or bank payment file) and save.

The voucher is approved by a user other than the one who prepared it, within his or her limit of the [Authority Matrix](#authority-matrix). An approved voucher is paid by cheque (the cheque number and release are recorded) or by a [bank payment file](#bank-payment-files); on payment the journal is posted and the voucher becomes **Paid**.

![Create Disbursement](images/screens-accounts/create-disbursement.png)

## Bank payment files {#bank-payment-files}

{{screen:/accounts/bank-payment-files}}

Bank Payment Files pays approved payment vouchers through the bank's upload file. The list shows **Batch**, **Layout**, **Value date**, **Payments**, **Amount**, **Status** and **Created**.

1. Select **New batch**.
2. Choose the **Layout** of the bank (see [Bank file layouts and payee bank accounts](#bank-file-layouts-and-payee-bank-accounts)), the account to **Pay from**, the **Channel** (for example **PESONet**) and the **Value date**.
3. Tick the payment vouchers waiting for payment and enter **Remarks**.
4. Select **Create batch**.

The batch is approved by another user, the file is downloaded for the bank portal, and the bank's result file is loaded back: each payment it confirms is posted and its voucher becomes **Paid**; a rejected payment returns to the vouchers waiting for payment.

![New batch of a bank payment file](images/screens-accounts/bank-payment-batch.png)

## Remittance to insurers {#remittance-to-insurers}

For broker-billed policies Accounting remits the collected premium, net of the broker's commission, to each insurer by its share.

{{screen:/finance/remittance/automated/execute}}

{{screen:/finance/remittance/tracking/status}}

{{screen:/finance/remittance/statements/generate}}

{{screen:/finance/remittance/settlement/process}}

{{screen:/finance/remittance/reconciliation}}

{{screen:/finance/remittance/bulkprocessing}}

{{screen:/finance/remittance/scheduling}}

{{screen:/finance/remittance/electronictransfer}}

{{screen:/finance/remittance/approval}}

{{screen:/finance/remittance/exceptions}}

{{screen:/finance/remittance/agencybill}}

{{screen:/finance/remittance/adjustments}}

{{screen:/finance/remittance/notifications}}

{{screen:/finance/remittance/history}}

{{screen:/finance/remittance/analytics}}

The remittance screens are prepared by {{roles:write:remittance}}. A remittance (REM-YYYY-NNNNN) groups the collected premiums of one insurer; it is **Draft** until submitted, **Pending Approval** until a user other than the preparer approves it within his or her limit, then **Approved**, and **Completed** once paid.

| Screen | What it is for |
|---|---|
| **Automated Processing** | The scheduled remittances of each insurer for the current date, with the policies and estimated amount. Select the remittances, choose the **Processing Date** and options, **Validate** and **Process Selected**, or **Schedule for Later**. |
| **Tracking** | Every remittance with **Remittance No**, **Date**, **Insurer Code**, **Insurer Name**, **Policies**, **Gross Amount**, **Commission**, **Net Amount** and **Status**, filtered by number, insurer, date and status. The row actions open, submit and print the remittance and its advice to the insurer. |
| **Statements** | The remittance statement for one or more insurers and a period, in three steps: **Selection**, **Preview**, **Generate**. |
| **Settlement** | An insurer settlement: choose the insurer and period, **Add policies** (or **Import**) and **Calculate** the premium, commission, tax and net settlement; **Save draft** or **Submit for approval**. |
| **Reconciliation** | Matching of the bank transactions of the remittances with the remittances recorded: **Auto Match**, **Match Selected** or **Force Match**, with the **Exceptions** and **History**. |
| **Bulk Processing** | Remittances from a file in four steps: **Upload File**, **Validate**, **Process**, **Complete** (**Download template** first). |
| **Scheduling** | The remittance schedules: the insurers to remit, the cut-off, the frequency and the next run. **New schedule** and **Run now**. |
| **Electronic Transfer** | The transfers to insurers by PESONet, InstaPay, RTGS or wire, with their approval and status. |
| **Approval Workflow** | The remittances, transfers and adjustments waiting for approval, with the SLA. Approve or reject each one; the limits come from the [Authority Matrix](#authority-matrix) and cover for an absent approver from [Delegations](#delegations). |
| **Exception Management** | The exceptions found (amount mismatch, duplicate entry, missing document, date discrepancy), assigned to a user and resolved. |
| **Agency Bill Processing** | The bills of the agencies for a period: **Load agencies**, check the totals, **Validate** and **Process bills**. |
| **Adjustments** | Premium or commission adjustments of a remittance (**New Adjustment**), approved by another user. |
| **Notifications** | The messages sent to insurers about remittances, and their templates. |
| **History** | Every remittance transaction with its versions and audit trail; **Export History**. |
| **Analytics** | Settlement efficiency, payment success rate, average processing time and exception rate against their targets, with the trends. |

![Accounts > Remittance > Tracking](images/screens-accounts/remittance-tracking.png)

See [Remittance to the insurers](#process-remittance) for the order of the steps at TISPH.

## Direct bill: commission debit notes {#direct-bill-commission-debit-notes}

{{screen:/finance/remittance/directbill}}

For a direct-bill policy the client pays the insurer, and TIS bills the insurer for its commission with a debit note. The cards show the **Unbilled commission**, **Billed, outstanding**, **Overdue** and **Receivable from insurers**. The screen has three tabs:

1. **Raise Debit Note**: choose the **Insurer** (required), the issue dates (**Issued from**, **Issued to**), **Commission of** and the **Line of business**, and select **Load policies**. Tick the policies to bill: each shows the gross premium, rate, commission, VAT, **Total Due** and EWT. Raise the debit note.
2. **Debit Notes**: the debit notes issued, with their balance; record the insurer's payment against them.
3. **Billing Mode**: whether each insurer's policies are broker-billed or direct-billed.

![Accounts > Remittance > Direct Bill Processing](images/screens-accounts/direct-bill.png)

## Journal vouchers {#journal-vouchers}

{{screen:/accounts/journalvoucher}}

{{screen:/accounts/correctionsjv/correctionsjvdetails}}

{{screen:/accounts/reversaljv/reversaljvdetails}}

**Journal Voucher** lists the manual journals (**Journal Voucher history**) and the **System journals parked for approval**, with **Transaction Code**, **Transaction Number** (JV-YYYY-NNNNN), **Date**, **Description** and **Status** (**Awaiting approval**, **Posted**). **Upload** loads a journal from a file.

To enter a journal, select **Voucher**:

1. Choose the **Transaction Code** (the kind of journal) and enter the **Date** and **Remarks**.
2. Select **Add Data** for each line: **Main A/c**, **Sub A/c**, **Foreign Amount**, **Currency**, **Local Amount**, **Entry** (debit or credit) and **Cost Centre**.
3. Check that **Total Debit** equals **Total credit** (**Net** zero).
4. Select **Submit for approval**.

The journal is approved by {{roles:write:journal-vouchers}} other than the user who submitted it, and is posted on approval. A journal cannot be posted into a closed period.

![Add Journal Voucher](images/screens-accounts/add-journal-voucher.png)

**Correction JV** corrects a posted transaction: choose the **Transaction Code** and **Transaction Number** of the original, the **Corrections JV Transaction Code** and the **Correction Description**, select **Next** and enter the corrected lines. **Reversal JV** reverses a posted transaction in full the same way, with the **Reversal JV Transaction Code** and **Reversal Description**. Both are approved like any journal voucher.

## SAP GL export {#sap-gl-export}

{{screen:/accounts/sap-gl-export}}

Every day at the cut-off, the journals posted since the previous cut-off are written as the SAP GL header and line files to the SAP pick-up folder. The list shows each **Day**, the period **Posted between**, **Status**, **Journals / lines**, **Debit**, **Credit**, **Started by**, **Warnings** and **Files**. **Run now / re-generate** writes the file of a day again, for example after a correction. Download the files from their row.

## Open entry matching and write-offs {#open-entry-matching-and-write-offs}

Open entry matching settles open debit and credit entries of the same account against each other, for example a receipt against a bill posted without a reference.

{{screen:/accounts/open-entry-matching}}

{{screen:/accounts/open-entry-unmatching}}

1. Choose {{menu:/accounts/open-entry-matching}}.
2. Enter the **Sub Account Code** (and, if needed, **Division**, **Department**, the analysis codes and **Currency Code**) and select **Pull**, or **Pull By Criteria**.
3. The **Debit Entries** and **Credit Entries** of the account are listed with **Document No**, **Doc Dt**, **Due Dt**, the foreign and local amounts and balances. Tick the entries to match and enter the **Adjustment Amt** of each.
4. If a small difference remains, enter the **Write off Code**, **Write off reason** and **Write off Amount**.
5. Select **Match**.

**Open Entry Unmatching** undoes a match the same way, with **Unmatch**.

## Accounting Query and All Clients Accounting {#accounting-query-and-all-clients-accounting}

**Accounting Query** searches the accounting entries by **Policy ID / Number**, **Client ID**, **Client Name**, **Entry Type**, **Reference Type**, **Status**, **Start Date**, **End Date** and **GL Code**; **Export** downloads the result. **All Clients Accounting** shows, for every client, the number of transactions, total debits, total credits and balance; **Export CSV** downloads it.

{{screen:/agent/accounting/query}}

{{screen:/agent/accounting/all-clients-details}}

Both screens are read-only. Use them to trace a bill, receipt, remittance or commission line to its journal entries.

## Petty cash {#petty-cash}

A fund is opened on Initiate, which issues its code (PCF-) when left empty and holds the fund size, the available cash, the maximum limit and the minimum cash box. Requests are maker-checker. After a save the screen returns to its list.

{{screen:/accounts/pettycash/pettycashcodeinitiate}}

{{screen:/accounts/pettycash/pettycashrequest}}

{{screen:/accounts/pettycash/disbursement}}

{{screen:/accounts/pettycash/receipts}}

{{screen:/accounts/pettycash/replenish}}

| Screen | What it does |
|---|---|
| **Initiate** | Opens a fund: **Petty Cash code**, **Petty Cash Description**, **Petty Cash Size** (required), the bank, main and sub-account, currency, **Branch Code**, **Department Code**, **Available Cash**, **Max Limit** (the largest single payment) and **Minimum Cash box**. The list shows each fund (for example PCF-MKT, PCF-CEB) with its size, limit, branch and department. |
| **Request** | A request for cash from a fund: **Request Date**, **Requester Name**, **Petty Cash code**, whether it is a **Cash in advance**, then the lines. The request is approved by another user. |
| **Disbursement** | The payment of an approved request from the fund (PCD). |
| **Receipts** | Cash returned to the fund, for example the unused part of a cash advance. |
| **Replenish** | Restores the fund to its size from the bank: the amount spent since the last replenishment, with the bank account. |

![Accounts > Petty Cash > Initiate, the funds and their limits](images/screens-accounts/petty-cash-initiate.png)

## Bank reconciliation {#bank-reconciliation}

{{screen:/accounts/bank-reconciliation}}

{{screen:/accounts/bank-reconciliation/reconciliations}}

{{screen:/accounts/bank-reconciliation/reports/bank-reconciliation-statement}}

{{screen:/accounts/bank-reconciliation/reports/bank-outstanding-cheques}}

{{screen:/accounts/bank-reconciliation/reports/bank-deposits-in-transit}}

{{screen:/accounts/bank-reconciliation/reports/bank-unmatched-lines}}

{{screen:/accounts/bank-reconciliation/reports/bank-book}}

The **Reconciliation Workspace** reconciles one bank account for one period:

1. Choose the **Bank account** and the **Period**.
2. Select **Import statement** and load the bank statement file (in the format of the bank, see [Accounting masters](#finance-masters-kept-by-accounting)).
3. Select **Auto-match**: statement lines and book entries with the same amount and reference are matched.
4. Match the remaining lines by hand: tick a bank line and the book entries it settles. A bank line with no book entry (bank charges, interest) is flagged and booked with a journal.
5. Select **Stale cheques** to list cheques outstanding too long.
6. When the **Difference** is zero (**Adjusted balances agree**), select **Start reconciliation** and submit it.

The cards show the **Balance per bank**, **Balance per books**, **Unmatched bank lines**, **Unmatched book entries**, **Difference** and the status of the **Reconciliation**. The reconciliation is prepared by {{roles:write:bank-reconciliation}} and approved by {{roles:approve:bank-reconciliation}}, a user other than the preparer.

![Accounts > Bank Reconciliation > Reconciliation Workspace](images/screens-accounts/reconciliation-workspace.png)

**Reconciliations** lists the reconciliations with **Reconciliation No.**, **Bank account**, **Period**, **Status**, the adjusted bank and book balances, **Difference**, **Prepared by** and **Approved by**. **New reconciliation** starts one.

The five reports (**Reconciliation Statement Report**, **Outstanding Cheques**, **Deposits in Transit**, **Unmatched Bank Lines**, **Bank Book**) are run like any report: choose the criteria (**Overall** or by bank account), **From Date** and **To Date**, the **Bank Account** and the **File format** (**CSV**, **Excel (XLSX)** or **PDF**), then **Preview** or **Generate**. See [Reports](#reports).

## Insurer statement reconciliation {#insurer-statement-reconciliation}

{{screen:/accounts/insurer-reconciliation/statements}}

An insurer's statement (for example a premium remittance confirmation) is matched with what TIS recorded. The list shows **Number**, **Insurer**, **Statement type**, **Insurer reference**, **Period**, **Lines**, **Matched**, **Gross premium**, **Commission** and **Status**.

1. Select **Import statement**.
2. Choose the **Insurer** and the **Statement type** (required), the **Period from** and **Period to** (required), the **Insurer reference**, the **Tolerance (PHP)** and the **Statement format** (the insurer's own format, else the generic one).
3. Choose the **File (CSV or XLSX)**. **Download template** gives the generic layout.
4. Select **Preview** to check the lines read, then **Import and match**.

Each statement line is matched with the policy, premium and commission recorded; differences within the tolerance match. Open the statement to resolve the lines that differ. The statement is approved by {{roles:approve:insurer-reconciliation}}.

![Import an insurer statement](images/screens-accounts/insurer-statement-import.png)

## Tax: BIR forms and returns {#tax-bir-forms-and-returns}

{{screen:/accounts/tax/2307}}

{{screen:/accounts/tax/reports/bir-vat-summary}}

{{screen:/accounts/tax/reports/bir-sawt}}

{{screen:/accounts/tax/reports/bir-qap}}

{{screen:/accounts/tax/reports/bir-slsp-sales}}

{{screen:/accounts/tax/reports/bir-slsp-purchases}}

**BIR Form 2307** has two tabs: **Issued by us** (the certificates TIS issues for the tax it withheld from payees: referrers, suppliers) and **Received** (the certificates received from insurers and clients for the tax they withheld from TIS). Choose the year and the quarter; each row is a payee with its TIN, ATC, income payments and tax withheld. Print a certificate from its row.

The BIR reports are run like any report (criteria, **From Date**, **To Date**, file format, **Preview** or **Generate**):

| Report | Contents |
|---|---|
| **VAT Summary** | Output VAT on the broker's sales and input VAT on purchases, by month |
| **SAWT** | Summary alphalist of the tax withheld from TIS by its customers (for the income tax return) |
| **QAP** | Quarterly alphalist of payees: the tax TIS withheld (with the 1601-EQ) |
| **SLSP Sales** | Summary list of sales, by customer (filter by principal insurer) |
| **SLSP Purchases** | Summary list of purchases, by supplier |

## Withholding returns: 0619-E, 1601-EQ and their filing records {#withholding-returns-0619-e-1601-eq-and-their-filing-records}

{{screen:/accounts/tax/withholding-returns}}

The screen lists the withholding returns of the year: BIR Form 0619-E for the first and second month of each quarter, 1601-EQ for each quarter and the annual 1604-E, with **Form**, **Period**, **Due date**, **Status** (**Not filed**, **Filed**), **Date filed**, **Filing reference** and **Amount paid**. The cards count the returns, those filed and the amount paid.

1. Select **Open** on the return. The form is shown as the BIR form, computed from the tax withheld in the period (payment vouchers, supplier invoices, commission).
2. Check it; **Print** or **Excel** gives the working paper.
3. File and pay the return with the BIR (eFPS or eBIRForms).
4. Select **Record filing** and enter the date filed, the filing reference and the amount paid. The return becomes **Filed**.

![Accounts > Tax > Withholding Returns](images/screens-accounts/withholding-returns.png)

## Annual information return 1604-E and alphalist of payees {#annual-information-return-1604-e-and-alphalist-of-payees}

{{screen:/accounts/tax/alphalist-1604e}}

Choose the year. The screen shows the BIR Form 1604-E: the background information of TIS (TIN, registered name and address), the remittances of each month from the filing records, and the alphalist of payees with the income payments and tax withheld. The cards show the **Payees**, the **Income payments** and the **Tax withheld**. **Print** and **Excel** give the form; **DAT file** opens [BIR DAT files](#bir-dat-files); **Record filing** records the filing as for the other returns.

## Percentage tax 2551Q (non-VAT broker or agent) {#percentage-tax-2551q-non-vat-broker-or-agent}

{{screen:/accounts/tax/percentage-tax}}

BIR Form 2551Q is the quarterly percentage tax return of a broker or agent that is not VAT-registered. Toyota Insurance Services Philippines is VAT-registered, so the screen warns that the return does not apply; it is kept for the working paper only. Choose the year and quarter: the screen shows the gross sales of each month from the revenue accounts, the rate and the tax due, with **Print**, **Excel** and **Record filing**.

## BIR DAT files {#bir-dat-files}

{{screen:/accounts/tax/dat-files}}

The DAT files are the validation files submitted to the BIR with the QAP (1601-EQ), the SAWT, the SLSP and the 1604-E alphalist.

1. Choose the **File**, the **Year** and the **Quarter** (or month).
2. Select **Generate file**. The file is generated from the report of the same period and checked against it; the result shows under **Validation**.
3. Download the file and validate it with the current BIR validation module before submission.

**Generated files** lists the files of the year with **Period**, **File name**, **Detail records**, **Total**, **Result**, **Generated by** and **Generated on**.

## Sales invoices (EOPT Act) {#sales-invoices-eopt-act}

{{screen:/accounts/tax/sales-invoices}}

Under the Ease of Paying Taxes Act (RA 11976, RR 7-2024) the sales invoice is the primary document of the broker's sale of services: commission billed to insurers and fees. The header shows the seller (Toyota Insurance Services Philippines Corporation), its TIN, VAT status, the serial range and whether the **Invoicing setup** is complete; invoices cannot be issued until the ATP or CAS permit number is set up.

The list shows **Invoice no.**, **Invoice date**, **Buyer**, **Invoice for**, **Reference**, **Total sales**, **VAT**, **Total amount due**, **Balance**, **Status** and **EIS**. To issue an invoice by hand, select **New invoice**: **Invoice for** (for example **Fees and other services (manual)**), **Invoice date**, **Buyer type** and **Buyer** (required), **Buyer TIN (with branch code)**, **Buyer business style**, **Buyer address**, the lines (**Description**, **Qty**, **Unit price**, **VAT class**), **Expected withholding** and **Remarks**, then **Issue invoice**. Commission debit notes issue their invoice themselves.

Invoices are numbered in sequence; an invoice is cancelled with a reason and keeps its number, it is never deleted.

![New invoice](images/screens-accounts/sales-invoice-new.png)

## E-invoicing (EIS) {#e-invoicing-eis}

{{screen:/accounts/tax/eis}}

E-invoicing sends the sales invoices to the BIR Electronic Invoicing System. The header shows whether the **E-invoicing connection** is on or off, the **Mode** (test or production) and when the last invoice was sent. The **Outbox** lists the e-invoices by status: **Queued**, **Failed**, **Rejected**, **Accepted** and **Uploaded manually**, with **Attempts**, **Next attempt**, **EIS reference** and **Last error**. A failed invoice is retried automatically; **Export payloads** downloads the e-invoices for a manual upload on the EIS portal. While e-invoicing is off, invoices are not sent until an administrator turns it on.

## CAS books and documents {#cas-books-and-documents}

Choose Accounts > Tax > CAS Books and Documents.

{{screen:/accounts/tax/cas}}

The screen holds the registration pack of the computerized accounting system (CAS). **Readiness** lists the items the BIR registration needs, each **Complete** or **Missing** with its action: taxpayer name, TIN and registered address; RDO code; CAS permit or acknowledgement number and date (**Enter permit**); invoice ATP (**Enter ATP**); backup custodian; system contact person; the approved system description and backup procedure (**Open document**); and the books printed at least once (**Go to books**).

**Documents** holds the system description and controls and the backup and restore procedure, with their approved version; **Open** and **Print**. The books (general journal, general ledger, cash receipts and disbursements books, sales and purchase books) print per month with page numbers that run on through the year.

![Accounts > Tax > CAS Books and Documents](images/screens-accounts/cas-readiness.png)

## Period end {#period-end}

A fiscal year (FY2026) has twelve monthly periods and an adjustment period 13 used by the year-end close. The cards count the periods Open, Soft-closed, Closed and Locked.

{{screen:/accounts/period-end/periods}}

{{screen:/accounts/period-end/close}}

{{screen:/accounts/period-end/statements}}

The fiscal year of TISPH runs from April to March. **Period Management** lists the periods of the year chosen with **No.**, **Period**, **Start**, **End**, **Status**, **Close run** and **Last change**, and the actions **Soft-close** and **Close**:

| Status | Postings allowed |
|---|---|
| **Open** | All |
| **Soft-closed** | Only by {{roles:approve:period-end}} |
| **Closed** | None; reopened only by {{roles:approve:period-end}} |
| **Locked** | None |

**Next fiscal year** creates the next year; **Import opening balances** loads the opening balances (validated first, then imported all or nothing).

**Month-End Close** runs the close of a period:

1. Select **New close run**, choose the **Period** and enter **Remarks**. Select **Start**. The run (MEC-) executes its steps: the accrual journals of the period (reversed on day 1 of the next period), the recurring journals due, the deferral of unearned commission, the foreign exchange revaluation and the checklist.
2. Check the checklist: the automatic checks (for example the sub-ledgers of premium receivable, commission receivable and due to insurers against their control accounts) and sign the manual items. A failed blocking check stops the close; correct it and run the steps again.
3. Submit the run to soft-close or close the period.
4. The run is approved by {{roles:approve:period-end}}, a user other than the preparer. The period takes the new status.

![New close run](images/screens-accounts/month-end-close-new.png)

**Financial Statements** shows the **Income Statement**, **Balance Sheet** and **Trial Balance** from the posted journals, for a fiscal period or a date range, with the period, year to date and the same columns of the previous year. Select an account to see its postings. **Export** (Excel) and **Print** (PDF).

![Accounts > Period End > Financial Statements](images/screens-accounts/financial-statements.png)

## Year-end close (preparer) {#year-end-close-preparer}

Accounts > Period End > Year-End Close leads through five steps, one card per step; the stepper above the card shows the status of each step. Choose the fiscal year and select **Start year-end close**: the prerequisites are checked at once.

{{screen:/accounts/period-end/year-end}}

1. **Prerequisites**: periods 1 to 12 closed, no unposted journals in the year, the suspense account nil, the trial balance balanced at the year end, the closing accounts set up (current year profit and loss, retained earnings) and the previous fiscal year closed. Each shows **Passed**, **Failed** (with a link to correct it) or **Not Applicable**.
2. **Adjustments**: the year-end adjustments are posted in period 13.
3. **Closing entries**: the income and expense accounts are closed to current earnings and retained earnings; the entries are previewed first.
4. **Close**: the close is submitted and approved by {{roles:approve:period-end}}, a user other than the preparer.
5. **Opening balances**: the balance sheet accounts open the next fiscal year.

A closed year can be reversed only on a request with a reason, approved by another user.

## Recurring journals {#recurring-journals}

{{screen:/accounts/period-end/recurring}}

A template posts the same journal on a schedule (for example rent or an accrual). The list shows **Code**, **Name**, **Kind**, **Frequency**, **Next run**, **End date**, **Amount**, **Auto-post**, **Auto-reverse** and **Status**.

1. Select **New template**.
2. Enter **Name**, **Kind** (**Recurring**, or accrual), **Frequency**, the next run and end date, and the lines (accounts, amounts, cost centre).
3. Choose **Auto-post** (posted without approval) and **Auto-reverse** (reversed on day 1 of the next period, for an accrual).
4. Save.

The due journals are posted by the month-end close, or at once with **Post due journals now**.

## Incentives {#incentives}

{{screen:/incentive/my-programs}}

{{screen:/incentive/calculations}}

{{screen:/incentive/approvals}}

{{screen:/incentive/statement}}

{{screen:/incentive/reports}}

The incentive screens pay the account executives' incentives earned under the programmes set for them (for example a quarterly motor premium target).

| Screen | What it shows |
|---|---|
| **My Programs** | Your progress in each running programme for its current period: **Target**, **Achieved**, **Achievement**, **Estimated payout** and **Status** (**Running**, **Ended**). |
| **Calculations** | The calculation batches (CALC-YYYY-NNNNN) by period. **New Calculation** runs the calculation of a month for the active programmes; adjust the agent lines and submit the batch for approval. |
| **Approvals** | The batches submitted for approval. A batch is approved or rejected by {{roles:approve:incentive}}, a user other than the one who ran or submitted it. |
| **Statement** | The earnings of an account executive for a month: the programmes, totals, the trend of the last 13 months and the payments. **Print** and **Export CSV**. |
| **Reports** | The incentive reports (monthly payout summary, agent payout details, target achievement, top performers, programme effectiveness): **Generate report**. |

An approved batch is paid through [Disbursement](#disbursement-payment-vouchers-and-cheques); its status becomes **Paid**.
