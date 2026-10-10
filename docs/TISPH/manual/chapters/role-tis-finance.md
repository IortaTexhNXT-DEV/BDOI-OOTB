<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-finance.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.finance.
Screens to refresh: "Prepare and approve a remittance to an insurer" (tis-finance-and-general-accounting-remittance)
describes the remittance screens of this build, which are being redesigned in another stream (Tracking, Approval
Workflow and their pop-ups).
-->
# TIS Finance & General Accounting {#tis-finance-and-general-accounting}

## Role summary {#tis-finance-and-general-accounting-summary}

{{role-summary:tis-finance}}

TIS Finance & General Accounting keeps the books of Toyota Insurance Services Philippines. You prepare the payment
vouchers, cheques and bank payment files, enter the supplier invoices and the journal vouchers, run the depreciation,
prepare the remittances to the insurers and pay the commission of the agents and referrers. Every day the posted
journals go to SAP in the SAP GL export; every month you reconcile the banks, close the period and prepare the BIR
returns; once a year you close the fiscal year.

You are also the checker of the accounting: you approve the cheques, the journal vouchers, the supplier invoices, the
bank reconciliations, the month-end close and the changes to the posting rules of another user. Because the user who
enters a record never approves it, TIS needs at least two users with this role. You work with Cash Control, who
collect the premiums and reconcile the payments, with the TIS Operations roles, whose bookings, endorsements and claims
create the journals, and with the TIS General Manager and the unit heads, who also approve supplier invoices.

{{include:generated/roles/tis-finance.md}}

## Daily and periodic tasks {#tis-finance-and-general-accounting-tasks}

| Task | When | Screen |
|---|---|---|
| Decide the cheques, journal vouchers, remittances, petty cash requests and other approvals waiting for you | Every morning and through the day | [My Work](#my-work) |
| Check the SAP GL file of the previous day; re-generate a day when needed | Every morning | [SAP GL export](#sap-gl-export) |
| Prepare payment vouchers; issue the cheque or the bank transfer | Daily | [Disbursement](#disbursement-payment-vouchers-and-cheques), [Bank payment files](#bank-payment-files) |
| Enter supplier invoices and pay suppliers; issue BIR Form 2307 | As invoices arrive; on the payment run | [Accounts payable](#accounts-payable), [BIR Form 2307 for suppliers](#bir-form-2307-for-suppliers) |
| Enter, correct or reverse journal vouchers | As needed | [Journal vouchers](#journal-vouchers) |
| Prepare the remittances to the insurers and decide those of another user | On each remittance schedule | [Remittance to insurers](#remittance-to-insurers) |
| Approve the eligible commission lines and pay the agents and referrers | On each payout | [Commission to agents and referrers](#commission-to-agents-and-referrers) |
| Keep the petty cash funds and replenish them | Daily; when a fund runs low | [Petty cash](#petty-cash) |
| Reconcile each bank account; approve the reconciliations of another user | Month-end | [Bank reconciliation](#bank-reconciliation) |
| Reconcile the insurers' statements | Month-end | [Insurer statement reconciliation](#insurer-statement-reconciliation) |
| Post the monthly depreciation | Month-end | [Fixed assets and depreciation](#fixed-assets-and-depreciation) |
| Run the month-end close and approve the close of another user | Month-end | [Period end](#period-end) |
| Prepare and file the BIR returns | Monthly, quarterly and yearly (see [BIR returns](#process-bir)) | [Tax: BIR forms and returns](#tax-bir-forms-and-returns) |
| Approve changes to the posting rules and account determination | When another user proposes one | [Posting configuration](#posting-configuration-configuration-approvals-posting-rules-account-determination) |
| Close the fiscal year (April to March) | Once a year, after period 12 | [Year-end close](#year-end-close-preparer) |
| Run the financial reports | Month-end and on request | [All Reports](#reports-catalogue) |

## Procedures {#tis-finance-and-general-accounting-procedures}

### Start the day from My Work {#tis-finance-and-general-accounting-my-work}

1. Choose **My Work**. The tiles show what is overdue, due today and due in the next seven days.
2. Select **Approvals** in the list on the left. The list shows each item waiting for your decision: electronic
   transfers, insurer remittances, remittance adjustments, cheque releases, journal vouchers and petty cash requests,
   with the amount and the due date.
3. Select the arrow in **Actions** to open the item on its own screen, check it and approve or reject it there.

Items you entered yourself are not listed for your approval: they wait for another user of your role.

![My Work as TIS Finance & General Accounting, with the cheque, journal voucher and remittance approvals of the day](images/role-tis-finance/my-work.png)

### Enter a journal voucher {#tis-finance-and-general-accounting-journal-voucher}

1. Choose {{menu:/accounts/journalvoucher}} and select **Voucher**.
2. In **Transaction Code**, select the type of voucher; type the **Transaction Description**; check the **Date**.
3. Select **Add Data** to add a line. In the **Add Journal Voucher** window:
   1. Select the **Main Account** and, where the account has them, the **Sub Account**.
   2. In **Entry Type**, select debit or credit.
   3. Select the **Branch Code** and the **Department Code**. The **Cost Centre** shows the default cost centre;
      change it when the line belongs to another cost centre.
   4. Select the **Currency Code** and type the **Amount**. Add **Remarks** if needed.
   5. Select **Save**.
4. Repeat for every line. **Total Debit** and **Total credit** must be equal (**Net** zero).
5. Select **Submit for approval**. The voucher is **Awaiting approval**.

Another user of TIS Finance & General Accounting approves the voucher from My Work or from the journal voucher list;
the voucher is then **Posted** and goes into the SAP GL file of the day it is approved. The approver must not be the
user who entered it, and must be within the approver's limit for journal vouchers on the
[Authority Matrix](#authority-matrix).

![Accounts > Journal Voucher > Add Journal Voucher, the window for one line of the voucher](images/role-tis-finance/journal-voucher-line.png)

To enter many vouchers at once, select **Upload** and use the template of the screen: one row per line, the same
voucher reference for the lines of one voucher. The whole file is checked first (debits equal credits, accounts open
to manual entries, cost centres valid, period open); one error saves nothing and lists every row to correct. Uploaded
vouchers always wait for approval.

The system's own journals that are parked for approval (for example the bank charges of a statement) are listed when
you tick **System journals parked for approval**, and are approved in the same way. To correct or reverse a posted
voucher, use {{menu:/accounts/correctionsjv/correctionsjvdetails}} or {{menu:/accounts/reversaljv/reversaljvdetails}}.
See [Journal vouchers](#journal-vouchers).

### Check the SAP GL export {#tis-finance-and-general-accounting-sap-gl}

The SAP GL header and line files are written every night at the cut-off with the journals posted since the previous
cut-off.

1. Choose {{menu:/accounts/sap-gl-export}}.
2. Check the run of the previous day: **Status**, **Journals / lines**, **Debit** and **Credit** (always equal), and
   **Warnings** (lines on an account outside the SAP chart, or without a cost centre).
3. To send a day again, select **Run now / re-generate**. A re-generation is a new run; every run keeps its files,
   which you download from **Files**.

A journal approved after the cut-off is in the next day's file. See [SAP GL export](#sap-gl-export).

### Pay by cheque: payment voucher and cheque release {#tis-finance-and-general-accounting-disbursement}

1. Choose {{menu:/accounts/paymentvoucher}} and select **Create**.
2. Enter the **Disbursement Date**, **Department Code**, **Branch Code**, **Payee Type** and **Criteria**; select the
   payee (**Customer Code**, **Customer Name**) and, for a policy payment, the **Policy Number**; select the
   **Transaction Type** and the **Payment Currency**; type the **Payment Description**.
3. Select **Next**. In the invoice list, select the payables to pay and select **Next**.
4. In **Select Bank Details**, select the bank account (**Main Account**, **Bank Code**) and the cheque book
   (**Instrument Book ID**), check the **Instrument No** and **Instrument Date** and the **Total Amount**, and select
   **Create Voucher**. The voucher is **Draft** and its cheque **Pending**. A voucher saved without a cheque shows
   **Issue payment** on its detail page.
5. Another user of TIS Finance & General Accounting opens the voucher, selects the cheque in **Cheque book details**
   and selects **Approve**, then **Approve cheque**. The user who created the voucher or issued the cheque cannot
   approve it.
6. When the cheque is printed, select it and select **Print**, then **Print cheque**. The cheque is **Printed** and the
   voucher **Paid**. This cannot be undone.

Payment vouchers are also raised by the system: an approved remittance raises the insurer's voucher, and a commission
payout raises the referrer's voucher. A voucher paid by bank transfer goes into a batch of
{{menu:/accounts/bank-payment-files}} (**New batch**): the batch is approved, its file is uploaded to the bank portal
and the bank's results post each payment. See
[Disbursement: payment vouchers and cheques](#disbursement-payment-vouchers-and-cheques) and
[Bank payment files](#bank-payment-files).

![Accounts > Disbursement, a voucher to an insurer with its cheque waiting for approval by another user](images/role-tis-finance/disbursement-cheque-approval.png)

### Enter and pay a supplier invoice {#tis-finance-and-general-accounting-payables}

1. Choose {{menu:/accounts/payables/invoices}} and select **New supplier invoice**.
2. Select the supplier (new suppliers are added on {{menu:/accounts/payables/suppliers}}), type the supplier's
   invoice number, invoice date and due date, and enter the lines with their input VAT and expanded withholding tax.
3. Save the invoice. It waits for approval.
4. A user of one of these roles approves the invoice: {{roles:approve:payables}}. The user who entered it cannot
   approve it. The invoice is posted on approval.
5. Pay the approved invoices on {{menu:/accounts/payables/payments}}. The withholding tax deducted is certified to the
   supplier on BIR Form 2307 ({{menu:/accounts/payables/2307}}).

Follow the open invoices on {{menu:/accounts/payables/ageing}}. See [Accounts payable](#accounts-payable) and
[BIR Form 2307 for suppliers](#bir-form-2307-for-suppliers).

### Prepare and approve a remittance to an insurer {#tis-finance-and-general-accounting-remittance}

<!-- Screens to refresh: the remittance screens of this build; they are being redesigned in another stream. -->

1. Choose {{menu:/finance/remittance/tracking/status}}. The list shows each remittance with its insurer, number of
   policies, gross amount, commission, net amount and status.
2. Open a **Draft** remittance, check its policies and amounts and select **Process**. The remittance is
   **Pending Approval**.
3. The approver chooses {{menu:/finance/remittance/approval}}, selects the remittance in **Pending approvals**, chooses
   **Approve** or **Reject** in **Approval details** and selects **Submit**.

The approver is another user of TIS Finance & General Accounting or of CCD-Recon (Reconciliation and Reversals),
within the remittance limit of the [Authority Matrix](#authority-matrix). The approved remittance raises the insurer's
payment voucher on Disbursement. Electronic transfers and remittance adjustments are approved on the same screen. See
[Remittance to insurers](#remittance-to-insurers) and [Remittance to the insurers](#process-remittance).

### Pay the commission of agents and referrers {#tis-finance-and-general-accounting-commission}

1. Choose {{menu:/commission/referrer-accounts}} and open the agent or referrer.
2. Approve the **Eligible** commission lines (the premium of their policy is collected). The accrual journal is posted.
3. Generate the payout. The approved lines go to a payment voucher, net of the referrer's withholding tax, and are
   **Paid** when the voucher is paid.

Overriding, profit and contingent commission due from the insurers is computed on
{{menu:/commission/insurer-overrides/computations}}. See [Commission and incentives](#process-commission) and
[Commission to agents and referrers](#commission-to-agents-and-referrers).

### Reconcile a bank account {#tis-finance-and-general-accounting-bank-reconciliation}

1. Choose {{menu:/accounts/bank-reconciliation}}, select the **Bank account** and the **Period**.
2. Select **Import statement** and load the bank's statement file (or enter it by hand). A file already imported is
   refused.
3. Select **Auto-match**. The matching rules pair the statement lines with the book entries.
4. Match the remaining lines by hand: tick a bank line and its book entries. Explain a difference with an adjustment
   journal (bank charges, interest, withholding tax on interest) or mark it as a bank or book error.
5. Check the tiles: **Difference** must be PHP 0.00 ("Adjusted balances agree").
6. Select **Start reconciliation**, then **Prepare**. The reconciliation is **Prepared**.
7. Another user of TIS Finance & General Accounting opens the reconciliation on
   {{menu:/accounts/bank-reconciliation/reconciliations}} and selects **Approve reconciliation**. Every match cleared up
   to the period end is then locked. The user who prepared it cannot approve it.

To change an approved reconciliation, the approver reopens it with remarks: it returns to draft and its matches are
unlocked. Cheques not presented after the stale period are listed with **Stale cheques**. See
[Bank reconciliation](#bank-reconciliation).

![Accounts > Bank Reconciliation > Reconciliation Workspace, September of the operating account before the reconciliation is started](images/role-tis-finance/bank-reconciliation-workspace.png)

### Post the monthly depreciation {#tis-finance-and-general-accounting-depreciation}

1. Register each new asset on {{menu:/accounts/fixed-assets/register}} (class, location, date in service, cost).
2. Choose {{menu:/accounts/fixed-assets/depreciation}}. The screen shows the depreciation due for the period, asset by
   asset, and the **Journal date**.
3. Select **Post depreciation**. One straight-line depreciation journal is posted per asset class.

The depreciation is also a step of the month-end close. Disposals are recorded on
{{menu:/accounts/fixed-assets/disposals}}. See [Fixed assets and depreciation](#fixed-assets-and-depreciation) and
[Asset disposal](#asset-disposal).

### Close the month {#tis-finance-and-general-accounting-month-end}

1. Make sure the month's receipts, remittances, payment vouchers, commission and journal vouchers are posted and the
   bank reconciliations approved.
2. Choose {{menu:/accounts/period-end/close}} and select **New close run**.
3. Select the **Period**, add **Remarks** if needed and select **Start**.
4. Open the run and select **Run steps**: the accruals, recurring journals, commission deferral, revaluation and the
   close checklist. **Rerun steps** first reverses the run's own journals, so the result is the same as one run.
5. Correct what the **Blocking failures** show and select **Re-run checks**.
6. **Sign off** the manual items of the **Checklist**.
7. Select **Submit close**.
8. Another user of TIS Finance & General Accounting opens the run and selects **Approve close**, or
   **Return to preparer** with a reason. On approval the period is **Closed**.

A period can first be soft-closed on {{menu:/accounts/period-end/periods}}: only the approvers of the close can then
still post into it. Closing or reopening a period asks for a reason. See [Period end](#period-end) and
[Month-end](#process-month-end-close).

![Accounts > Period End > Month-End Close, the New close run window](images/role-tis-finance/month-end-new-close-run.png)

### File the BIR returns {#tis-finance-and-general-accounting-bir}

1. Choose {{menu:/accounts/tax/withholding-returns}} and select the year.
2. Open the return due (BIR Form 0619-E for the first two months of a quarter, 1601-EQ with the QAP for the quarter),
   check the amounts and print or export the form.
3. Generate its validation file on {{menu:/accounts/tax/dat-files}} (**Generate file**).
4. After filing with the BIR, record the **Date filed**, the **Payment reference** and the amount paid. The return is
   **Filed**.

The quarterly VAT Summary, SAWT and SLSP and the yearly 1604-E alphalist are on Accounts > Tax. See
[BIR returns](#process-bir) and [Tax: BIR forms and returns](#tax-bir-forms-and-returns).

### Approve a change to the posting rules {#tis-finance-and-general-accounting-posting-rules}

A new version of a posting rule, a change of account determination or of the commission taxes changes no journal until
another user approves it.

1. Choose {{menu:/master/finance/configuration-approvals}}. **Pending approval** lists each change with what it
   changes, the value before and after, and who requested it.
2. Check the change; for a posting rule, look at its sample journal on {{menu:/master/finance/posting-rules}}.
3. Approve it, or reject it with a reason. You cannot decide a change you requested.

See [Posting configuration](#posting-configuration-configuration-approvals-posting-rules-account-determination).

### Close the fiscal year {#tis-finance-and-general-accounting-year-end}

1. After period 12 (March) is closed, choose {{menu:/accounts/period-end/year-end}} and select
   **Start year-end close**. The pre-checks run at once.
2. Resolve each failed check; post the adjustments of period 13 (they are approved like journal vouchers).
3. Another user of TIS Finance & General Accounting, not the one who started the run, closes the year: the closing
   entries are posted, the balances are carried forward to the next year, the year is locked and the next one created.

See [Year-end](#process-year-end) and [Year-end close](#year-end-close-preparer).
